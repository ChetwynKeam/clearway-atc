"use strict";
// ═══════════════════════════════════════════════════════════════════════════════════════
// CALPE · Gibraltar ATC simulator — simulation core
// Sources: UK Mil AIP AD 2 LXGB (AD 2.2–2.14, charts B1, D1, E1, F1, H1, K1, K2). Coast: GSHHG full
// resolution, with the aerodrome shoreline traced from chart D1.
// ═══════════════════════════════════════════════════════════════════════════════════════

// ═════════════════════════ geometry ═════════════════════════
const D2R = Math.PI/180, R2D = 180/Math.PI;
const AIRPORT_ORIGIN = { LXGB: [36.1512, -5.3494], LPMA: [32.6942, -16.7781], EGLC: [51.5053, 0.0553], LOWI: [47.2602, 11.3439], KJFK: [40.639925, -73.778939], EGKK: [51 + 8/60 + 53/3600, -(11/60 + 25/3600)], LEMD: [40 + 28/60 + 20/3600, -(3 + 33/60 + 39/3600)], EGCC: [53 + 21/60 + 13/3600, -(2 + 16/60 + 30/3600)], EGLL: [51 + 28/60 + 39/3600, -(27/60 + 41/3600)], EGGD: [51 + 22/60 + 58/3600, -(2 + 43/60 + 9/3600)], EGAA: [54 + 39/60 + 27/3600, -(6 + 12/60 + 57/3600)], YSSY: [-(33 + 56/60 + 46/3600), 151 + 10/60 + 38/3600], LSGG: [46 + 14/60 + 17/3600, 6 + 6/60 + 33/3600], EIDW: [53 + 25/60 + 17/3600, -(6 + 16/60 + 12/3600)], OMDB: [25 + 15/60 + 10/3600, 55 + 21/60 + 52/3600]};
const [LAT0, LON0] = AIRPORT_ORIGIN[AIRPORT], COSL = Math.cos(LAT0*D2R);
const M2NM = 1/1852;
const dms = (d, m, s=0) => d + m/60 + s/3600;
function xy(lat, lon){ return [(lon-LON0)*60*COSL, (lat-LAT0)*60]; }
const norm = a => ((a%360)+360)%360;
const angDiff = (a,b) => { let d = norm(b-a); return d>180 ? d-360 : d; };
const brg = (x1,y1,x2,y2) => norm(Math.atan2(x2-x1, y2-y1)*R2D);
const dist = (x1,y1,x2,y2) => Math.hypot(x2-x1, y2-y1);
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const rnd = (a,b) => a + Math.random()*(b-a);
const dirv = h => [Math.sin(h*D2R), Math.cos(h*D2R)];
// distance (m) from p to the segment a-b, and (sampled) between two segments
const segDistM = (p, a, b) => { const dx = b[0]-a[0], dy = b[1]-a[1], L = dx*dx + dy*dy || 1e-18, u = Math.max(0, Math.min(1, ((p[0]-a[0])*dx + (p[1]-a[1])*dy)/L)); return dist(...p, a[0] + dx*u, a[1] + dy*u)/M2NM; };
function segSegM(a, b, c, d){ let m = Infinity; for (let k = 0; k <= 12; k++) { const f = k/12; m = Math.min(m, segDistM([a[0] + (b[0]-a[0])*f, a[1] + (b[1]-a[1])*f], c, d), segDistM([c[0] + (d[0]-c[0])*f, c[1] + (d[1]-c[1])*f], a, b)); } return m; }
const add = (p, h, d) => [p[0]+Math.sin(h*D2R)*d, p[1]+Math.cos(h*D2R)*d];

// ═════════════════════════ taxiway graph and procedures (filled in by the airport profile) ═════════════════════════
const GN = {}, GE = [];
function gn(id, m, off){ TAXI_MEMO.clear(); GN[id] = { id, m, off, p: rm(m, off), adj: [] }; }
// an edge's e.k (default 1) weights its length in the route searches: a link only taken when asked for (Manchester's
// crossovers between parallel lines) costs more
function ge(a, b, tw){ TAXI_MEMO.clear(); const e = { a, b, tw, len: dist(...GN[a].p, ...GN[b].p) }; GE.push(e); GN[a].adj.push([b, e]); GN[b].adj.push([a, e]); }
let kN = 0;
// a chain of points becomes graph nodes joined by edges carrying the taxiway designator
// mark the edges added since GE index k with their line on a lane painted with more than one (b blue, o orange, r red,
// c the centre line), or x for a crossover between them: not painted, and costlier to route over, so a route takes it
// when the controller names a line (TAXI .. VIA Z CENTRE) or it saves a long way round
function markLine(k, line){ if (line) for (const e of GE.slice(k)) { if (line === 'x') { e.bare = true; e.k = 4; } else e.line = line; } }
function chain(a, pts, b, tw){ let prev = a; for (const [m, o] of pts) { const id = 'k' + (kN++); gn(id, m, o); ge(prev, id, tw); prev = id; } ge(prev, b, tw); }
const filIn = (hp, side) => FIL[hp][side].map(([m, o]) => holdRwy(hp).rm(m, o));   // in the frame of the hold's runway
const filOut = (hp, side) => filIn(hp, side).reverse();
// a binary min-heap of [cost, ...] entries for the route searches (Gatwick's taxiway graph has thousands of nodes)
function heapPush(h, it){ let i = h.length; h.push(it); while (i) { const p = (i - 1) >> 1; if (h[p][0] <= it[0]) break; h[i] = h[p]; i = p; } h[i] = it; }
function heapPop(h){
  const top = h[0], last = h.pop(), n = h.length; if (!n) return top;
  let i = 0; while (true) { let c = 2*i + 1; if (c >= n) break; if (c + 1 < n && h[c+1][0] < h[c][0]) c++; if (h[c][0] >= last[0]) break; h[i] = h[c]; i = c; }
  h[i] = last; return top;
}
// shortest routes without a penalty, remembered until the graph changes (the push and taxi boxes ask for the same ones
// every half second)
const TAXI_MEMO = new Map();
// the ground flow plan (gflow.js): the way traffic uses each taxiway for the runways in use. Going against a one-way flow
// costs four times as much, so routes keep to the flow unless the other way is much shorter
let GFLOW_DIR = null;
const gfK = (e, u) => { if (!GFLOW_DIR) return 1; const d = GFLOW_DIR.get(e); return d && ((d > 0) !== (e.a === u)) ? 4 : 1; };
// pen (optional): a cost multiplier per edge, to find alternative routings at big airports
// face (optional): the way the aircraft at `from` is pointing. An aircraft can't turn round on a taxiway, so the route
// then starts within 100 degrees of that heading and never doubles back on itself at a node further on
// outB (optional, with face): the way it must be able to turn on leaving `to` (onto a stand's lead-in)
function route(from, to, pen, face, outB){
  if (typeof refreshShut === 'function') refreshShut();
  if (face != null) return routeFacing(from, to, pen, face, outB);
  const ck = pen ? null : from + '>' + to;
  if (ck && TAXI_MEMO.has(ck)) { const r = TAXI_MEMO.get(ck); return r && { nodes: r.nodes.slice(), tws: r.tws.slice() }; }
  const dd = new Map([[from, 0]]), prev = new Map(), done = new Set(), h = [[0, from]];
  let found = false;
  while (h.length) {
    const [d, u] = heapPop(h); if (done.has(u)) continue;
    if (u === to) { found = true; break; } done.add(u);
    for (const [v, e] of GN[u].adj) { if (e.closed || (v !== to && v[0] === 'R')) continue; const nd = d + e.len*(e.k || 1)*(pen ? pen(e) : 1)*gfK(e, u), o = dd.get(v); if (o === undefined || nd < o) { dd.set(v, nd); prev.set(v, [u, e]); heapPush(h, [nd, v]); } }
  }
  let r = null;
  if (found) { const nodes = [to], tws = []; let c = to; while (c !== from) { const [u, e] = prev.get(c); nodes.unshift(u); tws.unshift(e.tw); c = u; } r = { nodes, tws }; }
  if (ck) TAXI_MEMO.set(ck, r && { nodes: r.nodes.slice(), tws: r.tws.slice() });
  return r;
}
// the sharpest turn a route takes at a junction: a junction's fillets are built for the turns it is meant for, so an
// aircraft never turns back through more than this (the wrong way round a fillet); it goes round another way instead
const TURN_START = 100, TURN_MAX = 115;
// a leg's bearing; a zero-length leg (two nodes on the same spot, where generated graphs join) keeps the heading
const legBrg = (u, v, inB) => dist(...GN[u].p, ...GN[v].p) < 0.3/1852 ? inB : brg(...GN[u].p, ...GN[v].p);
// the ways on from node u: a zero-length edge (two nodes on one spot) is looked through to the edges beyond it
function waysOn(u){ const out = []; for (const [v, e] of GN[u].adj) { if (e.len < 0.3/1852) { for (const [w, f] of GN[v].adj) if (w !== u) out.push([w, f]); } else out.push([v, e]); } return out; }
// no hairpins: within HAIR_WIN of route (two junction fillets back to back, a lap round a junction's circle) the heading
// never swings round by more than HAIR_MAX, whatever the single turns. A state carries the bearings of the legs that
// started within HAIR_WIN of its node ([bearing, distance back to the leg's start]), the aircraft's own heading first
const HAIR_WIN = 65/1852, HAIR_MAX = 150;
const hairOk = (hist, b) => hist.every(([hb]) => Math.abs(angDiff(hb, b)) <= HAIR_MAX);
function histOn(hist, b, len){ if (len < 0.5/1852) return hist; const out = [[b, len]]; for (const [hb, d] of hist) if (d + len < HAIR_WIN) out.push([hb, d + len]); return out; }
// a line that doubles back on itself, by the same rule
function doublesBack(pts){ let hist = []; for (let i = 1; i < pts.length; i++) { const len = dist(...pts[i-1], ...pts[i]); if (len < 0.5/1852) continue;
  const b = brg(...pts[i-1], ...pts[i]); if (!hairOk(hist, b)) return true; hist = histOn(hist, b, len); } return false; }
// one step of a facing search from state k at node u: the legs on that keep within the turn limits
function facingSteps(k, u, from_, inB, hist, d, pen, ok, push){
  for (const [v, e] of GN[u].adj) {
    if (e.closed || !ok(v)) continue;
    const b = legBrg(u, v, inB);
    if (Math.abs(angDiff(inB, b)) > (from_ ? TURN_MAX : TURN_START) || !hairOk(hist, b)) continue;
    // keyed by the node before u too, so a junction reached two ways keeps both pasts (they turn on differently), and by
    // how far the heading has swung within the hairpin window (in 30° steps): a cheaper way in that has swung further
    // must not shut out a dearer one that can still turn on (the search would miss routes that exist)
    const nh = histOn(hist, b, e.len); let sw = 0; for (const [hb] of nh) sw = Math.max(sw, Math.abs(angDiff(hb, b)));
    push(v + '|' + u + '|' + from_ + '|' + Math.floor(sw/30), [v, u, b, nh], d + e.len*(e.k || 1)*(pen ? pen(e) : 1)*gfK(e, u), k, e);
  }
}
function routeFacing(from, to, pen, face, outB){
  if (typeof refreshShut === 'function') refreshShut();
  const ck = pen ? null : from + '>' + to + '>' + face.toFixed(1) + '>' + (outB == null ? '' : outB.toFixed(1));
  if (ck && TAXI_MEMO.has(ck)) { const r = TAXI_MEMO.get(ck); return r && { nodes: r.nodes.slice(), tws: r.tws.slice() }; }
  // states are (node, the node it came from, the one before that); the seed comes from nowhere, pointing `face`
  const k0 = from + '|', dd = new Map([[k0, 0]]), st = new Map([[k0, [from, '', face, [[face, 0]]]]]), prev = new Map(), done = new Set(), h = [[0, k0]];
  const ok = v => v === to || v[0] !== 'R';
  const push = (nk, s, nd, k, e) => { const o = dd.get(nk); if (o === undefined || nd < o) { dd.set(nk, nd); st.set(nk, s); prev.set(nk, [k, e]); heapPush(h, [nd, nk]); } };
  let end = null;
  while (h.length) {
    const [d, k] = heapPop(h); if (done.has(k)) continue; done.add(k);
    const [u, from_, inB, hist] = st.get(k);
    if (u === to && (outB == null || (Math.abs(angDiff(inB, outB)) <= TURN_MAX && hairOk(hist, outB)))) { end = k; break; }
    facingSteps(k, u, from_, inB, hist, d, pen, ok, push);
  }
  let r = null;
  if (end) { const nodes = [], tws = []; let c = end;
    while (c) { nodes.unshift(st.get(c)[0]); const pv = prev.get(c); if (!pv) break; tws.unshift(pv[1].tw); c = pv[0]; }
    r = { nodes, tws }; }
  if (ck) TAXI_MEMO.set(ck, r && { nodes: r.nodes.slice(), tws: r.tws.slice() });
  return r;
}
// whether an aircraft at node `from` pointing `face` can taxi on and out (not boxed in at the end of a taxilane): a facing
// search, under the same turn rules, that stops as soon as it has come round to head back the other way or got 1,500 m
// on. A dead end runs out of states first. Cheap where the way is open, which is nearly everywhere
const HEADS_OUT = new Map();
function headsOut(from, face){
  if (typeof refreshShut === 'function') refreshShut();
  const ck = from + '>' + face.toFixed(0) + '>' + GE.filter(e => e.closed).length; if (HEADS_OUT.has(ck)) return HEADS_OUT.get(ck);
  const k0 = from + '|', dd = new Map([[k0, 0]]), st = new Map([[k0, [from, '', face, [[face, 0]]]]]), done = new Set(), h = [[0, k0]];
  const push = (nk, s, nd) => { const o = dd.get(nk); if (o === undefined || nd < o) { dd.set(nk, nd); st.set(nk, s); heapPush(h, [nd, nk]); } };
  let out = false;
  while (h.length && !out) {
    const [d, k] = heapPop(h); if (done.has(k)) continue; done.add(k);
    const [u, from_, inB, hist] = st.get(k);
    if (d > 1500/1852 || Math.abs(angDiff(inB, face)) > 150 || done.size > 4000) { out = true; break; }
    if (u !== from && u[0] === 'R') continue;
    facingSteps(k, u, from_, inB, hist, d, null, () => true, push);
  }
  HEADS_OUT.set(ck, out); return out;
}
// shortest routes from one node to many (the holding-point lists): one search instead of one per target, with the same
// rules and memo entries as route() without a penalty. Returns a Map of target → { nodes, tws } or null.
function routesFrom(from, targets, face){
  if (typeof refreshShut === 'function') refreshShut();
  const out = new Map(), want = new Set(), facing = face != null;
  const ck = t => facing ? from + '>' + t + '>' + face.toFixed(1) + '>' : from + '>' + t;
  for (const t of targets) { if (t === from || out.has(t)) continue; const k = ck(t);
    if (TAXI_MEMO.has(k)) { const r = TAXI_MEMO.get(k); out.set(t, r && { nodes: r.nodes.slice(), tws: r.tws.slice() }); } else want.add(t); }
  if (!want.size) return out;
  const k0 = facing ? from + '|' : from, dd = new Map([[k0, 0]]), st = new Map([[k0, [from, '', face, [[face, 0]]]]]), prev = new Map(), done = new Set(), h = [[0, k0]];
  const ok = v => v[0] !== 'R' || want.has(v);
  const push = (nk, s, nd, k, e) => { const o = dd.get(nk); if (o === undefined || nd < o) { dd.set(nk, nd); st.set(nk, s); prev.set(nk, [k, e]); heapPush(h, [nd, nk]); } };
  let left = want.size;
  while (h.length && left) {
    const [d, k] = heapPop(h); if (done.has(k)) continue; done.add(k);
    const [u, from_, inB, hist] = st.get(k);
    if (want.has(u) && !out.has(u)) {
      const nodes = [], tws = []; let c = k;
      while (c) { nodes.unshift(st.get(c)[0]); const pv = prev.get(c); if (!pv) break; tws.unshift(pv[1].tw); c = pv[0]; }
      out.set(u, { nodes, tws }); TAXI_MEMO.set(ck(u), { nodes: nodes.slice(), tws: tws.slice() }); left--;
    }
    if (u !== from && u[0] === 'R') continue;          // a runway-edge node is only ever an end point
    if (facing) { facingSteps(k, u, from_, inB, hist, d, null, ok, push); continue; }
    for (const [v, e] of GN[u].adj) if (!e.closed && ok(v)) push(v, [v, u, inB], d + e.len*(e.k || 1), k, e);
  }
  for (const t of want) if (!out.has(t)) { out.set(t, null); TAXI_MEMO.set(ck(t), null); }
  return out;
}
// a new graph node on taxiway tw at the point nearest p, splitting the edge it falls on (intermediate holding points)
function splitAt(id, p, tw){
  let best = null;
  for (const e of GE) { if (e.tw !== tw) continue; const a = GN[e.a].p, b = GN[e.b].p, dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx*dx + dy*dy || 1e-12;
    const f = Math.max(0, Math.min(1, ((p[0] - a[0])*dx + (p[1] - a[1])*dy)/L2)), q = [a[0] + dx*f, a[1] + dy*f], d = dist(...p, ...q);
    if (!best || d < best.d) best = { e, f, q, d }; }
  if (!best) return null;
  const { e, f, q } = best;
  if (f < 0.02) return e.a; if (f > 0.98) return e.b;
  TAXI_MEMO.clear(); GN[id] = { id, m: typeof mOf === 'function' ? mOf(q) : 0, off: typeof offOf === 'function' ? offOf(q) : 0, p: q, adj: [] };
  GE.splice(GE.indexOf(e), 1);
  GN[e.a].adj = GN[e.a].adj.filter(([v, x]) => x !== e); GN[e.b].adj = GN[e.b].adj.filter(([v, x]) => x !== e);
  ge(e.a, id, tw); ge(id, e.b, tw);
  return id;
}
// ── junction fillets: where a taxiway meets another at a T, the paint has a lead-on curve each way, but a generated graph
// often has only the straight centreline into the junction node. A turn there sharper than the turn limit can't be
// taken, so an aircraft can't turn that way at all (it goes round, or turns about on the taxiway). This lays a curved
// fillet of the graph along each such turn, from a point back up the branch to a point along the through line, as
// painted. opts: R (turn radius, m), skip(node id) to leave a junction alone. Returns the number of fillets added.
function tFillets(opts = {}){
  const R = opts.R || 30, M = 1/1852, skip = opts.skip || (() => false);
  const fixed = new Set(Object.values(HOLDS).map(h => h.node)); for (const s of (typeof STANDS !== 'undefined' ? STANDS : [])) fixed.add(s.node);
  const isR = id => id[0] === 'R' || /^CR\d|^XR$|^XH$/.test(id);
  // the point d (nm) along the chain from n through v (through degree-2 nodes of the same taxiway), and the edge it is on
  const along = (n, v, d) => { let u = n, w = v, acc = 0;
    for (let g = 0; g < 40; g++) { const e = GN[u].adj.find(([x]) => x === w)[1], L = e.len;
      if (acc + L >= d) { const f = (d - acc)/L, a = GN[u].p, b = GN[w].p; return { e, u, w, q: [a[0] + (b[0]-a[0])*f, a[1] + (b[1]-a[1])*f], f }; }
      acc += L; const nx = GN[w].adj.filter(([x, f]) => x !== u && !f.bare);
      if (nx.length !== 1 || nx[0][1].tw !== e.tw || isR(nx[0][0]) || fixed.has(w)) return null; u = w; w = nx[0][0]; }
    return null; };
  const lenOn = (n, v) => { let u = n, w = v, acc = 0; for (let g = 0; g < 40; g++) { const e = GN[u].adj.find(([x]) => x === w)[1]; acc += e.len;
    const nx = GN[w].adj.filter(([x, f]) => x !== u && !f.bare); if (nx.length !== 1 || nx[0][1].tw !== e.tw || isR(nx[0][0]) || fixed.has(w)) return acc; u = w; w = nx[0][0]; } return acc; };
  const dirOn = (n, v) => { const a = along(n, v, Math.min(15*M, lenOn(n, v)*0.9)); const q = a ? a.q : GN[v].p; return brg(...GN[n].p, ...q); };
  const cut = (hit, id) => { const { e, q, f } = hit; if (f < 0.03) return hit.u; if (f > 0.97) return hit.w;
    TAXI_MEMO.clear(); GN[id] = { id, m: typeof mOf === 'function' ? mOf(q) : 0, off: typeof offOf === 'function' ? offOf(q) : 0, p: q, adj: [] };
    GE.splice(GE.indexOf(e), 1); GN[e.a].adj = GN[e.a].adj.filter(([, x]) => x !== e); GN[e.b].adj = GN[e.b].adj.filter(([, x]) => x !== e);
    for (const [x, y] of [[e.a, id], [id, e.b]]) { ge(x, y, e.tw); const ne = GE[GE.length - 1]; for (const k of ['line', 'k', 'gf']) if (e[k] != null) ne[k] = e[k]; }
    return id; };
  let n0 = 0; const jobs = [];
  for (const id of Object.keys(GN)) {
    if (isR(id) || fixed.has(id) || skip(id)) continue;
    const ws = GN[id].adj.filter(([v, e]) => !e.bare && e.len > 0.3*M && !isR(v));
    if (ws.length !== 3 || GN[id].adj.some(([v]) => isR(v))) continue;
    const b = ws.map(([v]) => dirOn(id, v));
    let best = null; for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) { const st = Math.abs(angDiff(b[i], b[j] + 180)); if (st < 35 && (!best || st < best.st)) best = { i, j, st }; }
    if (!best) continue;
    const k = 3 - best.i - best.j, inB = norm(b[k] + 180);
    for (const t of [best.i, best.j]) { const turn = Math.abs(angDiff(inB, b[t]));
      if (turn > (opts.minTurn || TURN_MAX - 10) && turn < (opts.maxTurn || 172)) jobs.push({ id, bb: b[k], bt: b[t], turn, tw: ws[k][1].tw }); } }
  // earlier fillets split this junction's edges: find the neighbours again by their bearing
  const nbAt = (id, bg) => { let r = null, bd = 25; for (const [v, e] of GN[id].adj) { if (e.bare || e.fil || isR(v)) continue; const a = Math.abs(angDiff(dirOn(id, v), bg)); if (a < bd) { bd = a; r = v; } } return r; };
  for (const { id, bb, bt, turn, tw } of jobs) {
    const br = nbAt(id, bb), th = nbAt(id, bt); if (!br || !th) continue;
    const d = Math.min(R*Math.tan(Math.min(turn, 140)/2*D2R), 45)*M, Lb = lenOn(id, br), Lt = lenOn(id, th), dd = Math.min(d, Lb*0.8, Lt*0.8);
    if (dd < 8*M) continue;
    const A = along(id, br, dd), B = along(id, th, dd); if (!A || !B) continue;
    // the curve leaves each line along it (a quadratic's ends point at the junction): where the line itself bends
    // between the junction and the fillet's end (a branch that already curves in), the fillet would cusp, so not here
    const legB = h => brg(...GN[h.w].p, ...GN[h.u].p), toJ = q => brg(...q, ...GN[id].p);
    if (Math.abs(angDiff(legB(A), toJ(A.q))) > 60 || Math.abs(angDiff(legB(B), toJ(B.q))) > 60 || Math.abs(angDiff(toJ(A.q), brg(...GN[id].p, ...B.q))) > 150) continue;
    const na = cut(A, 'fa' + n0), nb = cut(along(id, th, dd), 'fb' + n0);
    const P0 = GN[na].p, P1 = GN[id].p, P2 = GN[nb].p; let prev = na;
    for (let s = 1; s < 8; s++) { const u = s/8, w = 1 - u, q = [w*w*P0[0] + 2*w*u*P1[0] + u*u*P2[0], w*w*P0[1] + 2*w*u*P1[1] + u*u*P2[1]], fid = 'fc' + n0 + '_' + s;
      TAXI_MEMO.clear(); GN[fid] = { id: fid, m: typeof mOf === 'function' ? mOf(q) : 0, off: typeof offOf === 'function' ? offOf(q) : 0, p: q, adj: [] };
      ge(prev, fid, tw); GE[GE.length - 1].fil = true; prev = fid; }
    ge(prev, nb, tw); GE[GE.length - 1].fil = true; n0++; }
  return n0;
}
// ── kinks: a node joining just two legs at a turn sharper than the turn limit (a generated graph joining a branch to the
// wrong side of another taxiway's curve) can't be passed either way, so the two taxiways aren't joined at all. This adds
// a short link that cuts the corner: from a point back along one leg to a point along the other, where both turns on and
// off it stay gentle. Returns the number of links added.
function kinkLinks(opts = {}){
  const M = 1/1852, maxT = opts.maxTurn || 100, isR = id => id[0] === 'R';
  const chainPts = (x, v, maxD) => { const out = []; let u = x, w = v, acc = 0;   // nodes along the leg from x through v, with the node before each
    for (let g = 0; g < 30; g++) { const e = GN[u].adj.find(([y]) => y === w); if (!e) break; acc += e[1].len; out.push({ id: w, prev: u, d: acc, tw: e[1].tw });
      if (acc > maxD) break; const nx = GN[w].adj.filter(([y, f]) => y !== u && !f.bare && !isR(y)); if (nx.length !== 1) break; u = w; w = nx[0][0]; }
    return out; };
  let n = 0;
  for (const x of Object.keys(GN)) {
    if (isR(x)) continue; const ws = GN[x].adj.filter(([v, e]) => !e.bare && e.len > 0.3*M);
    if (ws.length !== 2 || ws.some(([v]) => isR(v))) continue;
    const [[u], [w]] = ws, t = Math.abs(angDiff(brg(...GN[u].p, ...GN[x].p), brg(...GN[x].p, ...GN[w].p)));
    if (t <= TURN_MAX) continue;
    // for each way round, the best corner cut: y on one leg (approached from beyond it), z on the other (left onwards)
    let best = null;
    for (const [a, b] of [[u, w], [w, u]]) {
      for (const Y of chainPts(x, a, 70*M)) for (const Z of chainPts(x, b, 50*M)) {
        if (Y.d < 6*M || Z.d < 6*M) continue;
        const yn = GN[Y.id].adj.map(([q]) => q).filter(q => q !== Y.prev && !isR(q)), zn = GN[Z.id].adj.map(([q]) => q).filter(q => q !== Z.prev && !isR(q));
        if (!yn.length || !zn.length) continue;
        const inB = brg(...GN[yn[0]].p, ...GN[Y.id].p), lb = brg(...GN[Y.id].p, ...GN[Z.id].p), outB = brg(...GN[Z.id].p, ...GN[zn[0]].p);
        const worst = Math.max(Math.abs(angDiff(inB, lb)), Math.abs(angDiff(lb, outB)));
        if (worst <= maxT && (!best || worst + (Y.d + Z.d)/M/10 < best.k)) best = { y: Y.id, z: Z.id, tw: Z.tw, k: worst + (Y.d + Z.d)/M/10 };
      }
    }
    if (!best || GN[best.y].adj.some(([q]) => q === best.z)) continue;
    ge(best.y, best.z, best.tw); GE[GE.length - 1].fil = true; n++;
  }
  return n;
}
// ── stands mapped at the nose: an OpenStreetMap parking position (or a stand line) ends where the nose stops, but a stand's
// point is the aircraft's middle. Each stand moves back along its line by the stop-bar distance of the largest aircraft
// it takes (judged from the room to the stands beside it), never closer than 15 m to its lead-in point. Sets t.lat (the
// room beside it, m) and t.maxSpan if not set. As at Heathrow, Madrid and Manchester. opts.same(a, b): halves of one stand.
function standsNoseToMiddle(opts = {}){
  const same = opts.same || (() => false), at = new Map();
  for (const t of STANDS) {
    if (t.area === 'remote' && t.noLead) continue;
    const u = dirv(t.hdg); let lat = Infinity, near = Infinity;
    for (const o of STANDS) { if (o === t || same(o, t)) continue;
      const dx = (o.p[0] - t.p[0])*1852, dy = (o.p[1] - t.p[1])*1852, al = dx*u[0] + dy*u[1], la = Math.abs(dx*u[1] - dy*u[0]);
      if (Math.abs(al) < 30 && la > 10) lat = Math.min(lat, la);
      if (la > 10 || Math.abs(al) > 10) near = Math.min(near, Math.hypot(dx, dy)); }
    const w = clamp(Math.min(isFinite(lat) ? lat : 45, near*1.1) - 1, 30, 82), sb = clamp(w + 6, 24, 80)*0.56 - 4;
    t.lat = isFinite(lat) ? lat : 90; if (t.maxSpan == null) t.maxSpan = Math.round(clamp(2*t.lat - 42, 30, 82));
    at.set(t, add(t.p, t.hdg + 180, Math.min(sb, Math.max(0, dist(...t.lp, ...t.p)*1852 - 15))/1852));
  }
  for (const [t, p] of at) { t.p = p; if (typeof mOf === 'function') { t.m = mOf(p); t.off = offOf(p); } }
}
// a stand whose aircraft would sit across a taxiway (nose or wings within 12 m of a lane) slides along its line to the
// nearest spot at least 14 m clear
function standsClearLanes(){
  const body = (c, h) => [add(c, h, 19/1852), add(c, h + 180, 19/1852), add(c, h - 90, 18/1852), add(c, h + 90, 18/1852)];
  let n = 0;
  for (const t of STANDS) {
    const u = t.hdg, lanes = GE.filter(e => !e.bare && e.tw !== 'APRON' && dist(...GN[e.a].p, ...GN[e.b].p) > 1e-7 && segDistM(t.p, GN[e.a].p, GN[e.b].p) < 150);
    const clr = c => { const [nz, tl, wl, wr] = body(c, u); let m = Infinity; for (const e of lanes) { const a = GN[e.a].p, b = GN[e.b].p; m = Math.min(m, segSegM(nz, tl, a, b), segSegM(wl, wr, a, b)); } return m; };
    if (clr(t.p) >= 12) continue;
    const r0 = dist(...t.lp, ...t.p)*1852; let best = null;
    for (let r = 22; r <= 95; r++) { const c = add(t.lp, u, r/1852), k = clr(c), sc = k >= 14 ? 1000 - Math.abs(r - r0) : k; if (!best || sc > best.sc) best = { sc, c }; }
    t.p = best.c; if (typeof mOf === 'function') { t.m = mOf(t.p); t.off = offOf(t.p); } n++;
  }
  return n;
}
// ── gaps: a lane that ends within a few metres of another lane it isn't joined to (two surveyed lines that stop just
// short of each other) is joined to the nearest point on it. Returns the number joined.
function joinGaps(maxM = 8){
  const isR = id => id[0] === 'R', M = 1/1852, fixed = new Set(Object.values(HOLDS).map(h => h.node)); for (const t of STANDS) fixed.add(t.node);
  const near = (a, b) => { const seen = new Set([a]); let fr = [a]; for (let k = 0; k < 6; k++) { const nx = []; for (const u of fr) for (const [v] of GN[u].adj) if (!seen.has(v)) { if (v === b) return true; seen.add(v); nx.push(v); } fr = nx; } return false; };
  let n = 0;
  for (const id of Object.keys(GN)) {
    if (isR(id) || fixed.has(id) || GN[id].adj.length !== 1) continue;
    const p = GN[id].p; let best = null;
    for (const e of GE) { if (e.a === id || e.b === id || isR(e.a) || isR(e.b) || e.bare) continue;
      const d = segDistM(p, GN[e.a].p, GN[e.b].p); if (d < maxM && (!best || d < best.d) && !near(id, e.a) && !near(id, e.b)) best = { e, d }; }
    if (!best) continue;
    const { e } = best, a = GN[e.a].p, b = GN[e.b].p, dx = b[0]-a[0], dy = b[1]-a[1], f = clamp(((p[0]-a[0])*dx + (p[1]-a[1])*dy)/(dx*dx + dy*dy || 1e-12), 0, 1);
    let to = f < 0.05 ? e.a : f > 0.95 ? e.b : null;
    if (!to) { to = 'jg' + n; const q = [a[0] + dx*f, a[1] + dy*f]; TAXI_MEMO.clear();
      GN[to] = { id: to, m: typeof mOf === 'function' ? mOf(q) : 0, off: typeof offOf === 'function' ? offOf(q) : 0, p: q, adj: [] };
      GE.splice(GE.indexOf(e), 1); GN[e.a].adj = GN[e.a].adj.filter(([, x]) => x !== e); GN[e.b].adj = GN[e.b].adj.filter(([, x]) => x !== e);
      for (const [x, y] of [[e.a, to], [to, e.b]]) { ge(x, y, e.tw); const ne = GE[GE.length - 1]; for (const k of ['line', 'k', 'gf']) if (e[k] != null) ne[k] = e[k]; } }
    ge(id, to, GN[id].adj[0][1].tw); n++;
  }
  return n;
}
function viaOf(tws, hp){ const ref = HOLDS[hp] && HOLDS[hp].ref, base = HOLDS[hp] && HOLDS[hp].base, v = []; for (const t of tws) if (t !== 'APRON' && t !== hp && t !== ref && v[v.length-1] !== t) v.push(t); if (base && v[v.length-1] === base) v.pop(); return v; }
function nearestNode(p, filter){ let best = null, bd = Infinity; for (const n of Object.values(GN)) { if (filter && !filter(n)) continue; const d = dist(...p, ...n.p); if (d < bd) { bd = d; best = n; } } return best; }

function inPoly(p, poly){ let c=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){ const [xi,yi]=poly[i],[xj,yj]=poly[j]; if(((yi>p[1])!==(yj>p[1])) && (p[0] < (xj-xi)*(p[1]-yi)/(yj-yi)+xi)) c=!c; } return c; }
const WP = {};
function wp(id, lat, lon, opts={}){ WP[id] = { id, p: xy(lat,lon), ...opts }; }

// ═════════════════════════ aircraft performance ═════════════════════════
const TYPES = {
  A20N: { name:'A320neo',       wake:'M', vapp:136, vr:145, climb:2400, desc:2000, cruise:290, span:35.8, len:37.6, shape:'jet' },
  A320: { name:'A320',          wake:'M', vapp:138, vr:148, climb:2200, desc:2000, cruise:290, span:34.1, len:37.6, shape:'jet' },
  A319: { name:'A319',          wake:'M', vapp:132, vr:140, climb:2500, desc:2000, cruise:290, span:34.1, len:33.8, shape:'jet' },
  A21N: { name:'A321neo',       wake:'M', vapp:142, vr:155, climb:2100, desc:2000, cruise:290, span:35.8, len:44.5, shape:'jet' },
  B738: { name:'737-800',       wake:'M', vapp:145, vr:152, climb:2200, desc:2100, cruise:290, span:35.8, len:39.5, shape:'jet' },
  AT76: { name:'ATR 72-600',    wake:'M', vapp:110, vr:110, climb:1300, desc:1500, cruise:240, span:27.1, len:27.2, shape:'prop' },
  A332: { name:'A330 Voyager',  wake:'H', vapp:140, vr:155, climb:1900, desc:2000, cruise:300, span:60.3, len:58.8, shape:'jet' },
  A400: { name:'A400M Atlas',   wake:'H', vapp:115, vr:110, climb:1800, desc:1800, cruise:280, span:42.4, len:45.1, shape:'prop' },
  C56X: { name:'Citation XLS',  wake:'L', vapp:115, vr:110, climb:2800, desc:2200, cruise:260, span:17.2, len:15.8, shape:'biz' },
  GLF6: { name:'Gulfstream G650', wake:'M', vapp:125, vr:130, climb:3000, desc:2200, cruise:300, span:30.4, len:30.4, shape:'biz' },
  PC12: { name:'Pilatus PC-12', wake:'L', vapp:90,  vr:85,  climb:1500, desc:1200, cruise:220, span:16.3, len:14.4, shape:'prop' }
};
const DIG = ['zero','one','two','three','four','five','six','seven','eight','niner'];
function spoken(cs){ const p = cs.slice(0,3); if (TEL[p]) return TEL[p]+' '+cs.slice(3).split('').map(c => /\d/.test(c) ? DIG[c] : c).join(' '); return cs.split('').join(' '); }

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const hm = t => +t.slice(0,2)*60 + +t.slice(3);
// published altitudes at the arrival fixes of a set of procedures ({ pts: [[fix, alt], ...] }; the first to name a fix
// wins). Profiles pass them as APT.arrAlt: cleared arrivals descend with them (viaAlt in sim.js)
function arrAltOf(procs){ const m = {}; for (const P of procs) for (const [id, a] of P.pts) if (a && m[id] == null) m[id] = a; return m; }

// the airport's offset from UTC (hours) at a moment: its time zone's rule (summer time and back), else the profile's fixed one
function tzOffH(ms){
  if (!APT.tz || typeof Intl === 'undefined') return APT.utcOff;
  try { const p = new Intl.DateTimeFormat('en-GB', { timeZone: APT.tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' }).formatToParts(new Date(ms)), g = t => +p.find(x => x.type === t).value;
    return Math.round((Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute')) - Math.floor(ms/60000)*60000)/60000)/60; } catch (e) { return APT.utcOff; }
}
const simMs = () => (typeof S !== 'undefined' && S.start ? S.start + (S.t || 0)*1000 : Date.now());
