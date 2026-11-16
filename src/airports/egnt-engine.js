// ═════════════════════════ Newcastle (EGNT) airport profile for the engine ═════════════════════════
// Builds every global the engine reads from the chart data in egnt.js (EGNT) and the charted aerodrome in egnt-ground.js
// (metres east and north of the ARP). Newcastle has one runway, 07/25, used for arrivals and departures alike, described
// like Bristol's (one frame, holding points with their runway-edge nodes and fillets), so the big-airport taxi routing,
// holding-position stops and lead-on lines apply. The terminal and the Main Apron are at the 07 end of the north side:
// Alfa down to the 07 end (A1, with its holding bay and the CAT II/III point A2), Delta the length of the north side to
// the 25 end (D1, its loop with the CAT II/III points D2 and D3), Bravo and Charlie (CW, CE) runway exits. South of the
// runway, reached across it from Bravo to Foxtrot, the GA Apron (F); the Golf Apron (G) and the maintenance area (E) are
// reached only over the runway.
Object.assign(TYPES, EGNT.TYPES);
const LL = p => xy(p[0], p[1]);
const G = EGNT_GROUND;
const EN = (e, n) => [e*M2NM, n*M2NM];                     // metres east and north of the ARP (the map origin) → NM

// ═════════════════════════ runway ═════════════════════════
// a frame along the runway: m from the 07 pavement end, off to the left (north-west)
function rwyFrame(r){
  const a = EN(...r.a), b = EN(...r.b), L = dist(...a, ...b), RU = [(b[0]-a[0])/L, (b[1]-a[1])/L], RN = [-RU[1], RU[0]];
  const rm = (m, off=0) => [a[0] + (RU[0]*m + RN[0]*off)*M2NM, a[1] + (RU[1]*m + RN[1]*off)*M2NM];
  const mOf = p => ((p[0]-a[0])*RU[0] + (p[1]-a[1])*RU[1])/M2NM, offOf = p => ((p[0]-a[0])*RN[0] + (p[1]-a[1])*RN[1])/M2NM;
  const len = r.len;
  // no turning pads: departures from the Main Apron enter at the runway ends (A1 for 07, D1 for 25) and line up straight.
  // From the south side (F, G and E: no taxiway to either end) they backtrack and turn round on the 45 m runway at its end:
  // TURN_W at the 07 end, TURN_E at the 25 end, each ending on the centreline facing down the runway
  const U = [[110, 0], [80, -6], [54, -15], [32, -20], [16, -17], [8, -6], [9, 7], [18, 17], [36, 21], [60, 17], [88, 6], [120, 0]];
  const TURN_W = U, TURN_E = U.map(([m, o]) => [+(len - m).toFixed(1), -o]);
  return { id: r.id, lo: r.lo, hi: r.hi, len, thr: r.thr, elev: r.elev, rm, mOf, offOf, RU, TURN_W, TURN_E, TURN_END: { W: 120, E: len - 120 },
    roll: [60, len - 60], ends: true, width: 45 };
}
const RWY_LIST = [rwyFrame(G.runways[0])];
const R0 = RWY_LIST[0];
const rm = R0.rm, mOf = R0.mOf, offOf = R0.offOf, RU = R0.RU;
const RWY_M = R0.len, THR_LO_M = R0.thr['07'], THR_HI_M = R0.thr['25'];
const RW_LO = '07', RW_HI = '25';
const THR = { '07': rm(THR_LO_M, 0), '25': rm(THR_HI_M, 0) };
const CRS = { '07': brg(...rm(0), ...rm(RWY_M)) }; CRS['25'] = norm(CRS['07'] + 180);
const THR_ELEV = { ...R0.elev };
const T_LO = THR[RW_LO], T_HI = THR[RW_HI], CRS_LO = CRS[RW_LO], CRS_HI = CRS[RW_HI];
const crsOf = rw => CRS[rw] ?? CRS_HI;
const ELEV = EGNT.elev;
const ARP = LL(EGNT.arp);
// no road crossing, no border fence, no rock
const XING_M = -1e9, XING_SKEW = 0, XING_HW = 0, xingM = o => XING_M;
const FRONTIER = [], R164 = [], ROCK = [], ROCK_TOP = [0, 0];
const TURN_W = R0.TURN_W, TURN_E = R0.TURN_E, TURN_END = R0.TURN_END, TURN_PAD = {};

// ═════════════════════════ taxiways, holding points, stands (egnt-ground.js) ═════════════════════════
const inF0 = (e, n) => { const p = EN(e, n); return [mOf(p), offOf(p)]; };
for (const [id, e, n] of G.nodes) gn(id, ...inF0(e, n));
for (const [id, e, n] of G.rnodes) gn(id, ...inF0(e, n));
// the crossing's lanes (x… on the centreline to the holding points either side) run down the same charted links as the
// holding points' own links to the runway: their points are taken from those links exactly, so the two lie on one line
const HLP = Object.values(G.hlink).flat();
const onLink = q => { let best = q, bd = 0.6; for (const h of HLP) { const d = Math.hypot(h[0] - q[0], h[1] - q[1]); if (d < bd) { bd = d; best = h; } } return best; };
for (const [a, b, tw, mid] of G.edges) chain(a, mid.map(([e, n]) => /^x/.test(a) || /^x/.test(b) ? onLink(inF0(e, n)) : inF0(e, n)), b, tw);
const HOLDS = {}, FIL = {};
for (const [k, [node, rwy, on, m, off, dirs, end, tw]] of Object.entries(G.holds)) {
  HOLDS[k] = { node, rwy, on, m, off, dirs: dirs.split(',').filter(Boolean), end: end || null, ref: k.replace(/~\d+$/, ''), tw };
  chain(rwy, G.hlink[k] || [], node, HOLDS[k].ref);             // hlink is already runway-frame m/off
  // the charted centreline-to-taxiway line, for the directions it turns off (W: rolling towards 25's end, so turning off
  // 07 and lining up for 25; E: the other way). Charlie's arms are angled for 07 only, Bravo and Foxtrot's square arm for 25
  const dd = HOLDS[k].dirs;
  FIL[k] = { W: dd.includes('07') ? G.fil[k] : [], E: dd.includes('25') ? G.fil[k] : [] };
}
// the south side's runway entries: F (the GA Apron), G (the Golf Apron) and E (the maintenance area) have no taxiway to
// either end, so a departure from them backtracks (sim.js lineUpPath, H.back) and turns at the end. F's square arm (the
// one in line with Bravo) is the one to line up from.
for (const k of Object.keys(HOLDS)) if (/^[EFG]$/.test(HOLDS[k].ref) && HOLDS[k].dirs.length === 2) HOLDS[k].back = ['07', '25'];
// the runway-holding positions: a path point there stops the aircraft until cleared onto or across the runway
for (const [id, rid] of Object.entries(G.hs)) if (GN[id]) GN[id].p.hs = rid;
// each holding position's axis: the unit vector along the taxiway towards the runway (from the charted link to it), read
// 25 m or more out from the holding position so a bend in the link next to it can't skew the bars
const HOLD_AXIS = {};
const axisPt = (k, p) => { const hl = (G.hlink[k] || []).map(q => rm(...q)).reverse(); for (const q of hl) if (dist(...p, ...q) >= 25/1852) return q; return hl.length ? hl[hl.length - 1] : GN[HOLDS[k].rwy].p; };
for (const [k, H] of Object.entries(HOLDS)) {
  if (HOLD_AXIS[H.node] || !GN[H.node]) continue;
  const p = GN[H.node].p, q = axisPt(k, p), L = dist(...p, ...q) || 1;
  HOLD_AXIS[H.node] = [(q[0] - p[0])/L, (q[1] - p[1])/L];
}
// stands (AD 2-EGNT-2-2): the pier round the terminal (1-12, and 30 and 31 laid diagonally across 9 and 1 for widebodies),
// the north part of the Main Apron (13-25R), the GA Apron (50-54) and the Golf Apron (60-62). Every one is nose-in with a
// push back: no stand is marked for self-manoeuvring (AD 2.20). Each takes up to the size in egnt.js's STAND_SPAN.
const STANDS = G.gates.map(([id, term, [e, n], node, hdg, line]) => { const p = EN(e, n);
  return { id, term, p, m: mOf(p), off: offOf(p), node, area: term === 'C' ? 'cargo' : 'civil', occ: null, noLead: !line, h0: hdg,
    line: line ? line.map(([e, n]) => EN(e, n)) : null, maxSpan: EGNT.STAND_SPAN[id] ?? null, vacant: EGNT.STAND_VACANT[id] || null }; });
// the stands laid over others take nothing alongside them, either way
for (const [c, hs] of Object.entries(EGNT.STAND_VACANT)) for (const h of hs) { const o = STANDS.find(s => s.id === h); if (o) o.vacant = [...(o.vacant || []), c]; }
STANDS.forEach(s => { s.lp = GN[s.node].p; s.hdg = s.h0 ?? brg(...s.lp, ...s.p); });
// the published coordinate is the T-bar where the nose stops: the stand's point is the aircraft's middle, set back along
// its line (shared, as at Madrid and Manchester)
standsNoseToMiddle({ same: (a, b) => (a.vacant || []).includes(b.id) });
// shared graph repairs (core): lanes that stop just short of each other joined, junction fillets the paint has but the
// centreline lacks, corner links past kinks, and slightly-too-sharp corners chamfered
joinGaps(); tFillets({ R: 30 }); kinkLinks(); smoothKinks();
const APRONS = G.aprons.map(r => r.map(([e, n]) => inF0(e, n)));
R0.side = 1;                                               // the terminal, the Main Apron and the main exits are north of the runway
const TERM_NAME = { T: 'Terminal', N: 'Main Apron', G: 'GA Apron', C: 'Golf Apron' };
// hot spot HS1 (AD 2-EGNT-2-1): unless ATC says so, nothing is routed via D2, the loop's top lane at the 25 end (it takes
// nothing over 36 m either): its lane costs eight times its length to the route search, so it is used only when named
{ const d2 = (G.ihps.find(([k]) => k === 'D2') || [])[1];
  if (d2 && GN[d2]) { const seen = new Set([d2]);
    for (const [v0, e0] of GN[d2].adj) { let u = d2, v = v0, e = e0; for (let g = 0; g < 60 && e; g++) { e.k = 8; e.hs1 = true; if (seen.has(v)) break; seen.add(v);
      const nx = GN[v].adj.filter(([w, f]) => w !== u && !f.bare && !f.fil); if (nx.length !== 1) break; u = v; [v, e] = nx[0]; } } } }

// taxiway names: letters spoken one by one (CW "Charlie Whiskey"), digits as numbers; holding points without the ~n suffix
const NATO = { A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike',
  N: 'November', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu' };
const twyWords = t => t.replace(/~\d+$/, '').match(/[A-Z]|\d+/g).map(x => NATO[x] || x).join(' ');
const PHON = {};
for (const e of GE) if (e.tw && e.tw !== 'APRON' && !PHON[e.tw]) PHON[e.tw] = twyWords(e.tw);
for (const k of Object.keys(HOLDS)) PHON[k] = twyWords(k);
for (const [id] of G.ihps) PHON[id] = twyWords(id);
PHON.APRON = 'the apron';

// departure entries: A1 at the 07 end, D1 at the 25 end, for everything on the north side. The GA Apron departs from F
// and the Golf Apron from G, backtracking (no taxiway to either runway end on the south side).
const endHolds = rw => Object.keys(HOLDS).filter(k => HOLDS[k].end === rw);
const routeLen = (from, to) => { const r = route(from, to); return r ? pathLen(r.nodes) : Infinity; };
const southHold = { G: 'F', C: 'G' };
const holdKey = ref => Object.keys(HOLDS).find(k => HOLDS[k].ref === ref && HOLDS[k].back) || Object.keys(HOLDS).find(k => HOLDS[k].ref === ref);
function depHold(ac){
  const st = ac.stand && !ac.leftStand ? ac.stand : null, at = st ? st.node : (nearestNode([ac.x, ac.y], n => !/^R/.test(n.id)) || {}).id;
  // on the south side (on a GA or Golf Apron stand, or taxiing south of the runway): its own entry
  const south = st ? southHold[st.term] : (Math.sign(R0.offOf([ac.x, ac.y])) !== R0.side ? (R0.mOf([ac.x, ac.y]) > 820 ? 'G' : 'F') : null);
  if (south && holdKey(south) && (!at || routeLen(at, HOLDS[holdKey(south)].node) < Infinity)) return holdKey(south);
  const rw = depRw(), ks = endHolds(rw); if (ks.length < 2 || !at) return ks[0];
  const rs = routesFrom(at, ks.map(k => HOLDS[k].node)); let best = ks[0], bl = Infinity;
  ks.forEach((k, i) => { const r = rs[i], L = r ? pathLen(r.nodes) : Infinity; if (L < bl) { bl = L; best = k; } });
  return best;
}
// exits for the landing runway: those the roll-out direction can turn into, in the order met, the north side first (07:
// Charlie's CW and CE, angled for it, then D1 at the end; 25: Bravo, angled for it, then A1 at the end), then the south
// side (F, G). Echo leads only to the maintenance area (17 m wingspan at most): not an exit for airliners. The runway is
// 2,330 m: an exit 500 m past the threshold is usable.
const RWYS_BY_END = rw => R0;
function exitsFor(rw){
  const R = R0, up = rw === R.lo, thr = R.thr[rw];
  const ks = Object.keys(HOLDS).filter(k => { const H = HOLDS[k]; return H.ref !== 'E' && H.dirs.includes(rw) && (up ? H.m > thr + 500 : H.m < thr - 500); });
  const near = ks.filter(k => Math.sign(HOLDS[k].off) === R.side), far = ks.filter(k => Math.sign(HOLDS[k].off) !== R.side);
  const order = a => a.sort((x, y) => (HOLDS[x].m - HOLDS[y].m)*(up ? 1 : -1));
  return [...order(near), ...order(far)];
}
// a name the controller says ("VAC CW") to the exit of that taxiway, ahead of the aircraft
function exitFor(ac, name){
  if (HOLDS[name]) return name;
  const rw = ac.app || S.rwy, R = R0, m = R.mOf([ac.x, ac.y]), dir = rw === R.lo ? 1 : -1;
  const ks = Object.keys(HOLDS).filter(k => (HOLDS[k].ref === name || HOLDS[k].tw === name) && (HOLDS[k].m - m)*dir > 20);
  return ks.sort((a, b) => (Math.sign(HOLDS[b].off) === R.side) - (Math.sign(HOLDS[a].off) === R.side) || (HOLDS[a].m - HOLDS[b].m)*dir)[0] || null;
}
// the maintenance hangar at the end of Echo: light aircraft (17 m wingspan at most, Echo's limit) stored or in maintenance
// at the start of a session, towed out an hour before they leave
{ const eEdges = GE.filter(e => e.tw === 'E'), deg = id => GN[id].adj.filter(([v]) => v[0] !== 'R').length;
  const end = [...new Set(eEdges.flatMap(e => [e.a, e.b]))].filter(id => deg(id) === 1).sort((a, b) => Math.abs(GN[b].off) - Math.abs(GN[a].off))[0];
  if (end) { const p = GN[end].p, q = GN[GN[end].adj[0][0]].p, b = brg(...q, ...p), inn = add(p, b, 35*M2NM);
    APT_HANGARS_EGNT = [{ id: 'MX', name: 'the maintenance hangar', in: [mOf(inn), offOf(inn)], door: [mOf(p), offOf(p)], node: end, to: ['civil', 'cargo'], fits: ac => spanOf(ac) <= 17 }]; } }
var APT_HANGARS_EGNT;

// ═════════════════════════ aerodrome drawing ═════════════════════════
// taxiways 23 m (the code C/D taxiways of AD 2.8); the drawn pavement is the aerodrome chart's own (G.twypave, G.aprons)
const TWYPAVE = (G.twypave || []).map(t => ({ out: t.out.map(([e, n]) => inF0(e, n)), holes: (t.holes || []).map(h => h.map(([e, n]) => inF0(e, n))) }));
const AD_SITE = { pave: { w: 23 }, aprons: APRONS, roads: [], buildings: [], twyExtra: [], shoulder: [0, RWY_M], serviceRoad: false, paag: [], floods: [], twyLabels: [], hotspots: [], labels: [],
  extraPolys: TWYPAVE.map(t => t.out) };
// hot spot HS1 (AD 2-EGNT-2-1): D2, the top of the Delta loop at the 25 end
const HOTSPOTS = (() => { const d2 = (G.ihps.find(([k]) => k === 'D2') || [])[1]; return d2 && GN[d2] ? [['HS1', GN[d2].p]] : []; })();
const TERM_LABELS = (() => { const by = {}; for (const s of STANDS) (by[s.term] ||= []).push(s.p); return Object.entries(by).map(([t, ps]) => [TERM_NAME[t].toUpperCase(), ps.reduce((a, p) => [a[0] + p[0]/ps.length, a[1] + p[1]/ps.length], [0, 0])]); })();
const CAT23 = new Set(G.cat23 || []);
function drawEgnt(){
  const sc = V.scale, mpx = sc/1852, IMG = mapImagery();
  const P2 = p => [sx(p[0]), sy(p[1])];
  const pathP = (pts, close = true) => { cx.beginPath(); pts.forEach((p, i) => cx[i ? 'lineTo' : 'moveTo'](...P2(p))); if (close) cx.closePath(); };
  const lw = m => Math.max(1, m*mpx);
  const R = R0, rwyPoly = w => [R.rm(0, -w/2), R.rm(R.len, -w/2), R.rm(R.len, w/2), R.rm(0, w/2)];
  if (sc <= 70) { cx.fillStyle = rgba('rwyOut', .9); pathP(rwyPoly(Math.max(R.width, 2.2/mpx))); cx.fill(); return; }
  cx.lineJoin = 'round'; cx.lineCap = 'round';
  // the chart's aprons and taxiway pavement (its grass islands cut out), then the runway on top; over the street map the
  // mapped pavement is already there, so only the taxiways are laid at their real width
  if (!IMG) {
    cx.fillStyle = C.concrete; for (const a of APRONS) { pathP(a.map(([m, o]) => rm(m, o))); cx.fill(); }
    cx.fillStyle = C.asphalt;
    for (const t of TWYPAVE) { cx.beginPath(); for (const ring of [t.out, ...t.holes]) ring.forEach(([m, o], i) => cx[i ? 'lineTo' : 'moveTo'](...P2(rm(m, o)))); cx.fill('evenodd'); }
    cx.strokeStyle = C.asphalt; cx.lineWidth = lw(23);
    for (const e of GE) { if (e.tw === 'APRON') continue; pathP([GN[e.a].p, GN[e.b].p], false); cx.stroke(); }
    for (const k in FIL) { pathP((FIL[k].W.length ? FIL[k].W : FIL[k].E).map(([m, o]) => R.rm(m, o)), false); cx.stroke(); }
  } else {
    const lines = GE.filter(e => e.tw !== 'APRON').map(e => ({ pts: [P2(GN[e.a].p), P2(GN[e.b].p)], w: paveWidth(e.tw) }));
    for (const k in FIL) lines.push({ pts: (FIL[k].W.length ? FIL[k].W : FIL[k].E).map(([m, o]) => P2(R.rm(m, o))), w: paveWidth() });
    drawPavement(lines, G.buildings.map(b => b.pts.map(([e, n]) => P2(EN(e, n)))), mpx);
  }
  cx.fillStyle = C.rwy; pathP(rwyPoly(R.width)); cx.fill();
  if (!IMG) { cx.fillStyle = C.bld; cx.strokeStyle = C.bldEdge; cx.lineWidth = 1; for (const b of G.buildings) { pathP(b.pts.map(([e, n]) => EN(e, n))); cx.fill(); cx.stroke(); } }
  if (sc > 150) {
    cx.fillStyle = C.paint; cx.strokeStyle = C.paint;
    const hw = R.width/2 - 1.5, quad = (m1, o1, m2, o2) => { pathP([R.rm(m1, o1), R.rm(m2, o1), R.rm(m2, o2), R.rm(m1, o2)]); cx.fill(); };
    cx.lineWidth = lw(0.9); pathP([R.rm(0, hw), R.rm(R.len, hw)], false); cx.stroke(); pathP([R.rm(0, -hw), R.rm(R.len, -hw)], false); cx.stroke();
    cx.setLineDash([30*mpx, 20*mpx]); pathP([R.rm(R.thr[R.lo] + 100, 0), R.rm(R.thr[R.hi] - 100, 0)], false); cx.stroke(); cx.setLineDash([]);
    // ICAO Annex 14 / CAP 168: threshold stripes (12 on a 45 m runway), aiming point at 400 m, touchdown zone bars to 900 m
    // (AD 2.14: TDZ 900 m), arrows and a transverse bar before each displaced threshold
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
    // lead-on and lead-off lines: the charted lines carried over the runway to its centreline
    { const seen = new Set(), leads = []; for (const k in FIL) { const f = (FIL[k].W.length ? FIL[k].W : FIL[k].E), key = JSON.stringify(f); if (seen.has(key)) continue; seen.add(key);
      leads.push(leadLine(f).map(p => P2(R.rm(...p)))); }
      groundLines(lw(0.35), () => leads.forEach(strokeSmooth)); }
    // taxiway centrelines, stopping at the runway edges; and the GA Apron's painted rows for light aircraft
    paintEdgeLines(lw(0.35));
    groundLines(lw(0.3), () => { for (const q of G.paint || []) strokeSmooth(q.map(([e, n]) => P2(EN(e, n)))); });
    // runway holding positions (pattern A): two solid lines on the taxiway side and two dashed on the runway side
    cx.strokeStyle = C.yellow;
    for (const [id, [u, v]] of Object.entries(HOLD_AXIS)) {
      const n = GN[id]; if (!n) continue; const at = (a, b) => [n.p[0] + (v*a + u*b)*M2NM, n.p[1] + (-u*a + v*b)*M2NM];   // a across, b along
      for (const [d, dash] of [[-0.9, false], [-0.3, false], [0.3, true], [0.9, true]]) { cx.setLineDash(dash ? [mpx + 1, mpx + 1] : []); pathP([at(-11, d), at(11, d)], false); cx.stroke(); }
      cx.setLineDash([]);
    }
    // CAT II/III holding positions A2, D2 and D3 (pattern B): two solid lines with the rungs of a ladder between them; the
    // intermediate holding points (A3-A5, B2, D4-D8): a single dashed line across the taxiway
    { cx.save(); cx.lineCap = 'butt'; cx.lineWidth = lw(0.3);
      for (const [k, id] of G.ihps) { if (!GN[id]) continue; const p = GN[id].p, ws = waysOn(id); if (!ws.length) continue;
        const d = brg(...p, ...GN[ws[0][0]].p), at = (a, w) => add(add(p, d, a*M2NM), d + 90, w*M2NM);
        if (CAT23.has(id)) { cx.setLineDash([]); for (const a of [-0.75, 0.75]) { pathP([at(a, -11), at(a, 11)], false); cx.stroke(); }
          cx.beginPath(); for (let w = -10.5; w <= 10.5; w += 1.5) { cx.moveTo(...P2(at(-0.75, w))); cx.lineTo(...P2(at(0.75, w))); } cx.stroke(); }
        else { cx.lineWidth = Math.max(1.6, 0.6*mpx); cx.setLineDash([Math.max(3, 1.2*mpx), Math.max(2, 0.9*mpx)]); pathP([at(0, -11), at(0, 11)], false); cx.stroke(); cx.lineWidth = lw(0.3); } }
      cx.restore(); }
    // stand lead-in lines and numbers
    groundLines(lw(0.3), () => { for (const s of STANDS) if (!s.noLead) { pathP(s.line || [s.lp, s.p], false); cx.stroke(); } });
    cx.save(); if (IMG) clipOut(G.buildings.map(b => b.pts.map(([e, n]) => P2(EN(e, n))))); drawStandDetail(null, null, mpx, false); cx.restore();   // stand paint stops at the terminal walls
    drawGroundSigns();
    cx.font = `600 11px ${FONT_L}`;
    for (const [t, p] of HOTSPOTS) { const [X, Y] = P2(p); cx.strokeStyle = rgba('hot', .85); cx.lineWidth = 1.2; cx.beginPath(); cx.arc(X, Y, 45*mpx + 6, 0, 7); cx.stroke(); cx.fillStyle = rgba('hot', .95); cx.fillText(t, X + 45*mpx + 8, Y + 4); }
  }
}
// lights and apron names: drawn every frame over the airfield layer (in the dark theme the lights add their glow to
// what is under them, so they can't go in the layer)
function drawEgntTop(){
  const sc = V.scale, mpx = sc/1852, IMG = mapImagery();
  const P2 = p => [sx(p[0]), sy(p[1])];
  const R = R0;
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
const STAR_FIXES = new Set([...Object.values(EGNT.STARS).flatMap(s => s.pts.map(p => p[0])), 'NT07I', 'SUPIG', 'ERUXI', 'UPMOP', 'KUSEG', 'ASGEB', 'GIRLI']);
for (const [id, p] of Object.entries(EGNT.FIX)) if (!EGNT.NAV[id]) wp(id, p[0], p[1], STAR_FIXES.has(id) ? {} : { minor: true });
for (const [id, n] of Object.entries(EGNT.NAV)) wp(id, ...n.p, { note: `${n.name} ${n.freq}` });
// the departures' computed points (hidden): the GIRLI 1Y's climb on 245° to 1,100 ft before its turn (about 1.2 NM past
// the runway end); the omni-directional departures' straight-ahead point (T07/T25: 5 NM past the far end, where a jet is
// through 4,000 ft and can be vectored), and for the right and left turns towards GIRLI and ERKIT the NEW DME turn point
// (07: D3.5; 25: D1.5) and a point 4 NM along the heading flown (07: 190°; 25: 210°, 180° when Currock Hill is active)
const NEWP = WP.NEW.p;
const onCL = (rw, nm) => add(NEWP, crsOf(rw), nm);
WP.T25G = { id: 'T25G', p: add(rm(0, 0), CRS['25'], 1.2), hide: true, note: 'GIRLI 1Y: 245° to 1,100 ft' };
WP.T07 = { id: 'T07', p: add(rm(RWY_M, 0), CRS['07'], 5), hide: true, note: 'straight ahead' };
WP.T25 = { id: 'T25', p: add(rm(0, 0), CRS['25'], 5), hide: true, note: 'straight ahead' };
WP.R07 = { id: 'R07', p: onCL('07', 3.5), hide: true, note: 'NEW D3.5' };
WP.L25 = { id: 'L25', p: onCL('25', 1.5), hide: true, note: 'NEW D1.5' };
WP.H07 = { id: 'H07', p: add(WP.R07.p, 190 + EGNT.RWY.var, 4), hide: true, note: 'heading 190' };
WP.H25 = { id: 'H25', p: add(WP.L25.p, 210 + EGNT.RWY.var, 4), hide: true, note: 'heading 210' };
WP.H25C = { id: 'H25C', p: add(WP.L25.p, 180 + EGNT.RWY.var, 4), hide: true, note: 'heading 180 (Currock Hill active)' };
const RADAR_REF = ARP;
const GATES = Object.keys(EGNT.DIR);
const STAR_OF = g => EGNT.STARS[EGNT.DIR[g].star];
const starFrom = g => { const pts = STAR_OF(g).pts.map(p => p[0]); const i = pts.indexOf(EGNT.DIR[g].entry); return pts.slice(i < 0 ? 0 : i); };
// the holds: ETSES at the end of the STARs, NT over the field (the missed approach's, and for the arrivals without a STAR)
for (const [id, h] of Object.entries(EGNT.HOLDS_AIR)) WP[id].hold = { inb: Math.round(h.inb), min: h.min, left: h.turn === 'L' };
const ENTRY = Object.fromEntries(GATES.map(g => [g, WP[EGNT.DIR[g].entry].p]));
// the level an arrival is picked up at and its level before that: from the south PC North East releases it silently at
// FL160, cleared down to FL140 (vMATS APC 4.2.1.1); Scottish Control below FL195 at the level agreed
const ENTRY_ALT = { SW: 16000, S: 18000, L: 18000, E: 18000, NE: 14000, N: 13000, NW: 13000, W: 13000 };
const PRE_ALT = { SW: 23000, S: 27000, L: 27000, E: 27000, NE: 21000, N: 20000, NW: 20000, W: 20000 };

// ── ILS approaches: the localiser from 3 NM outside the intermediate fix, the 3° glidepath from it. The approach
// controller's "four miles" check: an arrival not visual (below the CAT II minima) goes around there.
const FINAL = {};
for (const [rw, I] of Object.entries(EGNT.ILS)) {
  const thr = THR[rw], out = norm(crsOf(rw) + 180), dIF = dist(...thr, ...WP[I.ifx].p), elev = THR_ELEV[rw];
  const F = { pts: [add(thr, out, dIF + 3), add(thr, out, dIF), thr], alts: [I.ifAlt, I.ifAlt, elev + 50], elev, entry: I.ifx, entryName: I.ifx, name: 'ILS ' + rw, alt: I.ifAlt,
    decName: 'four miles', decNM: 4, decMin: 2.6, minAlt: 1500, minText: '1,500 ft',
    mins: { vis: 300, ceil: 100 }, minRate: 300, missed: [I.missed[0]], missAlt: I.missed[1],
    phrase: r => `cleared ILS approach runway ${r}`, read: r => `cleared ILS ${r}`,
    decCall: r => `${APT.tower[0]}, four miles, ILS runway ${r}`, decNeed: 'Four miles, needs landing clearance', decFail: 'not visual at the decision height' };
  F.cum = new Array(F.pts.length).fill(0); for (let i = F.pts.length - 2; i >= 0; i--) F.cum[i] = F.cum[i+1] + dist(...F.pts[i], ...F.pts[i+1]);
  const meet = (I.ifAlt - elev - 50)/318;                    // 3° = 318 ft per NM
  F.prof = [[0, elev + 50], [meet, I.ifAlt], [F.cum[0] + 1, I.ifAlt]];
  FINAL[rw] = F;
}

// ── arrival routes. From the south: the STAR to ETSES, then the RNAV transition for the runway (ETSES 1J to ERUXI and
// on to NT07I for 07, ETSES 1K to UPMOP and SUPIG for 25), the RNP approaches' initial and intermediate fixes, where the
// ILS takes over. From the north and west: the routing in, then the RNP approach's other initial fix (KUSEG for 07, west
// of the field; ASGEB for 25, north-east of it) and the intermediate fix.
const FEED_ALT = Object.fromEntries([...Object.values(EGNT.TRANS), ...Object.values(EGNT.IAF_N)].flat());
const ARR_ROUTE = Object.fromEntries(GATES.map(g => [g, Object.fromEntries(['07', '25'].map(rw => {
  const S0 = STAR_OF(g), base = starFrom(g), tail = (S0.route ? EGNT.IAF_N : EGNT.TRANS)[rw].map(p => p[0]);
  return [rw, [...base, ...tail.filter(f => !base.includes(f))]];
}))]));
const HOLD_AT = Object.fromEntries(GATES.map(g => [g, STAR_OF(g).route ? 'NT' : 'ETSES']));

// ── departures. GIRLI: the SIDs (1T off 07; 3X off 25, or 1Y when the Currock Hill gliding site is active). Every other
// route: the omni-directional departure (straight ahead to FL80; towards ERKIT the right or left turn) and then the
// joining point Newcastle Radar vectors it to. The Currock Hill site (8 NM south-west, egnt.js) is taken as active at
// weekends from 09:00 to 17:00 local in good weather (gliders need a cloud base of 3,000 ft and 8 km), as the vMATS says
// it is active when the gliders ask for it.
const currockActive = () => { const ms = (S.start || Date.now()) + S.t*1000, d = new Date(ms + tzOffH(ms)*3600e3), h = d.getUTCHours(), w = S.wx || {};
  return (d.getUTCDay() === 0 || d.getUTCDay() === 6) && h >= 9 && h < 17 && (w.vis == null || w.vis >= 8000) && (w.ceil == null || w.ceil >= 3000) && !((w.gust || w.spd || 0) > 25); };
const DEPS = {};
for (const rw of ['07', '25']) for (const [key, R] of Object.entries(EGNT.DEP_ROUTES)) {
  const T = R.omni === 'T', pts = T ? (rw === '07' ? [['R07', 2500], ['H07', 4000]] : [['L25', 1500], ['H25', 4000]]) : [['T' + rw, 4000]];
  DEPS[`${rw} ${key}`] = { rwy: rw, airway: R.airway, omni: R.omni, pts: [...pts, ...R.via.map(f => [f, EGNT.DEP_ALT])], spoken: `${R.airway}, runway ${rw}` };
}
// from 25 towards ERKIT with Currock Hill active, the left turn is to 180°
DEPS['25 SEC'] = { ...DEPS['25 SE'], pts: [['L25', 1500], ['H25C', 4000], ...DEPS['25 SE'].pts.slice(2)], currock: true };
const depOf = n => EGNT.SIDS[n] || DEPS[n];
const sidName = (gate, rwy) => { const d = EGNT.DIR[gate].dep, r = rwy || depRw();
  if (d === 'SW') return r === '07' ? 'GIRLI1T' : currockActive() ? 'GIRLI1Y' : 'GIRLI3X';
  return d === 'SE' && r === '25' && currockActive() ? '25 SEC' : `${r} ${d}`; };
const sidSpoken = n => (depOf(n) || {}).spoken || n;
const sidTopOf = n => EGNT.DEP_ALT;
const exitRoute = (g, rwy) => (depOf(sidName(g, rwy)) || { pts: [] }).pts.map(p => p[0]);
const EXIT_ROUTE = {}, EXIT_FIX = {};
for (const g of GATES) {
  Object.defineProperty(EXIT_ROUTE, g, { enumerable: true, get: () => exitRoute(g, depRw()) });
  Object.defineProperty(EXIT_FIX, g, { enumerable: true, get: () => { const r = exitRoute(g, depRw()); return r[r.length - 1]; } });
}
const NEXT_UNIT = Object.fromEntries(GATES.map(g => [g, EGNT.CTR[EGNT.DIR[g].ctr]]));
const relUnit = ac => 'Newcastle Radar';
const TEL = EGNT.TEL;
const isMil = ac => false;
const gateFor = ap => EGNT.PLACE_DIR[ap] || 'SW';

// ═════════════════════════ schedule ═════════════════════════
const withGate = x => ({ ...x, gate: x.gate || gateFor(x.k === 'ARR' ? x.o : x.d) });
const TIMETABLE = EGNT.TIMETABLE;
const REGS = { PC12: 'G-NEWC', C56X: 'G-SXNA' };
const LONG_STAY = EGNT.LONG_STAY;
const EXTRA = EGNT.EXTRA.map(withGate);
const EXERCISES = Object.fromEntries(Object.entries(EGNT.EXERCISES).map(([k, e]) => ['n' + k, { ...e, sched: e.sched.map(withGate) }]));
const WX_PRESETS = EGNT.WX_PRESETS;

// ═════════════════════════ weather rules ═════════════════════════
// strong westerlies off the Pennines bring turbulence and windshear on final to 25
const TURB_TABLE = {};
// both runways have CAT II/III ILS (vMATS GEN 3.1): CAT II, 100 ft and RVR 300 m
const minsOk = (w, rw) => w.vis >= 300 && w.ceil >= 100;
const sraMinsOk = w => minsOk(w, '25');

// ═════════════════════════ engine hooks ═════════════════════════
// stands: the airline's usual ones (egnt.js STAND_OF, best first), then the smallest free stand on the Main Apron that
// takes it (the pier first); business and light aircraft to the GA Apron. The Golf Apron is for cargo and long stays.
const prefStands = ac => EGNT.STAND_OF[ac.cs.slice(0, 3)] || [];
const gaSmall = ac => isBiz(ac) || spanOf(ac) <= 16;
const termOf = ac => gaSmall(ac) ? 'G' : 'T';
function standFor(ac){
  for (const id of prefStands(ac)) { const s = STANDS.find(x => x.id === id); if (s && standFree(s, ac)) return s; }
  const pick = t => STANDS.filter(s => s.term === t && standFree(s, ac)).sort((a, b) => (a.maxSpan || 80) - (b.maxSpan || 80))[0] || null;
  return gaSmall(ac) ? pick('G') || pick('T') || pick('N') : pick('T') || pick('N') || pick('C');
}
const APT = {
  toVis: 150,   // departures continue in low visibility procedures (RVR 150 m)
  // the STAR levels, the transitions and the RNP initial fixes
  arrAlt: { ...arrAltOf(GATES.map(STAR_OF)), ...FEED_ALT },
  icao: 'EGNT', name: 'Newcastle', coordName: 'Newcastle', radarName: 'NCL', utcOff: 0, tz: 'Europe/London',
  radar: [EGNT.UNITS.app.name, EGNT.UNITS.app.freq], depRadar: [EGNT.UNITS.app.name, EGNT.UNITS.app.freq],   // departures go to Newcastle Radar, then Scottish or London Control
  tower: [EGNT.UNITS.twr.name, EGNT.UNITS.twr.freq], gnd: [EGNT.UNITS.gnd.name, EGNT.UNITS.gnd.freq],
  runways: RWY_LIST, bigGround: true, rwyHalfWidth: 23,
  ihps: G.ihps.map(([id, node]) => ({ id: id.replace(/~\d+$/, ''), node })).filter((h, i, a) => a.findIndex(x => x.id === h.id) === i),
  hangars: APT_HANGARS_EGNT || [],
  xing: false, drawnTown: false, ta: EGNT.TA, initClimb: EGNT.DEP_ALT, gaAlt: 2500, appAlt: 2600, handoffNM: 15, climbFL: 150, divertAlt: 7000,
  area: { dep: 45, arr: 80, div: 45 }, roll: [60, RWY_M - 60], defRwy: '25', defWx: 'west',
  appName: 'ILS approach', appShort: 'ILS', minsText: 'weather below the ILS minima', reqApp: rw => 'ILS approach',
  minsLong: 'Weather is below the ILS CAT II minima (100 ft and RVR 300 m).',
  liveName: 'Newcastle International Airport', atisFreq: EGNT.UNITS.atis.freq, turbName: 'Newcastle',
  sessionHours: Array.from({ length: 17 }, (_, i) => i + 5),   // 0500Z to 2100Z: from the first wave of departures (05:50 local in winter)
  view: { app: [0, 0, 60], twr: [0, 0.15, 2.4], gnd: [mOf(EN(-950, -80)), offOf(EN(-950, -80)), 1500, 1050] },
  minsOk,
  lvpNote: 'CAT II/III holding points A2, D2 and D3 in use',
  // every departure needs a release from Newcastle Radar (vMATS APC 5.4: the GIRLI SIDs included), and leaves within
  // five minutes of it
  needRel: ac => true,
  // the runway check starts from a holding point the departures are not queueing at: A1 and D1 are the runway ends' only
  // entries, where the departures line up
  rcAvoid: ['A1', 'D1'],
  sidAlt: ac => sidTopOf(ac.sid),
  remoteAreas: [],
  areaNames: { civil: 'stands', cargo: 'Golf Apron stands' },
  termName: t => TERM_NAME[t] || 'Apron ' + t,
  prefArea: ac => { const L = prefStands(ac), t = termOf(ac); return L.length ? { key: ac.cs.slice(0, 3), name: `stands ${L[0]}-${L[L.length - 1]}`, has: s => L.includes(s.id) } : { key: t, name: TERM_NAME[t], has: s => s.term === t }; },
  standFor,
  inboundAlt: gate => 7000,
  divertTo: ac => ['N', 'NE', 'NW'].includes(ac.gate) ? ['Edinburgh', 'ALASO'] : ['Teesside', 'TILNI'],
  firstAlt: g => ENTRY_ALT[g] - 2000,
  rolledCall: 'request taxi',
  // exits on the stand's side: the north ones for the Main Apron, the south ones (F, G) for the GA and Golf Aprons
  vacExits: ac => { const R = R0, rw = ac.app || S.rwy, m = R.mOf([ac.x, ac.y]), dir = rw === R.lo ? 1 : -1, side = ac.stand && /^[GC]$/.test(ac.stand.term) ? -R.side : R.side;
    const ks = exitsFor(rw).filter(k => (HOLDS[k].m - m)*dir > 30);
    return (ks.some(k => Math.sign(HOLDS[k].off) === side) ? ks.filter(k => Math.sign(HOLDS[k].off) === side) : ks).slice(0, 4); },
  vacPrefs: (st, ac) => { const L = exitsFor(ac && ac.app || S.rwy); return st && /^[GC]$/.test(st.term) ? [...L.filter(k => Math.sign(HOLDS[k].off) !== R0.side), ...L.filter(k => Math.sign(HOLDS[k].off) === R0.side)] : L; },
  exitFor,
  lineUpWords: hp => (HOLDS[hp] && (HOLDS[hp].back || []).includes(depRw())) ? 'line up and backtrack' : 'line up and wait',
  terrain: null,
  restricted: null,
  drawAirport: drawEgnt, drawAirportTop: drawEgntTop,
  gaEarly(ac, rw){},
  // missed approach (8-1, 8-5): 07 climbs straight ahead to the NT NDB at 2,500 ft; 25 climbs straight ahead to 2,500 ft or
  // I-NWC D4, whichever is later, then turns right back to NT
  gaTurn(ac){ const rw = ac.gaRwy, F = FINAL[rw] || FINAL['25']; if (ac.alt > 2400 || dist(ac.x, ac.y, ...THR[rw]) > 4) { ac.gaTurn = true; ac.mode = 'NAV'; ac.route = F.missed.slice(); ac.turnDir = EGNT.ILS[rw].turn; } },
  // the SID or the omni-directional departure: straight ahead on the runway track, then the route
  liftoff(ac){ ac.tgtHdg = Math.round(crsOf(ac.depRwy)); ac.turnDir = 0; },
  depTurn(ac){ if (!ac.turned && ac.alt >= ELEV + 500) ac.turned = true; },
  depClear: ac => !!ac.turned,
  shear(ac, rw, w){ return turbExcess(w) > 4 && Math.random() < 0.2 ? 'windshear on short final' : null; },
  shearWhy: rw => 'windshear on short final',
  faceHold: (st, f) => depHold({ stand: st, leftStand: false, x: st.p[0], y: st.p[1] }),
  faceWord: f => f,
  faceHdg: (st, f) => norm(laneDir(st, f) + 180),
  // the departure-end holding point for the north side; the south side's own entry
  taxiHolds: (south, ac) => { const ks = endHolds(depRw()), p = ac ? (ac.stand && !ac.leftStand ? ac.stand.lp : [ac.x, ac.y]) : ARP;
    const rec = ac && depHold(ac); return [...new Set([rec, ...ks.sort((a, b) => dist(...p, ...GN[HOLDS[a].node].p) - dist(...p, ...GN[HOLDS[b].node].p))].filter(Boolean))].slice(0, 3); },
  taxiHint: rw => rw === '25' ? 'Runway 25 departures taxi east along Delta to D1 at the 25 end (full length), holding at D3 on the loop if D1 is busy. Not via D2 (hot spot HS1) unless instructed. The GA Apron departs from F and the Golf Apron from G, backtracking.'
    : 'Runway 07 departures taxi south along Alfa to A1 at the 07 end; the holding bay west of Alfa lets one pass another. The GA Apron departs from F and the Golf Apron from G, backtracking. Stand 7: lead in from Bravo, not Alfa.',
  // medical diversions: flights crossing the north of England and the North Sea
  diverts: [{ cs: 'BAW1308', t: 'A320', o: 'EGPD', gate: 'N', to: 'London Heathrow' }, { cs: 'KLM1281', t: 'E195', o: 'EHAM', gate: 'E', to: 'Aberdeen' },
    { cs: 'EZY6943', t: 'A20N', o: 'EGPH', gate: 'NW', to: 'Málaga' }, { cs: 'RYR4497', t: 'B738', o: 'EIDW', gate: 'W', to: 'Copenhagen' }],
  airports: EGNT.AIRPORTS, via: {}, preToOrigin: true,
  airlineIcao: EGNT.AIRLINE_ICAO, airlineType: EGNT.AIRLINE_TYPE, defType: 'A320',
  placeIcao: EGNT.PLACES,
  // UK phraseology (CAP 413) from the engine, with Newcastle's own: Ground gives the clearance with the start-up and push.
  // The GIRLI SIDs by name; the other routes as the omni-directional departure: "cleared to Amsterdam via N610, after
  // departure climb straight ahead, flight level 80"; towards ERKIT the turn ("after departure straight ahead to Newcastle
  // DME 3.5, then right turn heading 190")
  phr: {
    push: (ac, dn, face) => { const s = depOf(ac.sid) || {}, top = sidTopOf(ac.sid);
      const go = s.sid ? `via ${sidSpoken(ac.sid)} departure` : s.omni === 'T' ? `via ${s.airway}, after departure straight ahead to Newcastle DME ${s.rwy === '07' ? '3.5, then right turn heading 190' : `1.5, then left turn heading ${s.currock ? 180 : 210}`}`
        : `via ${s.airway || 'the route'}, after departure climb straight ahead`;
      const goS = s.sid ? sidSpoken(ac.sid) : s.omni === 'T' ? `${s.airway}, ${s.rwy === '07' ? 'right heading 190 at D3.5' : `left heading ${s.currock ? 180 : 210} at D1.5`}` : `${s.airway || 'the route'}, straight ahead`;
      return [`cleared to ${dn} ${go}, climb ${altWords(top)}, squawk ${ac.sqk}, start-up and push back approved, facing ${faceSay(ac, face)}, QNH ${S.wx.qnh}`,
        `cleared ${dn}, ${goS}, ${altShort(top)}, squawk ${ac.sqk}, start and push approved facing ${faceSay(ac, face)}, QNH ${S.wx.qnh}`]; },
    startReq: ac => `${EGNT.UNITS.gnd.name}, stand ${ac.stand.id}, ${ac.perf.name} to ${AP[ac.d] ? AP[ac.d][2] : ac.d}, information ${phonetic(S.atis)}, request start-up and push back`
  },
  atisPanel(w){
    const c = windComp(w, crsOf(S.rwy)), bad = !minsOk(w, S.rwy);
    return `<div class="warnline${bad ? ' bad' : ''}">Runway ${S.rwy} · ${bad ? 'below the ILS minima' : 'ILS approaches'} · crosswind ${Math.round(Math.abs(c.crossG))} kt${currockActive() ? ' · Currock Hill gliding site active (GIRLI 1Y)' : ''}. One runway and no parallel taxiway on the south side: space the arrivals to fit departures between them.</div>`;
  },
  atisLines({ w, L, E, wind, vis, cloud }){
    const tl = w.qnh >= 1013 ? 70 : w.qnh >= 978 ? 80 : 90;
    const out = [
      `This is Newcastle information ${L}, time ${zt(S.t).slice(0,5).replace(':', '')}.`,
      `Runway in use ${S.rwy}. ILS approach runway ${S.rwy}.`,
      `Surface wind ${wind}. Visibility ${vis}. ${cloud}.`,
      `Temperature ${w.temp}, dew point ${w.dew}. QNH ${w.qnh} hectopascals. Transition level ${tl}.`
    ];
    if (turbExcess(w) > 0) out.push('Moderate turbulence and windshear reported on final.');
    if (E && E.ws) out.push(`Windshear reported on final runway ${E.ws.rw} at ${zt(E.ws.t).slice(0,5).replace(':', '')}, ${E.ws.text}.`);
    if (E && E.rwyBlock) out.push(`Runway ${blockRw()} closed: ${E.rwyBlock.why}. Expect delays.`);
    if (w.vis < 600 || w.ceil <= 200) out.push('Low visibility procedures in force. CAT II and III holding points A2, D2 and D3.');
    if (!minsOk(w, S.rwy)) out.push('Visibility below the ILS minima. Expect holding at ETSES or NT.');
    if (currockActive()) out.push('Currock Hill gliding site active.');
    out.push('Hot spot HS1: aircraft are not to route via Delta 2 unless instructed.');
    out.push(`Acknowledge receipt of information ${L} and advise aircraft type and stand on first contact.`);
    return out;
  },
  // the website: home hero, previews, scenario cards and Academy figures
  site: {
    hero: () => [
      ['EXS584', 54.86, -1.55, 10, 230, PAL.light.arr], ['KLM953', 55.12, -1.30, 245, 200, PAL.light.arr], ['BAW1330', 54.60, -1.72, 10, 250, PAL.light.arr],
      ['RYR17', 55.00, -1.85, 245, 190, PAL.light.dep], ['EZY5601', 54.85, -1.80, 200, 240, PAL.light.dep],
      ['ICE454', 55.40, -1.20, 140, 430, 'rgba(60,75,95,.7)'], ['SAS4601', 55.20, -0.60, 260, 420, 'rgba(60,75,95,.7)'], ['EZY812', 54.50, -2.30, 340, 430, 'rgba(60,75,95,.7)']
    ],
    demo(mk, park){
      const fin = add(THR['25'], CRS['07'], 2.6), out = add(THR['07'], CRS['25'], 4), inb = add(WP.ETSES.p, 190, 10);
      const hp = GN[HOLDS[endHolds('25')[0]].node].p;
      return [
        mk('EXS583', 'B738', 'DEP', park('8', { need: null, reqAt: 99999 })), mk('RYR17', 'B38M', 'DEP', park('5', { need: null, reqAt: 99999 })),
        mk('KLM954', 'E195', 'DEP', park('11', { need: null, reqAt: 99999 })), mk('BAW1329', 'A320', 'DEP', park('3', { need: null, reqAt: 99999 })),
        mk('EZY5601', 'A20N', 'DEP', { ground: true, state: 'HOLDPT', hp: endHolds('25')[0], x: hp[0], y: hp[1], hdg: CRS['25'], gs: 0 }),
        mk('EXS584', 'B738', 'ARR', { state: 'FINAL', mode: 'FINAL', app: '25', freq: 'TWR', x: fin[0], y: fin[1], hdg: CRS['25'], alt: 1100, gs: 145, vs: -750, o: 'LEAL' }),
        mk('EZY5639', 'A21N', 'DEP', { state: 'CLIMB', x: out[0], y: out[1], hdg: 245, alt: 3800, gs: 210, vs: 2000, tgtAlt: 8000, d: 'LIRF' }),
        mk('BAW1330', 'A20N', 'ARR', { state: 'INBOUND', x: inb[0], y: inb[1], hdg: 10, alt: 11000, gs: 260, vs: -1000, tgtAlt: 9000, o: 'EGLL' })
      ];
    },
    thumb(k, zoom, W){
      if (k === 'app') return v => { v.scale *= 1.3; };
      if (k === 'twr') { const c = rm(RWY_M*0.5, 250); return v => { v.cx = c[0]; v.cy = c[1]; v.scale = W/2.4; }; }
      const c = zoom === 'apron' ? STANDS.find(s => s.id === '8').p : rm(RWY_M*0.25, 250);
      return v => { v.cx = c[0]; v.cy = c[1]; v.scale = W/((zoom === 'apron' ? 600 : 1900)*M2NM); };
    },
    figHold: 'ETSES', emergHp: 'D1',
    figConsole: v => { v.scale *= 1.2; },
    cmdHint: 'Command, e.g. KLM953 H200 A60 · EXS583 TAXI D1 · / to focus, Tab cycles flights'
  }
};
