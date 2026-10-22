import type { Profile, Run, Settings } from './types';
import { clamp } from './config';
const read = (key: string): Record<string, unknown> => {
  try { const data = JSON.parse(localStorage.getItem(key) || '{}'); return data && typeof data === 'object' ? data : {}; } catch { return {}; }
};
export function save(key: string, data: unknown) { try { localStorage.setItem(key, JSON.stringify(data)); return true; } catch { return false; } }
export function loadSettings(): Settings {
  const s = read('nightshift.settings.v2');
  return {
    quality: s.quality === 'low' || s.quality === 'high' ? s.quality : 'medium',
    muted: s.muted === true, volume: typeof s.volume === 'number' ? clamp(s.volume, 0, 1) : .55,
    reducedMotion: typeof s.reducedMotion === 'boolean' ? s.reducedMotion : matchMedia('(prefers-reduced-motion: reduce)').matches,
    shake: s.shake !== false, language: s.language === 'es' ? 'es' : 'en', seenControls: s.seenControls === true,
  };
}
export function cleanName(name: string) { return name.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 20) || 'Night pilot'; }
export const REGIONS = ['GLOBAL', 'NA', 'SA', 'EU', 'AS', 'AF', 'OC'] as const;
export function loadProfile(): Profile {
  const p = read('nightshift.profile.v2');
  const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, v) : 0;
  return { name: cleanName(typeof p.name === 'string' ? p.name : 'Night pilot'),
    region: REGIONS.includes(p.region as typeof REGIONS[number]) ? String(p.region) : 'GLOBAL',
    bestScore: finite(p.bestScore), bestDistance: finite(p.bestDistance), runs: finite(p.runs) };
}
export function saveRecord(profile: Profile, run: Run) {
  const newScore = run.score > profile.bestScore, newDistance = run.distance > profile.bestDistance;
  profile.bestScore = Math.max(profile.bestScore, run.score); profile.bestDistance = Math.max(profile.bestDistance, run.distance); profile.runs++;
  const stored = save('nightshift.profile.v2', profile);
  return { newScore, newDistance, stored };
}
