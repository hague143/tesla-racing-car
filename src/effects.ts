import * as THREE from 'three';
import { smokeTexture } from './textures.js';
export class Effects {
  private count = 180;
  private cursor = 0;
  private buffer = new Float32Array(this.count * 3);
  private alpha = new Float32Array(this.count);
  private particles = Array.from({ length: this.count }, () => ({ x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, max: 1 }));
  private geo = new THREE.BufferGeometry();
  private sprite = smokeTexture();
  private mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { sprite: { value: this.sprite } },
    vertexShader: 'attribute float alpha;varying float a;void main(){a=alpha;vec4 p=modelViewMatrix*vec4(position,1.);gl_PointSize=clamp(20.*(28./-p.z),1.,55.);gl_Position=projectionMatrix*p;}',
    fragmentShader: 'uniform sampler2D sprite;varying float a;void main(){gl_FragColor=vec4(1.,.35,.12,texture2D(sprite,gl_PointCoord).a*a);\n#include <colorspace_fragment>\n}',
  });
  private points = new THREE.Points(this.geo, this.mat);
  constructor(scene: THREE.Scene) {
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.buffer, 3));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1));
    this.points.frustumCulled = false; scene.add(this.points);
  }
  burst(x: number, y: number, count = 24) {
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.cursor++ % this.count];
      Object.assign(p, { x, y, z: 0, vx: (Math.random() - .5) * 9, vy: Math.random() * 5, vz: Math.random() * 10, life: .45 + Math.random() * .35 }); p.max = p.life;
    }
  }
  update(dt: number, speed: number, x: number, y: number, boost: boolean) {
    if (boost) this.burst(x + (Math.random() > .5 ? .7 : -.7), y + .4, 2);
    for (let i = 0; i < this.count; i++) {
      const p = this.particles[i]; p.life = Math.max(0, p.life - dt);
      if (p.life > 0) {
        p.x += p.vx * dt; p.y = Math.max(.05, p.y + p.vy * dt); p.vy -= dt * 9; p.z += (p.vz + speed) * dt;
        this.buffer[i * 3] = p.x; this.buffer[i * 3 + 1] = p.y; this.buffer[i * 3 + 2] = p.z;
      }
      this.alpha[i] = p.life / p.max;
    }
    this.geo.attributes.position.needsUpdate = true; this.geo.attributes.alpha.needsUpdate = true;
  }
  clear() { this.particles.forEach(p => p.life = 0); this.alpha.fill(0); this.geo.attributes.alpha.needsUpdate = true; }
  dispose() { this.points.removeFromParent(); this.geo.dispose(); this.mat.dispose(); this.sprite.dispose(); }
}
