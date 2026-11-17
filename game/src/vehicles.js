// Cars: the mesh factory (box-built bodies, cabins, wheels, lights), arcade driving
// physics, the traffic cars that loop the blocks, and the police cars that chase the
// player. No physics library — a bicycle-ish arcade model with speed-scaled steering.

import * as THREE from 'three';
import { CAR, CITY } from './config.js';

const CAR_COLORS = [0xc0392b, 0x2980b9, 0xf1c40f, 0x27ae60, 0xe67e22, 0x8e44ad, 0xecf0f1, 0x2c3e50, 0x16a085, 0xd35400];
const TAXI_YELLOW = 0xf7c948;

function makeCarMesh(color, kind) {
  const group = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1c2733, emissive: 0x0a141c });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1a1d22 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(CAR.width, 0.72, CAR.length), paint);
  body.position.y = 0.62;
  body.castShadow = true;
  group.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(CAR.width - 0.34, 0.6, CAR.length * 0.48), glass);
  cabin.position.set(0, 1.26, -0.2);
  cabin.castShadow = true;
  group.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-0.92, 1.45], [0.92, 1.45], [-0.92, -1.45], [0.92, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, dark);
    wheel.position.set(wx, 0.36, wz);
    wheel.castShadow = true;
    group.add(wheel);
    wheels.push(wheel);
  }
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xfff6c9 });
  for (const lx of [-0.6, 0.6]) {
    const light = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), lightMat);
    light.position.set(lx, 0.66, CAR.length / 2 + 0.02);
    group.add(light);
  }
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff2d2d });
  for (const lx of [-0.6, 0.6]) {
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), tailMat);
    tail.position.set(lx, 0.66, -CAR.length / 2 - 0.02);
    group.add(tail);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 0.4), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    sign.position.set(0, 1.68, -0.2);
    group.add(sign);
  }
  if (kind === 'van') {
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(CAR.width - 0.1, 1.15, CAR.length * 0.6), paint);
    cargo.position.set(0, 1.32, -0.75);
    cargo.castShadow = true;
    group.add(cargo);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(CAR.width + 0.04, 0.2, CAR.length * 0.62), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    stripe.position.set(0, 0.85, -0.75);
    group.add(stripe);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.4), dark);
    bar.position.set(0, 1.66, -0.2);
    group.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.42), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
    red.position.set(-0.28, 1.68, -0.2);
    group.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.2, 0.42), new THREE.MeshBasicMaterial({ color: 0x2266ff }));
    blue.position.set(0.28, 1.68, -0.2);
    group.add(blue);
    group.userData.redLight = red;
    group.userData.blueLight = blue;
  }
  group.userData.wheels = wheels;
  return group;
}

function angleLerp(a, b, t) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function createCar(kind, color, x, z, heading) {
  const mesh = makeCarMesh(color, kind);
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;
  return {
    kind,
    mesh,
    x,
    z,
    heading,
    speed: 0,
    health: CAR.maxHealth,
    steering: 0,
    hitCooldown: 0, // seconds until this car can take contact damage again
    driver: null, // 'player' | 'traffic' | 'police' | null (parked)
    route: null,
    routeIndex: 0,
    occupied: kind === 'taxi',
    sirenPhase: Math.random() * 2,
  };
}

export function createVehicles(scene, city, random) {
  const cars = [];
  const group = new THREE.Group();
  scene.add(group);

  function add(car) {
    cars.push(car);
    group.add(car.mesh);
    return car;
  }

  function spawnTrafficCar() {
    const bx = random.pick([-126, -42, 42, 126]);
    const bz = random.pick([-126, -42, 42, 126]);
    const clockwise = random.chance(0.5);
    const loop = city.blockLoop(bx, bz, clockwise);
    const start = loop[0];
    const heading = Math.atan2(loop[1].x - start.x, loop[1].z - start.z);
    const car = createCar(random.chance(0.14) ? 'taxi' : 'sedan', random.pick(CAR_COLORS), start.x, start.z, heading);
    car.driver = 'traffic';
    car.route = loop;
    car.routeIndex = 1;
    car.speed = random.range(7, 11);
    return add(car);
  }

  function spawnPoliceCar(x, z) {
    const car = createCar('police', 0x11151a, x, z, 0);
    car.driver = 'police';
    car.speed = 0;
    return add(car);
  }

  function spawnParkedCar(x, z, heading) {
    const car = createCar('sedan', random.pick(CAR_COLORS), x, z, heading);
    car.driver = null;
    return add(car);
  }

  // Parked cars along the avenues for the player to steal.
  for (let i = 0; i < 8; i += 1) {
    const point = city.randomRoadPoint();
    const onVertical = Math.abs(point.x - Math.round(point.x / 84) * 84) < 1;
    spawnParkedCar(point.x + (onVertical ? 5 : 0), point.z + (onVertical ? 0 : 5), onVertical ? 0 : Math.PI / 2);
  }

  function syncMesh(car) {
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    const spin = car.speed * 0.12;
    for (const wheel of car.mesh.userData.wheels) wheel.rotation.x += spin * 0.016;
  }

  function drivePlayer(car, input, dt, city) {
    const { forward, strafe } = input.axes();
    const handbrake = input.handbrake();
    const targetSteer = strafe * CAR.steer * Math.max(0.35, 1 - Math.abs(car.speed) / (CAR.maxSpeed * 1.6));
    car.steering += (targetSteer - car.steering) * Math.min(1, dt * 8);
    if (forward > 0) car.speed += CAR.accel * dt;
    else if (forward < 0) {
      if (car.speed > 0.5) car.speed -= CAR.brake * dt;
      else car.speed -= CAR.reverseAccel * dt;
    } else {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 9 * dt);
    }
    if (handbrake) {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 26 * dt);
      car.heading += car.steering * 1.7 * Math.sign(car.speed) * dt;
    } else {
      car.heading += car.steering * (car.speed / CAR.maxSpeed) * dt * 2.2;
    }
    car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
    return moveCar(car, dt, city);
  }

  function moveCar(car, dt, city) {
    const nx = car.x + Math.sin(car.heading) * car.speed * dt;
    const nz = car.z + Math.cos(car.heading) * car.speed * dt;
    // A car pushed into a wall (by another car ramming it) would wedge forever if
    // every move kept colliding, so a car that is already inside the wall's margin
    // gets a smaller radius — enough to steer or reverse back out.
    const alreadyInside = city.collideCircle(car.x, car.z, 1.6);
    const radius = alreadyInside ? 1.0 : 1.6;
    const hit = city.collideCircle(nx, nz, radius);
    if (hit) {
      // Slide along the wall instead of wedging: try each axis alone first.
      if (!city.collideCircle(nx, car.z, radius)) {
        car.x = nx;
        car.speed *= 0.85;
        return { crashed: false, strength: 0 };
      }
      if (!city.collideCircle(car.x, nz, radius)) {
        car.z = nz;
        car.speed *= 0.85;
        return { crashed: false, strength: 0 };
      }
      const impact = Math.abs(car.speed);
      car.speed *= -0.25;
      if (impact > 8) {
        car.health -= (impact - 8) * 1.6;
        return { crashed: true, strength: Math.min(1, impact / 30) };
      }
      return { crashed: false, strength: 0 };
    }
    const clamped = city.clampToCity(nx, nz, 0);
    car.x = clamped.x;
    car.z = clamped.z;
    if (clamped.x !== nx || clamped.z !== nz) car.speed *= 0.4;
    return { crashed: false, strength: 0 };
  }

  function driveTraffic(car, dt, city) {
    const target = car.route[car.routeIndex];
    const dx = target.x - car.x;
    const dz = target.z - car.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 4) {
      car.routeIndex = (car.routeIndex + 1) % car.route.length;
      return;
    }
    const wanted = Math.atan2(dx, dz);
    car.heading = angleLerp(car.heading, wanted, Math.min(1, dt * 2.4));
    // Slow down for the car ahead.
    let ahead = null;
    for (const other of cars) {
      if (other === car || other.driver === null) continue;
      const ox = other.x - car.x;
      const oz = other.z - car.z;
      const along = ox * Math.sin(car.heading) + oz * Math.cos(car.heading);
      const side = Math.abs(ox * Math.cos(car.heading) - oz * Math.sin(car.heading));
      if (along > 0 && along < 9 && side < 2.4) {
        ahead = other;
        break;
      }
    }
    const targetSpeed = ahead ? 0 : 10;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.5);
    car.x += Math.sin(car.heading) * car.speed * dt;
    car.z += Math.cos(car.heading) * car.speed * dt;
  }

  function drivePolice(car, targetX, targetZ, dt, city) {
    const dx = targetX - car.x;
    const dz = targetZ - car.z;
    const dist = Math.hypot(dx, dz);
    const wanted = Math.atan2(dx, dz);
    const steerAmount = Math.min(1, dt * 3.2);
    car.heading = angleLerp(car.heading, wanted, steerAmount);
    const targetSpeed = dist > 26 ? 34 : dist > 8 ? 26 : 14;
    car.speed += (targetSpeed - car.speed) * Math.min(1, dt * 1.2);
    const result = moveCar(car, dt, city);
    car.sirenPhase += dt * 6;
    const on = Math.sin(car.sirenPhase) > 0;
    if (car.mesh.userData.redLight) {
      car.mesh.userData.redLight.material.color.setHex(on ? 0xff2222 : 0x550000);
      car.mesh.userData.blueLight.material.color.setHex(on ? 0x000088 : 0x2266ff);
    }
    return result;
  }

  function separateCars(dt) {
    for (const car of cars) car.hitCooldown = Math.max(0, (car.hitCooldown ?? 0) - dt);
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) {
        const a = cars[i];
        const b = cars[j];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const dist = Math.hypot(dx, dz);
        if (dist > 0.01 && dist < 4.2) {
          const push = (4.2 - dist) / 2;
          const nx = dx / dist;
          const nz = dz / dist;
          // Never shove a car into a building: a rammer pushing the player car
          // used to wedge it metres deep inside a block, where no move could
          // ever get it out again. Each side moves only if its landing spot is
          // clear of walls; the other side takes the full push instead.
          const aHalf = { x: a.x - nx * push, z: a.z - nz * push };
          const bHalf = { x: b.x + nx * push, z: b.z + nz * push };
          const aFull = { x: a.x - nx * push * 2, z: a.z - nz * push * 2 };
          const bFull = { x: b.x + nx * push * 2, z: b.z + nz * push * 2 };
          const free = (p) => !city.collideCircle(p.x, p.z, 1.2);
          const aHalfOk = free(aHalf);
          const bHalfOk = free(bHalf);
          if (aHalfOk && bHalfOk) {
            a.x = aHalf.x; a.z = aHalf.z; b.x = bHalf.x; b.z = bHalf.z;
          } else if (aHalfOk && free(bFull)) {
            a.x = aHalf.x; a.z = aHalf.z; b.x = bFull.x; b.z = bFull.z;
          } else if (bHalfOk && free(aFull)) {
            b.x = bHalf.x; b.z = bHalf.z; a.x = aFull.x; a.z = aFull.z;
          } else if (aHalfOk) {
            a.x = aHalf.x; a.z = aHalf.z;
          } else if (bHalfOk) {
            b.x = bHalf.x; b.z = bHalf.z;
          }
          // Contact damage, at most one hit per car per half second: without the
          // cooldown a car pinned against a wall by a rammer lost 2 health per
          // frame and blew up in under a second.
          const impact = Math.abs(a.speed - b.speed);
          if (impact > 6 && a.hitCooldown <= 0 && b.hitCooldown <= 0) {
            a.health -= 2;
            b.health -= 2;
            a.hitCooldown = 0.5;
            b.hitCooldown = 0.5;
          }
        }
      }
    }
  }

  function update(dt, player, city, events) {
    for (const car of cars) {
      if (car.driver === 'traffic') driveTraffic(car, dt, city);
      else if (car.driver === 'police' && player) {
        const result = drivePolice(car, player.x, player.z, dt, city);
        if (result && result.crashed && events) events.onCrash(result.strength, car);
      }
      syncMesh(car);
    }
    separateCars(dt);
    for (const car of cars) syncMesh(car);
  }

  function nearestCar(x, z, maxDist, filter) {
    let best = null;
    let bestDist = maxDist;
    for (const car of cars) {
      if (filter && !filter(car)) continue;
      const dist = Math.hypot(car.x - x, car.z - z);
      if (dist < bestDist) {
        bestDist = dist;
        best = car;
      }
    }
    return best;
  }

  function remove(car) {
    const index = cars.indexOf(car);
    if (index !== -1) cars.splice(index, 1);
    group.remove(car.mesh);
  }

  return {
    cars,
    add,
    spawnTrafficCar,
    spawnPoliceCar,
    spawnParkedCar,
    drivePlayer,
    update,
    nearestCar,
    remove,
    syncMesh,
  };
}
