// SOLMAR HEAT — vehicles.js
// One job: every car — the player's arcade driving, traffic that follows the
// street grid, parked cars to steal, taxis and police cars. A car is a small
// group of boxes; physics is arcade (speed, steering, grip, handbrake drift).

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { range, rangeInt, pick, streetPoint } from './random.js';

const CAR_COLORS = [0xd84a4a, 0x4a7ad8, 0xe8e8e8, 0x3a3f46, 0x7ab648, 0xe8b13c, 0x9a6ad8, 0x5a9a8a];

export function makeCarMesh(color, kind) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x22384f });
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x181818 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.2), glassMat);
  cabin.position.set(0, 1.1, -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.5), new THREE.MeshLambertMaterial({ color: CONFIG.colors.taxi }));
    sign.position.set(0, 1.55, -0.2);
    g.add(sign);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.18, 0.5), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    bar.position.set(0, 1.5, -0.2);
    g.add(bar);
    const lightR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.4), new THREE.MeshLambertMaterial({ color: 0xff2a2a, emissive: 0xff2a2a, emissiveIntensity: 0.9 }));
    lightR.position.set(-0.35, 1.55, -0.2);
    g.add(lightR);
    const lightB = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.4), new THREE.MeshLambertMaterial({ color: 0x2a6aff, emissive: 0x2a6aff, emissiveIntensity: 0.9 }));
    lightB.position.set(0.35, 1.55, -0.2);
    g.add(lightB);
    g.userData.lightR = lightR;
    g.userData.lightB = lightB;
  }
  if (kind === 'van') {
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.3, 3.2), new THREE.MeshLambertMaterial({ color: 0xe8e8e8 }));
    box.position.set(0, 1.25, -0.6);
    box.castShadow = true;
    g.add(box);
  }
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  for (const [x, z] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(x, 0.38, z);
    g.add(w);
  }
  return g;
}

export class VehicleManager {
  constructor(scene, rng, city, fxLow) {
    this.scene = scene;
    this.rng = rng;
    this.city = city;
    this.fxLow = fxLow;
    this.traffic = []; // {mesh, x, z, heading, speed, street: 'x'|'z', line, dir}
    this.parked = []; // {mesh, x, z, heading, taken}
    this.police = []; // {mesh, x, z, heading, speed}
    this.taxis = [];
    this.van = null;
    this.lines = CONFIG.streetLines;
  }

  spawnAll() {
    const n = this.fxLow ? CONFIG.trafficCountLow : CONFIG.trafficCount;
    for (let i = 0; i < n; i++) this.spawnTrafficCar();
    for (let i = 0; i < CONFIG.parkedCount; i++) this.spawnParkedCar();
  }

  spawnTrafficCar() {
    const p = streetPoint(this.rng, this.lines, CONFIG.cityHalf - 10);
    const alongX = Math.abs(p.z - this._nearestLine(p.z)) < 0.01;
    const mesh = makeCarMesh(pick(this.rng, CAR_COLORS), 'car');
    mesh.position.set(p.x, 0, p.z);
    const heading = alongX ? (this.rng() < 0.5 ? 0 : Math.PI) : (this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    mesh.rotation.y = heading;
    this.scene.add(mesh);
    const car = { mesh, x: p.x, z: p.z, heading, speed: range(this.rng, 8, 14), alongX, line: alongX ? p.z : p.x, dir: this.rng() < 0.5 ? 1 : -1, kind: 'car' };
    this.traffic.push(car);
    return car;
  }

  spawnParkedCar() {
    const p = streetPoint(this.rng, this.lines, CONFIG.cityHalf - 10);
    const alongX = Math.abs(p.z - this._nearestLine(p.z)) < 0.01;
    const off = 4.2; // parked at the road edge, off the driving lane
    const x = alongX ? p.x : p.x + (this.rng() < 0.5 ? off : -off);
    const z = alongX ? p.z + (this.rng() < 0.5 ? off : -off) : p.z;
    const mesh = makeCarMesh(pick(this.rng, CAR_COLORS), 'car');
    mesh.position.set(x, 0, z);
    const heading = alongX ? (this.rng() < 0.5 ? 0 : Math.PI) : (this.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
    mesh.rotation.y = heading;
    this.scene.add(mesh);
    const car = { mesh, x, z, heading, speed: 0, kind: 'car', taken: false };
    this.parked.push(car);
    return car;
  }

  spawnTaxi(x, z) {
    const mesh = makeCarMesh(CONFIG.colors.taxi, 'taxi');
    mesh.position.set(x, 0, z);
    mesh.rotation.y = this.rng() * Math.PI * 2;
    this.scene.add(mesh);
    const car = { mesh, x, z, heading: mesh.rotation.y, speed: 0, kind: 'taxi', taken: false };
    this.taxis.push(car);
    return car;
  }

  spawnVan(x, z) {
    const mesh = makeCarMesh(0xe8e8e8, 'van');
    mesh.position.set(x, 0, z);
    mesh.rotation.y = Math.PI / 2;
    this.scene.add(mesh);
    this.van = { mesh, x, z, heading: Math.PI / 2, speed: 0, kind: 'van', taken: false };
    return this.van;
  }

  spawnPolice(x, z) {
    const mesh = makeCarMesh(CONFIG.colors.police, 'police');
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const car = { mesh, x, z, heading: 0, speed: 0, kind: 'police' };
    this.police.push(car);
    return car;
  }

  removePolice(car) {
    this.scene.remove(car.mesh);
    this.police = this.police.filter((c) => c !== car);
  }

  _nearestLine(v) {
    let best = this.lines[0];
    for (const l of this.lines) if (Math.abs(l - v) < Math.abs(best - v)) best = l;
    return best;
  }

  // One frame of traffic: follow the street, turn at intersections, keep clear of the player car.
  updateTraffic(dt, playerCar) {
    for (const car of this.traffic) {
      // Drive along the street line.
      const step = car.speed * car.dir * dt;
      if (car.alongX) car.x += step;
      else car.z += step;
      // At an intersection, sometimes turn onto the crossing street.
      const nearLine = this._nearestLine(car.alongX ? car.x : car.z);
      const onIntersection = Math.abs((car.alongX ? car.x : car.z) - nearLine) < 1.2;
      if (onIntersection && this.rng() < dt * 0.25) {
        car.alongX = !car.alongX;
        car.line = nearLine;
        car.dir = this.rng() < 0.5 ? 1 : -1;
      }
      // Turn around at the city edge.
      const coord = car.alongX ? car.x : car.z;
      if (coord > CONFIG.cityHalf || coord < -CONFIG.cityHalf) car.dir *= -1;
      // A traffic car the player's car is right behind speeds up to get out
      // of the way (slowing down made it a rolling roadblock the player car
      // could never pass).
      if (playerCar) {
        const dx = car.x - playerCar.x;
        const dz = car.z - playerCar.z;
        if (dx * dx + dz * dz < 64) car.speed = Math.min(14, car.speed + 10 * dt);
        else car.speed = Math.min(14, car.speed + 4 * dt);
      }
      const targetHeading = car.alongX ? (car.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.dir > 0 ? 0 : Math.PI);
      // Heading: cars face their direction of travel. Forward is (sin h, cos h):
      // moving +X is h = PI/2, moving +Z is h = 0, moving -X is h = -PI/2, moving -Z is h = PI.
      let h = targetHeading;
      if (car.alongX) h = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      else h = car.dir > 0 ? 0 : Math.PI;
      car.heading = h;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = h;
    }
  }

  // Arcade driving for one car. Returns the new state. `ctl` is {forward, steer, handbrake}.
  drive(car, ctl, dt) {
    const maxF = CONFIG.carTopSpeed;
    const maxR = CONFIG.carReverseSpeed;
    if (ctl.forward > 0) car.speed += CONFIG.carAccel * dt;
    else if (ctl.forward < 0) {
      if (car.speed > 0.5) car.speed -= CONFIG.carBrake * dt;
      else car.speed -= CONFIG.carAccel * 0.6 * dt;
    } else {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 8 * dt);
    }
    car.speed = Math.max(-maxR, Math.min(maxF, car.speed));
    const grip = ctl.handbrake ? CONFIG.handbrakeGrip : CONFIG.carGrip;
    const steerAmount = ctl.steer * CONFIG.carSteer * Math.min(1, Math.abs(car.speed) / 8) * (car.speed < 0 ? -1 : 1);
    // Turning right (D, steer +1) DECREASES the heading: forward is (sin h, cos h),
    // so h = 0 faces +Z and h = -PI/2 faces -X, which is screen-right when the
    // camera looks toward +Z from behind. Reversing flips the sign, as in a real car.
    car.heading -= steerAmount * dt * (ctl.handbrake ? 1.6 : 1);
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    // Collide with buildings axis by axis, so the car slides along a wall
    // instead of stopping dead against it.
    const blockedX = this.city ? this._blocked(nx, car.z, 1.4) : false;
    const blockedZ = this.city ? this._blocked(car.x, nz, 1.4) : false;
    if (!blockedX) car.x = nx;
    if (!blockedZ) car.z = nz;
    if (blockedX && blockedZ) car.speed *= -0.25;
    else if (blockedX || blockedZ) car.speed *= 0.6;
    // Keep inside the world.
    car.x = Math.max(-150, Math.min(150, car.x));
    car.z = Math.max(-150, Math.min(150, car.z));
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    return car;
  }

  _blocked(x, z, r) {
    if (!this.city) return false;
    return !!this.city.colliders.find((c) => x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r);
  }

  // Police chase: steer toward the target, ram on contact.
  updatePolice(dt, target) {
    for (const cop of this.police) {
      const dx = target.x - cop.x;
      const dz = target.z - cop.z;
      const dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      let diff = want - cop.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      cop.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      cop.speed = Math.min(30, cop.speed + 14 * dt);
      if (dist < 3) cop.speed = Math.max(0, cop.speed - 30 * dt);
      cop.x += Math.sin(cop.heading) * cop.speed * dt;
      cop.z += Math.cos(cop.heading) * cop.speed * dt;
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
      // Flash the light bar.
      const t = performance.now() / 300;
      if (cop.mesh.userData.lightR) cop.mesh.userData.lightR.material.emissiveIntensity = Math.sin(t) > 0 ? 1.4 : 0.15;
      if (cop.mesh.userData.lightB) cop.mesh.userData.lightB.material.emissiveIntensity = Math.sin(t) > 0 ? 0.15 : 1.4;
    }
  }
}
