// Leo Marín on foot and behind the wheel: walking, running, jumping, punching and
// shooting, stealing cars, and taking damage. Driving itself lives in vehicles.js; this
// module decides when Leo is in a car and what he does on foot.

import * as THREE from 'three';
import { PLAYER } from './config.js';

function makeLeoMesh() {
  const group = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x0e7490 });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc68642 });
  const pants = new THREE.MeshLambertMaterial({ color: 0x1f2937 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.82, 0.28), pants);
  legs.position.y = 0.41;
  legs.castShadow = true;
  group.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.64, 0.34), jacket);
  torso.position.y = 1.14;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.36, 0.34), skin);
  head.position.y = 1.66;
  head.castShadow = true;
  group.add(head);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.38), new THREE.MeshLambertMaterial({ color: 0xf59e0b }));
  cap.position.y = 1.86;
  group.add(cap);
  const armGeo = new THREE.BoxGeometry(0.14, 0.58, 0.14);
  const leftArm = new THREE.Mesh(armGeo, jacket);
  leftArm.position.set(-0.38, 1.12, 0);
  group.add(leftArm);
  const rightArm = new THREE.Mesh(armGeo, jacket);
  rightArm.position.set(0.38, 1.12, 0);
  group.add(rightArm);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, 0.42), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.38, 0.86, 0.22);
  group.add(gun);
  group.userData.leftArm = leftArm;
  group.userData.rightArm = rightArm;
  group.userData.gun = gun;
  return group;
}

export function createPlayer(scene, x, z) {
  const mesh = makeLeoMesh();
  mesh.position.set(x, 0, z);
  scene.add(mesh);
  const player = {
    mesh,
    x,
    z,
    heading: 0,
    vx: 0,
    vz: 0,
    vy: 0,
    y: 0,
    health: PLAYER.maxHealth,
    ammo: PLAYER.pistolMag,
    reserveAmmo: 48,
    reloading: 0,
    punchTimer: 0,
    shootTimer: 0,
    hurtTimer: 0,
    car: null,
    walkPhase: 0,
    dead: false,
  };

  function syncMesh() {
    mesh.visible = player.car === null;
    if (player.car) return;
    mesh.position.set(player.x, player.y, player.z);
    mesh.rotation.y = player.heading;
    const speed = Math.hypot(player.vx, player.vz);
    player.walkPhase += speed * 0.016 * 2.2;
    const swing = Math.sin(player.walkPhase) * 0.55 * Math.min(1, speed / 4);
    mesh.userData.leftArm.rotation.x = swing;
    mesh.userData.rightArm.rotation.x = -swing;
  }

  function hurt(amount, source) {
    if (player.hurtTimer > 0 || player.dead) return;
    player.health -= amount;
    player.hurtTimer = 0.6;
    if (player.health <= 0) {
      player.health = 0;
      player.dead = true;
    }
  }

  function nearestCarInReach(vehicles) {
    return vehicles.nearestCar(player.x, player.z, 3.6, (car) => car !== player.car);
  }

  function enterCar(car, events) {
    if (!car) return false;
    player.car = car;
    car.driver = 'player';
    car.occupied = true;
    if (events && events.onEnterCar) events.onEnterCar(car);
    return true;
  }

  function exitCar(events) {
    const car = player.car;
    if (!car) return;
    player.car = null;
    car.driver = null;
    const side = { x: player.x, z: player.z };
    player.x = car.x + Math.cos(car.heading) * 2.2;
    player.z = car.z - Math.sin(car.heading) * 2.2;
    player.heading = car.heading;
    if (events && events.onExitCar) events.onExitCar(car);
    return side;
  }

  function shoot(peds, vehicles, events) {
    if (player.shootTimer > 0 || player.reloading > 0) return;
    if (player.ammo <= 0) {
      if (player.reserveAmmo > 0) player.reloading = PLAYER.reloadTime;
      return;
    }
    player.ammo -= 1;
    player.shootTimer = PLAYER.pistolCooldown;
    const dirX = Math.sin(player.heading);
    const dirZ = Math.cos(player.heading);
    // Nearest living ped roughly in front of the shot.
    let bestPed = null;
    let bestDist = PLAYER.pistolRange;
    for (const ped of peds.peds) {
      if (!ped.alive) continue;
      const dx = ped.x - player.x;
      const dz = ped.z - player.z;
      const dist = Math.hypot(dx, dz);
      if (dist > bestDist) continue;
      const dot = (dx * dirX + dz * dirZ) / dist;
      if (dot > 0.94) {
        bestDist = dist;
        bestPed = ped;
      }
    }
    if (bestPed) {
      peds.knockDown(bestPed);
      if (events && events.onShootHit) events.onShootHit(bestPed, true);
    } else {
      // Maybe a car is in the way.
      const car = vehicles.nearestCar(player.x, player.z, PLAYER.pistolRange, (c) => c !== player.car);
      if (car) {
        const dx = car.x - player.x;
        const dz = car.z - player.z;
        const dist = Math.hypot(dx, dz);
        const dot = (dx * dirX + dz * dirZ) / dist;
        if (dot > 0.96) {
          car.health -= PLAYER.pistolDamage;
          if (events && events.onShootHit) events.onShootHit(car, false);
        }
      }
      if (events && events.onShoot) events.onShoot();
    }
  }

  function punch(peds, events) {
    if (player.punchTimer > 0) return;
    player.punchTimer = PLAYER.punchCooldown;
    const target = peds.nearestPed(player.x + Math.sin(player.heading) * 1.2, player.z + Math.cos(player.heading) * 1.2, PLAYER.punchRange);
    if (target) {
      peds.knockDown(target);
      if (events && events.onPunchHit) events.onPunchHit(target);
    } else if (events && events.onPunch) events.onPunch();
  }

  function update(dt, input, world, events, actions = 0) {
    if (player.dead) return;
    player.hurtTimer = Math.max(0, player.hurtTimer - dt);
    player.punchTimer = Math.max(0, player.punchTimer - dt);
    player.shootTimer = Math.max(0, player.shootTimer - dt);
    if (player.reloading > 0) {
      player.reloading -= dt;
      if (player.reloading <= 0) {
        const take = Math.min(PLAYER.pistolMag, player.reserveAmmo);
        player.ammo = take;
        player.reserveAmmo -= take;
      }
    }
    if (player.car) {
      const car = player.car;
      const crash = world.vehicles.drivePlayer(car, input, dt, world.city);
      // The player IS the car while driving: every other system reads player.x/z.
      player.x = car.x;
      player.z = car.z;
      player.heading = car.heading;
      if (crash && crash.crashed && events && events.onCrash) events.onCrash(crash.strength);
      if (actions & 4) exitCar(events);
      if (car.health <= 0) {
        if (events && events.onCarDestroyed) events.onCarDestroyed(car);
        player.car = null;
        car.driver = null;
        world.vehicles.remove(car);
        player.x = car.x + 2;
        player.z = car.z + 2;
        hurt(25, null);
      }
      syncMesh();
      return;
    }

    // On foot: camera-relative movement.
    const { forward, strafe } = input.axes();
    const camYaw = world.cameraYaw;
    const fx = Math.sin(camYaw);
    const fz = Math.cos(camYaw);
    const rx = Math.cos(camYaw);
    const rz = -Math.sin(camYaw);
    const speed = input.running() ? PLAYER.runSpeed : PLAYER.walkSpeed;
    const tx = (fx * forward + rx * strafe) * speed;
    const tz = (fz * forward + rz * strafe) * speed;
    player.vx += (tx - player.vx) * Math.min(1, dt * 10);
    player.vz += (tz - player.vz) * Math.min(1, dt * 10);
    const moving = Math.hypot(player.vx, player.vz) > 0.6;
    if (moving) {
      player.heading = Math.atan2(player.vx, player.vz);
    }
    const nx = player.x + player.vx * dt;
    const nz = player.z + player.vz * dt;
    const hit = world.city.collideCircle(nx, nz, PLAYER.radius);
    if (!hit) {
      player.x = nx;
      player.z = nz;
    } else {
      // Slide along the wall: try each axis alone.
      if (!world.city.collideCircle(nx, player.z, PLAYER.radius)) player.x = nx;
      else if (!world.city.collideCircle(player.x, nz, PLAYER.radius)) player.z = nz;
    }
    const clamped = world.city.clampToCity(player.x, player.z, 1);
    player.x = clamped.x;
    player.z = clamped.z;

    // Jump.
    if (player.y === 0 && (actions & 1) && world.screen === 'play') {
      // Space doubles as confirm on menus; jump only while playing on foot.
      player.vy = PLAYER.jumpSpeed;
    }
    if (player.y > 0 || player.vy !== 0) {
      player.vy -= 22 * dt;
      player.y += player.vy * dt;
      if (player.y <= 0) {
        player.y = 0;
        player.vy = 0;
      }
    }

    if (actions & 4) {
      const car = nearestCarInReach(world.vehicles);
      if (car) {
        const wasParked = car.driver === null;
        const wasPolice = car.kind === 'police';
        enterCar(car, events);
        if (events && events.onStealCar) events.onStealCar(car, wasParked, wasPolice);
      }
    }
    if (actions & 8) punch(world.peds, events);
    if (actions & 16) shoot(world.peds, world.vehicles, events);
    if (actions & 32 && player.ammo < PLAYER.pistolMag && player.reserveAmmo > 0 && player.reloading <= 0) {
      player.reloading = PLAYER.reloadTime;
    }

    // Running into a ped at speed knocks them down.
    if (moving && Math.hypot(player.vx, player.vz) > 7) {
      const ped = world.peds.nearestPed(player.x, player.z, 1.1);
      if (ped) {
        world.peds.knockDown(ped);
        if (events && events.onHitPed) events.onHitPed(ped);
      }
    }
    // Walking into a parked/traffic car does nothing; driving into peds is handled in main.
    syncMesh();
  }

  player.hurt = hurt;
  player.enterCar = enterCar;
  player.exitCar = exitCar;
  player.update = update;
  player.syncMesh = syncMesh;
  return player;
}
