// SOLMAR HEAT — hud.js
// One job: everything drawn on top of the 3D view — the HUD (stars, cash,
// health, speed, ammo), the minimap, the mission card, the centre messages
// and the title / pause / busted / mission-complete screens. The HUD never
// takes a click meant for the game: only its buttons accept pointer events.

import { CONFIG } from './config.js';

export class HUD {
  constructor(doc) {
    this.doc = doc;
    this.el = (id) => doc.getElementById(id);
    this.starsEl = this.el('stars');
    this.cashEl = this.el('cash');
    this.debtEl = this.el('debt');
    this.healthFill = this.el('health-fill');
    this.speedEl = this.el('speed');
    this.ammoEl = this.el('ammo');
    this.minimap = this.el('minimap');
    this.mm = this.minimap.getContext('2d');
    this.card = this.el('mission-card');
    this.cardTitle = this.el('mission-title');
    this.cardObjective = this.el('mission-objective');
    this.cardReward = this.el('mission-reward');
    this.msgEl = this.el('message');
    this.arrowEl = this.el('objective-arrow');
    this.timerEl = this.el('timer');
    this.crosshair = this.el('crosshair');
    this._msgT = null;
  }

  // ---- screens ----
  showTitle(save) {
    this._showOnly('title-screen');
    this.el('btn-continue').style.display = save ? 'block' : 'none';
    this.el('save-info').textContent = save
      ? `Save found — cash $${save.cash}, mission ${Math.min(save.missionIndex + 1, 5)} of 5`
      : 'No save yet — start a new game.';
  }

  showPlaying() {
    this._showOnly(null);
  }

  showPause() {
    this._showOnly('pause-screen');
  }

  showBusted() {
    this._showOnly('busted-screen');
  }

  showMissionComplete(mission, reward) {
    this._showOnly('mission-complete');
    this.el('mc-title').textContent = `${mission.title} — complete!`;
    this.el('mc-reward').textContent = `+$${reward}`;
  }

  showStoryDone() {
    this._showOnly('mission-complete');
    this.el('mc-title').textContent = 'Debt paid! Rocco Vane is off your back.';
    this.el('mc-reward').textContent = 'Free roam — side jobs pay cash';
  }

  _showOnly(id) {
    for (const s of ['title-screen', 'pause-screen', 'busted-screen', 'mission-complete']) {
      this.el(s).classList.toggle('hidden', s !== id);
    }
  }

  // ---- mission card ----
  showMissionCard(mission) {
    this.card.classList.remove('hidden');
    this.cardTitle.textContent = `Mission ${mission.id}: ${mission.title}`;
    this.cardObjective.textContent = mission.briefing;
    this.cardReward.textContent = `Reward $${mission.reward}`;
  }

  hideMissionCard() {
    this.card.classList.add('hidden');
  }

  // ---- centre toast ----
  message(text, ms) {
    this.msgEl.textContent = text;
    this.msgEl.classList.remove('hidden');
    if (this._msgT) clearTimeout(this._msgT);
    this._msgT = setTimeout(() => this.msgEl.classList.add('hidden'), ms || 2600);
  }

  // ---- per-frame update ----
  // s: {cash, debtLeft, health, stars, speedKmh, ammo, reloading, inCar,
  //     objective, marker, player:{x,z,heading}, cops:[{x,z}], px, pz, fx}
  update(s) {
    // Wanted stars.
    let stars = '';
    for (let i = 0; i < CONFIG.maxStars; i++) stars += i < s.stars ? '★' : '☆';
    this.starsEl.textContent = stars;
    this.starsEl.classList.toggle('hot', s.stars > 0);
    this.cashEl.textContent = `$${s.cash}`;
    this.debtEl.textContent = s.debtLeft > 0 ? `Debt: $${s.debtLeft}` : 'Debt paid!';
    this.healthFill.style.width = `${Math.max(0, s.health)}%`;
    this.healthFill.style.background = s.health > 50 ? '#58c96b' : s.health > 25 ? '#f7c948' : '#e84a4a';
    this.speedEl.textContent = s.inCar ? `${Math.round(s.speedKmh)} km/h` : '';
    this.ammoEl.textContent = s.inCar ? '' : (s.reloading ? 'RELOADING…' : `Pistol ${s.ammo}/${CONFIG.pistolAmmo}`);
    this.crosshair.style.display = s.inCar ? 'none' : 'block';
    this.cardObjective.textContent = s.objective || '';
    // Timer (mission 2).
    if (s.timer && s.timer > 0) {
      this.timerEl.textContent = `${Math.ceil(s.timer)}s`;
      this.timerEl.classList.remove('hidden');
    } else {
      this.timerEl.classList.add('hidden');
    }
    // Objective arrow: rotate toward the marker relative to the camera.
    if (s.marker) {
      const dx = s.marker.x - s.player.x;
      const dz = s.marker.z - s.player.z;
      const bearing = Math.atan2(dx, dz);
      const rel = bearing - s.player.camHeading;
      this.arrowEl.style.display = 'block';
      this.arrowEl.style.transform = `translateX(-50%) rotate(${rel}rad)`;
      const dist = Math.hypot(dx, dz);
      this.arrowEl.textContent = `▲ ${Math.round(dist)}m`;
    } else {
      this.arrowEl.style.display = 'none';
    }
    this._drawMinimap(s);
  }

  _drawMinimap(s) {
    const c = this.mm;
    const W = this.minimap.width;
    const H = this.minimap.height;
    const half = CONFIG.cityHalf + 30;
    const toX = (x) => ((x + half) / (half * 2)) * W;
    const toY = (z) => ((z + half) / (half * 2)) * H;
    c.clearRect(0, 0, W, H);
    // Sea + sand (south edge).
    c.fillStyle = '#2f7fb8';
    c.fillRect(0, toY(CONFIG.cityHalf), W, H - toY(CONFIG.cityHalf));
    c.fillStyle = '#e8d29a';
    c.fillRect(0, toY(CONFIG.cityHalf - 2), W, toY(CONFIG.cityHalf) - toY(CONFIG.cityHalf - 2));
    // Ground.
    c.fillStyle = '#3a3f46';
    c.fillRect(0, 0, W, toY(CONFIG.cityHalf));
    // Roads.
    c.strokeStyle = '#565b64';
    c.lineWidth = 5;
    for (const line of CONFIG.streetLines) {
      c.beginPath();
      c.moveTo(toX(line), 0);
      c.lineTo(toX(line), toY(CONFIG.cityHalf));
      c.stroke();
      c.beginPath();
      c.moveTo(0, toY(line));
      c.lineTo(W, toY(line));
      c.stroke();
    }
    // Mission marker.
    if (s.marker) {
      const pulse = 6 + Math.sin(performance.now() / 250) * 2;
      c.fillStyle = '#f7c948';
      c.beginPath();
      c.arc(toX(s.marker.x), toY(s.marker.z), pulse, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#fff';
      c.lineWidth = 1.5;
      c.stroke();
    }
    // Cops.
    c.fillStyle = '#ff4a4a';
    for (const cop of s.cops || []) {
      c.beginPath();
      c.arc(toX(cop.x), toY(cop.z), 3, 0, Math.PI * 2);
      c.fill();
    }
    // Player arrow.
    const px = toX(s.player.x);
    const py = toY(s.player.z);
    c.save();
    c.translate(px, py);
    c.rotate(-s.player.heading + Math.PI);
    c.fillStyle = '#fff';
    c.beginPath();
    c.moveTo(0, -7);
    c.lineTo(5, 6);
    c.lineTo(-5, 6);
    c.closePath();
    c.fill();
    c.restore();
  }
}
