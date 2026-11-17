// Solmar Heat — synthesized sound. One job: every sound the game makes,
// built with WebAudio oscillators and noise, no audio files, no network.
export class AudioSys {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenPhase = 0;
    this.enabled = true;
    this.started = false;
  }

  // Must be called from a user gesture at least once; safe to call often.
  ensure() {
    if (this.started) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
      // Engine hum: a low sawtooth whose pitch follows the car.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const filt = this.ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 420;
      this.engineOsc.connect(filt);
      filt.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Police siren: a sine that alternates between two notes.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
      this.started = true;
    } catch {
      this.ctx = null;
    }
  }

  // speed01: 0..1 of top speed. inCar: whether the engine should be heard.
  engine(speed01, inCar) {
    if (!this.started || !this.engineGain) return;
    const target = inCar ? 0.05 + speed01 * 0.075 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(52 + speed01 * 130, this.ctx.currentTime, 0.08);
  }

  // wanted: current star count; dt seconds since last frame.
  siren(wanted, dt) {
    if (!this.started || !this.sirenGain) return;
    if (wanted <= 0) {
      this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.2);
      return;
    }
    this.sirenPhase += dt;
    const note = Math.floor(this.sirenPhase * 1.6) % 2 === 0 ? 660 : 880;
    this.sirenOsc.frequency.setTargetAtTime(note, this.ctx.currentTime, 0.05);
    this.sirenGain.gain.setTargetAtTime(0.035, this.ctx.currentTime, 0.2);
  }

  blip(freq = 660, dur = 0.07, vol = 0.12) {
    if (!this.started) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g);
    g.connect(this.master);
    o.start();
    o.stop(this.ctx.currentTime + dur + 0.02);
  }

  gunshot() {
    if (!this.started) return;
    const len = Math.floor(this.ctx.sampleRate * 0.14);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2);
    }
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = 0.5;
    src.connect(g);
    g.connect(this.master);
    src.start();
  }

  punch() {
    this.blip(180, 0.06, 0.2);
  }

  cash() {
    this.blip(880, 0.08, 0.14);
    setTimeout(() => this.blip(1320, 0.1, 0.14), 90);
  }
}
