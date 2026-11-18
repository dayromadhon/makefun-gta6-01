// SOLMAR HEAT — city.js
// One job: build Solmar Bay — the 5x5 street grid, downtown towers, beach,
// marina, palms and props — and hand back its colliders. Buildings sit only
// inside blocks, never on a road. All textures are drawn on a canvas at
// runtime; nothing is loaded from the network.

import * as THREE from 'three';
import { CONFIG } from './config.js';
import { range, rangeInt, pick } from './random.js';

function makeWindowTexture(base, litRatio, rng) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  for (let y = 10; y < 246; y += 22) {
    for (let x = 10; x < 118; x += 18) {
      const lit = rng() < litRatio;
      g.fillStyle = lit ? '#ffd97a' : '#22384f';
      g.fillRect(x, y, 12, 14);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeRoadTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#2e3138';
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#3a3e46';
  for (let i = 0; i < 40; i++) g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  g.fillStyle = '#f5d76e';
  g.fillRect(62, 8, 4, 34);
  g.fillRect(62, 86, 4, 34);
  g.fillStyle = '#e8e8e8';
  g.fillRect(6, 0, 3, 128);
  g.fillRect(119, 0, 3, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function buildCity(scene, rng, fxLow) {
  const group = new THREE.Group();
  group.name = 'city';
  const colliders = []; // {minX,maxX,minZ,maxZ}
  const circles = []; // {x,z,r} small round obstacles (palms, lamps)
  const C = CONFIG.colors;
  const lines = CONFIG.streetLines;
  const half = CONFIG.cityHalf;

  // Ground: one big slab, city grey-green.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(CONFIG.groundSize, CONFIG.groundSize),
    new THREE.MeshLambertMaterial({ color: 0x9aa78a }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // Roads: textured strips along every street line, both directions.
  const roadTex = makeRoadTexture();
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  const roadLen = half * 2 + 24;
  for (const line of lines) {
    for (const horizontal of [true, false]) {
      const tex = roadTex.clone();
      tex.needsUpdate = true;
      tex.repeat.set(roadLen / 12, 1);
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(roadLen, CONFIG.roadHalfWidth * 2),
        new THREE.MeshLambertMaterial({ map: tex }),
      );
      m.rotation.x = -Math.PI / 2;
      if (!horizontal) m.rotation.z = Math.PI / 2;
      m.position.set(horizontal ? 0 : line, 0.02, horizontal ? line : 0);
      m.receiveShadow = true;
      group.add(m);
    }
  }

  // Sidewalks: pale strips flanking each road.
  const walkMat = new THREE.MeshLambertMaterial({ color: C.sidewalk });
  for (const line of lines) {
    for (const horizontal of [true, false]) {
      for (const side of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.PlaneGeometry(roadLen, 3), walkMat);
        w.rotation.x = -Math.PI / 2;
        if (!horizontal) w.rotation.z = Math.PI / 2;
        const off = line + side * (CONFIG.roadHalfWidth + 1.5);
        w.position.set(horizontal ? 0 : off, 0.03, horizontal ? off : 0);
        w.receiveShadow = true;
        group.add(w);
      }
    }
  }

  // Buildings: one or two per block, inside the block bounds only.
  const baseColors = C.building;
  const facades = baseColors.map((col, i) => {
    const hex = `#${col.toString(16).padStart(6, '0')}`;
    return makeWindowTexture(hex, 0.25 + i * 0.06, rng);
  });
  const blockCenters = [];
  for (let i = 0; i < lines.length - 1; i++) {
    for (let j = 0; j < lines.length - 1; j++) {
      blockCenters.push({ x: (lines[i] + lines[i + 1]) / 2, z: (lines[j] + lines[j + 1]) / 2 });
    }
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (const b of blockCenters) {
    const distCenter = Math.hypot(b.x, b.z);
    const downtown = distCenter < 60;
    const n = downtown ? rangeInt(rng, 1, 2) : rangeInt(rng, 1, 3);
    for (let k = 0; k < n; k++) {
      const w = range(rng, 12, 26);
      const d = range(rng, 12, 26);
      const h = downtown ? range(rng, 22, 55) : range(rng, 8, 24);
      const x = b.x + range(rng, -8, 8) + (k === 1 ? (rng() < 0.5 ? -10 : 10) : 0);
      const z = b.z + range(rng, -8, 8) + (k === 1 ? (rng() < 0.5 ? -10 : 10) : 0);
      // Clamp inside the block so no wall ever lands on a road.
      const cx = Math.max(b.x - CONFIG.blockHalf + w / 2 + 2, Math.min(b.x + CONFIG.blockHalf - w / 2 - 2, x));
      const cz = Math.max(b.z - CONFIG.blockHalf + d / 2 + 2, Math.min(b.z + CONFIG.blockHalf - d / 2 - 2, z));
      const mat = new THREE.MeshLambertMaterial({ map: pick(rng, facades) });
      const mesh = new THREE.Mesh(boxGeo, mat);
      mesh.scale.set(w, h, d);
      mesh.position.set(cx, h / 2, cz);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      // Roof cap.
      const roof = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: 0x555049 }));
      roof.scale.set(w + 0.6, 0.8, d + 0.6);
      roof.position.set(cx, h + 0.4, cz);
      group.add(roof);
      colliders.push({ minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2 });
    }
  }

  // Landmark buildings (garage, hotel, hideout) — low boxes with a sign colour.
  // They sit INSIDE blocks, never on a street: the hideout used to sit on
  // street z=100 and wedged cars against it.
  function landmarkBox(x, z, w, h, d, color) {
    const m = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color }));
    m.scale.set(w, h, d);
    m.position.set(x, h / 2, z);
    m.castShadow = true;
    group.add(m);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return m;
  }
  landmarkBox(-84, -65, 16, 7, 10, 0xc96a3b); // Ada's garage (block by the (-100,-50) corner)
  landmarkBox(66, -88, 20, 34, 16, 0xe8dcc0); // Hotel Solmar (block by the (50,-100) corner)
  landmarkBox(-75, 85, 14, 6, 10, 0x7a6a55); // Hideout (block by the (-75,100) pier road)

  // Beach: sand strip along the south edge, then the sea.
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(CONFIG.groundSize, 26),
    new THREE.MeshLambertMaterial({ color: C.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0.04, half + 13);
  group.add(sand);
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(CONFIG.groundSize, 60),
    new THREE.MeshLambertMaterial({ color: C.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0.0, half + 56);
  group.add(sea);

  // Beach umbrellas.
  const umbMat = new THREE.MeshLambertMaterial({ color: 0xe86a6a });
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x8a7a5a });
  for (let i = 0; i < 8; i++) {
    const x = -100 + i * 28 + range(rng, -6, 6);
    const z = half + 10 + range(rng, -3, 3);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 3, 6), poleMat);
    pole.position.set(x, 1.5, z);
    group.add(pole);
    const top = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.2, 8), umbMat);
    top.position.set(x, 3.4, z);
    group.add(top);
  }

  // Marina: docks and boats on the east edge.
  const dockMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
  for (let i = 0; i < 3; i++) {
    const dock = new THREE.Mesh(boxGeo, dockMat);
    dock.scale.set(14, 0.6, 4);
    dock.position.set(half + 8, 0.3, 20 + i * 30);
    group.add(dock);
    const hull = new THREE.Mesh(boxGeo, new THREE.MeshLambertMaterial({ color: pick(rng, [0xf0f0f0, 0xd8e8f0, 0xf0d8d8]) }));
    hull.scale.set(8, 2, 3);
    hull.position.set(half + 8, 1.2, 26 + i * 30);
    group.add(hull);
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 7, 6), poleMat);
    mast.position.set(half + 8, 5, 26 + i * 30);
    group.add(mast);
  }
  const marinaWater = new THREE.Mesh(
    new THREE.PlaneGeometry(30, 120),
    new THREE.MeshLambertMaterial({ color: C.sea }),
  );
  marinaWater.rotation.x = -Math.PI / 2;
  marinaWater.position.set(half + 15, 0.01, 50);
  group.add(marinaWater);

  // The pier: a wooden boardwalk at the south-west corner.
  const pier = new THREE.Mesh(boxGeo, dockMat);
  pier.scale.set(10, 0.8, 26);
  pier.position.set(-108, 0.4, 88);
  group.add(pier);

  // Palms along the beach and the avenues.
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a3a });
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  function palm(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 6, 6), trunkMat);
    trunk.position.set(x, 3, z);
    trunk.castShadow = true;
    group.add(trunk);
    for (let i = 0; i < 5; i++) {
      const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.4, 5), leafMat);
      const a = (i / 5) * Math.PI * 2;
      leaf.position.set(x + Math.cos(a) * 1.2, 6.4, z + Math.sin(a) * 1.2);
      leaf.rotation.z = Math.cos(a) * 0.9;
      leaf.rotation.x = -Math.sin(a) * 0.9;
      group.add(leaf);
    }
    circles.push({ x, z, r: 0.8 });
  }
  for (let x = -105; x <= 105; x += 21) palm(x, half + 6);
  for (const line of [-50, 50]) for (let z = -100; z <= 100; z += 50) palm(line + 9, z);

  // Streetlights along the streets.
  const lampMat = new THREE.MeshLambertMaterial({ color: 0x3a3f46 });
  const lampGlow = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xffe9a8, emissiveIntensity: 0.7 });
  if (!fxLow) {
    for (const line of lines) {
      for (let s = -100; s <= 100; s += 50) {
        for (const [x, z] of [[line + 8, s], [s, line + 8]]) {
          const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5.5, 6), lampMat);
          pole.position.set(x, 2.75, z);
          group.add(pole);
          const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 6), lampGlow);
          lamp.position.set(x, 5.6, z);
          group.add(lamp);
          circles.push({ x, z, r: 0.4 });
        }
      }
    }
  }

  // Sun + sky.
  const sun = new THREE.DirectionalLight(C.sun, 1.6);
  sun.position.set(80, 120, 40);
  sun.castShadow = !fxLow;
  if (!fxLow) {
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -140;
    sun.shadow.camera.right = 140;
    sun.shadow.camera.top = 140;
    sun.shadow.camera.bottom = -140;
    sun.shadow.camera.far = 400;
  }
  group.add(sun);
  group.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 0.9));
  scene.fog = new THREE.Fog(C.fog, 180, 420);

  scene.add(group);
  return { group, colliders, circles, sun };
}

// True when (x,z) is inside a building collider (with a margin for the radius).
export function hitsCollider(colliders, x, z, r) {
  for (const c of colliders) {
    if (x > c.minX - r && x < c.maxX + r && z > c.minZ - r && z < c.maxZ + r) return c;
  }
  return null;
}

export function hitsCircle(circles, x, z, r) {
  for (const c of circles) {
    const dx = x - c.x;
    const dz = z - c.z;
    if (dx * dx + dz * dz < (c.r + r) * (c.r + r)) return c;
  }
  return null;
}
