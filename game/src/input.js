// Keyboard and mouse state. The game reads held keys every frame and consumes one-shot
// actions (confirm, pause, enter car, punch, shoot, reload, horn) through takeActions().
// Pointer drag orbits the camera; the wheel zooms it.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_PUNCH = 8;
export const ACTION_SHOOT = 16;
export const ACTION_RELOAD = 32;
export const ACTION_HORN = 64;
export const ACTION_MUTE = 128;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  Space: ACTION_CONFIRM,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyE: ACTION_ENTER,
  KeyF: ACTION_PUNCH,
  KeyR: ACTION_RELOAD,
  KeyH: ACTION_HORN,
  KeyM: ACTION_MUTE,
};

export function createInput(canvas) {
  const held = new Set();
  const queue = [];
  let dragDX = 0;
  let dragDY = 0;
  let wheel = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  function press(action) {
    if (!queue.includes(action)) queue.push(action);
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    held.add(event.code);
    const action = KEY_ACTIONS[event.code];
    if (action !== undefined) {
      press(action);
      if (event.code === 'Space') event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) press(ACTION_SHOOT);
    if (event.button === 2) {
      dragging = true;
      lastX = event.clientX;
      lastY = event.clientY;
    }
  });
  canvas.addEventListener('mousemove', (event) => {
    if (!dragging) return;
    dragDX += event.clientX - lastX;
    dragDY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  window.addEventListener('mouseup', () => {
    dragging = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  canvas.addEventListener('wheel', (event) => {
    wheel += Math.sign(event.deltaY);
    event.preventDefault();
  }, { passive: false });

  // Driving / walking axes, -1..1, relative to the camera.
  function axes() {
    let forward = 0;
    let strafe = 0;
    if (held.has('KeyW') || held.has('ArrowUp')) forward += 1;
    if (held.has('KeyS') || held.has('ArrowDown')) forward -= 1;
    if (held.has('KeyA') || held.has('ArrowLeft')) strafe -= 1;
    if (held.has('KeyD') || held.has('ArrowRight')) strafe += 1;
    return { forward, strafe };
  }

  return {
    axes,
    running() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    handbrake() {
      return held.has('Space');
    },
    takeActions() {
      let bits = 0;
      while (queue.length > 0) bits |= queue.shift();
      return bits;
    },
    takeLook() {
      const look = { dx: dragDX, dy: dragDY, wheel };
      dragDX = 0;
      dragDY = 0;
      wheel = 0;
      return look;
    },
  };
}
