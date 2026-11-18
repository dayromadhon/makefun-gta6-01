// The HUD: DOM overlay on top of the 3D canvas. Cash, health, wanted stars,
// speed, a 2D minimap, the mission card, toasts, and the title / pause /
// mission-complete / busted / debt-paid screens. Pure DOM — no three.js here.

import { DEBT } from './config.js';

export class Hud {
  constructor() {
    this.root = document.getElementById('hud');
    this._build();
    this.messageTimer = 0;
    this._onTitleClick = null;
    this._onContinueClick = null;
  }

  _el(tag, cls, parent, text = '') {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    parent.appendChild(e);
    return e;
  }

  _build() {
    // Top-left: cash + debt + health.
    const tl = this._el('div', 'hud-tl', this.root);
    this.cashEl = this._el('div', 'cash', tl, '$0');
    this.debtEl = this._el('div', 'debt', tl, `Debt: $${DEBT}`);
    this.healthWrap = this._el('div', 'health-wrap', tl);
    this.healthBar = this._el('div', 'health-bar', this.healthWrap);
    this.healthText = this._el('div', 'health-text', tl, 'Health 100');
    // Top-right: wanted stars.
    const tr = this._el('div', 'hud-tr', this.root);
    this.starsEl = this._el('div', 'stars', tr, '');
    this.ammoEl = this._el('div', 'ammo', tr, '');
    // Top-centre: mission card.
    const tc = this._el('div', 'hud-tc', this.root);
    this.missionTitle = this._el('div', 'mission-title', tc, '');
    this.missionBrief = this._el('div', 'mission-brief', tc, '');
    this.missionTarget = this._el('div', 'mission-target', tc, '');
    this.missionTimer = this._el('div', 'mission-timer', tc, '');
    // Bottom-left: minimap.
    const bl = this._el('div', 'hud-bl', this.root);
    this.mapCanvas = this._el('canvas', 'minimap', bl);
    this.mapCanvas.width = 180;
    this.mapCanvas.height = 180;
    this.mapCtx = this.mapCanvas.getContext('2d');
    // Bottom-right: speed + controls hint.
    const br = this._el('div', 'hud-br', this.root);
    this.speedEl = this._el('div', 'speed', br, '0 km/h');
    this.hintEl = this._el('div', 'hint', br, 'WASD drive · E steal car · F punch · Click shoot · R reload · Esc pause · M mute');
    // Centre toast.
    this.toastEl = this._el('div', 'toast', this.root, '');
    // Screens.
    this.screenEl = this._el('div', 'screen', this.root);
    this.screenTitle = this._el('h1', 'screen-title', this.screenEl);
    this.screenBody = this._el('div', 'screen-body', this.screenEl);
    this.screenBtn = this._el('button', 'screen-btn', this.screenEl, 'Start');
    this.screenBtn2 = this._el('button', 'screen-btn secondary', this.screenEl, 'Continue');
    this.screenBtn2.style.display = 'none';
    this.screenBtn.addEventListener('click', () => this._onTitleClick && this._onTitleClick());
    this.screenBtn2.addEventListener('click', () => this._onContinueClick && this._onContinueClick());
  }

  onStart(cb) {
    this._onTitleClick = cb;
  }

  onContinue(cb) {
    this._onContinueClick = cb;
  }

  /** Show a full-screen overlay. kind: title | pause | busted | complete | debt. */
  showScreen(kind, opts = {}) {
    this.screenEl.style.display = 'flex';
    this.screenBtn2.style.display = 'none';
    if (kind === 'title') {
      this.screenTitle.textContent = 'SOLMAR HEAT';
      this.screenBody.innerHTML = `Leo Marin owes <b>$${DEBT}</b> to loan shark Rocco Vane.<br>Dispatcher Ada Kwan has the jobs to pay it off.<br>Steal cars, lose the cops, run the packages — and get the debt paid.<br><br><span class="keys">WASD walk / drive · Shift run · Space handbrake<br>E steal or exit a car · Click shoot · F punch · R reload<br>Mouse drag orbits the camera · Esc pause · M mute</span>`;
      this.screenBtn.textContent = 'Start Game';
      if (opts.hasSave) {
        this.screenBtn2.style.display = 'inline-block';
        this.screenBtn2.textContent = 'Continue';
      }
    } else if (kind === 'pause') {
      this.screenTitle.textContent = 'PAUSED';
      this.screenBody.textContent = 'Take a breath. Solmar Bay waits.';
      this.screenBtn.textContent = 'Resume';
    } else if (kind === 'busted') {
      this.screenTitle.textContent = 'BUSTED';
      this.screenBody.innerHTML = `The Solmar Bay PD caught you.<br>You lost <b>$100</b> in fines and the heat is gone.`;
      this.screenBtn.textContent = 'Back on the Street';
    } else if (kind === 'complete') {
      this.screenTitle.textContent = `${opts.mission.name} — DONE`;
      this.screenBody.innerHTML = `You earned <b>$${opts.mission.reward}</b>.<br>Cash: <b>$${opts.cash}</b> · Debt left: <b>$${Math.max(0, DEBT - opts.cash)}</b>`;
      this.screenBtn.textContent = opts.next ? `Next: ${opts.next.name}` : 'Free Roam';
    } else if (kind === 'debt') {
      this.screenTitle.textContent = 'DEBT PAID';
      this.screenBody.innerHTML = `Leo Marin is free of Rocco Vane.<br>Solmar Bay is yours now — side jobs keep paying in free roam.`;
      this.screenBtn.textContent = 'Free Roam';
    }
  }

  hideScreen() {
    this.screenEl.style.display = 'none';
  }

  /** Update the live numbers every frame. */
  update(state) {
    this.cashEl.textContent = `$${Math.floor(state.cash)}`;
    this.debtEl.textContent = `Debt: $${Math.max(0, DEBT - Math.floor(state.cash))}`;
    const hp = Math.max(0, Math.round(state.health));
    this.healthBar.style.width = `${hp}%`;
    this.healthBar.style.background = hp > 50 ? '#2ecc71' : hp > 25 ? '#f39c12' : '#e74c3c';
    this.healthText.textContent = `Health ${hp}`;
    // Stars.
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < state.stars ? '★' : '☆';
    this.starsEl.textContent = stars;
    this.starsEl.style.color = state.stars > 0 ? '#ffd700' : 'rgba(255,255,255,0.35)';
    this.starsEl.style.textShadow = state.heatFlash > 0 ? '0 0 12px #ff0000' : 'none';
    // Ammo (only on foot).
    this.ammoEl.textContent = state.inCar ? '' : `Ammo ${state.ammo} / ${state.ammoReserve}${state.reloading ? ' — reloading…' : ''}`;
    // Speed.
    this.speedEl.textContent = `${Math.round(Math.abs(state.speed) * 3.6)} km/h`;
    // Mission card.
    if (state.mission) {
      this.missionTitle.textContent = `${state.missionIndex + 1}. ${state.mission.name}  ·  $${state.mission.reward}`;
      this.missionBrief.textContent = state.mission.brief;
      this.missionTarget.textContent = state.objectiveLabel
        ? `→ ${state.objectiveLabel}${state.objectiveDist != null ? ` · ${Math.round(state.objectiveDist)} m` : ''}`
        : '';
      this.missionTimer.textContent = state.timer > 0 ? `⏱ ${Math.ceil(state.timer)}s` : '';
    } else {
      this.missionTitle.textContent = 'Free Roam';
      this.missionBrief.textContent = 'Side jobs keep paying. Drive to a job marker to take one.';
      this.missionTarget.textContent = state.objectiveLabel ? `→ ${state.objectiveLabel}` : '';
      this.missionTimer.textContent = '';
    }
    // Toast.
    if (this.messageTimer > 0) {
      this.messageTimer -= state.dt;
      if (this.messageTimer <= 0) this.toastEl.style.opacity = '0';
    }
    this._drawMinimap(state);
  }

  showToast(text, seconds = 3) {
    this.toastEl.textContent = text;
    this.toastEl.style.opacity = '1';
    this.messageTimer = seconds;
  }

  _drawMinimap(state) {
    const ctx = this.mapCtx;
    const W = 180;
    const H = 180;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = 'rgba(10, 20, 30, 0.75)';
    ctx.fillRect(0, 0, W, H);
    const toMap = (x, z) => [((x + 140) / 340) * W, ((z + 140) / 340) * H];
    // Roads.
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    for (const s of [-104, -52, 0, 52, 104]) {
      const [x1] = toMap(s, 0);
      const [, y1] = toMap(0, s);
      ctx.beginPath();
      ctx.moveTo(x1, 4);
      ctx.lineTo(x1, H - 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(4, y1);
      ctx.lineTo(W - 4, y1);
      ctx.stroke();
    }
    // Water (east + south).
    ctx.fillStyle = 'rgba(47,127,184,0.8)';
    ctx.fillRect(((158 + 140) / 340) * W, 0, W, H);
    ctx.fillRect(0, ((158 + 140) / 340) * H, W, H);
    // Mission objective.
    if (state.objective) {
      const [ox, oy] = toMap(state.objective.x, state.objective.z);
      ctx.fillStyle = '#ffc837';
      ctx.beginPath();
      ctx.arc(ox, oy, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    // Police (blue).
    ctx.fillStyle = '#4a90ff';
    for (const p of state.police || []) {
      const [px, py] = toMap(p.x, p.z);
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player (white arrow).
    const [px, py] = toMap(state.playerX, state.playerZ);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(Math.sin(state.playerHeading), Math.cos(state.playerHeading)) + Math.PI);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
