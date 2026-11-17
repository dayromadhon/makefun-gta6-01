// Solmar Heat — staged screenshot scenes. One job: given ?shot=<name>,
// put the real game into a photogenic state (city, car, chase, mission)
// and say when the frame is ready to capture.
import { PLACES } from './config.js';

export class Shots {
  constructor(game) {
    this.game = game; // { player, vehicles, peds, wanted, missions, camera, city }
    this.name = null;
    this.frames = 0;
    this.ready = false;
  }

  // Stage one of the four scenes. Called once after the world is built.
  apply(name) {
    const g = this.game;
    this.name = name;
    g.wanted.shotMode = true;
    const P = g.player;
    const V = g.vehicles;
    // Start from a clean slate: no cruisers, Leo on foot at the scene.
    for (const cop of [...V.police]) V.removePolice(cop);
    g.missions.beacon.visible = false;
    if (name === 'cover') {
      // Downtown intersection, Leo in a sedan, two cruisers alongside, 2 stars.
      const car = V.parked.find((c) => c.missionSedan) || V.parked[0];
      if (car) {
        V.steal(car);
        P.inCar = true;
        P.car = car;
        car.x = 0;
        car.z = -6;
        car.heading = 0;
        car.speed = 6;
        P.syncToCar();
      }
      g.wanted.setStars(2, 'shot');
      const c1 = V.spawnPolice(-5, 2);
      c1.heading = 0;
      const c2 = V.spawnPolice(5, -14);
      c2.heading = 0.3;
      g.camera.yaw = Math.PI + 0.25;
      g.camera.dist = 10;
    } else if (name === 'street') {
      // On foot mid-crosswalk, palms and towers behind, calm morning.
      P.inCar = false;
      P.car = null;
      P.x = 2;
      P.z = 40;
      P.yaw = Math.PI;
      P.updateMesh();
      g.wanted.setStars(0, 'shot');
      g.camera.yaw = Math.PI;
      g.camera.dist = 7;
    } else if (name === 'chase') {
      // Full chase: Leo drifting east, an interceptor on his flank, 4 stars.
      const car = V.parked.find((c) => c.missionSedan) || V.parked[0];
      if (car) {
        V.steal(car);
        P.inCar = true;
        P.car = car;
        car.x = -30;
        car.z = 0;
        car.heading = Math.PI / 2;
        car.speed = 26;
        P.syncToCar();
      }
      g.wanted.setStars(4, 'shot');
      const c1 = V.spawnPolice(-24, 4);
      c1.heading = Math.PI / 2;
      c1.speed = 26;
      const c2 = V.spawnPolice(-36, -3);
      c2.heading = Math.PI / 2;
      c2.speed = 24;
      const c3 = V.spawnPolice(8, -4);
      c3.heading = -Math.PI / 2;
      c3.speed = 20;
      g.camera.yaw = -Math.PI / 2 + 0.2;
      g.camera.dist = 11;
    } else if (name === 'mission') {
      // Package Run: Leo in a car driving EAST toward the marina pickup,
      // the yellow beacon ahead over the docks, boats and water in frame.
      const car = V.parked.find((c) => c.missionSedan) || V.parked[0];
      if (car) {
        V.steal(car);
        P.inCar = true;
        P.car = car;
        car.x = 58;
        car.z = 40;
        car.heading = Math.PI / 2;
        car.speed = 12;
        P.syncToCar();
      }
      g.wanted.setStars(0, 'shot');
      g.missions.beacon.visible = true;
      g.missions.beacon.position.set(PLACES.marinaPickup.x, 0, PLACES.marinaPickup.z);
      g.camera.yaw = -Math.PI / 2 + 0.15;
      g.camera.dist = 10;
    }
    this.frames = 0;
    this.ready = false;
  }

  // Called every frame while a shot is staged; the frame is ready once
  // the scene has settled for a second.
  tick() {
    if (!this.name || this.ready) return false;
    this.frames += 1;
    if (this.frames > 25) {
      this.ready = true;
      window.__shotReady = true;
      return true;
    }
    return false;
  }
}
