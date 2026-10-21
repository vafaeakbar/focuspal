/*
 * Business settings. Edit these before launch.
 */
(function () {
  'use strict';
  const FP = (window.FP = window.FP || {});
  FP.config = {
    // false: every place is open to everyone. true: places unlock with focus sessions (or Premium).
    lockPlaces: false,
    // Alajeer corporate identity (see the alajeer-brand repo), used by the Alajeer HQ place and the sign-off.
    brand: {
      name: 'Alajeer',
      // Brand-book tagline; English and Arabic always sit on separate lines.
      tagline: 'Built in Bahrain, for Bahrain.',
      taglineAr: 'صُنع في البحرين، للبحرين',
      color: '#1E3A2B', // Forest
      accent: '#B87333', // Copper
      logo: 'img/alajeer-stacked-dark.svg', // dark-mode stacked lockup, for the HQ wall
      symbol: 'img/alajeer-symbol-dark.svg', // for the "by Alajeer" sign-off
    },
    // Henson W.L.L. (hecwll.com), the founder's company, for the Henson Site Office place.
    henson: {
      name: 'Henson W.L.L.',
      nameAr: 'شركة هنسون ذ.م.م.',
      motto: 'Build it right, build it once.',
      since: 'Since 1990',
      navy: '#344B81',
      red: '#AC3620',
      logo: 'img/henson-logo-light.png', // for light surfaces
      dedication: 'In loving memory of the founder',
      dedicationAr: 'إلى روح المؤسّس، رحمه الله',
    },
    premium: {
      // Placeholder prices: replace with your own.
      priceMonthly: '$3.99',
      priceYearly: '$29.99',
      yearlyNote: 'Save 37%',
      // Hosted checkout links from your payment provider (e.g. Paddle, Lemon Squeezy or Tap).
      // While these are empty the upgrade button shows "Coming soon".
      checkoutMonthly: '',
      checkoutYearly: '',
    },
  };
})();
