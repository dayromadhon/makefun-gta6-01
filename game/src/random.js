// SOLMAR HEAT — seeded random (mulberry32). One seed drives the whole world
// so a fixed seed replays the same city, traffic and pedestrians.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class RNG {
  constructor(seed = 1337) {
    this.next = mulberry32(seed);
  }
  // Float in [0, 1).
  f() {
    return this.next();
  }
  // Float in [min, max).
  range(min, max) {
    return min + this.next() * (max - min);
  }
  // Integer in [min, max] inclusive.
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }
  // Pick one item from an array.
  pick(arr) {
    return arr[Math.floor(this.next() * arr.length)];
  }
  // True with probability p.
  chance(p) {
    return this.next() < p;
  }
}
