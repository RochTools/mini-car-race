import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
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
const ordinal = ['', '1st', '2nd', '3rd', '4th', '5th'];
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
// Five cars. top / acc: small performance edge for the car YOU drive (rivals use their own skill level).
// nat: the colour a rival wears when it is free. cam: [z, y] of the hood and bumper cameras (metres, car frame).
const MODEL_LIST = [
  { id: 'revuelto', name: 'Revuelto V12', tag: 'V12 hypercar', top: 1.04, acc: 1.08, rival: 'Tufan', nat: 5, cam: { hood: [1.28, 1.12], bumper: [2.30, .50] } },
  { id: 'sport', name: 'Red Sports GT', tag: 'Wedge coupe', top: 1.02, acc: 1.05, rival: 'Bijli', nat: 0, cam: { hood: [1.32, 1.12], bumper: [2.60, .50] } },
  { id: 'rosso', name: 'Rosso GT', tag: 'Classic GT', top: 1.0, acc: 1.0, rival: 'Shaheen', nat: 1, cam: { hood: [1.02, 1.52], bumper: [2.50, .62] } },
  { id: 'civic', name: 'Civic Sedan', tag: 'Family rocket', top: .96, acc: .97, rival: 'Sher Khan', nat: 3, cam: { hood: [1.12, 1.20], bumper: [2.45, .55] } },
  { id: 'pickup', name: 'Trail Pickup', tag: 'Rough rider', top: .93, acc: .95, rival: 'Baaz', nat: 6, cam: { hood: [1.22, 1.66], bumper: [2.50, .85] } }
];
const MODEL_BY = {}; MODEL_LIST.forEach(m => { MODEL_BY[m.id] = m; });
const MODEL_IDS = MODEL_LIST.map(m => m.id);
const LAPS = 1;
const settings = {
  color: Math.min(store.get('color2', 5), COLORS.length - 1),
  car: MODEL_IDS.includes(store.get('car2', 'revuelto')) ? store.get('car2', 'revuelto') : 'revuelto',
  sound: store.get('sound', true), autoGas: store.get('autoGas', false), storm: !!store.get('storm', false),
  cam: Math.max(0, Math.min(5, store.get('cam', 0) | 0))
};

// ======================= renderer / scene =======================
const canvas = $('gl');
// MSAA is wasted on dense screens (the pixel ratio already hides the jaggies) and costs a lot of fill rate
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch && (window.devicePixelRatio || 1) < 1.5, powerPreference: 'high-performance' });
let dprMax = Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 1.75), dpr = isTouch ? Math.min(dprMax, 1.25) : dprMax, dprCeil = dprMax;
renderer.setPixelRatio(dpr);
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
  clear: { sky: makeSky(['#6fa9d6', '#b9d9e6', '#e3eee2']), fog: '#d4e6dc', near: 260, far: 2700, hemi: 1.15, sun: 2.3, env: .55, exp: 1.0, grip: 1 },
  storm: { sky: makeSky(['#1c2530', '#3a4854', '#59666f']), fog: '#47535d', near: 40, far: 900, hemi: .62, sun: .5, env: .3, exp: .95, grip: .84 }
};
scene.fog = new THREE.Fog('#d4e6dc', 260, 2700);
const hemi = new THREE.HemisphereLight('#ffffff', '#86a06c', 1.15); scene.add(hemi);
const sun = new THREE.DirectionalLight('#fff3d9', 2.3); sun.position.set(-180, 260, 120); scene.add(sun);
{
  const pm = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  scene.environment = pm.fromScene(room, 0.04).texture; scene.environmentIntensity = 0.55;
  room.dispose(); pm.dispose();
}
const ENV = { grip: 1 };
const rain = { mesh: null };
function applyWeather() {
  const w = settings.storm ? WX.storm : WX.clear;
  scene.background = w.sky; scene.fog.color.set(w.fog); scene.fog.near = w.near; scene.fog.far = w.far;
  hemi.intensity = w.hemi; sun.intensity = w.sun; scene.environmentIntensity = w.env; renderer.toneMappingExposure = w.exp; ENV.grip = w.grip;
  if (rain.mesh) rain.mesh.visible = settings.storm;
}
scene.background = WX.clear.sky;

// ======================= car models: built ONCE, cached, cloned =======================
const CAR_SCALE = 0.82;
const CAR = { shadowGeo: null, shadowMat: null };
const MODELS = { rosso: null, civic: null, pickup: null, revuelto: null, sport: null };   // cached templates: {template, mats, paintKeys, wr (wheel radius, world m), name}
/*GLYPHS*/
/*CIVIC*/
/*REVUELTO*/
/*SPORT*/

function bodyProfile() {
  const s = new THREE.Shape();
  s.moveTo(-2.82, .50);
  s.bezierCurveTo(-2.88, .72, -2.84, 1.02, -2.62, 1.20);
  s.lineTo(-2.02, 1.33); s.lineTo(.82, 1.36);
  s.bezierCurveTo(1.55, 1.35, 2.20, 1.22, 2.66, 1.02);
  s.bezierCurveTo(2.86, .92, 2.88, .66, 2.70, .50);
  s.lineTo(2.58, .50); s.absarc(1.88, .50, .70, 0, Math.PI, false);
  s.lineTo(-1.18, .50); s.absarc(-1.88, .50, .70, 0, Math.PI, false);
  s.lineTo(-2.82, .50); s.closePath(); return s;
}
function cabinProfile() {
  const s = new THREE.Shape();
  s.moveTo(-1.62, 1.30); s.bezierCurveTo(-1.46, 1.74, -1.14, 2.02, -.78, 2.11);
  s.lineTo(.20, 2.11); s.bezierCurveTo(.58, 2.04, .96, 1.72, 1.18, 1.30); s.closePath(); return s;
}
function sideWindow(kind) {
  const s = new THREE.Shape();
  if (kind === 'rear') {
    s.moveTo(-1.40, 1.47); s.lineTo(-.60, 1.47); s.lineTo(-.60, 1.96); s.lineTo(-.88, 1.96);
    s.quadraticCurveTo(-1.12, 1.94, -1.24, 1.76); s.quadraticCurveTo(-1.36, 1.62, -1.40, 1.47);
  } else { s.moveTo(-.44, 1.47); s.lineTo(.94, 1.47); s.lineTo(.54, 1.96); s.lineTo(-.44, 1.96); }
  s.closePath(); return s;
}
function windshieldPoint(u, v, rear) {
  const x = rear ? THREE.MathUtils.lerp(-1.58, -.84, v) - .02 * (1 - u * u) * Math.sin(v * Math.PI)
                 : THREE.MathUtils.lerp(1.14, .50, v) + .030 * (1 - u * u) * Math.sin(v * Math.PI);
  const y = THREE.MathUtils.lerp(1.38, 2.05, v) + .02 * (1 - u * u);
  const z = u * THREE.MathUtils.lerp(.94, .78, v);
  return new THREE.Vector3(x, y, z);
}
function windshieldGeometry(rear) {
  const verts = [], idx = [], cols = 10, rows = 6;
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) { const p = windshieldPoint(i / cols * 2 - 1, j / rows, rear); verts.push(p.x, p.y, p.z); }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) { const a = j * (cols + 1) + i, b = a + cols + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

// geometry helpers shared by the procedural car builders: put() bakes a transform into a geometry and files it under a material key,
// merge() then welds every key into ONE mesh (so a whole car costs a handful of draw calls)
function makeKit() {
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), ONE = new THREE.Vector3(1, 1, 1);
  const put = (bucket, key, geo, x, y, z, rx, ry, rz) => {
    E.set(rx || 0, ry || 0, rz || 0); Q.setFromEuler(E); V.set(x || 0, y || 0, z || 0); M4.compose(V, Q, ONE); geo.applyMatrix4(M4);
    (bucket[key] || (bucket[key] = [])).push(geo);
  };
  const rbox = (w, h, d, r, seg) => new RoundedBoxGeometry(w, h, d, seg || 1, r);
  const cylX = (r, l, seg) => { const g = new THREE.CylinderGeometry(r, r, l, seg || 16); g.rotateZ(Math.PI / 2); return g; };
  const cylZ = (r, l, seg) => { const g = new THREE.CylinderGeometry(r, r, l, seg || 16); g.rotateX(Math.PI / 2); return g; };
  const tubeG = (pts, r, seg, rad) => new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2]))), seg || 16, r, rad || 5, false);
  const merge = (bucket) => {
    const out = {};
    for (const k in bucket) {
      const list = bucket[k].map(g => { const n = g.index ? g.toNonIndexed() : g; if (n !== g) g.dispose(); n.deleteAttribute('uv'); if (!n.attributes.normal) n.computeVertexNormals(); return n; });
      const m = mergeGeometries(list, false);
      list.forEach(g => g.dispose());
      if (m) out[k] = m; else console.error('car merge failed for', k);
    }
    return out;
  };

  const std = (color, rough, metal) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal || 0 });
  return { put, rbox, cylX, cylZ, tubeG, merge, std };
}

function buildCarTemplate() {
  const { put, rbox, cylX, cylZ, tubeG, merge, std } = makeKit();
  const mats = {
    paint: new THREE.MeshPhysicalMaterial({ color: '#c91420', roughness: .28, metalness: .16, clearcoat: 1, clearcoatRoughness: .08 }),
    carbon: new THREE.MeshStandardMaterial({ color: '#12161a', roughness: .38, metalness: .45 }),
    metal: std('#dcdcd6', .2, .9),
    rubber: std('#17191a', .92),
    rim: std('#c6c8c4', .24, .86),
    glass: new THREE.MeshStandardMaterial({ color: '#9fc4cc', roughness: .06, metalness: .1, transparent: true, opacity: .36, side: THREE.DoubleSide, depthWrite: false }),
    roofGlass: new THREE.MeshStandardMaterial({ color: '#0d1518', roughness: .08, metalness: .2 }),
    interior: std('#141617', .8),
    leather: std('#3a2c26', .6),
    plate: std('#f2eed6', .6),
    lamp: new THREE.MeshStandardMaterial({ color: '#f4faff', roughness: .1, emissive: '#cfe8ff', emissiveIntensity: 1.2 }),
    tail: new THREE.MeshStandardMaterial({ color: '#8f121c', roughness: .25, emissive: '#e51b2c', emissiveIntensity: .35 })
  };

  // ---- shell ----
  const B = {};
  put(B, 'paint', new THREE.ExtrudeGeometry(bodyProfile(), { depth: 2.02, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .05, bevelThickness: .05, curveSegments: 20 }), 0, 0, -1.01);
  put(B, 'carbon', rbox(5.05, .16, 1.86, .04), 0, .47, 0);
  for (const wx of [1.88, -1.88]) for (const sg of [-1, 1]) put(B, 'carbon', cylZ(.685, .02, 32), wx, .60, sg * 1.055);
  for (const sg of [-1, 1]) {
    const frame = cabinProfile();
    for (const kind of ['rear', 'front']) frame.holes.push(new THREE.Path(sideWindow(kind).getPoints(24)));
    put(B, 'paint', new THREE.ExtrudeGeometry(frame, { depth: .075, bevelEnabled: false, curveSegments: 16, steps: 1 }), 0, 0, sg === 1 ? .93 : -1.005);
    for (const kind of ['rear', 'front']) put(B, 'glass', new THREE.ShapeGeometry(sideWindow(kind), 16), 0, 0, sg * .995);
    put(B, 'carbon', rbox(2.45, .07, .06, .018), -.02, .58, sg * 1.06);
    put(B, 'carbon', rbox(.30, .04, .042, .014), .02, 1.24, sg * 1.088);
    put(B, 'carbon', rbox(.34, .16, .03, .012), 1.02, 1.02, sg * 1.075);
    put(B, 'metal', rbox(.26, .018, .034, .006), 1.02, 1.065, sg * 1.082);
    put(B, 'metal', rbox(.26, .018, .034, .006), 1.02, .975, sg * 1.082);
    put(B, 'carbon', tubeG([[.80, 1.52, sg * .96], [.84, 1.56, sg * 1.14]], .024, 4, 5));
    put(B, 'paint', rbox(.24, .12, .26, .035), .84, 1.60, sg * 1.20, 0, 0, -.06);
    put(B, 'metal', rbox(.012, .085, .19, .005), .712, 1.605, sg * 1.205, 0, 0, -.06);
    put(B, 'paint', rbox(1.55, .16, .14, .05), 1.88, 1.30, sg * 1.02, 0, 0, -.02);
    put(B, 'paint', rbox(1.50, .17, .14, .05), -1.88, 1.30, sg * 1.02);
  }
  for (const rear of [false, true]) {
    put(B, 'glass', windshieldGeometry(rear));
    for (const u of [-1, 1]) {
      const pts = []; for (let j = 0; j <= 8; j++) pts.push(windshieldPoint(u, j / 8, rear));
      put(B, 'paint', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, .042, 5, false));
    }
  }
  put(B, 'paint', rbox(1.06, .085, 1.70, .032, 2), -.28, 2.115, 0);
  put(B, 'roofGlass', rbox(.74, .032, 1.36, .02, 2), -.30, 2.168, 0);
  put(B, 'paint', rbox(.20, .085, .035, .015), -.82, 2.185, 0, 0, 0, .28);
  put(B, 'paint', rbox(1.92, .055, 1.74, .022, 2), 1.68, 1.375, 0, 0, 0, -.038);
  put(B, 'paint', rbox(1.30, .045, .60, .02, 2), 1.60, 1.415, 0, 0, 0, -.038);
  for (const z of [-.56, .56]) put(B, 'carbon', rbox(.44, .022, .30, .01), 1.02, 1.448, z, 0, 0, -.038);
  put(B, 'paint', rbox(.78, .055, 1.80, .022, 2), -1.95, 1.36, 0, 0, 0, .022);
  put(B, 'carbon', rbox(.18, .06, 1.86, .018), -2.38, 1.40, 0);
  // cockpit (seen through the glass)
  put(B, 'interior', rbox(3.0, .07, 1.60, .03), -.05, 1.10, 0);
  for (const z of [-.42, .42]) {
    put(B, 'leather', rbox(.66, .15, .50, .055), -.28, 1.26, z);
    put(B, 'leather', rbox(.17, .66, .52, .06), -.56, 1.58, z, 0, 0, -.12);
    put(B, 'leather', rbox(.15, .22, .34, .05), -.65, 1.94, z, 0, 0, -.07);
  }
  put(B, 'interior', rbox(.34, .24, 1.66, .06), .80, 1.42, 0);
  put(B, 'carbon', rbox(1.05, .15, .22, .045), -.02, 1.22, 0);
  { const g = new THREE.TorusGeometry(.205, .028, 8, 24); g.rotateY(Math.PI / 2); put(B, 'leather', g, .50, 1.62, .42); }
  // lights, grille, exhaust
  for (const z of [-.64, .64]) {
    put(B, 'carbon', rbox(.10, .20, .56, .035), 2.78, 1.06, z, 0, 0, -.07);
    for (const off of [-.135, .115]) { put(B, 'metal', cylX(.055, .055, 16), 2.815, 1.065, z + off); put(B, 'lamp', cylX(.034, .06, 12), 2.835, 1.065, z + off); }
    put(B, 'lamp', rbox(.022, .03, .48, .01), 2.838, 1.145, z, 0, 0, -.07);
    put(B, 'tail', rbox(.06, .15, .40, .03), -2.80, 1.14, z, 0, 0, .06);
  }
  put(B, 'tail', rbox(.045, .075, 1.30, .025), -2.845, 1.155, 0);
  put(B, 'carbon', rbox(.055, .30, 1.30, .045), 2.845, .72, 0);
  for (const z of [-.45, -.225, 0, .225, .45]) put(B, 'metal', rbox(.02, .22, .02, .007), 2.878, .72, z);
  for (const z of [-.80, .80]) put(B, 'carbon', rbox(.05, .24, .34, .035), 2.82, .74, z);
  put(B, 'carbon', rbox(.34, .065, 1.98, .02), 2.66, .40, 0);
  put(B, 'carbon', rbox(.22, .20, 1.60, .035), -2.72, .62, 0);
  for (const z of [-.68, -.50, .50, .68]) { put(B, 'metal', cylX(.058, .17, 14), -2.80, .66, z); put(B, 'carbon', cylX(.04, .175, 12), -2.885, .66, z); }
  put(B, 'plate', rbox(.02, .14, .55, .006), 2.885, .98, 0);
  put(B, 'plate', rbox(.02, .14, .55, .006), -2.89, .92, 0);
  const shellGeos = merge(B);

  // ---- wheel (merged once, shared by all 4 wheels of every car) ----
  const W = {};
  put(W, 'rubber', cylZ(.60, .34, 28), 0, 0, 0);
  for (const d of [-.11, .11]) put(W, 'rubber', new THREE.TorusGeometry(.485, .105, 8, 28), 0, 0, d);
  put(W, 'carbon', cylZ(.455, .352, 24), 0, 0, 0);
  put(W, 'rim', cylZ(.335, .02, 24), 0, 0, .196);
  put(W, 'rim', new THREE.TorusGeometry(.39, .03, 6, 24), 0, 0, .212);
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2;
    put(W, 'rim', new THREE.BoxGeometry(.052, .33, .03), Math.cos(a) * .205, Math.sin(a) * .205, .238, 0, 0, a - Math.PI / 2);
  }
  put(W, 'carbon', cylZ(.105, .05, 18), 0, 0, .248);
  put(W, 'metal', cylZ(.044, .014, 12), 0, 0, .284);
  const wheelGeos = merge(W);

  // ---- assemble template ----
  const model = new THREE.Group(); model.name = 'model';
  model.rotation.y = -Math.PI / 2; model.scale.setScalar(CAR_SCALE);
  const shell = new THREE.Group(); model.add(shell);
  for (const k in shellGeos) { const m = new THREE.Mesh(shellGeos[k], mats[k]); m.userData.mk = k; shell.add(m); }
  const specs = [['pivot_f0', 1.88, 1.04, false], ['pivot_f1', 1.88, -1.04, true], ['pivot_r0', -1.88, 1.04, false], ['pivot_r1', -1.88, -1.04, true]];
  for (const s of specs) {
    const pivot = new THREE.Group(); pivot.name = s[0]; pivot.position.set(s[1], .60, s[2]);
    const flip = new THREE.Group(); flip.rotation.y = s[3] ? Math.PI : 0;
    const spin = new THREE.Group(); spin.name = 'spin';
    for (const k in wheelGeos) spin.add(new THREE.Mesh(wheelGeos[k], mats[k]));
    flip.add(spin); pivot.add(flip); model.add(pivot);
  }
  MODELS.rosso = { template: model, mats, paintKeys: ['paint'], wr: .6 * CAR_SCALE, flipRight: true, tailBase: .35, tailBrake: 1.8, name: 'Rosso GT' };
}

// ---- Trail Pickup: a chunky crew-cab truck, built the same way as the Rosso (merged by material, wheels shared) ----
function pickupBodyShape() {
  const s = new THREE.Shape(), FA = 1.98, RA = -1.80, AR = .80;   // front / rear axle x, wheel-arch radius
  s.moveTo(-2.84, .52);
  s.lineTo(-2.86, 1.42);                                  // tailgate
  s.lineTo(-.30, 1.42);                                   // bed side
  s.lineTo(1.25, 1.44);                                   // cab + bonnet line
  s.bezierCurveTo(1.90, 1.44, 2.50, 1.40, 2.80, 1.28);    // bonnet slopes down to the nose
  s.lineTo(2.88, 1.00); s.lineTo(2.86, .52);
  s.lineTo(FA + AR, .52); s.absarc(FA, .52, AR, 0, Math.PI, false);
  s.lineTo(RA + AR, .52); s.absarc(RA, .52, AR, 0, Math.PI, false);
  s.lineTo(-2.84, .52); s.closePath(); return s;
}
function pickupCabShape() {
  const s = new THREE.Shape();
  s.moveTo(-.30, 1.38); s.lineTo(-.30, 2.00); s.quadraticCurveTo(-.30, 2.17, -.12, 2.18);
  s.lineTo(.56, 2.18); s.quadraticCurveTo(.62, 2.18, .65, 2.14); s.lineTo(1.28, 1.40); s.closePath(); return s;
}
function pickupWindow(kind) {
  const s = new THREE.Shape();
  if (kind === 'front') { s.moveTo(.46, 1.55); s.lineTo(1.08, 1.55); s.lineTo(.68, 2.04); s.lineTo(.46, 2.04); }
  else { s.moveTo(-.18, 1.55); s.lineTo(.36, 1.55); s.lineTo(.36, 2.04); s.lineTo(-.18, 2.04); }
  s.closePath(); return s;
}
function buildPickupTemplate() {
  const { put, rbox, cylZ, merge, std } = makeKit();
  const FA = 1.98, RA = -1.80, WR = .62, WZ = 1.06;
  const mats = {
    paint: new THREE.MeshPhysicalMaterial({ color: '#c91420', roughness: .34, metalness: .18, clearcoat: isTouch ? 0 : 1, clearcoatRoughness: .1 }),
    carbon: new THREE.MeshStandardMaterial({ color: '#14181b', roughness: .5, metalness: .35 }),
    metal: std('#d9dad4', .22, .9),
    rubber: std('#16181a', .95),
    rim: std('#2c3136', .35, .8),
    glass: new THREE.MeshStandardMaterial({ color: '#0e171b', roughness: .08, metalness: .25, side: THREE.DoubleSide }),
    lamp: new THREE.MeshStandardMaterial({ color: '#fff6e0', roughness: .12, emissive: '#ffe9b8', emissiveIntensity: 1.1 }),
    tail: new THREE.MeshStandardMaterial({ color: '#8f121c', roughness: .25, emissive: '#e51b2c', emissiveIntensity: .35 })
  };

  const B = {};
  // body shell + cab
  put(B, 'paint', new THREE.ExtrudeGeometry(pickupBodyShape(), { depth: 2.0, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .05, bevelThickness: .05, curveSegments: 20 }), 0, 0, -1.0);
  put(B, 'paint', new THREE.ExtrudeGeometry(pickupCabShape(), { depth: 1.8, bevelEnabled: false, curveSegments: 12, steps: 1 }), 0, 0, -.9);
  put(B, 'carbon', rbox(5.6, .16, 1.86, .04), 0, .46, 0);                                    // underbody
  for (const wx of [FA, RA]) for (const sg of [-1, 1]) put(B, 'carbon', cylZ(.75, .02, 32), wx, WR, sg * 1.0);   // dark wheel-arch backing
  // glass
  for (const sg of [-1, 1]) for (const kind of ['front', 'rear']) put(B, 'glass', new THREE.ShapeGeometry(pickupWindow(kind), 8), 0, 0, sg * .905);
  put(B, 'glass', rbox(.03, .90, 1.56, .01), .969, 1.80, 0, 0, 0, .708);                   // windscreen
  put(B, 'glass', rbox(.03, .44, 1.30, .01), -.31, 1.76, 0);                               // rear window
  // doors, handles, steps, mirrors
  for (const sg of [-1, 1]) {
    for (const x of [-.22, .41, 1.25]) put(B, 'carbon', rbox(.012, .80, .014, .004), x, 1.00, sg * 1.053);
    for (const x of [.05, .75]) put(B, 'metal', rbox(.20, .03, .03, .01), x, 1.30, sg * 1.066);
    put(B, 'carbon', rbox(2.0, .07, .20, .03), .08, .60, sg * 1.12);
    put(B, 'paint', rbox(.12, .16, .22, .04), 1.02, 1.72, sg * 1.04, 0, 0, -.06);
    put(B, 'carbon', rbox(.04, .05, .20, .015), 1.02, 1.60, sg * 1.00);
  }
  // load bed: liner, walls, tailgate, wheel housings
  put(B, 'carbon', rbox(2.40, .03, 1.62, .012), -1.58, 1.435, 0);
  for (const sg of [-1, 1]) {
    put(B, 'paint', rbox(2.56, .26, .10, .03), -1.57, 1.55, sg * .95);
    put(B, 'carbon', rbox(.90, .12, .26, .05), RA, 1.46, sg * .76);
  }
  put(B, 'paint', rbox(.10, .30, 1.90, .03), -.40, 1.57, 0);
  put(B, 'paint', rbox(.10, .26, 1.90, .03), -2.80, 1.55, 0);
  // roof light bar, bonnet scoop
  put(B, 'carbon', rbox(.14, .10, 1.30, .04), .38, 2.24, 0);
  put(B, 'lamp', rbox(.02, .05, 1.16, .015), .455, 2.24, 0);
  put(B, 'carbon', rbox(.55, .10, .50, .04), 1.75, 1.47, 0);
  // front end
  put(B, 'carbon', rbox(.30, .26, 2.04, .05), 2.80, .66, 0);
  put(B, 'carbon', rbox(.08, .34, 1.20, .04), 2.88, 1.05, 0);
  for (const y of [.97, 1.05, 1.13]) put(B, 'metal', rbox(.02, .03, 1.04, .008), 2.925, y, 0);
  for (const sg of [-1, 1]) {
    put(B, 'carbon', rbox(.08, .26, .40, .04), 2.86, 1.14, sg * .80);
    put(B, 'lamp', rbox(.03, .14, .30, .03), 2.905, 1.14, sg * .80);
  }
  // rear end
  put(B, 'metal', rbox(.30, .20, 2.04, .04), -2.86, .66, 0);
  for (const sg of [-1, 1]) put(B, 'tail', rbox(.05, .32, .14, .025), -2.885, 1.12, sg * .90);
  const shellGeos = merge(B);

  // wheel: built once and shared by all four (and by every spawned car)
  const W = {};
  put(W, 'rubber', cylZ(.58, .38, 28), 0, 0, 0);
  for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; put(W, 'rubber', new THREE.BoxGeometry(.08, .12, .38), Math.cos(a) * .58, Math.sin(a) * .58, 0, 0, 0, a); }   // chunky tread blocks
  put(W, 'carbon', cylZ(.40, .392, 24), 0, 0, 0);
  put(W, 'rim', cylZ(.31, .02, 24), 0, 0, .205);
  put(W, 'rim', new THREE.TorusGeometry(.34, .03, 6, 24), 0, 0, .21);
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; put(W, 'rim', new THREE.BoxGeometry(.05, .26, .03), Math.cos(a) * .17, Math.sin(a) * .17, .225, 0, 0, a - Math.PI / 2); }
  put(W, 'carbon', cylZ(.10, .05, 16), 0, 0, .235);
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; put(W, 'metal', cylZ(.022, .02, 8), Math.cos(a) * .13, Math.sin(a) * .13, .252); }
  const wheelGeos = merge(W);

  const model = new THREE.Group(); model.name = 'model';
  model.rotation.y = -Math.PI / 2; model.scale.setScalar(CAR_SCALE);
  const shell = new THREE.Group(); model.add(shell);
  for (const k in shellGeos) { const m = new THREE.Mesh(shellGeos[k], mats[k]); m.userData.mk = k; shell.add(m); }
  for (const [n, x, z, flip] of [['pivot_f0', FA, WZ, false], ['pivot_f1', FA, -WZ, true], ['pivot_r0', RA, WZ, false], ['pivot_r1', RA, -WZ, true]]) {
    const pivot = new THREE.Group(); pivot.name = n; pivot.position.set(x, WR, z);
    const flipG = new THREE.Group(); flipG.rotation.y = flip ? Math.PI : 0;
    const spin = new THREE.Group(); spin.name = 'spin';
    for (const k in wheelGeos) spin.add(new THREE.Mesh(wheelGeos[k], mats[k]));
    flipG.add(spin); pivot.add(flipG); model.add(pivot);
  }
  MODELS.pickup = { template: model, mats, paintKeys: ['paint'], wr: WR * CAR_SCALE, flipRight: true, tailBase: .35, tailBrake: 1.8, name: 'Trail Pickup' };
}

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

// ---- name tags floating above the cars: "YOU" for the player (yellow, with an arrow), the rival's name for the others ----
function pillPath(g, x, y, w, h, r) {
  g.beginPath(); g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.arc(x + w - r, y + r, r, -Math.PI / 2, 0); g.lineTo(x + w, y + h - r);
  g.arc(x + w - r, y + h - r, r, 0, Math.PI / 2); g.lineTo(x + r, y + h); g.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI); g.lineTo(x, y + r);
  g.arc(x + r, y + r, r, Math.PI, Math.PI * 1.5); g.closePath();
}
function makeTag(text, color, you) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 96;
  const g = cv.getContext('2d');
  g.font = '800 40px Manrope, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const w = Math.min(244, g.measureText(text).width + (you ? 44 : 70));
  pillPath(g, 128 - w / 2, 4, w, 58, 29); g.fillStyle = you ? '#ffd23a' : 'rgba(13,14,17,.84)'; g.fill();
  g.lineWidth = 3; g.strokeStyle = you ? '#1a1405' : 'rgba(255,255,255,.75)'; g.stroke();
  if (you) {
    g.fillStyle = '#ffd23a'; g.strokeStyle = '#1a1405'; g.beginPath(); g.moveTo(104, 62); g.lineTo(152, 62); g.lineTo(128, 92); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#1a1405'; g.fillText(text, 128, 35);
  } else {
    g.fillStyle = color; g.beginPath(); g.arc(128 - w / 2 + 28, 33, 11, 0, 6.2832); g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke();
    g.fillStyle = '#fff'; g.fillText(text, 128 + 14, 35);
  }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false }));
  sp.scale.set(you ? 3.6 : 4.4, you ? 1.35 : 1.65, 1); sp.renderOrder = 30; return sp;
}

function spawnCar(id, colorHex, name, you) {
  const M = MODELS[id];
  const root = new THREE.Group(), tilt = new THREE.Group(); root.add(tilt);
  const model = M.template.clone(true); tilt.add(model);       // geometry + shared materials are reused, nothing is rebuilt
  const pm = {}; for (const k of M.paintKeys) pm[k] = M.mats[k].clone();
  const tail = M.mats.tail.clone();
  model.traverse(o => { if (o.isMesh) { const k = o.userData.mk; if (pm[k]) o.material = pm[k]; else if (k === 'tail') o.material = tail; } });
  const wheels = [];
  for (const [n, front, flipped] of [['pivot_f0', true, false], ['pivot_f1', true, M.flipRight], ['pivot_r0', false, false], ['pivot_r1', false, M.flipRight]]) {
    const pivot = model.getObjectByName(n); wheels.push({ pivot, spin: pivot.getObjectByName('spin'), front, flipped });
  }
  const shadow = new THREE.Mesh(CAR.shadowGeo, CAR.shadowMat); shadow.position.y = .1; shadow.renderOrder = 2; root.add(shadow);
  const tag = makeTag(name, colorHex, you); tag.position.set(0, M.tagY, 0); root.add(tag);
  scene.add(root);
  const v = { id, root, tilt, pm, tail, tailBase: M.tailBase, tailBrake: M.tailBrake, wr: M.wr, wheels, wheelAngle: 0, pitch: 0, roll: 0, prevVf: 0, accel: 0, shadow, tag, you, M };
  setCarColor(v, colorHex);
  return v;
}
function disposeCar(v) {   // only per-car materials are disposed; geometry/templates stay cached
  if (!v) return;
  scene.remove(v.root);
  for (const k in v.pm) v.pm[k].dispose(); v.tail.dispose();
  v.tag.material.map.dispose(); v.tag.material.dispose();
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

const BUILDERS = {
  rosso: buildCarTemplate, pickup: buildPickupTemplate,
  civic: () => bakeProcedural('civic', createHondaCivic, { name: 'Civic Sedan', wr: .335, tailBase: 1.3, tailBrake: 4.2 }),
  revuelto: () => bakeProcedural('revuelto', createRevuelto, { name: 'Revuelto V12', wr: .365, tailBase: 3.0, tailBrake: 7.5 }),
  sport: () => bakeProcedural('sport', createSportsCar, { name: 'Red Sports GT', wr: .365, tailBase: 2.4, tailBrake: 6.5 })
};
const TAG_Y = { rosso: 2.3, civic: 2.05, pickup: 2.6, revuelto: 1.85, sport: 1.9 };
function ensureModel(id) {
  if (!MODELS[id]) { BUILDERS[id](); MODELS[id].tagY = TAG_Y[id] || 2.2; }
  return MODELS[id];
}

// ======================= track =======================
const track = buildTrack(), HZ = buildHazards(track), HW = track.width / 2;
const TB = (() => {
  let a = 1e9, b = -1e9, c = 1e9, d = -1e9;
  for (let i = 0; i < track.N; i++) { a = Math.min(a, track.x[i]); b = Math.max(b, track.x[i]); c = Math.min(c, track.z[i]); d = Math.max(d, track.z[i]); }
  return { minX: a, maxX: b, minZ: c, maxZ: d, cx: (a + b) / 2, cz: (c + d) / 2, r: Math.hypot(b - a, d - c) / 2 };
})();
const SC = { padTex: null, lavaTex: null, boulders: [] };   // animated scenery

function canvasTex(w, h, draw, repeat) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; }
  return t;
}
function addGantry(tr, idx, text, bg, fg, stripes) {
  const g = new THREE.Group(); g.position.set(tr.x[idx], 0, tr.z[idx]); g.rotation.y = tr.heading[idx]; scene.add(g);
  const post = new THREE.MeshLambertMaterial({ color: stripes ? '#2a2a2a' : '#cfd6cc' });
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.8, 8, .8), post); p.position.set(s * (HW + 2.2), 4, 0); g.add(p); }
  const bt = canvasTex(512, 96, (x, w, h) => {
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    if (stripes) { x.fillStyle = '#111'; for (let i = -2; i < 12; i++) { x.beginPath(); x.moveTo(i * 44, 0); x.lineTo(i * 44 + 22, 0); x.lineTo(i * 44 + 22 - 20, 14); x.lineTo(i * 44 - 20, 14); x.fill(); x.beginPath(); x.moveTo(i * 44, h); x.lineTo(i * 44 + 22, h); x.lineTo(i * 44 + 22 - 20, h - 14); x.lineTo(i * 44 - 20, h - 14); x.fill(); } }
    x.fillStyle = fg; x.font = '800 50px Manrope, Arial, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 256, 50);
  });
  // two single-sided planes (one per direction) so the text reads correctly from both sides, not mirrored on the back
  const geo = new THREE.PlaneGeometry(HW * 2 + 4.4, 3.2), mat = new THREE.MeshBasicMaterial({ map: bt, toneMapped: false });
  for (const [ry, dz] of [[0, .02], [Math.PI, -.02]]) { const m = new THREE.Mesh(geo, mat); m.position.set(0, 7.2, dz); m.rotation.y = ry; g.add(m); }
  freeze(g); return g;
}
function laneQuadGeo(tr, quads) {   // quads: [i, latA, latB, y, hex]
  const N = tr.N, pos = [], col = [], ind = [], nor = [], c = new THREE.Color(); let vi = 0;
  for (const q of quads) {
    const i = q[0], a = q[1], b = q[2], y = q[3], j = (i + 1) % N; c.set(q[4]);
    const pts = [[tr.x[i] + tr.nx[i] * a, tr.z[i] + tr.nz[i] * a], [tr.x[i] + tr.nx[i] * b, tr.z[i] + tr.nz[i] * b], [tr.x[j] + tr.nx[j] * b, tr.z[j] + tr.nz[j] * b], [tr.x[j] + tr.nx[j] * a, tr.z[j] + tr.nz[j] * a]];
    for (const p of pts) { pos.push(p[0], y, p[1]); col.push(c.r, c.g, c.b); nor.push(0, 1, 0); }
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

function buildTrackVisuals(tr) {
  const N = tr.N, hw = HW, rnd = mulberry32(20261110), quads = [];
  for (let i = 0; i < N; i++) {
    quads.push([i, -hw, hw, 0, (i >> 3) & 1 ? '#3d4245' : '#383d40']);
    quads.push([i, -hw - 1.5, -hw, .06, ((i / 2) | 0) % 2 ? '#c9212c' : '#f1efe6']);
    quads.push([i, hw, hw + 1.5, .06, ((i / 2) | 0) % 2 ? '#c9212c' : '#f1efe6']);
    if ((i >> 1) % 2 === 0) quads.push([i, -.18, .18, .08, '#e9e7d8']);
  }
  for (const s of [[4, -5], [4, 5], [6, -5], [6, 5], [8, 0]]) quads.push([(N - s[0]) % N, s[1] - 1.7, s[1] + 1.7, .09, '#6f7679']);   // grid boxes
  { const roadMesh = new THREE.Mesh(laneQuadGeo(tr, quads), new THREE.MeshLambertMaterial({ vertexColors: true })); scene.add(roadMesh); freeze(roadMesh); }

  // grass with tiling noise (gives a strong sense of speed)
  const gt = canvasTex(128, 128, (gx) => {
    gx.fillStyle = '#86b06a'; gx.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 420; i++) { gx.fillStyle = Math.random() < .5 ? 'rgba(60,110,50,.22)' : 'rgba(170,205,120,.2)'; const s = 3 + Math.random() * 9; gx.fillRect(Math.random() * 128, Math.random() * 128, s, s); }
  }, true);
  const GS = 6400; gt.repeat.set(GS / 12, GS / 12);
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(GS, GS), new THREE.MeshLambertMaterial({ map: gt }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(TB.cx, -.15, TB.cz); scene.add(ground); freeze(ground);

  // start / finish line + gantry
  const h0 = tr.heading[0], sx = tr.x[0], sz = tr.z[0];
  const ct = canvasTex(128, 32, (cx) => { for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) { cx.fillStyle = (x + y) % 2 ? '#101412' : '#f4f3ea'; cx.fillRect(x * 8, y * 8, 8, 8); } });
  ct.magFilter = THREE.NearestFilter;
  const line = new THREE.Mesh(new THREE.PlaneGeometry(tr.width, 2.4), new THREE.MeshBasicMaterial({ map: ct, toneMapped: false }));
  line.rotation.order = 'YXZ'; line.rotation.set(-Math.PI / 2, h0, 0); line.position.set(sx, .1, sz); scene.add(line); freeze(line);
  addGantry(tr, 0, 'MINI CAR RACE', '#c91420', '#ffffff', false);
  for (const gate of HZ.gates) addGantry(tr, (gate.idx + N - 6) % N, 'DANGER ZONE', '#ffc400', '#111111', true);

  // ---- hazards ----
  // boost pads: scrolling chevrons
  SC.padTex = canvasTex(128, 192, (x, w, h) => {
    x.fillStyle = 'rgba(5,40,30,.55)'; x.fillRect(0, 0, w, h);
    x.strokeStyle = '#3dffb0'; x.lineWidth = 14; x.lineJoin = 'miter';
    for (let k = 0; k < 3; k++) { const y = k * 64 + 44; x.beginPath(); x.moveTo(18, y + 26); x.lineTo(64, y - 10); x.lineTo(110, y + 26); x.stroke(); }
  }, true);
  { const mat = new THREE.MeshBasicMaterial({ map: SC.padTex, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const geo = new THREE.PlaneGeometry(10.4, 14);
    for (const p of HZ.pads) { const m = new THREE.Mesh(geo, mat); m.rotation.order = 'YXZ'; m.rotation.set(-Math.PI / 2, p.h, Math.PI); m.position.set(p.x, .11, p.z); m.renderOrder = 1; scene.add(m); freeze(m); } }
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

  // trees (one instanced mesh), scenery rocks and mountains
  const trunk = new THREE.CylinderGeometry(.25, .38, 2.2, 5); trunk.translate(0, 1.1, 0);
  const crown = new THREE.ConeGeometry(2.1, 6.2, 6); crown.translate(0, 5, 0);
  const paintGeo = (geo, hex) => { const n = geo.toNonIndexed(); const cl = new THREE.Color(hex), a = []; for (let i = 0; i < n.attributes.position.count; i++) a.push(cl.r, cl.g, cl.b); n.setAttribute('color', new THREE.Float32BufferAttribute(a, 3)); n.deleteAttribute('uv'); return n; };
  const treeGeo = mergeGeometries([paintGeo(trunk, '#6b4a2e'), paintGeo(crown, '#3f7a45')], false);
  const TREES = isTouch ? 900 : 1500, trees = new THREE.InstancedMesh(treeGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), TREES);
  const dummy = new THREE.Object3D(), tc = new THREE.Color(); let placed = 0, tries = 0;
  const W = TB.maxX - TB.minX + 1500, Hh = TB.maxZ - TB.minZ + 1500;
  while (placed < TREES && tries++ < 12000) {
    const x = TB.cx + (rnd() - .5) * W, z = TB.cz + (rnd() - .5) * Hh;
    let d = 1e9; for (let i = 0; i < N; i += 3) { const dd = (x - tr.x[i]) ** 2 + (z - tr.z[i]) ** 2; if (dd < d) d = dd; }
    if (d < (hw + 20) ** 2) continue;
    dummy.position.set(x, -.1, z); const s = .8 + rnd() * 1.1; dummy.scale.set(s, s * (.9 + rnd() * .5), s); dummy.rotation.set(0, rnd() * 6, 0); dummy.updateMatrix();
    trees.setMatrixAt(placed, dummy.matrix); tc.setRGB(.78 + rnd() * .22, .86 + rnd() * .14, .78 + rnd() * .22); trees.setColorAt(placed, tc); placed++;
  }
  trees.count = placed; trees.instanceMatrix.needsUpdate = true; if (trees.instanceColor) trees.instanceColor.needsUpdate = true; trees.frustumCulled = false; scene.add(trees); freeze(trees);
  const MN = 34, mt = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 5), new THREE.MeshLambertMaterial({ color: '#8aa3a0' }), MN);
  for (let i = 0; i < MN; i++) {
    const a = i / MN * Math.PI * 2 + rnd() * .2, r = TB.r + 1150 + rnd() * 200, h = 160 + rnd() * 230, w = 230 + rnd() * 200;
    dummy.position.set(TB.cx + Math.cos(a) * r, h / 2 - 8, TB.cz + Math.sin(a) * r); dummy.scale.set(w, h, w); dummy.rotation.set(0, rnd() * 3, 0); dummy.updateMatrix(); mt.setMatrixAt(i, dummy.matrix);
  }
  mt.frustumCulled = false; scene.add(mt); freeze(mt);
}
function updateScenery(dt, t) {
  if (SC.padTex) SC.padTex.offset.y -= dt * 1.4;
  if (SC.lavaTex) { SC.lavaTex.offset.y -= dt * .05; SC.lavaTex.offset.x += dt * .01; }
  const p = { x: 0, z: 0, lat: 0 };
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

// ======================= storm: rain + lightning =======================
const RAIN_N = 800, RB = 42, RH = 38;
const rainD = { wx: new Float32Array(RAIN_N), wy: new Float32Array(RAIN_N), wz: new Float32Array(RAIN_N), pos: new Float32Array(RAIN_N * 6) };
const storm = { next: 7, flash: 0, queue: 0 };
function initRain() {
  for (let i = 0; i < RAIN_N; i++) { rainD.wx[i] = Math.random() * RB * 2; rainD.wy[i] = Math.random() * RH; rainD.wz[i] = Math.random() * RB * 2; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(rainD.pos, 3));
  rain.mesh = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#cfe0ee', transparent: true, opacity: .42, fog: false, depthWrite: false }));
  rain.mesh.frustumCulled = false; rain.mesh.visible = false; scene.add(rain.mesh);
}
function updateRain(dt) {
  if (!rain.mesh || !rain.mesh.visible) return;
  const cx = camera.position.x, cz = camera.position.z, p = rainD.pos;
  for (let i = 0; i < RAIN_N; i++) {
    rainD.wy[i] -= 46 * dt; if (rainD.wy[i] < 0) rainD.wy[i] += RH;
    let dx = rainD.wx[i] - cx; if (dx > RB) rainD.wx[i] -= RB * 2; else if (dx < -RB) rainD.wx[i] += RB * 2;
    let dz = rainD.wz[i] - cz; if (dz > RB) rainD.wz[i] -= RB * 2; else if (dz < -RB) rainD.wz[i] += RB * 2;
    const k = i * 6; p[k] = rainD.wx[i]; p[k + 1] = rainD.wy[i]; p[k + 2] = rainD.wz[i]; p[k + 3] = rainD.wx[i] + .25; p[k + 4] = rainD.wy[i] + 1.5; p[k + 5] = rainD.wz[i];
  }
  rain.mesh.geometry.attributes.position.needsUpdate = true;
}
function updateStorm(dt) {
  if (!settings.storm) { storm.flash = 0; return; }
  storm.next -= dt;
  if (storm.next <= 0) { storm.flash = 1; storm.queue = Math.random() < .5 ? 1 : 0; storm.next = 6 + Math.random() * 9; thunder(.5 + Math.random()); }
  else if (storm.flash > 0) { storm.flash -= dt * 4; if (storm.flash <= 0) { storm.flash = 0; if (storm.queue) { storm.queue = 0; storm.flash = .8; } } }
  hemi.intensity = WX.storm.hemi + storm.flash * 3.2;
}

// ======================= audio =======================
const audio = { ctx: null, on: settings.sound, o1: null, o2: null, lp: null, eg: null, sq: null, gr: null, wd: null, master: null, tick: 0, noise: null };
function audioInit() {
  if (audio.ctx) { if (audio.ctx.state === 'suspended') audio.ctx.resume(); return; }
  try {
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = new AC(); audio.ctx = ctx;
    const master = ctx.createGain(); master.gain.value = audio.on ? .8 : 0; master.connect(ctx.destination); audio.master = master;
    const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(); o1.type = 'sawtooth'; o2.type = 'square';
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    const eg = ctx.createGain(); eg.gain.value = 0; o1.connect(lp); o2.connect(lp); lp.connect(eg); eg.connect(master); o1.start(); o2.start();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    audio.noise = buf;
    const ns = ctx.createBufferSource(); ns.buffer = buf; ns.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 1.1; const sq = ctx.createGain(); sq.gain.value = 0;
    const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 480; const gr = ctx.createGain(); gr.gain.value = 0;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900; const wd = ctx.createGain(); wd.gain.value = 0;   // wind / rain rush
    ns.connect(bp); bp.connect(sq); sq.connect(master); ns.connect(lp2); lp2.connect(gr); gr.connect(master); ns.connect(hp); hp.connect(wd); wd.connect(master); ns.start();
    Object.assign(audio, { o1, o2, lp, eg, sq, gr, wd });
  } catch (e) { audio.ctx = null; }
}
function beep(freq, dur) {
  if (!audio.ctx || !audio.on) return;
  const ctx = audio.ctx, o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
  o.type = 'sine'; o.frequency.value = freq; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.35, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(audio.master); o.start(t); o.stop(t + dur + .05);
}
function bump(strong) {
  if (!audio.ctx || !audio.on) return;
  const ctx = audio.ctx, o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
  o.type = strong ? 'sawtooth' : 'triangle'; o.frequency.setValueAtTime(strong ? 160 : 120, t); o.frequency.exponentialRampToValueAtTime(40, t + .25); g.gain.setValueAtTime(strong ? .7 : .5, t); g.gain.exponentialRampToValueAtTime(.0001, t + .3);
  o.connect(g); g.connect(audio.master); o.start(t); o.stop(t + .35);
}
function whoosh() {
  if (!audio.ctx || !audio.on) return;
  const ctx = audio.ctx, o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
  o.type = 'sawtooth'; o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(1100, t + .4);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.16, t + .08); g.gain.exponentialRampToValueAtTime(.0001, t + .5);
  o.connect(g); g.connect(audio.master); o.start(t); o.stop(t + .55);
}
function thunder(delay) {
  if (!audio.ctx || !audio.on || !audio.noise) return;
  const ctx = audio.ctx, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t = ctx.currentTime + delay;
  s.buffer = audio.noise; f.type = 'lowpass'; f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(70, t + 1.6);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.9, t + .05); g.gain.exponentialRampToValueAtTime(.0001, t + 1.8);
  s.connect(f); f.connect(g); g.connect(audio.master); s.start(t); s.stop(t + 1.9);
}
const GEARS = [0, 15, 30, 44, 57, 69, 80, 95], NG = GEARS.length - 1;
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
  audio.gr.gain.setTargetAtTime(active && !c.onRoad && c.speed > 4 ? clamp(c.speed * .004, .02, .12) : 0, t, .08);
  audio.wd.gain.setTargetAtTime(active ? clamp((c.speed / 60 - .25) * .1, 0, .12) + (settings.storm ? .035 : 0) : 0, t, .1);
}
function audioSilence() { if (audio.eg) { const t = audio.ctx.currentTime; for (const n of ['eg', 'sq', 'gr', 'wd']) audio[n].gain.setTargetAtTime(0, t, .05); } }
function setSound(on) {
  audio.on = on; settings.sound = on; store.set('sound', on);
  if (audio.master) audio.master.gain.setTargetAtTime(on ? .8 : 0, audio.ctx.currentTime, .05);
  document.querySelectorAll('[data-sound]').forEach(b => { b.classList.toggle('off', !on); b.setAttribute('aria-pressed', String(on)); });
}

// ======================= game state: five cars =======================
const racers = [makeCar('player'), makeCar('ai'), makeCar('ai'), makeCar('ai'), makeCar('ai')];
const player = racers[0];
let vis = [];                    // visuals, same order as racers
let state = 'menu', paused = false, raceT = 0, simT = 0, countT = 0, lastCount = 4, bestTime = store.get('best2', 0), topSpeed = 0;
const finishList = [];
const input = { throttle: 0, brake: 0, steer: 0, hand: false, nitro: false };
const keys = Object.create(null), touchState = { left: false, right: false, gas: false, brake: false, hand: false, nitro: false };
const COAST = { throttle: 0, brake: .35, steer: 0, hand: false, nitro: false };
// rival skill (top-speed scale), preferred lane, cornering grip, how well it reads hazards, how freely it uses nitro
const AI_CFG = [
  { skill: .965, lane: -2, latG: 25, aware: 1.0, nitroUse: .6 },
  { skill: .95, lane: 3, latG: 24, aware: .9, nitroUse: .5 },
  { skill: .935, lane: -4, latG: 24, aware: .8, nitroUse: .45 },
  { skill: .92, lane: 4, latG: 23, aware: .7, nitroUse: .4 }
];
const AICTX = { H: HZ, t: 0, cars: racers };
const GRID = [[4, -5], [4, 5], [6, -5], [6, 5], [8, 0]];   // [samples behind the line, lane]
const PLAYER_SLOT = 2, RIVAL_SLOTS = [0, 1, 3, 4];
const EVT = { pad: false, oil: false, hit: 0, burn: false };

function colorFor(i) { return COLORS[i].hex; }
function rivalColors(playerColor, ids) {
  const used = new Set([playerColor]), out = [];
  for (const id of ids) {
    let c = MODEL_BY[id].nat;
    if (used.has(c)) { c = 0; while (used.has(c)) c++; }
    used.add(c); out.push(c);
  }
  return out;
}
function buildGrid() {          // (re)create the five cars from the cached models
  vis.forEach(disposeCar);
  const mine = settings.car, rivals = MODEL_IDS.filter(id => id !== mine), cols = rivalColors(settings.color, rivals);
  ensureModel(mine); rivals.forEach(ensureModel);
  player.name = 'YOU'; player.model = mine;
  vis = [spawnCar(mine, colorFor(settings.color), 'YOU', true)];
  rivals.forEach((id, k) => { const c = racers[k + 1]; c.name = MODEL_BY[id].rival; c.model = id; c.colorHex = colorFor(cols[k]); vis.push(spawnCar(id, c.colorHex, c.name, false)); });
  player.colorHex = colorFor(settings.color);
  resetRace();
}
function setCar(id) {
  settings.car = id; store.set('car2', id);
  buildGrid(); refreshMenu();
  renderer.compile(scene, camera);   // compile any new shaders now, behind the menu, instead of stuttering at the race start
}
function setPlayerColor(i) {
  settings.color = i; store.set('color2', i);
  if (vis.length) buildGrid();
  document.querySelectorAll('.swatch').forEach((b, k) => { b.classList.toggle('sel', k === i); b.setAttribute('aria-pressed', String(k === i)); });
  setText($('colorName'), COLORS[i].name); $('menu').style.setProperty('--car', colorFor(i));
}
function setWeather(storm2) {
  settings.storm = storm2; store.set('storm', storm2); applyWeather(); refreshMenu();
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
  const sink = c.fallT > 0 ? Math.min(2.6, (1.5 - c.fallT) * 2.2) : 0;
  v.root.position.set(c.x, -sink, c.z); v.root.rotation.y = c.h;
  v.shadow.visible = sink === 0;
  v.tilt.visible = !(c.ghostT > 0) || (((performance.now() / 90) | 0) & 1) === 0;
  const acc = dt > 0 ? (c.vf - v.prevVf) / dt : 0; v.prevVf = c.vf; v.accel += (clamp(acc, -40, 25) - v.accel) * Math.min(1, dt * 6);
  const k = Math.min(1, dt * 8);
  v.pitch += (clamp(-v.accel * .0022, -.07, .06) - v.pitch) * k;
  v.roll += (clamp(-c.yaw * c.vf * .0022, -.08, .08) - v.roll) * k;
  v.tilt.rotation.x = v.pitch; v.tilt.rotation.z = v.roll;
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
  paused = p; $('pause').hidden = !p; if (p) { audioSilence(); for (const k in touchState) touchState[k] = false; }
  setText($('pauseBtnLabel'), p ? 'Resume' : 'Pause');
}
function toast(msg, ms) { const b = $('banner'); b.className = 'banner msg'; setText(b, msg); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); clearTimeout(toast.t); toast.t = setTimeout(() => { if (b._t === msg) { b.className = 'banner'; setText(b, ''); } }, ms || 1800); }
let wake = null;
async function wakeOn() { try { if ('wakeLock' in navigator && !wake && !document.hidden) { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) { wake = null; } }
function wakeOff() { try { if (wake) wake.release(); } catch (e) { /* ignore */ } wake = null; }
function startCountdown() {
  wakeOn(); audioInit(); setSound(settings.sound); resetRace();
  state = 'countdown'; countT = 0; lastCount = 4; camTransit = 1.3; paused = false;
  showSheet(''); setHud(true); document.activeElement && document.activeElement.blur && document.activeElement.blur();
  toast('Camera: ' + CAMS[settings.cam].name + '  (C to change)', 2600);
}
function goMenu() {
  wakeOff(); state = 'menu'; paused = false; resetRace(); camTransit = 1.6; setHud(false); showSheet('menu'); refreshMenu(); audioSilence();
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
  for (let k = 1; k < 5; k++) {      // rubber band: leaders ease off, stragglers push
    const c = racers[k], gap = c.prog - player.prog;
    c.vmaxScale += ((c.base * (1 - clamp(gap / 60, -1, 1) * .05)) - c.vmaxScale) * Math.min(1, dt * .8);
  }
  const wasNitro = player.nitroOn;
  stepCar(player, pin, dt, track, ENV);
  for (let k = 1; k < 5; k++) stepCar(racers[k], aiControl(racers[k], track, dt, AI_CFG[k - 1], AICTX), dt, track, ENV);
  let pHit = false;
  for (let a = 0; a < 5; a++) for (let b = a + 1; b < 5; b++) if (collide(racers[a], racers[b]) && a === 0) pHit = true;
  if (pHit) { if (!simStep.hit) { bump(false); shake = Math.max(shake, .25); } simStep.hit = true; } else simStep.hit = false;
  for (let k = 0; k < 5; k++) {
    const c = racers[k];
    updateTrackState(c, track, false);
    applyHazards(c, HZ, track, simT, EVT);
    if (k === 0) {
      if (EVT.pad) { toast('BOOST!', 900); whoosh(); fovBoost = 1; shake = Math.max(shake, .3); }
      if (EVT.oil) toast('Oil slick!', 1000);
      if (EVT.hit > 2) { bump(true); shake = Math.max(shake, Math.min(1, EVT.hit / 40)); }
      if (EVT.burn) { toast('Lava! Back on the road…', 1600); bump(true); shake = 1; }
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
  if (orbit) {
    const a = t * .22 + .9; tPos.set(c.x + Math.sin(c.h + a) * 9.5, 2.5 + Math.sin(t * .3) * .3, c.z + Math.cos(c.h + a) * 9.5); tLook.set(c.x, .9, c.z);
  } else {
    const fast = mode === 'hood' || mode === 'bumper';
    camH += angDiff(c.h, camH) * (1 - Math.exp(-dt * (fast ? 22 : 6)));
    const fx = Math.sin(camH), fz = Math.cos(camH), cam = MODEL_BY[settings.car].cam;
    if (mode === 'chase') {
      const dist = 8.0 + sf * 2.2 + fovBoost * 1.2;
      tPos.set(c.x - fx * dist, 3.0 + sf * .5, c.z - fz * dist); tLook.set(c.x + fx * 6 - fz * c.steer * 1.2, 1.3, c.z + fz * 6 + fx * c.steer * 1.2); tf = 60 + sf * 18;
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
        tv.pos.set(track.x[idx] + track.nx[idx] * tv.side * (HW + 11), 5.5 + Math.random() * 3, track.z[idx] + track.nz[idx] * tv.side * (HW + 11)); camCut = true;
      }
      tPos.copy(tv.pos); tLook.set(c.x + c.vx * .12, 1.1, c.z + c.vz * .12); tf = 36; hard = true;
    }
  }
  if (camCut) { camPos.copy(tPos); camLook.copy(tPos).lerp(tLook, 1); camTransit = 0; camCut = false; }
  else if (camTransit > 0 && !hard) { camTransit -= dt; const k = 1 - Math.exp(-dt * 4.5); camPos.lerp(tPos, k); camLook.lerp(tLook, k); }
  else { camPos.copy(tPos); if (mode === 'tv' && !orbit) camLook.lerp(tLook, 1 - Math.exp(-dt * 14)); else camLook.copy(tLook); }
  // speed shake (grows with speed, nitro and impacts)
  shake *= Math.exp(-dt * 5);
  const sh = shake * .5 + (sf > .72 ? (sf - .72) * .09 : 0) + fovBoost * .05;
  camera.position.copy(camPos); camera.lookAt(camLook);
  if (sh > .002 && !orbit) camera.position.set(camPos.x + (Math.random() - .5) * sh, camPos.y + (Math.random() - .5) * sh, camPos.z + (Math.random() - .5) * sh);
  fovBoost += ((c.boosting && !orbit ? 1 : 0) - fovBoost) * Math.min(1, dt * 3);
  const target = (orbit ? 60 : tf) + fovBoost * 12;
  fovNow += (target - fovNow) * Math.min(1, dt * 4);
  if (Math.abs(camera.fov - fovNow) > .05) { camera.fov = fovNow; camera.updateProjectionMatrix(); }
}

// ======================= speed lines / lightning overlay =======================
const fxc = { cv: null, g: null, w: 0, h: 0, clear: true };
function initFx() { fxc.cv = $('fx'); fxc.g = fxc.cv.getContext('2d'); resizeFx(); }
function resizeFx() { if (!fxc.cv) return; fxc.w = fxc.cv.width = Math.max(2, Math.ceil(innerWidth / 2)); fxc.h = fxc.cv.height = Math.max(2, Math.ceil(innerHeight / 2)); fxc.clear = true; }
function drawFx(t, on) {
  const g = fxc.g; if (!g) return;
  const sf = clamp(player.speed / PARAMS.vmax, 0, 1.3), inten = on ? clamp((sf - .6) / .4, 0, 1) * .8 + fovBoost * .55 : 0, fl = on ? storm.flash : 0;
  if (inten < .02 && fl < .01) { if (!fxc.clear) { g.clearRect(0, 0, fxc.w, fxc.h); fxc.clear = true; } return; }
  fxc.clear = false; g.clearRect(0, 0, fxc.w, fxc.h);
  const w = fxc.w, h = fxc.h, cx = w / 2, cy = h * .47, R = Math.hypot(w, h) / 2, boost = player.boosting;
  if (inten >= .02) {
    g.lineWidth = 1.6; g.lineCap = 'round';
    for (let i = 0; i < 44; i++) {
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
let miniMap = null, boardRows = [];
function initHud() {
  for (const id of ['spd', 'gear', 'timer', 'bestline', 'lapPill', 'posPill', 'wrong', 'nitroFill', 'board']) el[id] = $(id);
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
  el.board.textContent = ''; boardRows = [];
  for (let i = 0; i < 5; i++) {
    const li = document.createElement('li'), n = document.createElement('b'), d = document.createElement('i'), s2 = document.createElement('span');
    li.append(n, d, s2); el.board.appendChild(li); boardRows.push({ li, n, d, s: s2 });
  }
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
  const pct = clamp(c.prog / track.N, 0, 1);
  setText(el.lapPill, Math.round(pct * 100) + '% · ' + (pct * track.len / 1000).toFixed(1) + '/' + (track.len / 1000).toFixed(1) + ' km');
  setText(el.posPill, 'Position ' + place + '/5'); el.posPill.classList.toggle('lead', place === 1);
  setText(el.timer, fmt(state === 'countdown' ? 0 : raceT));
  setText(el.bestline, bestTime ? 'Best ' + fmt(bestTime) : 'Best —');
  el.nitroFill.style.width = Math.round(c.nitro) + '%'; el.nitroFill.parentNode.classList.toggle('on', c.nitroOn || c.boosting);
  const wrong = state === 'racing' && c.speed > 5 && (c.vx * track.tx[c.idx] + c.vz * track.tz[c.idx]) < -3;
  el.wrong.hidden = !wrong;
  if ((hudTick++ & 1) === 0) {
    for (let i = 0; i < 5; i++) { const rc = ranked[i], row = boardRows[i]; setText(row.n, String(i + 1)); setText(row.s, rc.name); row.d.style.background = rc.colorHex; row.li.classList.toggle('you', rc === player); }
    const g2 = el.mctx, m = miniMap; g2.clearRect(0, 0, el.mini.width, el.mini.height); g2.drawImage(miniBase, 0, 0);
    const dot = (cc, col, rad, ring) => { g2.beginPath(); g2.arc(m.ox + (cc.x - m.minX) * m.s, m.oz + (cc.z - m.minZ) * m.s, rad, 0, 6.2832); g2.fillStyle = col; g2.fill(); g2.lineWidth = ring ? 2 : 1.2; g2.strokeStyle = ring ? '#ffd23a' : '#fff'; g2.stroke(); };
    for (let k = 1; k < 5; k++) dot(racers[k], racers[k].colorHex, 3, false);
    dot(player, player.colorHex, 4.6, true);
  }
}

// ======================= menu =======================
function refreshMenu() {
  setText($('menuBest'), bestTime ? 'Your best time  ' + fmt(bestTime) : 'No race record yet');
  document.querySelectorAll('.caropt').forEach(b => { const on = b.dataset.car === settings.car; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', String(on)); });
  document.querySelectorAll('.wxopt').forEach(b => { const on = (b.dataset.wx === 'storm') === settings.storm; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', String(on)); });
  const m = MODEL_BY[settings.car]; setText($('carBlurb'), m.name + ' — ' + m.tag + ' · rivals: ' + MODEL_LIST.filter(x => x.id !== settings.car).map(x => x.rival).join(', '));
  const ag = $('autoGas'); if (ag) { ag.classList.toggle('sel', settings.autoGas); ag.setAttribute('aria-pressed', String(settings.autoGas)); }
}
function initMenu() {
  const wrap = $('swatches');
  COLORS.forEach((c, i) => {
    const b = document.createElement('button'); b.className = 'swatch'; b.style.setProperty('--c', c.hex); b.setAttribute('aria-label', c.name); b.type = 'button';
    b.addEventListener('click', () => setPlayerColor(i)); wrap.appendChild(b);
  });
  const seg = $('carSeg');
  MODEL_LIST.forEach(m => {
    const b = document.createElement('button'); b.className = 'caropt'; b.dataset.car = m.id; b.type = 'button'; b.textContent = m.name;
    b.addEventListener('click', () => { if (m.id !== settings.car) setCar(m.id); }); seg.appendChild(b);
  });
  document.querySelectorAll('.wxopt').forEach(b => b.addEventListener('click', () => setWeather(b.dataset.wx === 'storm')));
  if (isTouch) { $('autoGasRow').hidden = false; $('autoGas').addEventListener('click', () => { settings.autoGas = !settings.autoGas; store.set('autoGas', settings.autoGas); refreshMenu(); }); }
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
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  document.documentElement.classList.toggle('portrait', h > w); resizeFx();
}
addEventListener('resize', resize);
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
      if (avg > 20.5 && dpr > .75) { dprCeil = Math.max(.75, dpr - .1); dpr = Math.max(.75, dpr - (avg > 28 ? .25 : .15)); renderer.setPixelRatio(dpr); resize(); warm = 0; }
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
  const dtv = paused ? 0 : raw;
  for (let k = 0; k < 5; k++) applyVisuals(racers[k], vis[k], dtv || .0001);
  if (running) {
    for (let k = 0; k < 5; k++) {
      const c = racers[k];
      if (Math.abs(c.x - camPos.x) + Math.abs(c.z - camPos.z) > 160) continue;   // no particles for cars far from the camera
      const fx = Math.sin(c.h), fz = Math.cos(c.h), rx = -fz, rz = fx;
      if ((c.drifting || (c.braking && c.vf > 25) || (!c.onRoad && c.speed > 8)) && Math.random() < .4) {
        const kind = c.onRoad ? 0 : 1;
        emitSmoke(c.x - fx * 1.5 + rx * 0.85, .3, c.z - fz * 1.5 + rz * 0.85, kind);
        emitSmoke(c.x - fx * 1.5 - rx * 0.85, .3, c.z - fz * 1.5 - rz * 0.85, kind);
      }
      if (c.boosting && Math.random() < .8) { emitSmoke(c.x - fx * 2.5 + rx * .45, .5, c.z - fz * 2.5 + rz * .45, 3); emitSmoke(c.x - fx * 2.5 - rx * .45, .5, c.z - fz * 2.5 - rz * .45, 3); }
      if (c.fallT > 0 && Math.random() < .8) emitSmoke(c.x, .2, c.z, 2);
    }
    updateHud(); audioUpdate(player, true);
  }
  updateCamera(raw, now / 1000);
  if (state === 'menu') return;   // the full-screen menu covers the scene: don't spend battery rendering it
  const tags = !(state !== 'result' && (CAMS[settings.cam].id === 'hood' || CAMS[settings.cam].id === 'bumper'));
  for (let k = 0; k < 5; k++) { const v = vis[k], c = racers[k]; v.tag.visible = k === 0 ? tags : (Math.abs(c.x - camPos.x) + Math.abs(c.z - camPos.z) < 260); }
  updateSmoke(dtv); updateScenery(dtv, simT); updateStorm(dtv); updateRain(dtv); drawFx(now / 1000, running);
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
  await bootStep(10, 'Building your car…');
  buildShadowAssets(); ensureModel(settings.car);   // heavy part: runs once, then each car is cached and cloned
  const rest = MODEL_IDS.filter(id => id !== settings.car);
  for (let i = 0; i < rest.length; i++) { await bootStep(18 + i * 13, 'Building rival ' + (i + 1) + ' of 4…'); ensureModel(rest[i]); }
  await bootStep(74, 'Laying the track and hazards…');
  buildTrackVisuals(track); initSmoke(); initRain(); initFx();
  await bootStep(86, 'Painting and fuelling up…');
  initMenu(); initHud(); resize(); applyWeather();
  buildGrid(); camPos.set(player.x + 8, 3, player.z - 8); camLook.set(player.x, .9, player.z);
  setPlayerColor(settings.color); setSound(settings.sound); refreshMenu(); setCamera(settings.cam); toast.t = 0; $('banner').className = 'banner'; setText($('banner'), '');
  await bootStep(94, 'Warming up the engines…');
  renderer.compile(scene, camera);
  await bootStep(100, 'Ready to race');
  window.__tdBooted = true;
  if (location.hash === '#debug') window.__td = { scene, camera, renderer, racers, track, HZ, get vis() { return vis; }, get state() { return state; }, setCar, startCountdown, setCamera, setWeather, simStep, settings, frameNow: frame };
  showSheet('menu');
  bootUi.root.classList.add('done');
  setTimeout(() => { bootUi.root.hidden = true; }, 500);
  requestAnimationFrame(t => { last = t; frame(t); });
}
boot().catch(err => {
  console.error(err); bootUi.root.hidden = false; bootUi.root.classList.add('err');
  bootUi.msg.textContent = 'The game could not start. Please reload the page. (' + (err && err.message ? err.message : err) + ')';
});
