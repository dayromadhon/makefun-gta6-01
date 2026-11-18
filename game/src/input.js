// input.js — keyboard + mouse state with edge detection (pressed this frame).
export class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseX = 0;
    this.mouseY = 0;
    this.mouseDown = false;
    this.mousePressed = false;
    this.anyKey = false;
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
      if (!e.repeat) {
        this.pressed.add(e.key.toLowerCase());
        this.anyKey = true;
      }
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.key.toLowerCase());
    });
    window.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });
    window.addEventListener('mousedown', (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
        // Only a click on the game canvas fires the pistol: clicks on HUD
        // buttons (New Game, GO, Continue) must not shoot.
        this.mousePressed = !!(e.target && e.target.id === 'game-canvas');
      }
    });
    window.addEventListener('mouseup', (e) => {
      if (e.button === 0) this.mouseDown = false;
    });
    window.addEventListener('blur', () => {
      this.keys.clear();
      this.mouseDown = false;
    });
  }
  down(key) {
    return this.keys.has(key.toLowerCase());
  }
  wasPressed(key) {
    return this.pressed.has(key.toLowerCase());
  }
  // Call at the end of each frame so edges last exactly one frame.
  endFrame() {
    this.pressed.clear();
    this.mousePressed = false;
    this.anyKey = false;
  }
  // Driving / walking axes: -1..1.
  moveX() {
    let x = 0;
    if (this.down('a') || this.down('arrowleft')) x -= 1;
    if (this.down('d') || this.down('arrowright')) x += 1;
    return x;
  }
  moveY() {
    let y = 0;
    if (this.down('w') || this.down('arrowup')) y += 1;
    if (this.down('s') || this.down('arrowdown')) y -= 1;
    return y;
  }
}
