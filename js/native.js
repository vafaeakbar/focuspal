/*
 * The iPhone and Android apps (Capacitor) load this same site. Here they swap in what only
 * an app can do: a break alert that arrives with the phone locked, keeping the screen
 * awake, and speaking the captain's announcements with the phone's own voices (Android's
 * web view can't speak). On the website none of this runs.
 */
(function () {
  'use strict';
  const FP = window.FP;
  const cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) return;
  const P = cap.Plugins || {};
  FP.native = { platform: cap.getPlatform() };
  document.documentElement.classList.add('native-app', `native-${FP.native.platform}`);

  // ---------- break alerts while the app is in the background ----------
  const LN = P.LocalNotifications;
  let timer = null;
  let asked = false;
  window.addEventListener('fp:timer', (e) => { timer = e.detail; });
  async function schedule() {
    if (!LN || !timer || !timer.running || timer.endAt <= Date.now() + 1000) return;
    try {
      const toBreak = timer.mode === 'focus';
      await LN.schedule({
        notifications: [{
          id: 1,
          title: FP.t(toBreak ? 'Time for a break' : 'Break’s over'),
          body: FP.t(toBreak ? 'Focus session complete.' : 'Ready for your next focus session?'),
          schedule: { at: new Date(timer.endAt), allowWhileIdle: true },
        }],
      });
    } catch (err) { /* notifications unavailable */ }
  }
  function cancel() {
    if (LN) LN.cancel({ notifications: [{ id: 1 }] }).catch(() => {});
  }
  // While FocusPal is on screen its own alert handles the moment; only book one when it leaves.
  document.addEventListener('visibilitychange', () => (document.hidden ? schedule() : cancel()));
  // Ask once, on the first start, so the question makes sense when it appears.
  window.addEventListener('fp:timer', (e) => {
    if (!asked && LN && e.detail.running) {
      asked = true;
      LN.checkPermissions().then((p) => (p.display === 'granted' ? null : LN.requestPermissions())).catch(() => {});
    }
  });

  // ---------- keeping the screen awake ----------
  const KA = P.KeepAwake;
  let awake = false;
  window.addEventListener('fp:wakelock', (e) => {
    if (!KA || e.detail === awake) return;
    awake = e.detail;
    (awake ? KA.keepAwake() : KA.allowSleep()).catch(() => {});
  });

  // ---------- the captain's voice ----------
  const TTS = P.TextToSpeech;
  if (TTS) {
    // Each line in turn; a language the phone has no voice for is skipped.
    FP.native.speak = async (queue) => {
      for (const u of queue) {
        try {
          await TTS.speak({ text: u.text, lang: u.lang, rate: u.rate, pitch: u.pitch, volume: u.volume, category: 'playback' });
        } catch (err) { /* no voice for this language */ }
      }
    };
    FP.native.stopSpeaking = () => TTS.stop().catch(() => {});
  }
})();
