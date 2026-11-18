// Particles and impact feedback: dust puffs when drifting, sparks on a hard
// hit, a muzzle flash, and the objective beacon — a tall golden pillar of
// light over the current mission marker so the player can always find it.

import * as THREE from 'three';

const MAX_PARTICLES = 400;

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.beacon = null;
    this._geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    this._mats = {
      dust: new THREE.MeshBasicMaterial({ color: 0xd8c8a8 }),
      spark: new THREE.MeshBasicMaterial({ color: 0xffd24a }),
      smoke: new THREE.MeshBasicMaterial({ color: 0x666666, transparent: true, opacity: 0.5 }),
      flash: new THREE.MeshBasicMaterial({ color: 0xfff2a0 }),
    };
  }

  spawn(x, y, z, kind, count, spread = 1, up = 1) {
    for (let i = 0; i < count; i++) {
      if (this.particles.length >= MAX_PARTICLES) return;
      const mesh = new THREE.Mesh(this._geo, this._mats[kind] || this._mats.dust);
      mesh.position.set(x, y, z);
      this.scene.add(mesh);
      this.particles.push({
        mesh,
        vx: (Math.random() * 2 - 1) * spread,
        vy: Math.random() * up,
        vz: (Math.random() * 2 - 1) * spread,
        life: 0.5 + Math.random() * 0.5,
        maxLife: 1,
      });
    }
  }

  dust(x, z) {
    this.spawn(x, 0.3, z, 'dust', 3, 1.5, 0.8);
  }

  sparks(x, z) {
    this.spawn(x, 0.8, z, 'spark', 10, 3, 2.5);
  }

  muzzle(x, y, z) {
    this.spawn(x, y, z, 'flash', 4, 0.8, 0.8);
  }

  smoke(x, z) {
    this.spawn(x, 1.2, z, 'smoke', 2, 0.8, 1.2);
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        this.particles.splice(i, 1);
        continue;
      }
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy -= 1.5 * dt;
      const s = p.life / p.maxLife;
      p.mesh.scale.setScalar(Math.max(0.1, s));
    }
    if (this.beacon) {
      this.beacon.rotation.y += dt * 1.5;
      this.beacon.material.opacity = 0.35 + Math.sin(Date.now() * 0.004) * 0.12;
    }
  }

  /** Move the golden beacon over (x, z), or hide it when null. */
  setBeacon(x, z) {
    if (x == null) {
      if (this.beacon) this.beacon.visible = false;
      return;
    }
    if (!this.beacon) {
      const geo = new THREE.CylinderGeometry(1.4, 1.4, 60, 12, 1, true);
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffc837, transparent: true, opacity: 0.4, side: THREE.DoubleSide, depthWrite: false,
      });
      this.beacon = new THREE.Mesh(geo, mat);
      this.scene.add(this.beacon);
    }
    this.beacon.position.set(x, 30, z);
    this.beacon.visible = true;
  }
}
