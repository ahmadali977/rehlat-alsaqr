// Game-time scheduler: sleep / tween promises that follow the render loop (pausable, slow-mo aware).
export const loop = { time: 0, scale: 1, frameFns: new Set(), timers: [] };

export function sleep(sec) {
  return new Promise(res => loop.timers.push({ at: loop.time + sec, res }));
}

export const ease = {
  linear: k => k,
  inOut: k => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2,
  out: k => 1 - Math.pow(1 - k, 3),
  in: k => k * k * k,
  outBack: k => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); },
  inOutSine: k => -(Math.cos(Math.PI * k) - 1) / 2,
};

export function tween(dur, fn, e = ease.inOut) {
  return new Promise(res => {
    let t = 0;
    const f = dt => { t += dt; const k = Math.min(1, t / dur); fn(e(k), k); if (k >= 1) { loop.frameFns.delete(f); res(); } };
    loop.frameFns.add(f); fn(e(0), 0);
  });
}

export function onFrame(fn) { loop.frameFns.add(fn); return () => loop.frameFns.delete(fn); }

export function tick(realDt) {
  const dt = realDt * loop.scale;
  loop.time += dt;
  if (loop.timers.length) {
    const due = loop.timers.filter(t => t.at <= loop.time);
    if (due.length) { loop.timers = loop.timers.filter(t => t.at > loop.time); due.forEach(t => t.res()); }
  }
  for (const f of [...loop.frameFns]) f(dt, realDt);
  return dt;
}

// cancel everything (scene change)
export function resetLoop() { loop.frameFns.clear(); loop.timers = []; loop.scale = 1; }
