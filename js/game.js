import * as THREE from 'three';
import { gfx } from './gfx.js';
import { resetLoop, sleep, tween } from './loop.js';
import { clearUI } from './ui.js';
import { governor, quality } from './perf.js';

export const app = { world: null, busy: false };

const fadeEl = document.createElement('div');
Object.assign(fadeEl.style, { position: 'fixed', inset: '0', background: '#0d0a24', opacity: '1', pointerEvents: 'none', transition: 'opacity .55s ease', zIndex: 20 });
document.body.appendChild(fadeEl);
export const fade = {
  out: () => new Promise(r => { fadeEl.style.pointerEvents = 'auto'; fadeEl.style.opacity = '1'; setTimeout(r, 580); }),
  in: () => new Promise(r => { fadeEl.style.opacity = '0'; setTimeout(() => { fadeEl.style.pointerEvents = 'none'; r(); }, 580); }),
};

// Free the GPU memory of a finished world: geometries, materials, their textures, skeletons and shadow maps.
// (Textures that later worlds reuse are simply uploaded again; the images stay in memory.)
function dispose(world) {
  if (!world) return;
  world.dispose && world.dispose();
  const textures = new Set();
  world.scene.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.isSkinnedMesh && o.skeleton) o.skeleton.dispose();
    if (o.isLight && o.dispose) o.dispose(); // frees the light's shadow map (several MB each)
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => {
      for (const v of Object.values(m)) if (v && v.isTexture) textures.add(v);
      if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u && u.value && u.value.isTexture) textures.add(u.value);
      m.dispose();
    });
  });
  textures.forEach(t => { if (t !== gfx.envMap) t.dispose(); });
}

// Switch to a new world: fade out, build, fade in. build() returns the world object.
export async function switchWorld(build, { keepUI = [] } = {}) {
  await fade.out();
  resetLoop();
  clearUI(keepUI);
  const old = app.world; app.world = null; dispose(old);
  gfx.renderer.shadowMap.enabled = quality.shadows; // a slow device may have asked for no shadows
  const w = await build();
  app.world = w;
  // compile every shader and upload every texture while the screen is still covered, so nothing hitches later
  w.update(0.001);
  const hidden = []; w.scene.traverse(o => { if (!o.visible) { hidden.push(o); o.visible = true; } }); // hidden things (flame, pilot...) get compiled too
  gfx.renderer.compile(w.scene, gfx.camera);
  hidden.forEach(o => { o.visible = false; });
  w.scene.traverse(o => { const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []; for (const m of ms) for (const v of Object.values(m)) if (v && v.isTexture) gfx.renderer.initTexture(v); });
  w.afterCompile && w.afterCompile();
  await sleep(0.05);
  governor.reset();
  fade.in();
  return w;
}

// Camera helper used by every world: smooth follow of cam.pos / cam.target with optional idle drift.
export function makeCam(pos, target) {
  const cam = { pos: pos.clone(), target: target.clone(), drift: 1, t: 0, lerp: 1 };
  const curP = pos.clone(), curT = target.clone(), off = new THREE.Vector3();
  cam.apply = dt => {
    cam.t += dt;
    const k = cam.lerp >= 1 ? 1 : 1 - Math.pow(1 - cam.lerp, dt * 60);
    curP.lerp(cam.pos, k); curT.lerp(cam.target, k);
    off.set(Math.sin(cam.t * 0.17) * 0.35, Math.sin(cam.t * 0.23) * 0.12, Math.cos(cam.t * 0.13) * 0.2).multiplyScalar(cam.drift);
    gfx.camera.position.copy(curP).add(off);
    gfx.camera.lookAt(curT);
  };
  cam.snap = () => { curP.copy(cam.pos); curT.copy(cam.target); };
  cam.move = (p, t, dur, e) => {
    const p0 = cam.pos.clone(), t0 = cam.target.clone();
    return tween(dur, k => { cam.pos.lerpVectors(p0, p, k); cam.target.lerpVectors(t0, t, k); }, e);
  };
  return cam;
}
