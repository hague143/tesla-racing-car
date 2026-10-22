import * as THREE from 'three';
import { createVehicle } from './vehicles.js';
import { environmentTexture, moonTexture, seeded } from './textures.js';
import { Road } from './road';
import { Effects } from './effects';
import { LANES } from './config';
import type { Run, Settings, GameState } from './types';

export class World {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(55, 1, .1, 1800);
  player = createVehicle({ player: true, color: '#c41e30' });
  private pivot = new THREE.Group();
  private road: Road;
  private effects: Effects;
  private traffic: THREE.Group[] = [];
  private pickups: THREE.Group[] = [];
  private sun = new THREE.DirectionalLight('#acc5f2', 2.6);
  private target = new THREE.Vector3();
  private cameraPos = new THREE.Vector3();
  private shake = 0;
  private wheel = 0;
  private settings: Settings;
  private width = 0;
  private height = 0;
  private cameraSnap = true;
  constructor(canvas: HTMLCanvasElement, settings: Settings) {
    // WebGL2 is required by the installed Three.js release. No simulated progress
    // can hide failure: the caller catches this and offers a real retry.
    const context = canvas.getContext('webgl2', { antialias: true, alpha: false, powerPreference: 'high-performance' });
    if (!context) throw new Error('WEBGL_UNSUPPORTED');
    this.renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true });
    this.settings = settings;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.18;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.background = new THREE.Color('#040710'); this.scene.fog = new THREE.Fog('#090f1b', 115, 560);
    this.scene.environment = environmentTexture(); this.scene.environmentIntensity = .85;
    this.scene.add(new THREE.HemisphereLight('#7794c0', '#151523', 1.5));
    this.sun.position.set(-30, 65, 15); this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024); Object.assign(this.sun.shadow.camera, { left: -20, right: 20, top: 25, bottom: -25, near: 1, far: 140 });
    this.sun.shadow.normalBias = .035; this.scene.add(this.sun, this.sun.target);
    const rim = new THREE.DirectionalLight('#ff7d50', 1.15); rim.position.set(20, 7, -25); this.scene.add(rim);
    const fill = new THREE.PointLight('#7aa4fc', 80, 30); fill.position.set(-7, 4, 7); this.scene.add(fill);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(16, 32, 24), new THREE.MeshBasicMaterial({ map: moonTexture(), color: '#b6c6de', fog: false }));
    moon.position.set(-165, 250, -850); this.scene.add(moon);
    const stars = new Float32Array(700 * 3), random = seeded(1977);
    for (let i = 0; i < 700; i++) { stars[i * 3] = (random() - .5) * 2200; stars[i * 3 + 1] = 100 + random() * 650; stars[i * 3 + 2] = -400 - random() * 600; }
    const starsGeo = new THREE.BufferGeometry(); starsGeo.setAttribute('position', new THREE.BufferAttribute(stars, 3));
    this.scene.add(new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: '#b6c7e6', size: 1.1, sizeAttenuation: false, transparent: true, opacity: .65, fog: false })));
    // A distant, original skyline; forest silhouettes frame the readable highway.
    const buildings = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshStandardMaterial({ color: '#182334', roughness: .9 }), 65);
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 65; i++) {
      const side = i % 2 ? 1 : -1, h = 15 + random() * 75;
      dummy.position.set(side * (70 + random() * 300), h / 2 - 10, -330 - random() * 240);
      dummy.scale.set(10 + random() * 24, h, 15 + random() * 20); dummy.updateMatrix(); buildings.setMatrixAt(i, dummy.matrix);
    }
    this.scene.add(buildings);
    this.road = new Road(this.scene); this.effects = new Effects(this.scene);
    this.pivot.add(this.player); this.scene.add(this.pivot);
    // Once-created render pools mirror the fixed simulation pools.
    const colors = ['#b7c4d2', '#235371', '#6a4848', '#515969', '#ad9e7d', '#345b55'];
    for (let i = 0; i < 36; i++) {
      const group = new THREE.Group();
      for (let variant = 0; variant < 3; variant++) {
        if (variant < 2) group.add(createVehicle({ color: colors[i % colors.length], variant }));
        else {
          const obstacle = new THREE.Group();
          const body = new THREE.Mesh(new THREE.BoxGeometry(2.5, .85, 1.1), new THREE.MeshStandardMaterial({ color: '#d76227', roughness: .65 })); body.position.y = .43; body.castShadow = true; obstacle.add(body);
          const stripeMat = new THREE.MeshBasicMaterial({ color: '#efdfb3' });
          for (const x of [-.85, 0, .85]) {
            const stripe = new THREE.Mesh(new THREE.BoxGeometry(.27, .5, 1.12), stripeMat); stripe.position.set(x, .5, 0); stripe.rotation.z = -.35; obstacle.add(stripe);
          }
          group.add(obstacle);
        }
      }
      group.visible = false; this.traffic.push(group); this.scene.add(group);
    }
    const itemGeo = new THREE.OctahedronGeometry(.46), ringGeo = new THREE.TorusGeometry(.73, .025, 8, 24);
    const itemMat = new THREE.MeshStandardMaterial({ color: '#ffbc63', emissive: '#ff741d', emissiveIntensity: 1.4, metalness: .5, roughness: .2 });
    for (let i = 0; i < 12; i++) {
      const g = new THREE.Group(); g.add(new THREE.Mesh(itemGeo, itemMat), new THREE.Mesh(ringGeo, itemMat));
      g.visible = false; this.scene.add(g); this.pickups.push(g);
    }
    this.applySettings(settings); this.resize();
  }
  applySettings(settings: Settings) {
    this.settings = settings; const low = settings.quality === 'low';
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, low ? 1 : settings.quality === 'high' ? 2 : 1.4));
    this.renderer.shadowMap.enabled = !low; this.sun.castShadow = !low;
    this.road.setQuality(low); this.resize();
  }
  resize() {
    this.width = innerWidth; this.height = innerHeight;
    this.renderer.setSize(this.width, this.height, false); this.camera.aspect = this.width / this.height; this.camera.updateProjectionMatrix();
    this.cameraSnap = true;
  }
  burst(kind: string, run: Run) {
    this.effects.burst(run.x, run.y + .5, kind === 'collision' ? 65 : 25);
    if (this.settings.shake && !this.settings.reducedMotion) this.shake = kind === 'collision' ? .22 : .065;
  }
  reset() { this.effects.clear(); this.shake = 0; this.wheel = 0; this.cameraSnap = true; }
  render(run: Run, state: GameState, dt: number, time: number) {
    const preview = state === 'MENU', frozen = state === 'PAUSED' || state === 'GAME_OVER';
    const distance = preview ? 0 : run.distance;
    this.road.update(distance);
    this.pivot.position.set(preview ? 2.4 : run.x, (preview ? 0 : run.y) + .7, 0);
    this.pivot.rotation.set(0, 0, preview ? 0 : run.roll);
    this.player.rotation.y = preview ? -.16 : THREE.MathUtils.clamp((run.x - run.prevX) * -3, -.28, .28);
    this.player.rotation.z = preview || this.settings.reducedMotion ? 0 : (run.prevX - run.x) * -.6;
    this.player.position.y = -.7 + (preview || frozen || this.settings.reducedMotion ? 0 : Math.sin(time * 16) * .006);
    if (!frozen && !preview) this.wheel += run.speed * dt / .4;
    for (const w of this.player.userData.wheels) w.userData.spin.rotation.x = this.wheel;
    for (const beam of this.player.userData.jetBeams) { beam.visible = !preview && (run.boosting || run.y > .2); beam.material.opacity = .3; }
    for (let i = 0; i < this.traffic.length; i++) {
      const obstacle = run.obstacles[i], group = this.traffic[i];
      group.visible = !preview && obstacle.active;
      if (group.visible) { group.position.set(obstacle.x, 0, obstacle.z); group.children.forEach((child, variant) => child.visible = variant === obstacle.variant); }
    }
    for (let i = 0; i < this.pickups.length; i++) {
      const p = run.pickupsPool[i], g = this.pickups[i]; g.visible = !preview && p.active;
      if (g.visible) { g.position.set(LANES[p.lane], 1.1 + (this.settings.reducedMotion ? 0 : Math.sin(time * 3 + i) * .16), p.z); g.rotation.y = time; }
    }
    if (!frozen && state === 'PLAYING') this.effects.update(dt, run.speed, run.x, run.y, run.boosting && this.settings.quality !== 'low');
    if (state === 'GAME_OVER') this.effects.update(dt, 0, run.x, run.y, false);
    if (preview) {
      const portrait = this.width < 700;
      this.cameraPos.set(portrait ? 10 : 9.6, portrait ? 5.5 : 3.6, portrait ? 15 : 10.4);
      this.target.set(portrait ? 1 : -3, portrait ? 3.2 : .8, -3.5);
    } else {
      const portrait = this.width < 700 && this.width < this.height;
      this.cameraPos.set(run.x * (portrait ? 1 : .42), (portrait ? 5.1 : 4.35) + run.y * .28, (portrait ? 13 : 10.6) + (run.boosting && !this.settings.reducedMotion ? 1 : 0));
      this.target.set(run.x * (portrait ? 1 : .8), .8 + run.y * .3, -24);
    }
    const smooth = this.cameraSnap || preview || this.settings.reducedMotion ? 1 : 1 - Math.exp(-Math.min(dt, .05) * (this.width < 700 ? 20 : 9));
    this.camera.position.lerp(this.cameraPos, smooth);
    if (!preview && this.width < 700 && this.width < this.height) {
      this.camera.position.x = THREE.MathUtils.clamp(this.camera.position.x, run.x - .45, run.x + .45);
    }
    this.cameraSnap = false;
    if (this.shake > 0 && state !== 'PAUSED') { this.camera.position.x += Math.sin(time * 90) * this.shake; this.shake *= Math.exp(-dt * 7); }
    this.camera.lookAt(this.target);
    const fov = preview ? (this.width < 700 ? 52 : 48) : run.boosting && !this.settings.reducedMotion ? 64 : 57;
    this.camera.fov += (fov - this.camera.fov) * Math.min(1, dt * 5); this.camera.updateProjectionMatrix();
    this.renderer.render(this.scene, this.camera);
  }
  dispose() {
    this.road.dispose(); this.effects.dispose();
    const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>();
    this.scene.traverse(o => {
      if (o instanceof THREE.Mesh || o instanceof THREE.Points) {
        resources.add(o.geometry);
        for (const m of Array.isArray(o.material) ? o.material : [o.material]) {
          resources.add(m); for (const value of Object.values(m)) if (value instanceof THREE.Texture) resources.add(value);
        }
      }
      if (o instanceof THREE.InstancedMesh) o.dispose();
    });
    if (this.scene.environment) resources.add(this.scene.environment);
    resources.forEach(r => r.dispose()); this.renderer.dispose(); this.scene.clear();
  }
}
