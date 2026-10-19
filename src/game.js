import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createVehicle } from './vehicles.js';
import {noiseTexture,foliageTexture,environmentTexture,lightTexture,moonTexture} from './textures.js';
import {createVapor} from './effects.js';
import { createDrive, resetCar, stepDrive, roadCenter, roadHeading, clamp } from './physics.js';

const $ = id => document.getElementById(id);
const canvas = $('world');
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (error) {
  $('error').hidden = false;
  throw error;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#05090f', 75, 330);
scene.environment = environmentTexture();
scene.environmentIntensity = .38;
const camera = new THREE.PerspectiveCamera(58, 1, .1, 1500);
const hemi = new THREE.HemisphereLight('#7186aa', '#111815', .9);
scene.add(hemi);
const sun = new THREE.DirectionalLight('#a9c3ee', 1.8);
sun.position.set(-60, 85, -35);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -25, right: 25, top: 25, bottom: -25, near: 1, far: 180 });
sun.shadow.normalBias = .05;
scene.add(sun, sun.target);
const materials = {
  grass: new THREE.MeshStandardMaterial({ color: '#1c2c20', map:noiseTexture('grass'), roughness: 1 }),
  shoulder: new THREE.MeshStandardMaterial({ color: '#3b3d3e', map:noiseTexture(),roughness: .98 }),
  road: new THREE.MeshStandardMaterial({ color: '#454b52', map:noiseTexture(), bumpMap:noiseTexture(),bumpScale:.024,roughness:.34,metalness:.12 }),
  line: new THREE.MeshBasicMaterial({ color: '#e4dfc9' }),
  bark: new THREE.MeshStandardMaterial({ color: '#403a2e',roughness:1 }),
  pine: new THREE.MeshStandardMaterial({map:foliageTexture(),alphaTest:.36,side:THREE.DoubleSide,roughness:1}),
  rock: new THREE.MeshLambertMaterial({ color: '#8c9287', flatShading: true }),
  mountain: new THREE.MeshStandardMaterial({ color: '#18222d',roughness:1 }),
  rail: new THREE.MeshStandardMaterial({ color: '#a8aeaa', roughness: .7 }),
};
const sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 24, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  uniforms: { top: { value: new THREE.Color('#010207') }, bottom: { value: new THREE.Color('#0a111e') } },
  vertexShader: 'varying vec3 vDirection; void main(){ vDirection = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
  fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vDirection;
    void main(){
      float h=normalize(vDirection).y;
      gl_FragColor=vec4(mix(bottom,top,smoothstep(-.08,.85,h)),1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
}));
scene.add(sky);
const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(10, 32, 24), new THREE.MeshBasicMaterial({ map:moonTexture(),color:'#cbdaf0',fog:false }));
scene.add(sunDisc);

const starPositions=[];
const starRandom=(()=>{let n=987;return()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};})();
for(let i=0;i<950;i++){const azimuth=starRandom()*Math.PI*2,elevation=.08+starRandom()*1.4;starPositions.push(Math.cos(azimuth)*Math.cos(elevation)*900,Math.sin(elevation)*900,Math.sin(azimuth)*Math.cos(elevation)*900);}
const starGeometry=new THREE.BufferGeometry();starGeometry.setAttribute('position',new THREE.Float32BufferAttribute(starPositions,3));
const stars=new THREE.Points(starGeometry,new THREE.PointsMaterial({color:'#afc4e8',size:1.1,sizeAttenuation:false,transparent:true,opacity:.6,fog:false,depthWrite:false}));scene.add(stars);
const lampLights=Array.from({length:2},()=>{const light=new THREE.SpotLight('#ffe4b5',340,32,.9,.7,1.5);scene.add(light,light.target);return light;});
const trafficLight=new THREE.SpotLight('#deebff',145,65,.43,.6,1.5);scene.add(trafficLight,trafficLight.target);
const lampMaterial=new THREE.MeshStandardMaterial({color:'#303943',metalness:.75,roughness:.4});
const lampLens=new THREE.MeshBasicMaterial({color:'#ffe6bb'});
const lightPoolMaterial=new THREE.MeshBasicMaterial({map:lightTexture(),color:'#b4becc',transparent:true,opacity:.22,depthWrite:false,blending:THREE.AdditiveBlending});
function mountainGeometry(radius,height,random) {
  const positions=[],indices=[],sides=32,rings=9;
  for(let j=0;j<=rings;j++)for(let i=0;i<sides;i++){
    const angle=i/sides*Math.PI*2,t=j/rings;
    const r=radius*(1-t)*(.8+random()*.3);
    positions.push(Math.cos(angle)*r,height*(t-.35)+Math.sin(angle*3+t*10)*height*.06*(1-t),Math.sin(angle)*r);
    if(j<rings){const a=j*sides+i,b=j*sides+(i+1)%sides,c=(j+1)*sides+i,d=(j+1)*sides+(i+1)%sides;indices.push(a,c,b,b,c,d);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
function mesh(geometry, material, parent, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  parent.add(object);
  return object;
}
function box(parent, w, h, l, material, x, y, z) {
  return mesh(new THREE.BoxGeometry(w, h, l), material, parent, x, y, z);
}

const tesla=createVehicle({player:true});scene.add(tesla);
const vapor=createVapor(scene);
const traffic=[];
for(let i=0;i<7;i++) {
  const model=createVehicle({color:['#697886','#c6c5bc','#343b42','#4e232a'][i%4],variant:i%3});
  scene.add(model);traffic.push({model,z:-75-i*66,direction:i%3===0?1:-1,speed:18+i*1.1});
}

const CHUNK_LENGTH=168;
const chunks=new Map();
const sharedGeometries={
  trunk:new THREE.CylinderGeometry(.13,.26,5,10),
  pine:new THREE.PlaneGeometry(6.6,14),
  rock:new THREE.IcosahedronGeometry(1,0),
  post:new THREE.BoxGeometry(.13,.8,.13),
  reflector:new THREE.BoxGeometry(.16,.12,.15),
};
for(const geometry of Object.values(sharedGeometries))geometry.userData.shared=true;
const transform=new THREE.Object3D();
function randomFor(seed) {
  let n=seed|0;
  return ()=>{n+=0x6D2B79F5;let t=Math.imul(n^n>>>15,1|n);t^=t+Math.imul(t^t>>>7,61|t);return((t^t>>>14)>>>0)/4294967296;};
}
function strip(parent,z1,z2,offset,width,material,y=.01) {
  const positions=[],indices=[],uvs=[];
  const steps=Math.max(1,Math.ceil((z2-z1)/6));
  for(let i=0;i<=steps;i++) {
    const z=z1+(z2-z1)*i/steps,angle=roadHeading(z);
    for(const edge of [-1,1]) {
      const across=offset+width/2*edge;
      const x=roadCenter(z)+Math.cos(angle)*across;
      positions.push(x,y,z-Math.sin(angle)*across);uvs.push(x/3,z/3);
    }
    if(i<steps){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
  const object=mesh(geometry,material,parent);object.receiveShadow=true;
  return object;
}
function buildChunk(index) {
  const group=new THREE.Group();
  const z1=index*CHUNK_LENGTH,z2=z1+CHUNK_LENGTH;
  const random=randomFor(index*12983+7814);
  const ground=mesh(new THREE.PlaneGeometry(2400,CHUNK_LENGTH),materials.grass,group,0,-.04,(z1+z2)/2);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;const guv=ground.geometry.attributes.uv;for(let i=0;i<guv.count;i++){guv.setXY(i,guv.getX(i)*400,guv.getY(i)*28);}
  strip(group,z1,z2,0,17,materials.shoulder,0);
  strip(group,z1,z2,0,14.4,materials.road,.018);
  for(const offset of [-6.8,6.8])strip(group,z1,z2,offset,.11,materials.line,.025);
  const dashes = [];
  for(let z=z1;z<z2;z+=12) dashes.push(strip(group,z,z+5,0,.14,materials.line,.027));
  mesh(mergeGeometries(dashes.map(object => object.geometry)), materials.line, group);
  dashes.forEach(object => { group.remove(object); object.geometry.dispose(); });
  const colliders=[];
  const count=48;
  const trunks=new THREE.InstancedMesh(sharedGeometries.trunk,materials.bark,count);
  const pines=new THREE.InstancedMesh(sharedGeometries.pine,materials.pine,count);
  const tops=new THREE.InstancedMesh(sharedGeometries.pine,materials.pine,count);
  for(let i=0;i<count;i++) {
    const z=z1+random()*CHUNK_LENGTH;
    const side=i%2?1:-1;
    const x=roadCenter(z)+side*(16+random()*135);
    const size=.65+random()*1.4;
    transform.position.set(x,2.5*size,z);transform.scale.setScalar(size);transform.rotation.set(0,random()*6,0);transform.updateMatrix();trunks.setMatrixAt(i,transform.matrix);
    transform.position.y=7*size;transform.updateMatrix();pines.setMatrixAt(i,transform.matrix);
    transform.rotation.y+=Math.PI/2;transform.updateMatrix();tops.setMatrixAt(i,transform.matrix);
    colliders.push({x,z,radius:.5*size,height:14*size});
  }
  group.add(trunks,pines,tops);
  const rocks=new THREE.InstancedMesh(sharedGeometries.rock,materials.rock,12);
  for(let i=0;i<12;i++) {
    const z=z1+random()*CHUNK_LENGTH,x=roadCenter(z)+(i%2?1:-1)*(12+random()*80),size=.5+random()*2.6;
    transform.position.set(x,size*.35,z);transform.scale.set(size*1.3,size*.7,size);transform.rotation.set(random(),random()*6,random());transform.updateMatrix();rocks.setMatrixAt(i,transform.matrix);colliders.push({x,z,radius:size,height:size*1.4});
  }
  group.add(rocks);
  for(let i=0;i<4;i++) {
    const z=z1+random()*CHUNK_LENGTH,x=roadCenter(z)+(i%2?1:-1)*(190+random()*150),height=55+random()*125;
    const mountain=mesh(mountainGeometry(75+random()*100,height,random),materials.mountain,group,x,height*.37-10,z);
    mountain.rotation.y=random()*6;mountain.scale.z=.7+random()*.7;
  }
  // Instanced reflective markers keep the scenery inexpensive to draw.
  const posts = new THREE.InstancedMesh(sharedGeometries.post, materials.rail, 12);
  const reflectors = new THREE.InstancedMesh(sharedGeometries.reflector, materials.line, 12);
  let marker = 0;
  for(let z=z1;z<z2;z+=28) for(const side of [-1,1]) {
    const angle=roadHeading(z),x=roadCenter(z)+Math.cos(angle)*9*side;
    transform.rotation.set(0,angle,0);transform.scale.setScalar(1);
    transform.position.set(x,.4,z-Math.sin(angle)*9*side);transform.updateMatrix();posts.setMatrixAt(marker,transform.matrix);
    transform.position.y=.72;transform.updateMatrix();reflectors.setMatrixAt(marker,transform.matrix);marker++;
  }
  group.add(posts,reflectors);
  for(let z=z1;z<z2;z+=56){
    const side=Math.floor(z/56)%2?1:-1,cx=roadCenter(z);
    const pole=mesh(new THREE.CylinderGeometry(.07,.11,8.7,10),lampMaterial,group,cx+side*10,4.35,z);
    box(group,3.4,.11,.12,lampMaterial,cx+side*8.4,8.6,z);
    box(group,.75,.12,.45,lampLens,cx+side*6.8,8.48,z);
    const pool=mesh(new THREE.PlaneGeometry(20,27),lightPoolMaterial,group,cx,.042,z);pool.rotation.x=-Math.PI/2;
  }
  group.userData.colliders=colliders;
  chunks.set(index,group);scene.add(group);
}
function streamWorld() {
  const center=Math.floor(drive.z/CHUNK_LENGTH);
  for(let i=center-3;i<=center+3;i++)if(!chunks.has(i))buildChunk(i);
  for(const [index,group]of chunks)if(Math.abs(index-center)>3) {
    scene.remove(group);group.traverse(object=>{if(object.geometry&&!object.geometry.userData.shared)object.geometry.dispose();if(object.isInstancedMesh)object.dispose();});chunks.delete(index);
  }
}

let drive=createDrive();
let state='menu';
let mode='chase';
const night=true;
let headlights=true;
let cooldown=0;
let noticeTimer=0;
let bestDistance=0;
const keys=new Set();
let lastTime=null;
let hudTime=0;
try{const saved=Number(localStorage.getItem('teslaOpenRoadBest'));if(Number.isFinite(saved)&&saved>0)bestDistance=saved;}catch{}
function saveBest() {
  if(drive.distance>bestDistance){bestDistance=drive.distance;try{localStorage.setItem('teslaOpenRoadBest',String(bestDistance));}catch{}}
}
function notify(text) {$('notice').textContent=text;noticeTimer=3;}
function updateHUD() {
  $('distance').textContent=(drive.distance/1000).toFixed(2);
  $('speed').textContent=Math.round(Math.abs(drive.speed)*3.6);
  $('gear').textContent=state==='menu'?'P':drive.speed<-.1?'R':drive.speed>.1?'D':'N';
  $('energy-label').textContent=`${Math.round(drive.energy)}%`;
  $('energy-fill').style.width=`${drive.energy}%`;
  $('speed-arc').style.strokeDashoffset=100-clamp(Math.abs(drive.speed)*3.6/300,0,1)*100;
  $('road-status').textContent=drive.altitude>1?'FLIGHT MODE · ABOVE THE HIGHWAY':drive.offRoad?'OFF ROAD · EASY ON THE THROTTLE':drive.boosting?'MAXIMUM POWER · ALL ELECTRIC':'FOREST HIGHWAY · ENDLESS EXPLORATION';
  $('vapor').disabled=$('flight').disabled=state!=='running';
  $('vapor').setAttribute('aria-pressed',String(drive.vapor));
  $('flight').setAttribute('aria-pressed',String(drive.flying));
  $('vapor-label').textContent=drive.vapor?'ON':'OFF';
  $('flight-label').textContent=drive.flying?'FLYING':drive.altitude>.2?'LANDING':'GROUNDED';
  $('altitude').textContent=drive.altitude.toFixed(1);
  document.body.classList.toggle('is-flying',drive.flying);
  $('best').textContent=`BEST DRIVE ${(Math.max(bestDistance,drive.distance)/1000).toFixed(2)} KM`;
}
const targetCamera=new THREE.Vector3(),targetLook=new THREE.Vector3(),lookAt=new THREE.Vector3();
function updateCamera(dt,snap=false) {
  const forward=new THREE.Vector3(-Math.sin(drive.heading),0,-Math.cos(drive.heading));
  const pos=new THREE.Vector3(drive.x,drive.altitude,drive.z);
  if(state==='menu') {
    targetCamera.copy(pos).add(new THREE.Vector3(7,3.4,8));
    targetLook.copy(pos).add(new THREE.Vector3(-3,1,-5));
  }else if(mode==='hood') {
    targetCamera.copy(pos).addScaledVector(forward,1.05);targetCamera.y=drive.altitude+1.37;
    targetLook.copy(pos).addScaledVector(forward,40);targetLook.y=drive.altitude+1.4;
  }else {
    targetCamera.copy(pos).addScaledVector(forward,-(8.5+Math.abs(drive.speed)*.035));targetCamera.y=drive.altitude+4.2;
    targetLook.copy(pos).addScaledVector(forward,8);targetLook.y=drive.altitude+1.15;
  }
  const t=snap?1:1-Math.exp(-dt*(mode==='hood'?18:5));
  camera.position.lerp(targetCamera,t);lookAt.lerp(targetLook,t);camera.lookAt(lookAt);
  const fov=mode==='hood'?68:58+(drive.boosting?8:0);
  camera.fov+= (fov-camera.fov)*Math.min(1,dt*3);camera.updateProjectionMatrix();
  sky.position.copy(camera.position);
  stars.position.copy(camera.position);
  sunDisc.position.copy(camera.position).add(new THREE.Vector3(-250,220,-650));
  sun.position.set(drive.x-60,85,drive.z-35);sun.target.position.set(drive.x,0,drive.z);
}
function positionCars(dt) {
  tesla.position.set(drive.x,.02+drive.altitude,drive.z);tesla.rotation.y=drive.heading;
  tesla.rotation.z=-drive.steering*Math.min(Math.abs(drive.speed)/100,drive.flying?.08:.035);
  tesla.rotation.x=drive.flying?.025+Math.sin(drive.elapsed*2)*.008:0;
  for(const wheel of tesla.userData.wheels)wheel.userData.spin.rotation.x-=drive.speed*dt/.43;
  for(const beam of tesla.userData.jetBeams){const length=Math.max(.35,drive.altitude+.3);beam.visible=drive.vapor||drive.altitude>.15;beam.scale.y=length;beam.position.y=.22-length/2;}
  for(const wheel of tesla.userData.wheels)if(wheel.position.z<0)wheel.rotation.y=drive.steering*.25;
  tesla.userData.taillight.color.set(keys.has('ArrowDown')||keys.has('KeyS')?'#ff6878':'#ff1831');
  for(const car of traffic) {
    if(state==='running')car.z+=car.direction*car.speed*dt;
    if(Math.abs(car.z-drive.z)>340)car.z=drive.z-220-Math.random()*100;
    const heading=roadHeading(car.z)+(car.direction===1?Math.PI:0);
    const lane=car.direction===1?-3.2:3.2;
    car.model.position.set(roadCenter(car.z)+lane,0,car.z);car.model.rotation.y=heading;
    if(state==='running'&&drive.altitude<1.35&&cooldown<=0&&Math.hypot(drive.x-car.model.position.x,drive.z-car.z)<3.6) {
      drive.speed*=.15;drive.x+=drive.x<car.model.position.x?-1.3:1.3;cooldown=2;notify('Easy there. Give traffic a little room.');
    }
  }
  tesla.updateMatrixWorld(true);
  for(let i=0;i<lampLights.length;i++){
    const z=(Math.round(drive.z/56)-i)*56,side=Math.floor(z/56)%2?1:-1;
    lampLights[i].position.set(roadCenter(z)+side*6.8,8.4,z);lampLights[i].target.position.set(roadCenter(z),0,z);
  }
  const closest=traffic.filter(car=>car.direction===1&&Math.abs(car.z-drive.z)<100).sort((a,b)=>Math.abs(a.z-drive.z)-Math.abs(b.z-drive.z))[0];
  trafficLight.intensity=closest?145:0;
  if(closest){trafficLight.position.set(closest.model.position.x,.8,closest.z+2.2);trafficLight.target.position.set(roadCenter(closest.z+35)-3.2,0,closest.z+35);}

}
function update(dt) {
  if(state!=='running')return;
  stepDrive(drive,{
    throttle:keys.has('KeyW')||keys.has('ArrowUp'),brake:keys.has('KeyS')||keys.has('ArrowDown'),
    left:keys.has('KeyA')||keys.has('ArrowLeft'),right:keys.has('KeyD')||keys.has('ArrowRight'),boost:keys.has('Space'),
  },dt);
  cooldown=Math.max(0,cooldown-dt);
  if(drive.offRoad&&cooldown<=0) {
    const center=Math.floor(drive.z/CHUNK_LENGTH);
    for(let i=center-1;i<=center+1;i++)for(const obstacle of chunks.get(i)?.userData.colliders||[]) {
      const dx=drive.x-obstacle.x,dz=drive.z-obstacle.z,distance=Math.hypot(dx,dz);
      if(distance<obstacle.radius+1&&drive.altitude<obstacle.height) {
        const length=distance||1;drive.x+=dx/length*.7;drive.z+=dz/length*.7;drive.speed*=-.1;cooldown=2;notify('Press R to return to the road.');break;
      }
    }
  }
  if(Math.abs(drive.x-roadCenter(drive.z))>700){resetCar(drive);notify('Back on the scenic route.');}
  positionCars(dt);
  vapor.update(dt,tesla,drive,drive.vapor||drive.altitude>.15);
  streamWorld();
  noticeTimer-=dt;if(noticeTimer<=0)$('notice').textContent='';
  hudTime+=dt;if(hudTime>.08){updateHUD();hudTime=0;}
}
function startDrive() {
  saveBest();
  const assist=drive.assist;drive=createDrive();drive.assist=assist;
  traffic.forEach((car,i)=>car.z=-75-i*66);
  state='running';cooldown=0;keys.clear();vapor.clear();$('garage').hidden=true;
  $('menu').hidden=true;$('pause-menu').hidden=true;$('controls').hidden=false;$('touch-controls').hidden=false;
  $('pause').disabled=false;$('pause').setAttribute('aria-label','Pause game');
  document.body.classList.add('is-driving');
  $('start').blur();
  streamWorld();positionCars(0);updateCamera(0,true);updateHUD();notify('W to drive · F to fly / land · G for vapor jets');
}
function pauseDrive() {
  if(state==='running') {
    state='paused';keys.clear();saveBest();$('pause-menu').hidden=false;$('controls').hidden=true;$('touch-controls').hidden=true;
    $('pause').setAttribute('aria-label','Resume game');updateHUD();
  }else if(state==='paused') {
    state='running';$('pause-menu').hidden=true;$('controls').hidden=false;$('touch-controls').hidden=false;
    $('pause').setAttribute('aria-label','Pause game');$('resume').blur();updateHUD();
  }
}
function toggleLighting() {
  headlights=!headlights;
  $('lighting-label').textContent=headlights?'HEADLIGHTS ON':'HEADLIGHTS OFF';
  $('lighting').setAttribute('aria-pressed',String(headlights));
  tesla.traverse(object=>{if(object.isSpotLight)object.intensity=headlights?185:0;});
}
function toggleFlight() {
  if(state!=='running')return;
  drive.flying=!drive.flying;if(drive.flying)drive.vapor=true;
  notify(drive.flying?'Lift jets engaged. Flying above the highway.':'Landing. The vapor jets remain available with G.');updateHUD();
}
function toggleVapor() {
  if(state!=='running')return;
  drive.vapor=!drive.vapor;
  if(!drive.vapor)drive.flying=false;
  notify(drive.vapor?'Vapor jets on. Press F to take flight.':'Vapor jets off. Returning to the road.');updateHUD();
}
function toggleCamera() {
  mode=mode==='chase'?'hood':'chase';$('camera-label').textContent=mode==='chase'?'CHASE CAM':'HOOD CAM';
  if(state!=='menu')updateCamera(0,true);
}
function toggleAssist() {
  drive.assist=!drive.assist;$('assist').setAttribute('aria-pressed',String(drive.assist));$('assist').querySelector('span').textContent=drive.assist?'ON':'OFF';
  if(state==='running')notify(drive.assist?'Steering assist on. Follow the curve.':'Steering assist off. You have full control.');
}
$('flight').addEventListener('click',toggleFlight);$('vapor').addEventListener('click',toggleVapor);
$('start').addEventListener('click',startDrive);$('resume').addEventListener('click',pauseDrive);$('pause').addEventListener('click',pauseDrive);
$('new-drive').addEventListener('click',startDrive);$('lighting').addEventListener('click',toggleLighting);$('camera').addEventListener('click',toggleCamera);$('assist').addEventListener('click',toggleAssist);
const controlled=['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyA','KeyS','KeyD'];
window.addEventListener('keydown',event=>{
  if(event.ctrlKey||event.metaKey||event.altKey)return;
  if(controlled.includes(event.code)) {
    if((event.code==='Space')&&document.activeElement?.tagName==='BUTTON'&&state!=='running')return;
    event.preventDefault();
    if(state==='running')keys.add(event.code);
  }
  if(event.repeat)return;
  if(event.code==='KeyP'||event.code==='Escape')pauseDrive();
  if(event.code==='KeyF')toggleFlight();
  if(event.code==='KeyG')toggleVapor();
  if(event.code==='KeyC')toggleCamera();
  if(event.code==='KeyH')toggleAssist();
  if(event.code==='KeyR'&&state==='running'){resetCar(drive);positionCars(0);updateCamera(0,true);notify('Back on the road.');updateHUD();}
});
window.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',()=>{keys.clear();if(state==='running')pauseDrive();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='running')pauseDrive();});
window.addEventListener('pagehide',saveBest);
for(const[id,code]of [['left','ArrowLeft'],['right','ArrowRight'],['throttle','ArrowUp'],['brake','ArrowDown'],['boost','Space']]) {
  const button=$(id);
  button.addEventListener('pointerdown',event=>{event.preventDefault();button.setPointerCapture(event.pointerId);if(state==='running')keys.add(code);});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>keys.delete(code));
}
function resize() {
  const width=window.innerWidth,height=window.innerHeight;
  renderer.setSize(width,height,false);camera.aspect=width/height;camera.updateProjectionMatrix();
}
window.addEventListener('resize',resize);
streamWorld();positionCars(0);updateCamera(0,true);updateHUD();resize();
// A development-only hook enables deterministic physics and streaming checks without waiting for real-time GPU rendering.
if(new URLSearchParams(location.search).has('debug'))window.__drive={
  get data(){return drive;},get state(){return state;},get chunks(){return chunks.size;},get particles(){return vapor.activeCount;},get vehicle(){return tesla;},get renderer(){return renderer;},get traffic(){return traffic;},get camera(){return mode;},get night(){return night;},
  step:update,start:startDrive,keys,reset:()=>{resetCar(drive);positionCars(0);updateCamera(0,true);},
};
function frame(time) {
  const dt=lastTime===null?0:Math.min((time-lastTime)/1000,.2);lastTime=time;
  let remaining=dt;
  while(remaining>0){const step=Math.min(remaining,1/60);update(step);remaining-=step;}
  if(state!=='paused')updateCamera(dt);
  renderer.render(scene,camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
