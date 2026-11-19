# SOLMAR HEAT

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/dayromadhon/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/dayromadhon/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game set in Solmar Bay, a sun-soaked coastal city built with three.js. Leo Marin owes $4,500 to loan shark Rocco Vane, and dispatcher Ada Kwan has the jobs to pay it off — steal cars, run packages, shake the cops, drive the cab, and pull the big score.

## The game

- **A city to explore** — a 5×5 street grid with downtown towers, a beach, a marina with moored boats, a pier, palm avenues, traffic and pedestrians who flee when trouble comes.
- **Driving** — arcade handling with handbrake drifts. Walk up to any parked car and press E to take it.
- **Wanted level** — 0 to 5 stars. Police cars chase and ram, foot cops try to hold you, and getting busted costs $100 at the clinic. Lay low and the heat cools off star by star.
- **Five story missions** — First Wheels, a timed Package Run, Lose the Heat, Night Shift (three taxi fares), and The Big Score (steal the courier van). Once the debt is paid, taxi fares and package runs keep paying in free roam.
- **Combat on foot** — fists and a pistol with a magazine and reload.
- **HUD with minimap** — cash, remaining debt, health, stars, speed, the current objective with distance, and a live top-down map with police and mission markers.
- **Save and Continue** — progress lives in localStorage. Synthesized WebAudio sound (engine hum, two-tone sirens, gunshots, UI blips), crash particles, screen shake, and a `?fx=low` mode for weak machines.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in a desktop browser. No build step and no network requests — every file the game loads lives under `game/`.

## Controls

WASD move / drive · E steal a car (E again to get out) · F punch · 2 pistol, click to shoot, R reload · Space handbrake · Shift run · P pause · M mute

## Screenshots

The four shots in `screenshots/` are real renders of the game running in a browser: the downtown avenue, a street on foot, a two-star police chase, and the Package Run mission in progress.

---

<sub>Entered on [make.fun](https://make.fun/?ref=sf3mmt2f&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
