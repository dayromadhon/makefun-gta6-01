// Pedestrians: box-built walkers on the sidewalks, with a little wander, panic when a
// car bears down on them or a shot rings out, and cop pedestrians who chase the player
// when the wanted level says so.

import * as THREE from 'three';
import { PEDS } from './config.js';

const SHIRT_COLORS = [0xe74c3c, 0x3498db, 0xf39c12, 0x9b59b6, 0x1abc9c, 0xecf0f1, 0x34495e, 0xe67e22, 0xfd79a8, 0x00cec9];
const SKIN_COLORS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];

function makePedMesh(shirt, skin, cop) {
  const group = new THREE.Group();
  const shirtMat = new THREE.MeshLambertMaterial({ color: cop ? 0x1c2f4a : shirt });
  const skinMat = new THREE.MeshLambertMaterial({ color: skin });
  const pantsMat = new THREE.MeshLambertMaterial({ color: cop ? 0x141c26 : 0x2c3e50 });
  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.8, 0.26), pantsMat);
  legs.position.y = 0.4;
  legs.castShadow = true;
  group.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.62, 0.32), shirtMat);
  torso.position.y = 1.11;
  torso.castShadow = true;
  group.add(torso);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.32), skinMat);
  head.position.y = 1.62;
  head.castShadow = true;
  group.add(head);
  if (cop) {
    const cap = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.1, 0.36), new THREE.MeshLambertMaterial({ color: 0x0e1622 }));
    cap.position.y = 1.82;
    group.add(cap);
  } else {
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.34), new THREE.MeshLambertMaterial({ color: 0x2d1a0e }));
    hair.position.y = 1.8;
    group.add(hair);
  }
  const armGeo = new THREE.BoxGeometry(0.13, 0.55, 0.13);
  const leftArm = new THREE.Mesh(armGeo, shirtMat);
  leftArm.position.set(-0.36, 1.1, 0);
  group.add(leftArm);
  const rightArm = new THREE.Mesh(armGeo, shirtMat);
  rightArm.position.set(0.36, 1.1, 0);
  group.add(rightArm);
  group.userData.leftArm = leftArm;
  group.userData.rightArm = rightArm;
  return group;
}

export function createPeds(scene, city, random) {
  const peds = [];
  const group = new THREE.Group();
  scene.add(group);

  function addPed(x, z, cop) {
    const mesh = makePedMesh(random.pick(SHIRT_COLORS), random.pick(SKIN_COLORS), cop);
    mesh.position.set(x, 0, z);
    group.add(mesh);
    const ped = {
      mesh,
      x,
      z,
      heading: random.range(0, Math.PI * 2),
      speed: 0,
      target: null,
      panic: 0,
      cop: !!cop,
      walkPhase: random.range(0, Math.PI * 2),
      alive: true,
      downTimer: 0,
    };
    peds.push(ped);
    return ped;
  }

  for (let i = 0; i < PEDS.count; i += 1) {
    const point = city.randomSidewalkPoint();
    addPed(point.x, point.z, false);
  }

  function newTarget(ped) {
    ped.target = city.randomSidewalkPoint();
  }

  function scare(x, z, radius) {
    for (const ped of peds) {
      if (!ped.alive || ped.cop) continue;
      const dist = Math.hypot(ped.x - x, ped.z - z);
      if (dist < radius) {
        ped.panic = 3 + Math.random() * 2;
        const away = Math.atan2(ped.x - x, ped.z - z);
        ped.target = { x: ped.x + Math.sin(away) * 30, z: ped.z + Math.cos(away) * 30 };
      }
    }
  }

  function update(dt, player, city) {
    for (const ped of peds) {
      if (!ped.alive) {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          ped.alive = true;
          ped.mesh.visible = true;
          ped.mesh.rotation.z = 0;
          ped.mesh.position.y = 0;
          ped.panic = 4;
        }
        continue;
      }
      if (ped.cop && player) {
        // Cop on foot: run the player down and punch.
        const dx = player.x - ped.x;
        const dz = player.z - ped.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1.4) {
          ped.speed = 0;
          player.hurt(14 * dt, ped);
        } else {
          ped.heading = Math.atan2(dx, dz);
          ped.speed = PEDS.runSpeed;
        }
      } else {
        if (ped.panic > 0) ped.panic -= dt;
        if (!ped.target) newTarget(ped);
        const dx = ped.target.x - ped.x;
        const dz = ped.target.z - ped.z;
        const dist = Math.hypot(dx, dz);
        if (dist < 1.5) {
          newTarget(ped);
        } else {
          const wanted = Math.atan2(dx, dz);
          let turn = wanted - ped.heading;
          while (turn > Math.PI) turn -= Math.PI * 2;
          while (turn < -Math.PI) turn += Math.PI * 2;
          ped.heading += Math.max(-2.4 * dt, Math.min(2.4 * dt, turn));
          ped.speed = ped.panic > 0 ? PEDS.runSpeed : PEDS.walkSpeed;
        }
        // Flee a fast car that is about to hit them.
        if (player && player.car) {
          const car = player.car;
          const cdx = ped.x - car.x;
          const cdz = ped.z - car.z;
          const cdist = Math.hypot(cdx, cdz);
          if (cdist < 8 && Math.abs(car.speed) > 6) {
            ped.panic = 2;
            ped.target = { x: ped.x + (cdx / cdist) * 20, z: ped.z + (cdz / cdist) * 20 };
          }
        }
      }
      ped.x += Math.sin(ped.heading) * ped.speed * dt;
      ped.z += Math.cos(ped.heading) * ped.speed * dt;
      const clamped = city.clampToCity(ped.x, ped.z, 2);
      ped.x = clamped.x;
      ped.z = clamped.z;
      ped.walkPhase += dt * ped.speed * 2.4;
      ped.mesh.position.set(ped.x, 0, ped.z);
      ped.mesh.rotation.y = ped.heading;
      const swing = Math.sin(ped.walkPhase) * 0.5 * Math.min(1, ped.speed / 3);
      ped.mesh.userData.leftArm.rotation.x = swing;
      ped.mesh.userData.rightArm.rotation.x = -swing;
    }
  }

  function knockDown(ped) {
    if (!ped.alive) return;
    ped.alive = false;
    ped.downTimer = 6;
    ped.mesh.rotation.z = Math.PI / 2;
    ped.mesh.position.y = 0.25;
  }

  function spawnCop(x, z) {
    return addPed(x, z, true);
  }

  function removeCop(ped) {
    const index = peds.indexOf(ped);
    if (index !== -1) peds.splice(index, 1);
    group.remove(ped.mesh);
  }

  function nearestPed(x, z, maxDist) {
    let best = null;
    let bestDist = maxDist;
    for (const ped of peds) {
      if (!ped.alive) continue;
      const dist = Math.hypot(ped.x - x, ped.z - z);
      if (dist < bestDist) {
        bestDist = dist;
        best = ped;
      }
    }
    return best;
  }

  return { peds, update, scare, knockDown, spawnCop, removeCop, nearestPed, addPed };
}
