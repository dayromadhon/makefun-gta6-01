// SOLMAR HEAT — shots.js
// One job: the ?shot= scenes the screenshots are taken from. Each scene sets
// up a real game state (a real car, real police, a real mission), plays the
// real update loop forward a fixed number of frames from a fixed seed, then
// marks window.__shotReady. Nothing here is a mock render — it is the game.

import { LANDMARKS } from './config.js';

function placePlayerInCar(game, x, z, heading, speed) {
  const car = game.vehicles.spawnParkedCar();
  car.x = x;
  car.z = z;
  car.heading = heading;
  car.speed = speed;
  car.mesh.position.set(x, 0, z);
  car.mesh.rotation.y = heading;
  game.player.enterCar(car);
  game.player.x = x;
  game.player.z = z;
  game.cameraRig.yaw = heading;
  game.cameraRig.snap({ x, z, heading, inCar: true });
  return car;
}

function stepFrames(game, n) {
  for (let i = 0; i < n; i++) game.step(1 / 60);
  game.hud.update(game.hudState());
  game.renderer.render(game.scene, game.camera);
  window.__shotReady = true;
}

export function setupShot(name, game) {
  const g = game;
  g.audio.setMuted(true);
  if (name === 'cover') {
    // Leo on foot in Solmar Plaza, downtown towers behind him, a car and
    // pedestrians around, mission 1 card on the HUD. He stands a little off
    // the street centre so no parked car hides him.
    g.player.reset(4, 18);
    g.player.heading = Math.PI; // facing the downtown towers (-Z)
    g.cameraRig.yaw = Math.PI;
    g.cameraRig.snap({ x: 4, z: 18, heading: Math.PI, inCar: false });
    g.missions.index = 0;
    g.missions.stage = 0;
    g.missions.marker = null;
    g.hud.showMissionCard(g.missions.current);
    stepFrames(g, 60);
  } else if (name === 'street') {
    // Driving down the main avenue with traffic around. A modest speed and
    // a short run, so the car is still rolling (not stopped after a bump).
    g.missions.index = 0;
    g.missions.stage = 1;
    g.missions.marker = { x: LANDMARKS.garage.x, z: LANDMARKS.garage.z, label: LANDMARKS.garage.name };
    g.hud.showMissionCard(g.missions.current);
    const car = placePlayerInCar(g, -60, 0, Math.PI / 2, 18);
    car.speed = 18;
    stepFrames(g, 45);
  } else if (name === 'chase') {
    // Two stars, two police cars closing in, peds scattering. The car sits
    // a little off the street centre so no streetlight lamp fills the frame.
    g.missions.index = 2;
    g.missions.stage = 0;
    g.missions.marker = null;
    g.hud.showMissionCard(g.missions.current);
    const car = placePlayerInCar(g, 4, 50, 0, 26);
    car.speed = 26;
    g.wanted.setHeat(2);
    const cop1 = g.vehicles.spawnPolice(-2, 30);
    cop1.speed = 24;
    const cop2 = g.vehicles.spawnPolice(12, 28);
    cop2.speed = 24;
    g.peds.scare(4, 50, 30);
    stepFrames(g, 80);
  } else if (name === 'mission') {
    // Package Run: the package is collected, the clock is running, the
    // beacon at Hotel Solmar pulls the eye across the city. The car starts
    // ON the street x=50 and drives north along it toward the hotel.
    g.missions.index = 1;
    g.missions.stage = 1;
    g.missions.timer = 58;
    g.missions.marker = { x: LANDMARKS.hotel.x, z: LANDMARKS.hotel.z, label: LANDMARKS.hotel.name };
    g.hud.showMissionCard(g.missions.current);
    const car = placePlayerInCar(g, 50, 50, Math.PI, 24);
    car.speed = 24;
    g.effects.setBeacon(LANDMARKS.hotel.x, LANDMARKS.hotel.z, true);
    stepFrames(g, 60);
  } else {
    // Unknown shot name: just show the plaza.
    g.player.reset(0, 18);
    g.cameraRig.snap({ x: 0, z: 18, heading: Math.PI, inCar: false });
    stepFrames(g, 30);
  }
}
