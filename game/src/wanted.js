// The wanted level: stars rise when Leo commits crimes in sight of the law, police cars
// and foot cops spawn to match, and the heat cools off when nobody can see him for a
// while. Busted means a cop got him; the caller decides what that costs.

import { WANTED } from './config.js';

export function createWanted() {
  let stars = 0;
  let hiddenTimer = 0;
  let flashTimer = 0;

  function addStars(n, events) {
    const before = stars;
    stars = Math.max(0, Math.min(WANTED.maxStars, stars + n));
    if (stars > before) {
      flashTimer = 1.2;
      if (events && events.onWantedUp) events.onWantedUp(stars);
    }
    return stars;
  }

  function clear(events) {
    stars = 0;
    hiddenTimer = 0;
    if (events && events.onWantedClear) events.onWantedClear();
  }

  // dt seconds pass; police is the list of active police cars and foot cops, player the
  // player object. Returns nothing; the caller reads stars.
  function update(dt, player, policeCars, footCops, events) {
    if (stars === 0) return;
    if (flashTimer > 0) flashTimer -= dt;
    let seen = false;
    for (const car of policeCars) {
      const dist = Math.hypot(car.x - player.x, car.z - player.z);
      if (dist < WANTED.copSight) {
        seen = true;
        break;
      }
    }
    if (!seen) {
      for (const cop of footCops) {
        const dist = Math.hypot(cop.x - player.x, cop.z - player.z);
        if (dist < 40) {
          seen = true;
          break;
        }
      }
    }
    if (seen) hiddenTimer = 0;
    else {
      hiddenTimer += dt;
      if (hiddenTimer >= WANTED.decaySeconds[stars]) {
        hiddenTimer = 0;
        stars -= 1;
        if (events && events.onWantedDown) events.onWantedDown(stars);
        if (stars === 0 && events && events.onWantedClear) events.onWantedClear();
      }
    }
  }

  return {
    get stars() {
      return stars;
    },
    get flash() {
      return flashTimer > 0;
    },
    policeCount() {
      return WANTED.policeCars[stars];
    },
    addStars,
    clear,
    update,
  };
}
