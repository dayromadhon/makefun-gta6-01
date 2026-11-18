// peds.js — pedestrians: they stroll the sidewalks, flee from danger, get knocked down.
import { CONFIG, PALETTE } from './config.js';

function makePedMesh(shirt, skin) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(0.32, 0.38, 1.0, 8),
    new THREE.MeshLambertMaterial({ color: shirt })
  );
  body.position.y = 0.9;
  body.castShadow = true;
  g.add(body);
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 10, 8),
    new THREE.MeshLambertMaterial({ color: skin })
  );
  head.position.y = 1.65;
  head.castShadow = true;
  g.add(head);
  const legs = new THREE.Mesh(
    new THREE.BoxGeometry(0.45, 0.5, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x2c3e50 })
  );
  legs.position.y = 0.25;
  g.add(legs);
  return g;
}

export class Peds {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.list = [];
    for (let i = 0; i < 22; i++) this.spawn();
  }

  spawn() {
    const rng = this.rng;
    const mesh = makePedMesh(rng.pick(PALETTE.pedShirts), rng.pick(PALETTE.pedSkin));
    const street = rng.pick(CONFIG.streets);
    const along = rng.range(-140, 140);
    const side = rng.pick([-1, 1]);
    let x, z;
    if (rng.chance(0.5)) {
      x = street + side * 8.6;
      z = along;
    } else {
      x = along;
      z = street + side * 8.6;
    }
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    this.list.push({
      mesh,
      heading: rng.range(0, Math.PI * 2),
      speed: rng.range(1.2, 2.2),
      state: 'walk',
      downTimer: 0,
      fleeX: 0,
      fleeZ: 0,
      walkTimer: rng.range(2, 6),
    });
  }

  // A ped at (x,z) gets scared and runs from (fx,fz).
  scare(x, z, fx, fz) {
    for (const p of this.list) {
      if (p.state === 'down') continue;
      const dx = p.mesh.position.x - x;
      const dz = p.mesh.position.z - z;
      if (dx * dx + dz * dz < 30 * 30) {
        p.state = 'flee';
        p.fleeX = fx;
        p.fleeZ = fz;
        p.walkTimer = 4;
      }
    }
  }

  knockDownAt(x, z, radius) {
    let hit = 0;
    for (const p of this.list) {
      if (p.state === 'down') continue;
      const dx = p.mesh.position.x - x;
      const dz = p.mesh.position.z - z;
      if (dx * dx + dz * dz < radius * radius) {
        p.state = 'down';
        p.downTimer = 4;
        p.mesh.rotation.x = Math.PI / 2;
        p.mesh.position.y = 0.3;
        hit++;
      }
    }
    return hit;
  }

  update(dt) {
    for (const p of this.list) {
      const m = p.mesh;
      if (p.state === 'down') {
        p.downTimer -= dt;
        if (p.downTimer <= 0) {
          p.state = 'walk';
          m.rotation.x = 0;
          m.position.y = 0;
        }
        continue;
      }
      if (p.state === 'flee') {
        p.walkTimer -= dt;
        const dx = m.position.x - p.fleeX;
        const dz = m.position.z - p.fleeZ;
        const d = Math.hypot(dx, dz) || 1;
        p.heading = Math.atan2(dx / d, dz / d);
        m.position.x += (dx / d) * 5.5 * dt;
        m.position.z += (dz / d) * 5.5 * dt;
        if (p.walkTimer <= 0) p.state = 'walk';
      } else {
        p.walkTimer -= dt;
        if (p.walkTimer <= 0) {
          p.walkTimer = this.rng.range(2, 7);
          p.heading += this.rng.range(-1.2, 1.2);
        }
        m.position.x += Math.sin(p.heading) * p.speed * dt;
        m.position.z += Math.cos(p.heading) * p.speed * dt;
      }
      // Stay in the city and out of buildings.
      const fixed = this.city.resolve(m.position.x, m.position.z, 0.5);
      m.position.x = fixed.x;
      m.position.z = fixed.z;
      m.rotation.y = p.heading;
      // Little walk bob.
      m.position.y = p.state === 'walk' ? Math.abs(Math.sin(performance.now() / 180 + p.heading * 7)) * 0.06 : 0;
    }
  }
}
