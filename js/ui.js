// HTML overlay: Arabic text, cards, questions, buttons. Logical size >= 1280x720, scaled to the window.
import { sfx } from './audio.js';

const root = document.getElementById('ui');
export const uiState = { W: 1280, H: 720, scale: 1 };

function fit() {
  const w = window.innerWidth, h = window.innerHeight;
  const s = Math.min(w / 1280, h / 720);
  uiState.scale = s; uiState.W = w / s; uiState.H = h / s;
  root.style.width = uiState.W + 'px'; root.style.height = uiState.H + 'px';
  root.style.transform = `scale(${s})`;
}
window.addEventListener('stage-resize', fit); window.addEventListener('resize', fit); fit();

// Arabic-Indic digits for display
export function ar(s) {
  return String(s).replace(/(\d)\.(\d)/g, '$1٫$2').replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
}

export function el(tag, cls, html) {
  const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e;
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const T = s => esc(ar(s));

export function mount(node) { root.appendChild(node); return node; }
export async function unmount(node, anim = true) {
  if (!node || !node.parentNode) return;
  if (anim) { node.classList.remove('pop-in', 'slide-up', 'fade-in'); node.classList.add('pop-out'); await wait(230); }
  node.remove();
}
export function clearUI(keep = []) { [...root.children].forEach(c => { if (!keep.includes(c) && !c.dataset.keep) c.remove(); }); }
export const wait = ms => new Promise(r => setTimeout(r, ms));

export function button(label, cls = '', onClick) {
  const b = el('button', 'btn ' + cls, label);
  b.addEventListener('click', e => { e.stopPropagation(); sfx.click(); onClick && onClick(e); });
  return b;
}

function place(node, { x = 'center', y = 'center', bottom, top, left, right } = {}) {
  node.style.position = 'absolute';
  if (top !== undefined) node.style.top = top + 'px';
  if (bottom !== undefined) node.style.bottom = bottom + 'px';
  if (left !== undefined) node.style.left = left + 'px';
  if (right !== undefined) node.style.right = right + 'px';
  if (x === 'center' && left === undefined && right === undefined) { node.style.left = '50%'; node.style.marginLeft = -(node.offsetWidth / 2) + 'px'; }
  if (y === 'center' && top === undefined && bottom === undefined) { node.style.top = '50%'; node.style.marginTop = -(node.offsetHeight / 2) + 'px'; }
}

// ---------------------------------------------------------------- info cards (paged)
// cards: [{icon, title, text}] ; opts: {kicker, bubble:'left'|'right', name, pos, finalLabel, onPage(i)}
export function showCards(cards, opts = {}) {
  return new Promise(resolve => {
    const card = el('div', 'panel card pop-in' + (opts.bubble ? ' bubble tail-' + opts.bubble : ''));
    if (opts.width) card.style.width = opts.width + 'px';
    const kick = opts.kicker ? el('div', 'kicker', T(opts.kicker)) : null;
    const tag = opts.name ? el('div', 'nametag', T(opts.name)) : null;
    const icon = el('div', 'cicon');
    const title = el('div', 'ctitle'), text = el('div', 'ctext');
    const row = el('div', 'crow'), dots = el('div', 'dots');
    const nav = el('div'); nav.style.display = 'flex'; nav.style.gap = '12px';
    const prev = button('السابق', 'ghost small');
    const next = button('التالي', 'small');
    nav.append(prev, next); row.append(dots, nav);
    if (kick) card.append(kick); if (tag) card.append(tag);
    card.append(icon, title, text, row);
    cards.forEach(() => dots.append(el('i')));
    let i = 0;
    const render = () => {
      const c = cards[i];
      icon.style.display = c.icon ? '' : 'none'; icon.textContent = c.icon || '';
      title.innerHTML = T(c.title || ''); text.innerHTML = c.html || T(c.text || '');
      [...dots.children].forEach((d, k) => d.classList.toggle('on', k === i));
      prev.style.visibility = i === 0 ? 'hidden' : 'visible';
      next.innerHTML = i === cards.length - 1 ? (opts.finalLabel || 'تم') : 'التالي';
      next.className = 'btn small ' + (i === cards.length - 1 ? 'gold pulse' : '');
      text.classList.remove('fade-in'); void text.offsetWidth; text.classList.add('fade-in');
      opts.onPage && opts.onPage(i);
    };
    prev.onclick = () => { if (i > 0) { i--; render(); } };
    next.onclick = async () => {
      if (i < cards.length - 1) { i++; sfx.page(); render(); }
      else { await unmount(card); resolve(); }
    };
    mount(card); render();
    const p = opts.pos || {};
    place(card, { x: p.left !== undefined || p.right !== undefined ? null : 'center', y: p.top !== undefined || p.bottom !== undefined ? null : 'center', ...p });
  });
}

// ---------------------------------------------------------------- MCQ
// returns Promise<boolean correct>. Calls opts.onAnswer(correct) right after the choice (before explanation is closed).
export function showQuestion(q, opts = {}) {
  return new Promise(resolve => {
    const box = el('div', 'panel mcq slide-up'); box.dataset.a = q.answer;
    const head = el('div', 'qhead');
    head.append(el('div', 'qbadge', T(opts.badge || 'سؤال')));
    if (opts.fun) head.append(el('div', 'qbadge fun', 'هل تعلم؟ ✨'));
    head.append(el('div', 'qtext', T(q.q)));
    const grid = el('div', 'opts');
    const letters = ['أ', 'ب', 'ج', 'د'];
    const order = opts.shuffle === false ? [0, 1, 2, 3] : shuffle([0, 1, 2, 3]);
    const btns = [];
    order.forEach((oi, k) => {
      const b = el('button', 'opt'); b.innerHTML = `<span class="ol">${letters[k]}</span><span>${T(q.options[oi])}</span>`;
      b.dataset.oi = oi; btns.push(b); grid.append(b);
      b.addEventListener('click', () => choose(oi, b));
    });
    box.append(head, grid);
    mount(box);
    place(box, { bottom: opts.bottom ?? 26 });
    let done = false;
    function choose(oi, b) {
      if (done) return; done = true;
      const ok = oi === q.answer;
      grid.classList.add('locked');
      btns.forEach(x => { const xi = +x.dataset.oi; if (xi === q.answer) x.classList.add('right'); else if (x === b) x.classList.add('wrong'); else x.classList.add('dim'); });
      ok ? sfx.correct() : sfx.wrong();
      opts.onAnswer && opts.onAnswer(ok);
      setTimeout(() => {
        const ex = el('div', 'explain fade-in ' + (ok ? 'good' : 'bad'));
        const txt = el('div', 'etxt', `<span class="ehead">${ok ? 'إجابة صحيحة! 🎉' : 'إجابة خاطئة'}</span>${T(q.explain || '')}`);
        const go = button(opts.continueLabel || 'متابعة', ok ? 'small' : 'small blue');
        go.onclick = async () => { await unmount(box); resolve(ok); };
        ex.append(txt, go); box.append(ex);
        box.style.marginTop = ''; place(box, { bottom: opts.bottom ?? 26 });
      }, 650);
    }
  });
}

export function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// ---------------------------------------------------------------- banners, toasts, hints
export async function banner(title, sub, { top = 150, hold = 1800 } = {}) {
  const b = el('div', 'banner pass pop-in', `<div class="bt">${T(title)}</div>${sub ? `<div class="bs">${T(sub)}</div>` : ''}`);
  b.style.top = top + 'px'; mount(b);
  await wait(hold); await unmount(b);
}
export function hint(text, { bottom = 40 } = {}) {
  const h = el('div', 'hint pass fade-in', T(text)); h.style.bottom = bottom + 'px'; mount(h); return h;
}
export async function toast(text, ms = 1600) {
  const t = el('div', 'toast pass slide-up', T(text)); mount(t); await wait(ms); await unmount(t);
}

// big centered action button; resolves when pressed
export function bigButton(label, cls = 'gold big pulse', pos = { bottom: 60 }) {
  return new Promise(res => {
    const b = button(label, cls + ' pop-in', async () => { await unmount(b); res(); });
    mount(b); place(b, pos);
  });
}

export { root as uiRoot };
