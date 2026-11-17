// Solmar Bay itself: the street grid, the ground texture (roads, sidewalks, crosswalks,
// parking lots, parks), the buildings with lit windows, palm trees, lamps, the beach and
// the marina — plus the collision boxes and the road graph the traffic and the pedestrians
// drive and walk on. Everything is placed from one seeded random source, so the same seed
// always builds the same city.

import * as THREE from 'three';
import { CITY, PALETTE } from './config.js';

const WORLD = 560; // ground plane spans -280..280 on each axis

function worldToCanvas(v) {
  return ((v + WORLD / 2) / WORLD) * 2048;
}

function makeWindowTexture(base, lit) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, 128, 256);
  for (let row = 0; row < 12; row += 1) {
    for (let col = 0; col < 5; col += 1) {
      const x = 10 + col * 23;
      const y = 10 + row * 20;
      ctx.fillStyle = Math.random() < 0.22 ? lit : '#26303d';
      ctx.fillRect(x, y, 15, 12);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

function makeGroundTexture(random) {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 2048;
  const ctx = canvas.getContext('2d');
  const px = (v) => worldToCanvas(v);

  // Base: dry grass between the blocks, sand on the beach strip.
  ctx.fillStyle = '#8fae6b';
  ctx.fillRect(0, 0, 2048, 2048);
  ctx.fillStyle = '#e8cf9e';
  ctx.fillRect(0, px(CITY.beachZ), 2048, 2048 - px(CITY.beachZ));

  // Block interiors: concrete plazas, parking lots and two parks.
  for (const bx of [-126, -42, 42, 126]) {
    for (const bz of [-126, -42, 42, 126]) {
      const x0 = px(bx - CITY.blockHalf);
      const z0 = px(bz - CITY.blockHalf);
      const size = px(bx + CITY.blockHalf) - x0;
      if ((bx === -42 && bz === 42) || (bx === 126 && bz === -126)) {
        ctx.fillStyle = '#6f9e5f';
        ctx.fillRect(x0, z0, size, size);
        ctx.fillStyle = '#5d8a4f';
        for (let i = 0; i < 8; i += 1) {
          ctx.beginPath();
          ctx.arc(x0 + random.range(10, size - 10), z0 + random.range(10, size - 10), random.range(8, 16), 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (random.chance(0.45)) {
        ctx.fillStyle = '#7d7a74';
        ctx.fillRect(x0, z0, size, size);
        ctx.strokeStyle = 'rgba(240,240,240,0.7)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 6; i += 1) {
          const sx = x0 + 14 + i * 38;
          ctx.beginPath();
          ctx.moveTo(sx, z0 + 12);
          ctx.lineTo(sx, z0 + 46);
          ctx.stroke();
        }
      } else {
        ctx.fillStyle = '#b0a89c';
        ctx.fillRect(x0, z0, size, size);
        ctx.strokeStyle = 'rgba(0,0,0,0.12)';
        ctx.lineWidth = 2;
        for (let i = 1; i < 6; i += 1) {
          ctx.beginPath();
          ctx.moveTo(x0 + (i * size) / 6, z0);
          ctx.lineTo(x0 + (i * size) / 6, z0 + size);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x0, z0 + (i * size) / 6);
          ctx.lineTo(x0 + size, z0 + (i * size) / 6);
          ctx.stroke();
        }
      }
    }
  }

  // Roads: asphalt strips, sidewalks, dashes, crosswalks.
  for (const s of CITY.streets) {
    ctx.fillStyle = '#33363d';
    ctx.fillRect(0, px(s - CITY.roadHalf), 2048, px(s + CITY.roadHalf) - px(s - CITY.roadHalf));
    ctx.fillRect(px(s - CITY.roadHalf), 0, px(s + CITY.roadHalf) - px(s - CITY.roadHalf), 2048);
    ctx.fillStyle = '#9a938a';
    ctx.fillRect(0, px(s - CITY.roadHalf - 5), 2048, 5 * (2048 / WORLD));
    ctx.fillRect(0, px(s + CITY.roadHalf), 2048, 5 * (2048 / WORLD));
    ctx.fillRect(px(s - CITY.roadHalf - 5), 0, 5 * (2048 / WORLD), 2048);
    ctx.fillRect(px(s + CITY.roadHalf), 0, 5 * (2048 / WORLD), 2048);
  }
  ctx.fillStyle = '#e8c33c';
  for (const s of CITY.streets) {
    for (let v = -280; v < 280; v += 16) {
      ctx.fillRect(px(v), px(s) - 2, 26, 4);
      ctx.fillRect(px(s) - 2, px(v), 4, 26);
    }
  }
  ctx.fillStyle = 'rgba(245,245,245,0.85)';
  for (const sx of CITY.streets) {
    for (const sz of CITY.streets) {
      for (let i = -3; i <= 3; i += 1) {
        ctx.fillRect(px(sx + i * 3.4) - 4, px(sz - CITY.roadHalf) + 2, 8, 14);
        ctx.fillRect(px(sx + i * 3.4) - 4, px(sz + CITY.roadHalf) - 16, 8, 14);
        ctx.fillRect(px(sx - CITY.roadHalf) + 2, px(sz + i * 3.4) - 4, 14, 8);
        ctx.fillRect(px(sx + CITY.roadHalf) - 16, px(sz + i * 3.4) - 4, 14, 8);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

function makeNeonTexture(word, color) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#14161c';
  ctx.fillRect(0, 0, 256, 64);
  ctx.font = 'bold 34px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.fillStyle = color;
  ctx.fillText(word, 128, 34);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function createCity(scene, random) {
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  // Ground.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(WORLD, WORLD),
    new THREE.MeshLambertMaterial({ map: makeGroundTexture(random) }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Water: a big plane south of the beach and east of the marina.
  const waterMat = new THREE.MeshLambertMaterial({ color: PALETTE.water });
  const waterSouth = new THREE.Mesh(new THREE.PlaneGeometry(900, 320), waterMat);
  waterSouth.rotation.x = -Math.PI / 2;
  waterSouth.position.set(0, -0.15, CITY.waterZ + 160);
  group.add(waterSouth);
  const waterEast = new THREE.Mesh(new THREE.PlaneGeometry(320, 900), waterMat);
  waterEast.rotation.x = -Math.PI / 2;
  waterEast.position.set(CITY.marinaX + 160, -0.15, 0);
  group.add(waterEast);

  // Buildings.
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  const windowMats = [
    new THREE.MeshLambertMaterial({ map: makeWindowTexture('#e8b48a', '#ffd98a') }),
    new THREE.MeshLambertMaterial({ map: makeWindowTexture('#d97b6c', '#ffe0a0') }),
    new THREE.MeshLambertMaterial({ map: makeWindowTexture('#7fb3d5', '#cfeaff') }),
    new THREE.MeshLambertMaterial({ map: makeWindowTexture('#f2e3c6', '#fff2c0') }),
    new THREE.MeshLambertMaterial({ map: makeWindowTexture('#9db38a', '#ffe9a8') }),
  ];
  const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4a52 });
  const glassMat = new THREE.MeshLambertMaterial({ color: PALETTE.glass, emissive: 0x0e2a3a });
  const neonWords = ['HOTEL', 'MARINA', 'CLUB', 'TACOS', 'PIER 9', 'CASINO'];
  const neonColors = ['#ff5e7a', '#4fc3f7', '#ffd23f', '#7dff9e', '#c98aff', '#ff9a3d'];

  let neonIndex = 0;
  for (const bx of [-126, -42, 42, 126]) {
    for (const bz of [-126, -42, 42, 126]) {
      if ((bx === -42 && bz === 42) || (bx === 126 && bz === -126)) continue; // parks stay open
      const downtown = Math.abs(bx) <= 42 && Math.abs(bz) <= 42;
      const count = downtown ? random.int(2, 3) : random.int(1, 2);
      for (let i = 0; i < count; i += 1) {
        const w = random.range(16, 26);
        const d = random.range(16, 26);
        const h = downtown ? random.range(18, 44) : random.range(7, 20);
        const x = bx + random.range(-16, 16) * (count > 1 ? 0.5 : 0) + (count === 1 ? 0 : (i === 0 ? -14 : 14));
        const z = bz + (count > 1 ? (i === 0 ? -14 : 14) : 0);
        const mat = random.pick(windowMats);
        const building = new THREE.Mesh(boxGeo, mat);
        building.scale.set(w, h, d);
        building.position.set(x, h / 2, z);
        building.castShadow = true;
        building.receiveShadow = true;
        group.add(building);
        const roof = new THREE.Mesh(boxGeo, roofMat);
        roof.scale.set(w * 0.7, 1.2, d * 0.7);
        roof.position.set(x, h + 0.6, z);
        group.add(roof);
        colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
        if (downtown && h > 26 && neonIndex < neonWords.length) {
          const neon = new THREE.Mesh(
            new THREE.PlaneGeometry(16, 4),
            new THREE.MeshBasicMaterial({ map: makeNeonTexture(neonWords[neonIndex], neonColors[neonIndex]) }),
          );
          neon.position.set(x, h - 4, z + d / 2 + 0.15);
          neonIndex += 1;
          group.add(neon);
        }
      }
    }
  }

  // A glass tower on the marina corner, the city's landmark.
  const tower = new THREE.Mesh(boxGeo, glassMat);
  tower.scale.set(24, 52, 24);
  tower.position.set(196, 26, -196);
  tower.castShadow = true;
  group.add(tower);
  colliders.push({ minX: 184, maxX: 208, minZ: -208, maxZ: -184 });

  // Palm trees along the avenues and the beach.
  const trunkGeo = new THREE.CylinderGeometry(0.22, 0.34, 7, 6);
  const trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmTrunk });
  const leafGeo = new THREE.ConeGeometry(2.6, 2.2, 6);
  const leafMat = new THREE.MeshLambertMaterial({ color: PALETTE.palmLeaf });
  function palm(x, z) {
    const trunk = new THREE.Mesh(trunkGeo, trunkMat);
    trunk.position.set(x, 3.5, z);
    trunk.rotation.z = random.range(-0.08, 0.08);
    trunk.castShadow = true;
    group.add(trunk);
    const leaves = new THREE.Mesh(leafGeo, leafMat);
    leaves.position.set(x, 7.6, z);
    leaves.scale.y = 0.55;
    leaves.castShadow = true;
    group.add(leaves);
    colliders.push({ minX: x - 0.4, maxX: x + 0.4, minZ: z - 0.4, maxZ: z + 0.4 });
  }
  for (const s of CITY.streets) {
    for (let v = -196; v <= 196; v += 28) {
      if (random.chance(0.6)) palm(s + 10.5, v);
      if (random.chance(0.6)) palm(s - 10.5, v + 14);
    }
  }
  for (let x = -200; x <= 200; x += 18) palm(x, CITY.beachZ + 8);

  // Street lamps on the corners.
  const poleGeo = new THREE.CylinderGeometry(0.09, 0.12, 6, 6);
  const poleMat = new THREE.MeshLambertMaterial({ color: PALETTE.lamp });
  const lampGeo = new THREE.SphereGeometry(0.32, 8, 6);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9b0 });
  for (const sx of CITY.streets) {
    for (const sz of CITY.streets) {
      const pole = new THREE.Mesh(poleGeo, poleMat);
      pole.position.set(sx + 9.5, 3, sz + 9.5);
      group.add(pole);
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(sx + 9.5, 6.1, sz + 9.5);
      group.add(lamp);
    }
  }

  // Marina docks on the east edge.
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x7a5c3e });
  for (let i = 0; i < 4; i += 1) {
    const dock = new THREE.Mesh(boxGeo, dockMat);
    dock.scale.set(26, 0.8, 4);
    dock.position.set(CITY.marinaX + 16, 0.4, -120 + i * 56);
    dock.castShadow = true;
    group.add(dock);
  }

  // --- Queries the other systems use ---------------------------------------
  function isOnRoad(x, z) {
    for (const s of CITY.streets) {
      if (Math.abs(x - s) <= CITY.roadHalf || Math.abs(z - s) <= CITY.roadHalf) return true;
    }
    return false;
  }

  function collideCircle(x, z, radius) {
    for (const c of colliders) {
      const cx = Math.max(c.minX, Math.min(x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < radius * radius) return { x: cx, z: cz };
    }
    return null;
  }

  function clampToCity(x, z, margin) {
    return {
      x: Math.max(-CITY.extent - 4, Math.min(CITY.marinaX + 30, x)),
      z: Math.max(-CITY.extent - 4, Math.min(CITY.waterZ + 6 - margin, z)),
    };
  }

  // A rectangle loop around one block, at lane offset, for traffic cars.
  function blockLoop(bx, bz, clockwise) {
    const o = 3.5;
    const r = CITY.roadHalf + o;
    const corners = [
      { x: bx - r, z: bz - r },
      { x: bx + r, z: bz - r },
      { x: bx + r, z: bz + r },
      { x: bx - r, z: bz + r },
    ];
    return clockwise ? corners : corners.reverse();
  }

  function randomRoadPoint() {
    const s = random.pick(CITY.streets);
    const along = random.range(-196, 196);
    if (random.chance(0.5)) return { x: s + random.range(-3, 3), z: along };
    return { x: along, z: s + random.range(-3, 3) };
  }

  function randomSidewalkPoint() {
    const bx = random.pick([-126, -42, 42, 126]);
    const bz = random.pick([-126, -42, 42, 126]);
    const side = random.int(0, 3);
    const t = random.range(-30, 30);
    if (side === 0) return { x: bx + t, z: bz - CITY.blockHalf - 2.5 };
    if (side === 1) return { x: bx + t, z: bz + CITY.blockHalf + 2.5 };
    if (side === 2) return { x: bx - CITY.blockHalf - 2.5, z: bz + t };
    return { x: bx + CITY.blockHalf + 2.5, z: bz + t };
  }

  return {
    group,
    colliders,
    isOnRoad,
    collideCircle,
    clampToCity,
    blockLoop,
    randomRoadPoint,
    randomSidewalkPoint,
  };
}
