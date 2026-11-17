// Solmar Heat — the wanted level. One job: stars go up when Leo commits
// crimes, police cruisers chase him, and getting caught or going down
// costs cash. Shot mode (staged screenshots) suspends the fail states.
import { ECONOMY, PLACES } from './config.js';
import { clamp, dist2d } from './random.js';

export class Wanted {
  constructor(vehicles, peds, hooks) {
    this.vehicles = vehicles;
    this.peds = peds;
    this.hooks = hooks; // { onBusted(), onWasted(), onStarsChanged(n) }
    this.stars = 0;
    this.bustTimer = 0;
    this.hiddenTimer = 0;
    this.shotMode = false;
    this.spawnCooldown = 0;
  }

  get level() {
    return this.stars;
  }

  addStars(n, reason) {
    const before = this.stars;
    this.stars = clamp(this.stars + n, 0, 5);
    if (this.stars !== before && this.hooks.onStarsChanged) {
      this.hooks.onStarsChanged(this.stars, reason);
    }
    return this.stars;
  }

  setStars(n, reason) {
    const before = this.stars;
    this.stars = clamp(n, 0, 5);
    if (this.stars !== before && this.hooks.onStarsChanged) {
      this.hooks.onStarsChanged(this.stars, reason);
    }
    return this.stars;
  }

  // How many cruisers the current level fields.
  wantedCruisers() {
    return this.stars <= 0 ? 0 : this.stars <= 1 ? 1 : this.stars <= 2 ? 2 : this.stars <= 3 ? 3 : this.stars <= 4 ? 4 : 5;
  }

  update(dt, player) {
    this.spawnCooldown = Math.max(0, this.spawnCooldown - dt);
    // Keep the cruiser count matched to the stars.
    const want = this.wantedCruisers();
    while (this.vehicles.police.length < want && this.spawnCooldown <= 0) {
      const a = Math.random() * Math.PI * 2;
      const x = player.x + Math.sin(a) * 45;
      const z = player.z + Math.cos(a) * 45;
      const near = { x: clamp(x, -110, 110), z: clamp(z, -110, 110) };
      this.vehicles.spawnPolice(near.x, near.z);
      this.spawnCooldown = 0.8;
    }
    while (this.vehicles.police.length > want) {
      this.vehicles.removePolice(this.vehicles.police[this.vehicles.police.length - 1]);
    }

    if (this.shotMode) {
      this.bustTimer = 0;
      return;
    }

    // Busted: slow or stopped with a cruiser right on top of Leo.
    let nearestCop = Infinity;
    for (const cop of this.vehicles.police) {
      nearestCop = Math.min(nearestCop, dist2d(cop.x, cop.z, player.x, player.z));
    }
    const playerSpeed = Math.abs(player.carSpeed);
    const onFoot = !player.inCar;
    if (this.stars > 0 && nearestCop < (onFoot ? 3.2 : 4.5) && (onFoot || playerSpeed < 1.5)) {
      this.bustTimer += dt;
      if (this.bustTimer > (onFoot ? 2.2 : 3.0)) {
        this.bustTimer = 0;
        this.busted(player);
        return;
      }
    } else {
      this.bustTimer = Math.max(0, this.bustTimer - dt * 2);
    }

    // Wasted: health hit zero.
    if (player.health <= 0) {
      this.wasted(player);
      return;
    }

    // Heat cools off when no cruiser can see Leo for a while.
    if (this.stars > 0 && nearestCop > 38) {
      this.hiddenTimer += dt;
      if (this.hiddenTimer > 12) {
        this.hiddenTimer = 0;
        this.addStars(-1, 'cooled off');
      }
    } else {
      this.hiddenTimer = 0;
    }
  }

  busted(player) {
    const fine = Math.min(ECONOMY.bustFine, Math.max(0, player.cash - 0));
    player.cash = Math.max(0, player.cash - ECONOMY.bustFine);
    this.setStars(0, 'busted');
    player.respawnAt(PLACES.hospital.x, PLACES.hospital.z);
    if (this.hooks.onBusted) this.hooks.onBusted(fine);
    return fine;
  }

  wasted(player) {
    player.cash = Math.max(0, player.cash - ECONOMY.wastedFine);
    this.setStars(0, 'wasted');
    player.respawnAt(PLACES.hospital.x, PLACES.hospital.z);
    if (this.hooks.onWasted) this.hooks.onWasted(ECONOMY.wastedFine);
    return ECONOMY.wastedFine;
  }

  // Crime hooks the rest of the game calls.
  crimeStolenCar() {
    this.addStars(1, 'stole a car');
  }

  crimePedDown() {
    this.addStars(1, 'hit a pedestrian');
  }

  crimeShotFired() {
    this.addStars(1, 'shots fired');
  }
}
