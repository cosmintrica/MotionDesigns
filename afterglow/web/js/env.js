'use strict';
// ---------------------------------------------------------------------------
// Environments: skies, sun, stars, hills, apartment blocks, trees, lamps,
// the grandparents' village, particles (dust, pollen, fireflies, rain, birds).
// ---------------------------------------------------------------------------

const Env = (() => {
  // ---- sky -------------------------------------------------------------------
  function sky(ctx, stops, y0 = 0, y1 = H) {
    ctx.fillStyle = linGrad(ctx, 0, y0, 0, y1, stops);
    ctx.fillRect(-W, -H, W * 3, H * 3);
  }

  function sun(ctx, x, y, r, core = '#fff6d8', glow = '#ffb45e', intensity = 1) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, x, y, r * 9, glow, 0.28 * intensity);
    drawGlow(ctx, x, y, r * 4.2, glow, 0.42 * intensity);
    drawGlow(ctx, x, y, r * 2.0, core, 0.55 * intensity, 0.3);
    ctx.restore();
    ctx.fillStyle = core;
    ctx.globalAlpha = intensity;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // god rays: soft wedges radiating from a point
  function rays(ctx, x, y, t, alpha = 0.12, color = '#ffd9a0', n = 11, len = 1800, seed = 3) {
    if (alpha <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const c = hex(color);
    for (let i = 0; i < n; i++) {
      const base = (i / n) * Math.PI - Math.PI * 0.98 + hash(i + seed) * 0.2;
      const a = base + Math.sin(t * 0.13 + i * 1.7) * 0.03;
      const wdt = 0.035 + hash(i * 3.1 + seed) * 0.06;
      const al = alpha * (0.35 + 0.65 * hash(i * 7.7 + seed)) * (0.75 + 0.25 * Math.sin(t * 0.4 + i));
      const g = ctx.createRadialGradient(x, y, 0, x, y, len);
      g.addColorStop(0, rgba(c, al));
      g.addColorStop(0.5, rgba(c, al * 0.35));
      g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.arc(x, y, len, a - wdt, a + wdt);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function stars(ctx, seed, n, t, alpha = 1, y1 = H * 0.7, bright = 1) {
    if (alpha <= 0) return;
    const r = mulberry32(seed);
    ctx.save();
    for (let i = 0; i < n; i++) {
      const x = r() * W, y = Math.pow(r(), 1.3) * y1, s = Math.pow(r(), 3) * 2.2 + 0.5;
      const tw = 0.6 + 0.4 * Math.sin(t * (1 + r() * 3) + r() * 10);
      const a = alpha * tw * (0.35 + 0.65 * r()) * (1 - y / y1 * 0.6);
      ctx.globalAlpha = a;
      ctx.fillStyle = r() > 0.85 ? '#ffe6c8' : '#e8eeff';
      ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill();
      if (s > 1.7 && bright) drawGlow(ctx, x, y, s * 6, '#dfe8ff', a * 0.35);
    }
    ctx.restore();
  }

  const _mw = {};
  function milkyWay(ctx, alpha = 0.5, seed = 9) {
    if (alpha <= 0) return;
    if (!_mw[seed]) {
      const [c, x] = makeCanvas(W, H);
      _milkyWayRaw(x, 1, seed);
      _mw[seed] = c;
    }
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = alpha; ctx.drawImage(_mw[seed], 0, 0); ctx.restore();
  }
  function _milkyWayRaw(ctx, alpha = 0.5, seed = 9) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.translate(W * 0.5, H * 0.35);
    ctx.rotate(-0.42);
    const r = mulberry32(seed);
    for (let i = 0; i < 70; i++) {
      const x = (r() - 0.5) * W * 1.5, y = (r() - 0.5) * 140 * (1 + r());
      drawGlow(ctx, x, y, 80 + r() * 160, r() > 0.5 ? '#6f78b8' : '#a58fbf', alpha * 0.08 * r());
    }
    for (let i = 0; i < 500; i++) {
      const x = (r() - 0.5) * W * 1.5, y = (r() + r() + r() - 1.5) * 90;
      ctx.globalAlpha = alpha * r() * 0.8;
      ctx.fillStyle = '#eef0ff';
      ctx.fillRect(x, y, 1.3, 1.3);
    }
    ctx.restore();
  }

  function cloudBand(ctx, seed, y, t, color, alpha = 0.5, scale = 1, speed = 6) {
    const r = mulberry32(seed);
    ctx.save();
    for (let i = 0; i < 16; i++) {
      const cx = ((r() * W * 1.6 + t * speed * (0.6 + r() * 0.8)) % (W * 1.6)) - W * 0.3;
      const cy = y + (r() - 0.5) * 60 * scale;
      const w = (180 + r() * 360) * scale, h = (20 + r() * 26) * scale;
      ctx.globalAlpha = alpha * (0.4 + 0.6 * r());
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.ellipse(cx, cy, w, h, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  // layered hills (x-periodic noise ridge)
  function hills(ctx, seed, baseY, amp, color, freq = 0.0025, offset = 0) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-60, H + 10);
    for (let x = -60; x <= W + 60; x += 12) {
      const y = baseY - amp * (0.55 + 0.45 * fbm(x * freq + seed * 10.7 + offset, 3));
      ctx.lineTo(x, y);
    }
    ctx.lineTo(W + 60, H + 10);
    ctx.closePath();
    ctx.fill();
  }

  // ---- apartment block ------------------------------------------------------
  // o: {x, base, w, floors, fh, cols, seed, mode:'golden'|'grey'|'night'|'pastel'|'far',
  //     facade, window, lit, litColor, t, rimColor, balconyEvery, antenna, laundry, dish, ac}
  function block(ctx, o) {
    const r = mulberry32(o.seed || 1);
    const fh = o.fh || 62, floors = o.floors || 8, cols = o.cols || 8;
    const h = floors * fh + fh * 0.7;
    const x = o.x, y = o.base - h, w = o.w;
    const bw = w / cols;
    const mode = o.mode || 'golden';
    // visible side face (2.5D depth)
    if (o.sideW) {
      const sw = o.sideW, dir = o.sideDir || 1;
      const sx0 = dir > 0 ? x + w : x;
      ctx.fillStyle = o.sideColor || o.facade;
      ctx.beginPath();
      ctx.moveTo(sx0, y); ctx.lineTo(sx0 + dir * sw, y + sw * 0.18); ctx.lineTo(sx0 + dir * sw, o.base); ctx.lineTo(sx0, o.base);
      ctx.closePath(); ctx.fill();
      // narrow side windows
      ctx.fillStyle = o.window;
      for (let f = 0; f < floors; f++) {
        const fy = o.base - fh * 0.7 - (f + 1) * fh + fh * 0.25;
        for (let k = 0; k < 2; k++) {
          const u = 0.25 + k * 0.4;
          const wx0 = sx0 + dir * sw * u;
          const lit = hash(f * 7.1 + k * 3.3 + (o.seed || 1)) < (o.lit || 0) * 0.6;
          ctx.fillStyle = lit ? (o.litColors ? o.litColors[0] : o.litColor) : o.window;
          ctx.beginPath();
          ctx.moveTo(wx0, fy + sw * 0.18 * u); ctx.lineTo(wx0 + dir * sw * 0.18, fy + sw * 0.18 * (u + 0.18));
          ctx.lineTo(wx0 + dir * sw * 0.18, fy + fh * 0.48 + sw * 0.18 * (u + 0.18)); ctx.lineTo(wx0, fy + fh * 0.48 + sw * 0.18 * u);
          ctx.closePath(); ctx.fill();
        }
      }
    }
    // facade
    ctx.fillStyle = o.facade;
    ctx.fillRect(x, y, w, h);
    if (o.facadeGrad) { ctx.fillStyle = linGrad(ctx, 0, y, 0, o.base, o.facadeGrad); ctx.fillRect(x, y, w, h); }
    if (o.facadeShade) {
      ctx.fillStyle = o.facadeShade;
      ctx.fillRect(x, y, w, h);
    }
    // panel seams
    if (o.seams) {
      ctx.strokeStyle = o.seams;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let f = 0; f <= floors; f++) { const yy = o.base - fh * 0.7 - f * fh + 2; ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); }
      for (let c = 0; c <= cols; c++) { ctx.moveTo(x + c * bw, y); ctx.lineTo(x + c * bw, o.base); }
      ctx.stroke();
    }
    // stains (grey reality)
    if (o.stains) {
      ctx.save();
      for (let i = 0; i < cols * 1.5; i++) {
        const sx = x + r() * w, sw = 6 + r() * 26;
        const g = ctx.createLinearGradient(0, y, 0, y + h * (0.3 + r() * 0.6));
        g.addColorStop(0, `rgba(40,42,44,${0.18 * o.stains})`); g.addColorStop(1, 'rgba(40,42,44,0)');
        ctx.fillStyle = g; ctx.fillRect(sx, y, sw, h);
      }
      ctx.restore();
    }
    // windows & balconies
    const winW = bw * 0.46, winH = fh * 0.5;
    for (let f = 0; f < floors; f++) {
      const fy = o.base - fh * 0.7 - (f + 1) * fh;
      for (let c = 0; c < cols; c++) {
        const bx = x + c * bw;
        const isStair = o.stairCol !== undefined && c === o.stairCol;
        if (isStair) {
          // stairwell: small window at half-floor
          const sy = fy + fh * 0.45;
          ctx.fillStyle = o.window;
          ctx.fillRect(bx + bw * 0.3, sy, bw * 0.4, fh * 0.3);
          continue;
        }
        const balcony = o.balconyEvery && (c % o.balconyEvery === 1);
        const wx = bx + (bw - winW) / 2, wy = fy + fh * 0.22;
        const seedL = r();
        const lit = seedL < (o.lit || 0);
        let wc = o.window;
        if (lit) wc = o.litColors ? o.litColors[(seedL * 97 | 0) % o.litColors.length] : o.litColor;
        const tvFlicker = lit && o.tv && seedL < (o.lit || 0) * 0.25;
        ctx.fillStyle = wc;
        if (tvFlicker) ctx.globalAlpha = 0.65 + 0.35 * Math.sin((o.t || 0) * 9 + c * 3 + f * 5) * Math.sin((o.t || 0) * 2.3 + f);
        ctx.fillRect(wx, wy, winW, winH);
        ctx.globalAlpha = 1;
        // window frame cross
        if (o.frame) {
          ctx.fillStyle = o.frame;
          ctx.fillRect(wx + winW * 0.48, wy, Math.max(1.5, winW * 0.05), winH);
          ctx.fillRect(wx, wy + winH * 0.3, winW, Math.max(1.5, winH * 0.05));
        }
        if (lit && o.glowWindows) {
          ctx.save(); ctx.globalCompositeOperation = 'lighter';
          drawGlow(ctx, wx + winW / 2, wy + winH / 2, winW * 1.4, wc, 0.25 * o.glowWindows);
          ctx.restore();
        }
        if (balcony) {
          const by = fy + fh * 0.52, bh = fh * 0.48;
          const laundry = o.laundry && r() < o.laundry;
          if (laundry) {
            const nc = 2 + (r() * 2 | 0);
            for (let k = 0; k < nc; k++) {
              const cx0 = bx + bw * (0.14 + 0.72 * k / nc);
              const sway = Math.sin((o.t || 0) * 1.3 + k + c) * 1.2;
              ctx.fillStyle = o.clothes ? o.clothes[(r() * o.clothes.length) | 0] : o.window;
              ctx.fillRect(cx0 + sway, by - fh * 0.16, bw * 0.2, fh * 0.26);
            }
          }
          ctx.fillStyle = o.balcony || o.facade;
          ctx.fillRect(bx + bw * 0.04, by, bw * 0.92, bh);
          ctx.fillStyle = o.balconyEdge || 'rgba(255,255,255,0.06)';
          ctx.fillRect(bx + bw * 0.04, by, bw * 0.92, 3);
          if (o.ac && r() < o.ac) {
            ctx.fillStyle = o.acColor || '#e8e8e8';
            ctx.fillRect(bx + bw * 0.62, by - fh * 0.05, bw * 0.28, fh * 0.2);
          }
        } else if (o.ac && r() < o.ac * 0.5) {
          ctx.fillStyle = o.acColor || '#e8e8e8';
          ctx.fillRect(wx + winW * 0.7, wy + winH + 3, bw * 0.3, fh * 0.18);
        }
      }
    }
    // ground floor entrance
    if (o.entrance !== undefined) {
      const ex = x + o.entrance * bw;
      ctx.fillStyle = o.door || o.window;
      ctx.fillRect(ex + bw * 0.25, o.base - fh * 0.62, bw * 0.5, fh * 0.62);
      ctx.fillStyle = o.canopy || o.facade;
      ctx.fillRect(ex + bw * 0.1, o.base - fh * 0.72, bw * 0.8, fh * 0.1);
      if (o.entranceLight) {
        ctx.save(); ctx.globalCompositeOperation = 'lighter';
        drawGlow(ctx, ex + bw * 0.5, o.base - fh * 0.62, bw * 1.2, '#ffcf87', o.entranceLight);
        ctx.restore();
      }
    }
    // roof details
    ctx.fillStyle = o.roof || o.facade;
    ctx.fillRect(x - 4, y - 6, w + 8, 8);
    if (o.roofBox) ctx.fillRect(x + w * 0.2, y - fh * 0.5, w * 0.16, fh * 0.5);
    if (o.antenna) {
      ctx.strokeStyle = o.antennaColor || o.roof || o.facade;
      ctx.lineWidth = 2;
      const na = o.antenna;
      for (let i = 0; i < na; i++) {
        const ax = x + w * (0.1 + 0.8 * r()), ah = fh * (0.6 + r() * 0.8);
        ctx.beginPath(); ctx.moveTo(ax, y); ctx.lineTo(ax, y - ah);
        for (let k = 0; k < 4; k++) { const ly = y - ah + k * 7; const lw = 22 - k * 4; ctx.moveTo(ax - lw / 2, ly); ctx.lineTo(ax + lw / 2, ly); }
        ctx.stroke();
      }
    }
    if (o.dish) {
      for (let i = 0; i < o.dish; i++) {
        const dx = x + w * (0.08 + 0.84 * r()), dy = o.base - fh * 0.7 - fh * (1 + (r() * floors | 0)) + fh * 0.2;
        ctx.fillStyle = o.dishColor || '#dcdcdc';
        ctx.beginPath(); ctx.ellipse(dx, dy, 9, 11, -0.4, 0, TAU); ctx.fill();
      }
    }
    // rim light along the top edge
    if (o.rimColor) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = linGrad(ctx, 0, y - 6, 0, y + 40, [[0, o.rimColor], [1, 'rgba(0,0,0,0)']]);
      ctx.fillRect(x - 4, y - 6, w + 8, 46);
      ctx.restore();
    }
    return { x, y, w, h, bw, fh, top: y };
  }

  // distant block silhouettes row
  function skyline(ctx, seed, baseY, color, t = 0, opts = {}) {
    const r = mulberry32(seed);
    let x = -40;
    ctx.fillStyle = color;
    while (x < W + 40) {
      const w = 90 + r() * 170, h = (opts.hmin || 90) + r() * (opts.hvar || 160);
      ctx.fillRect(x, baseY - h, w, h + 4);
      if (opts.windows && r() < 0.9) {
        ctx.save();
        for (let yy = baseY - h + 14; yy < baseY - 10; yy += 16) {
          for (let xx = x + 8; xx < x + w - 8; xx += 14) {
            if (r() < opts.windows) { ctx.fillStyle = opts.winColor || '#ffd08a'; ctx.globalAlpha = 0.35 + r() * 0.5; ctx.fillRect(xx, yy, 5, 6); }
          }
        }
        ctx.restore();
        ctx.fillStyle = color;
      }
      if (opts.antennas && r() < 0.6) {
        ctx.strokeStyle = color; ctx.lineWidth = 1.5;
        const ax = x + w * r();
        ctx.beginPath(); ctx.moveTo(ax, baseY - h); ctx.lineTo(ax, baseY - h - 18 - r() * 18); ctx.stroke();
      }
      x += w + 10 + r() * 60;
    }
  }

  // ---- trees -----------------------------------------------------------------
  function tree(ctx, x, y, h, seed, color, t = 0, opts = {}) {
    const r = mulberry32(seed);
    const sway = Math.sin(t * 0.9 + seed) * (opts.sway ?? 1);
    ctx.fillStyle = color; ctx.strokeStyle = color;
    const type = opts.type || 'round';
    // trunk
    const tw = h * (opts.trunkW || 0.045);
    ctx.beginPath();
    ctx.moveTo(x - tw, y); ctx.lineTo(x - tw * 0.6, y - h * 0.45); ctx.lineTo(x + tw * 0.6, y - h * 0.45); ctx.lineTo(x + tw, y);
    ctx.closePath(); ctx.fill();
    if (type === 'bare') {
      // recursive bare branches
      const branch = (bx, by, ang, len, wdt, depth) => {
        const ex = bx + Math.sin(ang) * len, ey = by - Math.cos(ang) * len;
        ctx.lineWidth = wdt; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ex, ey); ctx.stroke();
        if (depth <= 0 || len < 6) return;
        const n = 2 + (r() < 0.35 ? 1 : 0);
        for (let i = 0; i < n; i++) branch(ex, ey, ang + (r() - 0.5) * 1.3 + sway * 0.01, len * (0.62 + r() * 0.2), wdt * 0.65, depth - 1);
      };
      branch(x, y - h * 0.3, sway * 0.01, h * 0.28, tw * 1.4, 6);
      return;
    }
    if (type === 'poplar') {
      const top = y - h;
      ctx.beginPath();
      ctx.moveTo(x, top + sway * 3);
      for (let i = 0; i <= 20; i++) {
        const k = i / 20, yy = top + k * h * 0.92;
        const wdt = Math.sin(Math.min(1, k * 1.25) * Math.PI * 0.95) * h * 0.1 * (0.85 + 0.3 * vnoise(k * 7 + seed));
        ctx.lineTo(x + wdt + sway * 4 * (1 - k), yy);
      }
      for (let i = 20; i >= 0; i--) {
        const k = i / 20, yy = top + k * h * 0.92;
        const wdt = Math.sin(Math.min(1, k * 1.25) * Math.PI * 0.95) * h * 0.1 * (0.85 + 0.3 * vnoise(k * 7 + seed + 3));
        ctx.lineTo(x - wdt + sway * 4 * (1 - k), yy);
      }
      ctx.closePath(); ctx.fill();
      return;
    }
    // round canopy made of blobs
    const cy = y - h * 0.62, cr = h * (opts.crown || 0.36);
    const nb = opts.blobs || 16;
    // branches into the crown
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.45;
      ctx.lineWidth = tw * 0.7;
      ctx.beginPath(); ctx.moveTo(x, y - h * 0.4);
      ctx.lineTo(x + Math.cos(a) * cr * 0.7, cy + Math.sin(a) * cr * 0.45 + cr * 0.2); ctx.stroke();
    }
    // outline: noisy ellipse
    ctx.beginPath();
    for (let i = 0; i <= 72; i++) {
      const a = (i / 72) * TAU;
      const n = 0.82 + 0.12 * vnoise(a * 3 + seed) + 0.07 * vnoise(a * 11 + seed * 2) + 0.04 * Math.sin(a * 23 + t * 0.8 + seed);
      const px = x + Math.cos(a) * cr * 1.18 * n + sway * 5 * (1 - (Math.sin(a) + 1) / 2);
      const py = cy + Math.sin(a) * cr * 0.86 * n;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill();
    // leaf clumps breaking the outline
    for (let i = 0; i < nb * 5; i++) {
      const a = r() * TAU, d = cr * (0.78 + r() * 0.14);
      const bx = x + Math.cos(a) * d * 1.12 + sway * 5 * (1 - (Math.sin(a) + 1) / 2);
      const by = cy + Math.sin(a) * d * 0.82;
      ctx.beginPath(); ctx.arc(bx, by, cr * (0.02 + r() * 0.04), 0, TAU); ctx.fill();
    }
    // a few sky holes through the leaves
    if (opts.holes) {
      ctx.fillStyle = opts.holes;
      for (let i = 0; i < 10; i++) {
        const a = r() * TAU, d = Math.sqrt(r()) * cr * 0.7;
        ctx.globalAlpha = 0.5 + r() * 0.4;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * d, cy + Math.sin(a) * d * 0.7, 2 + r() * 5, 0, TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
    }
    if (opts.blossoms) {
      const br = mulberry32(seed + 99);
      ctx.fillStyle = opts.blossoms;
      for (let i = 0; i < 70; i++) {
        const a = br() * TAU, d = Math.sqrt(br()) * cr;
        const bx = x + Math.cos(a) * d * 1.15, by = cy + Math.sin(a) * d * 0.8;
        ctx.globalAlpha = 0.25 + br() * 0.5;
        ctx.fillRect(bx, by, 2.5, 2.5);
      }
      ctx.globalAlpha = 1;
    }
  }

  // ---- street lamp -----------------------------------------------------------
  function lamp(ctx, x, y, h, color, on = 0, lightColor = '#ffb766', t = 0) {
    ctx.strokeStyle = color; ctx.fillStyle = color;
    ctx.lineWidth = Math.max(3, h * 0.022);
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h);
    ctx.quadraticCurveTo(x, y - h - h * 0.08, x + h * 0.14, y - h - h * 0.06);
    ctx.stroke();
    const hx = x + h * 0.15, hy = y - h - h * 0.05;
    ctx.beginPath(); ctx.ellipse(hx, hy, h * 0.07, h * 0.022, 0, 0, TAU); ctx.fill();
    if (on > 0) {
      const flick = on < 1 ? on : 1;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, hx, hy + 4, h * 0.75, lightColor, 0.4 * flick);
      drawGlow(ctx, hx, hy + 3, h * 0.1, '#fff3d6', 0.95 * flick, 0.5);
      // light cone
      const g = ctx.createLinearGradient(0, hy, 0, y);
      g.addColorStop(0, rgba(hex(lightColor), 0.16 * flick));
      g.addColorStop(1, rgba(hex(lightColor), 0.0));
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(hx - h * 0.05, hy); ctx.lineTo(hx + h * 0.05, hy); ctx.lineTo(hx + h * 0.55, y); ctx.lineTo(hx - h * 0.55, y); ctx.closePath(); ctx.fill();
      // pool of light on the ground
      ctx.save(); ctx.translate(hx, y); ctx.scale(1, 0.18);
      drawGlow(ctx, 0, 0, h * 0.8, lightColor, 0.35 * flick);
      ctx.restore();
      ctx.restore();
    }
    return [hx, hy];
  }

  // carpet-beater bar (the playground of every block)
  function beater(ctx, x, y, w, h, color) {
    ctx.strokeStyle = color; ctx.lineWidth = 7; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y); ctx.lineTo(x, y - h);
    ctx.moveTo(x + w, y); ctx.lineTo(x + w, y - h);
    ctx.moveTo(x - 6, y - h); ctx.lineTo(x + w + 6, y - h);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(x, y - h * 0.55); ctx.lineTo(x + w, y - h * 0.55); ctx.stroke();
  }

  function powerLines(ctx, x0, y0, x1, y1, sag, color, n = 3, gap = 10) {
    ctx.strokeStyle = color; ctx.lineWidth = 1.4;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      ctx.moveTo(x0, y0 + i * gap);
      ctx.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + sag + i * gap, x1, y1 + i * gap);
      ctx.stroke();
    }
  }

  // ---- particles ----------------------------------------------------------------
  // floating dust motes / pollen lit by warm light
  function motes(ctx, seed, n, t, opts = {}) {
    const r = mulberry32(seed);
    const col = opts.color || '#ffe7b8';
    const region = opts.region || [0, 0, W, H];
    ctx.save();
    ctx.globalCompositeOperation = opts.comp || 'lighter';
    for (let i = 0; i < n; i++) {
      const bx = r(), by = r(), sp = 0.3 + r(), ph = r() * 100, sz = (opts.size || 2.2) * (0.4 + r() * r() * 2.4);
      let x = region[0] + fract(bx + t * 0.006 * sp * (opts.drift ?? 1) + Math.sin(t * 0.3 * sp + ph) * 0.01) * region[2];
      let y = region[1] + fract(by - t * 0.01 * sp * (opts.rise ?? 1) + Math.sin(t * 0.5 * sp + ph) * 0.006) * region[3];
      const tw = 0.5 + 0.5 * Math.sin(t * 2 * sp + ph);
      const a = (opts.alpha ?? 0.8) * (0.3 + 0.7 * tw);
      if (opts.mask && !opts.mask(x, y)) continue;
      drawGlow(ctx, x, y, sz * 3.5, col, a * 0.5);
      ctx.globalAlpha = a; ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(x, y, sz * 0.6, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function fireflies(ctx, seed, n, t, region, alpha = 1, color = '#e6ff9a') {
    const r = mulberry32(seed);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const x0 = region[0] + r() * region[2], y0 = region[1] + r() * region[3];
      const sp = 0.2 + r() * 0.5, ph = r() * 50;
      const x = x0 + fbm(t * sp * 0.4 + ph, 2) * 120;
      const y = y0 + fbm(t * sp * 0.35 + ph + 30, 2) * 70;
      const pulse = Math.pow(Math.max(0, Math.sin(t * (0.8 + r() * 1.2) + ph)), 3);
      const a = alpha * (0.15 + 0.85 * pulse);
      const s = 2 + r() * 2.5;
      drawGlow(ctx, x, y, s * 9, color, a * 0.55);
      drawGlow(ctx, x, y, s * 2.2, '#fbffe0', a, 0.5);
    }
    ctx.restore();
  }

  function rain(ctx, seed, n, t, alpha = 0.35, color = '#c8d0d8', angle = 0.12, speed = 1500) {
    const r = mulberry32(seed);
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 1.2;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x0 = r() * (W + 200) - 100, ph = r(), len = 18 + r() * 30, sp = speed * (0.7 + r() * 0.6);
      const y = fract(ph + t * sp / H) * (H + 100) - 50;
      const x = x0 + y * angle;
      ctx.moveTo(x, y); ctx.lineTo(x - len * angle, y - len);
    }
    ctx.stroke();
    ctx.restore();
  }

  // swallows: little flapping "m" shapes
  function birds(ctx, seed, n, t, color, region = [0, 100, W, 300], scale = 1) {
    const r = mulberry32(seed);
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = 2.2 * scale; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (let i = 0; i < n; i++) {
      const sp = 60 + r() * 120, dir = r() < 0.5 ? 1 : -1, ph = r() * 1000;
      const x = region[0] + fract(r() + (t * sp * dir) / (region[2] + 400)) * (region[2] + 400) - 200;
      const y = region[1] + r() * region[3] + Math.sin(t * 1.3 + ph) * 25;
      const s = (7 + r() * 7) * scale;
      const flap = Math.sin(t * (9 + r() * 5) + ph);
      ctx.beginPath();
      ctx.moveTo(x - s, y - flap * s * 0.6);
      ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.1, x, y + s * 0.15);
      ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.1, x + s, y - flap * s * 0.6);
      ctx.stroke();
    }
    ctx.restore();
  }

  function bokeh(ctx, seed, n, t, colors, region = [0, 0, W, H], size = [30, 110], alpha = 0.5) {
    const r = mulberry32(seed);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < n; i++) {
      const x = region[0] + r() * region[2] + Math.sin(t * 0.2 + i) * 6;
      const y = region[1] + r() * region[3] + Math.cos(t * 0.17 + i) * 4;
      const s = size[0] + r() * (size[1] - size[0]);
      const c = colors[(r() * colors.length) | 0];
      ctx.globalAlpha = alpha * (0.35 + 0.65 * r()) * (0.85 + 0.15 * Math.sin(t * 1.3 + i * 2));
      ctx.drawImage(bokehSprite(c), x - s / 2, y - s / 2, s, s);
    }
    ctx.restore();
  }

  // volumetric light beam from p0 widening to the far end
  function beam(ctx, x0, y0, x1, y1, w0, w1, color, alpha) {
    const ang = Math.atan2(y1 - y0, x1 - x0), L = Math.hypot(x1 - x0, y1 - y0);
    ctx.save();
    ctx.translate(x0, y0); ctx.rotate(ang);
    ctx.globalCompositeOperation = 'lighter';
    const c = hex(color);
    for (let k = 0; k < 3; k++) {
      const spread = 1 + k * 0.45;
      const g = ctx.createLinearGradient(0, 0, L, 0);
      g.addColorStop(0, rgba(c, alpha * 0.9 / (k + 1)));
      g.addColorStop(0.4, rgba(c, alpha * 0.45 / (k + 1)));
      g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(0, -w0 * spread / 2); ctx.lineTo(L, -w1 * spread / 2); ctx.lineTo(L, w1 * spread / 2); ctx.lineTo(0, w0 * spread / 2);
      ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  }

  // ---- village (grandparents) --------------------------------------------------
  function house(ctx, x, y, w, h, o) {
    // walls
    ctx.fillStyle = o.wall;
    ctx.fillRect(x, y - h, w, h);
    // roof
    ctx.fillStyle = o.roof;
    ctx.beginPath();
    ctx.moveTo(x - w * 0.08, y - h); ctx.lineTo(x + w * 0.5, y - h - w * 0.36); ctx.lineTo(x + w * 1.08, y - h);
    ctx.closePath(); ctx.fill();
    // chimney
    ctx.fillRect(x + w * 0.7, y - h - w * 0.3, w * 0.07, w * 0.16);
    // porch posts
    if (o.porch) {
      ctx.fillStyle = o.roof;
      ctx.fillRect(x - w * 0.08, y - h, w * 1.16, h * 0.06);
      for (let i = 0; i < 4; i++) ctx.fillRect(x + w * (0.02 + i * 0.31), y - h, w * 0.025, h);
    }
    // window
    const wx = x + w * o.winX, wy = y - h * 0.72, ww = w * 0.2, wh = h * 0.4;
    return { wx, wy, ww, wh, chimney: [x + w * 0.735, y - h - w * 0.3] };
  }

  function lightWindow(ctx, win, light, frameColor, silhouette = 0, t = 0) {
    const { wx, wy, ww, wh } = win;
    if (light > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawGlow(ctx, wx + ww / 2, wy + wh / 2, ww * 3.2, '#ffab4d', 0.35 * light);
      ctx.restore();
    }
    const g = ctx.createRadialGradient(wx + ww * 0.5, wy + wh * 0.55, 2, wx + ww * 0.5, wy + wh * 0.5, ww * 0.9);
    g.addColorStop(0, rgba(hex('#ffe2a8'), light));
    g.addColorStop(1, rgba(hex('#e98a3a'), light * 0.95));
    ctx.fillStyle = frameColor;
    ctx.fillRect(wx - 4, wy - 4, ww + 8, wh + 8);
    ctx.fillStyle = '#0b0a12';
    ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = g;
    ctx.fillRect(wx, wy, ww, wh);
    // grandma silhouette behind the curtain line
    if (silhouette > 0.001) {
      ctx.save();
      ctx.beginPath(); ctx.rect(wx, wy, ww, wh); ctx.clip();
      ctx.globalAlpha = silhouette;
      const S = wh * 1.9;
      const sway = Math.sin(t * 0.7) * 2;
      Fig.draw(ctx, { x: wx + ww * 0.52 + sway, y: wy + wh * 1.12, S, body: 'elder', color: '#3b1f10',
        pose: { view: 'front', lean: 0, neck: 4, shL: 12, elL: 25, shR: 12, elR: 25, hipL: 0, hipR: 0 }, scarf: true, bulk: 1.05 });
      ctx.restore();
    }
    // curtains + cross frame
    ctx.fillStyle = rgba(hex('#fff1d0'), 0.18 * light);
    ctx.fillRect(wx, wy, ww * 0.16, wh);
    ctx.fillRect(wx + ww * 0.84, wy, ww * 0.16, wh);
    ctx.fillStyle = frameColor;
    ctx.fillRect(wx + ww * 0.48, wy, ww * 0.04, wh);
    ctx.fillRect(wx, wy + wh * 0.42, ww, wh * 0.04);
  }

  function fence(ctx, x0, x1, y, h, color, gapK = 0.35) {
    ctx.fillStyle = color;
    const pw = h * 0.16;
    for (let x = x0; x < x1; x += pw * (1 + gapK)) {
      const hh = h * (0.92 + 0.08 * hash(x * 0.1));
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x, y - hh); ctx.lineTo(x + pw / 2, y - hh - pw * 0.6); ctx.lineTo(x + pw, y - hh); ctx.lineTo(x + pw, y);
      ctx.closePath(); ctx.fill();
    }
    ctx.fillRect(x0, y - h * 0.75, x1 - x0, h * 0.07);
    ctx.fillRect(x0, y - h * 0.3, x1 - x0, h * 0.07);
  }

  // well sweep ("cumpana"): post + long balancing pole
  function wellSweep(ctx, x, y, h, color, t = 0) {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineCap = 'round';
    ctx.lineWidth = h * 0.035;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - h); ctx.stroke();
    const ang = -0.42 + Math.sin(t * 0.3) * 0.01;
    const L1 = h * 1.4, L2 = h * 0.55;
    const px = x, py = y - h * 0.97;
    ctx.lineWidth = h * 0.022;
    ctx.beginPath();
    ctx.moveTo(px - Math.cos(ang) * L2, py - Math.sin(ang) * L2);
    ctx.lineTo(px + Math.cos(ang) * L1, py + Math.sin(ang) * L1);
    ctx.stroke();
    const ex = px + Math.cos(ang) * L1, ey = py + Math.sin(ang) * L1;
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(ex, ey); ctx.lineTo(ex, y - h * 0.3); ctx.stroke();
    ctx.fillRect(ex - h * 0.05, y - h * 0.3, h * 0.1, h * 0.08);
    // well box
    ctx.fillRect(ex - h * 0.18, y - h * 0.22, h * 0.36, h * 0.22);
    // counterweight
    ctx.beginPath(); ctx.arc(px - Math.cos(ang) * L2, py - Math.sin(ang) * L2 + h * 0.03, h * 0.05, 0, TAU); ctx.fill();
  }

  function grass(ctx, seed, y, color, n = 400, hmax = 26, t = 0, x0 = -20, x1 = W + 20) {
    const r = mulberry32(seed);
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const x = x0 + r() * (x1 - x0), h = hmax * (0.3 + r() * 0.7);
      const sw = Math.sin(t * 1.4 + x * 0.02) * 3 + (r() - 0.5) * 6;
      ctx.moveTo(x, y + 2); ctx.quadraticCurveTo(x + sw * 0.3, y - h * 0.5, x + sw, y - h);
    }
    ctx.stroke();
  }

  return { sky, sun, rays, stars, milkyWay, cloudBand, hills, block, skyline, tree, lamp, beater, powerLines,
    motes, fireflies, rain, birds, bokeh, beam, house, lightWindow, fence, wellSweep, grass };
})();
