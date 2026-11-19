// SOLMAR HEAT — main: boots the renderer, wires every system together and
// runs the loop. States: title, playing, paused, card, busted.
// ?shot=1..4 stages a screenshot scene; ?fx=low trims the effects.
import * as THREE from 'three';
import { CFG, COLORS, MISSIONS, PLACES } from './config.js';
import { RNG } from './random.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { City } from './city.js';
import { VehicleManager } from './vehicles.js';
import { PedManager } from './pedestrians.js';
import { Player } from './player.js';
import { Wanted } from './wanted.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { CameraRig } from './camera.js';
import { Effects } from './effects.js';
import { applyShot } from './screenshots.js';

const SAVE_KEY = 'solmar-heat-save-v1';

class Game {
  constructor() {
    const params = new URLSearchParams(location.search);
    this.lowFx = params.get('fx') === 'low';
    this.shot = Number(params.get('shot') || 0);
    this.rng = new RNG(CFG.seed);
    this.state = 'title';
    this.shotFixedCam = null;
    this.shotSettleUntil = 0;
    this.shotReady = false;
    this.pendingNextMission = false;

    this.renderer = new THREE.WebGLRenderer({ antialias: !this.lowFx, powerPreference: 'high-performance' });
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.setPixelRatio(this.lowFx ? 1 : Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.lowFx;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    document.getElementById('game').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(COLORS.sky);
    this.scene.fog = new THREE.Fog(COLORS.fog, 130, 460);
    this.camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 900);

    const sun = new THREE.DirectionalLight(0xfff2d0, 2.4);
    sun.position.set(80, 140, 40);
    sun.castShadow = !this.lowFx;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -160;
    sun.shadow.camera.right = 160;
    sun.shadow.camera.top = 160;
    sun.shadow.camera.bottom = -160;
    sun.shadow.camera.far = 400;
    this.scene.add(sun);
    this.scene.add(new THREE.AmbientLight(0xbfd8e8, 0.9));
    const hemi = new THREE.HemisphereLight(0xbfd8ff, 0x3f6b3a, 0.5);
    this.scene.add(hemi);

    this.input = new Input();
    this.input.attach();
    this.audio = new AudioSys();
    this.input.onFirstGesture = () => this.audio.ensure();

    this.city = new City(this.scene, this.rng, this.lowFx);
    this.vehicles = new VehicleManager(this.scene, this.city, this.rng);
    this.peds = new PedManager(this.scene, this.city, this.rng);
    this.effects = new Effects(this.scene);
    this.player = new Player(this.scene, this.city, this.vehicles, this.peds, this.audio, this.effects);
    this.wanted = new Wanted(this.scene, this.city, this.vehicles, this.player, this.audio);
    this.missions = new Missions(this.city, this.rng);
    this.hud = new HUD();
    this.cameraRig = new CameraRig(this.camera);

    this.vehicles.spawnTraffic(this.lowFx ? 6 : CFG.trafficCars);
    this.vehicles.spawnParked(CFG.parkedCars);
    this.peds.spawn(this.lowFx ? 7 : CFG.pedestrians);

    // Mission marker beacon: a glowing pillar plus a floating diamond.
    this.beacon = new THREE.Group();
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(2.2, 2.2, 60, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffd94a, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
    );
    pillar.position.y = 30;
    const diamond = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.6),
      new THREE.MeshBasicMaterial({ color: 0xffd94a }),
    );
    diamond.position.y = 9;
    this.beacon.add(pillar);
    this.beacon.add(diamond);
    this.beacon.visible = false;
    this.scene.add(this.beacon);
    this.beaconDiamond = diamond;

    this._wireEvents();
    this._wireButtons();
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });

    if (this.shot >= 1 && this.shot <= 4) {
      this._startShot(this.shot);
    } else {
      this._showTitle();
    }
    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this._frame());
  }

  _wireEvents() {
    this.player.onSteal = (car) => {
      this.wanted.addStars(1);
      this.missions.onSteal(car);
      this.hud.showMessage(car.isVan ? 'Van stolen — get it to the hideout!' : 'Car stolen — the cops noticed (+1★)');
      this.audio.blip();
    };
    this.player.onEnterCar = () => {
      this.hud.showMessage('Driving — W/S gas and brake, A/D steer, Space handbrake, E to get out', 4);
    };
    this.player.onExitCar = () => {
      this.hud.showMessage('On foot — E steals a car, F punches, 2 + click shoots', 4);
    };
    this.peds.onKnockedDown = () => {
      this.wanted.addStars(1);
      this.hud.showMessage('Pedestrian down — wanted +1★', 2);
    };
    this.player.onPunch = (ped) => {
      if (ped) this.wanted.addStars(1);
    };
    this.player.onShoot = () => {
      this.wanted.addStars(1);
    };
    this.wanted.onStarsChanged = (n) => {
      this.hud.setStars(n);
      this.audio.setSiren(n > 0);
    };
    this.wanted.onBusted = (reason) => {
      this.state = 'busted';
      this.hud.showBusted(reason);
      this.audio.setEngine(false, 0);
      this.audio.setSiren(false);
    };
    this.missions.onCard = (name, brief, reward) => {
      this.state = 'card';
      this.hud.showCard(name, brief, reward ? `Reward ${reward}` : '');
      this.audio.jingle();
      if (name === 'Night Shift') {
        // A cab is waiting by the curb when the shift starts.
        this.vehicles.spawnTaxi(this.player.x + 6, this.player.z + 6);
      }
    };
    this.missions.onComplete = (m) => {
      this.state = 'card';
      this.hud.showCard(`${m.name} — complete!`, m.brief, `+$${m.reward}`);
      this.audio.jingle();
      // onComplete now fires after the mission index advanced.
      this.pendingNextMission = this.missions.index < MISSIONS.length;
      this._save();
    };
    this.missions.onFailed = (text) => {
      this.hud.showMessage(text, 4);
    };
    this.missions.onCash = (cash) => {
      this.hud.setCash(cash);
      this.hud.setDebt(this.missions.debtLeft);
    };
    this.missions.onDebtPaid = () => {
      this.hud.setDebt(0);
      this.hud.showMessage('DEBT PAID! Rocco is off your back — Solmar is yours.', 6);
    };
    this.missions.onObjective = () => {};
  }

  _wireButtons() {
    this.hud.el['btn-new'].addEventListener('click', () => {
      localStorage.removeItem(SAVE_KEY);
      this._newGame();
    });
    this.hud.el['btn-continue'].addEventListener('click', () => {
      this._continueGame();
    });
    this.hud.el['btn-resume'].addEventListener('click', () => {
      this.state = 'playing';
      this.hud.hideScreens();
    });
    this.hud.el['btn-restart'].addEventListener('click', () => {
      location.reload();
    });
    this.hud.el['btn-card-go'].addEventListener('click', () => {
      this.audio.blip();
      if (this.pendingNextMission) {
        this.pendingNextMission = false;
        this.missions.start();
      } else {
        this.state = 'playing';
        this.hud.hideScreens();
      }
    });
    this.hud.el['btn-busted-ok'].addEventListener('click', () => {
      this._respawn();
    });
  }

  _showTitle() {
    const save = this._readSave();
    this.hud.el['btn-continue'].style.display = save ? 'block' : 'none';
    this.hud.el['title-save-note'].textContent = save
      ? `Save found — $${save.cash} earned, mission ${Math.min(save.missionIndex + 1, 5)} of 5.`
      : 'No save yet — start fresh.';
    this.state = 'title';
    this.hud.showScreen('screen-title');
    this._placeCameraForTitle();
  }

  _placeCameraForTitle() {
    const avenueX = this.city.roadCenter(2);
    this.cameraRig.setFixed(avenueX - 30, 26, 90, avenueX, 4, -20);
  }

  _newGame() {
    this.player.reset(0, 40);
    this.player.ammo = CFG.startAmmo;
    this.player.mag = CFG.magSize;
    this.missions.index = 0;
    this.missions.cash = 0;
    this.missions.debtPaid = false;
    this.missions.sideJob = null;
    this.wanted.reset();
    this.hud.setCash(0);
    this.hud.setDebt(CFG.debtTotal);
    this.hud.setHealth(CFG.startHealth);
    this.hud.setStars(0);
    this.hud.hideScreens();
    this.state = 'playing';
    this.cameraRig.snap(this.player, false);
    this.missions.start();
  }

  _continueGame() {
    const save = this._readSave();
    if (!save) {
      this._newGame();
      return;
    }
    this.player.reset(PLACES.garage.x + 4, PLACES.garage.z + 4);
    this.player.ammo = save.ammo ?? CFG.startAmmo;
    this.player.mag = save.mag ?? CFG.magSize;
    this.missions.index = Math.min(save.missionIndex, MISSIONS.length);
    this.missions.cash = save.cash;
    this.missions.debtPaid = save.cash >= CFG.debtTotal;
    this.missions.sideJob = null;
    this.wanted.reset();
    this.hud.setCash(save.cash);
    this.hud.setDebt(this.missions.debtLeft);
    this.hud.setHealth(CFG.startHealth);
    this.hud.setStars(0);
    this.hud.hideScreens();
    this.state = 'playing';
    this.cameraRig.snap(this.player, false);
    if (this.missions.index >= 5) {
      this.missions._startSideJob();
    } else {
      this.missions.start();
    }
    this.hud.showMessage('Welcome back, Leo.', 3);
  }

  _respawn() {
    const fee = Math.min(100, this.missions.cash);
    this.missions.cash -= fee;
    this.hud.setCash(this.missions.cash);
    this.hud.setDebt(this.missions.debtLeft);
    if (this.player.car) this.player.exitCar();
    this.player.reset(PLACES.hospital.x, PLACES.hospital.z);
    this.player.health = CFG.startHealth;
    this.wanted.reset();
    this.hud.setStars(0);
    this.hud.hideScreens();
    this.state = 'playing';
    this.hud.showMessage(`Busted — the clinic patched you up. -$${fee}.`, 4);
    this._save();
  }

  _startShot(n) {
    this.state = 'playing';
    this.hud.hideScreens();
    this.hud.setCash(1250);
    this.hud.setDebt(CFG.debtTotal - 1250);
    this.hud.setHealth(100);
    this.hud.setStars(0);
    const shotCtx = {
      player: this.player,
      vehicles: this.vehicles,
      peds: this.peds,
      missions: this.missions,
      wanted: this.wanted,
      camera: this.cameraRig,
      city: this.city,
      state: this.state,
    };
    applyShot(n, shotCtx);
    this.shotFixedCam = shotCtx.shotFixedCam || null;
    // applyShot stages the scene; the frame is ready once it has settled.
    // Snap the follow camera at once for shots 2-4 (shot 1 re-applies its
    // fixed angle every frame), so the first frames are already framed.
    if (n !== 1) this.cameraRig.snap(this.player, !this.player.onFoot);
    this._shotSettleAt = performance.now() + 1800;
  }

  _save() {
    if (this.shot) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({
        cash: this.missions.cash,
        missionIndex: this.missions.index,
        ammo: this.player.ammo,
        mag: this.player.mag,
        x: this.player.x,
        z: this.player.z,
      }));
    } catch (e) {
      // Storage may be unavailable; the game still plays.
    }
  }

  _readSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  _frame() {
    const dt = Math.min(0.05, this.clock.getDelta());
    const playing = this.state === 'playing';
    if (playing) {
      this.player.update(dt, this.input, this.camera);
      this.vehicles.update(dt, this.player);
      this.peds.update(dt);
      this.wanted.update(dt);
      this.missions.update(dt, this.player, this.wanted);
      this.effects.update(dt);
      this.audio.update(dt);
      const driving = !this.player.onFoot;
      this.audio.setEngine(driving, driving ? Math.abs(this.player.speed) / CFG.carTopSpeed : 0);
      this.cameraRig.update(dt, this.player, driving);
      // Mission beacon follows the current marker.
      const marker = this.missions.marker;
      if (marker) {
        this.beacon.visible = true;
        this.beacon.position.set(marker.x, 0, marker.z);
        this.beaconDiamond.rotation.y += dt * 2;
        this.beaconDiamond.position.y = 9 + Math.sin(performance.now() * 0.003) * 1.2;
      } else {
        this.beacon.visible = false;
      }
      // HUD refresh.
      this.hud.setHealth(this.player.health);
      this.hud.setSpeed(this.player.onFoot ? 0 : this.player.speed);
      this.hud.setAmmo(this.player.weapon, this.player.mag, this.player.ammo);
      const m = this.missions;
      let obj = m.objectiveText();
      if (m.timer > 0) obj += ` — ${Math.ceil(m.timer)}s left`;
      const dist = m.marker ? Math.hypot(this.player.x - m.marker.x, this.player.z - m.marker.z) : null;
      this.hud.setObjective(obj, dist);
      this.hud.drawMinimap(this);
      this.hud.update(dt);
      if (this.input.wasPressed('Escape') || this.input.wasPressed('KeyP')) {
        this.state = 'paused';
        this.hud.showScreen('screen-pause');
        this.audio.setEngine(false, 0);
        this.audio.setSiren(false);
      }
      if (this.input.wasPressed('KeyM')) {
        this.audio.setMuted(!this.audio.muted);
        this.hud.showMessage(this.audio.muted ? 'Sound off' : 'Sound on', 1.5);
      }
    } else if (this.state === 'title') {
      // Slow cinematic pan behind the title screen.
      const t = performance.now() * 0.00004;
      const avenueX = this.city.roadCenter(2);
      this.camera.position.set(avenueX - 30 + Math.sin(t) * 8, 26, 90 + Math.cos(t) * 8);
      this.camera.lookAt(avenueX, 4, -20);
      this.vehicles.update(dt, this.player);
      this.peds.update(dt);
      this.effects.update(dt);
    }
    // Screenshot mode: re-apply the fixed camera and flag readiness.
    if (this.shot && this.state === 'playing') {
      if (this.shotFixedCam) {
        const c = this.shotFixedCam;
        this.cameraRig.setFixed(c.x, c.y, c.z, c.lx, c.ly, c.lz);
      }
      if (!this.shotReady && performance.now() > (this._shotSettleAt || 0)) {
        this.shotReady = true;
        window.__shotReady = true;
      }
    }
    this.input.endFrame();
    this.renderer.render(this.scene, this.camera);
  }
}

const game = new Game();
window.__game = game;
