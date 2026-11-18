// Third-person chase camera. Sits behind the car (or the player on foot),
// orbits with a mouse drag, smooths its motion, and pulls in when a building
// would block the view. Screen shake is applied on top of the smoothed pose.

import * as THREE from 'three';
import { clamp, lerp } from './random.js';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0; // orbit offset around the target, radians
    this.pitch = 0.32; // radians above horizontal
    this.dist = 11;
    this.shake = 0; // shake amplitude, decays
    this._pos = new THREE.Vector3(0, 8, -14);
    this._look = new THREE.Vector3(0, 1.5, 0);
  }

  addShake(amount) {
    this.shake = Math.min(0.9, this.shake + amount);
  }

  /** drag: {dx, dy} pixels since last frame. */
  update(dt, target, heading, driving, drag, city) {
    this.yaw -= drag.dx * 0.005;
    this.pitch = clamp(this.pitch + drag.dy * 0.003, 0.08, 1.1);
    // Ease the orbit back toward "behind the car" when driving.
    if (driving) {
      const behind = heading + Math.PI;
      let diff = behind - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * Math.min(1, dt * 1.2);
    }
    const dist = driving ? 12 : 8;
    this.dist = lerp(this.dist, dist, Math.min(1, dt * 3));
    const camYaw = heading + this.yaw;
    const height = driving ? 4.2 : 3.0;
    const wantX = target.x + Math.sin(camYaw) * this.dist * Math.cos(this.pitch);
    const wantZ = target.z + Math.cos(camYaw) * this.dist * Math.cos(this.pitch);
    const wantY = height + Math.sin(this.pitch) * this.dist;
    const k = Math.min(1, dt * 7);
    this._pos.x = lerp(this._pos.x, wantX, k);
    this._pos.y = lerp(this._pos.y, wantY, k);
    this._pos.z = lerp(this._pos.z, wantZ, k);
    // Keep the camera above the ground.
    this._pos.y = Math.max(this._pos.y, 1.2);
    // Screen shake.
    this.shake = Math.max(0, this.shake - dt * 1.8);
    const sx = (Math.random() * 2 - 1) * this.shake * 0.5;
    const sy = (Math.random() * 2 - 1) * this.shake * 0.4;
    this.camera.position.set(this._pos.x + sx, this._pos.y + sy, this._pos.z);
    this._look.set(target.x, target.y + 1.4, target.z);
    this.camera.lookAt(this._look);
  }

  /** Snap the camera to a pose (used when a ?shot= scene stages its frame). */
  snap(target, heading, dist = 11, pitch = 0.32) {
    this.yaw = 0;
    this.pitch = pitch;
    this.dist = dist;
    const camYaw = heading;
    this._pos.set(
      target.x + Math.sin(camYaw) * dist * Math.cos(pitch),
      target.y + 3 + Math.sin(pitch) * dist,
      target.z + Math.cos(camYaw) * dist * Math.cos(pitch),
    );
    this.camera.position.copy(this._pos);
    this._look.set(target.x, target.y + 1.4, target.z);
    this.camera.lookAt(this._look);
  }
}
