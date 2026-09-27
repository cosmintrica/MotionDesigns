// Profile per-stage render cost at given times: node render/profile.mjs 23,50,70
import { createRequire } from 'node:module';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const WEB = path.resolve('web');
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p === '/') p = '/index.html'; const f = path.join(WEB, p); if (!fs.existsSync(f)) { r.writeHead(404); r.end(); return; } r.end(fs.readFileSync(f)); });
await new Promise((r) => srv.listen(0, r));
const extra = (process.env.FLAGS || '').split(' ').filter(Boolean);
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-compositing', ...extra] });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${srv.address().port}/index.html${process.env.QS || ''}`);
await page.waitForFunction(() => window.READY || window.INIT_ERROR);
const times = process.argv[2].split(',').map(Number);
const res = await page.evaluate(async (times) => {
  const out = [];
  const px = new Uint8Array(W * H * 4);
  for (const tt of times) {
    const f = Math.round(tt * FPS);
    Main.renderFrame(f); Post.read(px); // warm
    const N = 4; let a = 0, b = 0, c = 0, d = 0;
    for (let i = 0; i < N; i++) {
      const t = (f + i) / FPS;
      let t0 = performance.now();
      // replicate Main.renderFrame stages
      const [sc, sx] = [document.createElement('canvas'), null];
      t0 = performance.now();
      Main.renderFrame(f + i);
      const t1 = performance.now();
      Post.read(px);
      const t2 = performance.now();
      a += t1 - t0; b += t2 - t1;
    }
    out.push({ t: tt, renderPlusPostSubmit: (a / N).toFixed(1), readback: (b / N).toFixed(1) });
  }
  return out;
}, times);
console.table(res);
await browser.close(); srv.close();
