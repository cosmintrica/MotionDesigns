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
const r = await page.evaluate(() => {
  const px = new Uint8Array(W * H * 4);
  Main.renderFrame(70 * 24); Post.read(px);
  Post.prof.on = true; Post.prof.t = {};
  const N = 5;
  let rd = 0;
  for (let i = 0; i < N; i++) { Main.renderFrame(70 * 24 + i); const a = performance.now(); Post.read(px); rd += performance.now() - a; }
  const o = {}; for (const k in Post.prof.t) o[k] = (Post.prof.t[k] / N).toFixed(1); o.read = (rd / N).toFixed(1);
  return o;
});
console.log(r);
await browser.close(); srv.close();
