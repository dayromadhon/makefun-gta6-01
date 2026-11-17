// Solmar Heat — the chase camera. One job: a third-person camera that
// sits behind Leo on foot and behind the car while driving, with mouse
// orbit, wheel zoom and screen shake.
import { clamp, lerp, angleDiff } from './random.js';

export class CameraRig {
  constructor(camera, fxLow) {
    this.camera = camera;
    this.fxLow = fxLow;
    this.yaw = Math.PI; // orbit yaw; PI looks north (-z)
    this.pitch = 0.42;
    this.dist = 9;
    this.dragOffset = 0; // temporary yaw offset from mouse drag while driving
    this.shake = 0;
    this.pos = new THREE.Vector3(24, 8, 95);
  }

  addShake(amount) {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  update(dt, player, input) {
    // Mouse drag orbits the camera.
    if (input.mouseDX !== 0) {
      this.yaw -= input.mouseDX * 0.0042;
      if (player.inCar) this.dragOffset -= input.mouseDX * 0.0042;
    }
    if (input.mouseDY !== 0) {
      this.pitch = clamp(this.pitch + input.mouseDY * 0.002, 0.12, 1.0);
    }
    if (input.wheel !== 0) {
      this.dist = clamp(this.dist + input.wheel * 0.005, 5, 16);
    }
    const targetDist = player.inCar ? 10.5 : 7;
    this.dist = lerp(this.dist, targetDist, 1 - Math.exp(-2 * dt));
    // On foot the camera yaw IS the player's facing (mouse drag steers
    // Leo); while driving it eases back behind the car and the drag
    // offset decays.
    if (!player.inCar) {
      player.yaw = this.yaw;
      this.dragOffset = 0;
    } else {
      this.dragOffset *= Math.exp(-1.4 * dt);
      const want = player.heading + Math.PI + this.dragOffset;
      this.yaw += angleDiff(this.yaw, want) * (1 - Math.exp(-2.6 * dt));
    }
    const px = player.x;
    const pz = player.z;
    const eyeX = px + Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist;
    const eyeZ = pz + Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist;
    const eyeY = 1.6 + Math.sin(this.pitch) * this.dist + (player.inCar ? 1.2 : 0.4);
    const k = 1 - Math.exp(-14 * dt);
    this.pos.x += (eyeX - this.pos.x) * k;
    this.pos.y += (eyeY - this.pos.y) * k;
    this.pos.z += (eyeZ - this.pos.z) * k;
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const sh = this.fxLow ? 0 : this.shake;
    const sx = sh > 0 ? (Math.random() - 0.5) * sh * 0.5 : 0;
    const sy = sh > 0 ? (Math.random() - 0.5) * sh * 0.4 : 0;
    this.camera.position.set(this.pos.x + sx, this.pos.y + sy, this.pos.z);
    const lookX = px - Math.sin(this.yaw) * 4;
    const lookZ = pz - Math.cos(this.yaw) * 4;
    this.camera.lookAt(lookX, 1.6, lookZ);
  }

  // A slow orbit for the title screen backdrop.
  titleOrbit(dt, time) {
    const a = time * 0.05;
    const cx = Math.sin(a) * 55;
    const cz = Math.cos(a) * 55 - 10;
    this.camera.position.set(cx, 26, cz);
    this.camera.lookAt(0, 4, -10);
  }
}
