// ═════════════════════════ Madrid-Barajas (LEMD) airport profile for the engine ═════════════════════════
// Builds every global the engine reads from the chart data in lemd.js (LEMD) and the OpenStreetMap aerodrome in
// lemd-ground.js (metres east and north of the ARP). Barajas has four runways in two pairs and uses them all at once:
// in the north flow arrivals land on 32L and 32R and departures leave from 36L and 36R; in the south flow arrivals land
// on 18R and 18L and departures leave from 14R and 14L. S.rwy names the flow (its west landing runway, 32L or 18R) and
// each aircraft gets its own runway: an arrival lands on the side of the airport it comes from (APT.landRwyOf: west
// 32L / 18R, east 32R / 18L), a departure leaves from the runway nearer its stand (APT.depRwyOf). Arrivals to Terminal
// 4 from 18R and taxiing traffic between Terminals 4 and 4S cross 18R/36L.
Object.assign(TYPES, LEMD.TYPES);
const LL = p => xy(p[0], p[1]);
const G = LEMD_GROUND;
const EN = (e, n) => [e*M2NM, n*M2NM];                     // metres east and north of the ARP (the map origin) → NM

// ═════════════════════════ runways ═════════════════════════
// a frame along each runway: m from the pavement end a (the low-numbered end), off to the left. Some runway entries
// (14L at K1, 36R at Y1, 36L at Z1) join the pavement just beyond the end of the mapped runway: the frame's paved
// extent (m0 to m1) reaches them.
function rwyFrame(r){
  const a = EN(...r.a), b = EN(...r.b), L = dist(...a, ...b), RU = [(b[0]-a[0])/L, (b[1]-a[1])/L], RN = [-RU[1], RU[0]];
  const rm = (m, off=0) => [a[0] + (RU[0]*m + RN[0]*off)*M2NM, a[1] + (RU[1]*m + RN[1]*off)*M2NM];
  const mOf = p => ((p[0]-a[0])*RU[0] + (p[1]-a[1])*RU[1])/M2NM, offOf = p => ((p[0]-a[0])*RN[0] + (p[1]-a[1])*RN[1])/M2NM;
  const len = r.len, ms = G.rnodes.filter(([id]) => Object.values(G.holds).some(h => h[1] === id && h[2] === r.id)).map(([, e, n]) => mOf(EN(e, n)));
  const m0 = Math.min(0, ...ms.map(m => m - 40)), m1 = Math.max(len, ...ms.map(m => m + 40));
  // no turning pads: every departure entry is at a runway end, and arrivals always have an exit ahead
  const TURN_W = [[30, 0]], TURN_E = [[len - 30, 0]];
  return { id: r.id, lo: r.lo, hi: r.hi, len, m0, m1, thr: r.thr, elev: r.elev, rm, mOf, offOf, RU, TURN_W, TURN_E, TURN_END: { W: 30, E: len - 30 },
    roll: [70, len - 70], ends: true, width: 60 };
}
const RWY_LIST = ['14R32L', '14L32R', '18R36L', '18L36R'].map(id => rwyFrame(G.runways.find(r => r.id === id)));
const R0 = RWY_LIST[0];
const rm = R0.rm, mOf = R0.mOf, offOf = R0.offOf, RU = R0.RU;
const RWY_M = R0.len, THR_LO_M = R0.thr['14R'], THR_HI_M = R0.thr['32L'];
const RW_LO = '14R', RW_HI = '32L';
const THR = {}, CRS = {}, THR_ELEV = {};
for (const R of RWY_LIST) {
  THR[R.lo] = R.rm(R.thr[R.lo], 0); THR[R.hi] = R.rm(R.thr[R.hi], 0);
  CRS[R.lo] = brg(...R.rm(0), ...R.rm(R.len)); CRS[R.hi] = norm(CRS[R.lo] + 180);
  THR_ELEV[R.lo] = R.elev[R.lo]; THR_ELEV[R.hi] = R.elev[R.hi];
}
const T_LO = THR[RW_LO], T_HI = THR[RW_HI], CRS_LO = CRS[RW_LO], CRS_HI = CRS[RW_HI];
const crsOf = rw => CRS[rw] ?? CRS_HI;
const ELEV = LEMD.elev;
const ARP = LL(LEMD.arp);
const parallelOf = rw => ({ '14L': '14R', '14R': '14L', '32L': '32R', '32R': '32L', '18L': '18R', '18R': '18L', '36L': '36R', '36R': '36L' })[rw];
// no road crossing, no border fence, no rock
const XING_M = -1e9, XING_SKEW = 0, XING_HW = 0, xingM = o => XING_M;
const FRONTIER = [], R164 = [], ROCK = [], ROCK_TOP = [0, 0];
const TURN_W = R0.TURN_W, TURN_E = R0.TURN_E, TURN_END = R0.TURN_END, TURN_PAD = {};
const RWYS_BY_END = rw => RWY_LIST.find(R => R.lo === rw || R.hi === rw) || R0;

// ═════════════════════════ runway configurations (AD 2.20) ═════════════════════════
const CFG = LEMD.CONFIGS;
const configOf = rw => ['32L', '32R', '36L', '36R'].includes(rw) ? 'north' : 'south';
const cfgNow = () => configOf(S.rwy);
const landRwys = (c = cfgNow()) => [CFG[c].land.west, CFG[c].land.east];
const depRwysOf = (c = cfgNow()) => [CFG[c].dep.west, CFG[c].dep.east];

// ═════════════════════════ taxiways, holding points, stands (lemd-ground.js) ═════════════════════════
const inF0 = (e, n) => { const p = EN(e, n); return [mOf(p), offOf(p)]; };
for (const [id, e, n] of G.nodes) gn(id, ...inF0(e, n));
for (const [id, e, n] of G.rnodes) gn(id, ...inF0(e, n));
for (const [a, b, tw, mid] of G.edges) chain(a, mid.map(([e, n]) => inF0(e, n)), b, tw);
const HOLDS = {}, FIL = {};
for (const [k, [node, rwy, on, m, off, dirs, end, tw]] of Object.entries(G.holds)) {
  HOLDS[k] = { node, rwy, on, m, off, dirs: dirs.split(','), end: end || null, ref: k.replace(/~\d+$/, ''), tw };
  const Rh = RWY_LIST.find(R => R.id === on) || R0;            // hlink is m/off in its own runway's frame: carry it into R0's
  chain(rwy, (G.hlink[k] || []).map(([m, o]) => { const p = Rh.rm(m, o); return [mOf(p), offOf(p)]; }), node, HOLDS[k].ref);
  FIL[k] = { W: G.fil[k], E: G.fil[k] };                  // the mapped centreline-to-taxiway curve, used either way
}
// the runway-holding positions: a path point there stops the aircraft until cleared onto or across the runway
for (const [id, rid] of Object.entries(G.hs)) if (GN[id]) GN[id].p.hs = rid;
// stands (PDC): Terminals 1-2-3 (7-74, 176-177, T1-T36), Terminal 4 (300-448) and its satellite 4S (500-722). Ramps 5
// and 6 (75-175) and the outer stands of T-4 (412-432) and T-4S (600-628, 700-722) are remote stands, towed to and
// from a terminal for long turnarounds; ramp 7 by the cargo terminal (178-264) is the cargo apron, used the same way.
const kindOf = id => { const n = /^\d+$/.test(id) ? +id : null; if (n == null) return null;
  return n >= 178 && n <= 264 ? 'C' : (n >= 75 && n <= 175) || (n >= 412 && n <= 432) || (n >= 600 && n <= 628) || (n >= 700 && n <= 722) ? 'R' : null; };
const STANDS = G.gates.map(([id, term, [e, n], node]) => { const p = EN(e, n), k = kindOf(id);
  return { id, term: k || term, p, m: mOf(p), off: offOf(p), node, area: k ? 'remote' : 'civil', occ: null, noLead: k === 'C' }; });
STANDS.forEach(s => { s.lp = GN[s.node].p; s.hdg = brg(...s.lp, ...s.p); });
const APRONS = G.aprons.map(r => r.map(([e, n]) => inF0(e, n)));
const TERM_NAME = { '123': 'Terminals 1-2-3', '4': 'Terminal 4', '4S': 'Terminal 4S', R: 'remote stands', C: 'cargo stands' };
// which side of each runway its exits are on (the side the taxiway system is)
for (const R of RWY_LIST) { const o = Object.values(HOLDS).filter(H => H.on === R.id && !H.end).reduce((a, H) => a + Math.sign(H.off), 0); R.side = o >= 0 ? 1 : -1; }

// taxiway names: letters spoken one by one (ZW3 "Zulu Whiskey 3"), digits as numbers; holding points without the ~n suffix
const NATO = { A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike',
  N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu' };
const twyWords = t => (t.replace(/~\d+$/, '').match(/[A-Z]|\d+/g) || [t]).map(x => NATO[x] || x).join(' ');
const PHON = {};
for (const e of GE) if (e.tw && e.tw !== 'APRON' && !PHON[e.tw]) PHON[e.tw] = twyWords(e.tw);
for (const k of Object.keys(HOLDS)) PHON[k] = twyWords(k);
for (const [id] of G.ihps) PHON[id] = twyWords(id);
PHON.APRON = 'the apron';

// ── each aircraft's runway. A departure leaves from the runway its holding point is on, otherwise from the departure
// runway of the flow: in the north flow Terminal 4 to 36L and Terminal 4S to 36R (the AIP's standard routes),
// otherwise the one nearer its stand by taxi distance.
const endHolds = rw => Object.keys(HOLDS).filter(k => HOLDS[k].end === rw);
const routeLen = (from, to) => { const r = route(from, to); return r ? pathLen(r.nodes) : Infinity; };
const fromNode = ac => ac.stand && !ac.leftStand ? ac.stand.node : (nearestNode([ac.x, ac.y], n => !/^R/.test(n.id)) || {}).id;
const DEP_PICK = new Map();
function depRwyOf(ac){
  const now = depRwysOf();
  if (ac.depRwy && (ac.cto || now.includes(ac.depRwy))) return ac.depRwy;
  if (ac.hp && HOLDS[ac.hp]) { const r = now.find(r => RWYS_BY_END(r).id === HOLDS[ac.hp].on); if (r) return r; }
  const from = fromNode(ac); if (!from) return now[0];
  // north flow (AD 2.20 standard taxi routes): Terminal 4 (and its remote stands) to 36L, Terminal 4S (and its) to 36R
  const st = ac.stand && !ac.leftStand ? ac.stand : null, n = st && /^\d+$/.test(st.id) ? +st.id : 0;
  if (cfgNow() === 'north' && st && (st.term === '4' || st.term === '4S' || (n >= 412 && n <= 432) || n >= 600)) return st.term === '4S' || n >= 600 ? '36R' : '36L';
  const key = cfgNow() + '|' + from;
  if (!DEP_PICK.has(key)) { let best = now[0], bl = Infinity;
    for (const r of now) for (const k of endHolds(r)) { const L = routeLen(from, HOLDS[k].node); if (L < bl) { bl = L; best = r; } }
    DEP_PICK.set(key, best); }
  return DEP_PICK.get(key);
}
// an arrival lands on the side it comes from: west 32L / 18R, east 32R / 18L
const gateSide = gate => (LEMD.DIR[gate] || LEMD.DIR.NE).side;
const landRwyOf = ac => CFG[cfgNow()].land[gateSide(ac.gate)];

// departure entries: the holding points at the departure end of the aircraft's runway, nearest by taxi route
function depHold(ac){
  const rw = depRw(ac), from = fromNode(ac);
  const ks = endHolds(rw); let best = ks[0], bl = Infinity;
  for (const k of ks) { const L = routeLen(from, HOLDS[k].node); if (L < bl) { bl = L; best = k; } }
  return best;
}
// nose-in stands: the tug pushes the tail back onto the taxilane, then 40 m along it the way the tail points
function laneDir(st, face){
  const tail = face === 'east' ? 270 : 90, lp = st.lp;
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
// exits for a landing runway: those the roll-out direction can turn into, on the taxiway side, in the order met
// (AD 2.20.7 rapid exits: 32L L7, L5, L3, L2; 32R K5, K4; 18L Y5, Y4; 18R Z10, Z7)
function exitsFor(rw){
  const R = RWYS_BY_END(rw), up = rw === R.lo, thr = R.thr[rw];
  const ks = Object.keys(HOLDS).filter(k => { const H = HOLDS[k]; return H.on === R.id && H.dirs.includes(rw) && (up ? H.m > thr + 700 : H.m < thr - 700); });
  const near = ks.filter(k => Math.sign(HOLDS[k].off) === R.side), far = ks.filter(k => Math.sign(HOLDS[k].off) !== R.side);
  const order = a => a.sort((x, y) => (HOLDS[x].m - HOLDS[y].m)*(up ? 1 : -1));
  return [...order(near), ...order(far)];
}
// a name the controller says ("VAC L5") to the exit of that taxiway on the aircraft's runway, ahead of it
function exitFor(ac, name){
  const rw = ac.app || landRw(ac), R = RWYS_BY_END(rw);
  if (HOLDS[name] && HOLDS[name].on === (ac.rwyId || R.id)) return name;
  const m = R.mOf([ac.x, ac.y]), dir = rw === R.lo ? 1 : -1;
  const ks = Object.keys(HOLDS).filter(k => (HOLDS[k].ref === name || HOLDS[k].tw === name) && HOLDS[k].on === R.id && (HOLDS[k].m - m)*dir > 20);
  return ks.sort((a, b) => (Math.sign(HOLDS[b].off) === R.side) - (Math.sign(HOLDS[a].off) === R.side) || (HOLDS[a].m - HOLDS[b].m)*dir)[0] || null;
}

// ═════════════════════════ aerodrome drawing ═════════════════════════
// taxiways 23 m (ICAO code E/F); runways 60 m
const AD_SITE = { pave: { w: 23 }, aprons: APRONS, roads: [], buildings: [], twyExtra: [], shoulder: [0, RWY_M], serviceRoad: false, paag: [], floods: [], twyLabels: [], hotspots: [], labels: [] };
const TERM_LABELS = (() => { const by = {}; for (const s of STANDS) if (s.area === 'civil') (by[s.term] ||= []).push(s.p); return Object.entries(by).map(([t, ps]) => [TERM_NAME[t].toUpperCase(), ps.reduce((a, p) => [a[0] + p[0]/ps.length, a[1] + p[1]/ps.length], [0, 0])]); })();
function drawLemd(){
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
    cx.lineWidth = lw(44); for (const s of STANDS) { pathP([s.lp, s.p], false); cx.stroke(); }
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
      // ICAO Annex 14: threshold stripes (16 on a 60 m runway), aiming point at 400 m, touchdown zone bars in threes, twos
      // and ones to 900 m, arrows down the centreline before each displaced threshold (all four landing thresholds)
      for (const [m0, dir] of [[R.thr[R.lo], 1], [R.thr[R.hi], -1]]) {
        quad(m0, -hw, m0 + dir*3, hw);
        for (let i = 0; i < 8; i++) for (const k of [-1, 1]) { const o = k*(3 + i*(hw - 3)/8); quad(m0 + dir*6, o, m0 + dir*36, o + k*1.8); }
        for (const k of [-1, 1]) quad(m0 + dir*400, k*10, m0 + dir*460, k*20);
        for (const [d, n] of [[150, 3], [300, 3], [600, 2], [750, 2], [900, 1]]) for (const k of [-1, 1]) for (let j = 0; j < n; j++) {
          const o = k*(10 + j*3.3); quad(m0 + dir*d, o, m0 + dir*(d + 22.5), o + k*1.8);
        }
        const pre = dir > 0 ? m0 : R.len - m0;
        if (pre > 60) {
          cx.lineWidth = lw(0.9);
          for (let d = 30; d < pre - 15; d += 60) { const m = m0 - dir*d; pathP([R.rm(m - dir*18, 0), R.rm(m, 0)], false); cx.stroke(); pathP([R.rm(m - dir*8, -3), R.rm(m, 0), R.rm(m - dir*8, 3)], false); cx.stroke(); }
          for (const k of [-1, 1]) { const m = m0 - dir*8; pathP([R.rm(m - dir*10, k*8), R.rm(m, k*12), R.rm(m - dir*10, k*16)], false); cx.stroke(); }
        }
      }
      for (const [rw, m0] of [[R.lo, R.thr[R.lo] + 60], [R.hi, R.thr[R.hi] - 60]]) drawRwyDesignator(...P2(R.rm(m0, 0)), rw, crsOf(rw), Math.max(9, 16*mpx));
    }
    // lead-on and lead-off lines: the mapped fillet curves carried over the runway to its centreline
    { const seen = new Set(), leads = []; for (const k in FIL) { const f = FIL[k].W, key = HOLDS[k].on + JSON.stringify(f); if (seen.has(key)) continue; seen.add(key);
      const R = rwyById(HOLDS[k].on); leads.push(leadLine(f).map(p => P2(R.rm(...p)))); }
      groundLines(lw(0.35), () => leads.forEach(strokeSmooth)); }
    // taxiway centrelines, stopping at the runway edges
    groundLines(lw(0.35), () => { for (const e of GE) { pathP([GN[e.a].p, GN[e.b].p], false); cx.stroke(); } });
    // runway holding positions (pattern A): two solid and two dashed lines across the taxiway, parallel to the runway
    for (const [id, rid] of Object.entries(G.hs)) {
      const n = GN[id]; if (!n) continue; const R = rwyById(rid), m = R.mOf(n.p), o = R.offOf(n.p), s = Math.sign(o);
      for (const [d, dash] of [[0.9, false], [0.3, false], [-0.3, true], [-0.9, true]]) { cx.setLineDash(dash ? [mpx + 1, mpx + 1] : []); pathP([R.rm(m - 11, o + s*d), R.rm(m + 11, o + s*d)], false); cx.stroke(); }
      cx.setLineDash([]);
    }
    // stand lead-in lines and numbers
    groundLines(lw(0.3), () => { for (const s of STANDS) if (!s.noLead) { pathP([s.lp, s.p], false); cx.stroke(); } });
    if (IMG) { cx.save(); clipOut(G.buildings.map(b => b.pts.map(([e, n]) => P2(EN(e, n))))); drawStandDetail(null, null, mpx); cx.restore(); }   // stand paint stops at the terminal walls
    else if (sc > 600) { cx.fillStyle = rgba('lab', .8); cx.font = `600 ${Math.max(9, 4*mpx)}px ${FONT_L}`; for (const s of STANDS) { const [X, Y] = P2(s.p); cx.fillText(s.id, X + 3, Y - 3); } }
    drawGroundSigns();
  }
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
const DIR = LEMD.DIR, GATES = Object.keys(DIR);
const STAR_FIXES = new Set(Object.values(LEMD.STARS).flatMap(s => s.pts.map(p => p[0])));
const SID_ENDS = new Set(Object.values(LEMD.SIDS).map(s => s.pts[s.pts.length - 1][0]));
for (const [id, p] of Object.entries(LEMD.FIX)) if (!LEMD.NAV[id]) wp(id, p[0], p[1], STAR_FIXES.has(id) || SID_ENDS.has(id) ? {} : { minor: true });
for (const [id, n] of Object.entries(LEMD.NAV)) wp(id, ...(n.p || LEMD.FIX[id]), { note: `${n.name} ${n.freq}` });
const RADAR_REF = ARP;
// the STAR for a direction in a flow (north: ...C/D to FAFEQ or RUDBI; south: ...A/B/E to RILKO or LULER)
const STAR_OF = (g, c = cfgNow()) => LEMD.STARS[DIR[g].star[c]];
const starFrom = (g, c) => { const pts = STAR_OF(g, c).pts.map(p => p[0]); return pts.slice(Math.max(0, pts.indexOf(DIR[g].entry[c]))); };
// the STAR holds (FAFEQ, RUDBI, RILKO, LULER) and the missed approach hold (ROFIX)
for (const [id, h] of Object.entries(LEMD.HOLDS_AIR)) WP[id].hold = { inb: Math.round(h.inb), min: h.min, left: h.turn === 'L' };
// where the simulator picks each arrival up, and at what level: the STAR's published altitude there (or the next one)
const starAltAt = (g, c) => { const pts = STAR_OF(g, c).pts, i = Math.max(0, pts.findIndex(p => p[0] === DIR[g].entry[c])); const a = pts.slice(i).find(p => p[1]); return a ? a[1] : 13000; };
const ENTRY = {}, ENTRY_ALT = {}, PRE_ALT = {}, HOLD_AT = {};
for (const g of GATES) {
  Object.defineProperty(ENTRY, g, { enumerable: true, get: () => WP[DIR[g].entry[cfgNow()]].p });
  Object.defineProperty(ENTRY_ALT, g, { enumerable: true, get: () => Math.max(11000, starAltAt(g, cfgNow())) });
  Object.defineProperty(PRE_ALT, g, { enumerable: true, get: () => ENTRY_ALT[g] + 12000 });
  Object.defineProperty(HOLD_AT, g, { enumerable: true, get: () => { const p = STAR_OF(g).pts; return p[p.length - 1][0]; } });
}

// ── ILS approaches: the localiser from 3 NM outside the intermediate fix, the 3° glidepath from the platform altitude.
// The approach controller's "four miles" check: an arrival not visual (below the CAT I minima) goes around there.
const FINAL = {};
for (const [rw, I] of Object.entries(LEMD.ILS)) {
  const thr = THR[rw], out = norm(crsOf(rw) + 180), dIF = dist(...thr, ...WP[I.ifx].p), elev = THR_ELEV[rw], low = Math.round((elev + 1000)/100)*100;
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
// ── from the STAR end to the intermediate fix: the published RNAV1 initial approach segment of the ILS Z for the
// runway on the arrival's side of the airport. Both runways of a flow give an arrival the same route (its own side's).
const routeFor = (g, c) => { const star = starFrom(g, c), rw = CFG[c].land[gateSide(g)], I = LEMD.ILS[rw], seg = I.from[star[star.length - 1]] || [];
  return [...star, ...seg.map(p => p[0]), I.ifx]; };
const ARR_ROUTE = Object.fromEntries(GATES.map(g => [g, Object.fromEntries(['32L', '32R', '36L', '36R', '18R', '18L', '14R', '14L'].map(rw => [rw, routeFor(g, configOf(rw))]))]));
// the altitudes cleared arrivals descend with: the flow's STARs, then the initial segments and intermediate fixes
const ARR_ALT = Object.fromEntries(['north', 'south'].map(c => {
  const m = arrAltOf(GATES.map(g => STAR_OF(g, c)));
  for (const rw of landRwys(c)) { const I = LEMD.ILS[rw]; for (const seg of Object.values(I.from)) for (const [id, a] of seg) if (m[id] == null) m[id] = a; if (m[I.ifx] == null) m[I.ifx] = I.ifAlt; }
  return [c, m];
}));

// ── departures: an RNAV1 SID from each runway for each direction (day SIDs), flown from 500 ft to 13,000 ft
const sidName = (gate, rwy) => {
  const fam = (DIR[gate] || DIR.NE).sid, c = configOf(rwy || S.rwy), rw = depRwysOf(c).includes(rwy) ? rwy : CFG[c].dep[gateSide(gate)];
  return Object.keys(LEMD.SIDS).find(n => LEMD.SIDS[n].rwy === rw && n.startsWith(fam)) || Object.keys(LEMD.SIDS).find(n => LEMD.SIDS[n].rwy === rw);
};
const sidSpoken = n => (LEMD.SIDS[n] || {}).spoken || n;
const sidTopOf = n => Math.max(...((LEMD.SIDS[n] || {}).pts || [[0, 13000]]).map(p => p[1] || 0));
const exitRoute = (g, rwy) => LEMD.SIDS[sidName(g, rwy)].pts.map(p => p[0]);
const EXIT_ROUTE = {}, EXIT_FIX = {};
for (const g of GATES) {
  Object.defineProperty(EXIT_ROUTE, g, { enumerable: true, get: () => exitRoute(g, depRw()) });
  Object.defineProperty(EXIT_FIX, g, { enumerable: true, get: () => { const r = exitRoute(g, depRw()); return r[r.length - 1]; } });
}
const NEXT_UNIT = Object.fromEntries(GATES.map(g => [g, LEMD.CTR[DIR[g].ctr]]));
const relUnit = ac => 'Madrid Control';
const TEL = LEMD.TEL;
const isMil = ac => false;
const gateFor = ap => LEMD.PLACE_DIR[ap] || 'NE';

// ═════════════════════════ schedule ═════════════════════════
const withGate = x => ({ ...x, gate: x.gate || gateFor(x.k === 'ARR' ? x.o : x.d) });
const TIMETABLE = LEMD.TIMETABLE;
const REGS = { C56X: 'EC-MDX', PC12: 'EC-NPC' };
const LONG_STAY = LEMD.LONG_STAY;
const EXTRA = LEMD.EXTRA.map(withGate);
const EXERCISES = Object.fromEntries(Object.entries(LEMD.EXERCISES).map(([k, e]) => ['l' + k, { ...e, sched: e.sched.map(withGate) }]));
const WX_PRESETS = LEMD.WX_PRESETS;

// ═════════════════════════ weather rules ═════════════════════════
// summer thunderstorms and gusty winter north-westerlies off the Sierra de Guadarrama bring windshear on short final
const TURB_TABLE = {};
function turbExcess(w){
  if (w.vrb || w.spd < 15) return 0;
  return Math.max(0, Math.max(w.spd, (w.gust || 0)*0.85) - 25);
}
// ILS CAT I: 200 ft and RVR 550 m
const minsOk = (w, rw) => w.vis >= 550 && w.ceil >= 200;
const sraMinsOk = w => minsOk(w, '32L');
// the flow (AD 2.20.6): north preferred; south when the tailwind on 32 reaches 7 kt (or the crosswind 20 kt) and the
// south flow is better
function rwyFor(w){
  if (w.vrb || w.spd < 5) return { land: '32L', dep: '36L' };
  const n = windComp(w, crsOf('32L')), s = windComp(w, crsOf('18R'));
  const nOk = n.headG > -7 && Math.abs(n.crossG) < 20;
  return nOk || s.head <= n.head ? { land: '32L', dep: '36L' } : { land: '18R', dep: '14R' };
}
const depFor = rw => CFG[configOf(rw)].dep.west;
// the Sierra de Guadarrama, north-west of the airport: peaks to 2,428 m (Peñalara, 7,966 ft); approximate outline
const GUADARRAMA = [[40.55, -4.45], [40.72, -4.20], [40.84, -3.92], [40.98, -3.72], [41.15, -3.48], [41.20, -3.56], [41.02, -3.82], [40.90, -4.02], [40.78, -4.28], [40.62, -4.55]].map(LL);

// ═════════════════════════ engine hooks ═════════════════════════
// the terminal an airline uses (Iberia, Iberia Express, Air Nostrum and Vueling at T-4; the oneworld long-haul partners at
// T-4S; everyone else at T-1, T-2 and T-3); Terminals 4 and 4S spill over into each other when full
const termOf = ac => LEMD.TERMINAL_OF[ac.cs.slice(0, 3)] || '123';
function standAt(ac, t){
  const free = STANDS.filter(s => !s.occ && s.term === t);
  return free[Math.floor(Math.random()*Math.min(free.length, 6))] || null;
}
const flowText = c => `land ${landRwys(c).join(' and ')}, depart ${depRwysOf(c).join(' and ')}`;
const APT = {
  get arrAlt(){ return ARR_ALT[cfgNow()]; },   // the flow's STAR and initial approach altitudes
  icao: 'LEMD', name: 'Madrid-Barajas', coordName: 'Barajas', radarName: 'MAD', utcOff: 2,
  radar: [LEMD.UNITS.app.name, LEMD.UNITS.app.freq], depRadar: [LEMD.UNITS.dep.name, LEMD.UNITS.dep.freq.west],
  // Barajas Tower has a frequency for each runway pair: the one for the flow's west landing runway
  get tower(){ return [LEMD.UNITS.twr.name, LEMD.UNITS.twr.freq[S.rwy] || LEMD.UNITS.twr.freq['32L']]; },
  gnd: [LEMD.UNITS.gnd.name, LEMD.UNITS.gnd.freq],
  runways: RWY_LIST, rwyHalfWidth: 30,
  ihps: G.ihps.map(([id, node]) => ({ id, node })),
  xing: false, drawnTown: false, ta: LEMD.TA, initClimb: 13000, gaAlt: 5000, appAlt: 5000, handoffNM: 15, climbFL: 200, divertAlt: 10000,
  area: { dep: 50, arr: 100, div: 50 }, roll: [70, RWY_M - 70], defRwy: '32L', defWx: 'north',
  appName: 'ILS approach', appShort: 'ILS', minsText: 'weather below the ILS minima', reqApp: rw => 'ILS approach',
  minsLong: 'Weather is below the ILS CAT I minima (200 ft and RVR 550 m).',
  liveName: 'Madrid-Barajas', liveThin: 24, atisFreq: LEMD.UNITS.atis.freq, turbName: 'Madrid',
  sessionHours: Array.from({ length: 18 }, (_, i) => i + 4),   // 0400Z to 2100Z: 06:00 to 23:00 in Madrid
  view: { app: [0, 0, 90], twr: [0, 0, 3.6], gnd: [mOf(EN(-250, 2000)), offOf(EN(-250, 2000)), 5200, 6400] },
  minsOk,
  // the two flows: S.rwy is the flow's west landing runway; every aircraft gets its own runway
  splitRwy: true, rwyFor, depFor, configOf,
  rwyConfigs: ['north', 'south'].map(c => ({ key: c, name: CFG[c].name, land: CFG[c].land.west, lands: landRwys(c), deps: depRwysOf(c) })),
  depRwyOf, landRwyOf,
  activeRwys: () => [...landRwys(), ...depRwysOf()],
  depRwys: () => depRwysOf(),
  appRwys: () => landRwys(),
  // independent parallel approaches (two arrivals cleared to the two runways of a pair, on the published initial segments,
  // 1,000 ft apart at their intermediate fixes, or on the localisers), and departures off the two departure runways close
  // in, on diverging SIDs
  sepOk: (a, b, d) => (a.kind === 'ARR' && b.kind === 'ARR' && a.app && b.app && parallelOf(a.app) === b.app && Math.max(dist(a.x, a.y, ...ARP), dist(b.x, b.y, ...ARP)) < 22)
    || (a.kind === 'DEP' && b.kind === 'DEP' && a.depRwy && b.depRwy && a.depRwy !== b.depRwy && dist(a.x, a.y, ...ARP) < 8 && dist(b.x, b.y, ...ARP) < 8),
  // the SID of the aircraft's own runway
  exitRouteOf: ac => exitRoute(ac.gate, ac.depRwy || depRw(ac)),
  // the day SIDs are pre-coordinated with Madrid Control: no individual departure releases
  needRel: ac => false,
  sidAlt: ac => sidTopOf(ac.sid),
  // stands: the airline's terminal. Remote and cargo stands only for long turnarounds (towed in)
  remoteAreas: ['remote'],
  areaNames: { civil: 'terminal stands', remote: 'remote and cargo stands' },
  termName: t => (TERM_NAME[t] || 'Terminal ' + t).replace(/^./, c => c.toUpperCase()),
  remoteWord: s => s.term === 'C' ? 'cargo stand' : 'remote stand',
  prefArea: ac => { const t = termOf(ac); return { key: t, name: TERM_NAME[t], has: s => s.term === t }; },
  standFor: ac => { const t = termOf(ac); return standAt(ac, t) || (t === '4' || t === '4S' ? standAt(ac, t === '4' ? '4S' : '4') : null); },
  // first descent: the STAR hold's level; across the Sierra de Guadarrama (from the north and north-west) no lower than 10,000 ft
  inboundAlt: g => g === 'N' || g === 'NW' ? (configOf(S.rwy) === 'north' ? 10000 : 11000) : configOf(S.rwy) === 'north' ? (gateSide(g) === 'west' ? 7000 : 8000) : (gateSide(g) === 'west' ? 11000 : 8000),
  divertTo: ac => gateSide(ac.gate) === 'east' ? ['Valencia', 'VILLA'] : ['Seville', 'SOTUK'],
  firstAlt: g => ENTRY_ALT[g] - 2000,
  rolledCall: 'request taxi',
  vacExits: ac => { const rw = ac.app || landRw(ac), R = RWYS_BY_END(rw), m = R.mOf([ac.x, ac.y]), dir = rw === R.lo ? 1 : -1;
    return exitsFor(rw).filter(k => (HOLDS[k].m - m)*dir > 30 && Math.sign(HOLDS[k].off) === R.side).slice(0, 4); },
  vacPrefs: (st, ac) => exitsFor(ac && (ac.app || landRw(ac)) || S.rwy),
  exitFor,
  lineUpWords: hp => 'line up and wait',
  terrain: { name: 'the Sierra de Guadarrama', poly: GUADARRAMA, min: 9000, low: 8000, msg: ac => `${ac.cs} is over the Sierra de Guadarrama at ${Math.round(ac.alt)} ft (peaks to 7,966 ft)${ac.alt < 8000 ? ', TERRAIN' : ''}.` },
  restricted: null,
  drawAirport: drawLemd,
  gaEarly(ac, rw){},
  // missed approach: climb straight ahead, then turn (32: left, 18: right) direct ROFIX and hold at 5,000 or 6,000 ft
  gaTurn(ac){ const rw = ac.gaRwy, F = FINAL[rw] || FINAL['32L']; if (ac.alt > ELEV + 1500 || dist(ac.x, ac.y, ...(THR[rw] || ARP)) > 3) { ac.gaTurn = true; ac.mode = 'NAV'; ac.route = F.missed.slice(); ac.turnDir = (LEMD.ILS[rw] || {}).turn || 0; ac.tgtAlt = ac.cleared = Math.max(ac.cleared || 0, F.missAlt); } },
  // RNAV SIDs: straight ahead on the runway track, then the route from 500 ft
  liftoff(ac){ ac.tgtHdg = Math.round(crsOf(ac.depRwy)); ac.turnDir = 0; },
  depTurn(ac){ if (!ac.turned && ac.alt >= ELEV + 500) ac.turned = true; },
  depClear: ac => !!ac.turned,
  shear(ac, rw, w){ return (w.cb && Math.random() < 0.15) || (turbExcess(w) > 4 && Math.random() < 0.2) ? 'windshear on short final' : null; },
  shearWhy: rw => S.wx.cb ? 'microburst alert on final' : 'windshear on short final',
  faceHold: (st, f) => depHold({ stand: st, leftStand: false, x: st.p[0], y: st.p[1] }),
  faceWord: f => f,
  // the departure-end holding points of the aircraft's runway nearest it, then the other departure runway's
  taxiHolds: (south, ac) => { const rw = ac ? depRw(ac) : depRw(), p = ac ? (ac.stand && !ac.leftStand ? ac.stand.lp : [ac.x, ac.y]) : ARP;
    const near = ks => ks.sort((a, b) => dist(...p, ...GN[HOLDS[a].node].p) - dist(...p, ...GN[HOLDS[b].node].p));
    const other = depRwysOf().find(r => r !== rw), rec = ac && depHold(ac);
    return [...new Set([rec, ...near(endHolds(rw)).slice(0, 2), ...near(endHolds(other)).slice(0, 1)].filter(Boolean))].slice(0, 4); },
  taxiHint: rw => ({ '36L': 'Runway 36L departures enter at Zulu 1 to Zulu 4 at the south end (Terminals 1-2-3 and 4).',
    '36R': 'Runway 36R departures enter at Yankee 1 to Yankee 3 at the south end (Terminal 4S).',
    '14L': 'Runway 14L departures enter at Kilo 1 to Kilo 3 at the north-west end.',
    '14R': 'Runway 14R departures enter at Lima Alfa to Lima Echo at the north-west end.' })[rw] + ' The crew lines up straight onto the runway; the other departure runway is listed too.',
  // medical diversions: flights crossing central Spain at cruise
  diverts: [{ cs: 'TAP1352', t: 'A20N', o: 'LPPT', gate: 'W', to: 'Barcelona' }, { cs: 'DLH1132', t: 'A321', o: 'EDDF', gate: 'NE', to: 'Málaga' },
    { cs: 'RAM970', t: 'B738', o: 'GMMN', gate: 'S', to: 'Paris' }, { cs: 'AFR1946', t: 'A320', o: 'LFPG', gate: 'N', to: 'Seville' }],
  airports: LEMD.AIRPORTS, via: {},
  airlineIcao: LEMD.AIRLINE_ICAO, airlineType: LEMD.AIRLINE_TYPE, defType: 'A320',
  placeIcao: LEMD.PLACES,
  // ICAO phraseology from the engine, with Barajas's own: the SID's stop altitude in the clearance, start-up and push
  // from one position (Madrid Clearances, the apron service and Barajas Ground combined)
  phr: {
    push: (ac, dn, face) => { const top = sidTopOf(ac.sid);
      return [`cleared to ${dn} via ${sidSpoken(ac.sid)} departure, runway ${depRw(ac)}, climb ${altWords(top)}, squawk ${ac.sqk}, start-up and push back approved, facing ${APT.faceWord(face)}, QNH ${S.wx.qnh}`,
        `cleared ${dn}, ${sidSpoken(ac.sid)}, runway ${depRw(ac)}, altitude ${altShort(top)}, squawk ${ac.sqk}, start and push approved facing ${APT.faceWord(face)}, QNH ${S.wx.qnh}`]; },
    startReq: ac => `${LEMD.UNITS.gnd.name}, stand ${ac.stand.id}, ${ac.perf.name} to ${AP[ac.d] ? AP[ac.d][2] : ac.d}, information ${phonetic(S.atis)}, request start-up and push back`,
    checkIn: ac => { const star = DIR[ac.gate] && DIR[ac.gate].star[cfgNow()];
      return `${APT.radar[0]}, ${greet()}, ${altShort(Math.round(ac.alt/100)*100)} descending ${altShort(ac.tgtAlt)}, ${star ? star.replace(/(\d)([A-Z])$/, ' $1 $2') + ' arrival' : 'inbound ' + ac.route[0]}, information ${phonetic(S.atis)}`; },
    vacated: ac => `${LEMD.UNITS.gnd.name}, runway ${rwyName(ac.rwyId)} vacated via ${PHON[ac.exit] || ac.exit.replace(/~\d+$/, '')}, request taxi${ac.stand ? ' to stand ' + ac.stand.id : ''}`,
    taxiIn: (ac, st, vw) => { const k = xingAhead(ac), hs = k >= 0 ? `, hold short runway ${rwyName(ac.path.pts[k].hs)}` : '', via = vw.length ? ' via ' + vw.map(t => PHON[t] || t).join(', ') : '';
      return [`taxi to stand ${st.id}${via}${hs}`, `stand ${st.id}${via}${hs}`]; },
    taxiHold: (ac, h, vw) => { const via = vw.length ? ' via ' + vw.map(t => PHON[t] || t).join(', ') : '', r = h.rwy ? rwyName(HOLDS[h.id].on) : null, at = hpWords(h.id);
      return r ? [`taxi to holding point ${at}${via}, hold short runway ${r}`, `holding point ${at}${via}, holding short ${r}`] : [`taxi to holding point ${at}${via}`, `holding point ${at}${via}`]; },
    atHoldPt: (ac, h) => h.rwy ? `holding short runway ${rwyName(HOLDS[h.id].on)} at ${hpWords(h.id)}` : `holding at ${hpWords(h.id)}`
  },
  atisPanel(w){
    const c = cfgNow(), cw = Math.max(...landRwys(c).map(r => Math.abs(windComp(w, crsOf(r)).crossG))), bad = !minsOk(w, S.rwy), r = rwyFor(w);
    return `<div class="warnline${bad ? ' bad' : ''}">${CFG[c].name} flow: ${flowText(c)}${configOf(r.land) !== c ? ` (wind favours the ${CFG[configOf(r.land)].name.toLowerCase()} flow)` : ''} · ${bad ? 'below the ILS minima' : 'parallel ILS approaches'} · crosswind ${Math.round(cw)} kt. Arrivals from the west land on ${CFG[c].land.west}, from the east on ${CFG[c].land.east}; departures leave from the runway nearer their stand.</div>`;
  },
  atisLines({ w, L, E, wind, vis, cloud }){
    const c = cfgNow();
    const out = [
      `This is Madrid Barajas information ${L}, time ${zt(S.t).slice(0,5).replace(':', '')}.`,
      `${CFG[c].name} configuration. Expect ILS approach runways ${landRwys(c).join(' and ')}. Departure runways ${depRwysOf(c).join(' and ')}.`,
      `Surface wind ${wind}. Visibility ${vis}. ${cloud}.`,
      `Temperature ${w.temp}, dew point ${w.dew}. QNH ${w.qnh} hectopascals. Transition level ${w.qnh < 1013 ? 140 : 130}.`
    ];
    out.push('Independent parallel approaches in progress.');
    if (turbExcess(w) > 0 || w.cb) out.push('Windshear and moderate turbulence reported on final.');
    if (E && E.ws) out.push(`Windshear reported on final runway ${E.ws.rw} at ${zt(E.ws.t).slice(0,5).replace(':', '')}, ${E.ws.text}.`);
    if (E && E.rwyBlock) out.push(`Runway ${S.rwy} closed: ${E.rwyBlock.why}. Expect delays.`);
    if (!minsOk(w, S.rwy)) out.push(`Visibility below the ILS minima. Expect holding at ${c === 'north' ? 'FAFEQ or RUDBI' : 'RILKO or LULER'}.`);
    out.push('Runway 18R/36L is crossed between Terminals 4 and 4S: hold short unless cleared to cross.');
    out.push(`Acknowledge receipt of information ${L} and advise aircraft type and stand on first contact.`);
    return out;
  },
  // the website: home hero, previews, scenario cards and Academy figures
  site: {
    hero: () => [
      ['IBE3162', 40.30, -3.40, 323, 170, PAL.light.arr], ['AEA1012', 40.33, -3.33, 323, 180, PAL.light.arr], ['VLG1002', 40.10, -3.30, 30, 230, PAL.light.arr],
      ['IBE3402', 40.58, -3.57, 360, 210, PAL.light.dep], ['RYR5412', 40.60, -3.52, 10, 220, PAL.light.dep],
      ['IBE6251', 41.00, -4.00, 300, 440, 'rgba(60,75,95,.7)'], ['DLH1110', 41.20, -3.10, 220, 430, 'rgba(60,75,95,.7)'], ['TAP1012', 40.20, -4.40, 80, 420, 'rgba(60,75,95,.7)']
    ],
    demo(mk, park){
      const fin = add(THR['32L'], norm(CRS['32L'] + 180), 2.6), fin2 = add(THR['32R'], norm(CRS['32R'] + 180), 4.2), out = add(THR['36L'], CRS['36L'], 4.5), inb = add(WP.FAFEQ.p, 200, 6);
      const hk = endHolds('36R')[0], hp = GN[HOLDS[hk].node].p;
      return [
        mk('IBE3402', 'A321', 'DEP', park('332', { need: null, reqAt: 99999 })), mk('IBE6251', 'A359', 'DEP', park('340', { need: null, reqAt: 99999 })),
        mk('RYR5412', 'B738', 'DEP', park('20', { need: null, reqAt: 99999 })), mk('QTR150', 'B77W', 'DEP', park(STANDS.find(s => s.term === '4S').id, { need: null, reqAt: 99999 })),
        mk('AAL37', 'B772', 'DEP', { ground: true, state: 'HOLDPT', hp: hk, x: hp[0], y: hp[1], hdg: CRS['36R'], gs: 0 }),
        mk('IBE3162', 'A321', 'ARR', { state: 'FINAL', mode: 'FINAL', app: '32L', freq: 'TWR', x: fin[0], y: fin[1], hdg: CRS['32L'], alt: ELEV + 830, gs: 145, vs: -750, o: 'EGLL' }),
        mk('AEA1012', 'B738', 'ARR', { state: 'FINAL', mode: 'FINAL', app: '32R', freq: 'TWR', x: fin2[0], y: fin2[1], hdg: CRS['32R'], alt: ELEV + 1330, gs: 150, vs: -750, o: 'LEPA' }),
        mk('VLG1003', 'A320', 'DEP', { state: 'CLIMB', x: out[0], y: out[1], hdg: 360, alt: ELEV + 3000, gs: 210, vs: 2000, tgtAlt: 13000, d: 'LEBL' }),
        mk('IBS3832', 'A21N', 'ARR', { state: 'INBOUND', x: inb[0], y: inb[1], hdg: 20, alt: 9000, gs: 250, vs: -1000, tgtAlt: 7000, o: 'GCXO' })
      ];
    },
    thumb(k, zoom, W){
      if (k === 'app') return v => { v.scale *= 1.3; };
      if (k === 'twr') { const c = EN(-300, 1500); return v => { v.cx = c[0]; v.cy = c[1]; v.scale = W/4.2; }; }
      const c = zoom === 'apron' ? STANDS.find(s => s.id === '332').p : EN(-300, 1800);
      return v => { v.cx = c[0]; v.cy = c[1]; v.scale = W/((zoom === 'apron' ? 800 : 5200)*M2NM); };
    },
    figHold: 'FAFEQ', emergHp: 'Z2',
    figConsole: v => { v.scale *= 1.2; },
    cmdHint: 'Command, e.g. IBE3162 APP 32L · IBE3402 TAXI Z2 · VLG1002 CROSS · / to focus, Tab cycles flights'
  }
};
// maintenance hangars (OpenStreetMap): Iberia's La Muñoza base east of 14L/32R, Globalia (Air Europa) to the south, and
// the hangars by Terminal 4. Aircraft stored there at the start of a session are towed to a stand at their airline's
// terminal an hour before departure. The door is the nearest taxilane node.
APT.hangars = [[2249, -1184, 'n1010', 'Iberia La Muñoza hangar'], [2216, -884, 'n1011', 'La Muñoza hangar 2'], [2365, -1328, 'n1010', 'La Muñoza hangar 3'],
  [137, -1644, 'n940', 'Globalia hangar'], [-1302, 659, 'n279', 'T-4 hangar 1'], [-1442, 869, 'n989', 'T-4 hangar 2'], [-1118, 403, 'n278', 'T-4 hangar 3']]
  .filter(([, , node]) => GN[node])
  .map(([e, n, node, name], i) => ({ id: 'H' + (i + 1), name, in: inF0(e, n), door: [GN[node].m, GN[node].off], node, to: ['civil'], fits: ac => true, pick: ac => APT.standFor(ac) }));
