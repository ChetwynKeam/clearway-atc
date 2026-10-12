// ═════════════════════════ Bristol (EGGD) airport profile for the engine ═════════════════════════
// Builds every global the engine reads from the chart data in eggd.js (EGGD) and the OpenStreetMap aerodrome in
// eggd-ground.js (metres east and north of the ARP). Bristol has one runway, 09/27, used for arrivals and departures
// alike. It is described like Gatwick's (APT.runways with one frame, holding points with their runway-edge nodes and
// mapped fillets), so the big-airport taxi routing, holding-position stops and lead-on lines apply. Taxiway Z runs along
// the aprons on the north side; D/H and B/J cross the runway to the southern parking area.
Object.assign(TYPES, EGGD.TYPES);
const LL = p => xy(p[0], p[1]);
const G = EGGD_GROUND;
const EN = (e, n) => [e*M2NM, n*M2NM];                     // metres east and north of the ARP (the map origin) → NM

// ═════════════════════════ runway ═════════════════════════
// a frame along the runway: m from the west pavement end (09 end), off to the left (north)
function rwyFrame(r){
  const a = EN(...r.a), b = EN(...r.b), L = dist(...a, ...b), RU = [(b[0]-a[0])/L, (b[1]-a[1])/L], RN = [-RU[1], RU[0]];
  const rm = (m, off=0) => [a[0] + (RU[0]*m + RN[0]*off)*M2NM, a[1] + (RU[1]*m + RN[1]*off)*M2NM];
  const mOf = p => ((p[0]-a[0])*RU[0] + (p[1]-a[1])*RU[1])/M2NM, offOf = p => ((p[0]-a[0])*RN[0] + (p[1]-a[1])*RN[1])/M2NM;
  const len = r.len;
  // no turning pads: departures enter at the runway ends (GX for 09; AX or BX, on the pavement east of the displaced 27
  // threshold, for 27) and line up straight
  const TURN_W = [[30, 0]], TURN_E = [[len - 30, 0]];
  return { id: r.id, lo: r.lo, hi: r.hi, len, thr: r.thr, elev: r.elev, rm, mOf, offOf, RU, TURN_W, TURN_E, TURN_END: { W: 30, E: len - 30 },
    roll: [70, len - 70], ends: true, width: 45 };
}
const RWY_LIST = [rwyFrame(G.runways[0])];
const R0 = RWY_LIST[0];
const rm = R0.rm, mOf = R0.mOf, offOf = R0.offOf, RU = R0.RU;
const RWY_M = R0.len, THR_LO_M = R0.thr['09'], THR_HI_M = R0.thr['27'];
const RW_LO = '09', RW_HI = '27';
const THR = { '09': rm(THR_LO_M, 0), '27': rm(THR_HI_M, 0) };
const CRS = { '09': brg(...rm(0), ...rm(RWY_M)) }; CRS['27'] = norm(CRS['09'] + 180);
const THR_ELEV = { ...R0.elev };
const T_LO = THR[RW_LO], T_HI = THR[RW_HI], CRS_LO = CRS[RW_LO], CRS_HI = CRS[RW_HI];
const crsOf = rw => CRS[rw] ?? CRS_HI;
const ELEV = EGGD.elev;
const ARP = LL(EGGD.arp);
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
for (const [k, H] of Object.entries(HOLDS)) {
  if (HOLD_AXIS[H.node] || !GN[H.node]) continue;
  const p = GN[H.node].p, hl = G.hlink[k] || [], q = hl.length ? rm(...hl[hl.length - 1]) : GN[H.rwy].p, L = dist(...p, ...q) || 1;
  HOLD_AXIS[H.node] = [(q[0] - p[0])/L, (q[1] - p[1])/L];
}
// stands (AD 2-EGGD-2-2): the Main Apron in front of the terminal (1-6, 21-26), the East Apron (7-20) and the West Apron
// (28-40). Bristol has no air bridges: every stand is a walk-out or coach stand, all of them "terminal" stands here.
const STANDS = G.gates.map(([id, term, [e, n], node, hdg, line]) => { const p = EN(e, n);
  return { id, term, p, m: mOf(p), off: offOf(p), node, area: 'civil', occ: null, noLead: !line, h0: hdg, line: line ? line.map(([e, n]) => EN(e, n)) : null }; });
STANDS.forEach(s => { s.lp = GN[s.node].p; s.hdg = s.h0 ?? brg(...s.lp, ...s.p); });
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
    at.set(t, add(t.p, t.hdg + 180, Math.min(sb, Math.max(0, dist(...t.lp, ...t.p)/M2NM - 15))*M2NM));
  }
  for (const [t, p] of at) { t.p = p; t.m = mOf(p); t.off = offOf(p); } }
const APRONS = G.aprons.map(r => r.map(([e, n]) => inF0(e, n)));
R0.side = 1;                                               // the aprons and the main exits are north of the runway
const TERM_NAME = { M: 'Main Apron', E: 'East Apron', W: 'West Apron' };

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
// The runway is 2,011 m: an exit 500 m past the threshold is usable.
const RWYS_BY_END = rw => R0;
function exitsFor(rw){
  const R = R0, up = rw === R.lo, thr = R.thr[rw];
  const ks = Object.keys(HOLDS).filter(k => { const H = HOLDS[k]; return H.dirs.includes(rw) && (up ? H.m > thr + 500 : H.m < thr - 500); });
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
// taxiways 23 m: AD 2.8 is not among the charts, so the ICAO width for the code D aircraft Bristol takes
const AD_SITE = { pave: { w: 23 }, aprons: APRONS, roads: [], buildings: [], twyExtra: [], shoulder: [0, RWY_M], serviceRoad: false, paag: [], floods: [], twyLabels: [], hotspots: [], labels: [] };
// hot spot (AD 2-EGGD-2-1): HS1 Link Charlie, the West Apron lane in front of stands 22-26R; aircraft for those stands
// must enter straight from taxiway Z, not by Link Charlie (the AIP's W6/W7 position is in the middle of it)
const HOTSPOTS = [['HS1', LL([51 + 23/60 + 5.28/3600, -(2 + 42/60 + 55.27/3600)])]];
const TERM_LABELS = (() => { const by = {}; for (const s of STANDS) (by[s.term] ||= []).push(s.p); return Object.entries(by).map(([t, ps]) => [TERM_NAME[t].toUpperCase(), ps.reduce((a, p) => [a[0] + p[0]/ps.length, a[1] + p[1]/ps.length], [0, 0])]); })();
function drawEggd(){
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
    if (IMG) { cx.save(); clipOut(G.buildings.map(b => b.pts.map(([e, n]) => P2(EN(e, n))))); drawStandDetail(null, null, mpx); cx.restore(); }   // stand paint stops at the terminal walls
    else if (sc > 600) { cx.fillStyle = rgba('lab', .8); cx.font = `600 ${Math.max(9, 4*mpx)}px ${FONT_L}`; for (const s of STANDS) { const [X, Y] = P2(s.p); cx.fillText(s.id, X + 3, Y - 3); } }
    drawGroundSigns();
    cx.font = `600 11px ${FONT_L}`;
    for (const [t, p] of HOTSPOTS) { const [X, Y] = P2(p); cx.strokeStyle = rgba('hot', .85); cx.lineWidth = 1.2; cx.beginPath(); cx.arc(X, Y, 45*mpx + 6, 0, 7); cx.stroke(); cx.fillStyle = rgba('hot', .95); cx.fillText(t, X + 45*mpx + 8, Y + 4); }
  }
}
// lights and terminal names: drawn every frame over the airfield layer (in the dark theme the lights add their glow to
// what is under them, so they can't go in the layer)
function drawEggdTop(){
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
const STAR_FIXES = new Set(Object.values(EGGD.STARS).flatMap(s => s.pts.map(p => p[0])));
for (const [id, p] of Object.entries(EGGD.FIX)) if (!EGGD.NAV[id]) wp(id, p[0], p[1], STAR_FIXES.has(id) || /^(EMPAS|ELROV|HAWFA|YORQI|SOMOT)$/.test(id) ? {} : { minor: true });
for (const [id, n] of Object.entries(EGGD.NAV)) wp(id, ...n.p, { note: `${n.name} ${n.freq}` });
// the SIDs' turn points (straight ahead to the ILS DME turn point: 27 at I-BTS D5.2, 09 at I-BON D5.4, both DME zero-ranged
// to the far threshold) and the Brecon radial crossing points, hidden
WP.T27 = { id: 'T27', p: add(THR['27'], CRS['27'], 5.2), hide: true, note: 'I-BTS D5.2' };
WP.T09 = { id: 'T09', p: add(THR['09'], CRS['09'], 5.4), hide: true, note: 'I-BON D5.4' };
for (const [id, [from, b, nm]] of Object.entries(EGGD.SID_PTS)) WP[id] = { id, p: add(WP[from].p, b, nm), hide: true, note: `${from} R${String(Math.round(b - EGGD.RWY.var)).padStart(3, '0')} D${nm}` };
const RADAR_REF = ARP;
const GATES = Object.keys(EGGD.DIR);
const STAR_OF = g => EGGD.STARS[EGGD.DIR[g].star];
const starFrom = g => { const pts = STAR_OF(g).pts.map(p => p[0]); return pts.slice(pts.indexOf(EGGD.DIR[g].entry)); };
// the STAR hold (7-10): BRI, over the field, where the STARs end. Arrivals are vectored off the STAR before it (below)
// and only go there to hold (HOLD BRI) or after a missed approach.
for (const [id, h] of Object.entries(EGGD.HOLDS_AIR)) WP[id].hold = { inb: Math.round(h.inb), min: h.min, left: h.turn === 'L' };
const ENTRY = Object.fromEntries(GATES.map(g => [g, WP[EGGD.DIR[g].entry].p]));
// the level an arrival is picked up at (Cardiff Radar or London Control have brought it down) and its level before that
const ENTRY_ALT = { N: 10000, W: 11000, WA: 11000, E: 10000, S: 9000, SW: 10000 };
const PRE_ALT = { N: 17000, W: 19000, WA: 19000, E: 19000, S: 16000, SW: 17000 };

// ── ILS approaches: the localiser from 3 NM outside the intermediate fix, the 3° glidepath from 2,500 ft. The approach
// controller's "four miles" check: an arrival not visual (below the CAT I minima) goes around there.
const FINAL = {};
for (const [rw, I] of Object.entries(EGGD.ILS)) {
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

// ── to the intermediate fix: a downwind and base laid out beside the final (hidden points, the vectors Bristol Radar
// gives), so an arrival with no instructions still gets there. The downwind is on the side the arrival comes from.
const FEED_ALT = {};
function feeder(rw, from, side){
  const I = EGGD.ILS[rw], thr = THR[rw], out = norm(crsOf(rw) + 180), dIF = dist(...thr, ...WP[I.ifx].p);
  const f = WP[from].p, dx = f[0] - thr[0], dy = f[1] - thr[1], ux = Math.sin(out*D2R), uy = Math.cos(out*D2R);
  const along = dx*ux + dy*uy, right = dx*uy - dy*ux, s = side || (right >= 0 ? 1 : -1);
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
// which side of the final a gate's arrivals come from (the fix before BRI), and how far out along the final it is
const relOf = (id, rw) => { const p = WP[id].p, out = norm(crsOf(rw) + 180), thr = THR[rw], ux = Math.sin(out*D2R), uy = Math.cos(out*D2R);
  return { along: (p[0] - thr[0])*ux + (p[1] - thr[1])*uy, right: (p[0] - thr[0])*uy - (p[1] - thr[1])*ux }; };
// Bristol Radar vectors arrivals off the STAR before BRI (over the field), which is only flown when holding: from the
// STAR's fix before BRI, an arrival already beyond the intermediate fix goes to the base, the rest to a downwind on the
// side they came from. BRI stays a charted hold (WP.BRI.hold) and the missed approach's.
const ARR_ROUTE = Object.fromEntries(GATES.map(g => [g, Object.fromEntries(['09', '27'].map(rw => {
  const star = starFrom(g), pre = star[star.length - 2];
  return [rw, pre ? [...star.slice(0, -1), ...feeder(rw, pre)] : [...star, ...feeder(rw, 'BRI')]];
}))]));
const HOLD_AT = Object.fromEntries(GATES.map(g => [g, STAR_OF(g).pts[STAR_OF(g).pts.length - 1][0]]));

// ── departures: conventional SIDs (flown by RNAV substitution): straight ahead to the DME turn point, then the route
const sidName = (gate, rwy) => EGGD.DIR[gate].sid[rwy] || EGGD.DIR[gate].sid['27'];
const sidSpoken = n => (EGGD.SIDS[n] || {}).spoken || n;
const sidTopOf = n => Math.max(...((EGGD.SIDS[n] || {}).pts || [[0, 6000]]).map(p => p[1] || 0));
const exitRoute = (g, rwy) => EGGD.SIDS[sidName(g, rwy)].pts.map(p => p[0]);
const EXIT_ROUTE = {}, EXIT_FIX = {};
for (const g of GATES) {
  Object.defineProperty(EXIT_ROUTE, g, { enumerable: true, get: () => exitRoute(g, depRw()) });
  Object.defineProperty(EXIT_FIX, g, { enumerable: true, get: () => { const r = exitRoute(g, depRw()); return r[r.length - 1]; } });
}
const NEXT_UNIT = Object.fromEntries(GATES.map(g => [g, EGGD.CTR[EGGD.DIR[g].ctr]]));
const relUnit = ac => 'Bristol Radar';
const TEL = EGGD.TEL;
const isMil = ac => false;
const gateFor = ap => EGGD.PLACE_DIR[ap] || 'S';

// ═════════════════════════ schedule ═════════════════════════
const withGate = x => ({ ...x, gate: x.gate || gateFor(x.k === 'ARR' ? x.o : x.d) });
const TIMETABLE = EGGD.TIMETABLE;
const REGS = { PC12: 'G-BRSG', C56X: 'G-BRSX' };
const LONG_STAY = EGGD.LONG_STAY;
const EXTRA = EGGD.EXTRA.map(withGate);
const EXERCISES = Object.fromEntries(Object.entries(EGGD.EXERCISES).map(([k, e]) => ['b' + k, { ...e, sched: e.sched.map(withGate) }]));
const WX_PRESETS = EGGD.WX_PRESETS;

// ═════════════════════════ weather rules ═════════════════════════
// Bristol sits on Broadfield Down, 600 ft up: strong westerlies and south-westerlies over the Mendips and Dundry Hill
// bring turbulence and windshear on short final
const TURB_TABLE = {};
function turbExcess(w){
  if (w.vrb || w.spd < 15) return 0;
  return Math.max(0, Math.max(w.spd, (w.gust || 0)*0.85) - 25);
}
// ILS CAT I: 200 ft and RVR 550 m
const minsOk = (w, rw) => w.vis >= 550 && w.ceil >= 200;
const sraMinsOk = w => minsOk(w, '27');

// ═════════════════════════ engine hooks ═════════════════════════
// the apron an airline uses (easyJet the West Apron, Ryanair and the holiday airlines the East, the rest the Main Apron
// by the terminal); business and light aircraft on the East Apron. Full: the Main Apron, then the other one.
const termOf = ac => EGGD.APRON_OF[ac.cs.slice(0, 3)] || (isBiz(ac) ? 'E' : 'M');
function standAt(ac, t){
  const free = STANDS.filter(s => standFree(s, ac) && s.term === t);
  return free[Math.floor(Math.random()*Math.min(free.length, 6))] || null;
}
const APT = {
  // STAR levels (FL70 at BRI, 1,000 ft above the SIDs' 6,000 ft stop), then the downwind and base
  arrAlt: { ...arrAltOf(GATES.map(STAR_OF)), ...FEED_ALT },
  icao: 'EGGD', name: 'Bristol', coordName: 'Bristol', radarName: 'BRS', utcOff: 1,
  radar: [EGGD.UNITS.app.name, EGGD.UNITS.app.freq], depRadar: [EGGD.UNITS.app.name, EGGD.UNITS.app.freq],   // departures go to Bristol Radar, then Cardiff Radar or London Control
  tower: [EGGD.UNITS.twr.name, EGGD.UNITS.twr.freq], gnd: [EGGD.UNITS.gnd.name, EGGD.UNITS.gnd.freq],
  runways: RWY_LIST, bigGround: true, rwyHalfWidth: 23,
  ihps: G.ihps.map(([id, node]) => ({ id, node })),
  xing: false, drawnTown: false, ta: EGGD.TA, initClimb: 6000, gaAlt: 3000, appAlt: 2500, handoffNM: 12, climbFL: 150, divertAlt: 7000,
  area: { dep: 45, arr: 80, div: 45 }, roll: [70, RWY_M - 70], defRwy: '27', defWx: 'west',
  appName: 'ILS approach', appShort: 'ILS', minsText: 'weather below the ILS minima', reqApp: rw => 'ILS approach',
  minsLong: 'Weather is below the ILS CAT I minima (200 ft and RVR 550 m).',
  liveName: 'Bristol Airport', liveThin: 22, atisFreq: EGGD.UNITS.atis.freq, turbName: 'Bristol',
  sessionHours: Array.from({ length: 16 }, (_, i) => i + 6),   // 0600Z to 2100Z: 07:00 to 22:00 in Bristol
  view: { app: [0, 0, 60], twr: [0, 0.2, 2.2], gnd: [mOf(EN(-150, 280)), offOf(EN(-150, 280)), 1900, 1100] },
  minsOk,
  // the SIDs are pre-coordinated with Bristol Radar, Cardiff Radar and London Control: no individual departure releases
  needRel: ac => false,
  sidAlt: ac => sidTopOf(ac.sid),
  // stands: the airline's apron, then the Main Apron, then the other one. No remote stands.
  remoteAreas: [],
  areaNames: { civil: 'stands' },
  termName: t => TERM_NAME[t] || 'Apron ' + t,
  prefArea: ac => { const t = termOf(ac); return { key: t, name: TERM_NAME[t], has: s => s.term === t }; },
  standFor: ac => { const t = termOf(ac); return standAt(ac, t) || (t !== 'M' && standAt(ac, 'M')) || standAt(ac, t === 'E' ? 'W' : 'E'); },
  inboundAlt: gate => 7000,
  divertTo: ac => ['W', 'WA', 'N'].includes(ac.gate) ? ['Cardiff', 'BCN'] : ['Exeter', 'EXMOR'],
  firstAlt: g => ENTRY_ALT[g] - 2000,
  rolledCall: 'request taxi',
  vacExits: ac => { const R = R0, rw = ac.app || S.rwy, m = R.mOf([ac.x, ac.y]), dir = rw === R.lo ? 1 : -1;
    return exitsFor(rw).filter(k => (HOLDS[k].m - m)*dir > 30 && Math.sign(HOLDS[k].off) === R.side).slice(0, 4); },
  vacPrefs: (st, ac) => exitsFor(ac && ac.app || S.rwy),
  exitFor,
  lineUpWords: hp => 'line up and wait',
  terrain: null,
  restricted: null,
  drawAirport: drawEggd, drawAirportTop: drawEggdTop,
  gaEarly(ac, rw){},
  // missed approach (8-1, 8-5): climb straight ahead to 3,000 ft, then back to the BRI hold
  gaTurn(ac){ const rw = ac.gaRwy, F = FINAL[rw] || FINAL['27']; if (ac.alt > 2900 || dist(ac.x, ac.y, ...THR[rw]) > 4) { ac.gaTurn = true; ac.mode = 'NAV'; ac.route = F.missed.slice(); ac.turnDir = EGGD.ILS[rw].turn; } },
  // conventional SIDs: straight ahead on the runway track to the DME turn point at 3,000 ft or above, then the route
  liftoff(ac){ ac.tgtHdg = Math.round(crsOf(ac.depRwy)); ac.turnDir = 0; },
  depTurn(ac){ if (!ac.turned && ac.alt >= ELEV + 500) ac.turned = true; },
  depClear: ac => !!ac.turned,
  shear(ac, rw, w){ return turbExcess(w) > 4 && Math.random() < 0.2 ? 'windshear on short final' : null; },
  shearWhy: rw => 'windshear on short final',
  faceHold: (st, f) => depHold({ stand: st, leftStand: false, x: st.p[0], y: st.p[1] }),
  faceWord: f => f,
  faceHdg: (st, f) => norm(laneDir(st, f) + 180),
  // the departure-end holding points nearest the aircraft
  taxiHolds: (south, ac) => { const ks = endHolds(depRw()), p = ac ? (ac.stand && !ac.leftStand ? ac.stand.lp : [ac.x, ac.y]) : ARP;
    const rec = ac && depHold(ac); return [...new Set([rec, ...ks.sort((a, b) => dist(...p, ...GN[HOLDS[a].node].p) - dist(...p, ...GN[HOLDS[b].node].p))].filter(Boolean))].slice(0, 3); },
  taxiHint: rw => rw === '27' ? 'Runway 27 departures go east along Zulu to Alpha X-ray (the full length, from the displaced threshold) or Bravo X-ray. Stands 22 to 26R enter straight from Zulu: not through Link Charlie (hot spot HS1).' : 'Runway 09 departures go west along Zulu and Golf to Golf X-ray at the 09 end.',
  // medical diversions: flights crossing the west of England and South Wales
  diverts: [{ cs: 'EIN106', t: 'A320', o: 'EIDW', gate: 'W', to: 'London Heathrow' }, { cs: 'AFR1069', t: 'A320', o: 'LFPG', gate: 'E', to: 'Dublin' },
    { cs: 'TAP1362', t: 'A20N', o: 'LPPT', gate: 'SW', to: 'Manchester' }, { cs: 'RYR52RT', t: 'B738', o: 'EICK', gate: 'WA', to: 'London Stansted' }],
  airports: EGGD.AIRPORTS, via: {},
  airlineIcao: EGGD.AIRLINE_ICAO, airlineType: EGGD.AIRLINE_TYPE, defType: 'A320',
  placeIcao: EGGD.PLACES,
  // UK phraseology (CAP 413) from the engine, with Bristol's own: no delivery frequency, so Ground gives the clearance
  // with the start-up and push; the SID's stop altitude in it
  phr: {
    push: (ac, dn, face) => { const top = sidTopOf(ac.sid);
      return [`cleared to ${dn} via ${sidSpoken(ac.sid)} departure, climb ${altWords(top)}, squawk ${ac.sqk}, start-up and push back approved, facing ${faceSay(ac, face)}, QNH ${S.wx.qnh}`,
        `cleared ${dn}, ${sidSpoken(ac.sid)}, altitude ${altShort(top)}, squawk ${ac.sqk}, start and push approved facing ${faceSay(ac, face)}, QNH ${S.wx.qnh}`]; },
    startReq: ac => `${EGGD.UNITS.gnd.name}, stand ${ac.stand.id}, ${ac.perf.name} to ${AP[ac.d] ? AP[ac.d][2] : ac.d}, information ${phonetic(S.atis)}, request start-up and push back`
  },
  atisPanel(w){
    const c = windComp(w, crsOf(S.rwy)), bad = !minsOk(w, S.rwy);
    return `<div class="warnline${bad ? ' bad' : ''}">Runway ${S.rwy} · ${bad ? 'below the ILS minima' : 'ILS approaches'} · crosswind ${Math.round(Math.abs(c.crossG))} kt. One runway and one parallel taxiway: space the arrivals to fit departures between them.</div>`;
  },
  atisLines({ w, L, E, wind, vis, cloud }){
    const tl = w.qnh >= 1013 ? 70 : w.qnh >= 978 ? 80 : 90;
    const out = [
      `This is Bristol information ${L}, time ${zt(S.t).slice(0,5).replace(':', '')}.`,
      `Runway in use ${S.rwy}. ILS approach runway ${S.rwy}.`,
      `Surface wind ${wind}. Visibility ${vis}. ${cloud}.`,
      `Temperature ${w.temp}, dew point ${w.dew}. QNH ${w.qnh} hectopascals. Transition level ${tl}.`
    ];
    if (turbExcess(w) > 0) out.push('Moderate turbulence and windshear reported on final.');
    if (E && E.ws) out.push(`Windshear reported on final runway ${E.ws.rw} at ${zt(E.ws.t).slice(0,5).replace(':', '')}, ${E.ws.text}.`);
    if (E && E.rwyBlock) out.push(`Runway ${S.rwy} closed: ${E.rwyBlock.why}. Expect delays.`);
    if (!minsOk(w, S.rwy)) out.push('Visibility below the ILS minima. Expect holding at Bristol, the BRI hold.');
    out.push('Hot spot Link Charlie: stands 22 to 26R taxi in and out directly from taxiway Zulu.');
    out.push(`Acknowledge receipt of information ${L} and advise aircraft type and stand on first contact.`);
    return out;
  },
  // the website: home hero, previews, scenario cards and Academy figures
  site: {
    hero: () => [
      ['EZY6202', 51.36, -2.95, 86, 250, PAL.light.arr], ['RYR4123', 51.42, -2.55, 250, 230, PAL.light.arr], ['KLM1081', 51.50, -2.40, 230, 190, PAL.light.arr],
      ['EZY6201', 51.37, -2.88, 266, 180, PAL.light.dep], ['TOM6736', 51.30, -2.80, 220, 240, PAL.light.dep],
      ['BAW1442', 51.55, -2.90, 270, 430, 'rgba(60,75,95,.7)'], ['EIN654', 51.25, -2.50, 80, 420, 'rgba(60,75,95,.7)'], ['DLH8YT', 51.60, -2.50, 110, 430, 'rgba(60,75,95,.7)']
    ],
    demo(mk, park){
      const fin = add(THR['27'], CRS['09'], 2.6), out = add(THR['27'], CRS['27'], 4 + RWY_M*M2NM), inb = add(WP.BRI.p, 60, 12);
      const hp = GN[HOLDS[endHolds('27')[0]].node].p;
      return [
        mk('EZY6201', 'A20N', 'DEP', park('31', { need: null, reqAt: 99999 })), mk('RYR4122', 'B38M', 'DEP', park('9', { need: null, reqAt: 99999 })),
        mk('KLM1082', 'E190', 'DEP', park('3', { need: null, reqAt: 99999 })), mk('EZY6233', 'A320', 'DEP', park('24', { need: null, reqAt: 99999 })),
        mk('TOM6736', 'B738', 'DEP', { ground: true, state: 'HOLDPT', hp: endHolds('27')[0], x: hp[0], y: hp[1], hdg: CRS['27'], gs: 0 }),
        mk('EXS1885', 'B738', 'ARR', { state: 'FINAL', mode: 'FINAL', app: '27', freq: 'TWR', x: fin[0], y: fin[1], hdg: CRS['27'], alt: 1450, gs: 145, vs: -750, o: 'GCTS' }),
        mk('EZY6219', 'A319', 'DEP', { state: 'CLIMB', x: out[0], y: out[1], hdg: 266, alt: 3200, gs: 210, vs: 2000, tgtAlt: 6000, d: 'LFMN' }),
        mk('KLM1081', 'E190', 'ARR', { state: 'INBOUND', x: inb[0], y: inb[1], hdg: 240, alt: 8000, gs: 250, vs: -1000, tgtAlt: 7000, o: 'EHAM' })
      ];
    },
    thumb(k, zoom, W){
      if (k === 'app') return v => { v.scale *= 1.3; };
      if (k === 'twr') { const c = rm(RWY_M*0.5, 250); return v => { v.cx = c[0]; v.cy = c[1]; v.scale = W/2.2; }; }
      const c = zoom === 'apron' ? STANDS.find(s => s.id === '24').p : rm(RWY_M*0.5, 350);
      return v => { v.cx = c[0]; v.cy = c[1]; v.scale = W/((zoom === 'apron' ? 600 : 2200)*M2NM); };
    },
    figHold: 'BRI', emergHp: 'AX',
    figConsole: v => { v.scale *= 1.2; },
    cmdHint: 'Command, e.g. KLM1081 H240 A40 · EZY6201 TAXI AX · / to focus, Tab cycles flights'
  }
};
