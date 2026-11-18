// city.js — builds Solmar Bay: 5x5 street grid, downtown towers, beach, marina.
import { CONFIG, PALETTE } from './config.js';

function windowTexture(base, lit) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = base;
  g.fillRect(0, 0, 128, 256);
  for (let y = 10; y < 246; y += 22) {
    for (let x = 10; x < 118; x += 22) {
      g.fillStyle = Math.random() < 0.25 ? lit : '#2a3a4a';
      g.fillRect(x, y, 14, 12);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class City {
  constructor(scene, rng, lowFx) {
    this.scene = scene;
    this.rng = rng;
    this.lowFx = lowFx;
    this.colliders = [];
    this.water = null;
    this.build();
  }

  addCollider(minX, maxX, minZ, maxZ) {
    this.colliders.push({ minX, maxX, minZ, maxZ });
  }

  // Circle (x,z,r) against every building AABB; true when blocked.
  blocked(x, z, r) {
    if (Math.abs(x) > 196 || Math.abs(z) > 196) return true;
    if (z > CONFIG.waterZ - 1) return true;
    if (x > CONFIG.dockX + 6) return true;
    for (const c of this.colliders) {
      const cx = Math.max(c.minX, Math.min(x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < r * r) return true;
    }
    return false;
  }

  // Push a circle out of colliders (returns corrected x,z).
  resolve(x, z, r) {
    for (const c of this.colliders) {
      const cx = Math.max(c.minX, Math.min(x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - cx;
      const dz = z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r && d2 > 0.0001) {
        const d = Math.sqrt(d2);
        x = cx + (dx / d) * r;
        z = cz + (dz / d) * r;
      }
    }
    x = Math.max(-194, Math.min(194, x));
    z = Math.max(-194, Math.min(194, z));
    if (z > CONFIG.waterZ - 1) z = CONFIG.waterZ - 1;
    if (x > CONFIG.dockX + 4) x = CONFIG.dockX + 4;
    return { x, z };
  }

  build() {
    const S = this.scene;
    const rng = this.rng;
    const { streets, blockSize, roadWidth, cityHalf } = CONFIG;

    // Ground.
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 420),
      new THREE.MeshLambertMaterial({ color: CONFIG.groundColor })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    S.add(ground);

    // Roads: dark strips along every street, both directions.
    const roadMat = new THREE.MeshLambertMaterial({ color: CONFIG.roadColor });
    const walkMat = new THREE.MeshLambertMaterial({ color: CONFIG.sidewalkColor });
    for (const s of streets) {
      const rx = new THREE.Mesh(new THREE.PlaneGeometry(cityHalf * 2 + roadWidth, roadWidth), roadMat);
      rx.rotation.x = -Math.PI / 2;
      rx.position.set(0, 0.02, s);
      rx.receiveShadow = true;
      S.add(rx);
      const rz = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth, cityHalf * 2 + roadWidth), roadMat);
      rz.rotation.x = -Math.PI / 2;
      rz.position.set(s, 0.02, 0);
      rz.receiveShadow = true;
      S.add(rz);
      // Sidewalk edging.
      const wx = new THREE.Mesh(new THREE.PlaneGeometry(cityHalf * 2 + roadWidth, 2.5), walkMat);
      wx.rotation.x = -Math.PI / 2;
      wx.position.set(0, 0.03, s + roadWidth / 2 + 1.2);
      S.add(wx);
      const wz = new THREE.Mesh(new THREE.PlaneGeometry(2.5, cityHalf * 2 + roadWidth), walkMat);
      wz.rotation.x = -Math.PI / 2;
      wz.position.set(s + roadWidth / 2 + 1.2, 0.03, 0);
      S.add(wz);
    }
    // Centre dashes.
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8d8d8 });
    for (const s of streets) {
      for (let d = -140; d <= 140; d += 16) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.5), dashMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(d, 0.04, s);
        S.add(dash);
        const dash2 = dash.clone();
        dash2.position.set(s, 0.04, d);
        dash2.rotation.z = Math.PI / 2;
        S.add(dash2);
      }
    }

    // Buildings: one per block, downtown towers in the middle.
    const towerTex = windowTexture('#5a6a7a', '#ffd98a');
    const houseTex = windowTexture('#c8b898', '#ffe9a8');
    const towerMat = new THREE.MeshLambertMaterial({ map: towerTex });
    const houseMat = new THREE.MeshLambertMaterial({ map: houseTex });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x4a4a4a });
    const blockCenters = [];
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        blockCenters.push({
          x: -120 + i * 60,
          z: -120 + j * 60,
          downtown: Math.abs(-120 + i * 60) <= 60 && Math.abs(-120 + j * 60) <= 60,
        });
      }
    }
    for (const b of blockCenters) {
      const downtown = b.downtown;
      const w = downtown ? rng.range(22, 30) : rng.range(18, 30);
      const d = downtown ? rng.range(22, 30) : rng.range(18, 30);
      const h = downtown ? rng.range(40, 90) : rng.range(8, 18);
      const mat = downtown ? towerMat : houseMat;
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(b.x, h / 2, b.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      S.add(mesh);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 1, 0.6, d + 1), roofMat);
      roof.position.set(b.x, h + 0.3, b.z);
      S.add(roof);
      this.addCollider(b.x - w / 2 - 0.5, b.x + w / 2 + 0.5, b.z - d / 2 - 0.5, b.z + d / 2 + 0.5);
      // A second small shop beside houses.
      if (!downtown && rng.chance(0.6)) {
        const sw = rng.range(8, 12);
        const sd = rng.range(8, 12);
        const sh = rng.range(4, 7);
        const sx = b.x + rng.range(-12, 12);
        const sz = b.z + rng.range(-12, 12);
        if (Math.abs(sx - b.x) > w / 2 + sw / 2 + 2 || Math.abs(sz - b.z) > d / 2 + sd / 2 + 2) {
          const shop = new THREE.Mesh(
            new THREE.BoxGeometry(sw, sh, sd),
            new THREE.MeshLambertMaterial({ color: rng.pick(PALETTE.buildings) })
          );
          shop.position.set(sx, sh / 2, sz);
          shop.castShadow = true;
          S.add(shop);
          this.addCollider(sx - sw / 2 - 0.5, sx + sw / 2 + 0.5, sz - sd / 2 - 0.5, sz + sd / 2 + 0.5);
        }
      }
    }

    // Beach: sand strip + water.
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 40),
      new THREE.MeshLambertMaterial({ color: CONFIG.sandColor })
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.05, CONFIG.beachZ + 8);
    sand.receiveShadow = true;
    S.add(sand);
    this.water = new THREE.Mesh(
      new THREE.PlaneGeometry(420, 60),
      new THREE.MeshLambertMaterial({ color: CONFIG.waterColor, transparent: true, opacity: 0.85 })
    );
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.set(0, 0.06, CONFIG.waterZ + 24);
    S.add(this.water);

    // Marina: wooden docks + boats on the east edge.
    const dockMat = new THREE.MeshLambertMaterial({ color: 0x8a6a3a });
    for (let i = 0; i < 3; i++) {
      const dock = new THREE.Mesh(new THREE.BoxGeometry(24, 0.8, 5), dockMat);
      dock.position.set(CONFIG.marinaX + 12, 0.4, -60 + i * 60);
      dock.castShadow = true;
      S.add(dock);
      const boat = new THREE.Group();
      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(10, 2, 4),
        new THREE.MeshLambertMaterial({ color: rng.pick([0xffffff, 0xdd3333, 0x3366cc]) })
      );
      hull.position.y = 0.6;
      boat.add(hull);
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 7), new THREE.MeshLambertMaterial({ color: 0x666666 }));
      mast.position.y = 4;
      boat.add(mast);
      boat.position.set(CONFIG.marinaX + 14, 0, -60 + i * 60 + 8);
      S.add(boat);
    }

    // Palms along the beach and the avenues.
    const palmCount = this.lowFx ? 24 : 60;
    const trunkMat = new THREE.MeshLambertMaterial({ color: PALETTE.trunk });
    const leafMat = new THREE.MeshLambertMaterial({ color: PALETTE.palms });
    for (let i = 0; i < palmCount; i++) {
      const px = rng.range(-150, 150);
      const pz = rng.chance(0.4) ? rng.range(CONFIG.beachZ - 4, CONFIG.beachZ + 10) : rng.pick(streets) + rng.pick([-9, 9]);
      const palm = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 7, 6), trunkMat);
      trunk.position.y = 3.5;
      trunk.rotation.z = rng.range(-0.08, 0.08);
      palm.add(trunk);
      for (let l = 0; l < 5; l++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(1.1, 3.4, 4), leafMat);
        leaf.position.y = 7.2;
        leaf.rotation.z = (l / 5) * Math.PI * 2;
        leaf.rotation.x = 0.9;
        leaf.position.x = Math.cos((l / 5) * Math.PI * 2) * 0.8;
        leaf.position.z = Math.sin((l / 5) * Math.PI * 2) * 0.8;
        palm.add(leaf);
      }
      palm.position.set(px, 0, pz);
      S.add(palm);
    }

    // Street lights at intersections.
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x333333 });
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    for (const sx of streets) {
      for (const sz of streets) {
        if ((sx + sz) % 120 !== 0) continue;
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 6, 6), poleMat);
        pole.position.set(sx + 8.5, 3, sz + 8.5);
        S.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
        lamp.position.set(sx + 8.5, 6.2, sz + 8.5);
        S.add(lamp);
      }
    }

    // Named places the missions use. Every one sits ON a road (or open
    // ground at the pier/marina), never inside a building footprint.
    this.places = {
      garage: { x: -120, z: -90, label: "Ada's Garage" },
      hotel: { x: 60, z: -90, label: 'Hotel Solmar' },
      pier: { x: 0, z: 164, label: 'Solmar Pier' },
      marina: { x: 164, z: 60, label: 'Marina Pickup' },
      hideout: { x: -120, z: 90, label: 'Hideout' },
      hospital: { x: -60, z: 90, label: 'Solmar General' },
      plaza: { x: 0, z: 30, label: 'Central Plaza' },
    };
  }

  update(dt, t) {
    if (this.water) this.water.position.y = 0.06 + Math.sin(t * 0.8) * 0.15;
  }
}
