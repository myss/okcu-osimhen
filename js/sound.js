// Synthesized sound effects (WebAudio, no audio files).
const Sound = (() => {
  'use strict';
  let ctx = null, master = null, noise = null, applause = null;
  let enabled = true;
  let crowd = null;

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
  }

  const ready = () => enabled && ctx;

  function envelope(param, t, peak, attack, decay) {
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(peak, t + attack);
    param.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  function noiseBurst(t, { type = 'lowpass', freq = 1000, to, q = 1, peak = 0.3, attack = 0.005, decay = 0.2 }) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
    const g = ctx.createGain();
    envelope(g.gain, t, peak, attack, decay);
    src.connect(f).connect(g).connect(master);
    src.start(t, Math.random());
    src.stop(t + attack + decay + 0.05);
  }

  function tone(t, { type = 'sine', from = 440, to, peak = 0.2, attack = 0.005, decay = 0.2, vibrato = 0, vibratoRate = 6 }) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(from, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
    if (vibrato) {
      const lfo = ctx.createOscillator();
      const lg = ctx.createGain();
      lfo.frequency.value = vibratoRate;
      lg.gain.value = vibrato;
      lfo.connect(lg).connect(o.frequency);
      lfo.start(t);
      lfo.stop(t + attack + decay + 0.05);
    }
    const g = ctx.createGain();
    envelope(g.gain, t, peak, attack, decay);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  function play(fn) {
    return (...args) => {
      if (ready()) fn(ctx.currentTime, ...args);
    };
  }

  function makeApplause() {
    const len = ctx.sampleRate * 4;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let c = 0; c < 2600; c++) {
      const start = Math.floor(Math.random() * len);
      const dur = Math.floor(ctx.sampleRate * (0.008 + Math.random() * 0.012));
      const amp = 0.15 + Math.random() * 0.25;
      for (let i = 0; i < dur; i++) d[(start + i) % len] += (Math.random() * 2 - 1) * amp * (1 - i / dur);
    }
    return buf;
  }

  return {
    ensure,
    setEnabled(v) {
      enabled = v;
      if (!v) this.crowdStop();
    },
    twang: play((t) => {
      tone(t, { type: 'triangle', from: 260, to: 80, peak: 0.35, decay: 0.28 });
      noiseBurst(t, { type: 'bandpass', freq: 2400, q: 0.8, peak: 0.2, decay: 0.07 });
    }),
    thunk: play((t) => {
      noiseBurst(t, { freq: 700, peak: 0.6, decay: 0.14 });
      tone(t, { from: 120, to: 50, peak: 0.4, decay: 0.15 });
    }),
    wood: play((t) => {
      noiseBurst(t, { type: 'bandpass', freq: 900, q: 2, peak: 0.35, decay: 0.1 });
    }),
    screech: play((t) => {
      tone(t, { type: 'square', from: 900 + Math.random() * 300, to: 1500, peak: 0.07, attack: 0.02, decay: 0.3, vibrato: 120, vibratoRate: 28 });
    }),
    monkeyDie: play((t) => {
      tone(t, { type: 'square', from: 1300, to: 300, peak: 0.07, decay: 0.35, vibrato: 60, vibratoRate: 20 });
    }),
    howl: play((t) => {
      tone(t, { type: 'sine', from: 380, to: 720, peak: 0.18, attack: 0.5, decay: 0.6, vibrato: 10, vibratoRate: 5 });
      tone(t + 1.0, { type: 'sine', from: 720, to: 420, peak: 0.16, attack: 0.1, decay: 1.4, vibrato: 12, vibratoRate: 5 });
    }),
    growl: play((t) => {
      tone(t, { type: 'sawtooth', from: 110, to: 80, peak: 0.12, attack: 0.03, decay: 0.35, vibrato: 18, vibratoRate: 30 });
    }),
    wolfDie: play((t) => {
      tone(t, { type: 'sine', from: 900, to: 400, peak: 0.12, attack: 0.01, decay: 0.45 });
    }),
    roar: play((t) => {
      tone(t, { type: 'sawtooth', from: 90, to: 55, peak: 0.35, attack: 0.15, decay: 1.6, vibrato: 14, vibratoRate: 22 });
      tone(t, { type: 'sawtooth', from: 135, to: 70, peak: 0.2, attack: 0.15, decay: 1.5, vibrato: 10, vibratoRate: 17 });
      noiseBurst(t, { freq: 600, to: 250, peak: 0.35, attack: 0.15, decay: 1.5 });
    }),
    chestBeat: play((t) => {
      for (let i = 0; i < 6; i++) tone(t + i * 0.17, { from: 95, to: 50, peak: 0.55, decay: 0.14 });
    }),
    slam: play((t) => {
      noiseBurst(t, { freq: 300, to: 60, peak: 0.9, decay: 0.6 });
      tone(t, { from: 70, to: 30, peak: 0.7, decay: 0.5 });
    }),
    throwRock: play((t) => {
      noiseBurst(t, { type: 'bandpass', freq: 500, to: 1500, q: 1.5, peak: 0.2, attack: 0.05, decay: 0.3 });
    }),
    launch: play((t) => {
      noiseBurst(t, { type: 'bandpass', freq: 400, to: 2500, q: 0.7, peak: 0.5, attack: 0.01, decay: 0.45 });
      tone(t, { from: 160, to: 60, peak: 0.4, decay: 0.2 });
    }),
    explosion: play((t) => {
      noiseBurst(t, { freq: 1600, to: 80, peak: 1.0, attack: 0.005, decay: 1.2 });
      tone(t, { from: 90, to: 25, peak: 0.8, decay: 0.8 });
    }),
    hurt: play((t) => {
      tone(t, { type: 'square', from: 220, to: 110, peak: 0.12, decay: 0.18 });
    }),
    pickup: play((t) => {
      [523, 659, 784, 1047].forEach((f, i) => tone(t + i * 0.07, { type: 'triangle', from: f, peak: 0.18, decay: 0.25 }));
    }),
    eat: play((t) => {
      tone(t, { type: 'triangle', from: 600, to: 900, peak: 0.15, decay: 0.12 });
      tone(t + 0.1, { type: 'triangle', from: 800, to: 1200, peak: 0.15, decay: 0.15 });
    }),
    creak: play((t) => {
      tone(t, { type: 'sawtooth', from: 70, to: 110, peak: 0.12, attack: 0.3, decay: 1.6, vibrato: 25, vibratoRate: 13 });
    }),
    crowdStart() {
      if (!ready() || crowd) return;
      if (!applause) applause = makeApplause();
      const t = ctx.currentTime;
      const src = ctx.createBufferSource();
      src.buffer = applause;
      src.loop = true;
      const roarSrc = ctx.createBufferSource();
      roarSrc.buffer = noise;
      roarSrc.loop = true;
      const roarFilter = ctx.createBiquadFilter();
      roarFilter.type = 'bandpass';
      roarFilter.frequency.value = 550;
      roarFilter.Q.value = 0.6;
      const roarGain = ctx.createGain();
      roarGain.gain.setValueAtTime(0.0001, t);
      roarGain.gain.exponentialRampToValueAtTime(0.35, t + 1.5);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.9, t + 1.0);
      src.connect(g).connect(master);
      roarSrc.connect(roarFilter).connect(roarGain).connect(master);
      src.start(t);
      roarSrc.start(t);
      crowd = { src, roarSrc, g, roarGain };
    },
    crowdStop() {
      if (!crowd || !ctx) return;
      const t = ctx.currentTime;
      crowd.g.gain.setTargetAtTime(0.0001, t, 0.3);
      crowd.roarGain.gain.setTargetAtTime(0.0001, t, 0.3);
      crowd.src.stop(t + 1.5);
      crowd.roarSrc.stop(t + 1.5);
      crowd = null;
    },
    firework: play((t) => {
      noiseBurst(t, { freq: 2500, to: 200, peak: 0.35, decay: 0.7 });
    }),
  };
})();
