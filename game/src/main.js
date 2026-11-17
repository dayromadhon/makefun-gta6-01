// Solmar Heat — boot, the game loop, screens and saving.
// One job: wire every module together and run the game.

import { WORLD, PLACES, MISSIONS, SAVE_KEY, START_CASH, TUNE } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createCity } from './city.js';
import { createVehicles } from './vehicles.js';
import { createPeds } from './peds.js';
import { createPlayer } from './player.js';
import { createWanted } from './wanted.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createCamera } from './camera.js';
import { createEffects } from './effects.js';
import { applyShot } from './shots.js';

const THREE = window.THREE;
const params = new URLSearchParams(window.location.search);
const SEED = Number(params.get('seed') || 7);
const SHOT = params.get('shot');
const LOW_FX = params.get('fx') === 'low';

// --- renderer / scene ------------------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(LOW_FX ? 1 : Math.min(window.devicePixelRatio || 1, 2));
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8ec9e8);
scene.fog = new THREE.Fog(0xa8d4ea, 120, 320);
const camera3 = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 600);
const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5a, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2d0, 1.5);
sun.position.set(60, 120, -40);
scene.add(sun);

window.addEventListener('resize', () => {
  camera3.aspect = window.innerWidth / window.innerHeight;
  camera3.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// --- modules ---------------------------------------------------------------
const input = createInput(renderer.domElement);
const audio = createAudio();
const city = createCity(scene, SEED);
const vehicles = createVehicles(scene, city, SEED + 11);
const peds = createPeds(scene, city, SEED + 23);
const player = createPlayer(scene, PLACES.spawn);
const wanted = createWanted(SEED + 31);
const missions = createMissions(SEED + 47);
const hud = createHud();
const cam = createCamera(camera3);
const effects = createEffects(scene);

vehicles.spawnTraffic(LOW_FX ? TUNE.trafficCountLow : TUNE.trafficCount);
vehicles.spawnParked();
peds.spawnWalkers(LOW_FX ? TUNE.pedCountLow : TUNE.pedCount);

// --- shared game object ------------------------------------------------------
const G = {
  screen: 'title',
  city, vehicles, peds, player, wanted, missions, hud, input, audio, effects, cam,
  onCrime: (kind, x, z) => wanted.crime(kind, x, z, G),
  onBusted: () => busted(),
  onDown: () => takenDown(),
  save: () => saveGame(),
};
missions.cash = START_CASH;

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: missions.cash, index: missions.index, done: missions.done,
    }));
  } catch {
    /* saving is a nicety; never break the game */
  }
}

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.index !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

function newGame() {
  missions.cash = START_CASH;
  missions.index = 0;
  missions.done = [];
  missions.active = null;
  missions.sideJob = null;
  wanted.clear();
  player.reset(PLACES.spawn);
  saveGame();
  missions.startNext(G);
}

function continueGame() {
  const data = loadGame();
  if (!data) {
    newGame();
    return;
  }
  missions.cash = data.cash;
  missions.index = Math.min(data.index, MISSIONS.length);
  missions.done = data.done || [];
  missions.active = null;
  missions.sideJob = null;
  wanted.clear();
  player.reset(PLACES.spawn);
  if (missions.index >= MISSIONS.length) {
    G.screen = 'play';
    hud.showScreen('play');
    hud.toast('Welcome back — free roam side jobs pay the rest.');
    missions.offerSideJob(G);
  } else {
    missions.startNext(G);
  }
}

function busted() {
  if (G.screen !== 'play') return;
  G.screen = 'busted';
  missions.cash = Math.max(0, missions.cash - 200);
  if (audio) audio.busted();
  saveGame();
  hud.showScreen('busted');
  document.getElementById('busted-text').textContent =
    `The Solmar Bay police caught you. Fine: $200. Cash left: $${missions.cash}.`;
}

function takenDown() {
  if (G.screen !== 'play') return;
  G.screen = 'down';
  missions.cash = Math.max(0, missions.cash - 100);
  if (audio) audio.busted();
  saveGame();
  hud.showScreen('down');
  document.getElementById('down-text').textContent =
    `You were taken down and woke up at the Clinic. Bill: $100. Cash left: $${missions.cash}.`;
}

function respawn() {
  wanted.clear();
  for (const car of vehicles.police) if (car.active) vehicles.releasePolice(car);
  for (const cop of peds.cops) if (cop.active) peds.releaseCop(cop);
  if (player.inCar) player.exitCar(G);
  player.reset(PLACES.clinic);
  player.health = TUNE.playerHealth;
  player.down = false;
  G.screen = 'play';
  hud.showScreen('play');
  hud.toast('Back on the streets. Lay low for a while.');
}

// --- buttons ---------------------------------------------------------------
hud.onClick('btn-new', () => {
  audio.ensure();
  audio.click();
  newGame();
});
hud.onClick('btn-continue', () => {
  audio.ensure();
  audio.click();
  continueGame();
});
hud.onClick('card-go', () => {
  audio.ensure();
  audio.click();
  G.screen = 'play';
  hud.showScreen('play');
});
hud.onClick('btn-resume', () => {
  audio.click();
  G.screen = 'play';
  hud.showScreen('play');
});
hud.onClick('btn-restart', () => {
  audio.click();
  newGame();
});
hud.onClick('btn-title', () => {
  audio.click();
  G.screen = 'title';
  refreshTitle();
  hud.showScreen('title');
});
hud.onClick('btn-retry', () => {
  audio.click();
  respawn();
});
hud.onClick('btn-down-respawn', () => {
  audio.click();
  respawn();
});
hud.onClick('btn-mute', () => {
  audio.ensure();
  audio.setMuted(!audio.muted);
  document.getElementById('btn-mute').textContent = audio.muted ? '🔇 Sound off' : '🔊 Sound on';
});

function refreshTitle() {
  const data = loadGame();
  const btn = document.getElementById('btn-continue');
  if (data && data.index > 0 || data && data.cash !== START_CASH) {
    btn.style.display = 'inline-block';
    btn.textContent = `Continue — $${data.cash} · ${Math.min(data.index, 5)} of 5 jobs done`;
  } else if (data) {
    btn.style.display = 'inline-block';
    btn.textContent = `Continue — $${data.cash}`;
  } else {
    btn.style.display = 'none';
  }
}

// --- the loop ---------------------------------------------------------------
let lastT = performance.now();
let frames = 0;
let shotFrames = -1;
let puffTimer = 0;

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  frames++;

  if (G.screen === 'play') {
    // --- enter / exit a car (E, exactly once per press) -------------------
    if (input.wasPressed('KeyE')) {
      if (player.inCar) {
        player.exitCar(G);
      } else {
        const car = vehicles.nearestParked(player.x, player.z, 4.5);
        if (car) {
          const step = missions.step();
          const isMissionCar = missions.active && step && step.kind === 'steal' && car.missionId === missions.active.def.id;
          vehicles.setPlayerCar(car);
          player.enterCar(car, G);
          if (isMissionCar) {
            missions.completeStep(G);
          } else {
            wanted.crime('steal', car.x, car.z, G);
            hud.toast('You stole a car — someone saw that.');
          }
        }
      }
    }
    // --- mute ------------------------------------------------------------
    if (input.wasPressed('KeyM')) {
      audio.setMuted(!audio.muted);
      document.getElementById('btn-mute').textContent = audio.muted ? '🔇 Sound off' : '🔊 Sound on';
    }
    // --- pause -------------------------------------------------------------
    if (input.wasPressed('Escape')) {
      G.screen = 'pause';
      hud.showScreen('pause');
    }

    // --- simulate -----------------------------------------------------------
    try {
      simulate(dt);
    } catch (err) {
      // one bad frame must never freeze the game: report it once and carry on
      if (!window.__solmarSimError || window.__solmarSimError !== String(err)) {
        window.__solmarSimError = String(err);
        console.error('simulation error (continuing):', err);
      }
    }
  }

  cam.update(dt, G);
  if (G.screen === 'play' || G.screen === 'card' || G.screen === 'pause') hud.update(G);
  renderer.render(scene, camera3);

  // --- screenshot mode --------------------------------------------------------
  if (shotFrames >= 0) {
    shotFrames++;
    if (shotFrames > 100) {
      window.__shotReady = true;
      shotFrames = -1;
    }
  }
  input.endFrame();
}

// --- one simulation step, kept separate so a single bad frame never freezes the game
function simulate(dt) {
  if (player.inCar && player.car) {
    vehicles.drivePlayer(dt, input, (impact, x, z) => {
      effects.sparks(x, 1, z, 10);
      audio.crash(impact > 14);
      cam.addShake(Math.min(0.7, impact / 40));
      hud.flashDamage();
    });
    if (player.car.wrecked) {
      hud.toast('Your car is wrecked — get out (E).');
      player.exitCar(G);
    }
    player.updateInCar();
  } else {
    player.updateOnFoot(dt, G);
  }
  vehicles.driveTraffic(dt, G);
  vehicles.drivePolice(dt, G);
  vehicles.separateCars();
  vehicles.syncMeshes();
  peds.update(dt, G);
  wanted.update(dt, G);
  missions.update(dt, G);
  effects.update(dt);

  // --- objective beacon -----------------------------------------------------
  let target = null;
  if (missions.active) target = missions.stepTarget();
  else if (missions.sideJob) {
    const j = missions.sideJob;
    target = j.phase === 'pickup' ? j.pickup : j.drop;
  }
  if (target) effects.setBeacon(target.x, target.z, true);
  else effects.setBeacon(0, 0, false);

  // --- exhaust puffs ----------------------------------------------------------
  puffTimer -= dt;
  if (player.inCar && player.car && Math.abs(player.car.speed) > 5 && puffTimer <= 0) {
    puffTimer = 0.22;
    const c = player.car;
    effects.puff(c.x - Math.sin(c.heading) * 2.2, 0.5, c.z - Math.cos(c.heading) * 2.2);
  }

  // --- sound --------------------------------------------------------------------
  const speed01 = player.inCar && player.car ? Math.abs(player.car.speed) / TUNE.carMaxSpeed : 0;
  audio.engine(speed01, player.inCar);
  audio.siren(wanted.stars > 0, dt);
}

// --- boot --------------------------------------------------------------------
refreshTitle();
hud.showScreen('title');
if (SHOT) {
  // stage the scene, then play straight into it (no title, no card)
  missions.cash = START_CASH;
  applyShot(G, SHOT);
  G.screen = 'play';
  hud.showScreen('play');
  shotFrames = 0;
  // a shot scene stages its own mission; keep the HUD live
  hud.update(G);
}
audio.ensure();
requestAnimationFrame(frame);

// --- debug hook for the play-test -------------------------------------------
window.__solmar = {
  state: () => {
    const nearest = vehicles.nearestParked(player.x, player.z, 40);
    return {
      screen: G.screen,
      mission: missions.active ? { id: missions.active.def.id } : null,
      nextMission: missions.index,
      cash: missions.cash,
      wanted: wanted.stars,
      health: Math.round(player.health),
      player: {
        x: +player.x.toFixed(1),
        z: +player.z.toFixed(1),
        yaw: +player.yaw.toFixed(2),
        heading: +(player.inCar && player.car ? player.car.heading : player.heading).toFixed(2),
        inCar: player.inCar,
        speed: +(player.inCar && player.car ? player.car.speed : player.speed).toFixed(1),
      },
      carSpeed: player.inCar && player.car ? +player.car.speed.toFixed(1) : 0,
      nearestParked: nearest ? { x: nearest.x, z: nearest.z, missionId: nearest.missionId || null } : null,
      missionCar: (() => {
        const step = missions.step();
        if (!step || step.kind !== 'steal' || !missions.active) return null;
        const mc = vehicles.missionCar(missions.active.def.id);
        return mc ? { x: mc.x, z: mc.z } : null;
      })(),
    };
  },
};
