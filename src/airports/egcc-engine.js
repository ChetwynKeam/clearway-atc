// ═════════════════════════ Manchester (EGCC) airport profile for the engine ═════════════════════════
// Builds every global the engine reads from the chart data in egcc.js (EGCC) and the OpenStreetMap aerodrome in
// egcc-ground.js (metres east and north of the ARP). Manchester has two parallel runways 390 m apart, staggered: 05L/23R
// (runway 1, beside the terminals) and 05R/23L (runway 2, south-west of it). In dual-runway operation one lands and the
// other departs: in the westerly arrivals land on 23R and departures leave from 23L, crossing runway 1 at BZ1, DZ1, FZ1
// or HZ1 on the way; in the easterly arrivals land on 05R and cross runway 1 to the terminals, and departures leave from
// 05L. S.rwy is the landing runway, S.depRwy the departure runway. A departure taxied to a holding point on the landing
// runway departs from it (single-runway operation, as at night).
Object.assign(TYPES, EGCC.TYPES);
const LL = p => xy(p[0], p[1]);
const G = EGCC_GROUND;
const EN = (e, n) => [e*M2NM, n*M2NM];                     // metres east and north of the ARP (the map origin) → NM

// ═════════════════════════ runways ═════════════════════════
// a frame along each runway: m from the pavement end a (the low-numbered end), off to the left
function rwyFrame(r){
  const a = EN(...r.a), b = EN(...r.b), L = dist(...a, ...b), RU = [(b[0]-a[0])/L, (b[1]-a[1])/L], RN = [-RU[1], RU[0]];
  const rm = (m, off=0) => [a[0] + (RU[0]*m + RN[0]*off)*M2NM, a[1] + (RU[1]*m + RN[1]*off)*M2NM];
  const mOf = p => ((p[0]-a[0])*RU[0] + (p[1]-a[1])*RU[1])/M2NM, offOf = p => ((p[0]-a[0])*RN[0] + (p[1]-a[1])*RN[1])/M2NM;
  const len = r.len, ms = G.rnodes.filter(([id]) => Object.values(G.holds).some(h => h[1] === id && h[2] === r.id)).map(([, e, n]) => mOf(EN(e, n)));
  const m0 = Math.min(0, ...ms.map(m => m - 40)), m1 = Math.max(len, ...ms.map(m => m + 40));
  const TURN_W = [[30, 0]], TURN_E = [[len - 30, 0]];
  return { id: r.id, lo: r.lo, hi: r.hi, len, m0, m1, thr: r.thr, elev: r.elev, rm, mOf, offOf, RU, TURN_W, TURN_E, TURN_END: { W: 30, E: len - 30 },
    roll: [70, len - 70], ends: true, width: 45 };
}
const RWY_LIST = ['05L23R', '05R23L'].map(id => rwyFrame(G.runways.find(r => r.id === id)));
const R0 = RWY_LIST[0];
const rm = R0.rm, mOf = R0.mOf, offOf = R0.offOf, RU = R0.RU;
const RWY_M = R0.len, THR_LO_M = R0.thr['05L'], THR_HI_M = R0.thr['23R'];
const RW_LO = '05L', RW_HI = '23R';
const THR = {}, CRS = {}, THR_ELEV = {};
for (const R of RWY_LIST) {
  THR[R.lo] = R.rm(R.thr[R.lo], 0); THR[R.hi] = R.rm(R.thr[R.hi], 0);
  CRS[R.lo] = brg(...R.rm(0), ...R.rm(R.len)); CRS[R.hi] = norm(CRS[R.lo] + 180);
  THR_ELEV[R.lo] = R.elev[R.lo]; THR_ELEV[R.hi] = R.elev[R.hi];
}
const T_LO = THR[RW_LO], T_HI = THR[RW_HI], CRS_LO = CRS[RW_LO], CRS_HI = CRS[RW_HI];
const crsOf = rw => CRS[rw] ?? CRS_HI;
const ELEV = EGCC.elev;
const ARP = LL(EGCC.arp);
const parallelOf = rw => ({ '05L': '05R', '05R': '05L', '23L': '23R', '23R': '23L' })[rw];
// no road crossing, no border fence, no rock
const XING_M = -1e9, XING_SKEW = 0, XING_HW = 0, xingM = o => XING_M;
const FRONTIER = [], R164 = [], ROCK = [], ROCK_TOP = [0, 0];
const TURN_W = R0.TURN_W, TURN_E = R0.TURN_E, TURN_END = R0.TURN_END, TURN_PAD = {};
const RWYS_BY_END = rw => RWY_LIST.find(R => R.lo === rw || R.hi === rw) || R0;

// ═════════════════════════ runway directions ═════════════════════════
const CFG = EGCC.CONFIGS;
const configOf = rw => ['23R', '23L'].includes(rw) ? 'west' : 'east';
const cfgNow = () => configOf(S.rwy);
// the landing and departure runways of a direction; either runway of the pair takes an arrival or a departure if the
// controller says so (the RNP approach to 23L, the ILS to 05L, departures off the landing runway)
const landOf = (c = cfgNow()) => CFG[c].land, depOf = (c = cfgNow()) => CFG[c].dep;

// ═════════════════════════ taxiways, holding points, stands (egcc-ground.js) ═════════════════════════
const inF0 = (e, n) => { const p = EN(e, n); return [mOf(p), offOf(p)]; };
for (const [id, e, n] of G.nodes) gn(id, ...inF0(e, n));
for (const [id, e, n] of G.rnodes) gn(id, ...inF0(e, n));
// the fifth field: which of the three lines of NA, NB and Z an edge is (b blue, o orange, c centre; x a crossover)
for (const [a, b, tw, mid, line] of G.edges) { const k = GE.length; chain(a, mid.map(([e, n]) => inF0(e, n)), b, tw); markLine(k, line); }
const HOLDS = {}, FIL = {};
for (const [k, [node, rwy, on, m, off, dirs, end, tw]] of Object.entries(G.holds)) {
  HOLDS[k] = { node, rwy, on, m, off, dirs: dirs.split(','), end: end || null, ref: k.replace(/~\d+$/, ''), tw };
  const Rh = RWY_LIST.find(R => R.id === on) || R0;            // hlink is m/off in its own runway's frame: carry it into R0's
  chain(rwy, (G.hlink[k] || []).map(([m, o]) => { const p = Rh.rm(m, o); return [mOf(p), offOf(p)]; }), node, HOLDS[k].ref);
  FIL[k] = { W: G.fil[k], E: G.fil[k] };                  // the mapped centreline-to-taxiway curve, used either way
}
// J1, the Juliet turning circle's hold at the 23R end (hot spot HS2: it faces the 23R approach), is that end's entry
if (HOLDS.J1) HOLDS.J1.end = '23R';
// the runway-holding positions: a path point there stops the aircraft until cleared onto or across the runway
for (const [id, rid] of Object.entries(G.hs)) if (GN[id]) GN[id].p.hs = rid;
// stands (AD 2-EGCC-2-2): Terminal 2 (Pier C 22-32, Pier 1 101-112, Pier 2 203-215, 301-308) and Terminal 3 (1-17 odd,
// 41-58) are the terminal stands; Terminal 2 remote (2-12 even), the West Apron (61-81, 113-116, 231-233) and the north-west
// remote stands 901-929 are towed to and from a terminal for long turnarounds
const STANDS = G.gates.map(([id, term, [e, n], node, hdg, line]) => { const p = EN(e, n), rem = term === 'R' || term === 'C';
  return { id, term, p, m: mOf(p), off: offOf(p), node, area: rem ? 'remote' : 'civil', occ: null, noLead: !line, h0: hdg,
    line: line ? line.map(([e, n]) => EN(e, n)) : null }; });
STANDS.forEach(s => { s.lp = GN[s.node].p; s.hdg = s.h0 ?? brg(...s.lp, ...s.p); });
// the mapped stand line ends where the nose stops: the stand's point is the aircraft's middle, set back from that end by
// the stop-bar distance of the largest aircraft the stand takes (as at Madrid)
{ const at = new Map();
  for (const t of STANDS) {
    const u = dirv(t.hdg); let lat = Infinity, near = Infinity;
    for (const o of STANDS) { if (o === t) continue;
      const dx = (o.p[0] - t.p[0])/M2NM, dy = (o.p[1] - t.p[1])/M2NM, al = dx*u[0] + dy*u[1], la = Math.abs(dx*u[1] - dy*u[0]);
      if (Math.abs(al) < 30 && la > 10) lat = Math.min(lat, la);
      if (la > 10 || Math.abs(al) > 10) near = Math.min(near, Math.hypot(dx, dy)); }
    const w = clamp(Math.min(isFinite(lat) ? lat : 38, near*1.1) - 1, 30, 82), sb = clamp(w + 6, 24, 80)*0.56 - 4;
    at.set(t, add(t.p, t.hdg + 180, Math.min(sb, Math.max(0, dist(...t.lp, ...t.p)/M2NM - 15))*M2NM));
  }
  for (const [t, p] of at) { t.p = p; t.m = mOf(p); t.off = offOf(p); } }
// The west remote ramp's drive-through lines (70-74 between E and D, 80 and 231 along NC) run across or along a
// taxiway, so a stop halfway along them put the aircraft on it. Each stand whose narrowbody (38 m long, 36 m across)
// would come within 12 m of a taxiway centreline slides along its line to the nearest spot at least 14 m clear (the
// most clear spot when there is none). LINK5 and NC, which run down the centre lines of the MARS groups 74, 80 and 231,
// don't count: they are dual function (AD 2-EGCC-2-1: TWY D between D9 and D10 and TWY NC) and close while the stands
// over them are in use.
const MARS_LANES = new Set(['NC', 'LINK5']);
{ const body = (c, h) => [add(c, h, 19*M2NM), add(c, h + 180, 19*M2NM), add(c, h - 90, 18*M2NM), add(c, h + 90, 18*M2NM)];
  for (const t of STANDS) {
    const u = t.hdg, end = add(t.lp, u, 100*M2NM);
    const lanes = GE.filter(e => !e.bare && !MARS_LANES.has(e.tw) && dist(...GN[e.a].p, ...GN[e.b].p) > 1e-7 && segDistM(t.p, GN[e.a].p, GN[e.b].p) < 150);
    const clr = c => { const [n, tl, wl, wr] = body(c, u); let m = Infinity; for (const e of lanes) { const a = GN[e.a].p, b = GN[e.b].p; m = Math.min(m, segSegM(n, tl, a, b), segSegM(wl, wr, a, b)); } return m; };
    if (clr(t.p) >= 12) continue;
    const r0 = dist(...t.lp, ...t.p)/M2NM; let best = null;
    for (let r = 22; r <= 95; r++) { const c = add(t.lp, u, r*M2NM), k = clr(c), sc = k >= 14 ? 1000 - Math.abs(r - r0) : k; if (!best || sc > best.sc) best = { sc, c }; }
    t.p = best.c; t.m = mOf(t.p); t.off = offOf(t.p);
  } }
const APRONS = G.aprons.map(r => r.map(([e, n]) => inF0(e, n)));
const TERM_NAME = { '2': 'Terminal 2', '3': 'Terminal 3', R: 'remote stands', C: 'north-west remote stands' };
// which side of each runway its exits are on (the side the taxiway system is): runway 1 has exits both sides
for (const R of RWY_LIST) { const o = Object.values(HOLDS).filter(H => H.on === R.id && !H.end).reduce((a, H) => a + Math.sign(H.off), 0); R.side = o >= 0 ? 1 : -1; }

// taxiway names: letters spoken one by one (VA1 "Victor Alfa 1"), digits as numbers; Link 1 to Link 5 by name
const NATO = { A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike',
  N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu' };
const twyWords = t => { const b = t.replace(/~\d+$/, ''), k = b.match(/^LINK(\d+)$/); return k ? 'Link ' + k[1] : (b.match(/[A-Z]|\d+/g) || [b]).map(x => NATO[x] || x).join(' '); };
const PHON = {};
for (const e of GE) if (e.tw && e.tw !== 'APRON' && !PHON[e.tw]) PHON[e.tw] = twyWords(e.tw);
for (const k of Object.keys(HOLDS)) PHON[k] = twyWords(k);
for (const [id] of G.ihps) PHON[id] = twyWords(id);
PHON.APRON = 'the apron';

// ── each aircraft's runway. A departure leaves from the departure runway, or from the runway its holding point is on
// when the controller taxied it to the landing runway; an arrival lands on the landing runway unless cleared for the other
const endHolds = rw => Object.keys(HOLDS).filter(k => HOLDS[k].end === rw);
// an intersection departure point for runway rw: a holding point along it (not at its end) whose way on reaches the
// centreline facing the way it departs, without doubling back, with at least 2,000 m of runway ahead (VA1 for 23L)
const LU_OK = new Map();
function luOk(k, rw){
  const ck = k + rw; if (LU_OK.has(ck)) return LU_OK.get(ck);
  const H = HOLDS[k], R = RWYS_BY_END(rw); let ok = false;
  if (H && H.on === R.id && !H.end) {
    const up = rw === R.lo, pts = [GN[H.node].p, ...holdLink(k), GN[H.rwy].p, ...filOut(k, up ? 'E' : 'W')], n = pts.length, m = R.mOf(pts[n-1]);
    ok = (up ? R.len - m : m) > 2000 && !doublesBack(pts) && Math.abs(angDiff(brg(...pts[n-2], ...pts[n-1]), crsOf(rw))) < 100;
  }
  LU_OK.set(ck, ok); return ok;
}
const routeLen = (from, to) => { const r = route(from, to); return r ? pathLen(r.nodes) : Infinity; };
const fromNode = ac => ac.stand && !ac.leftStand ? ac.stand.node : (nearestNode([ac.x, ac.y], n => !/^R/.test(n.id)) || {}).id;
function depRwyOf(ac){
  const dep = depOf(), land = landOf();
  if (ac.depRwy && (ac.cto || ac.depRwy === dep || ac.depRwy === land)) return ac.depRwy;
  if (ac.hp && HOLDS[ac.hp] && HOLDS[ac.hp].on === RWYS_BY_END(land).id && HOLDS[ac.hp].on !== RWYS_BY_END(dep).id) return land;
  return dep;
}
const landRwyOf = ac => landOf();

// departure entries: the holding points at the departure end of the aircraft's runway, nearest by taxi route (one
// multi-target search, routesFrom)
function depHold(ac){
  const rw = depRw(ac), from = fromNode(ac), ks = endHolds(rw).length ? endHolds(rw) : Object.keys(HOLDS).filter(k => luOk(k, rw));
  if (ks.length < 2 || !from) return ks[0];
  const rs = routesFrom(from, ks.map(k => HOLDS[k].node)); let best = ks[0], bl = Infinity;
  ks.forEach((k, i) => { const r = rs[i], L = r ? pathLen(r.nodes) : Infinity; if (L < bl) { bl = L; best = k; } });
  return best;
}
// nose-in stands: the tug pushes the tail back onto the taxilane, then 40 m along it the way the tail points
function laneDir(st, face){
  const tail = face === 'east' ? 270 : face === 'west' ? 90 : face === 'north' ? 180 : face === 'south' ? 0 : 90, lp = st.lp;
  const ways = waysOn(st.node); if (ways.length === 1) return norm(brg(...lp, ...GN[ways[0][0]].p) + 180);
  let best = null, bd = 999;
  for (const [v] of waysOn(st.node)) { const d = Math.abs(angDiff(brg(...lp, ...GN[v].p), tail)); if (d < bd) { bd = d; best = v; } }
  if (best && bd <= 60) return brg(...lp, ...GN[best].p);
  let fwd = null, fd = 999;
  for (const [v] of waysOn(st.node)) { const d = Math.abs(angDiff(brg(...lp, ...GN[v].p), tail + 180)); if (d < fd) { fd = d; fwd = v; } }
  return fwd && fd <= 60 ? norm(brg(...lp, ...GN[fwd].p) + 180) : best ? brg(...lp, ...GN[best].p) : tail;
}
function pushPath(ac, face){ const st = ac.stand; return [st.lp, add(st.lp, laneDir(st, face), 40*M2NM)]; }
// face the way the route to the runway starts
function pushRec(ac){
  const st = ac.stand, to = HOLDS[depHold(ac)].node;
  const len = f => { const r = route(st.node, to, undefined, norm(laneDir(st, f) + 180)); return r ? pathLen(r.nodes) : Infinity; };
  const E = len('east'), W = len('west');
  if (E < Infinity || W < Infinity) return E <= W ? 'east' : 'west';
  const r = route(st.node, to);
  if (!r || r.nodes.length < 2) return 'east';
  const b = brg(...st.lp, ...GN[r.nodes[1]].p), off = f => Math.abs(angDiff(norm(laneDir(st, f) + 180), b));
  return off('east') <= off('west') ? 'east' : 'west';
}
// exits for a landing runway: those the roll-out direction can turn into, in the order met; on runway 1 the terminal
// (north-west) side first, then the south side (to runway 2 and the crossings)
function exitsFor(rw){
  const R = RWYS_BY_END(rw), up = rw === R.lo, thr = R.thr[rw];
  const ks = Object.keys(HOLDS).filter(k => { const H = HOLDS[k]; return H.on === R.id && H.dirs.includes(rw) && (up ? H.m > thr + 700 : H.m < thr - 700); });
  const near = ks.filter(k => Math.sign(HOLDS[k].off) === R.side), far = ks.filter(k => Math.sign(HOLDS[k].off) !== R.side);
  const order = a => a.sort((x, y) => (HOLDS[x].m - HOLDS[y].m)*(up ? 1 : -1));
  return [...order(near), ...order(far)];
}
// a name the controller says ("VAC B1") to the exit of that taxiway on the aircraft's runway, ahead of it
function exitFor(ac, name){
  const rw = ac.app || landRw(ac), R = RWYS_BY_END(rw);
  if (HOLDS[name] && HOLDS[name].on === (ac.rwyId || R.id)) return name;
  const m = R.mOf([ac.x, ac.y]), dir = rw === R.lo ? 1 : -1;
  const ks = Object.keys(HOLDS).filter(k => (HOLDS[k].ref === name || HOLDS[k].tw === name) && HOLDS[k].on === R.id && (HOLDS[k].m - m)*dir > 20);
  return ks.sort((a, b) => (Math.sign(HOLDS[b].off) === R.side) - (Math.sign(HOLDS[a].off) === R.side) || (HOLDS[a].m - HOLDS[b].m)*dir)[0] || null;
}

// ═════════════════════════ aerodrome drawing ═════════════════════════
// taxiways 23 m (ICAO code E; code F routes for the A380); runways 45 m
const AD_SITE = { pave: { w: 23 }, aprons: APRONS, roads: [], buildings: [], twyExtra: [], shoulder: [0, RWY_M], serviceRoad: false, paag: [], floods: [], twyLabels: [], hotspots: [], labels: [] };
const TERM_LABELS = (() => { const by = {}; for (const s of STANDS) if (s.area === 'civil') (by[s.term] ||= []).push(s.p); return Object.entries(by).map(([t, ps]) => [TERM_NAME[t].toUpperCase(), ps.reduce((a, p) => [a[0] + p[0]/ps.length, a[1] + p[1]/ps.length], [0, 0])]); })();
// the lead-on and lead-off lines in map coordinates, worked out once (one per distinct fillet)
let LEADS = null;
const leadPts = () => LEADS || (LEADS = (() => { const seen = new Set(), out = [];
  for (const k in FIL) { const f = FIL[k].W, key = HOLDS[k].on + JSON.stringify(f); if (seen.has(key)) continue; seen.add(key);
    const R = rwyById(HOLDS[k].on); out.push(leadLine(f).map(p => R.rm(...p))); }
  return out; })());
function drawEgcc(){
  const sc = V.scale, mpx = sc/1852, IMG = mapImagery();
  const P2 = p => [sx(p[0]), sy(p[1])];
  const pathP = (pts, close = true) => { cx.beginPath(); pts.forEach((p, i) => cx[i ? 'lineTo' : 'moveTo'](...P2(p))); if (close) cx.closePath(); };
  const lw = m => Math.max(1, m*mpx);
  const rwyPoly = (R, w) => [R.rm(R.m0, -w/2), R.rm(R.m1, -w/2), R.rm(R.m1, w/2), R.rm(R.m0, w/2)];
  if (sc <= 70) { cx.fillStyle = rgba('rwyOut', .9); for (const R of RWY_LIST) { pathP(rwyPoly(R, Math.max(R.width, 2.2/mpx))); cx.fill(); } return; }
  cx.lineJoin = 'round'; cx.lineCap = 'round';
  // aprons, then taxiways (every graph edge), then the runways on top; over the street map the mapped aprons are there
  if (!IMG) {
    cx.fillStyle = C.concrete; for (const a of APRONS) { pathP(a.map(([m, o]) => rm(m, o))); cx.fill(); }
    cx.strokeStyle = C.concrete; cx.lineWidth = lw(60);
    for (const e of GE) { if (e.tw !== 'APRON') continue; pathP([GN[e.a].p, GN[e.b].p], false); cx.stroke(); }
    cx.lineWidth = lw(44); for (const s of STANDS) { pathP(s.line || [s.lp, s.p], false); cx.stroke(); }
    cx.strokeStyle = C.asphalt; cx.lineWidth = lw(23);
    for (const e of GE) { if (e.tw === 'APRON') continue; pathP([GN[e.a].p, GN[e.b].p], false); cx.stroke(); }
    for (const k in FIL) { const R = rwyById(HOLDS[k].on); pathP(FIL[k].W.map(([m, o]) => R.rm(m, o)), false); cx.stroke(); }
  } else {
    const lines = GE.filter(e => e.tw !== 'APRON').map(e => ({ pts: [P2(GN[e.a].p), P2(GN[e.b].p)], w: paveWidth(e.tw) }));
    for (const k in FIL) { const R = rwyById(HOLDS[k].on); lines.push({ pts: FIL[k].W.map(([m, o]) => P2(R.rm(m, o))), w: paveWidth() }); }
    drawPavement(lines, G.buildings.map(b => b.pts.map(([e, n]) => P2(EN(e, n)))), mpx);
  }
  cx.fillStyle = C.rwy;
  for (const R of RWY_LIST) { pathP(rwyPoly(R, R.width)); cx.fill(); }
  if (!IMG) { cx.fillStyle = C.bld; cx.strokeStyle = C.bldEdge; cx.lineWidth = 1; for (const b of G.buildings) { pathP(b.pts.map(([e, n]) => EN(e, n))); cx.fill(); cx.stroke(); } }
  if (sc > 150) {
    cx.fillStyle = C.paint; cx.strokeStyle = C.paint;
    for (const R of RWY_LIST) {
      const hw = R.width/2 - 1.5, quad = (m1, o1, m2, o2) => { pathP([R.rm(m1, o1), R.rm(m2, o1), R.rm(m2, o2), R.rm(m1, o2)]); cx.fill(); };
      cx.lineWidth = lw(0.9); pathP([R.rm(0, hw), R.rm(R.len, hw)], false); cx.stroke(); pathP([R.rm(0, -hw), R.rm(R.len, -hw)], false); cx.stroke();
      cx.setLineDash([30*mpx, 20*mpx]); pathP([R.rm(R.thr[R.lo] + 100, 0), R.rm(R.thr[R.hi] - 100, 0)], false); cx.stroke(); cx.setLineDash([]);
      // ICAO Annex 14: threshold stripes (12 on a 45 m runway), aiming point at 400 m, touchdown zone bars in threes, twos
      // and ones to 900 m, arrows down the centreline before each displaced threshold (05L, 23R and 23L)
      for (const [m0, dir] of [[R.thr[R.lo], 1], [R.thr[R.hi], -1]]) {
        quad(m0, -hw, m0 + dir*3, hw);
        for (let i = 0; i < 6; i++) for (const k of [-1, 1]) { const o = k*(3 + i*(hw - 3)/6); quad(m0 + dir*6, o, m0 + dir*36, o + k*1.8); }
        for (const k of [-1, 1]) quad(m0 + dir*400, k*7, m0 + dir*460, k*15);
        for (const [d, n] of [[150, 3], [300, 3], [600, 2], [750, 2], [900, 1]]) for (const k of [-1, 1]) for (let j = 0; j < n; j++) {
          const o = k*(7 + j*3); quad(m0 + dir*d, o, m0 + dir*(d + 22.5), o + k*1.8);
        }
        const pre = dir > 0 ? m0 : R.len - m0;
        if (pre > 60) {
          cx.lineWidth = lw(0.9);
          for (let d = 30; d < pre - 15; d += 60) { const m = m0 - dir*d; pathP([R.rm(m - dir*18, 0), R.rm(m, 0)], false); cx.stroke(); pathP([R.rm(m - dir*8, -3), R.rm(m, 0), R.rm(m - dir*8, 3)], false); cx.stroke(); }
          for (const k of [-1, 1]) { const m = m0 - dir*8; pathP([R.rm(m - dir*10, k*6), R.rm(m, k*10), R.rm(m - dir*10, k*14)], false); cx.stroke(); }
        }
      }
      for (const [rw, m0] of [[R.lo, R.thr[R.lo] + 60], [R.hi, R.thr[R.hi] - 60]]) drawRwyDesignator(...P2(R.rm(m0, 0)), rw, crsOf(rw), Math.max(9, 14*mpx));
    }
    // lead-on and lead-off lines: the mapped fillet curves carried over the runway to its centreline
    { const leads = leadPts().map(l => l.map(p => P2(p))); groundLines(lw(0.35), () => leads.forEach(strokeSmooth)); }
    // taxiway centrelines, stopping at the runway edges
    paintEdgeLines(lw(0.35));
    // runway holding positions (pattern A): two solid and two dashed lines across the taxiway, parallel to the runway
    for (const [id, rid] of Object.entries(G.hs)) {
      const n = GN[id]; if (!n) continue; const R = rwyById(rid), m = R.mOf(n.p), o = R.offOf(n.p), s = Math.sign(o);
      for (const [d, dash] of [[0.9, false], [0.3, false], [-0.3, true], [-0.9, true]]) { cx.setLineDash(dash ? [mpx + 1, mpx + 1] : []); pathP([R.rm(m - 11, o + s*d), R.rm(m + 11, o + s*d)], false); cx.stroke(); }
      cx.setLineDash([]);
    }
    // stand lead-in lines and numbers
    groundLines(lw(0.3), () => { for (const s of STANDS) if (!s.noLead) { pathP(s.line || [s.lp, s.p], false); cx.stroke(); } });
    if (IMG) { cx.save(); clipOut(G.buildings.map(b => b.pts.map(([e, n]) => P2(EN(e, n))))); drawStandDetail(null, null, mpx); cx.restore(); }   // stand paint stops at the terminal walls
    else if (sc > 600) { cx.fillStyle = rgba('lab', .8); cx.font = `600 ${Math.max(9, 4*mpx)}px ${FONT_L}`; for (const s of STANDS) { const [X, Y] = P2(s.p); cx.fillText(s.id, X + 3, Y - 3); } }
    drawGroundSigns();
  }
}
// lights and terminal names: drawn every frame over the airfield layer (in the dark theme the lights add their glow to
// what is under them, so they can't go in the layer)
function drawEgccTop(){
  const sc = V.scale, mpx = sc/1852, IMG = mapImagery();
  const P2 = p => [sx(p[0]), sy(p[1])];
  // the dual-function taxiway under a parked aircraft (NC through the MARS stands, LINK5 at 74) is closed: red dashes
  if (sc > 60 && typeof refreshShut === 'function') { refreshShut(); const shut = GE.filter(e => e.closed);
    if (shut.length) { cx.save(); cx.strokeStyle = 'rgba(214,40,40,.85)'; cx.lineWidth = Math.max(1.5, 0.8*mpx); cx.setLineDash([Math.max(4, 3*mpx), Math.max(3, 2*mpx)]);
      cx.beginPath(); for (const e of shut) { cx.moveTo(...P2(GN[e.a].p)); cx.lineTo(...P2(GN[e.b].p)); } cx.stroke(); cx.restore(); } }
  // lights: runway edges and thresholds (dark theme glow)
  if (sc > 110) {
    cx.save(); cx.globalCompositeOperation = C.glow;
    const r = Math.max(1.1, 0.9*mpx), glow = (p, col) => { const [X, Y] = P2(p); cx.fillStyle = col; cx.beginPath(); cx.arc(X, Y, r, 0, 7); cx.fill(); };
    for (const R of RWY_LIST) {
      const hw = R.width/2 + 0.5;
      for (let m = 0; m <= R.len; m += 60) { glow(R.rm(m, hw), 'rgba(255,244,214,.75)'); glow(R.rm(m, -hw), 'rgba(255,244,214,.75)'); }
      for (let o = -hw + 1; o <= hw - 1; o += 4) { glow(R.rm(R.thr[R.lo], o), 'rgba(90,255,140,.9)'); glow(R.rm(R.thr[R.hi], o), 'rgba(90,255,140,.9)'); }
    }
    cx.restore();
  }
  if (sc > 180 && sc < 2400) {
    cx.font = `600 12px ${FONT_L}`;
    if (IMG) { cx.fillStyle = C.name === 'dark' ? 'rgba(235,242,245,.92)' : '#fff'; cx.strokeStyle = 'rgba(0,0,0,.6)'; cx.lineWidth = 3; cx.lineJoin = 'round'; } else cx.fillStyle = rgba('lab', .72);
    for (const [t, p] of TERM_LABELS) { const [X, Y] = P2(p); if (IMG) cx.strokeText(t, X, Y); cx.fillText(t, X, Y); }
  }
}

// ═════════════════════════ fixes, STARs, SIDs ═════════════════════════
const DIR = EGCC.DIR, GATES = Object.keys(DIR);
const STAR_FIXES = new Set(Object.values(EGCC.STARS).flatMap(s => s.pts.map(p => p[0])));
const SID_ENDS = new Set(Object.values(EGCC.SIDS).map(s => s.pts[s.pts.length - 1][0]));
// the computed SID turn points and gates and the missed approach points are drawn small; the RNP approach fixes too
for (const [id, p] of Object.entries(EGCC.FIX)) if (!EGCC.NAV[id]) wp(id, p[0], p[1], STAR_FIXES.has(id) || SID_ENDS.has(id) || /^(TICZU|FECJO|EVAKU|NODUC|XOBRO|XUMAT|TABLY)$/.test(id) ? {} : { minor: true });
for (const id of Object.keys(EGCC.FIX)) if (/^(MC|PO|WA|HO|MA)\d/.test(id) || /^MC\d+[A-Z]?$/.test(id)) WP[id].hide = true;
for (const [id, n] of Object.entries(EGCC.NAV)) wp(id, ...n.p, { note: `${n.name} ${n.freq}` });
const RADAR_REF = ARP;
const STAR_OF = g => EGCC.STARS[DIR[g].star];
const starFrom = g => { const pts = STAR_OF(g).pts.map(p => p[0]); return pts.slice(Math.max(0, pts.indexOf(DIR[g].entry))); };
// the STAR holds (7-8) and their levels
for (const [id, h] of Object.entries(EGCC.HOLDS_AIR)) WP[id].hold = { inb: Math.round(h.inb), min: h.min, left: h.turn === 'L' };
const ENTRY = Object.fromEntries(GATES.map(g => [g, WP[DIR[g].entry].p]));
const ENTRY_ALT = Object.fromEntries(GATES.map(g => [g, DIR[g].alt]));
const PRE_ALT = Object.fromEntries(GATES.map(g => [g, DIR[g].alt + 12000]));
const HOLD_AT = Object.fromEntries(GATES.map(g => [g, STAR_OF(g).pts[STAR_OF(g).pts.length - 1][0]]));

// ── approaches: the ILS localiser from 3 NM outside the intermediate fix and the 3° glidepath from its altitude; 23L the
// RNP (LNAV/VNAV) from NODUC. The approach controller's "four miles" check: an arrival not visual goes around there.
const FINAL = {};
for (const [rw, I] of Object.entries(EGCC.ILS)) {
  const thr = THR[rw], out = norm(crsOf(rw) + 180), dIF = dist(...thr, ...WP[I.ifx].p), elev = THR_ELEV[rw], rnp = !!I.rnp, low = Math.round((elev + (rnp ? 1200 : 1000))/100)*100;
  const F = { pts: [add(thr, out, dIF + 3), add(thr, out, dIF), thr], alts: [I.ifAlt, I.ifAlt, elev + 50], elev, entry: I.ifx, entryName: I.ifx, name: (rnp ? 'RNP ' : 'ILS ') + rw, alt: I.ifAlt,
    decName: 'four miles', decNM: 4, decMin: 2.6, minAlt: low, minText: `${low.toLocaleString('en-GB')} ft`,
    mins: I.mins, minRate: 300, missed: [I.missed[0]], missAlt: I.missed[1],
    phrase: r => `cleared ${rnp ? 'RNP' : 'ILS'} approach runway ${r}`, read: r => `cleared ${rnp ? 'RNP' : 'ILS'} ${r}`,
    decCall: r => `${APT.tower[0]}, four miles, ${rnp ? 'RNP' : 'ILS'} runway ${r}`, decNeed: 'Four miles, needs landing clearance', decFail: 'not visual at the decision altitude' };
  F.cum = new Array(F.pts.length).fill(0); for (let i = F.pts.length - 2; i >= 0; i--) F.cum[i] = F.cum[i+1] + dist(...F.pts[i], ...F.pts[i+1]);
  const meet = (I.ifAlt - elev - 50)/318;                    // 3° = 318 ft per NM
  F.prof = [[0, elev + 50], [meet, I.ifAlt], [F.cum[0] + 1, I.ifAlt]];
  FINAL[rw] = F;
}
// ── from the STAR hold to the intermediate fix: a downwind and base laid out beside the final (hidden points, the
// vectors Manchester Director gives), so an arrival with no instructions still gets there
const FEED_ALT = {};
function feeder(rw, from){
  const I = EGCC.ILS[rw], thr = THR[rw], out = norm(crsOf(rw) + 180), dIF = dist(...thr, ...WP[I.ifx].p);
  const f = WP[from].p, dx = f[0] - thr[0], dy = f[1] - thr[1], ux = Math.sin(out*D2R), uy = Math.cos(out*D2R);
  const along = dx*ux + dy*uy, right = dx*uy - dy*ux, s = right >= 0 ? 1 : -1;
  const pt = (a, l) => add(add(thr, out, a), out + 90, l);
  // the downwind 1,000 ft above the intermediate fix, the base at its altitude
  const tag = `${rw}${s > 0 ? 'R' : 'L'}`, mk = (k, p, note) => { WP[tag + k] = { id: tag + k, p, hide: true, note }; FEED_ALT[tag + k] = I.ifAlt + (k === 'B' ? 0 : 1000); return tag + k; };
  if (along > dIF + 3 && Math.abs(right) < 2.5) return [I.ifx];
  const base = mk('B', pt(dIF + 4, s*3), `base for ${rw}`);
  if (along > dIF + 3) return [base, I.ifx];
  const dw2 = mk('D', pt(dIF + 3, s*7), `downwind for ${rw}`);
  if (along > 1) return [dw2, base, I.ifx];
  return [mk('A', pt(1, s*7), `downwind for ${rw}`), dw2, base, I.ifx];
}
const RWY_ENDS4 = ['23R', '23L', '05L', '05R'];
const ARR_ROUTE = Object.fromEntries(GATES.map(g => [g, Object.fromEntries(RWY_ENDS4.map(rw => {
  const star = starFrom(g);
  return [rw, [...star, ...feeder(rw, star[star.length - 1])]];
}))]));

// ── departures: a SID for each direction from each runway, flown from 500 ft to 5,000 ft (the transition altitude)
const sidName = (gate, rwy) => (DIR[gate] || DIR.S).sid[rwy || depRw()] || DIR.S.sid['23L'];
const sidSpoken = n => (EGCC.SIDS[n] || {}).spoken || n;
const sidTopOf = n => Math.max(...((EGCC.SIDS[n] || {}).pts || [[0, 5000]]).map(p => p[1] || 0));
const exitRoute = (g, rwy) => EGCC.SIDS[sidName(g, rwy)].pts.map(p => p[0]);
const EXIT_ROUTE = {}, EXIT_FIX = {};
for (const g of GATES) {
  Object.defineProperty(EXIT_ROUTE, g, { enumerable: true, get: () => exitRoute(g, depRw()) });
  Object.defineProperty(EXIT_FIX, g, { enumerable: true, get: () => { const r = exitRoute(g, depRw()); return r[r.length - 1]; } });
}
const NEXT_UNIT = Object.fromEntries(GATES.map(g => [g, EGCC.CTR[DIR[g].ctr]]));
const relUnit = ac => 'Scottish';
const TEL = EGCC.TEL;
const isMil = ac => false;
const gateFor = ap => EGCC.PLACE_DIR[ap] || 'S';

// ═════════════════════════ schedule ═════════════════════════
const withGate = x => ({ ...x, gate: x.gate || gateFor(x.k === 'ARR' ? x.o : x.d) });
const TIMETABLE = EGCC.TIMETABLE;
const REGS = { C56X: 'G-MANX', PC12: 'G-CCPC' };
const LONG_STAY = EGCC.LONG_STAY;
const EXTRA = EGCC.EXTRA.map(withGate);
const EXERCISES = Object.fromEntries(Object.entries(EGCC.EXERCISES).map(([k, e]) => ['r' + k, { ...e, sched: e.sched.map(withGate) }]));
const WX_PRESETS = EGCC.WX_PRESETS;

// ═════════════════════════ weather rules ═════════════════════════
// Atlantic westerlies off the Welsh hills and the Pennines bring turbulence and windshear on short final
const TURB_TABLE = {};
function turbExcess(w){
  if (w.vrb || w.spd < 15) return 0;
  return Math.max(0, Math.max(w.spd, (w.gust || 0)*0.85) - 25);
}
// ILS CAT I: 200 ft and RVR 550 m; the RNP to 23L: about 400 ft and 1,500 m
const minsOk = (w, rw) => { const m = (EGCC.ILS[rw] || EGCC.ILS['23R']).mins; return w.vis >= m.vis && w.ceil >= m.ceil; };
const sraMinsOk = w => minsOk(w, '23R');
// the direction: westerly (23) preferred for noise; easterly when the tailwind on 23 would exceed 5 kt
function rwyFor(w){
  if (w.vrb || w.spd < 4) return { land: '23R', dep: '23L' };
  const c = windComp(w, crsOf('23R'));
  return c.headG > -5 ? { land: '23R', dep: '23L' } : { land: '05R', dep: '05L' };
}
const depFor = rw => CFG[configOf(rw)].dep;
// the Peak District and the South Pennines east of the surveillance minimum altitude area (AD 2-EGCC-5-1, its 3,100 ft
// sector ends at 001 58W): Kinder Scout 2,087 ft, so nothing below 3,100 ft out there
const PENNINES = [[53.22, -1.97], [53.40, -1.97], [53.56, -1.99], [53.70, -1.98], [53.70, -1.70], [53.50, -1.68], [53.30, -1.70], [53.18, -1.80]].map(LL);

// ═════════════════════════ engine hooks ═════════════════════════
// the terminal an airline uses (Ryanair, British Airways, Loganair and Aer Lingus at Terminal 3, everyone else at
// Terminal 2); the two spill over into each other when full
const termOf = ac => EGCC.TERMINAL_OF[ac.cs.slice(0, 3)] || '2';
function standAt(ac, t){
  const free = STANDS.filter(s => standFree(s, ac) && s.term === t);
  return free[Math.floor(Math.random()*Math.min(free.length, 6))] || null;
}
const flowText = c => `land ${CFG[c].land}, depart ${CFG[c].dep}`;
const APT = {
  dualLanes: true,   // AD 2-EGCC-2-1: TWY D (D9 to D10) and TWY NC are dual function: closed under their stands while in use
  arrAlt: { ...arrAltOf(GATES.map(STAR_OF)), ...FEED_ALT, TICZU: 3500, NODUC: 3500, EVAKU: 3000, FECJO: 3000 },   // STAR levels, then the downwind, base and IF
  icao: 'EGCC', name: 'Manchester', coordName: 'Manchester', radarName: 'MAN', utcOff: 1,
  radar: [EGCC.UNITS.app.name, EGCC.UNITS.app.freq], depRadar: [EGCC.UNITS.app.name, EGCC.UNITS.app.freq],
  tower: [EGCC.UNITS.twr.name, EGCC.UNITS.twr.freq],
  gnd: [EGCC.UNITS.gnd.name, EGCC.UNITS.gnd.freq],
  runways: RWY_LIST, rwyHalfWidth: 22.5,
  ihps: G.ihps.map(([id, node]) => ({ id, node })),
  xing: false, drawnTown: false, ta: EGCC.TA, initClimb: 5000, gaAlt: 3500, appAlt: 3500, handoffNM: 12, climbFL: 150, divertAlt: 7000,
  area: { dep: 45, arr: 80, div: 45 }, roll: [70, RWY_M - 70], defRwy: '23R', defWx: 'west',
  appName: 'ILS approach', appShort: 'ILS', minsText: 'weather below the approach minima', reqApp: rw => (EGCC.ILS[rw] || {}).rnp ? 'RNP approach' : 'ILS approach',
  minsLong: 'Weather is below the ILS CAT I minima (200 ft and RVR 550 m).',
  liveName: 'Manchester Airport', liveThin: 22, atisFreq: EGCC.UNITS.atis.freq, turbName: 'Manchester',
  sessionHours: Array.from({ length: 17 }, (_, i) => i + 5),   // 0500Z to 2100Z: 06:00 to 22:00 in Manchester
  view: { app: [0, 0, 80], twr: [-0.15, -0.1, 3.2], gnd: [mOf(EN(-450, -400)), offOf(EN(-450, -400)), 4200, 3000] },
  minsOk,
  // the landing runway and the departure runway: S.rwy lands, S.depRwy departs
  splitRwy: true, rwyFor, depFor, configOf,
  rwyConfigs: ['west', 'east'].map(c => ({ key: c, name: CFG[c].name, land: CFG[c].land, lands: [CFG[c].land], deps: [CFG[c].dep] })),
  depRwyOf, landRwyOf,
  activeRwys: () => [landOf(), depOf()],
  depRwys: () => [depOf(), landOf()],
  appRwys: () => [landOf(), parallelOf(landOf())],
  // segregated parallel runways: a departure off one runway and an arrival on (or going around from) the other, both
  // close in, are separated by the missed-approach and SID turns (8-7 note 2: expedite the climb through 750 ft)
  sepOk: (a, b, d) => { const [x, y] = a.kind === 'DEP' ? [a, b] : [b, a];
    return x.kind === 'DEP' && y.kind === 'ARR' && x.depRwy && (y.app || y.gaRwy) && RWYS_BY_END(x.depRwy) !== RWYS_BY_END(y.app || y.gaRwy)
      && dist(x.x, x.y, ...ARP) < 6 && dist(y.x, y.y, ...ARP) < 6; },
  // the SID of the aircraft's own runway
  exitRouteOf: ac => exitRoute(ac.gate, ac.depRwy || depRw(ac)),
  // Manchester's SIDs are pre-coordinated with Scottish Control: no individual departure releases
  needRel: ac => false,
  sidAlt: ac => sidTopOf(ac.sid),
  // stands: the airline's terminal. Remote stands only for long turnarounds (towed in)
  remoteAreas: ['remote'],
  areaNames: { civil: 'terminal stands', remote: 'remote stands' },
  termName: t => (TERM_NAME[t] || 'Terminal ' + t).replace(/^./, c => c.toUpperCase()),
  remoteWord: s => 'remote stand',
  prefArea: ac => { const t = termOf(ac); return { key: t, name: TERM_NAME[t], has: s => s.term === t }; },
  standFor: ac => { const t = termOf(ac); return standAt(ac, t) || standAt(ac, t === '2' ? '3' : '2'); },
  // first descent: the STAR hold's level
  inboundAlt: g => HOLD_AT[g] === 'DAYNE' ? 8000 : 7000,
  divertTo: ac => ['N', 'NE', 'E', 'ESE'].includes(ac.gate) ? ['Leeds Bradford', 'POL'] : ['Liverpool', 'WAL'],
  firstAlt: g => ENTRY_ALT[g] - 2000,
  rolledCall: 'request taxi',
  vacExits: ac => { const rw = ac.app || landRw(ac), R = RWYS_BY_END(rw), m = R.mOf([ac.x, ac.y]), dir = rw === R.lo ? 1 : -1;
    return exitsFor(rw).filter(k => (HOLDS[k].m - m)*dir > 30).slice(0, 4); },
  vacPrefs: (st, ac) => exitsFor(ac && (ac.app || landRw(ac)) || S.rwy),
  exitFor,
  lineUpWords: hp => 'line up and wait',
  terrain: { name: 'the Pennines', poly: PENNINES, min: 3100, low: 2500, msg: ac => `${ac.cs} is over the Pennines at ${Math.round(ac.alt)} ft (Kinder Scout 2,087 ft, minimum 3,100 ft)${ac.alt < 2500 ? ', TERRAIN' : ''}.` },
  restricted: null,
  drawAirport: drawEgcc, drawAirportTop: drawEgccTop,
  gaEarly(ac, rw){},
  // missed approach: climb straight ahead to 3,500 ft; 23R turns right onto 355° after 750 ft, 05R right onto 185°
  gaTurn(ac){ const rw = ac.gaRwy, F = FINAL[rw] || FINAL['23R'], I = EGCC.ILS[rw] || EGCC.ILS['23R'];
    if (ac.alt > ELEV + 600 || dist(ac.x, ac.y, ...(THR[rw] || ARP)) > 3) { ac.gaTurn = true; ac.mode = 'NAV'; ac.route = F.missed.slice(); ac.turnDir = I.turn; ac.tgtAlt = ac.cleared = Math.max(ac.cleared || 0, F.missAlt); } },
  // conventional SIDs flown by RNAV substitution: straight ahead on the runway track, then the route from 500 ft
  liftoff(ac){ ac.tgtHdg = Math.round(crsOf(ac.depRwy)); ac.turnDir = 0; },
  depTurn(ac){ if (!ac.turned && ac.alt >= ELEV + 500) ac.turned = true; },
  depClear: ac => !!ac.turned,
  shear(ac, rw, w){ return turbExcess(w) > 4 && Math.random() < 0.2 ? 'windshear on short final' : null; },
  shearWhy: rw => 'windshear on short final',
  faceHold: (st, f) => depHold({ stand: st, leftStand: false, x: st.p[0], y: st.p[1] }),
  faceWord: f => f,
  faceHdg: (st, f) => norm(laneDir(st, f) + 180),          // taxilanes run every way here: name the face by the compass
  // the departure-end holding points of the aircraft's runway nearest it, the intersection departure points, then the
  // landing runway's end (single-runway operation)
  taxiHolds: (south, ac) => { const rw = ac ? depRw(ac) : depRw(), p = ac ? (ac.stand && !ac.leftStand ? ac.stand.lp : [ac.x, ac.y]) : ARP;
    const near = ks => ks.sort((a, b) => dist(...p, ...GN[HOLDS[a].node].p) - dist(...p, ...GN[HOLDS[b].node].p));
    const other = [depOf(), landOf()].find(r => r !== rw), rec = ac && depHold(ac);
    const isx = near(Object.keys(HOLDS).filter(k => luOk(k, rw))).filter((k, i, a) => a.findIndex(j => HOLDS[j].node === HOLDS[k].node) === i);
    return [...new Set([rec, ...near(endHolds(rw)).slice(0, 2), ...isx.slice(0, 2), ...near(endHolds(other)).slice(0, 1)].filter(Boolean))].slice(0, 6); },
  luOk: (k, rw) => luOk(k, rw),
  taxiHint: rw => ({ '23L': 'Runway 23L departures cross runway 1 (23R) at Bravo Zulu 1, Delta Zulu 1, Foxtrot Zulu 1 or Hotel Zulu 1, then enter at Tango 1 or Victor Alfa 1.',
    '05L': 'Runway 05L departures taxi along Alfa to Alfa 1 at the south-west end.',
    '23R': 'Runway 23R departures enter at Juliett 1, by the Juliet turning circle (hot spot: it faces the 23R approach).',
    '05R': 'Runway 05R has no full-length taxiway: departures backtrack from the north-east end.' })[rw] + ' The crew lines up straight onto the runway.',
  // medical diversions: flights crossing the north of England
  diverts: [{ cs: 'EIN154', t: 'A20N', o: 'EIDW', gate: 'W', to: 'Amsterdam' }, { cs: 'KLM1281', t: 'B738', o: 'EHAM', gate: 'E', to: 'Dublin' },
    { cs: 'BAW1436', t: 'A320', o: 'EGLL', gate: 'S', to: 'Glasgow' }, { cs: 'ICE454', t: 'B38M', o: 'BIKF', gate: 'N', to: 'London' }],
  airports: EGCC.AIRPORTS, via: {},
  airlineIcao: EGCC.AIRLINE_ICAO, airlineType: EGCC.AIRLINE_TYPE, defType: 'A320',
  placeIcao: EGCC.PLACES,
  // UK phraseology (CAP 413) from the engine, with Manchester's own: the SID's 5,000 ft stop altitude in the clearance,
  // start-up and push from Manchester Ground
  phr: {
    push: (ac, dn, face) => { const top = sidTopOf(ac.sid);
      return [`cleared to ${dn} via ${sidSpoken(ac.sid)} departure, runway ${depRw(ac)}, climb ${altWords(top)}, squawk ${ac.sqk}, start-up and push back approved, facing ${faceSay(ac, face)}, QNH ${S.wx.qnh}`,
        `cleared ${dn}, ${sidSpoken(ac.sid)}, runway ${depRw(ac)}, altitude ${altShort(top)}, squawk ${ac.sqk}, start and push approved facing ${faceSay(ac, face)}, QNH ${S.wx.qnh}`]; },
    startReq: ac => `${EGCC.UNITS.gnd.name}, stand ${ac.stand.id}, ${ac.perf.name} to ${AP[ac.d] ? AP[ac.d][2] : ac.d}, information ${phonetic(S.atis)}, request start-up and push back`,
    checkIn: ac => `${APT.radar[0]}, ${greet()}, ${altShort(Math.round(ac.alt/100)*100)} descending ${altShort(ac.tgtAlt)}, ${DIR[ac.gate] ? DIR[ac.gate].star.replace(/ (\d)([A-Z])$/, ' $1 $2') + ' arrival' : 'inbound ' + ac.route[0]}, information ${phonetic(S.atis)}`,
    vacated: ac => `${EGCC.UNITS.gnd.name}, runway ${rwyName(ac.rwyId)} vacated via ${PHON[ac.exit] || ac.exit.replace(/~\d+$/, '')}, request taxi${ac.stand ? ' to stand ' + ac.stand.id : ''}`,
    taxiIn: (ac, st, vw) => { const k = xingAhead(ac), hs = k >= 0 ? `, hold short runway ${rwyName(ac.path.pts[k].hs)}` : '', via = vw.length ? ' via ' + vw.map(t => PHON[t] || t).join(', ') : '';
      return [`taxi to stand ${st.id}${via}${hs}`, `stand ${st.id}${via}${hs}`]; },
    taxiHold: (ac, h, vw) => { const via = vw.length ? ' via ' + vw.map(t => PHON[t] || t).join(', ') : '', r = h.rwy ? rwyName(HOLDS[h.id].on) : null, at = hpWords(h.id);
      return r ? [`taxi to holding point ${at}${via}, hold short runway ${r}`, `holding point ${at}${via}, holding short ${r}`] : [`taxi to holding point ${at}${via}`, `holding point ${at}${via}`]; },
    atHoldPt: (ac, h) => h.rwy ? `holding short runway ${rwyName(HOLDS[h.id].on)} at ${hpWords(h.id)}` : `holding at ${hpWords(h.id)}`
  },
  atisPanel(w){
    const c = cfgNow(), cw = Math.abs(windComp(w, crsOf(S.rwy)).crossG), bad = !minsOk(w, S.rwy), r = rwyFor(w);
    return `<div class="warnline${bad ? ' bad' : ''}">${CFG[c].name}: ${flowText(c)}${configOf(r.land) !== c ? ` (wind favours the ${CFG[configOf(r.land)].name.toLowerCase()} direction)` : ''} · ${bad ? 'below the ILS minima' : 'ILS approaches'} · crosswind ${Math.round(cw)} kt. ${c === 'west' ? 'Departures cross runway 1 at the Zulu holding points to reach 23L.' : 'Arrivals off 05R cross runway 1 to the terminals.'}</div>`;
  },
  atisLines({ w, L, E, wind, vis, cloud }){
    const c = cfgNow();
    const out = [
      `This is Manchester information ${L}, time ${zt(S.t).slice(0,5).replace(':', '')}.`,
      `Runways in use: landing ${CFG[c].land}, departures ${CFG[c].dep}. ILS approach runway ${CFG[c].land}.`,
      `Surface wind ${wind}. Visibility ${vis}. ${cloud}.`,
      `Temperature ${w.temp}, dew point ${w.dew}. QNH ${w.qnh} hectopascals. Transition level ${w.qnh < 977 ? 'flight level 80' : w.qnh < 1013 ? 'flight level 70' : 'flight level 60'}.`
    ];
    if (turbExcess(w) > 0) out.push('Moderate turbulence and windshear reported on final.');
    if (E && E.ws) out.push(`Windshear reported on final runway ${E.ws.rw} at ${zt(E.ws.t).slice(0,5).replace(':', '')}, ${E.ws.text}.`);
    if (E && E.rwyBlock) out.push(`Runway ${S.rwy} closed: ${E.rwyBlock.why}. Expect delays.`);
    if (!minsOk(w, S.rwy)) out.push('Visibility below the ILS minima. Expect holding at ROSUN, MIRSI or DAYNE.');
    out.push(c === 'west' ? 'Runway 23R is crossed by taxiing traffic for 23L: hold short unless cleared to cross.' : 'Runway 05L is crossed by traffic vacating 05R: hold short unless cleared to cross.');
    out.push('Hot spots: hold Juliett 1 faces the 23R approach; complex junctions at Delta, Echo and Papa by the fire station.');
    out.push(`Acknowledge receipt of information ${L} and advise aircraft type and stand on first contact.`);
    return out;
  },
  // the website: home hero, previews, scenario cards and Academy figures
  site: {
    hero: () => [
      ['EXS272', 53.45, -2.10, 231, 170, PAL.light.arr], ['EZY1916', 53.55, -2.25, 180, 210, PAL.light.arr], ['RYR3564', 53.30, -2.60, 60, 220, PAL.light.arr],
      ['KLM1072', 53.27, -2.45, 270, 220, PAL.light.dep], ['UAE18', 53.38, -2.45, 345, 240, PAL.light.dep],
      ['BAW1386', 53.10, -2.20, 170, 380, 'rgba(60,75,95,.7)'], ['EIN154', 53.40, -3.20, 90, 430, 'rgba(60,75,95,.7)'], ['DLH941', 53.70, -1.70, 110, 420, 'rgba(60,75,95,.7)']
    ],
    demo(mk, park){
      const fin = add(THR['23R'], CRS['05L'], 2.6), out = add(THR['23L'], CRS['23L'], 3.5), inb = add(WP.ROSUN.p, 170, 5);
      const hk = endHolds('23L')[0], hp = GN[HOLDS[hk].node].p;
      const st = id => (STANDS.find(s => s.id === id) || STANDS.find(s => s.term === '2')).id;
      return [
        mk('RYR2232', 'B38M', 'DEP', park(st('43'), { need: null, reqAt: 99999 })), mk('EXS242', 'B738', 'DEP', park(st('25'), { need: null, reqAt: 99999 })),
        mk('KLM1072', 'E190', 'DEP', park(st('207'), { need: null, reqAt: 99999 })), mk('UAE18', 'A388', 'DEP', park(st('211'), { need: null, reqAt: 99999 })),
        mk('EZY1952', 'A320', 'DEP', { ground: true, state: 'HOLDPT', hp: hk, x: hp[0], y: hp[1], hdg: CRS['23L'], gs: 0 }),
        mk('EXS272', 'B738', 'ARR', { state: 'FINAL', mode: 'FINAL', app: '23R', freq: 'TWR', x: fin[0], y: fin[1], hdg: CRS['23R'], alt: ELEV + 830, gs: 145, vs: -750, o: 'LEPA' }),
        mk('TOM2164', 'B38M', 'DEP', { state: 'CLIMB', x: out[0], y: out[1], hdg: CRS['23L'], alt: ELEV + 2500, gs: 200, vs: 2000, tgtAlt: 5000, d: 'LEPA' }),
        mk('EZY1916', 'A21N', 'ARR', { state: 'INBOUND', x: inb[0], y: inb[1], hdg: 170, alt: 8000, gs: 250, vs: -1000, tgtAlt: 7000, o: 'GCTS' })
      ];
    },
    thumb(k, zoom, W){
      if (k === 'app') return v => { v.scale *= 1.3; };
      if (k === 'twr') { const c = EN(-300, -250); return v => { v.cx = c[0]; v.cy = c[1]; v.scale = W/3.0; }; }
      const s = STANDS.find(s => s.id === '43') || STANDS[0], c = zoom === 'apron' ? s.p : EN(-200, 150);
      return v => { v.cx = c[0]; v.cy = c[1]; v.scale = W/((zoom === 'apron' ? 700 : 3000)*M2NM); };
    },
    figHold: 'ROSUN', emergHp: 'A1',
    figConsole: v => { v.scale *= 1.2; },
    cmdHint: 'Command, e.g. EXS272 H200 A40 · RYR2232 TAXI T1 · RYR2232 CROSS · / to focus, Tab cycles flights'
  }
};
// maintenance hangars (OpenStreetMap): Swissport maintenance by the Western Maintenance area. Aircraft stored there at the
// start of a session are towed to a stand at their airline's terminal an hour before departure; the door is the nearest
// taxilane node.
APT.hangars = [[-543, 507, 'Western Maintenance hangar']]
  .map(([e, n, name]) => [e, n, name, (nearestNode(EN(e, n).map((v, i) => v), nd => !/^R|^x/.test(nd.id)) || {}).id])
  .filter(([, , , node]) => node && GN[node])
  .map(([e, n, name, node], i) => ({ id: 'H' + (i + 1), name, in: inF0(e, n), door: [GN[node].m, GN[node].off], node, to: ['civil'], fits: ac => ac.perf.wake !== 'H', pick: ac => APT.standFor(ac) }));
