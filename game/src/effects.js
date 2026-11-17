// Solmar Heat — particles and the mission beacon.
// One job: short-lived visual feedback (sparks, muzzle flash, exhaust) and
// the tall beacon marking the current objective.

const THREE = window.THREE;
const MAX_PARTICLES = 240;

export function createEffects(scene) {
  const positions = new Float32Array(MAX_PARTICLES * 3);
  const colors = new Float32Array(MAX_PARTICLES * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  scene.add(points);
  const parts = [];
  for (let i = 0; i < MAX_PARTICLES; i++) {
    parts.push({ alive: false, x: 0, y: -10, z: 0, vx: 0, vy: 0, vz: 0, life: 0, maxLife: 1, r: 1, g: 1, b: 1 });
  }
  let cursor = 0;

  function spawn(x, y, z, vx, vy, vz, life, r, g, b) {
    const p = parts[cursor];
    cursor = (cursor + 1) % MAX_PARTICLES;
    p.alive = true;
    p.x = x;
    p.y = y;
    p.z = z;
    p.vx = vx;
    p.vy = vy;
    p.vz = vz;
    p.life = life;
    p.maxLife = life;
    p.r = r;
    p.g = g;
    p.b = b;
  }

  function sparks(x, y, z, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 2 + Math.random() * 5;
      spawn(x, y, z, Math.cos(a) * sp, 2 + Math.random() * 4, Math.sin(a) * sp, 0.4 + Math.random() * 0.3, 1, 0.8, 0.2);
    }
  }

  function muzzle(x, y, z, yaw) {
    const fx = Math.sin(yaw);
    const fz = Math.cos(yaw);
    for (let i = 0; i < 5; i++) {
      spawn(x + fx * (0.3 + i * 0.15), y, z + fz * (0.3 + i * 0.15), fx * 14, 0.4, fz * 14, 0.12, 1, 0.9, 0.4);
    }
  }

  function puff(x, y, z) {
    spawn(x, y, z, (Math.random() - 0.5) * 0.6, 0.8, (Math.random() - 0.5) * 0.6, 0.7, 0.45, 0.45, 0.45);
  }

  function update(dt) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = parts[i];
      if (!p.alive) {
        positions[i * 3 + 1] = -10;
        continue;
      }
      p.life -= dt;
      if (p.life <= 0) {
        p.alive = false;
        positions[i * 3 + 1] = -10;
        continue;
      }
      p.vy -= 9 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.y < 0.05) {
        p.y = 0.05;
        p.vy *= -0.3;
      }
      const fade = p.life / p.maxLife;
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      colors[i * 3] = p.r * fade;
      colors[i * 3 + 1] = p.g * fade;
      colors[i * 3 + 2] = p.b * fade;
    }
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    // beacon pulse
    if (beacon.visible) {
      const s = 1 + Math.sin(performance.now() * 0.005) * 0.15;
      beacon.scale.set(s, 1, s);
      beacon.rotation.y += dt * 0.8;
    }
  }

  // --- mission beacon: a tall light pillar + a ground ring ----------------
  const beaconMat = new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.28, depthWrite: false });
  const beacon = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 60, 12, 1, true), beaconMat);
  beacon.position.y = 30;
  beacon.visible = false;
  scene.add(beacon);
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(2.4, 3.2, 24),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.1;
  ring.visible = false;
  scene.add(ring);

  function setBeacon(x, z, visible) {
    beacon.visible = visible;
    ring.visible = visible;
    if (visible) {
      beacon.position.x = x;
      beacon.position.z = z;
      ring.position.x = x;
      ring.position.z = z;
    }
  }

  return { update, sparks, muzzle, puff, setBeacon };
}
