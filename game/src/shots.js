// The screenshot scenes behind ?shot=cover|street|chase|mission. Each one plays the real
// game forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot, so the frame is what a short stretch of real play looks like and the same
// seed always gives the same frame. The HUD stays on: the screenshots must show it.

import { STEP } from './config.js';

const SCENES = {
  cover: { seconds: 4, wanted: 2, police: 2 },
  street: { seconds: 4, wanted: 0, police: 0 },
  chase: { seconds: 5, wanted: 4, police: 3 },
  mission: { seconds: 4, wanted: 1, police: 1 },
};

function fakeDriveInput(steer) {
  return {
    axes() {
      return { forward: 1, strafe: steer };
    },
    handbrake() {
      return false;
    },
    takeActions() {
      return 0;
    },
    takeLook() {
      return { dx: 0, dy: 0, wheel: 0 };
    },
  };
}

function fakeFootInput() {
  return {
    axes() {
      return { forward: 0, strafe: 0 };
    },
    running() {
      return false;
    },
    handbrake() {
      return false;
    },
    takeActions() {
      return 0;
    },
    takeLook() {
      return { dx: 0, dy: 0, wheel: 0 };
    },
  };
}

// Steer the player's car to stay in the right-hand lane of the avenue (x = street),
// heading south (+Z).
function laneSteer(car, street) {
  const err = car.x - (street - 3.5);
  const headingErr = Math.sin(car.heading);
  return Math.max(-1, Math.min(1, -err * 0.06 - headingErr * 0.8));
}

export function stageShot(name, world) {
  const scene = SCENES[name] || SCENES.cover;
  world.resetShot();
  const { player, vehicles, peds, wanted, missions, city } = world;

  if (name === 'street') {
    // Leo on the sidewalk beside the avenue, looking south down the street: the
    // crosswalk stripes right under a low camera stretch ugly, the sidewalk does not.
    player.x = 12;
    player.z = -30;
    player.heading = 0;
    player.syncMesh();
    world.camera.snap({ x: player.x, y: 0, z: player.z }, player.heading);
  } else if (name === 'mission') {
    missions.startMission(1, world.events);
    const car = vehicles.spawnParkedCar(84, -120, 0);
    player.enterCar(car, world.events);
    car.speed = 18;
    wanted.addStars(1, world.events);
    world.spawnPolice(1);
  } else {
    const street = name === 'chase' ? -84 : 0;
    const startZ = name === 'chase' ? -60 : -90;
    const car = vehicles.spawnParkedCar(street, startZ, 0);
    player.enterCar(car, world.events);
    car.speed = name === 'chase' ? 26 : 22;
    wanted.addStars(scene.wanted, world.events);
    world.spawnPolice(scene.police);
    // A couple of traffic cars ahead on the same avenue.
    for (let i = 0; i < 3; i += 1) {
      const t = vehicles.spawnTrafficCar();
      t.x = street + (i % 2 === 0 ? -3.5 : 3.5);
      t.z = startZ + 60 + i * 26;
      t.heading = 0;
    }
  }

  const steps = Math.floor(scene.seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    if (player.car) {
      const street = name === 'chase' ? -84 : name === 'mission' ? 84 : 0;
      vehicles.drivePlayer(player.car, fakeDriveInput(laneSteer(player.car, street)), STEP, city);
      // drivePlayer moves only the car — keep the player on top of it, exactly like
      // player.update does in real play, so the camera, police and missions track it.
      player.x = player.car.x;
      player.z = player.car.z;
      player.heading = player.car.heading;
      if (player.car.health <= 0) break;
    } else {
      player.update(STEP, fakeFootInput(), world, world.events);
    }
    vehicles.update(STEP, player, city, world.events);
    peds.update(STEP, player, city);
    world.updatePolice(STEP);
    world.camera.update(STEP, { x: player.x, y: 0, z: player.z }, player.car ? player.car.heading : player.heading, !!player.car);
    world.effects.update(STEP);
  }
  if (name === 'chase' && player.car) {
    // The chase camera sits behind Leo's car, so a pursuit from dead behind is
    // invisible — pull the nearest police car up alongside him, mid-ram.
    let nearest = null;
    let nearestDist = Infinity;
    for (const car of vehicles.cars) {
      if (car.driver !== 'police') continue;
      const d = Math.hypot(car.x - player.x, car.z - player.z);
      if (d < nearestDist) {
        nearestDist = d;
        nearest = car;
      }
    }
    if (nearest) {
      nearest.x = player.car.x + 5.5;
      nearest.z = player.car.z + 3;
      nearest.heading = player.car.heading;
      nearest.speed = player.car.speed;
      vehicles.syncMesh(nearest);
    }
  }
  // Snap the camera to the final frame: the smoothed chase cam lags a fast car by
  // metres, which shrinks it in a still. In real play the lag is the speed feel.
  if (player.car) {
    world.camera.snap({ x: player.x, y: 0, z: player.z }, player.car.heading);
  }
  return { screen: 'play', best: 0 };
}
