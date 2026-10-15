import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeNoise, mulberry } from './noise.js';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { quality, isTouchDevice } from './perf.js';

export const isMobile = isTouchDevice; // phones and tablets (iPadOS reports a Mac, so touch points are checked too)

export const gfx = {
  renderer: null, scene: null, camera: null, clock: new THREE.Clock(), envMap: null,
  width: 1, height: 1,
};

export function initRenderer(canvas) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality.maxPixelRatio));
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1.05;
  r.shadowMap.enabled = true;
  r.shadowMap.type = isTouchDevice ? THREE.PCFShadowMap : THREE.PCFSoftShadowMap; // soft shadows cost several extra samples per pixel
  gfx.renderer = r;
  const pm = new THREE.PMREMGenerator(r);
  gfx.envMap = pm.fromScene(new RoomEnvironment(r), 0.04).texture;
  gfx.camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.05, 2000);
  resize();
  window.addEventListener('resize', resize);
  return r;
}

export function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  gfx.width = w; gfx.height = h;
  gfx.renderer.setSize(w, h, false);
  gfx.renderer.domElement.style.width = w + 'px';
  gfx.renderer.domElement.style.height = h + 'px';
  if (gfx.post) { gfx.post.composer.setPixelRatio(gfx.renderer.getPixelRatio()); gfx.post.composer.setSize(w, h); }
  gfx.camera.aspect = w / h;
  // keep the horizontal framing on tall/narrow screens
  gfx.camera.fov = gfx.camera.aspect < 1.6 ? 40 * (1.6 / gfx.camera.aspect) ** 0.75 : 40;
  gfx.camera.updateProjectionMatrix();
  window.dispatchEvent(new Event('stage-resize'));
}

// draw a frame (single place to add post effects later)
export function renderFrame(scene, camera) {
  if (gfx.post) { gfx.post.pass.scene = scene; gfx.post.pass.camera = camera; gfx.post.composer.render(); }
  else gfx.renderer.render(scene, camera);
}

// ---------- materials ----------
export function mat(color, o = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? 0.55, metalness: o.metal ?? 0, flatShading: !!o.flat,
    envMap: o.env === false ? null : gfx.envMap, envMapIntensity: o.envI ?? 0.6, emissive: o.emissive ?? 0x000000,
    emissiveIntensity: o.emissiveI ?? 1, transparent: !!o.transparent, opacity: o.opacity ?? 1, side: o.side ?? THREE.FrontSide,
    vertexColors: !!o.vc, map: o.map ?? null });
}

export function shadowAll(obj, cast = true, receive = true) {
  obj.traverse(o => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } });
  return obj;
}

// ---------- sky dome ----------
export function makeSky(stops, opts = {}) {
  // stops: [[t(0 bottom..1 top), '#hex'], ...]
  const c = document.createElement('canvas'); c.width = 4; c.height = 512;
  const g = c.getContext('2d'); const grd = g.createLinearGradient(0, 512, 0, 0);
  for (const [t, col] of stops) grd.addColorStop(t, col);
  g.fillStyle = grd; g.fillRect(0, 0, 4, 512);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const geo = new THREE.SphereGeometry(opts.radius ?? 900, 32, 24);
  const m = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, lo: { value: opts.lo ?? -0.35 }, hi: { value: opts.hi ?? 0.75 }, dark: { value: 0 }, darkCol: { value: new THREE.Color(opts.darkCol ?? 0x05061a) } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform sampler2D map; uniform float lo, hi, dark; uniform vec3 darkCol; varying vec3 vP;
      void main(){ float t = clamp((vP.y - lo)/(hi - lo), 0.0, 1.0); gl_FragColor = texture2D(map, vec2(0.5, t));
      #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, m); mesh.renderOrder = -10; mesh.frustumCulled = false;
  return mesh;
}

// ---------- star field ----------
export function makeStars(count = 2500, radius = 800, opts = {}) {
  const rnd = mulberry(opts.seed ?? 7);
  const pos = new Float32Array(count * 3), col = new Float32Array(count * 3), size = new Float32Array(count);
  const tints = [[1, 1, 1], [0.8, 0.88, 1], [1, 0.92, 0.8], [0.85, 0.8, 1]];
  for (let i = 0; i < count; i++) {
    const u = rnd() * 2 - 1, th = rnd() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos.set([s * Math.cos(th) * radius, u * radius, s * Math.sin(th) * radius], i * 3);
    const t = tints[(rnd() * tints.length) | 0], b = 0.5 + rnd() * 0.5;
    col.set([t[0] * b, t[1] * b, t[2] * b], i * 3);
    size[i] = (rnd() ** 3) * 3.2 + 1.0;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
  const m = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, opacity: { value: opts.opacity ?? 1 }, px: { value: gfx.renderer.getPixelRatio() } },
    vertexShader: `attribute float size; attribute vec3 color; varying vec3 vC; varying float vTw; uniform float time; uniform float px;
      void main(){ vC = color; vTw = 0.75 + 0.25*sin(time*1.7 + position.x*0.13 + position.z*0.07);
      vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * px; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying vec3 vC; varying float vTw; uniform float opacity;
      void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); float a = smoothstep(0.5, 0.0, r); a = a*a;
      gl_FragColor = vec4(vC * vTw, a * opacity); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, m); pts.frustumCulled = false; pts.renderOrder = -9;
  pts.onBeforeRender = r => { m.uniforms.px.value = r.getPixelRatio(); }; // follow resolution changes
  return pts;
}

// ---------- mini planet ----------
// heightFn(dir:Vector3, noise) -> displacement (world units); colorFn(dir, h, noise, out:Color)
export function makePlanet({ radius = 10, detail = 48, seed = 1, heightFn: baseHeight, colorFn, rough = 0.85, flat = false, micro = 0.035, ao = 0.24, grain = 0.06, surface = { scale: 3.2, bump: 0.55, tone: 0.16 } }) {
  const noise = makeNoise(seed);
  // fine surface bumps everywhere except the flattened pad area at the top
  const heightFn = baseHeight && ((d, nz) => baseHeight(d, nz) + micro * nz.fbm(d.x * 18 + 5, d.y * 18, d.z * 18, 2) * THREE.MathUtils.smoothstep(Math.acos(Math.min(1, d.y)), 0.3, 0.42));
  let geo = new THREE.IcosahedronGeometry(1, detail);
  const pos = geo.attributes.position; const n = pos.count;
  const colors = new Float32Array(n * 3); const dir = new THREE.Vector3(); const c = new THREE.Color();
  // cache per-unique-vertex results (icosahedron geometry is non-indexed; many duplicates)
  const cache = new Map();
  for (let i = 0; i < n; i++) {
    dir.fromBufferAttribute(pos, i).normalize();
    const key = (dir.x * 1e5 | 0) + ',' + (dir.y * 1e5 | 0) + ',' + (dir.z * 1e5 | 0);
    let rec = cache.get(key);
    if (!rec) {
      const h = heightFn ? heightFn(dir, noise) : 0;
      colorFn ? colorFn(dir, h, noise, c) : c.set(0x999999);
      rec = [h, c.r, c.g, c.b]; cache.set(key, rec);
    }
    pos.setXYZ(i, dir.x * (radius + rec[0]), dir.y * (radius + rec[0]), dir.z * (radius + rec[0]));
    colors[i * 3] = rec[1]; colors[i * 3 + 1] = rec[2]; colors[i * 3 + 2] = rec[3];
  }
  // baked depth: hollows darker, ridges lighter, plus a little grain
  let hMin = Infinity, hMax = -Infinity;
  for (const r of cache.values()) { if (r[0] < hMin) hMin = r[0]; if (r[0] > hMax) hMax = r[0]; }
  const span = Math.max(1e-3, hMax - hMin);
  for (let i = 0; i < n; i++) {
    dir.fromBufferAttribute(pos, i).normalize();
    const h = Math.hypot(pos.getX(i), pos.getY(i), pos.getZ(i)) - radius; // height from the displaced position
    const t = Math.pow(THREE.MathUtils.clamp((h - hMin) / span, 0, 1), 0.7);
    const k = (1 - ao) + ao * 1.25 * t + grain * noise.n3(dir.x * 46, dir.y * 46, dir.z * 46);
    colors[i * 3] *= k; colors[i * 3 + 1] *= k; colors[i * 3 + 2] *= k;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  if (flat) geo.computeVertexNormals();
  else { // smooth normals across duplicated vertices
    const merged = mergeNormals(geo); geo.setAttribute('normal', merged);
    // share identical vertices (about 6x fewer to process); no texture on terrain, so the UVs can go
    geo.deleteAttribute('uv');
    geo = mergeVertices(geo, 1e-4);
  }
  const material = mat(0xffffff, { vc: true, rough, flat, envI: 0.25 });
  if (surface) addSurfaceDetail(material, surface);
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true; mesh.castShadow = false; // a sphere barely shadows itself; skipping it saves a whole shadow pass
  const heightAt = d => radius + (heightFn ? heightFn(d.clone().normalize(), noise) : 0);
  return { mesh, radius, noise, heightAt };
}

// Per-pixel ground detail: procedural grain on the colour and tiny bumps on the normal, so terrain reads as solid up close.
const NOISE_GLSL = `
varying vec3 vObjPos;
uniform float uDetail, uBump, uTone;
float h3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float vn(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(h3(i), h3(i + vec3(1,0,0)), f.x), mix(h3(i + vec3(0,1,0)), h3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(h3(i + vec3(0,0,1)), h3(i + vec3(1,0,1)), f.x), mix(h3(i + vec3(0,1,1)), h3(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm3(vec3 p){ return vn(p) * 0.5 + vn(p * 2.7 + 3.1) * 0.3 + vn(p * 7.3 + 7.7) * 0.2; }
vec3 bumpN(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float fd){
  vec3 sx = normalize(dFdx(surf_pos)); vec3 sy = normalize(dFdy(surf_pos)); vec3 r1 = cross(sy, surf_norm); vec3 r2 = cross(surf_norm, sx);
  float det = dot(sx, r1) * fd; vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2); return normalize(abs(det) * surf_norm - grad); }
`;
export function addSurfaceDetail(material, { scale = 3.2, bump = 0.55, tone = 0.16 } = {}) {
  material.onBeforeCompile = shader => {
    shader.uniforms.uDetail = { value: scale }; shader.uniforms.uBump = { value: bump }; shader.uniforms.uTone = { value: tone };
    shader.vertexShader = 'varying vec3 vObjPos;\n' + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vObjPos = position;');
    shader.fragmentShader = NOISE_GLSL + shader.fragmentShader
      .replace('#include <color_fragment>', '#include <color_fragment>\n  float gDet = fbm3(vObjPos * uDetail);\n  diffuseColor.rgb *= 1.0 - uTone + uTone * 2.0 * gDet;')
      .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  normal = bumpN(-vViewPosition, normal, vec2(dFdx(gDet), dFdy(gDet)) * uBump, faceDirection);');
  };
  material.customProgramCacheKey = () => 'surface-detail';
  return material;
}

function mergeNormals(geo) {
  geo.computeVertexNormals();
  const pos = geo.attributes.position, nor = geo.attributes.normal; const acc = new Map();
  const k = i => (pos.getX(i) * 1e4 | 0) + ',' + (pos.getY(i) * 1e4 | 0) + ',' + (pos.getZ(i) * 1e4 | 0);
  for (let i = 0; i < pos.count; i++) {
    const key = k(i); let a = acc.get(key); if (!a) acc.set(key, a = [0, 0, 0]);
    a[0] += nor.getX(i); a[1] += nor.getY(i); a[2] += nor.getZ(i);
  }
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const a = acc.get(k(i)); const l = Math.hypot(a[0], a[1], a[2]) || 1;
    out[i * 3] = a[0] / l; out[i * 3 + 1] = a[1] / l; out[i * 3 + 2] = a[2] / l;
  }
  return new THREE.BufferAttribute(out, 3);
}

// Place an object on a planet surface: dir = direction from planet centre, spin = rotation about the local up.
const _up = new THREE.Vector3(0, 1, 0);
export function placeOn(planet, obj, dir, { spin = 0, sink = 0, lift = 0 } = {}) {
  const d = dir.clone().normalize();
  const h = planet.heightAt(d);
  obj.position.copy(d).multiplyScalar(h - sink + lift);
  obj.quaternion.setFromUnitVectors(_up, d);
  obj.rotateY(spin);
  return obj;
}

// direction from spherical-ish coordinates relative to the "top" (lat 0 = north pole, angle in radians from top)
export function dirFrom(fromTopRad, aroundRad) {
  return new THREE.Vector3(Math.sin(fromTopRad) * Math.sin(aroundRad), Math.cos(fromTopRad), Math.sin(fromTopRad) * Math.cos(aroundRad));
}

// ---------- puffy clouds ----------
export function makeCloud(rnd, color = 0xffffff, scale = 1) {
  // all puffs of one cloud in a single mesh (one draw call), no shadow casting
  const g = new THREE.Group(); const m = mat(color, { rough: 0.95, envI: 0.15 });
  const puffs = 4 + (rnd() * 3 | 0), parts = [];
  for (let i = 0; i < puffs; i++) {
    const r = (0.35 + rnd() * 0.35) * scale * (i === 0 ? 1.25 : 1);
    const sg = new THREE.SphereGeometry(r, 16, 12);
    sg.scale(1, 0.78, 1);
    sg.translate((i - puffs / 2) * 0.42 * scale + (rnd() - 0.5) * 0.2, (rnd() * 0.25) * scale, (rnd() - 0.5) * 0.4 * scale);
    parts.push(sg);
  }
  const mesh = new THREE.Mesh(mergeGeometries(parts, false), m); parts.forEach(p => p.dispose());
  g.add(mesh);
  return g;
}

// ---------- lights ----------
export function makeLights(scene, { sun = 0xfff1d6, sunI = 2.6, sky = 0xbfe3ff, ground = 0xf2c894, hemiI = 1.1, dir = [6, 14, 8], shadowSize = 14, target = [0, 10, 0] } = {}) {
  const hemi = new THREE.HemisphereLight(sky, ground, hemiI); scene.add(hemi);
  const d = new THREE.DirectionalLight(sun, sunI);
  d.position.set(target[0] + dir[0], target[1] + dir[1], target[2] + dir[2]);
  d.target.position.set(...target); scene.add(d.target);
  d.castShadow = true;
  const sm = isMobile ? 1024 : 2048; d.shadow.mapSize.set(sm, sm);
  const s = d.shadow.camera; s.left = -shadowSize; s.right = shadowSize; s.top = shadowSize; s.bottom = -shadowSize; s.near = 0.5; s.far = 60;
  d.shadow.bias = -0.0004; d.shadow.normalBias = 0.03; d.shadow.radius = 4;
  scene.add(d);
  return { hemi, sun: d };
}

export const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
export { THREE };
