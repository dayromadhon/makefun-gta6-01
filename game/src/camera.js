// Solmar Heat — the chase camera.
// One job: put the camera behind the player or the car, smoothly, and let
// a right-drag orbit it. Forward is (sin(yaw), cos(yaw)) in (x, z).

export function createCamera(camera) {
  const cam = {
    yaw: 0, // follows the player's heading when free
    orbit: 0, // extra yaw from dragging, decays back to 0
    pitch: 0.32, // radians above the horizon
    dist: 11,
    height: 5,
    shake: 0,
    shakeX: 0,
    shakeY: 0,
  };

  function update(dt, ctx) {
    const player = ctx.player;
    const input = ctx.input;
    // right-drag orbits (left click is shoot)
    if (input.dragging && input.mouseButton === 2) {
      cam.orbit -= input.dragDX * 0.005;
      cam.pitch = Math.max(0.1, Math.min(1.0, cam.pitch + input.dragDY * 0.003));
    } else {
      // ease the orbit back so the camera settles behind the player
      cam.orbit *= Math.max(0, 1 - 1.2 * dt);
    }
    // the yaw to follow: the car's heading when driving, the player's
    // movement heading on foot, plus any orbit offset
    let targetYaw;
    if (player.inCar && player.car) {
      targetYaw = player.car.heading;
      cam.dist += ((13 - cam.dist) * Math.min(1, 3 * dt));
      cam.height += ((6.5 - cam.height) * Math.min(1, 3 * dt));
    } else {
      targetYaw = player.heading;
      cam.dist += ((10 - cam.dist) * Math.min(1, 3 * dt));
      cam.height += ((5 - cam.height) * Math.min(1, 3 * dt));
    }
    let diff = targetYaw + cam.orbit - cam.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cam.yaw += diff * Math.min(1, 4 * dt);
    player.yaw = cam.yaw;

    const fx = Math.sin(cam.yaw);
    const fz = Math.cos(cam.yaw);
    const tx = player.x;
    const tz = player.z;
    const back = cam.dist * Math.cos(cam.pitch);
    const up = cam.dist * Math.sin(cam.pitch) + cam.height * 0.4;
    camera.position.set(tx - fx * back, up, tz - fz * back);
    if (cam.shake > 0.01) {
      cam.shakeX = (Math.random() - 0.5) * cam.shake;
      cam.shakeY = (Math.random() - 0.5) * cam.shake;
      cam.shake *= Math.max(0, 1 - 4 * dt);
    } else {
      cam.shakeX = 0;
      cam.shakeY = 0;
    }
    camera.position.x += cam.shakeX;
    camera.position.y += cam.shakeY;
    camera.lookAt(tx + fx * 4, 1.6, tz + fz * 4);
  }

  function addShake(amount) {
    cam.shake = Math.min(1.2, cam.shake + amount);
  }

  cam.update = update;
  cam.addShake = addShake;
  return cam;
}
