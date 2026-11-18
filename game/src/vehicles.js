// SOLMAR HEAT — vehicles. A car is a low-poly box body with a cabin, four
// wheels and headlights. Traffic cars follow the road grid; police cars
// chase. The player's car uses the same factory.

import * as THREE from 'three';
import { CFG } from './config.js';

const CAR_COLORS = [
  0xc23b2e, 0x2e6ac2, 0x2ea66a, 0xd9a62e, 0x7a4fc2, 0xc2c2c2, 0x3a3f45, 0xe86a2e,
  0x4fc2c2, 0x8a2e5a,
];

export function makeCarMesh(color, kind = 'sedan') {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2530 });
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x16181a });
  const bodyLen = kind === 'van' ? 5.2 : 4.2;
  const bodyWid = 2.0;
  const body = new THREE.Mesh(new THREE.BoxGeometry(bodyLen, 0.85, bodyWid), bodyMat);
  body.position.y = 0.65;
  body.castShadow = true;
  g.add(body);
  const cabinLen = kind === 'van' ? 3.4 : 2.0;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(cabinLen, 0.75, 1.7), glassMat);
  cabin.position.set(kind === 'van' ? -0.4 : -0.3, 1.4, 0);
  cabin.castShadow = true;
  g.add(cabin);
  // Headlights (front is +X).
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  for (const s of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.25, 0.4), lightMat);
    h.position.set(bodyLen / 2, 0.65, s);
    g.add(h);
  }
  // Wheels.
  const wheels = [];
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  wheelGeo.rotateX(Math.PI / 2);
  for (const [wx, wz] of [
    [1.35, -0.95],
    [1.35, 0.95],
    [-1.35, -0.95],
    [-1.35, 0.95],
  ]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, 0.42, wz);
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.3, 0.6),
      new THREE.MeshBasicMaterial({ color: 0xffd21f }),
    );
    sign.position.set(-0.3, 1.95, 0);
    g.add(sign);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.7, 0.22, 0.5),
      new THREE.MeshBasicMaterial({ color: 0x2244ff }),
    );
    bar.position.set(-0.3, 1.9, 0);
    g.add(bar);
  }
  g.userData.wheels = wheels;
  g.userData.bodyLen = bodyLen;
  return g;
}

// A drivable car: position, heading, speed, steering. Arcade physics with
// a handbrake drift. Collides with buildings (via city.resolveCollisions)
// and stays inside the playable bounds.
export class Car {
  constructor(mesh, x, z, heading = 0) {
    this.mesh = mesh;
    this.x = x;
    this.z = z;
    this.heading = heading;
    this.speed = 0;
    this.steerAngle = 0;
    this.kind = 'sedan';
    this.isPlayer = false;
    this.busted = false;
  }
  get pos() {
    return { x: this.x, z: this.z };
  }
  update(dt, input, city) {
    const maxSpeed = this.kind === 'van' ? CFG.CAR_MAX_SPEED * 0.92 : CFG.CAR_MAX_SPEED;
    if (input) {
      const throttle = input.throttle;
      const steer = input.steer;
      const handbrake = input.handbrake;
      if (throttle > 0) this.speed += CFG.CAR_ACCEL * dt;
      else if (throttle < 0) {
        if (this.speed > 0.5) this.speed -= CFG.CAR_BRAKE * dt;
        else this.speed -= CFG.CAR_ACCEL * 0.5 * dt;
      } else {
        this.speed -= Math.sign(this.speed) * 8 * dt;
        if (Math.abs(this.speed) < 0.2) this.speed = 0;
      }
      this.speed = Math.max(-CFG.CAR_REVERSE_SPEED, Math.min(maxSpeed, this.speed));
      const steerTarget = steer * CFG.CAR_TURN * (handbrake ? 1.5 : 1);
      this.steerAngle += (steerTarget - this.steerAngle) * Math.min(1, dt * 8);
      const grip = handbrake ? CFG.CAR_DRIFT : 1;
      this.heading += (this.steerAngle * (this.speed / maxSpeed) * grip * (this.speed >= 0 ? 1 : -1)) * dt * 2.2;
    }
    const nx = this.x + Math.cos(this.heading) * this.speed * dt;
    const nz = this.z + Math.sin(this.heading) * this.speed * dt;
    const cl = city.clampToPlayable(nx, nz);
    const res = city.resolveCollisions(cl.x, cl.z, 1.6);
    // A building hit scrubs speed.
    if (Math.abs(res.x - nx) > 0.01 || Math.abs(res.z - nz) > 0.01) {
      this.speed *= 0.4;
    }
    this.x = res.x;
    this.z = res.z;
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = -this.heading;
    // Spin the wheels with speed.
    const spin = (this.speed * dt) / 0.42;
    for (const w of this.mesh.userData.wheels) w.rotation.z -= spin;
    return { x: this.x, z: this.z };
  }
}

// Traffic: cars that follow the road grid, turning at intersections.
export class Traffic {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cars = [];
    for (let i = 0; i < CFG.TRAFFIC_COUNT; i++) {
      this.spawnCar(true);
    }
  }
  _randomRoadSpot() {
    const road = this.city.roads[Math.floor(this.rng.f() * this.city.roads.length)];
    const lane = this.rng.chance(0.5) ? 3.2 : -3.2;
    const along = this.rng.range(-150, 150);
    if (road.axis === 'x') return { x: along, z: road.at + lane, heading: lane > 0 ? 0 : Math.PI, road };
    return { x: road.at + lane, z: along, heading: lane > 0 ? Math.PI / 2 : -Math.PI / 2, road };
  }
  spawnCar(anywhere = false) {
    const spot = this._randomRoadSpot();
    const color = CAR_COLORS[Math.floor(this.rng.f() * CAR_COLORS.length)];
    const mesh = makeCarMesh(color, 'sedan');
    this.scene.add(mesh);
    const car = new Car(mesh, spot.x, spot.z, spot.heading);
    car.speed = this.rng.range(8, 14);
    car.road = spot.road;
    car.dir = 1;
    this.cars.push(car);
    return car;
  }
  // Parked cars the player can steal (placed beside roads, not moving).
  spawnParked(count, near = null) {
    const out = [];
    for (let i = 0; i < count; i++) {
      const spot = this._randomRoadSpot();
      // Park on the roadside: pull off the lane a little.
      const color = CAR_COLORS[Math.floor(this.rng.f() * CAR_COLORS.length)];
      const mesh = makeCarMesh(color, this.rng.chance(0.2) ? 'taxi' : 'sedan');
      this.scene.add(mesh);
      const car = new Car(mesh, spot.x, spot.z, spot.heading);
      car.speed = 0;
      car.parked = true;
      car.kind = mesh.userData.bodyLen > 4.6 ? 'van' : 'sedan';
      if (mesh.children.length > 0 && car.kind === 'sedan' && this.rng.chance(0.15)) {
        // leave as-is; taxi sign is cosmetic only
      }
      this.cars.push(car);
      out.push(car);
    }
    return out;
  }
  update(dt) {
    for (const car of this.cars) {
      if (car.parked || car.isPlayer || !car.road) continue;
      // Drive along the current road.
      const road = car.road;
      const speed = car.speed;
      let nx = car.x;
      let nz = car.z;
      if (road.axis === 'x') {
        nx += Math.cos(car.heading) * speed * dt;
        nz = road.at + (car.heading === 0 ? 3.2 : -3.2);
      } else {
        nz += Math.sin(car.heading) * speed * dt;
        nx = road.at + (car.heading === Math.PI / 2 ? 3.2 : -3.2);
      }
      const cl = this.city.clampToPlayable(nx, nz);
      // At an intersection (near a crossing road) sometimes turn.
      const atCrossing =
        road.axis === 'x'
          ? this.city.roads.some((r) => r.axis === 'z' && Math.abs(cl.x - r.at) < 4)
          : this.city.roads.some((r) => r.axis === 'x' && Math.abs(cl.z - r.at) < 4);
      if (atCrossing && this.rng.chance(0.02)) {
        const cross = this.city.roads.filter((r) => r.axis !== road.axis);
        const nr = cross[Math.floor(this.rng.f() * cross.length)];
        car.road = nr;
        if (nr.axis === 'z') {
          car.heading = this.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2;
          car.x = nr.at + (car.heading === Math.PI / 2 ? 3.2 : -3.2);
        } else {
          car.heading = this.rng.chance(0.5) ? 0 : Math.PI;
          car.z = nr.at + (car.heading === 0 ? 3.2 : -3.2);
        }
      } else {
        // Bounce at the city edge: turn around.
        if (Math.abs(cl.x) >= 163 || Math.abs(cl.z) >= 163) {
          car.heading += Math.PI;
        }
        car.x = cl.x;
        car.z = cl.z;
      }
      const res = this.city.resolveCollisions(car.x, car.z, 1.6);
      car.x = res.x;
      car.z = res.z;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = -car.heading;
      const spin = (speed * dt) / 0.42;
      for (const w of car.mesh.userData.wheels) w.rotation.z -= spin;
    }
  }
}
