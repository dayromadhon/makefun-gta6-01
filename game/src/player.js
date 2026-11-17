// Solmar Heat — Leo Marin on foot: walking, stealing cars, fighting.
// One job: the player character when they are not behind a wheel.

import { TUNE } from './config.js';

const THREE = window.THREE;

function makePlayerMesh() {
  const g = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2e6fc2 });
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.95, 0.42), jacket);
  torso.position.y = 1.05;
  g.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), new THREE.MeshLambertMaterial({ color: 0xe8b98a }));
  head.position.y = 1.78;
  g.add(head);
  const legMat = new THREE.MeshLambertMaterial({ color: 0x22242a });
  for (const sx of [-0.19, 0.19]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.62, 0.26), legMat);
    leg.position.set(sx, 0.31, 0);
    g.add(leg);
  }
  // a pistol in the right hand when armed
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x14161a }));
  gun.position.set(0.48, 1.05, 0.25);
  gun.name = 'gun';
  g.add(gun);
  return g;
}

// Heading convention everywhere: forward = (sin(a), cos(a)) in (x, z).
// So W with camera yaw Y walks along (sin Y, cos Y), and D strafes right
// along (-cos Y, sin Y).

export function createPlayer(scene, spawn) {
  const mesh = makePlayerMesh();
  scene.add(mesh);
  const player = {
    mesh,
    x: spawn.x,
    z: spawn.z,
    heading: 0, // body facing
    yaw: 0, // camera yaw the player moves relative to
    speed: 0,
    health: TUNE.playerHealth,
    inCar: false,
    car: null,
    weapon: 'pistol',
    mag: TUNE.pistolMag,
    reserve: 96,
    reloading: 0,
    punchCooldown: 0,
    shootCooldown: 0,
    down: false,
  };

  function updateOnFoot(dt, ctx) {
    const input = ctx.input;
    const axis = input.moveAxis();
    const running = input.down('ShiftLeft') || input.down('ShiftRight');
    const maxSpeed = running ? TUNE.runSpeed : TUNE.walkSpeed;
    const targetSpeed = Math.hypot(axis.x, axis.y) > 0.1 ? maxSpeed : 0;
    player.speed += (targetSpeed - player.speed) * Math.min(1, 8 * dt);
    if (player.speed > 0.1) {
      const fx = Math.sin(player.yaw) * axis.y - Math.cos(player.yaw) * axis.x;
      const fz = Math.cos(player.yaw) * axis.y + Math.sin(player.yaw) * axis.x;
      player.x += fx * player.speed * dt;
      player.z += fz * player.speed * dt;
      const want = Math.atan2(fx, fz);
      let diff = want - player.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      player.heading += Math.max(-8 * dt, Math.min(8 * dt, diff));
      const res = ctx.city.resolveCircle(player.x, player.z, 0.8);
      player.x = res.x;
      player.z = res.z;
    }
    // weapon toggle
    if (input.wasPressed('KeyQ')) {
      player.weapon = player.weapon === 'pistol' ? 'fists' : 'pistol';
      if (ctx.hud) ctx.hud.toast(player.weapon === 'pistol' ? 'Pistol out' : 'Fists out');
    }
    // reload
    if (input.wasPressed('KeyR') && player.weapon === 'pistol' && player.mag < TUNE.pistolMag && player.reloading <= 0) {
      player.reloading = 1.0;
    }
    if (player.reloading > 0) {
      player.reloading -= dt;
      if (player.reloading <= 0) {
        const need = TUNE.pistolMag - player.mag;
        const take = Math.min(need, player.reserve);
        player.mag += take;
        player.reserve -= take;
      }
    }
    player.punchCooldown -= dt;
    player.shootCooldown -= dt;
    // left click: punch up close, or shoot
    if (input.mouseDown && input.mouseButton === 0) {
      if (player.weapon === 'fists') {
        if (player.punchCooldown <= 0) {
          player.punchCooldown = 0.45;
          punch(ctx);
        }
      } else if (player.shootCooldown <= 0 && player.reloading <= 0) {
        if (player.mag > 0) {
          player.shootCooldown = 0.22;
          shoot(ctx);
        } else {
          player.shootCooldown = 0.3;
          if (ctx.audio) ctx.audio.denied();
        }
      }
    }
    mesh.visible = true;
    mesh.position.set(player.x, 0, player.z);
    mesh.rotation.y = player.heading;
    mesh.getObjectByName('gun').visible = player.weapon === 'pistol';
    // walk bob
    mesh.position.y = player.speed > 0.5 ? Math.abs(Math.sin(performance.now() * 0.012)) * 0.06 : 0;
  }

  function punch(ctx) {
    if (ctx.audio) ctx.audio.punch();
    const fx = Math.sin(player.heading);
    const fz = Math.cos(player.heading);
    const ped = ctx.peds ? ctx.peds.nearest(player.x + fx * 1.5, player.z + fz * 1.5, TUNE.fistRange) : null;
    if (ped) {
      ctx.peds.knockDown(ped, player.x, player.z);
      if (ctx.effects) ctx.effects.sparks(ped.x, 1.2, ped.z, 6);
      if (ctx.onCrime) ctx.onCrime('assault', ped.x, ped.z);
    }
  }

  function shoot(ctx) {
    player.mag -= 1;
    if (ctx.audio) ctx.audio.shot();
    // aim along the camera yaw
    const fx = Math.sin(player.yaw);
    const fz = Math.cos(player.yaw);
    if (ctx.effects) ctx.effects.muzzle(player.x + fx * 0.5, 1.3, player.z + fz * 0.5, player.yaw);
    let best = null;
    let bestD = TUNE.shootRange;
    if (ctx.peds) {
      for (const ped of ctx.peds.peds) {
        if (ped.state === 'down') continue;
        const dx = ped.x - player.x;
        const dz = ped.z - player.z;
        const d = Math.hypot(dx, dz);
        if (d < bestD && (dx * fx + dz * fz) / Math.max(d, 0.01) > 0.92) {
          bestD = d;
          best = { kind: 'ped', target: ped };
        }
      }
      for (const cop of ctx.peds.cops) {
        if (!cop.active || cop.state === 'down') continue;
        const dx = cop.x - player.x;
        const dz = cop.z - player.z;
        const d = Math.hypot(dx, dz);
        if (d < bestD && (dx * fx + dz * fz) / Math.max(d, 0.01) > 0.92) {
          bestD = d;
          best = { kind: 'cop', target: cop };
        }
      }
    }
    if (best) {
      const t = best.target;
      if (best.kind === 'ped') {
        ctx.peds.knockDown(t, player.x, player.z);
        if (ctx.onCrime) ctx.onCrime('shooting', t.x, t.z);
        if (ctx.peds) ctx.peds.fleeAll(t.x, t.z);
      } else {
        t.state = 'down';
        t.downTimer = 4;
        t.mesh.rotation.x = Math.PI / 2 - 0.15;
        t.mesh.position.y = 0.3;
        if (ctx.onCrime) ctx.onCrime('shoot-cop', t.x, t.z);
      }
      if (ctx.effects) ctx.effects.sparks(t.x, 1.2, t.z, 8);
    }
  }

  function takeDamage(amount, ctx) {
    if (player.down) return;
    player.health -= amount;
    if (ctx.hud) ctx.hud.flashDamage();
    if (player.health <= 0) {
      player.health = 0;
      player.down = true;
      if (ctx.onDown) ctx.onDown();
    }
  }

  function enterCar(car, ctx) {
    player.inCar = true;
    player.car = car;
    mesh.visible = false;
    if (ctx.audio) ctx.audio.pickup();
  }

  // While driving, Leo IS the car: every system that reads player.x/z
  // (missions, wanted, camera, peds, minimap) must see the car's position.
  function updateInCar() {
    if (!player.car) return;
    player.x = player.car.x;
    player.z = player.car.z;
    player.heading = player.car.heading;
    player.speed = player.car.speed;
  }

  function exitCar(ctx) {
    if (!player.car) return;
    const car = player.car;
    player.inCar = false;
    player.car = null;
    // step out on the driver's side
    const sx = Math.cos(car.heading);
    const sz = -Math.sin(car.heading);
    player.x = car.x + sx * 2.4;
    player.z = car.z + sz * 2.4;
    player.heading = car.heading;
    const res = ctx.city.resolveCircle(player.x, player.z, 0.8);
    player.x = res.x;
    player.z = res.z;
    mesh.visible = true;
    mesh.position.set(player.x, 0, player.z);
  }

  function reset(spawnPoint) {
    player.x = spawnPoint.x;
    player.z = spawnPoint.z;
    player.heading = 0;
    player.yaw = 0;
    player.speed = 0;
    player.health = TUNE.playerHealth;
    player.inCar = false;
    player.car = null;
    player.mag = TUNE.pistolMag;
    player.reserve = 96;
    player.down = false;
    mesh.visible = true;
    mesh.position.set(player.x, 0, player.z);
  }

  player.updateOnFoot = updateOnFoot;
  player.updateInCar = updateInCar;
  player.takeDamage = takeDamage;
  player.enterCar = enterCar;
  player.exitCar = exitCar;
  player.reset = reset;
  return player;
}
