// Solmar Bay — tuning and palette. One clear job: every number the game shares.
export const WORLD_W = 3600;
export const WORLD_H = 2800;
export const ROAD_W = 96;
export const BLOCK = 300;
export const PITCH = ROAD_W + BLOCK; // 396
// Road centre lines (x for vertical roads, y for horizontal roads).
export const ROAD_X = [198, 594, 990, 1386, 1782, 2178, 2574, 2970, 3366];
export const ROAD_Y = [198, 594, 990, 1386, 1782, 2178, 2538];
export const BEACH_Y = 2560; // sand starts here
export const WATER_Y = 2700; // water starts here
export const PARK = { x: 1188, y: 990, w: 792, h: 792 }; // park block region
export const MARINA = { x: 3100, y: 2300, w: 460, h: 240 };

export const COLORS = {
  grass: '#7fae5a', grassDark: '#6f9c4c', sand: '#e8d39a', water: '#2e7fa8',
  waterDeep: '#256b90', road: '#3a3d44', roadEdge: '#2c2f35', sidewalk: '#b9b3a4',
  lane: '#e8e4d2', parkPath: '#cbb98d', buildingRoof: '#8a7f72',
  carShadow: 'rgba(0,0,0,0.28)',
};
// Car types: top speed (units/s), acceleration, grip (steering), size, colors.
export const CAR_TYPES = {
  sedan:   { name: 'Sedan',   top: 430, accel: 300, grip: 2.6, len: 52, wid: 26, colors: ['#c0392b', '#2e6fb0', '#d9d9d9', '#7d5ba6'] },
  sports:  { name: 'Sports',  top: 560, accel: 420, grip: 3.4, len: 54, wid: 25, colors: ['#f1c40f', '#e74c3c', '#1abc9c', '#222222'] },
  taxi:    { name: 'Taxi',    top: 440, accel: 320, grip: 2.7, len: 52, wid: 26, colors: ['#f7b731'] },
  van:     { name: 'Van',     top: 360, accel: 240, grip: 2.1, len: 62, wid: 28, colors: ['#95a5a6', '#5d6d7e', '#a67c52'] },
  truck:   { name: 'Truck',   top: 330, accel: 210, grip: 1.9, len: 72, wid: 30, colors: ['#7f8c8d', '#b03a2e'] },
  police:  { name: 'Police',  top: 520, accel: 400, grip: 3.2, len: 54, wid: 26, colors: ['#1a1a2e'] },
  coupe:   { name: 'Coupe',   top: 500, accel: 380, grip: 3.1, len: 52, wid: 25, colors: ['#8e44ad', '#16a085', '#c0392b'] },
};
export const PLAYER = {
  walkSpeed: 175, sprintSpeed: 285, radius: 13, health: 100,
  punchRange: 34, punchDamage: 12, punchCooldown: 0.38,
  pistolDamage: 34, pistolCooldown: 0.32, pistolRange: 520, startAmmo: 48,
};
export const POLICE = {
  maxStars: 5, heatPerStar: 25, decayPerSec: 2.2, hideDecayPerSec: 6,
  maxCars: 6, maxOfficers: 8, ramDamage: 9, shootDamage: 7,
};
export const SAVE_KEY = 'solmar-bay-save-v1';
// Mission rewards and names (story: Cole Maddox returns to Solmar Bay).
export const STORY = {
  hero: 'Cole Maddox',
  fixer: 'Lena',
  city: 'Solmar Bay',
};
