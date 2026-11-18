// Solmar Bay: the 3D city. A 5x5 street grid with downtown towers, a beach on
// the east edge and a marina on the south edge. Built once from a seed so the
// same seed always makes the same city. Exports the colliders (building AABBs)
// and the named places the missions use.

import * as THREE from 'three';
import { WORLD, COLORS } from './config.js';
import { Rng } from './random.js';

function box(w, h, d, color, x, y, z) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }),
  );
  m.position.set(x, y, z);
  return m;
}

export class City {
  constructor(seed = 1) {
    this.rng = new Rng(seed);
    this.group = new THREE.Group();
    this.colliders = []; // {minX,maxX,minZ,maxZ}
    this.places = {};
    this._buildGround();
    this._buildRoads();
    this._buildBlocks();
    this._buildBeach();
    this._buildMarina();
    this._buildPalms();
    this._buildLights();
    this._markPlaces();
  }

  _buildGround() {
    const g = new THREE.Mesh(
      new THREE.PlaneGeometry(560, 560),
      new THREE.MeshLambertMaterial({ color: COLORS.grass }),
    );
    g.rotation.x = -Math.PI / 2;
    g.position.y = -0.05;
    this.group.add(g);
  }

  _buildRoads() {
    const mat = new THREE.MeshLambertMaterial({ color: COLORS.asphalt });
    const lineMat = new THREE.MeshLambertMaterial({ color: COLORS.asphaltLine });
    const walkMat = new THREE.MeshLambertMaterial({ color: COLORS.sidewalk });
    const span = WORLD.half * 2 + WORLD.roadWidth;
    for (const s of WORLD.streets) {
      // Road along X and along Z.
      const rx = new THREE.Mesh(new THREE.PlaneGeometry(span, WORLD.roadWidth), mat);
      rx.rotation.x = -Math.PI / 2;
      rx.position.set(0, 0.01, s);
      this.group.add(rx);
      const rz = new THREE.Mesh(new THREE.PlaneGeometry(WORLD.roadWidth, span), mat);
      rz.rotation.x = -Math.PI / 2;
      rz.position.set(s, 0.01, 0);
      this.group.add(rz);
      // Dashed centre lines.
      for (let t = -WORLD.half; t < WORLD.half; t += 12) {
        const lx = new THREE.Mesh(new THREE.PlaneGeometry(5, 0.5), lineMat);
        lx.rotation.x = -Math.PI / 2;
        lx.position.set(t + 2.5, 0.02, s);
        this.group.add(lx);
        const lz = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 5), lineMat);
        lz.rotation.x = -Math.PI / 2;
        lz.position.set(s, 0.02, t + 2.5);
        this.group.add(lz);
      }
      // Sidewalks flanking each road.
      for (const off of [-WORLD.roadWidth / 2 - 2, WORLD.roadWidth / 2 + 2]) {
        const sx = new THREE.Mesh(new THREE.PlaneGeometry(span, 4), walkMat);
        sx.rotation.x = -Math.PI / 2;
        sx.position.set(0, 0.015, s + off);
        this.group.add(sx);
        const sz = new THREE.Mesh(new THREE.PlaneGeometry(4, span), walkMat);
        sz.rotation.x = -Math.PI / 2;
        sz.position.set(s + off, 0.015, 0);
        this.group.add(sz);
      }
    }
  }

  _buildBlocks() {
    const rng = this.rng;
    const pitch = WORLD.block + WORLD.roadWidth; // 52
    // Block centres sit between streets.
    for (let ix = 0; ix < 4; ix++) {
      for (let iz = 0; iz < 4; iz++) {
        const cx = -104 + pitch / 2 + ix * pitch;
        const cz = -104 + pitch / 2 + iz * pitch;
        const downtown = Math.abs(cx) <= 26 && Math.abs(cz) <= 26;
        const count = downtown ? rng.int(1, 2) : rng.int(2, 4);
        for (let b = 0; b < count; b++) {
          const w = downtown ? rng.range(16, 24) : rng.range(10, 18);
          const d = downtown ? rng.range(16, 24) : rng.range(10, 18);
          const h = downtown ? rng.range(28, 64) : rng.range(6, 16);
          const ox = rng.range(-8, 8);
          const oz = rng.range(-8, 8);
          const x = cx + ox;
          const z = cz + oz;
          const color = rng.pick(COLORS.building);
          const mesh = box(w, h, d, color, x, h / 2, z);
          this.group.add(mesh);
          // Glass crown on towers.
          if (downtown && h > 40) {
            const crown = box(w * 0.55, 3, d * 0.55, COLORS.glass, x, h + 1.5, z);
            this.group.add(crown);
          }
          // Rooftop box on houses.
          if (!downtown && rng.chance(0.5)) {
            const roof = box(w * 0.4, 2, d * 0.4, 0x5a5148, x, h + 1, z);
            this.group.add(roof);
          }
          this.colliders.push({
            minX: x - w / 2, maxX: x + w / 2,
            minZ: z - d / 2, maxZ: z + d / 2,
          });
        }
      }
    }
  }

  _buildBeach() {
    const sand = new THREE.Mesh(
      new THREE.PlaneGeometry(60, 300),
      new THREE.MeshLambertMaterial({ color: COLORS.sand }),
    );
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(WORLD.beachX + 18, 0.01, 0);
    this.group.add(sand);
    const sea = new THREE.Mesh(
      new THREE.PlaneGeometry(140, 560),
      new THREE.MeshLambertMaterial({ color: COLORS.water, transparent: true, opacity: 0.85 }),
    );
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(WORLD.waterX + 60, 0.02, 0);
    this.group.add(sea);
    // Boardwalk along the sand.
    const walk = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 280),
      new THREE.MeshLambertMaterial({ color: 0x8a6a4a }),
    );
    walk.rotation.x = -Math.PI / 2;
    walk.position.set(WORLD.beachX + 2, 0.02, 0);
    this.group.add(walk);
  }

  _buildMarina() {
    const water = new THREE.Mesh(
      new THREE.PlaneGeometry(560, 140),
      new THREE.MeshLambertMaterial({ color: COLORS.water, transparent: true, opacity: 0.85 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.02, WORLD.waterZ + 60);
    this.group.add(water);
    // Three docks reaching into the harbour.
    for (const dx of [-60, 0, 60]) {
      const dock = box(6, 1, 34, 0x8a6a4a, dx, 0.5, WORLD.marinaZ + 16);
      this.group.add(dock);
      // A moored boat at the end of each dock.
      const hull = box(5, 2, 12, 0xe8e8e8, dx, 0.6, WORLD.marinaZ + 36);
      this.group.add(hull);
      const cabin = box(3, 2, 5, 0x3a6a9a, dx, 2.4, WORLD.marinaZ + 34);
      this.group.add(cabin);
    }
  }

  _buildPalms() {
    const rng = this.rng;
    const trunkMat = new THREE.MeshLambertMaterial({ color: COLORS.trunk });
    const leafMat = new THREE.MeshLambertMaterial({ color: COLORS.palm });
    const spots = [];
    for (let i = 0; i < 46; i++) {
      const alongBeach = rng.chance(0.5);
      let x;
      let z;
      if (alongBeach) {
        x = rng.range(WORLD.beachX + 6, WORLD.beachX + 26);
        z = rng.range(-120, 120);
      } else {
        x = rng.range(-120, 120);
        z = rng.range(-120, 120);
        // Keep palms off the roads.
        if (WORLD.streets.some((s) => Math.abs(x - s) < 9 || Math.abs(z - s) < 9)) continue;
      }
      spots.push([x, z]);
    }
    for (const [x, z] of spots) {
      const h = rng.range(5, 8);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, h, 6), trunkMat);
      trunk.position.set(x, h / 2, z);
      trunk.rotation.z = rng.range(-0.08, 0.08);
      this.group.add(trunk);
      for (let l = 0; l < 5; l++) {
        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.9, 3.2, 4), leafMat);
        const a = (l / 5) * Math.PI * 2;
        leaf.position.set(x + Math.cos(a) * 1.1, h + 0.6, z + Math.sin(a) * 1.1);
        leaf.rotation.set(Math.sin(a) * 0.9, 0, Math.cos(a) * 0.9 + 0.5);
        this.group.add(leaf);
      }
    }
  }

  _buildLights() {
    const poleMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
    const lampMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0x554411 });
    for (const s of WORLD.streets) {
      for (const t of [-78, -26, 26, 78]) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 7, 6), poleMat);
        pole.position.set(t, 3.5, s + WORLD.roadWidth / 2 + 1);
        this.group.add(pole);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), lampMat);
        lamp.position.set(t, 7.1, s + WORLD.roadWidth / 2 + 1);
        this.group.add(lamp);
      }
    }
  }

  _markPlaces() {
    // Named spots the missions and the spawn logic use.
    this.places = {
      garage: { x: -52, z: -104, label: 'Ada\u2019s Garage' },
      hotel: { x: 104, z: -52, label: 'Hotel Solmar' },
      pier: { x: 130, z: 52, label: 'Pier' },
      hideout: { x: -104, z: 104, label: 'Hideout' },
      marina: { x: 52, z: 130, label: 'Marina Pickup' },
      hospital: { x: -104, z: -104, label: 'Hospital' },
      spawn: { x: 0, z: 0, label: 'Downtown' },
    };
    // A visible marker post at each place (a small coloured pillar).
    for (const [key, p] of Object.entries(this.places)) {
      if (key === 'spawn') continue;
      const post = new THREE.Mesh(
        new THREE.CylinderGeometry(0.5, 0.7, 6, 8),
        new THREE.MeshLambertMaterial({ color: 0xffc837, emissive: 0x332200 }),
      );
      post.position.set(p.x, 3, p.z);
      this.group.add(post);
    }
  }

  /** True when the circle (x, z, r) overlaps any building. */
  hitsBuilding(x, z, r) {
    for (const c of this.colliders) {
      const cx = Math.max(c.minX, Math.min(x, c.maxX));
      const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
      const dx = x - cx;
      const dz = z - cz;
      if (dx * dx + dz * dz < r * r) return c;
    }
    return null;
  }

  /** Push a circle out of buildings; returns true when a push happened. */
  resolveCircle(pos, r) {
    const c = this.hitsBuilding(pos.x, pos.z, r);
    if (!c) return false;
    const cx = Math.max(c.minX, Math.min(pos.x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(pos.z, c.maxZ));
    let dx = pos.x - cx;
    let dz = pos.z - cz;
    let d = Math.sqrt(dx * dx + dz * dz);
    if (d < 0.001) {
      // Centre inside the box: push out along the smallest penetration axis.
      const left = pos.x - c.minX;
      const right = c.maxX - pos.x;
      const top = pos.z - c.minZ;
      const bottom = c.maxZ - pos.z;
      const m = Math.min(left, right, top, bottom);
      if (m === left) pos.x = c.minX - r;
      else if (m === right) pos.x = c.maxX + r;
      else if (m === top) pos.z = c.minZ - r;
      else pos.z = c.maxZ + r;
      return true;
    }
    dx /= d;
    dz /= d;
    pos.x = cx + dx * r;
    pos.z = cz + dz * r;
    return true;
  }

  /** Clamp a position into the playable area (city + beach + marina). */
  clampToWorld(pos) {
    pos.x = Math.max(-140, Math.min(200, pos.x));
    pos.z = Math.max(-140, Math.min(200, pos.z));
  }
}
