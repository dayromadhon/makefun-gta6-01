// SOLMAR HEAT — synthesized sound. Every sound is built with WebAudio
// oscillators and noise, so the game ships no audio files at all.

export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.muted = false;
    this._unlocked = false;
  }

  // Browsers need a user gesture before audio starts; call from any click/key.
  unlock() {
    if (this._unlocked) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this._unlocked = true;
    } catch {
      this.ctx = null;
    }
  }

  _tone(freq, dur, type = 'sine', vol = 0.25, slideTo = null, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo !== null) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  _noise(dur, vol = 0.3, filterFreq = 1200, delay = 0) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f);
    f.connect(g);
    g.connect(this.master);
    src.start(t0);
  }

  uiClick() {
    this._tone(660, 0.07, 'square', 0.12);
  }
  pickup() {
    this._tone(523, 0.09, 'sine', 0.22);
    this._tone(784, 0.12, 'sine', 0.22, null, 0.08);
  }
  cash() {
    this._tone(880, 0.08, 'triangle', 0.25);
    this._tone(1174, 0.1, 'triangle', 0.25, null, 0.07);
    this._tone(1568, 0.16, 'triangle', 0.22, null, 0.14);
  }
  gunshot() {
    this._noise(0.16, 0.5, 2600);
    this._tone(160, 0.1, 'square', 0.2, 60);
  }
  punch() {
    this._noise(0.09, 0.3, 500);
  }
  crash() {
    this._noise(0.35, 0.45, 700);
    this._tone(90, 0.3, 'sawtooth', 0.2, 40);
  }
  busted() {
    this._tone(392, 0.25, 'sawtooth', 0.22);
    this._tone(311, 0.4, 'sawtooth', 0.22, null, 0.22);
  }
  missionDone() {
    [523, 659, 784, 1046].forEach((f, i) => this._tone(f, 0.14, 'triangle', 0.22, null, i * 0.09));
  }
  // Continuous engine hum; call with speed 0..1 (0 = off).
  engine(speed) {
    if (!this.ctx || this.muted) return;
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineGain = this.ctx.createGain();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain.gain.value = 0;
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 420;
      this.engineOsc.connect(f);
      f.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    const target = speed <= 0.01 ? 0 : 0.05 + speed * 0.09;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(55 + speed * 130, this.ctx.currentTime, 0.1);
  }
  // Police siren; on = true while wanted >= 1.
  siren(on) {
    if (!this.ctx || this.muted) return;
    if (on && !this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenGain = this.ctx.createGain();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain.gain.value = 0.045;
      const lfo = this.ctx.createOscillator();
      const lfoGain = this.ctx.createGain();
      lfo.frequency.value = 0.7;
      lfoGain.gain.value = 260;
      lfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      lfo.start();
      this._sirenLfo = lfo;
    } else if (!on && this.sirenOsc) {
      try {
        this.sirenOsc.stop();
        this._sirenLfo.stop();
      } catch {}
      this.sirenOsc = null;
      this._sirenLfo = null;
    }
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }
}
