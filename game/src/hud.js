// Solmar Heat — the HUD and menus. One job: every DOM overlay the player
// sees (title, mission card, pause, busted, stats, minimap) and the wiring
// that turns button clicks into game actions.
import { MISSIONS, ECONOMY } from './config.js';

export class HUD {
  constructor(doc, callbacks) {
    this.doc = doc;
    this.cb = callbacks; // { onNewGame, onContinue, onCardGo, onResume, onBustedOk, onWastedOk }
    this.el = {};
    for (const id of [
      'hud', 'objective', 'objective-title', 'objective-text', 'objective-timer',
      'stat-cash', 'stat-debt', 'stars', 'health-fill', 'health-num',
      'speed', 'speed-num', 'hint', 'toast', 'minimap',
      'screen-title', 'screen-card', 'screen-pause', 'screen-busted', 'screen-wasted',
      'btn-new', 'btn-continue', 'card-title', 'card-brief', 'card-reward', 'card-go',
      'btn-resume', 'busted-fine', 'btn-busted-ok', 'wasted-fine', 'btn-wasted-ok',
      'title-save-line',
    ]) {
      this.el[id] = doc.getElementById(id);
    }
    this.mapCtx = this.el['minimap'].getContext('2d');
    this.el['btn-new'].addEventListener('click', () => this.cb.onNewGame());
    this.el['btn-continue'].addEventListener('click', () => this.cb.onContinue());
    this.el['card-go'].addEventListener('click', () => this.cb.onCardGo());
    this.el['btn-resume'].addEventListener('click', () => this.cb.onResume());
    this.el['btn-busted-ok'].addEventListener('click', () => this.cb.onBustedOk());
    this.el['btn-wasted-ok'].addEventListener('click', () => this.cb.onWastedOk());
    this.toastTimer = 0;
  }

  showScreen(name) {
    for (const s of ['screen-title', 'screen-card', 'screen-pause', 'screen-busted', 'screen-wasted']) {
      this.el[s].style.display = 'none';
    }
    this.el['hud'].style.display = name === 'play' ? 'block' : 'none';
    if (name === 'title') this.el['screen-title'].style.display = 'flex';
    if (name === 'card') this.el['screen-card'].style.display = 'flex';
    if (name === 'pause') this.el['screen-pause'].style.display = 'flex';
    if (name === 'busted') this.el['screen-busted'].style.display = 'flex';
    if (name === 'wasted') this.el['screen-wasted'].style.display = 'flex';
  }

  setTitleSave(save) {
    const btn = this.el['btn-continue'];
    if (save) {
      btn.style.display = 'inline-block';
      btn.textContent = `Continue — $${save.cash} · ${save.done.length} of 5 jobs done`;
      this.el['title-save-line'].textContent = `Debt left: $${ECONOMY.debt - save.cash < 0 ? 0 : ECONOMY.debt - Math.min(save.cash, ECONOMY.debt)} of $${ECONOMY.debt} — Rocco Vane is waiting.`;
    } else {
      btn.style.display = 'none';
      this.el['title-save-line'].textContent = `You owe Rocco Vane $${ECONOMY.debt}. Five jobs. Pay it off — or else.`;
    }
  }

  setCard(title, brief, reward) {
    this.el['card-title'].textContent = title;
    this.el['card-brief'].textContent = brief;
    this.el['card-reward'].textContent = reward ? `Reward: $${reward}` : '';
  }

  setObjective(title, text) {
    this.el['objective-title'].textContent = title;
    this.el['objective-text'].textContent = text;
  }

  setTimer(seconds) {
    if (seconds === null || seconds === undefined) {
      this.el['objective-timer'].textContent = '';
      return;
    }
    const s = Math.max(0, Math.ceil(seconds));
    this.el['objective-timer'].textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    this.el['objective-timer'].style.color = s <= 15 ? '#ff5a4a' : '#ffd23e';
  }

  setStats({ cash, debtLeft, stars, health, speed, inCar, weapon, ammo }) {
    this.el['stat-cash'].textContent = `$${cash}`;
    this.el['stat-debt'].textContent = `Debt $${debtLeft}`;
    let starText = '';
    for (let i = 0; i < 5; i++) starText += i < stars ? '★' : '☆';
    this.el['stars'].textContent = starText;
    this.el['stars'].style.color = stars > 0 ? '#ffb13e' : '#cfd6dd';
    this.el['health-fill'].style.width = `${Math.max(0, health)}%`;
    this.el['health-num'].textContent = `${Math.round(health)}`;
    if (inCar) {
      this.el['speed'].style.display = 'block';
      this.el['speed-num'].textContent = `${Math.round(Math.abs(speed) * 3.6)}`;
    } else {
      this.el['speed'].style.display = 'none';
    }
    const weaponText = inCar ? '' : weapon === 'pistol' ? `Pistol ${ammo}/12 — Q to switch, R to reload` : 'Fists — Q for pistol';
    this.setHint(weaponText);
  }

  setHint(text) {
    this.el['hint'].textContent = text;
  }

  toast(text) {
    this.el['toast'].textContent = text;
    this.el['toast'].style.opacity = '1';
    this.toastTimer = 4;
  }

  tickToast(dt) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el['toast'].style.opacity = '0';
    }
  }

  // The minimap: roads, beach, marina, player arrow, cops, mission target.
  drawMinimap(view) {
    const ctx = this.mapCtx;
    const S = 180;
    const scale = S / 290; // world -145..145
    const px = (x) => (x + 145) * scale;
    const pz = (z) => (z + 145) * scale;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#20262c';
    ctx.fillRect(0, 0, S, S);
    // Beach (south) and marina (east).
    ctx.fillStyle = '#c9a86a';
    ctx.fillRect(0, pz(100), S, S - pz(100));
    ctx.fillStyle = '#2e7f9e';
    ctx.fillRect(px(100), 0, S - px(100), S);
    // Roads.
    ctx.strokeStyle = '#5a6068';
    ctx.lineWidth = 5;
    for (const c of [-80, -40, 0, 40, 80]) {
      ctx.beginPath();
      ctx.moveTo(px(c), 0);
      ctx.lineTo(px(c), S);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, pz(c));
      ctx.lineTo(S, pz(c));
      ctx.stroke();
    }
    // Mission target.
    if (view.target) {
      ctx.fillStyle = '#ffd23e';
      ctx.beginPath();
      ctx.arc(px(view.target.x), pz(view.target.z), 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd23e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px(view.target.x), pz(view.target.z), 8, 0, Math.PI * 2);
      ctx.stroke();
    }
    // Police.
    ctx.fillStyle = '#4a90ff';
    for (const cop of view.cops) {
      ctx.beginPath();
      ctx.arc(px(cop.x), pz(cop.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    ctx.save();
    ctx.translate(px(view.player.x), pz(view.player.z));
    ctx.rotate(Math.atan2(Math.sin(view.player.heading), Math.cos(view.player.heading)) * -1 + Math.PI);
    ctx.fillStyle = '#ff4a3a';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}
