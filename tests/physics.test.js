import test from 'node:test';
import assert from 'node:assert/strict';
import {createDrive,stepDrive,resetCar,roadCenter} from '../src/physics.js';
const run=(drive,input,seconds)=>{for(let i=0;i<seconds*60;i++)stepDrive(drive,input,1/60);};

test('accelerates along a winding road with steering assist and records distance',()=>{
  const drive=createDrive();run(drive,{throttle:true},30);
  assert(drive.distance>900);assert(drive.z<-850);
  assert(Math.abs(drive.x-roadCenter(drive.z))<7);
  assert(drive.speed>50&&drive.speed<=66);
});
test('braking slows forward motion and holding the brake engages reverse',()=>{
  const drive=createDrive();run(drive,{throttle:true},4);const forwardSpeed=drive.speed;
  run(drive,{brake:true},.5);assert(drive.speed<forwardSpeed);
  run(drive,{brake:true},4);assert(drive.speed<0&&drive.speed>=-10);
  const z=drive.z;run(drive,{brake:true},1);assert(drive.z>z);
});
test('steering changes the heading in both directions without locking to the road',()=>{
  const left=createDrive(),right=createDrive();left.assist=right.assist=false;
  left.speed=right.speed=20;
  run(left,{throttle:true,left:true},1);run(right,{throttle:true,right:true},1);
  assert(left.x<right.x-10);assert(left.heading>right.heading);
});
test('boost consumes and recharges a bounded power reserve',()=>{
  const drive=createDrive();run(drive,{throttle:true,boost:true},3);
  assert(drive.energy<40&&drive.energy>=0);assert(drive.speed>30);
  run(drive,{},3);assert(drive.energy>40&&drive.energy<=100);
});
test('reset returns an off-road car safely without deleting its trip',()=>{
  const drive=createDrive();drive.x=100;drive.z=-700;drive.speed=50;drive.distance=900;
  run(drive,{throttle:true},1);assert(drive.offRoad&&drive.speed<50);
  resetCar(drive);assert(Math.abs(drive.x-roadCenter(drive.z)-2.8)<1e-8);
  assert.equal(drive.speed,0);assert(drive.distance>=900);
});
test('invalid and stalled frame timings cannot teleport the car',()=>{
  const drive=createDrive();drive.speed=60;stepDrive(drive,{},NaN);stepDrive(drive,{},-1);
  assert.equal(drive.distance,0);stepDrive(drive,{},50);assert(drive.distance<=3);
  for(const value of Object.values(drive))if(typeof value==='number')assert(Number.isFinite(value));
});

test('flight lifts the car smoothly, holds altitude and lands without passing below the road',()=>{
  const drive=createDrive();drive.flying=true;drive.vapor=true;
  run(drive,{throttle:true},1);assert(drive.altitude>.5&&drive.altitude<2.5);
  run(drive,{throttle:true},5);assert(Math.abs(drive.altitude-2.5)<.05);assert(drive.distance>100);
  drive.flying=false;run(drive,{},5);assert(drive.altitude<.01&&drive.altitude>=0);
});
test('reset safely grounds a flying car and disables its lift and vapor jets',()=>{
  const drive=createDrive();drive.flying=true;drive.vapor=true;run(drive,{},2);
  assert(drive.altitude>2);resetCar(drive);
  assert.equal(drive.altitude,0);assert.equal(drive.verticalSpeed,0);assert.equal(drive.flying,false);assert.equal(drive.vapor,false);
});
