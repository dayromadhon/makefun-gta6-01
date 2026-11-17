// Solmar Heat — every car in the city. One job: build car meshes, drive
// traffic, park cars, chase with police, and run the player's arcade
// driving physics.
import { WORLD, CAR, PLACES } from './config.js';
import { pick, range, intRange, clamp, angleDiff, dist2d } from './random.js';

const TRAFFIC_COLORS = [0xb03030, 0x3050b0, 0x30a050, 0xd8d8d8, 0x222222, 0xd8a030, 0x7030a0, 0x408090];

// A car mesh: body, cabin, four wheels. kind: 'sedan' | 'taxi' | 'van' | 'police'.
export function makeCarMesh(kind, color, fxLow) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x18242e });
  const isVan = kind === 'van';
  const bodyLen = isVan ? 5.4 : 4.2;
  const bodyH = isVan ? 1.9 : 0.75;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, bodyH, bodyLen), bodyMat);
  body.position.y = isVan ? 1.15 : 0.62;
  body.castShadow = !fxLow;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, isVan ? 0.5 : 0.62, isVan ? 2.2 : 2.1),
    isVan ? bodyMat : glassMat,
  );
  cabin.position.set(0, isVan ? 2.2 : 1.25, isVan ? -0.6 : -0.2);
  cabin.castShadow = !fxLow;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(wx, 0.42, wz * (isVan ? 1.25 : 1));
    g.add(w);
    wheels.push(w);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.22, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    bar.position.set(0, 1.62, -0.2);
    g.add(bar);
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.45), new THREE.MeshLambertMaterial({ color: 0xff2020, emissive: 0xaa0000 }));
    red.position.set(-0.32, 1.66, -0.2);
    g.add(red);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.45), new THREE.MeshLambertMaterial({ color: 0x2040ff, emissive: 0x0000aa }));
    blue.position.set(0.32, 1.66, -0.2);
    g.add(blue);
    g.userData.lights = [red, blue];
    // White doors on a dark body: a white roof slab.
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.1, 2.1), new THREE.MeshLambertMaterial({ color: 0xf0f0f0 }));
    roof.position.set(0, 1.58, -0.2);
    g.add(roof);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.4), new THREE.MeshLambertMaterial({ color: 0x222222, emissive: 0x554400 }));
    sign.position.set(0, 1.68, -0.2);
    g.add(sign);
  }
  g.userData.wheels = wheels;
  return g;
}

export class Vehicles {
  constructor(scene, city, rng, fxLow, hooks) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.fxLow = fxLow;
    this.hooks = hooks; // { onDrift(x,z), onCollide(speed) }
    this.traffic = [];
    this.parked = [];
    this.police = [];
    this.playerCar = null; // the car the player currently drives
    // When set, cruisers search this point instead of chasing the player
    // (used by the Lose the Heat hide stage).
    this.huntPoint = null;
    this.group = new THREE.Group();
    this.group.name = 'vehicles';
    scene.add(this.group);
    this.spawnTraffic();
    this.spawnParked();
  }

  addCar(kind, color, x, z, heading) {
    const mesh = makeCarMesh(kind, color, this.fxLow);
    mesh.position.set(x, 0, z);
    mesh.rotation.y = heading;
    this.group.add(mesh);
    const car = {
      kind, color, mesh, x, z, heading,
      speed: 0, vx: 0, vz: 0,
      steer: 0, parked: false, police: kind === 'police',
      ramCooldown: 0, stuckTime: 0, targetSpeed: 0,
      street: null, line: 0, dir: 1, along: 0,
    };
    return car;
  }

  spawnTraffic() {
    const rng = this.rng;
    for (let i = 0; i < 13; i++) {
      const horizontal = rng() < 0.5;
      const line = pick(rng, WORLD.grid);
      const dir = rng() < 0.5 ? 1 : -1;
      const along = range(rng, -110, 110);
      const kind = rng() < 0.14 ? 'taxi' : 'sedan';
      const color = kind === 'taxi' ? 0xf2c200 : pick(rng, TRAFFIC_COLORS);
      const car = this.addCar(kind, color, 0, 0, 0);
      car.street = horizontal ? 'h' : 'v';
      car.line = line;
      car.dir = dir;
      car.along = along;
      car.targetSpeed = range(rng, 8, 13);
      this.placeOnStreet(car);
      this.traffic.push(car);
    }
  }

  placeOnStreet(car) {
    const lane = car.dir > 0 ? 1.9 : -1.9;
    if (car.street === 'h') {
      car.x = car.along;
      car.z = car.line + lane;
      car.heading = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      car.x = car.line + lane;
      car.z = car.along;
      car.heading = car.dir > 0 ? 0 : Math.PI;
    }
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
  }

  spawnParked() {
    const rng = this.rng;
    // The mission sedan, right by the player's start, on street z = 80.
    const sedan = this.addCar('sedan', 0x8a2a2a, PLACES.sedanSpot.x, PLACES.sedanSpot.z, Math.PI / 2);
    sedan.parked = true;
    sedan.missionSedan = true;
    this.parked.push(sedan);
    // The courier van for the final mission, at the east depot.
    const van = this.addCar('van', 0xe8e8e8, PLACES.vanSpot.x, PLACES.vanSpot.z, 0);
    van.parked = true;
    van.missionVan = true;
    this.parked.push(van);
    // A few ordinary parked cars along the streets.
    const spots = [
      [-40, 84, 0], [40, 76, Math.PI], [0, -84, Math.PI / 2], [80, -44, 0],
      [-80, 44, -Math.PI / 2], [44, 40, Math.PI], [-44, -40, 0], [80, 44, Math.PI],
    ];
    for (const [x, z, h] of spots) {
      const c = this.addCar(rng() < 0.2 ? 'taxi' : 'sedan', rng() < 0.2 ? 0xf2c200 : pick(rng, TRAFFIC_COLORS), x, z, h);
      c.parked = true;
      this.parked.push(c);
    }
  }

  nearestParked(x, z, maxDist = 5) {
    let best = null;
    let bestD = maxDist;
    for (const c of this.parked) {
      const d = dist2d(x, z, c.x, c.z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  // The player takes a parked car: it leaves the parked list and becomes
  // the driven car. Returns the car or null.
  steal(car) {
    if (!car || !car.parked) return null;
    const i = this.parked.indexOf(car);
    if (i >= 0) this.parked.splice(i, 1);
    car.parked = false;
    car.speed = 0;
    car.vx = 0;
    car.vz = 0;
    this.playerCar = car;
    return car;
  }

  // The player leaves the car: it becomes parked again, staying where it is.
  abandon() {
    const car = this.playerCar;
    if (!car) return null;
    car.parked = true;
    car.speed = 0;
    this.playerCar = null;
    this.parked.push(car);
    return car;
  }

  spawnPolice(x, z) {
    const car = this.addCar('police', 0x1c2f4a, x, z, 0);
    car.targetSpeed = CAR.policeTop;
    this.police.push(car);
    return car;
  }

  removePolice(car) {
    const i = this.police.indexOf(car);
    if (i >= 0) this.police.splice(i, 1);
    this.group.remove(car.mesh);
  }

  // ---- per-frame updates ----

  update(dt, player, wanted) {
    this.updateTraffic(dt, player);
    this.updatePolice(dt, player, wanted);
    if (this.playerCar) this.updatePlayerCar(dt);
    // Wheel spin for every moving car.
    for (const list of [this.traffic, this.police, this.playerCar ? [this.playerCar] : []]) {
      for (const c of list) {
        const spin = (c.speed * dt) / 0.42;
        for (const w of c.mesh.userData.wheels) w.rotation.x += spin;
      }
    }
  }

  updateTraffic(dt, player) {
    for (const car of this.traffic) {
      // Slow down for the player's car ahead on the same lane.
      let want = car.targetSpeed;
      const px = player.x;
      const pz = player.z;
      if (player.inCar) {
        const ahead = car.street === 'h'
          ? Math.abs(pz - car.z) < 3 && (px - car.x) * car.dir > 0 && (px - car.x) * car.dir < 9
          : Math.abs(px - car.x) < 3 && (pz - car.z) * car.dir > 0 && (pz - car.z) * car.dir < 9;
        if (ahead) want = 0;
      }
      // Slow for a traffic car directly ahead in the same lane.
      for (const other of this.traffic) {
        if (other === car || other.street !== car.street || other.line !== car.line || other.dir !== car.dir) continue;
        const gap = (other.along - car.along) * car.dir;
        if (gap > 0 && gap < 8) {
          want = Math.min(want, other.speed * 0.9);
        }
      }
      car.speed += clamp(want - car.speed, -14 * dt, 9 * dt);
      car.along += car.dir * car.speed * dt;
      // At an intersection, sometimes turn onto the crossing street.
      for (const c of WORLD.grid) {
        if (Math.abs(car.along - c) < 1.2 && car.lastTurn !== c) {
          car.lastTurn = c;
          if (this.rng() < 0.32) {
            car.street = car.street === 'h' ? 'v' : 'h';
            car.line = c;
            car.dir = this.rng() < 0.5 ? 1 : -1;
            car.along = car.street === 'h' ? c : c;
            // Recompute the along coordinate on the new street.
            car.along = car.street === 'h' ? car.x : car.z;
          }
          break;
        }
      }
      if (car.along > 118 || car.along < -118) {
        car.dir *= -1;
        car.along = clamp(car.along, -118, 118);
      }
      this.placeOnStreet(car);
    }
  }

  updatePolice(dt, player, wanted) {
    const now = performance.now() / 1000;
    for (const car of [...this.police]) {
      car.ramCooldown = Math.max(0, car.ramCooldown - dt);
      // Chase the player — or search the hunt point when one is set.
      let tx = player.x;
      let tz = player.z;
      if (this.huntPoint) {
        tx = this.huntPoint.x;
        tz = this.huntPoint.z;
        const hd = Math.hypot(tx - car.x, tz - car.z);
        if (hd < 14) {
          // Circle the search area instead of parking on it.
          const a = Math.atan2(car.z - tz, car.x - tx) + 0.9 * dt;
          tx = tx + Math.cos(a) * 14;
          tz = tz + Math.sin(a) * 14;
        }
      }
      const dx = tx - car.x;
      const dz = tz - car.z;
      const dist = Math.hypot(dx, dz);
      const pdist = Math.hypot(player.x - car.x, player.z - car.z);
      if (pdist > 160) {
        // Too far away to matter: pull the cruiser back near the player.
        const a = Math.atan2(-(player.x - car.x), -(player.z - car.z)) + (this.rng() - 0.5);
        car.x = player.x + Math.sin(a) * 55;
        car.z = player.z + Math.cos(a) * 55;
        car.speed = 12;
      }
      const wantHeading = Math.atan2(dx, dz);
      const turn = clamp(angleDiff(car.heading, wantHeading), -2.4 * dt, 2.4 * dt);
      car.heading += turn;
      const target = dist > 25 ? CAR.policeTop : CAR.policeTop * 0.75;
      car.speed += clamp(target - car.speed, -18 * dt, 12 * dt);
      car.vx = Math.sin(car.heading) * car.speed;
      car.vz = Math.cos(car.heading) * car.speed;
      let nx = car.x + car.vx * dt;
      let nz = car.z + car.vz * dt;
      [nx, nz] = this.city.resolveSolids(nx, nz, 1.4);
      const moved = dist2d(nx, nz, car.x, car.z);
      if (moved < car.speed * dt * 0.25 && car.speed > 4) {
        car.stuckTime += dt;
        if (car.stuckTime > 2.5) {
          car.heading += Math.PI * 0.7;
          car.stuckTime = 0;
        }
      } else {
        car.stuckTime = 0;
      }
      car.x = nx;
      car.z = nz;
      car.mesh.position.set(car.x, 0, car.z);
      car.mesh.rotation.y = car.heading;
      // Flash the light bar.
      if (car.mesh.userData.lights) {
        const phase = Math.floor(now * 6) % 2 === 0;
        car.mesh.userData.lights[0].material.emissive.setHex(phase ? 0xff0000 : 0x330000);
        car.mesh.userData.lights[1].material.emissive.setHex(phase ? 0x000033 : 0x0000ff);
      }
      // Ram: a hard hit on the player's car shakes the screen.
      if (this.playerCar && pdist < 3.4 && car.ramCooldown <= 0) {
        car.ramCooldown = 1.2;
        this.playerCar.speed *= 0.55;
        if (this.hooks.onCollide) this.hooks.onCollide(car.speed);
      }
    }
  }

  // Arcade driving for the car the player drives. input: {steer, throttle,
  // handbrake}. Returns the car's speed for the HUD and audio.
  updatePlayerCar(dt) {
    const car = this.playerCar;
    if (!car) return 0;
    const input = this._driveInput;
    const steer = input ? input.steer : 0;
    const throttle = input ? input.throttle : 0;
    const handbrake = input ? input.handbrake : false;
    const top = car.kind === 'van' ? CAR.vanTop : car.kind === 'taxi' ? CAR.taxiTop : CAR.sedanTop;
    const accel = car.kind === 'van' ? CAR.vanAccel : car.kind === 'taxi' ? CAR.taxiAccel : CAR.sedanAccel;
    const fwdSpeed = car.vx * Math.sin(car.heading) + car.vz * Math.cos(car.heading);
    if (throttle > 0) {
      car.speed = Math.min(top, car.speed + accel * dt);
    } else if (throttle < 0) {
      if (car.speed > 0.5) car.speed = Math.max(0, car.speed - CAR.brake * dt);
      else car.speed = Math.max(-CAR.reverseTop, car.speed - accel * 0.6 * dt);
    } else {
      car.speed *= Math.exp(-0.55 * dt);
      if (Math.abs(car.speed) < 0.15) car.speed = 0;
    }
    if (handbrake) {
      car.speed *= Math.exp(-1.1 * dt);
    }
    const speedFactor = clamp(Math.abs(car.speed) / 9, 0.18, 1);
    const steerRate = (handbrake ? CAR.driftSteer : CAR.steerBase) * speedFactor;
    const dirSign = car.speed >= 0 ? 1 : -1;
    car.heading += steer * steerRate * dt * dirSign;
    // Velocity chases the heading with grip; handbrake loosens the grip
    // so the car slides — the drift feel.
    const grip = handbrake ? 2.2 : CAR.grip;
    const tx = Math.sin(car.heading) * car.speed;
    const tz = Math.cos(car.heading) * car.speed;
    const k = 1 - Math.exp(-grip * dt);
    car.vx += (tx - car.vx) * k;
    car.vz += (tz - car.vz) * k;
    let nx = car.x + car.vx * dt;
    let nz = car.z + car.vz * dt;
    // Stay inside the playable map (city + beach + marina edges).
    nx = clamp(nx, -128, 132);
    nz = clamp(nz, -128, 138);
    [nx, nz] = this.city.resolveSolids(nx, nz, 1.5);
    const hitWall = dist2d(nx, nz, car.x, car.z) < Math.hypot(car.vx, car.vz) * dt * 0.5;
    if (hitWall) {
      car.speed *= 0.6;
      car.vx *= 0.5;
      car.vz *= 0.5;
      if (Math.abs(car.speed) > 6 && this.hooks.onCollide) this.hooks.onCollide(Math.abs(car.speed));
    }
    car.x = nx;
    car.z = nz;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    // Front wheels follow the steering.
    const wheels = car.mesh.userData.wheels;
    if (wheels) {
      wheels[0].rotation.y = steer * 0.4;
      wheels[1].rotation.y = steer * 0.4;
    }
    if (handbrake && Math.abs(car.speed) > 9 && this.hooks.onDrift) {
      this.hooks.onDrift(car.x - Math.sin(car.heading) * 1.8, car.z - Math.cos(car.heading) * 1.8);
    }
    return car.speed;
  }

  setDriveInput(input) {
    this._driveInput = input;
  }
}
