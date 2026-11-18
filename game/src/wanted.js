// SOLMAR HEAT — the wanted level. Crimes raise stars; police cars spawn
// and chase, ram and bust. Stay out of sight and the heat decays.

import * as THREE from 'three';
import { CFG } from './config.js';
import { makeCarMesh, Car } from './vehicles.js';

export class Wanted {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.level = 0;
    this.heat = 0; // 0..100 within the current level
    this.decayTimer = 0;
    this.police = [];
    this.bustTimer = 0;
    this.bustTarget = null;
  }
  addHeat(amount, reason) {
    this.heat += amount;
    this.decayTimer = CFG.WANTED_DECAY_SECONDS;
    while (this.heat >= 100 && this.level < CFG.WANTED_MAX) {
      this.heat -= 100;
      this.level += 1;
    }
    if (this.level >= CFG.WANTED_MAX) this.heat = Math.min(this.heat, 99);
    this._syncPolice();
  }
  setLevel(level) {
    this.level = Math.max(0, Math.min(CFG.WANTED_MAX, level));
    this.heat = 0;
    this.decayTimer = CFG.WANTED_DECAY_SECONDS;
    this._syncPolice();
  }
  clear() {
    this.level = 0;
    this.heat = 0;
    this._syncPolice();
  }
  // Police count scales with stars: 0, 1, 2, 3, 4, 5.
  _syncPolice() {
    const want = this.level === 0 ? 0 : this.level + 1;
    while (this.police.length < want) {
      this._spawnPolice();
    }
    while (this.police.length > want) {
      const p = this.police.pop();
      this.scene.remove(p.mesh);
    }
  }
  _spawnPolice() {
    const color = 0x1a1a1a;
    const mesh = makeCarMesh(color, 'police');
    // White doors: a thin white box over the body.
    const door = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.5, 2.02),
      new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }),
    );
    door.position.set(0, 0.65, 0);
    mesh.add(door);
    this.scene.add(mesh);
    const angle = this.rng.range(0, Math.PI * 2);
    const dist = this.rng.range(28, 45);
    const car = new Car(mesh, 0, 0, 0);
    car.kind = 'police';
    car.isPolice = true;
    this.police.push(car);
    car._spawnAngle = angle;
    car._spawnDist = dist;
    return car;
  }
  // Place fresh police near the player (called when the level rises).
  placeNear(playerPos) {
    for (const p of this.police) {
      if (p._placed) continue;
      const a = this.rng.range(0, Math.PI * 2);
      const d = this.rng.range(24, 40);
      p.x = playerPos.x + Math.cos(a) * d;
      p.z = playerPos.z + Math.sin(a) * d;
      const cl = this.city.clampToPlayable(p.x, p.z);
      const res = this.city.resolveCollisions(cl.x, cl.z, 1.6);
      p.x = res.x;
      p.z = res.z;
      p._placed = true;
    }
  }
  update(dt, player, onEvent) {
    // Decay when the player is not committing crimes.
    if (this.level > 0) {
      this.decayTimer -= dt;
      if (this.decayTimer <= 0) {
        this.level -= 1;
        this.heat = 0;
        this.decayTimer = CFG.WANTED_DECAY_SECONDS;
        this._syncPolice();
        onEvent && onEvent('wanted-down', this.level);
      }
    }
    const pp = player.pos;
    this.placeNear(pp);
    let busting = false;
    for (const p of this.police) {
      // Chase: steer toward the player, faster than traffic.
      const dx = pp.x - p.x;
      const dz = pp.z - p.z;
      const dist = Math.hypot(dx, dz) || 1;
      const wantHeading = Math.atan2(dz, dx);
      let dh = wantHeading - p.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      p.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, dh));
      const target = Math.min(CFG.POLICE_TOP_SPEED, 26 + this.level * 3);
      p.speed += (target - p.speed) * Math.min(1, dt * 0.8);
      const nx = p.x + Math.cos(p.heading) * p.speed * dt;
      const nz = p.z + Math.sin(p.heading) * p.speed * dt;
      const cl = this.city.clampToPlayable(nx, nz);
      const res = this.city.resolveCollisions(cl.x, cl.z, 1.6);
      if (Math.abs(res.x - nx) > 0.01 || Math.abs(res.z - nz) > 0.01) p.speed *= 0.5;
      p.x = res.x;
      p.z = res.z;
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = -p.heading;
      const spin = (p.speed * dt) / 0.42;
      for (const w of p.mesh.userData.wheels) w.rotation.z -= spin;
      // Ram: a police car touching the player's car damages it / slows it.
      if (dist < 3.4) {
        if (player.inCar) {
          player.car.speed *= 0.92;
          if (this.rng.chance(0.3)) onEvent && onEvent('rammed');
        } else {
          // On foot, a cop close by starts a bust.
          busting = true;
        }
      }
      // Bust: a cop standing next to the player on foot for a while.
      if (!player.inCar && dist < CFG.BUST_RANGE) {
        this.bustTimer += dt;
        if (this.bustTimer >= CFG.BUST_SECONDS) {
          this.bustTimer = 0;
          onEvent && onEvent('busted');
          return;
        }
      }
    }
    if (!busting && !this.police.some((p) => {
      const dx = pp.x - p.x;
      const dz = pp.z - p.z;
      return Math.hypot(dx, dz) < CFG.BUST_RANGE;
    })) {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }
  }
  // A foot cop on the street (for the wanted HUD). Not a car.
  get activeCount() {
    return this.police.length;
  }
}
