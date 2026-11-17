// Solmar Heat — the HUD, minimap and menus.
// One job: everything drawn in DOM over the 3D view.

import { WORLD, DEBT_TOTAL } from './config.js';

export function createHud() {
  const $ = (id) => document.getElementById(id);
  const el = {
    hud: $('hud'),
    cash: $('cash'),
    debt: $('debt'),
    healthFill: $('health-fill'),
    stars: $('stars'),
    objective: $('objective'),
    timer: $('timer'),
    minimap: $('minimap'),
    speed: $('speed'),
    toast: $('toast'),
    vignette: $('vignette'),
    weapon: $('weapon'),
    ammo: $('ammo'),
    cardTitle: $('card-title'),
    cardText: $('card-text'),
    payout: $('payout'),
  };
  const mapCtx = el.minimap.getContext('2d');
  let toastTimer = null;

  const screens = {
    title: $('screen-title'),
    card: $('screen-card'),
    pause: $('screen-pause'),
    busted: $('screen-busted'),
    down: $('screen-down'),
  };

  function showScreen(name) {
    for (const [key, node] of Object.entries(screens)) {
      if (node) node.style.display = key === name ? 'flex' : 'none';
    }
    el.hud.style.display = name === 'play' ? 'block' : 'none';
  }

  function toast(text, ms) {
    el.toast.textContent = text;
    el.toast.style.opacity = '1';
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.toast.style.opacity = '0';
    }, ms || 3200);
  }

  function showMissionCard(def) {
    el.cardTitle.textContent = def.title;
    el.cardText.textContent = def.briefing;
    showScreen('card');
  }

  function showPayout(amount, title) {
    el.payout.textContent = `+$${amount} — ${title}`;
    el.payout.style.opacity = '1';
    setTimeout(() => {
      el.payout.style.opacity = '0';
    }, 3200);
  }

  function flashDamage() {
    el.vignette.style.opacity = '0.85';
    setTimeout(() => {
      el.vignette.style.opacity = '0';
    }, 220);
  }

  // Minimap: city bounds -140..140 mapped onto the 190px canvas.
  function drawMinimap(G) {
    const S = 190;
    const W = 280; // world span shown
    const toMap = (x, z) => [(x + W / 2) / W * S, (z + W / 2) / W * S];
    mapCtx.fillStyle = '#10141a';
    mapCtx.fillRect(0, 0, S, S);
    // sea + sand
    mapCtx.fillStyle = '#2e7fa8';
    mapCtx.fillRect(0, 0, S, ((W / 2 - 132) / W) * S);
    mapCtx.fillStyle = '#e6d29a';
    mapCtx.fillRect(0, ((W / 2 - 132) / W) * S, S, ((132 - 100) / W) * S);
    // blocks
    mapCtx.fillStyle = '#2c313a';
    for (const bx of [-60, -20, 20, 60]) {
      for (const bz of [-60, -20, 20, 60]) {
        const [x, y] = toMap(bx - 15, bz - 15);
        mapCtx.fillRect(x, y, (30 / W) * S, (30 / W) * S);
      }
    }
    // roads
    mapCtx.strokeStyle = '#565d68';
    mapCtx.lineWidth = 4;
    for (const s of WORLD.streets) {
      const [x1] = toMap(s, -100);
      const [, y1] = toMap(-100, s);
      mapCtx.beginPath();
      mapCtx.moveTo(x1, 0);
      mapCtx.lineTo(x1, S);
      mapCtx.stroke();
      mapCtx.beginPath();
      mapCtx.moveTo(0, y1);
      mapCtx.lineTo(S, y1);
      mapCtx.stroke();
    }
    // mission / side-job target
    let target = null;
    if (G.missions.active) target = G.missions.stepTarget();
    else if (G.missions.sideJob) {
      const j = G.missions.sideJob;
      target = j.phase === 'pickup' ? j.pickup : j.drop;
    }
    if (target) {
      const [tx, ty] = toMap(target.x, target.z);
      const pulse = 5 + Math.sin(performance.now() * 0.008) * 2;
      mapCtx.fillStyle = '#ffd23e';
      mapCtx.beginPath();
      mapCtx.arc(tx, ty, pulse, 0, Math.PI * 2);
      mapCtx.fill();
    }
    // police cars
    mapCtx.fillStyle = '#ff4444';
    for (const car of G.vehicles.police) {
      if (!car.active) continue;
      const [x, y] = toMap(car.x, car.z);
      mapCtx.fillRect(x - 2, y - 2, 4, 4);
    }
    // foot cops
    for (const cop of G.peds.cops) {
      if (!cop.active) continue;
      const [x, y] = toMap(cop.x, cop.z);
      mapCtx.fillStyle = '#ff8844';
      mapCtx.fillRect(x - 2, y - 2, 4, 4);
    }
    // player arrow
    const [px, py] = toMap(G.player.x, G.player.z);
    const heading = G.player.inCar && G.player.car ? G.player.car.heading : G.player.heading;
    mapCtx.save();
    mapCtx.translate(px, py);
    mapCtx.rotate(Math.atan2(Math.sin(heading), -Math.cos(heading)) + Math.PI);
    mapCtx.fillStyle = '#ffffff';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -6);
    mapCtx.lineTo(4, 5);
    mapCtx.lineTo(-4, 5);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
  }

  function update(G) {
    el.cash.textContent = `$${G.missions.cash}`;
    const paid = Math.min(DEBT_TOTAL, G.missions.cash);
    el.debt.textContent = `Debt $${DEBT_TOTAL - paid} left`;
    el.healthFill.style.width = `${Math.max(0, G.player.health)}%`;
    el.healthFill.style.background = G.player.health > 50 ? '#3fae6a' : G.player.health > 25 ? '#e0a92e' : '#c23b2e';
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < G.wanted.stars ? '★' : '☆';
    el.stars.textContent = stars;
    el.stars.style.color = G.wanted.stars > 0 ? '#ffd23e' : '#5a6270';
    const m = G.missions.active;
    if (m) {
      el.objective.textContent = `${m.def.title} — ${G.missions.stepText()}`;
      const s = G.missions.step();
      if (s && s.timed && m.timer > 0) {
        el.timer.textContent = `${Math.ceil(m.timer)}s`;
        el.timer.style.display = 'block';
      } else {
        el.timer.style.display = 'none';
      }
    } else if (G.missions.sideJob) {
      const j = G.missions.sideJob;
      el.objective.textContent = `${j.kind === 'taxi' ? 'Taxi fare' : 'Courier run'} $${j.fare} — ${j.phase === 'pickup' ? 'pick up' : 'deliver'}`;
      el.timer.style.display = 'none';
    } else if (G.missions.index >= 5) {
      el.objective.textContent = 'Free roam — side jobs pay the rest';
      el.timer.style.display = 'none';
    } else {
      el.objective.textContent = '';
      el.timer.style.display = 'none';
    }
    if (G.player.inCar && G.player.car) {
      el.speed.textContent = `${Math.round(Math.abs(G.player.car.speed) * 3.6)} km/h`;
      el.speed.style.display = 'block';
    } else {
      el.speed.style.display = 'none';
    }
    el.weapon.textContent = G.player.weapon === 'pistol' ? 'PISTOL' : 'FISTS';
    el.ammo.textContent = G.player.weapon === 'pistol' ? `${G.player.mag} / ${G.player.reserve}` : '—';
    drawMinimap(G);
  }

  return {
    el, showScreen, toast, showMissionCard, showPayout, flashDamage, update,
    onClick(id, fn) {
      const node = $(id);
      if (node) node.addEventListener('click', () => fn());
    },
  };
}
