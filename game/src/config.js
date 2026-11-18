// SOLMAR HEAT — config.js
// One job: every tunable number, colour and story constant for the game.
// Nothing here touches the DOM, the renderer or the network.

export const CONFIG = {
  // World: a 5x5 street grid. Streets run at these x/z lines; blocks sit between them.
  streetLines: [-100, -50, 0, 50, 100],
  roadHalfWidth: 6,
  blockHalf: 19, // buildings stay inside blocks, never on a road
  cityHalf: 112, // playable bounds (beach/marina sit outside this)
  groundSize: 320,

  // Driving
  carTopSpeed: 42, // units per second (~150 km/h feel)
  carAccel: 26,
  carBrake: 40,
  carReverseSpeed: 14,
  carSteer: 1.9, // radians per second at full lock, scaled by speed
  carGrip: 6.5,
  handbrakeGrip: 1.6,
  carEnterRadius: 4.2,

  // On foot
  walkSpeed: 6,
  runSpeed: 10,
  playerRadius: 0.7,
  playerHealth: 100,

  // Combat
  pistolDamage: 34,
  pistolAmmo: 12,
  pistolReloadMs: 1400,
  punchDamage: 18,
  punchRange: 2.2,
  punchCooldownMs: 450,

  // Wanted
  maxStars: 5,
  heatPerCarTheft: 1,
  heatPerPedHit: 1,
  heatPerShot: 0.5,
  heatDecayPerSec: 0.05,
  bustRadius: 3.2,
  bustHoldSec: 2.5,
  copSpawnRadius: 55,
  maxCops: 8,

  // Traffic and pedestrians
  trafficCount: 14,
  trafficCountLow: 6,
  pedCount: 26,
  pedCountLow: 10,
  parkedCount: 10,

  // Money
  debtTotal: 4500,
  missionRewards: [400, 600, 800, 900, 2000],
  taxiFare: 120,
  packageSidePay: 150,

  // Camera
  camHeight: 7.5,
  camDistance: 11,
  camLookHeight: 2,

  // Colours (sun-soaked Solmar Bay palette)
  colors: {
    sky: 0x8ec9ee,
    fog: 0xa8d0e8,
    sun: 0xfff2d8,
    road: 0x2e3138,
    roadLine: 0xf5d76e,
    sidewalk: 0xb9b3a4,
    sand: 0xe8d29a,
    sea: 0x2f7fb8,
    grass: 0x6fae5e,
    building: [0xd8c9b0, 0xc9b8a3, 0xb7c4cc, 0xe0b48f, 0xa8b8c4, 0xd9a0a0],
    glass: 0x2a4a63,
    player: 0x2e86de,
    taxi: 0xf7c948,
    police: 0x1c2733,
    van: 0xe8e8e8,
  },

  // Story
  hero: 'Leo Marin',
  loanShark: 'Rocco Vane',
  dispatcher: 'Ada Kwan',
};

// Mission definitions: id, title, briefing, objective text, reward.
export const MISSIONS = [
  {
    id: 1,
    title: 'First Wheels',
    briefing: 'Ada needs wheels. Steal any car and bring it to her garage.',
    objective: 'Steal a car, then drive it to Ada\u2019s garage',
    reward: 400,
    kind: 'steal-to-garage',
  },
  {
    id: 2,
    title: 'Package Run',
    briefing: 'A package is waiting at the marina. Get it to Hotel Solmar before the clock runs out.',
    objective: 'Pick up the package at the marina, deliver to Hotel Solmar',
    reward: 600,
    kind: 'timed-delivery',
    timeLimit: 75,
  },
  {
    id: 3,
    title: 'Lose the Heat',
    briefing: 'Rocco\u2019s boys tipped off the cops. You are at 2 stars — shake them and reach the pier.',
    objective: 'Lose the 2-star wanted level, then reach the pier',
    reward: 800,
    kind: 'lose-heat',
  },
  {
    id: 4,
    title: 'Night Shift',
    briefing: 'Ada\u2019s taxi needs a driver. Run 3 fares around Solmar Bay.',
    objective: 'Complete 3 taxi fares',
    reward: 900,
    kind: 'taxi',
    fares: 3,
  },
  {
    id: 5,
    title: 'The Big Score',
    briefing: 'A courier van full of Rocco\u2019s cash is parked by the docks. Take it to the hideout.',
    objective: 'Steal the courier van, bring it to the hideout',
    reward: 2000,
    kind: 'van-heist',
  },
];

// Fixed landmarks, in world units (x, z). All sit on roads or plazas, never inside buildings.
export const LANDMARKS = {
  garage: { x: -100, z: -50, name: 'Ada\u2019s Garage' },
  hotel: { x: 50, z: -100, name: 'Hotel Solmar' },
  marina: { x: 108, z: 50, name: 'Marina' },
  pier: { x: -108, z: 75, name: 'The Pier' },
  hideout: { x: -75, z: 100, name: 'Hideout' },
  docks: { x: 100, z: -75, name: 'Docks' },
  plaza: { x: 0, z: 0, name: 'Solmar Plaza' },
  beach: { x: 0, z: 118, name: 'Solmar Beach' },
};

export const SAVE_KEY = 'solmar-heat-save-v1';
