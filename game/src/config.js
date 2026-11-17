// Solmar Heat — world constants, story, prices and tuning.
// One job: every number the rest of the game agrees on lives here.
export const WORLD = {
  grid: [-80, -40, 0, 40, 80], // street center lines (x and z)
  half: 100, // city edge; beach starts past +100 z, marina past +100 x
  roadWidth: 10,
  block: 30, // block size between streets
};

export const ECONOMY = {
  startCash: 120,
  debt: 4500,
  bustFine: 150,
  wastedFine: 100,
  sideTaxiMin: 80,
  sideTaxiMax: 200,
  sideCourierMin: 120,
  sideCourierMax: 260,
};

export const CAR = {
  sedanAccel: 15,
  sedanTop: 36,
  taxiAccel: 14,
  taxiTop: 34,
  vanAccel: 11,
  vanTop: 30,
  policeAccel: 17,
  policeTop: 40,
  brake: 22,
  reverseTop: 12,
  steerBase: 1.9,
  driftSteer: 3.1,
  grip: 6.5,
};

export const PLAYER = {
  walkSpeed: 6,
  runSpeed: 9,
  health: 100,
  fistDamage: 12,
  pistolDamage: 34,
  pistolMag: 12,
  pistolRange: 55,
};

// Story missions, in order. Each has an id, a title, a short brief and a
// reward. The missions module turns these into objectives at runtime.
export const MISSIONS = [
  {
    id: 'first-wheels',
    title: 'First Wheels',
    reward: 400,
    brief: 'Ada needs wheels. Steal a parked sedan and bring it to her garage on the west side.',
  },
  {
    id: 'package-run',
    title: 'Package Run',
    reward: 600,
    brief: 'Pick up the package at the marina and deliver it to the Hotel Solmar. The clock is running.',
  },
  {
    id: 'lose-heat',
    title: 'Lose the Heat',
    reward: 800,
    brief: 'The cops are on you — two stars. Break away and hide out at the South Pier until they lose you.',
  },
  {
    id: 'night-shift',
    title: 'Night Shift',
    reward: 900,
    brief: 'Three fares, one night. Pick up passengers and drop them where they need to be.',
  },
  {
    id: 'big-score',
    title: 'The Big Score',
    reward: 2000,
    brief: 'Steal the courier van from the east depot and bring it to the hideout. This one clears the debt.',
  },
];

// Named places on the map (x, z). Missions and side jobs point at these.
export const PLACES = {
  garage: { x: -80, z: 80, label: "Ada's Garage" },
  marinaPickup: { x: 112, z: 40, label: 'Marina Pickup' },
  hotel: { x: 40, z: -40, label: 'Hotel Solmar' },
  pier: { x: 0, z: 112, label: 'South Pier' },
  depot: { x: 80, z: -80, label: 'East Depot' },
  hideout: { x: -80, z: -80, label: 'Hideout' },
  hospital: { x: -40, z: -80, label: 'Clinic' },
  start: { x: 24, z: 80, label: 'Start' },
  sedanSpot: { x: 12, z: 80, label: 'Parked Sedan' },
  vanSpot: { x: 84, z: -72, label: 'Courier Van' },
};

export const COLORS = {
  sky: 0x87b5d6,
  fog: 0x9fc3d8,
  sun: 0xfff2d8,
  ground: 0x8a8f7a,
  sidewalk: 0x9a9a94,
  road: 0x3a3d42,
  sand: 0xdcc28e,
  sea: 0x2e7f9e,
  marina: 0x6b7a86,
  leo: 0xc23b2e,
  police: 0x1c2f4a,
  taxi: 0xf2c200,
  van: 0xe8e8e8,
};
