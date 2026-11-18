// vehicles.js — cars: factory, traffic AI, parked cars, police cars.
import { CONFIG, PALETTE } from './config.js';

export function makeCarMesh(color, kind = 'sedan') {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color });
  const glassMat = new THREE.MeshLambertMaterial({ color: 0x1a2a3a });
  const wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  const isVan = kind === 'van';
  const len = isVan ? 5.6 : 4.2;
  const body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.9, len), bodyMat);
  body.position.y = 0.75;
  body.castShadow = true;
  g.add(body);
  const cabin = new THREE.Mesh(
    new THREE.BoxGeometry(1.7, isVan ? 1.1 : 0.7, isVan ? 3.4 : 2.0),
    isVan ? bodyMat : glassMat
  );
  cabin.position.set(0, isVan ? 1.7 : 1.45, isVan ? -0.4 : -0.2);
  cabin.castShadow = true;
  g.add(cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.35, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  for (const [wx, wz] of [[-0.95, 1.4], [0.95, 1.4], [-0.95, -1.4], [0.95, -1.4]]) {
    const w = new THREE.Mesh(wheelGeo, wheelMat);
    w.position.set(wx, 0.42, wz * (len / 4.2));
    g.add(w);
  }
  // Headlights + taillights.
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2b0 });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xcc2222 });
  for (const hx of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), headMat);
    h.position.set(hx, 0.8, len / 2 + 0.02);
    g.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.2, 0.1), tailMat);
    t.position.set(hx, 0.8, -len / 2 - 0.02);
    g.add(t);
  }
  if (kind === 'taxi') {
    const sign = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.25, 0.4), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    sign.position.set(0, 1.95, -0.2);
    g.add(sign);
  }
  if (kind === 'police') {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.22, 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    bar.position.set(0, 1.95, -0.2);
    g.add(bar);
    g.userData.lightBar = bar;
  }
  g.userData.kind = kind;
  g.userData.len = len;
  return g;
}

export class Vehicles {
  constructor(scene, city, rng) {
    this.scene = scene;
    this.city = city;
    this.rng = rng;
    this.traffic = [];
    this.parked = [];
    this.policeCars = [];
    this.buildTraffic();
    this.buildParked();
  }

  randomStreetPoint() {
    const s = this.rng.pick(CONFIG.streets);
    const along = this.rng.range(-140, 140);
    return this.rng.chance(0.5) ? { x: s, z: along } : { x: along, z: s };
  }

  // Next intersection waypoint for a traffic car.
  nextWaypoint(car) {
    const streets = CONFIG.streets;
    const near = streets.map((s) => Math.abs(car.mesh.position.x - s)).concat(streets.map((s) => Math.abs(car.mesh.position.z - s)));
    const ix = streets[Math.floor(this.rng.next() * streets.length)];
    const iz = streets[Math.floor(this.rng.next() * streets.length)];
    // Drive to a neighbouring intersection: pick one axis to change.
    const cur = car.mesh.position;
    if (this.rng.chance(0.5)) return { x: ix, z: Math.round(cur.z / 60) * 60 };
    return { x: Math.round(cur.x / 60) * 60, z: iz };
  }

  buildTraffic() {
    for (let i = 0; i < 14; i++) {
      const kind = this.rng.chance(0.18) ? 'taxi' : 'sedan';
      const color = kind === 'taxi' ? PALETTE.taxi : this.rng.pick(PALETTE.cars);
      const mesh = makeCarMesh(color, kind);
      const p = this.randomStreetPoint();
      mesh.position.set(p.x, 0, p.z);
      mesh.rotation.y = this.rng.pick([0, Math.PI / 2, Math.PI, -Math.PI / 2]);
      this.scene.add(mesh);
      const car = { mesh, kind, speed: kind === 'taxi' ? CONFIG.taxiSpeed : CONFIG.trafficSpeed, target: null, stolen: false, isTraffic: true };
      car.target = this.nextWaypoint(car);
      this.traffic.push(car);
    }
  }

  buildParked() {
    // Parked cars along curbs, deterministic from the seed.
    // First car: Ada lined one up for Leo — parked on the north curb of
    // the z=-30 road, a short walk west of the spawn (0,-30), so Mission 1
    // starts on an open road with no building between player and car.
    const first = makeCarMesh(this.rng.pick(PALETTE.cars), 'sedan');
    first.position.set(-20, 0, -23.5);
    first.rotation.y = Math.PI / 2;
    this.scene.add(first);
    this.parked.push({ mesh: first, kind: 'sedan', speed: 0, stolen: false, isParked: true, heading: Math.PI / 2 });
    for (let i = 0; i < 9; i++) {
      const color = this.rng.pick(PALETTE.cars);
      const mesh = makeCarMesh(color, 'sedan');
      const street = this.rng.pick(CONFIG.streets);
      const along = this.rng.range(-130, 130);
      const side = this.rng.pick([-1, 1]);
      let x, z, heading;
      if (this.rng.chance(0.5)) {
        x = street + side * 6.5;
        z = along;
        heading = side > 0 ? Math.PI / 2 : -Math.PI / 2;
      } else {
        x = along;
        z = street + side * 6.5;
        heading = side > 0 ? 0 : Math.PI;
      }
      mesh.position.set(x, 0, z);
      mesh.rotation.y = heading;
      this.scene.add(mesh);
      this.parked.push({ mesh, kind: 'sedan', speed: 0, stolen: false, isParked: true, heading });
    }
  }

  spawnPoliceCar(x, z) {
    const mesh = makeCarMesh(PALETTE.police, 'police');
    mesh.position.set(x, 0, z);
    this.scene.add(mesh);
    const car = { mesh, kind: 'police', speed: 0, isPolice: true, heading: 0 };
    this.policeCars.push(car);
    return car;
  }

  removePoliceCar(car) {
    this.scene.remove(car.mesh);
    this.policeCars = this.policeCars.filter((c) => c !== car);
  }

  // All drivable cars (traffic + parked + police) for stealing / collision.
  allCars() {
    return [...this.traffic, ...this.parked, ...this.policeCars];
  }

  update(dt) {
    for (const car of this.traffic) {
      if (car.stolen) continue;
      const m = car.mesh;
      const t = car.target;
      const dx = t.x - m.position.x;
      const dz = t.z - m.position.z;
      const dist = Math.hypot(dx, dz);
      if (dist < 4) {
        car.target = this.nextWaypoint(car);
        continue;
      }
      const wantHeading = Math.atan2(dx, dz);
      let dh = wantHeading - m.rotation.y;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      m.rotation.y += Math.max(-2.2 * dt, Math.min(2.2 * dt, dh));
      // Slow down for the car ahead.
      let speed = car.speed;
      for (const other of this.traffic) {
        if (other === car || other.stolen) continue;
        const ox = other.mesh.position.x - m.position.x;
        const oz = other.mesh.position.z - m.position.z;
        const od = Math.hypot(ox, oz);
        if (od < 7 && od > 0.01) {
          const ahead = (ox * Math.sin(m.rotation.y) + oz * Math.cos(m.rotation.y)) / od;
          if (ahead > 0.7) speed = Math.min(speed, 3);
        }
      }
      m.position.x += Math.sin(m.rotation.y) * speed * dt;
      m.position.z += Math.cos(m.rotation.y) * speed * dt;
      // Keep inside the city.
      m.position.x = Math.max(-148, Math.min(148, m.position.x));
      m.position.z = Math.max(-148, Math.min(148, m.position.z));
    }
  }
}
