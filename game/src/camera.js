// The third-person chase camera: it trails behind Leo or his car, swings around with a
// mouse drag, zooms with the wheel, and eases back behind the direction of travel.

import * as THREE from 'three';
import { CAMERA } from './config.js';

export function createCamera(camera) {
  let yaw = 0;
  let pitch = 0.32;
  let distance = CAMERA.carDistance;
  let zoom = 0;
  let autoYaw = true;
  let position = new THREE.Vector3(0, 8, -12);

  function look(dx, dy, wheel) {
    yaw -= dx * 0.005;
    pitch += dy * 0.003;
    pitch = Math.max(CAMERA.minPitch, Math.min(CAMERA.maxPitch, pitch));
    if (wheel !== 0) {
      zoom = Math.max(-5, Math.min(7, zoom + wheel * 1.2));
    }
    if (dx !== 0 || dy !== 0) autoYaw = false;
  }

  function update(dt, focus, heading, inCar) {
    const wantDistance = (inCar ? CAMERA.carDistance : CAMERA.footDistance) + zoom;
    distance += (wantDistance - distance) * Math.min(1, dt * 4);
    const wantHeight = inCar ? CAMERA.carHeight : CAMERA.footHeight;
    if (autoYaw) {
      let diff = heading - yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      yaw += diff * Math.min(1, dt * (inCar ? 2.2 : 3.2));
    }
    const back = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    const desired = new THREE.Vector3(
      focus.x + back.x * distance,
      focus.y + wantHeight * (0.6 + pitch),
      focus.z + back.z * distance,
    );
    position.lerp(desired, Math.min(1, dt * CAMERA.smoothing));
    camera.position.copy(position);
    camera.lookAt(focus.x, focus.y + 1.4, focus.z);
  }

  function snap(focus, heading) {
    yaw = heading;
    autoYaw = true;
    const back = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
    position.set(focus.x + back.x * distance, focus.y + 4, focus.z + back.z * distance);
    camera.position.copy(position);
    camera.lookAt(focus.x, focus.y + 1.4, focus.z);
  }

  return {
    get yaw() {
      return yaw;
    },
    look,
    update,
    snap,
    recenter() {
      autoYaw = true;
    },
  };
}
