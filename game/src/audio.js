// All sound is synthesised in code with WebAudio — no audio files, no network. Engine
// hum, skids, sirens, gunshots, punches, pickups and a low procedural music bed. The
// context starts on the first user gesture; everything is a no-op before that.

export function createAudio() {
  let context = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let muted = false;
  let musicTimer = null;
  let musicStep = 0;

  // A simple sun-soaked bass line (A minor pentatonic walk) over a soft pad.
  const BASS_LINE = [55, 0, 65.41, 0, 49, 0, 58.27, 0, 55, 0, 65.41, 0, 73.42, 82.41, 65.41, 0];
  const STEP_SECONDS = 0.24;

  function ensure() {
    if (context) return true;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.5;
      master.connect(context.destination);
      musicGain = context.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      engineOsc = context.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 55;
      engineGain = context.createGain();
      engineGain.gain.value = 0;
      const engineFilter = context.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 420;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      sirenOsc = context.createOscillator();
      sirenOsc.type = 'sine';
      sirenOsc.frequency.value = 700;
      sirenGain = context.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      return true;
    } catch {
      context = null;
      return false;
    }
  }

  function tone(freq, seconds, type, volume, when = 0, slideTo = 0) {
    if (!ensure()) return;
    const start = context.currentTime + when;
    const osc = context.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo > 0) osc.frequency.exponentialRampToValueAtTime(slideTo, start + seconds);
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + seconds + 0.05);
  }

  function noise(seconds, volume, filterFreq, when = 0) {
    if (!ensure()) return;
    const start = context.currentTime + when;
    const length = Math.max(1, Math.floor(context.sampleRate * seconds));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  function musicBeat() {
    if (!context || muted) return;
    const freq = BASS_LINE[musicStep % BASS_LINE.length];
    musicStep += 1;
    if (freq > 0) {
      const osc = context.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const gain = context.createGain();
      const start = context.currentTime;
      gain.gain.setValueAtTime(0.5, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + STEP_SECONDS * 1.8);
      osc.connect(gain);
      gain.connect(musicGain);
      osc.start(start);
      osc.stop(start + STEP_SECONDS * 2);
    }
    if (musicStep % 8 === 0) tone(220, 0.5, 'sine', 0.05);
  }

  return {
    unlock() {
      if (ensure() && context.state === 'suspended') context.resume().catch(() => {});
      if (context && !musicTimer) {
        musicTimer = window.setInterval(musicBeat, STEP_SECONDS * 1000);
      }
    },
    setMuted(value) {
      muted = value;
      if (master) master.gain.value = value ? 0 : 0.5;
    },
    isMuted() {
      return muted;
    },
    setEngine(ratio, on) {
      if (!context || !engineOsc) return;
      const target = on ? 0.05 + ratio * 0.075 : 0;
      engineGain.gain.setTargetAtTime(target, context.currentTime, 0.08);
      engineOsc.frequency.setTargetAtTime(52 + ratio * 130, context.currentTime, 0.06);
    },
    setSiren(on, near) {
      if (!context || !sirenOsc) return;
      const now = context.currentTime;
      sirenGain.gain.setTargetAtTime(on ? 0.028 + near * 0.02 : 0, now, 0.2);
      if (on) {
        const phase = (now * 1.6) % 2;
        sirenOsc.frequency.setTargetAtTime(phase < 1 ? 720 : 960, now, 0.05);
      }
    },
    skid() {
      noise(0.18, 0.1, 900);
    },
    crash(strength) {
      noise(0.3, 0.12 + strength * 0.25, 500);
      tone(70, 0.25, 'sine', 0.3, 0, 40);
    },
    gunshot() {
      noise(0.14, 0.5, 2600);
      tone(180, 0.1, 'square', 0.2, 0, 60);
    },
    punch() {
      noise(0.1, 0.3, 300);
      tone(120, 0.12, 'sine', 0.35, 0, 55);
    },
    pickup() {
      tone(660, 0.09, 'sine', 0.25);
      tone(880, 0.12, 'sine', 0.25, 0.09);
    },
    missionDone() {
      tone(523, 0.14, 'triangle', 0.3);
      tone(659, 0.14, 'triangle', 0.3, 0.13);
      tone(784, 0.22, 'triangle', 0.3, 0.26);
      tone(1047, 0.3, 'triangle', 0.28, 0.39);
    },
    missionFail() {
      tone(392, 0.2, 'triangle', 0.25);
      tone(311, 0.3, 'triangle', 0.25, 0.18);
    },
    wantedUp() {
      tone(440, 0.12, 'square', 0.14);
      tone(440, 0.12, 'square', 0.14, 0.14);
    },
    click() {
      tone(900, 0.05, 'sine', 0.15);
    },
  };
}
