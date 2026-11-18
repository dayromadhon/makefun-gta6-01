// missions.js — 5 story missions for Leo Marin, then side jobs in free roam.
import { CONFIG } from './config.js';

const STORY = [
  {
    title: 'Mission 1 — First Wheels',
    desc: 'Leo owes Rocco Vane $4,500. Ada lined up a car to steal. Take any car and bring it to her garage.',
    pay: 400,
  },
  {
    title: 'Mission 2 — Package Run',
    desc: 'Pick up the package at the marina and deliver it to Hotel Solmar. 90 seconds on the clock.',
    pay: 600,
  },
  {
    title: 'Mission 3 — Lose the Heat',
    desc: 'The cops are on you — 2 stars. Reach Solmar Pier and lay low until the heat dies down.',
    pay: 800,
  },
  {
    title: 'Mission 4 — Night Shift',
    desc: 'Drive a taxi and run 3 fares across the city. Pick up, drop off, get paid.',
    pay: 900,
  },
  {
    title: 'Mission 5 — The Big Score',
    desc: 'Steal the courier van from the marina and bring it to the hideout. This one pays the debt.',
    pay: 2000,
  },
];

export class Missions {
  constructor(scene, city, vehicles, rng) {
    this.scene = scene;
    this.city = city;
    this.vehicles = vehicles;
    this.rng = rng;
    this.index = 0; // 0..4 story, 5 = story done (side jobs)
    this.stage = 0;
    this.active = false; // started with Go
    this.cardShown = false;
    this.earned = 0;
    this.timer = 0;
    this.faresDone = 0;
    this.fareStage = 'pickup'; // pickup | dropoff
    this.farePoint = null;
    this.sideJob = null; // {kind:'taxi'|'package', stage, point, timer}
    this.sideJobsDone = 0;
    this.van = null;
    this.taxiCar = null;
    this.objective = null;
    // 3D beacon at the objective.
    this.beacon = new THREE.Group();
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(1.2, 1.2, 40, 12, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.25, side: THREE.DoubleSide, depthWrite: false })
    );
    pillar.position.y = 20;
    this.beacon.add(pillar);
    const marker = new THREE.Mesh(
      new THREE.OctahedronGeometry(1.1),
      new THREE.MeshBasicMaterial({ color: 0xffcc00 })
    );
    marker.position.y = 6;
    this.beacon.add(marker);
    this.beacon.userData.marker = marker;
    this.beacon.visible = false;
    this.scene.add(this.beacon);
    this.time = 0;
  }

  debtLeft() {
    return Math.max(0, CONFIG.debtStart - this.earned);
  }

  currentTitle() {
    if (this.index < 5) return STORY[this.index].title;
    return 'Free Roam — Side Jobs';
  }

  currentDesc() {
    if (this.index < 5) return STORY[this.index].desc;
    return 'Debt paid. The city is yours — run taxi fares and package jobs for cash.';
  }

  setObjective(x, z, label) {
    this.objective = { x, z, label };
    this.beacon.position.set(x, 0, z);
    this.beacon.visible = true;
  }

  clearObjective() {
    this.objective = null;
    this.beacon.visible = false;
  }

  // Show the mission card for the current mission (called by main on New Game / after completion).
  showCard(ctx) {
    this.cardShown = true;
    this.active = false;
    ctx.hud.showMissionCard(this.currentTitle(), this.currentDesc(), this.index < 5 ? STORY[this.index].pay : 0);
  }

  // Player pressed Go on the card.
  begin(ctx) {
    this.cardShown = false;
    this.active = true;
    this.stage = 0;
    ctx.hud.hideMissionCard();
    this.setupStage(ctx);
    ctx.audio.chime();
    ctx.hud.flash(this.currentTitle());
  }

  setupStage(ctx) {
    const places = this.city.places;
    if (this.index === 0) {
      // Stage 0: steal any car. Objective: nearest parked car.
      const car = this.vehicles.parked[0];
      this.setObjective(car.mesh.position.x, car.mesh.position.z, 'Steal a car');
      ctx.hud.setObjective('Steal a car (press E near one)');
    } else if (this.index === 1) {
      this.setObjective(places.marina.x, places.marina.z, 'Pick up the package');
      ctx.hud.setObjective('Pick up the package at the marina');
    } else if (this.index === 2) {
      ctx.wanted.setStars(2);
      this.setObjective(places.pier.x, places.pier.z, 'Reach Solmar Pier');
      ctx.hud.setObjective('Reach the pier — lose the heat');
    } else if (this.index === 3) {
      this.faresDone = 0;
      this.fareStage = 'pickup';
      // Nearest taxi as the work car.
      let best = null;
      let bestD = 1e9;
      for (const car of this.vehicles.traffic) {
        if (car.kind !== 'taxi') continue;
        const d = Math.hypot(car.mesh.position.x - ctx.player.pos.x, car.mesh.position.z - ctx.player.pos.z);
        if (d < bestD) {
          bestD = d;
          best = car;
        }
      }
      this.taxiCar = best;
      if (best) this.setObjective(best.mesh.position.x, best.mesh.position.z, 'Get in the taxi');
      ctx.hud.setObjective('Get in a taxi');
    } else if (this.index === 4) {
      // Spawn the courier van at the marina.
      const mesh = this.makeVanMesh();
      mesh.position.set(places.marina.x + 6, 0, places.marina.z + 6);
      this.scene.add(mesh);
      this.van = { mesh, kind: 'van', speed: 0, stolen: false, isVan: true };
      this.vehicles.traffic.push(this.van);
      this.setObjective(places.marina.x + 6, places.marina.z + 6, 'Steal the courier van');
      ctx.hud.setObjective('Steal the courier van');
    } else {
      this.startSideJob(ctx);
    }
  }

  makeVanMesh() {
    const g = new THREE.Group();
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0xd8d8d8 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.6, 5.6), bodyMat);
    body.position.y = 1.1;
    body.castShadow = true;
    g.add(body);
    const cab = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 0.9, 1.4),
      new THREE.MeshLambertMaterial({ color: 0x3355aa })
    );
    cab.position.set(0, 0.8, 2.4);
    g.add(cab);
    const wheelGeo = new THREE.CylinderGeometry(0.45, 0.45, 0.35, 10);
    wheelGeo.rotateZ(Math.PI / 2);
    const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
    for (const [wx, wz] of [[-1, 1.8], [1, 1.8], [-1, -1.8], [1, -1.8]]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(wx, 0.45, wz);
      g.add(w);
    }
    return g;
  }

  randomStreetPoint() {
    const s = this.rng.pick(CONFIG.streets);
    const along = this.rng.range(-130, 130);
    return this.rng.chance(0.5) ? { x: s + this.rng.pick([-8, 8]), z: along } : { x: along, z: s + this.rng.pick([-8, 8]) };
  }

  startSideJob(ctx) {
    const kind = this.rng.chance(0.5) ? 'taxi' : 'package';
    this.sideJob = { kind, stage: 'pickup', point: this.randomStreetPoint(), timer: 0 };
    if (kind === 'taxi') {
      this.setObjective(this.sideJob.point.x, this.sideJob.point.z, 'Taxi fare: pick up');
      ctx.hud.setObjective('Side job: pick up the taxi fare');
    } else {
      this.setObjective(this.sideJob.point.x, this.sideJob.point.z, 'Package pickup');
      ctx.hud.setObjective('Side job: pick up the package');
    }
  }

  onCarStolen(car, ctx) {
    if (!this.active) return;
    if (this.index === 0 && this.stage === 0) {
      this.stage = 1;
      const g = this.city.places.garage;
      this.setObjective(g.x, g.z, "Ada's Garage");
      ctx.hud.setObjective("Drive it to Ada's Garage");
      ctx.hud.flash('Got wheels — now bring it to the garage');
    } else if (this.index === 3 && this.stage === 0 && car.kind === 'taxi') {
      this.stage = 1;
      this.farePoint = this.randomStreetPoint();
      this.fareStage = 'pickup';
      this.setObjective(this.farePoint.x, this.farePoint.z, 'Fare pickup');
      ctx.hud.setObjective('Pick up fare 1 of 3');
    } else if (this.index === 4 && this.stage === 0 && car.isVan) {
      this.stage = 1;
      ctx.wanted.addStars(2, 'van-steal');
      const h = this.city.places.hideout;
      this.setObjective(h.x, h.z, 'Hideout');
      ctx.hud.setObjective('Bring the van to the hideout');
      ctx.hud.flash('The van is yours — run!');
    }
  }

  onDriveTick(car, ctx) {
    if (!this.active || !this.objective) return;
    const p = ctx.player.pos;
    const d = Math.hypot(p.x - this.objective.x, p.z - this.objective.z);
    if (d < 7) this.arrived(ctx);
  }

  arrived(ctx) {
    if (this.index === 0 && this.stage === 1) {
      this.completeMission(ctx);
    } else if (this.index === 1) {
      if (this.stage === 0) {
        this.stage = 1;
        this.timer = CONFIG.packageTimeLimit;
        const h = this.city.places.hotel;
        this.setObjective(h.x, h.z, 'Hotel Solmar');
        ctx.hud.setObjective('Deliver to Hotel Solmar — 90s!');
        ctx.audio.chime();
      } else {
        this.completeMission(ctx);
      }
    } else if (this.index === 2 && this.stage === 0) {
      this.stage = 1;
      this.timer = CONFIG.heatSurviveSeconds;
      this.clearObjective();
      ctx.hud.setObjective('Lay low — survive 12s');
      ctx.hud.flash('Lay low at the pier...');
    } else if (this.index === 3 && this.stage === 1) {
      if (this.fareStage === 'pickup') {
        this.fareStage = 'dropoff';
        this.farePoint = this.randomStreetPoint();
        this.setObjective(this.farePoint.x, this.farePoint.z, 'Fare drop-off');
        ctx.hud.setObjective(`Drop off fare ${this.faresDone + 1} of 3`);
        ctx.audio.chime();
      } else {
        this.faresDone++;
        ctx.cash += CONFIG.taxiFare;
        ctx.hud.flash(`Fare done +$${CONFIG.taxiFare}`);
        ctx.audio.chime();
        if (this.faresDone >= CONFIG.taxiFaresNeeded) {
          this.completeMission(ctx);
        } else {
          this.fareStage = 'pickup';
          this.farePoint = this.randomStreetPoint();
          this.setObjective(this.farePoint.x, this.farePoint.z, 'Fare pickup');
          ctx.hud.setObjective(`Pick up fare ${this.faresDone + 1} of 3`);
        }
      }
    } else if (this.index === 4 && this.stage === 1) {
      this.completeMission(ctx);
    } else if (this.index >= 5 && this.sideJob) {
      if (this.sideJob.stage === 'pickup') {
        this.sideJob.stage = 'dropoff';
        this.sideJob.point = this.randomStreetPoint();
        this.setObjective(this.sideJob.point.x, this.sideJob.point.z, 'Drop-off');
        ctx.hud.setObjective(this.sideJob.kind === 'taxi' ? 'Drop off the fare' : 'Deliver the package');
        ctx.audio.chime();
      } else {
        const pay = this.sideJob.kind === 'taxi' ? CONFIG.taxiFare : CONFIG.packagePay;
        ctx.cash += pay;
        this.earned += pay;
        this.sideJobsDone++;
        ctx.hud.flash(`Side job done +$${pay}`);
        ctx.audio.jingle();
        this.startSideJob(ctx);
      }
    }
  }

  completeMission(ctx) {
    const pay = STORY[this.index].pay;
    ctx.cash += pay;
    this.earned += pay;
    ctx.audio.jingle();
    ctx.hud.showMissionComplete(this.currentTitle(), pay, this.debtLeft());
    this.clearObjective();
    this.active = false;
    this.index++;
    this.stage = 0;
    if (this.index === 5) {
      ctx.hud.flash('DEBT PAID — Solmar Bay is yours now');
    }
    ctx.onMissionComplete();
  }

  failMission(ctx, reason) {
    ctx.audio.blip(180);
    ctx.hud.showMissionFailed(reason);
    this.clearObjective();
    this.active = false;
    this.stage = 0;
    ctx.wanted.clear();
    ctx.onMissionFailed();
  }

  update(dt, ctx) {
    this.time += dt;
    if (this.beacon.visible) {
      this.beacon.userData.marker.position.y = 6 + Math.sin(this.time * 3) * 0.8;
      this.beacon.userData.marker.rotation.y += dt * 2;
    }
    if (!this.active) return;
    // Timed stages.
    if (this.index === 1 && this.stage === 1) {
      this.timer -= dt;
      ctx.hud.setTimer(Math.max(0, Math.ceil(this.timer)));
      if (this.timer <= 0) {
        ctx.hud.setTimer(0);
        this.failMission(ctx, 'Too slow — the package run failed. Try again.');
        return;
      }
    }
    if (this.index === 2 && this.stage === 1) {
      this.timer -= dt;
      ctx.hud.setTimer(Math.max(0, Math.ceil(this.timer)));
      if (this.timer <= 0) {
        ctx.hud.setTimer(0);
        ctx.wanted.clear();
        this.completeMission(ctx);
        return;
      }
    }
    // On-foot arrival (pickups, pier, fares).
    const p = ctx.player.pos;
    if (this.objective) {
      const d = Math.hypot(p.x - this.objective.x, p.z - this.objective.z);
      if (d < 5 && ctx.player.onFoot) this.arrived(ctx);
    }
    // Taxi must be the car for mission 4 fares.
    if (this.index === 3 && this.stage === 1 && this.taxiCar && ctx.player.car && ctx.player.car !== this.taxiCar) {
      ctx.hud.setObjective('Get back in the taxi!');
    }
  }

  saveState() {
    return { index: this.index, earned: this.earned, sideJobsDone: this.sideJobsDone };
  }

  loadState(s) {
    this.index = s.index ?? 0;
    this.earned = s.earned ?? 0;
    this.sideJobsDone = s.sideJobsDone ?? 0;
    this.stage = 0;
    this.active = false;
  }
}
