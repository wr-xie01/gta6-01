// Police — one clear job: the wanted level and the law's response.
// Heat (0–125) sets the stars (0–5). Police cars chase and ram; officers on foot
// chase, shoot at higher stars, and bust the player if they catch him standing still.
import { POLICE, CAR_TYPES } from './config.js';
import { createCar, moveCar } from './traffic.js';
import { damagePlayer, explodeCar } from './player.js';
import { resolveCircle, isWater, nearestRoadPoint } from './world.js';

export function createPolice() {
  const pol = { heat: 0, stars: 0, cars: [], officers: [], spawnTimer: 0, hiddenTimer: 0, sirenNear: false };
  // addHeat is a method on the police object so player/traffic/missions can
  // raise the wanted level through G.police without importing this module
  // (which would create an import cycle with player.js).
  pol.addHeat = (G, amount) => addHeat(G, amount);
  return pol;
}

export function addHeat(G, amount) {
  const pol = G.police;
  pol.heat = Math.max(0, Math.min(POLICE.maxStars * POLICE.heatPerStar, pol.heat + amount));
  const stars = Math.min(POLICE.maxStars, Math.floor(pol.heat / POLICE.heatPerStar));
  if (stars > pol.stars) {
    pol.stars = stars;
    G.hud.flash(stars >= 3 ? `WANTED — ${stars} stars! Lose the cops!` : `Wanted level ${stars} star${stars > 1 ? 's' : ''}.`);
  } else pol.stars = stars;
}

function canSeePlayer(G) {
  // Any police unit within sight range and roughly line-of-sight.
  const p = G.player;
  for (const c of G.police.cars) if (Math.hypot(c.x - p.x, c.y - p.y) < 620) return true;
  for (const o of G.police.officers) if (o.alive && Math.hypot(o.x - p.x, o.y - p.y) < 420) return true;
  return false;
}

function spawnPoliceCar(G) {
  const p = G.player;
  const ang = Math.random() * Math.PI * 2;
  const d = 700 + Math.random() * 300;
  let x = p.x + Math.cos(ang) * d, y = p.y + Math.sin(ang) * d;
  x = Math.max(60, Math.min(3540, x)); y = Math.max(60, Math.min(2680, y));
  const np = nearestRoadPoint(x, y);
  if (np) { x = np.x; y = np.y; }
  const car = createCar('police', x, y, Math.atan2(p.y - y, p.x - x));
  car.isPolice = true; car.chasing = true;
  car.speed = 200;
  G.cars.push(car);
  G.police.cars.push(car);
}

function spawnOfficer(G) {
  const p = G.player;
  const ang = Math.random() * Math.PI * 2;
  const x = p.x + Math.cos(ang) * (120 + Math.random() * 120);
  const y = p.y + Math.sin(ang) * (120 + Math.random() * 120);
  const off = {
    x: Math.max(40, Math.min(3560, x)), y: Math.max(40, Math.min(2760, y)),
    angle: 0, speed: 0, health: 40, alive: true, dead: false,
    shootCd: 1 + Math.random(), bustTimer: 0, walkPhase: 0,
  };
  resolveCircle(G.world, off, 12);
  G.police.officers.push(off);
}

function policeCarStep(G, car, dt) {
  const p = G.player;
  const spec = CAR_TYPES.police;
  const dx = p.x - car.x, dy = p.y - car.y;
  const dist = Math.hypot(dx, dy);
  const wantAngle = Math.atan2(dy, dx);
  let diff = wantAngle - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  // Ram the player: full speed when far, ease off when very close to avoid orbiting.
  const target = dist > 90 ? spec.top : spec.top * 0.55;
  car.speed += Math.sign(target - car.speed) * spec.accel * dt;
  car.speed = Math.max(0, Math.min(spec.top, car.speed));
  car.angle += Math.max(-1, Math.min(1, diff * 2.4)) * spec.grip * 0.9 * dt * (car.speed > 40 ? 1 : 0.4);
  // Nudge the car back onto a road when it is far off-road and far from the player.
  if (dist > 500) {
    const np = nearestRoadPoint(car.x, car.y);
    if (np) {
      const gx = np.x - car.x, gy = np.y - car.y;
      if (Math.hypot(gx, gy) > 120) { car.x += gx * dt * 0.4; car.y += gy * dt * 0.4; }
    }
  }
  // Use the shared car mover (buildings, water, car-car).
  moveCar(G, car, dt);
  // Ramming the player's car damages it; ramming the player on foot hurts him.
  if (dist < 46) {
    if (p.car === car) { /* cannot ram itself */ }
    else if (!p.onFoot && p.car) {
      p.car.health -= POLICE.ramDamage * dt * 2;
      G.camera.shake = Math.max(G.camera.shake, 4);
      if (p.car.health <= 0 && !p.car.exploded) explodeCar(G, p.car);
    } else if (p.onFoot && !p.dead) {
      damagePlayer(G, POLICE.ramDamage * dt * 2);
    }
  }
  // Despawn when the chase is over and the car is far away.
  if (G.police.stars === 0 && dist > 900) { car.dead = true; }
}

function officerStep(G, off, dt) {
  const p = G.player;
  if (!off.alive) return;
  const dx = p.x - off.x, dy = p.y - off.y;
  const dist = Math.hypot(dx, dy);
  off.angle = Math.atan2(dy, dx);
  off.shootCd -= dt;
  // Shoot at the player from range once the heat is up.
  if (G.police.stars >= 2 && dist < 420 && dist > 90 && off.shootCd <= 0) {
    off.shootCd = 1.4 + Math.random() * 0.9;
    G.audio.gunshot();
    G.particles.push({ kind: 'tracer', x: off.x, y: off.y, x2: p.x, y2: p.y, life: 0.08, max: 0.08 });
    if (Math.random() < 0.45) damagePlayer(G, POLICE.shootDamage);
  }
  // Chase on foot; if the player is standing still on foot, bust him.
  const speed = G.police.stars >= 2 ? 205 : 175;
  off.x += Math.cos(off.angle) * speed * dt;
  off.y += Math.sin(off.angle) * speed * dt;
  off.walkPhase += dt * 10;
  resolveCircle(G.world, off, 12);
  if (isWater(off.x, off.y)) off.y = 2700 - 13;
  if (p.onFoot && !p.dead && dist < 30 && p.speed < 60) {
    off.bustTimer += dt;
    if (off.bustTimer > 1.6) {
      G.state = 'busted';
      G.audio.busted();
    }
  } else off.bustTimer = 0;
  if (G.police.stars === 0 && dist > 700) off.alive = false;
}

export function updatePolice(G, dt) {
  const pol = G.police;
  // Prune dead units.
  pol.cars = pol.cars.filter((c) => !c.dead);
  pol.officers = pol.officers.filter((o) => o.alive);
  // Wanted decay: heat falls when no unit can see the player; faster when hidden.
  const seen = canSeePlayer(G);
  if (pol.stars > 0) {
    if (!seen) {
      pol.hiddenTimer += dt;
      pol.heat -= POLICE.hideDecayPerSec * dt * (pol.hiddenTimer > 4 ? 2 : 1);
    } else pol.hiddenTimer = 0;
    pol.heat -= POLICE.decayPerSec * dt * 0.25;
    if (pol.heat <= 0) { pol.heat = 0; pol.stars = 0; G.hud.flash('You lost the cops.'); }
    else pol.stars = Math.min(POLICE.maxStars, Math.floor(pol.heat / POLICE.heatPerStar));
  }
  // Spawn to match the wanted level.
  const wantCars = pol.stars === 0 ? 0 : Math.min(POLICE.maxCars, 1 + pol.stars);
  const wantOfficers = pol.stars === 0 ? 0 : Math.min(POLICE.maxOfficers, pol.stars * 2);
  pol.spawnTimer -= dt;
  if (pol.cars.length < wantCars && pol.spawnTimer <= 0) {
    spawnPoliceCar(G); pol.spawnTimer = 1.2;
  }
  if (pol.officers.length < wantOfficers && pol.spawnTimer <= 0) {
    spawnOfficer(G); pol.spawnTimer = 0.9;
  }
  // Siren when a police car is near.
  pol.sirenNear = pol.cars.some((c) => Math.hypot(c.x - G.player.x, c.y - G.player.y) < 700);
  G.audio.siren(pol.sirenNear && pol.stars > 0);
  for (const car of pol.cars) policeCarStep(G, car, dt);
  for (const off of pol.officers) officerStep(G, off, dt);
}

export function clearWanted(G) {
  G.police.heat = 0; G.police.stars = 0; G.police.hiddenTimer = 0;
  for (const c of G.police.cars) c.dead = true;
  for (const o of G.police.officers) o.alive = false;
  G.audio.siren(false);
}
