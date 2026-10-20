(function () {
  'use strict';
  const FP = window.FP;
  const audio = FP.audio;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  // ---------- Persistence (always optional) ----------
  const store = {
    get(key, fallback) {
      try {
        const v = localStorage.getItem('focuspal:' + key);
        return v == null ? fallback : JSON.parse(v);
      } catch (e) {
        return fallback;
      }
    },
    set(key, value) {
      try { localStorage.setItem('focuspal:' + key, JSON.stringify(value)); } catch (e) { /* storage unavailable */ }
    },
  };

  // ---------- Techniques ----------
  const TECHNIQUES = {
    pomodoro: {
      name: 'Pomodoro', focus: 25, short: 5, long: 15, every: 4,
      blurb: 'Francesco Cirillo’s classic. Short, timeboxed sprints make it easy to start and keep fatigue low; a longer break after every four.',
      best: 'getting started, homework, revision, admin, beating procrastination',
    },
    study: {
      name: 'Deep Study 50 / 10', focus: 50, short: 10, long: 30, every: 3,
      blurb: 'Longer blocks give you time to get properly into a problem, and the 10-minute break fits neatly into each hour.',
      best: 'reading, studying for exams, writing, coding',
    },
    desktime: {
      name: 'The 52 / 17 rhythm', focus: 52, short: 17, long: 17, every: 0,
      blurb: 'From DeskTime’s analysis of its most productive users, who averaged about 52 minutes of work then 17 minutes fully away. Observational, but a popular rhythm.',
      best: 'office work, steady project work, people who like long, real breaks',
    },
    ultradian: {
      name: 'Ultradian 90 / 20', focus: 90, short: 20, long: 20, every: 0,
      blurb: 'Built around the roughly 90-minute rest–activity cycle (Kleitman) and the ~90-minute practice sessions Ericsson observed in expert performers.',
      best: 'deep creative or technical work, once you can sustain focus',
    },
    custom: {
      name: 'Custom', focus: 30, short: 5, long: 20, every: 4,
      blurb: 'Set your own rhythm. A good rule of thumb: about 1 minute of break for every 5 minutes of focus.',
      best: 'when you already know what works for you',
    },
  };

  const TIPS = {
    focus: [
      ['📵', 'Put your phone out of reach, or face down in another room.'],
      ['🎯', 'Write down the single outcome you want from this session.'],
      ['🗂️', 'Close tabs and apps you won’t need for this task.'],
      ['💧', 'Grab some water now so you don’t need to get up mid-session.'],
      ['📝', 'Distracting thought? Jot it on paper and get back to the task.'],
    ],
    short: [
      ['🧍', 'Stand up and stretch your shoulders, neck and back.'],
      ['👀', '20-20-20: look at something about 6 m (20 ft) away for 20 seconds.'],
      ['💧', 'Refill your water and take a few sips.'],
      ['🫁', 'Box breathing: in 4 · hold 4 · out 4 · hold 4. Repeat a few times.'],
      ['🚶', 'Walk around for a minute. A little movement refreshes attention.'],
      ['📵', 'Step away from screens. Scrolling isn’t rest for your brain.'],
      ['😌', 'Close your eyes and relax your jaw, shoulders and forehead.'],
    ],
    long: [
      ['🌳', 'Take a short walk, ideally outside in daylight.'],
      ['🍎', 'Have a light snack and some water.'],
      ['🧘', 'Do a few minutes of gentle stretching or mobility work.'],
      ['🧹', 'Tidy your desk so the next round starts clean.'],
      ['✅', 'Note what you finished and what comes next.'],
    ],
  };

  // How the scene behaves in each phase. Motion is a speed multiplier; the filter dims,
  // desaturates and softens the scene. Breaks always come fully alive: nature-like
  // scenery helps attention recover, so visuals earn their place there.
  const FULL = { motion: 1, filter: 'none' };
  const IMMERSION = {
    calm: {
      name: 'Calm', icon: '🌙',
      blurb: 'The scene dims, softens and goes still while you focus, and people’s voices fade to a soft, wordless murmur. Best for reading, revision and exams.',
      focus: { motion: 0, filter: 'brightness(.5) saturate(.55) blur(4px)' },
      idle: { motion: 0.35, filter: 'brightness(.85) saturate(.85)' },
    },
    balanced: {
      name: 'Balanced', icon: '🌗',
      blurb: 'The scene gently fades and slows during focus, then comes back to life on breaks.',
      focus: { motion: 0.3, filter: 'brightness(.72) saturate(.8) blur(1.5px)' },
      idle: FULL,
    },
    immersive: {
      name: 'Immersive', icon: '☀️',
      blurb: 'The full scene and motion all the time. The most atmospheric, and the most distracting.',
      focus: FULL,
      idle: FULL,
    },
  };

  // ---------- Settings & state ----------
  const DEFAULTS = {
    technique: 'pomodoro',
    custom: { focus: 30, short: 5, long: 20, every: 4 },
    autoBreaks: true,
    autoFocus: false,
    chime: true,
    notify: false,
    dimBreaks: true,
    immersion: 'balanced',
    wakeLock: true,
    sceneDark: false,
    soundOn: true,
    volume: 0.7,
    chimeVol: 0.6,
    env: 'coffee',
    mix: {},
  };
  const saved = store.get('settings', {});
  const settings = Object.assign({}, DEFAULTS, saved);
  settings.custom = Object.assign({}, DEFAULTS.custom, saved.custom);
  if (!TECHNIQUES[settings.technique]) settings.technique = 'pomodoro';
  if (!IMMERSION[settings.immersion]) settings.immersion = 'balanced';
  delete settings.motion;
  const saveSettings = () => store.set('settings', settings);

  const tech = () => (settings.technique === 'custom' ? { ...TECHNIQUES.custom, ...settings.custom } : TECHNIQUES[settings.technique]);
  const minutesFor = (mode) => tech()[mode === 'focus' ? 'focus' : mode];
  const secondsFor = (mode) => Math.max(1, Math.round(minutesFor(mode) * 60));

  const timer = Object.assign(
    { mode: 'focus', running: false, endAt: 0, remaining: secondsFor('focus'), total: secondsFor('focus'), cycle: 0 },
    store.get('timer', {}),
  );
  const saveTimer = () => store.set('timer', timer);

  let tasks = store.get('tasks', []);
  let currentTaskId = store.get('currentTask', null);
  const saveTasks = () => { store.set('tasks', tasks); store.set('currentTask', currentTaskId); };

  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const stats = store.get('stats', {});
  const today = () => stats[todayKey()] || { sessions: 0, minutes: 0 };
  function addStats(sessions, minutes) {
    const k = todayKey();
    const s = today();
    stats[k] = { sessions: s.sessions + sessions, minutes: s.minutes + minutes };
    store.set('stats', stats);
    renderStats();
  }

  // ---------- Progression: earn places by focusing ----------
  const lifetimeSessions = () => Object.values(stats).reduce((n, d) => n + (d.sessions || 0), 0);
  function lockInfo(id) {
    const need = FP.envById(id).unlock || 0;
    const done = lifetimeSessions();
    return { need, done, remaining: Math.max(0, need - done), locked: FP.config.lockPlaces && !FP.premium.active && done < need };
  }
  const isUnlocked = (id) => !lockInfo(id).locked;
  const unlockedIds = () => FP.environments.filter((e) => isUnlocked(e.id)).map((e) => e.id);
  function progress() {
    const locked = FP.environments.filter((e) => !isUnlocked(e.id)).sort((a, b) => a.unlock - b.unlock);
    const next = locked[0];
    return {
      unlocked: FP.environments.length - locked.length,
      total: FP.environments.length,
      done: lifetimeSessions(),
      premium: FP.premium.active,
      allOpen: !FP.config.lockPlaces,
      next: next && { env: next, remaining: lockInfo(next.id).remaining },
    };
  }
  // Places unlocked since the map was last opened, so the map can celebrate them.
  function takeNewPlaces() {
    const ids = store.get('newPlaces', []);
    store.set('newPlaces', []);
    return ids;
  }
  function lockedMessage(id) {
    const e = FP.envById(id);
    const r = lockInfo(id).remaining;
    return `${e.emoji} ${e.name} unlocks after ${r} more focus session${r === 1 ? '' : 's'}, or get every place now with Premium.`;
  }

  // Number keys 1–9 then 0 pick the first ten places.
  const placeForKey = (key) => FP.environments[key === '0' ? 9 : +key - 1];

  // ---------- Elements ----------
  const el = {
    time: $('#time'), modeLabel: $('#modeLabel'), techLabel: $('#techLabel'), ring: $('#ringProgress'),
    dots: $('#sessionDots'), start: $('#startBtn'), startLabel: $('#startLabel'), reset: $('#resetBtn'), skip: $('#skipBtn'),
    intention: $('#intention'), tip: $('#tip'), tipIcon: $('#tipIcon'), tipText: $('#tipText'),
    mapBtnWhere: $('#mapBtnWhere'), soundToggle: $('#soundToggle'), panel: $('#panel'), scrim: $('#scrim'),
    techniques: $('#techniques'), customFields: $('#customFields'), mixer: $('#mixer'), mixTitle: $('#mixTitle'),
    masterVol: $('#masterVol'), chimeVol: $('#chimeVol'), taskForm: $('#taskForm'), taskInput: $('#taskInput'),
    taskList: $('#taskList'), toast: $('#toast'), todayStats: $('#todayStats'), canvas: $('#scene'),
    mini: $('#miniTimer'), miniTime: $('#miniTime'), miniMode: $('#miniMode'), miniBar: $('#miniBar'), miniPlay: $('#miniPlay'),
  };
  const RING_C = 2 * Math.PI * 100;
  el.ring.style.strokeDasharray = RING_C;

  // ---------- Timer ----------
  const fmt = (s) => {
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const two = (n) => String(n).padStart(2, '0');
    return hh ? `${hh}:${two(mm)}:${two(ss)}` : `${two(mm)}:${two(ss)}`;
  };

  function setMode(mode, { keepCycle = true } = {}) {
    timer.mode = mode;
    timer.total = secondsFor(mode);
    timer.remaining = timer.total;
    timer.running = false;
    if (!keepCycle) timer.cycle = 0;
    pickTip();
    applyDuck();
    saveTimer();
    render();
  }

  function start() {
    unlockAudio();
    if (timer.remaining <= 0) timer.remaining = timer.total;
    timer.endAt = Date.now() + timer.remaining * 1000;
    timer.running = true;
    saveTimer();
    requestWakeLock();
    render();
    scheduleZen();
  }

  function pause() {
    timer.remaining = Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000));
    timer.running = false;
    saveTimer();
    releaseWakeLock();
    exitZen();
    render();
  }

  function reset() {
    timer.running = false;
    timer.remaining = timer.total;
    saveTimer();
    releaseWakeLock();
    exitZen();
    render();
  }

  function skip() {
    if (timer.mode === 'focus') {
      const elapsed = timer.total - currentRemaining();
      if (elapsed >= 60) addStats(0, Math.round(elapsed / 60));
      setMode(nextBreak(timer.cycle + 1));
    } else {
      if (timer.mode === 'long') timer.cycle = 0;
      setMode('focus');
    }
    releaseWakeLock();
    exitZen();
  }

  const nextBreak = (cycleAfter) => {
    const every = tech().every;
    return every && cycleAfter % every === 0 ? 'long' : 'short';
  };

  function complete({ silent = false } = {}) {
    const finished = timer.mode;
    if (finished === 'focus') {
      const before = unlockedIds();
      addStats(1, Math.round(timer.total / 60));
      const fresh = unlockedIds().filter((id) => !before.includes(id));
      if (fresh.length) {
        store.set('newPlaces', [...store.get('newPlaces', []), ...fresh]);
        if (!silent) {
          const names = fresh.map((id) => `${FP.envById(id).emoji} ${FP.envById(id).name}`).join(' and ');
          setTimeout(() => {
            toast(`🎉 New place unlocked: ${names}! Open the map to visit.`);
            if (settings.chime) audio.chime('unlock');
          }, 4200);
        }
      }
      timer.cycle += 1;
      const task = tasks.find((t) => t.id === currentTaskId);
      if (task) { task.poms = (task.poms || 0) + 1; saveTasks(); renderTasks(); }
      const next = nextBreak(timer.cycle);
      setMode(next);
      if (!silent) {
        // Now that the break has begun: a deferred Friday card, or a milestone card.
        if (!maybeShowFridayDua(4500)) maybeShowDua();
        announce('Focus session complete! 🎉', `Time for a ${next === 'long' ? 'long' : 'short'} break: ${minutesFor(next)} minutes.`, 'break');
        if (settings.autoBreaks) start();
      }
    } else {
      if (finished === 'long') timer.cycle = 0;
      setMode('focus');
      if (!silent) {
        announce('Break’s over.', 'Ready for another focus session?', 'focus');
        if (settings.autoFocus) start();
      }
    }
    if (!timer.running) { releaseWakeLock(); exitZen(); }
  }

  const currentRemaining = () => (timer.running ? Math.max(0, Math.ceil((timer.endAt - Date.now()) / 1000)) : timer.remaining);

  function tick() {
    if (!timer.running) return;
    const r = currentRemaining();
    if (r !== timer.remaining) {
      timer.remaining = r;
      if (r <= 0) complete();
      else renderTime();
    }
  }

  // ---------- Rendering ----------
  const MODE_NAMES = { focus: 'Focus', short: 'Short break', long: 'Long break' };

  function renderTime() {
    const r = timer.remaining;
    el.time.textContent = fmt(r);
    const progress = timer.total ? 1 - r / timer.total : 0;
    el.ring.style.strokeDashoffset = RING_C * (1 - progress);
    el.miniTime.textContent = fmt(r);
    el.miniBar.style.width = `${progress * 100}%`;
    const label = timer.running || r !== timer.total ? `${fmt(r)} · ${MODE_NAMES[timer.mode]}` : null;
    document.title = label ? `${label} — FocusPal` : 'FocusPal';
    FP.map.setTimer(label ? `${timer.running ? '⏱' : '⏸'} ${MODE_NAMES[timer.mode]} · ${fmt(r)}` : '');
  }

  function render() {
    document.body.dataset.mode = timer.mode;
    document.body.classList.toggle('running', timer.running);
    applyImmersion();
    el.modeLabel.textContent = timer.running ? MODE_NAMES[timer.mode] : (timer.remaining === timer.total ? `Ready · ${MODE_NAMES[timer.mode]}` : 'Paused');
    el.startLabel.textContent = timer.running ? 'Pause' : timer.remaining === timer.total ? 'Start' : 'Resume';
    el.start.setAttribute('aria-label', `${el.startLabel.textContent} timer (Space)`);
    el.miniMode.textContent = timer.running ? MODE_NAMES[timer.mode] : el.modeLabel.textContent;
    el.miniPlay.setAttribute('aria-label', `${el.startLabel.textContent} timer`);
    $$('.mode-tabs button').forEach((b) => {
      const on = b.dataset.mode === timer.mode;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on);
    });
    const t = tech();
    el.techLabel.textContent = `${t.name.replace(/\s+\d.*$/, '')} · ${t.focus} / ${t.short}`;
    const every = t.every;
    el.dots.innerHTML = '';
    if (every) {
      const done = timer.mode === 'long' ? every : timer.cycle % every;
      for (let i = 0; i < every; i++) {
        const d = document.createElement('span');
        d.className = 'dot' + (i < done ? ' done' : '');
        el.dots.appendChild(d);
      }
      el.dots.setAttribute('aria-label', `${done} of ${every} sessions before a long break`);
    } else {
      el.dots.textContent = `Session ${today().sessions + (timer.mode === 'focus' ? 1 : 0)} today`;
    }
    renderTime();
  }

  function renderStats() {
    const s = today();
    el.todayStats.textContent = `${s.sessions} session${s.sessions === 1 ? '' : 's'} · ${s.minutes} min today`;
  }

  let tipIndex = {};
  function pickTip() {
    const list = TIPS[timer.mode];
    tipIndex[timer.mode] = ((tipIndex[timer.mode] ?? Math.floor(Math.random() * list.length)) + 1) % list.length;
    const [icon, text] = list[tipIndex[timer.mode]];
    el.tipIcon.textContent = icon;
    el.tipText.textContent = text;
  }

  // ---------- Notifications ----------
  let toastTimer;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), 3800);
  }

  function announce(title, body, chimeKind) {
    toast(`${title} ${body}`);
    if (settings.chime) audio.chime(chimeKind);
    if (settings.notify && 'Notification' in window && Notification.permission === 'granted' && document.hidden) {
      try { new Notification(title, { body, tag: 'focuspal', silent: true }); } catch (e) { /* unsupported */ }
    }
  }

  // ---------- Wake lock ----------
  let wakeLock = null;
  async function requestWakeLock() {
    if (!settings.wakeLock || timer.mode !== 'focus' || !('wakeLock' in navigator) || wakeLock) return;
    try {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (e) { wakeLock = null; }
  }
  function releaseWakeLock() {
    if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && timer.running) requestWakeLock();
  });

  // ---------- Audio ----------
  const env = () => FP.envById(settings.env);
  // Ambience only plays once the user has arrived somewhere on the map.
  let entered = false;
  const layerVol = (e, l) => {
    const m = settings.mix[e.id];
    return m && m[l.id] != null ? m[l.id] : l.vol;
  };

  function unlockAudio() {
    if (!audio.init()) return;
    audio.setVolume(settings.volume);
    audio.setChimeVolume(settings.chimeVol);
    if (settings.soundOn) startAmbience();
  }

  function startAmbience() {
    if (!audio.ready || !settings.soundOn || !entered) return;
    const e = env();
    const keys = new Set();
    e.layers.forEach((l) => {
      const key = `${e.id}:${l.id}`;
      keys.add(key);
      if (!audio.active.has(key)) audio.startLayer(key, l, layerVol(e, l));
    });
    [...audio.active.keys()].forEach((k) => { if (!keys.has(k)) audio.stopLayer(k); });
    applyDuck();
  }

  function applyDuck() {
    if (FP.map.isOpen && !FP.map.traveling) audio.setDuck(0.3);
    else audio.setDuck(settings.dimBreaks && timer.mode !== 'focus' ? 0.45 : 1);
  }

  function setSoundOn(on) {
    settings.soundOn = on;
    saveSettings();
    document.body.classList.toggle('sound-off', !on);
    if (on) unlockAudio();
    else audio.stopAll(0.8);
  }

  // ---------- Scenes ----------
  const ctx = el.canvas.getContext('2d');
  let scene = null;
  let W = 0, H = 0, DPR = 1;
  let sceneTime = 0;
  let lastDraw = 0;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function buildScene() {
    if (scene && scene.destroy) scene.destroy();
    const factory = FP.scenes[env().scene];
    scene = factory(W, H, DPR);
    drawFrame(0);
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    el.canvas.width = Math.round(W * DPR);
    el.canvas.height = Math.round(H * DPR);
    buildScene();
  }

  function drawFrame(dt) {
    if (!scene) return;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    scene.draw(ctx, sceneTime, dt);
  }

  // ---------- Immersion (calm focus mode) ----------
  let motion = 1;
  let motionTarget = 1;

  function phase() {
    if (timer.mode !== 'focus') return 'break';
    return timer.running ? 'focus' : 'idle';
  }

  function applyImmersion() {
    const level = IMMERSION[settings.immersion];
    const p = phase();
    const look = p === 'break' ? FULL : level[p];
    motionTarget = look.motion;
    el.canvas.style.setProperty('--scene-filter', look.filter);
    document.body.dataset.phase = p;
    // Intelligible speech disrupts reading and memorising, so Calm focus muffles voices too.
    audio.setSpeechMuffled(settings.immersion === 'calm' && p === 'focus');
    // Chrome only hides during focus; breaks keep their tips visible.
    if (p !== 'focus') exitZen();
  }

  function setImmersion(id, { announce = true } = {}) {
    if (!IMMERSION[id]) return;
    settings.immersion = id;
    saveSettings();
    renderImmersion();
    applyImmersion();
    if (announce) toast(`${IMMERSION[id].icon} ${IMMERSION[id].name}: ${IMMERSION[id].blurb}`);
  }

  function renderImmersion() {
    const box = $('#immersion');
    box.innerHTML = '';
    Object.entries(IMMERSION).forEach(([id, lvl]) => {
      const b = document.createElement('button');
      const on = settings.immersion === id;
      b.className = 'immersion-opt' + (on ? ' active' : '');
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', on);
      b.innerHTML = `<span class="immersion-icon" aria-hidden="true">${lvl.icon}</span><span class="immersion-name">${lvl.name}${id === 'balanced' ? ' <small>default</small>' : ''}</span>`;
      b.title = lvl.blurb;
      b.addEventListener('click', () => setImmersion(id));
      box.appendChild(b);
    });
    $('#immersionBlurb').textContent = IMMERSION[settings.immersion].blurb;
  }

  function loop(now) {
    requestAnimationFrame(loop);
    if (FP.map.isOpen && !FP.map.traveling) return;
    const target = motionTarget * (reduceMotion.matches ? 0.35 : 1);
    // Fully still: keep the last frame and spend no power redrawing it.
    if (target === 0 && motion < 0.003) return;
    // ~30 fps is plenty for ambient scenes; slow scenes need even fewer frames.
    if (now - lastDraw < (motion < 0.2 ? 80 : 32)) return;
    const real = Math.min(0.15, (now - lastDraw) / 1000);
    lastDraw = now;
    // Ease toward the target over a few seconds: abrupt visual change grabs attention.
    motion += (target - motion) * Math.min(1, real * 0.7);
    if (Math.abs(target - motion) < 0.002) motion = target;
    const step = real * motion;
    sceneTime += step;
    drawFrame(step);
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 150);
  });

  // ---------- Environments ----------
  function renderWhere() {
    el.mapBtnWhere.textContent = `${env().emoji} ${env().name}`;
  }

  function applyAccent() {
    const e = env();
    document.documentElement.style.setProperty('--accent', e.accent);
    document.body.classList.toggle('light-scene', !!e.light);
    document.querySelector('meta[name=theme-color]').setAttribute('content', e.accent);
  }

  let switching = false;
  function selectEnv(id, { announce = true } = {}) {
    unlockAudio();
    if (id === settings.env && scene) {
      startAmbience();
      return;
    }
    settings.env = id;
    saveSettings();
    renderWhere();
    applyAccent();
    renderMixer();
    startAmbience();
    if (announce) toast(`${env().emoji} ${env().name}: ${env().tagline}`);
    if (switching) return;
    switching = true;
    el.canvas.classList.add('fading');
    setTimeout(() => {
      buildScene();
      el.canvas.classList.remove('fading');
      switching = false;
    }, 450);
  }

  // ---------- Map ----------
  FP.map.init({
    onGesture: unlockAudio,
    hasEntered: () => entered,
    lockInfo,
    progress,
    takeNewPlaces,
    onLocked: (id) => FP.premium.open(id ? lockedMessage(id) : null),
    onEnter: (id) => {
      entered = true;
      selectEnv(id, { announce: false });
    },
    onOpen: () => {
      closePanel();
      exitZen();
      applyDuck();
    },
    onClose: () => {
      applyDuck();
      scheduleZen();
    },
  });
  const openMap = () => FP.map.open(settings.env);

  // ---------- Premium ----------
  FP.premium.init();
  const renderPremium = () => {
    document.body.classList.toggle('is-premium', FP.premium.active);
    $('#premiumBtn .premium-chip-label').textContent = FP.premium.active ? 'Premium' : 'Go Premium';
    // With every place open there's nothing to sell yet.
    $('#premiumBtn').hidden = !FP.config.lockPlaces;
  };
  $('#premiumBtn').addEventListener('click', () => FP.premium.open());
  FP.premium.onChange((on) => {
    renderPremium();
    FP.map.refresh();
    toast(on ? '✨ Premium is on: every place is open.' : 'Premium is off: places unlock as you focus.');
  });
  renderPremium();
  $('#mapBtn').addEventListener('click', openMap);

  // ---------- Avatar (optional) ----------
  const ICON_PERSON = '<svg class="plus" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>';
  function renderAvatar() {
    const a = FP.avatar.get();
    $('#avatarBtn').innerHTML = a ? FP.avatar.svg(a, { size: 42 }) : ICON_PERSON;
    $('#avatarBtn').title = a ? 'Change your animal' : 'Choose your animal (optional)';
    $('#mapAvatarBtn').innerHTML = a ? `${FP.avatar.svg(a, { size: 26 })}<span>Change animal</span>` : `${ICON_PERSON}<span>Choose your animal</span>`;
    FP.map.setAvatar(a ? FP.avatar.svg(a, { size: 32 }) : null);
  }
  $('#avatarBtn').addEventListener('click', () => FP.avatar.open());
  $('#mapAvatarBtn').addEventListener('click', () => FP.avatar.open());
  FP.avatar.onChange((a) => {
    renderAvatar();
    toast(a ? '🐾 Saved. Your animal travels with you on the map.' : 'Back to the default pin.');
  });
  renderAvatar();

  // ---------- Mixer ----------
  const setFill = (input) => input.style.setProperty('--fill', `${input.value * 100}%`);

  function renderMixer() {
    const e = env();
    el.mixTitle.textContent = `${e.emoji} ${e.name}`;
    el.mixer.innerHTML = '';
    e.layers.forEach((l) => {
      const row = document.createElement('div');
      row.className = 'mixer-row';
      const id = `mix-${e.id}-${l.id}`;
      row.innerHTML = `<label class="mix-name" for="${id}">${l.name}${l.speech ? ' <small title="Voices are turned down and muffled during Calm focus so words can’t pull your attention.">· softer in Calm focus</small>' : ''}</label><input type="range" min="0" max="1" step="0.01" id="${id}">`;
      const input = row.querySelector('input');
      input.value = layerVol(e, l);
      setFill(input);
      input.addEventListener('input', () => {
        unlockAudio();
        const v = parseFloat(input.value);
        settings.mix[e.id] = Object.assign({}, settings.mix[e.id], { [l.id]: v });
        audio.setLayerVolume(`${e.id}:${l.id}`, v);
        setFill(input);
        saveSettings();
      });
      el.mixer.appendChild(row);
    });
  }

  // ---------- Techniques panel ----------
  function renderTechniques() {
    el.techniques.innerHTML = '';
    Object.entries(TECHNIQUES).forEach(([id, t]) => {
      const v = id === 'custom' ? { ...t, ...settings.custom } : t;
      const b = document.createElement('button');
      b.className = 'tech' + (settings.technique === id ? ' active' : '');
      b.setAttribute('aria-pressed', settings.technique === id);
      const longNote = v.every ? ` · ${v.long}′ every ${v.every}` : '';
      b.innerHTML = `
        <div class="tech-top"><span class="tech-name">${t.name}</span><span class="tech-badge">${v.focus}′ / ${v.short}′${longNote}</span></div>
        <p class="tech-blurb">${t.blurb}</p>
        <div class="tech-best"><b>Best for:</b> ${t.best}</div>`;
      b.addEventListener('click', () => selectTechnique(id));
      el.techniques.appendChild(b);
    });
    el.customFields.classList.toggle('show', settings.technique === 'custom');
    $$('[data-custom]').forEach((input) => { input.value = settings.custom[input.dataset.custom]; });
  }

  function selectTechnique(id) {
    if (settings.technique === id) return;
    settings.technique = id;
    saveSettings();
    renderTechniques();
    timer.cycle = 0;
    setMode('focus');
    toast(`${TECHNIQUES[id].name}: ${tech().focus} min focus · ${tech().short} min break`);
  }

  $$('[data-custom]').forEach((input) => {
    input.addEventListener('change', () => {
      const key = input.dataset.custom;
      const min = key === 'every' ? 0 : 1;
      const max = parseInt(input.max, 10);
      const v = Math.min(max, Math.max(min, Math.round(parseFloat(input.value) || 0)));
      input.value = v;
      settings.custom[key] = v;
      saveSettings();
      renderTechniques();
      if (!timer.running) setMode(timer.mode);
      else render();
    });
  });

  // ---------- Toggles ----------
  $$('[data-setting]').forEach((input) => {
    const key = input.dataset.setting;
    input.checked = !!settings[key];
    input.addEventListener('change', async () => {
      settings[key] = input.checked;
      if (key === 'notify' && input.checked) {
        if (!('Notification' in window)) {
          toast('Notifications aren’t supported in this browser.');
          input.checked = settings.notify = false;
        } else if (Notification.permission !== 'granted') {
          const p = await Notification.requestPermission();
          if (p !== 'granted') {
            toast('Notifications were blocked. You can allow them in your browser’s site settings.');
            input.checked = settings.notify = false;
          }
        }
      }
      if (key === 'dimBreaks') applyDuck();
      if (key === 'sceneDark') applyNight();
      if (key === 'wakeLock') { if (input.checked && timer.running) requestWakeLock(); else releaseWakeLock(); }
      saveSettings();
    });
  });

  // ---------- Tasks ----------
  const ICON_TARGET = '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3.5"/></svg>';
  const ICON_X = '<svg viewBox="0 0 24 24"><path d="M7 7l10 10M17 7L7 17"/></svg>';

  function renderTasks() {
    el.taskList.innerHTML = '';
    if (!tasks.length) {
      const li = document.createElement('li');
      li.className = 'task-empty';
      li.textContent = 'No tasks yet. Add one above, then pick it to focus on.';
      el.taskList.appendChild(li);
      return;
    }
    tasks.forEach((t) => {
      const li = document.createElement('li');
      li.className = 'task' + (t.done ? ' done' : '') + (t.id === currentTaskId ? ' current' : '');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = t.done;
      cb.setAttribute('aria-label', `Mark “${t.text}” done`);
      cb.addEventListener('change', () => {
        t.done = cb.checked;
        if (t.done && t.id === currentTaskId) {
          currentTaskId = null;
          el.intention.value = '';
          store.set('intention', '');
          toast('Nice work! Task complete ✅');
        }
        saveTasks();
        renderTasks();
      });
      const text = document.createElement('span');
      text.className = 'task-text';
      text.textContent = t.text;
      const poms = document.createElement('span');
      poms.className = 'task-poms';
      poms.textContent = t.poms ? `🍅 ${t.poms}` : '';
      const focusBtn = document.createElement('button');
      focusBtn.innerHTML = ICON_TARGET;
      focusBtn.title = 'Focus on this';
      focusBtn.setAttribute('aria-label', `Focus on “${t.text}”`);
      focusBtn.addEventListener('click', () => {
        currentTaskId = t.id;
        t.done = false;
        el.intention.value = t.text;
        store.set('intention', t.text);
        saveTasks();
        renderTasks();
        closePanel();
      });
      const del = document.createElement('button');
      del.innerHTML = ICON_X;
      del.title = 'Remove';
      del.setAttribute('aria-label', `Remove “${t.text}”`);
      del.addEventListener('click', () => {
        tasks = tasks.filter((x) => x.id !== t.id);
        if (currentTaskId === t.id) currentTaskId = null;
        saveTasks();
        renderTasks();
      });
      li.append(cb, text, poms, focusBtn, del);
      el.taskList.appendChild(li);
    });
  }

  el.taskForm.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const text = el.taskInput.value.trim();
    if (!text) return;
    const task = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), text, done: false, poms: 0 };
    tasks.push(task);
    if (!currentTaskId && !el.intention.value.trim()) {
      currentTaskId = task.id;
      el.intention.value = text;
      store.set('intention', text);
    }
    el.taskInput.value = '';
    saveTasks();
    renderTasks();
  });

  $('#clearDone').addEventListener('click', () => {
    tasks = tasks.filter((t) => !t.done);
    saveTasks();
    renderTasks();
  });

  el.intention.value = store.get('intention', '');
  el.intention.addEventListener('input', () => {
    const v = el.intention.value;
    store.set('intention', v);
    const match = tasks.find((t) => t.text === v.trim() && !t.done);
    currentTaskId = match ? match.id : null;
    saveTasks();
  });
  el.intention.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      el.intention.blur();
      if (!timer.running) start();
    }
  });

  // ---------- Panel ----------
  function openPanel(tab) {
    $$('.panel-tabs button').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === tab);
      b.setAttribute('aria-selected', b.dataset.tab === tab);
    });
    $$('.panel-body').forEach((p) => p.classList.toggle('active', p.dataset.tab === tab));
    el.panel.classList.add('open');
    el.panel.setAttribute('aria-hidden', 'false');
    el.scrim.classList.add('show');
    exitZen();
    if (tab === 'tasks') setTimeout(() => el.taskInput.focus(), 300);
  }
  function closePanel() {
    el.panel.classList.remove('open');
    el.panel.setAttribute('aria-hidden', 'true');
    el.scrim.classList.remove('show');
    scheduleZen();
  }
  $$('[data-open]').forEach((b) => b.addEventListener('click', () => {
    const tab = b.dataset.open;
    if (el.panel.classList.contains('open') && $(`.panel-body[data-tab="${tab}"]`).classList.contains('active')) closePanel();
    else openPanel(tab);
  }));
  $$('.panel-tabs button').forEach((b) => b.addEventListener('click', () => openPanel(b.dataset.tab)));
  $('#closePanel').addEventListener('click', closePanel);
  el.scrim.addEventListener('click', closePanel);

  // ---------- Zen mode (hide chrome while focusing) ----------
  let zenTimer;
  function scheduleZen() {
    clearTimeout(zenTimer);
    if (!timer.running || timer.mode !== 'focus' || focusMode || el.panel.classList.contains('open') || FP.map.isOpen) return;
    zenTimer = setTimeout(() => {
      if (timer.running && timer.mode === 'focus' && !FP.map.isOpen && !el.panel.classList.contains('open') && document.activeElement !== el.intention) {
        document.body.classList.add('zen');
      }
    }, 5000);
  }
  function exitZen() {
    clearTimeout(zenTimer);
    document.body.classList.remove('zen');
  }
  ['mousemove', 'pointerdown', 'keydown', 'touchstart'].forEach((ev) => {
    window.addEventListener(ev, () => {
      if (document.body.classList.contains('zen')) document.body.classList.remove('zen');
      scheduleZen();
    }, { passive: true });
  });

  // ---------- A gentle prayer request ----------
  // Shown at the start of a break (never during focus) after the 3rd completed
  // focus session, and once more after the 30th. Each milestone shows at most once.
  const DUA_MILESTONES = [3, 30];
  function maybeShowDua() {
    const done = lifetimeSessions();
    // Earlier versions stored a single flag for the first milestone.
    const seen = store.get('duaSeen', store.get('duaShown', false) ? [3] : []);
    const due = DUA_MILESTONES.filter((m) => done >= m && !seen.includes(m));
    if (!due.length) return;
    // Passing several milestones at once still shows the card only once.
    store.set('duaSeen', [...seen, ...due]);
    showDua(4500);
  }

  // Fridays: the card once when FocusPal opens (local time). If a focus session is
  // running at that moment, it waits for the next break instead.
  function maybeShowFridayDua(delay) {
    if (new Date().getDay() !== 5) return false;
    if (store.get('duaFriday', '') === todayKey()) return false;
    if (timer.running && timer.mode === 'focus') return false;
    store.set('duaFriday', todayKey());
    showDua(delay);
    return true;
  }

  function showDua(delay) {
    setTimeout(() => {
      const card = $('#duaCard');
      card.hidden = false;
      requestAnimationFrame(() => card.classList.add('show'));
    }, delay);
  }
  function closeDua() {
    const card = $('#duaCard');
    card.classList.remove('show');
    setTimeout(() => { card.hidden = true; }, 500);
  }
  $('#duaClose').addEventListener('click', closeDua);

  // ---------- Night lighting ----------
  function applyNight() {
    const on = !!settings.sceneDark;
    document.body.classList.toggle('scene-dark', on);
    const btn = $('#nightBtn');
    btn.setAttribute('aria-pressed', on);
    btn.setAttribute('aria-label', on ? 'Turn off night lighting' : 'Turn on night lighting');
    btn.title = on ? 'Day lighting (D)' : 'Night lighting (D)';
    const box = $('[data-setting="sceneDark"]');
    if (box) box.checked = on;
  }
  function toggleNight() {
    settings.sceneDark = !settings.sceneDark;
    saveSettings();
    applyNight();
    toast(settings.sceneDark ? '🌙 Night lighting on' : '☀️ Night lighting off');
  }
  $('#nightBtn').addEventListener('click', toggleNight);

  // ---------- Focus mode (full screen, no buttons) ----------
  let focusMode = false;
  let hintTimer;
  let lastTap = 0;
  const isFullscreen = () => !!(document.fullscreenElement || document.webkitFullscreenElement);

  function showFocusHint() {
    if (!focusMode) return;
    $('#focusHint').classList.add('show');
    document.body.classList.remove('idle');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => {
      $('#focusHint').classList.remove('show');
      if (focusMode) document.body.classList.add('idle');
    }, 2500);
  }

  function enterFocusMode() {
    if (focusMode || FP.map.isOpen) return;
    focusMode = true;
    closePanel();
    exitZen();
    $('#focusIntent').textContent = el.intention.value.trim();
    document.body.classList.add('focus-mode');
    if (!timer.running) start();
    // Full screen where the browser allows it; focus mode works without it too.
    const root = document.documentElement;
    const req = root.requestFullscreen || root.webkitRequestFullscreen;
    try { const p = req && req.call(root); if (p && p.catch) p.catch(() => {}); } catch (e) { /* not allowed here */ }
    showFocusHint();
  }

  function exitFocusMode() {
    if (!focusMode) return;
    focusMode = false;
    clearTimeout(hintTimer);
    document.body.classList.remove('focus-mode', 'idle');
    $('#focusHint').classList.remove('show');
    if (isFullscreen()) {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      try { const p = exit.call(document); if (p && p.catch) p.catch(() => {}); } catch (e) { /* ignore */ }
    }
    scheduleZen();
  }

  $('#focusModeBtn').addEventListener('click', enterFocusMode);
  document.addEventListener('dblclick', () => { if (focusMode) exitFocusMode(); });
  // Phones: a double tap leaves focus mode; a single tap just shows the hint.
  window.addEventListener('pointerup', (e) => {
    if (!focusMode || e.pointerType === 'mouse') return;
    const now = Date.now();
    if (now - lastTap < 350) exitFocusMode();
    else showFocusHint();
    lastTap = now;
  });
  window.addEventListener('mousemove', showFocusHint, { passive: true });
  ['fullscreenchange', 'webkitfullscreenchange'].forEach((ev) => document.addEventListener(ev, () => {
    // Leaving full screen (e.g. the browser's own Esc) also leaves focus mode.
    if (focusMode && !isFullscreen()) exitFocusMode();
  }));

  // ---------- Minimized timer ----------
  function setMinimized(on, { focus = true } = {}) {
    settings.timerMin = on;
    saveSettings();
    document.body.classList.toggle('timer-min', on);
    el.mini.hidden = !on;
    if (focus) (on ? $('#miniExpand') : $('#minBtn')).focus({ preventScroll: true });
  }
  $('#minBtn').addEventListener('click', () => setMinimized(true));
  $('#miniOpen').addEventListener('click', () => setMinimized(false));
  $('#miniExpand').addEventListener('click', () => setMinimized(false));
  el.miniPlay.addEventListener('click', () => (timer.running ? pause() : start()));

  // ---------- Controls ----------
  el.start.addEventListener('click', () => (timer.running ? pause() : start()));
  el.reset.addEventListener('click', reset);
  el.skip.addEventListener('click', skip);
  $$('.mode-tabs button').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.mode === timer.mode && !timer.running) return;
    releaseWakeLock();
    exitZen();
    setMode(b.dataset.mode);
  }));
  el.soundToggle.addEventListener('click', () => setSoundOn(!settings.soundOn || !audio.active.size));

  el.masterVol.value = settings.volume;
  el.chimeVol.value = settings.chimeVol;
  setFill(el.masterVol);
  setFill(el.chimeVol);
  el.masterVol.addEventListener('input', () => {
    settings.volume = parseFloat(el.masterVol.value);
    setFill(el.masterVol);
    unlockAudio();
    audio.setVolume(settings.volume);
    saveSettings();
  });
  el.chimeVol.addEventListener('input', () => {
    settings.chimeVol = parseFloat(el.chimeVol.value);
    setFill(el.chimeVol);
    audio.setChimeVolume(settings.chimeVol);
    saveSettings();
  });
  el.chimeVol.addEventListener('change', () => { unlockAudio(); audio.chime('focus'); });
  $('#resetMix').addEventListener('click', () => {
    const e = env();
    delete settings.mix[e.id];
    saveSettings();
    e.layers.forEach((l) => audio.setLayerVolume(`${e.id}:${l.id}`, l.vol));
    renderMixer();
  });

  function toggleFullscreen() {
    const d = document;
    if (!d.fullscreenElement && !d.webkitFullscreenElement) {
      const r = d.documentElement;
      (r.requestFullscreen || r.webkitRequestFullscreen).call(r)?.catch?.(() => {});
    } else {
      (d.exitFullscreen || d.webkitExitFullscreen).call(d);
    }
  }
  $('#fullscreenBtn').addEventListener('click', toggleFullscreen);

  window.addEventListener('keydown', (ev) => {
    const tag = (ev.target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || ev.metaKey || ev.ctrlKey || ev.altKey) return;
    const key = ev.key.toLowerCase();
    if (FP.avatar.isOpen) {
      if (key === 'escape') FP.avatar.close();
      return;
    }
    if (FP.premium.isOpen) {
      if (key === 'escape') FP.premium.close();
      return;
    }
    if (focusMode) {
      if (key === 'escape' || key === 'z') exitFocusMode();
      else if (key === ' ' || key === 'spacebar') {
        ev.preventDefault();
        timer.running ? pause() : start();
      }
      showFocusHint();
      return;
    }
    if (FP.map.isOpen) {
      if (key === 'escape' || key === 'm') FP.map.close();
      else if (/^[0-9]$/.test(key) && placeForKey(key)) FP.map.travel(placeForKey(key).id);
      return;
    }
    if (key === ' ' || key === 'spacebar') {
      if (tag === 'button') return;
      ev.preventDefault();
      timer.running ? pause() : start();
    } else if (key === 'r') reset();
    else if (key === 's') skip();
    else if (key === 'm') openMap();
    else if (key === 'a') setSoundOn(!settings.soundOn || !audio.active.size);
    else if (key === 'i') {
      const ids = Object.keys(IMMERSION);
      setImmersion(ids[(ids.indexOf(settings.immersion) + 1) % ids.length]);
    }
    else if (key === 'f') toggleFullscreen();
    else if (key === 't') setMinimized(!settings.timerMin, { focus: false });
    else if (key === 'd') toggleNight();
    else if (key === 'z') enterFocusMode();
    else if (key === 'escape') closePanel();
    else if (/^[0-9]$/.test(key) && placeForKey(key)) {
      const id = placeForKey(key).id;
      if (isUnlocked(id)) selectEnv(id);
      else toast(`🔒 ${lockedMessage(id)}`);
    }
  });

  window.addEventListener('beforeunload', () => saveTimer());

  // ---------- Boot ----------
  function restoreTimer() {
    // Durations may have changed since the timer was saved.
    if (!timer.running && timer.remaining === timer.total) {
      timer.total = secondsFor(timer.mode);
      timer.remaining = timer.total;
    }
    if (timer.running) {
      if (timer.endAt > Date.now()) {
        timer.remaining = currentRemaining();
        scheduleZen();
      } else {
        timer.remaining = 0;
        complete({ silent: true });
      }
    }
  }

  if (!isUnlocked(settings.env)) settings.env = 'coffee';
  setMinimized(!!settings.timerMin, { focus: false });
  applyNight();
  document.body.classList.toggle('sound-off', !settings.soundOn);
  applyAccent();
  renderWhere();
  renderMixer();
  renderTechniques();
  renderImmersion();
  renderTasks();
  renderStats();
  restoreTimer();
  pickTip();
  render();
  resize();
  requestAnimationFrame(loop);
  setInterval(tick, 250);

  maybeShowFridayDua(1500);

  // A session already in progress goes straight back to its place; otherwise start on the map.
  if (timer.running) entered = true;
  else FP.map.open(settings.env, { instant: true });

  // Start the ambience on the first interaction anywhere (browsers require a gesture).
  const firstGesture = (ev) => {
    // The sound button handles its own first click.
    if (ev.target.closest && ev.target.closest('#soundToggle')) return;
    window.removeEventListener('pointerdown', firstGesture);
    window.removeEventListener('keydown', firstGesture);
    if (settings.soundOn) unlockAudio();
  };
  window.addEventListener('pointerdown', firstGesture);
  window.addEventListener('keydown', firstGesture);

  // Small debug hook for the console.
  FP.app = { settings, timer, start, pause, skip, complete };
})();
