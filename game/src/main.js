// main.js — SOLMAR HEAT bootstrap: renderer, world, state machine, save, shots.
import { CONFIG } from './config.js';
import { RNG } from './random.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { City } from './city.js';
import { Vehicles } from './vehicles.js';
import { Peds } from './peds.js';
import { Player } from './player.js';
import { Wanted } from './wanted.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { CameraRig } from './camera.js';
import { Effects } from './effects.js';
import { runShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const seed = parseInt(params.get('seed') || '1337', 10);
const lowFx = params.has('fx') && params.get('fx') === 'low';
const shotName = params.get('shot') || null;

class Game {
  constructor() {
    this.rng = new RNG(seed);
    this.input = new Input();
    this.audio = new AudioSys();
    this.cash = 0;
    this.state = 'title';
    this.shotMode = shotName !== null;
    this.pendingAction = null;
    this.time = 0;

    const canvas = document.getElementById('game-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowFx });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(lowFx ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !lowFx;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(CONFIG.skyColor);
    this.scene.fog = new THREE.Fog(CONFIG.fogColor, 180, 420);

    const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5a, 0.9);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(CONFIG.sunColor, 1.6);
    sun.position.set(80, 140, 40);
    sun.castShadow = !lowFx;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -200;
    sun.shadow.camera.right = 200;
    sun.shadow.camera.top = 200;
    sun.shadow.camera.bottom = -200;
    sun.shadow.camera.far = 400;
    this.scene.add(sun);

    this.city = new City(this.scene, this.rng, lowFx);
    this.vehicles = new Vehicles(this.scene, this.city, this.rng);
    this.peds = new Peds(this.scene, this.city, this.rng);
    this.effects = new Effects(this.scene, lowFx);
    this.camera = new CameraRig(this.scene);
    this.player = new Player(this.scene, this.city, this.vehicles, this.peds, this.audio, this.input);
    this.wanted = new Wanted(this.scene, this.city, this.vehicles, this.peds, this.audio, this.player);
    this.missions = new Missions(this.scene, this.city, this.vehicles, this.rng);
    this.hud = new HUD({
      onNewGame: () => this.newGame(),
      onContinue: () => this.continueGame(),
      onGo: () => this.goMission(),
      onSplash: () => this.splashContinue(),
      onResume: () => this.resume(),
    });
    // Audio starts on the first gesture.
    const gesture = () => this.audio.init();
    window.addEventListener('pointerdown', gesture, { once: true });
    window.addEventListener('keydown', gesture, { once: true });

    // Test hooks (also used by the shot scenes). Live getters: newGame()
    // replaces the missions object, so a snapshot would go stale.
    const self = this;
    window.__game = {
      game: this,
      state: () => this.state,
      cash: () => this.cash,
      get player() { return self.player; },
      get missions() { return self.missions; },
      get wanted() { return self.wanted; },
      get vehicles() { return self.vehicles; },
      get city() { return self.city; },
      get camera() { return self.camera; },
      get hud() { return self.hud; },
    };

    if (this.shotMode) {
      this.state = 'playing';
      this.cash = 500;
      runShot(shotName, this);
    } else {
      const save = this.loadSave();
      this.hud.showTitle(!!save);
      this.state = 'title';
    }
    this.last = performance.now();
    const loop = (now) => {
      requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.frame(dt);
    };
    requestAnimationFrame(loop);
  }

  // One ambient step (no player input): traffic, peds, police, effects, camera.
  stepAmbient(dt) {
    this.time += dt;
    this.vehicles.update(dt);
    this.peds.update(dt);
    this.wanted.update(dt, this);
    this.missions.update(dt, this);
    this.city.update(dt, this.time);
    this.effects.update(dt);
    const target = this.player.onFoot ? this.player.pos : this.player.car ? this.player.car.mesh.position : this.player.pos;
    this.camera.update(dt, target, this.player.heading, !this.player.onFoot);
    this.hud.update(dt, this);
  }

  frame(dt) {
    this.time += dt;
    if (this.state === 'title') {
      // Slow orbit over the city behind the title screen.
      const a = this.time * 0.05;
      this.camera.setPose(Math.sin(a) * 120, 60, Math.cos(a) * 120, 0, 0, 0);
      this.stepAmbient(dt);
      this.renderer.render(this.scene, this.camera.camera);
      this.input.endFrame();
      return;
    }
    if (this.state === 'paused') {
      this.renderer.render(this.scene, this.camera.camera);
      if (this.input.wasPressed('escape')) this.resume();
      this.input.endFrame();
      return;
    }
    if (this.state === 'splash') {
      this.renderer.render(this.scene, this.camera.camera);
      this.input.endFrame();
      return;
    }
    // Playing.
    if (this.input.wasPressed('escape')) {
      this.state = 'paused';
      this.hud.showPause();
      this.input.endFrame();
      return;
    }
    if (this.input.wasPressed('m')) this.audio.setMuted(!this.audio.muted);
    this.player.update(dt, this);
    this.stepAmbient(dt);
    // Health / wasted check.
    if (this.player.health <= 0) {
      this.onWasted();
    } else {
      this.audio.engine(0, false);
    }
    this.renderer.render(this.scene, this.camera.camera);
    this.input.endFrame();
  }

  newGame() {
    localStorage.removeItem(CONFIG.saveKey);
    this.cash = 0;
    if (this.missions) this.scene.remove(this.missions.beacon);
    this.missions = new Missions(this.scene, this.city, this.vehicles, this.rng);
    this.player.spawn(0, -30);
    this.wanted.clear();
    this.hud.hideTitle();
    this.state = 'playing';
    this.missions.showCard(this);
    this.saveGame();
  }

  continueGame() {
    const save = this.loadSave();
    if (!save) return this.newGame();
    this.cash = save.cash || 0;
    this.missions.loadState(save);
    this.player.spawn(save.px ?? 0, save.pz ?? -30);
    this.wanted.clear();
    this.hud.hideTitle();
    this.state = 'playing';
    this.missions.showCard(this);
  }

  goMission() {
    this.missions.begin(this);
  }

  splashContinue() {
    this.hud.hideSplash();
    const action = this.pendingAction;
    this.pendingAction = null;
    if (action === 'respawn') {
      const h = this.city.places.hospital;
      this.player.spawn(h.x, h.z);
      this.wanted.clear();
      this.state = 'playing';
      this.missions.showCard(this);
      this.saveGame();
    } else {
      // Mission complete / failed: show the next (or same) mission card.
      this.state = 'playing';
      this.missions.showCard(this);
      this.saveGame();
    }
  }

  resume() {
    this.hud.hidePause();
    this.state = 'playing';
  }

  onBusted() {
    if (this.shotMode || this.state !== 'playing') return;
    const fine = Math.min(this.cash, CONFIG.bustFine);
    this.cash -= fine;
    this.state = 'splash';
    this.pendingAction = 'respawn';
    this.hud.showBusted(fine);
    this.audio.blip(180);
    this.saveGame();
  }

  onWasted() {
    if (this.shotMode || this.state !== 'playing') return;
    this.cash = Math.max(0, this.cash - 100);
    this.state = 'splash';
    this.pendingAction = 'respawn';
    this.hud.showWasted();
    this.audio.blip(180);
    this.saveGame();
  }

  onMissionComplete() {
    if (this.shotMode) return;
    this.state = 'splash';
    this.pendingAction = 'next-card';
    this.saveGame();
  }

  onMissionFailed() {
    if (this.shotMode) return;
    this.state = 'splash';
    this.pendingAction = 'next-card';
    this.saveGame();
  }

  saveGame() {
    try {
      localStorage.setItem(CONFIG.saveKey, JSON.stringify({
        cash: this.cash,
        px: this.player.pos.x,
        pz: this.player.pos.z,
        ...this.missions.saveState(),
      }));
    } catch (e) {
      /* storage unavailable — the game still plays */
    }
  }

  loadSave() {
    try {
      const raw = localStorage.getItem(CONFIG.saveKey);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  try {
    new Game();
  } catch (err) {
    const pre = document.createElement('pre');
    pre.textContent = `SOLMAR HEAT failed to start: ${err.message}\n${err.stack || ''}`;
    pre.style.cssText = 'position:fixed;inset:0;background:#200;color:#fff;padding:20px;z-index:99;white-space:pre-wrap';
    document.body.appendChild(pre);
    window.__gameError = String(err && err.stack || err);
  }
});
