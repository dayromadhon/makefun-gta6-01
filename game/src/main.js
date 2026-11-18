// SOLMAR HEAT — the game. Wires the city, cars, peds, player, wanted system,
// missions, HUD, camera, effects and audio into one loop, plus save/load,
// the title/pause/busted screens, and the ?shot= / ?fx=low / ?seed= modes.

import * as THREE from 'three';
import { WORLD, COLORS, PLAYER, CAR, DEBT, SAVE_KEY, SHOT_SEED } from './config.js';
import { Rng, clamp, dist2d } from './random.js';
import { Input } from './input.js';
import { AudioEngine } from './audio.js';
import { City } from './city.js';
import { VehicleManager } from './vehicles.js';
import { PedManager } from './peds.js';
import { Player } from './player.js';
import { WantedSystem } from './wanted.js';
import { MissionManager } from './missions.js';
import { Hud } from './hud.js';
import { CameraRig } from './camera.js';
import { Effects } from './effects.js';
import { stageShot } from './shots.js';

const STEP = 1 / 60;

export class Game {
  constructor() {
    this.params = new URLSearchParams(window.location.search);
    this.seed = parseInt(this.params.get('seed') || String(SHOT_SEED), 10) || SHOT_SEED;
    this.fxLow = this.params.get('fx') === 'low';
    this.shotName = this.params.get('shot') || null;
    this.state = 'title'; // title | playing | paused | busted | complete | debt
    this.time = 0;
    this.events = [];
    this.shootQueued = false;
    this._completePending = null;

    // Renderer.
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(this.fxLow ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.getElementById('app').appendChild(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.sky);
    this.scene.fog = new THREE.Fog(COLORS.fog, 120, 420);
    this.camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);

    // Lights: a warm sun and a soft sky fill.
    const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.9);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(COLORS.sun, 1.6);
    sun.position.set(80, 120, 40);
    this.scene.add(sun);

    this.input = new Input();
    this.input.attach();
    this.audio = new AudioEngine();
    this.hud = new Hud();
    this.cameraRig = new CameraRig(this.camera);
    this.effects = new Effects(this.scene);

    this._buildWorld(this.seed);

    // HUD buttons. The primary button is state-aware: Start on the title
    // screen, Resume everywhere else. Continue loads the save.
    this.hud.onStart(() => {
      if (this.state === 'title') this.startGame(true);
      else this.resume();
    });
    this.hud.onContinue(() => this.startGame(false));

    // Shooting: a click queues a shot (the loop consumes it).
    window.addEventListener('mousedown', (e) => {
      if (e.target.closest('button')) return;
      this.audio.ensure();
      if (this.state === 'playing' && !this.player.inCar) this.shootQueued = true;
    });
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Title screen (or a staged ?shot= frame).
    if (this.shotName) {
      this._stageShot();
    } else {
      this.hud.showScreen('title', { hasSave: this.hasSave() });
    }
    window.__game = this;
    this._last = performance.now();
    this._loop();
  }

  _buildWorld(seed) {
    // Clear the old world (a reset rebuilds everything from the seed).
    if (this.city) this.scene.remove(this.city.group);
    if (this.vehicles) for (const c of this.vehicles.cars) this.scene.remove(c.mesh);
    if (this.peds) for (const p of this.peds.peds) this.scene.remove(p.mesh);
    if (this.player) this.scene.remove(this.player.mesh);
    this.city = new City(seed);
    this.scene.add(this.city.group);
    this.vehicles = new VehicleManager(this.scene, this.city, seed);
    this.peds = new PedManager(this.scene, seed);
    this.player = new Player(this.scene, this.city, 0, 0);
    this.wanted = new WantedSystem();
    this.missions = new MissionManager(this.city.places, seed);
    if (this.fxLow) {
      // Trim the crowd and traffic on weak machines.
      this.peds.peds = this.peds.peds.slice(0, 10);
      this.vehicles.cars = this.vehicles.cars.filter((c) => c.parked || this.vehicles.cars.indexOf(c) < 8);
    }
  }

  /** Rebuild the world from a seed (used by ?shot= and by a fresh start). */
  reset(seed = this.seed) {
    this._buildWorld(seed);
    this.time = 0;
    this.events = [];
    this.state = 'playing';
  }

  hasSave() {
    try {
      return !!localStorage.getItem(SAVE_KEY);
    } catch {
      return false;
    }
  }

  save() {
    try {
      const data = {
        player: this.player.toSave(),
        missionIndex: this.missions.index,
        savedAt: Date.now(),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    } catch {
      // Storage unavailable — the game still plays.
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw);
      this.player.fromSave(data.player);
      this.missions.fromSave(data.missionIndex || 0);
      return true;
    } catch {
      return false;
    }
  }

  startGame(fresh) {
    this.audio.ensure();
    if (fresh) {
      this.reset(this.seed);
    } else if (!this.load()) {
      this.reset(this.seed);
    }
    this.state = 'playing';
    this.hud.hideScreen();
    this.hud.showToast(this.missions.current
      ? `Mission ${this.missions.index + 1}: ${this.missions.current.name} — ${this.missions.current.brief}`
      : 'Free roam — side jobs keep paying.');
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.save();
    this.hud.showScreen('pause');
  }

  resume() {
    if (this.state !== 'paused' && this.state !== 'complete' && this.state !== 'debt' && this.state !== 'busted') return;
    this.state = 'playing';
    this.hud.hideScreen();
  }

  bust() {
    this.state = 'busted';
    this.player.cash = Math.max(0, this.player.cash - 100);
    this.wanted.clear();
    this.vehicles.removePolice();
    this.player.health = PLAYER.health;
    this.player.fromSave({
      x: this.city.places.hospital.x,
      z: this.city.places.hospital.z,
      heading: 0,
      health: PLAYER.health,
      cash: this.player.cash,
      ammo: this.player.ammo,
      ammoReserve: this.player.ammoReserve,
    });
    this.audio.busted();
    this.save();
    this.hud.showScreen('busted');
  }

  _stageShot() {
    this.state = 'playing';
    const { screen } = stageShot(this.shotName, this);
    // Keep the HUD visible over the staged frame; no menu overlay.
    this.hud.hideScreen();
    this._renderOnce();
    window.__shotReady = true;
  }

  _renderOnce() {
    this._updateHud(STEP);
    this.renderer.render(this.scene, this.camera);
  }

  /** One fixed simulation step. scripted=true when a ?shot= scene drives it. */
  step(dt, scripted = false) {
    this.time += dt;
    const p = this.player;
    const input = this.input;
    const inCar = !!p.inCar;

    // --- Player input (only when actually playing) ---
    if (this.state === 'playing') {
      // Pause / mute.
      if (input.wasPressed('Escape')) {
        this.pause();
        input.endFrame();
        return;
      }
      if (input.wasPressed('KeyM')) {
        this.audio.setMuted(!this.audio.muted);
      }
      // Enter / exit a car.
      if (input.wasPressed('KeyE')) {
        if (inCar) {
          p.exitCar();
        } else {
          const car = this.vehicles.nearestCar(p.x, p.z, 4.5);
          if (car) {
            const firstSteal = !car.stolen;
            p.enterCar(car);
            if (firstSteal) this.wanted.addHeat(1.0, 'steal');
            this.audio.click();
          }
        }
      }
      // Punch.
      if (input.wasPressed('KeyF') && !inCar) {
        const targets = this.peds.peds.filter((ped) => !ped.down);
        const hit = p.punch(targets);
        if (hit) {
          this.audio.punch();
          if (hit.knockDown()) {
            this.wanted.addHeat(0.6, 'hit-ped');
            this.effects.dust(hit.x, hit.z);
          }
        }
      }
      // Reload.
      if (input.wasPressed('KeyR') && !inCar) p.startReload();
      // Shoot (a stale click while driving is dropped, not fired later).
      if (this.shootQueued) {
        this.shootQueued = false;
        if (!inCar) {
        const targets = [
          ...this.peds.peds.filter((ped) => !ped.down).map((ped) => ({ x: ped.x, z: ped.z, kind: 'ped', ref: ped })),
          ...this.vehicles.police.map((c) => ({ x: c.x, z: c.z, kind: 'police', ref: c })),
        ];
        const res = p.shoot(targets);
        if (res.fired) {
          this.audio.gunshot();
          const mx = p.x + Math.sin(p.heading) * 1.2;
          const mz = p.z + Math.cos(p.heading) * 1.2;
          this.effects.muzzle(mx, 1.2, mz);
          this.wanted.addHeat(0.4, 'shoot');
          if (res.hit) {
            if (res.hit.kind === 'ped') {
              if (res.hit.ref.knockDown()) this.wanted.addHeat(0.6, 'hit-ped');
            } else {
              res.hit.ref.speed *= 0.4;
              this.effects.sparks(res.hit.ref.x, res.hit.ref.z);
            }
          }
        }
        }
      }
      // Movement.
      const fwd = (input.down('KeyW') || input.down('ArrowUp') ? 1 : 0) - (input.down('KeyS') || input.down('ArrowDown') ? 1 : 0);
      const strafe = (input.down('KeyD') || input.down('ArrowRight') ? 1 : 0) - (input.down('KeyA') || input.down('ArrowLeft') ? 1 : 0);
      const run = input.down('ShiftLeft') || input.down('ShiftRight');
      const handbrake = input.down('Space');
      if (inCar) {
        const speed = p.driveCar(fwd, strafe, handbrake, dt);
        // Drift dust + a scrape when sliding hard.
        if (handbrake && Math.abs(speed) > 8) this.effects.dust(p.x, p.z);
        this.audio.engine(Math.abs(speed) / CAR.maxSpeed, true);
      } else {
        // On foot: move relative to the camera yaw.
        const camYaw = this.cameraRig.yaw + p.heading * 0;
        const sin = Math.sin(this.cameraRig.yaw);
        const cos = Math.cos(this.cameraRig.yaw);
        const mx = fwd * -sin + strafe * cos;
        const mz = fwd * -cos - strafe * sin;
        p.walk(mx, mz, run, dt);
        this.audio.engine(0, false);
      }
      p.update(dt);
    }

    // --- World simulation (runs in every state so the title screen is alive) ---
    const playerPos = { x: p.x, z: p.z };
    const playerSpeed = Math.abs(p.speed);
    this.vehicles.update(dt, playerPos, this.state === 'playing' ? playerPos : null, this.time);
    this.peds.update(dt, playerPos, playerSpeed, null);

    // --- Wanted + police (only while playing) ---
    if (this.state === 'playing') {
      const wantPolice = this.wanted.update(dt, playerPos, playerSpeed, this.vehicles.police);
      this.vehicles.ensurePolice(wantPolice, playerPos);
      const nearPolice = this.vehicles.police.some((c) => dist2d(p.x, p.z, c.x, c.z) < 12);
      this.audio.siren(nearPolice);
      // Police ramming hurts and shakes the camera.
      for (const pc of this.vehicles.police) {
        if (dist2d(p.x, p.z, pc.x, pc.z) < 3.0) {
          if (p.takeDamage(8 * dt)) {
            this.cameraRig.addShake(0.25);
            this.effects.sparks(p.x, p.z);
            this.audio.crash();
          }
        }
      }
      // A car hitting a pedestrian is a crime too.
      if (inCar && Math.abs(p.speed) > 6) {
        const hit = this.peds.nearest(p.x, p.z, 2.4);
        if (hit && !hit.down) {
          hit.knockDown();
          this.wanted.addHeat(0.6, 'hit-ped');
          this.effects.dust(hit.x, hit.z);
          this.cameraRig.addShake(0.3);
          this.audio.crash();
        }
      }
      // Busted / dead.
      if (this.wanted.busted || p.health <= 0) {
        this.bust();
        input.endFrame();
        return;
      }
      // Missions.
      const events = [];
      this.missions.update(dt, { player: p, vehicles: this.vehicles, wanted: this.wanted, events });
      for (const e of events) this._handleEvent(e);
    }

    // --- Effects, camera, HUD ---
    this.effects.update(dt);
    const obj = this.missions.objective;
    this.effects.setBeacon(obj ? obj.x : null, obj ? obj.z : null);
    const drag = input.drag();
    this.cameraRig.update(dt, { x: p.x, y: 0, z: p.z }, p.heading, !!p.inCar, drag, this.city);
    this._updateHud(dt);
    input.endFrame();
  }

  _handleEvent(e) {
    if (e.type === 'message') {
      this.hud.showToast(e.text, 3.5);
    } else if (e.type === 'mission-start') {
      this.hud.showToast(`Mission ${this.missions.index + 1}: ${e.mission.name}`, 3);
      if (e.mission.id === 'heat') this.wanted.setHeat(e.mission.setWanted);
      if (e.mission.id === 'taxi') {
        // Park a taxi near the player for the fares.
        const taxi = this.vehicles.cars.find((c) => c.kind === 'taxi');
        if (taxi) {
          taxi.x = this.player.x + 6;
          taxi.z = this.player.z + 2;
          taxi.parked = true;
          taxi.mesh.position.set(taxi.x, 0, taxi.z);
        }
      }
    } else if (e.type === 'mission-complete') {
      this.audio.missionDone();
      this.save();
      const next = this.missions.current;
      if (!next && this.player.cash >= DEBT) {
        // Story done and the debt is paid: the debt screen, not another card.
        this.state = 'debt';
        this.hud.showScreen('debt');
      } else {
        this._completePending = { mission: e.mission, cash: this.player.cash, next };
        this.state = 'complete';
        this.hud.showScreen('complete', { mission: e.mission, cash: this.player.cash, next });
      }
    }
  }

  _updateHud(dt) {
    const p = this.player;
    const obj = this.missions.objective;
    const m = this.missions.current;
    this.hud.update({
      dt,
      cash: p.cash,
      health: p.health,
      stars: this.wanted.stars,
      heatFlash: this.wanted.heatFlash,
      ammo: p.ammo,
      ammoReserve: p.ammoReserve,
      reloading: p.reloadTimer > 0,
      speed: p.speed,
      inCar: !!p.inCar,
      mission: m,
      missionIndex: this.missions.index,
      objective: obj,
      objectiveLabel: this.missions.objectiveLabel,
      objectiveDist: obj ? dist2d(p.x, p.z, obj.x, obj.z) : null,
      timer: this.missions.timer,
      playerX: p.x,
      playerZ: p.z,
      playerHeading: p.heading,
      police: this.vehicles.police,
    });
  }

  _loop() {
    const now = performance.now();
    let dt = (now - this._last) / 1000;
    this._last = now;
    dt = Math.min(dt, 0.1);
    if (this.shotName) {
      // A staged frame: render once per animation frame, no simulation.
      this.renderer.render(this.scene, this.camera);
      requestAnimationFrame(() => this._loop());
      return;
    }
    // Fixed-step accumulator so the sim is stable at any frame rate.
    this._acc = (this._acc || 0) + dt;
    let n = 0;
    while (this._acc >= STEP && n < 5) {
      this.step(STEP);
      this._acc -= STEP;
      n++;
    }
    if (n === 5) this._acc = 0;
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(() => this._loop());
  }
}

// Boot.
window.addEventListener('DOMContentLoaded', () => {
  new Game();
});
