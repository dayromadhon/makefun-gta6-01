// Solmar Heat — missions and side jobs.
// One job: the story's state machine — which mission is live, what its
// current step asks, whether it is done, and what it pays.

import { MISSIONS, SIDE_JOBS, PLACES } from './config.js';
import { mulberry32, range, pick } from './random.js';

export function createMissions(seed) {
  const rng = mulberry32(seed);
  const missions = {
    index: 0, // next story mission to play
    active: null, // {def, stepIndex, timer, holdTimer, taxiState, ...}
    done: [], // ids of finished story missions
    cash: 0,
    sideJob: null, // {kind, phase, pickup, drop, fare}
    message: '',
  };

  function startNext(ctx) {
    if (missions.index >= MISSIONS.length) {
      missions.active = null;
      if (ctx.hud) ctx.hud.toast('All story jobs done — free roam side jobs pay from here.');
      offerSideJob(ctx);
      return null;
    }
    const def = MISSIONS[missions.index];
    missions.active = {
      def,
      stepIndex: 0,
      timer: def.timeLimit || 0,
      holdTimer: 0,
      taxiDone: 0,
      taxiPhase: 'pickup',
      taxiPickup: null,
      taxiDrop: null,
    };
    // a taxi first step needs its first fare generated before play begins
    if (def.steps[0] && def.steps[0].kind === 'taxi') beginTaxiFare(ctx);
    if (ctx) ctx.screen = 'card';
    if (ctx.hud) ctx.hud.showMissionCard(def);
    return missions.active;
  }

  function step() {
    if (!missions.active) return null;
    return missions.active.def.steps[missions.active.stepIndex] || null;
  }

  function stepTarget() {
    const s = step();
    if (!s) return null;
    const m = missions.active;
    if (s.kind === 'taxi') {
      if (m.taxiPhase === 'pickup') return m.taxiPickup;
      return m.taxiDrop;
    }
    if (s.kind === 'steal') {
      // the marked car itself is the target
      return s.at;
    }
    return s.at;
  }

  function stepText() {
    const s = step();
    if (!s) return '';
    if (s.kind === 'taxi') {
      const m = missions.active;
      if (m.taxiPhase === 'pickup') return `Pick up fare ${m.taxiDone + 1} of ${s.fares}`;
      return `Drop off fare ${m.taxiDone + 1} of ${s.fares}`;
    }
    return s.text;
  }

  function randomStreetPoint() {
    const streets = [-80, -40, 0, 40, 80];
    return { x: pick(rng, streets), z: range(rng, -80, 80) };
  }

  function beginTaxiFare(ctx) {
    const m = missions.active;
    const p = randomStreetPoint();
    // drop somewhere across town
    let d = randomStreetPoint();
    while (Math.hypot(d.x - p.x, d.z - p.z) < 60) d = randomStreetPoint();
    m.taxiPickup = p;
    m.taxiDrop = d;
    m.taxiPhase = 'pickup';
    if (ctx.hud) ctx.hud.toast('New fare waiting — follow the marker.');
  }

  function completeStep(ctx) {
    const m = missions.active;
    const s = step();
    if (!s) return;
    m.stepIndex++;
    if (m.stepIndex >= m.def.steps.length) {
      completeMission(ctx);
      return;
    }
    const next = step();
    if (next && next.kind === 'taxi') beginTaxiFare(ctx);
    if (ctx.hud) ctx.hud.toast(next ? next.text : '');
  }

  function completeMission(ctx) {
    const m = missions.active;
    missions.cash += m.def.payout;
    missions.done.push(m.def.id);
    missions.index++;
    missions.active = null;
    if (ctx.audio) ctx.audio.missionDone();
    if (ctx.hud) ctx.hud.showPayout(m.def.payout, m.def.title);
    if (ctx.save) ctx.save();
  }

  function offerSideJob(ctx) {
    if (missions.sideJob) return;
    const kind = rng() < 0.6 ? 'taxi' : 'courier';
    const p = randomStreetPoint();
    let d = randomStreetPoint();
    while (Math.hypot(d.x - p.x, d.z - p.z) < 60) d = randomStreetPoint();
    const fare = kind === 'taxi'
      ? Math.round(range(rng, SIDE_JOBS.taxiFare.min, SIDE_JOBS.taxiFare.max))
      : Math.round(range(rng, SIDE_JOBS.courier.min, SIDE_JOBS.courier.max));
    missions.sideJob = { kind, phase: 'pickup', pickup: p, drop: d, fare };
    if (ctx.hud) ctx.hud.toast(kind === 'taxi' ? `Side job: taxi fare $${fare}` : `Side job: courier run $${fare}`);
  }

  function update(dt, ctx) {
    const m = missions.active;
    const player = ctx.player;
    if (m) {
      const s = step();
      if (!s) return;
      // mission timers run only while the timed step is live
      if (s.timed && m.timer > 0) {
        m.timer -= dt;
        if (m.timer <= 0) {
          if (ctx.hud) ctx.hud.toast('Too slow — the package run failed. Try the job again.');
          // restart this mission from its first step
          m.stepIndex = 0;
          m.timer = m.def.timeLimit || 0;
          m.taxiDone = 0;
          return;
        }
      }
      const px = player.x;
      const pz = player.z;
      if (s.kind === 'goto' || s.kind === 'pickup') {
        const t = s.at;
        if (Math.hypot(px - t.x, pz - t.z) < 8) completeStep(ctx);
      } else if (s.kind === 'evade') {
        const t = s.at;
        if (Math.hypot(px - t.x, pz - t.z) < 10) completeStep(ctx);
      } else if (s.kind === 'hide') {
        const t = s.at;
        const near = Math.hypot(px - t.x, pz - t.z) < 12;
        if (near && ctx.wanted.stars === 0) {
          m.holdTimer += dt;
          if (m.holdTimer >= (s.holdSeconds || 8)) completeStep(ctx);
        } else {
          m.holdTimer = Math.max(0, m.holdTimer - dt * 2);
        }
      } else if (s.kind === 'taxi') {
        if (m.taxiPhase === 'pickup') {
          if (Math.hypot(px - m.taxiPickup.x, pz - m.taxiPickup.z) < 7) {
            m.taxiPhase = 'drop';
            if (ctx.hud) ctx.hud.toast('Fare aboard — take them to the marker.');
          }
        } else if (Math.hypot(px - m.taxiDrop.x, pz - m.taxiDrop.z) < 7) {
          m.taxiDone++;
          if (ctx.audio) ctx.audio.pickup();
          if (m.taxiDone >= s.fares) {
            completeStep(ctx);
          } else {
            beginTaxiFare(ctx);
          }
        }
      } else if (s.kind === 'steal') {
        // completed by main.js when the player enters the marked car
      }
    } else if (missions.index >= MISSIONS.length) {
      // free-roam side jobs
      if (!missions.sideJob) offerSideJob(ctx);
      const j = missions.sideJob;
      if (j) {
        const t = j.phase === 'pickup' ? j.pickup : j.drop;
        if (Math.hypot(player.x - t.x, player.z - t.z) < 7) {
          if (j.phase === 'pickup') {
            j.phase = 'drop';
            if (ctx.hud) ctx.hud.toast('Got it — deliver to the marker.');
          } else {
            missions.cash += j.fare;
            if (ctx.audio) ctx.audio.missionDone();
            if (ctx.hud) ctx.hud.showPayout(j.fare, j.kind === 'taxi' ? 'Taxi fare' : 'Courier run');
            missions.sideJob = null;
            if (ctx.save) ctx.save();
          }
        }
      }
    }
  }

  missions.startNext = startNext;
  missions.step = step;
  missions.stepTarget = stepTarget;
  missions.stepText = stepText;
  missions.beginTaxiFare = beginTaxiFare;
  missions.completeStep = completeStep;
  missions.completeMission = completeMission;
  missions.update = update;
  missions.offerSideJob = offerSideJob;
  missions.places = PLACES;
  return missions;
}
