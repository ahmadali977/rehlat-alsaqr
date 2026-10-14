import * as THREE from 'three';
import { placeOn, dirFrom } from '../gfx.js';
import { buildEarthWorld, aimAxis, EARTH_R } from '../worlds/earth.js';
import { switchWorld, app } from '../game.js';
import { sleep, tween, ease, onFrame } from '../loop.js';
import { el, mount, unmount, button, showCards, banner, bigButton, T, ar, wait } from '../ui.js';
import { music, sfx } from '../audio.js';
import { EARTH_INFO, PLANETS } from '../content.js';
import { state, reset, hasSave, load, save, DIFFICULTY } from '../state.js';
import { showSettings } from '../hud.js';

const R = EARTH_R;
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ---------------------------------------------------------------- title screen
export async function titleScreen(go) {
  const w = await switchWorld(() => buildEarthWorld());
  showSettings();
  music.play('title');
  const { cam } = w;
  cam.pos.set(-1.2, R + 4.6, 13.6); cam.target.set(1.9, R + 2.5, 0); cam.snap();
  // astronaut idles beside the pad
  placeOn(w.planet, w.astro, dirFrom(0.25, 0.42)); aimAxis(w.astro, V(0, R + 1, 14), V(0, 0, 1));
  w.astro.userData.play('Idle_Neutral');
  // slow orbit while on the title
  let orbit = true; let a = 0;
  w.onUpdate = dt => { if (!orbit) return; a += dt * 0.05; const r = 13.6; cam.pos.set(Math.sin(a - 0.09) * r, R + 4.6, Math.cos(a - 0.09) * r); };

  const logo = mount(el('div', 'logo pass pop-in', `<div class="l1">رحلة <span>الصقر</span></div><div class="l2">${T('مغامرة تعليمية في المجموعة الشمسية')}</div>`));
  logo.style.top = '30px';

  return new Promise(resolve => {
    const form = el('div', 'panel form slide-up');
    form.innerHTML = `
      <label>${T('اسم رائد الفضاء')}</label>
      <input type="text" maxlength="24" placeholder="${T('اكتب اسمك هنا')}" value="${T(state.name || '')}">
      <div class="row"><label>${T('مستوى الصعوبة')}</label><div class="seg2"></div></div>
      <div class="go"></div>`;
    const seg = form.querySelector('.seg2');
    let diff = state.diff || 'mid';
    const sub = { easy: '٣ أسئلة لكل رحلة', mid: '٤ أسئلة لكل رحلة', hard: '٥ أسئلة لكل رحلة' };
    for (const k of ['easy', 'mid', 'hard']) {
      const b = el('button', k === diff ? 'on' : '', `${DIFFICULTY[k].label}<small>${sub[k]}</small>`);
      b.onclick = () => { diff = k; [...seg.children].forEach(c => c.classList.toggle('on', c === b)); sfx.click(); };
      seg.append(b);
    }
    const input = form.querySelector('input');
    input.addEventListener('keydown', e => e.stopPropagation());
    const goRow = form.querySelector('.go');
    const start = button('ابدأ الرحلة', 'gold pulse', async () => {
      reset(input.value.trim() || 'رائد الفضاء', diff);
      orbit = false; await Promise.all([unmount(form), unmount(logo)]);
      resolve({ mode: 'new' });
    });
    goRow.append(start);
    if (hasSave()) {
      load();
      const next = PLANETS[state.leg];
      const cont = button(`تابع إلى ${next.name}`, 'blue', async () => {
        orbit = false; await Promise.all([unmount(form), unmount(logo)]);
        resolve({ mode: 'continue' });
      });
      goRow.prepend(cont);
    }
    mount(form);
    form.style.right = '40px'; form.style.top = '178px';
  }).then(r => go(r));
}

// ---------------------------------------------------------------- boarding + earth facts + launch
export async function homeIntro() {
  const w = app.world; const { cam, astro, tower, planet, rocket } = w;
  w.onUpdate = null;
  // 1) astronaut walks to the tower
  cam.lerp = 0.04;
  cam.pos.set(4.6, R + 2.6, 6.4); cam.target.set(0.4, R + 0.9, 1.2);
  await sleep(0.6);
  banner(`هيا يا ${state.name}!`, 'رائد الفضاء يتجه إلى الصاروخ', { top: 90, hold: 2200 });
  const baseDir = tower.position.clone().normalize();
  const start = dirFrom(0.25, 0.42);
  // walk point just outside the tower, on the rocket side
  const doorWorld = tower.localToWorld(V(0, 0, 0)); const doorDir = doorWorld.clone().normalize();
  astro.userData.play('Walk', { speed: 1.1 });
  await walk(planet, astro, start, doorDir, 3.2);
  // 2) elevator ride
  astro.userData.play('Idle_Neutral');
  const cage = tower.userData.cage;
  tower.updateMatrixWorld(true);
  const q = tower.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), Math.PI / 2));
  astro.quaternion.copy(q);
  cam.pos.set(3.8, R + 3.4, 5.4); cam.target.set(-0.6, R + 2.4, 0.4);
  sfx.whoosh();
  await tween(2.4, k => { const y = 0.19 + k * 3.12; cage.position.y = y - 0.03; astro.position.copy(tower.localToWorld(V(0, y, 0))); }, ease.inOutSine);
  // 3) along the arm into the hatch
  astro.userData.play('Walk', { speed: 1.1 });
  await tween(1.3, k => { astro.position.copy(tower.localToWorld(V(0.05 + k * 0.95, 3.31, 0))); }, ease.linear);
  astro.userData.play('Wave');
  await sleep(1.2);
  sfx.pop();
  await tween(0.35, k => astro.scale.setScalar(1 - k), ease.in);
  astro.visible = false;
  pulsePorthole(rocket);
  await sleep(0.4);

  // 4) Earth facts with the rocket in frame
  cam.lerp = 0.03;
  cam.pos.set(4.4, R + 2.3, 8.2); cam.target.set(2.3, R + 2.0, 0);
  music.duck(0.6);
  await showCards(EARTH_INFO, { kicker: 'قبل الانطلاق: تعرّف على كوكبنا الأرض', finalLabel: 'جاهز للانطلاق!', pos: { right: 46, top: 150 }, width: 600 });
  music.duck(1);
}

export async function launchSequence() {
  const w = app.world; const { cam, rocket, smoke, fire, sky, stars, tower } = w;
  cam.lerp = 0.05;
  cam.pos.set(-4.2, R + 1.8, 9.5); cam.target.set(0, R + 2.2, 0);
  await bigButton('🚀 انطلاق!');
  // retract arms
  tween(1.2, k => tower.userData.arms.forEach(a => { a.scale.x = 1 - k * 0.7; a.position.x = 0.72 - k * 0.35; }));
  music.stop(1200);
  const base = () => rocket.root.position.clone();
  // ignition smoke while counting down
  let smoking = 0.25;
  const stopSmoke = onFrame(dt => {
    const p = base(); const n = Math.ceil(smoking * 14 * dt * 60 / 2);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 1.2 + Math.random() * 2.2 * smoking;
      smoke.emit({ pos: [p.x, p.y + 0.1, p.z], vel: [Math.cos(a) * s, 0.25 + Math.random() * 0.5, Math.sin(a) * s], spread: 0.3, life: 2.2 + Math.random(), size: 0.5, sizeEnd: 2.2 + smoking * 1.6, color: 0xffffff, colorEnd: 0xf2eee8, alpha: 0.85, drag: 1.4 });
    }
    if (rocket.thrust > 0.2) fire.emit({ pos: [p.x, p.y + 0.05, p.z], vel: [0, -1.5, 0], velSpread: 2.4, spread: 0.25, life: 0.45, size: 0.6, sizeEnd: 0.1, color: 0xfff1b0, colorEnd: 0xff5a1f, alpha: 1, count: 3 });
  });
  for (const n of [3, 2, 1]) {
    sfx.beep(false);
    banner(ar(n), null, { top: 210, hold: 700 });
    rocket.setThrust(0.12 * (4 - n)); smoking = 0.25 + (3 - n) * 0.25;
    sfx.rumbleOn(0.25 + (3 - n) * 0.15);
    await sleep(1);
  }
  sfx.beep(true);
  banner('انطلق!', null, { top: 190, hold: 900 });
  rocket.setThrust(1); smoking = 1; sfx.rumbleOn(1);
  music.play('space', { restart: true, fadeMs: 2500 });
  // lift-off
  const y0 = rocket.root.position.y;
  let vy = 0, h = 0, maxV = 6;
  const lift = onFrame(dt => {
    vy = Math.min(maxV, vy + dt * (0.8 + h * 0.6)); h += vy * dt;
    rocket.root.position.y = y0 + h;
    rocket.root.rotation.y += dt * 0.25;
    if (h > 1.5) smoking = Math.max(0, 1 - (h - 1.5) / 4);
  });
  // camera: watch, then follow up
  await sleep(1.6);
  const follow = onFrame(() => { cam.target.set(0, rocket.root.position.y + 1.2, 0); });
  cam.lerp = 0.03;
  cam.pos.set(-5, R + 3.5, 11);
  await sleep(1.8);
  maxV = 2.6;
  // pull back to see the whole tiny Earth while the rocket climbs away; sky turns to space
  follow();
  cam.lerp = 0.025;
  cam.pos.set(-12, R + 6, 46); cam.target.set(0, R * 0.55, 0);
  tween(3.6, k => { sky.material.uniforms.dark.value = k; stars.material.uniforms.opacity.value = k; }, ease.inOut);
  await sleep(5.2);
  sfx.rumbleOff(1500);
  lift(); stopSmoke();
}

function pulsePorthole(rocket) {
  const g = rocket.port.userData.glass.material;
  tween(1.2, k => { g.emissiveIntensity = 0.6 + Math.sin(k * Math.PI) * 2.2; });
}

// walk along the planet surface between two directions
function walk(planet, obj, fromDir, toDir, dur) {
  const a = fromDir.clone().normalize(), b = toDir.clone().normalize();
  const ang = a.angleTo(b); const axis = new THREE.Vector3().crossVectors(a, b).normalize();
  const d = new THREE.Vector3(), ahead = new THREE.Vector3();
  return tween(dur, k => {
    d.copy(a).applyAxisAngle(axis, ang * k);
    ahead.copy(a).applyAxisAngle(axis, ang * Math.min(1, k + 0.02));
    placeOn(planet, obj, d);
    const tgt = ahead.multiplyScalar(planet.heightAt(ahead));
    if (k < 0.99) aimAxis(obj, tgt, V(0, 0, 1));
  }, ease.linear);
}
