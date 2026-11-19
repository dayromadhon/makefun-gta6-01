// SOLMAR HEAT — wanted: the 0-5 star heat. Crimes add stars, police cars
// spawn to chase, and the heat cools off when no cop can see the player.
// Being held by a foot cop, or losing all health, gets Leo busted.
import { CFG } from './config.js';

export class Wanted {
  constructor(scene, city, vehicles, player, audio) {
    this.scene = scene;
    this.city = city;
    this.vehicles = vehicles;
    this.player = player;
    this.audio = audio;
    this.stars = 0;
    this.coolTimer = 0;
    this.spawnTimer = 0;
    this.busted = false;
    this.onBusted = null;
    this.onStarsChanged = null;
  }

  setStars(n) {
    const next = Math.max(0, Math.min(CFG.maxWanted, n));
    if (next !== this.stars) {
      this.stars = next;
      this.coolTimer = 0;
      if (this.onStarsChanged) this.onStarsChanged(next);
    }
  }

  addStars(n) {
    this.setStars(this.stars + n);
  }

  clear() {
    this.setStars(0);
  }

  // How many police cars the current heat calls for.
  wantedPolice() {
    if (this.stars === 0) return 0;
    return Math.min(4, 1 + Math.floor(this.stars / 2));
  }

  update(dt) {
    if (this.busted) return;
    const want = this.wantedPolice();
    // Spawn police at road points away from the player until we have enough.
    this.spawnTimer -= dt;
    if (this.vehicles.police.length < want && this.spawnTimer <= 0) {
      this.spawnTimer = 1.2;
      let p = null;
      for (let tries = 0; tries < 8; tries++) {
        const cand = this.city.randomRoadPoint();
        const d = Math.hypot(cand.x - this.player.x, cand.z - this.player.z);
        if (d > 45 && d < 110) {
          p = cand;
          break;
        }
      }
      if (p) this.vehicles.spawnPolice(p.x, p.z);
    }
    // Despawn police that fell far behind once the heat is gone.
    if (this.stars === 0) {
      for (const cop of [...this.vehicles.police]) {
        const d = Math.hypot(cop.x - this.player.x, cop.z - this.player.z);
        if (d > 130) this.vehicles.removeCar(cop);
      }
    }
    // Cool off: no cop within 45m for 10 seconds drops a star.
    if (this.stars > 0) {
      let nearest = Infinity;
      for (const cop of this.vehicles.police) {
        nearest = Math.min(nearest, Math.hypot(cop.x - this.player.x, cop.z - this.player.z));
      }
      if (nearest > 45) {
        this.coolTimer += dt;
        if (this.coolTimer > 10) {
          this.coolTimer = 0;
          this.setStars(this.stars - 1);
        }
      } else {
        this.coolTimer = 0;
      }
    }
    // Busted when health hits zero.
    if (this.player.health <= 0) this._bust('Leo is down. The Solmar PD picks him up.');
  }

  _bust(reason) {
    if (this.busted) return;
    this.busted = true;
    this.audio.busted();
    if (this.onBusted) this.onBusted(reason);
  }

  reset() {
    this.stars = 0;
    this.busted = false;
    this.coolTimer = 0;
    for (const cop of [...this.vehicles.police]) this.vehicles.removeCar(cop);
  }
}
