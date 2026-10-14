import * as THREE from 'three';
import { makeSky, makeStars } from '../gfx.js';
import { buildRocket } from '../rocket.js';
import { switchWorld, makeCam } from '../game.js';
import { sleep, tween, ease, onFrame } from '../loop.js';
import { el, mount, unmount, button, banner, T, ar } from '../ui.js';
import { music, sfx, MUSIC } from '../audio.js';
import { state, save, DIFFICULTY } from '../state.js';
import { planetMesh, glowShell } from '../textures.js';
import { Particles } from '../particles.js';

const ROW = [['mercury', 0.38], ['venus', 0.62], ['earth', 0.66], ['mars', 0.48], ['jupiter', 1.55], ['saturn', 1.3], ['uranus', 0.95], ['neptune', 0.92]];

function buildFinale() {
  const scene = new THREE.Scene();
  scene.add(makeSky([[0, '#2a1650'], [0.5, '#130d36'], [1, '#05061a']], { lo: -0.6, hi: 0.7 }));
  const stars = makeStars(3200, 800, { opacity: 1, seed: 99 }); scene.add(stars);
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));
  const sunLight = new THREE.PointLight(0xfff0d0, 900, 0, 1.6); sunLight.position.set(-17, 0, 0); scene.add(sunLight);
  scene.add(new THREE.HemisphereLight(0xc8d0ff, 0x302040, 0.6));
  const sun = planetMesh('sun', 4.2); sun.position.set(-19, 0, 0); scene.add(sun);
  const corona = glowShell(4.2, 0xffb84a, 1.4); corona.scale.setScalar(1.25); sun.add(corona);
  const planets = [];
  let x = -12.2;
  for (const [id, r] of ROW) {
    x += r + 0.75;
    const p = planetMesh(id, r, { segments: 48 }); p.position.set(x, 0, 0); scene.add(p); planets.push(p);
    x += r + 0.35;
  }
  // Pluto, the dwarf planet, waving from the Kuiper belt
  const pluto = planetMesh('mercury', 0.2, { segments: 24 }); pluto.position.set(x + 1.2, 0.6, -1); scene.add(pluto);
  const rocket = buildRocket(); rocket.root.rotation.z = -Math.PI / 2; rocket.setHorizontal(true); rocket.legs.visible = false; rocket.setThrust(0.7);
  rocket.root.scale.setScalar(0.55); rocket.root.position.set(-14, 2.6, 2); scene.add(rocket.root);
  const fx = new Particles(1500, { additive: true }); scene.add(fx.points);
  const cam = makeCam(new THREE.Vector3(1.5, 2.2, 21), new THREE.Vector3(1.5, 0.3, 0)); cam.drift = 0.6; cam.snap();
  let t = 0;
  return {
    scene, cam, fx, rocket, planets, onUpdate: null,
    update(dt) {
      t += dt; stars.material.uniforms.time.value = t; rocket.update(dt, t);
      planets.forEach((p, i) => { p.userData.sphere.rotation.y += dt * (0.2 + i * 0.03); p.position.y = Math.sin(t * 0.8 + i * 0.7) * 0.12; });
      sun.rotation.y += dt * 0.05; pluto.position.y = 0.6 + Math.sin(t * 2) * 0.1;
      fx.update(dt); this.onUpdate && this.onUpdate(dt, t); cam.apply(dt);
    },
  };
}

function rankFor(pct) {
  if (pct >= 90) return 'قائد فضاء أسطوري';
  if (pct >= 70) return 'رائد فضاء متميّز';
  if (pct >= 50) return 'مستكشف فضاء واعد';
  return 'متدرّب فضاء طموح';
}

export async function finale(back) {
  const w = await switchWorld(() => buildFinale());
  music.play('finale', { restart: true });
  const r = w.rocket.root;
  // rocket flies along the parade of planets
  const fly = onFrame(() => w.fx.emit({ pos: [r.position.x - 0.7, r.position.y, r.position.z], vel: [-4, 0, 0], velSpread: 0.8, spread: 0.1, life: 0.35, size: 0.3, sizeEnd: 0.03, color: 0xfff1b0, colorEnd: 0xff5a1f, alpha: 0.9, count: 2 }));
  tween(7, k => { r.position.x = -14 + k * 30; r.position.y = 2.6 + Math.sin(k * Math.PI * 3) * 0.5; }, ease.inOut).then(fly);
  await sleep(1.2);
  await banner('مبروك! أكملت الرحلة 🎉', 'زرت كواكب المجموعة الشمسية الثمانية', { top: 60, hold: 3200 });
  // gentle fireworks
  let fw = true;
  (async () => { while (fw) { firework(w.fx); sfx.pop(); await sleep(0.9 + Math.random() * 0.8); } })();
  await sleep(1.5);

  w.cam.lerp = 0.03; w.cam.pos.set(1.5, -2.2, 23); w.cam.target.set(1.5, -4.6, 0);
  const pct = state.answered ? Math.round(100 * state.correct / state.answered) : 100;
  const date = new Date().toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' });
  const cert = el('div', 'panel cert pop-in');
  cert.innerHTML = `
    <div class="h">${T('شهادة رائد فضاء')}</div>
    <p>${T('تمنح وكالة «رحلة الصقر» هذه الشهادة إلى')}</p>
    <div class="who">${T(state.name)}</div>
    <p>${T(`تقديرًا لإتمام الرحلة من الأرض إلى نبتون بنجاح، ونيل لقب «${rankFor(pct)}»`)}</p>
    <div class="nums">
      <div><b>${ar(state.correct)} / ${ar(state.answered)}</b><small>${T('إجابات صحيحة')}</small></div>
      <div><b>${ar(pct)}٪</b><small>${T('الدقة')}</small></div>
      <div><b>${ar(state.score)}</b><small>${T('النقاط')}</small></div>
    </div>
    <p style="font-size:21px;opacity:.75">${T(`المستوى: ${DIFFICULTY[state.diff].label} · ${date}`)}</p>
    <div class="go" style="display:flex;gap:16px;justify-content:center;margin-top:14px"></div>`;
  const next = button('متابعة', 'gold', async () => { await unmount(cert); await credits(); fw = false; back(); });
  cert.querySelector('.go').append(next);
  mount(cert);
  cert.style.left = '50%'; cert.style.top = '50%'; cert.style.marginLeft = (-cert.offsetWidth / 2) + 'px'; cert.style.marginTop = (-cert.offsetHeight / 2 + 36) + 'px';
  sfx.done();
}

function firework(fx) {
  const x = -10 + Math.random() * 22, y = 3 + Math.random() * 3, z = -3 - Math.random() * 3;
  const cols = [[0xffd36b, 0xff7a3a], [0x8fe8ff, 0x3d8bff], [0xffa6e6, 0x7b5cff], [0xb8ffb0, 0x12a150]][Math.floor(Math.random() * 4)];
  for (let i = 0; i < 60; i++) {
    const a = Math.random() * Math.PI * 2, b = Math.acos(Math.random() * 2 - 1), s = 3 + Math.random() * 1.2;
    fx.emit({ pos: [x, y, z], vel: [Math.sin(b) * Math.cos(a) * s, Math.cos(b) * s, Math.sin(b) * Math.sin(a) * s], life: 1.3, size: 0.28, sizeEnd: 0.05, color: cols[0], colorEnd: cols[1], alpha: 0.85, drag: 1.4, gravity: [0, -1.5, 0] });
  }
}

// ---------------------------------------------------------------- end credits
const TRACKS = {
  'title_a.mp3': 'Darbuka Delight — Adiutorium', 'title_b.mp3': "Fouler l'horizon — Komiku", 'title_c.mp3': 'Arabesque — brainiac256 (CC-BY 3.0)',
  'space_a.mp3': 'Time to go to space now !! — Komiku', 'space_b.mp3': 'Battle of Pogs — Komiku',
  'repair_a.mp3': 'Time Attack against the universe — Komiku', 'repair_b.mp3': 'Fetch Contest — Komiku',
  'celebrate_a.mp3': 'Disco Cat — Komiku', 'celebrate_b.mp3': 'The weekly fair — Komiku',
  'finale_a.mp3': 'Ending — Komiku', 'finale_b.mp3': 'Victory — Komiku', 'finale_c.mp3': 'End of the trip — Komiku',
};
function credits() {
  return new Promise(resolve => {
    const songs = [...new Set(Object.values(MUSIC).map(p => TRACKS[p.split('/').pop()]).filter(Boolean))];
    const wrap = el('div', 'credits fade-in');
    const roll = el('div', 'roll');
    roll.innerHTML = `
      <div class="cr-logo">رحلة <span>الصقر</span></div>
      <div class="cr-role">${T('فكرة اللعبة وإعدادها وتصميمها')}</div>
      <div class="cr-name">${T('علياء علي المالكي')}</div>
      <div class="cr-gap"></div>
      <div class="cr-role">${T('المحتوى العلمي')}</div>
      <div class="cr-item">${T('معلومات وأسئلة مراجَعة وفق بيانات وكالة ناسا (NASA)')}</div>
      <div class="cr-role">${T('النماذج ثلاثية الأبعاد')}</div>
      <div class="cr-item" dir="ltr">Quaternius · Kenney · Kay Lousberg (KayKit) · Poly Pizza</div>
      <div class="cr-role">${T('الموسيقى')}</div>
      ${songs.map(s => `<div class="cr-item" dir="ltr">${s}</div>`).join('')}
      <div class="cr-role">${T('الخطوط')}</div>
      <div class="cr-item" dir="ltr">Lalezar · Baloo Bhaijaan 2</div>
      <div class="cr-gap"></div>
      <div class="cr-thanks">${T('شكرًا لك على اللعب! 🚀')}</div>`;
    wrap.append(roll);
    const again = button('رحلة جديدة', 'gold small', async () => { await unmount(wrap); resolve(); });
    again.classList.add('cr-btn');
    wrap.append(again);
    mount(wrap);
    // slow upward scroll; ends with the thanks line centred
    const H = wrap.offsetHeight, rh = roll.offsetHeight;
    roll.animate([{ transform: `translateY(${H}px)` }, { transform: `translateY(${Math.round(Math.min((H - rh) / 2, H - 120 - rh))}px)` }], { duration: 22000, easing: 'linear', fill: 'forwards' });
  });
}
