/*
 * Optional avatar: pick an animal, a background colour and a study accessory.
 * It rides on the map pin and sits in the top bar. Without one, the default pin shows.
 */
(function () {
  'use strict';
  const FP = window.FP;
  const KEY = 'focuspal:avatar';

  // ---------- drawing helpers (viewBox 0 0 120 120) ----------
  const eye = (x, y, rx = 4.2, ry = 5.2) =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="#1f1d24"/><circle cx="${x + 1.4}" cy="${y - 1.8}" r="1.5" fill="#fff"/>`;
  const eyes = (x1, x2, y, rx, ry) => eye(x1, y, rx, ry) + eye(x2, y, rx, ry);
  const blush = (x1, x2, y) =>
    `<ellipse cx="${x1}" cy="${y}" rx="5.5" ry="3.2" fill="#ff8fa3" opacity=".45"/><ellipse cx="${x2}" cy="${y}" rx="5.5" ry="3.2" fill="#ff8fa3" opacity=".45"/>`;
  const smile = (y, col, w = 5) =>
    `<path d="M60 ${y - 3} v3 M${60 - w} ${y} q${w / 2} 3 ${w} 0 q${w / 2} 3 ${w} 0" stroke="${col}" stroke-width="1.9" fill="none" stroke-linecap="round"/>`;

  // Each animal: its art, where its eyes sit (for glasses) and the top of its head (for hats and headphones).
  const ANIMALS = {
    cat: {
      name: 'Cat', eyes: [47, 73, 65], top: 35,
      art: () => `<path d="M30 52 L33 20 L54 38Z M90 52 L87 20 L66 38Z" fill="#f2a65a"/>
        <path d="M35 44 L36 28 L48 38Z M85 44 L84 28 L72 38Z" fill="#f7b9c4"/>
        <ellipse cx="60" cy="66" rx="35" ry="31" fill="#f2a65a"/>
        <path d="M60 37 v9 M51 39 l2.5 8 M69 39 l-2.5 8" stroke="#d17f35" stroke-width="3.2" stroke-linecap="round"/>
        <ellipse cx="52.5" cy="80" rx="9" ry="7" fill="#fff3e6"/><ellipse cx="67.5" cy="80" rx="9" ry="7" fill="#fff3e6"/>
        ${eyes(47, 73, 65)}${blush(39, 81, 75)}
        <path d="M56 74 h8 l-4 4.5z" fill="#e8737f"/>${smile(81, '#6b3a2a')}
        <path d="M40 79 L24 76 M40 83 L25 85 M80 79 L96 76 M80 83 L95 85" stroke="#6b3a2a" stroke-width="1.3" opacity=".45" stroke-linecap="round"/>`,
    },
    dog: {
      name: 'Dog', eyes: [47, 73, 59], top: 31,
      art: () => `<ellipse cx="30" cy="62" rx="12" ry="23" fill="#8a5a3a" transform="rotate(18 30 62)"/>
        <ellipse cx="90" cy="62" rx="12" ry="23" fill="#8a5a3a" transform="rotate(-18 90 62)"/>
        <ellipse cx="60" cy="62" rx="31" ry="31" fill="#f3d6b0"/>
        <ellipse cx="73" cy="57" rx="11" ry="10" fill="#c98b55"/>
        <ellipse cx="60" cy="79" rx="17" ry="13" fill="#fffaf2"/>
        ${eyes(47, 73, 59)}${blush(38, 82, 70)}
        <ellipse cx="60" cy="72" rx="7" ry="5" fill="#2b2326"/><ellipse cx="58" cy="70.5" rx="2.2" ry="1.3" fill="#fff" opacity=".6"/>
        ${smile(80, '#2b2326', 6)}<path d="M56.5 82 h7 v4 a3.5 3.5 0 0 1 -7 0z" fill="#ef7f8f"/>`,
    },
    fox: {
      name: 'Fox', eyes: [46, 74, 62], top: 38,
      art: () => `<path d="M27 54 L29 16 L54 40Z M93 54 L91 16 L66 40Z" fill="#f08a3c"/>
        <path d="M33 46 L33 26 L47 40Z M87 46 L87 26 L73 40Z" fill="#fff1e0"/>
        <path d="M29 16 L31 28 L39 25Z M91 16 L89 28 L81 25Z" fill="#3b2a22"/>
        <path d="M22 54 Q60 30 98 54 Q92 86 60 98 Q28 86 22 54Z" fill="#f08a3c"/>
        <path d="M26 60 Q46 66 60 74 Q74 66 94 60 Q88 88 60 98 Q32 88 26 60Z" fill="#fff4ea"/>
        ${eyes(46, 74, 62)}
        <ellipse cx="60" cy="85" rx="5.5" ry="4" fill="#2b2326"/>
        <path d="M56 91 q4 3 8 0" stroke="#2b2326" stroke-width="1.9" fill="none" stroke-linecap="round"/>`,
    },
    panda: {
      name: 'Panda', eyes: [47, 73, 63], top: 35,
      art: () => `<circle cx="33" cy="36" r="12" fill="#2b2b33"/><circle cx="87" cy="36" r="12" fill="#2b2b33"/>
        <ellipse cx="60" cy="66" rx="35" ry="31" fill="#fbfbfb"/>
        <ellipse cx="46" cy="64" rx="9" ry="12" fill="#2b2b33" transform="rotate(-25 46 64)"/>
        <ellipse cx="74" cy="64" rx="9" ry="12" fill="#2b2b33" transform="rotate(25 74 64)"/>
        <circle cx="47" cy="63" r="4.2" fill="#fff"/><circle cx="47.6" cy="63.6" r="2.4" fill="#1f1d24"/>
        <circle cx="73" cy="63" r="4.2" fill="#fff"/><circle cx="73.6" cy="63.6" r="2.4" fill="#1f1d24"/>
        ${blush(37, 83, 77)}<ellipse cx="60" cy="76" rx="6" ry="4" fill="#2b2b33"/>${smile(83, '#2b2b33')}`,
    },
    owl: {
      name: 'Owl', eyes: [45, 75, 58], eyeR: 12, top: 30,
      art: () => `<path d="M26 44 L34 22 L48 36 Q60 31 72 36 L86 22 L94 44 Q102 76 60 100 Q18 76 26 44Z" fill="#8a6a4a"/>
        <path d="M38 80 Q60 92 82 80 Q76 96 60 100 Q44 96 38 80Z" fill="#c9a87c"/>
        <path d="M50 88 l3 3 l3 -3 M64 88 l3 3 l3 -3 M57 94 l3 3 l3 -3" stroke="#8a6a4a" stroke-width="1.8" fill="none" stroke-linecap="round"/>
        <circle cx="45" cy="58" r="16" fill="#f3e2c7"/><circle cx="75" cy="58" r="16" fill="#f3e2c7"/>
        <circle cx="45" cy="58" r="9" fill="#f2b84b"/><circle cx="75" cy="58" r="9" fill="#f2b84b"/>
        <circle cx="45" cy="58" r="5.5" fill="#1f1d24"/><circle cx="75" cy="58" r="5.5" fill="#1f1d24"/>
        <circle cx="47" cy="56" r="1.8" fill="#fff"/><circle cx="77" cy="56" r="1.8" fill="#fff"/>
        <path d="M33 46 Q45 40 56 48 M87 46 Q75 40 64 48" stroke="#5e452e" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M55 66 L65 66 L60 77Z" fill="#f2a03a"/>`,
    },
    rabbit: {
      name: 'Rabbit', eyes: [48, 72, 70], top: 44,
      art: () => `<ellipse cx="45" cy="30" rx="9" ry="24" fill="#ecebf2" transform="rotate(-8 45 30)"/>
        <ellipse cx="75" cy="30" rx="9" ry="24" fill="#ecebf2" transform="rotate(8 75 30)"/>
        <ellipse cx="45" cy="31" rx="4.5" ry="17" fill="#f7b9c4" transform="rotate(-8 45 31)"/>
        <ellipse cx="75" cy="31" rx="4.5" ry="17" fill="#f7b9c4" transform="rotate(8 75 31)"/>
        <ellipse cx="60" cy="72" rx="31" ry="27" fill="#ecebf2"/>
        ${eyes(48, 72, 70)}${blush(39, 81, 80)}
        <path d="M57 77 h6 l-3 3.5z" fill="#ef8a9a"/>${smile(83, '#7a6a80')}
        <rect x="57.5" y="85" width="5" height="5" rx="1" fill="#fff" stroke="#d8d4e2" stroke-width=".8"/>`,
    },
    bear: {
      name: 'Bear', eyes: [47, 73, 62], top: 36,
      art: () => `<circle cx="33" cy="40" r="12" fill="#9b6a43"/><circle cx="87" cy="40" r="12" fill="#9b6a43"/>
        <circle cx="33" cy="40" r="6.5" fill="#d9b48a"/><circle cx="87" cy="40" r="6.5" fill="#d9b48a"/>
        <ellipse cx="60" cy="66" rx="33" ry="30" fill="#9b6a43"/>
        <ellipse cx="60" cy="79" rx="15" ry="11" fill="#e2c29a"/>
        ${eyes(47, 73, 62)}
        <ellipse cx="60" cy="74" rx="6.5" ry="4.5" fill="#2b2326"/><ellipse cx="58.2" cy="72.8" rx="2" ry="1.2" fill="#fff" opacity=".6"/>
        ${smile(82, '#2b2326')}`,
    },
    penguin: {
      name: 'Penguin', eyes: [48, 72, 62], top: 31,
      art: () => `<ellipse cx="60" cy="64" rx="34" ry="33" fill="#2b2f3a"/>
        <path d="M60 50 Q46 36 34 54 Q28 80 60 94 Q92 80 86 54 Q74 36 60 50Z" fill="#fbfbfb"/>
        ${eyes(48, 72, 62)}${blush(40, 80, 74)}
        <path d="M52 70 Q60 66 68 70 Q64 78 60 79 Q56 78 52 70Z" fill="#f2a03a"/>`,
    },
    koala: {
      name: 'Koala', eyes: [47, 73, 63], top: 39,
      art: () => `<circle cx="28" cy="46" r="18" fill="#9aa3ad"/><circle cx="92" cy="46" r="18" fill="#9aa3ad"/>
        <circle cx="28" cy="46" r="10" fill="#f1e6e6"/><circle cx="92" cy="46" r="10" fill="#f1e6e6"/>
        <ellipse cx="60" cy="68" rx="31" ry="29" fill="#a8b1ba"/>
        ${eyes(47, 73, 63, 3.6, 4.6)}${blush(39, 81, 78)}
        <ellipse cx="60" cy="75" rx="8" ry="10" fill="#3b3b45"/><ellipse cx="57.5" cy="71" rx="2.2" ry="2.8" fill="#fff" opacity=".35"/>
        <path d="M55 88 q5 3 10 0" stroke="#3b3b45" stroke-width="1.9" fill="none" stroke-linecap="round"/>`,
    },
    lion: {
      name: 'Lion', eyes: [49, 71, 62], top: 26,
      art: () => {
        let mane = '<circle cx="60" cy="63" r="40" fill="#c8742c"/>';
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * Math.PI * 2;
          mane += `<circle cx="${(60 + Math.cos(a) * 37).toFixed(1)}" cy="${(63 + Math.sin(a) * 37).toFixed(1)}" r="12" fill="#c8742c"/>`;
        }
        return `${mane}<circle cx="38" cy="40" r="8" fill="#f2b85a"/><circle cx="82" cy="40" r="8" fill="#f2b85a"/>
          <ellipse cx="60" cy="66" rx="29" ry="28" fill="#f2b85a"/>
          <ellipse cx="53" cy="79" rx="8.5" ry="6.5" fill="#fbe2b0"/><ellipse cx="67" cy="79" rx="8.5" ry="6.5" fill="#fbe2b0"/>
          ${eyes(49, 71, 62)}
          <path d="M55.5 72 h9 l-4.5 5z" fill="#7a4a2a"/>${smile(80, '#7a4a2a')}`;
      },
    },
    falcon: {
      name: 'Falcon', eyes: [47, 73, 56], eyeR: 10, top: 26,
      art: () => `<path d="M28 60 Q28 26 60 24 Q92 26 92 60 Q92 92 60 100 Q28 92 28 60Z" fill="#6f7a86"/>
        <path d="M32 46 Q60 20 88 46 Q74 36 60 36 Q46 36 32 46Z" fill="#4a535e"/>
        <path d="M34 66 Q46 70 52 82 Q56 96 60 100 Q64 96 68 82 Q74 70 86 66 Q86 90 60 100 Q34 90 34 66Z" fill="#f1ebe0"/>
        <path d="M38 60 Q44 70 44 84 Q38 76 36 64Z M82 60 Q76 70 76 84 Q82 76 84 64Z" fill="#3e4652"/>
        <path d="M37 48 Q47 44 56 50 M83 48 Q73 44 64 50" stroke="#3e4652" stroke-width="3" fill="none" stroke-linecap="round"/>
        <circle cx="47" cy="56" r="8" fill="#f2c94c"/><circle cx="73" cy="56" r="8" fill="#f2c94c"/>
        ${eyes(47, 73, 56, 5.6, 5.6)}
        <path d="M52 62 Q60 57 68 62 Q66 72 60 79 Q54 72 52 62Z" fill="#f2c94c"/>
        <path d="M57 72 Q60 80 60 79 Q63 75 63 72Z" fill="#3b3b45"/>`,
    },
    camel: {
      name: 'Camel', eyes: [49, 71, 60], top: 30,
      art: () => `<ellipse cx="33" cy="44" rx="8" ry="5" fill="#c8955a" transform="rotate(-30 33 44)"/>
        <ellipse cx="87" cy="44" rx="8" ry="5" fill="#c8955a" transform="rotate(30 87 44)"/>
        <ellipse cx="60" cy="62" rx="26" ry="31" fill="#d6a96b"/>
        <circle cx="50" cy="34" r="7" fill="#b8864b"/><circle cx="58" cy="30" r="8" fill="#b8864b"/><circle cx="67" cy="33" r="7" fill="#b8864b"/>
        <ellipse cx="60" cy="84" rx="19" ry="14" fill="#e8c79a"/>
        ${eyes(49, 71, 60, 3.8, 4.8)}
        <path d="M44 55 l-3 -3 M46.5 54 l-1 -4 M76 55 l3 -3 M73.5 54 l1 -4" stroke="#3b2a22" stroke-width="1.6" stroke-linecap="round"/>
        ${blush(42, 78, 70)}
        <path d="M53 82 q2 -3 4 0 M63 82 q2 -3 4 0" stroke="#8a5a3a" stroke-width="2" fill="none" stroke-linecap="round"/>
        <path d="M54 91 q6 4 12 0" stroke="#8a5a3a" stroke-width="1.9" fill="none" stroke-linecap="round"/>`,
    },
  };

  const EXTRAS = {
    none: { name: 'None', art: () => '' },
    glasses: {
      name: 'Glasses',
      art: (an) => {
        const [x1, x2, y] = an.eyes;
        const r = an.eyeR || 7.5;
        return `<g stroke="#1f1d24" stroke-width="2.4" fill="rgba(255,255,255,.16)"><circle cx="${x1}" cy="${y}" r="${r}"/><circle cx="${x2}" cy="${y}" r="${r}"/></g>
          <path d="M${x1 + r} ${y} Q60 ${y - 3} ${x2 - r} ${y}" stroke="#1f1d24" stroke-width="2.4" fill="none"/>`;
      },
    },
    headphones: {
      name: 'Headphones',
      art: (an) => {
        const t = an.top - 6;
        return `<path d="M22 66 Q20 ${t} 60 ${t} Q100 ${t} 98 66" stroke="#2b2f3a" stroke-width="6" fill="none" stroke-linecap="round"/>
          <rect x="13" y="54" width="16" height="28" rx="7" fill="#e2434b"/><rect x="91" y="54" width="16" height="28" rx="7" fill="#e2434b"/>
          <rect x="22" y="58" width="6" height="20" rx="3" fill="#2b2f3a"/><rect x="92" y="58" width="6" height="20" rx="3" fill="#2b2f3a"/>`;
      },
    },
    cap: {
      name: 'Grad cap',
      art: (an) => {
        const t = an.top;
        return `<path d="M42 ${t - 2} v8 Q60 ${t + 14} 78 ${t + 6} v-8Z" fill="#2f333d"/>
          <path d="M60 ${t - 14} L94 ${t - 3} L60 ${t + 7} L26 ${t - 3}Z" fill="#23262f"/>
          <path d="M60 ${t - 3} L88 ${t + 2} V${t + 18}" stroke="#f2c94c" stroke-width="2" fill="none"/>
          <circle cx="88" cy="${t + 20}" r="3" fill="#f2c94c"/>`;
      },
    },
  };

  const BACKGROUNDS = ['#7fb0ff', '#9d8cff', '#e0a96d', '#7ccf7a', '#ff9a6b', '#e6a48f', '#3fb8c8', '#f6c544', '#2b3240'];
  const DEFAULT = { animal: 'fox', extra: 'none', bg: '#7fb0ff' };

  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY));
      // Older human-style avatars aren't supported any more; treat them as no avatar.
      if (!v || !ANIMALS[v.animal]) return null;
      return Object.assign({}, DEFAULT, v);
    } catch (e) { return null; }
  }
  function save(a) {
    try {
      if (a) localStorage.setItem(KEY, JSON.stringify(a));
      else localStorage.removeItem(KEY);
    } catch (e) { /* storage unavailable */ }
  }

  function svg(a, { size = 120 } = {}) {
    const an = ANIMALS[a.animal] || ANIMALS.fox;
    const ex = EXTRAS[a.extra] || EXTRAS.none;
    const id = 'av' + Math.random().toString(36).slice(2, 8);
    // The page styles bare <svg> elements as stroked icons, so reset that here.
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${size}" height="${size}" style="fill:#000;stroke:none" aria-hidden="true">
      <defs><clipPath id="${id}"><circle cx="60" cy="60" r="60"/></clipPath></defs>
      <g clip-path="url(#${id})"><rect width="120" height="120" fill="${a.bg}"/>
      <ellipse cx="60" cy="112" rx="44" ry="14" fill="rgba(0,0,0,.12)"/>
      ${an.art()}${ex.art(an)}</g></svg>`;
  }

  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const random = () => ({
    animal: pick(Object.keys(ANIMALS)),
    extra: Math.random() < 0.5 ? 'none' : pick(Object.keys(EXTRAS)),
    bg: pick(BACKGROUNDS),
  });

  // ---------- editor ----------
  const listeners = [];
  let draft = null;
  let modal = null;

  function build() {
    modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'avatarModal';
    modal.hidden = true;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'avatarTitle');
    modal.innerHTML = `
      <div class="modal-card avatar-card">
        <button class="icon-btn small modal-close" data-av="close" aria-label="Close"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        <h2 id="avatarTitle">Choose your study buddy</h2>
        <p class="premium-reason">Optional. Your animal travels with you on the map.</p>
        <div class="avatar-preview" data-av="preview"></div>
        <div class="avatar-sections" data-av="sections"></div>
        <div class="avatar-actions">
          <button class="btn ghost" data-av="random">🎲 Surprise me</button>
          <button class="btn ghost" data-av="remove">Use the default pin</button>
        </div>
        <button class="btn premium-cta avatar-save" data-av="save">Save</button>
      </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) return close();
      const act = e.target.closest('[data-av]');
      if (!act) return;
      const what = act.dataset.av;
      if (what === 'close') close();
      if (what === 'random') { draft = random(); render(); }
      if (what === 'remove') { save(null); notify(); close(); }
      if (what === 'save') { save(draft); notify(); close(); }
      if (what === 'opt') { draft[act.dataset.key] = act.dataset.value; render(); }
    });
  }

  function render() {
    modal.querySelector('[data-av="preview"]').innerHTML = svg(draft, { size: 128 });
    const animals = Object.entries(ANIMALS).map(([id, an]) => {
      const on = draft.animal === id;
      return `<button class="av-animal${on ? ' active' : ''}" data-av="opt" data-key="animal" data-value="${id}" aria-pressed="${on}">
        ${svg({ animal: id, extra: 'none', bg: draft.bg }, { size: 52 })}<span>${an.name}</span></button>`;
    }).join('');
    const extras = Object.entries(EXTRAS).map(([id, ex]) => {
      const on = draft.extra === id;
      return `<button class="av-chip${on ? ' active' : ''}" data-av="opt" data-key="extra" data-value="${id}" aria-pressed="${on}">${ex.name}</button>`;
    }).join('');
    const bgs = BACKGROUNDS.map((c) => {
      const on = draft.bg === c;
      return `<button class="av-swatch${on ? ' active' : ''}" data-av="opt" data-key="bg" data-value="${c}" style="--sw:${c}" aria-label="Background ${c}" aria-pressed="${on}"></button>`;
    }).join('');
    modal.querySelector('[data-av="sections"]').innerHTML = `
      <div class="av-section"><div class="av-label">Animal</div><div class="av-animals">${animals}</div></div>
      <div class="av-section"><div class="av-label">Accessory</div><div class="av-options">${extras}</div></div>
      <div class="av-section"><div class="av-label">Background</div><div class="av-options">${bgs}</div></div>`;
  }

  function open() {
    if (!modal) build();
    draft = Object.assign({}, load() || DEFAULT);
    render();
    modal.hidden = false;
    requestAnimationFrame(() => modal.classList.add('show'));
    setTimeout(() => modal.querySelector('[data-av="save"]').focus(), 60);
  }

  function close() {
    if (!modal || modal.hidden) return;
    modal.classList.remove('show');
    setTimeout(() => { modal.hidden = true; }, 250);
  }

  function notify() { listeners.forEach((fn) => fn(load())); }

  FP.avatar = {
    svg,
    open,
    close,
    get: load,
    get isOpen() { return !!modal && !modal.hidden; },
    onChange(fn) { listeners.push(fn); },
  };
})();
