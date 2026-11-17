// Solmar Heat — screenshot scenes.
// One job: when the page opens with ?shot=<name>, stage the real game into
// a photogenic state (a chase, a street walk, a mission run) and tell the
// screenshot tool when the frame is ready. Nothing here fakes a render:
// every scene is the live game, positioned and given a wanted level.

import { PLACES } from './config.js';

export function applyShot(G, name) {
  const { player, vehicles, peds, wanted, missions, hud } = G;
  // photo mode: the live game still simulates, but a staged scene must
  // never end in a fail state (busted / taken down) mid-shoot
  G.shotMode = true;
  const putInCar = (x, z, heading, speed) => {
    const car = vehicles.parked.find((c) => !c.missionId) || vehicles.parked[0];
    if (!car) return null;
    vehicles.setPlayerCar(car);
    car.x = x;
    car.z = z;
    car.heading = heading;
    car.speed = speed;
    player.x = x;
    player.z = z;
    player.heading = heading;
    player.yaw = heading;
    // actually sit Leo in the car (enterCar's state, without its sound:
    // shots stage before the audio context exists)
    player.inCar = true;
    player.car = car;
    player.mesh.visible = false;
    return car;
  };

  if (name === 'cover') {
    // Leo in a car at the downtown crosswalk, two stars, a police car
    // pulling alongside, HUD and minimap live.
    putInCar(0, -14, 0, 0);
    const cop = vehicles.spawnPolice(5, -10);
    if (cop) {
      cop.heading = 0;
      cop.speed = 2;
    }
    wanted.stars = 2;
    missions.index = 0;
    missions.startNext(G);
    hud.toast('First Wheels — steal the marked sedan');
  } else if (name === 'street') {
    // Leo on foot in the middle of the crosswalk, pedestrians passing,
    // towers behind. (Palms stand at (±6, 40) — keep clear of them.)
    player.x = 0;
    player.z = 40;
    player.heading = Math.PI;
    player.yaw = Math.PI;
    wanted.stars = 0;
    missions.index = 0;
    missions.startNext(G);
  } else if (name === 'chase') {
    // Mid-ram: a police interceptor on Leo's flank, four stars.
    const car = putInCar(-6, 0, Math.PI / 2, 16);
    const cop = vehicles.spawnPolice(-12, 1.5);
    if (cop) {
      cop.heading = Math.PI / 2;
      cop.speed = 20;
    }
    const cop2 = vehicles.spawnPolice(4, -8);
    if (cop2) {
      cop2.heading = Math.PI / 2;
      cop2.speed = 18;
    }
    wanted.stars = 4;
    missions.index = 0;
    missions.startNext(G);
    hud.toast('Wanted level 4 — the whole city is after you!');
    void car;
  } else if (name === 'mission') {
    // Package Run: driving east to the marina, beacon and objective bar live.
    putInCar(76, 20, Math.PI / 2, 15);
    missions.index = 1;
    missions.startNext(G);
    // stay on the pickup leg so the beacon sits on the marina dock ahead
    wanted.stars = 0;
    hud.toast('Package Run — pick up the package at the Marina Dock');
  }
  void PLACES;
  // how many rendered frames before the screenshot tool may shoot
  return 100;
}
