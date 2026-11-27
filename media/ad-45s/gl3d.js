// three.js layer: ticker-tape ribbons and issuer cards.
import * as THREE from './lib/three.module.js';
import { C } from './core.js';

export const canvas = document.getElementById('gl');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(1920, 1080, false);
renderer.setClearColor(0x000000, 0);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.NoToneMapping;

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(30, 1920 / 1080, 0.1, 200);
camera.position.set(0, 0, 10);
const amb = new THREE.AmbientLight(0xffffff, 1.9);
const key = new THREE.DirectionalLight(0xffffff, 1.6);
key.position.set(-3, 5, 8);
scene.add(amb, key);

// screen px -> world at z=0 for the default camera
export const VIS_H = 2 * 10 * Math.tan((15 * Math.PI) / 180), VIS_W = VIS_H * (1920 / 1080);
export const px2w = (x, y) => new THREE.Vector3((x / 1920 - 0.5) * VIS_W, -(y / 1080 - 0.5) * VIS_H, 0);

export function textTexture(draw, w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export class Ribbon {
  constructor({ width = 0.5, segs = 700, tex, texLen = 12, color = 0xffffff }) {
    this.width = width; this.segs = segs; this.texLen = texLen;
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array((segs + 1) * 2 * 3);
    this.uv = new Float32Array((segs + 1) * 2 * 2);
    const idx = [];
    for (let i = 0; i < segs; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    g.setIndex(idx);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2));
    tex.wrapS = THREE.RepeatWrapping;
    this.mat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.85, metalness: 0, color, transparent: true });
    this.mat.side = THREE.FrontSide;
    // back face gets a horizontally flipped print so text never reads mirrored
    const backTex = tex.clone(); backTex.wrapS = THREE.RepeatWrapping; backTex.repeat.x = -1; backTex.needsUpdate = true;
    this.backMat = new THREE.MeshStandardMaterial({ map: backTex, side: THREE.BackSide, roughness: 0.85, metalness: 0, color, transparent: true });
    this.mesh = new THREE.Group();
    const f = new THREE.Mesh(g, this.mat), bk = new THREE.Mesh(g, this.backMat);
    f.frustumCulled = false; bk.frustumCulled = false;
    this.mesh.add(f, bk);
    this.mesh.material = this.mat;
    this.geo = g;
    scene.add(this.mesh);
  }
  // path(u) -> Vector3 for u in [u0,u1] world units; twist(u) radians; flow shifts the print.
  update(path, u0, u1, twist = () => 0, flow = 0, upHint = new THREE.Vector3(0, 0, 1)) {
    const n = this.segs, T = new THREE.Vector3(), Wd = new THREE.Vector3(), q = new THREE.Quaternion();
    for (let i = 0; i <= n; i++) {
      const u = u0 + ((u1 - u0) * i) / n;
      const p = path(u), p2 = path(u + 0.01);
      T.subVectors(p2, p).normalize();
      Wd.crossVectors(T, upHint).normalize();
      if (Wd.lengthSq() < 1e-6) Wd.set(0, 1, 0);
      q.setFromAxisAngle(T, twist(u));
      Wd.applyQuaternion(q).multiplyScalar(this.width / 2);
      const k = i * 6;
      this.pos[k] = p.x + Wd.x; this.pos[k + 1] = p.y + Wd.y; this.pos[k + 2] = p.z + Wd.z;
      this.pos[k + 3] = p.x - Wd.x; this.pos[k + 4] = p.y - Wd.y; this.pos[k + 5] = p.z - Wd.z;
      const uu = -(u - flow) / this.texLen;
      this.uv[i * 4] = uu; this.uv[i * 4 + 1] = 1; this.uv[i * 4 + 2] = uu; this.uv[i * 4 + 3] = 0;
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.uv.needsUpdate = true;
    this.geo.computeVertexNormals();
  }
}

export function tapeTexture(items, { bg = '#ffffff', fg = C.ink, accent = C.green, h = 128, font = 'DM Mono', size = 62 } = {}) {
  // measure first
  const m = document.createElement('canvas').getContext('2d');
  m.font = `500 ${size}px '${font}'`;
  const gap = size * 1.6;
  let w = 0; for (const it of items) w += m.measureText(it.t).width + gap;
  w = Math.ceil(w);
  const tex = textTexture((ctx, W, H) => {
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    ctx.font = `500 ${size}px '${font}'`; ctx.textBaseline = 'middle';
    let x = gap / 2;
    for (const it of items) {
      ctx.fillStyle = it.c || fg; ctx.fillText(it.t, x, H / 2 + 3);
      x += ctx.measureText(it.t).width + gap;
      ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(x - gap / 2, H / 2, size * 0.09, 0, Math.PI * 2); ctx.fill();
    }
    // perforation ticks along the edges
    ctx.fillStyle = 'rgba(24,34,28,0.10)';
    for (let i = 0; i < W; i += 18) { ctx.fillRect(i, 6, 8, 3); ctx.fillRect(i, H - 9, 8, 3); }
  }, w, h);
  return { tex, aspect: w / h };
}

export function render() { renderer.render(scene, camera); }
export { THREE };
