// Solmar Bay — the city itself. One clear job: generate the road grid, blocks,
// buildings, park, beach and marina from a fixed seed, and answer collision queries.
import { WORLD_W, WORLD_H, ROAD_W, ROAD_X, ROAD_Y, BEACH_Y, WATER_Y, PARK, MARINA, COLORS } from './config.js';

// Deterministic PRNG so the city is identical on every load.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ROOF_COLORS = ['#b08968', '#8d7b68', '#a9805e', '#7d8a96', '#9c6644', '#6b7c6e', '#b5654a', '#5e6b7a'];
const WALL_COLORS = ['#e8dcc8', '#d9c7a7', '#c9b8a3', '#e5d5c0', '#d3c1a5', '#cbb49a'];

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function createWorld(seed = 20261124) {
  const rnd = mulberry32(seed);
  const buildings = [];
  const trees = [];
  const lamps = [];
  // Blocks: the rectangle between four road edges.
  const blocks = [];
  for (let ci = 0; ci < ROAD_X.length; ci++) {
    for (let ri = 0; ri < ROAD_Y.length; ri++) {
      const x0 = ROAD_X[ci] + ROAD_W / 2 + 10;
      const y0 = ROAD_Y[ri] + ROAD_W / 2 + 10;
      const x1 = (ci + 1 < ROAD_X.length ? ROAD_X[ci + 1] - ROAD_W / 2 - 10 : WORLD_W - 14);
      const y1 = (ri + 1 < ROAD_Y.length ? ROAD_Y[ri + 1] - ROAD_W / 2 - 10 : BEACH_Y - 14);
      if (x1 - x0 < 60 || y1 - y0 < 60) continue;
      blocks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
  }
  const inPark = (r) => rectsOverlap(r, PARK);
  const inMarina = (r) => rectsOverlap(r, MARINA);
  for (const b of blocks) {
    if (inPark(b) || inMarina(b)) continue;
    if (b.y + b.h > BEACH_Y) continue; // beachfront blocks stay open
    const count = rnd() < 0.45 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const w = 90 + rnd() * Math.max(30, b.w - 190);
      const h = 80 + rnd() * Math.max(30, b.h - 170);
      const x = b.x + 8 + rnd() * Math.max(1, b.w - w - 16);
      const y = b.y + 8 + rnd() * Math.max(1, b.h - h - 16);
      const rect = { x, y, w, h };
      if (buildings.some((o) => rectsOverlap(rect, o))) continue;
      buildings.push({
        ...rect,
        roof: ROOF_COLORS[(rnd() * ROOF_COLORS.length) | 0],
        wall: WALL_COLORS[(rnd() * WALL_COLORS.length) | 0],
        height: 6 + ((rnd() * 14) | 0),
        windows: rnd() < 0.7,
      });
    }
  }
  // Palm trees: along the beachfront, in the park, and scattered on sidewalks.
  for (let x = 120; x < WORLD_W - 100; x += 130 + rnd() * 90) {
    trees.push({ x, y: BEACH_Y + 40 + rnd() * 60, palm: true, s: 0.9 + rnd() * 0.5 });
  }
  for (let i = 0; i < 46; i++) {
    trees.push({
      x: PARK.x + 40 + rnd() * (PARK.w - 80),
      y: PARK.y + 40 + rnd() * (PARK.h - 80),
      palm: rnd() < 0.4, s: 0.8 + rnd() * 0.6,
    });
  }
  for (let i = 0; i < 60; i++) {
    const rx = ROAD_X[(rnd() * ROAD_X.length) | 0];
    const ry = ROAD_Y[(rnd() * ROAD_Y.length) | 0];
    const side = rnd() < 0.5 ? -1 : 1;
    trees.push({ x: rx + side * (ROAD_W / 2 + 14), y: ry + (rnd() - 0.5) * 200, palm: false, s: 0.7 + rnd() * 0.5 });
  }
  // Street lamps along roads.
  for (const rx of ROAD_X) for (const ry of ROAD_Y) lamps.push({ x: rx + ROAD_W / 2 - 6, y: ry - ROAD_W / 2 + 6 });
  return { buildings, trees, lamps, seed };
}

// --- Queries (pure functions over the world) ---
export function isRoad(x, y) {
  const onV = ROAD_X.some((rx) => Math.abs(x - rx) <= ROAD_W / 2);
  const onH = ROAD_Y.some((ry) => Math.abs(y - ry) <= ROAD_W / 2);
  return onV || onH;
}
export function isWater(x, y) { return y >= WATER_Y && x >= 0 && x <= WORLD_W; }
export function isSand(x, y) { return y >= BEACH_Y && y < WATER_Y; }
export function inPark(x, y) { return x >= PARK.x && x <= PARK.x + PARK.w && y >= PARK.y && y <= PARK.y + PARK.h; }
export function inMarina(x, y) { return x >= MARINA.x && x <= MARINA.x + MARINA.w && y >= MARINA.y && y <= MARINA.y + MARINA.h; }

// Circle (x,y,r) vs a building rect: returns the rect or null.
export function hitBuilding(world, x, y, r) {
  for (const b of world.buildings) {
    const cx = Math.max(b.x, Math.min(x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(y, b.y + b.h));
    const dx = x - cx, dy = y - cy;
    if (dx * dx + dy * dy < r * r) return b;
  }
  return null;
}
// Resolve a circle out of buildings and the world edge; returns true if it hit something.
export function resolveCircle(world, p, r) {
  let hit = false;
  p.x = Math.max(r, Math.min(WORLD_W - r, p.x));
  p.y = Math.max(r, Math.min(WORLD_H - r, p.y));
  for (const b of world.buildings) {
    const cx = Math.max(b.x, Math.min(p.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(p.y, b.y + b.h));
    const dx = p.x - cx, dy = p.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r && d2 > 0.0001) {
      const d = Math.sqrt(d2);
      p.x = cx + (dx / d) * r; p.y = cy + (dy / d) * r; hit = true;
    } else if (d2 <= 0.0001) {
      // Centre inside the rect: push out along the smallest penetration axis.
      const pl = p.x - b.x, pr = b.x + b.w - p.x, pt = p.y - b.y, pb = b.y + b.h - p.y;
      const m = Math.min(pl, pr, pt, pb);
      if (m === pl) p.x = b.x - r; else if (m === pr) p.x = b.x + b.w + r;
      else if (m === pt) p.y = b.y - r; else p.y = b.y + b.h + r;
      hit = true;
    }
  }
  if (isWater(p.x, p.y)) { p.y = WATER_Y - r; hit = true; }
  return hit;
}
// Nearest point on a road centre line to (x,y) — used to snap spawns onto roads.
export function nearestRoadPoint(x, y) {
  let best = null, bestD = Infinity;
  for (const rx of ROAD_X) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y, vertical: true }; }
  }
  for (const ry of ROAD_Y) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry, vertical: false }; }
  }
  return best;
}
export function roadAngleAt(x, y) {
  // Direction of the road the point is on (nearest centre line).
  let bestV = Infinity, bestH = Infinity;
  for (const rx of ROAD_X) bestV = Math.min(bestV, Math.abs(x - rx));
  for (const ry of ROAD_Y) bestH = Math.min(bestH, Math.abs(y - ry));
  return bestV <= bestH ? (Math.random() < 0.5 ? 0 : Math.PI) : (Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2);
}
export { COLORS };
