// ---------- SIM: track, physics, AI, laps (no THREE, fully testable) ----------
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

export const PARAMS = { vmax: 64, acc: 13.5, brake: 30, rev: 8, revMax: 12 };
export const TRACK_WIDTH = 18;

const CTRL = [
  [0,0],[120,-10],[240,-40],[330,-110],[350,-210],[300,-300],[200,-340],[120,-300],[70,-230],
  [10,-200],[-60,-240],[-110,-320],[-210,-340],[-300,-290],[-330,-190],[-290,-100],[-210,-60],[-120,-80],[-60,-40]
];

export function buildTrack(scale = 1.25) {
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

export function makeCar(role) {
  return { role, x: 0, z: 0, h: 0, vx: 0, vz: 0, vf: 0, vl: 0, speed: 0, steer: 0, yaw: 0, lat: 0, idx: 0, total: 0, prog: 0,
    onRoad: true, drifting: false, braking: false, lapsDone: 0, lapStart: 0, lapTimes: [], finished: false, finishTime: 0,
    vmaxScale: 1, stuck: 0, lastLapTime: 0, throttleLevel: 0 };
}

export function placeOnTrack(c, tr, idx, lat) {
  idx = ((idx % tr.N) + tr.N) % tr.N;
  c.x = tr.x[idx] + tr.nx[idx] * lat; c.z = tr.z[idx] + tr.nz[idx] * lat; c.h = tr.heading[idx];
  c.vx = c.vz = c.vf = c.vl = c.speed = c.steer = c.yaw = 0; c.idx = idx; c.total = idx > tr.N / 2 ? idx - tr.N : idx;
  c.lat = lat; c.prog = c.total; c.stuck = 0; c.onRoad = true; c.drifting = false;
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

export function stepCar(c, inp, dt, tr) {
  const P = PARAMS;
  c.onRoad = Math.abs(c.lat) <= tr.width / 2 + 1.2;
  const vmax = P.vmax * c.vmaxScale * (c.onRoad ? 1 : 0.5);
  const target = inp.steer, rate = target === 0 ? 10 : 6;
  c.steer += clamp(target - c.steer, -rate * dt, rate * dt);

  // heading from steering
  const sf = clamp(Math.abs(c.vf) / P.vmax, 0, 1);
  const maxYaw = lerp(1.9, 0.8, Math.pow(sf, 0.8));
  const lowSpeed = clamp(Math.abs(c.vf) / 5, 0, 1);
  let yaw = c.steer * maxYaw * lowSpeed * (c.vf < -0.5 ? -1 : 1);
  if (inp.hand) yaw *= 1.35;
  c.yaw = yaw; c.h -= yaw * dt;
  const fx = Math.sin(c.h), fz = Math.cos(c.h), rx = -fz, rz = fx;

  // re-decompose world velocity in the new heading frame
  let vf = c.vx * fx + c.vz * fz, vl = c.vx * rx + c.vz * rz;

  // longitudinal
  const thr = inp.throttle, brk = inp.brake;
  c.braking = false;
  if (thr > 0) vf += P.acc * thr * clamp(1 - vf / vmax, 0, 1) * dt;
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

export function updateLaps(c, tr, now) {
  const done = Math.floor(c.total / tr.N);
  if (done > c.lapsDone && done >= 1) {
    c.lapsDone = done;
    c.lastLapTime = now - c.lapStart; c.lapTimes.push(c.lastLapTime); c.lapStart = now;
    return true;
  }
  return false;
}

// ---------- AI ----------
const AI_IN = { throttle: 0, brake: 0, steer: 0, hand: false };
export function aiControl(ai, tr, dt, opts) {
  const N = tr.N, i = ai.idx;
  const look = 14 + ai.speed * 0.55, ti = (i + Math.max(2, Math.round(look / tr.ds))) % N;
  const tx = tr.x[ti] + tr.nx[ti] * opts.lane, tz = tr.z[ti] + tr.nz[ti] * opts.lane;
  const dx = tx - ai.x, dz = tz - ai.z, fx = Math.sin(ai.h), fz = Math.cos(ai.h);
  const cross = fx * dz - fz * dx, dot = fx * dx + fz * dz; // cross>0 => target on the right
  const err = Math.atan2(cross, dot);
  AI_IN.steer = clamp(err * 2.4, -1, 1);
  // speed plan from upcoming curvature
  let kmax = 0; const span = Math.round((20 + ai.speed * 1.4) / tr.ds);
  for (let k = 0; k <= span; k += 2) kmax = Math.max(kmax, tr.kappa[(i + k) % N]);
  let vt = kmax > 1e-4 ? Math.sqrt(opts.latG / kmax) : 999;
  vt = Math.min(vt, PARAMS.vmax * ai.vmaxScale);
  if (Math.abs(ai.lat - opts.lane) > tr.width * 0.45) vt = Math.min(vt, 22);
  AI_IN.throttle = ai.speed < vt - 0.5 ? 1 : 0;
  AI_IN.brake = ai.speed > vt + 3 ? 1 : 0;
  AI_IN.hand = false;
  // stuck recovery
  if (ai.speed < 2.5) ai.stuck += dt; else ai.stuck = 0;
  if (ai.stuck > 3) { placeOnTrack(ai, tr, ai.idx, opts.lane * 0.3); ai.total = ai.total; ai.stuck = 0; updateTrackState(ai, tr, false); }
  return AI_IN;
}
