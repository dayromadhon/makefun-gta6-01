// Solmar Heat — story missions and side jobs. One job: turn the five
// story beats (and free-roam work after them) into objectives the player
// can complete, with timers, rewards and failure.
import { MISSIONS, PLACES, ECONOMY } from './config.js';
import { range, intRange, pick, dist2d } from './random.js';

const ARRIVE_CAR = 8;
const ARRIVE_FOOT = 6;

export class Missions {
  constructor(scene, rng, hooks) {
    this.scene = scene;
    this.rng = rng;
    this.hooks = hooks; // { onObjective(t), onComplete(m, reward), onFailed(m, why), onStage(t) }
    this.index = 0; // next story mission
    this.done = [];
    this.current = null; // { def, stage, target, timeLeft, fare, hideTimer, farePed }
    this.sideJob = null;
    this.freeRoam = false;
    // The objective beacon: a floating marker above the current target.
    this.beacon = new THREE.Group();
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(1.1, 2.2, 4),
      new THREE.MeshLambertMaterial({ color: 0xffd23e, emissive: 0x664400 }),
    );
    cone.rotation.x = Math.PI;
    cone.position.y = 3.2;
    this.beacon.add(cone);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 2.1, 24),
      new THREE.MeshBasicMaterial({ color: 0xffd23e, side: THREE.DoubleSide, transparent: true, opacity: 0.7 }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.25;
    this.beacon.add(ring);
    this.beacon.visible = false;
    scene.add(this.beacon);
    this.beaconTime = 0;
  }

  get active() {
    return this.current !== null;
  }

  get storyDone() {
    return this.index >= MISSIONS.length;
  }

  startMission(i) {
    const def = MISSIONS[i];
    if (!def) return null;
    this.current = {
      def,
      stage: 'start',
      target: null,
      timeLeft: 0,
      hideTimer: 0,
      fare: 0,
      farePed: null,
      fareDest: null,
    };
    this.setupStage(def.id, 'start');
    return def;
  }

  setupStage(id, stage) {
    const c = this.current;
    c.stage = stage;
    if (id === 'first-wheels') {
      if (stage === 'start') {
        c.target = { x: PLACES.sedanSpot.x, z: PLACES.sedanSpot.z, label: 'Steal the sedan' };
        this.say('Steal a car — any parked sedan will do. Press E next to one.');
      } else if (stage === 'deliver') {
        c.target = { x: PLACES.garage.x, z: PLACES.garage.z, label: "Ada's Garage" };
        this.say("Bring the car to Ada's Garage, west end of the beach road.");
      }
    } else if (id === 'package-run') {
      if (stage === 'start') {
        c.timeLeft = 100;
        c.target = { x: PLACES.marinaPickup.x, z: PLACES.marinaPickup.z, label: 'Marina Pickup' };
        this.say('Grab the package at the marina, then run it to the Hotel Solmar. 100 seconds.');
      } else if (stage === 'deliver') {
        c.target = { x: PLACES.hotel.x, z: PLACES.hotel.z, label: 'Hotel Solmar' };
        this.say('Package secured. Now the Hotel Solmar — fast.');
      }
    } else if (id === 'lose-heat') {
      if (stage === 'start') {
        c.target = { x: PLACES.pier.x, z: PLACES.pier.z, label: 'South Pier' };
        this.say('Two stars on you. Break away and get to the South Pier.');
      } else if (stage === 'hide') {
        c.target = { x: PLACES.pier.x, z: PLACES.pier.z, label: 'South Pier — stay hidden' };
        c.hideTimer = 0;
        this.say('Stay at the pier and out of sight until the heat dies down.');
      }
    } else if (id === 'night-shift') {
      if (stage === 'start') {
        c.fare = 0;
        this.nextFare();
      }
    } else if (id === 'big-score') {
      if (stage === 'start') {
        c.target = { x: PLACES.vanSpot.x, z: PLACES.vanSpot.z, label: 'Steal the courier van' };
        this.say('The courier van is parked at the East Depot. Take it.');
      } else if (stage === 'deliver') {
        c.target = { x: PLACES.hideout.x, z: PLACES.hideout.z, label: 'Hideout' };
        this.say('Van secured. Bring it to the hideout — this one clears the debt.');
      }
    }
    this.placeBeacon();
  }

  nextFare() {
    const c = this.current;
    c.fare += 1;
    if (c.fare > 3) {
      this.complete();
      return;
    }
    // A fare waits at a random street corner near the player.
    const spot = this.hooks.pickFareSpot();
    c.farePed = this.hooks.spawnFarePed(spot.x, spot.z);
    c.target = { x: spot.x, z: spot.z, label: `Fare ${c.fare}/3 — pick up` };
    c.stage = 'pickup';
    this.say(`Fare ${c.fare} of 3 is waiting. Pick them up — you need a car.`);
    this.placeBeacon();
  }

  say(text) {
    if (this.hooks.onObjective) this.hooks.onObjective(text);
  }

  placeBeacon() {
    if (this.current && this.current.target) {
      this.beacon.visible = true;
      this.beacon.position.set(this.current.target.x, 0, this.current.target.z);
    } else {
      this.beacon.visible = false;
    }
  }

  complete() {
    const c = this.current;
    if (!c) return;
    const reward = c.def.reward;
    this.hooks.award(reward);
    this.done.push(c.def.id);
    this.index += 1;
    this.current = null;
    this.beacon.visible = false;
    if (this.hooks.onComplete) this.hooks.onComplete(c.def, reward);
    if (this.index >= MISSIONS.length) {
      this.freeRoam = true;
      if (this.hooks.onStoryDone) this.hooks.onStoryDone();
    }
  }

  fail(why) {
    const c = this.current;
    if (!c) return;
    const def = c.def;
    this.current = null;
    this.beacon.visible = false;
    if (this.hooks.onFailed) this.hooks.onFailed(def, why);
  }

  // Side jobs in free roam: a taxi fare or a courier run.
  startSideJob(player) {
    const rng = this.rng;
    const kind = rng() < 0.55 ? 'taxi' : 'courier';
    if (kind === 'taxi') {
      const spot = this.hooks.pickFareSpot();
      const ped = this.hooks.spawnFarePed(spot.x, spot.z);
      const dest = pick(rng, [PLACES.hotel, PLACES.garage, PLACES.pier, PLACES.hideout]);
      this.sideJob = {
        kind: 'taxi', stage: 'pickup', ped,
        target: { x: spot.x, z: spot.z, label: 'Taxi fare — pick up' },
        dest: { x: dest.x, z: dest.z, label: dest.label },
        reward: intRange(rng, ECONOMY.sideTaxiMin, ECONOMY.sideTaxiMax),
      };
      this.say('A taxi fare is waiting. Pick them up.');
    } else {
      const dest = pick(rng, [PLACES.hotel, PLACES.marinaPickup, PLACES.hideout, PLACES.pier]);
      this.sideJob = {
        kind: 'courier', stage: 'pickup', ped: null,
        target: { x: PLACES.depot.x, z: PLACES.depot.z, label: 'Courier pickup — East Depot' },
        dest: { x: dest.x, z: dest.z, label: dest.label },
        reward: intRange(rng, ECONOMY.sideCourierMin, ECONOMY.sideCourierMax),
      };
      this.say('Courier run: collect the parcel at the East Depot.');
    }
    this.beacon.visible = true;
    this.beacon.position.set(this.sideJob.target.x, 0, this.sideJob.target.z);
  }

  completeSideJob() {
    const job = this.sideJob;
    if (!job) return;
    this.hooks.award(job.reward);
    this.say(`Side job done — +$${job.reward}.`);
    this.sideJob = null;
    this.beacon.visible = false;
    // Chain the next one after a breath.
    setTimeout(() => {
      if (this.freeRoam && !this.sideJob && !this.current) {
        this.startSideJob();
      }
    }, 4000);
  }

  update(dt, player, vehicles, peds, wanted) {
    this.beaconTime += dt;
    if (this.beacon.visible) {
      this.beacon.children[0].position.y = 3.2 + Math.sin(this.beaconTime * 3) * 0.5;
      this.beacon.children[0].rotation.y = this.beaconTime * 1.5;
    }
    const c = this.current;
    if (c) this.updateStory(dt, player, vehicles, peds, wanted);
    else if (this.sideJob) this.updateSide(dt, player);
  }

  updateStory(dt, player, vehicles, peds, wanted) {
    const c = this.current;
    const id = c.def.id;
    const d = dist2d(player.x, player.z, c.target ? c.target.x : 0, c.target ? c.target.z : 0);

    if (id === 'first-wheels') {
      if (c.stage === 'start' && player.inCar) {
        this.setupStage(id, 'deliver');
      } else if (c.stage === 'deliver' && player.inCar && d < ARRIVE_CAR) {
        this.complete();
      }
    } else if (id === 'package-run') {
      c.timeLeft -= dt;
      if (c.timeLeft <= 0) {
        this.fail('Out of time — the package run failed.');
        return;
      }
      if (c.stage === 'start' && d < ARRIVE_FOOT) {
        this.setupStage(id, 'deliver');
      } else if (c.stage === 'deliver' && d < ARRIVE_CAR) {
        this.complete();
      }
    } else if (id === 'lose-heat') {
      if (c.stage === 'start') {
        if (d < 10) {
          this.setupStage(id, 'hide');
          // Cops search where Leo was, not where he is.
          if (this.hooks.setHuntPoint) {
            this.hooks.setHuntPoint({ x: player.x + 60, z: player.z - 40 });
          }
        }
      } else if (c.stage === 'hide') {
        let nearestCop = Infinity;
        for (const cop of vehicles.police) {
          nearestCop = Math.min(nearestCop, dist2d(cop.x, cop.z, player.x, player.z));
        }
        if (nearestCop > 25 && d < 14) {
          c.hideTimer += dt;
          if (c.hideTimer > 8) {
            if (this.hooks.setHuntPoint) this.hooks.setHuntPoint(null);
            wanted.setStars(0, 'lost the heat');
            this.complete();
          }
        } else {
          c.hideTimer = Math.max(0, c.hideTimer - dt * 2);
        }
      }
    } else if (id === 'night-shift') {
      if (c.stage === 'pickup') {
        if (c.farePed && player.inCar && dist2d(player.x, player.z, c.farePed.x, c.farePed.z) < 5) {
          // The fare gets in; the ped leaves the street.
          this.hooks.removeFarePed(c.farePed);
          c.farePed = null;
          const dest = pick(this.rng, [PLACES.hotel, PLACES.garage, PLACES.pier, PLACES.hideout, PLACES.marinaPickup]);
          c.target = { x: dest.x, z: dest.z, label: `Fare ${c.fare}/3 — drop off` };
          c.stage = 'dropoff';
          this.say(`Fare ${c.fare} aboard. Drop them at ${dest.label}.`);
          this.placeBeacon();
        }
      } else if (c.stage === 'dropoff') {
        if (player.inCar && d < ARRIVE_CAR) {
          this.say(`Fare ${c.fare} delivered.`);
          this.nextFare();
        }
      }
    } else if (id === 'big-score') {
      if (c.stage === 'start' && player.inCar && player.car && player.car.kind === 'van') {
        this.setupStage(id, 'deliver');
      } else if (c.stage === 'deliver' && player.inCar && d < ARRIVE_CAR) {
        this.complete();
      }
    }
  }

  updateSide(dt, player) {
    const job = this.sideJob;
    if (!job) return;
    const d = dist2d(player.x, player.z, job.target.x, job.target.z);
    if (job.stage === 'pickup') {
      if (job.kind === 'taxi') {
        if (player.inCar && d < 5) {
          this.hooks.removeFarePed(job.ped);
          job.ped = null;
          job.stage = 'dropoff';
          job.target = job.dest;
          this.say(`Passenger aboard. Take them to ${job.dest.label}.`);
          this.beacon.position.set(job.target.x, 0, job.target.z);
        }
      } else if (d < ARRIVE_FOOT) {
        job.stage = 'dropoff';
        job.target = job.dest;
        this.say(`Parcel collected. Deliver it to ${job.dest.label}.`);
        this.beacon.position.set(job.target.x, 0, job.target.z);
      }
    } else if (job.stage === 'dropoff' && d < ARRIVE_CAR) {
      this.completeSideJob();
    }
  }
}
