/*
 * Free vs Premium. Free users unlock places by completing focus sessions;
 * Premium unlocks every place straight away.
 *
 * NOTE: the Premium flag lives in the browser, which is fine for a prototype but
 * not for real paid access. Once payments are live, confirm purchases on a server
 * (your payment provider's webhook) and have the app check that instead.
 */
(function () {
  'use strict';
  const FP = window.FP;
  const KEY = 'focuspal:premium';
  const cfg = FP.config.premium;
  // The developer toggle only appears when running locally.
  const isDev = location.protocol === 'file:' || ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

  const listeners = [];
  const el = {};
  let plan = 'yearly';
  let lastFocus = null;

  const read = () => {
    try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; }
  };

  function set(on) {
    try {
      if (on) localStorage.setItem(KEY, '1');
      else localStorage.removeItem(KEY);
    } catch (e) { /* storage unavailable */ }
    render();
    listeners.forEach((fn) => fn(on));
  }

  function render() {
    const active = read();
    el.modal.classList.toggle('is-premium', active);
    el.title.textContent = active ? 'You’re Premium ✨' : 'FocusPal Premium';
    el.plans.hidden = active;
    el.note.hidden = active;
    $$plans().forEach((b) => {
      const on = b.dataset.plan === plan;
      b.classList.toggle('active', on);
      b.setAttribute('aria-checked', on);
    });
    const url = plan === 'yearly' ? cfg.checkoutYearly : cfg.checkoutMonthly;
    if (active) {
      el.cta.textContent = 'Back to focusing';
      el.cta.disabled = false;
    } else if (url) {
      el.cta.textContent = plan === 'yearly'
        ? FP.t('Continue to checkout · {price} / year', { price: cfg.priceYearly })
        : FP.t('Continue to checkout · {price} / month', { price: cfg.priceMonthly });
      el.cta.disabled = false;
    } else {
      el.cta.textContent = 'Coming soon';
      el.cta.disabled = true;
    }
    el.devToggle.textContent = active ? 'Turn Premium off' : 'Turn Premium on';
  }

  const $$plans = () => [...el.plans.querySelectorAll('[data-plan]')];

  function open(reason) {
    lastFocus = document.activeElement;
    el.reason.textContent = reason || 'Study anywhere on the island, right away.';
    render();
    el.modal.hidden = false;
    requestAnimationFrame(() => el.modal.classList.add('show'));
    setTimeout(() => (el.cta.disabled ? el.close : el.cta).focus(), 50);
  }

  function close() {
    if (el.modal.hidden) return;
    el.modal.classList.remove('show');
    setTimeout(() => { el.modal.hidden = true; }, 250);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function init() {
    el.modal = document.getElementById('premiumModal');
    el.title = document.getElementById('premiumTitle');
    el.reason = document.getElementById('premiumReason');
    el.plans = document.getElementById('premiumPlans');
    el.cta = document.getElementById('premiumCta');
    el.note = document.getElementById('premiumNote');
    el.close = document.getElementById('premiumClose');
    el.dev = document.getElementById('premiumDev');
    el.devToggle = document.getElementById('premiumDevToggle');

    document.getElementById('priceMonthly').textContent = cfg.priceMonthly;
    document.getElementById('priceYearly').textContent = cfg.priceYearly;
    document.getElementById('yearlyNote').textContent = cfg.yearlyNote;

    $$plans().forEach((b) => b.addEventListener('click', () => { plan = b.dataset.plan; render(); }));
    el.cta.addEventListener('click', () => {
      if (read()) return close();
      const url = plan === 'yearly' ? cfg.checkoutYearly : cfg.checkoutMonthly;
      if (url) window.location.href = url;
    });
    el.close.addEventListener('click', close);
    el.modal.addEventListener('click', (e) => { if (e.target === el.modal) close(); });
    el.dev.hidden = !isDev;
    el.devToggle.addEventListener('click', () => set(!read()));
    render();
  }

  FP.premium = {
    init,
    open,
    close,
    get active() { return read(); },
    get isOpen() { return el.modal && !el.modal.hidden; },
    onChange(fn) { listeners.push(fn); },
  };
})();
