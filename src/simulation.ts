import { clamp, GRAVITY, JUMP_VELOCITY, LANES, TRAFFIC_HIT_POINTS, TRAFFIC_LAUNCH_SPEED, TRAFFIC_SPAWN_Z } from './config';
import { hitsTraffic, sweptBox } from './collisions';
import { rowSpacing, spawnRow } from './traffic';
import type { Commands, Run, SimEvent } from './types';

export function createRun(seed = 1927): Run {
  const run: Run = {
    x: LANES[1], prevX: LANES[1], lane: 1, y: 0, prevY: 0, vy: 0,
    speed: 32, distance: 0, elapsed: 0, score: 0, energy: 100, boosting: false, boostLocked: false,
    roll: 0, rollTime: -1, rollDuration: .65, rollDirection: 1, rolls: 0, nearMisses: 0,
    pickups: 0, trafficHits: 0, jumpCooldown: 0, alive: true, nextRow: 125, rowIndex: 0, seed, lastSafeLane: 1,
    obstacles: Array.from({ length: 36 }, (_, id) => ({ active: false, id, lane: 0, x: 0, z: 0,
      prevZ: 0, speed: 18, height: 1.5, length: 4.75, width: 1.9, variant: 0, nearMissed: false, hit: false })),
    pickupsPool: Array.from({ length: 12 }, () => ({ active: false, lane: 0, z: 0, prevZ: 0, phase: 0 })),
  };
  for (const z of [-70, -195, -320, -445, TRAFFIC_SPAWN_Z]) spawnRow(run, z);
  return run;
}
export const emptyCommands = (): Commands => ({ lane: 0, jump: false, roll: 0, boost: false, brake: false, horn: false });
const calculateScore = (run: Run) => Math.floor(run.distance * (1 + Math.min(run.elapsed / 600, .5)) + run.rolls * 250 + run.nearMisses * 100 + run.pickups * 75 + run.trafficHits * TRAFFIC_HIT_POINTS);

// Called only with fixed steps by the loop. It has no DOM, Three.js, clock, or audio dependencies.
export function simulate(run: Run, input: Commands, dt: number, emit: (event: SimEvent) => void = () => {}) {
  if (!run.alive || !Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, 1 / 60);
  run.prevX = run.x; run.prevY = run.y;
  run.elapsed += dt;
  run.lane = clamp(run.lane + Math.sign(input.lane), 0, 3);
  const change = LANES[run.lane] - run.x;
  run.x += clamp(change * 16, -18, 18) * dt;
  if (Math.abs(change) < .002) run.x = LANES[run.lane];
  run.jumpCooldown = Math.max(0, run.jumpCooldown - dt);
  if (input.jump && run.y === 0 && run.jumpCooldown === 0) {
    run.vy = JUMP_VELOCITY; run.jumpCooldown = .15; emit('jump');
  }
  if (run.y > 0 || run.vy > 0) {
    run.y = Math.max(0, run.y + run.vy * dt - .5 * GRAVITY * dt * dt);
    run.vy -= GRAVITY * dt;
    if (run.y === 0) { run.vy = 0; run.jumpCooldown = .12; emit('landing'); }
  }
  const airRemaining = (run.vy + Math.sqrt(run.vy ** 2 + 2 * GRAVITY * run.y)) / GRAVITY;
  if (input.roll && run.y > .15 && run.rollTime < 0 && airRemaining > .32) {
    run.rollTime = 0; run.rollDirection = Math.sign(input.roll); run.rollDuration = Math.min(.65, airRemaining - .04);
  }
  if (run.rollTime >= 0) {
    run.rollTime += dt;
    const t = Math.min(1, run.rollTime / run.rollDuration);
    run.roll = Math.PI * 2 * run.rollDirection * (t * t * (3 - 2 * t));
    if (t >= 1) { run.roll = 0; run.rollTime = -1; run.rolls++; emit('roll'); }
  }
  if (run.energy >= 25) run.boostLocked = false;
  const boosting = input.boost && !input.brake && !run.boostLocked && run.energy > 0;
  if (boosting && !run.boosting) emit('boost');
  run.boosting = boosting;
  run.energy = clamp(run.energy + (boosting ? -32 : 7) * dt, 0, 100);
  if (run.energy === 0) run.boostLocked = true;
  const cruise = Math.min(61, 38 + run.elapsed * .12);
  const targetSpeed = input.brake ? 25 : boosting ? Math.min(84, cruise + 23) : cruise;
  run.speed += (targetSpeed - run.speed) * (1 - Math.exp(-dt * (boosting ? 1.8 : .8)));
  run.distance += run.speed * dt;
  // World is represented relative to the player, avoiding large-coordinate drift.
  for (const car of run.obstacles) {
    if (!car.active) continue;
    car.prevZ = car.z; car.z += (run.speed - car.speed) * dt;
    if (!car.hit && hitsTraffic(run, car)) {
      if (car.variant === 2) {
        run.alive = false; run.score = calculateScore(run); emit('collision'); return;
      }
      // Each traffic car awards one launch. Hurdles remain lethal, even during
      // a launch, unless the car's actual jump height clears their collider.
      car.hit = true; car.nearMissed = true; run.trafficHits++;
      run.y = Math.max(run.y, .12); run.vy = Math.max(run.vy, TRAFFIC_LAUNCH_SPEED);
      run.jumpCooldown = .15; run.score = calculateScore(run); emit('ram');
    }
    if (!car.nearMissed && car.prevZ <= 3 && car.z > 3) {
      car.nearMissed = true;
      if (Math.abs(run.x - car.x) < 3.9) { run.nearMisses++; emit('near'); }
    }
    if (car.z > 30) car.active = false;
  }
  for (const pickup of run.pickupsPool) {
    if (!pickup.active) continue;
    pickup.prevZ = pickup.z; pickup.z += run.speed * dt;
    if (sweptBox([run.prevX - LANES[pickup.lane], run.prevY - .3, -pickup.prevZ],
      [run.x - LANES[pickup.lane], run.y - .3, -pickup.z], [1.35, 1.25, 2.8])) {
      pickup.active = false; run.energy = Math.min(100, run.energy + 30); run.pickups++; emit('pickup');
    }
    if (pickup.z > 20) pickup.active = false;
  }
  run.nextRow -= (run.speed - 18) * dt;
  if (run.nextRow <= 0) {
    spawnRow(run, TRAFFIC_SPAWN_Z);
    // Use maximum boost speed for the spacing guarantee, not only current speed.
    run.nextRow += rowSpacing(84 - 18, run.distance / 14000);
  }
  run.score = calculateScore(run);
}
