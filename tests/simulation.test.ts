import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, emptyCommands, simulate } from '../src/simulation.ts';
import { hitsTraffic, sweptBox } from '../src/collisions.ts';
import { spawnRow, rowSpacing } from '../src/traffic.ts';
import { StateMachine } from '../src/state.ts';
import { LANES } from '../src/config.ts';
import { cleanName, loadProfile, saveRecord, save } from '../src/storage.ts';
import type { Commands, Run } from '../src/types.ts';

function empty(seed = 12) { const r = createRun(seed); r.obstacles.forEach(o => o.active = false); r.pickupsPool.forEach(p => p.active = false); r.nextRow = 1e9; return r; }
function step(r: Run, seconds: number, input: Partial<Commands> = {}, hz = 120) {
  for (let i = 0; i < seconds * hz; i++) simulate(r, { ...emptyCommands(), ...input, lane: i === 0 ? input.lane || 0 : 0, jump: i === 0 && !!input.jump, roll: i === 0 ? input.roll || 0 : 0 }, 1 / hz);
}

test('automatic movement is frame independent and lane changes settle without overshooting', () => {
  const a = empty(), b = empty(); step(a, 20, { lane: 1 }, 120); step(b, 20, { lane: 1 }, 60);
  assert(Math.abs(a.distance - b.distance) < 1); assert.equal(a.lane, 2); assert(Math.abs(a.x - LANES[2]) < .01);
  step(a, 1, { lane: 1 }); assert.equal(a.lane, 3); step(a, 1, { lane: 1 }); assert.equal(a.lane, 3);
  assert(a.speed > 38 && a.distance > 700);
});
test('jump follows gravity, rolls complete cleanly before landing, and reset starts grounded', () => {
  const r = empty(); simulate(r, { ...emptyCommands(), jump: true }, 1 / 120);
  assert(r.y > 0 && r.vy > 0); step(r, .15); simulate(r, { ...emptyCommands(), roll: -1 }, 1 / 120);
  step(r, .4); assert(r.y > 2 && r.roll < 0); step(r, .8);
  assert.equal(r.y, 0); assert.equal(r.vy, 0); assert.equal(r.roll, 0); assert.equal(r.rolls, 1); assert(r.score > r.distance + 240);
  const fresh = createRun(); assert.equal(fresh.rolls, 0); assert.equal(fresh.energy, 100); assert.equal(fresh.y, 0);
});
test('holding boost depletes energy, locks out oscillation, then recharges', () => {
  const r = empty(); step(r, 3, { boost: true }); assert(r.boosting); assert(r.speed > 58); assert(r.energy < 5);
  step(r, .3, { boost: true }); assert(r.boostLocked && !r.boosting); const speed = r.speed;
  step(r, 2); assert(r.energy > 10 && !r.boosting && r.speed < speed); step(r, 3); assert(!r.boostLocked);
  step(r, .1, { boost: true }); assert(r.boosting);
});
test('swept collision detects a high-speed crossing but lets an airborne car clear traffic', () => {
  assert(sweptBox([0, 0, 20], [0, 0, -20], [1, 1, 4]));
  assert(!sweptBox([0, 3, 20], [0, 3, -20], [1, 1, 4]));
  const r = empty(), car = { ...r.obstacles[0], active: true, x: r.x, prevZ: -10, z: 10 };
  assert(hitsTraffic(r, car)); r.y = r.prevY = 2.5; assert(!hitsTraffic(r, car));
  r.y = r.prevY = 0; Object.assign(r.obstacles[0], car, { z: -2, prevZ: -2, variant: 2, speed: 0, height: 1.05, length: 1.1 });
  let collision = 0; simulate(r, emptyCommands(), 1 / 120, e => { if (e === 'collision') collision++; });
  assert(!r.alive); assert.equal(collision, 1); const distance = r.distance;
  simulate(r, emptyCommands(), 1 / 120); assert.equal(r.distance, distance);
});
test('traffic collisions launch the player and award 200 points only once per car', () => {
  for (const variant of [0, 1]) {
    const r = empty(), car = r.obstacles[0], events: string[] = [];
    Object.assign(car, { active: true, x: r.x, z: -3.5, prevZ: -3.5, variant });
    simulate(r, emptyCommands(), 1 / 120, e => events.push(e));
    assert(r.alive && r.y > 0 && r.vy > 11.5); assert.equal(r.trafficHits, 1);
    assert(r.score >= 200); assert.equal(events.filter(e => e === 'ram').length, 1);
    assert(!events.includes('collision')); assert(car.hit && car.nearMissed);
    step(r, .4); assert(r.y > 2 && r.alive); assert.equal(r.trafficHits, 1);
    // Landing against the same car cannot farm the bonus.
    r.y = r.prevY = r.vy = 0; car.z = car.prevZ = -2;
    step(r, .1); assert.equal(r.trafficHits, 1); assert.equal(r.nearMisses, 0); assert.equal(r.vy, 0);
    const fresh = createRun(); assert.equal(fresh.trafficHits, 0); assert(fresh.obstacles.every(o => !o.hit));
  }
});
test('hurdles still end a run during a traffic launch, but can be cleared by jumping', () => {
  const r = empty();
  Object.assign(r.obstacles[0], { active: true, x: r.x, z: -3.5, variant: 0 });
  Object.assign(r.obstacles[1], { active: true, x: r.x, z: -2, variant: 2, speed: 0, height: 1.05, length: 1.1 });
  step(r, .02); assert.equal(r.trafficHits, 1); assert(!r.alive);
  const airborne = empty(); airborne.y = airborne.prevY = 2.5;
  Object.assign(airborne.obstacles[0], { active: true, x: airborne.x, z: -2, variant: 2, speed: 0, height: 1.05, length: 1.1 });
  step(airborne, .03); assert(airborne.alive); assert.equal(airborne.trafficHits, 0);
});
test('pickups refill energy once and near misses score once', () => {
  const r = empty(); r.energy = 15; Object.assign(r.pickupsPool[0], { active: true, lane: 1, z: -2.9, prevZ: -2.9 });
  step(r, .1); assert.equal(r.pickups, 1); assert(r.energy > 44); step(r, .2); assert.equal(r.pickups, 1);
  Object.assign(r.obstacles[0], { active: true, x: LANES[0], z: 2.9, prevZ: 2.9, nearMissed: false });
  step(r, .1); assert.equal(r.nearMisses, 1); step(r, .5); assert.equal(r.nearMisses, 1);
  assert.equal(r.score, Math.floor(r.distance * (1 + r.elapsed / 600) + r.pickups * 75 + r.nearMisses * 100));
  r.y = r.prevY = 2; r.vy = 0;
  Object.assign(r.obstacles[1], { active: true, x: LANES[3], z: 2.9, prevZ: 2.9, nearMissed: false });
  step(r, .1); assert.equal(r.nearMisses, 1, 'distant cars are not close passes while airborne');
});
test('generated traffic always leaves a connected, reachable corridor with bounded density', () => {
  const r = empty(887); r.distance = 35000;
  for (let i = 0; i < 1000; i++) {
    r.obstacles.forEach(o => { o.active = false; o.hit = true; }); r.pickupsPool.forEach(p => p.active = false);
    const previous = r.lastSafeLane; spawnRow(r, -420);
    const active = r.obstacles.filter(o => o.active);
    assert(active.length >= 2 && active.length <= 3);
    assert(active.filter(o => o.variant !== 2).length >= 2);
    assert(active.filter(o => o.variant === 2).length <= 1);
    assert(!active.some(o => o.lane === r.lastSafeLane)); assert(Math.abs(previous - r.lastSafeLane) <= 1);
    assert(rowSpacing(66, i / 1000) / 66 >= 1.95);
    assert(active.every(o => o.speed === (o.variant === 2 ? 0 : 18) && !o.hit));
  }
});
test('a new run starts with at least ten traffic cars and a stationary hurdle', () => {
  const active = createRun().obstacles.filter(o => o.active);
  assert(active.filter(o => o.variant !== 2).length >= 10);
  assert(active.some(o => o.variant === 2 && o.speed === 0));
});
test('speed and traffic difficulty increase within limits over a long run', () => {
  const r = empty(); step(r, 600); assert(r.speed <= 61.01 && r.speed > 60); assert(r.energy <= 100);
  assert(rowSpacing(66, 0) > rowSpacing(66, 1));
});
test('state machine rejects invalid paths and pause/resume preserves simulation', () => {
  const states: string[] = [], m = new StateMachine(s => states.push(s));
  assert.throws(() => m.go('PLAYING')); m.go('LOADING'); m.go('MENU'); m.go('PLAYING');
  const r = empty(); step(r, 4); const snapshot = JSON.stringify(r);
  m.go('PAUSED'); assert.equal(JSON.stringify(r), snapshot); m.go('PLAYING'); step(r, 1); assert(r.elapsed > 4.9);
  m.go('GAME_OVER'); m.go('PLAYING'); m.go('ERROR'); m.go('LOADING'); assert.equal(states.at(-1), 'LOADING');
});
test('records survive storage reload, sanitize names, and recover from corrupt storage', () => {
  const values = new Map();
  Object.assign(globalThis, { localStorage: { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) } });
  const p = loadProfile(), r = empty(); r.score = 2500; r.distance = 1200;
  assert(saveRecord(p, r).newScore); const again = loadProfile(); assert.equal(again.bestScore, 2500); assert.equal(again.bestDistance, 1200);
  assert.equal(cleanName('<script>💥'), 'script'); values.set('nightshift.profile.v2', '{broken'); assert.equal(loadProfile().bestScore, 0);
  values.set('nightshift.profile.v2', JSON.stringify({ bestScore: -1, region: 'INVALID', name: 'Ok' })); assert.equal(loadProfile().region, 'GLOBAL');
  Object.assign(globalThis, { localStorage: { setItem: () => { throw Error('blocked'); } } }); assert.equal(save('x', {}), false);
});
