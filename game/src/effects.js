// Juice: pooled particles (dust, sparks, smoke, muzzle flashes), floating score text
// and screen shake. One shared pool, no allocation in the hot loop.

import * as THREE from 'three';

const POOL = 240;

export function createEffects(scene) {
  const geo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
  const mesh = new THREE.InstancedMesh(geo, mat, POOL);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.count = POOL;
  mesh.frustumCulled = false;
  scene.add(mesh);
  const parts = [];
  for (let i = 0; i < POOL; i += 1) {
    parts.push({ alive: false, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, size: 1, r: 1, g: 1, b: 1 });
  }
  let cursor = 0;
  let shake = 0;
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  function spawn(x, y, z, vx, vy, vz, life, size, r, g, b) {
    const p = parts[cursor];
    cursor = (cursor + 1) % POOL;
    p.alive = true;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.life = life;
    p.maxLife = life;
    p.size = size;
    p.r = r;
    p.g = g;
    p.b = b;
  }

  function burst(x, y, z, count, speed, life, size, r, g, b) {
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const up = Math.random() * speed * 0.6;
      spawn(x, y, z, Math.cos(a) * speed, up, Math.sin(a) * speed, life * (0.6 + Math.random() * 0.7), size, r, g, b);
    }
  }

  function update(dt) {
    shake = Math.max(0, shake - dt * 2.2);
    for (let i = 0; i < POOL; i += 1) {
      const p = parts[i];
      if (p.alive) {
        p.life -= dt;
        if (p.life <= 0) {
          p.alive = false;
        } else {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.z += p.vz * dt;
          p.vy -= 6 * dt;
          p.vx *= 0.98;
          p.vz *= 0.98;
        }
      }
      const scale = p.alive ? p.size * (0.4 + 0.6 * (p.life / p.maxLife)) : 0.0001;
      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(Math.max(0.0001, scale));
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.setRGB(p.r, p.g, p.b);
      mesh.setColorAt(i, color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  function applyShake(camera) {
    if (shake <= 0) return;
    const s = shake * 0.35;
    camera.position.x += (Math.random() - 0.5) * s;
    camera.position.y += (Math.random() - 0.5) * s;
    camera.position.z += (Math.random() - 0.5) * s;
  }

  return {
    burst,
    dust(x, y, z) {
      burst(x, y, z, 3, 1.6, 0.7, 0.8, 0.72, 0.66, 0.55);
    },
    smoke(x, y, z) {
      burst(x, y, z, 2, 0.8, 1.4, 1.1, 0.25, 0.25, 0.28);
    },
    sparks(x, y, z) {
      burst(x, y, z, 10, 7, 0.4, 0.5, 1, 0.8, 0.2);
    },
    muzzle(x, y, z) {
      burst(x, y, z, 5, 3, 0.12, 0.7, 1, 0.9, 0.3);
    },
    addShake(amount) {
      shake = Math.min(1, shake + amount);
    },
    update,
    applyShake,
  };
}
