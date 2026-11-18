// SOLMAR HEAT — missions. Five story jobs that pay off Leo's $4,500 debt,
// then taxi side jobs in free roam. A mission is a small state machine:
// it gives an objective, watches the player's position and actions, and
// pays out on completion.

import * as THREE from 'three';
import { CFG, MISSIONS } from './config.js';

function makeMarker(color = 0xffd21f) {
  // A tall glowing beacon column + a floating diamond, easy to see.
  const g = new THREE.Group();
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.9, 0.9, 60, 10, 1, true),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  beam.position.y = 30;
  g.add(beam);
  const diamond = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1),
    new THREE.MeshBasicMaterial({ color }),
  );
  diamond.position.y = 6;
  g.add(diamond);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(2.2, 0.18, 8, 24),
    new THREE.MeshBasicMaterial({ color }),
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.25;
  g.add(ring);
  g.userData.diamond = diamond;
  return g;
}

export class Missions {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.index = 0; // 0-based mission index; 5 = all done (free roam)
    this.state = 'idle'; // idle | active | done
    this.marker = makeMarker();
    this.marker.visible = false;
    this.scene.add(this.marker);
    this.objective = null; // {x, z, radius, label}
    this.timer = 0;
    this.taxi = null; // active taxi fare {pickup, drop, fare, phase}
    this.taxiDone = 0;
    this.taxiTarget = 3;
    this.packageHeld = false;
    this.debtPaid = false;
    this.onEvent = null;
  }
  get current() {
    return MISSIONS[this.index] || null;
  }
  get allDone() {
    return this.index >= MISSIONS.length;
  }
  _setObjective(x, z, radius, label) {
    this.objective = { x, z, radius, label };
    this.marker.position.set(x, 0, z);
    this.marker.visible = true;
  }
  _clearObjective() {
    this.objective = null;
    this.marker.visible = false;
  }
  start() {
    if (this.allDone) return;
    this.state = 'active';
    const m = this.current;
    if (m.id === 1) {
      // Steal any car, then drive it to the garage.
      this.phase = 'steal';
      this._clearObjective();
    } else if (m.id === 2) {
      this.phase = 'pickup';
      const p = this.city.places.marina;
      this._setObjective(p.x, p.z, 5, 'Pick up the package');
    } else if (m.id === 3) {
      this.phase = 'escape';
      this._clearObjective();
    } else if (m.id === 4) {
      this.phase = 'taxi';
      this.taxiDone = 0;
      this._nextFare();
    } else if (m.id === 5) {
      this.phase = 'steal-van';
      this._clearObjective();
    }
    this.onEvent && this.onEvent('mission-start', m);
  }
  _nextFare() {
    const spots = [
      this.city.places.hotel,
      this.city.places.beach,
      this.city.places.marina,
      this.city.places.garage,
      this.city.places.pier,
      this.city.places.hideout,
    ];
    const pickup = spots[Math.floor(this.rng.f() * spots.length)];
    let drop = spots[Math.floor(this.rng.f() * spots.length)];
    if (drop === pickup) drop = spots[(spots.indexOf(pickup) + 2) % spots.length];
    const fare = this.rng.int(CFG.TAXI_FARE_MIN, CFG.TAXI_FARE_MAX);
    this.taxi = { pickup, drop, fare, phase: 'pickup' };
    this._setObjective(pickup.x, pickup.z, 5, 'Pick up the fare');
  }
  _complete(player, game) {
    const m = this.current;
    const pay = m.pay;
    game.cash += pay;
    game.debt = Math.max(0, game.debt - pay);
    this._clearObjective();
    this.state = 'done';
    this.index += 1;
    if (game.debt <= 0) this.debtPaid = true;
    this.onEvent && this.onEvent('mission-done', m, pay);
    if (!this.allDone) {
      this.state = 'idle';
    }
  }
  _fail(reason) {
    this.onEvent && this.onEvent('mission-fail', reason);
  }
  // Called every frame while playing. Returns nothing; fires onEvent.
  update(dt, player, game) {
    if (this.state !== 'active' || !this.current) return;
    const m = this.current;
    const pp = player.pos;
    // Marker bob.
    if (this.marker.visible) {
      this.marker.userData.diamond.rotation.y += dt * 2;
      this.marker.userData.diamond.position.y = 6 + Math.sin(performance.now() / 300) * 0.5;
    }
    if (m.id === 1) {
      if (this.phase === 'steal' && player.inCar) {
        this.phase = 'deliver';
        const g = this.city.places.garage;
        this._setObjective(g.x, g.z, 6, 'Drive to Ada\u2019s garage');
        this.onEvent && this.onEvent('objective', 'Drive to Ada\u2019s garage');
      } else if (this.phase === 'deliver' && player.inCar) {
        const g = this.city.places.garage;
        if (Math.hypot(pp.x - g.x, pp.z - g.z) < 6) this._complete(player, game);
      }
    } else if (m.id === 2) {
      if (this.phase === 'pickup') {
        const p = this.city.places.marina;
        if (Math.hypot(pp.x - p.x, pp.z - p.z) < 5) {
          this.phase = 'deliver';
          this.packageHeld = true;
          this.timer = m.timeLimit;
          const h = this.city.places.hotel;
          this._setObjective(h.x, h.z, 6, 'Deliver to Hotel Solmar');
          this.onEvent && this.onEvent('objective', 'Package picked up — deliver fast!');
        }
      } else if (this.phase === 'deliver') {
        this.timer -= dt;
        if (this.timer <= 0) {
          this._fail('Out of time on the package run.');
          this.state = 'idle';
          this.phase = 'pickup';
          this.packageHeld = false;
          const p = this.city.places.marina;
          this._setObjective(p.x, p.z, 5, 'Pick up the package');
          return;
        }
        const h = this.city.places.hotel;
        if (Math.hypot(pp.x - h.x, pp.z - h.z) < 6) {
          this.packageHeld = false;
          this._complete(player, game);
        }
      }
    } else if (m.id === 3) {
      if (this.phase === 'escape') {
        // The mission starts with 2 stars (set by main). Escape = wanted 0.
        if (game.wanted.level === 0) {
          this.phase = 'pier';
          const p = this.city.places.pier;
          this._setObjective(p.x, p.z, 6, 'Reach the pier');
          this.onEvent && this.onEvent('objective', 'Heat is off — get to the pier');
        }
      } else if (this.phase === 'pier') {
        const p = this.city.places.pier;
        if (Math.hypot(pp.x - p.x, pp.z - p.z) < 6) this._complete(player, game);
      }
    } else if (m.id === 4) {
      if (!this.taxi) return;
      if (this.taxi.phase === 'pickup') {
        const p = this.taxi.pickup;
        if (Math.hypot(pp.x - p.x, pp.z - p.z) < 5) {
          this.taxi.phase = 'drop';
          this._setObjective(this.taxi.drop.x, this.taxi.drop.z, 6, 'Drop the fare');
          this.onEvent && this.onEvent('objective', 'Fare aboard — drop them off');
        }
      } else {
        const d = this.taxi.drop;
        if (Math.hypot(pp.x - d.x, pp.z - d.z) < 6) {
          game.cash += this.taxi.fare;
          game.debt = Math.max(0, game.debt - this.taxi.fare);
          this.taxiDone += 1;
          this.onEvent && this.onEvent('fare-done', this.taxi.fare, this.taxiDone);
          if (this.taxiDone >= this.taxiTarget) {
            this.taxi = null;
            this._complete(player, game);
          } else {
            this._nextFare();
          }
        }
      }
    } else if (m.id === 5) {
      if (this.phase === 'steal-van') {
        if (player.inCar && player.car && player.car.kind === 'van') {
          this.phase = 'deliver';
          const h = this.city.places.hideout;
          this._setObjective(h.x, h.z, 6, 'Bring the van to the hideout');
          this.onEvent && this.onEvent('objective', 'Van stolen — bring it to the hideout');
        }
      } else if (this.phase === 'deliver') {
        const h = this.city.places.hideout;
        if (player.inCar && Math.hypot(pp.x - h.x, pp.z - h.z) < 6) {
          this._complete(player, game);
        }
      }
    }
  }
  // Free-roam side job: a taxi fare the player can take any time after the
  // story is done (or between missions). Reuses the fare flow.
  startSideFare() {
    if (this.taxi) return;
    this._nextFare();
    this.taxi.side = true;
    this.onEvent && this.onEvent('objective', 'Side fare: pick up the passenger');
  }
  updateSideFare(dt, player, game) {
    if (!this.taxi || !this.taxi.side) return;
    const pp = player.pos;
    if (this.taxi.phase === 'pickup') {
      const p = this.taxi.pickup;
      if (Math.hypot(pp.x - p.x, pp.z - p.z) < 5) {
        this.taxi.phase = 'drop';
        this._setObjective(this.taxi.drop.x, this.taxi.drop.z, 6, 'Drop the fare');
      }
    } else {
      const d = this.taxi.drop;
      if (Math.hypot(pp.x - d.x, pp.z - d.z) < 6) {
        game.cash += this.taxi.fare;
        this.taxi = null;
        this._clearObjective();
        this.onEvent && this.onEvent('fare-done', this.taxi ? 0 : 0, 0);
        this.onEvent && this.onEvent('objective', 'Fare complete');
      }
    }
  }
}
