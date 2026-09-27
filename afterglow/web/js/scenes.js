'use strict';
// ---------------------------------------------------------------------------
// Scenes. Each draw(ctx, lt, t, s) paints a full opaque frame for local time lt.
// ---------------------------------------------------------------------------

// parallax camera: depth 0 = infinitely far (static), 1 = focal plane, >1 = foreground
function parallax(ctx, cam, depth) {
  const z = 1 + (cam.zoom - 1) * depth;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.translate(W / 2, H / 2);
  ctx.scale(z, z);
  ctx.translate(-(W / 2 + (cam.fx - W / 2) * Math.min(1, depth)) - cam.px * depth, -(H / 2 + (cam.fy - H / 2) * Math.min(1, depth)) - cam.py * depth);
}
// interpolate camera keyframes [{t, zoom, fx, fy, px, py}]
function camPath(keys, t, ease = Ease.inOutSine) {
  let i = 0;
  while (i < keys.length - 1 && keys[i + 1].t <= t) i++;
  const a = keys[i], b = keys[Math.min(i + 1, keys.length - 1)];
  const k = b.t > a.t ? ease(clamp((t - a.t) / (b.t - a.t))) : 0;
  const o = {};
  for (const key of ['zoom', 'fx', 'fy', 'px', 'py']) o[key] = lerp(a[key] ?? (key === 'zoom' ? 1 : key === 'fx' ? W / 2 : key === 'fy' ? H / 2 : 0), b[key] ?? (key === 'zoom' ? 1 : key === 'fx' ? W / 2 : key === 'fy' ? H / 2 : 0), k);
  return o;
}

const Scenes = {};

// soft shadow layer: draw at quarter resolution, upscale = free blur
const Shadow = (() => {
  const k = 0.25;
  const [c, x] = makeCanvas(W * k, H * k);
  return {
    begin() { x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, c.width, c.height); x.setTransform(k, 0, 0, k, 0, 0); return x; },
    end(ctx, alpha = 1) { ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = alpha; ctx.imageSmoothingEnabled = true; ctx.drawImage(c, 0, 0, W, H); ctx.restore(); },
  };
})();

// a boxy old family sedan in silhouette (side view), wheels on ground y
function oldCar(ctx, x, y, L, color, glass) {
  const h = L * 0.27;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - h * 0.3);
  ctx.lineTo(x + L * 0.02, y - h * 0.62);
  ctx.lineTo(x + L * 0.24, y - h * 0.66);
  ctx.lineTo(x + L * 0.33, y - h * 1.0);
  ctx.lineTo(x + L * 0.68, y - h * 1.0);
  ctx.lineTo(x + L * 0.8, y - h * 0.64);
  ctx.lineTo(x + L * 0.99, y - h * 0.6);
  ctx.lineTo(x + L, y - h * 0.3);
  ctx.lineTo(x + L * 0.98, y - h * 0.12);
  ctx.lineTo(x + L * 0.02, y - h * 0.12);
  ctx.closePath(); ctx.fill();
  if (glass) {
    ctx.fillStyle = glass;
    ctx.beginPath();
    ctx.moveTo(x + L * 0.345, y - h * 0.93); ctx.lineTo(x + L * 0.49, y - h * 0.93); ctx.lineTo(x + L * 0.49, y - h * 0.68); ctx.lineTo(x + L * 0.28, y - h * 0.68); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x + L * 0.51, y - h * 0.93); ctx.lineTo(x + L * 0.665, y - h * 0.93); ctx.lineTo(x + L * 0.76, y - h * 0.68); ctx.lineTo(x + L * 0.51, y - h * 0.68); ctx.closePath(); ctx.fill();
    ctx.fillStyle = color;
  }
  for (const wx of [0.2, 0.8]) { ctx.beginPath(); ctx.arc(x + L * wx, y - h * 0.12, h * 0.26, 0, TAU); ctx.fill(); }
}

function modernCar(ctx, x, y, L, color, glass) {
  const h = L * 0.3;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - h * 0.25);
  ctx.quadraticCurveTo(x, y - h * 0.62, x + L * 0.12, y - h * 0.66);
  ctx.quadraticCurveTo(x + L * 0.3, y - h * 1.05, x + L * 0.55, y - h * 1.05);
  ctx.quadraticCurveTo(x + L * 0.8, y - h * 1.02, x + L * 0.92, y - h * 0.62);
  ctx.quadraticCurveTo(x + L, y - h * 0.5, x + L, y - h * 0.25);
  ctx.lineTo(x + L * 0.98, y - h * 0.1); ctx.lineTo(x + L * 0.02, y - h * 0.1);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = glass;
  ctx.beginPath(); ctx.moveTo(x + L * 0.2, y - h * 0.68); ctx.quadraticCurveTo(x + L * 0.34, y - h * 0.97, x + L * 0.55, y - h * 0.97); ctx.lineTo(x + L * 0.84, y - h * 0.66); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#15151a';
  for (const wx of [0.2, 0.8]) { ctx.beginPath(); ctx.arc(x + L * wx, y - h * 0.1, h * 0.24, 0, TAU); ctx.fill(); }
}

// ===========================================================================
// ACT I — the courtyard between the blocks. mode: 'golden' | 'grey'
// dusk: 0 = golden hour, 1 = blue hour (lamps on)
// ===========================================================================
function courtyard(ctx, t, o) {
  const grey = o.mode === 'grey';
  const dusk = o.dusk || 0;
  const cam = o.cam || { zoom: 1, fx: W / 2, fy: H / 2, px: 0, py: 0 };
  const GY = 800; // ground line
  const lampsOn = o.lamps || 0;
  const SUNX = 1060;
  const sunY = o.modern ? lerp(250, 570, Ease.inOutSine(clamp(o.glow || 0))) : lerp(560, 790, Ease.inOutSine(clamp(dusk * 1.15)));

  const modern = !!o.modern, gk = clamp(o.glow || 0) * 0.88;
  const mixPal = (A, B, k) => {
    const out = {};
    for (const key in A) {
      if (Array.isArray(A[key])) out[key] = A[key].map(([pos, c], i) => [pos, mixh(c, B[key][i][1], k)]);
      else out[key] = mixh(A[key], B[key], k);
    }
    return out;
  };
  const G0 = { sky: [[0, '#34407a'], [0.3, '#7a5390'], [0.55, '#f08a86'], [0.72, '#ffb56c'], [0.86, '#ffe0a0'], [1, '#fff0c8']], far: '#c07a8c', poplar: '#98577a',
    blockL: '#5a3450', sideL: '#7a4460', blockR: '#6a3a58', sideR: '#4d2c46', win: '#2e1a31', balcony: '#6a4060', tree: '#2a1628',
    ground: [[0, '#7a4652'], [0.35, '#43253a'], [1, '#221220']], walk: '#8a5160', figure: '#1d0f1a', lampC: '#241322', line: '#3b2238', car: '#241220', glass: '#ffb37a', frame: '#c89a88' };
  const M0 = { sky: [[0, '#3f7fcf'], [0.3, '#6aa2de'], [0.55, '#9cc6ee'], [0.72, '#c4dcf0'], [0.86, '#dfe9f0'], [1, '#eef2f2']], far: '#9aa8b8', poplar: '#5f7f62',
    blockL: '#86c4ae', sideL: '#6fa894', blockR: '#eeb596', sideR: '#d49a7c', win: '#40576c', balcony: '#a9c6d4', tree: '#3d6a3a',
    ground: [[0, '#8f8e8a'], [0.35, '#6f6e6a'], [1, '#4f4e4c']], walk: '#b3b0a8', figure: '#2a2a33', lampC: '#45464e', line: '#3a3a40', car: '#c0392b', glass: '#a8c4d8', frame: '#f4f4f2' };
  const P = modern ? Object.assign(mixPal(M0, G0, gk), { haze: rgba(mixc(hex('#dfe9f0'), hex('#ffc59a'), gk), 0.3), shadow: rgba(hex('#1a0714'), 0.4) }) : grey ? {
    sky: [[0, '#8c9397'], [0.55, '#a9aeb0'], [1, '#c3c5c2']],
    far: '#8b9094', poplar: '#767c78', haze: 'rgba(185,189,189,0.35)',
    blockL: '#8b8781', sideL: '#7a7771', blockR: '#948f88', sideR: '#827e78', win: '#3b4045', seams: 'rgba(60,60,58,0.4)', frame: '#6d6963',
    balcony: '#7d7a74', tree: '#4a4b48', ground: [[0, '#706f6b'], [1, '#484744']], walk: '#7f7e79', figure: '#2d2c2d', lampC: '#3a3a3a',
    line: 'rgba(40,40,40,0.55)', car: '#3e4a52', glass: '#6c7479', shadow: 'rgba(0,0,0,0)',
  } : {
    sky: [[0, mixh('#34407a', '#141b3d', dusk)], [0.3, mixh('#7a5390', '#2e2a63', dusk)], [0.55, mixh('#f08a86', '#8b4f86', dusk)],
      [0.72, mixh('#ffb56c', '#e2847c', dusk)], [0.86, mixh('#ffe0a0', '#f3aa7a', dusk)], [1, mixh('#fff0c8', '#f7c08e', dusk)]],
    far: mixh('#c07a8c', '#5d3b70', dusk), poplar: mixh('#98577a', '#44315f', dusk), haze: rgba(mixc(hex('#ffc59a'), hex('#b0708f'), dusk), 0.35),
    blockL: mixh('#4a2a45', '#221936', dusk), sideL: mixh('#6b3a55', '#2c2040', dusk), blockR: mixh('#53304b', '#261c3b', dusk), sideR: mixh('#3d2239', '#1c1530', dusk),
    win: mixh('#2e1a31', '#141122', dusk), frame: null, balcony: mixh('#5c3553', '#2b2041', dusk), tree: mixh('#2a1628', '#130f21', dusk),
    ground: [[0, mixh('#7a4652', '#302542', dusk)], [0.35, mixh('#43253a', '#1e1829', dusk)], [1, mixh('#221220', '#100c17', dusk)]],
    walk: mixh('#8a5160', '#3a2c4a', dusk),
    figure: mixh('#1d0f1a', '#0d0a13', dusk), lampC: mixh('#241322', '#100c17', dusk), line: mixh('#3b2238', '#1a1426', dusk),
    car: mixh('#241220', '#0f0b16', dusk), glass: mixh('#ffb37a', '#6f5a8a', dusk), shadow: rgba(hex('#1a0714'), 0.55 * (1 - dusk * 0.7)),
  };

  // ---------------- sky ----------------
  parallax(ctx, cam, 0.0);
  Env.sky(ctx, P.sky, 0, GY + 20);
  if (!grey) {
    Env.rays(ctx, SUNX, sunY, t, 0.085 * (1 - dusk) * (modern ? gk : 1), '#ffd8a8', 15, 2000, 4);
    Env.cloudBand(ctx, 21, 430, t, mixh('#ffc0a0', '#9a5c86', dusk), 0.12, 1.1, 5);
    Env.cloudBand(ctx, 22, 360, t, mixh('#f3a0aa', '#5f4480', dusk), 0.14, 1.3, 3);
    Env.sun(ctx, SUNX, sunY, 58, '#fff6dc', modern ? mixh('#fff4e0', '#ffa35c', gk) : '#ffa35c', (1 - dusk * 0.85) * (modern ? 0.55 + 0.45 * gk : 1));
    Env.stars(ctx, 5, 110, t, smoothstep(0.55, 1, dusk) * 0.75, 420, 0);
  } else {
    Env.cloudBand(ctx, 21, 230, t, '#9aa0a3', 0.55, 2.4, 4);
    Env.cloudBand(ctx, 23, 400, t, '#b8bbbb', 0.4, 1.8, 6);
  }
  parallax(ctx, cam, 0.2);
  if (!grey) Env.birds(ctx, 7, 6, t, rgba(hex(P.figure), 0.8), [200, 150, W - 400, 230], 1.1);
  else Env.birds(ctx, 8, 2, t * 0.6, 'rgba(45,45,45,0.55)', [0, 180, W, 120], 0.8);

  // ---------------- far city ----------------
  parallax(ctx, cam, 0.35);
  Env.skyline(ctx, 31, GY + 2, P.far, t, { hmin: 70, hvar: 120, windows: grey ? 0 : 0.1 * (0.2 + dusk), winColor: '#ffd08a', antennas: true });
  for (let i = 0; i < 9; i++) Env.tree(ctx, 600 + i * 95 + hash(i) * 40, GY + 4, 120 + hash(i + 3) * 90, 40 + i, P.poplar, t, { type: 'poplar' });
  // atmospheric haze over the far layer
  ctx.fillStyle = linGrad(ctx, 0, GY - 330, 0, GY + 10, [[0, 'rgba(0,0,0,0)'], [1, P.haze]]);
  ctx.fillRect(-100, GY - 330, W + 200, 340);

  // ---------------- blocks ----------------
  parallax(ctx, cam, 0.8);
  const litK = grey ? 0.0 : lerp(0.08, 0.52, smoothstep(0.25, 1, dusk));
  const litColors = ['#ffcf86', '#ffd9a0', '#ffb25e', '#a8b8ff', '#ffe7b8'];
  const clothes = grey ? ['#5c5c5c', '#6e6e6e', '#646868'] : [mixh('#b25f7e', '#4a3056', dusk), mixh('#d88b8a', '#553765', dusk), mixh('#8a4a6e', '#3c2a50', dusk), mixh('#e6b28c', '#5a4060', dusk)];
  Env.block(ctx, { x: -120, base: GY + 2, w: 660, floors: 10, fh: 60, cols: 8, seed: 3, stairCol: 4, balconyEvery: 3,
    facade: P.blockL, window: P.win, lit: litK, litColors, glowWindows: grey ? 0 : 0.5 + dusk, tv: !grey, t,
    frame: P.frame, seams: grey ? P.seams : null, stains: grey ? 1 : 0, balcony: P.balcony, laundry: modern ? 0.2 : 0.45, clothes,
    sideW: 70, sideDir: 1, sideColor: P.sideL, ac: modern ? 0.3 : 0, acColor: mixh('#eef0f0', '#8a6070', gk), dish: modern ? 5 : 0, dishColor: mixh('#e8e8e8', '#b09aa0', gk),
    antenna: 4, antennaColor: P.blockL, roofBox: true, rimColor: grey ? null : rgba(hex('#ffa070'), 0.45 * (1 - dusk)), entrance: 2, entranceLight: lampsOn * 0.6 });
  Env.block(ctx, { x: 1440, base: GY + 2, w: 620, floors: 8, fh: 62, cols: 8, seed: 11, stairCol: 5, balconyEvery: 2,
    facade: P.blockR, window: P.win, lit: litK * 0.9, litColors, glowWindows: grey ? 0 : 0.5 + dusk, tv: !grey, t,
    frame: P.frame, seams: grey ? P.seams : null, stains: grey ? 1 : 0, balcony: P.balcony, laundry: modern ? 0.2 : 0.45, clothes,
    sideW: 60, sideDir: -1, sideColor: P.sideR, ac: modern ? 0.3 : 0, acColor: mixh('#eef0f0', '#8a6070', gk), dish: modern ? 4 : 0, dishColor: mixh('#e8e8e8', '#b09aa0', gk),
    antenna: 3, antennaColor: P.blockR, rimColor: grey ? null : rgba(hex('#ffa070'), 0.35 * (1 - dusk)), entrance: 3, entranceLight: lampsOn * 0.6 });
  Env.powerLines(ctx, 610, 300, 1380, 360, 80, P.line, 3, 9);

  // ---------------- ground ----------------
  parallax(ctx, cam, 1.0);
  ctx.fillStyle = linGrad(ctx, 0, GY, 0, H + 120, P.ground);
  ctx.fillRect(-300, GY, W + 600, H);
  // sidewalk strip + curb
  ctx.fillStyle = P.walk; ctx.globalAlpha = 0.5;
  ctx.fillRect(-300, GY, W + 600, 14);
  ctx.globalAlpha = 1;
  // asphalt texture: faint cracks and patches
  {
    const r = mulberry32(606);
    ctx.strokeStyle = grey ? 'rgba(40,40,40,0.25)' : rgba(hex('#12060f'), 0.25);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = 0; i < 26; i++) {
      let x = r() * W, y = GY + 30 + r() * 260;
      ctx.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += (r() - 0.5) * 60; y += (r() - 0.3) * 14; ctx.lineTo(x, y); }
    }
    ctx.stroke();
    ctx.fillStyle = grey ? 'rgba(60,60,60,0.12)' : rgba(hex('#12060f'), 0.12);
    for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.ellipse(r() * W, GY + 60 + r() * 220, 60 + r() * 120, 8 + r() * 12, 0, 0, TAU); ctx.fill(); }
  }
  if (!grey) {
    ctx.save(); ctx.translate(SUNX, GY + 25); ctx.scale(1, 0.1);
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, 0, 0, 1100, '#ff9c5e', 0.42 * (1 - dusk));
    ctx.restore();
  } else {
    ctx.fillStyle = 'rgba(195,200,202,0.38)';
    for (const [px, py, pw] of [[420, 880, 170], [1150, 930, 250], [1680, 870, 120]]) { ctx.beginPath(); ctx.ellipse(px, py, pw, pw * 0.08, 0, 0, TAU); ctx.fill(); }
  }

  // ---------------- props & people (collected for the shadow pass) ----------------
  const swing = Math.sin(t * 2.2) * 16;
  const kick = t * 1.6;
  const ballX = o.kidsStill ? 1150 : 1150 + Math.sin(kick * 0.5) * 110;
  const bounce = o.kidsStill ? 0 : Math.abs(Math.sin(kick * 2.2)) * 55;
  const people = [];
  if (!grey || o.kidsInGrey) {
    people.push({ hang: true, S: 122, body: 'child', t, pivot: [960, GY + 12 - 150], swing: swing * Math.PI / 180,
      pose: { lean: -swing * 0.3, neck: -6, shL: 178, elL: 4, shR: 172, elR: 8, hipL: 8 + swing * 0.6, knL: 25 + swing * 0.8, hipR: -4 + swing * 0.4, knR: 18 + swing * 0.5 }, hair: 'short' });
    const k1 = o.kidsStill ? Fig.stand(t) : Fig.run(t * 7.5, 0.8);
    const k2 = o.kidsStill ? Object.assign(Fig.stand(t + 1), { neck: -30, lean: -4 }) : Fig.run(t * 7 + 2, 0.7);
    people.push({ x: ballX - 95, y: GY + 30 - 0.47 * 120, S: 120, body: 'child', t, pose: k1, hair: 'short', key: true, keySwing: Math.sin(t * 7) * 0.6 });
    people.push({ x: ballX + 105, y: GY + 32 - 0.47 * 114, S: 114, body: 'child', t, flip: true, pose: k2, hair: 'ponytail' });
  }
  const trees = grey ? [[640, 330, 51, 'bare'], [1370, 300, 52, 'bare']] : [[640, 370, 51, 'round'], [1370, 330, 52, 'round']];

  // long soft shadows toward the camera (golden hour only)
  if (!grey && dusk < 0.95) {
    const sx = Shadow.begin();
    sx.fillStyle = '#000';
    const cast = (x0, y0, fn) => {
      sx.save(); sx.translate(x0, y0);
      const lean = (x0 - SUNX) / 900;
      sx.transform(1, 0, lean * 1.6, -1.9 * (1 - dusk * 0.5), 0, 0);
      fn(sx); sx.restore();
    };
    for (const [x, h] of trees) cast(x, GY + 6, (c) => { c.fillRect(-10, -h * 0.5, 20, h * 0.5); c.beginPath(); c.ellipse(0, -h * 0.64, h * 0.42, h * 0.3, 0, 0, TAU); c.fill(); });
    for (const lx of [1230, 1640]) cast(lx, GY + 12, (c) => c.fillRect(-4, -290, 8, 290));
    cast(900, GY + 12, (c) => { c.fillRect(-4, -150, 8, 150); c.fillRect(166, -150, 8, 150); c.fillRect(-4, -152, 178, 7); });
    for (const p of people) {
      if (p.hang) continue;
      cast(p.x, GY + 30, (c) => Fig.draw(c, Object.assign({}, p, { x: 0, y: -0.47 * p.S, color: '#000', rim: null })));
    }
    Shadow.end(ctx, 0.55 * (1 - dusk));
  }

  // trees
  for (const [x, h, sd, type] of trees) Env.tree(ctx, x, GY + 6, h, sd, P.tree, t, type === 'bare' ? { type: 'bare' } : { crown: 0.4, blobs: 18, blossoms: mixh('#ffd98a', '#7a6a5a', dusk) });
  // old car parked by the right block
  if (modern) modernCar(ctx, 1690, GY + 44, 260, P.car, P.glass); else oldCar(ctx, 1700, GY + 44, 250, P.car, P.glass);
  // lamps
  const flick = (k, sd) => (k <= 0 ? 0 : k >= 1 ? 1 : k * (0.55 + 0.45 * Math.sign(Math.sin(k * 38 + sd * 7))));
  Env.lamp(ctx, 1230, GY + 12, 290, P.lampC, flick(lampsOn, 1), '#ffb766', t);
  Env.lamp(ctx, 1640, GY + 16, 300, P.lampC, flick(clamp(lampsOn * 1.2 - 0.12), 2), '#ffb766', t);
  // carpet beater + kids
  Env.beater(ctx, 900, GY + 12, 170, 150, P.figure);
  const rim = grey ? null : mixh('#ffb074', '#6a5a9a', dusk);
  for (const p of people) {
    if (p.hang) {
      // hands on the bar, body swinging below it
      const B = Fig.BODY.child, reach = (B.torso * 0.93 + B.uarm + B.farm) * p.S;
      ctx.save(); ctx.translate(p.pivot[0], p.pivot[1]); ctx.rotate(p.swing);
      Fig.draw(ctx, Object.assign({ color: P.figure, rim, rimDir: [1, -0.4], rimWidth: 2.2 }, p, { x: 0, y: reach }));
      ctx.restore();
    } else Fig.draw(ctx, Object.assign({ color: P.figure, rim, rimDir: [SUNX > p.x ? 1 : -1, -0.4], rimWidth: 2.2 }, p));
  }
  if (!grey || o.kidsInGrey) {
    ctx.fillStyle = P.figure;
    ctx.beginPath(); ctx.arc(ballX, GY + 30 - 8 - bounce, 8.5, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(ballX, GY + 31, 10 - bounce * 0.06, 3, 0, 0, TAU); ctx.fill();
  }
  if (o.extra) o.extra(ctx, t, P, GY);

  // ---------------- foreground ----------------
  parallax(ctx, cam, 1.3);
  Env.grass(ctx, 91, H + 30, P.figure, 380, 70, t);
  parallax(ctx, cam, 0);
  if (!grey) Env.motes(ctx, 77, 60, t, { color: '#ffe3ae', alpha: 0.65 * (1 - dusk * 0.5), size: 2.2, region: [0, 300, W, H - 300] });
  else Env.rain(ctx, 5, 180, t, 0.22, '#d6dadc', 0.1, 1300);
  return { GY };
}

Scenes.courtyardWide = (ctx, lt, t, s) => {
  const cam = camPath([{ t: 0, zoom: 1.0, fx: 960, fy: 560 }, { t: 5, zoom: 1.05, fx: 980, fy: 570 }], lt);
  courtyard(ctx, t, { mode: 'golden', dusk: 0.05 + lt * 0.01, lamps: 0, cam });
};

// ===========================================================================
// COLD OPEN — cassette on a desk, a pencil rewinds it; then the deck & PLAY
// ===========================================================================
function woodDesk(ctx, lampX, lampY, light = 1) {
  ctx.fillStyle = linGrad(ctx, 0, 0, W, H, [[0, '#2a1a10'], [0.6, '#1c110b'], [1, '#120b07']]);
  ctx.fillRect(-200, -200, W + 400, H + 400);
  // grain
  const r = mulberry32(12);
  ctx.save();
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 90; i++) {
    const y0 = r() * (H + 400) - 200, amp = 6 + r() * 14, f = 0.002 + r() * 0.004, ph = r() * 10;
    ctx.strokeStyle = r() < 0.5 ? 'rgba(70,40,22,0.35)' : 'rgba(10,5,2,0.35)';
    ctx.lineWidth = 1 + r() * 3;
    ctx.beginPath();
    for (let x = -200; x <= W + 200; x += 20) { const y = y0 + Math.sin(x * f + ph) * amp + Math.sin(x * f * 3.1 + ph) * amp * 0.3; if (x === -200) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.stroke();
  }
  ctx.restore();
  // warm lamp pool
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, lampX, lampY, 1300, '#ff9d4a', 0.28 * light);
  drawGlow(ctx, lampX, lampY, 600, '#ffc27a', 0.22 * light);
  ctx.restore();
}

Scenes.coldOpen = (ctx, lt, t) => {
  if (lt < 6.6) {
    // --- shot 1: cassette + pencil
    const z = 1.0 + lt * 0.012;
    ctx.save();
    camera(ctx, z, 960, 520, 0, 0, -0.004 * lt);
    woodDesk(ctx, 520, 260, 1);
    // tracklist card (out of focus, right)
    ctx.save();
    ctx.translate(1560, 610); ctx.rotate(0.12);
    Soft.draw(ctx, (x) => {
      x.fillStyle = '#e9dcc0'; x.fillRect(-190, -300, 380, 600);
      x.fillStyle = '#d9542f'; x.fillRect(-190, -300, 380, 26);
      x.fillStyle = '#26315e'; x.font = '600 40px "Caveat"';
      ['side A', '1. rainy saturday', '2. the long way home', '3. streetlights', '4. five more minutes', '5. summer, again'].forEach((s, i) => x.fillText(s, -160, -210 + i * 62));
    }, { scale: 0.5 });
    ctx.restore();
    // rewind motion: accelerate, then slow
    const rw = clamp((lt - 1.9) / 4.3);
    const spinAmt = (() => { // integral of speed profile
      const k = rw; return 38 * (k * k * (3 - 2 * k)) + (lt - 1.9 > 0 ? 0 : 0);
    })();
    const packL = lerp(0.3, 0.72, Ease.inOutSine(rw));
    ctx.save();
    ctx.translate(960, 560); ctx.rotate(-0.07); ctx.translate(-960, -560);
    const s = 10.4;
    const cx = 960 - 50.2 * s, cy = 520 - 31.9 * s;
    const hubs = Props.cassette(ctx, cx, cy, { s, spinL: -spinAmt, spinR: -spinAmt * 0.8, packL, label: 'summer mix ’97', glass: 0.2 + lt * 0.08 });
    // pencil standing in the left hub, wobbling as it is twirled
    const wob = rw > 0 && rw < 1 ? 1 : 0.3;
    const ph = spinAmt * 1.0;
    const tip = [hubs.hubL[0] - 270 + Math.cos(ph) * 16 * wob, hubs.hubL[1] - 310 + Math.sin(ph) * 10 * wob];
    Props.pencil(ctx, hubs.hubL, tip, 34, 48, ph);
    ctx.restore();
    Env.motes(ctx, 13, 50, t, { color: '#ffd9a0', alpha: 0.55, size: 2, region: [0, 0, W, H] });
    ctx.restore();
    // fade in from black
    const fin = clamp((lt - 0.6) / 1.4);
    if (fin < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - Ease.inOutSine(fin)})`; ctx.fillRect(0, 0, W, H); }
  } else {
    // --- shot 2: the deck, PLAY
    const k = lt - 6.6;
    const play = clamp((lt - 7.5) / 0.12);
    const running = Math.max(0, lt - 7.55);
    const z = 1.0 + Ease.inCubic(clamp(k / 2.8)) * 0.35;
    ctx.save();
    camera(ctx, z, 620, 470);
    const lv = running > 0 ? 0.25 + 0.2 * Math.abs(Math.sin(running * 9)) * clamp(running * 2) + (lt > 9 ? 0.2 : 0) : 0;
    Props.deck(ctx, { t, pressed: { play }, reel: -running * 3.2, packL: 0.72, level: [lv, lv * 0.9 + 0.03 * Math.sin(running * 13)], led: play, counter: running * 3, backlight: 0.35 + play * 0.65, cassetteLabel: 'summer mix ’97' });
    ctx.restore();
    // cassette being pushed in (door closing) at the start of the shot
    const ins = clamp((lt - 6.6) / 0.35);
    if (ins < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - ins})`; ctx.fillRect(0, 0, W, H); }
  }
};

// ===========================================================================
// TITLE — the light of the tape becomes a golden haze
// ===========================================================================
Scenes.title = (ctx, lt, t) => {
  const cy = 250 - lt * 4;
  ctx.fillStyle = radGrad(ctx, 960, cy, 30, 1250, [[0, '#f7c486'], [0.18, '#d27a4e'], [0.45, '#6e3246'], [1, '#12080f']]);
  ctx.fillRect(0, 0, W, H);
  // slow drifting bokeh of warm light
  Env.bokeh(ctx, 3, 26, t, ['#ffcf8a', '#ff9e6a', '#ffd9b0', '#f07a7a'], [0, 0, W, H], [60, 260], 0.13);
  Env.rays(ctx, 960, cy, t, 0.05, '#ffe0b0', 16, 1300, 8);
  // a calm dark band behind the title
  ctx.fillStyle = linGrad(ctx, 0, 440, 0, 800, [[0, 'rgba(18,6,14,0)'], [0.5, 'rgba(18,6,14,0.38)'], [1, 'rgba(18,6,14,0)']]);
  ctx.fillRect(0, 440, W, 360);
  Env.motes(ctx, 91, 110, t, { color: '#fff0cf', alpha: 0.75, size: 2.2, drift: 0.8, rise: 0.6 });
  // breathing vignette to keep the text readable
  ctx.fillStyle = radGrad(ctx, 960, 540, 200, 1100, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(20,6,14,0.5)']]);
  ctx.fillRect(0, 0, W, H);
};

// out-of-focus golden courtyard used behind the close-ups
function goldenBokehBG(ctx, t, opts = {}) {
  const dusk = opts.dusk || 0;
  Props.blurBG(ctx, (x) => {
    Env.sky(x, [[0, mixh('#6a4e8e', '#2a2a5c', dusk)], [0.45, mixh('#f08a86', '#8a4f86', dusk)], [0.7, mixh('#ffc27a', '#e2847c', dusk)], [1, mixh('#ffe6b0', '#f3aa7a', dusk)]], 0, H);
    Env.sun(x, opts.sunX ?? 420, opts.sunY ?? 420, 90, '#fff5da', '#ffab5e', 1 - dusk * 0.7);
    x.fillStyle = mixh('#5a3050', '#261c3b', dusk);
    x.fillRect(1100, 180, 700, 900); x.fillRect(-100, 520, 380, 700);
    x.fillStyle = mixh('#3a1e36', '#1b1428', dusk);
    x.fillRect(-100, 820, W + 200, 400);
    for (let i = 0; i < 26; i++) { x.fillStyle = hash(i) < 0.4 ? '#ffd08a' : mixh('#3a2240', '#221a34', dusk); x.fillRect(1140 + (i % 6) * 110, 230 + Math.floor(i / 6) * 130, 60, 70); }
  });
  Env.bokeh(ctx, 17, 14, t, ['#ffd08a', '#ffb070', '#ffe2b8'], [900, 100, 1000, 700], [50, 150], 0.3);
}

// ---- KEY close-up
Scenes.keyCloseup = (ctx, lt, t) => {
  goldenBokehBG(ctx, t, { sunX: 380, sunY: 360 });
  const sway = Math.sin(lt * 1.9 + 0.4) * 0.09;
  const spin = lt * 2.3 + Math.sin(lt * 1.3) * 0.5 + 0.8;
  const topX = 1240 + Math.sin(lt * 0.9) * 10, topY = -40;
  const ringY = 250 + Math.sin(lt * 1.7) * 6;
  const ringX = topX + Math.sin(sway) * (ringY - topY);
  // string (shoelace)
  ctx.strokeStyle = '#7a1f22'; ctx.lineWidth = 9; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(topX - 6, topY); ctx.quadraticCurveTo(topX - 20, (topY + ringY) / 2, ringX - 4, ringY - 20); ctx.stroke();
  ctx.strokeStyle = '#9a2a2c'; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(topX + 14, topY); ctx.quadraticCurveTo(topX + 24, (topY + ringY) / 2, ringX + 4, ringY - 20); ctx.stroke();
  const face = Props.key(ctx, ringX, ringY, 470, spin, sway * 0.6);
  // glint when the key faces the sun
  const g = Math.pow(Math.max(0, Math.cos(spin)), 18);
  Props.glint(ctx, ringX - 34, ringY + 150, 240, g * 0.9);
  // warm flare from the sun
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, 380, 360, 700, '#ffb25e', 0.18);
  ctx.restore();
  Env.motes(ctx, 31, 40, t, { color: '#ffe3ae', alpha: 0.6, size: 3 });
};

// ---- BALL close-up: a sneaker stops the ball on warm asphalt
Scenes.ballCloseup = (ctx, lt, t) => {
  const GY = 560;
  Props.blurBG(ctx, (x) => {
    Env.sky(x, [[0, '#7a5390'], [0.5, '#f29a86'], [0.8, '#ffc983'], [1, '#ffe4ae']], 0, GY + 40);
    Env.sun(x, 1450, 420, 80, '#fff5da', '#ffab5e', 1);
    x.fillStyle = '#4a2a45'; x.fillRect(-100, 120, 520, 520); x.fillRect(1640, 230, 400, 420);
    // kids legs running in the distance
    for (let i = 0; i < 3; i++) Fig.draw(x, { x: 700 + i * 260 + Math.sin(t * 2 + i) * 40, y: GY - 60, S: 260, body: 'child', pose: Fig.run(t * 8 + i * 2), color: '#2a1628' });
    x.fillStyle = '#5a3040'; x.fillRect(-100, GY, W + 200, 600);
  });
  // ground plane with perspective grain
  ctx.fillStyle = linGrad(ctx, 0, GY, 0, H, [[0, 'rgba(120,70,70,0.0)'], [0.12, 'rgba(90,50,58,0.85)'], [1, '#2a1520']]);
  ctx.fillRect(0, GY, W, H - GY);
  const r = mulberry32(5);
  for (let i = 0; i < 900; i++) {
    const yy = GY + Math.pow(r(), 1.6) * (H - GY), xx = r() * W;
    const s = 0.6 + ((yy - GY) / (H - GY)) * 3.5;
    ctx.fillStyle = r() < 0.5 ? 'rgba(255,200,160,0.10)' : 'rgba(10,0,5,0.25)';
    ctx.fillRect(xx, yy, s * (1 + r()), s * 0.6);
  }
  // sun sheen on the ground
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.translate(1450, GY + 30); ctx.scale(1, 0.15);
  drawGlow(ctx, 0, 0, 1200, '#ff9c5e', 0.4); ctx.restore();
  // ball rolls in from the right and is stopped by the foot at 0.25s
  const stopT = 0.25;
  const k = clamp(lt / stopT);
  const bx = lerp(1500, 860, Ease.outCubic(k)) + (lt > stopT ? Math.sin((lt - stopT) * 9) * Math.exp(-(lt - stopT) * 5) * 8 : 0);
  const R = 140, by = 790 - R;
  const roll = (bx - 1500) / R;
  // long shadow toward camera
  Soft.draw(ctx, (x) => { x.fillStyle = 'rgba(20,4,10,0.45)'; x.beginPath(); x.ellipse(bx - 140, 800, 330, 30, -0.05, 0, TAU); x.fill(); }, { scale: 0.125, blur: 1.5 });
  Props.ball(ctx, bx, by, R, [0.4, roll + 0.3], [0.55, -0.55]);
  // sneaker comes down and rests its sole on top of the ball
  const f = clamp((lt - 0.05) / 0.35);
  const L = 470, ang = 0.13 - (1 - Ease.outCubic(f)) * 0.25;
  const restX = bx - Math.cos(ang) * L * 0.56, restY = by - R + 4 - Math.sin(ang) * L * 0.56;
  const fx = restX - (1 - Ease.outCubic(f)) * 60, fy = lerp(-260, restY, Ease.outCubic(f));
  Props.sneaker(ctx, fx, fy, L, ang);
  Env.motes(ctx, 55, 30, t, { color: '#ffe3ae', alpha: 0.5, size: 2.4, region: [0, 0, W, GY + 100] });
};

// ---- BALCONY: a mother calling from the lit balcony at dusk
Scenes.balcony = (ctx, lt, t) => {
  const z = 1 + lt * 0.015;
  ctx.save();
  camera(ctx, z, 900, 520);
  // dusk sky (upper left)
  Env.sky(ctx, [[0, '#1c2150'], [0.5, '#4a3470'], [1, '#b0607a']], 0, 900);
  Env.stars(ctx, 77, 40, t, 0.5, 300, 0);
  // facade
  ctx.fillStyle = '#2a2140'; ctx.fillRect(560, -100, 1500, 1300);
  // neighbouring windows
  const wins = [[640, 60, false], [1560, 60, true], [640, 820, true], [1560, 820, false], [1850, 440, true]];
  for (const [wx, wy, lit] of wins) {
    ctx.fillStyle = lit ? '#ffc778' : '#171226'; ctx.fillRect(wx, wy, 190, 170);
    ctx.fillStyle = '#2a2140'; ctx.fillRect(wx + 90, wy, 10, 170); ctx.fillRect(wx, wy + 60, 190, 8);
    if (lit) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, wx + 95, wy + 85, 260, '#ffab4d', 0.25); ctx.restore(); }
  }
  // balcony door (lit kitchen behind)
  const dx = 900, dy = 190, dw = 360, dh = 560;
  ctx.fillStyle = radGrad(ctx, dx + dw / 2, dy + dh * 0.4, 20, 420, [[0, '#ffe6b0'], [0.5, '#ffb35e'], [1, '#c96a2e']]);
  ctx.fillRect(dx, dy, dw, dh);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, dx + dw / 2, dy + dh * 0.45, 700, '#ffa04a', 0.35); ctx.restore();
  // curtain edge and door frame
  ctx.fillStyle = 'rgba(255,240,215,0.35)'; ctx.fillRect(dx, dy, 70, dh);
  ctx.fillStyle = '#20182f'; ctx.fillRect(dx - 16, dy - 16, dw + 32, 16); ctx.fillRect(dx - 16, dy, 16, dh); ctx.fillRect(dx + dw, dy, 16, dh);
  ctx.fillRect(dx + dw * 0.5 - 5, dy, 10, dh * 0.5);
  // laundry line
  ctx.strokeStyle = '#120e1c'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(620, 170); ctx.quadraticCurveTo(1100, 205, 1650, 160); ctx.stroke();
  const clothes = [[700, 90, 120, '#6a3a5e'], [1330, 70, 150, '#7a4a6a'], [1470, 110, 100, '#523a66']];
  for (const [cx, cw, ch, col] of clothes) {
    const sw = Math.sin(t * 1.2 + cx) * 3;
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(cx, 185); ctx.lineTo(cx + cw, 185); ctx.lineTo(cx + cw + sw, 185 + ch); ctx.lineTo(cx + sw, 185 + ch); ctx.closePath(); ctx.fill();
  }
  // mother: front view, leaning on the rail, hand cupped at her mouth
  const call = 0.5 + 0.5 * Math.sin(lt * 5.5);
  Fig.draw(ctx, { x: 1080, y: 790, S: 700, body: 'woman', color: '#1a1020', rim: '#ffb870', rimDir: [0, -1], rimWidth: 5, t, hair: 'bun',
    pose: { view: 'front', lean: 0, neck: -6 + call * 2, shL: 161 + call * 3, elL: 132, shR: 161 + call * 3, elR: 132, hipL: 0, hipR: 0 } });
  // balcony parapet (front face) with a geranium pot
  ctx.fillStyle = linGrad(ctx, 0, 720, 0, 1100, [[0, '#3a2d52'], [1, '#221a33']]);
  ctx.fillRect(560, 720, 1500, 420);
  ctx.fillStyle = '#4a3b66'; ctx.fillRect(560, 712, 1500, 16);
  // parapet pattern (the typical ribbed panel)
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let x = 600; x < 2040; x += 80) ctx.fillRect(x, 760, 30, 300);
  // geranium
  ctx.fillStyle = '#6a3622'; ctx.fillRect(1380, 650, 140, 70);
  ctx.fillStyle = '#2c4a2a';
  for (let i = 0; i < 14; i++) { ctx.beginPath(); ctx.arc(1390 + hash(i) * 120, 600 + hash(i + 9) * 60, 22, 0, TAU); ctx.fill(); }
  ctx.fillStyle = '#e0443c';
  for (let i = 0; i < 9; i++) { ctx.beginPath(); ctx.arc(1395 + hash(i * 3) * 110, 585 + hash(i * 5) * 50, 11, 0, TAU); ctx.fill(); }
  ctx.restore();
};

// ===========================================================================
// TV + console, Christmas '98
// ===========================================================================
Scenes.tv = (ctx, lt, t) => {
  const power = clamp((lt - 0.15) / 0.5);
  const glitch = lt > 3.2 && lt < 3.85 ? 1 : 0;
  const gt = glitch ? 3.2 : lt < 3.2 ? lt : lt - 0.65;
  const screen = Props.game.render(gt, glitch);
  const z = 1.0 + lt * 0.018;
  ctx.save();
  camera(ctx, z, 1050, 640);
  // room
  ctx.fillStyle = '#2a2230'; ctx.fillRect(-200, -200, W + 400, H + 400);
  ctx.fillStyle = '#3a2a24'; ctx.fillRect(-200, 930, W + 400, 400); // floor
  Props.wallCarpet(ctx, 520, 40, 1300, 360);
  // Christmas tree (left)
  ctx.fillStyle = '#10261a';
  for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(250, 380 + i * 120 - 60); ctx.lineTo(250 - 90 - i * 45, 520 + i * 120); ctx.lineTo(250 + 90 + i * 45, 520 + i * 120); ctx.closePath(); ctx.fill(); }
  ctx.fillStyle = '#3a2418'; ctx.fillRect(235, 880, 30, 60);
  // TV on a low cabinet
  ctx.fillStyle = '#2a1a10'; ctx.fillRect(820, 920, 760, 200);
  ctx.fillStyle = '#1a100a'; ctx.fillRect(840, 950, 340, 150); ctx.fillRect(1220, 950, 340, 150);
  const S = Props.crtTV(ctx, 880, 430, 640, screen, power, t);
  // console + cartridge on the floor
  ctx.fillStyle = '#2a2a30'; rrect(ctx, 1380, 1000, 300, 70, 8); ctx.fill();
  ctx.fillStyle = '#4a4a54'; ctx.fillRect(1440, 975, 150, 30);
  ctx.fillStyle = '#b8a070'; ctx.fillRect(1460, 952, 110, 30);
  ctx.fillStyle = '#a02a2a'; ctx.fillRect(1590, 1025, 16, 8);
  // darkness: only the TV lights the room (multiply falloff)
  const lightI = power * (0.85 + 0.15 * Math.sin(t * 17) * Math.sin(t * 5.3)) * (glitch ? 1.25 : 1);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = radGrad(ctx, S.sx + S.sw / 2, S.sy + S.sh / 2, 60, 1250, [[0, rgba(mixc([40, 40, 60], [200, 215, 255], lightI), 1)], [0.45, rgba(mixc([20, 18, 34], [70, 78, 120], lightI), 1)], [1, 'rgb(10,8,16)']]);
  ctx.fillRect(-200, -200, W + 400, H + 400);
  ctx.restore();
  // tree lights (not affected by the darkness)
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const r = mulberry32(8);
  for (let i = 0; i < 26; i++) {
    const tier = (r() * 4) | 0, u = r() * 2 - 1;
    const lx = 250 + u * (80 + tier * 45) * 0.9, ly = 470 + tier * 120 + r() * 40;
    const col = ['#ff5a4a', '#ffd24a', '#4aa8ff', '#6aff8a', '#ff8ad0'][i % 5];
    const on = 0.4 + 0.6 * Math.max(0, Math.sin(t * 2.2 + i * 1.7));
    drawGlow(ctx, lx, ly, 30, col, 0.6 * on); drawGlow(ctx, lx, ly, 6, '#ffffff', 0.9 * on, 0.5);
  }
  // screen glow spill
  drawGlow(ctx, S.sx + S.sw / 2, S.sy + S.sh / 2, 700, '#7fa6ff', 0.22 * lightI);
  ctx.restore();
  ctx.restore();
  // over-the-shoulder: the kid's head and shoulders, backlit by the screen
  const bob = Math.sin(lt * 3) * 4 + (lt > 1.05 && lt < 1.6 ? -10 : 0) + (lt > 2.25 && lt < 2.8 ? -8 : 0);
  Fig.draw(ctx, { x: 880, y: 1420 + bob, S: 1500, body: 'child', color: '#07060b', halo: rgba(hex('#8fb0ff'), 0.55 * power), haloBlur: 10, t, hair: 'short',
    pose: { view: 'front', lean: 0, neck: 5, shL: 28, elL: -120, shR: 30, elR: -122, hipL: 0, hipR: 0 } });
};

// ===========================================================================
// The grandparents' village at night
// ===========================================================================
function village(ctx, t, o = {}) {
  const cam = o.cam || { zoom: 1, fx: W / 2, fy: H / 2, px: 0, py: 0 };
  const GY = 830;
  parallax(ctx, cam, 0);
  Env.sky(ctx, [[0, '#070b1f'], [0.45, '#111a3c'], [0.8, '#26305a'], [1, '#3a3c66']], 0, GY);
  Env.milkyWay(ctx, 0.55, 9);
  Env.stars(ctx, 11, 360, t, 1, GY - 80, 1);
  // moon
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, 1620, 170, 260, '#aab8ff', 0.25);
  ctx.restore();
  ctx.fillStyle = '#f3efe0'; ctx.beginPath(); ctx.arc(1620, 170, 34, 0, TAU); ctx.fill();
  ctx.fillStyle = '#0c1330'; ctx.beginPath(); ctx.arc(1604, 160, 32, 0, TAU); ctx.fill();
  parallax(ctx, cam, 0.25);
  Env.hills(ctx, 3, GY - 120, 110, '#1b2248', 0.0018);
  // distant village lights
  const r = mulberry32(19);
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) { const lx = r() * W, ly = GY - 150 + r() * 60; drawGlow(ctx, lx, ly, 14, '#ffb45e', 0.5 * (0.6 + 0.4 * Math.sin(t + i))); }
  ctx.restore();
  parallax(ctx, cam, 0.45);
  Env.hills(ctx, 7, GY - 50, 90, '#141a38', 0.0026);
  parallax(ctx, cam, 0.8);
  // walnut tree
  Env.tree(ctx, 520, GY + 10, 620, 71, '#0a0d1c', t, { crown: 0.42, blobs: 22, sway: 0.6, holes: '#1a2248' });
  // house
  const hx = 900, hw = 520, hh = 250;
  const win = Env.house(ctx, hx, GY + 6, hw, hh, { wall: '#4a5070', roof: '#141828', porch: true, winX: 0.56 });
  // whitewash in moonlight (subtle gradient)
  ctx.fillStyle = linGrad(ctx, hx, GY - hh, hx, GY, [[0, 'rgba(160,170,210,0.18)'], [1, 'rgba(0,0,0,0.25)']]);
  ctx.fillRect(hx, GY + 6 - hh, hw, hh);
  // door
  ctx.fillStyle = '#1a1a28'; ctx.fillRect(hx + hw * 0.18, GY + 6 - hh * 0.72, hw * 0.13, hh * 0.72);
  Env.lightWindow(ctx, win, o.window ?? 1, '#1a1c2c', o.grandma ?? 1, t);
  // chimney smoke
  ctx.save();
  for (let i = 0; i < 8; i++) {
    const k = fract(t * 0.07 + i / 8);
    const sx = win.chimney[0] + 18 + Math.sin(k * 6 + i) * 20 + k * 90, sy = win.chimney[1] - k * 260;
    drawGlow(ctx, sx, sy, 40 + k * 110, '#9aa4c8', (1 - k) * 0.22);
  }
  ctx.restore();
  // well sweep
  Env.wellSweep(ctx, 1640, GY + 12, 250, '#0b0e1e', t);
  // ground
  ctx.fillStyle = linGrad(ctx, 0, GY, 0, H, [[0, '#101530'], [1, '#05070f']]);
  ctx.fillRect(-300, GY, W + 600, H);
  Env.grass(ctx, 5, GY + 14, '#0c1024', 500, 26, t);
  // bench by the gate, a kid looking at the stars
  parallax(ctx, cam, 1.0);
  ctx.fillStyle = '#06080f';
  ctx.fillRect(250, 890, 300, 18); ctx.fillRect(270, 905, 14, 60); ctx.fillRect(515, 905, 14, 60);
  if (o.kid !== false) Fig.draw(ctx, { x: 380, y: 890 - 0.02 * 250, S: 250, body: 'child', color: '#06080f', t, hair: 'short',
    pose: { lean: -8, neck: -34, hipL: 88, knL: 88, hipR: 82, knR: 80, shL: 20, elL: 20, shR: 28, elR: 30 } });
  // fence in the foreground
  parallax(ctx, cam, 1.2);
  Env.fence(ctx, -100, 760, 1010, 170, '#04050b', 0.3);
  Env.fence(ctx, 1080, W + 100, 1010, 170, '#04050b', 0.3);
  Env.grass(ctx, 9, H + 10, '#020308', 300, 90, t);
  parallax(ctx, cam, 0);
  Env.fireflies(ctx, 23, o.fireflies ?? 34, t, [0, 520, W, 520], 1);
}
Scenes.village = (ctx, lt, t) => {
  village(ctx, t, { cam: camPath([{ t: 0, zoom: 1.04, fx: 900, fy: 560 }, { t: 12, zoom: 1.12, fx: 1060, fy: 600 }], lt) });
};

// ===========================================================================
// ACT II — the 2000s
// ===========================================================================
Scenes.dialup = (ctx, lt, t) => {
  const z = 1.0 + lt * 0.035;
  ctx.save();
  camera(ctx, z, 960, 470);
  ctx.fillStyle = '#07080c'; ctx.fillRect(-200, -200, W + 400, H + 400);
  const scr = Props.screen.dialup(lt);
  const M = Props.monitor(ctx, 370, -10, 1180, scr, t);
  // desk + modem
  ctx.fillStyle = '#15110e'; ctx.fillRect(-200, 930, W + 400, 400);
  Props.modem(ctx, 60, 900, 520, t, lt > 0.2);
  // monitor light on the room (multiply falloff)
  ctx.save(); ctx.globalCompositeOperation = 'multiply';
  ctx.fillStyle = radGrad(ctx, M.sx + M.sw / 2, M.sy + M.sh / 2, 100, 1300, [[0, 'rgb(255,255,255)'], [0.5, 'rgb(90,100,120)'], [1, 'rgb(20,22,30)']]);
  ctx.fillRect(-200, -200, W + 400, H + 400);
  ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, M.sx + M.sw / 2, M.sy + M.sh / 2, 900, '#5ab0c0', 0.16); ctx.restore();
  ctx.restore();
  const fin = clamp(lt / 0.5);
  if (fin < 1) { ctx.fillStyle = `rgba(0,0,0,${1 - fin})`; ctx.fillRect(0, 0, W, H); }
};

Scenes.messenger = (ctx, lt, t) => {
  let shx = 0, shy = 0;
  if (lt > 5.0 && lt < 5.7) { const k = (lt - 5.0) / 0.7; shx = Math.sin(lt * 95) * 16 * (1 - k); shy = Math.cos(lt * 83) * 12 * (1 - k); }
  const cam = camPath([{ t: 0, zoom: 1.0, fx: 960, fy: 540 }, { t: 2.6, zoom: 1.02, fx: 960, fy: 540 }, { t: 4.2, zoom: 1.28, fx: 1130, fy: 520 }, { t: 9, zoom: 1.34, fx: 1140, fy: 520 }], lt);
  ctx.save();
  ctx.translate(shx, shy);
  camera(ctx, cam.zoom, cam.fx, cam.fy);
  ctx.fillStyle = '#0a0a0e'; ctx.fillRect(-400, -400, W + 800, H + 800);
  const scr = Props.screen.messenger(lt, t);
  Props.monitor(ctx, 140, -60, 1640, scr, t);
  ctx.restore();
};

// T9 text typed over time
const T9_TEXT = 'cant sleep. u up? :)';
const T9_KEYS = { c: '2', a: '2', n: '6', t: '8', ' ': '0', s: '7', l: '5', e: '3', p: '7', '.': '1', u: '8', '?': '1', ':': '*', ')': '*' };
Scenes.phone = (ctx, lt, t) => {
  // dark bedroom with distant window lights
  Props.blurBG(ctx, (x) => {
    x.fillStyle = linGrad(x, 0, 0, 0, H, [[0, '#0b1020'], [1, '#05060c']]); x.fillRect(0, 0, W, H);
    x.fillStyle = '#18223a'; x.fillRect(80, 80, 620, 700);
    for (let i = 0; i < 30; i++) { x.fillStyle = hash(i) < 0.5 ? '#ffcf7a' : '#6f8ad8'; x.fillRect(120 + (i % 6) * 95, 140 + Math.floor(i / 6) * 120, 40, 50); }
  });
  Env.bokeh(ctx, 41, 12, t, ['#ffcf7a', '#8fa8ff'], [60, 60, 700, 760], [40, 120], 0.25);
  const typeT0 = 0.2, cps = 20 / 3.4;
  const n = clamp(Math.floor((lt - typeT0) * cps), 0, T9_TEXT.length);
  const typing = lt >= typeT0 && lt < 3.7;
  const pressed = typing && ((lt - typeT0) * cps) % 1 < 0.55 ? T9_KEYS[T9_TEXT[Math.max(0, n - 1)]] || null : null;
  const ringing = (lt > 4.4 && lt < 4.9) || (lt > 5.4 && lt < 5.9);
  const shake = ringing ? [Math.sin(lt * 120) * 7, Math.cos(lt * 97) * 5] : [0, 0];
  const lcd = Props.phone.lcd((x) => {
    x.font = '8px "Press Start 2P"';
    if (lt < 3.8) {
      x.fillText('abc', 2, 2);
      const left = String(160 - n);
      x.fillText(left, 94 - left.length * 8, 2);
      x.fillRect(0, 11, 96, 1);
      const txt = T9_TEXT.slice(0, n);
      const cut = txt.length > 11 ? 12 : 99;
      const lines = [txt.slice(0, Math.min(11, txt.length)), txt.length > 12 ? txt.slice(12) : ''];
      lines.forEach((ln, i) => x.fillText(ln, 2, 16 + i * 11));
      if (Math.floor(lt * 3) % 2 === 0) { const two = txt.length > 12; const ll = lines[two ? 1 : 0]; x.fillRect(2 + ll.length * 8, 16 + (two ? 11 : 0), 1, 9); }
      x.fillText('Send', 2, 58); x.fillText('Clear', 54, 58);
    } else if (lt < 4.4) {
      x.strokeStyle = '#000'; x.lineWidth = 1; x.strokeRect(34.5, 14.5, 28, 18); x.beginPath(); x.moveTo(34.5, 14.5); x.lineTo(48.5, 26.5); x.lineTo(62.5, 14.5); x.stroke();
      x.fillText('Message', 20, 38); x.fillText('sent', 32, 48);
    } else if (lt < 5.95) {
      x.fillText('Alex', 30, 10); x.fillText('♥', 64, 10);
      x.fillText('calling', 20, 26);
      const k = Math.floor(lt * 6) % 4; x.fillText('.'.repeat(k), 76, 26);
      x.fillText('Answer', 2, 58);
    } else {
      x.fillText('1 missed', 14, 14); x.fillText('call', 30, 26);
      x.fillText('Alex', 30, 40); x.fillText('♥', 64, 40);
      x.fillText('Show', 2, 58); x.fillText('Exit', 62, 58);
    }
  });
  ctx.save();
  ctx.translate(1080 + shake[0], 70 + shake[1]);
  ctx.rotate(-0.05);
  Props.phone.body(ctx, 0, 0, 5.6, lcd, pressed, 1);
  ctx.restore();
  if (ringing) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, 1400, 360, 700, '#a8e060', 0.12); ctx.restore(); }
};

Scenes.earbuds = (ctx, lt, t) => {
  const z = 1.0 + lt * 0.02;
  ctx.save();
  camera(ctx, z, 960, 600);
  Props.blurBG(ctx, (x) => {
    x.fillStyle = linGrad(x, 0, 0, 0, H, [[0, '#0a0f24'], [0.6, '#1a1840'], [1, '#2a1a30']]); x.fillRect(-200, -200, W + 400, H + 400);
    for (let b = 0; b < 7; b++) {
      const bx = b * 300 - 100, bw = 240, bh = 380 + (b % 3) * 120;
      x.fillStyle = '#121632'; x.fillRect(bx, 760 - bh, bw, bh);
      for (let i = 0; i < 40; i++) if (hash(b * 50 + i) < 0.45) { x.fillStyle = hash(i + b) < 0.7 ? '#ffc56e' : '#7fa0ff'; x.fillRect(bx + 20 + (i % 5) * 44, 790 - bh + Math.floor(i / 5) * 46, 22, 26); }
    }
    x.fillStyle = '#100c18'; x.fillRect(-200, 760, W + 400, 400);
  });
  Env.bokeh(ctx, 51, 22, t, ['#ffc56e', '#ff9e7a', '#7fa0ff', '#ffe0b0'], [0, 150, W, 600], [30, 130], 0.35);
  // streetlamp from above right
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  drawGlow(ctx, 1500, -40, 900, '#ffb766', 0.35);
  ctx.restore();
  // bench
  ctx.fillStyle = '#07060b';
  ctx.fillRect(420, 770, 1080, 34); ctx.fillRect(420, 700, 1080, 16); ctx.fillRect(460, 800, 26, 200); ctx.fillRect(1430, 800, 26, 200);
  // the two teens (front view, sitting), leaning heads together
  const breath = Math.sin(lt * 1.4);
  const A = Fig.draw(ctx, { x: 820, y: 770, S: 560, body: 'teen', color: '#07060b', halo: 'rgba(255,190,120,0.55)', haloBlur: 9, t, hair: 'short',
    pose: { view: 'front', lean: 4 + breath * 0.5, neck: 12, shL: 18, elL: -40, shR: 12, elR: -70, hipL: 10, knL: 8, hipR: 10, knR: 8, thighScale: 0.35 } });
  const B = Fig.draw(ctx, { x: 1110, y: 770, S: 540, body: 'woman', color: '#07060b', halo: 'rgba(255,190,120,0.55)', haloBlur: 9, t, hair: 'long',
    pose: { view: 'front', lean: -5 - breath * 0.5, neck: -14, shL: 14, elL: -60, shR: 16, elR: -30, hipL: 10, knL: 8, hipR: 10, knR: 8, thighScale: 0.35 } });
  // mp3 player in A's hands with a glowing screen
  const px = 900, py = 745;
  ctx.fillStyle = '#e8e8ec'; rrect(ctx, px - 22, py - 38, 44, 70, 8); ctx.fill();
  ctx.fillStyle = '#6ab8ff'; ctx.fillRect(px - 16, py - 32, 32, 24);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; drawGlow(ctx, px, py - 20, 80, '#6ab8ff', 0.5); ctx.restore();
  // earbud cables: one ear each
  const earA = [820 + 0.064 * 560 * 1.0 + 6, 770 - 0.39 * 560 + 6];
  const earB = [1110 - 0.064 * 540 - 6, 770 - 0.39 * 540 + 8];
  const split = [985, 600];
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 3.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(px, py + 30); ctx.bezierCurveTo(px + 30, py + 60, split[0] - 20, split[1] + 120, split[0], split[1]); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(split[0], split[1]); ctx.bezierCurveTo(split[0] - 40, split[1] - 40, earA[0] + 50, earA[1] + 90, earA[0], earA[1]); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(split[0], split[1]); ctx.bezierCurveTo(split[0] + 40, split[1] - 40, earB[0] - 50, earB[1] + 90, earB[0], earB[1]); ctx.stroke();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = 'rgba(255,240,220,0.25)'; ctx.lineWidth = 10;
  ctx.beginPath(); ctx.moveTo(split[0], split[1]); ctx.bezierCurveTo(split[0] - 40, split[1] - 40, earA[0] + 50, earA[1] + 90, earA[0], earA[1]); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(split[0], split[1]); ctx.bezierCurveTo(split[0] + 40, split[1] - 40, earB[0] - 50, earB[1] + 90, earB[0], earB[1]); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  for (const e of [earA, earB]) { ctx.beginPath(); ctx.arc(e[0], e[1], 7, 0, TAU); ctx.fill(); }
  // moths around the lamp light
  Env.motes(ctx, 61, 30, t, { color: '#ffe0b0', alpha: 0.6, size: 2, region: [1100, 0, 800, 500], drift: 3, rise: 2 });
  ctx.restore();
};

// ===========================================================================
// ACT III — the 2010s: a square photo gets a vintage filter
// ===========================================================================
function friendsPhoto(ctx, w, h, t, look) {
  // look: 0 = normal, 1 = vintage
  ctx.fillStyle = linGrad(ctx, 0, 0, 0, h, [[0, mixh('#3b6fb8', '#e9a07a', look * 0.6)], [0.55, mixh('#f4a36a', '#ffc98a', look)], [0.72, mixh('#ffdb9a', '#fff0c0', look)], [1, '#2a2030']]);
  ctx.fillRect(0, 0, w, h);
  Env.sun(ctx, w * 0.62, h * 0.66, w * 0.05, '#fff6dc', '#ffae60', 1);
  ctx.fillStyle = mixh('#2d1f2c', '#3a2430', look);
  ctx.fillRect(0, h * 0.72, w, h * 0.3);
  const people = [[0.2, 0.0], [0.38, 0.9], [0.56, 0.3], [0.76, 1.4]];
  people.forEach(([px, ph], i) => {
    const jump = Math.abs(Math.sin(ph + 1.2)) * h * 0.08;
    Fig.draw(ctx, { x: w * px, y: h * 0.72 - h * 0.12 - jump, S: h * 0.27, body: i % 2 ? 'woman' : 'teen', color: '#1a1018', t, hair: i % 2 ? 'long' : 'short',
      pose: { view: 'front', lean: 0, neck: -6, shL: 150 + i * 5, elL: 10, shR: 160 - i * 4, elR: 8, hipL: 12 + i * 4, knL: 30, hipR: 14, knR: 40 } });
  });
  if (look > 0) {
    ctx.save();
    ctx.globalAlpha = look;
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = 'rgba(70,40,60,0.55)'; ctx.fillRect(0, 0, w, h); // lifted blacks
    ctx.globalCompositeOperation = 'soft-light';
    ctx.fillStyle = 'rgba(255,170,90,0.6)'; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = radGrad(ctx, w / 2, h / 2, w * 0.3, w * 0.75, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(40,10,20,0.55)']]);
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'lighter';
    drawGlow(ctx, w * 0.05, h * 0.2, w * 0.5, '#ff6a3a', 0.35);
    ctx.restore();
  }
}
Scenes.filters = (ctx, lt, t) => {
  Props.blurBG(ctx, (x) => {
    Env.sky(x, [[0, '#3a5aa8'], [0.5, '#f4a36a'], [0.75, '#ffd49a'], [1, '#3a2a3a']], 0, H);
    Env.sun(x, 1500, 640, 90, '#fff5da', '#ffab5e', 1);
    x.fillStyle = '#2a1e2e'; x.fillRect(-100, 760, W + 200, 400);
  });
  Env.bokeh(ctx, 71, 16, t, ['#ffcf8a', '#ffb070', '#fff0c8'], [0, 200, W, 700], [50, 170], 0.25);
  ctx.fillStyle = linGrad(ctx, 0, 0, W, 0, [[0, 'rgba(20,8,16,0.62)'], [0.3, 'rgba(20,8,16,0.2)'], [0.5, 'rgba(20,8,16,0)'], [0.7, 'rgba(20,8,16,0.2)'], [1, 'rgba(20,8,16,0.62)']]);
  ctx.fillRect(0, 0, W, H);
  const shutter = [1.6, 3.2];
  let flash = 0; for (const s of shutter) flash = Math.max(flash, env(lt, s, s + 0.35, 0.02, 0.3));
  const retro = Ease.inOutSine(clamp((lt - 5.2) / 0.8));
  const golden = lt > 4.4 && lt < 5.2 ? 0.5 : 0;
  const liveView = lt < 3.4;
  const ph = Props.smartphone(ctx, 760, 40, 500, (x, sw, sh) => {
    x.fillStyle = '#0c0c0e'; x.fillRect(0, 0, sw, sh);
    // top bar
    x.fillStyle = '#1c1c20'; x.fillRect(0, 0, sw, 64);
    x.fillStyle = '#fff'; x.font = '500 24px "Inter"'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(liveView ? 'Camera' : 'Filters', sw / 2, 34);
    x.textAlign = 'left';
    const py = 90, pw = sw, phh = sw;
    x.save(); x.translate(0, py);
    friendsPhoto(x, pw, phh, liveView ? t : 3.3, retro + golden);
    if (liveView) {
      x.strokeStyle = 'rgba(255,255,255,0.35)'; x.lineWidth = 1.5;
      for (const k of [1 / 3, 2 / 3]) { x.beginPath(); x.moveTo(pw * k, 0); x.lineTo(pw * k, phh); x.moveTo(0, phh * k); x.lineTo(pw, phh * k); x.stroke(); }
    }
    x.restore();
    if (liveView) {
      x.fillStyle = '#fff'; x.beginPath(); x.arc(sw / 2, py + phh + 130, 52, 0, TAU); x.fill();
      x.strokeStyle = '#000'; x.lineWidth = 5; x.beginPath(); x.arc(sw / 2, py + phh + 130, 42, 0, TAU); x.stroke();
    } else {
      const names = ['Normal', 'Faded', 'Golden', 'Retro', 'Dreamy'];
      const sel = lt < 4.4 ? 0 : lt < 5.2 ? 2 : 3;
      const off = -Math.max(0, sel - 1) * 120 * clamp((lt - 4.2) / 1.2);
      names.forEach((nm, i) => {
        const tx = 24 + i * 120 + off, ty = py + phh + 40;
        x.save(); x.beginPath(); x.rect(tx, ty, 104, 104); x.clip(); x.translate(tx, ty); x.scale(104 / pw, 104 / pw);
        friendsPhoto(x, pw, pw, 3.3, i === 3 ? 1 : i === 2 ? 0.5 : i === 1 ? 0.3 : i === 4 ? 0.7 : 0);
        x.restore();
        x.strokeStyle = i === sel ? '#3aa0ff' : 'rgba(255,255,255,0.2)'; x.lineWidth = i === sel ? 5 : 2; x.strokeRect(tx, ty, 104, 104);
        x.fillStyle = i === sel ? '#fff' : '#9a9aa0'; x.font = '500 19px "Inter"'; x.fillText(nm, tx + 6, ty + 132);
      });
      // like
      const lk = clamp((lt - 6.5) / 0.35);
      if (lk > 0) {
        const s = Ease.outBack(lk) * 1.0;
        x.save(); x.translate(sw / 2, py + phh / 2); x.scale(s, s); x.globalAlpha = 1 - clamp((lt - 7.6) / 0.6);
        x.fillStyle = '#ffffff';
        x.beginPath(); x.moveTo(0, 40); x.bezierCurveTo(-90, -20, -40, -90, 0, -40); x.bezierCurveTo(40, -90, 90, -20, 0, 40); x.fill();
        x.restore();
        x.fillStyle = '#fff'; x.font = '600 24px "Inter"'; x.fillText('♥ 23 likes', 24, py + phh + 230);
      }
    }
    if (flash > 0) { x.fillStyle = `rgba(255,255,255,${flash})`; x.fillRect(0, 0, sw, sh); }
  });
};

// ===========================================================================
// ACT IV — why do memories glow?
// ===========================================================================
Scenes.question = (ctx, lt, t) => {
  ctx.fillStyle = '#06050a'; ctx.fillRect(0, 0, W, H);
  const a = Ease.inOutSine(clamp(lt / 1.6));
  const x0 = 300, y0 = -120, x1 = 1500, y1 = 1250, w0 = 90, w1 = 700;
  Env.beam(ctx, x0, y0, x1, y1, w0, w1, '#ffd9a8', 0.16 * a);
  // dust inside the beam only
  const ax = x1 - x0, ay = y1 - y0, L = Math.hypot(ax, ay);
  const mask = (px, py) => {
    const u = ((px - x0) * ax + (py - y0) * ay) / (L * L);
    if (u < 0 || u > 1) return false;
    const cx = x0 + ax * u, cy = y0 + ay * u;
    return Math.hypot(px - cx, py - cy) < lerp(w0, w1, u) * 0.5;
  };
  Env.motes(ctx, 101, 260, t, { color: '#fff1d6', alpha: 0.9 * a, size: 2.2, mask, drift: 0.5, rise: 0.3 });
};

Scenes.realityMemory = (ctx, lt, t) => {
  const cam = { zoom: 1.02 + lt * 0.006, fx: 960, fy: 560, px: 0, py: 0 };
  const wipe0 = 2.8, wipe1 = 3.9;
  const k = Ease.inOutCubic(clamp((lt - wipe0) / (wipe1 - wipe0)));
  const wx = lerp(-150, W + 150, k);
  if (k < 1) courtyard(ctx, t, { mode: 'grey', cam });
  if (k > 0) {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.beginPath(); ctx.rect(0, 0, wx, H); ctx.clip();
    courtyard(ctx, t, { mode: 'golden', dusk: 0.08, cam });
    ctx.restore();
    // the painter's light: a glowing seam sweeping across
    if (k < 1) {
      ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = linGrad(ctx, wx - 260, 0, wx + 40, 0, [[0, 'rgba(255,190,120,0)'], [0.8, 'rgba(255,210,150,0.55)'], [1, 'rgba(255,245,220,0.95)']]);
      ctx.fillRect(wx - 260, 0, 300, H);
      Env.motes(ctx, 303, 60, t, { color: '#fff0c8', alpha: 1, size: 2.8, region: [wx - 120, 0, 160, H] });
      ctx.restore();
    }
  }
};

Scenes.timelapse = (ctx, lt, t) => {
  const GY = 860;
  const q = fract(lt * 0.34 + 0.1);
  const p = q < 0.72 ? (q / 0.72) * 0.5 : 0.5 + ((q - 0.72) / 0.28) * 0.5; // day cycle, days last longer
  const day = Math.max(0, Math.sin(p * TAU)); // 0 night .. 1 noon
  const dusk = 1 - smoothstep(0.0, 0.28, day);
  Env.sky(ctx, [[0, mixh('#1f58b0', '#0a1030', dusk)], [0.6, mixh('#5c9ad8', '#2a2a60', dusk)], [0.85, mixh('#e8a878', '#8a4a7a', dusk)], [1, mixh('#f3c894', '#3a3060', dusk)]], 0, GY);
  Env.stars(ctx, 121, 200, t, smoothstep(0.55, 1, dusk), GY - 100, 0);
  // sun & moon arcs
  const sa = p * TAU;
  const sx = W / 2 - Math.cos(sa * 0.5 * 2) * 0, sunX = lerp(-200, W + 200, fract(p * 2) < 0.5 && p < 0.5 ? p * 2 : 1);
  if (p < 0.5) { const u = p * 2; Env.sun(ctx, lerp(-100, W + 100, u), GY - Math.sin(u * Math.PI) * 720, 55, '#fff6dc', '#ffb45e', 1); }
  else { const u = (p - 0.5) * 2; ctx.fillStyle = '#f3efe0'; ctx.beginPath(); ctx.arc(lerp(-100, W + 100, u), GY - Math.sin(u * Math.PI) * 620, 30, 0, TAU); ctx.fill(); }
  // racing clouds
  Env.cloudBand(ctx, 131, 260, t * 60, rgba(mixc(hex('#ffffff'), hex('#3a3a60'), dusk), 1), 0.35, 1.4, 12);
  Env.cloudBand(ctx, 132, 420, t * 90, rgba(mixc(hex('#fff0e0'), hex('#4a3a6a'), dusk), 1), 0.3, 1.1, 14);
  // silhouettes: blocks, the bar, a kid sitting on top of the bar
  const sil = mixh('#2a2040', '#08070f', dusk);
  Env.block(ctx, { x: -60, base: GY + 2, w: 520, floors: 9, fh: 60, cols: 7, seed: 5, facade: sil, window: sil, lit: dusk > 0.6 ? 0.4 : 0, litColors: ['#ffcf86', '#ffd9a0'], t });
  Env.block(ctx, { x: 1450, base: GY + 2, w: 520, floors: 7, fh: 62, cols: 7, seed: 6, facade: sil, window: sil, lit: dusk > 0.6 ? 0.35 : 0, litColors: ['#ffcf86', '#ffd9a0'], t });
  ctx.fillStyle = sil; ctx.fillRect(-100, GY, W + 200, H);
  Env.beater(ctx, 760, GY + 4, 400, 330, sil);
  Fig.draw(ctx, { x: 990, y: GY + 4 - 330 - 2, S: 260, body: 'child', color: sil, t, hair: 'short', key: true, keySwing: Math.sin(t * 1.3) * 0.3,
    pose: { lean: -4, neck: -22, hipL: 84, knL: 70 + Math.sin(t * 3) * 12, hipR: 78, knR: 60 - Math.sin(t * 3) * 12, shL: 30, elL: 20, shR: 16, elR: 10 } });
  Env.birds(ctx, 141, 5, t * 3, rgba(hex(sil), 0.8), [0, 150, W, 300], 1);
};

// the adult under the lamp whose shadow on the wall is a child
Scenes.shadow = (() => {
  const [lc, lx] = makeCanvas(W, H);
  return (ctx, lt, t) => {
    const z = 1.0 + lt * 0.012;
    ctx.save();
    camera(ctx, z, 1000, 560);
    // night + concrete wall
    ctx.fillStyle = '#06060c'; ctx.fillRect(-200, -200, W + 400, H + 400);
    ctx.fillStyle = '#1a1826'; ctx.fillRect(560, -200, 1600, 1100);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3;
    for (let x = 560; x < 2160; x += 400) { ctx.beginPath(); ctx.moveTo(x, -200); ctx.lineTo(x, 900); ctx.stroke(); }
    for (let y = 100; y < 900; y += 300) { ctx.beginPath(); ctx.moveTo(560, y); ctx.lineTo(2160, y); ctx.stroke(); }
    ctx.fillStyle = '#0e0d16'; ctx.fillRect(-200, 900, W + 400, 400);
    // light layer: warm pool from the lamp, minus the shadow
    lx.setTransform(1, 0, 0, 1, 0, 0); lx.clearRect(0, 0, W, H);
    lx.globalCompositeOperation = 'source-over';
    lx.fillStyle = radGrad(lx, 900, 380, 20, 1100, [[0, 'rgba(255,190,115,0.72)'], [0.35, 'rgba(255,160,90,0.42)'], [1, 'rgba(255,140,80,0)']]);
    lx.fillRect(0, 0, W, H);
    // the shadow: morph adult -> child
    const m = Ease.inOutSine(clamp((lt - 3.4) / 2.2));
    const body = Fig.lerpBody('adult', 'child', m);
    const S = lerp(760, 560, m);
    const pose = { lean: lerp(1, -2, m), neck: lerp(-2, -20, m), hipL: -4, knL: 3, hipR: 4, knR: 2, shL: lerp(-6, 8, m), elL: lerp(10, 16, m), shR: lerp(6, 14, m), elR: lerp(12, 30, m) };
    Soft.draw(lx, (x) => {
      Fig.draw(x, { x: 1260, y: 900 - (body.thigh + body.shin + 0.02) * S, S, body, pose, color: 'rgba(0,0,0,0.92)', t, hair: 'short',
        key: m > 0.6, keySwing: Math.sin(t * 1.1) * 0.25, keyColor: 'rgba(0,0,0,0.92)' });
    }, { scale: 0.5, blur: 2.5, comp: 'destination-out' });
    lx.globalCompositeOperation = 'source-over';
    ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.drawImage(lc, 0, 0); ctx.restore();
    // lamp post at the left edge
    Env.lamp(ctx, 260, 910, 700, '#050408', 1, '#ffb766', t);
    // the adult, seen from the side, looking at the wall
    const breathe = Math.sin(t * 1.2) * 1.5;
    Fig.draw(ctx, { x: 640, y: 905 - 0.49 * 520, S: 520, body: 'adult', color: '#050408', halo: 'rgba(255,180,110,0.5)', haloBlur: 7, t, hair: 'short',
      pose: { lean: 2, neck: -4 + breathe * 0.5, hipL: -3, knL: 3, hipR: 4, knR: 2, shL: -8, elL: 22, shR: 6, elR: 28 } });
    ctx.restore();
    Env.motes(ctx, 151, 40, t, { color: '#ffe0b0', alpha: 0.5, size: 2, region: [0, 0, 1100, 900] });
  };
})();

Scenes.window = (ctx, lt, t) => {
  const fade = 1 - Ease.inOutSine(clamp((lt - 2.2) / 4.2));
  const cam = camPath([{ t: 0, zoom: 2.1, fx: 1205, fy: 690 }, { t: 9.4, zoom: 2.45, fx: 1212, fy: 686 }], lt);
  village(ctx, t, { cam, grandma: fade, window: 1 - (1 - fade) * 0.12, kid: false, fireflies: 26 });
};

Scenes.projector = (ctx, lt, t) => {
  ctx.fillStyle = '#050407'; ctx.fillRect(0, 0, W, H);
  // the screen at the left shows flickering memories
  const sx = 70, sy = 190, sw = 900, sh = 506;
  const frames = [(c, tt) => courtyard(c, tt, { mode: 'golden', dusk: 0.1 }), (c, tt) => friendsPhoto(c, W, H, tt, 1), (c, tt) => Scenes.keyCloseup(c, 1.2, tt)];
  const idx = Math.floor(lt / 3) % frames.length;
  const mem = Scenes.projector.mem || (Scenes.projector.mem = makeCanvas(480, 270));
  const [mc, mx] = mem;
  mx.setTransform(0.25, 0, 0, 0.25, 0, 0);
  mx.save(); frames[idx](mx, t); mx.restore();
  const flick = 0.82 + 0.18 * hash(Math.floor(t * 24) * 1.7);
  ctx.save();
  ctx.globalAlpha = 0.88 * flick;
  ctx.drawImage(mc, sx, sy, sw, sh);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = `rgba(255,230,190,${0.04 * flick})`; ctx.fillRect(sx, sy, sw, sh);
  ctx.globalCompositeOperation = 'source-over';
  // film frame edge + a scratch or two
  ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 6; ctx.strokeRect(sx, sy, sw, sh);
  ctx.restore();
  // the beam from the projector (right) to the screen
  const px = 1760, py = 560;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const g = ctx.createLinearGradient(px, py, sx + sw, sy + sh / 2);
  g.addColorStop(0, `rgba(255,236,200,${0.34 * flick})`); g.addColorStop(1, `rgba(255,236,200,${0.07 * flick})`);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.moveTo(px, py - 14); ctx.lineTo(sx + sw, sy); ctx.lineTo(sx + sw, sy + sh); ctx.lineTo(px, py + 14); ctx.closePath(); ctx.fill();
  drawGlow(ctx, px, py, 120, '#fff2d8', 0.9 * flick, 0.4);
  ctx.restore();
  const mask = (x, y) => { if (x < sx + sw || x > px) return false; const u = (px - x) / (px - (sx + sw)); return Math.abs(y - lerp(py, sy + sh / 2, u)) < lerp(14, sh / 2, u); };
  Env.motes(ctx, 161, 320, t, { color: '#fff4dc', alpha: 1, size: 2.3, mask, drift: 0.4, rise: 0.25 });
  // projector silhouette with spinning reels
  ctx.fillStyle = '#0c0a10';
  rrect(ctx, 1700, 520, 260, 170, 16); ctx.fill();
  ctx.fillRect(1740, 690, 20, 300); ctx.fillRect(1880, 690, 20, 300);
  for (const [rx, ry] of [[1760, 420], [1900, 430]]) {
    ctx.save(); ctx.translate(rx, ry); ctx.rotate(t * 3);
    ctx.fillStyle = '#0c0a10'; ctx.beginPath(); ctx.arc(0, 0, 96, 0, TAU); ctx.fill();
    ctx.fillStyle = '#17141d';
    for (let k = 0; k < 3; k++) { ctx.save(); ctx.rotate((k * TAU) / 3); ctx.beginPath(); ctx.ellipse(0, -52, 22, 30, 0, 0, TAU); ctx.fill(); ctx.restore(); }
    ctx.restore();
  }
  ctx.fillStyle = '#0c0a10'; rrect(ctx, 1660, 540, 70, 40, 8); ctx.fill();
};

// ===========================================================================
// ACT VI — rewind is impossible; press record
// ===========================================================================
Scenes.tapeEnd = (ctx, lt, t) => {
  const speed = lt < 0.3 ? 1 : Math.max(0, 1 - (lt - 0.3) / 0.9);
  const reel = -(Math.min(lt, 0.3) + (lt > 0.3 ? 0.9 * (1 - Math.pow(1 - clamp((lt - 0.3) / 0.9), 2)) / 2 : 0)) * 3.2 - 400;
  const popped = lt > 1.2 ? 1 : 0;
  const play = popped ? Math.max(0, 1 - (lt - 1.2) / 0.08) : 1;
  const cam = camPath([{ t: 0, zoom: 1.22, fx: 700, fy: 560 }, { t: 1.2, zoom: 1.22, fx: 700, fy: 560 }, { t: 6.2, zoom: 1.75, fx: 700, fy: 850 }], lt);
  ctx.save();
  camera(ctx, cam.zoom, cam.fx, cam.fy);
  Props.deck(ctx, { t, pressed: { play }, reel, packL: 0.02, level: [0.02 * speed, 0.02 * speed], led: play * 0.9, counter: 612, backlight: 0.35 + 0.5 * play, cassetteLabel: 'summer mix ’97' });
  ctx.restore();
  ctx.fillStyle = linGrad(ctx, 0, 0, 0, 520, [[0, `rgba(6,5,8,${0.85 * clamp((lt - 1.2) / 0.8)})`], [1, 'rgba(6,5,8,0)']]);
  ctx.fillRect(0, 0, W, 520);
};

// present-day courtyard: renovated pastel blocks
function today(ctx, t, o) {
  const glow = o.glow || 0;
  courtyard(ctx, t, Object.assign({ mode: 'golden', dusk: -0.0, cam: o.cam, extra: (c, tt, P, GY) => {
    // a person looking at their phone + a kid on a scooter
    Fig.draw(c, { x: 1340, y: GY + 40 - 0.49 * 170, S: 170, body: 'adult', color: P.figure, t: tt, hair: 'short', pose: { lean: 6, neck: 24, hipL: -3, knL: 3, hipR: 4, knR: 2, shL: 30, elL: 95, shR: 28, elR: 100 } });
    c.save(); c.globalCompositeOperation = 'lighter'; drawGlow(c, 1368, GY + 40 - 0.49 * 170 - 60, 22, '#bfe0ff', 0.9); c.restore();
    const sx = 300 + ((tt * 140) % 1500);
    Fig.draw(c, { x: sx, y: GY + 60 - 0.5 * 120, S: 120, body: 'child', color: P.figure, t: tt, pose: { lean: 8, neck: -4, hipL: 4, knL: 10, hipR: -20, knR: 20, shL: 60, elL: 30, shR: 60, elR: 30 } });
    c.strokeStyle = P.figure; c.lineWidth = 4; c.beginPath(); c.moveTo(sx - 30, GY + 60); c.lineTo(sx + 40, GY + 60); c.moveTo(sx + 35, GY + 60); c.lineTo(sx + 30, GY - 20); c.stroke();
  } }, { modern: true, glow }));
}

Scenes.today = (ctx, lt, t) => {
  today(ctx, t, { cam: { zoom: 1.0 + lt * 0.01, fx: 960, fy: 560, px: 0, py: 0 }, glow: clamp(lt / 6) });
};

Scenes.rec = (ctx, lt, t) => {
  if (lt < 1.5) {
    const rec = clamp((lt - 0.02) / 0.1);
    ctx.save();
    camera(ctx, 1.9, 520, 880);
    Props.deck(ctx, { t, pressed: { play: rec, rec }, reel: -lt * 3.2, packL: 0.02, level: [0.3 * rec, 0.28 * rec], led: rec, counter: 0, backlight: 0.35 + 0.65 * rec, cassetteLabel: 'summer mix ’97' });
    ctx.restore();
  } else {
    today(ctx, t, { cam: { zoom: 1.06 + (lt - 1.5) * 0.01, fx: 960, fy: 560, px: 0, py: 0 }, glow: 1 });
  }
};

Scenes.endCard = (ctx, lt, t) => {
  ctx.fillStyle = radGrad(ctx, 960, 470, 40, 1300, [[0, '#6a3a3a'], [0.4, '#2a1420'], [1, '#07040a']]);
  ctx.fillRect(0, 0, W, H);
  Env.bokeh(ctx, 181, 18, t, ['#ffcf8a', '#ff9e6a', '#ffd9b0'], [0, 0, W, H], [60, 220], 0.12);
  Env.motes(ctx, 191, 90, t, { color: '#fff0cf', alpha: 0.6, size: 2, drift: 0.6, rise: 0.5 });
};
