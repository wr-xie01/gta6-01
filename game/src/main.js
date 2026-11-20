// Main — one clear job: own the game object, the loop, the camera, the HUD
// and the screens, and wire every module together.
import { createWorld, nearestRoadPoint } from './world.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createPlayer, updatePlayer } from './player.js';
import { createCar, spawnTraffic, spawnPeds, spawnParkedCars, updateTraffic } from './traffic.js';
import { createPolice, addHeat, updatePolice, clearWanted } from './police.js';
import { createMissions, updateMissions, startNextMission, startMission, nextMissionIndex } from './missions.js';
import { createSave } from './save.js';
import { render, drawMinimap } from './render.js';
import { applyShot } from './shots.js';
import { WORLD_W, WORLD_H, MARINA, CAR_TYPES } from './config.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');
const ctx = canvas.getContext('2d');
const minimapCanvas = $('minimap');
const mctx = minimapCanvas.getContext('2d');

function fitCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
fitCanvas();
window.addEventListener('resize', fitCanvas);

const G = {
  canvas, ctx, view: { w: canvas.width, h: canvas.height },
  world: null, player: null, cars: [], peds: [], pickups: [],
  particles: [], skids: [],
  police: null, missions: null, audio: null, input: null, save: null,
  camera: { x: 0, y: 0, zoom: 0.62, shake: 0 },
  state: 'start', time: 0, pausedFrom: null,
  stats: { best: {} },
  hud: { flashText: '', flashUntil: 0, bannerText: '', bannerUntil: 0,
    flash(msg) { this.flashText = msg; this.flashUntil = G.time + 3; },
    banner(msg) { this.bannerText = msg; this.bannerUntil = G.time + 3.5; },
  },
};
window.__game = G; // exposed for automated play-testing

function newGame() {
  G.world = createWorld();
  G.player = createPlayer(MARINA.x + 120, MARINA.y + 60);
  G.cars = []; G.peds = []; G.pickups = []; G.particles = []; G.skids = [];
  G.police = createPolice();
  G.missions = createMissions();
  G.stats = { best: {} };
  // A starter car parked by the marina, plus city life and pickups.
  const starter = createCar('sedan', MARINA.x + 60, MARINA.y + 120, Math.PI / 2, { parked: true, color: '#3498db' });
  G.cars.push(starter);
  spawnTraffic(G, 14);
  spawnPeds(G, 26);
  spawnParkedCars(G, 8);
  scatterPickups();
  G.camera.x = G.player.x; G.camera.y = G.player.y; G.camera.shake = 0;
  G.time = 0;
}

function scatterPickups() {
  const spots = [
    { kind: 'pistol', x: 990, y: 2350 }, { kind: 'cash', x: 594, y: 594 },
    { kind: 'health', x: 1782, y: 1782 }, { kind: 'cash', x: 2574, y: 990 },
    { kind: 'health', x: 1386, y: 594 }, { kind: 'pistol', x: 2970, y: 2178 },
    { kind: 'cash', x: 3366, y: 1386 }, { kind: 'health', x: 594, y: 2178 },
    { kind: 'cash', x: 2178, y: 2538 }, { kind: 'pistol', x: 990, y: 1386 },
  ];
  for (const s of spots) G.pickups.push({ ...s, amount: s.kind === 'cash' ? 40 + ((Math.random() * 60) | 0) : 0, taken: false });
}

G.audio = createAudio();
G.input = createInput(canvas);
G.save = createSave();
newGame();

// --- Screens ---
const screens = ['start-screen', 'pause-screen', 'gameover-screen', 'busted-screen', 'missionfailed-screen', 'storydone-screen', 'help-screen', 'missions-screen'];
function showScreen(id) {
  for (const s of screens) $(s).classList.toggle('hidden', s !== id);
  $('hud').classList.toggle('hidden', id !== null && id !== 'help-screen' && id !== 'missions-screen' ? false : id === null);
  if (id === null) $('hud').classList.remove('hidden');
}
function hideScreens() { for (const s of screens) $(s).classList.add('hidden'); $('hud').classList.remove('hidden'); }

function startPlaying(fresh) {
  if (fresh) { newGame(); }
  G.state = 'play';
  hideScreens();
  G.audio.unlock();
  G.audio.startMusic();
  if (fresh) {
    // Offer the first mission right away via the dialogue box.
    G.missions.dialogue = [['Lena', 'Cole. You actually came back. Press M to see the jobs I have for you — or just drive. The city is yours.']];
    G.missions.dialogueIndex = 0;
    G.missions.dialogueTimer = 0;
  }
}

$('btn-start').addEventListener('click', () => startPlaying(true));
$('btn-continue').addEventListener('click', () => {
  const d = G.save.load();
  if (d) {
    G.player.money = d.money || 0;
    G.missions.completed = (d.completed || []).slice();
    G.stats.best = d.best || {};
  }
  startPlaying(false);
});
$('btn-help-start').addEventListener('click', () => { G.pausedFrom = 'start-screen'; showScreen('help-screen'); });
$('btn-resume').addEventListener('click', () => { G.state = 'play'; hideScreens(); });
$('btn-missions').addEventListener('click', () => { renderMissionList(); G.pausedFrom = 'pause-screen'; showScreen('missions-screen'); });
$('btn-help-pause').addEventListener('click', () => { G.pausedFrom = 'pause-screen'; showScreen('help-screen'); });
$('btn-quit').addEventListener('click', () => { newGame(); G.state = 'start'; refreshStartScreen(); showScreen('start-screen'); });
$('btn-retry').addEventListener('click', () => startPlaying(true));
$('btn-title-go').addEventListener('click', () => { newGame(); G.state = 'start'; refreshStartScreen(); showScreen('start-screen'); });
$('btn-busted').addEventListener('click', () => {
  G.player.money = Math.max(0, G.player.money - 200);
  G.player.health = 100; G.player.dead = false;
  clearWanted(G);
  // Drop the player at the marina, on foot.
  G.player.car = null; G.player.onFoot = true;
  G.player.x = MARINA.x + 120; G.player.y = MARINA.y + 60;
  G.camera.x = G.player.x; G.camera.y = G.player.y;
  G.state = 'play'; hideScreens();
});
$('btn-title-busted').addEventListener('click', () => { newGame(); G.state = 'start'; refreshStartScreen(); showScreen('start-screen'); });
$('btn-retry-mission').addEventListener('click', () => {
  const i = nextMissionIndex(G);
  G.state = 'play'; hideScreens();
  if (i >= 0) startMission(G, i);
});
$('btn-free-roam').addEventListener('click', () => { G.state = 'play'; hideScreens(); });
$('btn-freeroam').addEventListener('click', () => { G.state = 'play'; hideScreens(); });
$('btn-title-sd').addEventListener('click', () => { newGame(); G.state = 'start'; refreshStartScreen(); showScreen('start-screen'); });
$('btn-help-close').addEventListener('click', () => {
  if (G.pausedFrom === 'pause-screen') showScreen('pause-screen');
  else if (G.pausedFrom === 'missions-screen') showScreen('missions-screen');
  else if (G.state === 'play') hideScreens();
  else showScreen('start-screen');
});
$('btn-missions-close').addEventListener('click', () => {
  if (G.pausedFrom === 'pause-screen') showScreen('pause-screen');
  else if (G.state === 'play') hideScreens();
  else showScreen('start-screen');
});

function refreshStartScreen() {
  const d = G.save.load();
  const cont = $('btn-continue');
  const line = $('save-line');
  if (d && (d.money > 0 || (d.completed && d.completed.length > 0))) {
    cont.classList.remove('hidden');
    line.textContent = `Saved progress: $${d.money} · ${d.completed.length}/5 missions done · best ${d.best && d.best.mostMoney ? '$' + d.best.mostMoney : '—'}.`;
  } else {
    cont.classList.add('hidden');
    line.textContent = '';
  }
}
refreshStartScreen();

function renderMissionList() {
  const el = $('mission-list');
  el.innerHTML = '';
  G.missions.list.forEach((m, i) => {
    const done = G.missions.completed.includes(m.id);
    const div = document.createElement('div');
    div.className = 'm' + (done ? ' done' : '');
    div.innerHTML = `<span class="t">${done ? '✓ ' : ''}${i + 1}. ${m.title}</span><span class="r">$${m.reward}</span><div class="d">${m.brief[0][1]}</div>`;
    if (!done && G.state === 'play') {
      const b = document.createElement('button');
      b.className = 'btn'; b.style.padding = '8px 18px'; b.style.fontSize = '14px';
      b.textContent = 'Start this mission';
      b.addEventListener('click', () => { startMission(G, i); hideScreens(); G.state = 'play'; });
      div.appendChild(b);
    }
    el.appendChild(div);
  });
}

// --- HUD ---
function updateHUD() {
  const p = G.player;
  // Stars.
  let starsHtml = '';
  for (let i = 0; i < 5; i++) starsHtml += `<span class="${i < G.police.stars ? '' : 'off'}">★</span>`;
  $('stars').innerHTML = starsHtml;
  // Health.
  const hf = $('healthfill');
  hf.style.width = Math.max(0, p.health) + '%';
  hf.classList.toggle('low', p.health < 35);
  // Money.
  $('money').textContent = '$' + p.money;
  // Objective + mission timer.
  $('objective-text').textContent = G.missions.objective;
  $('missiontimer').textContent = G.missions.missionTimer > 0 ? `⏱ ${Math.ceil(G.missions.missionTimer)}s left` : '';
  // Dialogue.
  const m = G.missions;
  if (m.dialogueIndex < m.dialogue.length) {
    $('dialogue').classList.remove('hidden');
    $('dlg-speaker').textContent = m.dialogue[m.dialogueIndex][0];
    $('dlg-line').textContent = m.dialogue[m.dialogueIndex][1];
  } else $('dialogue').classList.add('hidden');
  // Flash / banner.
  $('flash').textContent = G.time < G.hud.flashUntil ? G.hud.flashText : '';
  $('banner').textContent = G.time < G.hud.bannerUntil ? G.hud.bannerText : '';
  // Speedo.
  if (!p.onFoot && p.car) {
    $('speedo').classList.remove('hidden');
    $('speed').textContent = Math.round(Math.abs(p.car.speed) * 0.36);
    $('carname').textContent = CAR_TYPES[p.car.type].name + (p.car.health < 45 ? ' · SMOKING' : '');
  } else $('speedo').classList.add('hidden');
  // Minimap.
  drawMinimap(G, mctx, minimapCanvas.width, minimapCanvas.height);
}

// --- Camera ---
function updateCamera(dt) {
  const p = G.player;
  const tx = p.x, ty = p.y;
  G.camera.x += (tx - G.camera.x) * Math.min(1, dt * 4);
  G.camera.y += (ty - G.camera.y) * Math.min(1, dt * 4);
  // Keep the camera inside the world.
  const vw = canvas.width / 2 / G.camera.zoom, vh = canvas.height / 2 / G.camera.zoom;
  G.camera.x = Math.max(vw - 100, Math.min(WORLD_W - vw + 100, G.camera.x));
  G.camera.y = Math.max(vh - 100, Math.min(WORLD_H - vh + 100, G.camera.y));
  G.camera.shake = Math.max(0, G.camera.shake - dt * 22);
}

// --- Main loop ---
let last = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.05) dt = 0.05;
  G.view.w = canvas.width; G.view.h = canvas.height;
  if (G.state === 'play') {
    G.time += dt;
    updatePlayer(G, dt);
    updateTraffic(G, dt);
    updatePolice(G, dt);
    updateMissions(G, dt);
    updateCamera(dt);
    // Particles.
    for (const pt of G.particles) {
      pt.life -= dt;
      if (pt.vx) { pt.x += pt.vx * dt; pt.y += pt.vy * dt; }
    }
    G.particles = G.particles.filter((pt) => pt.life > 0);
    // Skids fade.
    for (const s of G.skids) s.life -= dt;
    G.skids = G.skids.filter((s) => s.life > 0);
    // Keyboard shortcuts.
    if (G.input.wasPressed('KeyP') || G.input.wasPressed('Escape')) {
      G.state = 'paused';
      $('pause-money').textContent = '$' + G.player.money;
      $('pause-missions').textContent = `${G.missions.completed.length}/5`;
      $('pause-stars').textContent = G.police.stars;
      showScreen('pause-screen');
    }
    if (G.input.wasPressed('KeyH')) { G.pausedFrom = null; showScreen('help-screen'); }
    if (G.input.wasPressed('KeyM')) { renderMissionList(); G.pausedFrom = null; showScreen('missions-screen'); }
    // State transitions from gameplay.
    if (G.state === 'gameover') {
      $('go-money').textContent = '$' + G.player.money;
      $('go-missions').textContent = `${G.missions.completed.length}/5`;
      showScreen('gameover-screen');
    } else if (G.state === 'busted') {
      showScreen('busted-screen');
    } else if (G.state === 'missionfailed') {
      $('fail-reason').textContent = G.missions.failReason || 'The job fell apart.';
      showScreen('missionfailed-screen');
    } else if (G.state === 'storydone') {
      $('sd-money').textContent = '$' + G.player.money;
      showScreen('storydone-screen');
    }
    G.input.endFrame();
  }
  // Always render (so the start screen shows the city behind it).
  if (G.state !== 'start') render(G);
  else {
    // Slow cinematic pan over the city on the title screen.
    G.time += dt;
    G.camera.x = 1800 + Math.sin(G.time * 0.03) * 700;
    G.camera.y = 1400 + Math.cos(G.time * 0.023) * 500;
    render(G);
  }
  if (G.state === 'play' || G.state === 'paused') updateHUD();
}

// ?shot= support for screenshots: start the game in a staged scene.
const params = new URLSearchParams(location.search);
const shot = params.get('shot');
if (shot) {
  applyShot(G, shot);
  hideScreens();
  G.state = 'play';
  G.audio.muted = true;
} else {
  showScreen('start-screen');
}
requestAnimationFrame(frame);
