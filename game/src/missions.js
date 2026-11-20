// Missions — one clear job: the story, the five jobs, and the objective tracker.
// Each mission is a list of steps. A step is one of: goto (walk/drive to a marker),
// driveTo (reach it in a car), collect (grab N packages), wait (hold a spot),
// survive (stay alive T seconds), loseCops (drop the wanted level to zero),
// stealCar (get into a marked car). Dialogue plays in the HUD's dialogue box.
import { MARINA, PARK } from './config.js';
import { createCar } from './traffic.js';

const BANK = { x: 1782, y: 594 };
const SAFEHOUSE = { x: 594, y: 1782 };
const HIDEOUT = { x: 3366, y: 594 };
const CHOPSHOP = { x: 594, y: 594 };
const MEET = { x: 990, y: 990 };

export const MISSIONS = [
  {
    id: 'm1', title: 'Back in Town', reward: 200,
    brief: [
      ['Lena', 'Cole. You actually came back. Solmar Bay missed you — the streets missed you more.'],
      ['Cole', 'I need work, Lena. Real work.'],
      ['Lena', 'Then start simple. My car is parked by the marina. Take it to the old meeting spot uptown. Drive careful — the cops here love a reason.'],
    ],
    steps: [
      { type: 'driveTo', x: MEET.x, y: MEET.y, label: 'Drive to the meeting spot', radius: 90 },
    ],
  },
  {
    id: 'm2', title: 'The Getaway', reward: 500,
    brief: [
      ['Lena', 'A crew needs a driver. The bank on Meridian Row — you drive, they go in, you wait. Take this pistol. You will need it.'],
      ['Cole', 'I drive. I do not do the inside part.'],
      ['Lena', 'Nobody asked you to. Just do not leave early.'],
    ],
    onStart(G) { G.player.weapon = 'pistol'; G.player.ammo = Math.max(G.player.ammo, 48); },
    steps: [
      { type: 'driveTo', x: BANK.x, y: BANK.y, label: 'Drive to the bank', radius: 90 },
      { type: 'wait', x: BANK.x, y: BANK.y, seconds: 8, label: 'Wait for the crew (8s)' },
      { type: 'driveTo', x: SAFEHOUSE.x, y: SAFEHOUSE.y, label: 'Escape to the safehouse', radius: 100, onEnter(G) { G.police.addHeat(G, 55); G.hud.flash('The alarm is up — 2 stars! Lose them!'); } },
      { type: 'loseCops', label: 'Lose the cops' },
    ],
  },
  {
    id: 'm3', title: 'Package Run', reward: 400,
    brief: [
      ['Lena', 'Three packages stashed around the city. Collect them all before the buyers move on. One-fifty on the clock. Drive fast, do not get cute.'],
      ['Cole', 'Three stops. Easy money.'],
    ],
    timer: 150,
    steps: [
      { type: 'collect', label: 'Collect the 3 packages', items: [
        { x: 594, y: 990 }, { x: 2574, y: 1386 }, { x: 1386, y: 2178 },
      ]},
    ],
  },
  {
    id: 'm4', title: 'Heat', reward: 600,
    brief: [
      ['Lena', 'Somebody talked. The whole department is looking for you — three stars. Survive the heat, shake them, and get to the hideout on the north side.'],
      ['Cole', 'Then I stop answering my phone.'],
    ],
    onStart(G) { G.police.addHeat(G, 80); },
    steps: [
      { type: 'survive', seconds: 45, label: 'Survive the heat (45s)' },
      { type: 'loseCops', label: 'Lose the cops' },
      { type: 'driveTo', x: HIDEOUT.x, y: HIDEOUT.y, label: 'Reach the hideout', radius: 100 },
    ],
  },
  {
    id: 'm5', title: 'The Big Score', reward: 1000,
    brief: [
      ['Lena', 'Last one. A yellow sports car sits at the marina, keys in it, owner in the casino. Take it to the chop shop. The cops will not wave you through.'],
      ['Cole', 'Yellow. Subtle. Let us go.'],
    ],
    onStart(G) {
      const car = createCar('sports', MARINA.x + 120, MARINA.y + 90, Math.PI / 2, { color: '#f1c40f' });
      car.targetCar = true;
      G.cars.push(car);
      G.missions.targetCar = car;
    },
    steps: [
      { type: 'driveTo', x: MARINA.x + 120, y: MARINA.y + 90, label: 'Get to the marina', radius: 120 },
      { type: 'stealCar', label: 'Steal the yellow sports car', onEnter(G) { G.police.addHeat(G, 75); G.hud.flash('Three stars! Get to the chop shop!'); } },
      { type: 'driveTo', x: CHOPSHOP.x, y: CHOPSHOP.y, label: 'Deliver the car to the chop shop', radius: 100 },
      { type: 'loseCops', label: 'Lose the cops' },
    ],
  },
];

export function createMissions() {
  return {
    list: MISSIONS,
    currentIndex: -1, // no mission active
    current: null,
    stepIndex: 0,
    step: null,
    stepTimer: 0,
    missionTimer: 0,
    targetCar: null,
    collectLeft: 0,
    dialogue: [], dialogueIndex: 0, dialogueTimer: 0,
    completed: [],
    objective: 'Free roam — press M for the mission list.',
    marker: null,
  };
}

export function startMission(G, index) {
  const m = G.missions;
  const def = m.list[index];
  if (!def) return;
  m.currentIndex = index;
  m.current = def;
  m.stepIndex = 0;
  m.stepTimer = 0;
  m.missionTimer = def.timer || 0;
  m.targetCar = null;
  m.collectLeft = 0;
  m.dialogue = def.brief.slice();
  m.dialogueIndex = 0;
  m.dialogueTimer = 0;
  if (def.onStart) def.onStart(G);
  setStep(G, 0);
  G.audio.missionDone();
  G.hud.flash(`Mission: ${def.title} — $${def.reward}`);
}

function setStep(G, i) {
  const m = G.missions;
  const def = m.current;
  m.stepIndex = i;
  m.step = def.steps[i] || null;
  m.stepTimer = 0;
  if (!m.step) { completeMission(G); return; }
  const s = m.step;
  if (s.onEnter) s.onEnter(G);
  if (s.type === 'collect') {
    m.collectLeft = s.items.length;
    for (const it of s.items) {
      G.pickups.push({ kind: 'package', x: it.x, y: it.y, amount: 0, taken: false, package: true });
    }
  }
  if (s.type === 'stealCar') {
    // The target car is already placed by onStart; marker follows it.
  }
  updateObjective(G);
}

function updateObjective(G) {
  const m = G.missions;
  const s = m.step;
  if (!m.current || !s) { m.objective = 'Free roam — press M for the mission list.'; m.marker = null; return; }
  let label = s.label;
  if (s.type === 'collect') label = `${s.label} (${m.collectLeft} left)`;
  if (s.type === 'wait') label = `${s.label}`;
  if (s.type === 'survive') label = `${s.label} — ${Math.max(0, Math.ceil(s.seconds - m.stepTimer))}s`;
  m.objective = `${m.current.title}: ${label}`;
  if (s.x !== undefined) m.marker = { x: s.x, y: s.y };
  else if (s.type === 'stealCar' && m.targetCar) m.marker = { x: m.targetCar.x, y: m.targetCar.y };
  else m.marker = null;
}

function completeMission(G) {
  const m = G.missions;
  const def = m.current;
  G.player.money += def.reward;
  m.completed.push(def.id);
  G.audio.missionDone();
  G.audio.cash();
  G.hud.banner(`Mission complete — ${def.title}  •  +$${def.reward}`);
  m.current = null; m.step = null; m.marker = null;
  m.objective = 'Free roam — press M for the mission list.';
  // Save progress.
  G.save.write(G);
  if (m.completed.length >= m.list.length) {
    G.state = 'storydone';
  }
}

function failMission(G, reason) {
  const m = G.missions;
  G.audio.missionFail();
  G.hud.banner(`Mission failed — ${reason}`);
  m.current = null; m.step = null; m.marker = null;
  m.objective = 'Free roam — press M for the mission list.';
  G.state = 'missionfailed';
  G.missions.failReason = reason;
}

export function updateMissions(G, dt) {
  const m = G.missions;
  // Dialogue advances on its own timer.
  if (m.dialogueIndex < m.dialogue.length) {
    m.dialogueTimer += dt;
    if (m.dialogueTimer > 4.2) { m.dialogueIndex++; m.dialogueTimer = 0; }
  }
  if (!m.current || !m.step) return;
  const s = m.step;
  const p = G.player;
  m.stepTimer += dt;
  if (m.missionTimer > 0) {
    m.missionTimer -= dt;
    if (m.missionTimer <= 0) { failMission(G, 'Out of time.'); return; }
  }
  const distTo = (x, y) => Math.hypot(p.x - x, p.y - y);
  if (s.type === 'goto' || s.type === 'driveTo') {
    const needCar = s.type === 'driveTo';
    if (distTo(s.x, s.y) < (s.radius || 80) && (!needCar || !p.onFoot)) setStep(G, m.stepIndex + 1);
  } else if (s.type === 'wait') {
    if (distTo(s.x, s.y) < 110) {
      if (m.stepTimer >= s.seconds) setStep(G, m.stepIndex + 1);
    } else m.stepTimer = 0;
  } else if (s.type === 'collect') {
    // Packages are collected by driving over them or walking up to them.
    for (const pk of G.pickups) {
      if (pk.package && !pk.taken && Math.hypot(pk.x - p.x, pk.y - p.y) < 52) {
        pk.taken = true; m.collectLeft--;
        G.audio.pickup();
        G.hud.flash(`Package ${s.items.length - m.collectLeft}/${s.items.length}`);
        updateObjective(G);
        if (m.collectLeft <= 0) setStep(G, m.stepIndex + 1);
      }
    }
  } else if (s.type === 'survive') {
    if (m.stepTimer >= s.seconds) setStep(G, m.stepIndex + 1);
    updateObjective(G);
  } else if (s.type === 'loseCops') {
    if (G.police.stars === 0) setStep(G, m.stepIndex + 1);
  } else if (s.type === 'stealCar') {
    if (!p.onFoot && p.car && p.car.targetCar) setStep(G, m.stepIndex + 1);
  }
}

export function nextMissionIndex(G) {
  const m = G.missions;
  for (let i = 0; i < m.list.length; i++) if (!m.completed.includes(m.list[i].id)) return i;
  return -1;
}
export function startNextMission(G) {
  const i = nextMissionIndex(G);
  if (i >= 0) startMission(G, i);
}
