/*
 * Business settings. Edit these before launch.
 */
(function () {
  'use strict';
  const FP = (window.FP = window.FP || {});
  FP.config = {
    // false: every place is open to everyone. true: places unlock with focus sessions (or Premium).
    lockPlaces: false,
    // Shown on the AlAjeer HQ brand wall, mug and map tower. Set `color` to your brand colour.
    brand: {
      name: 'AlAjeer',
      motto: 'Transforming Business Through Technology',
      color: '#5b7cfa',
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
