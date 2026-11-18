// SOLMAR HEAT — HUD and menus. A DOM overlay (health, cash, debt, stars,
// speed, ammo, mission card, minimap canvas) plus title / pause / busted /
// mission-complete screens. The minimap is a 2D canvas drawn from the city.

export class HUD {
  constructor(city) {
    this.city = city;
    this.root = document.getElementById('hud');
    this._build();
    this.toastTimer = 0;
  }
  _build() {
    this.root.innerHTML = `
      <div id="hud-top">
        <div id="hud-stars"></div>
        <div id="hud-cash"><span id="hud-cash-v">$0</span><span id="hud-debt-v">Debt $4,500</span></div>
      </div>
      <div id="hud-health"><div id="hud-health-fill"></div><span id="hud-health-v">100</span></div>
      <div id="hud-speed"><span id="hud-speed-v">0</span><span class="unit">km/h</span><span id="hud-ammo-v"></span></div>
      <div id="hud-mission"><div id="hud-mission-title"></div><div id="hud-mission-obj"></div><div id="hud-mission-timer"></div></div>
      <canvas id="hud-minimap" width="180" height="180"></canvas>
      <div id="hud-toast"></div>
      <div id="hud-prompt"></div>
      <div id="hud-menu" class="hidden">
        <div id="hud-menu-title">SOLMAR HEAT</div>
        <div id="hud-menu-sub">Solmar Bay &middot; a Leo Marin story</div>
        <div id="hud-menu-body"></div>
        <div id="hud-menu-btns"></div>
        <div id="hud-menu-hint">WASD drive &amp; walk &middot; E steal / exit car &middot; F punch &middot; Click / J shoot &middot; R reload &middot; Space handbrake &middot; P pause &middot; M mute</div>
      </div>`;
    this.el = {
      stars: document.getElementById('hud-stars'),
      cash: document.getElementById('hud-cash-v'),
      debt: document.getElementById('hud-debt-v'),
      healthFill: document.getElementById('hud-health-fill'),
      healthV: document.getElementById('hud-health-v'),
      speed: document.getElementById('hud-speed-v'),
      ammo: document.getElementById('hud-ammo-v'),
      missionTitle: document.getElementById('hud-mission-title'),
      missionObj: document.getElementById('hud-mission-obj'),
      missionTimer: document.getElementById('hud-mission-timer'),
      minimap: document.getElementById('hud-minimap'),
      toast: document.getElementById('hud-toast'),
      prompt: document.getElementById('hud-prompt'),
      menu: document.getElementById('hud-menu'),
      menuTitle: document.getElementById('hud-menu-title'),
      menuBody: document.getElementById('hud-menu-body'),
      menuBtns: document.getElementById('hud-menu-btns'),
    };
    this.mapCtx = this.el.minimap.getContext('2d');
  }
  toast(text, seconds = 3) {
    this.el.toast.textContent = text;
    this.el.toast.style.opacity = '1';
    this.toastTimer = seconds;
  }
  prompt(text) {
    this.el.prompt.textContent = text || '';
  }
  update(dt, game) {
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el.toast.style.opacity = '0';
    }
    // Stars.
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < game.wanted.level ? '★' : '☆';
    this.el.stars.textContent = stars;
    this.el.stars.style.color = game.wanted.level > 0 ? '#ffd21f' : '#888';
    this.el.cash.textContent = `$${game.cash.toLocaleString()}`;
    this.el.debt.textContent = game.debt > 0 ? `Debt $${game.debt.toLocaleString()}` : 'Debt PAID ✓';
    this.el.debt.style.color = game.debt > 0 ? '#ff9a8a' : '#7ad97a';
    const hp = Math.max(0, Math.round(game.player.health));
    this.el.healthFill.style.width = `${hp}%`;
    this.el.healthFill.style.background = hp > 50 ? '#4fc25a' : hp > 25 ? '#e8a62e' : '#d94f3d';
    this.el.healthV.textContent = String(hp);
    const kmh = Math.round(Math.abs(game.player.speed) * 3.6);
    this.el.speed.textContent = String(kmh);
    if (game.player.inCar) {
      this.el.ammo.textContent = '';
    } else {
      this.el.ammo.textContent = `🔫 ${game.player.ammo}/${game.player.reserve}`;
    }
    // Mission card.
    const m = game.missions.current;
    if (m && game.missions.state === 'active') {
      this.el.missionTitle.textContent = `Mission ${m.id}: ${m.name} — $${m.pay}`;
      this.el.missionObj.textContent = game.missions.objective
        ? game.missions.objective.label
        : m.objective;
      if (m.id === 2 && game.missions.phase === 'deliver') {
        this.el.missionTimer.textContent = `⏱ ${Math.max(0, Math.ceil(game.missions.timer))}s`;
      } else if (m.id === 4) {
        this.el.missionTimer.textContent = `Fares ${game.missions.taxiDone}/${game.missions.taxiTarget}`;
      } else {
        this.el.missionTimer.textContent = '';
      }
    } else if (game.missions.allDone) {
      this.el.missionTitle.textContent = 'Free roam — debt paid';
      this.el.missionObj.textContent = 'Take a taxi fare or cruise Solmar Bay';
      this.el.missionTimer.textContent = '';
    } else {
      this.el.missionTitle.textContent = '';
      this.el.missionObj.textContent = '';
      this.el.missionTimer.textContent = '';
    }
    this._drawMinimap(game);
  }
  _drawMinimap(game) {
    const ctx = this.mapCtx;
    const S = 180;
    const world = 420;
    const toMap = (v) => ((v + world / 2) / world) * S;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(20,24,28,0.85)';
    ctx.fillRect(0, 0, S, S);
    // Water.
    ctx.fillStyle = '#1d5f8a';
    ctx.fillRect(0, toMap(190), S, S - toMap(190));
    ctx.fillRect(toMap(157), 0, S - toMap(157), toMap(157));
    // Beach.
    ctx.fillStyle = '#d9c08a';
    ctx.fillRect(0, toMap(157), S, toMap(190) - toMap(157));
    // Roads.
    ctx.fillStyle = '#55585e';
    for (const r of this.city.roads) {
      if (r.axis === 'x') ctx.fillRect(0, toMap(r.at - 7), S, toMap(14) - toMap(0));
      else ctx.fillRect(toMap(r.at - 7), 0, toMap(14) - toMap(0), S);
    }
    // Blocks.
    ctx.fillStyle = '#3a3d42';
    const step = 60;
    for (let i = 0; i < 5; i++) {
      for (let j = 0; j < 5; j++) {
        ctx.fillRect(toMap(-150 + i * step), toMap(-150 + j * step), toMap(46) - toMap(0), toMap(46) - toMap(0));
      }
    }
    // Objective marker (yellow diamond).
    if (game.missions.objective) {
      const o = game.missions.objective;
      ctx.fillStyle = '#ffd21f';
      const x = toMap(o.x);
      const y = toMap(o.z);
      ctx.beginPath();
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x + 5, y);
      ctx.lineTo(x, y + 6);
      ctx.lineTo(x - 5, y);
      ctx.closePath();
      ctx.fill();
    }
    // Police (blue dots).
    ctx.fillStyle = '#5a8aff';
    for (const p of game.wanted.police) {
      ctx.beginPath();
      ctx.arc(toMap(p.x), toMap(p.z), 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player (white arrow, rotated by heading).
    const pp = game.player.pos;
    ctx.save();
    ctx.translate(toMap(pp.x), toMap(pp.z));
    ctx.rotate(game.player.inCar ? -game.player.car.heading : -game.player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(-4, -4);
    ctx.lineTo(-4, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  showMenu(title, bodyHtml, buttons) {
    this.el.menuTitle.textContent = title;
    this.el.menuBody.innerHTML = bodyHtml;
    this.el.menuBtns.innerHTML = '';
    for (const b of buttons) {
      const btn = document.createElement('button');
      btn.textContent = b.label;
      btn.className = 'hud-btn';
      btn.addEventListener('click', () => b.onClick());
      this.el.menuBtns.appendChild(btn);
    }
    this.el.menu.classList.remove('hidden');
  }
  hideMenu() {
    this.el.menu.classList.add('hidden');
  }
}
