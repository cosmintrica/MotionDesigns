'use strict';
// ---------------------------------------------------------------------------
// Frame orchestrator: draws the active scenes (with cross-dissolves), the
// captions and overlays into a 2D canvas, then hands it to the post chain.
// SCENES, CAPTIONS, OVERLAYS and LOOKS come from timeline.js.
// ---------------------------------------------------------------------------

const Main = (() => {
  const [scene, sctx] = makeCanvas(W, H);
  const [tmp, tctx] = makeCanvas(W, H);
  let out, pixels;

  function resetCtx(x) {
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalAlpha = 1;
    x.globalCompositeOperation = 'source-over';
    x.filter = 'none';
    x.imageSmoothingEnabled = true;
    x.lineCap = 'butt'; x.lineJoin = 'miter';
  }

  function lookAt(t) {
    const K = LOOKS;
    let i = 0;
    while (i < K.length - 1 && K[i + 1].t <= t) i++;
    const a = K[i], b = K[Math.min(i + 1, K.length - 1)];
    const k = b.t > a.t ? Ease.inOutSine(clamp((t - a.t) / (b.t - a.t))) : 0;
    const la = a.look, lb = b.look, r = {};
    for (const key in LOOK_DEFAULTS) {
      const va = la[key] ?? LOOK_DEFAULTS[key], vb = lb[key] ?? LOOK_DEFAULTS[key];
      if (Array.isArray(va)) r[key] = va.map((v, j) => lerp(v, vb[j], k));
      else r[key] = lerp(va, vb, k);
    }
    // global fades (to black / white) layered on top
    for (const f of FADES) {
      const e = env(t, f.t0, f.t1, f.fi, f.fo);
      if (e > 0) r[f.kind] = Math.max(r[f.kind], e * (f.amount ?? 1));
    }
    return r;
  }

  function drawScenes(t) {
    for (const s of SCENES) {
      if (t < s.t0 || t >= s.t1) continue;
      const lt = t - s.t0;
      const a = s.xin ? Ease.inOutSine(clamp(lt / s.xin)) : 1;
      if (a >= 0.999) {
        sctx.save(); s.draw(sctx, lt, t, s); sctx.restore(); resetCtx(sctx);
      } else if (a > 0.001) {
        resetCtx(tctx); tctx.clearRect(0, 0, W, H);
        tctx.save(); s.draw(tctx, lt, t, s); tctx.restore(); resetCtx(tctx);
        sctx.globalAlpha = a; sctx.drawImage(tmp, 0, 0); sctx.globalAlpha = 1;
      }
    }
  }

  function renderFrame(frame) {
    const t = frame / FPS;
    resetCtx(sctx);
    sctx.fillStyle = '#000'; sctx.fillRect(0, 0, W, H);
    drawScenes(t);
    resetCtx(sctx);
    for (const c of CAPTIONS) if (t >= c.t0 && t < c.t1) Captions.draw(sctx, c, t);
    resetCtx(sctx);
    for (const o of OVERLAYS) if (t >= o.t0 && t < o.t1) { sctx.save(); o.draw(sctx, t - o.t0, t, o); sctx.restore(); resetCtx(sctx); }
    Post.render(scene, lookAt(t), t, frame);
  }

  async function init() {
    out = document.getElementById('out');
    Post.init(out);
    pixels = new Uint8Array(W * H * 4);
    const fams = ['300 20px "Cormorant Garamond"', '400 20px "Cormorant Garamond"', '500 20px "Cormorant Garamond"',
      'italic 400 20px "Cormorant Garamond"', 'italic 500 20px "Cormorant Garamond"', '600 20px "Cormorant Garamond"',
      '400 20px "VT323"', '400 20px "Press Start 2P"', '600 20px "Caveat"', '400 20px "Caveat"',
      '400 20px "IBM Plex Mono"', '500 20px "IBM Plex Mono"', '400 20px "Inter"', '500 20px "Inter"', '600 20px "Inter"', '300 20px "Inter"',
      '300 20px "Fraunces"', 'italic 300 20px "Fraunces"'];
    await Promise.all(fams.map((f) => document.fonts.load(f, 'AaȘșȚțĂăÎîÂâ')));
    await document.fonts.ready;
    if (typeof prepare === 'function') await prepare();
  }

  // render a range of frames and POST raw RGBA pixels to the local server
  async function runRange(a, b, job) {
    for (let f = a; f < b; f++) {
      renderFrame(f);
      Post.read(pixels);
      const r = await fetch(`/frame?job=${job}&f=${f}`, { method: 'POST', body: pixels });
      if (!r.ok) throw new Error('post failed ' + r.status);
    }
    return b - a;
  }

  async function runStills(list, job) {
    for (const f of list) {
      renderFrame(f);
      Post.read(pixels);
      const r = await fetch(`/still?job=${job}&f=${f}`, { method: 'POST', body: pixels });
      if (!r.ok) throw new Error('post failed ' + r.status);
    }
    return list.length;
  }

  return { init, renderFrame, runRange, runStills, lookAt };
})();

window.addEventListener('load', async () => {
  try { await Main.init(); window.READY = true; } catch (e) { window.INIT_ERROR = String(e && e.stack || e); }
});
