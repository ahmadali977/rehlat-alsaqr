import * as THREE from 'three';
import { mat, gfx } from './gfx.js';

const GREEN = 0x0f8a4a, GREEN_D = 0x0a6b38, WHITE = 0xf7f7f2, GOLD = 0xf2b632, STEEL = 0x8f98a8, DARK = 0x2c3140;

let flagImg = null;
export async function preloadRocketArt() {
  flagImg = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = new URL('../assets/img/flag_sa.svg', import.meta.url).href; });
  await document.fonts.load('80px Lalezar');
}

function flagTexture() {
  const c = document.createElement('canvas'); c.width = 900; c.height = 600;
  const g = c.getContext('2d'); g.drawImage(flagImg, 0, 0, 900, 600);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

function nameTexture(text) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 160;
  const g = c.getContext('2d');
  g.font = '112px Lalezar'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.direction = 'rtl';
  g.lineJoin = 'round'; g.lineWidth = 14; g.strokeStyle = '#ffffff'; g.strokeText(text, 256, 92);
  g.fillStyle = '#0a6b38'; g.fillText(text, 256, 92);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}

// Curved decal that hugs the body: a cylinder slice centred on +Z (facing the camera by default).
function decal(radius, y, h, arc, tex, faceAngle = 0) {
  // theta 0 points at +Z, so this slice is centred on +Z (rotated by faceAngle)
  const geo = new THREE.CylinderGeometry(radius, radius, h, 32, 1, true, faceAngle - arc / 2, arc);
  const m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.45, envMap: gfx.envMap, envMapIntensity: 0.5, polygonOffset: true, polygonOffsetFactor: -2 });
  const mesh = new THREE.Mesh(geo, m); mesh.position.y = y;
  return mesh;
}

// remap a decal's UVs so the image reads upright when the body axis is horizontal (nose toward +X)
function rotUV(geo) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) { const u = uv.getX(i), v = uv.getY(i); uv.setXY(i, v, 1 - u); }
  uv.needsUpdate = true;
}

// body profile radius at height y (matches lathe below)
const PROFILE = [[0.0, 0.0], [0.34, 0.0], [0.42, 0.18], [0.46, 0.55], [0.47, 1.2], [0.46, 1.75], [0.43, 2.1]];
const NOSE = [[0.43, 2.1], [0.40, 2.32], [0.34, 2.56], [0.25, 2.78], [0.14, 2.94], [0.05, 3.03], [0.0, 3.05]];

export function buildRocket() {
  const root = new THREE.Group();       // origin at the bottom of the legs
  const body = new THREE.Group(); body.position.y = 0.42; root.add(body);

  const lathe = pts => new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), 64);
  const hull = new THREE.Mesh(lathe(PROFILE), mat(WHITE, { rough: 0.3, envI: 0.9 }));
  const nose = new THREE.Mesh(lathe(NOSE), mat(GREEN, { rough: 0.3, envI: 0.9 }));
  body.add(hull, nose);

  // bands
  const band = (y, r, col, t = 0.06) => { const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 12, 64), mat(col, { rough: 0.35, metal: col === GOLD ? 0.6 : 0, envI: 1 })); m.rotation.x = Math.PI / 2; m.position.y = y; m.scale.z = 0.6; body.add(m); return m; };
  band(2.1, 0.435, GOLD, 0.045);
  band(0.22, 0.425, GREEN, 0.07);
  band(0.34, 0.445, GREEN, 0.045);

  // porthole (+Z front)
  const port = new THREE.Group(); port.position.set(0, 1.62, 0.44); body.add(port);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.05, 16, 40), mat(GOLD, { rough: 0.25, metal: 0.8, envI: 1.2 }));
  const glass = new THREE.Mesh(new THREE.SphereGeometry(0.19, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: 0x5fc8ff, roughness: 0.05, metalness: 0, clearcoat: 1, envMap: gfx.envMap, envMapIntensity: 1.6, emissive: 0x0b3b66, emissiveIntensity: 0.6 }));
  glass.rotation.x = Math.PI / 2; glass.scale.y = 0.35;
  port.add(ring, glass);
  port.userData.glass = glass;

  // flag + name decals
  const flag = decal(0.472, 1.02, 0.5, 1.62, flagTexture());
  body.add(flag);
  const name = decal(0.471, 0.56, 0.24, 1.2, nameTexture('الصقر'));
  body.add(name);
  // sideways versions, upright on screen when the rocket flies horizontally (+X)
  const flagH = decal(0.473, 1.06, 0.66, 0.96, flag.material.map); rotUV(flagH.geometry); body.add(flagH);
  const nameH = decal(0.472, 0.52, 0.34, 0.42, name.material.map); rotUV(nameH.geometry); body.add(nameH);
  flagH.visible = nameH.visible = false;

  // fins (4)
  const finShape = new THREE.Shape();
  finShape.moveTo(0, 0); finShape.lineTo(0, 0.95); finShape.quadraticCurveTo(0.22, 0.55, 0.5, 0.05); finShape.lineTo(0.55, -0.32); finShape.quadraticCurveTo(0.3, -0.18, 0, 0);
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 3, curveSegments: 16 });
  finGeo.translate(0, 0, -0.035);
  const finMat = mat(GREEN, { rough: 0.35, envI: 0.9 });
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(finGeo, finMat);
    const a = i * Math.PI / 2 + Math.PI / 4;
    const piv = new THREE.Group(); piv.rotation.y = a; body.add(piv);
    f.position.set(0.42, 0.12, 0); piv.add(f);
  }

  // engine bell
  const bell = new THREE.Mesh(lathe([[0.18, 0.0], [0.22, -0.05], [0.29, -0.2], [0.33, -0.34], [0.30, -0.36], [0.2, -0.22], [0.12, -0.05], [0.12, 0]]), mat(DARK, { rough: 0.35, metal: 0.7, envI: 1 }));
  body.add(bell);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(0.2, 32), new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0 }));
  glow.rotation.x = Math.PI / 2; glow.position.y = -0.3; body.add(glow);

  // landing legs (3) - retractable look
  const legMat = mat(STEEL, { rough: 0.35, metal: 0.6, envI: 1 });
  const legs = new THREE.Group(); body.add(legs);
  for (let i = 0; i < 3; i++) {
    const piv = new THREE.Group(); piv.rotation.y = i * Math.PI * 2 / 3; legs.add(piv);
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.62, 10), legMat);
    strut.position.set(0.5, -0.12, 0); strut.rotation.z = 0.55; piv.add(strut);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.05, 16), legMat);
    foot.position.set(0.66, -0.39, 0); piv.add(foot);
  }

  // flame (hidden until thrust)
  const flame = makeFlame(); flame.position.y = -0.36; body.add(flame);

  root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  flame.traverse(o => { o.castShadow = false; o.receiveShadow = false; });
  glow.castShadow = false;

  const api = {
    root, body, flame, legs, port, glow,
    thrust: 0,
    setHorizontal(h) { flag.visible = name.visible = !h; flagH.visible = nameH.visible = h; },
    setThrust(v) { api.thrust = v; },
    update(dt, t) {
      const k = api.thrust;
      flame.visible = k > 0.01;
      if (flame.visible) {
        const flick = 1 + Math.sin(t * 47) * 0.06 + Math.sin(t * 31) * 0.05;
        flame.scale.set(0.75 + 0.35 * k, (0.6 + 1.6 * k) * flick, 0.75 + 0.35 * k);
        flame.userData.mat.forEach(m => m.uniforms.time.value = t);
      }
      glow.material.opacity = Math.min(1, k * 1.4);
    },
  };
  return api;
}

function makeFlame() {
  const g = new THREE.Group();
  const mk = (r, h, inner, outer, alpha) => {
    const geo = new THREE.ConeGeometry(r, h, 32, 8, true); geo.rotateX(Math.PI); geo.translate(0, -h / 2, 0); // base at 0, tip down
    const m = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0 }, inner: { value: new THREE.Color(inner) }, outer: { value: new THREE.Color(outer) }, alpha: { value: alpha }, h: { value: h } },
      vertexShader: `varying float vY; varying vec3 vN; varying vec3 vV; uniform float h; uniform float time;
        void main(){ vY = -position.y / h; vec3 p = position; p.x += sin(time*30.0 + p.y*9.0)*0.015*vY; p.z += cos(time*27.0 + p.y*8.0)*0.015*vY;
        vec4 mv = modelViewMatrix * vec4(p,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`,
      fragmentShader: `varying float vY; varying vec3 vN; varying vec3 vV; uniform vec3 inner; uniform vec3 outer; uniform float alpha;
        void main(){ float rim = abs(dot(vN, vV)); vec3 c = mix(outer, inner, pow(rim, 1.5) * (1.0 - vY*0.7));
        float a = alpha * pow(rim, 0.8) * smoothstep(1.0, 0.15, vY); gl_FragColor = vec4(c * 1.6, a); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, m); g.add(mesh); return m;
  };
  g.userData.mat = [mk(0.3, 1.5, 0xffd27a, 0xff5a1f, 0.85), mk(0.17, 0.95, 0xffffff, 0xffc44d, 1.0)];
  g.visible = false;
  return g;
}
