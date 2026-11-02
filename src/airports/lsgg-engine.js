// ═════════════════════════ Geneva (LSGG) airport profile for the engine ═════════════════════════
// Builds every global the engine reads from the chart data in lsgg.js (LSGG) and the OpenStreetMap aerodrome in
// lsgg-ground.js (metres east and north of the ARP). Geneva has one runway, 04/22, used for arrivals and departures alike,
// described like Bristol's (one frame, holding points with their runway-edge nodes and mapped fillets). The terminal and the
// apron lie on the south-east side; the north apron (business aviation) on the north-west side, reached by crossing the runway.
// The stands round the three round satellites are taxi-in/taxi-out (st.out, no push back); their passengers ride apron buses.
Object.assign(TYPES, LSGG.TYPES);
const LL = p => xy(p[0], p[1]);
const G = LSGG_GROUND;
const EN = (e, n) => [e*M2NM, n*M2NM];                     // metres east and north of the ARP (the map origin) → NM

// ═════════════════════════ runway ═════════════════════════
// a frame along the runway: m from the west pavement end (09 end), off to the left (north)
function rwyFrame(r){
  const a = EN(...r.a), b = EN(...r.b), L = dist(...a, ...b), RU = [(b[0]-a[0])/L, (b[1]-a[1])/L], RN = [-RU[1], RU[0]];
  const rm = (m, off=0) => [a[0] + (RU[0]*m + RN[0]*off)*M2NM, a[1] + (RU[1]*m + RN[1]*off)*M2NM];
  const mOf = p => ((p[0]-a[0])*RU[0] + (p[1]-a[1])*RU[1])/M2NM, offOf = p => ((p[0]-a[0])*RN[0] + (p[1]-a[1])*RN[1])/M2NM;
  const len = r.len;
  // no turning pads: departures enter at the runway ends (Golf for 04, on the pavement before the displaced threshold; Alfa for 22) and line up straight
  const TURN_W = [[30, 0]], TURN_E = [[len - 30, 0]];
  return { id: r.id, lo: r.lo, hi: r.hi, len, thr: r.thr, elev: r.elev, rm, mOf, offOf, RU, TURN_W, TURN_E, TURN_END: { W: 30, E: len - 30 },
    roll: [70, len - 70], ends: true, width: 60 };
}
const RWY_LIST = [rwyFrame(G.runways[0])];
const R0 = RWY_LIST[0];
const rm = R0.rm, mOf = R0.mOf, offOf = R0.offOf, RU = R0.RU;
const RWY_M = R0.len, THR_LO_M = R0.thr['04'], THR_HI_M = R0.thr['22'];
const RW_LO = '04', RW_HI = '22';
const THR = { '04': rm(THR_LO_M, 0), '22': rm(THR_HI_M, 0) };
const CRS = { '04': brg(...rm(0), ...rm(RWY_M)) }; CRS['22'] = norm(CRS['04'] + 180);
const THR_ELEV = { ...R0.elev };
const T_LO = THR[RW_LO], T_HI = THR[RW_HI], CRS_LO = CRS[RW_LO], CRS_HI = CRS[RW_HI];
const crsOf = rw => CRS[rw] ?? CRS_HI;
const ELEV = LSGG.elev;
const ARP = LL(LSGG.arp);
// no road crossing, no border fence, no rock
const XING_M = -1e9, XING_SKEW = 0, XING_HW = 0, xingM = o => XING_M;
const FRONTIER = [], R164 = [], ROCK = [], ROCK_TOP = [0, 0];
const TURN_W = R0.TURN_W, TURN_E = R0.TURN_E, TURN_END = R0.TURN_END, TURN_PAD = {};

// ═════════════════════════ taxiways, holding points, stands (eggd-ground.js) ═════════════════════════
const inF0 = (e, n) => { const p = EN(e, n); return [mOf(p), offOf(p)]; };
for (const [id, e, n] of G.nodes) gn(id, ...inF0(e, n));
for (const [id, e, n] of G.rnodes) gn(id, ...inF0(e, n));
for (const [a, b, tw, mid] of G.edges) chain(a, mid.map(([e, n]) => inF0(e, n)), b, tw);
const HOLDS = {}, FIL = {};
for (const [k, [node, rwy, on, m, off, dirs, end, tw]] of Object.entries(G.holds)) {
  HOLDS[k] = { node, rwy, on, m, off, dirs: dirs.split(','), end: end || null, ref: k.replace(/~\d+$/, ''), tw };
  chain(rwy, G.hlink[k] || [], node, HOLDS[k].ref);             // hlink is already runway-frame m/off
  FIL[k] = { W: G.fil[k], E: G.fil[k] };                  // the mapped centreline-to-taxiway curve, used either way
}
// the runway-holding positions: a path point there stops the aircraft until cleared onto or across the runway
for (const [id, rid] of Object.entries(G.hs)) if (GN[id]) GN[id].p.hs = rid;
// each holding position's axis: the unit vector along the taxiway towards the runway (from the mapped link to it)
const HOLD_AXIS = {};
// the axis is read from the taxiway 25 m or more out from the holding position, so a kink in the mapped link next to it can't skew the bars
const axisPt = (k, p) => { const hl = (G.hlink[k] || []).map(q => rm(...q)).reverse(); for (const q of hl) if (dist(...p, ...q) >= 25) return q; return hl.length ? hl[hl.length - 1] : GN[HOLDS[k].rwy].p; };
for (const [k, H] of Object.entries(HOLDS)) {
  if (HOLD_AXIS[H.node] || !GN[H.node]) continue;
  const p = GN[H.node].p, q = axisPt(k, p), L = dist(...p, ...q) || 1;
  HOLD_AXIS[H.node] = [(q[0] - p[0])/L, (q[1] - p[1])/L];
}
// ── lead-on / lead-off lines: one clean curve from the taxiway centreline to the runway centreline, joining it tangentially and
// running on along it for 60 m. A way in square to the runway gets a curve each way (radius 40 m); an angled one a single curve.
const LEADS = (() => {
  const out = [], seen = new Set(), RUN = 60;
  const bez = (P0, P1, P2, P3) => { const a = []; for (let i = 0; i <= 24; i++) { const t = i/24, u = 1 - t;
    a.push([u*u*u*P0[0] + 3*u*u*t*P1[0] + 3*u*t*t*P2[0] + t*t*t*P3[0], u*u*u*P0[1] + 3*u*u*t*P1[1] + 3*u*t*t*P2[1] + t*t*t*P3[1]]); } return a; };
  const order = Object.keys(FIL).sort((x, y) => G.holds[x][5].includes(',') - G.holds[y][5].includes(','));   // the angled ways first
  const angled = [];
  for (const k of order) {
    const f = G.fil[k], C = f[0], T = f[f.length - 1], key = Math.round(C[0]/3) + ',' + Math.round(T[0]/3) + ',' + Math.sign(T[1]);
    if (seen.has(key)) continue; seen.add(key);
    const hl = G.hlink[k] || [], side = Math.sign(T[1]) || 1, cm = C[0], tm = T[0], to = T[1];
    // taxiway direction where it reaches T (away from the runway), from the last 12+ m of the mapped link or fillet
    let u = null; const tail = [...f.slice(0, -1).reverse().map(q => q), ...[]];
    const ref = [...hl, ...[]].find(q => dist(q[0], q[1], tm, to) >= 12) || tail.find(q => dist(q[0], q[1], tm, to) >= 12) || [tm, to - side*20];
    u = [tm - ref[0], to - ref[1]]; { const L = Math.hypot(...u) || 1; u = [u[0]/L, u[1]/L]; }
    if (hl.length) { const r2 = hl.find(q => dist(q[0], q[1], tm, to) >= 12); if (r2) { u = [r2[0] - tm, r2[1] - to]; const L = Math.hypot(...u) || 1; u = [u[0]/L, u[1]/L]; } }
    if (u[1]*side < 0.2) u = [Math.sign(u[0]) * 0.8, side*0.6];                      // never let it run back towards the runway
    const both = G.holds[k][5].includes(',');
    if (both && Math.abs(tm - cm) < 30 && Math.abs(u[1]) > 0.85) {
      const R = Math.abs(to) - 1, ax = tm;
      for (const s of [-1, 1]) {
        if (ax + s*R < 15 || ax + s*R > R0.len - 15 || angled.some(([m, sd]) => sd === side && Math.abs(m - ax) < 90)) continue;                 // no way along the runway there: it is the end
        const k1 = 0.5523*R, P = bez([ax, to], [ax, to - side*k1], [ax + s*(R - k1), 0], [ax + s*R, 0]);
        out.push([...P, [Math.max(0, Math.min(R0.len, ax + s*(R + RUN))), 0]]);
      }
    } else {
      const sx = Math.sign(tm - cm) || 1, dm = Math.abs(tm - cm), d = Math.abs(to);
      const k1 = Math.min(0.5*dm + 0.15*d, 0.62*Math.hypot(dm, d)), k2 = Math.min(0.5*d/Math.max(Math.abs(u[1]), 0.4), 0.5*Math.hypot(dm, d));
      const P = bez([cm, 0], [cm + sx*k1, 0], [tm - u[0]*k2, to - u[1]*k2], [tm, to]);
      out.push([[Math.max(0, Math.min(R0.len, cm - sx*RUN)), 0], ...P]); angled.push([(cm + tm)/2, side]);
    }
  }
  return out;
})();
// ── taxiway centrelines, cleaned once: the mapped links overlap (parallel and doubled ways, the same lane mapped twice, links
// from two holds over the same path). Every edge is cut into short pieces, a piece lying along one already kept (within 2.5 m, nearly
// the same heading) is dropped, taxiways ahead of aprons, and what is left is joined back into continuous chains through the
// junctions, so each lane is painted once and smoothly.
const CL = (() => {
  const M = 1852, pieces = [], grid = new Map(), K = 3, cell = 6;
  const gk = (x, y) => Math.floor(x/cell) + ',' + Math.floor(y/cell);
  const edges = GE.filter(e => !e.bare).sort((a, b) => (a.tw === 'APRON') - (b.tw === 'APRON'));
  const kept = [];
  for (const e of edges) {
    const a = GN[e.a].p.map(v => v*M), b = GN[e.b].p.map(v => v*M), L = Math.hypot(b[0] - a[0], b[1] - a[1]); if (L < 0.05) continue;
    const n = Math.max(1, Math.round(L/4)), hd = Math.atan2(b[1] - a[1], b[0] - a[0]);
    for (let i = 0; i < n; i++) {
      const p = [a[0] + (b[0] - a[0])*i/n, a[1] + (b[1] - a[1])*i/n], q = [a[0] + (b[0] - a[0])*(i + 1)/n, a[1] + (b[1] - a[1])*(i + 1)/n];
      const c = [(p[0] + q[0])/2, (p[1] + q[1])/2]; let dup = false;
      for (let gx = -1; gx <= 1 && !dup; gx++) for (let gy = -1; gy <= 1 && !dup; gy++) {
        for (const o of grid.get(gk(c[0] + gx*cell, c[1] + gy*cell)) || []) {
          let da = Math.abs(o.hd - hd) % Math.PI; da = Math.min(da, Math.PI - da);
          if (da < 0.35 && Math.hypot(o.c[0] - c[0], o.c[1] - c[1]) < 2.5 + (L/n)*0.5*(da > 0.1 ? 0 : 0)) { dup = true; break; }
        }
      }
      if (dup) continue;
      const pc = { p, q, c, hd, e }; kept.push(pc); const key = gk(c[0], c[1]); if (!grid.has(key)) grid.set(key, []); grid.get(key).push(pc);
    }
  }
  // not inside the runway (the lead lines are the markings there), and where two lanes cross without a junction the lesser one gives
  // way for 14 m either side, so a lane turning in is one curve and never an X through another
  const rank = e => e.tw === 'APRON' ? 4 : /^(LINK|INNER|OUTER)/.test(e.tw) ? 3 : 1;
  for (let i = kept.length - 1; i >= 0; i--) { const o = Math.abs(R0.offOf(kept[i].c.map(v => v/M))), m = R0.mOf(kept[i].c.map(v => v/M)); if (o < 31 && m > -5 && m < R0.len + 5) kept.splice(i, 1); }
  const cut = new Set(), all = kept.slice();   // all: the pieces before the runway is cleared, for the pavement
  if (false) for (let i = 0; i < kept.length; i++) for (let j = i + 1; j < kept.length; j++) {
    const s1 = kept[i], t = kept[j]; if (s1.e === t.e || Math.abs(s1.c[0] - t.c[0]) > 8 || Math.abs(s1.c[1] - t.c[1]) > 8) continue;
    let da = Math.abs(s1.hd - t.hd) % Math.PI; da = Math.min(da, Math.PI - da); if (da < 0.45) continue;
    const d = (a, b, c) => (b[0] - a[0])*(c[1] - a[1]) - (b[1] - a[1])*(c[0] - a[0]);
    if (!(d(s1.p, s1.q, t.p)*d(s1.p, s1.q, t.q) < 0 && d(t.p, t.q, s1.p)*d(t.p, t.q, s1.q) < 0)) continue;
    const loser = rank(s1.e) > rank(t.e) ? s1 : rank(t.e) > rank(s1.e) ? t : t, X = s1.c;
    for (const k of kept) if (k.e.tw === loser.e.tw && Math.hypot(k.c[0] - X[0], k.c[1] - X[1]) < 14 && !(k.e !== loser.e && k.e.tw !== loser.e.tw)) cut.add(k);
  }
  for (let i = kept.length - 1; i >= 0; i--) if (cut.has(kept[i])) kept.splice(i, 1);
  // join into chains through nodes of degree two
  const chainify = list => {
    const ek = pt => Math.round(pt[0]*2) + ',' + Math.round(pt[1]*2), ends = new Map();
    list.forEach((pc, i) => { for (const pt of [pc.p, pc.q]) { const k = ek(pt); if (!ends.has(k)) ends.set(k, []); ends.get(k).push(i); } });
    const used = new Set(), chains = [], other = (i, k) => (ends.get(k) || []).filter(j => j !== i);
    for (let i = 0; i < list.length; i++) {
      if (used.has(i)) continue;
      let cur = i, from = ek(list[i].p), guard = 0;
      while (guard++ < 5000) { const nx = other(cur, from); if (nx.length !== 1 || (ends.get(from) || []).length !== 2 || used.has(nx[0])) break; const j = nx[0], pj = list[j]; from = ek(pj.p) === from ? ek(pj.q) : ek(pj.p); cur = j; if (cur === i) break; }
      const line = []; let at = cur, enter = from; guard = 0;
      while (guard++ < 5000) {
        used.add(at); const pc = list[at], forward = ek(pc.p) === enter;
        if (!line.length) line.push(forward ? pc.p : pc.q); line.push(forward ? pc.q : pc.p);
        const leave = forward ? ek(pc.q) : ek(pc.p), nx = other(at, leave);
        if (nx.length !== 1 || (ends.get(leave) || []).length !== 2 || used.has(nx[0])) break;
        at = nx[0]; enter = leave;
      }
      if (line.length > 1) chains.push(line.map(pt => [pt[0]/M, pt[1]/M]));
    }
    return chains;
  };
  return { paint: chainify(kept), pave: chainify(all.filter(pc => pc.e.tw !== 'APRON')) };
})();
const CLINES = CL.paint;
// stands: the terminal (T), the three round satellites (S: drive-through stands, bussed passengers), the east (E) and west (W)
// aprons and the north apron (N, business aviation)
const STANDS = G.gates.map(([id, term, [e, n], node, hdg, line, out]) => { const p = EN(e, n);
  return { id, term, p, m: mOf(p), off: offOf(p), node, area: 'civil', occ: null, noLead: !line, h0: hdg, line: line ? line.map(([e, n]) => EN(e, n)) : null,
    ...(out ? { out: { node: out[0], pts: out[1].map(([e, n]) => EN(e, n)) } } : {}) }; });   // out: a drive-through stand's way out to the far lane
// satellite stands are entered one way only: the way that puts the left (door) side of the aircraft towards the satellite, so the
// aircraft circle each satellite anticlockwise seen from above. Stands mapped the other way round are turned about.
{ const S = STANDS.filter(s => s.out && s.line), cl = [];
  for (const s of S) { const c = cl.find(c => c.some(o => dist(...o.p, ...s.p)/M2NM < 95)); if (c) c.push(s); else cl.push([s]); }
  for (const c of cl) { const ce = [c.reduce((a, s) => a + s.p[0], 0)/c.length, c.reduce((a, s) => a + s.p[1], 0)/c.length];
    for (const s of c) {
      s.ce = ce;
      const h = dirv(s.h0 ?? brg(...s.line[0], ...s.p)), to = [(ce[0] - s.p[0])/M2NM, (ce[1] - s.p[1])/M2NM];
      if (h[0]*to[1] - h[1]*to[0] > 0) continue;                      // the satellite is on its left already
      const far = s.out.pts[s.out.pts.length - 1], oldLine = s.line, oldNode = s.node;
      s.line = [far, s.p]; s.out = { node: oldNode, pts: [s.p, oldLine[0]] }; s.node = s.outNodeWas = G.gates.find(g => g[0] === s.id)[6][0]; s.h0 = norm((s.h0 ?? brg(...oldLine[0], ...s.p)) + 180);
    } } }
STANDS.forEach(s => { s.lp = GN[s.node].p; s.hdg = s.h0 ?? brg(...s.lp, ...s.p); });
STANDS.forEach(s => { if (s.out) s.dash = null; });         // the satellite stands get their own turn-in curves (drawLsgg)
// the mapped stand line ends where the nose stops: the stand's point is the aircraft's middle, set back from that end by
// the stop-bar distance of the largest aircraft the stand takes (as at Madrid and Manchester)
{ const at = new Map();
  for (const t of STANDS) {
    const u = dirv(t.hdg); let lat = Infinity, near = Infinity;
    for (const o of STANDS) { if (o === t) continue;
      const dx = (o.p[0] - t.p[0])/M2NM, dy = (o.p[1] - t.p[1])/M2NM, al = dx*u[0] + dy*u[1], la = Math.abs(dx*u[1] - dy*u[0]);
      if (Math.abs(al) < 30 && la > 10) lat = Math.min(lat, la);
      if (la > 10 || Math.abs(al) > 10) near = Math.min(near, Math.hypot(dx, dy)); }
    const w = clamp(Math.min(isFinite(lat) ? lat : 38, near*1.1) - 1, 30, 82), sb = clamp(w + 6, 24, 80)*0.56 - 4;
    if (t.out && t.ce) {   // satellite stand: the aircraft's front left door (12 m ahead of its middle) is level with the middle of the satellite
      const al = ((t.ce[0] - t.p[0])*u[0] + (t.ce[1] - t.p[1])*u[1])/M2NM - 12;
      at.set(t, [t.p[0] + u[0]*al*M2NM, t.p[1] + u[1]*al*M2NM]); continue;
    }
    at.set(t, add(t.p, t.hdg + 180, Math.min(sb, Math.max(0, dist(...t.lp, ...t.p)/M2NM - 15))*M2NM));
  }
  for (const [t, p] of at) { t.p = p; t.m = mOf(p); t.off = offOf(p); } }
const APRONS = G.aprons.map(r => r.map(([e, n]) => inF0(e, n)));
R0.side = -1;                                              // the terminal, the aprons and the main exits are south-east of the runway
const TERM_NAME = { T: 'Terminal', S: 'Satellites', E: 'East Apron', W: 'West Apron', N: 'North Apron' };

// taxiway names: letters spoken one by one (AX "Alfa X-ray"), digits as numbers; holding points without the ~n suffix
const NATO = { A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike',
  N: 'November', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu' };
const twyWords = t => t.replace(/~\d+$/, '').match(/[A-Z]|\d+/g).map(x => NATO[x] || x).join(' ');
const PHON = {};
for (const e of GE) if (e.tw && e.tw !== 'APRON' && !PHON[e.tw]) PHON[e.tw] = twyWords(e.tw);
for (const k of Object.keys(HOLDS)) PHON[k] = twyWords(k);
for (const [id] of G.ihps) PHON[id] = twyWords(id);
PHON.APRON = 'the apron';

// departure entries: the holding points at the departure end of the runway, nearest first from where the aircraft is
const endHolds = rw => Object.keys(HOLDS).filter(k => HOLDS[k].end === rw);
const routeLen = (from, to) => { const r = route(from, to); return r ? pathLen(r.nodes) : Infinity; };
// (27: AX or BX by the 27 end; 09: GX at the end of taxiway G), by taxi route (one multi-target search, routesFrom)
function depHold(ac){
  const rw = depRw(), from = ac.stand && !ac.leftStand ? ac.stand.node : (nearestNode([ac.x, ac.y], n => !/^R/.test(n.id)) || {}).id;
  const ks = endHolds(rw); if (ks.length < 2 || !from) return ks[0];
  const rs = routesFrom(from, ks.map(k => HOLDS[k].node)); let best = ks[0], bl = Infinity;
  ks.forEach((k, i) => { const r = rs[i], L = r ? pathLen(r.nodes) : Infinity; if (L < bl) { bl = L; best = k; } });
  return best;
}
// nose-in stands: the tug pushes the tail back onto the taxilane, then 40 m along it the way the tail points
function laneDir(st, face){
  const tail = face === 'east' ? 270 : face === 'west' ? 90 : face === 'north' ? 180 : face === 'south' ? 0 : 90, lp = st.lp;
  // a lead-in at the dead end of its lane: the tail goes back past the end, so the nose faces the only way on
  const ways = waysOn(st.node); if (ways.length === 1) return norm(brg(...lp, ...GN[ways[0][0]].p) + 180);
  let best = null, bd = 999;
  for (const [v] of waysOn(st.node)) { const d = Math.abs(angDiff(brg(...lp, ...GN[v].p), tail)); if (d < bd) { bd = d; best = v; } }
  if (best && bd <= 60) return brg(...lp, ...GN[best].p);
  // no way on behind it (a lead-in at the end of its lane, or one way along): the tail goes back past the end, so the
  // nose faces along the way on nearest the side it is to face
  let fwd = null, fd = 999;
  for (const [v] of waysOn(st.node)) { const d = Math.abs(angDiff(brg(...lp, ...GN[v].p), tail + 180)); if (d < fd) { fd = d; fwd = v; } }
  return fwd && fd <= 60 ? norm(brg(...lp, ...GN[fwd].p) + 180) : best ? brg(...lp, ...GN[best].p) : tail;
}
function pushPath(ac, face){ const st = ac.stand; return [st.lp, add(st.lp, laneDir(st, face), 40*M2NM)]; }
// face the way the route to the runway starts
function pushRec(ac){
  const st = ac.stand, to = HOLDS[depHold(ac)].node;
  // the face whose push leaves the nose pointing the way the route to the runway sets off (it can't turn round
  // afterwards): the shorter of the routes that start the way the nose points
  const len = f => { const r = route(st.node, to, undefined, norm(laneDir(st, f) + 180)); return r ? pathLen(r.nodes) : Infinity; };
  const E = len('east'), W = len('west');
  if (E < Infinity || W < Infinity) return E <= W ? 'east' : 'west';
  const r = route(st.node, to);
  if (!r || r.nodes.length < 2) return 'east';
  const b = brg(...st.lp, ...GN[r.nodes[1]].p), off = f => Math.abs(angDiff(norm(laneDir(st, f) + 180), b));
  return off('east') <= off('west') ? 'east' : 'west';
}
// exits for the landing runway: those the roll-out direction can turn into, on the apron side, in the order met (27:
// Delta, angled for it, then Foxtrot and Golf; 09: Foxtrot, Delta, Bravo, Alfa), then the south side (Hotel, Juliett).
// The runway is 3,919 m: an exit 800 m past the threshold is usable.
const RWYS_BY_END = rw => R0;
function exitsFor(rw){
  const R = R0, up = rw === R.lo, thr = R.thr[rw];
  const ks = Object.keys(HOLDS).filter(k => { const H = HOLDS[k]; return H.dirs.includes(rw) && (up ? H.m > thr + 800 : H.m < thr - 800); });
  const near = ks.filter(k => Math.sign(HOLDS[k].off) === R.side), far = ks.filter(k => Math.sign(HOLDS[k].off) !== R.side);
  const order = a => a.sort((x, y) => (HOLDS[x].m - HOLDS[y].m)*(up ? 1 : -1));
  return [...order(near), ...order(far)];
}
// a name the controller says ("VAC D") to the exit of that taxiway, ahead of the aircraft
function exitFor(ac, name){
  if (HOLDS[name]) return name;
  const rw = ac.app || S.rwy, R = R0, m = R.mOf([ac.x, ac.y]), dir = rw === R.lo ? 1 : -1;
  const ks = Object.keys(HOLDS).filter(k => (HOLDS[k].ref === name || HOLDS[k].tw === name) && (HOLDS[k].m - m)*dir > 20);
  return ks.sort((a, b) => (Math.sign(HOLDS[b].off) === R.side) - (Math.sign(HOLDS[a].off) === R.side) || (HOLDS[a].m - HOLDS[b].m)*dir)[0] || null;
}

// ═════════════════════════ aerodrome drawing ═════════════════════════
// taxiways 23 m: the ICAO width for the code D/E aircraft Geneva takes
const AD_SITE = { pave: { w: 23 }, aprons: APRONS, roads: [], buildings: [], twyExtra: [], shoulder: [0, RWY_M], serviceRoad: false, paag: [], floods: [], twyLabels: [], hotspots: [], labels: [] };
const HOTSPOTS = [];
const TERM_LABELS = (() => { const by = {}; for (const s of STANDS) (by[s.term] ||= []).push(s.p); return Object.entries(by).map(([t, ps]) => [TERM_NAME[t].toUpperCase(), ps.reduce((a, p) => [a[0] + p[0]/ps.length, a[1] + p[1]/ps.length], [0, 0])]); })();
function drawLsgg(){
  const sc = V.scale, mpx = sc/1852, IMG = mapImagery();
  const P2 = p => [sx(p[0]), sy(p[1])];
  const pathP = (pts, close = true) => { cx.beginPath(); pts.forEach((p, i) => cx[i ? 'lineTo' : 'moveTo'](...P2(p))); if (close) cx.closePath(); };
  const lw = m => Math.max(1, m*mpx);
  const R = R0, rwyPoly = w => [R.rm(0, -w/2), R.rm(R.len, -w/2), R.rm(R.len, w/2), R.rm(0, w/2)];
  if (sc <= 70) { cx.fillStyle = rgba('rwyOut', .9); pathP(rwyPoly(Math.max(R.width, 2.2/mpx))); cx.fill(); return; }
  cx.lineJoin = 'round'; cx.lineCap = 'round';
  // aprons, then the taxiways (every graph edge), then the runway on top; over the street map the
  // mapped aprons and taxiways are already there, so only the drawn chart paves them
  if (!IMG) {
    cx.fillStyle = C.concrete; for (const a of APRONS) { pathP(a.map(([m, o]) => rm(m, o))); cx.fill(); }
    cx.strokeStyle = C.concrete; cx.lineWidth = lw(60);
    for (const e of GE) { if (e.tw !== 'APRON') continue; pathP([GN[e.a].p, GN[e.b].p], false); cx.stroke(); }
    cx.lineWidth = lw(44); for (const s of STANDS) { pathP(s.line || [s.lp, s.p], false); cx.stroke(); }
    cx.strokeStyle = C.asphalt;
    cx.lineWidth = lw(23);
    for (const e of GE) { if (e.tw === 'APRON') continue; pathP([GN[e.a].p, GN[e.b].p], false); cx.stroke(); }
    for (const k in FIL) { pathP(FIL[k].W.map(([m, o]) => R.rm(m, o)), false); cx.stroke(); }
  } else {
    // over the street map: taxiways at their real width, clear of the buildings; the aprons are the map's own
    const lines = CL.pave.map(c => ({ pts: c.map(P2), w: paveWidth() }));   // the cleaned, continuous centrelines: one band per taxiway, no breaks
    for (const k in FIL) lines.push({ pts: FIL[k].W.map(([m, o]) => P2(R.rm(m, o))), w: paveWidth() });
    drawPavement(lines, G.buildings.map(b => b.pts.map(([e, n]) => P2(EN(e, n)))), mpx);
  }
  cx.fillStyle = C.rwy; pathP(rwyPoly(R.width)); cx.fill();
  if (!IMG) { cx.fillStyle = C.bld; cx.strokeStyle = C.bldEdge; cx.lineWidth = 1; for (const b of G.buildings) { pathP(b.pts.map(([e, n]) => EN(e, n))); cx.fill(); cx.stroke(); } }
  if (sc > 150) {
    cx.fillStyle = C.paint; cx.strokeStyle = C.paint;
    const hw = R.width/2 - 1.5, quad = (m1, o1, m2, o2) => { pathP([R.rm(m1, o1), R.rm(m2, o1), R.rm(m2, o2), R.rm(m1, o2)]); cx.fill(); };
    cx.lineWidth = lw(0.9); pathP([R.rm(0, hw), R.rm(R.len, hw)], false); cx.stroke(); pathP([R.rm(0, -hw), R.rm(R.len, -hw)], false); cx.stroke();
    cx.setLineDash([30*mpx, 20*mpx]); pathP([R.rm(R.thr[R.lo] + 100, 0), R.rm(R.thr[R.hi] - 100, 0)], false); cx.stroke(); cx.setLineDash([]);
    // ICAO Annex 14 / CAP 168: threshold stripes (16 on a 60 m runway), aiming point at 400 m, touchdown zone bars in
    // threes, twos and ones to 900 m, arrows and a transverse bar before the displaced 04 threshold
    for (const [m0, dir] of [[R.thr[R.lo], 1], [R.thr[R.hi], -1]]) {
      quad(m0, -hw, m0 + dir*3, hw);
      for (let i = 0; i < 6; i++) for (const k of [-1, 1]) { const o = k*(3 + i*(hw - 3)/6); quad(m0 + dir*6, o, m0 + dir*36, o + k*1.8); }
      for (const k of [-1, 1]) quad(m0 + dir*400, k*9, m0 + dir*460, k*19);
      for (const [d, n] of [[150, 3], [300, 3], [600, 2], [750, 2], [900, 1]]) for (const k of [-1, 1]) for (let j = 0; j < n; j++) {
        const o = k*(9 + j*3.3); quad(m0 + dir*d, o, m0 + dir*(d + 22.5), o + k*1.8);
      }
      const pre = dir > 0 ? m0 : R.len - m0;
      if (pre > 60) {
        cx.lineWidth = lw(0.9);
        for (let d = 30; d < pre - 15; d += 60) { const m = m0 - dir*d; pathP([R.rm(m - dir*18, 0), R.rm(m, 0)], false); cx.stroke(); pathP([R.rm(m - dir*8, -3), R.rm(m, 0), R.rm(m - dir*8, 3)], false); cx.stroke(); }
        for (const k of [-1, 1]) { const m = m0 - dir*8; pathP([R.rm(m - dir*10, k*8), R.rm(m, k*12), R.rm(m - dir*10, k*16)], false); cx.stroke(); }
      }
    }
    for (const [rw, m0] of [[R.lo, R.thr[R.lo] + 60], [R.hi, R.thr[R.hi] - 60]]) drawRwyDesignator(...P2(R.rm(m0, 0)), rw, crsOf(rw), Math.max(9, 16*mpx));
    // lead-on and lead-off lines: the mapped fillet curves carried over the runway to its centreline
    groundLines(lw(0.35), () => LEADS.forEach(l => strokeSmooth(l.map(p => P2(R.rm(...p))))));
    // taxiway centrelines, stopping at the runway edges
    groundLines(lw(0.35), () => CLINES.forEach(c => strokeSmooth(c.map(P2))));
    // runway holding positions (pattern A): two solid lines on the taxiway side and two dashed on the runway side, across
    // the taxiway (GX is on G where it runs alongside the runway, so it isn't simply parallel to it)
    cx.strokeStyle = C.yellow;
    for (const [id, [u, v]] of Object.entries(HOLD_AXIS)) {
      const n = GN[id]; if (!n) continue; const at = (a, b) => [n.p[0] + (v*a + u*b)*M2NM, n.p[1] + (-u*a + v*b)*M2NM];   // a across, b along
      for (const [d, dash] of [[-0.9, false], [-0.3, false], [0.3, true], [0.9, true]]) { cx.setLineDash(dash ? [mpx + 1, mpx + 1] : []); pathP([at(-9, d), at(9, d)], false); cx.stroke(); }
      cx.setLineDash([]);
    }
    // stand lead-in lines and numbers
    groundLines(lw(0.3), () => { for (const s of STANDS) if (!s.noLead) { pathP(s.line || [s.lp, s.p], false); cx.stroke(); } });
    // drive-through satellite stands, as painted: the lead line runs straight through and on out the far side, with a turn-in arc
    // from the lane either side of the start of the lead-in
    groundLines(lw(0.3), () => { for (const s of STANDS) if (s.out && s.line) {
      pathP([s.p, s.out.pts[s.out.pts.length - 1]], false); cx.stroke();
      // dashed turn-in curves linking the lane to the lead line, at the nose end and at the exit end: each runs from a point on the
      // lane's own centreline, through the lane node, round onto the lead line (as at every other stand)
      cx.setLineDash([2*mpx + 2, 2*mpx + 2]);
      for (const nid of [s.node, s.out.node]) { const gn = GN[nid]; if (!gn) continue; const P = gn.p, lead = brg(...P, ...s.p), seen = [];
        const at = (q, bg, k) => [q[0] + Math.sin(bg*D2R)*k*M2NM, q[1] + Math.cos(bg*D2R)*k*M2NM];
        for (const [v, e] of waysOn(nid)) { const w = GN[v] && GN[v].p; if (!w || !/^(OUTER|INNER|LINK)/.test(e.tw || '') || dist(...P, ...w)/M2NM < 3) continue;
          const bg = brg(...P, ...w), an = Math.abs(angDiff(bg, lead)); if (an < 25 || an > 112 || seen.some(x => Math.abs(angDiff(x, bg)) < 20)) continue; seen.push(bg);
          const A = at(P, bg, Math.min(18, dist(...P, ...w)/M2NM*0.9)), B = at(P, lead, 12), pts = [];
          for (let i = 0; i <= 12; i++) { const u = i/12, q = 1 - u; pts.push([q*q*A[0] + 2*q*u*P[0] + u*u*B[0], q*q*A[1] + 2*q*u*P[1] + u*u*B[1]]); }
          pathP(pts, false); cx.stroke(); } }
      cx.setLineDash([]);
    } });
    cx.save(); if (IMG) clipOut(G.buildings.map(b => b.pts.map(([e, n]) => P2(EN(e, n))))); drawStandDetail(null, null, mpx, false); cx.restore();   // stand paint stops at the terminal walls
    drawGroundSigns();
    cx.font = `600 11px ${FONT_L}`;
    for (const [t, p] of HOTSPOTS) { const [X, Y] = P2(p); cx.strokeStyle = rgba('hot', .85); cx.lineWidth = 1.2; cx.beginPath(); cx.arc(X, Y, 45*mpx + 6, 0, 7); cx.stroke(); cx.fillStyle = rgba('hot', .95); cx.fillText(t, X + 45*mpx + 8, Y + 4); }
  }
}
// lights and terminal names: drawn every frame over the airfield layer (in the dark theme the lights add their glow to
// what is under them, so they can't go in the layer)
function drawLsggTop(){
  const sc = V.scale, mpx = sc/1852, IMG = mapImagery();
  const P2 = p => [sx(p[0]), sy(p[1])];
  const R = R0;
  // lights: runway edges and thresholds (dark theme glow)
  if (sc > 110) {
    cx.save(); cx.globalCompositeOperation = C.glow;
    const r = Math.max(1.1, 0.9*mpx), glow = (p, col) => { const [X, Y] = P2(p); cx.fillStyle = col; cx.beginPath(); cx.arc(X, Y, r, 0, 7); cx.fill(); };
    const hw = R.width/2 + 0.5;
    for (let m = 0; m <= R.len; m += 60) { glow(R.rm(m, hw), 'rgba(255,244,214,.75)'); glow(R.rm(m, -hw), 'rgba(255,244,214,.75)'); }
    for (let o = -hw + 1; o <= hw - 1; o += 4) { glow(R.rm(R.thr[R.lo], o), 'rgba(90,255,140,.9)'); glow(R.rm(R.thr[R.hi], o), 'rgba(90,255,140,.9)'); }
    cx.restore();
  }
  if (sc > 180 && sc < 2400) {
    cx.font = `600 12px ${FONT_L}`;
    if (IMG) { cx.fillStyle = C.name === 'dark' ? 'rgba(235,242,245,.92)' : '#fff'; cx.strokeStyle = 'rgba(0,0,0,.6)'; cx.lineWidth = 3; cx.lineJoin = 'round'; } else cx.fillStyle = rgba('lab', .72);
    for (const [t, p] of TERM_LABELS) { const [X, Y] = P2(p); if (IMG) cx.strokeText(t, X, Y); cx.fillText(t, X, Y); }
  }
}

// ═════════════════════════ fixes, STARs, SIDs ═════════════════════════
const STAR_FIXES = new Set(Object.values(LSGG.STARS).flatMap(s => s.pts.map(p => p[0])));
for (const [id, p] of Object.entries(LSGG.FIX)) wp(id, p[0], p[1], STAR_FIXES.has(id) || /^(INDIS|BELKA|GG808|GG852|GG803)$/.test(id) ? {} : { minor: true });
// the SIDs' turn points: straight ahead along the runway track, 5 NM past the far end, hidden
WP.T04 = { id: 'T04', p: add(THR['22'], CRS['04'], 5), hide: true, note: 'SID turn point' };
WP.T22 = { id: 'T22', p: add(THR['04'], CRS['22'], 5), hide: true, note: 'SID turn point' };
const RADAR_REF = ARP;
const GATES = Object.keys(LSGG.DIR);
const STAR_OF = (g, rw) => LSGG.STARS[LSGG.DIR[g].star[rw || '22']];
const starFrom = (g, rw) => STAR_OF(g, rw).pts.map(p => p[0]);
// published holds (SAPRE for the ILS 22 arrivals, GEVEA over the field for the missed approaches)
for (const [id, h] of Object.entries(LSGG.HOLDS_AIR)) WP[id].hold = { inb: Math.round(h.inb), min: h.min, left: h.turn === 'L' };
const ENTRY = Object.fromEntries(GATES.map(g => [g, WP[LSGG.DIR[g].entry['22']].p]));
// the level an arrival is picked up at (Swiss Radar has brought it down) and its level before that
const ENTRY_ALT = { NE: 15000, N: 15000, E: 15000, SE: 14000, S: 14000, SW: 14000 };
const PRE_ALT = { NE: 24000, N: 24000, E: 24000, SE: 23000, S: 23000, SW: 23000 };

// ── ILS approaches: the localiser from 3 NM outside the intermediate fix, the 3° glidepath from it. The approach
// controller's "four miles" check: an arrival not visual (below the CAT I minima) goes around there.
const FINAL = {};
for (const [rw, I] of Object.entries(LSGG.ILS)) {
  const thr = THR[rw], out = norm(crsOf(rw) + 180), dIF = dist(...thr, ...WP[I.ifx].p), elev = THR_ELEV[rw];
  const low = Math.round((elev + 4*318 - 250)/10)*10;
  const F = { pts: [add(thr, out, dIF + 3), add(thr, out, dIF), thr], alts: [I.ifAlt, I.ifAlt, elev + 50], elev, entry: I.ifx, entryName: I.ifx, name: 'ILS ' + rw, alt: I.ifAlt,
    decName: 'four miles', decNM: 4, decMin: 2.6, minAlt: low, minText: `${low.toLocaleString('en-GB')} ft`,
    mins: { vis: 550, ceil: 200 }, minRate: 300, missed: [I.missed[0]], missAlt: I.missed[1],
    phrase: r => `cleared ILS approach runway ${r}`, read: r => `cleared ILS ${r}`,
    decCall: r => `${APT.tower[0]}, four miles, ILS runway ${r}`, decNeed: 'Four miles, needs landing clearance', decFail: 'not visual at the decision altitude' };
  F.cum = new Array(F.pts.length).fill(0); for (let i = F.pts.length - 2; i >= 0; i--) F.cum[i] = F.cum[i+1] + dist(...F.pts[i], ...F.pts[i+1]);
  const meet = (I.ifAlt - elev - 50)/318;                    // 3° = 318 ft per NM
  F.prof = [[0, elev + 50], [meet, I.ifAlt], [F.cum[0] + 1, I.ifAlt]];
  FINAL[rw] = F;
}

// ── arrival routes: the STAR for the runway in use, then the intermediate fix (the ILS 22 STARs already end at SAPRE; the
// ILS 04 ones at GG502/GG503, a 312° leg from INDIS)
const FEED_ALT = {};
const ARR_ROUTE = Object.fromEntries(GATES.map(g => [g, Object.fromEntries(['04', '22'].map(rw => {
  const star = starFrom(g, rw), ifx = LSGG.ILS[rw].ifx;
  return [rw, star[star.length - 1] === ifx ? star : [...star, ifx]];
}))]));
const HOLD_AT = Object.fromEntries(GATES.map(g => [g, 'SAPRE']));

// ── departures: RNAV SIDs: straight ahead to the turn point, then the route
const sidName = (gate, rwy) => LSGG.DIR[gate].sid[rwy] || LSGG.DIR[gate].sid['22'];
const sidSpoken = n => (LSGG.SIDS[n] || {}).spoken || n;
const sidTopOf = n => Math.max(...((LSGG.SIDS[n] || {}).pts || [[0, 6000]]).map(p => p[1] || 0));
const exitRoute = (g, rwy) => LSGG.SIDS[sidName(g, rwy)].pts.map(p => p[0]);
const EXIT_ROUTE = {}, EXIT_FIX = {};
for (const g of GATES) {
  Object.defineProperty(EXIT_ROUTE, g, { enumerable: true, get: () => exitRoute(g, depRw()) });
  Object.defineProperty(EXIT_FIX, g, { enumerable: true, get: () => { const r = exitRoute(g, depRw()); return r[r.length - 1]; } });
}
const NEXT_UNIT = Object.fromEntries(GATES.map(g => [g, LSGG.CTR[LSGG.DIR[g].ctr]]));
const relUnit = ac => 'Geneva Departure';
const TEL = LSGG.TEL;
const isMil = ac => false;
const gateFor = ap => LSGG.PLACE_DIR[ap] || 'S';

// ═════════════════════════ schedule ═════════════════════════
const withGate = x => ({ ...x, gate: x.gate || gateFor(x.k === 'ARR' ? x.o : x.d) });
const TIMETABLE = LSGG.TIMETABLE;
const REGS = { PC12: 'HB-FQB', C56X: 'HB-VQB' };
const LONG_STAY = LSGG.LONG_STAY;
const EXTRA = LSGG.EXTRA.map(withGate);
const EXERCISES = Object.fromEntries(Object.entries(LSGG.EXERCISES).map(([k, e]) => ['v' + k, { ...e, sched: e.sched.map(withGate) }]));
const WX_PRESETS = LSGG.WX_PRESETS;

// ═════════════════════════ weather rules ═════════════════════════
// the bise (a strong north-easterly funnelled between the Jura and the Alps) brings turbulence and windshear on final 04
const TURB_TABLE = {};
function turbExcess(w){
  if (w.vrb || w.spd < 15) return 0;
  return Math.max(0, Math.max(w.spd, (w.gust || 0)*0.85) - 25);
}
// ILS CAT I: 200 ft and RVR 550 m
const minsOk = (w, rw) => w.vis >= 550 && w.ceil >= 200;
const sraMinsOk = w => minsOk(w, '22');

// ═════════════════════════ engine hooks ═════════════════════════
// the area an airline uses (Swiss and the network carriers on the satellites, easyJet on the west apron, business aircraft on
// the north apron); if it is full, the terminal stands, then the others
const termOf = ac => LSGG.APRON_OF[ac.cs.slice(0, 3)] || (isBiz(ac) ? 'N' : 'T');
// any free stand of the area that takes it, the smallest that fits first, picked at random across the area
function standAt(ac, t){
  const free = STANDS.filter(s => standFree(s, ac) && s.term === t).sort((a, b) => (a.maxSpan || 80) - (b.maxSpan || 80));
  const best = free.filter(s => (s.maxSpan || 80) <= (free[0] && free[0].maxSpan || 80) + 12);
  return best[Math.floor(Math.random()*best.length)] || null;
}
const driveOutNow = ac => typeof driveOut === 'function' && !!driveOut(ac);
const APT = {
  // STAR levels, then the ILS intermediate fixes
  arrAlt: { ...arrAltOf(Object.values(LSGG.STARS)), ...FEED_ALT },
  icao: 'LSGG', name: 'Geneva', coordName: 'Geneva', radarName: 'GVA', utcOff: 1, tz: 'Europe/Zurich',
  radar: [LSGG.UNITS.app.name, LSGG.UNITS.app.freq], depRadar: [LSGG.UNITS.dep.name, LSGG.UNITS.dep.freq],   // departures go to Geneva Departure, then Swiss Radar
  tower: [LSGG.UNITS.twr.name, LSGG.UNITS.twr.freq], gnd: [LSGG.UNITS.gnd.name, LSGG.UNITS.gnd.freq],
  runways: RWY_LIST, bigGround: true, rwyHalfWidth: 30,
  ihps: G.ihps.map(([id, node]) => ({ id, node })),
  xing: false, drawnTown: false, ta: LSGG.TA, initClimb: 7000, gaAlt: 7000, appAlt: 7000, handoffNM: 14, climbFL: 190, divertAlt: 9000,
  area: { dep: 45, arr: 80, div: 45 }, roll: [70, RWY_M - 70], defRwy: '22', defWx: 'west',
  appName: 'ILS approach', appShort: 'ILS', minsText: 'weather below the ILS minima', reqApp: rw => 'ILS approach',
  minsLong: 'Weather is below the ILS CAT I minima (200 ft and RVR 550 m).',
  liveName: 'Geneva Airport', liveThin: 22, atisFreq: LSGG.UNITS.atis.freq, turbName: 'Geneva',
  sessionHours: Array.from({ length: 16 }, (_, i) => i + 5),   // 0500Z to 2000Z: 07:00 to 22:00 in Geneva in summer
  view: { app: [0, 0, 60], twr: [0, -0.2, 2.2], gnd: [mOf(EN(-300, -800)), offOf(EN(-300, -800)), 2000, 1200] },
  minsOk,
  // the SIDs are pre-coordinated with Geneva Departure and Swiss Radar: no individual departure releases
  needRel: ac => false,
  sidAlt: ac => sidTopOf(ac.sid),
  // stands: the airline's area, then the terminal stands, then the others
  remoteAreas: [],
  areaNames: { civil: 'stands' },
  standWord: 'stand',
  // satellite stands: jet bridges and apron buses between the satellite building and the terminal (vehicles.js satBay, shuttleOut)
  via: {}, preToOrigin: true,   // no turning points inherited from the Gibraltar routes (Biscay, Iberia): inbounds fly direct from where they started
  doorsToTerminal: true, shuttle: st => st.term === 'S', shuttleTerm: 'T',
  termName: t => TERM_NAME[t] || 'Apron ' + t,
  prefArea: ac => { const t = termOf(ac); return { key: t, name: TERM_NAME[t], has: s => s.term === t }; },
  standFor: ac => { const t = termOf(ac); return standAt(ac, t) || (t !== 'T' && standAt(ac, 'T')) || ['E', 'W', 'S', 'N'].filter(x => x !== t).map(x => standAt(ac, x)).find(Boolean) || null; },
  inboundAlt: gate => 7000,
  divertTo: ac => ['NE', 'N', 'E'].includes(ac.gate) ? ['Zurich', 'FRIBU'] : ['Lyon', 'CBY'],
  firstAlt: g => ENTRY_ALT[g] - 2000,
  rolledCall: 'request taxi',
  vacExits: ac => { const R = R0, rw = ac.app || S.rwy, m = R.mOf([ac.x, ac.y]), dir = rw === R.lo ? 1 : -1;
    return exitsFor(rw).filter(k => (HOLDS[k].m - m)*dir > 30 && Math.sign(HOLDS[k].off) === R.side).slice(0, 4); },
  vacPrefs: (st, ac) => exitsFor(ac && ac.app || S.rwy),
  exitFor,
  lineUpWords: hp => 'line up and wait',
  terrain: null,
  restricted: null,
  drawAirport: drawLsgg, drawAirportTop: drawLsggTop,
  gaEarly(ac, rw){},
  // missed approach: climb straight ahead, then the route to the SAPRE hold
  gaTurn(ac){ const rw = ac.gaRwy, F = FINAL[rw] || FINAL['22']; if (ac.alt > THR_ELEV[rw] + 1500 || dist(ac.x, ac.y, ...THR[rw]) > 4) { ac.gaTurn = true; ac.mode = 'NAV'; ac.route = F.missed.slice(); ac.turnDir = LSGG.ILS[rw].turn; } },
  // SIDs: straight ahead on the runway track, then the route
  liftoff(ac){ ac.tgtHdg = Math.round(crsOf(ac.depRwy)); ac.turnDir = 0; },
  depTurn(ac){ if (!ac.turned && ac.alt >= ELEV + 500) ac.turned = true; },
  depClear: ac => !!ac.turned,
  shear(ac, rw, w){ return turbExcess(w) > 4 && Math.random() < 0.2 ? 'windshear on final' : null; },
  shearWhy: rw => 'windshear on final',
  faceHold: (st, f) => depHold({ stand: st, leftStand: false, x: st.p[0], y: st.p[1] }),
  faceWord: f => f,
  faceHdg: (st, f) => norm(laneDir(st, f) + 180),
  // the departure-end holding points nearest the aircraft
  taxiHolds: (south, ac) => { const ks = endHolds(depRw()), p = ac ? (ac.stand && !ac.leftStand ? ac.stand.lp : [ac.x, ac.y]) : ARP;
    const rec = ac && depHold(ac); return [...new Set([rec, ...ks.sort((a, b) => dist(...p, ...GN[HOLDS[a].node].p) - dist(...p, ...GN[HOLDS[b].node].p))].filter(Boolean))].slice(0, 3); },
  taxiHint: rw => rw === '22' ? 'Runway 22 departures taxi north-east along the parallel taxiway to Alfa at the end of the runway.' : 'Runway 04 departures taxi south-west to Golf, on the pavement before the displaced 04 threshold.',
  // the three satellites' stands are taxi-in, taxi-out: no push back, Ground gives start-up and the aircraft taxis out forward
  diverts: [{ cs: 'BAW706', t: 'A320', o: 'EGLL', gate: 'NE', to: 'Zurich' }, { cs: 'KLM1923', t: 'E190', o: 'EHAM', gate: 'NE', to: 'Zurich' },
    { cs: 'IBE3416', t: 'A320', o: 'LEMD', gate: 'SW', to: 'Lyon' }, { cs: 'ITY626', t: 'A319', o: 'LIRF', gate: 'SE', to: 'Milan' }],
  airports: LSGG.AIRPORTS, via: {},
  airlineIcao: LSGG.AIRLINE_ICAO, airlineType: LSGG.AIRLINE_TYPE, defType: 'A320',
  placeIcao: LSGG.PLACES,
  phr: {
    push: (ac, dn, face) => { const top = sidTopOf(ac.sid), np = driveOutNow(ac);
      return [`cleared to ${dn} via ${sidSpoken(ac.sid)} departure, climb ${altWords(top)}, squawk ${ac.sqk}, start-up approved${np ? ', expect to taxi forward' : ', push back approved, facing ' + faceSay(ac, face)}, QNH ${S.wx.qnh}`,
        `cleared ${dn}, ${sidSpoken(ac.sid)}, altitude ${altShort(top)}, squawk ${ac.sqk}, start-up approved${np ? '' : ', push approved facing ' + faceSay(ac, face)}, QNH ${S.wx.qnh}`]; },
    startReq: ac => `${LSGG.UNITS.gnd.name}, stand ${ac.stand.id}, ${ac.perf.name} to ${AP[ac.d] ? AP[ac.d][2] : ac.d}, information ${phonetic(S.atis)}, request start-up${driveOutNow(ac) ? '' : ' and push back'}`
  },
  atisPanel(w){
    const c = windComp(w, crsOf(S.rwy)), bad = !minsOk(w, S.rwy);
    return `<div class="warnline${bad ? ' bad' : ''}">Runway ${S.rwy} · ${bad ? 'below the ILS minima' : 'ILS approaches'} · crosswind ${Math.round(Math.abs(c.crossG))} kt. One runway: space the arrivals to fit departures between them. Satellite stands are taxi-in, taxi-out.</div>`;
  },
  atisLines({ w, L, E, wind, vis, cloud }){
    const tl = w.qnh >= 1013 ? 80 : w.qnh >= 978 ? 90 : 100;
    const out = [
      `This is Geneva information ${L}, time ${zt(S.t).slice(0,5).replace(':', '')}.`,
      `Runway in use ${S.rwy}. ILS approach runway ${S.rwy}.`,
      `Surface wind ${wind}. Visibility ${vis}. ${cloud}.`,
      `Temperature ${w.temp}, dew point ${w.dew}. QNH ${w.qnh} hectopascals. Transition level ${tl}.`
    ];
    if (turbExcess(w) > 0) out.push('Moderate turbulence and windshear reported on final.');
    if (E && E.ws) out.push(`Windshear reported on final runway ${E.ws.rw} at ${zt(E.ws.t).slice(0,5).replace(':', '')}, ${E.ws.text}.`);
    if (E && E.rwyBlock) out.push(`Runway ${blockRw()} closed: ${E.rwyBlock.why}. Expect delays.`);
    if (!minsOk(w, S.rwy)) out.push('Visibility below the ILS minima. Expect holding at SAPRE.');
    out.push('Stands 31 to 34, 41 to 44 and 121 to 127 at the satellites are taxi-in, taxi-out: no push back. Passengers are bussed.');
    out.push(`Acknowledge receipt of information ${L} and advise aircraft type and stand on first contact.`);
    return out;
  },
  // the website: home hero, previews, scenario cards and Academy figures
  site: {
    hero: () => [
      ['SWR123', 46.31, 6.32, 223, 250, PAL.light.arr], ['EZY8821', 46.40, 6.52, 223, 230, PAL.light.arr], ['AFR2305', 46.48, 6.75, 225, 190, PAL.light.arr],
      ['BAW729', 46.22, 6.02, 43, 180, PAL.light.dep], ['EZS1711', 46.17, 5.96, 40, 240, PAL.light.dep],
      ['DLH1273', 46.55, 6.30, 180, 430, 'rgba(60,75,95,.7)'], ['UAE75', 46.00, 6.70, 300, 420, 'rgba(60,75,95,.7)'], ['EIN654', 46.65, 5.60, 110, 430, 'rgba(60,75,95,.7)']
    ],
    demo(mk, park){
      const fin = add(THR['22'], CRS['04'], 2.6), out = add(THR['22'], CRS['22'], 4 + RWY_M*M2NM), inb = add(WP.SAPRE.p, 45, 8);
      const hp = GN[HOLDS[endHolds('22')[0]].node].p;
      return [
        mk('SWR123', 'A320', 'DEP', park('31', { need: null, reqAt: 99999 })), mk('BAW729', 'A320', 'DEP', park('41', { need: null, reqAt: 99999 })),
        mk('KLM1922', 'E190', 'DEP', park('3', { need: null, reqAt: 99999 })), mk('EZS1711', 'A320', 'DEP', park('85', { need: null, reqAt: 99999 })),
        mk('EZY8822', 'A319', 'DEP', { ground: true, state: 'HOLDPT', hp: endHolds('22')[0], x: hp[0], y: hp[1], hdg: CRS['22'], gs: 0 }),
        mk('AFR2305', 'A320', 'ARR', { state: 'FINAL', mode: 'FINAL', app: '22', freq: 'TWR', x: fin[0], y: fin[1], hdg: CRS['22'], alt: 2650, gs: 145, vs: -750, o: 'LFPG' }),
        mk('DLH1274', 'A319', 'DEP', { state: 'CLIMB', x: out[0], y: out[1], hdg: 223, alt: 5000, gs: 210, vs: 2000, tgtAlt: 9000, d: 'EDDF' }),
        mk('IBE3455', 'A320', 'ARR', { state: 'INBOUND', x: inb[0], y: inb[1], hdg: 223, alt: 10000, gs: 250, vs: -1000, tgtAlt: 7000, o: 'LEMD' })
      ];
    },
    thumb(k, zoom, W){
      if (k === 'app') return v => { v.scale *= 1.3; };
      if (k === 'twr') { const c = rm(RWY_M*0.5, -250); return v => { v.cx = c[0]; v.cy = c[1]; v.scale = W/2.2; }; }
      const c = zoom === 'apron' ? STANDS.find(s => s.id === '31').p : rm(RWY_M*0.5, -350);
      return v => { v.cx = c[0]; v.cy = c[1]; v.scale = W/((zoom === 'apron' ? 700 : 2600)*M2NM); };
    },
    figHold: 'SAPRE', emergHp: 'A',
    figConsole: v => { v.scale *= 1.2; },
    cmdHint: 'Command, e.g. SWR123 H240 A70 · EZY8821 TAXI A · / to focus, Tab cycles flights'
  }
};
