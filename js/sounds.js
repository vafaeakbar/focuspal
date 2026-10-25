/*
 * Procedural sound builders. Each builder is `(kit, out, options) => void`
 * and wires a self-running soundscape into `out`.
 */
(function () {
  'use strict';
  const FP = window.FP;
  const { rand, pick, mtof } = FP;
  const S = (FP.sounds = {});

  // ---------- Beds & textures ----------

  S.roomTone = (k, out, { lp = 300, level = 0.5, air = 0.05 } = {}) => {
    const g = k.gain(level);
    k.chain(k.noise('brown'), k.filter('lowpass', lp), g, out);
    k.lfo(g.gain, 0.05, level * 0.12);
    if (air) k.chain(k.noise('pink'), k.filter('bandpass', 900, 0.5), k.gain(air), out);
  };

  S.hvac = (k, out) => {
    k.chain(k.noise('brown'), k.filter('lowpass', 450), k.gain(0.55), out);
    k.chain(k.noise('pink'), k.filter('bandpass', 1100, 0.6), k.gain(0.06), out);
    k.chain(k.osc('sine', 120), k.gain(0.01), out);
    k.chain(k.osc('sine', 240), k.gain(0.003), out);
  };

  S.wind = (k, out, { lo = 300, hi = 1100, Q = 0.7, level = 1, rate = 0.06, filter = 'lowpass', type = 'pink' } = {}) => {
    const mid = (lo + hi) / 2;
    const f = k.filter(filter, mid, Q);
    const g = k.gain(level * 0.6);
    k.chain(k.noise(type), f, g, out);
    k.lfo(f.frequency, rate, (hi - lo) / 2);
    k.lfo(g.gain, rate * 1.37, level * 0.3);
    k.every(5000, 12000, () => {
      const t = k.now();
      f.frequency.setTargetAtTime(hi * rand(0.9, 1.3), t, 1.2);
      f.frequency.setTargetAtTime(mid, t + rand(2, 4), 1.6);
    });
  };

  S.rain = (k, out, { intensity = 1, lp = 7000, drops = true } = {}) => {
    const bus = k.gain(1);
    bus.connect(out);
    k.chain(k.noise('pink'), k.filter('highpass', 400), k.filter('lowpass', lp, 0.5), k.gain(0.55 * intensity), bus);
    k.chain(k.noise('white'), k.filter('bandpass', 2800, 0.4), k.gain(0.1 * intensity), bus);
    k.chain(k.noise('brown'), k.filter('lowpass', 250), k.gain(0.25 * intensity), bus);
    if (drops) {
      k.every(15, 60, () => k.burst({
        decay: rand(0.005, 0.02), gain: rand(0.02, 0.07) * intensity,
        filter: 'bandpass', freq: rand(1500, Math.min(6000, lp)), Q: 2, pan: rand(-1, 1), dest: bus,
      }));
    }
  };

  S.windowDrops = (k, out) => {
    k.every(120, 900, () => {
      const f = rand(700, 1800);
      const p = rand(-0.8, 0.8);
      k.tone({ freq: f * 1.6, to: f, glide: 0.03, attack: 0.001, decay: rand(0.03, 0.08), gain: rand(0.02, 0.06), pan: p });
      k.burst({ decay: 0.012, gain: rand(0.03, 0.08), filter: 'bandpass', freq: f * 2, Q: 3, pan: p });
    });
    // A gutter drip that keeps a slow, irregular rhythm.
    k.every(900, 1600, () => {
      const f = rand(1000, 1200);
      k.tone({ freq: f * 1.4, to: f, glide: 0.02, attack: 0.001, decay: 0.09, gain: 0.05, pan: 0.6 });
    });
  };

  S.thunder = (k, out) => {
    const strike = () => {
      if (out.gain.value < 0.02) return;
      const delay = rand(0.5, 3);
      FP.emit('thunder', { delay });
      const dur = rand(5, 9);
      const t = k.now() + delay;
      const src = k.noiseSource('brown');
      const lp = k.filter('lowpass', rand(140, 260), 0.8);
      const g = k.gain(0);
      src.connect(lp).connect(g).connect(out);
      const peak = rand(0.5, 1);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + rand(0.08, 0.6));
      for (let tt = t + 0.6; tt < t + dur - 1; tt += rand(0.25, 0.8)) {
        g.gain.linearRampToValueAtTime(peak * rand(0.3, 0.95), tt);
      }
      g.gain.linearRampToValueAtTime(0, t + dur);
      lp.frequency.setTargetAtTime(90, t + 1, dur / 3);
      src.start(t, rand(0, 4));
      src.stop(t + dur + 0.1);
      if (delay < 1.2) {
        k.burst({ type: 'white', when: delay, attack: 0.004, decay: 0.7, gain: 0.25, filter: 'lowpass', freq: 2000, to: 250 });
      }
    };
    k.every(25000, 65000, strike, 7000);
  };

  S.water = (k, out, { bubbles = true, lp = 4000, level = 1 } = {}) => {
    const bus = k.gain(level);
    bus.connect(out);
    k.chain(k.noise('pink'), k.filter('lowpass', lp, 0.5), k.gain(0.35), bus);
    const bp = k.filter('bandpass', 1400, 0.8);
    k.chain(k.noise('white'), bp, k.gain(0.12), bus);
    k.lfo(bp.frequency, 0.3, 300);
    if (bubbles) {
      k.every(15, 70, () => {
        const f = rand(500, 1600);
        k.tone({ freq: f, to: f * rand(1.4, 2.2), glide: 0.03, attack: 0.002, decay: rand(0.02, 0.05), gain: rand(0.01, 0.035), pan: rand(-0.6, 0.6), dest: bus });
      });
    }
  };

  S.waves = (k, out) => {
    const bus = k.gain(1);
    bus.connect(out);
    k.chain(k.noise('brown'), k.filter('lowpass', 350), k.gain(0.35), bus);
    const wave = () => {
      const t = k.now();
      const rise = rand(2, 3.5);
      const fall = rand(3.5, 6);
      const peak = rand(0.35, 0.7);
      const src = k.noiseSource('pink');
      const f = k.filter('lowpass', 300, 0.5);
      const g = k.gain(0);
      src.connect(f).connect(g).connect(k.pan(rand(-0.4, 0.4))).connect(bus);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + rise);
      g.gain.setTargetAtTime(0, t + rise, fall / 3.5);
      f.frequency.setValueAtTime(300, t);
      f.frequency.exponentialRampToValueAtTime(rand(2000, 3500), t + rise);
      f.frequency.exponentialRampToValueAtTime(400, t + rise + fall);
      src.start(t, rand(0, 4));
      src.stop(t + rise + fall + 1.5);
      // Foam fizzing as the wave breaks and draws back.
      k.burst({ when: rise * 0.85, attack: 0.4, decay: fall * 0.8, gain: peak * 0.12, filter: 'highpass', freq: 3500, dest: bus });
    };
    k.every(5500, 9500, wave, 200);
  };

  S.fire = (k, out) => {
    const bus = k.gain(1);
    bus.connect(out);
    const roarF = k.filter('lowpass', 500, 0.6);
    const roar = k.gain(0.4);
    k.chain(k.noise('brown'), roarF, roar, bus);
    k.lfo(roar.gain, 0.3, 0.12);
    k.lfo(roarF.frequency, 0.17, 150);
    k.chain(k.noise('pink'), k.filter('bandpass', 1200, 0.5), k.gain(0.04), bus);
    k.every(30, 350, () => {
      const n = Math.random() < 0.3 ? Math.floor(rand(2, 6)) : 1;
      let w = 0;
      for (let i = 0; i < n; i++) {
        k.burst({
          when: w, attack: 0.0005, decay: rand(0.003, 0.02),
          gain: Math.pow(Math.random(), 2.5) * 0.45 + 0.02,
          filter: Math.random() < 0.5 ? 'highpass' : 'bandpass', freq: rand(1200, 5000), Q: rand(0.5, 2),
          pan: rand(-0.5, 0.5), dest: bus,
        });
        w += rand(0.005, 0.05);
      }
    });
    k.every(3000, 9000, () => k.burst({ attack: 0.001, decay: 0.08, gain: 0.3, filter: 'bandpass', freq: rand(400, 900), Q: 1.5, pan: rand(-0.4, 0.4), dest: bus }));
  };

  S.sizzle = (k, out) => {
    const g = k.gain(0.12);
    k.chain(k.noise('white'), k.filter('highpass', 2500), k.filter('lowpass', 9000), g, out);
    k.lfo(g.gain, 0.13, 0.05);
    k.every(10, 60, () => k.burst({ attack: 0.0005, decay: rand(0.002, 0.01), gain: rand(0.01, 0.07), filter: 'highpass', freq: rand(3000, 7000), pan: rand(-0.4, 0.4) }));
    // A fresh order hits the grill.
    k.every(9000, 22000, () => k.burst({ attack: 0.05, hold: rand(1, 2), decay: 1.6, gain: 0.12, filter: 'highpass', freq: 2000 }));
  };

  // ---------- People ----------

  // Real crowd recordings (public domain), looped seamlessly. Optional filters push
  // the crowd further away; if the recording can't load, a soft murmur bed stands in.
  S.crowd = (k, out, { sample, lp, hp, level = 1 } = {}) => {
    const g = k.gain(level);
    const nodes = [g];
    if (hp) nodes.push(k.filter('highpass', hp));
    if (lp) nodes.push(k.filter('lowpass', lp, 0.6));
    nodes.push(out);
    k.chain(...nodes);
    k.loop(sample, { dest: g, onError: () => murmur(k, g) });
  };

  const murmur = (k, out) => {
    const bp = k.filter('bandpass', 500, 0.7);
    const g = k.gain(0.25);
    k.chain(k.noise('pink'), bp, k.filter('lowpass', 1400), g, out);
    k.lfo(g.gain, 0.23, 0.06);
    k.lfo(bp.frequency, 0.11, 120);
  };

  S.typing = (k, out, { typists = 2 } = {}) => {
    const people = Array.from({ length: typists }, () => ({ pan: rand(-0.8, 0.8), tone: rand(0.8, 1.2), level: rand(0.4, 1) }));
    k.every(2500, 9000, () => {
      const p = pick(people);
      const n = Math.floor(rand(8, 45));
      let w = 0;
      for (let i = 0; i < n; i++) {
        const space = Math.random() < 0.17;
        k.burst({ when: w, attack: 0.001, decay: space ? 0.03 : rand(0.012, 0.022), gain: p.level * rand(0.08, 0.16), filter: 'bandpass', freq: (space ? 1600 : rand(2600, 4200)) * p.tone, Q: 1.4, pan: p.pan });
        k.tone({ freq: (space ? 180 : rand(320, 480)) * p.tone, when: w, attack: 0.001, decay: 0.03, gain: p.level * 0.04, pan: p.pan });
        w += Math.random() < 0.08 ? rand(0.3, 0.8) : rand(0.07, 0.19);
      }
      if (Math.random() < 0.4) {
        k.burst({ when: w + rand(0.3, 1), decay: 0.008, gain: p.level * 0.1, filter: 'bandpass', freq: 5000, Q: 2, pan: p.pan });
      }
    });
  };

  S.footsteps = (k, out) => {
    k.every(18000, 45000, () => {
      const n = Math.floor(rand(5, 10));
      const from = Math.random() < 0.5 ? -0.9 : 0.9;
      const step = rand(0.5, 0.62);
      for (let i = 0; i < n; i++) {
        const x = i / (n - 1);
        const pan = from - 2 * from * x;
        const level = Math.max(0.15, Math.sin(Math.PI * (0.1 + 0.8 * x)));
        k.tone({ freq: rand(80, 110), to: 50, glide: 0.1, when: i * step, attack: 0.002, decay: 0.12, gain: 0.12 * level, pan });
        k.burst({ type: 'pink', when: i * step + 0.005, attack: 0.002, decay: 0.05, gain: 0.05 * level, filter: 'lowpass', freq: 900, pan });
      }
    }, 9000);
  };

  // ---------- Objects ----------

  const clink = (k, dest, { lo = 1800, hi = 3600, gain = 0.08, when = 0 } = {}) => {
    const f = rand(lo, hi);
    const p = rand(-0.7, 0.7);
    const g = gain * rand(0.4, 1);
    [[1, 1, 0.5], [2.76, 0.5, 0.3], [5.4, 0.25, 0.18], [8.9, 0.1, 0.1]].forEach(([m, a, d]) => {
      if (f * m > 18000) return;
      k.tone({ freq: f * m, when, gain: g * a, attack: 0.001, decay: d * rand(0.6, 1.2), pan: p, dest });
    });
  };

  S.dishes = (k, out, { lo = 1800, hi = 3600, min = 1500, max = 6000 } = {}) => {
    k.every(min, max, () => {
      clink(k, out, { lo, hi });
      if (Math.random() < 0.35) clink(k, out, { lo, hi, when: rand(0.08, 0.3) });
      // Spoon stirring a cup.
      if (Math.random() < 0.12) {
        const f = rand(3800, 4600);
        for (let i = 0; i < 8; i++) k.tone({ freq: f * rand(0.97, 1.03), when: 0.6 + i * rand(0.11, 0.15), attack: 0.001, decay: 0.08, gain: 0.025, pan: 0.3 });
      }
    });
  };

  S.espresso = (k, out) => {
    k.every(22000, 50000, () => {
      const p = rand(-0.5, 0.5);
      if (Math.random() < 0.5) {
        const d = rand(3, 6);
        k.burst({ attack: 0.3, hold: d, decay: 0.6, gain: 0.07, filter: 'bandpass', freq: 5200, Q: 0.8, to: 3800, pan: p });
        k.burst({ type: 'pink', attack: 0.5, hold: d, decay: 0.5, gain: 0.06, filter: 'bandpass', freq: 900, Q: 2, pan: p });
      } else {
        const d = rand(2.5, 4);
        k.tone({ type: 'sawtooth', freq: 150, attack: 0.15, hold: d, decay: 0.3, gain: 0.02, pan: p, filter: { type: 'lowpass', freq: 900 } });
        k.burst({ attack: 0.15, hold: d, decay: 0.3, gain: 0.06, filter: 'bandpass', freq: 2200, Q: 1.2, pan: p });
        [0, 0.25].forEach((w) => k.burst({ type: 'brown', when: d + 0.8 + w, attack: 0.002, decay: 0.1, gain: 0.2, filter: 'lowpass', freq: 400, pan: p }));
      }
    }, 6000);
  };

  S.clock = (k, out, { level = 1 } = {}) => {
    let next = k.now() + 0.1;
    let odd = false;
    const schedule = () => {
      if (next < k.now()) next = k.now() + 0.05;
      while (next < k.now() + 1.2) {
        const w = next - k.now();
        k.burst({ when: w, attack: 0.0008, decay: 0.018, gain: 0.16 * level, filter: 'bandpass', freq: odd ? 2400 : 3000, Q: 4 });
        k.tone({ freq: odd ? 1100 : 1300, when: w, attack: 0.0005, decay: 0.03, gain: 0.025 * level });
        odd = !odd;
        next += 1;
      }
    };
    schedule();
    k.every(300, 400, schedule);
  };

  S.pages = (k, out) => {
    k.every(5000, 16000, () => {
      const p = rand(-0.7, 0.7);
      const d = rand(0.35, 0.7);
      const g = rand(0.06, 0.12);
      k.burst({ type: 'pink', attack: d * 0.35, decay: d * 0.65, gain: g, filter: 'bandpass', freq: rand(2500, 3500), to: rand(1200, 1800), Q: 0.7, pan: p });
      k.burst({ type: 'white', when: 0.02, attack: 0.01, decay: d * 0.4, gain: g * 0.3, filter: 'highpass', freq: 5000, pan: p });
      if (Math.random() < 0.3) {
        k.burst({ type: 'brown', when: d, attack: 0.003, decay: 0.08, gain: g * 1.5, filter: 'lowpass', freq: 300, pan: p });
      }
    }, 1500);
  };

  // ---------- Nature ----------

  S.birds = (k, out, { min = 1500, max = 5000 } = {}) => {
    const species = [
      (p) => { // chirp series
        const n = Math.floor(rand(2, 6));
        const base = rand(2600, 3800);
        for (let i = 0; i < n; i++) k.tone({ freq: base, to: base * rand(1.2, 1.5), glide: 0.05, when: i * rand(0.09, 0.14), attack: 0.005, decay: 0.07, gain: rand(0.03, 0.06), pan: p });
      },
      (p) => { // whistle
        const b = rand(1800, 2600);
        k.tone({ path: [[0, b], [0.15, b * 1.3], [0.35, b * 0.9]], attack: 0.03, hold: 0.25, decay: 0.1, gain: 0.045, pan: p });
        if (Math.random() < 0.6) k.tone({ path: [[0, b * 1.1], [0.2, b * 0.8]], when: 0.5, attack: 0.02, hold: 0.12, decay: 0.1, gain: 0.035, pan: p });
      },
      (p) => { // trill
        const f = rand(3800, 5200);
        const n = Math.floor(rand(8, 16));
        for (let i = 0; i < n; i++) k.tone({ freq: f * rand(0.97, 1.03), when: i * 0.045, attack: 0.003, decay: 0.03, gain: 0.022, pan: p });
      },
      (p) => { // distant dove
        const f = rand(500, 620);
        [[0, 0.5], [0.7, 0.35], [1.15, 0.35]].forEach(([dt, d]) => k.tone({ path: [[0, f], [d * 0.4, f * 1.08], [d, f * 0.92]], when: dt, attack: 0.06, hold: d - 0.12, decay: 0.1, gain: 0.035, pan: p, filter: { type: 'lowpass', freq: 900 } }));
      },
      (p) => { // song phrase
        const n = Math.floor(rand(3, 6));
        let t = 0;
        for (let i = 0; i < n; i++) {
          const a = rand(2000, 3400);
          const d = rand(0.08, 0.18);
          k.tone({ path: [[0, a], [d, a * rand(0.75, 1.35)]], when: t, attack: 0.01, hold: d - 0.03, decay: 0.04, gain: rand(0.03, 0.05), pan: p });
          t += d + rand(0.04, 0.1);
        }
      },
    ];
    const flock = Array.from({ length: 4 }, () => ({ sing: pick(species), pan: rand(-0.9, 0.9) }));
    k.every(min, max, () => {
      const bird = pick(flock);
      bird.sing(bird.pan);
      if (Math.random() < 0.05) { bird.sing = pick(species); bird.pan = rand(-0.9, 0.9); }
    }, 600);
  };

  S.gulls = (k, out) => {
    k.every(12000, 35000, () => {
      const p = rand(-0.8, 0.8);
      const n = Math.floor(rand(2, 5));
      const base = rand(900, 1300);
      const dist = rand(0.3, 1);
      for (let i = 0; i < n; i++) {
        const d = rand(0.25, 0.4);
        k.tone({ type: 'sawtooth', path: [[0, base * 0.8], [d * 0.25, base * 1.15], [d, base * 0.7]], when: i * rand(0.35, 0.5), attack: 0.03, hold: d - 0.08, decay: 0.1, gain: 0.035 * dist, pan: p, filter: { type: 'bandpass', freq: base * 1.6, Q: 1.2 }, vibrato: { rate: 28, depth: 30 } });
      }
    }, 4000);
  };

  // ---------- Spa ----------

  // Soft steam: an airy hiss that swells slowly, with the odd sigh from a steam vent.
  S.steam = (k, out) => {
    const hp = k.filter('highpass', 900, 0.5);
    const lp = k.filter('lowpass', 5200, 0.5);
    const g = k.gain(0.12);
    k.chain(k.noise('pink'), hp, lp, g, out);
    k.lfo(g.gain, 0.05, 0.05);
    k.lfo(lp.frequency, 0.03, 1200);
    k.every(25000, 60000, () => {
      k.burst({ type: 'pink', attack: rand(1.5, 2.5), hold: rand(1, 3), decay: rand(3, 5), gain: rand(0.05, 0.08), filter: 'bandpass', freq: rand(2500, 3500), Q: 0.6, to: rand(1800, 2400), pan: rand(-0.5, 0.5) });
    }, 8000);
  };

  // Singing bowls struck now and then: inharmonic partials, each a slowly beating pair.
  const BOWL = [[1, 0.05, 1], [2.76, 0.022, 0.62], [5.4, 0.009, 0.38], [8.93, 0.004, 0.24]];
  S.bowl = (k, out) => {
    k.every(18000, 40000, () => {
      const f = pick([196, 220, 261.63, 293.66]);
      const life = rand(9, 13);
      const pan = rand(-0.6, 0.6);
      BOWL.forEach(([m, g, d]) => {
        [-1.5, 1.5].forEach((beat) => k.tone({ freq: f * m + beat, attack: 0.015, decay: life * d, gain: g * rand(0.8, 1), pan }));
      });
    }, 3000);
  };

  // Drips falling into still water, echoing off stone.
  S.drips = (k, out) => {
    k.every(1400, 5200, () => {
      const f = rand(900, 1700);
      k.tone({ freq: f, to: f * rand(1.6, 2.3), glide: 0.05, attack: 0.002, decay: rand(0.06, 0.12), gain: rand(0.02, 0.045), pan: rand(-0.7, 0.7) });
    });
  };

  // ---------- Vehicles ----------
  // The scene and the sound read the same clock, so a bus pulls into its stop
  // (or a train enters a tunnel) in both at once, even with the sound off.
  const ride = (FP.ride = {});
  const smoothstep = (x) => x * x * (3 - 2 * x);
  const cruise = (c) => 0.86 + 0.14 * Math.sin(c * 0.21);

  // City bus, an 80-second loop: cruise, brake into a stop, doors open and close, pull away.
  // Turn signals: [start, end, side]. The indicator clicks every 0.38 s.
  const SIGNALS = [[18, 24, 'left'], [38, 43.5, 'right'], [53, 57, 'right'], [70.5, 75, 'left']];
  const TICK = 0.38;
  ride.bus = (now = Date.now() / 1000) => {
    const c = now % 80;
    const sig = SIGNALS.find(([a, b]) => c >= a && c < b);
    const signal = sig ? sig[2] : null;
    const blink = sig ? Math.floor((c - sig[0]) / TICK) % 2 === 0 : false;
    const base = { signal, blink, c };
    if (c < 56) return { ...base, phase: 'cruise', speed: cruise(c), doors: 0 };
    if (c < 62) return { ...base, phase: 'brake', speed: cruise(56) * (1 - smoothstep((c - 56) / 6)), doors: 0 };
    if (c < 71) return { ...base, phase: 'stop', speed: 0, doors: c >= 63 && c < 69 ? Math.min(1, (c - 63) / 0.8, (69 - c) / 0.8) : 0 };
    return { ...base, phase: 'go', speed: cruise(0) * smoothstep((c - 71) / 9), doors: 0 };
  };
  // Express train, a 4-minute loop with one tunnel.
  ride.train = (now = Date.now() / 1000) => {
    const c = now % 240;
    const tunnel = c >= 150 && c < 164 ? Math.min(1, (c - 150) / 0.6, (164 - c) / 0.6) : 0;
    return { speed: 1, tunnel, c };
  };
  // Airliner at cruise, a 7-minute loop with a short patch of light turbulence.
  ride.plane = (now = Date.now() / 1000) => {
    const c = now % 420;
    const belt = c >= 300 && c < 345;
    const bump = c >= 304 && c < 340 ? Math.min(1, (c - 304) / 3, (340 - c) / 3) : 0;
    return { belt, bump, c };
  };

  // Watch a ride's clock and call `onChange(state, previous)` a few times a second.
  function follow(k, read, onChange) {
    let prev = read();
    onChange(prev, null);
    k.every(200, 200, () => {
      const s = read();
      onChange(s, prev);
      prev = s;
    }, 200);
  }

  S.bus = (k, out) => {
    const ctx = out.context;
    const set = (param, v, tc = 0.35) => param.setTargetAtTime(v, ctx.currentTime, tc);
    // diesel engine: a buzzy fundamental that rises with speed, under a road rumble
    const engLp = k.filter('lowpass', 260, 1.2);
    const engGain = k.gain(0.1);
    engLp.connect(engGain).connect(out);
    const eng = k.osc('sawtooth', 34);
    const eng2 = k.osc('square', 68, 6);
    eng.connect(engLp);
    eng2.connect(k.gain(0.3)).connect(engLp);
    const rumble = k.gain(0.3);
    k.chain(k.noise('brown'), k.filter('lowpass', 170, 0.8), rumble, out);
    const road = k.gain(0.05);
    k.chain(k.noise('pink'), k.filter('bandpass', 650, 0.6), road, out);
    follow(k, () => ride.bus(), (s, p) => {
      set(eng.frequency, 30 + 26 * s.speed);
      set(eng2.frequency, 60 + 52 * s.speed);
      set(engLp.frequency, 200 + 260 * s.speed);
      set(engGain.gain, 0.07 + 0.06 * s.speed);
      set(rumble.gain, 0.12 + 0.28 * s.speed);
      set(road.gain, 0.015 + 0.06 * s.speed);
      if (!p) return;
      if (p.phase === 'cruise' && s.phase === 'brake') {
        k.burst({ type: 'pink', attack: 0.6, hold: 2.5, decay: 1.5, gain: 0.012, filter: 'bandpass', freq: 2400, Q: 6, to: 1900 });
      }
      if (p.phase === 'brake' && s.phase === 'stop') {
        k.burst({ type: 'white', attack: 0.01, decay: 0.9, gain: 0.05, filter: 'highpass', freq: 2500, Q: 0.5 });
      }
      // doors: a hiss, then a soft two-note chime as they open
      if (p.doors === 0 && s.doors > 0) {
        k.burst({ type: 'white', attack: 0.02, hold: 0.3, decay: 0.6, gain: 0.04, filter: 'bandpass', freq: 3200, Q: 0.7, pan: 0.5 });
        k.tone({ freq: 659.25, when: 0.5, attack: 0.01, decay: 1.2, gain: 0.03 });
        k.tone({ freq: 523.25, when: 0.9, attack: 0.01, decay: 1.5, gain: 0.03 });
      }
      if (p.doors >= 1 && s.doors < 1) {
        k.burst({ type: 'white', attack: 0.02, hold: 0.2, decay: 0.5, gain: 0.035, filter: 'bandpass', freq: 3000, Q: 0.7, pan: 0.5 });
      }
    });
  };

  // Bumps in the road: front wheels, then back wheels, and the panels rattling.
  S.busBumps = (k, out) => {
    const hit = (when, g) => {
      k.tone({ freq: rand(42, 62), when, attack: 0.004, decay: 0.22, gain: 0.16 * g });
      k.burst({ type: 'pink', when, attack: 0.002, decay: 0.09, gain: 0.03 * g, filter: 'bandpass', freq: 700, Q: 1 });
      for (let i = 0; i < 5; i++) {
        k.burst({ type: 'white', when: when + 0.02 + i * rand(0.025, 0.045), attack: 0.001, decay: 0.018, gain: rand(0.006, 0.014) * g, filter: 'bandpass', freq: rand(1500, 3200), Q: 4, pan: rand(-0.6, 0.6) });
      }
    };
    k.every(1500, 5000, () => {
      const s = ride.bus();
      if (s.speed < 0.25) return;
      const g = s.speed * rand(0.6, 1.1);
      hit(0, g);
      // the back axle meets the same bump a moment later
      hit(0.32 / s.speed, g * 0.8);
    });
  };

  // The turn signal relay: tick when the lamp lights, tock when it goes out.
  S.busSignal = (k, out) => {
    follow(k, () => ride.bus(), (s, p) => {
      if (!s.signal || (p && p.signal === s.signal)) return;
      // a signal just started: click through to its end, in time with the lamp
      const [start, end] = SIGNALS.find(([a, b]) => s.c >= a && s.c < b);
      const pan = s.signal === 'left' ? -0.35 : 0.35;
      const first = Math.ceil((s.c - start) / TICK);
      for (let i = first; start + i * TICK < end; i++) {
        const when = start + i * TICK - s.c;
        const on = i % 2 === 0;
        k.burst({ type: 'white', when, attack: 0.001, decay: 0.012, gain: on ? 0.05 : 0.035, filter: 'bandpass', freq: on ? 2600 : 1900, Q: 2.5, pan });
        k.tone({ freq: on ? 1250 : 950, when, attack: 0.001, decay: 0.025, gain: on ? 0.02 : 0.014, pan });
      }
    });
  };

  S.train = (k, out) => {
    const ctx = out.context;
    const set = (param, v, tc = 0.3) => param.setTargetAtTime(v, ctx.currentTime, tc);
    const rumbleLp = k.filter('lowpass', 190, 0.7);
    const rumble = k.gain(0.32);
    k.chain(k.noise('brown'), rumbleLp, rumble, out);
    const hiss = k.gain(0.035);
    k.chain(k.noise('pink'), k.filter('bandpass', 950, 0.7), hiss, out);
    const hum = k.gain(0.025);
    k.osc('sine', 100).connect(hum).connect(out);
    follow(k, () => ride.train(), (s) => {
      set(rumble.gain, 0.32 + 0.45 * s.tunnel);
      set(rumbleLp.frequency, 190 + 260 * s.tunnel);
      set(hiss.gain, 0.035 + 0.05 * s.tunnel);
    });
    // a distant horn now and then
    k.every(90000, 200000, () => {
      [[311.13, 0], [369.99, 0]].forEach(([f]) => k.tone({ type: 'sawtooth', freq: f, attack: 0.15, hold: 1.1, decay: 0.8, gain: 0.006, filter: { type: 'lowpass', freq: 900 } }));
    });
  };

  // The track: clickety-clack as each bogie's two axles cross a rail joint, the
  // odd clatter over points, and a faint wheel squeal on a curve.
  S.trainTracks = (k, out) => {
    const clack = (when, g, pan) => {
      k.burst({ type: 'white', when, attack: 0.001, decay: 0.035, gain: 0.06 * g, filter: 'bandpass', freq: rand(2300, 2900), Q: 3, pan });
      k.burst({ type: 'pink', when, attack: 0.001, decay: 0.07, gain: 0.05 * g, filter: 'bandpass', freq: 850, Q: 1.2, pan });
      k.tone({ freq: rand(65, 80), when, attack: 0.002, decay: 0.1, gain: 0.08 * g });
    };
    k.every(2150, 2250, () => {
      const g = 1 + ride.train().tunnel * 0.5;
      // this car's rear bogie, then the next car's front bogie
      [[0, 1], [0.13, 0.85], [0.62, 0.9], [0.75, 0.75]].forEach(([w, a]) => clack(w, g * a * rand(0.9, 1.1), rand(-0.2, 0.2)));
    }, 300);
    k.every(40000, 90000, () => {
      let w = 0;
      for (let i = 0; i < 7; i++) {
        clack(w, rand(0.5, 0.9), rand(-0.4, 0.4));
        w += rand(0.09, 0.22);
      }
    });
    k.every(60000, 140000, () => {
      const f = rand(3200, 4200);
      k.tone({ freq: f, to: f * rand(1.03, 1.08), glide: 3, attack: 0.8, hold: 1.2, decay: 1.5, gain: 0.004, pan: rand(-0.5, 0.5) });
    });
  };

  S.cabin = (k, out) => {
    // the classic airliner roar: lots of low, smooth noise
    k.chain(k.noise('pink'), k.filter('lowpass', 520, 0.5), k.gain(0.42), out);
    k.chain(k.noise('brown'), k.filter('lowpass', 140, 0.7), k.gain(0.35), out);
    const tone = k.gain(0.012);
    tone.connect(out);
    k.osc('sine', 98).connect(tone);
    k.osc('sine', 147.3).connect(k.gain(0.5)).connect(tone);
    k.lfo(tone.gain, 0.07, 0.004);
    // the seatbelt sign's chime when it switches on and off, and soft thumps in turbulence
    follow(k, () => ride.plane(), (s, p) => {
      if (!p || s.belt === p.belt) return;
      k.tone({ freq: 1046.5, attack: 0.004, decay: 1.8, gain: 0.07 });
      k.tone({ freq: 2093, attack: 0.004, decay: 0.9, gain: 0.015 });
    });
    k.every(500, 1600, () => {
      const b = ride.plane().bump;
      if (b > 0) k.tone({ freq: rand(40, 60), attack: 0.02, decay: 0.3, gain: 0.08 * b });
    });
  };

  // The cabin PA: a two-tone chime, then the captain speaking in Arabic (Gulf dialect)
  // and then English, as on Gulf Air. The words come from the browser's own text-to-speech voices, so they
  // can't run through the Web Audio graph; their volume follows the layer, the master
  // volume and any ducking instead. Without an Arabic voice, only the English is spoken.
  const CAPTAIN = [
    {
      ar: 'هلا وغلا فيكم، معاكم كابتن الطيارة. احنا الحين طايرين على ارتفاع سبعة وثلاثين ألف قدم، والجو قدامنا هادي. ارتاحوا واستانسوا بباقي الرحلة.',
      en: 'Good afternoon, ladies and gentlemen, this is your captain speaking. We are cruising at thirty-seven thousand feet, and the skies ahead look smooth. Sit back and enjoy the rest of the flight.',
    },
    {
      ar: 'هلا فيكم مرة ثانية من الكابينة. قطعنا نص الطريق للبحرين، وماشين على الوقت بالضبط. والجو في البحرين صافي والهوا حلو.',
      en: 'Hello again from the flight deck. We are about halfway to Bahrain and right on schedule. The weather on arrival is clear, with a gentle breeze.',
    },
    {
      ar: 'يا جماعة، لو تطالعون من الدرايش اللي على اليمين، بتشوفون بحر من الغيوم تحتنا، منظر ولا أحلى. والجو بيظل رايق شوي.',
      en: 'Ladies and gentlemen, if you look out of the windows on the right, you can see a beautiful sea of clouds below us. It should stay this calm for a while.',
    },
    {
      ar: 'معاكم الكابتن. الهوا ساعدنا من ورا، فبنوصل قبل الوقت بكم دقيقة. مشكورين إنكم مسافرين ويانا اليوم.',
      en: 'This is your captain. We have picked up a nice tailwind, so we expect to arrive a few minutes early. Thank you for flying with us today.',
    },
    {
      ar: 'يا جماعة، طاقم الضيافة بيمرون عليكم بعد شوي بالمشروبات الحارة والماي. أي شي تبونه قولوا لهم.',
      en: 'Ladies and gentlemen, the cabin crew will be coming through shortly with hot drinks and water. Please let them know if there is anything you need.',
    },
    {
      ar: 'هلا من الكابينة. كل شي ماشي تمام عندنا. استغلوا هالوقت الرايق للراحة أو القراية أو خلّصوا شغلكم.',
      en: 'Good afternoon from the flight deck. Everything is running smoothly up here. Take this quiet time to rest, read or get some work done.',
    },
  ];
  const WELCOME = {
    ar: 'هلا وغلا فيكم على متن رحلتنا للبحرين، معاكم الكابتن. ارتاحوا وركزوا على شغلكم، واحنا بنوصلكم بالسلامة.',
    en: 'Welcome aboard our flight to Bahrain, this is your captain. Settle in and focus on your work, and we will take care of the rest.',
  };
  const BELT_ON = {
    ar: 'يا جماعة، الكابتن شغّل إشارة الأحزمة، لأننا داخلين في شوية مطبات خفيفة. لو سمحتوا ارجعوا لمقاعدكم وخلوا الأحزمة مربوطة.',
    en: 'Ladies and gentlemen, the captain has turned on the fasten seatbelt sign. We are passing through some light turbulence. Please return to your seats and keep your seatbelts fastened.',
  };
  const BELT_OFF = {
    ar: 'الكابتن طفّى إشارة الأحزمة، وتقدرون الحين تتحركون في الطيارة. بس وانتوا قاعدين خلوا الحزام مربوط.',
    en: 'The captain has turned off the fasten seatbelt sign. You are free to move about the cabin, but please keep your seatbelt fastened while you are seated.',
  };
  const voices = {};
  const pickVoice = (lang) => {
    const synth = window.speechSynthesis;
    if (!synth) return null;
    if (voices[lang]) return voices[lang];
    const list = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith(lang));
    const local = list.filter((v) => v.localService);
    const preferred = lang === 'en' ? /en[-_]GB/i : /ar[-_](SA|BH|AE|001)/i;
    voices[lang] = local.find((v) => preferred.test(v.lang)) || local[0] || list.find((v) => preferred.test(v.lang)) || list[0] || null;
    return voices[lang];
  };
  if (window.speechSynthesis) window.speechSynthesis.addEventListener?.('voiceschanged', () => { delete voices.en; delete voices.ar; });
  // iPhones and iPads only let a page speak after speech was first started from a tap,
  // so speak a silent space on the first tap; announcements can then play on their own.
  const UNLOCK = ['touchend', 'click', 'keydown'];
  const unlockSpeech = () => {
    UNLOCK.forEach((e) => window.removeEventListener(e, unlockSpeech, true));
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    window.speechSynthesis.speak(u);
  };
  UNLOCK.forEach((e) => window.addEventListener(e, unlockSpeech, true));

  S.announcements = (k, out) => {
    const synth = window.speechSynthesis;
    const say = (lines, delay) => {
      // the PA chime always plays; the words only when the browser can speak and Calm focus isn't muffling voices
      k.tone({ freq: 783.99, when: delay, attack: 0.005, decay: 1.4, gain: 0.05 });
      k.tone({ freq: 523.25, when: delay + 0.55, attack: 0.005, decay: 1.8, gain: 0.05 });
      if (!synth || !window.SpeechSynthesisUtterance) return;
      k.after((delay + 1.6) * 1000, () => {
        const a = FP.audio;
        if (a.speechMuffled || document.hidden) return;
        const volume = Math.max(0, Math.min(1, out.gain.value * a.volume * a.duckLevel * 1.6));
        const queue = ['ar', 'en'].map((lang) => {
          const v = pickVoice(lang);
          // never let an English voice read the Arabic (or the reverse)
          if (!v && lang === 'ar') return null;
          const u = new SpeechSynthesisUtterance(lines[lang]);
          if (v) u.voice = v;
          u.lang = v ? v.lang : 'en-GB';
          u.rate = lang === 'ar' ? 0.9 : 0.93;
          u.pitch = 0.92;
          u.volume = volume;
          return u;
        }).filter(Boolean);
        synth.cancel();
        queue.forEach((u) => synth.speak(u));
        // stop talking if the layer is switched off or the place changes mid-sentence
        const watch = setInterval(() => { if (!k.alive) synth.cancel(); }, 400);
        const lastU = queue[queue.length - 1];
        lastU.onend = lastU.onerror = () => clearInterval(watch);
      });
    };
    follow(k, () => ride.plane(), (s, p) => {
      if (!p || s.belt === p.belt) return;
      say(s.belt ? BELT_ON : BELT_OFF, 2.2);
    });
    // a welcome from the captain shortly after you board, unless the seatbelt sign is about to speak
    k.after(rand(12000, 18000), () => {
      const r = ride.plane();
      if (!r.belt && !(r.c > 280 && r.c < 300)) say(WELCOME, 0);
    });
    let last = -1;
    k.every(150000, 330000, () => {
      const r = ride.plane();
      // keep clear of the seatbelt announcements (both languages take about 25 seconds)
      if (r.belt || (r.c > 260 && r.c < 300) || (r.c >= 345 && r.c < 375)) return;
      let i = Math.floor(rand(0, CAPTAIN.length));
      if (i === last) i = (i + 1) % CAPTAIN.length;
      last = i;
      say(CAPTAIN[i], 0);
    });
  };

  S.airVent = (k, out) => {
    k.chain(k.noise('white'), k.filter('highpass', 3500, 0.5), k.filter('lowpass', 9000, 0.5), k.gain(0.02), out);
  };

  // ---------- Yoga studio ----------

  // Slow, warm pad chords: each one swells in over a few seconds and melts into the next.
  const YOGA_CHORDS = [[50, 57, 62, 66, 69], [47, 54, 59, 62, 66], [43, 50, 55, 59, 64], [45, 52, 57, 61, 64]];
  S.yogaPad = (k, out) => {
    const lp = k.filter('lowpass', 1300, 0.5);
    lp.connect(out);
    let i = Math.floor(rand(0, YOGA_CHORDS.length));
    k.every(11000, 11000, () => {
      YOGA_CHORDS[i++ % YOGA_CHORDS.length].forEach((m, j) => {
        [-5, 5].forEach((det) => k.tone({ type: j === 0 ? 'sine' : 'triangle', freq: mtof(m), detune: det, attack: 4, hold: 6, decay: 6, gain: j === 0 ? 0.03 : 0.011, dest: lp, pan: rand(-0.4, 0.4) }));
      });
    }, 0);
  };

  // A breathy bamboo flute playing a few unhurried notes now and then (D major pentatonic).
  const FLUTE = [62, 64, 66, 69, 71, 74, 76];
  S.flute = (k, out) => {
    k.every(20000, 45000, () => {
      let w = 0;
      let n = Math.floor(rand(1, FLUTE.length - 1));
      const notes = Math.floor(rand(3, 6));
      for (let i = 0; i < notes; i++) {
        const len = i === notes - 1 ? rand(2.2, 3.2) : rand(0.7, 1.4);
        const f = mtof(FLUTE[n]);
        k.tone({ freq: f, when: w, attack: 0.25, hold: len * 0.6, decay: len * 0.6, gain: 0.03, vibrato: { rate: 5, depth: f * 0.006 }, filter: { type: 'lowpass', freq: 2400 } });
        k.burst({ type: 'pink', when: w, attack: 0.15, hold: len * 0.5, decay: len * 0.5, gain: 0.004, filter: 'bandpass', freq: f * 2, Q: 2 });
        w += len * 0.95;
        n = Math.max(0, Math.min(FLUTE.length - 1, n + pick([-2, -1, -1, 1, 1, 2])));
      }
    }, 6000);
  };

  // Wind chimes on the terrace: a few bright, ringing notes when the breeze picks up.
  const CHIMES = [81, 83, 86, 88, 90, 93];
  S.windChimes = (k, out) => {
    k.every(5000, 14000, () => {
      const n = Math.floor(rand(2, 6));
      let w = 0;
      for (let i = 0; i < n; i++) {
        const f = mtof(pick(CHIMES));
        const pan = rand(-0.7, 0.7);
        k.tone({ freq: f, when: w, attack: 0.002, decay: rand(2, 3.5), gain: rand(0.008, 0.016), pan });
        k.tone({ freq: f * 2.76, when: w, attack: 0.002, decay: 0.8, gain: 0.003, pan });
        w += rand(0.12, 0.45);
      }
    }, 2000);
  };

  // ---------- Space ----------

  S.drone = (k, out, { root = 55 } = {}) => {
    const lp = k.filter('lowpass', 380, 1.2);
    const bus = k.gain(1);
    lp.connect(bus).connect(out);
    [[root, 'sine', 0.35, 0], [root, 'sine', 0.35, 7], [root * 1.5, 'triangle', 0.08, -5], [root * 2, 'sine', 0.1, 3], [root * 3, 'sine', 0.03, 0]].forEach(([f, type, g, det]) => {
      const gg = k.gain(g);
      k.osc(type, f, det).connect(gg).connect(lp);
      k.lfo(gg.gain, rand(0.03, 0.09), g * 0.4);
    });
    k.lfo(lp.frequency, 0.04, 160);
    k.chain(k.noise('brown'), k.filter('lowpass', 160), k.gain(0.25), bus);
    k.chain(k.noise('pink'), k.filter('bandpass', 480, 2), k.gain(0.012), bus);
  };

  // Slow, low pentatonic swells — soft enough to sit under reading.
  S.shimmer = (k, out) => {
    const scale = [57, 59, 61, 64, 66, 69, 71, 73];
    k.every(3500, 8000, () => {
      const m = pick(scale);
      k.tone({ freq: mtof(m), attack: rand(1.5, 3), hold: 0.6, decay: rand(6, 10), gain: rand(0.02, 0.038), pan: rand(-0.7, 0.7) });
      if (Math.random() < 0.3) k.tone({ freq: mtof(m - 12), when: 0.4, attack: 2, decay: 7, gain: 0.012, pan: rand(-0.7, 0.7) });
    }, 1500);
  };

  S.engine = (k, out) => {
    k.chain(k.noise('brown'), k.filter('lowpass', 110, 0.9), k.gain(0.7), out);
    const g = k.gain(0.12);
    k.osc('sine', 36).connect(g).connect(out);
    k.lfo(g.gain, 0.21, 0.04);
    k.osc('triangle', 72.4).connect(k.filter('lowpass', 200)).connect(k.gain(0.025)).connect(out);
    k.every(30000, 70000, () => {
      const f = pick([392, 440, 523.25]);
      [0, 0.6].forEach((w, i) => k.tone({ freq: f * (i ? 1.25 : 1), when: w, attack: 0.08, hold: 0.1, decay: 1.2, gain: 0.008, pan: rand(-0.5, 0.5) }));
    }, 20000);
  };

  // ---------- Music ----------

  // [bass midi, chord voicing] — warm jazzy progressions for lo-fi style loops.
  const PROGRESSIONS = [
    [[41, [53, 57, 60, 64]], [40, [52, 55, 59, 62]], [38, [50, 53, 57, 60]], [36, [48, 52, 55, 59]]],
    [[38, [53, 57, 60, 64]], [43, [53, 59, 64]], [36, [52, 55, 59, 62]], [45, [55, 60, 64, 67]]],
    [[45, [55, 60, 64, 67]], [38, [53, 57, 60, 64]], [43, [53, 57, 59, 64]], [36, [52, 55, 59, 62]]],
  ];

  S.lofi = (k, out, { bpm = 70, lp = 1400, crackle = true, swing = 0.04, keys = 'triangle' } = {}) => {
    const bus = k.gain(1);
    const lpf = k.filter('lowpass', lp, 0.6);
    k.chain(bus, lpf, out);
    k.lfo(lpf.frequency, 0.07, lp * 0.25);
    let prog = pick(PROGRESSIONS);
    let i = 0;
    const bar = (60 / bpm) * 4;
    let next = k.now() + 0.2;

    const playBar = (t) => {
      const [bass, notes] = prog[i % prog.length];
      i++;
      if (i % (prog.length * 2) === 0) prog = pick(PROGRESSIONS);
      const w = t - k.now();
      notes.forEach((m, j) => k.tone({
        freq: mtof(m), type: keys, when: w + j * 0.014, attack: 0.02, hold: bar * 0.1, decay: bar * 0.95,
        gain: 0.045, pan: (j - 1.5) * 0.15, detune: rand(-8, 8), dest: bus,
      }));
      k.tone({ freq: mtof(bass), when: w, attack: 0.01, decay: bar * 0.45, gain: 0.14, dest: bus });
      k.tone({ freq: mtof(bass), when: w + bar / 2, attack: 0.01, decay: bar * 0.4, gain: 0.1, dest: bus });
      for (let beat = 0; beat < 4; beat++) {
        const bt = w + (beat * bar) / 4;
        k.tone({ freq: 60, to: 40, glide: 0.08, when: bt, attack: 0.002, decay: 0.12, gain: beat % 2 ? 0.05 : 0.11, dest: bus });
        k.burst({ when: bt + bar / 8 + swing, decay: 0.04, gain: 0.012, filter: 'highpass', freq: 6500, dest: bus });
        if (beat % 2) k.burst({ type: 'pink', when: bt, attack: 0.002, decay: 0.12, gain: 0.03, filter: 'bandpass', freq: 1800, Q: 0.8, dest: bus });
      }
      if (Math.random() < 0.65) {
        const scale = notes.map((n) => n + 12);
        const count = Math.floor(rand(1, 4));
        for (let n = 0; n < count; n++) {
          k.tone({ freq: mtof(pick(scale)), when: w + (Math.floor(rand(0, 8)) * bar) / 8, attack: 0.005, decay: 1.2, gain: 0.03, pan: rand(-0.3, 0.3), dest: bus });
        }
      }
    };

    const schedule = () => {
      if (next < k.now()) next = k.now() + 0.1;
      while (next < k.now() + 1.5) {
        playBar(next);
        next += bar;
      }
    };
    schedule();
    k.every(400, 500, schedule);
    if (crackle) {
      k.every(40, 400, () => k.burst({ decay: 0.004, gain: rand(0.01, 0.04), filter: 'highpass', freq: 2000, pan: rand(-0.5, 0.5), dest: bus }));
    }
  };
  // ---------- Airport ----------

  S.coffeeBar = (k, out) => {
    S.espresso(k, out);
    S.dishes(k, out, { min: 2500, max: 8000 });
  };

  // The classic three-note terminal chime, soft and reverberant.
  S.departureChime = (k, out) => {
    const bell = (freq, when) => {
      [[1, 0.06, 2.4], [4.0, 0.012, 0.8], [2.0, 0.015, 1.4]].forEach(([m, g, d]) => k.tone({ freq: freq * m, when, attack: 0.004, decay: d, gain: g }));
    };
    k.every(50000, 110000, () => {
      [[783.99, 0], [659.25, 0.42], [523.25, 0.84]].forEach(([f, w]) => bell(f, w));
    }, 14000);
  };

  // A wheeled case rolling across tiles: a rumble plus a click at each joint.
  S.suitcases = (k, out) => {
    k.every(6000, 16000, () => {
      const dur = rand(3, 6);
      const from = Math.random() < 0.5 ? -0.9 : 0.9;
      const t = k.now();
      const src = k.noiseSource('pink');
      const f = k.filter('bandpass', rand(320, 520), 1.2);
      const g = k.gain(0);
      const p = k.pan(from);
      src.connect(f).connect(g).connect(p).connect(out);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.22, t + dur * 0.45);
      g.gain.linearRampToValueAtTime(0, t + dur);
      if (p.pan) p.pan.linearRampToValueAtTime(-from, t + dur);
      src.start(t, rand(0, 4));
      src.stop(t + dur + 0.1);
      const gap = rand(0.24, 0.34);
      for (let w = 0.2; w < dur - 0.2; w += gap) {
        const x = w / dur;
        const level = Math.max(0.1, Math.sin(Math.PI * x));
        k.burst({ when: w, attack: 0.001, decay: 0.02, gain: 0.08 * level, filter: 'lowpass', freq: 1800, pan: from - 2 * from * x });
      }
    }, 3000);
  };

  // Engines idling on the apron, and now and then a jet taking off (the scene shows it).
  S.jets = (k, out) => {
    k.chain(k.noise('brown'), k.filter('lowpass', 200), k.gain(0.3), out);
    const takeoff = () => {
      FP.emit('takeoff');
      const t = k.now();
      const rise = 7, hold = 4, fall = 12;
      const end = t + rise + hold + fall;
      const p = k.pan(-0.6);
      p.connect(out);
      if (p.pan) p.pan.linearRampToValueAtTime(0.7, end);
      [['brown', 'lowpass', 150, 420, 0.9], ['pink', 'bandpass', 700, 1100, 0.14]].forEach(([type, ft, f0, f1, peak]) => {
        const src = k.noiseSource(type);
        const f = k.filter(ft, f0, 0.8);
        const g = k.gain(0);
        src.connect(f).connect(g).connect(p);
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(peak, t + rise);
        g.gain.setValueAtTime(peak, t + rise + hold);
        g.gain.linearRampToValueAtTime(0, end);
        f.frequency.linearRampToValueAtTime(f1, t + rise);
        f.frequency.linearRampToValueAtTime(f0, end);
        src.start(t, rand(0, 4));
        src.stop(end + 0.1);
      });
    };
    k.every(35000, 70000, takeoff, 9000);
  };

  // ---------- Hotel ----------

  // A gentle, generative lobby pianist: a slow waltz with a wandering melody.
  const WALTZ = [
    [43, [59, 62, 66]], [42, [57, 61, 64]], [40, [55, 59, 62]], [45, [55, 61, 64]],
    [38, [54, 57, 61]], [47, [57, 62, 66]], [40, [55, 59, 62]], [45, [55, 61, 64]],
  ];
  const MELODY = [74, 76, 78, 79, 81, 83, 85, 86];

  const pianoNote = (k, dest, midi, when, vel = 1, len = 3) => {
    const f = mtof(midi);
    const decay = len * (midi < 50 ? 1.6 : midi > 76 ? 0.75 : 1);
    [[1, 1], [2, 0.42], [3, 0.2], [4, 0.1], [5, 0.05]].forEach(([n, a]) => {
      const ratio = n * (1 + 0.0004 * n * n);
      k.tone({ freq: f * ratio, when, attack: 0.004, decay: decay / Math.sqrt(n), gain: 0.05 * vel * a, dest });
    });
    k.burst({ type: 'pink', when, attack: 0.001, decay: 0.03, gain: 0.012 * vel, filter: 'lowpass', freq: 1200, dest });
  };

  S.piano = (k, out, { bpm = 66 } = {}) => {
    const bus = k.gain(1);
    k.chain(bus, k.filter('lowpass', 3600, 0.5), out);
    const beat = 60 / bpm;
    let next = k.now() + 0.3;
    let bar = 0;
    let mi = 3;
    const playBar = (t) => {
      const [bass, chord] = WALTZ[bar % WALTZ.length];
      bar++;
      const w = t - k.now();
      pianoNote(k, bus, bass, w, 0.9, 4);
      chord.forEach((m, j) => pianoNote(k, bus, m, w + beat + j * 0.012, 0.45, 2.5));
      chord.forEach((m, j) => pianoNote(k, bus, m, w + beat * 2 + j * 0.012, 0.35, 2));
      // melody: a random walk that leans toward chord tones
      const notes = Math.random() < 0.25 ? 0 : Math.random() < 0.6 ? 1 : 2;
      for (let n = 0; n < notes; n++) {
        mi = Math.max(0, Math.min(MELODY.length - 1, mi + pick([-2, -1, -1, 0, 1, 1, 2])));
        let note = MELODY[mi];
        const tones = chord.map((c) => c + 12).concat(chord.map((c) => c + 24));
        if (Math.random() < 0.6) note = tones.reduce((a, b) => (Math.abs(b - note) < Math.abs(a - note) ? b : a));
        pianoNote(k, bus, note, w + n * beat * 1.5, 0.7, 3.5);
      }
    };
    const schedule = () => {
      if (next < k.now()) next = k.now() + 0.1;
      while (next < k.now() + 2) {
        playBar(next);
        next += beat * 3;
      }
    };
    schedule();
    k.every(400, 500, schedule);
  };

  // Heels and shoes crossing a marble floor.
  S.heels = (k, out) => {
    k.every(7000, 18000, () => {
      const heels = Math.random() < 0.5;
      const n = Math.floor(rand(6, 12));
      const step = heels ? rand(0.42, 0.5) : rand(0.5, 0.6);
      const from = Math.random() < 0.5 ? -0.9 : 0.9;
      for (let i = 0; i < n; i++) {
        const x = i / (n - 1);
        const pan = from - 2 * from * x;
        const level = Math.max(0.15, Math.sin(Math.PI * (0.1 + 0.8 * x)));
        if (heels) {
          k.burst({ when: i * step, attack: 0.001, decay: 0.035, gain: 0.12 * level, filter: 'bandpass', freq: rand(2200, 2800), Q: 3, pan });
          k.tone({ freq: rand(900, 1100), when: i * step, attack: 0.001, decay: 0.04, gain: 0.02 * level, pan });
        } else {
          k.burst({ when: i * step, attack: 0.002, decay: 0.05, gain: 0.08 * level, filter: 'bandpass', freq: rand(900, 1300), Q: 1.5, pan });
        }
      }
    }, 4000);
  };

  // The front-desk service bell, or an elevator arriving (the scene opens its doors).
  S.lobbyBells = (k, out) => {
    k.every(30000, 80000, () => {
      if (Math.random() < 0.5) {
        const f = rand(2250, 2450);
        [[1, 0.07, 2.6], [2.73, 0.03, 1.4], [5.1, 0.012, 0.7]].forEach(([m, g, d]) => k.tone({ freq: f * m, attack: 0.002, decay: d, gain: g, pan: 0.6 }));
      } else {
        FP.emit('elevator');
        [[1318.5, 0], [1046.5, 0.32]].forEach(([f, w]) => k.tone({ freq: f, when: w + 2, attack: 0.005, decay: 1.6, gain: 0.04, pan: -0.7 }));
      }
    }, 12000);
  };
  // ---------- Henson site office ----------

  // A substation's low mains hum (Bahrain's grid runs at 50 Hz, so transformers hum at 100 Hz).
  S.transformer = (k, out) => {
    const bus = k.gain(1);
    k.chain(bus, k.filter('lowpass', 900, 0.6), out);
    [[100, 0.06, 0], [200, 0.025, 3], [300, 0.012, -2], [400, 0.006, 1]].forEach(([f, g, d]) => {
      const gg = k.gain(g);
      k.osc('sine', f, d).connect(gg).connect(bus);
      k.lfo(gg.gain, rand(0.05, 0.12), g * 0.3);
    });
    k.chain(k.noise('brown'), k.filter('lowpass', 180), k.gain(0.12), bus);
  };

  // A building site in the distance: machinery swelling and fading, the odd clang, rare crane beeps.
  S.site = (k, out) => {
    const bus = k.gain(1);
    k.chain(bus, k.filter('lowpass', 2200, 0.5), out);
    const rf = k.filter('lowpass', 260, 0.7);
    const rg = k.gain(0.25);
    k.chain(k.noise('brown'), rf, rg, bus);
    k.lfo(rg.gain, 0.03, 0.1);
    k.lfo(rf.frequency, 0.05, 80);
    const eng = k.gain(0.02);
    k.osc('sawtooth', 46).connect(k.filter('lowpass', 160)).connect(eng).connect(bus);
    k.lfo(eng.gain, 0.02, 0.012);
    k.every(7000, 18000, () => {
      const f = rand(220, 420);
      const p = rand(-0.7, 0.7);
      [[1, 1, 1.6], [2.41, 0.4, 1.1], [3.9, 0.2, 0.7], [5.3, 0.12, 0.5]].forEach(([m, a, d]) => k.tone({ freq: f * m, attack: 0.002, decay: d, gain: 0.05 * a, pan: p, dest: bus }));
    }, 5000);
    k.every(30000, 70000, () => {
      const n = Math.floor(rand(3, 7));
      const p = rand(-0.8, 0.8);
      for (let i = 0; i < n; i++) k.tone({ freq: 1050, when: i * 0.9, attack: 0.01, hold: 0.32, decay: 0.05, gain: 0.012, pan: p, filter: { type: 'lowpass', freq: 1400 }, dest: bus });
    }, 12000);
  };
  // ---------- Persian santur (dastgāh Homāyun) ----------

  // One santur strike: paired, slightly detuned strings with bright partials and a hammer click.
  const santurNote = (k, dest, f, when, vel = 1, pan = 0) => {
    [[1, 1, 2.4], [2, 0.45, 1.6], [3, 0.22, 1.0], [4.02, 0.12, 0.7], [5.05, 0.06, 0.5]].forEach(([m, a, d]) => {
      [-4, 4].forEach((cents) => k.tone({ freq: f * m, detune: cents, when, attack: 0.002, decay: d * rand(0.9, 1.1), gain: 0.022 * vel * a, pan, dest }));
    });
    k.burst({ when, attack: 0.0008, decay: 0.012, gain: 0.03 * vel, filter: 'bandpass', freq: 3200, Q: 1.2, pan, dest });
  };

  // Homāyun on G: G, A koron (a quarter-tone flat), B, C, D, E♭, F. Its signature is the wide
  // step from A koron up to B. Free-rhythm phrases (āvāz) that keep returning to the
  // G – A koron – B turn and come to rest on G (sometimes pausing on C), with riz
  // (tremolo) on long notes and phrase endings.
  const HOMAYUN = [0, 1.5, 4, 5, 7, 8, 10];
  const homayunNote = (d) => 67 + 12 * Math.floor(d / 7) + HOMAYUN[((d % 7) + 7) % 7];
  const HOMAYUN_TURN = [0, 1, 2, 1, 0];

  S.santur = (k, out) => {
    const bus = k.gain(1);
    k.chain(bus, k.filter('lowpass', 5200, 0.5), out);
    let pos = 1;
    const phrase = () => {
      let w = 0.05;
      // About one phrase in three opens with the characteristic G – A koron – B turn.
      const turn = Math.random() < 0.35 ? HOMAYUN_TURN.slice(0, Math.random() < 0.5 ? 3 : 5) : [];
      const n = turn.length + Math.floor(rand(3, 8));
      for (let i = 0; i < n; i++) {
        const last = i === n - 1;
        if (i < turn.length) pos = turn[i];
        else if (last) pos = Math.random() < 0.7 ? 0 : 3;
        else pos = Math.max(-2, Math.min(7, pos + pick([-1, -1, 1, 1, -2, 2, 0])));
        const f = mtof(homayunNote(pos));
        const p = rand(-0.25, 0.25);
        if (last || Math.random() < 0.18) {
          const dur = last ? rand(1.6, 2.6) : rand(0.8, 1.4);
          const step = rand(0.065, 0.085);
          for (let tt = 0; tt < dur; tt += step) santurNote(k, bus, f, w + tt, 0.45 + 0.4 * Math.sin((Math.PI * tt) / dur), p);
          w += dur + rand(0.1, 0.25);
        } else {
          if (Math.random() < 0.2) santurNote(k, bus, mtof(homayunNote(pos + 1)), w, 0.45, p);
          santurNote(k, bus, f, w + 0.06, rand(0.7, 1), p);
          w += rand(0.3, 0.62);
        }
      }
      santurNote(k, bus, mtof(homayunNote(pos) - 12), Math.max(0, w - 0.4), 0.5, 0);
      k.after((w + rand(1.6, 3.2)) * 1000, phrase);
    };
    k.after(800, phrase);
  };
})();
