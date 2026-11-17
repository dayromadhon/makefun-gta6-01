// Solmar Heat — Leo Marin on foot. One job: walking, getting in and out
// of cars, and combat (fists and pistol) when not driving.
import { PLAYER, PLACES, ECONOMY } from './config.js';
import { clamp, dist2d, angleDiff } from './random.js';

export class Player {
  constructor(scene, city, rng, fxLow, hooks) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.fxLow = fxLow;
    this.hooks = hooks; // { onShoot(x,z,heading), onPunch(), onEnterCar(), onExitCar() }
    this.x = PLACES.start.x;
    this.z = PLACES.start.z;
    this.yaw = Math.PI; // camera-relative facing; PI = facing -z (north)
    this.health = PLAYER.health;
    this.cash = ECONOMY.startCash;
    this.inCar = false;
    this.car = null;
    this.weapon = 'fists'; // 'fists' | 'pistol'
    this.ammo = PLAYER.pistolMag;
    this.punchCooldown = 0;
    this.shootCooldown = 0;
    this.mesh = this.makeMesh();
    scene.add(this.mesh);
    this.updateMesh();
  }

  makeMesh() {
    const g = new THREE.Group();
    const jacket = new THREE.MeshLambertMaterial({ color: 0xc23b2e });
    const jeans = new THREE.MeshLambertMaterial({ color: 0x2a3a5a });
    const skin = new THREE.MeshLambertMaterial({ color: 0xe8b88a });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.1, 8), jacket);
    body.position.y = 0.98;
    body.castShadow = !this.fxLow;
    g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 10, 8), skin);
    head.position.y = 1.78;
    head.castShadow = !this.fxLow;
    g.add(head);
    const legs = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.5, 0.32), jeans);
    legs.position.y = 0.25;
    g.add(legs);
    // Pistol in hand when armed.
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.14, 0.5), new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
    gun.position.set(0.42, 1.05, 0.3);
    gun.name = 'gun';
    gun.visible = false;
    g.add(gun);
    g.userData.gun = gun;
    return g;
  }

  updateMesh() {
    this.mesh.position.set(this.x, 0, this.z);
    this.mesh.rotation.y = this.yaw;
    this.mesh.visible = !this.inCar;
    if (this.mesh.userData.gun) {
      this.mesh.userData.gun.visible = !this.inCar && this.weapon === 'pistol';
    }
  }

  // Per-frame on-foot movement. camYaw: the camera's yaw; forward is
  // camera-relative (W walks away from the camera).
  updateOnFoot(dt, input, camYaw) {
    this.punchCooldown = Math.max(0, this.punchCooldown - dt);
    this.shootCooldown = Math.max(0, this.shootCooldown - dt);
    let mx = 0;
    let mz = 0;
    if (input.down('KeyW') || input.down('ArrowUp')) mz += 1;
    if (input.down('KeyS') || input.down('ArrowDown')) mz -= 1;
    if (input.down('KeyA') || input.down('ArrowLeft')) mx -= 1;
    if (input.down('KeyD') || input.down('ArrowRight')) mx += 1;
    const run = input.down('ShiftLeft') || input.down('ShiftRight');
    const speed = run ? PLAYER.runSpeed : PLAYER.walkSpeed;
    if (mx !== 0 || mz !== 0) {
      // Camera-relative: forward is the direction the camera looks.
      const fx = Math.sin(camYaw);
      const fz = Math.cos(camYaw);
      const rx = Math.cos(camYaw);
      const rz = -Math.sin(camYaw);
      let dx = fx * mz + rx * mx;
      let dz = fz * mz + rz * mx;
      const len = Math.hypot(dx, dz) || 1;
      dx /= len;
      dz /= len;
      // Face the direction of travel when moving forward or back; a pure
      // strafe keeps Leo facing the camera.
      if (mz !== 0) this.yaw = Math.atan2(dx, dz);
      let nx = this.x + dx * speed * dt;
      let nz = this.z + dz * speed * dt;
      nx = clamp(nx, -128, 132);
      nz = clamp(nz, -128, 138);
      [nx, nz] = this.city.resolveSolids(nx, nz, 0.5);
      this.x = nx;
      this.z = nz;
    }
    this.updateMesh();
    return { moving: mx !== 0 || mz !== 0 };
  }

  // Try to steal the nearest parked car. Returns the car or null.
  trySteal(vehicles) {
    if (this.inCar) return null;
    const car = vehicles.nearestParked(this.x, this.z, 4.5);
    if (!car) return null;
    vehicles.steal(car);
    this.inCar = true;
    this.car = car;
    this.x = car.x;
    this.z = car.z;
    this.yaw = car.heading;
    this.updateMesh();
    if (this.hooks.onEnterCar) this.hooks.onEnterCar(car);
    return car;
  }

  // Step out of the car beside it.
  exitCar(vehicles) {
    if (!this.inCar || !this.car) return;
    const car = vehicles.abandon();
    const side = this.yaw + Math.PI / 2;
    this.x = car.x + Math.sin(side) * 2.4;
    this.z = car.z + Math.cos(side) * 2.4;
    [this.x, this.z] = this.city.resolveSolids(this.x, this.z, 0.5);
    this.inCar = false;
    this.car = null;
    this.updateMesh();
    if (this.hooks.onExitCar) this.hooks.onExitCar();
  }

  // Sync the on-foot position to the driven car (called every frame while
  // driving so missions, camera, minimap and wanted all read the car).
  syncToCar() {
    if (!this.inCar || !this.car) return;
    this.x = this.car.x;
    this.z = this.car.z;
    this.yaw = this.car.heading;
    this.updateMesh();
  }

  get carSpeed() {
    return this.inCar && this.car ? this.car.speed : 0;
  }

  get heading() {
    return this.inCar && this.car ? this.car.heading : this.yaw;
  }

  toggleWeapon() {
    this.weapon = this.weapon === 'fists' ? 'pistol' : 'fists';
    if (this.weapon === 'pistol' && this.ammo <= 0) this.ammo = 0;
    this.updateMesh();
    return this.weapon;
  }

  reload() {
    if (this.weapon !== 'pistol') return false;
    if (this.ammo === PLAYER.pistolMag) return false;
    this.ammo = PLAYER.pistolMag;
    return true;
  }

  // Melee: hurt the nearest ped or cop within reach in front of Leo.
  punch(targets) {
    if (this.inCar || this.punchCooldown > 0) return false;
    this.punchCooldown = 0.45;
    const fx = Math.sin(this.yaw);
    const fz = Math.cos(this.yaw);
    for (const t of targets) {
      const dx = t.x - this.x;
      const dz = t.z - this.z;
      const d = Math.hypot(dx, dz);
      if (d < 2.2 && (dx * fx + dz * fz) / (d || 1) > 0.3) {
        if (this.hooks.onPunch) this.hooks.onPunch(t);
        return true;
      }
    }
    if (this.hooks.onPunch) this.hooks.onPunch(null);
    return true;
  }

  // Fire the pistol straight ahead. Returns the bullet ray for hit tests.
  shoot() {
    if (this.inCar || this.weapon !== 'pistol') return null;
    if (this.shootCooldown > 0 || this.ammo <= 0) return null;
    this.shootCooldown = 0.28;
    this.ammo -= 1;
    const ray = {
      x: this.x,
      z: this.z,
      dx: Math.sin(this.yaw),
      dz: Math.cos(this.yaw),
      range: PLAYER.pistolRange,
    };
    if (this.hooks.onShoot) this.hooks.onShoot(ray);
    return ray;
  }

  hurt(amount) {
    this.health = Math.max(0, this.health - amount);
    return this.health;
  }

  heal(amount) {
    this.health = Math.min(PLAYER.health, this.health + amount);
  }

  respawnAt(x, z) {
    this.x = x;
    this.z = z;
    if (this.inCar) {
      this.inCar = false;
      this.car = null;
    }
    this.health = PLAYER.health;
    this.updateMesh();
  }
}
