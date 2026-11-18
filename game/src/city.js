// SOLMAR HEAT — the city of Solmar Bay. Builds the 3D world from a seed:
// a 5x5 street grid, downtown towers, a beach to the south, a marina to the
// east, palm avenues, docks and a pier. Returns colliders, the road list
// (for traffic) and the named places the missions use.

import * as THREE from 'three';
import { CFG } from './config.js';

function makeGroundTexture() {
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d');
  const world = 420; // ground plane spans -210..210 in both axes
  const px = (v) => ((v + world / 2) / world) * S;
  const w = (v) => (v / world) * S;
  // Base: outskirts (dark ground).
  g.fillStyle = '#2e3329';
  g.fillRect(0, 0, S, S);
  // City asphalt.
  g.fillStyle = '#33363b';
  g.fillRect(px(-157), px(-157), w(314), w(314));
  // Sidewalks: one light slab per block.
  g.fillStyle = '#4a4d52';
  const step = CFG.BLOCK + CFG.ROAD;
  for (let i = 0; i < CFG.GRID; i++) {
    for (let j = 0; j < CFG.GRID; j++) {
      const bx = -157 + CFG.ROAD + i * step;
      const bz = -157 + CFG.ROAD + j * step;
      g.fillRect(px(bx), px(bz), w(CFG.BLOCK), w(CFG.BLOCK));
    }
  }
  // Road centre dashes (yellow) along every road.
  g.fillStyle = '#c9a227';
  const roadCentres = [];
  for (let i = 0; i <= CFG.GRID; i++) roadCentres.push(-157 + CFG.ROAD / 2 + i * step);
  for (const rc of roadCentres) {
    for (let t = -157; t < 157; t += 12) {
      g.fillRect(px(t), px(rc) - 1, w(6), 2);
      g.fillRect(px(rc) - 1, px(t), 2, w(6));
    }
  }
  // Crosswalks at every intersection (white stripes).
  g.fillStyle = 'rgba(235,235,235,0.85)';
  for (const rx of roadCentres) {
    for (const rz of roadCentres) {
      for (let k = -5; k <= 5; k += 2.5) {
        g.fillRect(px(rx + k) - 1, px(rz - 6), 2, w(3));
        g.fillRect(px(rx - 6), px(rz + k) - 1, w(3), 2);
      }
    }
  }
  // Beach sand (south strip).
  g.fillStyle = '#d9c08a';
  g.fillRect(px(-210), px(157), w(420), w(33));
  // Water: south of the beach and the east marina strip.
  g.fillStyle = '#1d5f8a';
  g.fillRect(px(-210), px(190), w(420), w(20));
  g.fillRect(px(157), px(-157), w(53), w(314));
  // A lighter water shimmer line where sand meets sea.
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.fillRect(px(-210), px(188), w(420), 2);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeWindowTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#5a6a7a';
  g.fillRect(0, 0, 64, 128);
  g.fillStyle = '#ffd977';
  for (let y = 8; y < 120; y += 16) {
    for (let x = 8; x < 56; x += 16) {
      if ((x + y) % 32 === 0) g.fillStyle = '#2c3540';
      else g.fillStyle = '#ffd977';
      g.fillRect(x, y, 9, 10);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, rng) {
  const group = new THREE.Group();
  const colliders = []; // {minX,maxX,minZ,maxZ}
  const roads = [];
  const step = CFG.BLOCK + CFG.ROAD;
  for (let i = 0; i <= CFG.GRID; i++) {
    const rc = -157 + CFG.ROAD / 2 + i * step;
    roads.push({ axis: 'x', at: rc });
    roads.push({ axis: 'z', at: rc });
  }

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 420),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture() }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Buildings: one or two per block, taller downtown.
  const winTex = makeWindowTexture();
  const wallColors = [0x8a7f72, 0x7a8a94, 0x9a8a7a, 0x6a7a6a, 0xb09a7a, 0x8a94a0];
  const geoBox = new THREE.BoxGeometry(1, 1, 1);
  for (let i = 0; i < CFG.GRID; i++) {
    for (let j = 0; j < CFG.GRID; j++) {
      const bx = -157 + CFG.ROAD + i * step;
      const bz = -157 + CFG.ROAD + j * step;
      const cx = bx + CFG.BLOCK / 2;
      const cz = bz + CFG.BLOCK / 2;
      const downtown = Math.abs(cx) < 70 && Math.abs(cz) < 70;
      // The hotel block (south centre) and the garage block (west centre)
      // stay low so their markers read clearly.
      const isHotel = i === 2 && j === 4;
      const isGarage = i === 0 && j === 2;
      const count = downtown && !isHotel && !isGarage ? 2 : 1;
      for (let k = 0; k < count; k++) {
        const w = count === 2 ? 18 : rng.range(24, 34);
        const d = count === 2 ? 18 : rng.range(24, 34);
        const h = isHotel ? 26 : isGarage ? 8 : downtown ? rng.range(28, 64) : rng.range(10, 26);
        const ox = count === 2 ? (k === 0 ? -11 : 11) : 0;
        const oz = count === 2 ? (k === 0 ? -11 : 11) : 0;
        const mat = new THREE.MeshLambertMaterial({
          color: wallColors[Math.floor(rng.f() * wallColors.length)],
          map: winTex,
        });
        const b = new THREE.Mesh(geoBox, mat);
        b.scale.set(w, h, d);
        b.position.set(cx + ox, h / 2 + 0.2, cz + oz);
        b.castShadow = true;
        b.receiveShadow = true;
        group.add(b);
        colliders.push({
          minX: cx + ox - w / 2,
          maxX: cx + ox + w / 2,
          minZ: cz + oz - d / 2,
          maxZ: cz + oz + d / 2,
        });
        // Rooftop box (AC unit / parapet) for silhouette.
        if (h > 20) {
          const roof = new THREE.Mesh(
            geoBox,
            new THREE.MeshLambertMaterial({ color: 0x555a60 }),
          );
          roof.scale.set(w * 0.4, 2, d * 0.4);
          roof.position.set(cx + ox, h + 1.2, cz + oz);
          group.add(roof);
        }
      }
    }
  }

  // Palm trees along the beach road and the central avenue.
  const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 7, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const leafGeo = new THREE.ConeGeometry(2.6, 3.2, 6);
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x2f7a3a });
  function palm(x, z) {
    const t = new THREE.Mesh(trunkGeo, trunkMat);
    t.position.set(x, 3.5, z);
    t.castShadow = true;
    group.add(t);
    const l = new THREE.Mesh(leafGeo, leafMat);
    l.position.set(x, 8.2, z);
    l.castShadow = true;
    group.add(l);
    colliders.push({ minX: x - 0.7, maxX: x + 0.7, minZ: z - 0.7, maxZ: z + 0.7 });
  }
  for (let x = -140; x <= 140; x += 28) {
    palm(x, 148);
    if (Math.abs(x) > 20) palm(x, -148);
  }
  for (let z = -120; z <= 120; z += 40) {
    palm(-150 + 4, z);
    palm(150 - 4, z);
  }

  // Marina docks (east water) + boats.
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x8a6a42 });
  for (let z = -120; z <= 120; z += 40) {
    const dock = new THREE.Mesh(geoBox, dockMat);
    dock.scale.set(26, 0.8, 4);
    dock.position.set(170, 0.4, z);
    dock.castShadow = true;
    group.add(dock);
  }
  const boatColors = [0xe8e8e8, 0xd94f3d, 0x3d7ad9, 0xe8c93d];
  for (let k = 0; k < 6; k++) {
    const bx = 172 + rng.range(-4, 10);
    const bz = -120 + k * 40 + rng.range(-8, 8);
    const hull = new THREE.Mesh(
      geoBox,
      new THREE.MeshLambertMaterial({ color: boatColors[k % boatColors.length] }),
    );
    hull.scale.set(9, 1.6, 3.2);
    hull.position.set(bx, 0.9, bz);
    hull.castShadow = true;
    group.add(hull);
    const cabin = new THREE.Mesh(
      geoBox,
      new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }),
    );
    cabin.scale.set(4, 1.6, 2.4);
    cabin.position.set(bx, 2.4, bz);
    group.add(cabin);
  }

  // The pier (south, into the water).
  const pier = new THREE.Mesh(geoBox, dockMat);
  pier.scale.set(6, 0.8, 24);
  pier.position.set(30, 0.4, 200);
  pier.castShadow = true;
  group.add(pier);

  // Street lamps at intersections.
  const poleGeo = new THREE.CylinderGeometry(0.12, 0.12, 6, 5);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3f45 });
  const lampGeo = new THREE.SphereGeometry(0.5, 8, 6);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
  for (const rc of [-150, -90, -30, 30, 90, 150]) {
    for (const rc2 of [-150, 150]) {
      const p = new THREE.Mesh(poleGeo, poleMat);
      p.position.set(rc + 8, 3, rc2);
      group.add(p);
      const l = new THREE.Mesh(lampGeo, lampMat);
      l.position.set(rc + 8, 6.2, rc2);
      group.add(l);
    }
  }

  // Named places (mission targets). Coordinates are on roads / open ground.
  const places = {
    garage: { x: -138, z: 30, label: 'Ada\u2019s Garage' },
    marina: { x: 168, z: -90, label: 'Marina Pickup' },
    hotel: { x: 0, z: 132, label: 'Hotel Solmar' },
    pier: { x: 30, z: 198, label: 'The Pier' },
    hideout: { x: -138, z: -138, label: 'Hideout' },
    beach: { x: -60, z: 172, label: 'Solmar Beach' },
    playerStart: { x: -120, z: 120 },
  };

  // Playable bounds: the city plus the beach; the water is out of bounds.
  function clampToPlayable(x, z, r = 1) {
    return {
      x: Math.max(-164, Math.min(164, x)),
      z: Math.max(-164, Math.min(196, z)),
    };
  }
  // True when (x,z) is on a road (for traffic / pedestrian placement).
  function isRoad(x, z) {
    const onRoad = (v) => {
      for (let i = 0; i <= CFG.GRID; i++) {
        const rc = -157 + CFG.ROAD / 2 + i * step;
        if (Math.abs(v - rc) <= CFG.ROAD / 2 - 1) return true;
      }
      return false;
    };
    return onRoad(x) || onRoad(z);
  }
  // Circle vs building colliders: push a circle out of any AABB it overlaps.
  function resolveCollisions(x, z, r) {
    for (const c of colliders) {
      const nx = Math.max(c.minX, Math.min(x, c.maxX));
      const nz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - nx;
      const dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          z = nz + (dz / d) * r;
        } else {
          // Centre inside the box: push out along the smallest axis.
          const left = x - c.minX;
          const right = c.maxX - x;
          const top = z - c.minZ;
          const bottom = c.maxZ - z;
          const m = Math.min(left, right, top, bottom);
          if (m === left) x = c.minX - r;
          else if (m === right) x = c.maxX + r;
          else if (m === top) z = c.minZ - r;
          else z = c.maxZ + r;
        }
      }
    }
    return { x, z };
  }

  scene.add(group);
  return { group, colliders, roads, places, clampToPlayable, isRoad, resolveCollisions };
}
