// Shots — one clear job: set up deterministic scenes for screenshots.
// The game reads ?shot=<name>&seed=<n> on load. Each shot places the player,
// cars, police and a mission in a good spot, so screenshots show the game at
// its best without needing input.
import { createCar, spawnTraffic, spawnPeds, spawnParkedCars } from './traffic.js';
import { createPlayer } from './player.js';
import { startMission } from './missions.js';
import { MARINA } from './config.js';

export function applyShot(G, name) {
  // Reset to a clean scene.
  G.cars = [];
  G.peds = [];
  G.pickups = [];
  G.particles = [];
  G.skids = [];
  G.police.heat = 0; G.police.stars = 0;
  G.police.cars = []; G.police.officers = [];
  G.missions.current = null; G.missions.step = null; G.missions.marker = null;
  G.missions.objective = 'Free roam — press M for the mission list.';
  G.player.money = 250;
  if (name === 'start') {
    // Cover: on foot at the beachfront, car beside him, city behind.
    G.player = createPlayer(990, 2350);
    G.player.money = 250;
    const car = createCar('sports', 990, 2260, -Math.PI / 2, { color: '#e74c3c' });
    G.cars.push(car);
    spawnTraffic(G, 10);
    spawnPeds(G, 18);
    spawnParkedCars(G, 6);
    G.camera.x = 990; G.camera.y = 2280;
    G.state = 'start';
  } else if (name === 'play') {
    // Driving through the city, minimap + HUD visible, traffic around.
    G.player = createPlayer(1386, 1386);
    G.player.money = 450;
    const car = createCar('sedan', 1386, 1386, 0, { color: '#3498db' });
    car.isPlayer = true; car.speed = 200;
    G.player.car = car; G.player.onFoot = false;
    G.cars.push(car);
    spawnTraffic(G, 14);
    spawnPeds(G, 22);
    spawnParkedCars(G, 8);
    startMission(G, 0);
    G.missions.dialogueIndex = G.missions.dialogue.length; // skip dialogue for the shot
    G.camera.x = 1386; G.camera.y = 1386;
    G.state = 'play';
  } else if (name === 'chase') {
    // Police chase: 2 stars, two police cars closing in, player speeding away.
    G.player = createPlayer(2178, 990);
    G.player.money = 750;
    const car = createCar('sports', 2178, 990, 0, { color: '#f1c40f' });
    car.isPlayer = true; car.speed = 320;
    G.player.car = car; G.player.onFoot = false;
    G.cars.push(car);
    spawnTraffic(G, 8);
    spawnPeds(G, 10);
    G.police.addHeat(G, 55);
    // Place two police cars right behind the player.
    const p1 = createCar('police', 2178 - 260, 990, 0); p1.isPolice = true; p1.chasing = true; p1.speed = 300;
    const p2 = createCar('police', 2178 - 420, 990 + 40, 0); p2.isPolice = true; p2.chasing = true; p2.speed = 280;
    G.cars.push(p1, p2);
    G.police.cars.push(p1, p2);
    startMission(G, 1);
    G.missions.dialogueIndex = G.missions.dialogue.length;
    G.camera.x = 2178; G.camera.y = 990;
    G.state = 'play';
  } else if (name === 'mission') {
    // Mission in progress: on foot collecting a package, wanted 1 star, marina behind.
    G.player = createPlayer(MARINA.x + 120, MARINA.y + 60);
    G.player.money = 650;
    G.player.weapon = 'pistol'; G.player.ammo = 48;
    const car = createCar('sports', MARINA.x + 120, MARINA.y + 90, Math.PI / 2, { color: '#f1c40f' });
    car.targetCar = true;
    G.cars.push(car);
    G.missions.targetCar = car;
    spawnTraffic(G, 8);
    spawnPeds(G, 14);
    G.police.addHeat(G, 30);
    const p1 = createCar('police', MARINA.x - 300, MARINA.y + 60, 0); p1.isPolice = true; p1.chasing = true; p1.speed = 240;
    G.cars.push(p1);
    G.police.cars.push(p1);
    startMission(G, 4);
    G.missions.dialogueIndex = G.missions.dialogue.length;
    G.camera.x = MARINA.x + 120; G.camera.y = MARINA.y + 60;
    G.state = 'play';
  }
}
