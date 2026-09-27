'use strict';
// ---------------------------------------------------------------------------
// Props: cassette + pencil, tape deck, key, sneaker & ball, CRT TV, pixel game,
// monitor + messenger, candybar phone, earbuds, smartphone, projector, OSD.
// ---------------------------------------------------------------------------

const Props = {};

// ---- cassette (top view). Units: mm, scaled by s px/mm, origin = top-left ----
// o: { s, spinL, spinR, packL (0..1 of tape on left reel), label, sub, t, glass }
Props.cassette = function (ctx, x, y, o) {
  const s = o.s || 9;
  const Wm = 100.4, Hm = 63.8;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  // drop shadow
  Soft.draw(ctx, (x) => { x.fillStyle = 'rgba(0,0,0,0.55)'; rrect(x, 2.2, 3.4, Wm, Hm, 3); x.fill(); }, { scale: 0.125, blur: 2 });
  // shell
  ctx.fillStyle = linGrad(ctx, 0, 0, Wm, Hm, [[0, '#2a2830'], [0.5, '#1c1b21'], [1, '#121116']]);
  rrect(ctx, 0, 0, Wm, Hm, 3); ctx.fill();
  ctx.strokeStyle = 'rgba(255,230,200,0.12)'; ctx.lineWidth = 0.35;
  rrect(ctx, 0.3, 0.3, Wm - 0.6, Hm - 0.6, 2.8); ctx.stroke();
  // bottom head-access trapezoid
  ctx.fillStyle = '#16151a';
  ctx.beginPath(); ctx.moveTo(14, 50); ctx.lineTo(86.4, 50); ctx.lineTo(82, Hm); ctx.lineTo(18.4, Hm); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(255,230,200,0.1)'; ctx.stroke();
  // tape visible across the bottom
  ctx.fillStyle = '#4a2a18';
  ctx.fillRect(20, Hm - 2.2, 60.4, 1.1);
  ctx.fillStyle = '#0c0b0e';
  for (const [hx, hw] of [[25, 6], [47.2, 6], [69.4, 6]]) ctx.fillRect(hx, Hm - 5.5, hw, 4.2);
  for (const cx of [21.5, 78.9]) { ctx.beginPath(); ctx.arc(cx, Hm - 4.8, 1.3, 0, TAU); ctx.fill(); }
  // label
  ctx.fillStyle = linGrad(ctx, 0, 3, 0, 47, [[0, '#f3e8cf'], [1, '#e2d3b2']]);
  rrect(ctx, 4.5, 3.2, Wm - 9, 43.5, 1.6); ctx.fill();
  // colour stripes
  ctx.fillStyle = '#d9542f'; ctx.fillRect(4.5, 30.8, Wm - 9, 3.2);
  ctx.fillStyle = '#f0a12e'; ctx.fillRect(4.5, 34.4, Wm - 9, 1.6);
  ctx.fillStyle = '#3b6fa8'; ctx.fillRect(4.5, 36.4, Wm - 9, 0.9);
  // writing lines
  ctx.strokeStyle = 'rgba(80,60,40,0.35)'; ctx.lineWidth = 0.18;
  for (const ly of [10.5, 15.5]) { ctx.beginPath(); ctx.moveTo(14, ly); ctx.lineTo(Wm - 9, ly); ctx.stroke(); }
  // side letter
  ctx.fillStyle = '#2b2a2f';
  ctx.font = '600 7px "Inter"'; ctx.textBaseline = 'alphabetic';
  ctx.fillText('A', 7.2, 11.2);
  ctx.font = '500 2.2px "IBM Plex Mono"';
  ctx.fillStyle = 'rgba(40,35,30,0.7)';
  ctx.fillText('C-60  ·  NORMAL POSITION  ·  TYPE I', 30, 44.6);
  // handwriting
  ctx.fillStyle = '#1f2a55';
  ctx.font = '600 7.6px "Caveat"';
  ctx.save(); ctx.translate(38, 13.6); ctx.rotate(-0.025);
  ctx.fillText(o.label || 'summer mix ’97', 0, 0);
  ctx.restore();
  ctx.font = '400 5px "Caveat"';
  ctx.fillStyle = '#23305c';
  ctx.fillText(o.sub || 'for rainy days ♡', 66, 19.0);
  // window
  const wx = 27, wy = 20.4, ww = 46.4, wh = 11.4;
  ctx.fillStyle = '#0d0c10';
  rrect(ctx, wx - 1, wy - 1, ww + 2, wh + 2, 2); ctx.fill();
  ctx.save();
  rrect(ctx, wx, wy, ww, wh, 1.5); ctx.clip();
  ctx.fillStyle = '#18161b'; ctx.fillRect(wx, wy, ww, wh);
  const hubY = 25.9, hubL = 28.9, hubR = 71.5;
  const rMin = 6.2, rMax = 20.5;
  const area = rMax * rMax + rMin * rMin;
  const pk = clamp(o.packL ?? 0.5);
  const rl = Math.sqrt(rMin * rMin + (rMax * rMax - rMin * rMin) * pk);
  const rr = Math.sqrt(Math.max(rMin * rMin, area - rl * rl));
  for (const [cx, rad] of [[hubL, rl], [hubR, rr]]) {
    ctx.fillStyle = radGrad(ctx, cx, hubY, rMin, rad, [[0, '#3b2214'], [0.7, '#56321c'], [0.97, '#6e4426'], [1, '#2a170d']]);
    ctx.beginPath(); ctx.arc(cx, hubY, rad, 0, TAU); ctx.fill();
    // concentric sheen
    ctx.strokeStyle = 'rgba(255,200,150,0.07)'; ctx.lineWidth = 0.25;
    for (let rr2 = rMin + 1; rr2 < rad; rr2 += 1.3) { ctx.beginPath(); ctx.arc(cx, hubY, rr2, 0, TAU); ctx.stroke(); }
  }
  // hubs with teeth
  for (const [cx, spin] of [[hubL, o.spinL || 0], [hubR, o.spinR || 0]]) {
    ctx.save(); ctx.translate(cx, hubY); ctx.rotate(spin);
    ctx.fillStyle = '#efe9dc';
    ctx.beginPath(); ctx.arc(0, 0, rMin, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0d0c10';
    ctx.beginPath(); ctx.arc(0, 0, 4.1, 0, TAU); ctx.fill();
    ctx.fillStyle = '#efe9dc';
    for (let k = 0; k < 6; k++) { ctx.save(); ctx.rotate((k * TAU) / 6); ctx.fillRect(-0.55, -4.2, 1.1, 1.6); ctx.restore(); }
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.arc(0, 0, rMin, 0.3, 1.9); ctx.lineTo(0, 0); ctx.fill();
    ctx.restore();
  }
  // glass reflection
  ctx.fillStyle = 'rgba(255,240,220,0.08)';
  ctx.beginPath(); ctx.moveTo(wx + 6, wy); ctx.lineTo(wx + 16, wy); ctx.lineTo(wx + 8, wy + wh); ctx.lineTo(wx - 2, wy + wh); ctx.closePath(); ctx.fill();
  ctx.restore();
  // screws
  for (const [sx, sy] of [[3.2, 3.2], [Wm - 3.2, 3.2], [3.2, Hm - 3.2], [Wm - 3.2, Hm - 3.2], [Wm / 2, Hm - 8.6]]) {
    ctx.fillStyle = '#8c8a86'; ctx.beginPath(); ctx.arc(sx, sy, 1.25, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#3a3936'; ctx.lineWidth = 0.35;
    ctx.beginPath(); ctx.moveTo(sx - 0.8, sy); ctx.lineTo(sx + 0.8, sy); ctx.moveTo(sx, sy - 0.8); ctx.lineTo(sx, sy + 0.8); ctx.stroke();
  }
  // specular sweep across the shell
  if (o.glass) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = linGrad(ctx, 0, 0, Wm, Hm, [[0, 'rgba(255,220,180,0)'], [clamp(o.glass - 0.08), 'rgba(255,220,180,0)'], [clamp(o.glass), 'rgba(255,225,190,0.12)'], [clamp(o.glass + 0.08), 'rgba(255,220,180,0)'], [1, 'rgba(0,0,0,0)']]);
    rrect(ctx, 0, 0, Wm, Hm, 3); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  return { hubL: [x + hubL * s, y + hubY * s], hubR: [x + hubR * s, y + hubY * s] };
};

// a yellow hexagonal pencil from p0 (inserted end) to p1 (eraser end, closer to camera)
Props.pencil = function (ctx, p0, p1, w0, w1, phase) {
  const ang = Math.atan2(p1[1] - p0[1], p1[0] - p0[0]);
  const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  ctx.save();
  ctx.translate(p0[0], p0[1]);
  ctx.rotate(ang);
  // soft shadow on the cassette
  Soft.draw(ctx, (x) => { x.fillStyle = 'rgba(0,0,0,0.5)'; x.beginPath(); x.moveTo(0, -w0 * 0.3 + 24); x.lineTo(L * 0.5, 30 - w1 * 0.2); x.lineTo(L * 0.5, 30 + w1 * 0.5); x.lineTo(0, w0 * 0.3 + 24); x.fill(); }, { scale: 0.125, blur: 1.5 });
  // body: three visible facets whose shading rotates with phase
  const facets = 3;
  const bodyEnd = L * 0.86;
  for (let f = 0; f < facets; f++) {
    const a0 = -1 + (2 * f) / facets, a1 = -1 + (2 * (f + 1)) / facets;
    const light = 0.55 + 0.45 * Math.cos(phase + f * 1.05 - 1.05);
    const col = mixc(hex('#a86f10'), hex('#ffd35a'), clamp(light));
    ctx.fillStyle = rgba(col, 1);
    ctx.beginPath();
    ctx.moveTo(0, (a0 * w0) / 2); ctx.lineTo(bodyEnd, (a0 * w1) / 2); ctx.lineTo(bodyEnd, (a1 * w1) / 2); ctx.lineTo(0, (a1 * w0) / 2);
    ctx.closePath(); ctx.fill();
  }
  // printed gold band that travels around as it spins
  const band = Math.sin(phase * 1.0);
  ctx.fillStyle = `rgba(40,70,40,${0.55 * (0.5 + 0.5 * Math.cos(phase))})`;
  ctx.fillRect(L * 0.45, (band * w0) / 3 - w0 * 0.12, L * 0.22, w0 * 0.1);
  // ferrule + eraser
  ctx.fillStyle = linGrad(ctx, 0, -w1 / 2, 0, w1 / 2, [[0, '#9a9a96'], [0.4, '#e6e4de'], [1, '#6c6b68']]);
  ctx.fillRect(bodyEnd, -w1 / 2, L * 0.05, w1);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
  for (let k = 1; k < 4; k++) { ctx.beginPath(); ctx.moveTo(bodyEnd + (L * 0.05 * k) / 4, -w1 / 2); ctx.lineTo(bodyEnd + (L * 0.05 * k) / 4, w1 / 2); ctx.stroke(); }
  ctx.fillStyle = linGrad(ctx, 0, -w1 / 2, 0, w1 / 2, [[0, '#c56a6a'], [0.45, '#f0a0a0'], [1, '#9a4a4e']]);
  rrect(ctx, bodyEnd + L * 0.05, -w1 / 2, L * 0.09, w1, w1 * 0.25); ctx.fill();
  // inserted end sits in the hub: darken
  ctx.fillStyle = linGrad(ctx, 0, 0, L * 0.12, 0, [[0, 'rgba(0,0,0,0.65)'], [1, 'rgba(0,0,0,0)']]);
  ctx.fillRect(0, -w0 / 2, L * 0.12, w0);
  ctx.restore();
};

// ---- tape deck / boombox front: keys, cassette door, VU meters ----
// o: { pressed: {rec, play}, level: [l, r], reel, cassetteLabel, led }
Props.deck = function (ctx, o) {
  const t = o.t || 0;
  // body
  ctx.fillStyle = linGrad(ctx, 0, 0, 0, H, [[0, '#2b2a2e'], [0.5, '#1d1c20'], [1, '#141316']]);
  ctx.fillRect(0, 0, W, H);
  // brushed metal texture lines
  ctx.strokeStyle = 'rgba(255,255,255,0.025)'; ctx.lineWidth = 1;
  const r = mulberry32(44);
  ctx.beginPath();
  for (let i = 0; i < 160; i++) { const yy = r() * H; ctx.moveTo(0, yy); ctx.lineTo(W, yy + (r() - 0.5) * 2); }
  ctx.stroke();
  // cassette door (left)
  const dx = 150, dy = 170, dw = 900, dh = 560;
  ctx.fillStyle = '#0c0b0e';
  rrect(ctx, dx - 14, dy - 14, dw + 28, dh + 28, 22); ctx.fill();
  ctx.fillStyle = 'rgba(40,36,44,0.9)';
  rrect(ctx, dx, dy, dw, dh, 14); ctx.fill();
  // cassette inside, seen through the smoked window
  ctx.save();
  rrect(ctx, dx, dy, dw, dh, 14); ctx.clip();
  const c = Props.cassette(ctx, dx + 40, dy + 60, { s: 8.2, spinL: o.reel || 0, spinR: (o.reel || 0) * 1.2, packL: o.packL ?? 0.8, label: o.cassetteLabel, t });
  ctx.fillStyle = 'rgba(20,16,26,0.45)';
  ctx.fillRect(dx, dy, dw, dh);
  // window reflection
  ctx.fillStyle = linGrad(ctx, dx, dy, dx + dw, dy + dh, [[0, 'rgba(255,255,255,0.10)'], [0.35, 'rgba(255,255,255,0.02)'], [0.36, 'rgba(255,255,255,0.0)'], [1, 'rgba(255,255,255,0.05)']]);
  ctx.fillRect(dx, dy, dw, dh);
  ctx.restore();
  ctx.font = '500 26px "IBM Plex Mono"'; ctx.fillStyle = 'rgba(220,214,200,0.55)';
  ctx.letterSpacing = '8px';
  ctx.fillText('AUTO REVERSE · DOLBY-FREE', dx, dy - 40);
  ctx.letterSpacing = '0px';
  // VU meters (right)
  const vx = 1180, vy = 180;
  for (let k = 0; k < 2; k++) {
    const mx = vx + k * 330, my = vy;
    ctx.fillStyle = '#0c0b0e'; rrect(ctx, mx - 8, my - 8, 316, 206, 14); ctx.fill();
    const lit = o.backlight ?? 1;
    ctx.fillStyle = linGrad(ctx, mx, my, mx, my + 190, [[0, mixh('#3a2c18', '#f6d9a0', lit)], [1, mixh('#2a1f12', '#e8b670', lit)]]);
    rrect(ctx, mx, my, 300, 190, 10); ctx.fill();
    // scale
    ctx.save(); ctx.translate(mx + 150, my + 175);
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 0, 130, -Math.PI * 0.78, -Math.PI * 0.22); ctx.stroke();
    ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 0, 130, -Math.PI * 0.34, -Math.PI * 0.22); ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = '#3a2a1a';
    for (let i = 0; i <= 10; i++) {
      const a = -Math.PI * 0.78 + (i / 10) * Math.PI * 0.56;
      ctx.beginPath(); ctx.moveTo(Math.cos(a) * 130, Math.sin(a) * 130); ctx.lineTo(Math.cos(a) * (i % 5 === 0 ? 112 : 120), Math.sin(a) * (i % 5 === 0 ? 112 : 120)); ctx.stroke();
    }
    ctx.font = '600 22px "IBM Plex Mono"'; ctx.fillStyle = '#3a2a1a'; ctx.textAlign = 'center';
    ctx.fillText('VU', 0, -40);
    const lv = (o.level ? o.level[k] : 0);
    const a = -Math.PI * 0.78 + clamp(lv) * Math.PI * 0.56;
    ctx.strokeStyle = '#1a1410'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 150, Math.sin(a) * 150); ctx.stroke();
    ctx.fillStyle = '#1a1410'; ctx.beginPath(); ctx.arc(0, 0, 10, 0, TAU); ctx.fill();
    ctx.textAlign = 'left';
    ctx.restore();
    if (lit > 0.05) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, mx + 150, my + 95, 260, '#ffb44a', 0.22 * lit); ctx.restore(); }
  }
  // keys
  const keys = [['●', 'REC', '#d23b2c'], ['◀◀', 'REW'], ['▶', 'PLAY'], ['▶▶', 'F.FWD'], ['■', 'STOP'], ['⏏', 'EJECT']];
  const kx0 = 150, ky = 800, kw = 250, kh = 190, gap = 18;
  keys.forEach(([sym, name, col], i) => {
    const pressed = (name === 'PLAY' && o.pressed?.play) || (name === 'REC' && o.pressed?.rec) || 0;
    const px = kx0 + i * (kw + gap);
    const down = pressed * 22;
    ctx.fillStyle = '#070608';
    rrect(ctx, px - 6, ky - 6, kw + 12, kh + 40, 14); ctx.fill();
    ctx.fillStyle = linGrad(ctx, 0, ky + down, 0, ky + kh + down, [[0, pressed ? '#9a9892' : '#d8d6d0'], [0.12, pressed ? '#77756f' : '#b9b7b0'], [1, pressed ? '#4a4945' : '#77756f']]);
    rrect(ctx, px, ky + down, kw, kh, 10); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(px + 10, ky + down + 4, kw - 20, 3);
    ctx.font = '600 58px "Inter"'; ctx.textAlign = 'center';
    ctx.fillStyle = col || '#1f1e22';
    ctx.fillText(sym, px + kw / 2, ky + down + 110);
    if (pressed && name === 'REC') { ctx.save(); ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, px + kw / 2, ky + down + 90, 120, '#ff4a2a', 0.7 * pressed); ctx.restore(); }
    ctx.font = '500 22px "IBM Plex Mono"';
    ctx.fillStyle = 'rgba(30,30,32,0.8)';
    ctx.fillText(name, px + kw / 2, ky + down + 160);
    ctx.textAlign = 'left';
  });
  // play LED
  const led = o.led || 0;
  ctx.fillStyle = mixh('#3a1010', '#ff4a2a', led);
  ctx.beginPath(); ctx.arc(1210, 460, 12, 0, TAU); ctx.fill();
  if (led > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, 1210, 460, 70, '#ff5a30', 0.6 * led); ctx.restore(); }
  ctx.font = '500 22px "IBM Plex Mono"'; ctx.fillStyle = 'rgba(220,214,200,0.55)';
  ctx.fillText('PLAY / REC', 1240, 468);
  // tape counter
  ctx.fillStyle = '#060507'; rrect(ctx, 1500, 430, 330, 70, 8); ctx.fill();
  const cnt = String(Math.floor(o.counter || 0)).padStart(3, '0');
  ctx.font = '400 60px "VT323"'; ctx.fillStyle = '#e9e4d6';
  ctx.letterSpacing = '18px';
  ctx.fillText(cnt, 1560, 485);
  ctx.letterSpacing = '0px';
  // speaker grille hint at the far right bottom edge
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let yy = 560; yy < 760; yy += 16) for (let xx = 1200; xx < 1840; xx += 16) { ctx.beginPath(); ctx.arc(xx, yy, 4, 0, TAU); ctx.fill(); }
  return c;
};

// camcorder style overlay (● REC + timecode)
Props.recOSD = function (ctx, t, t0, alpha = 1) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const blink = Math.floor((t - t0) * 1.6) % 2 === 0;
  ctx.font = '400 64px "VT323"';
  ctx.fillStyle = '#fff6ee';
  ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 0; ctx.shadowOffsetX = 3; ctx.shadowOffsetY = 3;
  if (blink) { ctx.fillStyle = '#ff3b30'; ctx.beginPath(); ctx.arc(120, 102, 16, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#fff6ee';
  ctx.fillText('REC', 150, 122);
  const el = Math.max(0, t - t0);
  const hh = Math.floor(el / 3600), mm = Math.floor(el / 60) % 60, ss = Math.floor(el) % 60, ff = Math.floor((el % 1) * 24);
  const tc = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
  ctx.textAlign = 'right';
  ctx.fillText(tc, W - 110, 122);
  ctx.font = '400 48px "VT323"';
  ctx.fillText('TODAY', W - 110, H - 96);
  ctx.textAlign = 'left';
  ctx.fillText('SP  ▶', 110, H - 96);
  // corner brackets
  ctx.strokeStyle = 'rgba(255,246,238,0.85)'; ctx.lineWidth = 4; ctx.shadowBlur = 0;
  const m = 60, L = 70;
  for (const [cx, cy, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(cx, cy + sy * L); ctx.lineTo(cx, cy); ctx.lineTo(cx + sx * L, cy); ctx.stroke();
  }
  ctx.restore();
};

// ---- low-res blurred background helper (draw small, upscale = depth of field)
Props.blurBG = (() => {
  const k = 0.125;
  const [c, x] = makeCanvas(W * k, H * k);
  return (ctx, fn) => {
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height);
    x.setTransform(k, 0, 0, k, 0, 0);
    fn(x);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(c, 0, 0, W, H); ctx.restore();
  };
})();

// 4-point star glint
Props.glint = function (ctx, x, y, size, alpha, color = '#fff4dc') {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, x, y, size * 0.6, color, alpha * 0.8, 0.3);
  const c = hex(color);
  for (const [a, len] of [[0, 1], [Math.PI / 2, 1], [Math.PI / 4, 0.45], [-Math.PI / 4, 0.45]]) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(a);
    const g = ctx.createLinearGradient(-size * len, 0, size * len, 0);
    g.addColorStop(0, rgba(c, 0)); g.addColorStop(0.5, rgba(c, alpha)); g.addColorStop(1, rgba(c, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(-size * len, 0); ctx.lineTo(0, -size * 0.025); ctx.lineTo(size * len, 0); ctx.lineTo(0, size * 0.025); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
};

// ---- brass flat key hanging from a ring; spin = rotation around the vertical axis
Props.key = function (ctx, x, y, L, spin, sway) {
  const c = Math.cos(spin);
  const face = Math.abs(c);
  const side = c >= 0 ? 1 : -1;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(sway);
  // split ring
  ctx.strokeStyle = '#b8b2a4'; ctx.lineWidth = L * 0.018;
  ctx.beginPath(); ctx.ellipse(0, L * 0.02, L * 0.09 * Math.max(0.25, face), L * 0.09, 0, 0, TAU); ctx.stroke();
  ctx.translate(0, L * 0.1);
  ctx.scale(Math.max(0.06, face), 1);
  const w = L * 0.34; // head width
  const brassA = side > 0 ? ['#7a5418', '#e2b04e', '#fff0b0', '#c89236', '#6e4a14'] : ['#6a4812', '#c99a3e', '#f3dc98', '#a97a2a', '#5a3c10'];
  const g = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
  const shift = (Math.sin(spin * 2) + 1) / 2;
  g.addColorStop(0, brassA[0]); g.addColorStop(clamp(0.25 + shift * 0.2), brassA[1]); g.addColorStop(clamp(0.45 + shift * 0.2), brassA[2]);
  g.addColorStop(clamp(0.65 + shift * 0.15), brassA[3]); g.addColorStop(1, brassA[4]);
  ctx.fillStyle = g;
  // head (bow)
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(w * 0.62, 0, w * 0.62, L * 0.3, w * 0.2, L * 0.33);
  ctx.lineTo(w * 0.16, L * 0.37);
  // blade with teeth on the right edge
  const bw = w * 0.34;
  ctx.lineTo(bw * 0.55, L * 0.4);
  const teeth = [0.44, 0.5, 0.56, 0.62, 0.68, 0.74, 0.8, 0.86];
  teeth.forEach((ty, i) => {
    const d = [0.25, 0.1, 0.3, 0.05, 0.22, 0.12, 0.28, 0.08][i];
    ctx.lineTo(bw * (0.55 + d), L * ty);
    ctx.lineTo(bw * 0.55, L * (ty + 0.03));
  });
  ctx.lineTo(bw * 0.4, L * 0.95);
  ctx.lineTo(-bw * 0.45, L * 0.97);
  ctx.lineTo(-bw * 0.5, L * 0.4);
  ctx.lineTo(-w * 0.16, L * 0.37);
  ctx.lineTo(-w * 0.2, L * 0.33);
  ctx.bezierCurveTo(-w * 0.62, L * 0.3, -w * 0.62, 0, 0, 0);
  ctx.closePath(); ctx.fill();
  // hole
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath(); ctx.arc(0, L * 0.07, L * 0.035, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'source-over';
  // groove along the blade
  ctx.strokeStyle = 'rgba(80,50,10,0.55)'; ctx.lineWidth = L * 0.01;
  ctx.beginPath(); ctx.moveTo(-bw * 0.1, L * 0.42); ctx.lineTo(-bw * 0.1, L * 0.93); ctx.stroke();
  // edge thickness when edge-on
  ctx.restore();
  return face;
};

// ---- soccer ball: pentagons on a rotating sphere
Props.ball = (() => {
  // icosahedron vertices = pentagon centres of a truncated icosahedron
  const phi = (1 + Math.sqrt(5)) / 2;
  const V = [];
  for (const a of [-1, 1]) for (const b of [-phi, phi]) { V.push([0, a, b], [a, b, 0], [b, 0, a]); }
  const N = V.map(([x, y, z]) => { const l = Math.hypot(x, y, z); return [x / l, y / l, z / l]; });
  return function (ctx, x, y, R, rot, light = [-0.5, -0.6]) {
    // body
    ctx.save();
    ctx.fillStyle = radGrad(ctx, x + light[0] * R * 0.45, y + light[1] * R * 0.45, R * 0.1, R * 1.25, [[0, '#fbf6ea'], [0.55, '#e2d8c4'], [1, '#6e6454']], x, y);
    ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.clip();
    const [ax, ay] = rot; // rotation around x (rolling) and y
    const cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay);
    for (const n of N) {
      // rotate
      let [px, py, pz] = n;
      let y1 = py * cx - pz * sx, z1 = py * sx + pz * cx; py = y1; pz = z1;
      let x2 = px * cy + pz * sy, z2 = -px * sy + pz * cy; px = x2; pz = z2;
      if (pz < -0.2) continue;
      // tangent basis
      const up = Math.abs(py) < 0.9 ? [0, 1, 0] : [1, 0, 0];
      let tx = [up[1] * pz - up[2] * py, up[2] * px - up[0] * pz, up[0] * py - up[1] * px];
      let tl = Math.hypot(...tx); tx = tx.map((v) => v / tl);
      const ty = [py * tx[2] - pz * tx[1], pz * tx[0] - px * tx[2], px * tx[1] - py * tx[0]];
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU + 0.3;
        const r0 = 0.36;
        const qx = px + (Math.cos(a) * tx[0] + Math.sin(a) * ty[0]) * r0;
        const qy = py + (Math.cos(a) * tx[1] + Math.sin(a) * ty[1]) * r0;
        const qz = pz + (Math.cos(a) * tx[2] + Math.sin(a) * ty[2]) * r0;
        const l = Math.hypot(qx, qy, qz);
        const X = x + (qx / l) * R, Y = y - (qy / l) * R;
        if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      }
      ctx.closePath();
      const shade = clamp(0.35 + 0.65 * pz);
      ctx.fillStyle = rgba(mixc(hex('#0c0b0d'), hex('#2b2828'), shade), 1);
      ctx.fill();
    }
    // shading overlay
    ctx.fillStyle = radGrad(ctx, x + light[0] * R * 0.5, y + light[1] * R * 0.5, R * 0.2, R * 1.4, [[0, 'rgba(255,240,210,0.18)'], [0.6, 'rgba(0,0,0,0)'], [1, 'rgba(20,8,6,0.55)']], x, y);
    ctx.fillRect(x - R, y - R, R * 2, R * 2);
    ctx.restore();
    // rim light from behind
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = 'rgba(255,190,120,0.55)'; ctx.lineWidth = R * 0.05;
    ctx.beginPath(); ctx.arc(x, y, R * 0.98, -Math.PI * 0.95, -Math.PI * 0.35); ctx.stroke();
    ctx.restore();
  };
})();

// ---- a '90s sneaker (side view), toe to +x; (x,y) = bottom of the heel
Props.sneaker = function (ctx, x, y, L, ang, colors = {}) {
  const c = Object.assign({ upper: '#f1ece2', shade: '#cfc6b6', sole: '#e8e0cf', soleLine: '#b8452f', accent: '#2f5aa0', accent2: '#c8402c', lace: '#fdfaf2', sock: '#f6f2e8', leg: '#b07a55' }, colors);
  ctx.save();
  ctx.translate(x, y); ctx.rotate(ang);
  const h = L * 0.36;
  // leg + sock
  ctx.fillStyle = linGrad(ctx, L * 0.1, 0, L * 0.44, 0, [[0, '#6e4630'], [0.55, c.leg], [0.85, '#e0a878'], [1, '#ffd0a0']]);
  ctx.beginPath(); ctx.moveTo(L * 0.12, -h * 0.9); ctx.bezierCurveTo(L * 0.08, -h * 2.2, L * 0.06, -h * 3.2, L * 0.02, -h * 5.6); ctx.lineTo(L * 0.5, -h * 5.6); ctx.bezierCurveTo(L * 0.46, -h * 3.2, L * 0.43, -h * 2.2, L * 0.4, -h * 0.9); ctx.closePath(); ctx.fill();
  ctx.fillStyle = c.sock;
  rrect(ctx, L * 0.09, -h * 1.45, L * 0.34, h * 0.7, h * 0.12); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; ctx.fillRect(L * 0.09, -h * 1.3, L * 0.34, h * 0.06); ctx.fillRect(L * 0.09, -h * 1.18, L * 0.34, h * 0.06);
  // sole
  ctx.fillStyle = c.sole;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(L * 0.94, 0);
  ctx.quadraticCurveTo(L * 1.03, -h * 0.02, L * 1.0, -h * 0.25);
  ctx.lineTo(0, -h * 0.25); ctx.closePath(); ctx.fill();
  ctx.fillStyle = c.soleLine; ctx.fillRect(0, -h * 0.17, L * 0.99, h * 0.045);
  // upper
  ctx.fillStyle = linGrad(ctx, 0, -h, 0, -h * 0.2, [[0, c.upper], [1, c.shade]]);
  ctx.beginPath();
  ctx.moveTo(0, -h * 0.25);
  ctx.bezierCurveTo(-L * 0.03, -h * 0.7, L * 0.02, -h * 1.05, L * 0.12, -h * 1.1);
  ctx.lineTo(L * 0.42, -h * 1.05);
  ctx.bezierCurveTo(L * 0.55, -h * 0.85, L * 0.75, -h * 0.62, L * 0.9, -h * 0.5);
  ctx.bezierCurveTo(L * 1.02, -h * 0.42, L * 1.02, -h * 0.28, L * 0.98, -h * 0.25);
  ctx.closePath(); ctx.fill();
  // accent panel + stripe
  ctx.fillStyle = c.accent;
  ctx.beginPath(); ctx.moveTo(L * 0.18, -h * 0.3); ctx.bezierCurveTo(L * 0.35, -h * 0.75, L * 0.55, -h * 0.6, L * 0.7, -h * 0.3); ctx.closePath(); ctx.fill();
  ctx.fillStyle = c.accent2;
  ctx.fillRect(0, -h * 0.72, L * 0.07, h * 0.4);
  // laces
  ctx.strokeStyle = c.lace; ctx.lineWidth = L * 0.018; ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const px = L * (0.46 + i * 0.075), py = -h * (0.98 - i * 0.1);
    ctx.beginPath(); ctx.moveTo(px - L * 0.03, py - h * 0.02); ctx.lineTo(px + L * 0.03, py + h * 0.05); ctx.stroke();
  }
  // toe cap
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.ellipse(L * 0.9, -h * 0.4, L * 0.06, h * 0.1, -0.4, 0, TAU); ctx.fill();
  ctx.restore();
};

// ---- 8-bit game (original sprites), rendered at 256x224 then upscaled
Props.game = (() => {
  const GW = 256, GH = 224;
  const [c, x] = makeCanvas(GW, GH);
  const PAL = { '.': null, g: '#2e9e4f', G: '#1b6b33', k: '#101018', s: '#f2c49a', o: '#f08a24', b: '#2f5fc4', w: '#f4f4f4', p: '#8a4ad0', y: '#ffd23c', r: '#d8402c' };
  const HERO = [
    '.....gggggg.....', '....gggggggggg..', '....kkksssk.....', '...ksksssskss...', '...ksskssssss...', '....sssssskk....',
    '.....sssss......', '....oooooo......', '...oooooooos....', '..ssooooooss....', '..ss.oooo.......', '.....bbbbb......',
    '....bbb.bbb.....', '....bb...bb.....', '...www...www....', '..wwww...wwww...'];
  const HERO_RUN = [
    '.....gggggg.....', '....gggggggggg..', '....kkksssk.....', '...ksksssskss...', '...ksskssssss...', '....sssssskk....',
    '.....sssss......', '....oooooo......', '...ooooooooss...', '..ssoooooo.ss...', '.....oooo.......', '....bbbbbb......',
    '...bbb..bbbb....', '..www.....bb....', '.www......www...', '..........www...'];
  const BLOB = [
    '................', '......pppp......', '....pppppppp....', '...pppppppppp...', '..ppwwppppwwpp..', '..ppwkppppwkpp..',
    '.pppppppppppppp.', '.pppppppppppppp.', '..pppkkkkkkppp..', '...pppppppppp...', '....kk....kk....', '...kkk....kkk...'];
  function spr(rows, px, py, flip) {
    rows.forEach((row, j) => {
      for (let i = 0; i < row.length; i++) {
        const col = PAL[row[flip ? row.length - 1 - i : i]];
        if (col) { x.fillStyle = col; x.fillRect(px + i, py + j, 1, 1); }
      }
    });
  }
  function render(gt, glitch = 0) {
    x.imageSmoothingEnabled = false;
    // sky
    const bands = ['#7aa2ff', '#86acff', '#94b6ff', '#a4c2ff'];
    bands.forEach((b, i) => { x.fillStyle = b; x.fillRect(0, i * 40, GW, 40); });
    x.fillStyle = '#b4ceff'; x.fillRect(0, 160, GW, 64);
    const cam = gt * 38;
    // clouds
    x.fillStyle = '#ffffff';
    for (let i = 0; i < 6; i++) {
      const cx = ((i * 97 - cam * 0.3) % 360 + 360) % 360 - 50, cy = 30 + (i % 3) * 18;
      x.fillRect(cx, cy, 30, 8); x.fillRect(cx + 6, cy - 5, 18, 6); x.fillRect(cx - 3, cy + 3, 36, 5);
    }
    // hills
    for (let i = 0; i < 5; i++) {
      const hx = ((i * 140 - cam * 0.5) % 700 + 700) % 700 - 100;
      x.fillStyle = '#3aa655';
      x.beginPath(); x.ellipse(hx, 184, 60, 40, 0, Math.PI, 0); x.fill();
      x.fillStyle = '#2a7d40'; x.fillRect(hx - 8, 160, 3, 3); x.fillRect(hx + 10, 170, 3, 3);
    }
    // ground bricks
    for (let gx = -16 - (cam % 16); gx < GW + 16; gx += 16) {
      for (let gy = 184; gy < GH; gy += 8) {
        x.fillStyle = '#b8642c'; x.fillRect(gx, gy, 16, 8);
        x.fillStyle = '#6a3014'; x.fillRect(gx, gy + 7, 16, 1); x.fillRect(gx + ((gy / 8) % 2 ? 8 : 0), gy, 1, 8);
      }
    }
    x.fillStyle = '#e8a060'; x.fillRect(0, 184, GW, 2);
    // floating stone platforms + coins
    for (let i = 0; i < 4; i++) {
      const px = ((i * 120 + 80 - cam) % 480 + 480) % 480 - 40, py = 120 - (i % 2) * 24;
      for (let k = 0; k < 4; k++) { x.fillStyle = '#8c8c9c'; x.fillRect(px + k * 12, py, 12, 12); x.fillStyle = '#5a5a6a'; x.fillRect(px + k * 12, py + 11, 12, 1); x.fillRect(px + k * 12 + 11, py, 1, 12); }
      const spinW = Math.abs(Math.cos(gt * 6 + i)) * 5 + 1;
      x.fillStyle = '#ffd23c'; x.fillRect(px + 22 - spinW / 2, py - 16, spinW, 9);
    }
    // enemy
    const ex = ((200 - cam * 0.6) % 330 + 330) % 330;
    spr(BLOB, ex, 172, false);
    // hero: jumps at fixed times (sync with SFX)
    const jumps = [1.1, 2.3, 4.4];
    let jy = 0;
    for (const j of jumps) { const k = (gt - j) / 0.6; if (k > 0 && k < 1) jy = Math.sin(k * Math.PI) * 44; }
    const running = Math.floor(gt * 10) % 2 === 0;
    spr(running && jy === 0 ? HERO_RUN : HERO, 88, 168 - jy, false);
    // HUD
    x.fillStyle = '#ffffff';
    x.font = '8px "Press Start 2P"';
    x.textBaseline = 'top';
    x.fillText('SCORE ' + String(4250 + Math.floor(gt * 50) * 10).padStart(6, '0'), 12, 12);
    x.fillText('STAGE 1', 164, 12);
    x.fillStyle = '#ff5a5a'; x.fillText('♥x3', 12, 26);
    if (glitch > 0) {
      const r = mulberry32(Math.floor(gt * 3) + 7);
      const cols = ['#ff00aa', '#00ffcc', '#ffff00', '#000000', '#ffffff', '#3355ff'];
      for (let i = 0; i < 120 * glitch; i++) {
        x.fillStyle = cols[(r() * cols.length) | 0];
        x.fillRect((r() * 32 | 0) * 8, (r() * 28 | 0) * 8, 8 * (1 + (r() * 3 | 0)), 8);
      }
      // rolled / shifted lines
      const sh = (r() * 60) | 0;
      x.drawImage(c, 0, 100, GW, 40, sh, 100, GW, 40);
    }
    return c;
  }
  return { render, GW, GH };
})();

// ---- CRT TV with wood-grain case; screen content = canvas; power 0..1
Props.crtTV = function (ctx, x, y, w, screenCanvas, power, t, opts = {}) {
  const h = w * 0.78;
  // cabinet
  ctx.fillStyle = linGrad(ctx, x, y, x, y + h, [[0, '#5a3a22'], [1, '#2e1c10']]);
  rrect(ctx, x, y, w, h, w * 0.04); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 2;
  for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.moveTo(x, y + h * (i / 14) + Math.sin(i) * 3); ctx.bezierCurveTo(x + w * 0.3, y + h * (i / 14) + 6, x + w * 0.7, y + h * (i / 14) - 6, x + w, y + h * (i / 14)); ctx.stroke(); }
  // bezel
  const sx = x + w * 0.06, sy = y + h * 0.07, sw = w * 0.7, sh = h * 0.8;
  ctx.fillStyle = '#16120f'; rrect(ctx, sx - 12, sy - 12, sw + 24, sh + 24, 26); ctx.fill();
  // screen
  ctx.save();
  rrect(ctx, sx, sy, sw, sh, 30); ctx.clip();
  ctx.fillStyle = '#0a0c0e'; ctx.fillRect(sx, sy, sw, sh);
  if (power > 0) {
    // CRT turn-on: line expands vertically
    const vy = Ease.outCubic(clamp(power * 1.6 - 0.1));
    const lineH = Math.max(2, sh * vy);
    const lineW = sw * Ease.outCubic(clamp(power * 4));
    ctx.save();
    ctx.beginPath(); ctx.rect(sx + (sw - lineW) / 2, sy + (sh - lineH) / 2, lineW, lineH); ctx.clip();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = clamp(power * 3);
    ctx.drawImage(screenCanvas, sx, sy, sw, sh);
    ctx.imageSmoothingEnabled = true;
    ctx.restore();
    if (vy < 1) { ctx.fillStyle = `rgba(255,255,255,${(1 - vy) * 0.9})`; ctx.fillRect(sx, sy + sh / 2 - lineH / 2, sw, lineH); }
    // scanlines
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    for (let yy = sy; yy < sy + sh; yy += 4) ctx.fillRect(sx, yy, sw, 2);
  }
  // glass: vignette + reflection
  ctx.fillStyle = radGrad(ctx, sx + sw / 2, sy + sh / 2, sw * 0.2, sw * 0.75, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.55)']]);
  ctx.fillRect(sx, sy, sw, sh);
  ctx.fillStyle = 'rgba(255,255,255,0.06)';
  ctx.beginPath(); ctx.ellipse(sx + sw * 0.3, sy + sh * 0.2, sw * 0.35, sh * 0.12, -0.3, 0, TAU); ctx.fill();
  ctx.restore();
  // side panel: knobs + speaker
  const px = x + w * 0.8;
  ctx.fillStyle = '#1b1410'; rrect(ctx, px, sy, w * 0.15, sh, 10); ctx.fill();
  for (let i = 0; i < 2; i++) { ctx.fillStyle = '#b8b0a0'; ctx.beginPath(); ctx.arc(px + w * 0.075, sy + 60 + i * 90, 26, 0, TAU); ctx.fill(); ctx.fillStyle = '#3a342c'; ctx.fillRect(px + w * 0.075 - 3, sy + 40 + i * 90, 6, 22); }
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  for (let yy = sy + 260; yy < sy + sh - 20; yy += 14) ctx.fillRect(px + 16, yy, w * 0.15 - 32, 6);
  ctx.fillStyle = power > 0 ? '#ff3b2a' : '#401010'; ctx.beginPath(); ctx.arc(px + w * 0.075, sy + 230, 6, 0, TAU); ctx.fill();
  // rabbit ears
  ctx.strokeStyle = '#b9b4aa'; ctx.lineWidth = 5; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x + w * 0.5, y); ctx.lineTo(x + w * 0.25, y - h * 0.55); ctx.moveTo(x + w * 0.5, y); ctx.lineTo(x + w * 0.78, y - h * 0.5); ctx.stroke();
  ctx.fillStyle = '#26201a'; ctx.beginPath(); ctx.ellipse(x + w * 0.5, y + 4, 50, 18, 0, Math.PI, 0); ctx.fill();
  return { sx, sy, sw, sh };
};

// ornamental wall carpet (the '90s living room)
Props.wallCarpet = function (ctx, x, y, w, h) {
  ctx.fillStyle = '#5a1418'; ctx.fillRect(x, y, w, h);
  const b = w * 0.06;
  ctx.fillStyle = '#1c2a4a'; ctx.fillRect(x + b * 0.4, y + b * 0.4, w - b * 0.8, h - b * 0.8);
  ctx.fillStyle = '#6e1a1e'; ctx.fillRect(x + b, y + b, w - 2 * b, h - 2 * b);
  // zigzag border
  ctx.fillStyle = '#d9b27a';
  for (let i = 0; i < w / 40; i++) {
    const bx = x + i * 40;
    ctx.beginPath(); ctx.moveTo(bx, y + b * 0.6); ctx.lineTo(bx + 20, y + b * 0.3); ctx.lineTo(bx + 40, y + b * 0.6); ctx.lineTo(bx + 20, y + b * 0.9); ctx.fill();
    ctx.beginPath(); ctx.moveTo(bx, y + h - b * 0.6); ctx.lineTo(bx + 20, y + h - b * 0.3); ctx.lineTo(bx + 40, y + h - b * 0.6); ctx.lineTo(bx + 20, y + h - b * 0.9); ctx.fill();
  }
  // medallion + repeating motifs
  const cx = x + w / 2, cy = y + h / 2;
  const diamond = (dx, dy, r, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(dx, dy - r); ctx.lineTo(dx + r * 0.7, dy); ctx.lineTo(dx, dy + r); ctx.lineTo(dx - r * 0.7, dy); ctx.closePath(); ctx.fill(); };
  diamond(cx, cy, h * 0.3, '#1c2a4a'); diamond(cx, cy, h * 0.22, '#d9b27a'); diamond(cx, cy, h * 0.15, '#8a2226'); diamond(cx, cy, h * 0.06, '#e8d8b0');
  for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) {
    const dx = x + b * 2 + i * ((w - b * 4) / 5), dy = y + b * 2 + j * ((h - b * 4) / 3);
    if (Math.abs(dx - cx) < h * 0.35 && Math.abs(dy - cy) < h * 0.35) continue;
    diamond(dx, dy, 34, '#d9b27a'); diamond(dx, dy, 20, '#1c2a4a');
  }
};

// ===========================================================================
// 2000s screens (drawn on a virtual 1024x768 screen canvas)
// ===========================================================================
Props.screen = (() => {
  const SW = 1024, SH = 768;
  const [c, x] = makeCanvas(SW, SH);
  const UI = '"DejaVu Sans"';
  function bevel(px, py, pw, ph, inset = false) {
    x.fillStyle = '#c3c3c3'; x.fillRect(px, py, pw, ph);
    x.fillStyle = inset ? '#7b7b7b' : '#ffffff'; x.fillRect(px, py, pw, 2); x.fillRect(px, py, 2, ph);
    x.fillStyle = inset ? '#ffffff' : '#5a5a5a'; x.fillRect(px, py + ph - 2, pw, 2); x.fillRect(px + pw - 2, py, 2, ph);
  }
  function titleBar(px, py, pw, title, active = true) {
    const g = x.createLinearGradient(px, 0, px + pw, 0);
    g.addColorStop(0, active ? '#0a246a' : '#7b7b7b'); g.addColorStop(1, active ? '#3a6ea5' : '#a8a8a8');
    x.fillStyle = g; x.fillRect(px + 3, py + 3, pw - 6, 24);
    x.fillStyle = '#ffffff'; x.font = `bold 14px ${UI}`; x.textBaseline = 'middle';
    x.fillText(title, px + 10, py + 16);
    for (let i = 0; i < 3; i++) { bevel(px + pw - 26 - i * 22, py + 6, 18, 17); }
    x.fillStyle = '#000'; x.font = `bold 12px ${UI}`; x.fillText('×', px + pw - 22, py + 15);
  }
  // Windows-95-ish teal desktop with a dial-up dialog
  function dialup(lt) {
    x.fillStyle = '#0f7a7a'; x.fillRect(0, 0, SW, SH);
    // taskbar
    bevel(0, SH - 34, SW, 34); bevel(4, SH - 30, 80, 26);
    x.fillStyle = '#000'; x.font = `bold 14px ${UI}`; x.textBaseline = 'middle'; x.fillText('Start', 22, SH - 17);
    bevel(SW - 110, SH - 30, 106, 26, true); x.font = `13px ${UI}`; x.fillText('11:47 PM', SW - 88, SH - 17);
    // icons
    const icons = ['My Computer', 'Recycle Bin', 'Internet', 'My Music'];
    icons.forEach((n, i) => {
      x.fillStyle = ['#d8d0b0', '#b0c8d8', '#5a9ad8', '#e8c060'][i]; x.fillRect(38, 30 + i * 100, 42, 36);
      x.fillStyle = '#ffffff'; x.font = `12px ${UI}`; x.textAlign = 'center'; x.fillText(n, 59, 84 + i * 100); x.textAlign = 'left';
    });
    // dialog
    const dx = 262, dy = 220, dw = 500, dh = 250;
    bevel(dx, dy, dw, dh); titleBar(dx, dy, dw, 'Connecting to My ISP');
    // two computers + animated dots
    x.fillStyle = '#e8e4d8'; x.fillRect(dx + 40, dy + 60, 60, 48); x.fillRect(dx + dw - 100, dy + 60, 60, 48);
    x.fillStyle = '#102a6a'; x.fillRect(dx + 46, dy + 66, 48, 34); x.fillRect(dx + dw - 94, dy + 66, 48, 34);
    const n = Math.floor(lt * 6) % 12;
    for (let i = 0; i < 12; i++) { x.fillStyle = i <= n ? '#1a1a1a' : '#9a9a9a'; x.fillRect(dx + 125 + i * 21, dy + 82, 9, 9); }
    x.fillStyle = '#000'; x.font = `15px ${UI}`; x.textBaseline = 'alphabetic';
    const status = lt < 1.3 ? 'Dialing 0-800-4-WEB...' : lt < 3.6 ? 'Verifying user name and password...' : 'Connected at 56,000 bps';
    x.fillText('Status: ' + status, dx + 30, dy + 150);
    x.font = `13px ${UI}`; x.fillStyle = '#333';
    x.fillText('Duration: 00:00:' + String(Math.floor(lt)).padStart(2, '0'), dx + 30, dy + 178);
    bevel(dx + dw - 130, dy + dh - 50, 100, 32); x.fillStyle = '#000'; x.font = `14px ${UI}`; x.fillText('Cancel', dx + dw - 104, dy + dh - 28);
    return c;
  }
  // green-hill desktop + buddy list + chat window
  function messenger(lt, t) {
    // wallpaper
    const sky = x.createLinearGradient(0, 0, 0, SH);
    sky.addColorStop(0, '#2d6fd8'); sky.addColorStop(0.55, '#8cc1f2'); sky.addColorStop(1, '#bfe0f7');
    x.fillStyle = sky; x.fillRect(0, 0, SW, SH);
    x.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 7; i++) { const cx = (i * 170 + lt * 6) % (SW + 200) - 100, cy = 90 + (i % 3) * 60; x.beginPath(); x.ellipse(cx, cy, 90, 22, 0, 0, TAU); x.fill(); x.beginPath(); x.ellipse(cx + 30, cy - 14, 50, 20, 0, 0, TAU); x.fill(); }
    const hill = x.createLinearGradient(0, 380, 0, SH);
    hill.addColorStop(0, '#6ec23a'); hill.addColorStop(1, '#2f7d1c');
    x.fillStyle = hill;
    x.beginPath(); x.moveTo(0, 520); x.bezierCurveTo(300, 380, 620, 400, SW, 470); x.lineTo(SW, SH); x.lineTo(0, SH); x.closePath(); x.fill();
    // taskbar (blue)
    const tb = x.createLinearGradient(0, SH - 34, 0, SH);
    tb.addColorStop(0, '#3f8cf3'); tb.addColorStop(1, '#1c55c9');
    x.fillStyle = tb; x.fillRect(0, SH - 34, SW, 34);
    x.fillStyle = '#3aa13a'; x.beginPath(); x.roundRect(0, SH - 34, 100, 34, [0, 14, 14, 0]); x.fill();
    x.fillStyle = '#fff'; x.font = `italic bold 17px ${UI}`; x.textBaseline = 'middle'; x.fillText('start', 26, SH - 16);
    x.fillStyle = '#0f3fa6'; x.fillRect(SW - 120, SH - 34, 120, 34);
    x.fillStyle = '#fff'; x.font = `13px ${UI}`; x.fillText('12:04 AM', SW - 86, SH - 16);
    // buddy list window
    const bx = 40, by = 40, bw = 300, bh = 620;
    x.fillStyle = '#ffffff'; x.fillRect(bx, by, bw, bh);
    x.strokeStyle = '#2458c8'; x.lineWidth = 3; x.strokeRect(bx, by, bw, bh);
    const hdr = x.createLinearGradient(0, by, 0, by + 30); hdr.addColorStop(0, '#6a9ef0'); hdr.addColorStop(1, '#2458c8');
    x.fillStyle = hdr; x.fillRect(bx, by, bw, 30);
    x.fillStyle = '#fff'; x.font = `bold 14px ${UI}`; x.fillText('Messenger', bx + 12, by + 16);
    // my status
    x.fillStyle = '#ffd23c'; x.beginPath(); x.arc(bx + 34, by + 64, 16, 0, TAU); x.fill();
    x.fillStyle = '#222'; x.font = `bold 15px ${UI}`; x.fillText('me_2004', bx + 60, by + 56);
    x.fillStyle = '#7a3ab0'; x.font = `italic 13px ${UI}`; x.fillText('~*~ summer ’04 ~*~', bx + 60, by + 76);
    x.fillStyle = '#e8eef8'; x.fillRect(bx + 3, by + 100, bw - 6, 24);
    x.fillStyle = '#2458c8'; x.font = `bold 13px ${UI}`; x.fillText('▾ Friends (4/11)', bx + 10, by + 112);
    const online = lt >= 1.6;
    const buddies = [
      ['alex ☼', online ? 'is typing...' : '', online],
      ['maria_xoxo', 'brb', true],
      ['cool_kid_2004', '♫ burning a new CD', true],
      ['andrei.b', 'at the seaside!!!', true],
      ['ioana', '', false], ['mihai_the_best', '', false], ['cristi_rock', '', false],
    ];
    buddies.forEach(([name, st, on], i) => {
      const yy = by + 150 + i * 44;
      const hl = i === 0 && online ? 0.5 + 0.5 * Math.sin(t * 6) : 0;
      if (hl > 0) { x.fillStyle = `rgba(255,230,120,${0.35 * hl})`; x.fillRect(bx + 4, yy - 18, bw - 8, 40); }
      x.fillStyle = on ? '#ffd23c' : '#b8b8b8'; x.beginPath(); x.arc(bx + 26, yy, 11, 0, TAU); x.fill();
      x.fillStyle = on ? '#6a4a00' : '#7a7a7a'; x.fillRect(bx + 21, yy - 4, 3, 3); x.fillRect(bx + 28, yy - 4, 3, 3);
      x.beginPath(); x.arc(bx + 26, yy + 2, 5, 0.2, Math.PI - 0.2); x.strokeStyle = x.fillStyle; x.lineWidth = 1.5; x.stroke();
      x.fillStyle = on ? '#111' : '#999'; x.font = `${i === 0 && online ? 'bold ' : ''}14px ${UI}`; x.fillText(name, bx + 46, yy - 4);
      if (st) { x.fillStyle = '#666'; x.font = `italic 12px ${UI}`; x.fillText(st, bx + 46, yy + 13); }
    });
    // toast "alex is now online"
    const toastK = env(lt, 1.6, 4.4, 0.35, 0.5);
    if (toastK > 0) {
      const tx = SW - 270, ty = SH - 34 - 110 * Ease.outCubic(toastK);
      x.fillStyle = '#ffffff'; x.fillRect(tx, ty, 250, 100);
      x.strokeStyle = '#2458c8'; x.lineWidth = 2; x.strokeRect(tx, ty, 250, 100);
      x.fillStyle = '#ffd23c'; x.beginPath(); x.arc(tx + 36, ty + 50, 18, 0, TAU); x.fill();
      x.fillStyle = '#111'; x.font = `bold 15px ${UI}`; x.fillText('alex ☼', tx + 66, ty + 40);
      x.fillStyle = '#333'; x.font = `14px ${UI}`; x.fillText('is now online', tx + 66, ty + 62);
    }
    // chat window
    const chatK = clamp((lt - 3.0) / 0.3);
    if (chatK > 0) {
      let shx = 0, shy = 0;
      if (lt > 5.0 && lt < 5.8) { const k = (lt - 5.0) / 0.8; shx = Math.sin(lt * 90) * 26 * (1 - k); shy = Math.cos(lt * 77) * 18 * (1 - k); }
      const cx = 380 + shx, cy = 150 + shy, cw = 580, ch = 440;
      x.globalAlpha = chatK;
      x.fillStyle = '#f4f7fc'; x.fillRect(cx, cy, cw, ch);
      x.strokeStyle = '#2458c8'; x.lineWidth = 3; x.strokeRect(cx, cy, cw, ch);
      x.fillStyle = hdr; x.fillRect(cx, cy, cw, 30);
      const h2 = x.createLinearGradient(0, cy, 0, cy + 30); h2.addColorStop(0, '#6a9ef0'); h2.addColorStop(1, '#2458c8'); x.fillStyle = h2; x.fillRect(cx, cy, cw, 30);
      x.fillStyle = '#fff'; x.font = `bold 14px ${UI}`; x.fillText('alex ☼ — Instant Message', cx + 12, cy + 16);
      x.fillStyle = '#ffffff'; x.fillRect(cx + 12, cy + 42, cw - 24, 290);
      x.strokeStyle = '#9ab'; x.lineWidth = 1; x.strokeRect(cx + 12, cy + 42, cw - 24, 290);
      const msgs = [[3.4, 'alex ☼', 'hey :)', '#c0392b'], [4.0, 'me_2004', 'heyyy!!', '#2458c8'], [5.0, 'alex ☼', 'BUZZ!!!', '#c0392b', true], [6.4, 'alex ☼', 'lol', '#c0392b'], [7.1, 'me_2004', 'omg u scared me :))', '#2458c8']];
      let yy = cy + 72;
      for (const [mt, who, txt, col, buzz] of msgs) {
        if (lt < mt) break;
        x.fillStyle = col; x.font = `bold 15px ${UI}`; x.fillText(who + ':', cx + 26, yy);
        const wdt = x.measureText(who + ': ').width;
        x.fillStyle = buzz ? '#e0201a' : '#111'; x.font = buzz ? `bold 26px ${UI}` : `16px ${UI}`;
        x.fillText(txt, cx + 26 + wdt, yy + (buzz ? 2 : 0));
        yy += buzz ? 42 : 34;
      }
      // emoticon toolbar + input
      x.fillStyle = '#e8eef8'; x.fillRect(cx + 12, cy + 340, cw - 24, 30);
      ['☺', '☹', '♥', '☼', '♫'].forEach((e, i) => { x.fillStyle = '#c08a00'; x.font = `18px ${UI}`; x.fillText(e, cx + 24 + i * 30, cy + 356); });
      x.fillStyle = '#ffffff'; x.fillRect(cx + 12, cy + 376, cw - 110, 52); x.strokeStyle = '#9ab'; x.strokeRect(cx + 12, cy + 376, cw - 110, 52);
      bevel(cx + cw - 90, cy + 384, 76, 36); x.fillStyle = '#000'; x.font = `bold 14px ${UI}`; x.fillText('Send', cx + cw - 70, cy + 403);
      x.globalAlpha = 1;
    }
    // mouse cursor
    const mx = 250 + Math.sin(lt * 0.6) * 60 + lt * 30, my = 210 + Math.cos(lt * 0.8) * 40;
    x.fillStyle = '#fff'; x.strokeStyle = '#000'; x.lineWidth = 1.2;
    x.beginPath(); x.moveTo(mx, my); x.lineTo(mx, my + 22); x.lineTo(mx + 6, my + 17); x.lineTo(mx + 10, my + 26); x.lineTo(mx + 13, my + 25); x.lineTo(mx + 9, my + 16); x.lineTo(mx + 16, my + 16); x.closePath(); x.fill(); x.stroke();
    return c;
  }
  return { dialup, messenger, SW, SH };
})();

// beige CRT monitor showing a screen canvas; returns screen rect
Props.monitor = function (ctx, x, y, w, screenCanvas, t, opts = {}) {
  const h = w * 0.8;
  ctx.fillStyle = linGrad(ctx, x, y, x, y + h, [[0, '#e7dfcc'], [1, '#bfb49a']]);
  rrect(ctx, x, y, w, h, 28); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.12)'; rrect(ctx, x + 20, y + 20, w - 40, h - 70, 20); ctx.fill();
  const sx = x + w * 0.07, sy = y + w * 0.06, sw = w * 0.86, sh = sw * 0.75;
  ctx.fillStyle = '#1a1a1a'; rrect(ctx, sx - 10, sy - 10, sw + 20, sh + 20, 22); ctx.fill();
  ctx.save();
  rrect(ctx, sx, sy, sw, sh, 18); ctx.clip();
  ctx.drawImage(screenCanvas, sx, sy, sw, sh);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let yy = sy; yy < sy + sh; yy += 3) ctx.fillRect(sx, yy, sw, 1);
  ctx.fillStyle = radGrad(ctx, sx + sw / 2, sy + sh / 2, sw * 0.3, sw * 0.72, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.45)']]);
  ctx.fillRect(sx, sy, sw, sh);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.beginPath(); ctx.ellipse(sx + sw * 0.28, sy + sh * 0.18, sw * 0.3, sh * 0.1, -0.25, 0, TAU); ctx.fill();
  ctx.restore();
  // power LED + brand-less badge
  ctx.fillStyle = '#6aff6a'; ctx.beginPath(); ctx.arc(x + w - 70, y + h - 32, 6, 0, TAU); ctx.fill();
  ctx.fillStyle = 'rgba(80,70,50,0.5)'; ctx.fillRect(x + w / 2 - 50, y + h - 38, 100, 10);
  return { sx, sy, sw, sh };
};

// external modem with blinking LEDs
Props.modem = function (ctx, x, y, w, t, active) {
  const h = w * 0.22;
  ctx.fillStyle = linGrad(ctx, x, y, x, y + h, [[0, '#3a3a40'], [1, '#1c1c20']]);
  rrect(ctx, x, y, w, h, 14); ctx.fill();
  ctx.fillStyle = '#111114'; rrect(ctx, x + 20, y + h * 0.35, w - 40, h * 0.4, 8); ctx.fill();
  const labels = ['HS', 'AA', 'CD', 'OH', 'RD', 'SD', 'TR', 'MR'];
  labels.forEach((lb, i) => {
    const lx = x + 50 + i * ((w - 100) / 7), ly = y + h * 0.55;
    const on = active && (i < 2 || i === 6 || i === 7 || (i === 3) || ((i === 4 || i === 5) && Math.sin(t * (23 + i * 7) + i) > 0.1));
    ctx.fillStyle = on ? (i === 4 || i === 5 ? '#ffb020' : '#ff4030') : '#3a1a14';
    ctx.beginPath(); ctx.arc(lx, ly, 7, 0, TAU); ctx.fill();
    if (on) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, lx, ly, 34, ctx.fillStyle, 0.6); ctx.restore(); }
    ctx.fillStyle = 'rgba(220,220,220,0.6)'; ctx.font = '500 15px "IBM Plex Mono"'; ctx.textAlign = 'center';
    ctx.fillText(lb, lx, y + h * 0.3); ctx.textAlign = 'left';
  });
};

// ===========================================================================
// Candybar phone with a 1-bit LCD
// ===========================================================================
Props.phone = (() => {
  const LW = 96, LH = 68;
  const [lc, lx] = makeCanvas(LW, LH);
  const [bc, bx] = makeCanvas(LW, LH);
  function lcd(draw) {
    lx.setTransform(1, 0, 0, 1, 0, 0);
    lx.clearRect(0, 0, LW, LH);
    lx.fillStyle = '#000'; lx.textBaseline = 'top';
    draw(lx);
    // binarize (crisp 1-bit pixels)
    const id = lx.getImageData(0, 0, LW, LH), d = id.data;
    for (let i = 0; i < d.length; i += 4) { const on = d[i + 3] > 110; d[i] = d[i + 1] = d[i + 2] = 0; d[i + 3] = on ? 255 : 0; }
    bx.putImageData(id, 0, 0);
    return bc;
  }
  function body(ctx, x, y, s, lcdCanvas, pressedKey, glow = 1) {
    // s = pixel size of LCD pixels; phone scaled accordingly
    const pw = LW * s + s * 22, ph = pw * 2.35;
    ctx.save();
    ctx.translate(x, y);
    // shadow
    Soft.draw(ctx, (x) => { x.fillStyle = 'rgba(0,0,0,0.6)'; rrect(x, 20, 40, pw, ph, pw * 0.2); x.fill(); }, { scale: 0.0625, blur: 2 });
    // body
    ctx.fillStyle = linGrad(ctx, 0, 0, pw, 0, [[0, '#1b2433'], [0.15, '#34445e'], [0.5, '#2a3850'], [0.9, '#1a2230'], [1, '#101620']]);
    rrect(ctx, 0, 0, pw, ph, pw * 0.2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.08)'; rrect(ctx, pw * 0.05, s * 3, pw * 0.08, ph * 0.8, pw * 0.04); ctx.fill();
    // earpiece
    ctx.fillStyle = '#0c1018'; rrect(ctx, pw * 0.38, s * 6, pw * 0.24, s * 2.2, s); ctx.fill();
    // LCD bezel
    const lx0 = s * 11, ly0 = s * 16;
    ctx.fillStyle = '#0b0f16'; rrect(ctx, lx0 - s * 4, ly0 - s * 4, LW * s + s * 8, LH * s + s * 8, s * 3); ctx.fill();
    // backlit LCD
    ctx.fillStyle = mixh('#5a6a3a', '#b8d38a', glow);
    ctx.fillRect(lx0, ly0, LW * s, LH * s);
    ctx.fillStyle = radGrad(ctx, lx0 + LW * s / 2, ly0 + LH * s / 2, 10, LW * s * 0.7, [[0, `rgba(230,255,170,${0.25 * glow})`], [1, 'rgba(0,0,0,0.12)']]);
    ctx.fillRect(lx0, ly0, LW * s, LH * s);
    // pixels (with a faint pixel grid)
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(lcdCanvas, 0, 0, LW, LH, lx0 + s * 0.12, ly0 + s * 0.12, LW * s, LH * s);
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = true;
    ctx.fillStyle = 'rgba(40,60,20,0.14)';
    for (let i = 0; i <= LW; i++) ctx.fillRect(lx0 + i * s, ly0, 1, LH * s);
    for (let j = 0; j <= LH; j++) ctx.fillRect(lx0, ly0 + j * s, LW * s, 1);
    if (glow > 0) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, lx0 + LW * s / 2, ly0 + LH * s / 2, LW * s * 0.9, '#a8e060', 0.18 * glow); ctx.restore(); }
    // keypad
    const ky0 = ly0 + LH * s + s * 18;
    // nav + soft keys
    ctx.fillStyle = '#9aa7b8'; rrect(ctx, pw * 0.3, ky0 - s * 12, pw * 0.4, s * 9, s * 4); ctx.fill();
    ctx.fillStyle = '#6a7788'; rrect(ctx, pw * 0.08, ky0 - s * 11, pw * 0.18, s * 6, s * 3); ctx.fill(); rrect(ctx, pw * 0.74, ky0 - s * 11, pw * 0.18, s * 6, s * 3); ctx.fill();
    const keys = [['1', '.,?'], ['2', 'abc'], ['3', 'def'], ['4', 'ghi'], ['5', 'jkl'], ['6', 'mno'], ['7', 'pqrs'], ['8', 'tuv'], ['9', 'wxyz'], ['*', '+'], ['0', '␣'], ['#', '⇧']];
    keys.forEach(([k, sub], i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const kx = pw * 0.1 + col * pw * 0.28, ky = ky0 + row * s * 15;
      const pr = pressedKey === k;
      ctx.fillStyle = pr ? '#dfe8ff' : '#c2cad6';
      rrect(ctx, kx, ky + (pr ? s * 0.6 : 0), pw * 0.24, s * 11, s * 5); ctx.fill();
      if (pr) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, kx + pw * 0.12, ky + s * 5, pw * 0.2, '#a8e060', 0.35); ctx.restore(); }
      ctx.fillStyle = '#1a2230'; ctx.font = `600 ${s * 5.5}px "Inter"`; ctx.textAlign = 'center';
      ctx.fillText(k, kx + pw * 0.08, ky + s * 7.6);
      ctx.font = `500 ${s * 3.2}px "Inter"`; ctx.fillStyle = '#3a4658';
      ctx.fillText(sub, kx + pw * 0.17, ky + s * 7.2);
      ctx.textAlign = 'left';
    });
    ctx.restore();
    return { pw, ph };
  }
  return { lcd, body, LW, LH };
})();

// ===========================================================================
// Smartphone (2010s) with a square photo + filter strip
// ===========================================================================
Props.smartphone = function (ctx, x, y, w, drawScreen) {
  const h = w * 2.0;
  ctx.save();
  ctx.translate(x, y);
  Soft.draw(ctx, (x) => { x.fillStyle = 'rgba(0,0,0,0.55)'; rrect(x, 16, 30, w, h, w * 0.14); x.fill(); }, { scale: 0.0625, blur: 2 });
  ctx.fillStyle = linGrad(ctx, 0, 0, w, 0, [[0, '#101012'], [0.5, '#26262a'], [1, '#0c0c0e']]);
  rrect(ctx, 0, 0, w, h, w * 0.14); ctx.fill();
  ctx.strokeStyle = '#8a8a90'; ctx.lineWidth = 3; rrect(ctx, 1.5, 1.5, w - 3, h - 3, w * 0.14); ctx.stroke();
  const sx = w * 0.06, sy = h * 0.11, sw = w * 0.88, sh = h * 0.78;
  ctx.fillStyle = '#000'; ctx.fillRect(sx, sy, sw, sh);
  ctx.save(); ctx.beginPath(); ctx.rect(sx, sy, sw, sh); ctx.clip(); ctx.translate(sx, sy);
  drawScreen(ctx, sw, sh);
  ctx.restore();
  ctx.fillStyle = '#1a1a1c'; ctx.beginPath(); ctx.arc(w / 2, h * 0.945, w * 0.07, 0, TAU); ctx.fill();
  ctx.strokeStyle = '#3a3a3e'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#0a0a0c'; rrect(ctx, w * 0.4, h * 0.05, w * 0.2, h * 0.012, 4); ctx.fill();
  ctx.fillStyle = '#1a1a2a'; ctx.beginPath(); ctx.arc(w * 0.3, h * 0.056, w * 0.018, 0, TAU); ctx.fill();
  ctx.restore();
  return { sx: x + sx, sy: y + sy, sw, sh };
};
