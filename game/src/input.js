// Keyboard and mouse input. Tracks held keys, edge-triggered presses, and the
// mouse drag used to orbit the camera. Also exposes a tiny scripted-input
// helper so the ?shot= scenes and the play-test can drive the game.

export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set(); // keys pressed since last poll (edge triggered)
    this.mouseDown = false;
    this.mouseDX = 0; // accumulated drag delta since last poll
    this.mouseDY = 0;
    this.mouseX = 0;
    this.mouseY = 0;
    this.scripted = null; // { keys:Set, mouseDX, mouseDY } when a scene drives input
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
    };
    this._onKeyUp = (e) => this.keys.delete(e.code);
    this._onMouseDown = (e) => {
      this.mouseDown = true;
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    };
    this._onMouseMove = (e) => {
      if (!this.mouseDown) return;
      this.mouseDX += e.clientX - this.mouseX;
      this.mouseDY += e.clientY - this.mouseY;
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    };
    this._onMouseUp = () => {
      this.mouseDown = false;
    };
    this._onBlur = () => {
      this.keys.clear();
      this.mouseDown = false;
    };
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mousemove', this._onMouseMove);
    window.addEventListener('mouseup', this._onMouseUp);
    window.addEventListener('blur', this._onBlur);
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mousemove', this._onMouseMove);
    window.removeEventListener('mouseup', this._onMouseUp);
    window.removeEventListener('blur', this._onBlur);
  }

  /** Held right now (scripted input wins while a scene drives it). */
  down(code) {
    if (this.scripted) return this.scripted.keys.has(code);
    return this.keys.has(code);
  }

  /** True once for the frame the key went down. */
  wasPressed(code) {
    if (this.scripted) return this.scripted.pressed.has(code);
    return this.pressed.has(code);
  }

  /** Drag delta since last poll, then clears it. */
  drag() {
    if (this.scripted) {
      const d = { dx: this.scripted.mouseDX, dy: this.scripted.mouseDY };
      this.scripted.mouseDX = 0;
      this.scripted.mouseDY = 0;
      return d;
    }
    const d = { dx: this.mouseDX, dy: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return d;
  }

  /** Call once per frame after the game has read input. */
  endFrame() {
    this.pressed.clear();
    if (this.scripted) this.scripted.pressed.clear();
  }

  /** Hand control to a scripted driver (a ?shot= scene or the play-test). */
  setScripted(driver) {
    this.scripted = driver;
  }

  clearScripted() {
    this.scripted = null;
  }
}

/** A minimal scripted driver: hold keys, inject edge presses and drags. */
export function makeScriptedDriver() {
  return {
    keys: new Set(),
    pressed: new Set(),
    mouseDX: 0,
    mouseDY: 0,
    hold(code) {
      this.keys.add(code);
    },
    release(code) {
      this.keys.delete(code);
    },
    tap(code) {
      this.keys.add(code);
      this.pressed.add(code);
    },
    drag(dx, dy) {
      this.mouseDX += dx;
      this.mouseDY += dy;
    },
  };
}
