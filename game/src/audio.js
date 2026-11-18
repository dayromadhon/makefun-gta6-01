// Synthesized sound, all WebAudio, no audio files. Engine hum, sirens, gunshots,
// punches, UI blips and mission stings. The context is created on the first
// user gesture; everything is a no-op until then.

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.engineFilter = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
  }

  /** Create the context. Call from a user gesture (click / keypress). */
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
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    } catch {
      this.ctx = null;
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.value = m ? 0 : 0.5;
  }

  /** A short tone. freq in Hz, dur in seconds, type, gain 0..1. */
  blip(freq, dur = 0.08, type = 'sine', gain = 0.2, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  /** A burst of filtered noise (gunshot, punch, crash, skid). */
  noise(dur = 0.15, gain = 0.3, freq = 1200, type = 'lowpass') {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    src.start(t);
  }

  gunshot() {
    this.noise(0.12, 0.5, 900, 'lowpass');
    this.blip(180, 0.06, 'square', 0.12, 60);
  }

  punch() {
    this.noise(0.08, 0.3, 400, 'lowpass');
  }

  crash() {
    this.noise(0.25, 0.4, 500, 'lowpass');
  }

  click() {
    this.blip(660, 0.05, 'sine', 0.15);
  }

  missionDone() {
    if (!this.ctx || this.muted) return;
    [523, 659, 784, 1047].forEach((f, i) => {
      setTimeout(() => this.blip(f, 0.18, 'triangle', 0.22), i * 90);
    });
  }

  busted() {
    this.blip(220, 0.5, 'sawtooth', 0.2, 110);
  }

  /** Continuous engine hum; call every frame with speed 0..1 and whether driving. */
  engine(speed, driving) {
    if (!this.ctx || this.muted) {
      this._stopEngine();
      return;
    }
    if (!driving) {
      this._stopEngine();
      return;
    }
    const t = this.ctx.currentTime;
    if (!this.engineOsc) {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineFilter = this.ctx.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 420;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0.0;
      this.engineOsc.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
    }
    const target = 40 + speed * 130;
    this.engineOsc.frequency.setTargetAtTime(target, t, 0.08);
    this.engineGain.gain.setTargetAtTime(0.05 + speed * 0.05, t, 0.1);
  }

  _stopEngine() {
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    }
  }

  /** Two-tone police siren while any police car is near. */
  siren(on) {
    if (!this.ctx || this.muted || !on) {
      if (this.sirenGain && this.ctx) this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1);
      return;
    }
    if (!this.sirenOsc) {
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'triangle';
      this.sirenOsc.frequency.value = 700;
      this.sirenLfo = this.ctx.createOscillator();
      this.sirenLfo.type = 'square';
      this.sirenLfo.frequency.value = 0.8;
      const lfoGain = this.ctx.createGain();
      lfoGain.gain.value = 220;
      this.sirenLfo.connect(lfoGain);
      lfoGain.connect(this.sirenOsc.frequency);
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0.0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.sirenLfo.start();
    }
    this.sirenGain.gain.setTargetAtTime(0.045, this.ctx.currentTime, 0.2);
  }
}
