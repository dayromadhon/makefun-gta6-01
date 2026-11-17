// Solmar Heat — particles and impact feedback. One job: short-lived
// puffs and sparks (drift smoke, collisions, gunfire) plus a helper the
// camera rig reads for screen shake.
import { range } from './random.js';

const MAX = 260;

export class Effects {
  constructor(scene, fxLow) {
    this.scene = scene;
    this.fxLow = fxLow;
    this.positions = new Float32Array(MAX * 3);
    this.colors = new Float32Array(MAX * 3);
    this.life = new Float32Array(MAX);
    this.vel = new Float32Array(MAX * 3);
    this.head = 0;
    for (let i = 0; i < MAX; i++) {
      this.positions[i * 3 + 1] = -100;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.55,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  spawn(x, y, z, r, g, b, count, spread, up) {
    if (this.fxLow && count > 4) count = 4;
    for (let n = 0; n < count; n++) {
      const i = this.head;
      this.head = (this.head + 1) % MAX;
      this.positions[i * 3] = x + range(Math.random, -0.4, 0.4);
      this.positions[i * 3 + 1] = y + range(Math.random, 0, 0.5);
      this.positions[i * 3 + 2] = z + range(Math.random, -0.4, 0.4);
      this.colors[i * 3] = r;
      this.colors[i * 3 + 1] = g;
      this.colors[i * 3 + 2] = b;
      this.vel[i * 3] = range(Math.random, -spread, spread);
      this.vel[i * 3 + 1] = range(Math.random, up * 0.4, up);
      this.vel[i * 3 + 2] = range(Math.random, -spread, spread);
      this.life[i] = range(Math.random, 0.4, 0.9);
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  smoke(x, z) {
    this.spawn(x, 0.4, z, 0.55, 0.55, 0.55, 3, 0.8, 1.2);
  }

  sparks(x, z) {
    this.spawn(x, 1.0, z, 1.0, 0.8, 0.2, 10, 3.5, 2.5);
  }

  blood(x, z) {
    this.spawn(x, 1.0, z, 0.7, 0.05, 0.05, 8, 1.5, 1.5);
  }

  muzzle(x, z) {
    this.spawn(x, 1.2, z, 1.0, 0.9, 0.4, 6, 2.5, 1.0);
  }

  update(dt) {
    let any = false;
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.positions[i * 3 + 1] = -100;
        continue;
      }
      this.positions[i * 3] += this.vel[i * 3] * dt;
      this.positions[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3 + 1] -= 2.5 * dt;
    }
    if (any) this.points.geometry.attributes.position.needsUpdate = true;
  }
}
