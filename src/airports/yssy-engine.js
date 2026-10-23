// ═════════════════════════ Sydney Kingsford Smith (YSSY) airport profile for the engine ═════════════════════════
// Builds every global the engine reads from the chart data in yssy.js (YSSY) and the OpenStreetMap aerodrome in
// yssy-ground.js (metres east and north of the ARP). Sydney has three runways: the parallel pair 16L/34R (2,438 m) and
// 16R/34L (3,962 m), and the crossing runway 07/25 (2,530 m). Like Kennedy it is a multi-runway airport: APT.runways lists
// each with its own frame (metres from its low end, offset to the left), S.rwy is the landing runway and S.depRwy the
// departure runway. In the parallel modes the short runway lands and the long one departs (the heavy jets need it); 07/25
// is run alone, landing and departing on the same runway. Taxiing traffic holds short of every runway in use until cleared.
// Phraseology is ICAO with Australian touches ("line up", QNH in hectopascals, runway then wind).
Object.assign(TYPES, YSSY.TYPES);
const LL = p => xy(p[0], p[1]);
const G = YSSY_GROUND;
const EN = (e, n) => [e*M2NM, n*M2NM];                     // metres east and north of the ARP (the map origin) → NM

// ═════════════════════════ runways ═════════════════════════
function rwyFrame(r){
  const a = EN(...r.a), b = EN(...r.b), L = dist(...a, ...b), RU = [(b[0]-a[0])/L, (b[1]-a[1])/L], RN = [-RU[1], RU[0]];
  const rm = (m, off=0) => [a[0] + (RU[0]*m + RN[0]*off)*M2NM, a[1] + (RU[1]*m + RN[1]*off)*M2NM];
  const mOf = p => ((p[0]-a[0])*RU[0] + (p[1]-a[1])*RU[1])/M2NM, offOf = p => ((p[0]-a[0])*RN[0] + (p[1]-a[1])*RN[1])/M2NM;
  const len = r.len;
  const TURN_W = [[30, 0]], TURN_E = [[len - 30, 0]];       // no turning pads: entries are at the runway ends
  return { id: r.id, lo: r.lo, hi: r.hi, len, thr: r.thr, elev: r.elev, rm, mOf, offOf, RU, TURN_W, TURN_E, TURN_END: { W: 30, E: len - 30 },
    roll: [70, len - 70], ends: true, width: 45 };
}
const RWY_LIST = ['16R34L', '16L34R', '0725'].map(id => rwyFrame(G.runways.find(r => r.id === id)));
const R0 = RWY_LIST[0];
const rm = R0.rm, mOf = R0.mOf, offOf = R0.offOf, RU = R0.RU;
const RWY_M = R0.len, THR_LO_M = R0.thr['16R'], THR_HI_M = R0.thr['34L'];
const RW_LO = '16R', RW_HI = '34L';
const THR = {}, CRS = {}, THR_ELEV = {};
for (const R of RWY_LIST) {
  THR[R.lo] = R.rm(R.thr[R.lo], 0); THR[R.hi] = R.rm(R.thr[R.hi], 0);
  CRS[R.lo] = brg(...R.rm(0), ...R.rm(R.len)); CRS[R.hi] = norm(CRS[R.lo] + 180);
  THR_ELEV[R.lo] = R.elev[R.lo]; THR_ELEV[R.hi] = R.elev[R.hi];
}
const T_LO = THR[RW_LO], T_HI = THR[RW_HI], CRS_LO = CRS[RW_LO], CRS_HI = CRS[RW_HI];
const crsOf = rw => CRS[rw] ?? CRS_HI;
const ELEV = YSSY.elev;
const ARP = LL(YSSY.arp);
const parallelOf = rw => ({ '16L': '16R', '16R': '16L', '34L': '34R', '34R': '34L' })[rw];
const XING_M = -1e9, XING_SKEW = 0, XING_HW = 0, xingM = o => XING_M;
const FRONTIER = [], R164 = [], ROCK = [], ROCK_TOP = [0, 0];
const TURN_W = R0.TURN_W, TURN_E = R0.TURN_E, TURN_END = R0.TURN_END, TURN_PAD = {};

// ═════════════════════════ taxiways, holding points, stands (yssy-ground.js) ═════════════════════════
const inF0 = (e, n) => { const p = EN(e, n); return [mOf(p), offOf(p)]; };
for (const [id, e, n] of G.nodes) gn(id, ...inF0(e, n));
for (const [id, e, n] of G.rnodes) gn(id, ...inF0(e, n));
for (const [a, b, tw, mid] of G.edges) chain(a, mid.map(([e, n]) => inF0(e, n)), b, tw);
const HOLDS = {}, FIL = {};
for (const [k, [node, rwy, on, m, off, dirs, end]] of Object.entries(G.holds)) {
  HOLDS[k] = { node, rwy, on, m, off, dirs: dirs.split(','), end: end || null, ref: k.replace(/~\d+$/, '') };
  ge(rwy, node, HOLDS[k].ref);
  FIL[k] = { W: G.fil[k], E: G.fil[k] };
}
for (const [id, rid] of Object.entries(G.hs)) if (GN[id]) GN[id].p.hs = rid;
// terminals: T1 international, T2 domestic (Virgin, Jetstar, Rex), T3 Qantas domestic; F is the regional (commuter) apron and Q the Qantas Jet Base maintenance bays; the International and Domestic terminals number their bays separately, so the international ones are I1, I31 ... where a number is used twice
const INTL_ONLY = new Set(['ANZ', 'FJI', 'UAE', 'QTR', 'ETD', 'SIA', 'CPA', 'MAS', 'THA', 'PAL', 'GIA', 'KAL', 'JAL', 'ANA', 'CSN', 'CES', 'EVA', 'DAL', 'UAL', 'ACA', 'LAN', 'SAA', 'AIC']);
function termFor(ac){
  const c = ac.cs.slice(0, 3), ap = (ac.kind === 'ARR' ? ac.o : ac.d) || ac.o || ac.d || '';
  if (INTL_ONLY.has(c) || !/^Y/.test(ap)) return 'T1';
  return c === 'QFA' || c === 'QLK' ? 'T3' : 'T2';
}
// the largest type a stand takes (AIP apron charts): the widest wingspan of the types listed
const SPAN = { A343: 60.3, A346: 63.5, A332: 60.3, A333: 60.3, A359: 64.8, A35K: 64.8, A388: 79.8, A124: 73.3, B744: 64.4, B748: 68.4, B763: 47.6, B772: 61.0, B77W: 64.8, B788: 60.1, B789: 60.1,
  B738: 35.8, B739: 35.8, B38M: 35.9, B3XM: 35.9, B737: 35.8, B461: 26.3, B463: 26.3, A320: 34.1, A321: 34.1, A21N: 35.8, SF34: 21.4, DH8C: 27.4, DH8D: 28.4, B190: 17.7, SW3: 17.4 };
const spanOfList = s => { const v = (s || '').split('/').map(t => SPAN[t]).filter(Boolean); return v.length ? Math.max(...v) : null; };
const STANDS = G.gates.map(g => { const [id, term, [e, n], node] = g, p = EN(e, n), remote = term === 'F', sp = spanOfList(g[6]);
  return { id, term, p, m: mOf(p), off: offOf(p), node, area: remote ? 'remote' : 'civil', occ: null, noLead: !g[5], ...(sp ? { maxSpan: Math.round(sp) } : {}) }; });
// OpenStreetMap ends a bay's line where the nose wheel stops, but an aircraft is placed by its centre: move the stop back along the lead-in by about
// half the length of the largest type the bay takes (so the nose is at the terminal, not the whole aircraft over the pier), never more than 40% of the lead-in
STANDS.forEach(s => { s.lp = GN[s.node].p; const L = dist(...s.lp, ...s.p)/M2NM, half = s.maxSpan ? Math.min(34, Math.max(11, s.maxSpan*0.5)) : 20, k = Math.min(half, L*0.4);
  if (L > 12) { const u = [(s.lp[0] - s.p[0])/(L*M2NM), (s.lp[1] - s.p[1])/(L*M2NM)]; s.p = [s.p[0] + u[0]*k*M2NM, s.p[1] + u[1]*k*M2NM]; s.m = mOf(s.p); s.off = offOf(s.p); }
  s.hdg = brg(...s.lp, ...s.p); });
const APRONS = G.aprons.map(r => r.map(([e, n]) => inF0(e, n)));
{ const civ = STANDS.filter(s => s.area === 'civil'), c = civ.reduce((a, s) => [a[0] + s.p[0]/civ.length, a[1] + s.p[1]/civ.length], [0, 0]); for (const R of RWY_LIST) R.side = Math.sign(R.offOf(c)); }

// taxiway names: letters spoken one by one, digits as numbers; the apron lanes INTL3 and DOM2 are International and Domestic
const NATO = { A: 'Alpha', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike',
  N: 'November', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', Y: 'Yankee', Z: 'Zulu' };
const twyWords = t => t.replace(/~\d+$/, '').split('/').map(part => { const m = part.match(/^(INTL|DOM)(\d+)([A-Z]?)$/);
  if (m) return (m[1] === 'INTL' ? 'International ' : 'Domestic ') + m[2] + (m[3] ? ' ' + NATO[m[3]] : '');
  return (part.match(/[A-Z]|\d+/g) || [part]).map(x => NATO[x] || x).join(' '); }).join(' and ');
const PHON = {};
for (const e of GE) if (e.tw && e.tw !== 'APRON' && !PHON[e.tw]) PHON[e.tw] = twyWords(e.tw);
for (const k of Object.keys(HOLDS)) PHON[k] = twyWords(k);
PHON.APRON = 'the apron';

// departure entries: the holding points at the departure end of a runway, then intersection departures
const endHolds = rw => Object.keys(HOLDS).filter(k => HOLDS[k].end === rw);
const INTX_MIN = 1800;
const intxRun = (k, rw) => { const H = HOLDS[k], R = rwyById(H.on), m = R.mOf(GN[H.rwy].p); return rw === R.lo ? R.len - m : m; };
const intxWay = (k, rw) => { const R = rwyById(HOLDS[k].on), f = FIL[k].W, a = f[f.length-1], b = f[0], dm = b[0] - a[0], L = Math.hypot(dm, b[1] - a[1]);
  return !L || dm*(rw === R.lo ? 1 : -1)/L >= -0.17; };
const intxHolds = rw => { const R = RWYS_BY_END(rw);
  return Object.keys(HOLDS).filter(k => { const H = HOLDS[k], q = GN[H.rwy].p;
    return H.on === R.id && !H.end && Math.sign(H.off) === R.side && intxWay(k, rw) && intxRun(k, rw) >= INTX_MIN
      && RWY_LIST.every(O => O === R || Math.abs(O.offOf(q)) > 100 || O.mOf(q) < -100 || O.mOf(q) > O.len + 100); })
    .sort((a, b) => intxRun(b, rw) - intxRun(a, rw)); };
const depHolds = rw => [...endHolds(rw), ...intxHolds(rw)];
const depHoldAs = (ac, hp) => { const rw = depRw(ac), ok = depHolds(rw); if (!HOLDS[hp] || ok.includes(hp)) return hp;
  return ok.find(k => HOLDS[k].ref === HOLDS[hp].ref) || hp; };
const routeLen = (from, to) => { const r = route(from, to); return r ? pathLen(r.nodes) : Infinity; };
function depHold(ac){
  const rw = depRw(), from = ac.stand && !ac.leftStand ? ac.stand.node : nearestNode([ac.x, ac.y], n => !/^R/.test(n.id)).id;
  const ks = endHolds(rw); let best = ks[0], bl = Infinity;
  for (const k of ks) { const L = routeLen(from, HOLDS[k].node); if (L < bl) { bl = L; best = k; } }
  return best;
}
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
function exitsFor(rw){
  const R = RWYS_BY_END(rw), up = rw === R.lo, thr = R.thr[rw];
  const ks = Object.keys(HOLDS).filter(k => { const H = HOLDS[k]; return H.on === R.id && H.dirs.includes(rw) && (up ? H.m > thr + 600 : H.m < thr - 600); });
  const near = ks.filter(k => Math.sign(HOLDS[k].off) === R.side), far = ks.filter(k => Math.sign(HOLDS[k].off) !== R.side);
  const order = a => a.sort((x, y) => (HOLDS[x].m - HOLDS[y].m)*(up ? 1 : -1));
  return [...order(near), ...order(far)];
}
const RWYS_BY_END = rw => RWY_LIST.find(R => R.lo === rw || R.hi === rw) || R0;
function exitFor(ac, name){
  if (HOLDS[name] && HOLDS[name].on === (ac.rwyId || RWYS_BY_END(ac.app || S.rwy).id)) return name;
  const rw = ac.app || S.rwy, R = RWYS_BY_END(rw), m = R.mOf([ac.x, ac.y]), dir = rw === R.lo ? 1 : -1;
  const ks = Object.keys(HOLDS).filter(k => HOLDS[k].ref === name && HOLDS[k].on === R.id && (HOLDS[k].m - m)*dir > 20);
  return ks.sort((a, b) => (Math.sign(HOLDS[b].off) === R.side) - (Math.sign(HOLDS[a].off) === R.side) || (HOLDS[a].m - HOLDS[b].m)*dir)[0] || null;
}

// ═════════════════════════ aerodrome drawing ═════════════════════════
const AD_SITE = { pave: { w: 23 }, aprons: APRONS, roads: [], buildings: [], twyExtra: [], shoulder: [0, RWY_M], serviceRoad: false, paag: [], floods: [], twyLabels: [], hotspots: [], labels: [] };
const TERM_NAME = { T1: 'TERMINAL 1', T2: 'TERMINAL 2', T3: 'TERMINAL 3', F: 'REGIONAL' };
const TERM_LABELS = (() => { const by = {}; for (const s of STANDS) (by[s.term] ||= []).push(s.p); return Object.entries(by).map(([t, ps]) => [TERM_NAME[t] || t, ps.reduce((a, p) => [a[0] + p[0]/ps.length, a[1] + p[1]/ps.length], [0, 0])]); })();
function drawYssy(){
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
    cx.lineWidth = lw(48); for (const s of STANDS) { pathP([s.lp, s.p], false); cx.stroke(); }
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
      cx.setLineDash([30*mpx, 20*mpx]); pathP([R.rm(R.thr[R.lo] + 120, 0), R.rm(R.thr[R.hi] - 120, 0)], false); cx.stroke(); cx.setLineDash([]);
      // ICAO Annex 14 precision markings: threshold stripes (12 on a 45 m runway), aiming point at 400 m, touchdown zone pairs
      for (const [m0, dir] of [[R.thr[R.lo], 1], [R.thr[R.hi], -1]]) {
        for (let i = 0; i < 6; i++) for (const k of [-1, 1]) { const o = k*(2 + i*3.6); quad(m0 + dir*6, o - 0.8*k, m0 + dir*36, o + 0.8*k); }
        for (const k of [-1, 1]) quad(m0 + dir*400, k*10, m0 + dir*450, k*16);
        const half = Math.abs(R.thr[R.hi] - R.thr[R.lo])/2;
        for (const [d, n] of [[150, 3], [300, 2], [450, 1], [600, 1], [750, 1]]) if (d + 22 < half) for (const k of [-1, 1]) for (let j = 0; j < n; j++) {
          const o = k*(7 + j*3.6); quad(m0 + dir*d, o, m0 + dir*(d + 22), o + k*1.8);
        }
      }
      for (const [rw, m0] of [[R.lo, R.thr[R.lo] + 70], [R.hi, R.thr[R.hi] - 70]]) drawRwyDesignator(...P2(R.rm(m0, 0)), rw, crsOf(rw), Math.max(9, 16*mpx));
    }
    { const seen = new Set(), leads = []; for (const k in FIL) { const f = FIL[k].W, key = HOLDS[k].on + JSON.stringify(f); if (seen.has(key)) continue; seen.add(key);
      const R = rwyById(HOLDS[k].on); leads.push(leadLine(f).map(p => P2(R.rm(...p)))); }
      groundLines(lw(0.35), () => leads.forEach(strokeSmooth)); }
    paintEdgeLines(lw(0.35));
    // runway holding positions: pattern A, two solid and two dashed lines across the taxiway
    for (const [id, rid] of Object.entries(G.hs)) {
      const n = GN[id]; if (!n) continue; const R = rwyById(rid), m = R.mOf(n.p), o = R.offOf(n.p), s = Math.sign(o);
      for (const [d, dash] of [[0.9, false], [0.3, false], [-0.3, true], [-0.9, true]]) { cx.setLineDash(dash ? [mpx + 1, mpx + 1] : []); pathP([R.rm(m - 11, o + s*d), R.rm(m + 11, o + s*d)], false); cx.stroke(); }
      cx.setLineDash([]);
    }
    groundLines(lw(0.3), () => { for (const s of STANDS) if (!s.noLead) { const L = dist(...s.lp, ...s.p)/M2NM, f = L > 70 ? 1 - 70/L : 0; pathP([[s.lp[0] + (s.p[0] - s.lp[0])*f, s.lp[1] + (s.p[1] - s.lp[1])*f], s.p], false); cx.stroke(); } });
    if (IMG) { cx.save(); clipOut(G.buildings.map(b => b.pts.map(([e, n]) => P2(EN(e, n))))); drawStandDetail(null, null, mpx); cx.restore(); }
    else if (sc > 600) { cx.fillStyle = rgba('lab', .8); cx.font = `600 ${Math.max(9, 4*mpx)}px ${FONT_L}`; for (const s of STANDS) { const [X, Y] = P2(s.p); cx.fillText(s.id, X + 3, Y - 3); } }
    drawGroundSigns();
  }
}
function drawYssyTop(){
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

// ═════════════════════════ fixes, STARs, SIDs ═════════════════════════
const STAR_LISTS = Object.values(YSSY.STARS).flatMap(s => [s.pts, ...Object.values(s.via || {}), ...Object.values(s.rwx || {})]);
const STAR_FIXES = new Set(STAR_LISTS.flat().map(p => p[0]));
const SID_FIXES = new Set([...Object.values(YSSY.SIDS).flatMap(s => s.pts || []), ...Object.values(YSSY.TRANS).flat()]);
const ILS_FIXES = new Set(Object.values(YSSY.ILS).flatMap(i => [i.ifx, i.faf]));
for (const [id, p] of Object.entries(YSSY.FIX)) wp(id, p[0], p[1], STAR_FIXES.has(id) || SID_FIXES.has(id) || ILS_FIXES.has(id) ? {} : { minor: true });
const RADAR_REF = ARP;
const GATES = Object.keys(YSSY.DIR);
const STAR_OF = g => YSSY.STARS[YSSY.DIR[g].star];
const starFrom = g => { const pts = STAR_OF(g).pts.map(p => p[0]); return pts.slice(pts.indexOf(YSSY.DIR[g].entry)); };
for (const s of Object.values(YSSY.STARS)) { const n = s.pts.length, a = WP[s.pts[n-2][0]].p, b = WP[s.pts[n-1][0]].p; WP[s.pts[n-1][0]].hold = { inb: Math.round(brg(...a, ...b)), min: 6000, left: false }; }
const ENTRY = Object.fromEntries(GATES.map(g => [g, WP[YSSY.DIR[g].entry].p]));
const ENTRY_ALT = { N: 12000, NW: 12000, W: 11000, SW: 12000, E: 12000 };
const PRE_ALT = { N: 28000, NW: 30000, W: 30000, SW: 27000, E: 33000 };

// ── ILS approaches: the localiser from 3 NM outside the intermediate fix, the 3° glideslope from the platform altitude
const FINAL = {};
for (const [rw, I] of Object.entries(YSSY.ILS)) {
  const thr = THR[rw], out = norm(crsOf(rw) + 180), dIF = dist(...thr, ...WP[I.ifx].p), dFAF = dist(...thr, ...WP[I.faf].p), elev = THR_ELEV[rw];
  // the published missed approach heading (magnetic) flown to a point 7 NM out, then the hold
  WP['M' + rw] = { id: 'M' + rw, p: add(thr, norm(I.missedHdg + YSSY.RWY.var), 7), hide: true, note: `missed approach ${rw}` };
  const F = { pts: [add(thr, out, dIF + 3), add(thr, out, dIF), thr], alts: [I.ifAlt, I.ifAlt, elev + 50], elev, entry: I.ifx, entryName: I.ifx, name: 'ILS ' + rw, alt: I.ifAlt,
    decName: I.faf, decNM: dFAF + 0.2, decMin: Math.max(1.6, dFAF - 1.6), minAlt: I.fafAlt - 300, minText: `${I.fafAlt.toLocaleString('en-US')} ft`,
    mins: { vis: 800, ceil: 200 }, minRate: 300, missed: ['M' + rw], missAlt: I.missed,
    phrase: r => `maintain ${altWords(I.ifAlt)} until established on the localiser, cleared ILS runway ${r} approach`, read: r => `cleared ILS ${r}`,
    decCall: r => `${APT.tower[0]}, ${I.faf}, ILS runway ${r}`, decNeed: `Inbound past ${I.faf}, needs landing clearance`, decFail: 'not visual at minima' };
  F.cum = new Array(F.pts.length).fill(0); for (let i = F.pts.length - 2; i >= 0; i--) F.cum[i] = F.cum[i+1] + dist(...F.pts[i], ...F.pts[i+1]);
  const meet = (I.ifAlt - elev - 50)/318;
  F.prof = [[0, elev + 50], [meet, I.ifAlt], [F.cum[0] + 1, I.ifAlt]];
  FINAL[rw] = F;
}
// ── from the end of each STAR to the intermediate fix: hidden downwind and base points (the radar vectors a Sydney
// Approach controller would give), so an arrival with no instructions still gets there
const FEED_ALT = {};
function feeder(rw, from){
  const I = YSSY.ILS[rw], thr = THR[rw], out = norm(crsOf(rw) + 180), dIF = dist(...thr, ...WP[I.ifx].p);
  if (from === I.ifx) return [I.ifx];
  const f = WP[from].p, dx = f[0] - thr[0], dy = f[1] - thr[1], ux = Math.sin(out*D2R), uy = Math.cos(out*D2R);
  const along = dx*ux + dy*uy, right = dx*uy - dy*ux, s = right >= 0 ? 1 : -1;
  const pt = (a, l) => add(add(thr, out, a), out + 90, l);
  const tag = `${rw}${s > 0 ? 'R' : 'L'}`, mk = (k, p, note) => { WP[tag + k] = { id: tag + k, p, hide: true, note }; FEED_ALT[tag + k] = I.ifAlt + (k === 'B' ? 0 : 1000); return tag + k; };
  if (along > dIF + 3 && Math.abs(right) < 2.5) return [I.ifx];
  const base = mk('B', pt(dIF + 4, s*2.5), `base for ${rw}`);
  if (along > dIF + 3) return [base, I.ifx];
  const dw2 = mk('D', pt(dIF + 3, s*6), `downwind for ${rw}`);
  if (along > 1) return [dw2, base, I.ifx];
  return [mk('A', pt(1, s*6), `downwind for ${rw}`), dw2, base, I.ifx];
}
const LAND_RWYS = Object.keys(YSSY.ILS);
// the route to the intermediate fix: the STAR from its entry (the chart's own leg for a runway where it has one, or the
// extra fixes some runways add), then the vectors
const ARR_ROUTE = Object.fromEntries(GATES.map(g => [g, Object.fromEntries(LAND_RWYS.map(rw => {
  const S_ = STAR_OF(g); let star;
  if (S_.via && S_.via[rw]) { const v = S_.via[rw].map(p => p[0]); star = v.slice(Math.max(0, v.indexOf(YSSY.DIR[g].entry))); }
  else star = [...starFrom(g), ...((S_.rwx && S_.rwx[rw]) || []).map(p => p[0])];
  const last = star[star.length - 1], I = YSSY.ILS[rw];
  if (star.includes(I.ifx)) star = star.slice(0, star.indexOf(I.ifx));
  return [rw, [...star, ...feeder(rw, star.length ? star[star.length - 1] : last)]];
}))]));
const HOLD_AT = Object.fromEntries(GATES.map(g => [g, STAR_OF(g).pts[STAR_OF(g).pts.length - 1][0]]));

// ── departures: an RNAV SID (with its transition) where one serves the runway and the direction, else Sydney Four (radar)
const sidOf = (gate, rwy) => (YSSY.DIR[gate].sids || {})[rwy] || null;
const rnavSid = (gate, rwy) => { const s = sidOf(gate, rwy); return s ? s[0] : null; };
const sidName = (gate, rwy) => rnavSid(gate, rwy) || 'SY4';
const sidSpoken = n => (YSSY.SIDS[n] || {}).spoken || n;
const exitRoute = (g, rwy) => { const s = sidOf(g, rwy); if (!s) return YSSY.DIR[g].route.slice(); return [...YSSY.SIDS[s[0]].pts, ...(YSSY.TRANS[s[0] + ':' + s[1]] || [])]; };
const EXIT_ROUTE = {}, EXIT_FIX = {};
for (const g of GATES) {
  Object.defineProperty(EXIT_ROUTE, g, { enumerable: true, get: () => exitRoute(g, depRw()) });
  Object.defineProperty(EXIT_FIX, g, { enumerable: true, get: () => { const r = exitRoute(g, depRw()); return r[r.length - 1]; } });
}
const NEXT_UNIT = Object.fromEntries(GATES.map(g => [g, YSSY.CTR[YSSY.DIR[g].ctr]]));
const relUnit = ac => (NEXT_UNIT[ac.gate] || YSSY.CTR.n)[0];
const TEL = YSSY.TEL;
const isMil = ac => false;
const gateFor = ap => ap === 'YSSY' ? 'N' : (YSSY.PLACE_DIR[ap] || 'N');

// ═════════════════════════ schedule ═════════════════════════
const withGate = x => ({ ...x, gate: x.gate || gateFor(x.k === 'ARR' ? x.o : x.d) });
const TIMETABLE = YSSY.TIMETABLE;
const REGS = {};
const LONG_STAY = YSSY.LONG_STAY;
const EXTRA = YSSY.EXTRA.map(withGate);
const EXERCISES = Object.fromEntries(Object.entries(YSSY.EXERCISES).map(([k, e]) => ['y' + k, { ...e, sched: e.sched.map(withGate) }]));
const WX_PRESETS = YSSY.WX_PRESETS;

// ═════════════════════════ weather rules ═════════════════════════
const TURB_TABLE = {};
function turbExcess(w){
  if (w.vrb || w.spd < 14) return 0;
  return Math.max(0, Math.max(w.spd, (w.gust || 0)*0.85) - 24);
}
const minsOk = (w, rw) => w.vis >= 800 && w.ceil >= 200;
const sraMinsOk = w => minsOk(w, '34R');
// runway configuration by wind (magnetic, as reported): the short parallel lands, the long one departs; 07 and 25 alone
const CONFIGS = [['34R', '34L'], ['16L', '16R'], ['25', '25'], ['07', '07']];
const magOf = rw => YSSY.RWY.magHdg[rw.replace(/[LR]$/, '')];
function rwyFor(w){
  if (w.vrb || w.spd < 5) return { land: '34R', dep: '34L' };
  let best = null; for (const [l, d] of CONFIGS) { const h = windComp(w, magOf(l)).head - (l === d ? 4 : 0); if (!best || h > best.h + 0.5) best = { land: l, dep: d, h }; }
  return { land: best.land, dep: best.dep };
}
const depFor = rw => (CONFIGS.find(([l]) => l === rw) || [])[1] || parallelOf(rw) || rw;

// ═════════════════════════ engine hooks ═════════════════════════
const visTxt = v => v >= 9999 ? '10 kilometres or more' : v >= 5000 ? Math.round(v/1000) + ' kilometres' : v + ' metres';
const firstOf = (t, i = 0) => STANDS.filter(s => s.term === t && s.area === 'civil')[i];
const APT = {
  arrAlt: { ...arrAltOf(STAR_LISTS.map(pts => ({ pts }))), ...FEED_ALT },
  icao: 'YSSY', name: 'Sydney', coordName: 'Sydney', radarName: 'Sydney', utcOff: 11,
  radar: [YSSY.UNITS.app.name, YSSY.UNITS.app.freq], depRadar: [YSSY.UNITS.dep.name, YSSY.UNITS.dep.freq],
  get tower(){ return [YSSY.UNITS.twr.name, YSSY.UNITS.twr.freq[RWYS_BY_END(S.rwy).id]]; },
  gnd: [YSSY.UNITS.gnd.name, YSSY.UNITS.gnd.freq],
  runways: RWY_LIST, rwyHalfWidth: 23,
  xing: false, drawnTown: false, ta: YSSY.TA, initClimb: 5000, gaAlt: 4000, appAlt: 4000, handoffNM: 18, climbFL: 190, divertAlt: 9000,
  area: { dep: 45, arr: 100, div: 45 }, roll: [70, RWY_M - 70], defRwy: '34R', defWx: 'n',
  appName: 'ILS approach', appShort: 'ILS', minsText: 'weather below the ILS minima', reqApp: rw => 'ILS approach',
  minsLong: 'Weather is below the ILS minima (200 ft decision altitude and 800 m visibility).',
  liveName: 'Sydney Airport', liveThin: 20, atisFreq: YSSY.UNITS.atis.freq, turbName: 'Sydney',
  sessionHours: Array.from({ length: 17 }, (_, i) => i + 19),   // 1900Z to 1100Z next day: 06:00 to 22:00 in Sydney, outside the curfew
  view: { app: [0, 0, 75], twr: [ARP[0] - (R0.rm(RWY_M/2)[0]), ARP[1] - (R0.rm(RWY_M/2)[1]), 3.4],
    gnd: (() => { const c = firstOf('T2') ? firstOf('T2').p : ARP; return [mOf(c), offOf(c), 5200, 4200]; })() },
  minsOk,
  splitRwy: true, rwyFor, depFor,
  appRwys: () => FINAL[parallelOf(S.rwy)] ? [S.rwy, parallelOf(S.rwy)] : [S.rwy],
  needRel: ac => false,
  remoteAreas: ['remote'],
  areaNames: { civil: 'bays', remote: 'regional and maintenance bays' },
  termName: t => t === 'F' ? 'Regional and maintenance apron' : 'Terminal ' + t.slice(1),
  remoteWord: s => s.id[0] === 'Q' ? 'maintenance bay' : 'regional bay',
  prefArea: ac => { const t = termFor(ac); return { key: t, name: 'Terminal ' + t.slice(1), has: s => s.term === t }; },
  standFor: ac => { const t = termFor(ac);
    const pick = list => { const free = list.filter(s => standFree(s, ac)).sort((a, b) => (a.maxSpan || 80) - (b.maxSpan || 80)), best = free.filter(s => (s.maxSpan || 80) <= (free[0] && free[0].maxSpan || 80) + 12);
      return best[Math.floor(Math.random()*best.length)] || null; };
    return pick(STANDS.filter(s => s.term === t && s.area === 'civil')) || pick(STANDS.filter(s => s.area === 'civil')); },
  inboundAlt: gate => 9000,
  divertTo: ac => ac.gate === 'N' || ac.gate === 'E' ? ['Newcastle', 'MEPIL'] : ['Canberra', 'AKMIR'],
  firstAlt: g => ENTRY_ALT[g] - 2000,
  rolledCall: 'request taxi',
  vacExits: ac => { const R = RWYS_BY_END(ac.app || S.rwy), m = R.mOf([ac.x, ac.y]), dir = (ac.app || S.rwy) === R.lo ? 1 : -1;
    return exitsFor(ac.app || S.rwy).filter(k => (HOLDS[k].m - m)*dir > 30 && Math.sign(HOLDS[k].off) === R.side).slice(0, 4); },
  vacPrefs: (st, ac) => exitsFor(ac && ac.app || S.rwy),
  exitFor,
  lineUpWords: hp => 'line up',
  terrain: { name: 'the Sydney city towers', poly: [[-33.875, 151.200], [-33.865, 151.200], [-33.865, 151.215], [-33.875, 151.215]].map(LL), min: 1500, low: 1000, msg: ac => `${ac.cs} is over the city at ${Math.round(ac.alt)} ft${ac.alt < 1000 ? ', OBSTACLE' : ''}.` },
  restricted: null,
  drawAirport: drawYssy, drawAirportTop: drawYssyTop,
  gaEarly(ac, rw){},
  gaTurn(ac){ const rw = ac.gaRwy, F = FINAL[rw] || FINAL['34R']; if (dist(ac.x, ac.y, ...THR[rw]) > 1.2 || ac.alt > ELEV + 1200) { ac.gaTurn = true; ac.mode = 'NAV'; ac.route = F.missed.slice(); ac.tgtAlt = ac.cleared = Math.max(ac.cleared || 0, F.missAlt); } },
  // departures climb straight ahead on the runway heading; an RNAV SID turns for its first fix at 400 ft
  liftoff(ac){ ac.tgtHdg = Math.round(crsOf(ac.depRwy)); ac.turnDir = 0; },
  depTurn(ac){ if (ac.turned || ac.alt < ELEV + 400) return; ac.turned = true; },
  depClear: ac => !!ac.turned && (rnavSid(ac.gate, ac.depRwy) ? ac.alt > ELEV + 520 : ac.alt > ELEV + 1800),
  shear(ac, rw, w){ return w.cb && Math.random() < 0.15 ? 'windshear from the thunderstorm on final' : null; },
  shearWhy: rw => S.wx.cb ? 'microburst alert on final' : 'windshear on short final',
  faceHold: (st, f) => depHold({ stand: st, leftStand: false, x: st.p[0], y: st.p[1] }),
  faceWord: f => f,
  faceHdg: (st, f) => norm(laneDir(st, f) + 180),
  taxiHolds: (south, ac) => { const rw = depRw(ac), ks = endHolds(rw), p = ac ? (ac.stand && !ac.leftStand ? ac.stand.lp : [ac.x, ac.y]) : ARP;
    const rec = ac && depHold(ac), ends = [...new Set([rec, ...ks.sort((a, b) => dist(...p, ...GN[HOLDS[a].node].p) - dist(...p, ...GN[HOLDS[b].node].p))].filter(Boolean))].slice(0, 3);
    return [...ends, ...intxHolds(rw).filter(k => !ac || ac.perf.wake !== 'H' || intxRun(k, rw) >= 3000)]; },
  holdNote: (hp, rw) => intxHolds(rw).includes(hp) ? ` · intersection, ${(Math.round(intxRun(hp, rw)/100)*100).toLocaleString('en-US')} m of runway ahead` : '',
  depHoldAs,
  taxiCheck: (ac, hp) => { if (ac.kind !== 'DEP' || !HOLDS[hp]) return null; const rw = depRw(ac), ok = depHolds(rw);
    if (intxHolds(rw).includes(hp) && ac.perf.wake === 'H' && intxRun(hp, rw) < 3000) return `${ac.cs} (${ac.t}, heavy) needs more runway than ${HOLDS[hp].ref} leaves (${(Math.round(intxRun(hp, rw)/100)*100).toLocaleString('en-US')} m): it can't take an intersection departure there.`;
    if (ok.includes(hp)) return null;
    const ref = k => HOLDS[k].ref, ends = [...new Set(endHolds(rw).map(ref))], ix = [...new Set(intxHolds(rw).map(ref))];
    return `${ref(hp)} is not a runway ${rw} departure point. Runway ${rw} departures enter at ${ends.join(', ')}${ix.length ? `, or at the intersection${ix.length > 1 ? 's' : ''} ${ix.join(', ')}` : ''}.`; },
  taxiHint: rw => `Full-length departures from runway ${rw} enter at the runway end${intxHolds(rw).length ? `, intersection departures at ${[...new Set(intxHolds(rw).map(k => HOLDS[k].ref))].join(', ')}` : ''}. Sydney has no turning pads: the crew lines up straight onto the runway.`,
  diverts: [{ cs: 'QFA64', t: 'B789', o: 'YPPH', gate: 'W', to: 'Canberra' }, { cs: 'VOZ822', t: 'B738', o: 'YBBN', gate: 'N', to: 'Newcastle' },
    { cs: 'JST518', t: 'A320', o: 'YMML', gate: 'SW', to: 'Canberra' }, { cs: 'ANZ104', t: 'A320', o: 'NZAA', gate: 'E', to: 'Newcastle' }],
  airports: YSSY.AIRPORTS, via: {},
  airlineIcao: YSSY.AIRLINE_ICAO, airlineType: YSSY.AIRLINE_TYPE, defType: 'B738',
  placeIcao: YSSY.PLACES,
  standWord: 'bay',
  phr: {
    push: (ac, dn, face) => {
      const fix = EXIT_FIX[ac.gate], f = YSSY.UNITS.dep.freq.replace(/0+$/, '');
      return [`cleared to ${dn} via the ${sidSpoken(ac.sid)} departure${rnavSid(ac.gate, depRw()) ? '' : ', then on track to ' + fix}, runway ${depRw(ac)}, climb ${altWords(APT.initClimb)}, squawk ${ac.sqk}, departures ${f}, push back approved, facing ${faceSay(ac, face)}, QNH ${S.wx.qnh}`,
        `cleared ${dn}, ${sidSpoken(ac.sid)}, runway ${depRw(ac)}, ${altShort(APT.initClimb)}, squawk ${ac.sqk}, ${f}, push approved facing ${faceSay(ac, face)}, QNH ${S.wx.qnh}`]; },
    startReq: ac => `${YSSY.UNITS.gnd.name}, bay ${ac.stand.id}, ${ac.perf.name} to ${AP[ac.d] ? AP[ac.d][2] : ac.d}, information ${phonetic(S.atis)}, request push back`,
    checkIn: ac => `${APT.radar[0]}, ${altShort(Math.round(ac.alt/100)*100)} descending ${altShort(ac.tgtAlt)}, ${STAR_OF(ac.gate).spoken} arrival, information ${phonetic(S.atis)}`,
    vacated: ac => `${YSSY.UNITS.gnd.name}, clear of ${rwyName(ac.rwyId)} at ${PHON[ac.exit] || ac.exit.replace(/~\d+$/, "")}${ac.stand ? ', for bay ' + ac.stand.id : ''}`,
    taxiIn: (ac, st, vw) => { const k = xingAhead(ac), hs = k >= 0 ? `, hold short runway ${rwyName(ac.path.pts[k].hs)}` : '', via = vw.length ? ' via ' + vw.map(t => PHON[t] || t).join(', ') : '';
      return [`taxi to bay ${st.id}${via}${hs}`, `bay ${st.id}${via}${hs}`]; },
    taxiHold: (ac, h, vw) => { const via = vw.length ? 'via ' + vw.map(t => PHON[t] || t).join(', ') + ', ' : '', r = h.rwy ? rwyName(HOLDS[h.id].on) : null, at = PHON[HOLDS[h.id] ? HOLDS[h.id].ref : h.id] || h.id;
      return r ? [`taxi ${via}hold short of runway ${r} at ${at}`, `${via}hold short runway ${r} at ${at}`] : [`taxi ${via}hold at ${at}`, `${via}hold at ${at}`]; },
    atHoldPt: (ac, h) => h.rwy ? `holding short of runway ${rwyName(HOLDS[h.id].on)} at ${PHON[HOLDS[h.id].ref] || HOLDS[h.id].ref}` : `holding at ${h.id}`
  },
  atisPanel(w){
    const c = windComp(w, crsOf(S.rwy)), bad = !minsOk(w, S.rwy), r = rwyFor(w);
    return `<div class="warnline${bad ? ' bad' : ''}">Landing ${S.rwy} · departing ${depRw()}${r.land !== S.rwy || r.dep !== depRw() ? ` (wind favours ${r.land} / ${r.dep})` : ''} · ${bad ? 'below the ILS minima' : 'ILS approaches'} · crosswind ${Math.round(Math.abs(c.crossG))} kt. Curfew from 23:00 local: the session ends at 22:00.</div>`;
  },
  atisLines({ w, L, E }){
    const cl = w.clouds.length ? w.clouds.map(c => { const m = c.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3})/); return m ? `${{ FEW: 'few', SCT: 'scattered', BKN: 'broken', OVC: 'overcast', VV: 'vertical visibility' }[m[1]]} ${(+m[2]*100).toLocaleString('en-US')}` : c; }).join(', ') : 'nil significant cloud';
    const out = [
      `Sydney information ${phonetic(L)}, ${zt(S.t).slice(0,5).replace(':', '')} hours UTC.`,
      `Runway ${S.rwy} landing, ILS approach, runway ${depRw()} departing.`,
      `Wind ${w.vrb ? 'variable' : hdg3(w.dir)} degrees ${w.spd} knots${w.gust ? ', maximum ' + w.gust : ''}. Visibility ${visTxt(w.vis)}${w.wx.length ? ', ' + w.wx.join(' ') : ''}. Cloud ${cl}.`,
      `Temperature ${w.temp}, dew point ${w.dew}. QNH ${w.qnh}.`
    ];
    if (turbExcess(w) > 0) out.push('Low level windshear advisories in effect.');
    if (E && E.ws) out.push(`Windshear reported on final runway ${E.ws.rw} at ${zt(E.ws.t).slice(0,5).replace(':', '')}, ${E.ws.text}.`);
    if (E && E.rwyBlock) out.push(`Runway ${blockRw()} closed: ${E.rwyBlock.why}. ${parallelEnd(blockRw()) ? `Arrivals expect runway ${parallelEnd(blockRw())}, departures continue on the other runway.` : "Expect delays."}`);
    if (!minsOk(w, S.rwy)) out.push('Visibility below ILS minima. Expect holding.');
    out.push('Curfew 2300 to 0600 local. Readback all runway hold short instructions.');
    out.push(`Advise on initial contact you have information ${phonetic(L)}.`);
    return out;
  },
  site: {
    hero: () => [
      ['QFA441', -33.50, 151.05, 170, 210, PAL.light.arr], ['VOZ449', -33.65, 151.45, 200, 230, PAL.light.arr], ['JST413', -33.75, 150.95, 140, 250, PAL.light.arr],
      ['QFA547', -34.15, 151.30, 340, 200, PAL.light.dep], ['UAE413', -34.05, 151.00, 20, 250, PAL.light.dep],
      ['SIA221', -33.30, 151.50, 180, 430, 'rgba(60,75,95,.7)'], ['CPA111', -33.90, 150.60, 90, 420, 'rgba(60,75,95,.7)'], ['ANZ113', -34.40, 151.60, 300, 430, 'rgba(60,75,95,.7)']
    ],
    demo(mk, park){
      const fin = add(THR['34R'], norm(CRS['34R'] + 180), 2.6), out = add(THR['34L'], CRS['34L'], 4), inb = add(WP.MEPIL.p, 200, 6);
      const hold = endHolds('34L')[0], hp = hold ? GN[HOLDS[hold].node].p : ARP;
      const ids = [firstOf('T3', 0), firstOf('T2', 0), firstOf('T2', 3), firstOf('T1', 0)].map(s => s ? s.id : STANDS[0].id);
      return [
        mk('QFA441', 'B738', 'DEP', park(ids[0], { need: null, reqAt: 99999 })), mk('VOZ453', 'B738', 'DEP', park(ids[1], { need: null, reqAt: 99999 })),
        mk('JST519', 'A320', 'DEP', park(ids[2], { need: null, reqAt: 99999 })), mk('UAE413', 'A388', 'DEP', park(ids[3], { need: null, reqAt: 99999 })),
        mk('QFA503', 'B738', 'DEP', { ground: true, state: 'HOLDPT', hp: hold, x: hp[0], y: hp[1], hdg: CRS['34L'], gs: 0 }),
        mk('JST413', 'A320', 'ARR', { state: 'FINAL', mode: 'FINAL', app: '34R', freq: 'TWR', x: fin[0], y: fin[1], hdg: CRS['34R'], alt: 850, gs: 140, vs: -750, o: 'YMML' }),
        mk('VOZ551', 'B738', 'DEP', { state: 'CLIMB', x: out[0], y: out[1], hdg: 335, alt: 3200, gs: 210, vs: 2000, tgtAlt: 5000, d: 'YBBN' }),
        mk('QFA441', 'B738', 'ARR', { state: 'INBOUND', x: inb[0], y: inb[1], hdg: 200, alt: 9000, gs: 250, vs: -1000, tgtAlt: 8000, o: 'YBBN' })
      ];
    },
    thumb(k, zoom, W){
      if (k === 'app') return v => { v.scale *= 1.3; };
      if (k === 'twr') { const c = ARP; return v => { v.cx = c[0] + 0.3; v.cy = c[1] - 0.2; v.scale = W/3.2; }; }
      const c = zoom === 'apron' ? (firstOf('T2') || STANDS[0]).p : ARP;
      return v => { v.cx = c[0]; v.cy = c[1]; v.scale = W/((zoom === 'apron' ? 700 : 4200)*M2NM); };
    },
    figHold: 'LANOL', emergHp: endHolds('34L')[0],
    figConsole: v => { v.scale *= 1.2; },
    cmdHint: 'Command, e.g. QFA441 A50 APP · VOZ453 TAXI · JST413 CROSS · / to focus, Tab cycles flights'
  }
};
// maintenance hangars (OpenStreetMap): the Qantas Jet Base hangars north of Terminal 3 and Hangar 96. Aircraft stored there at the
// start of a session are towed to a bay at their airline's terminal an hour before departure; the door is the nearest taxilane node.
const QF_HANGAR = ac => /^(QFA|QLK|JST)$/.test(ac.cs.slice(0, 3));
APT.hangars = [[354.7, 1778.2, 'n436', 'Qantas hangar 1'], [78.6, 1813.6, 'n490', 'Qantas hangar 2'], [91.2, 1884.8, 'n484', 'Qantas Jet Base hangar 3'],
  [248.7, 1869.6, 'n487', 'Qantas Jet Base hangar 4'], [281.6, 1790.4, 'n431', 'Qantas hangar 5'], [198.1, 1780.4, 'n487', 'Qantas hangar 6'],
  [399.0, 1562.0, 'n495', 'Hangar 96']]
  .filter(([, , node]) => GN[node])
  .map(([e, n, node, name], i) => ({ id: 'H' + (i + 1), name, in: inF0(e, n), door: [GN[node].m, GN[node].off], node, to: ['civil'],
    fits: ac => name === 'Hangar 96' ? !QF_HANGAR(ac) : QF_HANGAR(ac), pick: ac => APT.standFor(ac) }));
APT.queuePen = true;   // taxi-in routes go round lanes where departures are queued
