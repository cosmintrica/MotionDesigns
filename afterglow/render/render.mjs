// ---------------------------------------------------------------------------
// Deterministic frame renderer.
//   node render/render.mjs --stills 12.5,30,45.2 [--scale 0.5] [--tag name]
//   node render/render.mjs --video [--from 0] [--to 180] [--workers 3] [--chunk 120]
// Serves web/ on localhost, drives headless Chromium (SwiftShader WebGL2),
// receives raw RGBA frames over HTTP and pipes them into ffmpeg.
// ---------------------------------------------------------------------------
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node22/lib/node_modules/playwright')); }

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'web');
const OUT = path.join(ROOT, 'out');
const W = 1920, H = 1080, FPS = 24, FRAME_BYTES = W * H * 4;

const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const flag = (name) => args.includes('--' + name);

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.png': 'image/png', '.json': 'application/json' };
const jobs = new Map();   // job id -> { ff, resolveDone }
const stills = new Map(); // job id -> { dir, scale, tag }

function readBody(req) {
  return new Promise((res, rej) => {
    const chunks = []; let n = 0;
    req.on('data', (c) => { chunks.push(c); n += c.length; });
    req.on('end', () => res(Buffer.concat(chunks, n)));
    req.on('error', rej);
  });
}

function writePng(buf, file, scale) {
  return new Promise((res, rej) => {
    const vf = scale && scale !== 1 ? ['-vf', `scale=${Math.round(W * scale)}:${Math.round(H * scale)}:flags=lanczos`] : [];
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-i', '-', ...vf, '-frames:v', '1', file]);
    ff.on('exit', (c) => (c === 0 ? res() : rej(new Error('ffmpeg png ' + c))));
    ff.stdin.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'POST' && url.pathname === '/frame') {
    const body = await readBody(req);
    const job = jobs.get(url.searchParams.get('job'));
    if (!job || body.length !== FRAME_BYTES) { res.writeHead(400); res.end('bad'); return; }
    const ok = job.ff.stdin.write(body);
    if (ok) { res.end('ok'); } else { job.ff.stdin.once('drain', () => res.end('ok')); }
    return;
  }
  if (req.method === 'POST' && url.pathname === '/still') {
    const body = await readBody(req);
    const job = stills.get(url.searchParams.get('job'));
    const f = +url.searchParams.get('f');
    const name = `${job.tag}${(f / FPS).toFixed(2).padStart(7, '0')}.png`;
    await writePng(body, path.join(job.dir, name), job.scale);
    res.end('ok');
    return;
  }
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  const file = path.join(WEB, path.normalize(p));
  if (!file.startsWith(WEB) || !fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
});

async function launchPage(port, label) {
  const browser = await chromium.launch({
    args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-compositing',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'],
  });
  const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
  page.on('pageerror', (e) => console.error(`[${label}] pageerror`, e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.error(`[${label}] ${m.type()}: ${m.text()}`); });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => window.READY || window.INIT_ERROR, null, { timeout: 120000 });
  const err = await page.evaluate(() => window.INIT_ERROR);
  if (err) throw new Error(err);
  return { browser, page };
}

async function main() {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  const t0 = Date.now();

  if (opt('stills')) {
    const times = opt('stills').split(',').map(Number);
    const scale = +(opt('scale', '1'));
    const tag = opt('tag', 't');
    const dir = path.join(OUT, 'stills');
    fs.mkdirSync(dir, { recursive: true });
    const nW = Math.min(+(opt('workers', '2')), times.length);
    const lists = Array.from({ length: nW }, () => []);
    times.forEach((t, i) => lists[i % nW].push(Math.round(t * FPS)));
    await Promise.all(lists.map(async (list, i) => {
      const { browser, page } = await launchPage(port, 'w' + i);
      stills.set('s' + i, { dir, scale, tag });
      await page.evaluate(([l, j]) => Main.runStills(l, j), [list, 's' + i]);
      await browser.close();
    }));
    console.log(`stills done in ${((Date.now() - t0) / 1000).toFixed(1)}s -> ${dir}`);
    server.close();
    return;
  }

  if (flag('video')) {
    const from = +(opt('from', '0')), to = +(opt('to', '182'));
    const nW = +(opt('workers', '3'));
    const chunk = +(opt('chunk', '120'));
    const crf = opt('crf', '10');
    const segDir = path.join(OUT, opt('segdir', 'segments'));
    fs.mkdirSync(segDir, { recursive: true });
    const f0 = Math.round(from * FPS), f1 = Math.round(to * FPS);
    const queue = [];
    for (let a = f0; a < f1; a += chunk) queue.push([a, Math.min(f1, a + chunk)]);
    const total = f1 - f0;
    let done = 0;
    const segFiles = queue.map(([a]) => path.join(segDir, `seg_${String(a).padStart(6, '0')}.mkv`));
    const skipExisting = flag('resume');
    const chunkTimeoutMs = +(opt('chunk-timeout', '900')) * 1000;
    await Promise.all(Array.from({ length: nW }, async (_, wi) => {
      let ctx = await launchPage(port, 'w' + wi);
      while (queue.length) {
        const [a, b] = queue.shift();
        const file = path.join(segDir, `seg_${String(a).padStart(6, '0')}.mkv`);
        if (skipExisting && fs.existsSync(file) && fs.statSync(file).size > 1000) { done += b - a; continue; }
        for (let attempt = 1; ; attempt++) {
          const job = `j${a}_${attempt}`;
          const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
            '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', crf, '-threads', '2',
            '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv', file + '.tmp.mkv']);
          ff.stdin.on('error', () => {});
          const exited = new Promise((r) => ff.on('exit', r));
          jobs.set(job, { ff });
          const ts = Date.now();
          try {
            // a crashed/hung renderer (e.g. OOM-killed GPU process) must not stall the whole render
            await Promise.race([
              ctx.page.evaluate(([x, y, j]) => Main.runRange(x, y, j), [a, b, job]),
              new Promise((_, rej) => setTimeout(() => rej(new Error('chunk timeout')), chunkTimeoutMs)),
              new Promise((_, rej) => ctx.page.once('crash', () => rej(new Error('page crashed')))),
            ]);
            ff.stdin.end();
            const code = await exited;
            if (code !== 0) throw new Error('ffmpeg exit ' + code);
            fs.renameSync(file + '.tmp.mkv', file);
            jobs.delete(job);
            done += b - a;
            const el = (Date.now() - t0) / 1000;
            console.log(`[w${wi}] frames ${a}-${b} in ${((Date.now() - ts) / 1000).toFixed(1)}s | ${done}/${total} | elapsed ${el.toFixed(0)}s | eta ${(el / done * (total - done)).toFixed(0)}s`);
            break;
          } catch (e) {
            console.error(`[w${wi}] chunk ${a}-${b} attempt ${attempt} failed: ${e.message}; relaunching browser`);
            jobs.delete(job);
            try { ff.kill('SIGKILL'); } catch {}
            await exited.catch(() => {});
            try { fs.unlinkSync(file + '.tmp.mkv'); } catch {}
            try { await ctx.browser.close(); } catch {}
            if (attempt >= 3) throw e;
            ctx = await launchPage(port, 'w' + wi);
          }
        }
      }
      await ctx.browser.close();
    }));
    const list = path.join(segDir, 'list.txt');
    fs.writeFileSync(list, segFiles.map((f) => `file '${f}'`).join('\n'));
    console.log(`video frames done in ${((Date.now() - t0) / 1000).toFixed(1)}s; list at ${list}`);
    server.close();
    return;
  }
  console.log('nothing to do');
  server.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
