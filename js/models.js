import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import { gfx } from './gfx.js';

const loader = new GLTFLoader();
const cache = new Map();

export const MODELS = {
  alienA: 'assets/models/chars/alien_a.glb',
  alienB: 'assets/models/chars/alien_b.glb',
  alienC: 'assets/models/chars/alien_c.glb',
  astronaut: 'assets/models/chars/astronaut.glb',
  sp_mercury: 'assets/models/chars/species/mercury.glb',
  sp_venus: 'assets/models/chars/species/venus.glb',
  sp_mars: 'assets/models/chars/species/mars.glb',
  sp_jupiter: 'assets/models/chars/species/jupiter.glb',
  sp_saturn: 'assets/models/chars/species/saturn.glb',
  sp_uranus: 'assets/models/chars/species/uranus.glb',
  sp_neptune: 'assets/models/chars/species/neptune.glb',
  sp_alt1: 'assets/models/chars/species/alt1.glb',
  sp_alt2: 'assets/models/chars/species/alt2.glb',
  sp_alt3: 'assets/models/chars/species/alt3.glb',
  palm1: 'assets/models/desert/palm-tree__A6cKJYFsIb.glb',
  palm2: 'assets/models/desert/palm-tree__DsrrAYmucG.glb',
  palm3: 'assets/models/desert/palm-tree__P0tgwyXBgr.glb',
  palm4: 'assets/models/desert/palm-tree__nr1B5DbICA.glb',
  palms: 'assets/models/desert/palm-trees__VYslw9DEi6.glb',
  tent: 'assets/models/desert/tent__5Q7qIrfDxA.glb',
  meteor: 'assets/models/space/meteor.glb',
  meteorD: 'assets/models/space/meteor_detailed.glb',
  meteorH: 'assets/models/space/meteor_half.glb',
  rock: 'assets/models/space/rock.glb',
  rockA: 'assets/models/space/rock_largeA.glb',
  rockB: 'assets/models/space/rock_largeB.glb',
  crystals: 'assets/models/space/rock_crystals.glb',
  crystalsA: 'assets/models/space/rock_crystalsLargeA.glb',
  crystalsB: 'assets/models/space/rock_crystalsLargeB.glb',
  rocksA: 'assets/models/space/rocks_smallA.glb',
  rocksB: 'assets/models/space/rocks_smallB.glb',
  crater: 'assets/models/space/crater.glb',
  craterL: 'assets/models/space/craterLarge.glb',
  dish: 'assets/models/space/satelliteDish_detailed.glb',
  wireless: 'assets/models/space/machine_wireless.glb',
  rover: 'assets/models/space/rover.glb',
  hangarGlass: 'assets/models/space/hangar_roundGlass.glb',
  padL: 'assets/models/kaykit_space/landingpad_large.gltf',
  padS: 'assets/models/kaykit_space/landingpad_small.gltf',
  baseA: 'assets/models/kaykit_space/basemodule_A.gltf',
  baseC: 'assets/models/kaykit_space/basemodule_C.gltf',
  turbine: 'assets/models/kaykit_space/windturbine_tall.gltf',
  solar: 'assets/models/kaykit_space/solarpanel.gltf',
  structTall: 'assets/models/kaykit_space/structure_tall.gltf',
  lights: 'assets/models/kaykit_space/lights.gltf',
  cargo: 'assets/models/kaykit_space/cargo_A_stacked.gltf',
  drill: 'assets/models/kaykit_space/drill_structure.gltf',
};

// The online build ships each model as base64 GLB text (its host only serves web media types).
const ONLINE = !!document.querySelector('meta[name="pq-online"]');
async function loadOne(url) {
  if (!ONLINE) return loader.loadAsync(url);
  const txt = await (await fetch(url + '.b64.txt')).text();
  const bin = Uint8Array.from(atob(txt.trim()), c => c.charCodeAt(0));
  return loader.parseAsync(bin.buffer, url.slice(0, url.lastIndexOf('/') + 1));
}

export async function loadModels(keys, onProgress) {
  let done = 0;
  await Promise.all(keys.map(async k => {
    if (!cache.has(k)) {
      const g = await loadOne(MODELS[k]);
      g.scene.traverse(o => {
        if (o.isMesh) {
          o.castShadow = true; o.receiveShadow = true;
          const ms = Array.isArray(o.material) ? o.material : [o.material];
          // unlit (KHR_materials_unlit) creatures become lit so they sit in the world's light and shadows
          const lit = ms.map(m => m.isMeshBasicMaterial ? Object.assign(new THREE.MeshStandardMaterial({ map: m.map, color: m.color, roughness: 0.55, emissive: 0xffffff, emissiveMap: m.map, emissiveIntensity: 0.32 }), { name: m.name }) : m);
          if (lit.some((m, i) => m !== ms[i])) o.material = Array.isArray(o.material) ? lit : lit[0];
          for (const m of lit) { if (m.isMeshStandardMaterial) { m.envMap = gfx.envMap; m.envMapIntensity = 0.45; } }
        }
      });
      cache.set(k, g);
    }
    done++; onProgress && onProgress(done / keys.length);
  }));
}

// Clone a model; size = target height (or max dimension with fit:'max'), centred on its base.
export function model(key, { height, fit = 'height', recolor, clone = true } = {}) {
  const g = cache.get(key);
  if (!g) throw new Error('model not loaded: ' + key);
  const src = g.scene;
  const obj = SkeletonUtils.clone(src);
  // independent materials so recolouring does not leak between instances
  obj.traverse(o => {
    if (o.isMesh) {
      o.material = Array.isArray(o.material) ? o.material.map(m => m.clone()) : o.material.clone();
      if (recolor) {
        const ms = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of ms) if (recolor[m.name] !== undefined) m.color.set(recolor[m.name]);
      }
    }
  });
  const wrap = new THREE.Group(); wrap.add(obj);
  if (height) {
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const size = box.getSize(new THREE.Vector3());
    const ref = fit === 'max' ? Math.max(size.x, size.y, size.z) : size.y;
    const s = height / (ref || 1);
    obj.scale.multiplyScalar(s);
    obj.updateMatrixWorld(true);
    const b2 = new THREE.Box3().setFromObject(obj);
    const c = b2.getCenter(new THREE.Vector3());
    obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= b2.min.y;
  }
  wrap.userData.anims = g.animations;
  return wrap;
}

// Character with animation mixer. play(name, {loop, fade}) matches clip names by suffix (e.g. 'Wave' matches 'CharacterArmature|Wave').
export function character(key, opts = {}) {
  const obj = model(key, opts);
  const mixer = new THREE.AnimationMixer(obj.children[0]);
  const clips = obj.userData.anims || [];
  let current = null;
  const find = name => clips.find(c => c.name === name || c.name.endsWith('|' + name) || c.name.endsWith('_' + name));
  obj.userData.mixer = mixer;
  obj.userData.clipNames = clips.map(c => c.name.split('|').pop());
  obj.userData.play = (name, { loop = true, fade = 0.25, speed = 1, then } = {}) => {
    const clip = find(name); if (!clip) return null;
    const action = mixer.clipAction(clip);
    action.reset(); action.setEffectiveTimeScale(speed);
    action.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    action.clampWhenFinished = !loop;
    if (current && current !== action) { action.crossFadeFrom(current, fade, false); }
    action.play(); current = action;
    if (!loop && then) {
      const onFin = e => { if (e.action === action) { mixer.removeEventListener('finished', onFin); obj.userData.play(then, { fade }); } };
      mixer.addEventListener('finished', onFin);
    }
    return action;
  };
  obj.userData.update = dt => mixer.update(dt);
  return obj;
}

export function hasModel(k) { return cache.has(k); }
