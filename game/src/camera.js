// SOLMAR HEAT — camera.js
// One job: the third-person camera. It follows behind the player or the car,
// the mouse drag orbits it, and hits and explosions shake it. The camera
// heading is the movement basis, so it is kept in one place.

import * as THREE from 'three';
import { CONFIG } from './config.js';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.yaw = 0; // camera heading, radians (0 = looking toward +Z)
    this.pitch = 0.32;
    this.shake = 0;
    this._smoothPos = new THREE.Vector3(0, 10, -14);
  }

  addShake(amount) {
    this.shake = Math.min(1.2, this.shake + amount);
  }

  // Mouse drag orbits the camera around the player.
  orbit(dx, dy) {
    this.yaw -= dx * 0.005;
    this.pitch = Math.max(0.08, Math.min(1.1, this.pitch + dy * 0.003));
  }

  // Follow target {x, z, heading, inCar, speed}. The camera sits behind the
  // target's heading when driving, and behind the camera yaw on foot.
  update(dt, target) {
    const dist = CONFIG.camDistance + (target.inCar ? 2 : 0);
    const height = CONFIG.camHeight;
    // On foot the camera yaw is free (mouse orbit); in a car it eases toward
    // the car's heading so driving feels right.
    if (target.inCar) {
      let diff = target.heading - this.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.yaw += diff * Math.min(1, dt * 2.2);
    }
    const cx = target.x - Math.sin(this.yaw) * dist * Math.cos(this.pitch);
    const cz = target.z - Math.cos(this.yaw) * dist * Math.cos(this.pitch);
    const cy = height + Math.sin(this.pitch) * dist * 0.4;
    const k = 1 - Math.pow(0.0001, dt); // frame-rate independent smoothing
    this._smoothPos.x += (cx - this._smoothPos.x) * k;
    this._smoothPos.y += (cy - this._smoothPos.y) * k;
    this._smoothPos.z += (cz - this._smoothPos.z) * k;
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const sx = (Math.random() - 0.5) * this.shake * 0.9;
    const sy = (Math.random() - 0.5) * this.shake * 0.7;
    this.camera.position.set(this._smoothPos.x + sx, this._smoothPos.y + sy, this._smoothPos.z);
    this.camera.lookAt(target.x, CONFIG.camLookHeight, target.z);
  }

  // Snap the camera behind a target at once (spawns, mission starts, shots).
  snap(target) {
    const dist = CONFIG.camDistance;
    this.yaw = target.heading;
    this._smoothPos.set(
      target.x - Math.sin(this.yaw) * dist,
      CONFIG.camHeight,
      target.z - Math.cos(this.yaw) * dist,
    );
    this.camera.position.copy(this._smoothPos);
    this.camera.lookAt(target.x, CONFIG.camLookHeight, target.z);
  }
}
