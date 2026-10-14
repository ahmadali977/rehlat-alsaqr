import { PLANETS, QUESTIONS } from './content.js';
import { shuffle } from './ui.js';

export const ORDER = PLANETS.map(p => p.id); // mercury ... neptune
export const DIFFICULTY = {
  easy: { label: 'سهل', pool: 'easy', perLeg: 3 },
  mid: { label: 'متوسط', pool: 'mid', perLeg: 4 },
  hard: { label: 'صعب', pool: 'high', perLeg: 5 },
};

const KEY = 'pq.save.v1';
export const state = {
  name: '', diff: 'mid', leg: 0, score: 0, correct: 0, answered: 0, repairs: 0, stars: 0, seen: {}, finished: false,
};

export function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); if (s && s.name !== undefined) { Object.assign(state, s); return true; } } catch {}
  return false;
}
export function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }
export function hasSave() { try { const s = JSON.parse(localStorage.getItem(KEY) || 'null'); return !!(s && s.leg > 0 && !s.finished); } catch { return false; } }
export function reset(name, diff) {
  // 'seen' survives new runs so students meet fresh questions before any repeat
  let seen = state.seen || {};
  try { seen = { ...JSON.parse(localStorage.getItem(KEY) || '{}').seen, ...seen }; } catch {}
  Object.assign(state, { name, diff, leg: 0, score: 0, correct: 0, answered: 0, repairs: 0, stars: 0, seen, finished: false });
  save();
}

export const planetAt = i => PLANETS[i];
export const currentPlanet = () => PLANETS[state.leg];

// Pick this leg's questions, avoiding ones already seen in this run/previous runs where possible.
export function pickQuestions(planetId) {
  const d = DIFFICULTY[state.diff];
  const pool = QUESTIONS[planetId][d.pool];
  const seen = state.seen[planetId + d.pool] || [];
  let fresh = pool.map((q, i) => i).filter(i => !seen.includes(i));
  if (fresh.length < d.perLeg) fresh = pool.map((q, i) => i);
  const pick = shuffle(fresh).slice(0, d.perLeg);
  state.seen[planetId + d.pool] = [...new Set([...(fresh.length === pool.length ? [] : seen), ...pick])];
  return pick.map(i => pool[i]);
}
