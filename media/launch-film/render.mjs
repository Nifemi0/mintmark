// Renders film.html frame by frame and encodes with ffmpeg.
// Usage: node render.mjs <out.mp4> [startSeconds] [endSeconds] [fps]
//        node render.mjs --stills <dir> t1 t2 ...   (PNG stills for review)
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(pathToFileURL(path.join(here, 'film.html')).href);
await page.evaluate(() => document.fonts.ready);
const duration = await page.evaluate(() => window.FILM_DURATION);

if (args[0] === '--stills') {
  const dir = args[1];
  await mkdir(dir, { recursive: true });
  for (const t of args.slice(2).map(Number)) {
    await page.evaluate((x) => window.renderFrame(x), t);
    await page.screenshot({ path: path.join(dir, `still-${String(t).replace('.', '_')}.png`) });
  }
  console.log(`stills written to ${dir}`);
} else {
  const out = args[0];
  const start = Number(args[1] ?? 0), end = Number(args[2] ?? duration), fps = Number(args[3] ?? 30);
  const frames = Math.round((end - start) * fps);
  const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const started = Date.now();
  for (let f = 0; f < frames; f++) {
    await page.evaluate((x) => window.renderFrame(x), start + f / fps);
    const png = await page.screenshot({ type: 'png' });
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r));
    if (f % (fps * 5) === 0) console.log(`frame ${f}/${frames} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
  }
  ff.stdin.end();
  await new Promise((r, j) => ff.on('close', (code) => (code === 0 ? r() : j(new Error(`ffmpeg exited ${code}`)))));
  console.log(`wrote ${out}: ${frames} frames in ${((Date.now() - started) / 1000).toFixed(0)}s`);
}
await browser.close();
