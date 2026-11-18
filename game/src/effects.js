// SOLMAR HEAT — effects.js
// One job: juice — pooled particle bursts (crash sparks, exhaust puffs,
// muzzle flashes), a mission beacon, and the objective marker in the world.
// No per-frame allocation: one pool of small meshes, reused.

import * as THREE from 'three';

const POOL = 240;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.parts = [];
    const geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    for (let i = 0; i < POOL; i++) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
      m.visible = false;
      scene.add(m);
      this.parts.push({ mesh: m, life: 0, vx: 0, vy: 0, vz: 0, grav: 0 });
    }
    this._next = 0;
    // Mission beacon: a glowing column + a pulsing ring on the ground.
    this.beacon = new THREE.Group();
    const col = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 0.9, 30, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xf7c948, transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }),
    );
    col.position.y = 15;
    this.beacon.add(col);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 3.0, 24),
      new THREE.MeshBasicMaterial({ color: 0xf7c948, transparent: true, opacity: 0.8, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.15;
    this.beacon.add(ring);
    this.beacon.visible = false;
    scene.add(this.beacon);
    this._ring = ring;
  }

  _spawn(x, y, z, color, speed, life, grav) {
    const p = this.parts[this._next];
    this._next = (this._next + 1) % POOL;
    p.mesh.visible = true;
    p.mesh.position.set(x, y, z);
    p.mesh.material.color.setHex(color);
    const a = Math.random() * Math.PI * 2;
    const up = Math.random() * 0.6 + 0.4;
    p.vx = Math.cos(a) * speed;
    p.vz = Math.sin(a) * speed;
    p.vy = up * speed;
    p.life = life;
    p.grav = grav;
  }

  burst(x, y, z, color, n, speed) {
    for (let i = 0; i < n; i++) this._spawn(x, y, z, color, speed * (0.5 + Math.random() * 0.8), 0.5 + Math.random() * 0.5, 9);
  }

  exhaust(x, y, z) {
    this._spawn(x, y, z, 0x9a9a9a, 0.8, 0.7, -1.5);
  }

  muzzle(x, y, z) {
    this.burst(x, y, z, 0xffd76e, 6, 3);
  }

  crash(x, y, z) {
    this.burst(x, y, z, 0xff8a3c, 18, 6);
    this.burst(x, y, z, 0xffffff, 8, 4);
  }

  setBeacon(x, z, on) {
    this.beacon.visible = !!on;
    if (on) this.beacon.position.set(x, 0, z);
  }

  update(dt) {
    for (const p of this.parts) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.mesh.visible = false;
        continue;
      }
      p.vy -= p.grav * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.mesh.position.y < 0.1) {
        p.mesh.position.y = 0.1;
        p.vy = 0;
      }
      const s = Math.max(0.2, p.life);
      p.mesh.scale.setScalar(s);
    }
    if (this.beacon.visible) {
      const t = performance.now() / 400;
      this._ring.scale.setScalar(1 + Math.sin(t) * 0.15);
      this.beacon.rotation.y += dt * 0.8;
    }
  }
}
