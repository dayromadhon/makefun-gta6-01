// SOLMAR HEAT — input.js
// One job: read the keyboard and the mouse and hand the game a clean state.
// Keys are tracked by code (KeyW, ArrowUp, Space...). Mouse drag orbits the
// camera; a click on the game canvas (never on the HUD) is a shot/punch.

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered, consumed by the game each frame
    this.mouseDown = false;
    this.mouseClicked = false; // edge-triggered click on the canvas
    this.dragDX = 0;
    this.dragDY = 0;
    this._dragging = false;
    this._lastX = 0;
    this._lastY = 0;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseDown = (e) => {
      if (e.button !== 0) return;
      this.mouseDown = true;
      this.mouseClicked = true;
      this._dragging = true;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    };
    this._onMouseUp = () => {
      this.mouseDown = false;
      this._dragging = false;
    };
    this._onMouseMove = (e) => {
      if (!this._dragging) return;
      this.dragDX += e.clientX - this._lastX;
      this.dragDY += e.clientY - this._lastY;
      this._lastX = e.clientX;
      this._lastY = e.clientY;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.mouseDown = false;
      this._dragging = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('mousemove', this._onMouseMove);
  }

  isDown(code) {
    return this.keys.has(code);
  }

  // True once, on the frame the key went down. The game calls this per frame.
  wasPressed(code) {
    return this.pressed.has(code);
  }

  // Movement axes: -1..1. Forward is W/Up, strafe is A/D (D is always right,
  // on foot and in a car — the right vector is computed the same way in both).
  moveForward() {
    let f = 0;
    if (this.isDown('KeyW') || this.isDown('ArrowUp')) f += 1;
    if (this.isDown('KeyS') || this.isDown('ArrowDown')) f -= 1;
    return f;
  }

  moveStrafe() {
    let s = 0;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) s += 1;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) s -= 1;
    return s;
  }

  // Call at the end of every frame: clears edge triggers and drag deltas.
  endFrame() {
    this.pressed.clear();
    this.mouseClicked = false;
    this.dragDX = 0;
    this.dragDY = 0;
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('mousemove', this._onMouseMove);
  }
}
