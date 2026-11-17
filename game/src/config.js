// Solmar Heat — every tuning number in one place. The city is a 5x5 street grid on the
// X/Z plane (metres), a sand beach along the south edge and open water beyond it. Nothing
// here depends on the screen size; the renderer scales the canvas to the window.

export const STEP = 1 / 60;
export const SAVE_KEY = 'solmar-heat.save.v1';

export const CITY = {
  pitch: 84, // distance between neighbouring street centrelines
  streets: [-168, -84, 0, 84, 168], // street centrelines on each axis
  roadHalf: 7, // half the asphalt width
  blockHalf: 35, // half a block (building ground) between two streets
  extent: 210, // city edge on each axis
  beachZ: 224, // sand starts here (south edge, +Z)
  waterZ: 258, // water plane starts here
  marinaX: 224, // docks start here (east edge, +X)
};

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10,
  accel: 42,
  jumpSpeed: 7.5,
  radius: 0.55,
  height: 1.8,
  maxHealth: 100,
  punchDamage: 12,
  punchRange: 1.9,
  punchCooldown: 0.45,
  pistolDamage: 34,
  pistolRange: 60,
  pistolCooldown: 0.28,
  pistolMag: 12,
  reloadTime: 1.1,
};

export const CAR = {
  accel: 26,
  reverseAccel: 16,
  brake: 42,
  maxSpeed: 42,
  maxReverse: 12,
  steer: 1.9, // radians per second at full lock, scaled down with speed
  grip: 8,
  handbrakeGrip: 2.2,
  length: 4.4,
  width: 2.0,
  maxHealth: 100,
};

export const TRAFFIC = {
  count: 12,
  cruise: 11,
  minGap: 7,
};

export const PEDS = {
  count: 26,
  walkSpeed: 1.6,
  runSpeed: 5.2,
  fleeRadius: 14,
};

export const WANTED = {
  maxStars: 5,
  // police cars per star level (index = stars)
  policeCars: [0, 1, 2, 3, 4, 5],
  // seconds out of every police line of sight before one star drops
  decaySeconds: [0, 14, 18, 24, 30, 38],
  copSight: 70,
  spawnRadius: 55,
};

export const CAMERA = {
  footDistance: 9,
  footHeight: 4.2,
  carDistance: 11,
  carHeight: 4.6,
  smoothing: 7,
  minPitch: 0.12,
  maxPitch: 0.9,
};

export const PALETTE = {
  skyTop: 0x2f6fb4,
  skyHorizon: 0xffd9a0,
  sun: 0xffe3b3,
  fog: 0xf2c98f,
  asphalt: 0x33363d,
  sidewalk: 0x9a938a,
  sand: 0xe8cf9e,
  water: 0x2e7f9e,
  grass: 0x7fae62,
  buildingA: 0xe8b48a,
  buildingB: 0xd97b6c,
  buildingC: 0x7fb3d5,
  buildingD: 0xf2e3c6,
  buildingE: 0x9db38a,
  glass: 0x3d6f8e,
  palmTrunk: 0x8a6a4a,
  palmLeaf: 0x3f8f4f,
  lamp: 0x2b2f36,
  hudPanel: 'rgba(12, 16, 24, 0.72)',
  hudText: '#f4f1e8',
  hudAccent: '#ffb347',
  star: '#ffd23f',
  wantedRed: '#ff4d4d',
  mission: '#4fc3f7',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
