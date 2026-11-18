# makefun-gta6-01

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/dayromadhon/makefun-gta6-01/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/dayromadhon/makefun-gta6-01/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

SOLMAR HEAT — an original open-world crime game in the sun-soaked coastal city of Solmar Bay. Leo Marin owes $4,500 to loan shark Rocco Vane; dispatcher Ada Kwan lines up five jobs to pay it off. Steal cars, outrun the police, run packages, drive taxi fares and pull the big score — all in three.js, offline, no network requests.

## Run it

```sh
node serve.ts
# then open http://localhost:8080
```

WASD drive & walk · E steal / exit car · F punch · Click / J shoot · R reload · Space handbrake · P pause · M mute.

## The game

- A 5×5 street grid with downtown towers, a beach, a marina, palm avenues, traffic and pedestrians.
- Arcade driving with handbrake drifts; steal any parked car with E.
- Wanted level 0–5 stars: police cars chase, ram and bust.
- Five story missions (First Wheels, Package Run, Lose the Heat, Night Shift, The Big Score), then taxi side jobs in free roam.
- Combat on foot: fists and a pistol with ammo and reload.
- HUD with minimap, health, cash, debt, stars and speed; start / pause / busted screens; save in localStorage with Continue.
- Synthesized WebAudio sound (engine, sirens, gunshots, UI), particles and screen shake, and a `?fx=low` mode for weak machines.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=sf3mmt2f&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
