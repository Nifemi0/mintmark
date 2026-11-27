import { W, H, b, C, cl, seg, lerp, E, settle, rng, text, rise, fall, morph, roll, rosette, paint, loopPts, linePts, arrowPts, crossPts, img, rr, setFont, layout } from './core.js';
import * as G from './gl3d.js';
import { act2 } from './act2.js';
import { act3 } from './act3.js';

const c0 = document.getElementById('c0').getContext('2d');
const c1 = document.getElementById('c1').getContext('2d');
export const DURATION = 54;

/* ---------- assets ---------- */
const names = ['voc', 'voc_full', 'voc_date', 'voc_sig', 'voc_head', 'vocsep', 'edison', 'floor', 'street', 'atlas', 'nvda'];
export const IM = {};
await Promise.all(names.map((n) => new Promise((res, rej) => { const i = new Image(); i.onload = () => { IM[n] = i; res(); }; i.onerror = rej; i.src = `assets/${n}.png`; })));
await document.fonts.ready;
for (const f of ["700 40px 'Space Grotesk'", "500 40px 'DM Mono'", "400 40px 'DM Sans'", "500 40px 'DM Sans'", "600 40px 'Space Grotesk'"]) await document.fonts.load(f);

/* ---------- halftone source (exchange floor) ---------- */
const HT = (() => {
  const step = 12, cols = Math.ceil(W / step), rows = Math.ceil(H / step);
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const x = cv.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, W, H);
  img(x, IM.floor, W / 2, H / 2, W, H, { blend: 'source-over', zoom: 1.08, fy: 0.55 });
  const d = x.getImageData(0, 0, W, H).data;
  const dots = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const px = c * step + step / 2, py = r * step + step / 2;
    const i = (Math.min(H - 1, py | 0) * W + Math.min(W - 1, px | 0)) * 4;
    const dark = 1 - (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255;
    dots.push({ x: px, y: py, dark });
  }
  // target: the NVDAon contract address set in DM Mono
  const tv = document.createElement('canvas'); tv.width = W; tv.height = H;
  const y = tv.getContext('2d');
  y.fillStyle = '#000';
  y.font = "500 150px 'DM Mono'"; y.textAlign = 'center'; y.textBaseline = 'alphabetic';
  y.letterSpacing = '-6px';
  y.fillText('0xa9ee…6f75', W / 2, 600);
  const td = y.getImageData(0, 0, W, H).data, targets = [];
  const ts = 7;
  for (let yy = 0; yy < H; yy += ts) for (let xx = 0; xx < W; xx += ts) if (td[(yy * W + xx) * 4 + 3] > 128) targets.push({ x: xx, y: yy });
  // pick the darkest dots as travellers, sort both sides by x for a clean sweep
  const order = dots.map((d, i) => [d.dark + rng(i + 9)() * 0.25, i]).sort((a, z) => z[0] - a[0]);
  const trav = order.slice(0, targets.length).map((o) => o[1]);
  const set = new Set(trav);
  trav.sort((a, z) => dots[a].x - dots[z].x || dots[a].y - dots[z].y);
  targets.sort((a, z) => a.x - z.x || a.y - z.y);
  trav.forEach((di, k) => { dots[di].tx = targets[k].x; dots[di].ty = targets[k].y; });
  dots.forEach((d, i) => { d.trav = set.has(i); d.seed = rng(i * 7 + 3)(); });
  return { dots, step };
})();

/* ---------- 3D tape for act 1 ---------- */
const tape1 = G.tapeTexture([
  { t: 'WU 3/8' }, { t: 'NYC 1/4', c: C.green }, { t: 'ERIE 7/8' }, { t: 'GOLD 130 1/2', c: C.green }, { t: 'PAC 5/8' }, { t: 'RI 1/8', c: C.green },
  { t: 'MSP 3/4' }, { t: 'LS 1/2', c: C.green },
], { size: 60 });
const rib1 = new G.Ribbon({ width: 0.34, segs: 800, tex: tape1.tex, texLen: 0.34 * tape1.aspect });
rib1.mesh.visible = false;

/* ---------- small helpers ---------- */
function clear(ctx) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'; ctx.clearRect(0, 0, W, H); }
function bg(ctx, col) { ctx.fillStyle = col; ctx.fillRect(0, 0, W, H); }
function zoomAt(ctx, cx, cy, z) { ctx.translate(cx, cy); ctx.scale(z, z); ctx.translate(-cx, -cy); }
export const U = { c0, c1, bg, zoomAt, clear };

/* ================= ACT 1: paper (0 - 10s) ================= */
const DATE = [770, 915]; // the handwritten "6 Octob. 1606" in voc.png space
function vocCam(t) {
  // slow push, then punch toward the date on beat 5
  const push = lerp(1.03, 1.08, seg(t, b(4), b(7)));
  const punch = E.outExpo(seg(t, b(5), b(5.7)));
  const z = push * lerp(1, 1.42, punch);
  const fx = lerp(960, DATE[0], punch), fy = lerp(540, DATE[1], punch);
  return { z, fx, fy };
}
function drawVoc(ctx, t, clipR = null) {
  const cam = vocCam(t);
  ctx.save();
  if (clipR !== null) { ctx.beginPath(); ctx.arc(960, 540, clipR, 0, Math.PI * 2); ctx.clip(); }
  // map focal point to screen center
  ctx.translate(960, 540); ctx.scale(cam.z, cam.z); ctx.translate(-cam.fx, -cam.fy);
  const intro = clipR !== null ? lerp(1.35, 1, E.outCubic(seg(t, b(3), b(4)))) : 1;
  ctx.translate(960, 540); ctx.scale(intro, intro); ctx.translate(-960, -540);
  ctx.globalCompositeOperation = 'multiply';
  ctx.drawImage(IM.voc, 0, 0, W, H);
  ctx.restore();
  return cam;
}

function act1(t) {
  /* --- 0 to 2s: rosette, 1606, iris --- */
  if (t < b(4.2)) {
    bg(c0, C.paper);
    const iris = E.inOutExpo(seg(t, b(3), b(4)));
    const discR = 250 * settle(seg(t, b(2), b(2.9)));
    if (t >= b(2) && iris < 1) {
      c0.fillStyle = C.lime; c0.beginPath(); c0.arc(960, 540, Math.max(0, lerp(discR, 1200, iris)), 0, Math.PI * 2); c0.fill();
    }
    if (iris > 0) drawVoc(c0, t, lerp(discR, 1200, iris));
    // rosettes on top layer
    const out = E.inExpo(seg(t, b(3), b(3.9)));
    const R1 = lerp(330, 1400, out), al = 1 - out;
    rosette(c1, 960, 540, R1, { n: 10, A: 0.11, Bm: 0.04, m: 3, L: 26, prog: E.outExpo(seg(t, 0, b(1.8))), rot: lerp(-1.4, 0, E.outCubic(seg(t, 0, b(2.4)))) + t * 0.12, col: C.ink, lw: 1.3, alpha: al });
    rosette(c1, 960, 540, R1 * 0.6, { n: 15, A: 0.09, Bm: 0.03, m: 5, L: 16, prog: E.outExpo(seg(t, b(0.5), b(2))), rot: lerp(1.2, 0, E.outCubic(seg(t, b(0.5), b(2.6)))) - t * 0.2, col: C.green, lw: 1.2, alpha: al });
    rosette(c1, 960, 540, R1 * 1.16, { n: 24, A: 0.035, Bm: 0.0, m: 5, L: 6, prog: E.outExpo(seg(t, b(1), b(2.2))), rot: t * 0.05, col: C.ink, lw: 1, alpha: al * 0.55 });
  }
  /* --- the year: 1606 slam, then parked top-right over the page --- */
  if (t >= b(2) && t < b(9)) {
    const mv = E.inOutExpo(seg(t, b(3), b(4)));
    const size = lerp(330, 210, mv), x = lerp(960, 1835, mv), y = lerp(655, 255, mv);
    const align = mv < 0.5 ? 'center' : 'right';
    if (mv > 0) {
      // lime marker swipe behind the parked year
      const sw = E.outQuint(seg(t, b(3.6), b(4.3)));
      const swOut = E.inQuint(seg(t, b(7.1), b(7.6)));
      if (swOut < 1) paint(c1, linePts(1835 - 520 + swOut * 600, 190 - swOut * 30, 1880, 182, 4), sw, { col: C.lime, w: 170 * (1 - swOut), seed: 4, blend: 'source-over' });
    }
    const st = { size, w: 700, col: C.ink, ls: -0.05 };
    const exit = seg(t, b(7), b(7.6));
    if (exit <= 0) {
      if (t < b(2.7)) rise(c1, '1606', 960, 655, seg(t, b(2), b(2.7)), st, 0.05, 0.42);
      else {
        // interpolate anchor so the switch from center to right alignment is seamless
        const Lf = layout(c1, '1606', { ...st, size: 210 });
        const cx = lerp(960, 1835 - Lf.width / 2, mv);
        text(c1, '1606', cx, y, { ...st, align: 'center' });
      }
    } else fall(c1, '1606', 1835, 255, exit, { ...st, align: 'right' });
  }
  /* --- 2 to 3.5s: the page, painted --- */
  if (t >= b(4) && t < b(7.5)) {
    if (t >= b(4.2)) { bg(c0, C.paper); drawVoc(c0, t); }
    const cam = vocCam(t);
    const toScr = ([x, y]) => [960 + (x - cam.fx) * cam.z, 540 + (y - cam.fy) * cam.z];
    // lime loop around the handwritten date (drawn in page space so it tracks the punch)
    const lp = loopPts(DATE[0], DATE[1] - 4, 330, 62, 11, 1.1, -2.9, -0.03).map(toScr);
    paint(c0, lp, E.outCubic(seg(t, b(5), b(5.9))), { col: '#b8d93a', w: 11, seed: 2, blend: 'multiply' });
    // ink band + headline
    const bandIn = E.outQuint(seg(t, b(4), b(4.6)));
    const bandOut = E.inQuint(seg(t, b(6.9), b(7.4)));
    const x0 = 40, x1 = lerp(40, 1270, bandIn);
    paint(c1, linePts(x0 + bandOut * 1230, 560, x1, 552, 6), bandIn > 0 ? 1 : 0, { col: C.ink, w: 205, seed: 8, rough: 0.6 });
    const hs = { size: 150, col: C.white, align: 'left', ls: -0.045 };
    c1.save(); c1.beginPath(); c1.rect(0, 0, x1 - 20, H); c1.clip();
    if (t < b(6)) rise(c1, 'The first share.', 105, 607, seg(t, b(4.2), b(4.9)), hs, 0.025, 0.42);
    else if (t < b(6.9)) morph(c1, 'The first share.', 'Written by hand.', seg(t, b(6), b(6.85)), 105, 607, hs);
    else fall(c1, 'Written by hand.', 105, 607, seg(t, b(6.9), b(7.3)), hs);
    c1.restore();
  }
  /* --- 3.5 to 4.5s: tiles --- */
  if (t >= b(7) && t < b(9.6)) {
    if (t >= b(7.5)) bg(c0, C.paper);
    const sh = E.inOutExpo(seg(t, b(7), b(7.7)));
    const grow = E.inOutExpo(seg(t, b(8), b(8.7)));
    const whip = E.inExpo(seg(t, b(9), b(9.4)));
    const wx = -2600 * whip;
    // left tile: the second 1606 share
    const inL = E.outExpo(seg(t, b(7.25), b(7.9)));
    if (inL > 0) img(c1, IM.vocsep, lerp(-600, 420, inL) - grow * 1000 + wx, 540 + lerp(30, 0, inL), 640, 466, { rot: lerp(-0.25, -0.05, inL), blend: 'source-over', radius: 18, shadow: 1 });
    // right tile: signatures
    const inR = E.outExpo(seg(t, b(7.5), b(8.1)));
    const rw = lerp(700, 1560, grow), rh = rw * (320 / 750);
    if (inR > 0) img(c1, IM.voc_sig, lerp(2500, 1500, inR) + lerp(0, -540, grow) + wx, lerp(560, 540, grow), rw, rh, { rot: lerp(0.2, 0.04, inR) * (1 - grow), blend: 'source-over', radius: lerp(18, 26, grow), shadow: 1 });
    // centre tile: the page shrinking out of full frame
    if (t < b(8.6)) {
      const w = lerp(1920, 820, sh), h = lerp(1080, 461, sh);
      const away = E.inExpo(seg(t, b(8), b(8.6)));
      img(c1, IM.voc, 960, 540 + away * 900, w, h, { blend: 'source-over', radius: 22 * sh, shadow: sh, rot: 0.03 * sh, zoom: lerp(1.42, 1.0, sh), fx: lerp(0.4, 0.5, sh), fy: lerp(0.85, 0.5, sh) });
    }
    // underline under the signature once it is big
    if (grow > 0.9) {
      const ox = 960 + wx, s = rw / 750;
      paint(c1, linePts(ox - 0.33 * 750 * s, 540 + 0.27 * 320 * s, ox + 0.15 * 750 * s, 540 + 0.3 * 320 * s, -10), E.outCubic(seg(t, b(8.5), b(9))), { col: C.lime, w: 26, seed: 5, blend: 'source-over' });
    }
  }
  /* --- 4.5 to 6s: 1867 and the ticker --- */
  if (t >= b(9) && t < b(14)) {
    if (t >= b(9.5)) bg(c0, C.paper);
    const slide = E.inOutExpo(seg(t, b(9.9), b(10.6)));
    const out = E.inExpo(seg(t, b(12.4), b(13)));
    const st = { size: lerp(380, 250, slide), col: C.ink, ls: -0.05 };
    const yx = lerp(960, 520, slide) - out * 1500, yy = lerp(680, 520, slide);
    if (t < b(9.5)) {
      // whip in from the right with the tiles
      const p = E.outExpo(seg(t, b(9.25), b(9.75)));
      roll(c1, '1606', '1606', 0, yx + (1 - p) * 1600, yy, st);
    } else { const p = E.outExpo(seg(t, b(9.25), b(9.75))); roll(c1, '1606', '1867', seg(t, b(9.6), b(10.6)), yx + (1 - p) * 1600, yy, st, 0); }
    // edison ticker
    const ein = settle(seg(t, b(10.3), b(11.2)));
    if (t >= b(10.3)) {
      const eh = 980 * lerp(0.6, 1, ein);
      img(c0, IM.edison, lerp(1380, 1350, ein) - out * 1500, 560 + (1 - ein) * 120, eh * (1200 / 1484), eh, { blend: 'multiply', alpha: cl(ein * 3) });
    }
    if (t >= b(11)) {
      const hs = { size: 84, col: C.ink, align: 'left', ls: -0.04 };
      const p = seg(t, b(11), b(11.7));
      if (t < b(12.4)) rise(c1, 'Then it ran on tape.', 140, 680, p, hs, 0.02, 0.4);
      else fall(c1, 'Then it ran on tape.', 140 - out * 1500, 680, seg(t, b(12.4), b(12.9)), hs);
    }
  }
  /* --- tape in 3D: 5.5 to 9s --- */
  rib1.mesh.visible = t >= b(11) && t < b(17.4);
  if (rib1.mesh.visible) {
    const out = E.inExpo(seg(t, b(12.4), b(13)));
    const e = G.px2w(1350 - out * 1500 + 0.05 * 795, 560 - 0.30 * 980);
    // path leaves the wheel, dips, curls toward camera and sweeps right/down
    const path = (u) => {
      const x = e.x + 1.5 * Math.sin(u * 0.6) - 0.32 * u;
      const y = e.y + 0.15 * Math.sin(u * 1.2) - 0.22 * u - 0.035 * u * u;
      const z = 0.42 * u;
      return new G.THREE.Vector3(x, y, z);
    };
    const grow = E.outCubic(seg(t, b(11), b(13))) * 9.5;
    const away = E.inCubic(seg(t, b(16.2), b(17.4))) * 14;
    rib1.update(path, away, Math.max(0.02, grow) + away, (u) => 0.25 * Math.sin(u * 1.1 + t * 2) + u * 0.18, -t * 1.4);
    rib1.mesh.material.opacity = 1;
  }
  /* --- 6.5 to 8s: the exchange floor --- */
  if (t >= b(13) && t < b(19.5)) {
    if (t >= b(13)) bg(c0, C.paper);
    // slit-scan reveal: vertical strips arrive with a per-strip delay
    const n = 48, sw = W / n;
    const fade = seg(t, b(16), b(16.6)); // photo gives way to halftone
    for (let i = 0; i < n; i++) {
      const d = (i / n) * 0.45;
      const p = E.outExpo(cl((t - b(13) - d) / 0.42));
      if (p <= 0) continue;
      c0.save();
      c0.beginPath(); c0.rect(i * sw, 0, sw + 1, H); c0.clip();
      const zoom = lerp(1.35, 1.08, E.outCubic(seg(t, b(13), b(16)))) ;
      c0.globalAlpha = 1 - fade;
      img(c0, IM.floor, 960, 540 + (1 - p) * -1100 * (i % 2 ? 1 : -1), W, H, { blend: 'multiply', zoom, fy: 0.55 });
      c0.restore();
    }
    // punch words + painted marks on the crowd (beats 14, 14.5, 15)
    const words = [
      { s: 'Faster.', a: b(14), x: 480, y: 330, size: 190 },
      { s: 'Louder.', a: b(14.5), x: 1440, y: 560, size: 190 },
      { s: 'Everywhere.', a: b(15), x: 960, y: 880, size: 210 },
    ];
    for (const w of words) {
      if (t < w.a || t >= b(16.4)) continue;
      const p = seg(t, w.a, w.a + 0.3);
      const out = seg(t, b(16), b(16.4));
      const s = { size: w.size, col: C.ink, ls: -0.05 };
      // paper knock-out block painted behind the word
      const L = layout(c1, w.s, s);
      const bw = E.outExpo(p) * (L.width + 90);
      c1.save(); c1.globalAlpha = 1 - out;
      paint(c1, linePts(w.x - (L.width + 90) / 2, w.y - w.size * 0.33, w.x - (L.width + 90) / 2 + bw, w.y - w.size * 0.35, 3), 1, { col: w.s === 'Louder.' ? C.lime : C.white, w: w.size * 1.02, seed: w.a * 10, rough: 0.5 });
      rise(c1, w.s, w.x, w.y, p, s, 0.018, 0.3);
      c1.restore();
    }
    const marks = [
      { a: b(14.25), pts: loopPts(300, 760, 120, 80, 21, 1.15) },
      { a: b(14.75), pts: loopPts(1640, 300, 150, 90, 23, 1.15) },
    ];
    for (const m of marks) if (t >= m.a && t < b(16.2)) paint(c1, m.pts, E.outCubic(seg(t, m.a, m.a + 0.35)), { col: C.lime, w: 16, seed: 5 });
    const ar = arrowPts(820, 600, 1060, 720, -40, 46);
    if (t >= b(15.25) && t < b(16.2)) { const p = E.outCubic(seg(t, b(15.25), b(15.6))); paint(c1, ar.body, p, { col: C.ink, w: 12 }); paint(c1, ar.head, seg(t, b(15.5), b(15.7)), { col: C.ink, w: 12 }); }
  }
  /* --- 8 to 10s: halftone -> contract address --- */
  if (t >= b(16) && t < b(20)) {
    if (t >= b(16.6)) bg(c0, C.paper);
    const grow = E.outCubic(seg(t, b(16), b(16.6)));
    const fly = seg(t, b(17), b(18));
    const crisp = seg(t, b(17.9), b(18.3));
    const shrink = E.inOutExpo(seg(t, b(19.4), b(20)));
    c0.save();
    zoomAt(c0, 960, 545, lerp(1, 0.32, shrink));
    c0.fillStyle = C.ink;
    for (const d of HT.dots) {
      const r0 = HT.step * 0.5 * Math.sqrt(d.dark) * 1.12 * grow;
      if (d.trav) {
        const q = E.inOutCubic(cl((fly - (d.x / W) * 0.35 - d.seed * 0.1) / 0.55));
        const x = lerp(d.x, d.tx, q), y = lerp(d.y, d.ty, q) - Math.sin(q * Math.PI) * 90 * (d.seed - 0.3);
        const r = lerp(r0, 3.7, q) * (1 - crisp);
        if (r > 0.2) { c0.beginPath(); c0.arc(x, y, r, 0, 6.2832); c0.fill(); }
      } else {
        const r = r0 * (1 - E.inCubic(cl((fly - (1 - d.x / W) * 0.3) / 0.5)));
        if (r > 0.2) { c0.beginPath(); c0.arc(d.x, d.y, r, 0, 6.2832); c0.fill(); }
      }
    }
    c0.restore();
    if (crisp > 0) {
      c1.save(); c1.globalAlpha = crisp; zoomAt(c1, 960, 545, lerp(1, 0.32, shrink));
      text(c1, '0xa9ee…6f75', 960, 600, { size: 150, w: 500, f: 'm', ls: -0.04, col: C.ink });
      c1.restore();
    }
    // the year rolls to 2026 top-left on a lime block
    if (t >= b(16)) {
      const p = E.outExpo(seg(t, b(16), b(16.5)));
      const out = E.inExpo(seg(t, b(19.4), b(19.9)));
      const st = { size: 170, col: C.ink, ls: -0.05, align: 'left' };
      c1.save(); c1.translate(0, -out * 400);
      paint(c1, linePts(70, 162, 70 + 470 * p, 158, 2), 1, { col: C.lime, w: 160, seed: 6 });
      roll(c1, '1867', '2026', seg(t, b(16.2), b(17.4)), 110, 220, st, 0);
      c1.restore();
    }
    if (t >= b(18)) {
      const hs = { size: 96, col: C.ink, ls: -0.04 };
      if (t < b(19.4)) rise(c1, 'Now it’s a contract.', 960, 800, seg(t, b(18), b(18.7)), hs, 0.02, 0.4);
      else fall(c1, 'Now it’s a contract.', 960, 800, seg(t, b(19.4), b(19.8)), hs);
    }
  }
}

/* ================= frame ================= */
window.FILM_DURATION = DURATION;
window.renderFrame = (t) => {
  clear(c0); clear(c1);
  bg(c0, C.paper);
  for (const m of G.scene.children) if (m.isMesh || m.isGroup) m.visible = false;
  G.camera.position.set(0, 0, 10); G.camera.lookAt(0, 0, 0); G.camera.fov = 30; G.camera.updateProjectionMatrix();
  if (t < b(20.2)) act1(t);
  if (t >= b(19.9) && t < b(40.2)) act2(t, { c0, c1, IM, G });
  if (t >= b(39.9)) act3(t, { c0, c1, IM, G });
  G.render();
};
window.READY = true;
