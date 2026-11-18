// SOLMAR HEAT — configuration: one place for every number the game tunes.
// Sun-soaked coastal city of Solmar Bay. All units are metres, all times seconds.

export const WORLD = {
  // 5x5 street grid: streets at these x/z coordinates, blocks between them.
  streets: [-104, -52, 0, 52, 104],
  block: 40, // block size (edge to edge)
  roadWidth: 12,
  half: 130, // city spans -130..130 on x and z
  // Beach on the east edge, marina on the south edge.
  beachX: 130, // sand starts here
  waterX: 158, // sea starts here
  marinaZ: 130, // docks start here
  waterZ: 158, // harbour water starts here
};

export const COLORS = {
  sky: 0x87b5d6,
  fog: 0x9fc3dd,
  sun: 0xfff2d0,
  asphalt: 0x2e3238,
  asphaltLine: 0xd8d8c8,
  sidewalk: 0x9a938a,
  grass: 0x4d8a4a,
  sand: 0xe0c98f,
  water: 0x2f7fb8,
  building: [0xb8a88f, 0x8f9bb0, 0xc0b0a0, 0x7f8a9a, 0xa89a80, 0x9a8a70],
  glass: 0x6fa8c8,
  palm: 0x2f7a3a,
  trunk: 0x7a5a38,
};

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 10,
  radius: 0.6,
  health: 100,
  pistolAmmo: 12,
  pistolRange: 40,
  pistolDamage: 34,
  punchRange: 2.2,
  punchDamage: 20,
  punchCooldown: 0.45,
  shootCooldown: 0.28,
  reloadTime: 1.4,
};

export const CAR = {
  accel: 22, // m/s^2
  brake: 34,
  reverseAccel: 12,
  maxSpeed: 38, // ~137 km/h
  maxReverse: 10,
  steer: 0.55, // rad/s at full lock, scaled by speed
  grip: 6.5, // lateral damping
  handbrakeGrip: 1.6,
  radius: 2.1,
  // Traffic cars drive slower and never drift.
  trafficSpeed: 9,
  policeSpeed: 42,
};

export const WANTED = {
  maxStars: 5,
  decayPerSec: 0.05, // heat lost while laying low
  stealHeat: 1.0,
  hitPedHeat: 0.6,
  shootHeat: 0.4,
  killHeat: 1.2,
  bustDistance: 3.2, // police within this and slow = busted
  bustTime: 3.0,
  // How many police cars per star level.
  policePerStar: [0, 1, 2, 2, 3, 4],
};

export const DEBT = 4500;

export const MISSIONS = [
  {
    id: 'wheels',
    name: 'First Wheels',
    brief: 'Steal a car and bring it to Ada\u2019s garage.',
    reward: 400,
    target: { x: -52, z: -104, label: 'Ada\u2019s Garage' },
    needsCar: true,
  },
  {
    id: 'package',
    name: 'Package Run',
    brief: 'Pick up the package at the marina, then reach Hotel Solmar before the clock runs out.',
    reward: 600,
    pickup: { x: 52, z: 130, label: 'Marina Pickup' },
    target: { x: 104, z: -52, label: 'Hotel Solmar' },
    timeLimit: 100,
  },
  {
    id: 'heat',
    name: 'Lose the Heat',
    brief: 'The cops are on you. Lose the 2-star wanted level and reach the pier.',
    reward: 800,
    target: { x: 130, z: 52, label: 'Pier' },
    setWanted: 2,
  },
  {
    id: 'taxi',
    name: 'Night Shift',
    brief: 'Three taxi fares across the city. Drive a taxi to each pickup, then to the drop-off.',
    reward: 900,
    fares: 3,
  },
  {
    id: 'score',
    name: 'The Big Score',
    brief: 'Steal the courier van and bring it to the hideout. This pays the debt.',
    reward: 2000,
    target: { x: -104, z: 104, label: 'Hideout' },
    needsVan: true,
  },
];

export const SAVE_KEY = 'solmar-heat-save-v1';

export const SHOT_SEED = 7;
