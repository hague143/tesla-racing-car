import { CONFIG } from './config';
import type { Profile, Run } from './types';
export interface RankingFilter { period: 'all' | 'weekly'; metric: 'score' | 'distance'; region: string }
export interface Entry { name: string; region: string; score: number; distance: number }
export class Leaderboard {
  configured = Boolean(CONFIG.leaderboardUrl);
  private ticket: Promise<string | null> = Promise.resolve(null);
  private async request(path: string, data?: object) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 6500);
    try {
      const response = await fetch(CONFIG.leaderboardUrl + path, {
        signal: controller.signal, method: data ? 'POST' : 'GET',
        ...(data ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) } : {}),
        credentials: 'omit',
      });
      if (!response.ok) throw new Error('Ranking service unavailable');
      return await response.json();
    } finally { clearTimeout(timer); }
  }
  start() {
    this.ticket = this.configured ? this.request('/runs', {}).then(data => typeof data.ticket === 'string' ? data.ticket : null).catch(() => null) : Promise.resolve(null);
  }
  async list(filter: RankingFilter): Promise<Entry[] | null> {
    if (!this.configured) return null;
    const params = new URLSearchParams({ ...filter });
    const result = await this.request('/rankings?' + params);
    if (!Array.isArray(result.entries)) throw new Error('Invalid rankings response');
    return result.entries.slice(0, 100).filter((e: Entry) => typeof e.name === 'string' && typeof e.region === 'string' && Number.isFinite(e.score) && Number.isFinite(e.distance));
  }
  async submit(profile: Profile, run: Run, wallDuration: number): Promise<'offline' | 'saved' | 'failed'> {
    if (!this.configured) return 'offline';
    const ticket = await this.ticket; if (!ticket) return 'failed';
    try {
      await this.request('/scores', { ticket, name: profile.name, region: profile.region,
        distance: run.distance, elapsed: run.elapsed, wallDuration, rolls: run.rolls, nearMisses: run.nearMisses, pickups: run.pickups, trafficHits: run.trafficHits });
      return 'saved';
    } catch { return 'failed'; }
  }
}
