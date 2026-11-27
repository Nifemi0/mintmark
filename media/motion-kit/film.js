// Starter film. Copy this folder, then replace the scenes below.
// Every time is in beats: b(4) = 4 beats. Tempo is set in film.html.
import { SFX, W, H, b, C, cl, seg, lerp, E, settle, text, rise, fall, morph, roll, rosette, paint, loopPts, linePts, img, rr, layout } from './core.js';
import * as G from './gl3d.js';

const c0 = document.getElementById('c0').getContext('2d'); // under the 3D layer
const c1 = document.getElementById('c1').getContext('2d'); // over the 3D layer
export const DURATION = b(24);

// images: put duotone PNGs in assets/ (see prep-duotone.py) and list them here
const names = [];
export const IM = {};
await Promise.all(names.map((n) => new Promise((res, rej) => { const i = new Image(); i.onload = () => { IM[n] = i; res(); }; i.onerror = rej; i.src = `assets/${n}.png`; })));
await document.fonts.ready;
for (const f of ["700 40px 'Space Grotesk'", "500 40px 'DM Mono'", "500 40px 'DM Sans'"]) await document.fonts.load(f);

function clear(ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'; ctx.clearRect(0, 0, W, H); }

function scenes(t) {
  // 0-4 beats: an engraved rosette draws itself, a year slams in on a lime disc
  if (t < b(4.5)) {
    const out = E.inExpo(seg(t, b(3.5), b(4.4)));
    rosette(c1, 960, 540, lerp(330, 1400, out), { n: 10, A: 0.11, Bm: 0.04, m: 3, L: 26, prog: E.outExpo(seg(t, 0, b(1.8))), rot: t * 0.12, col: C.ink, lw: 1.3, alpha: 1 - out });
    const disc = 250 * settle(seg(t, b(2), b(2.9))) * (1 - out);
    if (disc > 0) { c0.fillStyle = C.lime; c0.beginPath(); c0.arc(960, 540, disc, 0, 7); c0.fill(); }
    if (t >= b(2) && out < 0.5) rise(c1, '2026', 960, 650, seg(t, b(2), b(2.7)), { size: 320, ls: -0.05 }, 0.05, 0.42);
  }
  // 4-12 beats: headline types in, morphs, a marker highlight paints on
  if (t >= b(4) && t < b(12.2)) {
    const hs = { size: 150, ls: -0.05 };
    if (t < b(8)) rise(c1, 'One idea.', 960, 600, seg(t, b(4.5), b(5.2)), hs, 0.03, 0.4);
    else if (t < b(11.5)) {
      const L = layout(c1, 'Told in motion.', hs);
      paint(c1, linePts(960 - L.width / 2 - 30, 555, 960 + L.width / 2 + 30, 550, 2), E.outCubic(seg(t, b(9), b(9.6))), { col: C.lime, w: 150, seed: 7 });
      morph(c1, 'One idea.', 'Told in motion.', seg(t, b(8), b(8.7)), 960, 600, hs);
    } else fall(c1, 'Told in motion.', 960, 600, seg(t, b(11.5), b(12)), hs);
  }
  // 12-18 beats: an odometer counter with a hand-drawn loop
  if (t >= b(12) && t < b(18.2)) {
    roll(c1, '0,000', '1,937', seg(t, b(12.5), b(14)), 960, 620, { size: 300, ls: -0.05 }, 1);
    paint(c1, loopPts(960, 520, 420, 170, 5), E.outCubic(seg(t, b(14.5), b(15.3))), { col: C.green, w: 12, seed: 3 });
    if (t >= b(17.5)) { c1.fillStyle = C.paper; c1.fillRect(0, 0, W, H * E.inOutExpo(seg(t, b(17.5), b(18)))); }
  }
  // 18-24 beats: end card (replace with the brand's logo lockup)
  if (t >= b(18)) {
    rosette(c0, 960, 540, 760, { n: 18, A: 0.05, Bm: 0.02, m: 7, L: 10, prog: E.outExpo(seg(t, b(18), b(20))), rot: t * 0.06, col: C.green, lw: 1.2, alpha: 0.38 });
    rise(c1, 'brand', 960, 600, seg(t, b(18.5), b(19.3)), { size: 200, ls: -0.0565 }, 0.04, 0.42);
    rise(c1, 'yourdomain.com', 960, 720, seg(t, b(19.5), b(20.2)), { size: 40, w: 500, f: 'm', ls: 0, col: C.green }, 0.015, 0.35);
  }
}

window.FILM_DURATION = DURATION;
window.renderFrame = (t) => {
  SFX.t = t;
  clear(c0); clear(c1);
  c0.fillStyle = C.paper; c0.fillRect(0, 0, W, H);
  for (const m of G.scene.children) if (m.isMesh || m.isGroup) m.visible = false;
  G.camera.position.set(0, 0, 10); G.camera.lookAt(0, 0, 0);
  scenes(t);
  if (!window.SCAN) G.render();
};
window.scanCues = (dt = 1 / 240) => {
  window.SCAN = true; SFX.on = true; SFX.seen.clear(); SFX.log.length = 0;
  for (let t = 0; t < DURATION; t += dt) window.renderFrame(t);
  window.SCAN = false; SFX.on = false;
  return SFX.log;
};
window.READY = true;
