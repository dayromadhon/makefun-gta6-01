// SOLMAR HEAT — audio: everything is synthesized with WebAudio, no audio files.
// Engine hum, two-tone siren, gunshots, punches, UI blips and a mission jingle.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineOsc2 = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.sirenHigh = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // Engine: two detuned saws through a lowpass, pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 60;
      this.engineOsc2 = this.ctx.createOscillator();
      this.engineOsc2.type = 'square';
      this.engineOsc2.frequency.value = 30;
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 400;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineFilter);
      this.engineOsc2.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      this.engineOsc2.start();
      // Siren: one square oscillator, flipped between two tones.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'square';
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    } catch (e) {
      this.ctx = null;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  setEngine(on, speed01) {
    if (!this.ctx) return;
    const target = on ? 0.05 + speed01 * 0.075 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    const f = 55 + speed01 * 165;
    this.engineOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.05);
    this.engineOsc2.frequency.setTargetAtTime(f * 0.5, this.ctx.currentTime, 0.05);
    this.engineFilter.frequency.setTargetAtTime(350 + speed01 * 900, this.ctx.currentTime, 0.1);
  }

  setSiren(on) {
    if (!this.ctx) return;
    this.sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, this.ctx.currentTime, 0.1);
  }

  update(dt) {
    if (!this.ctx || this.sirenGain.gain.value < 0.005) return;
    this.sirenTimer += dt;
    if (this.sirenTimer > 0.42) {
      this.sirenTimer = 0;
      this.sirenHigh = !this.sirenHigh;
      this.sirenOsc.frequency.setTargetAtTime(this.sirenHigh ? 960 : 720, this.ctx.currentTime, 0.02);
    }
  }

  _noiseBurst(dur, freq, gainVal) {
    if (!this.ctx) return;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = gainVal;
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start();
  }

  _tone(freq, dur, type, gainVal, slideTo) {
    if (!this.ctx) return;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, this.ctx.currentTime + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gainVal, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start();
    osc.stop(this.ctx.currentTime + dur + 0.02);
  }

  shot() {
    this._noiseBurst(0.14, 1800, 0.5);
    this._tone(160, 0.1, 'square', 0.25, 60);
  }

  punch() {
    this._noiseBurst(0.09, 500, 0.4);
  }

  crash() {
    this._noiseBurst(0.25, 900, 0.5);
    this._tone(90, 0.2, 'sine', 0.4, 40);
  }

  blip() {
    this._tone(880, 0.07, 'sine', 0.2);
  }

  denied() {
    this._tone(220, 0.12, 'square', 0.15, 160);
  }

  pickup() {
    this._tone(660, 0.09, 'sine', 0.25);
    setTimeout(() => this._tone(990, 0.12, 'sine', 0.25), 90);
  }

  jingle() {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => setTimeout(() => this._tone(n, 0.22, 'triangle', 0.3), i * 130));
  }

  busted() {
    const notes = [392, 330, 262, 196];
    notes.forEach((n, i) => setTimeout(() => this._tone(n, 0.3, 'sawtooth', 0.2), i * 180));
  }
}
