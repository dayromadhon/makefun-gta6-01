// Solmar Heat — boot and the one loop. The world is built from the modules in src/,
// the loop advances it in fixed 1/60 s steps, and the screens (title, play, pause,
// mission card, busted/wasted) decide what updates and what the menus show.
//
// ?seed=N fixes the city. ?shot=cover|street|chase|mission (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady.

import * as THREE from 'three';
import { CAMERA, CITY, PALETTE, PLAYER, SAVE_KEY, STEP, TRAFFIC } from './config.js';
import { createRandom } from './random.js';
import { ACTION_CONFIRM, ACTION_ENTER, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createCity } from './city.js';
import { createCar, createVehicles } from './vehicles.js';
import { createPeds } from './peds.js';
import { createPlayer } from './player.js';
import { createWanted } from './wanted.js';
import { createMissions } from './missions.js';
import { createHud } from './hud.js';
import { createCamera } from './camera.js';
import { createEffects } from './effects.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const CAR_NAMES = { sedan: 'Street Sedan', taxi: 'Taxi Cab', police: 'Interceptor', van: 'Courier Van' };

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const random = createRandom(seed);

const canvas = document.getElementById('game');
// ?fx=low turns off shadows and antialiasing for weak machines (and for the
// software renderer in headless testing, where shadows cost most of the frame).
const lowFx = params.get('fx') === 'low';
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !lowFx });
renderer.setPixelRatio(lowFx ? 1 : Math.min(window.devicePixelRatio || 1, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = !lowFx;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.fog);
scene.fog = new THREE.Fog(PALETTE.fog, 200, 620);

// Gradient sky dome, a low sun and a few soft clouds — the flat fog colour alone
// made every horizon look empty.
function makeSkyTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 4;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2f6fb4');
  grad.addColorStop(0.45, '#7fb3d5');
  grad.addColorStop(0.72, '#ffd9a0');
  grad.addColorStop(1, '#f2c98f');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 4, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const sky = new THREE.Mesh(
  new THREE.SphereGeometry(820, 24, 16),
  new THREE.MeshBasicMaterial({ map: makeSkyTexture(), side: THREE.BackSide, fog: false }),
);
scene.add(sky);

function makeGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const glowTex = makeGlowTexture();
const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xfff2c0, fog: false, depthWrite: false }));
sunSprite.scale.setScalar(190);
sunSprite.position.set(330, 260, -560);
scene.add(sunSprite);
for (const [cx, cy, cz, cs, co] of [[-260, 150, -420, 170, 0.55], [140, 175, -480, 210, 0.45], [420, 140, -300, 150, 0.5], [-420, 165, 120, 190, 0.4], [60, 155, 480, 180, 0.5], [-140, 180, 380, 140, 0.45]]) {
  const cloud = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffffff, transparent: true, opacity: co, fog: false, depthWrite: false }));
  cloud.scale.set(cs, cs * 0.36, 1);
  cloud.position.set(cx, cy, cz);
  scene.add(cloud);
}

const camera3d = new THREE.PerspectiveCamera(68, window.innerWidth / window.innerHeight, 0.1, 1000);
const sun = new THREE.DirectionalLight(PALETTE.sun, 2.4);
sun.position.set(140, 190, 80);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -130;
sun.shadow.camera.right = 130;
sun.shadow.camera.top = 130;
sun.shadow.camera.bottom = -130;
sun.shadow.camera.near = 20;
sun.shadow.camera.far = 600;
sun.shadow.bias = -0.0006;
scene.add(sun);
scene.add(sun.target);
const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x8a6f4d, 0.9);
scene.add(hemi);

const city = createCity(scene, random);
const vehicles = createVehicles(scene, city, random);
const peds = createPeds(scene, city, random);
const player = createPlayer(scene, 0, -40);
const wanted = createWanted();
const missions = createMissions(city, random);
const audio = createAudio();
const hud = createHud();
const chaseCamera = createCamera(camera3d);
const effects = createEffects(scene);
const input = createInput(canvas);

let screen = 'title';
let cash = 120;
let trafficTimer = 0;
let policeCars = [];
let footCops = [];
let saveData = null;

try {
  saveData = JSON.parse(window.localStorage.getItem(SAVE_KEY) ?? 'null');
} catch {
  saveData = null;
}

function saveGame() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ cash, missionsDone: missions.nextIndex, storyDone: missions.storyDone }));
  } catch {
    // Storage can be off: progress then lasts this visit only.
  }
}

// The mission beacon: a column of light over the current objective.
const beaconMat = new THREE.MeshBasicMaterial({ color: PALETTE.mission, transparent: true, opacity: 0.22, depthWrite: false });
const beacon = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 60, 12, 1, true), beaconMat);
beacon.position.y = 30;
scene.add(beacon);
const beaconRing = new THREE.Mesh(new THREE.TorusGeometry(3, 0.28, 8, 24), new THREE.MeshBasicMaterial({ color: PALETTE.mission }));
beaconRing.rotation.x = Math.PI / 2;
beaconRing.position.y = 0.3;
scene.add(beaconRing);
beacon.visible = false;
beaconRing.visible = false;

const events = {
  onStealCar(car, wasParked, wasPolice) {
    audio.click();
    if (wasPolice) wanted.addStars(2, events);
    else if (!wasParked) wanted.addStars(1, events);
    else {
      let seen = false;
      for (const cop of policeCars) {
        if (Math.hypot(cop.x - player.x, cop.z - player.z) < 60) seen = true;
      }
      if (!seen) {
        const ped = peds.nearestPed(player.x, player.z, 25);
        if (ped) seen = true;
      }
      if (seen) wanted.addStars(1, events);
    }
    hud.toast(wasPolice ? 'You stole a police car!' : 'Car stolen');
  },
  onEnterCar() {
    audio.click();
  },
  onExitCar() {
    audio.click();
  },
  onHitPed() {
    wanted.addStars(1, events);
  },
  onShootHit(target, isPed) {
    if (isPed) wanted.addStars(target.cop ? 2 : 1, events);
  },
  onShoot() {
    audio.gunshot();
    peds.scare(player.x, player.z, 40);
  },
  onPunchHit(target) {
    audio.punch();
    if (target.cop) wanted.addStars(1, events);
  },
  onPunch() {
    audio.punch();
  },
  onCrash(strength) {
    audio.crash(strength);
    effects.addShake(0.25 + strength * 0.5);
  },
  onCarDestroyed(car) {
    effects.burst(car.x, 1.5, car.z, 40, 9, 1, 1.2, 1, 0.6, 0.15);
    effects.smoke(car.x, 2, car.z);
    audio.crash(1);
    effects.addShake(0.8);
    wanted.addStars(1, events);
    hud.toast('Your car blew up!');
  },
  onWantedUp(stars) {
    audio.wantedUp();
    hud.toast(stars >= 3 ? `Wanted level ${stars} — the whole city is after you` : `Wanted level ${stars}`);
  },
  onWantedDown() {},
  onWantedClear() {
    hud.toast('You lost them. Clean.');
  },
  onStepComplete() {
    audio.pickup();
  },
  onMissionComplete(mission, reward) {
    cash += reward;
    audio.missionDone();
    saveGame();
    hud.toast(`${mission.title} complete — +$${reward}`);
    if (missions.storyDone) {
      hud.toast('Debt paid! Free roam — Ada keeps sending side jobs.');
      missions.startNext(events);
    } else {
      const next = missions.missions[missions.nextIndex];
      if (next) showCard(next);
    }
  },
  onMissionFail(mission, reason) {
    audio.missionFail();
    hud.toast(`Mission failed — ${reason}`);
    showCard(mission);
  },
  onMissionStartWanted(stars) {
    wanted.addStars(stars, events);
  },
  onNeedVan() {
    const van = createCar('van', 0xd8d8d8, 0, 12, Math.PI);
    vehicles.add(van);
    hud.toast('The courier van is at the downtown bank');
  },
};

function showCard(mission) {
  screen = 'card';
  world.screen = screen;
  hud.showCard(mission, () => {
    audio.unlock();
    audio.click();
    if (mission.id.startsWith('side-')) missions.startNext(events);
    else missions.startMission(missions.nextIndex, events);
    screen = 'play';
    world.screen = screen;
    hud.hideMenus();
  });
}

function setScreen(next) {
  screen = next;
  world.screen = next;
  if (next === 'title') {
    player.mesh.visible = false;
    hud.showTitle(saveData);
  } else if (next === 'paused') {
    hud.showPause();
  } else if (next === 'play') {
    player.mesh.visible = true;
    hud.hideMenus();
  }
}

function startNewGame() {
  cash = 120;
  saveGame();
  missions.setProgress(0);
  player.health = PLAYER.maxHealth;
  player.ammo = PLAYER.pistolMag;
  player.reserveAmmo = 48;
  player.dead = false;
  player.x = 0;
  player.z = -40;
  player.heading = 0;
  wanted.clear(events);
  chaseCamera.snap({ x: player.x, y: 0, z: player.z }, player.heading);
  audio.unlock();
  showCard(missions.missions[0]);
}

function continueGame() {
  if (!saveData) return;
  cash = saveData.cash ?? 120;
  missions.setProgress(saveData.missionsDone ?? 0);
  player.health = PLAYER.maxHealth;
  player.ammo = PLAYER.pistolMag;
  player.reserveAmmo = 48;
  player.dead = false;
  player.x = 0;
  player.z = -40;
  player.heading = 0;
  wanted.clear(events);
  chaseCamera.snap({ x: player.x, y: 0, z: player.z }, player.heading);
  audio.unlock();
  const next = missions.missions[saveData.missionsDone] ?? null;
  if (next) showCard(next);
  else {
    setScreen('play');
    missions.startNext(events);
  }
}

function respawn() {
  const busted = wanted.stars > 0;
  const loss = busted ? Math.min(cash, Math.max(50, Math.round(cash * 0.1))) : 200;
  cash = Math.max(0, cash - loss);
  saveGame();
  player.health = PLAYER.maxHealth;
  player.dead = false;
  if (player.car) {
    vehicles.remove(player.car);
    player.car = null;
  }
  player.x = 0;
  player.z = 190;
  player.heading = Math.PI;
  player.ammo = PLAYER.pistolMag;
  player.reserveAmmo = 48;
  wanted.clear(events);
  for (const cop of footCops) peds.removeCop(cop);
  footCops = [];
  chaseCamera.snap({ x: player.x, y: 0, z: player.z }, player.heading);
  setScreen('play');
}

hud.bindButtons({
  onNewGame: () => {
    audio.unlock();
    startNewGame();
  },
  onContinue: () => {
    audio.unlock();
    continueGame();
  },
  onResume: () => {
    audio.click();
    setScreen('play');
  },
  onRestartMission: () => {
    audio.click();
    missions.retry(events);
    setScreen('play');
  },
  onQuitToTitle: () => {
    audio.click();
    saveGame();
    setScreen('title');
  },
  onRetry: () => {
    audio.click();
    respawn();
  },
  onMute: () => {
    audio.setMuted(!audio.isMuted());
    hud.setMuteLabel(audio.isMuted());
  },
});

function spawnPoliceCarNear() {
  for (let tries = 0; tries < 12; tries += 1) {
    const point = city.randomRoadPoint();
    const dist = Math.hypot(point.x - player.x, point.z - player.z);
    if (dist > 42 && dist < 85) {
      const car = vehicles.spawnPoliceCar(point.x, point.z);
      policeCars.push(car);
      return car;
    }
  }
  const point = city.randomRoadPoint();
  const car = vehicles.spawnPoliceCar(point.x, point.z);
  policeCars.push(car);
  return car;
}

function updatePolice(dt) {
  const want = wanted.policeCount();
  while (policeCars.length < want) spawnPoliceCarNear();
  while (policeCars.length > want) {
    const car = policeCars.pop();
    vehicles.remove(car);
  }
  // Foot cops when Leo is on foot and the heat is on.
  const wantCops = !player.car && wanted.stars >= 2 ? Math.min(2, wanted.stars - 1) : 0;
  while (footCops.length < wantCops) {
    const anchor = policeCars[0];
    if (!anchor) break;
    footCops.push(peds.spawnCop(anchor.x + 2, anchor.z + 2));
  }
  while (footCops.length > wantCops) {
    const cop = footCops.pop();
    peds.removeCop(cop);
  }
}

function spawnPolice(n) {
  for (let i = 0; i < n; i += 1) spawnPoliceCarNear();
}

function resetShot() {
  wanted.clear(events);
  player.health = PLAYER.maxHealth;
  player.ammo = PLAYER.pistolMag;
  player.reserveAmmo = 48;
  player.dead = false;
  if (player.car) {
    player.car.driver = null;
    player.car = null;
  }
  for (const cop of footCops) peds.removeCop(cop);
  footCops = [];
}

const world = {
  city,
  vehicles,
  peds,
  player,
  wanted,
  missions,
  audio,
  effects,
  camera: chaseCamera,
  cameraYaw: 0,
  screen,
  events,
  resetShot,
  spawnPolice,
  updatePolice,
  frameActions: 0,
};

function hudState() {
  const marker = missions.marker;
  let objective = missions.objectiveText();
  if (marker) {
    const dist = Math.round(Math.hypot(player.x - marker.x, player.z - marker.z));
    objective += `  (${dist}m)`;
  }
  let hint = '';
  if (screen === 'play') {
    if (player.car) hint = 'E — get out · Space — handbrake · H — horn · M — mute';
    else {
      const near = vehicles.nearestCar(player.x, player.z, 3.6, (c) => c !== player.car);
      hint = near ? 'E — steal the car' : 'WASD — move · Shift — run · F — punch · Click — shoot · E — enter car';
    }
  }
  return {
    cash,
    health: player.health,
    maxHealth: PLAYER.maxHealth,
    ammo: player.ammo,
    reserveAmmo: player.reserveAmmo,
    stars: wanted.stars,
    speed: player.car ? player.car.speed : 0,
    inCar: !!player.car,
    carName: player.car ? CAR_NAMES[player.car.kind] ?? 'Car' : '',
    objective,
    timeLeft: missions.timeLeft,
    timeLimit: missions.timeLimit,
    hint,
  };
}

function stepWorld(dt, actions) {
  const look = input.takeLook();
  if (look.dx !== 0 || look.dy !== 0 || look.wheel !== 0) chaseCamera.look(look.dx, look.dy, look.wheel);
  world.cameraYaw = chaseCamera.yaw;
  player.update(dt, input, world, events, actions);
  // Driving into pedestrians.
  if (player.car && Math.abs(player.car.speed) > 5) {
    for (const ped of peds.peds) {
      if (!ped.alive) continue;
      const dist = Math.hypot(ped.x - player.car.x, ped.z - player.car.z);
      if (dist < 2.0) {
        peds.knockDown(ped);
        events.onHitPed();
        effects.sparks(ped.x, 1, ped.z);
      }
    }
  }
  // Player car crash feedback (drivePlayer returns the collision result).
  // (Handled inside player.update via vehicles; crash sound comes from police cars here.)
  vehicles.update(dt, player, city, events);
  // Destroyed traffic / police cars explode.
  for (const car of [...vehicles.cars]) {
    if (car.health <= 0 && car.driver !== 'player') {
      effects.burst(car.x, 1.5, car.z, 40, 9, 1, 1.2, 1, 0.6, 0.15);
      audio.crash(1);
      effects.addShake(0.7);
      vehicles.remove(car);
      const pi = policeCars.indexOf(car);
      if (pi !== -1) policeCars.splice(pi, 1);
    }
  }
  peds.update(dt, player, city);
  wanted.update(dt, player, policeCars, footCops, events);
  missions.update(dt, player, wanted, events);
  updatePolice(dt);
  // Keep the streets busy.
  trafficTimer -= dt;
  if (trafficTimer <= 0) {
    trafficTimer = 1;
    const trafficCount = vehicles.cars.filter((c) => c.driver === 'traffic').length;
    if (trafficCount < TRAFFIC.count) vehicles.spawnTrafficCar();
  }
  // Exhaust dust and damage smoke.
  if (player.car) {
    if (Math.abs(player.car.speed) > 20 && Math.random() < 0.3) {
      effects.dust(player.car.x - Math.sin(player.car.heading) * 2, 0.4, player.car.z - Math.cos(player.car.heading) * 2);
    }
    if (player.car.health < 40 && Math.random() < 0.4) {
      effects.smoke(player.car.x, 1.6, player.car.z);
    }
  }
  // Mission beacon.
  const marker = missions.marker;
  if (marker) {
    beacon.visible = true;
    beaconRing.visible = true;
    beacon.position.set(marker.x, 30, marker.z);
    beaconRing.position.set(marker.x, 0.3, marker.z);
    beacon.rotation.y += dt;
  } else {
    beacon.visible = false;
    beaconRing.visible = false;
  }
  // Camera follows the player.
  chaseCamera.update(dt, { x: player.x, y: player.y, z: player.z }, player.car ? player.car.heading : player.heading, !!player.car);
  // Sun follows the player so shadows stay local.
  sun.position.set(player.x + 140, 190, player.z + 80);
  sun.target.position.set(player.x, 0, player.z);
  effects.update(dt);
  // Audio: engine and sirens.
  if (player.car) audio.setEngine(Math.abs(player.car.speed) / 42, true);
  else audio.setEngine(0, false);
  let nearestSiren = Infinity;
  for (const car of policeCars) {
    nearestSiren = Math.min(nearestSiren, Math.hypot(car.x - player.x, car.z - player.z));
  }
  audio.setSiren(policeCars.length > 0, Math.max(0, 1 - nearestSiren / 70));
  hud.update(hudState());
  const traffic = vehicles.cars.filter((c) => c.driver === 'traffic');
  hud.drawMinimap(player, policeCars, traffic, marker);
  effects.applyShake(camera3d);
}

function tick(now) {
  requestAnimationFrame(tick);
  const actions = input.takeActions();
  if (actions & ACTION_MUTE) {
    audio.setMuted(!audio.isMuted());
    hud.setMuteLabel(audio.isMuted());
  }
  if (screen === 'title') {
    // Slow orbit over downtown behind the title screen.
    const t = now / 1000;
    camera3d.position.set(Math.sin(t * 0.05) * 130, 55, Math.cos(t * 0.05) * 130);
    camera3d.lookAt(0, 0, 0);
    vehicles.update(STEP, player, city, events);
    peds.update(STEP, player, city);
    effects.update(STEP);
    renderer.render(scene, camera3d);
    return;
  }
  if (screen !== 'play') {
    renderer.render(scene, camera3d);
    return;
  }
  if (actions & ACTION_PAUSE) {
    setScreen('paused');
    renderer.render(scene, camera3d);
    return;
  }
  tick.accumulator = Math.min((tick.accumulator ?? 0) + Math.min((now - (tick.last ?? now)) / 1000, MAX_FRAME), MAX_FRAME * 4);
  tick.last = now;
  // One-shot actions (E to enter/exit a car, F to punch, click to shoot) belong to
  // exactly one substep: reusing the same bits across every substep of a slow frame
  // would enter AND exit the car in the same frame, and stack a wanted star per enter.
  let firstStep = true;
  while (tick.accumulator >= STEP) {
    stepWorld(STEP, firstStep ? actions : 0);
    firstStep = false;
    tick.accumulator -= STEP;
  }
  // If the player died during the steps, show the end screen.
  if (player.dead) {
    const busted = wanted.stars > 0;
    setScreen('end');
    hud.showEnd(busted ? 'busted' : 'wasted', busted
      ? 'The Solmar Bay PD caught up with you. You lose 10% of your cash — and your ride.'
      : 'You got knocked out cold. The hospital bill is $200.');
    renderer.render(scene, camera3d);
    return;
  }
  renderer.render(scene, camera3d);
}

function runShot(name) {
  stageShot(name, world);
  // The beacon only shows when a mission marker exists (stepWorld does this in play).
  const shotMarker = missions.marker;
  if (shotMarker) {
    beacon.visible = true;
    beaconRing.visible = true;
    beacon.position.set(shotMarker.x, 30, shotMarker.z);
    beaconRing.position.set(shotMarker.x, 0.3, shotMarker.z);
  }
  hud.update(hudState());
  const marker = missions.marker;
  const traffic = vehicles.cars.filter((c) => c.driver === 'traffic');
  hud.drawMinimap(player, policeCars, traffic, marker);
  let painted = 0;
  function paint() {
    renderer.render(scene, camera3d);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

window.addEventListener('resize', () => {
  camera3d.aspect = window.innerWidth / window.innerHeight;
  camera3d.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && screen === 'play') setScreen('paused');
});

// A few traffic cars from the start, so the title backdrop is alive.
for (let i = 0; i < 6; i += 1) vehicles.spawnTrafficCar();

// Small read-only handle for automated play-testing (it never changes gameplay).
window.__solmar = {
  state() {
    const a = missions.active;
    return {
      screen,
      cash,
      health: player.health,
      ammo: player.ammo,
      player: { x: +player.x.toFixed(1), z: +player.z.toFixed(1), inCar: !!player.car, heading: +player.heading.toFixed(2) },
      carSpeed: player.car ? +player.car.speed.toFixed(1) : 0,
      wanted: wanted.stars,
      mission: a ? { id: a.mission.id, step: a.stepIndex, timeLeft: Math.round(a.timeLeft) } : null,
      nextMission: missions.nextIndex,
      storyDone: missions.storyDone,
      yaw: +chaseCamera.yaw.toFixed(2),
      marker: missions.marker ? { x: missions.marker.x, z: missions.marker.z } : null,
      nearestParked: (() => {
        let best = null;
        let bestD = Infinity;
        for (const c of vehicles.cars) {
          if (c.driver !== null) continue;
          const d = Math.hypot(c.x - player.x, c.z - player.z);
          if (d < bestD) {
            bestD = d;
            best = c;
          }
        }
        return best ? { x: best.x, z: best.z, kind: best.kind, dist: +bestD.toFixed(1) } : null;
      })(),
    };
  },
};

if (shot) {
  setScreen('play');
  hud.hideMenus();
  runShot(shot);
} else {
  setScreen('title');
  requestAnimationFrame(tick);
}
