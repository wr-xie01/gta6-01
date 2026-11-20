// Render — one clear job: draw the world, the cars, the people, the effects,
// and the minimap. Top-down, sun-soaked Solmar Bay: warm light, long shadows.
import { WORLD_W, WORLD_H, ROAD_W, ROAD_X, ROAD_Y, BEACH_Y, WATER_Y, PARK, MARINA, COLORS, CAR_TYPES } from './config.js';
import { isRoad, isSand } from './world.js';

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCarShape(ctx, car) {
  const spec = CAR_TYPES[car.type];
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = COLORS.carShadow;
  roundRect(ctx, -spec.len / 2 + 3, -spec.wid / 2 + 4, spec.len, spec.wid, 8);
  ctx.fill();
  // Wheels.
  ctx.fillStyle = '#16181c';
  const wy = spec.wid / 2 - 2;
  for (const [wx, wyy] of [[-spec.len / 2 + 8, -wy], [spec.len / 2 - 10, -wy], [-spec.len / 2 + 8, wy], [spec.len / 2 - 10, wy]]) {
    roundRect(ctx, wx, wyy - 4, 12, 8, 2); ctx.fill();
  }
  // Body.
  ctx.fillStyle = car.color;
  roundRect(ctx, -spec.len / 2, -spec.wid / 2, spec.len, spec.wid, 9);
  ctx.fill();
  // Hood + trunk shading.
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  roundRect(ctx, spec.len / 2 - 16, -spec.wid / 2 + 3, 13, spec.wid - 6, 5);
  ctx.fill();
  // Windshield + rear window.
  ctx.fillStyle = 'rgba(20,30,44,0.85)';
  roundRect(ctx, 2, -spec.wid / 2 + 3, 12, spec.wid - 6, 4); ctx.fill();
  roundRect(ctx, -spec.len / 2 + 6, -spec.wid / 2 + 3, 8, spec.wid - 6, 4); ctx.fill();
  // Roof.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  roundRect(ctx, -8, -spec.wid / 2 + 4, 16, spec.wid - 8, 5); ctx.fill();
  // Taxi sign / police livery.
  if (car.type === 'taxi') {
    ctx.fillStyle = '#111';
    ctx.fillRect(-4, -6, 8, 12);
    ctx.fillStyle = '#f7b731';
    ctx.font = 'bold 7px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('TAXI', 0, -spec.wid / 2 - 8);
  }
  if (car.type === 'police') {
    ctx.fillStyle = '#e8e8e8';
    ctx.fillRect(-spec.len / 2 + 2, -spec.wid / 2, 4, spec.wid);
    ctx.fillRect(spec.len / 2 - 6, -spec.wid / 2, 4, spec.wid);
    // Light bar, flashing.
    const t = performance.now() / 240;
    ctx.fillStyle = Math.floor(t) % 2 === 0 ? '#ff2d2d' : '#2d7dff';
    ctx.fillRect(-2, -spec.wid / 2 - 1, 5, 6);
    ctx.fillStyle = Math.floor(t) % 2 === 0 ? '#2d7dff' : '#ff2d2d';
    ctx.fillRect(-2, spec.wid / 2 - 5, 5, 6);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('POLICE', 0, 0);
  }
  // Headlights (front) and tail lights.
  ctx.fillStyle = '#fff8c9';
  ctx.fillRect(spec.len / 2 - 2, -spec.wid / 2 + 2, 3, 5);
  ctx.fillRect(spec.len / 2 - 2, spec.wid / 2 - 7, 3, 5);
  ctx.fillStyle = '#ff3b30';
  ctx.fillRect(-spec.len / 2 - 1, -spec.wid / 2 + 2, 3, 5);
  ctx.fillRect(-spec.len / 2 - 1, spec.wid / 2 - 7, 3, 5);
  // Damage smoke.
  if (car.health < 45 && !car.dead) {
    ctx.fillStyle = 'rgba(60,60,60,0.5)';
    ctx.beginPath(); ctx.arc(-spec.len / 4, -spec.wid / 4, 6 + Math.random() * 4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

function drawPerson(ctx, x, y, angle, color, walkPhase, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = COLORS.carShadow;
  ctx.beginPath(); ctx.ellipse(2, 3, 11 * scale, 7 * scale, 0, 0, Math.PI * 2); ctx.fill();
  // Body (shoulders) + head.
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, 0, 9 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#f2c89b';
  ctx.beginPath(); ctx.arc(3 * scale, 0, 5 * scale, 0, Math.PI * 2); ctx.fill();
  // Feet (two dots that alternate while walking).
  const s = Math.sin(walkPhase) * 4 * scale;
  ctx.fillStyle = '#222';
  ctx.beginPath(); ctx.arc(-6 * scale, s, 2.6 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(-6 * scale, -s, 2.6 * scale, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawTree(ctx, t, time) {
  const sway = Math.sin(time * 0.001 + t.x * 0.01) * 2;
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.fillStyle = COLORS.carShadow;
  ctx.beginPath(); ctx.ellipse(3, 4, 12 * t.s, 7 * t.s, 0, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8a6b4a'; ctx.lineWidth = 4 * t.s; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(sway, -16 * t.s); ctx.stroke();
  ctx.fillStyle = t.palm ? '#2f9e4f' : '#3f8f3a';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    ctx.beginPath();
    ctx.ellipse(sway + Math.cos(a) * 10 * t.s, -16 * t.s + Math.sin(a) * 7 * t.s, 11 * t.s, 4.5 * t.s, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

export function render(G) {
  const ctx = G.ctx;
  const cam = G.camera;
  const view = G.view;
  const time = G.time;
  ctx.clearRect(0, 0, view.w, view.h);
  // Camera transform (with shake).
  const shakeX = (Math.random() - 0.5) * cam.shake;
  const shakeY = (Math.random() - 0.5) * cam.shake;
  ctx.save();
  ctx.translate(view.w / 2, view.h / 2);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x + shakeX, -cam.y + shakeY);
  const vx0 = cam.x - view.w / 2 / cam.zoom - 60, vy0 = cam.y - view.h / 2 / cam.zoom - 60;
  const vx1 = cam.x + view.w / 2 / cam.zoom + 60, vy1 = cam.y + view.h / 2 / cam.zoom + 60;
  // Ground: grass.
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(vx0, vy0, vx1 - vx0, vy1 - vy0);
  // Beach sand + water.
  ctx.fillStyle = COLORS.sand;
  ctx.fillRect(Math.max(vx0, 0), BEACH_Y, Math.min(vx1, WORLD_W) - Math.max(vx0, 0), WATER_Y - BEACH_Y);
  ctx.fillStyle = COLORS.water;
  ctx.fillRect(Math.max(vx0, 0), WATER_Y, Math.min(vx1, WORLD_W) - Math.max(vx0, 0), WORLD_H - WATER_Y);
  // Animated wave lines.
  ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
  for (let i = 0; i < 3; i++) {
    const wy = WATER_Y + 14 + i * 26 + Math.sin(time * 0.7 + i * 2) * 4;
    ctx.beginPath(); ctx.moveTo(Math.max(vx0, 0), wy);
    for (let x = Math.max(vx0, 0); x < Math.min(vx1, WORLD_W); x += 60) ctx.lineTo(x, wy + Math.sin(x * 0.02 + time + i) * 3);
    ctx.stroke();
  }
  // Park.
  ctx.fillStyle = COLORS.grassDark;
  ctx.fillRect(PARK.x, PARK.y, PARK.w, PARK.h);
  ctx.fillStyle = COLORS.parkPath;
  ctx.fillRect(PARK.x + PARK.w / 2 - 14, PARK.y, 28, PARK.h);
  ctx.fillRect(PARK.x, PARK.y + PARK.h / 2 - 14, PARK.w, 28);
  ctx.beginPath(); ctx.arc(PARK.x + PARK.w / 2, PARK.y + PARK.h / 2, 90, 0, Math.PI * 2); ctx.fill();
  // Marina (docks + water).
  ctx.fillStyle = '#3a6b8a';
  ctx.fillRect(MARINA.x, MARINA.y, MARINA.w, MARINA.h);
  ctx.fillStyle = '#8a6b4a';
  for (let i = 0; i < 4; i++) ctx.fillRect(MARINA.x + 20 + i * 110, MARINA.y + 30, 70, 14);
  // Roads: asphalt + sidewalks + lane markings.
  for (const ry of ROAD_Y) {
    ctx.fillStyle = COLORS.sidewalk;
    ctx.fillRect(0, ry - ROAD_W / 2 - 14, WORLD_W, ROAD_W + 28);
    ctx.fillStyle = COLORS.road;
    ctx.fillRect(0, ry - ROAD_W / 2, WORLD_W, ROAD_W);
  }
  for (const rx of ROAD_X) {
    ctx.fillStyle = COLORS.sidewalk;
    ctx.fillRect(rx - ROAD_W / 2 - 14, 0, ROAD_W + 28, BEACH_Y);
    ctx.fillStyle = COLORS.road;
    ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, BEACH_Y);
  }
  // Lane dashes.
  ctx.fillStyle = COLORS.lane;
  for (const ry of ROAD_Y) for (let x = 40; x < WORLD_W; x += 90) ctx.fillRect(x, ry - 2, 44, 4);
  for (const rx of ROAD_X) for (let y = 40; y < BEACH_Y; y += 90) ctx.fillRect(rx - 2, y, 4, 44);
  // Buildings.
  for (const b of G.world.buildings) {
    if (b.x > vx1 || b.x + b.w < vx0 || b.y > vy1 || b.y + b.h < vy0) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + b.height * 0.5, b.y + b.height * 0.7, b.w, b.h);
    ctx.fillStyle = b.wall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    if (b.windows) {
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      for (let wx = b.x + 14; wx < b.x + b.w - 14; wx += 26) for (let wy = b.y + 14; wy < b.y + b.h - 14; wy += 26) ctx.fillRect(wx, wy, 10, 8);
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 2;
    ctx.strokeRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
  }
  // Lamps.
  ctx.fillStyle = '#3a3a3a';
  for (const l of G.world.lamps) {
    if (l.x < vx0 || l.x > vx1 || l.y < vy0 || l.y > vy1) continue;
    ctx.fillRect(l.x - 2, l.y - 2, 4, 4);
  }
  // Skid marks.
  for (const s of G.skids) {
    ctx.strokeStyle = `rgba(20,20,20,${(s.life / s.max) * 0.55})`;
    ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(s.angle) * 18, s.y - Math.sin(s.angle) * 18);
    ctx.lineTo(s.x + Math.cos(s.angle) * 18, s.y + Math.sin(s.angle) * 18);
    ctx.stroke();
  }
  // Trees.
  for (const t of G.world.trees) {
    if (t.x < vx0 || t.x > vx1 || t.y < vy0 || t.y > vy1) continue;
    drawTree(ctx, t, time);
  }
  // Pickups.
  for (const pk of G.pickups) {
    if (pk.taken) continue;
    if (pk.x < vx0 || pk.x > vx1 || pk.y < vy0 || pk.y > vy1) continue;
    const pulse = 1 + Math.sin(time * 4 + pk.x) * 0.15;
    ctx.save(); ctx.translate(pk.x, pk.y); ctx.scale(pulse, pulse);
    if (pk.kind === 'package') {
      ctx.fillStyle = '#f39c12';
      roundRect(ctx, -13, -11, 26, 22, 3); ctx.fill();
      ctx.fillStyle = '#7e5109'; ctx.fillRect(-13, -3, 26, 5);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, 1);
    } else if (pk.kind === 'pistol') {
      ctx.fillStyle = '#222'; ctx.fillRect(-12, -3, 24, 6); ctx.fillRect(2, 2, 6, 8);
    } else if (pk.kind === 'cash') {
      ctx.fillStyle = '#2ecc71'; roundRect(ctx, -12, -8, 24, 16, 2); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('$', 0, 1);
    } else if (pk.kind === 'health') {
      ctx.fillStyle = '#fff'; roundRect(ctx, -11, -11, 22, 22, 4); ctx.fill();
      ctx.fillStyle = '#e74c3c'; ctx.fillRect(-3, -8, 6, 16); ctx.fillRect(-8, -3, 16, 6);
    }
    ctx.restore();
  }
  // Mission marker: pulsing beacon + diamond.
  if (G.missions.marker) {
    const mk = G.missions.marker;
    const pulse = 0.5 + Math.sin(time * 5) * 0.3;
    ctx.fillStyle = `rgba(241,196,15,${0.10 + pulse * 0.10})`;
    ctx.beginPath(); ctx.arc(mk.x, mk.y, 70 + pulse * 18, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(241,196,15,${0.5 + pulse * 0.4})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(mk.x, mk.y, 44, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#f1c40f';
    ctx.save(); ctx.translate(mk.x, mk.y); ctx.rotate(Math.PI / 4);
    ctx.fillRect(-11, -11, 22, 22); ctx.restore();
    ctx.fillStyle = '#7e5109';
    ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', mk.x, mk.y);
  }
  // Cars (traffic + police + player's car), then pedestrians, then the player.
  for (const car of G.cars) {
    if (car.dead) continue;
    if (car.x < vx0 - 80 || car.x > vx1 + 80 || car.y < vy0 - 80 || car.y > vy1 + 80) continue;
    drawCarShape(ctx, car);
  }
  for (const ped of G.peds) {
    if (!ped.alive) continue;
    if (ped.x < vx0 || ped.x > vx1 || ped.y < vy0 || ped.y > vy1) continue;
    drawPerson(ctx, ped.x, ped.y, ped.angle, ped.color, G.time * 8 + ped.id);
  }
  for (const off of G.police.officers) {
    if (!off.alive) continue;
    if (off.x < vx0 || off.x > vx1 || off.y < vy0 || off.y > vy1) continue;
    drawPerson(ctx, off.x, off.y, off.angle, '#1a2a6c', off.walkPhase, 1.05);
    // Badge dot.
    ctx.fillStyle = '#ffd700';
    ctx.beginPath(); ctx.arc(off.x + Math.cos(off.angle) * 6, off.y + Math.sin(off.angle) * 6, 2.5, 0, Math.PI * 2); ctx.fill();
  }
  // Player on foot.
  const p = G.player;
  if (p.onFoot && !p.dead) {
    drawPerson(ctx, p.x, p.y, p.angle, '#e67e22', p.walkPhase);
    // Pistol in hand.
    if (p.weapon === 'pistol') {
      ctx.strokeStyle = '#222'; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(p.aimAngle) * 8, p.y + Math.sin(p.aimAngle) * 8);
      ctx.lineTo(p.x + Math.cos(p.aimAngle) * 20, p.y + Math.sin(p.aimAngle) * 20);
      ctx.stroke();
    }
  }
  // Particles.
  for (const pt of G.particles) {
    const a = Math.max(0, pt.life / pt.max);
    if (pt.kind === 'fire') {
      ctx.fillStyle = `rgba(255,${120 + ((a * 120) | 0)},20,${a})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 5 + (1 - a) * 12, 0, Math.PI * 2); ctx.fill();
    } else if (pt.kind === 'smoke') {
      ctx.fillStyle = `rgba(70,70,70,${a * 0.45})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, (pt.big ? 26 : 10) + (1 - a) * 22, 0, Math.PI * 2); ctx.fill();
    } else if (pt.kind === 'spark') {
      ctx.fillStyle = `rgba(255,220,80,${a})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 4 * a + 1, 0, Math.PI * 2); ctx.fill();
    } else if (pt.kind === 'blood') {
      ctx.fillStyle = `rgba(160,20,20,${a * 0.8})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 9, 0, Math.PI * 2); ctx.fill();
    } else if (pt.kind === 'muzzle') {
      ctx.fillStyle = `rgba(255,240,150,${a})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 9 * a + 2, 0, Math.PI * 2); ctx.fill();
    } else if (pt.kind === 'tracer') {
      ctx.strokeStyle = `rgba(255,240,150,${a})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x2, pt.y2); ctx.stroke();
    } else if (pt.kind === 'ring') {
      ctx.strokeStyle = `rgba(255,180,60,${a})`; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, (1 - a) * 90 + 10, 0, Math.PI * 2); ctx.stroke();
    } else if (pt.kind === 'swipe') {
      ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 16, pt.angle - 0.9, pt.angle + 0.9); ctx.stroke();
    } else if (pt.kind === 'impact') {
      ctx.fillStyle = `rgba(255,255,255,${a * 0.7})`;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, 4 * a + 1, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
  // Warm sunset wash + vignette (screen space).
  const grad = ctx.createRadialGradient(view.w / 2, view.h / 2, Math.min(view.w, view.h) * 0.35, view.w / 2, view.h / 2, Math.max(view.w, view.h) * 0.75);
  grad.addColorStop(0, 'rgba(255,170,80,0)');
  grad.addColorStop(0.75, 'rgba(255,140,60,0.05)');
  grad.addColorStop(1, 'rgba(40,20,60,0.28)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, view.w, view.h);
}

// --- Minimap: a small canvas the HUD owns. ---
export function drawMinimap(G, mctx, w, h) {
  const sx = w / WORLD_W, sy = h / WORLD_H;
  mctx.clearRect(0, 0, w, h);
  mctx.fillStyle = '#5d8a4a';
  mctx.fillRect(0, 0, w, h);
  // Water + sand.
  mctx.fillStyle = '#2e7fa8';
  mctx.fillRect(0, WATER_Y * sy, w, (WORLD_H - WATER_Y) * sy);
  mctx.fillStyle = '#e8d39a';
  mctx.fillRect(0, BEACH_Y * sy, w, (WATER_Y - BEACH_Y) * sy);
  // Park.
  mctx.fillStyle = '#4e7a38';
  mctx.fillRect(PARK.x * sx, PARK.y * sy, PARK.w * sx, PARK.h * sy);
  // Roads.
  mctx.fillStyle = '#3a3d44';
  for (const rx of ROAD_X) mctx.fillRect(rx * sx - 1, 0, 2, BEACH_Y * sy);
  for (const ry of ROAD_Y) mctx.fillRect(0, ry * sy - 1, w, 2);
  // Buildings.
  mctx.fillStyle = 'rgba(60,50,40,0.8)';
  for (const b of G.world.buildings) mctx.fillRect(b.x * sx, b.y * sy, Math.max(1, b.w * sx), Math.max(1, b.h * sy));
  // Mission marker.
  if (G.missions.marker) {
    const mk = G.missions.marker;
    mctx.fillStyle = '#f1c40f';
    mctx.save(); mctx.translate(mk.x * sx, mk.y * sy); mctx.rotate(Math.PI / 4);
    mctx.fillRect(-4, -4, 8, 8); mctx.restore();
  }
  // Traffic cars (white dots), police (flashing red/blue), player (arrow).
  mctx.fillStyle = '#fff';
  for (const c of G.cars) {
    if (c.dead || c.isPlayer || c.isPolice) continue;
    mctx.fillRect(c.x * sx - 1, c.y * sy - 1, 2, 2);
  }
  const flash = Math.floor(G.time * 3) % 2 === 0;
  mctx.fillStyle = flash ? '#ff2d2d' : '#2d7dff';
  for (const c of G.police.cars) mctx.fillRect(c.x * sx - 2, c.y * sy - 2, 4, 4);
  for (const o of G.police.officers) {
    if (!o.alive) continue;
    mctx.fillRect(o.x * sx - 1, o.y * sy - 1, 2, 2);
  }
  const p = G.player;
  mctx.save();
  mctx.translate(p.x * sx, p.y * sy);
  mctx.rotate(p.angle);
  mctx.fillStyle = p.car ? '#f1c40f' : '#ff8c1a';
  mctx.beginPath(); mctx.moveTo(6, 0); mctx.lineTo(-4, -4); mctx.lineTo(-4, 4); mctx.closePath(); mctx.fill();
  mctx.restore();
  // Border.
  mctx.strokeStyle = 'rgba(255,255,255,0.5)'; mctx.lineWidth = 1;
  mctx.strokeRect(0.5, 0.5, w - 1, h - 1);
}
