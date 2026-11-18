// SOLMAR HEAT — the player, Leo Marin. On foot he walks, runs, punches and
// shoots; near a parked car he can steal it with E and drive. Getting out
// (E again) leaves the car where it is.

import * as THREE from 'three';
import { CFG } from './config.js';
import { makePedMesh } from './pedestrians.js';

export class Player {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.mesh = makePedMesh(rng);
    // Leo stands out: a red shirt.
    this.mesh.children[0].material = new THREE.MeshLambertMaterial({ color: 0xc23b2e });
    this.scene.add(this.mesh);
    this.x = city.places.playerStart.x;
    this.z = city.places.playerStart.z;
    this.heading = 0;
    this.health = CFG.PLAYER_HEALTH;
    this.ammo = CFG.PISTOL_AMMO;
    this.reserve = CFG.PISTOL_RESERVE;
    this.car = null; // the Car the player is driving (null = on foot)
    this.walkPhase = 0;
    this.punchCooldown = 0;
    this.shootCooldown = 0;
    this.reloadTimer = 0;
    this.fistTarget = null;
  }
  get pos() {
    return this.car ? { x: this.car.x, z: this.car.z } : { x: this.x, z: this.z };
  }
  get speed() {
    return this.car ? Math.abs(this.car.speed) : 0;
  }
  get inCar() {
    return this.car !== null;
  }
  reset(start) {
    this.x = start.x;
    this.z = start.z;
    this.heading = 0;
    this.health = CFG.PLAYER_HEALTH;
    this.ammo = CFG.PISTOL_AMMO;
    this.reserve = CFG.PISTOL_RESERVE;
    if (this.car) {
      this.car.isPlayer = false;
      this.car = null;
    }
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
  }
  enterCar(car) {
    this.car = car;
    car.isPlayer = true;
    car.parked = false;
    this.mesh.visible = false;
  }
  exitCar() {
    if (!this.car) return;
    const car = this.car;
    car.isPlayer = false;
    car.speed = 0;
    car.parked = true; // left parked where it stands; stealable again
    // Step out to the car's left side.
    const sx = car.x + Math.cos(car.heading + Math.PI / 2) * 2.2;
    const sz = car.z + Math.sin(car.heading + Math.PI / 2) * 2.2;
    const res = this.city.resolveCollisions(sx, sz, 0.6);
    this.x = res.x;
    this.z = res.z;
    this.heading = car.heading;
    this.car = null;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
  }
  // Nearest stealable car within reach (parked, not the player's).
  nearestCar(cars, maxDist = 4.5) {
    let best = null;
    let bestD = maxDist;
    for (const c of cars) {
      if (c.isPlayer || c.parked === false && c.speed > 0.5) continue;
      // Only parked cars (or slow traffic) can be stolen.
      if (!c.parked && Math.abs(c.speed) > 1) continue;
      const dx = c.x - this.x;
      const dz = c.z - this.z;
      const d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }
  update(dt, input, cars, pedestrians, onEvent) {
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const need = CFG.PISTOL_AMMO - this.ammo;
        const take = Math.min(need, this.reserve);
        this.ammo += take;
        this.reserve -= take;
        onEvent && onEvent('reloaded');
      }
    }
    if (this.car) {
      this.car.update(dt, input, this.city);
      // Knock down peds the car runs over.
      const hit = pedestrians.knockDown(this.car.x, this.car.z, 2.4);
      if (hit) onEvent && onEvent('ped-down', hit);
      if (input.hit('KeyE')) {
        this.exitCar();
        onEvent && onEvent('exit-car');
      }
      return;
    }
    // On foot: move with WASD (camera-relative is handled by the camera
    // facing -Z; movement is world-aligned for simplicity and reliability).
    const speed = input.run ? CFG.PLAYER_RUN_SPEED : CFG.PLAYER_WALK_SPEED;
    let mx = 0;
    let mz = 0;
    if (input.down('KeyW') || input.down('ArrowUp')) mz -= 1;
    if (input.down('KeyS') || input.down('ArrowDown')) mz += 1;
    if (input.down('KeyA') || input.down('ArrowLeft')) mx -= 1;
    if (input.down('KeyD') || input.down('ArrowRight')) mx += 1;
    if (mx !== 0 || mz !== 0) {
      const len = Math.hypot(mx, mz);
      mx /= len;
      mz /= len;
      const nx = this.x + mx * speed * dt;
      const nz = this.z + mz * speed * dt;
      const cl = this.city.clampToPlayable(nx, nz);
      const res = this.city.resolveCollisions(cl.x, cl.z, 0.6);
      this.x = res.x;
      this.z = res.z;
      this.heading = Math.atan2(mz, mx);
      this.walkPhase += dt * speed * 1.6;
      const swing = Math.sin(this.walkPhase) * 0.5;
      this.mesh.userData.legL.rotation.x = swing;
      this.mesh.userData.legR.rotation.x = -swing;
    } else {
      this.mesh.userData.legL.rotation.x = 0;
      this.mesh.userData.legR.rotation.x = 0;
    }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = -this.heading + Math.PI / 2;
    // Steal a car with E.
    if (input.hit('KeyE')) {
      const car = this.nearestCar(cars);
      if (car) {
        this.enterCar(car);
        onEvent && onEvent('steal-car', car);
      }
    }
    // Punch with F (nearest ped in front).
    if (input.hit('KeyF') && this.punchCooldown <= 0) {
      this.punchCooldown = 0.45;
      let best = null;
      let bestD = CFG.FIST_RANGE;
      for (const p of pedestrians.peds) {
        if (p.state === 'down') continue;
        const dx = p.x - this.x;
        const dz = p.z - this.z;
        const d = Math.hypot(dx, dz);
        if (d < bestD) {
          bestD = d;
          best = p;
        }
      }
      if (best) {
        best.state = 'down';
        best.downTimer = 5;
        best.mesh.rotation.x = Math.PI / 2;
        best.mesh.position.y = 0.3;
        onEvent && onEvent('punch', best);
      } else {
        onEvent && onEvent('punch-miss');
      }
    }
    // Shoot with mouse click (or J). Hits the nearest ped in the facing cone.
    const wantShoot = input.mouseClicked || input.hit('KeyJ');
    if (wantShoot && this.shootCooldown <= 0 && this.reloadTimer <= 0) {
      this.shootCooldown = 0.35;
      if (this.ammo > 0) {
        this.ammo -= 1;
        let best = null;
        let bestD = CFG.PISTOL_RANGE;
        const fx = Math.cos(this.heading);
        const fz = Math.sin(this.heading);
        for (const p of pedestrians.peds) {
          if (p.state === 'down') continue;
          const dx = p.x - this.x;
          const dz = p.z - this.z;
          const d = Math.hypot(dx, dz);
          if (d > bestD) continue;
          const dot = (dx * fx + dz * fz) / (d || 1);
          if (dot < 0.7) continue; // must be roughly in front
          bestD = d;
          best = p;
        }
        if (best) {
          best.state = 'down';
          best.downTimer = 6;
          best.mesh.rotation.x = Math.PI / 2;
          best.mesh.position.y = 0.3;
          onEvent && onEvent('shot-hit', best);
        } else {
          onEvent && onEvent('shot-miss');
        }
      } else {
        onEvent && onEvent('shot-empty');
      }
    }
    // Reload with R.
    if (input.hit('KeyR') && this.reloadTimer <= 0 && this.ammo < CFG.PISTOL_AMMO && this.reserve > 0) {
      this.reloadTimer = 1.1;
      onEvent && onEvent('reload-start');
    }
  }
  damage(amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health <= 0;
  }
  heal(amount) {
    this.health = Math.min(CFG.PLAYER_HEALTH, this.health + amount);
  }
}
