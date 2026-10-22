import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLeaderboardServer, validateRun, weekStart } from '../server/leaderboard.mjs';

test('weekly reset uses Monday midnight UTC and server recomputes scores', () => {
  assert.equal(new Date(weekStart(Date.parse('2026-10-25T23:59:00Z'))).toISOString(), '2026-10-19T00:00:00.000Z');
  assert.equal(new Date(weekStart(Date.parse('2026-10-26T00:00:00Z'))).toISOString(), '2026-10-26T00:00:00.000Z');
  const data = { name: '<b>Ali</b>', region: 'AS', distance: 380, elapsed: 10, wallDuration: 11, rolls: 1, nearMisses: 0, pickups: 0, score: 999999999 };
  const accepted = validateRun(data, 12); assert.equal(accepted.name, 'bAlib'); assert(accepted.score < 1000);
  assert.throws(() => validateRun({ ...data, distance: 99999 }, 12));
  assert.throws(() => validateRun({ ...data, rolls: 9999 }, 12));
  assert.throws(() => validateRun({ ...data, elapsed: NaN }, 12));
  assert.equal(validateRun({ ...data, trafficHits: 2 }, 12).score, accepted.score + 400);
  for (const trafficHits of [-1, .5, NaN, Infinity, '2', 10000]) {
    assert.throws(() => validateRun({ ...data, trafficHits }, 12));
  }
});
test('optional service issues one-use tickets, ranks actual submissions, filters, and rate limits', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'night-ranking-'));
  const server = await createLeaderboardServer({ file: join(dir, 'records.json'), origin: 'http://game.test', secret: 'test-only-secret' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const post = (path, data, origin = 'http://game.test') => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(data) });
  try {
    assert.equal((await (await fetch(base + '/rankings')).json()).entries.length, 0);
    assert.equal((await post('/runs', {}, 'https://wrong.test')).status, 403);
    const { ticket } = await (await post('/runs', {})).json(); assert(ticket);
    const run = { ticket, name: 'Real Pilot', region: 'AS', distance: 38, elapsed: 1, wallDuration: 1, rolls: 0, nearMisses: 0, pickups: 0, trafficHits: 1 };
    assert.equal((await post('/scores', run)).status, 201); assert.equal((await post('/scores', run)).status, 400);
    const all = await (await fetch(base + '/rankings?metric=distance')).json(); assert.equal(all.entries.length, 1); assert.equal(all.entries[0].name, 'Real Pilot');
    assert.equal(all.entries[0].score, Math.floor(38 * (1 + 1 / 600)) + 200);
    const otherRegion = await (await fetch(base + '/rankings?region=EU&period=weekly')).json(); assert.equal(otherRegion.entries.length, 0);
    assert.equal((await fetch(base + '/rankings?metric=bad')).status, 400);
    let limited = false;
    for (let i = 0; i < 13; i++) if ((await post('/runs', {})).status === 429) limited = true;
    assert(limited);
  } finally { await new Promise(resolve => server.close(resolve)); await rm(dir, { recursive: true, force: true }); }
});
