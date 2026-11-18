// config.js — every tuning number for SOLMAR HEAT lives here, one place.
export const CONFIG = {
  // World: a 5x5 street grid. Streets run at these centre lines on x and z.
  blockSize: 46,
  roadWidth: 14,
  streetGap: 60,
  streets: [-120, -60, 0, 60, 120],
  cityHalf: 150,
  // Beach (south, +z) and marina (east, +x) sit just past the grid.
  beachZ: 156,
  waterZ: 172,
  marinaX: 156,
  dockX: 176,

  // Player on foot.
  walkSpeed: 6,
  runSpeed: 10,
  playerRadius: 0.6,
  playerHealth: 100,

  // Cars.
  carAccel: 14,
  carBrake: 26,
  carReverseMax: 8,
  carMaxSpeed: 34,
  carTurn: 1.9,
  handbrakeTurn: 3.4,
  carRadius: 1.6,
  trafficSpeed: 9,
  taxiSpeed: 11,
  policeSpeed: 38,

  // Wanted.
  bustDistance: 3.0,
  bustTime: 2.5,
  bustFine: 100,
  wantedDecaySeconds: 30,
  maxStars: 5,

  // Combat.
  pistolDamage: 34,
  pistolMag: 12,
  pistolReserve: 999,
  pistolRange: 60,
  fistDamage: 12,
  fistRange: 2.2,
  fistCooldown: 0.45,

  // Money.
  debtStart: 4500,
  missionPay: [400, 600, 800, 900, 2000],
  taxiFare: 120,
  packagePay: 250,

  // Missions.
  packageTimeLimit: 90,
  taxiFaresNeeded: 3,
  heatSurviveSeconds: 12,

  // Save.
  saveKey: 'solmar-heat-save-v1',

  // Look.
  skyColor: 0x87bfe8,
  fogColor: 0xa8c8e0,
  sunColor: 0xfff2d8,
  groundColor: 0x9aa08a,
  roadColor: 0x3a3d42,
  sidewalkColor: 0xb8b0a0,
  sandColor: 0xe8d29a,
  waterColor: 0x2e7fa8,
};

// Palette for cars, buildings and people — sun-soaked Solmar Bay.
export const PALETTE = {
  cars: [0xc0392b, 0x2980b9, 0xf39c12, 0x27ae60, 0x8e44ad, 0xececec, 0x2c3e50, 0xd35400, 0x16a085],
  taxi: 0xf1c40f,
  police: 0x1a1a2e,
  policeLight: 0xff2222,
  van: 0xd8d8d8,
  buildings: [0xd8c8a8, 0xc8b898, 0xb8a888, 0xa8b8c8, 0xc8a8a8, 0x98a8b8],
  towers: [0x6a7a8a, 0x7a8a9a, 0x5a6a7a, 0x8a9aa8],
  windows: 0x2a3a4a,
  palms: 0x2e8b57,
  trunk: 0x6b4a2a,
  pedShirts: [0xe74c3c, 0x3498db, 0x2ecc71, 0xf1c40f, 0x9b59b6, 0xecf0f1, 0xe67e22],
  pedSkin: [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac],
};
