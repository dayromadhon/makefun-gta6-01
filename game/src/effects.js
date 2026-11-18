// SOLMAR HEAT — particles and screen feedback. A single Points pool is
// reused for dust, sparks, smoke and muzzle flashes so nothing allocates
// per frame.

import * as THREE from 'three';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.max = 400;
    this.positions = new Float32Array(this.max * 3);
    this.colors = new Float32Array(this.max * 3);
    this.vel = new Float32Array(this.max * 3);
    this.life = new Float32Array(this.max);
    this.maxLife = new Float32Array(this.max);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.mat = new THREE.PointsMaterial({
      size: 0.55,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.scene.add(this.points);
    this.cursor = 0;
    this._color = new THREE.Color();
  }
  burst(x, y, z, count, colorHex, speed = 6, up = 3, life = 0.7) {
    this._color.setHex(colorHex);
    for (let i = 0; i < count; i++) {
      const idx = this.cursor;
      this.cursor = (this.cursor + 1) % this.max;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.4 + Math.random() * 0.6);
      this.positions[idx * 3] = x;
      this.positions[idx * 3 + 1] = y;
      this.positions[idx * 3 + 2] = z;
      this.vel[idx * 3] = Math.cos(a) * s;
      this.vel[idx * 3 + 1] = up * (0.5 + Math.random());
      this.vel[idx * 3 + 2] = Math.sin(a) * s;
      this.colors[idx * 3] = this._color.r;
      this.colors[idx * 3 + 1] = this._color.g;
      this.colors[idx * 3 + 2] = this._color.b;
      this.life[idx] = life * (0.6 + Math.random() * 0.4);
      this.maxLife[idx] = this.life[idx];
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
  dust(x, z) {
    this.burst(x, 0.4, z, 3, 0xb09a7a, 2, 1.2, 0.5);
  }
  sparks(x, z) {
    this.burst(x, 1, z, 14, 0xffd21f, 9, 4, 0.5);
  }
  smoke(x, z) {
    this.burst(x, 1.2, z, 8, 0x555a60, 2, 3, 1.1);
  }
  muzzle(x, y, z, heading) {
    this.burst(x + Math.cos(heading) * 1.2, y, z + Math.sin(heading) * 1.2, 6, 0xffe9a8, 7, 1, 0.25);
  }
  update(dt) {
    let any = false;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      any = true;
      this.life[i] -= dt;
      this.positions[i * 3] += this.vel[i * 3] * dt;
      this.positions[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.positions[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.vel[i * 3 + 1] -= 6 * dt;
      if (this.positions[i * 3 + 1] < 0.1) {
        this.positions[i * 3 + 1] = 0.1;
        this.vel[i * 3 + 1] = 0;
      }
      if (this.life[i] <= 0) {
        this.positions[i * 3 + 1] = -100; // hide
      }
    }
    if (any) this.geo.attributes.position.needsUpdate = true;
  }
}
