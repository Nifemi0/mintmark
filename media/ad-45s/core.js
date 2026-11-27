// Shared helpers: easing, text layout, magic-move text, digit roll,
// guilloche rosettes, painted marker strokes, image drawing.
export const W = 1920, H = 1080, BPM = 120, BEAT = 60 / BPM;
export const b = (n) => n * BEAT; // beat -> seconds
export const C = {
  ink: '#18221c', dark: '#111a18', paper: '#f8f9f7', white: '#ffffff', lime: '#d8f36b', green: '#597960',
  mint: '#8fc497', pale: '#e7efe8', line: '#dce3db', muted: '#6d786e', warn: '#ff5a36', gold: '#f3ba2f',
};
export const cl = (x, a = 0, z = 1) => Math.min(z, Math.max(a, x));
export const seg = (t, a, z) => cl((t - a) / (z - a));
export const lerp = (a, z, p) => a + (z - a) * p;
export const E = {
  lin: (x) => x,
  inCubic: (x) => x * x * x,
  outCubic: (x) => 1 - Math.pow(1 - x, 3),
  inOutCubic: (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2),
  outQuint: (x) => 1 - Math.pow(1 - x, 5),
  inQuint: (x) => x * x * x * x * x,
  outExpo: (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x)),
  inExpo: (x) => (x <= 0 ? 0 : Math.pow(2, 10 * x - 10)),
  inOutExpo: (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2),
  inOutQuint: (x) => (x < 0.5 ? 16 * x ** 5 : 1 - Math.pow(-2 * x + 2, 5) / 2),
  outBack: (x, s = 1.70158) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2),
  inBack: (x, s = 1.70158) => (s + 1) * x * x * x - s * x * x,
};
// spring-ish settle used for punchy entrances
export const settle = (x) => (x >= 1 ? 1 : 1 - Math.exp(-6.5 * x) * Math.cos(9 * x));

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
// smooth 1D value noise
export function noise1(x, seed = 0) {
  const h = (i) => { const s = Math.sin((i + seed * 71.3) * 127.1) * 43758.5453; return s - Math.floor(s); };
  const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
  return lerp(h(i), h(i + 1), u) * 2 - 1;
}

/* ---------------- text ---------------- */
export const FONTS = { d: 'Space Grotesk', s: 'DM Sans', m: 'DM Mono' };
export function setFont(ctx, st) {
  ctx.font = `${st.w ?? 700} ${st.size}px '${FONTS[st.f ?? 'd']}'`;
  ctx.letterSpacing = `${(st.ls ?? -0.045) * st.size}px`;
}
const layoutCache = new Map();
export function layout(ctx, str, st) {
  const key = `${str}|${st.size}|${st.w}|${st.f}|${st.ls}`;
  if (layoutCache.has(key)) return layoutCache.get(key);
  setFont(ctx, st);
  const ls = (st.ls ?? -0.045) * st.size;
  const xs = [];
  for (let i = 0; i < str.length; i++) xs.push(i === 0 ? 0 : ctx.measureText(str.slice(0, i)).width);
  const width = ctx.measureText(str).width - ls;
  const out = { xs, width, chars: [...str] };
  layoutCache.set(key, out);
  return out;
}
// Draw a string; align: 'center' | 'left' | 'right'. y is the baseline.
export function text(ctx, str, x, y, st = {}) {
  st = { size: 120, w: 700, f: 'd', ls: -0.045, col: C.ink, align: 'center', ...st };
  const L = layout(ctx, str, st);
  const x0 = st.align === 'center' ? x - L.width / 2 : st.align === 'right' ? x - L.width : x;
  setFont(ctx, st);
  ctx.fillStyle = st.col;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(str, x0, y);
  return { x0, width: L.width };
}
// Per-character reveal: each char rises out of a clip line, staggered.
export function rise(ctx, str, x, y, p, st = {}, stagger = 0.035, dur = 0.5) {
  st = { size: 120, w: 700, f: 'd', ls: -0.045, col: C.ink, align: 'center', ...st };
  const L = layout(ctx, str, st);
  const x0 = st.align === 'center' ? x - L.width / 2 : st.align === 'right' ? x - L.width : x;
  setFont(ctx, st); ctx.fillStyle = st.col; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const n = L.chars.length, total = dur + stagger * (n - 1);
  ctx.save();
  ctx.beginPath(); ctx.rect(x0 - st.size, y - st.size * 1.05, L.width + st.size * 2, st.size * 1.38); ctx.clip();
  for (let i = 0; i < n; i++) {
    const q = E.outQuint(cl((p * total - i * stagger) / dur));
    if (q <= 0) continue;
    ctx.fillText(L.chars[i], x0 + L.xs[i], y + (1 - q) * st.size * 1.1);
  }
  ctx.restore();
  return { x0, width: L.width };
}
// Exit: chars drop out of the clip line.
export function fall(ctx, str, x, y, p, st = {}, stagger = 0.02, dur = 0.4) {
  st = { size: 120, w: 700, f: 'd', ls: -0.045, col: C.ink, align: 'center', ...st };
  const L = layout(ctx, str, st);
  const x0 = st.align === 'center' ? x - L.width / 2 : st.align === 'right' ? x - L.width : x;
  setFont(ctx, st); ctx.fillStyle = st.col; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const n = L.chars.length, total = dur + stagger * (n - 1);
  ctx.save();
  ctx.beginPath(); ctx.rect(x0 - st.size, y - st.size * 1.05, L.width + st.size * 2, st.size * 1.38); ctx.clip();
  for (let i = 0; i < n; i++) {
    const q = E.inCubic(cl((p * total - i * stagger) / dur));
    ctx.fillText(L.chars[i], x0 + L.xs[i], y - q * st.size * 1.1);
  }
  ctx.restore();
}

function lcs(a, b) {
  const n = a.length, m = b.length, dp = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    dp[i][j] = a[i] === b[j] && a[i] !== ' ' ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const pairs = []; let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j] && a[i] !== ' ' && dp[i][j] === dp[i + 1][j + 1] + 1) { pairs.push([i, j]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++; else j++;
  }
  return pairs;
}
// Magic-move text morph: shared letters glide to their new place,
// the rest leave/arrive with a short vertical slide + blur.
export function morph(ctx, A, Bs, p, x, y, st = {}, stB = null) {
  st = { size: 120, w: 700, f: 'd', ls: -0.045, col: C.ink, align: 'center', ...st };
  stB = stB ? { ...st, ...stB } : st;
  if (p <= 0) return text(ctx, A, x, y, st);
  if (p >= 1) return text(ctx, Bs, x, y, stB);
  const La = layout(ctx, A, st), Lb = layout(ctx, Bs, stB);
  const xa = st.align === 'center' ? x - La.width / 2 : st.align === 'right' ? x - La.width : x;
  const xb = stB.align === 'center' ? x - Lb.width / 2 : stB.align === 'right' ? x - Lb.width : x;
  const pairs = lcs(A, Bs);
  const mA = new Set(pairs.map((q) => q[0])), mB = new Set(pairs.map((q) => q[1]));
  const sizeNow = lerp(st.size, stB.size, E.inOutCubic(p));
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const draw = (ch, px, py, alpha, blur, size, col, w) => {
    if (alpha <= 0.002) return;
    ctx.save();
    ctx.globalAlpha *= alpha;
    if (blur > 0.3) ctx.filter = `blur(${blur.toFixed(1)}px)`;
    ctx.font = `${w} ${size}px '${FONTS[st.f]}'`;
    ctx.fillStyle = col;
    ctx.fillText(ch, px, py);
    ctx.restore();
  };
  const nOut = La.chars.length, nIn = Lb.chars.length;
  // leaving letters
  for (let i = 0; i < nOut; i++) {
    if (mA.has(i) || A[i] === ' ') continue;
    const q = E.inCubic(cl((p - (i / nOut) * 0.25) / 0.45));
    draw(A[i], xa + La.xs[i], y - q * st.size * 0.45, 1 - q, q * 14, st.size, st.col, st.w);
  }
  // shared letters
  const pm = E.inOutQuint(cl((p - 0.08) / 0.84));
  for (const [i, j] of pairs) {
    const px = lerp(xa + La.xs[i], xb + Lb.xs[j], pm);
    const s = lerp(st.size, stB.size, pm);
    draw(A[i], px, y, 1, 0, s, pm < 0.5 ? st.col : stB.col, pm < 0.5 ? st.w : stB.w);
  }
  // arriving letters
  for (let j = 0; j < nIn; j++) {
    if (mB.has(j) || Bs[j] === ' ') continue;
    const q = E.outQuint(cl((p - 0.38 - (j / nIn) * 0.25) / 0.45));
    draw(Bs[j], xb + Lb.xs[j], y + (1 - q) * stB.size * 0.45, q, (1 - q) * 14, stB.size, stB.col, stB.w);
  }
  void sizeNow;
}

// Odometer digit roll from string a to b (same length, digits roll, others swap).
export function roll(ctx, a, z, p, x, y, st = {}, spins = 1) {
  st = { size: 300, w: 700, f: 'd', ls: -0.04, col: C.ink, align: 'center', ...st };
  const L = layout(ctx, z, st);
  const x0 = st.align === 'center' ? x - L.width / 2 : st.align === 'right' ? x - L.width : x;
  setFont(ctx, st); ctx.fillStyle = st.col; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const lh = st.size * 1.3;
  ctx.save();
  ctx.beginPath(); ctx.rect(x0 - 40, y - st.size * 0.86, L.width + 80, st.size * 1.02); ctx.clip();
  for (let i = 0; i < z.length; i++) {
    const da = +a[i], dz = +z[i];
    if (Number.isNaN(da) || Number.isNaN(dz)) { ctx.fillText(z[i], x0 + L.xs[i], y); continue; }
    // stagger: leftmost digits land first
    const q = E.inOutQuint(cl((p - i * 0.07) / (1 - (z.length - 1) * 0.07)));
    let steps = ((dz - da + 10) % 10) + 10 * (da === dz ? spins : spins);
    if (a === z) steps = 0;
    const v = q * steps;
    const k = Math.floor(v), f = v - k;
    const d0 = (da + k) % 10, d1 = (da + k + 1) % 10;
    const speed = Math.abs(Math.sin(Math.PI * q));
    const dx = x0 + L.xs[i];
    if (speed > 0.3) {
      ctx.save(); ctx.globalAlpha *= 0.25 * speed;
      ctx.fillText(String(d0), dx, y - f * lh + lh * 0.12);
      ctx.fillText(String(d1), dx, y - f * lh + lh * 1.12);
      ctx.restore();
    }
    ctx.fillText(String(d0), dx, y - f * lh);
    ctx.fillText(String(d1), dx, y - f * lh + lh);
  }
  ctx.restore();
  return { x0, width: L.width };
}

/* ---------------- guilloche ---------------- */
// Banknote rosette: L phase-shifted wave rings. prog draws them on.
export function rosettePts(R, o, k, N = 720) {
  const { n = 9, A = 0.16, m = 4, Bm = 0.05, L = 20, spread = 1, merge = 0 } = o;
  const ph = (1 - merge) * (k / L) * Math.PI * 2 * spread;
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const th = (i / N) * Math.PI * 2;
    const r = R * (1 + (A * Math.sin(n * th + ph) + Bm * Math.sin(m * th - ph * 2)) * (o.amp ?? 1));
    pts.push([Math.cos(th) * r, Math.sin(th) * r]);
  }
  return pts;
}
export function rosette(ctx, cx, cy, R, o = {}) {
  const { L = 20, prog = 1, rot = 0, col = C.ink, lw = 1.5, alpha = 1, N = 720 } = o;
  if (prog <= 0 || alpha <= 0) return;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const lim = Math.floor(N * prog);
  for (let k = 0; k < L; k++) {
    const pts = rosettePts(R, o, k, N);
    ctx.beginPath();
    for (let i = 0; i <= lim; i++) {
      // each ring starts at its own angle so the draw-on reads as a spin
      const ii = (i + Math.floor((k / L) * N * 0.0)) % (N + 1);
      const [x, y] = pts[ii];
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/* ---------------- painted strokes ---------------- */
function polyLen(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return L; }
function partial(pts, p) {
  if (p >= 1) return pts;
  const total = polyLen(pts), want = total * p, out = [pts[0]];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    if (acc + d >= want) { const f = (want - acc) / d; out.push([lerp(pts[i - 1][0], pts[i][0], f), lerp(pts[i - 1][1], pts[i][1], f)]); return out; }
    acc += d; out.push(pts[i]);
  }
  return out;
}
// Marker/brush stroke: a few slightly offset passes give a painted edge.
export function paint(ctx, pts, p, o = {}) {
  const { col = C.lime, w = 18, alpha = 1, blend = 'source-over', seed = 1, rough = 1, taper = false } = o;
  if (p <= 0 || alpha <= 0) return;
  const P = partial(pts, cl(p));
  if (P.length < 2) return;
  ctx.save();
  ctx.globalCompositeOperation = blend;
  ctx.globalAlpha *= alpha;
  ctx.strokeStyle = col; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const passes = [[0, 0, 1, 1], [0.9, -0.7, 0.82, 0.55], [-0.8, 0.9, 0.76, 0.5]];
  for (const [ox, oy, ws, a] of passes) {
    ctx.globalAlpha = alpha * a;
    ctx.lineWidth = w * ws;
    ctx.beginPath();
    P.forEach(([x, y], i) => {
      const j = rough * w * 0.12;
      const nx = x + ox * j + noise1(i * 0.31, seed + ox) * j * 0.6;
      const ny = y + oy * j + noise1(i * 0.29, seed + 7 + oy) * j * 0.6;
      if (i === 0) ctx.moveTo(nx, ny); else ctx.lineTo(nx, ny);
    });
    ctx.stroke();
  }
  if (taper) { /* reserved */ }
  ctx.restore();
}
// Hand-drawn loop around an ellipse, overshooting its start.
export function loopPts(cx, cy, rx, ry, seed = 3, turns = 1.12, start = -2.6, tilt = -0.06) {
  const r = rng(seed), pts = [], N = 90;
  const wob = [r() * 6, r() * 6];
  for (let i = 0; i <= N; i++) {
    const a = start + (i / N) * Math.PI * 2 * turns;
    const k = 1 + 0.06 * Math.sin(a * 2 + wob[0]) + (i / N) * 0.07;
    const x = Math.cos(a) * rx * k, y = Math.sin(a) * ry * k;
    pts.push([cx + x * Math.cos(tilt) - y * Math.sin(tilt), cy + x * Math.sin(tilt) + y * Math.cos(tilt)]);
  }
  return pts;
}
export function linePts(x0, y0, x1, y1, bow = 0, N = 30) {
  const pts = [];
  for (let i = 0; i <= N; i++) {
    const f = i / N, s = Math.sin(f * Math.PI) * bow;
    const nx = -(y1 - y0), ny = x1 - x0, l = Math.hypot(nx, ny) || 1;
    pts.push([lerp(x0, x1, f) + (nx / l) * s, lerp(y0, y1, f) + (ny / l) * s]);
  }
  return pts;
}
export function arrowPts(x0, y0, x1, y1, bow = 30, head = 40) {
  const body = linePts(x0, y0, x1, y1, bow);
  const [ax, ay] = body[body.length - 2];
  const ang = Math.atan2(y1 - ay, x1 - ax);
  const h1 = [x1 - Math.cos(ang - 0.5) * head, y1 - Math.sin(ang - 0.5) * head];
  const h2 = [x1 - Math.cos(ang + 0.5) * head, y1 - Math.sin(ang + 0.5) * head];
  return { body, head: [h1, [x1, y1], h2] };
}
export function crossPts(cx, cy, s) {
  return [linePts(cx - s, cy - s, cx + s, cy + s, 8), linePts(cx + s, cy - s * 1.05, cx - s * 0.95, cy + s, -10)];
}

/* ---------------- images ---------------- */
export function img(ctx, im, cx, cy, w, h, o = {}) {
  const { rot = 0, alpha = 1, blend = 'multiply', radius = 0, zoom = 1, fx = 0.5, fy = 0.5, clipCircle = 0, shadow = 0 } = o;
  if (alpha <= 0 || w <= 0 || h <= 0) return;
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.globalAlpha *= alpha;
  if (shadow) {
    ctx.save();
    ctx.shadowColor = `rgba(17,26,24,${0.18 * shadow})`; ctx.shadowBlur = 60; ctx.shadowOffsetY = 26;
    ctx.fillStyle = C.white; rr(ctx, -w / 2, -h / 2, w, h, radius); ctx.fill();
    ctx.restore();
  }
  ctx.beginPath();
  if (clipCircle) ctx.arc(0, 0, clipCircle, 0, Math.PI * 2); else rr(ctx, -w / 2, -h / 2, w, h, radius);
  ctx.clip();
  // cover-fit with zoom around focal point
  const s = Math.max(w / im.width, h / im.height) * zoom;
  const dw = im.width * s, dh = im.height * s;
  const dx = cl(-dw * fx, w / 2 - dw, -w / 2), dy = cl(-dh * fy, h / 2 - dh, -h / 2);
  ctx.globalCompositeOperation = shadow ? 'source-over' : blend;
  ctx.drawImage(im, dx, dy, dw, dh);
  ctx.restore();
}
export function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
