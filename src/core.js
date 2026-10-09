"use strict";
// ═══════════════════════════════════════════════════════════════════════════════════════
// CALPE · Gibraltar ATC simulator — simulation core
// Sources: UK Mil AIP AD 2 LXGB (AD 2.2–2.14, charts B1, D1, E1, F1, H1, K1, K2). Coast: GSHHG full
// resolution, with the aerodrome shoreline traced from chart D1.
// ═══════════════════════════════════════════════════════════════════════════════════════

// ═════════════════════════ geometry ═════════════════════════
const D2R = Math.PI/180, R2D = 180/Math.PI;
const AIRPORT_ORIGIN = { LXGB: [36.1512, -5.3494], LPMA: [32.6942, -16.7781], EGLC: [51.5053, 0.0553], LOWI: [47.2602, 11.3439], KJFK: [40.639925, -73.778939], EGKK: [51 + 8/60 + 53/3600, -(11/60 + 25/3600)], LEMD: [40 + 28/60 + 20/3600, -(3 + 33/60 + 39/3600)], EGCC: [53 + 21/60 + 13/3600, -(2 + 16/60 + 30/3600)] };
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
    for (const [v, e] of GN[u].adj) { if (e.closed || (v !== to && v[0] === 'R')) continue; const nd = d + e.len*(e.k || 1)*(pen ? pen(e) : 1), o = dd.get(v); if (o === undefined || nd < o) { dd.set(v, nd); prev.set(v, [u, e]); heapPush(h, [nd, v]); } }
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
const HAIR_WIN = 80/1852, HAIR_MAX = 150;
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
    // keyed by the node before u too, so a junction reached two ways keeps both pasts (they turn on differently)
    push(v + '|' + u + '|' + from_, [v, u, b, histOn(hist, b, e.len)], d + e.len*(e.k || 1)*(pen ? pen(e) : 1), k, e);
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
function viaOf(tws, hp){ const ref = HOLDS[hp] && HOLDS[hp].ref, v = []; for (const t of tws) if (t !== 'APRON' && t !== hp && t !== ref && v[v.length-1] !== t) v.push(t); return v; }
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
