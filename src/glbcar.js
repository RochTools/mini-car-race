/* =========================================================================
   GLB CARS — the three cars you sent, prepared by work/prep_car.py:
     assets/bugatti_divo.glb · assets/bugatti_chiron.glb · assets/lamborghini_essenza.glb
   Loads the car once at boot, then builds the same template shape the race code
   expects (shell + 4 wheel pivots with spin groups + paint/tail materials),
   so colours, brake lights, wheel spin and LOD work unchanged.
   The GLB is already in game units: +X = front, +Y = up, wheels on y = 0,
   4.58 m long, 26.5k triangles, textures embedded (~1.25 MB).
   Wheels spin around local Z (the model is turned -90 deg about Y below).
   ========================================================================= */
let SPORT_SCENE = null, SPORT_BODY_TEX = null;         // kept for the single-car fallback path
const CAR_GLB_URLS = {
  divo: './assets/bugatti_divo.glb',
  chiron: './assets/bugatti_chiron.glb',
  essenza: './assets/lamborghini_essenza.glb',
  sport: './assets/red_sports_car.glb'          // the fourth car: the Lotus sports car you sent
};
const CAR_SCENES = {};                                  // id -> parsed scene (loaded once at boot)

async function sportParseGLB(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('GLB ' + res.status);
  const buf = await res.arrayBuffer();
  const dv = new DataView(buf);
  if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB file');
  const jsonLen = dv.getUint32(12, true);
  const gltf = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
  const binStart = 20 + jsonLen + 8;
  const viewBytes = i => { const bv = gltf.bufferViews[i]; const s = binStart + (bv.byteOffset || 0); return buf.slice(s, s + bv.byteLength); };
  const accArr = i => {
    const a = gltf.accessors[i], nc = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[a.type];
    const C = a.componentType === 5126 ? Float32Array : Uint32Array;
    return new C(viewBytes(a.bufferView), 0, a.count * nc);
  };
  const texCache = new Map();
  const texture = ti => {
    if (typeof document === 'undefined') return null;          // no DOM (tests)
    if (texCache.has(ti)) return texCache.get(ti);
    const t = gltf.textures[ti], im = gltf.images[t.source];
    const u = URL.createObjectURL(new Blob([viewBytes(im.bufferView)], { type: im.mimeType }));
    const tex = new THREE.TextureLoader().load(u, () => URL.revokeObjectURL(u));
    tex.colorSpace = THREE.SRGBColorSpace; tex.flipY = false; tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    texCache.set(ti, tex); return tex;
  };
  const matCache = new Map();
  const glbMat = mi => {
    if (matCache.has(mi)) return matCache.get(mi);
    const m = (mi !== undefined && gltf.materials[mi]) || {}, pbr = m.pbrMetallicRoughness || {}, f = pbr.baseColorFactor || [1, 1, 1, 1];
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(f[0], f[1], f[2]), roughness: pbr.roughnessFactor ?? .8, metalness: pbr.metallicFactor ?? 0,
      map: pbr.baseColorTexture ? texture(pbr.baseColorTexture.index) : null, side: m.doubleSided ? THREE.DoubleSide : THREE.FrontSide
    });
    matCache.set(mi, mat); return mat;
  };
  const geoOf = p => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(accArr(p.attributes.POSITION), 3));
    if (p.attributes.NORMAL !== undefined) g.setAttribute('normal', new THREE.BufferAttribute(accArr(p.attributes.NORMAL), 3));
    if (p.attributes.TEXCOORD_0 !== undefined) g.setAttribute('uv', new THREE.BufferAttribute(accArr(p.attributes.TEXCOORD_0), 2));
    if (p.indices !== undefined) g.setIndex(new THREE.BufferAttribute(accArr(p.indices), 1));
    g.computeBoundingSphere(); return g;
  };
  const build = idx => {
    const n = gltf.nodes[idx], group = new THREE.Group();
    group.name = n.name || '';
    if (n.translation) group.position.fromArray(n.translation);
    if (n.mesh !== undefined) for (const p of gltf.meshes[n.mesh].primitives) {
      const mesh = new THREE.Mesh(geoOf(p), glbMat(p.material)); mesh.name = n.name || ''; group.add(mesh);
    }
    (n.children || []).forEach(c => group.add(build(c)));
    return group;
  };
  return build(gltf.scenes[gltf.scene].nodes[0]);
}

// load every car GLB once; a car that fails to parse simply falls back to the studio body
async function loadCarGLBs(onProgress) {
  const ids = Object.keys(CAR_GLB_URLS);
  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    if (onProgress) onProgress(i, ids.length, id);
    try {
      CAR_SCENES[id] = await sportParseGLB(CAR_GLB_URLS[id]);
    } catch (e) {
      console.warn('GLB car unavailable (' + id + '), using the procedural model instead:', e);
      CAR_SCENES[id] = null;
    }
  }
  SPORT_SCENE = CAR_SCENES.divo || null;
}

// merge many indexed/non-indexed geometries into one (same attributes)
function sportMergeGeos(list) {
  let nv = 0, ni = 0;
  for (const g of list) { const c = g.attributes.position.count; nv += c; ni += g.index ? g.index.count : c; }
  const hasUV = list.every(g => g.attributes.uv);
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = hasUV ? new Float32Array(nv * 2) : null;
  const idx = new Uint32Array(ni);
  let vo = 0, io = 0;
  for (const g of list) {
    const c = g.attributes.position.count;
    pos.set(g.attributes.position.array, vo * 3);
    nor.set(g.attributes.normal.array, vo * 3);
    if (hasUV) uv.set(g.attributes.uv.array, vo * 2);
    if (g.index) { for (let i = 0; i < g.index.count; i++) idx[io + i] = g.index.array[i] + vo; io += g.index.count; }
    else { for (let i = 0; i < c; i++) idx[io + i] = vo + i; io += c; }
    vo += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  if (hasUV) out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setIndex(new THREE.BufferAttribute(idx, 1));
  out.computeBoundingSphere();
  return out;
}

// which part is which (names come from the exporter in work/make_bugatti.py):
// PAINT_* = the body shell (tinted by the player colour), GLASS_* = windows,
// INT_* = trims / carbon / interior (keep their own material + texture), tail = lamps
function sportRole(name) {
  if (/^PAINT/.test(name)) return 'paint';
  if (/GLASS/.test(name)) return 'glass';
  if (/^HEAD/.test(name)) return 'head';   // headlamps: own light colour, never the body paint
  if (/^IND/.test(name)) return 'ind';     // indicator / driving lamps
  if (/^TAILRED|LIGHTS|LENS/.test(name)) return 'tail';
  if (/^INT|STRING|STEERINGWHEEL/.test(name)) return 'orig';
  return 'paint';
}

function buildSportTemplate(scene, label) {
  const model = new THREE.Group(); model.name = 'model'; model.rotation.y = -Math.PI / 2;

  const paint = new THREE.MeshPhysicalMaterial({
    color: 0xc91420, metalness: .45, roughness: .28,
    clearcoat: .9, clearcoatRoughness: .12, envMapIntensity: .9
  });
  let atlas = null;
  scene.traverse(o => { if (!atlas && o.isMesh && /LIGHTS/.test(o.name) && o.material.map) atlas = o.material.map; });
  const tail = new THREE.MeshStandardMaterial({
    color: atlas ? 0xffffff : 0x8f121c, map: atlas, emissive: atlas ? 0xffffff : 0xff1b26,
    emissiveMap: atlas, emissiveIntensity: atlas ? 1 : .8, roughness: .25
  });
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x0a1018, roughness: .06, metalness: 0, transparent: true, opacity: .86, depthWrite: false,
    side: THREE.DoubleSide, envMapIntensity: 1.4
  });

  const head = new THREE.MeshStandardMaterial({ color: 0xfff4d0, emissive: 0xffeeb8, emissiveIntensity: 1.3, roughness: .15 });
  const ind = new THREE.MeshStandardMaterial({ color: 0xff9a1a, emissive: 0xff7a00, emissiveIntensity: .9, roughness: .25 });

  // body parts (not wheels), grouped by role / material
  const byRole = { paint: [], tail: [], glass: [], head: [], ind: [] }, orig = new Map();
  const insideWheel = o => { for (let p = o.parent; p; p = p.parent) if (/^Wheel_/.test(p.name)) return true; return false; };
  scene.traverse(o => {
    if (!o.isMesh || insideWheel(o)) return;
    const r = sportRole(o.name);
    if (r === 'orig') { if (!orig.has(o.material)) orig.set(o.material, []); orig.get(o.material).push(o.geometry); }
    else byRole[r].push(o.geometry);
  });

  const shell = new THREE.Group(); model.add(shell);            // template.children[0] = shell (LOD code relies on it)
  const add = (geos, mat, mk) => { if (!geos.length) return; const m = new THREE.Mesh(sportMergeGeos(geos), mat); m.userData.mk = mk; shell.add(m); };
  add(byRole.paint, paint, 'paint');
  add(byRole.tail, tail, 'tail');
  add(byRole.glass, glass, 'glass');
  add(byRole.head, head, 'head');
  add(byRole.ind, ind, 'ind');
  for (const [mat, geos] of orig) add(geos, mat, 'orig');

  // wheels: one pivot per corner, spin group holds the tyre + rim (spins about local Z).
  // The wheel radius is measured from the geometry, so the spin rate always matches the model.
  const corners = [['Wheel_FL', 'pivot_f0'], ['Wheel_FR', 'pivot_f1'], ['Wheel_RL', 'pivot_r0'], ['Wheel_RR', 'pivot_r1']];
  let wrSum = 0;
  for (const [src, pname] of corners) {
    const wg = scene.getObjectByName(src);
    if (!wg) throw new Error('wheel missing in GLB: ' + src);
    const pivot = new THREE.Group(); pivot.name = pname; pivot.position.copy(wg.position);
    const spin = new THREE.Group(); spin.name = 'spin'; pivot.add(spin);
    const bb = new THREE.Box3();
    wg.traverse(c => { if (c.isMesh) { spin.add(new THREE.Mesh(c.geometry, c.material)); c.geometry.computeBoundingBox(); bb.union(c.geometry.boundingBox); } });
    wrSum += (bb.max.y - bb.min.y) / 2;
    model.add(pivot);
  }

  return {
    template: model,
    mats: { paint, paintCap: paint, roof: paint, paintDeep: paint, tail },
    paintKeys: ['paint', 'paintCap', 'roof', 'paintDeep'],
    wr: wrSum / corners.length, flipRight: false, tailBase: 2.4, tailBrake: 6.5, name: label || 'Bugatti Divo'
  };
}
