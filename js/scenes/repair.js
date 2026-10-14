import { el, mount, unmount, T, ar, shuffle, wait } from '../ui.js';
import { music, sfx } from '../audio.js';
import { onFrame } from '../loop.js';

const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent && parent.appendChild(e); return e; };
const VW = 900, VH = 440;
let lastGame = -1;

// Runs one random repair mini-game. Resolves when the rocket is fixed.
export async function runRepair() {
  const prevMusic = music.key;
  music.play('repair', { restart: true, fadeMs: 500 });
  const games = [wires, cracks, valve];
  let gi; do { gi = Math.floor(Math.random() * games.length); } while (gi === lastGame);
  lastGame = gi;

  const shade = mount(el('div', 'fade-in')); Object.assign(shade.style, { position: 'absolute', inset: '0', background: 'rgba(10,8,30,.55)' });
  const box = el('div', 'panel pop-in'); Object.assign(box.style, { width: '960px', padding: '18px 30px 24px', background: '#2b2f45', borderColor: '#141026' });
  const head = el('div'); Object.assign(head.style, { display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#fff', marginBottom: '8px' });
  const title = el('div', 'title-font'); Object.assign(title.style, { fontSize: '40px', color: '#ffc83d', whiteSpace: 'nowrap', flex: 'none' });
  const info = el('div'); Object.assign(info.style, { fontSize: '21px', fontWeight: '700', color: '#dfe6ff', lineHeight: '1.4', textAlign: 'left', marginRight: '18px' });
  head.append(title, info);
  const svg = svgEl('svg', { viewBox: `0 0 ${VW} ${VH}`, width: VW, height: VH }); svg.style.display = 'block'; svg.style.touchAction = 'none'; svg.style.direction = 'ltr';
  const status = el('div'); Object.assign(status.style, { textAlign: 'center', color: '#fff', fontSize: '26px', fontWeight: '700', marginTop: '8px', minHeight: '38px' });
  box.append(head, svg, status);
  mount(box);
  box.style.position = 'absolute'; box.style.left = '50%'; box.style.top = '50%'; box.style.marginLeft = '-480px'; box.style.marginTop = (-box.offsetHeight / 2) + 'px';

  defs(svg);
  // test hook: automated checks can complete the current mini-game
  await Promise.race([games[gi]({ svg, title, info, status }), new Promise(res => { window.__repairSkip = res; })]);
  sfx.done();
  status.innerHTML = T('أحسنت! عاد الصاروخ يعمل بكفاءة 🚀');
  status.style.color = '#7dffb0';
  await wait(1300);
  await Promise.all([unmount(box), unmount(shade)]);
  if (prevMusic) music.play(prevMusic, { fadeMs: 700 });
}

function defs(svg) {
  const d = svgEl('defs', {}, svg);
  d.innerHTML = `
    <linearGradient id="metal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5b6382"/><stop offset="1" stop-color="#3a4060"/></linearGradient>
    <linearGradient id="hull" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef2f7"/><stop offset="1" stop-color="#c3cbd8"/></linearGradient>
    <radialGradient id="glowR"><stop offset="0" stop-color="#ffb03a" stop-opacity=".9"/><stop offset="1" stop-color="#ff4d2a" stop-opacity="0"/></radialGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="3"/></filter>`;
}
// Finger / mouse position in SVG units. Uses the on-screen box (which includes every CSS scale) instead of
// getScreenCTM, because Safari on iPhone/iPad ignores the CSS scale of parent elements there.
function toSvg(svg, e) { const r = svg.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * VW, y: (e.clientY - r.top) / r.height * VH }; }
// stop the page from scrolling, bouncing or zooming while a finger is on the mini-game
function lockTouch(el) { for (const ev of ['touchstart', 'touchmove']) el.addEventListener(ev, e => e.preventDefault(), { passive: false }); }
function rivets(svg, x, y, w, h, r = 6) { for (const [a, b] of [[x + 18, y + 18], [x + w - 18, y + 18], [x + 18, y + h - 18], [x + w - 18, y + h - 18]]) svgEl('circle', { cx: a, cy: b, r, fill: '#8d96b4', stroke: '#23283d', 'stroke-width': 2 }, svg); }

// ---------------------------------------------------------------- 1) wires
function wires({ svg, title, info, status }) {
  title.innerHTML = T('🔌 أعد توصيل الأسلاك');
  info.innerHTML = T('اسحب السلك إلى المقبس المطابق، أو انقر السلك ثم انقر المقبس');
  return new Promise(done => {
    lockTouch(svg);
    svgEl('rect', { x: 10, y: 10, width: VW - 20, height: VH - 20, rx: 26, fill: 'url(#metal)', stroke: '#141026', 'stroke-width': 5 }, svg);
    rivets(svg, 10, 10, VW - 20, VH - 20);
    const C = [['#ff5a5f', 'circle'], ['#ffc83d', 'tri'], ['#3d8bff', 'square'], ['#2fd17a', 'star']];
    const left = shuffle([0, 1, 2, 3]), right = shuffle([0, 1, 2, 3]);
    const ys = [85, 175, 265, 355];
    const wiresG = svgEl('g', {}, svg);
    const mark = (g, x, y, ci) => {
      const [col, shape] = C[ci];
      svgEl('circle', { cx: x, cy: y, r: 30, fill: '#1c1f30', stroke: '#141026', 'stroke-width': 4 }, g);
      if (shape === 'circle') svgEl('circle', { cx: x, cy: y, r: 17, fill: col }, g);
      if (shape === 'square') svgEl('rect', { x: x - 15, y: y - 15, width: 30, height: 30, rx: 4, fill: col }, g);
      if (shape === 'tri') svgEl('polygon', { points: `${x},${y - 19} ${x + 18},${y + 14} ${x - 18},${y + 14}`, fill: col }, g);
      if (shape === 'star') { let p = ''; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 8 : 19; p += `${x + Math.cos(a) * r},${y + Math.sin(a) * r} `; } svgEl('polygon', { points: p, fill: col }, g); }
    };
    const plugs = left.map((ci, i) => { const g = svgEl('g', {}, svg); svgEl('rect', { x: 40, y: ys[i] - 14, width: 90, height: 28, rx: 10, fill: C[ci][0], stroke: '#141026', 'stroke-width': 4 }, g); mark(g, 150, ys[i], ci); g.style.cursor = 'pointer'; return { g, ci, x: 150, y: ys[i], done: false }; });
    const sockets = right.map((ci, i) => { const g = svgEl('g', {}, svg); const plate = svgEl('rect', { x: VW - 130, y: ys[i] - 14, width: 90, height: 28, rx: 10, fill: '#1c1f30', stroke: '#141026', 'stroke-width': 4 }, g); mark(g, VW - 150, ys[i], ci); g.style.cursor = 'pointer'; return { g, ci, x: VW - 150, y: ys[i], plate, used: false }; });
    // selection ring around the chosen plug, and a highlight on the socket the wire is snapping to
    const ring = svgEl('circle', { r: 40, fill: 'none', stroke: '#ffffff', 'stroke-width': 6, 'stroke-dasharray': '10 8', opacity: 0 }, svg);
    const aim = svgEl('circle', { r: 40, fill: 'none', stroke: '#ffffff', 'stroke-width': 6, opacity: 0 }, svg);
    let sel = null, line = null, down = null, left2 = 4;
    const path = (x1, y1, x2, y2) => `M${x1},${y1} C${x1 + 180},${y1} ${x2 - 180},${y2} ${x2},${y2}`;
    // whole rows are touch targets: anywhere in a plug's row on the left half picks it, anywhere in a socket's row on the right half aims at it
    const plugAt = q => q.x < VW * 0.45 ? plugs.find(p => !p.done && Math.abs(p.y - q.y) < 45) : null;
    const socketAt = (q, reach = 45) => q.x > VW * 0.5 ? sockets.find(s => !s.used && Math.abs(s.y - q.y) < reach) : null;
    const select = p => {
      sel = p; line && line.remove();
      line = svgEl('path', { d: path(p.x, p.y, p.x + 40, p.y), stroke: C[p.ci][0], 'stroke-width': 16, fill: 'none', 'stroke-linecap': 'round' }, wiresG);
      ring.setAttribute('cx', p.x); ring.setAttribute('cy', p.y); ring.setAttribute('stroke', C[p.ci][0]); ring.setAttribute('opacity', 1);
      sfx.pop(); status.innerHTML = T('الآن انقر المقبس الذي له اللون نفسه أو اسحب إليه');
    };
    const clear = () => { sel = null; line && line.remove(); line = null; ring.setAttribute('opacity', 0); aim.setAttribute('opacity', 0); };
    const showAim = s => { if (s) { aim.setAttribute('cx', s.x); aim.setAttribute('cy', s.y); aim.setAttribute('stroke', C[sel.ci][0]); aim.setAttribute('opacity', 1); } else aim.setAttribute('opacity', 0); };
    const tryConnect = s => {
      const p = sel;
      if (s.ci === p.ci) {
        line.setAttribute('d', path(p.x, p.y, s.x, s.y)); line = null; // the wire stays
        p.done = true; s.used = true; left2--; sfx.fix(); spark(svg, s.x, s.y);
        s.plate.setAttribute('fill', C[s.ci][0]);
        sel = null; ring.setAttribute('opacity', 0); aim.setAttribute('opacity', 0);
        status.innerHTML = T(left2 ? `ممتاز! بقي ${ar(left2)}` : 'تم توصيل كل الأسلاك!');
        if (!left2) done();
      } else { sfx.wrong(); status.innerHTML = T('لون مختلف! جرّب مقبسًا آخر'); line.setAttribute('d', path(p.x, p.y, p.x + 40, p.y)); showAim(null); }
    };
    svg.addEventListener('pointerdown', e => {
      e.preventDefault(); try { svg.setPointerCapture(e.pointerId); } catch {}
      const q = toSvg(svg, e);
      const p = plugAt(q);
      if (p) { select(p); down = { x: q.x, y: q.y, dragging: true }; return; }
      if (sel) { const s = socketAt(q, 50); if (s) { tryConnect(s); return; } }
      down = null;
    });
    svg.addEventListener('pointermove', e => {
      if (!sel || !down || !down.dragging) return;
      const q = toSvg(svg, e);
      const s = socketAt(q, 70); // magnet: the wire end jumps onto a nearby socket
      showAim(s);
      line.setAttribute('d', s ? path(sel.x, sel.y, s.x, s.y) : path(sel.x, sel.y, q.x, q.y));
    });
    const up = e => {
      if (!sel || !down) return;
      const q = toSvg(svg, e); const moved = Math.hypot(q.x - down.x, q.y - down.y) > 30; down = null;
      if (!moved) { line.setAttribute('d', path(sel.x, sel.y, sel.x + 40, sel.y)); return; } // a tap: keep the plug selected and wait for a socket tap
      const s = socketAt(q, 70);
      if (s) tryConnect(s); else { clear(); status.innerHTML = T('اسحب السلك حتى المقبس، أو انقره ثم انقر المقبس'); }
    };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', () => { down = null; });
  });
}

// ---------------------------------------------------------------- 2) cracks
function cracks({ svg, title, info, status }) {
  title.innerHTML = T('🔧 الحم الشقوق في جسم الصاروخ');
  info.innerHTML = T('انقر على كل شقّ لتلحمه');
  return new Promise(done => {
    svgEl('rect', { x: 10, y: 10, width: VW - 20, height: VH - 20, rx: 26, fill: 'url(#hull)', stroke: '#141026', 'stroke-width': 5 }, svg);
    for (let x = 160; x < VW; x += 150) svgEl('line', { x1: x, y1: 14, x2: x, y2: VH - 14, stroke: '#aab3c3', 'stroke-width': 3 }, svg);
    svgEl('line', { x1: 14, y1: VH / 2, x2: VW - 14, y2: VH / 2, stroke: '#aab3c3', 'stroke-width': 3 }, svg);
    rivets(svg, 10, 10, VW - 20, VH - 20);
    const total = 6; let fixed = 0, shown = 0;
    const spots = shuffle([[150, 110], [330, 300], [500, 120], [680, 310], [780, 140], [260, 190], [600, 220], [420, 340]]).slice(0, total);
    const show = () => {
      if (shown >= total) return; const [x, y] = spots[shown++];
      const g = svgEl('g', { class: 'crack' }, svg); g.style.cursor = 'pointer';
      svgEl('circle', { cx: x, cy: y, r: 46, fill: 'url(#glowR)', opacity: 0.55 }, g);
      let pts = ''; let cx = x - 40, cy = y - 10; for (let i = 0; i < 7; i++) { pts += `${cx},${cy} `; cx += 12 + Math.random() * 4; cy += (i % 2 ? -1 : 1) * (10 + Math.random() * 10); }
      svgEl('polyline', { points: pts, fill: 'none', stroke: '#2a1a1a', 'stroke-width': 7, 'stroke-linejoin': 'round' }, g);
      svgEl('polyline', { points: pts, fill: 'none', stroke: '#ff7a3a', 'stroke-width': 2.5, 'stroke-linejoin': 'round' }, g);
      svgEl('circle', { cx: x, cy: y, r: 52, fill: 'transparent' }, g);
      g.animate([{ transform: 'scale(.4)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 300, easing: 'ease-out' }); g.style.transformOrigin = `${x}px ${y}px`;
      g.addEventListener('pointerdown', () => {
        if (g.dataset.done) return; g.dataset.done = 1; sfx.weld(); spark(svg, x, y);
        g.innerHTML = '';
        const patch = svgEl('g', {}, g);
        svgEl('rect', { x: x - 50, y: y - 34, width: 100, height: 68, rx: 12, fill: '#9aa6bd', stroke: '#23283d', 'stroke-width': 4 }, patch);
        for (const [a, b] of [[x - 36, y - 20], [x + 36, y - 20], [x - 36, y + 20], [x + 36, y + 20]]) svgEl('circle', { cx: a, cy: b, r: 5, fill: '#5f6a85' }, patch);
        patch.animate([{ transform: 'scale(1.6)', opacity: 0 }, { transform: 'scale(1)', opacity: 1 }], { duration: 260, easing: 'cubic-bezier(.2,1.6,.4,1)' }); patch.style.transformOrigin = `${x}px ${y}px`;
        fixed++; status.innerHTML = T(`تم لحام ${ar(fixed)} من ${ar(total)}`);
        if (fixed >= total) done(); else setTimeout(show, 250);
      });
    };
    show(); show();
  });
}

// ---------------------------------------------------------------- 3) pressure valve
function valve({ svg, title, info, status }) {
  title.innerHTML = T('⚙️ اضبط ضغط الوقود');
  info.innerHTML = T('أوقف المؤشر داخل المنطقة الخضراء ٣ مرات');
  return new Promise(done => {
    svgEl('rect', { x: 10, y: 10, width: VW - 20, height: VH - 20, rx: 26, fill: 'url(#metal)', stroke: '#141026', 'stroke-width': 5 }, svg);
    rivets(svg, 10, 10, VW - 20, VH - 20);
    const cx = VW / 2, cy = 330, R = 230;
    svgEl('path', { d: `M${cx - R},${cy} A${R},${R} 0 0 1 ${cx + R},${cy}`, fill: 'none', stroke: '#1c1f30', 'stroke-width': 54, 'stroke-linecap': 'round' }, svg);
    const zone = svgEl('path', { fill: 'none', stroke: '#2fd17a', 'stroke-width': 46 }, svg);
    for (let i = 0; i <= 10; i++) { const a = Math.PI + i * Math.PI / 10; svgEl('line', { x1: cx + Math.cos(a) * (R - 40), y1: cy + Math.sin(a) * (R - 40), x2: cx + Math.cos(a) * (R - 58), y2: cy + Math.sin(a) * (R - 58), stroke: '#dfe6ff', 'stroke-width': 4 }, svg); }
    const needle = svgEl('g', {}, svg);
    svgEl('polygon', { points: `${cx - 10},${cy} ${cx + 10},${cy} ${cx},${cy - R + 18}`, fill: '#ff5a5f', stroke: '#141026', 'stroke-width': 3 }, needle);
    svgEl('circle', { cx, cy, r: 26, fill: '#ffc83d', stroke: '#141026', 'stroke-width': 5 }, svg);
    const lights = [0, 1, 2].map(i => svgEl('circle', { cx: 60, cy: 90 + i * 70, r: 22, fill: '#1c1f30', stroke: '#141026', 'stroke-width': 4 }, svg));
    let hits = 0, a = 0.05, dir = 1, speed = 0.75, z0, z1, lock = false;
    const newZone = () => {
      const width = 0.2 - hits * 0.035; z0 = 0.15 + Math.random() * (0.7 - width); z1 = z0 + width;
      const p0 = Math.PI + z0 * Math.PI, p1 = Math.PI + z1 * Math.PI;
      zone.setAttribute('d', `M${cx + Math.cos(p0) * R},${cy + Math.sin(p0) * R} A${R},${R} 0 0 1 ${cx + Math.cos(p1) * R},${cy + Math.sin(p1) * R}`);
    };
    newZone();
    const step = dt => {
      if (!lock) { a += dir * speed * dt; if (a > 1) { a = 1; dir = -1; } if (a < 0) { a = 0; dir = 1; } }
      needle.setAttribute('transform', `rotate(${-90 + a * 180} ${cx} ${cy})`);
    };
    step(0);
    const stopNeedle = onFrame(dt => step(Math.min(0.05, dt)));
    const stopBtn = el('button', 'btn gold', T('أوقف!')); Object.assign(stopBtn.style, { position: 'absolute', left: '0', right: '0', margin: '0 auto', width: 'fit-content', bottom: '86px', fontSize: '40px', padding: '18px 56px 14px' });
    svg.parentNode.style.position = 'absolute'; svg.parentNode.append(stopBtn);
    const press = async () => {
      if (lock) return; lock = true;
      if (a >= z0 && a <= z1) {
        lights[hits].setAttribute('fill', '#2fd17a'); hits++; sfx.fix(); status.innerHTML = T(`رائع! ${ar(hits)} من ٣`);
        if (hits >= 3) { stopNeedle(); stopBtn.remove(); window.removeEventListener('keydown', key); done(); return; }
        speed += 0.18; await wait(450); newZone();
      } else { sfx.wrong(); status.innerHTML = T('خارج المنطقة الخضراء، جرّب مرة أخرى'); await wait(500); }
      lock = false;
    };
    const key = e => { if (e.code === 'Space' || e.key === 'Enter') { e.preventDefault(); press(); } };
    stopBtn.addEventListener('click', press); svg.addEventListener('pointerdown', press); window.addEventListener('keydown', key);
  });
}

function spark(svg, x, y) {
  for (let i = 0; i < 12; i++) {
    const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 50;
    const s = svgEl('circle', { cx: x, cy: y, r: 3 + Math.random() * 3, fill: i % 2 ? '#ffe27a' : '#ff9a3a' }, svg);
    s.animate([{ transform: 'translate(0,0)', opacity: 1 }, { transform: `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px)`, opacity: 0 }], { duration: 420 + Math.random() * 200, easing: 'ease-out' }).onfinish = () => s.remove();
  }
}
