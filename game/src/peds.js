// Pedestrians: they stroll the sidewalks, flee from a speeding car or a gunshot,
// and can be knocked down (which is a crime — the wanted system notices).
// A ped is a capsule body + a head sphere, in a bright shirt colour.

import * as THREE from 'three';
import { WORLD } from './config.js';
import { clamp, dist2d, Rng } from './random.js';

const SHIRTS = [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0x1abc9c, 0xe67e22, 0xecf0f1, 0x34495e, 0xfd79a8];

function makePedMesh(color) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.35, 0.9, 4, 8),
    new THREE.MeshLambertMaterial({ color }),
  );
  body.position.y = 1.0;
  group.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xe8b88a }),
  );
  head.position.y = 1.85;
  group.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.5, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x2c3e50 }),
  );
  legs.position.y = 0.25;
  group.add(legs);
  return group;
}

export class Ped {
  constructor(x, z, color) {
    this.mesh = makePedMesh(color);
    this.mesh.position.set(x, 0, z);
    this.x = x;
    this.z = z;
    this.heading = Math.random() * Math.PI * 2;
    this.speed = 1.2;
    this.state = 'walk'; // walk | flee | down
    this.downTimer = 0;
    this.fleeTimer = 0;
    this.targetX = x;
    this.targetZ = z;
    this._pickTarget();
  }

  _pickTarget() {
    // A random nearby sidewalk point.
    const street = WORLD.streets[Math.floor(Math.random() * WORLD.streets.length)];
    const along = Math.random() * 240 - 120;
    const side = Math.random() < 0.5 ? 1 : -1;
    if (Math.random() < 0.5) {
      this.targetX = along;
      this.targetZ = street + side * (6 + 2);
    } else {
      this.targetX = street + side * (6 + 2);
      this.targetZ = along;
    }
  }

  update(dt, playerPos, playerSpeed, gunshotAt) {
    if (this.state === 'down') {
      this.downTimer -= dt;
      this.mesh.rotation.x = Math.max(-Math.PI / 2, this.mesh.rotation.x - dt * 3);
      if (this.downTimer <= 0) {
        this.state = 'walk';
        this.mesh.rotation.x = 0;
        this.mesh.position.y = 0;
      }
      return;
    }
    // Flee from a fast car, the player, or a gunshot.
    const dPlayer = playerPos ? dist2d(this.x, this.z, playerPos.x, playerPos.z) : 999;
    const dShot = gunshotAt ? dist2d(this.x, this.z, gunshotAt.x, gunshotAt.z) : 999;
    if ((dPlayer < 8 && playerSpeed > 8) || dShot < 20) {
      this.state = 'flee';
      this.fleeTimer = 2.5;
    }
    if (this.state === 'flee') {
      this.fleeTimer -= dt;
      const awayX = this.x - (playerPos ? playerPos.x : this.x);
      const awayZ = this.z - (playerPos ? playerPos.z : this.z);
      const len = Math.sqrt(awayX * awayX + awayZ * awayZ) || 1;
      this.heading = Math.atan2(awayX / len, awayZ / len);
      this.speed = 4.5;
      if (this.fleeTimer <= 0) this.state = 'walk';
    } else {
      this.speed = 1.2;
      const dx = this.targetX - this.x;
      const dz = this.targetZ - this.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < 1.5) {
        this._pickTarget();
      } else {
        this.heading = Math.atan2(dx, dz);
      }
    }
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;
    this.x = clamp(this.x, -135, 200);
    this.z = clamp(this.z, -135, 200);
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    // Little walk bob.
    this.mesh.position.y = Math.abs(Math.sin(Date.now() * 0.006 + this.x)) * 0.05;
  }

  knockDown() {
    if (this.state === 'down') return false;
    this.state = 'down';
    this.downTimer = 4;
    return true;
  }

  get down() {
    return this.state === 'down';
  }
}

export class PedManager {
  constructor(scene, seed = 1) {
    this.scene = scene;
    this.rng = new Rng(seed);
    this.peds = [];
    for (let i = 0; i < 26; i++) {
      const x = this.rng.range(-120, 120);
      const z = this.rng.range(-120, 120);
      const ped = new Ped(x, z, this.rng.pick(SHIRTS));
      this.scene.add(ped.mesh);
      this.peds.push(ped);
    }
  }

  update(dt, playerPos, playerSpeed, gunshotAt) {
    for (const p of this.peds) p.update(dt, playerPos, playerSpeed, gunshotAt);
  }

  /** The nearest ped within range of a point (any state). */
  nearest(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const p of this.peds) {
      const d = dist2d(x, z, p.x, p.z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }
}
