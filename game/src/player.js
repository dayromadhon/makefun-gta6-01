// Leo Marin, on foot and behind the wheel. On foot: WASD to walk (Shift to
// run), E to steal/exit a car, F to punch, click to shoot, R to reload.
// Driving hands the car the same WASD + Space handbrake. Health, cash and
// ammo live here; the wanted system and missions read them.

import * as THREE from 'three';
import { PLAYER, CAR } from './config.js';
import { clamp, dist2d } from './random.js';

function makePlayerMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.4, 1.0, 4, 8),
    new THREE.MeshLambertMaterial({ color: 0x2e5fa3 }),
  );
  jacket.position.y = 1.05;
  group.add(jacket);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xe8b88a }),
  );
  head.position.y = 1.95;
  group.add(head);
  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.31, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshLambertMaterial({ color: 0x1a1a1a }),
  );
  hair.position.y = 2.0;
  group.add(hair);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.55, 0.35),
    new THREE.MeshLambertMaterial({ color: 0x2c3e50 }),
  );
  legs.position.y = 0.28;
  group.add(legs);
  // A simple pistol in the right hand when armed.
  const gun = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.12, 0.5),
    new THREE.MeshLambertMaterial({ color: 0x111111 }),
  );
  gun.position.set(0.5, 1.1, 0.3);
  group.add(gun);
  group.userData.gun = gun;
  return group;
}

export class Player {
  constructor(scene, city, x = 0, z = 0) {
    this.scene = scene;
    this.city = city;
    this.mesh = makePlayerMesh();
    this.scene.add(this.mesh);
    this.x = x;
    this.z = z;
    this.heading = 0;
    this.health = PLAYER.health;
    this.cash = 0;
    this.ammo = PLAYER.pistolAmmo;
    this.ammoReserve = 48;
    this.inCar = null; // the Car being driven, or null
    this.speed = 0; // current speed (on foot or in car)
    this.punchCooldown = 0;
    this.shootCooldown = 0;
    this.reloadTimer = 0;
    this.invulnerable = 0;
    this.mesh.position.set(x, 0, z);
  }

  get pos() {
    return { x: this.x, z: this.z };
  }

  /** Move on foot. moveX/moveZ are -1..1 in world space; returns distance moved. */
  walk(moveX, moveZ, run, dt) {
    const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const len = Math.sqrt(moveX * moveX + moveZ * moveZ);
    if (len > 0.01) {
      const nx = moveX / len;
      const nz = moveZ / len;
      this.x += nx * speed * dt;
      this.z += nz * speed * dt;
      this.heading = Math.atan2(nx, nz);
      this.speed = speed;
    } else {
      this.speed = 0;
    }
    if (this.city) {
      this.city.resolveCircle(this, PLAYER.radius);
      this.city.clampToWorld(this);
    }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    // Walk bob.
    this.mesh.position.y = this.speed > 0 ? Math.abs(Math.sin(Date.now() * 0.01)) * 0.06 : 0;
    return this.speed;
  }

  /** Step into a car: hide the on-foot mesh and drive it. */
  enterCar(car) {
    this.inCar = car;
    car.parked = false;
    car.stolen = true;
    car.driven = true; // traffic AI must leave a driven car alone
    this.mesh.visible = false;
    this.x = car.x;
    this.z = car.z;
    this.heading = car.heading;
  }

  /** Step out next to the car. */
  exitCar() {
    const car = this.inCar;
    if (!car) return;
    this.inCar = null;
    car.speed = 0;
    car.driven = false;
    this.x = car.x + Math.cos(car.heading) * 3;
    this.z = car.z - Math.sin(car.heading) * 3;
    this.heading = car.heading;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }

  /** Drive the current car with the given inputs; returns speed. */
  driveCar(throttle, steer, handbrake, dt) {
    if (!this.inCar) return 0;
    this.inCar.drive(throttle, steer, handbrake, dt, this.city);
    this.x = this.inCar.x;
    this.z = this.inCar.z;
    this.heading = this.inCar.heading;
    this.speed = this.inCar.speed;
    return this.speed;
  }

  /** Punch: damages the nearest ped/cop in front within range. */
  punch(targets) {
    if (this.punchCooldown > 0 || this.inCar) return null;
    this.punchCooldown = PLAYER.punchCooldown;
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    let best = null;
    let bestD = PLAYER.punchRange;
    for (const t of targets) {
      const d = dist2d(this.x, this.z, t.x, t.z);
      if (d < bestD) {
        const dx = (t.x - this.x) / (d || 1);
        const dz = (t.z - this.z) / (d || 1);
        if (dx * fx + dz * fz > 0.3) {
          bestD = d;
          best = t;
        }
      }
    }
    return best;
  }

  /** Shoot the pistol: hitscan in the facing direction. Returns the hit target or null. */
  shoot(targets) {
    if (this.shootCooldown > 0 || this.reloadTimer > 0 || this.inCar) return { fired: false };
    if (this.ammo <= 0) {
      this.reloadTimer = PLAYER.reloadTime;
      return { fired: false, dry: true };
    }
    this.shootCooldown = PLAYER.shootCooldown;
    this.ammo -= 1;
    const fx = Math.sin(this.heading);
    const fz = Math.cos(this.heading);
    let best = null;
    let bestD = PLAYER.pistolRange;
    for (const t of targets) {
      const dx = t.x - this.x;
      const dz = t.z - this.z;
      const along = dx * fx + dz * fz;
      if (along < 0 || along > PLAYER.pistolRange) continue;
      const perp = Math.abs(dx * fz - dz * fx);
      if (perp < 1.2 && along < bestD) {
        bestD = along;
        best = t;
      }
    }
    return { fired: true, hit: best, range: bestD };
  }

  startReload() {
    if (this.reloadTimer > 0 || this.ammo >= PLAYER.pistolAmmo || this.ammoReserve <= 0) return false;
    this.reloadTimer = PLAYER.reloadTime;
    return true;
  }

  takeDamage(amount) {
    if (this.invulnerable > 0) return false;
    this.health -= amount;
    this.invulnerable = 0.6;
    return true;
  }

  heal(amount) {
    this.health = clamp(this.health + amount, 0, PLAYER.health);
  }

  addCash(amount) {
    this.cash += amount;
  }

  update(dt) {
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const need = PLAYER.pistolAmmo - this.ammo;
        const take = Math.min(need, this.ammoReserve);
        this.ammo += take;
        this.ammoReserve -= take;
      }
    }
  }

  /** Save the state the Continue button needs. */
  toSave() {
    return {
      x: this.x,
      z: this.z,
      heading: this.heading,
      health: this.health,
      cash: this.cash,
      ammo: this.ammo,
      ammoReserve: this.ammoReserve,
    };
  }

  fromSave(s) {
    this.x = s.x;
    this.z = s.z;
    this.heading = s.heading;
    this.health = s.health;
    this.cash = s.cash;
    this.ammo = s.ammo;
    this.ammoReserve = s.ammoReserve;
    if (this.inCar) this.exitCar();
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }
}
