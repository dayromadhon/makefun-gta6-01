// The 2D layer: the HUD (stars, cash, health, ammo, speed, objective), the canvas
// minimap, the menus (title, pause, busted, wasted, mission cards) and the toast line.
// The 3D world never touches the DOM; main.js feeds this module a state snapshot.

import { CITY, PALETTE } from './config.js';

const MAP_SIZE = 180;
const WORLD = 560;

function mapXY(x, z) {
  return { x: ((x + WORLD / 2) / WORLD) * MAP_SIZE, y: ((z + WORLD / 2) / WORLD) * MAP_SIZE };
}

export function createHud() {
  const el = (id) => document.getElementById(id);
  const starsEl = el('stars');
  const cashEl = el('cash');
  const healthFill = el('health-fill');
  const healthText = el('health-text');
  const ammoEl = el('ammo');
  const speedEl = el('speed');
  const speedUnit = el('speed-unit');
  const objectiveEl = el('objective-text');
  const objectiveBox = el('objective');
  const timerEl = el('timer');
  const carEl = el('car-name');
  const hintEl = el('hint');
  const toastEl = el('toast');
  const minimap = el('minimap');
  const mapCtx = minimap.getContext('2d');
  const vignette = el('vignette');
  const menuTitle = el('menu-title');
  const menuPause = el('menu-pause');
  const menuEnd = el('menu-end');
  const menuCard = el('menu-card');
  const cardTitle = el('card-title');
  const cardText = el('card-text');
  const endTitle = el('end-title');
  const endText = el('end-text');
  const titleSave = el('title-save');
  let toastTimer = null;
  let lastStars = -1;
  let lastCash = -1;

  function setStars(n) {
    if (n === lastStars) return;
    lastStars = n;
    let html = '';
    for (let i = 0; i < 5; i += 1) {
      html += `<span class="${i < n ? 'star on' : 'star'}">★</span>`;
    }
    starsEl.innerHTML = html;
    starsEl.classList.toggle('flash', n > 0);
  }

  function setCash(cash) {
    if (cash === lastCash) return;
    lastCash = cash;
    cashEl.textContent = `$${cash.toLocaleString('en-US')}`;
  }

  function toast(text, seconds = 3) {
    toastEl.textContent = text;
    toastEl.classList.add('show');
    if (toastTimer) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toastEl.classList.remove('show'), seconds * 1000);
  }

  function drawMinimap(player, police, traffic, marker) {
    const ctx = mapCtx;
    ctx.clearRect(0, 0, MAP_SIZE, MAP_SIZE);
    ctx.fillStyle = '#20242c';
    ctx.fillRect(0, 0, MAP_SIZE, MAP_SIZE);
    // Water south and east.
    ctx.fillStyle = '#2e7f9e';
    ctx.fillRect(0, mapXY(0, 224).y, MAP_SIZE, MAP_SIZE - mapXY(0, 224).y);
    ctx.fillRect(mapXY(224, 0).x, 0, MAP_SIZE - mapXY(224, 0).x, MAP_SIZE);
    // Roads.
    ctx.strokeStyle = '#565b66';
    ctx.lineWidth = 4;
    for (const s of CITY.streets) {
      const a = mapXY(s, 0);
      const b = mapXY(0, s);
      ctx.beginPath();
      ctx.moveTo(a.x, 0);
      ctx.lineTo(a.x, MAP_SIZE);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, b.y);
      ctx.lineTo(MAP_SIZE, b.y);
      ctx.stroke();
    }
    // Mission marker.
    if (marker) {
      const p = mapXY(marker.x, marker.z);
      const pulse = 6 + Math.sin(performance.now() / 240) * 2;
      ctx.fillStyle = '#4fc3f7';
      ctx.beginPath();
      ctx.arc(p.x, p.y, pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    // Traffic dots.
    ctx.fillStyle = '#e8e8e8';
    for (const car of traffic) {
      const p = mapXY(car.x, car.z);
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    }
    // Police dots.
    for (const car of police) {
      const p = mapXY(car.x, car.z);
      ctx.fillStyle = Math.floor(performance.now() / 300) % 2 === 0 ? '#ff3b30' : '#2f7bff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player arrow.
    const pp = mapXY(player.x, player.z);
    ctx.save();
    ctx.translate(pp.x, pp.y);
    ctx.rotate(Math.PI - player.heading);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function update(state) {
    setStars(state.stars);
    setCash(state.cash);
    const healthPct = Math.max(0, Math.round((state.health / state.maxHealth) * 100));
    healthFill.style.width = `${healthPct}%`;
    healthFill.style.background = healthPct > 50 ? '#4caf50' : healthPct > 25 ? '#ff9800' : '#f44336';
    healthText.textContent = `${healthPct}`;
    ammoEl.textContent = state.inCar ? '' : `◈ ${state.ammo} / ${state.reserveAmmo}`;
    if (state.inCar) {
      const kmh = Math.round(Math.abs(state.speed) * 3.6);
      speedEl.textContent = String(kmh);
      speedUnit.textContent = 'km/h';
      carEl.textContent = state.carName;
    } else {
      speedEl.textContent = '';
      speedUnit.textContent = '';
      carEl.textContent = '';
    }
    objectiveEl.textContent = state.objective || '';
    objectiveBox.style.visibility = state.objective ? 'visible' : 'hidden';
    if (state.timeLeft > 0 && state.timeLimit > 0) {
      timerEl.textContent = `${Math.ceil(state.timeLeft)}s`;
      timerEl.classList.toggle('urgent', state.timeLeft < 15);
    } else {
      timerEl.textContent = '';
    }
    hintEl.textContent = state.hint || '';
    vignette.style.opacity = state.health < 35 ? String(0.55 - state.health / 100) : '0';
  }

  function showOnly(which) {
    for (const [name, node] of [['title', menuTitle], ['pause', menuPause], ['end', menuEnd], ['card', menuCard]]) {
      node.classList.toggle('hidden', name !== which);
    }
    const hud = document.getElementById('hud');
    hud.classList.toggle('hidden', which === 'title');
  }

  function showTitle(save) {
    showOnly('title');
    if (save && save.cash > 0) {
      titleSave.textContent = `Continue — $${save.cash.toLocaleString('en-US')} · ${save.missionsDone} of 5 jobs done`;
      titleSave.classList.remove('hidden');
    } else {
      titleSave.classList.add('hidden');
    }
  }

  function showPause() {
    showOnly('pause');
  }

  function showEnd(kind, text) {
    endTitle.textContent = kind === 'busted' ? 'BUSTED' : 'WASTED';
    endTitle.style.color = kind === 'busted' ? '#4fc3f7' : '#ff4d4d';
    endText.textContent = text;
    showOnly('end');
  }

  function showCard(mission, onDone) {
    cardTitle.textContent = mission.title;
    cardText.textContent = mission.briefing;
    showOnly('card');
    const button = document.getElementById('card-go');
    button.onclick = () => {
      onDone();
    };
  }

  function hideMenus() {
    showOnly(null);
  }

  function bindButtons(handlers) {
    const bind = (id, fn) => {
      const node = document.getElementById(id);
      if (node) node.addEventListener('click', fn);
    };
    bind('btn-new', () => handlers.onNewGame());
    bind('btn-continue', () => handlers.onContinue());
    bind('btn-resume', () => handlers.onResume());
    bind('btn-restart-mission', () => handlers.onRestartMission());
    bind('btn-quit-title', () => handlers.onQuitToTitle());
    bind('btn-end-retry', () => handlers.onRetry());
    bind('btn-end-title', () => handlers.onQuitToTitle());
    bind('btn-mute', () => handlers.onMute());
  }

  return {
    update,
    drawMinimap,
    toast,
    showTitle,
    showPause,
    showEnd,
    showCard,
    hideMenus,
    bindButtons,
    setMuteLabel(muted) {
      const node = document.getElementById('btn-mute');
      if (node) node.textContent = muted ? 'Unmute (M)' : 'Mute (M)';
    },
  };
}
