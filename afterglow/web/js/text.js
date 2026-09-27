'use strict';
// ---------------------------------------------------------------------------
// Captions: pre-rendered word sprites (sharp + blurred variants + soft shadow)
// animated per word: blur-to-focus, fade and a gentle rise, like a thought
// surfacing. Also a typewriter mode for the screen-era scenes.
// ---------------------------------------------------------------------------

const TEXT_STYLES = {
  main: { family: 'Cormorant Garamond', weight: 500, size: 68, color: '#fff4e4', tracking: 0.4, shadow: 0.62, lineHeight: 1.18 },
  mainItalic: { family: 'Cormorant Garamond', weight: 500, italic: true, size: 70, color: '#fff4e4', tracking: 0.2, shadow: 0.62, lineHeight: 1.18 },
  big: { family: 'Cormorant Garamond', weight: 500, size: 92, color: '#fff4e4', tracking: 0.6, shadow: 0.62, lineHeight: 1.12 },
  bigItalic: { family: 'Cormorant Garamond', weight: 500, italic: true, size: 96, color: '#fff4e4', tracking: 0.2, shadow: 0.62, lineHeight: 1.12 },
  quote: { family: 'Cormorant Garamond', weight: 500, italic: true, size: 64, color: '#fff1dc', tracking: 0.2, shadow: 0.7, lineHeight: 1.18 },
  label: { family: 'IBM Plex Mono', weight: 500, size: 34, color: '#fff3e2', tracking: 10, shadow: 0.8, lineHeight: 1.3 },
  title: { family: 'Cormorant Garamond', weight: 300, size: 176, color: '#fff6ea', tracking: 34, shadow: 0.35, lineHeight: 1.0 },
  subtitle: { family: 'Cormorant Garamond', weight: 500, italic: true, size: 50, color: '#fff0dc', tracking: 1.0, shadow: 0.85, lineHeight: 1.2 },
  hand: { family: 'Caveat', weight: 600, size: 72, color: '#fff2df', tracking: 0, shadow: 0.6, lineHeight: 1.1 },
  pixel: { family: 'VT323', weight: 400, size: 64, color: '#e9ffe6', tracking: 1, shadow: 0.5, lineHeight: 1.1 },
};

const Captions = (() => {
  const cache = new Map();
  const BLURS = [0, 3.5, 9, 18];

  function fontOf(st) { return `${st.italic ? 'italic ' : ''}${st.weight} ${st.size}px "${st.family}"`; }
  function setFont(x, st) {
    x.font = fontOf(st);
    x.letterSpacing = (st.tracking || 0) + 'px';
    x.textBaseline = 'alphabetic';
  }

  function wordSprite(word, st, pad, blur, color) {
    const [, mx] = makeCanvas(4, 4);
    setFont(mx, st);
    const m = mx.measureText(word);
    const w = Math.ceil(m.width + pad * 2), h = Math.ceil(st.size * 1.5 + pad * 2);
    const [c, x] = makeCanvas(w, h);
    setFont(x, st);
    x.fillStyle = color;
    if (blur > 0) x.filter = `blur(${blur}px)`;
    x.fillText(word, pad, pad + st.size * 1.05);
    return c;
  }

  function layout(text, styleName, overrides) {
    const key = text + '|' + styleName + '|' + JSON.stringify(overrides || {});
    if (cache.has(key)) return cache.get(key);
    const st = Object.assign({}, TEXT_STYLES[styleName], overrides || {});
    const [, mx] = makeCanvas(4, 4);
    setFont(mx, st);
    const spaceW = mx.measureText(' ').width + (st.tracking || 0);
    const lines = text.split('\n');
    const words = [];
    lines.forEach((line, li) => {
      let x = 0;
      const lw = [];
      for (const w of line.split(' ')) {
        if (!w) continue;
        const width = mx.measureText(w).width;
        lw.push({ w, x, width, line: li });
        x += width + spaceW;
      }
      const lineW = Math.max(0, x - spaceW);
      lw.forEach((o) => (o.lineW = lineW));
      words.push(...lw);
    });
    const pad = Math.ceil(st.size * 0.55);
    words.forEach((o, i) => {
      o.i = i;
      o.sprites = BLURS.map((b) => wordSprite(o.w, st, pad, b, st.color));
      o.shadow = wordSprite(o.w, st, pad, Math.max(6, st.size * 0.22), '#0b0604');
    });
    const L = { words, st, pad, lh: st.size * st.lineHeight, nLines: lines.length };
    cache.set(key, L);
    return L;
  }

  function spriteAt(o, blur) {
    // pick/blend blur levels
    blur = clamp(blur, 0, BLURS[BLURS.length - 1]);
    let i = 0;
    while (i < BLURS.length - 2 && blur > BLURS[i + 1]) i++;
    const k = (blur - BLURS[i]) / (BLURS[i + 1] - BLURS[i]);
    return [o.sprites[i], o.sprites[i + 1], clamp(k)];
  }

  // cap: {t0, t1, text, style, x, y, align, stagger, fadeIn, fadeOut, rise, blurIn, anim, alpha, overrides}
  function draw(ctx, cap, t) {
    const L = layout(cap.text, cap.style || 'main', cap.overrides);
    const st = L.st;
    const lt = t - cap.t0;
    const fi = cap.fadeIn ?? 1.1, fo = cap.fadeOut ?? 0.8;
    const stagger = cap.stagger ?? 0.09;
    const rise = cap.rise ?? 16;
    const blurIn = cap.blurIn ?? 10;
    const cx = cap.x ?? W / 2, y0 = cap.y ?? H * 0.8;
    const align = cap.align || 'center';
    const master = cap.alpha ?? 1;
    const outK = clamp((cap.t1 - t) / fo);
    const outE = Ease.inOutSine(outK);
    const totalLines = L.nLines;
    ctx.save();
    for (const o of L.words) {
      const delay = o.i * stagger + (cap.lineDelay ? o.line * cap.lineDelay : 0);
      const p = clamp((lt - delay) / fi);
      const pe = Ease.outCubic(p);
      const a = pe * outE * master;
      if (a <= 0.003) continue;
      const blur = (1 - Ease.outQuad(p)) * blurIn + (1 - outE) * 7;
      const dy = (1 - pe) * rise - (1 - outE) * 6;
      let lx;
      if (align === 'center') lx = cx - o.lineW / 2 + o.x;
      else if (align === 'right') lx = cx - o.lineW + o.x;
      else lx = cx + o.x;
      const ly = y0 + (o.line - (cap.vcenter ? (totalLines - 1) / 2 : 0)) * L.lh + dy;
      const sx = lx - L.pad, sy = ly - L.pad - st.size * 1.05;
      if (st.shadow > 0) {
        ctx.globalAlpha = a * st.shadow * (cap.shadow ?? 1);
        ctx.drawImage(o.shadow, sx, sy + st.size * 0.04);
      }
      const [s0, s1, k] = spriteAt(o, blur);
      ctx.globalAlpha = a * (1 - k);
      if (1 - k > 0.004) ctx.drawImage(s0, sx, sy);
      ctx.globalAlpha = a * k;
      if (k > 0.004) ctx.drawImage(s1, sx, sy);
    }
    ctx.restore();
  }

  // Typewriter text (monospace look). cps = chars per second.
  function type(ctx, text, x, y, t0, t, opts = {}) {
    const st = Object.assign({}, TEXT_STYLES[opts.style || 'pixel'], opts.overrides || {});
    const cps = opts.cps || 18;
    const n = Math.max(0, Math.floor((t - t0) * cps));
    const shown = text.slice(0, n);
    ctx.save();
    setFont(ctx, st);
    ctx.fillStyle = opts.color || st.color;
    ctx.globalAlpha = opts.alpha ?? 1;
    const lines = shown.split('\n');
    lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * st.size * st.lineHeight));
    if (opts.cursor !== false && t >= t0) {
      const blink = Math.floor(t * 2.2) % 2 === 0 || n < text.length;
      if (blink) {
        const last = lines[lines.length - 1];
        const w = ctx.measureText(last).width;
        ctx.fillRect(x + w + 4, y + (lines.length - 1) * st.size * st.lineHeight - st.size * 0.72, st.size * 0.42, st.size * 0.8);
      }
    }
    ctx.restore();
    return n >= text.length;
  }

  return { draw, type, layout, fontOf, setFont };
})();
