// SOLMAR HEAT — city: builds the whole map from the seeded RNG — roads,
// sidewalks, towers, palms, beach, marina — and reports building colliders.
import * as THREE from 'three';
import { CFG, COLORS } from './config.js';

function facadeTexture(base, lit, rng) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  // Window grid, some lit warm yellow.
  for (let row = 0; row < 10; row++) {
    for (let col = 0; col < 5; col++) {
      const x = 10 + col * 23;
      const y = 12 + row * 24;
      g.fillStyle = rng.chance(0.35) ? lit : 'rgba(20,30,44,0.85)';
      g.fillRect(x, y, 14, 16);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function roadTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#2e2f33';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#e8d24a';
  g.fillRect(30, 0, 4, 22);
  g.fillRect(30, 42, 4, 22);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class City {
  constructor(scene, rng, lowFx) {
    this.scene = scene;
    this.rng = rng;
    this.lowFx = lowFx;
    this.colliders = [];
    this.roadCenters = [];
    this.palmPositions = [];
    this.build();
  }

  get pitch() {
    return CFG.pitch;
  }

  roadCenter(i) {
    return (i - CFG.blocks / 2) * CFG.pitch;
  }

  build() {
    const { scene, rng } = this;
    const P = CFG.pitch;
    const half = CFG.half;

    // Base ground: grass green across the whole map.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(half * 2 + 160, half * 2 + 160),
      new THREE.MeshLambertMaterial({ color: COLORS.ground }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    scene.add(ground);

    // Roads: one long strip per grid line, both directions.
    const roadTex = roadTexture();
    for (let i = 0; i <= CFG.blocks; i++) {
      const c = this.roadCenter(i);
      this.roadCenters.push(c);
      const mkRoad = (w, l, x, z, rotY) => {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(w, l),
          new THREE.MeshLambertMaterial({ map: roadTex }),
        );
        m.rotation.x = -Math.PI / 2;
        m.rotation.z = rotY;
        m.position.set(x, 0, z);
        roadTex.repeat.set(1, Math.max(1, Math.round(l / 12)));
        m.receiveShadow = true;
        scene.add(m);
      };
      mkRoad(CFG.road, half * 2 + CFG.road, c, 0, 0);
      mkRoad(CFG.road, half * 2 + CFG.road, 0, c, Math.PI / 2);
    }

    // Sidewalk slabs inside each block (a flat frame around the buildings).
    const walkMat = new THREE.MeshLambertMaterial({ color: COLORS.sidewalk });
    for (let bx = 0; bx < CFG.blocks; bx++) {
      for (let bz = 0; bz < CFG.blocks; bz++) {
        const cx = this.roadCenter(bx) + P / 2;
        const cz = this.roadCenter(bz) + P / 2;
        const slab = new THREE.Mesh(new THREE.PlaneGeometry(CFG.block + 2, CFG.block + 2), walkMat);
        slab.rotation.x = -Math.PI / 2;
        slab.position.set(cx, 0.02, cz);
        slab.receiveShadow = true;
        scene.add(slab);
      }
    }

    // Buildings: 1-3 per block, downtown (centre 3x3) gets towers.
    const downtown = (bx, bz) => bx >= 1 && bx <= 3 && bz >= 1 && bz <= 3;
    const facadeCache = new Map();
    const facadeFor = (base) => {
      if (!facadeCache.has(base)) {
        facadeCache.set(base, facadeTexture(base, '#ffd98a', rng));
      }
      return facadeCache.get(base);
    };
    for (let bx = 0; bx < CFG.blocks; bx++) {
      for (let bz = 0; bz < CFG.blocks; bz++) {
        const cx = this.roadCenter(bx) + P / 2;
        const cz = this.roadCenter(bz) + P / 2;
        const isDown = downtown(bx, bz);
        const count = isDown ? rng.int(1, 2) : rng.int(1, 3);
        for (let k = 0; k < count; k++) {
          const w = rng.range(9, 15);
          const d = rng.range(9, 15);
          const h = isDown ? rng.range(26, 58) : rng.range(7, 18);
          const ox = rng.range(-7, 7);
          const oz = rng.range(-7, 7);
          const x = cx + ox;
          const z = cz + oz;
          const base = '#' + new THREE.Color(rng.pick(isDown ? COLORS.downtown : COLORS.building)).getHexString();
          const mat = new THREE.MeshLambertMaterial({ map: facadeFor(base) });
          const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
          b.position.set(x, h / 2, z);
          b.castShadow = true;
          b.receiveShadow = true;
          scene.add(b);
          const roof = new THREE.Mesh(
            new THREE.BoxGeometry(w + 0.6, 0.7, d + 0.6),
            new THREE.MeshLambertMaterial({ color: 0x4a4a4a }),
          );
          roof.position.set(x, h + 0.35, z);
          scene.add(roof);
          this.colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
        }
      }
    }

    // Beach + sea along the south edge, marina + docks on the east edge.
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(half * 2 + 160, 26),
      new THREE.MeshLambertMaterial({ color: COLORS.sand }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.03, half + 18);
    sand.receiveShadow = true;
    scene.add(sand);
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(half * 2 + 320, 130),
      new THREE.MeshLambertMaterial({ color: COLORS.water }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, 0.01, half + 95);
    scene.add(sea);
    const seaEast = sea.clone();
    seaEast.position.set(half + 95, 0.01, 0);
    seaEast.rotation.z = Math.PI / 2;
    scene.add(seaEast);

    // Marina deck + moored boats (simple hulls) on the east edge.
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(10, 1, 70),
      new THREE.MeshLambertMaterial({ color: COLORS.marinaDeck }),
    );
    deck.position.set(half + 2, 0.5, 30);
    deck.castShadow = true;
    scene.add(deck);
    for (let i = 0; i < 4; i++) {
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(3.4, 1.2, 9),
        new THREE.MeshLambertMaterial({ color: [0xe8e8e8, 0xc23b2e, 0x2e6fc2, 0xe8c832][i] }),
      );
      hull.position.y = 0.6;
      boat.add(hull);
      const cabin = new THREE.Mesh(
        new THREE.BoxGeometry(2.4, 1.2, 3.4),
        new THREE.MeshLambertMaterial({ color: 0xf5f5f5 }),
      );
      cabin.position.set(0, 1.6, -1);
      boat.add(cabin);
      boat.position.set(half + 14 + rng.range(0, 4), 0, 6 + i * 15);
      boat.rotation.y = rng.range(-0.1, 0.1);
      scene.add(boat);
    }

    // Pier jutting into the sea at the south edge.
    const pier = new THREE.Mesh(
      new THREE.BoxGeometry(8, 1, 34),
      new THREE.MeshLambertMaterial({ color: COLORS.marinaDeck }),
    );
    pier.position.set(-30, 0.5, half + 30);
    pier.castShadow = true;
    scene.add(pier);
    for (let i = 0; i < 4; i++) {
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.3, 0.3, 2.4, 6),
        new THREE.MeshLambertMaterial({ color: 0x6a4f30 }),
      );
      post.position.set(-33 + (i % 2) * 6, 0.6, half + 16 + Math.floor(i / 2) * 26);
      scene.add(post);
    }

    // Palm trees along the avenues and the beach.
    const palmCount = this.lowFx ? 12 : CFG.palms;
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8a6f4d });
    const frondMat = new THREE.MeshLambertMaterial({ color: 0x2f8f4f });
    for (let i = 0; i < palmCount; i++) {
      const onBeach = i % 3 === 0;
      const x = onBeach ? rng.range(-half + 10, half - 10) : this.roadCenter(rng.int(0, CFG.blocks)) + rng.pick([-8, 8]);
      const z = onBeach ? half + rng.range(6, 22) : rng.range(-half + 10, half - 10);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 6, 6), trunkMat);
      trunk.position.set(x, 3, z);
      trunk.castShadow = true;
      scene.add(trunk);
      const fronds = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.2, 7), frondMat);
      fronds.position.set(x, 6.8, z);
      fronds.castShadow = true;
      scene.add(fronds);
      this.palmPositions.push({ x, z });
    }

    // Hotel Solmar: the one named landmark, a wide low tower on the north edge.
    const hotel = new THREE.Mesh(
      new THREE.BoxGeometry(26, 16, 12),
      new THREE.MeshLambertMaterial({ map: facadeFor('#e8d8b0') }),
    );
    hotel.position.set(12, 8, -half - 2);
    hotel.castShadow = true;
    scene.add(hotel);
    this.colliders.push({ minX: -1, maxX: 25, minZ: -half - 8, maxZ: -half + 4 });
  }

  // Push a circle (x, z, radius) out of every building collider it overlaps.
  resolveCollision(x, z, radius) {
    let nx = x;
    let nz = z;
    for (const c of this.colliders) {
      const cx = Math.max(c.minX, Math.min(nx, c.maxX));
      const cz = Math.max(c.minZ, Math.min(nz, c.maxZ));
      const dx = nx - cx;
      const dz = nz - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < radius * radius) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          nx = cx + (dx / d) * radius;
          nz = cz + (dz / d) * radius;
        } else {
          nz = c.maxZ + radius;
        }
      }
    }
    return { x: nx, z: nz };
  }

  // A random point on a road, for spawning cars and pedestrians.
  randomRoadPoint() {
    const vertical = this.rng.chance(0.5);
    const c = this.roadCenter(this.rng.int(0, CFG.blocks));
    const along = this.rng.range(-CFG.half + 8, CFG.half - 8);
    return vertical ? { x: c, z: along } : { x: along, z: c };
  }
}
