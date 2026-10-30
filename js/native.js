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
  // Once the app leaves the screen its page may be frozen, so the alert is booked the moment
  // a session starts and taken back whenever the timer stops or moves on. An alert already
  // shown stays until the person is back in FocusPal: the page can also wake in the
  // background (an automatic break starting, say) and must not clear it unseen.
  // Separate ids for the two alerts: booking one clears any shown alert with the same id.
  const LN = P.LocalNotifications;
  const IDS = { focus: 1, rest: 2 };
  const all = { notifications: [{ id: IDS.focus }, { id: IDS.rest }] };
  let asked = false;
  // Android lets timer apps ring on time; if that's ever switched off, book a regular alarm
  // rather than let the plugin open the "Alarms & reminders" settings mid-session.
  const exactAllowed = () => (FP.native.platform !== 'android' ? Promise.resolve(true)
    : LN.checkExactNotificationSetting().then((s) => s.exact_alarm === 'granted', () => false));
  async function schedule(timer) {
    const toBreak = timer.mode === 'focus';
    return LN.schedule({
      notifications: [{
        id: toBreak ? IDS.focus : IDS.rest,
        title: FP.t(toBreak ? 'Time for a break' : 'Break’s over'),
        body: FP.t(toBreak ? 'Focus session complete.' : 'Ready for your next focus session?'),
        schedule: { at: new Date(timer.endAt), allowWhileIdle: true },
        isExactNotification: await exactAllowed(),
      }],
    });
  }
  if (LN) {
    let queue = Promise.resolve(); // one change at a time, so an old booking can't land last
    window.addEventListener('fp:timer', (e) => {
      const timer = e.detail;
      const book = timer.running && timer.endAt > Date.now() + 1000;
      queue = queue
        .then(() => LN.cancel(all)).catch(() => {})
        .then(() => (book ? schedule(timer) : null)).catch(() => { /* notifications unavailable */ });
      // Ask once, on the first start, so the question makes sense when it appears.
      if (!asked && timer.running) {
        asked = true;
        LN.checkPermissions().then((p) => (p.display === 'granted' ? null : LN.requestPermissions())).catch(() => {});
      }
    });
    if (P.App) {
      P.App.addListener('appStateChange', (st) => {
        if (st.isActive) LN.removeDeliveredNotifications({ notifications: all.notifications.map((n) => ({ ...n, title: '', body: '' })) }).catch(() => {});
      });
    }
  }

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
