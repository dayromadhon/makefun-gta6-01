// SOLMAR HEAT — missions.js
// One job: the story. Five missions for Leo to pay off his $4,500 debt to
// Rocco Vane, then side jobs in free roam. A mission is a small state machine:
// stages, an objective marker, a timer where the story needs one.

import { CONFIG, MISSIONS, LANDMARKS } from './config.js';
import { range, pick } from './random.js';

export class Missions {
  constructor(rng, onEvent) {
    this.rng = rng;
    this.onEvent = onEvent; // ({type, ...}) — 'card', 'stage', 'complete', 'failed', 'cash'
    this.index = 0; // 0..4 story, 5 = story done (free roam)
    this.stage = 0;
    this.timer = 0;
    this.faresDone = 0;
    this.marker = null; // {x, z, label}
    this.fare = null; // current taxi fare {from:{x,z}, to:{x,z}, stage}
    this.sideJob = null; // free-roam job {kind, from, to, stage}
    this._taxiSpawned = false;
    this._vanSpawned = false;
  }

  get current() {
    return MISSIONS[this.index] || null;
  }

  get storyDone() {
    return this.index >= MISSIONS.length;
  }

  // Begin (or re-begin) the current mission.
  start() {
    const m = this.current;
    if (!m) {
      this._startSideJob();
      return;
    }
    this.stage = 0;
    this.timer = 0;
    this.faresDone = 0;
    this.fare = null;
    this._taxiSpawned = false;
    this._vanSpawned = false;
    this.onEvent({ type: 'card', mission: m });
    this._setMarkerForStage();
  }

  _setMarkerForStage() {
    const m = this.current;
    if (!m) return;
    if (m.kind === 'steal-to-garage') {
      this.marker = this.stage === 0 ? null : { x: LANDMARKS.garage.x, z: LANDMARKS.garage.z, label: LANDMARKS.garage.name };
    } else if (m.kind === 'timed-delivery') {
      this.marker = this.stage === 0
        ? { x: LANDMARKS.marina.x, z: LANDMARKS.marina.z, label: LANDMARKS.marina.name }
        : { x: LANDMARKS.hotel.x, z: LANDMARKS.hotel.z, label: LANDMARKS.hotel.name };
    } else if (m.kind === 'lose-heat') {
      this.marker = this.stage === 0 ? null : { x: LANDMARKS.pier.x, z: LANDMARKS.pier.z, label: LANDMARKS.pier.name };
    } else if (m.kind === 'taxi') {
      this.marker = this.fare
        ? (this.fare.stage === 0
          ? { x: this.fare.from.x, z: this.fare.from.z, label: 'Pick up the fare' }
          : { x: this.fare.to.x, z: this.fare.to.z, label: 'Drop off the fare' })
        : null;
    } else if (m.kind === 'van-heist') {
      this.marker = this.stage === 0 ? { x: LANDMARKS.docks.x, z: LANDMARKS.docks.z, label: 'Courier van' } : { x: LANDMARKS.hideout.x, z: LANDMARKS.hideout.z, label: LANDMARKS.hideout.name };
    }
  }

  objectiveText() {
    const m = this.current;
    if (!m) {
      if (this.sideJob) return this.sideJob.stage === 0 ? 'Pick up the package' : 'Deliver the package';
      return 'Free roam — drive to the side-job marker to earn cash';
    }
    if (m.kind === 'steal-to-garage') return this.stage === 0 ? 'Steal any car (E near a car)' : 'Drive it to Ada\u2019s garage';
    if (m.kind === 'timed-delivery') return this.stage === 0 ? 'Pick up the package at the marina' : `Deliver to Hotel Solmar — ${Math.ceil(this.timer)}s left`;
    if (m.kind === 'lose-heat') return this.stage === 0 ? 'Lose the 2-star wanted level' : 'Reach the pier';
    if (m.kind === 'taxi') return `Taxi fares: ${this.faresDone}/${m.fares} done` + (this.fare ? (this.fare.stage === 0 ? ' — pick up the fare' : ' — drop off the fare') : ' — get in the taxi');
    if (m.kind === 'van-heist') return this.stage === 0 ? 'Steal the courier van at the docks' : 'Bring the van to the hideout';
    return m.objective;
  }

  // A random street point for fares and side jobs.
  _streetSpot(lines, half) {
    const line = lines[Math.floor(this.rng() * lines.length)];
    const along = range(this.rng, -half + 10, half - 10);
    return this.rng() < 0.5 ? { x: along, z: line } : { x: line, z: along };
  }

  _newFare(lines, half) {
    const from = this._streetSpot(lines, half);
    let to = this._streetSpot(lines, half);
    while (Math.hypot(to.x - from.x, to.z - from.z) < 60) to = this._streetSpot(lines, half);
    this.fare = { from, to, stage: 0 };
    this._setMarkerForStage();
  }

  _complete(ctx) {
    const m = this.current;
    const reward = m.reward;
    // Advance the index BEFORE the event: the event handler saves the game,
    // and the save must carry the NEXT mission, not the one just finished.
    this.index += 1;
    this.stage = 0;
    this.marker = null;
    this.fare = null;
    this.onEvent({ type: 'complete', mission: m, reward });
    if (this.storyDone) {
      this.onEvent({ type: 'story-done', debtPaid: true });
      this._startSideJob();
    }
  }

  _startSideJob() {
    this.sideJob = null;
    // The next side job marker appears at a street point; the game renders it.
    this.sideJob = { kind: 'package', stage: 0, from: null, to: null };
    this.marker = null;
  }

  // Free-roam side job: drive to the marker to pick up, then deliver.
  startSideJobAt(ctx) {
    if (!this.storyDone || !this.sideJob) return;
    const lines = CONFIG.streetLines;
    const half = CONFIG.cityHalf;
    this.sideJob.from = this._streetSpot(lines, half);
    this.sideJob.to = this._streetSpot(lines, half);
    this.sideJob.stage = 0;
    this.marker = { x: this.sideJob.from.x, z: this.sideJob.from.z, label: 'Package pickup' };
    this.onEvent({ type: 'stage', text: 'Side job: pick up the package' });
  }

  // One frame. ctx: {player, vehicles, wanted, lines, half}.
  // Returns nothing; progress is reported through onEvent.
  update(dt, ctx) {
    const m = this.current;
    const p = ctx.player;
    if (!m) {
      // Free roam: side-job pickup / delivery.
      if (this.sideJob && this.sideJob.from) {
        const target = this.sideJob.stage === 0 ? this.sideJob.from : this.sideJob.to;
        if (Math.hypot(p.x - target.x, p.z - target.z) < 8) {
          if (this.sideJob.stage === 0) {
            this.sideJob.stage = 1;
            this.marker = { x: this.sideJob.to.x, z: this.sideJob.to.z, label: 'Deliver the package' };
            this.onEvent({ type: 'stage', text: 'Package collected — deliver it' });
          } else {
            this.onEvent({ type: 'cash', amount: CONFIG.packageSidePay, text: `Side job done: +$${CONFIG.packageSidePay}` });
            this.sideJob = null;
            this.marker = null;
            this._startSideJob();
          }
        }
      }
      return;
    }

    const near = (x, z, r) => Math.hypot(p.x - x, p.z - z) < r;

    if (m.kind === 'steal-to-garage') {
      if (this.stage === 0 && p.inCar) {
        this.stage = 1;
        this._setMarkerForStage();
        this.onEvent({ type: 'stage', text: 'Car stolen — take it to Ada\u2019s garage' });
      } else if (this.stage === 1 && p.inCar && near(LANDMARKS.garage.x, LANDMARKS.garage.z, 9)) {
        this._complete(ctx);
      }
    } else if (m.kind === 'timed-delivery') {
      if (this.stage === 0) {
        if (near(LANDMARKS.marina.x, LANDMARKS.marina.z, 8)) {
          this.stage = 1;
          this.timer = m.timeLimit;
          this._setMarkerForStage();
          this.onEvent({ type: 'stage', text: 'Package collected — 75 seconds to Hotel Solmar!' });
        }
      } else {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.onEvent({ type: 'failed', mission: m, text: 'Out of time — the package run failed. Try again.' });
          this.start();
          return;
        }
        if (near(LANDMARKS.hotel.x, LANDMARKS.hotel.z, 9)) this._complete(ctx);
      }
    } else if (m.kind === 'lose-heat') {
      if (this.stage === 0 && ctx.wanted.stars === 0) {
        this.stage = 1;
        this._setMarkerForStage();
        this.onEvent({ type: 'stage', text: 'Heat lost — now reach the pier' });
      } else if (this.stage === 1 && near(LANDMARKS.pier.x, LANDMARKS.pier.z, 9)) {
        this._complete(ctx);
      }
    } else if (m.kind === 'taxi') {
      if (!this._taxiSpawned) {
        this._taxiSpawned = true;
        ctx.spawnTaxiNearPlayer();
      }
      if (this.stage === 0 && p.inCar && p.inCar.kind === 'taxi') {
        this.stage = 1;
        this._newFare(CONFIG.streetLines, CONFIG.cityHalf);
        this.onEvent({ type: 'stage', text: 'Taxi ready — pick up your first fare' });
      } else if (this.stage === 1 && this.fare) {
        const target = this.fare.stage === 0 ? this.fare.from : this.fare.to;
        if (p.inCar && p.inCar.kind === 'taxi' && near(target.x, target.z, 7)) {
          if (this.fare.stage === 0) {
            this.fare.stage = 1;
            this._setMarkerForStage();
            this.onEvent({ type: 'stage', text: 'Fare aboard — drop them off' });
          } else {
            this.faresDone += 1;
            this.onEvent({ type: 'cash', amount: CONFIG.taxiFare, text: `Fare paid: +$${CONFIG.taxiFare}` });
            if (this.faresDone >= m.fares) {
              this._complete(ctx);
            } else {
              this._newFare(CONFIG.streetLines, CONFIG.cityHalf);
            }
          }
        }
      }
    } else if (m.kind === 'van-heist') {
      if (!this._vanSpawned) {
        this._vanSpawned = true;
        ctx.spawnVanAtDocks();
      }
      if (this.stage === 0 && p.inCar && p.inCar.kind === 'van') {
        this.stage = 1;
        this._setMarkerForStage();
        this.onEvent({ type: 'stage', text: 'Van stolen — take it to the hideout' });
      } else if (this.stage === 1 && p.inCar && p.inCar.kind === 'van' && near(LANDMARKS.hideout.x, LANDMARKS.hideout.z, 9)) {
        this._complete(ctx);
      }
    }
  }

  // Called when the player is busted: the current mission restarts.
  onBusted() {
    if (!this.current) return;
    this.start();
  }
}
