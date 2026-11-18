// wanted.js — wanted stars, police cars, foot cops, busts.
import { CONFIG, PALETTE } from './config.js';

function makeCopMesh() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.34, 0.4, 1.05, 8),
    new THREE.MeshLambertMaterial({ color: 0x1a2a6b })
  );
  body.position.y = 0.92;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.29, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0xe0ac69 })
  );
  head.position.y = 1.68;
  g.add(head);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.3, 0.12, 10),
    new THREE.MeshLambertMaterial({ color: 0x101050 })
  );
  cap.position.y = 1.9;
  g.add(cap);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.48, 0.5, 0.32),
    new THREE.MeshLambertMaterial({ color: 0x101030 })
  );
  legs.position.y = 0.25;
  g.add(legs);
  return g;
}

export class Wanted {
  constructor(scene, city, vehicles, peds, audio, player) {
    this.scene = scene;
    this.city = city;
    this.vehicles = vehicles;
    this.peds = peds;
    this.audio = audio;
    this.player = player;
    this.stars = 0;
    this.cops = [];
    this.lastCrimeAt = -999;
    this.reasonCooldown = {};
    this.decayTimer = 0;
    this.bustTimer = 0;
    this.time = 0;
  }

  addStars(n, reason) {
    if (this.stars >= CONFIG.maxStars) return;
    const now = this.time;
    if (reason && this.reasonCooldown[reason] && now - this.reasonCooldown[reason] < 3) return;
    if (reason) this.reasonCooldown[reason] = now;
    this.stars = Math.min(CONFIG.maxStars, this.stars + n);
    this.lastCrimeAt = now;
    if (this.stars > 0) this.audio.siren(true, 0);
  }

  setStars(n) {
    this.stars = Math.max(0, Math.min(CONFIG.maxStars, n));
    this.lastCrimeAt = this.time;
  }

  clear() {
    this.stars = 0;
    this.bustTimer = 0;
    for (const cop of this.cops) this.scene.remove(cop.mesh);
    this.cops = [];
    for (const car of [...this.vehicles.policeCars]) this.vehicles.removePoliceCar(car);
  }

  spawnCop(x, z) {
    const mesh = makeCopMesh();
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const cop = { mesh, health: 100, state: 'chase', hitTimer: 0, downTimer: 0 };
    this.cops.push(cop);
    return cop;
  }

  damageCop(cop, dmg) {
    cop.health -= dmg;
    if (cop.health <= 0 && cop.state !== 'down') {
      cop.state = 'down';
      cop.downTimer = 6;
      cop.mesh.rotation.x = Math.PI / 2;
      cop.mesh.position.y = 0.3;
      this.addStars(2, 'cop-down');
    }
  }

  playerSpeed() {
    if (this.player.onFoot) {
      return 0; // on-foot speed is not tracked here; bust uses proximity + time
    }
    return Math.abs(this.player.carSpeed);
  }

  update(dt, ctx) {
    this.time += dt;
    const p = this.player;
    // Wanted decay: quiet for a while and no cop close.
    if (this.stars > 0 && this.time - this.lastCrimeAt > CONFIG.wantedDecaySeconds) {
      let nearest = 999;
      for (const cop of this.cops) {
        const d = Math.hypot(cop.mesh.position.x - p.pos.x, cop.mesh.position.z - p.pos.z);
        nearest = Math.min(nearest, d);
      }
      for (const car of this.vehicles.policeCars) {
        const d = Math.hypot(car.mesh.position.x - p.pos.x, car.mesh.position.z - p.pos.z);
        nearest = Math.min(nearest, d);
      }
      if (nearest > 45) {
        this.decayTimer += dt;
        if (this.decayTimer > 8) {
          this.decayTimer = 0;
          this.stars = Math.max(0, this.stars - 1);
        }
      }
    }
    // Siren while wanted.
    this.audio.siren(this.stars > 0, dt);
    if (this.stars === 0) {
      this.bustTimer = 0;
      return;
    }
    // Police cars: one per star, up to 3.
    const wantCars = Math.min(3, this.stars);
    while (this.vehicles.policeCars.length < wantCars) {
      const angle = Math.random() * Math.PI * 2;
      const x = p.pos.x + Math.cos(angle) * 70;
      const z = p.pos.z + Math.sin(angle) * 70;
      const fixed = this.city.resolve(x, z, 2);
      this.vehicles.spawnPoliceCar(fixed.x, fixed.z);
    }
    // Chase with police cars.
    for (const car of this.vehicles.policeCars) {
      const m = car.mesh;
      const dx = p.pos.x - m.position.x;
      const dz = p.pos.z - m.position.z;
      const dist = Math.hypot(dx, dz);
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - m.rotation.y;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      m.rotation.y += Math.max(-2.6 * dt, Math.min(2.6 * dt, dh));
      const speed = Math.min(CONFIG.policeSpeed, 18 + dist * 0.25);
      const nx = m.position.x + Math.sin(m.rotation.y) * speed * dt;
      const nz = m.position.z + Math.cos(m.rotation.y) * speed * dt;
      if (!this.city.blocked(nx, nz, 1.6)) {
        m.position.x = nx;
        m.position.z = nz;
      } else {
        m.rotation.y += 1.2 * dt;
      }
      // Ram the player.
      if (dist < 3.4) {
        if (p.onFoot) {
          p.takeDamage(12 * dt, m.position.x, m.position.z);
          ctx.effects.burst(p.pos.x, 1, p.pos.z, 0xff5555, 4);
        } else {
          p.carSpeed *= 0.92;
          ctx.camera.shake(0.2);
          if (Math.random() < dt * 2) this.audio.thud();
        }
      }
      // Flash the light bar.
      if (m.userData.lightBar) {
        m.userData.lightBar.material.color.setHex(Math.floor(this.time * 4) % 2 === 0 ? 0xff2222 : 0x2266ff);
      }
    }
    // Foot cops when the player is on foot.
    if (p.onFoot) {
      const wantCops = Math.min(2, this.stars);
      while (this.cops.length < wantCops) {
        const angle = Math.random() * Math.PI * 2;
        const x = p.pos.x + Math.cos(angle) * 25;
        const z = p.pos.z + Math.sin(angle) * 25;
        const fixed = this.city.resolve(x, z, 1);
        this.spawnCop(fixed.x, fixed.z);
      }
      for (const cop of this.cops) {
        if (cop.state === 'down') {
          cop.downTimer -= dt;
          if (cop.downTimer <= 0) {
            this.scene.remove(cop.mesh);
            this.cops = this.cops.filter((c) => c !== cop);
          }
          continue;
        }
        const m = cop.mesh;
        const dx = p.pos.x - m.position.x;
        const dz = p.pos.z - m.position.z;
        const dist = Math.hypot(dx, dz);
        m.rotation.y = Math.atan2(dx, dz);
        if (dist > 1.6) {
          m.position.x += (dx / dist) * 7 * dt;
          m.position.z += (dz / dist) * 7 * dt;
        } else {
          cop.hitTimer -= dt;
          if (cop.hitTimer <= 0) {
            cop.hitTimer = 1.0;
            p.takeDamage(8, m.position.x, m.position.z);
            this.audio.thud();
            ctx.camera.shake(0.25);
          }
        }
        const fixed = this.city.resolve(m.position.x, m.position.z, 0.5);
        m.position.x = fixed.x;
        m.position.z = fixed.z;
      }
    }
    // Bust: a cop close by while the player is slow.
    let bustNear = false;
    for (const cop of this.cops) {
      if (cop.state !== 'down') {
        const d = Math.hypot(cop.mesh.position.x - p.pos.x, cop.mesh.position.z - p.pos.z);
        if (d < CONFIG.bustDistance) bustNear = true;
      }
    }
    if (!bustNear) {
      for (const car of this.vehicles.policeCars) {
        const d = Math.hypot(car.mesh.position.x - p.pos.x, car.mesh.position.z - p.pos.z);
        if (d < CONFIG.bustDistance + 1) bustNear = true;
      }
    }
    const slow = p.onFoot || Math.abs(p.carSpeed) < 2;
    if (bustNear && slow && p.health > 0) {
      this.bustTimer += dt;
      if (this.bustTimer > CONFIG.bustTime) {
        this.bustTimer = 0;
        ctx.onBusted();
      }
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }
  }
}
