// ACT 3 (20s - 45s): one registry, features, API, the paper trail, logo.
import { W, H, b, C, cl, seg, lerp, E, settle, rng, text, rise, fall, morph, roll, rosette, rosettePts, paint, loopPts, linePts, crossPts, img, rr, layout, setFont } from './core.js';
import * as G from './gl3d.js';
const { THREE } = G;

const AD = { "ondo": ["NVDAon 0xa9ee…6f75", "AAPLon 0x390a…18c4", "TSLAon 0x2494…9d93", "METAon 0xd7df…22f6", "SPYon 0x6a70…331a", "MSFTon 0x6bfe…44c3", "GOOGLon 0x091f…729a", "AMZNon 0x4553…f8fc"], "bstock": ["NVDAB 0x02fc…7436", "TSLAB 0x5b19…292f", "MSFTB 0x8010…b9b0", "INTCB 0xe614…5283", "ARMB 0xd42a…6f8c", "BABAB 0x4ef9…f4ec", "RKLBB 0xc8da…179a", "CRWVB 0x33e7…0c95"], "xstock": ["NVDAx 0xc845…849d", "AAPLx 0x9d27…890a", "TSLAx 0x8ad3…7cf0", "SPYx 0x90a2…dd48", "METAx 0x9670…989a", "COINx 0x364f…96f0", "AMZNx 0x3557…5081", "GOOGLx 0xe92f…803f"] };

let built = false; const ribs = []; let IMG;
function build(IM) {
  built = true; IMG = IM;
  const defs = [
    { k: 'ondo', label: 'ONDO', bg: '#ffffff', fg: C.ink, acc: C.green },
    { k: 'bstock', label: 'BSTOCKS', bg: C.gold, fg: C.ink, acc: C.ink },
    { k: 'xstock', label: 'XSTOCKS', bg: C.ink, fg: '#f8f9f7', acc: C.lime },
  ];
  for (const d of defs) {
    const items = [{ t: d.label, c: d.acc }, ...AD[d.k].map((s) => ({ t: s }))];
    const tt = G.tapeTexture(items, { bg: d.bg, fg: d.fg, accent: d.acc, size: 58 });
    const r = new G.Ribbon({ width: 0.62, segs: 500, tex: tt.tex, texLen: 0.62 * tt.aspect });
    r.mesh.visible = false; ribs.push(r);
  }
}

const ROWS = [
  { sym: 'NVDAon', iss: 'Ondo Finance', prov: 'Ondo', addr: '0xa9ee28c80f…cba016f75' },
  { sym: 'NVDAB', iss: 'BTech Holdings', prov: 'bStocks', addr: '0x02fca66c1d…3598a7436' },
  { sym: 'NVDAx', iss: 'Backed Assets', prov: 'xStocks', addr: '0xc845b2894d…725fe0849d' },
];
function logo(ctx, x, y, s) {
  const a = IMG.atlas; ctx.save(); rr(ctx, x - s / 2, y - s / 2, s, s, s * 0.23); ctx.clip();
  ctx.drawImage(a, 19.5, 19.5, 89, 89, x - s / 2, y - s / 2, s, s); ctx.restore();
}
function seal(ctx, x, y, R, p, t) {
  if (p <= 0) return;
  ctx.save(); ctx.translate(x, y); ctx.rotate(-0.18 + t * 0.4); const s = lerp(2.4, 1, settle(p)); ctx.scale(s, s); ctx.globalAlpha = cl(p * 3);
  ctx.fillStyle = C.lime; ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fill();
  rosette(ctx, 0, 0, R * 0.62, { n: 12, A: 0.1, Bm: 0.03, m: 4, L: 14, col: C.green, lw: 1.1 });
  ctx.strokeStyle = C.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, R - 6, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, 0, R * 0.78, 0, Math.PI * 2); ctx.lineWidth = 1.5; ctx.stroke();
  const str = 'VERIFIED · BNB CHAIN · VERIFIED · BNB CHAIN · ';
  ctx.font = "500 19px 'DM Mono'"; ctx.fillStyle = C.ink; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  for (let i = 0; i < str.length; i++) {
    const a = (i / str.length) * Math.PI * 2;
    ctx.save(); ctx.rotate(a); ctx.translate(0, -R * 0.89); ctx.fillText(str[i], 0, 0); ctx.restore();
  }
  // check
  ctx.strokeStyle = C.ink; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(-R * 0.26, 0); ctx.lineTo(-R * 0.07, R * 0.2); ctx.lineTo(R * 0.3, -R * 0.2); ctx.stroke();
  ctx.restore();
}

function panel(c, t, ox, oy, sc) {
  const pw = 1240, ph = 700;
  c.save(); c.translate(ox, oy); c.scale(sc, sc);
  c.shadowColor = 'rgba(17,26,24,0.16)'; c.shadowBlur = 70; c.shadowOffsetY = 30;
  c.fillStyle = '#fff'; rr(c, -pw / 2, -ph / 2, pw, ph, 40); c.fill();
  c.shadowColor = 'transparent';
  // search field
  const fx = -pw / 2 + 48, fy = -ph / 2 + 48, fw = pw - 96, fh = 104;
  c.fillStyle = C.pale; rr(c, fx, fy, fw, fh, 26); c.fill();
  c.strokeStyle = C.ink; c.lineWidth = 6; c.beginPath(); c.arc(fx + 60, fy + 48, 18, 0, Math.PI * 2); c.stroke();
  c.beginPath(); c.moveTo(fx + 73, fy + 62); c.lineTo(fx + 88, fy + 77); c.stroke();
  const q = 'NVDA', typed = Math.max(0, Math.min(4, Math.floor((t - b(44.5)) / (BEAT_Q)) + 1));
  const tq = t < b(44.5) ? '' : q.slice(0, typed);
  const r0 = text(c, tq, fx + 118, fy + 74, { size: 56, align: 'left', ls: -0.03 });
  if (Math.floor(t * 4) % 2 === 0 || t < b(46)) { c.fillStyle = C.ink; c.fillRect(fx + 122 + r0.width, fy + 26, 4, 54); }
  // rows
  ROWS.forEach((r, i) => {
    const a = b(46 + i * 0.5);
    const p = settle(seg(t, a, a + 0.5));
    if (p <= 0) return;
    const ry = -ph / 2 + 210 + i * 156;
    c.save(); c.translate(0, (1 - p) * 60); c.globalAlpha = cl(p * 2);
    // highlighter sweep on beat 48
    const hp = E.outCubic(seg(t, b(48 + i * 0.25), b(48.4 + i * 0.25)));
    if (hp > 0) { c.globalCompositeOperation = 'multiply'; paint(c, linePts(-pw / 2 + 40, ry + 66, -pw / 2 + 40 + (pw - 80) * hp, ry + 64, 2), 1, { col: C.lime, w: 118, seed: 50 + i, rough: 0.3, blend: 'source-over' }); c.globalCompositeOperation = 'source-over'; }
    if (i > 0) { c.fillStyle = C.line; c.fillRect(-pw / 2 + 48, ry - 8, pw - 96, 2); }
    logo(c, -pw / 2 + 100, ry + 66, 84);
    text(c, r.sym, -pw / 2 + 170, ry + 68, { size: 52, align: 'left', ls: -0.035 });
    text(c, r.iss, -pw / 2 + 172, ry + 108, { size: 28, w: 500, f: 's', align: 'left', ls: 0, col: C.muted });
    text(c, r.addr, -150, ry + 82, { size: 32, w: 500, f: 'm', align: 'left', ls: 0, col: C.ink });
    // verified pill
    const vx = pw / 2 - 210;
    c.fillStyle = C.ink; rr(c, vx, ry + 38, 160, 56, 28); c.fill();
    text(c, 'Verified', vx + 80, ry + 76, { size: 26, w: 500, f: 's', ls: 0, col: '#fff' });
    c.restore();
  });
  c.restore();
}
const BEAT_Q = b(0.25);

function featureIcon(c, k, t, a, x, y) {
  const p = (d0, d1) => seg(t, a + b(d0), a + b(d1));
  if (k === 0) { // look-alike: two coins, one rejected
    const sep = E.outExpo(p(0, 0.5));
    [[-1, C.green], [1, C.warn]].forEach(([sgn, col], i) => {
      const cx = x + sgn * 150 * sep, cy = y;
      c.fillStyle = '#fff'; c.strokeStyle = C.ink; c.lineWidth = 6;
      c.beginPath(); c.arc(cx, cy, 140, 0, Math.PI * 2); c.fill(); c.stroke();
      logo(c, cx, cy - 10, 120);
      const mp = E.outCubic(p(0.5 + i * 0.25, 0.9 + i * 0.25));
      if (i === 0) paint(c, [[cx - 50, cy + 100], [cx - 10, cy + 135], [cx + 70, cy + 70]], mp, { col: C.green, w: 22, seed: 3 });
      else { const [l1, l2] = crossPts(cx, cy + 100, 34); paint(c, l1, mp, { col: C.warn, w: 22 }); paint(c, l2, E.outCubic(p(1, 1.3)), { col: C.warn, w: 22 }); }
    });
  } else if (k === 1) { // wallet lookup
    const pop = settle(p(0, 0.6));
    c.save(); c.translate(x, y + 60); c.scale(pop, pop);
    [0, 1, 2].forEach((i) => {
      const q = E.outExpo(p(0.4 + i * 0.25, 0.9 + i * 0.25));
      const ty = -60 - q * (110 + i * 95);
      c.fillStyle = '#fff'; rr(c, -170, ty - 40, 340, 80, 40); c.fill();
      logo(c, -120, ty, 54);
      text(c, ['NVDAon', 'TSLAx', 'MSFTB'][i], -76, ty + 14, { size: 38, align: 'left', ls: -0.03 });
    });
    c.fillStyle = C.ink; rr(c, -230, -110, 460, 300, 46); c.fill();
    c.fillStyle = C.lime; rr(c, 90, -10, 160, 100, 50); c.fill();
    c.fillStyle = C.ink; c.beginPath(); c.arc(140, 40, 16, 0, Math.PI * 2); c.fill();
    c.restore();
  } else if (k === 2) { // daily report
    const pop = settle(p(0, 0.6));
    c.save(); c.translate(x, y); c.rotate(0.04); c.scale(pop, pop);
    c.shadowColor = 'rgba(17,26,24,.16)'; c.shadowBlur = 50; c.shadowOffsetY = 20;
    c.fillStyle = '#fff'; rr(c, -230, -290, 460, 580, 30); c.fill(); c.shadowColor = 'transparent';
    text(c, 'Nov 27', -180, -200, { size: 62, align: 'left', ls: -0.04 });
    text(c, 'Daily report', -180, -150, { size: 28, w: 500, f: 's', align: 'left', ls: 0, col: C.muted });
    const pts = [[-180, 120], [-120, 60], [-60, 90], [0, 10], [60, 40], [120, -40], [180, -70]];
    paint(c, pts, E.inOutCubic(p(0.3, 1.2)), { col: C.green, w: 12, rough: 0.2 });
    [0, 1, 2].forEach((i) => { const q = E.outExpo(p(0.6 + i * 0.25, 1 + i * 0.25)); c.fillStyle = i === 0 ? C.lime : C.pale; rr(c, -180, 170 + i * 36, 360 * q, 22, 11); c.fill(); });
    c.restore();
  } else { // API
    const op = E.outExpo(p(0, 0.6));
    text(c, '{', x - 60 - op * 140, y + 110, { size: 340, w: 500, f: 'm', col: C.lime, ls: 0 });
    text(c, '}', x + 60 + op * 140, y + 110, { size: 340, w: 500, f: 'm', col: C.lime, ls: 0 });
    const q = seg(t, a + b(0.5), a + b(1.2));
    if (q > 0) rise(c, 'v1', x, y + 70, q, { size: 150, col: '#fff', ls: -0.04 }, 0.05, 0.4);
  }
}

const FEATS = [
  { t1: 'Look-alike', t2: 'check', bg: C.paper, fg: C.ink },
  { t1: 'Wallet', t2: 'lookup', bg: C.lime, fg: C.ink },
  { t1: 'Daily', t2: 'report', bg: '#ffffff', fg: C.ink },
  { t1: 'Free', t2: 'API', bg: C.ink, fg: '#ffffff' },
];

export function act3(t, { c0, c1, IM }) {
  if (!built) build(IM);
  /* --- 20 - 22: braid --- */
  if (t >= b(39.9) && t < b(44.2)) {
    const merge = E.inOutCubic(seg(t, b(41), b(43.2)));
    const burst = E.outExpo(seg(t, b(40), b(41)));
    G.camera.position.set(0, 0.6, 9); G.camera.lookAt(0, 0, 0);
    ribs.forEach((r, k) => {
      r.mesh.visible = true;
      const ph = (k / 3) * Math.PI * 2;
      const path = (u) => {
        const R = 1.05 * burst * (1 - merge * cl((u + 6) / 9));
        const a = u * 0.9 + ph + t * 1.6;
        return new THREE.Vector3(u, Math.cos(a) * R, Math.sin(a) * R);
      };
      const len = 14 * burst;
      r.update(path, -len / 2 - 2, len / 2 + 2, (u) => u * 0.9 + (k / 3) * Math.PI * 2 + t * 1.6, t * 2.4, new THREE.Vector3(1, 0, 0).cross(new THREE.Vector3(0, 0, 1)));
    });
    // after the merge, one ribbon stays visible on the beat
    if (merge > 0.98) { ribs[0].mesh.visible = false; ribs[1].mesh.visible = false; }
    // a single lime dot hands over from the look-alike scene
    const d = 1 - burst;
    if (d > 0) { c1.fillStyle = C.ink; c1.beginPath(); c1.arc(960, 600, 40 * d, 0, 7); c1.fill(); }
    const exit = E.inExpo(seg(t, b(43.6), b(44.1)));
    G.camera.position.z = 9 - exit * 7;
  }
  /* headline carried from braid into the registry */
  if (t >= b(42) && t < b(51.9)) {
    const hs = { size: 112, ls: -0.045 };
    const bp = E.outExpo(seg(t, b(42), b(42.5)));
    const y = 170;
    const zoomOut = E.inExpo(seg(t, b(51.3), b(51.9)));
    c1.save(); c1.globalAlpha = 1 - zoomOut;
    if (t < b(50)) {
      const L = layout(c1, 'One registry.', hs);
      paint(c1, linePts(960 - (L.width / 2 + 50) * bp, y - 38, 960 + (L.width / 2 + 50) * bp, y - 40, 2), 1, { col: C.lime, w: 150, seed: 61, rough: 0.4 });
      rise(c1, 'One registry.', 960, y, seg(t, b(42), b(42.6)), hs, 0.03, 0.4);
    } else morph(c1, 'One registry.', 'Verified on BNB Chain.', seg(t, b(50), b(50.7)), 960, y, hs);
    c1.restore();
  }
  /* --- 22 - 26: registry UI --- */
  if (t >= b(44) && t < b(52.2)) {
    const pin = settle(seg(t, b(44), b(44.9)));
    const push = E.inExpo(seg(t, b(51.2), b(52)));
    const shake = t > b(49) && t < b(49.6) ? Math.sin((t - b(49)) * 70) * 10 * (1 - seg(t, b(49), b(49.6))) : 0;
    c0.save();
    // push toward the seal
    const sx = 960 + 470, sy = 620 - 250;
    c0.translate(sx, sy); c0.scale(1 + push * 5, 1 + push * 5); c0.translate(-sx, -sy);
    panel(c0, t, 960 + shake, 620 + (1 - pin) * 200, lerp(0.86, 1, pin));
    seal(c0, sx + shake, sy, 118, seg(t, b(49), b(49.8)), t - b(49));
    c0.restore();
  }
  /* --- 26 - 30: features --- */
  if (t >= b(51.8) && t < b(60.3)) {
    FEATS.forEach((f, k) => {
      const a = b(52 + k * 2);
      if (t < a - b(0.25) || t >= a + b(2.25)) return;
      const enter = E.inOutExpo(seg(t, a - b(0.25), a + b(0.25)));
      const off = (1 - enter) * W;
      c0.save(); c0.translate(off, 0);
      c0.fillStyle = f.bg; c0.fillRect(0, 0, W, H);
      const st = { size: 170, ls: -0.05, col: f.fg, align: 'left' };
      rise(c0, f.t1, 150, 500, seg(t, a, a + b(0.75)), st, 0.025, 0.4);
      rise(c0, f.t2, 150, 680, seg(t, a + b(0.25), a + b(1)), st, 0.025, 0.4);
      featureIcon(c0, k, t, a, 1380, 560);
      c0.restore();
    });
  }
  /* --- 30 - 32: the API --- */
  if (t >= b(60) && t < b(64.2)) {
    const a = b(60);
    const pin = settle(seg(t, a, a + b(1)));
    const out = E.inOutExpo(seg(t, b(63.5), b(64.1)));
    c0.fillStyle = C.ink; c0.fillRect(0, 0, W, H);
    c0.save(); c0.translate(960, 560 + (1 - pin) * 80); const s = lerp(1, 0.04, out); c0.scale(s, s);
    const cmd = '$ curl mintmark.nuvixes.studio/v1/companies/NVDA';
    const n = Math.floor(cl(seg(t, a, a + b(1.2))) * cmd.length);
    const x0 = -800, y0 = -320;
    c0.font = "500 50px 'DM Mono'"; c0.letterSpacing = '0px'; c0.textAlign = 'left'; c0.textBaseline = 'alphabetic';
    c0.fillStyle = C.lime; c0.fillText(cmd.slice(0, 1), x0, y0);
    c0.fillStyle = '#ffffff'; c0.fillText(cmd.slice(1, n), x0 + c0.measureText('$').width, y0);
    const lines = [
      [['{', '#fff']],
      [['  "ticker": ', C.mint], ['"NVDA"', C.lime], [',', '#fff']],
      [['  "products": [', C.mint]],
      [['    { ', '#fff'], ['"symbol": ', C.mint], ['"NVDAon"', C.lime], [', ', '#fff'], ['"provider": ', C.mint], ['"Ondo"', C.lime], [' },', '#fff']],
      [['    { ', '#fff'], ['"symbol": ', C.mint], ['"NVDAB"', C.lime], [',  ', '#fff'], ['"provider": ', C.mint], ['"bStocks"', C.lime], [' },', '#fff']],
      [['    { ', '#fff'], ['"symbol": ', C.mint], ['"NVDAx"', C.lime], [',  ', '#fff'], ['"provider": ', C.mint], ['"xStocks"', C.lime], [' }', '#fff']],
      [['  ]', C.mint]],
      [['}', '#fff']],
    ];
    lines.forEach((ln, i) => {
      const la = a + b(1.4 + i * 0.25);
      const q = E.outExpo(seg(t, la, la + 0.25));
      if (q <= 0) return;
      c0.save(); c0.globalAlpha = q; c0.translate((1 - q) * 40, 0);
      let x = x0; const y = y0 + 120 + i * 74;
      for (const [s2, col] of ln) { c0.fillStyle = col; c0.fillText(s2, x, y); x += c0.measureText(s2).width; }
      c0.restore();
    });
    if (n < cmd.length || Math.floor(t * 4) % 2 === 0) { c0.fillStyle = C.lime; c0.fillRect(x0 + c0.measureText(cmd.slice(0, Math.max(1, n))).width + 6, y0 - 38, 22, 46); }
    c0.restore();
  }
  /* --- 32 - 34: three providers, one source of truth --- */
  if (t >= b(64) && t < b(68.2)) {
    const m = E.inOutExpo(seg(t, b(66), b(66.7)));
    const cols = [C.ink, C.gold, C.green];
    const out = E.inExpo(seg(t, b(67.6), b(68.1)));
    cols.forEach((col, i) => {
      const p = settle(seg(t, b(64 + i * 0.25), b(64.7 + i * 0.25)));
      const x = lerp(960 + (i - 1) * 190, 960, m), r = 62 * p * (1 - out);
      c1.fillStyle = m > 0.9 ? C.lime : col; c1.beginPath(); c1.arc(x, 380, r * lerp(1, 1.5, m), 0, 7); c1.fill();
    });
    if (m > 0.9) { c1.strokeStyle = C.ink; c1.lineWidth = 6; c1.beginPath(); c1.arc(960, 380, 93 * (1 - out), 0, 7); c1.stroke(); }
    const hs = { size: 140, ls: -0.05 };
    if (t < b(66)) rise(c1, 'Three providers.', 960, 680, seg(t, b(64.25), b(64.9)), hs, 0.025, 0.4);
    else if (t < b(67.6)) morph(c1, 'Three providers.', 'One source of truth.', seg(t, b(66), b(66.75)), 960, 680, hs);
    else fall(c1, 'One source of truth.', 960, 680, seg(t, b(67.6), b(68)), hs);
  }
  /* --- 34 - 36: rewind the paper trail --- */
  if (t >= b(68) && t < b(72.2)) {
    const shots = [
      { a: 68, im: 'floor', x: 560, y: 420, w: 820, h: 520, r: -0.05 },
      { a: 68.5, im: 'edison', x: 1430, y: 560, w: 560, h: 692, r: 0.04 },
      { a: 69, im: 'street', x: 760, y: 640, w: 480, h: 622, r: 0.06 },
      { a: 69.5, im: 'voc_date', x: 1220, y: 330, w: 900, h: 268, r: -0.03 },
      { a: 70, im: 'vocsep', x: 520, y: 720, w: 640, h: 466, r: 0.03 },
      { a: 70.5, im: 'voc_full', x: 1420, y: 640, w: 470, h: 659, r: -0.04 },
      { a: 71, im: 'voc', x: 960, y: 540, w: 1920, h: 1080, r: 0 },
    ];
    for (const s of shots) {
      if (t < b(s.a)) continue;
      const p = E.outExpo(seg(t, b(s.a), b(s.a + 0.5)));
      const out = E.inExpo(seg(t, b(71.6), b(72.1)));
      const full = s.a === 71;
      const w = full ? lerp(300, 1920, p) : s.w * lerp(0.5, 1, p), h = full ? lerp(169, 1080, p) : s.h * lerp(0.5, 1, p);
      img(c0, IM[s.im], s.x, s.y + (1 - p) * 90 - out * 1200 * (full ? 0 : 1), w, h, { rot: s.r * (1 - p * 0.3), blend: 'source-over', radius: full ? 0 : 22, shadow: full ? 0 : 1 });
    }
    // year rewinds on a lime slab, top layer
    const p = E.outExpo(seg(t, b(68), b(68.5)));
    const out = E.inExpo(seg(t, b(71.6), b(72.1)));
    paint(c1, linePts(960 - 420 * p, 470, 960 + 420 * p, 466, 2), 1, { col: C.lime, w: 300 * (1 - out), seed: 71, rough: 0.4 });
    if (out < 0.6) roll(c1, '2026', '1606', seg(t, b(68.2), b(71.2)), 960, 580, { size: 300, ls: -0.05 }, 3);
  }
  /* --- 36 - 38: every token has a paper trail --- */
  if (t >= b(72) && t < b(76.4)) {
    const hs = { size: 168, ls: -0.05 };
    const out = seg(t, b(75), b(75.5));
    if (t < b(75)) {
      rise(c1, 'Every token has', 960, 470, seg(t, b(72), b(72.7)), hs, 0.025, 0.4);
      const L = layout(c1, 'a paper trail.', hs);
      const hp = E.outCubic(seg(t, b(73.5), b(74.1)));
      const x0 = 960 - L.width / 2 + L.xs[2] - 18;
      paint(c1, linePts(x0, 640, x0 + (960 + L.width / 2 - x0 + 18) * hp, 636, 2), 1, { col: C.lime, w: 150, seed: 77, rough: 0.4 });
      rise(c1, 'a paper trail.', 960, 690, seg(t, b(73), b(73.7)), hs, 0.025, 0.4);
    } else {
      fall(c1, 'Every token has', 960, 470, out, hs);
      fall(c1, 'a paper trail.', 960, 690, seg(t, b(75.1), b(75.6)), hs);
    }
  }
  /* --- 38 - 45: rosette -> mark -> lockup --- */
  if (t >= b(75)) logoScene(c0, c1, t);
}

/* ---------- logo ---------- */
const S = 230; // icon size
function logoScene(c0, c1, t) {
  const draw = E.outExpo(seg(t, b(75), b(76.5)));
  const merge = E.inOutCubic(seg(t, b(76.5), b(77.6)));
  const open = E.inOutExpo(seg(t, b(77.6), b(78.4)));
  const sq = settle(seg(t, b(78), b(79)));
  const slide = E.inOutExpo(seg(t, b(78.8), b(79.8)));
  // lockup geometry
  const ws = { size: 200, w: 700, ls: -0.0565 };
  const L = layout(c1, 'mintmark', ws);
  const gap = (11 / 23) * ws.size;
  const total = S + gap + L.width;
  const iconX = lerp(960, 960 - total / 2 + S / 2, slide), iconY = 500;
  const breathe = 1 + 0.06 * E.inOutCubic(seg(t, b(79.5), 45));
  // background guilloche keeps turning, very faint
  rosette(c0, 960, 540, 760, { n: 18, A: 0.05, Bm: 0.02, m: 7, L: 10, prog: E.outExpo(seg(t, b(78), b(80))), rot: t * 0.06, col: C.green, lw: 1.2, alpha: 0.38 });
  rosette(c0, 960, 540, 980, { n: 26, A: 0.03, Bm: 0.0, m: 5, L: 6, prog: E.outExpo(seg(t, b(78.5), b(80.5))), rot: -t * 0.04, col: C.green, lw: 1.1, alpha: 0.26 });
  c1.save();
  c1.translate(960, 540); c1.scale(breathe, breathe); c1.translate(-960, -540);
  // square
  if (sq > 0) {
    c1.save(); c1.translate(iconX, iconY); c1.rotate(lerp(0.6, -8 * Math.PI / 180, sq)); c1.scale(sq, sq);
    c1.fillStyle = C.ink; rr(c1, -S / 2, -S / 2, S, S, S * (10 / 32)); c1.fill(); c1.restore();
  }
  // ring: rosette lines merge into one circle, shrink, then open the gap
  const R0 = 330, Rm = (13 / 64) * S;
  const R = lerp(R0, Rm, E.inOutCubic(seg(t, b(76.8), b(78))));
  const lw = lerp(1.4, (3 / 32) * S, E.inOutCubic(seg(t, b(77), b(78.2))));
  const rot = -(8 + 25) * Math.PI / 180;
  const col = sq > 0.35 ? C.paper : C.ink;
  if (merge < 1) {
    rosette(c1, iconX, iconY, R, { n: 10, A: 0.11 * (1 - merge), Bm: 0.04 * (1 - merge), m: 3, L: 26, merge, prog: draw, rot: t * 0.12 * (1 - merge), col, lw: lerp(1.3, 6, merge) });
  } else {
    // gap centred at the top, rotated like the site mark
    const gapAng = (Math.PI / 2) * open;
    const top = -Math.PI / 2 + rot - 8 * Math.PI / 180 * 0 ;
    c1.save(); c1.translate(iconX, iconY);
    c1.strokeStyle = col; c1.lineWidth = lw; c1.lineCap = 'butt';
    // one full turn of the ring at 42s, like a refresh
    c1.rotate(Math.PI * 2 * E.inOutExpo(seg(t, b(84), b(85.5))));
    c1.beginPath(); c1.arc(0, 0, R, top + gapAng / 2, top - gapAng / 2 + Math.PI * 2); c1.stroke();
    c1.restore();
  }
  // wordmark
  if (t >= b(79)) {
    const wx = iconX + S / 2 + gap;
    rise(c1, 'mintmark', wx, iconY + 72, seg(t, b(79), b(79.9)), { ...ws, align: 'left' }, 0.04, 0.42);
  }
  if (t >= b(80)) {
    rise(c1, 'The registry for tokenized stocks.', 960, 750, seg(t, b(80), b(80.8)), { size: 56, w: 500, f: 's', ls: -0.01 }, 0.012, 0.4);
  }
  if (t >= b(81)) {
    const p = seg(t, b(81), b(81.7));
    rise(c1, 'mintmark.nuvixes.studio', 960, 850, p, { size: 40, w: 500, f: 'm', ls: 0, col: C.green }, 0.015, 0.35);
    const L2 = layout(c1, 'mintmark.nuvixes.studio', { size: 40, w: 500, f: 'm', ls: 0 });
    paint(c1, linePts(960 - L2.width / 2, 872, 960 - L2.width / 2 + L2.width * E.outCubic(seg(t, b(82), b(82.8))), 870, 1), 1, { col: C.lime, w: 12, seed: 90, rough: 0.3 });
  }
  c1.restore();
  // tape of real contracts scrolling along the bottom
  if (t >= b(80)) {
    const p = E.outExpo(seg(t, b(80), b(81)));
    const all = [...AD.ondo, ...AD.bstock, ...AD.xstock];
    const str = all.join('   ·   ') + '   ·   ';
    c1.save(); c1.globalAlpha = p;
    c1.fillStyle = C.ink; c1.fillRect(0, 1000 + (1 - p) * 80, W, 80);
    c1.font = "500 30px 'DM Mono'"; c1.letterSpacing = '0px'; c1.textBaseline = 'middle'; c1.textAlign = 'left';
    const ws = all.map((it) => c1.measureText(it).width + 90);
    const sw = ws.reduce((a, z) => a + z, 0);
    let x = -(((t - b(80)) * 160) % sw);
    c1.fillStyle = '#f8f9f7';
    for (let k = 0; x < W; k++) {
      const i = k % all.length;
      if (x + ws[i] > 0) { c1.fillText(all[i], x, 1040 + (1 - p) * 80); c1.fillStyle = C.lime; c1.fillText('·', x + ws[i] - 55, 1040 + (1 - p) * 80); c1.fillStyle = '#f8f9f7'; }
      x += ws[i];
    }
    c1.restore();
  }
}
