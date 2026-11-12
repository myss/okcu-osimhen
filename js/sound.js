// Synthesized sound effects (WebAudio, no audio files) and the stadium music (cimbom.js).
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

  // ---------- Stadium music: plays CIMBOM_SONG (cimbom.js) ----------
  // The instruments its parts use, as in kaplan-macerasi: a layer is a browser wave or a mix of
  // harmonics; a layer with `sustain` rises over `attack`, falls toward `sustain` over `decay` while
  // held, then fades over `release`.
  const INSTRUMENTS = {
    square: { layers: [{ wave: 'square' }] },
    noise: { noise: true },
    piano: {
      layers: [
        { harmonics: [1, 0.7, 0.45, 0.3, 0.2, 0.14, 0.1, 0.07, 0.05], gain: 0.45, attack: 0.004, decay: 0.35, sustain: 0, release: 0.15 },
        { harmonics: [1, 0.35, 0.12, 0.05], gain: 0.6, attack: 0.004, decay: 1.8, sustain: 0, release: 0.25 },
        { harmonics: [1, 0.35, 0.12, 0.05], detune: 4, gain: 0.25, attack: 0.004, decay: 1.6, sustain: 0, release: 0.25 },
      ],
    },
  };
  const MUSIC_VOLUME = 0.9;
  const NOTE_OFFSETS = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  let music = null;
  const periodicWaves = new Map();

  function noteFrequency(name) {
    const [, letter, accidental, octave] = name.match(/^([A-G])([#b]?)(\d)$/);
    const midi = 12 * (Number(octave) + 1) + NOTE_OFFSETS[letter] + (accidental === '#' ? 1 : accidental === 'b' ? -1 : 0);
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // Each step's notes, per part.
  function parseSong(song) {
    return song.parts.map(({ instrument, volume, notes }) => {
      const slots = Array.from({ length: song.length }, () => []);
      for (const [start, steps, name] of notes) {
        if (start < song.length) slots[start].push({ frequency: name && noteFrequency(name), steps });
      }
      return { instrument: INSTRUMENTS[instrument], volume, slots };
    });
  }

  function periodicWave(harmonics) {
    const key = harmonics.join(',');
    if (!periodicWaves.has(key)) {
      const imag = new Float32Array([0, ...harmonics]);
      periodicWaves.set(key, ctx.createPeriodicWave(new Float32Array(imag.length), imag));
    }
    return periodicWaves.get(key);
  }

  function playNote(instrument, frequency, held, volume, start, out) {
    for (const layer of instrument.layers) {
      const o = ctx.createOscillator();
      if (layer.harmonics) o.setPeriodicWave(periodicWave(layer.harmonics));
      else o.type = layer.wave;
      o.frequency.value = frequency;
      o.detune.value = layer.detune || 0;
      const peak = volume * (layer.gain || 1);
      const g = ctx.createGain();
      let end = start + held;
      if (layer.sustain === undefined) {
        g.gain.setValueAtTime(0.0001, start);
        g.gain.linearRampToValueAtTime(peak, start + Math.min(0.01, held / 4));
        g.gain.exponentialRampToValueAtTime(0.0001, end);
      } else {
        const peakTime = start + layer.attack;
        g.gain.setValueAtTime(0.0001, start);
        g.gain.linearRampToValueAtTime(peak, peakTime);
        g.gain.setTargetAtTime(peak * layer.sustain, peakTime, Math.max(layer.decay, 0.001) / 3);
        const letGo = Math.max(end, peakTime);
        g.gain.setTargetAtTime(0, letGo, Math.max(layer.release, 0.001) / 4);
        end = letGo + layer.release;
      }
      o.connect(g).connect(out);
      o.start(start);
      o.stop(end + 0.02);
    }
  }

  function musicStart() {
    if (!ready() || music) return;
    const bus = ctx.createGain();
    bus.gain.value = MUSIC_VOLUME;
    bus.connect(master);
    const parts = parseSong(CIMBOM_SONG);
    const stepSeconds = 30 / CIMBOM_SONG.bpm;
    let step = 0, next = ctx.currentTime + 0.1;
    const timer = setInterval(() => {
      while (next < ctx.currentTime + 0.25) {
        for (const { instrument, volume, slots } of parts) {
          for (const { frequency, steps } of slots[step % slots.length]) {
            if (instrument.noise || !frequency) noiseBurst(next, { type: 'bandpass', freq: 6000, peak: volume, attack: 0.005, decay: 0.045, out: bus });
            else playNote(instrument, frequency, steps * stepSeconds * 0.95, volume, next, bus);
          }
        }
        step++;
        next += stepSeconds;
      }
    }, 50);
    music = {
      stop() {
        clearInterval(timer);
        bus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2);
        setTimeout(() => bus.disconnect(), 1500);
      },
    };
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
