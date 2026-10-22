import test from 'node:test';
import assert from 'node:assert/strict';
import {drivingSoundMix,createCarAudio} from '../src/audio.js';
const createDrive=()=>({speed:0,x:0,z:0,heading:0,altitude:0,steering:0,energy:100});

test('acceleration and speed raise motor pitch, rolling noise and wind',()=>{
  const drive=createDrive(),idle=drivingSoundMix(drive);
  const accelerating=drivingSoundMix(drive,{throttle:true});
  drive.speed=50;const fast=drivingSoundMix(drive,{throttle:true});
  assert(accelerating.motor>idle.motor);assert(accelerating.motorPitch>idle.motorPitch);
  assert(fast.motorPitch>accelerating.motorPitch);assert(fast.wind>idle.wind);assert(fast.road>idle.road);
});
test('braking produces tire sounds on the ground, while hovering removes road contact',()=>{
  const drive={...createDrive(),speed:40,steering:.9};
  const braking=drivingSoundMix(drive,{brake:true}),coasting=drivingSoundMix({...drive,steering:0});
  assert(braking.brake>0&&braking.skid>0);assert.equal(coasting.brake,0);
  drive.altitude=2.5;const airborne=drivingSoundMix(drive,{brake:true});
  assert.equal(airborne.road,0);assert.equal(airborne.brake,0);assert.equal(airborne.skid,0);
});
test('horn, vapor, boost and reverse each respond to their own conditions',()=>{
  const drive=createDrive();assert.equal(drivingSoundMix(drive).horn,0);
  assert(drivingSoundMix(drive,{horn:true}).horn>0);
  drive.vapor=true;assert(drivingSoundMix(drive).vapor>0);
  drive.flying=true;drive.altitude=2.5;assert(drivingSoundMix(drive).turbine>0);
  drive.boosting=true;assert(drivingSoundMix(drive).boost>0);
  drive.speed=-5;assert.equal(drivingSoundMix(drive).reverse,0);
  drive.altitude=0;assert(drivingSoundMix(drive).reverse>0);
});
test('nearby traffic gets louder as it approaches and pans to its side',()=>{
  const drive=createDrive(),far=drivingSoundMix(drive,{},[{x:0,z:-100,speed:20,direction:1}]);
  const left=drivingSoundMix(drive,{},[{x:-5,z:-4,speed:20,direction:1}]);
  const right=drivingSoundMix(drive,{},[{x:8,z:-4,speed:20,direction:1}]);
  assert(left.traffic>far.traffic);assert(left.trafficPan<0);assert(right.trafficPan>0);
  for(const value of Object.values(left))assert(Number.isFinite(value));
  drive.heading=Math.PI;assert(drivingSoundMix(drive,{},[{x:-5,z:-4,speed:20,direction:1}]).trafficPan>0);
});
test('audio settings do not initialize sound before a user gesture and clamp volume',()=>{
  const audio=createCarAudio();assert.equal(audio.snapshot().initialized,false);
  audio.setVolume(5);assert.equal(audio.snapshot().volume,1);
  audio.setVolume(-2);assert.equal(audio.snapshot().volume,0);
  audio.setVolume(NaN);assert.equal(audio.snapshot().volume,0);
  audio.setMuted(true);assert.equal(audio.snapshot().muted,true);
  assert.equal(audio.snapshot().initialized,false);
});
