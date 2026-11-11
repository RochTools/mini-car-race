const createRevuelto = (function(){
const glyphs = PLATE_GLYPHS;

/* =========================================================================
   LAMBORGHINI REVUELTO–STYLE V12 SUPERCAR — procedural studio model
   Purple wedge body · Y-signature lamps · side engine intakes · V-spoke wheels
   +X = front · -X = rear · +Y = up · +Z = left
   ========================================================================= */

const clamp01 = v => Math.min(1, Math.max(0, v));
const smooth = v => { v = clamp01(v); return v * v * (3 - 2 * v); };

/* Crease-aware normals: smooth inside a panel, sharp across hard edges (the faceted Revuelto look). */
function creasedGeometry(source, angleDeg = 30) {
  const g = source.index ? source.toNonIndexed() : source;
  const pos = g.attributes.position, tris = pos.count / 3;
  const cosT = Math.cos(angleDeg * Math.PI / 180);
  const raw = new Float32Array(tris * 3), unit = new Float32Array(tris * 3);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const buckets = new Map();
  const keyOf = i => `${Math.round(pos.getX(i) * 2000)},${Math.round(pos.getY(i) * 2000)},${Math.round(pos.getZ(i) * 2000)}`;
  for (let f = 0; f < tris; f++) {
    // (c-b) x (a-b) — same winding convention as computeVertexNormals
    a.fromBufferAttribute(pos, f * 3); b.fromBufferAttribute(pos, f * 3 + 1); c.fromBufferAttribute(pos, f * 3 + 2);
    const n = new THREE.Vector3().subVectors(c, b).cross(new THREE.Vector3().subVectors(a, b));
    raw[f * 3] = n.x; raw[f * 3 + 1] = n.y; raw[f * 3 + 2] = n.z;
    const len = n.length();
    if (len > 1e-12) n.divideScalar(len);
    unit[f * 3] = n.x; unit[f * 3 + 1] = n.y; unit[f * 3 + 2] = n.z;
    for (let k = 0; k < 3; k++) {
      const key = keyOf(f * 3 + k);
      let arr = buckets.get(key); if (!arr) buckets.set(key, arr = []);
      arr.push(f);
    }
  }
  const normals = new Float32Array(pos.count * 3);
  for (let f = 0; f < tris; f++) {
    for (let k = 0; k < 3; k++) {
      let sx = 0, sy = 0, sz = 0;
      for (const o of buckets.get(keyOf(f * 3 + k))) {
        const d = unit[f * 3] * unit[o * 3] + unit[f * 3 + 1] * unit[o * 3 + 1] + unit[f * 3 + 2] * unit[o * 3 + 2];
        if (d >= cosT) { sx += raw[o * 3]; sy += raw[o * 3 + 1]; sz += raw[o * 3 + 2]; }
      }
      const l = Math.hypot(sx, sy, sz) || 1;
      const i = (f * 3 + k) * 3;
      normals[i] = sx / l; normals[i + 1] = sy / l; normals[i + 2] = sz / l;
    }
  }
  g.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  return g;
}

function createLamborghiniRevuelto(options = {}) {
  const root = new THREE.Group();
  root.name = 'Lamborghini_Revuelto';

  const initialColor = options.color || '#7d13e8';
  const PAINT = new THREE.Color(initialColor);

  /* ---------------- materials ---------------- */
  const paintMat = new THREE.MeshPhysicalMaterial({
    color: PAINT.clone(), metalness: 0.55, roughness: 0.2,
    clearcoat: 1.0, clearcoatRoughness: 0.04, envMapIntensity: 1.5,
  });
  const paintCapMat = new THREE.MeshPhysicalMaterial({
    color: PAINT.clone(), metalness: 0.62, roughness: 0.25,
    clearcoat: 1.0, clearcoatRoughness: 0.05, envMapIntensity: 1.3, side: THREE.DoubleSide,
  });
  const roofMat = new THREE.MeshPhysicalMaterial({
    color: PAINT.clone(), metalness: 0.55, roughness: 0.2,
    clearcoat: 1.0, clearcoatRoughness: 0.04, envMapIntensity: 1.5, side: THREE.DoubleSide,
  });
  const paintDeepMat = new THREE.MeshPhysicalMaterial({
    color: PAINT.clone().multiplyScalar(0.55), metalness: 0.55, roughness: 0.32, clearcoat: 1.0,
  });
  const glossBlackMat = new THREE.MeshStandardMaterial({ color: 0x060709, roughness: 0.16, metalness: 0.65 });
  const matteBlackMat = new THREE.MeshStandardMaterial({ color: 0x0d0e11, roughness: 0.92, metalness: 0.05 });
  const carbonMat = new THREE.MeshStandardMaterial({ color: 0x111318, roughness: 0.42, metalness: 0.55 });
  const trimBlackMat = new THREE.MeshStandardMaterial({ color: 0x090b0d, roughness: 0.38, metalness: 0.45 });
  const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.12, metalness: 1.0 });
  const satinMat = new THREE.MeshStandardMaterial({ color: 0xb9c0c8, roughness: 0.27, metalness: 0.95 });
  const gunmetalMat = new THREE.MeshStandardMaterial({ color: 0x252a30, roughness: 0.34, metalness: 0.88 });
  const rubberMat = new THREE.MeshStandardMaterial({ color: 0x0e1012, roughness: 0.96, metalness: 0.02 });
  const rotorMat = new THREE.MeshStandardMaterial({ color: 0xa7b0b8, roughness: 0.3, metalness: 0.92 });
  const caliperMat = new THREE.MeshStandardMaterial({ color: 0x8b1de0, roughness: 0.3, metalness: 0.4 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd8a928, roughness: 0.25, metalness: 1.0 });
  const panelGapMat = new THREE.MeshBasicMaterial({ color: 0x08030d });
  const linerMat = new THREE.MeshStandardMaterial({ color: 0x07080a, roughness: 0.96, side: THREE.DoubleSide });
  const intakeDarkMat = new THREE.MeshStandardMaterial({ color: 0x030304, roughness: 0.7, metalness: 0.1, side: THREE.DoubleSide });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x05060c, roughness: 0.04, metalness: 0.05,
    transparent: true, opacity: 0.84, clearcoat: 1.0, clearcoatRoughness: 0.025,
    envMapIntensity: 1.8, side: THREE.DoubleSide, depthWrite: false,
  });
  const engineGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x05070a, roughness: 0.05, metalness: 0.15, transparent: true, opacity: 0.94,
    clearcoat: 1.0, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false,
  });
  const clearLensMat = new THREE.MeshPhysicalMaterial({
    color: 0xdff4ff, roughness: 0.03, metalness: 0.0, transparent: true, opacity: 0.20,
    clearcoat: 1.0, side: THREE.DoubleSide, depthWrite: false,
  });
  const redLensMat = new THREE.MeshPhysicalMaterial({
    color: 0x7d0710, roughness: 0.05, transparent: true, opacity: 0.5,
    clearcoat: 1.0, side: THREE.DoubleSide, depthWrite: false,
  });
  const drlMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0xd9f3ff, emissiveIntensity: 3.8, roughness: 0.14, toneMapped: false,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0xf2fbff, emissiveIntensity: 3.4, roughness: 0.1, toneMapped: false,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0x390008, emissive: 0xff102e, emissiveIntensity: 3.2, roughness: 0.18, toneMapped: false,
  });
  const tailGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xff1a30, emissive: 0xff0a22, emissiveIntensity: 1.4, roughness: 0.05, transparent: true, opacity: 0.6,
    clearcoat: 1.0, clearcoatRoughness: 0.03, side: THREE.DoubleSide, depthWrite: false, toneMapped: false,
  });
  const tailCoreMat = new THREE.MeshStandardMaterial({
    color: 0xffe3e7, emissive: 0xff6477, emissiveIntensity: 5.0, roughness: 0.2, toneMapped: false,
  });
  const tailAmberMat = new THREE.MeshStandardMaterial({
    color: 0x4a2100, emissive: 0xff8500, emissiveIntensity: 1.8, roughness: 0.2, toneMapped: false,
  });
  const indicatorMat = tailAmberMat;
  const reverseMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0xe8f2ff, emissiveIntensity: 1.6, roughness: 0.2, toneMapped: false,
  });
  const reflectorMat = new THREE.MeshStandardMaterial({
    color: 0x9e0d18, emissive: 0xff2a3a, emissiveIntensity: 0.9, roughness: 0.3,
  });
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xf0f2f4, roughness: 0.48, metalness: 0.08 });
  const plateInkMat = new THREE.MeshStandardMaterial({ color: 0x0c1420, roughness: 0.55, side: THREE.DoubleSide });

  /* ---------------- helpers ---------------- */
  function addMesh(geo, mat, parent = root, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function rbox(w, h, d, radius, mat, parent = root, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, segs = 2) {
    return addMesh(new RoundedBoxGeometry(w, h, d, segs, radius), mat, parent, x, y, z, rx, ry, rz);
  }
  function cbox(w, h, d, mat, parent = root, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
    return addMesh(new THREE.BoxGeometry(w, h, d), mat, parent, x, y, z, rx, ry, rz);
  }
  function cyl(r1, r2, h, mat, parent = root, x = 0, y = 0, z = 0, seg = 24, rx = 0, ry = 0, rz = 0) {
    return addMesh(new THREE.CylinderGeometry(r1, r2, h, seg), mat, parent, x, y, z, rx, ry, rz);
  }
  function tube(points, radius, mat, parent = root, tubular = 42, radial = 7) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], p[1], p[2])), false, 'catmullrom', 0.08);
    return addMesh(new THREE.TubeGeometry(curve, tubular, radius, radial, false), mat, parent);
  }
  function subdivide(geo, times) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    for (let t = 0; t < times; t++) {
      const p = g.attributes.position, out = [];
      const V = i => [p.getX(i), p.getY(i), p.getZ(i)];
      const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
      for (let i = 0; i < p.count; i += 3) {
        const a = V(i), b = V(i + 1), c = V(i + 2), ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
        for (const tri of [[a, ab, ca], [ab, b, bc], [ca, bc, c], [ab, bc, ca]]) for (const v of tri) out.push(...v);
      }
      g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
    }
    return g;
  }
  function flatPanel(points, mat, side, lift = 0.011) {
    const shape = new THREE.Shape(points.map(p => new THREE.Vector2(p[0], p[1])));
    const geo = subdivide(new THREE.ShapeGeometry(shape, 3), 4);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      pos.setZ(i, side * (sideZ(x, y) + lift));
    }
    geo.computeVertexNormals();
    const m = addMesh(geo, mat, root);
    m.material.side = THREE.DoubleSide;
    return m;
  }

  /* ---------------- body loft ---------------- */
  const FRONT_AXLE = 1.52;
  const REAR_AXLE = -1.52;
  const WHEEL_R = 0.365;
  const ARCH_R = 0.440;
  const X_FRONT = 2.18;   // nose pulled in 18 cm (shorter front overhang)
  const X_REAR = -2.48;
  // nose sculpting: convex in plan (centre pushed forward) and raked back toward the top -> no flat "hammered" face
  // plan view: elliptical (circle-like) nose so the bumper arcs round the corners instead of a straight "alif" line
  const noseDX = (z, y) => 0.32 * Math.sqrt(1 - Math.min(1, Math.abs(z) / 0.97) ** 2) - 0.22 * (y - 0.20);
  const noseRamp = x => smooth((x - 1.72) / (X_FRONT - 1.72));
  const warpX = (x, y, z) => x + noseRamp(x) * noseDX(z, y);
  const wp = (x, y, z) => [warpX(x, y, z), y, z];

  // Straight (linear) segments between key stations give the hard wedge facets of the real car.
  const TOP_KEYS = [
    [-2.48, 0.90], [-2.22, 0.955], [-1.80, 0.99], [-1.40, 0.985],
    [-0.95, 0.90], [-0.40, 0.86], [0.40, 0.85], [1.00, 0.84],
    [1.45, 0.875], [1.72, 0.745], [2.07, 0.600], [2.30, 0.485],
  ];
  const WIDTH_KEYS = [
    [-2.48, 0.88], [-2.20, 0.97], [-1.75, 1.018], [-1.00, 1.01],
    [0.00, 1.000], [1.00, 1.000], [1.70, 0.995], [1.98, 0.965], [2.30, 0.925],
  ];
  const BOTTOM_KEYS = [
    [-2.48, 0.24], [-2.05, 0.175], [0.90, 0.165], [1.90, 0.17], [2.30, 0.20],
  ];
  function sampleKeys(keys, x) {
    if (x <= keys[0][0]) return keys[0][1];
    const last = keys[keys.length - 1];
    if (x >= last[0]) return last[1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [x0, v0] = keys[i], [x1, v1] = keys[i + 1];
      if (x >= x0 && x <= x1) return v0 + (v1 - v0) * ((x - x0) / (x1 - x0));
    }
    return last[1];
  }
  const topAt = x => sampleKeys(TOP_KEYS, x);
  const widthAt = x => sampleKeys(WIDTH_KEYS, x);
  const ARCH_BLEND = ARCH_R + 0.11;
  const bottomAt = x => {
    let y = sampleKeys(BOTTOM_KEYS, x);
    for (const ax of [FRONT_AXLE, REAR_AXLE]) {
      const dx = Math.abs(x - ax);
      if (dx < ARCH_BLEND) {
        const dxc = Math.min(dx, ARCH_R);
        const archY = WHEEL_R + Math.sqrt(ARCH_R * ARCH_R - dxc * dxc) + 0.006;
        const w = dx <= ARCH_R ? 1 : 1 - smooth((dx - ARCH_R) / (ARCH_BLEND - ARCH_R));
        y = Math.max(y, y + (archY - y) * w);
      }
    }
    return y;
  };
  // hood "tongue": a flat central panel that narrows then widens toward the nose (diagonal creases like the reference)
  const tongueHalf = x => x < 1.55 ? widthAt(x) * (0.40 - 0.08 * smooth((x - 1.30) / 0.25)) : 0.32 + 0.19 * Math.min(1, (x - 1.55) / 0.75);
  // fenders rise above the hood centre toward the nose (tall fender tips + sunken bonnet)
  const fenderLift = x => 0.14 * smooth((x - 1.55) / 0.75);
  // round fender dome concentric with the front arch: keeps the wall above the tyre full and circular
  const FENDER_DOME_R = ARCH_R + 0.095;
  const fenderDome = x => { const dx = Math.abs(x - FRONT_AXLE); return dx < FENDER_DOME_R ? WHEEL_R + Math.sqrt(FENDER_DOME_R * FENDER_DOME_R - dx * dx) : 0; };
  function halfSection(x) {
    const w = widthAt(x);
    const y1 = topAt(x);
    const yF = Math.max(y1 + fenderLift(x), fenderDome(x));
    const y0 = Math.min(bottomAt(x), y1 - 0.055);
    const h = Math.max(0.05, yF - y0);
    const boxy = smooth((x - 1.85) / 0.45);
    const pts = [];
    const push = (z, y) => pts.push([Math.max(0, z), Math.min(y, yF + 0.01)]);
    // few points on purpose: every point is a crease line along the car
    push(0, y0); push(w * 0.58, y0);
    push(w * 0.90, y0 + h * 0.12);
    push(w * 1.00, y0 + h * 0.30);
    // fenders over the wheels stay full and muscular (no tumblehome), so the arch never opens through the skin
    const bump = Math.max(smooth(clamp01(1 - (Math.abs(x - FRONT_AXLE) - 0.35) / 0.45)), smooth(clamp01(1 - (Math.abs(x - REAR_AXLE) - 0.35) / 0.45)));
    push(w * (0.915 + 0.075 * bump + 0.07 * boxy), y0 + h * 0.64);
    push(w * (0.79 + 0.175 * bump + 0.13 * boxy), yF - 0.025 - 0.03 * clamp01((x - 1.25) / 1.0) * (1 - boxy));
    push(tongueHalf(x), y1);
    push(0, y1 + 0.006);
    return pts;
  }
  // exact outer-wall z of the faceted body at (x, y) — used to seat panels, lamps and vents on the skin
  const sideZ = (x, y) => {
    const half = halfSection(x);
    for (let i = 1; i < half.length; i++) {
      const [za, ya] = half[i - 1], [zb, yb] = half[i];
      if (yb > ya + 1e-5 && y >= ya && y <= yb) return za + (zb - za) * ((y - ya) / (yb - ya));
    }
    return y < half[2][1] ? half[2][0] : half[half.length - 2][0];
  };
  // height of the faceted skin at (x, z): lets lamps/decals sit exactly on the hood and fenders
  const surfY = (x, zAbs) => {
    const half = halfSection(x);
    let best = -1;
    for (let i = 1; i < half.length; i++) {
      const [za, ya] = half[i - 1], [zb, yb] = half[i];
      const lo = Math.min(za, zb), hi = Math.max(za, zb);
      if (zAbs >= lo - 1e-6 && zAbs <= hi + 1e-6 && Math.abs(zb - za) > 1e-6) {
        const y = ya + (yb - ya) * ((zAbs - za) / (zb - za));
        if (y > best) best = y;
      }
    }
    return best < 0 ? topAt(x) : best;
  };
  const ringAt = x => {
    const half = halfSection(x), ring = [];
    for (let j = 0; j < half.length; j++) ring.push([x, half[j][1], half[j][0]]);
    for (let j = half.length - 2; j >= 1; j--) ring.push([x, half[j][1], -half[j][0]]);
    return ring;
  };
  {
    const NX = 140, rings = [];
    for (let i = 0; i <= NX; i++) rings.push(ringAt(X_FRONT - (X_FRONT - X_REAR) * i / NX));
    const M = rings[0].length, posArr = [], idx = [];
    for (const ring of rings) for (const p of ring) posArr.push(warpX(p[0], p[1], p[2]), p[1], p[2]);
    for (let i = 0; i < NX; i++) for (let j = 0; j < M; j++) {
      const a = i * M + j, b = i * M + ((j + 1) % M), c = (i + 1) * M + j, d = (i + 1) * M + ((j + 1) % M);
      idx.push(a, b, c, b, d, c);
    }
    const g0 = new THREE.BufferGeometry();
    g0.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    g0.setIndex(idx);
    const g = creasedGeometry(g0, 24);
    const body = new THREE.Mesh(g, paintMat);
    body.name = 'Revuelto_BodyShell'; body.castShadow = true; body.receiveShadow = true;
    root.add(body);
    for (const xFace of [X_FRONT, X_REAR]) {
      const ring = ringAt(xFace);
      const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
      const gf = new THREE.BufferGeometry();
      if (xFace === X_FRONT) {
        // curved nose face: concentric rings scaled toward the centre, each point pushed by the nose warp
        const SC = [1, 0.82, 0.64, 0.46, 0.28, 0.12, 0], L = ring.length, pf = [], ix = [];
        for (const sc of SC) for (const p of ring) pf.push(warpX(xFace, cy + (p[1] - cy) * sc, p[2] * sc), cy + (p[1] - cy) * sc, p[2] * sc);
        for (let r = 0; r < SC.length - 1; r++) for (let j = 0; j < L; j++) {
          const a0 = r * L + j, b0 = r * L + (j + 1) % L, c0 = (r + 1) * L + j, d0 = (r + 1) * L + (j + 1) % L;
          ix.push(a0, b0, c0, b0, d0, c0);
        }
        gf.setAttribute('position', new THREE.Float32BufferAttribute(pf, 3)); gf.setIndex(ix);
      } else {
        const posF = [xFace, cy, 0], indexF = [];
        for (const p of ring) posF.push(p[0], p[1], p[2]);
        for (let j = 1; j <= ring.length; j++) indexF.push(0, j, j % ring.length + 1);
        gf.setAttribute('position', new THREE.Float32BufferAttribute(posF, 3)); gf.setIndex(indexF);
      }
      gf.computeVertexNormals();
      const cap = new THREE.Mesh(gf, paintCapMat);
      cap.castShadow = true; cap.receiveShadow = true; root.add(cap);
    }
  }

  // underbody, side skirts, wheel-arch liners and lips
  cbox(2.15, 0.09, 1.52, matteBlackMat, root, 0, 0.19, 0);
  cbox(0.45, 0.09, 1.42, matteBlackMat, root, 1.98, 0.20, 0);
  cbox(0.48, 0.09, 1.50, matteBlackMat, root, -2.13, 0.20, 0);
  for (const side of [-1, 1]) {
    rbox(2.02, 0.085, 0.065, 0.02, carbonMat, root, 0, 0.225, side * 0.982);
    for (const ax of [FRONT_AXLE, REAR_AXLE]) {
      // black arch lip: only along the part of the arch that sits on the side wall (never across the hood/fender top)
      let run = [];
      const flush = () => { if (run.length > 2) tube(run, 0.0065, trimBlackMat, root, 40); run = []; };
      for (let k = 0; k <= 40; k++) {
        const a = 0.05 + (Math.PI - 0.10) * k / 40;
        const lx = ax + (ARCH_R + 0.008) * Math.cos(a), ly = WHEEL_R + (ARCH_R + 0.008) * Math.sin(a);
        if (ly < Math.max(topAt(lx), ax === FRONT_AXLE ? fenderDome(lx) : 0) - 0.06) run.push([lx, ly, side * (sideZ(lx, ly) + 0.004)]); else flush();
      }
      flush();
      const posArr = [], idx = [], N = 18;
      for (let i = 0; i <= N; i++) {
        const a = Math.PI * i / N;
        const x = ax - (ARCH_R - 0.055) * Math.cos(a), y = WHEEL_R + (ARCH_R - 0.055) * Math.sin(a);
        posArr.push(x, y, side * 1.0, x, y, side * 0.52);
      }
      for (let i = 0; i < N; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
      g.setIndex(idx); g.computeVertexNormals(); addMesh(g, linerMat, root);
    }
  }

  /* ---------------- number plates: real extruded 3D letters ---------------- */
  function addPlateText(parent, x, y, facing) {
    const text = 'StepTuDeen';
    const width = [...text].reduce((sum, ch) => sum + glyphs[ch].advance, 0);
    const scale = 0.300 / width;
    const lettering = new THREE.Group();
    lettering.name = facing > 0 ? 'Front_StepTuDeen_3D' : 'Rear_StepTuDeen_3D';
    lettering.position.set(x, y, 0);
    lettering.rotation.y = facing > 0 ? Math.PI / 2 : -Math.PI / 2;
    parent.add(lettering);
    let cursor = -width / 2;
    for (const ch of text) {
      const item = glyphs[ch], path = new THREE.ShapePath();
      for (const cmd of item.commands) {
        const a = cmd.slice(1).map(v => v * scale);
        if (cmd[0] === 'M') path.moveTo(cursor * scale + a[0], a[1]);
        else if (cmd[0] === 'L') path.lineTo(cursor * scale + a[0], a[1]);
        else if (cmd[0] === 'Q') path.quadraticCurveTo(cursor * scale + a[0], a[1], cursor * scale + a[2], a[3]);
        else if (cmd[0] === 'C') path.bezierCurveTo(cursor * scale + a[0], a[1], cursor * scale + a[2], a[3], cursor * scale + a[4], a[5]);
        else if (cmd[0] === 'Z' && path.currentPath) path.currentPath.closePath();
      }
      const shapes = path.toShapes(false);
      if (shapes.length) lettering.add(new THREE.Mesh(
        new THREE.ExtrudeGeometry(shapes, { depth: 0.0016, bevelEnabled: false, curveSegments: 5 }), plateInkMat));
      cursor += item.advance;
    }
  }

  /* ---------------- front fascia: sculpted bonnet + realistic multi-layer headlamps ---------------- */
  const frontGroup = new THREE.Group(); root.add(frontGroup);
  const headlightLights = [];
  const XF = X_FRONT;
  const nose = halfSection(XF);
  const crownP = nose[nose.length - 3], tongueP = nose[nose.length - 2], centreY = nose[nose.length - 1][1];
  const noseTop = z => {
    z = Math.abs(z);
    if (z <= tongueP[0]) return tongueP[1];
    if (z >= crownP[0]) return crownP[1];
    return tongueP[1] + (crownP[1] - tongueP[1]) * (z - tongueP[0]) / (crownP[0] - tongueP[0]);
  };
  const smokedLensMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b1424, roughness: 0.04, metalness: 0.2, transparent: true, opacity: 0.62,
    clearcoat: 1.0, clearcoatRoughness: 0.02, envMapIntensity: 2.4, depthWrite: false,
  });
  // flat angular panel on the nose face, bent onto the curved nose. pts are [z, y] for +Z; side=-1 mirrors. holes: optional [z,y] loops
  const facePoly = (pts, mat, x, depth, side = 1, bevel = 0.004, hole = null) => {
    const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(-side * p[0], p[1])));
    if (hole) shape.holes.push(new THREE.Path(hole.map(p => new THREE.Vector2(-side * p[0], p[1]))));
    const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1 });
    geo.rotateY(Math.PI / 2);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) + noseDX(pos.getZ(i), pos.getY(i)));
    geo.computeVertexNormals();
    return addMesh(geo, mat, frontGroup, x, 0, 0);
  };
  // horizontal plate in plan view (splitter): pts are [x, z]
  const planPlate = (pts, y, thick, mat) => {
    const shape = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], -p[1])));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    return addMesh(geo, mat, frontGroup, 0, y, 0);
  };
  const scaleAbout = (pts, k) => {
    const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length, cy = pts.reduce((s, p) => s + p[1], 0) / pts.length;
    return pts.map(p => [cx + (p[0] - cx) * k, cy + (p[1] - cy) * k]);
  };
  const dxc = (z, y) => noseDX(z, y);

  // dark mouth behind everything
  for (const sd of [-1, 1]) facePoly([[0.86, 0.405], [0.86, 0.215], [0.40, 0.205], [0.0, 0.205], [0.0, 0.405]], matteBlackMat, XF + 0.012, 0.006, sd, 0);
  // carbon splitter that follows the curved nose, with a thin silver edge line
  {
    const front = [], back = [], edge = [];
    for (let i = 0; i <= 24; i++) {
      const z = -0.93 + 1.86 * i / 24, xe = XF + 0.12 + dxc(z, 0.20);
      front.push([xe, z]); back.unshift([XF - 0.10, z]); edge.push([xe - 0.002, 0.2125, z]);
    }
    planPlate(front.concat(back), 0.190, 0.018, carbonMat);
    tube(edge, 0.0034, satinMat, frontGroup, 40);
  }
  for (const side of [-1, 1]) {
    const tipZ = 0.50, outZ = 0.835, top = z => noseTop(z) - 0.012;
    const hl = [[outZ, top(outZ)], [0.70, top(0.70)], [tipZ, top(tipZ)], [tipZ + 0.02, top(tipZ) - 0.040], [0.66, 0.405], [outZ, 0.410]];
    // ---- headlamp: purple bezel frame (hole) -> black housing -> smoked lens -> projectors -> LED signature
    const outer = scaleAbout(hl, 1.09).map(p => [p[0], Math.min(p[1], top(p[0]) + 0.012)]);
    facePoly(outer, paintMat, XF + 0.004, 0.022, side, 0.003, hl);
    facePoly(hl, glossBlackMat, XF + 0.002, 0.004, side, 0);
    facePoly(scaleAbout(hl, 0.95), smokedLensMat, XF + 0.020, 0.002, side, 0);
    for (const [zc, k] of [[0.745, 0.62], [0.625, 0.55]]) {
      const hh = top(zc) - 0.407, r = Math.min(0.034, hh * 0.30 * (k / 0.55)), yc = 0.407 + hh * 0.46, xx = XF + 0.012 + dxc(zc, yc);
      addMesh(new THREE.TorusGeometry(r, 0.0045, 8, 28), chromeMat, frontGroup, xx + 0.004, yc, side * zc, 0, Math.PI / 2, 0);
      addMesh(new THREE.CylinderGeometry(r * 0.92, r * 0.92, 0.006, 24), gunmetalMat, frontGroup, xx, yc, side * zc, 0, 0, Math.PI / 2);
      addMesh(new THREE.SphereGeometry(r * 0.62, 18, 12), headlightMat, frontGroup, xx + 0.006, yc, side * zc).scale.set(0.35, 1, 1);
    }
    // LED signature: thick tapered strip along the upper edge + vertical hook at the fender tip (Y-like), lit by the lights switch
    const drl = [[outZ - 0.02, top(outZ) - 0.010], [tipZ + 0.035, top(tipZ) - 0.010], [tipZ + 0.035, top(tipZ) - 0.021], [outZ - 0.02, top(outZ) - 0.026]];
    facePoly(drl, drlMat, XF + 0.014, 0.008, side, 0);
    facePoly([[outZ - 0.020, top(outZ) - 0.010], [outZ - 0.020, 0.418], [outZ - 0.036, 0.418], [outZ - 0.036, top(outZ) - 0.010]], drlMat, XF + 0.014, 0.008, side, 0);
    // ---- big dark side intake under the lamp, with horizontal fins
    facePoly([[0.835, 0.362], [0.80, 0.255], [0.50, 0.238], [0.455, 0.300], [0.600, 0.360]], intakeDarkMat, XF + 0.014, 0.014, side, 0.002);
    for (let k = 0; k < 4; k++) {
      const yy = 0.338 - k * 0.028, z0 = 0.80 - k * 0.028, z1 = 0.52 + k * 0.010, zm = (z0 + z1) / 2;
      rbox(0.030, 0.008, z0 - z1, 0.003, carbonMat, frontGroup, XF + 0.030 + dxc(zm, yy), yy, side * zm, 0, -side * 0.05, 0);
    }
    // ---- purple wing blades: band under the lamp, chin blade, corner fin
    facePoly([[0.905, 0.405], [0.905, 0.250], [0.835, 0.362], [0.60, 0.360], [0.42, 0.370], [0.455, 0.405]], paintMat, XF + 0.010, 0.020, side, 0.004);
    facePoly([[0.915, 0.320], [0.905, 0.215], [0.46, 0.190], [0.395, 0.222], [0.640, 0.262], [0.82, 0.300]], paintMat, XF + 0.018, 0.075, side, 0.004);
    facePoly([[0.915, 0.240], [0.905, 0.200], [0.80, 0.205]], carbonMat, XF + 0.030, 0.050, side, 0.002);
    rbox(0.050, 0.150, 0.020, 0.006, paintMat, frontGroup, XF + 0.020 + dxc(0.915, 0.315), 0.315, side * 0.915, 0, -side * 0.12, 0);
    // ---- central lower intake with fine grille bars
    for (let k = 0; k < 4; k++) rbox(0.020, 0.006, 0.34 - 0.04 * k, 0.002, trimBlackMat, frontGroup, XF + 0.030 + dxc(0.2, 0.34), 0.340 - k * 0.030, side * 0.20, 0, 0, 0);
    // ---- hood panel-gap lines along the tongue edges + outer diagonal crease (follow the warped skin)
    const edge = [];
    for (let x = 1.62; x <= XF - 0.01; x += 0.07) edge.push(wp(x, topAt(x) + 0.004, side * tongueHalf(x)));
    tube(edge, 0.0045, panelGapMat, root, 24);
    const cz = x => widthAt(x) * (0.79 + 0.13 * smooth((x - 1.85) / 0.45));
    const outerC = [];
    for (let x = 1.50; x <= XF - 0.02; x += 0.09) { const z = side * cz(x) * 0.98; outerC.push(wp(x, surfY(x, Math.abs(z)) + 0.004, z)); }
    tube(outerC, 0.0035, paintDeepMat, root, 20);
    cbox(0.05, 0.012, 0.42, glossBlackMat, root, 1.20, topAt(1.20) + 0.010, side * 0.34);
    const spot = new THREE.SpotLight(0xeef6ff, 0, 26, Math.PI / 7, 0.55, 1.4);
    spot.position.set(2.27, 0.50, side * 0.62);
    spot.target.position.set(16, 0, side * 1.0);
    root.add(spot, spot.target); headlightLights.push(spot);
  }
  // sharp purple bonnet lip across the nose centre
  rbox(0.12, 0.030, 0.90, 0.010, paintMat, frontGroup, XF + 0.045 + dxc(0, centreY - 0.012), centreY - 0.012, 0, 0, 0, -0.16);
  // front plate on the dark mouth
  rbox(0.018, 0.095, 0.36, 0.008, plateMat, frontGroup, XF + 0.052 + dxc(0, 0.292), 0.292, 0);
  addPlateText(frontGroup, XF + 0.064 + dxc(0, 0.272), 0.272, 1);
  // gold shield badge on the bonnet nose
  {
    const sh = new THREE.Shape(); sh.moveTo(-0.030, 0.026); sh.lineTo(0.030, 0.026); sh.lineTo(0.030, -0.004); sh.quadraticCurveTo(0.030, -0.030, 0, -0.040); sh.quadraticCurveTo(-0.030, -0.030, -0.030, -0.004); sh.closePath();
    const ex = o => new THREE.ExtrudeGeometry(sh, { depth: o, bevelEnabled: false });
    const badge = new THREE.Group();
    badge.add(new THREE.Mesh(ex(0.006), goldMat));
    const inner = new THREE.Mesh(ex(0.008), glossBlackMat); inner.scale.set(0.82, 0.78, 1); inner.position.set(0, 0.002, 0.0005); badge.add(inner);
    const bull = new THREE.Mesh(new THREE.SphereGeometry(0.010, 8, 6), goldMat); bull.scale.set(1.4, 1, 0.5); bull.position.set(0, -0.002, 0.009); badge.add(bull);
    badge.scale.set(1.7, 1.7, 1.7); badge.rotation.y = Math.PI / 2;
    const bx = 2.12, tilt = new THREE.Group();
    tilt.position.set(warpX(bx, surfY(bx, 0), 0), surfY(bx, 0) + 0.003, 0); tilt.rotation.z = 0.52;
    tilt.add(badge); frontGroup.add(tilt);
  }

  /* ---------------- glass canopy, roof and engine cover ---------------- */
  const CABIN = [
    { x: 1.15, base: 0.830, top: 0.880, w: 0.800 },
    { x: 0.85, base: 0.835, top: 1.005, w: 0.775 },
    { x: 0.45, base: 0.840, top: 1.100, w: 0.735 },
    { x: 0.00, base: 0.845, top: 1.140, w: 0.700 },
    { x: -0.50, base: 0.852, top: 1.130, w: 0.680 },
    { x: -0.85, base: 0.860, top: 1.070, w: 0.640 },
    { x: -1.15, base: 0.868, top: 0.965, w: 0.560 },
    { x: -1.40, base: 0.878, top: 0.900, w: 0.470 },
  ];
  const CK = CABIN.slice().reverse();
  function pchip(key) {
    const n = CK.length, h = [], d = [], m = new Array(n);
    for (let i = 0; i < n - 1; i++) { h[i] = CK[i + 1].x - CK[i].x; d[i] = (CK[i + 1][key] - CK[i][key]) / h[i]; }
    m[0] = d[0]; m[n - 1] = d[n - 2];
    for (let i = 1; i < n - 1; i++) {
      if (d[i - 1] * d[i] <= 0) { m[i] = 0; continue; }
      const w1 = 2 * h[i] + h[i - 1], w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
    }
    return x => {
      if (x <= CK[0].x) return CK[0][key];
      if (x >= CK[n - 1].x) return CK[n - 1][key];
      let i = 0; while (x > CK[i + 1].x) i++;
      const t = (x - CK[i].x) / h[i], t2 = t * t, t3 = t2 * t;
      return (2 * t3 - 3 * t2 + 1) * CK[i][key] + (t3 - 2 * t2 + t) * h[i] * m[i]
        + (-2 * t3 + 3 * t2) * CK[i + 1][key] + (t3 - t2) * h[i] * m[i + 1];
    };
  }
  const fBase = pchip('base'), fTop = pchip('top'), fW = pchip('w');
  const cabinParams = x => ({ x, base: fBase(x), top: fTop(x), w: fW(x) });
  const canopyY = (x, zAbs) => {
    const c = cabinParams(x), t = Math.min(1, zAbs / c.w), a = Math.acos(t * t);
    return c.base + (c.top - c.base) * Math.pow(Math.sin(a), 0.5);
  };
  // glass shell
  {
    const NX = 54, NA = 30, posArr = [], idx = [];
    for (let i = 0; i <= NX; i++) {
      const x = 1.15 + (-1.40 - 1.15) * i / NX, c = cabinParams(x);
      for (let j = 0; j <= NA; j++) {
        const a = Math.PI * j / NA, s = Math.sin(a), co = Math.cos(a);
        posArr.push(x, c.base + (c.top - c.base) * Math.pow(Math.max(0, s), 0.5),
          c.w * Math.sign(co) * Math.pow(Math.abs(co), 0.5));
      }
    }
    for (let i = 0; i < NX; i++) for (let j = 0; j < NA; j++) {
      const a = i * (NA + 1) + j, b = a + (NA + 1); idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const canopy = new THREE.Mesh(g, glassMat); canopy.renderOrder = 2; root.add(canopy);
  }
  // painted roof skin over the glass centre
  {
    const NX = 42, NZ = 14, pos = [], idx = [];
    for (let i = 0; i <= NX; i++) {
      const x = 0.50 + (-1.05 - 0.50) * i / NX;
      for (let j = 0; j <= NZ; j++) {
        const z = -0.55 + 1.10 * j / NZ;
        pos.push(x, canopyY(x, Math.min(Math.abs(z), cabinParams(x).w * 0.998)) + 0.012, z);
      }
    }
    for (let i = 0; i < NX; i++) for (let j = 0; j < NZ; j++) {
      const a = i * (NZ + 1) + j, b = a + (NZ + 1); idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx); g.computeVertexNormals();
    const roof = new THREE.Mesh(g, roofMat); roof.renderOrder = 3; root.add(roof);
  }
  // A-pillars and purple rear buttresses
  for (const side of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 4; i++) {
      const u = i / 4, x = 1.13 + (0.42 - 1.13) * u, zAbs = 0.775 + (0.58 - 0.775) * u;
      pts.push([x, canopyY(x, zAbs) + 0.008, side * zAbs]);
    }
    tube(pts, 0.021, paintMat, root, 24);
    const pts2 = [];
    for (let i = 0; i <= 4; i++) {
      const u = i / 4, x = -0.80 + (-1.34 + 0.80) * u, zAbs = 0.585 + (0.455 - 0.585) * u;
      pts2.push([x, canopyY(x, zAbs) + 0.008, side * zAbs]);
    }
    tube(pts2, 0.023, paintMat, root, 20);
  }
  // black louvred engine bay behind the cabin (glass lid, louvres, hex frame)
  rbox(1.00, 0.030, 0.80, 0.025, engineGlassMat, root, -1.62, 1.000, 0, 0, 0, -0.035);
  rbox(1.10, 0.020, 0.92, 0.03, glossBlackMat, root, -1.62, 0.992, 0, 0, 0, -0.035);
  for (let i = 0; i < 6; i++) cbox(0.030, 0.016, 0.72, glossBlackMat, root, -2.00 + i * 0.15, 1.026 - i * 0.005, 0, 0, 0, -0.035);
  rbox(0.30, 0.045, 0.46, 0.02, carbonMat, root, -1.50, 0.975, 0);
  cyl(0.055, 0.065, 0.05, gunmetalMat, root, -1.50, 0.955, 0, 20, 0, 0, 0.2);

  /* ---------------- interior (two seats, seen through the glass) ---------------- */
  const interior = new THREE.Group(); root.add(interior);
  const dashMat = new THREE.MeshStandardMaterial({ color: 0x121014, roughness: 0.8, metalness: 0.1 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x3d0d5e, roughness: 0.72, metalness: 0.05 });
  const seatInsertMat = new THREE.MeshStandardMaterial({ color: 0x7d13e8, roughness: 0.62, metalness: 0.05 });
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x0a1620, emissive: 0x7d3cff, emissiveIntensity: 1.1, roughness: 0.22 });
  rbox(2.0, 0.04, 1.02, 0.01, dashMat, interior, -0.25, 0.46, 0);
  rbox(0.30, 0.13, 1.18, 0.05, dashMat, interior, 0.52, 0.86, 0, 0, 0, -0.10);
  rbox(0.10, 0.075, 0.30, 0.02, screenMat, interior, 0.55, 0.955, 0, 0, 0, -0.28);
  rbox(0.58, 0.10, 0.17, 0.03, dashMat, interior, 0.02, 0.80, 0);
  for (const z of [-0.34, 0.34]) {
    rbox(0.46, 0.11, 0.42, 0.05, seatMat, interior, -0.18, 0.72, z);
    rbox(0.34, 0.055, 0.30, 0.025, seatInsertMat, interior, -0.18, 0.785, z);
    rbox(0.12, 0.40, 0.40, 0.05, seatMat, interior, -0.43, 0.90, z, 0, 0, 0.13);
    rbox(0.05, 0.28, 0.26, 0.025, seatInsertMat, interior, -0.475, 0.92, z, 0, 0, 0.13);
    rbox(0.09, 0.11, 0.21, 0.04, seatMat, interior, -0.49, 1.00, z, 0, 0, 0.13);
  }
  addMesh(new THREE.TorusGeometry(0.115, 0.016, 8, 26), dashMat, interior, 0.34, 0.94, 0.34, 0, Math.PI / 2, 0.35);
  rbox(0.18, 0.032, 0.032, 0.01, dashMat, interior, 0.43, 0.885, 0.34, 0, 0, -0.5);

  /* ---------------- side sculpting: scissor doors + engine intakes ---------------- */
  for (const side of [-1, 1]) {
    const zAt = (x, y, lift = 0.006) => side * (sideZ(x, y) + lift);
    // door shut-line (angular scissor-door cut)
    tube([[1.22, 0.80, zAt(1.22, 0.80)], [1.00, 0.52, zAt(1.00, 0.52)], [0.92, 0.31, zAt(0.92, 0.31)], [-0.28, 0.30, zAt(-0.28, 0.30)], [-0.30, 0.78, zAt(-0.30, 0.78)]], 0.0055, panelGapMat, root, 30);
    // sharp shoulder blade and sill character lines
    tube([[1.10, 0.80, zAt(1.10, 0.80)], [0.30, 0.83, zAt(0.30, 0.83)], [-0.30, 0.84, zAt(-0.30, 0.84)]], 0.007, paintDeepMat, root, 30);
    tube([[1.30, 0.40, zAt(1.30, 0.40)], [0.55, 0.43, zAt(0.55, 0.43)], [-0.25, 0.47, zAt(-0.25, 0.47)]], 0.006, paintDeepMat, root, 24);
    // thin violet sill light line like the real car
    tube([[0.85, 0.235, zAt(0.85, 0.235, 0.010)], [-0.45, 0.235, zAt(-0.45, 0.235, 0.010)]], 0.004, drlMat, root, 12);
    // flush handle
    rbox(0.15, 0.022, 0.018, 0.008, trimBlackMat, root, 0.40, 0.76, zAt(0.40, 0.76, 0.006));
    // huge angular black engine intake behind the door
    flatPanel([[-0.30, 0.805], [-0.98, 0.895], [-1.04, 0.60], [-0.66, 0.30], [-0.34, 0.38]], matteBlackMat, side);
    flatPanel([[-0.42, 0.760], [-0.88, 0.830], [-0.94, 0.610], [-0.66, 0.380], [-0.46, 0.440]], intakeDarkMat, side, 0.017);
    for (let k = 0; k < 4; k++) {
      const yy = 0.74 - k * 0.095;
      cbox(0.42 - k * 0.04, 0.012, 0.014, carbonMat, root, -0.64 - k * 0.04, yy, zAt(-0.64, yy, 0.026));
    }
    rbox(0.40, 0.045, 0.035, 0.012, paintMat, root, -0.58, 0.855, zAt(-0.58, 0.855, 0.008), 0, side * 0.05, -0.06);
    // mirror at the foot of the A-pillar
    cbox(0.05, 0.025, 0.14, glossBlackMat, root, 1.08, 0.91, side * 0.90);
    rbox(0.16, 0.085, 0.13, 0.03, paintMat, root, 1.02, 0.955, side * 0.985, 0, -side * 0.10, 0);
    cbox(0.010, 0.062, 0.095, gunmetalMat, root, 0.945, 0.958, side * 0.975);
  }

  /* ---------------- rear fascia + Y tail lights ---------------- */
  const rearGroup = new THREE.Group(); root.add(rearGroup);
  const tailGlowPts = [], tailGlowLights = [];
  // black rear panel + lower diffuser block
  {
    // gloss-black tail panel cut to the body outline (inset 2.5 cm) so nothing overhangs the sides
    const R = [], L = [];
    for (let y = 0.38; y <= 0.875; y += 0.035) { const z = sideZ(X_REAR, y) - 0.025; R.push([z, y]); L.unshift([-z, y]); }
    const sh = new THREE.Shape(R.concat(L).map(p => new THREE.Vector2(p[0], p[1])));
    const g = new THREE.ExtrudeGeometry(sh, { depth: 0.055, bevelEnabled: false });
    g.rotateY(Math.PI / 2);
    addMesh(g, glossBlackMat, rearGroup, X_REAR - 0.0335, 0, 0);
  }
  rbox(0.05, 0.22, 0.92, 0.03, matteBlackMat, rearGroup, X_REAR - 0.020, 0.75, 0);
  // big hexagonal twin exhausts with chrome rims
  for (const side of [-1, 1]) {
    cyl(0.108, 0.108, 0.050, chromeMat, rearGroup, X_REAR - 0.040, 0.780, side * 0.135, 6, 0, 0, Math.PI / 2);
    cyl(0.092, 0.092, 0.060, glossBlackMat, rearGroup, X_REAR - 0.052, 0.780, side * 0.135, 6, 0, 0, Math.PI / 2);
    cyl(0.070, 0.070, 0.050, matteBlackMat, rearGroup, X_REAR - 0.060, 0.780, side * 0.135, 6, 0, 0, Math.PI / 2);
  }
  // Lamborghini script badge under the exhausts
  rbox(0.012, 0.04, 0.26, 0.012, satinMat, rearGroup, X_REAR - 0.038, 0.640, 0);
  for (const side of [-1, 1]) {
    // slim red Y tail light, kept inside the body outline (limit measured from the real skin at the tail)
    const zOut = y => sideZ(X_REAR, y) - 0.05;
    const zJ = Math.min(0.56, zOut(0.745)), zUp = Math.min(0.66, zOut(0.805)), zLo = Math.min(0.66, zOut(0.685));
    const zC = (0.17 + Math.max(zUp, zLo, zJ) + 0.02) / 2, zW = (Math.max(zUp, zLo, zJ) + 0.02) - 0.17;
    rbox(0.030, 0.07, zW + 0.02, 0.025, glossBlackMat, rearGroup, X_REAR - 0.004, 0.745, side * zC);
    const Jr = [X_REAR - 0.040, 0.745, side * zJ];
    const bars = [
      [[X_REAR - 0.040, 0.745, side * 0.17], [X_REAR - 0.044, 0.745, side * (0.17 + zJ) / 2], Jr],
      [Jr, [X_REAR - 0.036, 0.805, side * zUp]],
      [Jr, [X_REAR - 0.036, 0.685, side * zLo]],
    ];
    // each bar = hot white-pink core + red body + clear red glass shell -> looks lit from inside
    for (const pts of bars) {
      tube(pts, 0.0125, tailMat, rearGroup, 20, 12);
      tube(pts, 0.0058, tailCoreMat, rearGroup, 20, 10);
      tube(pts, 0.0190, tailGlassMat, rearGroup, 20, 14);
      for (let k = 0; k <= 4; k++) { const t = k / 4; tailGlowPts.push([pts[0][0] - 0.02, pts[0][1] + (pts[pts.length - 1][1] - pts[0][1]) * t, pts[0][2] + (pts[pts.length - 1][2] - pts[0][2]) * t]); }
    }
    const tl = new THREE.PointLight(0xff1428, 0, 2.4, 2); tl.position.set(X_REAR - 0.22, 0.745, side * 0.40); root.add(tl); tailGlowLights.push(tl);
    rbox(0.006, 0.115, zW, 0.028, redLensMat, rearGroup, X_REAR - 0.034, 0.745, side * zC);
    rbox(0.016, 0.026, 0.13, 0.006, reflectorMat, rearGroup, X_REAR - 0.030, 0.40, side * 0.70);
  }
  // rear plate with the same straight 3D lettering
  rbox(0.045, 0.17, 0.48, 0.02, matteBlackMat, rearGroup, X_REAR - 0.018, 0.495, 0);
  rbox(0.016, 0.125, 0.40, 0.008, plateMat, rearGroup, X_REAR - 0.038, 0.495, 0);
  addPlateText(rearGroup, X_REAR - 0.050, 0.473, -1);
  // diffuser + fins + rear lip
  rbox(0.18, 0.20, 1.64, 0.03, carbonMat, rearGroup, X_REAR + 0.03, 0.300, 0);
  for (let f = -4; f <= 4; f++) cbox(0.19, 0.17, 0.016, trimBlackMat, rearGroup, X_REAR - 0.055, 0.285, f * 0.19);
  rbox(0.34, 0.032, 1.30, 0.014, paintMat, rearGroup, X_REAR + 0.12, 0.985, 0, 0, 0, 0.05);

  /* ---------------- big GT rear wing over the boot ---------------- */
  {
    const WX = -2.36, WY = 1.14, HALF = 0.90, TILT = -0.10;
    const wing = new THREE.Group(); wing.name = 'Rear_GT_Wing'; wing.position.set(WX, WY, 0); wing.rotation.z = TILT; root.add(wing);
    // main plane: airfoil section (leading edge toward +X) extruded across the car
    const af = new THREE.Shape();
    af.moveTo(0.16, 0.004); af.bezierCurveTo(0.16, 0.034, 0.05, 0.040, -0.05, 0.032); af.lineTo(-0.16, 0.016); af.lineTo(-0.16, 0.002);
    af.bezierCurveTo(-0.05, -0.016, 0.10, -0.018, 0.16, 0.004);
    const plane = new THREE.Mesh(new THREE.ExtrudeGeometry(af, { depth: HALF * 2, bevelEnabled: false, curveSegments: 12 }), glossBlackMat);
    plane.position.z = -HALF; plane.castShadow = true; plane.receiveShadow = true; wing.add(plane);
    // thin painted trailing-edge flap strip
    const flap = rbox(0.030, 0.012, HALF * 2 - 0.06, 0.004, paintMat, wing, -0.165, 0.016, 0);
    // raked body-colour end plates
    for (const side of [-1, 1]) {
      const ep = new THREE.Shape();
      ep.moveTo(0.19, -0.035); ep.lineTo(0.17, 0.055); ep.lineTo(-0.12, 0.090); ep.lineTo(-0.225, 0.130); ep.lineTo(-0.225, -0.035); ep.closePath();
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(ep, { depth: 0.022, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 1 }), paintMat);
      m.position.z = side > 0 ? HALF - 0.011 : -HALF - 0.011; m.castShadow = true; wing.add(m);
    }
    // two swan-neck uprights from the deck to the wing
    for (const side of [-1, 1]) {
      const up = new THREE.Shape();
      up.moveTo(-2.15, 0.88); up.lineTo(-2.30, 0.88); up.lineTo(-2.345, 1.105); up.lineTo(-2.265, 1.105); up.closePath();
      const m = new THREE.Mesh(new THREE.ExtrudeGeometry(up, { depth: 0.034, bevelEnabled: false }), carbonMat);
      m.position.z = side * 0.42 - 0.017; m.castShadow = true; root.add(m);
    }
  }

  /* ---------------- wheels ---------------- */
  const wheels = [], frontPivots = [], allPivots = [];
  const rimBronzeMat = new THREE.MeshStandardMaterial({ color: 0xb9a3b8, roughness: 0.22, metalness: 1.0 });
  const rimDarkMat = new THREE.MeshStandardMaterial({ color: 0x1a1720, roughness: 0.45, metalness: 0.8 });
  const tyreProfile = [
    [0.272, -0.120], [0.300, -0.122], [0.330, -0.114], [0.352, -0.094],
    [0.362, -0.055], [0.364, 0.0], [0.362, 0.055], [0.352, 0.094],
    [0.330, 0.114], [0.300, 0.122], [0.272, 0.120],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const tyreGeo = new THREE.LatheGeometry(tyreProfile, 56); tyreGeo.rotateX(Math.PI / 2);
  const treadGeo = new THREE.TorusGeometry(0.3645, 0.006, 5, 56);
  const rimBarrelGeo = new THREE.CylinderGeometry(0.268, 0.268, 0.24, 48, 1, true);
  const rimLipGeo = new THREE.TorusGeometry(0.268, 0.012, 8, 56);
  const brakeDiscGeo = new THREE.CylinderGeometry(0.215, 0.215, 0.026, 44);
  const wheelConfigs = [
    { x: FRONT_AXLE, z: 0.83, front: true, name: 'Wheel_FL' },
    { x: FRONT_AXLE, z: -0.83, front: true, name: 'Wheel_FR' },
    { x: REAR_AXLE, z: 0.83, front: false, name: 'Wheel_RL' },
    { x: REAR_AXLE, z: -0.83, front: false, name: 'Wheel_RR' },
  ];
  // a flat bar between two points in the wheel plane (spoke segment)
  function spokeBar(parent, p1, p2, w, depth, mat, zPos) {
    const dx = p2[0] - p1[0], dy = p2[1] - p1[1], len = Math.hypot(dx, dy);
    const m = rbox(w, len + w * 0.6, depth, Math.min(w, depth) * 0.32, mat, parent, (p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2, zPos, 0, 0, Math.atan2(dy, dx) - Math.PI / 2, 1);
    return m;
  }
  for (const cfg of wheelConfigs) {
    const side = cfg.z > 0 ? 1 : -1;
    const pivot = new THREE.Group();
    pivot.position.set(cfg.x, WHEEL_R, cfg.z); pivot.name = cfg.name + '_Pivot';
    root.add(pivot); allPivots.push(pivot); if (cfg.front) frontPivots.push(pivot);
    // big purple brake caliper wrapping the disc (does not spin)
    const cal = addMesh(new THREE.TorusGeometry(0.205, 0.042, 8, 18, 1.05), caliperMat, pivot, 0, 0, side * 0.040, 0, 0, 0.5);
    cal.scale.set(1, 1, 0.9);
    const spin = new THREE.Group(); spin.name = cfg.name; pivot.add(spin); wheels.push(spin);
    addMesh(tyreGeo, rubberMat, spin);
    for (const tz of [-0.06, 0, 0.06]) addMesh(treadGeo, matteBlackMat, spin, 0, 0, tz);
    addMesh(brakeDiscGeo, rotorMat, spin, 0, 0, 0, Math.PI / 2, 0, 0);
    for (let d = 0; d < 20; d++) {
      const da = d / 20 * Math.PI * 2;
      cyl(0.008, 0.008, 0.030, rimDarkMat, spin, Math.sin(da) * 0.16, Math.cos(da) * 0.16, side * 0.002, 8, Math.PI / 2, 0, 0);
    }
    cyl(0.092, 0.092, 0.055, gunmetalMat, spin, 0, 0, 0, 20, Math.PI / 2, 0, 0);
    addMesh(rimBarrelGeo, rimDarkMat, spin, 0, 0, 0, Math.PI / 2, 0, 0);
    addMesh(rimLipGeo, rimBronzeMat, spin, 0, 0, side * 0.118);
    // five open Y-spokes: a stem from the hub that forks into two arms to the rim
    for (let k = 0; k < 5; k++) {
      const ang = (k / 5) * Math.PI * 2, ca = Math.cos(ang), sa = Math.sin(ang);
      const P = (r, off = 0) => [sa * r + ca * off, ca * r - sa * off];
      const zS = side * 0.108;
      spokeBar(spin, P(0.075), P(0.165), 0.052, 0.034, rimBronzeMat, zS);
      spokeBar(spin, P(0.150, -0.014), P(0.262, -0.092), 0.040, 0.030, rimBronzeMat, zS);
      spokeBar(spin, P(0.150, 0.014), P(0.262, 0.092), 0.040, 0.030, rimBronzeMat, zS);
      spokeBar(spin, P(0.090), P(0.150), 0.016, 0.040, rimDarkMat, side * 0.114);
    }
    cyl(0.082, 0.082, 0.045, rimBronzeMat, spin, 0, 0, side * 0.108, 28, Math.PI / 2, 0, 0);
    cyl(0.055, 0.055, 0.014, goldMat, spin, 0, 0, side * 0.134, 6, Math.PI / 2, 0, 0);
    for (let l = 0; l < 5; l++) {
      const la = (l / 5) * Math.PI * 2 + 0.3;
      cyl(0.0115, 0.0115, 0.022, chromeMat, spin, Math.sin(la) * 0.042, Math.cos(la) * 0.042, side * 0.122, 10, Math.PI / 2, 0, 0);
    }
  }

  /* ---------------- lamp glow + public API ---------------- */
  const glowTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 2, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)'); grad.addColorStop(0.25, 'rgba(255,255,255,0.55)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  })();
  const glows = [];
  function addGlow(x, y, z, sx, sy, color, baseOpacity) {
    const mat = new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: baseOpacity, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true, toneMapped: false });
    const sp = new THREE.Sprite(mat); sp.position.set(x, y, z); sp.scale.set(sx, sy, 1); sp.renderOrder = 20;
    root.add(sp); glows.push({ sprite: sp, base: baseOpacity }); return sp;
  }
  for (const side of [-1, 1]) {
    addGlow(X_FRONT + 0.07, 0.47, side * 0.68, 0.34, 0.12, 0xcfeaff, 0.14);
    addGlow(X_REAR - 0.05, 0.80, side * 0.52, 0.52, 0.20, 0xff2233, 0.20);
  }

  for (const q of tailGlowPts) { addGlow(q[0] - 0.02, q[1], q[2], 0.20, 0.11, 0xff1c34, 0.18); addGlow(q[0] - 0.03, q[1], q[2], 0.06, 0.04, 0xffb4be, 0.50); }

  let lightsOn = true, interiorMode = false;
  function setPaintColor(hex) {
    const col = new THREE.Color(hex);
    paintMat.color.copy(col); paintCapMat.color.copy(col); roofMat.color.copy(col);
    paintDeepMat.color.copy(col).multiplyScalar(0.55);
  }
  function setLights(active) {
    lightsOn = Boolean(active);
    drlMat.emissiveIntensity = lightsOn ? 4.4 : 1.2;
    headlightMat.emissiveIntensity = lightsOn ? 4.6 : 0.25;
    tailMat.emissiveIntensity = lightsOn ? 5.0 : 0.7;
    tailCoreMat.emissiveIntensity = lightsOn ? 6.0 : 0.5;
    tailGlassMat.emissiveIntensity = lightsOn ? 2.2 : 0.15;
    tailGlassMat.opacity = lightsOn ? 0.72 : 0.5;
    tailGlowLights.forEach(l => { l.intensity = lightsOn ? 1.1 : 0; });
    tailAmberMat.emissiveIntensity = lightsOn ? 2.2 : 0.5;
    reverseMat.emissiveIntensity = lightsOn ? 2.0 : 0.5;
    reflectorMat.emissiveIntensity = lightsOn ? 1.0 : 0.25;
    headlightLights.forEach(l => { l.intensity = lightsOn ? 5.5 : 0; });
    glows.forEach(g => { g.sprite.material.opacity = lightsOn ? g.base : g.base * 0.10; });
  }
  function setInteriorMode(active) {
    interiorMode = Boolean(active);
    glassMat.opacity = interiorMode ? 0.22 : 0.84;
    engineGlassMat.opacity = interiorMode ? 0.35 : 0.94;
  }
  function setSteeringAngle(a) { frontPivots.forEach(p => { p.rotation.y = a; }); }
  function setSpinAngle(a) { wheels.forEach(w => { w.rotation.z = a; }); }
  setLights(true);

  return {
    root, wheels, frontPivots, allPivots, headlightLights,
    materials: {
      paint: paintMat, paintCap: paintCapMat, roof: roofMat, paintDeep: paintDeepMat, drl: drlMat, headlight: headlightMat,
      tail: tailMat, tailAmber: tailAmberMat, indicator: indicatorMat, reverse: reverseMat,
      glass: glassMat, sunroof: engineGlassMat,
    },
    setPaintColor, setLights, setInteriorMode, setSteeringAngle, setSpinAngle,
    getLightsOn: () => lightsOn,
    getInteriorMode: () => interiorMode,
  };
}

return createLamborghiniRevuelto;
})();
