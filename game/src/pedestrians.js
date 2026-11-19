// SOLMAR HEAT — pedestrians: sidewalk walkers who flee from danger and can
// be knocked down. Knocking one down is a crime, so it feeds the wanted level.
import * as THREE from 'three';
import { CFG } from './config.js';

const SHIRTS = [0xc23b2e, 0x2e6fc2, 0xe8c832, 0x3aa84f, 0xe8e8e8, 0x7a4fb0, 0xc26a1e, 0xdddddd];
const PANTS = [0x222226, 0x3a4a6a, 0x5a4a3a, 0x2a2a2a];

export class PedManager {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.peds = [];
    this.onKnockedDown = null;
  }

  spawn(n) {
    for (let i = 0; i < n; i++) {
      const p = this.city.randomRoadPoint();
      const g = new THREE.Group();
      const shirt = new THREE.MeshLambertMaterial({ color: this.rng.pick(SHIRTS) });
      const pants = new THREE.MeshLambertMaterial({ color: this.rng.pick(PANTS) });
      const skin = new THREE.MeshLambertMaterial({ color: 0xd8a070 });
      const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.3), pants);
      legs.position.y = 0.4;
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.7, 0.34), shirt);
      body.position.y = 1.15;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), skin);
      head.position.y = 1.68;
      g.add(legs);
      g.add(body);
      g.add(head);
      g.position.set(p.x, 0, p.z);
      g.castShadow = true;
      this.scene.add(g);
      this.peds.push({
        group: g, x: p.x, z: p.z,
        heading: this.rng.range(0, Math.PI * 2),
        speed: this.rng.range(1.2, 2.2),
        state: 'walk', downTimer: 0, walkTimer: this.rng.range(2, 6),
        target: this.city.randomRoadPoint(),
      });
    }
  }

  nearest(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const p of this.peds) {
      if (p.state === 'down') continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  knockDown(ped) {
    if (ped.state === 'down') return;
    ped.state = 'down';
    ped.downTimer = 6;
    ped.group.rotation.x = -Math.PI / 2;
    ped.group.position.y = 0.35;
    if (this.onKnockedDown) this.onKnockedDown(ped);
  }

  fleeFrom(x, z, radius) {
    for (const p of this.peds) {
      if (p.state !== 'walk') continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < radius) {
        p.state = 'flee';
        p.fleeX = x;
        p.fleeZ = z;
        p.walkTimer = 3;
      }
    }
  }

  update(dt) {
    for (const p of this.peds) {
      if (p.state === 'down') {
        p.downTimer -= dt;
        if (p.downTimer <= 0) {
          p.state = 'walk';
          p.group.rotation.x = 0;
          p.group.position.y = 0;
          p.target = this.city.randomRoadPoint();
        }
        continue;
      }
      let tx;
      let tz;
      let speed = p.speed;
      if (p.state === 'flee') {
        const dx = p.x - p.fleeX;
        const dz = p.z - p.fleeZ;
        const d = Math.hypot(dx, dz) || 1;
        tx = p.x + (dx / d) * 10;
        tz = p.z + (dz / d) * 10;
        speed = 4.5;
        p.walkTimer -= dt;
        if (p.walkTimer <= 0) {
          p.state = 'walk';
          p.target = this.city.randomRoadPoint();
        }
      } else {
        tx = p.target.x;
        tz = p.target.z;
        p.walkTimer -= dt;
        if (Math.hypot(tx - p.x, tz - p.z) < 2 || p.walkTimer <= 0) {
          p.target = this.city.randomRoadPoint();
          p.walkTimer = this.rng.range(3, 8);
        }
      }
      const dx = tx - p.x;
      const dz = tz - p.z;
      const want = Math.atan2(dx, dz);
      let diff = want - p.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      p.heading += Math.max(-3 * dt, Math.min(3 * dt, diff));
      p.x += Math.sin(p.heading) * speed * dt;
      p.z += Math.cos(p.heading) * speed * dt;
      const fixed = this.city.resolveCollision(p.x, p.z, 0.5);
      p.x = fixed.x;
      p.z = fixed.z;
      p.x = Math.max(-CFG.half - 6, Math.min(CFG.half + 24, p.x));
      p.z = Math.max(-CFG.half - 6, Math.min(CFG.half + 30, p.z));
      p.group.position.set(p.x, 0, p.z);
      p.group.rotation.y = p.heading;
      // Simple walk bob.
      p.group.position.y = Math.abs(Math.sin(performance.now() * 0.006 + p.x)) * 0.05;
    }
  }
}
