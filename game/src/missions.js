// SOLMAR HEAT — missions: the five story jobs plus repeatable side work.
// Each mission is a list of steps; a step is done by reaching a marker,
// stealing a car, or finishing taxi fares. Rewards pay down Leo's $4,500 debt.
import { CFG, MISSIONS, PLACES } from './config.js';

export class Missions {
  constructor(city, rng) {
    this.city = city;
    this.rng = rng;
    this.index = 0;
    this.step = 0;
    this.cash = 0;
    this.debtPaid = false;
    this.active = false;
    this.timer = 0;
    this.marker = null;
    this.taxiFares = 0;
    this.taxiState = 'pickup';
    this.sideJob = null;
    this.sideCount = 0;
    this.onCard = null;
    this.onComplete = null;
    this.onFailed = null;
    this.onCash = null;
    this.onDebtPaid = null;
    this.onObjective = null;
  }

  get current() {
    return MISSIONS[this.index] || null;
  }

  get debtLeft() {
    return Math.max(0, CFG.debtTotal - this.cash);
  }

  start() {
    this.active = true;
    this.step = 0;
    this.timer = 0;
    this.taxiFares = 0;
    this.taxiState = 'pickup';
    this._enterStep();
    const m = this.current;
    if (m && this.onCard) this.onCard(m.name, m.brief, `$${m.reward}`);
  }

  _enterStep() {
    const m = this.current;
    if (!m) {
      this.marker = null;
      return;
    }
    const step = m.steps[this.step];
    if (!step) {
      this._completeMission();
      return;
    }
    this.timer = step.timer || 0;
    if (step.kind === 'goto') {
      const place = PLACES[step.at];
      this.marker = { x: place.x, z: place.z, label: place.label };
    } else if (step.kind === 'taxi') {
      this.marker = this._taxiMarker();
    } else {
      this.marker = null;
    }
    if (this.onObjective) this.onObjective(this.objectiveText());
  }

  _taxiMarker() {
    const p = this.city.randomRoadPoint();
    return { x: p.x, z: p.z, label: this.taxiState === 'pickup' ? 'Passenger' : 'Drop-off' };
  }

  objectiveText() {
    const m = this.current;
    if (!m) return this.debtPaid ? 'Free roam — side jobs pay extra cash' : '';
    const step = m.steps[this.step];
    if (!step) return '';
    if (step.kind === 'taxi') {
      return `Taxi fares ${this.taxiFares}/${step.count} — ${this.taxiState === 'pickup' ? 'pick up the passenger' : 'drop them off'}`;
    }
    return step.text;
  }

  // The player stole a car (or the van). Advance steal steps.
  onSteal(car) {
    if (!this.active) return;
    const m = this.current;
    if (!m) return;
    const step = m.steps[this.step];
    if (!step) return;
    if (step.kind === 'steal') {
      this._advance();
    } else if (step.kind === 'stealVan' && car.isVan) {
      this._advance();
    }
  }

  _advance() {
    this.step += 1;
    this._enterStep();
  }

  _completeMission() {
    const m = this.current;
    this.active = false;
    this.marker = null;
    if (m) {
      this.cash += m.reward;
      if (this.onCash) this.onCash(this.cash);
    }
    this.index += 1;
    if (this.debtLeft <= 0 && !this.debtPaid) {
      this.debtPaid = true;
      if (this.onDebtPaid) this.onDebtPaid();
    }
    // onComplete fires after the index advanced, so a save written by its
    // handler records the next mission, not the one just finished.
    if (this.onComplete) this.onComplete(m);
    if (this.index >= MISSIONS.length) {
      // Story done: side jobs keep paying.
      this._startSideJob();
    }
    // Otherwise the next mission starts when the player dismisses the
    // complete card (the Game sets pendingNextMission and calls start()).
  }

  _startSideJob() {
    this.sideCount += 1;
    // Alternate a quick taxi fare and a package run.
    this.sideJob = this.sideCount % 2 === 1 ? 'taxi' : 'package';
    this.taxiFares = 0;
    this.taxiState = 'pickup';
    if (this.sideJob === 'taxi') {
      this.marker = this._taxiMarker();
    } else {
      const place = PLACES.marina;
      this.marker = { x: place.x, z: place.z, label: 'Package pickup' };
    }
    if (this.onObjective) {
      this.onObjective(this.sideJob === 'taxi' ? 'Side job: one taxi fare ($150)' : 'Side job: package run ($250)');
    }
  }

  _completeSideJob() {
    const reward = this.sideJob === 'taxi' ? 150 : 250;
    this.cash += reward;
    this.sideJob = null;
    this.marker = null;
    if (this.onCash) this.onCash(this.cash);
    if (this.onComplete) this.onComplete({ name: 'Side job done', reward, brief: `+$${reward} in the pocket.` });
    if (this.debtLeft <= 0 && !this.debtPaid) {
      this.debtPaid = true;
      if (this.onDebtPaid) this.onDebtPaid();
    }
    this._startSideJob();
  }

  update(dt, player, wanted) {
    if (this.timer > 0) {
      this.timer -= dt;
      if (this.timer <= 0) {
        this.timer = 0;
        if (this.onFailed) this.onFailed('Out of time — the package run failed. Try it again.');
        this.start();
        return;
      }
    }
    // Side jobs run even after the story ends.
    if (this.sideJob) {
      if (!this.marker) return;
      const d = Math.hypot(player.x - this.marker.x, player.z - this.marker.z);
      if (d < 7) {
        if (this.sideJob === 'taxi') {
          if (this.taxiState === 'pickup') {
            if (!player.onFoot) {
              this.taxiState = 'dropoff';
              this.marker = this._taxiMarker();
              if (this.onObjective) this.onObjective('Side job: drop the passenger off');
            }
          } else {
            this._completeSideJob();
          }
        } else if (this.sideJob === 'package') {
          if (this.marker.label === 'Package pickup') {
            const place = PLACES.hotel;
            this.marker = { x: place.x, z: place.z, label: 'Hotel Solmar' };
            if (this.onObjective) this.onObjective('Side job: deliver to Hotel Solmar');
          } else {
            this._completeSideJob();
          }
        }
      }
      return;
    }
    if (!this.active) return;
    const m = this.current;
    if (!m) return;
    const step = m.steps[this.step];
    if (!step) return;
    if (step.kind === 'goto') {
      if (!this.marker) return;
      const d = Math.hypot(player.x - this.marker.x, player.z - this.marker.z);
      if (d < 7) {
        if (step.wanted) wanted.clear();
        this._advance();
      }
    } else if (step.kind === 'taxi') {
      if (!this.marker) return;
      const d = Math.hypot(player.x - this.marker.x, player.z - this.marker.z);
      if (d < 6) {
        if (this.taxiState === 'pickup') {
          if (!player.onFoot) {
            this.taxiState = 'dropoff';
            this.marker = this._taxiMarker();
            if (this.onObjective) this.onObjective(this.objectiveText());
          }
        } else {
          this.taxiFares += 1;
          if (this.taxiFares >= step.count) {
            this._advance();
          } else {
            this.taxiState = 'pickup';
            this.marker = this._taxiMarker();
            if (this.onObjective) this.onObjective(this.objectiveText());
          }
        }
      }
    }
  }
}
