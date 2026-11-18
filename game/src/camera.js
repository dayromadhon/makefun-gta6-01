// SOLMAR HEAT — third-person camera. It follows the player (on foot or in
// a car) from behind, smoothing its position and looking slightly ahead.

import * as THREE from 'three';

export class CameraRig {
  constructor(camera) {
    this.camera = camera;
    this.pos = new THREE.Vector3(0, 12, 18);
    this.look = new THREE.Vector3(0, 1, 0);
    this.shake = 0;
  }
  addShake(amount) {
    this.shake = Math.min(1.2, this.shake + amount);
  }
  update(dt, player) {
    const pp = player.pos;
    const heading = player.inCar ? player.car.heading : player.heading;
    const speed = player.speed;
    // Distance and height grow with speed.
    const dist = player.inCar ? 13 + speed * 0.14 : 9;
    const height = player.inCar ? 5.5 + speed * 0.05 : 4.5;
    const back = new THREE.Vector3(
      pp.x - Math.cos(heading) * dist,
      height,
      pp.z - Math.sin(heading) * dist,
    );
    // On foot the camera sits behind the facing direction; keep it simple
    // and stable by easing toward the target.
    const k = 1 - Math.exp(-dt * 5);
    this.pos.lerp(back, k);
    const lookTarget = new THREE.Vector3(
      pp.x + Math.cos(heading) * 4,
      1.2,
      pp.z + Math.sin(heading) * 4,
    );
    this.look.lerp(lookTarget, 1 - Math.exp(-dt * 8));
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const sh = this.shake * this.shake;
    const ox = (Math.random() - 0.5) * sh * 0.9;
    const oy = (Math.random() - 0.5) * sh * 0.6;
    const oz = (Math.random() - 0.5) * sh * 0.9;
    this.camera.position.set(this.pos.x + ox, this.pos.y + oy, this.pos.z + oz);
    this.camera.lookAt(this.look.x + ox, this.look.y + oy, this.look.z + oz);
  }
}
