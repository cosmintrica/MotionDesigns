import { createRequire } from 'node:module';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const require = createRequire(import.meta.url);
let chromium; try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }
const WEB = path.resolve('web');
const srv = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p === '/') p = '/index.html'; const f = path.join(WEB, p); if (!fs.existsSync(f)) { r.writeHead(404); r.end(); return; } r.end(fs.readFileSync(f)); });
await new Promise((r) => srv.listen(0, r));
const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-compositing'] });
const page = await browser.newPage();
await page.goto(`http://127.0.0.1:${srv.address().port}/index.html`);
await page.waitForFunction(() => window.READY || window.INIT_ERROR);
const r = await page.evaluate(() => {
  const [c, x] = makeCanvas(W, H); x.fillStyle = '#884422'; x.fillRect(0, 0, W, H);
  const base = Object.assign({}, LOOK_DEFAULTS, { leak: 0.2, dust: 0.8, ca: 0.6 });
  const variants = { all: {}, noLeak: { leak: 0 }, noDust: { dust: 0 }, noCA: { ca: 0 }, bare: { leak: 0, dust: 0, ca: 0, vhs: 0, crt: 0 } };
  const out = {};
  for (const [k, v] of Object.entries(variants)) {
    const L = Object.assign({}, base, v);
    Post.render(c, L, 1, 1); Post.prof.on = true; Post.prof.t = {};
    for (let i = 0; i < 4; i++) Post.render(c, L, 1 + i / 24, 1 + i);
    Post.prof.on = false;
    out[k] = (Post.prof.t.composite / 4).toFixed(1);
  }
  return out;
});
console.log(r);
await browser.close(); srv.close();
