// ---------- SIM: track, hazards, physics, AI, laps (no THREE, fully testable) ----------
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
const wrapIdx = (d, N) => { d %= N; if (d > N / 2) d -= N; else if (d < -N / 2) d += N; return d; };

export const PARAMS = { vmax: 78, acc: 15, brake: 34, rev: 8, revMax: 12 };
export const TRACK_WIDTH = 22;

// A big 5.6 km circuit (metres): long main straight, fast sweeper, hairpin, S-bends, a U-turn and a tight chicane.
const CTRL = [
  [0,0],[300,-4],[620,-12],[900,-45],[1130,-130],[1280,-290],[1335,-480],[1310,-660],[1230,-790],[1100,-855],
  [975,-805],[935,-690],[985,-560],[1010,-440],[920,-340],[760,-290],[600,-330],[500,-300],[400,-340],[345,-440],
  [335,-560],[385,-700],[330,-850],[170,-940],[-60,-940],[-230,-870],[-340,-730],[-385,-560],[-335,-430],[-395,-310],
  [-330,-190],[-190,-60]
];

export function buildTrack(scale = 1) {
  const P = CTRL.map(p => [p[0] * scale, p[1] * scale]);
  const n = P.length, dense = [];
  for (let i = 0; i < n; i++) {
    const p0 = P[(i + n - 1) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
    for (let k = 0; k < 40; k++) {
      const t = k / 40, t2 = t * t, t3 = t2 * t;
      dense.push([
        0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3)
      ]);
    }
  }
  const M = dense.length, cum = new Float64Array(M + 1);
  for (let i = 0; i < M; i++) {
    const a = dense[i], b = dense[(i + 1) % M];
    cum[i + 1] = cum[i] + Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  const len = cum[M], N = Math.round(len / 4), ds = len / N;
  const x = new Float32Array(N), z = new Float32Array(N);
  let j = 0;
  for (let i = 0; i < N; i++) {
    const s = i * ds;
    while (cum[j + 1] < s) j++;
    const a = dense[j], b = dense[(j + 1) % M], f = (s - cum[j]) / (cum[j + 1] - cum[j]);
    x[i] = a[0] + (b[0] - a[0]) * f; z[i] = a[1] + (b[1] - a[1]) * f;
  }
  const tx = new Float32Array(N), tz = new Float32Array(N), nx = new Float32Array(N), nz = new Float32Array(N), heading = new Float32Array(N), kappa = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const a = (i + N - 1) % N, b = (i + 1) % N;
    let dx = x[b] - x[a], dz = z[b] - z[a]; const l = Math.hypot(dx, dz);
    tx[i] = dx / l; tz[i] = dz / l; nx[i] = -tz[i]; nz[i] = tx[i];
    heading[i] = Math.atan2(tx[i], tz[i]);
  }
  for (let i = 0; i < N; i++) {
    let d = heading[(i + 1) % N] - heading[(i + N - 1) % N];
    while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
    kappa[i] = Math.abs(d) / (2 * ds);
  }
  const ks = new Float32Array(N);
  for (let i = 0; i < N; i++) { let m = 0; for (let k = -3; k <= 3; k++) m += kappa[(i + k + N) % N]; ks[i] = m / 7; }
  return { N, len, ds, x, z, tx, tz, nx, nz, heading, kappa: ks, width: TRACK_WIDTH };
}

// ---------- hazards: boost pads, oil slicks, rocks, swinging boulders and lava zones ----------
export const LAVA_EDGE = 1.9;      // lava starts this far beyond the road edge (just outside the kerb)
export const LAVA_BURN = 3.0;      // a car whose centre is this far beyond the road edge is lost to the lava
export function buildHazards(tr) {
  const N = tr.N, hw = tr.width / 2, at = f => Math.round(f * N) % N;
  const world = (idx, lat) => ({ idx, lat, x: tr.x[idx] + tr.nx[idx] * lat, z: tr.z[idx] + tr.nz[idx] * lat, h: tr.heading[idx] });
  const H = { pads: [], oil: [], rocks: [], boulders: [], lava: [], gates: [] };
  const pad = (f, lat) => H.pads.push(world(at(f), lat));
  const oil = (f, lat, r) => H.oil.push(Object.assign(world(at(f), lat), { r: r || 5 }));
  const rock = (f, lat, r) => H.rocks.push(Object.assign(world(at(f), lat), { r: r || 1.8 }));
  const boulder = (f, ph, period) => H.boulders.push({ idx: at(f), amp: hw - 3.4, w: 2 * Math.PI / period, ph, r: 2.6 });
  const lava = (f0, f1) => { H.lava.push({ i0: at(f0), i1: at(f1) }); H.gates.push({ idx: at(f0) }); };
  // nitro / boost pads (the ones inside lava zones are a risk-reward gamble)
  [[0.035, 0], [0.095, -5], [0.135, 5], [0.255, -6], [0.50, 0], [0.745, -4], [0.93, 0]].forEach(a => pad(a[0], a[1]));
  // oil slicks: the car slides with almost no grip
  [[0.07, -6, 5], [0.115, 4, 5], [0.19, -3, 4.5], [0.33, 2, 5], [0.465, -5, 4.5], [0.525, 3, 5], [0.685, -2, 4.5], [0.76, 5, 5], [0.945, -4, 5]].forEach(a => oil(a[0], a[1], a[2]));
  // rocks: a slalom, plus single blockers
  [[0.30, 7], [0.41, -3], [0.56, -5], [0.572, 5], [0.584, -5], [0.62, 1], [0.665, 4], [0.715, -6], [0.80, 0], [0.872, 6], [0.878, -6], [0.975, 2]].forEach(a => rock(a[0], a[1]));
  // boulders that swing across the track
  [[0.48, 0, 6.5], [0.64, 2.1, 8], [0.71, 4, 7.2], [0.925, 1, 6.8], [0.385, 3, 7]].forEach(a => boulder(a[0], a[1], a[2]));
  // lava beside the road
  lava(0.21, 0.29); lava(0.355, 0.425); lava(0.83, 0.90);
  return H;
}
export function boulderPos(b, tr, t, out) {
  const lat = b.amp * Math.sin(b.w * t + b.ph), i = b.idx;
  out.lat = lat; out.x = tr.x[i] + tr.nx[i] * lat; out.z = tr.z[i] + tr.nz[i] * lat; return out;
}
export function inLava(H, idx) {
  for (let k = 0; k < H.lava.length; k++) {
    const z = H.lava[k];
    if (z.i0 <= z.i1 ? (idx >= z.i0 && idx <= z.i1) : (idx >= z.i0 || idx <= z.i1)) return true;
  }
  return false;
}

export function makeCar(role) {
  return { role, name: '', x: 0, z: 0, h: 0, vx: 0, vz: 0, vf: 0, vl: 0, speed: 0, steer: 0, yaw: 0, lat: 0, idx: 0, total: 0, prog: 0,
    onRoad: true, drifting: false, braking: false, lapsDone: 0, lapStart: 0, lapTimes: [], finished: false, finishTime: 0,
    vmaxScale: 1, accScale: 1, stuck: 0, lastLapTime: 0, throttleLevel: 0,
    nitro: 100, nitroOn: false, boosting: false, boostT: 0, oilT: 0, fallT: 0, ghostT: 0, padK: -1, laneNow: null, hitT: 0 };
}

export function placeOnTrack(c, tr, idx, lat) {
  idx = ((idx % tr.N) + tr.N) % tr.N;
  c.x = tr.x[idx] + tr.nx[idx] * lat; c.z = tr.z[idx] + tr.nz[idx] * lat; c.h = tr.heading[idx];
  c.vx = c.vz = c.vf = c.vl = c.speed = c.steer = c.yaw = 0; c.idx = idx; c.total = idx > tr.N / 2 ? idx - tr.N : idx;
  c.lat = lat; c.prog = c.total; c.stuck = 0; c.onRoad = true; c.drifting = false;
  c.nitroOn = c.boosting = false; c.boostT = c.oilT = c.fallT = c.ghostT = 0; c.padK = -1; c.laneNow = lat;
}
// put a car back on the road at the same spot along the lap (keeps its lap count)
export function respawn(c, tr, lat) {
  const lapBase = Math.floor(c.total / tr.N) * tr.N, i = c.idx;
  placeOnTrack(c, tr, i, lat || 0); c.total = lapBase + i; c.prog = c.total; updateTrackState(c, tr, false);
  c.ghostT = 2.2;
}

function searchIdx(c, tr, from, span) {
  const N = tr.N; let best = 1e18, bi = from;
  for (let k = -span; k <= span; k++) {
    const i = (from + k + N * 4) % N, dx = c.x - tr.x[i], dz = c.z - tr.z[i], d = dx * dx + dz * dz;
    if (d < best) { best = d; bi = i; }
  }
  return bi;
}

export function updateTrackState(c, tr, full) {
  const N = tr.N, old = c.idx;
  const i = full ? searchIdx(c, tr, old, N >> 1) : searchIdx(c, tr, old, 24);
  let d = i - old; if (d < -N / 2) d += N; else if (d > N / 2) d -= N;
  c.total += d; c.idx = i;
  const dx = c.x - tr.x[i], dz = c.z - tr.z[i];
  c.lat = dx * tr.nx[i] + dz * tr.nz[i];
  c.prog = c.total + (dx * tr.tx[i] + dz * tr.tz[i]) / tr.ds;
}

// env: { grip: 1 } (a storm lowers it)
export function stepCar(c, inp, dt, tr, env) {
  const P = PARAMS, gripEnv = env ? env.grip : 1;
  if (c.fallT > 0) {                       // lost to the lava: slide to a halt, then reappear on the road
    c.fallT -= dt; const k = Math.max(0, 1 - 2.5 * dt);
    c.vx *= k; c.vz *= k; c.vf *= k; c.vl *= k; c.x += c.vx * dt; c.z += c.vz * dt;
    c.speed = Math.hypot(c.vx, c.vz); c.yaw = 0; c.braking = false; c.nitroOn = c.boosting = false;
    if (c.fallT <= 0) respawn(c, tr, 0);
    return;
  }
  if (c.ghostT > 0) c.ghostT -= dt;
  if (c.hitT > 0) c.hitT -= dt;
  c.onRoad = Math.abs(c.lat) <= tr.width / 2 + 1.2;

  // nitro tank + boost pads
  const wantN = !!inp.nitro && c.nitro > 0.5 && c.vf > 4;
  if (wantN) c.nitro = Math.max(0, c.nitro - 26 * dt); else if (!inp.nitro) c.nitro = Math.min(100, c.nitro + 4 * dt);
  c.nitroOn = wantN;
  if (c.boostT > 0) c.boostT -= dt;
  const bf = (wantN ? 1 : 0) + (c.boostT > 0 ? 1 : 0);   // 0, 1 or 2 boost sources
  c.boosting = bf > 0;
  const boost = bf > 1 ? 1.25 : bf;
  const vmax = P.vmax * c.vmaxScale * (c.onRoad ? 1 : 0.5) * (1 + 0.2 * boost);
  const target = inp.steer, rate = target === 0 ? 10 : 6;
  c.steer += clamp(target - c.steer, -rate * dt, rate * dt);

  // heading from steering
  const sf = clamp(Math.abs(c.vf) / P.vmax, 0, 1);
  const maxYaw = lerp(1.9, 0.8, Math.pow(sf, 0.8));
  const lowSpeed = clamp(Math.abs(c.vf) / 5, 0, 1);
  let yaw = c.steer * maxYaw * lowSpeed * (c.vf < -0.5 ? -1 : 1);
  if (inp.hand) yaw *= 1.35;
  if (c.oilT > 0) { c.oilT -= dt; yaw *= 0.75; }
  c.yaw = yaw; c.h -= yaw * dt;
  const fx = Math.sin(c.h), fz = Math.cos(c.h), rx = -fz, rz = fx;

  // re-decompose world velocity in the new heading frame
  let vf = c.vx * fx + c.vz * fz, vl = c.vx * rx + c.vz * rz;

  // longitudinal
  const thr = boost > 0 ? 1 : inp.throttle, brk = inp.brake;
  c.braking = false;
  if (thr > 0) vf += P.acc * c.accScale * (1 + 1.5 * boost) * thr * clamp(1 - vf / vmax, 0, 1) * dt;
  if (brk > 0) {
    if (vf > 0.4) { vf -= P.brake * brk * dt; c.braking = true; }
    else if (thr === 0) vf = Math.max(vf - P.rev * dt, -P.revMax);
  }
  if (thr === 0 && brk === 0) vf -= Math.sign(vf) * Math.min(Math.abs(vf), 3.4 * dt);
  if (inp.hand) { vf -= Math.sign(vf) * Math.min(Math.abs(vf), 9 * dt); }
  if (vf > vmax) vf -= (vf - vmax) * 2.5 * dt;
  if (!c.onRoad) vf -= vf * 0.35 * dt;

  // lateral grip
  const latAcc = Math.abs(yaw * vf);
  let grip = inp.hand ? 1.3 : lerp(7, 3.2, clamp((latAcc - 26) / 18, 0, 1));
  if (!c.onRoad) grip = Math.min(grip, 4.5);
  grip *= gripEnv;
  if (c.oilT > 0) grip *= 0.16;
  vl *= Math.exp(-grip * dt);
  c.drifting = Math.abs(vl) > 4.5 && Math.abs(vf) > 8;

  c.vf = vf; c.vl = vl;
  c.vx = fx * vf + rx * vl; c.vz = fz * vf + rz * vl;
  c.x += c.vx * dt; c.z += c.vz * dt;
  c.speed = Math.hypot(c.vx, c.vz);
  c.throttleLevel = thr;

  updateTrackState(c, tr, false);

  // soft world boundary
  const lim = tr.width / 2 + 28;
  if (Math.abs(c.lat) > lim) {
    const s = Math.sign(c.lat), i = c.idx, ex = Math.abs(c.lat) - lim;
    c.x -= tr.nx[i] * s * ex; c.z -= tr.nz[i] * s * ex;
    const vn = (c.vx * tr.nx[i] + c.vz * tr.nz[i]) * s;
    if (vn > 0) { c.vx -= tr.nx[i] * s * vn * 1.3; c.vz -= tr.nz[i] * s * vn * 1.3; }
    c.vx *= 0.97; c.vz *= 0.97;
    updateTrackState(c, tr, false);
  }
}

// two circles per car (front/back)
const CR = 1.05, CO = 1.15;
export function collide(a, b) {
  if (a.ghostT > 0 || b.ghostT > 0 || a.fallT > 0 || b.fallT > 0) return false;
  const ax = Math.sin(a.h), az = Math.cos(a.h), bx = Math.sin(b.h), bz = Math.cos(b.h);
  if ((a.x - b.x) ** 2 + (a.z - b.z) ** 2 > 36) return false;
  let hit = false;
  for (let ia = -1; ia <= 1; ia += 2) for (let ib = -1; ib <= 1; ib += 2) {
    const pax = a.x + ax * CO * ia, paz = a.z + az * CO * ia, pbx = b.x + bx * CO * ib, pbz = b.z + bz * CO * ib;
    let dx = pbx - pax, dz = pbz - paz; const d = Math.hypot(dx, dz), min = CR * 2;
    if (d < min && d > 1e-4) {
      hit = true; dx /= d; dz /= d; const o = (min - d) * 0.5;
      a.x -= dx * o; a.z -= dz * o; b.x += dx * o; b.z += dz * o;
      const rv = (b.vx - a.vx) * dx + (b.vz - a.vz) * dz;
      if (rv < 0) { const j = -rv * 0.6; a.vx -= dx * j; a.vz -= dz * j; b.vx += dx * j; b.vz += dz * j; }
    }
  }
  return hit;
}

// solid circle (rock / boulder) vs the car's two circles. Returns the impact speed (0 = no hit)
function hitCircle(c, hx, hz, hr, bounce) {
  const fx = Math.sin(c.h), fz = Math.cos(c.h); let impact = 0;
  for (let s = -1; s <= 1; s += 2) {
    const px = c.x + fx * CO * s, pz = c.z + fz * CO * s;
    let dx = px - hx, dz = pz - hz; const d = Math.hypot(dx, dz), min = CR + hr;
    if (d < min && d > 1e-4) {
      dx /= d; dz /= d; const o = min - d;
      c.x += dx * o; c.z += dz * o;
      const vn = c.vx * dx + c.vz * dz;
      if (vn < 0) { c.vx -= (1 + bounce) * vn * dx; c.vz -= (1 + bounce) * vn * dz; impact = Math.max(impact, -vn); }
      if (impact > 0) c.h += clamp(impact / 60, 0, 0.35) * (dx * fz - dz * fx > 0 ? 1 : -1) * s;
    }
  }
  if (impact > 2) { const k = clamp(1 - impact / 70, 0.45, 0.9); c.vx *= k; c.vz *= k; c.hitT = 0.6; }
  return impact;
}

const BP = { x: 0, z: 0, lat: 0 };
// Apply every hazard to one car. ev (reused by the caller) reports what just happened: { pad, oil, hit, burn }
export function applyHazards(c, H, tr, t, ev) {
  ev.pad = ev.oil = ev.burn = false; ev.hit = 0;
  if (c.fallT > 0 || c.ghostT > 0) return ev;
  const N = tr.N, hw = tr.width / 2;
  for (let k = 0; k < H.pads.length; k++) {
    const p = H.pads[k], d = wrapIdx(c.prog - p.idx, N) * tr.ds;
    if (d > -7 && d < 7 && Math.abs(c.lat - p.lat) < 5.2) {
      if (c.padK !== k) { c.padK = k; c.nitro = Math.min(100, c.nitro + 20); ev.pad = true; }
      c.boostT = Math.max(c.boostT, 1.6);
    } else if (c.padK === k) c.padK = -1;
  }
  for (let k = 0; k < H.oil.length; k++) {
    const o = H.oil[k], dx = c.x - o.x, dz = c.z - o.z;
    if (dx * dx + dz * dz < o.r * o.r) { if (c.oilT <= 0) ev.oil = true; c.oilT = 0.7; break; }
  }
  for (let k = 0; k < H.rocks.length; k++) {
    const r = H.rocks[k], dx = c.x - r.x, dz = c.z - r.z;
    if (dx * dx + dz * dz < 64) ev.hit = Math.max(ev.hit, hitCircle(c, r.x, r.z, r.r, 0.2));
  }
  for (let k = 0; k < H.boulders.length; k++) {
    const b = H.boulders[k]; boulderPos(b, tr, t, BP);
    const dx = c.x - BP.x, dz = c.z - BP.z;
    if (dx * dx + dz * dz < 100) ev.hit = Math.max(ev.hit, hitCircle(c, BP.x, BP.z, b.r, 0.5));
  }
  if (Math.abs(c.lat) > hw + LAVA_BURN && inLava(H, c.idx)) { c.fallT = 1.5; ev.burn = true; }
  return ev;
}

export function updateLaps(c, tr, now) {
  const done = Math.floor(c.total / tr.N);
  if (done > c.lapsDone && done >= 1) {
    c.lapsDone = done;
    c.lastLapTime = now - c.lapStart; c.lapTimes.push(c.lastLapTime); c.lapStart = now;
    return true;
  }
  return false;
}

// finished cars first (by finishing time), everyone else by distance covered
export function rankCars(cars) {
  return cars.slice().sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (a.finished) return a.finishTime - b.finishTime;
    return b.prog - a.prog;
  });
}

// ---------- AI ----------
const AI_IN = { throttle: 0, brake: 0, steer: 0, hand: false, nitro: false };
// opts: { lane, latG, aware (0..1 how far ahead it reads hazards), nitroUse (0..1) }; ctx: { H, t, cars }
export function aiControl(ai, tr, dt, opts, ctx) {
  const N = tr.N, hw = tr.width / 2, i = ai.idx, speed = ai.speed;
  const H = ctx.H, clear = hw - 3.6;
  let lane = opts.lane;
  const look = (30 + speed * 1.35) * opts.aware, span = Math.max(4, Math.round(look / tr.ds));
  const avoid = (hLat, hR) => {
    const gap = hR + 3.3;
    if (Math.abs(lane - hLat) < gap) {
      const left = hLat + gap, right = hLat - gap, okL = left <= clear, okR = right >= -clear;
      if (okL && okR) lane = Math.abs(left - lane) < Math.abs(right - lane) ? left : right;
      else if (okL) lane = left; else if (okR) lane = right;
    }
  };
  for (let k = 0; k < H.oil.length; k++) { const o = H.oil[k], d = wrapIdx(o.idx - i, N); if (d > 0 && d <= span) avoid(o.lat, o.r - 0.5); }
  for (let k = 0; k < H.rocks.length; k++) { const o = H.rocks[k], d = wrapIdx(o.idx - i, N); if (d > 0 && d <= span) avoid(o.lat, o.r + 0.6); }
  for (let k = 0; k < H.boulders.length; k++) {
    const b = H.boulders[k], d = wrapIdx(b.idx - i, N);
    if (d > 0 && d <= span) avoid(b.amp * Math.sin(b.w * (ctx.t + d * tr.ds / Math.max(10, speed)) + b.ph), b.r + 0.8);
  }
  let capV = 999;
  for (const o of ctx.cars) {      // do not ram the cars in front: swerve round them, or follow slower ones
    if (o === ai || o.fallT > 0) continue;
    const fd = wrapIdx(o.prog - ai.prog, N) * tr.ds, dl = o.lat - ai.lat;
    if (fd > 0 && fd < 15 + speed * 0.12 && Math.abs(dl) < 3.4) {
      const want = clamp(ai.lat + (dl > 0 ? -4.2 : 4.2), -clear, clear);
      if (Math.abs(want - lane) > 0.5) lane = want;
      if (fd < 9 && Math.abs(dl) < 2.4) capV = Math.min(capV, o.speed + 3);
    }
  }
  lane = clamp(lane, -clear, clear);
  if (ai.laneNow == null) ai.laneNow = lane;
  ai.laneNow += clamp(lane - ai.laneNow, -10 * dt, 10 * dt);

  const lk = 14 + speed * 0.55, ti = (i + Math.max(2, Math.round(lk / tr.ds))) % N;
  const tx = tr.x[ti] + tr.nx[ti] * ai.laneNow, tz = tr.z[ti] + tr.nz[ti] * ai.laneNow;
  const dx = tx - ai.x, dz = tz - ai.z, fx = Math.sin(ai.h), fz = Math.cos(ai.h);
  const cross = fx * dz - fz * dx, dot = fx * dx + fz * dz; // cross>0 => target on the right
  const err = Math.atan2(cross, dot);
  AI_IN.steer = clamp(err * 2.4, -1, 1);
  // speed plan from upcoming curvature
  let kmax = 0; const sp2 = Math.round((20 + speed * 1.4) / tr.ds);
  for (let k = 0; k <= sp2; k += 2) kmax = Math.max(kmax, tr.kappa[(i + k) % N]);
  let vt = kmax > 1e-4 ? Math.sqrt(opts.latG / kmax) : 999;
  vt = Math.min(vt, PARAMS.vmax * ai.vmaxScale, capV);
  if (Math.abs(ai.lat - ai.laneNow) > tr.width * 0.45) vt = Math.min(vt, 22);
  AI_IN.throttle = speed < vt - 0.5 ? 1 : 0;
  AI_IN.brake = speed > vt + 3 ? 1 : 0;
  AI_IN.hand = false;
  AI_IN.nitro = AI_IN.throttle === 1 && kmax < 0.0016 && Math.abs(err) < 0.08 && speed > 22 && ai.nitro > 100 * (1 - opts.nitroUse) && capV > 900;
  // stuck recovery
  if (ai.speed < 2.5) ai.stuck += dt; else ai.stuck = 0;
  if (ai.stuck > 3) { respawn(ai, tr, 0); ai.stuck = 0; }
  return AI_IN;
}
