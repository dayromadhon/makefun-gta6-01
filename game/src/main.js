// SOLMAR HEAT — main.js
// One job: wire the modules together and run the game — the state machine
// (title / mission card / playing / paused / busted / complete), the frame
// loop, saving, and the ?shot= / ?fx= / ?seed= modes. This is the only file
// that knows about all the others.

import * as THREE from 'three';
import { CONFIG, MISSIONS, LANDMARKS, SAVE_KEY } from './config.js';
import { createRng } from './random.js';
import { Input } from './input.js';
import { AudioSys } from './audio.js';
import { buildCity } from './city.js';
import { VehicleManager } from './vehicles.js';
import { PedManager } from './peds.js';
import { Player } from './player.js';
import { Wanted } from './wanted.js';
import { Missions } from './missions.js';
import { HUD } from './hud.js';
import { CameraRig } from './camera.js';
import { Effects } from './effects.js';
import { setupShot } from './shots.js';

const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed') || 7);
const FX_LOW = params.get('fx') === 'low';
const SHOT = params.get('shot') || null;

const rng = createRng(SEED);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: !!SHOT });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = !FX_LOW;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(CONFIG.colors.sky);
const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.1, 600);

const city = buildCity(scene, rng, FX_LOW);
const audio = new AudioSys();
const input = new Input(renderer.domElement);
const vehicles = new VehicleManager(scene, rng, city, FX_LOW);
const peds = new PedManager(scene, rng, city, FX_LOW);
const player = new Player(scene, audio);
const wanted = new Wanted(vehicles, rng, audio);
const effects = new Effects(scene);
const hud = new HUD(document);
const cameraRig = new CameraRig(camera);

vehicles.spawnAll();
peds.spawnAll();

const game = {
  renderer, scene, camera, city, audio, input, vehicles, peds, player,
  wanted, effects, hud, cameraRig, state: 'title', cash: 0,
  missions: null, step, hudState, startNewGame, continueGame,
};

const missions = new Missions(rng, (ev) => {
  if (ev.type === 'card') {
    game.state = 'missioncard';
    hud.showMissionCard(ev.mission);
  } else if (ev.type === 'stage') {
    hud.message(ev.text);
  } else if (ev.type === 'complete') {
    game.cash += ev.reward;
    saveGame();
    game.state = 'complete';
    hud.showMissionComplete(ev.mission, ev.reward);
    audio.chime();
  } else if (ev.type === 'failed') {
    hud.message(ev.text, 4000);
  } else if (ev.type === 'cash') {
    game.cash += ev.amount;
    hud.message(ev.text);
    saveGame();
  } else if (ev.type === 'story-done') {
    game.state = 'storydone';
    hud.showStoryDone();
    audio.chime();
  }
});
game.missions = missions;

// ---- save / load ----
function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: game.cash,
      missionIndex: missions.index,
      health: player.health,
      x: player.x,
      z: player.z,
    }));
  } catch (e) { /* storage unavailable — the game still plays */ }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

// ---- flow ----
function startNewGame() {
  audio.ensure();
  audio.ui();
  game.cash = 0;
  wanted.clear();
  player.reset(0, 18);
  cameraRig.snap({ x: 0, z: 18, heading: 0, inCar: false });
  missions.index = 0;
  effects.setBeacon(0, 0, false);
  hud.showPlaying();
  missions.start();
}

function continueGame() {
  const save = loadSave();
  if (!save) return startNewGame();
  audio.ensure();
  audio.ui();
  game.cash = save.cash || 0;
  wanted.clear();
  player.reset(save.x || 0, save.z || 18);
  player.health = save.health || CONFIG.playerHealth;
  cameraRig.snap({ x: player.x, z: player.z, heading: 0, inCar: false });
  missions.index = Math.min(save.missionIndex || 0, MISSIONS.length - 1);
  effects.setBeacon(0, 0, false);
  hud.showPlaying();
  missions.start();
}

function retryAfterBusted() {
  audio.ui();
  wanted.clear();
  player.reset(0, 18);
  cameraRig.snap({ x: 0, z: 18, heading: 0, inCar: false });
  hud.showPlaying();
  missions.onBusted();
}

// Mission 3 starts with the heat already on.
const _missionsStart = missions.start.bind(missions);
missions.start = () => {
  _missionsStart();
  if (missions.current && missions.current.kind === 'lose-heat') wanted.setHeat(2);
};

// Spawn helpers the missions call.
const missionsCtx = {
  get player() { return player; },
  get vehicles() { return vehicles; },
  get wanted() { return wanted; },
  spawnTaxiNearPlayer() {
    const a = rng() * Math.PI * 2;
    const x = player.x + Math.sin(a) * 14;
    const z = player.z + Math.cos(a) * 14;
    const line = CONFIG.streetLines.reduce((b, l) => (Math.abs(l - z) < Math.abs(b - z) ? l : b), CONFIG.streetLines[0]);
    vehicles.spawnTaxi(x, line);
  },
  spawnVanAtDocks() {
    if (!vehicles.van) vehicles.spawnVan(LANDMARKS.docks.x, LANDMARKS.docks.z);
  },
};

// ---- HUD state ----
function hudState() {
  const m = missions.current;
  return {
    cash: game.cash,
    debtLeft: Math.max(0, CONFIG.debtTotal - game.cash),
    health: player.health,
    stars: wanted.stars,
    speedKmh: player.inCar ? Math.abs(player.inCar.speed) * 3.6 : 0,
    ammo: player.ammo,
    reloading: player.reloading > 0,
    inCar: !!player.inCar,
    objective: missions.objectiveText(),
    timer: m && m.kind === 'timed-delivery' && missions.stage === 1 ? missions.timer : 0,
    marker: missions.marker,
    player: { x: player.x, z: player.z, heading: player.heading, camHeading: cameraRig.yaw },
    cops: vehicles.police.map((c) => ({ x: c.x, z: c.z })),
  };
}

// ---- one logic step ----
let _exhaustT = 0;
let _hurtT = 0;
function step(dt) {
  // Camera orbit from mouse drag.
  if (input.dragDX || input.dragDY) cameraRig.orbit(input.dragDX, input.dragDY);

  // Pause / mute.
  if (input.wasPressed('Escape') || input.wasPressed('KeyP')) {
    game.state = 'paused';
    hud.showPause();
    input.endFrame();
    return;
  }
  if (input.wasPressed('KeyM')) audio.setMuted(!audio.muted);

  // Enter / exit a car.
  if (input.wasPressed('KeyE')) {
    if (player.inCar) {
      player.exitCar();
      audio.ui();
    } else {
      const cars = [...vehicles.parked, ...vehicles.taxis, ...vehicles.traffic, ...(vehicles.van ? [vehicles.van] : [])];
      const car = player.nearestCar(cars, CONFIG.carEnterRadius);
      if (car) {
        const isTheft = !car.noHeat && !car.stolenByPlayer;
        player.enterCar(car);
        car.stolenByPlayer = true;
        if (isTheft) {
          const heat = car.kind === 'van' ? 2 : CONFIG.heatPerCarTheft;
          wanted.addHeat(heat);
          hud.message(car.kind === 'van' ? 'Van stolen — the cops are coming!' : 'Car stolen!');
        }
        audio.ui();
      }
    }
  }

  // Combat on foot.
  if (!player.inCar) {
    if (input.wasPressed('KeyR')) {
      player.reloading = CONFIG.pistolReloadMs;
    }
    if (input.wasPressed('KeyF')) {
      if (player.punch()) {
        const ped = peds.nearest(player.x, player.z, CONFIG.punchRange);
        if (ped) {
          peds.knockDownAt(player.x, player.z, CONFIG.punchRange);
          wanted.addHeat(0.5);
        }
      }
    }
    if (input.mouseClicked) {
      const res = player.shoot();
      if (res === 'shot') {
        // Aim along the camera heading; hit the first ped or cop car in the cone.
        const dx = Math.sin(cameraRig.yaw);
        const dz = Math.cos(cameraRig.yaw);
        const mx = player.x + dx * 1.2;
        const mz = player.z + dz * 1.2;
        effects.muzzle(mx, 1.3, mz);
        cameraRig.addShake(0.25);
        let hit = false;
        for (const ped of peds.peds) {
          if (ped.state === 'down') continue;
          const px = ped.x - player.x;
          const pz = ped.z - player.z;
          const dist = Math.hypot(px, pz);
          if (dist > 45) continue;
          const dot = (px * dx + pz * dz) / dist;
          if (dot > 0.985) {
            peds.knockDownAt(ped.x, ped.z, 1.5);
            wanted.addHeat(CONFIG.heatPerPedHit);
            hit = true;
            break;
          }
        }
        if (!hit) {
          for (const cop of vehicles.police) {
            const px = cop.x - player.x;
            const pz = cop.z - player.z;
            const dist = Math.hypot(px, pz);
            if (dist > 45) continue;
            const dot = (px * dx + pz * dz) / dist;
            if (dot > 0.985) {
              effects.burst(cop.x, 1, cop.z, 0xffd76e, 8, 4);
              wanted.addHeat(CONFIG.heatPerShot);
              break;
            }
          }
        }
        if (!hit) wanted.addHeat(CONFIG.heatPerShot * 0.5);
        peds.scare(player.x, player.z, 25);
      }
    }
  }

  // Move the player (on foot) or drive the car.
  if (player.inCar) {
    const car = player.inCar;
    const ctl = {
      forward: input.moveForward(),
      steer: input.moveStrafe(),
      handbrake: input.isDown('Space'),
    };
    const prevSpeed = car.speed;
    vehicles.drive(car, ctl, dt);
    player.x = car.x;
    player.z = car.z;
    player.heading = car.heading;
    audio.engine(Math.abs(car.speed) / CONFIG.carTopSpeed, true);
    // Exhaust puffs.
    _exhaustT -= dt;
    if (Math.abs(car.speed) > 5 && _exhaustT <= 0) {
      _exhaustT = 0.12;
      effects.exhaust(car.x - Math.sin(car.heading) * 2.2, 0.5, car.z - Math.cos(car.heading) * 2.2);
    }
    // Crash into traffic: shove the other car forward to near the player's
    // speed so the overlap resolves instead of pinning both cars together.
    for (const other of vehicles.traffic) {
      const d = Math.hypot(other.x - car.x, other.z - car.z);
      if (d < 3.2) {
        if (Math.abs(car.speed) > 12) {
          effects.crash(car.x, 1, car.z);
          cameraRig.addShake(0.6);
          audio.crash();
          player.hurt(5);
        }
        car.speed *= 0.85;
        other.speed = Math.max(other.speed, Math.abs(car.speed) * 0.9);
      }
    }
    // Run over pedestrians.
    if (Math.abs(car.speed) > 4) {
      if (peds.knockDownAt(car.x, car.z, 2.0)) {
        wanted.addHeat(CONFIG.heatPerPedHit);
        effects.crash(car.x, 0.6, car.z);
        cameraRig.addShake(0.5);
        audio.crash();
        car.speed *= 0.7;
      }
    }
    peds.scare(car.x, car.z, 12);
    if (Math.abs(prevSpeed) > 20 && Math.abs(car.speed) < 2) {
      // Hard stop into a wall.
      effects.crash(car.x, 1, car.z);
      cameraRig.addShake(0.4);
    }
  } else {
    player.updateOnFoot(dt, input, cameraRig.yaw, city);
    audio.engine(0, false);
  }

  // Traffic and pedestrians.
  vehicles.updateTraffic(dt, player.inCar);
  peds.update(dt);

  // Cops ramming the player on foot hurt.
  _hurtT -= dt;
  if (!player.inCar && _hurtT <= 0) {
    for (const cop of vehicles.police) {
      if (Math.hypot(cop.x - player.x, cop.z - player.z) < 2.6) {
        player.hurt(8);
        _hurtT = 1;
        cameraRig.addShake(0.5);
        break;
      }
    }
  }

  // Wanted.
  const visible = wanted.visibleToPolice(player);
  const bust = wanted.update(dt, player, visible);
  if (bust === 'busted') {
    game.state = 'busted';
    hud.showBusted();
    input.endFrame();
    return;
  }
  if (player.dead) {
    game.state = 'busted';
    hud.showBusted();
    input.endFrame();
    return;
  }

  // Missions.
  missions.update(dt, missionsCtx);
  const m = missions.marker;
  effects.setBeacon(m ? m.x : 0, m ? m.z : 0, !!m);

  // Camera, effects, HUD.
  cameraRig.update(dt, { x: player.x, z: player.z, heading: player.heading, inCar: !!player.inCar, speed: player.inCar ? player.inCar.speed : 0 });
  effects.update(dt);
  hud.update(hudState());
  input.endFrame();
}

// ---- buttons ----
function wire(id, fn) {
  const b = document.getElementById(id);
  if (b) b.addEventListener('click', (e) => { e.stopPropagation(); fn(); });
}
wire('btn-new', startNewGame);
wire('btn-continue', continueGame);
wire('btn-go', () => {
  audio.ui();
  hud.hideMissionCard();
  hud.showPlaying();
  game.state = 'playing';
});
wire('btn-resume', () => {
  audio.ui();
  hud.showPlaying();
  game.state = 'playing';
});
wire('btn-restart', () => {
  audio.ui();
  hud.showPlaying();
  startNewGame();
});
wire('btn-quit', () => {
  audio.ui();
  game.state = 'title';
  hud.showTitle(loadSave());
});
wire('btn-busted-retry', retryAfterBusted);
wire('btn-mc-continue', () => {
  audio.ui();
  hud.showPlaying();
  if (missions.storyDone) {
    game.state = 'playing';
  } else {
    missions.start();
  }
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

window.__game = game;

// ---- boot ----
if (SHOT) {
  // Screenshot mode: hide every screen first (the title screen would cover
  // the game), then the shot scene plays the real game forward a fixed
  // number of frames, renders once, and marks ready. No live loop.
  hud.showPlaying();
  game.state = 'playing';
  setupShot(SHOT, game);
} else {
  hud.showTitle(loadSave());
  game.state = 'title';
  let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (game.state === 'playing') step(dt);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
