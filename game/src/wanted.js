// Solmar Heat — the wanted level.
// One job: stars go up when crimes happen, police come, stars fade when
// the player lays low, and getting caught ends the run.

import { WORLD, TUNE } from './config.js';
import { mulberry32, pick } from './random.js';

export function createWanted(seed) {
  const rng = mulberry32(seed);
  const wanted = {
    stars: 0,
    quietTimer: 0,
    carStopTimer: 0,
    heat: 0, // 0..1, how "hot" the chase feels (drives siren + music)
  };

  function crime(kind, x, z, ctx) {
    // some crimes only count if someone could have seen them
    const witnessed = true; // streets are busy; a loud crime is always seen
    if (!witnessed) return;
    const add = { 'hit-ped': 1, assault: 1, shooting: 2, 'shoot-cop': 2, 'hit-cop': 2, steal: 1, ram: 1 }[kind] || 1;
    const before = wanted.stars;
    wanted.stars = Math.min(5, wanted.stars + add);
    wanted.quietTimer = 0;
    if (wanted.stars > before && ctx.hud) {
      ctx.hud.toast(wanted.stars >= 3 ? 'The whole city is after you!' : 'The police are coming!');
    }
    if (ctx.peds) ctx.peds.fleeAll(x, z);
  }

  function edgeSpawnPoint(px, pz) {
    // an intersection near the map edge, on the far side from the player
    const edges = [];
    for (const s of WORLD.streets) {
      edges.push({ x: -80, z: s }, { x: 80, z: s }, { x: s, z: -80 }, { x: s, z: 80 });
    }
    edges.sort((a, b) => {
      const da = Math.hypot(a.x - px, a.z - pz);
      const db = Math.hypot(b.x - px, b.z - pz);
      return db - da; // farthest first
    });
    return pick(rng, edges.slice(0, 6));
  }

  function update(dt, ctx) {
    const player = ctx.player;
    // how many police cars and foot cops the stars call for
    const wantCars = wanted.stars === 0 ? 0 : Math.min(1 + Math.floor(wanted.stars / 2), 5);
    const wantCops = wanted.stars >= 2 && !player.inCar ? Math.min(wanted.stars - 1, 4) : 0;
    // dispatch / recall police cars
    let activeCars = 0;
    for (const car of ctx.vehicles.police) if (car.active) activeCars++;
    if (activeCars < wantCars) {
      const p = edgeSpawnPoint(player.x, player.z);
      ctx.vehicles.spawnPolice(p.x, p.z);
    } else if (activeCars > wantCars) {
      const car = ctx.vehicles.police.find((c) => c.active);
      if (car) ctx.vehicles.releasePolice(car);
    }
    // dispatch / recall foot cops
    let activeCops = 0;
    for (const cop of ctx.peds.cops) if (cop.active) activeCops++;
    if (activeCops < wantCops) {
      const p = edgeSpawnPoint(player.x, player.z);
      ctx.peds.spawnCop(p.x, p.z);
    } else if (activeCops > wantCops) {
      const cop = ctx.peds.cops.find((c) => c.active);
      if (cop) ctx.peds.releaseCop(cop);
    }
    // busted in a car: stopped dead with a cop car right beside you
    // (not in photo mode: a staged scene never ends the run)
    if (player.inCar && player.car && !player.car.wrecked && !ctx.shotMode) {
      let copNear = false;
      for (const car of ctx.vehicles.police) {
        if (car.active && Math.hypot(car.x - player.car.x, car.z - player.car.z) < 7) copNear = true;
      }
      if (copNear && Math.abs(player.car.speed) < 1) {
        wanted.carStopTimer += dt;
        if (wanted.carStopTimer > TUNE.bustCarSeconds && ctx.onBusted) ctx.onBusted();
      } else {
        wanted.carStopTimer = 0;
      }
    } else {
      wanted.carStopTimer = 0;
    }
    // decay: quiet + no cop close = one star fades
    let copClose = false;
    for (const car of ctx.vehicles.police) {
      if (car.active && Math.hypot(car.x - player.x, car.z - player.z) < 25) copClose = true;
    }
    for (const cop of ctx.peds.cops) {
      if (cop.active && Math.hypot(cop.x - player.x, cop.z - player.z) < 25) copClose = true;
    }
    if (wanted.stars > 0 && !copClose) {
      wanted.quietTimer += dt;
      if (wanted.quietTimer > TUNE.wantedDecaySeconds) {
        wanted.quietTimer = 0;
        wanted.stars -= 1;
        if (ctx.hud) ctx.hud.toast('The heat is dying down…');
      }
    } else {
      wanted.quietTimer = 0;
    }
    wanted.heat = Math.min(1, wanted.stars / 3 + (copClose ? 0.3 : 0));
  }

  function clear() {
    wanted.stars = 0;
    wanted.quietTimer = 0;
    wanted.carStopTimer = 0;
    wanted.heat = 0;
  }

  wanted.crime = crime;
  wanted.update = update;
  wanted.clear = clear;
  return wanted;
}
