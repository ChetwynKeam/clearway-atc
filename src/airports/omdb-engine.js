// ═════════════════════════ Dubai International (OMDB) airport profile for the engine ═════════════════════════
// Builds every global the engine reads from the chart data in omdb.js (OMDB) and the OpenStreetMap aerodrome in
// omdb-ground.js (metres east and north of the ARP). Dubai has two parallel runways 384 m apart and staggered by 1.6 km:
// 12L/30R (north) and 12R/30L (south), with taxiway N north of the north runway, M between them and K south of the
// south runway, Terminal 2 to the north and Terminal 3's Concourses A, B and C and Terminal 1's Concourse D to the south.
// S.rwy is the landing runway and S.depRwy the departure runway: in the westerly (runway 30) arrivals land on 30L and
// departures leave from 30R, in the easterly (12) they land on 12L and leave from 12R (AD 2.22.14.5). Arrivals come in on
// the RNAV STARs, whose long downwind legs Dubai Arrivals cuts short with a turn to base; departures fly the RNAV SID of
// their direction, both runways the same.
Object.assign(TYPES, OMDB.TYPES);
const LL = p => xy(p[0], p[1]);
const G = OMDB_GROUND;
const EN = (e, n) => [e*M2NM, n*M2NM];                     // metres east and north of the ARP (the map origin) → NM

// ═════════════════════════ runways ═════════════════════════
// a frame along each runway: m from the pavement end a (the low-numbered end), off to the left. m0/m1 take in the
// published runway ends
const STOPWAY = {};
function rwyFrame(r){
  const a = EN(...r.a), b = EN(...r.b), L = dist(...a, ...b), RU = [(b[0]-a[0])/L, (b[1]-a[1])/L], RN = [-RU[1], RU[0]];
  const rm = (m, off=0) => [a[0] + (RU[0]*m + RN[0]*off)*M2NM, a[1] + (RU[1]*m + RN[1]*off)*M2NM];
  const mOf = p => ((p[0]-a[0])*RU[0] + (p[1]-a[1])*RU[1])/M2NM, offOf = p => ((p[0]-a[0])*RN[0] + (p[1]-a[1])*RN[1])/M2NM;
  const len = r.len, sw = STOPWAY[r.id] || [0, 0];
  const TURN_W = [[30, 0]], TURN_E = [[len - 30, 0]];       // no turning pads: every entry is at or near the runway end
  return { id: r.id, lo: r.lo, hi: r.hi, len, m0: -sw[0], m1: len + sw[1], thr: r.thr, elev: r.elev, rm, mOf, offOf, RU, TURN_W, TURN_E, TURN_END: { W: 30, E: len - 30 },
    roll: [70, len - 70], ends: true, width: 60 };
}
// 12R/30L first: it is the runway the engine falls back on
const RWY_LIST = ['12R30L', '12L30R'].map(id => rwyFrame(G.runways.find(r => r.id === id)));
const R0 = RWY_LIST[0];
const rm = R0.rm, mOf = R0.mOf, offOf = R0.offOf, RU = R0.RU;
const RWY_M = R0.len, THR_LO_M = R0.thr['12R'], THR_HI_M = R0.thr['30L'];
const RW_LO = '12R', RW_HI = '30L';
const THR = {}, CRS = {}, THR_ELEV = {};
for (const R of RWY_LIST) {
  THR[R.lo] = R.rm(R.thr[R.lo], 0); THR[R.hi] = R.rm(R.thr[R.hi], 0);
  CRS[R.lo] = brg(...R.rm(0), ...R.rm(R.len)); CRS[R.hi] = norm(CRS[R.lo] + 180);
  THR_ELEV[R.lo] = R.elev[R.lo]; THR_ELEV[R.hi] = R.elev[R.hi];
}
const T_LO = THR[RW_LO], T_HI = THR[RW_HI], CRS_LO = CRS[RW_LO], CRS_HI = CRS[RW_HI];
const crsOf = rw => CRS[rw] ?? CRS_HI;
const ELEV = OMDB.elev;
const ARP = LL(OMDB.arp);
const parallelOf = rw => ({ '12L': '12R', '12R': '12L', '30L': '30R', '30R': '30L' })[rw];
const XING_M = -1e9, XING_SKEW = 0, XING_HW = 0, xingM = o => XING_M;
const FRONTIER = [], R164 = [], ROCK = [], ROCK_TOP = [0, 0];
const TURN_W = R0.TURN_W, TURN_E = R0.TURN_E, TURN_END = R0.TURN_END, TURN_PAD = {};
const RWYS_BY_END = rw => RWY_LIST.find(R => R.lo === rw || R.hi === rw) || R0;

// ═════════════════════════ the clock ═════════════════════════
// Gulf Standard Time, UTC+4 all year
function clockMs(){
  if (S.running && S.start) return S.start + S.t*1000;
  const ts = document.getElementById('trafficSel'), mode = ts ? ts.value : '';
  if (EXERCISES[mode]) return null;
  if (/^live/.test(mode)) return Date.now();
  const d = +((document.getElementById('daySel') || {}).value || 0), h = +((document.getElementById('hourSel') || {}).value || 12);
  return Date.UTC(2026, 10, 9 + d, Math.floor(h));
}
const northOpen = () => true;

// ═════════════════════════ runway directions ═════════════════════════
const CFG = OMDB.CONFIGS;
const configOf = rw => ({ '30L': 'west', '30R': 'west', '12L': 'east', '12R': 'east' })[rw] || 'west';
const cfgNow = () => configOf(S.rwy);
// the runway an arrival lands on and the one departures use: land on the left runway, depart from the right (30L and 30R,
// 12L and 12R); either runway can take both when the other is shut
const landOf = () => S.rwy;
const depFor = rw => ({ '30L': '30R', '30R': '30L', '12L': '12R', '12R': '12L' })[rw];
const depOf = () => S.depRwy || depFor(S.rwy);
// by the wind: runway 30 unless the tailwind on it is over 5 kt (the sea breeze and the shamal both blow from the north-west)
function rwyFor(w){
  const calm = w.vrb || w.spd < 4, c30 = windComp(w, crsOf('30L'));
  return !calm && c30.headG < -5 ? { land: '12L', dep: '12R' } : { land: '30L', dep: '30R' };
}

// ═════════════════════════ taxiways, holding points, stands (eidw-ground.js) ═════════════════════════
const inF0 = (e, n) => { const p = EN(e, n); return [mOf(p), offOf(p)]; };
for (const [id, e, n] of G.nodes) gn(id, ...inF0(e, n));
for (const [id, e, n] of G.rnodes) gn(id, ...inF0(e, n));
// a crossing between taxiways that are offset either side of the runway (P1 to W3, M1 to W2, W4 to E2) is a way over
// the runway but not a painted line: the lead-on and lead-off curves either side are what is painted
for (const [a, b, tw, mid] of G.edges) { const n0 = GE.length; chain(a, mid.map(([e, n]) => inF0(e, n)), b, tw);
  if (a[0] === 'x' || b[0] === 'x') { const [x, h] = a[0] === 'x' ? [a, b] : [b, a], R = RWY_LIST.find(Q => Math.abs(Q.offOf(GN[x].p)) < 3) || R0;
    if (Math.abs(R.mOf(GN[h].p) - R.mOf(GN[x].p)) > 10) for (let i = n0; i < GE.length; i++) GE[i].bare = true; } }
const HOLDS = {}, FIL = {};
const CAT23 = new Set(G.cat23 || []);   // CAT II/III holding positions (pattern B), eidw_ground.py
for (const [k, [node, rwy, on, m, off, dirs, end]] of Object.entries(G.holds)) {
  HOLDS[k] = { node, rwy, on, m, off, dirs: dirs.split(',').filter(Boolean), end: end || null, ref: k.replace(/~\d+$/, '') };
  HOLDS[k].base = ((G.hside || {})[HOLDS[k].ref] || [])[0];   // S1W: on taxiway S1, before runway 34
  { const Rh = RWY_LIST.find(R => R.id === on) || RWY_LIST[0];   // the bend between the runway edge and the holding point (hlink, in its runway's frame)
    chain(rwy, ((G.hlink || {})[k] || []).map(([mm, oo]) => { const p = Rh.rm(mm, oo); return [mOf(p), offOf(p)]; }), node, HOLDS[k].base || HOLDS[k].ref); }
  FIL[k] = { W: G.fil[k], E: G.fil[k] };
}
// the rapid exit taxiways (AD 2.20.5.1's exit table: N3, N3A, N5, N5A, N6, N8, M3, M3A, M6, M7A, M8, M9, M11, M12A,
// M12B, M16, M18, K6, K8, K9, K13, K15) are ways off a runway, never on (AD 2.13 note 4: no intersection departures)
const RET_NODES = new Set((G.ret || []).map(k => HOLDS[k] && HOLDS[k].node).filter(Boolean));
for (const [id, rid] of Object.entries(G.hs)) if (GN[id]) GN[id].p.hs = rid;
// stands (AD 2-22A to 2-22C): each apron by its letter. The contact stands at Terminal 3 (Concourse A: A and D; Concourse
// B and C: B and F) and Terminal 1's Concourse D (C51-C64), the remote ones on Aprons C, E, G and Q. Each takes nothing
// wider than its code (C 36 m, D 52 m, E 65 m, F 80 m); the L/R stands overlap their centre stand (MARS: C51L/C51/C51R)
// and the engine keeps them apart by their size. Apron S (no live aircraft movements: tow on and off only) is not
// allocated; E30-E38 are Terminal 2's box stands, nose-in without a lead-in line.
const CONTACT = id => /^[ABDF]/.test(id) || (/^C/.test(id) && +id.replace(/\D/g, '') >= 51);
const STANDS = G.gates.filter(g => g[7] !== 'TT').map(g => { const [id, term, [e, n], node] = g, p = EN(e, n), sp = +g[6] || null;
  return { id, term, p, m: mOf(p), off: offOf(p), node, area: CONTACT(id) ? 'civil' : 'remote', occ: null, noLead: !g[5], line: g[5] ? g[5].map(([x, y]) => EN(x, y)) : null,
    use: g[7], h0: g[4], ...(sp ? { maxSpan: Math.round(sp*10)/10 } : {}), ...((G.vac || {})[id] ? { vacant: G.vac[id] } : {}) }; });
// the AIP gives the nose position: the aircraft's middle is set back along the lead-in by half the length of the largest
// type the stand takes (never more than 40% of the lead-in)
STANDS.forEach(s => { s.lp = GN[s.node].p; const L = dist(...s.lp, ...s.p)/M2NM, half = s.maxSpan ? Math.min(37, Math.max(11, s.maxSpan*0.48)) : 20, k = Math.min(half, L*0.4);
  if (L > 12) { const u = [(s.lp[0] - s.p[0])/(L*M2NM), (s.lp[1] - s.p[1])/(L*M2NM)]; s.p = [s.p[0] + u[0]*k*M2NM, s.p[1] + u[1]*k*M2NM]; s.m = mOf(s.p); s.off = offOf(s.p); }
  s.hdg = L > 3 ? brg(...s.lp, ...s.p) : (s.h0 ?? 0); });
// the MARS stands (C51-C55, E44, E45): the centre (code F) and its L and R halves are never in use at once
const MARS = {};
for (const s of STANDS) { const m = s.id.match(/^([CE]\d+)[LR]$/); if (m && STANDS.some(o => o.id === m[1])) { (MARS[m[1]] ||= []).push(s.id); } }
for (const [c, hs] of Object.entries(MARS)) { const C = STANDS.find(o => o.id === c); C.vacant = [...new Set([...(C.vacant || []), ...hs])];
  for (const h of hs) { const H = STANDS.find(o => o.id === h); H.vacant = [...new Set([...(H.vacant || []), c])]; } }
const APRONS = G.aprons.map(r => r.map(([e, n]) => inF0(e, n)));
// the paved areas a junction's mapped curves enclose (the stop bar chart shows them paved, omdb_ground.py): pavement, not grass
const PAVED = (G.paved || []).map(r => r.map(([e, n]) => EN(e, n)));
// which side of each runway the terminals are
{ const civ = STANDS.filter(s => s.area === 'civil'), c = civ.reduce((a, s) => [a[0] + s.p[0]/civ.length, a[1] + s.p[1]/civ.length], [0, 0]); for (const R of RWY_LIST) R.side = Math.sign(R.offOf(c)) || 1; }

// taxiway names as the AIP says them, letter by letter with the digits as numbers (M13A "Mike one three Alpha"), and
// every intermediate holding point by the stop bar chart's name (AD 2-26: KB "Kilo Bravo", J1A, ZA). The CAT II/III stop
// bars behind a runway holding point that the chart does not name are <holding point>CAT3 (no sign of their own).
const NATO = { A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike',
  N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu' };
const TW_NUMW = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
const twyWords = t => { const b = t.replace(/~\d+$/, ''); return (b.match(/[A-Z]|\d/g) || [b]).map(x => NATO[x] || TW_NUMW[+x] || x).join(' '); };
const PHON = {};
for (const e of GE) if (e.tw && e.tw !== 'APRON' && !PHON[e.tw]) PHON[e.tw] = twyWords(e.tw);
for (const k of Object.keys(HOLDS)) PHON[k] = twyWords(k);
const IHP_LIST = (() => {
  const out = [];
  for (const [id, node] of G.ihps || []) if (GN[node]) out.push({ id, node, ph: twyWords(id) });
  for (const node of CAT23) { if (!GN[node]) continue;
    const hk = Object.keys(HOLDS).filter(k => !/~\d+$/.test(k) && GN[HOLDS[k].node]).sort((x, y) => dist(...GN[HOLDS[x].node].p, ...GN[node].p) - dist(...GN[HOLDS[y].node].p, ...GN[node].p))[0];
    if (hk && dist(...GN[HOLDS[hk].node].p, ...GN[node].p) < 80*M2NM) out.push({ id: `${hk}CAT3`, node, quiet: true, ph: `${twyWords(hk)}, CAT three`, alias: [`${hk}-CAT3`] }); }
  const seen = {}; for (const h of out) { if (seen[h.id]) h.id += String.fromCharCode(65 + seen[h.id]++); else seen[h.id] = 1; }
  return out;
})();
for (const h of IHP_LIST) PHON[h.id] = h.ph || twyWords(h.id);
for (const [k, [ref, w]] of Object.entries(G.hside || {})) { PHON[k] = twyWords(ref) + (w ? ', ' + w : ''); for (const v of Object.keys(HOLDS)) if (HOLDS[v].ref === k) PHON[v] = PHON[k]; }
PHON.APRON = 'the apron';

// ── departure entries: the holding points at the departure end of a runway (AD 2.13 and 2.22.12, omdb_ground.py: 12L N1,
// N1A, N1B and M1, M1A, M1B; 12R K1, M4, K2, M5B; 30R N10 and M14A (the primary entry), N11, M15, N12, M15A; 30L K17,
// M20, K18, M21), then the intersection departures with at least 1,800 m ahead (never from a rapid exit)
const endHolds = rw => Object.keys(HOLDS).filter(k => HOLDS[k].end === rw);
const INTX_MIN = 1800;
const intxRun = (k, rw) => { const H = HOLDS[k], R = rwyById(H.on), m = R.mOf(GN[H.rwy].p); return rw === R.lo ? R.len - m : m; };
const intxWay = (k, rw) => { const R = rwyById(HOLDS[k].on), f = FIL[k].W, a = f[f.length-1], b = f[0], dm = b[0] - a[0], L = Math.hypot(dm, b[1] - a[1]);
  return !L || dm*(rw === R.lo ? 1 : -1)/L >= -0.17; };
// the intersection take-off points AD 2.13 publishes for each runway (no others)
const INTX_AIP = { '12R': ['M5B', 'K2', 'K3', 'M7B', 'K4', 'K5', 'M10B', 'K7', 'K10', 'M13B', 'K11', 'M14B'],
  '30L': ['K16', 'M19', 'K15A', 'M18A', 'K14', 'M17', 'K12', 'M15B', 'M14B', 'K11', 'M13B', 'K10'],
  '12L': ['M1A', 'N1A', 'M1B', 'N1B', 'M1C', 'N1C', 'M2', 'N2', 'N4', 'M5A'],
  '30R': ['M15', 'N11', 'M14A', 'N10', 'M13A', 'N9', 'M13', 'N8A', 'M10A', 'N7'] };
const intxHolds = rw => { const R = RWYS_BY_END(rw);
  return Object.keys(HOLDS).filter(k => { const H = HOLDS[k], q = GN[H.rwy].p;
    return H.on === R.id && !H.end && !RET_NODES.has(H.node) && (INTX_AIP[rw] || []).includes(H.ref) && intxWay(k, rw) && intxRun(k, rw) >= INTX_MIN
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
  // an entry on the far side of the departure runway means crossing it in front of the traffic using it: the one on the
  // aircraft's own side (N for 30R from Terminal 2, M from the south), unless that is a long way round
  const R = RWYS_BY_END(rw), side = Math.sign(R.offOf(GN[from].p));
  for (const k of ks) { const r = rs.get(HOLDS[k].node), L = (r ? pathLen(r.nodes) : Infinity) + (Math.sign(HOLDS[k].off) !== side ? 1.2 : 0); if (L < bl) { bl = L; best = k; } }
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
// the side of the runway an arrival vacates to: the side its stand is on (Terminal 2 north, Terminal 3 and Concourse D
// south: arrivals on 30L vacate left, AD 2.20.5.1), else the terminals' side
function sideFor(ac, R){
  if (!ac || !ac.stand) return R.side;
  const o = R.offOf(ac.stand.p); return Math.abs(o) > 60 ? Math.sign(o) : R.side;
}
// the exits an arrival is given (AD 2.20.5.1): the rapid exit taxiways of the table for its runway, on its side first,
// in the order it reaches them, then the right-angled links (for a slow one, or a long landing). 30L arrivals vacate
// left towards Terminal 3 unless their stand is north of the runways.
const RET_TABLE = { '12L': { L: ['N5A', 'N6', 'N8'], R: ['M7A', 'M9', 'M12A'] }, '12R': { L: ['M16', 'M18'], R: ['K13', 'K15'] },
  '30L': { L: ['K9', 'K8', 'K6'], R: ['M12B', 'M11', 'M8'] }, '30R': { L: ['M6', 'M3A', 'M3'], R: ['N5', 'N3A', 'N3'] } };
function exitsFor(rw, ac){
  const R = RWYS_BY_END(rw), up = rw === R.lo, thr = R.thr[rw], side = sideFor(ac, R);
  const ks = Object.keys(HOLDS).filter(k => { const H = HOLDS[k]; return H.on === R.id && H.dirs.includes(rw) && (up ? H.m > thr + 600 : H.m < thr - 600); });
  const rets = new Set([...(RET_TABLE[rw] || { L: [], R: [] }).L, ...(RET_TABLE[rw] || { L: [], R: [] }).R]);
  const isRet = k => rets.has(HOLDS[k].ref);
  const order = a => a.sort((x, y) => (HOLDS[x].m - HOLDS[y].m)*(up ? 1 : -1));
  const near = ks.filter(k => Math.sign(HOLDS[k].off) === side), far = ks.filter(k => Math.sign(HOLDS[k].off) !== side);
  return [...order(near.filter(isRet)), ...order(near.filter(k => !isRet(k))), ...order(far.filter(isRet)), ...order(far.filter(k => !isRet(k)))];
}
function exitFor(ac, name){
  const rw = ac.app || landRw(ac), R = RWYS_BY_END(rw);
  if (HOLDS[name] && HOLDS[name].on === (ac.rwyId || R.id)) return name;
  const m = R.mOf([ac.x, ac.y]), dir = rw === R.lo ? 1 : -1, side = sideFor(ac, R);
  const ks = Object.keys(HOLDS).filter(k => (HOLDS[k].ref === name || HOLDS[k].base === name) && HOLDS[k].on === R.id && (HOLDS[k].m - m)*dir > 20);
  return ks.sort((a, b) => (Math.sign(HOLDS[b].off) === side) - (Math.sign(HOLDS[a].off) === side) || (HOLDS[a].m - HOLDS[b].m)*dir)[0] || null;
}

// ═════════════════════════ aerodrome drawing ═════════════════════════
// taxiways 25 m (U, W, Y south of Z and the U crossovers 23 m, AD 2.8 table 2); runways 60 m with 7.5 m shoulders
const AD_SITE = { pave: { w: 25 }, aprons: APRONS, roads: [], buildings: [], twyExtra: [], shoulder: [0, RWY_M], serviceRoad: false, paag: [], floods: [], twyLabels: [], hotspots: [], labels: [] };
const TERM_NAME = { A: 'APRON A', B: 'APRON B', C: 'APRON C', D: 'APRON D', E: 'APRON E', F: 'APRON F', G: 'APRON G', Q: 'APRON Q', S: 'APRON S' };
const TERM_WORD = { A: 'Concourse A', D: 'Concourse A', B: 'Concourse B', F: 'Concourse B and C', C: 'Apron C', E: 'Terminal 2', G: 'Apron G', Q: 'Apron Q', S: 'Apron S' };
const TERM_LABELS = (() => { const by = {}; for (const s of STANDS) (by[s.term] ||= []).push(s.p); return Object.entries(by).map(([t, ps]) => [TERM_NAME[t] || t, ps.reduce((a, p) => [a[0] + p[0]/ps.length, a[1] + p[1]/ps.length], [0, 0])]); })();
// the hot spots of the aerodrome chart (AD 2-21), placed on the holding points they name
const HS_AT = (k, r) => { const n = (HOLDS[k] && GN[HOLDS[k].node]) || (IHP_LIST.find(h => h.id === k) && GN[IHP_LIST.find(h => h.id === k).node]); return n ? n.p : ARP; };
const HOTSPOTS = [
  { id: 'HS1', c: HS_AT('M2'), r: 180, note: 'Mis-route: potential to proceed onto the runway holding position M2 from TWY L3.' },
  { id: 'HS2', c: HS_AT('N2'), r: 150, note: 'Pilots to ensure ATC clearance to enter or cross the runway at holding position N2.' },
  { id: 'HS3', c: HS_AT('N10'), r: 150, note: 'Potential to proceed onto RWY HLDG PSN N10 instead of N9 when instructed to hold at N9.' },
  { id: 'HS4', c: HS_AT('M13A'), r: 150, note: 'Potential to proceed onto RWY HLDG PSN M13A when instructed to hold at M13.' },
  { id: 'HS5', c: HS_AT('ZB'), r: 160, note: 'Mis-route: pilots to ensure ATC clearance to use crossover Z2.' },
  { id: 'HS6', c: HS_AT('ZD'), r: 160, note: 'Mis-route: pilots to ensure ATC clearance to use crossover Z4.' },
  { id: 'HS7', c: HS_AT('YA'), r: 170, note: 'Premature turn from TWY K westbound onto TXL Y instead of TXL J1.' },
  { id: 'HS8', c: HS_AT('KM'), r: 200, note: 'Mis-route intersection: potential to turn wrongly onto TWY K, TXL J2, TXL W or TXL Z.' },
  { id: 'HS9', c: HS_AT('KP'), r: 130, note: 'Potential not to hold at IHP KP when instructed.' },
  { id: 'HS10', c: HS_AT('PC'), r: 160, note: 'Mis-route: potential to turn onto TWY P2A instead of P2, or the other way round.' }
];
const paveW = tw => /^(U\d?|W1|Y1)$/.test(tw) ? 23 : 25;
function drawOmdb(){
  const sc = V.scale, mpx = sc/1852, IMG = mapImagery();
  const P2 = p => [sx(p[0]), sy(p[1])];
  const pathP = (pts, close = true) => { cx.beginPath(); pts.forEach((p, i) => cx[i ? 'lineTo' : 'moveTo'](...P2(p))); if (close) cx.closePath(); };
  const lw = m => Math.max(1, m*mpx);
  const rwyPoly = (R, w, m0 = 0, m1 = R.len) => [R.rm(m0, -w/2), R.rm(m1, -w/2), R.rm(m1, w/2), R.rm(m0, w/2)];
  const ORDER = [RWY_LIST[0], RWY_LIST[1]];
  if (sc <= 70) { cx.fillStyle = rgba('rwyOut', .9); for (const R of ORDER) { pathP(rwyPoly(R, Math.max(R.width, 2.2/mpx), R.m0, R.m1)); cx.fill(); } return; }
  cx.lineJoin = 'round'; cx.lineCap = 'round';
  if (!IMG) {
    cx.fillStyle = C.concrete; for (const a of APRONS) { pathP(a.map(([m, o]) => rm(m, o))); cx.fill(); }
    cx.strokeStyle = C.concrete; cx.lineWidth = lw(60);
    for (const e of GE) { if (e.tw !== 'APRON') continue; pathP([GN[e.a].p, GN[e.b].p], false); cx.stroke(); }
    cx.lineWidth = lw(48); for (const s of STANDS) { pathP([s.lp, s.p], false); cx.stroke(); }
    cx.fillStyle = C.asphalt; for (const a of PAVED) { pathP(a); cx.fill(); }
    cx.strokeStyle = C.asphalt;
    for (const e of GE) { if (e.tw === 'APRON') continue; cx.lineWidth = lw(paveW(e.tw)); pathP([GN[e.a].p, GN[e.b].p], false); cx.stroke(); }
    cx.lineWidth = lw(23); for (const k in FIL) { const R = rwyById(HOLDS[k].on); pathP(FIL[k].W.map(([m, o]) => R.rm(m, o)), false); cx.stroke(); }
  } else {
    const lines = GE.filter(e => e.tw !== 'APRON').map(e => ({ pts: [P2(GN[e.a].p), P2(GN[e.b].p)], w: paveWidth(e.tw) }));
    for (const k in FIL) { const R = rwyById(HOLDS[k].on); lines.push({ pts: FIL[k].W.map(([m, o]) => P2(R.rm(m, o))), w: paveWidth() }); }
    cx.fillStyle = C.asphalt; for (const a of PAVED) { pathP(a); cx.fill(); }
    drawPavement(lines, G.buildings.map(b => b.pts.map(([e, n]) => P2(EN(e, n)))), mpx);
  }
  if (!IMG) { cx.fillStyle = C.bld; cx.strokeStyle = C.bldEdge; cx.lineWidth = 1; for (const b of G.buildings) { pathP(b.pts.map(([e, n]) => EN(e, n))); cx.fill(); cx.stroke(); } }
  for (const R of ORDER) {
    // shoulders (7.5 m each side), the pavement
    cx.fillStyle = rgba('rwyOut', .55); pathP(rwyPoly(R, R.width + 15, R.m0, R.m1)); cx.fill();
    cx.fillStyle = C.rwy; pathP(rwyPoly(R, R.width, R.m0, R.m1)); cx.fill();
    if (sc > 150) drawRwyPaint(R, P2, pathP, lw, mpx);
  }
  if (sc > 150) {
    { const seen = new Set(), leads = []; for (const k in FIL) { for (const f of (G.leads || {})[k] || [FIL[k].W]) { const key = HOLDS[k].on + JSON.stringify(f); if (seen.has(key)) continue; seen.add(key);
      const R = rwyById(HOLDS[k].on), L = leadLine(f), sd = Math.sign(L[L.length - 1][1]) || 1;
      // beside the runway centreline, 0.9 m to the taxiway's side (Annex 14 5.2.8.4), so the white centreline still shows
      leads.push(L.map(([m, o]) => P2(R.rm(m, Math.abs(o) < 0.9 ? sd*0.9 : o)))); } }
      groundLines(lw(0.35), () => leads.forEach(strokeSmooth)); }
    paintEdgeLines(lw(0.35));
    // runway holding positions, pattern A: two solid and two dashed lines across the taxiway, the dashes on the runway side
    // (yellow, Annex 14; the rapid exits' are drawn too, with the no-entry bar where they meet the parallel taxiway)
    cx.fillStyle = '#f5c518'; cx.strokeStyle = '#f5c518';
    for (const [id, rid] of Object.entries(G.hs)) {
      // across the taxiway, square to its centreline (as charted), the dashed lines on the runway side
      const n = GN[id]; if (!n) continue; const R = rwyById(rid), ws = waysOn(id); if (!ws.length) continue;
      let d = brg(...n.p, ...GN[ws[0][0]].p); if (Math.abs(R.offOf(add(n.p, d, 5*M2NM))) > Math.abs(R.offOf(n.p))) d += 180;   // d: towards the runway
      const at = (k, w) => add(add(n.p, d, k*M2NM), d + 90, w*M2NM);
      cx.lineWidth = lw(0.3);
      for (const [k, dash] of [[-0.9, false], [-0.3, false], [0.3, true], [0.9, true]]) { cx.setLineDash(dash ? [mpx + 1, mpx + 1] : []); pathP([at(k, -11), at(k, 11)], false); cx.stroke(); }
      cx.setLineDash([]);
    }
    // runway-holding positions on a runway before another (none at Dubai)
    cx.lineWidth = lw(0.3);
    for (const [rid, m, side] of G.rrh || []) { const R = rwyById(rid), hw = R.width/2;
      for (const [d, dash] of [[-0.9, false], [-0.3, false], [0.3, true], [0.9, true]]) { cx.setLineDash(dash ? [mpx + 1, mpx + 1] : []); pathP([R.rm(m + side*d, -hw), R.rm(m + side*d, hw)], false); cx.stroke(); }
      cx.setLineDash([]); }
    // CAT II/III holding positions, pattern B: two solid lines with the rungs of a ladder between them, across the taxiway
    { cx.save(); cx.lineCap = 'butt'; cx.strokeStyle = '#f5c518'; cx.lineWidth = lw(0.3);
      for (const id of G.cat23 || []) { if (!GN[id]) continue; const p = GN[id].p, ws = waysOn(id); if (!ws.length) continue;
        const d = brg(...p, ...GN[ws[0][0]].p), at = (k, w) => add(add(p, d, k*M2NM), d + 90, w*M2NM);
        for (const k of [-0.75, 0.75]) { pathP([at(k, -11), at(k, 11)], false); cx.stroke(); }
        cx.beginPath(); for (let w = -10.5; w <= 10.5; w += 1.5) { cx.moveTo(...P2(at(-0.75, w))); cx.lineTo(...P2(at(0.75, w))); } cx.stroke(); }
      cx.restore(); }
    // the no-entry bar where a rapid exit taxiway meets the parallel taxiway: a row of red lights across it
    if (sc > 400) { cx.save(); cx.fillStyle = '#e0362c';
      for (const id of RET_NODES) { const n = GN[id]; if (!n) continue; const ws = waysOn(id); if (!ws.length) continue;
        const d = brg(...n.p, ...GN[ws[0][0]].p);
        for (let w = -9; w <= 9; w += 3) { const [X, Y] = P2(add(n.p, d + 90, w*M2NM)); cx.beginPath(); cx.arc(X, Y, Math.max(1.2, 0.45*mpx), 0, 7); cx.fill(); } }
      cx.restore(); }
    groundLines(lw(0.3), () => { for (const s of STANDS) if (!s.noLead) { if (s.line && s.line.length > 1 && s.lineOk !== false) { if (s.lineOk == null) { const L = s.line.reduce((a, q, i) => i ? a + dist(...s.line[i-1], ...q) : 0, 0); s.lineOk = L < 1.25*dist(...s.line[0], ...s.line[s.line.length-1]) + 10*M2NM; } if (s.lineOk) { pathP(s.line, false); cx.stroke(); continue; } } const L = dist(...s.lp, ...s.p)/M2NM, f = L > 90 ? 1 - 90/L : 0; pathP([[s.lp[0] + (s.p[0] - s.lp[0])*f, s.lp[1] + (s.p[1] - s.lp[1])*f], s.p], false); cx.stroke(); } });
    cx.save(); if (IMG) clipOut(G.buildings.map(b => b.pts.map(([e, n]) => P2(EN(e, n))))); drawStandDetail(null, null, mpx, false); cx.restore();   // stand paint stops at the terminal walls
    drawGroundSigns();
  }
}
// ICAO Annex 14 runway markings for one runway: edge lines, the centreline between the thresholds, threshold stripes
// (16 on a 60 m runway), the aiming point 400 m in, six pairs of touchdown zone bars, the designators, and the arrows
// on the displaced parts before each threshold (12R 715 m, 30L 132 m, 12L 450 m, 30R 300 m)
function drawRwyPaint(R, P2, pathP, lw, mpx){
  const hw = R.width/2 - 1.5, quad = (m1, o1, m2, o2) => { pathP([R.rm(m1, o1), R.rm(m2, o1), R.rm(m2, o2), R.rm(m1, o2)]); cx.fill(); };
  cx.fillStyle = C.paint; cx.strokeStyle = C.paint;
  cx.lineWidth = lw(0.9); pathP([R.rm(0, hw), R.rm(R.len, hw)], false); cx.stroke(); pathP([R.rm(0, -hw), R.rm(R.len, -hw)], false); cx.stroke();
  cx.beginPath(); for (let m = R.thr[R.lo] + 110; m < R.thr[R.hi] - 120; m += 50) { const [a, b] = [P2(R.rm(m, 0)), P2(R.rm(Math.min(m + 30, R.thr[R.hi] - 110), 0))]; cx.moveTo(...a); cx.lineTo(...b); } cx.stroke();
  const aim = 400, tdz = [[150, 3], [300, 3], [450, 2], [600, 2], [750, 1], [900, 1]];
  for (const [m0, dir] of [[R.thr[R.lo], 1], [R.thr[R.hi], -1]]) {
    quad(m0, -hw, m0 + dir*1.8, hw);
    for (let i = 0; i < 8; i++) for (const k of [-1, 1]) { const o = k*(3 + i*(hw - 3)/8); quad(m0 + dir*6, o, m0 + dir*36, o + k*1.8); }
    for (const k of [-1, 1]) quad(m0 + dir*aim, k*8, m0 + dir*(aim + 60), k*18);
    for (const [d, n] of tdz) if (d !== aim) for (const k of [-1, 1]) for (let j = 0; j < n; j++) { const o = k*(8 + j*3.6); quad(m0 + dir*d, o, m0 + dir*(d + 22.5), o + k*1.8); }
    const pre = dir > 0 ? m0 : R.len - m0;
    if (pre > 60) {
      cx.lineWidth = lw(0.9);
      for (let d = 30; d < pre - 15; d += 60) { const m = m0 - dir*d; pathP([R.rm(m - dir*18, 0), R.rm(m, 0)], false); cx.stroke(); pathP([R.rm(m - dir*8, -3), R.rm(m, 0), R.rm(m - dir*8, 3)], false); cx.stroke(); }
      for (const k of [-1, 1]) { const m = m0 - dir*8; pathP([R.rm(m - dir*10, k*8), R.rm(m, k*12), R.rm(m - dir*10, k*16)], false); cx.stroke(); }
    }
  }
  for (const [rw, m0] of [[R.lo, R.thr[R.lo] + 70], [R.hi, R.thr[R.hi] - 70]]) drawRwyDesignator(...P2(R.rm(m0, 0)), rw, crsOf(rw), Math.max(9, 18*mpx));
}
function drawOmdbTop(){
  const sc = V.scale, mpx = sc/1852, IMG = mapImagery();
  const P2 = p => [sx(p[0]), sy(p[1])];
  if (sc > 110) {
    cx.save(); cx.globalCompositeOperation = C.glow;
    const r = Math.max(1.1, 0.9*mpx), glow = (p, col) => { const [X, Y] = P2(p); cx.fillStyle = col; cx.beginPath(); cx.arc(X, Y, r, 0, 7); cx.fill(); };
    for (const R of RWY_LIST) {
      const hw = R.width/2 + 0.5;
      for (let m = 0; m <= R.len; m += 60) { glow(R.rm(m, hw), 'rgba(255,244,214,.75)'); glow(R.rm(m, -hw), 'rgba(255,244,214,.75)'); }
      for (let o = -hw + 1; o <= hw - 1; o += 4) { glow(R.rm(R.thr[R.lo], o), 'rgba(90,255,140,.9)'); glow(R.rm(R.thr[R.hi], o), 'rgba(90,255,140,.9)'); }
      // centreline lights on the CAT III runways
      for (let m = R.thr[R.lo]; m <= R.thr[R.hi]; m += 30) glow(R.rm(m, 0), m > R.thr[R.hi] - 900 || m < R.thr[R.lo] + 0 ? 'rgba(255,90,90,.7)' : 'rgba(255,250,235,.55)');
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
const STAR_LIST = Object.values(OMDB.STARS);
const STAR_FIXES = new Set(STAR_LIST.flatMap(s => s.pts.map(p => p[0])));
const SID_FIXES = new Set(Object.values(OMDB.SIDS).flatMap(s => s.pts));
const APP_FIXES = new Set(Object.values(OMDB.ILS).flatMap(i => [i.ifx, i.faf]));
// the terminal area points (DBxxx: the SID and STAR turn points, the approach and missed approach points) are drawn
// small; the SID turn points are hidden, the SID lines show where they are
for (const [id, p] of Object.entries(OMDB.FIX)) wp(id, p[0], p[1], /^DB\d/.test(id) ? { minor: true } : {});
for (const id of Object.keys(OMDB.FIX)) if (/^DB\d/.test(id) && !STAR_FIXES.has(id) && !APP_FIXES.has(id)) WP[id].hide = true;
const RADAR_REF = ARP;
// the holds: the missed approach holds EGNOT (30) and TALTU (12), and the STAR entry points
for (const [id, h] of Object.entries(OMDB.HOLDS_AIR)) if (WP[id]) WP[id].hold = { inb: Math.round(h.inb), min: h.min, left: h.turn === 'L' };
const GATES = Object.keys(OMDB.DIR);
const grpOf = rw => rw.slice(0, 2);
// the STAR for a gate and a runway direction: the primary one from the gate's entry fix
function starOf(g, rw){
  const e = OMDB.DIR[g].entry, grp = grpOf(rw), own = STAR_LIST.find(s => s.rwy === grp && s.pts[0][0] === e);
  if (own) return own;
  const near = STAR_LIST.filter(s => s.rwy === grp).sort((a, b) => dist(...WP[e].p, ...WP[a.pts[0][0]].p) - dist(...WP[e].p, ...WP[b.pts[0][0]].p))[0];
  return { name: near.name, rwy: grp, spoken: near.spoken, level: near.level, pts: [[e], ...near.pts], joined: true };
}
const ENTRY = Object.fromEntries(GATES.map(g => [g, WP[OMDB.DIR[g].entry].p]));
const ENTRY_ALT = Object.fromEntries(GATES.map(g => [g, Math.max(...STAR_LIST.filter(s => s.pts[0][0] === OMDB.DIR[g].entry).map(s => s.level))]));
const PRE_ALT = Object.fromEntries(GATES.map(g => [g, ENTRY_ALT[g] + 12000]));

// ── approaches: the localiser from 3 NM outside the intermediate fix (the coding tables' first point on the centreline),
// the 3° glidepath from its altitude. The decision call is at the final approach fix.
const FINAL = {};
for (const [rw, I] of Object.entries(OMDB.ILS)) {
  if (!THR[rw]) continue;
  const thr = THR[rw], out = norm(crsOf(rw) + 180), dIF = dist(...thr, ...WP[I.ifx].p), dFAF = dist(...thr, ...WP[I.faf].p), elev = THR_ELEV[rw], rnp = !!I.rnp;
  const M = OMDB.MINS[I.cat], low = Math.round((elev + (rnp ? 1200 : 1000))/100)*100;
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
// the route to the intermediate fix: the STAR (its downwind to REREK or ULDOT), then the coding table's initial approach
// segment. An arrival left alone flies the whole trombone; a direct to a base point or a vector cuts it short.
const LAND_RWYS = Object.keys(FINAL);
const ARR_ROUTE = Object.fromEntries(GATES.map(g => [g, Object.fromEntries(LAND_RWYS.map(rw => {
  const st = starOf(g, rw).pts.map(p => p[0]), last = st[st.length - 1], tr = (OMDB.APP_TRANS[rw] || {})[last] || [OMDB.ILS[rw].ifx];
  return [rw, [...st, ...tr.filter(f => !st.includes(f))]];
}))]));
// where an arrival waits if it is held: its STAR entry point's hold
const HOLD_AT = {};
for (const g of GATES) Object.defineProperty(HOLD_AT, g, { enumerable: true, get: () => { const r = ARR_ROUTE[g][S.rwy] || ARR_ROUTE[g]['30L'];
  return r.slice().reverse().find(f => WP[f] && WP[f].hold) || OMDB.ILS[S.rwy].ifx; } });
// the levels the STARs fix (their "at or below" levels), for the descent with them
const ARR_ALT = (() => { const m = {}; for (const s of STAR_LIST) for (const [id, a] of s.pts) if (a && m[id] == null) m[id] = a;
  for (const I of Object.values(OMDB.ILS)) { m[I.ifx] = I.ifAlt; } return m; })();

// ── departures: the RNAV SID of the runway direction (both runways of a direction fly the same SIDs) to the exit
// nearest the destination's bearing
const catOf = ac => ac && ac.perf && ac.perf.shape === 'prop' ? 'AB' : 'CD';
const SID_BY_RWY = {};
for (const [n, s] of Object.entries(OMDB.SIDS)) for (const r of ['L', 'R']) (SID_BY_RWY[s.rwy + r] ||= []).push(n);
// the great-circle bearing from Dubai to a destination (deg true), or null
const ARP_LL = OMDB.arp;
const destBrg = icao => { const A = (OMDB.AIRPORTS[icao]) || (typeof AP !== 'undefined' && AP[icao]); if (!A) return null;
  const r = Math.PI/180, la1 = ARP_LL[0]*r, la2 = A[0]*r, dl = (A[1] - ARP_LL[1])*r;
  return norm(Math.atan2(Math.sin(dl)*Math.cos(la2), Math.cos(la1)*Math.sin(la2) - Math.sin(la1)*Math.cos(la2)*Math.cos(dl))/r); };
function sidName(gate, rwy, ac){
  rwy = rwy || depRw(ac); const cat = catOf(ac), list = SID_BY_RWY[rwy] || [];
  // the SID exit nearest the destination's bearing: RIDAP for Europe, IVURO for India, KUTLI for Africa ...
  const db = ac && ac.d ? destBrg(ac.d) : null, G0 = OMDB.DIR[gate] || OMDB.DIR.NW;
  const exitFor = c => db == null ? G0.exit[c] : Object.keys(OMDB.SID_BRG).filter(e => Object.values(OMDB.SIDS).some(s => s.cat === c && s.pts[s.pts.length - 1] === e))
    .sort((a, b) => Math.abs(angDiff(OMDB.SID_BRG[a], db)) - Math.abs(angDiff(OMDB.SID_BRG[b], db)))[0];
  const D = { brg: db ?? G0.brg, exit: { CD: exitFor('CD'), AB: exitFor('AB') } };
  const pick = (c, end) => list.find(n => OMDB.SIDS[n].cat === c && OMDB.SIDS[n].pts[OMDB.SIDS[n].pts.length - 1] === end);
  const other = cat === 'AB' ? 'CD' : 'AB';
  const s = pick(cat, D.exit[cat]) || pick(cat, D.exit[other]) || pick(other, D.exit[other]) || pick(other, D.exit[cat]);
  if (s) return s;
  const b = D.brg, endB = n => { const p = OMDB.SIDS[n].pts, f = WP[p[p.length - 1]]; return f ? brg(...ARP, ...f.p) : 0; };
  const pool = list.filter(n => OMDB.SIDS[n].cat === cat).length ? list.filter(n => OMDB.SIDS[n].cat === cat) : list;
  return pool.sort((x, y) => Math.abs(angDiff(endB(x), b)) - Math.abs(angDiff(endB(y), b)))[0] || null;
}
const sidSpoken = n => (OMDB.SIDS[n] || {}).spoken || n;
const exitRoute = (g, rwy, ac) => { const n = sidName(g, rwy, ac); return n ? OMDB.SIDS[n].pts.slice() : [OMDB.DIR[g].exit.CD]; };
const EXIT_ROUTE = {}, EXIT_FIX = {};
for (const g of GATES) {
  Object.defineProperty(EXIT_ROUTE, g, { enumerable: true, get: () => exitRoute(g, depRw()) });
  Object.defineProperty(EXIT_FIX, g, { enumerable: true, get: () => { const r = exitRoute(g, depRw()); return r[r.length - 1]; } });
}
const NEXT_UNIT = Object.fromEntries(GATES.map(g => [g, OMDB.CTR[OMDB.DIR[g].ctr]]));
const relUnit = ac => 'Emirates Radar';
const TEL = OMDB.TEL;
const isMil = ac => false;
const gateFor = ap => ap === 'OMDB' ? 'NW' : (OMDB.PLACE_DIR[ap] || 'NW');

// ═════════════════════════ schedule ═════════════════════════
const withGate = x => ({ ...x, gate: x.gate || gateFor(x.k === 'ARR' ? x.o : x.d) });
const TIMETABLE = OMDB.TIMETABLE;
const REGS = {};
const LONG_STAY = OMDB.LONG_STAY;
const EXTRA = OMDB.EXTRA.map(withGate);
const EXERCISES = Object.fromEntries(Object.entries(OMDB.EXERCISES).map(([k, e]) => ['d' + k, { ...e, sched: e.sched.map(withGate) }]));
const WX_PRESETS = OMDB.WX_PRESETS;

// ═════════════════════════ weather rules ═════════════════════════
// the shamal: a strong north-westerly that brings dust, turbulence and windshear on short final
const TURB_TABLE = {};
function turbExcess(w){
  if (w.vrb || w.spd < 15) return 0;
  return Math.max(0, Math.max(w.spd, (w.gust || 0)*0.85) - 25);
}
const minsOk = (w, rw) => { const I = OMDB.ILS[rw] || OMDB.ILS['30L'], m = OMDB.MINS[I.cat]; return w.vis >= m.vis && w.ceil >= m.ceil; };
const sraMinsOk = w => minsOk(w, '30L');

// ═════════════════════════ engine hooks ═════════════════════════
const visTxt = v => v >= 9999 ? '10 kilometres or more' : v >= 5000 ? Math.round(v/1000) + ' kilometres' : v + ' metres';
const firstOf = (t, i = 0) => STANDS.filter(s => s.term === t)[i];
const landRwyOf = ac => S.rwy;
const depRwyOf = ac => {
  if (ac && ac.cto && ac.depRwy) return ac.depRwy;
  // a departure sent to a holding point of the landing runway departs from it
  if (ac && ac.hp && HOLDS[ac.hp]) { const on = HOLDS[ac.hp].on, d = depOf(); if (RWYS_BY_END(d).id === on) return d; if (RWYS_BY_END(S.rwy).id === on) return S.rwy; }
  return depOf();
};
const flowName = () => CFG[cfgNow()].name;
// the tower frequency of the direction in use (Air North on 12, Air South on 30)
const twrFreq = () => OMDB.UNITS.twr.freq[(S.rwy || '30L').slice(0, 2)] || '119.550';
const APT = {
  toVis: 75,
  // low visibility operations (AD 2.22.14.1): RVR or visibility 600 m or less, or a ceiling below 300 ft
  lvp: w => w.vis <= 600 || w.ceil < 300, lvpNote: 'low visibility operations: departures from N10/M14A (30R), M4/K1 (12R), N1A/M1A (12L), K17/M20 (30L)',
  arrAlt: { ...ARR_ALT },
  icao: 'OMDB', name: 'Dubai', coordName: 'Dubai', radarName: 'Dubai', utcOff: 4, tz: 'Asia/Dubai',
  radar: [OMDB.UNITS.app.name, OMDB.UNITS.app.freq], depRadar: ['Dubai Departures', OMDB.UNITS.dep.freq.n],
  get tower(){ return [OMDB.UNITS.twr.name, twrFreq()]; },
  gnd: [OMDB.UNITS.gnd.name, OMDB.UNITS.gnd.freq],
  runways: RWY_LIST, rwyHalfWidth: 30, holdSigns: true,
  // every intermediate holding point by the stop bar chart's name (KB, MA, NC, ZF, J1A ...), and the CAT II/III stop bars
  ihps: IHP_LIST.map(({ id, node, quiet, alias }) => ({ id, node, quiet, alias })),
  // the parallel runways are 384 m apart (dependent): a departure off one and an arrival on the other close in are kept
  // apart by the SID's straight climb and the missed approach's, within 6 NM of the field
  sepOk: (a, b, d) => { const rw = x => x.kind === 'ARR' ? (x.app || x.gaRwy) : depRw(x); const ra = rw(a), rb = rw(b);
    if (!ra || !rb || !parallelOf(ra) || RWYS_BY_END(ra) === RWYS_BY_END(rb)) return false;
    return (a.kind === 'ARR') !== (b.kind === 'ARR') && dist(a.x, a.y, ...ARP) < 6 && dist(b.x, b.y, ...ARP) < 6; },
  xing: false, drawnTown: false, ta: OMDB.TA, initClimb: OMDB.INIT_CLIMB, gaAlt: 3000, appAlt: 3000, handoffNM: 25, climbFL: 230, divertAlt: 7000,
  area: { dep: 45, arr: 60, div: 50 }, roll: [70, RWY_M - 70], defRwy: '30L', defWx: 'west',
  appName: 'ILS approach', appShort: 'ILS', minsText: 'weather below the approach minima', reqApp: rw => 'ILS approach',
  minsLong: 'Visibility is below the minima (ILS CAT III on all four runway ends: RVR 50 m).',
  liveName: 'Dubai International', liveThin: 22, atisFreq: OMDB.UNITS.atis.freq, turbName: 'Dubai',
  sessionHours: Array.from({ length: 24 }, (_, i) => i),
  // the tower view: both runways and the concourses (an offset from the south runway's middle, NM)
  // (the field's middle, between the four runway ends, set left of centre so the flight panel on the right leaves it clear)
  view: { app: [0, 0, 70], get twr(){ const c = EN(668 + 1200, -183), m = R0.rm(R0.len/2, 0); return [c[0] - m[0], c[1] - m[1], 3.6]; },
    gnd: (() => { const F = STANDS.filter(s => s.term === 'F'), c = F.length ? [F.reduce((a, s) => a + s.p[0], 0)/F.length + 900*M2NM, F.reduce((a, s) => a + s.p[1], 0)/F.length] : ARP; return [mOf(c), offOf(c), 4600, 3200]; })() },
  minsOk,
  splitRwy: true, rwyFor, depFor, configOf,
  rwyConfigs: [['west', '30L', '30R'], ['east', '12L', '12R']].map(([key, land, dep]) => ({ key, name: CFG[key].name, land, lands: [land], deps: [dep] })),
  depRwyOf, landRwyOf, arrRoute: o => landRw(o),
  activeRwys: () => [...new Set([S.rwy, depOf()])],
  depRwys: () => [depOf()],
  appRwys: () => [S.rwy],
  ropsSkip: [],
  exitRouteOf: ac => exitRoute(ac.gate, ac.depRwy || depRw(ac), ac),
  needRel: ac => false,
  sidAlt: ac => OMDB.INIT_CLIMB,
  remoteAreas: ['remote'],
  areaNames: { civil: 'contact stands', remote: 'remote stands' },
  termName: t => TERM_WORD[t] || t,
  remoteWord: s => 'remote stand',
  prefArea: ac => { const t = (OMDB.TERMINAL_OF[ac.cs.slice(0, 3)] || OMDB.TERMINAL_DEFAULT)[0]; return { key: t, name: TERM_NAME[t], has: s => s.term === t }; },
  // a stand of the airline's terminal that takes the type: the smallest that fits (an A380 on a code F stand)
  standFor: ac => {
    const span = ac.perf.span || 36;
    const pick = list => { const free = list.filter(s => standFree(s, ac) && (s.maxSpan || 80) >= span).sort((a, b) => (a.maxSpan || 80) - (b.maxSpan || 80)), best = free.filter(s => (s.maxSpan || 80) <= (free[0] && free[0].maxSpan || 80) + 8);
      return best[Math.floor(Math.random()*best.length)] || null; };
    const al = ac.cs.slice(0, 3);
    const order = (OMDB.TERMINAL_OF[al] || OMDB.TERMINAL_DEFAULT).concat(al === 'UAE' ? ['C', 'E', 'G'] : ['C', 'E', 'G', 'Q']);
    for (const t of order) { const s = pick(STANDS.filter(s => s.term === t && s.use !== 'TT')); if (s) return s; }
    return pick(STANDS.filter(s => s.use !== 'TT')); },
  inboundAlt: g => { const st = starOf(g, S.rwy); return st.level || 11000; },
  divertTo: ac => ['NE', 'ESE'].includes(ac.gate) ? ['Sharjah', 'PUVAL'] : ['Al Maktoum', 'LORID'],
  firstAlt: g => ENTRY_ALT[g] - 1000,
  rolledCall: 'request taxi',
  vacExits: ac => { const rw = ac.app || landRw(ac), R = RWYS_BY_END(rw), m = R.mOf([ac.x, ac.y]), dir = rw === R.lo ? 1 : -1;
    const side = sideFor(ac, R); return exitsFor(rw, ac).filter(k => (HOLDS[k].m - m)*dir > 30 && Math.sign(HOLDS[k].off) === side).slice(0, 4); },
  vacPrefs: (st, ac) => exitsFor(ac && (ac.app || landRw(ac)) || S.rwy, ac),
  exitFor,
  lineUpWords: hp => 'line up and wait',
  terrain: null,
  restricted: null,
  drawAirport: drawOmdb, drawAirportTop: drawOmdbTop,
  entryCost: (ac, k, from) => { const H = HOLDS[k], R = H && rwyById(H.on); return R && GN[from] && Math.sign(H.off) !== Math.sign(R.offOf(GN[from].p)) ? 1.2 : 0; },
  onStep(){},
  gaEarly(ac, rw){},
  // the published missed approach: straight ahead, then direct to the coding table's points, to its altitude
  gaTurn(ac){ const rw = ac.gaRwy, F = FINAL[rw] || FINAL['30L'];
    if (ac.alt > ELEV + 700 || dist(ac.x, ac.y, ...(THR[rw] || ARP)) > 2) { ac.gaTurn = true; ac.mode = 'NAV'; ac.route = F.missed.slice(); ac.turnDir = 0; ac.tgtAlt = ac.cleared = Math.max(ac.cleared || 0, F.missAlt); } },
  // RNAV SIDs: straight ahead on the runway track to 460 ft (the CA leg), then the turn
  liftoff(ac){ ac.tgtHdg = Math.round(crsOf(ac.depRwy)); ac.turnDir = 0; },
  depTurn(ac){ if (ac.turned) return; if (ac.alt >= ELEV + 460) ac.turned = true; },
  depClear: ac => !!ac.turned && ac.alt > ELEV + 600,
  shear(ac, rw, w){ return turbExcess(w) > 4 && Math.random() < 0.2 ? 'windshear on short final' : null; },
  shearWhy: rw => 'windshear on short final',
  faceHold: (st, f) => depHold({ stand: st, leftStand: false, x: st.p[0], y: st.p[1], kind: 'DEP' }),
  faceWord: f => f,
  faceHdg: (st, f) => norm(laneDir(st, f) + 180),
  taxiHolds: (south, ac) => { const rw = depRw(ac), ks = endHolds(rw), p = ac ? (ac.stand && !ac.leftStand ? ac.stand.lp : [ac.x, ac.y]) : ARP;
    const rec = ac && depHold(ac), ends = [...new Set([rec, ...ks.sort((a, b) => dist(...p, ...GN[HOLDS[a].node].p) - dist(...p, ...GN[HOLDS[b].node].p))].filter(Boolean))].slice(0, 3);
    return [...ends, ...intxHolds(rw).filter(k => !ac || ac.perf.wake !== 'H' || intxRun(k, rw) >= 3000)]; },
  holdNote: (hp, rw) => intxHolds(rw).includes(hp) ? ` · intersection, ${(Math.round(intxRun(hp, rw)/100)*100).toLocaleString('en-GB')} m of runway ahead` : '',
  depHoldAs,
  taxiCheck: (ac, hp) => { if (ac.kind !== 'DEP' || !HOLDS[hp]) return null; const rw = depRw(ac), ok = depHolds(rw);
    if (RET_NODES.has(HOLDS[hp].node)) return `${HOLDS[hp].ref} is a rapid exit taxiway: no intersection departures from it (AD 2.13).`;
    if (intxHolds(rw).includes(hp) && ac.perf.wake === 'H' && intxRun(hp, rw) < 3000) return `${ac.cs} (${ac.t}, heavy) needs more runway than ${HOLDS[hp].ref} leaves (${(Math.round(intxRun(hp, rw)/100)*100).toLocaleString('en-GB')} m): it can't take an intersection departure there.`;
    if (ok.includes(hp)) return null;
    const ref = k => HOLDS[k].ref, ends = [...new Set(endHolds(rw).map(ref))], ix = [...new Set(intxHolds(rw).map(ref))];
    return `${ref(hp)} is not a runway ${rw} departure point. Runway ${rw} departures enter at ${ends.join(', ')}${ix.length ? `, or at the intersection${ix.length > 1 ? 's' : ''} ${ix.join(', ')}` : ''}.`; },
  taxiHint: rw => ({ '30R': 'Runway 30R departures enter at N10 (from the north) or M14A (from between the runways): the primary entries for the stagger, and the CAT II/III ones. N11/M15 and N12/M15A give the full length on request; M13/N8A is the performance standard point.',
    '30L': 'Runway 30L departures enter at K17 or M20 (full length, CAT II/III); from K18 or M21 taxi on to the K17/M20 position before the take-off run. K15A/M18A is the standard point.',
    '12L': 'Runway 12L departures enter at N1 or M1 at the west end, or N1A/M1A (CAT II/III) and N1B/M1B; N1C/M1C is the standard point.',
    '12R': 'Runway 12R departures enter at K1 or M4 at the west end (CAT II/III), or K2 and M5B; K5 is the standard point.' })[rw] || '',
  diverts: [{ cs: 'QTR1008', t: 'A320', o: 'OTHH', gate: 'NW', to: 'Al Maktoum' }, { cs: 'SVA556', t: 'A320', o: 'OERK', gate: 'NW', to: 'Al Maktoum' },
    { cs: 'IGO1457', t: 'A21N', o: 'VABB', gate: 'ESE', to: 'Sharjah' }, { cs: 'BAW109', t: 'A388', o: 'EGLL', gate: 'NW', to: 'Abu Dhabi' }],
  airports: OMDB.AIRPORTS, via: {},
  airlineIcao: OMDB.AIRLINE_ICAO, airlineType: OMDB.AIRLINE_TYPE, defType: 'B77W',
  placeIcao: OMDB.PLACES,
  // ICAO phraseology with Dubai's: the SID by name with its runway and 4,000 ft
  phr: {
    push: (ac, dn, face) => [`cleared to ${dn} via the ${sidSpoken(ac.sid)} departure, runway ${depRw(ac)}, climb altitude 4,000 feet, squawk ${ac.sqk}, push back and start up approved, face ${faceSay(ac, face)}, QNH ${S.wx.qnh}`,
      `cleared ${dn}, ${sidSpoken(ac.sid)}, runway ${depRw(ac)}, 4,000 feet, squawk ${ac.sqk}, push and start approved facing ${faceSay(ac, face)}, QNH ${S.wx.qnh}`],
    startReq: ac => `${OMDB.UNITS.gnd.name}, stand ${ac.stand.id}, ${ac.perf.name} to ${AP[ac.d] ? AP[ac.d][2] : ac.d}, information ${phonetic(S.atis)}, request push and start`,
    checkIn: ac => { const st = starOf(ac.gate, landRw(ac)); return `${APT.radar[0]}, ${greet()}, ${altShort(Math.round(ac.alt/100)*100)} descending ${altShort(ac.tgtAlt)}, ${st.spoken} arrival, information ${phonetic(S.atis)}`; },
    vacated: ac => `${OMDB.UNITS.gnd.name}, runway ${rwyName(ac.rwyId)} vacated via ${PHON[ac.exit] || ac.exit.replace(/~\d+$/, '')}${ac.stand ? ', for stand ' + ac.stand.id : ''}`,
    taxiIn: (ac, st, vw) => { const k = xingAhead(ac), hs = k >= 0 ? `, hold short runway ${rwyName(ac.path.pts[k].hs)}` : '', via = vw.length ? ' via ' + vw.map(t => PHON[t] || t).join(', ') : '';
      return [`taxi to stand ${st.id}${via}${hs}`, `stand ${st.id}${via}${hs}`]; },
    taxiHold: (ac, h, vw) => { const via = vw.length ? ' via ' + vw.map(t => PHON[t] || t).join(', ') : '', r = h.rwy ? rwyName(HOLDS[h.id].on) : null, at = PHON[h.id] || h.id;
      return r ? [`taxi to holding point ${at}${via}, hold short runway ${r}`, `holding point ${at}${via}, holding short ${r}`] : [`taxi${via}, hold at ${at}`, `${via ? via.slice(1) + ', ' : ''}holding at ${at}`]; },
    atHoldPt: (ac, h) => h.rwy ? `holding short runway ${rwyName(HOLDS[h.id].on)} at ${PHON[h.id] || h.id}` : `holding at ${PHON[h.id] || h.id}`
  },
  atisPanel(w){
    const c = windComp(w, crsOf(S.rwy)), bad = !minsOk(w, S.rwy), r = rwyFor(w);
    return `<div class="warnline${bad ? ' bad' : ''}">${flowName()} · land ${S.rwy}, depart ${depRw()}${r.land !== S.rwy || r.dep !== depRw() ? ` (the wind favours ${r.land} / ${r.dep})` : ''} · ${bad ? 'below the minima' : 'ILS approaches'} · crosswind ${Math.round(Math.abs(c.crossG))} kt.${APT.lvp(w) ? ' Low visibility operations.' : ''} The STARs end in long downwind legs: turn arrivals onto base when the spacing is right.</div>`;
  },
  atisLines({ w, L, E }){
    const cl = w.clouds.length ? w.clouds.map(c => { const m = c.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3})/); return m ? `${{ FEW: 'few', SCT: 'scattered', BKN: 'broken', OVC: 'overcast', VV: 'vertical visibility' }[m[1]]} ${(+m[2]*100).toLocaleString('en-GB')} feet` : c; }).join(', ') : 'no significant cloud';
    const out = [
      `This is Dubai International arrival information ${phonetic(L)}, time ${zt(S.t).slice(0,5).replace(':', '')}.`,
      `Expect ILS approach runway ${S.rwy}. Runway in use for departures ${depRw()}.`,
      `Surface wind ${w.vrb ? 'variable' : hdg3(w.dir)} degrees ${w.spd} knots${w.gust ? ', gusting ' + w.gust : ''}. Visibility ${visTxt(w.vis)}${w.wx.length ? ', ' + w.wx.join(' ') : ''}. ${cl.replace(/^./, c => c.toUpperCase())}.`,
      `Temperature ${w.temp}, dew point ${w.dew}. QNH ${w.qnh}. Transition level flight level 150.`
    ];
    if (APT.lvp(w)) out.push('Low visibility operations in force. CAT II and III holding points in use.');
    if (turbExcess(w) > 0) out.push('Moderate turbulence and windshear reported on final.');
    if (E && E.ws) out.push(`Windshear reported on final runway ${E.ws.rw} at ${zt(E.ws.t).slice(0,5).replace(':', '')}, ${E.ws.text}.`);
    if (E && E.rwyBlock) out.push(`Runway ${blockRw()} closed: ${E.rwyBlock.why}. ${parallelEnd(blockRw()) ? `Arrivals expect runway ${parallelEnd(blockRw())}.` : 'Expect delays.'}`);
    if (!minsOk(w, S.rwy)) out.push('Visibility below the approach minima. Expect holding.');
    out.push('Expect to vacate via a rapid exit taxiway as assigned. Do not cross an illuminated stop bar.');
    out.push(`Acknowledge receipt of information ${phonetic(L)} and advise aircraft type on first contact.`);
    return out;
  },
  // the website: home hero, previews, scenario cards and Academy figures
  site: {
    hero: () => [
      ['UAE5', 25.45, 55.10, 120, 230, PAL.light.arr], ['FDB10', 25.10, 55.05, 30, 210, PAL.light.arr], ['QTR1004', 25.40, 54.95, 90, 220, PAL.light.arr],
      ['UAE201', 25.32, 55.15, 300, 250, PAL.light.dep], ['FDB1946', 25.35, 55.20, 330, 240, PAL.light.dep],
      ['UAE412', 25.00, 55.70, 130, 400, 'rgba(60,75,95,.7)'], ['SVA552', 25.70, 54.90, 220, 380, 'rgba(60,75,95,.7)'], ['IGO1451', 25.10, 55.90, 80, 360, 'rgba(60,75,95,.7)']
    ],
    demo(mk, park){
      const fin = add(THR['30L'], norm(CRS['30L'] + 180), 2.6), out = add(THR['30R'], CRS['30R'], 4), dw = WP.DB506 ? WP.DB506.p : add(ARP, 30, 12);
      const hold = endHolds('30R')[0], hp = hold ? GN[HOLDS[hold].node].p : ARP;
      const ids = [firstOf('A', 4), firstOf('B', 3), firstOf('E', 10), firstOf('F', 8)].map(s => s ? s.id : STANDS[0].id);
      return [
        mk('UAE201', 'A388', 'DEP', park(ids[0], { need: null, reqAt: 99999 })), mk('UAE543', 'B77W', 'DEP', park(ids[1], { need: null, reqAt: 99999 })),
        mk('FDB1946', 'B38M', 'DEP', park(ids[2], { need: null, reqAt: 99999 })), mk('UAE314', 'B77W', 'DEP', park(ids[3], { need: null, reqAt: 99999 })),
        mk('FDB1131', 'B38M', 'DEP', { ground: true, state: 'HOLDPT', hp: hold, x: hp[0], y: hp[1], hdg: CRS['30R'], gs: 0 }),
        mk('UAE5', 'A388', 'ARR', { state: 'FINAL', mode: 'FINAL', app: '30L', freq: 'TWR', x: fin[0], y: fin[1], hdg: CRS['30L'], alt: 870, gs: 140, vs: -750, o: 'EGLL' }),
        mk('IGO1451', 'A21N', 'DEP', { state: 'CLIMB', x: out[0], y: out[1], hdg: 301, alt: 3400, gs: 210, vs: 2200, tgtAlt: 4000, d: 'VABB' }),
        mk('FDB10', 'B738', 'ARR', { state: 'INBOUND', x: dw[0], y: dw[1], hdg: 121, alt: 6000, gs: 210, vs: 0, tgtAlt: 6000, o: 'OTHH' })
      ];
    },
    thumb(k, zoom, W){
      if (k === 'app') return v => { v.scale *= 1.3; };
      if (k === 'twr') { const c = R0.rm(R0.len*0.5, -200); return v => { v.cx = c[0]; v.cy = c[1]; v.scale = W/4.2; }; }
      const c = zoom === 'apron' ? (firstOf('F', 8) || STANDS[0]).p : R0.rm(R0.len*0.45, -300);
      return v => { v.cx = c[0]; v.cy = c[1]; v.scale = W/((zoom === 'apron' ? 800 : 4400)*M2NM); };
    },
    figHold: 'VUTEB', emergHp: 'N10',
    figConsole: v => { v.scale *= 1.2; },
    cmdHint: 'Command, e.g. UAE5 DCT DB506 · UAE5 APP · FDB1946 TAXI · / to focus, Tab cycles flights'
  }
};
// hangars (OpenStreetMap): the Emirates Engineering hangars north of the runways. Aircraft stored there at the start of a
// session are towed to a stand an hour before departure.
APT.hangars = G.buildings.filter(b => b.roof === 'hangar').map(b => { const n = b.pts.length, c = b.pts.reduce((a, p) => [a[0] + p[0]/n, a[1] + p[1]/n], [0, 0]); return { c, area: Math.abs(b.pts.reduce((a, p, i) => a + p[0]*b.pts[(i + 1) % n][1] - b.pts[(i + 1) % n][0]*p[1], 0))/2, name: b.name }; })
  .filter(h => h.area > 4000).sort((a, b) => b.area - a.area).slice(0, 4)
  .map(h => [h, (nearestNode(EN(...h.c), nd => !/^[Rxs]/.test(nd.id)) || {}).id]).filter(([h, node]) => node && GN[node] && dist(...EN(...h.c), ...GN[node].p)/M2NM < 260)
  .map(([h, node], i) => ({ id: 'H' + (i + 1), name: h.name || 'Emirates Engineering', in: inF0(...h.c), door: [GN[node].m, GN[node].off], node, to: ['civil', 'remote'],
    fits: ac => /^(UAE)$/.test(ac.cs.slice(0, 3)), pick: ac => APT.standFor(ac) }));
APT.queuePen = true;   // taxi-in routes go round lanes where departures are queued
