// ═════════════════════════ Belfast (EGAA + EGAC) airport profile for the engine ═════════════════════════
// Builds every global the engine reads from the chart data in egaa.js (EGAA: Belfast International and Belfast City together)
// and the OpenStreetMap aerodromes in egaa-ground.js (metres east and north of the Aldergrove ARP; City is in the same frame,
// 22 km to the east-south-east). One session works both airfields, as Aldergrove Approach and Belfast Approach do in life: a
// shared approach, then two towers. Three runways: 07/25 and 17/35 at Aldergrove and 04/22 at City. S.rwy names the flow (25
// or 07): in the west flow Aldergrove lands and departs on 25 and City on 22, in the east flow 07 and 04. Each aircraft gets
// its own runway (APT.landRwyOf, APT.depRwyOf) by the airfield it belongs to (isCity). 17/35 is drawn and used by taxiing
// traffic only.
Object.assign(TYPES, EGAA.TYPES);
const LL = p => xy(p[0], p[1]);
const G = EGAA_GROUND;
const EN = (e, n) => [e*M2NM, n*M2NM];                     // metres east and north of the Aldergrove ARP (the map origin) → NM

// ═════════════════════════ runways ═════════════════════════
// a frame along each runway: m from the pavement end a (the low-numbered end), off to the left
function rwyFrame(r){
  const a = EN(...r.a), b = EN(...r.b), L = dist(...a, ...b), RU = [(b[0]-a[0])/L, (b[1]-a[1])/L], RN = [-RU[1], RU[0]];
  const rm = (m, off=0) => [a[0] + (RU[0]*m + RN[0]*off)*M2NM, a[1] + (RU[1]*m + RN[1]*off)*M2NM];
  const mOf = p => ((p[0]-a[0])*RU[0] + (p[1]-a[1])*RU[1])/M2NM, offOf = p => ((p[0]-a[0])*RN[0] + (p[1]-a[1])*RN[1])/M2NM;
  const len = r.len, ms = G.rnodes.filter(([id]) => Object.values(G.holds).some(h => h[1] === id && h[2] === r.id)).map(([, e, n]) => mOf(EN(e, n)));
  const m0 = Math.min(0, ...ms.map(m => m - 40)), m1 = Math.max(len, ...ms.map(m => m + 40));
  // no turning pads: departures enter at the runway ends or from a holding point and line up straight
  const TURN_W = [[30, 0]], TURN_E = [[len - 30, 0]];
  return { id: r.id, ap: r.ap, lo: r.lo, hi: r.hi, len, m0, m1, thr: r.thr, elev: r.elev, rm, mOf, offOf, RU, TURN_W, TURN_E, TURN_END: { W: 30, E: len - 30 },
    roll: [70, len - 70], ends: true, width: 46 };
}
const RWY_LIST = ['0725', '1735', '0422'].map(id => rwyFrame(G.runways.find(r => r.id === id)));
const R0 = RWY_LIST[0];
const rm = R0.rm, mOf = R0.mOf, offOf = R0.offOf, RU = R0.RU;
const RWY_M = R0.len, THR_LO_M = R0.thr['07'], THR_HI_M = R0.thr['25'];
const RW_LO = '07', RW_HI = '25';
const THR = {}, CRS = {}, THR_ELEV = {};
for (const R of RWY_LIST) {
  THR[R.lo] = R.rm(R.thr[R.lo], 0); THR[R.hi] = R.rm(R.thr[R.hi], 0);
  CRS[R.lo] = brg(...R.rm(0), ...R.rm(R.len)); CRS[R.hi] = norm(CRS[R.lo] + 180);
  THR_ELEV[R.lo] = R.elev[R.lo]; THR_ELEV[R.hi] = R.elev[R.hi];
}
const T_LO = THR[RW_LO], T_HI = THR[RW_HI], CRS_LO = CRS[RW_LO], CRS_HI = CRS[RW_HI];
const crsOf = rw => CRS[rw] ?? CRS_HI;
const ELEV = EGAA.airfields.EGAA.elev;
const ARP = LL(EGAA.airfields.EGAA.arp);
const CITY_ARP = LL(EGAA.airfields.EGAC.arp);
// no road crossing, no border fence, no rock
const XING_M = -1e9, XING_SKEW = 0, XING_HW = 0, xingM = o => XING_M;
const FRONTIER = [], R164 = [], ROCK = [], ROCK_TOP = [0, 0];
const TURN_W = R0.TURN_W, TURN_E = R0.TURN_E, TURN_END = R0.TURN_END, TURN_PAD = {};
const RWYS_BY_END = rw => RWY_LIST.find(R => R.lo === rw || R.hi === rw) || R0;

// ═════════════════════════ the two airfields and the flows ═════════════════════════
// Aldergrove: 25 (Cat III ILS) or 07 (RNP); City: 22 (ILS) or 04 (ILS). The flow is named by Aldergrove's landing runway.
const CFG = {
  west: { name: 'West flow', land: { EGAA: '25', EGAC: '22' }, dep: { EGAA: '25', EGAC: '22' } },
  east: { name: 'East flow', land: { EGAA: '07', EGAC: '04' }, dep: { EGAA: '07', EGAC: '04' } }
};
const configOf = rw => ['07', '04', '17'].includes(rw) ? 'east' : 'west';
const cfgNow = () => configOf(S.rwy);
const CITY = new Set();                                    // the callsigns that belong to Belfast City
for (const r of EGAA.TIMETABLE) if (r[9] === 'C') { if (r[0]) CITY.add(r[0]); if (r[3]) CITY.add(r[3]); }
for (const e of EGAA.EXTRA) if (e.ap === 'EGAC') CITY.add(e.cs);
for (const x of Object.values(EGAA.EXERCISES)) for (const s of x.sched) if (s.ap === 'EGAC') CITY.add(s.cs);
for (const d of [{ cs: 'EIN106' }]) void d;
const isCity = ac => !!ac && (CITY.has(ac.cs) || ac.ap === 'EGAC' || (ac.stand && ac.stand.term === 'C') || (ac.hp && HOLDS[ac.hp] && HOLDS[ac.hp].on === '0422'));
const apOf = ac => isCity(ac) ? 'EGAC' : 'EGAA';
// each airfield has its own runway in use: Aldergrove's is S.rwy (25 or 07), City's is S.rwyC (22 or 04); the two are
// chosen separately (the pickers in the ATIS panel) and start from the same flow. Take-offs and landings share a runway.
const cityRw = () => S.rwyC || CFG[cfgNow()].land.EGAC;
const alderRw = () => S.rwy;
const landOf = ac => apOf(ac) === 'EGAC' ? cityRw() : alderRw();
const depOf = landOf;
const bothRwys = () => [alderRw(), cityRw()];

// ═════════════════════════ taxiways, holding points, stands (egaa-ground.js) ═════════════════════════
const inF0 = (e, n) => { const p = EN(e, n); return [mOf(p), offOf(p)]; };
for (const [id, e, n] of G.nodes) gn(id, ...inF0(e, n));
for (const [id, e, n] of G.rnodes) gn(id, ...inF0(e, n));
for (const [a, b, tw, mid] of G.edges) chain(a, mid.map(([e, n]) => inF0(e, n)), b, tw);
const HOLDS = {}, FIL = {};
for (const [k, [node, rwy, on, m, off, dirs, end, tw]] of Object.entries(G.holds)) {
  HOLDS[k] = { node, rwy, on, m, off, dirs: dirs.split(','), end: end || null, ref: k.replace(/~\d+$/, '').replace(/@C$/, ''), tw, city: /@C/.test(k) };
  const Rh = RWY_LIST.find(R => R.id === on) || R0;            // hlink is m/off in its own runway's frame: carry it into R0's
  chain(rwy, (G.hlink[k] || []).map(([m, o]) => { const p = Rh.rm(m, o); return [mOf(p), offOf(p)]; }), node, HOLDS[k].ref);
  FIL[k] = { W: G.fil[k], E: G.fil[k] };
}
for (const [id, rid] of Object.entries(G.hs)) if (GN[id]) GN[id].p.hs = rid;
// stands: Aldergrove's apron stands by the terminal (M) and City's 1 to 10, 21 and 24 (C1... here)
const STANDS = G.gates.map(([id, term, [e, n], node, hdg, line, out]) => { const p = EN(e, n);
  return { id, term, p, m: mOf(p), off: offOf(p), node, area: 'civil', occ: null, noLead: !line, h0: hdg, line: line ? line.map(([e, n]) => EN(e, n)) : null,
    ...(out ? { out: { node: out[0], pts: out[1].map(([e, n]) => EN(e, n)) } } : {}) }; });
STANDS.forEach(s => { s.lp = GN[s.node].p; s.hdg = s.h0 ?? brg(...s.lp, ...s.p); });
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
const TERM_NAME = { M: 'Aldergrove apron', C: 'City apron' };
// which side of each runway its exits are on (the side the taxiway system is)
for (const R of RWY_LIST) { const o = Object.values(HOLDS).filter(H => H.on === R.id && !H.end).reduce((a, H) => a + Math.sign(H.off), 0); R.side = o >= 0 ? 1 : -1; }

const NATO = { A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike',
  N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu' };
const twyWords = t => (t.replace(/~\d+$/, '').replace(/@C$/, '').match(/[A-Z]|\d+/g) || [t]).map(x => NATO[x] || x).join(' ');
const PHON = {};
for (const e of GE) if (e.tw && e.tw !== 'APRON' && !PHON[e.tw]) PHON[e.tw] = twyWords(e.tw);
for (const k of Object.keys(HOLDS)) PHON[k] = twyWords(k);
for (const [id] of G.ihps) PHON[id] = twyWords(id);
PHON.APRON = 'the apron';

// ── departure entries: a holding point at the departure end of the runway (the nearest by taxi route), or the one the aircraft
// is already at
const endHolds = rw => Object.keys(HOLDS).filter(k => HOLDS[k].end === rw && HOLDS[k].dirs.includes(rw));
const nearHolds = rw => { const R = RWYS_BY_END(rw); return Object.keys(HOLDS).filter(k => HOLDS[k].on === R.id && HOLDS[k].dirs.includes(rw)); };
const routeLen = (from, to) => { const r = route(from, to); return r ? pathLen(r.nodes) : Infinity; };
const fromNode = ac => ac.stand && !ac.leftStand ? ac.stand.node : (nearestNode([ac.x, ac.y], n => !/^[A-Za-z]*R\d/.test(n.id)) || {}).id;
function depRwyOf(ac){
  if (ac.cto && ac.depRwy) return ac.depRwy;
  if (ac.hp && HOLDS[ac.hp]) { const R = RWY_LIST.find(R => R.id === HOLDS[ac.hp].on); if (R && ac.depRwy && RWYS_BY_END(ac.depRwy) === R) return ac.depRwy; }
  return depOf(ac);
}
const landRwyOf = ac => landOf(ac);
function depHold(ac){
  const rw = depRw(ac), from = fromNode(ac), ks = endHolds(rw).length ? endHolds(rw) : nearHolds(rw);
  if (!ks.length || !from) return ks[0];
  if (ks.length < 2) return ks[0];
  const rs = routesFrom(from, ks.map(k => HOLDS[k].node)); let best = ks[0], bl = Infinity;
  ks.forEach((k, i) => { const r = rs[i], L = r ? pathLen(r.nodes) : Infinity; if (L < bl) { bl = L; best = k; } });
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
  const E = len('east'), W = len('west');
  if (E < Infinity || W < Infinity) return E <= W ? 'east' : 'west';
  const r = route(st.node, to);
  if (!r || r.nodes.length < 2) return 'east';
  const b = brg(...st.lp, ...GN[r.nodes[1]].p), off = f => Math.abs(angDiff(norm(laneDir(st, f) + 180), b));
  return off('east') <= off('west') ? 'east' : 'west';
}
// exits for the landing runway: those the roll-out direction can turn into, on the apron side first, in the order met
function exitsFor(rw){
  const R = RWYS_BY_END(rw), up = rw === R.lo, thr = R.thr[rw];
  const ks = Object.keys(HOLDS).filter(k => { const H = HOLDS[k]; return H.on === R.id && H.dirs.includes(rw) && (up ? H.m > thr + 350 : H.m < thr - 350); });
  const near = ks.filter(k => Math.sign(HOLDS[k].off) === R.side), far = ks.filter(k => Math.sign(HOLDS[k].off) !== R.side);
  const order = a => a.sort((x, y) => (HOLDS[x].m - HOLDS[y].m)*(up ? 1 : -1));
  return [...order(near), ...order(far)];
}
function exitFor(ac, name){
  if (HOLDS[name]) return name;
  const rw = ac.app || landOf(ac), R = RWYS_BY_END(rw), m = R.mOf([ac.x, ac.y]), dir = rw === R.lo ? 1 : -1;
  const ks = Object.keys(HOLDS).filter(k => HOLDS[k].on === R.id && (HOLDS[k].ref === name || HOLDS[k].tw === name) && (HOLDS[k].m - m)*dir > 20);
  return ks.sort((a, b) => (Math.sign(HOLDS[b].off) === R.side) - (Math.sign(HOLDS[a].off) === R.side) || (HOLDS[a].m - HOLDS[b].m)*dir)[0] || null;
}

// ═════════════════════════ aerodrome drawing ═════════════════════════
const AD_SITE = { pave: { w: 23 }, aprons: APRONS, roads: [], buildings: [], twyExtra: [], shoulder: [0, RWY_M], serviceRoad: false, paag: [], floods: [], twyLabels: [], hotspots: [], labels: [] };
const HOTSPOTS = [['HS1', LL([54 + 39/60 + 28.5/3600, -(6 + 13/60 + 39/3600)])], ['HS2', LL([54 + 39/60 + 19/3600, -(6 + 13/60 + 29/3600)])]];   // AD 2-EGAA-2-1: hold-to-runway distance at D2; the 17/07 intersection
const TERM_LABELS = (() => { const by = {}; for (const s of STANDS) (by[s.term] ||= []).push(s.p); return Object.entries(by).map(([t, ps]) => [TERM_NAME[t].toUpperCase(), ps.reduce((a, p) => [a[0] + p[0]/ps.length, a[1] + p[1]/ps.length], [0, 0]).map(v => v - 0)]); })();
function drawBelfast(){
  const sc = V.scale, mpx = sc/1852, IMG = mapImagery();
  const P2 = p => [sx(p[0]), sy(p[1])];
  const pathP = (pts, close = true) => { cx.beginPath(); pts.forEach((p, i) => cx[i ? 'lineTo' : 'moveTo'](...P2(p))); if (close) cx.closePath(); };
  const lw = m => Math.max(1, m*mpx);
  const rwyPoly = (R, w) => [R.rm(0, -w/2), R.rm(R.len, -w/2), R.rm(R.len, w/2), R.rm(0, w/2)];
  if (sc <= 70) { cx.fillStyle = rgba('rwyOut', .9); for (const R of RWY_LIST) { pathP(rwyPoly(R, Math.max(R.width, 2.2/mpx))); cx.fill(); } return; }
  cx.lineJoin = 'round'; cx.lineCap = 'round';
  if (!IMG) {
    cx.fillStyle = C.concrete; for (const a of APRONS) { pathP(a.map(([m, o]) => rm(m, o))); cx.fill(); }
    cx.strokeStyle = C.concrete; cx.lineWidth = lw(60);
    for (const e of GE) { if (e.tw !== 'APRON') continue; pathP([GN[e.a].p, GN[e.b].p], false); cx.stroke(); }
    cx.lineWidth = lw(44); for (const s of STANDS) { pathP(s.line || [s.lp, s.p], false); cx.stroke(); }
    cx.strokeStyle = C.asphalt;
    cx.lineWidth = lw(23);
    for (const e of GE) { if (e.tw === 'APRON') continue; pathP([GN[e.a].p, GN[e.b].p], false); cx.stroke(); }
    for (const k in FIL) { const R = RWYS_BY_END(HOLDS[k] ? HOLDS[k].dirs[0] || HOLDS[k].on : '25'); const Rr = RWY_LIST.find(r => r.id === HOLDS[k].on) || R0; pathP(FIL[k].W.map(([m, o]) => Rr.rm(m, o)), false); cx.stroke(); }
  } else {
    const lines = GE.filter(e => e.tw !== 'APRON').map(e => ({ pts: [P2(GN[e.a].p), P2(GN[e.b].p)], w: paveWidth(e.tw) }));
    for (const k in FIL) { const Rr = RWY_LIST.find(r => r.id === HOLDS[k].on) || R0; lines.push({ pts: FIL[k].W.map(([m, o]) => P2(Rr.rm(m, o))), w: paveWidth() }); }
    drawPavement(lines, G.buildings.map(b => b.pts.map(([e, n]) => P2(EN(e, n)))), mpx);
  }
  cx.fillStyle = C.rwy; for (const R of RWY_LIST) { pathP(rwyPoly(R, R.width)); cx.fill(); }
  if (!IMG) { cx.fillStyle = C.bld; cx.strokeStyle = C.bldEdge; cx.lineWidth = 1; for (const b of G.buildings) { pathP(b.pts.map(([e, n]) => EN(e, n))); cx.fill(); cx.stroke(); } }
  if (sc > 150) {
    cx.fillStyle = C.paint; cx.strokeStyle = C.paint;
    for (const R of RWY_LIST) {
      const hw = R.width/2 - 1.5, quad = (m1, o1, m2, o2) => { pathP([R.rm(m1, o1), R.rm(m2, o1), R.rm(m2, o2), R.rm(m1, o2)]); cx.fill(); };
      cx.lineWidth = lw(0.9); pathP([R.rm(0, hw), R.rm(R.len, hw)], false); cx.stroke(); pathP([R.rm(0, -hw), R.rm(R.len, -hw)], false); cx.stroke();
      cx.setLineDash([30*mpx, 20*mpx]); pathP([R.rm(R.thr[R.lo] + 100, 0), R.rm(R.thr[R.hi] - 100, 0)], false); cx.stroke(); cx.setLineDash([]);
      for (const [m0, dir] of [[R.thr[R.lo], 1], [R.thr[R.hi], -1]]) {
        quad(m0, -hw, m0 + dir*3, hw);
        for (let i = 0; i < 6; i++) for (const k of [-1, 1]) { const o = k*(3 + i*(hw - 3)/6); quad(m0 + dir*6, o, m0 + dir*36, o + k*1.8); }
        for (const k of [-1, 1]) quad(m0 + dir*400, k*9, m0 + dir*460, k*19);
        for (const [d, n] of [[150, 3], [300, 3], [600, 2], [750, 2], [900, 1]]) for (const k of [-1, 1]) for (let j = 0; j < n; j++) {
          const o = k*(9 + j*3.3); quad(m0 + dir*d, o, m0 + dir*(d + 22.5), o + k*1.8); }
      }
      for (const [rw, m0] of [[R.lo, R.thr[R.lo] + 60], [R.hi, R.thr[R.hi] - 60]]) drawRwyDesignator(...P2(R.rm(m0, 0)), rw, crsOf(rw), Math.max(9, 16*mpx));
    }
    { const seen = new Set(), leads = []; for (const k in FIL) { const f = FIL[k].W, key = JSON.stringify(f); if (seen.has(key)) continue; seen.add(key);
      const Rr = RWY_LIST.find(r => r.id === HOLDS[k].on) || R0; leads.push(leadLine(f).map(p => P2(Rr.rm(...p)))); }
      groundLines(lw(0.35), () => leads.forEach(strokeSmooth)); }
    paintEdgeLines(lw(0.35));
    cx.strokeStyle = C.yellow;
    for (const [id, [u, v]] of Object.entries(HOLD_AXIS)) {
      const n = GN[id]; if (!n) continue; const at = (a, b) => [n.p[0] + (v*a + u*b)*M2NM, n.p[1] + (-u*a + v*b)*M2NM];
      for (const [d, dash] of [[-0.9, false], [-0.3, false], [0.3, true], [0.9, true]]) { cx.setLineDash(dash ? [mpx + 1, mpx + 1] : []); pathP([at(-11, d), at(11, d)], false); cx.stroke(); }
      cx.setLineDash([]);
    }
    groundLines(lw(0.3), () => { for (const s of STANDS) if (!s.noLead) { pathP(s.line || [s.lp, s.p], false); cx.stroke(); } });
    if (IMG) { cx.save(); clipOut(G.buildings.map(b => b.pts.map(([e, n]) => P2(EN(e, n))))); drawStandDetail(null, null, mpx); cx.restore(); }
    else if (sc > 600) { cx.fillStyle = rgba('lab', .8); cx.font = `600 ${Math.max(9, 4*mpx)}px ${FONT_L}`; for (const s of STANDS) { const [X, Y] = P2(s.p); cx.fillText(s.id, X + 3, Y - 3); } }
    drawGroundSigns();
    cx.font = `600 11px ${FONT_L}`;
    for (const [t, p] of HOTSPOTS) { const [X, Y] = P2(p); cx.strokeStyle = rgba('hot', .85); cx.lineWidth = 1.2; cx.beginPath(); cx.arc(X, Y, 45*mpx + 6, 0, 7); cx.stroke(); cx.fillStyle = rgba('hot', .95); cx.fillText(t, X + 45*mpx + 9, Y + 4); }
  }
}
function drawBelfastTop(){
  const sc = V.scale, mpx = sc/1852, IMG = mapImagery();
  const P2 = p => [sx(p[0]), sy(p[1])];
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
// each holding position's axis (the unit vector along the taxiway towards the runway)
const HOLD_AXIS = {};
for (const [k, H] of Object.entries(HOLDS)) {
  if (HOLD_AXIS[H.node] || !GN[H.node]) continue;
  const Rh = RWY_LIST.find(R => R.id === H.on) || R0;
  const p = GN[H.node].p, hl = G.hlink[k] || [], q = hl.length ? Rh.rm(...hl[hl.length - 1]) : GN[H.rwy].p, L = dist(...p, ...q) || 1;
  HOLD_AXIS[H.node] = [(q[0] - p[0])/L, (q[1] - p[1])/L];
}

// ═════════════════════════ fixes, arrival routes, SIDs ═════════════════════════
const APPROX = new Set(Object.keys(EGAA.NAV).filter(k => EGAA.NAV[k].approx));
const ROUTE_FIXES = new Set(Object.values(EGAA.STARS).flatMap(s => s.pts.map(p => p[0])).concat(Object.values(EGAA.SIDS).flatMap(s => s.pts.map(p => p[0]))));
const HIDDEN = id => /^(T\d\d|X\d\d[LR]|\d\d[LR][AB]|INT\d\d[S]?|S25BA)$/.test(id);
for (const [id, p] of Object.entries(EGAA.FIX)) if (!EGAA.NAV[id]) wp(id, p[0], p[1], HIDDEN(id) ? { hide: true } : ROUTE_FIXES.has(id) ? {} : { minor: true });
for (const [id, n] of Object.entries(EGAA.NAV)) wp(id, ...n.p, { note: `${n.name} ${n.freq}${n.approx ? ' (position approximate)' : ''}` });
const RADAR_REF = ARP;
const GATES = Object.keys(EGAA.DIR);
// the holds: BEL, HB (the ILS 04/22 hold) and MAGEE
for (const [id, h] of Object.entries(EGAA.HOLDS_AIR)) if (WP[id]) WP[id].hold = { inb: Math.round(h.inb), min: h.min, left: h.turn === 'L' };
const ENTRY = Object.fromEntries(GATES.map(g => [g, WP[EGAA.DIR[g].gate].p]));
const ENTRY_ALT = { NE: 10000, SE: 10000, S: 9000, W: 11000 };
const PRE_ALT = { NE: 14000, SE: 14000, S: 13000, W: 15000 };

// ── approaches: ILS 25 (I-AG), ILS 22 (I-BFH), ILS 04 (I-HBD) and the RNP 07; the localiser from 3 NM outside the intercept fix
const IFX = { '25': 'INT25', '22': 'INT22', '04': 'INT04', '07': 'AA07I' };
const IF_ALT = { '25': 4000, '22': 2800, '04': 3000, '07': 2500 };
const MISSED = { '25': ['BEL', 3000, 1], '07': ['BEL', 3000, 1], '22': ['HB', 3000, -1], '04': ['HB', 3000, -1] };
const FINAL = {};
for (const rw of ['25', '07', '22', '04']) {
  const rnp = rw === '07', thr = THR[rw], out = norm(crsOf(rw) + 180), dIF = dist(...thr, ...WP[IFX[rw]].p), elev = THR_ELEV[rw], ifAlt = IF_ALT[rw], city = rw === '22' || rw === '04';
  const F = { pts: [add(thr, out, dIF + 3), add(thr, out, dIF), thr], alts: [ifAlt, ifAlt, elev + 50], elev, entry: IFX[rw], entryName: IFX[rw], name: (rnp ? 'RNP ' : 'ILS ') + rw, alt: ifAlt,
    decName: 'four miles', decNM: 4, decMin: 2.6, minAlt: 1250, minText: '1,250 ft',
    mins: rnp ? { vis: 800, ceil: 250 } : { vis: 550, ceil: 200 }, minRate: 300, missed: [MISSED[rw][0]], missAlt: MISSED[rw][1],
    phrase: r => `cleared ${rnp ? 'RNP' : 'ILS'} approach runway ${r}`, read: r => `cleared ${rnp ? 'RNP' : 'ILS'} ${r}`,
    decCall: r => `${apTower(city)[0]}, four miles, ${rnp ? 'RNP' : 'ILS'} runway ${r}`, decNeed: 'Four miles, needs landing clearance', decFail: 'not visual at the decision altitude' };
  F.cum = new Array(F.pts.length).fill(0); for (let i = F.pts.length - 2; i >= 0; i--) F.cum[i] = F.cum[i+1] + dist(...F.pts[i], ...F.pts[i+1]);
  const meet = (ifAlt - elev - 50)/318;                    // 3° = 318 ft per NM
  F.prof = [[0, elev + 50], [meet, ifAlt], [F.cum[0] + 1, ifAlt]];
  FINAL[rw] = F;
}
function apTower(city){ const U = EGAA.UNITS[city ? 'EGAC' : 'EGAA']; return [U.twr.name, U.twr.freq]; }
const ARR_ROUTE = Object.fromEntries(GATES.map(g => [g, Object.fromEntries(['25', '07', '22', '04'].map(rw => {
  const st = EGAA.STARS[`${g} ${rw}`], ids = st.pts.map(p => p[0]);
  return [rw, ids[ids.length - 1] === IFX[rw] ? ids : [...ids, IFX[rw]]];
}))]));
const FEED_ALT = {};
const HOLD_AT = Object.fromEntries(GATES.map(g => [g, 'BEL']));
const STAR_LIST = Object.values(EGAA.STARS);
const STAR_OF = g => EGAA.STARS[`${g} ${landOf({ cs: '' })}`] || STAR_LIST[0];

// ── departures: no SIDs. The airway route with the tactical initial climb: straight ahead to the turn point, then the route.
const sidDirOf = g => (EGAA.DIR[g] || EGAA.DIR.SE).dep === 'SE' ? 'SE_H' : (EGAA.DIR[g] || EGAA.DIR.SE).dep;
// south-east departures take L10 high (FL90+, via PEPOD) or low (FL70 and below, via RINGA-SLYDA): turboprops and short sectors go low
const CITY_ALT_ELEV = EGAA.airfields.EGAC.elev;
const nmTo = ll => { const r = Math.PI/180, a = EGAA.airfields.EGAA.arp, p = a, dl = (ll[1] - p[1])*r*Math.cos(p[0]*r), dp = (ll[0] - p[0])*r; return Math.hypot(dl, dp)*3440.07; };
const lowSE = ac => !!ac && ((ac.perf && ac.perf.cruise && ac.perf.cruise < 330) || (AP[ac.d] && nmTo(AP[ac.d]) < 170));
const sidName = (gate, rwy, ac) => { const d = sidDirOf(gate); return `${rwy || depRw()} ${d === 'SE_H' && lowSE(ac) ? 'SE_L' : d}`; };
const sidSpoken = n => (EGAA.SIDS[n] || {}).spoken || n;
const sidTopOf = n => 6000;
const exitRoute = (g, rwy, ac) => (EGAA.SIDS[sidName(g, rwy, ac)] || { pts: [] }).pts.map(p => p[0]);
const EXIT_ROUTE = {}, EXIT_FIX = {};
for (const g of GATES) {
  Object.defineProperty(EXIT_ROUTE, g, { enumerable: true, get: () => exitRoute(g, depRw()) });
  Object.defineProperty(EXIT_FIX, g, { enumerable: true, get: () => { const r = exitRoute(g, depRw()); return r[r.length - 1]; } });
}
const NEXT_UNIT = Object.fromEntries(GATES.map(g => [g, [EGAA.DIR[g].ctr === 'lon' ? 'London Control' : 'Scottish Control', EGAA.DIR[g].ctr === 'lon' ? '135.575' : '132.755']]));
const relUnit = ac => isCity(ac) ? 'Aldergrove Radar' : 'Aldergrove Approach';
const TEL = EGAA.TEL;
const isMil = ac => false;
const gateFor = ap => EGAA.PLACE_DIR[ap] || 'SE';

// ═════════════════════════ schedule ═════════════════════════
const withGate = x => ({ ...x, gate: x.gate || gateFor(x.k === 'ARR' ? x.o : x.d) });
const TIMETABLE = EGAA.TIMETABLE;
const REGS = {};
const LONG_STAY = EGAA.LONG_STAY;
const EXTRA = EGAA.EXTRA.map(withGate);
const EXERCISES = Object.fromEntries(Object.entries(EGAA.EXERCISES).map(([k, e]) => ['f' + k, { ...e, sched: e.sched.map(withGate) }]));
const WX_PRESETS = EGAA.WX_PRESETS;

// ═════════════════════════ weather rules ═════════════════════════
const TURB_TABLE = {};
function turbExcess(w){ if (w.vrb || w.spd < 15) return 0; return Math.max(0, Math.max(w.spd, (w.gust || 0)*0.85) - 25); }
const minsOk = (w, rw) => { const rnp = rw === '07'; return w.vis >= (rnp ? 800 : 550) && w.ceil >= (rnp ? 250 : 200); };
const sraMinsOk = w => minsOk(w, '25');

// ═════════════════════════ engine hooks ═════════════════════════
const termOf = ac => isCity(ac) ? 'C' : 'M';
function standAt(ac, t){
  const free = STANDS.filter(s => standFree(s, ac) && s.term === t).sort((a, b) => (a.maxSpan || 80) - (b.maxSpan || 80));
  const best = free.filter(s => (s.maxSpan || 80) <= (free[0] && free[0].maxSpan || 80) + 12);
  return best[Math.floor(Math.random()*best.length)] || null;
}
const flowText = c => `Aldergrove ${alderRw()} and City ${cityRw()}`;
const UN = EGAA.UNITS;
const APT = {
  arrAlt: { ...arrAltOf(STAR_LIST), ...FEED_ALT },
  icao: 'EGAA', icaoAlt: 'EGAC', name: 'Belfast', coordName: 'Belfast', radarName: 'BFS', utcOff: 0, tz: 'Europe/London',
  radar: [UN.EGAA.app.name, UN.EGAA.app.freq], depRadar: [UN.EGAA.app.name, UN.EGAA.app.freq],
  tower: [UN.EGAA.twr.name, UN.EGAA.twr.freq], gnd: ['Aldergrove Ground', '121.755'],
  runways: RWY_LIST, bigGround: true, rwyHalfWidth: 23,
  ihps: G.ihps.map(([id, node]) => ({ id, node })),
  xing: false, drawnTown: false, ta: EGAA.TA, initClimb: 6000, gaAlt: 3000, appAlt: 2500, handoffNM: 12, climbFL: 150, divertAlt: 7000,
  area: { dep: 45, arr: 80, div: 45 }, roll: [70, RWY_M - 70], defRwy: '25', defWx: 'west',
  appName: 'ILS approach', appShort: 'ILS', minsText: 'weather below the approach minima', reqApp: rw => rw === '07' ? 'RNP approach' : 'ILS approach',
  minsLong: 'Weather is below the approach minima (ILS CAT I: 200 ft and RVR 550 m; the RNP 07: 250 ft).',
  markCity: cs => CITY.add(cs),
  holdOk: (ac, id) => isCity(ac) ? (id === 'MAGEE' || id === 'HB') : id === 'BEL',
  liveName: 'Belfast Airport', liveThin: 22, atisFreq: UN.EGAA.atis.freq, turbName: 'Belfast',
  sessionHours: Array.from({ length: 17 }, (_, i) => i + 5),
  view: { app: [0, 0, 120], twr: [0, 0.2, 2.2], gnd: [mOf(EN(0, 250)), offOf(EN(0, 250)), 2600, 1500] },
  minsOk,
  // Aldergrove departures are released by the SID-less tactical clearance, Belfast City's by Aldergrove Radar
  needRel: ac => isCity(ac),
  sidAlt: ac => sidTopOf(ac.sid),
  exitRouteOf: ac => exitRoute(ac.gate, depRw(ac), ac),
  elevOf: ac => isCity(ac) ? CITY_ALT_ELEV : ELEV,
  remoteAreas: [],
  areaNames: { civil: 'stands' },
  termName: t => TERM_NAME[t] || 'Apron ' + t,
  prefArea: ac => { const t = termOf(ac); return { key: t, name: TERM_NAME[t], has: s => s.term === t }; },
  standFor: ac => standAt(ac, termOf(ac)) || null,
  inboundAlt: gate => 7000,
  divertTo: ac => isCity(ac) ? ['Belfast International', 'BEL'] : ['Belfast City', 'MAGEE'],
  firstAlt: g => ENTRY_ALT[g] - 2000,
  rolledCall: 'request taxi',
  splitRwy: true, rwyFor, depFor: rw => CFG[configOf(rw)].dep.EGAA, configOf, arrRoute: o => landOf(o),
  rwyConfigs: ['west', 'east'].map(c => ({ key: c, name: CFG[c].name, land: CFG[c].land.EGAA, lands: [CFG[c].land.EGAA, CFG[c].land.EGAC], deps: [CFG[c].dep.EGAA, CFG[c].dep.EGAC] })),
  depRwyOf, landRwyOf,
  appRwys: bothRwys, arrRoutes: bothRwys, activeRwys: bothRwys, depRwys: bothRwys,
  // one runway switch per airfield
  rwyPickers: [{ key: 'EGAA', label: 'Aldergrove', opts: ['25', '07'], get: alderRw, set: r => setRwy(r) },
               { key: 'EGAC', label: 'City', opts: ['22', '04'], get: cityRw, set: r => setCityRwy(r) }],
  onStart(newRwy, live){ S.rwyC = bestCity(S.wx); S.metarC = null; },
  altMetar: () => S.metarC || (S.wx && S.wx.raw ? { raw: S.wx.raw.replace(/^EGAA /, 'EGAC '), sim: true } : null),
  vacExits: ac => { const rw = ac.app || landOf(ac), R = RWYS_BY_END(rw), m = R.mOf([ac.x, ac.y]), dir = rw === R.lo ? 1 : -1;
    return exitsFor(rw).filter(k => (HOLDS[k].m - m)*dir > 30).slice(0, 4); },
  vacPrefs: (st, ac) => exitsFor(ac && ac.app || landOf(ac || {})),
  exitFor,
  lineUpWords: hp => 'line up and wait',
  terrain: null, restricted: null,
  drawAirport: drawBelfast, drawAirportTop: drawBelfastTop,
  gaEarly(ac, rw){},
  // missed approach: climb straight ahead to 3,000 ft, then back to BEL (Aldergrove) or HB (City)
  gaTurn(ac){ const rw = ac.gaRwy, F = FINAL[rw] || FINAL['25']; if (ac.alt > 2900 || dist(ac.x, ac.y, ...THR[rw]) > 4) { ac.gaTurn = true; ac.mode = 'NAV'; ac.route = F.missed.slice(); ac.turnDir = MISSED[rw][2]; } },
  liftoff(ac){ ac.tgtHdg = Math.round(crsOf(ac.depRwy)); ac.turnDir = 0; },
  depTurn(ac){ if (!ac.turned && ac.alt >= (isCity(ac) ? 500 : ELEV + 500)) ac.turned = true; },
  depClear: ac => !!ac.turned,
  shear(ac, rw, w){ return turbExcess(w) > 4 && Math.random() < 0.2 ? 'windshear on short final' : null; },
  shearWhy: rw => 'windshear on short final',
  faceHold: (st, f) => depHold({ stand: st, leftStand: false, x: st.p[0], y: st.p[1], cs: st.term === 'C' ? 'C' : '' }),
  faceWord: f => f,
  faceHdg: (st, f) => norm(laneDir(st, f) + 180),
  taxiHolds: (south, ac) => { const rw = depRw(ac), ks = (endHolds(rw).length ? endHolds(rw) : nearHolds(rw)), p = ac ? (ac.stand && !ac.leftStand ? ac.stand.lp : [ac.x, ac.y]) : ARP;
    const rec = ac && depHold(ac); return [...new Set([rec, ...ks.sort((a, b) => dist(...p, ...GN[HOLDS[a].node].p) - dist(...p, ...GN[HOLDS[b].node].p))].filter(Boolean))].slice(0, 3); },
  taxiHint: rw => `Runway ${rw}: taxi to a holding point at the departure end, line up and wait, then cleared for take-off.`,
  diverts: [{ cs: 'EIN106', t: 'A320', o: 'EIDW', gate: 'S', to: 'Belfast City' }, { cs: 'BAW2290', t: 'A320', o: 'EGLL', gate: 'SE', to: 'Glasgow' },
    { cs: 'RYR52RT', t: 'B738', o: 'EGSS', gate: 'SE', to: 'Dublin' }],
  airports: EGAA.AIRPORTS, via: {},
  airlineIcao: EGAA.AIRLINE_ICAO, airlineType: EGAA.AIRLINE_TYPE, defType: 'A320',
  placeIcao: EGAA.PLACES,
  phr: {
    push: (ac, dn, face) => { const s = EGAA.SIDS[ac.sid] || {}, via = s.airway || 'the route', go = isCity(ac) ? `after departure ${s.turn === 'R' ? 'right' : 'left'} turn` : 'climb straight ahead, runway heading';
      return [`cleared to ${dn} via ${via}, ${go}, initial altitude ${altWords(6000)}, squawk ${ac.sqk}, start-up and push back approved, facing ${faceSay(ac, face)}, QNH ${S.wx.qnh}`,
        `cleared ${dn} via ${via}, ${go}, ${altShort(6000)}, squawk ${ac.sqk}, start and push approved facing ${faceSay(ac, face)}, QNH ${S.wx.qnh}`]; },
    startReq: ac => `${isCity(ac) ? 'Belfast Ground' : 'Aldergrove Ground'}, stand ${ac.stand.id}, ${ac.perf.name} to ${AP[ac.d] ? AP[ac.d][2] : ac.d}, information ${phonetic(S.atis)}, request start-up and push back`
  },
  atisPanel(w){
    const c = cfgNow(), cw = Math.max(...bothRwys().map(r => Math.abs(windComp(w, crsOf(r)).crossG))), bad = !minsOk(w, S.rwy), r = rwyFor(w);
    const m = APT.altMetar(), esc2 = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    return `<div class="warnline${bad ? ' bad' : ''}">Aldergrove ${alderRw()} · City ${cityRw()}${configOf(r.land) !== c ? ` (wind favours the ${CFG[configOf(r.land)].name.toLowerCase()})` : ''} · ${bad ? 'below the approach minima' : 'ILS and RNP approaches'} · crosswind ${Math.round(cw)} kt. Two airfields share one approach, 14 NM apart: keep their arrivals apart.</div>`
      + `<div class="metars"><div><b>EGAA</b> ${esc2(S.wx.raw.replace(/^(METAR |SPECI )?EGAA /, ''))}</div>${m ? `<div><b>EGAC</b> ${esc2(m.raw.replace(/^(METAR |SPECI )?EGAC /, ''))}${m.sim ? ' <i>(same weather; City’s own report loads in Real world mode)</i>' : ''}</div>` : ''}</div>`;
  },
  atisLines({ w, L, E, wind, vis, cloud }){
    const c = cfgNow(), tl = w.qnh >= 1013 ? 70 : w.qnh >= 978 ? 80 : 90;
    const out = [
      `This is Belfast Aldergrove information ${L}, time ${zt(S.t).slice(0,5).replace(':', '')}.`,
      `Runway in use ${alderRw()}. ${alderRw() === '07' ? 'RNP' : 'ILS'} approach runway ${alderRw()}. Belfast City: runway ${cityRw()}.`,
      `Surface wind ${wind}. Visibility ${vis}. ${cloud}.`,
      `Temperature ${w.temp}, dew point ${w.dew}. QNH ${w.qnh} hectopascals. Transition level ${tl}.`
    ];
    if (turbExcess(w) > 0) out.push('Moderate turbulence and windshear reported on final.');
    if (!minsOk(w, S.rwy)) out.push('Visibility below the approach minima. Expect holding at BEL or MAGEE.');
    out.push(`Acknowledge receipt of information ${L} and advise aircraft type and stand on first contact.`);
    return out;
  },
  site: {
    hero: () => [
      ['EZY6202', 54.45, -6.10, 20, 230, PAL.light.arr], ['RYR4123', 54.55, -5.70, 250, 230, PAL.light.arr], ['CFE1394', 54.75, -5.85, 215, 190, PAL.light.arr],
      ['EZY6201', 54.72, -6.45, 70, 180, PAL.light.dep], ['EIN3652', 54.65, -5.95, 36, 200, PAL.light.dep],
      ['BAW1442', 55.10, -6.00, 190, 430, 'rgba(60,75,95,.7)'], ['EIN654', 54.20, -6.40, 340, 420, 'rgba(60,75,95,.7)'], ['DLH8YT', 54.90, -5.30, 250, 430, 'rgba(60,75,95,.7)']
    ],
    demo(mk, park){
      const fin = add(THR['25'], CRS['07'], 2.6), out = add(THR['25'], CRS['25'], 4), inb = add(WP.BEL.p, 70, 12);
      const hk = endHolds('25')[0] || nearHolds('25')[0], hp = GN[HOLDS[hk].node].p;
      const ps = STANDS.filter(s => s.term === 'M').slice(0, 3).map(s => s.id);
      return [
        mk('EZY6201', 'A20N', 'DEP', park(ps[0], { need: null, reqAt: 99999 })), mk('RYR4122', 'B38M', 'DEP', park(ps[1] || ps[0], { need: null, reqAt: 99999 })),
        mk('EZY6233', 'A320', 'DEP', park(ps[2] || ps[0], { need: null, reqAt: 99999 })),
        mk('TOM6736', 'B738', 'DEP', { ground: true, state: 'HOLDPT', hp: hk, x: hp[0], y: hp[1], hdg: CRS['25'], gs: 0 }),
        mk('EXS1885', 'B738', 'ARR', { state: 'FINAL', mode: 'FINAL', app: '25', freq: 'TWR', x: fin[0], y: fin[1], hdg: CRS['25'], alt: 1450, gs: 145, vs: -750, o: 'GCTS' }),
        mk('EZY6219', 'A319', 'DEP', { state: 'CLIMB', x: out[0], y: out[1], hdg: 246, alt: 3200, gs: 210, vs: 2000, tgtAlt: 6000, d: 'EGKK' }),
        mk('CFE1394', 'E190', 'ARR', { state: 'INBOUND', x: inb[0], y: inb[1], hdg: 250, alt: 8000, gs: 250, vs: -1000, tgtAlt: 7000, o: 'EGLL' })
      ];
    },
    thumb(k, zoom, W){
      if (k === 'app') return v => { v.scale *= 0.7; };
      if (k === 'twr') { const c = rm(RWY_M*0.5, 250); return v => { v.cx = c[0]; v.cy = c[1]; v.scale = W/2.6; }; }
      const c = zoom === 'apron' ? (STANDS.find(s => s.term === 'M') || STANDS[0]).p : rm(RWY_M*0.5, 350);
      return v => { v.cx = c[0]; v.cy = c[1]; v.scale = W/((zoom === 'apron' ? 600 : 2600)*M2NM); };
    },
    figHold: 'BEL', emergHp: endHolds('25')[0] || nearHolds('25')[0],
    figConsole: v => { v.scale *= 1.2; },
    cmdHint: 'Command, e.g. CFE1394 H240 A40 · EZY6201 TAXI A1 · / to focus, Tab cycles flights'
  }
};
// City's better runway for the wind: 22 or 04
function bestCity(w){ const hw = r => windComp(w, crsOf(r)).head; return hw('22') + 3 >= hw('04') ? '22' : '04'; }
function setCityRwy(r){
  if (S.rwyC === r) return; S.rwyC = r; nextAtis(false); sys(`Belfast City: runway ${r} in use. Information ${phonetic(S.atis)} is current.`);
  rerouteArrivals(); renderAtis(); emit('rwy', r);
}
// the runway pair in use for a METAR: Aldergrove's landing runway names the flow
function rwyFor(w){
  const c = cfg => Math.max(...[CFG[cfg].land.EGAA, CFG[cfg].land.EGAC].map(r => -windComp(w, crsOf(r)).head));
  const hw = r => windComp(w, crsOf(r)).head;
  const land = hw('25') + 3 >= hw('07') ? '25' : '07';
  return { land, dep: land };
}
