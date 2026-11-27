// ACT 2 (10s - 20s): one stock, three issuers, 1,937 contracts, look-alikes.
import { W, H, b, C, cl, seg, lerp, E, settle, rng, text, rise, fall, morph, roll, paint, loopPts, linePts, crossPts, img, rr, layout, setFont } from './core.js';
import * as G from './gl3d.js';
const { THREE } = G;

export const CARDS = [
  { issuer: 'Ondo Finance', prov: 'Ondo', sym: 'NVDAon', addr: '0xa9ee28c80f960b889dfbd1902055218cba016f75', bg: '#ffffff', fg: C.ink, sub: C.muted, acc: C.green },
  { issuer: 'BTech Holdings', prov: 'bStocks', sym: 'NVDAB', addr: '0x02fca66c1d1afb4e2a7884261eb00f63598a7436', bg: C.gold, fg: C.ink, sub: '#5c4a12', acc: C.ink },
  { issuer: 'Backed Assets', prov: 'xStocks', sym: 'NVDAx', addr: '0xc845b2894dbddd03858fd2d643b4ef725fe0849d', bg: C.ink, fg: '#f8f9f7', sub: '#93a797', acc: C.lime },
];

let built = false, cards = [], nvdaImg = null, atlas = null;
function build(IM) {
  built = true; nvdaImg = IM.nvda; atlas = IM.atlas;
  CARDS.forEach((c, i) => {
    const tex = G.textTexture((x, w, h) => {
      x.clearRect(0, 0, w, h);
      x.fillStyle = c.bg; rr(x, 0, 0, w, h, 56); x.fill();
      if (c.bg === '#ffffff') { x.strokeStyle = C.line; x.lineWidth = 4; rr(x, 2, 2, w - 4, h - 4, 54); x.stroke(); }
      x.fillStyle = c.fg; x.textBaseline = 'alphabetic';
      // provider pill
      x.font = "500 38px 'DM Sans'";
      const pw = x.measureText(c.prov).width + 56;
      x.fillStyle = c.acc; rr(x, 56, 56, pw, 70, 35); x.fill();
      x.fillStyle = c.bg === C.ink ? C.ink : (c.acc === C.ink ? C.gold : '#ffffff');
      x.fillText(c.prov, 84, 104);
      // logo
      x.save(); rr(x, w - 56 - 96, 44, 96, 96, 26); x.clip(); x.drawImage(nvdaImg, w - 56 - 96, 44, 96, 96); x.restore();
      x.fillStyle = c.fg;
      x.font = "700 132px 'Space Grotesk'"; x.letterSpacing = '-6px';
      x.fillText(c.sym, 50, 330);
      x.letterSpacing = '0px';
      x.fillStyle = c.sub; x.font = "500 34px 'DM Sans'";
      x.fillText(c.issuer, 56, 392);
      // address
      x.fillStyle = c.sub; x.font = "500 30px 'DM Mono'"; x.fillText('CONTRACT · BNB CHAIN', 56, 600);
      x.fillStyle = c.fg; x.font = "500 44px 'DM Mono'";
      x.fillText(c.addr.slice(0, 22), 56, 672);
      x.fillText(c.addr.slice(22), 56, 730);
      x.fillStyle = c.acc; x.fillRect(56, 800, w - 112, 4);
      x.fillStyle = c.fg; x.font = "500 36px 'DM Sans'"; x.fillText('Tracks NVIDIA · NVDA', 56, 872);
    }, 760, 960);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4 * 960 / 760), new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.02, side: THREE.DoubleSide, roughness: 0.7 }));
    m.visible = false; G.scene.add(m); cards.push(m);
  });
}

// deterministic logo index per grid cell, NVDA (0) at the origin
const cellLogo = (i, j) => (i === 0 && j === 0 ? 0 : Math.floor(rng((i * 7919 + j * 104729) ^ 0x5bd1e995)() * 120));
function logoTile(ctx, idx, x, y, s) {
  const sx = (idx % 12) * 128, sy = Math.floor(idx / 12) * 128;
  ctx.save(); rr(ctx, x - s / 2, y - s / 2, s, s, s * 0.23); ctx.clip();
  ctx.drawImage(atlas, sx + 19.5, sy + 19.5, 89, 89, x - s / 2, y - s / 2, s, s);
  ctx.restore();
}

const REAL = '0xc845b2894dbddd03858fd2d643b4ef725fe0849d';
const FAKE = '0xc845b2f1a07e9c3b55d2e88416a0c9b31fe0849d';

function addrCard(ctx, x, y, w, h, title, addr, other, scanP, o = {}) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(o.rot || 0); ctx.scale(o.s ?? 1, o.s ?? 1);
  ctx.shadowColor = 'rgba(17,26,24,0.16)'; ctx.shadowBlur = 50; ctx.shadowOffsetY = 22;
  ctx.fillStyle = '#ffffff'; rr(ctx, -w / 2, -h / 2, w, h, 34); ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = C.line; ctx.lineWidth = 2; rr(ctx, -w / 2, -h / 2, w, h, 34); ctx.stroke();
  logoTile(ctx, 0, -w / 2 + 92, -h / 2 + 92, 84);
  text(ctx, title, -w / 2 + 156, -h / 2 + 118, { size: 74, align: 'left', ls: -0.04 });
  // address in two lines; mismatching characters light up as the scan passes
  ctx.font = "500 50px 'DM Mono'"; ctx.letterSpacing = '0px'; ctx.textBaseline = 'alphabetic';
  const cw = ctx.measureText('0').width;
  for (let k = 0; k < addr.length; k++) {
    const line = k < 21 ? 0 : 1, col = k % 21;
    const px = -w / 2 + 60 + col * cw, py = -h / 2 + 232 + line * 68;
    const passed = scanP * 46 > k + 2;
    const diff = other && addr[k] !== other[k];
    if (passed && diff && o.flag) {
      ctx.fillStyle = 'rgba(255,90,54,0.18)'; ctx.fillRect(px - 2, py - 46, cw + 4, 60);
      ctx.fillStyle = C.warn;
    } else if (passed && !diff && o.flag) ctx.fillStyle = C.ink;
    else ctx.fillStyle = C.ink;
    ctx.fillText(addr[k], px, py);
  }
  // scan cursor
  if (scanP > 0 && scanP < 1) {
    const k = Math.min(41, Math.floor(scanP * 44));
    const line = k < 21 ? 0 : 1;
    ctx.fillStyle = C.lime; ctx.globalCompositeOperation = 'multiply';
    ctx.fillRect(-w / 2 + 56 + (k % 21) * cw, -h / 2 + 182 + line * 68, cw + 6, 64);
    ctx.globalCompositeOperation = 'source-over';
  }
  ctx.restore();
}

export function act2(t, { c0, c1, IM }) {
  if (!built) build(IM);
  /* --- 19.0 - 20.0: bridge: three dots orbit, the promise --- */
  if (t >= b(37.8) && t < b(40.1)) {
    const cols = [C.ink, C.gold, C.green];
    const p = E.outExpo(seg(t, b(37.9), b(38.5)));
    const spin = E.inCubic(seg(t, b(38), b(40))) * 9 + (t - b(38)) * 2;
    const rad = lerp(0, 120, p) * (1 - E.inExpo(seg(t, b(39.6), b(40))));
    cols.forEach((col, i) => {
      const a = spin + (i / 3) * Math.PI * 2;
      c1.fillStyle = col; c1.beginPath(); c1.arc(960 + Math.cos(a) * rad, 600 + Math.sin(a) * rad * 0.45, 30 * p, 0, 7); c1.fill();
    });
    const hs = { size: 120, ls: -0.045 };
    if (t < b(39)) rise(c1, 'We pulled all three', 960, 300, seg(t, b(38), b(38.6)), hs, 0.02, 0.4);
    else if (t < b(39.6)) morph(c1, 'We pulled all three', 'into one place.', seg(t, b(39), b(39.5)), 960, 300, hs);
    else fall(c1, 'into one place.', 960, 300, seg(t, b(39.6), b(39.95)), hs);
  }
  /* --- 10.0 - 11.0: NVDA on lime --- */
  if (t >= b(20) && t < b(22.1)) {
    const wipe = E.inOutExpo(seg(t, b(19.8), b(20.4)));
    c0.fillStyle = C.lime; c0.beginPath(); c0.arc(960, 545, 2300 * wipe, 0, Math.PI * 2); c0.fill();
    const lp = settle(seg(t, b(20), b(20.8)));
    const out = E.inExpo(seg(t, b(21.6), b(22)));
    const s = 230 * lp * (1 - out);
    if (s > 1) {
      c1.save(); c1.translate(960, 330); c1.rotate((1 - lp) * -0.5);
      c1.shadowColor = 'rgba(17,26,24,.25)'; c1.shadowBlur = 40; c1.shadowOffsetY = 18;
      c1.fillStyle = '#76b900'; rr(c1, -s / 2, -s / 2, s, s, s * 0.23); c1.fill(); c1.restore();
      c1.save(); c1.translate(960, 330); c1.rotate((1 - lp) * -0.5); logoTile(c1, 0, 0, 0, s); c1.restore();
    }
    const st = { size: 300, ls: -0.055 };
    if (t < b(21)) rise(c1, 'NVDA', 960, 760, seg(t, b(20.5), b(21)), st, 0.04, 0.35);
    else if (t < b(21.6)) morph(c1, 'NVDA', 'One stock.', seg(t, b(21), b(21.5)), 960, 760, st, { size: 220 });
    else fall(c1, 'One stock.', 960, 760, seg(t, b(21.6), b(22)), { ...st, size: 220 });
  }
  /* --- 11.0 - 13.0: three issuer cards in 3D --- */
  if (t >= b(22) && t < b(26.2)) {
    const pull = E.inExpo(seg(t, b(25.5), b(26.1)));
    G.camera.position.set(Math.sin(t * 0.9) * 0.6, 0.15, 10 + pull * 26);
    G.camera.lookAt(0, -0.15, 0);
    const order = [1, 0, 2];
    CARDS.forEach((c, i) => {
      const m = cards[i];
      const k = order.indexOf(i);
      const p = settle(seg(t, b(22 + k * 0.5), b(23 + k * 0.5)));
      if (p <= 0) return;
      m.visible = true;
      const side = i - 1;
      m.position.set(side * 2.75 * p, -0.25 + (1 - p) * -3, -Math.abs(side) * 0.35);
      m.rotation.set((1 - p) * 0.9, side * -0.32 * p + (1 - p) * 1.2 * (side || 1) + Math.sin(t * 1.3 + i) * 0.04, side * 0.03 + (1 - p) * 0.3);
      m.scale.setScalar(lerp(0.6, 1, p));
    });
    G.camera.updateProjectionMatrix();
    const hs = { size: 110, ls: -0.045 };
    const y = 170;
    if (t < b(24)) rise(c1, 'Three issuers.', 960, y, seg(t, b(22.5), b(23.1)), hs, 0.025, 0.4);
    else if (t < b(25.5)) morph(c1, 'Three issuers.', 'Three contracts.', seg(t, b(24), b(24.6)), 960, y, hs);
    else fall(c1, 'Three contracts.', 960, y, seg(t, b(25.5), b(25.9)), hs);
    // contracts get painted underlines on the beat
    if (t >= b(24.5) && t < b(25.6)) {
      const xs = [400, 960, 1520];
      xs.forEach((x, i) => { const p = E.outCubic(seg(t, b(24.5 + i * 0.25), b(24.9 + i * 0.25))); paint(c1, linePts(x - 230, 818, x + 230, 812, -6), p, { col: C.lime, w: 14, seed: 30 + i, blend: 'multiply' }); });
    }
  } else { G.camera.position.set(0, 0, 10); G.camera.lookAt(0, 0, 0); }
  /* --- 13.0 - 15.0: the logo wall + 1,937 --- */
  if (t >= b(26) && t < b(29.9)) {
    const zIn = E.outExpo(seg(t, b(26), b(27.4)));
    const z = lerp(3.4, 0.82, zIn) * lerp(1, 0.9, seg(t, b(27.4), b(29.9)));
    const pitch = 134 * z, s = 108 * z;
    const ox = 960 + Math.sin(t * 0.7) * 10, oy = 545 - (t - b(26)) * 40 * z;
    const ni = Math.ceil(960 / pitch) + 2, nj = Math.ceil(540 / pitch) + 3;
    const out = E.inExpo(seg(t, b(29.3), b(29.9)));
    for (let j = -nj; j <= nj; j++) for (let i = -ni; i <= ni; i++) {
      const d = Math.hypot(i, j);
      const p = settle(seg(t, b(26) + d * 0.045, b(26) + d * 0.045 + 0.45));
      const q = 1 - E.inCubic(cl((out * 1.6) - (1 - d / 14) * 0.6));
      const sz = s * p * q;
      if (sz < 2) continue;
      logoTile(c0, cellLogo(i, j), ox + i * pitch, oy + j * pitch + (j % 2 ? 0 : 0), sz);
    }
    // counter on a painted lime slab
    const slab = E.outExpo(seg(t, b(26.5), b(27)));
    const slabOut = E.inExpo(seg(t, b(29.3), b(29.8)));
    if (slab > 0 && slabOut < 1) {
      c1.save();
      paint(c1, linePts(960 - 560 * slab, 470, 960 + 560 * slab, 462, 4), 1, { col: C.lime, w: 330 * (1 - slabOut), seed: 41, rough: 0.4 });
      c1.restore();
      if (slabOut < 0.5) {
        roll(c1, '0,000', '1,937', seg(t, b(26.6), b(28)), 960, 580, { size: 320, ls: -0.05 }, 1);
        if (t >= b(28)) {
          const cs = { size: 84, ls: -0.035, col: '#ffffff' };
          const bp = E.outExpo(seg(t, b(27.8), b(28.3)));
          paint(c1, linePts(960 - 470 * bp, 712, 960 + 470 * bp, 708, 2), 1, { col: C.ink, w: 130, seed: 43, rough: 0.4 });
          if (t < b(28.75)) rise(c1, 'contracts tracked', 960, 740, seg(t, b(28), b(28.5)), cs, 0.015, 0.35);
          else morph(c1, 'contracts tracked', 'across 1,619 tickers', seg(t, b(28.75), b(29.25)), 960, 740, cs);
        }
      }
    }
  }
  /* --- 15.0 - 16.0: three providers --- */
  if (t >= b(29.6) && t < b(32.2)) {
    const rows = [
      { n: 'Ondo', v: 474, col: C.ink },
      { n: 'bStocks', v: 46, col: C.gold },
      { n: 'xStocks', v: 1417, col: C.green },
    ];
    const gone = E.inOutExpo(seg(t, b(31.5), b(32.1)));
    rows.forEach((r, i) => {
      const a = b(29.75 + i * 0.5);
      const p = E.outExpo(seg(t, a, a + 0.45));
      if (p <= 0) return;
      const y = 330 + i * 250;
      const len = Math.max(30, (r.v / 1417) * 940) * p;
      const bx = 740;
      // bars collapse into dots that converge to centre
      const cx = lerp(bx + len / 2, 960 + (i - 1) * 90, gone), cy = lerp(y - 40, 545, gone);
      const bw = lerp(len, 64, gone), bh = lerp(120, 64, gone);
      c1.fillStyle = r.col; rr(c1, cx - bw / 2, cy - bh / 2, bw, bh, bh / 2); c1.fill();
      if (gone < 0.4) {
        c1.save(); c1.globalAlpha = 1 - gone / 0.4;
        rise(c1, r.n, 680, y, seg(t, a, a + 0.4), { size: 124, align: 'right', ls: -0.04 }, 0.02, 0.35);
        const num = Math.round(r.v * E.outCubic(seg(t, a, a + 0.6))).toLocaleString('en-US');
        text(c1, num, bx + len + 32, y - 8, { size: 84, align: 'left', w: 500, f: 'm', ls: -0.03, col: r.col === C.gold ? '#8a6a00' : r.col });
        c1.restore();
      }
    });
  }
  /* --- 16.0 - 19.0: look-alikes --- */
  if (t >= b(32) && t < b(38.2)) {
    const inL = settle(seg(t, b(32), b(32.9))), inR = settle(seg(t, b(32.5), b(33.4)));
    const coll = E.inOutExpo(seg(t, b(37.4), b(38)));
    const scan = seg(t, b(34), b(35));
    const cw = 780, ch = 380;
    const lx = lerp(lerp(-600, 520, inL), 960, coll), rx = lerp(lerp(2500, 1400, inR), 960, coll);
    const sc = 1 - coll * 0.92;
    addrCard(c1, lx, 600, cw, ch, 'NVDAx', REAL, FAKE, scan, { rot: lerp(-0.06, -0.015, inL), s: sc, flag: false });
    addrCard(c1, rx, 600, cw, ch, 'NVDAx', FAKE, REAL, scan, { rot: lerp(0.08, 0.02, inR), s: sc, flag: true });
    // verdicts
    if (t >= b(35) && coll < 0.2) {
      const p = E.outCubic(seg(t, b(35), b(35.35)));
      const ck = [[lx - 120, 600 + 120], [lx - 60, 600 + 175], [lx + 90, 600 + 40]].map(([x, y]) => [x + 190, y - 280]);
      paint(c1, linePts(ck[0][0], ck[0][1], ck[1][0], ck[1][1], 0, 8).concat(linePts(ck[1][0], ck[1][1], ck[2][0], ck[2][1], 0, 14)), p, { col: C.green, w: 30, seed: 9 });
      const [x1, x2] = crossPts(rx + 250, 600 - 110, 64);
      paint(c1, x1, E.outCubic(seg(t, b(35.25), b(35.55))), { col: C.warn, w: 30, seed: 12 });
      paint(c1, x2, E.outCubic(seg(t, b(35.45), b(35.75))), { col: C.warn, w: 30, seed: 13 });
      // stamp
      const sp = settle(seg(t, b(35.5), b(36.2)));
      if (sp > 0) {
        c1.save(); c1.translate(rx + 60, 600 + 40); c1.rotate(-0.12); c1.scale(lerp(2.2, 1, sp), lerp(2.2, 1, sp)); c1.globalAlpha = cl(sp * 2.2);
        c1.strokeStyle = C.warn; c1.lineWidth = 9; rr(c1, -250, -62, 500, 124, 20); c1.stroke();
        text(c1, 'LOOK-ALIKE', 0, 30, { size: 84, col: C.warn, ls: 0.01 });
        c1.restore();
      }
    }
    const hs = { size: 112, ls: -0.045 };
    const y = 230;
    if (t >= b(33) && coll < 1) {
      if (t < b(36)) rise(c1, 'Which one is real?', 960, y, seg(t, b(33), b(33.6)), hs, 0.02, 0.4);
      else if (t < b(37.4)) morph(c1, 'Which one is real?', 'Same start. Same end.', seg(t, b(36), b(36.6)), 960, y, hs);
      else fall(c1, 'Same start. Same end.', 960, y, seg(t, b(37.4), b(37.8)), hs);
    }
  }
}
