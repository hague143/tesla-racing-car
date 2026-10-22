import { LANES } from './config';
import type { Run } from './types';

export function random(run: Run) {
  run.seed = (Math.imul(run.seed, 1664525) + 1013904223) >>> 0;
  return run.seed / 4294967296;
}
export function rowSpacing(speed: number, difficulty: number) {
  // Denser car rows retain at least 1.95s at maximum relative boost speed.
  // An adjacent reserved lane takes <0.45s to reach. All traffic cars share
  // a speed; stationary hurdles are limited to one every third row.
  return Math.max(125, speed * (2.3 - Math.min(Math.max(difficulty, 0), 1) * .35));
}
export function spawnRow(run: Run, z: number) {
  const difficulty = Math.min(1, run.distance / 14000);
  // A connected corridor: each row's guaranteed free lane is adjacent to the last.
  const shift = Math.floor(random(run) * 3) - 1;
  const safe = Math.max(0, Math.min(3, run.lastSafeLane + shift));
  run.lastSafeLane = safe;
  const blocked = [0, 1, 2, 3].filter(l => l !== safe);
  for (let i = blocked.length - 1; i > 0; i--) {
    const j = Math.floor(random(run) * (i + 1)); [blocked[i], blocked[j]] = [blocked[j], blocked[i]];
  }
  const hasHurdle = run.rowIndex >= 2 && run.rowIndex % 3 === 2;
  const count = hasHurdle ? 3 : run.rowIndex < 2 ? 2 : 2 + (random(run) < .65 + difficulty * .3 ? 1 : 0);
  for (const [index, lane] of blocked.slice(0, count).entries()) {
    const car = run.obstacles.find(o => !o.active); if (!car) break;
    const variant = hasHurdle && index === 2 ? 2 : Math.floor(random(run) * 2);
    Object.assign(car, { active: true, lane, x: LANES[lane], z, prevZ: z, speed: variant === 2 ? 0 : 18,
      height: variant === 1 ? 1.76 : variant === 2 ? 1.05 : 1.48,
      length: variant === 2 ? 1.1 : 4.75, width: variant === 2 ? 2.5 : 1.9, variant, nearMissed: false, hit: false });
  }
  if (run.rowIndex % 2 === 0) {
    const item = run.pickupsPool.find(p => !p.active);
    if (item) Object.assign(item, { active: true, lane: safe, z: z + 16, prevZ: z + 16 });
  }
  run.rowIndex++;
}
