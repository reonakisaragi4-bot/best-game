// Lumen Drift — every tuning number and colour in one place. The playfield is a
// fixed 1280x720 logical area; the renderer scales it to the window, so no rule
// below depends on the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Hull pips the ship starts with; a hit removes one. */
export const HULL = 3;

/** Clearing this wave wins the run. */
export const WIN_WAVE = 10;

export const SHIP = {
  radius: 14,
  accel: 1500,
  maxSpeed: 360,
  drag: 2.4,
  fireInterval: 0.14,
  boltSpeed: 640,
  boltRadius: 5,
  invulnerable: 1.6,
};

export const BOLT = { damage: 1, life: 1.1 };

/** Enemy kinds, by wave they first appear in. */
export const ENEMY = {
  drifter: { radius: 26, hp: 2, speed: 70, score: 50, firstWave: 1 },
  seeker: { radius: 13, hp: 1, speed: 150, score: 100, firstWave: 2 },
  weaver: { radius: 15, hp: 2, speed: 90, score: 150, firstWave: 4 },
};

/** Enemy shots. */
export const ORB = { radius: 7, speed: 230, damage: 1 };

/** How many enemies a wave spawns, and how fast they arrive. */
export const WAVE = {
  baseCount: 6,
  perWave: 3,
  spawnInterval: 1.15,
  intervalScale: 0.93,
  minInterval: 0.4,
  clearBonus: 250,
};

/** Combo: kills within this window of each other raise the multiplier (max x5). */
export const COMBO = { window: 3, max: 5 };

/** Cells: dropped by kills, worth score; every 10 collected repairs 1 hull. */
export const CELL = { radius: 9, score: 25, magnet: 260, repairEvery: 10 };

/** A shield pickup absorbs exactly one hit. */
export const SHIELD = { radius: 12, dropChance: 0.08 };

export const PALETTE = {
  spaceTop: '#070a1c',
  spaceBottom: '#120b2e',
  nebulaA: '#3b1d6e',
  nebulaB: '#0d3a5c',
  star: '#dfe8ff',
  ship: '#5ff2ff',
  shipCore: '#e8feff',
  bolt: '#8ef7ff',
  orb: '#ff5fa2',
  drifter: '#b8a6ff',
  seeker: '#ff7a5c',
  weaver: '#ff5fd0',
  cell: '#ffd94d',
  shield: '#7dffb0',
  hull: '#ff6b81',
  hullEmpty: '#3a2b45',
  text: '#f2f6ff',
  muted: '#9aa7c7',
  panel: 'rgba(10, 14, 34, 0.72)',
  gold: '#ffd94d',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'lumen-drift.best';

/** How many particles and floating texts can exist at once; pools are allocated once. */
export const POOL = { particles: 320, texts: 24 };
