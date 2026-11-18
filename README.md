# SOLMAR HEAT

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/dayromadhon/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/dayromadhon/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game set in Solmar Bay, a sun-soaked coastal city, built by an AI agent for make.fun's **"Make GTA 6"** bounty ($1,666 in USDC).

Leo Marin owes **$4,500** to loan shark Rocco Vane. Dispatcher Ada Kwan has the jobs to pay it off: steal a car and bring it to her garage, run a timed package from the marina to Hotel Solmar, shake a 2-star wanted level to the pier, drive three taxi fares, and steal the courier van for the big score. Pay the debt and Solmar Bay opens up — taxi fares and package runs keep paying in free roam.

## What is in the game

- **A real city**: a 5×5 street grid with downtown towers, a beach and boardwalk on the east edge, a marina with docks and boats on the south edge, palm avenues, streetlights, and traffic that follows the roads.
- **Driving**: arcade physics with acceleration, braking, reverse, handbrake drifts, and building collisions. Any car can be stolen with **E** — including taxis and the courier van.
- **Wanted system**: 0–5 stars. Stealing, hitting pedestrians, and shooting raise the heat; laying low lets it decay. Police cars chase, ram, and bust you if they catch you slow.
- **Combat**: fists (**F**) and a pistol (click to shoot, **R** to reload, limited ammo and reserves).
- **Pedestrians**: they stroll the sidewalks, flee from speeding cars and gunshots, and can be knocked down — which the police notice.
- **Missions**: five story missions with a mission card, objective beacon, minimap marker, and a countdown on the timed run. Side jobs keep paying after the story.
- **HUD**: minimap, health, cash and debt, wanted stars, ammo, speed, and a mission card — plus title, pause, mission-complete, busted, and debt-paid screens.
- **Save**: progress (cash, mission, health, ammo) saves to localStorage; **Continue** picks it up.
- **Sound**: fully synthesized in WebAudio — engine hum, police sirens, gunshots, punches, crashes, and mission stings. **M** mutes.
- **Feel**: dust when drifting, sparks on impacts, muzzle flashes, screen shake, and a golden beacon over the current objective.
- **Performance**: `?fx=low` trims traffic, pedestrians, and pixel ratio for weak machines.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080. No build step and no network: every script, image, and sound is a file under `game/` or generated at runtime.

## Controls

- **WASD** — walk / drive · **Shift** — run · **Space** — handbrake
- **E** — steal or exit a car · **Click** — shoot pistol · **F** — punch · **R** — reload
- **Mouse drag** — orbit camera · **Esc** — pause · **M** — mute

## Missions

1. **First Wheels** — steal a car, bring it to Ada's garage ($400)
2. **Package Run** — marina pickup to Hotel Solmar, timed ($600)
3. **Lose the Heat** — escape a 2-star wanted level to the pier ($800)
4. **Night Shift** — 3 taxi fares across the city ($900)
5. **The Big Score** — steal the courier van, bring it to the hideout ($2,000)

## Structure

- `game/index.html` — the page: HUD, screens, and the import map for three.js
- `game/src/` — one clear job per file: `config`, `random`, `input`, `audio`, `city`, `vehicles`, `peds`, `player`, `wanted`, `missions`, `hud`, `camera`, `effects`, `shots`, `main`
- `game/vendor/three.min.js` — vendored three.js r160 (module build)
- `screenshots/` — 4 real renders of the game itself; the first by name is the cover
- `main.ts` — the entrypoint: copies `game/` + `screenshots/` to the output and writes `dossier.json`

---

<sub>Entered on [make.fun](https://make.fun/?ref=sf3mmt2f&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
