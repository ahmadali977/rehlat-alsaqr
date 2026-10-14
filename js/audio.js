// Music (streamed <audio> with crossfades) + synthesized sound effects (Web Audio).
export const MUSIC = {
  title: 'assets/music/title_a.mp3',
  space: 'assets/music/space_a.mp3',
  repair: 'assets/music/repair_b.mp3',
  celebrate: 'assets/music/celebrate_a.mp3',
  finale: 'assets/music/finale_c.mp3',
};
// picks made on music-picker.html override the defaults
try { const p = JSON.parse(localStorage.getItem('pq.music') || '{}'); for (const k in p) if (MUSIC[k]) MUSIC[k] = 'assets/music/' + p[k].replace(/.ogg$/, '.mp3'); } catch {}

const settings = { music: true, sfx: true };
try { Object.assign(settings, JSON.parse(localStorage.getItem('pq.audio') || '{}')); } catch {}
// ?mute silences everything for this visit only (used for testing; the saved choice is untouched)
const MUTED = new URLSearchParams(location.search).has('mute');
if (MUTED) { settings.music = false; settings.sfx = false; }
const saveSettings = () => { if (MUTED) return; try { localStorage.setItem('pq.audio', JSON.stringify(settings)); } catch {} };

let ctx = null, master = null, sfxBus = null;
function ac() {
  if (!ctx) {
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    ctx = new C(); master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    sfxBus = ctx.createGain(); sfxBus.gain.value = settings.sfx ? 0.55 : 0; sfxBus.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
// unlock on first gesture
['pointerdown', 'keydown', 'touchstart'].forEach(ev => window.addEventListener(ev, () => { ac(); music.resume(); }, { once: false, passive: true }));

// ---------------------------------------------------------------- music
const tracks = {};
let current = null, currentKey = null, duck = 1, baseVol = 0.55;
function getTrack(key) {
  if (!tracks[key]) { const a = new Audio(MUSIC[key]); a.loop = true; a.preload = 'auto'; a.volume = 0; tracks[key] = a; }
  return tracks[key];
}
function fade(a, to, ms, then) {
  const from = a.volume, t0 = performance.now();
  clearInterval(a._fade);
  a._fade = setInterval(() => {
    const k = Math.min(1, (performance.now() - t0) / ms);
    a.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k >= 1) { clearInterval(a._fade); then && then(); }
  }, 30);
}
const target = () => (settings.music ? baseVol * duck : 0);
export const music = {
  play(key, { restart = false, fadeMs = 900 } = {}) {
    if (currentKey === key && !restart) return;
    const old = current;
    if (old) fade(old, 0, fadeMs, () => old.pause());
    currentKey = key; current = key ? getTrack(key) : null;
    if (!current) return;
    if (restart || current.paused) { try { current.currentTime = 0; } catch {} }
    current.volume = 0;
    current.play().then(() => fade(current, target(), fadeMs)).catch(() => {});
  },
  resume() { if (current && current.paused && settings.music) current.play().then(() => fade(current, target(), 600)).catch(() => {}); },
  duck(v, ms = 500) { duck = v; if (current) fade(current, target(), ms); },
  stop(ms = 800) { if (current) { const a = current; fade(a, 0, ms, () => a.pause()); } current = null; currentKey = null; },
  get key() { return currentKey; },
};

export const audioSettings = {
  get music() { return settings.music; }, get sfx() { return settings.sfx; },
  toggleMusic() { settings.music = !settings.music; saveSettings(); if (current) { if (settings.music && current.paused) current.play().catch(() => {}); fade(current, target(), 300); } return settings.music; },
  toggleSfx() { settings.sfx = !settings.sfx; saveSettings(); if (sfxBus) sfxBus.gain.value = settings.sfx ? 0.55 : 0; return settings.sfx; },
};

// ---------------------------------------------------------------- synth helpers
function tone({ type = 'sine', f0 = 440, f1 = null, dur = 0.2, vol = 0.3, attack = 0.005, delay = 0, curve = 'exp' }) {
  const c = ac(); if (!c || !settings.sfx) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator(); const g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(f0, t);
  if (f1) curve === 'exp' ? o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur) : o.frequency.linearRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(sfxBus); o.start(t); o.stop(t + dur + 0.05);
}
let noiseBuf = null;
function noise({ dur = 0.4, vol = 0.3, f0 = 1200, f1 = 200, q = 0.8, type = 'lowpass', delay = 0, attack = 0.005 }) {
  const c = ac(); if (!c || !settings.sfx) return;
  if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const t = c.currentTime + delay;
  const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const f = c.createBiquadFilter(); f.type = type; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(sfxBus); s.start(t); s.stop(t + dur + 0.05);
}
const notes = (list, opts) => list.forEach(([f, d], i) => tone({ f0: f, dur: opts.dur ?? 0.18, delay: d ?? i * (opts.step ?? 0.08), vol: opts.vol ?? 0.18, type: opts.type ?? 'triangle' }));

// continuous engine rumble (launch / thrust)
let rumble = null;
function rumbleOn(level = 1) {
  const c = ac(); if (!c) return;
  if (!rumble) {
    if (!noiseBuf) noise({ dur: 0.01, vol: 0.0001 });
    const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260; f.Q.value = 0.7;
    const g = c.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start();
    rumble = { s, f, g };
  }
  rumble.g.gain.setTargetAtTime(settings.sfx ? 0.55 * level : 0, c.currentTime, 0.25);
  rumble.f.frequency.setTargetAtTime(180 + 420 * level, c.currentTime, 0.3);
}
function rumbleOff(ms = 900) { if (rumble && ctx) { rumble.g.gain.setTargetAtTime(0, ctx.currentTime, ms / 3000); } }

export const sfx = {
  click: () => tone({ type: 'triangle', f0: 720, f1: 980, dur: 0.07, vol: 0.18 }),
  page: () => tone({ type: 'sine', f0: 520, f1: 760, dur: 0.12, vol: 0.14 }),
  correct: () => notes([[659], [784], [988], [1319]], { step: 0.075, vol: 0.2, dur: 0.22 }),
  wrong: () => { tone({ type: 'square', f0: 220, f1: 140, dur: 0.32, vol: 0.09 }); tone({ type: 'triangle', f0: 180, f1: 110, dur: 0.38, vol: 0.14, delay: 0.05 }); },
  star: () => { tone({ type: 'sine', f0: 1320, dur: 0.12, vol: 0.12 }); tone({ type: 'sine', f0: 1760, dur: 0.2, vol: 0.1, delay: 0.06 }); },
  laser: () => { tone({ type: 'sawtooth', f0: 1600, f1: 240, dur: 0.28, vol: 0.12 }); tone({ type: 'square', f0: 900, f1: 120, dur: 0.22, vol: 0.06, delay: 0.02 }); },
  boom: () => { noise({ dur: 0.9, vol: 0.5, f0: 2200, f1: 60 }); tone({ type: 'sine', f0: 120, f1: 40, dur: 0.6, vol: 0.35 }); },
  hit: () => { noise({ dur: 0.5, vol: 0.45, f0: 900, f1: 80 }); tone({ type: 'square', f0: 160, f1: 60, dur: 0.4, vol: 0.12 }); },
  alarm: () => { for (let i = 0; i < 3; i++) tone({ type: 'square', f0: 880, f1: 660, dur: 0.18, vol: 0.06, delay: i * 0.26 }); },
  warn: () => { tone({ type: 'triangle', f0: 600, dur: 0.12, vol: 0.14 }); tone({ type: 'triangle', f0: 600, dur: 0.12, vol: 0.14, delay: 0.18 }); },
  beep: (hi = false) => tone({ type: 'sine', f0: hi ? 1175 : 784, dur: hi ? 0.5 : 0.16, vol: 0.2 }),
  fix: () => notes([[523], [784]], { step: 0.07, vol: 0.16 }),
  weld: () => noise({ dur: 0.25, vol: 0.18, f0: 5000, f1: 2500, type: 'bandpass', q: 3 }),
  spark: () => noise({ dur: 0.12, vol: 0.12, f0: 6000, f1: 3000, type: 'highpass' }),
  done: () => notes([[523], [659], [784], [1047], [1319]], { step: 0.09, vol: 0.2, dur: 0.3 }),
  land: () => { noise({ dur: 0.5, vol: 0.3, f0: 400, f1: 60 }); tone({ type: 'sine', f0: 90, f1: 50, dur: 0.35, vol: 0.3 }); },
  whoosh: () => noise({ dur: 0.8, vol: 0.25, f0: 300, f1: 2400, type: 'bandpass', q: 1.2, attack: 0.3 }),
  pop: () => tone({ type: 'sine', f0: 400, f1: 900, dur: 0.09, vol: 0.15 }),
  fanfare: () => notes([[523, 0], [659, 0.12], [784, 0.24], [1047, 0.36], [784, 0.52], [1047, 0.64]], { vol: 0.2, dur: 0.3, type: 'square' }),
  chatter(n = 6) { // cute alien voice
    const base = 380 + Math.random() * 260;
    for (let i = 0; i < n; i++) { const f = base * (0.8 + Math.random() * 0.7); tone({ type: 'triangle', f0: f, f1: f * (0.75 + Math.random() * 0.6), dur: 0.07 + Math.random() * 0.05, vol: 0.09, delay: i * 0.085, curve: 'lin' }); }
  },
  rumbleOn, rumbleOff,
};

// pause everything while the app is in the background, resume on return
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (current) current.pause(); if (ctx) ctx.suspend(); }
  else { if (ctx) ctx.resume(); music.resume(); }
});
