/*
 * FocusPal audio engine.
 * Everything is synthesized with the Web Audio API: looping noise beds,
 * filters, oscillators and randomly scheduled one-shots. No audio files.
 */
(function () {
  'use strict';
  const FP = (window.FP = window.FP || {});

  const rand = (a, b) => a + Math.random() * (b - a);
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
  FP.rand = rand;
  FP.pick = pick;
  FP.mtof = mtof;
  FP.emit = (name, detail) => window.dispatchEvent(new CustomEvent('fp:' + name, { detail }));

  const NOISE_SECONDS = 6;
  const LOOP_FADE = 0.05;
  const MIN_GAIN = 0.0001;
  const OPEN_FREQ = 20000;
  const MUFFLE_FREQ = 650;
  const MUFFLE_GAIN = 0.35;

  // Stereo noise buffers whose head is cross-faded with their tail so they loop seamlessly.
  function makeNoise(ctx, kind) {
    const sr = ctx.sampleRate;
    const len = Math.floor(sr * NOISE_SECONDS);
    const fade = Math.floor(sr * LOOP_FADE);
    const buf = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
      for (let i = 0; i < len; i++) {
        const w = Math.random() * 2 - 1;
        if (kind === 'white') {
          d[i] = w * 0.5;
        } else if (kind === 'pink') {
          b0 = 0.99886 * b0 + w * 0.0555179;
          b1 = 0.99332 * b1 + w * 0.0750759;
          b2 = 0.969 * b2 + w * 0.153852;
          b3 = 0.8665 * b3 + w * 0.3104856;
          b4 = 0.55 * b4 + w * 0.5329522;
          b5 = -0.7616 * b5 - w * 0.016898;
          d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
          b6 = w * 0.115926;
        } else {
          last = (last + 0.02 * w) / 1.02;
          d[i] = last * 3.5;
        }
      }
      for (let i = 0; i < fade; i++) {
        const a = i / fade;
        d[i] = d[i] * a + d[len - fade + i] * (1 - a);
      }
    }
    return buf;
  }

  function makeImpulse(ctx, seconds, decay) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }

  // A "kit" is the toolbox handed to every sound layer. It tracks the layer's
  // sources and timers so the whole layer can be torn down in one call.
  function makeKit(engine, out) {
    const ctx = engine.ctx;
    const timers = new Set();
    const sources = [];
    let alive = true;

    const env = (g, t, attack, hold, decay, peak) => {
      peak = Math.max(MIN_GAIN, peak);
      g.gain.setValueAtTime(MIN_GAIN, t);
      g.gain.exponentialRampToValueAtTime(peak, t + Math.max(0.0005, attack));
      if (hold > 0) g.gain.setValueAtTime(peak, t + attack + hold);
      g.gain.exponentialRampToValueAtTime(MIN_GAIN, t + attack + hold + Math.max(0.001, decay));
    };

    const kit = {
      ctx,
      out,
      engine,
      now: () => ctx.currentTime,
      get alive() { return alive; },

      gain(v = 1) {
        const g = ctx.createGain();
        g.gain.value = v;
        return g;
      },
      filter(type, freq, Q = 0.707) {
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = Q;
        return f;
      },
      pan(p = 0) {
        if (ctx.createStereoPanner) {
          const s = ctx.createStereoPanner();
          s.pan.value = Math.max(-1, Math.min(1, p));
          return s;
        }
        return ctx.createGain();
      },
      chain(...nodes) {
        for (let i = 0; i < nodes.length - 1; i++) nodes[i].connect(nodes[i + 1]);
        return nodes[nodes.length - 1];
      },
      // Long-running looped noise source (tracked, stopped with the layer).
      noise(type = 'pink', rate = 1) {
        const s = kit.noiseSource(type, rate);
        s.start(0, Math.random() * (NOISE_SECONDS - 1));
        sources.push(s);
        return s;
      },
      // Untracked looped noise source for one-shots (caller starts/stops it).
      noiseSource(type = 'pink', rate = 1) {
        const s = ctx.createBufferSource();
        s.buffer = engine.noise[type];
        s.loop = true;
        s.loopEnd = NOISE_SECONDS - LOOP_FADE;
        s.playbackRate.value = rate;
        return s;
      },
      osc(type, freq, detune = 0) {
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.value = freq;
        o.detune.value = detune;
        o.start();
        sources.push(o);
        return o;
      },
      lfo(param, rate, depth, type = 'sine') {
        const o = kit.osc(type, rate);
        const g = kit.gain(depth);
        o.connect(g).connect(param);
        return o;
      },
      every(minMs, maxMs, fn, firstMs) {
        const run = () => {
          if (!alive) return;
          try { fn(); } catch (e) { console.error(e); }
          loop();
        };
        const loop = () => kit.after(rand(minMs, maxMs), run);
        if (firstMs != null) kit.after(firstMs, run);
        else loop();
      },
      after(ms, fn) {
        const id = setTimeout(() => {
          timers.delete(id);
          if (alive) fn();
        }, ms);
        timers.add(id);
      },

      // Oscillator one-shot with envelope; optional glide (`to`), pitch path, filter, vibrato.
      tone(o) {
        const {
          freq = 440, to, glide, path, type = 'sine', when = 0,
          attack = 0.005, hold = 0, decay = 0.3, gain = 0.1, pan = 0,
          dest = out, filter, vibrato, detune = 0,
        } = o;
        const t = ctx.currentTime + Math.max(0, when);
        const dur = attack + hold + decay;
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.detune.value = detune;
        if (path) {
          osc.frequency.setValueAtTime(path[0][1], t);
          for (let i = 1; i < path.length; i++) osc.frequency.linearRampToValueAtTime(path[i][1], t + path[i][0]);
        } else {
          osc.frequency.setValueAtTime(freq, t);
          if (to) osc.frequency.exponentialRampToValueAtTime(to, t + (glide || dur));
        }
        let node = osc;
        if (filter) {
          const f = kit.filter(filter.type || 'lowpass', filter.freq, filter.Q || 0.707);
          node.connect(f);
          node = f;
        }
        const g = ctx.createGain();
        env(g, t, attack, hold, decay, gain);
        node.connect(g);
        if (pan) g.connect(kit.pan(pan)).connect(dest);
        else g.connect(dest);
        if (vibrato) {
          const v = ctx.createOscillator();
          const vg = ctx.createGain();
          v.frequency.value = vibrato.rate;
          vg.gain.value = vibrato.depth;
          v.connect(vg).connect(osc.frequency);
          v.start(t);
          v.stop(t + dur + 0.05);
        }
        osc.start(t);
        osc.stop(t + dur + 0.05);
        return osc;
      },

      // Filtered noise one-shot with envelope; optional filter sweep (`to`).
      burst(o) {
        const {
          type = 'white', when = 0, attack = 0.002, hold = 0, decay = 0.05, gain = 0.1,
          filter = 'bandpass', freq = 2000, Q = 1, to, pan = 0, dest = out,
        } = o;
        const t = ctx.currentTime + Math.max(0, when);
        const dur = attack + hold + decay;
        const s = kit.noiseSource(type);
        const f = kit.filter(filter, freq, Q);
        if (to) {
          f.frequency.setValueAtTime(freq, t);
          f.frequency.exponentialRampToValueAtTime(to, t + dur);
        }
        const g = ctx.createGain();
        env(g, t, attack, hold, decay, gain);
        s.connect(f).connect(g);
        if (pan) g.connect(kit.pan(pan)).connect(dest);
        else g.connect(dest);
        s.start(t, Math.random() * (NOISE_SECONDS - 1));
        s.stop(t + dur + 0.05);
      },

      // Loop a recorded sample forever with equal-power crossfades, starting at a random point.
      loop(name, { dest = out, xfade = 4, trimEnd = 0.6, onError } = {}) {
        engine.loadSample(name).then((buf) => {
          if (!alive) return;
          const len = buf.duration - trimEnd;
          const fadeIn = new Float32Array(64);
          const fadeOut = new Float32Array(64);
          for (let i = 0; i < 64; i++) {
            fadeIn[i] = Math.sin((i / 63) * Math.PI / 2);
            fadeOut[i] = Math.cos((i / 63) * Math.PI / 2);
          }
          let next = ctx.currentTime + 0.05;
          let from = rand(0, Math.max(0, len - xfade * 3));
          const play = (when, offset) => {
            const src = ctx.createBufferSource();
            src.buffer = buf;
            const g = ctx.createGain();
            const dur = len - offset;
            g.gain.setValueAtTime(0, when);
            g.gain.setValueCurveAtTime(fadeIn, when, xfade);
            g.gain.setValueCurveAtTime(fadeOut, when + dur - xfade, xfade);
            src.connect(g).connect(dest);
            src.start(when, offset, dur);
            sources.push(src);
            src.onended = () => {
              const i = sources.indexOf(src);
              if (i >= 0) sources.splice(i, 1);
            };
            return when + dur - xfade;
          };
          const schedule = () => {
            if (next < ctx.currentTime) next = ctx.currentTime + 0.05;
            while (next < ctx.currentTime + xfade + 3) {
              next = play(next, from);
              from = 0;
            }
          };
          schedule();
          kit.every(1000, 1500, schedule);
        }).catch((e) => {
          console.warn('Could not load sample', name, e);
          if (alive && onError) onError();
        });
      },

      halt() {
        alive = false;
        timers.forEach(clearTimeout);
        timers.clear();
      },
      stop() {
        kit.halt();
        sources.forEach((s) => { try { s.stop(); } catch (e) { /* already stopped */ } });
        sources.length = 0;
      },
    };
    return kit;
  }

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.active = new Map();
      this.volume = 0.7;
      this.muted = false;
      this.duckLevel = 1;
      this.chimeVolume = 0.6;
      this.speechMuffled = false;
    }

    get ready() { return !!this.ctx; }

    // Must be called from a user gesture the first time (browser autoplay rules).
    init() {
      if (this.ctx) {
        if (this.ctx.state !== 'running') this.ctx.resume();
        return true;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = (this.ctx = new AC({ latencyHint: 'playback' }));

      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 10;
      comp.ratio.value = 3.5;
      comp.attack.value = 0.01;
      comp.release.value = 0.25;
      comp.connect(ctx.destination);
      this.bus = comp;

      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(comp);

      this.duck = ctx.createGain();
      this.duck.gain.value = this.duckLevel;
      this.duck.connect(this.master);

      this.reverb = ctx.createConvolver();
      this.reverb.buffer = makeImpulse(ctx, 3.2, 2.6);
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 5200;
      this.reverb.connect(tone).connect(this.duck);

      this.sfx = ctx.createGain();
      this.sfx.gain.value = this.chimeVolume;
      this.sfx.connect(comp);

      this.noise = {
        white: makeNoise(ctx, 'white'),
        pink: makeNoise(ctx, 'pink'),
        brown: makeNoise(ctx, 'brown'),
      };

      // Let iOS treat FocusPal like a media player: it plays with the silent switch on
      // and recovers more reliably after interruptions such as phone calls.
      if (navigator.audioSession) {
        try { navigator.audioSession.type = 'playback'; } catch (e) { /* not supported */ }
      }
      ctx.onstatechange = () => FP.emit('audiostate', ctx.state);

      if (ctx.state !== 'running') ctx.resume();
      return true;
    }

    // Start the audio over with a fresh context. Used when the browser won't resume the old
    // one after an interruption; call it from a tap or key press. Decoded recordings are reused.
    rebuild() {
      const old = this.ctx;
      this.active.forEach((l) => { try { l.kit.stop(); } catch (e) { /* already stopped */ } });
      this.active.clear();
      this.ctx = null;
      if (old) {
        old.onstatechange = null;
        old.close().catch(() => {});
      }
      return this.init();
    }

    // Recordings ship as base64 inside `audio/<name>.js` so they also load from file://.
    loadSample(name) {
      if (!this.samples) this.samples = {};
      if (!this.samples[name]) {
        this.samples[name] = new Promise((resolve, reject) => {
          const decode = () => {
            const data = FP.sampleData && FP.sampleData[name];
            if (!data) return reject(new Error('missing sample data'));
            const bin = atob(data);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            delete FP.sampleData[name];
            this.ctx.decodeAudioData(bytes.buffer, resolve, reject);
          };
          if (FP.sampleData && FP.sampleData[name]) return decode();
          const s = document.createElement('script');
          s.src = `audio/${name}.js`;
          s.async = true;
          s.onload = decode;
          s.onerror = () => reject(new Error('failed to load ' + s.src));
          document.head.appendChild(s);
        });
        this.samples[name].catch(() => { delete this.samples[name]; });
      }
      return this.samples[name];
    }

    // Soft "whoosh" for travelling across the map.
    travel(seconds = 1) {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const t = ctx.currentTime + 0.02;
      const src = ctx.createBufferSource();
      src.buffer = this.noise.pink;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 1.2;
      f.frequency.setValueAtTime(300, t);
      f.frequency.exponentialRampToValueAtTime(1800, t + seconds * 0.7);
      f.frequency.exponentialRampToValueAtTime(600, t + seconds);
      const g = ctx.createGain();
      g.gain.setValueAtTime(MIN_GAIN, t);
      g.gain.exponentialRampToValueAtTime(0.18, t + seconds * 0.6);
      g.gain.exponentialRampToValueAtTime(MIN_GAIN, t + seconds);
      src.connect(f).connect(g).connect(this.sfx);
      src.start(t, Math.random() * 3);
      src.stop(t + seconds + 0.05);
    }

    startLayer(key, def, volume) {
      if (!this.ctx) return;
      this.stopLayer(key, 0.2);
      const ctx = this.ctx;
      const out = ctx.createGain();
      out.gain.value = 0;
      // Layers with intelligible speech get a muffler (lowpass + gain) that Calm focus can engage.
      let post = out;
      let muffle = null;
      if (def.speech) {
        const m = this.speechMuffled;
        muffle = { filter: ctx.createBiquadFilter(), gain: ctx.createGain() };
        muffle.filter.type = 'lowpass';
        muffle.filter.Q.value = 0.5;
        muffle.filter.frequency.value = m ? MUFFLE_FREQ : OPEN_FREQ;
        muffle.gain.gain.value = m ? MUFFLE_GAIN : 1;
        post = out.connect(muffle.filter).connect(muffle.gain);
      }
      post.connect(this.duck);
      if (def.reverb) {
        const send = ctx.createGain();
        send.gain.value = def.reverb;
        post.connect(send).connect(this.reverb);
      }
      const kit = makeKit(this, out);
      try {
        def.create(kit, out);
      } catch (e) {
        console.error('Layer failed:', key, e);
      }
      out.gain.setTargetAtTime(volume * (def.gain || 1), ctx.currentTime, 0.5);
      this.active.set(key, { def, out, kit, muffle });
    }

    // Turn speech down and blur the words (consonants live above ~1 kHz) so voices can't be followed.
    setSpeechMuffled(on) {
      if (this.speechMuffled === on) return;
      this.speechMuffled = on;
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      this.active.forEach(({ muffle }) => {
        if (!muffle) return;
        muffle.filter.frequency.setTargetAtTime(on ? MUFFLE_FREQ : OPEN_FREQ, t, 1.2);
        muffle.gain.gain.setTargetAtTime(on ? MUFFLE_GAIN : 1, t, 1.2);
      });
    }

    setLayerVolume(key, volume) {
      const layer = this.active.get(key);
      if (!layer) return;
      layer.out.gain.setTargetAtTime(volume * (layer.def.gain || 1), this.ctx.currentTime, 0.08);
    }

    stopLayer(key, fade = 1.4) {
      const layer = this.active.get(key);
      if (!layer) return;
      this.active.delete(key);
      layer.kit.halt();
      const t = this.ctx.currentTime;
      layer.out.gain.cancelScheduledValues(t);
      layer.out.gain.setValueAtTime(layer.out.gain.value, t);
      layer.out.gain.setTargetAtTime(0, t, fade / 4);
      setTimeout(() => {
        layer.kit.stop();
        layer.out.disconnect();
        if (layer.muffle) layer.muffle.gain.disconnect();
      }, fade * 1000 + 300);
    }

    stopAll(fade) {
      [...this.active.keys()].forEach((k) => this.stopLayer(k, fade));
    }

    setVolume(v) {
      this.volume = v;
      if (this.ctx && !this.muted) this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    }

    setDuck(level) {
      this.duckLevel = level;
      if (this.ctx) this.duck.gain.setTargetAtTime(level, this.ctx.currentTime, 0.8);
    }

    setChimeVolume(v) {
      this.chimeVolume = v;
      if (this.ctx) this.sfx.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
    }

    // Soft bell. 'break' descends (time to rest), 'focus' ascends (time to work), 'unlock' sparkles.
    chime(kind = 'break') {
      if (!this.ctx) return;
      const ctx = this.ctx;
      const t0 = ctx.currentTime + 0.03;
      const notes = {
        focus: [[523.25, 0], [659.25, 0.22], [783.99, 0.44]],
        break: [[783.99, 0], [659.25, 0.22], [523.25, 0.44]],
        unlock: [[659.25, 0], [783.99, 0.09], [987.77, 0.18], [1318.5, 0.3]],
      }[kind] || [[659.25, 0]];
      const partials = [[1, 0.22, 2.6], [2.0, 0.07, 1.6], [3.01, 0.04, 1.0], [4.17, 0.02, 0.6]];
      notes.forEach(([f, dt]) => {
        partials.forEach(([m, a, d]) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.frequency.value = f * m;
          const t = t0 + dt;
          g.gain.setValueAtTime(MIN_GAIN, t);
          g.gain.exponentialRampToValueAtTime(a, t + 0.006);
          g.gain.exponentialRampToValueAtTime(MIN_GAIN, t + d);
          o.connect(g).connect(this.sfx);
          o.start(t);
          o.stop(t + d + 0.05);
        });
      });
    }
  }

  FP.audio = new AudioEngine();
})();
