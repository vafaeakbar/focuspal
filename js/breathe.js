/*
 * Breathe: a guided breathing mode, separate from the focus timer. A circle grows
 * as you breathe in and shrinks as you breathe out, with an optional soft bell at
 * each change. Slow breathing (about six breaths a minute) is a simple, well-studied
 * way to settle down during a break.
 */
(function () {
  'use strict';
  const FP = window.FP;
  const KEY = 'focuspal:breathe';
  const PATTERNS = {
    calm: { name: 'Calm', note: '6 breaths a minute', steps: [['in', 5], ['out', 5]] },
    box: { name: 'Box', note: '4 in · 4 hold · 4 out · 4 hold', steps: [['in', 4], ['hold', 4], ['out', 4], ['rest', 4]] },
    relax: { name: 'Relax', note: '4 in · 7 hold · 8 out', steps: [['in', 4], ['hold', 7], ['out', 8]] },
  };
  const CUES = { in: 'Breathe in', hold: 'Hold', out: 'Breathe out', rest: 'Hold' };
  const SMALL = 0.42;
  const LENGTHS = [1, 3, 5, 10];

  const listeners = [];
  const el = {};
  let prefs = { pattern: 'calm', minutes: 3, bell: true };
  let session = null;
  let ticker = null;
  let lastFocus = null;
  let isOpen = false;

  try { Object.assign(prefs, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* storage unavailable */ }
  if (!PATTERNS[prefs.pattern]) prefs.pattern = 'calm';
  if (!LENGTHS.includes(prefs.minutes)) prefs.minutes = 3;
  const savePrefs = () => {
    try { localStorage.setItem(KEY, JSON.stringify(prefs)); } catch (e) { /* storage unavailable */ }
  };
  const emit = (what) => listeners.forEach((fn) => fn(what));
  const fmt = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  function show(view) {
    ['setup', 'session', 'done'].forEach((v) => { el[v].hidden = v !== view; });
  }

  function renderSetup() {
    el.patterns.innerHTML = '';
    Object.entries(PATTERNS).forEach(([id, p]) => {
      const b = document.createElement('button');
      b.className = 'breathe-pattern';
      b.setAttribute('aria-pressed', id === prefs.pattern);
      b.innerHTML = `<strong>${p.name}</strong><span>${p.note}</span>`;
      b.addEventListener('click', () => { prefs.pattern = id; savePrefs(); renderSetup(); });
      el.patterns.appendChild(b);
    });
    el.lengths.innerHTML = '';
    LENGTHS.forEach((m) => {
      const b = document.createElement('button');
      b.className = 'chip-btn';
      b.textContent = FP.t('{m} min', { m });
      b.setAttribute('aria-pressed', m === prefs.minutes);
      b.addEventListener('click', () => { prefs.minutes = m; savePrefs(); renderSetup(); });
      el.lengths.appendChild(b);
    });
    el.bell.checked = prefs.bell;
  }

  // ---------- the session ----------
  const now = () => performance.now() / 1000;
  const elapsed = () => (session.pausedAt ?? now()) - session.t0 - session.pausedTotal;

  function setCircle(scale, seconds, ease) {
    el.circle.style.transition = seconds ? `transform ${seconds}s ${ease}` : 'none';
    el.circle.style.transform = `scale(${scale})`;
  }

  function enterStep(kind, remain, ring) {
    el.cue.textContent = CUES[kind];
    el.orb.dataset.step = kind;
    const grow = kind === 'in' || kind === 'hold';
    setCircle(grow ? 1 : SMALL, remain, kind === 'in' || kind === 'out' ? 'cubic-bezier(.45,0,.55,1)' : 'linear');
    if (ring && prefs.bell) FP.audio.bell(kind === 'rest' ? 'hold' : kind);
  }

  function tick() {
    const p = PATTERNS[session.pattern];
    const e = elapsed();
    if (e >= session.total) return finish();
    const cycle = session.cycle;
    let c = e % cycle;
    let i = 0;
    while (c >= p.steps[i][1]) { c -= p.steps[i][1]; i++; }
    const index = Math.floor(e / cycle) * p.steps.length + i;
    const remain = p.steps[i][1] - c;
    if (index !== session.step) {
      session.step = index;
      enterStep(p.steps[i][0], remain, !session.resumed);
      session.resumed = false;
    }
    el.count.textContent = Math.ceil(remain);
    el.left.textContent = FP.t('{time} left', { time: fmt(Math.ceil(session.total - e)) });
  }

  function begin(minutes = prefs.minutes) {
    const p = PATTERNS[prefs.pattern];
    const cycle = p.steps.reduce((a, s) => a + s[1], 0);
    // Always finish on a full breath.
    const total = Math.ceil((minutes * 60) / cycle) * cycle;
    session = { pattern: prefs.pattern, cycle, total, t0: now(), pausedAt: null, pausedTotal: 0, step: -1, resumed: false };
    emit('start');
    show('session');
    setCircle(SMALL, 0);
    el.pause.textContent = 'Pause';
    // Let the starting size apply before the first breath animates from it.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      if (!session) return;
      tick();
      ticker = setInterval(tick, 100);
    }));
    el.pause.focus({ preventScroll: true });
  }

  function togglePause() {
    if (!session) return;
    if (session.pausedAt == null) {
      session.pausedAt = now();
      clearInterval(ticker);
      const current = getComputedStyle(el.circle).transform;
      el.circle.style.transition = 'none';
      el.circle.style.transform = current === 'none' ? '' : current;
      el.cue.textContent = 'Paused';
      el.pause.textContent = 'Resume';
    } else {
      session.pausedTotal += now() - session.pausedAt;
      session.pausedAt = null;
      session.step = -1;
      session.resumed = true;
      el.pause.textContent = 'Pause';
      tick();
      ticker = setInterval(tick, 100);
    }
    emit('pause');
  }

  function stop() {
    clearInterval(ticker);
    ticker = null;
    session = null;
  }

  function finish() {
    const mins = Math.round(session.total / 60);
    stop();
    if (prefs.bell) FP.audio.bell('done');
    el.doneText.textContent = FP.t('You breathed slowly for {mins} minutes. Notice how you feel before you go back.', { mins, dur: FP.dur(mins) },
      `You breathed slowly for ${mins} minute${mins === 1 ? '' : 's'}. Notice how you feel before you go back.`);
    show('done');
    el.doneBtn.focus({ preventScroll: true });
    emit('done');
  }

  // ---------- open / close ----------
  function open({ minutes, autostart = false } = {}) {
    lastFocus = document.activeElement;
    stop();
    renderSetup();
    show('setup');
    isOpen = true;
    el.root.hidden = false;
    requestAnimationFrame(() => el.root.classList.add('show'));
    emit('open');
    // A session started from elsewhere (the break alert) can ask for its own length.
    if (autostart) begin(LENGTHS.includes(minutes) ? minutes : prefs.minutes);
    else setTimeout(() => el.start.focus({ preventScroll: true }), 60);
  }

  function close() {
    if (!isOpen) return;
    isOpen = false;
    stop();
    el.root.classList.remove('show');
    setTimeout(() => { if (!el.root.classList.contains('show')) el.root.hidden = true; }, 300);
    emit('close');
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  function init() {
    const $ = (s) => document.querySelector(s);
    Object.assign(el, {
      root: $('#breathe'), setup: $('#breatheSetup'), session: $('#breatheSession'), done: $('#breatheDone'),
      patterns: $('#breathePatterns'), lengths: $('#breatheLengths'), bell: $('#breatheBell'), start: $('#breatheStart'),
      orb: $('#breatheOrb'), circle: $('#breatheCircle'), cue: $('#breatheCue'), count: $('#breatheCount'), left: $('#breatheLeft'),
      pause: $('#breathePause'), end: $('#breatheEnd'), doneText: $('#breatheDoneText'), doneBtn: $('#breatheDoneBtn'),
    });
    el.start.addEventListener('click', () => begin());
    el.bell.addEventListener('change', () => { prefs.bell = el.bell.checked; savePrefs(); });
    el.pause.addEventListener('click', togglePause);
    el.end.addEventListener('click', close);
    el.doneBtn.addEventListener('click', close);
    $('#breatheAgain').addEventListener('click', () => { renderSetup(); show('setup'); el.start.focus({ preventScroll: true }); });
    $('#breatheClose').addEventListener('click', close);
  }

  FP.breathe = {
    init,
    open,
    close,
    begin,
    togglePause,
    get isOpen() { return isOpen; },
    get running() { return !!session && session.pausedAt == null; },
    get inSession() { return !!session; },
    onChange: (fn) => listeners.push(fn),
  };
})();
