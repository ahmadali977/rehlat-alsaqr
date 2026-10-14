import * as THREE from 'three';
import { gfx, mat, makeSky, makeStars, makePlanet, placeOn, dirFrom, makeCloud, makeLights } from '../gfx.js';
import { model, character } from '../models.js';
import { buildRocket } from '../rocket.js';
import { mulberry } from '../noise.js';
import { makeCam } from '../game.js';
import { Particles } from '../particles.js';
import { makePad, makeRock, ROCK_PALETTES, najdiHouse, najdiTower, oasis, falcon } from '../art.js';

export const EARTH_R = 12;
const PAD_ANGLE = 0.2;
const S = THREE.MathUtils.smoothstep;

const C = {
  sand: new THREE.Color('#eeb45c'), sandLight: new THREE.Color('#f9d88c'), sandDark: new THREE.Color('#cf8840'),
  green: new THREE.Color('#7ec46a'), greenD: new THREE.Color('#4f9a52'),
  shore: new THREE.Color('#f2d08a'), deep: new THREE.Color('#1c4f96'), shallow: new THREE.Color('#2f8fd0'), ice: new THREE.Color('#f4fbff'),
};

function earthHeight(d, nz) {
  const top = d.y;
  const cont = nz.fbm(d.x * 1.15 + 3, d.y * 1.15, d.z * 1.15, 4) + (top - 0.15) * 0.9;
  const land = S(cont, -0.02, 0.12);
  const dunes = Math.pow(nz.ridge(d.x * 7 + 1, d.y * 3.2, d.z * 7, 3), 2.2) * 0.32 + nz.fbm(d.x * 3, d.y * 3, d.z * 3, 2) * 0.12;
  let h = land * (0.12 + dunes) + (1 - land) * -0.35;
  const ang = Math.acos(Math.min(1, top));
  return THREE.MathUtils.lerp(0.14, h, S(ang, PAD_ANGLE, PAD_ANGLE + 0.14));
}

function earthColor(d, h, nz, out) {
  if (h < -0.02) { out.copy(C.deep).lerp(C.shallow, THREE.MathUtils.clamp((h + 0.35) / 0.3, 0, 1)); return; }
  if (h < 0.06) { out.copy(C.shore); return; }
  const veg = nz.fbm(d.x * 2.5 + 9, d.y * 2.5, d.z * 2.5, 3) + (d.y < 0.55 ? 0.25 : -0.5);
  out.copy(C.sand).lerp(C.sandLight, THREE.MathUtils.clamp((h - 0.12) / 0.3, 0, 1));
  const shade = nz.n3(d.x * 14, d.y * 14, d.z * 14) * 0.5 + 0.5;
  out.lerp(C.sandDark, (1 - shade) * 0.18);
  if (veg > 0.18) out.lerp(veg > 0.3 ? C.greenD : C.green, S(veg, 0.18, 0.3));
  if (d.y < -0.8) out.lerp(C.ice, S(-d.y, 0.8, 0.9));
}

// rotate obj about its local up so that its local axis (default +X) points toward worldPoint
export function aimAxis(obj, worldPoint, axis = new THREE.Vector3(1, 0, 0)) {
  obj.updateMatrixWorld(true);
  const up = obj.position.clone().normalize();
  const to = worldPoint.clone().sub(obj.position); to.addScaledVector(up, -to.dot(up)).normalize();
  const cur = axis.clone().applyQuaternion(obj.quaternion); cur.addScaledVector(up, -cur.dot(up)).normalize();
  let a = Math.acos(THREE.MathUtils.clamp(cur.dot(to), -1, 1)); if (new THREE.Vector3().crossVectors(cur, to).dot(up) < 0) a = -a;
  obj.rotateY(a);
}

const _cw = new THREE.Vector3();
export function buildEarthWorld() {
  const scene = new THREE.Scene();
  const rnd = mulberry(42);
  const sky = makeSky([[0, '#ffe2b0'], [0.12, '#ffe9c9'], [0.3, '#a9dcf7'], [0.6, '#5aa4ec'], [1, '#2f5fc4']], { lo: -0.45, hi: 0.8 });
  scene.add(sky);
  const stars = makeStars(2200, 850, { opacity: 0 }); scene.add(stars);
  const lights = makeLights(scene, { sun: 0xfff0d2, sunI: 2.8, sky: 0xcfe8ff, ground: 0xf3c98d, hemiI: 1.25, dir: [-10, 8, 7], shadowSize: 9, target: [0, EARTH_R, 0] });

  const planet = makePlanet({ radius: EARTH_R, detail: 64, seed: 11, heightFn: earthHeight, colorFn: earthColor, rough: 0.92, surface: { scale: 4.5, bump: 0.4, tone: 0.1 } });
  scene.add(planet.mesh);
  const ocean = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R + 0.02, 96, 64),
    new THREE.MeshStandardMaterial({ color: 0x2a9fe0, roughness: 0.35, transparent: true, opacity: 0.88, envMap: gfx.envMap, envMapIntensity: 0.2 }));
  ocean.receiveShadow = true; scene.add(ocean);

  const world = new THREE.Group(); scene.add(world);

  // launch pad + rocket
  const pad = makePad({ radius: 1.7, label: 'الصقر', accent: '#0f8a4a' });
  placeOn(planet, pad, new THREE.Vector3(0, 1, 0), { sink: 0.02 }); world.add(pad);
  const padTop = pad.position.y + pad.userData.top;

  const rocket = buildRocket();
  rocket.root.scale.setScalar(1.15);
  rocket.root.position.set(0, padTop - 0.02, 0);
  rocket.root.rotation.y = -0.35;
  world.add(rocket.root);

  // gantry tower, its access arms aimed at the rocket
  const tower = buildTower();
  placeOn(planet, tower, dirFrom(0.205, -1.15), { sink: 0.02 }); world.add(tower);
  // stand the tower straight up (parallel to the rocket) so its access arms meet the hull
  { const dx = -tower.position.x, dz = -tower.position.z, l = Math.hypot(dx, dz); tower.rotation.set(0, Math.atan2(-dz / l, dx / l), 0); tower.position.y -= 0.06; }

  // desert dressing (camera side, +Z, is kept clear)
  const spots = [
    [0.4, 1.2, 'palms', 1.9], [0.5, 1.75, 'palm1', 1.7], [0.42, 2.5, 'palm2', 1.6], [0.45, -1.25, 'palm3', 1.8],
    [0.55, -2.0, 'palm4', 1.5], [0.66, 1.45, 'palms', 1.6], [0.62, -1.6, 'palm1', 1.5], [0.38, 3.1, 'palm2', 1.4], [0.6, 2.9, 'palms', 1.7],
    [0.9, 2.1, 'palm3', 1.6], [0.95, -2.3, 'palms', 1.7],
  ];
  for (const [a, b, k, h] of spots) { const p = model(k, { height: h }); placeOn(planet, p, dirFrom(a, b), { spin: rnd() * 6, sink: 0.05 }); world.add(p); }
  // sandstone rocks and desert shrubs
  for (let i = 0; i < 16; i++) {
    const r = makeRock(i, 0.1 + rnd() * 0.22, { ...ROCK_PALETTES.earth, squash: 0.55, detail: 2, craters: 1 });
    placeOn(planet, r, dirFrom(0.3 + rnd() * 0.55, rnd() * 6.28), { spin: rnd() * 6, sink: 0.03 }); world.add(r);
  }
  const shrubM = mat('#7d8f45', { rough: 0.9, flat: true }), shrubM2 = mat('#9aa152', { rough: 0.9, flat: true });
  for (let i = 0; i < 34; i++) {
    const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08 + rnd() * 0.07, 1), i % 3 ? shrubM : shrubM2);
    s.scale.y = 0.65; s.castShadow = true; s.receiveShadow = true;
    let d; do { d = dirFrom(0.3 + rnd() * 0.65, rnd() * 6.28); } while (Math.abs(Math.atan2(d.x, d.z)) < 0.35 && Math.acos(d.y) < 0.5);
    placeOn(planet, s, d, { sink: 0.02 }); world.add(s);
  }
  // a Najdi mud-brick village on the far side, and an oasis
  const village = [[0.44, 2.75, 'tower', 0], [0.47, 3.05, 'house', 1.0, 0.75, 0.55], [0.43, 3.4, 'house', 0.8, 0.7, 0.5], [0.52, 2.45, 'house', 0.9, 0.65, 0.45], [0.5, 3.75, 'tower', 0]];
  village.forEach(([a, b, kind, w, d, h], i) => {
    const o = kind === 'tower' ? najdiTower(0.3, 1.25 + (i % 2) * 0.25) : najdiHouse(w, d, h, i + 3);
    placeOn(planet, o, dirFrom(a, b), { sink: 0.05 }); aimAxis(o, new THREE.Vector3(0, EARTH_R + 1, 0), new THREE.Vector3(0, 0, 1)); world.add(o);
  });
  const pond = oasis(0.75); placeOn(planet, pond, dirFrom(0.47, -2.35), { sink: 0.04 }); world.add(pond);
  for (const [a, b, k, h] of [[0.43, -2.05, 'palm2', 1.5], [0.54, -2.6, 'palm4', 1.4], [0.5, -2.05, 'palms', 1.6]]) { const p = model(k, { height: h }); placeOn(planet, p, dirFrom(a, b), { spin: rnd() * 6, sink: 0.05 }); world.add(p); }
  // falcons circling over the launch site
  const birds = [0, 1, 2].map(i => { const f = falcon(1.6 - i * 0.2); f.userData.r = 3.4 + i * 1.0; f.userData.h = EARTH_R + 4.9 + i * 0.55; f.userData.ph = i * 2.1; f.userData.sp = 0.22 - i * 0.03; scene.add(f); return f; });

  // astronaut (Saudi suit colours)
  const astro = character('astronaut', { height: 0.8, recolor: { SciFi_Main: 0xf4f6f8, SciFi_MainDark: 0x2c3e50, SciFi_Light: 0xdfe6ee, SciFi_Light_Accent: 0x12a150, Grey: 0x9aa5b1 } });
  world.add(astro);

  // clouds
  const clouds = new THREE.Group(); scene.add(clouds);
  for (let i = 0; i < 10; i++) {
    const cl = makeCloud(rnd, 0xffffff, 0.7 + rnd() * 0.5);
    const d = dirFrom(0.45 + rnd() * 0.9, rnd() * 6.28);
    cl.position.copy(d.multiplyScalar(EARTH_R + 2.2 + rnd() * 1.6)); cl.lookAt(0, 0, 0); cl.rotateX(Math.PI / 2);
    clouds.add(cl);
  }

  // particles: smoke (normal blend) + fire (additive)
  const smoke = new Particles(900); scene.add(smoke.points);
  const fire = new Particles(400, { additive: true }); scene.add(fire.points);

  const cam = makeCam(new THREE.Vector3(3.2, EARTH_R + 4.6, 12.5), new THREE.Vector3(0, EARTH_R + 1.0, 0));
  cam.snap();
  let t = 0;
  const w = {
    scene, planet, rocket, astro, sky, stars, clouds, lights, cam, tower, smoke, fire, padTop, world,
    onUpdate: null,
    update(dt) {
      t += dt;
      astro.userData.update(dt);
      rocket.update(dt, t);
      clouds.rotation.y += dt * 0.012;
      // clouds that drift in front of the camera puff away instead of blocking the view
      for (const c of clouds.children) { c.getWorldPosition(_cw); const near = _cw.distanceTo(gfx.camera.position) < 7.5; const s = THREE.MathUtils.lerp(c.scale.x, near ? 0.001 : 1, Math.min(1, dt * 3)); c.scale.setScalar(s); }
      for (const f of birds) { const a = f.userData.ph + t * f.userData.sp; f.position.set(Math.cos(a) * f.userData.r, f.userData.h + Math.sin(t * 0.6 + f.userData.ph) * 0.25, Math.sin(a) * f.userData.r); f.rotation.set(0, -a, 0.35); f.userData.flap(t + f.userData.ph); }
      stars.material.uniforms.time.value = t;
      smoke.update(dt); fire.update(dt);
      w.onUpdate && w.onUpdate(dt, t);
      cam.apply(dt);
    },
  };
  return w;
}

function buildTower() {
  const g = new THREE.Group();
  const white = mat(0xe8eef4, { rough: 0.4, metal: 0.3 }), acc = mat(0x12a150, { rough: 0.45 }), dark = mat(0x3b4252, { rough: 0.5, metal: 0.5 });
  const H = 4.1, w = 0.5;
  for (const [x, z] of [[-w / 2, -w / 2], [w / 2, -w / 2], [-w / 2, w / 2], [w / 2, w / 2]]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, H, 0.07), white); leg.position.set(x, H / 2, z); g.add(leg);
  }
  let n = 0;
  for (let y = 0.35; y < H; y += 0.42, n++) {
    for (const [x, z, ry] of [[0, -w / 2, 0], [0, w / 2, 0], [-w / 2, 0, Math.PI / 2], [w / 2, 0, Math.PI / 2]]) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.05, 0.05), n % 2 ? acc : white); b.position.set(x, y, z); b.rotation.y = ry; g.add(b);
      const diag = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.6, 0.035), dark); diag.position.set(x, y + 0.2, z); diag.rotation.set(0, ry, 0); diag.rotateZ(0.75); g.add(diag);
    }
  }
  const top = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.12, 0.75), acc); top.position.y = H + 0.06; g.add(top);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 12), mat(0xff4d4d, { emissive: 0xff2020, emissiveI: 1.5 })); beacon.position.y = H + 0.2; g.add(beacon);
  const cage = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.36), acc); cage.position.y = 0.16; g.add(cage); g.userData.cage = cage;
  const arms = [];
  for (const y of [2.15, 3.25]) { const arm = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.09, 0.24), white); arm.position.set(1.2, y, 0); g.add(arm); arms.push(arm); }
  g.userData.arms = arms;
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.9), dark); base.position.y = 0.06; g.add(base);
  g.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
