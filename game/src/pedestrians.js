// SOLMAR HEAT — pedestrians. They stroll the sidewalks, flee from a fast
// car or a gunshot, and can be knocked down (which raises the wanted level).

import * as THREE from 'three';
import { CFG } from './config.js';

const SHIRT_COLORS = [0xd94f3d, 0x3d7ad9, 0x2ea66a, 0xd9a62e, 0x7a4fc2, 0xe8e8e8, 0x2e2e2e, 0xe86a2e];
const SKIN_COLORS = [0xe8b98a, 0xc98a5a, 0x8a5a3a, 0xf2c9a0];

export function makePedMesh(rng) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({
    color: SHIRT_COLORS[Math.floor(rng.f() * SHIRT_COLORS.length)],
  });
  const skin = new THREE.MeshLambertMaterial({
    color: SKIN_COLORS[Math.floor(rng.f() * SKIN_COLORS.length)],
  });
  const pants = new THREE.MeshLambertMaterial({ color: 0x2e3a4a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.85, 0.35), shirt);
  body.position.y = 1.05;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), skin);
  head.position.y = 1.7;
  head.castShadow = true;
  g.add(head);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.22), pants);
  legL.position.set(0, 0.32, -0.14);
  g.add(legL);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.65, 0.22), pants);
  legR.position.set(0, 0.32, 0.14);
  g.add(legR);
  g.userData.legL = legL;
  g.userData.legR = legR;
  return g;
}

export class Pedestrians {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.peds = [];
    for (let i = 0; i < CFG.PED_COUNT; i++) {
      this.spawn();
    }
  }
  _randomSidewalkSpot() {
    // On a block edge (sidewalk), just off a road.
    const road = this.city.roads[Math.floor(this.rng.f() * this.city.roads.length)];
    const off = this.rng.chance(0.5) ? 8 : -8;
    const along = this.rng.range(-150, 150);
    if (road.axis === 'x') return { x: along, z: road.at + off };
    return { x: road.at + off, z: along };
  }
  spawn() {
    const spot = this._randomSidewalkSpot();
    const mesh = makePedMesh(this.rng);
    this.scene.add(mesh);
    const ped = {
      mesh,
      x: spot.x,
      z: spot.z,
      heading: this.rng.range(0, Math.PI * 2),
      speed: this.rng.range(1.2, 2.4),
      state: 'walk', // walk | flee | down
      downTimer: 0,
      walkPhase: this.rng.range(0, Math.PI * 2),
    };
    mesh.position.set(spot.x, 0, spot.z);
    this.peds.push(ped);
    return ped;
  }
  // A scare (car close and fast, or a gunshot) makes nearby peds flee.
  scare(x, z, radius = 14) {
    for (const p of this.peds) {
      if (p.state === 'down') continue;
      const dx = p.x - x;
      const dz = p.z - z;
      if (dx * dx + dz * dz < radius * radius) {
        p.state = 'flee';
        p.heading = Math.atan2(dz, dx);
        p.fleeTimer = 3;
      }
    }
  }
  // A car hitting a ped knocks them down. Returns the ped (or null).
  knockDown(x, z, radius = 2.2) {
    for (const p of this.peds) {
      if (p.state === 'down') continue;
      const dx = p.x - x;
      const dz = p.z - z;
      if (dx * dx + dz * dz < radius * radius) {
        p.state = 'down';
        p.downTimer = 6;
        p.mesh.rotation.x = Math.PI / 2;
        p.mesh.position.y = 0.3;
        return p;
      }
    }
    return null;
  }
  update(dt, playerPos, playerSpeed) {
    for (const p of this.peds) {
      if (p.state === 'down') {
        p.downTimer -= dt;
        if (p.downTimer <= 0) {
          p.state = 'walk';
          p.mesh.rotation.x = 0;
          p.mesh.position.y = 0;
          const spot = this._randomSidewalkSpot();
          p.x = spot.x;
          p.z = spot.z;
        }
        continue;
      }
      // A fast car nearby scares peds.
      if (playerPos && playerSpeed > 12) {
        const dx = p.x - playerPos.x;
        const dz = p.z - playerPos.z;
        if (dx * dx + dz * dz < 100) this.scare(playerPos.x, playerPos.z, 10);
      }
      let speed = p.speed;
      if (p.state === 'flee') {
        speed = 5.5;
        p.fleeTimer -= dt;
        if (p.fleeTimer <= 0) p.state = 'walk';
      }
      p.x += Math.cos(p.heading) * speed * dt;
      p.z += Math.sin(p.heading) * speed * dt;
      const cl = this.city.clampToPlayable(p.x, p.z);
      p.x = cl.x;
      p.z = cl.z;
      // At a block edge, turn onto a new heading along the sidewalk.
      if (Math.abs(p.x) >= 162 || Math.abs(p.z) >= 162 || this.rng.chance(0.002)) {
        p.heading = this.rng.range(0, Math.PI * 2);
      }
      const res = this.city.resolveCollisions(p.x, p.z, 0.5);
      p.x = res.x;
      p.z = res.z;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = -p.heading + Math.PI / 2;
      // Walk cycle: swing the legs.
      p.walkPhase += dt * speed * 3;
      const swing = Math.sin(p.walkPhase) * 0.4;
      p.mesh.userData.legL.rotation.x = swing;
      p.mesh.userData.legR.rotation.x = -swing;
    }
  }
}
