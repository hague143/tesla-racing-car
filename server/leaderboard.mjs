// Optional, separate service. No server secrets are included in the Vite bundle.
import http from 'node:http';
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { readFile, mkdir, writeFile, rename } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const REGIONS = ['GLOBAL', 'NA', 'SA', 'EU', 'AS', 'AF', 'OC'];
export function weekStart(now = Date.now()) {
  const d = new Date(now); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return +d;
}
export function validateRun(data, age) {
  for (const key of ['distance', 'elapsed', 'wallDuration', 'rolls', 'nearMisses', 'pickups']) {
    if (!Number.isFinite(data[key]) || data[key] < 0) throw Error('Invalid run statistics');
  }
  const { elapsed, distance, wallDuration, rolls, nearMisses, pickups, trafficHits = 0 } = data;
  // These checks reject impossible submissions, not all client-side cheating.
  if (elapsed < 1 || elapsed > 21600 || elapsed > age + 3 || wallDuration > age + 5 || elapsed > wallDuration + 2 || distance > 84 * elapsed + 3 || distance < 20 * elapsed - 10) throw Error('Implausible run timing or distance');
  if (![rolls, nearMisses, pickups, trafficHits].every(Number.isInteger) || trafficHits < 0 || rolls > elapsed * 2 || nearMisses + trafficHits > distance / 40 + 12 || pickups > distance / 100 + 3) throw Error('Implausible bonuses');
  if (typeof data.region !== 'string' || !REGIONS.includes(data.region)) throw Error('Invalid region');
  const name = typeof data.name === 'string' ? data.name.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 20) : '';
  if (!name) throw Error('Choose a valid pilot name');
  return { name, region: data.region, distance: Math.round(distance * 100) / 100,
    score: Math.floor(distance * (1 + Math.min(elapsed / 600, .5)) + rolls * 250 + nearMisses * 100 + pickups * 75 + trafficHits * 200), at: Date.now() };
}
function top(entries, period, metric, region) {
  const weekly = weekStart();
  const sorted = entries.filter(e => (period !== 'weekly' || e.at >= weekly) && (region === 'GLOBAL' || e.region === region))
    .sort((a, b) => b[metric] - a[metric] || a.at - b.at);
  const seen = new Set();
  return sorted.filter(e => { const identity = e.name.toLocaleLowerCase() + ':' + e.region; if (seen.has(identity)) return false; seen.add(identity); return true; }).slice(0, 100);
}
export async function createLeaderboardServer({ file = resolve('.leaderboard/scores.json'), origin = process.env.ALLOWED_ORIGIN || 'http://localhost:8001', secret = process.env.LEADERBOARD_SECRET || randomBytes(32).toString('hex') } = {}) {
  let entries = [];
  try { entries = JSON.parse(await readFile(file, 'utf8')); if (!Array.isArray(entries)) throw Error('Invalid scores file'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const tickets = new Map(), rates = new Map(); let pendingWrite = Promise.resolve();
  const sign = payload => createHmac('sha256', secret).update(payload).digest('base64url');
  const json = (res, status, data) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(JSON.stringify(data)); };
  const server = http.createServer(async (req, res) => {
    if (req.headers.origin && req.headers.origin !== origin) return json(res, 403, { error: 'Origin not allowed' });
    res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    const url = new URL(req.url, 'http://service.local'), now = Date.now();
    const ip = req.socket.remoteAddress || 'unknown'; // Deliberately ignore untrusted X-Forwarded-For.
    for (const [key, v] of rates) if (now > v.until) rates.delete(key);
    const key = ip + ':' + (req.method === 'GET' ? 'read' : url.pathname), limit = req.method === 'GET' ? 120 : 12;
    const rate = rates.get(key) || { count: 0, until: now + 60000 }; rate.count++; rates.set(key, rate);
    if (rate.count > limit) { res.setHeader('Retry-After', '60'); return json(res, 429, { error: 'Too many requests' }); }
    for (const [key, issued] of tickets) if (now - issued > 21600000) tickets.delete(key);
    try {
      if (req.method === 'GET' && url.pathname === '/rankings') {
        const period = url.searchParams.get('period') || 'all', metric = url.searchParams.get('metric') || 'score', region = url.searchParams.get('region') || 'GLOBAL';
        if (!['all', 'weekly'].includes(period) || !['score', 'distance'].includes(metric) || !REGIONS.includes(region)) return json(res, 400, { error: 'Invalid filter' });
        return json(res, 200, { entries: top(entries, period, metric, region), weeklyReset: 'Monday 00:00 UTC' });
      }
      if (req.method !== 'POST' || !['/runs', '/scores'].includes(url.pathname)) return json(res, 404, { error: 'Not found' });
      if (!req.headers['content-type']?.startsWith('application/json')) return json(res, 415, { error: 'Use application/json' });
      let raw = '', size = 0;
      for await (const chunk of req) { size += chunk.length; if (size > 4096) return json(res, 413, { error: 'Submission too large' }); raw += chunk; }
      const data = JSON.parse(raw || '{}');
      if (url.pathname === '/runs') {
        if (tickets.size >= 10000) return json(res, 503, { error: 'Try again later' });
        const payload = randomBytes(24).toString('base64url'); tickets.set(payload, now);
        return json(res, 201, { ticket: payload + '.' + sign(payload) });
      }
      if (typeof data.ticket !== 'string') return json(res, 400, { error: 'Run ticket required' });
      const [payload, signature = ''] = data.ticket.split('.'), expected = Buffer.from(sign(payload)), received = Buffer.from(signature);
      if (expected.length !== received.length || !timingSafeEqual(expected, received) || !tickets.has(payload)) return json(res, 400, { error: 'Invalid, used, or expired run ticket' });
      const entry = validateRun(data, (now - tickets.get(payload)) / 1000); tickets.delete(payload);
      entries.push(entry);
      // Retain every candidate needed by all-time and current-week top 100,
      // globally and in every region, in both ranking dimensions.
      const retained = new Set();
      for (const region of REGIONS) for (const period of ['all', 'weekly']) for (const metric of ['score', 'distance']) for (const e of top(entries, period, metric, region)) retained.add(e);
      entries = [...retained]; const serialized = JSON.stringify(entries);
      const write = pendingWrite.then(async () => { await mkdir(dirname(file), { recursive: true }); await writeFile(file + '.tmp', serialized); await rename(file + '.tmp', file); });
      pendingWrite = write.catch(() => {}); await write;
      return json(res, 201, { accepted: true, score: entry.score });
    } catch (error) {
      return json(res, error instanceof SyntaxError || /Invalid|Implausible|Choose/.test(error.message) ? 400 : 500, { error: error.code ? 'Service storage unavailable' : error.message });
    }
  });
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const server = await createLeaderboardServer();
  server.listen(Number(process.env.PORT || 8787), '0.0.0.0', () => console.log('Optional leaderboard listening on port', server.address().port));
}
