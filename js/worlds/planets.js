import * as THREE from 'three';
import { gfx, mat, makeSky, makeStars, makePlanet, placeOn, dirFrom, makeCloud, makeLights } from '../gfx.js';
import { model, character } from '../models.js';
import { mulberry } from '../noise.js';
import { buildRocket } from '../rocket.js';
import { makeCam } from '../game.js';
import { Particles, Confetti } from '../particles.js';
import { planetMesh, planetTexture } from '../textures.js';
import { aimAxis } from './earth.js';

const S = THREE.MathUtils.smoothstep, L = THREE.MathUtils.lerp, CL = THREE.MathUtils.clamp;
const col = h => new THREE.Color(h);
const V = (x, y, z) => new THREE.Vector3(x, y, z);

function craters(d, list) {
  let h = 0;
  for (const c of list) {
    const a = d.angleTo(c.dir); if (a > c.r * 1.4) continue;
    const x = a / c.r;
    h += x < 1 ? -c.depth * (1 - x * x) + c.depth * 0.35 * S(x, 0.6, 1) : c.depth * 0.35 * (1 - S(x, 1, 1.4));
  }
  return h;
}
function craterList(seed, n, rMin, rMax, depth, avoidTop = 0.38) {
  const rnd = mulberry(seed); const out = [];
  while (out.length < n) {
    const d = V(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize();
    if (Math.acos(d.y) < avoidTop) continue;
    const r = rMin + rnd() * (rMax - rMin);
    out.push({ dir: d, r, depth: depth * (0.6 + rnd() * 0.6) * (r / rMax) });
  }
  return out;
}
const flatTop = (d, h, padH, a0 = 0.2, a1 = 0.34) => L(padH, h, S(Math.acos(Math.min(1, d.y)), a0, a1));

// ---------------------------------------------------------------- definitions
export const WORLD_DEFS = {
  mercury: {
    rocky: true, radius: 9, seed: 21,
    sky: [[0, '#2a1a3a'], [0.4, '#120c28'], [1, '#05040e']], skyLo: -0.4, skyHi: 0.6, stars: 1,
    sun: { color: 0xfff2dc, i: 3.6, dir: [-9, 6, 5] }, hemi: [0xb4b2d0, 0x8a7a6e, 1.15],
    bigSun: { size: 30, pos: [-170, 90, -300] },
    craters: craterList(5, 34, 0.08, 0.32, 0.55),
    height(d, nz) { return flatTop(d, craters(d, this.craters) + nz.fbm(d.x * 4, d.y * 4, d.z * 4, 4) * 0.18, 0.05); },
    color(d, h, nz, o) { o.copy(col('#a89888')).lerp(col('#776a60'), CL(-h * 1.6 + 0.3, 0, 1)); o.lerp(col('#cbbcad'), CL(nz.fbm(d.x * 6, d.y * 6, d.z * 6, 2) * 0.8, 0, 0.5)); },
    props: [['rockA', 9, 0.35, 0.7, '#8a7c70'], ['rocksA', 14, 0.1, 0.22, '#9a8b7e'], ['meteorH', 5, 0.3, 0.5, '#7f7166'], ['dish', 1, 0.9, 0.9, null]],
    station: true, species: 'sp_mercury', tints: ['#ffffff', '#ffc89a', '#ffe3b0'],
  },
  venus: {
    rocky: true, radius: 9, seed: 31,
    sky: [[0, '#ffd88a'], [0.35, '#f5a54a'], [0.75, '#cf7a32'], [1, '#93501f']], skyLo: -0.4, skyHi: 0.9, stars: 0,
    sun: { color: 0xffd9a0, i: 2.2, dir: [-6, 10, 6] }, hemi: [0xffc27a, 0x9b5a2a, 1.45],
    fog: [0xf2b062, 24, 75], cloudColor: 0xffdf9e,
    volcanoes: [[0.62, 2.55, 0.22, 1.4], [0.7, -2.45, 0.2, 1.2], [0.75, 1.5, 0.2, 1.1], [0.95, -1.4, 0.25, 1.2], [0.9, 3.14, 0.22, 1.0]].map(([a, b, r, h]) => ({ dir: dirFrom(a, b), r, h })),
    height(d, nz) {
      let h = nz.fbm(d.x * 3, d.y * 3, d.z * 3, 4) * 0.25;
      for (const v of this.volcanoes) { const x = d.angleTo(v.dir) / v.r; if (x < 1.5) h += v.h * (x < 0.18 ? 0.82 + x : Math.max(0, 1 - (x - 0.18) / 1.3) ** 1.6); }
      return flatTop(d, h, 0.06);
    },
    color(d, h, nz, o) {
      o.copy(col('#d9893f')).lerp(col('#a3572a'), CL(nz.fbm(d.x * 5, d.y * 5, d.z * 5, 3) + 0.3, 0, 1) * 0.6);
      for (const v of this.volcanoes) { const x = d.angleTo(v.dir) / v.r; if (x < 0.22) o.lerp(col('#ff5a1f'), S(0.22 - x, 0, 0.08)); else if (x < 1) o.lerp(col('#5c3324'), (1 - x) * 0.45); }
    },
    props: [['rockB', 9, 0.3, 0.6, '#7a3e22'], ['rocksB', 12, 0.12, 0.22, '#8f4a26']],
    station: false, lava: true, species: 'sp_venus', tints: ['#ffffff', '#ffe9f4', '#f1e6ff'],
  },
  mars: {
    rocky: true, radius: 9, seed: 41,
    sky: [[0, '#f7d7a8'], [0.3, '#eab47e'], [0.7, '#c77f52'], [1, '#7a4a3a']], skyLo: -0.4, skyHi: 0.85, stars: 0.15,
    sun: { color: 0xffe6c9, i: 2.6, dir: [-8, 9, 6] }, hemi: [0xf2c79c, 0x8a3b22, 1.15],
    craters: craterList(9, 14, 0.1, 0.28, 0.45),
    olympus: { dir: dirFrom(0.75, 2.2), r: 0.6, h: 1.6 },
    height(d, nz) {
      let h = craters(d, this.craters) + nz.fbm(d.x * 3.5, d.y * 3.5, d.z * 3.5, 4) * 0.22;
      const o = this.olympus; const x = d.angleTo(o.dir) / o.r;
      if (x < 1.3) h += o.h * (x < 0.15 ? 0.9 : Math.max(0, 1 - (x - 0.15) / 1.15) ** 1.3);
      return flatTop(d, h, 0.06);
    },
    color(d, h, nz, o) {
      o.copy(col('#c9592f')).lerp(col('#e07a43'), CL(nz.fbm(d.x * 4, d.y * 4, d.z * 4, 3) + 0.4, 0, 1));
      o.lerp(col('#8e3a22'), CL(-h * 1.5, 0, 0.6));
      if (d.y < -0.82) o.lerp(col('#fbf6f0'), S(-d.y, 0.82, 0.88));
    },
    props: [['rockA', 9, 0.3, 0.6, '#9a4428'], ['rocksA', 14, 0.1, 0.22, '#a34a2a'], ['rover', 1, 0.6, 0.6, null], ['dish', 1, 0.9, 0.9, null]],
    station: true, species: 'sp_mars', tints: ['#ffffff', '#fff0c8', '#e0ffd8'],
  },
  // gas & ice giants: no solid surface, a floating sky station in the upper atmosphere
  jupiter: {
    rocky: false, sky: [[0, '#f3dcc0'], [0.35, '#e9c9a0'], [0.7, '#9a8fb8'], [1, '#3e3a6e']], skyLo: -0.3, skyHi: 0.9,
    sun: { color: 0xfff1dc, i: 2.6, dir: [-8, 9, 6] }, hemi: [0xf6e2c8, 0x9a6a48, 1.2], cloud: 0xfff4e4, cloud2: 0xf0cfa8, deck: '#d7dbe6', trim: '#ff8a3a',
    species: 'sp_jupiter', tints: ['#ffffff', '#ffd8f0', '#d8e4ff'], fog: [0xead2b4, 60, 650],
  },
  saturn: {
    rocky: false, sky: [[0, '#f6e7bf'], [0.35, '#efd9a2'], [0.7, '#a8a6c8'], [1, '#3c3e72']], skyLo: -0.3, skyHi: 0.9,
    sun: { color: 0xfff3d6, i: 2.5, dir: [-8, 9, 6] }, hemi: [0xf7ebc8, 0x9c8a5e, 1.2], cloud: 0xfffaea, cloud2: 0xf3e2b2, deck: '#e2e4ec', trim: '#ffc83d',
    species: 'sp_saturn', tints: ['#ffffff', '#fff0c8', '#ffe0d0'], rings: true, fog: [0xf0e0b6, 60, 650],
  },
  uranus: {
    rocky: false, sky: [[0, '#d6fbfb'], [0.35, '#a6eef0'], [0.7, '#5fb7d2'], [1, '#1d4a78']], skyLo: -0.3, skyHi: 0.9,
    sun: { color: 0xf2fbff, i: 2.1, dir: [-8, 9, 6] }, hemi: [0xd8f8fa, 0x4f8f9a, 1.25], cloud: 0xf2feff, cloud2: 0xbcecef, deck: '#e6eef5', trim: '#2ec4b6',
    species: 'sp_uranus', tints: ['#ffffff', '#e0f6ff', '#f0e8ff'], fog: [0xbdeef0, 60, 650], tilt: true,
  },
  neptune: {
    rocky: false, sky: [[0, '#9fc2ff'], [0.35, '#5a8ff0'], [0.7, '#2c4fb8'], [1, '#0e1a52']], skyLo: -0.3, skyHi: 0.9,
    sun: { color: 0xe8f0ff, i: 2.0, dir: [-8, 9, 6] }, hemi: [0xb8d0ff, 0x2a3f8a, 1.3], cloud: 0xe8f0ff, cloud2: 0x8fb0f5, deck: '#e4e9f5', trim: '#7b5cff',
    species: 'sp_neptune', tints: ['#ffffff', '#d8ecff', '#e8dcff'], fog: [0x8fb4f0, 60, 650], wind: true,
  },
};

// ---------------------------------------------------------------- builder
export function buildPlanetWorld(id) {
  const def = WORLD_DEFS[id];
  const scene = new THREE.Scene();
  const rnd = mulberry((def.seed || id.length * 17) * 7);
  scene.add(makeSky(def.sky, { lo: def.skyLo, hi: def.skyHi }));
  const stars = makeStars(1800, 850, { opacity: def.stars ?? 0.15 }); scene.add(stars);
  if (def.fog) scene.fog = new THREE.Fog(...def.fog);

  let base, padTop, planet = null, sway = null;
  if (def.rocky) {
    const R = def.radius;
    makeLights(scene, { sun: def.sun.color, sunI: def.sun.i, dir: def.sun.dir, sky: def.hemi[0], ground: def.hemi[1], hemiI: def.hemi[2], shadowSize: 8, target: [0, R, 0] });
    if (def.bigSun) scene.add(sunDisc(def.bigSun));
    planet = makePlanet({ radius: R, detail: 56, seed: def.seed, heightFn: def.height.bind(def), colorFn: def.color.bind(def), rough: 0.95 });
    scene.add(planet.mesh);
    base = new THREE.Group(); scene.add(base);
    const pad = model('padL', { height: 0.3 });
    const ps = new THREE.Box3().setFromObject(pad).getSize(V(0, 0, 0)); pad.scale.multiplyScalar(3.0 / Math.max(ps.x, ps.z));
    placeOn(planet, pad, V(0, 1, 0), { sink: 0.04 }); base.add(pad);
    padTop = new THREE.Box3().setFromObject(pad).max.y;
    for (const [key, n, hMin, hMax, tint] of def.props) {
      for (let i = 0; i < n; i++) {
        const m = model(key, { height: hMin + rnd() * (hMax - hMin) });
        if (tint) m.traverse(o => { if (o.isMesh) o.material.color.set(tint); });
        let d; do { d = dirFrom(0.42 + rnd() * 1.1, rnd() * 6.283); } while (Math.abs(Math.atan2(d.x, d.z)) < 0.6 && Math.acos(d.y) < 0.95);
        placeOn(planet, m, d, { spin: rnd() * 6.28, sink: 0.05 }); base.add(m);
      }
    }
    if (def.station) {
      const st = model('baseA', { height: 0.9 }); placeOn(planet, st, dirFrom(0.5, -2.0), { spin: 1.2, sink: 0.05 }); base.add(st);
      const tw = model('turbine', { height: 1.5 }); placeOn(planet, tw, dirFrom(0.55, 2.0), { spin: 0.4, sink: 0.05 }); base.add(tw);
    }
    if (def.lava) { // glowing lava vents on the volcano tops
      for (const v of def.volcanoes) { const g = new THREE.PointLight(0xff6a2a, 6, 4, 2); g.position.copy(v.dir).multiplyScalar(R + v.h * 0.85 + 0.3); scene.add(g); }
    }
    if (def.cloudColor) {
      const clouds = new THREE.Group(); scene.add(clouds);
      for (let i = 0; i < 8; i++) { const c = makeCloud(rnd, def.cloudColor, 0.7 + rnd() * 0.5); const d = dirFrom(0.55 + rnd(), rnd() * 6.28); c.position.copy(d.multiplyScalar(R + 2 + rnd() * 1.5)); c.lookAt(0, 0, 0); c.rotateX(Math.PI / 2); clouds.add(c); }
      sway = dt => { clouds.rotation.y += dt * 0.02; };
    }
  } else {
    makeLights(scene, { sun: def.sun.color, sunI: def.sun.i, dir: def.sun.dir, sky: def.hemi[0], ground: def.hemi[1], hemiI: def.hemi[2], shadowSize: 7, target: [0, 10, 0] });
    const built = buildSkyStation(scene, def, id, rnd);
    base = built.station; padTop = built.padTop; sway = built.update;
  }

  // aliens: a welcoming horseshoe open toward the camera (+Z)
  const aliens = [];
  const count = 7;
  const tint = i => new THREE.Color(def.tints[i % def.tints.length]);
  const R0 = def.rocky ? def.radius : 0;
  for (let i = 0; i < count; i++) {
    const a = character(def.species, { height: 0.62 + rnd() * 0.2 });
    a.traverse(o => { if (o.isMesh) o.material.color.copy(tint(i)); });
    const side = i % 2 ? 1 : -1, k = Math.floor((i + 1) / 2);
    const around = i === 0 ? Math.PI : side * (0.85 + k * 0.6);
    if (def.rocky) { placeOn(planet, a, dirFrom(0.3 + (k % 2) * 0.04, around)); aimAxis(a, V(0, R0 + 2, 12), V(0, 0, 1)); }
    else { const r = 2.55 + (k % 2) * 0.3; a.position.set(Math.sin(around) * r, padTop, Math.cos(around) * r); a.lookAt(0, padTop, 9); }
    base.add(a); aliens.push(a);
    a.userData.play('Idle'); a.userData.mixer.update(rnd() * 2);
  }
  // the guide: a bigger, untinted member of the species, front-left of the pad
  const guide = character(def.species, { height: 1.05 });
  if (def.rocky) { placeOn(planet, guide, dirFrom(0.25, 0.62)); aimAxis(guide, V(0, R0 + 2, 12), V(0, 0, 1)); }
  else { guide.position.set(1.75, padTop, 1.9); guide.lookAt(0, padTop, 9); }
  base.add(guide); guide.userData.play('Idle');

  const rocket = buildRocket(); rocket.root.scale.setScalar(1.05); rocket.root.position.set(0, padTop - 0.02, 0); rocket.root.visible = false; base.add(rocket.root);
  const astro = character('astronaut', { height: 0.72, recolor: { SciFi_Main: 0xf4f6f8, SciFi_MainDark: 0x2c3e50, SciFi_Light: 0xdfe6ee, SciFi_Light_Accent: 0x12a150, Grey: 0x9aa5b1 } });
  astro.visible = false; base.add(astro);

  const dust = new Particles(700); scene.add(dust.points);
  const fire = new Particles(400, { additive: true }); scene.add(fire.points);
  const confetti = new Confetti(500); scene.add(confetti.mesh);

  const cam = makeCam(V(1.4, padTop + 3.3, 9.0), V(0, padTop + 0.9, 0)); cam.snap();
  let t = 0;
  const w = {
    scene, def, id, base, padTop, aliens, guide, rocket, astro, cam, dust, fire, confetti, stars, planet,
    onUpdate: null,
    update(dt) {
      t += dt;
      for (const a of aliens) a.userData.update(dt);
      guide.userData.update(dt); astro.userData.update(dt);
      rocket.update(dt, t);
      stars.material.uniforms.time.value = t;
      sway && sway(dt, t);
      dust.update(dt); fire.update(dt); confetti.update(dt);
      w.onUpdate && w.onUpdate(dt, t);
      cam.apply(dt);
    },
  };
  return w;
}

// ---------------------------------------------------------------- floating sky station (gas / ice giants)
function buildSkyStation(scene, def, id, rnd) {
  // the giant below: a huge banded sphere, so its horizon curves gently under the clouds
  const giant = new THREE.Mesh(new THREE.SphereGeometry(400, 96, 64), new THREE.MeshStandardMaterial({ map: planetTexture(id), roughness: 0.95, emissive: 0xffffff, emissiveMap: planetTexture(id), emissiveIntensity: 0.12 }));
  giant.position.set(0, -404, -60); giant.rotation.set(0.2, 0.8, def.tilt ? 1.2 : 0.05); scene.add(giant);
  // cloud sea
  const clouds = new THREE.Group(); scene.add(clouds);
  for (let i = 0; i < 26; i++) {
    const c = makeCloud(rnd, i % 3 ? def.cloud : def.cloud2, 1.6 + rnd() * 2.2);
    const a = rnd() * Math.PI * 2, r = 7 + rnd() * 40;
    c.position.set(Math.cos(a) * r, 2 + rnd() * 4.5, Math.sin(a) * r - 6); clouds.add(c);
  }
  if (def.rings) { // Saturn's rings arc across the sky
    const ring = planetMesh('saturn', 1).userData.ring.clone();
    ring.material = ring.material.clone(); ring.material.opacity = 0.85; ring.material.fog = false;
    ring.scale.setScalar(160); ring.position.set(0, -60, -260); ring.rotation.set(-1.25, 0.15, 0.32); scene.add(ring);
  }
  if (id === 'jupiter') { // two Galilean moons hanging in the sky
    for (const [x, y, s, look] of [[-90, 60, 7, 'mercury'], [120, 85, 5, 'mars']]) { const m = planetMesh(look, s); m.position.set(x, y, -240); scene.add(m); }
  }
  if (id === 'neptune') { const tri = planetMesh('mercury', 6); tri.position.set(-110, 70, -250); scene.add(tri); } // Triton

  const station = new THREE.Group(); scene.add(station);
  const deckY = 10;
  const deckMat = mat(def.deck, { rough: 0.45, metal: 0.35, envI: 0.8 }), dark = mat('#3b4258', { rough: 0.4, metal: 0.6 }), trim = mat(def.trim, { rough: 0.4, emissive: def.trim, emissiveI: 0.35 });
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(4.3, 4.0, 0.45, 64), deckMat); deck.position.y = deckY - 0.225; station.add(deck);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(4.25, 0.09, 12, 96), trim); rim.rotation.x = Math.PI / 2; rim.position.y = deckY; station.add(rim);
  // landing circle
  const pc = document.createElement('canvas'); pc.width = pc.height = 512; const x = pc.getContext('2d');
  x.fillStyle = '#3b4258'; x.beginPath(); x.arc(256, 256, 250, 0, 7); x.fill();
  x.strokeStyle = def.trim; x.lineWidth = 22; x.beginPath(); x.arc(256, 256, 214, 0, 7); x.stroke();
  x.strokeStyle = '#ffffff'; x.lineWidth = 10; for (let i = 0; i < 12; i++) { x.beginPath(); x.arc(256, 256, 180, i * 0.5236 + 0.08, i * 0.5236 + 0.4); x.stroke(); }
  x.fillStyle = '#ffffff'; x.fillRect(156, 196, 36, 120); x.fillRect(320, 196, 36, 120); x.fillRect(156, 240, 200, 32);
  const ptex = new THREE.CanvasTexture(pc); ptex.colorSpace = THREE.SRGBColorSpace; ptex.anisotropy = 8;
  const pad = new THREE.Mesh(new THREE.CircleGeometry(1.45, 64), new THREE.MeshStandardMaterial({ map: ptex, roughness: 0.6 }));
  pad.rotation.x = -Math.PI / 2; pad.position.y = deckY + 0.012; station.add(pad);
  // railing
  for (let i = 0; i < 28; i++) {
    const a = i / 28 * Math.PI * 2; if (Math.abs(Math.sin(a / 2)) < 0.12) continue; // opening at the front
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.55, 8), dark); post.position.set(Math.sin(a) * 4.05, deckY + 0.27, Math.cos(a) * 4.05); station.add(post);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), trim); lamp.position.set(Math.sin(a) * 4.05, deckY + 0.57, Math.cos(a) * 4.05); station.add(lamp);
  }
  const rail = new THREE.Mesh(new THREE.TorusGeometry(4.05, 0.03, 8, 96, Math.PI * 2 - 0.9), dark); rail.rotation.x = Math.PI / 2; rail.rotation.z = Math.PI / 2 + 0.45; rail.position.y = deckY + 0.5; station.add(rail);
  // underside: hull, thrusters with glow
  const hull = new THREE.Mesh(new THREE.ConeGeometry(4.0, 2.2, 48, 1, true), dark); hull.rotation.x = Math.PI; hull.position.y = deckY - 1.55; station.add(hull);
  const glows = [];
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.55, 0.9, 24), deckMat); pod.position.set(Math.sin(a) * 3.1, deckY - 0.9, Math.cos(a) * 3.1); station.add(pod);
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.38, 24), new THREE.MeshBasicMaterial({ color: 0x8fe8ff, transparent: true, opacity: 0.9, toneMapped: false })); glow.rotation.x = Math.PI / 2; glow.position.set(Math.sin(a) * 3.1, deckY - 1.36, Math.cos(a) * 3.1); station.add(glow); glows.push(glow);
  }
  // deck dressing (kept to the back half)
  const dressing = [['hangarGlass', 1.1, -2.2, -2.4, 0.6], ['solar', 0.9, 2.6, -2.3, -0.5], ['dish', 1.2, -3.0, -0.6, 1.2], ['cargo', 0.7, 3.1, -0.4, 0.2], ['lights', 0.8, 0.4, -3.4, 0]];
  for (const [k, h, px, pz, ry] of dressing) { const m = model(k, { height: h }); m.position.set(px, deckY, pz); m.rotation.y = ry; station.add(m); }
  station.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  glows.forEach(g => { g.castShadow = false; });

  const update = (dt, t) => {
    station.position.y = Math.sin(t * 0.8) * 0.08;
    station.rotation.z = Math.sin(t * 0.6) * 0.01;
    clouds.children.forEach((c, i) => { c.position.x += dt * (def.wind ? 2.2 : 0.5) * (1 + (i % 3) * 0.3); if (c.position.x > 48) c.position.x -= 96; });
    glows.forEach((g, i) => { g.material.opacity = 0.75 + Math.sin(t * 6 + i) * 0.2; });
    giant.rotation.y += dt * 0.004;
  };
  return { station, padTop: deckY, update };
}

function sunDisc({ size, pos }) {
  const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d');
  const gr = x.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, '#fffbe8'); gr.addColorStop(0.4, '#fff1b8'); gr.addColorStop(0.48, 'rgba(255,214,120,0.6)'); gr.addColorStop(1, 'rgba(255,170,60,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, fog: false, toneMapped: false }));
  s.scale.set(size * 4, size * 4, 1); s.position.set(...pos); s.renderOrder = -8;
  return s;
}
