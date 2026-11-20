# Solmar Bay — an open-world crime game

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/wr-xie01/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/wr-xie01/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

An original 2D top-down open-world crime game for the [Make GTA 6](https://make.fun/bounty/gta6-01) bounty on make.fun. Everything — the city, the characters, the vehicles, the story, the art, the sounds — is original. Nothing comes from Rockstar's GTA or any commercial game.

## The game

**Cole Maddox** drove out of Solmar Bay five years ago. Now he is back, and Lena — the fixer who never left — has work for him. Five missions, one city, and a police department that never forgets.

- **A real city to explore** — a 3600×2800 open world with a road grid, blocks of buildings, a park, a beach and a marina. Explore on foot or by car; the camera follows you smoothly.
- **Traffic and pedestrians** — cars drive the streets, stop for each other and for pedestrians; people stroll the sidewalks and flee when things get loud.
- **Steal and drive cars** — walk up to any car, press E to get in. Sedans, sports cars, taxis, vans and trucks, each with its own speed and handling. Stealing one raises your wanted level.
- **Wanted level and police** — stars rise with crimes (theft, hit-and-runs, shootings). Police cars chase and ram you; officers chase you on foot, shoot at higher stars, and bust you if they catch you standing still. Break line of sight and hide to cool the heat down.
- **Five missions with a story** — getaway driving, a bank job, a package run against the clock, surviving a three-star manhunt, and one last big score. Dialogue, objectives, a mission tracker and cash rewards.
- **Combat** — punch with your fists, shoot with a pistol (mouse aim), switch with Q.
- **HUD with minimap** — wanted stars, health, money, objective, mission timer, speedometer, and a live minimap showing the player, cars, police and the objective marker.
- **Save** — money, missions completed and best stats persist in localStorage; Continue from the title screen.
- **Polish** — warm sunset lighting, headlights, skid marks, muzzle flashes, explosions and particles, screen shake, and WebAudio sound effects generated in code (engine, siren, gunshots, pickups, mission complete) plus a small music loop. No external audio or image files — everything is drawn and synthesized in code.

## Controls

| Key | Action |
| --- | --- |
| WASD / Arrows | Move on foot · Drive (W accelerate, S brake/reverse, A/D steer) |
| Mouse | Aim (on foot) |
| E | Enter / exit a car |
| Space / Click | Punch · Shoot (with pistol) |
| Q | Switch weapon (fists / pistol) |
| Shift | Sprint |
| M | Mission list |
| P / Esc | Pause · H Help |

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

## Build the entry

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
# writes out/game/, out/screenshots/ and out/dossier.json
```

## Layout

- `game/` — the game itself: `index.html` plus ES modules under `game/src/` (one file per job: `world`, `traffic`, `police`, `player`, `missions`, `render`, `audio`, `input`, `save`, `shots`, `main`). No network requests at runtime.
- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to the output dir and writes `dossier.json` via the kit's `buildDossier`.
- `serve.ts` — a tiny static server for local play.
- `shots.json` — the four deterministic screenshot scenes.
- `screenshots/` — real renders of the game (cover first).
- `vendor/makefun-game.ts` — the kit's vendored library, unchanged.
