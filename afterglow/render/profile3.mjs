import { createRequire } from 'node:module';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const WEB = path.resolve('web');
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p === '/') p = '/index.html'; const f = path.join(WEB, p); if (!fs.existsSync(f)) { r.writeHead(404); r.end(); return; } r.end(fs.readFileSync(f)); });
await new Promise((r) => srv.listen(0, r));
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-compositing'] });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${srv.address().port}/index.html?nofloat=1`);
await page.waitForFunction(() => window.READY || window.INIT_ERROR);
for (const tt of process.argv[2].split(',').map(Number)) {
  const r = await page.evaluate((tt) => {
    const acc = {};
    const flush = (c) => { if (c && c.getImageData) c.getImageData(0, 0, 1, 1); };
    const wrap = (obj, name, label) => { const f = obj[name]; obj[name] = function (...a) { flush(a[0]); const t0 = performance.now(); const r = f.apply(this, a); flush(a[0]); acc[label] = (acc[label] || 0) + performance.now() - t0; return r; }; return () => (obj[name] = f); };
    const undo = [];
    for (const k of Object.keys(Env)) undo.push(wrap(Env, k, 'Env.' + k));
    undo.push(wrap(Fig, 'draw', 'Fig.draw'));
    undo.push(wrap(window, 'drawDateStamp', 'dateStamp'));
    undo.push(wrap(window, 'drawGlow', 'drawGlow'));
    undo.push(wrap(Captions, 'draw', 'Captions'));
    for (const k of Object.keys(Props)) if (typeof Props[k] === 'function') undo.push(wrap(Props, k, 'Props.' + k));
    const px = new Uint8Array(W * H * 4);
    const f = Math.round(tt * FPS);
    Main.renderFrame(f); Post.read(px);
    for (const k in acc) delete acc[k];
    const N = 3; const t0 = performance.now();
    for (let i = 0; i < N; i++) Main.renderFrame(f + i);
    const total = (performance.now() - t0) / N;
    undo.forEach((u) => u());
    const o = { total: total.toFixed(0) };
    Object.entries(acc).sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([k, v]) => (o[k] = (v / N).toFixed(1)));
    return o;
  }, tt);
  console.log(tt, JSON.stringify(r));
}
await browser.close(); srv.close();
