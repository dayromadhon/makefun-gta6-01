// Solmar Heat — cars: traffic, parked cars, police interceptors, and the
// player's arcade driving model. One job: everything with four wheels.

import { WORLD, COLORS, TUNE } from './config.js';
import { mulberry32, range, pick } from './random.js';

const THREE = window.THREE;
const CAR_R = 2.1; // collision radius

export function makeCarMesh(kind, color) {
  const g = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const dark = new THREE.MeshLambertMaterial({ color: 0x1c2733 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.2), paint);
  body.position.y = 0.55;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, 0.6, kind === 'van' ? 3.4 : 2.1),
    kind === 'van' ? paint : dark,
  );
  cabin.position.set(0, 1.12, kind === 'van' ? -0.2 : -0.25);
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x14161a });
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.38, wz);
    g.add(w);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.28, 0.4), new THREE.MeshLambertMaterial({ color: COLORS.taxiYellow }));
    sign.position.set(0, 1.6, -0.25);
    g.add(sign);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.18, 0.5), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    bar.position.set(0, 1.5, -0.25);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.16, 0.5), new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0x881111 }));
    red.position.set(-0.3, 1.6, -0.25);
    g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.16, 0.5), new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x111188 }));
    blue.position.set(0.3, 1.6, -0.25);
    g.add(blue);
  }
  g.userData.kind = kind;
  return g;
}

function forward(heading) {
  return { x: Math.sin(heading), z: Math.cos(heading) };
}

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

export function createVehicles(scene, city, seed) {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  scene.add(group);
  const all = []; // every car: traffic, parked, police, player
  const traffic = [];
  const parked = [];
  const police = [];
  let playerCar = null;

  function addCar(kind, color, x, z, heading) {
    const mesh = makeCarMesh(kind, color);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    group.add(mesh);
    const car = {
      kind, color, mesh, x, z, heading,
      speed: 0, steer: 0, health: 100, wrecked: false, ramTimer: 0,
      isTraffic: false, isParked: false, isPolice: false, isPlayer: false,
      route: null, routeIndex: 0, wait: 0, targetSpeed: TUNE.trafficSpeed,
    };
    all.push(car);
    return car;
  }

  // --- traffic: cars looping the street lattice ---------------------------
  function randomIntersection() {
    return { x: pick(rng, WORLD.streets), z: pick(rng, WORLD.streets) };
  }
  function nextRoutePoint(car) {
    // pick a neighbouring intersection (one street over), never a U-turn
    const cur = car.route[car.routeIndex];
    const opts = [];
    for (const dx of [-40, 40]) {
      const nx = cur.x + dx;
      if (nx >= -80 && nx <= 80) opts.push({ x: nx, z: cur.z });
    }
    for (const dz of [-40, 40]) {
      const nz = cur.z + dz;
      if (nz >= -80 && nz <= 80) opts.push({ x: cur.x, z: nz });
    }
    const prev = car.route[car.routeIndex - 1];
    const filtered = opts.filter((o) => !prev || o.x !== prev.x || o.z !== prev.z);
    return (filtered.length ? pick(rng, filtered) : pick(rng, opts));
  }
  function spawnTraffic(count) {
    for (let i = 0; i < count; i++) {
      const p = randomIntersection();
      const heading = pick(rng, [0, Math.PI / 2, Math.PI, -Math.PI / 2]);
      const car = addCar(pick(rng, ['sedan', 'sedan', 'taxi']), pick(rng, COLORS.carPaint), p.x, p.z, heading);
      car.isTraffic = true;
      car.speed = range(rng, 6, 10);
      car.route = [p, nextRoutePoint({ route: [p], routeIndex: 0 })];
      car.routeIndex = 1;
      traffic.push(car);
    }
  }

  // --- parked cars ----------------------------------------------------------
  function parkCar(kind, color, x, z, heading, missionId) {
    const car = addCar(kind, color, x, z, heading);
    car.isParked = true;
    car.missionId = missionId || null;
    parked.push(car);
    return car;
  }
  function spawnParked() {
    const spots = [
      [-40, 74, 0], [20, -74, Math.PI], [60, 46, Math.PI / 2], [-20, -46, -Math.PI / 2],
      [40, 74, 0], [-60, -74, Math.PI], [74, -20, -Math.PI / 2], [-74, 20, Math.PI / 2],
      [0, 46, 0], [-46, -20, Math.PI],
    ];
    for (const [x, z, h] of spots) parkCar('sedan', pick(rng, COLORS.carPaint), x, z, h);
    // mission cars (marked): the sedan for First Wheels, the van for Big Score
    parkCar('sedan', 0xc23b2e, -40, 80, 0, 'first-wheels');
    parkCar('van', 0xe8e4da, 104, -20, Math.PI / 2, 'big-score');
  }

  // --- police ---------------------------------------------------------------
  function spawnPolice(x, z) {
    let car = police.find((c) => !c.active);
    if (!car) {
      if (police.length >= 5) return null;
      car = addCar('police', COLORS.policeWhite, x, z, 0);
      car.isPolice = true;
      car.active = false;
      police.push(car);
    }
    car.active = true;
    car.x = x;
    car.z = z;
    car.speed = 6;
    car.health = 100;
    car.wrecked = false;
    car.mesh.visible = true;
    return car;
  }
  function releasePolice(car) {
    car.active = false;
    car.mesh.visible = false;
  }

  // --- player car -----------------------------------------------------------
  function setPlayerCar(car) {
    playerCar = car;
    car.isPlayer = true;
    car.isParked = false;
    const i = parked.indexOf(car);
    if (i >= 0) parked.splice(i, 1);
  }

  function drivePlayer(dt, input, onCrash) {
    const car = playerCar;
    if (!car || car.wrecked) return;
    const axis = input.moveAxis();
    const handbrake = input.down('Space');
    // throttle / brake / reverse
    if (axis.y > 0) car.speed += TUNE.carAccel * dt;
    else if (axis.y < 0) {
      if (car.speed > 0.5) car.speed -= TUNE.carBrake * dt;
      else car.speed -= TUNE.carReverseAccel * dt;
    } else {
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 6 * dt);
    }
    const offRoad = !city.isRoad(car.x, car.z);
    const maxSpeed = offRoad ? TUNE.carMaxSpeed * 0.45 : TUNE.carMaxSpeed;
    const maxReverse = TUNE.carMaxReverse;
    car.speed = Math.max(-maxReverse, Math.min(maxSpeed, car.speed));
    if (handbrake) car.speed *= Math.max(0, 1 - 0.9 * dt);
    // steering: less bite at speed, more with the handbrake
    const steerTarget = axis.x * TUNE.steerMax * (1 - Math.min(Math.abs(car.speed) * TUNE.steerSpeedFalloff, 0.7));
    const steerRate = handbrake ? 6 : 4;
    car.steer += (steerTarget - car.steer) * Math.min(1, steerRate * dt);
    const grip = handbrake ? TUNE.handbrakeGrip : 1;
    car.heading += (car.speed / 4.5) * Math.tan(car.steer) * dt * (grip < 1 ? 1.6 : 1);
    const f = forward(car.heading);
    const prevX = car.x;
    const prevZ = car.z;
    car.x += f.x * car.speed * dt;
    car.z += f.z * car.speed * dt;
    // soft city bounds
    car.x = Math.max(-132, Math.min(132, car.x));
    car.z = Math.max(-100, Math.min(132, car.z));
    const res = city.resolveCircle(car.x, car.z, CAR_R);
    if (res.hit) {
      const impact = Math.abs(car.speed);
      car.x = res.x;
      car.z = res.z;
      car.speed *= 0.35;
      if (impact > 8 && onCrash) onCrash(impact, car.x, car.z);
      if (impact > 14) car.health -= (impact - 14) * 2;
      if (car.health <= 0) car.wrecked = true;
    }
    car.drift = handbrake && Math.abs(car.speed) > 6 ? car.steer * 0.5 : 0;
    void prevX;
    void prevZ;
  }

  function driveTraffic(dt, ctx) {
    for (const car of traffic) {
      if (car.wrecked) continue;
      const target = car.route[car.routeIndex];
      const dx = target.x - car.x;
      const dz = target.z - car.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 4) {
        car.route.push(nextRoutePoint(car));
        car.routeIndex++;
        if (car.route.length > 6) {
          // drop the visited prefix, keeping the just-reached point (used as
          // the no-U-turn reference) and the current target
          const drop = car.routeIndex - 1;
          car.route.splice(0, drop);
          car.routeIndex = 1;
        }
        continue;
      }
      const want = Math.atan2(dx, dz);
      const diff = wrapAngle(want - car.heading);
      car.heading += Math.max(-1.6 * dt, Math.min(1.6 * dt, diff));
      // slow for a car ahead
      let blocked = false;
      for (const other of all) {
        if (other === car || other.wrecked || other.isParked && false) continue;
        const ox = other.x - car.x;
        const oz = other.z - car.z;
        const od = Math.hypot(ox, oz);
        if (od < 7 && od > 0.1) {
          const f = forward(car.heading);
          if ((ox * f.x + oz * f.z) / od > 0.7) {
            blocked = true;
            break;
          }
        }
      }
      const targetSpeed = blocked ? 0 : car.targetSpeed;
      car.speed += (targetSpeed - car.speed) * Math.min(1, 1.5 * dt);
      const f = forward(car.heading);
      car.x += f.x * car.speed * dt;
      car.z += f.z * car.speed * dt;
      // police never drive into the sea or off the map's east edge
      car.x = Math.max(-132, Math.min(132, car.x));
      car.z = Math.max(-100, Math.min(132, car.z));
      const res = city.resolveCircle(car.x, car.z, CAR_R);
      if (res.hit) {
        car.x = res.x;
        car.z = res.z;
        car.speed *= 0.5;
      }
    }
  }

  function drivePolice(dt, ctx) {
    const px = ctx.player.x;
    const pz = ctx.player.z;
    for (const car of police) {
      if (!car.active || car.wrecked) continue;
      const dx = px - car.x;
      const dz = pz - car.z;
      const dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);
      const diff = wrapAngle(want - car.heading);
      car.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, diff));
      const targetSpeed = dist > 10 ? TUNE.policeCarSpeed : TUNE.policeCarSpeed * 0.6;
      car.speed += (targetSpeed - car.speed) * Math.min(1, 2 * dt);
      const f = forward(car.heading);
      car.x += f.x * car.speed * dt;
      car.z += f.z * car.speed * dt;
      // police never drive into the sea or off the map's east edge
      car.x = Math.max(-132, Math.min(132, car.x));
      car.z = Math.max(-100, Math.min(132, car.z));
      const res = city.resolveCircle(car.x, car.z, CAR_R);
      if (res.hit) {
        car.x = res.x;
        car.z = res.z;
        car.speed *= 0.5;
      }
      // ramming the player's car: shove it and hurt it — but at most once
      // a second, or a chase wrecks the car in the blink of an eye
      car.ramTimer = Math.max(0, (car.ramTimer || 0) - dt);
      if (playerCar && !playerCar.wrecked) {
        const pdx = playerCar.x - car.x;
        const pdz = playerCar.z - car.z;
        const pd = Math.hypot(pdx, pdz);
        if (pd < CAR_R * 2 + 0.4 && car.speed > 4 && car.ramTimer <= 0) {
          car.ramTimer = 1.2;
          const push = (CAR_R * 2 + 0.4 - pd) / Math.max(pd, 0.01);
          playerCar.x += pdx * push * 0.5;
          playerCar.z += pdz * push * 0.5;
          playerCar.health -= 4;
          if (ctx.effects) ctx.effects.sparks(playerCar.x, 1, playerCar.z, 6);
          if (playerCar.health <= 0) playerCar.wrecked = true;
        }
      }
    }
  }

  function separateCars() {
    for (let i = 0; i < all.length; i++) {
      const a = all[i];
      if (a.wrecked || a.isParked) continue;
      for (let j = i + 1; j < all.length; j++) {
        const b = all[j];
        if (b.wrecked || b.isParked) continue;
        if (a.isTraffic && b.isTraffic) continue; // traffic keeps its lane
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const d = Math.hypot(dx, dz);
        const min = CAR_R * 2;
        if (d < min && d > 0.01) {
          const push = (min - d) / d * 0.5;
          a.x -= dx * push;
          a.z -= dz * push;
          b.x += dx * push;
          b.z += dz * push;
        }
      }
    }
  }

  function syncMeshes() {
    for (const car of all) {
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading + (car.drift || 0);
      car.mesh.visible = !car.isPolice || car.active;
      if (car.wrecked) car.mesh.rotation.z = 0.12;
    }
  }

  function nearestParked(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of parked) {
      const d = Math.hypot(car.x - x, car.z - z);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function missionCar(missionId) {
    return parked.find((c) => c.missionId === missionId) || null;
  }

  return {
    all, traffic, parked, police,
    get playerCar() {
      return playerCar;
    },
    spawnTraffic, spawnParked, spawnPolice, releasePolice,
    setPlayerCar, drivePlayer, driveTraffic, drivePolice, separateCars, syncMeshes,
    nearestParked, missionCar,
    carRadius: CAR_R,
  };
}
