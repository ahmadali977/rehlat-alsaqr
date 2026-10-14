import * as THREE from 'three';
import { buildPlanetWorld } from '../worlds/planets.js';
import { switchWorld } from '../game.js';
import { sleep, tween, ease, onFrame } from '../loop.js';
import { showCards, banner, button, mount, unmount, T, ar, el } from '../ui.js';
import { music, sfx } from '../audio.js';
import { PLANETS } from '../content.js';
import { state, save } from '../state.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);
const CELEBRATE = ['Dance', 'Jump', 'Yes'];

export async function landing(leg) {
  const p = PLANETS[leg];
  const w = await switchWorld(() => buildPlanetWorld(p.id));
  const { cam, rocket, padTop, aliens, guide, base } = w;
  const top = padTop;

  // aliens look up, waiting
  aliens.forEach(a => a.userData.play('Idle'));
  cam.pos.set(0.6, top + 2.6, 10.5); cam.target.set(0, top + 2.4, 0); cam.snap(); cam.lerp = 0.035;

  // ---- descent
  rocket.root.visible = true; rocket.setThrust(0.8);
  const y1 = top - 0.02, y0 = y1 + 12;
  rocket.root.position.y = y0;
  sfx.rumbleOn(0.55);
  const dustFx = onFrame(() => {
    const h = rocket.root.position.y - y1;
    if (h < 3.5 && rocket.thrust > 0.05) {
      const n = Math.ceil((1 - h / 3.5) * 5);
      for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = 1.5 + Math.random() * 2; w.dust.emit({ pos: [Math.cos(a) * 0.4, y1 + 0.1, Math.sin(a) * 0.4], vel: [Math.cos(a) * s, 0.3 + Math.random() * 0.4, Math.sin(a) * s], life: 1.6, size: 0.35, sizeEnd: 1.4, color: dustColor(p.id), colorEnd: dustColor(p.id), alpha: 0.6, drag: 1.6 }); }
    }
    if (rocket.thrust > 0.1) w.fire.emit({ pos: [0, rocket.root.position.y + 0.05, 0], vel: [0, -3, 0], velSpread: 1.2, spread: 0.2, life: 0.35, size: 0.45, sizeEnd: 0.05, color: 0xfff1b0, colorEnd: 0xff5a1f, alpha: 0.9, count: 2 });
  });
  const followDown = onFrame(() => { cam.target.y = Math.max(top + 1.1, rocket.root.position.y + 0.8); });
  await tween(4.6, k => { rocket.root.position.y = THREE.MathUtils.lerp(y0, y1, k); rocket.setThrust(0.85 - k * 0.45); rocket.root.rotation.y = (1 - k) * 1.4; }, ease.out);
  followDown();
  rocket.setThrust(0); sfx.rumbleOff(400); sfx.land();
  for (let i = 0; i < 40; i++) { const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 2; w.dust.emit({ pos: [Math.cos(a) * 0.5, y1 + 0.1, Math.sin(a) * 0.5], vel: [Math.cos(a) * s, 0.4, Math.sin(a) * s], life: 1.8, size: 0.4, sizeEnd: 1.6, color: dustColor(p.id), alpha: 0.65, drag: 1.8 }); }
  await sleep(0.3); dustFx();

  // ---- celebration
  music.play('celebrate', { restart: true, fadeMs: 600 });
  sfx.fanfare();
  aliens.forEach((a, i) => setTimeout(() => a.userData.play(CELEBRATE[i % 3]), i * 90));
  guide.userData.play('Jump');
  const burst = () => { const up = V(0, 1, 0); w.confetti.burst(base.localToWorld(V(-1.8, top + 0.4, 0.4)), up, 70, 4.5); w.confetti.burst(base.localToWorld(V(1.8, top + 0.4, 0.4)), up, 70, 4.5); sfx.pop(); };
  burst(); setTimeout(burst, 700); setTimeout(burst, 1500);
  cam.pos.set(0.4, top + 3.4, 9.2); cam.target.set(0, top + 1.0, 0);
  // astronaut steps out and waves
  const astro = w.astro; astro.visible = true; astro.position.set(-0.85, top, 0.85); astro.lookAt(base.localToWorld(V(0, top, 9))); astro.scale.setScalar(0.01);
  tween(0.4, k => astro.scale.setScalar(Math.max(0.01, k)), ease.outBack); astro.userData.play('Wave');
  await banner(`أهلًا بك في ${p.name}!`, p.title, { top: 70, hold: 3000 });

  // ---- the guide talks
  aliens.forEach(a => a.userData.play(Math.random() < 0.5 ? 'Idle' : 'Yes'));
  const gp = guide.getWorldPosition(V(0, 0, 0));
  cam.lerp = 0.04;
  cam.pos.copy(gp).add(V(-0.4, 1.3, 4.6)); cam.target.copy(gp).add(V(-1.5, 0.75, 0));
  guide.userData.play('Yes', { loop: false, then: 'Idle' });
  sfx.chatter(7);
  music.duck(0.55);
  const s = p.stats;
  const statsHtml = `<div class="stats">${[['البعد عن الشمس', s.distance], ['القطر', s.diameter], ['طول اليوم', s.day], ['طول السنة', s.year], ['عدد الأقمار', s.moons], ['درجة الحرارة', s.temp]].map(([k, v]) => `<div class="stat"><b>${T(k)}</b><span>${T(v)}</span></div>`).join('')}</div>`;
  const cards = [
    { icon: '👋', title: `أهلًا يا ${state.name}!`, text: p.greeting },
    ...p.facts,
    { icon: p.gasGiant ? '🛸' : '📍', title: p.gasGiant ? 'لماذا نقف على محطة طائرة؟' : 'أين هبطنا؟', text: p.landingNote },
    { icon: '📊', title: `بطاقة ${p.name}`, html: statsHtml },
  ];
  await showCards(cards, {
    name: p.alienName, bubble: 'right', width: 640, pos: { left: 60, top: 120 },
    finalLabel: leg < PLANETS.length - 1 ? `إلى ${PLANETS[leg + 1].name} 🚀` : 'إلى الاحتفال الختامي 🎉',
    onPage: i => { if (i > 0) { sfx.chatter(4 + (i % 3)); guide.userData.play(i % 2 ? 'Yes' : 'Dance', { loop: false, then: 'Idle' }); } },
  });
  music.duck(1);
  state.score += 50; save();

  // ---- take off
  aliens.forEach(a => a.userData.play('Jump'));
  guide.userData.play('Yes');
  cam.pos.set(0.3, top + 2.8, 10); cam.target.set(0, top + 1.6, 0);
  await sleep(0.4);
  sfx.pop(); await tween(0.3, k => astro.scale.setScalar(Math.max(0.001, 1 - k)), ease.in); astro.visible = false;
  sfx.rumbleOn(1); rocket.setThrust(1);
  const fx2 = onFrame(() => { w.fire.emit({ pos: [0, rocket.root.position.y + 0.05, 0], vel: [0, -4, 0], velSpread: 1.5, spread: 0.2, life: 0.4, size: 0.5, sizeEnd: 0.05, color: 0xfff1b0, colorEnd: 0xff5a1f, alpha: 0.9, count: 3 }); });
  let vy = 0;
  const up = onFrame(dt => { vy += dt * 4; rocket.root.position.y += vy * dt; cam.target.y = Math.max(top + 1.6, rocket.root.position.y); });
  await sleep(2.6);
  sfx.rumbleOff(800);
  up(); fx2();
  state.leg = leg + 1; save();
}

function dustColor(id) {
  return { mercury: 0xb9ab9c, venus: 0xe0a060, mars: 0xd8774a }[id] ?? 0xf4f4ff;
}
