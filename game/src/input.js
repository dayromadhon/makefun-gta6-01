// Solmar Heat — keyboard and mouse input. One job: turn raw DOM events
// into a clean per-frame input state the player and camera read.
export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.pressed = new Set(); // keys pressed since last frame (edge-triggered)
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.mouseDown = false;
    this.dragging = false;
    this.clickX = 0;
    this.clickY = 0;
    this.clicked = false; // left mouse button clicked since last frame
    this.wheel = 0;
    this.canvas = canvas;

    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this.pressed.add(e.code);
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
        e.preventDefault();
      }
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
    });
    canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        this.clicked = true;
        this.clickX = e.clientX;
        this.clickY = e.clientY;
      }
      if (e.button === 2) this.dragging = true;
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
      if (e.button === 2) this.dragging = false;
    });
    window.addEventListener('mousemove', (e) => {
      if (this.dragging) {
        this.mouseDX += e.movementX || 0;
        this.mouseDY += e.movementY || 0;
      }
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => {
      this.wheel += e.deltaY;
      e.preventDefault();
    }, { passive: false });
  }

  down(code) {
    return this.keys.has(code);
  }

  // True once, on the frame the key went down.
  hit(code) {
    return this.pressed.has(code);
  }

  // Steering: -1 (left) .. +1 (right), from A/D or arrow keys.
  steer() {
    let s = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) s -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) s += 1;
    return s;
  }

  throttle() {
    let t = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) t += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) t -= 1;
    return t;
  }

  // Call at the end of each frame to clear edge-triggered state.
  endFrame() {
    this.pressed.clear();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.clicked = false;
    this.wheel = 0;
  }
}
