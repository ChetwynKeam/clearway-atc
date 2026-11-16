// ═════════════════════════ Edinburgh (EGPH) airport profile for the engine ═════════════════════════
// Builds every global the engine reads from the chart data in egph.js (EGPH) and the aerodrome in egph-ground.js
// (OpenStreetMap checked against the AIP charts, metres east and north of the ARP). Edinburgh has one runway, 06/24, for
// arrivals and departures alike. It is described like Bristol's and Gatwick's (APT.runways with one frame, holding points
// with their runway-edge nodes and mapped fillets), so the big-airport taxi routing, holding-position stops and lead-on
// lines apply. Taxiway A runs the length of the runway on its south side, from A1 at the 06 end to D1 at the 24 end, with
// B and C between; the terminal, the pier and the aprons are south of A.
Object.assign(TYPES, EGPH.TYPES);
const LL = p => xy(p[0], p[1]);
const G = EGPH_GROUND;
const EN = (e, n) => [e*M2NM, n*M2NM];                     // metres east and north of the ARP (the map origin) → NM

// ═════════════════════════ runway ═════════════════════════
// a frame along the runway: m from the west pavement end (09 end), off to the left (north)
function rwyFrame(r){
  const a = EN(...r.a), b = EN(...r.b), L = dist(...a, ...b), RU = [(b[0]-a[0])/L, (b[1]-a[1])/L], RN = [-RU[1], RU[0]];
  const rm = (m, off=0) => [a[0] + (RU[0]*m + RN[0]*off)*M2NM, a[1] + (RU[1]*m + RN[1]*off)*M2NM];
  const mOf = p => ((p[0]-a[0])*RU[0] + (p[1]-a[1])*RU[1])/M2NM, offOf = p => ((p[0]-a[0])*RN[0] + (p[1]-a[1])*RN[1])/M2NM;
  const len = r.len;
  // no turning pads: departures enter at the pavement ends (A1 for 06, D1 for 24, both before the inset thresholds: the
  // whole pavement is take-off run) and line up straight
  const TURN_W = [[30, 0]], TURN_E = [[len - 30, 0]];
  return { id: r.id, lo: r.lo, hi: r.hi, len, thr: r.thr, elev: r.elev, rm, mOf, offOf, RU, TURN_W, TURN_E, TURN_END: { W: 30, E: len - 30 },
    roll: [70, len - 70], ends: true, width: 45 };
}
const RWY_LIST = [rwyFrame(G.runways[0])];
const R0 = RWY_LIST[0];
const rm = R0.rm, mOf = R0.mOf, offOf = R0.offOf, RU = R0.RU;
const RWY_M = R0.len, THR_LO_M = R0.thr['06'], THR_HI_M = R0.thr['24'];
const RW_LO = '06', RW_HI = '24';
const THR = { '06': rm(THR_LO_M, 0), '24': rm(THR_HI_M, 0) };
const CRS = { '06': brg(...rm(0), ...rm(RWY_M)) }; CRS['24'] = norm(CRS['06'] + 180);
const THR_ELEV = { ...R0.elev };
const T_LO = THR[RW_LO], T_HI = THR[RW_HI], CRS_LO = CRS[RW_LO], CRS_HI = CRS[RW_HI];
const crsOf = rw => CRS[rw] ?? CRS_HI;
const ELEV = EGPH.elev;
const ARP = LL(EGPH.arp);
// no road crossing, no border fence, no rock
const XING_M = -1e9, XING_SKEW = 0, XING_HW = 0, xingM = o => XING_M;
const FRONTIER = [], R164 = [], ROCK = [], ROCK_TOP = [0, 0];
const TURN_W = R0.TURN_W, TURN_E = R0.TURN_E, TURN_END = R0.TURN_END, TURN_PAD = {};

// ═════════════════════════ taxiways, holding points, stands (egph-ground.js) ═════════════════════════
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
for (const [k, H] of Object.entries(HOLDS)) {
  if (HOLD_AXIS[H.node] || !GN[H.node]) continue;
  const p = GN[H.node].p, hl = G.hlink[k] || [], q = hl.length ? rm(...hl[hl.length - 1]) : GN[H.rwy].p, L = dist(...p, ...q) || 1;
  HOLD_AXIS[H.node] = [(q[0] - p[0])/L, (q[1] - p[1])/L];
}
// stands (AD 2-EGPH-2-2): every one nose-in, pushed back (AD 2.20 item 2); the stop mark at the stand table's coordinates.
// T the terminal's contact stands (1-14), P the pier (15-19), S the Southeast Apron (20-33), R the Main Apron's west side
// (99-106), N the North Apron (200-208), E the East Apron by the Cargo Centre (210-212), M the Midfield Apron (403-407), H
// the Turnhouse Apron (308-317A), B the two stands by the Business Aviation Centre (46A, 46B) and G the GA Apron's two
// marshalled spots (GA1, GA2), which the aircraft leave forwards: turned nose out on the apron, no push (AD 2.20 item 2).
const STANDS = G.gates.map(([id, term, [e, n], node, hdg, line, out]) => { const p = EN(e, n);
  return { id, term, p, m: mOf(p), off: offOf(p), node, area: 'civil', occ: null, noLead: !line, h0: hdg, line: line ? line.map(([e, n]) => EN(e, n)) : null,
    ...(G.span[id] ? { maxSpan: G.span[id] } : {}), ...(out ? { out: { node: out[0], pts: out[1].map(([e, n]) => EN(e, n)) } } : {}) }; });
STANDS.forEach(s => { s.lp = GN[s.node].p; s.hdg = s.h0 ?? brg(...s.lp, ...s.p); });
// the stands that overlap (the chart's large stands over their narrowbody neighbours: 4A, 15, 16, 21, 23; the Turnhouse
// Apron's L/R positions; 100 between 99 and 101): never both in use at once
for (const [c, h] of Object.entries(G.vac)) { const s = STANDS.find(x => x.id === c); if (!s) continue; s.vacant = [...(s.vacant || []), ...h];
  for (const id of h) { const o = STANDS.find(x => x.id === id); if (o) o.vacant = [...(o.vacant || []), c]; } }
const _vac = (a, b) => (a.vacant || []).includes(b.id);
// the stop mark is where the nose stops: the stand's point is the aircraft's middle (as at Heathrow, Madrid and Manchester)
standsNoseToMiddle({ same: _vac });
// shared graph repairs (core): lanes that stop just short of each other joined, junction fillets the paint has but the
// centreline lacks, corner links past kinks, and slightly-too-sharp corners chamfered
joinGaps(); tFillets({ R: 30 }); kinkLinks(); smoothKinks();
const APRONS = G.aprons.map(r => r.map(([e, n]) => inF0(e, n)));
R0.side = -1;                                              // taxiway A, the terminal and the aprons are south of the runway
const TERM_NAME = { T: 'Terminal', P: 'Pier', S: 'Southeast Apron', R: 'Main Apron west', N: 'North Apron', E: 'East Apron', M: 'Midfield Apron', H: 'Turnhouse Apron', B: 'Business Aviation', G: 'GA Apron' };

// taxiway names: letters spoken (A "Alfa"), digits as numbers (A15 "Alfa 15"); holding points without the ~n suffix
const NATO = { A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike',
  N: 'November', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu' };
const twyWords = t => t.replace(/~\d+$/, '').match(/[A-Z]|\d+/g).map(x => NATO[x] || x).join(' ');
const PHON = {};
for (const e of GE) if (e.tw && e.tw !== 'APRON' && !PHON[e.tw]) PHON[e.tw] = twyWords(e.tw);
for (const k of Object.keys(HOLDS)) PHON[k] = twyWords(k);
for (const [id] of G.ihps) PHON[id] = twyWords(id);
const IHP_NODE = Object.fromEntries(G.ihps.map(([id, node]) => [id, node]));
PHON.APRON = 'the apron';

// departure entries (AD 2.13, 2.20): A1 at the 06 end and D1 at the 24 end (full length), and the intersections the AIP
// declares: B1 for 06 (TORA 1,891 m) and C1 for 24 (1,891 m). Not from B or C in low visibility procedures, and a heavy
// needs the full length. The AI and the push-back advice use the full length; the controller can give an intersection.
const endHolds = rw => Object.keys(HOLDS).filter(k => HOLDS[k].end === rw);
const INTX = { '06': 'B1', '24': 'C1' };
const intxRun = (k, rw) => { const m = R0.mOf(GN[HOLDS[k].rwy].p); return rw === R0.lo ? R0.len - m : m; };
// the entry whose fillet turns the aircraft towards the departure end (the one a landing the other way would leave by)
const intxWay = (k, rw) => { const f = FIL[k].W, a = f[f.length-1], b = f[0], dm = b[0] - a[0], L = Math.hypot(dm, b[1] - a[1]); return !L || dm*(rw === R0.lo ? 1 : -1)/L >= -0.17; };
const intxHolds = rw => (S.lvpOn ? [] : Object.keys(HOLDS).filter(k => HOLDS[k].ref === INTX[rw] && intxWay(k, rw)));
const depHolds = rw => [...endHolds(rw), ...intxHolds(rw)];
const depHoldAs = (ac, hp) => { const rw = depRw(ac), ok = depHolds(rw); if (!HOLDS[hp] || ok.includes(hp)) return hp;
  return ok.find(k => HOLDS[k].ref === HOLDS[hp].ref) || hp; };
const routeLen = (from, to) => { const r = route(from, to); return r ? pathLen(r.nodes) : Infinity; };
function depHold(ac){ return endHolds(depRw(ac))[0]; }
// exits for the landing runway, in the order met (24: C, B, A1 at the end; 06: B, C, D1 at the end). The standard taxi
// routes (AD 2.20 item 6) take each to taxiway A. Code E and F aircraft vacate at the end only (A1 or D1), unless led by
// a follow-me. An exit 600 m or more past the threshold is usable.
const RWYS_BY_END = rw => R0;
function exitsFor(rw, ac){
  const R = R0, up = rw === R.lo, thr = R.thr[rw], big = ac && (ac.perf.wake === 'H' || ac.perf.wake === 'J');
  const ks = Object.keys(HOLDS).filter(k => { const H = HOLDS[k]; return H.dirs.includes(rw) && (up ? H.m > thr + 600 : H.m < thr - 600) && (!big || H.end); });
  return ks.sort((x, y) => (HOLDS[x].m - HOLDS[y].m)*(up ? 1 : -1));
}
// a name the controller says ("VAC C") to the exit of that taxiway, ahead of the aircraft
function exitFor(ac, name){
  const rw = ac.app || S.rwy, R = R0, m = R.mOf([ac.x, ac.y]), dir = rw === R.lo ? 1 : -1;
  if (HOLDS[name] && HOLDS[name].dirs.includes(rw)) return name;
  const ks = Object.keys(HOLDS).filter(k => (HOLDS[k].ref === name || HOLDS[k].ref === name + '1' || HOLDS[k].tw === name) && HOLDS[k].dirs.includes(rw) && (HOLDS[k].m - m)*dir > 20);
  return ks.sort((a, b) => (HOLDS[a].m - HOLDS[b].m)*dir)[0] || null;
}

// ═════════════════════════ aerodrome drawing ═════════════════════════
// taxiways 23 m (A, L, the A1-A8 and A16-D1 parts of A: AD 2.8); G, H, E, F and S 36 m, M up to 46 m for the Code E
const AD_SITE = { pave: { w: 23 }, aprons: APRONS, roads: [], buildings: [], twyExtra: [], shoulder: [0, RWY_M], serviceRoad: false, paag: [], floods: [], twyLabels: [], hotspots: [], labels: [] };
// hot spot HS1 (AD 2-EGPH-2-1): A15 to A17, where C, L and M meet taxiway A in a few hundred metres; mis-routes
const HOTSPOTS = [['HS1', (() => { const ps = ['A16', 'L1', 'M1', 'C3', 'A15'].map(k => (IHP_NODE[k] && GN[IHP_NODE[k]] || {}).p).filter(Boolean);
  return ps.reduce((a, p) => [a[0] + p[0]/ps.length, a[1] + p[1]/ps.length], [0, 0]); })()]];
const TERM_LABELS = (() => { const by = {}; for (const s of STANDS) (by[s.term] ||= []).push(s.p); return Object.entries(by).map(([t, ps]) => [TERM_NAME[t].toUpperCase(), ps.reduce((a, p) => [a[0] + p[0]/ps.length, a[1] + p[1]/ps.length], [0, 0])]); })();
function drawEgph(){
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
    const lines = GE.filter(e => e.tw !== 'APRON').map(e => ({ pts: [P2(GN[e.a].p), P2(GN[e.b].p)], w: paveWidth(e.tw) }));
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
    // ICAO Annex 14 / CAP 168: threshold stripes (12 on a 45 m runway), aiming point at 400 m, touchdown zone bars in
    // threes, twos and ones to 900 m, arrows and a transverse bar before the displaced 27 threshold
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
    { const seen = new Set(), leads = []; for (const k in FIL) { const f = FIL[k].W, key = JSON.stringify(f); if (seen.has(key)) continue; seen.add(key);
      leads.push(leadLine(f).map(p => P2(R.rm(...p)))); }
      groundLines(lw(0.35), () => leads.forEach(strokeSmooth)); }
    // taxiway centrelines, stopping at the runway edges
    paintEdgeLines(lw(0.35));
    // runway holding positions (pattern A): two solid lines on the taxiway side and two dashed on the runway side, across
    // the taxiway (GX is on G where it runs alongside the runway, so it isn't simply parallel to it)
    cx.strokeStyle = C.yellow;
    for (const [id, [u, v]] of Object.entries(HOLD_AXIS)) {
      const n = GN[id]; if (!n) continue; const at = (a, b) => [n.p[0] + (v*a + u*b)*M2NM, n.p[1] + (-u*a + v*b)*M2NM];   // a across, b along
      for (const [d, dash] of [[-0.9, false], [-0.3, false], [0.3, true], [0.9, true]]) { cx.setLineDash(dash ? [mpx + 1, mpx + 1] : []); pathP([at(-11, d), at(11, d)], false); cx.stroke(); }
      cx.setLineDash([]);
    }
    // stand lead-in lines and numbers
    groundLines(lw(0.3), () => { for (const s of STANDS) if (!s.noLead) { pathP(s.line || [s.lp, s.p], false); cx.stroke(); } });
    cx.save(); if (IMG) clipOut(G.buildings.map(b => b.pts.map(([e, n]) => P2(EN(e, n))))); drawStandDetail(null, null, mpx, false); cx.restore();   // stand paint stops at the terminal walls
    drawGroundSigns();
    cx.font = `600 11px ${FONT_L}`;
    for (const [t, p] of HOTSPOTS) { const [X, Y] = P2(p); cx.strokeStyle = rgba('hot', .85); cx.lineWidth = 1.2; cx.beginPath(); cx.arc(X, Y, 45*mpx + 6, 0, 7); cx.stroke(); cx.fillStyle = rgba('hot', .95); cx.fillText(t, X + 45*mpx + 8, Y + 4); }
  }
}
// lights and terminal names: drawn every frame over the airfield layer (in the dark theme the lights add their glow to
// what is under them, so they can't go in the layer)
function drawEgphTop(){
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
const STAR_FIXES = new Set(Object.values(EGPH.STARS).flatMap(s => s.pts.map(p => p[0])));
for (const [id, p] of Object.entries(EGPH.FIX)) if (!EGPH.NAV[id]) wp(id, p[0], p[1], STAR_FIXES.has(id) || /^(GOSAM|CUMBO|MAVIX)$/.test(id) ? {} : { minor: true });
for (const [id, n] of Object.entries(EGPH.NAV)) wp(id, ...n.p, { note: `${n.name} ${n.freq}` });
// the SIDs' turn points. I-VG D3 and D7 (zero-ranged to the 06 threshold) on track 042° after the early left turn at
// 635 ft, which is about where the runway ends; I-TH D7 (zero at the 24 threshold) on the extended centreline past UW;
// where TALLA 6D's track 142° from I-VG D7 meets TLA radial 022; and the beacon radial points
const T042 = 42 + EGPH.RWY.var, T142 = 142 + EGPH.RWY.var;
const alongTo = (p0, b, from, D) => { const u = [Math.sin(b*D2R), Math.cos(b*D2R)], w = [p0[0] - from[0], p0[1] - from[1]], k = w[0]*u[0] + w[1]*u[1], c = w[0]*w[0] + w[1]*w[1] - D*D;
  const t = -k + Math.sqrt(Math.max(0, k*k - c)); return [p0[0] + u[0]*t, p0[1] + u[1]*t]; };
WP.VG3 = { id: 'VG3', p: alongTo(rm(RWY_M), T042, THR['06'], 3), hide: true, note: 'I-VG D3' };
WP.VG7 = { id: 'VG7', p: alongTo(rm(RWY_M), T042, THR['06'], 7), hide: true, note: 'I-VG D7' };
WP.TH7 = { id: 'TH7', p: add(THR['24'], CRS['24'], 7), hide: true, note: 'I-TH D7' };
{ const a = WP.VG7.p, u = [Math.sin(T142*D2R), Math.cos(T142*D2R)], c = WP.TLA.p, v = [Math.sin((22 + EGPH.RWY.var)*D2R), Math.cos((22 + EGPH.RWY.var)*D2R)];
  const den = u[0]*v[1] - u[1]*v[0], t = ((c[0] - a[0])*v[1] - (c[1] - a[1])*v[0])/den;
  WP.TLA022 = { id: 'TLA022', p: [a[0] + u[0]*t, a[1] + u[1]*t], hide: true, note: 'TLA R022' }; }
for (const [id, [from, b, nm]] of Object.entries(EGPH.SID_PTS)) WP[id] = { id, p: add(WP[from].p, b, nm), hide: true, note: `${from} R${String(Math.round(b - EGPH.RWY.var)).padStart(3, '0')} D${nm}` };
const RADAR_REF = ARP;
const GATES = Object.keys(EGPH.DIR);
const STAR_OF = g => EGPH.STARS[EGPH.DIR[g].star];
const starFrom = g => { const pts = STAR_OF(g).pts.map(p => p[0]); const i = pts.indexOf(EGPH.DIR[g].entry); return pts.slice(Math.max(0, i)); };
// the holds (7-7 and the approach charts): STIRA and TARTN where the STARs end, UW and EDN for the approaches and the
// missed approaches
for (const [id, h] of Object.entries(EGPH.HOLDS_AIR)) WP[id].hold = { inb: Math.round(h.inb), min: h.min, left: h.turn === 'L', ...(h.nm ? { nm: h.nm } : {}) };
const ENTRY = Object.fromEntries(GATES.map(g => [g, WP[EGPH.DIR[g].entry].p]));
// the level an arrival is picked up at (Scottish Control has brought it down) and its level before that
const ENTRY_ALT = { N: 11000, W: 11000, WA: 11000, S: 13000, SE: 12000, E: 12000 };
const PRE_ALT = { N: 19000, W: 19000, WA: 15000, S: 21000, SE: 21000, E: 21000 };

// ── ILS approaches (8-1, 8-4): the localiser from 3 NM outside the glidepath intercept (06: D12 at 4,000 ft over the high
// ground to the south-west; 24: D9 at 3,000 ft over the Forth), the 3° glidepath. CAT II/III on both runways (AD 2.20
// item 3): RVR 75 m. The approach controller's "four miles" check: an arrival not visual goes around there.
const IFX = {};
for (const [rw, I] of Object.entries(EGPH.ILS)) { const id = rw === '06' ? 'VG' + I.ifNM : 'TH' + I.ifNM; IFX[rw] = id;
  WP[id] = { id, p: add(THR[rw], norm(crsOf(rw) + 180), I.ifNM), hide: true, note: `${I.loc} D${I.ifNM}` }; }
const FINAL = {};
for (const [rw, I] of Object.entries(EGPH.ILS)) {
  const thr = THR[rw], out = norm(crsOf(rw) + 180), dIF = I.ifNM, elev = THR_ELEV[rw];
  const F = { pts: [add(thr, out, dIF + 3), add(thr, out, dIF), thr], alts: [I.ifAlt, I.ifAlt, elev + 50], elev, entry: IFX[rw], entryName: `${I.loc} D${dIF}`, name: 'ILS ' + rw, alt: I.ifAlt,
    decName: 'four miles', decNM: 4, decMin: 2.6, minAlt: 1300, minText: '1,300 ft',
    mins: { vis: 75, ceil: 0 }, minRate: 300, missed: [I.missed[0]], missAlt: I.missed[1],
    phrase: r => `cleared ILS approach runway ${r}`, read: r => `cleared ILS ${r}`,
    decCall: r => `${APT.tower[0]}, four miles, ILS runway ${r}`, decNeed: 'Four miles, needs landing clearance', decFail: 'not visual at the decision height' };
  F.cum = new Array(F.pts.length).fill(0); for (let i = F.pts.length - 2; i >= 0; i--) F.cum[i] = F.cum[i+1] + dist(...F.pts[i], ...F.pts[i+1]);
  const meet = (I.ifAlt - elev - 50)/318;                    // 3° = 318 ft per NM
  F.prof = [[0, elev + 50], [meet, I.ifAlt], [F.cum[0] + 1, I.ifAlt]];
  FINAL[rw] = F;
}

// ── to the glidepath intercept: a downwind and base laid out beside the final (hidden points, the vectors Edinburgh Radar
// gives), so an arrival with no instructions still gets there. The downwind is on the side the arrival comes from.
const FEED_ALT = {};
function feeder(rw, from, side){
  const I = EGPH.ILS[rw], thr = THR[rw], out = norm(crsOf(rw) + 180), dIF = I.ifNM;
  const f = WP[from].p, dx = f[0] - thr[0], dy = f[1] - thr[1], ux = Math.sin(out*D2R), uy = Math.cos(out*D2R);
  const along = dx*ux + dy*uy, right = dx*uy - dy*ux, s = side || (right >= 0 ? 1 : -1);
  const pt = (a, l) => add(add(thr, out, a), out + 90, l);
  // the downwind 1,000 ft above the intercept altitude, the base at it
  const tag = `${rw}${s > 0 ? 'R' : 'L'}`, mk = (k, p, note) => { WP[tag + k] = { id: tag + k, p, hide: true, note }; FEED_ALT[tag + k] = I.ifAlt + (k === 'B' ? 0 : 1000); return tag + k; };
  if (along > dIF + 3 && Math.abs(right) < 2.5) return [IFX[rw]];
  const base = mk('B', pt(dIF + 3, s*3.5), `base for ${rw}`);
  if (along > dIF + 3) return [base, IFX[rw]];
  const dw2 = mk('D', pt(dIF + 3, s*7), `downwind for ${rw}`);
  if (along > 1) return [dw2, base, IFX[rw]];
  return [mk('A', pt(1, s*7), `downwind for ${rw}`), dw2, base, IFX[rw]];
}
// Edinburgh Radar vectors arrivals off the STAR before its hold (TARTN, STIRA), which is flown only when holding: from the
// STAR's fix before it, an arrival already beyond the intercept goes to the base, the rest to a downwind on the side they
// came from. TARTN and STIRA stay charted holds (HOLD TARTN).
const ARR_ROUTE = Object.fromEntries(GATES.map(g => [g, Object.fromEntries(['06', '24'].map(rw => {
  const star = starFrom(g), pre = star[star.length - 2];
  return [rw, pre ? [...star.slice(0, -1), ...feeder(rw, pre)] : [...star, ...feeder(rw, star[star.length - 1])]];
}))]));
const HOLD_AT = Object.fromEntries(GATES.map(g => [g, STAR_OF(g).pts[STAR_OF(g).pts.length - 1][0]]));

// ── departures: conventional SIDs (flown by RNAV substitution), or the noise preferential route then direct SAB
const sidName = (gate, rwy) => EGPH.DIR[gate].sid[rwy] || EGPH.DIR[gate].sid['24'];
const sidSpoken = n => (EGPH.SIDS[n] || {}).spoken || n;
const sidTopOf = n => Math.max(...((EGPH.SIDS[n] || {}).pts || [[0, 6000]]).map(p => p[1] || 0));
const exitRoute = (g, rwy) => EGPH.SIDS[sidName(g, rwy)].pts.map(p => p[0]);
const EXIT_ROUTE = {}, EXIT_FIX = {};
for (const g of GATES) {
  Object.defineProperty(EXIT_ROUTE, g, { enumerable: true, get: () => exitRoute(g, depRw()) });
  Object.defineProperty(EXIT_FIX, g, { enumerable: true, get: () => { const r = exitRoute(g, depRw()); return r[r.length - 1]; } });
}
const NEXT_UNIT = Object.fromEntries(GATES.map(g => [g, EGPH.CTR[EGPH.DIR[g].ctr]]));
const relUnit = ac => 'Edinburgh Approach';
const TEL = EGPH.TEL;
const isMil = ac => false;
const gateFor = ap => EGPH.PLACE_DIR[ap] || 'SE';

// ═════════════════════════ schedule ═════════════════════════
const withGate = x => ({ ...x, gate: x.gate || gateFor(x.k === 'ARR' ? x.o : x.d) });
const TIMETABLE = EGPH.TIMETABLE;
const REGS = { C56X: 'G-LGTA' };
const LONG_STAY = EGPH.LONG_STAY;
const EXTRA = EGPH.EXTRA.map(withGate);
const EXERCISES = Object.fromEntries(Object.entries(EGPH.EXERCISES).map(([k, e]) => ['t' + k, { ...e, sched: e.sched.map(withGate) }]));
const WX_PRESETS = EGPH.WX_PRESETS;

// ═════════════════════════ weather rules ═════════════════════════
// strong westerlies and south-westerlies off the Pentland Hills bring turbulence and windshear on final to 24 (AD 2.22:
// GPWS warnings possible on the intermediate approach to both runways, from the terrain to the south)
const TURB_TABLE = {};
// ILS CAT III on both runways (RVR 75 m); CAT I needs 200 ft and RVR 550 m, which LVP covers
const minsOk = (w, rw) => w.vis >= 75;
const sraMinsOk = w => minsOk(w, '24');

// ═════════════════════════ engine hooks ═════════════════════════
// the apron an airline uses (APRON_OF: representative), the business jets at the Business Aviation Centre; the
// widebodies take the stands the chart sizes for them. Full: the terminal, then the Southeast, Midfield and North aprons,
// then the remote stands west of E and the Turnhouse Apron.
const termOf = ac => EGPH.APRON_OF[ac.cs.slice(0, 3)] || (isBiz(ac) ? 'B' : 'S');
const FALLBACK = { G: ['B', 'H', 'R'], T: ['P', 'S', 'R'], P: ['T', 'S', 'M'], S: ['M', 'P', 'H', 'R'], M: ['S', 'H', 'R'], N: ['H', 'R', 'S'], E: ['H', 'N', 'R'], B: ['G', 'H', 'R'], H: ['R', 'S'], R: ['H', 'S'] };
const isWide = ac => ac.perf && ac.perf.span > 40;
const APT = {
  toVis: 125,   // low visibility take-offs to RVR 125 m
  // STAR levels (FL70 at TARTN and STIRA, 1,000 ft above the SIDs' 6,000 ft stop), then the downwind and base
  arrAlt: { ...arrAltOf(GATES.map(STAR_OF)), ...FEED_ALT },
  icao: 'EGPH', name: 'Edinburgh', coordName: 'Edinburgh', radarName: 'EDI', utcOff: 0, tz: 'Europe/London',
  radar: [EGPH.UNITS.app.name, EGPH.UNITS.app.freq], depRadar: [EGPH.UNITS.app.name, EGPH.UNITS.app.freq],   // departures go to Edinburgh Approach, then Scottish Control
  tower: [EGPH.UNITS.twr.name, EGPH.UNITS.twr.freq], gnd: [EGPH.UNITS.gnd.name, EGPH.UNITS.gnd.freq],
  runways: RWY_LIST, bigGround: true, rwyHalfWidth: 23,
  ihps: G.ihps.map(([id, node]) => ({ id, node })),
  xing: false, drawnTown: false, ta: EGPH.TA, initClimb: 6000, gaAlt: 3000, appAlt: 3000, handoffNM: 15, climbFL: 150, divertAlt: 7000,
  area: { dep: 45, arr: 80, div: 45 }, roll: [70, RWY_M - 70], defRwy: '24', defWx: 'west',
  appName: 'ILS approach', appShort: 'ILS', minsText: 'weather below the ILS CAT III minima', reqApp: rw => 'ILS approach',
  minsLong: 'Visibility is below the ILS CAT III minima (RVR 75 m).',
  lvp: w => w.vis < 600 || w.ceil < 200, lvpNote: 'no intersection departures from B1 or C1, arrivals vacate past the coded centreline lights',
  liveName: 'Edinburgh Airport', atisFreq: EGPH.UNITS.atis.freq, turbName: 'Edinburgh',
  sessionHours: Array.from({ length: 17 }, (_, i) => i + 6),   // 0600Z to 2200Z (GMT; an hour earlier in summer time)
  view: { app: [0, 0, 60], twr: [(RU[0]*0.3*RWY_M + RU[1]*420)*M2NM, (RU[1]*0.3*RWY_M - RU[0]*420)*M2NM, 2.6], gnd: [mOf(EN(700, -150)), offOf(EN(700, -150)), 2000, 1300] },
  minsOk,
  // the SIDs are pre-coordinated with Scottish Control: no individual departure releases
  needRel: ac => false,
  sidAlt: ac => sidTopOf(ac.sid),
  remoteAreas: [],
  areaNames: { civil: 'stands' },
  termName: t => TERM_NAME[t] || 'Apron ' + t,
  prefArea: ac => { const t = isWide(ac) ? 'W' : termOf(ac); return t === 'W' ? { key: 'W', name: 'widebody stands', has: s => (s.maxSpan || 0) >= 60 } : { key: t, name: TERM_NAME[t], has: s => s.term === t }; },
  standFor: ac => { if (isWide(ac)) { const w = STANDS.filter(s => (s.maxSpan || 0) >= ac.perf.span && standFree(s, ac)); if (w.length) return w[Math.floor(Math.random()*w.length)]; }
    const t = termOf(ac); return standAt(ac, t) || FALLBACK[t].reduce((f, k) => f || standAt(ac, k), null); },
  inboundAlt: gate => 7000,
  divertTo: ac => ['W', 'WA', 'N'].includes(ac.gate) ? ['Glasgow', 'GOW'] : ['Newcastle', 'TLA'],
  firstAlt: g => ENTRY_ALT[g] - 2000,
  rolledCall: 'request taxi',
  vacExits: ac => { const R = R0, rw = ac.app || S.rwy, m = R.mOf([ac.x, ac.y]), dir = rw === R.lo ? 1 : -1;
    return exitsFor(rw, ac).filter(k => (HOLDS[k].m - m)*dir > 30).slice(0, 4); },
  vacPrefs: (st, ac) => exitsFor(ac && ac.app || S.rwy, ac),
  exitFor,
  lineUpWords: hp => 'line up and wait',
  terrain: null,
  restricted: null,
  drawAirport: drawEgph, drawAirportTop: drawEgphTop,
  gaEarly(ac, rw){},
  // missed approach (8-1, 8-4): climb straight ahead to 3,000 ft, then as directed: on to the beacon on the climb-out side
  // (EDN off 06, UW off 24) to hold
  gaTurn(ac){ const rw = ac.gaRwy, F = FINAL[rw] || FINAL['24']; if (ac.alt > 2900 || dist(ac.x, ac.y, ...THR[rw]) > 4) { ac.gaTurn = true; ac.mode = 'NAV'; ac.route = F.missed.slice(); ac.turnDir = EGPH.ILS[rw].turn; } },
  // conventional SIDs: off 06 the early left turn at 635 ft onto track 042°; off 24 straight ahead to UW
  liftoff(ac){ ac.tgtHdg = Math.round(crsOf(ac.depRwy)); ac.turnDir = 0; },
  depTurn(ac){ if (!ac.turned && ac.alt >= ELEV + 500) ac.turned = true; },
  depClear: ac => !!ac.turned,
  shear(ac, rw, w){ return turbExcess(w) > 4 && Math.random() < 0.2 ? 'windshear on final' : null; },
  shearWhy: rw => 'windshear on final',
  faceHold: (st, f) => depHold({ stand: st, leftStand: false, x: st.p[0], y: st.p[1] }),
  faceWord: f => f,
  faceHdg: (st, f) => norm(laneDir(st, f) + 180),
  // the full-length entry for the departure runway, then the intersection (not for a heavy, nor in LVP)
  taxiHolds: (south, ac) => { const rw = depRw(ac), ends = endHolds(rw); return [...ends, ...intxHolds(rw).filter(k => !ac || ac.perf.wake === 'M' || ac.perf.wake === 'L')]; },
  holdNote: (hp, rw) => intxHolds(rw).includes(hp) ? ` · intersection, ${(Math.round(intxRun(hp, rw)/10)*10).toLocaleString('en-GB')} m of runway ahead` : '',
  depHoldAs,
  taxiCheck: (ac, hp) => { if (ac.kind !== 'DEP' || !HOLDS[hp]) return null; const rw = depRw(ac), ref = HOLDS[hp].ref;
    if (ref === INTX[rw] && S.lvpOn) return `No intersection departures from ${hpWords(ref)} in low visibility procedures (AD 2.20): ${ac.cs} needs ${hpWords(endHolds(rw)[0])}.`;
    if (ref === INTX[rw] && (ac.perf.wake === 'H' || ac.perf.wake === 'J')) return `${ac.cs} (${ac.t}, heavy) needs the full length: ${hpWords(endHolds(rw)[0])}.`;
    return null; },
  taxiHint: rw => rw === '24' ? 'Runway 24 departures go east along Alfa to Delta 1 (full length), or Charlie 1 for an intersection departure (1,891 m). Landing 24, Code E and F vacate at the end (Alfa 1). Hot spot HS1: Charlie, Lima and Mike meet Alfa between Alfa 15 and Alfa 17.'
    : 'Runway 06 departures go west along Alfa to Alfa 1 (full length), or Bravo 1 for an intersection departure (1,891 m). Landing 06, Code E and F vacate at the end (Delta 1). Hot spot HS1: Charlie, Lima and Mike meet Alfa between Alfa 15 and Alfa 17.',
  // medical diversions: flights crossing central Scotland
  diverts: [{ cs: 'ICE454', t: 'B38M', o: 'BIKF', gate: 'N', to: 'London Heathrow' }, { cs: 'SAS1529', t: 'A20N', o: 'EKCH', gate: 'E', to: 'Dublin' },
    { cs: 'AAL730', t: 'B772', o: 'KJFK', gate: 'W', to: 'Copenhagen' }, { cs: 'LOG591', t: 'AT76', o: 'EGPE', gate: 'N', to: 'Birmingham' }],
  airports: EGPH.AIRPORTS, via: {},
  airlineIcao: EGPH.AIRLINE_ICAO, airlineType: EGPH.AIRLINE_TYPE, defType: 'A320',
  placeIcao: EGPH.PLACES,
  // UK phraseology (CAP 413) from the engine, with Edinburgh's own: Edinburgh Ground gives the clearance with the start-up
  // and push (or DCL); a departure east has no SID: the noise preferential route, then direct Saint Abbs
  phr: {
    push: (ac, dn, face) => { const top = sidTopOf(ac.sid), npr = (EGPH.SIDS[ac.sid] || {}).npr, rt = npr ? 'after departure follow the noise routeing, then direct Saint Abbs' : `${sidSpoken(ac.sid)} departure`;
      return [`cleared to ${dn} via ${rt}, climb ${altWords(top)}, squawk ${ac.sqk}, start-up and push back approved, facing ${faceSay(ac, face)}, QNH ${S.wx.qnh}`,
        `cleared ${dn}, ${npr ? 'noise routeing then direct Saint Abbs' : sidSpoken(ac.sid)}, altitude ${altShort(top)}, squawk ${ac.sqk}, start and push approved facing ${faceSay(ac, face)}, QNH ${S.wx.qnh}`]; },
    startReq: ac => `${EGPH.UNITS.gnd.name}, stand ${ac.stand.id}, ${ac.perf.name} to ${AP[ac.d] ? AP[ac.d][2] : ac.d}, information ${phonetic(S.atis)}, request start-up and push back`
  },
  atisPanel(w){
    const c = windComp(w, crsOf(S.rwy)), bad = !minsOk(w, S.rwy);
    return `<div class="warnline${bad ? ' bad' : ''}">Runway ${S.rwy} · ${bad ? 'below the ILS minima' : 'ILS approaches'} · crosswind ${Math.round(Math.abs(c.crossG))} kt. One runway and one parallel taxiway: space the arrivals to fit departures between them.</div>`;
  },
  atisLines({ w, L, E, wind, vis, cloud }){
    const tl = w.qnh >= 1013 ? 70 : w.qnh >= 978 ? 80 : 90, h = zt(S.t), hm = +h.slice(0, 2)*60 + +h.slice(3, 5);
    const out = [
      `This is Edinburgh information ${L}, time ${h.slice(0,5).replace(':', '')}.`,
      `Runway in use ${S.rwy}. ILS approach runway ${S.rwy}.`,
      `Surface wind ${wind}. Visibility ${vis}. ${cloud}.`,
      `Temperature ${w.temp}, dew point ${w.dew}. QNH ${w.qnh} hectopascals. Transition level ${tl}.`
    ];
    if (S.lvpOn) out.push('Low visibility procedures in operation. No intersection departures.');
    if (turbExcess(w) > 0) out.push('Moderate turbulence and windshear reported on final.');
    if (E && E.ws) out.push(`Windshear reported on final runway ${E.ws.rw} at ${zt(E.ws.t).slice(0,5).replace(':', '')}, ${E.ws.text}.`);
    if (E && E.rwyBlock) out.push(`Runway ${blockRw()} closed: ${E.rwyBlock.why}. Expect delays.`);
    if (!minsOk(w, S.rwy)) out.push('Visibility below the ILS minima. Expect holding at TARTN or STIRA.');
    if (hm >= 22*60 + 30 || hm < 6*60 + 30) out.push('No visual approaches before 0630.');
    out.push('Large bird population around the aerodrome. Hot spot HS1: taxiways Charlie, Lima and Mike meet Alfa.');
    out.push(`Acknowledge receipt of information ${L} and advise aircraft type and stand on first contact.`);
    return out;
  },
  // the website: home hero, previews, scenario cards and Academy figures
  site: {
    hero: () => [
      ['EZY6942', 55.93, -3.10, 239, 210, PAL.light.arr], ['RYR812', 55.75, -3.25, 20, 240, PAL.light.arr], ['KLM1281', 55.60, -2.95, 330, 260, PAL.light.arr],
      ['BAW1443', 55.90, -3.52, 239, 190, PAL.light.dep], ['LOG84', 56.05, -3.30, 42, 210, PAL.light.dep],
      ['UAL162', 56.20, -3.90, 250, 450, 'rgba(60,75,95,.7)'], ['ICE454', 56.40, -3.20, 160, 440, 'rgba(60,75,95,.7)'], ['SAS1529', 55.80, -2.60, 290, 430, 'rgba(60,75,95,.7)']
    ],
    demo(mk, park){
      const fin = add(THR['24'], CRS['06'], 2.6), out = add(THR['24'], CRS['24'], 3 + RWY_M*M2NM), inb = add(WP.TARTN.p, 200, 6);
      const hp = GN[HOLDS[endHolds('24')[0]].node].p;
      return [
        mk('EZY6943', 'A20N', 'DEP', park('16A', { need: null, reqAt: 99999 })), mk('RYR813', 'B738', 'DEP', park('25', { need: null, reqAt: 99999 })),
        mk('BAW1443', 'A320', 'DEP', park('3', { need: null, reqAt: 99999 })), mk('LOG84', 'AT76', 'DEP', park('202', { need: null, reqAt: 99999 })),
        mk('KLM1286', 'E190', 'DEP', { ground: true, state: 'HOLDPT', hp: endHolds('24')[0], x: hp[0], y: hp[1], hdg: CRS['24'], gs: 0 }),
        mk('RYR812', 'B738', 'ARR', { state: 'FINAL', mode: 'FINAL', app: '24', freq: 'TWR', x: fin[0], y: fin[1], hdg: CRS['24'], alt: 950, gs: 145, vs: -750, o: 'LEMG' }),
        mk('EZY6947', 'A319', 'DEP', { state: 'CLIMB', x: out[0], y: out[1], hdg: 239, alt: 3200, gs: 210, vs: 2000, tgtAlt: 6000, d: 'EGKK' }),
        mk('KLM1281', 'E190', 'ARR', { state: 'INBOUND', x: inb[0], y: inb[1], hdg: 20, alt: 8000, gs: 250, vs: -1000, tgtAlt: 7000, o: 'EHAM' })
      ];
    },
    thumb(k, zoom, W){
      if (k === 'app') return v => { v.scale *= 1.3; };
      if (k === 'twr') { const c = rm(RWY_M*0.5, -250); return v => { v.cx = c[0]; v.cy = c[1]; v.scale = W/2.6; }; }
      const c = zoom === 'apron' ? STANDS.find(s => s.id === '16').p : EN(700, -150);
      return v => { v.cx = c[0]; v.cy = c[1]; v.scale = W/((zoom === 'apron' ? 650 : 2300)*M2NM); };
    },
    figHold: 'TARTN', emergHp: 'D1',
    figConsole: v => { v.scale *= 1.2; },
    cmdHint: 'Command, e.g. KLM1281 H200 A40 · EZY6943 TAXI D1 VIA A · / to focus, Tab cycles flights'
  }
};
