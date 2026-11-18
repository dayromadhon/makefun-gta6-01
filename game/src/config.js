// SOLMAR HEAT — config: every constant the game shares.
// Original open-world crime game. No Rockstar/GTA names, art or assets.

export const CFG = {
  // City: a 5x5 street grid. Blocks are square, roads run between them.
  GRID: 5, // blocks per side
  BLOCK: 46, // block size (world units)
  ROAD: 14, // road width
  // Derived: half the city span (roads + blocks).
  get SPAN() {
    return (this.GRID * this.BLOCK + (this.GRID + 1) * this.ROAD) / 2;
  },
  // Debt the story is about: Leo owes loan shark Rocco Vane $4,500.
  DEBT_START: 4500,
  // Mission payouts, in order.
  MISSION_PAY: [400, 600, 800, 900, 2000],
  // Taxi side-job fare range.
  TAXI_FARE_MIN: 120,
  TAXI_FARE_MAX: 300,
  // Player.
  PLAYER_HEALTH: 100,
  PLAYER_WALK_SPEED: 9,
  PLAYER_RUN_SPEED: 14,
  PISTOL_AMMO: 12,
  PISTOL_RESERVE: 48,
  PISTOL_DAMAGE: 34,
  PISTOL_RANGE: 60,
  FIST_DAMAGE: 12,
  FIST_RANGE: 2.6,
  // Cars.
  CAR_ACCEL: 26,
  CAR_BRAKE: 42,
  CAR_MAX_SPEED: 38,
  CAR_REVERSE_SPEED: 12,
  CAR_TURN: 1.9,
  CAR_DRIFT: 0.55,
  // Wanted.
  WANTED_MAX: 5,
  WANTED_DECAY_SECONDS: 25,
  // Police.
  POLICE_TOP_SPEED: 40,
  BUST_RANGE: 3.2,
  BUST_SECONDS: 2.5,
  // Traffic / pedestrians.
  TRAFFIC_COUNT: 14,
  PED_COUNT: 26,
  // Save key.
  SAVE_KEY: 'solmar-heat-save-v1',
};

// Mission script: title, briefing, objective text.
export const MISSIONS = [
  {
    id: 1,
    name: 'First Wheels',
    brief: "Ada Kwan: Leo, you need wheels. Steal a parked car and bring it to my garage.",
    objective: 'Steal a car and drive it to Ada\u2019s garage',
    pay: 400,
  },
  {
    id: 2,
    name: 'Package Run',
    brief: 'Ada Kwan: Pick up the package at the marina and run it to Hotel Solmar. Fast. The clock is ticking.',
    objective: 'Pick up the package at the marina, deliver to Hotel Solmar',
    pay: 600,
    timeLimit: 90,
  },
  {
    id: 3,
    name: 'Lose the Heat',
    brief: 'Ada Kwan: The cops are on you. Two stars. Shake them and get to the pier, then lay low.',
    objective: 'Lose the wanted level, then reach the pier',
    pay: 800,
  },
  {
    id: 4,
    name: 'Night Shift',
    brief: 'Ada Kwan: Drive the taxi. Three fares, three stops. Keep the meter running.',
    objective: 'Complete 3 taxi fares',
    pay: 900,
  },
  {
    id: 5,
    name: 'The Big Score',
    brief: 'Ada Kwan: The courier van. Steal it, bring it to the hideout. This pays the debt.',
    objective: 'Steal the courier van and bring it to the hideout',
    pay: 2000,
  },
];

// Named places (world coordinates are filled in by city.js at build time).
export const PLACES = {
  garage: { label: 'Ada\u2019s Garage' },
  marina: { label: 'Marina Pickup' },
  hotel: { label: 'Hotel Solmar' },
  pier: { label: 'The Pier' },
  hideout: { label: 'Hideout' },
  beach: { label: 'Solmar Beach' },
};
