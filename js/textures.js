import * as THREE from 'three';
import { makeNoise } from './noise.js';

const cache = new Map();
const W = 512, H = 256;

function paint(fn, seed = 3) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); const img = g.createImageData(W, H); const nz = makeNoise(seed);
  const col = new THREE.Color(); const d = new THREE.Vector3();
  for (let y = 0; y < H; y++) {
    const lat = (0.5 - y / H) * Math.PI;
    for (let x = 0; x < W; x++) {
      const lon = (x / W) * Math.PI * 2;
      d.set(Math.cos(lat) * Math.sin(lon), Math.sin(lat), Math.cos(lat) * Math.cos(lon));
      fn(d, lat, nz, col);
      const i = (y * W + x) * 4;
      img.data[i] = col.r * 255; img.data[i + 1] = col.g * 255; img.data[i + 2] = col.b * 255; img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

function bands(stops, opts = {}) {
  return (d, lat, nz, col) => {
    const turb = nz.fbm(d.x * 3, d.y * 9, d.z * 3, 3) * (opts.turb ?? 0.06);
    let t = (Math.sin(lat) + 1) / 2 + turb;
    t = Math.min(0.999, Math.max(0, t));
    const f = t * (stops.length - 1); const i = Math.floor(f); const k = f - i;
    col.set(stops[i]).lerp(new THREE.Color(stops[Math.min(stops.length - 1, i + 1)]), opts.hard ? (k > 0.5 ? 1 : 0) * 0.3 + k * 0.7 : k);
    if (opts.spot) { const s = opts.spot; const a = d.angleTo(s.dir); if (a < s.r) col.lerp(new THREE.Color(s.color), Math.pow(1 - a / s.r, 0.6)); }
  };
}

export const PLANET_LOOKS = {
  sun: { emissive: true, fn: (d, lat, nz, c) => { const n = nz.fbm(d.x * 6, d.y * 6, d.z * 6, 4); c.set('#ffb330').lerp(new THREE.Color('#fff2a8'), Math.max(0, n * 0.9 + 0.4)); } },
  mercury: { fn: (d, lat, nz, c) => { const n = nz.fbm(d.x * 5, d.y * 5, d.z * 5, 5); c.set('#8f8378').lerp(new THREE.Color('#c9bcae'), n * 0.8 + 0.4); const cr = Math.abs(nz.n3(d.x * 14, d.y * 14, d.z * 14)); if (cr < 0.08) c.multiplyScalar(0.8); } },
  venus: { fn: bands(['#c98a3e', '#e8b464', '#f5d08a', '#e9b867', '#f2cf8f', '#d99a4a', '#c98a3e'], { turb: 0.12 }) },
  earth: { fn: (d, lat, nz, c) => { const n = nz.fbm(d.x * 1.8 + 3, d.y * 1.8, d.z * 1.8, 5); if (n > 0.08) c.set('#5aa548').lerp(new THREE.Color('#d9b26a'), Math.max(0, nz.fbm(d.x * 3, d.y * 3, d.z * 3, 3) + 0.2)); else c.set('#1f6fc4').lerp(new THREE.Color('#3aa6e0'), Math.max(0, n + 0.3) * 2); if (Math.abs(d.y) > 0.88) c.set('#f4fbff'); const cl = nz.fbm(d.x * 4 + 8, d.y * 6, d.z * 4, 4); if (cl > 0.25) c.lerp(new THREE.Color('#ffffff'), Math.min(1, (cl - 0.25) * 3)); } },
  mars: { fn: (d, lat, nz, c) => { const n = nz.fbm(d.x * 3, d.y * 3, d.z * 3, 5); c.set('#b5482a').lerp(new THREE.Color('#e48a52'), n * 0.9 + 0.45); if (Math.abs(d.y) > 0.9) c.set('#fbf3ea'); } },
  jupiter: { fn: bands(['#c9a27c', '#f3e3c6', '#b8794e', '#f5e6cc', '#c48a5c', '#f0dcc0', '#a8704a', '#efdcc0', '#c9a27c'], { turb: 0.05, spot: { dir: new THREE.Vector3(Math.cos(-0.38) * Math.sin(1), Math.sin(-0.38), Math.cos(-0.38) * Math.cos(1)).normalize(), r: 0.2, color: '#c0532e' } }) },
  saturn: { fn: bands(['#cdb27a', '#ecd9a6', '#d9bf86', '#f3e3b8', '#dcc38e', '#efdcaa', '#cdb27a'], { turb: 0.035 }) },
  uranus: { fn: bands(['#9fe3e6', '#b9eef0', '#a8e8ea', '#c4f1f2', '#a5e5e8'], { turb: 0.02 }) },
  neptune: { fn: bands(['#2f5fd6', '#3f7bea', '#2c56c8', '#4a86f0', '#3364d8'], { turb: 0.05, spot: { dir: new THREE.Vector3(0.6, -0.3, 0.74).normalize(), r: 0.14, color: '#1b2f8a' } }) },
};

export function planetTexture(id) {
  if (cache.has(id)) return cache.get(id);
  const t = new THREE.CanvasTexture(paint(PLANET_LOOKS[id].fn, id.length * 13));
  t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  cache.set(id, t); return t;
}

// ready-made sphere with optional rings/atmosphere glow
export function planetMesh(id, radius = 1, { segments = 64 } = {}) {
  const g = new THREE.Group();
  const look = PLANET_LOOKS[id];
  const m = look.emissive
    ? new THREE.MeshBasicMaterial({ map: planetTexture(id), toneMapped: false })
    : new THREE.MeshStandardMaterial({ map: planetTexture(id), roughness: 0.85, metalness: 0 });
  const s = new THREE.Mesh(new THREE.SphereGeometry(radius, segments, segments / 2), m); g.add(s);
  if (id === 'saturn' || id === 'uranus') {
    const ring = new THREE.Mesh(new THREE.RingGeometry(radius * 1.35, radius * (id === 'saturn' ? 2.3 : 1.7), 96, 1), ringMaterial(id));
    fixRingUV(ring.geometry, radius * 1.35, radius * (id === 'saturn' ? 2.3 : 1.7));
    ring.rotation.x = -Math.PI / 2; g.add(ring); g.userData.ring = ring;
    if (id === 'uranus') g.rotation.z = 1.7; // Uranus rolls on its side (~98 degrees)
    else g.rotation.z = 0.47; // Saturn ~27 degrees
  }
  if (!look.emissive) g.add(glowShell(radius, { venus: 0xffd28a, earth: 0x7fc4ff, neptune: 0x6f9bff, uranus: 0xaef3f3 }[id] ?? 0xffffff, id === 'mercury' ? 0.15 : 0.5));
  s.userData.spin = true;
  g.userData.sphere = s;
  return g;
}

function ringMaterial(id) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 8; const x = c.getContext('2d');
  for (let i = 0; i < 512; i++) {
    const t = i / 512; let a, col;
    if (id === 'saturn') { a = (0.55 + 0.45 * Math.sin(t * 60) * Math.sin(t * 13 + 1)) * (t > 0.62 && t < 0.66 ? 0.1 : 1) * (t < 0.04 ? t / 0.04 : 1) * (t > 0.96 ? (1 - t) / 0.04 : 1); col = `rgba(${230 - t * 40},${210 - t * 40},${160 - t * 30},${Math.max(0, a) * 0.9})`; }
    else { a = (Math.sin(t * 40) > 0.85 ? 0.7 : 0.08); col = `rgba(200,240,240,${a})`; }
    x.fillStyle = col; x.fillRect(i, 0, 1, 8);
  }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshStandardMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, roughness: 0.9, depthWrite: false });
}
function fixRingUV(geo, r0, r1) {
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) { const r = Math.hypot(p.getX(i), p.getY(i)); uv.setXY(i, (r - r0) / (r1 - r0), 0.5); }
}

export function glowShell(radius, color, strength = 0.5) {
  return new THREE.Mesh(new THREE.SphereGeometry(radius * 1.08, 48, 32), new THREE.ShaderMaterial({
    uniforms: { c: { value: new THREE.Color(color) }, s: { value: strength } },
    vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vec4 mv = modelViewMatrix*vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 c; uniform float s; varying vec3 vN; varying vec3 vV; void main(){ float f = 1.0 - abs(dot(vN, vV)); gl_FragColor = vec4(c, pow(f, 2.5) * s); }`,
    transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
  }));
}

// soft colourful nebula sprite texture
export function nebulaTexture(color) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const nz = makeNoise(color.length * 7);
  const img = x.createImageData(256, 256); const col = new THREE.Color(color);
  for (let j = 0; j < 256; j++) for (let i = 0; i < 256; i++) {
    const dx = (i - 128) / 128, dy = (j - 128) / 128; const r = Math.hypot(dx, dy);
    const n = nz.fbm(i / 60, j / 60, 0.5, 4) * 0.5 + 0.5;
    const a = Math.max(0, 1 - r) ** 1.8 * n * 1.4;
    const k = (j * 256 + i) * 4; img.data[k] = col.r * 255; img.data[k + 1] = col.g * 255; img.data[k + 2] = col.b * 255; img.data[k + 3] = Math.min(255, a * 255);
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
