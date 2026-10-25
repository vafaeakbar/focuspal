/*
 * Environments: each pairs an animated scene with a set of mixable sound layers.
 * Layer fields: id, name, vol (default 0..1), gain (level calibration), reverb (send amount), create,
 * speech (intelligible voices: muffled during Calm focus).
 * Environment `unlock`: completed focus sessions needed to unlock it for free (Premium unlocks all).
 */
(function () {
  'use strict';
  const FP = window.FP;
  const S = FP.sounds;

  FP.environments = [
    {
      id: 'space', name: 'Deep Space', emoji: '🪐', accent: '#9d8cff', scene: 'space', unlock: 25,
      tagline: 'Drift past a ringed planet in silence and starlight.',
      layers: [
        { id: 'drone', name: 'Cosmic drone', vol: 0.7, gain: 0.16, reverb: 0.3, create: (k, o) => S.drone(k, o) },
        { id: 'shimmer', name: 'Starlight', vol: 0.5, gain: 5, reverb: 0.9, create: (k, o) => S.shimmer(k, o) },
        { id: 'engine', name: 'Ship engine', vol: 0.35, gain: 0.43, create: (k, o) => S.engine(k, o) },
      ],
    },
    {
      id: 'coffee', name: 'Busy Café', emoji: '☕', accent: '#e0a96d', scene: 'coffee', unlock: 0,
      tagline: 'The gentle buzz of a coffee shop, cups clinking, espresso hissing.',
      layers: [
        { speech: true, id: 'chatter', name: 'People chatting', vol: 0.6, gain: 1, create: (k, o) => S.crowd(k, o, { sample: 'cafe-crowd' }) },
        { id: 'dishes', name: 'Cups & spoons', vol: 0.5, gain: 2.8, reverb: 0.3, create: (k, o) => S.dishes(k, o) },
        { id: 'espresso', name: 'Espresso bar', vol: 0.45, gain: 4, reverb: 0.25, create: (k, o) => S.espresso(k, o) },
        { id: 'music', name: 'Café music', vol: 0.35, gain: 1.85, reverb: 0.3, create: (k, o) => S.lofi(k, o, { bpm: 72, lp: 1600 }) },
      ],
    },
    {
      id: 'library', name: 'Old Library', emoji: '📚', accent: '#d9b26f', scene: 'library', unlock: 0,
      tagline: 'Hushed halls, turning pages and a patient clock.',
      layers: [
        { id: 'room', name: 'Room tone', vol: 0.5, gain: 0.56, create: (k, o) => S.roomTone(k, o, { lp: 260 }) },
        { id: 'pages', name: 'Turning pages', vol: 0.5, gain: 4.7, reverb: 0.4, create: (k, o) => S.pages(k, o) },
        { id: 'clock', name: 'Wall clock', vol: 0.35, gain: 3.3, reverb: 0.5, create: (k, o) => S.clock(k, o) },
        { id: 'steps', name: 'Distant footsteps', vol: 0.35, gain: 2.1, reverb: 0.8, create: (k, o) => S.footsteps(k, o) },
      ],
    },
    {
      id: 'diner', name: 'Late-night Diner', emoji: '🍔', accent: '#ff6b9a', scene: 'diner', unlock: 10,
      tagline: 'Neon glow, a sizzling grill and an old jukebox.',
      layers: [
        { speech: true, id: 'chatter', name: 'Busy tables', vol: 0.55, gain: 0.9, create: (k, o) => S.crowd(k, o, { sample: 'restaurant-crowd' }) },
        { id: 'grill', name: 'Grill sizzle', vol: 0.4, gain: 1.9, create: (k, o) => S.sizzle(k, o) },
        { id: 'plates', name: 'Plates & cutlery', vol: 0.45, gain: 2.8, reverb: 0.2, create: (k, o) => S.dishes(k, o, { lo: 1300, hi: 3000, min: 1200, max: 4500 }) },
        { id: 'jukebox', name: 'Jukebox', vol: 0.4, gain: 1.9, reverb: 0.4, create: (k, o) => S.lofi(k, o, { bpm: 88, lp: 1300, swing: 0.06 }) },
      ],
    },
    {
      id: 'garden', name: 'Sunny Garden', emoji: '🌿', accent: '#7ccf7a', scene: 'garden', unlock: 2, light: true,
      tagline: 'Birdsong, a soft breeze and a trickling fountain.',
      layers: [
        { id: 'breeze', name: 'Breeze', vol: 0.5, gain: 0.65, create: (k, o) => S.wind(k, o, { lo: 300, hi: 1200 }) },
        { id: 'birds', name: 'Birdsong', vol: 0.55, gain: 6, reverb: 0.35, create: (k, o) => S.birds(k, o) },
        { id: 'fountain', name: 'Fountain', vol: 0.35, gain: 0.85, create: (k, o) => S.water(k, o) },
      ],
    },
    {
      id: 'rain', name: 'Rainy Dorm', emoji: '🌧️', accent: '#7fb0ff', scene: 'rain', unlock: 0,
      tagline: 'Rain on the window, distant thunder, a lo-fi radio.',
      layers: [
        { id: 'rain', name: 'Rain', vol: 0.65, gain: 1.3, create: (k, o) => S.rain(k, o) },
        { id: 'window', name: 'Drops on glass', vol: 0.45, gain: 4.6, reverb: 0.2, create: (k, o) => S.windowDrops(k, o) },
        { id: 'thunder', name: 'Distant thunder', vol: 0.55, gain: 1.4, reverb: 0.5, create: (k, o) => S.thunder(k, o) },
        { id: 'radio', name: 'Lo-fi radio', vol: 0.3, gain: 1.8, reverb: 0.2, create: (k, o) => S.lofi(k, o, { bpm: 68, lp: 1200 }) },
      ],
    },
    {
      id: 'office', name: 'Calm Office', emoji: '🪴', accent: '#6fc7b0', scene: 'office', unlock: 4, light: true,
      tagline: 'Sunlight through the blinds, soft typing, a quiet hum.',
      layers: [
        { id: 'hvac', name: 'Air conditioning', vol: 0.5, gain: 0.65, create: (k, o) => S.hvac(k, o) },
        { id: 'typing', name: 'Keyboards', vol: 0.45, gain: 6.3, reverb: 0.2, create: (k, o) => S.typing(k, o, { typists: 3 }) },
        { speech: true, id: 'murmur', name: 'Distant colleagues', vol: 0.3, gain: 0.33, reverb: 0.4, create: (k, o) => S.crowd(k, o, { sample: 'cafe-crowd', lp: 900, hp: 150 }) },
      ],
    },
    {
      id: 'ocean', name: 'Ocean Sunset', emoji: '🌅', accent: '#ff9a6b', scene: 'ocean', unlock: 7,
      tagline: 'Rolling waves, gulls and a warm sea breeze.',
      layers: [
        { id: 'waves', name: 'Waves', vol: 0.7, gain: 1.15, create: (k, o) => S.waves(k, o) },
        { id: 'gulls', name: 'Seagulls', vol: 0.35, gain: 9, reverb: 0.5, create: (k, o) => S.gulls(k, o) },
        { id: 'wind', name: 'Sea breeze', vol: 0.35, gain: 0.43, create: (k, o) => S.wind(k, o, { lo: 250, hi: 900, rate: 0.04 }) },
      ],
    },
    {
      id: 'cabin', name: 'Fireside Cabin', emoji: '🔥', accent: '#ff8a3d', scene: 'cabin', unlock: 15,
      tagline: 'A crackling fire while the snow falls outside.',
      layers: [
        { id: 'fire', name: 'Crackling fire', vol: 0.7, gain: 1.4, create: (k, o) => S.fire(k, o) },
        { id: 'wind', name: 'Wind outside', vol: 0.35, gain: 1.75, create: (k, o) => S.wind(k, o, { lo: 300, hi: 750, Q: 3, filter: 'bandpass', rate: 0.05 }) },
        { id: 'clock', name: 'Mantel clock', vol: 0.2, gain: 3.8, reverb: 0.3, create: (k, o) => S.clock(k, o, { level: 0.8 }) },
      ],
    },
    {
      id: 'airport', name: 'Airport Café', emoji: '✈️', accent: '#f6c544', scene: 'airport', unlock: 12,
      tagline: 'Coffee by the gate, planes taking off and a soft departures chime.',
      layers: [
        { speech: true, id: 'terminal', name: 'Terminal crowd', vol: 0.5, gain: 0.8, reverb: 0.7, create: (k, o) => S.crowd(k, o, { sample: 'cafe-crowd', lp: 3000 }) },
        { id: 'coffee', name: 'Coffee bar', vol: 0.4, gain: 2.1, reverb: 0.3, create: (k, o) => S.coffeeBar(k, o) },
        { id: 'suitcases', name: 'Rolling suitcases', vol: 0.4, gain: 3.5, reverb: 0.6, create: (k, o) => S.suitcases(k, o) },
        { id: 'chimes', name: 'Departure chimes', vol: 0.35, gain: 1.75, reverb: 0.8, create: (k, o) => S.departureChime(k, o) },
        { id: 'jets', name: 'Planes outside', vol: 0.45, gain: 0.45, create: (k, o) => S.jets(k, o) },
      ],
    },
    {
      id: 'hotel', name: 'Grand Hotel Lobby', emoji: '🛎️', accent: '#e6a48f', scene: 'hotel', unlock: 20,
      tagline: 'Marble floors, crystal chandeliers and a pianist playing softly.',
      layers: [
        { id: 'piano', name: 'Lobby piano', vol: 0.45, gain: 2.1, reverb: 0.6, create: (k, o) => S.piano(k, o) },
        { speech: true, id: 'guests', name: 'Quiet guests', vol: 0.35, gain: 0.43, reverb: 0.8, create: (k, o) => S.crowd(k, o, { sample: 'cafe-crowd', lp: 1600, hp: 200 }) },
        { id: 'heels', name: 'Footsteps on marble', vol: 0.35, gain: 6.2, reverb: 0.9, create: (k, o) => S.heels(k, o) },
        { id: 'bells', name: 'Reception & elevator', vol: 0.3, gain: 5.6, reverb: 0.8, create: (k, o) => S.lobbyBells(k, o) },
        { id: 'fountain', name: 'Lobby fountain', vol: 0.2, gain: 0.7, create: (k, o) => S.water(k, o) },
      ],
    },
    {
      id: 'mosque', name: 'Courtyard Library', emoji: '🕌', accent: '#3fb8c8', scene: 'mosque', unlock: 0,
      tagline: 'A quiet library under the arches of a mosque courtyard, with a fountain and doves.',
      layers: [
        { id: 'fountain', name: 'Courtyard fountain', vol: 0.45, gain: 0.85, create: (k, o) => S.water(k, o) },
        { id: 'birds', name: 'Doves & sparrows', vol: 0.45, gain: 6, reverb: 0.3, create: (k, o) => S.birds(k, o, { min: 2500, max: 7000 }) },
        { id: 'pages', name: 'Turning pages', vol: 0.4, gain: 4.7, reverb: 0.3, create: (k, o) => S.pages(k, o) },
        { id: 'breeze', name: 'Warm breeze', vol: 0.3, gain: 0.65, create: (k, o) => S.wind(k, o, { lo: 250, hi: 800, rate: 0.05 }) },
      ],
    },
    {
      id: 'alajeer', name: 'Alajeer HQ', emoji: '🏢', accent: FP.config.brand.accent, scene: 'alajeer', unlock: 0,
      tagline: 'A calm, modern office looking out over the skyline at sunset. Home of the team behind FocusPal.',
      layers: [
        { id: 'hvac', name: 'Air conditioning', vol: 0.45, gain: 0.65, create: (k, o) => S.hvac(k, o) },
        { id: 'typing', name: 'Keyboards', vol: 0.4, gain: 6.3, reverb: 0.2, create: (k, o) => S.typing(k, o, { typists: 3 }) },
        { speech: true, id: 'team', name: 'The team, nearby', vol: 0.3, gain: 0.33, reverb: 0.4, create: (k, o) => S.crowd(k, o, { sample: 'cafe-crowd', lp: 1000, hp: 150 }) },
        { id: 'coffee', name: 'Coffee corner', vol: 0.35, gain: 4, reverb: 0.25, create: (k, o) => S.espresso(k, o) },
      ],
    },
    {
      id: 'henson', name: 'Henson Site Office', emoji: '🏗️', accent: '#d45a47', scene: 'henson', unlock: 0,
      tagline: 'A site office on a Henson project at dusk: blueprints on the desk, a crane and a substation outside, and a gentle Persian santur. Build it right, build it once.',
      dedication: FP.config.henson.dedication,
      dedicationAr: FP.config.henson.dedicationAr,
      layers: [
        { id: 'santur', name: 'Persian santur', vol: 0.45, gain: 2.5, reverb: 0.55, create: (k, o) => S.santur(k, o) },
        { id: 'site', name: 'Construction site', vol: 0.45, gain: 1, reverb: 0.5, create: (k, o) => S.site(k, o) },
        { id: 'hum', name: 'Substation hum', vol: 0.3, gain: 0.5, create: (k, o) => S.transformer(k, o) },
        { id: 'ac', name: 'Site-office AC', vol: 0.4, gain: 0.65, create: (k, o) => S.hvac(k, o) },
        { id: 'plans', name: 'Blueprints', vol: 0.35, gain: 4.7, reverb: 0.2, create: (k, o) => S.pages(k, o) },
      ],
    },
    {
      id: 'spa', name: 'Hammam Spa', emoji: '🧖', accent: '#7cc6b8', scene: 'spa', unlock: 0,
      tagline: 'Warm stone, mosaic tiles and steam under a starlit dome, with a trickling fountain and the hum of a singing bowl.',
      layers: [
        { id: 'fountain', name: 'Basin fountain', vol: 0.4, gain: 1.1, reverb: 0.4, create: (k, o) => S.water(k, o, { lp: 2400, level: 0.8 }) },
        { id: 'steam', name: 'Steam', vol: 0.35, gain: 2.5, create: (k, o) => S.steam(k, o) },
        { id: 'bowls', name: 'Singing bowls', vol: 0.4, gain: 1.2, reverb: 0.8, create: (k, o) => S.bowl(k, o) },
        { id: 'drips', name: 'Echoing drips', vol: 0.3, gain: 3.5, reverb: 0.9, create: (k, o) => S.drips(k, o) },
        { id: 'warmth', name: 'Warm hum', vol: 0.25, gain: 0.16, reverb: 0.4, create: (k, o) => S.drone(k, o, { root: 65.41 }) },
      ],
    },
  ];

  FP.envById = (id) => FP.environments.find((e) => e.id === id) || FP.environments[1];
})();
