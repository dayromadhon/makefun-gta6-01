// SOLMAR HEAT — audio.js
// One job: every sound in the game, synthesized with WebAudio. No audio files,
// no network. The context starts on the first user gesture (New Game click).

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenTimer = null;
    this.muted = false;
    this._noiseBuf = null;
  }

  // Call from a user gesture. Safe to call twice.
  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // Shared white-noise buffer for gunshots, crashes and skids.
      const len = this.ctx.sampleRate * 0.5;
      this._noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = this._noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      // Looping engine oscillator, gain follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(lp);
      lp.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    } catch (e) {
      this.ctx = null;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  // speed01: 0..1 of top speed. Call every frame while driving.
  engine(speed01, on) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.09 : 0, t, 0.08);
    this.engineOsc.frequency.setTargetAtTime(55 + speed01 * 130, t, 0.08);
  }

  _tone(freq, dur, type, vol, slideTo) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  _noise(dur, vol, filterFreq) {
    if (!this.ctx || this.muted || !this._noiseBuf) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq || 1800;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  ui() {
    this._tone(660, 0.07, 'triangle', 0.15);
  }

  chime() {
    this._tone(880, 0.12, 'sine', 0.22);
    setTimeout(() => this._tone(1318, 0.18, 'sine', 0.2), 90);
  }

  gunshot() {
    this._noise(0.16, 0.5, 3200);
    this._tone(160, 0.1, 'square', 0.18, 60);
  }

  punch() {
    this._noise(0.09, 0.3, 900);
  }

  crash() {
    this._noise(0.35, 0.5, 700);
    this._tone(90, 0.25, 'sine', 0.3, 40);
  }

  pickup() {
    this._tone(1046, 0.1, 'sine', 0.2);
    setTimeout(() => this._tone(1568, 0.14, 'sine', 0.18), 70);
  }

  // Two-tone police siren while wanted > 0. Call with on=false to stop.
  siren(on) {
    if (!this.ctx) return;
    if (on && !this.sirenTimer) {
      let high = false;
      this.sirenTimer = setInterval(() => {
        high = !high;
        this._tone(high ? 950 : 700, 0.42, 'sine', 0.05);
      }, 430);
    } else if (!on && this.sirenTimer) {
      clearInterval(this.sirenTimer);
      this.sirenTimer = null;
    }
  }

  busted() {
    this._tone(440, 0.3, 'sawtooth', 0.2, 220);
    setTimeout(() => this._tone(330, 0.5, 'sawtooth', 0.2, 165), 250);
  }
}
