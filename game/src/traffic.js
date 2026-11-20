// Traffic — one clear job: the city's cars and pedestrians.
// Car physics (shared by the player, traffic and police), traffic AI that follows
// the road grid, pedestrians that stroll the sidewalks and flee danger.
import { CAR_TYPES, ROAD_X, ROAD_Y, ROAD_W, WORLD_W, WORLD_H } from './config.js';
import { isRoad, isWater, hitBuilding, resolveCircle, nearestRoadPoint } from './world.js';

let nextCarId = 1;
let nextPedId = 1;

export function createCar(type, x, y, angle, opts = {}) {
  const spec = CAR_TYPES[type];
  const color = opts.color || spec.colors[(Math.random() * spec.colors.length) | 0];
  return {
    id: nextCarId++, type, x, y, angle, speed: 0, color,
    len: spec.len, wid: spec.wid, health: 100,
    isPlayer: false, isPolice: false, isTraffic: !!opts.traffic,
    parked: !!opts.parked, dead: false, exploded: false,
    ai: opts.traffic ? { dir: angle, targetSpeed: 150 + Math.random() * 90, wait: 0 } : null,
    chasing: false, driver: opts.traffic ? true : null,
    brakeLight: false,
  };
}

export function createPed(x, y) {
  const colors = ['#e74c3c', '#3498db', '#f1c40f', '#9b59b6', '#1abc9c', '#e67e22', '#ecf0f1', '#2ecc71'];
  return {
    id: nextPedId++, x, y, angle: Math.random() * Math.PI * 2,
    speed: 28 + Math.random() * 30, color: colors[(Math.random() * colors.length) | 0],
    alive: true, dead: false, flee: false, fleeX: 0, fleeY: 0,
    wx: x, wy: y, wait: Math.random() * 2,
  };
}

// --- Car physics: integrate, collide with buildings, water and other cars.
export function moveCar(G, car, dt) {
  const spec = CAR_TYPES[car.type];
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  const r = car.len / 2 - 4;
  // Building collision: slide along the wall instead of stopping dead.
  const hit = hitBuilding(G.world, nx, ny, r);
  if (hit) {
    // Try moving on x only, then y only, to slide.
    const hx = hitBuilding(G.world, nx, car.y, r);
    const hy = hitBuilding(G.world, car.x, ny, r);
    if (!hx) { car.x = nx; }
    if (!hy) { car.y = ny; }
    if (hx && hy) {
      // Hard stop with a thud and sparks when fast.
      if (Math.abs(car.speed) > 180) {
        G.audio.crash();
        G.camera.shake = Math.max(G.camera.shake, 5);
        G.particles.push({ kind: 'spark', x: car.x, y: car.y, life: 0.25, max: 0.25 });
        car.health -= 6;
        if (car.health <= 0 && !car.exploded) {
          // Only the player's car explodes on crash damage; traffic cars smoke.
          if (car.isPlayer) { /* handled by caller via health */ }
          else { car.dead = true; }
        }
      }
      car.speed *= 0.35;
    } else {
      car.speed *= 0.92;
    }
  } else {
    car.x = nx; car.y = ny;
  }
  car.x = Math.max(20, Math.min(WORLD_W - 20, car.x));
  car.y = Math.max(20, Math.min(WORLD_H - 20, car.y));
  if (isWater(car.x, car.y)) { car.y = 2700 - r; car.speed *= 0.5; }
  // Car-car collision: push apart, trade speed, spark on hard hits.
  for (const o of G.cars) {
    if (o === car || o.dead) continue;
    const dx = o.x - car.x, dy = o.y - car.y;
    const d = Math.hypot(dx, dy);
    const min = (car.len + o.len) / 2 - 8;
    if (d > 0.01 && d < min) {
      const push = (min - d) / 2;
      const ux = dx / d, uy = dy / d;
      car.x -= ux * push; car.y -= uy * push;
      o.x += ux * push; o.y += uy * push;
      const rel = Math.abs(car.speed - o.speed);
      if (rel > 140) {
        G.audio.crash();
        G.particles.push({ kind: 'spark', x: (car.x + o.x) / 2, y: (car.y + o.y) / 2, life: 0.2, max: 0.2 });
        car.health -= 4; o.health -= 4;
        if (o.health <= 0 && !o.exploded && o.isTraffic) o.dead = true;
        if (car.health <= 0 && !car.exploded && car.isTraffic) car.dead = true;
      }
      const avg = (car.speed + o.speed) / 2;
      car.speed = avg; o.speed = avg;
    }
  }
}

// --- Traffic AI: drive along the road grid, turn at intersections, queue behind cars.
function trafficStep(G, car, dt) {
  const ai = car.ai;
  if (!ai) return;
  const spec = CAR_TYPES[car.type];
  // Sense the car ahead on the same road.
  const ahead = carAhead(G, car, 95);
  let target = ai.targetSpeed;
  if (ahead) target = Math.min(target, Math.max(0, ahead.speed - 20));
  // A pedestrian crossing close ahead makes traffic brake.
  for (const ped of G.peds) {
    if (!ped.alive) continue;
    const dx = ped.x - car.x, dy = ped.y - car.y;
    const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (along > 0 && along < 70 && side < 26) { target = 0; break; }
  }
  car.speed += Math.sign(target - car.speed) * spec.accel * 0.55 * dt;
  car.speed = Math.max(0, Math.min(spec.top * 0.62, car.speed));
  // At an intersection, sometimes turn.
  const nearX = ROAD_X.find((rx) => Math.abs(car.x - rx) < 14);
  const nearY = ROAD_Y.find((ry) => Math.abs(car.y - ry) < 14);
  if ((nearX !== undefined || nearY !== undefined) && Math.random() < dt * 0.55) {
    const vertical = Math.abs(car.x - (nearX ?? 1e9)) < Math.abs(car.y - (nearY ?? 1e9));
    const turn = Math.random();
    if (vertical) car.angle = turn < 0.5 ? 0 : Math.PI;
    else car.angle = turn < 0.5 ? Math.PI / 2 : -Math.PI / 2;
  }
  // Stay glued to the road centre line: steer back toward it.
  const np = nearestRoadPoint(car.x, car.y);
  if (np) {
    const want = np.vertical ? (car.angle > Math.PI / 2 || car.angle < -Math.PI / 2 ? Math.PI : 0) : (car.angle > 0 ? Math.PI / 2 : -Math.PI / 2);
    // Nudge the angle toward the road direction.
    let diff = want - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    car.angle += diff * Math.min(1, dt * 2.2);
    // Pull the car back onto the centre line.
    if (np.vertical) car.x += (np.x - car.x) * Math.min(1, dt * 1.4);
    else car.y += (np.y - car.y) * Math.min(1, dt * 1.4);
  }
  moveCar(G, car, dt);
}

function carAhead(G, car, dist) {
  let best = null, bestD = dist;
  const cx = Math.cos(car.angle), sy = Math.sin(car.angle);
  for (const o of G.cars) {
    if (o === car || o.dead) continue;
    const dx = o.x - car.x, dy = o.y - car.y;
    const along = dx * cx + dy * sy;
    const side = Math.abs(-dx * sy + dy * cx);
    if (along > 0 && along < bestD && side < 24) { bestD = along; best = o; }
  }
  return best;
}

function randomRoadSpawn(G, rng) {
  const vertical = rng() < 0.5;
  if (vertical) {
    const rx = ROAD_X[(rng() * ROAD_X.length) | 0];
    const y = 120 + rng() * (WORLD_H - 400);
    return { x: rx + (rng() < 0.5 ? -20 : 20), y, angle: rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2 };
  }
  const ry = ROAD_Y[(rng() * ROAD_Y.length) | 0];
  const x = 120 + rng() * (WORLD_W - 240);
  return { x, y: ry + (rng() < 0.5 ? -20 : 20), angle: rng() < 0.5 ? 0 : Math.PI };
}

function randomSidewalkSpawn(G, rng) {
  const rx = ROAD_X[(rng() * ROAD_X.length) | 0];
  const ry = ROAD_Y[(rng() * ROAD_Y.length) | 0];
  return { x: rx + (rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 16), y: ry + (rng() - 0.5) * 260 };
}

export function spawnTraffic(G, n) {
  const types = ['sedan', 'sedan', 'taxi', 'van', 'coupe', 'sedan', 'truck'];
  for (let i = 0; i < n; i++) {
    const s = randomRoadSpawn(G, Math.random);
    const type = types[(Math.random() * types.length) | 0];
    const car = createCar(type, s.x, s.y, s.angle, { traffic: true });
    car.speed = 120 + Math.random() * 90;
    G.cars.push(car);
  }
}
export function spawnPeds(G, n) {
  for (let i = 0; i < n; i++) {
    const s = randomSidewalkSpawn(G, Math.random);
    const ped = createPed(s.x, s.y);
    G.peds.push(ped);
  }
}
export function spawnParkedCars(G, n) {
  const types = ['sedan', 'sports', 'coupe', 'van'];
  for (let i = 0; i < n; i++) {
    const s = randomRoadSpawn(G, Math.random);
    const type = types[(Math.random() * types.length) | 0];
    const car = createCar(type, s.x + (Math.random() - 0.5) * 30, s.y + (Math.random() - 0.5) * 30, s.angle, { parked: true });
    G.cars.push(car);
  }
}

function pedStep(G, ped, dt) {
  if (!ped.alive) return;
  // Danger nearby: flee away from the player, police, explosions.
  let danger = null, dangerD = 170;
  const px = G.player.x, py = G.player.y;
  if (!G.player.onFoot && G.player.car && Math.abs(G.player.car.speed) > 200) {
    const d = Math.hypot(ped.x - px, ped.y - py);
    if (d < dangerD) { danger = { x: px, y: py }; dangerD = d; }
  }
  if (G.police.stars > 0) {
    for (const c of G.police.cars) {
      const d = Math.hypot(ped.x - c.x, ped.y - c.y);
      if (d < 150 && d < dangerD) { danger = { x: c.x, y: c.y }; dangerD = d; }
    }
  }
  if (danger) {
    ped.flee = true;
    const a = Math.atan2(ped.y - danger.y, ped.x - danger.x);
    ped.x += Math.cos(a) * 150 * dt;
    ped.y += Math.sin(a) * 150 * dt;
    ped.angle = a;
  } else {
    ped.flee = false;
    if (ped.wait > 0) { ped.wait -= dt; return; }
    const dx = ped.wx - ped.x, dy = ped.wy - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) {
      ped.wait = 1 + Math.random() * 3;
      const s = randomSidewalkSpawn(G, Math.random);
      ped.wx = s.x; ped.wy = s.y;
      return;
    }
    ped.angle = Math.atan2(dy, dx);
    ped.x += Math.cos(ped.angle) * ped.speed * dt;
    ped.y += Math.sin(ped.angle) * ped.speed * dt;
  }
  resolveCircle(G.world, ped, 10);
  if (isWater(ped.x, ped.y)) ped.y = 2700 - 12;
  // Hit by a fast car: knocked down.
  for (const car of G.cars) {
    if (car.dead || Math.abs(car.speed) < 60) continue;
    if (Math.hypot(ped.x - car.x, ped.y - car.y) < 30) {
      ped.alive = false; ped.dead = true;
      G.particles.push({ kind: 'blood', x: ped.x, y: ped.y, life: 0.5, max: 0.5 });
      if (car.isPlayer) G.police.addHeat(G, 16);
    }
  }
}

export function updateTraffic(G, dt) {
  // Keep the city alive: replace cars/peds that died or wandered off.
  let trafficCount = 0;
  for (const car of G.cars) if (car.isTraffic && !car.dead) trafficCount++;
  if (trafficCount < 13) spawnTraffic(G, 13 - trafficCount);
  let pedCount = 0;
  for (const ped of G.peds) if (ped.alive) pedCount++;
  if (pedCount < 26) spawnPeds(G, 26 - pedCount);
  // Remove dead/wrecked cars and dead peds after a while.
  G.cars = G.cars.filter((c) => !c.dead || c.isPlayer || (c.exploded && c.removeAt > G.time));
  for (const car of G.cars) if (car.exploded && !car.removeAt) car.removeAt = G.time + 6;
  G.cars = G.cars.filter((c) => !c.removeAt || c.removeAt > G.time);
  G.peds = G.peds.filter((p) => p.alive || (p.deadAt && p.deadAt > G.time));
  for (const ped of G.peds) if (ped.dead && !ped.deadAt) ped.deadAt = G.time + 8;
  for (const car of G.cars) {
    if (car.dead) continue;
    if (car.isTraffic && car.ai) trafficStep(G, car, dt);
  }
  for (const ped of G.peds) pedStep(G, ped, dt);
}
