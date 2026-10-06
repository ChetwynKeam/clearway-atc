// ═════════════════════════ Innsbruck (LOWI) airport profile for the engine ═════════════════════════
// Builds every global the engine reads from the chart data in lowi.js (LOWI) and the OpenStreetMap aerodrome (runway
// frame from the AIP thresholds, taxiways, stands and turn pads in runway metres from the west end of the pavement).
// Innsbruck lands and departs in opposite directions in one valley: S.rwy is the landing runway, S.depRwy the
// departure runway (normally land 26, depart 08).
Object.assign(TYPES, LOWI.TYPES);
const LL = p => xy(p[0], p[1]);
const VAR = LOWI.RWY.var;

// ── runway 08/26: 2000 m of pavement from the west end (60 m before the displaced THR 08) to THR 26
const T08 = LL(LOWI.RWY.thr['08']), T26 = LL(LOWI.RWY.thr['26']);
const RWY_M = LOWI.RWY.length;
const RU = (() => { const L = dist(...T08, ...T26); return [(T26[0]-T08[0])/L, (T26[1]-T08[1])/L]; })(), RN = [-RU[1], RU[0]];   // along (east), normal (north)
const W_END = [T08[0] - RU[0]*LOWI.RWY.dthr08*M2NM, T08[1] - RU[1]*LOWI.RWY.dthr08*M2NM], E_END = T26;
function rm(m, off=0){ return [W_END[0] + (RU[0]*m + RN[0]*off)*M2NM, W_END[1] + (RU[1]*m + RN[1]*off)*M2NM]; }
function mOf(p){ return ((p[0]-W_END[0])*RU[0] + (p[1]-W_END[1])*RU[1]) / M2NM; }
function offOf(p){ return ((p[0]-W_END[0])*RN[0] + (p[1]-W_END[1])*RN[1]) / M2NM; }
const THR_LO_M = LOWI.RWY.dthr08, THR_HI_M = RWY_M;
const RW_LO = '08', RW_HI = '26', T_LO = rm(THR_LO_M, 0), T_HI = rm(THR_HI_M, 0);
const CRS_LO = brg(...T_LO, ...T_HI), CRS_HI = norm(CRS_LO + 180);
const crsOf = rw => rw === RW_LO ? CRS_LO : CRS_HI;
const ELEV = LOWI.elev;
const THR_ELEV = { ...LOWI.RWY.elev };
const ARP = LL(LOWI.arp);
// no road crossing, no restricted area, no border fence
const XING_M = -1e9, XING_SKEW = 0, XING_HW = 0, xingM = o => XING_M;
const FRONTIER = [], R164 = [], ROCK = [], ROCK_TOP = [0, 0];

// ═════════════════════════ aerodrome layout ═════════════════════════
// LOWI_GROUND (lowi-ground.js): runway exits A and B to the south apron; Y and Z to the north are drawn only.
// 08 departures leave from Alpha and backtrack to the 08 turn pad; 26 departures from Bravo and backtrack to the 26 pad.
const G = LOWI_GROUND;
const FIL = G.FIL;
for (const [id, m, off] of G.nodes) gn(id, m, off);
const HOLDS = G.HOLDS;
const STANDS = G.STANDS.map(s => ({ ...s }));
STANDS.forEach(s => { s.p = rm(s.m, s.off); s.occ = null; if (!s.node) { s.node = 'L' + s.id; gn(s.node, ...s.lead); } s.lp = GN[s.node].p; s.hdg = brg(...s.lp, ...s.p); });
for (const [a, pts, b, tw] of G.chains) chain(a, pts, b, tw);
const TURN_W = G.TURN_W, TURN_E = G.TURN_E;
const TURN_PAD = {};
const TURN_END = { E: TURN_E[TURN_E.length-1][0], W: TURN_W[TURN_W.length-1][0] };
const PHON = LOWI.TAXI.PHON;
function depHold(ac){ return depRw() === RW_LO ? 'A' : 'B'; }
function pushPath(ac, face){
  const st = ac.stand, lm = mOf(st.lp), lo = offOf(st.lp);
  const tail = face === 'west' ? 1 : -1;                    // facing west means the tail goes east
  return [st.lp, rm(clamp(lm + tail*40, G.LANE[0], G.LANE[1]), lo)];
}
const pushRec = ac => depHold(ac) === 'B' ? 'east' : 'west';

// ═════════════════════════ fixes, STARs, SIDs (charts 9-1, 9-2, 11-1) ═════════════════════════
for (const [id, p] of Object.entries(LOWI.FIX)) wp(id, p[0], p[1], /^WI(5|6|7|8)\d\d$/.test(id) || /^WI00[5-8]$/.test(id) || id === 'WI103' || id === 'WI002' ? { minor: true } : {});
for (const [id, n] of Object.entries(LOWI.NAV)) wp(id, ...n.p, { note: `${n.name} ${n.freq}` });
for (const [id, h] of Object.entries(LOWI.HOLDS_AIR)) if (WP[id]) WP[id].hold = { inb: h.inb, min: h.min, left: h.turn === 'L' };
const RADAR_REF = WP.INN.p;
// the localiser courses: OEV 254° (mag) inbound to runway 26, OEJ 065° (mag) outbound down the valley to the east
const OEV = LL(LOWI.NAV.OEV.p), OEV_DME = LL(LOWI.NAV.OEV.dme), OEJ = WP.OEJ.p;
const LOC_IN = norm(LOWI.LOC_EAST.crsMag + VAR), LOC_OUT = norm(LOC_IN + 180), OEJ_CRS = norm(LOWI.NAV.OEJ.crsMag + VAR);
const S_DME = (OEV_DME[0]-OEV[0])*Math.sin(LOC_OUT*D2R) + (OEV_DME[1]-OEV[1])*Math.cos(LOC_OUT*D2R);
const dmeP = d => add(OEV, LOC_OUT, S_DME + d);           // on LOC OEV, d NM (DME OEV) east of the airport
WP.OEJL = { id: 'OEJL', p: add(OEJ, OEJ_CRS, 6), hide: true };            // on LOC OEJ, 6 NM beyond OEJ, for the SIDs
WP.OEJ14 = { id: 'OEJ14', p: add(OEV_DME, OEJ_CRS, 14), hide: true };     // D14 OEV on LOC OEJ, missed approach turn
// gates are the airway directions in lowi.js: each has a STAR (inbound) and a SID by departure runway (outbound)
const GATES = Object.keys(LOWI.DIR);
const STAR_OF = g => LOWI.STARS[LOWI.DIR[g].star];
const ENTRY = Object.fromEntries(GATES.map(g => [g, WP[STAR_OF(g).pts[0][0]].p]));
const ENTRY_ALT = { E: 15000, NE: 12000, N: 12000, S: 15000, W: 15000 }, PRE_ALT = Object.fromEntries(GATES.map(g => [g, ENTRY_ALT[g] + 9000]));
const ARR_ROUTE = Object.fromEntries(GATES.map(g => { const r = STAR_OF(g).pts.map(p => p[0]); return [g, { '08': r, '26': r }]; }));
const HOLD_AT = Object.fromEntries(GATES.map(g => [g, 'RTT']));
const sidName = (gate, rwy) => LOWI.DIR[gate].sid[rwy];
const SID_L = { J: 'Juliett', H: 'Hotel' };
const sidSpoken = n => n.replace(/ (\d)([A-Z])$/, (m, d, l) => ` ${DIG[d]} ${SID_L[l] || l}`);
const sidOf = (gate, rwy) => LOWI.SIDS[rwy][sidName(gate, rwy)];
const EXIT_FIX = {}; for (const g of GATES) Object.defineProperty(EXIT_FIX, g, { enumerable: true, get: () => { const x = LOWI.DIR[g].exit; return typeof x === 'string' ? x : x[depRw()]; } });
// the route after lift-off depends on the departure runway, so it is read when asked for
const EXIT_ROUTE = {}; for (const g of GATES) Object.defineProperty(EXIT_ROUTE, g, { enumerable: true, get: () => sidOf(g, depRw()).pts.map(p => p[0]) });
const NEXT_UNIT = Object.fromEntries(GATES.map(g => [g, LOWI.ACC[LOWI.DIR[g].acc]]));
const relUnit = ac => NEXT_UNIT[ac.gate][0];
const TEL = LOWI.TEL;
const isMil = ac => false;
const gateFor = ap => ap === 'LOWI' ? 'N' : (LOWI.PLACE_DIR[ap] || 'N');

// ── LOC/DME East (chart 13-1-2-1). From RTT to intercept LOC OEV at ADWIG (D21), FAF D19 at 9,500 ft, 3.77° with
// check altitudes, MAPt D4.5 at 3,700 ft (the 4% missed-approach gradient line), then straight in to runway 26, or
// (runway 08) the visual circling of chart 14-1: left at D4.2 onto 230°, downwind 264° south of the city at 3,700 ft
// minimum, right base at D3.5 W OEV (Axams church) and a short final onto runway 08.
const FINAL = {};
(function(){
  const E = LOWI.LOC_EAST, mapt = E.oca[1].mapt;
  const locPts = [WP.RTT.p, WP.ADWIG.p, ...E.checks.map(([d]) => dmeP(d)), dmeP(mapt)];
  const locAlt = [9500, 9500, ...E.checks.map(([, a]) => a), E.oca[1].oca];
  WP.MAPT = { id: 'MAPT', p: dmeP(mapt), note: 'D4.5 OEV, MAPt', hide: true };
  const rel = ([e, n]) => [ARP[0] + e, ARP[1] + n];
  // the circling (NM east, north of the ARP, traced from chart 14-1)
  const dw0 = rel([1.56, -1.69]), turn = rel([-2.47, -1.82]), loop = [[-3.05, -1.62], [-3.30, -1.10], [-3.05, -0.55]].map(rel), fin = add(T_LO, CRS_HI, 1.2);
  const mk = (pts, alts, rw, extra) => {
    const F = { pts, alts, elev: THR_ELEV[rw], entry: 'RTT', entryName: 'RTT', name: 'MAPt', decName: 'the MAPt (D4.5 OEV)', minAlt: E.oca[1].oca - 150, minText: '3,700 ft',
      alt: 9500, minRate: 0, mins: null, rwy: rw, ...extra };
    F.cum = new Array(pts.length).fill(0); for (let i = pts.length-2; i >= 0; i--) F.cum[i] = F.cum[i+1] + dist(...pts[i], ...pts[i+1]);
    F.prof = F.cum.map((c, i) => [c, alts[i]]).reverse();
    const im = locPts.length - 1; F.decNM = F.cum[im] + 0.1; F.decMin = F.cum[im] - 1.2;
    for (const g of F.gates || []) g.togo = F.cum[g.idx];
    return F;
  };
  const chk = i => ({ at: `D${E.checks[i][0]} OEV`, idx: 2 + i, min: E.checks[i][1] });
  FINAL['26'] = mk([...locPts, T_HI], [...locAlt, THR_ELEV['26'] + 50], '26', { gates: [chk(4), chk(5)],
    phrase: rw => 'cleared LOC DME East approach runway two six via RTT', read: rw => 'cleared LOC DME East runway 26' });
  const iDw = locPts.length + 1;
  FINAL['08'] = mk([...locPts, dmeP(E.circling.turnOut), dw0, turn, ...loop, fin, T_LO],
    [...locAlt, 3700, 3700, 3700, 3500, 3150, 2800, 2400, THR_ELEV['08'] + 50], '08', { gates: [chk(4), chk(5), { at: 'the downwind (minimum 3,700 ft)', idx: iDw, min: 3700 }],
    phrase: rw => 'cleared LOC DME East approach, circling runway zero eight, via RTT', read: rw => 'cleared LOC DME East, circling runway 08' });
  WP.AXAMS = { id: 'AXAMS', p: turn, note: 'Axams, right base', hide: true };
})();

// ── RNP approaches (charts 13-2-1, 13-2-2, 13-3-1, 13-3-2). Crew-flown published paths from the IAF: RNP E 26 (from
// WI610), RNP Z 26 AR (from RTT), RNP Z 08 AR and RNP VISUAL V 08 (from ELMEM, down the valley from the west).
const RNP = {};
(function(){
  const fixP = id => id === 'RW08' ? T_LO : id === 'RW26' ? T_HI : WP[id].p;
  function arc(a, b, c, dir, step){
    const R = (dist(...c, ...a) + dist(...c, ...b))/2, t0 = brg(...c, ...a), t1 = brg(...c, ...b);
    const sweep = dir === 'R' ? norm(t1 - t0) : -norm(t0 - t1), n = Math.max(2, Math.ceil(Math.abs(sweep)*D2R*R/step));
    const out = []; for (let k = 1; k < n; k++) out.push(add(c, t0 + sweep*k/n, R)); out.push(b); return out;
  }
  const C = id => LL(LOWI.ARC[id]);
  for (const [name, A] of Object.entries(LOWI.APPROACHES)) {
    const pts = [fixP(A.legs[0][0])], cons = [];
    if (A.legs[0][1]) cons.push([0, A.legs[0][1]]);
    let fap = null, fapAlt = null;
    for (const [id, alt, rf, role] of A.legs.slice(1)) {
      const b = fixP(id);
      if (rf) pts.push(...arc(pts[pts.length-1], b, C(rf[0]), rf[1], 0.2)); else pts.push(b);
      if (alt) cons.push([pts.length - 1, alt]); if (role === 'FAP') { fap = pts.length - 1; fapAlt = alt; }
    }
    const thr = A.rwy === RW_LO ? T_LO : T_HI, elev = THR_ELEV[A.rwy];
    const cum = new Array(pts.length).fill(0); for (let i = pts.length-2; i >= 0; i--) cum[i] = cum[i+1] + dist(...pts[i], ...pts[i+1]);
    const prof = [[0, elev + 50], ...cons.filter(([i]) => i < pts.length - 1).map(([i, a]) => [cum[i], a])].sort((p, q) => p[0] - q[0]);
    let dec = 0; for (let t = 0; t < cum[0]; t += 0.01) if (profAt(prof, t) >= A.minima.da) { dec = t; break; }
    // missed approach: from the threshold along the legs; arcs get hidden points about every 1.5 NM
    const miss = [], mpts = [thr]; let n = 0;
    for (const [id, , rf] of A.missed.legs) {
      const b = fixP(id);
      if (rf) { const prev = mpts[mpts.length-1]; for (const q of arc(prev, b, C(rf[0]), rf[1], 1.5).slice(0, -1)) { const h = `${A.key}~${++n}`; WP[h] = { id: h, p: q, hide: true }; miss.push(h); }
        mpts.push(...arc(prev, b, C(rf[0]), rf[1], 0.3)); } else mpts.push(b);
      miss.push(id);
    }
    const iaf = A.iaf, sp = A.spoken;
    FINAL[A.key] = { pts, cum, prof, elev, rnp: true, rwy: A.rwy, name, short: A.short, spoken: sp, entry: iaf, entryName: iaf, via: A.via, alt: A.legs[0][1], climbIaf: iaf === 'ELMEM',
      decNM: dec + 0.1, decMin: dec - 1.2, decName: A.visual ? 'the MAPt (WI814)' : 'minimums', minAlt: A.minima.da - 150, minText: `${A.minima.da} ft`, minRate: 0,
      mins: { vis: A.minima.vis, ceil: A.minima.dh }, da: A.minima.da, ar: A.ar, visual: !!A.visual, missPts: [...mpts],
      gates: fap != null ? [{ at: `the FAP (${A.legs.find(l => l[3] === 'FAP')[0]})`, togo: cum[fap], min: fapAlt - 200 }] : [],
      phrase: rw => `cleared ${sp} via ${iaf}`, read: rw => `cleared ${A.short} runway ${rw} via ${iaf}` };
    // the published missed approach, without the fixes a late go-around has already passed
    Object.defineProperty(FINAL[A.key], 'missed', { get: () => missAhead(miss) });
    RNP[A.key] = FINAL[A.key];
  }
})();
// the aircraft going around (set by gaEarly just before the engine reads the missed approach route)
let GA_AC = null;
function missAhead(route){
  const ac = GA_AC; if (!ac) return route.slice();
  let i = 0; while (i < route.length - 1 && Math.abs(angDiff(ac.hdg, brg(ac.x, ac.y, ...WP[route[i]].p))) > 100) i++;
  return route.slice(i);
}
// which RNP approach a clearance means. 26: E (from WI610, no special authorisation) or Z (AR, from RTT); 08: Z (AR) or
// V (RNP visual). A plain "RNP" picks the one the weather allows, the non-AR one first.
const rnpOk = (k, w) => w.vis >= FINAL[k].mins.vis && w.ceil >= FINAL[k].mins.ceil;
function rnpPick(ac, rw, v){
  if (rw === '26') return v === 'E' ? 'RNPE26' : v === 'Z' ? 'RNPZ26' : v === '*' ? (rnpOk('RNPE26', S.wx) ? 'RNPE26' : 'RNPZ26') : null;
  return v === 'Z' ? 'RNPZ08' : v === 'V' ? 'RNPV08' : v === '*' ? (rnpOk('RNPV08', S.wx) ? 'RNPV08' : 'RNPZ08') : null;
}
const rnpMinsOk = (w, rw) => rw === '08' ? rnpOk('RNPZ08', w) || rnpOk('RNPV08', w) : rnpOk('RNPZ26', w) || rnpOk('RNPE26', w);

// ═════════════════════════ schedule ═════════════════════════
const withGate = x => ({ ...x, gate: x.gate || gateFor(x.k === 'ARR' ? x.o : x.d) });
const TIMETABLE = LOWI.TIMETABLE;
const REGS = {};
const LONG_STAY = LOWI.LONG_STAY;
const EXTRA = LOWI.EXTRA.map(withGate);
const EXERCISES = Object.fromEntries(Object.entries(LOWI.EXERCISES).map(([k, e]) => ['i' + k, { ...e, sched: e.sched.map(withGate) }]));
const WX_PRESETS = LOWI.WX_PRESETS;

// ═════════════════════════ weather rules ═════════════════════════
// Föhn (AD 2.22): severe turbulence, windshear and downdraughts; worst on final 08 over the Inn. Returns knots above
// the "rough" threshold, like Gibraltar's turbulence table.
const TURB_TABLE = {};
function turbExcess(w){
  if (w.vrb || w.spd < 8) return 0;
  const g = Math.max(w.spd, (w.gust || 0)*0.85);
  return LOWI.isFoehn(w) ? Math.max(2, g - 30) : Math.max(0, g - 26);
}
const sraMinsOk = w => minsOk(w, '26');
const minsOk = (w, rw) => w.vis >= LOWI.LOC_EAST.minima.vis && w.ceil >= LOWI.LOC_EAST.minima.ceil;
// runways for a weather: land 26 unless the tailwind on 26 is over 5 kt; depart 08 unless its tailwind is over 10 kt
function rwyFor(w){
  const t26 = -windComp(w, CRS_HI).head, t08 = -windComp(w, CRS_LO).head;
  return { land: w.vrb || t26 <= 5 ? '26' : '08', dep: w.vrb || t08 <= 10 ? '08' : '26' };
}

// ═════════════════════════ terrain: surveillance minimum altitudes (chart 12-1) ═════════════════════════
// They apply to vectored flights. Aircraft on a SID, a STAR, an approach or a missed approach fly the published
// procedure (which goes far lower along the valley floor) and are not checked.
const MVA = LOWI.MVA.map(s => ({ ...s, poly: s.poly.map(LL) }));
const mvaAt = p => { let best = null; for (const s of MVA) if (inPoly(p, s.poly) && (!best || s.alt > best.alt)) best = s; return best; };
const vectored = ac => ac.mode === 'HDG' && !ac.onSid && ac.state !== 'MISSED' && ac.state !== 'AIRBORNE' && ac.state !== 'DIVERTING';
const PEAKS = LOWI.PEAKS.map(([n, la, lo, ft]) => [n, ...xy(la, lo), ft]);
const CTR = LOWI.CTR.map(LL);
function drawLowiRelief(){
  const sc = V.scale; if (sc < 3 || sc > 400) return;
  cx.save(); cx.lineWidth = 1; cx.strokeStyle = rgba('relief', .32); cx.setLineDash([3, 4]);
  for (const s of MVA) { poly(s.poly); cx.stroke(); }
  cx.setLineDash([]);
  if (sc > 5 && sc < 120) {
    cx.font = `500 10px ${FONT_D}`; cx.fillStyle = rgba('reliefTxt', .75);
    for (const s of MVA) { const c = s.poly.reduce((a, p) => [a[0] + p[0]/s.poly.length, a[1] + p[1]/s.poly.length], [0, 0]); if (inPoly(c, s.poly)) cx.fillText(String(s.alt/100), sx(c[0]) - 8, sy(c[1]) + 4); }
  }
  cx.strokeStyle = rgba('apt', .3); cx.setLineDash([6, 4]); poly(CTR); cx.stroke(); cx.setLineDash([]);
  if (sc > 8) { cx.font = `500 11px ${FONT_L}`; for (const [n, x, y, ft] of PEAKS) { const X = sx(x), Y = sy(y); cx.fillStyle = rgba('relief', .8); cx.beginPath(); cx.moveTo(X, Y - 5); cx.lineTo(X + 4, Y + 2); cx.lineTo(X - 4, Y + 2); cx.closePath(); cx.fill(); cx.fillStyle = rgba('reliefTxt', .9); cx.fillText(`${n} ${ft}`, X + 6, Y + 4); } }
  cx.restore();
}

// ═════════════════════════ aerodrome drawing (runway metres) ═════════════════════════
const AD_SITE = {
  aprons: G.APRONS, roads: [], buildings: G.BUILDINGS, twyExtra: G.TWY_EXTRA || [], shoulder: [0, RWY_M], serviceRoad: false, paag: [], floods: [],
  twyLabels: G.TWY_LABELS, hotspots: [], labels: G.LABELS
};

// ═════════════════════════ engine hooks ═════════════════════════
// LOC/DME East missed approach (non-RNP): straight ahead to D1.0 OEV, then a LEFT turn onto 060° (mag) to RUM, out
// along LOC OEJ, at D14 OEV left to RTT at 9,500 ft and hold. From the circling to 08 it is flown from present position.
function lowiGaTurn(ac){
  const MA = ['RUM', 'OEJ', 'OEJ14', 'RTT'];
  if (ac.gaRwy === RW_LO || Math.abs(angDiff(ac.hdg, 64 + VAR)) < 100) { ac.mode = 'NAV'; ac.route = missAhead(MA); ac.gaTurn = true; return; }
  if (!ac.lowiMa) {   // runway 26: on the localiser track until D1.0 OEV past the DME (or well up), then left
    if (mOf([ac.x, ac.y]) < mOf(OEV_DME) - 1852 || ac.alt > ELEV + 2500) { ac.lowiMa = 1; ac.mode = 'HDG'; ac.tgtHdg = norm(60 + VAR); ac.turnDir = -1; }
    return;
  }
  if (Math.abs(angDiff(ac.hdg, norm(60 + VAR))) < 30) { ac.lowiMa = 0; ac.mode = 'NAV'; ac.route = MA.slice(); ac.gaTurn = true; }
}
const APT = {
  arrAlt: arrAltOf(GATES.map(STAR_OF)),   // STARs (11-1): RTT 9500 and the valley entry altitudes
  // intermediate holding points (AD 2 MAP 1-1): L1 on Lima at the main taxiway, B1 on Bravo north of the apron
  ihps: [{ id: 'L1', node: 'L1', tw: 'L' }, { id: 'B1', tw: 'B', at: rm(1645, -188) }],
  icao: 'LOWI', name: 'Innsbruck', coordName: 'Innsbruck', radarName: 'INN', utcOff: 2,
  radar: [LOWI.UNITS.app.name, LOWI.UNITS.app.freq], tower: [LOWI.UNITS.twr.name, LOWI.UNITS.twr.freq],
  xing: false, drawnTown: false, ta: LOWI.TA, initClimb: 10000, gaAlt: 9500, appAlt: 9500, handoffNM: 25, climbFL: 150, divertAlt: 15000,
  area: { dep: 60, arr: 120, div: 40 }, roll: [70, RWY_M - 40], defRwy: '26', defWx: 'west',
  appName: 'LOC DME East approach', appShort: 'LOC E', minsText: 'weather below the LOC DME East minima',
  minsLong: 'Weather is below the LOC DME East minima (5 km and a 1,800 ft ceiling).',
  liveName: 'Innsbruck Airport', atisFreq: LOWI.UNITS.atis.freq, turbName: 'föhn',
  view: { app: [0, 1, 70], twr: [0, -0.05, 2.6], gnd: [1000, -60, 2300, 650] },
  minsOk,
  // two runways in use: land 26, depart 08 unless the wind says otherwise
  splitRwy: true, rwyFor,
  // RNP approaches: which one a clearance means, their minima, and what crews ask for when the LOC minima are not met
  rnp: rnpPick, rnpMinsOk,
  reqApp: rw => !minsOk(S.wx, rw) && rnpMinsOk(S.wx, rw) ? 'RNP approach' : rw === RW_LO ? 'LOC DME East, circling' : 'LOC DME East approach',
  rnpButtons: rw => rw === '08' ? [['APP 08 RNPZ', 'RNP Z 08'], ['APP 08 RNPV', 'RNP V 08']] : [['APP 26 RNPE', 'RNP E 26'], ['APP 26 RNPZ', 'RNP Z 26']],
  inboundAlt: gate => gate === 'S' || gate === 'W' ? 14000 : 11000,
  divertTo: ac => ac.gate === 'E' || ac.gate === 'NE' ? ['Salzburg', 'UNKEN'] : ['Munich', 'KOGOL'],
  firstAlt: g => (g === 'S' || g === 'W' ? 14000 : 11000) + 2000,   // the exercise's first arrival, already descending
  rolledCall: 'request taxi',
  vacExits: ac => ac.app === RW_LO ? ['A', 'B'] : ['B', 'A'],
  vacPrefs: st => S.rwy === RW_LO ? ['A', 'B'] : ['B', 'A'],
  terrain: { name: 'the mountains', poly: [], min: 0, low: 0,
    check: ac => { if (!vectored(ac)) return null; const s = mvaAt([ac.x, ac.y]); return s && ac.alt < s.alt - 100 ? s : null; },
    lowAt: s => s.alt - 2500,
    msg: (ac, s) => `${ac.cs} is being vectored at ${Math.round(ac.alt)} ft in sector ${s.name}, below the ${s.alt.toLocaleString('en-GB')} ft minimum vectoring altitude${ac.alt < s.alt - 2500 ? ': TERRAIN' : ''}.` },
  restricted: null,
  drawRelief: drawLowiRelief,
  gaEarly(ac, rw){ GA_AC = ac; ac.lowiMa = 0; },
  gaTurn: lowiGaTurn,
  // SIDs: climb on runway track, then the published route (08: east along LOC OEJ; 26: west, then the visual left turn back east)
  liftoff(ac){ ac.tgtHdg = Math.round(crsOf(ac.depRwy)); ac.turnDir = 0; },
  depTurn(ac){},
  depClear: ac => ac.alt > ELEV + 400,
  shear(ac, rw, w){ return LOWI.isFoehn(w) && rw === RW_LO && Math.random() < 0.12 ? 'downdraught over the Inn on final' : null; },
  shearWhy: rw => LOWI.isFoehn(S.wx) ? 'severe föhn turbulence on final' : 'windshear on short final',
  faceHold: (st, f) => f === 'east' ? 'B' : 'A',
  faceWord: f => f,
  taxiHolds: south => ['A', 'B'],
  taxiHint: rw => depRw() === RW_LO ? 'Runway 08 departures leave from Alpha and backtrack to the turn pad at the west end.' : 'Runway 26 departures leave from Bravo and backtrack to the turn pad at the east end.',
  // medical diversions: flights crossing the Alps over Innsbruck
  diverts: [{ cs: 'DLH1854', t: 'A320', o: 'EDDF', gate: 'N', to: 'Rome' }, { cs: 'EZY3261', t: 'A20N', o: 'EGKK', gate: 'N', to: 'Venice' },
    { cs: 'AUA511', t: 'A320', o: 'LOWW', gate: 'E', to: 'Zurich' }, { cs: 'KLM1605', t: 'B738', o: 'EHAM', gate: 'N', to: 'Rome' }],
  airports: Object.fromEntries(Object.entries(LOWI.AIRPORTS)), via: {},
  airlineIcao: LOWI.AIRLINE_ICAO, airlineType: LOWI.AIRLINE_TYPE,
  placeIcao: LOWI.PLACES,
  atisPanel(w){
    const f = LOWI.isFoehn(w), r = rwyFor(w);
    return `<div class="warnline${f ? ' bad' : ''}">Landing ${S.rwy} · departing ${depRw()}${r.land !== S.rwy || r.dep !== depRw() ? ` (wind favours ${r.land} / ${r.dep})` : ''}. ${f ? 'FÖHN: severe turbulence, windshear and downdraughts below 5,000 ft. Arrivals from the east and south overfly at 5,000 ft or above.' : 'Arrivals and departures meet head-on in the valley: separate them.'}</div>`;
  },
  atisLines({ w, L, E, wind, vis, cloud }){
    const out = [
      `This is Innsbruck information ${L}, time ${zt(S.t).slice(0,5).replace(':', '')}.`,
      !minsOk(w, S.rwy) && rnpMinsOk(w, S.rwy) ? `Expect RNP approach runway ${S.rwy}.`
        : S.rwy === RW_HI ? 'Expect LOC DME East approach runway 26.' : 'Expect LOC DME East approach, circling runway 08, or RNP approach runway 08.',
      `Landing runway ${S.rwy}, departure runway ${depRw()}.`,
      `Surface wind ${wind}. Visibility ${vis}. ${cloud}.`,
      `Temperature ${w.temp}, dew point ${w.dew}. QNH ${w.qnh} hectopascals. Transition level by ATC.`
    ];
    if (LOWI.isFoehn(w)) out.push('Föhn. Severe turbulence, windshear and downdraughts reported. Arrivals from east and south, overfly the aerodrome at or above 5,000 feet.');
    else if (turbExcess(w) > 0) out.push('Moderate turbulence and windshear on final.');
    if (E && E.ws) out.push(`Windshear reported on final runway ${E.ws.rw} at ${zt(E.ws.t).slice(0,5).replace(':', '')}, ${E.ws.text}.`);
    if (E && E.rwyBlock) out.push(`Runway closed: ${E.rwyBlock.why}. Expect delays.`);
    if (!minsOk(w, S.rwy)) out.push(rnpMinsOk(w, S.rwy) ? 'Weather below the LOC DME East minima.' : 'Weather below the LOC DME East and RNP minima.');
    out.push('Departures: release from Wien, München or Padova is required before take-off.');
    out.push(`Acknowledge receipt of information ${L} and advise aircraft type on first contact.`);
    return out;
  },
  // the website: home hero, previews and Academy figures
  site: {
    hero: () => [
      ['AUA903', 47.42, 11.95, 235, 250, PAL.light.arr], ['KLM1993', 47.33, 11.75, 258, 200, PAL.light.arr], ['EZY8341', 47.29, 10.62, 95, 240, PAL.light.arr],
      ['EWG7943', 47.29, 11.52, 65, 220, PAL.light.dep], ['AUA902', 47.36, 11.80, 62, 250, PAL.light.dep],
      ['DLH9LK', 47.60, 11.10, 160, 440, 'rgba(60,75,95,.7)'], ['EZY52TR', 47.05, 11.60, 330, 430, 'rgba(60,75,95,.7)'], ['SWR1KM', 47.45, 10.70, 100, 420, 'rgba(60,75,95,.7)']
    ],
    figHold: 'RTT', emergHp: 'A',
    figConsole: v => { v.scale *= 1.15; v.cx += 4; },
    cmdHint: 'Command, e.g. KLM1993 A95 APP · AUA904 TAXI A · / to focus, Tab cycles flights',
  // preview traffic for the briefing thumbnails: parked, taxiing to Alpha, on final 26, climbing out east
  demo(mk, park){
    const F = FINAL['26'], fin = add(T_HI, CRS_LO, 0.75), out = add(T_HI, CRS_LO, 6), twy = GN[HOLDS.A.node].p, inb = add(WP.RTT.p, 240, 3);
    const ids = STANDS.slice(0, 4).map(s => s.id);
    return [
      mk('AUA904', 'E195', 'DEP', park(ids[0], { need: null, reqAt: 99999 })), mk('EWG7943', 'A319', 'DEP', park(ids[1], { need: null, reqAt: 99999 })),
      mk('TOM3403', 'B738', 'DEP', park(ids[2], { need: null, reqAt: 99999 })), mk('OEFIT', 'C56X', 'DEP', park(ids[3], { need: null, reqAt: 99999 })),
      mk('EZY8342', 'A319', 'DEP', { ground: true, state: 'TAXI', hp: 'A', x: twy[0], y: twy[1], hdg: CRS_HI, gs: 12 }),
      mk('KLM1993', 'E195', 'ARR', { state: 'FINAL', mode: 'FINAL', app: '26', freq: 'TWR', x: fin[0], y: fin[1], hdg: LOC_IN, alt: THR_ELEV['26'] + 320, gs: 140, vs: -900, o: 'EHAM' }),
      mk('AUA902', 'DH8D', 'DEP', { state: 'CLIMB', x: out[0], y: out[1] + 0.6, hdg: 70, alt: 6500, gs: 200, vs: 1800, tgtAlt: 10000, d: 'LOWW' }),
      mk('BAW588', 'A320', 'ARR', { state: 'INBOUND', x: inb[0], y: inb[1], hdg: 230, alt: 11000, gs: 250, vs: -1000, tgtAlt: 9500, o: 'EGLL' })
    ];
  },
  // thumbnail framing: the valley (app), the runway and short final 26 (twr), the apron (gnd)
  thumb(k, zoom, W){
    const mid = rm(RWY_M/2, -60), apron = STANDS.reduce((a, s) => [a[0] + s.p[0]/STANDS.length, a[1] + s.p[1]/STANDS.length], [0, 0]);
    if (k === 'app') return v => { v.scale *= 1.2; };
    if (zoom === 'apron') return v => { v.cx = apron[0]; v.cy = apron[1]; v.scale = 1852*0.9; };
    if (k === 'gnd') return v => { v.cx = mid[0]; v.cy = mid[1]; v.scale = W/2400*1852; };
    if (k === 'twr') return v => { const c = rm(RWY_M*0.75, -120); v.cx = c[0] + 0.15; v.cy = c[1] + 0.05; v.scale = W/1.7; };
    return null;
  }
  }
};
