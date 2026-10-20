/*
 * Animated canvas scenes. Each scene is a factory `(w, h, dpr) => instance`
 * where the instance has `draw(ctx, t, dt)` and optionally `destroy()`.
 * Static parts are pre-rendered to off-screen layers once per resize.
 */
(function () {
  'use strict';
  const FP = window.FP;
  const { rand, pick } = FP;
  const TAU = Math.PI * 2;
  const scenes = (FP.scenes = {});

  // ---------- helpers ----------

  function layer(w, h, dpr, paint) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(h * dpr));
    const x = c.getContext('2d');
    x.scale(dpr, dpr);
    paint(x, w, h);
    return c;
  }

  function glow(c, x, y, r, color, alpha = 1) {
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color.replace('A', alpha));
    g.addColorStop(1, color.replace('A', 0));
    c.fillStyle = g;
    c.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function sprite(r, stops) {
    const c = document.createElement('canvas');
    c.width = c.height = r * 2;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(r, r, 0, r, r, r);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    x.fillStyle = g;
    x.fillRect(0, 0, r * 2, r * 2);
    return c;
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function vGrad(c, y0, y1, stops) {
    const g = c.createLinearGradient(0, y0, 0, y1);
    stops.forEach(([o, col]) => g.addColorStop(o, col));
    return g;
  }

  function motes(n, region) {
    return Array.from({ length: n }, () => ({
      x: rand(region.x, region.x + region.w), y: rand(region.y, region.y + region.h),
      vx: rand(-4, 4), vy: rand(-3, 3), r: rand(0.6, 1.8), ph: rand(0, TAU),
    }));
  }

  function drawMotes(c, list, region, t, dt, color, alpha) {
    c.fillStyle = color;
    for (const m of list) {
      m.x += (m.vx + Math.sin(t * 0.3 + m.ph) * 3) * dt;
      m.y += (m.vy + Math.cos(t * 0.25 + m.ph) * 2) * dt;
      if (m.x < region.x) m.x += region.w;
      if (m.x > region.x + region.w) m.x -= region.w;
      if (m.y < region.y) m.y += region.h;
      if (m.y > region.y + region.h) m.y -= region.h;
      c.globalAlpha = alpha * (0.4 + 0.6 * Math.abs(Math.sin(t * 0.6 + m.ph)));
      c.beginPath();
      c.arc(m.x, m.y, m.r, 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
  }

  // Low-resolution render scaled up = cheap, cross-browser blur.
  function blurred(w, h, dpr, factor, paint) {
    const sw = Math.max(1, Math.round(w / factor));
    const sh = Math.max(1, Math.round(h / factor));
    const small = document.createElement('canvas');
    small.width = sw;
    small.height = sh;
    const sx = small.getContext('2d');
    sx.scale(1 / factor, 1 / factor);
    paint(sx, w, h);
    return layer(w, h, dpr, (c) => {
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = 'high';
      c.drawImage(small, 0, 0, w, h);
    });
  }


  // Checkerboard floor in one-point perspective, filling from floorY to the bottom.
  function checkerFloor(c, w, h, floorY, light, dark, d = 0.16) {
    c.save();
    c.beginPath();
    c.rect(0, floorY, w, h - floorY);
    c.clip();
    c.fillStyle = light;
    c.fillRect(0, floorY, w, h - floorY);
    const vpX = w / 2;
    const vpY = h * 0.3;
    const K = h - vpY;
    const Sx = K * 1.28;
    const zFar = K / (floorY - vpY);
    const cols = Math.ceil(((w / 2) * zFar) / Sx / d) + 2;
    c.fillStyle = dark;
    for (let zi = 0; ; zi++) {
      const z0 = 0.8 + zi * d;
      if (z0 > zFar + d) break;
      const z1 = z0 + d;
      const y0 = vpY + K / z0;
      const y1 = vpY + K / z1;
      for (let xi = -cols; xi < cols; xi++) {
        if ((xi + zi) % 2 === 0) continue;
        const X0 = xi * d;
        const X1 = X0 + d;
        c.beginPath();
        c.moveTo(vpX + (X0 * Sx) / z0, y0);
        c.lineTo(vpX + (X1 * Sx) / z0, y0);
        c.lineTo(vpX + (X1 * Sx) / z1, y1);
        c.lineTo(vpX + (X0 * Sx) / z1, y1);
        c.closePath();
        c.fill();
      }
    }
    c.restore();
  }

  // ======================================================================
  // SPACE
  // ======================================================================
  scenes.space = (w, h, dpr) => {
    const bg = layer(w, h, dpr, (c) => {
      c.fillStyle = vGrad(c, 0, h, [[0, '#03040b'], [1, '#0a0f2a']]);
      c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'lighter';
      const tints = ['rgba(120,60,200,A)', 'rgba(40,110,210,A)', 'rgba(200,60,150,A)', 'rgba(50,190,180,A)'];
      const alphas = [0.22, 0.18, 0.11, 0.07];
      for (let i = 0; i < 10; i++) {
        glow(c, rand(0, w), rand(0, h * 0.85), rand(150, Math.max(w, h) * 0.45), tints[i % 4], alphas[i % 4]);
      }
      for (let i = 0; i < (w * h) / 700; i++) {
        c.fillStyle = `rgba(255,255,255,${rand(0.04, 0.3)})`;
        c.fillRect(rand(0, w), rand(0, h), 1, 1);
      }
      c.globalCompositeOperation = 'source-over';
    });

    const pr = Math.min(w, h) * 0.17;
    const px = w * 0.86;
    const py = h * 0.8;
    const planet = layer(w, h, dpr, (c) => {
      glow(c, px, py, pr * 1.6, 'rgba(140,110,255,A)', 0.25);
      c.save();
      c.translate(px, py);
      c.rotate(-0.35);
      c.strokeStyle = 'rgba(200,180,255,0.22)';
      c.lineWidth = pr * 0.08;
      c.beginPath();
      c.ellipse(0, 0, pr * 1.9, pr * 0.42, 0, Math.PI, TAU);
      c.stroke();
      c.restore();
      const g = c.createRadialGradient(px - pr * 0.4, py - pr * 0.45, pr * 0.1, px, py, pr);
      g.addColorStop(0, '#d2b6ff');
      g.addColorStop(0.45, '#6b4fc4');
      g.addColorStop(1, '#100a28');
      c.fillStyle = g;
      c.beginPath();
      c.arc(px, py, pr, 0, TAU);
      c.fill();
      c.save();
      c.beginPath();
      c.arc(px, py, pr, 0, TAU);
      c.clip();
      for (let i = 0; i < 8; i++) {
        c.fillStyle = i % 2 ? 'rgba(255,255,255,0.08)' : 'rgba(30,15,70,0.18)';
        c.fillRect(px - pr, py - pr + i * pr * 0.27 + rand(-4, 4), pr * 2, pr * rand(0.05, 0.13));
      }
      c.restore();
      c.save();
      c.translate(px, py);
      c.rotate(-0.35);
      c.strokeStyle = 'rgba(225,205,255,0.45)';
      c.lineWidth = pr * 0.08;
      c.beginPath();
      c.ellipse(0, 0, pr * 1.9, pr * 0.42, 0, 0, Math.PI);
      c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.2)';
      c.lineWidth = pr * 0.025;
      c.beginPath();
      c.ellipse(0, 0, pr * 2.06, pr * 0.47, 0, 0, Math.PI);
      c.stroke();
      c.restore();
      // small moon
      const mx = w * 0.12, my = h * 0.2, mr = Math.min(w, h) * 0.035;
      const mg = c.createRadialGradient(mx - mr * 0.4, my - mr * 0.4, 1, mx, my, mr);
      mg.addColorStop(0, '#e9e4f5');
      mg.addColorStop(1, '#3b3552');
      c.fillStyle = mg;
      c.beginPath();
      c.arc(mx, my, mr, 0, TAU);
      c.fill();
    });

    const stars = Array.from({ length: Math.round((w * h) / 4500) }, () => ({
      x: rand(0, w), y: rand(0, h), z: rand(0.15, 1), tw: rand(0, TAU), s: rand(0.6, 1.7),
      hue: pick(['#ffffff', '#ffffff', '#cfe0ff', '#ffe6cf']),
    }));
    let meteor = null;
    let nextMeteor = rand(3, 8);

    return {
      draw(c, t, dt) {
        c.drawImage(bg, 0, 0, w, h);
        for (const s of stars) {
          s.x -= dt * 5 * s.z;
          if (s.x < -2) s.x += w + 4;
          const a = 0.5 + 0.5 * Math.sin(t * (0.8 + s.z) + s.tw);
          c.globalAlpha = 0.25 + 0.75 * a * s.z;
          c.fillStyle = s.hue;
          const r = s.s * s.z;
          if (r < 0.9) c.fillRect(s.x, s.y, 1.2, 1.2);
          else {
            c.beginPath();
            c.arc(s.x, s.y, r, 0, TAU);
            c.fill();
          }
        }
        c.globalAlpha = 1;
        c.drawImage(planet, 0, 0, w, h);

        nextMeteor -= dt;
        if (nextMeteor <= 0) {
          meteor = { x: rand(w * 0.3, w * 1.1), y: rand(-20, h * 0.35), vx: -rand(500, 800), vy: rand(150, 300), life: 1 };
          nextMeteor = rand(7, 16);
        }
        if (meteor) {
          meteor.x += meteor.vx * dt;
          meteor.y += meteor.vy * dt;
          meteor.life -= dt * 1.1;
          const tail = 0.22;
          const g = c.createLinearGradient(meteor.x, meteor.y, meteor.x - meteor.vx * tail, meteor.y - meteor.vy * tail);
          g.addColorStop(0, `rgba(255,255,255,${Math.max(0, meteor.life)})`);
          g.addColorStop(1, 'rgba(255,255,255,0)');
          c.strokeStyle = g;
          c.lineWidth = 1.6;
          c.beginPath();
          c.moveTo(meteor.x, meteor.y);
          c.lineTo(meteor.x - meteor.vx * tail, meteor.y - meteor.vy * tail);
          c.stroke();
          if (meteor.life <= 0) meteor = null;
        }
      },
    };
  };

  // ======================================================================
  // COFFEE SHOP
  // ======================================================================
  scenes.coffee = (w, h, dpr) => {
    const tableY = h * 0.8;
    const mx = Math.max(70, w * 0.13);
    const mugW = 62;
    const mugH = 66;
    const mugBase = tableY + 22;

    const bg = layer(w, h, dpr, (c) => {
      c.fillStyle = vGrad(c, 0, h, [[0, '#1a0f0a'], [0.6, '#3a2315'], [1, '#1a0e08']]);
      c.fillRect(0, 0, w, h);
      for (let y = 0, row = 0; y < tableY; y += 26, row++) {
        for (let x = (row % 2) * -32; x < w; x += 64) {
          c.fillStyle = `rgba(${rand(110, 160) | 0},${rand(55, 80) | 0},${rand(35, 50) | 0},${rand(0.05, 0.12)})`;
          roundRect(c, x + 2, y + 2, 60, 22, 3);
          c.fill();
        }
      }
      // Chalkboard menu
      const bx = w * 0.05, by = h * 0.13, bw = Math.max(150, w * 0.17), bh = h * 0.27;
      c.fillStyle = '#4a2d18';
      roundRect(c, bx - 8, by - 8, bw + 16, bh + 16, 6);
      c.fill();
      c.fillStyle = '#1b201d';
      c.fillRect(bx, by, bw, bh);
      c.strokeStyle = 'rgba(255,255,255,0.28)';
      c.lineCap = 'round';
      for (let ly = by + 22; ly < by + bh - 12; ly += 18) {
        let lx = bx + 14;
        const end = bx + bw * rand(0.55, 0.85);
        c.lineWidth = ly === by + 22 ? 3 : 1.6;
        while (lx < end) {
          const seg = rand(6, 22);
          c.beginPath();
          c.moveTo(lx, ly + rand(-0.6, 0.6));
          c.lineTo(Math.min(end, lx + seg), ly + rand(-0.6, 0.6));
          c.stroke();
          lx += seg + rand(4, 7);
        }
        c.beginPath();
        c.moveTo(bx + bw - 34, ly);
        c.lineTo(bx + bw - 14, ly);
        c.stroke();
      }
      // Shelf with jars, top right
      const sx = w * 0.74, sy = h * 0.3, sw = w * 0.22;
      for (let x = sx; x < sx + sw - 20; x += rand(26, 40)) {
        const jh = rand(26, 46);
        c.fillStyle = `rgba(${rand(90, 140) | 0},${rand(60, 90) | 0},${rand(40, 60) | 0},0.85)`;
        roundRect(c, x, sy - jh, 20, jh, 4);
        c.fill();
        c.fillStyle = 'rgba(255,230,190,0.12)';
        c.fillRect(x + 3, sy - jh + 4, 3, jh - 8);
      }
      c.fillStyle = '#4a2b17';
      c.fillRect(sx - 10, sy, sw + 20, 7);
      // Table
      c.fillStyle = vGrad(c, tableY, h, [[0, '#4d2c18'], [1, '#1a0d06']]);
      c.fillRect(0, tableY, w, h - tableY);
      c.strokeStyle = 'rgba(0,0,0,0.18)';
      c.lineWidth = 1;
      for (let i = 0; i < 12; i++) {
        const y = tableY + 8 + i * ((h - tableY) / 12);
        c.beginPath();
        c.moveTo(0, y);
        for (let x = 0; x <= w; x += 40) c.lineTo(x, y + Math.sin(x * 0.01 + i) * 2);
        c.stroke();
      }
      c.fillStyle = 'rgba(255,210,160,0.2)';
      c.fillRect(0, tableY, w, 2);
      // Mug and saucer
      c.fillStyle = 'rgba(0,0,0,0.35)';
      c.beginPath();
      c.ellipse(mx + 8, mugBase + 8, mugW * 1.0, 13, 0, 0, TAU);
      c.fill();
      c.fillStyle = '#d6c9b8';
      c.beginPath();
      c.ellipse(mx, mugBase + 3, mugW * 0.95, 12, 0, 0, TAU);
      c.fill();
      c.strokeStyle = '#d9cfc2';
      c.lineWidth = 8;
      c.beginPath();
      c.arc(mx + mugW / 2 + 2, mugBase - mugH * 0.55, 14, -Math.PI / 2.3, Math.PI / 2.3);
      c.stroke();
      const mg = c.createLinearGradient(mx - mugW / 2, 0, mx + mugW / 2, 0);
      mg.addColorStop(0, '#a99a88');
      mg.addColorStop(0.45, '#f4ede3');
      mg.addColorStop(1, '#8f806e');
      c.fillStyle = mg;
      c.beginPath();
      c.moveTo(mx - mugW / 2, mugBase - mugH);
      c.lineTo(mx + mugW / 2, mugBase - mugH);
      c.quadraticCurveTo(mx + mugW / 2, mugBase, mx + mugW * 0.3, mugBase);
      c.lineTo(mx - mugW * 0.3, mugBase);
      c.quadraticCurveTo(mx - mugW / 2, mugBase, mx - mugW / 2, mugBase - mugH);
      c.fill();
      c.fillStyle = '#efe6da';
      c.beginPath();
      c.ellipse(mx, mugBase - mugH, mugW / 2, 8, 0, 0, TAU);
      c.fill();
      c.fillStyle = '#3a1f10';
      c.beginPath();
      c.ellipse(mx, mugBase - mugH + 1, mugW / 2 - 4, 6, 0, 0, TAU);
      c.fill();
      c.fillStyle = 'rgba(200,150,100,0.7)';
      c.beginPath();
      c.ellipse(mx + 2, mugBase - mugH + 1, 9, 3, 0, 0, TAU);
      c.fill();
    });

    const lamps = [0.3, 0.7, 0.92].map((f) => ({ x: w * f, y: h * rand(0.13, 0.19), ph: rand(0, TAU) }));
    const bokeh = Array.from({ length: 26 }, () => ({
      x: rand(0, w), y: rand(0, h * 0.72), r: rand(18, 70), hue: rand(22, 45), a: rand(0.04, 0.14), ph: rand(0, TAU), vx: rand(-3, 3),
    }));

    return {
      draw(c, t, dt) {
        c.drawImage(bg, 0, 0, w, h);
        c.globalCompositeOperation = 'lighter';
        for (const b of bokeh) {
          b.x += b.vx * dt;
          if (b.x < -b.r) b.x = w + b.r;
          if (b.x > w + b.r) b.x = -b.r;
          const a = b.a * (0.7 + 0.3 * Math.sin(t * 0.5 + b.ph));
          glow(c, b.x, b.y, b.r, `hsla(${b.hue},90%,65%,A)`, a);
        }
        for (const l of lamps) {
          const flick = 0.95 + 0.05 * Math.sin(t * 7 + l.ph) * Math.sin(t * 3.1 + l.ph);
          glow(c, l.x, l.y + 10, h * 0.42, 'rgba(255,180,100,A)', 0.2 * flick);
          glow(c, l.x, l.y + 6, 26, 'rgba(255,235,190,A)', 0.9);
        }
        c.globalCompositeOperation = 'source-over';
        for (const l of lamps) {
          c.strokeStyle = 'rgba(0,0,0,0.7)';
          c.lineWidth = 1.5;
          c.beginPath();
          c.moveTo(l.x, 0);
          c.lineTo(l.x, l.y - 18);
          c.stroke();
          c.fillStyle = '#16100c';
          c.beginPath();
          c.moveTo(l.x - 6, l.y - 20);
          c.lineTo(l.x + 6, l.y - 20);
          c.lineTo(l.x + 30, l.y + 4);
          c.lineTo(l.x - 30, l.y + 4);
          c.closePath();
          c.fill();
          c.fillStyle = 'rgba(255,220,170,0.25)';
          c.fillRect(l.x - 30, l.y + 3, 60, 2);
        }
        // Steam rising from the mug
        const top = mugBase - mugH - 6;
        c.lineCap = 'round';
        for (let i = 0; i < 3; i++) {
          const ox = mx + (i - 1) * 12;
          for (const [lw, a] of [[12, 0.035], [4, 0.07]]) {
            c.strokeStyle = `rgba(255,245,235,${a})`;
            c.lineWidth = lw;
            c.beginPath();
            for (let s = 0; s <= 24; s++) {
              const p = s / 24;
              const y = top - p * 110;
              const x = ox + Math.sin(p * 5 + t * 1.4 + i * 2.1) * 10 * p + Math.sin(t * 0.7 + i) * 4 * p;
              if (s === 0) c.moveTo(x, y);
              else c.lineTo(x, y);
            }
            c.stroke();
          }
        }
      },
    };
  };

  // ======================================================================
  // LIBRARY
  // ======================================================================
  scenes.library = (w, h, dpr) => {
    const deskY = h * 0.84;
    const lx = Math.max(90, w * 0.13);
    const bg = layer(w, h, dpr, (c) => {
      c.fillStyle = '#120b07';
      c.fillRect(0, 0, w, h);
      const rowH = Math.max(90, Math.min(140, h / 6));
      const palette = ['#5b1f1f', '#2f4a33', '#1f2d4a', '#7a5a2a', '#4a2f1f', '#6b3a2e', '#38423a', '#8a7350', '#2b2b3a', '#5a4630', '#3d1c2c'];
      for (let y = 6; y < deskY; y += rowH) {
        c.fillStyle = '#1a0f09';
        c.fillRect(0, y, w, rowH);
        let x = rand(-10, 0);
        while (x < w) {
          if (Math.random() < 0.035) { x += rand(20, 50); continue; }
          const bw = rand(9, 22);
          const bh = (rowH - 18) * rand(0.7, 0.97);
          const by = y + rowH - 12 - bh;
          c.fillStyle = pick(palette);
          c.fillRect(x, by, bw - 1, bh);
          if (Math.random() < 0.6) {
            c.fillStyle = 'rgba(255,215,140,0.28)';
            c.fillRect(x + 1, by + bh * 0.12, bw - 3, 2);
            c.fillRect(x + 1, by + bh * 0.78, bw - 3, 2);
          }
          const sg = c.createLinearGradient(x, 0, x + bw, 0);
          sg.addColorStop(0, 'rgba(0,0,0,0.35)');
          sg.addColorStop(0.3, 'rgba(255,255,255,0.06)');
          sg.addColorStop(1, 'rgba(0,0,0,0.4)');
          c.fillStyle = sg;
          c.fillRect(x, by, bw - 1, bh);
          x += bw;
        }
        c.fillStyle = '#3b2414';
        c.fillRect(0, y + rowH - 12, w, 12);
        c.fillStyle = 'rgba(255,200,140,0.12)';
        c.fillRect(0, y + rowH - 12, w, 2);
        c.fillStyle = 'rgba(0,0,0,0.5)';
        c.fillRect(0, y + rowH, w, 4);
      }
      c.fillStyle = 'rgba(10,6,3,0.5)';
      c.fillRect(0, 0, w, h);
      // Desk
      c.fillStyle = vGrad(c, deskY, h, [[0, '#3a2112'], [1, '#120904']]);
      c.fillRect(0, deskY, w, h - deskY);
      c.fillStyle = 'rgba(255,200,140,0.18)';
      c.fillRect(0, deskY, w, 2);
      // Book stack
      const sx = lx + 90;
      [[70, '#5b1f1f'], [62, '#1f2d4a'], [74, '#2f4a33']].forEach(([bw, col], i) => {
        c.fillStyle = col;
        roundRect(c, sx + i * 3, deskY + 6 - (i + 1) * 13, bw, 12, 2);
        c.fill();
        c.fillStyle = 'rgba(240,225,200,0.6)';
        c.fillRect(sx + i * 3 + bw - 4, deskY + 8 - (i + 1) * 13, 3, 8);
      });
      // Banker's lamp
      c.fillStyle = '#8a6a2e';
      c.beginPath();
      c.ellipse(lx, deskY + 8, 32, 7, 0, 0, TAU);
      c.fill();
      c.fillRect(lx - 3, deskY - 64, 6, 70);
      const shade = c.createLinearGradient(0, deskY - 96, 0, deskY - 64);
      shade.addColorStop(0, '#2c8a5a');
      shade.addColorStop(1, '#0f4a2d');
      c.fillStyle = shade;
      c.beginPath();
      c.moveTo(lx - 62, deskY - 64);
      c.quadraticCurveTo(lx - 58, deskY - 98, lx, deskY - 100);
      c.quadraticCurveTo(lx + 58, deskY - 98, lx + 62, deskY - 64);
      c.closePath();
      c.fill();
      c.fillStyle = '#c9a24d';
      c.fillRect(lx - 63, deskY - 66, 126, 3);
    });

    const beam = { x0: w * 0.72, x1: w * 0.94, x2: w * 0.58, x3: w * 0.28 };
    const region = { x: w * 0.25, y: 0, w: w * 0.7, h: h };
    const dust = motes(90, region);

    return {
      draw(c, t, dt) {
        c.drawImage(bg, 0, 0, w, h);
        const pulse = 0.85 + 0.15 * Math.sin(t * 0.18);
        const g = c.createLinearGradient(w * 0.85, 0, w * 0.4, h);
        g.addColorStop(0, `rgba(255,225,170,${0.13 * pulse})`);
        g.addColorStop(1, 'rgba(255,225,170,0)');
        c.fillStyle = g;
        c.beginPath();
        c.moveTo(beam.x0, 0);
        c.lineTo(beam.x1, 0);
        c.lineTo(beam.x2, h);
        c.lineTo(beam.x3, h);
        c.closePath();
        c.fill();
        drawMotes(c, dust, region, t, dt, '#ffe9c4', 0.55);
        c.globalCompositeOperation = 'lighter';
        const flick = 0.96 + 0.04 * Math.sin(t * 2.3);
        glow(c, lx, deskY - 40, h * 0.5, 'rgba(255,200,120,A)', 0.22 * flick);
        glow(c, lx, deskY + 4, 160, 'rgba(255,220,150,A)', 0.25 * flick);
        c.globalCompositeOperation = 'source-over';
      },
    };
  };

  // ======================================================================
  // DINER
  // ======================================================================
  scenes.diner = (w, h, dpr) => {
    const winTop = h * 0.1;
    const winBot = h * 0.46;
    const floorY = h * 0.74;

    const outside = blurred(w, winBot - winTop, dpr, 6, (c, ww, hh) => {
      c.fillStyle = vGrad(c, 0, hh, [[0, '#050b16'], [1, '#14223a']]);
      c.fillRect(0, 0, ww, hh);
      let x = 0;
      while (x < ww) {
        const bw = rand(60, 160);
        const bh = rand(hh * 0.3, hh * 0.9);
        c.fillStyle = `rgb(${rand(10, 22) | 0},${rand(16, 28) | 0},${rand(30, 45) | 0})`;
        c.fillRect(x, hh - bh, bw, bh);
        for (let wy = hh - bh + 10; wy < hh - 10; wy += 16) {
          for (let wx = x + 8; wx < x + bw - 8; wx += 14) {
            if (Math.random() < 0.35) {
              c.fillStyle = `rgba(255,${rand(190, 230) | 0},${rand(120, 170) | 0},${rand(0.4, 0.9)})`;
              c.fillRect(wx, wy, 7, 9);
            }
          }
        }
        x += bw + rand(4, 20);
      }
      for (let i = 0; i < 12; i++) glow(c, rand(0, ww), hh * rand(0.6, 0.95), rand(10, 26), pick(['rgba(255,170,80,A)', 'rgba(120,180,255,A)', 'rgba(255,90,90,A)']), 0.8);
    });

    const bg = layer(w, h, dpr, (c) => {
      c.fillStyle = vGrad(c, 0, h * 0.58, [[0, '#0b252c'], [1, '#12404a']]);
      c.fillRect(0, 0, w, h * 0.58);
      c.drawImage(outside, 0, winTop, w, winBot - winTop);
      // window frame
      c.fillStyle = '#c8cdd2';
      c.fillRect(0, winTop - 6, w, 6);
      c.fillRect(0, winBot, w, 8);
      const panes = Math.max(3, Math.round(w / 320));
      for (let i = 1; i < panes; i++) c.fillRect((w / panes) * i - 4, winTop, 8, winBot - winTop);
      c.fillStyle = 'rgba(255,255,255,0.05)';
      for (let i = 0; i < panes; i++) {
        c.beginPath();
        const px = (w / panes) * i;
        c.moveTo(px + 30, winTop);
        c.lineTo(px + 90, winTop);
        c.lineTo(px + 30, winBot);
        c.lineTo(px - 30, winBot);
        c.fill();
      }
      // chrome strip
      c.fillStyle = vGrad(c, h * 0.56, h * 0.58, [[0, '#f4f6f8'], [0.5, '#8d959c'], [1, '#e1e5e8']]);
      c.fillRect(0, h * 0.56, w, h * 0.02);
      // red wainscot
      c.fillStyle = vGrad(c, h * 0.58, floorY, [[0, '#7a1c26'], [1, '#4a0f16']]);
      c.fillRect(0, h * 0.58, w, floorY - h * 0.58);
      c.fillStyle = 'rgba(0,0,0,0.22)';
      for (let x = 40; x < w; x += 80) c.fillRect(x, h * 0.6, 2, floorY - h * 0.62);
      c.fillStyle = '#c8cdd2';
      c.fillRect(0, floorY - 4, w, 4);
      checkerFloor(c, w, h, floorY, '#e6e0d2', '#17171b');
      c.fillStyle = vGrad(c, floorY, h, [[0, 'rgba(0,0,0,0.6)'], [1, 'rgba(0,0,0,0.25)']]);
      c.fillRect(0, floorY, w, h - floorY);
    });

    const lamps = [0.16, 0.5, 0.84].map((f) => ({ x: w * f, y: h * 0.07 }));
    const cars = [];
    let nextCar = 1;
    let flicker = 0;
    let nextFlicker = rand(4, 10);
    const signX = Math.max(30, w * 0.06);
    const signY = winTop + (winBot - winTop) * 0.42;
    const signSize = Math.max(28, Math.min(52, w * 0.035));

    return {
      draw(c, t, dt) {
        c.drawImage(bg, 0, 0, w, h);
        // traffic outside
        nextCar -= dt;
        if (nextCar <= 0) {
          const dir = Math.random() < 0.5 ? 1 : -1;
          cars.push({ x: dir > 0 ? -60 : w + 60, dir, v: rand(140, 260), y: winBot - rand(12, 30) });
          nextCar = rand(2, 7);
        }
        c.save();
        c.beginPath();
        c.rect(0, winTop, w, winBot - winTop);
        c.clip();
        c.globalCompositeOperation = 'lighter';
        for (let i = cars.length - 1; i >= 0; i--) {
          const car = cars[i];
          car.x += car.dir * car.v * dt;
          if (car.x < -80 || car.x > w + 80) { cars.splice(i, 1); continue; }
          const head = car.dir > 0 ? 'rgba(255,240,200,A)' : 'rgba(255,60,60,A)';
          glow(c, car.x, car.y, 30, head, 0.5);
          glow(c, car.x - car.dir * 26, car.y, 30, head, 0.5);
        }
        c.restore();
        // pendant lamps
        c.globalCompositeOperation = 'lighter';
        for (const l of lamps) glow(c, l.x, l.y + 30, h * 0.38, 'rgba(255,190,120,A)', 0.16);
        c.globalCompositeOperation = 'source-over';
        for (const l of lamps) {
          c.strokeStyle = '#05080a';
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(l.x, 0);
          c.lineTo(l.x, l.y);
          c.stroke();
          c.fillStyle = '#b3202e';
          c.beginPath();
          c.arc(l.x, l.y + 22, 26, Math.PI, TAU);
          c.closePath();
          c.fill();
          c.fillStyle = 'rgba(255,240,210,0.95)';
          c.beginPath();
          c.ellipse(l.x, l.y + 22, 22, 4, 0, 0, TAU);
          c.fill();
        }
        // neon sign with occasional flicker
        nextFlicker -= dt;
        if (nextFlicker <= 0) { flicker = rand(0.3, 0.9); nextFlicker = rand(5, 14); }
        let on = 1;
        if (flicker > 0) { flicker -= dt; on = Math.random() < 0.5 ? 0.25 : 1; }
        c.save();
        c.font = `${signSize}px Pacifico, "Brush Script MT", cursive`;
        c.textBaseline = 'middle';
        c.shadowColor = `rgba(255,70,140,${0.9 * on})`;
        c.shadowBlur = 24 * on;
        c.fillStyle = on > 0.5 ? '#ffd0e2' : '#6a3a4a';
        c.fillText('Open', signX, signY);
        c.shadowColor = `rgba(60,220,255,${0.9 * on})`;
        c.fillStyle = on > 0.5 ? '#d4f8ff' : '#3a5a64';
        c.font = `600 ${signSize * 0.45}px Inter, sans-serif`;
        c.fillText('24 HOURS', signX + 6, signY + signSize * 0.85);
        c.restore();
      },
    };
  };

  // ======================================================================
  // GARDEN
  // ======================================================================
  scenes.garden = (w, h, dpr) => {
    const hillY = (x, base, amp, seed) => base + Math.sin(x * 0.004 + seed) * amp + Math.sin(x * 0.011 + seed * 2) * amp * 0.4;
    const bg = layer(w, h, dpr, (c) => {
      c.fillStyle = vGrad(c, 0, h, [[0, '#8ccaf2'], [0.5, '#d9eef0'], [0.75, '#fbe7c3'], [1, '#fbe7c3']]);
      c.fillRect(0, 0, w, h);
      glow(c, w * 0.82, h * 0.16, Math.max(w, h) * 0.45, 'rgba(255,240,200,A)', 0.8);
      glow(c, w * 0.82, h * 0.16, 50, 'rgba(255,255,240,A)', 1);
      const hills = [[h * 0.55, 30, '#a9cfa1', 1.3], [h * 0.63, 38, '#86b97f', 4.1], [h * 0.72, 30, '#5e9a5c', 2.2]];
      hills.forEach(([base, amp, col, seed], i) => {
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(0, h);
        for (let x = 0; x <= w + 20; x += 20) c.lineTo(x, hillY(x, base, amp, seed));
        c.lineTo(w, h);
        c.fill();
        if (i === 1) {
          for (let k = 0; k < Math.round(w / 90); k++) {
            const tx = rand(0, w);
            const ty = hillY(tx, base, amp, seed);
            const r = rand(10, 22);
            c.fillStyle = 'rgba(60,110,60,0.9)';
            c.fillRect(tx - 1.5, ty - r * 0.4, 3, r * 0.8);
            c.beginPath();
            c.arc(tx, ty - r, r, 0, TAU);
            c.arc(tx - r * 0.6, ty - r * 0.6, r * 0.7, 0, TAU);
            c.arc(tx + r * 0.6, ty - r * 0.6, r * 0.7, 0, TAU);
            c.fill();
          }
        }
      });
      c.fillStyle = vGrad(c, h * 0.78, h, [[0, '#4f8a49'], [1, '#2f6331']]);
      c.fillRect(0, h * 0.8, w, h * 0.2);
    });

    const cloudSprite = (cw) => layer(cw, cw * 0.5, dpr, (c) => {
      c.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 9; i++) {
        c.beginPath();
        c.arc(rand(cw * 0.2, cw * 0.8), rand(cw * 0.22, cw * 0.32), rand(cw * 0.08, cw * 0.16), 0, TAU);
        c.fill();
      }
    });
    const clouds = Array.from({ length: 5 }, () => {
      const cw = rand(160, 300);
      return { img: cloudSprite(cw), cw, x: rand(-cw, w), y: rand(h * 0.03, h * 0.3), v: rand(4, 10) };
    });

    const scale = Math.min(1.4, h / 800);
    const blades = Array.from({ length: Math.round(w / 3.2) }, () => ({
      x: rand(-10, w + 10), len: rand(30, 95) * scale, wd: rand(2, 4.5),
      col: pick(['#3f7d3c', '#4c9146', '#5aa451', '#356c33', '#6db35e']), back: Math.random() < 0.5,
    }));
    blades.sort((a, b) => (a.back === b.back ? 0 : a.back ? -1 : 1));
    const flowers = Array.from({ length: Math.round(w / 70) }, () => ({
      x: rand(10, w - 10), len: rand(50, 110) * scale, col: pick(['#ff8fb1', '#ffd34d', '#ffffff', '#b593ff', '#ff6f61']), r: rand(4, 7),
    }));
    const flies = Array.from({ length: 3 }, () => ({
      x: rand(0, w), y: rand(h * 0.45, h * 0.75), v: rand(25, 45) * (Math.random() < 0.5 ? -1 : 1), ph: rand(0, TAU), col: pick(['#ffb347', '#7ec8ff', '#ffe066', '#ff8fb1']),
    }));
    const pollenRegion = { x: 0, y: h * 0.3, w, h: h * 0.6 };
    const pollen = motes(40, pollenRegion);

    const sway = (x, t, len) => (Math.sin(t * 1.3 + x * 0.012) * 6 + Math.sin(t * 0.55 + x * 0.004) * 9) * (len / 80);

    return {
      draw(c, t, dt) {
        c.drawImage(bg, 0, 0, w, h);
        for (const cl of clouds) {
          cl.x += cl.v * dt;
          if (cl.x > w + 20) cl.x = -cl.cw - 20;
          c.drawImage(cl.img, cl.x, cl.y, cl.cw, cl.cw * 0.5);
        }
        drawMotes(c, pollen, pollenRegion, t, dt, '#fff7c2', 0.8);
        for (const b of blades) {
          const s = sway(b.x, t, b.len);
          const baseY = b.back ? h - 8 : h + 4;
          c.fillStyle = b.back ? '#2f5f2e' : b.col;
          c.beginPath();
          c.moveTo(b.x - b.wd, baseY);
          c.quadraticCurveTo(b.x + s * 0.3, baseY - b.len * 0.55, b.x + s, baseY - b.len);
          c.quadraticCurveTo(b.x + s * 0.3 + b.wd * 0.5, baseY - b.len * 0.55, b.x + b.wd, baseY);
          c.fill();
        }
        for (const f of flowers) {
          const s = sway(f.x, t, f.len);
          const tx = f.x + s;
          const ty = h - f.len;
          c.strokeStyle = '#3d7a37';
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(f.x, h + 2);
          c.quadraticCurveTo(f.x + s * 0.3, h - f.len * 0.5, tx, ty);
          c.stroke();
          c.fillStyle = f.col;
          for (let p = 0; p < 5; p++) {
            const a = (p / 5) * TAU + t * 0.1;
            c.beginPath();
            c.ellipse(tx + Math.cos(a) * f.r, ty + Math.sin(a) * f.r, f.r * 0.9, f.r * 0.55, a, 0, TAU);
            c.fill();
          }
          c.fillStyle = '#f0a500';
          c.beginPath();
          c.arc(tx, ty, f.r * 0.5, 0, TAU);
          c.fill();
        }
        for (const b of flies) {
          b.x += b.v * dt;
          if (b.x > w + 30) b.x = -30;
          if (b.x < -30) b.x = w + 30;
          const y = b.y + Math.sin(t * 0.9 + b.ph) * 40 + Math.sin(t * 2.3 + b.ph) * 8;
          const flap = Math.abs(Math.sin(t * 13 + b.ph));
          c.fillStyle = b.col;
          c.globalAlpha = 0.9;
          for (const side of [-1, 1]) {
            c.beginPath();
            c.ellipse(b.x + side * 6 * flap, y - 3, 7 * flap + 1, 9, side * 0.4, 0, TAU);
            c.fill();
            c.beginPath();
            c.ellipse(b.x + side * 5 * flap, y + 6, 5 * flap + 1, 6, -side * 0.4, 0, TAU);
            c.fill();
          }
          c.globalAlpha = 1;
          c.fillStyle = '#2a2a2a';
          c.fillRect(b.x - 1, y - 7, 2, 15);
        }
      },
    };
  };

  // ======================================================================
  // RAINY DORM ROOM
  // ======================================================================
  scenes.rain = (w, h, dpr) => {
    const wx = w * 0.1, wy = h * 0.07, ww = w * 0.8, wh = h * 0.66;
    const city = blurred(ww, wh, dpr, 7, (c, cw, ch) => {
      c.fillStyle = vGrad(c, 0, ch, [[0, '#0a1222'], [0.6, '#1a2740'], [1, '#2b2638']]);
      c.fillRect(0, 0, cw, ch);
      let x = -20;
      while (x < cw) {
        const bw = rand(50, 140);
        const bh = rand(ch * 0.25, ch * 0.75);
        c.fillStyle = `rgb(${rand(12, 22) | 0},${rand(16, 26) | 0},${rand(30, 42) | 0})`;
        c.fillRect(x, ch - bh, bw, bh);
        for (let yy = ch - bh + 10; yy < ch - 8; yy += 15) {
          for (let xx = x + 6; xx < x + bw - 6; xx += 12) {
            if (Math.random() < 0.3) {
              c.fillStyle = `rgba(255,${rand(180, 225) | 0},${rand(110, 160) | 0},${rand(0.3, 0.8)})`;
              c.fillRect(xx, yy, 6, 8);
            }
          }
        }
        x += bw + rand(2, 16);
      }
      for (let i = 0; i < 14; i++) glow(c, rand(0, cw), ch * rand(0.55, 0.98), rand(14, 34), pick(['rgba(255,170,80,A)', 'rgba(110,170,255,A)', 'rgba(255,110,140,A)']), 0.85);
    });

    const drops = layer(ww, wh, dpr, (c) => {
      for (let i = 0; i < (ww * wh) / 1800; i++) {
        const x = rand(0, ww), y = rand(0, wh), r = Math.pow(Math.random(), 2) * 3.5 + 0.6;
        c.fillStyle = 'rgba(190,210,240,0.16)';
        c.beginPath();
        c.arc(x, y, r, 0, TAU);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.4)';
        c.beginPath();
        c.arc(x + r * 0.3, y + r * 0.35, r * 0.35, 0, TAU);
        c.fill();
      }
    });

    const room = layer(w, h, dpr, (c) => {
      c.fillStyle = '#0c0e15';
      c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'lighter';
      glow(c, w * 0.04, h * 0.88, h * 0.75, 'rgba(255,170,90,A)', 0.2);
      c.globalCompositeOperation = 'source-over';
    });

    const frame = layer(w, h, dpr, (c) => {
      c.fillStyle = '#1c1f29';
      const f = 16;
      c.fillRect(wx - f, wy - f, ww + f * 2, f);
      c.fillRect(wx - f, wy + wh, ww + f * 2, f);
      c.fillRect(wx - f, wy, f, wh);
      c.fillRect(wx + ww, wy, f, wh);
      c.fillRect(wx + ww / 2 - 5, wy, 10, wh);
      c.fillRect(wx, wy + wh * 0.56 - 5, ww, 10);
      // sill
      c.fillStyle = '#23262f';
      c.fillRect(wx - 40, wy + wh + f, ww + 80, 14);
      c.fillStyle = 'rgba(255,180,110,0.12)';
      c.fillRect(wx - 40, wy + wh + f, ww + 80, 2);
      // plant on the sill
      const px = wx + ww - 60, py = wy + wh + f;
      c.fillStyle = '#3a2a24';
      c.beginPath();
      c.moveTo(px - 20, py);
      c.lineTo(px + 20, py);
      c.lineTo(px + 15, py - 30);
      c.lineTo(px - 15, py - 30);
      c.fill();
      c.fillStyle = '#16241a';
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.32;
        c.save();
        c.translate(px, py - 30);
        c.rotate(a + Math.PI / 2);
        c.beginPath();
        c.ellipse(0, -28, 8, 28, 0, 0, TAU);
        c.fill();
        c.restore();
      }
      // books on the sill
      const bx = wx + 30;
      ['#2b1d2e', '#1d2733', '#2e2a1e', '#1f2b22'].forEach((col, i) => {
        c.fillStyle = col;
        c.fillRect(bx + i * 13, py - rand(34, 46), 11, 46);
      });
      // mug
      c.fillStyle = '#2b2d36';
      roundRect(c, bx + 80, py - 26, 24, 26, 4);
      c.fill();
    });

    const streaks = Array.from({ length: 170 }, () => ({ x: rand(0, ww), y: rand(0, wh), l: rand(14, 28), v: rand(900, 1300), a: rand(0.1, 0.25) }));
    const sliders = Array.from({ length: 14 }, () => ({ x: rand(0, ww), y: rand(0, wh), r: rand(2.5, 4.5), v: 0, wait: rand(0, 4), trail: 0 }));
    let flash = 0;
    let pending = [];
    const onThunder = (e) => {
      const delay = (e.detail && e.detail.delay) || 1;
      // Light arrives before the sound: flash slightly ahead of the rumble.
      pending.push(Math.max(0, delay - 0.6));
      pending.push(Math.max(0, delay - 0.45));
    };
    window.addEventListener('fp:thunder', onThunder);

    return {
      destroy() { window.removeEventListener('fp:thunder', onThunder); },
      draw(c, t, dt) {
        c.drawImage(room, 0, 0, w, h);
        c.save();
        c.beginPath();
        c.rect(wx, wy, ww, wh);
        c.clip();
        c.drawImage(city, wx, wy, ww, wh);
        c.strokeStyle = 'rgba(200,215,240,0.2)';
        c.lineWidth = 1;
        c.beginPath();
        for (const s of streaks) {
          s.y += s.v * dt;
          s.x -= s.v * dt * 0.08;
          if (s.y > wh) { s.y = -s.l; s.x = rand(0, ww * 1.1); }
          c.moveTo(wx + s.x, wy + s.y);
          c.lineTo(wx + s.x + s.l * 0.08, wy + s.y - s.l);
        }
        c.stroke();
        c.drawImage(drops, wx, wy, ww, wh);
        for (const d of sliders) {
          if (d.wait > 0) {
            d.wait -= dt;
          } else {
            d.v = Math.min(180, d.v + 400 * dt);
            d.y += d.v * dt;
            d.trail = Math.min(140, d.trail + d.v * dt);
            if (Math.random() < 0.02) { d.wait = rand(0.2, 1.5); d.v = 0; }
          }
          if (d.y - d.trail > wh) { d.y = rand(-20, wh * 0.4); d.x = rand(0, ww); d.trail = 0; d.wait = rand(0, 3); }
          c.strokeStyle = 'rgba(200,220,250,0.12)';
          c.lineWidth = d.r * 0.8;
          c.beginPath();
          c.moveTo(wx + d.x, wy + d.y - d.trail);
          c.lineTo(wx + d.x, wy + d.y);
          c.stroke();
          c.fillStyle = 'rgba(200,220,250,0.25)';
          c.beginPath();
          c.arc(wx + d.x, wy + d.y, d.r, 0, TAU);
          c.fill();
          c.fillStyle = 'rgba(255,255,255,0.55)';
          c.beginPath();
          c.arc(wx + d.x + d.r * 0.3, wy + d.y + d.r * 0.3, d.r * 0.35, 0, TAU);
          c.fill();
        }
        if (flash > 0) {
          c.fillStyle = `rgba(220,230,255,${flash * 0.55})`;
          c.fillRect(wx, wy, ww, wh);
        }
        c.restore();
        c.drawImage(frame, 0, 0, w, h);
        pending = pending.map((p) => p - dt).filter((p) => {
          if (p <= 0) { flash = 1; return false; }
          return true;
        });
        if (flash > 0) {
          c.fillStyle = `rgba(200,215,255,${flash * 0.1})`;
          c.fillRect(0, 0, w, h);
          flash = Math.max(0, flash - dt * 5);
        }
      },
    };
  };

  // ======================================================================
  // CALM OFFICE
  // ======================================================================
  scenes.office = (w, h, dpr) => {
    const x0 = w * 0.6, y0 = h * 0.08, x1 = w * 0.94, y1 = h * 0.7;
    const deskY = h * 0.86;
    const slatGap = 17;

    const bg = layer(w, h, dpr, (c) => {
      c.fillStyle = vGrad(c, 0, h, [[0, '#cfc8bb'], [1, '#b8afa0']]);
      c.fillRect(0, 0, w, h);
      // light stripes from the blinds onto the wall
      c.save();
      c.beginPath();
      c.rect(0, 0, x0, deskY);
      c.clip();
      const g = c.createLinearGradient(x0, 0, x0 - w * 0.5, 0);
      g.addColorStop(0, 'rgba(255,248,225,0.35)');
      g.addColorStop(1, 'rgba(255,248,225,0)');
      c.fillStyle = g;
      for (let y = y0; y < y1; y += slatGap * 1.6) {
        c.beginPath();
        c.moveTo(x0, y);
        c.lineTo(x0, y + slatGap * 0.6);
        c.lineTo(x0 - w * 0.55, y + slatGap * 0.6 + w * 0.32);
        c.lineTo(x0 - w * 0.55, y + w * 0.32);
        c.closePath();
        c.fill();
      }
      c.restore();
      // window frame
      c.fillStyle = '#f2efe9';
      c.fillRect(x0 - 12, y0 - 12, x1 - x0 + 24, y1 - y0 + 24);
      // desk
      c.fillStyle = vGrad(c, deskY, h, [[0, '#a98260'], [1, '#6e5038']]);
      c.fillRect(0, deskY, w, h - deskY);
      c.fillStyle = 'rgba(255,240,220,0.4)';
      c.fillRect(0, deskY, w, 2);
      // notebook + pen
      const nx = w * 0.72;
      c.fillStyle = 'rgba(0,0,0,0.15)';
      c.fillRect(nx + 4, deskY + 10, 120, 70);
      c.fillStyle = '#2f4858';
      c.fillRect(nx, deskY + 6, 120, 70);
      c.fillStyle = '#f2ead8';
      c.fillRect(nx + 6, deskY + 6, 110, 66);
      c.strokeStyle = 'rgba(80,110,160,0.35)';
      for (let i = 1; i < 6; i++) {
        c.beginPath();
        c.moveTo(nx + 10, deskY + 6 + i * 11);
        c.lineTo(nx + 112, deskY + 6 + i * 11);
        c.stroke();
      }
      c.strokeStyle = '#d24d3c';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(nx + 132, deskY + 20);
      c.lineTo(nx + 150, deskY + 64);
      c.stroke();
      // plant pot
      const px = Math.max(80, w * 0.11);
      c.fillStyle = '#c2683f';
      c.beginPath();
      c.moveTo(px - 44, deskY - 70);
      c.lineTo(px + 44, deskY - 70);
      c.lineTo(px + 34, deskY + 8);
      c.lineTo(px - 34, deskY + 8);
      c.closePath();
      c.fill();
      c.fillStyle = '#a9532f';
      c.fillRect(px - 48, deskY - 78, 96, 12);
    });

    const blinds = layer(x1 - x0, y1 - y0, dpr, (c, bw, bh) => {
      for (let y = 0; y < bh; y += slatGap) {
        c.fillStyle = vGrad(c, y, y + 11, [[0, '#fbf8f2'], [1, '#d9d2c6']]);
        c.fillRect(0, y, bw, 11);
      }
      c.strokeStyle = 'rgba(120,110,95,0.6)';
      c.lineWidth = 1.5;
      [bw * 0.25, bw * 0.75].forEach((x) => {
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, bh);
        c.stroke();
      });
    });

    const skyline = layer(x1 - x0, y1 - y0, dpr, (c, bw, bh) => {
      let x = 0;
      while (x < bw) {
        const tw = rand(30, 70);
        const th = rand(bh * 0.15, bh * 0.45);
        c.fillStyle = `rgba(${rand(150, 175) | 0},${rand(170, 190) | 0},${rand(195, 215) | 0},0.9)`;
        c.fillRect(x, bh - th, tw, th);
        x += tw + rand(2, 10);
      }
    });

    const clouds = Array.from({ length: 4 }, () => ({ x: rand(0, x1 - x0), y: rand(10, (y1 - y0) * 0.5), r: rand(30, 60), v: rand(5, 12) }));
    const leaves = Array.from({ length: 9 }, (_, i) => ({ a: -Math.PI / 2 + (i - 4) * 0.28 + rand(-0.1, 0.1), len: rand(80, 140), wd: rand(26, 40), ph: rand(0, TAU) }));
    const region = { x: x0 - w * 0.45, y: y0, w: w * 0.45, h: deskY - y0 };
    const dust = motes(60, region);
    const plantX = Math.max(80, w * 0.11);

    return {
      draw(c, t, dt) {
        c.drawImage(bg, 0, 0, w, h);
        c.save();
        c.beginPath();
        c.rect(x0, y0, x1 - x0, y1 - y0);
        c.clip();
        c.fillStyle = vGrad(c, y0, y1, [[0, '#8fc3ea'], [1, '#e2f0f8']]);
        c.fillRect(x0, y0, x1 - x0, y1 - y0);
        c.fillStyle = 'rgba(255,255,255,0.9)';
        for (const cl of clouds) {
          cl.x += cl.v * dt;
          if (cl.x - cl.r * 2 > x1 - x0) cl.x = -cl.r * 2;
          c.beginPath();
          c.arc(x0 + cl.x, y0 + cl.y, cl.r * 0.6, 0, TAU);
          c.arc(x0 + cl.x + cl.r * 0.6, y0 + cl.y - cl.r * 0.2, cl.r * 0.7, 0, TAU);
          c.arc(x0 + cl.x + cl.r * 1.3, y0 + cl.y, cl.r * 0.55, 0, TAU);
          c.fill();
        }
        c.drawImage(skyline, x0, y0, x1 - x0, y1 - y0);
        c.drawImage(blinds, x0, y0, x1 - x0, y1 - y0);
        c.restore();
        drawMotes(c, dust, region, t, dt, '#fffaf0', 0.6);
        // swaying plant
        for (const l of leaves) {
          const a = l.a + Math.sin(t * 0.6 + l.ph) * 0.03;
          c.save();
          c.translate(plantX, deskY - 74);
          c.rotate(a + Math.PI / 2);
          c.fillStyle = '#3f7d4f';
          c.beginPath();
          c.moveTo(0, 0);
          c.quadraticCurveTo(-l.wd, -l.len * 0.5, 0, -l.len);
          c.quadraticCurveTo(l.wd, -l.len * 0.5, 0, 0);
          c.fill();
          c.strokeStyle = 'rgba(255,255,255,0.18)';
          c.lineWidth = 1.2;
          c.beginPath();
          c.moveTo(0, 0);
          c.lineTo(0, -l.len * 0.9);
          c.stroke();
          c.restore();
        }
      },
    };
  };

  // ======================================================================
  // OCEAN SUNSET
  // ======================================================================
  scenes.ocean = (w, h, dpr) => {
    const horizon = h * 0.56;
    const sunR = Math.min(w, h) * 0.09;
    // Keep the sun clear of the timer card on wider screens.
    const sunX = Math.min(w * 0.85, Math.max(w / 2 + 280, w * 0.72));
    const bg = layer(w, h, dpr, (c) => {
      c.fillStyle = vGrad(c, 0, horizon, [[0, '#24194a'], [0.45, '#8c3c6b'], [0.8, '#ee8250'], [1, '#ffcf8a']]);
      c.fillRect(0, 0, w, horizon);
      glow(c, sunX, horizon, Math.max(w, h) * 0.5, 'rgba(255,170,100,A)', 0.55);
      c.fillStyle = vGrad(c, horizon - sunR, horizon, [[0, '#fff1c4'], [1, '#ffb36b']]);
      c.beginPath();
      c.arc(sunX, horizon + sunR * 0.25, sunR, Math.PI, TAU);
      c.fill();
      c.fillStyle = vGrad(c, horizon, h, [[0, '#6a3560'], [0.4, '#3a1f4a'], [1, '#170d2b']]);
      c.fillRect(0, horizon, w, h - horizon);
    });
    const streakClouds = Array.from({ length: 7 }, () => ({ x: rand(0, w), y: rand(h * 0.08, horizon * 0.8), l: rand(120, 360), th: rand(4, 12), v: rand(3, 8), a: rand(0.15, 0.35) }));
    const birds = Array.from({ length: 4 }, () => ({ x: rand(0, w), y: rand(h * 0.15, h * 0.4), s: rand(6, 12), v: rand(18, 35), ph: rand(0, TAU) }));

    return {
      draw(c, t, dt) {
        c.drawImage(bg, 0, 0, w, h);
        for (const s of streakClouds) {
          s.x += s.v * dt;
          if (s.x - s.l > w) s.x = -s.l;
          c.fillStyle = `rgba(255,180,190,${s.a})`;
          c.beginPath();
          c.ellipse(s.x, s.y, s.l, s.th, 0, 0, TAU);
          c.fill();
        }
        // sun path glitter
        c.globalCompositeOperation = 'lighter';
        for (let i = 0; i < 90; i++) {
          const p = i / 90;
          const y = horizon + 2 + Math.pow(p, 1.4) * (h - horizon);
          const width = (14 + (y - horizon) * 0.55) * (0.35 + 0.65 * Math.abs(Math.sin(t * 1.6 + i * 1.7)));
          c.fillStyle = `rgba(255,${200 - p * 60 | 0},${130 - p * 50 | 0},${0.5 * (1 - p * 0.6)})`;
          c.fillRect(sunX - width / 2 + Math.sin(t * 0.8 + i) * 6, y, width, 1.5 + p * 2);
        }
        c.globalCompositeOperation = 'source-over';
        // waves
        for (let i = 0; i < 4; i++) {
          const base = horizon + (h - horizon) * (0.25 + i * 0.22);
          const amp = 3 + i * 4;
          const k1 = 0.01 * (1 + i * 0.3);
          const sp = 0.5 + i * 0.25;
          c.fillStyle = ['rgba(70,35,80,0.5)', 'rgba(52,26,66,0.55)', 'rgba(36,18,52,0.6)', 'rgba(24,12,40,0.7)'][i];
          c.beginPath();
          c.moveTo(0, h);
          const pts = [];
          for (let x = 0; x <= w + 12; x += 12) {
            const y = base + Math.sin(x * k1 + t * sp) * amp + Math.sin(x * 0.023 + t * 1.1 + i) * amp * 0.5;
            pts.push([x, y]);
            c.lineTo(x, y);
          }
          c.lineTo(w, h);
          c.closePath();
          c.fill();
          c.strokeStyle = `rgba(255,190,170,${0.1 + i * 0.05})`;
          c.lineWidth = 1.2;
          c.beginPath();
          pts.forEach(([x, y], j) => (j ? c.lineTo(x, y) : c.moveTo(x, y)));
          c.stroke();
        }
        // birds
        c.strokeStyle = 'rgba(40,20,45,0.8)';
        c.lineWidth = 1.6;
        for (const b of birds) {
          b.x += b.v * dt;
          if (b.x > w + 20) { b.x = -20; b.y = rand(h * 0.15, h * 0.4); }
          const f = Math.sin(t * 6 + b.ph) * 0.6;
          const y = b.y + Math.sin(t * 0.5 + b.ph) * 6;
          c.beginPath();
          c.moveTo(b.x - b.s, y - b.s * f);
          c.quadraticCurveTo(b.x - b.s * 0.4, y - b.s * 0.2, b.x, y);
          c.quadraticCurveTo(b.x + b.s * 0.4, y - b.s * 0.2, b.x + b.s, y - b.s * f);
          c.stroke();
        }
      },
    };
  };

  // ======================================================================
  // FIREPLACE CABIN
  // ======================================================================
  scenes.cabin = (w, h, dpr) => {
    const fx = w > 760 ? Math.min(w * 0.8, Math.max(w / 2 + 360, w * 0.76)) : w * 0.5;
    const fw = Math.min(380, Math.max(240, w * 0.3));
    const boxB = h - 96;
    const boxT = boxB - Math.min(220, h * 0.26);
    const top = boxT - Math.min(90, h * 0.1);
    const boxL = fx - fw * 0.32, boxR = fx + fw * 0.32;
    const winX = w * 0.06, winY = h * 0.14, winW = Math.min(180, w * 0.16), winH = h * 0.26;

    const bg = layer(w, h, dpr, (c) => {
      for (let y = 0; y < h; y += 46) {
        c.fillStyle = vGrad(c, y, y + 46, [[0, '#4a2c19'], [0.5, '#3a2213'], [1, '#22130a']]);
        c.fillRect(0, y, w, 46);
        c.fillStyle = 'rgba(0,0,0,0.45)';
        c.fillRect(0, y + 43, w, 3);
        c.strokeStyle = 'rgba(0,0,0,0.12)';
        for (let k = 0; k < 3; k++) {
          c.beginPath();
          const yy = y + 12 + k * 10;
          c.moveTo(0, yy);
          for (let x = 0; x < w; x += 50) c.lineTo(x, yy + Math.sin(x * 0.02 + y) * 2);
          c.stroke();
        }
      }
      c.fillStyle = 'rgba(8,4,2,0.55)';
      c.fillRect(0, 0, w, h);
      // window frame
      c.fillStyle = '#1e120a';
      c.fillRect(winX - 10, winY - 10, winW + 20, winH + 20);
      // stone fireplace
      for (let y = top; y < h; y += 22) {
        for (let x = fx - fw / 2 + ((y / 22) % 2) * 14; x < fx + fw / 2; x += rand(30, 48)) {
          const sw = rand(26, 44);
          c.fillStyle = `rgb(${rand(70, 100) | 0},${rand(66, 90) | 0},${rand(60, 80) | 0})`;
          roundRect(c, x, y, Math.min(sw, fx + fw / 2 - x), 20, 6);
          c.fill();
        }
      }
      c.fillStyle = '#5a3520';
      c.fillRect(fx - fw / 2 - 20, top - 16, fw + 40, 18);
      c.fillStyle = 'rgba(255,200,150,0.15)';
      c.fillRect(fx - fw / 2 - 20, top - 16, fw + 40, 2);
      // firebox
      c.fillStyle = '#0a0503';
      c.beginPath();
      c.moveTo(boxL, boxB);
      c.lineTo(boxL, boxT + 20);
      c.quadraticCurveTo(fx, boxT - 20, boxR, boxT + 20);
      c.lineTo(boxR, boxB);
      c.closePath();
      c.fill();
      // logs
      c.fillStyle = '#2a170c';
      c.save();
      c.translate(fx, boxB - 10);
      c.rotate(0.12);
      roundRect(c, -fw * 0.25, -8, fw * 0.5, 16, 8);
      c.fill();
      c.rotate(-0.24);
      roundRect(c, -fw * 0.24, -18, fw * 0.48, 15, 8);
      c.fill();
      c.restore();
      // candle on the mantel
      c.fillStyle = '#efe4cf';
      c.fillRect(fx - fw / 2 + 10, top - 46, 12, 30);
    });

    const SPR = [
      sprite(32, [[0, 'rgba(255,250,210,1)'], [0.4, 'rgba(255,220,120,0.6)'], [1, 'rgba(255,180,60,0)']]),
      sprite(32, [[0, 'rgba(255,190,80,0.9)'], [0.5, 'rgba(255,120,40,0.4)'], [1, 'rgba(255,80,20,0)']]),
      sprite(32, [[0, 'rgba(230,80,30,0.6)'], [0.6, 'rgba(160,40,20,0.2)'], [1, 'rgba(120,20,10,0)']]),
    ];
    const flames = [];
    const sparks = [];
    const flakes = Array.from({ length: 45 }, () => ({ x: rand(0, winW), y: rand(0, winH), r: rand(0.8, 2.2), v: rand(12, 30), ph: rand(0, TAU) }));
    let acc = 0;
    const baseY = boxB - 22;
    const halfW = fw * 0.22;
    const candleX = fx - fw / 2 + 16;

    return {
      draw(c, t, dt) {
        c.drawImage(bg, 0, 0, w, h);
        // snowy window
        c.save();
        c.beginPath();
        c.rect(winX, winY, winW, winH);
        c.clip();
        c.fillStyle = vGrad(c, winY, winY + winH, [[0, '#0d1a33'], [1, '#2b3a5c']]);
        c.fillRect(winX, winY, winW, winH);
        c.fillStyle = '#dfe8f5';
        c.fillRect(winX, winY + winH - 14, winW, 14);
        c.fillStyle = 'rgba(255,255,255,0.85)';
        for (const f of flakes) {
          f.y += f.v * dt;
          f.x += Math.sin(t + f.ph) * 8 * dt;
          if (f.y > winH) { f.y = -4; f.x = rand(0, winW); }
          c.beginPath();
          c.arc(winX + f.x, winY + f.y, f.r, 0, TAU);
          c.fill();
        }
        c.restore();
        c.fillStyle = '#1e120a';
        c.fillRect(winX + winW / 2 - 3, winY, 6, winH);
        c.fillRect(winX, winY + winH / 2 - 3, winW, 6);

        // fire particles
        acc += dt * 90;
        while (acc > 1) {
          acc -= 1;
          const life = rand(0.6, 1.3);
          flames.push({ x: fx + rand(-halfW, halfW) * Math.random(), y: baseY + rand(-4, 6), vx: rand(-10, 10), vy: -rand(55, 120), life, max: life, s: rand(26, 46) });
        }
        if (Math.random() < dt * 6) sparks.push({ x: fx + rand(-halfW, halfW) * 0.6, y: baseY - 20, vx: rand(-20, 20), vy: -rand(80, 160), life: rand(1, 2.4) });

        c.globalCompositeOperation = 'lighter';
        const flick = 0.75 + 0.15 * Math.sin(t * 7.3) * Math.sin(t * 3.1) + 0.1 * Math.sin(t * 13.7);
        glow(c, fx, baseY - 30, Math.max(w, h) * 0.7, 'rgba(255,120,40,A)', 0.16 * flick);
        glow(c, fx, baseY - 10, fw * 0.6, 'rgba(255,160,70,A)', 0.4 * flick);
        for (let i = flames.length - 1; i >= 0; i--) {
          const p = flames[i];
          p.life -= dt;
          if (p.life <= 0) { flames.splice(i, 1); continue; }
          p.x += (p.vx + (fx - p.x) * 0.9) * dt;
          p.y += p.vy * dt;
          const k = p.life / p.max;
          const s = p.s * (0.4 + 0.6 * k);
          c.globalAlpha = Math.min(1, k * 1.4) * 0.7;
          c.drawImage(SPR[k > 0.66 ? 0 : k > 0.33 ? 1 : 2], p.x - s, p.y - s, s * 2, s * 2);
        }
        c.globalAlpha = 1;
        c.fillStyle = '#ffcf7a';
        for (let i = sparks.length - 1; i >= 0; i--) {
          const s = sparks[i];
          s.life -= dt;
          if (s.life <= 0 || s.y < top) { sparks.splice(i, 1); continue; }
          s.x += (s.vx + Math.sin(t * 5 + i) * 20) * dt;
          s.y += s.vy * dt;
          c.globalAlpha = Math.min(1, s.life);
          c.fillRect(s.x, s.y, 2, 2);
        }
        c.globalAlpha = 1;
        // candle flame
        const cf = 1 + Math.sin(t * 11) * 0.08;
        glow(c, candleX, top - 52, 60, 'rgba(255,170,80,A)', 0.35);
        c.drawImage(SPR[0], candleX - 6, top - 64 * cf, 12, 18 * cf);
        c.globalCompositeOperation = 'source-over';
      },
    };
  };
  // ---------- people & planes (shared by the airport and hotel) ----------

  function drawWalker(c, p) {
    const legs = Math.sin(p.dist * 0.075 + p.ph);
    c.save();
    c.translate(p.x, p.y);
    c.scale(p.dir * p.s, p.s);
    c.fillStyle = p.col;
    c.strokeStyle = p.col;
    c.lineCap = 'round';
    c.lineWidth = 8;
    c.beginPath();
    c.moveTo(0, -48);
    c.lineTo(legs * 13, 0);
    c.moveTo(0, -48);
    c.lineTo(-legs * 13, 0);
    c.stroke();
    roundRect(c, -10, -96, 20, 54, 9);
    c.fill();
    c.beginPath();
    c.arc(1, -108, 10, 0, TAU);
    c.fill();
    c.lineWidth = 6;
    if (p.bag) {
      c.beginPath();
      c.moveTo(-3, -84);
      c.lineTo(-24, -56);
      c.stroke();
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(-24, -56);
      c.lineTo(-33, -38);
      c.stroke();
      c.fillStyle = p.bagCol;
      roundRect(c, -56, -40, 28, 40, 5);
      c.fill();
      c.fillStyle = p.col;
      c.beginPath();
      c.arc(-51, 1, 3, 0, TAU);
      c.arc(-33, 1, 3, 0, TAU);
      c.fill();
    } else {
      c.beginPath();
      c.moveTo(0, -86);
      c.lineTo(-legs * 14, -56);
      c.stroke();
    }
    c.restore();
  }

  // Occasional passers-by in a floor lane; farther lanes are smaller.
  function passersBy(w, lane, { every = [6, 14], scale = [0.7, 1.05], bag = 0.6, col = 'rgba(16,18,26,0.8)', bags } = {}) {
    const people = [];
    let next = rand(1, every[0]);
    return {
      update(dt) {
        next -= dt;
        if (next <= 0) {
          next = rand(every[0], every[1]);
          const dir = Math.random() < 0.5 ? 1 : -1;
          const y = rand(lane[0], lane[1]);
          const k = (y - lane[0]) / Math.max(1, lane[1] - lane[0]);
          const sc = scale[0] + (scale[1] - scale[0]) * k;
          people.push({
            x: dir > 0 ? -80 : w + 80, y, dir, s: sc, v: rand(45, 70) * sc, dist: 0, ph: rand(0, TAU),
            col, bag: Math.random() < bag, bagCol: pick(bags || ['#2e3a4f', '#4a2f3a', '#3a4a3a', '#5a4a2f']),
          });
          people.sort((a, b) => a.y - b.y);
        }
        for (let i = people.length - 1; i >= 0; i--) {
          const p = people[i];
          p.x += p.dir * p.v * dt;
          p.dist += p.v * dt;
          if (p.x < -120 || p.x > w + 120) people.splice(i, 1);
        }
      },
      draw(c) { people.forEach((p) => drawWalker(c, p)); },
    };
  }

  function poly(c, pts, L) {
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x * L, y * L) : c.moveTo(x * L, y * L)));
    c.closePath();
    c.fill();
  }

  // Side view of an airliner, nose pointing +x (dir = -1 flips it).
  function drawJet(c, x, y, L, angle, tail, { dir = 1, detail = false, gear = false } = {}) {
    c.save();
    c.translate(x, y);
    c.rotate(angle);
    c.scale(dir, 1);
    if (gear) {
      c.fillStyle = '#20242c';
      [[-0.06, 0.1], [0.02, 0.1], [0.36, 0.1]].forEach(([gx, gy]) => {
        c.fillRect(gx * L - 1.5, 0.04 * L, 3, gy * L - 0.04 * L);
        c.beginPath();
        c.arc(gx * L, gy * L, 0.018 * L, 0, TAU);
        c.fill();
      });
    }
    c.fillStyle = '#c5ccd6';
    poly(c, [[-0.47, 0], [-0.36, 0], [-0.44, 0.07], [-0.5, 0.07]], L);
    c.fillStyle = '#eef1f5';
    roundRect(c, -0.5 * L, -0.055 * L, L, 0.11 * L, 0.055 * L);
    c.fill();
    c.fillStyle = tail;
    poly(c, [[-0.5, -0.03], [-0.45, -0.3], [-0.37, -0.3], [-0.3, -0.04]], L);
    c.fillRect(-0.4 * L, 0.025 * L, 0.85 * L, 0.012 * L);
    c.fillStyle = '#b8c0cb';
    poly(c, [[-0.1, 0.03], [0.1, 0.03], [-0.04, 0.2], [-0.16, 0.2]], L);
    c.fillStyle = '#d5dbe3';
    roundRect(c, -0.03 * L, 0.07 * L, 0.15 * L, 0.065 * L, 0.03 * L);
    c.fill();
    c.fillStyle = '#5b6574';
    c.beginPath();
    c.ellipse(0.12 * L, 0.1 * L, 0.008 * L, 0.03 * L, 0, 0, TAU);
    c.fill();
    if (detail) {
      c.fillStyle = '#3b4a5a';
      for (let wx = -0.36; wx < 0.4; wx += 0.022) c.fillRect(wx * L, -0.022 * L, 0.009 * L, 0.014 * L);
      c.beginPath();
      c.moveTo(0.43 * L, -0.03 * L);
      c.lineTo(0.47 * L, -0.03 * L);
      c.lineTo(0.485 * L, -0.012 * L);
      c.lineTo(0.43 * L, -0.012 * L);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.4)';
      c.fillRect(-0.45 * L, -0.05 * L, 0.9 * L, 0.012 * L);
    }
    c.restore();
  }

  // ======================================================================
  // AIRPORT CAFÉ
  // ======================================================================
  const DESTINATIONS = ['DUBAI', 'LONDON', 'DOHA', 'ISTANBUL', 'PARIS', 'MUMBAI', 'CAIRO', 'RIYADH', 'KUALA LUMPUR', 'TOKYO', 'ATHENS', 'NAIROBI', 'SINGAPORE', 'ROME', 'MUSCAT', 'AMMAN'];
  const FLAP = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  scenes.airport = (w, h, dpr) => {
    const winTop = h * 0.11;
    const horizon = h * 0.47;
    const floorY = h * 0.64;
    const counterY = h * 0.84;
    const runwayY = horizon + (floorY - horizon) * 0.3;
    const mullion = Math.max(150, w / 6);

    const outside = layer(w, h, dpr, (c) => {
      c.fillStyle = vGrad(c, winTop, horizon, [[0, '#1c2b4f'], [0.55, '#6f5f8c'], [0.85, '#e8916d'], [1, '#f8c48a']]);
      c.fillRect(0, winTop, w, horizon - winTop);
      glow(c, w * 0.7, horizon, Math.max(w, h) * 0.35, 'rgba(255,170,110,A)', 0.5);
      for (let i = 0; i < 6; i++) {
        c.fillStyle = `rgba(255,190,190,${rand(0.08, 0.2)})`;
        c.beginPath();
        c.ellipse(rand(0, w), rand(winTop + 20, horizon - 40), rand(80, 260), rand(3, 8), 0, 0, TAU);
        c.fill();
      }
      // distant skyline and control tower
      let x = 0;
      while (x < w) {
        const bw = rand(30, 90);
        const bh = rand(6, 30);
        c.fillStyle = '#3c3a55';
        c.fillRect(x, horizon - bh, bw, bh);
        x += bw + rand(0, 30);
      }
      const tx = w * 0.86;
      c.fillStyle = '#2d2c42';
      c.fillRect(tx - 6, horizon - 120, 12, 120);
      c.beginPath();
      c.moveTo(tx - 22, horizon - 120);
      c.lineTo(tx + 22, horizon - 120);
      c.lineTo(tx + 16, horizon - 140);
      c.lineTo(tx - 16, horizon - 140);
      c.fill();
      c.fillStyle = 'rgba(160,220,255,0.55)';
      c.fillRect(tx - 15, horizon - 136, 30, 10);
      // apron, runway, taxiway
      c.fillStyle = vGrad(c, horizon, floorY, [[0, '#4a4a5c'], [1, '#2c2d38']]);
      c.fillRect(0, horizon, w, floorY - horizon);
      c.fillStyle = '#5c5d6e';
      c.fillRect(0, runwayY - 6, w, 12);
      c.fillStyle = 'rgba(255,255,255,0.55)';
      for (let rx = 10; rx < w; rx += 46) c.fillRect(rx, runwayY - 1, 22, 2);
      c.strokeStyle = 'rgba(255,205,80,0.55)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(-10, floorY - 12);
      c.bezierCurveTo(w * 0.3, floorY - 14, w * 0.35, runwayY + 30, w * 0.55, runwayY + 8);
      c.stroke();
    });

    // Plane parked at the gate, nose to the left, with its jet bridge.
    const planeL = Math.max(420, w * 0.62);
    const noseX = w * 0.46;
    const planeY = floorY - planeL * 0.12;
    const gate = layer(w, h, dpr, (c) => {
      const bx0 = w * 0.3;
      const bx1 = noseX + planeL * 0.09;
      const by = planeY - planeL * 0.045;
      c.fillStyle = '#20232c';
      c.fillRect(bx0 + 30, by + 30, 8, floorY - by - 30);
      drawJet(c, noseX + planeL / 2, planeY, planeL, 0, '#d0544c', { dir: -1, detail: true, gear: true });
      c.fillStyle = vGrad(c, by, by + 34, [[0, '#d9dde3'], [1, '#9aa1ac']]);
      c.fillRect(bx0, by, bx1 - bx0, 34);
      c.fillStyle = 'rgba(0,0,0,0.12)';
      for (let x = bx0 + 10; x < bx1; x += 16) c.fillRect(x, by, 2, 34);
      glow(c, w * 0.62, floorY - 4, planeL * 0.4, 'rgba(0,0,0,A)', 0.25);
    });

    const frame = layer(w, h, dpr, (c) => {
      // ceiling with light strips
      c.fillStyle = vGrad(c, 0, winTop, [[0, '#16181f'], [1, '#262a35']]);
      c.fillRect(0, 0, w, winTop);
      for (let x = 30; x < w; x += 120) {
        c.fillStyle = 'rgba(255,240,215,0.75)';
        c.fillRect(x, winTop * 0.55, 60, 3);
      }
      // window mullions and transom
      c.fillStyle = '#1b1e26';
      c.fillRect(0, winTop - 6, w, 10);
      for (let x = mullion / 2; x < w; x += mullion) c.fillRect(x - 5, winTop, 10, floorY - winTop);
      c.fillRect(0, floorY - 8, w, 10);
      // faint reflections on the glass
      c.fillStyle = 'rgba(255,255,255,0.035)';
      for (let x = 0; x < w; x += mullion) {
        c.beginPath();
        c.moveTo(x + 40, winTop);
        c.lineTo(x + 110, winTop);
        c.lineTo(x + 20, floorY);
        c.lineTo(x - 50, floorY);
        c.fill();
      }
      // polished concourse floor reflecting the windows
      c.fillStyle = vGrad(c, floorY, counterY, [[0, '#4a4440'], [1, '#2a2522']]);
      c.fillRect(0, floorY, w, counterY - floorY);
      c.fillStyle = vGrad(c, floorY, counterY, [[0, 'rgba(240,160,120,0.22)'], [1, 'rgba(240,160,120,0)']]);
      for (let x = 0; x < w; x += mullion) c.fillRect(x + mullion / 2 + 8, floorY, mullion - 16, counterY - floorY);
      // wayfinding sign
      const sw = 210;
      const sx = w - sw - Math.max(20, w * 0.04);
      const sy = winTop + 14;
      c.strokeStyle = '#555';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(sx + 30, 0);
      c.lineTo(sx + 30, sy);
      c.moveTo(sx + sw - 30, 0);
      c.lineTo(sx + sw - 30, sy);
      c.stroke();
      c.fillStyle = '#f6c544';
      roundRect(c, sx, sy, sw, 38, 6);
      c.fill();
      c.fillStyle = '#1b1b1b';
      c.font = '700 16px Inter, sans-serif';
      c.textBaseline = 'middle';
      c.fillText('✈  Gates B1–B20  →', sx + 16, sy + 20);
    });

    const front = layer(w, h, dpr, (c) => {
      c.fillStyle = vGrad(c, counterY, h, [[0, '#6b4630'], [0.08, '#4a2f20'], [1, '#22150e']]);
      c.fillRect(0, counterY, w, h - counterY);
      c.fillStyle = 'rgba(255,215,170,0.3)';
      c.fillRect(0, counterY, w, 2);
      const cx = Math.max(70, w * 0.12);
      // to-go cup
      c.fillStyle = 'rgba(0,0,0,0.3)';
      c.beginPath();
      c.ellipse(cx + 6, counterY + 24, 30, 7, 0, 0, TAU);
      c.fill();
      c.fillStyle = '#f5f1ea';
      c.beginPath();
      c.moveTo(cx - 24, counterY - 50);
      c.lineTo(cx + 24, counterY - 50);
      c.lineTo(cx + 18, counterY + 20);
      c.lineTo(cx - 18, counterY + 20);
      c.closePath();
      c.fill();
      c.fillStyle = '#8a5a36';
      c.beginPath();
      c.moveTo(cx - 22, counterY - 26);
      c.lineTo(cx + 22, counterY - 26);
      c.lineTo(cx + 20, counterY + 2);
      c.lineTo(cx - 20, counterY + 2);
      c.closePath();
      c.fill();
      c.fillStyle = '#2b2b2b';
      roundRect(c, cx - 27, counterY - 60, 54, 12, 5);
      c.fill();
      c.fillRect(cx - 22, counterY - 66, 44, 8);
      // boarding pass and passport
      c.save();
      c.translate(cx + 120, counterY + 26);
      c.rotate(0.22);
      c.fillStyle = '#1f2f5a';
      roundRect(c, -32, -44, 64, 84, 5);
      c.fill();
      c.strokeStyle = '#d9b45c';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(0, -8, 12, 0, TAU);
      c.stroke();
      c.restore();
      c.save();
      c.translate(cx + 96, counterY + 12);
      c.rotate(-0.1);
      c.fillStyle = '#fbfaf6';
      roundRect(c, -70, -24, 140, 48, 5);
      c.fill();
      c.fillStyle = '#f6c544';
      c.fillRect(-70, -24, 140, 9);
      c.fillStyle = '#333';
      for (let i = 0; i < 14; i++) c.fillRect(-60 + i * 3.4, -8, i % 3 ? 1.5 : 2.5, 24);
      c.strokeStyle = '#bbb';
      c.setLineDash([3, 3]);
      c.beginPath();
      c.moveTo(38, -15);
      c.lineTo(38, 24);
      c.stroke();
      c.setLineDash([]);
      c.fillStyle = '#555';
      c.font = '700 9px Inter, sans-serif';
      c.fillText('GATE B12', -2, -2);
      c.fillText('SEAT 14A', -2, 12);
      c.restore();
    });

    // Departures board with split-flap updates.
    const now = new Date();
    const base = now.getHours() * 60 + now.getMinutes();
    const flights = [];
    let nextDep = base + 6;
    const addFlight = () => {
      flights.push({ at: nextDep, code: `FP ${Math.floor(rand(100, 899))}`, dest: pick(DESTINATIONS), gate: `B${Math.floor(rand(1, 21))}`, delayed: Math.random() < 0.15, flip: 0.8 });
      nextDep += Math.floor(rand(6, 16));
    };
    for (let i = 0; i < 6; i++) addFlight();
    const fmtTime = (m) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
    const statusOf = (f, m) => {
      const left = f.at - m;
      if (f.delayed) return ['DELAYED', '#ff8a5c'];
      if (left <= 0) return ['DEPARTED', '#8a93a3'];
      if (left <= 10) return ['BOARDING', '#5fe08a'];
      if (left <= 25) return ['GATE OPEN', '#ffd46b'];
      return ['ON TIME', '#e8eef7'];
    };
    const scramble = (str, k) => str.split('').map((ch, i) => (ch === ' ' || i / str.length < 1 - k ? ch : FLAP[Math.floor(Math.random() * FLAP.length)])).join('');
    const board = { x: Math.max(16, w * 0.035), y: winTop + 16, w: Math.min(400, Math.max(270, w * 0.27)) };
    let lastStatus = [];

    const walkers = passersBy(w, [floorY + 30, counterY - 6], { every: [5, 12], scale: [0.62, 0.95], bag: 0.75 });

    let jet = null;
    let sinceJet = 30;
    const launch = () => { jet = { x: -60, v: 12, t: 0, y: runwayY - 4, a: 0 }; sinceJet = 0; };
    const onTakeoff = () => launch();
    window.addEventListener('fp:takeoff', onTakeoff);

    return {
      destroy() { window.removeEventListener('fp:takeoff', onTakeoff); },
      draw(c, t, dt) {
        c.drawImage(outside, 0, 0, w, h);
        // runway lights and tower beacon
        for (let x = 12; x < w; x += 34) {
          c.fillStyle = `rgba(255,240,200,${0.35 + 0.35 * Math.sin(t * 2 + x * 0.05)})`;
          c.fillRect(x, runwayY + 7, 2, 2);
        }
        if (Math.sin(t * 3) > 0.6) {
          c.globalCompositeOperation = 'lighter';
          glow(c, w * 0.86, horizon - 142, 10, 'rgba(255,60,60,A)', 0.9);
          c.globalCompositeOperation = 'source-over';
        }
        // a jet taking off: sound-driven, with a fallback when the sound is off
        sinceJet += dt;
        if (!jet && sinceJet > 80) launch();
        if (jet) {
          jet.t += dt;
          if (jet.t < 8.5) {
            jet.v += 22 * dt;
          } else {
            jet.a = Math.max(-0.2, jet.a - 0.08 * dt);
            jet.y += jet.v * jet.a * dt;
          }
          jet.x += jet.v * dt;
          drawJet(c, jet.x, jet.y, 64, jet.a, '#3c6fd1');
          if (Math.sin(t * 9) > 0.7) {
            c.globalCompositeOperation = 'lighter';
            glow(c, jet.x - 10, jet.y + 8, 8, 'rgba(255,255,255,A)', 1);
            c.globalCompositeOperation = 'source-over';
          }
          if (jet.x > w + 100 || jet.y < winTop - 20) jet = null;
        }
        c.drawImage(gate, 0, 0, w, h);
        c.drawImage(frame, 0, 0, w, h);

        // departures board
        const m = (() => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; })();
        while (flights.length && flights[0].at < m - 3) { flights.shift(); addFlight(); flights.forEach((f) => { f.flip = 0.8; }); }
        const rowH = 22;
        const bh = 50 + rowH * flights.length;
        c.strokeStyle = '#444';
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(board.x + 30, 0);
        c.lineTo(board.x + 30, board.y);
        c.moveTo(board.x + board.w - 30, 0);
        c.lineTo(board.x + board.w - 30, board.y);
        c.stroke();
        c.fillStyle = '#0c0e13';
        roundRect(c, board.x, board.y, board.w, bh, 8);
        c.fill();
        c.strokeStyle = '#2c303a';
        c.stroke();
        c.textBaseline = 'middle';
        c.fillStyle = '#ffd46b';
        c.font = '800 13px Inter, sans-serif';
        c.fillText('✈ DEPARTURES', board.x + 12, board.y + 16);
        const clock = new Date();
        c.textAlign = 'right';
        c.fillText(`${String(clock.getHours()).padStart(2, '0')}:${String(clock.getMinutes()).padStart(2, '0')}`, board.x + board.w - 12, board.y + 16);
        c.textAlign = 'left';
        c.font = '600 9.5px Inter, sans-serif';
        c.fillStyle = '#7d8696';
        const col = [12, 56, 112, board.w - 132, board.w - 92];
        ['TIME', 'FLIGHT', 'DESTINATION', 'GATE', 'STATUS'].forEach((lbl, i) => c.fillText(lbl, board.x + col[i], board.y + 34));
        c.font = '600 12px Menlo, Consolas, monospace';
        flights.forEach((f, i) => {
          const y = board.y + 52 + i * rowH;
          const [st, stCol] = statusOf(f, m);
          if (lastStatus[i] !== st + f.code) { if (lastStatus[i]) f.flip = 0.6; lastStatus[i] = st + f.code; }
          const k = Math.max(0, f.flip) / 0.8;
          f.flip -= dt;
          c.fillStyle = 'rgba(255,255,255,0.03)';
          c.fillRect(board.x + 6, y - 9, board.w - 12, 18);
          c.fillStyle = '#ffd46b';
          c.fillText(scramble(fmtTime(f.at), k), board.x + col[0], y);
          c.fillText(scramble(f.code, k), board.x + col[1], y);
          c.fillText(scramble(f.dest.slice(0, 12), k), board.x + col[2], y);
          c.fillText(scramble(f.gate, k), board.x + col[3], y);
          c.fillStyle = stCol;
          if (st !== 'BOARDING' || Math.sin(t * 4) > -0.6) c.fillText(scramble(st, k), board.x + col[4], y);
        });

        walkers.update(dt);
        walkers.draw(c);
        c.drawImage(front, 0, 0, w, h);
        // steam from the cup
        const cx = Math.max(70, w * 0.12);
        c.lineCap = 'round';
        for (let i = 0; i < 2; i++) {
          c.strokeStyle = 'rgba(255,250,240,0.07)';
          c.lineWidth = 6;
          c.beginPath();
          for (let sIdx = 0; sIdx <= 18; sIdx++) {
            const pp = sIdx / 18;
            const x = cx - 6 + i * 12 + Math.sin(pp * 5 + t * 1.3 + i * 2) * 8 * pp;
            const y = counterY - 70 - pp * 80;
            if (sIdx === 0) c.moveTo(x, y);
            else c.lineTo(x, y);
          }
          c.stroke();
        }
      },
    };
  };

  // ======================================================================
  // GRAND HOTEL LOBBY
  // ======================================================================
  scenes.hotel = (w, h, dpr) => {
    const floorY = h * 0.64;
    const elev = { x: Math.max(24, w * 0.05), w: Math.min(150, Math.max(110, w * 0.12)), top: h * 0.3 };
    const deskX0 = w * 0.68;
    const deskX1 = w * 0.97;
    const deskTop = floorY - h * 0.11;
    const colXs = [w * 0.27, w * 0.73];

    const bg = layer(w, h, dpr, (c) => {
      c.fillStyle = vGrad(c, 0, floorY, [[0, '#24180f'], [1, '#3e2b1d']]);
      c.fillRect(0, 0, w, floorY);
      // coffered ceiling band
      c.fillStyle = '#1a120c';
      c.fillRect(0, 0, w, h * 0.07);
      c.fillStyle = '#c9a25a';
      c.fillRect(0, h * 0.07, w, 3);
      // wood panelling with gold trim
      for (let x = 20; x < w; x += 150) {
        c.strokeStyle = 'rgba(214,170,90,0.28)';
        c.lineWidth = 2;
        c.strokeRect(x, h * 0.13, 120, floorY - h * 0.2);
        c.fillStyle = 'rgba(0,0,0,0.12)';
        c.fillRect(x + 8, h * 0.13 + 8, 104, floorY - h * 0.2 - 16);
      }
      c.fillStyle = '#c9a25a';
      c.fillRect(0, floorY - h * 0.05, w, 2);
      // elevator: brass frame, floor dial above
      const ex = elev.x, ew = elev.w;
      c.fillStyle = '#8a6a32';
      c.fillRect(ex - 10, elev.top - 10, ew + 20, floorY - elev.top + 10);
      c.fillStyle = '#2a1d12';
      c.beginPath();
      c.arc(ex + ew / 2, elev.top - 36, 30, Math.PI, TAU);
      c.fill();
      c.strokeStyle = '#d6aa5a';
      c.lineWidth = 3;
      c.stroke();
      // reception: key rack, sign and desk
      c.fillStyle = '#2b1d12';
      c.fillRect(deskX0 + 10, h * 0.24, deskX1 - deskX0 - 20, h * 0.16);
      for (let ky = h * 0.25; ky < h * 0.39; ky += 18) {
        for (let kx = deskX0 + 18; kx < deskX1 - 24; kx += 22) {
          c.strokeStyle = 'rgba(214,170,90,0.4)';
          c.lineWidth = 1;
          c.strokeRect(kx, ky, 18, 14);
          if (Math.random() < 0.6) { c.fillStyle = '#d6aa5a'; c.fillRect(kx + 8, ky + 3, 2, 8); }
        }
      }
      c.fillStyle = '#e2c27c';
      c.font = '600 15px Georgia, "Times New Roman", serif';
      c.textAlign = 'center';
      c.fillText('R E C E P T I O N', (deskX0 + deskX1) / 2, h * 0.21);
      c.textAlign = 'left';
      // marble floor
      checkerFloor(c, w, h, floorY, '#e9e1d1', '#7a6652', 0.22);
      c.fillStyle = vGrad(c, floorY, h, [[0, 'rgba(30,18,8,0.55)'], [1, 'rgba(30,18,8,0.15)']]);
      c.fillRect(0, floorY, w, h - floorY);
      // warm reflections of the chandeliers on the polished floor
      colXs.forEach((x) => {
        c.fillStyle = vGrad(c, floorY, h, [[0, 'rgba(255,210,140,0.25)'], [1, 'rgba(255,210,140,0)']]);
        c.fillRect(x - 70, floorY, 140, h - floorY);
      });
    });

    const desk = layer(w, h, dpr, (c) => {
      c.fillStyle = vGrad(c, deskTop, floorY, [[0, '#2a2422'], [1, '#14100e']]);
      c.fillRect(deskX0, deskTop, deskX1 - deskX0, floorY - deskTop + 6);
      c.strokeStyle = 'rgba(214,170,90,0.35)';
      c.lineWidth = 1;
      for (let i = 0; i < 6; i++) {
        c.beginPath();
        c.moveTo(deskX0 + rand(0, deskX1 - deskX0), deskTop);
        c.bezierCurveTo(deskX0 + rand(0, deskX1 - deskX0), deskTop + 20, deskX0 + rand(0, deskX1 - deskX0), floorY - 20, deskX0 + rand(0, deskX1 - deskX0), floorY);
        c.stroke();
      }
      c.fillStyle = '#d6aa5a';
      c.fillRect(deskX0 - 6, deskTop - 6, deskX1 - deskX0 + 12, 7);
      // service bell and lamp
      const bx = deskX0 + 40;
      c.fillStyle = '#e8c46a';
      c.beginPath();
      c.arc(bx, deskTop - 6, 12, Math.PI, TAU);
      c.fill();
      c.fillRect(bx - 15, deskTop - 7, 30, 3);
      c.fillRect(bx - 1.5, deskTop - 22, 3, 5);
      const lx = deskX1 - 50;
      c.fillStyle = '#c9a25a';
      c.fillRect(lx - 2, deskTop - 46, 4, 40);
      c.fillStyle = '#1f5e46';
      c.beginPath();
      c.moveTo(lx - 24, deskTop - 46);
      c.lineTo(lx + 24, deskTop - 46);
      c.lineTo(lx + 14, deskTop - 64);
      c.lineTo(lx - 14, deskTop - 64);
      c.fill();
      // marble columns
      colXs.forEach((x) => {
        const cw = 48;
        const g = c.createLinearGradient(x - cw / 2, 0, x + cw / 2, 0);
        g.addColorStop(0, '#b9b0a0');
        g.addColorStop(0.4, '#f3eee4');
        g.addColorStop(1, '#a89f8f');
        c.fillStyle = g;
        c.fillRect(x - cw / 2, h * 0.07, cw, floorY - h * 0.07);
        c.strokeStyle = 'rgba(120,110,95,0.35)';
        for (let i = 0; i < 3; i++) {
          c.beginPath();
          c.moveTo(x - 14 + i * 10, h * 0.12);
          c.bezierCurveTo(x + 10, h * 0.3, x - 18, h * 0.45, x - 6 + i * 8, floorY - 10);
          c.stroke();
        }
        c.fillStyle = '#c9a25a';
        c.fillRect(x - cw / 2 - 8, h * 0.07, cw + 16, 12);
        c.fillRect(x - cw / 2 - 8, floorY - 12, cw + 16, 14);
      });
    });

    const front = layer(w, h, dpr, (c) => {
      // velvet armchair with a tea table
      const ax = Math.max(10, w * 0.02);
      const ay = h;
      c.fillStyle = '#123d33';
      roundRect(c, ax, ay - 190, 150, 120, 30);
      c.fill();
      c.fillStyle = '#185145';
      roundRect(c, ax - 6, ay - 110, 172, 70, 18);
      c.fill();
      c.fillStyle = '#0f332a';
      roundRect(c, ax - 16, ay - 150, 34, 110, 16);
      c.fill();
      roundRect(c, ax + 132, ay - 150, 34, 110, 16);
      c.fill();
      const tx = ax + 230;
      c.fillStyle = '#c9a25a';
      c.fillRect(tx - 3, ay - 110, 6, 110);
      c.fillStyle = '#2a1d12';
      c.beginPath();
      c.ellipse(tx, ay - 112, 48, 12, 0, 0, TAU);
      c.fill();
      c.fillStyle = '#f4efe6';
      c.beginPath();
      c.ellipse(tx, ay - 118, 22, 5, 0, 0, TAU);
      c.fill();
      c.beginPath();
      c.moveTo(tx - 13, ay - 136);
      c.lineTo(tx + 13, ay - 136);
      c.quadraticCurveTo(tx + 12, ay - 118, tx, ay - 118);
      c.quadraticCurveTo(tx - 12, ay - 118, tx - 13, ay - 136);
      c.fill();
      c.strokeStyle = '#f4efe6';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(tx + 15, ay - 129, 5, -Math.PI / 2, Math.PI / 2);
      c.stroke();
      // potted palm in a gold planter
      const px = w - Math.max(70, w * 0.06);
      c.fillStyle = '#c9a25a';
      c.beginPath();
      c.moveTo(px - 40, ay - 90);
      c.lineTo(px + 40, ay - 90);
      c.lineTo(px + 30, ay);
      c.lineTo(px - 30, ay);
      c.fill();
      c.fillStyle = '#2f6b45';
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (i - 4) * 0.33;
        c.save();
        c.translate(px, ay - 92);
        c.rotate(a + Math.PI / 2);
        c.beginPath();
        c.ellipse(0, -70, 12, 72, 0, 0, TAU);
        c.fill();
        c.restore();
      }
    });

    const chandeliers = colXs.map((x) => ({
      x, y: h * 0.17,
      crystals: Array.from({ length: 46 }, () => {
        const a = rand(0, TAU);
        const r = Math.sqrt(Math.random());
        return { x: Math.cos(a) * 58 * r, y: Math.sin(a) * 10 * r + rand(-6, 46) * (1 - r * 0.5), ph: rand(0, TAU), s: rand(1, 2.4) };
      }),
    }));
    const walkers = passersBy(w, [floorY + 20, floorY + h * 0.13], { every: [10, 22], scale: [0.85, 1.05], bag: 0.4, col: 'rgba(22,14,8,0.82)', bags: ['#6b2a2a', '#2a3b5a', '#c9a25a'] });

    // Elevator: the floor needle drifts; when it reaches the lobby, the doors open.
    const lift = { floor: 6, target: 1, open: 0, hold: 0 };
    // The chime sounds ~2 s after the event, so start the car two floors up.
    const call = () => { lift.floor = Math.min(Math.max(lift.floor, 2.6), 2.6); lift.target = 1; lift.hold = 0; };
    window.addEventListener('fp:elevator', call);

    return {
      destroy() { window.removeEventListener('fp:elevator', call); },
      draw(c, t, dt) {
        c.drawImage(bg, 0, 0, w, h);
        // elevator doors and dial
        const gap = lift.target - lift.floor;
        if (gap !== 0) {
          if (lift.open === 0) lift.floor += Math.sign(gap) * Math.min(Math.abs(gap), dt * 0.8);
        } else if (lift.target === 1 && lift.hold <= 0 && lift.open === 0) lift.hold = 6;
        if (lift.hold > 0) {
          lift.hold -= dt;
          lift.open = Math.min(1, lift.open + dt * 0.7);
          if (lift.hold <= 0) lift.target = Math.floor(rand(3, 12));
        } else {
          lift.open = Math.max(0, lift.open - dt * 0.7);
          if (lift.open === 0 && lift.floor === lift.target && lift.target !== 1 && Math.random() < dt / 25) lift.target = 1;
        }
        const ex = elev.x, ew = elev.w;
        c.fillStyle = '#ffdca0';
        c.fillRect(ex, elev.top, ew, floorY - elev.top);
        const half = (ew / 2) * (1 - lift.open);
        const dg = c.createLinearGradient(ex, 0, ex + ew, 0);
        dg.addColorStop(0, '#b38a45');
        dg.addColorStop(0.5, '#e6c47c');
        dg.addColorStop(1, '#a07a3a');
        c.fillStyle = dg;
        c.fillRect(ex, elev.top, half, floorY - elev.top);
        c.fillRect(ex + ew - half, elev.top, half, floorY - elev.top);
        const ang = Math.PI + (Math.min(12, Math.max(1, lift.floor)) - 1) / 11 * Math.PI;
        c.strokeStyle = '#ffd98a';
        c.lineWidth = 2.5;
        c.beginPath();
        c.moveTo(ex + ew / 2, elev.top - 36);
        c.lineTo(ex + ew / 2 + Math.cos(ang) * 24, elev.top - 36 + Math.sin(ang) * 24);
        c.stroke();

        walkers.update(dt);
        walkers.draw(c);
        c.drawImage(desk, 0, 0, w, h);
        // crystal chandeliers
        for (const ch of chandeliers) {
          c.strokeStyle = '#b08a45';
          c.lineWidth = 2;
          c.beginPath();
          c.moveTo(ch.x, h * 0.07);
          c.lineTo(ch.x, ch.y - 12);
          c.stroke();
          c.globalCompositeOperation = 'lighter';
          glow(c, ch.x, ch.y + 14, 170, 'rgba(255,200,120,A)', 0.28);
          c.globalCompositeOperation = 'source-over';
          c.strokeStyle = '#d6aa5a';
          c.lineWidth = 3;
          c.beginPath();
          c.ellipse(ch.x, ch.y, 60, 11, 0, 0, TAU);
          c.stroke();
          c.beginPath();
          c.ellipse(ch.x, ch.y + 26, 36, 7, 0, 0, TAU);
          c.stroke();
          for (const cr of ch.crystals) {
            const a = 0.45 + 0.55 * Math.max(0, Math.sin(t * 2.2 + cr.ph));
            c.fillStyle = `rgba(255,248,230,${a})`;
            c.beginPath();
            c.arc(ch.x + cr.x, ch.y + cr.y, cr.s, 0, TAU);
            c.fill();
          }
          for (let i = -2; i <= 2; i++) {
            c.fillStyle = 'rgba(255,240,210,0.95)';
            c.beginPath();
            c.arc(ch.x + i * 24, ch.y - 6, 3, 0, TAU);
            c.fill();
          }
        }
        c.drawImage(front, 0, 0, w, h);
        // desk lamp glow and tea steam
        c.globalCompositeOperation = 'lighter';
        glow(c, deskX1 - 50, deskTop - 40, 110, 'rgba(255,200,120,A)', 0.25);
        c.globalCompositeOperation = 'source-over';
        const tx = Math.max(10, w * 0.02) + 230;
        c.strokeStyle = 'rgba(255,250,240,0.08)';
        c.lineWidth = 5;
        c.lineCap = 'round';
        for (let i = 0; i < 2; i++) {
          c.beginPath();
          for (let sIdx = 0; sIdx <= 16; sIdx++) {
            const pp = sIdx / 16;
            const x = tx - 4 + i * 8 + Math.sin(pp * 5 + t * 1.2 + i * 2) * 7 * pp;
            const y = h - 140 - pp * 70;
            if (sIdx === 0) c.moveTo(x, y);
            else c.lineTo(x, y);
          }
          c.stroke();
        }
      },
    };
  };
  // ======================================================================
  // COURTYARD LIBRARY (a library in a mosque courtyard)
  // ======================================================================

  // Tile with an eight-pointed star, the classic zellige motif.
  function starTile(size, ground, star, accent) {
    const t = document.createElement('canvas');
    t.width = t.height = size;
    const x = t.getContext('2d');
    x.fillStyle = ground;
    x.fillRect(0, 0, size, size);
    const r = size * 0.36;
    x.fillStyle = star;
    x.translate(size / 2, size / 2);
    for (let k = 0; k < 2; k++) {
      x.save();
      x.rotate((k * Math.PI) / 4);
      x.fillRect(-r * 0.72, -r * 0.72, r * 1.44, r * 1.44);
      x.restore();
    }
    x.fillStyle = accent;
    x.beginPath();
    x.arc(0, 0, r * 0.32, 0, TAU);
    x.fill();
    return t;
  }

  // Pointed (Islamic) arch opening from the springline down to `bottom`.
  function archPath(c, x0, x1, apex, spring, bottom) {
    const xm = (x0 + x1) / 2;
    c.moveTo(x0, bottom);
    c.lineTo(x0, spring);
    c.bezierCurveTo(x0, spring - (spring - apex) * 0.55, xm - (x1 - x0) * 0.12, apex + 6, xm, apex);
    c.bezierCurveTo(xm + (x1 - x0) * 0.12, apex + 6, x1, spring - (spring - apex) * 0.55, x1, spring);
    c.lineTo(x1, bottom);
    c.closePath();
  }

  scenes.mosque = (w, h, dpr) => {
    const horizon = h * 0.52;
    const floorY = h * 0.8;
    const side = Math.max(56, w * 0.13);
    const n = w > 1000 ? 3 : w > 640 ? 2 : 1;
    const pier = Math.max(24, w * 0.022);
    const span = (w - side * 2 - pier * (n - 1)) / n;
    const apex = h * 0.12;
    const spring = h * 0.3;
    const arches = Array.from({ length: n }, (_, i) => {
      const x0 = side + i * (span + pier);
      return { x0, x1: x0 + span };
    });
    // Keep the dome, minaret and palm framed by the side arches, clear of the timer card.
    const last = arches[arches.length - 1];
    const fx = n > 1 ? arches[0].x0 + span * 0.62 : w * 0.3;
    const fy = h * 0.68;
    const domeX = n > 1 ? last.x0 + span * 0.42 : w * 0.62;
    const minX = n > 1 ? last.x0 + span * 0.86 : w * 0.84;
    const palmX = n > 1 ? arches[0].x0 + span * 0.16 : w * 0.18;

    const yard = layer(w, h, dpr, (c) => {
      c.fillStyle = vGrad(c, 0, horizon, [[0, '#86bfe3'], [0.7, '#e9e2c8'], [1, '#f6deb0']]);
      c.fillRect(0, 0, w, horizon);
      glow(c, w * 0.2, h * 0.1, Math.max(w, h) * 0.4, 'rgba(255,240,200,A)', 0.6);
      // dome on its drum, and the minaret
      const dx = domeX, dr = Math.min(w, h, span * 1.6) * 0.13, db = horizon - h * 0.12;
      c.fillStyle = '#efe2c8';
      c.fillRect(dx - dr * 1.05, db, dr * 2.1, h * 0.06);
      const dg = c.createLinearGradient(dx - dr, 0, dx + dr, 0);
      dg.addColorStop(0, '#2c9aab');
      dg.addColorStop(0.4, '#5fd0dc');
      dg.addColorStop(1, '#1e6f7c');
      c.fillStyle = dg;
      c.beginPath();
      c.moveTo(dx - dr, db);
      c.bezierCurveTo(dx - dr, db - dr * 0.95, dx - dr * 0.2, db - dr * 1.15, dx, db - dr * 1.3);
      c.bezierCurveTo(dx + dr * 0.2, db - dr * 1.15, dx + dr, db - dr * 0.95, dx + dr, db);
      c.closePath();
      c.fill();
      c.strokeStyle = '#c9a24a';
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(dx, db - dr * 1.3);
      c.lineTo(dx, db - dr * 1.3 - 22);
      c.stroke();
      c.beginPath();
      c.arc(dx + 3, db - dr * 1.3 - 30, 7, Math.PI * 0.35, Math.PI * 1.65);
      c.stroke();
      const mx = minX, mw = Math.max(18, w * 0.016), mt = horizon - h * 0.4;
      c.fillStyle = '#f2e6cd';
      c.fillRect(mx - mw / 2, mt, mw, horizon - mt);
      c.fillStyle = '#c9a24a';
      c.fillRect(mx - mw, mt + (horizon - mt) * 0.28, mw * 2, 6);
      c.fillRect(mx - mw * 0.8, mt + (horizon - mt) * 0.55, mw * 1.6, 5);
      c.fillStyle = '#2c9aab';
      c.beginPath();
      c.moveTo(mx - mw / 2 - 2, mt);
      c.lineTo(mx, mt - mw * 2.2);
      c.lineTo(mx + mw / 2 + 2, mt);
      c.fill();
      // far courtyard arcade
      const wallTop = horizon - h * 0.11;
      c.fillStyle = '#f0e3c7';
      c.fillRect(0, wallTop, w, horizon - wallTop);
      for (let x = 0; x < w; x += 22) c.fillRect(x, wallTop - 6, 12, 6);
      c.fillStyle = '#b89e74';
      for (let x = 14; x < w; x += 46) {
        c.beginPath();
        archPath(c, x, x + 28, wallTop + 12, wallTop + 26, horizon - 4);
        c.fill();
      }
      // courtyard marble with perspective joints and an inlaid star medallion
      c.fillStyle = vGrad(c, horizon, floorY, [[0, '#e8dcc2'], [1, '#f6efe0']]);
      c.fillRect(0, horizon, w, floorY - horizon);
      c.strokeStyle = 'rgba(150,125,90,0.25)';
      c.lineWidth = 1;
      for (let i = -12; i <= 12; i++) {
        c.beginPath();
        c.moveTo(w / 2 + i * 30, horizon);
        c.lineTo(w / 2 + i * 260, floorY);
        c.stroke();
      }
      for (let k = 1; k < 7; k++) {
        const y = horizon + (floorY - horizon) * Math.pow(k / 7, 1.6);
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(w, y);
        c.stroke();
      }
      // palm in the courtyard
      const px = palmX;
      c.strokeStyle = '#8b6a45';
      c.lineWidth = 10;
      c.beginPath();
      c.moveTo(px, horizon + (floorY - horizon) * 0.4);
      c.quadraticCurveTo(px + 16, horizon - 40, px + 6, h * 0.24);
      c.stroke();
      c.fillStyle = '#3f8a4f';
      for (let i = 0; i < 9; i++) {
        c.save();
        c.translate(px + 6, h * 0.24);
        c.rotate(-Math.PI / 2 + (i - 4) * 0.42);
        c.beginPath();
        c.ellipse(0, -48, 10, 52, 0, 0, TAU);
        c.fill();
        c.restore();
      }
      // fountain: an octagonal basin
      c.fillStyle = 'rgba(80,60,30,0.18)';
      c.beginPath();
      c.ellipse(fx + 6, fy + 10, 84, 20, 0, 0, TAU);
      c.fill();
      c.fillStyle = '#e9e1d0';
      c.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU + Math.PI / 8;
        c.lineTo(fx + Math.cos(a) * 80, fy + Math.sin(a) * 20);
      }
      c.fill();
      c.fillStyle = '#5fc4d8';
      c.beginPath();
      c.ellipse(fx, fy - 2, 66, 13, 0, 0, TAU);
      c.fill();
      c.fillStyle = '#d6cbb4';
      c.fillRect(fx - 5, fy - 40, 10, 38);
      c.beginPath();
      c.ellipse(fx, fy - 40, 18, 5, 0, 0, TAU);
      c.fill();
    });

    const tile = starTile(36, '#1f6f78', '#efe0b8', '#c4543c');
    const arcade = layer(w, h, dpr, (c) => {
      c.fillStyle = vGrad(c, 0, floorY, [[0, '#cdb58b'], [1, '#b09068']]);
      c.fillRect(0, 0, w, floorY);
      c.globalCompositeOperation = 'destination-out';
      arches.forEach((a) => {
        c.beginPath();
        archPath(c, a.x0, a.x1, apex, spring, floorY);
        c.fill();
      });
      c.globalCompositeOperation = 'source-over';
      // carved frame around each arch and a tiled frieze along the top
      arches.forEach((a) => {
        c.strokeStyle = '#8a6b45';
        c.lineWidth = 6;
        c.beginPath();
        archPath(c, a.x0, a.x1, apex, spring, floorY);
        c.stroke();
        c.strokeStyle = 'rgba(255,240,210,0.35)';
        c.lineWidth = 2;
        c.beginPath();
        archPath(c, a.x0 - 8, a.x1 + 8, apex - 10, spring, floorY);
        c.stroke();
      });
      c.fillStyle = c.createPattern(tile, 'repeat');
      c.fillRect(0, 0, w, Math.max(28, apex - 26));
      c.fillStyle = '#8a6b45';
      c.fillRect(0, Math.max(28, apex - 26), w, 4);
      // tiled dado on the piers
      c.fillStyle = c.createPattern(tile, 'repeat');
      arches.slice(1).forEach((a) => c.fillRect(a.x0 - pier, floorY - h * 0.12, pier, h * 0.12));
      // built-in bookshelves in the side walls
      const palette = ['#6b1f2a', '#1f4a3a', '#1f3358', '#8a6a2a', '#4a2f1f', '#2f5a5a', '#5a1f4a'];
      [[0, side], [w - side, w]].forEach(([s0, s1]) => {
        const x0 = s0 + side * 0.12, x1 = s1 - side * 0.12;
        c.fillStyle = '#4a2f1c';
        c.beginPath();
        archPath(c, x0, x1, h * 0.16, h * 0.26, floorY - 6);
        c.fill();
        for (let y = h * 0.28; y < floorY - 40; y += 64) {
          let x = x0 + 6;
          while (x < x1 - 10) {
            const bw = rand(6, 13);
            const bh = rand(38, 54);
            c.fillStyle = pick(palette);
            c.fillRect(x, y + 56 - bh, bw - 1, bh);
            if (Math.random() < 0.5) { c.fillStyle = 'rgba(230,200,120,0.6)'; c.fillRect(x + 1, y + 56 - bh * 0.8, bw - 3, 2); }
            x += bw;
          }
          c.fillStyle = '#6b4a2c';
          c.fillRect(x0, y + 56, x1 - x0, 6);
        }
      });
      // carpet in the shade of the arcade, with a patterned border
      c.fillStyle = '#7a1f24';
      c.fillRect(0, floorY, w, h - floorY);
      c.fillStyle = '#d9b45c';
      c.fillRect(0, floorY + 10, w, 4);
      c.fillStyle = '#1f3358';
      for (let x = 0; x < w; x += 28) {
        c.beginPath();
        c.moveTo(x, floorY + 24);
        c.lineTo(x + 10, floorY + 16);
        c.lineTo(x + 20, floorY + 24);
        c.lineTo(x + 10, floorY + 32);
        c.fill();
      }
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.fillRect(0, floorY, w, 5);
      // wooden book stand (rehal) holding an open book
      const rx = Math.max(110, w * 0.17), ry = h - 30;
      c.strokeStyle = '#6b4226';
      c.lineWidth = 9;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(rx - 46, ry + 10);
      c.lineTo(rx + 30, ry - 56);
      c.moveTo(rx + 46, ry + 10);
      c.lineTo(rx - 30, ry - 56);
      c.stroke();
      c.fillStyle = '#fbf6ea';
      c.beginPath();
      c.moveTo(rx, ry - 30);
      c.lineTo(rx - 58, ry - 50);
      c.lineTo(rx - 56, ry - 82);
      c.lineTo(rx, ry - 64);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(rx, ry - 30);
      c.lineTo(rx + 58, ry - 50);
      c.lineTo(rx + 56, ry - 82);
      c.lineTo(rx, ry - 64);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(80,60,40,0.35)';
      c.lineWidth = 1;
      for (let k = 0; k < 5; k++) {
        c.beginPath();
        c.moveTo(rx - 8, ry - 62 + k * 6);
        c.lineTo(rx - 50, ry - 76 + k * 6);
        c.moveTo(rx + 8, ry - 62 + k * 6);
        c.lineTo(rx + 50, ry - 76 + k * 6);
        c.stroke();
      }
      // floor cushion
      const cx = w - Math.max(130, w * 0.2);
      c.fillStyle = '#1f5e66';
      roundRect(c, cx, h - 58, 150, 44, 18);
      c.fill();
      c.strokeStyle = '#d9b45c';
      c.lineWidth = 3;
      c.stroke();
    });

    const lanterns = arches.map((a) => ({ x: (a.x0 + a.x1) / 2, y: apex + h * 0.08, ph: rand(0, TAU) }));
    const doves = Array.from({ length: 3 }, () => ({ x: rand(w * 0.2, w * 0.8), y: rand(horizon + 20, floorY - 30), dir: Math.random() < 0.5 ? 1 : -1, peck: rand(0, TAU) }));
    let flyer = null;
    let nextFly = rand(6, 14);
    const region = { x: 0, y: apex, w, h: floorY - apex };
    const dust = motes(50, region);

    return {
      draw(c, t, dt) {
        c.drawImage(yard, 0, 0, w, h);
        // fountain jets
        c.strokeStyle = 'rgba(200,240,255,0.75)';
        c.lineWidth = 2;
        for (let k = 0; k < 4; k++) {
          const s = k % 2 ? 1 : -1;
          const reach = 30 + k * 6 + Math.sin(t * 3 + k) * 2;
          c.beginPath();
          c.moveTo(fx, fy - 44);
          c.quadraticCurveTo(fx + s * reach * 0.5, fy - 64 - k * 3, fx + s * reach, fy - 6);
          c.stroke();
        }
        // doves pecking and strolling on the marble
        for (const d of doves) {
          d.x += d.dir * 6 * dt;
          if (d.x < w * 0.1 || d.x > w * 0.9) d.dir *= -1;
          const bob = Math.max(0, Math.sin(t * 3 + d.peck)) * 4;
          c.fillStyle = '#9aa1ab';
          c.beginPath();
          c.ellipse(d.x, d.y - 6, 9, 6, 0, 0, TAU);
          c.fill();
          c.beginPath();
          c.arc(d.x + d.dir * 8, d.y - 11 + bob, 4, 0, TAU);
          c.fill();
          c.fillStyle = '#6d7480';
          c.beginPath();
          c.moveTo(d.x - d.dir * 8, d.y - 7);
          c.lineTo(d.x - d.dir * 16, d.y - 9);
          c.lineTo(d.x - d.dir * 8, d.y - 3);
          c.fill();
        }
        // now and then a dove flies across the sky
        nextFly -= dt;
        if (!flyer && nextFly <= 0) flyer = { x: -30, y: rand(h * 0.15, horizon - 80), v: rand(70, 110) };
        if (flyer) {
          flyer.x += flyer.v * dt;
          const f = Math.sin(t * 10) * 0.8;
          c.strokeStyle = '#f4f2ee';
          c.lineWidth = 2.5;
          c.beginPath();
          c.moveTo(flyer.x - 12, flyer.y - 9 * f);
          c.quadraticCurveTo(flyer.x - 5, flyer.y - 2, flyer.x, flyer.y);
          c.quadraticCurveTo(flyer.x + 5, flyer.y - 2, flyer.x + 12, flyer.y - 9 * f);
          c.stroke();
          if (flyer.x > w + 30) { flyer = null; nextFly = rand(10, 22); }
        }
        drawMotes(c, dust, region, t, dt, '#fff4d6', 0.45);
        c.drawImage(arcade, 0, 0, w, h);
        // hanging lanterns with a warm glow
        for (const l of lanterns) {
          const sway = Math.sin(t * 0.8 + l.ph) * 2.5;
          c.strokeStyle = '#5a4630';
          c.lineWidth = 1.5;
          c.beginPath();
          c.moveTo(l.x, apex);
          c.lineTo(l.x + sway, l.y);
          c.stroke();
          c.globalCompositeOperation = 'lighter';
          glow(c, l.x + sway, l.y + 22, 70, 'rgba(255,190,100,A)', 0.35);
          c.globalCompositeOperation = 'source-over';
          c.fillStyle = '#c9a24a';
          c.beginPath();
          c.moveTo(l.x + sway - 10, l.y + 6);
          c.lineTo(l.x + sway + 10, l.y + 6);
          c.lineTo(l.x + sway, l.y - 4);
          c.fill();
          c.fillStyle = '#ffd98a';
          c.beginPath();
          c.moveTo(l.x + sway - 11, l.y + 8);
          c.lineTo(l.x + sway + 11, l.y + 8);
          c.lineTo(l.x + sway + 8, l.y + 34);
          c.lineTo(l.x + sway - 8, l.y + 34);
          c.closePath();
          c.fill();
          c.strokeStyle = '#8a6b30';
          c.lineWidth = 1.5;
          c.stroke();
        }
      },
    };
  };

  // ======================================================================
  // ALAJEER HQ
  // ======================================================================
  scenes.alajeer = (w, h, dpr) => {
    const brand = FP.config.brand;
    const winTop = h * 0.1;
    const horizon = h * 0.5;
    const winBot = h * 0.7;
    const deskY = h * 0.85;
    const wallW = Math.max(150, w * 0.22);
    const towerX = w * 0.82;
    const turbines = [0.36, 0.52, 0.68].map((k) => ({ y: horizon - h * 0.26 * k, a: rand(0, TAU) }));
    const dhows = Array.from({ length: 2 }, () => ({ x: rand(wallW, w), y: rand(horizon + 12, winBot - 20), v: rand(4, 8) * (Math.random() < 0.5 ? 1 : -1), s: rand(0.7, 1.1) }));

    const outside = layer(w, h, dpr, (c) => {
      c.fillStyle = vGrad(c, winTop, horizon, [[0, '#24365e'], [0.55, '#8a5e78'], [0.85, '#ee9466'], [1, '#f8c584']]);
      c.fillRect(0, winTop, w, horizon - winTop);
      glow(c, w * 0.62, horizon, Math.max(w, h) * 0.35, 'rgba(255,175,110,A)', 0.55);
      // skyline
      let x = wallW;
      while (x < w) {
        const bw = rand(26, 70);
        const bh = rand(h * 0.05, h * 0.2);
        c.fillStyle = '#2c2a44';
        c.fillRect(x, horizon - bh, bw, bh);
        c.fillStyle = 'rgba(255,214,140,0.55)';
        for (let yy = horizon - bh + 6; yy < horizon - 6; yy += 9) for (let xx = x + 4; xx < x + bw - 4; xx += 8) if (Math.random() < 0.3) c.fillRect(xx, yy, 3, 4);
        x += bw + rand(4, 24);
      }
      // twin towers with a pair of sails, like the harbour's famous landmarks
      const fh = h * 0.3;
      [[w * 0.64, 0.9], [w * 0.69, 1]].forEach(([tx, k]) => {
        c.fillStyle = '#3a3a5a';
        c.fillRect(tx - 10, horizon - fh * k, 20, fh * k);
        c.fillStyle = 'rgba(160,210,255,0.35)';
        c.fillRect(tx - 6, horizon - fh * k + 8, 12, fh * k - 16);
      });
      // sail-shaped twin towers joined by bridges that carry wind turbines
      const th = h * 0.36;
      c.fillStyle = '#3d3f60';
      [-1, 1].forEach((s) => {
        c.beginPath();
        c.moveTo(towerX + s * 52, horizon);
        c.quadraticCurveTo(towerX + s * 46, horizon - th * 0.6, towerX + s * 12, horizon - th);
        c.lineTo(towerX + s * 6, horizon - th + 6);
        c.quadraticCurveTo(towerX + s * 22, horizon - th * 0.5, towerX + s * 18, horizon);
        c.closePath();
        c.fill();
      });
      turbines.forEach((tb) => {
        c.fillStyle = '#56597c';
        c.fillRect(towerX - 26, tb.y - 3, 52, 6);
      });
      // sea
      c.fillStyle = vGrad(c, horizon, winBot, [[0, '#2f5873'], [1, '#183248']]);
      c.fillRect(0, horizon, w, winBot - horizon);
    });

    const inside = layer(w, h, dpr, (c) => {
      c.fillStyle = vGrad(c, 0, winTop, [[0, '#14161d'], [1, '#22252f']]);
      c.fillRect(0, 0, w, winTop);
      for (let x = 40; x < w; x += 160) {
        c.fillStyle = 'rgba(235,245,255,0.8)';
        c.fillRect(x, winTop * 0.55, 110, 3);
      }
      c.fillStyle = '#1b1e26';
      c.fillRect(0, winTop - 4, w, 6);
      for (let x = wallW + 140; x < w; x += 220) c.fillRect(x - 4, winTop, 8, winBot - winTop);
      c.fillRect(0, winBot - 4, w, 6);
      // floor
      c.fillStyle = vGrad(c, winBot, deskY, [[0, '#3b3f48'], [1, '#262931']]);
      c.fillRect(0, winBot, w, deskY - winBot);
      c.fillStyle = vGrad(c, winBot, deskY, [[0, 'rgba(240,150,100,0.18)'], [1, 'rgba(240,150,100,0)']]);
      c.fillRect(wallW, winBot, w - wallW, deskY - winBot);
      // a row of team desks with glowing monitors
      for (let dx = wallW + 90; dx < w - 60; dx += 260) {
        c.fillStyle = '#d9dde4';
        c.fillRect(dx - 70, winBot + 30, 140, 6);
        c.fillStyle = '#1b1e26';
        c.fillRect(dx - 66, winBot + 36, 4, 34);
        c.fillRect(dx + 62, winBot + 36, 4, 34);
        c.fillRect(dx - 30, winBot - 4, 60, 34);
        c.fillStyle = '#2a3550';
        c.fillRect(dx - 27, winBot - 1, 54, 28);
        c.fillStyle = '#1b1e26';
        c.fillRect(dx - 3, winBot + 26, 6, 6);
      }
      // brand wall: dark slats with a backlit name and motto
      c.fillStyle = '#12141b';
      c.fillRect(0, 0, wallW, deskY);
      c.fillStyle = 'rgba(255,255,255,0.03)';
      for (let x = 8; x < wallW; x += 16) c.fillRect(x, 0, 6, deskY);
      c.fillStyle = brand.color;
      c.fillRect(wallW - 6, 0, 6, deskY);
      const size = Math.max(26, Math.min(54, wallW * 0.2));
      c.save();
      c.shadowColor = brand.color;
      c.shadowBlur = 24;
      c.fillStyle = '#ffffff';
      c.font = `800 ${size}px Inter, sans-serif`;
      c.textAlign = 'center';
      c.fillText(brand.name, wallW / 2, h * 0.36);
      c.restore();
      c.fillStyle = 'rgba(255,255,255,0.7)';
      c.font = `600 ${Math.max(9, size * 0.22)}px Inter, sans-serif`;
      c.textAlign = 'center';
      const words = brand.motto.toUpperCase().split(' ');
      const lines = [];
      let line = '';
      words.forEach((wd) => {
        const test = line ? `${line} ${wd}` : wd;
        if (c.measureText(test).width > wallW * 0.8) { lines.push(line); line = wd; } else line = test;
      });
      lines.push(line);
      lines.forEach((ln, i) => c.fillText(ln, wallW / 2, h * 0.36 + size * 0.7 + i * size * 0.34));
      c.textAlign = 'left';
      // plant at the base of the wall
      c.fillStyle = '#e8e3da';
      c.fillRect(wallW * 0.5 - 22, deskY - 54, 44, 54);
      c.fillStyle = '#3f8a4f';
      for (let i = 0; i < 7; i++) {
        c.save();
        c.translate(wallW * 0.5, deskY - 54);
        c.rotate(-Math.PI / 2 + (i - 3) * 0.32 + Math.PI / 2);
        c.beginPath();
        c.ellipse(0, -30, 7, 32, 0, 0, TAU);
        c.fill();
        c.restore();
      }
      // your desk: laptop and a branded mug
      c.fillStyle = vGrad(c, deskY, h, [[0, '#eceff3'], [0.06, '#cfd4dc'], [1, '#9aa1ad']]);
      c.fillRect(0, deskY, w, h - deskY);
      const lx = w - Math.max(150, w * 0.17);
      c.fillStyle = '#2b2f38';
      c.beginPath();
      c.moveTo(lx - 110, deskY + 40);
      c.lineTo(lx + 110, deskY + 40);
      c.lineTo(lx + 92, deskY + 12);
      c.lineTo(lx - 92, deskY + 12);
      c.fill();
      c.fillStyle = '#1b1e26';
      c.fillRect(lx - 92, deskY - 120, 184, 132);
      c.fillStyle = '#10131a';
      c.fillRect(lx - 84, deskY - 112, 168, 116);
      const code = ['#7fb0ff', '#ffd46b', '#9be08a', '#e6a4ff', '#ffffff'];
      for (let i = 0; i < 9; i++) {
        let cx = lx - 76 + (i % 3) * 10;
        for (let k = 0; k < 4; k++) {
          const len = rand(10, 36);
          if (cx + len > lx + 76) break;
          c.fillStyle = pick(code);
          c.globalAlpha = 0.8;
          c.fillRect(cx, deskY - 102 + i * 11, len, 4);
          cx += len + 6;
        }
      }
      c.globalAlpha = 1;
      const mx = wallW + Math.max(60, w * 0.06);
      c.fillStyle = '#ffffff';
      roundRect(c, mx - 24, deskY - 40, 48, 54, 8);
      c.fill();
      c.fillStyle = brand.color;
      c.fillRect(mx - 24, deskY - 22, 48, 12);
      c.strokeStyle = '#ffffff';
      c.lineWidth = 6;
      c.beginPath();
      c.arc(mx + 26, deskY - 12, 10, -Math.PI / 2, Math.PI / 2);
      c.stroke();
    });

    return {
      draw(c, t, dt) {
        c.drawImage(outside, 0, 0, w, h);
        // turbines turning between the sail towers
        c.strokeStyle = '#e8ecf4';
        c.lineWidth = 2;
        turbines.forEach((tb) => {
          tb.a += dt * 1.2;
          for (let k = 0; k < 3; k++) {
            const a = tb.a + (k * TAU) / 3;
            c.beginPath();
            c.moveTo(towerX, tb.y);
            c.lineTo(towerX + Math.cos(a) * 14, tb.y + Math.sin(a) * 14);
            c.stroke();
          }
        });
        // sea glints and drifting dhows
        for (let i = 0; i < 40; i++) {
          const gx = wallW + ((i * 97 + t * 8) % (w - wallW));
          const gy = horizon + 6 + ((i * 37) % (winBot - horizon - 10));
          c.fillStyle = `rgba(255,200,150,${0.2 + 0.2 * Math.sin(t * 2 + i)})`;
          c.fillRect(gx, gy, 10, 1.5);
        }
        dhows.forEach((d) => {
          d.x += d.v * dt;
          if (d.x > w + 40) d.x = wallW - 40;
          if (d.x < wallW - 40) d.x = w + 40;
          c.save();
          c.translate(d.x, d.y);
          c.scale(d.s, d.s);
          c.fillStyle = '#4a2f1f';
          c.beginPath();
          c.moveTo(-22, 0);
          c.lineTo(22, 0);
          c.lineTo(14, 7);
          c.lineTo(-16, 7);
          c.fill();
          c.fillStyle = '#f2e6cf';
          c.beginPath();
          c.moveTo(0, -2);
          c.lineTo(-4, -30);
          c.lineTo(18, -4);
          c.fill();
          c.restore();
        });
        c.drawImage(inside, 0, 0, w, h);
        // a softly updating chart on the team monitors
        for (let dx = wallW + 90; dx < w - 60; dx += 260) {
          c.strokeStyle = 'rgba(127,176,255,0.9)';
          c.lineWidth = 1.5;
          c.beginPath();
          for (let k = 0; k <= 10; k++) {
            const y = winBot + 18 - (Math.sin(k * 0.9 + t * 0.4 + dx) * 0.5 + 0.5) * 14;
            if (k === 0) c.moveTo(dx - 24 + k * 4.8, y);
            else c.lineTo(dx - 24 + k * 4.8, y);
          }
          c.stroke();
        }
        // blinking cursor on the laptop
        if (Math.sin(t * 4) > 0) {
          const lx = w - Math.max(150, w * 0.17);
          c.fillStyle = '#ffffff';
          c.fillRect(lx + 40, deskY - 14, 7, 10);
        }
      },
    };
  };
})();
