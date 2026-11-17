// Solmar Heat — bootstrap and game loop. One job: build the world, run
// the frame loop, own the screen state machine (title / card / play /
// pause / busted / wasted), save and load, and expose the debug hook the
// play-tests and screenshots use.
import { WORLD, MISSIONS, PLACES, ECONOMY, COLORS } from './config.js';
import { mulberry32, dist2d, pick } from './random.js';
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
import { Shots } from './shots.js';

const SAVE_KEY = 'solmar-heat-save-v1';

const params = new URLSearchParams(location.search);
const SEED = Number(params.get('seed') || 7);
const FX_LOW = params.get('fx') === 'low';
const SHOT = params.get('shot');
const rng = mulberry32(SEED);

// ---- renderer / scene ----
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = !FX_LOW;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('app').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(COLORS.sky);
scene.fog = new THREE.Fog(COLORS.fog, 120, 320);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 600);

const hemi = new THREE.HemisphereLight(0xcfe8ff, 0x8a7a5a, 0.95);
scene.add(hemi);
const sun = new THREE.DirectionalLight(COLORS.sun, 1.6);
sun.position.set(60, 110, 40);
sun.castShadow = !FX_LOW;
sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -130;
sun.shadow.camera.right = 130;
sun.shadow.camera.top = 130;
sun.shadow.camera.bottom = -130;
sun.shadow.camera.far = 320;
scene.add(sun);

const input = new Input(renderer.domElement);
const audio = new AudioSys();
const city = new City(scene, rng, FX_LOW);
const effects = new Effects(scene, FX_LOW);
const hud = new HUD(document, {
  onNewGame: () => newGame(),
  onContinue: () => continueGame(),
  onCardGo: () => cardGo(),
  onResume: () => setScreen('play'),
  onBustedOk: () => afterCaught(),
  onWastedOk: () => afterCaught(),
});
const cameraRig = new CameraRig(camera, FX_LOW);

const vehicles = new Vehicles(scene, city, rng, FX_LOW, {
  onDrift: (x, z) => effects.smoke(x, z),
  onCollide: (speed) => {
    effects.sparks(player.x, player.z);
    cameraRig.addShake(Math.min(0.7, speed * 0.03));
    audio.blip(120, 0.12, 0.2);
  },
});

const peds = new Peds(scene, city, rng, FX_LOW, {
  onKnockedDown: (ped) => {
    wanted.crimePedDown();
    effects.blood(ped.x, ped.z);
    peds.fleeFrom(ped.x, ped.z, 18);
  },
});

const player = new Player(scene, city, rng, FX_LOW, {
  onShoot: (ray) => shootRay(ray),
  onPunch: (target) => {
    if (target) {
      peds.knockDown(target.x, target.z, 2.4);
      audio.punch();
    } else {
      audio.punch();
    }
  },
  onEnterCar: (car) => {
    wanted.crimeStolenCar();
    peds.fleeFrom(player.x, player.z, 12);
    audio.blip(440, 0.08, 0.15);
  },
  onExitCar: () => {},
});

const wanted = new Wanted(vehicles, peds, {
  onBusted: (fine) => caught('busted', fine),
  onWasted: (fine) => caught('wasted', fine),
  onStarsChanged: () => {},
});

const missions = new Missions(scene, rng, {
  onObjective: (text) => {
    hud.setObjective(currentObjectiveTitle(), text);
    hud.toast(text);
  },
  onComplete: (def, reward) => {
    audio.cash();
    saveGame();
    showNextCard();
  },
  onFailed: (def, why) => {
    hud.toast(`${def.title} failed — ${why}`);
    showNextCard();
  },
  award: (amount) => {
    player.cash += amount;
  },
  pickFareSpot: () => {
    // A street corner within 40–70 m of the player.
    const a = rng() * Math.PI * 2;
    const d = 40 + rng() * 30;
    const x = Math.max(-110, Math.min(110, player.x + Math.sin(a) * d));
    const z = Math.max(-110, Math.min(110, player.z + Math.cos(a) * d));
    const near = city.nearestRoadPoint(x, z);
    return { x: near.x, z: near.z };
  },
  spawnFarePed: (x, z) => {
    const ped = peds.spawn(x, z);
    // A yellow marker above the fare's head.
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(0.45, 0.9, 4),
      new THREE.MeshLambertMaterial({ color: 0xffd23e, emissive: 0x664400 }),
    );
    cone.rotation.x = Math.PI;
    cone.position.y = 2.5;
    cone.name = 'fare-marker';
    ped.mesh.add(cone);
    ped.fareMarker = cone;
    return ped;
  },
  removeFarePed: (ped) => {
    const i = peds.list.indexOf(ped);
    if (i >= 0) peds.list.splice(i, 1);
    peds.group.remove(ped.mesh);
  },
  setHuntPoint: (point) => {
    vehicles.huntPoint = point;
  },
  onStoryDone: () => {
    hud.toast('Debt paid! Rocco Vane is off your back — Solmar Bay is yours.');
  },
});

const shots = new Shots({
  player, vehicles, peds, wanted, missions, camera: cameraRig, city,
});

// ---- screen state machine ----
let screen = 'title';
let saveData = loadSave();
let titleTime = 0;

function currentObjectiveTitle() {
  if (missions.current) return `${missions.current.def.title} — $${missions.current.def.reward}`;
  if (missions.sideJob) return `Side job — $${missions.sideJob.reward}`;
  if (missions.freeRoam) return 'Free Roam';
  return 'Solmar Heat';
}

function setScreen(name) {
  screen = name;
  hud.showScreen(name);
  if (name === 'title') {
    hud.setTitleSave(saveData);
  }
}

function showNextCard() {
  if (missions.index < MISSIONS.length) {
    const def = MISSIONS[missions.index];
    hud.setCard(`${def.title} — Job ${missions.index + 1} of 5`, def.brief, def.reward);
  } else {
    hud.setCard('Free Roam', 'The debt is paid. Solmar Bay is yours — take taxi fares and courier runs, or just cruise the coast.', 0);
  }
  setScreen('card');
}

function newGame() {
  saveData = null;
  try { localStorage.removeItem(SAVE_KEY); } catch { /* no storage */ }
  player.cash = ECONOMY.startCash;
  player.health = 100;
  missions.index = 0;
  missions.done = [];
  missions.current = null;
  missions.sideJob = null;
  missions.freeRoam = false;
  wanted.setStars(0, 'new game');
  for (const cop of [...vehicles.police]) vehicles.removePolice(cop);
  vehicles.huntPoint = null;
  if (player.inCar) {
    const car = player.car;
    vehicles.abandon();
    player.inCar = false;
    player.car = null;
  }
  player.respawnAt(PLACES.start.x, PLACES.start.z);
  player.yaw = Math.PI;
  cameraRig.yaw = Math.PI;
  showNextCard();
}

function continueGame() {
  if (!saveData) return;
  player.cash = saveData.cash;
  missions.index = saveData.index;
  missions.done = saveData.done.slice();
  missions.freeRoam = missions.index >= MISSIONS.length;
  player.health = 100;
  wanted.setStars(0, 'continue');
  player.respawnAt(PLACES.start.x, PLACES.start.z);
  player.yaw = Math.PI;
  cameraRig.yaw = Math.PI;
  showNextCard();
}

function cardGo() {
  audio.ensure();
  if (missions.index < MISSIONS.length) {
    missions.startMission(missions.index);
  } else {
    missions.freeRoam = true;
    if (!missions.sideJob) missions.startSideJob(player);
    hud.setObjective('Free Roam', 'Take side jobs — taxi fares and courier runs pay cash.');
  }
  setScreen('play');
}

function caught(kind, fine) {
  if (missions.current) missions.fail(kind === 'busted' ? 'Busted by the police.' : 'You went down.');
  saveGame();
  if (kind === 'busted') {
    document.getElementById('busted-fine').textContent = `Fine: $${fine} — the cops took you in.`;
    setScreen('busted');
  } else {
    document.getElementById('wasted-fine').textContent = `Hospital bill: $${fine} — you woke up at the clinic.`;
    setScreen('wasted');
  }
}

function afterCaught() {
  saveGame();
  showNextCard();
}

function saveGame() {
  const data = { cash: player.cash, index: missions.index, done: missions.done.slice() };
  saveData = data;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch { /* storage unavailable */ }
}

function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.index !== 'number' || !Array.isArray(data.done)) return null;
    return data;
  } catch {
    return null;
  }
}

// ---- combat hit tests ----
function shootRay(ray) {
  audio.gunshot();
  effects.muzzle(ray.x + ray.dx * 1.2, ray.z + ray.dz * 1.2);
  cameraRig.addShake(0.25);
  wanted.crimeShotFired();
  // Peds in the line of fire go down.
  for (const ped of [...peds.list]) {
    if (ped.state === 'down') continue;
    const dx = ped.x - ray.x;
    const dz = ped.z - ray.z;
    const along = dx * ray.dx + dz * ray.dz;
    if (along < 0 || along > ray.range) continue;
    const perp = Math.abs(dx * ray.dz - dz * ray.dx);
    if (perp < 1.6) {
      peds.knockDown(ped.x, ped.z, 2.2);
      return;
    }
  }
  // Hitting a police cruiser just sparks — and the law notices (already did).
  for (const cop of vehicles.police) {
    const dx = cop.x - ray.x;
    const dz = cop.z - ray.z;
    const along = dx * ray.dx + dz * ray.dz;
    if (along < 0 || along > ray.range) continue;
    const perp = Math.abs(dx * ray.dz - dz * ray.dx);
    if (perp < 2.2) {
      effects.sparks(cop.x, cop.z);
      return;
    }
  }
}

// ---- debug hook for play-tests and screenshots ----
function state() {
  const missionCar = (() => {
    if (!missions.current) return null;
    if (missions.current.def.id === 'first-wheels' && missions.current.stage === 'start') {
      return { x: PLACES.sedanSpot.x, z: PLACES.sedanSpot.z };
    }
    if (missions.current.def.id === 'big-score' && missions.current.stage === 'start') {
      return { x: PLACES.vanSpot.x, z: PLACES.vanSpot.z };
    }
    return null;
  })();
  const near = vehicles.nearestParked(player.x, player.z, 30);
  return {
    screen,
    mission: missions.current ? { id: missions.current.def.id } : null,
    // Top-level position/yaw mirror what the play-tests read directly.
    x: Math.round(player.x * 10) / 10,
    z: Math.round(player.z * 10) / 10,
    yaw: Math.round(player.yaw * 100) / 100,
    player: {
      x: Math.round(player.x * 10) / 10,
      z: Math.round(player.z * 10) / 10,
      yaw: Math.round(player.yaw * 100) / 100,
      heading: Math.round(player.heading * 100) / 100,
      inCar: player.inCar,
    },
    wanted: wanted.level,
    health: Math.round(player.health),
    cash: player.cash,
    carSpeed: Math.round((player.inCar && player.car ? player.car.speed : 0) * 10) / 10,
    missionCar,
    nearestParked: near ? { x: Math.round(near.x * 10) / 10, z: Math.round(near.z * 10) / 10 } : null,
    nextMission: missions.index,
  };
}

window.__solmar = { state };
window.__shotReady = false;

// ---- frame loop ----
const clock = { last: performance.now() };
let frames = 0;

if (SHOT) {
  // Staged screenshot: straight into the scene, no menus.
  setScreen('play');
  shots.apply(SHOT);
} else {
  setScreen('title');
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - clock.last) / 1000 || 0.016);
  clock.last = now;
  frames += 1;

  if (screen === 'title') {
    titleTime += dt;
    cameraRig.titleOrbit(dt, titleTime);
    effects.update(dt);
  } else if (screen === 'play') {
    audio.ensure();
    // Global keys.
    if (input.hit('Escape') || input.hit('KeyP')) {
      setScreen('pause');
    } else if (!player.inCar && input.hit('KeyE')) {
      player.trySteal(vehicles);
    } else if (player.inCar && input.hit('KeyF')) {
      player.exitCar(vehicles);
    }
    if (input.hit('KeyQ')) player.toggleWeapon();
    if (input.hit('KeyR')) player.reload();
    if (input.clicked && !player.inCar) {
      if (player.weapon === 'pistol') player.shoot();
      else player.punch(peds.list.filter((p) => p.state !== 'down'));
    }

    if (player.inCar) {
      vehicles.setDriveInput({
        steer: input.steer(),
        throttle: input.throttle(),
        handbrake: input.down('Space'),
      });
      player.syncToCar();
    } else {
      player.updateOnFoot(dt, input, cameraRig.yaw);
    }
    vehicles.update(dt, player, wanted.level);
    peds.update(dt, player);
    wanted.update(dt, player);
    missions.update(dt, player, vehicles, peds, wanted);
    effects.update(dt);
    cameraRig.update(dt, player, input);
    audio.engine(player.inCar ? Math.abs(player.carSpeed) / 36 : 0, player.inCar);
    audio.siren(wanted.level, dt);

    // HUD refresh.
    const m = missions.current;
    hud.setObjective(
      currentObjectiveTitle(),
      m ? (m.target ? m.target.label : m.def.brief) : missions.sideJob ? missions.sideJob.target.label : 'Cruise Solmar Bay.',
    );
    hud.setTimer(m && m.def.id === 'package-run' ? m.timeLeft : null);
    hud.setStats({
      cash: player.cash,
      debtLeft: Math.max(0, ECONOMY.debt - player.cash),
      stars: wanted.level,
      health: player.health,
      speed: player.carSpeed,
      inCar: player.inCar,
      weapon: player.weapon,
      ammo: player.ammo,
    });
    hud.drawMinimap({
      player: { x: player.x, z: player.z, heading: player.heading },
      cops: vehicles.police.map((c) => ({ x: c.x, z: c.z })),
      target: m ? m.target : missions.sideJob ? missions.sideJob.target : null,
    });
    hud.tickToast(dt);

    if (SHOT) shots.tick();
  }

  renderer.render(scene, camera);
  input.endFrame();
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

requestAnimationFrame(frame);
