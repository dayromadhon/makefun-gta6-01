// The ?shot= scenes behind the four screenshots. Each one stages the real game
// from a fixed seed, drives it forward with a scripted input for a fixed number
// of steps, then leaves the camera on a composed frame. The frame is what a
// short real session looks like, and the same seed always gives the same frame.

import { SHOT_SEED } from './config.js';
import { makeScriptedDriver } from './input.js';

/**
 * Stage a scene and return the screen the HUD should draw over it.
 * game: the Game instance (see main.js). name: cover | street | chase | mission.
 */
export function stageShot(name, game) {
  const driver = makeScriptedDriver();
  game.input.setScripted(driver);
  const step = (n, hold = [], tap = null) => {
    for (const k of hold) driver.hold(k);
    if (tap) driver.tap(tap);
    for (let i = 0; i < n; i++) game.step(1 / 60, true);
    for (const k of hold) driver.release(k);
  };

  if (name === 'street') {
    // Leo driving at speed down an avenue, traffic around him.
    game.reset(SHOT_SEED);
    const car = game.vehicles.nearestCar(0, 0, 60);
    if (car) {
      game.player.enterCar(car);
      car.x = 0;
      car.z = -52;
      car.heading = 0; // north along the 0 street
      car.mesh.position.set(0, 0, -52);
      car.mesh.rotation.y = 0;
    }
    game.player.x = 0;
    game.player.z = -52;
    step(180, ['KeyW']); // 3 s of driving
    game.cameraRig.snap({ x: game.player.x, y: 0, z: game.player.z }, game.player.heading, 13, 0.28);
    game.input.clearScripted();
    return { screen: 'play', best: 0 };
  }

  if (name === 'chase') {
    // Two stars, a police car on Leo's tail, driving hard.
    game.reset(SHOT_SEED);
    const car = game.vehicles.nearestCar(0, 0, 60);
    if (car) {
      game.player.enterCar(car);
      // Start at the west edge of the grid and drive east: 4 s at full speed
      // ends around x=60, still inside the city (the sea starts at x=158).
      car.x = -52;
      car.z = 0;
      car.heading = Math.PI / 2; // east along the 0 street
      car.mesh.position.set(-52, 0, 0);
      car.mesh.rotation.y = Math.PI / 2;
    }
    game.player.x = -52;
    game.player.z = 0;
    game.wanted.setHeat(2);
    game.vehicles.ensurePolice(2, game.player.pos);
    step(240, ['KeyW']); // 4 s of pursuit
    game.cameraRig.snap({ x: game.player.x, y: 0, z: game.player.z }, game.player.heading, 13, 0.3);
    game.input.clearScripted();
    return { screen: 'play', best: 0 };
  }

  if (name === 'mission') {
    // Package Run in progress: package collected, timer running, beacon on
    // Hotel Solmar, Leo driving toward it.
    game.reset(SHOT_SEED);
    game.missions.index = 1;
    game.missions.phase = 'go';
    game.missions.started = true;
    game.missions.timer = 82;
    const car = game.vehicles.nearestCar(52, 130, 80);
    if (car) {
      game.player.enterCar(car);
      car.x = 52;
      car.z = 104;
      car.heading = Math.PI; // north, toward the hotel
      car.mesh.position.set(52, 0, 104);
      car.mesh.rotation.y = Math.PI;
    }
    game.player.x = 52;
    game.player.z = 104;
    step(150, ['KeyW']); // 2.5 s toward the hotel
    game.cameraRig.snap({ x: game.player.x, y: 0, z: game.player.z }, game.player.heading, 13, 0.3);
    game.input.clearScripted();
    return { screen: 'play', best: 0 };
  }

  // Default: 'cover' — Leo on foot downtown at golden hour, mission card up,
  // traffic and pedestrians moving around him.
  game.reset(SHOT_SEED);
  game.player.x = -6;
  game.player.z = -6;
  game.player.heading = Math.PI * 0.75;
  game.player.mesh.position.set(-6, 0, -6);
  game.player.mesh.rotation.y = Math.PI * 0.75;
  step(180, []); // 3 s of city life
  game.cameraRig.snap({ x: -6, y: 0, z: -6 }, Math.PI * 0.75, 9, 0.35);
  game.input.clearScripted();
  return { screen: 'title', best: 0 };
}
