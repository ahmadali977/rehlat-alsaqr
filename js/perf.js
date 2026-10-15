// Performance helpers: merge static scenery into a few meshes (fewer draw calls), quality levels for weaker devices.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const _m = new THREE.Matrix4(), _inv = new THREE.Matrix4();

// Two materials that look the same share one key, so cloned model materials end up in one bucket.
function matKey(m) {
  const c = x => (x && x.isColor ? x.getHexString() : '');
  return [m.type, c(m.color), m.map ? m.map.uuid : '', c(m.emissive), m.emissiveIntensity, m.emissiveMap ? m.emissiveMap.uuid : '',
    m.vertexColors, m.flatShading, m.roughness, m.metalness, m.side, m.envMapIntensity, m.customProgramCacheKey ? m.customProgramCacheKey() : ''].join('|');
}

// Copy an attribute as plain float data with a fixed item size (GLB colours can be RGBA / normalized ints).
function floatAttr(attr, size) {
  const n = attr.count, out = new Float32Array(n * size);
  for (let i = 0; i < n; i++) for (let k = 0; k < size; k++) out[i * size + k] = k < attr.itemSize ? attr.getComponent(i, k) : 1;
  return new THREE.BufferAttribute(out, size);
}

function prepare(o, m, toParent) {
  let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', floatAttr(g.attributes.position, 3));
  if (!g.attributes.normal) g.computeVertexNormals();
  out.setAttribute('normal', floatAttr(g.attributes.normal, 3));
  if ((m.map || m.emissiveMap) && g.attributes.uv) out.setAttribute('uv', floatAttr(g.attributes.uv, 2));
  if (m.vertexColors && g.attributes.color) out.setAttribute('color', floatAttr(g.attributes.color, 3));
  g.dispose();
  _m.multiplyMatrices(toParent, o.matrixWorld);
  out.applyMatrix4(_m);
  if (_m.determinant() < 0) flipWinding(out);
  return out;
}
function flipWinding(g) {
  for (const a of Object.values(g.attributes)) {
    const s = a.itemSize, arr = a.array;
    for (let t = 0; t < a.count; t += 3) for (let k = 0; k < s; k++) { const i1 = (t + 1) * s + k, i2 = (t + 2) * s + k; const tmp = arr[i1]; arr[i1] = arr[i2]; arr[i2] = tmp; }
  }
}

// Merge the static meshes inside `objects` into a few meshes added to `parent` (in parent space), then remove the originals.
// Skinned, instanced, transparent and multi-material meshes are left untouched (and their objects kept).
export function mergeStatic(objects, parent, { cast = true, receive = true } = {}) {
  parent.updateMatrixWorld(true);
  _inv.copy(parent.matrixWorld).invert();
  const buckets = new Map(), keepers = [];
  for (const obj of objects) {
    obj.updateMatrixWorld(true);
    let skipped = false;
    obj.traverse(o => {
      if (!o.isMesh) { if (o.isSprite || o.isPoints || o.isLight) skipped = true; return; }
      const m = o.material;
      if (!o.visible || o.isSkinnedMesh || o.isInstancedMesh || Array.isArray(m) || m.transparent || o.userData.noMerge) { skipped = true; return; }
      const key = matKey(m) + '|' + (m.vertexColors && o.geometry.attributes.color ? 'c' : '') + ((m.map || m.emissiveMap) && o.geometry.attributes.uv ? 'u' : '');
      let b = buckets.get(key); if (!b) buckets.set(key, b = { mat: m, geos: [] });
      b.geos.push(prepare(o, m, _inv));
      o.userData.__merged = true;
    });
    if (skipped) keepers.push(obj);
  }
  // drop merged originals; objects holding unmergeable parts keep only those parts
  for (const obj of objects) {
    if (!keepers.includes(obj)) { obj.parent && obj.parent.remove(obj); continue; }
    const doomed = []; obj.traverse(o => { if (o.userData.__merged) doomed.push(o); });
    for (const o of doomed) { o.visible = false; }
  }
  const meshes = [];
  for (const { mat, geos } of buckets.values()) {
    const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    geos.forEach(g => { if (g !== merged) g.dispose(); });
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = cast; mesh.receiveShadow = receive; mesh.matrixAutoUpdate = false; mesh.updateMatrix();
    parent.add(mesh); meshes.push(mesh);
  }
  return meshes;
}

// ---------------------------------------------------------------- device quality
export const isTouchDevice = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
export const quality = {
  maxPixelRatio: isTouchDevice ? 1.5 : 2,
  shadows: true,                             // the governor may turn these off; applied at the next scene change
};

// ---------------------------------------------------------------- adaptive quality
// Watches real frame times. When the game stays slow, the render resolution drops one step at a time, and at the
// lowest step shadows go off at the next scene change (behind the fade, so nothing hitches on screen).
// A step that brings no speed-up (e.g. a phone capped at 30 fps in power saving) is undone and the resolution stays.
const SLOW_MS = 21, WINDOW = 90;              // average frame time that feels laggy (under ~48 fps); frames per verdict
export const governor = {
  ratios: [1], level: 0, locked: false, strikes: 0, probe: 0, log: [],
  _r: null, _samples: [], _last: 0,
  init(renderer) {
    const start = renderer.getPixelRatio();
    this._r = renderer;
    this.ratios = [start, ...[1.5, 1.25, 1, 0.85].filter(v => v < start - 0.05)];
  },
  setLevel(i) { this.level = i; this._r.setPixelRatio(this.ratios[i]); },
  // a new scene costs something different: start a fresh verdict (a step still being judged is kept)
  reset() { this._samples = []; this.strikes = 0; this.probe = 0; this._last = 0; },
  frame() {
    const now = performance.now();
    if (this._last && !document.hidden) this.sample(now - this._last);
    this._last = now;
  },
  sample(ms) {
    if (ms > 200 || !this._r) return;          // loading, a hidden tab or a one-off hitch
    const s = this._samples; s.push(ms);
    if (s.length < WINDOW) return;
    s.sort((a, b) => a - b); s.length = Math.floor(WINDOW * 0.95);   // ignore the slowest few (garbage collection etc.)
    const ft = s.reduce((a, b) => a + b, 0) / s.length;
    this._samples = [];
    if (this.probe) {                          // judge the last step
      const helped = ft < this.probe * 0.92; this.probe = 0;
      if (!helped) { this.setLevel(this.level - 1); this.locked = true; this.log.push('undo ' + ft.toFixed(1)); return; }
    }
    if (ft <= SLOW_MS) { this.strikes = 0; return; }
    if (this.locked || ++this.strikes < 2) return;
    this.strikes = 0;
    if (this.level < this.ratios.length - 1) { this.probe = ft; this.setLevel(this.level + 1); this.log.push(this.ratios[this.level] + 'x ' + ft.toFixed(1)); }
    else if (quality.shadows) { quality.shadows = false; this.log.push('no shadows ' + ft.toFixed(1)); }
  },
};
