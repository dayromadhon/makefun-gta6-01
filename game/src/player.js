// SOLMAR HEAT — player: Leo Marin on foot and behind the wheel.
// On foot: WASD to move, E to steal a car, F to punch, 1/2 to switch fists
// and pistol, click to shoot, R to reload. In a car: W/S to drive, A/D to
// steer, Space to handbrake, E to get out.
import * as THREE from 'three';
import { CFG } from './config.js';

export class Player {
  constructor(scene, city, vehicles, peds, audio, effects) {
    this.scene = scene;
    this.city = city;
    this.vehicles = vehicles;
    this.peds = peds;
    this.audio = audio;
    this.effects = effects;
    this.x = 0;
    this.z = 40;
    this.heading = 0;
    this.health = CFG.startHealth;
    this.ammo = CFG.startAmmo;
    this.mag = CFG.magSize;
    this.weapon = 'fists';
    this.onFoot = true;
    this.car = null;
    this.speed = 0;
    this.ramX = 0;
    this.ramZ = 0;
    this.punchCooldown = 0;
    this.shotCooldown = 0;
    this.bustedTimer = 0;
    this.onSteal = null;
    this.onShoot = null;
    this.onPunch = null;
    this.onEnterCar = null;
    this.onExitCar = null;
    this.group = this._makeBody();
    scene.add(this.group);
  }

  _makeBody() {
    const g = new THREE.Group();
    const jacket = new THREE.MeshLambertMaterial({ color: 0x8a2f2f });
    const jeans = new THREE.MeshLambertMaterial({ color: 0x2a3a5a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xd8a070 });
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.85, 0.32), jeans);
    legs.position.y = 0.42;
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.75, 0.36), jacket);
    body.position.y = 1.2;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.36), skin);
    head.position.y = 1.78;
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.14, 0.38), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    hair.position.y = 1.98;
    g.add(legs);
    g.add(body);
    g.add(head);
    g.add(hair);
    g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
    return g;
  }

  get position() {
    return { x: this.x, z: this.z };
  }

  reset(x, z) {
    this.x = x;
    this.z = z;
    this.heading = 0;
    this.health = CFG.startHealth;
    this.onFoot = true;
    this.car = null;
    this.speed = 0;
    this.group.visible = true;
  }

  // Called by police rams: shoves the player and hurts the car or Leo.
  applyRam(px, pz, damage) {
    if (this.onFoot) {
      this.x += px;
      this.z += pz;
      this.damage(damage * 0.5);
    } else if (this.car) {
      this.car.x += px * 2;
      this.car.z += pz * 2;
      this.car.health -= damage;
      this.audio.crash();
      this.effects.burst(this.car.x, 1, this.car.z, 0xffaa33, 8);
      if (this.car.health <= 0) this._wreckCar();
    }
  }

  damage(n) {
    this.health = Math.max(0, this.health - n);
  }

  _wreckCar() {
    if (!this.car) return;
    const car = this.car;
    this.effects.burst(car.x, 1.2, car.z, 0x555555, 26);
    this.effects.burst(car.x, 1.2, car.z, 0xff6611, 14);
    this.audio.crash();
    this.exitCar();
    this.vehicles.removeCar(car);
  }

  enterCar(car) {
    this.car = car;
    this.onFoot = false;
    car.isPlayer = true;
    car.isParked = false;
    const i = this.vehicles.parked.indexOf(car);
    if (i !== -1) this.vehicles.parked.splice(i, 1);
    this.group.visible = false;
    this.x = car.x;
    this.z = car.z;
    this.heading = car.heading;
    this.speed = 0;
    if (this.onEnterCar) this.onEnterCar(car);
  }

  exitCar() {
    if (!this.car) return;
    const car = this.car;
    car.isPlayer = false;
    car.speed = 0;
    this.car = null;
    this.onFoot = true;
    this.x = car.x + Math.cos(car.heading) * 2.4;
    this.z = car.z - Math.sin(car.heading) * 2.4;
    this.heading = car.heading;
    this.group.visible = true;
    if (this.onExitCar) this.onExitCar(car);
  }

  trySteal() {
    if (!this.onFoot) return false;
    const car = this.vehicles.nearestCar(this.x, this.z, 4.5, (c) => !c.isPolice && c.health > 0);
    if (!car) return false;
    this.enterCar(car);
    if (this.onSteal) this.onSteal(car);
    return true;
  }

  punch() {
    if (this.punchCooldown > 0 || !this.onFoot) return;
    this.punchCooldown = 0.45;
    this.audio.punch();
    const fx = this.x + Math.sin(this.heading) * 1.6;
    const fz = this.z + Math.cos(this.heading) * 1.6;
    this.effects.burst(fx, 1.2, fz, 0xffffff, 5);
    const ped = this.peds.nearest(fx, fz, 1.8);
    if (ped) {
      this.peds.knockDown(ped);
      if (this.onPunch) this.onPunch(ped);
      return;
    }
    if (this.onPunch) this.onPunch(null);
  }

  shoot(camera) {
    if (this.shotCooldown > 0 || !this.onFoot || this.weapon !== 'pistol') return;
    if (this.mag <= 0) {
      this.audio.denied();
      this.shotCooldown = 0.3;
      return;
    }
    this.shotCooldown = 0.22;
    this.mag -= 1;
    this.audio.shot();
    const dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    const from = new THREE.Vector3(this.x, 1.5, this.z);
    // Hit the nearest pedestrian roughly along the aim ray.
    let best = null;
    let bestD = 60;
    for (const p of this.peds.peds) {
      if (p.state === 'down') continue;
      const to = new THREE.Vector3(p.x - from.x, 1.2 - from.y, p.z - from.z);
      const d = to.length();
      if (d > 60) continue;
      to.normalize();
      if (to.dot(dir) > 0.92 && d < bestD) {
        bestD = d;
        best = p;
      }
    }
    const end = from.clone().add(dir.clone().multiplyScalar(best ? bestD : 40));
    this.effects.tracer(from, end);
    if (best) {
      this.peds.knockDown(best);
      if (this.onShoot) this.onShoot(best);
    }
  }

  reload() {
    if (this.weapon !== 'pistol' || this.mag >= CFG.magSize || this.ammo <= 0) return;
    const need = CFG.magSize - this.mag;
    const take = Math.min(need, this.ammo);
    this.mag += take;
    this.ammo -= take;
    this.audio.blip();
  }

  update(dt, input, camera) {
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.shotCooldown = Math.max(0, this.shotCooldown - dt);
    if (this.onFoot) {
      const { steer, throttle } = input.axes();
      const run = input.isDown('ShiftLeft') || input.isDown('ShiftRight');
      const speed = run ? CFG.playerRunSpeed : CFG.playerWalkSpeed;
      let mx = 0;
      let mz = 0;
      // Movement is camera-relative: W walks away from the camera.
      const camDir = new THREE.Vector3();
      camera.getWorldDirection(camDir);
      camDir.y = 0;
      camDir.normalize();
      const right = new THREE.Vector3().crossVectors(camDir, new THREE.Vector3(0, 1, 0));
      mx = camDir.x * throttle + right.x * steer;
      mz = camDir.z * throttle + right.z * steer;
      const len = Math.hypot(mx, mz);
      if (len > 0.01) {
        mx /= len;
        mz /= len;
        this.x += mx * speed * dt;
        this.z += mz * speed * dt;
        this.heading = Math.atan2(mx, mz);
        // Knock down pedestrians you sprint into.
        const ped = this.peds.nearest(this.x, this.z, 1.1);
        if (ped && run) this.peds.knockDown(ped);
      }
      const fixed = this.city.resolveCollision(this.x, this.z, 0.6);
      this.x = fixed.x;
      this.z = fixed.z;
      this.x = Math.max(-CFG.half - 6, Math.min(CFG.half + 24, this.x));
      this.z = Math.max(-CFG.half - 6, Math.min(CFG.half + 34, this.z));
      this.group.position.set(this.x, 0, this.z);
      this.group.rotation.y = this.heading;
      this.group.position.y = len > 0.01 ? Math.abs(Math.sin(performance.now() * 0.012)) * 0.06 : 0;
      if (input.wasPressed('KeyE')) this.trySteal();
      if (input.wasPressed('KeyF')) this.punch();
      if (input.wasPressed('Digit1')) { this.weapon = 'fists'; this.audio.blip(); }
      if (input.wasPressed('Digit2')) { this.weapon = 'pistol'; this.audio.blip(); }
      if (input.wasPressed('KeyR')) this.reload();
      if (input.mouseClicked) this.shoot(camera);
    } else if (this.car) {
      const { steer, throttle } = input.axes();
      const handbrake = input.isDown('Space');
      const car = this.car;
      const forward = throttle >= 0 ? 1 : -1;
      if (throttle !== 0) {
        car.speed += forward * CFG.carAccel * dt * (handbrake ? 0.5 : 1);
      } else {
        car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
      }
      if (throttle < 0 && car.speed > 0.5) car.speed -= CFG.carBrake * dt;
      const top = handbrake ? CFG.carTopSpeed * 0.55 : CFG.carTopSpeed;
      car.speed = Math.max(-CFG.carReverseSpeed, Math.min(top, car.speed));
      const turnAuthority = Math.min(1, Math.abs(car.speed) / 6);
      car.heading += steer * CFG.carTurn * turnAuthority * dt * (handbrake ? 1.5 : 1) * Math.sign(car.speed || 1);
      const nx = car.x + Math.sin(car.heading) * car.speed * dt;
      const nz = car.z + Math.cos(car.heading) * car.speed * dt;
      const fixed = this.city.resolveCollision(nx, nz, 1.6);
      if ((fixed.x !== nx || fixed.z !== nz) && Math.abs(car.speed) > 6) {
        this.audio.crash();
        this.effects.burst(car.x, 1, car.z, 0xffcc66, 6);
        car.health -= 4;
        car.speed *= 0.4;
        if (car.health <= 0) this._wreckCar();
      }
      car.x = fixed.x;
      car.z = fixed.z;
      // Running over pedestrians is a crime.
      const ped = this.peds.nearest(car.x, car.z, 2.2);
      if (ped && Math.abs(car.speed) > 3) {
        this.peds.knockDown(ped);
        this.peds.fleeFrom(car.x, car.z, 18);
        car.speed *= 0.85;
      }
      this.peds.fleeFrom(car.x, car.z, 10);
      this.x = car.x;
      this.z = car.z;
      this.heading = car.heading;
      this.speed = car.speed;
      if (input.wasPressed('KeyE')) this.exitCar();
    }
  }
}
