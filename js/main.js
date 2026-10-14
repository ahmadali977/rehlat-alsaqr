import * as THREE from 'three';
import { gfx, initRenderer, renderFrame } from './gfx.js';
import { loadModels, MODELS } from './models.js';
import { preloadRocketArt } from './rocket.js';
import { tick } from './loop.js';
import { app, fade } from './game.js';
import { titleScreen, homeIntro, launchSequence } from './scenes/home.js';
import { flight } from './scenes/flight.js';
import { landing } from './scenes/landing.js';
import { finale } from './scenes/finale.js';
import { state, save, ORDER } from './state.js';

async function boot() {
  initRenderer(document.getElementById('game'));
  const fill = document.getElementById('boot-fill'), note = document.getElementById('boot-note');
  const notes = ['جارٍ تجهيز الصاروخ…', 'جارٍ رسم الكواكب…', 'جارٍ إيقاظ الكائنات الفضائية…', 'العدّ التنازلي يقترب…'];
  await Promise.all([document.fonts.load('40px Lalezar'), document.fonts.load('700 30px Baloo'), preloadRocketArt(),
    loadModels(Object.keys(MODELS), k => {
      if (fill) fill.style.width = Math.round(6 + k * 90) + '%';
      if (note) note.textContent = notes[Math.min(notes.length - 1, Math.floor(k * notes.length))];
    })]);
  if (fill) fill.style.width = '100%';
  const clock = new THREE.Clock();
  gfx.renderer.setAnimationLoop(() => {
    const real = Math.min(clock.getDelta(), 1 / 20);
    const dt = tick(real);
    if (app.world) { app.world.update(dt, real); renderFrame(app.world.scene, gfx.camera); }
  });
  document.getElementById('boot').classList.add('gone');
  // debug: fast-forward game time (used for automated checks)
  window.__ff = sec => { for (let i = 0; i < sec * 30; i++) { const dt = tick(1 / 30); if (app.world) app.world.update(dt, 1 / 30); } if (app.world) renderFrame(app.world.scene, gfx.camera); };
  window.__app = app;
  // debug: save a clean 3D frame (no HTML overlay) through scripts/save-server.mjs
  window.__snap = async name => { renderFrame(app.world.scene, gfx.camera); const url = gfx.renderer.domElement.toDataURL('image/png'); return (await fetch('http://127.0.0.1:8092/?name=' + name, { method: 'POST', body: url })).text(); };
  const dev = new URLSearchParams(location.search);
  if (dev.has('leg')) { state.name = 'تجربة'; state.diff = dev.get('diff') || 'mid'; state.leg = +dev.get('leg'); }
  if (dev.get('go') === 'flight') return journey(state.leg, 'flight');
  if (dev.get('go') === 'landing') return journey(state.leg, 'landing');
  if (dev.get('go') === 'finale') return finale(() => menu());
  menu();
}

function menu() {
  titleScreen(async ({ mode }) => {
    if (mode === 'new') { await homeIntro(); await launchSequence(); journey(0, 'flight'); }
    else journey(state.leg, 'flight');
  });
}

async function journey(leg, phase) {
  for (let i = leg; i < ORDER.length; i++) {
    state.leg = i; save();
    if (phase === 'flight') await flight(i);
    phase = 'flight';
    await landing(i);
  }
  state.finished = true; save();
  await finale(() => menu());
}

boot().catch(e => {
  console.error(e);
  const webgl = /WebGL/i.test(String(e && e.message));
  const msg = webgl
    ? 'تحتاج هذه اللعبة إلى رسومات ثلاثية الأبعاد (WebGL) غير متاحة هنا.<br>افتح اللعبة في متصفح Chrome أو Edge أو Safari، وتأكد من تفعيل تسريع الرسومات.'
    : 'حدث خطأ أثناء تحميل اللعبة. أعد تحميل الصفحة وحاول مرة أخرى.';
  document.getElementById('boot').innerHTML = '<div style="color:#fff;font-family:Baloo,Tahoma,sans-serif;font-size:22px;line-height:1.7;text-align:center;max-width:620px;padding:24px" dir="rtl">🚀<br>' + msg + '</div>';
  fade.in();
});

// Android back button: send the app to the background instead of quitting mid-journey
const capApp = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
if (capApp) capApp.addListener('backButton', () => capApp.minimizeApp());
