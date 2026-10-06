// ═════════════════════════ London Gatwick (EGKK) airport profile for the engine ═════════════════════════
// Builds every global the engine reads from the chart data in egkk.js (EGKK) and the OpenStreetMap aerodrome in
// egkk-ground.js (metres east and north of the ARP). Gatwick has one runway, 08R/26L, used in mixed mode: arrivals and
// departures share it. It is described like New York's runways (APT.runways with one frame, holding points with their
// runway-edge nodes and mapped fillets), so the big-airport taxi routing, holding-position stops and lead-on lines apply.
// 08L/26R is not a runway any more: its pavement is drawn as taxiway J and nothing lands or departs on it.
Object.assign(TYPES, EGKK.TYPES);
const LL = p => xy(p[0], p[1]);
const G = EGKK_GROUND;
const EN = (e, n) => [e*M2NM, n*M2NM];                     // metres east and north of the ARP (the map origin) → NM

// ═════════════════════════ runway ═════════════════════════
// a frame along the runway: m from the west pavement end (08R end), off to the left (north)
function rwyFrame(r){
  const a = EN(...r.a), b = EN(...r.b), L = dist(...a, ...b), RU = [(b[0]-a[0])/L, (b[1]-a[1])/L], RN = [-RU[1], RU[0]];
  const rm = (m, off=0) => [a[0] + (RU[0]*m + RN[0]*off)*M2NM, a[1] + (RU[1]*m + RN[1]*off)*M2NM];
  const mOf = p => ((p[0]-a[0])*RU[0] + (p[1]-a[1])*RU[1])/M2NM, offOf = p => ((p[0]-a[0])*RN[0] + (p[1]-a[1])*RN[1])/M2NM;
  const len = r.len;
  // no turning pads: departures enter at the runway ends (J1/H1/G1 for 08R; A1, B1 or M1 on the 26L starter
  // extension) and line up straight; arrivals always have a rapid exit ahead
  const TURN_W = [[30, 0]], TURN_E = [[len - 30, 0]];
  return { id: r.id, lo: r.lo, hi: r.hi, len, thr: r.thr, elev: r.elev, rm, mOf, offOf, RU, TURN_W, TURN_E, TURN_END: { W: 30, E: len - 30 },
    roll: [70, len - 70], ends: true, width: 45 };
}
const RWY_LIST = [rwyFrame(G.runways[0])];
const R0 = RWY_LIST[0];
const rm = R0.rm, mOf = R0.mOf, offOf = R0.offOf, RU = R0.RU;
const RWY_M = R0.len, THR_LO_M = R0.thr['08R'], THR_HI_M = R0.thr['26L'];
const RW_LO = '08R', RW_HI = '26L';
const THR = { '08R': rm(THR_LO_M, 0), '26L': rm(THR_HI_M, 0) };
const CRS = { '08R': brg(...rm(0), ...rm(RWY_M)) }; CRS['26L'] = norm(CRS['08R'] + 180);
const THR_ELEV = { ...R0.elev };
const T_LO = THR[RW_LO], T_HI = THR[RW_HI], CRS_LO = CRS[RW_LO], CRS_HI = CRS[RW_HI];
const crsOf = rw => CRS[rw] ?? CRS_HI;
const ELEV = EGKK.elev;
const ARP = LL(EGKK.arp);
// no road crossing, no border fence, no rock
const XING_M = -1e9, XING_SKEW = 0, XING_HW = 0, xingM = o => XING_M;
const FRONTIER = [], R164 = [], ROCK = [], ROCK_TOP = [0, 0];
const TURN_W = R0.TURN_W, TURN_E = R0.TURN_E, TURN_END = R0.TURN_END, TURN_PAD = {};

// ═════════════════════════ taxiways, holding points, stands (egkk-ground.js) ═════════════════════════
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
// stands: South Terminal (1-38), North Terminal (41-68, 551-574, 681-690), remote stands between the terminals and the
// runway (41-43 and 130-180: towed to a terminal for the turnaround), the west apron (230-235, business aviation)
const AREA_OF = { N: 'civil', S: 'civil', R: 'remote', W: 'north' };
const STANDS = G.gates.map(([id, term, [e, n], node]) => { const p = EN(e, n); return { id, term, p, m: mOf(p), off: offOf(p), node, area: AREA_OF[term], occ: null }; });
STANDS.forEach(s => { s.lp = GN[s.node].p; s.hdg = brg(...s.lp, ...s.p); });
const APRONS = G.aprons.map(r => r.map(([e, n]) => inF0(e, n)));
R0.side = 1;                                               // the terminals and every exit used are north of the runway
const TERM_NAME = { N: 'North Terminal', S: 'South Terminal', R: 'remote stands', W: 'west apron' };

// taxiway names: letters spoken one by one (FR "Foxtrot Romeo"), digits as numbers; holding points without the ~n suffix
const NATO = { A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike',
  N: 'November', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', Y: 'Yankee', Z: 'Zulu' };
const twyWords = t => t.replace(/~\d+$/, '').match(/[A-Z]|\d+/g).map(x => NATO[x] || x).join(' ');
const PHON = {};
for (const e of GE) if (e.tw && e.tw !== 'APRON' && !PHON[e.tw]) PHON[e.tw] = twyWords(e.tw);
for (const k of Object.keys(HOLDS)) PHON[k] = twyWords(k);
for (const [id] of G.ihps) PHON[id] = twyWords(id);
PHON.APRON = 'the apron';

// departure entries: the holding points at the departure end of the runway, nearest first from where the aircraft is
const endHolds = rw => Object.keys(HOLDS).filter(k => HOLDS[k].end === rw);
const routeLen = (from, to) => { const r = route(from, to); return r ? pathLen(r.nodes) : Infinity; };
function depHold(ac){
  const rw = depRw(), from = ac.stand && !ac.leftStand ? ac.stand.node : nearestNode([ac.x, ac.y], n => !/^R/.test(n.id)).id;
  const ks = endHolds(rw); let best = ks[0], bl = Infinity;
  for (const k of ks) { const L = routeLen(from, HOLDS[k].node); if (L < bl) { bl = L; best = k; } }
  return best;
}
// nose-in stands: the tug pushes the tail back onto the taxilane, then 40 m along it the way the tail points
function laneDir(st, face){
  const tail = face === 'east' ? 270 : 90, lp = st.lp;
  let best = null, bd = 999;
  for (const [v] of GN[st.node].adj) { const d = Math.abs(angDiff(brg(...lp, ...GN[v].p), tail)); if (d < bd) { bd = d; best = v; } }
  return best ? brg(...lp, ...GN[best].p) : tail;
}
function pushPath(ac, face){ const st = ac.stand; return [st.lp, add(st.lp, laneDir(st, face), 40*M2NM)]; }
// face the way the route to the runway starts
function pushRec(ac){
  const st = ac.stand, r = route(st.node, HOLDS[depHold(ac)].node);
  if (!r || r.nodes.length < 2) return 'east';
  return Math.sin(brg(...st.lp, ...GN[r.nodes[1]].p)*D2R) >= 0 ? 'east' : 'west';
}
// exits for the landing runway: those the roll-out direction can turn into, on the terminal side, in the order met
// (26L: Echo Romeo then Foxtrot Romeo, the rapid exits; 08R: Delta, then Charlie)
const RWYS_BY_END = rw => R0;
function exitsFor(rw){
  const R = R0, up = rw === R.lo, thr = R.thr[rw];
  const ks = Object.keys(HOLDS).filter(k => { const H = HOLDS[k]; return H.dirs.includes(rw) && (up ? H.m > thr + 700 : H.m < thr - 700); });
  const near = ks.filter(k => Math.sign(HOLDS[k].off) === R.side), far = ks.filter(k => Math.sign(HOLDS[k].off) !== R.side);
  const order = a => a.sort((x, y) => (HOLDS[x].m - HOLDS[y].m)*(up ? 1 : -1));
  return [...order(near), ...order(far)];
}
// a name the controller says ("VAC FR") to the exit of that taxiway, ahead of the aircraft
function exitFor(ac, name){
  if (HOLDS[name]) return name;
  const rw = ac.app || S.rwy, R = R0, m = R.mOf([ac.x, ac.y]), dir = rw === R.lo ? 1 : -1;
  const ks = Object.keys(HOLDS).filter(k => (HOLDS[k].ref === name || HOLDS[k].tw === name) && (HOLDS[k].m - m)*dir > 20);
  return ks.sort((a, b) => (Math.sign(HOLDS[b].off) === R.side) - (Math.sign(HOLDS[a].off) === R.side) || (HOLDS[a].m - HOLDS[b].m)*dir)[0] || null;
}

// ═════════════════════════ aerodrome drawing ═════════════════════════
const AD_SITE = { aprons: APRONS, roads: [], buildings: [], twyExtra: [], shoulder: [0, RWY_M], serviceRoad: false, paag: [], floods: [], twyLabels: [], hotspots: [], labels: [] };
// hot spots (AD 2-EGKK-2-1): HS1 the Foxtrot Romeo rapid exit, HS2 taxiway Echo, HS3 the Delta rapid exit, HS4 taxiway
// Juliett by Quebec (potential routing error)
const nodeWith = (a, b) => { const n = Object.values(GN).find(n => n.adj.some(([, e]) => e.tw === a) && n.adj.some(([, e]) => e.tw === b)); return n ? n.p : null; };
const HOTSPOTS = [['HS1', HOLDS.FR && GN[HOLDS.FR.node].p], ['HS2', HOLDS.ER && GN[HOLDS.ER.node].p], ['HS3', HOLDS.D1 && GN[HOLDS.D1.node].p], ['HS4', nodeWith('J', 'Q')]].filter(([, p]) => p);
const TERM_LABELS = (() => { const by = {}; for (const s of STANDS) if (s.term === 'N' || s.term === 'S') (by[s.term] ||= []).push(s.p); return Object.entries(by).map(([t, ps]) => [TERM_NAME[t].toUpperCase(), ps.reduce((a, p) => [a[0] + p[0]/ps.length, a[1] + p[1]/ps.length], [0, 0])]); })();
// the old 08L/26R: 45 m of pavement north of the runway, now part of taxiway J
const OLD_RWY = G.oldRwy.map(([e, n]) => EN(e, n));
function drawEgkk(){
  const sc = V.scale, mpx = sc/1852, IMG = mapImagery();
  const P2 = p => [sx(p[0]), sy(p[1])];
  const pathP = (pts, close = true) => { cx.beginPath(); pts.forEach((p, i) => cx[i ? 'lineTo' : 'moveTo'](...P2(p))); if (close) cx.closePath(); };
  const lw = m => Math.max(1, m*mpx);
  const R = R0, rwyPoly = w => [R.rm(0, -w/2), R.rm(R.len, -w/2), R.rm(R.len, w/2), R.rm(0, w/2)];
  if (sc <= 70) { cx.fillStyle = rgba('rwyOut', .9); pathP(rwyPoly(Math.max(R.width, 2.2/mpx))); cx.fill(); return; }
  cx.lineJoin = 'round'; cx.lineCap = 'round';
  // aprons, then the old runway and the taxiways (every graph edge), then the runway on top
  cx.fillStyle = C.concrete; for (const a of APRONS) { pathP(a.map(([m, o]) => rm(m, o))); cx.fill(); }
  cx.strokeStyle = C.concrete; cx.lineWidth = lw(60);
  for (const e of GE) { if (e.tw !== 'APRON') continue; pathP([GN[e.a].p, GN[e.b].p], false); cx.stroke(); }
  cx.lineWidth = lw(44); for (const s of STANDS) { pathP([s.lp, s.p], false); cx.stroke(); }
  cx.strokeStyle = C.asphalt; cx.lineCap = 'butt'; cx.lineWidth = lw(45); pathP(OLD_RWY, false); cx.stroke(); cx.lineCap = 'round';
  cx.lineWidth = lw(23);
  for (const e of GE) { if (e.tw === 'APRON') continue; pathP([GN[e.a].p, GN[e.b].p], false); cx.stroke(); }
  for (const k in FIL) { pathP(FIL[k].W.map(([m, o]) => R.rm(m, o)), false); cx.stroke(); }
  cx.fillStyle = C.rwy; pathP(rwyPoly(R.width)); cx.fill();
  if (!IMG) { cx.fillStyle = C.bld; cx.strokeStyle = C.bldEdge; cx.lineWidth = 1; for (const b of G.buildings) { pathP(b.pts.map(([e, n]) => EN(e, n))); cx.fill(); cx.stroke(); } }
  if (sc > 150) {
    cx.fillStyle = C.paint; cx.strokeStyle = C.paint;
    const hw = R.width/2 - 1.5, quad = (m1, o1, m2, o2) => { pathP([R.rm(m1, o1), R.rm(m2, o1), R.rm(m2, o2), R.rm(m1, o2)]); cx.fill(); };
    cx.lineWidth = lw(0.9); pathP([R.rm(0, hw), R.rm(R.len, hw)], false); cx.stroke(); pathP([R.rm(0, -hw), R.rm(R.len, -hw)], false); cx.stroke();
    cx.setLineDash([30*mpx, 20*mpx]); pathP([R.rm(R.thr[R.lo] + 100, 0), R.rm(R.thr[R.hi] - 100, 0)], false); cx.stroke(); cx.setLineDash([]);
    // ICAO Annex 14 / CAP 168: threshold stripes (12 on a 45 m runway), aiming point at 400 m, touchdown zone bars in
    // threes, twos and ones to 900 m, arrows and a transverse bar before the displaced 26L threshold
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
    cx.strokeStyle = C.yellow; cx.lineWidth = lw(0.35);
    { const seen = new Set(); for (const k in FIL) { const f = FIL[k].W, key = JSON.stringify(f); if (seen.has(key)) continue; seen.add(key);
      strokeSmooth(leadLine(f).map(p => P2(R.rm(...p)))); } }
    // taxiway centrelines, stopping at the runway edges
    for (const e of GE) { pathP([GN[e.a].p, GN[e.b].p], false); cx.stroke(); }
    // runway holding positions (pattern A): two solid and two dashed lines across the taxiway, parallel to the runway
    for (const [id, rid] of Object.entries(G.hs)) {
      const n = GN[id]; if (!n) continue; const m = R.mOf(n.p), o = R.offOf(n.p), s = Math.sign(o);
      for (const [d, dash] of [[0.9, false], [0.3, false], [-0.3, true], [-0.9, true]]) { cx.setLineDash(dash ? [mpx + 1, mpx + 1] : []); pathP([R.rm(m - 11, o + s*d), R.rm(m + 11, o + s*d)], false); cx.stroke(); }
      cx.setLineDash([]);
    }
    // stand lead-in lines and numbers
    cx.lineWidth = lw(0.3);
    for (const s of STANDS) { pathP([s.lp, s.p], false); cx.stroke(); }
    if (sc > 600) { cx.fillStyle = rgba('lab', .8); cx.font = `600 ${Math.max(9, 4*mpx)}px ${FONT_L}`; for (const s of STANDS) { const [X, Y] = P2(s.p); cx.fillText(s.id, X + 3, Y - 3); } }
    drawGroundSigns();
    cx.font = `600 11px ${FONT_L}`;
    for (const [t, p] of HOTSPOTS) { const [X, Y] = P2(p); cx.strokeStyle = rgba('hot', .85); cx.lineWidth = 1.2; cx.beginPath(); cx.arc(X, Y, 45*mpx + 6, 0, 7); cx.stroke(); cx.fillStyle = rgba('hot', .95); cx.fillText(t, X + 45*mpx + 8, Y + 4); }
  }
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
const STAR_FIXES = new Set(Object.values(EGKK.STARS).flatMap(s => s.pts.map(p => p[0])));
for (const [id, p] of Object.entries(EGKK.FIX)) if (!EGKK.NAV[id]) wp(id, p[0], p[1], STAR_FIXES.has(id) || /^(ABIBI|OLEVI|IMVUR|NOVMA|FRANE|ODVIK|WIZAD|HARDY|BOGNA|DAGGA)$/.test(id) ? {} : { minor: true });
for (const [id, n] of Object.entries(EGKK.NAV)) wp(id, ...n.p, { note: `${n.name} ${n.freq}` });
const RADAR_REF = ARP;
const GATES = Object.keys(EGKK.DIR);
const STAR_OF = g => EGKK.STARS[EGKK.DIR[g].star];
const starFrom = g => { const pts = STAR_OF(g).pts.map(p => p[0]); return pts.slice(pts.indexOf(EGKK.DIR[g].entry)); };
// the STAR holds (7-15, 7-16)
for (const [id, h] of Object.entries(EGKK.HOLDS_AIR)) WP[id].hold = { inb: Math.round(h.inb), min: h.min, left: h.turn === 'L' };
const ENTRY = Object.fromEntries(GATES.map(g => [g, WP[EGKK.DIR[g].entry].p]));
const ENTRY_ALT = { N: 10000, W: 12000, NE: 14000, E: 12000, SE: 13000, S: 14000, SW: 14000, CI: 13000 };
const PRE_ALT = { N: 21000, W: 23000, NE: 25000, E: 25000, SE: 27000, S: 27000, SW: 27000, CI: 23000 };

// ── ILS approaches: the localiser from 3 NM outside the intermediate fix, the 3° glidepath from 3,000 ft. The approach
// controller's "four miles" check: an arrival not visual (below the CAT I minima) goes around there.
const FINAL = {};
for (const [rw, I] of Object.entries(EGKK.ILS)) {
  const thr = THR[rw], out = norm(crsOf(rw) + 180), dIF = dist(...thr, ...WP[I.ifx].p), elev = THR_ELEV[rw];
  const F = { pts: [add(thr, out, dIF + 3), add(thr, out, dIF), thr], alts: [I.ifAlt, I.ifAlt, elev + 50], elev, entry: I.ifx, entryName: I.ifx, name: 'ILS ' + rw, alt: I.ifAlt,
    decName: 'four miles', decNM: 4, decMin: 2.6, minAlt: 1250, minText: '1,250 ft',
    mins: { vis: 550, ceil: 200 }, minRate: 300, missed: [I.missed[0]], missAlt: I.missed[1],
    phrase: r => `cleared ILS approach runway ${r}`, read: r => `cleared ILS ${r}`,
    decCall: r => `${APT.tower[0]}, four miles, ILS runway ${r}`, decNeed: 'Four miles, needs landing clearance', decFail: 'not visual at the decision altitude' };
  F.cum = new Array(F.pts.length).fill(0); for (let i = F.pts.length - 2; i >= 0; i--) F.cum[i] = F.cum[i+1] + dist(...F.pts[i], ...F.pts[i+1]);
  const meet = (I.ifAlt - elev - 50)/318;                    // 3° = 318 ft per NM
  F.prof = [[0, elev + 50], [meet, I.ifAlt], [F.cum[0] + 1, I.ifAlt]];
  FINAL[rw] = F;
}

// ── from the STAR hold to the intermediate fix: a downwind and base laid out beside the final (hidden points, the
// vectors Gatwick Director gives), so an arrival with no instructions still gets there
const FEED_ALT = {};
function feeder(rw, from){
  const I = EGKK.ILS[rw], thr = THR[rw], out = norm(crsOf(rw) + 180), dIF = dist(...thr, ...WP[I.ifx].p);
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
const ARR_ROUTE = Object.fromEntries(GATES.map(g => [g, Object.fromEntries(['08R', '26L'].map(rw => {
  const star = starFrom(g);
  return [rw, [...star, ...feeder(rw, star[star.length - 1])]];
}))]));
const HOLD_AT = Object.fromEntries(GATES.map(g => [g, STAR_OF(g).pts[STAR_OF(g).pts.length - 1][0]]));

// ── departures: an RNAV1 SID for every direction and runway, flown from 500 ft
const sidName = (gate, rwy) => EGKK.DIR[gate].sid[rwy] || EGKK.DIR[gate].sid['26L'];
const sidSpoken = n => (EGKK.SIDS[n] || {}).spoken || n;
const sidTopOf = n => Math.max(...((EGKK.SIDS[n] || {}).pts || [[0, 6000]]).map(p => p[1] || 0));
const exitRoute = (g, rwy) => EGKK.SIDS[sidName(g, rwy)].pts.map(p => p[0]);
const EXIT_ROUTE = {}, EXIT_FIX = {};
for (const g of GATES) {
  Object.defineProperty(EXIT_ROUTE, g, { enumerable: true, get: () => exitRoute(g, depRw()) });
  Object.defineProperty(EXIT_FIX, g, { enumerable: true, get: () => { const r = exitRoute(g, depRw()); return r[r.length - 1]; } });
}
const NEXT_UNIT = Object.fromEntries(GATES.map(g => [g, EGKK.CTR[EGKK.DIR[g].ctr]]));
const relUnit = ac => 'London';
const TEL = EGKK.TEL;
const isMil = ac => false;
const gateFor = ap => EGKK.PLACE_DIR[ap] || 'S';

// ═════════════════════════ schedule ═════════════════════════
const withGate = x => ({ ...x, gate: x.gate || gateFor(x.k === 'ARR' ? x.o : x.d) });
const TIMETABLE = EGKK.TIMETABLE;
const REGS = { C56X: 'G-LGWX', PC12: 'G-KKPC' };
const LONG_STAY = EGKK.LONG_STAY;
const EXTRA = EGKK.EXTRA.map(withGate);
const EXERCISES = Object.fromEntries(Object.entries(EGKK.EXERCISES).map(([k, e]) => ['g' + k, { ...e, sched: e.sched.map(withGate) }]));
const WX_PRESETS = EGKK.WX_PRESETS;

// ═════════════════════════ weather rules ═════════════════════════
// strong south-westerlies over the Weald bring turbulence and windshear on short final for 26L
const TURB_TABLE = {};
function turbExcess(w){
  if (w.vrb || w.spd < 15) return 0;
  return Math.max(0, Math.max(w.spd, (w.gust || 0)*0.85) - 25);
}
// ILS CAT I: 200 ft and RVR 550 m
const minsOk = (w, rw) => w.vis >= 550 && w.ceil >= 200;
const sraMinsOk = w => minsOk(w, '26L');

// ═════════════════════════ engine hooks ═════════════════════════
// the terminal an airline uses; easyJet spills over to the other terminal when its own is full
const termOf = ac => EGKK.TERMINAL_OF[ac.cs.slice(0, 3)] || (isBiz(ac) ? 'W' : 'S');
function standAt(ac, t){
  const free = STANDS.filter(s => !s.occ && s.term === t);
  return free[Math.floor(Math.random()*Math.min(free.length, 6))] || null;
}
const APT = {
  arrAlt: { ...arrAltOf(GATES.map(STAR_OF)), ...FEED_ALT },   // STAR levels, then the downwind and base
  icao: 'EGKK', name: 'London Gatwick', coordName: 'Gatwick', radarName: 'LGW', utcOff: 1,
  radar: [EGKK.UNITS.app.name, EGKK.UNITS.app.freq], depRadar: ['London Control', '134.125'],
  tower: [EGKK.UNITS.twr.name, EGKK.UNITS.twr.freq],
  runways: RWY_LIST, bigGround: true, rwyHalfWidth: 23,
  ihps: G.ihps.map(([id, node]) => ({ id, node })),
  xing: false, drawnTown: false, ta: EGKK.TA, initClimb: 6000, gaAlt: 3000, appAlt: 3000, handoffNM: 12, climbFL: 150, divertAlt: 7000,
  area: { dep: 45, arr: 100, div: 45 }, roll: [70, RWY_M - 70], defRwy: '26L', defWx: 'west',
  appName: 'ILS approach', appShort: 'ILS', minsText: 'weather below the ILS minima', reqApp: rw => 'ILS approach',
  minsLong: 'Weather is below the ILS CAT I minima (200 ft and RVR 550 m).',
  liveName: 'Gatwick Airport', liveThin: 22, atisFreq: EGKK.UNITS.atis.freq, turbName: 'Gatwick',
  sessionHours: Array.from({ length: 17 }, (_, i) => i + 5),   // 0500Z to 2100Z: 06:00 to 22:00 in London
  view: { app: [0, 0, 80], twr: [0, 0.25, 2.4], gnd: [mOf(EN(450, 650)), offOf(EN(450, 650)), 3600, 1500] },
  minsOk,
  // Gatwick's SIDs are pre-coordinated with London Control: no individual departure releases
  needRel: ac => false,
  sidAlt: ac => sidTopOf(ac.sid),
  // stands: the airline's terminal; business jets on the west apron. Remote stands only for long turnarounds (towed in)
  remoteAreas: ['remote'],
  areaNames: { civil: 'terminal stands', remote: 'remote stands', north: 'west apron' },
  termName: t => TERM_NAME[t] || 'Terminal ' + t,
  prefArea: ac => { const t = termOf(ac); return { key: t, name: TERM_NAME[t], has: s => s.term === t }; },
  standFor: ac => { const t = termOf(ac); return standAt(ac, t) || (t === 'N' || t === 'S' ? standAt(ac, t === 'N' ? 'S' : 'N') : null); },
  inboundAlt: gate => 7000,
  divertTo: ac => ['N', 'NE', 'E', 'W'].includes(ac.gate) ? ['Stansted', 'LAM'] : ['Bournemouth', 'GWC'],
  firstAlt: g => ENTRY_ALT[g] - 2000,
  rolledCall: 'request taxi',
  vacExits: ac => { const R = R0, rw = ac.app || S.rwy, m = R.mOf([ac.x, ac.y]), dir = rw === R.lo ? 1 : -1;
    return exitsFor(rw).filter(k => (HOLDS[k].m - m)*dir > 30 && Math.sign(HOLDS[k].off) === R.side).slice(0, 4); },
  vacPrefs: (st, ac) => exitsFor(ac && ac.app || S.rwy),
  exitFor,
  lineUpWords: hp => 'line up and wait',
  terrain: null,
  restricted: null,
  drawAirport: drawEgkk,
  gaEarly(ac, rw){},
  // missed approach: climb straight ahead to 3,000 ft; at 2,000 ft turn (08R right, 26L left) for Mayfield and hold
  gaTurn(ac){ const rw = ac.gaRwy, F = FINAL[rw] || FINAL['26L']; if (ac.alt > ELEV + 1800 || dist(ac.x, ac.y, ...THR[rw]) > 3) { ac.gaTurn = true; ac.mode = 'NAV'; ac.route = F.missed.slice(); ac.turnDir = EGKK.ILS[rw].turn; } },
  // RNAV SIDs: straight ahead on the runway track, then the route from 500 ft
  liftoff(ac){ ac.tgtHdg = Math.round(crsOf(ac.depRwy)); ac.turnDir = 0; },
  depTurn(ac){ if (!ac.turned && ac.alt >= ELEV + 500) ac.turned = true; },
  depClear: ac => !!ac.turned,
  shear(ac, rw, w){ return turbExcess(w) > 4 && Math.random() < 0.2 ? 'windshear on short final' : null; },
  shearWhy: rw => 'windshear on short final',
  faceHold: (st, f) => depHold({ stand: st, leftStand: false, x: st.p[0], y: st.p[1] }),
  faceWord: f => f,
  // the three departure-end holding points nearest the aircraft
  taxiHolds: (south, ac) => { const ks = endHolds(depRw()), p = ac ? (ac.stand && !ac.leftStand ? ac.stand.lp : [ac.x, ac.y]) : ARP;
    const rec = ac && depHold(ac); return [...new Set([rec, ...ks.sort((a, b) => dist(...p, ...GN[HOLDS[a].node].p) - dist(...p, ...GN[HOLDS[b].node].p))].filter(Boolean))].slice(0, 3); },
  taxiHint: rw => rw === '26L' ? 'Runway 26L departures enter at Alfa 1, Bravo 1 or Mike 1 (the starter extension) and line up straight.' : 'Runway 08R departures enter at Juliett 1, Hotel 1 or Golf 1 at the west end and line up straight.',
  // medical diversions: flights crossing the London TMA
  diverts: [{ cs: 'DLH4CW', t: 'A20N', o: 'EDDF', gate: 'E', to: 'Dublin' }, { cs: 'KLM1009', t: 'B738', o: 'EHAM', gate: 'NE', to: 'Bristol' },
    { cs: 'IBE3171', t: 'A21N', o: 'LEMD', gate: 'SW', to: 'Manchester' }, { cs: 'AFR1146', t: 'A320', o: 'LFPG', gate: 'S', to: 'Edinburgh' }],
  airports: EGKK.AIRPORTS, via: {},
  airlineIcao: EGKK.AIRLINE_ICAO, airlineType: EGKK.AIRLINE_TYPE, defType: 'A320',
  placeIcao: EGKK.PLACES,
  // UK phraseology (CAP 413) from the engine, with Gatwick's own: the SID's stop altitude in the clearance, start-up and
  // push from Gatwick Ground
  phr: {
    push: (ac, dn, face) => { const top = sidTopOf(ac.sid);
      return [`cleared to ${dn} via ${sidSpoken(ac.sid)} departure, climb ${altWords(top)}, squawk ${ac.sqk}, start-up and push back approved, facing ${APT.faceWord(face)}, QNH ${S.wx.qnh}`,
        `cleared ${dn}, ${sidSpoken(ac.sid)}, altitude ${altShort(top)}, squawk ${ac.sqk}, start and push approved facing ${APT.faceWord(face)}, QNH ${S.wx.qnh}`]; },
    startReq: ac => `${EGKK.UNITS.gnd.name}, stand ${ac.stand.id}, ${ac.perf.name} to ${AP[ac.d] ? AP[ac.d][2] : ac.d}, information ${phonetic(S.atis)}, request start-up and push back`
  },
  atisPanel(w){
    const c = windComp(w, crsOf(S.rwy)), bad = !minsOk(w, S.rwy);
    return `<div class="warnline${bad ? ' bad' : ''}">Runway ${S.rwy}, mixed mode · ${bad ? 'below the ILS minima' : 'ILS approaches'} · crosswind ${Math.round(Math.abs(c.crossG))} kt. One runway for every arrival and departure: space the arrivals to fit departures between them.</div>`;
  },
  atisLines({ w, L, E, wind, vis, cloud }){
    const out = [
      `This is Gatwick information ${L}, time ${zt(S.t).slice(0,5).replace(':', '')}.`,
      `Runway in use ${S.rwy}. ILS approach runway ${S.rwy}.`,
      `Surface wind ${wind}. Visibility ${vis}. ${cloud}.`,
      `Temperature ${w.temp}, dew point ${w.dew}. QNH ${w.qnh} hectopascals.`
    ];
    if (turbExcess(w) > 0) out.push('Moderate turbulence and windshear reported on final.');
    if (E && E.ws) out.push(`Windshear reported on final runway ${E.ws.rw} at ${zt(E.ws.t).slice(0,5).replace(':', '')}, ${E.ws.text}.`);
    if (E && E.rwyBlock) out.push(`Runway ${S.rwy} closed: ${E.rwyBlock.why}. Expect delays.`);
    if (!minsOk(w, S.rwy)) out.push('Visibility below the ILS minima. Expect holding at TIMBA or WILLO.');
    out.push('Hot spots at the Foxtrot Romeo and Delta rapid exits, taxiway Echo, and taxiway Juliett by Quebec.');
    out.push(`Acknowledge receipt of information ${L} and advise aircraft type and stand on first contact.`);
    return out;
  },
  // the website: home hero, previews, scenario cards and Academy figures
  site: {
    hero: () => [
      ['EZY8202', 51.00, 0.30, 300, 230, PAL.light.arr], ['BAW2642', 50.98, -0.20, 70, 220, PAL.light.arr], ['TOM4249', 51.20, 0.22, 256, 170, PAL.light.arr],
      ['EZY8292', 51.12, -0.38, 256, 200, PAL.light.dep], ['VLG7827', 51.05, -0.42, 160, 240, PAL.light.dep],
      ['BAW15', 51.40, -0.60, 270, 430, 'rgba(60,75,95,.7)'], ['RYR8AB', 50.80, 0.40, 40, 420, 'rgba(60,75,95,.7)'], ['DLH9WN', 51.55, 0.30, 110, 430, 'rgba(60,75,95,.7)']
    ],
    demo(mk, park){
      const fin = add(THR['26L'], CRS['08R'], 2.6), out = add(THR['26L'], CRS['26L'], 4 + RWY_M*M2NM), inb = add(WP.TIMBA.p, 120, 5);
      const hp = GN[HOLDS[endHolds('26L')[0]].node].p;
      return [
        mk('EZY8203', 'A20N', 'DEP', park('553', { need: null, reqAt: 99999 })), mk('BAW2662', 'A320', 'DEP', park('555', { need: null, reqAt: 99999 })),
        mk('VLG7827', 'A320', 'DEP', park('24', { need: null, reqAt: 99999 })), mk('UAE16', 'A388', 'DEP', park('561', { need: null, reqAt: 99999 })),
        mk('EZY8492', 'A320', 'DEP', { ground: true, state: 'HOLDPT', hp: endHolds('26L')[0], x: hp[0], y: hp[1], hdg: CRS['26L'], gs: 0 }),
        mk('TOM4249', 'B38M', 'ARR', { state: 'FINAL', mode: 'FINAL', app: '26L', freq: 'TWR', x: fin[0], y: fin[1], hdg: CRS['26L'], alt: 1000, gs: 145, vs: -750, o: 'LGRP' }),
        mk('EZY8292', 'A319', 'DEP', { state: 'CLIMB', x: out[0], y: out[1], hdg: 256, alt: 3200, gs: 210, vs: 2000, tgtAlt: 6000, d: 'LIMC' }),
        mk('BAW2642', 'A320', 'ARR', { state: 'INBOUND', x: inb[0], y: inb[1], hdg: 300, alt: 8000, gs: 250, vs: -1000, tgtAlt: 7000, o: 'LEMG' })
      ];
    },
    thumb(k, zoom, W){
      if (k === 'app') return v => { v.scale *= 1.3; };
      if (k === 'twr') { const c = rm(RWY_M*0.55, 300); return v => { v.cx = c[0]; v.cy = c[1]; v.scale = W/2.4; }; }
      const c = zoom === 'apron' ? STANDS.find(s => s.id === '553').p : rm(RWY_M*0.6, 450);
      return v => { v.cx = c[0]; v.cy = c[1]; v.scale = W/((zoom === 'apron' ? 700 : 2600)*M2NM); };
    },
    figHold: 'TIMBA', emergHp: 'A1',
    figConsole: v => { v.scale *= 1.2; },
    cmdHint: 'Command, e.g. BAW2642 H260 A40 · EZY8203 TAXI A1 · / to focus, Tab cycles flights'
  }
};
// maintenance hangars (OpenStreetMap: Hangars 7, 9 and 11 on the north side): aircraft stored there at the start of a
// session are towed to a stand at their airline's terminal an hour before departure. The door is the nearest taxilane node.
APT.hangars = [[-653, 530, 'n302', 'Hangar 11'], [-61, 651, 'n48', 'Hangar 7'], [299, 981, 's151', 'Hangar 9']]
  .filter(([, , node]) => GN[node])
  .map(([e, n, node, name], i) => ({ id: 'H' + (i + 1), name, in: inF0(e, n), door: [GN[node].m, GN[node].off], node, to: ['civil'], fits: ac => ac.perf.wake !== 'H', pick: ac => APT.standFor(ac) }));
