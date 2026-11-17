// Solmar Heat — keyboard and mouse state.
// One job: turn DOM events into a plain object the game reads every frame.

export function createInput(canvas) {
  const keys = new Set();
  const state = {
    keys,
    // one-shot actions: set true on the keydown, cleared by the game after
    // it has consumed them exactly once (so a press never fires twice).
    pressed: new Set(),
    mouseDown: false,
    mouseButton: -1,
    dragDX: 0,
    dragDY: 0,
    dragging: false,
    pointerLocked: false,
  };
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    state.pressed.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    state.pressed.clear();
    state.mouseDown = false;
    state.dragging = false;
  });

  canvas.addEventListener('mousedown', (e) => {
    state.mouseDown = true;
    state.mouseButton = e.button;
    state.dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => {
    state.mouseDown = false;
    state.dragging = false;
    state.mouseButton = -1;
  });
  window.addEventListener('mousemove', (e) => {
    if (!state.dragging) return;
    state.dragDX += e.clientX - lastX;
    state.dragDY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  state.down = (code) => keys.has(code);
  state.wasPressed = (code) => state.pressed.has(code);
  // Call once per frame after the game has read the presses.
  state.endFrame = () => {
    state.pressed.clear();
    state.dragDX = 0;
    state.dragDY = 0;
  };
  // Movement axes from WASD + arrows, in camera space: forward is -z of the
  // camera yaw, right is +x of it.
  state.moveAxis = () => {
    let x = 0;
    let y = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    const len = Math.hypot(x, y);
    if (len > 1) {
      x /= len;
      y /= len;
    }
    return { x, y };
  };
  return state;
}
