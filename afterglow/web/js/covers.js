'use strict';
// Thumbnail / cover compositions (rendered with: node render/render.mjs --page covers.html --stills 0.5,30.5 --tag cover)

// 1) split: the same courtyard, grey on the left ("how it was"), golden on the right ("how we remember it")
function coverSplit(ctx, lt, t) {
  const cam = { zoom: 1.06, fx: 960, fy: 560, px: 0, py: 0 };
  const T = 24.6;
  courtyard(ctx, T, { mode: 'grey', cam });
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.beginPath(); ctx.rect(960, 0, W - 960, H); ctx.clip();
  courtyard(ctx, T, { mode: 'golden', dusk: 0.06, cam });
  ctx.restore();
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = linGrad(ctx, 900, 0, 1000, 0, [[0, 'rgba(255,200,140,0)'], [0.55, 'rgba(255,215,160,0.55)'], [0.62, 'rgba(255,248,230,0.95)'], [0.7, 'rgba(255,215,160,0.4)'], [1, 'rgba(255,200,140,0)']]);
  ctx.fillRect(900, 0, 100, H);
  Env.motes(ctx, 303, 50, T, { color: '#fff0c8', alpha: 1, size: 3, region: [900, 0, 120, H] });
  ctx.restore();
  // calm band behind the title
  ctx.fillStyle = linGrad(ctx, 0, 380, 0, 760, [[0, 'rgba(12,6,14,0)'], [0.5, 'rgba(12,6,14,0.5)'], [1, 'rgba(12,6,14,0)']]);
  ctx.fillRect(0, 380, W, 380);
}

// 2) golden hour: the signature image of the film
function coverGolden(ctx, lt, t) {
  courtyard(ctx, 24.6, { mode: 'golden', dusk: 0.05, cam: { zoom: 1.1, fx: 1010, fy: 560, px: 0, py: 0 } });
  ctx.fillStyle = linGrad(ctx, 0, 420, 0, 820, [[0, 'rgba(14,6,14,0)'], [0.5, 'rgba(14,6,14,0.48)'], [1, 'rgba(14,6,14,0)']]);
  ctx.fillRect(0, 420, W, 400);
}

const TITLE_BIG = { size: 250, weight: 600, tracking: 34, shadow: 1.0 };
const SCENES = [
  { t0: 0, t1: 5, draw: coverSplit },
  { t0: 6, t1: 40, draw: coverGolden },
];
const CAPTIONS = [
  { t0: -20, t1: 5, text: 'AFTERGLOW', style: 'title', overrides: TITLE_BIG, y: 660, stagger: 0 },
  { t0: -20, t1: 5, text: 'HOW IT WAS', style: 'label', overrides: { size: 50, tracking: 12, weight: 500 }, x: 480, y: 150, stagger: 0 },
  { t0: -20, t1: 5, text: 'HOW WE REMEMBER IT', style: 'label', overrides: { size: 50, tracking: 12, weight: 500 }, x: 1440, y: 150, stagger: 0 },
  { t0: 6, t1: 40, text: 'AFTERGLOW', style: 'title', overrides: TITLE_BIG, y: 640, stagger: 0 },
  { t0: 6, t1: 40, text: 'a letter to the ’90s, 2000s & 2010s', style: 'subtitle', overrides: { size: 72, weight: 500 }, y: 770, stagger: 0 },
];
const OVERLAYS = [{ t0: 6, t1: 40, draw: (ctx) => drawDateStamp(ctx, "'97 7 14", 1) }];
const COVER_LOOK = { warmth: 0.14, sat: 1.06, bloom: 0.7, bloomThreshold: 0.55, haze: 0.12, halation: 0.3, grain: 0.02, vignette: 0.45, leak: 0.08, leakSeed: 2, dust: 0, weave: 0, flicker: 0 };
const COVER_LOOK2 = Object.assign({}, COVER_LOOK, { warmth: 0.26, bloom: 0.8, haze: 0.18, leak: 0.18 });
const LOOKS = [{ t: 0, look: COVER_LOOK }, { t: 5.9, look: COVER_LOOK }, { t: 6, look: COVER_LOOK2 }, { t: 40, look: COVER_LOOK2 }];
const FADES = [];
