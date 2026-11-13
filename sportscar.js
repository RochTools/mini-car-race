const createSportsCar = (function(){
const glyphs = PLATE_GLYPHS;

/* =========================================================================
   RED SPORTS CAR — procedural studio model
   Red wedge body · slim lamps · side intakes · dark alloy wheels
   +X = front · -X = rear · +Y = up · +Z = left
   ========================================================================= */

const clamp01 = v => Math.min(1, Math.max(0, v));
const smooth = v => { v = clamp01(v); return v * v * (3 - 2 * v); };

function createSportsCar(options = {}) {
  const root = new THREE.Group();
  root.name = 'Red_Sports_Car';

  const initialColor = options.color || '#e4101b';
  const PAINT = new THREE.Color(initialColor);

  /* ---------------- materials ---------------- */
  const paintMat = new THREE.MeshPhysicalMaterial({
    color: PAINT.clone(), metalness: 0.38, roughness: 0.31,
    clearcoat: 0.8, clearcoatRoughness: 0.18, envMapIntensity: 0.85,
  });
  const paintCapMat = new THREE.MeshPhysicalMaterial({
    color: PAINT.clone(), metalness: 0.38, roughness: 0.31,
    clearcoat: 0.8, clearcoatRoughness: 0.18, envMapIntensity: 0.85, side: THREE.DoubleSide,
  });
  const roofMat = new THREE.MeshPhysicalMaterial({
    color: PAINT.clone(), metalness: 0.45, roughness: 0.34,
    clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 0.9, side: THREE.DoubleSide,
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
  const caliperMat = new THREE.MeshStandardMaterial({ color: 0x303236, roughness: 0.3, metalness: 0.4 });
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xd8a928, roughness: 0.25, metalness: 1.0 });
  const panelGapMat = new THREE.MeshBasicMaterial({ color: 0x08030d });
  const linerMat = new THREE.MeshStandardMaterial({ color: 0x07080a, roughness: 0.96, side: THREE.DoubleSide });

  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0a0d18, roughness: 0.04, metalness: 0.05,
    transparent: true, opacity: 0.66, clearcoat: 1.0, clearcoatRoughness: 0.025,
    envMapIntensity: 1.8, side: THREE.DoubleSide, depthWrite: false,
  });
  const engineGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x05070a, roughness: 0.05, metalness: 0.15, transparent: true, opacity: 0.94,
    clearcoat: 1.0, envMapIntensity: 1.6, side: THREE.DoubleSide, depthWrite: false,
  });
  const clearLensMat = new THREE.MeshPhysicalMaterial({
    color: 0xd9eeff, roughness: 0.035, metalness: 0.0, transparent: true, opacity: 0.17,
    ior: 1.49, reflectivity: 0.65,
    clearcoat: 1.0, clearcoatRoughness: 0.025, envMapIntensity: 0.85,
    side: THREE.FrontSide, depthWrite: false,
  });
  const redLensMat = new THREE.MeshPhysicalMaterial({
    color: 0x7d0710, roughness: 0.05, transparent: true, opacity: 0.5,
    clearcoat: 1.0, side: THREE.DoubleSide, depthWrite: false,
  });
  const drlMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, emissive: 0xd9f3ff, emissiveIntensity: 3.8, roughness: 0.14, toneMapped: false,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xcce6fa, emissive: 0xe8f4ff, emissiveIntensity: 1.2,
    metalness: 0.15, roughness: 0.14,
  });
  const projectorGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x84a7c7, roughness: 0.025, metalness: 0.08,
    transparent: true, opacity: 0.62, clearcoat: 1, clearcoatRoughness: 0.015,
    envMapIntensity: 1.25, depthWrite: false,
  });
  const reflectorCupMat = new THREE.MeshStandardMaterial({
    color: 0x8795a3, metalness: 1, roughness: 0.19, side: THREE.DoubleSide,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0x390008, emissive: 0xff102e, emissiveIntensity: 3.2, roughness: 0.18, toneMapped: false,
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
  function tube(points, radius, mat, parent = root, tubular = 42) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p[0], p[1], p[2])), false, 'catmullrom', 0.08);
    return addMesh(new THREE.TubeGeometry(curve, tubular, radius, 7, false), mat, parent);
  }
  function flatPanel(points, mat, side) {
    const shape = new THREE.Shape(points.map(p => new THREE.Vector2(p[0], p[1])));
    const geo = new THREE.ShapeGeometry(shape, 3);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      pos.setZ(i, side * (sideZ(x, y) + 0.007));
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
  const ARCH_R = 0.475;
  const X_FRONT = 2.48;
  const X_REAR = -2.48;

  // The shoulder stays low while the bonnet falls decisively toward the nose.
  // Bringing the windscreen forward (see CABIN below) leaves a shorter,
  // a short sporty wedge ahead of the front axle.
  const TOP_KEYS = [
    [-2.48, 0.90], [-2.34, 0.96], [-2.00, 0.985], [-1.52, 0.99],
    [-1.05, 0.885], [-0.40, 0.855], [0.35, 0.845], [0.95, 0.842],
    [1.20, 0.835], [1.52, 0.814], [1.86, 0.774], [2.16, 0.720],
    [2.38, 0.664], [2.48, 0.622],
  ];
  const WIDTH_KEYS = [
    [-2.48, 0.94], [-2.32, 1.00], [-1.80, 1.018], [-1.00, 1.01],
    [0.00, 1.002], [1.00, 1.005], [1.80, 0.992], [2.22, 0.945], [2.48, 0.825],
  ];
  const BOTTOM_KEYS = [
    [-2.48, 0.24], [-2.05, 0.175], [0.90, 0.165], [2.05, 0.18], [2.48, 0.235],
  ];
  function sampleKeys(keys, x) {
    if (x <= keys[0][0]) return keys[0][1];
    const last = keys[keys.length - 1];
    if (x >= last[0]) return last[1];
    for (let i = 0; i < keys.length - 1; i++) {
      const [x0, v0] = keys[i], [x1, v1] = keys[i + 1];
      if (x >= x0 && x <= x1) return v0 + (v1 - v0) * smooth((x - x0) / (x1 - x0));
    }
    return last[1];
  }
  // A monotone cubic hood profile avoids the repeated ridges caused by
  // independently easing every segment of the old bonnet.
  function makeSmoothTop(keys) {
    const h=[], slope=[], tangent=[];
    for(let i=0;i<keys.length-1;i++){h[i]=keys[i+1][0]-keys[i][0];slope[i]=(keys[i+1][1]-keys[i][1])/h[i];}
    tangent[0]=slope[0];tangent[keys.length-1]=slope[slope.length-1];
    for(let i=1;i<keys.length-1;i++){
      if(slope[i-1]*slope[i]<=0)tangent[i]=0;
      else {const a=2*h[i]+h[i-1],b=h[i]+2*h[i-1];tangent[i]=(a+b)/(a/slope[i-1]+b/slope[i]);}
    }
    return x=>{
      if(x<=keys[0][0])return keys[0][1];
      if(x>=keys[keys.length-1][0])return keys[keys.length-1][1];
      let i=0;while(x>keys[i+1][0])i++;
      const t=(x-keys[i][0])/h[i], t2=t*t, t3=t2*t;
      return (2*t3-3*t2+1)*keys[i][1]+(t3-2*t2+t)*h[i]*tangent[i]+(-2*t3+3*t2)*keys[i+1][1]+(t3-t2)*h[i]*tangent[i+1];
    };
  }
  const topAt = makeSmoothTop(TOP_KEYS);
  const smoothWidth = makeSmoothTop(WIDTH_KEYS);
  const widthAt = x => x > 1.0 ? smoothWidth(x) : sampleKeys(WIDTH_KEYS, x);
  const ARCH_BLEND = ARCH_R + 0.11;
  const bottomAt = x => {
    let y = sampleKeys(BOTTOM_KEYS, x);
    if (x > 2.05) {
      const t = clamp01((x - 2.05) / (X_FRONT - 2.05));
      y = 0.18 + 0.055 * (2 * t * t - t * t * t);
    }
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
  const sideZ = (x, y) => {
    const w = widthAt(x), y1 = topAt(x), y0 = Math.min(bottomAt(x), y1 - 0.06);
    const t = clamp01((y - y0) / Math.max(0.001, y1 - y0));
    return w * (1.0 - 0.10 * t * t) * 0.999;
  };

  // The bonnet is a continuous painted surface. Only subtle, symmetrical
  // shoulder and crease forms remain; the headlights belong on the front face.
  function frontTopDetail(x, z) {
    const fade=smooth((x-1.02)/0.36)*(1-smooth((x-2.34)/0.14));
    const fender=0.040*Math.exp(-Math.pow((x-1.50)/0.55,2))*Math.exp(-Math.pow((Math.abs(z)-0.75)/0.17,2));
    // Two broad diagonal ridges lead from the windscreen toward the nose.
    const creaseCentre=0.30+0.25*(2.38-x)/1.18;
    const ridge=0.018*Math.exp(-Math.pow((Math.abs(z)-creaseCentre)/0.105,2));
    const centreCrown=0.010*Math.exp(-Math.pow(z/0.36,2));
    return fade*(fender+ridge+centreCrown);
  }

  function halfSection(x) {
    const w = widthAt(x);
    const y1 = topAt(x);
    const y0 = Math.min(bottomAt(x), y1 - 0.055);
    const h = Math.max(0.05, y1 - y0);
    const pts = [];
    const push = (z, y) => pts.push([Math.max(0, z), Math.min(y, y1 + (x > 1.02 ? 0.08 : 0.01))]);
    push(0, y0); push(w * 0.46, y0); push(w * 0.74, y0);
    push(w * 0.92, y0 + h * 0.16);
    push(w * 1.00, y0 + h * 0.40);
    push(w * 0.99, y0 + h * 0.66);
    // Never let the shoulder dip below the top of its wheel-arch section.
    // The previous constant drop made a crease that looked hammer-dented.
    const shoulderRoll=1-0.45*smooth((x-1.94)/0.54);
    const shoulderOffset=x>1.02?-Math.min(0.035,h*0.16)*shoulderRoll:-0.035;
    push(w * 0.90, y1 + shoulderOffset + frontTopDetail(x,w*0.90));
    const topSections = [[0.90, shoulderOffset], [0.64, 0], [0.30, 0.006], [0, 0.008]];
    for (let q = 0; q < topSections.length - 1; q++) {
      const [a, ya] = topSections[q], [b, yb] = topSections[q + 1];
      for (let i = 1; i <= 10; i++) {
        const t = i / 10, z = w * (a + (b - a) * t);
        const base = y1 + ya + (yb - ya) * (x>1.02?smooth(t):t);
        push(z, base + frontTopDetail(x, z));
      }
    }
    // A densely sampled, softly rounded perimeter prevents hairline cracks
    // where the convex front face meets the fenders and the lower return.
    const rounded=[],blend=smooth((x-1.97)/0.35),steps=6;
    for(let j=0;j<6;j++){
      const a=j===0?[-pts[1][0],pts[1][1]]:pts[j-1],b=pts[j],c=pts[j+1],d=pts[j+2];
      for(let k=0;k<steps;k++){
        const t=k/steps,t2=t*t,t3=t2*t;
        const q=[0,0];
        for(let v=0;v<2;v++){
          const linear=b[v]+(c[v]-b[v])*t;
          const curved=0.5*((2*b[v])+(-a[v]+c[v])*t+(2*a[v]-5*b[v]+4*c[v]-d[v])*t2+(-a[v]+3*b[v]-3*c[v]+d[v])*t3);
          q[v]=linear+(curved-linear)*blend;
        }
        q[0]=Math.max(0,Math.min(w,q[0]));q[1]=Math.max(y0,q[1]);rounded.push(q);
      }
    }
    rounded.push(...pts.slice(6));return rounded;
  }
  // The upper bumper rolls OVER from the bonnet, not down from a sharp
  // edge. A strongly convex double-curvature surface replaces the old flat
  // front plate. The Hermite approach has zero x-tangent at its boundary,
  // making the bonnet and bumper tangent-continuous, not just colour-matched.
  const frontXAt = (y, z = 0) => {
    const dy = y - 0.405;
    return 2.395 - 4.10 * dy * dy - 4.0 * Math.pow(dy, 4)
      - 0.255 * Math.pow(z / 0.86, 2);
  };
  const frontNormalAt = (y,z) => {
    const dy=y-0.405;
    return new THREE.Vector3(1, 8.20*dy+16.0*dy*dy*dy, 0.510*z/(0.86*0.86)).normalize();
  };
  const noseX = (x, y, z = 0) => {
    const start=1.20, length=X_FRONT-start;
    if(x<=start)return x;
    const t=clamp01((x-start)/length);
    return start+(frontXAt(y,z)-start)*smooth(t)+length*t*(1-t)*(1-t);
  };
  const ringAt = x => {
    const half = halfSection(x), ring = [];
    for (let j = 0; j < half.length; j++) ring.push([noseX(x,half[j][1],half[j][0]), half[j][1], half[j][0]]);
    for (let j = half.length - 2; j >= 1; j--) ring.push([noseX(x,half[j][1],-half[j][0]), half[j][1], -half[j][0]]);
    return ring;
  };
  {
    const NX = 140, rings = [];
    for (let i = 0; i <= NX; i++) rings.push(ringAt(X_FRONT - (X_FRONT - X_REAR) * i / NX));
    const M = rings[0].length, posArr = [], idx = [], pocketIdx = [];
    for (const ring of rings) for (const p of ring) posArr.push(p[0], p[1], p[2]);
    for (let i = 0; i < NX; i++) for (let j = 0; j < M; j++) {
      const a = i * M + j, b = i * M + ((j + 1) % M), c = (i + 1) * M + j, d = (i + 1) * M + ((j + 1) % M);
      idx.push(a, b, c, b, d, c);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(posArr, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    // Match the cap normals at the shared border. This also removes the
    // hard shading line that made the previous rounded nose look cut flat.
    const ns=g.getAttribute('normal');
    for(let i=0;i<=NX;i++){
      const rawX=X_FRONT-(X_FRONT-X_REAR)*i/NX;
      const mix=smooth((rawX-2.25)/(X_FRONT-2.25));
      if(!mix)continue;
      for(let j=0;j<M;j++){
        const k=i*M+j,p=rings[i][j],n=frontNormalAt(p[1],p[2]);
        n.lerp(new THREE.Vector3(ns.getX(k),ns.getY(k),ns.getZ(k)),1-mix).normalize();
        ns.setXYZ(k,n.x,n.y,n.z);
      }
    }
    const body = new THREE.Mesh(g, paintMat);
    body.name = 'SportsCar_BodyShell'; body.castShadow = true; body.receiveShadow = true;
    root.add(body);
    for (const xFace of [X_REAR]) {
      const ring = ringAt(xFace);
      const cy = ring.reduce((s, p) => s + p[1], 0) / ring.length;
      const posF = [xFace, cy, 0], indexF = [];
      for (const p of ring) posF.push(p[0], p[1], p[2]);
      for (let j = 1; j <= ring.length; j++) indexF.push(0, j, j % ring.length + 1);
      const gf = new THREE.BufferGeometry();
      gf.setAttribute('position', new THREE.Float32BufferAttribute(posF, 3));
      gf.setIndex(indexF); gf.computeVertexNormals();
      const cap = new THREE.Mesh(gf, paintCapMat);
      cap.castShadow = true; cap.receiveShadow = true; root.add(cap);
    }
  }

  // underbody, side skirts, wheel-arch liners and lips
  cbox(2.15, 0.09, 1.52, matteBlackMat, root, 0, 0.19, 0);
  // The front floor is the curved splitter below, not a protruding box.
  cbox(0.48, 0.09, 1.50, matteBlackMat, root, -2.13, 0.20, 0);
  for (const side of [-1, 1]) {
    rbox(1.95, 0.045, 0.045, 0.012, carbonMat, root, 0, 0.190, side * 0.935);
    for (const ax of [FRONT_AXLE, REAR_AXLE]) {
      // The old front wheel-well sheet crossed through the fender and bonnet;
      // remove it rather than letting an inner black surface poke through.
      if (ax === FRONT_AXLE) continue;
      const pts = [];
      for (let k = 0; k <= 20; k++) {
        const a = 0.05 + (Math.PI - 0.10) * k / 20;
        pts.push([ax + (ARCH_R + 0.012) * Math.cos(a), WHEEL_R + (ARCH_R + 0.012) * Math.sin(a), side * 1.002]);
      }
      tube(pts, 0.012, trimBlackMat, root, 34);
      const posArr = [], idx = [], N = 18;
      for (let i = 0; i <= N; i++) {
        const a = Math.PI * i / N;
        const x = ax - (ARCH_R - 0.012) * Math.cos(a), y = WHEEL_R + (ARCH_R - 0.012) * Math.sin(a);
        // Keep the front liner inside the wheel well rather than stretching
        // across the bonnet; the rear liner is deliberately unchanged.
        const innerZ = ax === FRONT_AXLE ? 0.70 : 0.05;
        posArr.push(x, y, side * 1.0, x, y, side * innerZ);
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

  /* ---------------- sculpted nose, bumper and headlights ---------------- */
  const frontGroup = new THREE.Group(); frontGroup.name = 'Front_Body_Work'; root.add(frontGroup);
  const headlightLights = []; // shadow-free forward beams stay light on mobile
  // Build a closed front fascia with two actual openings cut into the face.
  const outline = ringAt(X_FRONT).map(p => new THREE.Vector2(p[2], p[1]));
  const fasciaShape = new THREE.Shape(outline);
  const holes = [];
  const lampOutline = new THREE.Shape();
  lampOutline.moveTo(0.190,0.547);
  lampOutline.bezierCurveTo(0.300,0.568,0.590,0.609,0.680,0.599);
  lampOutline.quadraticCurveTo(0.727,0.592,0.744,0.552);
  lampOutline.quadraticCurveTo(0.728,0.519,0.680,0.493);
  lampOutline.bezierCurveTo(0.550,0.482,0.355,0.461,0.257,0.474);
  lampOutline.quadraticCurveTo(0.207,0.495,0.190,0.547);
  const lampProfile=lampOutline.getPoints(8).slice(0,-1).map(v=>[v.x,v.y]);
  for (const side of [-1, 1]) {
    // Separate upper headlamp recesses and lower air intakes.
    const profiles = [
      { type: 'Headlamp_Housing', depth: 0.12, points: lampProfile },
      { type: 'Recessed_Air_Intake', depth: 0.13,
        points: [[0.29,0.412],[0.69,0.428],[0.72,0.343],[0.61,0.270],[0.34,0.272]] },
    ];
    for (const profile of profiles) {
      const vec = profile.points.map(([z,y]) => new THREE.Vector2(side*z,y));
      if (THREE.ShapeUtils.isClockWise(vec) === THREE.ShapeUtils.isClockWise(outline)) vec.reverse();
      const hole = new THREE.Path(vec); hole.closePath(); fasciaShape.holes.push(hole);
      holes.push({poly:vec, type:profile.type, depth:profile.depth, side});
    }
  }
  // Wide central grille, cut into the actual front fascia.
  {
    const vec = [[-0.265,0.405],[0.265,0.405],[0.235,0.272],[-0.235,0.272]]
      .map(([z,y])=>new THREE.Vector2(z,y));
    if (THREE.ShapeUtils.isClockWise(vec) === THREE.ShapeUtils.isClockWise(outline)) vec.reverse();
    const hole = new THREE.Path(vec); hole.closePath(); fasciaShape.holes.push(hole);
    holes.push({poly:vec, type:'Central_Grille',depth:0.10,side:0});
  }
  // Subdivide the face and analytically shade its curved surface. The holes
  // remain true openings; no front-facing texture or flat polygon is used.
  function curvedFrontGeometry(shape, depth=0, divisions=6) {
    const src=new THREE.ShapeGeometry(shape,2);
    const pos=src.getAttribute('position'), ind=src.index;
    const verts=[],normals=[];
    function point(i){return [pos.getX(i),pos.getY(i)];}
    function emit(z,y){
      verts.push(frontXAt(y,z)-depth,y,z);
      const norm=frontNormalAt(y,z);
      normals.push(norm.x,norm.y,norm.z);
    }
    const triCount=ind ? ind.count/3 : pos.count/3;
    for(let k=0;k<triCount;k++){
      const A=point(ind?ind.getX(k*3):k*3),B=point(ind?ind.getX(k*3+1):k*3+1),C=point(ind?ind.getX(k*3+2):k*3+2);
      const pt=(i,j)=>[A[0]+(B[0]-A[0])*i/divisions+(C[0]-A[0])*j/divisions,A[1]+(B[1]-A[1])*i/divisions+(C[1]-A[1])*j/divisions];
      const out=p=>emit(p[0],p[1]);
      for(let i=0;i<divisions;i++)for(let j=0;j<divisions-i;j++){
        out(pt(i,j));out(pt(i,j+1));out(pt(i+1,j));
        if(i+j<divisions-1){out(pt(i+1,j));out(pt(i,j+1));out(pt(i+1,j+1));}
      }
    }
    src.dispose();
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));return g;
  }
  const fasciaGeo = curvedFrontGeometry(fasciaShape);
  const fascia = addMesh(fasciaGeo, paintCapMat, frontGroup); fascia.name='Integrated_Front_Bumper';
  // Each intake has a dark recessed back and real side walls, not a painted rectangle.
  for (const {poly,type,depth,side} of holes) {
    const shape = new THREE.Shape(poly);
    const g = curvedFrontGeometry(shape,depth,3);
    const back=addMesh(g,type==='Headlamp_Housing'?glossBlackMat:matteBlackMat,frontGroup); back.material.side=THREE.DoubleSide; back.name=type+(side>0?'_Left':'_Right');
    const verts=[],ix=[];
    const edgeSteps=6;
    for(let i=0;i<poly.length;i++)for(let k=0;k<edgeSteps;k++){
      const a=poly[i],b=poly[(i+1)%poly.length],t=k/edgeSteps,z=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;
      verts.push(frontXAt(y,z),y,z,frontXAt(y,z)-depth,y,z);
    }
    const edgeCount=poly.length*edgeSteps;
    for(let i=0;i<edgeCount;i++){const j=(i+1)%edgeCount;ix.push(2*i,2*j,2*i+1,2*j,2*j+1,2*i+1)}
    const wg=new THREE.BufferGeometry();wg.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));wg.setIndex(ix);wg.computeVertexNormals();
    const wall=addMesh(wg,trimBlackMat,frontGroup); wall.material.side=THREE.DoubleSide;
  }
  // Real 3D ribs inside the central opening, dark and set back from the bumper.
  for (let y=0.294;y<=0.390;y+=0.024) {
    cbox(0.006,0.006,0.44,gunmetalMat,frontGroup,frontXAt(y,0)-0.075,y,0);
  }
  for (let z=-0.19;z<=0.19;z+=0.047) {
    cbox(0.006,0.108,0.006,trimBlackMat,frontGroup,frontXAt(0.34,z)-0.074,0.34,z);
  }
  // Automotive lamp assemblies: shaped outer glass, a sealed black housing,
  // a slim light guide, reflector cups, metal bezels and convex optical lenses.
  // The projectors face forwards behind the sloping cover, not up at the sky.
  for (const side of [-1,1]) {
    const suffix=side>0?'Left':'Right';
    const profile=holes.find(h=>h.type==='Headlamp_Housing'&&h.side===side);
    const edgePoints=profile.poly.map(v=>[frontXAt(v.y,v.x)-0.003,v.y,v.x]);
    edgePoints.push(edgePoints[0]);
    const gasket=tube(edgePoints,0.0045,trimBlackMat,frontGroup,72);
    gasket.name='Headlight_Seal_'+suffix;
    const xyz=(y,z,depth=0.022)=>[frontXAt(y,side*z)-depth,y,side*z];
    const led=tube([
      xyz(0.489,0.265),xyz(0.490,0.36),xyz(0.500,0.49),
      xyz(0.513,0.615),xyz(0.533,0.683),xyz(0.568,0.710)
    ],0.0065,drlMat,frontGroup,42);
    led.name='Front_LED_'+suffix;
    for(let k=0;k<2;k++){
      const z=side*(0.352+k*0.178),y=0.531+k*0.020;
      const module=new THREE.Group();module.name='Projector_Assembly_'+suffix+'_'+(k+1);
      module.position.set(frontXAt(y,z)-0.061,y,z);
      module.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),new THREE.Vector3(1,0.035,side*0.08).normalize());
      frontGroup.add(module);
      const radius=k===0?0.036:0.032;
      const cup=addMesh(new THREE.CylinderGeometry(radius,radius*0.64,0.031,32,1,true),reflectorCupMat,module,0,0,-0.014,Math.PI/2);
      cup.name='Reflector_Cup_'+suffix;
      addMesh(new THREE.CircleGeometry(radius*0.86,32),trimBlackMat,module,0,0,0.003);
      const bezel=addMesh(new THREE.TorusGeometry(radius,0.0035,8,32),chromeMat,module);
      bezel.name='Projector_Bezel_'+suffix;
      const light=addMesh(new THREE.CircleGeometry(radius*0.62,32),headlightMat,module,0,0,0.006);
      light.name='Round_Projector_'+suffix;
      addMesh(new THREE.TorusGeometry(radius*0.78,0.0015,6,32),gunmetalMat,module,0,0,0.008);
      const optic=addMesh(new THREE.SphereGeometry(radius*0.87,24,12),projectorGlassMat,module,0,0,0.009);
      optic.scale.z=0.38;optic.name='Convex_Projector_Glass_'+suffix;
      optic.castShadow=false;
    }
    const lens=addMesh(curvedFrontGeometry(new THREE.Shape(profile.poly),0.003,6),clearLensMat,frontGroup);
    lens.name='Headlight_Lens_'+suffix;lens.castShadow=false;lens.renderOrder=3;
    const glassEdge=tube(edgePoints,0.0016,projectorGlassMat,frontGroup,72);
    glassEdge.name='Headlight_Glass_Edge_'+suffix;glassEdge.castShadow=false;
    const beam=new THREE.SpotLight(0xe2efff,5.5,6.5,0.31,0.85,2);
    beam.name='Front_Beam_'+suffix;
    beam.position.set(frontXAt(0.53,side*0.44)+0.018,0.53,side*0.44);
    beam.target.position.set(6.2,0.025,side*0.58);
    frontGroup.add(beam,beam.target);headlightLights.push(beam);
  }
  // Subtle hood shut lines follow the curved metal itself, not a floating overlay.
  function bonnetSurface(x,z) {
    const u=Math.abs(z)/widthAt(x); let offset;
    const h=Math.max(0.05,topAt(x)-Math.min(bottomAt(x),topAt(x)-0.055));
    if(u>=0.64) offset=-Math.min(0.035,h*0.16)*(1-0.45*smooth((x-1.94)/0.54))*smooth((u-0.64)/0.26);
    else if(u>=0.30) offset=0.006*smooth((0.64-u)/0.34);
    else offset=0.006+0.002*smooth((0.30-u)/0.30);
    return topAt(x)+offset+frontTopDetail(x,z);
  }
  for (const side of [-1,1]) {
    const points=[];
    for(let i=0;i<=24;i++){
      const t=i/24, x=1.22+1.10*t, z=side*(0.56-0.25*t);
      const y=bonnetSurface(x,z)+0.003;
      points.push([noseX(x,y,z),y,z]);
    }
    const line=tube(points,0.0028,paintDeepMat,frontGroup,36);
    line.name=side>0?'Bonnet_Contour_Left':'Bonnet_Contour_Right';
  }
  // A low wing-shaped splitter, extruded as one continuous aerodynamic piece.
  // The black underside stays BELOW the bumper and inside its silhouette.
  // A small bevel blends it into the lower body instead of covering the nose.
  const splitterShape=new THREE.Shape();
  const halfWidth=0.65, steps=20, yLip=0.235;
  for(let i=0;i<=steps;i++){
    const z=-halfWidth+2*halfWidth*i/steps, x=frontXAt(yLip,z)-0.018;
    if(i===0)splitterShape.moveTo(x,z);else splitterShape.lineTo(x,z);
  }
  for(let i=steps;i>=0;i--){
    const z=-halfWidth+2*halfWidth*i/steps;
    splitterShape.lineTo(frontXAt(yLip,z)-0.14,z);
  }
  splitterShape.closePath();
  const splitterGeo=new THREE.ExtrudeGeometry(splitterShape,{depth:.025,bevelEnabled:true,bevelSize:.004,bevelThickness:.003,bevelSegments:2});
  splitterGeo.rotateX(Math.PI/2);splitterGeo.translate(0,.229,0);
  const splitter=addMesh(splitterGeo,carbonMat,frontGroup);splitter.name='Integrated_Front_Splitter';
  // Keep the existing front registration plate, badge and colour materials.
  // The reference nose is clean, without a front number plate or badge.

  /* ---------------- glass canopy, roof and engine cover ---------------- */
  // Slightly taller canopy with a forward windscreen foot.  The extra height is
  // concentrated at the crown, keeping the belt line and doors untouched.
  const CABIN = [
    { x: 1.20, base: 0.812, top: 0.855, w: 0.790 },
    { x: 0.90, base: 0.818, top: 1.075, w: 0.765 },
    { x: 0.50, base: 0.828, top: 1.235, w: 0.730 },
    { x: 0.08, base: 0.838, top: 1.295, w: 0.705 },
    { x: -0.50, base: 0.850, top: 1.292, w: 0.690 },
    { x: -0.85, base: 0.858, top: 1.225, w: 0.660 },
    { x: -1.16, base: 0.868, top: 1.075, w: 0.585 },
    { x: -1.40, base: 0.878, top: 0.905, w: 0.490 },
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
      const x = 1.20 + (-1.40 - 1.20) * i / NX, c = cabinParams(x);
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
      const x = 0.44 + (-1.10 - 0.44) * i / NX;
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
      const u = i / 4, x = 1.185 + (0.40 - 1.185) * u, zAbs = 0.765 + (0.575 - 0.765) * u;
      pts.push([x, canopyY(x, zAbs) + 0.008, side * zAbs]);
    }
    tube(pts, 0.021, paintMat, root, 24);
    const pts2 = [];
    for (let i = 0; i <= 4; i++) {
      const u = i / 4, x = -0.80 + (-1.36 + 0.80) * u, zAbs = 0.590 + (0.460 - 0.590) * u;
      pts2.push([x, canopyY(x, zAbs) + 0.008, side * zAbs]);
    }
    tube(pts2, 0.023, paintMat, root, 20);
  }
  // black louvred engine cover behind the cabin
  rbox(0.92, 0.035, 0.82, 0.025, engineGlassMat, root, -1.62, 0.995, 0, 0, 0, -0.035);
  for (let i = 0; i < 5; i++) cbox(0.035, 0.018, 0.72, glossBlackMat, root, -1.94 + i * 0.16, 1.018 - i * 0.006, 0, 0, 0, -0.035);
  rbox(0.30, 0.045, 0.46, 0.02, carbonMat, root, -1.62, 0.965, 0);
  cyl(0.055, 0.065, 0.05, gunmetalMat, root, -1.62, 0.945, 0, 20, 0, 0, 0.2);

  /* ---------------- interior (two seats, seen through the glass) ---------------- */
  const interior = new THREE.Group(); root.add(interior);
  const dashMat = new THREE.MeshStandardMaterial({ color: 0x121014, roughness: 0.8, metalness: 0.1 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x202024, roughness: 0.72, metalness: 0.05 });
  const seatInsertMat = new THREE.MeshStandardMaterial({ color: 0x323237, roughness: 0.62, metalness: 0.05 });
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
    rbox(0.09, 0.13, 0.21, 0.04, seatMat, interior, -0.49, 1.14, z, 0, 0, 0.13);
  }
  addMesh(new THREE.TorusGeometry(0.115, 0.016, 8, 26), dashMat, interior, 0.34, 0.94, 0.34, 0, Math.PI / 2, 0.35);
  rbox(0.18, 0.032, 0.032, 0.01, dashMat, interior, 0.43, 0.885, 0.34, 0, 0, -0.5);

  /* ---------------- side sculpting: scissor doors + engine intakes ---------------- */
  for (const side of [-1, 1]) {
    const zAt = (x, y) => side * (sideZ(x, y) + 0.006);
    // door shut-line (scissor-door wedge)
    tube([[0.78, 0.83, zAt(0.78, 0.83)], [0.60, 0.52, zAt(0.60, 0.52)], [0.50, 0.30, zAt(0.50, 0.30)], [-0.52, 0.29, zAt(-0.52, 0.29)], [-0.60, 0.82, zAt(-0.60, 0.82)]], 0.0055, panelGapMat, root, 30);
    // shoulder blade sweeping into the rear intake
    tube([[0.95, 0.80, zAt(0.95, 0.80)], [0.25, 0.84, zAt(0.25, 0.84)], [-0.45, 0.88, zAt(-0.45, 0.88)], [-0.78, 0.92, zAt(-0.78, 0.92)]], 0.007, paintDeepMat, root, 30);
    tube([[0.70, 0.48, zAt(0.70, 0.48)], [0.05, 0.43, zAt(0.05, 0.43)], [-0.55, 0.47, zAt(-0.55, 0.47)]], 0.006, paintDeepMat, root, 24);
    // flush handle
    rbox(0.15, 0.022, 0.018, 0.008, trimBlackMat, root, 0.02, 0.78, zAt(0.02, 0.78) + side * 0.006);
    // huge black side engine intake behind the door
    flatPanel([[-0.91,0.81],[-1.14,0.77],[-1.17,0.50],[-0.99,0.48]], matteBlackMat, side);
    for (let y=0.53;y<0.77;y+=0.055) {
      tube([[-1.14,y,side*(sideZ(-1.14,y)+0.013)],[-0.98,y,side*(sideZ(-0.98,y)+0.013)]],0.006,gunmetalMat,root,5);
    }
    rbox(0.34, 0.05, 0.035, 0.012, paintMat, root, -0.78, 0.862, side * (sideZ(-0.78, 0.862) + 0.008), 0, side * 0.05, -0.10);
    // mirror on a slim stalk
    cbox(0.05, 0.025, 0.09, glossBlackMat, root, 0.76, 0.90, side * 1.02);
    rbox(0.15, 0.085, 0.125, 0.03, paintMat, root, 0.72, 0.955, side * 1.075, 0, -side * 0.10, 0);
    cbox(0.010, 0.062, 0.092, gunmetalMat, root, 0.645, 0.958, side * 1.065);
  }

  /* ---------------- rear fascia + Y tail lights ---------------- */
  const rearGroup = new THREE.Group(); root.add(rearGroup);
  rbox(0.055, 0.46, 1.62, 0.04, glossBlackMat, rearGroup, X_REAR - 0.006, 0.66, 0);
  rbox(0.05, 0.20, 0.86, 0.03, matteBlackMat, rearGroup, X_REAR - 0.018, 0.76, 0);
  // high hexagonal twin exhausts
  for (const side of [-1, 1]) {
    cyl(0.078, 0.078, 0.055, chromeMat, rearGroup, X_REAR - 0.035, 0.815, side * 0.115, 6, 0, 0, Math.PI / 2);
    cyl(0.062, 0.062, 0.060, matteBlackMat, rearGroup, X_REAR - 0.048, 0.815, side * 0.115, 6, 0, 0, Math.PI / 2);
  }
  for (const side of [-1, 1]) {
    rbox(0.035, 0.13, 0.50, 0.03, glossBlackMat, rearGroup, X_REAR - 0.010, 0.79, side * 0.52);
    // signature Y tail light
    tube([[X_REAR - 0.036, 0.805, side * 0.16], [X_REAR - 0.040, 0.805, side * 0.46], [X_REAR - 0.034, 0.875, side * 0.76]], 0.0155, tailMat, rearGroup, 16);
    tube([[X_REAR - 0.040, 0.805, side * 0.46], [X_REAR - 0.034, 0.725, side * 0.76]], 0.0155, tailMat, rearGroup, 10);
    rbox(0.006, 0.115, 0.46, 0.028, redLensMat, rearGroup, X_REAR - 0.030, 0.79, side * 0.52);
    rbox(0.016, 0.026, 0.13, 0.006, reflectorMat, rearGroup, X_REAR - 0.030, 0.43, side * 0.68);
  }
  // rear plate with the same straight 3D lettering
  rbox(0.045, 0.17, 0.48, 0.02, matteBlackMat, rearGroup, X_REAR - 0.018, 0.545, 0);
  rbox(0.016, 0.125, 0.40, 0.008, plateMat, rearGroup, X_REAR - 0.038, 0.545, 0);
  addPlateText(rearGroup, X_REAR - 0.050, 0.523, -1);
  // diffuser + fins + subtle rear lip
  rbox(0.16, 0.17, 1.55, 0.03, carbonMat, rearGroup, X_REAR + 0.03, 0.285, 0);
  for (let f = -3; f <= 3; f++) cbox(0.17, 0.15, 0.016, trimBlackMat, rearGroup, X_REAR - 0.045, 0.275, f * 0.21);
  rbox(0.30, 0.032, 1.38, 0.014, paintMat, rearGroup, X_REAR + 0.10, 0.972, 0, 0, 0, 0.05);

  // Raised rear wing and its two supports, matching the reference silhouette.
  const wing = rbox(0.24,0.045,1.66,0.016,carbonMat,root,-2.08,1.235,0,0,0,-0.05);
  wing.name='Rear_Wing';
  for (const side of [-1,1]) {
    const strut=rbox(0.08,0.24,0.065,0.015,carbonMat,root,-2.01,1.108,side*0.60,0,0,-0.22);
    strut.name=side>0?'Wing_Support_Left':'Wing_Support_Right';
    rbox(0.24,0.10,0.045,0.015,paintMat,root,-2.08,1.25,side*0.84,0,0,-0.05);
  }

  /* ---------------- wheels ---------------- */
  const wheels = [], frontPivots = [], allPivots = [];
  const tyreProfile = [
    [0.255, -0.125], [0.295, -0.124], [0.328, -0.115], [0.352, -0.095],
    [0.363, -0.055], [0.365, 0.0], [0.363, 0.055], [0.352, 0.095],
    [0.328, 0.115], [0.295, 0.124], [0.255, 0.125],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const tyreGeo = new THREE.LatheGeometry(tyreProfile, 52); tyreGeo.rotateX(Math.PI / 2);
  const treadGeo = new THREE.TorusGeometry(0.3655, 0.006, 5, 52);
  const rimBarrelGeo = new THREE.CylinderGeometry(0.252, 0.252, 0.225, 44, 1, true);
  const rimLipGeo = new THREE.TorusGeometry(0.251, 0.013, 8, 52);
  const brakeDiscGeo = new THREE.CylinderGeometry(0.205, 0.205, 0.024, 38);
  const wheelConfigs = [
    { x: FRONT_AXLE, z: 0.83, front: true, name: 'Wheel_FL' },
    { x: FRONT_AXLE, z: -0.83, front: true, name: 'Wheel_FR' },
    { x: REAR_AXLE, z: 0.83, front: false, name: 'Wheel_RL' },
    { x: REAR_AXLE, z: -0.83, front: false, name: 'Wheel_RR' },
  ];
  for (const cfg of wheelConfigs) {
    const side = cfg.z > 0 ? 1 : -1;
    const pivot = new THREE.Group();
    pivot.position.set(cfg.x, WHEEL_R, cfg.z); pivot.name = cfg.name + '_Pivot';
    root.add(pivot); allPivots.push(pivot); if (cfg.front) frontPivots.push(pivot);
    rbox(0.10, 0.14, 0.06, 0.022, caliperMat, pivot, -0.03, 0.02, side * 0.03);
    const spin = new THREE.Group(); spin.name = cfg.name; pivot.add(spin); wheels.push(spin);
    addMesh(tyreGeo, rubberMat, spin);
    for (const tz of [-0.06, 0, 0.06]) addMesh(treadGeo, matteBlackMat, spin, 0, 0, tz);
    addMesh(brakeDiscGeo, rotorMat, spin, 0, 0, 0, Math.PI / 2, 0, 0);
    cyl(0.092, 0.092, 0.055, gunmetalMat, spin, 0, 0, 0, 20, Math.PI / 2, 0, 0);
    addMesh(rimBarrelGeo, gunmetalMat, spin, 0, 0, 0, Math.PI / 2, 0, 0);
    cyl(0.240, 0.240, 0.02, trimBlackMat, spin, 0, 0, side * 0.05, 44, Math.PI / 2, 0, 0);
    addMesh(rimLipGeo, gunmetalMat, spin, 0, 0, side * 0.112);
    // Reference wheels: dark, broad, six-spoke alloys.
    for (let k = 0; k < 6; k++) {
      const ang = k / 6 * Math.PI * 2;
      const spoke = rbox(0.072,0.205,0.032,0.012,gunmetalMat,spin,
        Math.sin(ang)*0.13,Math.cos(ang)*0.13,side*0.105);
      spoke.rotation.z=-ang;
    }
    cyl(0.075,0.075,0.05,gunmetalMat,spin,0,0,side*0.105,24,Math.PI/2,0,0);
    for (let l = 0; l < 5; l++) {
      const la = (l / 5) * Math.PI * 2 + 0.3;
      cyl(0.0125, 0.0125, 0.022, chromeMat, spin, Math.sin(la) * 0.045, Math.cos(la) * 0.045, side * 0.117, 10, Math.PI / 2, 0, 0);
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
    addGlow(X_REAR - 0.05, 0.80, side * 0.52, 0.52, 0.20, 0xff2233, 0.20);
  }

  let lightsOn = true, interiorMode = false;
  function setPaintColor(hex) {
    const col = new THREE.Color(hex);
    paintMat.color.copy(col); paintCapMat.color.copy(col); roofMat.color.copy(col);
    paintDeepMat.color.copy(col).multiplyScalar(0.55);
  }
  function setLights(active) {
    lightsOn = Boolean(active);
    drlMat.emissiveIntensity = lightsOn ? 2.4 : 0;
    drlMat.color.set(lightsOn ? 0xf0f7ff : 0x617080);
    headlightMat.emissiveIntensity = lightsOn ? 0.9 : 0;
    headlightMat.color.set(lightsOn ? 0xd2eaff : 0x263a50);
    tailMat.emissiveIntensity = lightsOn ? 3.6 : 1.0;
    tailAmberMat.emissiveIntensity = lightsOn ? 2.2 : 0.5;
    reverseMat.emissiveIntensity = lightsOn ? 2.0 : 0.5;
    reflectorMat.emissiveIntensity = lightsOn ? 1.0 : 0.25;
    headlightLights.forEach(l => { l.intensity = lightsOn ? 5.5 : 0; });
    glows.forEach(g => { g.sprite.material.opacity = lightsOn ? g.base : g.base * 0.10; });
  }
  function setInteriorMode(active) {
    interiorMode = Boolean(active);
    glassMat.opacity = interiorMode ? 0.22 : 0.66;
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

return createSportsCar;
})();
