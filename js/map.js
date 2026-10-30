/*
 * The world map: an illustrated island where every study spot is a landmark.
 * Pick a place, your pin travels there, and the map zooms into the scene.
 */
(function () {
  'use strict';
  const FP = window.FP;
  const VW = 1600;
  const VH = 1000;

  // Ground position of each landmark and how tall it is (for pin placement).
  const PLACES = {
    space: { x: 1392, y: 222, h: 156 },
    cabin: { x: 300, y: 262, h: 100 },
    library: { x: 735, y: 240, h: 122 },
    rain: { x: 930, y: 305, h: 172 },
    coffee: { x: 790, y: 525, h: 140 },
    diner: { x: 1030, y: 612, h: 122 },
    office: { x: 1185, y: 440, h: 186 },
    garden: { x: 430, y: 662, h: 80 },
    ocean: { x: 1300, y: 835, h: 96 },
    airport: { x: 860, y: 800, h: 152 },
    hotel: { x: 178, y: 530, h: 176 },
    mosque: { x: 425, y: 470, h: 176 },
    alajeer: { x: 1092, y: 236, h: 196 },
    henson: { x: 236, y: 812, h: 172 },
    spa: { x: 540, y: 850, h: 118 },
    bus: { x: 402, y: 888, h: 76 },
    train: { x: 1268, y: 626, h: 86 },
    plane: { x: 860, y: 896, h: 40 },
    yoga: { x: 1428, y: 748, h: 86 },
  };

  // ---------- geometry helpers ----------
  function smooth(pts, closed) {
    const n = pts.length;
    const p = (i) => pts[closed ? (i + n) % n : Math.max(0, Math.min(n - 1, i))];
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    const last = closed ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const p0 = p(i - 1), p1 = p(i), p2 = p(i + 1), p3 = p(i + 2);
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`;
    }
    return closed ? d + 'Z' : d;
  }

  function inside(pt, poly) {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i];
      const [xj, yj] = poly[j];
      if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  }

  function segDist(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  }
  const lineDist = (p, line) => {
    let m = Infinity;
    for (let i = 0; i < line.length - 1; i++) m = Math.min(m, segDist(p, line[i], line[i + 1]));
    return m;
  };

  // Deterministic randomness so the island looks the same every visit.
  function rng(seed) {
    return () => {
      seed |= 0;
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // ---------- terrain ----------
  const ISLAND = [[150, 130], [330, 80], [560, 100], [780, 70], [1010, 100], [1190, 160], [1235, 270], [1225, 380], [1290, 470], [1300, 600], [1370, 690], [1460, 780], [1450, 890], [1270, 945], [1020, 920], [770, 950], [520, 925], [300, 945], [150, 880], [85, 720], [100, 540], [65, 380], [85, 240]];
  const ISLET = [[1305, 150], [1420, 115], [1515, 160], [1530, 255], [1450, 305], [1340, 290], [1290, 225]];
  const BEACH = [[1170, 770], [1300, 705], [1420, 740], [1475, 860], [1385, 945], [1220, 935], [1140, 850]];
  const SNOW = [[110, 170], [260, 110], [470, 118], [560, 200], [520, 330], [380, 385], [220, 372], [110, 300]];
  const TOWN = [[690, 430], [900, 395], [1120, 375], [1250, 455], [1160, 660], [950, 690], [720, 610]];
  const CAMPUS = [[640, 160], [860, 145], [1020, 225], [1000, 345], [820, 355], [660, 295]];
  const PARK = [[300, 575], [520, 570], [560, 690], [470, 770], [320, 765], [262, 668]];
  const AIRPORT = [[700, 760], [1010, 752], [1125, 860], [1118, 924], [692, 936], [672, 850]];
  const RIVER = [[520, 150], [575, 280], [540, 400], [600, 500], [585, 620], [640, 760], [620, 880], [650, 975]];
  const ROADS = [
    [[300, 262], [420, 330], [560, 300], [650, 252], [735, 240]],
    [[735, 240], [840, 275], [930, 305]],
    [[735, 240], [760, 360], [790, 525]],
    [[790, 525], [900, 590], [1030, 612]],
    [[1030, 612], [1120, 525], [1185, 440]],
    [[930, 305], [1060, 352], [1185, 440]],
    [[1185, 440], [1252, 340], [1330, 262], [1392, 228]],
    [[790, 525], [640, 592], [520, 645], [430, 662]],
    [[1030, 612], [1130, 700], [1230, 785], [1300, 835]],
    [[430, 662], [300, 566], [250, 420], [300, 262]],
    [[1030, 612], [990, 700], [920, 770], [860, 800]],
    [[266, 492], [220, 515], [178, 530]],
    [[420, 332], [430, 400], [425, 470]],
    [[1060, 352], [1078, 300], [1092, 236]],
    [[430, 662], [340, 740], [236, 812]],
    [[430, 662], [492, 760], [540, 850]],
    [[340, 740], [380, 816], [402, 888]],
  ];

  // ---------- small props ----------
  const tree = (x, y, r, c) => `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)})"><ellipse cx="2" cy="2" rx="${r * 0.9}" ry="${r * 0.35}" fill="rgba(30,60,30,.25)"/><rect x="-2" y="${-r * 0.7}" width="4" height="${r * 0.7}" fill="#7a5532"/><circle cy="${-r}" r="${r}" fill="${c}"/><circle cx="${-r * 0.3}" cy="${-r * 1.3}" r="${r * 0.45}" fill="rgba(255,255,255,.18)"/></g>`;
  const pine = (x, y, s, snow) => `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) scale(${s.toFixed(2)})"><ellipse cx="2" cy="1" rx="12" ry="4" fill="rgba(40,60,80,.2)"/><rect x="-2" y="-8" width="4" height="8" fill="#6b4a2e"/><path d="M0 -46 L14 -18 L-14 -18Z M0 -34 L17 -6 L-17 -6Z" fill="#2f7d55"/>${snow ? '<path d="M0 -46 L6 -34 L2 -36 L-2 -33 L-6 -35Z M0 -34 L7 -22 L2 -24 L-3 -21 L-8 -23Z" fill="#fff"/>' : ''}</g>`;
  const house = (x, y, wall, roof) => `<g transform="translate(${x} ${y})"><ellipse cx="2" cy="2" rx="24" ry="6" fill="rgba(0,0,0,.15)"/><rect x="-18" y="-22" width="36" height="22" fill="${wall}" stroke="#5b4636" stroke-width="2"/><path d="M-22 -20 L0 -40 L22 -20Z" fill="${roof}" stroke="#5b4636" stroke-width="2"/><rect x="-11" y="-15" width="8" height="8" fill="#9ad7f0"/><rect x="3" y="-14" width="8" height="14" fill="#7a5532"/></g>`;
  const topPlane = (tail) => `<g><ellipse cx="2" cy="4" rx="20" ry="4" fill="rgba(0,0,0,.18)"/><path d="M-4 -2 L-10 -18 L-4 -18 L6 -2Z M-4 2 L-10 18 L-4 18 L6 2Z" fill="#cfd6df"/><path d="M-17 -1 L-21 -8 L-18 -8 L-12 -1Z M-17 1 L-21 8 L-18 8 L-12 1Z" fill="${tail}"/><rect x="-20" y="-3" width="40" height="6" rx="3" fill="#f4f6f9" stroke="#8a939c" stroke-width="1"/></g>`;
  const palm = (x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0 Q6 -40 16 -78" stroke="#9b6a3c" stroke-width="7" fill="none" stroke-linecap="round"/><g transform="translate(16 -78)" fill="#3fa05a"><path d="M0 0 Q-24 -16 -44 4 Q-22 -6 0 0Z"/><path d="M0 0 Q24 -18 46 2 Q22 -6 0 0Z"/><path d="M0 0 Q-8 -28 -30 -30 Q-10 -18 0 0Z"/><path d="M0 0 Q10 -28 32 -30 Q12 -16 0 0Z"/></g></g>`;

  // ---------- landmarks (drawn with the ground point at 0,0) ----------
  const LANDMARKS = {
    coffee: () => {
      let awning = '';
      const w = 108 / 8;
      for (let i = 0; i < 8; i++) {
        awning += `<path d="M${-54 + i * w} -60 h${w} v14 a${w / 2} ${w / 3} 0 0 1 ${-w} 0z" fill="${i % 2 ? '#fff' : '#e2574c'}"/>`;
      }
      return `<ellipse cx="0" cy="3" rx="66" ry="12" fill="rgba(0,0,0,.18)"/>
        <rect x="-54" y="-74" width="108" height="74" rx="4" fill="#fff4e2" stroke="#6b4226" stroke-width="3"/>
        <rect x="-58" y="-84" width="116" height="14" rx="4" fill="#6b4226"/>
        ${awning}
        <rect x="-44" y="-36" width="44" height="28" rx="3" fill="#8fd3f0" stroke="#6b4226" stroke-width="2.5"/>
        <path d="M-22 -36 v28" stroke="#6b4226" stroke-width="2"/>
        <rect x="12" y="-38" width="22" height="38" rx="2" fill="#8a5532" stroke="#6b4226" stroke-width="2.5"/>
        <circle cx="29" cy="-18" r="2" fill="#f0c27a"/>
        <rect x="40" y="-30" width="9" height="18" rx="2" fill="#2e2a26"/><path d="M41 -26 h7 M41 -22 h5" stroke="#fff" stroke-width="1.2"/>
        <g transform="translate(0 -104)"><circle r="18" fill="#6b4226" stroke="#f3c47c" stroke-width="3"/><path d="M-9 -3 h15 v5 a7.5 7.5 0 0 1 -15 0z" fill="#fff"/><path d="M6 -1 a4.5 4.5 0 0 1 0 8" stroke="#fff" stroke-width="2.5" fill="none"/></g>
        <g class="steam" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"><path d="M-5 -126 q-6 -7 0 -14 t0 -14"/><path d="M6 -128 q-6 -7 0 -14 t0 -14"/></g>`;
    },
    diner: () => {
      let win = '';
      for (let i = 0; i < 5; i++) win += `<rect x="${-56 + i * 23}" y="-50" width="18" height="20" rx="3" fill="#ffe7a8" stroke="#2f3b45" stroke-width="2"/>`;
      return `<ellipse cx="0" cy="3" rx="74" ry="12" fill="rgba(0,0,0,.18)"/>
        <rect x="-66" y="-58" width="132" height="58" rx="14" fill="#eef7f8" stroke="#2f3b45" stroke-width="3"/>
        <rect x="-70" y="-66" width="140" height="12" rx="6" fill="#e2434b" stroke="#2f3b45" stroke-width="2.5"/>
        ${win}
        <rect x="-64" y="-24" width="128" height="9" fill="#e2434b"/>
        <rect x="-64" y="-15" width="128" height="4" fill="#b7c2c9"/>
        <rect x="-3" y="-94" width="6" height="28" fill="#2f3b45"/>
        <g class="neon"><rect x="-44" y="-122" width="88" height="30" rx="9" fill="#2b1d3a" stroke="#ff5fa2" stroke-width="3"/>
        <text x="0" y="-101" text-anchor="middle" font-size="16" font-weight="800" letter-spacing="3" fill="#ffd1e6">DINER</text></g>`;
    },
    library: () => {
      let cols = '';
      for (let i = 0; i < 6; i++) cols += `<rect x="${-52 + i * 19.4}" y="-74" width="9" height="56" fill="#fffaf0" stroke="#b9ab8d" stroke-width="1.5"/>`;
      return `<ellipse cx="0" cy="3" rx="78" ry="12" fill="rgba(0,0,0,.18)"/>
        <rect x="-72" y="-10" width="144" height="10" fill="#d8cfbd" stroke="#8f7f62" stroke-width="2"/>
        <rect x="-64" y="-18" width="128" height="9" fill="#e4dccb" stroke="#8f7f62" stroke-width="2"/>
        <rect x="-58" y="-78" width="116" height="60" fill="#e9dfc9" stroke="#8f7f62" stroke-width="2.5"/>
        <rect x="-7" y="-52" width="14" height="34" rx="7" fill="#6f5a3b"/>
        ${cols}
        <rect x="-66" y="-88" width="132" height="11" fill="#e4dccb" stroke="#8f7f62" stroke-width="2"/>
        <path d="M-70 -88 L0 -122 L70 -88Z" fill="#efe6d2" stroke="#8f7f62" stroke-width="2.5"/>
        <circle cx="0" cy="-101" r="7" fill="#c9a24d" stroke="#8f7f62" stroke-width="2"/>`;
    },
    rain: () => {
      let win = '';
      const lit = [1, 0, 1, 0, 1, 1, 1, 0, 0, 1, 0, 1];
      for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) win += `<rect x="${-36 + c * 27}" y="${-92 + r * 20}" width="18" height="13" rx="2" fill="${lit[r * 3 + c] ? '#ffd57a' : '#7c9cbc'}"/>`;
      let drops = '';
      for (let i = 0; i < 7; i++) drops += `<path class="raindrop" style="animation-delay:${(-i * 0.13).toFixed(2)}s" d="M${-30 + i * 10} 8 l-3 12" />`;
      return `<ellipse cx="0" cy="3" rx="58" ry="11" fill="rgba(0,0,0,.18)"/>
        <rect x="-48" y="-104" width="96" height="104" rx="3" fill="#c8694b" stroke="#7d3a28" stroke-width="3"/>
        <rect x="-53" y="-112" width="106" height="11" rx="2" fill="#5b2e22"/>
        ${win}
        <rect x="-11" y="-22" width="22" height="22" fill="#5b2e22"/>
        <g transform="translate(0 -152)">
          <g class="rain-drops" stroke="#7fb0ff" stroke-width="2.5" stroke-linecap="round">${drops}</g>
          <g fill="#97a4b3"><ellipse cx="-14" cy="0" rx="26" ry="14"/><ellipse cx="14" cy="-4" rx="28" ry="18"/><ellipse cx="34" cy="4" rx="16" ry="11"/><ellipse cx="-34" cy="5" rx="14" ry="9"/></g>
          <ellipse cx="6" cy="-10" rx="16" ry="7" fill="rgba(255,255,255,.25)"/>
        </g>`;
    },
    office: () => {
      let grid = '';
      for (let y = -150; y < -6; y += 13) grid += `<path d="M-38 ${y} h60" stroke="rgba(255,255,255,.45)" stroke-width="1.5"/>`;
      let side = '';
      for (let y = -92; y < -8; y += 14) side += `<rect x="28" y="${y}" width="32" height="7" fill="#e6f3fb"/>`;
      return `<ellipse cx="0" cy="3" rx="62" ry="12" fill="rgba(0,0,0,.18)"/>
        <rect x="22" y="-102" width="44" height="102" fill="#9cc3d9" stroke="#2f4f6b" stroke-width="3"/>${side}
        <rect x="-38" y="-162" width="60" height="162" fill="url(#glass)" stroke="#2f4f6b" stroke-width="3"/>
        ${grid}<path d="M-18 -162 v162 M2 -162 v162" stroke="rgba(255,255,255,.35)" stroke-width="1.5"/>
        <path d="M-8 -162 v-22" stroke="#2f4f6b" stroke-width="3"/><circle class="blink" cx="-8" cy="-186" r="4" fill="#ff4d4d"/>
        <rect x="-50" y="-12" width="14" height="12" fill="#c2683f"/><circle cx="-43" cy="-18" r="9" fill="#3f9b5a"/>`;
    },
    garden: () => {
      const beds = [[-46, -30], [46, -30], [-46, 0], [46, 0]];
      const cols = ['#ff7aa2', '#ffd34d', '#b593ff', '#ff8a5c', '#fff'];
      let flowers = '';
      beds.forEach(([bx, by], i) => {
        flowers += `<ellipse cx="${bx}" cy="${by}" rx="24" ry="10" fill="#5ea850"/>`;
        for (let k = 0; k < 6; k++) flowers += `<circle cx="${bx - 16 + k * 6.4}" cy="${by + ((k % 2) * 5 - 3)}" r="3.2" fill="${cols[(i + k) % cols.length]}"/>`;
      });
      return `<ellipse cx="0" cy="-14" rx="86" ry="44" fill="#77bf66" stroke="#4e9a49" stroke-width="7"/>
        <path d="M-82 -14 H82 M0 -56 V28" stroke="#f3e6c4" stroke-width="10"/>
        ${flowers}
        <ellipse cx="0" cy="-14" rx="26" ry="13" fill="#dfe8ee" stroke="#a9b8c2" stroke-width="3"/>
        <ellipse cx="0" cy="-15" rx="19" ry="8" fill="#7fd0f2"/>
        <rect x="-3" y="-40" width="6" height="24" fill="#c9d4dc"/>
        <g class="jet" stroke="#bfeaff" stroke-width="3" fill="none" stroke-linecap="round"><path d="M0 -40 q-10 -14 -16 6"/><path d="M0 -40 q10 -14 16 6"/><path d="M0 -40 v-12"/></g>
        ${tree(-78, -40, 13, '#3f9b5a')}${tree(80, -42, 14, '#4aa862')}`;
    },
    ocean: () => `<ellipse cx="-14" cy="3" rx="56" ry="10" fill="rgba(120,90,40,.18)"/>
        <g transform="rotate(-8 6 -6)"><rect x="-10" y="-14" width="40" height="18" rx="2" fill="#5bc0eb"/><path d="M-2 -14 v18 M8 -14 v18 M18 -14 v18" stroke="#fff" stroke-width="3"/></g>
        <path d="M-22 2 L-22 -62" stroke="#6b4a2e" stroke-width="3.5"/>
        <path d="M-62 -58 A40 26 0 0 1 18 -58 Z" fill="#ff7a59"/>
        <path d="M-35 -58 Q-30 -84 -22 -84 Q-14 -84 -9 -58Z" fill="#fff"/>
        <path d="M-22 -84 Q2 -82 18 -58 L5 -58 Q0 -76 -22 -84Z" fill="#ffd34d"/>
        <circle cx="-50" cy="-6" r="8" fill="#fff"/><path d="M-58 -6 h16 M-50 -14 v16" stroke="#e2434b" stroke-width="3"/>
        ${palm(36, 2, 0.95)}`,
    cabin: () => `<ellipse cx="0" cy="3" rx="62" ry="11" fill="rgba(60,80,100,.2)"/>
        <rect x="-44" y="-52" width="88" height="52" fill="#8b5a2b" stroke="#4e2f14" stroke-width="3"/>
        <path d="M-44 -42 h88 M-44 -31 h88 M-44 -20 h88 M-44 -9 h88" stroke="#6b4320" stroke-width="2"/>
        <rect x="-32" y="-38" width="20" height="17" fill="#ffcf6b" stroke="#4e2f14" stroke-width="2.5"/>
        <rect x="8" y="-32" width="20" height="32" fill="#4e2f14"/>
        <rect x="20" y="-94" width="13" height="30" fill="#7d7d7d" stroke="#555" stroke-width="2"/>
        <path d="M-58 -46 L0 -94 L58 -46Z" fill="#5a3a22" stroke="#4e2f14" stroke-width="3"/>
        <path d="M-52 -50 L0 -92 L52 -50 L44 -48 L30 -58 L18 -50 L4 -62 L-10 -52 L-24 -60 L-38 -48Z" fill="#fff"/>
        <g class="smoke" fill="#e9eef2"><circle cx="26" cy="-102" r="7"/><circle cx="26" cy="-102" r="7"/><circle cx="26" cy="-102" r="7"/></g>`,
    airport: () => `<ellipse cx="0" cy="3" rx="92" ry="13" fill="rgba(0,0,0,.18)"/>
        <rect x="64" y="-120" width="14" height="120" fill="#dfe6ee" stroke="#3b4a5a" stroke-width="2.5"/>
        <path d="M56 -120 L86 -120 L80 -142 L62 -142Z" fill="url(#glass)" stroke="#3b4a5a" stroke-width="2.5"/>
        <rect x="58" y="-150" width="26" height="8" rx="2" fill="#3b4a5a"/>
        <circle class="blink" cx="71" cy="-156" r="4" fill="#ff4d4d"/>
        <rect x="-84" y="-52" width="140" height="52" fill="#eef2f6" stroke="#3b4a5a" stroke-width="3"/>
        <rect x="-78" y="-44" width="128" height="28" fill="url(#glass)"/>
        <path d="M-78 -30 h128 M-46 -44 v28 M-14 -44 v28 M18 -44 v28" stroke="rgba(255,255,255,.5)" stroke-width="1.5"/>
        <path d="M-92 -52 Q-14 -84 64 -52Z" fill="#cfd8e2" stroke="#3b4a5a" stroke-width="3"/>
        <rect x="-26" y="-16" width="22" height="16" fill="#3b4a5a"/>
        <g transform="translate(-50 -82)"><circle r="14" fill="#6b4226" stroke="#f3c47c" stroke-width="2.5"/><path d="M-7 -2 h11 v4 a5.5 5.5 0 0 1 -11 0z" fill="#fff"/><path d="M4 -1 a3.5 3.5 0 0 1 0 6" stroke="#fff" stroke-width="2" fill="none"/></g>`,
    hotel: () => {
      let win = '';
      for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) win += `<rect x="${-34 + c * 18}" y="${-138 + r * 18}" width="12" height="11" rx="1.5" fill="${(r * 4 + c) % 3 ? '#ffd98a' : '#8aa0b4'}"/>`;
      return `<ellipse cx="0" cy="3" rx="74" ry="12" fill="rgba(0,0,0,.18)"/>
        <rect x="-46" y="-152" width="92" height="152" fill="#f4ead8" stroke="#7a5f3a" stroke-width="3"/>
        <path d="M-54 -152 H54 L44 -168 H-44Z" fill="#d4a64a" stroke="#7a5f3a" stroke-width="2.5"/>
        <path d="M0 -168 V-186" stroke="#7a5f3a" stroke-width="2.5"/><path d="M0 -186 L16 -181 L0 -176Z" fill="#e6a48f"/>
        <text x="0" y="-157" text-anchor="middle" font-size="9" font-weight="800" letter-spacing="2" fill="#7a5f3a">★★★★★</text>
        ${win}
        <path d="M-16 0 V-20 A16 16 0 0 1 16 -20 V0Z" fill="#3b2a1a"/>
        <rect x="-30" y="-34" width="60" height="9" rx="2" fill="#8c2f3c"/>
        <circle cx="-36" cy="-14" r="9" fill="#3f9b5a"/><rect x="-41" y="-6" width="10" height="6" fill="#d4a64a"/>
        <circle cx="36" cy="-14" r="9" fill="#3f9b5a"/><rect x="31" y="-6" width="10" height="6" fill="#d4a64a"/>`;
    },
    mosque: () => {
      let arches = '';
      for (let i = 0; i < 4; i++) {
        const x = -56 + i * 26;
        arches += `<path d="M${x} -6 V-30 Q${x} -42 ${x + 9} -46 Q${x + 18} -42 ${x + 18} -30 V-6Z" fill="#6b5236"/>`;
      }
      let crenel = '';
      for (let x = -62; x < 46; x += 10) crenel += `<rect x="${x}" y="-66" width="6" height="6" fill="#e6d6b4"/>`;
      return `<ellipse cx="0" cy="3" rx="82" ry="12" fill="rgba(0,0,0,.18)"/>
        <rect x="-64" y="-60" width="110" height="60" fill="#f3e7cf" stroke="#8a7350" stroke-width="3"/>
        ${crenel}${arches}
        <rect x="-64" y="-6" width="110" height="6" fill="#d9c49c"/>
        <path d="M-41 -60 C-41 -92 -20 -106 -9 -114 C2 -106 23 -92 23 -60Z" fill="#3fb8c8" stroke="#1f6f78" stroke-width="3"/>
        <path d="M-30 -70 C-28 -88 -18 -98 -11 -104" stroke="rgba(255,255,255,.55)" stroke-width="3" fill="none" stroke-linecap="round"/>
        <path d="M-9 -114 V-126" stroke="#c9a24a" stroke-width="2.5"/><path d="M-5 -134 a6 6 0 1 0 0 9 a4.5 4.5 0 1 1 0 -9z" fill="#c9a24a"/>
        <rect x="48" y="-150" width="14" height="150" fill="#f3e7cf" stroke="#8a7350" stroke-width="2.5"/>
        <rect x="43" y="-116" width="24" height="6" fill="#c9a24a"/>
        <path d="M47 -150 L55 -172 L63 -150Z" fill="#3fb8c8" stroke="#1f6f78" stroke-width="2"/>
        <g transform="translate(-58 -84)"><circle r="13" fill="#6b4226" stroke="#f3c47c" stroke-width="2.5"/><path d="M0 4 L-8 1 V-7 L0 -4Z M0 4 L8 1 V-7 L0 -4Z" fill="#fff"/></g>
        ${palm(-78, 2, 0.55)}`;
    },
    alajeer: () => {
      const b = FP.config.brand;
      let fins = '';
      for (let x = -28; x < 40; x += 12) fins += `<path d="M${x} -176 V-36" stroke="rgba(255,255,255,.4)" stroke-width="1.5"/>`;
      return `<ellipse cx="0" cy="3" rx="84" ry="12" fill="rgba(0,0,0,.18)"/>
        <rect x="40" y="-124" width="32" height="90" fill="#cfe0ee" stroke="#2f3b4a" stroke-width="2.5"/>
        <path d="M44 -112 h24 M44 -100 h24 M44 -88 h24 M44 -76 h24 M44 -64 h24 M44 -52 h24" stroke="#fff" stroke-width="2"/>
        <rect x="-42" y="-194" width="84" height="160" fill="url(#glass)" stroke="#2f3b4a" stroke-width="3"/>
        ${fins}
        <rect x="-42" y="-184" width="84" height="18" fill="${b.color}"/><rect x="-42" y="-167" width="84" height="2.5" fill="${b.accent}"/>
        <text x="0" y="-170" text-anchor="middle" font-size="12" font-weight="800" fill="#fff">${b.name}</text>
        <path d="M-10 -194 V-208" stroke="#2f3b4a" stroke-width="2.5"/><circle class="blink" cx="-10" cy="-210" r="3.5" fill="#ff4d4d"/>
        <rect x="-74" y="-36" width="148" height="36" fill="#eef2f6" stroke="#2f3b4a" stroke-width="3"/>
        <rect x="-64" y="-28" width="128" height="20" fill="url(#glass)"/>
        <rect x="-10" y="-20" width="20" height="20" fill="#2f3b4a"/>
        <rect x="-74" y="-40" width="148" height="5" fill="${b.accent}"/>`;
    },
    henson: () => {
      const hc = FP.config.henson;
      let zig = '';
      for (let y = -10; y > -146; y -= 14) zig += `L${y % 28 === -10 ? 56 : 48} ${y - 7} `;
      return `<ellipse cx="0" cy="3" rx="96" ry="13" fill="rgba(0,0,0,.18)"/>
        <g stroke="#e0a03a" stroke-width="3" fill="none" stroke-linejoin="round">
          <path d="M48 0 V-150 M56 0 V-150 M48 -3 ${zig}"/>
          <path d="M18 -150 H118 M18 -158 H118"/>
          <path d="M18 -150 L24 -158 L30 -150 L36 -158 L42 -150 L48 -158 L54 -150 L60 -158 L66 -150 L72 -158 L78 -150 L84 -158 L90 -150 L96 -158 L102 -150 L108 -158 L114 -150"/>
          <path d="M52 -174 L18 -158 M52 -174 L100 -158 M48 -158 L52 -174 L56 -158" stroke-width="2"/>
        </g>
        <rect x="16" y="-156" width="14" height="14" fill="#5a6372"/>
        <path d="M104 -150 V-104" stroke="#3b4a5a" stroke-width="1.5"/>
        <rect x="92" y="-104" width="24" height="5" fill="${hc.navy}"/>
        <circle class="blink" cx="52" cy="-178" r="3.5" fill="#ff4d4d"/>
        <rect x="-74" y="-66" width="112" height="66" fill="#f4f2ec" stroke="${hc.navy}" stroke-width="3"/>
        <rect x="-74" y="-66" width="112" height="13" fill="${hc.navy}"/>
        <rect x="-74" y="-17" width="112" height="5" fill="${hc.red}"/>
        <rect x="-64" y="-46" width="46" height="22" fill="url(#glass)" stroke="${hc.navy}" stroke-width="1.5"/>
        <rect x="-10" y="-46" width="20" height="34" fill="${hc.navy}"/>
        <rect x="16" y="-46" width="16" height="22" fill="url(#glass)" stroke="${hc.navy}" stroke-width="1.5"/>
        <rect x="-60" y="-104" width="42" height="40" rx="4" fill="#fff" stroke="${hc.navy}" stroke-width="2"/>
        <path d="M-50 -64 V-52 M-28 -64 V-52" stroke="${hc.navy}" stroke-width="2.5"/>
        <image href="${hc.logo}" x="-55" y="-100" width="32" height="32"/>
        <rect x="-112" y="-28" width="30" height="28" fill="#8e98a6" stroke="#3b4a5a" stroke-width="2"/>
        <path d="M-106 -24 v20 M-100 -24 v20 M-94 -24 v20 M-88 -24 v20" stroke="#5f6a78" stroke-width="1.5"/>
        <g fill="#d6dce4" stroke="#7d8794" stroke-width="1"><ellipse cx="-104" cy="-31" rx="3.5" ry="2"/><ellipse cx="-97" cy="-31" rx="3.5" ry="2"/><ellipse cx="-90" cy="-31" rx="3.5" ry="2"/></g>`;
    },
    spa: () => {
      let stars = '';
      [[-22, -78], [-8, -92], [8, -92], [22, -78], [0, -76]].forEach(([x, y]) => { stars += `<path d="M${x} ${y - 4} L${x + 1.3} ${y - 1.3} L${x + 4} ${y} L${x + 1.3} ${y + 1.3} L${x} ${y + 4} L${x - 1.3} ${y + 1.3} L${x - 4} ${y} L${x - 1.3} ${y - 1.3}Z" fill="#fff6dc"/>`; });
      return `<ellipse cx="0" cy="3" rx="92" ry="13" fill="rgba(0,0,0,.18)"/>
        <g class="vapor" fill="#fff" opacity=".85"><circle cx="-6" cy="-112" r="9"/><circle cx="8" cy="-118" r="7"/><circle cx="-52" cy="-66" r="6"/><circle cx="54" cy="-64" r="6"/></g>
        <rect x="-78" y="-46" width="156" height="46" fill="#efdcc0" stroke="#8a6b48" stroke-width="3"/>
        <rect x="-78" y="-14" width="156" height="14" fill="#2a7f86"/>
        <path d="M-78 -14 h156" stroke="#f1e6cc" stroke-width="2" stroke-dasharray="6 6"/>
        <path d="M-66 -46 C-66 -66 -38 -66 -38 -46Z M38 -46 C38 -66 66 -66 66 -46Z" fill="#cfa77c" stroke="#8a6b48" stroke-width="2.5"/>
        <path d="M-40 -46 C-40 -92 40 -92 40 -46Z" fill="#e8c9a2" stroke="#8a6b48" stroke-width="3"/>
        <path d="M-28 -60 C-26 -74 -16 -82 -8 -84" stroke="rgba(255,255,255,.5)" stroke-width="3" fill="none" stroke-linecap="round"/>
        ${stars}
        <path d="M-12 0 V-22 Q-12 -32 0 -36 Q12 -32 12 -22 V0Z" fill="#1f6f78" stroke="#14484e" stroke-width="2"/>
        <circle cx="6" cy="-14" r="1.8" fill="#d9a64a"/>
        <path d="M-58 -24 h18 M40 -24 h18" stroke="#8a6b48" stroke-width="2"/>
        <g transform="translate(-50 -30)"><path d="M0 -10 Q-6 -16 0 -22 Q6 -16 0 -10" fill="#9fd3c7"/></g>
        ${palm(84, 2, 0.5)}`;
    },
    bus: () => `<ellipse cx="0" cy="3" rx="64" ry="10" fill="rgba(0,0,0,.18)"/>
        <rect x="-62" y="-64" width="3" height="64" fill="#3b4652"/><circle cx="-60.5" cy="-66" r="8" fill="#1f6fb2" stroke="#fff" stroke-width="2"/>
        <g transform="translate(-44 0)">
          <rect x="0" y="-52" width="86" height="44" rx="8" fill="#e8574a" stroke="#8f2e25" stroke-width="2.5"/>
          <rect x="6" y="-46" width="62" height="18" rx="3" fill="#bfe3f2"/>
          <path d="M26 -46 V-28 M46 -46 V-28" stroke="#e8574a" stroke-width="3"/>
          <rect x="72" y="-46" width="10" height="30" rx="2" fill="#bfe3f2" stroke="#8f2e25" stroke-width="1.5"/>
          <rect x="4" y="-22" width="64" height="5" fill="#fff" opacity=".85"/>
          <rect x="8" y="-58" width="34" height="7" rx="2" fill="#2a2f36"/><rect x="11" y="-56" width="20" height="3" fill="#ffb84d"/>
          <circle cx="18" cy="-6" r="8" fill="#2a2f36"/><circle cx="18" cy="-6" r="3" fill="#aab2bc"/>
          <circle cx="66" cy="-6" r="8" fill="#2a2f36"/><circle cx="66" cy="-6" r="3" fill="#aab2bc"/>
        </g>`,
    train: () => {
      let ties = '';
      for (let x = -96; x <= 96; x += 12) ties += `<rect x="${x}" y="-3" width="5" height="9" fill="#7a5532"/>`;
      return `<ellipse cx="0" cy="4" rx="104" ry="12" fill="rgba(0,0,0,.16)"/>
        ${ties}<path d="M-100 -1 H100 M-100 4 H100" stroke="#6b737c" stroke-width="2"/>
        <path d="M-92 -8 H52 Q86 -8 96 -26 L96 -30 Q80 -50 50 -50 H-92Z" fill="#f4f6f8" stroke="#3b4a5a" stroke-width="2.5"/>
        <path d="M-92 -18 H74 Q88 -20 94 -26" stroke="#4fb5a5" stroke-width="5" fill="none"/>
        <path d="M60 -46 Q82 -44 92 -30 L64 -30Z" fill="#2b3a4a"/>
        <g fill="#9fd0e8">${[-84, -62, -40, -18, 4, 26].map((x) => `<rect x="${x}" y="-44" width="16" height="12" rx="2"/>`).join('')}</g>
        <path d="M-40 -50 V-58 M-40 -58 L-24 -66 M-40 -58 L-56 -66" stroke="#3b4a5a" stroke-width="2"/>
        <rect x="-60" y="-14" width="10" height="4" fill="#3b4a5a"/>`;
    },
    // The little blue plane taxis down the runway and takes off (CSS); click it to board.
    plane: () => `<g class="map-jet">${topPlane('#3c6fd1')}</g>`,
    yoga: () => `<ellipse cx="0" cy="3" rx="76" ry="11" fill="rgba(0,0,0,.16)"/>
        <rect x="-70" y="-8" width="140" height="10" rx="2" fill="#b98a5c" stroke="#7d5f3c" stroke-width="2"/>
        <rect x="-56" y="-60" width="112" height="52" fill="#f4ece0" stroke="#8a6b48" stroke-width="2.5"/>
        <g fill="#bfe3f2" stroke="#8a6b48" stroke-width="1.5"><rect x="-48" y="-52" width="28" height="40"/><rect x="-14" y="-52" width="28" height="40"/><rect x="20" y="-52" width="28" height="40"/></g>
        <path d="M-34 -52 V-12 M0 -52 V-12 M34 -52 V-12" stroke="rgba(255,255,255,.7)" stroke-width="5"/>
        <path d="M-66 -60 H66 L58 -70 H-58Z" fill="#9cc5a1" stroke="#5d8a63" stroke-width="2"/>
        <g transform="translate(0 -82)"><circle r="13" fill="#fff" stroke="#9cc5a1" stroke-width="2.5"/>
          <path d="M0 6 C-3 1 -3 -4 0 -8 C3 -4 3 1 0 6Z M0 6 C-6 4 -9 0 -9 -4 C-5 -3 -2 0 0 6Z M0 6 C6 4 9 0 9 -4 C5 -3 2 0 0 6Z" fill="#d08a6a"/></g>
        <g transform="translate(-74 -6)"><rect x="-6" y="-14" width="12" height="14" fill="#c4805f"/><path d="M0 -14 Q-12 -30 -8 -40 M0 -14 Q2 -34 6 -42 M0 -14 Q12 -28 12 -36" stroke="#4f8f5a" stroke-width="4" fill="none" stroke-linecap="round"/></g>`,
    space: () => `<ellipse cx="0" cy="2" rx="62" ry="15" fill="#b9c0c7" stroke="#8a939c" stroke-width="3"/>
        <ellipse cx="0" cy="-1" rx="34" ry="7" fill="#9aa3ab"/>
        <g stroke="#d0543c" stroke-width="3" fill="none"><path d="M-56 0 V-132 M-40 0 V-132 M-56 -132 H-40"/><path d="M-56 -10 L-40 -30 L-56 -50 L-40 -70 L-56 -90 L-40 -110 L-56 -130"/><path d="M-40 -96 H-16"/></g>
        <g class="vapor" fill="#fff"><circle cx="-14" cy="-6" r="9"/><circle cx="12" cy="-6" r="10"/><circle cx="0" cy="-4" r="8"/></g>
        <path d="M-16 -44 L-28 -18 L-16 -22Z M16 -44 L28 -18 L16 -22Z" fill="#e2434b" stroke="#3b4a5a" stroke-width="2.5"/>
        <path d="M0 -156 C15 -138 17 -112 16 -24 L-16 -24 C-17 -112 -15 -138 0 -156Z" fill="#f7f9fb" stroke="#3b4a5a" stroke-width="3"/>
        <path d="M0 -156 C9 -146 13 -136 14 -126 L-14 -126 C-13 -136 -9 -146 0 -156Z" fill="#e2434b" stroke="#3b4a5a" stroke-width="2.5"/>
        <circle cx="0" cy="-98" r="7" fill="#5bc0eb" stroke="#3b4a5a" stroke-width="2.5"/>
        <rect x="-9" y="-24" width="18" height="8" rx="2" fill="#6b7785" stroke="#3b4a5a" stroke-width="2"/>`,
  };

  // ---------- build the SVG ----------
  function buildSVG() {
    const r = rng(7);
    const rand = (a, b) => a + r() * (b - a);
    const out = [];
    const isle = smooth(ISLAND, true);
    const islet = smooth(ISLET, true);
    const beach = smooth(BEACH, true);

    out.push(`<svg class="map-svg" viewBox="0 0 ${VW} ${VH}" xmlns="http://www.w3.org/2000/svg" role="group" aria-label="Island map of study spots">
      <defs>
        <radialGradient id="sea" cx="50%" cy="50%" r="75%"><stop offset="0" stop-color="#57c0e8"/><stop offset="1" stop-color="#2f8cc4"/></radialGradient>
        <linearGradient id="glass" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#c7ecff"/><stop offset="1" stop-color="#5d9ccc"/></linearGradient>
        <pattern id="waves" width="80" height="36" patternUnits="userSpaceOnUse"><path d="M6 18 q10 -7 20 0 t20 0" stroke="rgba(255,255,255,.35)" stroke-width="2.2" fill="none" stroke-linecap="round"/><path d="M46 34 q8 -5 16 0" stroke="rgba(255,255,255,.22)" stroke-width="2" fill="none" stroke-linecap="round"/></pattern>
        <filter id="lift" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#1d3b2a" flood-opacity=".28"/></filter>
        <filter id="liftLocked" x="-30%" y="-30%" width="160%" height="160%"><feColorMatrix type="saturate" values="0.08"/><feComponentTransfer><feFuncR type="linear" slope=".8" intercept=".12"/><feFuncG type="linear" slope=".8" intercept=".12"/><feFuncB type="linear" slope=".8" intercept=".14"/><feFuncA type="linear" slope=".8"/></feComponentTransfer><feDropShadow dx="0" dy="3" stdDeviation="2.5" flood-color="#1d3b2a" flood-opacity=".18"/></filter>
      </defs>
      <rect x="-200" y="-200" width="${VW + 400}" height="${VH + 400}" fill="url(#sea)"/>
      <rect class="waves" x="-200" y="-200" width="${VW + 400}" height="${VH + 400}" fill="url(#waves)"/>
      <g fill="#8edaf3" stroke="#8edaf3" stroke-width="80" stroke-linejoin="round"><path d="${isle}"/><path d="${islet}"/><path d="${beach}"/></g>
      <g fill="#f1dca0" stroke="#f1dca0" stroke-width="34" stroke-linejoin="round"><path d="${isle}"/><path d="${islet}"/></g>
      <path d="${isle}" fill="#94cf7d"/>
      <path d="${islet}" fill="#a3d68a"/>
      <path d="${beach}" fill="#f1dca0" stroke="#f1dca0" stroke-width="20" stroke-linejoin="round"/>`);

    // grass texture
    for (let i = 0; i < 70; i++) {
      const p = [rand(100, 1280), rand(110, 920)];
      if (inside(p, ISLAND) && !inside(p, BEACH)) out.push(`<ellipse cx="${p[0].toFixed(0)}" cy="${p[1].toFixed(0)}" rx="${rand(30, 80).toFixed(0)}" ry="${rand(12, 28).toFixed(0)}" fill="#86c470" opacity=".55"/>`);
    }
    out.push(`<path d="${smooth(SNOW, true)}" fill="#eef4f7" stroke="#dfe9ee" stroke-width="10"/>`);
    out.push(`<path d="${smooth(CAMPUS, true)}" fill="#a8da8e"/>`);
    out.push(`<path d="${smooth(TOWN, true)}" fill="#e6dcc3" opacity=".9"/>`);
    out.push(`<path d="${smooth(PARK, true)}" fill="#7fc46e" stroke="#5ea85a" stroke-width="6" stroke-dasharray="2 10" stroke-linecap="round"/>`);
    out.push(`<ellipse cx="1400" cy="214" rx="96" ry="54" fill="#d4d8dc" stroke="#bfc5ca" stroke-width="4"/>`);
    out.push(`<path d="${smooth(AIRPORT, true)}" fill="#d9d6cf" stroke="#c9c5bc" stroke-width="4"/>
      <rect x="690" y="892" width="425" height="28" rx="4" fill="#5b6270"/>
      <path d="M706 906 H1100" stroke="#fff" stroke-width="2.5" stroke-dasharray="16 14"/>
      <path d="M696 896 v20 M702 896 v20 M708 896 v20 M1097 896 v20 M1103 896 v20 M1109 896 v20" stroke="#fff" stroke-width="2.5"/>
      <path d="M905 812 C940 840 990 860 1000 892" stroke="#f2c84b" stroke-width="2.5" fill="none"/>
      <g transform="translate(985 812) rotate(-90)">${topPlane('#d0544c')}</g>`);
    out.push(`<ellipse cx="178" cy="542" rx="70" ry="26" fill="#e6dcc3" stroke="#d6c39b" stroke-width="4"/><circle cx="178" cy="552" r="9" fill="#7fd0f2" stroke="#a9b8c2" stroke-width="3"/>`);

    // mountains behind the cabin
    const peaks = [[200, 200, 120, 110], [300, 160, 150, 130], [420, 190, 130, 115], [150, 285, 90, 80], [500, 260, 100, 85]];
    peaks.forEach(([x, y, w, h]) => {
      out.push(`<path d="M${x - w / 2} ${y} L${x} ${y - h} L${x + w / 2} ${y}Z" fill="#8d9db0"/><path d="M${x} ${y - h} L${x + w / 2} ${y} L${x + w * 0.12} ${y}Z" fill="#76879b"/><path d="M${x} ${y - h} L${x + w * 0.17} ${y - h * 0.66} L${x + w * 0.05} ${y - h * 0.72} L${x - w * 0.06} ${y - h * 0.62} L${x - w * 0.17} ${y - h * 0.66}Z" fill="#fff"/>`);
    });

    // river with a soft highlight
    const river = smooth(RIVER, false);
    out.push(`<path d="${river}" fill="none" stroke="#5fc2ea" stroke-width="22" stroke-linecap="round"/><path d="${river}" fill="none" stroke="#a6e3f8" stroke-width="7" stroke-linecap="round" stroke-dasharray="18 26" class="river-flow"/>`);

    // roads (the one to the launch pad becomes a bridge over the water)
    const roads = ROADS.map((pts) => smooth(pts, false));
    out.push(`<g fill="none" stroke-linecap="round" stroke-linejoin="round">${roads.map((d) => `<path d="${d}" stroke="#d6c39b" stroke-width="22"/>`).join('')}${roads.map((d) => `<path d="${d}" stroke="#f8eed6" stroke-width="15"/>`).join('')}${roads.map((d) => `<path d="${d}" stroke="#e6d6b0" stroke-width="2" stroke-dasharray="8 12"/>`).join('')}</g>`);
    out.push(`<g fill="#9b8b70">${[[1262, 330], [1292, 298], [1322, 268]].map(([x, y]) => `<rect x="${x - 3}" y="${y + 8}" width="6" height="16"/>`).join('')}</g>`);

    // trees, keeping clear of roads, the river and landmarks
    const items = [];
    const near = (p, d) => Object.values(PLACES).some((pl) => Math.hypot(p[0] - pl.x, p[1] - pl.y + 30) < d);
    const blocked = (p) => near(p, 100) || ROADS.some((l) => lineDist(p, l) < 28) || lineDist(p, RIVER) < 26 || inside(p, BEACH) || inside(p, TOWN) || inside(p, AIRPORT) || Math.hypot(p[0] - 178, p[1] - 542) < 90;
    for (let i = 0; i < 900 && items.length < 190; i++) {
      const p = [rand(90, 1290), rand(110, 930)];
      if (!inside(p, ISLAND) || blocked(p)) continue;
      const shrink = [[p[0] - 40, p[1]], [p[0] + 40, p[1]], [p[0], p[1] + 30]];
      if (!shrink.every((q) => inside(q, ISLAND))) continue;
      if (inside(p, SNOW)) items.push([p[1], pine(p[0], p[1], rand(0.8, 1.15), true)]);
      else if (r() < 0.3) items.push([p[1], pine(p[0], p[1], rand(0.75, 1), false)]);
      else items.push([p[1], tree(p[0], p[1], rand(10, 17), ['#3f9b5a', '#4aa862', '#2f8a4e', '#58b56a'][Math.floor(r() * 4)])]);
    }
    [[880, 455], [945, 470], [700, 470], [1095, 470], [690, 570], [880, 680], [760, 690], [1120, 620]].forEach(([x, y], i) => {
      if (!blocked([x, y - 400]) || true) items.push([y, house(x, y, ['#fff4e2', '#f6d7c3', '#e3eef7', '#fff'][i % 4], ['#d0543c', '#4f7cac', '#e0a23a', '#6c8f4e'][i % 4])]);
    });
    [[1446, 862, 0.6], [1190, 880, 0.65], [1360, 900, 0.55]].forEach(([x, y, s]) => items.push([y, palm(x, y, s)]));
    items.sort((a, b) => a[0] - b[0]);
    out.push(items.map((i) => i[1]).join(''));

    // pier and boats
    out.push(`<g><rect x="1440" y="700" width="90" height="12" fill="#b08a5c" stroke="#7d5f3c" stroke-width="2" transform="rotate(-20 1440 700)"/></g>`);
    out.push(`<g class="boat" style="--bx:1480px;--by:520px"><path d="M-26 0 h52 l-10 12 h-32z" fill="#fff" stroke="#3b4a5a" stroke-width="2.5"/><path d="M0 -2 V-46 L26 -6Z" fill="#ff7a59" stroke="#3b4a5a" stroke-width="2"/><path d="M-2 -40 L-22 -6 H-2Z" fill="#fff" stroke="#3b4a5a" stroke-width="2"/></g>`);
    out.push(`<g class="boat" style="--bx:130px;--by:960px;animation-delay:-2s"><path d="M-20 0 h40 l-8 10 h-24z" fill="#ffd34d" stroke="#3b4a5a" stroke-width="2.5"/><path d="M0 -2 V-34 L20 -4Z" fill="#fff" stroke="#3b4a5a" stroke-width="2"/></g>`);

    // compass rose
    out.push(`<g transform="translate(1515 470)" opacity=".9"><circle r="42" fill="rgba(255,255,255,.18)" stroke="rgba(255,255,255,.7)" stroke-width="2"/><path d="M0 -36 L8 0 L0 36 L-8 0Z" fill="#fff"/><path d="M0 -36 L8 0 L-8 0Z" fill="#e2434b"/><path d="M-36 0 L0 -6 L36 0 L0 6Z" fill="rgba(255,255,255,.8)"/><text y="-48" text-anchor="middle" font-size="16" font-weight="800" fill="#fff">N</text></g>`);

    // landmarks
    const envs = FP.environments;
    envs.forEach((env, i) => {
      const pl = PLACES[env.id];
      if (!pl) return;
      const label = `${env.emoji} ${env.name}`;
      const lw = Math.round(env.name.length * 10.8 + 58);
      out.push(`<g class="loc" data-env="${env.id}" transform="translate(${pl.x} ${pl.y})" tabindex="0" role="button" aria-label="Travel to ${env.name}: ${env.tagline}" style="--loc:${env.accent}">
        <ellipse class="loc-hit" cx="0" cy="${-pl.h / 2 + 10}" rx="${Math.max(80, lw / 2 + 10)}" ry="${pl.h / 2 + 30}" fill="transparent"/>
        <ellipse class="loc-ring" cx="0" cy="2" rx="${Math.max(70, lw / 2)}" ry="22"/>
        <g class="landmark" filter="url(#lift)">${LANDMARKS[env.id]()}</g>
        <g class="loc-label" transform="translate(0 38)"><rect x="${-lw / 2}" y="-18" width="${lw}" height="36" rx="18"/><text y="6.5" text-anchor="middle">${label}</text>${i < 10 ? `<circle class="loc-key-bg" cx="${lw / 2 - 4}" cy="-16" r="10"/><text class="loc-key" x="${lw / 2 - 4}" y="-11.5" text-anchor="middle">${(i + 1) % 10}</text>` : ''}</g>
        <g class="loc-lock">
          <g class="loc-lock-badge" transform="translate(0 ${-pl.h + 4})"><circle r="18"/><path d="M-6 -2 v-5 a6 6 0 0 1 12 0 v5"/><rect x="-8.5" y="-3" width="17" height="12" rx="2.5"/></g>
          <g class="loc-lock-pill" transform="translate(0 76)"><rect x="-60" y="-14" width="120" height="28" rx="14"/><text y="5" text-anchor="middle"></text></g>
        </g>
      </g>`);
    });


    // clouds drifting over everything
    const clouds = [[140, 90, 1.1], [420, 70, 0.8], [760, 120, 1.3], [300, 40, 0.9], [560, 150, 1]];
    clouds.forEach(([y, dur, s], i) => {
      const c = `<ellipse cx="0" cy="0" rx="${60 * s}" ry="${24 * s}"/><ellipse cx="${-40 * s}" cy="${8 * s}" rx="${40 * s}" ry="${18 * s}"/><ellipse cx="${44 * s}" cy="${6 * s}" rx="${42 * s}" ry="${18 * s}"/><ellipse cx="${10 * s}" cy="${-16 * s}" rx="${36 * s}" ry="${22 * s}"/>`;
      const style = `animation-duration:${dur * 1.6}s;animation-delay:${-(i * 37) % (dur * 1.6)}s`;
      out.push(`<g class="cloud-shadow" style="${style}"><g transform="translate(0 ${y + 120})" fill="rgba(20,50,70,.12)">${c}</g></g>`);
      out.push(`<g class="cloud" style="${style}"><g transform="translate(0 ${y})" fill="rgba(255,255,255,.85)">${c}</g></g>`);
    });

    out.push(`<path id="travelPath" class="travel-path" d="M0 0"/>
      <g id="mapPlayer" class="player" transform="translate(-100 -100)"><g class="player-bob"><path d="M0 0 C-7 -11 -22 -22 -22 -40 A22 22 0 1 1 22 -40 C22 -22 7 -11 0 0Z" fill="var(--accent)" stroke="#fff" stroke-width="3"/><g id="playerFace">${DEFAULT_FACE}</g></g></g>
    </svg>`);
    return out.join('\n');
  }

  const DEFAULT_FACE = '<circle cy="-40" r="15" fill="#fff"/><circle cy="-45" r="5.5" fill="#2b2b2b"/><path d="M-8 -30 a8 8 0 0 1 16 0" fill="#2b2b2b"/>';

  // ---------- controller ----------
  const el = {};
  let opts = {};
  let isOpen = false;
  let traveling = false;
  let previewId = null;
  let pinAt = null;
  let lastPointer = 'mouse';
  let scale = 1;

  // Lay the island out below the header so the header never covers it.
  function layout() {
    const top = Math.ceil(el.head.getBoundingClientRect().bottom) + 8;
    el.viewport.style.paddingTop = `${top}px`;
    const vw = el.viewport.clientWidth;
    const vh = el.viewport.clientHeight - top;
    let s = Math.min(vw / VW, vh / VH);
    if (vw < 900) s = Math.max(s, (vh / VH) * 0.92);
    scale = s;
    el.stage.style.width = `${VW * s}px`;
    el.stage.style.height = `${VH * s}px`;
  }

  function centerOn(id) {
    const pl = PLACES[id];
    if (!pl) return;
    el.viewport.scrollLeft = pl.x * scale - el.viewport.clientWidth / 2;
    el.viewport.scrollTop = (pl.y - 60) * scale - el.viewport.clientHeight / 2;
  }

  const pinPoint = (id) => ({ x: PLACES[id].x, y: PLACES[id].y - PLACES[id].h - 6 });

  function placePin(id) {
    pinAt = id;
    const p = pinPoint(id);
    el.player.setAttribute('transform', `translate(${p.x} ${p.y})`);
    el.player.classList.add('show');
    el.svg.querySelectorAll('.loc').forEach((g) => g.classList.toggle('current', g.dataset.env === id));
  }

  // Grey out locked places, label how many sessions each needs, and update the header bar.
  function refresh() {
    if (!el.svg) return;
    el.svg.querySelectorAll('.loc').forEach((g) => {
      const id = g.dataset.env;
      const env = FP.envById(id);
      const info = opts.lockInfo(id);
      g.classList.toggle('locked', info.locked);
      g.querySelector('.landmark').setAttribute('filter', info.locked ? 'url(#liftLocked)' : 'url(#lift)');
      g.setAttribute('aria-label', info.locked
        ? FP.t('{name}, locked: {r} more focus sessions to unlock', { name: env.name, r: info.remaining },
          `${env.name}, locked: ${info.remaining} more focus session${info.remaining === 1 ? '' : 's'} to unlock`)
        : FP.t('Travel to {name}: {tagline}', { name: env.name, tagline: env.tagline }));
      if (info.locked) {
        const text = g.querySelector('.loc-lock-pill text');
        text.textContent = FP.t('🔒 {r} more sessions', { r: info.remaining }, `🔒 ${info.remaining} more session${info.remaining === 1 ? '' : 's'}`);
        const w = (text.getComputedTextLength ? text.getComputedTextLength() : 110) + 30;
        const rect = g.querySelector('.loc-lock-pill rect');
        rect.setAttribute('x', -w / 2);
        rect.setAttribute('width', w);
      }
    });
    const p = opts.progress();
    const bar = document.getElementById('mapProgressBar');
    const txt = document.getElementById('mapProgressText');
    document.getElementById('mapPremiumBtn').hidden = p.premium || !p.next;
    bar.parentElement.hidden = p.allOpen;
    if (p.allOpen) {
      txt.textContent = FP.t('🏝️ {n} places to explore', { n: p.total });
    } else if (p.premium) {
      txt.textContent = FP.t('✨ Premium · all {n} places open', { n: p.total });
      bar.style.width = '100%';
    } else if (!p.next) {
      txt.textContent = FP.t('🏆 All {n} places unlocked!', { n: p.total });
      bar.style.width = '100%';
    } else {
      const n = p.next;
      txt.textContent = FP.t('🏝️ {u}/{n} places · next: {next} in {r} sessions', { u: p.unlocked, n: p.total, next: `${n.env.emoji} ${n.env.name}`, r: n.remaining },
        `🏝️ ${p.unlocked}/${p.total} places · next: ${n.env.emoji} ${n.env.name} in ${n.remaining} session${n.remaining === 1 ? '' : 's'}`);
      bar.style.width = `${Math.round(Math.min(1, p.done / n.env.unlock) * 100)}%`;
    }
    if (previewId) showCard(previewId);
  }

  function showCard(id) {
    const env = FP.envById(id);
    const info = opts.lockInfo(id);
    const here = id === pinAt && opts.hasEntered();
    el.cardLock.hidden = !info.locked;
    el.cardGo.classList.toggle('premium', info.locked);
    if (info.locked) {
      el.cardLockText.innerHTML = FP.t('🔒 Unlocks after <b>{n} focus sessions</b>. You’ve done {d}, so {r} to go.', { n: env.unlock, d: info.done, r: info.remaining });
      el.cardLockBar.style.width = `${Math.round(Math.min(1, info.done / env.unlock) * 100)}%`;
    }
    el.card.style.setProperty('--loc', env.accent);
    el.cardEmoji.textContent = env.emoji;
    el.cardName.textContent = env.name;
    el.cardTag.textContent = env.tagline;
    el.cardSounds.innerHTML = env.layers.map((l) => `<span>${l.name}</span>`).join('');
    // A place can carry a dedication (English and Arabic on separate lines).
    el.cardDedication.hidden = !env.dedication;
    if (env.dedication) {
      el.cardDedication.innerHTML = '';
      const en = document.createElement('span');
      en.textContent = env.dedication;
      el.cardDedication.appendChild(en);
      if (env.dedicationAr) {
        const ar = document.createElement('span');
        ar.className = 'ar';
        ar.lang = 'ar';
        ar.dir = 'rtl';
        ar.textContent = env.dedicationAr;
        el.cardDedication.appendChild(ar);
      }
    }
    el.cardGo.textContent = info.locked ? FP.t('✨ Unlock every place with Premium') : here ? FP.t('Back to {name} →', { name: env.name }) : FP.t('Focus here →');
    el.cardGo.dataset.env = id;
    placeCard(id);
    el.card.classList.add('show');
  }

  const markSelected = (id) => el.svg.querySelectorAll('.loc').forEach((g) => g.classList.toggle('selected', g.dataset.env === id));

  function preview(id) {
    cancelHide();
    previewId = id;
    markSelected(id);
    showCard(id);
  }

  // Desktop: float the card next to the landmark. Phones: it is a bottom sheet (CSS).
  function placeCard(id) {
    if (window.innerWidth < 700) {
      el.card.style.left = '';
      el.card.style.top = '';
      return;
    }
    const g = el.svg.querySelector(`.loc[data-env="${id}"] .landmark`);
    if (!g) return;
    const r = g.getBoundingClientRect();
    const cw = el.card.offsetWidth;
    const ch = el.card.offsetHeight;
    const minTop = el.head.getBoundingClientRect().bottom + 8;
    let left = r.right + 18;
    if (left + cw > window.innerWidth - 16) left = r.left - 18 - cw;
    left = Math.max(16, Math.min(left, window.innerWidth - cw - 16));
    const top = Math.max(minTop, Math.min(r.top + r.height / 2 - ch / 2, window.innerHeight - ch - 16));
    el.card.style.left = `${left}px`;
    el.card.style.top = `${top}px`;
  }

  let hideTimer;
  function hideCard() {
    clearTimeout(hideTimer);
    el.card.classList.remove('show');
    previewId = null;
    markSelected(null);
  }
  const scheduleHide = (ms = 350) => {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(hideCard, ms);
  };
  const cancelHide = () => clearTimeout(hideTimer);

  function travel(id) {
    if (traveling || !PLACES[id]) return;
    if (opts.lockInfo(id).locked) {
      preview(id);
      return;
    }
    traveling = true;
    opts.onGesture();
    hideCard();
    markSelected(id);
    const to = pinPoint(id);
    const finish = () => zoomInto(id);
    if (pinAt && pinAt !== id) {
      const from = pinPoint(pinAt);
      const dist = Math.hypot(to.x - from.x, to.y - from.y);
      const cx = (from.x + to.x) / 2;
      const cy = Math.min(from.y, to.y) - dist * 0.3;
      el.path.setAttribute('d', `M${from.x} ${from.y + 4} Q${cx} ${cy} ${to.x} ${to.y + 4}`);
      const len = el.path.getTotalLength();
      el.path.style.strokeDasharray = `10 12`;
      el.path.classList.add('show');
      const dur = Math.min(1500, 600 + dist * 0.9);
      FP.audio.travel(dur / 1000 + 0.3);
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / dur);
        const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        const pt = el.path.getPointAtLength(e * len);
        el.player.setAttribute('transform', `translate(${pt.x} ${pt.y - 4})`);
        el.path.style.clipPath = '';
        el.path.style.strokeDashoffset = 0;
        if (k < 1) requestAnimationFrame(step);
        else {
          placePin(id);
          setTimeout(() => { el.path.classList.remove('show'); finish(); }, 200);
        }
      };
      requestAnimationFrame(step);
    } else {
      FP.audio.travel(0.8);
      placePin(id);
      el.player.classList.remove('drop');
      void el.player.getBBox();
      el.player.classList.add('drop');
      setTimeout(finish, 450);
    }
  }

  function zoomInto(id) {
    const pl = PLACES[id];
    el.stage.style.transformOrigin = `${pl.x * scale}px ${(pl.y - pl.h / 2) * scale}px`;
    el.stage.classList.add('zooming');
    el.screen.classList.add('leaving');
    opts.onEnter(id);
    setTimeout(() => {
      el.screen.hidden = true;
      el.screen.classList.remove('leaving', 'shown');
      el.stage.classList.remove('zooming');
      isOpen = false;
      traveling = false;
      opts.onClose();
    }, 1000);
  }

  function open(currentId, { instant = false } = {}) {
    if (isOpen) return;
    isOpen = true;
    el.screen.hidden = false;
    if (instant) el.screen.classList.add('shown');
    else el.screen.classList.remove('shown');
    layout();
    if (opts.hasEntered()) placePin(currentId);
    else {
      el.player.classList.remove('show');
      el.svg.querySelectorAll('.loc').forEach((g) => g.classList.remove('current'));
    }
    el.resume.hidden = !opts.hasEntered();
    if (opts.hasEntered()) el.resume.textContent = FP.t('← Back to {place}', { place: `${FP.envById(currentId).emoji} ${FP.envById(currentId).name}` });
    hideCard();
    refresh();
    requestAnimationFrame(() => {
      centerOn(currentId);
      el.screen.classList.add('shown');
    });
    opts.onOpen();
    celebrate(opts.takeNewPlaces());
  }

  // Pop newly unlocked landmarks the first time the map is opened after unlocking them.
  function celebrate(ids) {
    if (!ids.length) return;
    setTimeout(() => {
      ids.forEach((id) => {
        const g = el.svg.querySelector(`.loc[data-env="${id}"]`);
        if (!g) return;
        g.classList.add('just-unlocked');
        setTimeout(() => g.classList.remove('just-unlocked'), 3000);
      });
      FP.audio.chime('unlock');
      preview(ids[ids.length - 1]);
      scheduleHide(6000);
    }, 700);
  }

  function close() {
    if (!isOpen || traveling || !opts.hasEntered()) return;
    travel(pinAt);
  }

  function init(options) {
    opts = options;
    el.screen = document.getElementById('mapScreen');
    el.viewport = document.getElementById('mapViewport');
    el.stage = document.getElementById('mapStage');
    el.card = document.getElementById('mapCard');
    el.cardEmoji = document.getElementById('mapCardEmoji');
    el.cardName = document.getElementById('mapCardName');
    el.cardTag = document.getElementById('mapCardTag');
    el.cardSounds = document.getElementById('mapCardSounds');
    el.cardDedication = document.getElementById('mapCardDedication');
    el.cardGo = document.getElementById('mapCardGo');
    el.cardLock = document.getElementById('mapCardLock');
    el.cardLockText = document.getElementById('mapCardLockText');
    el.cardLockBar = document.getElementById('mapCardLockBar');
    el.resume = document.getElementById('mapResume');
    el.timer = document.getElementById('mapTimer');
    el.stage.innerHTML = buildSVG();
    el.svg = el.stage.querySelector('svg');
    el.player = document.getElementById('mapPlayer');
    el.path = document.getElementById('travelPath');

    el.svg.querySelectorAll('.loc').forEach((g) => {
      const id = g.dataset.env;
      g.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse' && !traveling) preview(id); });
      g.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') scheduleHide(); });
      g.addEventListener('blur', () => scheduleHide(200));
      g.addEventListener('pointerdown', (e) => { lastPointer = e.pointerType; });
      g.addEventListener('focus', () => { if (!traveling) preview(id); });
      g.addEventListener('click', () => {
        if (lastPointer !== 'mouse' && previewId !== id) preview(id);
        else travel(id);
      });
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); travel(id); }
      });
    });
    el.cardGo.addEventListener('click', () => {
      const id = el.cardGo.dataset.env;
      if (opts.lockInfo(id).locked) opts.onLocked(id);
      else travel(id);
    });
    document.getElementById('mapPremiumBtn').addEventListener('click', () => opts.onLocked(null));
    el.resume.addEventListener('click', close);
    el.head = document.getElementById('mapHead');
    el.card.addEventListener('pointerenter', cancelHide);
    el.card.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') scheduleHide(); });
    el.card.addEventListener('focusin', cancelHide);
    document.getElementById('mapCardClose').addEventListener('click', hideCard);
    // Tapping open water or grass closes the card.
    el.svg.addEventListener('click', (e) => { if (!e.target.closest('.loc')) hideCard(); });
    el.viewport.addEventListener('scroll', () => { if (previewId) placeCard(previewId); }, { passive: true });
    window.addEventListener('resize', () => {
      if (!isOpen) return;
      layout();
      if (previewId) placeCard(previewId);
    });
  }

  FP.map = {
    init,
    open,
    close,
    travel,
    refresh,
    get isOpen() { return isOpen; },
    get traveling() { return traveling; },
    // Put the user's avatar (an <svg> string) on the pin, or the default face when null.
    setAvatar(markup) {
      const face = document.getElementById('playerFace');
      if (!face) return;
      face.innerHTML = markup
        ? `<circle cy="-40" r="17" fill="#fff"/><g transform="translate(-16 -56)">${markup}</g>`
        : DEFAULT_FACE;
    },
    setTimer(text) {
      if (!el.timer) return;
      el.timer.hidden = !text;
      if (text) el.timer.textContent = text;
    },
  };
})();
