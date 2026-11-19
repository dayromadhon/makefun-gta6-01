// SOLMAR HEAT — config: every tunable number and the story data live here.
export const CFG = {
  seed: 1337,
  // World layout: a 5x5 block grid. Roads run between the blocks.
  block: 34,
  road: 12,
  blocks: 5,
  // Derived: road centres sit at multiples of pitch, offset so the grid is centred.
  get pitch() { return this.block + this.road; },
  get half() { return (this.blocks * this.pitch + this.road) / 2; },
  // Gameplay
  debtTotal: 4500,
  playerWalkSpeed: 7,
  playerRunSpeed: 11,
  carTopSpeed: 27,
  carAccel: 14,
  carBrake: 26,
  carReverseSpeed: 9,
  carTurn: 1.9,
  copCarSpeed: 23,
  trafficSpeed: 9,
  maxWanted: 5,
  startHealth: 100,
  startAmmo: 48,
  magSize: 12,
  punchDamage: 25,
  shotDamage: 34,
  // Counts (halved in ?fx=low)
  trafficCars: 10,
  parkedCars: 9,
  pedestrians: 14,
  palms: 26,
};

export const COLORS = {
  sky: 0x8ec9ea,
  fog: 0xa8d0e6,
  ground: 0x3f6b3a,
  asphalt: 0x2e2f33,
  sidewalk: 0x9a9a92,
  sand: 0xe8d29a,
  water: 0x1e7fa8,
  marinaDeck: 0x8a6f4d,
  building: [0xd8c9a3, 0xb8c4cc, 0xe0b08a, 0xc4a4a4, 0xa8b8a0, 0xd0d0d0],
  downtown: [0x7fa8c8, 0x9ab8d0, 0x88a0b8, 0xb0c0d0],
  carPaint: [0xc23b2e, 0x2e6fc2, 0xe8c832, 0x3aa84f, 0xe8e8e8, 0x222226, 0xc26a1e, 0x7a4fb0],
  taxi: 0xf2c200,
  police: 0xf0f0f0,
  van: 0xe8e8e8,
};

// The five story missions. Each step is an objective the player must reach or do.
export const MISSIONS = [
  {
    id: 1, name: 'First Wheels', reward: 400,
    brief: 'Ada needs wheels. Steal any parked car and bring it to her garage.',
    steps: [
      { kind: 'steal', text: 'Steal a car (walk up to one and press E)' },
      { kind: 'goto', at: 'garage', text: 'Drive the car to Ada\u2019s garage' },
    ],
  },
  {
    id: 2, name: 'Package Run', reward: 600,
    brief: 'A package is waiting at the marina. Pick it up, then run it to Hotel Solmar before the clock runs out.',
    steps: [
      { kind: 'goto', at: 'marina', text: 'Pick up the package at the marina' },
      { kind: 'goto', at: 'hotel', text: 'Deliver the package to Hotel Solmar', timer: 90 },
    ],
  },
  {
    id: 3, name: 'Lose the Heat', reward: 800,
    brief: 'Rocco\u2019s boys tipped off the cops. You are at 2 stars — shake them and get to the pier.',
    steps: [
      { kind: 'goto', at: 'pier', text: 'Reach the pier and lose the cops', wanted: 2 },
    ],
  },
  {
    id: 4, name: 'Night Shift', reward: 900,
    brief: 'Drive the cab. Three fares, three drop-offs, no complaints.',
    steps: [
      { kind: 'taxi', count: 3, text: 'Pick up fares and drop them off (0/3)' },
    ],
  },
  {
    id: 5, name: 'The Big Score', reward: 2000,
    brief: 'The courier van leaves the depot at dawn. Take it, bring it to the hideout, and the debt is gone.',
    steps: [
      { kind: 'stealVan', text: 'Steal the courier van at the depot (press E)' },
      { kind: 'goto', at: 'hideout', text: 'Bring the van to the hideout' },
    ],
  },
];

// Named places on the map (grid coords in world units).
export const PLACES = {
  garage: { x: -58, z: 58, label: 'Ada\u2019s Garage' },
  marina: { x: 96, z: 30, label: 'Marina' },
  hotel: { x: 12, z: -80, label: 'Hotel Solmar' },
  pier: { x: -30, z: 112, label: 'Pier' },
  depot: { x: 80, z: -58, label: 'Courier Depot' },
  hideout: { x: -92, z: -30, label: 'Hideout' },
  hospital: { x: -12, z: 80, label: 'Clinic' },
  beach: { x: 0, z: 116, label: 'Beach' },
};
