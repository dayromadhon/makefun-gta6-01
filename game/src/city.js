// Solmar Heat — the city of Solmar Bay.
// One job: build every static mesh (ground, roads, buildings, beach, marina,
// palms, lamps) and own the collision boxes the moving things bump into.

import { WORLD, COLORS } from './config.js';
import { mulberry32, range, pick } from './random.js';

const THREE = window.THREE;

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function facadeTexture(base, litRatio) {
  return canvasTexture(128, 256, (g, w, h) => {
    g.fillStyle = base;
    g.fillRect(0, 0, w, h);
    // window grid: some lit warm, most dark glass
    for (let row = 0; row < 12; row++) {
      for (let col = 0; col < 6; col++) {
        const lit = Math.random() < litRatio;
        g.fillStyle = lit ? '#ffd98a' : '#2c3e50';
        g.fillRect(10 + col * 19, 12 + row * 20, 12, 13);
      }
    }
  });
}

function roadTexture() {
  return canvasTexture(64, 256, (g, w, h) => {
    g.fillStyle = '#3a3f46';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#d8d3a0';
    g.fillRect(w / 2 - 2, 20, 4, 60);
    g.fillRect(w / 2 - 2, 148, 4, 60);
    g.fillStyle = '#b9b3a4';
    g.fillRect(0, 0, 3, h);
    g.fillRect(w - 3, 0, 3, h);
  });
}

export function createCity(scene, seed) {
  const rng = mulberry32(seed);
  const colliders = [];
  const group = new THREE.Group();
  scene.add(group);

  const addCollider = (x0, z0, x1, z1) => {
    colliders.push({ x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1) });
  };

  // --- ground, beach, sea -------------------------------------------------
  const grass = new THREE.Mesh(
    new THREE.PlaneGeometry(460, 460),
    new THREE.MeshLambertMaterial({ color: COLORS.ground }),
  );
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(0, -0.05, 0);
  group.add(grass);

  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(340, 62),
    new THREE.MeshLambertMaterial({ color: COLORS.sand }),
  );
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, 0, -131);
  group.add(sand);

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 90),
    new THREE.MeshLambertMaterial({ color: COLORS.sea }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -0.4, -177);
  group.add(sea);

  // --- roads ---------------------------------------------------------------
  const roadTex = roadTexture();
  roadTex.wrapS = THREE.RepeatWrapping;
  roadTex.wrapT = THREE.RepeatWrapping;
  const roadMat = new THREE.MeshLambertMaterial({ map: roadTex });
  for (const x of WORLD.streets) {
    const tex = roadTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, 7);
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(WORLD.roadWidth, 212),
      new THREE.MeshLambertMaterial({ map: tex }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(x, 0.02, 0);
    group.add(road);
  }
  for (const z of WORLD.streets) {
    const tex = roadTex.clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, 7);
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(212, WORLD.roadWidth),
      new THREE.MeshLambertMaterial({ map: tex }),
    );
    road.rotation.x = -Math.PI / 2;
    road.rotation.z = Math.PI / 2;
    road.position.set(0, 0.02, z);
    group.add(road);
  }

  // --- buildings -----------------------------------------------------------
  const towerTexs = [
    facadeTexture('#7f9db5', 0.25),
    facadeTexture('#6d8fa8', 0.18),
    facadeTexture('#93aec2', 0.3),
  ];
  const lowTexs = [
    facadeTexture('#e8c39a', 0.35),
    facadeTexture('#d9a06f', 0.3),
    facadeTexture('#c98d64', 0.28),
    facadeTexture('#e0b184', 0.32),
  ];
  const roofMat = new THREE.MeshLambertMaterial({ color: COLORS.buildingRoof });

  function building(cx, cz, w, d, h, tex) {
    const side = new THREE.MeshLambertMaterial({ map: tex });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [side, side, roofMat, roofMat, side, side]);
    mesh.position.set(cx, h / 2, cz);
    group.add(mesh);
    addCollider(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2);
    return mesh;
  }

  const blockCenters = [-60, -20, 20, 60];
  const landmarkBlocks = new Set(['-60,60', '60,60', '-60,-60', '20,-60']);
  for (const bx of blockCenters) {
    for (const bz of blockCenters) {
      if (landmarkBlocks.has(`${bx},${bz}`)) continue;
      const downtown = Math.abs(bx) <= 20 && Math.abs(bz) <= 20;
      if (downtown) {
        // two towers per downtown block, offset diagonally
        building(bx - 7, bz - 7, 13, 13, range(rng, 28, 52), pick(rng, towerTexs));
        building(bx + 8, bz + 8, 12, 12, range(rng, 22, 44), pick(rng, towerTexs));
      } else {
        // one or two low stucco buildings per outer block
        building(bx - 6, bz - 5, 12, 10, range(rng, 5, 9), pick(rng, lowTexs));
        if (rng() < 0.7) building(bx + 7, bz + 6, 10, 9, range(rng, 4, 8), pick(rng, lowTexs));
      }
    }
  }

  // --- landmarks -----------------------------------------------------------
  // Ada's Garage: low wide workshop with a striped awning.
  building(-66, 72, 18, 10, 6, lowTexs[1]);
  const awning = new THREE.Mesh(
    new THREE.BoxGeometry(18, 0.4, 5),
    new THREE.MeshLambertMaterial({ color: 0x2e6fc2 }),
  );
  awning.position.set(-66, 5.2, 78.5);
  group.add(awning);

  // Hotel Solmar: the tall glass tower on the south-east block.
  building(60, 60, 16, 16, 46, towerTexs[0]);

  // Hideout: a small fenced house on the north-west block.
  building(-66, -66, 10, 8, 5, lowTexs[3]);

  // Clinic: white low building with a green cross plate.
  const clinic = building(20, -66, 14, 9, 6, facadeTexture('#eef2f0', 0.4));
  const cross = new THREE.Mesh(
    new THREE.BoxGeometry(3, 3, 0.3),
    new THREE.MeshLambertMaterial({ color: 0x2fae5f }),
  );
  cross.position.set(20, 5, -61.2);
  group.add(cross);
  void clinic;

  // Marina: wooden docks east of the city with three moored boats.
  const dockMat = new THREE.MeshLambertMaterial({ color: COLORS.dock });
  for (const dz of [4, 20, 36]) {
    const dock = new THREE.Mesh(new THREE.BoxGeometry(24, 1, 4), dockMat);
    dock.position.set(116, 0.5, dz);
    group.add(dock);
    addCollider(104, dz - 2, 128, dz + 2);
  }
  const boatColors = [0xe8e4da, 0xc23b2e, 0x2e6fc2];
  boatColors.forEach((c, i) => {
    const hull = new THREE.Mesh(new THREE.BoxGeometry(7, 1.6, 2.6), new THREE.MeshLambertMaterial({ color: c }));
    hull.position.set(112 + i * 2, 0.4, 8 + i * 14);
    hull.rotation.y = 0.3;
    group.add(hull);
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.4, 2), new THREE.MeshLambertMaterial({ color: 0xffffff }));
    cabin.position.set(112 + i * 2, 1.8, 8 + i * 14);
    cabin.rotation.y = 0.3;
    group.add(cabin);
  });

  // South Pier: planks out over the water at x = 0.
  for (let z = -102; z >= -138; z -= 4) {
    const plank = new THREE.Mesh(new THREE.BoxGeometry(7, 0.5, 3.6), dockMat);
    plank.position.set(0, 0.3, z);
    group.add(plank);
  }

  // --- palms along the two main avenues ------------------------------------
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
  const crownMat = new THREE.MeshLambertMaterial({ color: 0x3f9e4d });
  function palm(x, z) {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 6), trunkMat);
    trunk.position.set(x, 3.5, z);
    trunk.rotation.z = range(rng, -0.06, 0.06);
    group.add(trunk);
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 0), crownMat);
    crown.scale.set(1.4, 0.6, 1.4);
    crown.position.set(x, 7.4, z);
    group.add(crown);
  }
  for (const s of [-80, -40, 40, 80]) {
    palm(6, s);
    palm(-6, s);
    palm(s, 6);
    palm(s, -6);
  }
  palm(-30, -108);
  palm(24, -106);
  palm(-52, -110);

  // --- street lamps at the main intersections ------------------------------
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2a2d33 });
  const lampMat = new THREE.MeshLambertMaterial({ color: 0xfff2b0, emissive: 0x554400 });
  for (const x of [-80, 0, 80]) {
    for (const z of [-80, 0, 80]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), poleMat);
      pole.position.set(x + 6, 3, z + 6);
      group.add(pole);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), lampMat);
      head.position.set(x + 6, 6.2, z + 6);
      group.add(head);
    }
  }

  // --- collision helpers ----------------------------------------------------
  function resolveCircle(x, z, r) {
    let hit = false;
    for (const b of colliders) {
      const cx = Math.max(b.x0, Math.min(x, b.x1));
      const cz = Math.max(b.z0, Math.min(z, b.z1));
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        hit = true;
        if (d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = (r - d) / d;
          x += dx * push;
          z += dz * push;
        } else {
          // centre inside the box: push out along the smallest penetration
          const pl = x - b.x0;
          const pr = b.x1 - x;
          const pt = z - b.z0;
          const pb = b.z1 - z;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) x = b.x0 - r;
          else if (m === pr) x = b.x1 + r;
          else if (m === pt) z = b.z0 - r;
          else z = b.z1 + r;
        }
      }
    }
    return { x, z, hit };
  }

  return {
    group,
    colliders,
    resolveCircle,
    // Is a point on a road (within the asphalt half-width of a street line)?
    isRoad(x, z) {
      const near = (v) => WORLD.streets.some((s) => Math.abs(v - s) <= WORLD.roadWidth / 2);
      return near(x) || near(z);
    },
  };
}
