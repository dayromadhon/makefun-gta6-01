// Solmar Heat — the city of Solmar Bay. One job: build every static piece
// of the world (ground, roads, blocks, towers, beach, marina, palms) and
// answer collision questions about it.
import { WORLD, COLORS } from './config.js';
import { pick, range, intRange } from './random.js';

// Canvas texture with a lit-window grid, drawn once at runtime (no files).
function facadeTexture(rng, base, windowColor, floors, cols) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  const cw = 128 / cols;
  const ch = 256 / floors;
  for (let f = 0; f < floors; f++) {
    for (let col = 0; col < cols; col++) {
      const lit = rng() < 0.45;
      g.fillStyle = lit ? windowColor : 'rgba(20,28,38,0.85)';
      g.fillRect(col * cw + 3, f * ch + 4, cw - 6, ch - 8);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class City {
  constructor(scene, rng, fxLow) {
    this.scene = scene;
    this.rng = rng;
    this.fxLow = fxLow;
    // Solid axis-aligned boxes the player, cars and peds must not enter.
    this.solids = [];
    this.group = new THREE.Group();
    this.group.name = 'city';
    scene.add(this.group);
    this.buildGround();
    this.buildRoads();
    this.buildBlocks();
    this.buildBeach();
    this.buildMarina();
    this.buildPalms();
    this.buildStreetProps();
  }

  mat(color, opts = {}) {
    return new THREE.MeshLambertMaterial({ color, ...opts });
  }

  box(w, h, d, material, x, y, z, ry = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    if (!this.fxLow) {
      m.castShadow = h > 2;
      m.receiveShadow = true;
    }
    this.group.add(m);
    return m;
  }

  buildGround() {
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(460, 460),
      this.mat(COLORS.ground),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  buildRoads() {
    const roadMat = this.mat(COLORS.road);
    const walkMat = this.mat(COLORS.sidewalk);
    const dashMat = this.mat(0xe8e4d8);
    const w = WORLD.roadWidth;
    for (const c of WORLD.grid) {
      // North-south and east-west asphalt.
      this.box(w, 0.1, 260, roadMat, c, 0.05, 0, 0);
      this.box(260, 0.1, w, roadMat, 0, 0.05, c, 0);
      // Sidewalks hugging each road.
      this.box(2, 0.14, 260, walkMat, c - w / 2 - 1, 0.07, 0, 0);
      this.box(2, 0.14, 260, walkMat, c + w / 2 + 1, 0.07, 0, 0);
      this.box(260, 0.14, 2, walkMat, 0, 0.07, c - w / 2 - 1, 0);
      this.box(260, 0.14, 2, walkMat, 0, 0.07, c + w / 2 + 1, 0);
      // Dashed center lines.
      for (let t = -120; t <= 120; t += 8) {
        this.box(0.4, 0.12, 3, dashMat, c, 0.06, t, 0);
        this.box(3, 0.12, 0.4, dashMat, t, 0.06, c, 0);
      }
    }
  }

  buildBlocks() {
    const rng = this.rng;
    const glass = facadeTexture(rng, '#2c4a66', '#ffd97a', 18, 6);
    const glass2 = facadeTexture(rng, '#3a3f4a', '#9fd8ff', 12, 5);
    const brick = facadeTexture(rng, '#7a5a44', '#ffe9b0', 6, 5);
    const towerMat = new THREE.MeshLambertMaterial({ map: glass });
    const towerMat2 = new THREE.MeshLambertMaterial({ map: glass2 });
    const brickMat = new THREE.MeshLambertMaterial({ map: brick });
    const roofMat = this.mat(0x4a4a52);
    const houseColors = [0xd8c9a8, 0xc9a06a, 0xa8b8c8, 0xd8a8a0, 0xb8c8a8];
    const parkMat = this.mat(0x5a8a4a);

    for (let ix = 0; ix < 4; ix++) {
      for (let iz = 0; iz < 4; iz++) {
        const cx = -60 + ix * 40;
        const cz = -60 + iz * 40;
        const downtown = cx >= -20 && cx <= 40 && cz >= -80 && cz <= 0;
        const roll = rng();
        if (roll < 0.14) {
          // Pocket park: lawn, a few trees, benches.
          const lawn = this.box(28, 0.2, 28, parkMat, cx, 0.1, cz, 0);
          lawn.receiveShadow = true;
          for (let t = 0; t < 5; t++) {
            this.tree(cx + range(rng, -11, 11), cz + range(rng, -11, 11));
          }
          continue;
        }
        if (downtown) {
          const h = range(rng, 34, 68);
          const m = pick(rng, [towerMat, towerMat2]);
          this.box(range(rng, 16, 22), h, range(rng, 16, 22), m, cx, h / 2, cz, 0);
          this.box(20, 1.5, 20, roofMat, cx, h + 0.7, cz, 0);
          this.solids.push({ minX: cx - 11, maxX: cx + 11, minZ: cz - 11, maxZ: cz + 11 });
          continue;
        }
        if (roll < 0.55) {
          // Low office / shop block with a brick face.
          const h = range(rng, 8, 16);
          this.box(range(rng, 18, 24), h, range(rng, 14, 20), brickMat, cx, h / 2, cz, 0);
          this.box(22, 1, 18, roofMat, cx, h + 0.5, cz, 0);
          this.solids.push({ minX: cx - 12, maxX: cx + 12, minZ: cz - 10, maxZ: cz + 10 });
        } else {
          // Two houses with pitched roofs.
          for (const [ox, oz] of [[-7, -6], [7, 6]]) {
            const h = range(rng, 4, 6);
            const col = pick(rng, houseColors);
            this.box(10, h, 9, this.mat(col), cx + ox, h / 2, cz + oz, 0);
            const roof = new THREE.Mesh(
              new THREE.ConeGeometry(7.5, 3.5, 4),
              this.mat(0x8a4a3a),
            );
            roof.position.set(cx + ox, h + 1.7, cz + oz);
            roof.rotation.y = Math.PI / 4;
            roof.castShadow = !this.fxLow;
            this.group.add(roof);
          }
          this.solids.push({ minX: cx - 13, maxX: cx - 1, minZ: cz - 11, maxZ: cz - 1 });
          this.solids.push({ minX: cx + 1, maxX: cx + 13, minZ: cz + 1, maxZ: cz + 11 });
        }
      }
    }
    // Hotel Solmar: the tall glass slab on the north-east block.
    const hotel = this.box(26, 46, 14, towerMat2, 40, 23, -40, 0);
    hotel.name = 'hotel-solmar';
    this.solids.push({ minX: 27, maxX: 53, minZ: -47, maxZ: -33 });
  }

  tree(x, z) {
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.4, 3.2, 6),
      this.mat(0x6a4a2a),
    );
    trunk.position.set(x, 1.6, z);
    trunk.castShadow = !this.fxLow;
    this.group.add(trunk);
    const top = new THREE.Mesh(
      new THREE.SphereGeometry(2.1, 8, 6),
      this.mat(0x3f7a34),
    );
    top.position.set(x, 4.2, z);
    top.castShadow = !this.fxLow;
    this.group.add(top);
  }

  palm(x, z) {
    const rng = this.rng;
    const trunk = new THREE.Mesh(
      new THREE.CylinderGeometry(0.22, 0.42, 7, 6),
      this.mat(0x7a5a38),
    );
    trunk.position.set(x, 3.5, z);
    trunk.rotation.z = range(rng, -0.08, 0.08);
    trunk.castShadow = !this.fxLow;
    this.group.add(trunk);
    const frondMat = this.mat(0x2f7a3a);
    for (let i = 0; i < 6; i++) {
      const frond = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 3.4), frondMat);
      const a = (i / 6) * Math.PI * 2;
      frond.position.set(x + Math.sin(a) * 1.2, 7.1, z + Math.cos(a) * 1.2);
      frond.rotation.y = a;
      frond.rotation.x = 0.5;
      this.group.add(frond);
    }
  }

  buildBeach() {
    // Sand strip along the south edge, then the sea.
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(460, 44),
      this.mat(COLORS.sand),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.03, 122);
    sand.receiveShadow = true;
    this.group.add(sand);
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(460, 120),
      new THREE.MeshLambertMaterial({ color: COLORS.sea, transparent: true, opacity: 0.92 }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, 0.02, 204);
    this.group.add(sea);
    // South Pier: wooden boards out to the water at x = 0.
    const wood = this.mat(0x8a6a44);
    for (let z = 104; z <= 126; z += 2.2) {
      this.box(8, 0.3, 2, wood, 0, 0.35, z, 0);
    }
    this.box(0.5, 1.2, 24, wood, -4, 0.6, 115, 0);
    this.box(0.5, 1.2, 24, wood, 4, 0.6, 115, 0);
    // Beach umbrellas.
    for (let i = 0; i < 6; i++) {
      const x = -70 + i * 28 + range(this.rng, -6, 6);
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.08, 2.4, 5),
        this.mat(0xd8d8d8),
      );
      pole.position.set(x, 1.2, 112 + range(this.rng, -4, 8));
      this.group.add(pole);
      const top = new THREE.Mesh(
        new THREE.ConeGeometry(2.2, 1, 8),
        this.mat(pick(this.rng, [0xe84a4a, 0x4a90e8, 0xf2c200, 0xffffff])),
      );
      top.position.set(pole.position.x, 2.8, pole.position.z);
      top.castShadow = !this.fxLow;
      this.group.add(top);
    }
  }

  buildMarina() {
    // Water basin east of the city, docks and three boats.
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 260),
      new THREE.MeshLambertMaterial({ color: COLORS.sea, transparent: true, opacity: 0.92 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(130, 0.02, 0);
    this.group.add(water);
    const dockMat = this.mat(0x7a6a4a);
    for (const z of [-60, -20, 20, 60]) {
      this.box(18, 0.4, 4, dockMat, 112, 0.3, z, 0);
    }
    this.box(4, 0.4, 220, dockMat, 102, 0.3, 0, 0);
    const hullColors = [0xe8e8e8, 0x2a4a6a, 0xc23b2e];
    for (let i = 0; i < 3; i++) {
      const z = [-44, 4, 44][i];
      const hull = this.box(5, 1.6, 12, this.mat(hullColors[i]), 120, 0.9, z, 0);
      hull.name = 'boat';
      this.box(3, 1.4, 5, this.mat(0xf2f2f2), 120, 2.2, z, 0);
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.09, 0.09, 7, 5),
        this.mat(0x888888),
      );
      mast.position.set(120, 5, z);
      this.group.add(mast);
    }
  }

  buildPalms() {
    const rng = this.rng;
    for (const c of WORLD.grid) {
      for (let t = -90; t <= 90; t += 30) {
        if (rng() < 0.6) this.palm(c + 7.5, t + range(rng, -4, 4));
        if (rng() < 0.6) this.palm(t + range(rng, -4, 4), c - 7.5);
      }
    }
  }

  buildStreetProps() {
    const rng = this.rng;
    const poleMat = this.mat(0x3a3a3a);
    const lampMat = new THREE.MeshLambertMaterial({ color: 0xfff2c0, emissive: 0x443311 });
    for (const gx of WORLD.grid) {
      for (const gz of WORLD.grid) {
        if (rng() < 0.55) {
          const pole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.12, 0.16, 6, 6),
            poleMat,
          );
          pole.position.set(gx + 6.5, 3, gz + 6.5);
          this.group.add(pole);
          const head = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 0.5), lampMat);
          head.position.set(gx + 6.5, 6.1, gz + 6.5);
          this.group.add(head);
        }
        if (rng() < 0.5) {
          // Traffic light on one corner of the intersection.
          const pole = new THREE.Mesh(
            new THREE.CylinderGeometry(0.14, 0.18, 4.5, 6),
            poleMat,
          );
          pole.position.set(gx - 6.5, 2.25, gz - 6.5);
          this.group.add(pole);
          const box = this.box(0.7, 1.8, 0.7, this.mat(0x222222), gx - 6.5, 4.9, gz - 6.5, 0);
          box.castShadow = false;
          for (let i = 0; i < 3; i++) {
            const lamp = new THREE.Mesh(
              new THREE.SphereGeometry(0.22, 8, 6),
              new THREE.MeshLambertMaterial({
                color: i === 0 ? 0xff3b30 : i === 1 ? 0xffcc00 : 0x34c759,
                emissive: i === 0 ? 0x881111 : i === 1 ? 0x664400 : 0x0a4411,
              }),
            );
            lamp.position.set(gx - 6.5, 5.4 - i * 0.55, gz - 6.1);
            this.group.add(lamp);
          }
        }
      }
    }
  }

  // ---- collision / queries ----

  // Push a circle (x, z, radius) out of every building solid. Returns
  // the corrected position as [x, z].
  resolveSolids(x, z, r) {
    for (const s of this.solids) {
      if (x > s.minX - r && x < s.maxX + r && z > s.minZ - r && z < s.maxZ + r) {
        const dxl = x - (s.minX - r);
        const dxr = s.maxX + r - x;
        const dzl = z - (s.minZ - r);
        const dzr = s.maxZ + r - z;
        const m = Math.min(dxl, dxr, dzl, dzr);
        if (m === dxl) x = s.minX - r;
        else if (m === dxr) x = s.maxX + r;
        else if (m === dzl) z = s.minZ - r;
        else z = s.maxZ + r;
      }
    }
    return [x, z];
  }

  // Nearest point on any street centerline to (x, z).
  nearestRoadPoint(x, z) {
    let best = null;
    let bestD = Infinity;
    for (const c of WORLD.grid) {
      const d1 = Math.abs(x - c);
      if (d1 < bestD) {
        bestD = d1;
        best = { x: c, z, horizontal: false };
      }
      const d2 = Math.abs(z - c);
      if (d2 < bestD) {
        bestD = d2;
        best = { x, z: c, horizontal: true };
      }
    }
    return best;
  }

  // True when (x, z) is on asphalt (within a road's width).
  onRoad(x, z) {
    for (const c of WORLD.grid) {
      if (Math.abs(x - c) < WORLD.roadWidth / 2 + 0.5) return true;
      if (Math.abs(z - c) < WORLD.roadWidth / 2 + 0.5) return true;
    }
    return false;
  }
}
