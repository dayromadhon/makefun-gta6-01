// SOLMAR HEAT — wanted.js
// One job: the wanted level. Heat rises with crimes, falls when the player
// stays out of sight, and police cars spawn and chase while stars are up.
// A bust happens when a cop stays close for long enough.

import { CONFIG } from './config.js';
import { range } from './random.js';

export class Wanted {
  constructor(vehicles, rng, audio) {
    this.vehicles = vehicles;
    this.rng = rng;
    this.audio = audio;
    this.heat = 0; // 0..5, fractional; stars = floor
    this.stars = 0;
    this.bustTimer = 0;
    this.busted = false;
    this._spawnT = 0;
    this._sirenOn = false;
  }

  get level() {
    return this.stars;
  }

  addHeat(amount) {
    this.heat = Math.min(CONFIG.maxStars, this.heat + amount);
    this._syncStars();
  }

  setHeat(value) {
    this.heat = Math.max(0, Math.min(CONFIG.maxStars, value));
    this._syncStars();
  }

  clear() {
    this.heat = 0;
    this._syncStars();
    this.bustTimer = 0;
    this.busted = false;
    for (const cop of [...this.vehicles.police]) this.vehicles.removePolice(cop);
    this._setSiren(false);
  }

  _syncStars() {
    // Round to the nearest whole star: heat decays continuously, so a plain
    // floor drops a fresh 1.0 heat to 0 stars after a single decay tick.
    const s = Math.round(this.heat);
    if (s !== this.stars) {
      this.stars = s;
      this._setSiren(s > 0);
    }
  }

  _setSiren(on) {
    if (on === this._sirenOn) return;
    this._sirenOn = on;
    this.audio.siren(on);
  }

  // One frame. target = {x, z, inCar, speed}. visible = whether any cop can
  // currently see the player (close enough). Returns 'busted' once when the
  // bust completes, else null.
  update(dt, target, visible) {
    if (this.busted) return null;
    // Heat decays only while no cop sees the player.
    if (!visible && this.stars > 0) {
      this.heat = Math.max(0, this.heat - CONFIG.heatDecayPerSec * dt);
      this._syncStars();
    }
    // Spawn police while wanted, up to a cap that grows with stars.
    const want = Math.min(CONFIG.maxCops, this.stars * 2);
    this._spawnT -= dt;
    if (this.vehicles.police.length < want && this._spawnT <= 0) {
      this._spawnT = 1.2;
      const a = this.rng() * Math.PI * 2;
      const r = CONFIG.copSpawnRadius;
      const x = target.x + Math.sin(a) * r;
      const z = target.z + Math.cos(a) * r;
      this.vehicles.spawnPolice(x, z);
    }
    // Remove extra cops when the level falls.
    while (this.vehicles.police.length > want) {
      this.vehicles.removePolice(this.vehicles.police[this.vehicles.police.length - 1]);
    }
    // Chase.
    this.vehicles.updatePolice(dt, target);
    // Bust: a cop within bust radius for bustHoldSec.
    let near = false;
    for (const cop of this.vehicles.police) {
      const d = Math.hypot(cop.x - target.x, cop.z - target.z);
      if (d < CONFIG.bustRadius) {
        near = true;
        break;
      }
    }
    if (near && this.stars > 0) {
      this.bustTimer += dt;
      if (this.bustTimer >= CONFIG.bustHoldSec) {
        this.busted = true;
        this.audio.siren(false);
        this._sirenOn = false;
        this.audio.busted();
        return 'busted';
      }
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }
    return null;
  }

  // How visible the player is to the police right now (any cop within 40u).
  visibleToPolice(target) {
    for (const cop of this.vehicles.police) {
      if (Math.hypot(cop.x - target.x, cop.z - target.z) < 40) return true;
    }
    return false;
  }
}
