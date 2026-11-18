// player.js — Leo Marin on foot and behind the wheel: move, steal, drive, fight.
import { CONFIG } from './config.js';

function makePlayerMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.4, 1.05, 8),
    new THREE.MeshLambertMaterial({ color: 0x1a1a1a })
  );
  body.position.y = 0.92;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.29, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xe0ac69 })
  );
  head.position.y = 1.68;
  head.castShadow = true;
  g.add(head);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 0.12, 10),
    new THREE.MeshLambertMaterial({ color: 0xc0392b })
  );
  cap.position.y = 1.9;
  g.add(cap);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.5, 0.32),
    new THREE.MeshLambertMaterial({ color: 0x2c3e50 })
  );
  legs.position.y = 0.25;
  g.add(legs);
  return g;
}

export class Player {
  constructor(scene, city, vehicles, peds, audio, input) {
    this.scene = scene;
    this.city = city;
    this.vehicles = vehicles;
    this.peds = peds;
    this.audio = audio;
    this.input = input;
    this.mesh = makePlayerMesh();
    this.scene.add(this.mesh);
    this.pos = this.mesh.position;
    this.heading = 0;
    this.health = CONFIG.playerHealth;
    this.onFoot = true;
    this.car = null;
    this.carSpeed = 0;
    this.mag = CONFIG.pistolMag;
    this.reserve = CONFIG.pistolReserve;
    this.fistTimer = 0;
    this.shootTimer = 0;
    this.reloadTimer = 0;
    this.lastDamageAt = -99;
    this.time = 0;
    this.spawn(0, -30);
  }

  spawn(x, z) {
    this.pos.set(x, 0, z);
    this.heading = 0;
    this.mesh.rotation.y = 0;
    this.onFoot = true;
    this.car = null;
    this.carSpeed = 0;
    this.health = CONFIG.playerHealth;
    this.mesh.visible = true;
  }

  takeDamage(n, fromX, fromZ) {
    this.health -= n;
    this.lastDamageAt = this.time;
    if (this.health < 0) this.health = 0;
  }

  nearestCar(maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const car of this.vehicles.allCars()) {
      if (car.isPolice && car.occupied) continue;
      const dx = car.mesh.position.x - this.pos.x;
      const dz = car.mesh.position.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  enterCar(car, ctx) {
    this.car = car;
    this.onFoot = false;
    this.carSpeed = 0;
    car.stolen = true;
    car.occupied = true;
    this.mesh.visible = false;
    this.audio.blip(520);
    ctx.effects.burst(car.mesh.position.x, 1, car.mesh.position.z, 0xaaaaaa, 8);
    return car;
  }

  exitCar(ctx) {
    if (!this.car) return;
    const car = this.car;
    car.occupied = false;
    const side = this.carSpeed >= 0 ? 1 : -1;
    const px = car.mesh.position.x + Math.cos(car.mesh.rotation.y) * 2.2 * side;
    const pz = car.mesh.position.z - Math.sin(car.mesh.rotation.y) * 2.2 * side;
    const fixed = this.city.resolve(px, pz, CONFIG.playerRadius);
    this.pos.set(fixed.x, 0, fixed.z);
    this.heading = car.mesh.rotation.y;
    this.mesh.rotation.y = this.heading;
    this.mesh.visible = true;
    this.onFoot = true;
    this.car = null;
    this.carSpeed = 0;
  }

  update(dt, ctx) {
    this.time += dt;
    const input = this.input;
    this.fistTimer -= dt;
    this.shootTimer -= dt;
    if (this.reloadTimer > 0) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0 && this.reserve > 0) {
        const need = CONFIG.pistolMag - this.mag;
        const load = Math.min(need, this.reserve);
        this.mag += load;
        this.reserve -= load;
        this.audio.blip(880);
      }
    }
    // Slow health regen out of combat.
    if (this.time - this.lastDamageAt > 5 && this.health > 0 && this.health < CONFIG.playerHealth) {
      this.health = Math.min(CONFIG.playerHealth, this.health + 2 * dt);
    }

    if (this.onFoot) this.updateFoot(dt, ctx);
    else this.updateCar(dt, ctx);
  }

  updateFoot(dt, ctx) {
    const input = this.input;
    const camHeading = ctx.camera.heading;
    let mx = input.moveX();
    let my = input.moveY();
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      mx /= len;
      my /= len;
      // Camera-relative: forward is away from the camera.
      const fx = Math.sin(camHeading);
      const fz = Math.cos(camHeading);
      const rx = Math.cos(camHeading);
      const rz = -Math.sin(camHeading);
      const wx = fx * my + rx * mx;
      const wz = fz * my + rz * mx;
      const run = input.down('shift') ? CONFIG.runSpeed : CONFIG.walkSpeed;
      const nx = this.pos.x + wx * run * dt;
      const nz = this.pos.z + wz * run * dt;
      const fixed = this.city.resolve(nx, nz, CONFIG.playerRadius);
      this.pos.x = fixed.x;
      this.pos.z = fixed.z;
      const targetHeading = Math.atan2(wx, wz);
      let dh = targetHeading - this.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      this.heading += Math.max(-10 * dt, Math.min(10 * dt, dh));
      this.mesh.rotation.y = this.heading;
      // Walk bob.
      this.mesh.position.y = Math.abs(Math.sin(this.time * 10)) * 0.05;
    } else {
      this.mesh.position.y = 0;
    }

    // Enter a car.
    if (input.wasPressed('e')) {
      const car = this.nearestCar(3.5);
      if (car) {
        this.enterCar(car, ctx);
        ctx.wanted.addStars(1, 'steal');
        ctx.missions.onCarStolen(car, ctx);
        ctx.hud.flash('Car stolen — the heat is on!');
      }
    }
    // Fists.
    if ((input.wasPressed('f') || input.wasPressed('j')) && this.fistTimer <= 0) {
      this.fistTimer = CONFIG.fistCooldown;
      this.audio.thud();
      const hit = this.hitNearest(CONFIG.fistRange, CONFIG.fistDamage, ctx);
      if (hit) ctx.wanted.addStars(1, 'assault');
    }
    // Pistol: mouse click or K.
    if ((input.mousePressed || input.wasPressed('k')) && this.shootTimer <= 0 && this.reloadTimer <= 0) {
      this.shootTimer = 0.22;
      if (this.mag > 0) {
        this.mag--;
        this.audio.shot();
        ctx.effects.burst(this.pos.x, 1.5, this.pos.z, 0xffdd55, 6);
        this.shootAtCrosshair(ctx);
        ctx.wanted.addStars(1, 'shooting');
      } else {
        this.audio.blip(220);
        if (this.reserve > 0) this.reloadTimer = 1.0;
      }
    }
    if (input.wasPressed('r') && this.mag < CONFIG.pistolMag && this.reserve > 0 && this.reloadTimer <= 0) {
      this.reloadTimer = 1.0;
      this.audio.blip(440);
    }
  }

  hitNearest(range, dmg, ctx) {
    let best = null;
    let bestD = range;
    for (const p of this.peds.list) {
      if (p.state === 'down') continue;
      const dx = p.mesh.position.x - this.pos.x;
      const dz = p.mesh.position.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (best) {
      this.peds.knockDownAt(best.mesh.position.x, best.mesh.position.z, 1.5);
      this.peds.scare(this.pos.x, this.pos.z, this.pos.x, this.pos.z);
      ctx.effects.burst(best.mesh.position.x, 1.2, best.mesh.position.z, 0xff5555, 8);
      return true;
    }
    return false;
  }

  shootAtCrosshair(ctx) {
    // Ray from the camera through the screen centre; hit the first ped/cop in range.
    const dir = new THREE.Vector3();
    ctx.camera.camera.getWorldDirection(dir);
    const origin = ctx.camera.camera.position.clone();
    let best = null;
    let bestT = CONFIG.pistolRange;
    const targets = [];
    for (const p of this.peds.list) {
      if (p.state !== 'down') targets.push({ x: p.mesh.position.x, z: p.mesh.position.z, y: 1.2, ped: p });
    }
    for (const cop of ctx.wanted.cops) {
      targets.push({ x: cop.mesh.position.x, z: cop.mesh.position.z, y: 1.2, cop });
    }
    for (const t of targets) {
      const to = new THREE.Vector3(t.x - origin.x, t.y - origin.y, t.z - origin.z);
      const dist = to.length();
      if (dist > CONFIG.pistolRange) continue;
      to.normalize();
      const dot = to.dot(dir);
      if (dot < 0.995) continue;
      if (dist < bestT) {
        bestT = dist;
        best = t;
      }
    }
    if (best) {
      if (best.ped) {
        this.peds.knockDownAt(best.x, best.z, 1.5);
        this.peds.scare(best.x, best.z, this.pos.x, this.pos.z);
      } else if (best.cop) {
        ctx.wanted.damageCop(best.cop, CONFIG.pistolDamage);
      }
      ctx.effects.burst(best.x, best.y, best.z, 0xff5555, 10);
    }
  }

  updateCar(dt, ctx) {
    const input = this.input;
    const car = this.car;
    if (!car) {
      this.onFoot = true;
      return;
    }
    const mesh = car.mesh;
    const handbrake = input.down(' ');
    const accel = input.down('w') || input.down('arrowup') ? 1 : 0;
    const brake = input.down('s') || input.down('arrowdown') ? 1 : 0;
    const steer = input.moveX();
    if (accel) this.carSpeed += CONFIG.carAccel * dt;
    if (brake) {
      if (this.carSpeed > 0.5) this.carSpeed -= CONFIG.carBrake * dt;
      else this.carSpeed -= CONFIG.carAccel * 0.6 * dt;
    }
    if (!accel && !brake) this.carSpeed -= Math.sign(this.carSpeed) * 6 * dt;
    if (handbrake) this.carSpeed -= Math.sign(this.carSpeed) * 18 * dt;
    this.carSpeed = Math.max(-CONFIG.carReverseMax, Math.min(CONFIG.carMaxSpeed, this.carSpeed));
    if (Math.abs(this.carSpeed) < 0.05) this.carSpeed = 0;
    const turnRate = (handbrake ? CONFIG.handbrakeTurn : CONFIG.carTurn) * Math.min(1, Math.abs(this.carSpeed) / 8);
    mesh.rotation.y -= steer * turnRate * dt * Math.sign(this.carSpeed || 1);
    const nx = mesh.position.x + Math.sin(mesh.rotation.y) * this.carSpeed * dt;
    const nz = mesh.position.z + Math.cos(mesh.rotation.y) * this.carSpeed * dt;
    // Buildings.
    if (this.city.blocked(nx, nz, CONFIG.carRadius)) {
      const fixed = this.city.resolve(mesh.position.x, mesh.position.z, CONFIG.carRadius);
      mesh.position.x = fixed.x;
      mesh.position.z = fixed.z;
      if (Math.abs(this.carSpeed) > 8) {
        this.audio.thud();
        ctx.effects.burst(mesh.position.x, 1, mesh.position.z, 0xcccccc, 10);
        ctx.camera.shake(0.35);
      }
      this.carSpeed *= -0.25;
    } else {
      mesh.position.x = nx;
      mesh.position.z = nz;
    }
    // Bump traffic cars.
    for (const other of this.vehicles.traffic) {
      if (other === car || other.stolen) continue;
      const dx = other.mesh.position.x - mesh.position.x;
      const dz = other.mesh.position.z - mesh.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 3.2 && d > 0.01) {
        this.carSpeed *= 0.55;
        other.mesh.position.x += (dx / d) * 0.5;
        other.mesh.position.z += (dz / d) * 0.5;
        if (Math.abs(this.carSpeed) > 6) {
          this.audio.thud();
          ctx.effects.burst(mesh.position.x, 1, mesh.position.z, 0xffcc00, 8);
        }
      }
    }
    // Run over pedestrians.
    if (Math.abs(this.carSpeed) > 6) {
      const hit = this.peds.knockDownAt(mesh.position.x, mesh.position.z, 2.4);
      if (hit > 0) {
        ctx.wanted.addStars(1, 'hit-ped');
        this.audio.thud();
        ctx.effects.burst(mesh.position.x, 1, mesh.position.z, 0xff5555, 10);
        ctx.camera.shake(0.3);
      }
    }
    // Engine + speed lines.
    ctx.audio.engine(Math.abs(this.carSpeed) / CONFIG.carMaxSpeed, true);
    // Exit the car.
    if (input.wasPressed('e')) this.exitCar(ctx);
    // Mission progress (driving to objectives).
    ctx.missions.onDriveTick(car, ctx);
  }
}
