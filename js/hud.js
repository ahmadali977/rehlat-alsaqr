import { el, mount, ar, T } from './ui.js';
import { PLANETS } from './content.js';
import { audioSettings, sfx } from './audio.js';
import { state } from './state.js';

export const PLANET_COLORS = { earth: '#3aa6d8', mercury: '#a49487', venus: '#e8a24f', mars: '#d9622f', jupiter: '#d8a878', saturn: '#e8cf8a', uranus: '#7fdbe0', neptune: '#3d6fe0' };

const ICON_MUSIC = '<svg viewBox="0 0 24 24"><path fill="#231942" d="M9 3v11.6A3.5 3.5 0 1 0 11 18V8h7V3H9z"/></svg>';
const ICON_SFX = '<svg viewBox="0 0 24 24"><path fill="#231942" d="M3 9v6h4l5 4V5L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';
const SLASH = '<svg viewBox="0 0 24 24" style="position:absolute;width:40px;height:40px"><path d="M4 4 L20 20" stroke="#ff5a5f" stroke-width="3.5" stroke-linecap="round"/></svg>';

let settingsBox = null;
export function showSettings() {
  if (settingsBox) return;
  settingsBox = el('div'); settingsBox.dataset.keep = '1'; Object.assign(settingsBox.style, { position: 'absolute', top: '16px', left: '20px', display: 'flex', gap: '12px', zIndex: 5 });
  const mk = (icon, get, toggle) => {
    const b = el('button', 'iconbtn'); b.style.position = 'relative';
    const draw = () => { b.innerHTML = icon + (get() ? '' : SLASH); };
    b.onclick = e => { e.stopPropagation(); toggle(); draw(); sfx.click(); };
    draw(); return b;
  };
  settingsBox.append(mk(ICON_MUSIC, () => audioSettings.music, () => audioSettings.toggleMusic()), mk(ICON_SFX, () => audioSettings.sfx, () => audioSettings.toggleSfx()));
  mount(settingsBox);
}
export function settingsNode() { return settingsBox; }
export function dropSettings() { settingsBox = null; }

// flight HUD: route + score
export function flightHUD(leg) {
  const wrap = el('div', 'pass');
  const route = el('div', 'route');
  const stops = [{ id: 'earth', name: 'الأرض' }, ...PLANETS.map(p => ({ id: p.id, name: p.name }))];
  // journey runs right-to-left visually for Arabic readers
  route.style.direction = 'rtl';
  const segFills = [];
  stops.forEach((s, i) => {
    const st = el('div', 'stop' + (i <= leg ? ' done' : '')); st.style.background = PLANET_COLORS[s.id];
    st.append(el('label', '', T(s.name))); route.append(st);
    if (i < stops.length - 1) { const sg = el('div', 'seg'); const f = el('i'); f.style.width = i < leg ? '100%' : '0%'; sg.append(f); route.append(sg); segFills.push(f); }
  });
  const score = el('div', 'pill'); score.innerHTML = `<span class="ic">⭐</span><span class="v">${ar(state.score)}</span>`;
  Object.assign(score.style, { position: 'absolute', top: '16px', right: '22px' });
  wrap.append(route, score);
  mount(wrap);
  return {
    node: wrap,
    progress(k) { if (segFills[leg]) segFills[leg].style.width = Math.round(k * 100) + '%'; },
    score() { score.querySelector('.v').textContent = ar(state.score); score.animate([{ transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 260 }); },
  };
}
