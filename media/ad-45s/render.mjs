// node render.mjs out.mp4 start end fps [sub]   |  node render.mjs --stills dir t1 t2 ...
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const PORT = process.env.PORT || 8765;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
await page.goto(`http://127.0.0.1:${PORT}/film.html`);
await page.waitForFunction(() => window.READY === true, null, { timeout: 60000 });
if (args[0] === '--stills') {
  const dir = args[1]; await mkdir(dir, { recursive: true });
  for (const t of args.slice(2).map(Number)) {
    await page.evaluate((x) => window.renderFrame(x), t);
    await page.screenshot({ path: `${dir}/s-${t.toFixed(2)}.png` });
  }
} else {
  const [out, s0 = 0, s1 = 45, fps = 60, sub = 1] = [args[0], ...args.slice(1).map(Number)];
  const frames = Math.round((s1 - s0) * fps);
  // with sub>1 we render sub-frames inside a 180-degree shutter and let ffmpeg average them
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps * sub), '-c:v', 'mjpeg', '-i', '-',
    ...(sub > 1 ? ['-vf', `tmix=frames=${sub}:weights=${Array(sub).fill(1).join(' ')},select='not(mod(n\\,${sub}))',setpts=N/${fps}/TB`] : []),
    '-r', String(fps), '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const t0 = Date.now();
  for (let f = 0; f < frames; f++) {
    for (let k = 0; k < sub; k++) {
      const t = s0 + (f + (k / sub) * 0.5) / fps;
      await page.evaluate((x) => window.renderFrame(x), t);
      const buf = await page.screenshot({ type: 'jpeg', quality: 96 });
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    }
    if (f % (fps * 2) === 0) console.log(`frame ${f}/${frames} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
  }
  ff.stdin.end();
  await new Promise((r, j) => ff.on('close', (c) => (c === 0 ? r() : j(new Error('ffmpeg ' + c)))));
  console.log('wrote', out, ((Date.now() - t0) / 1000).toFixed(0) + 's');
}
await browser.close();
