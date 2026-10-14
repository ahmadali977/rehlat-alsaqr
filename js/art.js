// Hand-built art pieces shared by the worlds: rocks/asteroids, launch pads, Najdi buildings, oasis, falcons, satellite debris.
import * as THREE from 'three';
import { gfx, mat } from './gfx.js';
import { makeNoise, mulberry } from './noise.js';

const S = THREE.MathUtils.smoothstep;

// ---------------------------------------------------------------- rocks & asteroids
// Cratered, lumpy rock with baked cavity shading. Geometry is cached per (seed, style) so many rocks stay cheap.
const rockCache = new Map();
export function rockGeometry(seed, { detail = 3, rough = 0.32, squash = 1, craters = 3, colA = '#8d8378', colB = '#5c534c', colC = '#b8ab9c' } = {}) {
  const key = [seed, detail, rough, squash, craters, colA, colB, colC].join('|');
  if (rockCache.has(key)) return rockCache.get(key);
  const nz = makeNoise(seed * 31 + 7), rnd = mulberry(seed * 977 + 3);
  const geo = new THREE.IcosahedronGeometry(1, detail);
  const pos = geo.attributes.position, n = pos.count, d = new THREE.Vector3();
  const cr = Array.from({ length: craters }, () => ({ dir: new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize(), r: 0.35 + rnd() * 0.35, depth: 0.1 + rnd() * 0.1 }));
  const A = new THREE.Color(colA), B = new THREE.Color(colB), C = new THREE.Color(colC), c = new THREE.Color();
  const colors = new Float32Array(n * 3);
  const cache = new Map();
  for (let i = 0; i < n; i++) {
    d.fromBufferAttribute(pos, i).normalize();
    const k = (d.x * 1e4 | 0) + ',' + (d.y * 1e4 | 0) + ',' + (d.z * 1e4 | 0);
    let rec = cache.get(k);
    if (!rec) {
      let h = 1 + nz.fbm(d.x * 1.4 + seed, d.y * 1.4, d.z * 1.4, 4) * rough + nz.fbm(d.x * 5, d.y * 5, d.z * 5, 2) * rough * 0.25;
      let cav = 0;
      for (const q of cr) {
        const x = d.angleTo(q.dir) / q.r;
        if (x < 1) { h -= q.depth * (1 - x * x); cav += (1 - x) * 0.9; }
        else if (x < 1.35) h += q.depth * 0.35 * (1 - (x - 1) / 0.35);
      }
      const t = THREE.MathUtils.clamp((h - 0.75) / 0.5, 0, 1);
      c.copy(B).lerp(A, t).lerp(C, Math.max(0, nz.n3(d.x * 9, d.y * 9, d.z * 9)) * 0.45);
      c.multiplyScalar(1 - Math.min(0.35, cav * 0.3));
      rec = [h, c.r, c.g, c.b]; cache.set(k, rec);
    }
    pos.setXYZ(i, d.x * rec[0], d.y * rec[0] * squash, d.z * rec[0]);
    colors.set([rec[1], rec[2], rec[3]], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  rockCache.set(key, geo);
  return geo;
}

const rockMats = new Map();
export function rockMaterial(flat = true) {
  const k = flat ? 'f' : 's';
  if (!rockMats.has(k)) rockMats.set(k, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, flatShading: flat, envMap: gfx.envMap, envMapIntensity: 0.25 }));
  return rockMats.get(k);
}

export function makeRock(seed, size = 1, opts = {}) {
  const m = new THREE.Mesh(rockGeometry(seed % 12, opts), rockMaterial(opts.flat !== false));
  m.scale.setScalar(size); m.castShadow = true; m.receiveShadow = true;
  return m;
}

// Palettes for rocks on each world
export const ROCK_PALETTES = {
  earth: { colA: '#d9a066', colB: '#a8693c', colC: '#f0c890' },
  mercury: { colA: '#a39585', colB: '#5f564f', colC: '#c9bcad' },
  venus: { colA: '#9a5a34', colB: '#4f2a1c', colC: '#c97a45' },
  mars: { colA: '#b5522c', colB: '#6b2a17', colC: '#d9784a' },
  space: { colA: '#8f8174', colB: '#4a423d', colC: '#b3a597' },
  ice: { colA: '#cfe6f5', colB: '#7fa6c4', colC: '#ffffff' },
};

// ---------------------------------------------------------------- launch / landing pad
export function padTexture(label, accent) {
  const c = document.createElement('canvas'); c.width = c.height = 1024; const g = c.getContext('2d');
  const cx = 512, cy = 512;
  // concrete with subtle speckle
  g.fillStyle = '#c9ccd4'; g.beginPath(); g.arc(cx, cy, 512, 0, 7); g.fill();
  const rnd = mulberry(5);
  for (let i = 0; i < 2600; i++) { const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 500; g.fillStyle = `rgba(${rnd() < 0.5 ? '60,64,80' : '255,255,255'},${0.05 + rnd() * 0.06})`; g.fillRect(cx + Math.cos(a) * r, cy + Math.sin(a) * r, 3, 3); }
  // panel seams
  g.strokeStyle = 'rgba(70,74,92,.35)'; g.lineWidth = 4;
  for (const r of [250, 390]) { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); }
  for (let i = 0; i < 12; i++) { const a = i / 12 * 6.283; g.beginPath(); g.moveTo(cx + Math.cos(a) * 250, cy + Math.sin(a) * 250); g.lineTo(cx + Math.cos(a) * 500, cy + Math.sin(a) * 500); g.stroke(); }
  // hazard ring (yellow / dark chevrons)
  const r0 = 430, r1 = 492;
  for (let i = 0; i < 48; i++) {
    const a0 = i / 48 * 6.283, a1 = (i + 1) / 48 * 6.283;
    g.fillStyle = i % 2 ? '#2b2f3f' : '#ffc83d';
    g.beginPath(); g.arc(cx, cy, r1, a0, a1); g.arc(cx, cy, r0, a1, a0, true); g.closePath(); g.fill();
  }
  g.lineWidth = 8; g.strokeStyle = '#2b2f3f'; for (const r of [r0, r1]) { g.beginPath(); g.arc(cx, cy, r, 0, 7); g.stroke(); }
  // landing ring in the world's accent
  g.strokeStyle = accent; g.lineWidth = 26; g.beginPath(); g.arc(cx, cy, 330, 0, 7); g.stroke();
  g.strokeStyle = '#ffffff'; g.lineWidth = 10;
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; g.beginPath(); g.arc(cx, cy, 290, a + 0.06, a + 0.3); g.stroke(); }
  // centre medallion with the label
  g.fillStyle = accent; g.beginPath(); g.arc(cx, cy, 200, 0, 7); g.fill();
  g.strokeStyle = '#f2c14e'; g.lineWidth = 14; g.beginPath(); g.arc(cx, cy, 200, 0, 7); g.stroke();
  g.fillStyle = '#ffffff'; g.font = '150px Lalezar'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.fillText(label, cx, cy + 12);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// A round pad with a concrete foundation, metal rim and lamps. Origin at the ground; userData.top = deck height.
export function makePad({ radius = 1.6, label = 'الصقر', accent = '#12a150', lampColor = 0xfff1b0 } = {}) {
  const g = new THREE.Group();
  const H = 0.24;
  const found = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.12, radius * 1.22, 0.5, 64), mat('#8f8a86', { rough: 0.95, envI: 0.2 }));
  found.position.y = -0.18; g.add(found);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.04, H, 64), mat('#aeb3bf', { rough: 0.7, envI: 0.4 }));
  body.position.y = H / 2; g.add(body);
  const top = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.985, 96), new THREE.MeshStandardMaterial({ map: padTexture(label, accent), roughness: 0.75, envMap: gfx.envMap, envMapIntensity: 0.3 }));
  top.rotation.x = -Math.PI / 2; top.position.y = H + 0.002; g.add(top);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.005, 0.045, 10, 96), mat('#d6dae4', { rough: 0.3, metal: 0.8, envI: 1 }));
  rim.rotation.x = Math.PI / 2; rim.position.y = H; g.add(rim);
  // lamps around the edge
  const lampMat = new THREE.MeshStandardMaterial({ color: lampColor, emissive: lampColor, emissiveIntensity: 2.2, roughness: 0.3 });
  const postMat = mat('#4a5064', { rough: 0.4, metal: 0.6 });
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * Math.PI * 2 + Math.PI / 8;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.22, 10), postMat);
    post.position.set(Math.cos(a) * radius * 1.07, H + 0.02, Math.sin(a) * radius * 1.07); g.add(post);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 14, 10), lampMat);
    lamp.position.set(post.position.x, H + 0.15, post.position.z); g.add(lamp);
    const halo = glowSprite(lampColor, 0.42, 0.55); halo.position.copy(lamp.position); g.add(halo);
  }
  g.traverse(o => { if (o.isMesh) { o.castShadow = o !== top; o.receiveShadow = true; } });
  g.userData.top = H;
  return g;
}

// ---------------------------------------------------------------- Najdi mud-brick architecture
const MUD = '#c99a68', MUD_D = '#a87a4e', WOOD = '#6b4a2e', DARK = '#3b2a20';
function crenels(g, w, d, y, step = 0.14, size = 0.11) {
  const m = mat(MUD, { rough: 0.95, envI: 0.15 });
  const geo = new THREE.ConeGeometry(size * 0.75, size * 1.25, 4); geo.rotateY(Math.PI / 4);
  const put = (x, z) => { const c = new THREE.Mesh(geo, m); c.position.set(x, y + size * 0.6, z); g.add(c); };
  for (let x = -w / 2 + step / 2; x <= w / 2; x += step) { put(x, -d / 2); put(x, d / 2); }
  for (let z = -d / 2 + step * 1.5; z <= d / 2 - step; z += step) { put(-w / 2, z); put(w / 2, z); }
}
function tri(g, x, y, z, ry, s = 0.07) { // small triangular window
  const shp = new THREE.Shape(); shp.moveTo(-s, 0); shp.lineTo(s, 0); shp.lineTo(0, s * 1.4); shp.closePath();
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shp), mat(DARK, { rough: 1 })); m.position.set(x, y, z); m.rotation.y = ry; g.add(m);
}
export function najdiHouse(w = 1.0, d = 0.8, h = 0.55, seed = 1) {
  const g = new THREE.Group(); const rnd = mulberry(seed);
  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(MUD, { rough: 0.95, envI: 0.15 })); body.position.y = h / 2; g.add(body);
  const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.05, d + 0.02), mat(MUD_D, { rough: 1 })); band.position.y = h - 0.06; g.add(band);
  crenels(g, w, d, h);
  // door + windows on the front (+Z)
  const door = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.3), mat(WOOD, { rough: 0.8 })); door.position.set((rnd() - 0.5) * w * 0.5, 0.15, d / 2 + 0.003); g.add(door);
  tri(g, -w * 0.3, h * 0.62, d / 2 + 0.004, 0); tri(g, w * 0.3, h * 0.62, d / 2 + 0.004, 0);
  // wooden water spouts (mizrab)
  for (const x of [-w * 0.42, w * 0.42]) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.18, 6), mat(WOOD)); sp.rotation.x = Math.PI / 2; sp.position.set(x, h - 0.1, d / 2 + 0.08); g.add(sp); }
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
export function najdiTower(r = 0.32, h = 1.5) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.82, r, h, 4, 1), mat(MUD, { rough: 0.95, envI: 0.15 }));
  body.rotation.y = Math.PI / 4; body.position.y = h / 2; g.add(body);
  for (const y of [h * 0.35, h * 0.68]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.86, r * 0.88, 0.05, 4), mat(MUD_D, { rough: 1 })); b.rotation.y = Math.PI / 4; b.position.y = y; g.add(b); }
  crenels(g, r * 1.15, r * 1.15, h, 0.12, 0.1);
  for (const a of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) tri(g, Math.sin(a) * r * 0.83, h * 0.78, Math.cos(a) * r * 0.83, a, 0.05);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}

// ---------------------------------------------------------------- oasis pond
export function oasis(r = 0.9) {
  const g = new THREE.Group();
  const shore = new THREE.Mesh(new THREE.CircleGeometry(r * 1.25, 40), mat('#d8b778', { rough: 1 })); shore.rotation.x = -Math.PI / 2; shore.position.y = 0.01; g.add(shore);
  const wc = document.createElement('canvas'); wc.width = wc.height = 128; const wx = wc.getContext('2d'); const wg = wx.createRadialGradient(64, 64, 8, 64, 64, 64); wg.addColorStop(0, '#0f6f9a'); wg.addColorStop(0.7, '#25a6c9'); wg.addColorStop(0.92, '#7fe0e6'); wg.addColorStop(1, '#bfeee6'); wx.fillStyle = wg; wx.fillRect(0, 0, 128, 128);
  const wt = new THREE.CanvasTexture(wc); wt.colorSpace = THREE.SRGBColorSpace;
  const water = new THREE.Mesh(new THREE.CircleGeometry(r, 48), new THREE.MeshStandardMaterial({ map: wt, roughness: 0.06, metalness: 0.15, envMap: gfx.envMap, envMapIntensity: 1.3 }));
  water.rotation.x = -Math.PI / 2; water.position.y = 0.03; g.add(water);
  const reedM = mat('#5c9a3c', { rough: 0.8 });
  for (let i = 0; i < 14; i++) { const a = i / 14 * 6.283 + (i % 3) * 0.2; const reed = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.42 + (i % 4) * 0.08, 5), reedM); reed.position.set(Math.cos(a) * r * 1.02, 0.2, Math.sin(a) * r * 1.02); reed.rotation.z = (i % 2 ? 1 : -1) * 0.15; g.add(reed); }
  g.traverse(o => { if (o.isMesh) { o.receiveShadow = true; } });
  g.userData.water = water;
  return g;
}

// ---------------------------------------------------------------- falcon (gliding bird with flapping wings)
export function falcon(scale = 1) {
  const g = new THREE.Group();
  const brown = mat('#7a5233', { rough: 0.8 }), light = mat('#e9d6b8', { rough: 0.8 }), dark = mat('#3a2a1e', { rough: 0.7 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 14, 10), brown); body.scale.set(1, 0.8, 2.1); g.add(body);
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.1, 12, 8), light); chest.scale.set(0.9, 0.7, 1.6); chest.position.set(0, -0.03, 0.05); g.add(chest);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.085, 12, 10), brown); head.position.set(0, 0.04, 0.27); g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.08, 6), mat('#f2b632')); beak.rotation.x = Math.PI / 2; beak.position.set(0, 0.02, 0.36); g.add(beak);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 4), dark); tail.rotation.x = -Math.PI / 2; tail.scale.set(1.4, 0.3, 1); tail.position.set(0, 0, -0.3); g.add(tail);
  const wingShape = new THREE.Shape(); wingShape.moveTo(0, 0.07); wingShape.quadraticCurveTo(0.35, 0.12, 0.62, -0.02); wingShape.lineTo(0.42, -0.08); wingShape.quadraticCurveTo(0.2, -0.12, 0, -0.07);
  const wingGeo = new THREE.ShapeGeometry(wingShape); wingGeo.rotateX(-Math.PI / 2);
  const wings = [];
  for (const s of [1, -1]) {
    const piv = new THREE.Group(); piv.position.set(s * 0.06, 0.03, 0.02); g.add(piv);
    const w = new THREE.Mesh(wingGeo, new THREE.MeshStandardMaterial({ color: 0x6b4a2e, roughness: 0.8, side: THREE.DoubleSide })); w.scale.x = s; piv.add(w);
    wings.push(piv);
  }
  g.scale.setScalar(scale);
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  // glide with raised wings (a V seen from the side), flapping in bursts
  g.userData.flap = t => { const f = 0.32 + Math.sin(t * 9) * 0.5 * (0.35 + 0.65 * Math.max(0, Math.sin(t * 0.7))); wings[0].rotation.z = f; wings[1].rotation.z = -f; };
  return g;
}

// ---------------------------------------------------------------- broken satellite (space debris obstacle)
export function brokenSatellite() {
  const g = new THREE.Group();
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.35, metalness: 0.9, envMap: gfx.envMap, envMapIntensity: 1.2 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.55), gold); g.add(body);
  const dish = new THREE.Mesh(new THREE.SphereGeometry(0.35, 20, 10, 0, Math.PI * 2, 0, 0.9), mat('#e8ecf2', { rough: 0.3, metal: 0.4, side: THREE.DoubleSide }));
  dish.rotation.z = Math.PI / 2; dish.position.x = 0.55; g.add(dish);
  const c = document.createElement('canvas'); c.width = 128; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = '#1d3f8f'; x.fillRect(0, 0, 128, 256); x.strokeStyle = '#7fb0ff'; x.lineWidth = 3;
  for (let i = 0; i <= 4; i++) { x.beginPath(); x.moveTo(i * 32, 0); x.lineTo(i * 32, 256); x.stroke(); }
  for (let i = 0; i <= 8; i++) { x.beginPath(); x.moveTo(0, i * 32); x.lineTo(128, i * 32); x.stroke(); }
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const panelM = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25, metalness: 0.6, envMap: gfx.envMap, envMapIntensity: 1.3, side: THREE.DoubleSide });
  const p1 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 1.1), panelM); p1.position.set(0, 0, 0.9); p1.rotation.x = -Math.PI / 2; g.add(p1);
  const p2 = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.7), panelM); p2.position.set(0.15, -0.2, -0.75); p2.rotation.set(-Math.PI / 2 + 0.6, 0.3, 0.4); g.add(p2); // the broken one
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6), mat('#9aa3b5', { metal: 0.6, rough: 0.4 })); arm.rotation.x = Math.PI / 2; arm.position.z = 0.42; g.add(arm);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), mat('#9aa3b5', { metal: 0.6 })); ant.position.set(-0.2, 0.45, 0); ant.rotation.z = 0.4; g.add(ant);
  return g;
}

// soft additive glow sprite (for pickups, lamps, suns)
let _glowTex = null;
export function glowSprite(color = 0xfff1b0, size = 1, opacity = 0.8) {
  if (!_glowTex) {
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = gr; x.fillRect(0, 0, 128, 128); _glowTex = new THREE.CanvasTexture(c);
  }
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: _glowTex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size);
  return s;
}
