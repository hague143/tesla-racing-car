import { LANES } from './config';
import type { Run } from './types';

export function random(run: Run) {
  run.seed = (Math.imul(run.seed, 1664525) + 1013904223) >>> 0;
  return run.seed / 4294967296;
}
export function rowSpacing(speed: number, difficulty: number) {
  // At least 2.25s between rows even at boost speed. Adjacent safe lanes need
  // at most 0.45s to reach, leaving >1.8s for reaction. Traffic has equal speed
  // and no lane changes, so later rows cannot catch the previous row.
  return Math.max(145, speed * (2.8 - Math.min(difficulty, 1) * .55));
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
  const count = run.rowIndex < 3 ? 1 : 1 + (random(run) < .55 + difficulty * .35 ? 1 : 0) + (difficulty > .35 && random(run) < difficulty * .45 ? 1 : 0);
  for (const lane of blocked.slice(0, count)) {
    const car = run.obstacles.find(o => !o.active); if (!car) break;
    const variant = Math.floor(random(run) * 3);
    Object.assign(car, { active: true, lane, x: LANES[lane], z, prevZ: z, speed: 18,
      height: variant === 1 ? 1.76 : variant === 2 ? 1.05 : 1.48,
      length: variant === 2 ? 1.1 : 4.75, width: variant === 2 ? 2.5 : 1.9, variant, nearMissed: false });
  }
  if (run.rowIndex % 2 === 0) {
    const item = run.pickupsPool.find(p => !p.active);
    if (item) Object.assign(item, { active: true, lane: safe, z: z + 16, prevZ: z + 16 });
  }
  run.rowIndex++;
}
