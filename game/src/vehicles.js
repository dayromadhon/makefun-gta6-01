// Cars: arcade driving physics, traffic AI, parked cars, taxis and the courier
// van, and police pursuit cars. A car is a box body + cabin + four wheels; the
// physics is a simple bicycle-ish model with handbrake drift.

import * as THREE from 'three';
import { CAR, WORLD } from './config.js';
import { clamp, angleDiff, dist2d, Rng } from './random.js';

const CAR_COLORS = [0xc0392b, 0x2980b9, 0x27ae60, 0xf39c12, 0x8e44ad, 0x7f8c8d, 0xd35400, 0x16a085, 0x2c3e50, 0xecf0f1];
const TAXI_COLOR = 0xf1c40f;
const POLICE_COLOR = 0x1a3a8a;
const VAN_COLOR = 0xe67e22;

function makeCarMesh(color, isVan = false) {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.7, isVan ? 5.2 : 4.2), bodyMat);
  body.position.y = 0.55;
  group.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.6, isVan ? 2.2 : 2.0),
    isVan ? bodyMat : glassMat,
  );
  cabin.position.set(0, 1.15, isVan ? -0.6 : -0.2);
  group.add(cabin);
  if (isVan) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.3, 5.2), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    stripe.position.y = 0.75;
    group.add(stripe);
  }
  // Wheels.
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    group.add(w);
  }
  return group;
}

export class Car {
  constructor(opts) {
    this.kind = opts.kind || 'civilian'; // civilian | taxi | police | van | player
    this.mesh = makeCarMesh(opts.color, opts.kind === 'van');
    if (opts.kind === 'police') {
      const lightBar = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 0.25, 0.5),
        new THREE.MeshLambertMaterial({ color: 0xff0000, emissive: 0x550000 }),
      );
      lightBar.position.set(0, 1.55, -0.2);
      this.mesh.add(lightBar);
      this.lightBar = lightBar;
    }
    this.mesh.position.set(opts.x || 0, 0, opts.z || 0);
    this.mesh.rotation.y = opts.heading || 0;
    this.x = opts.x || 0;
    this.z = opts.z || 0;
    this.heading = opts.heading || 0;
    this.speed = 0;
    this.steer = 0;
    this.parked = !!opts.parked;
    this.stolen = false;
    this.driven = false; // true while the player is driving this car
    // Traffic AI state.
    this.road = opts.road || 'x'; // 'x' drives along X, 'z' along Z
    this.lane = opts.lane || 0; // street coordinate
    this.dir = opts.dir || 1;
    this.targetSpeed = CAR.trafficSpeed;
    this.wait = 0;
  }

  get pos() {
    return { x: this.x, z: this.z };
  }

  /** Arcade step. throttle -1..1, steer -1..1, handbrake bool, dt seconds. */
  drive(throttle, steer, handbrake, dt, city) {
    const forward = { x: Math.sin(this.heading), z: Math.cos(this.heading) };
    // Acceleration.
    if (throttle > 0) this.speed += CAR.accel * throttle * dt;
    else if (throttle < 0) {
      if (this.speed > 0.5) this.speed -= CAR.brake * dt;
      else this.speed -= CAR.reverseAccel * dt;
    } else {
      this.speed -= this.speed * 1.2 * dt; // drag
    }
    this.speed = clamp(this.speed, -CAR.maxReverse, CAR.maxSpeed);
    // Steering: more effective at speed, less at a standstill.
    const steerAuthority = clamp(Math.abs(this.speed) / 8, 0, 1);
    const turn = steer * CAR.steer * steerAuthority * (this.speed >= 0 ? 1 : -1);
    this.heading += turn * dt * (handbrake ? 1.8 : 1);
    // Grip: the car mostly follows its heading; handbrake lets it slide.
    const grip = handbrake ? CAR.handbrakeGrip : CAR.grip;
    const fwdSpeed = this.speed;
    const newForward = { x: Math.sin(this.heading), z: Math.cos(this.heading) };
    this.x += newForward.x * fwdSpeed * dt;
    this.z += newForward.z * fwdSpeed * dt;
    // Building collision: stop and slide along.
    if (city) {
      const before = { x: this.x, z: this.z };
      if (city.resolveCircle(this, CAR.radius)) {
        const moved = dist2d(before.x, before.z, this.x, this.z);
        if (moved < 0.01) this.speed *= 0.3;
        else this.speed *= 0.85;
      }
      city.clampToWorld(this);
    }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
    return forward;
  }

  /** Traffic AI: follow the current road, turn at intersections, slow for the player. */
  trafficStep(dt, city, playerPos) {
    if (this.parked) return;
    if (this.wait > 0) {
      this.wait -= dt;
      this.speed = 0;
      return;
    }
    // Slow down if something is right ahead.
    const aheadX = this.x + Math.sin(this.heading) * 7;
    const aheadZ = this.z + Math.cos(this.heading) * 7;
    const nearPlayer = playerPos && dist2d(aheadX, aheadZ, playerPos.x, playerPos.z) < 4;
    const target = nearPlayer ? 0 : this.targetSpeed;
    this.speed += clamp(target - this.speed, -CAR.brake * dt, CAR.accel * dt);
    this.x += Math.sin(this.heading) * this.speed * dt;
    this.z += Math.cos(this.heading) * this.speed * dt;
    // At an intersection, sometimes turn onto the crossing street.
    const onStreetX = WORLD.streets.some((s) => Math.abs(this.z - s) < 1.2);
    const onStreetZ = WORLD.streets.some((s) => Math.abs(this.x - s) < 1.2);
    if ((this.road === 'x' && onStreetX && Math.abs(this.x) < WORLD.half) ||
        (this.road === 'z' && onStreetZ && Math.abs(this.z) < WORLD.half)) {
      if (Math.random() < 0.02) {
        // Turn left or right.
        const turn = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
        this.heading += turn;
        this.road = this.road === 'x' ? 'z' : 'x';
        this.lane = this.road === 'x' ? this.z : this.x;
      }
    }
    // U-turn at the city edge.
    if (Math.abs(this.x) > WORLD.half + 8 || Math.abs(this.z) > WORLD.half + 8) {
      this.heading += Math.PI;
      this.road = this.road === 'x' ? 'x' : 'z';
    }
    if (city) {
      if (city.resolveCircle(this, CAR.radius)) this.speed *= 0.5;
      city.clampToWorld(this);
    }
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.heading;
  }

  /** Police pursuit: steer toward the target, ram, and flash the light bar. */
  policeStep(dt, city, target, time) {
    const dx = target.x - this.x;
    const dz = target.z - this.z;
    const dist = Math.sqrt(dx * dx + dz * dz) || 1;
    const want = Math.atan2(dx, dz);
    const diff = angleDiff(this.heading, want);
    const steer = clamp(diff * 1.5, -1, 1);
    const throttle = dist > 4 ? 1 : 0.4;
    this.drive(throttle, steer, false, dt, city);
    // Cap police speed a touch above the player's top speed so they can catch up.
    if (this.speed > CAR.policeSpeed) this.speed = CAR.policeSpeed;
    if (this.lightBar) {
      this.lightBar.material.color.setHex(Math.floor(time * 4) % 2 === 0 ? 0xff0000 : 0x0000ff);
    }
  }
}

export class VehicleManager {
  constructor(scene, city, seed = 1) {
    this.scene = scene;
    this.city = city;
    this.rng = new Rng(seed);
    this.cars = [];
    this.police = [];
    this.van = null;
    this._spawnTraffic();
    this._spawnParked();
    this._spawnVan();
  }

  _addCar(car) {
    this.scene.add(car.mesh);
    this.cars.push(car);
    return car;
  }

  _spawnTraffic() {
    for (let i = 0; i < 12; i++) {
      const road = this.rng.chance(0.5) ? 'x' : 'z';
      const lane = this.rng.pick(WORLD.streets);
      const along = this.rng.range(-WORLD.half, WORLD.half);
      const dir = this.rng.chance(0.5) ? 1 : -1;
      const heading = road === 'x' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI);
      const x = road === 'x' ? along : lane + (dir > 0 ? 3 : -3);
      const z = road === 'x' ? lane + (dir > 0 ? 3 : -3) : along;
      const car = new Car({
        kind: 'civilian',
        color: this.rng.pick(CAR_COLORS),
        x, z, heading, road, lane, dir,
      });
      car.targetSpeed = CAR.trafficSpeed * this.rng.range(0.8, 1.2);
      this._addCar(car);
    }
    // Two taxis among the traffic.
    for (let i = 0; i < 2; i++) {
      const lane = this.rng.pick(WORLD.streets);
      const car = new Car({
        kind: 'taxi',
        color: TAXI_COLOR,
        x: this.rng.range(-80, 80), z: lane + 3,
        heading: Math.PI / 2, road: 'x', lane, dir: 1,
      });
      this._addCar(car);
    }
  }

  _spawnParked() {
    for (let i = 0; i < 10; i++) {
      const lane = this.rng.pick(WORLD.streets);
      const along = this.rng.range(-100, 100);
      const side = this.rng.chance(0.5) ? 1 : -1;
      const x = lane + side * 8;
      const z = along;
      const car = new Car({
        kind: 'civilian',
        color: this.rng.pick(CAR_COLORS),
        x, z, heading: side > 0 ? Math.PI / 2 : -Math.PI / 2, parked: true,
      });
      this._addCar(car);
    }
  }

  _spawnVan() {
    // The courier van waits at the marina for The Big Score.
    this.van = new Car({
      kind: 'van',
      color: VAN_COLOR,
      x: 52, z: 118, heading: Math.PI, parked: true,
    });
    this._addCar(this.van);
  }

  /** The nearest drivable car within range of a point (parked or traffic). */
  nearestCar(x, z, maxDist = 4.5) {
    let best = null;
    let bestD = maxDist;
    for (const c of this.cars) {
      if (this.police.includes(c)) continue;
      const d = dist2d(x, z, c.x, c.z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  /** Spawn (or reuse) police cars up to count, near the target but not on top of it. */
  ensurePolice(count, target) {
    while (this.police.length < count) {
      const a = this.rng.range(0, Math.PI * 2);
      const r = this.rng.range(28, 45);
      const car = new Car({
        kind: 'police',
        color: POLICE_COLOR,
        x: target.x + Math.cos(a) * r,
        z: target.z + Math.sin(a) * r,
        heading: 0,
      });
      this.scene.add(car.mesh);
      this.police.push(car);
      this.cars.push(car);
    }
    while (this.police.length > count) {
      const car = this.police.pop();
      this.scene.remove(car.mesh);
      this.cars = this.cars.filter((c) => c !== car);
    }
  }

  removePolice() {
    for (const car of this.police) {
      this.scene.remove(car.mesh);
      this.cars = this.cars.filter((c) => c !== car);
    }
    this.police = [];
  }

  update(dt, playerPos, policeTarget, time) {
    for (const c of this.cars) {
      if (this.police.includes(c)) continue;
      if (c.parked) continue;
      if (c.driven) continue; // the player is driving this one
      c.trafficStep(dt, this.city, playerPos);
    }
    for (const p of this.police) {
      if (policeTarget) p.policeStep(dt, this.city, policeTarget, time);
    }
  }
}
