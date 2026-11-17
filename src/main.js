import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

/*SIM*/

// ======================= helpers =======================
const $ = (id) => document.getElementById(id);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const store = {
  get(k, d) { try { const v = localStorage.getItem('tinydrive.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('tinydrive.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
};
const setText = (el, s) => { if (el._t !== s) { el._t = s; el.textContent = s; } };
const fmt = (t) => { if (!(t >= 0)) t = 0; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(2); };
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
const wrapI = (d, N) => { d %= N; if (d > N / 2) d -= N; else if (d < -N / 2) d += N; return d; };
const ordinal = ['', '1st', '2nd', '3rd', '4th'];
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

const COLORS = [
  { hex: '#c91420', name: 'Rosso Corsa Red' },
  { hex: '#f0b323', name: 'Sunshine Yellow' },
  { hex: '#252b2d', name: 'Carbon Black' },
  { hex: '#2d5ea8', name: 'Deep Blue' },
  { hex: '#d8d6cc', name: 'Silver' },
  { hex: '#7d13e8', name: 'Viola Purple' },
  { hex: '#ff6a00', name: 'Arancio Orange' }
];
// The car list: the three (non-commercial-free) models you sent. Pick one in the menu with the arrows —
// you drive the one you picked and the other two become your rivals, so every race has three different cars.
// top / acc = a small performance difference, cam = [z, y] of the hood and bumper cameras (metres, car frame).
const MODEL_LIST = [
  { id: 'divo', name: 'Bugatti Divo', tag: 'W16 hypercar · aero', top: 1.0, acc: 1.0, nat: 0, cam: { hood: [1.34, 1.10], bumper: [2.62, .50] } },
  { id: 'chiron', name: 'Bugatti Chiron', tag: 'W16 · long-legged', top: 1.02, acc: .99, nat: 3, cam: { hood: [1.30, 1.08], bumper: [2.55, .48] } },
  { id: 'essenza', name: 'Lamborghini Essenza', tag: 'V12 track weapon', top: .98, acc: 1.03, nat: 1, cam: { hood: [1.28, 1.06], bumper: [2.50, .46] } },
  { id: 'sport', name: 'Lotus Sports GT', tag: 'Lightweight · nimble', top: .96, acc: 1.05, nat: 5, cam: { hood: [1.22, 1.02], bumper: [2.45, .44] } }
];
// the rival name a slot uses (colours come from each model's nat)
const RIVAL_NAMES = ['Bijli', 'Shaheen', 'Sher Khan'];
const NCARS = MODEL_LIST.length;                // 4: you + the other models as rivals — every car in a race is a different model
const MODEL_BY = {}; MODEL_LIST.forEach(m => { MODEL_BY[m.id] = m; });
const MODEL_IDS = MODEL_LIST.map(m => m.id);
// ---- which circuit is loaded: only the chosen one is ever built / downloaded / run (changing it in the menu reloads the page) ----
const TRACK_ID = store.get('track', 'monaco') === 'desert' ? 'desert' : 'monaco';
const TRACK_INFO = {
  monaco: { name: 'Monaco', glb: './assets/monaco.glb', laps: 1, skip: null, ground: '#a98d5e', wall: '#ffffff' },
  desert: { name: 'Desert', glb: './assets/registan.glb', laps: 3, speedK: .86, skip: /^(huanjing|No_Name)$/, ground: '#c98f58', wall: '#e8c9a0' }
};
const TI = TRACK_INFO[TRACK_ID];
const LAPS = TI.laps;
const settings = {
  color: Math.min(store.get('color2', 5), COLORS.length - 1),
  car: MODEL_IDS.includes(store.get('car2', 'divo')) ? store.get('car2', 'divo') : 'divo',
  sound: store.get('sound', true), autoGas: store.get('autoGas', false),
  cam: Math.max(0, Math.min(5, store.get('cam', 0) | 0))
};

// ======================= renderer / scene =======================
const canvas = $('gl');
// weak phones (<= 4 GB RAM or <= 4 cores, e.g. Helio G36 class) start on lighter settings: fewer trees, lower starting resolution
const LOW_END = isTouch && ((navigator.deviceMemory || 8) <= 4 || (navigator.hardwareConcurrency || 8) <= 4);
// MSAA is wasted on dense screens (the pixel ratio already hides the jaggies) and costs a lot of fill rate
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch && (window.devicePixelRatio || 1) < 1.5, powerPreference: 'high-performance' });
let dprMax = Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 1.75), dpr = isTouch ? Math.min(dprMax, LOW_END ? 1 : 1.25) : dprMax, dprCeil = dprMax;
renderer.setPixelRatio(dpr);
const DPR_MIN = Math.min(LOW_END ? .9 : 1.1, dprMax);   // the adaptive resolution never drops below this, so cars stay sharp (was 0.75)
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 0.4, 5200);
function makeSky(stops) {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const g = c.getContext('2d'), grad = g.createLinearGradient(0, 0, 0, 256);
  stops.forEach((s, i) => grad.addColorStop(i / (stops.length - 1), s));
  g.fillStyle = grad; g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const WX = {
  monaco: { sky: makeSky(['#6fa9d6', '#b9d9e6', '#e3eee2']), fog: '#d4e6dc', near: 260, far: 2700, hemi: 1.15, sun: 2.3, env: .55, exp: 1.0, grip: 1, ground: '#86a06c', sunCol: '#fff3d9' },
  desert: { sky: makeSky(['#2c72cc', '#86b2e0', '#efdcb6']), fog: '#efdcb6', near: 380, far: 3400, hemi: 1.3, sun: 2.7, env: .6, exp: 1.0, grip: 1, ground: '#c99a62', sunCol: '#fff0cf' }
};
scene.fog = new THREE.Fog(WX[TRACK_ID].fog, WX[TRACK_ID].near, WX[TRACK_ID].far);
const hemi = new THREE.HemisphereLight('#ffffff', WX[TRACK_ID].ground, 1.15); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff3d9', 2.3); sun.position.set(-180, 260, 120); scene.add(sun);
{
  const pm = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  scene.environment = pm.fromScene(room, 0.04).texture; scene.environmentIntensity = 0.55;
  room.dispose(); pm.dispose();
}
const ENV = { grip: 1 };
function applyWeather() {
  const w = WX[TRACK_ID];
  scene.background = w.sky; scene.fog.color.set(w.fog); scene.fog.near = w.near; scene.fog.far = w.far;
  hemi.intensity = w.hemi; hemi.groundColor.set(w.ground); sun.intensity = w.sun; sun.color.set(w.sunCol);
  scene.environmentIntensity = w.env; renderer.toneMappingExposure = w.exp; ENV.grip = w.grip;
}
scene.background = WX[TRACK_ID].sky;

// ======================= car models: built ONCE, cached, cloned =======================
const CAR_SCALE = 0.82;
const CAR = { shadowGeo: null, shadowMat: null };
const MODELS = { divo: null, chiron: null, essenza: null, sport: null };   // cached templates: {template, mats, paintKeys, wr (wheel radius, world m), name}
/*GLYPHS*/
/*SPORT*/

function buildShadowAssets() {
  const sc = document.createElement('canvas'); sc.width = sc.height = 128;
  const g = sc.getContext('2d'), rg = g.createRadialGradient(64, 64, 6, 64, 64, 64);
  rg.addColorStop(0, 'rgba(20,32,20,.75)'); rg.addColorStop(.55, 'rgba(20,32,20,.4)'); rg.addColorStop(1, 'rgba(20,32,20,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  CAR.shadowGeo = new THREE.PlaneGeometry(3.3, 6.4); CAR.shadowGeo.rotateX(-Math.PI / 2);
  CAR.shadowMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, toneMapped: false, fog: false });
}

function setCarColor(v, hex) {
  for (const k in v.pm) { v.pm[k].color.set(hex); if (k === 'paintDeep') v.pm[k].color.multiplyScalar(.6); }
}

// ---- car LOD (level of detail): far cars use a simplified copy of the body. Vertex clustering: every vertex is snapped to a small grid,
//      vertices that land in the same cell merge, triangles that collapse are dropped. The 3 studio cars have ~100k triangles each. ----
const LOD_DIST = 20, LOD_CELL = .1;
function simplifyGeo(src, cell) {
  const g = src.index ? src.toNonIndexed() : src, P = g.attributes.position, Nn = g.attributes.normal, n = P.count, map = new Map(), id = new Int32Array(n);
  const px = [], py = [], pz = [], nx = [], ny = [], nz = [], cnt = [];
  for (let i = 0; i < n; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i), key = Math.round(x / cell) + ',' + Math.round(y / cell) + ',' + Math.round(z / cell);
    let j = map.get(key); if (j === undefined) { j = px.length; map.set(key, j); px.push(0); py.push(0); pz.push(0); nx.push(0); ny.push(0); nz.push(0); cnt.push(0); }
    px[j] += x; py[j] += y; pz[j] += z; if (Nn) { nx[j] += Nn.getX(i); ny[j] += Nn.getY(i); nz[j] += Nn.getZ(i); } cnt[j]++; id[i] = j;
  }
  const m = px.length, pos = new Float32Array(m * 3), nor = new Float32Array(m * 3);
  for (let j = 0; j < m; j++) {
    pos[j * 3] = px[j] / cnt[j]; pos[j * 3 + 1] = py[j] / cnt[j]; pos[j * 3 + 2] = pz[j] / cnt[j];
    const l = Math.hypot(nx[j], ny[j], nz[j]) || 1; nor[j * 3] = nx[j] / l; nor[j * 3 + 1] = ny[j] / l; nor[j * 3 + 2] = nz[j] / l;
  }
  const idx = [];
  for (let i = 0; i < n; i += 3) { const a = id[i], b = id[i + 1], c = id[i + 2]; if (a !== b && b !== c && a !== c) idx.push(a, b, c); }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setIndex(idx); out.computeBoundingSphere(); return out;
}
function lowShellFor(M) {   // built once per car model, shared by every copy; null for the small cars that do not need it
  if (M.lowShell !== undefined) return M.lowShell;
  const hi = M.template.children[0]; let tris = 0;
  hi.traverse(o => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  if (tris < 30000) return (M.lowShell = null);
  const lo = new THREE.Group();
  hi.children.forEach(o => { if (!o.isMesh) return; const m = new THREE.Mesh(simplifyGeo(o.geometry, LOD_CELL), o.material); m.userData.mk = o.userData.mk; lo.add(m); });
  lo.visible = false; return (M.lowShell = lo);
}

function spawnCar(id, colorHex, name, you) {
  const M = MODELS[id];
  const root = new THREE.Group(), tilt = new THREE.Group(); root.add(tilt);
  const model = M.template.clone(true); tilt.add(model);       // geometry + shared materials are reused, nothing is rebuilt
  const shellHi = model.children[0], lowT = lowShellFor(M), shellLo = lowT ? lowT.clone(true) : null; if (shellLo) { shellLo.visible = false; model.add(shellLo); }
  const pm = {}; for (const k of M.paintKeys) pm[k] = M.mats[k].clone();
  const tail = M.mats.tail.clone();
  model.traverse(o => { if (o.isMesh) { const k = o.userData.mk; if (pm[k]) o.material = pm[k]; else if (k === 'tail') o.material = tail; } });
  const wheels = [];
  for (const [n, front, flipped] of [['pivot_f0', true, false], ['pivot_f1', true, M.flipRight], ['pivot_r0', false, false], ['pivot_r1', false, M.flipRight]]) {
    const pivot = model.getObjectByName(n); wheels.push({ pivot, spin: pivot.getObjectByName('spin'), front, flipped });
  }
  const shadow = new THREE.Mesh(CAR.shadowGeo, CAR.shadowMat); shadow.position.y = .1; shadow.renderOrder = 2; root.add(shadow);
  scene.add(root);
  const v = { id, root, tilt, pm, tail, tailBase: M.tailBase, tailBrake: M.tailBrake, wr: M.wr, wheels, wheelAngle: 0, pitch: 0, roll: 0, prevVf: 0, accel: 0, shadow, you, M, shellHi, shellLo, lodFar: false };
  setCarColor(v, colorHex);
  return v;
}
function disposeCar(v) {   // only per-car materials are disposed; geometry/templates stay cached
  if (!v) return;
  scene.remove(v.root);
  for (const k in v.pm) v.pm[k].dispose(); v.tail.dispose();
}

// ---- the three procedural studio models (Civic, Revuelto, Red Sports): build once with the original model code,
//      then bake each into a few merged meshes so a whole car costs a handful of draw calls ----
function bakeProcedural(id, create, o) {
  const car = create({ color: '#c91420' });
  car.setLights(true);
  const root = car.root; root.updateMatrixWorld(true);
  const byMat = new Map(); for (const k in car.materials) byMat.set(car.materials[k], k);
  const pivots = car.allPivots, spinOf = p => p.children.find(c => c.isGroup);
  const spins = new Set(pivots.map(spinOf)), pivSet = new Set(pivots);
  const inside = (o2, set) => { for (let p = o2.parent; p; p = p.parent) if (set.has(p)) return p; return null; };
  const bake = (mesh, refInv) => {
    const mx = new THREE.Matrix4().multiplyMatrices(refInv, mesh.matrixWorld);
    let g = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    for (const n of Object.keys(g.attributes)) if (n !== 'position' && n !== 'normal') g.deleteAttribute(n);
    if (!g.attributes.normal) g.computeVertexNormals();
    g.clearGroups(); g.applyMatrix4(mx);
    if (mx.determinant() < 0) { const p = g.attributes.position, nn = g.attributes.normal; for (let i = 0; i < p.count; i += 3) for (const a of [p, nn]) { const x = a.getX(i + 1), y = a.getY(i + 1), z = a.getZ(i + 1); a.setXYZ(i + 1, a.getX(i + 2), a.getY(i + 2), a.getZ(i + 2)); a.setXYZ(i + 2, x, y, z); } }
    return g;
  };
  const collect = (filter, refInv) => {      // -> Map(material -> [geometry])
    const out = new Map();
    root.traverse(m => { if (!m.isMesh || !m.visible || !filter(m)) return; if (!out.has(m.material)) out.set(m.material, []); out.get(m.material).push(bake(m, refInv)); });
    return out;
  };
  const meshesFrom = (groups, parent) => {
    let i = 0;
    groups.forEach((list, mat) => { const geo = mergeGeometries(list, false); list.forEach(g => g.dispose()); if (!geo) return;
      const me = new THREE.Mesh(geo, mat); me.userData.mk = byMat.get(mat) || ('m' + (i++)); parent.add(me); });
  };
  const model = new THREE.Group(); model.name = 'model'; model.rotation.y = -Math.PI / 2;
  const shell = new THREE.Group(); model.add(shell);
  const I = new THREE.Matrix4();
  meshesFrom(collect(m => !inside(m, pivSet), I), shell);
  // one wheel set per side (left z>0, right z<0), shared by the two wheels of that side
  const byName = n => pivots.find(p => p.name === n);
  const sets = {};
  for (const [side, pv2] of [['L', byName('Wheel_FL_Pivot')], ['R', byName('Wheel_FR_Pivot')]]) {
    const sp = spinOf(pv2), sInv = sp.matrixWorld.clone().invert(), pInv = pv2.matrixWorld.clone().invert();
    const spin = new THREE.Group(), stat = new THREE.Group();
    meshesFrom(collect(m => inside(m, spins) === sp, sInv), spin);
    meshesFrom(collect(m => inside(m, pivSet) === pv2 && !inside(m, spins), pInv), stat);
    sets[side] = { spin, stat };
  }
  const specs = [['pivot_f0', 'Wheel_FL_Pivot', 'L'], ['pivot_f1', 'Wheel_FR_Pivot', 'R'], ['pivot_r0', 'Wheel_RL_Pivot', 'L'], ['pivot_r1', 'Wheel_RR_Pivot', 'R']];
  for (const [n, src, side] of specs) {
    const pivot = new THREE.Group(); pivot.name = n; pivot.position.copy(byName(src).position);
    const spin = new THREE.Group(); spin.name = 'spin';
    sets[side].spin.children.forEach(c => spin.add(new THREE.Mesh(c.geometry, c.material)));
    sets[side].stat.children.forEach(c => pivot.add(new THREE.Mesh(c.geometry, c.material)));
    pivot.add(spin); model.add(pivot);
  }
  // release everything the original model made except what the baked meshes use
  root.traverse(m => { if (m.isSprite) { if (m.material.map) m.material.map.dispose(); m.material.dispose(); } else if (m.isMesh && m.geometry) m.geometry.dispose(); });
  const cm = car.materials;
  if (isTouch) for (const k in cm) if (cm[k].isMeshPhysicalMaterial) { cm[k].clearcoat = 0; cm[k].needsUpdate = true; }   // clearcoat is a costly second specular layer on phone GPUs
  MODELS[id] = { template: model, mats: { paint: cm.paint, paintCap: cm.paintCap, roof: cm.roof, paintDeep: cm.paintDeep, tail: cm.tail },
    paintKeys: ['paint', 'paintCap', 'roof', 'paintDeep'], wr: o.wr, flipRight: false, tailBase: o.tailBase, tailBrake: o.tailBrake, name: o.name };
}

// static scenery never moves: bake its matrix once so the renderer stops recomputing it every frame
function freeze(o) { o.updateMatrixWorld(true); o.traverse(c => { c.matrixAutoUpdate = false; c.matrixWorldAutoUpdate = false; }); }

/*GLBCAR*/

/*TRACK6*/

/*DESERT*/

/*GLBTRACK*/

const BUILDERS = {
  // one GLB per car; a file that failed to parse falls back to the studio-built sports body
  divo: () => { if (CAR_SCENES.divo) MODELS.divo = buildSportTemplate(CAR_SCENES.divo, 'Bugatti Divo'); else bakeProcedural('divo', createSportsCar, { name: 'Bugatti Divo', wr: .365, tailBase: 2.4, tailBrake: 6.5 }); },
  chiron: () => { if (CAR_SCENES.chiron) MODELS.chiron = buildSportTemplate(CAR_SCENES.chiron, 'Bugatti Chiron'); else bakeProcedural('chiron', createSportsCar, { name: 'Bugatti Chiron', wr: .365, tailBase: 2.4, tailBrake: 6.5 }); },
  essenza: () => { if (CAR_SCENES.essenza) MODELS.essenza = buildSportTemplate(CAR_SCENES.essenza, 'Lamborghini Essenza'); else bakeProcedural('essenza', createSportsCar, { name: 'Lamborghini Essenza', wr: .365, tailBase: 2.4, tailBrake: 6.5 }); },
  sport: () => { if (CAR_SCENES.sport) MODELS.sport = buildSportTemplate(CAR_SCENES.sport, 'Lotus Sports GT'); else bakeProcedural('sport', createSportsCar, { name: 'Lotus Sports GT', wr: .365, tailBase: 2.4, tailBrake: 6.5 }); }
};
function ensureModel(id) {
  if (!MODELS[id]) { BUILDERS[id](); }
  return MODELS[id];
}

// ======================= track =======================
const TRK = TRACK_ID === 'desert' ? TRACK_DESERT : TRACK6;
const track = buildTrack(1, TRK); track.speedK = TI.speedK || 1;
const HZ = buildHazards(track), HW = track.width / 2;
HZ.lava.length = 0; HZ.gates.length = 0;      // no lava zones on these circuits
// the road climbs and falls (and crosses itself on two bridges): the sim stays flat, the visuals follow these helpers
const trkY = track.y;
function groundY(prog) { const N = track.N; let q = prog % N; if (q < 0) q += N; const i = q | 0, f = q - i; return trkY[i] * (1 - f) + trkY[(i + 1) % N] * f; }
function slopeAt(prog) { const N = track.N, i = ((Math.floor(prog) % N) + N) % N; return Math.atan2(trkY[(i + 3) % N] - trkY[(i + N - 3) % N], 6 * track.ds); }
let gyP = 0;      // road height under the player (camera, rain, menu stage follow it)
const TB = (() => {
  let a = 1e9, b = -1e9, c = 1e9, d = -1e9;
  for (let i = 0; i < track.N; i++) { a = Math.min(a, track.x[i]); b = Math.max(b, track.x[i]); c = Math.min(c, track.z[i]); d = Math.max(d, track.z[i]); }
  return { minX: a, maxX: b, minZ: c, maxZ: d, cx: (a + b) / 2, cz: (c + d) / 2, r: Math.hypot(b - a, d - c) / 2 };
})();
const SC = { padTex: null, lavaTex: null, boulders: [], treeCells: [] };   // animated scenery + tree cells (distance culling)

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
  return t;
}
function addGantry(tr, idx, text, bg, fg, stripes) {
  const g = new THREE.Group(); g.position.set(tr.x[idx], tr.y ? tr.y[idx] : 0, tr.z[idx]); g.rotation.y = tr.heading[idx]; scene.add(g);
  const post = new THREE.MeshLambertMaterial({ color: stripes ? '#2a2a2a' : '#cfd6cc' });
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.8, 8, .8), post); p.position.set(s * (tr.hw[idx] + 2.2), 4, 0); g.add(p); }
  const bt = canvasTex(512, 96, (x, w, h) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    if (stripes) { x.fillStyle = '#111'; for (let i = -2; i < 12; i++) { x.beginPath(); x.moveTo(i * 44, 0); x.lineTo(i * 44 + 22, 0); x.lineTo(i * 44 + 22 - 20, 14); x.lineTo(i * 44 - 20, 14); x.fill(); x.beginPath(); x.moveTo(i * 44, h); x.lineTo(i * 44 + 22, h); x.lineTo(i * 44 + 22 - 20, h - 14); x.lineTo(i * 44 - 20, h - 14); x.fill(); } }
    x.fillStyle = fg; x.font = '800 50px Manrope, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 50);
  });
  // two single-sided planes (one per direction) so the text reads correctly from both sides, not mirrored on the back
  const geo = new THREE.PlaneGeometry(tr.hw[idx] * 2 + 4.4, 3.2), mat = new THREE.MeshBasicMaterial({ map: bt, toneMapped: false });
  for (const [ry, dz] of [[0, .02], [Math.PI, -.02]]) { const m = new THREE.Mesh(geo, mat); m.position.set(0, 7.2, dz); m.rotation.y = ry; g.add(m); }
  freeze(g); return g;
}
function laneQuadGeo(tr, quads) {   // quads: [i, latA, latB, y, hex]
  const N = tr.N, pos = [], col = [], ind = [], nor = [], c = new THREE.Color(); let vi = 0;
  for (const q of quads) {
    const i = q[0], a = q[1], b = q[2], y = q[3], j = (i + 1) % N; c.set(q[4]);
    const pts = [[tr.x[i] + tr.nx[i] * a, tr.z[i] + tr.nz[i] * a], [tr.x[i] + tr.nx[i] * b, tr.z[i] + tr.nz[i] * b], [tr.x[j] + tr.nx[j] * b, tr.z[j] + tr.nz[j] * b], [tr.x[j] + tr.nx[j] * a, tr.z[j] + tr.nz[j] * a]];
    for (const p of pts) { pos.push(p[0], y + (tr.y ? tr.y[i] : 0), p[1]); col.push(c.r, c.g, c.b); nor.push(0, 1, 0); }
    ind.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3); vi += 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(ind); g.computeBoundingSphere();
  return g;
}
function lavaStripGeo(tr, zone, side) {
  const N = tr.N, pos = [], uv = [], ind = [], nor = [], a = HW + LAVA_EDGE, b = a + 15, len = (zone.i1 - zone.i0 + N) % N;
  let d = 0;
  for (let k = 0; k <= len; k++) {
    const i = (zone.i0 + k) % N;
    for (const lat of [a, b]) { pos.push(tr.x[i] + tr.nx[i] * side * lat, 0, tr.z[i] + tr.nz[i] * side * lat); nor.push(0, 1, 0); }
    uv.push(0, d / 12, 1, d / 12); d += tr.ds;
    if (k > 0) { const v = (k - 1) * 2; ind.push(v, v + 1, v + 2, v + 1, v + 3, v + 2); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(ind); g.computeBoundingSphere();
  return g;
}

function wallStripGeo(tr, dIn, dOut, yBot, yTop, cap) {   // extruded stone barrier along both edges; dIn / dOut = offsets from the local pavement half width
  const N = tr.N, pos = [], uv = [];
  const put = (a, b, c, d, u0, u1, v0, v1) => {
    pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2], a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
    uv.push(u0, v0, u1, v0, u1, v1, u0, v0, u1, v1, u0, v1);
  };
  const span = yTop - yBot;
  for (const side of [-1, 1]) {
    let u = 0;
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N, du = tr.ds / 1.8;
      const ay = tr.y ? tr.y[i] : 0, by = tr.y ? tr.y[j] : 0;
      const ax = tr.x[i], az = tr.z[i], bx = tr.x[j], bz = tr.z[j];
      const anx = tr.nx[i] * side, anz = tr.nz[i] * side, bnx = tr.nx[j] * side, bnz = tr.nz[j] * side;
      const P = (x, z, n, lat, y) => [x + n[0] * lat, y + yBot + (cap ? 0 : 0), z + n[1] * lat];
      const aIn = tr.hw[i] + dIn, aOut = tr.hw[i] + dOut, bIn = tr.hw[j] + dIn, bOut = tr.hw[j] + dOut;
      const iB = [ax + anx * aIn, ay + yBot, az + anz * aIn], iT = [ax + anx * aIn, ay + yTop, az + anz * aIn];
      const oB = [ax + anx * aOut, ay + yBot, az + anz * aOut], oT = [ax + anx * aOut, ay + yTop, az + anz * aOut];
      const jB = [bx + bnx * bIn, by + yBot, bz + bnz * bIn], jT = [bx + bnx * bIn, by + yTop, bz + bnz * bIn];
      const joB = [bx + bnx * bOut, by + yBot, bz + bnz * bOut], joT = [bx + bnx * bOut, by + yTop, bz + bnz * bOut];
      put(iB, iT, jT, jB, u, u + du, 0, span / 1.1);      // face towards the road
      put(iT, oT, joT, jT, u, u + du, .02, .98);          // top
      put(oB, oT, joT, joB, u, u + du, 0, span / 1.1);    // outside face
      u += du;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals(); g.computeBoundingSphere();
  return g;
}

function buildTrackVisuals(tr) {
  const N = tr.N, hw = HW, rnd = mulberry32(20261110), quads = [];   // (hw = start-line half width; every point has its own in tr.hw)
  for (let i = 0; i < N; i++) {
    const hw = tr.hw[i];
    quads.push([i, -hw, hw, 0, (i >> 3) & 1 ? '#3d4245' : '#383d40']);
    quads.push([i, -hw - 1.5, -hw, .06, ((i / 2) | 0) % 2 ? '#c9212c' : '#f1efe6']);
    quads.push([i, hw, hw + 1.5, .06, ((i / 2) | 0) % 2 ? '#c9212c' : '#f1efe6']);
    if ((i >> 1) % 2 === 0) quads.push([i, -.18, .18, .08, '#e9e7d8']);
  }
  for (const s of [[4, -5], [4, 5], [6, -5], [6, 5], [8, 0]]) quads.push([(N - s[0]) % N, s[1] - 1.7, s[1] + 1.7, .09, '#6f7679']);   // grid boxes
  if (!TRACKW.group) { const roadMesh = new THREE.Mesh(laneQuadGeo(tr, quads), new THREE.MeshLambertMaterial({ vertexColors: true })); scene.add(roadMesh); freeze(roadMesh); }

  // grass with tiling noise (gives a strong sense of speed)
  const gt = canvasTex(128, 128, (gx) => {
    gx.fillStyle = '#86b06a'; gx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 420; i++) { gx.fillStyle = Math.random() < .5 ? 'rgba(60,110,50,.22)' : 'rgba(170,205,120,.2)'; const s = 3 + Math.random() * 9; gx.fillRect(Math.random() * 128, Math.random() * 128, s, s); }
  }, true);
  const GS = 6400; gt.repeat.set(GS / 12, GS / 12);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(GS, GS), new THREE.MeshLambertMaterial({ map: gt }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(TB.cx, -.15, TB.cz);
  if (TRACKW.group) { ground.geometry.dispose(); ground.geometry = new THREE.PlaneGeometry(24000, 24000); ground.material = new THREE.MeshLambertMaterial({ color: TI.ground }); ground.position.y = TRACKW.floorY; }
  else if (trkY) { let lo = 1e9; for (let i = 0; i < track.N; i++) lo = Math.min(lo, trkY[i]); ground.position.y = lo - .15; }
  scene.add(ground); freeze(ground);

  // start / finish line + gantry
  const h0 = tr.heading[0], sx = tr.x[0], sz = tr.z[0];
  const ct = canvasTex(128, 32, (cx) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) { cx.fillStyle = (x + y) % 2 ? '#101412' : '#f4f3ea'; cx.fillRect(x * 8, y * 8, 8, 8); } });
  ct.magFilter = THREE.NearestFilter;
  const line = new THREE.Mesh(new THREE.PlaneGeometry(tr.hw[0] * 2, 2.4), new THREE.MeshBasicMaterial({ map: ct, toneMapped: false }));
  line.rotation.order = 'YXZ'; line.rotation.set(-Math.PI / 2 - slopeAt(0), h0, 0); line.position.set(sx, .1 + trkY[0], sz); scene.add(line); freeze(line);
  addGantry(tr, 0, 'MINI CAR RACE', '#c91420', '#ffffff', false);
  for (const gate of HZ.gates) addGantry(tr, (gate.idx + N - 6) % N, 'DANGER ZONE', '#ffc400', '#111111', true);

  // ---- stone barriers along both edges (solid: the wall clamp lives in stepCar) ----
  const stoneTex = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#3f3a33'; x.fillRect(0, 0, w, h);                       // mortar
    const rows = 4, ch = h / rows;
    for (let r = 0; r < rows; r++) {
      const shift = (r % 2) * (w / 8);
      for (let k = -1; k < 5; k++) {
        const bw = w / 4, bx = k * bw + shift, by = r * ch, g = 118 + (r * 53 + k * 29) % 46;
        x.fillStyle = 'rgb(' + g + ',' + (g - 7) + ',' + (g - 18) + ')';
        x.fillRect(bx + 3, by + 3, bw - 6, ch - 6);                        // one stone block
        x.fillStyle = 'rgba(255,255,255,.16)'; x.fillRect(bx + 3, by + 3, bw - 6, 3);
        x.fillStyle = 'rgba(0,0,0,.22)'; x.fillRect(bx + 3, by + ch - 7, bw - 6, 4);
        for (let s2 = 0; s2 < 40; s2++) {                                  // speckle so it reads as rock
          x.fillStyle = Math.random() < .5 ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.16)';
          x.fillRect(bx + 5 + Math.random() * (bw - 12), by + 5 + Math.random() * (ch - 14), 1.5 + Math.random() * 5, 1.5 + Math.random() * 3);
        }
      }
    }
  }, true);
  const wallIn = -.75, wallOut = -.1, capH = 1.35;
  const wallMesh = new THREE.Mesh(wallStripGeo(tr, wallIn, wallOut, -.9, capH, false), new THREE.MeshLambertMaterial({ map: stoneTex, color: TI.wall, side: THREE.DoubleSide }));
  const capMesh = new THREE.Mesh(wallStripGeo(tr, wallIn - .13, wallOut + .13, capH, capH + .16, true), new THREE.MeshLambertMaterial({ color: '#d8cfbe', side: THREE.DoubleSide }));
  scene.add(wallMesh); scene.add(capMesh); freeze(wallMesh); freeze(capMesh);

  // ---- hazards ----
  // boost pads: scrolling chevrons
  SC.padTex = canvasTex(128, 192, (x, w, h) => {
    x.fillStyle = 'rgba(5,40,30,.55)'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#3dffb0'; x.lineWidth = 14; x.lineJoin = 'miter';
    for (let k = 0; k < 3; k++) { const y = k * 64 + 44; x.beginPath(); x.moveTo(18, y + 26); x.lineTo(64, y - 10); x.lineTo(110, y + 26); x.stroke(); }
  }, true);
  { const mat = new THREE.MeshBasicMaterial({ map: SC.padTex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const geo = new THREE.PlaneGeometry(10.4, 14);
    for (const p of HZ.pads) { const m = new THREE.Mesh(geo, mat); m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2 - slopeAt(p.idx), p.h, Math.PI); m.position.set(p.x, .16 + trkY[p.idx], p.z); m.renderOrder = 1; scene.add(m); freeze(m); } }
  // oil slicks
  { const ot = canvasTex(128, 128, (x) => {
      const g = x.createRadialGradient(64, 64, 4, 64, 64, 62); g.addColorStop(0, 'rgba(4,5,10,.96)'); g.addColorStop(.7, 'rgba(10,12,26,.9)'); g.addColorStop(.88, 'rgba(60,40,120,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, 128, 128);
      x.fillStyle = 'rgba(120,200,255,.18)'; x.beginPath(); x.ellipse(46, 44, 20, 9, -.5, 0, 6.3); x.fill();
    });
    const mat = new THREE.MeshBasicMaterial({ map: ot, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const geo = new THREE.PlaneGeometry(2, 2); geo.rotateX(-Math.PI / 2);
    for (const o of HZ.oil) { const m = new THREE.Mesh(geo, mat); m.scale.set(o.r * 1.08, 1, o.r * .95); m.rotation.y = rnd() * 6; m.position.set(o.x, .12, o.z); m.renderOrder = 1; scene.add(m); freeze(m); } }
  // rocks
  if (HZ.rocks.length) { const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshLambertMaterial({ color: '#9a8c80', flatShading: true }), HZ.rocks.length), d = new THREE.Object3D();
    HZ.rocks.forEach((r, i) => { d.position.set(r.x, r.r * .45, r.z); d.scale.set(r.r * 1.15, r.r * .95, r.r * 1.05); d.rotation.set(rnd(), rnd() * 6, rnd()); d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
    im.instanceMatrix.needsUpdate = true; im.frustumCulled = false; scene.add(im); freeze(im);
    // warning cones next to every rock
    const cone = new THREE.InstancedMesh(new THREE.ConeGeometry(.45, 1.3, 8), new THREE.MeshLambertMaterial({ color: '#ff6a00' }), HZ.rocks.length * 2);
    let k = 0; HZ.rocks.forEach(r => { for (const s of [-1, 1]) { d.position.set(r.x - track.tx[r.idx] * s * (r.r + 3.2), .65, r.z - track.tz[r.idx] * s * (r.r + 3.2)); d.scale.set(1, 1, 1); d.rotation.set(0, 0, 0); d.updateMatrix(); cone.setMatrixAt(k++, d.matrix); } });
    cone.instanceMatrix.needsUpdate = true; cone.frustumCulled = false; scene.add(cone); freeze(cone); }
  // swinging boulders (moved every frame)
  { const geo = new THREE.IcosahedronGeometry(1, 1), mat = new THREE.MeshStandardMaterial({ color: '#7b4b36', roughness: .85, flatShading: true, emissive: '#4a1200', emissiveIntensity: .6 });
    for (const b of HZ.boulders) { const m = new THREE.Mesh(geo, mat); m.scale.setScalar(b.r); m.castShadow = false; scene.add(m); SC.boulders.push({ mesh: m, b }); } }
  // lava beside the road
  SC.lavaTex = canvasTex(256, 256, (x, w, h) => {
    x.fillStyle = '#5a1200'; x.fillRect(0, 0, w, h);
    const blob = (px, py, r, col) => { for (const dx of [-w, 0, w]) for (const dy of [-h, 0, h]) { x.fillStyle = col; x.beginPath(); x.arc(px + dx, py + dy, r, 0, 6.3); x.fill(); } };
    for (let i = 0; i < 90; i++) blob(rnd() * w, rnd() * h, 8 + rnd() * 26, rnd() < .5 ? '#c42a00' : '#8a1c00');
    for (let i = 0; i < 70; i++) blob(rnd() * w, rnd() * h, 3 + rnd() * 12, rnd() < .5 ? '#ff7a12' : '#ffb21a');
    for (let i = 0; i < 24; i++) blob(rnd() * w, rnd() * h, 2 + rnd() * 5, '#fff0a0');
  }, true);
  { const mat = new THREE.MeshBasicMaterial({ map: SC.lavaTex, side: THREE.DoubleSide, toneMapped: false });
    for (const z of HZ.lava) for (const s of [-1, 1]) { const m = new THREE.Mesh(lavaStripGeo(tr, z, s), mat); scene.add(m); freeze(m); } }

  if (TRACKW.group) return;      // the GLB track world has its own scenery

  // trees (one instanced mesh), scenery rocks and mountains
  const trunk = new THREE.CylinderGeometry(.25, .38, 2.2, 5); trunk.translate(0, 1.1, 0);
  const crown = new THREE.ConeGeometry(2.1, 6.2, 6); crown.translate(0, 5, 0);
  const paintGeo = (geo, hex) => { const n = geo.toNonIndexed(); const cl = new THREE.Color(hex), a = []; for (let i = 0; i < n.attributes.position.count; i++) a.push(cl.r, cl.g, cl.b); n.setAttribute('color', new THREE.Float32BufferAttribute(a, 3)); n.deleteAttribute('uv'); return n; };
  const treeGeo = mergeGeometries([paintGeo(trunk, '#6b4a2e'), paintGeo(crown, '#3f7a45')], false);
  const TREES = LOW_END ? 500 : isTouch ? 900 : 1500, treeMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const dummy = new THREE.Object3D(), tc = new THREE.Color(); let placed = 0, tries = 0;
  const treeData = [];   // [x, z, matrix, r, g, b]; sorted into map cells below so the renderer can skip the ones that are behind you or far away
  const W = TB.maxX - TB.minX + 1500, Hh = TB.maxZ - TB.minZ + 1500;
  while (placed < TREES && tries++ < 12000) {
    const x = TB.cx + (rnd() - .5) * W, z = TB.cz + (rnd() - .5) * Hh;
    let d = 1e9; for (let i = 0; i < N; i += 3) { const dd = (x - tr.x[i]) ** 2 + (z - tr.z[i]) ** 2; if (dd < d) d = dd; }
    if (d < (hw + 20) ** 2) continue;
    dummy.position.set(x, -.1, z); const s = .8 + rnd() * 1.1; dummy.scale.set(s, s * (.9 + rnd() * .5), s); dummy.rotation.set(0, rnd() * 6, 0); dummy.updateMatrix();
    treeData.push([x, z, dummy.matrix.clone(), .78 + rnd() * .22, .86 + rnd() * .14, .78 + rnd() * .22]); placed++;
  }
  // culling: one small InstancedMesh per 800 m cell (same trees, same positions as before). Three.js skips every cell outside the camera view,
  // and updateScenery() also hides cells beyond the fog distance, so with a short fog distance most of the forest costs nothing.
  { const CELL = 800, cells = new Map();
    for (const t of treeData) { const key = Math.floor(t[0] / CELL) + ',' + Math.floor(t[1] / CELL); let a = cells.get(key); if (!a) cells.set(key, a = []); a.push(t); }
    for (const list of cells.values()) {
      const im = new THREE.InstancedMesh(treeGeo, treeMat, list.length);
      list.forEach((t, i) => { im.setMatrixAt(i, t[2]); tc.setRGB(t[3], t[4], t[5]); im.setColorAt(i, tc); });
      im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
      im.computeBoundingSphere(); scene.add(im); freeze(im);   // frustumCulled stays on (default)
      SC.treeCells.push({ mesh: im, x: im.boundingSphere.center.x, z: im.boundingSphere.center.z, r: im.boundingSphere.radius });
    } }
  const MN = 34, mt = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 5), new THREE.MeshLambertMaterial({ color: '#8aa3a0' }), MN);
  for (let i = 0; i < MN; i++) {
    const a = i / MN * Math.PI * 2 + rnd() * .2, r = TB.r + 1150 + rnd() * 200, h = 160 + rnd() * 230, w = 230 + rnd() * 200;
    dummy.position.set(TB.cx + Math.cos(a) * r, h / 2 - 8, TB.cz + Math.sin(a) * r); dummy.scale.set(w, h, w); dummy.rotation.set(0, rnd() * 3, 0); dummy.updateMatrix(); mt.setMatrixAt(i, dummy.matrix);
  }
  mt.frustumCulled = false; scene.add(mt); freeze(mt);
}
const scenP = { x: 0, z: 0, lat: 0 };
function updateScenery(dt, t) {
  if (SC.padTex) SC.padTex.offset.y -= dt * 1.4;
  if (SC.lavaTex) { SC.lavaTex.offset.y -= dt * .05; SC.lavaTex.offset.x += dt * .01; }
  const p = scenP;
  // distance culling: a tree cell farther than the fog distance (or the low-end draw limit) is not drawn at all
  const drawFar = Math.min(scene.fog.far, LOW_END ? 1400 : 1e9), cx = camera.position.x, cz = camera.position.z;
  for (const tc of SC.treeCells) tc.mesh.visible = Math.hypot(tc.x - cx, tc.z - cz) - tc.r < drawFar;
  for (const o of SC.boulders) {
    boulderPos(o.b, track, t, p); o.mesh.position.set(p.x, o.b.r * .95, p.z);
    o.mesh.rotation.x = t * 2.2 * (o.b.w > 0 ? 1 : -1); o.mesh.rotation.z = Math.cos(o.b.w * t + o.b.ph) * 1.5;
  }
}

// ======================= smoke / dust / fire / nitro particles (pooled) =======================
const SMOKE_N = 260;
const smoke = { pos: new Float32Array(SMOKE_N * 3), col: new Float32Array(SMOKE_N * 4), vel: new Float32Array(SMOKE_N * 3), life: new Float32Array(SMOKE_N), rate: new Float32Array(SMOKE_N), a0: new Float32Array(SMOKE_N), head: 0, points: null, dirty: false };
function initSmoke() {
  const sc = document.createElement('canvas'); sc.width = sc.height = 64; const g = sc.getContext('2d'), rg = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(smoke.pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(smoke.col, 4));
  for (let i = 0; i < SMOKE_N; i++) smoke.pos[i * 3 + 1] = -50;
  smoke.points = new THREE.Points(geo, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(sc), size: 3.2, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true }));
  smoke.points.frustumCulled = false; scene.add(smoke.points);
}
// kind: 0 tyre smoke, 1 dust, 2 fire, 3 nitro flame
function emitSmoke(x, y, z, kind) {
  const i = smoke.head; smoke.head = (smoke.head + 1) % SMOKE_N;
  smoke.pos[i * 3] = x + (Math.random() - .5) * .6; smoke.pos[i * 3 + 1] = y; smoke.pos[i * 3 + 2] = z + (Math.random() - .5) * .6;
  smoke.vel[i * 3] = (Math.random() - .5) * 1.2; smoke.vel[i * 3 + 1] = .8 + Math.random() * .8; smoke.vel[i * 3 + 2] = (Math.random() - .5) * 1.2;
  smoke.life[i] = 1; smoke.rate[i] = 1.1; smoke.a0[i] = .5;
  const c = smoke.col;
  if (kind === 1) { c[i * 4] = .62; c[i * 4 + 1] = .55; c[i * 4 + 2] = .38; }
  else if (kind === 2) { c[i * 4] = 1; c[i * 4 + 1] = .45 + Math.random() * .3; c[i * 4 + 2] = .08; smoke.vel[i * 3 + 1] = 2.5 + Math.random() * 2; smoke.rate[i] = 1.6; smoke.a0[i] = .8; }
  else if (kind === 3) { c[i * 4] = .45; c[i * 4 + 1] = .75; c[i * 4 + 2] = 1; smoke.vel[i * 3 + 1] = .2; smoke.rate[i] = 3.2; smoke.a0[i] = .9; }
  else { c[i * 4] = .92; c[i * 4 + 1] = .93; c[i * 4 + 2] = .92; }
  c[i * 4 + 3] = smoke.a0[i];
}
function updateSmoke(dt) {
  let alive = 0;
  for (let i = 0; i < SMOKE_N; i++) {
    if (smoke.life[i] <= 0) continue;
    alive++; smoke.life[i] -= dt * smoke.rate[i];
    if (smoke.life[i] <= 0) { smoke.pos[i * 3 + 1] = -50; smoke.col[i * 4 + 3] = 0; continue; }
    smoke.pos[i * 3] += smoke.vel[i * 3] * dt; smoke.pos[i * 3 + 1] += smoke.vel[i * 3 + 1] * dt; smoke.pos[i * 3 + 2] += smoke.vel[i * 3 + 2] * dt;
    smoke.col[i * 4 + 3] = smoke.life[i] * smoke.a0[i];
  }
  smoke.points.visible = alive > 0 || smoke.dirty;   // nothing to draw or upload while no particles are alive
  smoke.dirty = alive > 0;
  if (smoke.points.visible) { smoke.points.geometry.attributes.position.needsUpdate = true; smoke.points.geometry.attributes.color.needsUpdate = true; }
}

// ======================= audio =======================
const audio = { buf: {}, loops: {}, ctx: null, on: settings.sound, o1: null, o2: null, lp: null, eg: null, sq: null, gr: null, wd: null, master: null, tick: 0, noise: null };
// ---- optional mp3 files in the sounds/ folder. Any file that is missing simply keeps the built-in beep/synth sound. ----
// (race1.mp3 and huarn.mp3 are intentionally NOT used.)
const SOUND_FILES = {
  engine: ['engine', 'engine_loop', 'engine1'], skid: ['skid', 'drift', 'tire', 'screech'],
  nitro: ['nitro', 'boost', 'whoosh'], count: ['count', 'countdown', 'beep'], go: ['go', 'start'], music: ['music', 'bgm', 'theme']
};
const SOUND_VOL = { engine: .55, skid: .5, crash: .9, nitro: .7, count: .8, go: .9, music: .16, rain: .35, thunder: .9, lava: .8, win: .9 };
async function loadSounds() {
  const ctx = audio.ctx;
  await Promise.all(Object.keys(SOUND_FILES).map(async key => {
    for (const name of SOUND_FILES[key]) {
      try {
        const r = await fetch('sounds/' + name + '.mp3'); if (!r.ok) continue;
        audio.buf[key] = await ctx.decodeAudioData(await r.arrayBuffer()); return;
      } catch (e) { /* not there / not decodable: try the next name, else keep the synth sound */ }
    }
  }));
}
function playBuf(key, vol, rate, delay) {
  const b = audio.buf[key]; if (!b || !audio.ctx || !audio.on) return false;
  const ctx = audio.ctx, src = ctx.createBufferSource(), g = ctx.createGain();
  src.buffer = b; if (rate) src.playbackRate.value = rate; g.gain.value = (vol == null ? 1 : vol) * (SOUND_VOL[key] || 1);
  src.connect(g); g.connect(audio.master); src.start(ctx.currentTime + (delay || 0)); return true;
}
// Loops are played as overlapping, cross-faded segments instead of the browser's native loop flag:
// the seam is inaudible (no "tick"), and a watchdog starts a new segment whenever none is playing, so a loop can never just stop.
function loopSeg(l) {
  const ctx = audio.ctx, b = audio.buf[l.key], src = ctx.createBufferSource(), sg = ctx.createGain(), t = ctx.currentTime;
  const fade = Math.min(.18, b.duration * .25), seg = { src, sg, pos: 0, fade, fadingOut: false, dead: false };
  src.buffer = b; src.playbackRate.value = l.rate; src.connect(sg); sg.connect(l.g);
  if (l.segs.length) { sg.gain.setValueAtTime(0, t); sg.gain.linearRampToValueAtTime(1, t + fade / l.rate); } else sg.gain.value = 1;
  src.onended = () => { seg.dead = true; try { src.disconnect(); sg.disconnect(); } catch (e) { /* ignore */ } };
  src.start(t); l.segs.push(seg); return seg;
}
function startLoop(key) {      // looping mp3 whose gain / pitch is driven every frame
  const b = audio.buf[key], ctx = audio.ctx; if (!b || !ctx) return null;
  if (audio.loops[key]) return audio.loops[key];
  const g = ctx.createGain(); g.gain.value = 0; g.connect(audio.master);
  const l = { key, g, segs: [], rate: 1, last: ctx.currentTime }; audio.loops[key] = l; loopSeg(l); return l;
}
function loopTick(l) {         // advance segment clocks, cross-fade into the next copy near the end, restart if nothing is left playing
  const ctx = audio.ctx, now = ctx.currentTime, dt = Math.max(0, now - l.last), b = audio.buf[l.key]; l.last = now;
  if (ctx.state !== 'running') return;
  l.segs = l.segs.filter(s => !s.dead);
  for (const s of l.segs) {
    s.pos += dt * l.rate;
    if (!s.fadingOut && s.pos >= b.duration - s.fade) {
      s.fadingOut = true; s.sg.gain.cancelScheduledValues(now); s.sg.gain.setValueAtTime(s.sg.gain.value, now); s.sg.gain.linearRampToValueAtTime(0, now + s.fade / l.rate);
      loopSeg(l);
    }
  }
  if (!l.segs.length || l.segs.every(s => s.fadingOut && s.pos >= b.duration)) loopSeg(l);   // watchdog
}
function loopSet(key, gain, rate) {
  const l = audio.loops[key]; if (!l) return; const t = audio.ctx.currentTime;
  if (rate) { l.rate = rate; for (const s of l.segs) if (!s.dead) s.src.playbackRate.setTargetAtTime(rate, t, .06); }
  l.g.gain.setTargetAtTime(audio.on ? gain * (SOUND_VOL[key] || 1) : 0, t, .08);
  loopTick(l);
}
function audioInit() {
  if (audio.ctx) { if (audio.ctx.state === 'suspended') audio.ctx.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = new AC(); audio.ctx = ctx;
    const master = ctx.createGain(); master.gain.value = audio.on ? .8 : 0; master.connect(ctx.destination); audio.master = master;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(); o1.type = 'sawtooth'; o2.type = 'square';
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    const eg = ctx.createGain(); eg.gain.value = 0; o1.connect(lp); o2.connect(lp); lp.connect(eg); eg.connect(master);   // (synthesised engine oscillators are never started: only the mp3 sounds play)
    const buf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    audio.noise = buf;
    const ns = ctx.createBufferSource(); ns.buffer = buf; ns.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 1.1; const sq = ctx.createGain(); sq.gain.value = 0;
    const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 480; const gr = ctx.createGain(); gr.gain.value = 0;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900; const wd = ctx.createGain(); wd.gain.value = 0;   // wind / rain rush
    ns.connect(bp); bp.connect(sq); sq.connect(master); ns.connect(lp2); lp2.connect(gr); gr.connect(master); ns.connect(hp); hp.connect(wd); wd.connect(master);   // (synth skid / wind noise is never started)
    Object.assign(audio, { o1, o2, lp, eg, sq, gr, wd });
    loadSounds();
  } catch (e) { audio.ctx = null; }
}
// count.mp3 is already the whole "3 - 2 - 1 - GO" sequence (about 3.9 s), so it is played ONCE when the countdown starts
// (playing it again on every number made several copies overlap). A restart stops the previous copy first.
function beep() { /* per-number beeps removed: see playCountdown() */ }
function stopCountdown() { try { if (audio.countSrc) audio.countSrc.stop(); } catch (e) { /* already finished */ } audio.countSrc = null; }
function playCountdown() {
  stopCountdown();
  const b = audio.buf.count; if (!b || !audio.ctx || !audio.on) return;
  const src = audio.ctx.createBufferSource(), g = audio.ctx.createGain();
  src.buffer = b; g.gain.value = SOUND_VOL.count; src.connect(g); g.connect(audio.master); src.start(); audio.countSrc = src;
}
function bump(strong) {
  return;   // impact sounds removed (kept sound: engine, countdown, soft music, nitro, tyre screech)
  if (!audio.ctx || !audio.on) return;
  if (playBuf('crash', strong ? 1 : .65)) return;
  const ctx = audio.ctx, o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
  o.type = strong ? 'sawtooth' : 'triangle'; o.frequency.setValueAtTime(strong ? 160 : 120, t); o.frequency.exponentialRampToValueAtTime(40, t + .25); g.gain.setValueAtTime(strong ? .7 : .5, t); g.gain.exponentialRampToValueAtTime(.0001, t + .3);
  o.connect(g); g.connect(audio.master); o.start(t); o.stop(t + .35);
}
function whoosh() {
  if (!audio.ctx || !audio.on) return;
  playBuf('nitro');   // mp3 only
}
function thunder(delay) {
  return;   // removed
  if (!audio.ctx || !audio.on || !audio.noise) return;
  if (playBuf('thunder', 1, 0, delay)) return;
  const ctx = audio.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime + delay;
  s.buffer = audio.noise; f.type = 'lowpass'; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(70, t + 1.6);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.9, t + .05); g.gain.exponentialRampToValueAtTime(.0001, t + 1.8);
  s.connect(f); f.connect(g); g.connect(audio.master); s.start(t); s.stop(t + 1.9);
}
const GEARS = [0, 12, 24, 36, 47, 58, 70, 84], NG = GEARS.length - 1;
function audioUpdate(c, active) {
  if (!audio.ctx || !audio.eg) return;
  if ((audio.tick++ % 3) !== 0) return;
  const t = audio.ctx.currentTime, sp = Math.abs(c.vf);
  let g = 1; while (g < NG && sp > GEARS[g] - 1.5) g++;
  const r = clamp((sp - GEARS[g - 1] * (g > 1 ? .8 : 0)) / (GEARS[g] - GEARS[g - 1] * (g > 1 ? .8 : 0)), 0.04, 1);
  const f = 48 + r * 92 + c.throttleLevel * 14 + (c.boosting ? 22 : 0);
  audio.o1.frequency.setTargetAtTime(f, t, .05); audio.o2.frequency.setTargetAtTime(f * .5, t, .05);
  audio.lp.frequency.setTargetAtTime(380 + r * 900 + c.throttleLevel * 500, t, .08);
  audio.eg.gain.setTargetAtTime(active ? .05 + .07 * c.throttleLevel + .03 * r : 0, t, .08);
  audio.sq.gain.setTargetAtTime(active && (c.drifting || (c.braking && c.vf > 22)) ? clamp(Math.abs(c.vl) * .012 + (c.braking ? .03 : 0), .02, .11) : 0, t, .06);
  // mp3 loops (take over from the synthesised engine / skid / rain when the file exists)
  if (audio.buf.engine) {
    startLoop('engine'); audio.eg.gain.setTargetAtTime(0, t, .05);
    loopSet('engine', active ? .55 + .45 * c.throttleLevel : 0, clamp(.55 + (sp / PARAMS.vmax) * 1.5 + (c.boosting ? .15 : 0), .5, 2.4));
  }
  if (audio.buf.skid) {
    startLoop('skid'); audio.sq.gain.setTargetAtTime(0, t, .05);
    loopSet('skid', active && (c.drifting || (c.braking && c.vf > 22)) ? clamp(Math.abs(c.vl) * .08 + (c.braking ? .4 : 0), .25, 1) : 0, 1);
  }
  if (audio.buf.music) { startLoop('music'); loopSet('music', active ? 1 : .6, 1); }
}
function audioKeepAlive() { for (const k in audio.loops) loopTick(audio.loops[k]); }
function audioSilence() { if (audio.eg) { const t = audio.ctx.currentTime; for (const n of ['eg', 'sq', 'gr', 'wd']) audio[n].gain.setTargetAtTime(0, t, .05); for (const k in audio.loops) if (k !== 'music') loopSet(k, 0); } }
function setSound(on) {
  audio.on = on; settings.sound = on; store.set('sound', on);
  if (audio.master) audio.master.gain.setTargetAtTime(on ? .8 : 0, audio.ctx.currentTime, .05);
  document.querySelectorAll('[data-sound]').forEach(b => { b.classList.toggle('off', !on); b.setAttribute('aria-pressed', String(on)); });
}

// ======================= game state: four cars, one model =======================
const racers = [makeCar('player'), makeCar('ai'), makeCar('ai'), makeCar('ai')];
const player = racers[0];
let vis = [];                    // visuals, same order as racers
let state = 'menu', paused = false, raceT = 0, simT = 0, countT = 0, lastCount = 4, bestTime = store.get('best2', 0), topSpeed = 0;
const finishList = [];
// showcase (start menu): turntable spin, slide-in when the car changes, and the camera's right vector
const show = { spin: 0, slide: 0, y: .08, rx: 1, rz: 0, drag: false, idle: 0 };
let stage = null;
const input = { throttle: 0, brake: 0, steer: 0, hand: false, nitro: false };
const keys = Object.create(null), touchState = { left: false, right: false, gas: false, brake: false, hand: false, nitro: false };
const COAST = { throttle: 0, brake: .35, steer: 0, hand: false, nitro: false };
// rival skill (top-speed scale), preferred lane, cornering grip, how well it reads hazards, how freely it uses nitro
const AI_CFG = [
  { skill: .97, lane: -2, latG: 30, aware: 1.0, nitroUse: .6 },
  { skill: .955, lane: 3, latG: 29, aware: .95, nitroUse: .55 },
  { skill: .94, lane: -4, latG: 29, aware: .85, nitroUse: .45 }
];
const AICTX = { H: HZ, t: 0, cars: racers };
const GRID = [[4, -5], [4, 5], [7, -5], [7, 5]];   // [samples behind the line, lane]
const PLAYER_SLOT = 2, RIVAL_SLOTS = [0, 1, 3];
const EVT = { pad: false, oil: false, hit: 0, burn: false };

function colorFor(i) { return COLORS[i].hex; }
let rivalShift = 0;                        // bumps every buildGrid(), so the rivals do not always wear the same paint
function rivalColors(playerColor, ids) {   // every rival gets a colour of its own, never the player's
  const used = new Set([playerColor]), out = [];
  for (const id of ids) {
    let c = (MODEL_BY[id].nat + rivalShift) % COLORS.length; while (used.has(c)) c = (c + 1) % COLORS.length;
    used.add(c); out.push(c);
  }
  return out;
}
function buildGrid() {          // (re)create the four cars: the one you picked + the others as rivals
  vis.forEach(disposeCar);
  if (vis.length) rivalShift = (rivalShift + 1) % COLORS.length;
  const mine = settings.car, rivals = MODEL_IDS.filter(id => id !== mine).slice(0, NCARS - 1), cols = rivalColors(settings.color, rivals);
  ensureModel(mine); rivals.forEach(ensureModel);
  player.name = 'YOU'; player.model = mine;
  vis = [spawnCar(mine, colorFor(settings.color), 'YOU', true)];
  rivals.forEach((id, k) => { const c = racers[k + 1]; c.name = RIVAL_NAMES[k] || ('Rival ' + (k + 1)); c.model = id; c.colorHex = colorFor(cols[k]); vis.push(spawnCar(id, c.colorHex, c.name, false)); });
  player.colorHex = colorFor(settings.color);
  resetRace();
}
function setCar(id) {
  settings.car = id; store.set('car2', id);
  buildGrid(); refreshMenu();
  renderer.compile(scene, camera);   // compile any new shaders now, behind the menu, instead of stuttering at the race start
}
function cycleCar(d) {
  const n = MODEL_IDS.length, i = (MODEL_IDS.indexOf(settings.car) + d + n) % n;
  setCar(MODEL_IDS[i]); show.slide = d * 9;
}
function setPlayerColor(i) {
  settings.color = i; store.set('color2', i);
  if (vis.length) buildGrid();
  document.querySelectorAll('.swatch').forEach((b, k) => { b.classList.toggle('sel', k === i); b.setAttribute('aria-pressed', String(k === i)); });
  setText($('colorName'), COLORS[i].name); $('menu').style.setProperty('--car', colorFor(i));
  if (stage) stage.userData.ring.color.set(colorFor(i));
}
function setTrack(id) {      // the other circuit is never loaded alongside this one: store the choice and restart the page with only that track
  if (id === TRACK_ID || !TRACK_INFO[id]) return;
  store.set('track', id); location.reload();
}
function resetRace() {
  const M = MODEL_BY[settings.car];
  racers.forEach((c, k) => {
    const slot = GRID[k === 0 ? PLAYER_SLOT : RIVAL_SLOTS[k - 1]];
    placeOnTrack(c, track, track.N - slot[0], slot[1]);
    c.lapsDone = 0; c.lapStart = 0; c.lapTimes = []; c.finished = false; c.finishTime = 0; c.throttleLevel = 0; c.stuck = 0; c.nitro = 100; c.laneNow = slot[1];
    if (k === 0) { c.vmaxScale = M.top; c.accScale = M.acc; } else { c.base = AI_CFG[k - 1].skill; c.vmaxScale = c.base; c.accScale = 1; }
  });
  finishList.length = 0; raceT = 0; simT = 0; topSpeed = 0; fovBoost = 0; shake = 0;
  vis.forEach(v => { v.prevVf = 0; });
  camH = player.h; tv.ready = false;
  vis.forEach((v, k) => applyVisuals(racers[k], v, 0.016));
}
function applyVisuals(c, v, dt) {
  const gy = groundY(c.prog), slp = slopeAt(c.prog); if (c.role === 'player') gyP = gy;
  const sink = c.fallT > 0 ? Math.min(2.6, (1.5 - c.fallT) * 2.2) : 0;
  const showing = state === 'menu' && c.role === 'player';
  if (showing) { v.root.position.set(c.x + show.rx * show.slide, gy - sink + show.y, c.z + show.rz * show.slide); v.root.rotation.y = c.h + show.spin; }
  else { v.root.position.set(c.x, gy - sink, c.z); v.root.rotation.y = c.h; }
  v.shadow.visible = sink === 0;
  if (v.shellLo) {   // LOD: simplified body when the car is far from the camera (never in the menu showcase)
    const far = state !== 'menu' && Math.hypot(c.x - camPos.x, c.z - camPos.z) > LOD_DIST;
    if (far !== v.lodFar) { v.lodFar = far; v.shellHi.visible = !far; v.shellLo.visible = far; }
  }
  v.tilt.visible = !(c.ghostT > 0) || (((performance.now() / 90) | 0) & 1) === 0;
  const acc = dt > 0 ? (c.vf - v.prevVf) / dt : 0; v.prevVf = c.vf; v.accel += (clamp(acc, -40, 25) - v.accel) * Math.min(1, dt * 6);
  const k = Math.min(1, dt * 8);
  v.pitch += (clamp(-v.accel * .0022, -.07, .06) - v.pitch) * k;
  v.roll += (clamp(-c.yaw * c.vf * .0022, -.08, .08) - v.roll) * k;
  v.tilt.rotation.x = v.pitch - slp; v.tilt.rotation.z = v.roll;
  v.wheelAngle += c.vf * dt / v.wr;
  const a = v.wheelAngle;
  for (const w of v.wheels) {
    w.spin.rotation.z = w.flipped ? a : -a;
    if (w.front) w.pivot.rotation.y = -c.steer * .45;
  }
  const brake = c.braking || (c.role === 'player' && state === 'finished');
  v.tail.emissiveIntensity = brake ? v.tailBrake : v.tailBase;
}

// ======================= input =======================
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'hand', ShiftLeft: 'nitro', ShiftRight: 'nitro', KeyN: 'nitro' };
addEventListener('keydown', e => {
  if (state === 'menu' && !$('menu').hidden) {
    if (e.code === 'ArrowLeft' || e.code === 'KeyA') { if (!e.repeat) cycleCar(-1); e.preventDefault(); return; }
    if (e.code === 'ArrowRight' || e.code === 'KeyD') { if (!e.repeat) cycleCar(1); e.preventDefault(); return; }
    if (e.code === 'Enter' && !(document.activeElement && document.activeElement.tagName === 'BUTTON')) { startCountdown(); return; }
  }
  if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'racing' || state === 'countdown') setPaused(!paused); return; }
  if (e.code === 'KeyR' && (state === 'racing')) { respawnPlayer(); return; }
  if (e.code === 'KeyC' && !e.repeat && (state === 'racing' || state === 'countdown' || state === 'finished')) { cycleCamera(1); return; }
  if (/^Digit[1-6]$/.test(e.code) && (state === 'racing' || state === 'countdown' || state === 'finished')) { setCamera(Number(e.code.slice(5)) - 1); return; }
  const k = KEYMAP[e.code]; if (!k) return;
  if (state === 'racing' || state === 'countdown' || state === 'finished') e.preventDefault();
  keys[k] = true;
});
addEventListener('keyup', e => { const k = KEYMAP[e.code]; if (k) keys[k] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; for (const k in touchState) touchState[k] = false; });
function readInput() {
  const gas = keys.up || touchState.gas || (settings.autoGas && isTouch), brake = keys.down || touchState.brake;
  input.throttle = gas ? 1 : 0; input.brake = brake ? 1 : 0;
  input.steer = ((keys.right || touchState.right) ? 1 : 0) - ((keys.left || touchState.left) ? 1 : 0);
  input.hand = !!(keys.hand || touchState.hand);
  input.nitro = !!(keys.nitro || touchState.nitro);
  return input;
}
function bindHold(id, key) {
  const el = $(id);
  const down = e => { e.preventDefault(); try { el.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } touchState[key] = true; el.classList.add('on'); };
  const up = () => { touchState[key] = false; el.classList.remove('on'); };
  el.addEventListener('pointerdown', down);
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) el.addEventListener(t, up);
  el.addEventListener('contextmenu', e => e.preventDefault());
}
function respawnPlayer() { respawn(player, track, 0); }

// ======================= game flow =======================
function showSheet(id) { for (const s of ['menu', 'pause', 'result']) $(s).hidden = s !== id; }
function setHud(on) { $('hud').hidden = !on; $('touch').hidden = !(on && isTouch); }
function setPaused(p) {
  paused = p; renderOnce = 2; $('pause').hidden = !p; if (p) { audioSilence(); for (const k in touchState) touchState[k] = false; }
  setText($('pauseBtnLabel'), p ? 'Resume' : 'Pause');
}
function toast(msg, ms) { const b = $('banner'); b.className = 'banner msg'; setText(b, msg); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); clearTimeout(toast.t); toast.t = setTimeout(() => { if (b._t === msg) { b.className = 'banner'; setText(b, ''); } }, ms || 1800); }
let wake = null;
async function wakeOn() { try { if ('wakeLock' in navigator && !wake && !document.hidden) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) { wake = null; } }
function wakeOff() { try { if (wake) wake.release(); } catch (e) { /* ignore */ } wake = null; }
function startCountdown() {
  lockLandscape(); wakeOn(); audioInit(); setSound(settings.sound); resetRace(); playCountdown();
  state = 'countdown'; countT = 0; lastCount = 4; camTransit = 1.3; paused = false;
  showSheet(''); setHud(true); document.activeElement && document.activeElement.blur && document.activeElement.blur();
  toast('Camera: ' + CAMS[settings.cam].name + '  (C to change)', 2600);
}
function goMenu() {
  wakeOff(); stopCountdown(); state = 'menu'; paused = false; resetRace(); camTransit = 1.6; setHud(false); showSheet('menu'); refreshMenu(); audioSilence();
}
function finishRace() {
  state = 'finished'; camTransit = 1.6;
  const ranked = rankCars(racers), place = ranked.indexOf(player) + 1, t = player.finishTime;
  if (!bestTime || t < bestTime) { bestTime = t; store.set('best2', t); }
  setText($('resTitle'), ordinal[place] + ' place' + (place === 1 ? ' — you win!' : place <= 3 ? ' — on the podium!' : ''));
  setText($('resTotal'), fmt(t)); setText($('resBest'), Math.round(topSpeed * 3.6) + ' km/h');
  const ul = $('resLaps'); ul.textContent = '';
  ranked.forEach((c, i) => {
    const li = document.createElement('li'), a = document.createElement('span'), b = document.createElement('b');
    a.textContent = (i + 1) + '.  ' + c.name; b.textContent = c.finished ? fmt(c.finishTime) : 'racing…'; b.dir = 'ltr';
    if (c === player) li.className = 'you';
    li.append(a, b); ul.appendChild(li);
  });
  setTimeout(() => { if (state === 'finished') { state = 'result'; wakeOff(); camTransit = 1.6; setHud(false); showSheet('result'); audioSilence(); } }, 1600);
  toast(place === 1 ? 'You won!' : 'Race complete!', 1500);
}

function simStep(dt) {
  if (state === 'countdown') {
    countT += dt; const n = Math.ceil(3 - countT + 1e-6);
    if (countT >= 3) { state = 'racing'; raceT = 0; toast('GO!', 900); beep(880, .5); }
    else if (n !== lastCount) { lastCount = n; const b = $('banner'); b.className = 'banner count'; setText(b, String(n)); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); beep(440, .25); }
    return;
  }
  raceT += dt; simT += dt; AICTX.t = simT;
  const pin = state === 'racing' ? readInput() : COAST;
  for (let k = 1; k < NCARS; k++) {      // rubber band: leaders ease off, stragglers push
    const c = racers[k], gap = c.prog - player.prog;
    c.vmaxScale += ((c.base * (1 - clamp(gap / 60, -1, 1) * .05)) - c.vmaxScale) * Math.min(1, dt * .8);
  }
  const wasNitro = player.nitroOn;
  stepCar(player, pin, dt, track, ENV);
  if (player.wallHit > 0) shake = Math.max(shake, Math.min(.45, player.wallHit * 1.3));   // thud on the stone wall
  for (let k = 1; k < NCARS; k++) stepCar(racers[k], aiControl(racers[k], track, dt, AI_CFG[k - 1], AICTX), dt, track, ENV);
  let pHit = false;
  for (let a = 0; a < NCARS; a++) for (let b = a + 1; b < NCARS; b++) if (collide(racers[a], racers[b]) && a === 0) pHit = true;
  if (pHit) { if (!simStep.hit) { bump(false); shake = Math.max(shake, .25); } simStep.hit = true; } else simStep.hit = false;
  for (let k = 0; k < NCARS; k++) {
    const c = racers[k];
    updateTrackState(c, track, false);
    applyHazards(c, HZ, track, simT, EVT);
    if (k === 0) {
      if (EVT.pad) { toast('BOOST!', 900); fovBoost = 1; shake = Math.max(shake, .3); }
      if (EVT.oil) toast('Oil slick!', 1000);
      if (EVT.hit > 2) { bump(true); shake = Math.max(shake, Math.min(1, EVT.hit / 40)); }
      if (EVT.burn) { toast('Lava! Back on the road…', 1600); shake = 1; }
      if (!wasNitro && c.nitroOn) whoosh();
      topSpeed = Math.max(topSpeed, c.speed);
    }
    if (updateLaps(c, track, raceT) && !c.finished && c.lapsDone >= LAPS) {
      c.finished = true; c.finishTime = raceT; finishList.push(c);
      if (c === player) finishRace();
      else if (!player.finished && finishList.length === 1) toast(c.name + ' finished first!', 2200);
    }
  }
}
simStep.hit = false;

// ======================= cameras =======================
const CAMS = [{ id: 'chase', name: 'Chase' }, { id: 'hood', name: 'Hood' }, { id: 'bumper', name: 'Bumper' }, { id: 'high', name: 'High chase' }, { id: 'drone', name: 'Drone' }, { id: 'tv', name: 'TV broadcast' }];
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tPos = new THREE.Vector3(), tLook = new THREE.Vector3();
let camH = 0, camTransit = 0, fovNow = 60, fovBoost = 0, shake = 0, camCut = false;
const tv = { pos: new THREE.Vector3(), idx: 0, side: 1, ready: false };
function setCamera(i) {
  settings.cam = ((i % CAMS.length) + CAMS.length) % CAMS.length; store.set('cam', settings.cam);
  camCut = true; tv.ready = false; toast('Camera: ' + CAMS[settings.cam].name, 1200);
  const btn = $('btnCam'); if (btn) btn.setAttribute('aria-label', 'Camera: ' + CAMS[settings.cam].name);
}
function cycleCamera(d) { setCamera(settings.cam + d); }
function updateCamera(dt, t) {
  const c = player, orbit = state === 'menu' || state === 'result', mode = CAMS[settings.cam].id;
  const sf = clamp(c.speed / PARAMS.vmax, 0, 1);
  let tf = 60, hard = false;
  if (state === 'menu') {      // showcase: fixed 3/4 view, the car turns on its platform
    const R = clamp(6.6 / Math.max(camera.aspect, .01), 6.5, 15), a = .62;
    tPos.set(c.x + Math.sin(c.h + a) * R, 1.6 + R * .13, c.z + Math.cos(c.h + a) * R); tLook.set(c.x, .75 - R * .09, c.z);
    const fx = tLook.x - tPos.x, fz = tLook.z - tPos.z, fl = Math.hypot(fx, fz) || 1; show.rx = -fz / fl; show.rz = fx / fl;
  } else if (orbit) {
    const a = t * .22 + .9; tPos.set(c.x + Math.sin(c.h + a) * 9.5, 2.5 + Math.sin(t * .3) * .3, c.z + Math.cos(c.h + a) * 9.5); tLook.set(c.x, .9, c.z);
  } else {
    const fast = mode === 'hood' || mode === 'bumper';
    camH += angDiff(c.h, camH) * (1 - Math.exp(-dt * (fast ? 22 : 6)));
    const fx = Math.sin(camH), fz = Math.cos(camH), cam = MODEL_BY[settings.car].cam;
    if (mode === 'chase') {
      const dist = 4.6 + sf * 1.4 + fovBoost * .7;   // v32: closer still (was 6.2 / 2.0 / 1.0)
      tPos.set(c.x - fx * dist, 2.05 + sf * .4, c.z - fz * dist); tLook.set(c.x + fx * 6 - fz * c.steer * 1.2, 1.3, c.z + fz * 6 + fx * c.steer * 1.2); tf = 60 + sf * 18;
    } else if (mode === 'high') {
      const dist = 15 + sf * 4.5; tPos.set(c.x - fx * dist, 8 + sf * 3, c.z - fz * dist); tLook.set(c.x + fx * 12, 1.0, c.z + fz * 12); tf = 58 + sf * 18;
    } else if (mode === 'hood') {
      tPos.set(c.x + fx * cam.hood[0], cam.hood[1], c.z + fz * cam.hood[0]); tLook.set(c.x + fx * 40, cam.hood[1] - .35, c.z + fz * 40); tf = 72 + sf * 10; hard = true;
    } else if (mode === 'bumper') {
      tPos.set(c.x + fx * cam.bumper[0], cam.bumper[1], c.z + fz * cam.bumper[0]); tLook.set(c.x + fx * 40, cam.bumper[1] + .2, c.z + fz * 40); tf = 82 + sf * 10; hard = true;
    } else if (mode === 'drone') {
      tPos.set(c.x - fx * 12, 48 + sf * 28, c.z - fz * 12); tLook.set(c.x + fx * 14, 0, c.z + fz * 14); tf = 50 + sf * 12;
    } else {      // TV: a fixed trackside camera that is re-planted further down the road whenever the car has passed it
      const N = track.N;
      let need = !tv.ready;
      if (tv.ready && (Math.hypot(c.x - tv.pos.x, c.z - tv.pos.z) > 200 || wrapI(c.idx - tv.idx, N) > 14)) need = true;
      if (need) {
        const ahead = clamp(Math.round((45 + c.speed * 1.5) / track.ds), 18, 90), idx = (c.idx + ahead) % N; tv.side = -tv.side; tv.idx = idx; tv.ready = true;
        tv.pos.set(track.x[idx] + track.nx[idx] * tv.side * (track.hw[idx] + 11), trkY[idx] + 5.5 + Math.random() * 3, track.z[idx] + track.nz[idx] * tv.side * (track.hw[idx] + 11)); camCut = true;
      }
      tPos.copy(tv.pos); tLook.set(c.x + c.vx * .12, 1.1, c.z + c.vz * .12); tf = 36; hard = true;
    }
  }
  if (orbit || mode !== 'tv') { tPos.y += gyP; tLook.y += gyP; }
  if (camCut) { camPos.copy(tPos); camLook.copy(tPos).lerp(tLook, 1); camTransit = 0; camCut = false; }
  else if (camTransit > 0 && !hard) { camTransit -= dt; const k = 1 - Math.exp(-dt * 4.5); camPos.lerp(tPos, k); camLook.lerp(tLook, k); }
  else { camPos.copy(tPos); if (mode === 'tv' && !orbit) camLook.lerp(tLook, 1 - Math.exp(-dt * 14)); else camLook.copy(tLook); }
  // speed shake (grows with speed, nitro and impacts)
  shake *= Math.exp(-dt * 5);
  const sh = shake * .5 + (sf > .72 ? (sf - .72) * .09 : 0) + fovBoost * .05;
  camera.position.copy(camPos); camera.lookAt(camLook);
  if (sh > .002 && !orbit) camera.position.set(camPos.x + (Math.random() - .5) * sh, camPos.y + (Math.random() - .5) * sh, camPos.z + (Math.random() - .5) * sh);
  fovBoost += ((c.boosting && !orbit ? 1 : 0) - fovBoost) * Math.min(1, dt * 3);
  const target = (state === 'menu' ? 40 : orbit ? 60 : tf) + fovBoost * 12;
  fovNow += (target - fovNow) * Math.min(1, dt * 4);
  if (Math.abs(camera.fov - fovNow) > .05) { camera.fov = fovNow; camera.updateProjectionMatrix(); }
}

// ======================= speed lines / lightning overlay =======================
const fxc = { cv: null, g: null, w: 0, h: 0, clear: true };
function initFx() { fxc.cv = $('fx'); fxc.g = fxc.cv.getContext('2d'); resizeFx(); }
function resizeFx() { if (!fxc.cv) return; const vs = vpSize(); fxc.w = fxc.cv.width = Math.max(2, Math.ceil(vs[0] / 2)); fxc.h = fxc.cv.height = Math.max(2, Math.ceil(vs[1] / 2)); fxc.clear = true; }
function drawFx(t, on) {
  const g = fxc.g; if (!g) return;
  const sf = clamp(player.speed / PARAMS.vmax, 0, 1.3), inten = on ? clamp((sf - .6) / .4, 0, 1) * .8 + fovBoost * .55 : 0, fl = 0;
  if (inten < .02 && fl < .01) { if (!fxc.clear) { g.clearRect(0, 0, fxc.w, fxc.h); fxc.clear = true; } return; }
  fxc.clear = false; g.clearRect(0, 0, fxc.w, fxc.h);
  const w = fxc.w, h = fxc.h, cx = w / 2, cy = h * .47, R = Math.hypot(w, h) / 2, boost = player.boosting;
  if (inten >= .02) {
    g.lineWidth = 1.6; g.lineCap = 'round';
    for (let i = 0; i < 30; i++) {
      const ang = i * 2.399963 + Math.floor(t * 3 + i) * .13, ph = (t * (1.1 + inten * .9) + i * .37) % 1, r1 = R * (.34 + .66 * ph * ph), r2 = r1 + R * (.04 + .3 * inten * ph);
      const ca = Math.cos(ang), sa = Math.sin(ang), al = inten * (.15 + .5 * ph) * .8;
      g.strokeStyle = boost ? 'rgba(130,210,255,' + al.toFixed(3) + ')' : 'rgba(255,255,255,' + al.toFixed(3) + ')';
      g.beginPath(); g.moveTo(cx + ca * r1, cy + sa * r1); g.lineTo(cx + ca * r2, cy + sa * r2); g.stroke();
    }
    if (boost) { const gr = g.createRadialGradient(cx, cy, R * .4, cx, cy, R); gr.addColorStop(0, 'rgba(80,170,255,0)'); gr.addColorStop(1, 'rgba(80,170,255,' + (.3 * fovBoost).toFixed(3) + ')'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  }
  if (fl > .01) { g.fillStyle = 'rgba(225,235,255,' + Math.min(.55, fl * .5).toFixed(3) + ')'; g.fillRect(0, 0, w, h); }
}

// ======================= HUD =======================
const el = {};
const miniBase = document.createElement('canvas');
let miniMap = null;
function initHud() {
  for (const id of ['spd', 'gear', 'posPill', 'wrong', 'nitroFill', 'nitroBtnFill', 'tNitro']) el[id] = $(id);
  document.documentElement.classList.toggle('is-touch', isTouch);
  el.rpm = [...document.querySelectorAll('#rpm i')]; el.mini = $('mini'); el.mctx = el.mini.getContext('2d');
  const W = el.mini.width, H = el.mini.height, pad = 10, s = Math.min((W - pad * 2) / (TB.maxX - TB.minX), (H - pad * 2) / (TB.maxZ - TB.minZ));
  const ox = (W - (TB.maxX - TB.minX) * s) / 2, oz = (H - (TB.maxZ - TB.minZ) * s) / 2, minX = TB.minX, minZ = TB.minZ;
  miniMap = { s, ox, oz, minX, minZ };
  miniBase.width = W; miniBase.height = H; const g = miniBase.getContext('2d');
  g.lineJoin = 'round'; g.lineCap = 'round';
  const P = k => [ox + (track.x[k] - minX) * s, oz + (track.z[k] - minZ) * s];
  const path = () => { g.beginPath(); for (let i = 0; i <= track.N; i += 3) { const k = i % track.N, p = P(k); i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } g.closePath(); };
  g.strokeStyle = 'rgba(29,53,36,.28)'; g.lineWidth = 8; path(); g.stroke();
  g.strokeStyle = '#f7faf4'; g.lineWidth = 4.5; path(); g.stroke();
  g.strokeStyle = '#ff6a1a'; g.lineWidth = 4.5;      // lava zones in orange
  for (const z of HZ.lava) { g.beginPath(); const n = (z.i1 - z.i0 + track.N) % track.N; for (let k = 0; k <= n; k += 2) { const p = P((z.i0 + k) % track.N); k ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]); } g.stroke(); }
  g.fillStyle = '#1d3524'; const p0 = P(0); g.fillRect(p0[0] - 1.5, p0[1] - 4, 3, 8);
}
let hudTick = 0;
function updateHud() {
  const c = player;
  setText(el.spd, String(Math.round(c.speed * 3.6)));
  const sp = Math.abs(c.vf); let g = 1; while (g < NG && sp > GEARS[g] - 1.5) g++;
  const lo = g > 1 ? GEARS[g - 1] * .8 : 0, r = clamp((sp - lo) / (GEARS[g] - lo), 0, 1), on = Math.round(r * el.rpm.length);
  setText(el.gear, c.vf < -0.5 ? 'R' : String(g));
  if (el.rpm._on !== on) { el.rpm._on = on; el.rpm.forEach((s, i) => s.classList.toggle('on', i < on)); el.rpm.forEach((s, i) => s.classList.toggle('hot', i >= 9)); }
  const ranked = rankCars(racers), place = ranked.indexOf(player) + 1;
  setText(el.posPill, 'Position ' + place + '/' + NCARS + (LAPS > 1 ? '  ·  Lap ' + Math.min(player.lapsDone + 1, LAPS) + '/' + LAPS : '')); el.posPill.classList.toggle('lead', place === 1);
  const nit = Math.round(c.nitro), nOn = !!(c.nitroOn || c.boosting);   // only touch the DOM when a value actually changed
  if (el._nit !== nit) { el._nit = nit; el.nitroFill.style.width = nit + '%'; el.nitroBtnFill.style.height = nit + '%'; }
  if (el._nOn !== nOn) { el._nOn = nOn; el.nitroFill.parentNode.classList.toggle('on', nOn); el.tNitro.classList.toggle('boost', nOn); }
  const wrong = state === 'racing' && c.speed > 5 && (c.vx * track.tx[c.idx] + c.vz * track.tz[c.idx]) < -3;
  if (el._wr !== wrong) { el._wr = wrong; el.wrong.hidden = !wrong; }
  if ((hudTick++ % 3) === 0) {   // minimap at 20 fps is plenty
    const g2 = el.mctx, m = miniMap; g2.clearRect(0, 0, el.mini.width, el.mini.height); g2.drawImage(miniBase, 0, 0);
    const dot = (cc, col, rad, ring) => { g2.beginPath(); g2.arc(m.ox + (cc.x - m.minX) * m.s, m.oz + (cc.z - m.minZ) * m.s, rad, 0, 6.2832); g2.fillStyle = col; g2.fill(); g2.lineWidth = ring ? 2 : 1.2; g2.strokeStyle = ring ? '#ffd23a' : '#fff'; g2.stroke(); };
    for (let k = 1; k < NCARS; k++) dot(racers[k], racers[k].colorHex, 3, false);
    dot(player, player.colorHex, 4.6, true);
  }
}

// ======================= showcase platform (start menu) =======================
function buildStage() {
  stage = new THREE.Group(); stage.visible = false;
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.85, .16, 72), new THREE.MeshBasicMaterial({ color: '#171a20' }));
  const rim = new THREE.Mesh(new THREE.TorusGeometry(3.72, .05, 8, 96), new THREE.MeshBasicMaterial({ color: '#c91420' })); rim.rotation.x = Math.PI / 2; rim.position.y = .08;
  const tickMat = new THREE.MeshBasicMaterial({ color: '#4a5260' });
  for (let i = 0; i < 48; i++) {   // marks around the edge so the turning platform is visible
    const t = new THREE.Mesh(new THREE.BoxGeometry(.09, .01, i % 4 ? .32 : .6), tickMat), a = i / 48 * Math.PI * 2;
    t.position.set(Math.sin(a) * 3.3, .085, Math.cos(a) * 3.3); t.rotation.y = a; stage.add(t);
  }
  stage.add(disc, rim); stage.userData.ring = rim.material; scene.add(stage);
}

// ======================= menu =======================
function refreshMenu() {
  setText($('menuBest'), (bestTime ? 'Best time  ' + fmt(bestTime) : 'No race record yet') + '  ·  v33');
  const m = MODEL_BY[settings.car], idx = MODEL_IDS.indexOf(settings.car);
  setText($('carName'), m.name); setText($('carTag'), m.tag); setText($('carCount'), (idx + 1) + ' / ' + MODEL_LIST.length);
  const rel = k => { const vs = MODEL_LIST.map(x => x[k]), lo = Math.min(...vs), hi = Math.max(...vs); if (hi - lo < 1e-6) return 92; return Math.round(40 + (m[k] - lo) / (hi - lo) * 60); };
  $('barTop').style.width = rel('top') + '%'; $('barAcc').style.width = rel('acc') + '%';
  document.querySelectorAll('.cardot').forEach((b, k) => { b.classList.toggle('sel', k === idx); b.setAttribute('aria-current', String(k === idx)); });
  document.querySelectorAll('.trkopt').forEach(b => { const on = b.dataset.track === TRACK_ID; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', String(on)); });
  const ag = $('autoGas'); if (ag) { ag.classList.toggle('sel', settings.autoGas); ag.setAttribute('aria-pressed', String(settings.autoGas)); }
}
function initMenu() {
  const wrap = $('swatches');
  COLORS.forEach((c, i) => {
    const b = document.createElement('button'); b.className = 'swatch'; b.style.setProperty('--c', c.hex); b.setAttribute('aria-label', c.name); b.type = 'button';
    b.addEventListener('click', () => setPlayerColor(i)); wrap.appendChild(b);
  });
  const dots = $('carDots');
  MODEL_LIST.forEach((m, k) => {
    const b = document.createElement('button'); b.className = 'cardot'; b.type = 'button'; b.setAttribute('aria-label', m.name);
    b.addEventListener('click', () => { const cur = MODEL_IDS.indexOf(settings.car); if (k !== cur) { setCar(m.id); show.slide = k > cur ? 9 : -9; } }); dots.appendChild(b);
  });
  for (const id of ['carPrev', 'carNext', 'carDots', 'carCount']) { const e = $(id); if (e) e.style.display = ''; }
  $('carPrev').addEventListener('click', () => cycleCar(-1));
  $('carNext').addEventListener('click', () => cycleCar(1));
  const stg = $('menuStage'); let dragX = 0, dragId = null;      // drag the showcase to turn the car by hand
  stg.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; dragId = e.pointerId; dragX = rot.on ? e.clientY : e.clientX; show.drag = true; try { stg.setPointerCapture(e.pointerId); } catch (x) { /* ignore */ } });
  stg.addEventListener('pointermove', e => { if (e.pointerId !== dragId) return; show.spin += ((rot.on ? e.clientY : e.clientX) - dragX) * .012; dragX = rot.on ? e.clientY : e.clientX; });
  for (const t of ['pointerup', 'pointercancel']) stg.addEventListener(t, e => { if (e.pointerId === dragId) { dragId = null; show.drag = false; } });
  document.querySelectorAll('.trkopt').forEach(b => b.addEventListener('click', () => setTrack(b.dataset.track)));
  if (isTouch) { $('autoGas').hidden = false; $('autoGas').addEventListener('click', () => { settings.autoGas = !settings.autoGas; store.set('autoGas', settings.autoGas); refreshMenu(); }); }
  const early = () => { audioInit(); removeEventListener('pointerdown', early); removeEventListener('keydown', early); };
  addEventListener('pointerdown', early); addEventListener('keydown', early);   // sound files load while you pick a car
  $('btnStart').addEventListener('click', startCountdown);
  $('btnAgain').addEventListener('click', startCountdown);
  $('btnMenu').addEventListener('click', goMenu);
  $('btnPause').addEventListener('click', () => { if (state === 'racing' || state === 'countdown') setPaused(!paused); });
  $('btnResume').addEventListener('click', () => setPaused(false));
  $('btnRestart').addEventListener('click', () => { setPaused(false); startCountdown(); });
  $('btnQuit').addEventListener('click', () => { setPaused(false); goMenu(); });
  $('btnRespawn').addEventListener('click', () => { if (state === 'racing') respawnPlayer(); });
  $('btnCam').addEventListener('click', () => cycleCamera(1));
  document.querySelectorAll('[data-sound]').forEach(b => b.addEventListener('click', () => { audioInit(); setSound(!audio.on); }));
  bindHold('tLeft', 'left'); bindHold('tRight', 'right'); bindHold('tGas', 'gas'); bindHold('tBrake', 'brake'); bindHold('tHand', 'hand'); bindHold('tNitro', 'nitro');
  document.addEventListener('visibilitychange', () => { if (document.hidden && (state === 'racing' || state === 'countdown')) setPaused(true); else if (!document.hidden && (state === 'racing' || state === 'countdown' || state === 'finished')) wakeOn(); });
  addEventListener('contextmenu', e => { if (isTouch) e.preventDefault(); });
}

// ======================= main loop =======================
// ---- always landscape: lock the orientation on the first tap (Android Chrome / installed app); where that is refused (iPhone, some browsers)
//      and the phone is upright, the whole page is rotated 90 degrees with CSS instead ----
const rot = { on: document.documentElement.classList.contains('rot90') };
function vpSize() { return rot.on ? [innerHeight, innerWidth] : [innerWidth, innerHeight]; }
function applyRot() {
  const on = isTouch && innerHeight > innerWidth * 1.05;
  const st = document.documentElement.style; st.setProperty('--rw', innerWidth + 'px'); st.setProperty('--rh', innerHeight + 'px');
  if (on !== rot.on) { rot.on = on; document.documentElement.classList.toggle('rot90', on); resize(); }
}
async function lockLandscape() {
  if (!isTouch) return;
  try { if (!document.fullscreenElement && document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); } catch (e) { /* not allowed: fine */ }
  try { await screen.orientation.lock('landscape'); } catch (e) { /* not supported: the CSS rotation covers it */ }
  setTimeout(applyRot, 250);
}
function resize() {
  const [w, h] = vpSize(); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  document.documentElement.classList.toggle('portrait', h > w); resizeFx(); renderOnce = 2;
}
addEventListener('resize', () => { applyRot(); resize(); });
addEventListener('orientationchange', () => setTimeout(() => { applyRot(); resize(); }, 150));
let renderOnce = 2, menuFlip = false;   // paused: the picture is frozen, so only a couple of frames are drawn (after pausing / resizing)
let last = performance.now(), acc = 0, ftAcc = 0, ftN = 0, lastAdapt = performance.now(), warm = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let raw = (now - last) / 1000; last = now; if (raw > .25) raw = .25; if (raw <= 0) return;
  // adaptive resolution: drop pixel ratio as soon as the game falls under ~50 fps, never raise past the level that failed.
  // Only frames that actually render count (the menu skips rendering, so its fast frames would hide a slow race).
  if (state !== 'menu' && raw < .1) { ftAcc += raw * 1000; ftN++; }
  if (now - lastAdapt > 1000) {
    lastAdapt = now;
    if (ftN >= 20 && ++warm > 1) {   // the first window after a (re)start holds shader-compile hitches, so it is ignored
      const avg = ftAcc / ftN;
      if (avg > 20.5 && dpr > DPR_MIN) { dprCeil = Math.max(DPR_MIN, dpr - .1); dpr = Math.max(DPR_MIN, dpr - (avg > 28 ? .2 : .1)); renderer.setPixelRatio(dpr); resize(); warm = 0; }
      else if (avg < 17.6 && dpr < dprCeil) { dpr = Math.min(dprCeil, dpr + .1); renderer.setPixelRatio(dpr); resize(); }
    }
    ftAcc = 0; ftN = 0;
  }
  const running = (state === 'racing' || state === 'countdown' || state === 'finished') && !paused;
  if (running) {
    acc += raw; let n = 0;
    while (acc >= 1 / 60 && n < 5) { simStep(1 / 60); acc -= 1 / 60; n++; }
    if (n === 5) acc = 0;
  }
  const wantPR = state === 'menu' ? Math.max(dpr, Math.min(window.devicePixelRatio || 1, 2)) : dpr;   // sharper picture for the showcase
  if (wantPR !== renderer.getPixelRatio()) { renderer.setPixelRatio(wantPR); resize(); }
  const dtv = paused ? 0 : raw;
  if (state === 'menu') { if (!show.drag) show.spin += raw * .22; show.slide *= Math.exp(-raw * 6.5); }
  for (let k = 0; k < NCARS; k++) applyVisuals(racers[k], vis[k], dtv || .0001);
  if (running) {
    for (let k = 0; k < NCARS; k++) {
      const c = racers[k];
      if (Math.abs(c.x - camPos.x) + Math.abs(c.z - camPos.z) > 160) continue;   // no particles for cars far from the camera
      const gyc = groundY(c.prog), fx = Math.sin(c.h), fz = Math.cos(c.h), rx = -fz, rz = fx;
      if ((c.drifting || (c.braking && c.vf > 25) || (!c.onRoad && c.speed > 8)) && Math.random() < .4) {
        const kind = c.onRoad ? 0 : 1;
        emitSmoke(c.x - fx * 1.5 + rx * 0.85, gyc + .3, c.z - fz * 1.5 + rz * 0.85, kind);
        emitSmoke(c.x - fx * 1.5 - rx * 0.85, gyc + .3, c.z - fz * 1.5 - rz * 0.85, kind);
      }
      if (c.boosting && Math.random() < .8) { emitSmoke(c.x - fx * 2.5 + rx * .45, gyc + .5, c.z - fz * 2.5 + rz * .45, 3); emitSmoke(c.x - fx * 2.5 - rx * .45, gyc + .5, c.z - fz * 2.5 - rz * .45, 3); }
      if (c.fallT > 0 && Math.random() < .8) emitSmoke(c.x, gyc + .2, c.z, 2);
    }
    updateHud(); audioUpdate(player, true);
  }
  if (audio.ctx && (now | 0) % 4 === 0) audioKeepAlive();
  if (paused) { if (renderOnce <= 0) return; renderOnce--; }
  updateCamera(raw, now / 1000);
  const inMenu = state === 'menu';   // the menu is a live showcase: the rivals step out of the picture and the platform appears
  if (stage) { stage.visible = inMenu; if (inMenu) { stage.position.set(player.x, gyP, player.z); stage.rotation.y = show.spin; } }
  const carFar = scene.fog.far + 80;   // a rival farther away than the fog is not drawn (it would be a fog-coloured speck)
  for (let k = 1; k < NCARS; k++) vis[k].root.visible = !inMenu && Math.hypot(racers[k].x - camPos.x, racers[k].z - camPos.z) < carFar;
  if (inMenu && (menuFlip = !menuFlip)) return;   // the showcase is drawn at 30 fps: half the battery, same look
  updateSmoke(dtv); updateScenery(dtv, simT); drawFx(now / 1000, running);
  renderer.render(scene, camera);
}

// ======================= boot (with a real progress bar) =======================
const bootUi = { fill: $('bootFill'), car: $('bootCar'), pct: $('bootPct'), msg: $('bootMsg'), root: $('boot') };
function bootStep(p, msg) {
  bootUi.fill.style.animation = 'none'; bootUi.fill.style.width = p + '%'; bootUi.car.style.left = p + '%';
  bootUi.pct.textContent = Math.round(p) + '%'; bootUi.msg.textContent = msg;
  return new Promise(res => { let done = false; const f = () => { if (!done) { done = true; res(); } }; requestAnimationFrame(() => setTimeout(f, 0)); setTimeout(f, 120); });
}
async function boot() {
  await bootStep(4, 'Loading the track…'); await loadTrackWorld();
  await bootStep(7, 'Loading the car models…'); await loadCarGLBs((i, n, id) => bootStep(7 + i * 2, 'Loading car ' + (i + 1) + ' of ' + n + '…'));
  await bootStep(10, 'Building your car…');
  buildShadowAssets(); ensureModel(settings.car);   // heavy part: runs once, then each car is cached and cloned
  const rest = MODEL_IDS.filter(id => id !== settings.car);
  for (let i = 0; i < rest.length; i++) { await bootStep(18 + i * 16, 'Building rival ' + (i + 1) + ' of ' + rest.length + '…'); ensureModel(rest[i]); }
  await bootStep(74, 'Laying the track and hazards…');
  buildTrackVisuals(track); buildStage(); initSmoke(); initFx();
  await bootStep(86, 'Painting and fuelling up…');
  initMenu(); initHud(); applyRot(); resize(); applyWeather();
  buildGrid(); camPos.set(player.x + 8, 3, player.z - 8); camLook.set(player.x, .9, player.z);
  setPlayerColor(settings.color); setSound(settings.sound); refreshMenu(); setCamera(settings.cam); toast.t = 0; $('banner').className = 'banner'; setText($('banner'), '');
  await bootStep(94, 'Warming up the engines…');
  renderer.compile(scene, camera);
  await bootStep(100, 'Ready to race');
  window.__tdBooted = true;
  if (location.hash === '#debug') window.__td = { scene, camera, renderer, racers, track, HZ, get vis() { return vis; }, get state() { return state; }, setCar, startCountdown, setCamera, setTrack, simStep, settings, frameNow: frame, audio };
  showSheet('menu');
  bootUi.root.classList.add('done');
  setTimeout(() => { bootUi.root.remove(); document.documentElement.style.setProperty('--logo', 'none'); }, 500);
  requestAnimationFrame(t => { last = t; frame(t); });
}
boot().catch(err => {
  console.error(err); bootUi.root.hidden = false; bootUi.root.classList.add('err');
  bootUi.msg.textContent = 'The game could not start. Please reload the page. (' + (err && err.message ? err.message : err) + ')';
});
