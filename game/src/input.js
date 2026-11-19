// SOLMAR HEAT — input: keyboard + mouse state with per-frame edge detection.
export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseClicked = false;
    this.anyKey = false;
    this.onFirstGesture = null;
    this._gestureFired = false;
  }

  attach() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (!this.down.has(e.code)) this.pressed.add(e.code);
      this.down.add(e.code);
      this.anyKey = true;
      this._gesture();
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.down.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.down.clear();
    });
    window.addEventListener('mousedown', (e) => {
      this.mouseClicked = true;
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
      this._gesture();
    });
    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
  }

  _gesture() {
    if (!this._gestureFired) {
      this._gestureFired = true;
      if (this.onFirstGesture) this.onFirstGesture();
    }
  }

  isDown(code) {
    return this.down.has(code);
  }

  // True only on the frame the key went down.
  wasPressed(code) {
    return this.pressed.has(code);
  }

  // WASD / arrows as a -1..1 steering + throttle pair.
  axes() {
    let steer = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) steer -= 1;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) steer += 1;
    let throttle = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) throttle += 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) throttle -= 1;
    return { steer, throttle };
  }

  // Call at the end of each frame so edges only fire once.
  endFrame() {
    this.pressed.clear();
    this.mouseClicked = false;
  }
}
