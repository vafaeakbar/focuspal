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
  // The official logo for the HQ wall; the name is drawn as text until it loads.
  const brandLogo = new Image();
  brandLogo.src = FP.config.brand.logo;
  // Make sure the Arabic tagline gets its brand typeface rather than a system fallback.
  if (document.fonts && document.fonts.load) document.fonts.load('400 16px "Noto Kufi Arabic"').catch(() => {});

  scenes.alajeer = (w, h, dpr) => {
    const brand = FP.config.brand;
    const winTop = h * 0.1;
    const horizon = h * 0.5;
    const winBot = h * 0.7;
    const deskY = h * 0.85;
    const wallW = Math.max(150, w * 0.22);
    // Stacked lockup is 1225 × 1956.
    const logoW = Math.min(wallW * 0.66, 220);
    const logo = { w: logoW, h: logoW * (1956 / 1225), x: (wallW - logoW) / 2, y: h * 0.14 };
    // The Arabic tagline is drawn live (below the English) so it picks up the web font once loaded.
    const taglineAr = { y: 0, size: 14 };
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
      // brand wall: Ink slats (the logo's dark-mode ground), a copper edge, the logo (drawn live) and the tagline
      c.fillStyle = '#14181F';
      c.fillRect(0, 0, wallW, deskY);
      c.fillStyle = 'rgba(242,237,227,0.03)';
      for (let x = 8; x < wallW; x += 16) c.fillRect(x, 0, 6, deskY);
      c.fillStyle = brand.accent;
      c.fillRect(wallW - 5, 0, 5, deskY);
      glow(c, wallW / 2, logo.y + logo.h * 0.45, logo.w * 0.9, 'rgba(184,115,51,A)', 0.18);
      const size = Math.max(26, Math.min(54, wallW * 0.2));
      c.fillStyle = 'rgba(242,237,227,0.78)';
      c.font = `500 ${Math.max(11, size * 0.27)}px Inter, sans-serif`;
      c.textAlign = 'center';
      const words = brand.tagline.split(' ');
      const lines = [];
      let line = '';
      words.forEach((wd) => {
        const test = line ? `${line} ${wd}` : wd;
        if (c.measureText(test).width > wallW * 0.8) { lines.push(line); line = wd; } else line = test;
      });
      lines.push(line);
      const lineH = Math.max(15, size * 0.38);
      lines.forEach((ln, i) => c.fillText(ln, wallW / 2, logo.y + logo.h + 24 + i * lineH));
      taglineAr.y = logo.y + logo.h + 24 + lines.length * lineH + 6;
      taglineAr.size = Math.max(12, size * 0.31);
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
      c.fillStyle = brand.accent;
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
        if (brandLogo.complete && brandLogo.naturalWidth) {
          c.drawImage(brandLogo, logo.x, logo.y, logo.w, logo.h);
        } else {
          c.fillStyle = '#F2EDE3';
          c.font = `800 ${Math.max(24, logo.w * 0.24)}px Inter, sans-serif`;
          c.textAlign = 'center';
          c.fillText(brand.name, wallW / 2, logo.y + logo.h * 0.6);
          c.textAlign = 'left';
        }
        c.fillStyle = 'rgba(242,237,227,0.78)';
        c.font = `400 ${taglineAr.size}px "Noto Kufi Arabic", sans-serif`;
        c.textAlign = 'center';
        c.direction = 'rtl';
        c.fillText(brand.taglineAr, wallW / 2, taglineAr.y);
        c.direction = 'ltr';
        c.textAlign = 'left';
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
  // ======================================================================
  // HENSON SITE OFFICE (in loving memory of the founder)
  // ======================================================================
  const hensonLogo = new Image();
  hensonLogo.src = FP.config.henson.logo;
  if (document.fonts && document.fonts.load) {
    ['700 20px "Libre Baskerville"', 'italic 400 16px "Libre Baskerville"', '600 16px Cairo'].forEach((f) => document.fonts.load(f).catch(() => {}));
  }

  scenes.henson = (w, h, dpr) => {
    const hc = FP.config.henson;
    const wallW = Math.max(180, w * 0.26);
    const winX0 = wallW + 26;
    const winX1 = w - Math.max(22, w * 0.03);
    const winY0 = h * 0.11;
    const winY1 = h * 0.64;
    const ww = winX1 - winX0;
    const wh = winY1 - winY0;
    const horizon = winY0 + wh * 0.7;
    const ground = horizon + (winY1 - horizon) * 0.35;
    const deskY = h * 0.82;

    // Company board on the left wall, then the dedication plaque under it.
    const board = { x: 22, y: h * 0.1, w: wallW - 44 };
    board.logo = Math.min(board.w * 0.5, 140);
    board.name = Math.max(15, Math.min(24, board.w * 0.1));
    let y = board.y + 18;
    board.logoY = y;
    y += board.logo + 12 + board.name;
    board.nameY = y;
    y += board.name * 1.45;
    board.arY = y;
    y += board.name * 0.62 + 14;
    board.mottoY = y;
    y += Math.max(10, board.name * 0.45) + 12;
    board.sinceY = y;
    board.h = y - board.y + 16;
    const plaque = { w: board.w * 0.94, h: 66, y: board.y + board.h + 22 };
    plaque.x = board.x + (board.w - plaque.w) / 2;

    // Crane geometry (outside, in page coordinates).
    const crane = { x: winX0 + ww * 0.6, top: winY0 + wh * 0.1, L: ww * 0.27 };
    crane.jibY = crane.top + 10;

    const view = layer(w, h, dpr, (c) => {
      c.save();
      c.beginPath();
      c.rect(winX0, winY0, ww, wh);
      c.clip();
      c.fillStyle = vGrad(c, winY0, horizon, [[0, '#1d2a4f'], [0.6, '#6b5a7e'], [0.9, '#e5875f'], [1, '#f3b47c']]);
      c.fillRect(winX0, winY0, ww, horizon - winY0);
      glow(c, winX0 + ww * 0.12, horizon, Math.max(ww, wh) * 0.45, 'rgba(255,170,110,A)', 0.45);
      // distant city
      let x = winX0;
      while (x < winX1) {
        const bw = rand(20, 60);
        const bh = rand(8, 46);
        c.fillStyle = '#2b2f4a';
        c.fillRect(x, horizon - bh, bw, bh);
        c.fillStyle = 'rgba(255,214,140,0.5)';
        for (let yy = horizon - bh + 5; yy < horizon - 4; yy += 8) for (let xx = x + 3; xx < x + bw - 3; xx += 7) if (Math.random() < 0.25) c.fillRect(xx, yy, 2.5, 3.5);
        x += bw + rand(6, 30);
      }
      // site ground
      c.fillStyle = vGrad(c, horizon, winY1, [[0, '#5e4c40'], [1, '#33291f']]);
      c.fillRect(winX0, horizon, ww, winY1 - horizon);
      // building going up: concrete frame, lit lower floors, open top floors with rebar
      const bx = winX0 + ww * 0.63;
      const bW = ww * 0.19;
      const floors = 8;
      const bTop = winY0 + wh * 0.3;
      const fh = (ground - bTop) / floors;
      for (let f = 0; f < floors; f++) {
        const fy = ground - (f + 1) * fh;
        if (f < 5) {
          for (let k = 0; k < 6; k++) {
            c.fillStyle = Math.random() < 0.35 ? 'rgba(255,217,138,0.75)' : 'rgba(120,150,190,0.35)';
            c.fillRect(bx + 4 + k * (bW / 6), fy + 4, bW / 6 - 6, fh - 8);
          }
        }
        c.fillStyle = '#7d8592';
        c.fillRect(bx - 4, fy + fh - 4, bW + 8, 4);
      }
      c.fillStyle = '#6a7280';
      for (let k = 0; k <= 6; k++) c.fillRect(bx + k * (bW / 6) - 2, bTop, 4, ground - bTop);
      c.strokeStyle = 'rgba(160,120,90,0.8)';
      c.lineWidth = 1;
      for (let k = 0; k <= 6; k++) {
        c.beginPath();
        c.moveTo(bx + k * (bW / 6), bTop);
        c.lineTo(bx + k * (bW / 6), bTop - 14);
        c.stroke();
      }
      // substation: gantries, wires, transformers and insulators
      const sx0 = winX0 + ww * 0.84;
      const sx1 = winX1 - 12;
      c.strokeStyle = '#9aa3b0';
      c.lineWidth = 3;
      [sx0 + 10, sx1 - 10].forEach((gx) => {
        c.beginPath();
        c.moveTo(gx - 16, ground);
        c.lineTo(gx - 16, ground - 78);
        c.moveTo(gx + 16, ground);
        c.lineTo(gx + 16, ground - 78);
        c.moveTo(gx - 22, ground - 72);
        c.lineTo(gx + 22, ground - 72);
        c.stroke();
      });
      c.lineWidth = 1.2;
      c.strokeStyle = 'rgba(30,30,40,0.8)';
      for (let k = -1; k <= 1; k++) {
        c.beginPath();
        c.moveTo(sx0 + 10 + k * 12, ground - 72);
        c.quadraticCurveTo((sx0 + sx1) / 2, ground - 60, sx1 - 10 + k * 12, ground - 72);
        c.stroke();
      }
      [sx0 + (sx1 - sx0) * 0.3, sx0 + (sx1 - sx0) * 0.65].forEach((tx) => {
        c.fillStyle = '#7d8794';
        c.fillRect(tx - 22, ground - 34, 44, 34);
        c.strokeStyle = 'rgba(0,0,0,0.25)';
        c.lineWidth = 1;
        for (let k = -18; k <= 18; k += 6) {
          c.beginPath();
          c.moveTo(tx + k, ground - 30);
          c.lineTo(tx + k, ground - 4);
          c.stroke();
        }
        c.fillStyle = '#c9cfd8';
        for (let k = -1; k <= 1; k++) for (let d = 0; d < 3; d++) {
          c.beginPath();
          c.ellipse(tx + k * 12, ground - 38 - d * 5, 4, 2, 0, 0, TAU);
          c.fill();
        }
      });
      // site fence with a Henson banner
      c.fillStyle = 'rgba(30,25,22,0.85)';
      for (let fx = winX0; fx < winX1; fx += 26) c.fillRect(fx, ground + 8, 3, winY1 - ground);
      c.fillStyle = 'rgba(210,210,210,0.12)';
      c.fillRect(winX0, ground + 10, ww, winY1 - ground);
      const banX = winX0 + ww * 0.12;
      c.fillStyle = hc.navy;
      c.fillRect(banX, ground + 14, 120, 22);
      c.fillStyle = hc.red;
      c.fillRect(banX, ground + 32, 120, 4);
      c.fillStyle = '#ffffff';
      c.font = '700 11px "Libre Baskerville", Georgia, serif';
      c.fillText('HENSON W.L.L.', banX + 10, ground + 29);
      // floodlight poles
      [winX0 + ww * 0.56, winX0 + ww * 0.9].forEach((px) => {
        c.fillStyle = '#2a2a33';
        c.fillRect(px - 2, ground - 96, 4, 96 + 10);
        c.fillRect(px - 12, ground - 100, 24, 6);
      });
      // tower crane (static parts)
      c.strokeStyle = '#e0a03a';
      c.lineWidth = 2.5;
      c.beginPath();
      c.moveTo(crane.x - 6, ground);
      c.lineTo(crane.x - 6, crane.top);
      c.moveTo(crane.x + 6, ground);
      c.lineTo(crane.x + 6, crane.top);
      for (let yy = ground; yy > crane.top + 12; yy -= 16) {
        c.moveTo(crane.x - 6, yy);
        c.lineTo(crane.x + 6, yy - 8);
        c.lineTo(crane.x - 6, yy - 16);
      }
      c.moveTo(crane.x - crane.L * 0.35, crane.jibY);
      c.lineTo(crane.x + crane.L, crane.jibY);
      c.moveTo(crane.x - crane.L * 0.35, crane.jibY + 7);
      c.lineTo(crane.x + crane.L, crane.jibY + 7);
      for (let jx = crane.x - crane.L * 0.35; jx < crane.x + crane.L; jx += 12) {
        c.moveTo(jx, crane.jibY + 7);
        c.lineTo(jx + 6, crane.jibY);
        c.lineTo(jx + 12, crane.jibY + 7);
      }
      c.stroke();
      c.strokeStyle = 'rgba(224,160,58,0.7)';
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(crane.x, crane.top - 22);
      c.lineTo(crane.x + crane.L * 0.7, crane.jibY);
      c.moveTo(crane.x, crane.top - 22);
      c.lineTo(crane.x - crane.L * 0.33, crane.jibY);
      c.stroke();
      c.fillStyle = '#e0a03a';
      c.beginPath();
      c.moveTo(crane.x - 6, crane.top);
      c.lineTo(crane.x, crane.top - 24);
      c.lineTo(crane.x + 6, crane.top);
      c.fill();
      c.fillStyle = '#5a6372';
      c.fillRect(crane.x - crane.L * 0.35, crane.jibY + 7, 26, 18);
      c.fillStyle = '#d8dde5';
      c.fillRect(crane.x + 7, crane.jibY + 8, 14, 12);
      c.restore();
    });

    const room = layer(w, h, dpr, (c) => {
      // portacabin walls with panel seams
      c.fillStyle = vGrad(c, 0, deskY, [[0, '#cfcabd'], [1, '#b9b2a2']]);
      c.fillRect(0, 0, w, deskY);
      c.fillStyle = 'rgba(0,0,0,0.07)';
      for (let x = 0; x < w; x += 120) c.fillRect(x, 0, 2, deskY);
      // window cut-out and aluminium frame
      c.clearRect(winX0, winY0, ww, wh);
      c.strokeStyle = '#ecebe6';
      c.lineWidth = 10;
      c.strokeRect(winX0 - 5, winY0 - 5, ww + 10, wh + 10);
      c.fillStyle = '#ecebe6';
      [1, 2].forEach((k) => c.fillRect(winX0 + (ww * k) / 3 - 3, winY0, 6, wh));
      c.fillStyle = 'rgba(0,0,0,0.12)';
      c.fillRect(winX0 - 10, winY1 + 5, ww + 20, 6);
      // company board and memorial plaque (text and logo are drawn live)
      c.fillStyle = 'rgba(0,0,0,0.15)';
      roundRect(c, board.x + 4, board.y + 6, board.w, board.h, 10);
      c.fill();
      c.fillStyle = '#f8f7f3';
      roundRect(c, board.x, board.y, board.w, board.h, 10);
      c.fill();
      c.strokeStyle = hc.navy;
      c.lineWidth = 3;
      c.stroke();
      c.fillStyle = hc.red;
      c.fillRect(board.x + 10, board.y, board.w - 20, 5);
      const pg = c.createLinearGradient(plaque.x, 0, plaque.x + plaque.w, 0);
      pg.addColorStop(0, '#9c7a3e');
      pg.addColorStop(0.5, '#d8b56e');
      pg.addColorStop(1, '#9c7a3e');
      c.fillStyle = pg;
      roundRect(c, plaque.x, plaque.y, plaque.w, plaque.h, 6);
      c.fill();
      c.strokeStyle = '#6e5426';
      c.lineWidth = 2;
      roundRect(c, plaque.x + 4, plaque.y + 4, plaque.w - 8, plaque.h - 8, 4);
      c.stroke();
      // desk with blueprints, a hard hat and a mug
      c.fillStyle = vGrad(c, deskY, h, [[0, '#7a5a3e'], [1, '#4a3424']]);
      c.fillRect(0, deskY, w, h - deskY);
      c.fillStyle = 'rgba(255,230,200,0.25)';
      c.fillRect(0, deskY, w, 2);
      c.save();
      c.translate(w * 0.62, deskY + (h - deskY) * 0.55);
      c.rotate(-0.04);
      const pw = Math.min(380, w * 0.3);
      const ph = (h - deskY) * 0.8;
      c.fillStyle = '#2f5d9c';
      c.fillRect(-pw / 2, -ph / 2, pw, ph);
      c.strokeStyle = 'rgba(255,255,255,0.18)';
      c.lineWidth = 1;
      for (let gx = -pw / 2; gx < pw / 2; gx += 14) { c.beginPath(); c.moveTo(gx, -ph / 2); c.lineTo(gx, ph / 2); c.stroke(); }
      for (let gy = -ph / 2; gy < ph / 2; gy += 14) { c.beginPath(); c.moveTo(-pw / 2, gy); c.lineTo(pw / 2, gy); c.stroke(); }
      c.strokeStyle = 'rgba(255,255,255,0.85)';
      c.lineWidth = 1.6;
      c.strokeRect(-pw * 0.3, -ph * 0.32, pw * 0.42, ph * 0.6);
      c.strokeRect(-pw * 0.3, -ph * 0.32, pw * 0.2, ph * 0.3);
      c.beginPath();
      c.arc(pw * 0.25, 0, ph * 0.22, 0, TAU);
      c.moveTo(pw * 0.25 - ph * 0.3, 0);
      c.lineTo(pw * 0.25 + ph * 0.3, 0);
      c.stroke();
      c.fillStyle = '#e9e4d6';
      c.fillRect(pw / 2 - 6, -ph / 2, 14, ph);
      c.restore();
      const hx = Math.max(70, wallW * 0.42);
      const hy = deskY + (h - deskY) * 0.62;
      c.fillStyle = 'rgba(0,0,0,0.25)';
      c.beginPath();
      c.ellipse(hx + 6, hy + 10, 62, 10, 0, 0, TAU);
      c.fill();
      c.fillStyle = '#f4f2ec';
      c.beginPath();
      c.ellipse(hx, hy + 4, 60, 9, 0, 0, TAU);
      c.fill();
      c.beginPath();
      c.arc(hx, hy, 44, Math.PI, TAU);
      c.fill();
      c.fillStyle = hc.red;
      c.fillRect(hx - 5, hy - 44, 10, 44);
      c.fillStyle = hc.navy;
      c.fillRect(hx - 44, hy - 4, 88, 5);
      const mx = wallW + Math.max(50, w * 0.05);
      c.fillStyle = hc.navy;
      roundRect(c, mx - 22, deskY + 8, 44, 50, 7);
      c.fill();
      c.fillStyle = hc.red;
      c.fillRect(mx - 22, deskY + 26, 44, 8);
    });

    const lamp = { x: w - Math.max(110, w * 0.09), y: deskY - 6 };
    let lightT = 0;

    return {
      draw(c, t, dt) {
        c.drawImage(view, 0, 0, w, h);
        c.save();
        c.beginPath();
        c.rect(winX0, winY0, ww, wh);
        c.clip();
        // floodlight cones
        c.globalCompositeOperation = 'lighter';
        [winX0 + ww * 0.56, winX0 + ww * 0.9].forEach((px) => {
          const g = c.createLinearGradient(0, ground - 96, 0, ground + 30);
          g.addColorStop(0, 'rgba(255,214,150,0.35)');
          g.addColorStop(1, 'rgba(255,214,150,0)');
          c.fillStyle = g;
          c.beginPath();
          c.moveTo(px - 10, ground - 94);
          c.lineTo(px + 10, ground - 94);
          c.lineTo(px + 70, ground + 30);
          c.lineTo(px - 70, ground + 30);
          c.fill();
        });
        c.globalCompositeOperation = 'source-over';
        // crane trolley, cable and a slowly swaying steel beam
        const tx = crane.x + crane.L * (0.25 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.1)));
        const drop = 40 + (0.5 + 0.5 * Math.sin(t * 0.07 + 1)) * (ground - crane.jibY - 120);
        const sway = Math.sin(t * 0.6) * 0.04;
        c.fillStyle = '#3b4a5a';
        c.fillRect(tx - 6, crane.jibY + 7, 12, 5);
        c.strokeStyle = 'rgba(40,40,48,0.9)';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(tx, crane.jibY + 12);
        c.lineTo(tx + Math.sin(sway) * drop, crane.jibY + 12 + drop);
        c.stroke();
        c.save();
        c.translate(tx + Math.sin(sway) * drop, crane.jibY + 12 + drop);
        c.rotate(sway);
        c.fillStyle = '#3b4a5a';
        c.fillRect(-2, 0, 4, 6);
        c.fillStyle = hc.navy;
        c.fillRect(-26, 6, 52, 6);
        c.restore();
        // aviation lights
        lightT += dt;
        if (Math.sin(lightT * 3) > 0.4) {
          c.globalCompositeOperation = 'lighter';
          glow(c, crane.x, crane.top - 26, 8, 'rgba(255,60,60,A)', 0.9);
          glow(c, crane.x + crane.L, crane.jibY, 7, 'rgba(255,60,60,A)', 0.9);
          c.globalCompositeOperation = 'source-over';
        }
        c.restore();

        c.drawImage(room, 0, 0, w, h);
        // company board
        if (hensonLogo.complete && hensonLogo.naturalWidth) {
          c.drawImage(hensonLogo, board.x + (board.w - board.logo) / 2, board.logoY, board.logo, board.logo);
        }
        const cx = board.x + board.w / 2;
        c.textAlign = 'center';
        c.fillStyle = hc.navy;
        c.font = `700 ${board.name}px "Libre Baskerville", Georgia, serif`;
        c.fillText(hc.name, cx, board.nameY);
        c.direction = 'rtl';
        c.font = `600 ${board.name * 0.85}px Cairo, sans-serif`;
        c.fillText(hc.nameAr, cx, board.arY);
        c.direction = 'ltr';
        c.fillStyle = hc.red;
        c.font = `italic 400 ${board.name * 0.62}px "Libre Baskerville", Georgia, serif`;
        c.fillText(hc.motto, cx, board.mottoY);
        c.fillStyle = '#6e685f';
        c.font = `600 ${Math.max(10, board.name * 0.45)}px Inter, sans-serif`;
        c.fillText(hc.since.toUpperCase(), cx, board.sinceY);
        // memorial plaque
        const pcx = plaque.x + plaque.w / 2;
        c.fillStyle = '#3a2a10';
        c.font = `italic 400 ${Math.max(10, Math.min(14, plaque.w * 0.068))}px "Libre Baskerville", Georgia, serif`;
        c.fillText(hc.dedication, pcx, plaque.y + 27);
        c.direction = 'rtl';
        c.font = `600 ${Math.max(11, Math.min(15, plaque.w * 0.075))}px Cairo, sans-serif`;
        c.fillText(hc.dedicationAr, pcx, plaque.y + 50);
        c.direction = 'ltr';
        c.textAlign = 'left';
        // desk lamp: weighted base, two-part arm, shade angled down at the plans
        const base = { x: lamp.x, y: lamp.y + 44 };
        const elbow = { x: lamp.x + 10, y: lamp.y - 60 };
        const head = { x: lamp.x - 58, y: lamp.y - 92 };
        c.fillStyle = '#2b2f3a';
        c.beginPath();
        c.ellipse(base.x, base.y, 30, 8, 0, 0, TAU);
        c.fill();
        c.strokeStyle = '#2b2f3a';
        c.lineWidth = 6;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(base.x, base.y - 4);
        c.lineTo(elbow.x, elbow.y);
        c.lineTo(head.x, head.y);
        c.stroke();
        c.fillStyle = hc.red;
        c.beginPath();
        c.arc(elbow.x, elbow.y, 5, 0, TAU);
        c.fill();
        c.save();
        c.translate(head.x, head.y);
        c.rotate(-0.55);
        c.fillStyle = hc.navy;
        c.beginPath();
        c.moveTo(-8, -6);
        c.lineTo(8, -6);
        c.lineTo(24, 30);
        c.lineTo(-24, 30);
        c.closePath();
        c.fill();
        c.fillStyle = 'rgba(255,236,190,0.95)';
        c.beginPath();
        c.ellipse(0, 30, 22, 5, 0, 0, TAU);
        c.fill();
        c.restore();
        c.globalCompositeOperation = 'lighter';
        glow(c, head.x - 40, deskY + (h - deskY) * 0.5, 170, 'rgba(255,205,140,A)', 0.24);
        c.globalCompositeOperation = 'source-over';
      },
    };
  };

  // ======================================================================
  // OASIS SPA (a domed steam room)
  // ======================================================================
  // Eight-pointed star outline, used for the skylights cut into the dome.
  function starPath(c, x, y, r) {
    c.beginPath();
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * TAU - Math.PI / 2;
      const rr = k % 2 ? r * 0.55 : r;
      c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    c.closePath();
  }

  scenes.spa = (w, h, dpr) => {
    const spring = h * 0.26;
    const floorY = h * 0.76;
    const side = Math.max(70, w * 0.16);
    const nicheL = { x0: side * 0.35, x1: side * 0.35 + Math.max(90, w * 0.13) };
    const nicheR = { x0: w - side * 0.35 - Math.max(90, w * 0.13), x1: w - side * 0.35 };
    const bx = (nicheL.x0 + nicheL.x1) / 2;
    const by = floorY - 6;
    const tapY = floorY - h * 0.17;
    // skylights spread across the dome, avoiding the very centre (the timer sits below it)
    const lights = [];
    const rows = [[0.05, 7], [0.13, 6], [0.2, 5]];
    rows.forEach(([fy, n], ri) => {
      for (let i = 0; i < n; i++) {
        const fx = (i + 0.5) / n;
        lights.push({ x: w * (0.06 + fx * 0.88), y: h * fy, r: Math.max(5, Math.min(w, h) * (0.012 - ri * 0.002)), ph: rand(0, TAU) });
      }
    });

    const room = layer(w, h, dpr, (c) => {
      // the dome: warm plaster darkening towards the top
      c.fillStyle = vGrad(c, 0, spring, [[0, '#6e5040'], [1, '#b58d6c']]);
      c.fillRect(0, 0, w, spring + 2);
      // ribs of the dome converging above the room
      c.strokeStyle = 'rgba(70,45,30,0.25)';
      c.lineWidth = 2;
      for (let i = -6; i <= 6; i++) {
        c.beginPath();
        c.moveTo(w / 2 + i * w * 0.1, spring);
        c.quadraticCurveTo(w / 2 + i * w * 0.05, spring * 0.4, w / 2, -h * 0.2);
        c.stroke();
      }
      // star skylights, glowing with daylight
      for (const l of lights) {
        glow(c, l.x, l.y, l.r * 5, 'rgba(255,244,214,A)', 0.35);
        c.fillStyle = '#fff8e6';
        starPath(c, l.x, l.y, l.r);
        c.fill();
      }
      // springline cornice
      c.fillStyle = '#8f6a4f';
      c.fillRect(0, spring - 4, w, 10);
      c.fillStyle = 'rgba(255,235,200,0.35)';
      c.fillRect(0, spring + 6, w, 2);
      // stone walls
      c.fillStyle = vGrad(c, spring + 6, floorY, [[0, '#e6cba9'], [1, '#d3ae88']]);
      c.fillRect(0, spring + 6, w, floorY - spring - 6);
      c.strokeStyle = 'rgba(120,85,55,0.12)';
      c.lineWidth = 1;
      for (let y = spring + 40, row = 0; y < floorY; y += 34, row++) {
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(w, y);
        c.stroke();
        for (let x = (row % 2) * 60; x < w; x += 120) {
          c.beginPath();
          c.moveTo(x, y - 34);
          c.lineTo(x, y);
          c.stroke();
        }
      }
      // mosaic frieze and dado
      const tile = starTile(30, '#1f6f78', '#f1e6cc', '#c4543c');
      const friezeY = spring + h * 0.06;
      c.fillStyle = c.createPattern(tile, 'repeat');
      c.fillRect(0, friezeY, w, 30);
      c.fillStyle = '#8f6a4f';
      c.fillRect(0, friezeY - 3, w, 3);
      c.fillRect(0, friezeY + 30, w, 3);
      const dadoTop = floorY - h * 0.12;
      c.fillStyle = c.createPattern(starTile(36, '#2a7f86', '#eef3ee', '#d7a54b'), 'repeat');
      c.fillRect(0, dadoTop, w, floorY - dadoTop);
      c.fillStyle = '#e9dcc4';
      c.fillRect(0, dadoTop - 6, w, 6);
      // two arched niches in the side walls
      [nicheL, nicheR].forEach((n) => {
        const apex = friezeY + 50;
        const sp = apex + (n.x1 - n.x0) * 0.6;
        c.fillStyle = vGrad(c, apex, floorY, [[0, '#9c7556'], [1, '#b98f6c']]);
        c.beginPath();
        archPath(c, n.x0, n.x1, apex, sp, floorY);
        c.fill();
        c.strokeStyle = '#7a5a40';
        c.lineWidth = 5;
        c.beginPath();
        archPath(c, n.x0, n.x1, apex, sp, floorY);
        c.stroke();
        glow(c, (n.x0 + n.x1) / 2, sp, (n.x1 - n.x0) * 0.9, 'rgba(255,190,120,A)', 0.22);
      });
      // marble floor with perspective joints
      c.fillStyle = vGrad(c, floorY, h, [[0, '#e9dfcf'], [1, '#f6f0e6']]);
      c.fillRect(0, floorY, w, h - floorY);
      c.strokeStyle = 'rgba(140,115,90,0.22)';
      for (let i = -14; i <= 14; i++) {
        c.beginPath();
        c.moveTo(w / 2 + i * 34, floorY);
        c.lineTo(w / 2 + i * 220, h);
        c.stroke();
      }
      for (let k = 1; k < 5; k++) {
        const y = floorY + (h - floorY) * Math.pow(k / 5, 1.5);
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(w, y);
        c.stroke();
      }
      c.fillStyle = 'rgba(0,0,0,0.12)';
      c.fillRect(0, floorY, w, 4);
      // the heated marble platform in the middle of the room
      const px = w / 2, py = floorY + (h - floorY) * 0.55, prx = Math.min(w * 0.3, 360), pry = (h - floorY) * 0.28;
      c.fillStyle = '#cfc2ad';
      c.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU + Math.PI / 8;
        c.lineTo(px + Math.cos(a) * prx, py + 12 + Math.sin(a) * pry);
      }
      c.fill();
      c.fillStyle = '#f4ede1';
      c.beginPath();
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU + Math.PI / 8;
        c.lineTo(px + Math.cos(a) * prx, py + Math.sin(a) * pry);
      }
      c.fill();
      c.strokeStyle = 'rgba(160,135,105,0.35)';
      c.lineWidth = 1.5;
      c.save();
      c.translate(px, py);
      c.scale(1, pry / prx);
      c.translate(-px, -py);
      starPath(c, px, py, prx * 0.4);
      c.restore();
      c.stroke();
      // marble basin (kurna) with a brass tap, in the left niche
      c.fillStyle = 'rgba(60,40,25,0.18)';
      c.beginPath();
      c.ellipse(bx + 4, by + 6, 62, 12, 0, 0, TAU);
      c.fill();
      c.fillStyle = '#f2ece2';
      c.beginPath();
      c.moveTo(bx - 56, by - 40);
      c.quadraticCurveTo(bx - 52, by + 4, bx, by + 4);
      c.quadraticCurveTo(bx + 52, by + 4, bx + 56, by - 40);
      c.closePath();
      c.fill();
      c.fillStyle = '#d9cfbf';
      c.beginPath();
      c.ellipse(bx, by - 40, 56, 11, 0, 0, TAU);
      c.fill();
      c.fillStyle = '#7cc6c0';
      c.beginPath();
      c.ellipse(bx, by - 39, 46, 7, 0, 0, TAU);
      c.fill();
      c.strokeStyle = '#b8892f';
      c.lineWidth = 6;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(bx - 4, tapY - 24);
      c.lineTo(bx - 4, tapY);
      c.quadraticCurveTo(bx - 4, tapY + 8, bx + 8, tapY + 8);
      c.stroke();
      c.fillStyle = '#d9a64a';
      c.beginPath();
      c.arc(bx - 4, tapY - 26, 7, 0, TAU);
      c.fill();
      // rolled towels and a eucalyptus plant in the right niche
      const tx = (nicheR.x0 + nicheR.x1) / 2;
      c.fillStyle = '#8a6440';
      c.fillRect(nicheR.x0 + 10, floorY - h * 0.2, nicheR.x1 - nicheR.x0 - 20, 7);
      const tr = Math.max(9, (nicheR.x1 - nicheR.x0) * 0.1);
      const towels = ['#f7f4ee', '#9fd3c7', '#f7f4ee', '#e7b7a0', '#f7f4ee', '#9fd3c7'];
      let ti = 0;
      for (let row = 0; row < 3; row++) {
        for (let i = 0; i < 3 - row; i++) {
          const x = tx + (i - (2 - row) / 2) * tr * 2.1;
          const y = floorY - h * 0.2 - tr - row * tr * 1.8;
          c.fillStyle = towels[ti++ % towels.length];
          c.beginPath();
          c.arc(x, y, tr, 0, TAU);
          c.fill();
          c.strokeStyle = 'rgba(90,70,50,0.25)';
          c.lineWidth = 1.5;
          c.beginPath();
          c.arc(x, y, tr * 0.55, 0, TAU * 0.8);
          c.stroke();
        }
      }
      const potX = nicheR.x1 - 6, potY = floorY + 30;
      c.fillStyle = '#b5603d';
      c.beginPath();
      c.moveTo(potX - 22, potY - 34);
      c.lineTo(potX + 22, potY - 34);
      c.lineTo(potX + 16, potY);
      c.lineTo(potX - 16, potY);
      c.fill();
      c.strokeStyle = '#6f8f6a';
      c.lineWidth = 2;
      c.fillStyle = '#8fb59a';
      for (let i = 0; i < 6; i++) {
        const ang = -Math.PI / 2 + (i - 2.5) * 0.28;
        const len = rand(60, 95);
        const ex = potX + Math.cos(ang) * len, ey = potY - 34 + Math.sin(ang) * len;
        c.beginPath();
        c.moveTo(potX, potY - 34);
        c.quadraticCurveTo(potX + Math.cos(ang) * len * 0.5 + 6, potY - 34 + Math.sin(ang) * len * 0.5, ex, ey);
        c.stroke();
        for (let k = 1; k <= 5; k++) {
          const f = k / 6;
          const lx = potX + (ex - potX) * f, ly = potY - 34 + (ey - potY + 34) * f;
          c.beginPath();
          c.ellipse(lx, ly, 6, 4.5, ang, 0, TAU);
          c.fill();
        }
      }
    });

    // light shafts falling from the skylights
    const shafts = lights.filter((_, i) => i % 3 === 1).map((l) => ({ x: l.x, y: l.y, ph: rand(0, TAU) }));
    const shaftLen = floorY - spring + h * 0.15;
    const candles = [
      { x: nicheR.x0 - 24, y: floorY + 22 }, { x: nicheR.x0 - 6, y: floorY + 34 },
      { x: nicheL.x1 + 26, y: floorY + 28 }, { x: w / 2 - Math.min(w * 0.3, 360) * 0.8, y: floorY + (h - floorY) * 0.6 },
      { x: w / 2 + Math.min(w * 0.3, 360) * 0.8, y: floorY + (h - floorY) * 0.6 },
    ].map((cd) => ({ ...cd, ph: rand(0, TAU) }));
    const puff = sprite(64, [[0, 'rgba(255,255,255,0.55)'], [0.5, 'rgba(255,255,255,0.2)'], [1, 'rgba(255,255,255,0)']]);
    const steam = Array.from({ length: 22 }, () => newPuff(true));
    function newPuff(scatter) {
      const fromBasin = Math.random() < 0.3;
      const y0 = fromBasin ? by - 40 : rand(floorY + 10, h);
      return {
        x: fromBasin ? bx + rand(-30, 30) : rand(0, w), y: scatter ? rand(spring, y0) : y0, y0,
        vy: rand(8, 16), drift: rand(-6, 6), r: rand(40, 90), grow: rand(6, 14), ph: rand(0, TAU),
      };
    }
    const dust = motes(40, { x: 0, y: spring, w, h: floorY - spring });
    const ripples = [];
    let nextRipple = 0;

    return {
      draw(c, t, dt) {
        c.drawImage(room, 0, 0, w, h);
        // shafts of daylight, slowly breathing
        c.globalCompositeOperation = 'lighter';
        for (const s of shafts) {
          const a = 0.06 + 0.03 * Math.sin(t * 0.25 + s.ph);
          const g = c.createLinearGradient(s.x, s.y, s.x + shaftLen * 0.35, s.y + shaftLen);
          g.addColorStop(0, `rgba(255,240,205,${a})`);
          g.addColorStop(1, 'rgba(255,240,205,0)');
          c.fillStyle = g;
          c.beginPath();
          c.moveTo(s.x - 8, s.y);
          c.lineTo(s.x + 8, s.y);
          c.lineTo(s.x + shaftLen * 0.35 + 60, s.y + shaftLen);
          c.lineTo(s.x + shaftLen * 0.35 - 40, s.y + shaftLen);
          c.closePath();
          c.fill();
        }
        c.globalCompositeOperation = 'source-over';
        drawMotes(c, dust, { x: 0, y: spring, w, h: floorY - spring }, t, dt, '#fff4dc', 0.35);
        // water falling from the tap into the basin, with rings on the surface
        c.strokeStyle = 'rgba(210,240,245,0.8)';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(bx + 9, tapY + 9);
        for (let k = 1; k <= 8; k++) {
          const f = k / 8;
          c.lineTo(bx + 9 + Math.sin(t * 9 + k) * 0.8, tapY + 9 + (by - 40 - tapY - 9) * f);
        }
        c.stroke();
        nextRipple -= dt;
        if (nextRipple <= 0) { ripples.push({ age: 0 }); nextRipple = 0.7; }
        for (let i = ripples.length - 1; i >= 0; i--) {
          const r = ripples[i];
          r.age += dt;
          if (r.age > 2.2) { ripples.splice(i, 1); continue; }
          c.strokeStyle = `rgba(255,255,255,${0.5 * (1 - r.age / 2.2)})`;
          c.lineWidth = 1.2;
          c.beginPath();
          c.ellipse(bx + 9, by - 39, 4 + r.age * 17, 1 + r.age * 2.6, 0, 0, TAU);
          c.stroke();
        }
        // candles
        for (const cd of candles) {
          const fl = 0.85 + 0.15 * Math.sin(t * 7 + cd.ph) * Math.sin(t * 3.1 + cd.ph * 2);
          c.globalCompositeOperation = 'lighter';
          glow(c, cd.x, cd.y - 22, 46 * fl, 'rgba(255,170,80,A)', 0.4);
          c.globalCompositeOperation = 'source-over';
          c.fillStyle = '#f7efe0';
          c.fillRect(cd.x - 7, cd.y - 18, 14, 18);
          c.fillStyle = '#e8dcc6';
          c.beginPath();
          c.ellipse(cd.x, cd.y - 18, 7, 2.5, 0, 0, TAU);
          c.fill();
          c.fillStyle = '#ffcf6b';
          c.beginPath();
          c.ellipse(cd.x + Math.sin(t * 5 + cd.ph) * 0.8, cd.y - 25, 2.6, 6 * fl, 0, 0, TAU);
          c.fill();
        }
        // steam rising and fading
        for (let i = 0; i < steam.length; i++) {
          const p = steam[i];
          p.y -= p.vy * dt;
          p.x += (p.drift + Math.sin(t * 0.4 + p.ph) * 5) * dt;
          p.r += p.grow * dt;
          const life = (p.y0 - p.y) / (p.y0 - spring);
          if (life >= 1) { steam[i] = newPuff(false); continue; }
          c.globalAlpha = Math.sin(Math.min(1, Math.max(0, life)) * Math.PI) * 0.32;
          c.drawImage(puff, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
        }
        c.globalAlpha = 1;
      },
    };
  };

  // ======================================================================
  // VEHICLES (bus, train, plane): scenery moves on the same clock as the sound
  // ======================================================================
  const STOPS = ['Bab Al Bahrain', 'Manama Souq', 'Adliya', 'Juffair', 'Seef', 'Muharraq', 'Isa Town', 'Riffa', 'Budaiya', 'Hoora'];

  // A strip of scenery `tw` wide that repeats; drawn twice to wrap around.
  function strip(c, img, tw, offset, y) {
    const x = -(((offset % tw) + tw) % tw);
    c.drawImage(img, x, y, tw, img.height / (img.width / tw));
    c.drawImage(img, x + tw, y, tw, img.height / (img.width / tw));
  }

  function palmTree(c, x, base, s) {
    c.strokeStyle = '#7b5a3a';
    c.lineWidth = 6 * s;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x, base);
    c.quadraticCurveTo(x + 8 * s, base - 70 * s, x + 4 * s, base - 130 * s);
    c.stroke();
    c.fillStyle = '#3e8a4c';
    for (let i = 0; i < 7; i++) {
      c.save();
      c.translate(x + 4 * s, base - 130 * s);
      c.rotate(-Math.PI / 2 + (i - 3) * 0.5);
      c.beginPath();
      c.ellipse(0, -30 * s, 6 * s, 32 * s, 0, 0, TAU);
      c.fill();
      c.restore();
    }
  }

  scenes.bus = (w, h, dpr) => {
    const PX = Math.max(220, w * 0.2);
    const y0 = h * 0.2;
    const y1 = h * 0.64;
    const winH = y1 - y0;
    const pillarW = 24;
    const pane = Math.max(240, w / 3.3);
    const panes = [];
    for (let x = -pane * 0.4; x < w; x += pane) panes.push([x + pillarW / 2, Math.min(w, x + pane - pillarW / 2)]);
    const stopX = w * 0.8;
    const ground = y1 - winH * 0.12;
    // distance travelled along the 80-second loop, for placing the stop shelter
    const STEP = 0.05;
    const cum = [0];
    for (let i = 1; i <= 80 / STEP; i++) cum[i] = cum[i - 1] + FP.ride.bus(i * STEP).speed * PX * STEP;
    const at = (c) => cum[Math.min(cum.length - 1, Math.round(c / STEP))];

    const skyline = layer(1800, winH, 1, (c) => {
      c.fillStyle = '#a9bccb';
      let x = 0;
      while (x < 1800) {
        const bw = rand(40, 90), bh = rand(winH * 0.2, winH * 0.55);
        c.fillRect(x, winH * 0.75 - bh, bw, bh + winH * 0.25);
        x += bw + rand(10, 50);
      }
      // twin sail towers joined by bridges, a Manama landmark
      const tx = 900, base = winH * 0.75, th = winH * 0.72;
      c.fillStyle = '#93a9bb';
      // two sails leaning towards each other
      [[0, 1], [96, -1]].forEach(([ox, d]) => {
        const x = tx + ox;
        c.beginPath();
        c.moveTo(x, base);
        c.lineTo(x + 26 * d, base);
        c.quadraticCurveTo(x + 18 * d, base - th * 0.6, x + 28 * d, base - th);
        c.quadraticCurveTo(x - 2 * d, base - th * 0.5, x, base);
        c.fill();
      });
      c.strokeStyle = '#93a9bb';
      c.lineWidth = 5;
      [0.3, 0.5, 0.7].forEach((f) => {
        c.beginPath();
        c.moveTo(tx + 20, base - th * f);
        c.lineTo(tx + 76, base - th * f);
        c.stroke();
        c.fillStyle = '#c8d4dd';
        c.beginPath();
        c.arc(tx + 48, base - th * f, 7, 0, TAU);
        c.fill();
      });
    });
    const town = layer(1400, winH, 1, (c) => {
      let x = 0;
      const walls = ['#efe2c8', '#f4ead8', '#e6d3b3', '#fbf6ec', '#dcc6a2'];
      while (x < 1400) {
        const bw = rand(90, 170), bh = rand(winH * 0.25, winH * 0.48);
        const top = winH * 0.9 - bh;
        c.fillStyle = pick(walls);
        c.fillRect(x, top, bw, bh + winH * 0.1);
        c.fillStyle = 'rgba(120,90,60,0.25)';
        c.fillRect(x, top, bw, 5);
        c.fillStyle = '#7fa6bf';
        for (let wy = top + 14; wy < winH * 0.84; wy += 26) {
          for (let wx = x + 12; wx < x + bw - 18; wx += 26) c.fillRect(wx, wy, 12, 14);
        }
        if (Math.random() < 0.5) {
          c.fillStyle = '#9aa3aa';
          c.fillRect(x + bw * 0.6, top - 10, 22, 10);
        }
        x += bw + rand(4, 24);
      }
    });
    const trees = Array.from({ length: 7 }, (_, i) => ({ x: i * 260 + rand(0, 120), kind: Math.random() < 0.65 ? 'palm' : 'lamp' }));
    const TW = 1820;

    const shell = layer(w, h, dpr, (c) => {
      c.fillStyle = '#cfd4db';
      c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'destination-out';
      panes.forEach(([a, b]) => { roundRect(c, a, y0, b - a, winH, 18); c.fill(); });
      c.globalCompositeOperation = 'source-over';
      // ceiling with a light strip
      c.fillStyle = vGrad(c, 0, y0 - 40, [[0, '#b9c0c9'], [1, '#dfe3e8']]);
      c.fillRect(0, 0, w, y0 - 40);
      c.fillStyle = '#fbfcfe';
      c.fillRect(0, y0 * 0.42, w, 8);
      glow(c, w / 2, y0 * 0.42, w * 0.6, 'rgba(255,255,255,A)', 0.25);
      // window frames
      c.strokeStyle = '#8c949e';
      c.lineWidth = 4;
      panes.forEach(([a, b]) => { roundRect(c, a, y0, b - a, winH, 18); c.stroke(); });
      // wall and seat backs below the windows
      c.fillStyle = vGrad(c, y1, h, [[0, '#aab2bc'], [1, '#7d8792']]);
      c.fillRect(0, y1 + 2, w, h - y1);
      const seatW = Math.max(150, w * 0.16);
      for (let x = -seatW * 0.3; x < w; x += seatW + 26) {
        c.fillStyle = '#2f6a86';
        roundRect(c, x, h * 0.74, seatW, h * 0.3, 26);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.08)';
        for (let dy = 0; dy < h * 0.26; dy += 14) {
          for (let dx = 10; dx < seatW - 10; dx += 14) c.fillRect(x + dx + ((dy / 14) % 2) * 7, h * 0.74 + 12 + dy, 4, 4);
        }
        c.fillStyle = '#c94a3e';
        roundRect(c, x + seatW * 0.2, h * 0.74 - 10, seatW * 0.6, 14, 7);
        c.fill();
      }
      // yellow poles with stop buttons at the pillars
      panes.forEach(([a], i) => {
        if (i % 2) return;
        const px = a - pillarW / 2;
        c.fillStyle = '#f2c230';
        c.fillRect(px - 5, 0, 10, h);
        c.fillStyle = '#d9342b';
        roundRect(c, px - 9, y1 + 30, 18, 26, 6);
        c.fill();
        c.fillStyle = '#fff';
        c.font = '700 8px Inter, sans-serif';
        c.textAlign = 'center';
        c.fillText('STOP', px, y1 + 46);
      });
      // grab rail
      c.fillStyle = '#9aa3ad';
      c.fillRect(0, y0 - 30, w, 7);
    });

    const sign = { x: Math.max(24, w * 0.05), y: Math.max(76, y0 * 0.62), w: Math.min(360, w * 0.32), h: 34 };
    let offset = rand(0, 4000);
    let lastSpeed = FP.ride.bus().speed;
    let accel = 0;

    return {
      draw(c, t, dt) {
        const r = FP.ride.bus();
        offset += r.speed * PX * dt;
        accel += ((r.speed - lastSpeed) / Math.max(dt, 0.001) - accel) * Math.min(1, dt * 3);
        lastSpeed = r.speed;
        const jig = r.speed * (Math.sin(t * 13) * 0.6 + Math.sin(t * 7.3) * 0.5);
        c.save();
        c.translate(0, jig);
        // outside
        c.fillStyle = vGrad(c, y0, y1, [[0, '#8ec3e6'], [0.75, '#e9e4d2'], [1, '#f2dfbc']]);
        c.fillRect(0, y0 - 4, w, winH + 8);
        glow(c, w * 0.2, y0 + winH * 0.2, winH * 0.8, 'rgba(255,245,215,A)', 0.5);
        strip(c, skyline, 1800, offset * 0.12, y0);
        strip(c, town, 1400, offset * 0.45, y0);
        c.fillStyle = '#8f949a';
        c.fillRect(0, ground, w, y1 - ground);
        c.fillStyle = '#d8d2c4';
        c.fillRect(0, ground, w, 6);
        // palms and street lamps on the pavement
        for (const tr of trees) {
          const x = ((tr.x - offset) % TW + TW) % TW - 100;
          if (x < -120 || x > w + 120) continue;
          if (tr.kind === 'palm') palmTree(c, x, ground + 2, winH / 260);
          else {
            c.strokeStyle = '#4a5560';
            c.lineWidth = 4;
            c.beginPath();
            c.moveTo(x, ground + 2);
            c.lineTo(x, ground - winH * 0.62);
            c.lineTo(x + 26, ground - winH * 0.62);
            c.stroke();
            c.fillStyle = '#e8eef2';
            c.fillRect(x + 18, ground - winH * 0.62, 16, 5);
          }
        }
        // the bus stop: it slides in as the bus brakes and away as it leaves
        const sx = r.c < 56 ? stopX + at(62) - at(r.c) : r.c < 71 ? stopX + at(62) - at(Math.min(r.c, 62)) : stopX - (at(r.c) - at(71));
        if (sx > -200 && sx < w + 200) {
          const sh = winH * 0.5, swd = Math.max(150, winH * 0.7);
          c.fillStyle = '#3b4652';
          c.fillRect(sx - swd / 2, ground - sh, 6, sh);
          c.fillRect(sx + swd / 2 - 6, ground - sh, 6, sh);
          c.fillStyle = 'rgba(190,225,240,0.45)';
          c.fillRect(sx - swd / 2 + 6, ground - sh + 10, swd - 12, sh - 26);
          c.fillStyle = '#c94a3e';
          c.fillRect(sx - swd / 2 - 10, ground - sh - 10, swd + 20, 12);
          c.fillStyle = '#6b4a2c';
          c.fillRect(sx - swd / 3, ground - sh * 0.32, swd * 0.66, 6);
          c.fillStyle = '#3b4652';
          c.fillRect(sx + swd / 2 + 24, ground - sh * 1.15, 4, sh * 1.15);
          c.fillStyle = '#1f6fb2';
          c.beginPath();
          c.arc(sx + swd / 2 + 26, ground - sh * 1.15, 13, 0, TAU);
          c.fill();
          c.fillStyle = '#fff';
          c.font = '700 13px Inter, sans-serif';
          c.textAlign = 'center';
          c.fillText('🚌', sx + swd / 2 + 26, ground - sh * 1.15 + 5);
          // someone waiting, who boards while the doors are open
          if (r.c < 64.5 || r.c >= 71) {
            if (r.c < 64.5) {
              c.fillStyle = '#2e3440';
              c.beginPath();
              c.arc(sx - swd * 0.15, ground - sh * 0.62, 7, 0, TAU);
              c.fill();
              roundRect(c, sx - swd * 0.15 - 8, ground - sh * 0.55, 16, sh * 0.5, 6);
              c.fill();
            }
          }
        }
        // a soft reflection on the glass
        const rg = c.createLinearGradient(0, y0, w * 0.4, y1);
        rg.addColorStop(0, 'rgba(255,255,255,0.10)');
        rg.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = rg;
        c.fillRect(0, y0, w, winH);
        c.drawImage(shell, 0, 0, w, h);
        // hanging straps sway when the bus speeds up or slows down
        const lean = Math.max(-0.5, Math.min(0.5, -accel * 0.9)) + Math.sin(t * 1.3) * 0.03 * r.speed;
        for (let x = 40; x < w; x += 110) {
          c.save();
          c.translate(x, y0 - 24);
          c.rotate(lean);
          c.strokeStyle = '#3e4650';
          c.lineWidth = 4;
          c.beginPath();
          c.moveTo(0, 0);
          c.lineTo(0, 26);
          c.stroke();
          c.beginPath();
          c.ellipse(0, 36, 9, 11, 0, 0, TAU);
          c.stroke();
          c.restore();
        }
        // next-stop display
        const stopping = r.phase === 'brake' || r.phase === 'stop';
        const name = STOPS[Math.floor(Date.now() / 80000) % STOPS.length];
        c.fillStyle = '#14171c';
        roundRect(c, sign.x, sign.y, sign.w, sign.h, 6);
        c.fill();
        c.fillStyle = stopping ? '#ff8a3d' : '#ffb84d';
        c.font = '600 14px "JetBrains Mono", ui-monospace, monospace';
        c.textAlign = 'left';
        c.fillText(stopping ? `Stopping · ${name}` : `Next stop · ${name}`, sign.x + 12, sign.y + 22, sign.w - 48);
        // the turn signal, blinking in time with its click
        if (r.signal) {
          const ax = sign.x + sign.w - 22, ay = sign.y + sign.h / 2, d = r.signal === 'left' ? -1 : 1;
          c.fillStyle = r.blink ? '#4fe08a' : 'rgba(79,224,138,0.15)';
          c.beginPath();
          c.moveTo(ax + d * 9, ay);
          c.lineTo(ax - d * 3, ay - 8);
          c.lineTo(ax - d * 3, ay + 8);
          c.closePath();
          c.fill();
        }
        c.restore();
      },
    };
  };

  scenes.train = (w, h, dpr) => {
    const PX = Math.max(420, w * 0.42);
    const wx0 = w * 0.06, wx1 = w * 0.94, wy0 = h * 0.14, wy1 = h * 0.62;
    const ww = wx1 - wx0, wh = wy1 - wy0;
    const horizon = wy0 + wh * 0.58;
    const hills = (col, amp, seed) => layer(1600, wh, 1, (c) => {
      c.fillStyle = col;
      c.beginPath();
      c.moveTo(0, wh);
      for (let x = 0; x <= 1600; x += 20) {
        const y = horizon - wy0 - amp * (0.5 + 0.3 * Math.sin((x / 1600) * TAU * 2 + seed) + 0.2 * Math.sin((x / 1600) * TAU * 5 + seed * 2));
        c.lineTo(x, y);
      }
      c.lineTo(1600, wh);
      c.fill();
    });
    const farHills = hills('#9fb4c6', wh * 0.22, 1);
    const nearHills = hills('#8aa77a', wh * 0.12, 4);
    const fields = layer(1600, wh, 1, (c) => {
      const top = horizon - wy0;
      const cols = ['#c9b56a', '#9bb862', '#d6c27a', '#7fa65a', '#e0cc8a'];
      let x = 0;
      while (x < 1600) {
        const fw = rand(120, 320);
        c.fillStyle = pick(cols);
        c.fillRect(x, top, fw, wh - top);
        x += fw;
      }
      for (let i = 0; i < 26; i++) {
        const tx = rand(0, 1600), ty = top + rand(4, 30), r = rand(6, 14);
        c.fillStyle = '#6b5440';
        c.fillRect(tx - 1.5, ty - r, 3, r);
        c.fillStyle = '#5f8a4c';
        c.beginPath();
        c.arc(tx, ty - r * 1.6, r, 0, TAU);
        c.fill();
      }
    });
    const POLE = 420;

    const shell = layer(w, h, dpr, (c) => {
      c.fillStyle = vGrad(c, 0, h, [[0, '#e3ddd1'], [1, '#cfc6b6']]);
      c.fillRect(0, 0, w, h);
      c.globalCompositeOperation = 'destination-out';
      roundRect(c, wx0, wy0, ww, wh, 46);
      c.fill();
      c.globalCompositeOperation = 'source-over';
      c.strokeStyle = '#a79d8c';
      c.lineWidth = 10;
      roundRect(c, wx0 - 5, wy0 - 5, ww + 10, wh + 10, 50);
      c.stroke();
      c.strokeStyle = '#efe9de';
      c.lineWidth = 3;
      roundRect(c, wx0 - 12, wy0 - 12, ww + 24, wh + 24, 56);
      c.stroke();
      // luggage rack
      c.fillStyle = '#9b9182';
      c.fillRect(0, wy0 - 46, w, 6);
      c.fillRect(0, wy0 - 30, w, 3);
      // the table and its shadow
      const ty = h * 0.76;
      c.fillStyle = 'rgba(0,0,0,0.18)';
      c.fillRect(0, ty - 6, w, 10);
      c.fillStyle = vGrad(c, ty, h, [[0, '#6f5a46'], [1, '#4f3f31']]);
      c.fillRect(0, ty, w, h - ty);
      c.fillStyle = 'rgba(255,255,255,0.08)';
      c.fillRect(0, ty, w, 3);
      // seat headrests at both edges
      [[-30, 1], [w + 30, -1]].forEach(([x, d]) => {
        c.fillStyle = '#2e4f6e';
        roundRect(c, x - 70, h * 0.3, 140, h * 0.5, 40);
        c.fill();
        c.fillStyle = '#e9e4da';
        roundRect(c, x - 70 + d * 10, h * 0.3, 140, 40, 18);
        c.fill();
      });
      // notebook and pen
      const nx = Math.max(90, w * 0.12), ny = ty + (h - ty) * 0.3;
      c.save();
      c.translate(nx, ny);
      c.rotate(-0.08);
      c.fillStyle = '#f7f3ea';
      c.fillRect(-60, 0, 120, 70);
      c.strokeStyle = 'rgba(80,90,110,0.35)';
      c.lineWidth = 1;
      for (let y = 14; y < 66; y += 9) {
        c.beginPath();
        c.moveTo(-50, y);
        c.lineTo(50, y);
        c.stroke();
      }
      c.fillStyle = '#c94a3e';
      c.fillRect(-60, 0, 10, 70);
      c.strokeStyle = '#1f2b3a';
      c.lineWidth = 4;
      c.beginPath();
      c.moveTo(70, 10);
      c.lineTo(108, 60);
      c.stroke();
      c.restore();
    });

    const cupX = w - Math.max(110, w * 0.13), cupY = h * 0.76 + (h - h * 0.76) * 0.4;
    const vapor = sprite(30, [[0, 'rgba(255,255,255,0.4)'], [1, 'rgba(255,255,255,0)']]);
    const puffs = Array.from({ length: 6 }, (_, i) => ({ age: i * 0.6 }));
    let offset = rand(0, 3000);
    let tunnelLights = 0;

    return {
      draw(c, t, dt) {
        const r = FP.ride.train();
        offset += PX * dt;
        const sway = Math.sin(t * 0.8) * 1.2;
        const jig = Math.sin(t * 17) * 0.4 + Math.sin(t * 5.1) * 0.5;
        c.save();
        c.translate(sway, jig);
        c.fillStyle = vGrad(c, wy0, horizon, [[0, '#7fb4dd'], [0.7, '#f3d8a8'], [1, '#f7c98a']]);
        c.fillRect(wx0 - 10, wy0 - 10, ww + 20, wh + 20);
        glow(c, wx0 + ww * 0.75, horizon - wh * 0.18, wh * 0.7, 'rgba(255,225,160,A)', 0.6);
        strip(c, farHills, 1600, offset * 0.03, wy0);
        strip(c, nearHills, 1600, offset * 0.09, wy0);
        strip(c, fields, 1600, offset * 0.3, wy0);
        // a low hedge rushing by, then the catenary poles and wire
        c.fillStyle = '#4f7a40';
        const hedgeY = wy1 - wh * 0.1;
        c.fillRect(wx0 - 10, hedgeY, ww + 20, wy1 - hedgeY + 10);
        c.strokeStyle = 'rgba(40,50,40,0.5)';
        c.lineWidth = 1;
        const wireY = wy0 + wh * 0.12;
        c.beginPath();
        const first = -((offset % POLE) + POLE) % POLE;
        for (let x = first - POLE; x < w + POLE; x += POLE) {
          c.moveTo(x, wireY);
          c.quadraticCurveTo(x + POLE / 2, wireY + 14, x + POLE, wireY);
        }
        c.stroke();
        c.fillStyle = '#3a3f44';
        for (let x = first; x < w + POLE; x += POLE) {
          c.fillRect(x - 5, wy0 - 10, 10, wh + 20);
          c.fillRect(x - 5, wireY - 4, 40, 5);
        }
        // the tunnel: dark glass with lamps streaking past
        if (r.tunnel > 0) {
          c.fillStyle = `rgba(14,15,18,${0.94 * r.tunnel})`;
          c.fillRect(wx0 - 10, wy0 - 10, ww + 20, wh + 20);
          tunnelLights = (tunnelLights + dt * 2.6) % 1;
          c.globalCompositeOperation = 'lighter';
          for (let k = 0; k < 3; k++) {
            const lx = wx1 - ((tunnelLights + k / 3) % 1) * (ww + 200);
            c.fillStyle = `rgba(255,170,80,${0.55 * r.tunnel})`;
            c.fillRect(lx, wy0 + wh * 0.25, 160, 6);
          }
          c.globalCompositeOperation = 'source-over';
          glow(c, w / 2, wy0 + wh * 0.6, wh, 'rgba(255,240,220,A)', 0.08 * r.tunnel);
        }
        const rg = c.createLinearGradient(wx0, wy0, wx0 + ww * 0.5, wy1);
        rg.addColorStop(0, 'rgba(255,255,255,0.12)');
        rg.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = rg;
        c.fillRect(wx0, wy0, ww, wh);
        c.drawImage(shell, -4, -4, w + 8, h + 8);
        // coffee cup with a little steam and rings from the rail joints
        c.fillStyle = 'rgba(0,0,0,0.2)';
        c.beginPath();
        c.ellipse(cupX + 4, cupY + 44, 40, 9, 0, 0, TAU);
        c.fill();
        c.fillStyle = '#f4f1ea';
        c.beginPath();
        c.moveTo(cupX - 28, cupY);
        c.lineTo(cupX + 28, cupY);
        c.lineTo(cupX + 22, cupY + 42);
        c.lineTo(cupX - 22, cupY + 42);
        c.closePath();
        c.fill();
        c.strokeStyle = '#f4f1ea';
        c.lineWidth = 5;
        c.beginPath();
        c.arc(cupX + 30, cupY + 18, 10, -Math.PI / 2, Math.PI / 2);
        c.stroke();
        c.fillStyle = '#5b3a24';
        c.beginPath();
        c.ellipse(cupX, cupY, 28, 7, 0, 0, TAU);
        c.fill();
        const ring = (t % 2.2) / 2.2;
        c.strokeStyle = `rgba(255,230,200,${0.4 * (1 - ring)})`;
        c.lineWidth = 1;
        c.beginPath();
        c.ellipse(cupX, cupY, 6 + ring * 20, 1.5 + ring * 5, 0, 0, TAU);
        c.stroke();
        for (const p of puffs) {
          p.age += dt;
          if (p.age > 3.6) p.age -= 3.6;
          const f = p.age / 3.6;
          c.globalAlpha = Math.sin(f * Math.PI) * 0.6;
          c.drawImage(vapor, cupX - 18 + Math.sin(t + p.age * 2) * 8, cupY - 30 - f * 60, 36, 36);
        }
        c.globalAlpha = 1;
        c.restore();
      },
    };
  };

  scenes.plane = (w, h, dpr) => {
    const n = w > 900 ? 3 : 2;
    const winW = Math.min(230, Math.max(130, w * (n === 3 ? 0.17 : 0.24))), winH = winW * 1.38;
    const cy = h * 0.42;
    const xs = n === 3 ? [w * 0.16, w * 0.5, w * 0.84] : [w * 0.2, w * 0.8];
    const horizon = cy + winH * 0.05;
    const clouds = layer(1600, 300, 1, (c) => {
      for (let i = 0; i < 70; i++) {
        const x = rand(0, 1600), y = rand(40, 260), r = rand(30, 80);
        const g = c.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(255,255,255,0.95)');
        g.addColorStop(0.6, 'rgba(250,248,245,0.7)');
        g.addColorStop(1, 'rgba(255,255,255,0)');
        c.fillStyle = g;
        c.fillRect(x - r, y - r, r * 2, r * 2);
      }
    });
    const ovalPath = (c, x, y, ww, hh) => {
      const r = ww / 2;
      c.beginPath();
      c.moveTo(x - r, y - hh / 2 + r);
      c.arc(x, y - hh / 2 + r, r, Math.PI, 0);
      c.lineTo(x + r, y + hh / 2 - r);
      c.arc(x, y + hh / 2 - r, r, 0, Math.PI);
      c.closePath();
    };

    const shell = layer(w, h, dpr, (c) => {
      c.fillStyle = vGrad(c, 0, h, [[0, '#d9dce1'], [0.3, '#eef0f2'], [1, '#c9cdd3']]);
      c.fillRect(0, 0, w, h);
      // wall panel seams and warm sunlight falling through each window
      c.strokeStyle = 'rgba(0,0,0,0.06)';
      c.lineWidth = 2;
      xs.slice(1).forEach((x, i) => {
        const sx = (x + xs[i]) / 2;
        c.beginPath();
        c.moveTo(sx, h * 0.14);
        c.lineTo(sx, h * 0.8);
        c.stroke();
      });
      xs.forEach((x) => glow(c, x + winW * 0.5, cy + winH * 0.75, winW * 1.4, 'rgba(255,226,170,A)', 0.35));
      // window surrounds: a soft bevel, then the hole
      xs.forEach((x) => {
        c.fillStyle = '#dfe2e6';
        ovalPath(c, x, cy, winW * 1.32, winH * 1.22);
        c.fill();
        c.strokeStyle = 'rgba(0,0,0,0.08)';
        c.lineWidth = 3;
        c.stroke();
        c.fillStyle = '#c5c9cf';
        ovalPath(c, x, cy, winW * 1.08, winH * 1.06);
        c.fill();
      });
      c.globalCompositeOperation = 'destination-out';
      xs.forEach((x) => { ovalPath(c, x, cy, winW, winH); c.fill(); });
      c.globalCompositeOperation = 'source-over';
      // overhead bins
      c.fillStyle = vGrad(c, 0, h * 0.13, [[0, '#cfd3d9'], [1, '#e9ebee']]);
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(w, 0);
      c.lineTo(w, h * 0.1);
      c.quadraticCurveTo(w / 2, h * 0.16, 0, h * 0.1);
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.12)';
      c.lineWidth = 2;
      c.stroke();
      // lower wall, then the tops of the seats in front, with headrest covers
      c.fillStyle = vGrad(c, h * 0.78, h, [[0, '#b9bec5'], [1, '#9aa0a8']]);
      c.fillRect(0, h * 0.78, w, h * 0.22);
      const seatW = Math.max(150, w * 0.17);
      for (let x = -seatW * 0.35; x < w; x += seatW + 14) {
        c.fillStyle = '#2d3a4f';
        roundRect(c, x, h * 0.8, seatW, h * 0.3, 34);
        c.fill();
        c.fillStyle = '#f2f3f5';
        roundRect(c, x + seatW * 0.14, h * 0.8 + 8, seatW * 0.72, h * 0.06, 10);
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.06)';
        roundRect(c, x + 10, h * 0.8 + h * 0.08, seatW - 20, 6, 3);
        c.fill();
      }
    });

    const psu = { x: Math.max(24, w * 0.05), y: Math.max(70, h * 0.06) };
    let offset = rand(0, 3000);
    let strobe = 0;

    return {
      draw(c, t, dt) {
        const r = FP.ride.plane();
        offset += 26 * dt;
        const shake = r.bump * (Math.sin(t * 11) * 2 + Math.sin(t * 23.7) * 1.2);
        c.save();
        c.translate(0, shake);
        xs.forEach((x, i) => {
          c.save();
          ovalPath(c, x, cy, winW + 2, winH + 2);
          c.clip();
          c.fillStyle = vGrad(c, cy - winH / 2, cy + winH / 2, [[0, '#2f6fb3'], [0.45, '#8cc0ea'], [0.62, '#e8f2fb'], [1, '#f4f6f8']]);
          c.fillRect(x - winW, cy - winH, winW * 2, winH * 2);
          glow(c, x - winW * 0.3, cy - winH * 0.3, winW, 'rgba(255,250,230,A)', 0.4);
          // the sea of clouds below, drifting backwards
          const cw = 1600, sc = winH / 300;
          const ox = -(((offset + i * 400) % cw) + cw) % cw;
          c.globalAlpha = 0.95;
          c.drawImage(clouds, x - winW / 2 + ox * 0.5, horizon, cw * sc * 0.5, 300 * sc * 0.5);
          c.drawImage(clouds, x - winW / 2 + ox * 0.5 + cw * sc * 0.5, horizon, cw * sc * 0.5, 300 * sc * 0.5);
          c.drawImage(clouds, x - winW / 2 + ox, horizon + winH * 0.12, cw * sc, 300 * sc);
          c.drawImage(clouds, x - winW / 2 + ox + cw * sc, horizon + winH * 0.12, cw * sc, 300 * sc);
          c.globalAlpha = 1;
          // the wing, seen from the last window
          if (i === xs.length - 1) {
            const wy = cy + winH * 0.18;
            c.fillStyle = '#c3c9d1';
            c.beginPath();
            c.moveTo(x - winW * 0.7, wy + winH * 0.2);
            c.lineTo(x + winW * 0.45, wy - winH * 0.02);
            c.lineTo(x + winW * 0.5, wy + winH * 0.03);
            c.lineTo(x - winW * 0.7, wy + winH * 0.36);
            c.closePath();
            c.fill();
            c.fillStyle = '#e2e6eb';
            c.beginPath();
            c.moveTo(x - winW * 0.7, wy + winH * 0.2);
            c.lineTo(x + winW * 0.45, wy - winH * 0.02);
            c.lineTo(x + winW * 0.44, wy + 2 - winH * 0.02);
            c.lineTo(x - winW * 0.7, wy + winH * 0.24);
            c.fill();
            c.fillStyle = '#9aa3ae';
            c.beginPath();
            c.moveTo(x + winW * 0.45, wy - winH * 0.02);
            c.lineTo(x + winW * 0.52, wy - winH * 0.14);
            c.lineTo(x + winW * 0.55, wy - winH * 0.13);
            c.lineTo(x + winW * 0.5, wy + winH * 0.03);
            c.fill();
            strobe = (strobe + dt) % 1.6;
            if (strobe < 0.08) {
              c.globalCompositeOperation = 'lighter';
              glow(c, x + winW * 0.53, wy - winH * 0.12, 26, 'rgba(255,255,255,A)', 0.95);
              c.globalCompositeOperation = 'source-over';
            }
            c.fillStyle = '#4fd27a';
            c.beginPath();
            c.arc(x + winW * 0.5, wy + winH * 0.01, 2.5, 0, TAU);
            c.fill();
          }
          c.restore();
        });
        c.drawImage(shell, 0, 0, w, h);
        // the first window's shade is pulled part way down
        c.save();
        ovalPath(c, xs[0], cy, winW, winH);
        c.clip();
        c.fillStyle = '#e4e6ea';
        c.fillRect(xs[0] - winW, cy - winH, winW * 2, winH * 0.82);
        c.fillStyle = '#c9cdd3';
        c.fillRect(xs[0] - winW * 0.18, cy - winH * 0.2, winW * 0.36, 7);
        c.restore();
        // passenger service panel: the seatbelt sign (it blinks for a few seconds as it comes on) and reading lights
        const since = r.belt ? r.c - 300 : 99;
        const lit = r.belt && (since > 4 || Math.floor(since * 2.5) % 2 === 0);
        c.fillStyle = '#c3c8cf';
        roundRect(c, psu.x, psu.y, 170, 40, 10);
        c.fill();
        c.fillStyle = lit ? '#ffb347' : '#8d939b';
        roundRect(c, psu.x + 10, psu.y + 6, 64, 28, 6);
        c.fill();
        // a seated figure with its belt across the lap
        const ix = psu.x + 42, iy = psu.y + 20, ink = lit ? '#3b2410' : '#b3b9c1';
        c.fillStyle = ink;
        c.beginPath();
        c.arc(ix - 4, iy - 8, 3.2, 0, TAU);
        c.fill();
        c.strokeStyle = ink;
        c.lineWidth = 3;
        c.lineCap = 'round';
        c.beginPath();
        c.moveTo(ix - 5, iy - 3);
        c.lineTo(ix - 5, iy + 5);
        c.lineTo(ix + 5, iy + 5);
        c.lineTo(ix + 5, iy + 11);
        c.stroke();
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(ix - 11, iy + 2);
        c.lineTo(ix + 9, iy + 2);
        c.stroke();
        if (lit) {
          c.globalCompositeOperation = 'lighter';
          glow(c, psu.x + 42, psu.y + 20, 54, 'rgba(255,170,60,A)', since < 4 ? 0.5 : 0.35);
          c.globalCompositeOperation = 'source-over';
        }
        c.fillStyle = '#f5f2e8';
        c.beginPath();
        c.arc(psu.x + 110, psu.y + 20, 9, 0, TAU);
        c.arc(psu.x + 145, psu.y + 20, 9, 0, TAU);
        c.fill();
        c.restore();
      },
    };
  };

  // ======================================================================
  // YOGA STUDIO (by the sea)
  // ======================================================================
  scenes.yoga = (w, h, dpr) => {
    const floorY = h * 0.66;
    const winTop = h * 0.1, winBot = floorY - h * 0.05;
    const nWin = w > 1000 ? 4 : w > 640 ? 3 : 2;
    const gap = Math.max(18, w * 0.02);
    const margin = w * 0.05;
    const winW = (w - margin * 2 - gap * (nWin - 1)) / nWin;
    const wins = Array.from({ length: nWin }, (_, i) => margin + i * (winW + gap));
    const seaY = winTop + (winBot - winTop) * 0.62;
    // a mat in perspective: centre x on the floor, depth 0 (back) .. 1 (front)
    const vpX = w / 2, vpY = h * 0.3;
    const persp = (x, y) => [vpX + (x - vpX) * ((y - vpY) / (h - vpY)), y];

    const room = layer(w, h, dpr, (c) => {
      // the view: morning sky, the sea and a palm or two
      c.fillStyle = vGrad(c, winTop, seaY, [[0, '#a8d4ee'], [0.75, '#f6e7cf'], [1, '#fbe2bf']]);
      c.fillRect(0, winTop, w, seaY - winTop);
      glow(c, w * 0.7, seaY - h * 0.05, h * 0.35, 'rgba(255,240,200,A)', 0.6);
      c.fillStyle = vGrad(c, seaY, winBot, [[0, '#7fbcc9'], [1, '#4e98a8']]);
      c.fillRect(0, seaY, w, winBot - seaY);
      [w * 0.12, w * 0.9].forEach((x, i) => palmTree(c, x, winBot + 6, (winBot - winTop) / (i ? 260 : 220)));
      // wall with the windows cut out
      const wall = layer(w, h, 1, (x) => {
        x.fillStyle = vGrad(x, 0, floorY, [[0, '#efe6d8'], [1, '#e6d9c5']]);
        x.fillRect(0, 0, w, floorY);
        x.globalCompositeOperation = 'destination-out';
        wins.forEach((wx) => x.fillRect(wx, winTop, winW, winBot - winTop));
      });
      c.drawImage(wall, 0, 0, w, h);
      // window frames and mullions
      c.strokeStyle = '#a07c58';
      c.lineWidth = 6;
      wins.forEach((wx) => {
        c.strokeRect(wx, winTop, winW, winBot - winTop);
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(wx + winW / 2, winTop);
        c.lineTo(wx + winW / 2, winBot);
        c.moveTo(wx, winTop + (winBot - winTop) * 0.3);
        c.lineTo(wx + winW, winTop + (winBot - winTop) * 0.3);
        c.stroke();
        c.lineWidth = 6;
      });
      c.fillStyle = '#c9a77f';
      c.fillRect(0, winBot, w, 10);
      // wooden floor in one-point perspective
      c.fillStyle = vGrad(c, floorY, h, [[0, '#d2ad80'], [1, '#e2c095']]);
      c.fillRect(0, floorY, w, h - floorY);
      c.strokeStyle = 'rgba(120,80,45,0.18)';
      c.lineWidth = 1;
      for (let i = -24; i <= 24; i++) {
        c.beginPath();
        c.moveTo(...persp(vpX + i * 70, floorY));
        c.lineTo(...persp(vpX + i * 70, h));
        c.stroke();
      }
      c.fillStyle = 'rgba(0,0,0,0.08)';
      c.fillRect(0, floorY, w, 5);
      // yoga mats
      const mat = (cx, y0, y1, half, col, stripe) => {
        const [ax, ay] = persp(cx - half, y0), [bx] = persp(cx + half, y0), [cx2, cy2] = persp(cx + half, y1), [dx] = persp(cx - half, y1);
        c.fillStyle = 'rgba(60,40,20,0.15)';
        c.beginPath();
        c.moveTo(ax + 4, ay + 4); c.lineTo(bx + 4, ay + 4); c.lineTo(cx2 + 4, cy2 + 4); c.lineTo(dx + 4, cy2 + 4);
        c.fill();
        c.fillStyle = col;
        c.beginPath();
        c.moveTo(ax, ay); c.lineTo(bx, ay); c.lineTo(cx2, cy2); c.lineTo(dx, cy2);
        c.closePath();
        c.fill();
        c.strokeStyle = stripe;
        c.lineWidth = 2;
        c.beginPath();
        const [sx0] = persp(cx - half * 0.8, y0), [sx1] = persp(cx - half * 0.8, y1);
        c.moveTo(sx0, y0 + 3);
        c.lineTo(sx1, y1 - 3);
        c.stroke();
      };
      mat(w * 0.16, floorY + (h - floorY) * 0.2, h * 0.98, w * 0.07, '#9cb89a', 'rgba(255,255,255,0.35)');
      mat(w * 0.5, floorY + (h - floorY) * 0.15, h * 0.9, w * 0.07, '#d08a6a', 'rgba(255,255,255,0.3)');
      mat(w * 0.84, floorY + (h - floorY) * 0.2, h * 0.98, w * 0.07, '#e3cfae', 'rgba(150,110,70,0.3)');
      // cork blocks and a bolster on the right mat
      const by = floorY + (h - floorY) * 0.42;
      c.fillStyle = '#c69a62';
      roundRect(c, w * 0.8, by, 34, 22, 4);
      c.fill();
      roundRect(c, w * 0.8 + 40, by + 6, 34, 22, 4);
      c.fill();
      c.fillStyle = '#5f7f8f';
      roundRect(c, w * 0.78, by + 40, Math.min(150, w * 0.1), 30, 15);
      c.fill();
      // monstera in a pot, left corner
      const mx = Math.max(60, w * 0.05), my = floorY + 30;
      c.fillStyle = '#c4805f';
      c.beginPath();
      c.moveTo(mx - 30, my - 50); c.lineTo(mx + 30, my - 50); c.lineTo(mx + 22, my); c.lineTo(mx - 22, my);
      c.fill();
      c.fillStyle = '#3f7d4f';
      for (let i = 0; i < 7; i++) {
        const a = -Math.PI / 2 + (i - 3) * 0.42;
        const len = rand(70, 120);
        c.save();
        c.translate(mx + Math.cos(a) * len * 0.75, my - 50 + Math.sin(a) * len * 0.75);
        c.rotate(a + Math.PI / 2);
        c.beginPath();
        c.ellipse(0, 0, 22, 30, 0, 0, TAU);
        c.fill();
        c.restore();
      }
      // a singing bowl on a cushion, right foreground
      const sx = w - Math.max(90, w * 0.08), sy = h - 40;
      c.fillStyle = '#7a3f4a';
      c.beginPath();
      c.ellipse(sx, sy, 46, 16, 0, 0, TAU);
      c.fill();
      c.fillStyle = '#c99a4a';
      c.beginPath();
      c.moveTo(sx - 30, sy - 22);
      c.quadraticCurveTo(sx - 28, sy + 2, sx, sy + 2);
      c.quadraticCurveTo(sx + 28, sy + 2, sx + 30, sy - 22);
      c.closePath();
      c.fill();
      c.fillStyle = '#e2bd6e';
      c.beginPath();
      c.ellipse(sx, sy - 22, 30, 7, 0, 0, TAU);
      c.fill();
      // low stool with the incense holder, left foreground
      const ix = Math.max(150, w * 0.17), iy = h - 46;
      c.fillStyle = '#8a5f3c';
      roundRect(c, ix - 50, iy, 100, 12, 4);
      c.fill();
      c.fillRect(ix - 44, iy + 12, 8, 30);
      c.fillRect(ix + 36, iy + 12, 8, 30);
      c.fillStyle = '#3d3a36';
      c.beginPath();
      c.ellipse(ix, iy - 2, 14, 5, 0, 0, TAU);
      c.fill();
      c.strokeStyle = '#6b3d2a';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(ix, iy - 4);
      c.lineTo(ix + 10, iy - 60);
      c.stroke();
    });

    const curtains = wins.flatMap((wx) => [{ x: wx, side: 1 }, { x: wx + winW, side: -1 }]).map((cu) => ({ ...cu, ph: rand(0, TAU) }));
    const smokeX = Math.max(150, w * 0.17) + 10, smokeY = h - 46 - 62;
    const dust = motes(40, { x: 0, y: winTop, w, h: h - winTop });
    const hang = [Math.max(40, w * 0.04), w - Math.max(40, w * 0.04)];
    let boatX = rand(0, w);

    return {
      draw(c, t, dt) {
        c.drawImage(room, 0, 0, w, h);
        // glints on the sea and a dhow sailing slowly across, seen through the glass
        c.save();
        c.beginPath();
        wins.forEach((wx) => c.rect(wx, winTop, winW, winBot - winTop));
        c.clip();
        c.fillStyle = 'rgba(255,255,255,0.55)';
        for (let i = 0; i < 26; i++) {
          const gx = (i * 137.5 + t * 6) % w, gy = seaY + 6 + ((i * 53) % (winBot - seaY - 10));
          c.globalAlpha = 0.25 + 0.35 * Math.sin(t * 1.4 + i);
          c.fillRect(gx, gy, 14, 1.5);
        }
        c.globalAlpha = 1;
        boatX = (boatX + dt * 7) % (w + 160);
        const bx = boatX - 80, by = seaY + 8;
        c.fillStyle = '#6b4a2c';
        c.beginPath();
        c.moveTo(bx - 28, by); c.lineTo(bx + 30, by); c.lineTo(bx + 20, by + 8); c.lineTo(bx - 22, by + 8);
        c.fill();
        c.fillStyle = '#f4ede0';
        c.beginPath();
        c.moveTo(bx - 2, by - 2); c.lineTo(bx + 22, by - 34); c.lineTo(bx + 18, by - 2);
        c.fill();
        c.restore();
        // sunbeams falling across the floor
        c.globalCompositeOperation = 'lighter';
        wins.forEach((wx, i) => {
          const a = 0.07 + 0.025 * Math.sin(t * 0.3 + i);
          const g = c.createLinearGradient(wx, winTop, wx - w * 0.1, h);
          g.addColorStop(0, `rgba(255,236,190,${a})`);
          g.addColorStop(1, 'rgba(255,236,190,0)');
          c.fillStyle = g;
          c.beginPath();
          c.moveTo(wx + winW * 0.1, winTop);
          c.lineTo(wx + winW * 0.9, winTop);
          c.lineTo(wx + winW * 0.7 - w * 0.12, h);
          c.lineTo(wx - w * 0.16, h);
          c.closePath();
          c.fill();
        });
        c.globalCompositeOperation = 'source-over';
        drawMotes(c, dust, { x: 0, y: winTop, w, h: h - winTop }, t, dt, '#fff6dc', 0.4);
        // sheer curtains breathing in the breeze
        for (const cu of curtains) {
          const sway = Math.sin(t * 0.6 + cu.ph) * 6 + Math.sin(t * 1.3 + cu.ph * 2) * 3;
          const cw = winW * 0.16;
          c.fillStyle = 'rgba(255,255,255,0.45)';
          c.beginPath();
          c.moveTo(cu.x, winTop - 6);
          c.lineTo(cu.x + cu.side * cw, winTop - 6);
          c.quadraticCurveTo(cu.x + cu.side * (cw + sway), (winTop + winBot) / 2, cu.x + cu.side * (cw * 0.8 + sway * 1.6), winBot + 4);
          c.lineTo(cu.x, winBot + 4);
          c.closePath();
          c.fill();
        }
        // hanging plants swaying gently in the top corners
        hang.forEach((hx, i) => {
          const sw = Math.sin(t * 0.7 + i * 2) * 0.05;
          c.save();
          c.translate(hx, 0);
          c.rotate(sw);
          c.strokeStyle = '#8a6b4a';
          c.lineWidth = 1.5;
          c.beginPath();
          c.moveTo(0, 0);
          c.lineTo(0, h * 0.14);
          c.stroke();
          c.fillStyle = '#e8dccb';
          c.beginPath();
          c.ellipse(0, h * 0.15, 22, 14, 0, 0, Math.PI);
          c.fill();
          c.fillStyle = '#4f8f5a';
          for (let k = 0; k < 9; k++) {
            const vx = (k - 4) * 6, len = 30 + ((k * 37) % 50);
            for (let j = 0; j < 4; j++) {
              c.beginPath();
              c.ellipse(vx + Math.sin(t + k + j) * 1.5, h * 0.15 + 6 + j * len / 4, 5, 3.5, 0.5, 0, TAU);
              c.fill();
            }
          }
          c.restore();
        });
        // incense smoke curling up
        c.strokeStyle = 'rgba(240,240,240,0.4)';
        c.lineWidth = 1.6;
        c.beginPath();
        c.moveTo(smokeX, smokeY);
        for (let k = 1; k <= 30; k++) {
          const yy = smokeY - k * 6;
          const xx = smokeX + Math.sin(k * 0.35 - t * 1.2) * (2 + k * 0.5);
          c.lineTo(xx, yy);
        }
        c.stroke();
        c.fillStyle = '#ff8a3d';
        c.beginPath();
        c.arc(smokeX, smokeY + 1, 1.8, 0, TAU);
        c.fill();
      },
    };
  };
})();
