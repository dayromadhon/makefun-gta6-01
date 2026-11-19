// SOLMAR HEAT — vehicles: car factory plus traffic and police driving.
// A car is a THREE.Group with a small physics state; the player drives one,
// traffic follows road loops, police chase the player.
import * as THREE from 'three';
import { CFG, COLORS } from './config.js';

function makeCarMesh(color, opts = {}) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.75, 4.4), paint);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.65, 2.2), glass);
  cabin.position.set(0, 1.2, -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheelPos = [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]];
  const wheels = [];
  for (const [wx, wz] of wheelPos) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.36, wz);
    g.add(w);
    wheels.push(w);
  }
  const lightMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0x887733 });
  for (const sx of [-0.6, 0.6]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), lightMat);
    l.position.set(sx, 0.6, 2.22);
    g.add(l);
  }
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xcc2222, emissive: 0x550000 });
  for (const sx of [-0.6, 0.6]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.18, 0.1), tailMat);
    t.position.set(sx, 0.6, -2.22);
    g.add(t);
  }
  if (opts.police) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.22, 0.5),
      new THREE.MeshLambertMaterial({ color: 0x2233cc, emissive: 0x2233cc }),
    );
    bar.position.set(0, 1.62, -0.2);
    g.add(bar);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.02, 0.3, 4.42),
      new THREE.MeshLambertMaterial({ color: 0x1133aa }),
    );
    stripe.position.y = 0.75;
    g.add(stripe);
  }
  if (opts.taxi) {
    const sign = new THREE.Mesh(
      new THREE.BoxGeometry(0.9, 0.22, 0.4),
      new THREE.MeshLambertMaterial({ color: 0xf2c200, emissive: 0x664400 }),
    );
    sign.position.set(0, 1.62, -0.2);
    g.add(sign);
  }
  if (opts.van) {
    body.scale.set(1.15, 1.5, 1.25);
    body.position.y = 0.9;
    cabin.position.set(0, 1.9, 0.9);
    cabin.scale.set(1.1, 1.3, 1);
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(2.32, 0.35, 5.52),
      new THREE.MeshLambertMaterial({ color: 0x2e6fc2 }),
    );
    stripe.position.y = 1.1;
    g.add(stripe);
  }
  return { group: g, wheels };
}

export class VehicleManager {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.cars = [];
    this.traffic = [];
    this.police = [];
    this.parked = [];
  }

  spawnCar(x, z, heading, color, opts = {}) {
    const { group, wheels } = makeCarMesh(color, opts);
    group.position.set(x, 0, z);
    group.rotation.y = heading;
    this.scene.add(group);
    const car = {
      group, wheels, heading, speed: 0, health: 100,
      x, z, color, isPolice: !!opts.police, isTaxi: !!opts.taxi, isVan: !!opts.van,
      isTraffic: !!opts.traffic, isParked: !!opts.parked, isPlayer: false,
      route: null, routeIdx: 0, stuck: 0, smoke: null,
    };
    this.cars.push(car);
    if (car.isTraffic) this.traffic.push(car);
    if (car.isPolice) this.police.push(car);
    if (car.isParked) this.parked.push(car);
    return car;
  }

  spawnTraffic(n) {
    for (let i = 0; i < n; i++) {
      const p = this.city.randomRoadPoint();
      const vertical = Math.abs(p.x % CFG.pitch) < 1;
      const heading = vertical ? (this.rng.chance(0.5) ? 0 : Math.PI) : (this.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
      const car = this.spawnCar(p.x, p.z, heading, this.rng.pick(COLORS.carPaint), { traffic: true });
      car.speed = CFG.trafficSpeed * this.rng.range(0.8, 1.15);
      car.route = this._loopRoute(p.x, p.z);
      car.routeIdx = 0;
    }
  }

  spawnParked(n) {
    for (let i = 0; i < n; i++) {
      const p = this.city.randomRoadPoint();
      const vertical = Math.abs(p.x % CFG.pitch) < 1;
      const off = 4.2;
      const x = vertical ? p.x + (this.rng.chance(0.5) ? off : -off) : p.x;
      const z = vertical ? p.z : p.z + (this.rng.chance(0.5) ? off : -off);
      const heading = vertical ? (this.rng.chance(0.5) ? 0 : Math.PI) : (this.rng.chance(0.5) ? Math.PI / 2 : -Math.PI / 2);
      this.spawnCar(x, z, heading, this.rng.pick(COLORS.carPaint), { parked: true });
    }
  }

  spawnTaxi(x, z) {
    return this.spawnCar(x, z, 0, COLORS.taxi, { taxi: true });
  }

  spawnVan(x, z) {
    return this.spawnCar(x, z, Math.PI / 2, COLORS.van, { van: true, parked: true });
  }

  spawnPolice(x, z) {
    const car = this.spawnCar(x, z, 0, COLORS.police, { police: true });
    car.speed = 0;
    return car;
  }

  // A rectangular loop around the block the point sits on.
  _loopRoute(x, z) {
    const P = CFG.pitch;
    const gx = Math.round((x + CFG.half) / P);
    const gz = Math.round((z + CFG.half) / P);
    const x0 = this.city.roadCenter(Math.max(0, Math.min(CFG.blocks, gx - 1)));
    const x1 = this.city.roadCenter(Math.max(0, Math.min(CFG.blocks, gx)));
    const z0 = this.city.roadCenter(Math.max(0, Math.min(CFG.blocks, gz - 1)));
    const z1 = this.city.roadCenter(Math.max(0, Math.min(CFG.blocks, gz)));
    return [
      { x: x0, z: z0 }, { x: x1, z: z0 }, { x: x1, z: z1 }, { x: x0, z: z1 },
    ];
  }

  nearestCar(x, z, maxDist, filter) {
    let best = null;
    let bestD = maxDist;
    for (const c of this.cars) {
      if (filter && !filter(c)) continue;
      const dx = c.x - x;
      const dz = c.z - z;
      const d = Math.hypot(dx, dz);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  removeCar(car) {
    this.scene.remove(car.group);
    for (const list of [this.cars, this.traffic, this.police, this.parked]) {
      const i = list.indexOf(car);
      if (i !== -1) list.splice(i, 1);
    }
  }

  _steerToward(car, tx, tz, dt, maxSpeed) {
    const dx = tx - car.x;
    const dz = tz - car.z;
    const want = Math.atan2(dx, dz);
    let diff = want - car.heading;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
    car.speed = Math.min(maxSpeed, car.speed + 10 * dt);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
  }

  update(dt, player) {
    // Traffic follows its loop, slowing for the car ahead.
    for (const car of this.traffic) {
      if (!car.route) continue;
      const wp = car.route[car.routeIdx];
      const dx = wp.x - car.x;
      const dz = wp.z - car.z;
      if (Math.hypot(dx, dz) < 4) {
        car.routeIdx = (car.routeIdx + 1) % car.route.length;
        continue;
      }
      let blocked = false;
      for (const other of this.cars) {
        if (other === car || other.isPlayer) continue;
        const ox = other.x - car.x;
        const oz = other.z - car.z;
        const ahead = ox * Math.sin(car.heading) + oz * Math.cos(car.heading);
        const side = Math.abs(ox * Math.cos(car.heading) - oz * Math.sin(car.heading));
        if (ahead > 0 && ahead < 8 && side < 2.5) {
          blocked = true;
          break;
        }
      }
      const target = blocked ? 0 : CFG.trafficSpeed;
      car.speed += Math.max(-12 * dt, Math.min(8 * dt, target - car.speed));
      this._steerToward(car, wp.x, wp.z, dt, Math.max(car.speed, 1));
    }
    // Police chase the player (on foot or in a car).
    const px = player.x;
    const pz = player.z;
    for (const car of this.police) {
      if (car.health <= 0) continue;
      car.ramCooldown = Math.max(0, (car.ramCooldown || 0) - dt);
      this._steerToward(car, px, pz, dt, CFG.copCarSpeed);
      const d = Math.hypot(px - car.x, pz - car.z);
      if (d < 3.4 && car.ramCooldown <= 0) {
        // Ram: shove the player and damage whatever they are in. A ram
        // costs the cop a moment to recover, so it cannot machine-gun.
        car.ramCooldown = 1.5;
        const push = 9 * dt;
        const ang = Math.atan2(px - car.x, pz - car.z);
        player.applyRam(Math.sin(ang) * push, Math.cos(ang) * push, 6);
        car.speed *= 0.4;
      }
    }
    // Write transforms back.
    for (const car of this.cars) {
      car.group.position.set(car.x, 0, car.z);
      car.group.rotation.y = car.heading;
      const spin = car.speed * dt * 2.4;
      for (const w of car.wheels) w.rotation.x += spin;
    }
  }
}
