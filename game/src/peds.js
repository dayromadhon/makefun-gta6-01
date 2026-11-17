// Solmar Heat — pedestrians and foot cops.
// One job: the people on the sidewalks — walking, fleeing, getting knocked
// down, and the cops who chase you on foot.

import { WORLD, TUNE } from './config.js';
import { mulberry32, range, pick } from './random.js';

const THREE = window.THREE;

const SHIRTS = [0xd95f4b, 0x4b7fd9, 0x53b06a, 0xd9b44b, 0x8a5fd9, 0xe8e4da, 0x3a3f46];
const SKINS = [0xe8b98a, 0xc98d64, 0x8a5f3d, 0xf0c8a0];

function makePedMesh(shirt, skin) {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.4), new THREE.MeshLambertMaterial({ color: shirt }));
  torso.position.y = 1.05;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshLambertMaterial({ color: skin }));
  head.position.y = 1.75;
  g.add(head);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
  for (const sx of [-0.18, 0.18]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.6, 0.24), legMat);
    leg.position.set(sx, 0.3, 0);
    g.add(leg);
  }
  return g;
}

function makeCopMesh() {
  const g = makePedMesh(0x1d4fd7, 0xe8b98a);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.14, 10), new THREE.MeshLambertMaterial({ color: 0x14161a }));
  cap.position.y = 1.95;
  g.add(cap);
  return g;
}

export function createPeds(scene, city, seed) {
  const rng = mulberry32(seed);
  const group = new THREE.Group();
  scene.add(group);
  const peds = [];
  const cops = [];

  function randomSidewalkPoint() {
    // on a sidewalk: just off a street line, inside the city
    const along = pick(rng, WORLD.streets);
    const cross = range(rng, -95, 95);
    if (rng() < 0.5) return { x: along + 6.5, z: cross };
    return { x: cross, z: along + 6.5 };
  }

  function spawnPed(x, z) {
    const mesh = makePedMesh(pick(rng, SHIRTS), pick(rng, SKINS));
    mesh.position.set(x, 0, z);
    group.add(mesh);
    const ped = {
      mesh, x, z, heading: rng() * Math.PI * 2,
      speed: range(rng, 1.6, 2.8), state: 'walk',
      target: randomSidewalkPoint(), downTimer: 0, fleeFrom: null, isCop: false,
    };
    peds.push(ped);
    return ped;
  }

  function spawnCop(x, z) {
    let cop = cops.find((c) => !c.active);
    if (!cop) {
      if (cops.length >= 6) return null;
      const mesh = makeCopMesh();
      group.add(mesh);
      cop = {
        mesh, x, z, heading: 0, speed: TUNE.policeFootSpeed, state: 'chase',
        target: null, downTimer: 0, fleeFrom: null, isCop: true, active: false,
        touchTimer: 0,
      };
      cops.push(cop);
    }
    cop.active = true;
    cop.x = x;
    cop.z = z;
    cop.state = 'chase';
    cop.touchTimer = 0;
    cop.mesh.visible = true;
    return cop;
  }

  function releaseCop(cop) {
    cop.active = false;
    cop.mesh.visible = false;
  }

  function knockDown(ped, fromX, fromZ) {
    if (ped.state === 'down') return;
    ped.state = 'down';
    ped.downTimer = 3.5;
    ped.fleeFrom = { x: fromX, z: fromZ };
    ped.mesh.rotation.x = Math.PI / 2 - 0.15;
    ped.mesh.position.y = 0.3;
  }

  function update(dt, ctx) {
    const px = ctx.player.x;
    const pz = ctx.player.z;
    // --- walkers ------------------------------------------------------------
    for (const ped of peds) {
      if (ped.state === 'down') {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          ped.state = 'flee';
          ped.mesh.rotation.x = 0;
          ped.mesh.position.y = 0;
        }
        continue;
      }
      let tx;
      let tz;
      let speed = ped.speed;
      if (ped.state === 'flee' && ped.fleeFrom) {
        const dx = ped.x - ped.fleeFrom.x;
        const dz = ped.z - ped.fleeFrom.z;
        const d = Math.hypot(dx, dz) || 1;
        tx = ped.x + (dx / d) * 20;
        tz = ped.z + (dz / d) * 20;
        speed = 5.2;
        if (Math.hypot(tx - ped.x, tz - ped.z) > 30 || d > 26) {
          ped.state = 'walk';
          ped.target = randomSidewalkPoint();
        }
      } else {
        tx = ped.target.x;
        tz = ped.target.z;
        if (Math.hypot(tx - ped.x, tz - ped.z) < 2) ped.target = randomSidewalkPoint();
      }
      const dx = tx - ped.x;
      const dz = tz - ped.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.1) {
        const want = Math.atan2(dx, dz);
        let diff = want - ped.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        ped.heading += Math.max(-3 * dt, Math.min(3 * dt, diff));
        ped.x += Math.sin(ped.heading) * speed * dt;
        ped.z += Math.cos(ped.heading) * speed * dt;
        const res = city.resolveCircle(ped.x, ped.z, 0.6);
        ped.x = res.x;
        ped.z = res.z;
        ped.mesh.position.set(ped.x, ped.state === 'down' ? 0.3 : 0, ped.z);
        ped.mesh.rotation.y = ped.heading;
        // walk bob
        ped.mesh.position.y = ped.state === 'down' ? 0.3 : Math.abs(Math.sin(performance.now() * 0.008 + ped.x)) * 0.05;
      }
      // hit by a moving car?
      if (ctx.vehicles) {
        for (const car of ctx.vehicles.all) {
          if (car.wrecked || car.isParked) continue;
          if (Math.abs(car.speed) < 3) continue;
          const cd = Math.hypot(car.x - ped.x, car.z - ped.z);
          if (cd < 2.4) {
            knockDown(ped, car.x, car.z);
            // only the PLAYER's car makes it the player's crime: traffic
            // cars run peds over on their own and must not raise Leo's stars
            if (ctx.onCrime && car.isPlayer) ctx.onCrime('hit-ped', ped.x, ped.z);
            if (ctx.effects) ctx.effects.sparks(ped.x, 1, ped.z, 5);
            break;
          }
        }
      }
    }
    // --- foot cops ------------------------------------------------------------
    for (const cop of cops) {
      if (!cop.active) continue;
      if (cop.state === 'down') {
        cop.downTimer -= dt;
        if (cop.downTimer <= 0) {
          cop.state = 'chase';
          cop.mesh.rotation.x = 0;
          cop.mesh.position.y = 0;
        }
        continue;
      }
      const dx = px - cop.x;
      const dz = pz - cop.z;
      const d = Math.hypot(dx, dz);
      if (d > 0.1) {
        const want = Math.atan2(dx, dz);
        let diff = want - cop.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        cop.heading += Math.max(-4 * dt, Math.min(4 * dt, diff));
        const sp = ctx.player.inCar ? TUNE.policeFootSpeed * 0.9 : TUNE.policeFootSpeed;
        cop.x += Math.sin(cop.heading) * sp * dt;
        cop.z += Math.cos(cop.heading) * sp * dt;
        const res = city.resolveCircle(cop.x, cop.z, 0.6);
        cop.x = res.x;
        cop.z = res.z;
      }
      cop.mesh.position.set(cop.x, 0, cop.z);
      cop.mesh.rotation.y = cop.heading;
      // bust: touching the player on foot while they are slow
      // (not in photo mode)
      if (!ctx.player.inCar && d < 2.4 && Math.abs(ctx.player.speed || 0) < 3 && !ctx.shotMode) {
        cop.touchTimer += dt;
        if (cop.touchTimer > TUNE.bustHoldSeconds && ctx.onBusted) ctx.onBusted();
      } else {
        cop.touchTimer = 0;
      }
      // a cop hit by a car goes down
      if (ctx.vehicles) {
        for (const car of ctx.vehicles.all) {
          if (car.wrecked || car.isParked || car.isPolice) continue;
          if (Math.abs(car.speed) < 3) continue;
          if (Math.hypot(car.x - cop.x, car.z - cop.z) < 2.4) {
            cop.state = 'down';
            cop.downTimer = 4;
            cop.mesh.rotation.x = Math.PI / 2 - 0.15;
            cop.mesh.position.y = 0.3;
            // same rule as peds: only the player's car is the player's crime
            if (ctx.onCrime && car.isPlayer) ctx.onCrime('hit-cop', cop.x, cop.z);
            break;
          }
        }
      }
    }
  }

  function spawnWalkers(count) {
    for (let i = 0; i < count; i++) {
      const p = randomSidewalkPoint();
      spawnPed(p.x, p.z);
    }
  }

  function fleeAll(fromX, fromZ) {
    for (const ped of peds) {
      if (ped.state === 'walk' && Math.hypot(ped.x - fromX, ped.z - fromZ) < 26) {
        ped.state = 'flee';
        ped.fleeFrom = { x: fromX, z: fromZ };
      }
    }
  }

  function nearest(x, z, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const ped of peds) {
      if (ped.state === 'down') continue;
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < bestD) {
        bestD = d;
        best = ped;
      }
    }
    return best;
  }

  return {
    peds, cops, spawnWalkers, spawnCop, releaseCop, knockDown, update, fleeAll, nearest,
  };
}
