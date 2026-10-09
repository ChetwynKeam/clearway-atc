// ═════════════════════════ New York JFK (KJFK) airport profile for the engine ═════════════════════════
// Builds every global the engine reads from the chart data in kjfk.js (KJFK) and the OpenStreetMap aerodrome in
// kjfk-ground.js (metres east and north of the ARP). Kennedy has four runways in two parallel pairs, so it is the
// engine's multi-runway airport: APT.runways lists each with its own frame (metres from its low end, offset to the
// left), S.rwy is the landing runway and S.depRwy the departure runway (normally land 22L, depart 22R). The single-
// runway globals (rm, mOf, offOf, RW_LO/RW_HI, THR_*) describe 4R/22L, the runway the website figures show.
// Arrivals on 4R/22L reach the terminals only by crossing 4L/22R: taxiing traffic holds short of every runway in use
// until cleared to cross (CROSS).
Object.assign(TYPES, KJFK.TYPES);
const LL = p => xy(p[0], p[1]);
const G = KJFK_GROUND;
const EN = (e, n) => [e*M2NM, n*M2NM];                     // metres east and north of the ARP (the map origin) → NM

// ═════════════════════════ runways ═════════════════════════
// a frame along each runway: m from the pavement end a (the low-numbered end), off to the left
function rwyFrame(r){
  const a = EN(...r.a), b = EN(...r.b), L = dist(...a, ...b), RU = [(b[0]-a[0])/L, (b[1]-a[1])/L], RN = [-RU[1], RU[0]];
  const rm = (m, off=0) => [a[0] + (RU[0]*m + RN[0]*off)*M2NM, a[1] + (RU[1]*m + RN[1]*off)*M2NM];
  const mOf = p => ((p[0]-a[0])*RU[0] + (p[1]-a[1])*RU[1])/M2NM, offOf = p => ((p[0]-a[0])*RN[0] + (p[1]-a[1])*RN[1])/M2NM;
  const len = r.len;
  // no turning pads: every entry used for departure is at a runway end, and arrivals always have an exit ahead
  const TURN_W = [[30, 0]], TURN_E = [[len - 30, 0]];
  return { id: r.id, lo: r.lo, hi: r.hi, len, thr: r.thr, elev: r.elev, rm, mOf, offOf, RU, TURN_W, TURN_E, TURN_END: { W: 30, E: len - 30 },
    roll: [70, len - 70], ends: true, width: { '4L22R': 61, '13R31L': 61 }[r.id] || 46 };
}
const RWY_LIST = ['4R22L', '4L22R', '13L31R', '13R31L'].map(id => rwyFrame(G.runways.find(r => r.id === id)));
const R0 = RWY_LIST[0];
const rm = R0.rm, mOf = R0.mOf, offOf = R0.offOf, RU = R0.RU;
const RWY_M = R0.len, THR_LO_M = R0.thr['4R'], THR_HI_M = R0.thr['22L'];
const RW_LO = '4R', RW_HI = '22L';
const THR = {}, CRS = {}, THR_ELEV = {};
for (const R of RWY_LIST) {
  THR[R.lo] = R.rm(R.thr[R.lo], 0); THR[R.hi] = R.rm(R.thr[R.hi], 0);
  CRS[R.lo] = brg(...R.rm(0), ...R.rm(R.len)); CRS[R.hi] = norm(CRS[R.lo] + 180);
  THR_ELEV[R.lo] = R.elev[R.lo]; THR_ELEV[R.hi] = R.elev[R.hi];
}
const T_LO = THR[RW_LO], T_HI = THR[RW_HI], CRS_LO = CRS[RW_LO], CRS_HI = CRS[RW_HI];
const crsOf = rw => CRS[rw] ?? CRS_HI;
const ELEV = KJFK.elev;
const ARP = LL(KJFK.arp);
const parallelOf = rw => ({ '4L': '4R', '4R': '4L', '22L': '22R', '22R': '22L', '13L': '13R', '13R': '13L', '31L': '31R', '31R': '31L' })[rw];
// no road crossing, no border fence, no rock
const XING_M = -1e9, XING_SKEW = 0, XING_HW = 0, xingM = o => XING_M;
const FRONTIER = [], R164 = [], ROCK = [], ROCK_TOP = [0, 0];
const TURN_W = R0.TURN_W, TURN_E = R0.TURN_E, TURN_END = R0.TURN_END, TURN_PAD = {};

// ═════════════════════════ taxiways, holding points, gates (kjfk-ground.js) ═════════════════════════
// the taxi graph keeps the engine's frame (4R/22L) for its m/off; positions are exact
const inF0 = (e, n) => { const p = EN(e, n); return [mOf(p), offOf(p)]; };
for (const [id, e, n] of G.nodes) gn(id, ...inF0(e, n));
for (const [id, e, n] of G.rnodes) gn(id, ...inF0(e, n));
for (const [a, b, tw, mid] of G.edges) chain(a, mid.map(([e, n]) => inF0(e, n)), b, tw);
const HOLDS = {}, FIL = {};
for (const [k, [node, rwy, on, m, off, dirs, end]] of Object.entries(G.holds)) {
  HOLDS[k] = { node, rwy, on, m, off, dirs: dirs.split(','), end: end || null, ref: k.replace(/~\d+$/, '') };
  ge(rwy, node, HOLDS[k].ref);
  FIL[k] = { W: G.fil[k], E: G.fil[k] };                  // the mapped centreline-to-taxiway curve, used either way
}
// the holding position on each side of a runway: a path point there stops the aircraft until cleared to cross
for (const [id, rid] of Object.entries(G.hs)) if (GN[id]) GN[id].p.hs = rid;
// gates: Terminal 4 keeps its own A and B numbers; the others are terminal-gate (5-12, 8-33, 1-6)
const TERMINAL_OF = { DAL: '4', EDV: '4', VIR: '4', KLM: '4', UAE: '4', ETD: '4', SIA: '4', AIC: '4', ELY: '4', AMX: '4', CMP: '4', AVA: '4', CAY: '4',
  JBU: '5', EIN: '5', AAL: '8', RPA: '8', BAW: '8', IBE: '8', QTR: '8', JAL: '8', CPA: '8', ASA: '8', FFT: '8',
  AFR: '1', DLH: '1', SWR: '1', THY: '1', KAL: '1', ANA: '1', CES: '1', TAP: '1', ASL: '1', MSR: '1', CFG: '1', UAL: '1' };
const STANDS = G.gates.map(([id, term, [e, n], node]) => { const p = EN(e, n); return { id, term, p, m: mOf(p), off: offOf(p), node, area: 'civil', occ: null }; });
// remote hardstands (OpenStreetMap parking positions away from the gates): Terminal 1 (HS), the D and H pads between
// Terminals 4 and 5, and Terminal 8 (31, 32), each led in from the taxilane its painted lead-in line starts at. Long
// turnarounds wait here and are towed to and from a gate.
const HARDSTANDS = [['HS1A', -1237, 380, 'n148'], ['HS2A', -1222, 427, 'n603'], ['HS2B', -1195, 411, 'n603'],
  ['D1', 390, 207, 'n402'], ['D2', 365, 250, 'n625'], ['D5', 427, 271, 'n394'], ['D13', 341, 294, 'n423'], ['H1', 429, 214, 'n402'], ['H1A', 433, 245, 'n403'],
  ['H3', 388, 286, 'n437'], ['H6', 418, 372, 'n530'], ['H7', 439, 409, 'n405'], ['H9', 469, 369, 'n394'], ['H11', 429, 318, 'n394'],
  ['31A', -1370, 963, 'n535'], ['31B', -1412, 953, 'n534'], ['31C', -1433, 932, 'n107'], ['32F', -1410, 1016, 'n141'], ['32G', -1407, 1042, 'n141'], ['32I', -1412, 1085, 'n144']];
// cargo stands (OpenStreetMap parking positions by the FedEx, DHL and north cargo buildings), used as remote stands
// for airliners that wait a long time. Named after the cargo area, with the stand number painted there. The taxiway
// graph stops at the edge of the cargo aprons, so the tug crosses the open apron (no lead-in line is drawn).
const CARGO_STANDS = [['F1', -592, 2424, 'k289'], ['F2', -537, 2391, 'k290'], ['F3', -483, 2350, 'n326'], ['F4', -416, 2327, 'k297'], ['F5', -355, 2282, 'k298'],
  ['DHL1', -2013, 1168, 'k271'], ['DHL2', -1947, 1164, 'k271'], ['DHL3', -1828, 1148, 'k272'], ['DHL4', -1748, 1145, 'k272'],
  ['C1', -1488, 2480, 'n219'], ['C2', -1489, 2436, 'n230'], ['C3', -1489, 2393, 'n230'], ['C4', -1447, 2379, 'n230'], ['C5', -1446, 2422, 'n230'], ['C6', -1450, 2459, 'n230'], ['CC', -1467, 2547, 'n219']];
for (const [term, list] of [['R', HARDSTANDS], ['C', CARGO_STANDS]]) for (const [id, e, n, node] of list) if (GN[node]) { const p = EN(e, n); STANDS.push({ id, term, p, m: mOf(p), off: offOf(p), node, area: 'remote', occ: null, noLead: term === 'C' }); }
STANDS.forEach(s => { s.lp = GN[s.node].p; s.hdg = brg(...s.lp, ...s.p); });
const APRONS = G.aprons.map(r => r.map(([e, n]) => inF0(e, n)));
// which side of each runway the terminals are on (all of them sit inside the four runways' central area)
{ const c = STANDS.reduce((a, s) => [a[0] + s.p[0]/STANDS.length, a[1] + s.p[1]/STANDS.length], [0, 0]); for (const R of RWY_LIST) R.side = Math.sign(R.offOf(c)); }

// taxiway names: letters spoken one by one (KE "Kilo Echo"), digits as numbers; holding points without the ~n suffix
const NATO = { A: 'Alpha', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike',
  N: 'November', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', Y: 'Yankee', Z: 'Zulu' };
const twyWords = t => t.replace(/~\d+$/, '').match(/[A-Z]|\d+/g).map(x => NATO[x] || x).join(' ');
const PHON = {};
for (const e of GE) if (e.tw && e.tw !== 'APRON' && !PHON[e.tw]) PHON[e.tw] = twyWords(e.tw);
for (const k of Object.keys(HOLDS)) PHON[k] = twyWords(k);
PHON.APRON = 'the ramp';

// departure entries: the holding points at the departure end of a runway, nearest first from where the aircraft is
const endHolds = rw => Object.keys(HOLDS).filter(k => HOLDS[k].end === rw);
// intersection departures: a taxiway joining the runway from the terminal side, at its OpenStreetMap runway holding
// position, that meets the runway square or angled the way the takeoff goes (not one angled back, which would need a
// turn of more than about 100 degrees), with at least INTX_MIN metres of runway ahead, and not where another runway
// crosses (31L: Y, K, KD, KE, L)
const INTX_MIN = 2100;
const intxRun = (k, rw) => { const H = HOLDS[k], R = rwyById(H.on), m = R.mOf(GN[H.rwy].p); return rw === R.lo ? R.len - m : m; };
const intxWay = (k, rw) => { const R = rwyById(HOLDS[k].on), f = FIL[k].W, a = f[f.length-1], b = f[0], dm = b[0] - a[0], L = Math.hypot(dm, b[1] - a[1]);
  return !L || dm*(rw === R.lo ? 1 : -1)/L >= -0.17; };
const intxHolds = rw => { const R = RWYS_BY_END(rw);
  return Object.keys(HOLDS).filter(k => { const H = HOLDS[k], q = GN[H.rwy].p;
    return H.on === R.id && !H.end && Math.sign(H.off) === R.side && intxWay(k, rw) && intxRun(k, rw) >= INTX_MIN
      && RWY_LIST.every(O => O === R || Math.abs(O.offOf(q)) > 100 || O.mOf(q) < -100 || O.mOf(q) > O.len + 100); })
    .sort((a, b) => intxRun(b, rw) - intxRun(a, rw)); };
const depHolds = rw => [...endHolds(rw), ...intxHolds(rw)];
// a holding point named for a departure (TAXI KE): the one of that name its runway is entered from (KE has one each
// side of 31L, and departures use the terminal side)
const depHoldAs = (ac, hp) => { const rw = depRw(ac), ok = depHolds(rw); if (!HOLDS[hp] || ok.includes(hp)) return hp;
  return ok.find(k => HOLDS[k].ref === HOLDS[hp].ref) || hp; };
const routeLen = (from, to) => { const r = route(from, to); return r ? pathLen(r.nodes) : Infinity; };
function depHold(ac){
  const rw = depRw(), from = ac.stand && !ac.leftStand ? ac.stand.node : nearestNode([ac.x, ac.y], n => !/^R/.test(n.id)).id;
  const ks = endHolds(rw); let best = ks[0], bl = Infinity;
  for (const k of ks) { const L = routeLen(from, HOLDS[k].node); if (L < bl) { bl = L; best = k; } }
  return best;
}
// nose-in gates: the tug pushes the tail back onto the taxilane, then 40 m along it the way the tail points
function laneDir(st, face){
  const tail = face === 'east' ? 270 : 90, lp = st.lp;
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
// exits for a landing runway: those the roll-out direction can turn into, on the terminal side, in the order met
function exitsFor(rw){
  const R = RWYS_BY_END(rw), up = rw === R.lo, thr = R.thr[rw];
  const ks = Object.keys(HOLDS).filter(k => { const H = HOLDS[k]; return H.on === R.id && H.dirs.includes(rw) && (up ? H.m > thr + 700 : H.m < thr - 700); });
  const near = ks.filter(k => Math.sign(HOLDS[k].off) === R.side), far = ks.filter(k => Math.sign(HOLDS[k].off) !== R.side);
  const order = a => a.sort((x, y) => (HOLDS[x].m - HOLDS[y].m)*(up ? 1 : -1));
  return [...order(near), ...order(far)];
}
const RWYS_BY_END = rw => RWY_LIST.find(R => R.lo === rw || R.hi === rw) || R0;
// a name the controller says ("VAC H") to the exit of that taxiway on the aircraft's runway, ahead of it
function exitFor(ac, name){
  if (HOLDS[name] && HOLDS[name].on === (ac.rwyId || RWYS_BY_END(ac.app || S.rwy).id)) return name;
  const rw = ac.app || S.rwy, R = RWYS_BY_END(rw), m = R.mOf([ac.x, ac.y]), dir = rw === R.lo ? 1 : -1;
  const ks = Object.keys(HOLDS).filter(k => HOLDS[k].ref === name && HOLDS[k].on === R.id && (HOLDS[k].m - m)*dir > 20);
  return ks.sort((a, b) => (Math.sign(HOLDS[b].off) === R.side) - (Math.sign(HOLDS[a].off) === R.side) || (HOLDS[a].m - HOLDS[b].m)*dir)[0] || null;
}

// ═════════════════════════ aerodrome drawing ═════════════════════════
// FAA design group V taxiways: 75 ft wide, continuous double yellow edge lines
const AD_SITE = { pave: { w: 23, edge: 'faa' }, aprons: APRONS, roads: [], buildings: [], twyExtra: [], shoulder: [0, RWY_M], serviceRoad: false, paag: [], floods: [], twyLabels: [], hotspots: [], labels: [] };
// hot spot HS 1 (FAA NE hot spots): the Kilo and Juliett junction near runway 4L and 31L
const HS1 = (() => { const n = Object.values(GN).find(n => n.adj.some(([, e]) => e.tw === 'K') && n.adj.some(([, e]) => e.tw === 'J')); return n ? n.p : null; })();
const TERM_LABELS = (() => { const by = {}; for (const s of STANDS) if (s.area !== 'remote') (by[s.term] ||= []).push(s.p); return Object.entries(by).map(([t, ps]) => [`TERMINAL ${t}`, ps.reduce((a, p) => [a[0] + p[0]/ps.length, a[1] + p[1]/ps.length], [0, 0])]); })();
function drawKjfk(){
  const sc = V.scale, mpx = sc/1852, IMG = mapImagery();
  const P2 = p => [sx(p[0]), sy(p[1])];
  const pathP = (pts, close = true) => { cx.beginPath(); pts.forEach((p, i) => cx[i ? 'lineTo' : 'moveTo'](...P2(p))); if (close) cx.closePath(); };
  const lw = m => Math.max(1, m*mpx);
  const rwyPoly = (R, w) => [R.rm(0, -w/2), R.rm(R.len, -w/2), R.rm(R.len, w/2), R.rm(0, w/2)];
  if (sc <= 70) { cx.fillStyle = rgba('rwyOut', .9); for (const R of RWY_LIST) { pathP(rwyPoly(R, Math.max(R.width, 2.2/mpx))); cx.fill(); } return; }
  cx.lineJoin = 'round'; cx.lineCap = 'round';
  // aprons, then taxiways (every graph edge), then the runways on top; over the street map the mapped aprons and
  // taxiways are already there, so only the drawn chart paves them
  if (!IMG) {
    cx.fillStyle = C.concrete; for (const a of APRONS) { pathP(a.map(([m, o]) => rm(m, o))); cx.fill(); }
    // the mapped apron outlines did not survive conversion, so the ramp is paved along its taxilanes and gate lead-ins:
    // the yellow ramp lines then sit on concrete instead of on the grass
    cx.strokeStyle = C.concrete; cx.lineWidth = lw(70);
    for (const e of GE) { if (e.tw !== 'APRON') continue; pathP([GN[e.a].p, GN[e.b].p], false); cx.stroke(); }
    cx.lineWidth = lw(48); for (const s of STANDS) { pathP([s.lp, s.p], false); cx.stroke(); }
    cx.strokeStyle = C.asphalt; cx.lineWidth = lw(23);
    for (const e of GE) { if (e.tw === 'APRON') continue; pathP([GN[e.a].p, GN[e.b].p], false); cx.stroke(); }
    for (const k in FIL) { const R = rwyById(HOLDS[k].on); pathP(FIL[k].W.map(([m, o]) => R.rm(m, o)), false); cx.stroke(); }
  } else {
    // over the street map: taxiways at their real width, clear of the buildings; the ramps are the map's own aprons
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
      cx.setLineDash([36*mpx, 24*mpx]); pathP([R.rm(R.thr[R.lo] + 120, 0), R.rm(R.thr[R.hi] - 120, 0)], false); cx.stroke(); cx.setLineDash([]);
      // FAA AC 150/5340-1: threshold bar, 12 stripes (16 on the 200 ft runways), aiming point at 1,000 ft, touchdown zone
      // bars in threes, twos and ones every 500 ft to 3,000 ft, and arrows down the centreline before a displaced threshold
      const nStripe = R.width > 55 ? 8 : 6;
      for (const [m0, dir] of [[R.thr[R.lo], 1], [R.thr[R.hi], -1]]) {
        quad(m0, -hw, m0 + dir*3, hw);
        for (let i = 0; i < nStripe; i++) for (const k of [-1, 1]) { const o = k*(4 + i*(hw - 4)/nStripe); quad(m0 + dir*6, o - 0.9*k, m0 + dir*46, o + 0.9*k); }
        for (const k of [-1, 1]) quad(m0 + dir*305, k*6, m0 + dir*350, k*16);
        const half = Math.abs(R.thr[R.hi] - R.thr[R.lo])/2;
        for (const [d, n] of [[152, 3], [457, 2], [610, 2], [762, 1], [914, 1]]) if (d + 23 < half) for (const k of [-1, 1]) for (let j = 0; j < n; j++) {
          const o = k*(6 + j*3.4); quad(m0 + dir*d, o, m0 + dir*(d + 23), o + k*1.8);
        }
        const pre = dir > 0 ? m0 : R.len - m0;
        if (pre > 60) {
          cx.lineWidth = lw(0.9);
          for (let d = 30; d < pre - 15; d += 60) { const m = m0 - dir*d; pathP([R.rm(m - dir*18, 0), R.rm(m, 0)], false); cx.stroke(); pathP([R.rm(m - dir*8, -3), R.rm(m, 0), R.rm(m - dir*8, 3)], false); cx.stroke(); }
          for (const k of [-1, 1]) { const m = m0 - dir*8; pathP([R.rm(m - dir*10, k*8), R.rm(m, k*12), R.rm(m - dir*10, k*16)], false); cx.stroke(); }
        }
      }
      for (const [rw, m0] of [[R.lo, R.thr[R.lo] + 70], [R.hi, R.thr[R.hi] - 70]]) drawRwyDesignator(...P2(R.rm(m0, 0)), rw, crsOf(rw), Math.max(9, 16*mpx));
    }
    // lead-on and lead-off lines: the mapped fillet curves carried over the runway to its centreline
    { const seen = new Set(), leads = []; for (const k in FIL) { const f = FIL[k].W, key = HOLDS[k].on + JSON.stringify(f); if (seen.has(key)) continue; seen.add(key);
      const R = rwyById(HOLDS[k].on); leads.push(leadLine(f).map(p => P2(R.rm(...p)))); }
      groundLines(lw(0.35), () => leads.forEach(strokeSmooth)); }
    // taxiway centrelines, stopping at the runway edges
    paintEdgeLines(lw(0.35));
    // runway holding positions: two solid and two dashed lines across the taxiway, parallel to the runway
    for (const [id, rid] of Object.entries(G.hs)) {
      const n = GN[id]; if (!n) continue; const R = rwyById(rid), m = R.mOf(n.p), o = R.offOf(n.p), s = Math.sign(o);
      for (const [d, dash] of [[0.9, false], [0.3, false], [-0.3, true], [-0.9, true]]) { cx.setLineDash(dash ? [mpx + 1, mpx + 1] : []); pathP([R.rm(m - 11, o + s*d), R.rm(m + 11, o + s*d)], false); cx.stroke(); }
      cx.setLineDash([]);
    }
    // gate lead-in lines and numbers
    groundLines(lw(0.3), () => { for (const s of STANDS) if (!s.noLead) { pathP([s.lp, s.p], false); cx.stroke(); } });
    if (IMG) { cx.save(); clipOut(G.buildings.map(b => b.pts.map(([e, n]) => P2(EN(e, n))))); drawStandDetail(null, null, mpx); cx.restore(); }   // stand paint stops at the terminal walls
    else if (sc > 600) { cx.fillStyle = rgba('lab', .8); cx.font = `600 ${Math.max(9, 4*mpx)}px ${FONT_L}`; for (const s of STANDS) { const [X, Y] = P2(s.p); cx.fillText(s.id, X + 3, Y - 3); } }
    drawGroundSigns();
    if (HS1) { const [X, Y] = P2(HS1); cx.strokeStyle = rgba('hot', .85); cx.lineWidth = 1.2; cx.beginPath(); cx.arc(X, Y, 60*mpx + 6, 0, 7); cx.stroke(); cx.fillStyle = rgba('hot', .95); cx.font = `600 11px ${FONT_L}`; cx.fillText('HS 1', X + 60*mpx + 8, Y + 4); }
  }
}
// lights and terminal names: drawn every frame over the airfield layer (in the dark theme the lights add their glow to
// what is under them, so they can't go in the layer)
function drawKjfkTop(){
  const sc = V.scale, mpx = sc/1852, IMG = mapImagery();
  const P2 = p => [sx(p[0]), sy(p[1])];
  // lights: runway edges and thresholds, taxiway edge blue (dark theme glow)
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
const STAR_FIXES = new Set(Object.values(KJFK.STARS).flatMap(s => s.pts.map(p => p[0])));
for (const [id, p] of Object.entries(KJFK.FIX)) wp(id, p[0], p[1], STAR_FIXES.has(id) || /^(DEEZZ|SKORR|GAYEL|COATE|MERIT|GREKI|BETTE|WAVEY|RNGRR|CRAIL)$/.test(id) ? {} : { minor: true });
for (const [id, n] of Object.entries(KJFK.NAV)) wp(id, ...n.p, { note: `${n.name} ${n.freq}` });
const RADAR_REF = WP.JFK.p;
const GATES = Object.keys(KJFK.DIR);
const STAR_OF = g => KJFK.STARS[KJFK.DIR[g].star];
const starFrom = g => { const pts = STAR_OF(g).pts.map(p => p[0]); return pts.slice(pts.indexOf(KJFK.DIR[g].entry)); };
// holds at the end of each STAR, inbound along its last leg
for (const s of Object.values(KJFK.STARS)) { const n = s.pts.length, a = WP[s.pts[n-2][0]].p, b = WP[s.pts[n-1][0]].p; WP[s.pts[n-1][0]].hold = { inb: Math.round(brg(...a, ...b)), min: 6000, left: false }; }
const ENTRY = Object.fromEntries(GATES.map(g => [g, WP[KJFK.DIR[g].entry].p]));
const ENTRY_ALT = { N: 13000, NE: 14000, E: 14000, S: 12000, SW: 12000, W: 13000, NW: 13000 };
const PRE_ALT = { N: 27000, NE: 29000, E: 33000, S: 27000, SW: 25000, W: 29000, NW: 29000 };

// ── ILS approaches: the localiser from 3 NM outside the intermediate fix, the 3° glideslope from the platform altitude
const FINAL = {};
for (const [rw, I] of Object.entries(KJFK.ILS)) {
  const thr = THR[rw], out = norm(crsOf(rw) + 180), dIF = dist(...thr, ...WP[I.ifx].p), dFAF = dist(...thr, ...WP[I.faf].p), elev = THR_ELEV[rw];
  const F = { pts: [add(thr, out, dIF + 3), add(thr, out, dIF), thr], alts: [I.ifAlt, I.ifAlt, elev + 50], elev, entry: I.ifx, entryName: I.ifx, name: 'ILS ' + rw, alt: I.ifAlt,
    decName: I.faf, decNM: dFAF + 0.2, decMin: Math.max(1.6, dFAF - 1.6), minAlt: I.fafAlt - 300, minText: `${I.fafAlt.toLocaleString('en-US')} ft`,
    mins: { vis: 800, ceil: 200 }, minRate: 300, missed: [I.missed[0]], missAlt: I.missed[1],
    phrase: r => `maintain ${altWords(I.ifAlt)} until established on the localizer, cleared ILS runway ${r} approach`, read: r => `cleared ILS ${r}`,
    decCall: r => `${APT.tower[0]}, ${I.faf}, ILS runway ${r}`, decNeed: `Inbound past ${I.faf}, needs landing clearance`, decFail: 'not visual at minimums' };
  F.cum = new Array(F.pts.length).fill(0); for (let i = F.pts.length - 2; i >= 0; i--) F.cum[i] = F.cum[i+1] + dist(...F.pts[i], ...F.pts[i+1]);
  const meet = (I.ifAlt - elev - 50)/318;                    // 3° = 318 ft per NM
  F.prof = [[0, elev + 50], [meet, I.ifAlt], [F.cum[0] + 1, I.ifAlt]];
  FINAL[rw] = F;
}
// 13R has no ILS: in the south-east flow it is the departure runway. Its arrivals would fly the VOR/DME or Parkway Visual.

// ── from the end of each STAR to the intermediate fix: a downwind and base laid out beside the final (hidden points,
// the radar vectors a New York Approach controller would give), so an arrival with no instructions still gets there
const FEED_ALT = {};
function feeder(rw, from){
  const I = KJFK.ILS[rw], thr = THR[rw], out = norm(crsOf(rw) + 180), dIF = dist(...thr, ...WP[I.ifx].p);
  const f = WP[from].p, dx = f[0] - thr[0], dy = f[1] - thr[1], ux = Math.sin(out*D2R), uy = Math.cos(out*D2R);
  const along = dx*ux + dy*uy, right = dx*uy - dy*ux, s = right >= 0 ? 1 : -1;
  const pt = (a, l) => add(add(thr, out, a), out + 90, l);
  // the altitudes New York Approach gives on them: the downwind 1,000 ft above the intermediate fix, the base at its altitude
  const tag = `${rw}${s > 0 ? 'R' : 'L'}`, mk = (k, p, note) => { WP[tag + k] = { id: tag + k, p, hide: true, note }; FEED_ALT[tag + k] = I.ifAlt + (k === 'B' ? 0 : 1000); return tag + k; };
  if (along > dIF + 3 && Math.abs(right) < 2.5) return [I.ifx];                    // already on the extended centreline
  const base = mk('B', pt(dIF + 4, s*2.5), `base for ${rw}`);
  if (along > dIF + 3) return [base, I.ifx];
  const dw2 = mk('D', pt(dIF + 3, s*6), `downwind for ${rw}`);
  if (along > 1) return [dw2, base, I.ifx];
  return [mk('A', pt(1, s*6), `downwind for ${rw}`), dw2, base, I.ifx];
}
const LAND_RWYS = Object.keys(KJFK.ILS);
const ARR_ROUTE = Object.fromEntries(GATES.map(g => [g, Object.fromEntries(LAND_RWYS.map(rw => {
  const star = [...starFrom(g), ...(/^22/.test(rw) && STAR_OF(g).rw22 ? STAR_OF(g).rw22 : [])];
  return [rw, [...star, ...feeder(rw, star[star.length - 1])]];
}))]));
// the departure runway may be 13R (no ILS): an arrival's route for it is the 13L one
for (const g of GATES) ARR_ROUTE[g]['13R'] = ARR_ROUTE[g]['13L'];
const HOLD_AT = Object.fromEntries(GATES.map(g => [g, STAR_OF(g).pts[STAR_OF(g).pts.length - 1][0]]));

// ── departures: the Kennedy Five (radar vectors) or an RNAV SID where one serves the runway and the direction
const rnavSid = (gate, rwy) => { const n = KJFK.DIR[gate].rnav; return n && KJFK.SIDS[n].rwys.includes(rwy) ? n : null; };
const sidName = (gate, rwy) => rnavSid(gate, rwy) || 'JFK5';
const sidSpoken = n => (KJFK.SIDS[n] || {}).spoken || n;
const exitRoute = (g, rwy) => { const n = rnavSid(g, rwy); return n ? KJFK.SIDS[n].pts.slice() : KJFK.DIR[g].route.slice(); };
const EXIT_ROUTE = {}, EXIT_FIX = {};
for (const g of GATES) {
  Object.defineProperty(EXIT_ROUTE, g, { enumerable: true, get: () => exitRoute(g, depRw()) });
  Object.defineProperty(EXIT_FIX, g, { enumerable: true, get: () => { const r = exitRoute(g, depRw()); return r[r.length - 1]; } });
}
const NEXT_UNIT = Object.fromEntries(GATES.map(g => [g, KJFK.CTR[KJFK.DIR[g].ctr]]));
const relUnit = ac => 'New York Center';
const TEL = KJFK.TEL;
const isMil = ac => false;
const gateFor = ap => ap === 'KJFK' ? 'W' : (KJFK.PLACE_DIR[ap] || 'W');

// ═════════════════════════ schedule ═════════════════════════
const withGate = x => ({ ...x, gate: x.gate || gateFor(x.k === 'ARR' ? x.o : x.d) });
const TIMETABLE = KJFK.TIMETABLE;
const REGS = { C56X: 'N622QS', PC12: 'N280BC' };
const LONG_STAY = KJFK.LONG_STAY;
const EXTRA = KJFK.EXTRA.map(withGate);
const EXERCISES = Object.fromEntries(Object.entries(KJFK.EXERCISES).map(([k, e]) => ['k' + k, { ...e, sched: e.sched.map(withGate) }]));
const WX_PRESETS = KJFK.WX_PRESETS;

// ═════════════════════════ weather rules ═════════════════════════
// gusty north-westerlies behind a cold front and summer thunderstorms bring windshear on short final
const TURB_TABLE = {};
function turbExcess(w){
  if (w.vrb || w.spd < 14) return 0;
  return Math.max(0, Math.max(w.spd, (w.gust || 0)*0.85) - 26);
}
// ILS CAT I: 200 ft and 1/2 SM (RVR 1800)
const minsOk = (w, rw) => w.vis >= 800 && w.ceil >= 200;
const sraMinsOk = w => minsOk(w, '22L');
// runway configuration by wind: the pair with the most headwind (calm: the south-west flow, 22L and 22R)
const CONFIGS = [['22L', '22R'], ['4R', '4L'], ['31R', '31L'], ['13L', '13R']];
function rwyFor(w){
  if (w.vrb || w.spd < 5) return { land: '22L', dep: '22R' };
  let best = null; for (const [l, d] of CONFIGS) { const h = windComp(w, crsOf(l)).head; if (!best || h > best.h + 0.5) best = { land: l, dep: d, h }; }
  return { land: best.land, dep: best.dep };
}
const depFor = rw => (CONFIGS.find(([l]) => l === rw) || [])[1] || parallelOf(rw) || rw;

// Manhattan: below 2,000 ft over the towers (One World Trade Center is 1,776 ft) counts as an obstacle incident
const MANHATTAN = [[40.700, -74.020], [40.708, -73.976], [40.745, -73.966], [40.800, -73.927], [40.873, -73.908], [40.880, -73.928], [40.760, -74.012], [40.705, -74.022]].map(LL);

// ═════════════════════════ engine hooks ═════════════════════════
// "runway 31L", or "runway 31L at Kilo Echo" for an intersection departure (JO 7110.65 3-9-4)
const rwyAt = (ac, hp) => `runway ${depRw(ac)}${hp && HOLDS[hp] && intxHolds(depRw(ac)).includes(hp) ? ' at ' + PHON[HOLDS[hp].ref] : ''}`;
const windFAA = () => { const w = S.wx; return `wind ${w.vrb ? 'variable' : hdg3(w.dir)} at ${w.spd}${w.gust ? ' gust ' + w.gust : ''}`; };
const altim = () => `altimeter ${S.wx.inhg.toFixed(2)}`;
const visSM = v => v >= 9999 ? '10' : v >= 4800 ? String(Math.round(v/1609)) : String(Math.round(v/1609*4)/4).replace(/\.25$/, ' 1/4').replace(/\.5$/, ' 1/2').replace(/\.75$/, ' 3/4').replace(/^0 /, '');
const APT = {
  arrAlt: { ...arrAltOf(GATES.map(STAR_OF)), ...FEED_ALT },   // STAR expect-altitudes, then the downwind and base
  icao: 'KJFK', name: 'New York JFK', coordName: 'Kennedy', radarName: 'JFK', utcOff: -4,
  radar: [KJFK.UNITS.app.name, KJFK.UNITS.app.freq], depRadar: [KJFK.UNITS.dep.name, KJFK.UNITS.dep.freq],
  // two tower frequencies: 119.1 for 4R/22L and 13L/31R, 123.9 for 4L/22R and 13R/31L. Arrivals call the one for their runway.
  get tower(){ return [KJFK.UNITS.twr.name, KJFK.UNITS.twr.freq[RWYS_BY_END(S.rwy).id]]; },
  gnd: [KJFK.UNITS.gnd.name, KJFK.UNITS.gnd.freq],
  runways: RWY_LIST, inHg: true, rwyHalfWidth: 23,
  xing: false, drawnTown: false, ta: KJFK.TA, initClimb: 5000, gaAlt: 3000, appAlt: 3000, handoffNM: 18, climbFL: 190, divertAlt: 9000,
  area: { dep: 45, arr: 100, div: 45 }, roll: [70, RWY_M - 70], defRwy: '22L', defWx: 'sw',
  appName: 'ILS approach', appShort: 'ILS', minsText: 'weather below the ILS minimums', reqApp: rw => 'ILS approach',
  minsLong: 'Weather is below the ILS CAT I minimums (200 ft and 1/2 statute mile).',
  liveName: 'JFK Airport', liveThin: 20, atisFreq: KJFK.UNITS.atis.freq, turbName: 'New York',
  sessionHours: Array.from({ length: 17 }, (_, i) => i + 10),   // 1000Z to 0200Z next day: 06:00 to 22:00 in New York
  view: { app: [0, 0, 75], twr: [ARP[0] - (R0.rm(RWY_M/2)[0]), ARP[1] - (R0.rm(RWY_M/2)[1]), 3.4], gnd: [mOf(ARP), offOf(ARP), 4600, 3800] },
  minsOk,
  splitRwy: true, rwyFor, depFor,
  appRwys: () => FINAL[parallelOf(S.rwy)] ? [S.rwy, parallelOf(S.rwy)] : [S.rwy],
  // departures need a release only on flow-restricted routes: Boston and the Washington corridor (Approval Request)
  needRel: ac => KJFK.APREQ.includes(ac.d),
  // remote hardstands for long turnarounds (towed to the gate), shown as their own group in the stand picker
  remoteAreas: ['remote'],
  areaNames: { civil: 'gates', remote: 'remote hardstands' },
  termName: t => t === 'R' ? 'Remote hardstands' : t === 'C' ? 'Cargo stands' : 'Terminal ' + t,
  remoteWord: s => s.term === 'C' ? 'cargo stand' : 'hardstand',
  prefArea: ac => { const t = TERMINAL_OF[ac.cs.slice(0, 3)] || '4'; return { key: t, name: 'Terminal ' + t, has: s => s.term === t }; },
  standFor: ac => { const t = TERMINAL_OF[ac.cs.slice(0, 3)] || '4'; const free = STANDS.filter(s => standFree(s, ac) && s.term === t); return free[Math.floor(Math.random()*Math.min(free.length, 6))] || null; },
  inboundAlt: gate => gate === 'S' || gate === 'SW' ? 8000 : 9000,
  divertTo: ac => ac.gate === 'S' || ac.gate === 'SW' || ac.gate === 'W' || ac.gate === 'NW' ? ['Newark', 'PUCKY'] : ['Boston', 'MERIT'],
  firstAlt: g => ENTRY_ALT[g] - 2000,
  rolledCall: 'request taxi',
  vacExits: ac => { const R = RWYS_BY_END(ac.app || S.rwy), m = R.mOf([ac.x, ac.y]), dir = (ac.app || S.rwy) === R.lo ? 1 : -1;
    return exitsFor(ac.app || S.rwy).filter(k => (HOLDS[k].m - m)*dir > 30 && Math.sign(HOLDS[k].off) === R.side).slice(0, 4); },
  vacPrefs: (st, ac) => exitsFor(ac && ac.app || S.rwy),
  exitFor,
  lineUpWords: hp => 'line up and wait',
  terrain: { name: 'the Manhattan skyline', poly: MANHATTAN, min: 2000, low: 1500, msg: ac => `${ac.cs} is over Manhattan at ${Math.round(ac.alt)} ft (One World Trade Center is 1,776 ft)${ac.alt < 1500 ? ', OBSTACLE' : ''}.` },
  restricted: null,
  drawAirport: drawKjfk, drawAirportTop: drawKjfkTop,
  gaEarly(ac, rw){},
  // missed approach: climb on the runway heading to the published altitude, then direct the missed approach fix and hold
  gaTurn(ac){ const rw = ac.gaRwy, F = FINAL[rw] || FINAL['22L']; if (dist(ac.x, ac.y, ...THR[rw]) > 1.2 || ac.alt > ELEV + 1200) { ac.gaTurn = true; ac.mode = 'NAV'; ac.route = F.missed.slice(); } },
  // Kennedy Five: the initial heading by runway after 400 ft (31L/R: the Breezy Point climb, left turn direct Canarsie);
  // RNAV SIDs turn for their first fix at 520 ft
  liftoff(ac){ ac.tgtHdg = Math.round(crsOf(ac.depRwy)); ac.turnDir = 0; },
  depTurn(ac){
    if (ac.turned || ac.alt < ELEV + 400) return;
    ac.turned = true;
    if (rnavSid(ac.gate, ac.depRwy)) return;
    const init = KJFK.SIDS.JFK5.init[ac.depRwy], h = typeof init === 'string' ? Math.round(brg(ac.x, ac.y, ...WP[init].p)) : init;
    if (h == null) return;
    ac.turnDir = Math.sign(angDiff(ac.hdg, h)) || 0; if (/^31/.test(ac.depRwy)) ac.turnDir = -1;
    ac.tgtHdg = h;
  },
  depClear: ac => !!ac.turned && (rnavSid(ac.gate, ac.depRwy) ? ac.alt > ELEV + 520 : ac.alt > ELEV + 1800),
  shear(ac, rw, w){ return w.cb && Math.random() < 0.15 ? 'windshear from the thunderstorm on final' : null; },
  shearWhy: rw => S.wx.cb ? 'microburst alert on final' : 'windshear on short final',
  faceHold: (st, f) => depHold({ stand: st, leftStand: false, x: st.p[0], y: st.p[1] }),
  faceWord: f => f,
  faceHdg: (st, f) => norm(laneDir(st, f) + 180),          // taxilanes run every way here: name the face by the compass
  // the three departure-end entries nearest the aircraft, then the intersection departures, longest runway ahead first
  taxiHolds: (south, ac) => { const rw = depRw(ac), ks = endHolds(rw), p = ac ? (ac.stand && !ac.leftStand ? ac.stand.lp : [ac.x, ac.y]) : ARP;
    const rec = ac && depHold(ac), ends = [...new Set([rec, ...ks.sort((a, b) => dist(...p, ...GN[HOLDS[a].node].p) - dist(...p, ...GN[HOLDS[b].node].p))].filter(Boolean))].slice(0, 3);
    return [...ends, ...intxHolds(rw).filter(k => !ac || ac.perf.wake !== 'H' || intxRun(k, rw) >= 3000)]; },
  holdNote: (hp, rw) => intxHolds(rw).includes(hp) ? ` · intersection, ${(Math.round(intxRun(hp, rw)/0.3048/100)*100).toLocaleString("en-US")} ft of runway ahead` : '',
  depHoldAs,
  // a departure goes from one of its runway's entries
  taxiCheck: (ac, hp) => { if (ac.kind !== 'DEP' || !HOLDS[hp]) return null; const rw = depRw(ac), ok = depHolds(rw);
    // a heavy jet wants at least 3,000 m (about 9,800 ft) ahead of it
    if (intxHolds(rw).includes(hp) && ac.perf.wake === 'H' && intxRun(hp, rw) < 3000) return `${ac.cs} (${ac.t}, heavy) needs more runway than ${HOLDS[hp].ref} leaves (${(Math.round(intxRun(hp, rw)/0.3048/100)*100).toLocaleString('en-US')} ft): it can't take an intersection departure there.`;
    if (ok.includes(hp)) return null;
    const ref = k => HOLDS[k].ref, ends = [...new Set(endHolds(rw).map(ref))], ix = [...new Set(intxHolds(rw).map(ref))];
    return `${ref(hp)} is not a runway ${rw} departure point. Runway ${rw} departures enter at ${ends.join(', ')}${ix.length ? `, or at the intersection${ix.length > 1 ? 's' : ''} ${ix.join(', ')}` : ''}.`; },
  taxiHint: rw => `Full-length departures from runway ${rw} enter at the runway end${intxHolds(rw).length ? `, intersection departures at ${[...new Set(intxHolds(rw).map(k => HOLDS[k].ref))].join(', ')}` : ''}. Kennedy has no turning pads: the crew lines up straight onto the runway.`,
  // medical diversions: flights crossing the New York area at cruise
  diverts: [{ cs: 'UAL917', t: 'B772', o: 'KIAD', gate: 'SW', to: 'London' }, { cs: 'ACA871', t: 'B789', o: 'CYYZ', gate: 'NW', to: 'Paris' },
    { cs: 'AAL1281', t: 'A321', o: 'KMIA', gate: 'S', to: 'Boston' }, { cs: 'DAL1955', t: 'B739', o: 'KATL', gate: 'SW', to: 'Hartford' }],
  airports: KJFK.AIRPORTS, via: {},
  airlineIcao: KJFK.AIRLINE_ICAO, airlineType: KJFK.AIRLINE_TYPE, defType: 'A320',
  placeIcao: KJFK.PLACES,
  standWord: 'gate',
  // FAA phraseology (JO 7110.65): "climb and maintain", "altimeter 29.92", "line up and wait", wind before the clearance
  phr: {
    altim,
    alt: (a, up) => [`${up ? 'climb' : 'descend'} and maintain ${altWords(a)}`, `${up ? 'climb' : 'descend'} and maintain ${altShort(a)}`],
    speed: s => [`maintain ${s} knots`, `${s} knots`],
    taxi: (ac, hp, vw) => { const via = [...vw, HOLDS[hp].ref].map(t => PHON[t] || t).join(', ');
      return [`${rwyAt(ac, hp)}, taxi via ${via}, ${altim()}`, `${rwyAt(ac, hp)}, taxi via ${via}`]; },
    taxiPop: () => `runway ${depRw()}, taxi via <em></em>, ${altim()}`,
    atHold: (ac, hp) => `holding short runway ${depRw()} at ${PHON[hp]}, ready for departure`,
    lineUp: (ac, hp) => [`${rwyAt(ac, hp)}, line up and wait`, `line up and wait ${rwyAt(ac, hp)}`],
    cto: (ac, sid, chg) => { const init = KJFK.SIDS.JFK5.init[depRw()], rnav = KJFK.SIDS[sid] && KJFK.SIDS[sid].rnav;
      const how = rnav ? `RNAV to ${KJFK.SIDS[sid].pts[0]}` : typeof init === 'string' ? 'Breezy Point climb' : `fly heading ${hdg3(norm(init - KJFK.RWY.var))}`;
      return [`${chg ? 'amended departure, ' : ''}${windFAA()}, ${rwyAt(ac, ac.hp)}, ${how}, cleared for takeoff`, `${how}, cleared for takeoff ${rwyAt(ac, ac.hp)}`]; },
    ctl: (ac, rw) => [`${windFAA()}, runway ${rw}, cleared to land`, `cleared to land runway ${rw}`],
    push: (ac, dn, face) => {
      const fix = EXIT_FIX[ac.gate], f = KJFK.UNITS.dep.freq.replace(/0+$/, '');
      return [`cleared to ${dn} airport via the ${sidSpoken(ac.sid)} departure, ${fix} transition, then as filed, maintain ${altWords(APT.initClimb)}, expect flight level three five zero one zero minutes after departure, departure frequency ${f}, squawk ${ac.sqk}. Push back approved, tail ${face === 'east' ? 'west' : 'east'}, ${altim()}`,
        `cleared ${dn} via the ${sidSpoken(ac.sid)}, ${fix} transition, maintain ${altShort(APT.initClimb)}, ${f}, squawk ${ac.sqk}, push approved`]; },
    startReq: ac => `${KJFK.UNITS.gnd.name}, gate ${ac.stand.id}, ${ac.perf.name} to ${AP[ac.d] ? AP[ac.d][2] : ac.d}, with information ${phonetic(S.atis)}, ready to push`,
    checkIn: ac => `${APT.radar[0]}, ${altShort(Math.round(ac.alt/100)*100)} descending ${altShort(ac.tgtAlt)}, ${KJFK.DIR[ac.gate].star.replace(/(\d)$/, ' $1')} arrival, information ${phonetic(S.atis)}`,
    depCall: ac => `${APT.depRadar[0]}, ${altShort(Math.round(ac.alt/100)*100)} climbing ${altShort(ac.tgtAlt)}, ${ac.onSid && ac.sid ? sidSpoken(ac.sid) + ' departure' : 'heading ' + hdg3(ac.hdg)}`,
    cross: (ac, rw) => [`cross runway ${rw}`, `crossing runway ${rw}`],
    holdShort: (ac, rw) => `holding short of runway ${rw}`,
    vacated: ac => `${KJFK.UNITS.gnd.name}, clear of ${rwyName(ac.rwyId)} at ${PHON[ac.exit] || ac.exit.replace(/~\d+$/, "")}${ac.stand ? ', for gate ' + ac.stand.id : ''}`,
    taxiHold: (ac, h, vw) => { const via = vw.length ? 'via ' + vw.map(t => PHON[t] || t).join(', ') + ', ' : '', r = h.rwy ? rwyName(HOLDS[h.id].on) : null, at = PHON[HOLDS[h.id] ? HOLDS[h.id].ref : h.id] || h.id;
      return r ? [`taxi ${via}hold short of runway ${r} at ${at}`, `${via}hold short runway ${r} at ${at}`] : [`taxi ${via}hold at ${at}`, `${via}hold at ${at}`]; },
    atHoldPt: (ac, h) => h.rwy ? `holding short of runway ${rwyName(HOLDS[h.id].on)} at ${PHON[HOLDS[h.id].ref] || HOLDS[h.id].ref}` : `holding at ${h.id}`,
    taxiIn: (ac, st, vw) => { const k = xingAhead(ac), hs = k >= 0 ? `, hold short runway ${rwyName(ac.path.pts[k].hs)}` : '', via = vw.length ? ' via ' + vw.map(t => PHON[t] || t).join(', ') : '';
      return [`taxi to gate ${st.id}${via}${hs}`, `gate ${st.id}${via}${hs}`]; }
  },
  atisPanel(w){
    const c = windComp(w, crsOf(S.rwy)), bad = !minsOk(w, S.rwy), r = rwyFor(w);
    return `<div class="warnline${bad ? ' bad' : ''}">Landing ${S.rwy} · departing ${depRw()}${r.land !== S.rwy || r.dep !== depRw() ? ` (wind favours ${r.land} / ${r.dep})` : ''} · ${bad ? 'below the ILS minimums' : 'ILS approaches'} · crosswind ${Math.round(Math.abs(c.crossG))} kt. Arrivals on 4R/22L cross 4L/22R to reach the terminals.</div>`;
  },
  atisLines({ w, L, E }){
    const cl = w.clouds.length ? w.clouds.map(c => { const m = c.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3})/); return m ? `${{ FEW: 'few clouds', SCT: 'scattered', BKN: 'ceiling broken', OVC: 'ceiling overcast', VV: 'indefinite ceiling, vertical visibility' }[m[1]]} at ${(+m[2]*100).toLocaleString('en-US')}` : c; }).join(', ') : 'sky clear';
    const out = [
      `Kennedy airport information ${phonetic(L)}, ${zt(S.t).slice(0,5).replace(':', '')} Zulu.`,
      `Wind ${w.vrb ? 'variable' : hdg3(w.dir)} at ${w.spd}${w.gust ? ', gust ' + w.gust : ''}. Visibility ${visSM(w.vis)}${w.wx.length ? ', ' + w.wx.join(' ') : ''}. ${cl[0].toUpperCase() + cl.slice(1)}.`,
      `Temperature ${w.temp}, dew point ${w.dew}. Altimeter ${w.inhg.toFixed(2)}.`,
      `ILS runway ${S.rwy} approach in use. Departing runway ${depRw()}.`
    ];
    if (turbExcess(w) > 0) out.push('Low level windshear advisories in effect.');
    if (E && E.ws) out.push(`Windshear reported on final runway ${E.ws.rw} at ${zt(E.ws.t).slice(0,5).replace(':', '')}, ${E.ws.text}.`);
    if (E && E.rwyBlock) out.push(`Runway ${S.rwy} closed: ${E.rwyBlock.why}. Expect delays.`);
    if (!minsOk(w, S.rwy)) out.push('Visibility below ILS minimums. Expect holding.');
    out.push('Readback all runway hold short instructions. Departures to Boston and the Washington area: expect a call for release.');
    out.push(`Advise on initial contact you have information ${phonetic(L)}.`);
    return out;
  },
  // the website: home hero, previews, scenario cards and Academy figures
  site: {
    hero: () => [
      ['JBU702', 40.83, -73.55, 210, 210, PAL.light.arr], ['DAL401', 40.45, -73.90, 20, 230, PAL.light.arr], ['BAW115', 40.95, -73.20, 230, 250, PAL.light.arr],
      ['AAL1', 40.58, -73.86, 210, 200, PAL.light.dep], ['UAE202', 40.50, -73.95, 225, 250, PAL.light.dep],
      ['UAL23', 40.90, -74.30, 120, 430, 'rgba(60,75,95,.7)'], ['ACA41', 41.10, -73.60, 180, 420, 'rgba(60,75,95,.7)'], ['SWA1771', 40.30, -73.40, 40, 430, 'rgba(60,75,95,.7)']
    ],
    demo(mk, park){
      const F = FINAL['22L'], fin = add(THR['22L'], norm(CRS['22L'] + 180), 2.6), out = add(THR['22R'], CRS['22R'], 4), inb = add(WP.CAMRN.p, 20, 6);
      const hp = GN[HOLDS[endHolds('22R')[0]].node].p, ids = ['B31', 'B33', '5-12', '8-4'];
      return [
        mk('DAL1103', 'A321', 'DEP', park(ids[0], { need: null, reqAt: 99999 })), mk('DAL264', 'A333', 'DEP', park(ids[1], { need: null, reqAt: 99999 })),
        mk('JBU603', 'A320', 'DEP', park(ids[2], { need: null, reqAt: 99999 })), mk('AAL101', 'B77W', 'DEP', park(ids[3], { need: null, reqAt: 99999 })),
        mk('JBU101', 'E190', 'DEP', { ground: true, state: 'HOLDPT', hp: endHolds('22R')[0], x: hp[0], y: hp[1], hdg: CRS['22R'], gs: 0 }),
        mk('JBU702', 'A320', 'ARR', { state: 'FINAL', mode: 'FINAL', app: '22L', freq: 'TWR', x: fin[0], y: fin[1], hdg: CRS['22L'], alt: 850, gs: 140, vs: -750, o: 'KFLL' }),
        mk('AAL1', 'A321', 'DEP', { state: 'CLIMB', x: out[0], y: out[1], hdg: 211, alt: 3200, gs: 210, vs: 2000, tgtAlt: 5000, d: 'KLAX' }),
        mk('DAL1111', 'A321', 'ARR', { state: 'INBOUND', x: inb[0], y: inb[1], hdg: 20, alt: 9000, gs: 250, vs: -1000, tgtAlt: 8000, o: 'KATL' })
      ];
    },
    thumb(k, zoom, W){
      if (k === 'app') return v => { v.scale *= 1.3; };
      if (k === 'twr') { const c = ARP; return v => { v.cx = c[0] + 0.3; v.cy = c[1] - 0.2; v.scale = W/3.2; }; }
      const c = zoom === 'apron' ? STANDS.find(s => s.id === 'B31').p : ARP;
      return v => { v.cx = c[0]; v.cy = c[1]; v.scale = W/((zoom === 'apron' ? 700 : 3200)*M2NM); };
    },
    figHold: 'CAMRN', emergHp: 'FB~2',
    figConsole: v => { v.scale *= 1.2; },
    cmdHint: 'Command, e.g. JBU702 A30 APP · DAL1103 TAXI · AAL1 CROSS · / to focus, Tab cycles flights'
  }
};
// maintenance hangars (OpenStreetMap hangar buildings, north side and by Terminals 5 and 8): aircraft stored at the start
// of a session are towed to a gate at their airline's terminal an hour before departure. The door is the nearest apron
// taxilane node.
APT.hangars = [[-946.1, 1520.5, 'n549'], [18.6, 1745.3, 'n564'], [888.1, 1249.7, 'n203'], [-1789.4, 1524.7, 'n333'],
  [-1441.3, 1703.3, 'n414'], [-2097.7, 1520.1, 'n546'], [-1928.0, 1735.7, 'k307'], [-1715.5, 2031.4, 'n216']]
  .filter(([, , node]) => GN[node])
  .map(([e, n, node], i) => ({ id: 'H' + (i + 1), name: 'maintenance hangar ' + (i + 1), in: inF0(e, n), door: [GN[node].m, GN[node].off], node, fits: ac => true, pick: ac => APT.standFor(ac) }));
