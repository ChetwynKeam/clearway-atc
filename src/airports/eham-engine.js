// ═════════════════════════ Amsterdam Schiphol (EHAM) airport profile for the engine ═════════════════════════
// Builds every global the engine reads from the chart data in eham.js (EHAM) and the aerodrome in eham-ground.js (metres
// east and north of the ARP). Six runways, every one with its own frame: 18R/36L (the Polderbaan, 60 m wide, far to the
// north-west), 18C/36C, 18L/36R (crossed by 09/27), 06/24, 09/27 and 04/22. The runways in use are a combination from the
// preferential runway system (CONFIGS in eham.js): its landing runways, each fed by the arrivals from its own side, and its
// take-off runways, each taking the departures whose direction suits it. S.rwy is the first landing runway, S.depRwy the
// first take-off runway; the runway operations panel can set every runway end on its own.
Object.assign(TYPES, EHAM.TYPES);
const LL = p => xy(p[0], p[1]);
const G = EHAM_GROUND;
const EN = (e, n) => [e*M2NM, n*M2NM];                     // metres east and north of the ARP (the map origin) → NM

// ═════════════════════════ runways ═════════════════════════
// a frame along each runway: m from the pavement end a (the low-numbered end), off to the left
const STOPWAY = {};
function rwyFrame(r){
  const a = EN(...r.a), b = EN(...r.b), L = dist(...a, ...b), RU = [(b[0]-a[0])/L, (b[1]-a[1])/L], RN = [-RU[1], RU[0]];
  const rm = (m, off=0) => [a[0] + (RU[0]*m + RN[0]*off)*M2NM, a[1] + (RU[1]*m + RN[1]*off)*M2NM];
  const mOf = p => ((p[0]-a[0])*RU[0] + (p[1]-a[1])*RU[1])/M2NM, offOf = p => ((p[0]-a[0])*RN[0] + (p[1]-a[1])*RN[1])/M2NM;
  const len = r.len, sw = STOPWAY[r.id] || [0, 0];
  const TURN_W = [[30, 0]], TURN_E = [[len - 30, 0]];
  return { id: r.id, lo: r.lo, hi: r.hi, len, m0: -sw[0], m1: len + sw[1], thr: r.thr, elev: r.elev, rm, mOf, offOf, RU, TURN_W, TURN_E, TURN_END: { W: 30, E: len - 30 },
    roll: [70, len - 70], ends: true, width: r.width || 45 };
}
// 18C/36C first: the runway the engine falls back on
const RWY_LIST = ['18C36C', '18R36L', '18L36R', '0624', '0927', '0422'].map(id => rwyFrame(G.runways.find(r => r.id === id)));
const R0 = RWY_LIST[0];
const rm = R0.rm, mOf = R0.mOf, offOf = R0.offOf, RU = R0.RU;
const RWY_M = R0.len, THR_LO_M = R0.thr['18C'], THR_HI_M = R0.thr['36C'];
const RW_LO = '18C', RW_HI = '36C';
const THR = {}, CRS = {}, THR_ELEV = {};
for (const R of RWY_LIST) {
  THR[R.lo] = R.rm(R.thr[R.lo], 0); THR[R.hi] = R.rm(R.thr[R.hi], 0);
  CRS[R.lo] = brg(...R.rm(0), ...R.rm(R.len)); CRS[R.hi] = norm(CRS[R.lo] + 180);
  THR_ELEV[R.lo] = R.elev[R.lo]; THR_ELEV[R.hi] = R.elev[R.hi];
}
const T_LO = THR[RW_LO], T_HI = THR[RW_HI], CRS_LO = CRS[RW_LO], CRS_HI = CRS[RW_HI];
const crsOf = rw => CRS[rw] ?? CRS_HI;
const ELEV = EHAM.elev;
const ARP = LL(EHAM.arp);
const parallelOf = rw => ({ '18R': '18C', '18C': '18R', '36C': '36R', '36R': '36C', '18L': '18C', '36L': '36C' })[rw];
const XING_M = -1e9, XING_SKEW = 0, XING_HW = 0, xingM = o => XING_M;
const FRONTIER = [], R164 = [], ROCK = [], ROCK_TOP = [0, 0];
const TURN_W = R0.TURN_W, TURN_E = R0.TURN_E, TURN_END = R0.TURN_END, TURN_PAD = {};
const RWYS_BY_END = rw => RWY_LIST.find(R => R.lo === rw || R.hi === rw) || R0;

// ═════════════════════════ the clock: Amsterdam time ═════════════════════════
// Central European Time, UTC+1, and summer time UTC+2 from the last Sunday of March to the last Sunday of October
const lastSun = (y, mo) => { const d = new Date(Date.UTC(y, mo + 1, 0)); return Date.UTC(y, mo, d.getUTCDate() - d.getUTCDay(), 1); };
const amsOff = ms => { const y = new Date(ms).getUTCFullYear(); return ms >= lastSun(y, 2) && ms < lastSun(y, 9) ? 120 : 60; };
function clockMs(){
  if (S.running && S.start) return S.start + S.t*1000;
  const ts = document.getElementById('trafficSel'), mode = ts ? ts.value : '';
  if (EXERCISES[mode]) return null;
  if (/^live/.test(mode)) return Date.now();
  const d = +((document.getElementById('daySel') || {}).value || 0), h = +((document.getElementById('hourSel') || {}).value || 12);
  return Date.UTC(2026, 10, 16 + d, Math.floor(h));
}
const localMin = () => { const t = clockMs(); if (t == null) return null; const L = new Date(t + amsOff(t)*60000); return L.getUTCHours()*60 + L.getUTCMinutes(); };

// ═════════════════════════ runway combinations ═════════════════════════
const CFG = EHAM.CONFIGS;
// the combination a landing runway belongs to (the first one that lands on it)
const configOf = rw => Object.keys(CFG).find(k => CFG[k].land.includes(rw)) || 'south';
const cfgNow = () => configOf(S.rwy);
const landList = () => CFG[cfgNow()].land;
const depList = () => S.depRwy && !CFG[cfgNow()].dep.includes(S.depRwy) ? [S.depRwy] : CFG[cfgNow()].dep;
const depFor = rw => CFG[configOf(rw)].dep[0];
const depOf = () => S.depRwy || depFor(S.rwy);
// by the wind (AD 2.21: tailwind and crosswind limits of the preferential system; gusts under 10 kt not counted): the
// first combination in the order of preference whose runways all have a tailwind of 7 kt or less and a crosswind of
// 20 kt or less, else the one with the most headwind
const PREF = ['south', 'north', 'west', 'east'];
function rwyFor(w){
  const calm = w.vrb || w.spd < 4, g = gw => ({ ...w, gust: w.gust && w.gust - w.spd >= 10 ? w.gust : 0 });
  const ok = k => [...CFG[k].land, ...CFG[k].dep].every(rw => { const c = windComp(g(w), crsOf(rw)); return calm || (c.headG >= -7 && c.crossG <= 20); });
  const k = PREF.find(ok) || PREF.slice().sort((a, b) => windComp(w, crsOf(CFG[b].land[0])).head - windComp(w, crsOf(CFG[a].land[0])).head)[0];
  return { land: CFG[k].land[0], dep: CFG[k].dep[0] };
}
// an arrival's landing runway: where two land, the one nearer its initial approach fix's side
const IAF_OF = g => (EHAM.STARS[(EHAM.DIR[g] || {}).star] || {}).iaf || 'SUGOL';
function landFor(ac){
  const L = landList(); if (L.length < 2 || !ac) return L[0];
  const f = WP[IAF_OF(ac.gate)]; if (!f) return L[0];
  return L.slice().sort((a, b) => dist(...f.p, ...THR[a]) - dist(...f.p, ...THR[b]))[0];
}
// a departure's take-off runway: where two depart, the one whose heading is nearer the destination's bearing
function depForAc(ac){
  const D = depList(); if (D.length < 2 || !ac) return D[0];
  const b = ac.d ? destBrg(ac.d) : null; if (b == null) return D[0];
  return D.slice().sort((x, y) => Math.abs(angDiff(crsOf(x), b)) - Math.abs(angDiff(crsOf(y), b)))[0];
}

// ═════════════════════════ taxiways, holding points, stands (eham-ground.js) ═════════════════════════
const inF0 = (e, n) => { const p = EN(e, n); return [mOf(p), offOf(p)]; };
for (const [id, e, n] of G.nodes) gn(id, ...inF0(e, n));
for (const [id, e, n] of G.rnodes) gn(id, ...inF0(e, n));
// a runway crossing (through an x node on the centreline) follows its holding points' own links to the runway edge, so it
// is an unpainted link (bare): drawn as those links and the runway, not as a lane of its own
for (const [a, b, tw, mid] of G.edges) { const n0 = GE.length; chain(a, mid.map(([e, n]) => inF0(e, n)), b, tw);
  if (a[0] === 'x' || b[0] === 'x') for (let i = n0; i < GE.length; i++) GE[i].bare = true; }
const HOLDS = {}, FIL = {};
const CAT23 = new Set(G.cat23 || []);
for (const [k, [node, rwy, on, m, off, dirs, end]] of Object.entries(G.holds)) {
  HOLDS[k] = { node, rwy, on, m, off, dirs: dirs.split(',').filter(Boolean), end: end || null, ref: k.replace(/~\d+$/, '') };
  HOLDS[k].base = ((G.hside || {})[HOLDS[k].ref] || [])[0];
  { const Rh = RWY_LIST.find(R => R.id === on) || RWY_LIST[0], n0 = GE.length;
    chain(rwy, ((G.hlink || {})[k] || []).map(([mm, oo]) => { const p = Rh.rm(mm, oo); return [mOf(p), offOf(p)]; }), node, HOLDS[k].base || HOLDS[k].ref);
    for (let i = n0; i < GE.length; i++) GE[i].hl = true; }
  FIL[k] = { W: G.fil[k], E: G.fil[k] };
}
const RET_NODES = new Set((G.ret || []).map(k => HOLDS[k] && HOLDS[k].node).filter(Boolean));
for (const [id, rid] of Object.entries(G.hs)) if (GN[id]) GN[id].p.hs = rid;
// stands (AIP parking/docking charts): the B to H and M piers, the D- and E-aprons, the A-apron (cargo and remote), the
// S-apron (cargo), the Y-apron, the J-apron (by the de-icing pads; not controlled by ATC) and the K-apron (general
// aviation, Schiphol East). The U-apron (towing only) and the de-icing pads P10-P16 are never allocated to a flight.
const AREA_OF = { B: 'pier', C: 'pier', D: 'pier', E: 'pier', F: 'pier', G: 'pier', H: 'pier', M: 'pier', DA: 'remote', EA: 'remote', A: 'remote', S: 'cargo',
  Y: 'remote', J: 'remote', K: 'ga' };
const STANDS = G.gates.filter(g => g[7] !== 'TT' && g[7] !== 'DI').map(g => { const [id, term, [e, n], node] = g, p = EN(e, n), sp = +g[6] || null;
  return { id, term, p, m: mOf(p), off: offOf(p), node, area: AREA_OF[term] || 'remote', occ: null, noLead: !g[5], line: g[5] ? g[5].map(([x, y]) => EN(x, y)) : null,
    use: g[7], h0: g[4], ...(sp ? { maxSpan: Math.round(sp*10)/10 } : {}), ...((G.vac || {})[id] ? { vacant: G.vac[id] } : {}) }; });
// the AIP gives the stop position (the nose): the aircraft's middle is set back along the lead-in by half the length of
// the largest type the stand takes (never more than 40% of the lead-in)
STANDS.forEach(s => { s.lp = GN[s.node].p; const L = dist(...s.lp, ...s.p)/M2NM, half = s.maxSpan ? Math.min(34, Math.max(11, s.maxSpan*0.52)) : 20, k = Math.min(half, L*0.4);
  if (L > 12) { const u = [(s.lp[0] - s.p[0])/(L*M2NM), (s.lp[1] - s.p[1])/(L*M2NM)]; s.p = [s.p[0] + u[0]*k*M2NM, s.p[1] + u[1]*k*M2NM]; s.m = mOf(s.p); s.off = offOf(s.p); }
  s.hdg = L > 3 ? brg(...s.lp, ...s.p) : (s.h0 ?? 0); });
// two holding points' links that cross on the way to the runway (N3 and N9, the two rapid exits off 09/27 that make an X):
// a node where they cross, so the two lanes meet there (the turn from one to the other is far too sharp to take)
function crossLinks(){
  const isLink = e => e.hl || (e.a + e.b).includes('sk'), inner = v => v > 0.02 && v < 0.98;
  // where p-q meets a-b: [t along p-q, u along a-b, the point]
  const xpt = (p, q, a, b) => { const d = (q[0]-p[0])*(b[1]-a[1]) - (q[1]-p[1])*(b[0]-a[0]); if (Math.abs(d) < 1e-14) return null;
    const t = ((a[0]-p[0])*(b[1]-a[1]) - (a[1]-p[1])*(b[0]-a[0]))/d, u = ((a[0]-p[0])*(q[1]-p[1]) - (a[1]-p[1])*(q[0]-p[0]))/d;
    return t > -0.02 && t < 1.02 && u > -0.02 && u < 1.02 ? [t, u, [p[0] + t*(q[0]-p[0]), p[1] + t*(q[1]-p[1])]] : null; };
  const all = GE.filter(e => !e.bare && !/^R/.test(e.a) && !/^R/.test(e.b)), C = 0.06, grid = new Map(), key = (x, y) => x + ',' + y;
  for (const e of all) { const a = GN[e.a].p, b = GN[e.b].p;
    for (let x = Math.floor(Math.min(a[0], b[0])/C); x <= Math.floor(Math.max(a[0], b[0])/C); x++) for (let y = Math.floor(Math.min(a[1], b[1])/C); y <= Math.floor(Math.max(a[1], b[1])/C); y++) {
      const k = key(x, y); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(e); } }
  const splits = new Map(), seen = new Set(), add = (e, t, id) => { if (!splits.has(e)) splits.set(e, []); if (!splits.get(e).some(([, v]) => v === id)) splits.get(e).push([t, id]); };
  let nX = 0;
  for (const e1 of all.filter(isLink)) { const a = GN[e1.a].p, b = GN[e1.b].p, cand = new Set();
    for (let x = Math.floor(Math.min(a[0], b[0])/C); x <= Math.floor(Math.max(a[0], b[0])/C); x++) for (let y = Math.floor(Math.min(a[1], b[1])/C); y <= Math.floor(Math.max(a[1], b[1])/C); y++) for (const e of grid.get(key(x, y)) || []) cand.add(e);
    for (const e2 of cand) { if (e1 === e2 || [e1.a, e1.b].some(v => v === e2.a || v === e2.b)) continue;
      if (e1.tw === e2.tw && !(e1.a + e1.b + e2.a + e2.b).includes('sk')) continue;   // a stop bar's own turn-offs, overlapping
      const pk = [GE.indexOf(e1), GE.indexOf(e2)].sort().join(); if (seen.has(pk)) continue; seen.add(pk);
      const r = xpt(a, b, GN[e2.a].p, GN[e2.b].p); if (!r) continue; const [t, u, q] = r;
      if (inner(t) && inner(u)) { const id = 'kx' + (nX++); gn(id, mOf(q), offOf(q)); add(e1, t, id); add(e2, u, id); }
      else if (inner(t)) add(e1, t, u < 0.5 ? e2.a : e2.b);      // e2 ends on e1: a T, joined there
      else if (inner(u)) add(e2, u, t < 0.5 ? e1.a : e1.b); } }
  for (const [e, ss] of splits) { const hl = e.hl, line = e.line; GE.splice(GE.indexOf(e), 1);
    GN[e.a].adj = GN[e.a].adj.filter(([, x]) => x !== e); GN[e.b].adj = GN[e.b].adj.filter(([, x]) => x !== e);
    const seq = [e.a, ...ss.sort((x, y) => x[0] - y[0]).map(([, id]) => id), e.b];
    for (let i = 1; i < seq.length; i++) { ge(seq[i-1], seq[i], e.tw); const ne = GE[GE.length - 1]; if (hl) ne.hl = true; if (line) ne.line = line; } }
}
joinGaps(); tFillets({ R: 30 }); kinkLinks(); smoothKinks(); crossLinks();
const APRONS = G.aprons.map(r => r.map(([e, n]) => inF0(e, n)));
{ const civ = STANDS.filter(s => s.area === 'pier'), c = civ.reduce((a, s) => [a[0] + s.p[0]/civ.length, a[1] + s.p[1]/civ.length], [0, 0]); for (const R of RWY_LIST) R.side = Math.sign(R.offOf(c)) || 1; }

// taxiway names as said: letter by letter with the digits as numbers (A19W "Alfa 19 Whiskey"); the intermediate holding
// positions as the AIP names them (VK "Victor Kilo")
const NATO = { A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike',
  N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu' };
const twyWords = t => { const b = t.replace(/~\d+$/, '');
  return (b.match(/[A-Z]|\d+/g) || [b]).map(x => NATO[x] || x).join(' '); };
const PHON = {};
for (const e of GE) if (e.tw && e.tw !== 'APRON' && !PHON[e.tw]) PHON[e.tw] = twyWords(e.tw);
for (const k of Object.keys(HOLDS)) PHON[k] = twyWords(k);
const IHP_LIST = (G.ihps || []).filter(([id, node]) => GN[node]).map(([id, node]) => ({ id, node, ph: twyWords(id), alias: [] }));
for (const h of IHP_LIST) PHON[h.id] = h.ph;
for (const [k, [ref, w]] of Object.entries(G.hside || {})) { PHON[k] = twyWords(ref) + (w ? ', ' + w : ''); for (const v of Object.keys(HOLDS)) if (HOLDS[v].ref === k) PHON[v] = PHON[k]; }
PHON.APRON = 'the apron';

// ── departure entries: the holding points at the runway end (the full length) and the AIP's intersection take-off points
// (AD 2.13: S8, S6 ... on 24; E5, E4 ... on 18L), each only where the aircraft can turn onto the runway the way it departs
const endHolds = rw => Object.keys(HOLDS).filter(k => HOLDS[k].end === rw);
const intxRun = (k, rw) => { const tr = (G.tora || {})[rw + '|' + HOLDS[k].ref]; if (tr) return tr;
  const H = HOLDS[k], R = rwyById(H.on), m = R.mOf(GN[H.rwy].p); return rw === R.lo ? R.len - m : m; };
const intxWay = (k, rw) => HOLDS[k].dirs.includes(rw);
const intxHolds = rw => Object.keys(HOLDS).filter(k => { const H = HOLDS[k], R = RWYS_BY_END(rw);
    return H.on === R.id && !H.end && ((G.intx || {})[rw] || []).includes(H.ref) && intxWay(k, rw); })
  .sort((a, b) => intxRun(b, rw) - intxRun(a, rw));
const depHolds = rw => [...endHolds(rw), ...intxHolds(rw)];
const depHoldAs = (ac, hp) => { const rw = depRw(ac), ok = depHolds(rw); if (!HOLDS[hp] || ok.includes(hp)) return hp;
  return ok.find(k => HOLDS[k].ref === HOLDS[hp].ref) || hp; };
function depHold(ac){
  const rw = depRw(ac), from = ac.stand && !ac.leftStand ? ac.stand.node : (nearestNode([ac.x, ac.y], n => !/^R/.test(n.id)) || {}).id;
  const ks = endHolds(rw).length ? endHolds(rw) : depHolds(rw); let best = ks[0], bl = Infinity;
  if (!from) return best;
  const rs = routesFrom(from, ks.map(k => HOLDS[k].node));
  for (const k of ks) { const r = rs.get(HOLDS[k].node), L = r ? pathLen(r.nodes) : Infinity; if (L < bl) { bl = L; best = k; } }
  return best;
}
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
// the side of the runway an arrival vacates to: the terminal's, or its stand's
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
const AD_SITE = { pave: { w: 23 }, aprons: APRONS, roads: [], buildings: [], twyExtra: [], shoulder: [0, RWY_M], serviceRoad: false, paag: [], floods: [], twyLabels: [], hotspots: [], labels: [] };
const TERM_NAME = { B: 'B-PIER', C: 'C-PIER', D: 'D-PIER', E: 'E-PIER', F: 'F-PIER', G: 'G-PIER', H: 'H-PIER', M: 'M-PIER', DA: 'D-APRON', EA: 'E-APRON',
  A: 'A-APRON', S: 'S-APRON', Y: 'Y-APRON', J: 'J-APRON', K: 'K-APRON' };
const TERM_LABELS = (() => { const by = {}; for (const s of STANDS) (by[s.term] ||= []).push(s.p); return Object.entries(by).map(([t, ps]) => [TERM_NAME[t] || t, ps.reduce((a, p) => [a[0] + p[0]/ps.length, a[1] + p[1]/ps.length], [0, 0])]); })();
// the hot spots (ground movement chart; each circle's centre and size measured off the chart): HS1 where C and D meet A and B (follow A or B as instructed), HS2 by G1 and the
// K-apron exit GD (hold short of 22), HS3 where W9, W10, Z, A and B meet by the 36C end
const HS_AT = (e, n) => EN(e, n);
const HOTSPOTS = [
  { id: 'HS1', c: HS_AT(-1518, 814), r: 132, note: 'Pilots on C instructed to taxi via A (and Q) go straight ahead southbound on A; on D via B (and P), straight ahead southbound on B.' },
  { id: 'HS2', c: HS_AT(2704, 575), r: 158, note: 'G1 is right opposite the K-apron exit GD: hold short of runway 22 unless instructed otherwise by Schiphol Tower.' },
  { id: 'HS3', c: HS_AT(-1597, -510), r: 200, note: 'Continue on A or B unless instructed otherwise; Z northbound continues on A; no turn from A28 onto B. After vacating 18C via W9 or W10, only south on A or north on B.' }
];
const paveW = tw => 23;
function drawEham(){
  const sc = V.scale, mpx = sc/1852, IMG = mapImagery();
  const P2 = p => [sx(p[0]), sy(p[1])];
  const pathP = (pts, close = true) => { cx.beginPath(); pts.forEach((p, i) => cx[i ? 'lineTo' : 'moveTo'](...P2(p))); if (close) cx.closePath(); };
  const lw = m => Math.max(1, m*mpx);
  const rwyPoly = (R, w, m0 = 0, m1 = R.len) => [R.rm(m0, -w/2), R.rm(m1, -w/2), R.rm(m1, w/2), R.rm(m0, w/2)];
  // 09/27 first, so 18L/36R's pavement and paint run on over it
  const ORDER = [RWY_LIST[4], ...RWY_LIST.filter((R, i) => i !== 4)];
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
  // the taxiway bridges (A and B over the A4, V over the Hoofdvaart and the Hoofdweg): the deck a little wider than the
  // taxiway, with a parapet each side and the abutments marked at each end
  if (sc > 110) for (const [, line] of G.bridges || []) {
    const P = line.map(([e, n]) => EN(e, n)), hw = 23/2 + 6, side = k => P.map((p, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], h = brg(...a, ...b) + 90*k; return add(p, h, hw*M2NM); });
    const L = side(1), Rr = side(-1);
    cx.fillStyle = IMG ? 'rgba(120,124,128,.55)' : C.asphalt; pathP([...L, ...Rr.slice().reverse()]); cx.fill();
    cx.strokeStyle = C.name === 'dark' ? 'rgba(220,226,230,.8)' : 'rgba(60,64,70,.85)'; cx.lineWidth = Math.max(1.2, lw(1.2));
    for (const s of [L, Rr]) { pathP(s, false); cx.stroke(); }
    for (const i of [0, P.length - 1]) { pathP([L[i], Rr[i]], false); cx.stroke(); }
  }
  for (const R of ORDER) {
    cx.fillStyle = rgba('rwyOut', .55); pathP(rwyPoly(R, R.width + 15, R.m0, R.m1)); cx.fill();
    cx.fillStyle = C.rwy; pathP(rwyPoly(R, R.width, R.m0, R.m1)); cx.fill();
    if (sc > 150) drawRwyPaint(R, P2, pathP, lw, mpx);
  }
  if (sc > 150) {
    { const seen = new Set(), leads = []; for (const k in FIL) { for (const f of (G.leads || {})[k] || [FIL[k].W]) { const key = HOLDS[k].on + JSON.stringify(f); if (seen.has(key)) continue; seen.add(key);
      const R = rwyById(HOLDS[k].on), L = leadLine(f), sd = Math.sign(L[L.length - 1][1]) || 1;
      leads.push(L.map(([m, o]) => P2(R.rm(m, Math.abs(o) < 0.9 ? sd*0.9 : o)))); } }
      groundLines(lw(0.35), () => leads.forEach(strokeSmooth)); }
    paintEdgeLines(lw(0.35));
    // runway holding positions, pattern A, and at Schiphol every one a stop bar: a row of red lights across the taxiway
    cx.fillStyle = '#f5c518'; cx.strokeStyle = '#f5c518';
    for (const [id, rid] of Object.entries(G.hs)) {
      const n = GN[id]; if (!n || RET_NODES.has(id)) continue; const R = rwyById(rid), ws = waysOn(id); if (!ws.length) continue;
      let d = brg(...n.p, ...GN[ws[0][0]].p); if (Math.abs(R.offOf(add(n.p, d, 5*M2NM))) > Math.abs(R.offOf(n.p))) d += 180;
      const at = (k, w) => add(add(n.p, d, k*M2NM), d + 90, w*M2NM);
      cx.lineWidth = lw(0.3);
      for (const [k, dash] of [[-0.9, false], [-0.3, false], [0.3, true], [0.9, true]]) { cx.setLineDash(dash ? [mpx + 1, mpx + 1] : []); pathP([at(k, -11), at(k, 11)], false); cx.stroke(); }
      cx.setLineDash([]);
    }
    groundLines(lw(0.3), () => { for (const s of STANDS) if (!s.noLead) { if (s.line && s.line.length > 1 && s.lineOk !== false) { if (s.lineOk == null) { const L = s.line.reduce((a, q, i) => i ? a + dist(...s.line[i-1], ...q) : 0, 0); s.lineOk = L < 1.25*dist(...s.line[0], ...s.line[s.line.length-1]) + 10*M2NM; } if (s.lineOk) { pathP(s.line, false); cx.stroke(); continue; } } const L = dist(...s.lp, ...s.p)/M2NM, f = L > 90 ? 1 - 90/L : 0; pathP([[s.lp[0] + (s.p[0] - s.lp[0])*f, s.lp[1] + (s.p[1] - s.lp[1])*f], s.p], false); cx.stroke(); } });
    cx.save(); if (IMG) clipOut(G.buildings.map(b => b.pts.map(([e, n]) => P2(EN(e, n))))); drawStandDetail(null, null, mpx, false); cx.restore();
    drawGroundSigns();
  }
}
// ICAO Annex 14 runway markings: edge lines, the centreline between the thresholds, threshold stripes (16 on the 60 m
// Polderbaan, 12 on the others), the aiming point (400 m in) and touchdown zone bars, the designators and the arrows
// before a displaced threshold (06, 09, 36C, 18R, 18L)
function drawRwyPaint(R, P2, pathP, lw, mpx){
  const hw = R.width/2 - 1.5, quad = (m1, o1, m2, o2) => { pathP([R.rm(m1, o1), R.rm(m2, o1), R.rm(m2, o2), R.rm(m1, o2)]); cx.fill(); };
  cx.fillStyle = C.paint; cx.strokeStyle = C.paint;
  cx.lineWidth = lw(0.9); pathP([R.rm(0, hw), R.rm(R.len, hw)], false); cx.stroke(); pathP([R.rm(0, -hw), R.rm(R.len, -hw)], false); cx.stroke();
  cx.beginPath(); for (let m = R.thr[R.lo] + 110; m < R.thr[R.hi] - 120; m += 50) { const [a, b] = [P2(R.rm(m, 0)), P2(R.rm(Math.min(m + 30, R.thr[R.hi] - 110), 0))]; cx.moveTo(...a); cx.lineTo(...b); } cx.stroke();
  const n = R.width >= 60 ? 8 : 6, aim = R.len >= 2400 ? 400 : 300, tdz = [[150, 3], [300, 3], [450, 2], [600, 2], [750, 1], [900, 1]];
  for (const [m0, dir] of [[R.thr[R.lo], 1], [R.thr[R.hi], -1]]) {
    quad(m0, -hw, m0 + dir*1.8, hw);
    for (let i = 0; i < n; i++) for (const k of [-1, 1]) { const o = k*(3 + i*(hw - 3)/n); quad(m0 + dir*6, o, m0 + dir*36, o + k*1.8); }
    for (const k of [-1, 1]) quad(m0 + dir*aim, k*6, m0 + dir*(aim + 50), k*16);
    for (const [d, c] of tdz) if (d !== aim) for (const k of [-1, 1]) for (let j = 0; j < c; j++) { const o = k*(6 + j*3.6); quad(m0 + dir*d, o, m0 + dir*(d + 22.5), o + k*1.8); }
    const pre = dir > 0 ? m0 : R.len - m0;
    if (pre > 60) {
      cx.lineWidth = lw(0.9);
      for (let d = 30; d < pre - 15; d += 60) { const m = m0 - dir*d; pathP([R.rm(m - dir*18, 0), R.rm(m, 0)], false); cx.stroke(); pathP([R.rm(m - dir*8, -3), R.rm(m, 0), R.rm(m - dir*8, 3)], false); cx.stroke(); }
      for (const k of [-1, 1]) { const m = m0 - dir*8; pathP([R.rm(m - dir*10, k*6), R.rm(m, k*10), R.rm(m - dir*10, k*14)], false); cx.stroke(); }
    }
  }
  for (const [rw, m0] of [[R.lo, R.thr[R.lo] + 70], [R.hi, R.thr[R.hi] - 70]]) drawRwyDesignator(...P2(R.rm(m0, 0)), rw, crsOf(rw), Math.max(9, 16*mpx));
}
function drawEhamTop(){
  const sc = V.scale, mpx = sc/1852, IMG = mapImagery();
  const P2 = p => [sx(p[0]), sy(p[1])];
  if (sc > 110) {
    cx.save(); cx.globalCompositeOperation = C.glow;
    const r = Math.max(1.1, 0.9*mpx), glow = (p, col) => { const [X, Y] = P2(p); cx.fillStyle = col; cx.beginPath(); cx.arc(X, Y, r, 0, 7); cx.fill(); };
    for (const R of RWY_LIST) {
      if (!rwysInUse().some(rw => RWYS_BY_END(rw) === R)) continue;
      const hw = R.width/2 + 0.5;
      for (let m = 0; m <= R.len; m += 60) { glow(R.rm(m, hw), 'rgba(255,244,214,.75)'); glow(R.rm(m, -hw), 'rgba(255,244,214,.75)'); }
      for (let o = -hw + 1; o <= hw - 1; o += 4) { glow(R.rm(R.thr[R.lo], o), 'rgba(90,255,140,.9)'); glow(R.rm(R.thr[R.hi], o), 'rgba(90,255,140,.9)'); }
      if (R.id !== '0422') for (let m = R.thr[R.lo]; m <= R.thr[R.hi]; m += 30) glow(R.rm(m, 0), m > R.thr[R.hi] - 900 ? 'rgba(255,90,90,.7)' : 'rgba(255,250,235,.55)');
    }
    cx.restore();
  }
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
const STAR_LIST = Object.values(EHAM.STARS);
const STAR_FIXES = new Set(STAR_LIST.flatMap(s => s.pts.map(p => p[0])));
const SID_FIXES = new Set(Object.values(EHAM.SIDS).flatMap(s => s.pts));
const APP_FIXES = new Set(Object.values(EHAM.ILS).flatMap(i => [i.ifx, i.faf]));
for (const [id, p] of Object.entries(EHAM.FIX)) wp(id, p[0], p[1], (STAR_FIXES.has(id) || APP_FIXES.has(id)) && !/^AM\d/.test(id) ? {} : { minor: true });
for (const [id, n] of Object.entries(EHAM.NAV)) wp(id, ...n.p, { note: `${n.name} ${n.freq}` });
for (const id of Object.keys(EHAM.FIX)) if (/^AM\d/.test(id)) WP[id].hide = true;
const RADAR_REF = ARP;
for (const [id, h] of Object.entries(EHAM.HOLDS_AIR)) if (WP[id]) WP[id].hold = { inb: Math.round(h.inb), min: h.min, left: h.turn === 'L' };
const GATES = Object.keys(EHAM.DIR);
const starOf = (g, rw) => EHAM.STARS[EHAM.DIR[g].star];
const ENTRY = Object.fromEntries(GATES.map(g => [g, WP[EHAM.DIR[g].entry].p]));
const ENTRY_ALT = Object.fromEntries(GATES.map(g => [g, 15000]));
const PRE_ALT = Object.fromEntries(GATES.map(g => [g, ENTRY_ALT[g] + 14000]));

// ── approaches: the localiser from 3 NM outside the intermediate fix, the 3° glidepath from its altitude
const FINAL = {};
for (const [rw, I] of Object.entries(EHAM.ILS)) {
  if (!THR[rw]) continue;
  const thr = THR[rw], out = norm(crsOf(rw) + 180), dIF = dist(...thr, ...WP[I.ifx].p), dFAF = dist(...thr, ...WP[I.faf].p), elev = THR_ELEV[rw];
  const M = EHAM.MINS[I.cat], low = Math.round((elev + 1000)/100)*100;
  const F = { pts: [add(thr, out, dIF + 3), add(thr, out, dIF), thr], alts: [I.ifAlt, I.ifAlt, elev + 50], elev, entry: I.ifx, entryName: I.ifx, name: 'ILS ' + rw, alt: I.ifAlt,
    decName: I.faf, decNM: dFAF + 0.2, decMin: Math.max(1.6, dFAF - 1.6), minAlt: low, minText: `${low.toLocaleString('en-GB')} ft`,
    mins: M, minRate: 300, missed: I.missed.slice(), missAlt: I.missAlt,
    phrase: r => `cleared ILS approach runway ${r}, report established`, read: r => `cleared ILS ${r}, wilco`,
    decCall: r => `${APT.tower[0]}, ${I.faf.replace(/^AM/, 'A M ')}, ILS runway ${r}`, decNeed: `Inbound past the final approach fix, needs landing clearance`, decFail: 'not visual at minima' };
  F.cum = new Array(F.pts.length).fill(0); for (let i = F.pts.length - 2; i >= 0; i--) F.cum[i] = F.cum[i+1] + dist(...F.pts[i], ...F.pts[i+1]);
  const meet = (I.ifAlt - elev - 50)/318;
  F.prof = [[0, elev + 50], [meet, I.ifAlt], [F.cum[0] + 1, I.ifAlt]];
  FINAL[rw] = F;
}
// the route to the intermediate fix: the STAR to its initial approach fix, then (by day, radar vectors) the intermediate fix
const LAND_RWYS = Object.keys(FINAL);
const ARR_ROUTE = Object.fromEntries(GATES.map(g => [g, Object.fromEntries(LAND_RWYS.map(rw => {
  const st = starOf(g, rw).pts.map(p => p[0]);
  return [rw, [...st, EHAM.ILS[rw].ifx]];
}))]));
const HOLD_AT = Object.fromEntries(GATES.map(g => [g, IAF_OF(g)]));
const ARR_ALT = (() => { const m = {}; for (const s of STAR_LIST) for (const [id, a] of s.pts) if (a && m[id] == null) m[id] = a;
  for (const I of Object.values(EHAM.ILS)) m[I.ifx] = I.ifAlt; return m; })();

// ── departures: the SID of the take-off runway whose end is nearest the destination's bearing
const catOf = ac => 'CD';
const SID_BY_RWY = {};
for (const [n, s] of Object.entries(EHAM.SIDS)) (SID_BY_RWY[s.rwy] ||= []).push(n);
const ARP_LL = EHAM.arp;
const destBrg = icao => { const A = (EHAM.AIRPORTS[icao]) || (typeof AP !== 'undefined' && AP[icao]); if (!A) return null;
  const r = Math.PI/180, la1 = ARP_LL[0]*r, la2 = A[0]*r, dl = (A[1] - ARP_LL[1])*r;
  return norm(Math.atan2(Math.sin(dl)*Math.cos(la2), Math.cos(la1)*Math.sin(la2) - Math.sin(la1)*Math.cos(la2)*Math.cos(dl))/r); };
function sidName(gate, rwy, ac){
  rwy = rwy || depRw(ac); const list = SID_BY_RWY[rwy] || [];
  const b = ac && ac.d ? destBrg(ac.d) : (EHAM.DIR[gate] || {}).brg ?? 180;
  const endB = n => { const p = EHAM.SIDS[n].pts, f = WP[p[p.length - 1]]; return f ? brg(...ARP, ...f.p) : 0; };
  return list.slice().sort((x, y) => Math.abs(angDiff(endB(x), b)) - Math.abs(angDiff(endB(y), b)))[0] || null;
}
const sidSpoken = n => (EHAM.SIDS[n] || {}).spoken || n;
const exitRoute = (g, rwy, ac) => { const n = sidName(g, rwy, ac); return n ? EHAM.SIDS[n].pts.slice() : [EHAM.DIR[g].entry]; };
const EXIT_ROUTE = {}, EXIT_FIX = {};
for (const g of GATES) {
  Object.defineProperty(EXIT_ROUTE, g, { enumerable: true, get: () => exitRoute(g, depRw()) });
  Object.defineProperty(EXIT_FIX, g, { enumerable: true, get: () => { const r = exitRoute(g, depRw()); return r[r.length - 1]; } });
}
const ctrOf = g => { const b = EHAM.DIR[g].brg; return b < 45 || b >= 315 ? 'n' : b < 135 ? 'e' : b < 225 ? 's' : 'w'; };
const NEXT_UNIT = Object.fromEntries(GATES.map(g => [g, EHAM.CTR[ctrOf(g)]]));
const relUnit = ac => 'Amsterdam Radar';
const TEL = EHAM.TEL;
const isMil = ac => false;
const gateFor = ap => ap === 'EHAM' ? 'RIVER' : (EHAM.PLACE_DIR[ap] || GATES.slice().sort((a, b) => { const B = destBrg(ap) ?? 180; return Math.abs(angDiff(EHAM.DIR[a].brg, B)) - Math.abs(angDiff(EHAM.DIR[b].brg, B)); })[0]);

// ═════════════════════════ schedule ═════════════════════════
const withGate = x => ({ ...x, gate: x.gate || gateFor(x.k === 'ARR' ? x.o : x.d) });
const TIMETABLE = EHAM.TIMETABLE;
const REGS = {};
const LONG_STAY = EHAM.LONG_STAY;
const EXTRA = EHAM.EXTRA.map(withGate);
const EXERCISES = Object.fromEntries(Object.entries(EHAM.EXERCISES).map(([k, e]) => ['s' + k, { ...e, sched: e.sched.map(withGate) }]));
const WX_PRESETS = EHAM.WX_PRESETS;

// ═════════════════════════ weather rules ═════════════════════════
const TURB_TABLE = {};
const minsOk = (w, rw) => { const I = EHAM.ILS[rw] || EHAM.ILS['18R'], m = EHAM.MINS[I.cat]; return w.vis >= m.vis && w.ceil >= m.ceil; };
const sraMinsOk = w => minsOk(w, '18R');

// ═════════════════════════ engine hooks ═════════════════════════
const visTxt = v => v >= 9999 ? '10 kilometres or more' : v >= 5000 ? Math.round(v/1000) + ' kilometres' : v + ' metres';
const firstOf = (t, i = 0) => STANDS.filter(s => s.term === t)[i];
const landRwyOf = ac => landFor(ac);
const depRwyOf = ac => {
  if (ac && ac.cto && ac.depRwy) return ac.depRwy;
  if (ac && ac.hp && HOLDS[ac.hp]) { const on = HOLDS[ac.hp].on; const d = depList().find(r => RWYS_BY_END(r).id === on); if (d) return d; }
  return depForAc(ac);
};
const flowName = () => CFG[cfgNow()].name;
const twrOf = rw => EHAM.UNITS.twr.freq[RWYS_BY_END(rw).id] || '118.105';
const APT = {
  toVis: 125,
  lvp: w => w.vis < 550 || w.ceil < 200, lvpNote: 'stop bars at every runway entry, exit and crossing; intersection take-offs not allowed',
  arrAlt: { ...ARR_ALT },
  icao: 'EHAM', name: 'Schiphol', coordName: 'Schiphol', radarName: 'Schiphol', utcOff: 1, tz: 'Europe/Amsterdam',
  radar: [EHAM.UNITS.app.name, EHAM.UNITS.app.freq], depRadar: [EHAM.UNITS.dep.name, EHAM.UNITS.dep.freq],
  get tower(){ return [EHAM.UNITS.twr.name, twrOf(S.rwy)]; },
  gnd: [EHAM.UNITS.gnd.name, EHAM.UNITS.gnd.freq],
  runways: RWY_LIST, rwyHalfWidth: 22.5, holdSigns: true,
  ihps: IHP_LIST.map(({ id, node, alias }) => ({ id, node, alias })),
  // independent parallel runways (18R, 18C and 36R, 36C more than 1.5 km apart): a departure off one and an arrival on
  // (or going around from) another close in are separated by the SID and missed approach tracks
  sepOk: (a, b, d) => { const rw = x => x.kind === 'ARR' ? (x.app || x.gaRwy) : depRw(x); const ra = rw(a), rb = rw(b);
    if (!ra || !rb || RWYS_BY_END(ra) === RWYS_BY_END(rb)) return false;
    return dist(a.x, a.y, ...ARP) < 10 && dist(b.x, b.y, ...ARP) < 10 && Math.abs(angDiff(crsOf(ra), crsOf(rb))) < 20; },
  xing: false, drawnTown: false, ta: EHAM.TA, initClimb: EHAM.INIT_CLIMB, gaAlt: 2000, appAlt: 2000, handoffNM: 25, climbFL: 240, divertAlt: 7000,
  area: { dep: 40, arr: 70, div: 45 }, roll: [70, RWY_M - 70], defRwy: '18R', defWx: 'south',
  appName: 'ILS approach', appShort: 'ILS', minsText: 'weather below the approach minima', reqApp: rw => 'ILS approach',
  minsLong: 'Visibility is below the minima (ILS CAT III on 06, 18C, 18R, 27, 36C and 36R: RVR 75 m; CAT I on 22).',
  liveName: 'Amsterdam Airport Schiphol', atisFreq: EHAM.UNITS.atis.freq, turbName: 'Schiphol',
  sessionHours: Array.from({ length: 18 }, (_, i) => i + 5),
  view: { app: [0, 0, 70], get twr(){ return [0, 0, 5.5]; },
    gnd: (() => { const c = firstOf('D') ? firstOf('D').p : ARP; return [mOf(c), offOf(c), 4200, 3200]; })() },
  minsOk,
  splitRwy: true, rwyFor, depFor, configOf,
  rwyConfigs: Object.entries(CFG).map(([key, c]) => ({ key, name: c.name.split(':')[0], land: c.land[0], lands: c.land, deps: c.dep })),
  depRwyOf, landRwyOf, arrRoute: o => landRw(o),
  activeRwys: () => [...new Set([...landList(), ...depList()])],
  depRwys: () => depList(),
  appRwys: () => landList(),
  ropsSkip: [],
  exitRouteOf: ac => exitRoute(ac.gate, ac.depRwy || depRw(ac), ac),
  needRel: ac => false,
  sidAlt: ac => EHAM.INIT_CLIMB,
  remoteAreas: ['remote', 'cargo', 'ga'],
  areaNames: { pier: 'pier stands', remote: 'remote stands', cargo: 'cargo stands', ga: 'general aviation stands' },
  termName: t => (TERM_NAME[t] || t).toLowerCase().replace(/^./, c => c.toUpperCase()),
  remoteWord: s => 'remote stand',
  prefArea: ac => { const t = (EHAM.TERMINAL_OF[ac.cs.slice(0, 3)] || EHAM.TERMINAL_DEFAULT)[0]; return { key: t, name: TERM_NAME[t], has: s => s.term === t }; },
  standFor: ac => {
    const pick = list => { const free = list.filter(s => standFree(s, ac)).sort((a, b) => (a.maxSpan || 80) - (b.maxSpan || 80)), best = free.filter(s => (s.maxSpan || 80) <= (free[0] && free[0].maxSpan || 80) + 8);
      return best[Math.floor(Math.random()*best.length)] || null; };
    const al = ac.cs.slice(0, 3), long = ac.perf.wake === 'H' || ac.perf.wake === 'J';
    const order = long ? ['E', 'F', 'G', 'D', 'H', 'DA', 'EA', 'S'] : (EHAM.TERMINAL_OF[al] || EHAM.TERMINAL_DEFAULT).concat(['D', 'B', 'C', 'H', 'M', 'DA', 'EA', 'A', 'Y']);
    for (const t of order) { const s = pick(STANDS.filter(s => s.term === t)); if (s) return s; }
    return pick(STANDS.filter(s => s.area !== 'ga')) || pick(STANDS); },
  inboundAlt: g => 10000,
  divertTo: ac => ['Rotterdam', 'RIVER'],
  firstAlt: g => 13000,
  rolledCall: 'request taxi',
  vacExits: ac => { const rw = ac.app || landRw(ac), R = RWYS_BY_END(rw), m = R.mOf([ac.x, ac.y]), dir = rw === R.lo ? 1 : -1;
    const side = sideFor(ac, R); return exitsFor(rw, ac).filter(k => (HOLDS[k].m - m)*dir > 30 && Math.sign(HOLDS[k].off) === side).slice(0, 4); },
  vacPrefs: (st, ac) => exitsFor(ac && (ac.app || landRw(ac)) || S.rwy, ac),
  exitFor,
  lineUpWords: hp => 'line up and wait',
  terrain: null,
  restricted: null,
  drawAirport: drawEham, drawAirportTop: drawEhamTop,
  entryCost: (ac, k, from) => 0,
  onStep: () => {},
  gaEarly(ac, rw){},
  gaTurn(ac){ const rw = ac.gaRwy, F = FINAL[rw] || FINAL['18R'];
    if (ac.alt > ELEV + 700 || dist(ac.x, ac.y, ...(THR[rw] || ARP)) > 2) { ac.gaTurn = true; ac.mode = 'NAV'; ac.route = F.missed.slice(); ac.turnDir = 0; ac.tgtAlt = ac.cleared = Math.max(ac.cleared || 0, F.missAlt); } },
  liftoff(ac){ ac.tgtHdg = Math.round(crsOf(ac.depRwy)); ac.turnDir = 0; },
  depTurn(ac){ if (ac.turned) return; if (ac.alt >= ELEV + 500) ac.turned = true; },
  depClear: ac => !!ac.turned && ac.alt > ELEV + 600,
  shear(ac, rw, w){ return turbExcess(w) > 4 && Math.random() < 0.2 ? 'windshear on short final' : null; },
  shearWhy: rw => 'windshear on short final',
  faceHold: (st, f) => depHold({ stand: st, leftStand: false, x: st.p[0], y: st.p[1], kind: 'DEP' }),
  faceWord: f => f,
  faceHdg: (st, f) => norm(laneDir(st, f) + 180),
  taxiHolds: (south, ac) => { const rw = depRw(ac), ks = endHolds(rw), p = ac ? (ac.stand && !ac.leftStand ? ac.stand.lp : [ac.x, ac.y]) : ARP;
    const rec = ac && depHold(ac), ends = [...new Set([rec, ...ks.sort((a, b) => dist(...p, ...GN[HOLDS[a].node].p) - dist(...p, ...GN[HOLDS[b].node].p))].filter(Boolean))].slice(0, 3);
    return [...ends, ...intxHolds(rw).filter(k => !ac || ac.perf.wake === 'M' || intxRun(k, rw) >= 2800)]; },
  holdNote: (hp, rw) => intxHolds(rw).includes(hp) ? ` · intersection, ${(Math.round(intxRun(hp, rw)/10)*10).toLocaleString('en-GB')} m of runway ahead` : '',
  depHoldAs,
  taxiCheck: (ac, hp) => { if (ac.kind !== 'DEP' || !HOLDS[hp]) return null; const rw = depRw(ac), ok = depHolds(rw);
    if (intxHolds(rw).includes(hp) && ac.perf.wake !== 'M' && intxRun(hp, rw) < 2800) return `${ac.cs} (${ac.t}, heavy) needs more runway than ${HOLDS[hp].ref} leaves (${intxRun(hp, rw).toLocaleString('en-GB')} m).`;
    if (ok.includes(hp)) return null;
    const ref = k => HOLDS[k].ref, ends = [...new Set(endHolds(rw).map(ref))], ix = [...new Set(intxHolds(rw).map(ref))];
    return `${ref(hp)} is not a runway ${rw} departure point. Runway ${rw} departures enter at ${ends.join(' or ') || 'its end'}${ix.length ? `, or at the intersection${ix.length > 1 ? 's' : ''} ${ix.join(', ')}` : ''}.`; },
  taxiHint: rw => ({ '24': 'Runway 24 departures enter at S7 (via S7E, the full length) or the intersections S8, S6, S5, S4 and S3 off A.',
    '18L': 'Runway 18L departures enter at E6 at the north end, by N2 across 09/27, or the intersections E5, E4, E8 and E2.',
    '36L': 'Runway 36L departures enter at V4 at the south end of the Polderbaan, a long taxi by V and over the A5 (in its tunnel) and the bridge over the Hoofdvaart and the Hoofdweg.',
    '36C': 'Runway 36C departures enter at W11 or W10 at the south end, or the intersections W9, W12, W8 and W7.',
    '18C': 'Runway 18C departures enter at W1 at the north end, or the intersections W2 to W5.',
    '09': 'Runway 09 departures enter at N5 at the west end, or N4 and N3.', '27': 'Runway 27 departures enter at N1 at the east end.',
    '06': 'Runway 06 departures enter at S1 or S10 (2,596 m ahead).', '22': 'Runway 22 departures enter at G1 or G2.', '04': 'Runway 04 departures enter at G5.' })[rw] || '',
  diverts: [{ cs: 'BAW432', t: 'A320', o: 'EGLL', gate: 'REDFA', to: 'Rotterdam' }, { cs: 'DLH2304', t: 'A20N', o: 'EDDM', gate: 'RKN', to: 'Eindhoven' }],
  airports: EHAM.AIRPORTS, via: {},
  airlineIcao: EHAM.AIRLINE_ICAO, airlineType: EHAM.AIRLINE_TYPE, defType: 'B738',
  placeIcao: EHAM.PLACES,
  phr: {
    push: (ac, dn, face) => [`cleared to ${dn} via the ${sidSpoken(ac.sid)} departure, runway ${depRw(ac)}, climb flight level 60, squawk ${ac.sqk}, start-up and push back approved, face ${faceSay(ac, face)}, QNH ${S.wx.qnh}`,
      `cleared ${dn}, ${sidSpoken(ac.sid)}, runway ${depRw(ac)}, flight level 60, squawk ${ac.sqk}, start and push approved facing ${faceSay(ac, face)}, QNH ${S.wx.qnh}`],
    startReq: ac => `${EHAM.UNITS.gnd.name}, stand ${ac.stand.id}, ${ac.perf.name} to ${AP[ac.d] ? AP[ac.d][2] : ac.d}, information ${phonetic(S.atis)}, request push and start`,
    checkIn: ac => { const st = starOf(ac.gate, landRw(ac)); return `${APT.radar[0]}, ${ac.cs.length > 0 ? '' : ''}${altShort(Math.round(ac.alt/100)*100)} descending ${altShort(ac.tgtAlt)}, ${st.spoken} arrival, information ${phonetic(S.atis)}`; },
    vacated: ac => `${EHAM.UNITS.gnd.name}, runway ${rwyName(ac.rwyId)} vacated via ${PHON[ac.exit] || ac.exit.replace(/~\d+$/, '')}${ac.stand ? ', for stand ' + ac.stand.id : ''}`,
    taxiIn: (ac, st, vw) => { const k = xingAhead(ac), hs = k >= 0 ? `, hold short runway ${rwyName(ac.path.pts[k].hs)}` : '', via = vw.length ? ' via ' + vw.map(t => PHON[t] || t).join(', ') : '';
      return [`taxi to stand ${st.id}${via}${hs}`, `stand ${st.id}${via}${hs}`]; },
    taxiHold: (ac, h, vw) => { const via = vw.length ? ' via ' + vw.map(t => PHON[t] || t).join(', ') : '', r = h.rwy ? rwyName(HOLDS[h.id].on) : null, at = PHON[h.id] || h.id;
      return r ? [`taxi to holding point ${at}${via}, hold short runway ${r}`, `holding point ${at}${via}, holding short ${r}`] : [`taxi${via}, hold at ${at}`, `${via ? via.slice(1) + ', ' : ''}holding at ${at}`]; },
    atHoldPt: (ac, h) => h.rwy ? `holding short runway ${rwyName(HOLDS[h.id].on)} at ${PHON[h.id] || h.id}` : `holding at ${PHON[h.id] || h.id}`
  },
  atisPanel(w){
    const c = windComp(w, crsOf(S.rwy)), bad = !minsOk(w, S.rwy), r = rwyFor(w);
    return `<div class="warnline${bad ? ' bad' : ''}">${flowName()} · land ${landList().join(' and ')}, depart ${depList().join(' and ')}${r.land !== S.rwy ? ` (the wind favours ${r.land} / ${r.dep})` : ''} · ${bad ? 'below the minima' : 'ILS approaches'} · crosswind ${Math.round(Math.abs(c.crossG))} kt.</div>`;
  },
  atisLines({ w, L, E }){
    const cl = w.clouds.length ? w.clouds.map(c => { const m = c.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3})/); return m ? `${{ FEW: 'few', SCT: 'scattered', BKN: 'broken', OVC: 'overcast', VV: 'vertical visibility' }[m[1]]} ${(+m[2]*100).toLocaleString('en-GB')} feet` : c; }).join(', ') : 'no significant cloud';
    const out = [
      `This is Schiphol arrival information ${phonetic(L)}, time ${zt(S.t).slice(0,5).replace(':', '')}.`,
      `Main landing runway ${landList()[0]}${landList()[1] ? `, second landing runway ${landList()[1]}` : ''}. Departure runway${depList().length > 1 ? 's' : ''} ${depList().join(' and ')}.`,
      `Transition level ${w.qnh < 995 ? 'flight level 70' : 'flight level 60'}.`,
      `Surface wind ${w.vrb ? 'variable' : hdg3(w.dir)} degrees ${w.spd} knots${w.gust ? ', gusting ' + w.gust : ''}. Visibility ${visTxt(w.vis)}${w.wx.length ? ', ' + w.wx.join(' ') : ''}. ${cl.replace(/^./, c => c.toUpperCase())}.`,
      `Temperature ${w.temp}, dew point ${w.dew}. QNH ${w.qnh}.`
    ];
    if (APT.lvp(w)) out.push('Low visibility procedures in force.');
    if (E && E.rwyBlock) out.push(`Runway ${blockRw()} closed: ${E.rwyBlock.why}.`);
    if (!minsOk(w, S.rwy)) out.push('Visibility below the approach minima. Expect holding.');
    out.push(`Contact Schiphol Approach with callsign only. Acknowledge information ${phonetic(L)}.`);
    return out;
  },
  site: {
    hero: () => [
      ['KLM1234', 52.55, 5.40, 250, 230, PAL.light.arr], ['EZY7911', 52.10, 4.05, 300, 220, PAL.light.arr], ['DAL73', 52.00, 4.30, 340, 200, PAL.light.arr],
      ['KLM605', 52.40, 4.55, 320, 240, PAL.light.dep], ['TRA5043', 52.15, 4.55, 230, 250, PAL.light.dep]
    ],
    demo(mk, park){
      const fin = add(THR['18R'], norm(CRS['18R'] + 180), 2.6), out = add(THR['24'], CRS['24'], 4), iaf = WP.SUGOL ? WP.SUGOL.p : add(ARP, 270, 15);
      const hold = endHolds('24')[0], hp = hold ? GN[HOLDS[hold].node].p : ARP;
      const ids = [firstOf('D', 0), firstOf('D', 6), firstOf('B', 2), firstOf('E', 1)].map(s => s ? s.id : STANDS[0].id);
      return [
        mk('KLM1001', 'B738', 'DEP', park(ids[0], { need: null, reqAt: 99999 })), mk('KLM1361', 'E195', 'DEP', park(ids[1], { need: null, reqAt: 99999 })),
        mk('KLC1557', 'E295', 'DEP', park(ids[2], { need: null, reqAt: 99999 })), mk('KLM605', 'B77W', 'DEP', park(ids[3], { need: null, reqAt: 99999 })),
        mk('TRA5043', 'B738', 'DEP', { ground: true, state: 'HOLDPT', hp: hold, x: hp[0], y: hp[1], hdg: CRS['24'], gs: 0 }),
        mk('KLM1234', 'B738', 'ARR', { state: 'FINAL', mode: 'FINAL', app: '18R', freq: 'TWR', x: fin[0], y: fin[1], hdg: CRS['18R'], alt: 820, gs: 140, vs: -750, o: 'EGLL' }),
        mk('EZY7911', 'A320', 'ARR', { state: 'INBOUND', x: iaf[0], y: iaf[1], hdg: 90, alt: 7000, gs: 250, vs: 0, tgtAlt: 7000, o: 'EGKK' })
      ];
    },
    thumb(k, zoom, W){
      if (k === 'app') return v => { v.scale *= 1.3; };
      if (k === 'twr') return v => { v.cx = 0; v.cy = 0; v.scale = W/5; };
      const c = zoom === 'apron' ? (firstOf('D') || STANDS[0]).p : ARP;
      return v => { v.cx = c[0]; v.cy = c[1]; v.scale = W/((zoom === 'apron' ? 700 : 4200)*M2NM); };
    },
    figHold: 'SUGOL', emergHp: 'S7',
    figConsole: v => { v.scale *= 1.2; },
    cmdHint: 'Command, e.g. KLM1234 APP · KLM605 TAXI · / to focus, Tab cycles flights'
  }
};
APT.hangars = G.buildings.filter(b => b.roof === 'hangar').map(b => { const n = b.pts.length, c = b.pts.reduce((a, p) => [a[0] + p[0]/n, a[1] + p[1]/n], [0, 0]); return { c, area: Math.abs(b.pts.reduce((a, p, i) => a + p[0]*b.pts[(i + 1) % n][1] - b.pts[(i + 1) % n][0]*p[1], 0))/2, name: b.name }; })
  .filter(h => h.area > 4000).sort((a, b) => b.area - a.area).slice(0, 4)
  .map(h => [h, (nearestNode(EN(...h.c), nd => !/^[Rxs]/.test(nd.id)) || {}).id]).filter(([h, node]) => node && GN[node] && dist(...EN(...h.c), ...GN[node].p)/M2NM < 260)
  .map(([h, node], i) => ({ id: 'H' + (i + 1), name: h.name || 'KLM hangar', in: inF0(...h.c), door: [GN[node].m, GN[node].off], node, to: ['pier'],
    fits: ac => /^(KLM|KLC|TRA)$/.test(ac.cs.slice(0, 3)), pick: ac => APT.standFor(ac) }));
APT.queuePen = true;
