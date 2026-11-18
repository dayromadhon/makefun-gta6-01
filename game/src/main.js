// SOLMAR HEAT — main. Bootstraps the renderer, the world and the game
// loop; owns the state machine (title / playing / paused / busted /
// mission card) and the save in localStorage.

import * as THREE from 'three';
import { CFG, MISSIONS } from './config.js';
import { RNG } from './random.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { buildCity } from './city.js';
import { Traffic, makeCarMesh, Car } from './vehicles.js';
import { Pedestrians } from './pedestrians.js';
import { Player } from './player.js';
import { Wanted } from './wanted.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { CameraRig } from './camera.js';
import { Effects } from './effects.js';
import { getShotParam, applyShot, stepShot } from './screenshots.js';

const params = new URLSearchParams(window.location.search);
const LOW_FX = params.has('fx') && params.get('fx') === 'low';
const SHOT = getShotParam();
const SEED = parseInt(params.get('seed') || '1337', 10);

export class Game {
  constructor() {
    this.rng = new RNG(SEED);
    this.cash = 0;
    this.debt = CFG.DEBT_START;
    this.state = 'title'; // title | playing | paused | busted | card
    this.shotMode = 0;
    this.shotFrames = 0;
    this.shotReady = false;

    // Renderer.
    this.renderer = new THREE.WebGLRenderer({ antialias: !LOW_FX });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(LOW_FX ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !LOW_FX;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('game').appendChild(this.renderer.domElement);

    // Scene, sky, fog, lights.
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87b5d9);
    this.scene.fog = new THREE.Fog(0x9ab8cc, 180, 420);
    const sun = new THREE.DirectionalLight(0xfff2d0, 2.4);
    sun.position.set(120, 180, 60);
    sun.castShadow = !LOW_FX;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -200;
    sun.shadow.camera.right = 200;
    sun.shadow.camera.top = 200;
    sun.shadow.camera.bottom = -200;
    sun.shadow.camera.far = 500;
    this.scene.add(sun);
    this.scene.add(new THREE.HemisphereLight(0xbdd8f2, 0x5a4a3a, 1.1));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.25));

    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.cameraRig = new CameraRig(this.camera);

    // World.
    this.city = buildCity(this.scene, this.rng);
    this.traffic = new Traffic(this.scene, this.city, this.rng);
    this.pedestrians = new Pedestrians(this.scene, this.city, this.rng);
    this.player = new Player(this.scene, this.city, this.rng);
    this.wanted = new Wanted(this.scene, this.city, this.rng);
    this.missions = new Missions(this.scene, this.city, this.rng);
    this.hud = new HUD(this.city);
    this.effects = new Effects(this.scene);
    this.audio = new AudioSys();
    this.input = new Input();

    // Parked cars to steal, plus the courier van for mission 5.
    this.parked = this.traffic.spawnParked(8);
    const vanMesh = makeCarMesh(0xe8e8e8, 'van');
    this.scene.add(vanMesh);
    this.van = new Car(vanMesh, 150, -90, Math.PI / 2);
    this.van.kind = 'van';
    this.van.parked = true;
    this.traffic.cars.push(this.van);
    // A taxi for mission 4 (parked near the garage).
    const taxiMesh = makeCarMesh(0xffd21f, 'taxi');
    this.scene.add(taxiMesh);
    this.taxiCar = new Car(taxiMesh, -120, 30, 0);
    this.taxiCar.kind = 'taxi';
    this.taxiCar.parked = true;
    this.traffic.cars.push(this.taxiCar);

    // Wire mission + player events.
    this.missions.onEvent = (type, a, b) => this._onMissionEvent(type, a, b);
    this._playerEvent = (type, data) => this._onPlayerEvent(type, data);

    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // Shot mode: compose a scene and let the capture script drive it.
    if (SHOT > 0) {
      this.state = 'playing';
      this.hud.hideMenu();
      applyShot(this, SHOT);
      window.__shotReady = false;
    } else {
      this._showTitle();
    }
    this._last = performance.now();
    this.renderer.setAnimationLoop(() => this._frame());
  }

  // ----- menus -----
  _showTitle() {
    this.state = 'title';
    const save = this._loadSave();
    const buttons = [];
    buttons.push({
      label: '▶  New Game',
      onClick: () => {
        this.audio.unlock();
        this.audio.uiClick();
        this._newGame();
      },
    });
    if (save) {
      buttons.push({
        label: '↻  Continue',
        onClick: () => {
          this.audio.unlock();
          this.audio.uiClick();
          this._continueGame(save);
        },
      });
    }
    this.hud.showMenu(
      'SOLMAR HEAT',
      `<p>Leo Marin owes <b>$4,500</b> to loan shark Rocco Vane. Dispatcher Ada Kwan has five jobs that pay it off — if Leo survives them.</p>
       <p>Steal cars, outrun the police, run packages, drive fares and pull the big score across Solmar Bay.</p>`,
      buttons,
    );
  }
  _newGame() {
    this.cash = 0;
    this.debt = CFG.DEBT_START;
    this.player.reset(this.city.places.playerStart);
    this.wanted.clear();
    this.missions.index = 0;
    this.missions.state = 'idle';
    this.missions._clearObjective();
    this.state = 'playing';
    this.hud.hideMenu();
    this._showMissionCard();
  }
  _continueGame(save) {
    this.cash = save.cash;
    this.debt = save.debt;
    this.player.reset({ x: save.x, z: save.z });
    this.player.health = save.health;
    this.player.ammo = save.ammo;
    this.player.reserve = save.reserve;
    this.wanted.clear();
    this.missions.index = save.missionIndex;
    this.missions.state = 'idle';
    this.missions._clearObjective();
    this.state = 'playing';
    this.hud.hideMenu();
    this._showMissionCard();
  }
  _showMissionCard() {
    const m = this.missions.current;
    if (!m) {
      this.state = 'playing';
      this.hud.toast('Free roam — the debt is paid. Solmar Bay is yours.');
      return;
    }
    this.state = 'card';
    this.hud.showMenu(
      `Mission ${m.id}: ${m.name}`,
      `<p>${m.brief}</p><p><b>Pay:</b> $${m.pay} &nbsp; <b>Objective:</b> ${m.objective}</p>`,
      [
        {
          label: '▶  Start Mission',
          onClick: () => {
            this.audio.unlock();
            this.audio.uiClick();
            this.hud.hideMenu();
            this.state = 'playing';
            if (m.id === 3) this.wanted.setLevel(2);
            this.missions.start();
          },
        },
      ],
    );
  }
  _showBusted() {
    this.state = 'busted';
    const fine = Math.min(this.cash, 200);
    this.cash -= fine;
    this.hud.showMenu(
      'BUSTED',
      `<p>The Solmar Bay police hauled Leo in. Bail cost <b>$${fine}</b>.</p><p>Health restored. The wanted level is cleared — but Rocco still wants his money.</p>`,
      [
        {
          label: '↻  Back on the street',
          onClick: () => {
            this.audio.uiClick();
            this.hud.hideMenu();
            this.player.reset(this.city.places.playerStart);
            this.wanted.clear();
            this.player.health = CFG.PLAYER_HEALTH;
            this.state = 'playing';
          },
        },
      ],
    );
  }

  // ----- save -----
  _save() {
    try {
      localStorage.setItem(
        CFG.SAVE_KEY,
        JSON.stringify({
          cash: this.cash,
          debt: this.debt,
          missionIndex: this.missions.index,
          x: this.player.x,
          z: this.player.z,
          health: this.player.health,
          ammo: this.player.ammo,
          reserve: this.player.reserve,
        }),
      );
    } catch {}
  }
  _loadSave() {
    try {
      const raw = localStorage.getItem(CFG.SAVE_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (typeof s.cash !== 'number' || typeof s.missionIndex !== 'number') return null;
      return s;
    } catch {
      return null;
    }
  }

  // ----- events -----
  _onMissionEvent(type, a, b) {
    if (type === 'mission-start') {
      this.hud.toast(`Mission ${a.id}: ${a.name}`);
    } else if (type === 'mission-done') {
      this.audio.missionDone();
      this.audio.cash();
      this.effects.sparks(this.player.pos.x, this.player.pos.z);
      this.hud.toast(`Mission complete — +$${b}`);
      this._save();
      // Next mission card (or free roam).
      setTimeout(() => {
        if (this.state === 'playing') this._showMissionCard();
      }, 1200);
    } else if (type === 'mission-fail') {
      this.hud.toast(a);
      this.audio.busted();
    } else if (type === 'objective') {
      this.hud.toast(a);
    } else if (type === 'fare-done') {
      this.audio.cash();
      this.hud.toast(`Fare complete — +$${a} (${b}/${this.missions.taxiTarget})`);
    }
  }
  _onPlayerEvent(type, data) {
    const pp = this.player.pos;
    if (type === 'steal-car') {
      this.audio.uiClick();
      this.wanted.addHeat(100, 'stole a car');
      this.hud.toast('Car stolen — the cops noticed');
      this.effects.dust(pp.x, pp.z);
    } else if (type === 'exit-car') {
      this.audio.uiClick();
    } else if (type === 'ped-down') {
      this.wanted.addHeat(60, 'ran over a pedestrian');
      this.audio.crash();
      this.cameraRig.addShake(0.7);
      this.effects.sparks(pp.x, pp.z);
      this.hud.toast('Pedestrian down — wanted level up');
    } else if (type === 'punch') {
      this.audio.punch();
      this.wanted.addHeat(30, 'assault');
      this.effects.sparks(pp.x, pp.z);
    } else if (type === 'punch-miss') {
      this.audio.punch();
    } else if (type === 'shot-hit') {
      this.audio.gunshot();
      this.wanted.addHeat(45, 'shooting');
      this.cameraRig.addShake(0.4);
      this.effects.muzzle(pp.x, 1.4, pp.z, this.player.heading);
      this.pedestrians.scare(pp.x, pp.z, 16);
    } else if (type === 'shot-miss') {
      this.audio.gunshot();
      this.wanted.addHeat(20, 'shooting');
      this.effects.muzzle(pp.x, 1.4, pp.z, this.player.heading);
      this.pedestrians.scare(pp.x, pp.z, 16);
    } else if (type === 'shot-empty') {
      this.audio.uiClick();
      this.hud.toast('No ammo — press R to reload');
    } else if (type === 'reload-start') {
      this.audio.uiClick();
    } else if (type === 'reloaded') {
      this.audio.uiClick();
    } else if (type === 'rammed') {
      this.audio.crash();
      this.cameraRig.addShake(0.5);
    }
  }

  // ----- frame -----
  _frame() {
    const now = performance.now();
    let dt = Math.min(0.05, (now - this._last) / 1000);
    this._last = now;
    this.audio.unlock();
    if (this.input.hit('KeyM')) {
      const muted = this.audio.toggleMute();
      this.hud.toast(muted ? 'Muted' : 'Sound on');
    }
    if (this.state === 'playing') {
      if (this.input.hit('KeyP') || this.input.hit('Escape')) {
        this.state = 'paused';
        this.hud.showMenu('Paused', '<p>Take a breath. Solmar Bay waits.</p>', [
          {
            label: '▶  Resume',
            onClick: () => {
              this.audio.uiClick();
              this.hud.hideMenu();
              this.state = 'playing';
            },
          },
          {
            label: '💾  Save & Title',
            onClick: () => {
              this._save();
              this.audio.uiClick();
              this.hud.hideMenu();
              this._showTitle();
            },
          },
        ]);
      }
    }
    if (this.state === 'playing') {
      if (SHOT > 0) {
        const ready = stepShot(this, dt);
        if (ready && !this.shotReady) {
          this.shotReady = true;
        }
      } else {
        this.player.update(dt, this.input, this.traffic.cars, this.pedestrians, this._playerEvent);
        this.traffic.update(dt);
        this.pedestrians.update(dt, this.player.pos, this.player.speed);
        this.wanted.update(dt, this.player, (type) => {
          if (type === 'busted') this._showBusted();
          else if (type === 'wanted-down') this.hud.toast(`Heat down — ${this.wanted.level} star${this.wanted.level === 1 ? '' : 's'}`);
        });
        this.missions.update(dt, this.player, this);
        if (this.missions.allDone && this.missions.taxi) this.missions.updateSideFare(dt, this.player, this);
        // Prompt: steal / exit.
        if (!this.player.inCar) {
          const near = this.player.nearestCar(this.traffic.cars);
          this.hud.prompt(near ? 'Press E to steal the car' : '');
        } else {
          this.hud.prompt('E — get out   ·   Space — handbrake');
        }
        // Engine + siren.
        this.audio.engine(this.player.inCar ? Math.abs(this.player.speed) / CFG.CAR_MAX_SPEED : 0);
        this.audio.siren(this.wanted.level > 0);
        // Dust while driving fast.
        if (this.player.inCar && Math.abs(this.player.speed) > 20 && Math.random() < 0.3) {
          this.effects.dust(this.player.pos.x, this.player.pos.z);
        }
        // Auto-save every ~15s while playing.
        this._saveTimer = (this._saveTimer || 0) + dt;
        if (this._saveTimer > 15) {
          this._saveTimer = 0;
          this._save();
        }
      }
      this.cameraRig.update(dt, this.player);
      this.effects.update(dt);
      this.hud.update(dt, this);
    }
    this.input.consume();
    this.renderer.render(this.scene, this.camera);
  }
}

const __game = new Game();
window.__game = __game;
