'use strict';
const SCENES = [
  { t0: 0, t1: 9.4, draw: Scenes.coldOpen },
  { t0: 9.0, t1: 21.6, draw: Scenes.title, xin: 0.3 },
  { t0: 21.0, t1: 26.0, draw: (c, lt, t) => courtyard(c, t, { mode: 'golden', dusk: 0.02 + lt * 0.006, cam: camPath([{ t: 0, zoom: 1.0, fx: 960, fy: 560 }, { t: 5, zoom: 1.05, fx: 980, fy: 570 }], lt) }), xin: 1.4 },
  { t0: 26.0, t1: 29.0, draw: Scenes.keyCloseup },
  { t0: 29.0, t1: 32.0, draw: Scenes.ballCloseup },
  { t0: 32.0, t1: 37.5, draw: (c, lt, t) => courtyard(c, t, { mode: 'golden', dusk: 0.35 + Ease.inOutSine(clamp(lt / 5.5)) * 0.6, lamps: clamp((lt - 3.0) / 1.3), cam: camPath([{ t: 0, zoom: 1.08, fx: 1000, fy: 560 }, { t: 5.5, zoom: 1.16, fx: 1060, fy: 600 }], lt) }) },
  { t0: 37.5, t1: 39.8, draw: Scenes.balcony },
  { t0: 42.0, t1: 48.4, draw: Scenes.tv },
  { t0: 48.0, t1: 60.2, draw: Scenes.village, xin: 0.9 },
  { t0: 60.2, t1: 66.0, draw: Scenes.dialup },
  { t0: 66.0, t1: 75.0, draw: Scenes.messenger },
  { t0: 75.0, t1: 84.0, draw: Scenes.phone },
  { t0: 84.0, t1: 90.3, draw: Scenes.earbuds },
  { t0: 90.0, t1: 102.0, draw: Scenes.filters, xin: 0.3 },
  { t0: 102.0, t1: 108.0, draw: Scenes.question },
  { t0: 108.0, t1: 120.3, draw: Scenes.realityMemory, xin: 0.6 },
  { t0: 120.0, t1: 126.3, draw: Scenes.timelapse, xin: 0.3 },
  { t0: 126.0, t1: 138.5, draw: Scenes.shadow, xin: 0.6 },
  { t0: 138.0, t1: 147.5, draw: Scenes.window, xin: 1.0 },
  { t0: 147.0, t1: 156.1, draw: Scenes.projector, xin: 0.8 },
  { t0: 156.0, t1: 162.2, draw: Scenes.tapeEnd },
  { t0: 162.0, t1: 168.0, draw: Scenes.today, xin: 0.6 },
  { t0: 168.0, t1: 174.6, draw: Scenes.rec },
  { t0: 174.0, t1: 182.0, draw: Scenes.endCard, xin: 1.2 },
  { t0: 39.8, t1: 42.0, draw: (c, lt, t) => courtyard(c, t, { mode: 'golden', dusk: 0.97, lamps: 1, kidsStill: true, cam: camPath([{ t: 0, zoom: 2.6, fx: 1130, fy: 730 }, { t: 2.2, zoom: 2.7, fx: 1130, fy: 730 }], lt) }) },
];
const CAPTIONS = [
  { t0: 2.4, t1: 6.6, text: 'Do you remember?', style: 'bigItalic', y: 975, fadeIn: 1.4, stagger: 0.18 },
  { t0: 10.2, t1: 19.6, text: 'AFTERGLOW', style: 'title', y: 610, fadeIn: 2.6, stagger: 0.0, blurIn: 18, rise: 0, fadeOut: 1.6 },
  { t0: 11.6, t1: 19.6, text: 'a letter to the ’90s, the 2000s and the 2010s', style: 'subtitle', y: 712, fadeIn: 1.6, stagger: 0.07, fadeOut: 1.4 },
  { t0: 21.8, t1: 25.8, text: 'Summers lasted forever.', style: 'main' },
  { t0: 26.4, t1: 28.8, text: 'Key around your neck.', style: 'main' },
  { t0: 29.4, t1: 31.8, text: 'Ball at your feet.', style: 'main', y: 950 },
  { t0: 32.4, t1: 34.8, text: 'The whole street was yours…', style: 'main' },
  { t0: 35.3, t1: 37.4, text: '…until the streetlights came on.', style: 'main' },
  { t0: 37.7, t1: 39.7, text: '“Come inside, it’s getting dark!”', style: 'quote', y: 930 },
  { t0: 40.0, t1: 41.9, text: '“Five more minutes!”', style: 'quote' },
  { t0: 42.6, t1: 45.0, text: 'We blew into cartridges.', style: 'main' },
  { t0: 45.2, t1: 47.8, text: 'It never helped.', style: 'main' },
  { t0: 48.8, t1: 52.2, text: 'Summers at our grandparents’.', style: 'main' },
  { t0: 52.6, t1: 56.0, text: 'Cut grass. Warm bread. Rain on hot dust.', style: 'main' },
  { t0: 56.3, t1: 59.6, text: 'One smell, and you’re there again.', style: 'mainItalic' },
  { t0: 61.0, t1: 65.4, text: 'Then, we heard the internet.', style: 'main', y: 1000 },
  { t0: 66.6, t1: 69.8, text: 'We waited for them to come online.', style: 'main', x: 760, y: 1010 },
  { t0: 75.5, t1: 79.0, text: 'T9. 160 characters.\nWe made every one count.', style: 'main', x: 540, y: 470 },
  { t0: 79.6, t1: 83.6, text: 'A missed call meant\n“I’m thinking of you.”', style: 'main', x: 540, y: 470 },
  { t0: 84.6, t1: 89.4, text: 'One earbud for you, one for me.', style: 'main', y: 960 },
  { t0: 91.0, t1: 95.0, text: 'We put vintage filters\non the present…', style: 'main', x: 380, y: 470 },
  { t0: 95.6, t1: 101.2, text: '…as if we already knew\nwe’d miss it.', style: 'main', x: 1540, y: 470 },
  { t0: 103.0, t1: 107.4, text: 'So why do memories glow like this?', style: 'big', y: 560, fadeIn: 1.4, stagger: 0.12 },
  { t0: 108.6, t1: 110.8, text: 'HOW IT WAS', style: 'label', y: 190, fadeIn: 0.6 },
  { t0: 111.4, t1: 114.6, text: 'HOW WE REMEMBER IT', style: 'label', y: 190, fadeIn: 0.6 },
  { t0: 114.8, t1: 117.4, text: 'Memory isn’t an archive. It’s a painter.', style: 'main' },
  { t0: 117.6, t1: 120.0, text: 'It keeps the light, and forgets the rain.', style: 'main' },
  { t0: 120.4, t1: 123.0, text: 'Back then, everything happened for the first time.', style: 'main', y: 985 },
  { t0: 123.2, t1: 125.9, text: 'So one summer could hold a lifetime.', style: 'main', y: 985 },
  { t0: 126.6, t1: 129.4, text: 'We don’t miss the ’90s.', style: 'main', y: 1000 },
  { t0: 129.6, t1: 132.8, text: 'We miss who we were in them.', style: 'mainItalic', y: 1000 },
  { t0: 133.0, t1: 135.6, text: 'Time that was patient with us.', style: 'main', y: 1000 },
  { t0: 135.8, t1: 138.0, text: 'A future still unwritten.', style: 'main', y: 1000 },
  { t0: 139.0, t1: 146.2, text: 'And the people who were still here.', style: 'bigItalic', y: 980, fadeIn: 1.8, stagger: 0.16, fadeOut: 1.6 },
  { t0: 147.8, t1: 151.6, text: 'Maybe that glow was partly imagined.', style: 'main', y: 900 },
  { t0: 152.0, t1: 155.6, text: 'But what we felt was real.', style: 'mainItalic', y: 900 },
  { t0: 157.8, t1: 161.5, text: 'We can’t rewind.', style: 'big', y: 250, fadeIn: 1.2 },
  { t0: 162.6, t1: 167.6, text: 'But one day, today will glow like this too.', style: 'main' },
  { t0: 168.8, t1: 172.6, text: 'So press record.', style: 'big', y: 940, fadeIn: 1.0 },
  { t0: 174.8, t1: 180.6, text: 'AFTERGLOW', style: 'title', y: 590, fadeIn: 2.4, stagger: 0.0, blurIn: 18, rise: 0, fadeOut: 1.6 },
];
const OVERLAYS = [
  { t0: 21.0, t1: 42.0, draw: (ctx, lt, t) => drawDateStamp(ctx, "'97 7 14", env(t, 21.0, 42.0, 1.4, 0.3)) },
  { t0: 42.4, t1: 48.0, draw: (ctx, lt, t) => drawDateStamp(ctx, "'98 12 25", env(t, 42.4, 48.0, 0.4, 0.3)) },
  { t0: 48.6, t1: 60.0, draw: (ctx, lt, t) => drawDateStamp(ctx, "'99 8 3", env(t, 48.6, 60.0, 0.8, 0.6)) },
  { t0: 169.5, t1: 175.5, draw: (ctx, lt, t) => Props.recOSD(ctx, t, 168.0, env(t, 169.5, 175.5, 0.05, 0.8)) },
];
const LOOK_DESK = { warmth: 0.2, bloom: 0.5, bloomThreshold: 0.55, haze: 0.08, halation: 0.3, grain: 0.05, vignette: 0.7, fade: 0.04, dust: 0.3 };
const LOOK_TITLE = { warmth: 0.3, bloom: 0.7, bloomThreshold: 0.55, haze: 0.22, halation: 0.4, grain: 0.055, vignette: 0.6, leak: 0.25, leakSeed: 2, dust: 0.6, weave: 0.8 };
const LOOK90 = { warmth: 0.25, sat: 1.05, bloom: 0.7, haze: 0.14, halation: 0.35, grain: 0.06, dust: 0.8, leak: 0.12, vignette: 0.5, fade: 0.05, weave: 0.7 };
const LOOK90N = Object.assign({}, LOOK90, { warmth: 0.12, bloom: 0.8, haze: 0.12, leak: 0.05 });
const LOOK_TV = Object.assign({}, LOOK90, { warmth: -0.05, bloom: 0.9, bloomThreshold: 0.5, haze: 0.16, leak: 0.0, vignette: 0.6 });
const LOOK_CRT = { warmth: -0.1, sat: 1.0, bloom: 0.8, bloomThreshold: 0.55, haze: 0.1, halation: 0.15, grain: 0.05, vignette: 0.65, crt: 0.2, vhs: 0.25, ca: 0.9, weave: 0.2 };
const LOOK_00 = { warmth: -0.06, sat: 1.08, contrast: 1.08, bloom: 0.55, bloomThreshold: 0.65, haze: 0.08, halation: 0.12, grain: 0.035, vignette: 0.45, crt: 0.12, ca: 0.6, weave: 0.1 };
const LOOK_NIGHT = { warmth: 0.08, sat: 1.0, bloom: 0.9, bloomThreshold: 0.5, haze: 0.18, halation: 0.35, grain: 0.05, vignette: 0.6, weave: 0.3 };
const LOOK_10 = { warmth: 0.18, sat: 1.0, contrast: 0.96, fade: 0.1, bloom: 0.7, bloomThreshold: 0.55, haze: 0.18, halation: 0.25, grain: 0.04, vignette: 0.45, leak: 0.25, leakSeed: 5, weave: 0.2 };
const LOOK_DARK = { warmth: 0.15, bloom: 0.8, bloomThreshold: 0.45, haze: 0.15, halation: 0.3, grain: 0.05, vignette: 0.7, weave: 0.3, dust: 0.4 };
const LOOK_REAL = { warmth: -0.15, sat: 0.55, contrast: 0.95, bloom: 0.15, bloomThreshold: 0.8, haze: 0.02, halation: 0.0, grain: 0.04, vignette: 0.35, fade: 0.06, weave: 0.1, flicker: 0.0 };
const LOOK_MEM = { warmth: 0.32, sat: 1.1, bloom: 0.95, bloomThreshold: 0.5, haze: 0.3, halation: 0.42, grain: 0.06, vignette: 0.5, leak: 0.25, leakSeed: 7, dust: 0.8, weave: 0.8, fade: 0.05 };
const LOOK_LAPSE = { warmth: 0.2, sat: 1.05, bloom: 0.6, bloomThreshold: 0.62, haze: 0.14, halation: 0.3, grain: 0.055, vignette: 0.55, leak: 0.12, leakSeed: 3, dust: 0.6, weave: 0.6 };
const LOOK_SHADOW = { warmth: 0.2, sat: 1.0, bloom: 0.8, bloomThreshold: 0.5, haze: 0.14, halation: 0.35, grain: 0.055, vignette: 0.6, weave: 0.4, dust: 0.3 };
const LOOK_PROJ = { warmth: 0.18, sat: 0.95, bloom: 0.9, bloomThreshold: 0.45, haze: 0.2, halation: 0.4, grain: 0.07, vignette: 0.7, flicker: 0.045, dust: 1.2, weave: 1.0 };
const LOOK_NOW = { warmth: 0.0, sat: 1.0, contrast: 1.04, bloom: 0.3, bloomThreshold: 0.75, haze: 0.04, halation: 0.05, grain: 0.012, vignette: 0.2, weave: 0.0, fade: 0.0, flicker: 0.0, ca: 0.2 };
const LOOK_VILLAGE = Object.assign({}, LOOK90, { warmth: 0.05, sat: 1.0, bloom: 0.95, bloomThreshold: 0.45, haze: 0.12, leak: 0.0, vignette: 0.55, dust: 0.5 });
const LOOKS = [ { t: 0, look: LOOK_DESK }, { t: 8.8, look: LOOK_DESK }, { t: 9.6, look: LOOK_TITLE }, { t: 20.4, look: LOOK_TITLE }, { t: 22, look: LOOK90 }, { t: 33, look: LOOK90 }, { t: 37, look: LOOK90N }, { t: 41.9, look: LOOK90N },
  { t: 42.0, look: LOOK_TV }, { t: 48.0, look: LOOK_TV }, { t: 48.9, look: LOOK_VILLAGE }, { t: 60.1, look: LOOK_VILLAGE },
  { t: 60.2, look: LOOK_CRT }, { t: 65.9, look: LOOK_CRT }, { t: 66.0, look: LOOK_00 }, { t: 83.9, look: LOOK_00 },
  { t: 84.0, look: LOOK_NIGHT }, { t: 89.8, look: LOOK_NIGHT }, { t: 90.4, look: LOOK_10 }, { t: 101.9, look: LOOK_10 },
  { t: 102.0, look: LOOK_DARK }, { t: 108.0, look: LOOK_DARK }, { t: 108.2, look: LOOK_REAL }, { t: 110.8, look: LOOK_REAL }, { t: 111.9, look: LOOK_MEM }, { t: 119.8, look: LOOK_MEM }, { t: 120.3, look: LOOK_LAPSE }, { t: 126, look: LOOK_LAPSE },
  { t: 126.6, look: LOOK_SHADOW }, { t: 138, look: LOOK_SHADOW }, { t: 139, look: LOOK_VILLAGE }, { t: 147, look: LOOK_VILLAGE },
  { t: 147.6, look: LOOK_PROJ }, { t: 156, look: LOOK_PROJ }, { t: 156.2, look: LOOK_DESK }, { t: 162, look: LOOK_DESK },
  { t: 162.3, look: LOOK_NOW }, { t: 168, look: LOOK_MEM }, { t: 169.4, look: LOOK_DESK }, { t: 169.5, look: LOOK_MEM }, { t: 174.5, look: LOOK_MEM }, { t: 176, look: LOOK_TITLE }, { t: 182, look: LOOK_TITLE } ];
const FADES = [
  { kind: 'white', t0: 8.45, t1: 10.4, fi: 0.85, fo: 1.0, amount: 0.95 },
  { kind: 'black', t0: 59.4, t1: 60.9, fi: 0.8, fo: 0.6, amount: 1 },
  { kind: 'white', t0: 110.6, t1: 112.6, fi: 0.5, fo: 1.3, amount: 0.35 },
  { kind: 'black', t0: 179.0, t1: 190.0, fi: 3.0, fo: 0.0, amount: 1 },
];
