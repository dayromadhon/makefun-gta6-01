// SOLMAR HEAT — screenshots: the four staged scenes the maker captures.
// Each scene plays the real game forward from the fixed seed — a car on the
// avenue, a street on foot, a police chase, a mission in progress — then
// sets window.__shotReady so the capture script knows the frame is final.
// This file is written by hand in the recorded session; no script generates it.
import { PLACES } from './config.js';

export function shotName(n) {
  return ['', 'cover', 'street', 'chase', 'mission'][n] || 'cover';
}

// ctx: { player, vehicles, peds, missions, wanted, camera, city, state }
export function applyShot(n, ctx) {
  const { player, vehicles, peds, missions, wanted, camera, city } = ctx;
  const avenueX = city.roadCenter(2);
  const avenueZ = city.roadCenter(2);

  if (n === 1) {
    // COVER: Leo's car cruising the downtown avenue, towers all around,
    // traffic ahead, sun low over the bay. Fixed cinematic camera.
    const car = vehicles.spawnCar(avenueX, 20, 0, 0xc23b2e, {});
    player.enterCar(car);
    player.speed = 0;
    car.speed = 8;
    const t1 = vehicles.spawnCar(avenueX, -8, 0, 0x2e6fc2, { traffic: true });
    t1.speed = 9;
    t1.route = [{ x: avenueX, z: -80 }, { x: avenueX, z: 80 }];
    const t2 = vehicles.spawnCar(avenueX + 12, 40, Math.PI, 0xe8c832, { traffic: true });
    t2.speed = 9;
    t2.route = [{ x: avenueX + 12, z: 80 }, { x: avenueX + 12, z: -80 }];
    missions.index = 0;
    missions.step = 1;
    missions.active = true;
    missions.marker = { x: PLACES.garage.x, z: PLACES.garage.z, label: 'Ada\u2019s Garage' };
    // Straight down the avenue from its centreline, high enough to clear
    // the towers: the road, the traffic and the red car all in frame.
    ctx.shotFixedCam = { x: avenueX, y: 13, z: 58, lx: avenueX, ly: 2, lz: -40 };
    camera.setFixed(avenueX, 13, 58, avenueX, 2, -40);
  } else if (n === 2) {
    // STREET: Leo on foot in the middle of the avenue, facing the beach,
    // pedestrians and parked cars around, traffic rolling past.
    player.reset(avenueX, avenueZ + 10);
    player.heading = 0;
    vehicles.spawnParked(4);
    const t = vehicles.spawnCar(avenueX + 12, avenueZ - 30, Math.PI, 0x2e6fc2, { traffic: true });
    t.speed = 9;
    t.route = [{ x: avenueX + 12, z: -80 }, { x: avenueX + 12, z: 80 }];
    // Pull three pedestrians onto the sidewalk beside Leo.
    for (let i = 0; i < Math.min(3, peds.peds.length); i++) {
      const p = peds.peds[i];
      p.x = avenueX + 8 + i * 3;
      p.z = avenueZ + 14 + i * 4;
      p.state = 'walk';
      p.target = { x: avenueX + 8 + i * 3, z: avenueZ + 40 };
    }
    ctx.shotFixedCam = null;
  } else if (n === 3) {
    // CHASE: 2 stars, two police cars right on Leo's bumper, sirens up.
    const car = vehicles.spawnCar(avenueX, 30, 0, 0x3aa84f, {});
    player.enterCar(car);
    car.speed = 18;
    wanted.setStars(2);
    // The objective line should read as a chase, not a car theft.
    missions.index = 2;
    missions.step = 0;
    missions.active = true;
    missions.marker = { x: PLACES.pier.x, z: PLACES.pier.z, label: 'Pier' };
    const c1 = vehicles.spawnPolice(avenueX - 1, 44);
    const c2 = vehicles.spawnPolice(avenueX + 2, 52);
    c1.speed = 20;
    c2.speed = 20;
    const t = vehicles.spawnCar(avenueX - 12, -10, 0, 0xe8e8e8, { traffic: true });
    t.speed = 9;
    t.route = [{ x: avenueX - 12, z: -80 }, { x: avenueX - 12, z: 80 }];
    ctx.shotFixedCam = null;
  } else {
    // MISSION: Package Run in progress — Leo driving to Hotel Solmar
    // with the marker and the timer on the HUD.
    const car = vehicles.spawnCar(6, 60, Math.PI, 0xc23b2e, {});
    player.enterCar(car);
    car.speed = 12;
    missions.index = 1;
    missions.step = 1;
    missions.active = true;
    missions.timer = 62;
    missions.marker = { x: PLACES.hotel.x, z: PLACES.hotel.z, label: 'Hotel Solmar' };
    const t = vehicles.spawnCar(avenueX + 12, 10, Math.PI, 0x2e6fc2, { traffic: true });
    t.speed = 9;
    t.route = [{ x: avenueX + 12, z: 80 }, { x: avenueX + 12, z: -80 }];
    ctx.shotFixedCam = null;
  }
  // Let the world settle a moment, then tell the capture script the frame is final.
  ctx.shotSettleUntil = performance.now() + 1500;
  ctx.shotReady = false;
}
