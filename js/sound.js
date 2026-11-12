// Synthesized sound effects (WebAudio, no audio files) and the stadium music.
const Sound = (() => {
  'use strict';
  let ctx = null, master = null, noise = null;
  let enabled = true;

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

  function noiseBurst(t, { type = 'lowpass', freq = 1000, to, q = 1, peak = 0.3, attack = 0.005, decay = 0.2, out = master }) {
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.Q.value = q;
    f.frequency.setValueAtTime(freq, t);
    if (to) f.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
    const g = ctx.createGain();
    envelope(g.gain, t, peak, attack, decay);
    src.connect(f).connect(g).connect(out);
    src.start(t, Math.random());
    src.stop(t + attack + decay + 0.05);
  }

  function tone(t, { type = 'sine', from = 440, to, peak = 0.2, attack = 0.005, decay = 0.2, vibrato = 0, vibratoRate = 6, out = master }) {
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
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + attack + decay + 0.05);
  }

  function play(fn) {
    return (...args) => {
      if (ready()) fn(ctx.currentTime, ...args);
    };
  }

  // ---------- Stadium music ----------
  // A user-supplied recording in audio/stadyum.mp3 plays if present; otherwise an original
  // drum-and-brass stand march is synthesized.
  const MUSIC_FILE = 'audio/stadyum.mp3';
  const BEAT = 60 / 132;
  const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
  // [midi note, beats]; 8 bars of 4 beats
  const MELODY = [
    [67, 1], [67, 1], [71, 1], [74, 1],
    [76, 1], [74, 1], [71, 2],
    [72, 1], [72, 1], [76, 1], [79, 1],
    [78, 1], [76, 1], [74, 2],
    [67, 1], [67, 1], [71, 1], [74, 1],
    [76, 1], [79, 1], [76, 1], [74, 1],
    [72, 1], [76, 1], [74, 1], [71, 0.5], [69, 0.5],
    [67, 3], [0, 1],
  ];
  const BASS = [43, 43, 48, 50, 43, 48, 50, 43];
  let music = null;

  function scheduleBar(m, bar, t) {
    const out = m.bus;
    tone(t, { type: 'triangle', from: midi(BASS[bar % 8]), peak: 0.22, attack: 0.01, decay: BEAT * 1.8, out });
    tone(t + BEAT * 2, { type: 'triangle', from: midi(BASS[bar % 8]), peak: 0.2, attack: 0.01, decay: BEAT * 1.8, out });
    for (let b = 0; b < 4; b++) {
      const bt = t + b * BEAT;
      if (b % 2 === 0) tone(bt, { from: 85, to: 45, peak: 0.55, decay: 0.22, out });
      else noiseBurst(bt, { type: 'highpass', freq: 2500, peak: 0.12, decay: 0.07, out });
      noiseBurst(bt + BEAT / 2, { type: 'highpass', freq: 6000, peak: 0.04, decay: 0.03, out });
    }
    if (bar % 8 === 7) for (let k = 0; k < 4; k++) tone(t + BEAT * 3 + k * BEAT / 4, { from: 110, to: 60, peak: 0.35, decay: 0.1, out });
  }

  function scheduleMelody(m, t) {
    let at = t;
    for (const [n, beats] of MELODY) {
      if (n) {
        const dur = beats * BEAT * 0.9;
        tone(at, { type: 'square', from: midi(n), peak: 0.07, attack: 0.02, decay: dur, vibrato: 3, vibratoRate: 5.5, out: m.lead });
        tone(at, { type: 'sawtooth', from: midi(n - 12), peak: 0.04, attack: 0.02, decay: dur, out: m.lead });
      }
      at += beats * BEAT;
    }
  }

  function startSynthMarch() {
    const bus = ctx.createGain();
    bus.gain.value = 0.9;
    bus.connect(master);
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 2600;
    lowpass.connect(bus);
    const m = { bus, lead: lowpass, nextBar: ctx.currentTime + 0.1, bar: 0, timer: 0 };
    m.timer = setInterval(() => {
      while (m.nextBar < ctx.currentTime + 1.0) {
        if (m.bar % 8 === 0) scheduleMelody(m, m.nextBar);
        scheduleBar(m, m.bar, m.nextBar);
        m.nextBar += BEAT * 4;
        m.bar++;
      }
    }, 200);
    return () => {
      clearInterval(m.timer);
      bus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2);
      setTimeout(() => bus.disconnect(), 1500);
    };
  }

  function musicStart() {
    if (!ready() || music) return;
    const audio = new Audio(MUSIC_FILE);
    audio.loop = true;
    audio.volume = 0.85;
    music = { stop: () => audio.pause() };
    let fellBack = false;
    const fallBack = () => {
      if (fellBack || !music) return;
      fellBack = true;
      audio.pause();
      music.stop = startSynthMarch();
    };
    audio.addEventListener('error', fallBack);
    const p = audio.play();
    if (p && p.catch) p.catch(fallBack);
  }

  function musicStop() {
    if (!music) return;
    music.stop();
    music = null;
  }

  return {
    ensure,
    musicStart,
    musicStop,
    setEnabled(v) {
      enabled = v;
      if (!v) musicStop();
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
    growl: play((t, pitch = 1) => {
      tone(t, { type: 'sawtooth', from: 110 * pitch, to: 80 * pitch, peak: 0.12, attack: 0.03, decay: 0.35, vibrato: 18, vibratoRate: 30 });
    }),
    beastDie: play((t, pitch = 1) => {
      tone(t, { type: 'sine', from: 900 * pitch, to: 400 * pitch, peak: 0.12, attack: 0.01, decay: 0.45 });
    }),
    roar: play((t, pitch = 1) => {
      tone(t, { type: 'sawtooth', from: 90 * pitch, to: 55 * pitch, peak: 0.35, attack: 0.15, decay: 1.6, vibrato: 14, vibratoRate: 22 });
      tone(t, { type: 'sawtooth', from: 135 * pitch, to: 70 * pitch, peak: 0.2, attack: 0.15, decay: 1.5, vibrato: 10, vibratoRate: 17 });
      noiseBurst(t, { freq: 600 * pitch, to: 250 * pitch, peak: 0.35, attack: 0.15, decay: 1.5 });
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
    fireball: play((t) => {
      noiseBurst(t, { type: 'bandpass', freq: 300, to: 1200, q: 0.8, peak: 0.35, attack: 0.03, decay: 0.5 });
    }),
    breath: play((t) => {
      noiseBurst(t, { freq: 900, to: 400, q: 0.5, peak: 0.55, attack: 0.1, decay: 1.4 });
    }),
    flap: play((t) => {
      noiseBurst(t, { freq: 250, peak: 0.25, attack: 0.05, decay: 0.25 });
    }),
    whistle: play((t) => {
      tone(t, { type: 'sine', from: 2900, peak: 0.12, attack: 0.02, decay: 0.25, vibrato: 90, vibratoRate: 30 });
      tone(t + 0.35, { type: 'sine', from: 2900, peak: 0.12, attack: 0.02, decay: 0.6, vibrato: 90, vibratoRate: 30 });
    }),
    splat: play((t) => {
      noiseBurst(t, { freq: 900, to: 200, q: 2, peak: 0.45, decay: 0.15 });
      tone(t, { from: 180, to: 70, peak: 0.25, decay: 0.1 });
    }),
    ouch: play((t) => {
      tone(t, { type: 'triangle', from: 520, to: 260, peak: 0.12, attack: 0.02, decay: 0.3, vibrato: 20, vibratoRate: 9 });
    }),
    rifle: play((t) => {
      noiseBurst(t, { type: 'bandpass', freq: 1800, q: 0.6, peak: 0.32, decay: 0.07 });
      tone(t, { from: 160, to: 60, peak: 0.3, decay: 0.08 });
    }),
    pistol: play((t) => {
      noiseBurst(t, { freq: 3200, to: 500, peak: 0.5, decay: 0.2 });
      tone(t, { from: 210, to: 50, peak: 0.45, decay: 0.16 });
    }),
    empty: play((t) => {
      tone(t, { type: 'square', from: 1400, peak: 0.06, decay: 0.03 });
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
    firework: play((t) => {
      noiseBurst(t, { freq: 1800, to: 200, peak: 0.18, decay: 0.6 });
    }),
  };
})();
