// ═════════════════════════ ground vehicles ═════════════════════════
// The airside traffic that works round the aircraft: the turnaround fleet (steps, baggage tractors with their carts,
// belt loaders, catering high-loaders, fuel bowsers, ground power, toilet service), apron buses to the remote stands,
// the pushback tug that comes to the nose and pushes or tows, the jet bridges that swing out to the door, engineers'
// vans between the hangars and the stands, and the fire service out on training runs.
// They drive the real airside roads (OpenStreetMap service roads inside the aerodrome fence, from the airport's
// <icao>-veh.js, built by tools/vehicles_osm.py), keep to their side of the road (left in the UK), cross the
// taxiways on the way and give way to aircraft. The controller never instructs them; clicking one says what it is
// doing (no route is drawn). Where an airport's map has no road somewhere, they use the taxiway edge.
const VM = M2NM;   // metres to NM
const VD = typeof VEH_DATA !== 'undefined' ? VEH_DATA : { nodes: [], edges: [], fire: [], firetrain: [], hangars: [], fuel: [], catering: [], terms: [], bridges: [] };
const VP = ([e, n]) => [e*VM, n*VM];
const KEEP_LEFT = /^EG/.test(APT.icao);
// ── the road graph: the airside roads, plus the taxiway graph (no runways) for where the roads don't go
const VG = {};
let VG_BUILT = false;
const VG_GRID = new Map(), VG_CELL = 120;   // metres
const vgKey = (x, y) => Math.floor(x/VM/VG_CELL) + ',' + Math.floor(y/VM/VG_CELL);
function vgAdd(id, p, road){ VG[id] = { id, p, adj: [], road }; const k = vgKey(...p); if (!VG_GRID.has(k)) VG_GRID.set(k, []); VG_GRID.get(k).push(id); }
function vgLink(a, b, kind){ const L = dist(...VG[a].p, ...VG[b].p); if (L < 1e-9) return; VG[a].adj.push([b, L, kind]); VG[b].adj.push([a, L, kind]); }
// nearest graph nodes to a point (roads only, taxiways only, or either), within r metres
function vgNear(p, r = 300, pick){
  const n = Math.ceil(r/VG_CELL), cx0 = Math.floor(p[0]/VM/VG_CELL), cy0 = Math.floor(p[1]/VM/VG_CELL); let best = null, bd = r*VM;
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (const id of VG_GRID.get((cx0 + i) + ',' + (cy0 + j)) || []) {
    const N = VG[id]; if (pick && !pick(N)) continue; const d = dist(...p, ...N.p); if (d < bd) { bd = d; best = id; }
  }
  return best;
}
// a line across a runway (a road end joined to a taxiway on the far side, say): vehicles never drive across one
// unless cleared on to it (a runway check), so the graph has no such links
function crossesRwy(a, b){
  for (const R of RWYS) {
    const oa = R.offOf(a), ob = R.offOf(b), ma = R.mOf(a), mb = R.mOf(b), L = R.len || RWY_M;
    if (Math.max(ma, mb) < -60 || Math.min(ma, mb) > L + 60) continue;
    if (oa*ob < 0 || Math.min(Math.abs(oa), Math.abs(ob)) < (APT.rwyHalfWidth || 22.5) + 8) return true;
  }
  return false;
}
function vgBuild(){
  if (VG_BUILT) return; VG_BUILT = true;
  VD.nodes.forEach((q, i) => vgAdd('r:' + i, VP(q), true));
  for (const [a, b] of VD.edges) vgLink('r:' + a, 'r:' + b, 'r');
  // the taxiways (never the runway itself): a vehicle drives along their edge where the roads don't reach
  for (const id in GN) if (id[0] !== 'R') vgAdd('t:' + id, GN[id].p, false);
  for (const e of GE) if (VG['t:' + e.a] && VG['t:' + e.b] && !crossesRwy(GN[e.a].p, GN[e.b].p)) vgLink('t:' + e.a, 't:' + e.b, 't');
  // roads join the taxiways where they meet them (an apron road running onto a taxiway, a dead end at the apron edge)
  for (let i = 0; i < VD.nodes.length; i++) {
    const id = 'r:' + i, deg = VG[id].adj.length, t = vgNear(VG[id].p, deg <= 1 ? 90 : 35, N => !N.road && !crossesRwy(VG[id].p, N.p));
    if (t) vgLink(id, t, 'l');
  }
}
// shortest drive, roads preferred; emergency vehicles take the taxiways freely. Remembered: the graph never changes.
const VR_MEMO = new Map();
function vroute(from, to, urgent){
  if (from === to) return [from];
  const ck = from + '>' + to + (urgent ? '!' : ''); if (VR_MEMO.has(ck)) return VR_MEMO.get(ck);
  const w = urgent ? { r: 1, l: 1, t: 1.15 } : { r: 1, l: 1.5, t: 3 };
  const dd = new Map([[from, 0]]), prev = new Map(), done = new Set(), h = [[0, from]]; let found = false;
  while (h.length) {
    const [d, u] = heapPop(h); if (done.has(u)) continue; if (u === to) { found = true; break; } done.add(u);
    for (const [v, L, k] of VG[u].adj) { const nd = d + L*w[k], o = dd.get(v); if (o === undefined || nd < o) { dd.set(v, nd); prev.set(v, u); heapPush(h, [nd, v]); } }
  }
  let r = null; if (found) { r = [to]; let c = to; while (c !== from) { c = prev.get(c); r.unshift(c); } }
  if (VR_MEMO.size > 4000) VR_MEMO.clear();
  VR_MEMO.set(ck, r); return r;
}
// a route's points, moved to the driver's side of the road (more on a taxiway, which a vehicle keeps to the edge of)
function laneOffset(ids){
  const P = ids.map(id => VG[id].p), out = [];
  for (let i = 0; i < P.length; i++) {
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], h = brg(...a, ...b);
    const road = VG[ids[i]].road, off = (road ? 2.2 : 9)*VM*(KEEP_LEFT ? -1 : 1);
    out.push(i === 0 || i === P.length - 1 ? P[i] : [P[i][0] + Math.cos(h*D2R)*off, P[i][1] - Math.sin(h*D2R)*off]);
  }
  return out;
}

// ── the fleet
// len, wid (metres), body colour, cab colour, top speed on the road (kt)
const VTYPES = {
  bus:    { name: 'Apron bus',              len: 13.5, wid: 2.9, col: '#f4f6f9', cab: '#2d5fa8', kt: 16 },
  steps:  { name: 'Passenger steps',        len: 8,    wid: 2.4, col: '#c9ced6', cab: '#6b7380', kt: 12, stairs: true },
  bags:   { name: 'Baggage tractor',        len: 3,    wid: 1.6, col: '#3f7fc4', cab: '#25496e', kt: 14, carts: 3 },
  belt:   { name: 'Belt loader',            len: 7.5,  wid: 2,   col: '#e1a23a', cab: '#7a5a1e', kt: 10, belt: true },
  cater:  { name: 'Catering high-loader',   len: 9,    wid: 2.5, col: '#f2f2f2', cab: '#5d6875', kt: 14, box: true },
  fuel:   { name: 'Fuel bowser',            len: 10.5, wid: 2.5, col: '#e8ece9', cab: '#2f7a43', kt: 14, tank: true },
  gpu:    { name: 'Ground power unit',      len: 3.2,  wid: 1.7, col: '#e88c30', cab: '#8a4e14', kt: 8 },
  lav:    { name: 'Toilet service truck',   len: 6,    wid: 2.1, col: '#8495a8', cab: '#3d4855', kt: 12 },
  water:  { name: 'Water truck',            len: 6,    wid: 2.1, col: '#5aa0d8', cab: '#2a5578', kt: 12 },
  tug:    { name: 'Pushback tug',           len: 6,    wid: 2.6, col: '#f2c230', cab: '#444', kt: 12 },
  van:    { name: 'Engineers’ van',         len: 5.2,  wid: 2,   col: '#ffffff', cab: '#ff9d1c', kt: 16 },
  fire:   { name: 'Fire tender',            len: 11.5, wid: 3,   col: '#d8251d', cab: '#f2f2f2', kt: 20, blue: true },
  amb:    { name: 'Ambulance',              len: 6.5,  wid: 2.3, col: '#ffe600', cab: '#1f8f3a', kt: 18, blue: true },
  ops:    { name: 'Airside operations car', len: 4.6,  wid: 1.9, col: '#ffd21a', cab: '#1a1a1a', kt: 18, check: true },
  crew:   { name: 'Crew minibus',           len: 6,    wid: 2.1, col: '#e9edf2', cab: '#2d5fa8', kt: 16 }
};
const VEH = { list: [], n: 0, tick: 0, nextRoam: 0, nextFire: 0, bridges: [], bridgeBy: new Map(), cap: 0 };
const vehUnder = () => VEH.list.length < VEH.cap;
// where each kind of vehicle is based: graph nodes near the real places (fire station, fuel farm, hangars, catering,
// the terminal's apron face). Where the map has none, the handling base by the terminal stands in.
const VBASE = {};
function baseNodes(pts){ return [...new Set(pts.map(q => vgNear(VP(q), 400, N => N.road) || vgNear(VP(q), 400)).filter(Boolean))]; }
function vehBases(){
  const terms = baseNodes(VD.terms);
  // no terminal faces in the map: the road nodes nearest the middle of the contact stands
  if (!terms.length && STANDS.length) {
    const c = STANDS.filter(s => s.area === 'civil'), L = c.length ? c : STANDS, m = L.reduce((a, s) => [a[0] + s.p[0]/L.length, a[1] + s.p[1]/L.length], [0, 0]);
    const n = vgNear(m, 800, N => N.road) || vgNear(m, 800); if (n) terms.push(n);
  }
  VBASE.hand = terms;
  VBASE.fire = baseNodes(VD.fire); VBASE.fuel = baseNodes(VD.fuel); VBASE.cater = baseNodes(VD.catering); VBASE.maint = baseNodes(VD.hangars);
  for (const k of ['fire', 'fuel', 'cater', 'maint']) if (!VBASE[k].length) VBASE[k] = terms;
}
const BASE_OF = { bus: 'hand', steps: 'hand', bags: 'hand', belt: 'hand', gpu: 'hand', lav: 'hand', water: 'hand', tug: 'hand', crew: 'hand', cater: 'cater', fuel: 'fuel', van: 'maint', fire: 'fire', amb: 'fire', ops: 'fire' };
// the base of that kind nearest a point (by road)
function baseFor(type, p){
  const L = VBASE[BASE_OF[type]] || VBASE.hand; if (!L || !L.length) return null;
  return L.length === 1 ? L[0] : L.slice().sort((a, b) => dist(...VG[a].p, ...p) - dist(...VG[b].p, ...p))[0];
}

// ── where each vehicle stands round an aircraft: f metres forward of the middle (aft is negative), s metres to the
// right (left negative), and the way it faces relative to the aircraft's heading
const fusW = P => Math.max(2.2, Math.min(6.2, P.len*0.1));
const SLOTS = {
  stepsF: P => ({ f: P.len*0.34, s: -(fusW(P)/2 + 3.6), h: 90 }),
  stepsR: P => ({ f: -P.len*0.36, s: -(fusW(P)/2 + 3.6), h: 90 }),
  bus:    P => ({ f: P.len*0.05, s: -(fusW(P)/2 + 15), h: 0 }),
  bus2:   P => ({ f: -P.len*0.05 - 16, s: -(fusW(P)/2 + 15), h: 0 }),
  beltF:  P => ({ f: P.len*0.2, s: fusW(P)/2 + 3.2, h: -90 }),
  beltR:  P => ({ f: -P.len*0.25, s: fusW(P)/2 + 3.2, h: -90 }),
  bags:   P => ({ f: P.len*0.2, s: fusW(P)/2 + 12, h: 180 }),
  bagsR:  P => ({ f: -P.len*0.2, s: fusW(P)/2 + 12, h: 0 }),
  cater:  P => ({ f: P.len*0.38, s: fusW(P)/2 + 4.4, h: -90 }),
  caterR: P => ({ f: -P.len*0.4, s: fusW(P)/2 + 4.4, h: -90 }),
  fuel:   P => ({ f: P.len*0.02 - 3, s: Math.max(fusW(P)/2 + 6, P.span*0.27), h: 0 }),
  gpu:    P => ({ f: P.len*0.42, s: fusW(P)/2 + 2.5, h: 0 }),
  lav:    P => ({ f: -P.len*0.44, s: fusW(P)/2 + 3.4, h: -90 }),
  water:  P => ({ f: -P.len*0.47, s: -(fusW(P)/2 + 3.4), h: 90 }),
  van:    P => ({ f: P.len*0.1, s: -(P.span*0.3 + 4), h: 180 }),
  amb:    P => ({ f: P.len*0.42, s: -(fusW(P)/2 + 9), h: 0 }),
  tug:    P => ({ f: P.len/2 + 6.5, s: 0, h: 180 }),
  fireA:  P => ({ f: P.len*0.5 + 10, s: -P.span*0.3, h: 150 }),
  fireB:  P => ({ f: P.len*0.5 + 10, s: P.span*0.3, h: -150 }),
  fireC:  P => ({ f: -P.len*0.2, s: -(P.span/2 + 9), h: 70 }),
  fireD:  P => ({ f: -P.len*0.2, s: P.span/2 + 9, h: -70 })
};
function slotFrom(M, h, P, slot){
  const o = SLOTS[slot](P);
  return { p: [M[0] + (Math.sin(h*D2R)*o.f + Math.cos(h*D2R)*o.s)*VM, M[1] + (Math.cos(h*D2R)*o.f - Math.sin(h*D2R)*o.s)*VM], h: norm(h + o.h) };
}
function slotAt(ac, slot){
  const on = ac.stand && (ac.state === 'PARKED' || ac.state === 'ONSTAND');
  return slotFrom(on ? ac.stand.p : acMid(ac), on && ac.stand.hdg != null ? ac.stand.hdg : bodyHdg(ac), ac.perf, slot);
}
// ── a vehicle: drives a list of points; parks; goes home (and is gone, into its base)
function newVeh(type, at, hdg, o = {}){
  const T = VTYPES[type], v = { id: ++VEH.n, type, T, x: at[0], y: at[1], hdg: hdg || 0, v: 0, pts: [], spd: T.kt, job: null, trail: [], ...o };
  VEH.list.push(v); return v;
}
// drive from where it is to point p (arriving facing h): along the roads to the node nearest p, then in on the apron
function driveTo(v, p, h, urgent){
  const a = vgNear([v.x, v.y], 400), b = vgNear(p, 350, N => N.road) || vgNear(p, 600);
  let pts = [];
  if (a && b) { const r = vroute(a, b, urgent); if (r) pts = laneOffset(r); if (pts.length && dist(v.x, v.y, ...pts[0]) < 4*VM) pts.shift(); }
  // the last bit, across the apron: lined up a few lengths out so it noses in square to its slot
  if (h != null) { const back = v.T.len*1.6 + 8; pts.push([p[0] - Math.sin(h*D2R)*back*VM, p[1] - Math.cos(h*D2R)*back*VM]); }
  pts.push([p[0], p[1]]);
  v.pts = pts; v.endH = h; v.urgent = !!urgent; v.parked = false;
}
function sendHome(v, wait = 0){
  const n = baseFor(v.type, [v.x, v.y]); if (!n) { v.gone = true; return; }
  v.job = null; v.home = true; v.leaveAt = S.t + wait; v.pts = []; v.endH = null;
  v.go = () => { const a = vgNear([v.x, v.y], 400), r = a && vroute(a, n); v.pts = r ? laneOffset(r) : [VG[n].p]; v.parked = false; };
}
// a vehicle out of its base at node n, heading off for point p
function dispatch(type, p, h, job, urgent){
  const n = baseFor(type, p); if (!n) return null;
  const r = vgNear(p, 350, N => N.road) || vgNear(p, 600), route0 = r && vroute(n, r, urgent);
  const start = VG[n].p, nx = route0 && route0.length > 1 ? VG[route0[1]].p : p;
  const v = newVeh(type, start, brg(...start, ...nx), { job }); driveTo(v, p, h, urgent);
  return v;
}
// already there when the session opens (a busy apron doesn't start empty)
function placeAt(type, slot, job){
  const v = newVeh(type, slot.p, slot.h, { job }); v.parked = true; v.pts = []; return v;
}

// ── turnarounds: what comes to an aircraft on stand, and when
// on an arrival (A = on-blocks): steps or the bridge, buses at a remote stand, bags off; before a departure
// (R = when the crew calls for start): catering, fuel, toilets and water, bags on, boarding, the tug
const isJet = ac => ac.perf.shape !== 'prop';
const small = ac => ac.perf.wake === 'L' || ac.perf.len < 20;
const heavy = ac => ac.perf.wake === 'H' || ac.perf.len > 50;
// a stand served by an apron bus: off the terminal (a remote stand, or anything over ~180 m from the terminal face)
function bussed(ac){
  const st = ac.stand; if (!st || small(ac) || st.area === 'hangar') return false;
  if (bridgeOf(st)) return false;
  if ((APT.remoteAreas || []).includes(st.area) || st.area === 'remote' || st.area === 'south' || st.term === 'R') return true;
  const t = VD.terms.length ? Math.min(...VD.terms.map(q => dist(...VP(q), ...st.p))) : 0;
  return t > 180*VM;
}
function planJobs(ac, arr){
  const J = [], A = S.t, R = ac.reqAt, add = (k, type, at, until, extra) => J.push({ k, type, at, until, ...extra });
  const L = small(ac), H = heavy(ac), bridge = bridgeOf(ac.stand), bus = bussed(ac);
  const depart = ac.kind === 'DEP' && R != null && R < Infinity;
  const leave = depart ? R - 120 : Infinity;   // steps and bridge stay until the doors close
  if (L) {   // light aircraft and small business jets: the fuel bowser now and then, nothing else
    if (depart && Math.random() < 0.6) add('fuel', 'fuel', R - 25*60, R - 12*60);
    return J;
  }
  if (!bridge) { add('stepsF', 'steps', arr ? A + rnd(20, 50) : -1, leave); if (!isBiz(ac)) add('stepsR', 'steps', arr ? A + rnd(30, 70) : -1, leave); }
  if (arr) {
    if (bus) { add('bus', 'bus', A + rnd(30, 60), A + rnd(6, 9)*60); if (H) add('bus2', 'bus', A + rnd(40, 80), A + rnd(7, 10)*60); }
    if (!isBiz(ac)) { add('beltF', 'belt', A + rnd(60, 120), A + rnd(14, 22)*60); add('bags', 'bags', A + rnd(80, 140), A + rnd(12, 20)*60, { carts: H ? 4 : 3 }); if (H) add('beltR', 'belt', A + rnd(70, 130), A + rnd(16, 24)*60); }
    if (!bridge && isJet(ac)) add('gpu', 'gpu', A + rnd(40, 90), depart ? R - 4*60 : A + rnd(15, 25)*60);
  }
  if (depart) {
    const s = Math.max(S.t + 20, Math.min(R - 45*60, S.t + 60));
    add('cater', 'cater', Math.max(s, R - rnd(42, 50)*60), R - rnd(24, 30)*60); if (H) add('caterR', 'cater', Math.max(s, R - rnd(40, 48)*60), R - rnd(22, 28)*60);
    add('fuel', 'fuel', Math.max(s, R - rnd(38, 44)*60), R - rnd(14, 20)*60);
    if (H || Math.random() < 0.35) add('lav', 'lav', Math.max(s, R - rnd(46, 52)*60), R - rnd(36, 40)*60);
    if (H) add('water', 'water', Math.max(s, R - rnd(44, 50)*60), R - rnd(34, 38)*60);
    if (!isBiz(ac)) { add('beltF', 'belt', Math.max(s, R - rnd(32, 36)*60), R - rnd(6, 9)*60); add('bagsR', 'bags', Math.max(s, R - rnd(30, 34)*60), R - rnd(7, 10)*60, { carts: H ? 4 : 3 }); }
    if (bus) { add('bus', 'bus', Math.max(s, R - rnd(26, 30)*60), R - rnd(15, 18)*60); add('bus2', 'bus', Math.max(s, R - rnd(18, 21)*60), R - rnd(7, 9)*60); }
    if (!bridge && isJet(ac) && !arr) add('gpu', 'gpu', -1, R - 4*60);
    if (Math.random() < 0.12) add('van', 'van', Math.max(s, R - rnd(50, 70)*60), R - rnd(25, 40)*60);
    add('tug', 'tug', R - rnd(5, 8)*60, Infinity);
  }
  return J;
}
// is this aircraft parked where its turnaround happens (on a stand, not in a hangar, not being moved)?
const onStandNow = ac => ac.ground && ac.stand && ac.stand.area !== 'hangar' && (ac.state === 'PARKED' || ac.state === 'ONSTAND') && !ac.handed;
function stepTurnarounds(){
  for (const ac of S.acs) {
    const here = onStandNow(ac);
    if (!here) { if (ac.ta) taEnd(ac); continue; }
    if (!ac.ta || ac.ta.st !== ac.stand) {
      if (ac.ta) taEnd(ac);
      const arr = ac.inAt != null && S.t - ac.inAt < 120;
      ac.ta = { st: ac.stand, kind: ac.kind, jobs: planJobs(ac, arr), first: S.t < 5 };
    } else if (ac.ta.kind !== ac.kind || ac.ta.req !== ac.reqAt) {   // turned round (ARR to DEP), or a new off-blocks time
      ac.ta.kind = ac.kind; const keep = ac.ta.jobs.filter(j => j.v && !j.done && j.until === Infinity);
      const fresh = planJobs(ac, false).filter(j => !keep.some(k => k.k === j.k));
      for (const j of ac.ta.jobs) if (j.v && !j.done && !keep.includes(j)) { if (fresh.some(f => f.k === j.k) && j.type !== 'tug') { const f = fresh.find(f => f.k === j.k); f.v = j.v; j.v.job = f; f.started = true; } else release(j); }
      ac.ta.jobs = [...keep, ...fresh];
    }
    ac.ta.req = ac.reqAt;
    for (const j of ac.ta.jobs) {
      if (j.done) continue;
      if (!j.started && (j.at < 0 || S.t >= j.at) && S.t < j.until - 60) {
        j.started = true; const slot = slotAt(ac, j.k);
        // a vehicle that should already be there when the session opens, or the bridge's own steps: in place
        if (j.at < 0 || ac.ta.first) { if (VEH.list.length < VEH.cap*1.3) { j.v = placeAt(j.type, slot, j); j.v.ac = ac; } }
        else if (vehUnder() || j.type === 'tug' || j.type === 'amb') { j.v = dispatch(j.type, slot.p, slot.h, j); if (j.v) j.v.ac = ac; }
        if (j.v && j.carts) j.v.carts = j.carts;
      }
      if (j.started && S.t >= j.until) release(j);
    }
    ac.ta.first = false;
  }
}
function release(j){ j.done = true; if (j.v && !j.v.attached) { sendHome(j.v, rnd(2, 10)); } j.v = null; }
function taEnd(ac){
  // pushed or towed away (the tug stays on it), or gone: everyone else drives off
  for (const j of ac.ta.jobs) if (j.v && !j.done) { if (j.v.attached) { j.done = true; continue; } release(j); }
  ac.ta = null;
}

// ── the tug: at the nose when it pushes or tows (it comes to the stand a few minutes before, and leaves after)
const TUG_STATES = new Set(['PUSH', 'PULL', 'TOW']);
function tugPose(ac){
  const P = ac.perf, M = acMid(ac), h = bodyHdg(ac), towing = ac.state === 'TOW' && !(ac.path && ac.path.reverse) && !ac.towAlign;
  const f = P.len/2 + 2.2 + VTYPES.tug.len/2;
  return { p: [M[0] + Math.sin(h*D2R)*f*VM, M[1] + Math.cos(h*D2R)*f*VM], h: towing ? h : norm(h + 180) };
}
function stepTugs(){
  for (const ac of S.acs) {
    const need = ac.ground && TUG_STATES.has(ac.state) && !(inHangar(ac));
    let v = ac.tugV;
    if (need) {
      if (!v || v.gone) {
        // the tug already waiting at its nose takes it; otherwise one is there (it came while you weren't looking)
        const w = VEH.list.find(x => x.type === 'tug' && x.ac === ac && !x.home && !x.gone);
        const pose = tugPose(ac); v = w || newVeh('tug', pose.p, pose.h); v.ac = ac; ac.tugV = v;
        if (v.job) { v.job.done = true; v.job = null; }
      }
      const pose = tugPose(ac); v.attached = true; v.x = pose.p[0]; v.y = pose.p[1]; v.hdg = pose.h; v.v = ac.gs || 0; v.pts = []; v.parked = false;
    } else if (v) {
      ac.tugV = null; v.attached = false; v.ac = null;
      // the towbar off and the headset in: it backs away and drives off
      if (!v.gone) { v.hdg = norm(v.hdg + 180); sendHome(v, rnd(15, 30)); }
    }
  }
}

// ── jet bridges: from the map (aeroway=jet_bridge), each fixed to its terminal and swinging out to the stand nearest
// its outer end. Out to the front left door while an aircraft is on the stand; back to its rest position otherwise.
function bridgeOf(st){ return st && VEH.bridgeBy.get(st) || null; }
function vehBridges(){
  VEH.bridges = []; VEH.bridgeBy = new Map();
  for (const [a, b] of VD.bridges) {
    const pa = VP(a), pb = VP(b);
    // the end nearer a stand's door is the outer end
    const door = s => { const P = TYPES.A320, h = s.hdg || 0, f = P.len*0.34, sd = -(fusW(P)/2); return [s.p[0] + (Math.sin(h*D2R)*f + Math.cos(h*D2R)*sd)*VM, s.p[1] + (Math.cos(h*D2R)*f - Math.sin(h*D2R)*sd)*VM]; };
    let best = null, bd = 45*VM, root = pa, end = pb;
    for (const s of STANDS) for (const [r, e] of [[pa, pb], [pb, pa]]) { const d = dist(...door(s), ...e); if (d < bd) { bd = d; best = s; root = r; end = e; } }
    if (!best) continue;
    if (VEH.bridgeBy.has(best)) { const o = VEH.bridgeBy.get(best); if (dist(...door(best), ...o.rest) < dist(...door(best), ...end)) continue; VEH.bridges.splice(VEH.bridges.indexOf(o), 1); }
    // parked back from the door, as they are with no aircraft on the stand
    const L = dist(...root, ...end), rest = [root[0] + (end[0]-root[0])*0.72, root[1] + (end[1]-root[1])*0.72];
    const B = { st: best, root, rest, end: rest.slice(), want: rest, L };
    VEH.bridges.push(B); VEH.bridgeBy.set(best, B);
  }
}
function stepBridges(dt){
  for (const B of VEH.bridges) {
    const ac = B.st.occ, on = ac && ac.stand === B.st && onStandNow(ac) && !(ac.kind === 'DEP' && ac.reqAt != null && S.t > ac.reqAt - 100) && !(ac.inAt != null && S.t - ac.inAt < 25);
    // the cab stops a metre off the fuselage at the front left door
    if (on) { const s = slotAt(ac, 'stepsF'), h = norm(s.h + 180); B.want = [s.p[0] + Math.sin(h*D2R)*(VTYPES.steps.len/2 - 1.2)*VM, s.p[1] + Math.cos(h*D2R)*(VTYPES.steps.len/2 - 1.2)*VM]; }
    else B.want = B.rest;
    const d = dist(...B.end, ...B.want), mv = 0.6*VM*dt;   // a bridge drives at walking pace
    if (d <= mv) B.end = B.want.slice(); else { B.end[0] += (B.want[0] - B.end[0])/d*mv; B.end[1] += (B.want[1] - B.end[1])/d*mv; }
  }
}

// ── driving: speed up and slow down, follow the points, give way to aircraft and to the vehicle in front
const AC_MOVING = new Set(['TAXI', 'PUSH', 'PULL', 'TOW', 'VACATING', 'LINEUP', 'ROLLOUT', 'TAKEOFF']);
function giveWay(v, dt){
  const h = v.hdg, look = 9 + v.v*0.6, ax = v.x + Math.sin(h*D2R)*look*VM, ay = v.y + Math.cos(h*D2R)*look*VM;
  // aircraft on the move (or under a tug) always have right of way
  for (const o of S.acs) {
    if (!o.ground || o === v.ac || !(AC_MOVING.has(o.state) && (o.gs > 0.3 || o.path))) continue;
    const M = acMid(o), r = (Math.max(o.perf.span, o.perf.len)/2 + (v.urgent ? 6 : 14))*VM;
    if (Math.abs(M[0] - ax) > r*2 || Math.abs(M[1] - ay) > r*2) continue;
    if (dist(ax, ay, ...M) < r || dist(v.x, v.y, ...M) < r*0.8) { v.waitT = 0; return 'ac'; }
  }
  // the vehicle in front, while it is moving or has only just stopped; after a few seconds' wait it goes round
  if (v.urgent || (v.waitT || 0) > 6) { v.waitOn = null; if ((v.waitT || 0) > 6) v.waitT = Math.max(0, v.waitT - dt*0.5); return null; }
  for (const w of VEH.list) {
    if (w === v || w.gone || w.parked || w.attached || w.waitOn === v) continue;
    if (Math.abs(w.x - ax) > 15*VM || Math.abs(w.y - ay) > 15*VM) continue;
    const d = dist(ax, ay, w.x, w.y)/VM; if (d > (v.T.len + w.T.len)/2 + 1.5) continue;
    if (Math.abs(angDiff(h, brg(v.x, v.y, w.x, w.y))) < 50) { v.waitOn = w; v.waitT = (v.waitT || 0) + dt; return 'veh'; }
  }
  v.waitOn = null; v.waitT = 0; return null;
}
function driveStep(v, dt){
  if (v.leaveAt != null) { if (S.t < v.leaveAt) return; v.leaveAt = null; v.go && v.go(); v.go = null; }
  if (!v.pts.length) { if (v.home) v.gone = true; else if (!v.parked) { v.parked = true; v.v = 0; if (v.endH != null) v.hdg = v.endH; } return; }
  const tgt = v.pts[0], d = dist(v.x, v.y, ...tgt), last = v.pts.length === 1;
  // slow for the corner ahead and for the last leg in to the aircraft
  let top = v.spd*(v.urgent ? 1.6 : 1);
  if (v.pts.length > 1) { const turn = Math.abs(angDiff(brg(v.x, v.y, ...tgt), brg(...tgt, ...v.pts[1]))); if (turn > 35 && d < 30*VM) top = Math.min(top, turn > 100 ? 5 : 8); }
  if (v.pts.length <= 2 && !v.home) top = Math.min(top, 6 + d/VM*0.15);
  if (giveWay(v, dt)) top = 0;
  const acc = top >= v.v ? 2.4 : 5; v.v = top >= v.v ? Math.min(top, v.v + acc*dt) : Math.max(top, v.v - acc*dt);
  const mv = v.v*0.5144*dt*VM;
  if (mv <= 0) return;
  const want = brg(v.x, v.y, ...tgt), rate = Math.max(30, v.v*0.5144/6*R2D);
  v.hdg = norm(v.hdg + clamp(angDiff(v.hdg, want), -rate*dt, rate*dt));
  if (d <= mv || (d < 3*VM && Math.abs(angDiff(v.hdg, want)) > 100)) { v.x = tgt[0]; v.y = tgt[1]; v.pts.shift(); if (!v.pts.length && v.endH != null && !v.home) v.hdg = v.endH; if (tgt.cb) tgt.cb(v); }
  else { v.x += Math.sin(v.hdg*D2R)*mv; v.y += Math.cos(v.hdg*D2R)*mv; }
  if (v.T.carts) { const t = v.trail, p = t[0]; if (!p || dist(...p, v.x, v.y) > 0.8*VM) { t.unshift([v.x, v.y]); if (t.length > 40) t.pop(); } }
}

// ── comings and goings that aren't a turnaround: engineers' vans between the hangars and the aircraft, crew buses,
// the fire service out on a training run round the field
function stepRoamers(){
  if (S.t < VEH.nextRoam) return;
  const big = Math.min(1, STANDS.length/60);
  VEH.nextRoam = S.t + rnd(90, 240)*(1.4 - big);
  if (!vehUnder() || VEH.list.filter(v => v.job && /^(visit|crew|trip)$/.test(v.job.k)).length >= Math.max(3, VEH.cap*0.12)) return;
  const parked = S.acs.filter(a => onStandNow(a)), roll = Math.random();
  if (roll < 0.45 && parked.length && VBASE.maint.length) {   // an engineer goes to an aircraft and back
    const ac = parked[Math.floor(Math.random()*parked.length)], s = slotAt(ac, 'van');
    const v = dispatch('van', s.p, s.h, { k: 'visit', until: S.t + rnd(8, 20)*60 }); if (v) { v.ac = ac; v.visitUntil = v.job.until; }
  } else if (roll < 0.75 && VBASE.hand.length && STANDS.length > 4) {   // a crew bus out to a stand
    const st = STANDS[Math.floor(Math.random()*STANDS.length)], v = dispatch('crew', st.p, null, { k: 'crew', until: S.t + rnd(1, 3)*60 }); if (v) v.visitUntil = v.job.until;
  } else if (VG_BUILT && VD.nodes.length > 20) {   // a van across the field: hangar to terminal, terminal to hangar
    const from = Math.random() < 0.5 ? 'maint' : 'hand', to = from === 'maint' ? 'hand' : 'maint', L = VBASE[to]; if (!L.length) return;
    const n = L[Math.floor(Math.random()*L.length)], v = dispatch('van', VG[n].p, null, { k: 'trip', until: S.t + 30 }); if (v) v.visitUntil = v.job.until;
  }
}
function stepFireTraining(){
  if (S.t < VEH.nextFire || !VBASE.fire.length || !VD.fire.length || !S.rtow) return;   // not in the Academy exercises
  VEH.nextFire = S.t + rnd(35, 70)*60;
  if (S.emg && S.acs.some(a => a.emerg && !a.emerg.done)) return;
  // to the fire training ground where the airport has one; otherwise out along the perimeter road to a far corner
  const home = VBASE.fire[0], ground = baseNodes(VD.firetrain || []);
  const far = Object.values(VG).filter(N => N.road && N.adj.length === 1).sort((a, b) => dist(...b.p, ...VG[home].p) - dist(...a.p, ...VG[home].p)).slice(0, 12);
  const N = ground.length ? VG[ground[0]] : far.length ? far[Math.floor(Math.random()*far.length)] : null; if (!N || !vroute(home, N.id)) return;
  const atGround = !!ground.length;
  for (let k = 0; k < (Math.random() < 0.5 ? 2 : 1); k++) {
    const v = dispatch('fire', N.p, null, { k: 'training', until: S.t + rnd(6, 12)*60 }); if (!v) continue;
    v.training = true; v.atGround = atGround; v.visitUntil = v.job.until; v.leaveAt = S.t + k*20; v.go = null;
  }
}
function vehInit(){
  vgBuild(); vehBases(); vehBridges();
  VEH.list = []; VEH.n = 0; VEH.nextRoam = S.t + rnd(30, 90); VEH.nextFire = S.t + rnd(8, 25)*60;
  VEH.cap = Math.round(clamp(STANDS.length*1.6, 24, 160));
  for (const B of VEH.bridges) B.end = B.rest.slice();
  for (const ac of S.acs) { ac.ta = null; ac.tugV = null; }
}
function stepVehicles(dt){
  if (!VG_BUILT) return;
  VEH.tick += dt;
  if (VEH.tick >= 1) { VEH.tick = 0; stepTurnarounds(); stepRoamers(); stepFireTraining(); stepRadio(); }
  stepTugs(); stepBridges(dt);
  for (const v of VEH.list) {
    if (v.attached) continue;
    if (v.visitUntil != null && v.parked && S.t >= v.visitUntil) { v.visitUntil = null; sendHome(v, 0); }
    driveStep(v, dt);
  }
  if (VEH.list.some(v => v.gone)) VEH.list = VEH.list.filter(v => !v.gone);
}
S.listeners.push((ev, ac) => {
  if (ev === 'start') vehInit();
  if (ev === 'removed' && ac) { if (ac.ta) taEnd(ac); if (ac.tugV) { ac.tugV.attached = false; sendHome(ac.tugV, 5); ac.tugV = null; } }
});

// ── drawing (under the aircraft: a bowser stands under the wing)
const VEH_MIN_SCALE = 260;   // pixels per NM below which they are too small to see
function vehBox(len, wid){ cx.beginPath(); const r = Math.min(wid, len)*0.18; cx.roundRect ? cx.roundRect(-wid/2, -len/2, wid, len, r) : cx.rect(-wid/2, -len/2, wid, len); }
function drawVehicle(v, mpx){
  const T = v.T, X = sx(v.x), Y = sy(v.y); if (X < -60 || Y < -60 || X > W + 60 || Y > H + 60) return;
  const k = Math.max(mpx, 2.6/T.len*1.6), len = T.len*k, wid = Math.max(1.6, T.wid*k);
  // baggage carts trailing along the road behind the tractor
  if (T.carts && v.carts !== 0 && v.trail.length > 2) {
    const n = v.carts || T.carts; let need = (T.len/2 + 2.4)*VM, acc = 0, prev = [v.x, v.y], placed = 0;
    for (const q of v.trail) { const sg = dist(...prev, ...q); acc += sg;
      while (acc >= need && placed < n) { const f = (acc - need)/sg, p = [q[0] + (prev[0] - q[0])*f, q[1] + (prev[1] - q[1])*f], hh = brg(...q, ...prev);
        cx.save(); cx.translate(sx(p[0]), sy(p[1])); cx.rotate(hh*D2R); vehBox(3.2*k, Math.max(1.4, 1.7*k)); cx.fillStyle = '#d7dbe1'; cx.fill(); cx.strokeStyle = 'rgba(0,0,0,.55)'; cx.lineWidth = 0.6; cx.stroke(); cx.restore();
        placed++; need += 3.8*VM; }
      prev = q; if (placed >= n) break; }
  }
  cx.save(); cx.translate(X, Y); cx.rotate(v.hdg*D2R);
  vehBox(len, wid); cx.fillStyle = T.col; cx.fill(); cx.strokeStyle = 'rgba(0,0,0,.6)'; cx.lineWidth = 0.7; cx.stroke();
  if (len > 5) {
    // the cab at the front, and the body's own detail: the tank, the stairs, the box, the belt, the chequers
    cx.fillStyle = T.cab; cx.fillRect(-wid/2 + 0.4, -len/2 + 0.4, wid - 0.8, Math.min(len*0.28, 2.2*k));
    if (T.tank) { cx.fillStyle = 'rgba(40,110,60,.55)'; cx.fillRect(-wid*0.32, -len*0.12, wid*0.64, len*0.55); }
    if (T.stairs) { cx.strokeStyle = 'rgba(40,40,40,.55)'; cx.lineWidth = 0.6; for (let i = 0; i < 6; i++) { const y = -len*0.1 + i*len*0.09; cx.beginPath(); cx.moveTo(-wid*0.4, y); cx.lineTo(wid*0.4, y); cx.stroke(); } }
    if (T.box) { cx.strokeStyle = 'rgba(0,0,0,.35)'; cx.lineWidth = 0.6; cx.strokeRect(-wid*0.42, -len*0.15, wid*0.84, len*0.6); }
    if (T.belt) { cx.fillStyle = '#333'; cx.fillRect(-wid*0.22, -len*0.2, wid*0.44, len*0.68); }
    if (T.check) { cx.fillStyle = '#1a1a1a'; for (let i = 0; i < 4; i++) cx.fillRect(-wid/2 + (i % 2)*wid/2, -len*0.05 + Math.floor(i/2)*len*0.12, wid/2, len*0.12); }
    if (v.type === 'fire') { cx.fillStyle = 'rgba(255,255,255,.75)'; cx.fillRect(-wid*0.12, -len*0.2, wid*0.24, len*0.62); }
    if (v.type === 'amb') { cx.fillStyle = '#1f8f3a'; cx.fillRect(-wid/2, len*0.05, wid, len*0.1); }
  }
  // beacons: amber on the move round aircraft, blue for the emergency services on a call
  const blink = Math.floor(performance.now()/260 + v.id) % 2 === 0;
  if (blink && (v.v > 0.5 || v.attached || (T.blue && v.urgent))) {
    cx.fillStyle = T.blue && (v.urgent || v.blues) ? 'rgba(60,140,255,.95)' : 'rgba(255,170,0,.95)';
    cx.beginPath(); cx.arc(0, -len*0.3, Math.max(1.1, 0.7*k), 0, 7); cx.fill();
  }
  cx.restore();
}
function drawBridges(mpx){
  for (const B of VEH.bridges) {
    const a = [sx(B.root[0]), sy(B.root[1])], b = [sx(B.end[0]), sy(B.end[1])];
    if (Math.max(a[0], b[0]) < -50 || Math.min(a[0], b[0]) > W + 50 || Math.max(a[1], b[1]) < -50 || Math.min(a[1], b[1]) > H + 50) continue;
    const w = Math.max(2, 3.6*mpx), h = Math.atan2(b[1] - a[1], b[0] - a[0]);
    cx.save(); cx.lineCap = 'butt';
    cx.strokeStyle = 'rgba(40,46,56,.75)'; cx.lineWidth = w + 1.4; cx.beginPath(); cx.moveTo(...a); cx.lineTo(...b); cx.stroke();
    cx.strokeStyle = '#a9b1bc'; cx.lineWidth = w; cx.beginPath(); cx.moveTo(...a); cx.lineTo(...b); cx.stroke();
    // the telescopic joints, the drive wheels and the cab at the door
    cx.strokeStyle = 'rgba(60,66,76,.6)'; cx.lineWidth = Math.max(0.6, 0.3*mpx);
    for (const f of [0.35, 0.65]) { const p = [a[0] + (b[0]-a[0])*f, a[1] + (b[1]-a[1])*f]; cx.beginPath(); cx.moveTo(p[0] - Math.sin(h)*w/2, p[1] + Math.cos(h)*w/2); cx.lineTo(p[0] + Math.sin(h)*w/2, p[1] - Math.cos(h)*w/2); cx.stroke(); }
    cx.translate(...b); cx.rotate(h); cx.fillStyle = '#8d96a2'; cx.strokeStyle = 'rgba(30,34,40,.8)'; cx.lineWidth = 0.8;
    cx.fillRect(-w*0.9, -w*0.75, w*1.3, w*1.5); cx.strokeRect(-w*0.9, -w*0.75, w*1.3, w*1.5);
    cx.restore();
  }
}
function drawVehicles(){
  const sc = V.scale; if (sc < VEH_MIN_SCALE || !VG_BUILT) return;
  const mpx = sc/1852;
  drawBridges(mpx);
  for (const v of VEH.list) drawVehicle(v, mpx);
}
// what a vehicle is up to, for the pop-up when it is clicked
function vehDoing(v){
  const C = S.rc;
  if (C && C.v === v) return C.st === 'OUT' ? `Driving to holding point ${C.hp.replace(/~\d+$/, '')} for a ${C.why}` : C.st === 'READY' ? `At holding point ${C.hp.replace(/~\d+$/, '')}, asking to enter runway ${C.rw}` : C.st === 'ON' ? `Inspecting runway ${C.rw}` : `Vacating runway ${C.rw}`;
  if (v.type === 'fire' && v.ac && v.blues) return v.parked ? (v.job && v.job.k === 'attend' ? `Attending ${v.ac.cs}` : `Standing by for ${v.ac.cs}'s ${v.ac.emerg ? v.ac.emerg.k : 'emergency'}`) : `On a call to ${v.ac.cs}`;
  if (v.type === 'amb' && v.ac) return v.parked ? `Meeting ${v.ac.cs} on ${APT.standWord || 'stand'} ${v.ambSt ? v.ambSt.id : ''}` : `On a call to meet ${v.ac.cs}`;
  if (v.type === 'tug' && v.job && v.job.k === 'emgtug' && v.ac) return `Tug for ${v.ac.cs} after its emergency`;
  if (v.attached && v.ac) return `${v.ac.state === 'TOW' ? 'Towing' : v.ac.state === 'PULL' ? 'Pulling forward' : 'Pushing back'} ${v.ac.cs}`;
  if (v.home) return 'Returning to base';
  if (v.training) return v.parked ? (v.atGround ? 'Fire crew training at the fire training ground' : 'Fire service training') : 'Out on a training run';
  const J = v.job, ac = v.ac, cs = ac ? ac.cs : '', st = ac && ac.stand ? ` on ${APT.standWord || 'stand'} ${ac.stand.id}` : '';
  const w = { stepsF: 'Steps at the front door of', stepsR: 'Steps at the rear door of', bus: 'Bus for the passengers of', bus2: 'Second bus for', beltF: 'Belt loader at the hold of', beltR: 'Belt loader at the rear hold of',
    bags: 'Unloading the bags of', bagsR: 'Bringing the bags for', cater: 'Catering', caterR: 'Catering (rear galley)', fuel: 'Refuelling', gpu: 'Ground power for', lav: 'Toilet service for', water: 'Water service for', van: 'Engineer at', amb: 'Ambulance for', tug: 'Tug waiting at the nose of' };
  if (J && w[J.k]) return `${v.parked ? '' : 'On the way: '}${w[J.k]} ${cs}${st}`;
  if (J && J.k === 'crew') return v.parked ? 'Crew bus dropping off a crew' : 'Crew bus heading out';
  if (J && J.k === 'trip') return 'Driving across the airfield';
  return v.parked ? 'Parked' : 'Driving';
}
const vehPop = document.createElement('div'); vehPop.className = 'vehpop'; vehPop.hidden = true; document.body.appendChild(vehPop);
function vehAt(X, Y){
  if (V.scale < VEH_MIN_SCALE) return null;
  let best = null, bd = 12;
  for (const v of VEH.list) { const d = Math.hypot(sx(v.x) - X, sy(v.y) - Y); if (d < bd) { bd = d; best = v; } }
  return best;
}
function showVehPop(v, e){
  vehPop.innerHTML = `<b>${esc(v.cs ? radioName(v) : v.T.name)}</b>${v.cs ? `<span class="vt">${esc(v.T.name)}</span>` : ''}<span>${esc(vehDoing(v))}</span>`;
  vehPop.hidden = false; const r = cv.getBoundingClientRect();
  vehPop.style.left = Math.min(window.innerWidth - 240, r.left + e.offsetX + 14) + 'px'; vehPop.style.top = (r.top + e.offsetY - 10 + window.scrollY) + 'px';
  clearTimeout(vehPop.t); vehPop.t = setTimeout(() => { vehPop.hidden = true; }, 4000);
}
document.addEventListener('pointerdown', e => { if (!vehPop.hidden && !vehPop.contains(e.target)) vehPop.hidden = true; });

// ═════════════════════════ radio vehicles: runway checks and the fire service ═════════════════════════
// The airside operations car (OPS1, "Ops One") inspects the runway: it drives to a holding point and asks the tower to
// enter; cleared on (OPS1 ENTER), it drives the length of the runway on one side, turns at the far end, comes back on
// the other and vacates where it came on, then reports vacated. While it is on the runway the runway is occupied: an
// arrival goes around and a departure must not be cleared. OPS1 VACATE gets it off at the nearest exit; OPS1 HOLD
// keeps it at the holding point. It asks for a routine inspection every hour or two, and you can send it (OPS1 CHECK
// [runway], or Runway check in the weather panel). With the runway closed for an inspection it goes on by itself.
// A MAYDAY: the fire tenders (FIRE1..) go out to standby by the runway on blue lights; after landing the aircraft
// stops clear of the runway, the tenders surround it and inspect it, and then a tug comes to tow it in: approve that
// tow like any other. A medical: the ambulance meets the aircraft on its stand.
const RC_SPEED = 40;   // kt on the runway
const radioName = v => v.cs ? v.cs.replace(/^([A-Z]+)(\d)$/, (m, w, d) => w[0] + w.slice(1).toLowerCase() + ' ' + d) : v.T.name;
const radioSpoken = v => v.cs ? v.cs.replace(/^([A-Z]+)(\d)$/, (m, w, d) => w[0] + w.slice(1).toLowerCase() + ' ' + DIG[+d]) : v.T.name;
function vcall(v, text){ const t = `${APT.tower[0]}, ${radioSpoken(v)}, ${text}`; log('plt', t.replace(radioSpoken(v), radioName(v)), radioName(v).toUpperCase()); say(t, v.cs); }
function vread(v, text){ const t = `${text}, ${radioSpoken(v)}`; log('plt', t.replace(radioSpoken(v), radioName(v)), radioName(v).toUpperCase()); say(t, v.cs); }
function vatc(v, text){ log('atc', `${radioName(v)}, ${text}`, 'TOWER'); }
// the vehicle on that runway (any end of it), if any
function vehOnRwy(rw){ const id = rwyOf(rw).id; return VEH.list.find(v => v.onRwy === id && !v.gone) || null; }
const rcHolds = R => Object.keys(HOLDS).filter(h => holdRwy(h) === R && HOLDS[h].node && GN[HOLDS[h].node] && VG['t:' + HOLDS[h].node]);
const rLen = R => R.len || RWY_M;
const holdM = (R, h) => R.mOf(GN[HOLDS[h].rwy] ? GN[HOLDS[h].rwy].p : GN[HOLDS[h].node].p);
function rcEntry(R, from){
  // a holding point near one end of the runway (so the check covers it all), the nearest by road
  let best = null, bs = Infinity;
  for (const h of rcHolds(R)) {
    const r = vroute(from, 't:' + HOLDS[h].node, true); if (!r) continue;
    let L = 0; for (let i = 1; i < r.length; i++) L += dist(...VG[r[i-1]].p, ...VG[r[i]].p);
    const m = holdM(R, h), sc = L/VM + 1.5*Math.min(m, rLen(R) - m);
    if (sc < bs) { bs = sc; best = h; }
  }
  return best;
}
// OPS1 out to the runway: rw (an end designator), why (log text), auto (the runway is closed: no clearance needed)
function opsCheck(rw, why, auto){
  if (S.rc) { if (auto) S.rc.auto = true; return S.rc; }
  const R = rwyOf(rw || S.rwy), base = baseFor('ops', [0, 0]); if (!base) return null;
  const hp = rcEntry(R, base); if (!hp) return null;
  const v = newVeh('ops', VG[base].p, 0, { cs: 'OPS1' });
  const r = vroute(base, 't:' + HOLDS[hp].node, true);
  v.pts = r ? laneOffset(r) : [GN[HOLDS[hp].node].p]; const end = v.pts[v.pts.length - 1] = GN[HOLDS[hp].node].p.slice();
  end.cb = () => rcAtHold();
  if (r && r.length > 1) v.hdg = brg(...VG[r[0]].p, ...VG[r[1]].p);
  S.rc = { v, R, rw: rwyName(R.id), hp, st: 'OUT', auto: !!auto, why: why || 'routine runway inspection', t: S.t };
  v.need = null; renderAtisSoon();
  return S.rc;
}
function rcAtHold(){
  const C = S.rc; if (!C) return; C.st = 'READY'; C.t = S.t; C.v.v = 0; C.v.hdg = brg(...GN[HOLDS[C.hp].node].p, ...C.R.rm(holdM(C.R, C.hp), 0));
  if (C.auto || rwyBlocked()) { vcall(C.v, `at holding point ${hpWords(C.hp)}, entering the closed runway ${C.rw} for the inspection`); rcEnter(true); return; }
  C.v.need = 'Request to enter runway'; C.asked = S.t;
  vcall(C.v, `at holding point ${hpWords(C.hp)}, request to enter runway ${C.rw} for a ${C.why}`);
  renderAtisSoon();
}
function rcPath(C){
  const R = C.R, L = rLen(R), mE = holdM(R, C.hp), dir = mE < L/2 ? 1 : -1, far = dir > 0 ? L - 45 : 45, s1 = 9*(KEEP_LEFT ? 1 : -1)*dir;
  const P = (m, o) => R.rm(m, o);
  const pts = [P(mE + dir*12, s1), P(far, s1), P(far + dir*25, 0), P(far, -s1), P(mE + dir*18, -s1), P(mE, 0), GN[HOLDS[C.hp].node].p.slice()];
  pts[pts.length - 1].cb = () => rcOff(true);
  return pts;
}
function rcEnter(auto){
  const C = S.rc; if (!C || C.st !== 'READY') return false;
  C.st = 'ON'; C.v.need = null; C.v.onRwy = C.R.id; C.v.spd = RC_SPEED; C.v.urgent = true; C.v.pts = rcPath(C); C.v.parked = false; C.t = S.t;
  renderAtisSoon(); return true;
}
// off at the nearest holding point on its way (done: the whole length inspected)
function rcOff(done){
  const C = S.rc; if (!C) return; const v = C.v;
  v.onRwy = null; v.spd = v.T.kt; v.urgent = false;
  if (done) { vcall(v, `runway ${C.rw} vacated at ${hpWords(C.hp)}, inspection complete, ${Math.random() < 0.15 ? 'one item of FOD picked up, ' : ''}runway is clear`); if (!C.auto) S.score.pts += 5; }
  else vcall(v, 'runway vacated');
  S.rc = null; sendHome(v, 3); renderAtisSoon(); emit('rcdone', done);
}
function rcVacate(){
  const C = S.rc; if (!C || C.st !== 'ON') return false;
  const R = C.R, v = C.v, m = R.mOf([v.x, v.y]), ahead = v.pts.length > 1 ? Math.sign(R.mOf(v.pts[0]) - m) || 1 : 1;
  // the nearest holding point, preferring one ahead of it
  const hs = rcHolds(R).map(h => [h, holdM(R, h)]).sort((a, b) => (Math.abs(a[1] - m) + ((a[1] - m)*ahead < -30 ? 400 : 0)) - (Math.abs(b[1] - m) + ((b[1] - m)*ahead < -30 ? 400 : 0)));
  if (!hs.length) return false;
  const [h, hm] = hs[0]; C.hp = h; C.st = 'OFF';
  const out = GN[HOLDS[h].node].p.slice(); out.cb = () => rcOff(false);
  v.pts = [R.rm(hm, 0), out];
  return true;
}
// the controller's instructions to a radio vehicle: OPS1 ENTER / VACATE / HOLD / CHECK [rwy]; RWY CHECK [rwy]
function vehCommand(toks){
  let t0 = toks[0];
  if ((t0 === 'RWY' || t0 === 'RUNWAY') && toks[1] === 'CHECK') { toks = ['OPS1', 'CHECK', ...toks.slice(2)]; t0 = 'OPS1'; }
  if (!/^(OPS1?|FIRE\d?)$/.test(t0)) return false;
  const what = toks[1] || '', arg = toks[2];
  if (/^FIRE/.test(t0)) { sys('The fire service is busy with its emergency: it reports to you when the inspection is done.'); return true; }
  const C = S.rc;
  if (what === 'CHECK' || what === 'INSPECT') {
    if (C) { sys(`Ops 1 is already ${C.st === 'OUT' ? 'on its way to holding point ' + C.hp : C.st === 'READY' ? 'at holding point ' + C.hp + ', waiting to enter' : 'on the runway'}.`); return true; }
    const rw = arg && RW_ENDS.includes(arg) ? arg : S.rwy;
    const ok = opsCheck(rw, 'runway inspection');
    if (!ok) { sys('No holding point for a runway check can be reached by road.'); return true; }
    log('atc', `Ops 1, request runway inspection, runway ${rwyName(ok.R.id)}, call at holding point ${ok.hp.replace(/~\d+$/, '')}`, 'TOWER');
    vread(ok.v, `wilco, holding point ${hpWords(ok.hp)}`);
    return true;
  }
  if (!C) { sys('Ops 1 is not out on the airfield. Send it on a runway check with OPS1 CHECK.'); return true; }
  if (what === 'ENTER' || what === 'APPROVE' || what === 'CLEAR' || what === 'GO') {
    if (C.st !== 'READY') { sys(C.st === 'OUT' ? `Ops 1 is still driving to holding point ${C.hp}.` : 'Ops 1 is already on the runway.'); return true; }
    const busy = S.acs.find(o => onRunway(o, C.rw)), fin = S.acs.find(o => o.kind === 'ARR' && o.airborne && o.ctl && (o.app ? rwyOf(o.app) === C.R : rwyOf(S.rwy) === C.R) && finalDist(o) < 3);
    if (busy) sys(`Careful: ${busy.cs} is on the runway.`, true);
    if (fin) sys(`Careful: ${fin.cs} is cleared to land on ${finalDist(fin).toFixed(1)} NM final: it will go around.`, true);
    vatc(C.v, `enter runway ${C.rw} at ${C.hp.replace(/~\d+$/, '')}, report vacated`);
    vread(C.v, `entering runway ${C.rw} at ${hpWords(C.hp)}, wilco`);
    rcEnter(); return true;
  }
  if (what === 'VACATE' || what === 'VAC' || what === 'OFF') {
    if (C.st !== 'ON') { sys('Ops 1 is not on the runway.'); return true; }
    vatc(C.v, `vacate the runway ${rwyName(C.R.id)} immediately, report vacated`);
    rcVacate(); vread(C.v, `vacating, nearest exit, ${hpWords(C.hp)}`); return true;
  }
  if (what === 'HOLD' || what === 'WAIT') {
    if (C.st === 'READY') { vatc(C.v, 'hold position'); vread(C.v, 'holding'); C.asked = S.t; return true; }
    sys(C.st === 'ON' ? 'Ops 1 is on the runway: VACATE gets it off.' : 'Ops 1 will hold at the holding point and call you.'); return true;
  }
  if (what === 'HOME' || what === 'CANCEL') {
    if (C.st === 'ON') { sys('Ops 1 is on the runway: VACATE gets it off first.'); return true; }
    vatc(C.v, 'runway inspection cancelled'); vread(C.v, 'returning to base'); C.v.need = null; S.rc = null; sendHome(C.v, 2); renderAtisSoon(); return true;
  }
  sys('Ops 1: CHECK [runway], ENTER, HOLD, VACATE or CANCEL.'); return true;
}
let atisT = 0; function renderAtisSoon(){ atisT = 1; }
// routine inspections, the reminders, and incidents with the car on the runway
function stepRadio(){
  if (atisT) { atisT = 0; if (typeof renderAtis === 'function') renderAtis(); }
  const C = S.rc;
  if (S.rtow && S.running) {   // not in the Academy exercises
    if (S.rcNext == null) S.rcNext = S.t + rnd(12, 30)*60;
    if (!C && S.t >= S.rcNext) { S.rcNext = S.t + rnd(70, 130)*60; if (!rwyBlocked()) opsCheck(S.rwy, 'routine runway inspection'); }
  }
  if (C && C.st === 'READY' && C.asked != null && S.t - C.asked > 240) { C.asked = S.t; vcall(C.v, `still holding at ${hpWords(C.hp)} for the runway inspection`); }
  if (C && C.st === 'ON') for (const ac of S.acs) {
    if (!(ac.onRwy && (ac.rwyId || RWYS[0].id) === C.R.id) || ac.rcHit === C.t) continue;
    if (ac.state === 'TAKEOFF' || ac.state === 'ROLLOUT') { ac.rcHit = C.t; S.score.incidents++; S.score.pts -= 60; sys(`INCIDENT: ${ac.cs} ${ac.state === 'TAKEOFF' ? 'took off' : 'landed'} with Ops 1 on the runway.`, true); }
  }
  // the runway closed for an inspection (bird strike, debris, after an emergency): Ops 1 goes out and drives it
  if (S.emg && S.emg.rwyBlock && !C) opsCheck(S.rwy, 'runway inspection', true);
  stepFire();
}

// ── the fire service and the ambulance
const FIRE_SLOTS = ['fireA', 'fireB', 'fireC', 'fireD'];
function fireStandby(ac){
  if (!VBASE.fire.length || ac.fireV) return;
  const R = rwyOf(landRw(ac)), L = rLen(R), hs = rcHolds(R).map(h => [h, holdM(R, h)]);
  const n = STANDS.length > 40 ? 3 : 2; ac.fireV = [];
  for (let k = 0; k < n; k++) {
    const want = L*(k + 1)/(n + 1), h = hs.sort((a, b) => Math.abs(a[1] - want) - Math.abs(b[1] - want))[0]; if (!h) break;
    const p = GN[HOLDS[h[0]].node].p, v = dispatch('fire', p, null, { k: 'standby' }, true); if (!v) break;
    v.cs = 'FIRE' + (k + 1); v.urgent = true; v.blues = true; v.ac = ac; v.leaveAt = S.t + k*6; ac.fireV.push(v);
  }
  if (ac.fireV.length) log('coord', `Fire service: ${ac.fireV.length} tenders to standby positions by runway ${rwyName(R.id)} for ${ac.cs}.`, 'FIRE');
}
// the aircraft has stopped clear of the runway: the tenders close in, inspect it, then a tug comes to tow it in
function emgStopped(ac){
  ac.need = 'Fire service attending'; ac.emgSeq = { st: 'FIRE', t: S.t };
  const ex = exitWord(ac.exit || '');
  pilot(ac, `${ac.unit()}, ${spoken(ac.cs)}, we're stopping here on ${ex || 'the taxiway'}, request the fire service to check the aircraft over`);
  if (!ac.fireV || !ac.fireV.length) fireStandby(ac);
  (ac.fireV || []).forEach((v, k) => { const s = slotAt(ac, FIRE_SLOTS[k % 4]); v.job = { k: 'attend' }; driveTo(v, s.p, s.h, true); v.blues = true; });
  if (S.sel === ac && typeof renderSel === 'function') renderSel();
}
function stepFire(){
  for (const ac of S.acs) {
    if (ac.emerg && !ac.emerg.done && ac.emerg.k === 'MAYDAY' && !ac.fireV && (ac.emerg.ack || S.t - ac.emerg.t > 30)) fireStandby(ac);
    const E = ac.emgSeq;
    if (E && E.st === 'FIRE') {
      const there = (ac.fireV || []).filter(v => !v.gone && v.parked).length;
      if ((ac.fireV && ac.fireV.length && there === ac.fireV.filter(v => !v.gone).length) || S.t - E.t > 240) { E.st = 'INSP'; E.t = S.t; E.until = S.t + rnd(3, 5)*60; ac.need = 'Fire service inspecting'; }
    } else if (E && E.st === 'INSP' && S.t >= E.until) {
      const f = (ac.fireV || [])[0] || { cs: 'FIRE1', T: VTYPES.fire };
      vcall(f, `inspection of ${spoken(ac.cs)} complete, no fire, brakes cooling, the aircraft will need a tow to ${APT.standWord || 'stand'}`);
      E.st = 'TUG'; E.t = S.t; ac.need = 'Waiting for a tug';
      const s = slotAt(ac, 'tug'), v = dispatch('tug', s.p, s.h, { k: 'emgtug' }, true); if (v) { v.ac = ac; ac.emgTug = v; }
    } else if (E && E.st === 'TUG' && ((ac.emgTug && ac.emgTug.parked) || !ac.emgTug || S.t - E.t > 600)) {
      E.st = 'TOW';
      // the tow in: like a tug holding with an aircraft at a holding point, it asks to go on to the stand
      const st = ac.stand && (!ac.stand.occ || ac.stand.occ === ac) ? ac.stand : freeStand(ac);
      if (!st) { E.st = 'TUG'; E.t = S.t; continue; }
      st.occ = ac; ac.stand = st;
      let node = ac.vacNode; if (!node || node[0] === 'R') { const n = vgNear(acMid(ac), 300, N => !N.road); node = n ? n.slice(2) : null; }
      Object.assign(ac, { state: 'TOW', towWas: 'ONSTAND', towNode: node, towHold: exitWord(ac.exit || '') || 'its position', tow: { to: st, asked: true }, need: 'Request tow', emgStop: false, emgTow: true, path: null, gs: 0, doneAt: Infinity });
      log('plt', `${APT.tower[0]}, tug with ${ac.cs} on ${ac.towHold}, request tow to ${towDest(st)}`, 'TUG', ac);
      say(`${APT.tower[0]}, tug with ${spoken(ac.cs)}, request tow to ${towDest(st)}`, 'tug');
      if (S.sel === ac && typeof renderSel === 'function') renderSel();
    }
    // the tenders go home once the tow is under way (or the aircraft has gone)
    if (ac.fireV && ac.fireV.length && ((ac.state === 'TOW' && ac.path) || (ac.state === 'ONSTAND' && !ac.emgSeq) || (ac.emerg && ac.emerg.done && !ac.emgStop && !ac.emgSeq && ac.ground && ac.state !== 'VACATING' && ac.state !== 'ROLLOUT'))) {
      for (const v of ac.fireV) if (!v.gone) { v.urgent = false; v.blues = false; sendHome(v, rnd(5, 20)); }
      ac.fireV = []; if (ac.emgSeq && ac.state === 'TOW') ac.emgSeq = null;
    }
    // a medical: the ambulance to its stand, there before it is
    if (ac.medical && ac.stand && !ac.ambV && (ac.ground || finalDist(ac) < 12)) {
      const s = slotFrom(ac.stand.p, ac.stand.hdg || 0, ac.perf, 'amb'), v = dispatch('amb', s.p, s.h, { k: 'amb' }, true);
      if (v) { v.ac = ac; v.blues = true; ac.ambV = v; v.ambSt = ac.stand; }
    }
    const A = ac.ambV;
    if (A && !A.gone) {
      if (ac.stand && A.ambSt !== ac.stand && !A.home) { A.ambSt = ac.stand; const s = slotFrom(ac.stand.p, ac.stand.hdg || 0, ac.perf, 'amb'); driveTo(A, s.p, s.h, true); }
      if (A.visitUntil == null && ac.state === 'ONSTAND' && A.parked) { A.visitUntil = S.t + rnd(8, 12)*60; A.urgent = false; }
      if (A.visitUntil != null && A.parked && S.t >= A.visitUntil) { A.blues = false; A.visitUntil = null; ac.medical = false; sendHome(A, 0); }
    }
  }
  // gone (removed, or left): any vehicles with nothing left to do go home
  for (const v of VEH.list) if (v.ac && !S.acs.includes(v.ac) && !v.home && !v.attached) { v.ac = null; v.urgent = false; v.blues = false; sendHome(v, 5); }
}
S.listeners.push((ev, ac) => {
  if (ev === 'emergency' && ac && ac.emerg && /medical/.test(ac.emerg.why)) ac.medical = true;
  if (ev === 'start') { S.rc = null; S.rcNext = null; }
});

// ── the strip board: a radio vehicle waiting for you (Ops 1 at the holding point) gets its own strip
function vehSig(){ const C = S.rc; return C ? C.st + (C.v.need || '') : ''; }
function vehStrips(doc = document){
  const C = S.rc; if (!C) return [];
  const d = doc.createElement('div'); d.className = `strip VEH${C.v.need ? ' need' : ''}`;
  const st = C.st === 'OUT' ? `To ${C.hp.replace(/~\d+$/, '')}` : C.st === 'READY' ? `Hold ${C.hp.replace(/~\d+$/, '')}` : C.st === 'ON' ? `On ${C.rw}` : 'Vacating';
  d.innerHTML = `<span class="bar"></span><span class="c-a"><span class="cs">OPS 1</span><span class="ty">Runway inspection</span></span><span class="c-b"><span class="rte">${esc(C.rw)}</span><span class="lv">${esc(st)}</span></span><span class="c-c"><span class="stt"></span><span class="fq">TWR</span></span>`;
  d.querySelector('.stt').textContent = C.v.need ? '◆ ' + C.v.need : C.st === 'ON' ? 'Runway occupied' : C.st === 'OFF' ? 'Vacating' : 'Driving';
  const acts = doc.createElement('span'); acts.className = 'vacts';
  const bt = (label, cmd, cls) => { const b = doc.createElement('button'); b.type = 'button'; b.textContent = label; if (cls) b.className = cls; b.onclick = e => { e.stopPropagation(); command(cmd); renderStrips(true); }; acts.append(b); };
  if (C.st === 'READY') { bt('Enter runway', 'OPS1 ENTER', 'go'); bt('Hold', 'OPS1 HOLD'); }
  if (C.st === 'ON') bt('Vacate', 'OPS1 VACATE', 'danger');
  if (C.st === 'OUT' || C.st === 'READY') bt('Cancel', 'OPS1 CANCEL');
  d.append(acts);
  d.onclick = () => { V.cx = C.v.x; V.cy = C.v.y; V.scale = Math.max(V.scale, (Math.min(W, H) || 600)/(900*M2NM)); };
  return [d];
}
// the weather panel's runway line: send Ops 1 to inspect the runway, or see where it is
function rcPanel(){
  if (!VG_BUILT && !S.running) return '';
  const C = S.rc;
  const st = !C ? 'Runway inspection: Ops 1 at base' : C.st === 'OUT' ? `Ops 1 driving to ${C.hp.replace(/~\d+$/, '')} for a ${C.why}` : C.st === 'READY' ? `Ops 1 at ${C.hp.replace(/~\d+$/, '')}, requesting to enter ${C.rw}` : C.st === 'ON' ? `Ops 1 on runway ${C.rw}: runway occupied` : 'Ops 1 vacating';
  const b = !C ? '<button data-rc="OPS1 CHECK">Runway check</button>' : C.st === 'READY' ? '<button data-rc="OPS1 ENTER" class="go">Enter runway</button>' : C.st === 'ON' ? '<button data-rc="OPS1 VACATE" class="danger">Vacate</button>' : '';
  return `<div class="rcline${C && C.st === 'ON' ? ' on' : ''}${C && C.st === 'READY' ? ' ask' : ''}"><span>${esc(st)}</span>${b}</div>`;
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-rc]'); if (b) { command(b.dataset.rc); renderAtis(); renderStrips(true); } });
