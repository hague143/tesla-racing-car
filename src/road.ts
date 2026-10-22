import * as THREE from 'three';
import { noiseTexture, foliageTexture, seeded, lightTexture } from './textures.js';

const LENGTH = 96, COUNT = 10;
export class Road {
  root = new THREE.Group();
  private sections: THREE.Group[] = [];
  private offset = 0;
  private allocations: (THREE.Material | THREE.BufferGeometry | THREE.Texture)[] = [];
  constructor(scene: THREE.Scene) {
    scene.add(this.root);
    const random = seeded(4261), dummy = new THREE.Object3D();
    const asphalt = noiseTexture(); asphalt.repeat.set(6, 36);
    const grass = noiseTexture('grass'); grass.repeat.set(45, 12);
    const foliage = foliageTexture(), glow = lightTexture();
    const materials = {
      asphalt: new THREE.MeshStandardMaterial({ map: asphalt, color: '#414956', roughness: .52, metalness: .18 }),
      ground: new THREE.MeshStandardMaterial({ map: grass, color: '#0d181a', roughness: 1 }),
      line: new THREE.MeshBasicMaterial({ color: '#d1d4d6' }),
      shoulder: new THREE.MeshStandardMaterial({ color: '#3c444e', roughness: .8 }),
      rail: new THREE.MeshStandardMaterial({ color: '#7d899a', metalness: .72, roughness: .4 }),
      dark: new THREE.MeshStandardMaterial({ color: '#24303e', metalness: .65, roughness: .4 }),
      amber: new THREE.MeshBasicMaterial({ color: '#ffb16b' }),
      red: new THREE.MeshBasicMaterial({ color: '#fb4a3d' }),
      tree: new THREE.MeshStandardMaterial({ map: foliage, alphaTest: .34, side: THREE.DoubleSide, color: '#8da2a2', roughness: 1 }),
      bark: new THREE.MeshStandardMaterial({ color: '#252c30', roughness: 1 }),
      glow: new THREE.MeshBasicMaterial({ map: glow, transparent: true, opacity: .14, color: '#f5b279', depthWrite: false, blending: THREE.AdditiveBlending }),
    };
    const geos = {
      road: new THREE.PlaneGeometry(14.4, LENGTH), ground: new THREE.PlaneGeometry(420, LENGTH),
      shoulder: new THREE.PlaneGeometry(1.3, LENGTH), edge: new THREE.PlaneGeometry(.12, LENGTH),
      dash: new THREE.PlaneGeometry(.12, 4), rail: new THREE.BoxGeometry(.16, .38, LENGTH),
      post: new THREE.BoxGeometry(.14, .9, .14), marker: new THREE.BoxGeometry(.18, .09, .14),
      pine: new THREE.PlaneGeometry(7, 16), trunk: new THREE.CylinderGeometry(.12, .26, 5, 6),
      pole: new THREE.CylinderGeometry(.07, .12, 9.5, 8), arm: new THREE.BoxGeometry(3.8, .09, .13),
      lens: new THREE.BoxGeometry(.95, .1, .4), pool: new THREE.PlaneGeometry(20, 32),
    };
    this.allocations.push(...Object.values(geos), ...Object.values(materials), asphalt, grass, foliage, glow);
    for (let section = 0; section < COUNT; section++) {
      const group = new THREE.Group(); this.root.add(group); this.sections.push(group);
      const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z = 0, flat = false) => {
        const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); if (flat) m.rotation.x = -Math.PI / 2;
        m.receiveShadow = true; group.add(m); return m;
      };
      mesh(geos.ground, materials.ground, 0, -.08, 0, true);
      mesh(geos.road, materials.asphalt, 0, 0, 0, true);
      for (const side of [-1, 1]) {
        mesh(geos.shoulder, materials.shoulder, side * 7.85, -.01, 0, true);
        mesh(geos.edge, materials.line, side * 7, .018, 0, true);
        mesh(geos.rail, materials.rail, side * 8.65, .7);
      }
      const dashes = new THREE.InstancedMesh(geos.dash, materials.line, 36);
      let index = 0;
      for (const x of [-3.5, 0, 3.5]) for (let z = -44; z < 48; z += 8) {
        dummy.position.set(x, .02, z); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix(); dashes.setMatrixAt(index++, dummy.matrix);
      }
      group.add(dashes);
      const posts = new THREE.InstancedMesh(geos.post, materials.dark, 24);
      const markers = new THREE.InstancedMesh(geos.marker, materials.amber, 24);
      index = 0;
      for (const side of [-1, 1]) for (let z = -44; z < 48; z += 8) {
        dummy.rotation.set(0, 0, 0); dummy.position.set(side * 8.65, .4, z); dummy.updateMatrix(); posts.setMatrixAt(index, dummy.matrix);
        dummy.position.y = .93; dummy.updateMatrix(); markers.setMatrixAt(index++, dummy.matrix);
      }
      group.add(posts, markers);
      const pines = new THREE.InstancedMesh(geos.pine, materials.tree, 48);
      const trunks = new THREE.InstancedMesh(geos.trunk, materials.bark, 24);
      for (let i = 0; i < 24; i++) {
        const side = i % 2 ? -1 : 1, size = .65 + random() * .9;
        const x = side * (13 + random() * 64), z = -48 + random() * 96;
        dummy.scale.setScalar(size); dummy.rotation.set(0, random() * Math.PI, 0); dummy.position.set(x, size * 2.5, z); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
        dummy.position.y = size * 8; dummy.updateMatrix(); pines.setMatrixAt(i * 2, dummy.matrix);
        dummy.rotation.y += Math.PI / 2; dummy.updateMatrix(); pines.setMatrixAt(i * 2 + 1, dummy.matrix);
      }
      group.add(trunks, pines);
      for (const side of [-1, 1]) {
        const z = side * 24;
        mesh(geos.pole, materials.dark, side * 10, 4.75, z);
        mesh(geos.arm, materials.dark, side * 8.15, 9.46, z);
        mesh(geos.lens, materials.amber, side * 6.65, 9.37, z);
        mesh(geos.pool, materials.glow, side * 2, .035, z, true);
      }
    }
    this.update(0);
  }
  update(distance: number) {
    this.offset = distance % LENGTH;
    this.sections.forEach((group, i) => { group.position.z = 120 - i * LENGTH + this.offset; });
  }
  setQuality(low: boolean) { this.sections.forEach((s, i) => { s.visible = !low || i < 7; }); }
  dispose() {
    this.root.traverse(o => { if (o instanceof THREE.InstancedMesh) o.dispose(); });
    this.allocations.forEach(r => r.dispose()); this.root.removeFromParent();
  }
}
