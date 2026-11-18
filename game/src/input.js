// SOLMAR HEAT — keyboard + mouse input. Keys are tracked by code so the
// layout is stable; the game reads axes, not raw keys, wherever it can.

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set(); // edge-triggered: cleared each frame by consume()
    this.mouseDown = false;
    this.mouseClicked = false;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseDown = () => {
      this.mouseDown = true;
      this.mouseClicked = true;
    };
    this._onMouseUp = () => {
      this.mouseDown = false;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.mouseDown = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('blur', this._onBlur);
  }

  down(code) {
    return this.keys.has(code);
  }
  // True only on the frame the key went down.
  hit(code) {
    return this.pressed.has(code);
  }
  // Driving / walking axes, -1..1.
  get throttle() {
    let v = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) v += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) v -= 1;
    return v;
  }
  get steer() {
    let v = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) v -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) v += 1;
    return v;
  }
  get run() {
    return this.down('ShiftLeft') || this.down('ShiftRight');
  }
  get handbrake() {
    return this.down('Space');
  }
  // Call once per frame after the game has read the edge state.
  consume() {
    this.pressed.clear();
    this.mouseClicked = false;
  }
  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('blur', this._onBlur);
  }
}
