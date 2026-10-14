import * as THREE from 'three';
import { gfx, mat, makeSky, makeStars } from '../gfx.js';
import { model } from '../models.js';
import { buildRocket } from '../rocket.js';
import { switchWorld, makeCam, app } from '../game.js';
import { sleep, tween, ease, onFrame } from '../loop.js';
import { showQuestion, banner, hint, unmount, ar, toast } from '../ui.js';
import { music, sfx } from '../audio.js';
import { PLANETS } from '../content.js';
import { state, save, pickQuestions, DIFFICULTY } from '../state.js';
import { flightHUD, PLANET_COLORS } from '../hud.js';
import { planetMesh, nebulaTexture, glowShell } from '../textures.js';
import { Particles } from '../particles.js';
import { runRepair } from './repair.js';
import { makeRock, ROCK_PALETTES, brokenSatellite, glowSprite } from '../art.js';

const ROCKET_X = -5;
const SPEED = 7;
const GAP = SPEED * 7.5;     // distance between obstacles
const TRIGGER_X = 2.2;       // obstacle x where the question pops

const SKY_TINT = {
  mercury: ['#120a26', '#2a1440', '#4a2242'], venus: ['#140a22', '#2c1638', '#4c2a2a'], mars: ['#0e0a24', '#24123c', '#3e1a30'],
  jupiter: ['#0a0a22', '#1c1640', '#33243e'], saturn: ['#0a0b20', '#1a1a3e', '#2e2a3c'], uranus: ['#060c1e', '#10243a', '#163a46'], neptune: ['#050819', '#0c1a3c', '#122a5a'],
};

function buildSpace(leg) {
  const p = PLANETS[leg]; const id = p.id;
  const scene = new THREE.Scene();
  const tint = SKY_TINT[id];
  const sky = makeSky([[0, tint[2]], [0.45, tint[1]], [1, tint[0]]], { lo: -0.6, hi: 0.7 }); scene.add(sky);
  const stars = makeStars(3000, 800, { opacity: 1, seed: 11 + leg }); scene.add(stars);
  // nebulae
  const nebColors = ['#7b5cff', '#ff5aa8', '#2ec4b6', '#3d8bff'];
  for (let i = 0; i < 3; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: nebulaTexture(nebColors[(i + leg) % 4]), transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    s.position.set(-120 + i * 140, (i % 2 ? 40 : -50), -380); s.scale.setScalar(260 + i * 40); s.renderOrder = -8; scene.add(s);
  }
  // light from the sun (behind-left)
  scene.add(new THREE.HemisphereLight(0xbfc8ff, 0x302040, 0.9));
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const sunLight = new THREE.DirectionalLight(0xfff0d8, 3.0); sunLight.position.set(-10, 6, 8); scene.add(sunLight);
  const rim = new THREE.DirectionalLight(PLANET_COLORS[id], 1.2); rim.position.set(10, 2, -6); scene.add(rim);

  // the Sun far away (smaller on later legs)
  const sun = planetMesh('sun', 1, { segments: 48 }); const sunSize = 26 / (1 + leg * 0.9);
  sun.scale.setScalar(sunSize); sun.position.set(-130, 135, -420); scene.add(sun);
  const sunGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffc860, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  sunGlow.scale.setScalar(sunSize * 5); sunGlow.position.copy(sun.position); scene.add(sunGlow);

  // destination planet (grows as we approach)
  const dest = planetMesh(id, 1, { segments: 72 });
  dest.position.set(60, -4, -150); dest.scale.setScalar(4); scene.add(dest);

  // speed dust
  const dustN = 260, dpos = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) dpos.set([(Math.random() - 0.5) * 60, (Math.random() - 0.5) * 22, -2 - Math.random() * 30], i * 3);
  const dgeo = new THREE.BufferGeometry(); dgeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  const dust = new THREE.Points(dgeo, new THREE.PointsMaterial({ color: 0xcfd8ff, size: 0.09, transparent: true, opacity: 0.7, depthWrite: false })); scene.add(dust);

  const rocket = buildRocket(); rocket.root.rotation.z = -Math.PI / 2; rocket.setHorizontal(true); rocket.setThrust(0.75); rocket.setPilot(true);
  rocket.root.position.set(ROCKET_X, 0, 0); rocket.legs.visible = false;
  const rocketPivot = new THREE.Group(); rocketPivot.add(rocket.root); scene.add(rocketPivot);
  rocket.root.position.set(0, 0, 0); rocketPivot.position.set(ROCKET_X, 0, 0);

  const fx = new Particles(1200, { additive: true }); scene.add(fx.points);
  const smoke = new Particles(500); scene.add(smoke.points);

  const cam = makeCam(new THREE.Vector3(0.5, 0.3, 13.5), new THREE.Vector3(0.8, 0, 0)); cam.drift = 0.4; cam.snap(); cam.lerp = 0.06;
  let t = 0;
  const w = {
    scene, rocket, rocketPivot, dest, sun, stars, dust, fx, smoke, cam, onUpdate: null, speedK: 1,
    update(dt) {
      t += dt;
      stars.material.uniforms.time.value = t;
      rocket.update(dt, t);
      // dust streams past
      const a = dust.geometry.attributes.position;
      for (let i = 0; i < dustN; i++) { let x = a.getX(i) - dt * SPEED * 2.2 * w.speedK; if (x < -30) x += 60; a.setX(i, x); }
      a.needsUpdate = true;
      dest.userData.sphere.rotation.y += dt * 0.05;
      sun.rotation.y += dt * 0.02;
      // engine exhaust
      const n = rocketPivot.position; const k = w.speedK;
      if (rocket.flame.visible) fx.emit({ pos: [n.x - 1.25, n.y, n.z], vel: [-6 * (0.4 + k), 0, 0], velSpread: 1.2, spread: 0.18, life: 0.35, size: 0.5, sizeEnd: 0.05, color: 0xfff1b0, colorEnd: 0xff5a1f, alpha: 0.9, count: 2 });
      fx.update(dt); smoke.update(dt);
      w.onUpdate && w.onUpdate(dt, t);
      cam.apply(dt);
    },
  };
  return w;
}

let _glow = null;
function glowTex() {
  if (_glow) return _glow;
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); _glow = new THREE.CanvasTexture(c); return _glow;
}

// ---------------------------------------------------------------- obstacles
const ROGUE_LOOKS = ['mercury', 'mars', 'venus', 'neptune', 'uranus'];
function makeObstacle(kind, leg, i) {
  const g = new THREE.Group(); const body = new THREE.Group(); g.add(body);
  g.userData.kind = kind; g.userData.radius = 1.2;
  if (kind === 'meteor') {
    const pal = [ROCK_PALETTES.space, { colA: '#a08068', colB: '#5a4232', colC: '#c9a78a' }, { colA: '#8a8f9e', colB: '#4c505e', colC: '#b6bccb' }][(leg + i) % 3];
    const m = makeRock(leg * 5 + i, 1.05, { ...pal, detail: 4, rough: 0.38, squash: 0.82, craters: 5 });
    body.add(m); g.userData.spin = [0.5, 0.8, 0.25];
  } else if (kind === 'debris') {
    const sat = brokenSatellite(); sat.scale.setScalar(1.25); body.add(sat); g.userData.spin = [0.7, 0.45, 0.6];
  } else if (kind === 'rogue') {
    const p = planetMesh(ROGUE_LOOKS[(leg + i) % ROGUE_LOOKS.length], 0.95, { segments: 48 });
    p.rotation.z = 0; body.add(p);
    g.add(grumpyFace(0.95)); g.userData.spin = [0, 0.6, 0];
  } else { // comet
    const core = makeRock(31 + i, 0.82, { ...ROCK_PALETTES.ice, detail: 3, craters: 3, rough: 0.3 });
    const halo = glowShell(0.8, 0x8fd0ff, 1.2); halo.scale.setScalar(1.5); body.add(halo);
    body.add(core); g.userData.spin = [0.4, 0.7, 0.2]; g.userData.comet = true;
  }
  // warning ring
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.55, 1.7, 48), new THREE.MeshBasicMaterial({ color: 0xff4d5a, transparent: true, opacity: 0, depthWrite: false }));
  g.add(ring); g.userData.ring = ring;
  g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  return g;
}

function grumpyFace(r) {
  const f = new THREE.Group(); const white = mat('#ffffff', { rough: 0.3 }), black = mat('#1a1530', { rough: 0.2, envI: 1.5 });
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(r * 0.24, 20, 14), white); eye.position.set(s * r * 0.32, r * 0.12, r * 0.86); eye.scale.z = 0.5;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(r * 0.12, 16, 12), black); pupil.position.set(s * r * 0.3 - r * 0.04, r * 0.1, r * 0.98);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(r * 0.42, r * 0.09, r * 0.08), black); brow.position.set(s * r * 0.32, r * 0.42, r * 0.9); brow.rotation.z = s * -0.45;
    f.add(eye, pupil, brow);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(r * 0.2, r * 0.045, 8, 20, Math.PI), black); mouth.position.set(0, -r * 0.38, r * 0.9); f.add(mouth);
  return f;
}

// ---------------------------------------------------------------- star pickups
const starGeo = (() => {
  const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.17 : 0.38; i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.05, bevelSegments: 2 }); g.center(); return g;
})();
const starMat = () => mat('#ffcc33', { rough: 0.25, metal: 0.5, emissive: 0xffa000, emissiveI: 0.55, envI: 1.4 });

// ---------------------------------------------------------------- the flight
export async function flight(leg) {
  const planet = PLANETS[leg];
  const w = await switchWorld(() => buildSpace(leg));
  music.play('space');
  const perLeg = DIFFICULTY[state.diff].perLeg;
  const questions = pickQuestions(planet.id); save();
  const hud = flightHUD(leg);
  const total = (perLeg + 1) * GAP;
  let travelled = 0, mode = 'intro', targetY = 0, vy = 0, damaged = false;
  const obstacles = []; const pickups = []; let nextObstacle = 0, nextStars = 12;
  const kinds = ['meteor', 'debris', 'rogue', 'comet'];

  // input
  const canvas = gfx.renderer.domElement; const ray = new THREE.Raycaster(); const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0); const hit = new THREE.Vector3();
  const toY = e => { const r = canvas.getBoundingClientRect(); ray.setFromCamera({ x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -((e.clientY - r.top) / r.height) * 2 + 1 }, gfx.camera); if (ray.ray.intersectPlane(plane, hit)) targetY = THREE.MathUtils.clamp(hit.y, -3.4, 3.4); };
  let down = false;
  const pd = e => { down = true; if (mode === 'fly') toY(e); }, pm = e => { if ((down || e.pointerType === 'mouse') && mode === 'fly') toY(e); }, pu = () => { down = false; };
  const kd = e => { if (mode !== 'fly') return; if (e.key === 'ArrowUp' || e.key === 'w') targetY = Math.min(3.4, targetY + 1.1); if (e.key === 'ArrowDown' || e.key === 's') targetY = Math.max(-3.4, targetY - 1.1); };
  canvas.addEventListener('pointerdown', pd); window.addEventListener('pointermove', pm); window.addEventListener('pointerup', pu); window.addEventListener('keydown', kd);
  const cleanup = () => { canvas.removeEventListener('pointerdown', pd); window.removeEventListener('pointermove', pm); window.removeEventListener('pointerup', pu); window.removeEventListener('keydown', kd); };

  const rp = w.rocketPivot.position;
  let arrive;
  const arrived = new Promise(r => (arrive = r));

  w.onUpdate = (dt, t) => {
    const k = w.speedK; const dx = SPEED * k * dt;
    if (mode === 'fly' || mode === 'arriving') travelled += dx;
    hud.progress(Math.min(1, travelled / total));
    // rocket steering with soft spring + tilt
    if (mode === 'fly') { vy += ((targetY - rp.y) * 14 - vy * 7) * dt; rp.y += vy * dt; }
    w.rocketPivot.rotation.z = THREE.MathUtils.lerp(w.rocketPivot.rotation.z, THREE.MathUtils.clamp(vy * 0.06, -0.35, 0.35), 0.15);
    w.rocket.body.position.x = Math.sin(t * 2.2) * 0.04; // gentle bob
    // destination grows
    const prog = Math.min(1, travelled / total);
    w.dest.scale.setScalar(4 + prog * prog * 14); w.dest.position.set(60 - prog * 18, -4 + prog * 2, -150 + prog * 40);
    // spawn obstacles
    if (mode === 'fly' && nextObstacle < perLeg && travelled >= (nextObstacle + 1) * GAP - 16) {
      const ob = makeObstacle(kinds[(nextObstacle + leg) % kinds.length], leg, nextObstacle);
      ob.position.set(14, THREE.MathUtils.clamp(rp.y + (Math.random() - 0.5) * 3, -3, 3), 0); ob.userData.q = questions[nextObstacle];
      ob.userData.idx = nextObstacle; w.scene.add(ob); obstacles.push(ob); nextObstacle++;
      sfx.warn();
    }
    // spawn star arcs
    if (mode === 'fly' && travelled > nextStars && travelled < total - 10) {
      const y0 = (Math.random() - 0.5) * 5, amp = 0.6 + Math.random() * 1.2, ph = Math.random() * 6;
      for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(starGeo, starMat()); s.add(glowSprite(0xffd35a, 1.5, 0.55)); s.userData.ph = Math.random() * 6; s.position.set(14 + i * 1.1, THREE.MathUtils.clamp(y0 + Math.sin(ph + i * 0.7) * amp, -3.3, 3.3), 0); w.scene.add(s); pickups.push(s); }
      nextStars = travelled + 18 + Math.random() * 10;
    }
    // move pickups
    for (let i = pickups.length - 1; i >= 0; i--) {
      const s = pickups[i]; s.position.x -= dx; s.rotation.y = Math.sin(t * 3 + s.userData.ph) * 0.5; s.rotation.z = Math.sin(t * 2 + s.userData.ph) * 0.15;
      if (Math.abs(s.position.x - rp.x) < 0.9 && Math.abs(s.position.y - rp.y) < 0.75 && mode === 'fly') {
        state.score += 10; state.stars++; hud.score(); sfx.star();
        w.fx.emit({ pos: [s.position.x, s.position.y, 0], velSpread: 4, life: 0.5, size: 0.35, sizeEnd: 0, color: 0xfff3a0, colorEnd: 0xffa000, count: 10 });
        w.scene.remove(s); pickups.splice(i, 1); continue;
      }
      if (s.position.x < -16) { w.scene.remove(s); pickups.splice(i, 1); }
    }
    // obstacles approach and home in on the rocket
    for (const ob of obstacles) {
      if (ob.userData.dead) continue;
      const sp = ob.userData.spin; ob.children[0].rotation.x += sp[0] * dt; ob.children[0].rotation.y += sp[1] * dt; ob.children[0].rotation.z += sp[2] * dt;
      ob.userData.ring.lookAt(gfx.camera.position);
      if (ob.userData.comet && Math.random() < 0.9) w.fx.emit({ pos: [ob.position.x + 0.6, ob.position.y, ob.position.z], vel: [3 + k * 4, 0, 0], velSpread: 0.6, spread: 0.6, life: 0.9, size: 0.9, sizeEnd: 0.2, color: 0xbfe6ff, colorEnd: 0x5a7bff, alpha: 0.6, count: 2 });
      if (mode === 'fly') {
        ob.position.x -= dx * 1.15;
        ob.position.y += (rp.y - ob.position.y) * Math.min(1, dt * 0.8);
        const near = THREE.MathUtils.clamp(1 - (ob.position.x - TRIGGER_X) / 10, 0, 1);
        ob.userData.ring.material.opacity = near * (0.55 + 0.35 * Math.sin(t * 10));
        if (ob.position.x <= TRIGGER_X && !ob.userData.asked) { ob.userData.asked = true; encounter(ob); }
      }
    }
    // damaged rocket smokes
    if (damaged && Math.random() < 0.7) w.smoke.emit({ pos: [rp.x + 0.2, rp.y + 0.2, 0.3], vel: [-2.5, 0.8, 0], velSpread: 0.6, life: 1.4, size: 0.3, sizeEnd: 1.2, color: 0x6b6b7a, colorEnd: 0x3a3a48, alpha: 0.7, drag: 0.5 });
    if (damaged && Math.random() < 0.25) w.fx.emit({ pos: [rp.x + 0.3, rp.y + 0.35, 0.4], velSpread: 3, life: 0.3, size: 0.12, sizeEnd: 0, color: 0xfff0a0, colorEnd: 0xff8a00, count: 3 });
    // arrival
    if (mode === 'fly' && nextObstacle >= perLeg && obstacles.every(o => o.userData.dead) && travelled >= total) { mode = 'arriving'; arrive(); }
  };

  async function encounter(ob) {
    mode = 'question';
    // ease to a stop, lift both into the upper half so the question panel never covers them
    tween(0.6, k => { w.speedK = 1 - k; }, ease.out);
    const oy = ob.position.y, ry = rp.y;
    tween(0.9, k => { ob.position.y = THREE.MathUtils.lerp(oy, 1.55, k); rp.y = THREE.MathUtils.lerp(ry, 1.55, k); vy = 0; }, ease.inOut);
    const ct = w.cam.target.clone(), cp = w.cam.pos.clone();
    w.cam.target.set(ct.x - 1.2, -0.85, 0); w.cam.pos.set(cp.x - 1.2, -0.3, 12.4);
    music.duck(0.45);
    const q = ob.userData.q;
    const ok = await showQuestion(q, { badge: `عقبة ${ar(ob.userData.idx + 1)} من ${ar(perLeg)}`, fun: !!q.fun, onAnswer: async right => {
      state.answered++;
      if (right) { state.correct++; state.score += 100; hud.score(); await sleep(0.2); await blast(ob); }
    } });
    music.duck(1);
    if (!ok) {
      await crash(ob);
      damaged = true;
      sfx.alarm();
      await banner('الصاروخ تضرّر!', 'أصلحه لتتابع رحلتك', { top: 120, hold: 1700 });
      await runRepair(w);
      damaged = false; state.repairs++;
      toast('تم إصلاح الصاروخ! 🔧', 1500);
    }
    save();
    w.cam.target.set(0.8, 0, 0); w.cam.pos.set(0.5, 0.3, 13.5);
    targetY = rp.y; mode = 'fly';
    tween(1.0, k => { w.speedK = k; }, ease.inOut);
  }

  async function blast(ob) {
    const from = new THREE.Vector3(rp.x + 1.35, rp.y, 0), to = ob.position.clone();
    for (let shot = 0; shot < 2; shot++) {
      sfx.laser();
      const len = from.distanceTo(to);
      const beam = new THREE.Group();
      const core = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, len, 10), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      const glow = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, len, 14), new THREE.MeshBasicMaterial({ color: 0x3dff9a, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
      beam.add(core, glow); beam.position.copy(from).lerp(to, 0.5); beam.lookAt(to); beam.rotateX(Math.PI / 2);
      w.scene.add(beam);
      await tween(0.22, k => { const s = 1 - k; core.material.opacity = s; glow.material.opacity = 0.55 * s; beam.scale.x = beam.scale.z = 1 + k; }, ease.out);
      w.scene.remove(beam);
      w.fx.emit({ pos: [to.x - 0.8, to.y, 0.3], velSpread: 5, life: 0.4, size: 0.4, sizeEnd: 0, color: 0xbfffd8, colorEnd: 0x3dff9a, count: 14 });
    }
    explode(ob);
    await sleep(0.5);
  }

  function explode(ob) {
    sfx.boom();
    ob.userData.dead = true; ob.visible = false;
    const c = ob.position;
    w.fx.emit({ pos: [c.x, c.y, c.z], velSpread: 9, life: 0.8, size: 1.0, sizeEnd: 0.1, color: 0xfff0b0, colorEnd: 0xff6a20, alpha: 0.9, count: 40, drag: 2 });
    w.smoke.emit({ pos: [c.x, c.y, c.z], velSpread: 3, life: 1.6, size: 0.8, sizeEnd: 2.2, color: 0x9a8f99, colorEnd: 0x4a4458, alpha: 0.55, count: 18, drag: 1.5 });
    const col = ob.userData.kind === 'comet' ? '#cfe9ff' : '#8f7a68';
    for (let i = 0; i < 10; i++) {
      const ch = makeRock(20 + i, 0.12 + Math.random() * 0.16, ob.userData.kind === 'comet' ? { ...ROCK_PALETTES.ice, detail: 1 } : { ...ROCK_PALETTES.space, detail: 1 });
      ch.position.copy(c); w.scene.add(ch); const s0 = ch.scale.x;
      const v = new THREE.Vector3((Math.random() - 0.3) * 9, (Math.random() - 0.5) * 9, (Math.random() - 0.5) * 5); const sp = new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8);
      tween(1.6, k => { ch.position.addScaledVector(v, 1 / 60); v.multiplyScalar(0.985); ch.rotation.x += sp.x / 60; ch.rotation.y += sp.y / 60; ch.scale.setScalar(Math.max(0.001, s0 * (1 - k * k))); }, ease.linear).then(() => w.scene.remove(ch));
    }
  }

  async function crash(ob) {
    ob.userData.ring.material.opacity = 0;
    const start = ob.position.clone();
    await tween(0.55, k => { ob.position.lerpVectors(start, new THREE.Vector3(rp.x + 1.1, rp.y, 0), k); }, ease.in);
    sfx.hit();
    explode(ob);
    // knocked back and wobbling
    const x0 = rp.x;
    await tween(0.9, k => { rp.x = x0 - Math.sin(k * Math.PI) * 1.2; w.rocketPivot.rotation.z = Math.sin(k * Math.PI * 4) * 0.4 * (1 - k); }, ease.out);
    rp.x = x0;
  }

  // ---- run
  w.rocketPivot.position.x = -12;
  await tween(1.6, k => { rp.x = THREE.MathUtils.lerp(-12, ROCKET_X, k); }, ease.out);
  banner(`المحطة التالية: ${planet.name}`, planet.title, { top: 120, hold: 2200 });
  const h = hint('اسحب للأعلى والأسفل لتوجيه الصاروخ وجمع النجوم ⭐', { bottom: 36 });
  mode = 'fly';
  setTimeout(() => unmount(h), 5000);
  await arrived;
  // arrival: the planet swells, the rocket dives toward it
  sfx.whoosh();
  banner(`وصلنا إلى ${planet.name}!`, null, { top: 140, hold: 2000 });
  const d0 = w.dest.position.clone(), s0 = w.dest.scale.x;
  w.cam.lerp = 0.04;
  await tween(2.6, k => {
    w.dest.position.lerpVectors(d0, new THREE.Vector3(14, -2, -40), k); w.dest.scale.setScalar(s0 + k * 20);
    rp.x = ROCKET_X + k * 14; rp.y *= 0.96; w.rocketPivot.scale.setScalar(1 - k * 0.7);
  }, ease.in);
  cleanup();
}
