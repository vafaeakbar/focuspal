# FocusPal

A focus timer with immersive environments. Pick a place on the island map, choose a work/break rhythm, and get to work.

**Run it:** open `index.html` in a browser (no build step, no dependencies). To host it, upload the folder to any static host (GitHub Pages, Netlify, S3…).

## Features
- **Research-based rhythms:** Pomodoro (25/5, long break every 4), Deep Study (50/10), 52/17, Ultradian (90/20), or custom.
- **Free & Premium:** currently switched off (`lockPlaces: false` in `js/config.js`), so every place is open. When switched on: Busy Café, Old Library, Rainy Dorm, Courtyard Library and Alajeer HQ are open from the start; the rest unlock as you complete focus sessions (2, 4, 7, 10, 12, 15, 20 and 25). Premium unlocks every place immediately. Prices and checkout links live in `js/config.js`; until a checkout link is set, the upgrade button shows “Coming soon”. When running locally, the upgrade dialog has a developer switch to test Premium.
- **Your animal (optional):** pick a study buddy (cat, dog, fox, panda, owl, rabbit, bear, penguin, koala, lion, falcon or camel), an accessory (glasses, headphones, grad cap) and a background. It rides on the map pin and sits in the top bar.
- **Island map:** start on an illustrated map, pick a landmark, and your pin travels there before zooming into the scene. Open it again any time with the Map button or `M`.
- **19 environments:** Deep Space, Busy Café, Old Library, Late-night Diner, Sunny Garden, Rainy Dorm, Calm Office, Ocean Sunset, Fireside Cabin, Airport Café, Grand Hotel Lobby, Courtyard Library (a library in a mosque courtyard), Alajeer HQ, Henson Site Office, Oasis Spa, Yoga Studio, City Bus, Express Train and Airplane Cabin. Each has an animated scene and a mixable soundscape.
- **Moving vehicles:** the bus, train and plane run on a shared clock, so picture and sound match: the bus brakes into a stop (brakes, doors, someone boarding), blinks its turn signal in time with the click and rattles over bumps; the train clacks over rail joints and passes through a tunnel; the plane hits a short patch of turbulence: the seatbelt sign blinks on with its chime and a spoken seatbelt announcement, and now and then the captain makes a short announcement, in Gulf Arabic and then English as on Gulf Air (spoken by the browser's built-in voices; English only on devices without an Arabic voice; silent in Calm immersion, with its own mixer slider). On the map, the Airplane Cabin is the little blue plane that taxis down the runway and takes off; click it or its label.
- **Breathe (`B`):** a guided breathing mode separate from the timer. Calm (six breaths a minute), Box or Relax (4-7-8), for 1 to 10 minutes, with a circle that grows and shrinks with the breath and an optional soft bell. The break alert offers "Breathe for 3 minutes".
- **Audio:** café, diner and office crowds are real public-domain recordings; everything else is synthesized live with the Web Audio API.
- **Clear break alerts:** when a break starts or ends, an alert stays on screen until you tap it (with a break tip, or "Start focusing"), plus a double chime, a vibration on Android, a 🔔 in the tab title, and an optional system notification.
- **Arabic (`js/i18n.js`):** a full right-to-left Arabic interface with Arabic typefaces. It's chosen automatically for browsers set to Arabic, by the English/عربي switch on the map and in Settings (remembered), or by a `?lang=ar` / `?lang=en` link. English text is the dictionary key: static text is translated as it appears, and phrases with numbers or names go through `FP.t()`. The captain stays bilingual.
- **The map is quiet:** the last place's sound fades out while the map is open and comes back when you travel or resume.
- Break suggestions (20-20-20 eye rule, movement, hydration), auto-start, ambience that softens on breaks. Rhythms with a long break (Pomodoro, Deep Study, Custom) switch to it automatically after the set number of focus sessions; rhythms without one (52/17, 90/20) show a single Break tab.
- **Calm focus & immersion levels:** while you focus, the scene slowly dims, softens and slows so nothing pulls your eye; breaks bring it fully back to life. Choose *Calm* (nearly still, and crowd voices are turned down and muffled so words can’t be followed: best for reading and exams), *Balanced* (default) or *Immersive* (full motion) in the Timer panel or press `I`.
- **Focus mode (`Z`):** full screen with no buttons, just the scene, the time and what you're working on. Esc or double-click (double-tap on phones) to leave.
- **Night lighting:** a moon button (or `D`) dims every scene with a soft moonlit tint; remembered between visits.
- **Minimize the timer** to a small pill (time, play/pause, progress) when you want the full scene; your choice is remembered.
- Task list with 🍅 counts per task, daily stats, “zen mode” that hides everything but the timer while you focus.
- Keyboard: `Space` start/pause · `R` reset · `S` skip · `M` map · `A` ambience · `I` immersion · `T` minimize timer · `D` night lighting · `Z` focus mode · `B` breathe · `F` full screen · `1–9`, `0` travel to a place.
- Settings, tasks and stats are saved in the browser (localStorage).

## Files
- `js/audio.js`: audio engine (noise beds, envelopes, scheduling, chimes)
- `js/sounds.js`: procedural sound builders (rain, chatter, birds, fire, lo-fi music…)
- `js/scenes.js`: canvas scenes
- `js/config.js`: Alajeer brand details (used by Alajeer HQ and the sign-off), the place-lock switch, prices and checkout links
- `img/`: the FocusPal icon (SVG + PNG sizes) and the official Alajeer logo files copied from the alajeer-brand repo
- `manifest.webmanifest`: lets phones install FocusPal with its own icon
- `js/avatar.js`: animal avatars and the picker
- `js/premium.js`: Free/Premium state and the upgrade dialog
- `js/map.js`: the illustrated island map and travel animation
- `audio/*.js`: crowd recordings, embedded as base64 so the site also works when opened straight from disk
- `js/environments.js`: environment definitions (scene + sound layers + calibrated levels)
- `js/app.js`: timer, techniques, tasks, mixer, UI
- `js/breathe.js`: the guided breathing mode

## Credits
- “Cafe ambiance” by Marble Toast, [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Cafe_ambiance.ogg), CC0 1.0 (first ~3 minutes, re-encoded to AAC).
- “Restaurant ambience” by Stephan via pdsounds.org, [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Restaurant_ambience.ogg), public domain (re-encoded to AAC).

## Before charging real money
The Premium flag is stored in the browser, so a determined user could switch it on themselves. That's fine for testing, but for real payments, confirm purchases on a server (your payment provider sends a webhook) and have the app check with that server instead.

## Brand
FocusPal is an Alajeer product, following the house rules in the `alajeer-brand` repo:
- **Icon:** the study lamp: its own colour (twilight blue `#24305E`), an ivory pendant lamp casting a soft warm beam, and an amber bulb as the accent. Like every product icon, it carries no Alajeer marks.
- **Prayer request:** after a user's 3rd completed focus session, and once more after the 30th (plus once on Fridays when the app opens), a card asks them to remember the developer's parents in their prayers (English and Arabic). The same line stays in the Timer panel.
- **Sign-off:** the Alajeer symbol with "by Alajeer", and «من الأجير» on its own line (in the Timer panel and on the map).
- **Alajeer HQ** uses the official dark-mode stacked logo, Forest `#1E3A2B` and Copper `#B87333`, and the brand tagline "Built in Bahrain, for Bahrain." with «صُنع في البحرين، للبحرين» on its own line.

## Henson Site Office
A place in loving memory of the founder of Henson W.L.L. (hecwll.com), a Bahraini construction, contracting and electrical engineering company since 1990. It uses the company's logo (from its website), navy and brick red, its motto "Build it right, build it once.", a dedication in English and Arabic on the office wall and on the map card, and a generated Persian santur playing free-rhythm phrases in dastgāh Homāyun (with its A koron quarter-tone, the wide step up to B, and the santur's tremolo). Company details are in `js/config.js` under `henson`.
