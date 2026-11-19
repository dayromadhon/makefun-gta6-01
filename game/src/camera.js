// SOLMAR HEAT — camera: third-person follow with smoothing, a low chase
// view when driving, and trauma-based screen shake.
import * as THREE from 'three';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.trauma = 0;
    this.pos = new THREE.Vector3(0, 10, 50);
    this.look = new THREE.Vector3(0, 1, 0);
  }

  shake(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  update(dt, target, driving) {
    const heading = target.heading;
    const back = driving ? 11 : 7.5;
    const height = driving ? 4.6 : 3.6;
    const wantPos = new THREE.Vector3(
      target.x - Math.sin(heading) * back,
      height,
      target.z - Math.cos(heading) * back,
    );
    const k = 1 - Math.exp(-6 * dt);
    this.pos.lerp(wantPos, k);
    const wantLook = new THREE.Vector3(
      target.x + Math.sin(heading) * 6,
      1.4,
      target.z + Math.cos(heading) * 6,
    );
    this.look.lerp(wantLook, 1 - Math.exp(-8 * dt));
    this.trauma = Math.max(0, this.trauma - dt * 1.4);
    const sh = this.trauma * this.trauma;
    const t = performance.now() * 0.03;
    const ox = sh * 0.5 * Math.sin(t * 1.3);
    const oy = sh * 0.4 * Math.cos(t * 1.7);
    this.camera.position.set(this.pos.x + ox, this.pos.y + oy, this.pos.z);
    this.camera.lookAt(this.look.x + ox, this.look.y + oy, this.look.z);
  }

  // Instantly place the camera at the follow position (no lerp) — used
  // when a screenshot scene starts so the first frames are already framed.
  snap(target, driving) {
    const heading = target.heading;
    const back = driving ? 11 : 7.5;
    const height = driving ? 4.6 : 3.6;
    this.pos.set(
      target.x - Math.sin(heading) * back,
      height,
      target.z - Math.cos(heading) * back,
    );
    this.look.set(
      target.x + Math.sin(heading) * 6,
      1.4,
      target.z + Math.cos(heading) * 6,
    );
    this.camera.position.copy(this.pos);
    this.camera.lookAt(this.look);
  }

  // A fixed cinematic angle, used by the screenshot scenes.
  setFixed(x, y, z, lx, ly, lz) {
    this.pos.set(x, y, z);
    this.look.set(lx, ly, lz);
    this.camera.position.set(x, y, z);
    this.camera.lookAt(lx, ly, lz);
  }
}
