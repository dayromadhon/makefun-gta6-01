// SOLMAR HEAT — hud: the DOM overlay (cash, health, stars, speed,
// objective, messages, screens) and the 2D minimap canvas.
import { CFG } from './config.js';

export class HUD {
  constructor() {
    this.el = {};
    for (const id of ['cash', 'debt', 'health-fill', 'health-num', 'stars', 'speed', 'speed-num', 'objective', 'objective-dist', 'message', 'minimap', 'screen-title', 'screen-pause', 'screen-busted', 'screen-card', 'card-title', 'card-body', 'card-reward', 'busted-reason', 'btn-new', 'btn-continue', 'btn-resume', 'btn-restart', 'btn-card-go', 'btn-busted-ok', 'title-save-note', 'ammo', 'weapon']) {
      this.el[id] = document.getElementById(id);
    }
    this.mapCtx = this.el.minimap.getContext('2d');
    this.messageTimer = 0;
  }

  setCash(cash) {
    this.el.cash.textContent = `$${cash.toLocaleString()}`;
  }

  setDebt(left) {
    this.el.debt.textContent = left > 0 ? `Debt left: $${left.toLocaleString()}` : 'DEBT PAID — Solmar is yours';
  }

  setHealth(h) {
    this.el['health-fill'].style.width = `${Math.max(0, h)}%`;
    this.el['health-num'].textContent = Math.ceil(h);
  }

  setStars(n) {
    let s = '';
    for (let i = 0; i < CFG.maxWanted; i++) s += i < n ? '★' : '☆';
    this.el.stars.textContent = s;
    this.el.stars.style.color = n >= 3 ? '#ff4444' : '#ffd94a';
  }

  setSpeed(v) {
    const kmh = Math.round(Math.abs(v) * 3.6);
    this.el['speed-num'].textContent = kmh;
    this.el.speed.style.display = v === 0 ? 'none' : 'block';
  }

  setAmmo(weapon, mag, reserve) {
    this.el.weapon.textContent = weapon === 'pistol' ? 'Pistol' : 'Fists';
    this.el.ammo.textContent = weapon === 'pistol' ? `${mag} / ${reserve}` : '—';
  }

  setObjective(text, dist) {
    this.el.objective.textContent = text;
    this.el['objective-dist'].textContent = dist != null ? `${Math.round(dist)}m` : '';
  }

  showMessage(text, secs = 3) {
    this.el.message.textContent = text;
    this.el.message.style.opacity = '1';
    this.messageTimer = secs;
  }

  update(dt) {
    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
      if (this.messageTimer <= 0) this.el.message.style.opacity = '0';
    }
  }

  showScreen(name) {
    for (const key of ['screen-title', 'screen-pause', 'screen-busted', 'screen-card']) {
      this.el[key].classList.toggle('hidden', key !== name);
    }
  }

  hideScreens() {
    for (const key of ['screen-title', 'screen-pause', 'screen-busted', 'screen-card']) {
      this.el[key].classList.add('hidden');
    }
  }

  showCard(title, body, reward) {
    this.el['card-title'].textContent = title;
    this.el['card-body'].textContent = body;
    this.el['card-reward'].textContent = reward || '';
    this.showScreen('screen-card');
  }

  showBusted(reason) {
    this.el['busted-reason'].textContent = reason;
    this.showScreen('screen-busted');
  }

  // Top-down map: roads, water, player arrow, police dots, mission marker.
  drawMinimap(world) {
    const ctx = this.mapCtx;
    const S = 168;
    const half = CFG.half + 30;
    const toMap = (x, z) => [((x + half) / (half * 2)) * S, ((z + half) / (half * 2)) * S];
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(20,40,28,0.85)';
    ctx.fillRect(0, 0, S, S);
    // Water: south and east edges.
    ctx.fillStyle = '#1e7fa8';
    const [, sy] = toMap(0, CFG.half + 8);
    ctx.fillRect(0, sy, S, S - sy);
    const [ex] = toMap(CFG.half + 8, 0);
    ctx.fillRect(ex, 0, S - ex, S);
    // Roads.
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 4;
    for (const c of world.city.roadCenters) {
      const [x1, y1] = toMap(c, -half);
      const [x2, y2] = toMap(c, half);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      const [x3, y3] = toMap(-half, c);
      const [x4, y4] = toMap(half, c);
      ctx.beginPath();
      ctx.moveTo(x3, y3);
      ctx.lineTo(x4, y4);
      ctx.stroke();
    }
    // Mission marker: pulsing yellow diamond.
    if (world.missions.marker) {
      const [mx, my] = toMap(world.missions.marker.x, world.missions.marker.z);
      const pulse = 5 + Math.sin(performance.now() * 0.006) * 2;
      ctx.fillStyle = '#ffd94a';
      ctx.beginPath();
      ctx.moveTo(mx, my - pulse);
      ctx.lineTo(mx + pulse, my);
      ctx.lineTo(mx, my + pulse);
      ctx.lineTo(mx - pulse, my);
      ctx.closePath();
      ctx.fill();
    }
    // Traffic: grey dots. Police: red dots.
    for (const car of world.vehicles.traffic) {
      const [cx, cy] = toMap(car.x, car.z);
      ctx.fillStyle = '#bbbbbb';
      ctx.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    }
    for (const cop of world.vehicles.police) {
      const [cx, cy] = toMap(cop.x, cop.z);
      ctx.fillStyle = '#ff3344';
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player: white arrow pointing along the heading.
    const [px, py] = toMap(world.player.x, world.player.z);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.PI - world.player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.5, 5);
    ctx.lineTo(-4.5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
