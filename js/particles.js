import * as THREE from 'three';
import { gfx } from './gfx.js';

// Point-sprite particle system: soft round puffs. One system per blend mode.
export class Particles {
  constructor(max = 600, { additive = false, texture = 'soft' } = {}) {
    this.max = max; this.n = 0;
    this.p = new Float32Array(max * 3); this.v = new Float32Array(max * 3);
    this.life = new Float32Array(max); this.age = new Float32Array(max);
    this.s0 = new Float32Array(max); this.s1 = new Float32Array(max);
    this.c0 = new Float32Array(max * 3); this.c1 = new Float32Array(max * 3);
    this.a0 = new Float32Array(max); this.drag = new Float32Array(max); this.grav = new Float32Array(max * 3);
    const geo = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(new Float32Array(max * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.BufferAttribute(new Float32Array(max * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(new Float32Array(max), 1).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.aPos); geo.setAttribute('color', this.aCol); geo.setAttribute('size', this.aSize);
    const mat = new THREE.ShaderMaterial({
      uniforms: { px: { value: gfx.renderer.getPixelRatio() * gfx.height * 0.5 / Math.tan(THREE.MathUtils.degToRad(gfx.camera.fov / 2)) }, soft: { value: texture === 'soft' ? 1 : 0 } },
      vertexShader: `attribute vec4 color; attribute float size; varying vec4 vC; uniform float px;
        void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = size * px / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `varying vec4 vC; uniform float soft;
        void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d)*2.0; if (r > 1.0) discard;
          float a = soft > 0.5 ? smoothstep(1.0, 0.35, r) : smoothstep(1.0, 0.8, r);
          vec3 c = vC.rgb * (soft > 0.5 ? (1.0 - r*0.08) : 1.0);
          gl_FragColor = vec4(c, vC.a * a); }`,
      transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.mat = mat;
    this.points = new THREE.Points(geo, mat); this.points.frustumCulled = false; this.points.renderOrder = 5;
    geo.setDrawRange(0, 0);
    this._c = new THREE.Color(); this._d = new THREE.Color();
  }
  refreshScale() { this.mat.uniforms.px.value = gfx.renderer.getPixelRatio() * gfx.height * 0.5 / Math.tan(THREE.MathUtils.degToRad(gfx.camera.fov / 2)); }
  emit({ pos, vel = [0, 0, 0], spread = 0, velSpread = 0, life = 1, lifeVar = 0.3, size = 0.5, sizeEnd = 1, color = 0xffffff, colorEnd = null, alpha = 1, drag = 0, gravity = [0, 0, 0], count = 1 }) {
    this._c.set(color); this._d.set(colorEnd ?? color);
    for (let k = 0; k < count; k++) {
      if (this.n >= this.max) this.kill(0);
      const i = this.n++;
      this.p[i * 3] = pos[0] + (Math.random() - 0.5) * spread; this.p[i * 3 + 1] = pos[1] + (Math.random() - 0.5) * spread; this.p[i * 3 + 2] = pos[2] + (Math.random() - 0.5) * spread;
      this.v[i * 3] = vel[0] + (Math.random() - 0.5) * velSpread; this.v[i * 3 + 1] = vel[1] + (Math.random() - 0.5) * velSpread; this.v[i * 3 + 2] = vel[2] + (Math.random() - 0.5) * velSpread;
      this.life[i] = life * (1 + (Math.random() - 0.5) * lifeVar); this.age[i] = 0;
      this.s0[i] = size * (0.8 + Math.random() * 0.4); this.s1[i] = sizeEnd * (0.8 + Math.random() * 0.4);
      this.c0.set([this._c.r, this._c.g, this._c.b], i * 3); this.c1.set([this._d.r, this._d.g, this._d.b], i * 3);
      this.a0[i] = alpha; this.drag[i] = drag; this.grav.set(gravity, i * 3);
    }
  }
  kill(i) {
    const j = --this.n; if (i === j) return;
    const cp3 = a => { a[i * 3] = a[j * 3]; a[i * 3 + 1] = a[j * 3 + 1]; a[i * 3 + 2] = a[j * 3 + 2]; };
    cp3(this.p); cp3(this.v); cp3(this.c0); cp3(this.c1); cp3(this.grav);
    this.life[i] = this.life[j]; this.age[i] = this.age[j]; this.s0[i] = this.s0[j]; this.s1[i] = this.s1[j]; this.a0[i] = this.a0[j]; this.drag[i] = this.drag[j];
  }
  update(dt) {
    this.refreshScale();
    for (let i = this.n - 1; i >= 0; i--) {
      this.age[i] += dt; if (this.age[i] >= this.life[i]) { this.kill(i); continue; }
      const dk = Math.max(0, 1 - this.drag[i] * dt);
      for (let a = 0; a < 3; a++) { this.v[i * 3 + a] = this.v[i * 3 + a] * dk + this.grav[i * 3 + a] * dt; this.p[i * 3 + a] += this.v[i * 3 + a] * dt; }
    }
    const P = this.aPos.array, Cc = this.aCol.array, S = this.aSize.array;
    for (let i = 0; i < this.n; i++) {
      const k = this.age[i] / this.life[i];
      P[i * 3] = this.p[i * 3]; P[i * 3 + 1] = this.p[i * 3 + 1]; P[i * 3 + 2] = this.p[i * 3 + 2];
      for (let a = 0; a < 3; a++) Cc[i * 4 + a] = this.c0[i * 3 + a] + (this.c1[i * 3 + a] - this.c0[i * 3 + a]) * k;
      Cc[i * 4 + 3] = this.a0[i] * (k < 0.12 ? k / 0.12 : 1 - (k - 0.12) / 0.88);
      S[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * Math.sqrt(k);
    }
    this.aPos.needsUpdate = true; this.aCol.needsUpdate = true; this.aSize.needsUpdate = true;
    this.points.geometry.setDrawRange(0, this.n);
  }
}

// Confetti: instanced tumbling paper bits
export class Confetti {
  constructor(max = 400) {
    this.max = max;
    const geo = new THREE.PlaneGeometry(0.07, 0.11);
    const mat = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.6, emissive: 0x222222 });
    this.mesh = new THREE.InstancedMesh(geo, mat, max); this.mesh.frustumCulled = false; this.mesh.count = 0;
    this.items = [];
    this.palette = [0xff5a5f, 0xffc83d, 0x12a150, 0x3d8bff, 0x7b5cff, 0xff8ad8, 0x2ec4b6].map(c => new THREE.Color(c));
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._s = new THREE.Vector3(1, 1, 1);
  }
  burst(origin, up, count = 120, power = 4) {
    const side = new THREE.Vector3(1, 0, 0); if (Math.abs(up.x) > 0.9) side.set(0, 0, 1);
    const b = new THREE.Vector3().crossVectors(up, side).normalize(); side.crossVectors(b, up).normalize();
    for (let i = 0; i < count; i++) {
      if (this.items.length >= this.max) this.items.shift();
      const a = Math.random() * Math.PI * 2, r = Math.random();
      const v = up.clone().multiplyScalar(power * (0.7 + Math.random() * 0.6)).addScaledVector(side, Math.cos(a) * r * power * 0.6).addScaledVector(b, Math.sin(a) * r * power * 0.6);
      this.items.push({ p: origin.clone(), v, up: up.clone(), rot: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6), spin: new THREE.Vector3((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12), life: 3 + Math.random() * 1.5, age: 0, c: this.palette[(Math.random() * this.palette.length) | 0] });
    }
  }
  update(dt) {
    let n = 0;
    this.items = this.items.filter(it => (it.age += dt) < it.life);
    for (const it of this.items) {
      it.v.addScaledVector(it.up, -5.5 * dt); it.v.multiplyScalar(1 - 1.6 * dt); // gravity + air drag (floaty fall)
      it.p.addScaledVector(it.v, dt); it.rot.addScaledVector(it.spin, dt);
      this._e.set(it.rot.x, it.rot.y, it.rot.z); this._q.setFromEuler(this._e);
      const fade = Math.min(1, (it.life - it.age) / 0.6); this._s.setScalar(fade);
      this._m.compose(it.p, this._q, this._s); this.mesh.setMatrixAt(n, this._m); this.mesh.setColorAt(n, it.c); n++;
    }
    this.mesh.count = n; this.mesh.instanceMatrix.needsUpdate = true; if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
