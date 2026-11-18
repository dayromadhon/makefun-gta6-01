// SOLMAR HEAT — player.js
// One job: Leo Marin on foot and behind the wheel — movement, stealing cars,
// fists and pistol, health. The camera heading drives movement: forward is
// where the camera looks, and D is always to the right, on foot and in a car.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { hitsCollider, hitsCircle } from './city.js';

export class Player {
  constructor(scene, audio) {
    this.scene = scene;
    this.audio = audio;
    this.x = 0;
    this.z = 8;
    this.heading = 0; // facing, radians (0 = +Z)
    this.speed = 0;
    this.health = CONFIG.playerHealth;
    this.inCar = null; // the car object when driving, else null
    this.ammo = CONFIG.pistolAmmo;
    this.hasPistol = true;
    this.reloading = 0;
    this.punchCooldown = 0;
    this.dead = false;
    this.mesh = this._makeMesh();
    this.mesh.position.set(this.x, 0, this.z);
    scene.add(this.mesh);
  }

  _makeMesh() {
    const g = new THREE.Group();
    const jacket = new THREE.MeshLambertMaterial({ color: CONFIG.colors.player });
    const skin = new THREE.MeshLambertMaterial({ color: 0xe8b98a });
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.32), new THREE.MeshLambertMaterial({ color: 0x2a2f38 }));
    legs.position.y = 0.38;
    g.add(legs);
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.75, 0.4), jacket);
    torso.position.y = 1.12;
    torso.castShadow = true;
    g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 10, 8), skin);
    head.position.y = 1.75;
    g.add(head);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x1c2733 }));
    cap.position.y = 1.98;
    g.add(cap);
    // A visible pistol in the right hand when armed.
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x181818 }));
    gun.position.set(0.42, 1.05, 0.3);
    gun.name = 'gun';
    g.add(gun);
    return g;
  }

  // On-foot movement for one frame. camHeading is the camera yaw; forward is
  // where the camera looks. Returns nothing; sets x/z/heading.
  updateOnFoot(dt, input, camHeading, city) {
    const fwd = input.moveForward();
    const strafe = input.moveStrafe();
    const running = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
    const speed = running ? CONFIG.runSpeed : CONFIG.walkSpeed;
    // Camera-relative basis: forward = camera look direction on the ground,
    // right = forward rotated -90 degrees (so D is always to the right).
    const fx = Math.sin(camHeading);
    const fz = Math.cos(camHeading);
    const rx = Math.sin(camHeading - Math.PI / 2);
    const rz = Math.cos(camHeading - Math.PI / 2);
    let mx = fx * fwd + rx * strafe;
    let mz = fz * fwd + rz * strafe;
    const len = Math.hypot(mx, mz);
    if (len > 0.01) {
      mx /= len;
      mz /= len;
      const nx = this.x + mx * speed * dt;
      const nz = this.z + mz * speed * dt;
      if (!hitsCollider(city.colliders, nx, this.z, CONFIG.playerRadius)) this.x = nx;
      if (!hitsCollider(city.colliders, this.x, nz, CONFIG.playerRadius)) this.z = nz;
      if (!hitsCircle(city.circles, this.x, this.z, CONFIG.playerRadius)) {
        // free
      }
      this.heading = Math.atan2(mx, mz);
      this.speed = speed;
    } else {
      this.speed = 0;
    }
    this.x = Math.max(-150, Math.min(150, this.x));
    this.z = Math.max(-150, Math.min(150, this.z));
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    // Walking bob.
    this.mesh.position.y = this.speed > 0 ? Math.abs(Math.sin(performance.now() / 150)) * 0.05 : 0;
    if (this.punchCooldown > 0) this.punchCooldown -= dt * 1000;
    if (this.reloading > 0) {
      this.reloading -= dt * 1000;
      if (this.reloading <= 0) {
        this.ammo = CONFIG.pistolAmmo;
        this.reloading = 0;
      }
    }
  }

  // The nearest stealable car within radius (parked, taxi, van, or traffic
  // that has stopped). Returns the car object or null.
  nearestCar(cars, radius) {
    let best = null;
    let bestD = radius;
    for (const car of cars) {
      if (car.taken) continue;
      const d = Math.hypot(car.x - this.x, car.z - this.z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  enterCar(car) {
    this.inCar = car;
    car.taken = true;
    this.mesh.visible = false;
    this.x = car.x;
    this.z = car.z;
    this.heading = car.heading;
  }

  exitCar() {
    if (!this.inCar) return;
    const car = this.inCar;
    this.inCar = null;
    car.taken = false;
    // Step out to the driver's side.
    const side = 2.2;
    this.x = car.x + Math.cos(car.heading) * side;
    this.z = car.z - Math.sin(car.heading) * side;
    this.heading = car.heading;
    this.mesh.visible = true;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }

  // Pistol shot toward a heading. Returns 'shot' | 'empty' | 'reloading'.
  shoot() {
    if (this.reloading > 0) return 'reloading';
    if (this.ammo <= 0) {
      this.reloading = CONFIG.pistolReloadMs;
      return 'empty';
    }
    this.ammo -= 1;
    this.audio.gunshot();
    if (this.ammo <= 0) this.reloading = CONFIG.pistolReloadMs;
    return 'shot';
  }

  punch() {
    if (this.punchCooldown > 0) return false;
    this.punchCooldown = CONFIG.punchCooldownMs;
    this.audio.punch();
    return true;
  }

  hurt(amount) {
    this.health = Math.max(0, this.health - amount);
    if (this.health <= 0) this.dead = true;
  }

  heal(amount) {
    this.health = Math.min(CONFIG.playerHealth, this.health + amount);
  }

  reset(x, z) {
    this.x = x;
    this.z = z;
    this.heading = 0;
    this.health = CONFIG.playerHealth;
    this.dead = false;
    this.ammo = CONFIG.pistolAmmo;
    this.reloading = 0;
    if (this.inCar) {
      this.inCar.taken = false;
      this.inCar = null;
    }
    this.mesh.visible = true;
    this.mesh.position.set(x, 0, z);
  }
}
