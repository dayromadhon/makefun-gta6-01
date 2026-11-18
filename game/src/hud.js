// hud.js — HUD, minimap, menus: all DOM, built here so index.html stays small.
import { CONFIG } from './config.js';

function el(tag, id, parent, text = '') {
  const e = document.createElement(tag);
  if (id) e.id = id;
  if (text) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
}

export class HUD {
  constructor(handlers) {
    this.handlers = handlers;
    this.root = el('div', 'hud', document.body);
    this.root.style.cssText = 'position:fixed;inset:0;pointer-events:none;font-family:Arial,sans-serif;color:#fff;z-index:10';
    // Top-left: cash + debt.
    const tl = el('div', 'hud-tl', this.root);
    tl.style.cssText = 'position:absolute;top:12px;left:12px;text-shadow:0 1px 3px #000';
    this.cashEl = el('div', 'hud-cash', tl, '$0');
    this.cashEl.style.cssText = 'font-size:26px;font-weight:bold;color:#7dff8a';
    this.debtEl = el('div', 'hud-debt', tl, 'Debt $4,500');
    this.debtEl.style.cssText = 'font-size:15px;color:#ffb0b0';
    // Top-right: stars + minimap.
    const tr = el('div', 'hud-tr', this.root);
    tr.style.cssText = 'position:absolute;top:12px;right:12px;text-align:right';
    this.starsEl = el('div', 'hud-stars', tr, '');
    this.starsEl.style.cssText = 'font-size:26px;letter-spacing:4px;text-shadow:0 1px 3px #000';
    this.map = el('canvas', 'hud-map', tr);
    this.map.width = 180;
    this.map.height = 180;
    this.map.style.cssText = 'width:180px;height:180px;border:2px solid rgba(255,255,255,.6);border-radius:4px;background:#20242a;margin-top:6px';
    // Top-centre: objective + timer.
    const tc = el('div', 'hud-tc', this.root);
    tc.style.cssText = 'position:absolute;top:12px;left:50%;transform:translateX(-50%);text-align:center;text-shadow:0 1px 3px #000';
    this.objectiveEl = el('div', 'hud-objective', tc, '');
    this.objectiveEl.style.cssText = 'font-size:17px;font-weight:bold';
    this.timerEl = el('div', 'hud-timer', tc, '');
    this.timerEl.style.cssText = 'font-size:22px;font-weight:bold;color:#ffcc00';
    // Bottom-left: health.
    const bl = el('div', 'hud-bl', this.root);
    bl.style.cssText = 'position:absolute;bottom:14px;left:12px;width:220px;text-shadow:0 1px 3px #000';
    el('div', null, bl, 'HEALTH').style.cssText = 'font-size:12px;letter-spacing:2px';
    this.healthBar = el('div', 'hud-health', bl);
    this.healthBar.style.cssText = 'height:14px;background:#333;border:1px solid #fff;margin-top:2px';
    this.healthFill = el('div', 'hud-health-fill', this.healthBar);
    this.healthFill.style.cssText = 'height:100%;width:100%;background:#4caf50';
    this.ammoEl = el('div', 'hud-ammo', bl, '');
    this.ammoEl.style.cssText = 'font-size:15px;margin-top:4px';
    // Bottom-right: speed + controls hint.
    const br = el('div', 'hud-br', this.root);
    br.style.cssText = 'position:absolute;bottom:14px;right:12px;text-align:right;text-shadow:0 1px 3px #000';
    this.speedEl = el('div', 'hud-speed', br, '');
    this.speedEl.style.cssText = 'font-size:24px;font-weight:bold';
    this.hintEl = el('div', 'hud-hint', br, 'WASD move · E car · F punch · Click shoot · R reload · M mute · Esc pause');
    this.hintEl.style.cssText = 'font-size:12px;color:#ddd;margin-top:4px';
    // Centre flash message.
    this.flashEl = el('div', 'hud-flash', this.root, '');
    this.flashEl.style.cssText = 'position:absolute;top:32%;left:50%;transform:translateX(-50%);font-size:28px;font-weight:bold;text-shadow:0 2px 6px #000;text-align:center;display:none';
    this.flashTimer = 0;
    // Mission card overlay.
    this.card = el('div', 'mission-card', this.root);
    this.card.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(10,14,20,.92);border:2px solid #ffcc00;border-radius:10px;padding:24px 28px;width:420px;pointer-events:auto;display:none;text-align:center';
    this.cardTitle = el('h2', null, this.card, '');
    this.cardTitle.style.cssText = 'margin:0 0 8px;color:#ffcc00';
    this.cardDesc = el('p', null, this.card, '');
    this.cardDesc.style.cssText = 'margin:0 0 12px;line-height:1.5;color:#eee';
    this.cardPay = el('div', null, this.card, '');
    this.cardPay.style.cssText = 'font-size:20px;font-weight:bold;color:#7dff8a;margin-bottom:16px';
    this.goBtn = el('button', null, this.card, 'GO ▶');
    this.goBtn.style.cssText = 'font-size:20px;padding:10px 36px;background:#ffcc00;border:none;border-radius:6px;cursor:pointer;font-weight:bold';
    this.goBtn.addEventListener('click', () => handlers.onGo());
    // Splash overlay (mission complete / failed / busted / wasted).
    this.splash = el('div', 'splash', this.root);
    this.splash.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:rgba(10,14,20,.92);border:2px solid #fff;border-radius:10px;padding:24px 32px;width:420px;pointer-events:auto;display:none;text-align:center';
    this.splashTitle = el('h2', null, this.splash, '');
    this.splashTitle.style.cssText = 'margin:0 0 8px';
    this.splashBody = el('p', null, this.splash, '');
    this.splashBody.style.cssText = 'margin:0 0 16px;line-height:1.5;color:#eee';
    this.splashBtn = el('button', null, this.splash, 'Continue');
    this.splashBtn.style.cssText = 'font-size:18px;padding:10px 28px;background:#ffcc00;border:none;border-radius:6px;cursor:pointer;font-weight:bold';
    this.splashBtn.addEventListener('click', () => handlers.onSplash());
    // Title screen.
    this.title = el('div', 'title-screen', this.root);
    this.title.style.cssText = 'position:absolute;inset:0;background:linear-gradient(160deg,rgba(10,26,46,.88) 0%,rgba(18,58,94,.82) 45%,rgba(200,106,42,.82) 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:auto;text-align:center';
    el('h1', null, this.title, 'SOLMAR HEAT').style.cssText = 'font-size:64px;margin:0;letter-spacing:6px;color:#ffcc00;text-shadow:0 4px 0 #7a3a00';
    el('p', null, this.title, 'An open-world crime game in Solmar Bay').style.cssText = 'font-size:20px;margin:8px 0 24px;color:#fff';
    this.newBtn = el('button', null, this.title, '▶  New Game');
    this.newBtn.style.cssText = 'font-size:22px;padding:12px 40px;margin:6px;background:#ffcc00;border:none;border-radius:8px;cursor:pointer;font-weight:bold';
    this.newBtn.addEventListener('click', () => handlers.onNewGame());
    this.continueBtn = el('button', null, this.title, 'Continue');
    this.continueBtn.style.cssText = 'font-size:22px;padding:12px 40px;margin:6px;background:#fff;border:none;border-radius:8px;cursor:pointer;font-weight:bold;display:none';
    this.continueBtn.addEventListener('click', () => handlers.onContinue());
    const controls = el('div', null, this.title, 'WASD move / drive · E steal or exit car · Space handbrake · F punch · Click pistol · R reload · Shift run · M mute · Esc pause');
    controls.style.cssText = 'margin-top:26px;font-size:14px;color:#ddd;max-width:520px;line-height:1.6';
    // Pause overlay.
    this.pause = el('div', 'pause-screen', this.root);
    this.pause.style.cssText = 'position:absolute;inset:0;background:rgba(0,0,0,.7);display:none;flex-direction:column;align-items:center;justify-content:center;pointer-events:auto';
    el('h1', null, this.pause, 'PAUSED').style.cssText = 'font-size:48px;color:#fff;margin:0 0 16px';
    this.resumeBtn = el('button', null, this.pause, 'Resume');
    this.resumeBtn.style.cssText = 'font-size:20px;padding:10px 32px;background:#ffcc00;border:none;border-radius:6px;cursor:pointer;font-weight:bold';
    this.resumeBtn.addEventListener('click', () => handlers.onResume());
  }

  flash(text) {
    this.flashEl.textContent = text;
    this.flashEl.style.display = 'block';
    this.flashTimer = 2.6;
  }
  setObjective(text) {
    this.objectiveEl.textContent = text;
  }
  setTimer(n) {
    this.timerEl.textContent = n > 0 ? `⏱ ${n}s` : '';
  }
  showMissionCard(title, desc, pay) {
    this.cardTitle.textContent = title;
    this.cardDesc.textContent = desc;
    this.cardPay.textContent = pay > 0 ? `Pay: $${pay}` : '';
    this.card.style.display = 'block';
  }
  hideMissionCard() {
    this.card.style.display = 'none';
  }
  showMissionComplete(title, pay, debtLeft) {
    this.splashTitle.textContent = 'MISSION COMPLETE';
    this.splashTitle.style.color = '#7dff8a';
    this.splashBody.textContent = `${title} — +$${pay}. Debt left: $${debtLeft}.`;
    this.splashBtn.textContent = 'Continue';
    this.splash.style.display = 'block';
  }
  showMissionFailed(reason) {
    this.splashTitle.textContent = 'MISSION FAILED';
    this.splashTitle.style.color = '#ff6666';
    this.splashBody.textContent = reason;
    this.splashBtn.textContent = 'Try again';
    this.splash.style.display = 'block';
  }
  showBusted(fine) {
    this.splashTitle.textContent = 'BUSTED!';
    this.splashTitle.style.color = '#ff6666';
    this.splashBody.textContent = `The cops got you. Fine: $${fine}. You wake up at Solmar General.`;
    this.splashBtn.textContent = 'Continue';
    this.splash.style.display = 'block';
  }
  showWasted() {
    this.splashTitle.textContent = 'WASTED';
    this.splashTitle.style.color = '#ff6666';
    this.splashBody.textContent = 'You got taken down. The docs at Solmar General patch you up — minus $100.';
    this.splashBtn.textContent = 'Continue';
    this.splash.style.display = 'block';
  }
  hideSplash() {
    this.splash.style.display = 'none';
  }
  showTitle(hasSave) {
    this.title.style.display = 'flex';
    this.continueBtn.style.display = hasSave ? 'block' : 'none';
  }
  hideTitle() {
    this.title.style.display = 'none';
  }
  showPause() {
    this.pause.style.display = 'flex';
  }
  hidePause() {
    this.pause.style.display = 'none';
  }

  update(dt, ctx) {
    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) this.flashEl.style.display = 'none';
    }
    this.cashEl.textContent = `$${ctx.cash}`;
    this.debtEl.textContent = ctx.missions.debtLeft() > 0 ? `Debt $${ctx.missions.debtLeft()} (owe Rocco Vane)` : 'DEBT PAID ✓';
    this.debtEl.style.color = ctx.missions.debtLeft() > 0 ? '#ffb0b0' : '#7dff8a';
    let stars = '';
    for (let i = 0; i < CONFIG.maxStars; i++) stars += i < ctx.wanted.stars ? '★' : '☆';
    this.starsEl.textContent = stars;
    this.starsEl.style.color = ctx.wanted.stars > 0 ? '#ffcc00' : 'rgba(255,255,255,.55)';
    const hp = Math.max(0, ctx.player.health);
    this.healthFill.style.width = `${hp}%`;
    this.healthFill.style.background = hp > 50 ? '#4caf50' : hp > 25 ? '#ff9800' : '#f44336';
    this.ammoEl.textContent = ctx.player.onFoot
      ? `Pistol ${ctx.player.mag}/${ctx.player.reserve}  ·  Fists ready`
      : 'In car — Space = handbrake';
    this.speedEl.textContent = ctx.player.onFoot ? '' : `${Math.round(Math.abs(ctx.player.carSpeed) * 3.6)} km/h`;
    this.drawMinimap(ctx);
  }

  drawMinimap(ctx) {
    const c = this.map.getContext('2d');
    const W = 180;
    const H = 180;
    const scale = W / 420;
    const toX = (x) => (x + 210) * scale;
    const toY = (z) => (z + 210) * scale;
    c.fillStyle = '#20242a';
    c.fillRect(0, 0, W, H);
    // Water + beach.
    c.fillStyle = '#2e7fa8';
    c.fillRect(0, toY(CONFIG.waterZ), W, H - toY(CONFIG.waterZ));
    c.fillStyle = '#e8d29a';
    c.fillRect(0, toY(CONFIG.beachZ), W, toY(CONFIG.waterZ) - toY(CONFIG.beachZ));
    // Roads.
    c.strokeStyle = '#555a60';
    c.lineWidth = 5;
    for (const s of CONFIG.streets) {
      c.beginPath();
      c.moveTo(toX(-150), toY(s));
      c.lineTo(toX(150), toY(s));
      c.stroke();
      c.beginPath();
      c.moveTo(toX(s), toY(-150));
      c.lineTo(toX(s), toY(150));
      c.stroke();
    }
    // Buildings.
    c.fillStyle = '#8a8f96';
    for (const b of ctx.city.colliders) {
      c.fillRect(toX(b.minX), toY(b.minZ), (b.maxX - b.minX) * scale, (b.maxZ - b.minZ) * scale);
    }
    // Objective.
    if (ctx.missions.objective) {
      const o = ctx.missions.objective;
      c.fillStyle = '#ffcc00';
      c.beginPath();
      c.moveTo(toX(o.x), toY(o.z) - 7);
      c.lineTo(toX(o.x) + 6, toY(o.z));
      c.lineTo(toX(o.x), toY(o.z) + 7);
      c.lineTo(toX(o.x) - 6, toY(o.z));
      c.closePath();
      c.fill();
    }
    // Police.
    c.fillStyle = '#4488ff';
    for (const car of ctx.vehicles.policeCars) {
      c.beginPath();
      c.arc(toX(car.mesh.position.x), toY(car.mesh.position.z), 3.5, 0, Math.PI * 2);
      c.fill();
    }
    // Player.
    const p = ctx.player.pos;
    c.fillStyle = '#7dff8a';
    c.beginPath();
    c.arc(toX(p.x), toY(p.z), 4, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = '#7dff8a';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(toX(p.x), toY(p.z));
    c.lineTo(toX(p.x) + Math.sin(ctx.player.heading) * 9, toY(p.z) + Math.cos(ctx.player.heading) * 9);
    c.stroke();
  }
}
