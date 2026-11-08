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
const ordinal = ['', '1st', '2nd'];

const COLORS = [
  { hex: '#c91420', name: 'Rosso Corsa Red' },
  { hex: '#f0b323', name: 'Sunshine Yellow' },
  { hex: '#252b2d', name: 'Carbon Black' },
  { hex: '#2d5ea8', name: 'Deep Blue' },
  { hex: '#d8d6cc', name: 'Silver' }
];
const MODEL_IDS = ['rosso', 'civic'];
const settings = {
  color: Math.min(store.get('color', 0), COLORS.length - 1), laps: store.get('laps', 3),
  car: MODEL_IDS.includes(store.get('car', 'rosso')) ? store.get('car', 'rosso') : 'rosso', sound: store.get('sound', true), autoGas: store.get('autoGas', false)
};

// ======================= renderer / scene =======================
const canvas = $('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !isTouch, powerPreference: 'high-performance' });
let dprMax = Math.min(window.devicePixelRatio || 1, isTouch ? 1.5 : 2), dpr = dprMax, dprCeil = dprMax;
renderer.setPixelRatio(dpr);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, 1, 1, 2400);
function makeSky() {
  const c = document.createElement('canvas'); c.width = 2; c.height = 256;
  const g = c.getContext('2d'), grad = g.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#6fa9d6'); grad.addColorStop(0.55, '#b9d9e6'); grad.addColorStop(1, '#e3eee2');
  g.fillStyle = grad; g.fillRect(0, 0, 2, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
scene.background = makeSky();
scene.fog = new THREE.Fog('#d4e6dc', 160, 1100);
scene.add(new THREE.HemisphereLight('#ffffff', '#86a06c', 1.15));
const sun = new THREE.DirectionalLight('#fff3d9', 2.3); sun.position.set(-180, 260, 120); scene.add(sun);
{
  const pm = new THREE.PMREMGenerator(renderer), room = new RoomEnvironment();
  scene.environment = pm.fromScene(room, 0.04).texture; scene.environmentIntensity = 0.55;
  room.dispose(); pm.dispose();
}

// ======================= car: built ONCE, cached, cloned =======================
const CAR_SCALE = 0.82;
const CAR = { shadowGeo: null, shadowMat: null };
const MODELS = { rosso: null, civic: null };   // cached templates: {template, mats, paintKeys, wr (wheel radius, world m), name}
const MODEL_LIST = [{ id: 'rosso', name: 'Rosso GT' }, { id: 'civic', name: 'Civic Sedan' }];
/*CIVIC*/

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

function buildCarTemplate() {
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
function spawnCar(id, colorHex) {
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
  scene.add(root);
  const v = { id, root, tilt, pm, tail, tailBase: M.tailBase, tailBrake: M.tailBrake, wr: M.wr, wheels, wheelAngle: 0, pitch: 0, roll: 0, prevVf: 0, accel: 0 };
  setCarColor(v, colorHex);
  return v;
}
function disposeCar(v) {   // only per-car materials are disposed; geometry/templates stay cached
  scene.remove(v.root);
  for (const k in v.pm) v.pm[k].dispose(); v.tail.dispose();
}

// ---- Civic: build once with the original model code, then bake it into a few merged meshes ----
const CIVIC_SCALE = 1.0;
function buildCivicTemplate() {
  const civic = createHondaCivic({ color: '#c91420' });
  civic.setLights(true);
  const root = civic.root; root.updateMatrixWorld(true);
  const byMat = new Map(); for (const k in civic.materials) byMat.set(civic.materials[k], k);
  const pivots = civic.allPivots, spinOf = p => p.children.find(c => c.isGroup);
  const spins = new Set(pivots.map(spinOf)), pivSet = new Set(pivots);
  const inside = (o, set) => { for (let p = o.parent; p; p = p.parent) if (set.has(p)) return p; return null; };
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
    root.traverse(o => { if (!o.isMesh || !o.visible || !filter(o)) return; if (!out.has(o.material)) out.set(o.material, []); out.get(o.material).push(bake(o, refInv)); });
    return out;
  };
  const meshesFrom = (groups, parent) => {
    let i = 0;
    groups.forEach((list, mat) => { const geo = mergeGeometries(list, false); list.forEach(g => g.dispose()); if (!geo) return;
      const me = new THREE.Mesh(geo, mat); me.userData.mk = byMat.get(mat) || ('m' + (i++)); parent.add(me); });
  };
  const model = new THREE.Group(); model.name = 'model'; model.rotation.y = -Math.PI / 2; model.scale.setScalar(CIVIC_SCALE);
  const shell = new THREE.Group(); model.add(shell);
  const I = new THREE.Matrix4();
  meshesFrom(collect(o => !inside(o, pivSet), I), shell);
  // one wheel set per side (left z>0, right z<0), shared by the two wheels of that side
  const byName = n => pivots.find(p => p.name === n);
  const sets = {};
  for (const [side, pv] of [['L', byName('Wheel_FL_Pivot')], ['R', byName('Wheel_FR_Pivot')]]) {
    const sp = spinOf(pv), sInv = sp.matrixWorld.clone().invert(), pInv = pv.matrixWorld.clone().invert();
    const spin = new THREE.Group(), stat = new THREE.Group();
    meshesFrom(collect(o => inside(o, spins) === sp, sInv), spin);
    meshesFrom(collect(o => inside(o, pivSet) === pv && !inside(o, spins), pInv), stat);
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
  root.traverse(o => { if (o.isSprite) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } else if (o.isMesh && o.geometry) o.geometry.dispose(); });
  const cm = civic.materials; cm.tail.emissiveIntensity = 1.3;
  MODELS.civic = { template: model, mats: { paint: cm.paint, paintCap: cm.paintCap, roof: cm.roof, paintDeep: cm.paintDeep, tail: cm.tail },
    paintKeys: ['paint', 'paintCap', 'roof', 'paintDeep'], wr: .335 * CIVIC_SCALE, flipRight: false, tailBase: 1.3, tailBrake: 4.2, name: 'Civic Sedan' };
}

// ======================= track visuals =======================
const track = buildTrack();
function buildTrackVisuals(tr) {
  const N = tr.N, pos = [], col = [], ind = [], nor = [], c = new THREE.Color(); let vi = 0;
  const quad = (i, a, b, y, hex) => {
    const j = (i + 1) % N; c.set(hex);
    const pts = [[tr.x[i] + tr.nx[i] * a, tr.z[i] + tr.nz[i] * a], [tr.x[i] + tr.nx[i] * b, tr.z[i] + tr.nz[i] * b], [tr.x[j] + tr.nx[j] * b, tr.z[j] + tr.nz[j] * b], [tr.x[j] + tr.nx[j] * a, tr.z[j] + tr.nz[j] * a]];
    for (const p of pts) { pos.push(p[0], y, p[1]); col.push(c.r, c.g, c.b); nor.push(0, 1, 0); }
    ind.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3); vi += 4;
  };
  const hw = tr.width / 2;
  for (let i = 0; i < N; i++) {
    quad(i, -hw, hw, 0, (i >> 3) & 1 ? '#3d4245' : '#383d40');
    quad(i, -hw - 1.5, -hw, .05, ((i / 2) | 0) % 2 ? '#c9212c' : '#f1efe6');
    quad(i, hw, hw + 1.5, .05, ((i / 2) | 0) % 2 ? '#c9212c' : '#f1efe6');
    if ((i >> 1) % 2 === 0) quad(i, -.18, .18, .06, '#e9e7d8');
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(ind); g.computeBoundingSphere();
  scene.add(new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true })));

  // grass with tiling noise (gives a strong sense of speed)
  const gc = document.createElement('canvas'); gc.width = gc.height = 128; const gx = gc.getContext('2d');
  gx.fillStyle = '#86b06a'; gx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 420; i++) { gx.fillStyle = Math.random() < .5 ? 'rgba(60,110,50,.22)' : 'rgba(170,205,120,.2)'; const s = 3 + Math.random() * 9; gx.fillRect(Math.random() * 128, Math.random() * 128, s, s); }
  const gt = new THREE.CanvasTexture(gc); gt.colorSpace = THREE.SRGBColorSpace; gt.wrapS = gt.wrapT = THREE.RepeatWrapping; gt.repeat.set(260, 260); gt.anisotropy = 4;
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2600, 2600), new THREE.MeshLambertMaterial({ map: gt }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -.15; scene.add(ground);

  // start / finish line + gantry
  const h0 = tr.heading[0], sx = tr.x[0], sz = tr.z[0];
  const cc = document.createElement('canvas'); cc.width = 128; cc.height = 32; const cx = cc.getContext('2d');
  for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) { cx.fillStyle = (x + y) % 2 ? '#101412' : '#f4f3ea'; cx.fillRect(x * 8, y * 8, 8, 8); }
  const ct = new THREE.CanvasTexture(cc); ct.colorSpace = THREE.SRGBColorSpace; ct.magFilter = THREE.NearestFilter;
  const line = new THREE.Mesh(new THREE.PlaneGeometry(tr.width, 2.4), new THREE.MeshBasicMaterial({ map: ct, toneMapped: false }));
  line.rotation.order = 'YXZ'; line.rotation.set(-Math.PI / 2, h0, 0); line.position.set(sx, .09, sz); scene.add(line);
  const gantry = new THREE.Group(); gantry.position.set(sx, 0, sz); gantry.rotation.y = h0; scene.add(gantry);
  const post = new THREE.MeshLambertMaterial({ color: '#cfd6cc' });
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(.8, 8, .8), post); p.position.set(s * (hw + 2.2), 4, 0); gantry.add(p); }
  const bc = document.createElement('canvas'); bc.width = 512; bc.height = 96; const bx = bc.getContext('2d');
  bx.fillStyle = '#c91420'; bx.fillRect(0, 0, 512, 96); bx.fillStyle = '#fff'; bx.font = '800 52px Manrope, Arial, sans-serif'; bx.textAlign = 'center'; bx.textBaseline = 'middle'; bx.fillText('MINI CAR RACE', 256, 52);
  const bt = new THREE.CanvasTexture(bc); bt.colorSpace = THREE.SRGBColorSpace;
  // two single-sided planes (one per direction) so the text reads correctly from both sides, not mirrored on the back
  const bannerGeo = new THREE.PlaneGeometry(hw * 2 + 4.4, 3.2), bannerMat = new THREE.MeshBasicMaterial({ map: bt, toneMapped: false });
  for (const [ry, dz] of [[0, .02], [Math.PI, -.02]]) { const banner = new THREE.Mesh(bannerGeo, bannerMat); banner.position.set(0, 7.2, dz); banner.rotation.y = ry; gantry.add(banner); }

  // trees (one instanced mesh) and mountains (one instanced mesh)
  const trunk = new THREE.CylinderGeometry(.25, .38, 2.2, 5); trunk.translate(0, 1.1, 0);
  const crown = new THREE.ConeGeometry(2.1, 6.2, 6); crown.translate(0, 5, 0);
  const paintGeo = (geo, hex) => { const n = geo.toNonIndexed(); const cl = new THREE.Color(hex), a = []; for (let i = 0; i < n.attributes.position.count; i++) a.push(cl.r, cl.g, cl.b); n.setAttribute('color', new THREE.Float32BufferAttribute(a, 3)); n.deleteAttribute('uv'); return n; };
  const treeGeo = mergeGeometries([paintGeo(trunk, '#6b4a2e'), paintGeo(crown, '#3f7a45')], false);
  const TREES = 280, trees = new THREE.InstancedMesh(treeGeo, new THREE.MeshLambertMaterial({ vertexColors: true }), TREES);
  const dummy = new THREE.Object3D(), tc = new THREE.Color(); let placed = 0, tries = 0;
  while (placed < TREES && tries++ < 6000) {
    const x = (Math.random() - .5) * 1500, z = (Math.random() - .5) * 1300 - 330;
    let d = 1e9; for (let i = 0; i < N; i += 3) { const dd = (x - tr.x[i]) ** 2 + (z - tr.z[i]) ** 2; if (dd < d) d = dd; }
    if (d < (hw + 16) ** 2) continue;
    dummy.position.set(x, -.1, z); const s = .8 + Math.random() * 1.1; dummy.scale.set(s, s * (.9 + Math.random() * .5), s); dummy.rotation.y = Math.random() * 6; dummy.updateMatrix();
    trees.setMatrixAt(placed, dummy.matrix); tc.setRGB(.78 + Math.random() * .22, .86 + Math.random() * .14, .78 + Math.random() * .22); trees.setColorAt(placed, tc); placed++;
  }
  trees.count = placed; trees.instanceMatrix.needsUpdate = true; if (trees.instanceColor) trees.instanceColor.needsUpdate = true; scene.add(trees);
  const mt = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 5), new THREE.MeshLambertMaterial({ color: '#8aa3a0' }), 26);
  for (let i = 0; i < 26; i++) {
    const a = i / 26 * Math.PI * 2 + Math.random() * .2, r = 1150 + Math.random() * 120, h = 130 + Math.random() * 190, w = 170 + Math.random() * 150;
    dummy.position.set(Math.cos(a) * r, h / 2 - 8, Math.sin(a) * r - 330); dummy.scale.set(w, h, w); dummy.rotation.y = Math.random() * 3; dummy.updateMatrix(); mt.setMatrixAt(i, dummy.matrix);
  }
  mt.frustumCulled = false; scene.add(mt);
}

// ======================= smoke / dust particles (pooled) =======================
const SMOKE_N = 90;
const smoke = { pos: new Float32Array(SMOKE_N * 3), col: new Float32Array(SMOKE_N * 4), vel: new Float32Array(SMOKE_N * 3), life: new Float32Array(SMOKE_N), head: 0, points: null };
function initSmoke() {
  const sc = document.createElement('canvas'); sc.width = sc.height = 64; const g = sc.getContext('2d'), rg = g.createRadialGradient(32, 32, 2, 32, 32, 32);
  rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, 64, 64);
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(smoke.pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(smoke.col, 4));
  for (let i = 0; i < SMOKE_N; i++) smoke.pos[i * 3 + 1] = -50;
  smoke.points = new THREE.Points(geo, new THREE.PointsMaterial({ map: new THREE.CanvasTexture(sc), size: 3.2, vertexColors: true, transparent: true, depthWrite: false, sizeAttenuation: true }));
  smoke.points.frustumCulled = false; scene.add(smoke.points);
}
function emitSmoke(x, y, z, grass) {
  const i = smoke.head; smoke.head = (smoke.head + 1) % SMOKE_N;
  smoke.pos[i * 3] = x + (Math.random() - .5) * .6; smoke.pos[i * 3 + 1] = y; smoke.pos[i * 3 + 2] = z + (Math.random() - .5) * .6;
  smoke.vel[i * 3] = (Math.random() - .5) * 1.2; smoke.vel[i * 3 + 1] = .8 + Math.random() * .8; smoke.vel[i * 3 + 2] = (Math.random() - .5) * 1.2;
  smoke.life[i] = 1; smoke.col[i * 4] = grass ? .62 : .92; smoke.col[i * 4 + 1] = grass ? .55 : .93; smoke.col[i * 4 + 2] = grass ? .38 : .92; smoke.col[i * 4 + 3] = .5;
}
function updateSmoke(dt) {
  for (let i = 0; i < SMOKE_N; i++) {
    if (smoke.life[i] <= 0) continue;
    smoke.life[i] -= dt * 1.1;
    if (smoke.life[i] <= 0) { smoke.pos[i * 3 + 1] = -50; smoke.col[i * 4 + 3] = 0; continue; }
    smoke.pos[i * 3] += smoke.vel[i * 3] * dt; smoke.pos[i * 3 + 1] += smoke.vel[i * 3 + 1] * dt; smoke.pos[i * 3 + 2] += smoke.vel[i * 3 + 2] * dt;
    smoke.col[i * 4 + 3] = smoke.life[i] * .5;
  }
  smoke.points.geometry.attributes.position.needsUpdate = true; smoke.points.geometry.attributes.color.needsUpdate = true;
}

// ======================= audio =======================
const audio = { ctx: null, on: settings.sound, o1: null, o2: null, lp: null, eg: null, sq: null, gr: null, master: null, tick: 0 };
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
    const ns = ctx.createBufferSource(); ns.buffer = buf; ns.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1700; bp.Q.value = 1.1; const sq = ctx.createGain(); sq.gain.value = 0;
    const lp2 = ctx.createBiquadFilter(); lp2.type = 'lowpass'; lp2.frequency.value = 480; const gr = ctx.createGain(); gr.gain.value = 0;
    ns.connect(bp); bp.connect(sq); sq.connect(master); ns.connect(lp2); lp2.connect(gr); gr.connect(master); ns.start();
    Object.assign(audio, { o1, o2, lp, eg, sq, gr });
  } catch (e) { audio.ctx = null; }
}
function beep(freq, dur) {
  if (!audio.ctx || !audio.on) return;
  const ctx = audio.ctx, o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
  o.type = 'sine'; o.frequency.value = freq; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.35, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g); g.connect(audio.master); o.start(t); o.stop(t + dur + .05);
}
function bump() {
  if (!audio.ctx || !audio.on) return;
  const ctx = audio.ctx, o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime;
  o.type = 'triangle'; o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(40, t + .25); g.gain.setValueAtTime(.5, t); g.gain.exponentialRampToValueAtTime(.0001, t + .3);
  o.connect(g); g.connect(audio.master); o.start(t); o.stop(t + .35);
}
const GEARS = [0, 14, 27, 39, 49, 58, 70];
function audioUpdate(c, active) {
  if (!audio.ctx || !audio.eg) return;
  if ((audio.tick++ % 3) !== 0) return;
  const t = audio.ctx.currentTime, sp = Math.abs(c.vf);
  let g = 1; while (g < 6 && sp > GEARS[g] - 1.5) g++;
  const r = clamp((sp - GEARS[g - 1] * (g > 1 ? .8 : 0)) / (GEARS[g] - GEARS[g - 1] * (g > 1 ? .8 : 0)), 0.04, 1);
  const f = 48 + r * 92 + c.throttleLevel * 14;
  audio.o1.frequency.setTargetAtTime(f, t, .05); audio.o2.frequency.setTargetAtTime(f * .5, t, .05);
  audio.lp.frequency.setTargetAtTime(380 + r * 900 + c.throttleLevel * 500, t, .08);
  audio.eg.gain.setTargetAtTime(active ? .05 + .07 * c.throttleLevel + .03 * r : 0, t, .08);
  audio.sq.gain.setTargetAtTime(active && (c.drifting || (c.braking && c.vf > 22)) ? clamp(Math.abs(c.vl) * .012 + (c.braking ? .03 : 0), .02, .11) : 0, t, .06);
  audio.gr.gain.setTargetAtTime(active && !c.onRoad && c.speed > 4 ? clamp(c.speed * .004, .02, .12) : 0, t, .08);
}
function audioSilence() { if (audio.eg) { const t = audio.ctx.currentTime; audio.eg.gain.setTargetAtTime(0, t, .05); audio.sq.gain.setTargetAtTime(0, t, .05); audio.gr.gain.setTargetAtTime(0, t, .05); } }
function setSound(on) {
  audio.on = on; settings.sound = on; store.set('sound', on);
  if (audio.master) audio.master.gain.setTargetAtTime(on ? .8 : 0, audio.ctx.currentTime, .05);
  document.querySelectorAll('[data-sound]').forEach(b => { b.classList.toggle('off', !on); b.setAttribute('aria-pressed', String(on)); });
}

// ======================= game state =======================
const player = makeCar('player'), rival = makeCar('ai');
let pv = null, rv = null; // visuals
let state = 'menu', paused = false, raceT = 0, countT = 0, lastCount = 4, bestLap = store.get('best', 0);
const input = { throttle: 0, brake: 0, steer: 0, hand: false };
const keys = Object.create(null), touchState = { left: false, right: false, gas: false, brake: false, hand: false };
const COAST = { throttle: 0, brake: .35, steer: 0, hand: false };
const AI_OPTS = { lane: 3, latG: 24 };
const camPos = new THREE.Vector3(), camLook = new THREE.Vector3(), tPos = new THREE.Vector3(), tLook = new THREE.Vector3();
let camH = 0, camTransit = 0, fovNow = 60, shownPos = 0;

function otherModel(id) { return id === 'rosso' ? 'civic' : 'rosso'; }
function setCar(id) {            // swap cars from the cached templates: no geometry is rebuilt
  settings.car = id; store.set('car', id);
  disposeCar(pv); disposeCar(rv);
  pv = spawnCar(id, colorFor(settings.color)); rv = spawnCar(otherModel(id), colorFor((settings.color + 2) % COLORS.length));
  resetRace(); refreshMenu();
}
function colorFor(i) { return COLORS[i].hex; }
function setPlayerColor(i) {
  settings.color = i; store.set('color', i); setCarColor(pv, colorFor(i)); setCarColor(rv, colorFor((i + 2) % COLORS.length));
  document.querySelectorAll('.swatch').forEach((b, k) => { b.classList.toggle('sel', k === i); b.setAttribute('aria-pressed', String(k === i)); });
  setText($('colorName'), COLORS[i].name); $('menu').style.setProperty('--car', colorFor(i));
}
function resetRace() {
  placeOnTrack(player, track, track.N - 6, -3.5); placeOnTrack(rival, track, track.N - 9, 3.5);
  for (const c of [player, rival]) { c.lapsDone = 0; c.lapStart = 0; c.lapTimes = []; c.finished = false; c.finishTime = 0; c.throttleLevel = 0; c.stuck = 0; }
  rival.vmaxScale = .92; raceT = 0; pv.prevVf = rv.prevVf = 0;
  camH = player.h; applyVisuals(player, pv, 0.016); applyVisuals(rival, rv, 0.016);
}
function applyVisuals(c, v, dt) {
  v.root.position.set(c.x, 0, c.z); v.root.rotation.y = c.h;
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
const KEYMAP = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'hand', ShiftLeft: 'hand' };
addEventListener('keydown', e => {
  if (e.code === 'Escape' || e.code === 'KeyP') { if (state === 'racing' || state === 'countdown') setPaused(!paused); return; }
  if (e.code === 'KeyR' && (state === 'racing')) { respawn(); return; }
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
function respawn() {
  const lapBase = Math.floor(player.total / track.N) * track.N, i = player.idx;
  placeOnTrack(player, track, i, 0); player.total = lapBase + i; player.prog = player.total; updateTrackState(player, track, false);
}

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
}
function goMenu() {
  wakeOff(); state = 'menu'; paused = false; resetRace(); camTransit = 1.6; setHud(false); showSheet('menu'); refreshMenu(); audioSilence();
}
function finishRace() {
  state = 'finished'; player.finished = true; player.finishTime = raceT; camTransit = 1.6;
  const rivalFirst = rival.finished && rival.finishTime < player.finishTime, place = rivalFirst ? 2 : 1;
  setText($('resTitle'), ordinal[place] + ' place' + (place === 1 ? ' — nice driving!' : ''));
  setText($('resTotal'), fmt(player.finishTime)); setText($('resBest'), fmt(Math.min.apply(null, player.lapTimes)));
  const ul = $('resLaps'); ul.textContent = '';
  player.lapTimes.forEach((t, i) => { const li = document.createElement('li'), a = document.createElement('span'), b = document.createElement('b'); a.textContent = 'Lap ' + (i + 1); b.textContent = fmt(t); b.dir = 'ltr'; li.append(a, b); ul.appendChild(li); });
  setTimeout(() => { if (state === 'finished') { state = 'result'; wakeOff(); camTransit = 1.6; setHud(false); showSheet('result'); audioSilence(); } }, 1400);
  toast('Race complete!', 1500);
}

function simStep(dt) {
  if (state === 'countdown') {
    countT += dt; const n = Math.ceil(3 - countT + 1e-6);
    if (countT >= 3) { state = 'racing'; raceT = 0; toast('GO!', 900); beep(880, .5); }
    else if (n !== lastCount) { lastCount = n; const b = $('banner'); b.className = 'banner count'; setText(b, String(n)); b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); beep(440, .25); }
    return;
  }
  raceT += dt;
  const pin = state === 'racing' ? readInput() : COAST;
  const gap = rival.prog - player.prog;
  rival.vmaxScale += ((.92 - clamp(gap / 40, -1, 1) * .05) - rival.vmaxScale) * Math.min(1, dt * .8);
  stepCar(player, pin, dt, track);
  stepCar(rival, aiControl(rival, track, dt, AI_OPTS), dt, track);
  if (collide(player, rival)) { if (!simStep.hit) bump(); simStep.hit = true; } else simStep.hit = false;
  updateTrackState(player, track, false); updateTrackState(rival, track, false);
  for (const c of [player, rival]) {
    if (updateLaps(c, track, raceT)) {
      if (c === player && !c.finished) {
        const isBest = !bestLap || c.lastLapTime < bestLap;
        if (c.lapsDone >= settings.laps) { if (isBest) { bestLap = c.lastLapTime; store.set('best', bestLap); } finishRace(); }
        else { if (isBest) { bestLap = c.lastLapTime; store.set('best', bestLap); toast('New best lap ' + fmt(c.lastLapTime), 2200); } else toast('Lap ' + c.lapsDone + ' — ' + fmt(c.lastLapTime), 1800); }
      }
      if (c === rival && c.lapsDone >= settings.laps && !c.finished) { c.finished = true; c.finishTime = raceT; }
    }
  }
}
simStep.hit = false;

// ======================= camera =======================
function updateCamera(dt, t) {
  const c = player, orbit = state === 'menu' || state === 'result';
  if (orbit) {
    const a = t * .22 + .9; tPos.set(c.x + Math.sin(c.h + a) * 9.5, 2.5 + Math.sin(t * .3) * .3, c.z + Math.cos(c.h + a) * 9.5); tLook.set(c.x, .9, c.z);
  } else {
    camH += angDiff(c.h, camH) * (1 - Math.exp(-dt * 6));
    const fx = Math.sin(camH), fz = Math.cos(camH), sf = clamp(c.speed / 64, 0, 1), dist = 8.4 + sf * 1.3;
    tPos.set(c.x - fx * dist, 3.0 + sf * .5, c.z - fz * dist); tLook.set(c.x + fx * 6, 1.3, c.z + fz * 6);
  }
  if (camTransit > 0) { camTransit -= dt; const k = 1 - Math.exp(-dt * 4.5); camPos.lerp(tPos, k); camLook.lerp(tLook, k); }
  else { camPos.copy(tPos); camLook.copy(tLook); }
  camera.position.copy(camPos); camera.lookAt(camLook);
  const tf = 60 + (orbit ? 0 : clamp(c.speed / 64, 0, 1) * 16);
  fovNow += (tf - fovNow) * Math.min(1, dt * 4);
  if (Math.abs(camera.fov - fovNow) > .05) { camera.fov = fovNow; camera.updateProjectionMatrix(); }
}

// ======================= HUD =======================
const el = {};
const miniBase = document.createElement('canvas');
let miniMap = null;
function initHud() {
  for (const id of ['spd', 'gear', 'timer', 'bestline', 'lapPill', 'posPill', 'wrong']) el[id] = $(id);
  el.rpm = [...document.querySelectorAll('#rpm i')]; el.mini = $('mini'); el.mctx = el.mini.getContext('2d');
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9;
  for (let i = 0; i < track.N; i++) { minX = Math.min(minX, track.x[i]); maxX = Math.max(maxX, track.x[i]); minZ = Math.min(minZ, track.z[i]); maxZ = Math.max(maxZ, track.z[i]); }
  const W = el.mini.width, H = el.mini.height, pad = 10, s = Math.min((W - pad * 2) / (maxX - minX), (H - pad * 2) / (maxZ - minZ));
  const ox = (W - (maxX - minX) * s) / 2, oz = (H - (maxZ - minZ) * s) / 2;
  miniMap = { s, ox, oz, minX, minZ };
  miniBase.width = W; miniBase.height = H; const g = miniBase.getContext('2d');
  g.lineJoin = 'round'; g.lineCap = 'round';
  const path = () => { g.beginPath(); for (let i = 0; i <= track.N; i += 3) { const k = i % track.N; const x = ox + (track.x[k] - minX) * s, y = oz + (track.z[k] - minZ) * s; i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); };
  g.strokeStyle = 'rgba(29,53,36,.28)'; g.lineWidth = 8; path(); g.stroke();
  g.strokeStyle = '#f7faf4'; g.lineWidth = 4.5; path(); g.stroke();
  g.fillStyle = '#1d3524'; g.fillRect(ox + (track.x[0] - minX) * s - 1.5, oz + (track.z[0] - minZ) * s - 4, 3, 8);
}
let hudTick = 0;
function updateHud() {
  const c = player;
  setText(el.spd, String(Math.round(c.speed * 3.6)));
  const sp = Math.abs(c.vf); let g = 1; while (g < 6 && sp > GEARS[g] - 1.5) g++;
  const lo = g > 1 ? GEARS[g - 1] * .8 : 0, r = clamp((sp - lo) / (GEARS[g] - lo), 0, 1), on = Math.round(r * el.rpm.length);
  setText(el.gear, c.vf < -0.5 ? 'R' : String(g));
  if (el.rpm._on !== on) { el.rpm._on = on; el.rpm.forEach((s, i) => s.classList.toggle('on', i < on)); el.rpm.forEach((s, i) => s.classList.toggle('hot', i >= 9)); }
  const lapNow = Math.min(c.lapsDone + 1, settings.laps);
  setText(el.lapPill, 'Lap ' + lapNow + '/' + settings.laps);
  const place = player.prog >= rival.prog ? 1 : 2; setText(el.posPill, 'Position ' + place + '/2');
  el.posPill.classList.toggle('lead', place === 1);
  setText(el.timer, fmt(state === 'countdown' ? 0 : Math.max(0, raceT - c.lapStart)));
  setText(el.bestline, bestLap ? 'Best ' + fmt(bestLap) : 'Best —');
  const wrong = state === 'racing' && c.speed > 5 && (c.vx * track.tx[c.idx] + c.vz * track.tz[c.idx]) < -3;
  el.wrong.hidden = !wrong;
  if ((hudTick++ & 1) === 0) {
    const g2 = el.mctx, m = miniMap; g2.clearRect(0, 0, el.mini.width, el.mini.height); g2.drawImage(miniBase, 0, 0);
    const dot = (cc, col, rad) => { g2.beginPath(); g2.arc(m.ox + (cc.x - m.minX) * m.s, m.oz + (cc.z - m.minZ) * m.s, rad, 0, 6.2832); g2.fillStyle = col; g2.fill(); g2.lineWidth = 1.5; g2.strokeStyle = '#fff'; g2.stroke(); };
    dot(rival, '#2d5ea8', 3.6); dot(player, '#c91420', 4.4);
  }
}

// ======================= menu =======================
function refreshMenu() {
  setText($('menuBest'), bestLap ? 'Your best lap  ' + fmt(bestLap) : 'No lap record yet');
  document.querySelectorAll('.caropt').forEach(b => { const on = b.dataset.car === settings.car; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', String(on)); });
  document.querySelectorAll('.lapopt').forEach(b => { const on = Number(b.dataset.laps) === settings.laps; b.classList.toggle('sel', on); b.setAttribute('aria-pressed', String(on)); });
  const ag = $('autoGas'); if (ag) { ag.classList.toggle('sel', settings.autoGas); ag.setAttribute('aria-pressed', String(settings.autoGas)); }
}
function initMenu() {
  const wrap = $('swatches');
  COLORS.forEach((c, i) => {
    const b = document.createElement('button'); b.className = 'swatch'; b.style.setProperty('--c', c.hex); b.setAttribute('aria-label', c.name); b.type = 'button';
    b.addEventListener('click', () => setPlayerColor(i)); wrap.appendChild(b);
  });
  document.querySelectorAll('.caropt').forEach(b => b.addEventListener('click', () => { if (b.dataset.car !== settings.car) setCar(b.dataset.car); }));
  document.querySelectorAll('.lapopt').forEach(b => b.addEventListener('click', () => { settings.laps = Number(b.dataset.laps); store.set('laps', settings.laps); refreshMenu(); }));
  if (isTouch) { $('autoGasRow').hidden = false; $('autoGas').addEventListener('click', () => { settings.autoGas = !settings.autoGas; store.set('autoGas', settings.autoGas); refreshMenu(); }); }
  $('btnStart').addEventListener('click', startCountdown);
  $('btnAgain').addEventListener('click', startCountdown);
  $('btnMenu').addEventListener('click', goMenu);
  $('btnPause').addEventListener('click', () => { if (state === 'racing' || state === 'countdown') setPaused(!paused); });
  $('btnResume').addEventListener('click', () => setPaused(false));
  $('btnRestart').addEventListener('click', () => { setPaused(false); startCountdown(); });
  $('btnQuit').addEventListener('click', () => { setPaused(false); goMenu(); });
  $('btnRespawn').addEventListener('click', () => { if (state === 'racing') respawn(); });
  document.querySelectorAll('[data-sound]').forEach(b => b.addEventListener('click', () => { audioInit(); setSound(!audio.on); }));
  bindHold('tLeft', 'left'); bindHold('tRight', 'right'); bindHold('tGas', 'gas'); bindHold('tBrake', 'brake'); bindHold('tHand', 'hand');
  document.addEventListener('visibilitychange', () => { if (document.hidden && (state === 'racing' || state === 'countdown')) setPaused(true); else if (!document.hidden && (state === 'racing' || state === 'countdown' || state === 'finished')) wakeOn(); });
  addEventListener('contextmenu', e => { if (isTouch) e.preventDefault(); });
}

// ======================= main loop =======================
function resize() {
  const w = innerWidth, h = innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  document.documentElement.classList.toggle('portrait', h > w);
}
addEventListener('resize', resize);
let last = performance.now(), acc = 0, frames = 0, ftAcc = 0, ftN = 0, lastAdapt = performance.now(), warm = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let raw = (now - last) / 1000; last = now; if (raw > .25) raw = .25; if (raw <= 0) return;
  // adaptive resolution: drop pixel ratio if frames are slow, never raise past the level that failed
  if (raw < .1) { ftAcc += raw * 1000; ftN++; }
  if (now - lastAdapt > 1800 && ++warm > 1) {
    const avg = ftN ? ftAcc / ftN : 16;
    if (avg > 26 && dpr > .75) { dprCeil = Math.max(.75, dpr - .1); dpr = Math.max(.75, dpr - .2); renderer.setPixelRatio(dpr); resize(); }
    else if (avg < 17.5 && dpr < dprCeil) { dpr = Math.min(dprCeil, dpr + .1); renderer.setPixelRatio(dpr); resize(); }
    ftAcc = 0; ftN = 0; lastAdapt = now;
  }
  const running = (state === 'racing' || state === 'countdown' || state === 'finished') && !paused;
  if (running) {
    acc += raw; let n = 0;
    while (acc >= 1 / 60 && n < 5) { simStep(1 / 60); acc -= 1 / 60; n++; }
    if (n === 5) acc = 0;
  }
  const dtv = paused ? 0 : raw;
  applyVisuals(player, pv, dtv || .0001); applyVisuals(rival, rv, dtv || .0001);
  if (running) {
    for (const [c, v] of [[player, pv], [rival, rv]]) {
      if ((c.drifting || (c.braking && c.vf > 25) || (!c.onRoad && c.speed > 8)) && Math.random() < .4) {
        const fx = Math.sin(c.h), fz = Math.cos(c.h), rx = -fz, rz = fx;
        emitSmoke(c.x - fx * 1.5 + rx * 0.85, .3, c.z - fz * 1.5 + rz * 0.85, !c.onRoad);
        emitSmoke(c.x - fx * 1.5 - rx * 0.85, .3, c.z - fz * 1.5 - rz * 0.85, !c.onRoad);
      }
    }
    updateHud(); audioUpdate(player, true);
  }
  updateCamera(raw, now / 1000);
  if (state === 'menu') return;   // the full-screen menu covers the scene: don't spend battery rendering it
  updateSmoke(dtv);
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
  await bootStep(42, 'Building the car…');
  buildShadowAssets(); buildCarTemplate();   // heavy part: runs once, then the car is cached and cloned
  await bootStep(54, 'Building the sedan…');
  buildCivicTemplate();          // baked into a few merged meshes, also cached
  await bootStep(64, 'Laying the track…');
  buildTrackVisuals(track); initSmoke();
  await bootStep(82, 'Painting and fuelling up…');
  pv = spawnCar(settings.car, colorFor(settings.color)); rv = spawnCar(otherModel(settings.car), colorFor((settings.color + 2) % COLORS.length));
  initMenu(); initHud(); resize();
  resetRace(); camPos.set(player.x + 8, 3, player.z - 8); camLook.set(player.x, .9, player.z);
  setPlayerColor(settings.color); setSound(settings.sound); refreshMenu();
  await bootStep(94, 'Warming up the engine…');
  renderer.compile(scene, camera);
  await bootStep(100, 'Ready to race');
  window.__tdBooted = true;
  if (location.hash === '#debug') window.__td = { scene, camera, renderer, get pv() { return pv; }, get rv() { return rv; }, setCar };
  showSheet('menu');
  bootUi.root.classList.add('done');
  setTimeout(() => { bootUi.root.hidden = true; }, 500);
  requestAnimationFrame(t => { last = t; frame(t); });
}
boot().catch(err => {
  console.error(err); bootUi.root.hidden = false; bootUi.root.classList.add('err');
  bootUi.msg.textContent = 'The game could not start. Please reload the page. (' + (err && err.message ? err.message : err) + ')';
});
