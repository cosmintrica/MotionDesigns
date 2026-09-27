'use strict';
// ---------------------------------------------------------------------------
// Shared helpers: math, easing, deterministic noise, colours, canvas utils.
// Everything in the film is a pure function of time, so all randomness here
// is seeded / hashed and never depends on frame order.
// ---------------------------------------------------------------------------

const W = 1920, H = 1080, FPS = 24;
const TAU = Math.PI * 2;

const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const invLerp = (a, b, x) => clamp((x - a) / (b - a));
const smoothstep = (a, b, x) => { const t = invLerp(a, b, x); return t * t * (3 - 2 * t); };
const fract = (x) => x - Math.floor(x);

const Ease = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  outExpo: (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: (t) => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutExpo: (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  smooth: (t) => t * t * (3 - 2 * t),
  smoother: (t) => t * t * t * (t * (t * 6 - 15) + 10),
};

// progress of t inside [a,b] (clamped) with optional easing
function prog(t, a, b, e = Ease.linear) { return e(invLerp(a, b, t)); }
// envelope: 0 before a, rises over fi, holds, falls over fo, 0 after b
function env(t, a, b, fi = 0.5, fo = 0.5, e = Ease.inOutSine) {
  if (t <= a || t >= b) return 0;
  const i = fi > 0 ? e(clamp((t - a) / fi)) : 1;
  const o = fo > 0 ? e(clamp((b - t) / fo)) : 1;
  return Math.min(i, o);
}

// ---- deterministic randomness --------------------------------------------
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(n) { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return x - Math.floor(x); }
function hash2(a, b) { return hash(a * 157.31 + b * 113.97 + 7.13); }
function vnoise(x) {
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(hash(i), hash(i + 1), u) * 2 - 1;
}
function fbm(x, oct = 3) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise(x * f + i * 17.31); f *= 2.03; a *= 0.5; }
  return s;
}
function vnoise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy) * 2 - 1;
}
function fbm2(x, y, oct = 4) {
  let s = 0, a = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += a * vnoise2(x * f + i * 5.2, y * f - i * 3.7); f *= 2.02; a *= 0.5; }
  return s;
}

// ---- colour ------------------------------------------------------------------
function hex(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function rgba(c, a = 1) { return `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`; }
function mixc(c1, c2, t) { return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)]; }
function mixh(h1, h2, t, a = 1) { return rgba(mixc(hex(h1), hex(h2), t), a); }
// sample a gradient given as [[pos, '#hex'], ...]
function gradSample(stops, t) {
  if (t <= stops[0][0]) return hex(stops[0][1]);
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const k = (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]);
      return mixc(hex(stops[i - 1][1]), hex(stops[i][1]), k);
    }
  }
  return hex(stops[stops.length - 1][1]);
}

// ---- canvas helpers ------------------------------------------------------------
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h));
  return [c, c.getContext('2d')];
}
function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function linGrad(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [p, c] of stops) g.addColorStop(clamp(p), c);
  return g;
}
function radGrad(ctx, x, y, r0, r1, stops, x1, y1) {
  const g = ctx.createRadialGradient(x, y, r0, x1 === undefined ? x : x1, y1 === undefined ? y : y1, r1);
  for (const [p, c] of stops) g.addColorStop(clamp(p), c);
  return g;
}

// soft round glow sprite (cached): white core fading to transparent, tinted
const _glowCache = new Map();
function glowSprite(color, size = 128, hardness = 0.0) {
  const key = color + '|' + size + '|' + hardness;
  if (_glowCache.has(key)) return _glowCache.get(key);
  const [c, x] = makeCanvas(size, size);
  const r = size / 2, col = hex(color);
  const g = x.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, rgba(col, 1));
  g.addColorStop(clamp(0.15 + hardness * 0.6), rgba(col, 0.55 + hardness * 0.4));
  g.addColorStop(0.45, rgba(col, 0.16));
  g.addColorStop(1, rgba(col, 0));
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  _glowCache.set(key, c);
  return c;
}
function drawGlow(ctx, x, y, radius, color, alpha = 1, hardness = 0) {
  if (alpha <= 0.002 || radius <= 0.1) return;
  const s = glowSprite(color, 128, hardness);
  ctx.globalAlpha = alpha;
  ctx.drawImage(s, x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalAlpha = 1;
}

// bokeh disc sprite with slightly brighter rim (cached)
const _bokehCache = new Map();
function bokehSprite(color) {
  if (_bokehCache.has(color)) return _bokehCache.get(color);
  const s = 128, [c, x] = makeCanvas(s, s), col = hex(color);
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 62);
  g.addColorStop(0, rgba(col, 0.55));
  g.addColorStop(0.82, rgba(col, 0.7));
  g.addColorStop(0.93, rgba(col, 0.95));
  g.addColorStop(1, rgba(col, 0));
  x.fillStyle = g; x.beginPath(); x.arc(64, 64, 63, 0, TAU); x.fill();
  _bokehCache.set(color, c);
  return c;
}

// Draw an image with a 1D alpha falloff at the edges (used for soft wipes)
function withAlpha(ctx, a, fn) {
  if (a <= 0) return;
  const p = ctx.globalAlpha; ctx.globalAlpha = p * a; fn(); ctx.globalAlpha = p;
}

// seven–segment digits (for the orange film-camera date stamp / counters)
const SEG = {
  '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg',
  '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g', ' ': '', "'": 'f',
};
function drawSevenSeg(ctx, str, x, y, h, color, alpha = 1, glow = true) {
  const w = h * 0.5, t = h * 0.12, gap = h * 0.02, adv = w + h * 0.22;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  const seg = (sx, sy, horiz, len) => {
    ctx.beginPath();
    if (horiz) {
      ctx.moveTo(sx, sy); ctx.lineTo(sx + t / 2, sy - t / 2); ctx.lineTo(sx + len - t / 2, sy - t / 2);
      ctx.lineTo(sx + len, sy); ctx.lineTo(sx + len - t / 2, sy + t / 2); ctx.lineTo(sx + t / 2, sy + t / 2);
    } else {
      ctx.moveTo(sx, sy); ctx.lineTo(sx + t / 2, sy + t / 2); ctx.lineTo(sx + t / 2, sy + len - t / 2);
      ctx.lineTo(sx, sy + len); ctx.lineTo(sx - t / 2, sy + len - t / 2); ctx.lineTo(sx - t / 2, sy + t / 2);
    }
    ctx.closePath(); ctx.fill();
  };
  let cx = x;
  const skew = h * 0.08;
  for (const ch of str) {
    const segs = SEG[ch] ?? '';
    const hh = h / 2;
    ctx.save();
    ctx.translate(cx, y);
    ctx.transform(1, 0, -skew / h, 1, 0, 0);
    if (segs.includes('a')) seg(gap, 0, true, w - 2 * gap);
    if (segs.includes('b')) seg(w, gap, false, hh - 2 * gap);
    if (segs.includes('c')) seg(w, hh + gap, false, hh - 2 * gap);
    if (segs.includes('d')) seg(gap, h, true, w - 2 * gap);
    if (segs.includes('e')) seg(0, hh + gap, false, hh - 2 * gap);
    if (segs.includes('f')) seg(0, gap, false, hh - 2 * gap);
    if (segs.includes('g')) seg(gap, hh, true, w - 2 * gap);
    ctx.restore();
    cx += ch === "'" ? adv * 0.45 : adv;
  }
  ctx.restore();
}

// Soft (blurred) drawing through a low-resolution layer: far cheaper than ctx.filter
// on a full-size canvas. fn(x) draws with the caller's current transform.
const Soft = (() => {
  const bufs = {};
  function buf(key, scale) {
    if (!bufs[key]) bufs[key] = makeCanvas(Math.ceil(W * scale), Math.ceil(H * scale));
    return bufs[key];
  }
  function draw(ctx, fn, o = {}) {
    const scale = o.scale || 0.25;
    const [c, x] = buf('a' + scale, scale);
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1; x.filter = 'none';
    x.clearRect(0, 0, c.width, c.height);
    const m = ctx.getTransform();
    x.setTransform(m.a * scale, m.b * scale, m.c * scale, m.d * scale, m.e * scale, m.f * scale);
    fn(x);
    let src = c;
    if (o.blur) {
      const [c2, x2] = buf('b' + scale, scale);
      x2.setTransform(1, 0, 0, 1, 0, 0); x2.globalCompositeOperation = 'source-over';
      x2.clearRect(0, 0, c2.width, c2.height);
      x2.filter = `blur(${o.blur}px)`; x2.drawImage(c, 0, 0); x2.filter = 'none';
      src = c2;
    }
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = (o.alpha ?? 1);
    ctx.globalCompositeOperation = o.comp || 'source-over';
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(src, 0, 0, c.width / scale, c.height / scale);
    ctx.restore();
  }
  return { draw };
})();

// Film-camera date imprint in the lower right corner, e.g. "'97 7 14" (cached sprite)
const _stampCache = new Map();
function drawDateStamp(ctx, str, alpha = 1) {
  if (alpha <= 0) return;
  const h = 34, x = W - 420, y = H - 118;
  let spr = _stampCache.get(str);
  if (!spr) {
    const [c, cx] = makeCanvas(460, 120);
    const [c2, cx2] = makeCanvas(460, 120);
    drawSevenSeg(cx2, str, 30, 40, h, 'rgba(255,90,20,0.8)', 0.8);
    cx.filter = 'blur(6px)'; cx.drawImage(c2, 0, 0); cx.filter = 'none';
    cx.globalCompositeOperation = 'lighter';
    drawSevenSeg(cx, str, 30, 40, h, 'rgba(255,120,40,0.9)', 0.9);
    spr = c; _stampCache.set(str, spr);
  }
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = alpha;
  ctx.drawImage(spr, x - 30, y - 40);
  ctx.restore();
}

// camera/viewport helper: push-in around a focal point
function camera(ctx, zoom, fx = W / 2, fy = H / 2, ox = 0, oy = 0, rot = 0) {
  ctx.translate(W / 2 + ox, H / 2 + oy);
  if (rot) ctx.rotate(rot);
  ctx.scale(zoom, zoom);
  ctx.translate(-fx, -fy);
}

// film dust specks + an occasional scratch, drawn in 2D (cheap; replaces a per-pixel shader pass)
function drawFilmDust(ctx, frame, amount) {
  if (amount <= 0.001) return;
  const r = mulberry32(frame * 7919 + 13);
  const n = Math.floor(r() * 3.2 * amount + (r() < 0.5 * amount ? 1 : 0));
  ctx.save();
  for (let i = 0; i < n; i++) {
    const x = r() * W, y = r() * H, rad = 1 + r() * 3.2 * (r() < 0.2 ? 2.2 : 1);
    ctx.globalAlpha = 0.45 + r() * 0.35;
    ctx.fillStyle = r() < 0.55 ? '#f4eee0' : '#0a0806';
    ctx.beginPath(); ctx.ellipse(x, y, rad, rad * (0.5 + r() * 0.8), r() * 3, 0, TAU); ctx.fill();
    if (r() < 0.3) { ctx.lineWidth = 1; ctx.strokeStyle = ctx.fillStyle; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + (r() - 0.5) * 30, y + (r() - 0.5) * 30, x + (r() - 0.5) * 40, y + (r() - 0.5) * 40); ctx.stroke(); }
  }
  const blk = Math.floor(frame / 2);
  if (hash(blk * 4.2 + 0.3) > 0.86) {
    const sx = hash(blk * 1.9 + 0.7) * W;
    ctx.globalAlpha = 0.16 * amount;
    ctx.strokeStyle = '#ece6d8'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(sx, 0);
    for (let y = 0; y <= H; y += 60) ctx.lineTo(sx + Math.sin(y * 0.01 + blk) * 3, y);
    ctx.stroke();
  }
  ctx.restore();
}
