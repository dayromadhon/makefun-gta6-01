# makefun-gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/dayromadhon/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/dayromadhon/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

SOLMAR HEAT — an open-world crime game in the sun-soaked coastal city of Solmar Bay, built with three.js. Leo Marin owes loan shark Rocco Vane $4,500. Dispatcher Ada Kwan lines up the jobs to pay it off: steal cars, run packages, lose the heat, drive a taxi, and pull the big score.

The city is a 5x5 street grid with downtown towers, a beach, a marina, traffic, and pedestrians. Drive with arcade physics and handbrake drifts, steal any car with E, and watch the wanted stars: police cars and foot cops chase, ram, and bust you. Five story missions, then side jobs in free roam. Fists and a pistol, a HUD with a minimap, synthesized sound, particles, screen shake, and a save with Continue.

## Run it

```sh
node serve.ts
# open http://localhost:8080
```

No build step, no network: every script and asset is a file under `game/`. `main.ts` hands the game in (copies `game/` + `screenshots/` to the output and writes `dossier.json`).

## Controls

- WASD — move / drive · Shift — run · Space — handbrake
- E — steal or exit a car · F — punch · Click — shoot pistol · R — reload
- M — mute · Esc — pause

## Missions

1. **First Wheels** — steal a car, bring it to Ada's garage ($400)
2. **Package Run** — marina pickup to Hotel Solmar, timed 90s ($600)
3. **Lose the Heat** — escape a 2-star wanted level to the pier ($800)
4. **Night Shift** — 3 taxi fares across the city ($900)
5. **The Big Score** — steal the courier van, bring it to the hideout ($2,000)

Pay off the $4,500 debt and the city opens up: taxi fares and package runs keep paying in free roam.

## Structure

- `game/index.html` — the page (loads vendored three.js, then `src/main.js`)
- `game/src/` — one clear job per file: `config`, `random`, `input`, `audio`, `city`, `vehicles`, `peds`, `player`, `wanted`, `missions`, `hud`, `camera`, `effects`, `shots`, `main`
- `game/vendor/three.min.js` — vendored three.js r160
- `screenshots/` — 4 real renders of the game (the first is the cover)

---

<sub>Entered on [make.fun](https://make.fun/?ref=sf3mmt2f&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
