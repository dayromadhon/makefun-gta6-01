// SOLMAR HEAT — peds.js
// One job: pedestrians. They walk the sidewalks, flee from a speeding car or
// a gunshot, and can be knocked down (they stay down a while, then get up).
// A ped is a small capsule with a coloured shirt.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { range, pick, streetPoint } from './random.js';

const SHIRTS = [0xd84a4a, 0x4a7ad8, 0x7ab648, 0xe8b13c, 0x9a6ad8, 0xe8e8e8, 0x5a9a8a, 0xd88a4a];

export class PedManager {
  constructor(scene, rng, city, fxLow) {
    this.scene = scene;
    this.rng = rng;
    this.city = city;
    this.fxLow = fxLow;
    this.peds = []; // {mesh, x, z, heading, speed, state: 'walk'|'flee'|'down', downT, target}
    this.lines = CONFIG.streetLines;
  }

  spawnAll() {
    const n = this.fxLow ? CONFIG.pedCountLow : CONFIG.pedCount;
    for (let i = 0; i < n; i++) this.spawnPed();
  }

  _makeMesh() {
    const g = new THREE.Group();
    const shirt = new THREE.MeshLambertMaterial({ color: pick(this.rng, SHIRTS) });
    const skin = new THREE.MeshLambertMaterial({ color: pick(this.rng, [0xe8b98a, 0xc98a5a, 0x8a5a3a, 0xf0c8a0]) });
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.3), new THREE.MeshLambertMaterial({ color: 0x2a2f38 }));
    legs.position.y = 0.35;
    g.add(legs);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.36), shirt);
    torso.position.y = 1.05;
    torso.castShadow = true;
    g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 8, 6), skin);
    head.position.y = 1.66;
    g.add(head);
    return g;
  }

  spawnPed() {
    // On a sidewalk: just off a street line.
    const p = streetPoint(this.rng, this.lines, CONFIG.cityHalf - 8);
    const alongX = Math.abs(p.z - this._nearestLine(p.z)) < 0.01;
    const off = 7.8;
    const x = alongX ? p.x : p.x + (this.rng() < 0.5 ? off : -off);
    const z = alongX ? p.z + (this.rng() < 0.5 ? off : -off) : p.z;
    const mesh = this._makeMesh();
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const ped = {
      mesh, x, z,
      heading: this.rng() * Math.PI * 2,
      speed: range(this.rng, 1.2, 2.2),
      state: 'walk',
      downT: 0,
      wanderT: range(this.rng, 2, 6),
    };
    this.peds.push(ped);
    return ped;
  }

  _nearestLine(v) {
    let best = this.lines[0];
    for (const l of this.lines) if (Math.abs(l - v) < Math.abs(best - v)) best = l;
    return best;
  }

  // A scare (car close and fast, or a gunshot): nearby peds flee.
  scare(x, z, radius) {
    for (const ped of this.peds) {
      if (ped.state === 'down') continue;
      const dx = ped.x - x;
      const dz = ped.z - z;
      const d = Math.hypot(dx, dz);
      if (d < radius) {
        ped.state = 'flee';
        ped.heading = Math.atan2(dx, dz);
        ped.speed = range(this.rng, 4, 6);
        ped.wanderT = range(this.rng, 1.5, 3);
      }
    }
  }

  // Knock one down (car hit or a punch). Returns true when a ped went down.
  knockDownAt(x, z, radius) {
    for (const ped of this.peds) {
      if (ped.state === 'down') continue;
      const dx = ped.x - x;
      const dz = ped.z - z;
      if (dx * dx + dz * dz < radius * radius) {
        ped.state = 'down';
        ped.downT = range(this.rng, 4, 8);
        ped.mesh.rotation.x = Math.PI / 2;
        ped.mesh.position.y = 0.3;
        return true;
      }
    }
    return false;
  }

  // The nearest ped within radius of (x,z), for punching.
  nearest(x, z, radius) {
    let best = null;
    let bestD = radius;
    for (const ped of this.peds) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < bestD) {
        bestD = d;
        best = ped;
      }
    }
    return best;
  }

  update(dt) {
    for (const ped of this.peds) {
      if (ped.state === 'down') {
        ped.downT -= dt;
        if (ped.downT <= 0) {
          ped.state = 'walk';
          ped.mesh.rotation.x = 0;
          ped.mesh.position.y = 0;
          ped.speed = range(this.rng, 1.2, 2.2);
        }
        continue;
      }
      ped.wanderT -= dt;
      if (ped.wanderT <= 0) {
        ped.wanderT = range(this.rng, 2, 6);
        if (ped.state === 'flee') {
          ped.state = 'walk';
          ped.speed = range(this.rng, 1.2, 2.2);
        }
        ped.heading += range(this.rng, -1.2, 1.2);
      }
      const nx = ped.x + Math.sin(ped.heading) * ped.speed * dt;
      const nz = ped.z + Math.cos(ped.heading) * ped.speed * dt;
      // Stay on the sidewalks: keep inside the city and out of buildings.
      if (Math.abs(nx) < CONFIG.cityHalf && Math.abs(nz) < CONFIG.cityHalf && !this.city.colliders.find((c) => nx > c.minX - 0.5 && nx < c.maxX + 0.5 && nz > c.minZ - 0.5 && nz < c.maxZ + 0.5)) {
        ped.x = nx;
        ped.z = nz;
      } else {
        ped.heading += Math.PI / 2;
      }
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
      // Little walking bob.
      if (ped.state === 'walk' || ped.state === 'flee') {
        ped.mesh.position.y = Math.abs(Math.sin(performance.now() / 160 + ped.x)) * 0.06;
      }
    }
  }
}
