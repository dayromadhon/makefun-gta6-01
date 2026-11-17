// Solmar Heat — synthesized sound, no audio files.
// One job: every sound in the game is an oscillator or filtered noise,
// built here and nowhere else.

export function createAudio() {
  const api = {
    enabled: true,
    muted: false,
    ctx: null,
    master: null,
    engineOsc: null,
    engineOsc2: null,
    engineGain: null,
    sirenOsc: null,
    sirenGain: null,
    sirenTimer: 0,
    sirenHigh: false,
  };

  api.ensure = () => {
    if (api.ctx) {
      if (api.ctx.state === 'suspended') api.ctx.resume().catch(() => {});
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      api.ctx = new AC();
      api.master = api.ctx.createGain();
      api.master.gain.value = api.muted ? 0 : 0.5;
      api.master.connect(api.ctx.destination);
      // Engine: two detuned saws through a low-pass, pitch follows speed.
      api.engineOsc = api.ctx.createOscillator();
      api.engineOsc.type = 'sawtooth';
      api.engineOsc.frequency.value = 55;
      api.engineOsc2 = api.ctx.createOscillator();
      api.engineOsc2.type = 'square';
      api.engineOsc2.frequency.value = 28;
      const filt = api.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 420;
      api.engineGain = api.ctx.createGain();
      api.engineGain.gain.value = 0;
      api.engineOsc.connect(filt);
      api.engineOsc2.connect(filt);
      filt.connect(api.engineGain);
      api.engineGain.connect(api.master);
      api.engineOsc.start();
      api.engineOsc2.start();
      // Siren: a sine that flips between two notes.
      api.sirenOsc = api.ctx.createOscillator();
      api.sirenOsc.type = 'sine';
      api.sirenOsc.frequency.value = 660;
      api.sirenGain = api.ctx.createGain();
      api.sirenGain.gain.value = 0;
      api.sirenOsc.connect(api.sirenGain);
      api.sirenGain.connect(api.master);
      api.sirenOsc.start();
    } catch {
      api.ctx = null;
    }
  };

  api.setMuted = (m) => {
    api.muted = m;
    if (api.master) api.master.gain.value = m ? 0 : 0.5;
  };

  api.engine = (speed01, on) => {
    if (!api.ctx || !api.engineGain) return;
    const target = on ? 0.05 + speed01 * 0.1 : 0;
    api.engineGain.gain.setTargetAtTime(target, api.ctx.currentTime, 0.08);
    const f = 55 + speed01 * 165;
    api.engineOsc.frequency.setTargetAtTime(f, api.ctx.currentTime, 0.08);
    api.engineOsc2.frequency.setTargetAtTime(f * 0.5, api.ctx.currentTime, 0.08);
  };

  api.siren = (on, dt) => {
    if (!api.ctx || !api.sirenGain) return;
    api.sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, api.ctx.currentTime, 0.1);
    if (!on) return;
    api.sirenTimer += dt;
    if (api.sirenTimer > 0.42) {
      api.sirenTimer = 0;
      api.sirenHigh = !api.sirenHigh;
      api.sirenOsc.frequency.setTargetAtTime(api.sirenHigh ? 880 : 660, api.ctx.currentTime, 0.02);
    }
  };

  function blip(freq, dur, type, vol, slideTo) {
    if (!api.ctx || !api.master) return;
    try {
      const t = api.ctx.currentTime;
      const o = api.ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      const g = api.ctx.createGain();
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g);
      g.connect(api.master);
      o.start(t);
      o.stop(t + dur + 0.02);
    } catch {
      /* sound is decoration; never break the game */
    }
  }

  function noiseBurst(dur, vol, lowpass) {
    if (!api.ctx || !api.master) return;
    try {
      const t = api.ctx.currentTime;
      const len = Math.max(1, Math.floor(api.ctx.sampleRate * dur));
      const buf = api.ctx.createBuffer(1, len, api.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = api.ctx.createBufferSource();
      src.buffer = buf;
      const filt = api.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = lowpass;
      const g = api.ctx.createGain();
      g.gain.value = vol;
      src.connect(filt);
      filt.connect(g);
      g.connect(api.master);
      src.start(t);
    } catch {
      /* sound is decoration; never break the game */
    }
  }

  api.shot = () => noiseBurst(0.14, 0.5, 2400);
  api.punch = () => noiseBurst(0.09, 0.35, 700);
  api.crash = (hard) => noiseBurst(hard ? 0.3 : 0.15, hard ? 0.6 : 0.3, 900);
  api.pickup = () => blip(660, 0.12, 'sine', 0.25, 990);
  api.click = () => blip(880, 0.06, 'square', 0.12);
  api.denied = () => blip(180, 0.18, 'square', 0.15, 120);
  api.missionDone = () => {
    blip(523, 0.14, 'triangle', 0.3);
    setTimeout(() => blip(659, 0.14, 'triangle', 0.3), 130);
    setTimeout(() => blip(784, 0.26, 'triangle', 0.3), 260);
  };
  api.busted = () => {
    blip(392, 0.3, 'sawtooth', 0.2, 196);
    setTimeout(() => blip(196, 0.5, 'sawtooth', 0.2, 98), 280);
  };
  return api;
}
