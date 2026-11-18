// shots.js — ?shot= scenes: play the real game forward from a fixed seed, then
// set window.__shotReady so the screenshot script knows the frame is ready.
export function runShot(name, game) {
  const { player, vehicles, wanted, missions, camera, hud, city } = game;
  const step = (n) => {
    for (let i = 0; i < n; i++) game.stepAmbient(1 / 30);
  };
  // No menus in a shot: straight into the world.
  hud.hideTitle();
  hud.hideMissionCard();
  hud.hideSplash();
  hud.hidePause();

  if (name === 'cover') {
    // On foot in Central Plaza (the z=30 road), downtown towers ahead,
    // traffic and peds around.
    player.spawn(0, 30);
    player.heading = Math.PI;
    player.mesh.rotation.y = Math.PI;
    missions.index = 0;
    missions.stage = 0;
    missions.active = true;
    const car = vehicles.parked[0];
    missions.setObjective(car.mesh.position.x, car.mesh.position.z, 'Steal a car');
    hud.setObjective('Steal a car (press E near one)');
    step(150);
    camera.setPose(8, 6, 40, -6, 5, -60);
  } else if (name === 'street') {
    // Driving east down the z=-30 palm avenue, traffic ahead.
    const car = vehicles.parked[2];
    player.spawn(car.mesh.position.x, car.mesh.position.z);
    player.enterCar(car, game);
    player.carSpeed = 22;
    car.mesh.rotation.y = Math.PI / 2;
    car.mesh.position.set(-90, 0, -30);
    missions.index = 0;
    missions.active = false;
    missions.clearObjective();
    hud.setObjective('');
    step(120);
    // Keep rolling forward while the camera frames the avenue.
    car.mesh.position.x += 30;
    player.pos.set(car.mesh.position.x, 0, car.mesh.position.z);
    camera.setPose(-118, 6, -36, -60, 2, -30);
  } else if (name === 'chase') {
    // 3-star chase: police cars on the player's tail, east on the z=30 road.
    const car = vehicles.parked[3];
    player.spawn(car.mesh.position.x, car.mesh.position.z);
    player.enterCar(car, game);
    player.carSpeed = 26;
    car.mesh.rotation.y = Math.PI / 2;
    car.mesh.position.set(-40, 0, 30);
    wanted.setStars(3);
    missions.index = 0;
    missions.active = false;
    missions.clearObjective();
    hud.setObjective('Lose the cops!');
    step(150);
    car.mesh.position.x += 24;
    player.pos.set(car.mesh.position.x, 0, car.mesh.position.z);
    camera.setPose(-72, 7, 20, -10, 2, 30);
  } else if (name === 'mission') {
    // Mission 2 in progress: package run to Hotel Solmar, beacon lit, timer live.
    const car = vehicles.parked[4];
    player.spawn(car.mesh.position.x, car.mesh.position.z);
    player.enterCar(car, game);
    player.carSpeed = 20;
    car.mesh.rotation.y = Math.PI;
    car.mesh.position.set(90, 0, -20);
    missions.index = 1;
    missions.stage = 1;
    missions.active = true;
    missions.timer = 74;
    const h = city.places.hotel;
    missions.setObjective(h.x, h.z, 'Hotel Solmar');
    hud.setObjective('Deliver to Hotel Solmar — 74s!');
    hud.setTimer(74);
    step(120);
    camera.setPose(100, 7, 8, 64, 4, -70);
  } else {
    // Unknown scene: plain establishing shot.
    player.spawn(0, 30);
    step(90);
    camera.setPose(8, 6, 40, -6, 5, -60);
  }
  hud.update(0, game);
  window.__shotReady = true;
}
