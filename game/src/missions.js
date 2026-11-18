// The story: five missions that pay off Leo's $4,500 debt, then side jobs in
// free roam. A mission is a small state machine — the game feeds it the world
// each frame and it answers with events (messages, objective changes, rewards).

import { MISSIONS, DEBT } from './config.js';
import { dist2d, Rng } from './random.js';

const REACH = 9; // metres from a marker to count as "there"

export class MissionManager {
  constructor(places, seed = 1) {
    this.places = places;
    this.rng = new Rng(seed);
    this.index = 0; // which story mission is active (0..4); 5 = story done
    this.phase = 'go'; // go | pickup | drop | fares | done
    this.timer = 0;
    this.fare = 0; // fares done in Night Shift
    this.farePickup = null;
    this.fareDrop = null;
    this.sideJob = null; // free-roam job after the story
    this.completed = false;
    this.debtPaid = false;
    this.started = false;
  }

  get current() {
    return this.index < MISSIONS.length ? MISSIONS[this.index] : null;
  }

  get storyDone() {
    return this.index >= MISSIONS.length;
  }

  /** The active objective: a place to drive to, or null. */
  get objective() {
    const m = this.current;
    if (!m) return this.sideJob ? this.sideJob.target : null;
    if (m.id === 'package') {
      return this.phase === 'pickup' ? m.pickup : m.target;
    }
    if (m.id === 'taxi') {
      if (this.phase === 'pickup') return this.farePickup;
      if (this.phase === 'drop') return this.fareDrop;
      return null;
    }
    return m.target || null;
  }

  get objectiveLabel() {
    const o = this.objective;
    return o ? o.label : null;
  }

  /** Begin the current mission (called once when it becomes active). */
  startMission(events) {
    const m = this.current;
    if (!m) return;
    this.started = true;
    this.phase = m.id === 'package' ? 'pickup' : 'go';
    this.timer = 0;
    this.fare = 0;
    if (m.id === 'taxi') {
      this.phase = 'pickup';
      this._nextFare();
    }
    events.push({ type: 'mission-start', mission: m });
  }

  _nextFare() {
    // Random street-corner pickup and drop-off.
    const streets = [-104, -52, 0, 52, 104];
    const pick = () => ({
      x: this.rng.pick(streets),
      z: this.rng.pick(streets),
      label: 'Fare Pickup',
    });
    const drop = () => ({
      x: this.rng.pick(streets),
      z: this.rng.pick(streets),
      label: 'Fare Drop-off',
    });
    this.farePickup = pick();
    this.fareDrop = drop();
  }

  /** Per-frame check. ctx: { player, vehicles, wanted, events }. */
  update(dt, ctx) {
    const events = ctx.events;
    const m = this.current;
    if (!m) {
      this._updateSideJob(dt, ctx);
      return;
    }
    if (!this.started) this.startMission(events);

    if (m.id === 'wheels') {
      if (!ctx.player.inCar) {
        // Waiting for the player to steal a car.
        return;
      }
      const t = m.target;
      if (dist2d(ctx.player.x, ctx.player.z, t.x, t.z) < REACH) {
        this._complete(events, ctx);
      }
      return;
    }

    if (m.id === 'package') {
      if (this.phase === 'pickup') {
        if (dist2d(ctx.player.x, ctx.player.z, m.pickup.x, m.pickup.z) < REACH) {
          this.phase = 'go';
          this.timer = m.timeLimit;
          events.push({ type: 'message', text: 'Package collected! Get to Hotel Solmar — fast.' });
        }
        return;
      }
      // Timed leg.
      this.timer -= dt;
      if (this.timer <= 0) {
        events.push({ type: 'message', text: 'Too slow — the package run failed. Try again.' });
        this.started = false; // restart the mission
        return;
      }
      if (dist2d(ctx.player.x, ctx.player.z, m.target.x, m.target.z) < REACH) {
        this._complete(events, ctx);
      }
      return;
    }

    if (m.id === 'heat') {
      const t = m.target;
      if (dist2d(ctx.player.x, ctx.player.z, t.x, t.z) < REACH) {
        if (ctx.wanted.stars <= 1) {
          this._complete(events, ctx);
        } else {
          // Only nag once every few seconds.
          if (!this._nagTimer || this._nagTimer <= 0) {
            events.push({ type: 'message', text: 'Lose the cops first — keep moving, don\u2019t let them stay close.' });
            this._nagTimer = 5;
          }
        }
      }
      if (this._nagTimer) this._nagTimer -= dt;
      return;
    }

    if (m.id === 'taxi') {
      if (this.phase === 'pickup') {
        const inTaxi = ctx.player.inCar && ctx.player.inCar.kind === 'taxi';
        if (!inTaxi) return; // need a taxi to take fares
        if (dist2d(ctx.player.x, ctx.player.z, this.farePickup.x, this.farePickup.z) < REACH) {
          this.phase = 'drop';
          events.push({ type: 'message', text: `Fare ${this.fare + 1} picked up. Drop them off.` });
        }
        return;
      }
      if (this.phase === 'drop') {
        if (dist2d(ctx.player.x, ctx.player.z, this.fareDrop.x, this.fareDrop.z) < REACH) {
          this.fare += 1;
          events.push({ type: 'message', text: `Fare ${this.fare} of 3 delivered. +$150` });
          ctx.player.addCash(150);
          if (this.fare >= 3) {
            this._complete(events, ctx);
          } else {
            this.phase = 'pickup';
            this._nextFare();
          }
        }
      }
      return;
    }

    if (m.id === 'score') {
      const inVan = ctx.player.inCar && ctx.player.inCar.kind === 'van';
      if (!inVan) return;
      const t = m.target;
      if (dist2d(ctx.player.x, ctx.player.z, t.x, t.z) < REACH) {
        this._complete(events, ctx);
      }
      return;
    }
  }

  _complete(events, ctx) {
    const m = this.current;
    ctx.player.addCash(m.reward);
    events.push({ type: 'mission-complete', mission: m, reward: m.reward });
    this.index += 1;
    this.started = false;
    this.phase = 'go';
    if (this.index >= MISSIONS.length) {
      this.debtPaid = ctx.player.cash >= DEBT;
      this._startSideJob();
    }
  }

  _startSideJob() {
    const streets = [-104, -52, 0, 52, 104];
    this.sideJob = {
      target: { x: this.rng.pick(streets), z: this.rng.pick(streets), label: 'Side Job' },
      phase: 'go',
      pay: 150,
    };
  }

  _updateSideJob(dt, ctx) {
    if (!this.sideJob) {
      this._startSideJob();
      return;
    }
    const job = this.sideJob;
    if (job.phase === 'go') {
      if (dist2d(ctx.player.x, ctx.player.z, job.target.x, job.target.z) < REACH) {
        job.phase = 'drop';
        const streets = [-104, -52, 0, 52, 104];
        job.drop = { x: this.rng.pick(streets), z: this.rng.pick(streets), label: 'Job Drop-off' };
        job.target = job.drop;
        ctx.events.push({ type: 'message', text: 'Side job: take the passenger to the drop-off. +$150' });
      }
      return;
    }
    if (dist2d(ctx.player.x, ctx.player.z, job.target.x, job.target.z) < REACH) {
      ctx.player.addCash(job.pay);
      ctx.events.push({ type: 'message', text: `Side job done. +$${job.pay}` });
      this.sideJob = null;
    }
  }

  toSave() {
    return { index: this.index, cash: undefined };
  }

  fromSave(index) {
    this.index = index;
    this.started = false;
    this.phase = 'go';
    this.fare = 0;
  }
}
