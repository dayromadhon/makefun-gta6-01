// Solmar Heat — deterministic random numbers.
// One job: a small seeded generator so screenshots and play-tests replay.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function range(rng, min, max) {
  return min + rng() * (max - min);
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function chance(rng, p) {
  return rng() < p;
}

// A stable per-index seed, so the same street corner always gets the same
// parked car, palm or pedestrian across runs with the same world seed.
export function seedFor(worldSeed, salt, index) {
  let h = worldSeed >>> 0;
  h = Math.imul(h ^ salt, 2654435761);
  h = Math.imul(h ^ index, 40503);
  return (h ^ (h >>> 13)) >>> 0;
}
