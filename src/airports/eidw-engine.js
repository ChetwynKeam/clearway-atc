// ═════════════════════════ Dublin (EIDW) airport profile for the engine ═════════════════════════
// Builds every global the engine reads from the chart data in eidw.js (EIDW) and the OpenStreetMap aerodrome in
// eidw-ground.js (metres east and north of the ARP). Dublin has three runways: the parallel pair 10R/28L (south) and
// 10L/28R (north, 1.6 km apart, so independent) and 16/34, which crosses the north runway near its 16 end and shares
// the 28L/34 end with the south runway (hot spot HS1). S.rwy is the landing runway and S.depRwy the departure runway:
// by day in the westerly arrivals land on 28L and departures leave from 28R, in the easterly they land on 10L and leave
// from 10R; the North Runway is shut from 23:00 to 07:00 local, when the south runway does everything; 16/34 runs alone
// in strong northerly or southerly winds. Arrivals come in on the RNAV STARs, whose 28 and 10 versions end in the point
// merge arcs: each arrival flies its arc level until Dublin Approach sends it direct to the merge point (DCT PIZSA).
// Departures fly the RNAV SID of their runway and their category: CAT A/B propellers turn after 750 ft, CAT C/D jets
// fly straight ahead to 5 NM.
Object.assign(TYPES, EIDW.TYPES);
const LL = p => xy(p[0], p[1]);
const G = EIDW_GROUND;
const EN = (e, n) => [e*M2NM, n*M2NM];                     // metres east and north of the ARP (the map origin) → NM

// ═════════════════════════ runways ═════════════════════════
// a frame along each runway: m from the pavement end a (the low-numbered end), off to the left. m0/m1 take in the
// stopways (56 m before 10R, 91 m beyond 28L: aerodrome chart) and the entries beyond the ends (S7, E1)
const STOPWAY = { '10R28L': [56, 91] };
function rwyFrame(r){
  const a = EN(...r.a), b = EN(...r.b), L = dist(...a, ...b), RU = [(b[0]-a[0])/L, (b[1]-a[1])/L], RN = [-RU[1], RU[0]];
  const rm = (m, off=0) => [a[0] + (RU[0]*m + RN[0]*off)*M2NM, a[1] + (RU[1]*m + RN[1]*off)*M2NM];
  const mOf = p => ((p[0]-a[0])*RU[0] + (p[1]-a[1])*RU[1])/M2NM, offOf = p => ((p[0]-a[0])*RN[0] + (p[1]-a[1])*RN[1])/M2NM;
  const len = r.len, sw = STOPWAY[r.id] || [0, 0];
  const TURN_W = [[30, 0]], TURN_E = [[len - 30, 0]];       // no turning pads: every entry is at or near the runway end
  return { id: r.id, lo: r.lo, hi: r.hi, len, m0: -sw[0], m1: len + sw[1], thr: r.thr, elev: r.elev, rm, mOf, offOf, RU, TURN_W, TURN_E, TURN_END: { W: 30, E: len - 30 },
    roll: [70, len - 70], ends: true, width: 45 };
}
// 10R/28L first: it is the runway the engine falls back on (and runs everything at night)
const RWY_LIST = ['10R28L', '10L28R', '1634'].map(id => rwyFrame(G.runways.find(r => r.id === id)));
const R0 = RWY_LIST[0];
const rm = R0.rm, mOf = R0.mOf, offOf = R0.offOf, RU = R0.RU;
const RWY_M = R0.len, THR_LO_M = R0.thr['10R'], THR_HI_M = R0.thr['28L'];
const RW_LO = '10R', RW_HI = '28L';
const THR = {}, CRS = {}, THR_ELEV = {};
for (const R of RWY_LIST) {
  THR[R.lo] = R.rm(R.thr[R.lo], 0); THR[R.hi] = R.rm(R.thr[R.hi], 0);
  CRS[R.lo] = brg(...R.rm(0), ...R.rm(R.len)); CRS[R.hi] = norm(CRS[R.lo] + 180);
  THR_ELEV[R.lo] = R.elev[R.lo]; THR_ELEV[R.hi] = R.elev[R.hi];
}
const T_LO = THR[RW_LO], T_HI = THR[RW_HI], CRS_LO = CRS[RW_LO], CRS_HI = CRS[RW_HI];
const crsOf = rw => CRS[rw] ?? CRS_HI;
const ELEV = EIDW.elev;
const ARP = LL(EIDW.arp);
const parallelOf = rw => ({ '10L': '10R', '10R': '10L', '28L': '28R', '28R': '28L' })[rw];
const XING_M = -1e9, XING_SKEW = 0, XING_HW = 0, xingM = o => XING_M;
const FRONTIER = [], R164 = [], ROCK = [], ROCK_TOP = [0, 0];
const TURN_W = R0.TURN_W, TURN_E = R0.TURN_E, TURN_END = R0.TURN_END, TURN_PAD = {};
const RWYS_BY_END = rw => RWY_LIST.find(R => R.lo === rw || R.hi === rw) || R0;

// ═════════════════════════ the clock: local time and the North Runway's hours ═════════════════════════
// Irish time is UTC in winter and UTC+1 from the last Sunday of March to the last Sunday of October (as in London)
const lastSun = (y, mo) => { const d = new Date(Date.UTC(y, mo + 1, 0)); return Date.UTC(y, mo, d.getUTCDate() - d.getUTCDay(), 1); };
const dubOff = ms => { const y = new Date(ms).getUTCFullYear(); return ms >= lastSun(y, 2) && ms < lastSun(y, 9) ? 60 : 0; };
function clockMs(){
  if (S.running && S.start) return S.start + S.t*1000;
  const ts = document.getElementById('trafficSel'), mode = ts ? ts.value : '';
  if (EXERCISES[mode]) return null;
  if (/^live/.test(mode)) return Date.now();
  const d = +((document.getElementById('daySel') || {}).value || 0), h = +((document.getElementById('hourSel') || {}).value || 12);
  return Date.UTC(2026, 9, 5 + d, Math.floor(h));
}
// minutes past local midnight, or null (an exercise has no clock)
const localMin = () => { const t = clockMs(); if (t == null) return null; const L = new Date(t + dubOff(t)*60000); return L.getUTCHours()*60 + L.getUTCMinutes(); };
const northOpen = () => { const m = localMin(); return m == null || (m >= EIDW.RWY.northHours[0]*60 && m < EIDW.RWY.northHours[1]*60); };

// ═════════════════════════ runway directions ═════════════════════════
const CFG = EIDW.CONFIGS;
const configOf = rw => ({ '28L': 'west', '28R': 'west', '10L': 'east', '10R': 'east', '16': 'n16', '34': 's34' })[rw] || 'west';
const cfgNow = () => configOf(S.rwy);
// the runway an arrival lands on and the one departures use: the flow's (west: 28L and 28R; east: 10L and 10R), the
// south runway alone at night, 16/34 alone
const landOf = () => S.rwy;
const depFor = rw => { const c = configOf(rw); if (c === 'n16' || c === 's34') return rw;
  if (!northOpen()) return c === 'west' ? '28L' : '10R';
  return { '28L': '28R', '28R': '28L', '10L': '10R', '10R': '10L' }[rw]; };
const depOf = () => S.depRwy || depFor(S.rwy);
// by the wind: 10/28 whenever the crosswind is 25 kt or less (16/34 is the crosswind runway, used only in strong northerly
// or southerly winds), westerly unless the tailwind on 28 is over 5 kt; the North Runway only from 07:00 to 23:00
function rwyFor(w){
  const day = northOpen(), calm = w.vrb || w.spd < 4;
  const c28 = windComp(w, crsOf('28L')), c34 = windComp(w, crsOf('34')), c16 = windComp(w, crsOf('16'));
  if (!calm && Math.abs(c28.crossG) > 25 && Math.max(c34.headG, c16.headG) > 15) { const r = c34.headG >= c16.headG ? '34' : '16'; return { land: r, dep: r }; }
  const east = !calm && c28.headG < -5;
  if (!day) return east ? { land: '10R', dep: '10R' } : { land: '28L', dep: '28L' };
  return east ? { land: '10L', dep: '10R' } : { land: '28L', dep: '28R' };
}
// at 07:00 the North Runway opens (departures move to 28R or 10L lands), at 23:00 it shuts and the south runway takes
// everything (an arrival to 10L by then is put on 10R)
let northWas = null;
function stepNorth(){
  if (!S.running || EXERCISES[S.mode] || S.rops) { northWas = null; return; }
  const open = northOpen();
  if (northWas !== null && open !== northWas) {
    const c = cfgNow();
    if (c === 'west' || c === 'east') {
      const land = open ? (c === 'west' ? '28L' : '10L') : (c === 'west' ? '28L' : '10R');
      if (land !== S.rwy) setRwy(land);
      else { S.depRwy = depFor(S.rwy); nextAtis(false); renderAtis(); emit('rwy', S.rwy); }
      sys(open ? `07:00 local: the North Runway (10L/28R) opens. ${c === 'west' ? 'Land 28L, depart 28R.' : 'Land 10L, depart 10R.'}`
               : `23:00 local: the North Runway (10L/28R) closes for the night. Runway ${S.rwy} for landing and departure.`);
    }
  }
  northWas = open;
}

// ═════════════════════════ taxiways, holding points, stands (eidw-ground.js) ═════════════════════════
const inF0 = (e, n) => { const p = EN(e, n); return [mOf(p), offOf(p)]; };
for (const [id, e, n] of G.nodes) gn(id, ...inF0(e, n));
for (const [id, e, n] of G.rnodes) gn(id, ...inF0(e, n));
for (const [a, b, tw, mid] of G.edges) chain(a, mid.map(([e, n]) => inF0(e, n)), b, tw);
const HOLDS = {}, FIL = {};
for (const [k, [node, rwy, on, m, off, dirs, end]] of Object.entries(G.holds)) {
  HOLDS[k] = { node, rwy, on, m, off, dirs: dirs.split(',').filter(Boolean), end: end || null, ref: k.replace(/~\d+$/, '') };
  HOLDS[k].base = ((G.hside || {})[HOLDS[k].ref] || [])[0];   // S1W: on taxiway S1, before runway 34
  { const Rh = RWY_LIST.find(R => R.id === on) || RWY_LIST[0];   // the bend between the runway edge and the holding point (hlink, in its runway's frame)
    chain(rwy, ((G.hlink || {})[k] || []).map(([mm, oo]) => { const p = Rh.rm(mm, oo); return [mOf(p), offOf(p)]; }), node, HOLDS[k].base || HOLDS[k].ref); }
  FIL[k] = { W: G.fil[k], E: G.fil[k] };
}
for (const [id, rid] of Object.entries(G.hs)) if (GN[id]) GN[id].p.hs = rid;
// stands (AD 2.24-2 and its stand table): Pier 1 (121-127) with the North Apron in front of it (105-114), Pier 2
// (200-223), Pier 3 (311-318), Pier 4 at Terminal 2 (400-409), and the remote South Apron (411-418), North Apron by
// Hangar 6 (131-145, 50-54) and West Apron (600s). Each takes nothing wider than the AIP's wingspan for it; the L/C/R
// stands overlap (107C is the widebody stand over 107L and 107R) and the engine keeps them apart by their size.
// L1-L3 by the West Apron hangars are tow on and off only: not allocated.
const AREA_OF = { P1: 'civil', P2: 'civil', P3: 'civil', P4: 'civil', N: 'remote', S: 'remote', W: 'remote' };
const STANDS = G.gates.filter(g => g[7] !== 'TT').map(g => { const [id, term, [e, n], node] = g, p = EN(e, n), sp = +g[6] || null;
  return { id, term, p, m: mOf(p), off: offOf(p), node, area: AREA_OF[term] || 'remote', occ: null, noLead: !g[5], line: g[5] ? g[5].map(([x, y]) => EN(x, y)) : null,
    use: g[7], h0: g[4], ...(sp ? { maxSpan: Math.round(sp*10)/10 } : {}) }; });
// the AIP gives the nose position: the aircraft's middle is set back along the lead-in by half the length of the largest
// type the stand takes (never more than 40% of the lead-in)
STANDS.forEach(s => { s.lp = GN[s.node].p; const L = dist(...s.lp, ...s.p)/M2NM, half = s.maxSpan ? Math.min(34, Math.max(11, s.maxSpan*0.52)) : 20, k = Math.min(half, L*0.4);
  if (L > 12) { const u = [(s.lp[0] - s.p[0])/(L*M2NM), (s.lp[1] - s.p[1])/(L*M2NM)]; s.p = [s.p[0] + u[0]*k*M2NM, s.p[1] + u[1]*k*M2NM]; s.m = mOf(s.p); s.off = offOf(s.p); }
  s.hdg = L > 3 ? brg(...s.lp, ...s.p) : (s.h0 ?? 0); });
const APRONS = G.aprons.map(r => r.map(([e, n]) => inF0(e, n)));
// which side of each runway the terminals are
{ const civ = STANDS.filter(s => s.area === 'civil'), c = civ.reduce((a, s) => [a[0] + s.p[0]/civ.length, a[1] + s.p[1]/civ.length], [0, 0]); for (const R of RWY_LIST) R.side = Math.sign(R.offOf(c)) || 1; }

// taxiway names as the AIP says them: Link 1 to Link 7, F-Inner and F-Outer, Delta North and Delta South, Apron
// Taxiway 1 to 6; the rest letter by letter with the digits as numbers (N2 "November 2")
const NATO = { A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike',
  N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu' };
const SPECIAL_TW = { FINNER: 'Foxtrot Inner', FOUTER: 'Foxtrot Outer', DN: 'Delta North', DS: 'Delta South', VENUS: 'Venus', NEPTUNE: 'Neptune', Venus: 'Venus', Neptune: 'Neptune' };
const twyWords = t => { const b = t.replace(/~\d+$/, ''); if (SPECIAL_TW[b]) return SPECIAL_TW[b];
  let k = b.match(/^LINK(\d+)$/); if (k) return 'Link ' + k[1];
  k = b.match(/^AT(\d+)$/); if (k) return 'Apron Taxiway ' + k[1];
  k = b.match(/^IHP(\d+)$/); if (k) return 'holding point ' + k[1];
  return (b.match(/[A-Z]|\d+/g) || [b]).map(x => NATO[x] || x).join(' '); };
const PHON = {};
for (const e of GE) if (e.tw && e.tw !== 'APRON' && !PHON[e.tw]) PHON[e.tw] = twyWords(e.tw);
for (const k of Object.keys(HOLDS)) PHON[k] = twyWords(k);
for (const [id] of G.ihps || []) PHON[id] = twyWords(id);
for (const [k, [ref, w]] of Object.entries(G.hside || {})) { PHON[k] = twyWords(ref) + (w ? ', ' + w : ''); for (const v of Object.keys(HOLDS)) if (HOLDS[v].ref === k) PHON[v] = PHON[k]; }
PHON.APRON = 'the apron';

// ── departure entries: the holding points at the departure end of a runway (the aerodrome chart's, eidw_ground.py:
// 10L N7 and N6, 28R N1 and N2, 10R S7, 28L E1, 34 B2, 16 at N), then intersection departures with at least 1,800 m ahead
const endHolds = rw => Object.keys(HOLDS).filter(k => HOLDS[k].end === rw);
const INTX_MIN = 1800;
const intxRun = (k, rw) => { const H = HOLDS[k], R = rwyById(H.on), m = R.mOf(GN[H.rwy].p); return rw === R.lo ? R.len - m : m; };
const intxWay = (k, rw) => { const R = rwyById(HOLDS[k].on), f = FIL[k].W, a = f[f.length-1], b = f[0], dm = b[0] - a[0], L = Math.hypot(dm, b[1] - a[1]);
  return !L || dm*(rw === R.lo ? 1 : -1)/L >= -0.17; };
const intxHolds = rw => { const R = RWYS_BY_END(rw);
  return Object.keys(HOLDS).filter(k => { const H = HOLDS[k], q = GN[H.rwy].p;
    return H.on === R.id && !H.end && intxWay(k, rw) && intxRun(k, rw) >= INTX_MIN
      && RWY_LIST.every(O => O === R || Math.abs(O.offOf(q)) > 100 || O.mOf(q) < -100 || O.mOf(q) > O.len + 100); })
    .sort((a, b) => intxRun(b, rw) - intxRun(a, rw)); };
const depHolds = rw => [...endHolds(rw), ...intxHolds(rw)];
const depHoldAs = (ac, hp) => { const rw = depRw(ac), ok = depHolds(rw); if (!HOLDS[hp] || ok.includes(hp)) return hp;
  return ok.find(k => HOLDS[k].ref === HOLDS[hp].ref) || hp; };
const routeLen = (from, to) => { const r = route(from, to); return r ? pathLen(r.nodes) : Infinity; };
function depHold(ac){
  const rw = depRw(ac), from = ac.stand && !ac.leftStand ? ac.stand.node : (nearestNode([ac.x, ac.y], n => !/^R/.test(n.id)) || {}).id;
  const ks = endHolds(rw).length ? endHolds(rw) : depHolds(rw); let best = ks[0], bl = Infinity;
  if (!from) return best;
  const rs = routesFrom(from, ks.map(k => HOLDS[k].node));
  for (const k of ks) { const r = rs.get(HOLDS[k].node), L = r ? pathLen(r.nodes) : Infinity; if (L < bl) { bl = L; best = k; } }
  return best;
}
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
function pushRec(ac){
  const st = ac.stand, h = depHold(ac), to = h && HOLDS[h].node; if (!to) return 'east';
  const len = f => { const r = route(st.node, to, undefined, norm(laneDir(st, f) + 180)); return r ? pathLen(r.nodes) : Infinity; };
  const opts = ['east', 'west', 'north', 'south'].map(f => [f, len(f)]).sort((a, b) => a[1] - b[1]);
  if (opts[0][1] < Infinity) return opts[0][0];
  const r = route(st.node, to);
  if (!r || r.nodes.length < 2) return 'east';
  const b = brg(...st.lp, ...GN[r.nodes[1]].p), off = f => Math.abs(angDiff(norm(laneDir(st, f) + 180), b));
  return ['east', 'west', 'north', 'south'].sort((x, y) => off(x) - off(y))[0];
}
// the side of the runway an arrival vacates to: the terminals' side (north of 10R/28L, south of 10L/28R, east of 16/34),
// or the side its stand is on once it has one (the West Apron is west of 16/34)
function sideFor(ac, R){
  if (!ac || !ac.stand) return R.side;
  const o = R.offOf(ac.stand.p); return Math.abs(o) > 60 ? Math.sign(o) : R.side;
}
function exitsFor(rw, ac){
  const R = RWYS_BY_END(rw), up = rw === R.lo, thr = R.thr[rw], side = sideFor(ac, R);
  const ks = Object.keys(HOLDS).filter(k => { const H = HOLDS[k]; return H.on === R.id && H.dirs.includes(rw) && (up ? H.m > thr + 600 : H.m < thr - 600); });
  const near = ks.filter(k => Math.sign(HOLDS[k].off) === side), far = ks.filter(k => Math.sign(HOLDS[k].off) !== side);
  const order = a => a.sort((x, y) => (HOLDS[x].m - HOLDS[y].m)*(up ? 1 : -1));
  return [...order(near), ...order(far)];
}
function exitFor(ac, name){
  const rw = ac.app || landRw(ac), R = RWYS_BY_END(rw);
  if (HOLDS[name] && HOLDS[name].on === (ac.rwyId || R.id)) return name;
  const m = R.mOf([ac.x, ac.y]), dir = rw === R.lo ? 1 : -1, side = sideFor(ac, R);
  const ks = Object.keys(HOLDS).filter(k => (HOLDS[k].ref === name || HOLDS[k].base === name) && HOLDS[k].on === R.id && (HOLDS[k].m - m)*dir > 20);
  return ks.sort((a, b) => (Math.sign(HOLDS[b].off) === side) - (Math.sign(HOLDS[a].off) === side) || (HOLDS[a].m - HOLDS[b].m)*dir)[0] || null;
}

// ═════════════════════════ aerodrome drawing ═════════════════════════
// taxiways 23 m (W4, DN and DS 15 m: aerodrome chart note 3); runways 45 m with 7.5 m shoulders
const AD_SITE = { pave: { w: 23 }, aprons: APRONS, roads: [], buildings: [], twyExtra: [], shoulder: [0, RWY_M], serviceRoad: false, paag: [], floods: [], twyLabels: [], hotspots: [], labels: [] };
const TERM_NAME = { P1: 'PIER 1', P2: 'PIER 2', P3: 'PIER 3', P4: 'PIER 4 · T2', N: 'NORTH APRON', S: 'SOUTH APRON', W: 'WEST APRON' };
const TERM_LABELS = (() => { const by = {}; for (const s of STANDS) (by[s.term] ||= []).push(s.p); return Object.entries(by).map(([t, ps]) => [TERM_NAME[t] || t, ps.reduce((a, p) => [a[0] + p[0]/ps.length, a[1] + p[1]/ps.length], [0, 0])]); })();
// the hot spots (aerodrome chart): HS1, the shared 28L/34 threshold with several entries and converging taxiways; HS2,
// the complex junction of Link 4, Link 5, F-Inner and F-Outer where P1, M1 and H1 meet runway 16/34
const HOTSPOTS = [
  { id: 'HS1', c: R0.rm(R0.thr['28L'] + 40, 30), r: 260, note: 'Dual runway threshold (28L and 34): line up on the correct runway and heading; several entry points and converging taxiways.' },
  { id: 'HS2', c: (() => { const R = RWY_LIST[2]; return R.rm(1180, 170); })(), r: 300, note: 'Complex layout where Link 4 and Link 5 meet runway 16/34: risk of taxiing errors and runway incursions.' }
];
const paveW = tw => /^(W4|DN|DS)$/.test(tw) ? 15 : 23;
function drawEidw(){
  const sc = V.scale, mpx = sc/1852, IMG = mapImagery();
  const P2 = p => [sx(p[0]), sy(p[1])];
  const pathP = (pts, close = true) => { cx.beginPath(); pts.forEach((p, i) => cx[i ? 'lineTo' : 'moveTo'](...P2(p))); if (close) cx.closePath(); };
  const lw = m => Math.max(1, m*mpx);
  const rwyPoly = (R, w, m0 = 0, m1 = R.len) => [R.rm(m0, -w/2), R.rm(m1, -w/2), R.rm(m1, w/2), R.rm(m0, w/2)];
  // the crossing runway first, so the parallels' pavement and paint run on over it (the main runway's markings continue
  // through an intersection; the crossing runway's stop at its edges)
  const ORDER = [RWY_LIST[2], RWY_LIST[0], RWY_LIST[1]];
  if (sc <= 70) { cx.fillStyle = rgba('rwyOut', .9); for (const R of ORDER) { pathP(rwyPoly(R, Math.max(R.width, 2.2/mpx), R.m0, R.m1)); cx.fill(); } return; }
  cx.lineJoin = 'round'; cx.lineCap = 'round';
  if (!IMG) {
    cx.fillStyle = C.concrete; for (const a of APRONS) { pathP(a.map(([m, o]) => rm(m, o))); cx.fill(); }
    cx.strokeStyle = C.concrete; cx.lineWidth = lw(60);
    for (const e of GE) { if (e.tw !== 'APRON') continue; pathP([GN[e.a].p, GN[e.b].p], false); cx.stroke(); }
    cx.lineWidth = lw(48); for (const s of STANDS) { pathP([s.lp, s.p], false); cx.stroke(); }
    cx.strokeStyle = C.asphalt;
    for (const e of GE) { if (e.tw === 'APRON') continue; cx.lineWidth = lw(paveW(e.tw)); pathP([GN[e.a].p, GN[e.b].p], false); cx.stroke(); }
    cx.lineWidth = lw(23); for (const k in FIL) { const R = rwyById(HOLDS[k].on); pathP(FIL[k].W.map(([m, o]) => R.rm(m, o)), false); cx.stroke(); }
  } else {
    const lines = GE.filter(e => e.tw !== 'APRON').map(e => ({ pts: [P2(GN[e.a].p), P2(GN[e.b].p)], w: paveWidth(e.tw) }));
    for (const k in FIL) { const R = rwyById(HOLDS[k].on); lines.push({ pts: FIL[k].W.map(([m, o]) => P2(R.rm(m, o))), w: paveWidth() }); }
    drawPavement(lines, G.buildings.map(b => b.pts.map(([e, n]) => P2(EN(e, n)))), mpx);
  }
  if (!IMG) { cx.fillStyle = C.bld; cx.strokeStyle = C.bldEdge; cx.lineWidth = 1; for (const b of G.buildings) { pathP(b.pts.map(([e, n]) => EN(e, n))); cx.fill(); cx.stroke(); } }
  for (const R of ORDER) {
    // shoulders (7.5 m each side on 10/28), the pavement, the stopways
    if (R !== RWY_LIST[2]) { cx.fillStyle = rgba('rwyOut', .55); pathP(rwyPoly(R, R.width + 15, R.m0, R.m1)); cx.fill(); }
    cx.fillStyle = C.rwy; pathP(rwyPoly(R, R.width, R.m0, R.m1)); cx.fill();
    if (sc > 150) drawRwyPaint(R, P2, pathP, lw, mpx);
  }
  if (sc > 150) {
    { const seen = new Set(), leads = []; for (const k in FIL) { for (const f of (G.leads || {})[k] || [FIL[k].W]) { const key = HOLDS[k].on + JSON.stringify(f); if (seen.has(key)) continue; seen.add(key);
      const R = rwyById(HOLDS[k].on); leads.push(leadLine(f).map(p => P2(R.rm(...p)))); } }
      groundLines(lw(0.35), () => leads.forEach(strokeSmooth)); }
    paintEdgeLines(lw(0.35));
    // runway holding positions, pattern A: two solid and two dashed lines across the taxiway, the dashes on the runway side
    cx.fillStyle = C.paint; cx.strokeStyle = C.paint;
    for (const [id, rid] of Object.entries(G.hs)) {
      const n = GN[id]; if (!n) continue; const R = rwyById(rid), m = R.mOf(n.p), o = R.offOf(n.p), s = Math.sign(o);
      cx.lineWidth = lw(0.3);
      for (const [d, dash] of [[0.9, false], [0.3, false], [-0.3, true], [-0.9, true]]) { cx.setLineDash(dash ? [mpx + 1, mpx + 1] : []); pathP([R.rm(m - 11, o + s*d), R.rm(m + 11, o + s*d)], false); cx.stroke(); }
      cx.setLineDash([]);
    }
    // the intermediate holding positions the chart does not name: a single dashed yellow line across the taxiway (no sign)
    { cx.save(); cx.lineCap = 'butt'; cx.strokeStyle = '#f5c518'; cx.lineWidth = Math.max(1.6, 0.6*mpx); cx.setLineDash([Math.max(3, 1.2*mpx), Math.max(2, 0.9*mpx)]);
      for (const [id, node] of G.ihps || []) { if (!/^IHP\d/.test(id) || !GN[node]) continue; const p = GN[node].p, ws = waysOn(node);
        const d = ws.length ? brg(...p, ...GN[ws[0][0]].p) : 0, a = add(p, d + 90, 11*M2NM), b = add(p, d - 90, 11*M2NM); pathP([a, b], false); cx.stroke(); }
      cx.restore(); }
    groundLines(lw(0.3), () => { for (const s of STANDS) if (!s.noLead) { if (s.line && s.line.length > 1 && s.lineOk !== false) { if (s.lineOk == null) { const L = s.line.reduce((a, q, i) => i ? a + dist(...s.line[i-1], ...q) : 0, 0); s.lineOk = L < 1.25*dist(...s.line[0], ...s.line[s.line.length-1]) + 10*M2NM; } if (s.lineOk) { pathP(s.line, false); cx.stroke(); continue; } } const L = dist(...s.lp, ...s.p)/M2NM, f = L > 90 ? 1 - 90/L : 0; pathP([[s.lp[0] + (s.p[0] - s.lp[0])*f, s.lp[1] + (s.p[1] - s.lp[1])*f], s.p], false); cx.stroke(); } });
    cx.save(); if (IMG) clipOut(G.buildings.map(b => b.pts.map(([e, n]) => P2(EN(e, n))))); drawStandDetail(null, null, mpx, false); cx.restore();   // stand paint stops at the terminal walls
    drawGroundSigns();
  }
}
// ICAO Annex 14 runway markings for one runway: edge lines, the centreline between the thresholds, threshold stripes
// (12 on a 45 m runway), the aiming point (400 m in from the threshold where the landing distance is 2,400 m or more,
// 300 m on 16/34) and the touchdown zone bars (six pairs on 10/28, four on 16/34), the designators, the arrows before
// a displaced threshold (10L 280 m, 28R 450 m) and the yellow chevrons of the stopways (10R, 28L)
function drawRwyPaint(R, P2, pathP, lw, mpx){
  const hw = R.width/2 - 1.5, quad = (m1, o1, m2, o2) => { pathP([R.rm(m1, o1), R.rm(m2, o1), R.rm(m2, o2), R.rm(m1, o2)]); cx.fill(); };
  cx.fillStyle = C.paint; cx.strokeStyle = C.paint;
  cx.lineWidth = lw(0.9); pathP([R.rm(0, hw), R.rm(R.len, hw)], false); cx.stroke(); pathP([R.rm(0, -hw), R.rm(R.len, -hw)], false); cx.stroke();
  cx.setLineDash([30*mpx, 20*mpx]); pathP([R.rm(R.thr[R.lo] + 110, 0), R.rm(R.thr[R.hi] - 110, 0)], false); cx.stroke(); cx.setLineDash([]);
  const long = R.id !== '1634', aim = long ? 400 : 300, tdz = long ? [[150, 3], [300, 3], [450, 2], [600, 2], [750, 1], [900, 1]] : [[150, 3], [300, 2], [450, 2], [600, 1]];
  for (const [m0, dir] of [[R.thr[R.lo], 1], [R.thr[R.hi], -1]]) {
    quad(m0, -hw, m0 + dir*1.8, hw);                                                    // the threshold bar
    for (let i = 0; i < 6; i++) for (const k of [-1, 1]) { const o = k*(3 + i*(hw - 3)/6); quad(m0 + dir*6, o, m0 + dir*36, o + k*1.8); }
    for (const k of [-1, 1]) quad(m0 + dir*aim, k*6, m0 + dir*(aim + 50), k*16);
    for (const [d, n] of tdz) if (d !== aim) for (const k of [-1, 1]) for (let j = 0; j < n; j++) { const o = k*(6 + j*3.6); quad(m0 + dir*d, o, m0 + dir*(d + 22.5), o + k*1.8); }
    // before a displaced threshold: arrows down the centreline and arrowheads at the bar
    const pre = dir > 0 ? m0 : R.len - m0;
    if (pre > 60) {
      cx.lineWidth = lw(0.9);
      for (let d = 30; d < pre - 15; d += 60) { const m = m0 - dir*d; pathP([R.rm(m - dir*18, 0), R.rm(m, 0)], false); cx.stroke(); pathP([R.rm(m - dir*8, -3), R.rm(m, 0), R.rm(m - dir*8, 3)], false); cx.stroke(); }
      for (const k of [-1, 1]) { const m = m0 - dir*8; pathP([R.rm(m - dir*10, k*6), R.rm(m, k*10), R.rm(m - dir*10, k*14)], false); cx.stroke(); }
    }
  }
  for (const [rw, m0] of [[R.lo, R.thr[R.lo] + 70], [R.hi, R.thr[R.hi] - 70]]) drawRwyDesignator(...P2(R.rm(m0, 0)), rw, crsOf(rw), Math.max(9, 16*mpx));
  // stopways: yellow chevrons pointing towards the runway
  const sw = STOPWAY[R.id];
  if (sw) { cx.save(); cx.strokeStyle = '#f5c518'; cx.lineWidth = lw(0.9);
    for (const [a, b, dir] of [[-sw[0], 0, 1], [R.len, R.len + sw[1], -1]]) for (let m = a + 10; m < b - 4; m += 15) { const tip = dir > 0 ? m + 8 : m - 8;
      pathP([R.rm(m, -hw + 1), R.rm(tip, 0), R.rm(m, hw - 1)], false); cx.stroke(); }
    cx.restore(); }
}
function drawEidwTop(){
  const sc = V.scale, mpx = sc/1852, IMG = mapImagery();
  const P2 = p => [sx(p[0]), sy(p[1])];
  if (sc > 110) {
    cx.save(); cx.globalCompositeOperation = C.glow;
    const r = Math.max(1.1, 0.9*mpx), glow = (p, col) => { const [X, Y] = P2(p); cx.fillStyle = col; cx.beginPath(); cx.arc(X, Y, r, 0, 7); cx.fill(); };
    for (const R of RWY_LIST) {
      const hw = R.width/2 + 0.5, lit = rwysInUse().some(rw => RWYS_BY_END(rw) === R) || R !== RWY_LIST[1] || northOpen();
      if (!lit) continue;
      for (let m = 0; m <= R.len; m += 60) { glow(R.rm(m, hw), 'rgba(255,244,214,.75)'); glow(R.rm(m, -hw), 'rgba(255,244,214,.75)'); }
      for (let o = -hw + 1; o <= hw - 1; o += 4) { glow(R.rm(R.thr[R.lo], o), 'rgba(90,255,140,.9)'); glow(R.rm(R.thr[R.hi], o), 'rgba(90,255,140,.9)'); }
      // centreline lights on the CAT III runways
      if (R.id !== '1634') for (let m = R.thr[R.lo]; m <= R.thr[R.hi]; m += 30) glow(R.rm(m, 0), m > R.thr[R.hi] - 900 || m < R.thr[R.lo] + 0 ? 'rgba(255,90,90,.7)' : 'rgba(255,250,235,.55)');
    }
    cx.restore();
  }
  // the hot spots: red rings, as on the aerodrome chart
  if (sc > 160 && sc < 3000) { cx.save(); cx.strokeStyle = 'rgba(214,40,40,.75)'; cx.lineWidth = 1.6; cx.setLineDash([6, 4]); cx.font = `700 11px ${FONT_L}`; cx.fillStyle = 'rgba(214,40,40,.9)';
    for (const h of HOTSPOTS) { const [X, Y] = P2(h.c), r = h.r*mpx; cx.beginPath(); cx.arc(X, Y, r, 0, 7); cx.stroke(); cx.fillText(h.id, X + r*0.72, Y - r*0.72); }
    cx.restore(); }
  if (sc > 180 && sc < 2400) {
    cx.font = `600 12px ${FONT_L}`;
    if (IMG) { cx.fillStyle = C.name === 'dark' ? 'rgba(235,242,245,.92)' : '#fff'; cx.strokeStyle = 'rgba(0,0,0,.6)'; cx.lineWidth = 3; cx.lineJoin = 'round'; } else cx.fillStyle = rgba('lab', .72);
    for (const [t, p] of TERM_LABELS) { const [X, Y] = P2(p); if (IMG) cx.strokeText(t, X, Y); cx.fillText(t, X, Y); }
  }
}

// ═════════════════════════ fixes, STARs, SIDs ═════════════════════════
const STAR_LIST = Object.values(EIDW.STARS);
const STAR_FIXES = new Set(STAR_LIST.flatMap(s => s.pts.map(p => p[0])));
const SID_FIXES = new Set(Object.values(EIDW.SIDS).flatMap(s => s.pts));
const APP_FIXES = new Set(Object.values(EIDW.ILS).flatMap(i => [i.ifx, i.faf]));
// the SID turn points (DWxxx) and the point merge arc points are drawn small
for (const [id, p] of Object.entries(EIDW.FIX)) wp(id, p[0], p[1], (STAR_FIXES.has(id) || SID_FIXES.has(id) || APP_FIXES.has(id)) && !/^DW\d/.test(id) ? {} : { minor: true });
for (const [id, n] of Object.entries(EIDW.NAV)) wp(id, ...n.p, { note: `${n.name} ${n.freq}` });
// DW015 is the same point as OBINU (BAMLI 4L ends there): hidden. The SID turn points and the missed approach points
// (DWxxx) are hidden too, as at Manchester: the SID lines show where they are. The point merge arc fixes stay.
for (const id of Object.keys(EIDW.FIX)) if (/^DW\d/.test(id) && !STAR_FIXES.has(id)) WP[id].hide = true;
if (WP.DW015) WP.DW015.hide = true;
const RADAR_REF = ARP;
// the holds: the intermediate fixes' (LAPMO 28L, ABIVU 28R, SUBOF 10L, RAQAR 10R) always; the 16/34 holds (KERAV,
// SORIN, ULTAG) only while 16/34 is in use: on 10/28 KERAV is just a point on the northern STARs (the point merge arcs
// do the sequencing), and an arrival held there would sit across the arc traffic
const RWY16_HOLDS = new Set(['KERAV', 'SORIN', 'ULTAG']);
for (const [id, h] of Object.entries(EIDW.HOLDS_AIR)) if (WP[id]) { const v = { inb: Math.round(h.inb), min: h.min, left: h.turn === 'L' };
  if (RWY16_HOLDS.has(id)) Object.defineProperty(WP[id], 'hold', { enumerable: true, configurable: true, get: () => typeof S !== 'undefined' && /^(16|34)$/.test(S.rwy) ? v : undefined });
  else WP[id].hold = v; }
const GATES = Object.keys(EIDW.DIR);
const grpOf = rw => rw.slice(0, 2);
// the STAR for a gate and a runway direction: the chart's from the gate's entry fix; where none starts there (ABLIN
// flies on to LIPGO for 10, 16 and 34; BAMLI has no runway 16 STAR) the nearest one, joined from the entry
function starOf(g, rw){
  const e = EIDW.DIR[g].entry, grp = grpOf(rw), own = STAR_LIST.find(s => s.rwy === grp && s.pts[0][0] === e);
  if (own) return own;
  const near = STAR_LIST.filter(s => s.rwy === grp).sort((a, b) => dist(...WP[e].p, ...WP[a.pts[0][0]].p) - dist(...WP[e].p, ...WP[b.pts[0][0]].p))[0];
  return { name: near.name, rwy: grp, spoken: near.spoken, level: near.level, pts: [[e], ...near.pts], joined: true };
}
const ENTRY = Object.fromEntries(GATES.map(g => [g, WP[EIDW.DIR[g].entry].p]));
const ENTRY_ALT = Object.fromEntries(GATES.map(g => [g, ['BAGSO', 'BOYNE'].includes(EIDW.DIR[g].entry) ? 10000 : 13000]));
const PRE_ALT = Object.fromEntries(GATES.map(g => [g, ENTRY_ALT[g] + 14000]));

// ── approaches: the localiser from 3 NM outside the intermediate fix, the 3° glidepath from its altitude; 34 the RNP
// (LNAV/VNAV). The decision call is at the final approach fix.
const FINAL = {};
for (const [rw, I] of Object.entries(EIDW.ILS)) {
  if (!THR[rw]) continue;
  const thr = THR[rw], out = norm(crsOf(rw) + 180), dIF = dist(...thr, ...WP[I.ifx].p), dFAF = dist(...thr, ...WP[I.faf].p), elev = THR_ELEV[rw], rnp = !!I.rnp;
  const M = EIDW.MINS[I.cat], low = Math.round((elev + (rnp ? 1200 : 1000))/100)*100;
  const F = { pts: [add(thr, out, dIF + 3), add(thr, out, dIF), thr], alts: [I.ifAlt, I.ifAlt, elev + 50], elev, entry: I.ifx, entryName: I.ifx, name: (rnp ? 'RNP ' : 'ILS ') + rw, alt: I.ifAlt,
    decName: I.faf, decNM: dFAF + 0.2, decMin: Math.max(1.6, dFAF - 1.6), minAlt: low, minText: `${low.toLocaleString('en-GB')} ft`,
    mins: M, minRate: 300, missed: I.missed.slice(), missAlt: I.missAlt,
    phrase: r => `cleared ${rnp ? 'RNP' : 'ILS'} approach runway ${r}, report established`, read: r => `cleared ${rnp ? 'RNP' : 'ILS'} ${r}, wilco`,
    decCall: r => `${APT.tower[0]}, ${I.faf}, ${rnp ? 'RNP' : 'ILS'} runway ${r}`, decNeed: `Inbound past ${I.faf}, needs landing clearance`, decFail: 'not visual at minima' };
  F.cum = new Array(F.pts.length).fill(0); for (let i = F.pts.length - 2; i >= 0; i--) F.cum[i] = F.cum[i+1] + dist(...F.pts[i], ...F.pts[i+1]);
  const meet = (I.ifAlt - elev - 50)/318;
  F.prof = [[0, elev + 50], [meet, I.ifAlt], [F.cum[0] + 1, I.ifAlt]];
  FINAL[rw] = F;
}
// the route to the intermediate fix: the STAR (to the end of the point merge arc, or the IAF hold), then the plate's
// initial approach segment. An arrival left alone flies the whole arc; "DCT PIZSA" (or OBINU, IFBAP, OSLEX) cuts it short.
const LAND_RWYS = Object.keys(FINAL);
const ARR_ROUTE = Object.fromEntries(GATES.map(g => [g, Object.fromEntries(LAND_RWYS.map(rw => {
  const st = starOf(g, rw).pts.map(p => p[0]), last = st[st.length - 1], tr = (EIDW.APP_TRANS[rw] || {})[last] || [EIDW.ILS[rw].ifx];
  return [rw, [...st, ...tr.filter(f => !st.includes(f))]];
}))]));
// where an arrival waits if it is held: the intermediate fix's hold of the runway in use (LAPMO, ABIVU, SUBOF, RAQAR) or the IAF
// holds of 16 and 34 (KERAV, ULTAG, SORIN): read when needed, as the runway changes
const HOLD_AT = {};
for (const g of GATES) Object.defineProperty(HOLD_AT, g, { enumerable: true, get: () => { const r = ARR_ROUTE[g][S.rwy] || ARR_ROUTE[g]['28L'];
  return r.slice().reverse().find(f => WP[f] && WP[f].hold) || EIDW.ILS[S.rwy].ifx; } });
// the levels the STARs fix (the arcs FL70 and FL80, the merge points 3,000 ft or above), for the descent with them
const ARR_ALT = (() => { const m = {}; for (const s of STAR_LIST) for (const [id, a] of s.pts) if (a && m[id] == null) m[id] = a;
  for (const I of Object.values(EIDW.ILS)) { m[I.ifx] = I.ifAlt; } return m; })();

// ── departures: the RNAV SID of the runway and the aircraft's category to the gate's exit fix (C/D jets, A/B propellers);
// where the runway has none to that exit for the category, the other category's, else the nearest exit it has
const catOf = ac => ac && ac.perf && ac.perf.shape === 'prop' ? 'AB' : 'CD';
const SID_BY_RWY = {};
for (const [n, s] of Object.entries(EIDW.SIDS)) (SID_BY_RWY[s.rwy] ||= []).push(n);
// the great-circle bearing from Dublin to a destination (deg true), or null
const ARP_LL = EIDW.arp;
const destBrg = icao => { const A = (EIDW.AIRPORTS[icao]) || (typeof AP !== 'undefined' && AP[icao]); if (!A) return null;
  const r = Math.PI/180, la1 = ARP_LL[0]*r, la2 = A[0]*r, dl = (A[1] - ARP_LL[1])*r;
  return norm(Math.atan2(Math.sin(dl)*Math.cos(la2), Math.cos(la1)*Math.sin(la2) - Math.sin(la1)*Math.cos(la2)*Math.cos(dl))/r); };
function sidName(gate, rwy, ac){
  rwy = rwy || depRw(ac); const cat = catOf(ac), list = SID_BY_RWY[rwy] || [];
  // the SID exit nearest the destination's bearing (for each category): LIFFY for London, OLONO for the Canaries ...
  const db = ac && ac.d ? destBrg(ac.d) : null, G0 = EIDW.DIR[gate] || EIDW.DIR.SE;
  const exitFor = c => db == null ? G0.exit[c] : Object.keys(EIDW.SID_BRG).filter(e => Object.values(EIDW.SIDS).some(s => s.cat === c && s.pts[s.pts.length - 1] === e))
    .sort((a, b) => Math.abs(angDiff(EIDW.SID_BRG[a], db)) - Math.abs(angDiff(EIDW.SID_BRG[b], db)))[0];
  const D = { brg: db ?? G0.brg, exit: { CD: exitFor('CD'), AB: exitFor('AB') } };
  const pick = (c, end) => list.find(n => EIDW.SIDS[n].cat === c && EIDW.SIDS[n].pts[EIDW.SIDS[n].pts.length - 1] === end);
  const other = cat === 'AB' ? 'CD' : 'AB';
  const s = pick(cat, D.exit[cat]) || pick(cat, D.exit[other]) || pick(other, D.exit[other]) || pick(other, D.exit[cat]);
  if (s) return s;
  const b = D.brg, endB = n => { const p = EIDW.SIDS[n].pts, f = WP[p[p.length - 1]]; return f ? brg(...ARP, ...f.p) : 0; };
  const pool = list.filter(n => EIDW.SIDS[n].cat === cat).length ? list.filter(n => EIDW.SIDS[n].cat === cat) : list;
  return pool.sort((x, y) => Math.abs(angDiff(endB(x), b)) - Math.abs(angDiff(endB(y), b)))[0] || null;
}
const sidSpoken = n => (EIDW.SIDS[n] || {}).spoken || n;
const exitRoute = (g, rwy, ac) => { const n = sidName(g, rwy, ac); return n ? EIDW.SIDS[n].pts.slice() : [EIDW.DIR[g].exit.CD]; };
const EXIT_ROUTE = {}, EXIT_FIX = {};
for (const g of GATES) {
  Object.defineProperty(EXIT_ROUTE, g, { enumerable: true, get: () => exitRoute(g, depRw()) });
  Object.defineProperty(EXIT_FIX, g, { enumerable: true, get: () => { const r = exitRoute(g, depRw()); return r[r.length - 1]; } });
}
const NEXT_UNIT = Object.fromEntries(GATES.map(g => [g, EIDW.CTR[EIDW.DIR[g].ctr]]));
const relUnit = ac => 'Dublin Control';
const TEL = EIDW.TEL;
const isMil = ac => false;
const gateFor = ap => ap === 'EIDW' ? 'SE' : (EIDW.PLACE_DIR[ap] || 'SE');

// ═════════════════════════ schedule ═════════════════════════
const withGate = x => ({ ...x, gate: x.gate || gateFor(x.k === 'ARR' ? x.o : x.d) });
const TIMETABLE = EIDW.TIMETABLE;
const REGS = {};
const LONG_STAY = EIDW.LONG_STAY;
const EXTRA = EIDW.EXTRA.map(withGate);
const EXERCISES = Object.fromEntries(Object.entries(EIDW.EXERCISES).map(([k, e]) => ['e' + k, { ...e, sched: e.sched.map(withGate) }]));
const WX_PRESETS = EIDW.WX_PRESETS;

// ═════════════════════════ weather rules ═════════════════════════
// Atlantic westerlies: mechanical turbulence and windshear on short final in strong south-westerlies
const TURB_TABLE = {};
function turbExcess(w){
  if (w.vrb || w.spd < 15) return 0;
  return Math.max(0, Math.max(w.spd, (w.gust || 0)*0.85) - 25);
}
const minsOk = (w, rw) => { const I = EIDW.ILS[rw] || EIDW.ILS['28L'], m = EIDW.MINS[I.cat]; return w.vis >= m.vis && w.ceil >= m.ceil; };
const sraMinsOk = w => minsOk(w, '28L');
// the Dublin and Wicklow Mountains, 14 NM south: up to 2,890 ft (Kippure), surveillance minimum altitude 3,500 ft
// south of 53°15'N (AD 2.24-43)
const WICKLOW = [[53.25, -6.55], [53.25, -6.10], [53.10, -6.05], [52.95, -6.15], [52.95, -6.60], [53.10, -6.65]].map(LL);

// ═════════════════════════ engine hooks ═════════════════════════
const visTxt = v => v >= 9999 ? '10 kilometres or more' : v >= 5000 ? Math.round(v/1000) + ' kilometres' : v + ' metres';
const firstOf = (t, i = 0) => STANDS.filter(s => s.term === t)[i];
const landRwyOf = ac => S.rwy;
const depRwyOf = ac => {
  if (ac && ac.cto && ac.depRwy) return ac.depRwy;
  // a departure sent to a holding point of the landing runway departs from it (mixed mode, as at night)
  if (ac && ac.hp && HOLDS[ac.hp]) { const on = HOLDS[ac.hp].on, d = depOf(); if (RWYS_BY_END(d).id === on) return d; if (RWYS_BY_END(S.rwy).id === on) return S.rwy; }
  return depOf();
};
const flowName = () => { const c = cfgNow(); return c === 'west' ? (northOpen() ? 'Westerly' : 'Westerly, night') : c === 'east' ? (northOpen() ? 'Easterly' : 'Easterly, night') : CFG[c].name; };
// point merge: the levels of the arcs (FL70 for the arcs fed from the south, FL80 from the north) at each of their fixes,
// from the 28 and 10 STARs. An arrival with an arc fix still ahead keeps the arc's level (the AI's floor): the two arcs
// overlap on the map and are kept apart by those levels until each arrival is sent direct to the merge point.
const ARC_AT = {};
for (const s of STAR_LIST) if (s.rwy === '28' || s.rwy === '10') for (const [id, a] of s.pts) if (a === 7000 || a === 8000) ARC_AT[id] = a;
const arcFloor = ac => { if (ac.kind !== 'ARR' || ac.app || ac.emerg || ac.state === 'MISSED') return 0; let f = 0; for (const id of ac.route || []) if (ARC_AT[id]) f = Math.max(f, ARC_AT[id]); return f; };
const APT = {
  aiFloor: arcFloor,
  toVis: 125,   // low visibility take-offs to RVR 125 m
  lvp: w => w.vis < 550 || w.ceil < 200, lvpNote: 'CAT II/III holding points E1, S7, N2 and N6 in use',
  arrAlt: { ...ARR_ALT },
  icao: 'EIDW', name: 'Dublin', coordName: 'Dublin', radarName: 'Dublin', utcOff: 1, tz: 'Europe/Dublin',
  radar: [EIDW.UNITS.app.name, EIDW.UNITS.app.freq], depRadar: [EIDW.UNITS.app.name, EIDW.UNITS.app.freq],
  get tower(){ return [EIDW.UNITS.twr.name, EIDW.UNITS.twr.freq[RWYS_BY_END(S.rwy).id] || '118.605']; },
  gnd: [EIDW.UNITS.gnd.name, EIDW.UNITS.gnd.freq],
  runways: RWY_LIST, rwyHalfWidth: 22.5, holdSigns: true,
  // the intermediate holding points the chart names (Venus and Neptune on N); the others are painted (drawEidw) but unnamed
  ihps: (G.ihps || []).filter(([id]) => !/^IHP\d/.test(id)).map(([id, node]) => ({ id, node })),
  // independent parallel runways 1.6 km apart: a departure off one and an arrival on (or going around from) the other,
  // close in, are separated by the SID and missed approach tracks; arrivals to both on final side by side likewise
  sepOk: (a, b, d) => { const rw = x => x.kind === 'ARR' ? (x.app || x.gaRwy) : depRw(x); const ra = rw(a), rb = rw(b);
    if (!ra || !rb || !parallelOf(ra) || RWYS_BY_END(ra) === RWYS_BY_END(rb) || !/^(10|28)/.test(rb)) return false;
    return dist(a.x, a.y, ...ARP) < 10 && dist(b.x, b.y, ...ARP) < 10; },
  xing: false, drawnTown: false, ta: EIDW.TA, initClimb: EIDW.INIT_CLIMB, gaAlt: 3000, appAlt: 3000, handoffNM: 22, climbFL: 230, divertAlt: 7000,
  area: { dep: 40, arr: 70, div: 45 }, roll: [70, RWY_M - 70], defRwy: '28L', defWx: 'west',
  appName: 'ILS approach', appShort: 'ILS', minsText: 'weather below the approach minima', reqApp: rw => (EIDW.ILS[rw] || {}).rnp ? 'RNP approach' : 'ILS approach',
  minsLong: 'Visibility is below the minima (ILS CAT III on 10/28: RVR 75 m; CAT I on 16; RNP on 34).',
  liveName: 'Dublin Airport', liveThin: 22, atisFreq: EIDW.UNITS.atis.freq, turbName: 'Dublin',
  sessionHours: Array.from({ length: 17 }, (_, i) => i + 5),   // 0500Z to 2100Z
  // the tower view: both parallel runways and the piers between them (an offset from the south runway's middle, NM)
  view: { app: [0, 0, 70], get twr(){ const c = R0.rm(R0.len*0.66, 850), m = R0.rm(R0.len/2, 0); return [c[0] - m[0], c[1] - m[1], 3.0]; },
    gnd: (() => { const c = firstOf('P2') ? firstOf('P2').p : ARP; return [mOf(c), offOf(c), 4200, 3200]; })() },
  minsOk,
  splitRwy: true, rwyFor, depFor, configOf,
  rwyConfigs: [['west', '28L', '28R'], ['east', '10L', '10R'], ['s34', '34', '34'], ['n16', '16', '16']].map(([key, land, dep]) => ({ key, name: CFG[key].name, land, lands: [land], deps: [dep] })),
  depRwyOf, landRwyOf, arrRoute: o => landRw(o),
  activeRwys: () => [...new Set([S.rwy, depOf()])],
  depRwys: () => [depOf()],
  appRwys: () => { const p = parallelOf(S.rwy); return p && FINAL[p] && northOpen() ? [S.rwy, p] : [S.rwy]; },
  ropsSkip: [],
  exitRouteOf: ac => exitRoute(ac.gate, ac.depRwy || depRw(ac), ac),
  needRel: ac => false,                                     // Dublin's SIDs are free flow (no releases)
  sidAlt: ac => EIDW.INIT_CLIMB,
  remoteAreas: ['remote'],
  areaNames: { civil: 'pier stands', remote: 'remote stands' },
  termName: t => (TERM_NAME[t] || t).replace(' · T2', ' (Terminal 2)').toLowerCase().replace(/^./, c => c.toUpperCase()).replace('t2', 'T2'),
  remoteWord: s => 'remote stand',
  prefArea: ac => { const t = (EIDW.TERMINAL_OF[ac.cs.slice(0, 3)] || EIDW.TERMINAL_DEFAULT)[0]; return { key: t, name: TERM_NAME[t], has: s => s.term === t }; },
  standFor: ac => {
    const pick = list => { const free = list.filter(s => standFree(s, ac)).sort((a, b) => (a.maxSpan || 80) - (b.maxSpan || 80)), best = free.filter(s => (s.maxSpan || 80) <= (free[0] && free[0].maxSpan || 80) + 8);
      return best[Math.floor(Math.random()*best.length)] || null; };
    const al = ac.cs.slice(0, 3), long = ac.perf.wake === 'H' || /^[KCOZ]/.test((ac.kind === 'ARR' ? ac.o : ac.d) || '');
    const order = long && !EIDW.TERMINAL_OF[al] ? ['P4', 'P2', 'S'] : (EIDW.TERMINAL_OF[al] || EIDW.TERMINAL_DEFAULT).concat(['P2', 'P1', 'P3', 'S', 'N', 'W']);
    for (const t of order) { const s = pick(STANDS.filter(s => s.term === t)); if (s) return s; }
    return pick(STANDS); },
  inboundAlt: g => { const st = starOf(g, S.rwy); return st.level || 7000; },
  divertTo: ac => ['N', 'NNE', 'NE', 'NNW'].includes(ac.gate) ? ['Belfast', 'BAMLI'] : ['Shannon', 'OSGAR'],
  firstAlt: g => ENTRY_ALT[g] - 2000,
  rolledCall: 'request taxi',
  vacExits: ac => { const rw = ac.app || landRw(ac), R = RWYS_BY_END(rw), m = R.mOf([ac.x, ac.y]), dir = rw === R.lo ? 1 : -1;
    const side = sideFor(ac, R); return exitsFor(rw, ac).filter(k => (HOLDS[k].m - m)*dir > 30 && Math.sign(HOLDS[k].off) === side).slice(0, 4); },
  vacPrefs: (st, ac) => exitsFor(ac && (ac.app || landRw(ac)) || S.rwy, ac),
  exitFor,
  lineUpWords: hp => 'line up and wait',
  terrain: { name: 'the Wicklow Mountains', poly: WICKLOW, min: 3500, low: 3000, msg: ac => `${ac.cs} is over the Wicklow Mountains at ${Math.round(ac.alt)} ft (Kippure 2,475 ft, Lugnaquilla 3,035 ft; minimum 3,500 ft)${ac.alt < 3000 ? ', TERRAIN' : ''}.` },
  restricted: null,
  drawAirport: drawEidw, drawAirportTop: drawEidwTop,
  onStep: stepNorth,
  gaEarly(ac, rw){},
  // the published missed approach: straight ahead, then the turn to the plate's fixes, to its altitude
  gaTurn(ac){ const rw = ac.gaRwy, F = FINAL[rw] || FINAL['28L'];
    if (ac.alt > ELEV + 700 || dist(ac.x, ac.y, ...(THR[rw] || ARP)) > 2) { ac.gaTurn = true; ac.mode = 'NAV'; ac.route = F.missed.slice(); ac.turnDir = 0; ac.tgtAlt = ac.cleared = Math.max(ac.cleared || 0, F.missAlt); } },
  // RNAV SIDs: CAT A/B straight ahead to 750 ft, then the turn; CAT C/D straight ahead to the 5 NM point (the SID's first
  // fix, on the extended centreline), so the turn waits for it
  liftoff(ac){ ac.tgtHdg = Math.round(crsOf(ac.depRwy)); ac.turnDir = 0; },
  depTurn(ac){ if (ac.turned) return; if (catOf(ac) === 'AB' ? ac.alt >= 750 : ac.alt >= ELEV + 400) ac.turned = true; },
  depClear: ac => !!ac.turned && ac.alt > ELEV + 600,
  shear(ac, rw, w){ return turbExcess(w) > 4 && Math.random() < 0.2 ? 'windshear on short final' : null; },
  shearWhy: rw => 'windshear on short final',
  faceHold: (st, f) => depHold({ stand: st, leftStand: false, x: st.p[0], y: st.p[1], kind: 'DEP' }),
  faceWord: f => f,
  faceHdg: (st, f) => norm(laneDir(st, f) + 180),
  taxiHolds: (south, ac) => { const rw = depRw(ac), ks = endHolds(rw), p = ac ? (ac.stand && !ac.leftStand ? ac.stand.lp : [ac.x, ac.y]) : ARP;
    const rec = ac && depHold(ac), ends = [...new Set([rec, ...ks.sort((a, b) => dist(...p, ...GN[HOLDS[a].node].p) - dist(...p, ...GN[HOLDS[b].node].p))].filter(Boolean))].slice(0, 3);
    return [...ends, ...intxHolds(rw).filter(k => !ac || ac.perf.wake !== 'H' || intxRun(k, rw) >= 2600)]; },
  holdNote: (hp, rw) => intxHolds(rw).includes(hp) ? ` · intersection, ${(Math.round(intxRun(hp, rw)/100)*100).toLocaleString('en-GB')} m of runway ahead` : '',
  depHoldAs,
  taxiCheck: (ac, hp) => { if (ac.kind !== 'DEP' || !HOLDS[hp]) return null; const rw = depRw(ac), ok = depHolds(rw);
    if (intxHolds(rw).includes(hp) && ac.perf.wake === 'H' && intxRun(hp, rw) < 2600) return `${ac.cs} (${ac.t}, heavy) needs more runway than ${HOLDS[hp].ref} leaves (${(Math.round(intxRun(hp, rw)/100)*100).toLocaleString('en-GB')} m): it can't take an intersection departure there.`;
    if (ok.includes(hp)) return null;
    const ref = k => HOLDS[k].ref, ends = [...new Set(endHolds(rw).map(ref))], ix = [...new Set(intxHolds(rw).map(ref))];
    return `${ref(hp)} is not a runway ${rw} departure point. Runway ${rw} departures enter at ${ends.join(' or ')}${ix.length ? `, or at the intersection${ix.length > 1 ? 's' : ''} ${ix.join(', ')}` : ''}.`; },
  taxiHint: rw => ({ '28R': 'Runway 28R departures enter at N2 (all aircraft: the CAT II/III holding point) or N1 at the far end, by way of Link 6 or Link 7 and taxiway N.',
    '28L': 'Runway 28L departures enter at E1 (the CAT II/III holding point, hot spot HS1 by the shared 28L/34 threshold); turboprops may line up at S1.',
    '10L': 'Runway 10L departures enter at N6 (all aircraft) or N7 at the far west end, along taxiway N, crossing 16/34 at the north end when it is in use.',
    '10R': 'Runway 10R departures enter at S7 at the west end (the CAT II/III holding point) along taxiway S; turboprops may line up at S6.',
    '16': 'Runway 16 departures enter from taxiway N, 430 m from the 16 threshold.',
    '34': 'Runway 34 departures enter at B2, beside the shared 28L/34 threshold (hot spot HS1): line up on the correct runway.' })[rw] || '',
  diverts: [{ cs: 'BAW117', t: 'B77W', o: 'EGLL', gate: 'W', to: 'Shannon' }, { cs: 'DLH400', t: 'B748', o: 'EDDF', gate: 'W', to: 'Shannon' },
    { cs: 'ICE452', t: 'B38M', o: 'BIKF', gate: 'N', to: 'Belfast' }, { cs: 'AAL107', t: 'B772', o: 'KJFK', gate: 'SE', to: 'Manchester' }],
  airports: EIDW.AIRPORTS, via: {},
  airlineIcao: EIDW.AIRLINE_ICAO, airlineType: EIDW.AIRLINE_TYPE, defType: 'B738',
  placeIcao: EIDW.PLACES,
  // ICAO phraseology with Dublin's: the SID by name with its runway and FL90, the point merge "direct PIZSA"
  phr: {
    push: (ac, dn, face) => [`cleared to ${dn} via the ${sidSpoken(ac.sid)} departure, runway ${depRw(ac)}, climb flight level 90, squawk ${ac.sqk}, push back and start up approved, face ${faceSay(ac, face)}, QNH ${S.wx.qnh}`,
      `cleared ${dn}, ${sidSpoken(ac.sid)}, runway ${depRw(ac)}, flight level 90, squawk ${ac.sqk}, push and start approved facing ${faceSay(ac, face)}, QNH ${S.wx.qnh}`],
    startReq: ac => `${EIDW.UNITS.gnd.name}, stand ${ac.stand.id}, ${ac.perf.name} to ${AP[ac.d] ? AP[ac.d][2] : ac.d}, information ${phonetic(S.atis)}, request push and start`,
    checkIn: ac => { const st = starOf(ac.gate, landRw(ac)); return `${APT.radar[0]}, ${greet()}, ${altShort(Math.round(ac.alt/100)*100)} descending ${altShort(ac.tgtAlt)}, ${st.joined ? 'routing ' + st.pts[1][0] : st.spoken + ' arrival'}, information ${phonetic(S.atis)}`; },
    vacated: ac => `${EIDW.UNITS.gnd.name}, runway ${rwyName(ac.rwyId)} vacated via ${PHON[ac.exit] || ac.exit.replace(/~\d+$/, '')}${ac.stand ? ', for stand ' + ac.stand.id : ''}`,
    taxiIn: (ac, st, vw) => { const k = xingAhead(ac), hs = k >= 0 ? `, hold short runway ${rwyName(ac.path.pts[k].hs)}` : '', via = vw.length ? ' via ' + vw.map(t => PHON[t] || t).join(', ') : '';
      return [`taxi to stand ${st.id}${via}${hs}`, `stand ${st.id}${via}${hs}`]; },
    taxiHold: (ac, h, vw) => { const via = vw.length ? ' via ' + vw.map(t => PHON[t] || t).join(', ') : '', r = h.rwy ? rwyName(HOLDS[h.id].on) : null, at = PHON[h.id] || h.id;
      return r ? [`taxi to holding point ${at}${via}, hold short runway ${r}`, `holding point ${at}${via}, holding short ${r}`] : [`taxi${via}, hold at ${at}`, `${via}, holding at ${at}`]; },
    atHoldPt: (ac, h) => h.rwy ? `holding short runway ${rwyName(HOLDS[h.id].on)} at ${PHON[h.id] || h.id}` : `holding at ${PHON[h.id] || h.id}`
  },
  atisPanel(w){
    const c = windComp(w, crsOf(S.rwy)), bad = !minsOk(w, S.rwy), r = rwyFor(w), north = northOpen();
    return `<div class="warnline${bad ? ' bad' : ''}">${flowName()}: land ${S.rwy}, depart ${depRw()}${r.land !== S.rwy || r.dep !== depRw() ? ` (the wind and clock favour ${r.land} / ${r.dep})` : ''} · ${bad ? 'below the minima' : (EIDW.ILS[S.rwy] || {}).rnp ? 'RNP approaches' : 'ILS approaches'} · crosswind ${Math.round(Math.abs(c.crossG))} kt.${north ? '' : ' North Runway shut (23:00-07:00).'} Point merge: send arrivals direct to the merge point off the arc.</div>`;
  },
  atisLines({ w, L, E }){
    const cl = w.clouds.length ? w.clouds.map(c => { const m = c.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3})/); return m ? `${{ FEW: 'few', SCT: 'scattered', BKN: 'broken', OVC: 'overcast', VV: 'vertical visibility' }[m[1]]} ${(+m[2]*100).toLocaleString('en-GB')} feet` : c; }).join(', ') : 'no significant cloud';
    const app = (EIDW.ILS[S.rwy] || {}).rnp ? 'RNP' : 'ILS';
    const out = [
      `This is Dublin information ${phonetic(L)}, time ${zt(S.t).slice(0,5).replace(':', '')}.`,
      `Runway in use for arrivals ${S.rwy}, ${app} approach. Runway in use for departures ${depRw()}.`,
      `Surface wind ${w.vrb ? 'variable' : hdg3(w.dir)} degrees ${w.spd} knots${w.gust ? ', gusting ' + w.gust : ''}. Visibility ${visTxt(w.vis)}${w.wx.length ? ', ' + w.wx.join(' ') : ''}. ${cl.replace(/^./, c => c.toUpperCase())}.`,
      `Temperature ${w.temp}, dew point ${w.dew}. QNH ${w.qnh}. Transition level ${w.qnh < 977 ? 'flight level 80' : w.qnh < 1013 ? 'flight level 70' : 'flight level 60'}.`
    ];
    if (APT.lvp(w)) out.push('Low visibility procedures in force. CAT II/III holding points in use.');
    if (turbExcess(w) > 0) out.push('Moderate turbulence and windshear reported on final.');
    if (E && E.ws) out.push(`Windshear reported on final runway ${E.ws.rw} at ${zt(E.ws.t).slice(0,5).replace(':', '')}, ${E.ws.text}.`);
    if (E && E.rwyBlock) out.push(`Runway ${blockRw()} closed: ${E.rwyBlock.why}. ${parallelEnd(blockRw()) ? `Arrivals expect runway ${parallelEnd(blockRw())}.` : 'Expect delays.'}`);
    if (!minsOk(w, S.rwy)) out.push('Visibility below the approach minima. Expect holding.');
    if (!northOpen()) out.push('Runway 10L/28R closed between 23:00 and 07:00.');
    out.push('Hot spot HS1 at the 28L and 34 thresholds: ensure line up on the correct runway. Hot spot HS2 at Link 4 and Link 5.');
    out.push(`Acknowledge receipt of information ${phonetic(L)} and advise aircraft type on first contact.`);
    return out;
  },
  // the website: home hero, previews, scenario cards and Academy figures
  site: {
    hero: () => [
      ['RYR4KP', 53.45, -5.85, 230, 220, PAL.light.arr], ['EIN534', 53.30, -5.80, 300, 220, PAL.light.arr], ['BAW837', 53.48, -5.98, 275, 180, PAL.light.arr],
      ['RYR52AB', 53.45, -6.55, 330, 250, PAL.light.dep], ['UAE164', 53.38, -6.55, 250, 260, PAL.light.dep],
      ['DAL44', 53.70, -6.90, 290, 440, 'rgba(60,75,95,.7)'], ['EIN105', 53.20, -6.90, 80, 430, 'rgba(60,75,95,.7)'], ['KLM1137', 53.55, -5.40, 280, 420, 'rgba(60,75,95,.7)']
    ],
    demo(mk, park){
      const fin = add(THR['28L'], norm(CRS['28L'] + 180), 2.6), out = add(THR['28R'], CRS['28R'], 4), arc = WP.DW705 ? WP.DW705.p : add(ARP, 90, 15);
      const hold = endHolds('28R')[0], hp = hold ? GN[HOLDS[hold].node].p : ARP;
      const ids = [firstOf('P1', 0), firstOf('P2', 0), firstOf('P2', 3), firstOf('P4', 1)].map(s => s ? s.id : STANDS[0].id);
      return [
        mk('RYR3TA', 'B738', 'DEP', park(ids[0], { need: null, reqAt: 99999 })), mk('EIN162', 'A20N', 'DEP', park(ids[1], { need: null, reqAt: 99999 })),
        mk('EAI3MK', 'AT76', 'DEP', park(ids[2], { need: null, reqAt: 99999 })), mk('UAE164', 'B77W', 'DEP', park(ids[3], { need: null, reqAt: 99999 })),
        mk('RYR8LW', 'B38M', 'DEP', { ground: true, state: 'HOLDPT', hp: hold, x: hp[0], y: hp[1], hdg: CRS['28R'], gs: 0 }),
        mk('EIN534', 'A320', 'ARR', { state: 'FINAL', mode: 'FINAL', app: '28L', freq: 'TWR', x: fin[0], y: fin[1], hdg: CRS['28L'], alt: 1030, gs: 140, vs: -750, o: 'EHAM' }),
        mk('RYR52AB', 'B38M', 'DEP', { state: 'CLIMB', x: out[0], y: out[1], hdg: 275, alt: 3400, gs: 210, vs: 2200, tgtAlt: 9000, d: 'LEMG' }),
        mk('RYR4KP', 'B738', 'ARR', { state: 'INBOUND', x: arc[0], y: arc[1], hdg: 350, alt: 7000, gs: 250, vs: 0, tgtAlt: 7000, o: 'EGSS' })
      ];
    },
    thumb(k, zoom, W){
      if (k === 'app') return v => { v.scale *= 1.3; };
      if (k === 'twr') { const c = R0.rm(R0.len*0.6, 800); return v => { v.cx = c[0]; v.cy = c[1]; v.scale = W/3.4; }; }
      const c = zoom === 'apron' ? (firstOf('P2') || STANDS[0]).p : R0.rm(R0.len*0.7, 700);
      return v => { v.cx = c[0]; v.cy = c[1]; v.scale = W/((zoom === 'apron' ? 700 : 3600)*M2NM); };
    },
    figHold: 'LAPMO', emergHp: 'E1',
    figConsole: v => { v.scale *= 1.2; },
    cmdHint: 'Command, e.g. RYR4KP DCT PIZSA · RYR4KP APP · EIN162 TAXI · / to focus, Tab cycles flights'
  }
};
// hangars (OpenStreetMap): the Aer Lingus and Ryanair maintenance hangars east of the North Apron (Hangar 6) and the
// West Apron hangars. Aircraft stored there at the start of a session are towed to a stand an hour before departure.
APT.hangars = G.buildings.filter(b => b.roof === 'hangar').map(b => { const n = b.pts.length, c = b.pts.reduce((a, p) => [a[0] + p[0]/n, a[1] + p[1]/n], [0, 0]); return { c, area: Math.abs(b.pts.reduce((a, p, i) => a + p[0]*b.pts[(i + 1) % n][1] - b.pts[(i + 1) % n][0]*p[1], 0))/2, name: b.name }; })
  .filter(h => h.area > 4000).sort((a, b) => b.area - a.area).slice(0, 4)
  .map(h => [h, (nearestNode(EN(...h.c), nd => !/^[Rxs]/.test(nd.id)) || {}).id]).filter(([h, node]) => node && GN[node] && dist(...EN(...h.c), ...GN[node].p)/M2NM < 260)
  .map(([h, node], i) => ({ id: 'H' + (i + 1), name: h.name || (h.c[0] > 1500 ? 'Hangar 6' : 'West Apron hangar'), in: inF0(...h.c), door: [GN[node].m, GN[node].off], node, to: ['civil'],
    fits: ac => /^(EIN|RYR|RUK|EAI)$/.test(ac.cs.slice(0, 3)), pick: ac => APT.standFor(ac) }));
APT.queuePen = true;   // taxi-in routes go round lanes where departures are queued
