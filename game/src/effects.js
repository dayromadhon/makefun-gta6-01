// SOLMAR HEAT — effects: pooled particle bursts, smoke puffs and the
// tracer line for gunshots, all drawn with THREE.Points and Line.
import * as THREE from 'three';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.bursts = [];
    this.tracers = [];
  }

  _makePoints(n, color) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const mat = new THREE.PointsMaterial({ color, size: 0.35, transparent: true, opacity: 1 });
    const points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    this.scene.add(points);
    return points;
  }

  burst(x, y, z, color, n = 12) {
    const points = this._makePoints(n, color);
    const pos = points.geometry.attributes.position.array;
    const vel = [];
    for (let i = 0; i < n; i++) {
      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2;
      const s = 3 + Math.random() * 6;
      vel.push([Math.cos(a) * s, 2 + Math.random() * 5, Math.sin(a) * s]);
    }
    this.bursts.push({ points, vel, life: 0.7, max: 0.7 });
  }

  tracer(from, to) {
    const geo = new THREE.BufferGeometry().setFromPoints([from, to]);
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xffe9a0, transparent: true, opacity: 0.9 }));
    this.scene.add(line);
    this.tracers.push({ line, life: 0.12 });
  }

  update(dt) {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      b.life -= dt;
      const pos = b.points.geometry.attributes.position.array;
      for (let j = 0; j < b.vel.length; j++) {
        pos[j * 3] += b.vel[j][0] * dt;
        pos[j * 3 + 1] += b.vel[j][1] * dt;
        pos[j * 3 + 2] += b.vel[j][2] * dt;
        b.vel[j][1] -= 12 * dt;
        if (pos[j * 3 + 1] < 0.05) pos[j * 3 + 1] = 0.05;
      }
      b.points.geometry.attributes.position.needsUpdate = true;
      b.points.material.opacity = Math.max(0, b.life / b.max);
      if (b.life <= 0) {
        this.scene.remove(b.points);
        b.points.geometry.dispose();
        b.points.material.dispose();
        this.bursts.splice(i, 1);
      }
    }
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.line.material.opacity = Math.max(0, t.life / 0.12);
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
        t.line.material.dispose();
        this.tracers.splice(i, 1);
      }
    }
  }
}
