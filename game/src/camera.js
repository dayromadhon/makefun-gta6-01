// camera.js — third-person follow camera with screen shake.
export class CameraRig {
  constructor(scene) {
    this.camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 900);
    this.heading = 0;
    this.shakeAmt = 0;
    this.shakeTime = 0;
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
    });
  }

  shake(amount) {
    this.shakeAmt = Math.max(this.shakeAmt, amount);
    this.shakeTime = 0.4;
  }

  update(dt, target, targetHeading, driving) {
    // Ease the camera heading toward the target's heading.
    let dh = targetHeading - this.heading;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    this.heading += dh * Math.min(1, dt * (driving ? 2.2 : 3.2));
    const dist = driving ? 13.5 : 9.5;
    const height = driving ? 6.2 : 4.6;
    const cx = target.x - Math.sin(this.heading) * dist;
    const cz = target.z - Math.cos(this.heading) * dist;
    let sx = 0;
    let sy = 0;
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      sx = (Math.random() - 0.5) * this.shakeAmt;
      sy = (Math.random() - 0.5) * this.shakeAmt;
      if (this.shakeTime <= 0) this.shakeAmt = 0;
    }
    this.camera.position.set(cx + sx, height + sy, cz);
    this.camera.lookAt(target.x + Math.sin(this.heading) * 4, 1.6, target.z + Math.cos(this.heading) * 4);
  }

  // Frame a fixed viewpoint for screenshots.
  setPose(x, y, z, lookX, lookY, lookZ) {
    this.camera.position.set(x, y, z);
    this.camera.lookAt(lookX, lookY, lookZ);
    this.heading = Math.atan2(lookX - x, lookZ - z);
  }
}
