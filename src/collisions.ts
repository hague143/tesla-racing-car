import type { Obstacle, Run } from './types';

// Continuous segment vs. expanded AABB (Minkowski sum). Includes vertical motion,
// so high-speed traffic cannot tunnel through a car or hit one clearing its roof.
export function sweptBox(
  from: readonly number[], to: readonly number[], half: readonly number[],
): boolean {
  let enter = 0, exit = 1;
  for (let axis = 0; axis < 3; axis++) {
    const delta = to[axis] - from[axis];
    if (Math.abs(delta) < 1e-9) { if (Math.abs(from[axis]) > half[axis]) return false; continue; }
    let a = (-half[axis] - from[axis]) / delta, b = (half[axis] - from[axis]) / delta;
    if (a > b) [a, b] = [b, a];
    enter = Math.max(enter, a); exit = Math.min(exit, b);
    if (enter > exit) return false;
  }
  return exit >= 0 && enter <= 1;
}
export function hitsTraffic(run: Run, car: Obstacle) {
  const centerY = car.height / 2;
  return sweptBox(
    [run.prevX - car.x, run.prevY + .7 - centerY, -car.prevZ],
    [run.x - car.x, run.y + .7 - centerY, -car.z],
    [.82 + car.width / 2, .56 + centerY, 1.95 + car.length / 2],
  );
}
