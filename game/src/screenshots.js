// SOLMAR HEAT — screenshot scenes. ?shot=N in the URL drives the real game
// forward from the fixed seed into a composed scene, then sets
// window.__shotReady so the capture script knows the frame is ready.
// 1 = cover (Leo on foot downtown), 2 = street (driving fast),
// 3 = chase (2 wanted stars, police on the tail), 4 = mission (Package Run).

export function getShotParam() {
  const m = /[?&]shot=(\d)/.exec(window.location.search);
  return m ? parseInt(m[1], 10) : 0;
}

export function applyShot(game, n) {
  const { player, missions, wanted, traffic, city } = game;
  if (n === 1) {
    // Cover: Leo on foot downtown, mission 1 card up.
    player.reset({ x: -30, z: 10 });
    player.heading = Math.PI / 2;
    missions.index = 0;
    missions.state = 'active';
    missions.phase = 'steal';
    missions._clearObjective();
    wanted.clear();
  } else if (n === 2) {
    // Street: Leo driving fast down an avenue.
    const car = traffic.cars.find((c) => c.parked) || traffic.spawnParked(1)[0];
    player.reset({ x: -120, z: -30 });
    player.enterCar(car);
    car.x = -120;
    car.z = -30;
    car.heading = 0;
    car.speed = 30;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = -car.heading;
    missions.index = 0;
    missions.state = 'active';
    missions.phase = 'deliver';
    const g = city.places.garage;
    missions._setObjective(g.x, g.z, 6, 'Drive to Ada\u2019s garage');
    wanted.clear();
  } else if (n === 3) {
    // Chase: 2 wanted stars, police closing in on a speeding Leo.
    const car = traffic.cars.find((c) => c.parked) || traffic.spawnParked(1)[0];
    player.reset({ x: 60, z: 30 });
    player.enterCar(car);
    car.x = 60;
    car.z = 30;
    car.heading = Math.PI;
    car.speed = 32;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = -car.heading;
    wanted.setLevel(2);
    wanted.placeNear(player.pos);
    missions.index = 2;
    missions.state = 'active';
    missions.phase = 'escape';
    missions._clearObjective();
  } else if (n === 4) {
    // Mission: Package Run in progress, timer running, Hotel Solmar ahead.
    // The car sits on the vertical road x=30 heading south, so the camera
    // behind it stays on the road too (never inside a building).
    const car = traffic.cars.find((c) => c.parked) || traffic.spawnParked(1)[0];
    player.reset({ x: 30, z: -30 });
    player.enterCar(car);
    car.x = 30;
    car.z = -30;
    car.heading = Math.PI / 2;
    car.speed = 24;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = -car.heading;
    missions.index = 1;
    missions.state = 'active';
    missions.phase = 'deliver';
    missions.packageHeld = true;
    missions.timer = 80;
    const h = city.places.hotel;
    missions._setObjective(h.x, h.z, 6, 'Deliver to Hotel Solmar');
    wanted.clear();
  }
  game.shotMode = n;
  game.shotFrames = 0;
}

// Advance a shot scene: let traffic, peds and the camera settle, keep the
// player's car rolling, then mark the frame ready. Returns true when ready.
export function stepShot(game, dt) {
  game.shotFrames += 1;
  const { player, traffic, pedestrians, wanted, missions } = game;
  // Keep the player's car rolling at a steady speed for the driving shots,
  // and move it (Car.update with no input moves by speed and places the
  // mesh — without this the car would sit at the origin, invisible).
  if (player.inCar && (game.shotMode === 2 || game.shotMode === 3 || game.shotMode === 4)) {
    const car = player.car;
    const target = game.shotMode === 3 ? 32 : game.shotMode === 2 ? 30 : 24;
    car.speed += (target - car.speed) * Math.min(1, dt * 2);
    car.update(dt, null, game.city);
  }
  traffic.update(dt);
  pedestrians.update(dt, player.pos, player.speed);
  if (game.shotMode === 3) wanted.update(dt, player, () => {});
  // Camera + HUD update happens in the main loop. Ready after ~90 frames
  // (enough for the camera to settle and traffic to move).
  if (game.shotFrames >= 90) {
    window.__shotReady = true;
    return true;
  }
  return false;
}
