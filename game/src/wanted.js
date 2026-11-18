// The wanted system: heat 0..5, stars shown as a whole number. Crimes add heat;
// laying low lets it decay. Police cars spawn per star level, chase and ram,
// and a slow player caught close to a police car gets busted.

import { WANTED } from './config.js';
import { clamp, dist2d } from './random.js';

export class WantedSystem {
  constructor() {
    this.heat = 0;
    this.bustTimer = 0;
    this.busted = false;
    this.heatFlash = 0; // brief timer after a crime, for the HUD flash
  }

  get stars() {
    // Round, never floor: 1.0 heat is one star, not zero.
    return clamp(Math.round(this.heat), 0, WANTED.maxStars);
  }

  addHeat(amount, reason) {
    this.heat = clamp(this.heat + amount, 0, WANTED.maxStars);
    this.heatFlash = 1.2;
    return this.stars;
  }

  setHeat(amount) {
    this.heat = clamp(amount, 0, WANTED.maxStars);
    this.heatFlash = 1.2;
  }

  clear() {
    this.heat = 0;
    this.bustTimer = 0;
    this.busted = false;
  }

  /** Per-frame: decay, bust check, police spawn count. */
  update(dt, playerPos, playerSpeed, policeCars) {
    this.heatFlash = Math.max(0, this.heatFlash - dt);
    // Heat decays only when no police car is close.
    const nearestPolice = policeCars.reduce((m, p) => Math.min(m, dist2d(playerPos.x, playerPos.z, p.x, p.z)), 999);
    if (nearestPolice > 25) {
      this.heat = Math.max(0, this.heat - WANTED.decayPerSec * dt);
    }
    // Busted: a police car is close and the player is slow or on foot.
    const close = nearestPolice < WANTED.bustDistance;
    if (close && playerSpeed < 3) {
      this.bustTimer += dt;
      if (this.bustTimer >= WANTED.bustTime) {
        this.busted = true;
      }
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }
    return WANTED.policePerStar[this.stars];
  }

  /** Police ramming damage: called when a police car touches the player. */
  policeTouchDamage(player, policeCars, dt) {
    for (const p of policeCars) {
      const d = dist2d(player.x, player.z, p.x, p.z);
      if (d < 3.2) {
        const wasHit = player.takeDamage(8 * dt);
        if (wasHit) return true;
      }
    }
    return false;
  }
}
