export const roadCenter = z => 32 * Math.sin(z / 270) + 15 * Math.sin(z / 620);
export const roadHeading = z => Math.atan(32 / 270 * Math.cos(z / 270) + 15 / 620 * Math.cos(z / 620));
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const angleDifference = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const toward = (value, target, amount) => value + Math.sign(target - value) * Math.min(Math.abs(target - value), amount);

export function createDrive() {
  return { x: 2.8, z: 0, heading: roadHeading(0), speed: 0, steering: 0, distance: 0, energy: 100, elapsed: 0, assist: true, boosting: false, offRoad: false, flying: false, vapor: false, altitude: 0, verticalSpeed: 0 };
}

export function resetCar(drive) {
  drive.x = roadCenter(drive.z) + 2.8;
  drive.heading = roadHeading(drive.z);
  drive.speed = 0;
  drive.steering = 0;
  drive.flying = false;
  drive.vapor = false;
  drive.altitude = 0;
  drive.verticalSpeed = 0;
}

export function stepDrive(drive, input, dt) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, .05);
  const targetAltitude = drive.flying ? 2.5 : 0;
  drive.verticalSpeed += ((targetAltitude - drive.altitude) * 8 - drive.verticalSpeed * 5) * dt;
  drive.altitude = clamp(drive.altitude + drive.verticalSpeed * dt, 0, 3.2);
  if (drive.altitude === 0 && drive.verticalSpeed < 0) drive.verticalSpeed = 0;
  drive.offRoad = Math.abs(drive.x - roadCenter(drive.z)) > 7.7;
  const grounded = drive.altitude < .75;
  drive.boosting = !!(input.throttle && !input.brake && drive.energy > 2 && input.boost);
  if (input.brake) {
    drive.speed = drive.speed > .5 ? Math.max(0, drive.speed - 28 * dt) : toward(drive.speed, -10, 6 * dt);
  } else if (input.throttle) {
    drive.speed = toward(drive.speed, drive.offRoad && grounded ? 19 : drive.boosting ? 83 : 66, (drive.boosting ? 13 : 8.5) * dt);
  } else {
    drive.speed = toward(drive.speed, 0, (1 + Math.abs(drive.speed) * .025) * dt);
  }
  if (drive.offRoad && grounded && Math.abs(drive.speed) > 19) drive.speed = toward(drive.speed, 0, (10 + Math.abs(drive.speed) * .12) * dt);
  drive.energy = clamp(drive.energy + (drive.boosting ? -23 : 11) * dt, 0, 100);
  const turn = Number(!!input.left) - Number(!!input.right);
  drive.steering += (turn - drive.steering) * Math.min(1, dt * 7);
  drive.heading += drive.steering * clamp(Math.abs(drive.speed) * .036, 0, 1.12) * Math.sign(drive.speed) * dt;
  if (drive.assist && !turn && !drive.offRoad && drive.speed > 2 && Math.abs(angleDifference(roadHeading(drive.z), drive.heading)) < 1.2) {
    const lookAhead = 22 + drive.speed * .25;
    const lane = clamp(drive.x - roadCenter(drive.z), -3.8, 3.8);
    const targetX = roadCenter(drive.z - lookAhead) + lane;
    const targetHeading = -Math.atan2(targetX - drive.x, lookAhead);
    drive.heading += angleDifference(targetHeading, drive.heading) * dt * 1.8;
  }
  drive.heading = Math.atan2(Math.sin(drive.heading), Math.cos(drive.heading));
  drive.x -= Math.sin(drive.heading) * drive.speed * dt;
  drive.z -= Math.cos(drive.heading) * drive.speed * dt;
  drive.distance += Math.abs(drive.speed) * dt;
  drive.elapsed += dt;
}
