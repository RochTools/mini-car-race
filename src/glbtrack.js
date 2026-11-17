/* =========================================================================
   TRACK WORLD — the GLB of the circuit the player chose (TRACK_INFO[TRACK_ID].glb): assets/monaco.glb or assets/registan.glb
   (both CC-BY-4.0, amogusstrikesback2). Only that one file is fetched. Loaded once at boot, scaled to game metres (TRK.sc), and merged into one mesh per material
   (548 small meshes -> 10 draw calls). If the file is missing the game falls back to its own flat road.
   ========================================================================= */
const TRACKW = { group: null, floorY: -30 };

async function loadTrackWorld() {
  try {
    const res = await fetch(TI.glb);
    if (!res.ok) throw new Error('track GLB ' + res.status);
    const buf = await res.arrayBuffer(), dv = new DataView(buf);
    if (dv.getUint32(0, true) !== 0x46546c67) throw new Error('not a GLB file');
    const jl = dv.getUint32(12, true), bs = 20 + jl + 8;
    const g = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jl)));
    const CT = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
    const NC = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };
    const acc = i => {
      const a = g.accessors[i], bv = g.bufferViews[a.bufferView], C = CT[a.componentType], nc = NC[a.type], es = C.BYTES_PER_ELEMENT;
      const off = bs + (bv.byteOffset || 0) + (a.byteOffset || 0), stride = bv.byteStride || nc * es;
      if (stride === nc * es) return new C(buf.slice(off, off + a.count * nc * es));
      const full = new C(buf.slice(off, off + stride * (a.count - 1) + nc * es)), sp = stride / es, out = new C(a.count * nc);
      for (let k = 0; k < a.count; k++) for (let c = 0; c < nc; c++) out[k * nc + c] = full[k * sp + c];
      return out;
    };
    const sc = TRK.sc || 1;
    const lists = new Map();                                        // material index -> [geometry]
    const walk = (i, parentM) => {
      const n = g.nodes[i], m = new THREE.Matrix4();
      if (n.matrix) m.fromArray(n.matrix);
      else { const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1);
        if (n.translation) p.fromArray(n.translation); if (n.rotation) q.fromArray(n.rotation); if (n.scale) s.fromArray(n.scale); m.compose(p, q, s); }
      const wm = new THREE.Matrix4().multiplyMatrices(parentM, m);
      if (n.mesh !== undefined) for (const prim of g.meshes[n.mesh].primitives) {
        const pm = prim.material !== undefined ? g.materials[prim.material] : null;
        if (pm && TI.skip && TI.skip.test(pm.name || '')) continue;                                  // e.g. the desert file's own sky box / stray quads
        if (pm && pm.pbrMetallicRoughness && pm.pbrMetallicRoughness.baseColorFactor && pm.pbrMetallicRoughness.baseColorFactor[3] < .02) continue;   // fully transparent in the file (the desert's 'daoyazi' strips): drawing them opaque paints the ground dark
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(acc(prim.attributes.POSITION), 3));
        if (prim.indices !== undefined) geo.setIndex(new THREE.BufferAttribute(acc(prim.indices), 1));
        if (prim.attributes.NORMAL !== undefined) geo.setAttribute('normal', new THREE.BufferAttribute(acc(prim.attributes.NORMAL), 3)); else geo.computeVertexNormals();
        if (prim.attributes.TEXCOORD_0 !== undefined) geo.setAttribute('uv', new THREE.BufferAttribute(acc(prim.attributes.TEXCOORD_0), 2));
        else geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(geo.attributes.position.count * 2), 2));
        geo.applyMatrix4(wm);
        const mi = prim.material === undefined ? -1 : prim.material;
        if (!lists.has(mi)) lists.set(mi, []); lists.get(mi).push(geo);
      }
      (n.children || []).forEach(c => walk(c, wm));
    };
    const base = new THREE.Matrix4().makeScale(sc, sc, sc);
    g.scenes[g.scene || 0].nodes.forEach(r => walk(r, base));

    const texCache = new Map();
    const texture = ti => {
      if (texCache.has(ti)) return texCache.get(ti);
      const im = g.images[g.textures[ti].source], bv = g.bufferViews[im.bufferView], o = bs + (bv.byteOffset || 0);
      const url = URL.createObjectURL(new Blob([buf.slice(o, o + bv.byteLength)], { type: im.mimeType }));
      const t = new THREE.TextureLoader().load(url, () => URL.revokeObjectURL(url));
      t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4;
      texCache.set(ti, t); return t;
    };
    const group = new THREE.Group(); group.name = 'track_world';
    let minY = 1e9;
    for (const [mi, geos] of lists) {
      const m = mi >= 0 ? g.materials[mi] : {}, p = m.pbrMetallicRoughness || {}, bt = p.baseColorTexture;
      const tex = bt ? texture(bt.index) : null;
      const xf = bt && bt.extensions && bt.extensions.KHR_texture_transform;
      if (tex && xf && xf.scale) tex.repeat.set(xf.scale[0], xf.scale[1]);
      const blend = m.alphaMode === 'BLEND', fence = /Fence/i.test(m.name || '');
      const mat = new THREE.MeshLambertMaterial({ map: tex, side: THREE.DoubleSide, transparent: blend, depthWrite: !blend, alphaTest: fence ? .5 : 0 });
      if (blend) { mat.polygonOffset = true; mat.polygonOffsetFactor = -2; mat.polygonOffsetUnits = -2; }
      // merge every geometry of this material into one
      let nv = 0, ni = 0; for (const q of geos) { nv += q.attributes.position.count; ni += q.index ? q.index.count : q.attributes.position.count; }
      const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), idx = new Uint32Array(ni);
      let vo = 0, io = 0;
      for (const q of geos) {
        const c = q.attributes.position.count;
        pos.set(q.attributes.position.array, vo * 3); nor.set(q.attributes.normal.array, vo * 3); uv.set(q.attributes.uv.array, vo * 2);
        if (q.index) { for (let k = 0; k < q.index.count; k++) idx[io + k] = q.index.array[k] + vo; io += q.index.count; }
        else { for (let k = 0; k < c; k++) idx[io + k] = vo + k; io += c; }
        vo += c; q.dispose();
      }
      for (let k = 1; k < pos.length; k += 3) if (pos[k] < minY && !fence && !blend) minY = pos[k];
      const mg = new THREE.BufferGeometry();
      mg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); mg.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      mg.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); mg.setIndex(new THREE.BufferAttribute(idx, 1)); mg.computeBoundingSphere();
      const mesh = new THREE.Mesh(mg, mat); mesh.frustumCulled = false; if (blend) mesh.renderOrder = 1;
      group.add(mesh);
    }
    TRACKW.floorY = (minY < 1e8 ? minY : -30) - 1.5;
    scene.add(group); freeze(group);
    TRACKW.group = group;
  } catch (e) {
    console.warn('Track GLB unavailable, using the flat built-in road instead:', e);
    TRACKW.group = null;
  }
}
