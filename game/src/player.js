// Player — one clear job: Cole Maddox on foot and behind the wheel.
// Movement, entering/exiting cars, stealing, punching and shooting.
import { PLAYER, CAR_TYPES } from './config.js';
import { resolveCircle, isWater, isSand, isRoad } from './world.js';
import { moveCar } from './traffic.js';

export function createPlayer(x, y) {
  return {
    x, y, angle: -Math.PI / 2, speed: 0, onFoot: true, car: null,
    health: PLAYER.health, money: 0, weapon: 'fists', ammo: 0,
    punchCd: 0, shootCd: 0, hurtCd: 0, dead: false, bustedTimer: 0,
    walkPhase: 0, aimAngle: -Math.PI / 2,
  };
}

// Nearest car to (x,y) within range, excluding police cars already chasing.
export function nearestCar(G, x, y, range) {
  let best = null, bestD = range;
  for (const c of G.cars) {
    if (c.isPolice && c.chasing) continue;
    const d = Math.hypot(c.x - x, c.y - y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function enterCar(G, car) {
  const p = G.player;
  p.onFoot = false; p.car = car;
  car.isPlayer = true; car.ai = null; car.driver = null;
  car.parked = false;
  G.audio.click();
}
export function exitCar(G) {
  const p = G.player;
  if (!p.car) return;
  const car = p.car;
  car.isPlayer = false;
  car.speed = 0;
  // Step out to the side of the car.
  const sx = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
  const sy = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
  p.x = sx; p.y = sy; p.angle = car.angle; p.onFoot = true; p.car = null;
  resolveCircle(G.world, p, PLAYER.radius);
  G.audio.click();
}

// Stealing a car is a crime: heat rises, and a nearby cop sees it.
export function stealCar(G, car) {
  enterCar(G, car);
  G.police.addHeat(G, 14);
  G.hud.flash('Car stolen — the law noticed.');
}

export function damagePlayer(G, amount) {
  const p = G.player;
  if (p.dead || p.hurtCd > 0) return;
  p.health -= amount;
  p.hurtCd = 0.45;
  G.camera.shake = Math.max(G.camera.shake, 7);
  if (p.health <= 0) {
    p.health = 0; p.dead = true;
    G.audio.explosion();
    G.state = 'gameover';
  }
}

function aimWorld(G) {
  const cam = G.camera;
  const m = G.input.mouse;
  return { x: cam.x + (m.x - G.view.w / 2) / cam.zoom, y: cam.y + (m.y - G.view.h / 2) / cam.zoom };
}

function shoot(G) {
  const p = G.player;
  if (p.ammo <= 0) { p.weapon = 'fists'; return; }
  p.ammo--;
  p.shootCd = PLAYER.pistolCooldown;
  const aim = aimWorld(G);
  const ang = Math.atan2(aim.y - p.y, aim.x - p.x);
  p.aimAngle = ang;
  G.audio.gunshot();
  G.particles.push({ kind: 'muzzle', x: p.x + Math.cos(ang) * 20, y: p.y + Math.sin(ang) * 20, life: 0.07, max: 0.07 });
  // Hitscan: first pedestrian, officer or car along the ray.
  const range = PLAYER.pistolRange;
  const ex = p.x + Math.cos(ang) * range, ey = p.y + Math.sin(ang) * range;
  let bestT = 1, target = null, targetKind = null;
  const test = (tx, ty, r, kind, obj) => {
    const dx = tx - p.x, dy = ty - p.y;
    const t = (dx * Math.cos(ang) + dy * Math.sin(ang)) / range;
    if (t < 0 || t > bestT) return;
    const px = p.x + Math.cos(ang) * range * t, py = p.y + Math.sin(ang) * range * t;
    if (Math.hypot(tx - px, ty - py) < r + 6) { bestT = t; target = obj; targetKind = kind; }
  };
  for (const ped of G.peds) if (ped.alive) test(ped.x, ped.y, 12, 'ped', ped);
  for (const off of G.police.officers) if (off.alive) test(off.x, off.y, 13, 'officer', off);
  for (const c of G.cars) if (!c.isPlayer) test(c.x, c.y, 26, 'car', c);
  const hx = p.x + Math.cos(ang) * range * bestT, hy = p.y + Math.sin(ang) * range * bestT;
  G.particles.push({ kind: 'tracer', x: p.x, y: p.y, x2: hx, y2: hy, life: 0.08, max: 0.08 });
  if (targetKind === 'ped') {
    target.alive = false; target.dead = true;
    G.police.addHeat(G, 18);
    G.particles.push({ kind: 'blood', x: target.x, y: target.y, life: 0.5, max: 0.5 });
  } else if (targetKind === 'officer') {
    target.alive = false; target.dead = true;
    G.police.addHeat(G, 26);
    G.particles.push({ kind: 'blood', x: target.x, y: target.y, life: 0.5, max: 0.5 });
  } else if (targetKind === 'car') {
    target.health -= PLAYER.pistolDamage;
    G.particles.push({ kind: 'spark', x: hx, y: hy, life: 0.25, max: 0.25 });
    if (target.health <= 0) explodeCar(G, target);
    else G.police.addHeat(G, 8);
  }
  G.particles.push({ kind: 'impact', x: hx, y: hy, life: 0.15, max: 0.15 });
}

export function explodeCar(G, car) {
  car.dead = true; car.exploded = true;
  G.audio.explosion();
  G.camera.shake = Math.max(G.camera.shake, 14);
  for (let i = 0; i < 26; i++) {
    const a = Math.random() * Math.PI * 2, s = 60 + Math.random() * 260;
    G.particles.push({ kind: 'fire', x: car.x, y: car.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + Math.random() * 0.5, max: 1 });
  }
  G.particles.push({ kind: 'smoke', x: car.x, y: car.y, life: 1.6, max: 1.6, big: true });
  G.particles.push({ kind: 'ring', x: car.x, y: car.y, life: 0.4, max: 0.4 });
  if (G.player.car === car) { G.player.car = null; G.player.onFoot = true; damagePlayer(G, 45); }
  G.police.addHeat(G, 10);
}

function punch(G) {
  const p = G.player;
  p.punchCd = PLAYER.punchCooldown;
  G.audio.punch();
  const ang = p.aimAngle;
  const hx = p.x + Math.cos(ang) * 26, hy = p.y + Math.sin(ang) * 26;
  G.particles.push({ kind: 'swipe', x: hx, y: hy, angle: ang, life: 0.12, max: 0.12 });
  for (const ped of G.peds) {
    if (!ped.alive) continue;
    if (Math.hypot(ped.x - p.x, ped.y - p.y) < PLAYER.punchRange + 8) {
      ped.alive = false; ped.dead = true;
      ped.flee = true;
      G.police.addHeat(G, 12);
    }
  }
  for (const off of G.police.officers) {
    if (!off.alive) continue;
    if (Math.hypot(off.x - p.x, off.y - p.y) < PLAYER.punchRange + 8) {
      off.health -= PLAYER.punchDamage;
      if (off.health <= 0) { off.alive = false; off.dead = true; G.police.addHeat(G, 22); }
    }
  }
}

export function updatePlayer(G, dt) {
  const p = G.player;
  const input = G.input;
  if (p.dead) return;
  p.punchCd = Math.max(0, p.punchCd - dt);
  p.shootCd = Math.max(0, p.shootCd - dt);
  p.hurtCd = Math.max(0, p.hurtCd - dt);

  if (!p.onFoot && p.car) {
    // --- Driving ---
    const car = p.car;
    const spec = CAR_TYPES[car.type];
    const axis = input.moveAxis();
    const accel = axis.y < 0 ? spec.accel : axis.y > 0 ? -spec.accel * 0.85 : 0;
    car.speed += accel * dt;
    // Drag + off-road slowdown.
    const offRoad = !isRoad(car.x, car.y) && !isSand(car.x, car.y);
    const drag = offRoad ? 1.6 : 0.55;
    car.speed -= car.speed * drag * dt;
    if (Math.abs(car.speed) < 4 && accel === 0) car.speed = 0;
    car.speed = Math.max(-spec.top * 0.38, Math.min(spec.top, car.speed));
    const steer = axis.x;
    const steerAuthority = Math.min(1, Math.abs(car.speed) / 120);
    car.angle += steer * spec.grip * steerAuthority * (car.speed >= 0 ? 1 : -1) * dt;
    const handbrake = input.down('Space');
    if (handbrake && Math.abs(car.speed) > 60) {
      car.speed -= car.speed * 2.2 * dt;
      G.skids.push({ x: car.x, y: car.y, angle: car.angle, life: 2.2, max: 2.2 });
      if (Math.random() < dt * 8) G.particles.push({ kind: 'smoke', x: car.x, y: car.y, life: 0.5, max: 0.5 });
    }
    moveCar(G, car, dt);
    p.x = car.x; p.y = car.y; p.angle = car.angle;
    G.audio.engine(Math.abs(car.speed) / spec.top, true);
    // Exit the car.
    if (input.wasPressed('KeyE')) exitCar(G);
    // Horn.
    if (input.wasPressed('KeyH')) G.audio.blip(330, 0.18, 'square', 0.12);
    return;
  }

  // --- On foot ---
  G.audio.engine(0, false);
  const axis = input.moveAxis();
  const sprint = input.sprint();
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  let mx = axis.x, my = axis.y;
  const len = Math.hypot(mx, my);
  if (len > 0) { mx /= len; my /= len; }
  p.x += mx * speed * dt;
  p.y += my * speed * dt;
  p.speed = len > 0 ? speed : 0;
  if (len > 0) {
    p.walkPhase += dt * (sprint ? 13 : 9);
    // Face movement, unless aiming with the mouse (pistol out).
    if (p.weapon !== 'pistol' || !input.mouse.down) p.angle = Math.atan2(my, mx);
  }
  resolveCircle(G.world, p, PLAYER.radius);
  if (isWater(p.x, p.y)) { p.y = 2700 - PLAYER.radius - 1; }
  // Aim with the mouse when the pistol is out.
  if (p.weapon === 'pistol') {
    const aim = aimWorld(G);
    p.aimAngle = Math.atan2(aim.y - p.y, aim.x - p.x);
    if (input.mouse.down || input.down('Space')) p.angle = p.aimAngle;
  } else {
    p.aimAngle = p.angle;
  }
  // Enter a car.
  if (input.wasPressed('KeyE')) {
    const car = nearestCar(G, p.x, p.y, 78);
    if (car) {
      if (car.isTraffic) stealCar(G, car);
      else enterCar(G, car);
    }
  }
  // Attack.
  if (input.wasPressed('Space') || (p.weapon === 'pistol' && input.mouse.clicked)) {
    if (p.weapon === 'pistol' && p.shootCd <= 0) shoot(G);
    else if (p.punchCd <= 0) punch(G);
  }
  // Switch weapon.
  if (input.wasPressed('KeyQ')) {
    if (p.weapon === 'fists' && p.ammo > 0) { p.weapon = 'pistol'; G.audio.click(); }
    else if (p.weapon === 'pistol') { p.weapon = 'fists'; G.audio.click(); }
  }
  // Pickups (pistol, cash, health).
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    if (Math.hypot(pk.x - p.x, pk.y - p.y) < 34) {
      pk.taken = true;
      if (pk.kind === 'pistol') { p.weapon = 'pistol'; p.ammo += 48; G.hud.flash('Picked up a pistol — Q to holster, click to shoot.'); }
      else if (pk.kind === 'cash') { p.money += pk.amount; G.hud.flash(`+$${pk.amount}`); G.audio.cash(); }
      else if (pk.kind === 'health') { p.health = Math.min(PLAYER.health, p.health + 50); G.hud.flash('Health +50'); }
      G.audio.pickup();
    }
  }
}
