// Solmar Heat — pedestrians. One job: people who walk the sidewalks,
// flee from danger, and can be knocked down (which the police notice).
import { WORLD } from './config.js';
import { pick, range, intRange, clamp, dist2d } from './random.js';

const SHIRTS = [0xd84a4a, 0x4a90d8, 0x4ad87a, 0xd8c24a, 0x9a4ad8, 0xd87a4a, 0x4ad8c8, 0xe8e8e8];
const SKINS = [0xe8b88a, 0xc88a5a, 0x8a5a3a, 0xf0c8a0];

export class Peds {
  constructor(scene, city, rng, fxLow, hooks) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.fxLow = fxLow;
    this.hooks = hooks; // { onKnockedDown(ped) }
    this.list = [];
    this.group = new THREE.Group();
    this.group.name = 'peds';
    scene.add(this.group);
    const count = fxLow ? 12 : 22;
    for (let i = 0; i < count; i++) {
      this.spawn();
    }
  }

  makeMesh() {
    const rng = this.rng;
    const g = new THREE.Group();
    const shirt = pick(rng, SHIRTS);
    const skin = pick(rng, SKINS);
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.38, 1.05, 8),
      new THREE.MeshLambertMaterial({ color: shirt }),
    );
    body.position.y = 0.95;
    body.castShadow = !this.fxLow;
    g.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.26, 8, 6),
      new THREE.MeshLambertMaterial({ color: skin }),
    );
    head.position.y = 1.72;
    head.castShadow = !this.fxLow;
    g.add(head);
    const legs = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.45, 0.3),
      new THREE.MeshLambertMaterial({ color: 0x2a2a3a }),
    );
    legs.position.y = 0.22;
    g.add(legs);
    return g;
  }

  spawn(x, z) {
    const rng = this.rng;
    const mesh = this.makeMesh();
    const px = x !== undefined ? x : range(rng, -95, 95);
    const pz = z !== undefined ? z : range(rng, -95, 95);
    const near = this.city.nearestRoadPoint(px, pz);
    mesh.position.set(near.x, 0, near.z);
    this.group.add(mesh);
    const ped = {
      mesh, x: near.x, z: near.z,
      heading: rng() * Math.PI * 2,
      speed: range(rng, 1.1, 2.0),
      state: 'walk', // walk | flee | down
      downTime: 0,
      target: null,
      retarget: 0,
    };
    this.list.push(ped);
    return ped;
  }

  // A pedestrian runs away from (x, z).
  fleeFrom(x, z, radius = 22) {
    for (const p of this.list) {
      if (p.state === 'down') continue;
      if (dist2d(p.x, p.z, x, z) < radius) {
        p.state = 'flee';
        p.fleeX = x;
        p.fleeZ = z;
      }
    }
  }

  // Knock a pedestrian down (car hit or punch). Returns the ped or null.
  knockDown(x, z, radius = 2.2) {
    for (const p of this.list) {
      if (p.state === 'down') continue;
      if (dist2d(p.x, p.z, x, z) < radius) {
        p.state = 'down';
        p.downTime = 0;
        p.mesh.rotation.x = Math.PI / 2;
        p.mesh.position.y = 0.35;
        if (this.hooks.onKnockedDown) this.hooks.onKnockedDown(p);
        return p;
      }
    }
    return null;
  }

  // The nearest walking pedestrian to (x, z) — used for taxi fares.
  nearest(x, z, maxDist = 30) {
    let best = null;
    let bestD = maxDist;
    for (const p of this.list) {
      if (p.state !== 'walk') continue;
      const d = dist2d(p.x, p.z, x, z);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  update(dt, player) {
    const rng = this.rng;
    for (const p of this.list) {
      if (p.state === 'down') {
        p.downTime += dt;
        if (p.downTime > 6) {
          p.state = 'walk';
          p.mesh.rotation.x = 0;
          p.mesh.position.y = 0;
        }
        continue;
      }
      if (p.state === 'flee') {
        const dx = p.x - p.fleeX;
        const dz = p.z - p.fleeZ;
        const d = Math.hypot(dx, dz) || 1;
        p.heading = Math.atan2(dx, dz);
        p.x += (dx / d) * 4.2 * dt;
        p.z += (dz / d) * 4.2 * dt;
        if (d > 30) p.state = 'walk';
      } else {
        // Stroll along the sidewalk: keep to a street line, turn at
        // intersections now and then.
        p.retarget -= dt;
        if (p.retarget <= 0) {
          p.retarget = range(rng, 2, 6);
          const near = this.city.nearestRoadPoint(p.x, p.z);
          if (this.city.onRoad(p.x, p.z) && rng() < 0.5) {
            p.heading = near.horizontal ? (rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rng() < 0.5 ? 0 : Math.PI);
          } else {
            p.heading += range(rng, -0.9, 0.9);
          }
        }
        p.x += Math.sin(p.heading) * p.speed * dt;
        p.z += Math.cos(p.heading) * p.speed * dt;
        p.x = clamp(p.x, -118, 118);
        p.z = clamp(p.z, -118, 118);
        [p.x, p.z] = this.city.resolveSolids(p.x, p.z, 0.5);
      }
      // A speeding car ploughs through: knock the ped down.
      if (player.inCar && Math.abs(player.carSpeed) > 7) {
        if (dist2d(p.x, p.z, player.x, player.z) < 2.0) {
          this.knockDown(p.x, p.z, 2.4);
        }
      }
      p.mesh.position.set(p.x, 0, p.z);
      p.mesh.rotation.y = p.heading;
      // Simple walk bob.
      if (p.state !== 'down') {
        p.mesh.position.y = Math.abs(Math.sin(performance.now() / 240 + p.heading * 7)) * 0.06;
      }
    }
  }
}
