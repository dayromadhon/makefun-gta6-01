// SOLMAR HEAT — random.js
// One job: a small seeded random number generator so the city, traffic and
// screenshot scenes are reproducible from a fixed seed.

export function createRng(seed) {
  let a = seed >>> 0;
  if (a === 0) a = 0x9e3779b9;
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

export function rangeInt(rng, min, max) {
  return Math.floor(range(rng, min, max + 1));
}

export function pick(rng, list) {
  return list[Math.floor(rng() * list.length)];
}

export function chance(rng, p) {
  return rng() < p;
}

// A street line from the grid, snapped so cars and spawns sit on roads.
export function streetLine(rng, lines) {
  return lines[Math.floor(rng() * lines.length)];
}

// A point on a random street (x along the street, z fixed to the line, or the reverse).
export function streetPoint(rng, lines, half) {
  const line = streetLine(rng, lines);
  const along = range(rng, -half, half);
  if (rng() < 0.5) return { x: along, z: line };
  return { x: line, z: along };
}
