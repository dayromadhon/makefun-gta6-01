// Solmar Heat — world constants, tuning and story data.
// One job: every number the rest of the game agrees on lives here.

export const WORLD = {
  half: 100, // city spans -100..100 on x and z
  streets: [-80, -40, 0, 40, 80], // avenue/street centre lines
  roadWidth: 10,
  block: 30, // block edge length between roads
  beachZ: -100, // sand starts south of this line
  seaZ: -132, // water starts here
  marinaX: 104, // docks start east of this line
  seaLevel: -0.4,
};

export const COLORS = {
  sky: 0x8ec9e8,
  fog: 0xa8d4ea,
  sun: 0xfff2d0,
  ground: 0x9db98a, // dry grass between blocks
  asphalt: 0x3a3f46,
  roadLine: 0xd8d3a0,
  sidewalk: 0xb9b3a4,
  sand: 0xe6d29a,
  sea: 0x2e7fa8,
  dock: 0x8a6f4d,
  buildingGlass: 0x9fc4d8,
  buildingRoof: 0x6b6f78,
  // warm stucco palette for the low city, glassy blue-grey for downtown
  lowCity: [0xe8c39a, 0xd9a06f, 0xc98d64, 0xe0b184, 0xb98a6a, 0xd4c08a],
  downtown: [0x7f9db5, 0x6d8fa8, 0x93aec2, 0x5f7f9c, 0x87a5bd],
  carPaint: [0xc23b2e, 0x2e6fc2, 0xe0a92e, 0x3fae6a, 0xe8e4da, 0x22242a, 0x7a4fb5, 0xd97b2e],
  taxiYellow: 0xf2c200,
  policeWhite: 0xf2f2f2,
  policeBlue: 0x1d4fd7,
};

export const TUNE = {
  walkSpeed: 6,
  runSpeed: 10,
  carAccel: 14,
  carReverseAccel: 9,
  carMaxSpeed: 34,
  carMaxReverse: 10,
  carBrake: 26,
  steerMax: 0.55, // radians of front-wheel angle at standstill
  steerSpeedFalloff: 0.012, // less steering the faster you go
  handbrakeGrip: 0.35, // lateral grip multiplier while drifting
  trafficSpeed: 9,
  trafficCount: 12,
  trafficCountLow: 7,
  pedCount: 14,
  pedCountLow: 7,
  pedSpeed: 2.2,
  policeCarSpeed: 26,
  policeFootSpeed: 5.4,
  bustHoldSeconds: 1.6, // foot cop touching you this long busts you
  bustCarSeconds: 3.0, // stopped with a cop car beside you this long busts you
  wantedDecaySeconds: 25, // quiet time before one star fades
  playerHealth: 100,
  pistolMag: 12,
  pistolDamage: 34,
  fistDamage: 18,
  fistRange: 2.6,
  shootRange: 60,
};

// Story places. All coordinates are world x/z.
export const PLACES = {
  spawn: { x: -40, z: 40 },
  garage: { x: -80, z: 80, label: "Ada's Garage" },
  hotel: { x: 80, z: 80, label: 'Hotel Solmar' },
  marina: { x: 118, z: 20, label: 'Marina Dock' },
  pier: { x: 0, z: -128, label: 'South Pier' },
  hideout: { x: -80, z: -80, label: 'Hideout' },
  clinic: { x: 40, z: -80, label: 'Clinic' },
};

// The five story missions, in order. A step is one objective:
//   goto  — reach the marker (drive or walk)
//   steal — steal the marked car, then goto
//   pickup — stand at the marker to collect, then goto
//   evade — reach the marker while wanted, then hold still there
//   taxi  — carry N fares: goto pickup, then goto drop, repeat
export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    payout: 400,
    briefing:
      "Ada needs a car for the garage and you need cash. Steal the marked sedan and bring it to Ada's Garage.",
    steps: [
      { kind: 'steal', car: 'sedan', at: { x: -40, z: 80 }, text: 'Steal the marked sedan' },
      { kind: 'goto', at: { x: -80, z: 80 }, text: "Drive it to Ada's Garage" },
    ],
  },
  {
    id: 'package-run',
    title: 'Package Run',
    payout: 600,
    timeLimit: 100,
    briefing:
      'A package is waiting at the Marina Dock. Pick it up and get it to Hotel Solmar before the clock runs out.',
    steps: [
      { kind: 'pickup', at: { x: 118, z: 20 }, text: 'Pick up the package at the Marina Dock' },
      { kind: 'goto', at: { x: 80, z: 80 }, text: 'Deliver it to Hotel Solmar', timed: true },
    ],
  },
  {
    id: 'lose-the-heat',
    title: 'Lose the Heat',
    payout: 800,
    briefing:
      'The job went loud and the police are on you. Two stars and climbing — get to the South Pier and lay low until the heat dies.',
    steps: [
      { kind: 'evade', at: { x: 0, z: -128 }, text: 'Reach the South Pier with the cops behind you' },
      { kind: 'hide', at: { x: 0, z: -128 }, text: 'Lay low at the pier until the heat is gone', holdSeconds: 8 },
    ],
  },
  {
    id: 'night-shift',
    title: 'Night Shift',
    payout: 900,
    briefing:
      'Ada lent you a taxi for the evening. Three fares are waiting around the city — pick them up and drop them off.',
    steps: [{ kind: 'taxi', fares: 3, text: 'Carry 3 taxi fares' }],
  },
  {
    id: 'big-score',
    title: 'The Big Score',
    payout: 2000,
    briefing:
      'The courier van is parked by the marina, full of Rocco’s money. Steal it and bring it to the Hideout. This one pays the debt.',
    steps: [
      { kind: 'steal', car: 'van', at: { x: 104, z: -20 }, text: 'Steal the courier van' },
      { kind: 'goto', at: { x: -80, z: -80 }, text: 'Bring it to the Hideout' },
    ],
  },
];

export const SIDE_JOBS = {
  taxiFare: { min: 150, max: 320 },
  courier: { min: 250, max: 450 },
};

export const SAVE_KEY = 'solmar-heat-save-v1';
export const START_CASH = 120;
export const DEBT_TOTAL = 4500;
