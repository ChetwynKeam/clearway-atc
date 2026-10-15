// ═════════════════════════ London Heathrow (EGLL) airport profile for the engine ═════════════════════════
// Builds every global the engine reads from the chart data in egll.js (EGLL) and the OpenStreetMap aerodrome in
// egll-ground.js (metres east and north of the ARP). Heathrow has two parallel runways 1,415 m apart, 09L/27R (north) and
// 09R/27L (south), with the terminals between them (2, 3 and 5) and south of the southern runway (4 and the cargo area).
// The runways are run in segregated mode: one lands, the other departs. In the westerly they swap at 15:00 every day
// in both directions (runway alternation, egll.js altLand): 27R/27L or 09L/09R land in turn. S.rwy is the
// landing runway, S.depRwy the departure runway. Traffic to and from Terminal 4 and the cargo area crosses the southern
// runway; a departure taxied to a holding point on the landing runway departs from it (as when one runway is closed).
Object.assign(TYPES, EGLL.TYPES);
const LL = p => xy(p[0], p[1]);
const G = EGLL_GROUND;
const EN = (e, n) => [e*M2NM, n*M2NM];                     // metres east and north of the ARP (the map origin) → NM

// ═════════════════════════ runways ═════════════════════════
// a frame along each runway: m from the pavement end a (the low-numbered end), off to the left
function rwyFrame(r){
  const a = EN(...r.a), b = EN(...r.b), L = dist(...a, ...b), RU = [(b[0]-a[0])/L, (b[1]-a[1])/L], RN = [-RU[1], RU[0]];
  const rm = (m, off=0) => [a[0] + (RU[0]*m + RN[0]*off)*M2NM, a[1] + (RU[1]*m + RN[1]*off)*M2NM];
  const mOf = p => ((p[0]-a[0])*RU[0] + (p[1]-a[1])*RU[1])/M2NM, offOf = p => ((p[0]-a[0])*RN[0] + (p[1]-a[1])*RN[1])/M2NM;
  const len = r.len, ms = G.rnodes.filter(([id]) => Object.values(G.holds).some(h => h[1] === id && h[2] === r.id)).map(([, e, n]) => mOf(EN(e, n)));
  const m0 = Math.min(0, ...ms.map(m => m - 40)), m1 = Math.max(len, ...ms.map(m => m + 40));
  const TURN_W = [[30, 0]], TURN_E = [[len - 30, 0]];
  return { id: r.id, lo: r.lo, hi: r.hi, len, m0, m1, thr: r.thr, elev: r.elev, rm, mOf, offOf, RU, TURN_W, TURN_E, TURN_END: { W: 30, E: len - 30 },
    roll: [70, len - 70], ends: true, width: 50 };
}
const RWY_LIST = ['09L27R', '09R27L'].map(id => rwyFrame(G.runways.find(r => r.id === id)));
const R0 = RWY_LIST[0];
const rm = R0.rm, mOf = R0.mOf, offOf = R0.offOf, RU = R0.RU;
const RWY_M = R0.len, THR_LO_M = R0.thr['09L'], THR_HI_M = R0.thr['27R'];
const RW_LO = '09L', RW_HI = '27R';
const THR = {}, CRS = {}, THR_ELEV = {};
for (const R of RWY_LIST) {
  THR[R.lo] = R.rm(R.thr[R.lo], 0); THR[R.hi] = R.rm(R.thr[R.hi], 0);
  CRS[R.lo] = brg(...R.rm(0), ...R.rm(R.len)); CRS[R.hi] = norm(CRS[R.lo] + 180);
  THR_ELEV[R.lo] = R.elev[R.lo]; THR_ELEV[R.hi] = R.elev[R.hi];
}
const T_LO = THR[RW_LO], T_HI = THR[RW_HI], CRS_LO = CRS[RW_LO], CRS_HI = CRS[RW_HI];
const crsOf = rw => CRS[rw] ?? CRS_HI;
const ELEV = EGLL.elev;
const ARP = LL(EGLL.arp);
const parallelOf = rw => ({ '09L': '09R', '09R': '09L', '27L': '27R', '27R': '27L' })[rw];
// no road crossing, no border fence, no rock
const XING_M = -1e9, XING_SKEW = 0, XING_HW = 0, xingM = o => XING_M;
const FRONTIER = [], R164 = [], ROCK = [], ROCK_TOP = [0, 0];
const TURN_W = R0.TURN_W, TURN_E = R0.TURN_E, TURN_END = R0.TURN_END, TURN_PAD = {};
const RWYS_BY_END = rw => RWY_LIST.find(R => R.lo === rw || R.hi === rw) || R0;

// ═════════════════════════ runway directions ═════════════════════════
// four configurations, two each way for the alternation: 27R landing (27L departing) or 27L landing (27R departing),
// 09L landing (09R departing) or 09R landing (09L departing). Each is found from its landing runway.
const CFG = EGLL.CONFIGS;
const configOf = rw => ({ '27R': 'west', '27L': 'west2', '09L': 'east', '09R': 'east2' })[rw] || 'west';
const cfgNow = () => configOf(S.rwy);
const isEast = c => c === 'east' || c === 'east2';
// the alternation's period now (egll.js altPlan): 'day' (one lands, the other departs), 'dual' (06:00 to 07:00: both
// land, departures from the morning's departure runway) or 'night' (23:30 to 06:00: one runway for everything)
let MODE_AT = null, MODE = 'day';
const modeNow = () => { const t = clockMs(); if (t == null) return 'day'; const k = Math.floor(t/60000);
  if (k !== MODE_AT) { MODE_AT = k; MODE = EGLL.altPlan(t).mode; } return MODE; };
const landOf = (c = cfgNow()) => CFG[c].land, depOf = (c = cfgNow()) => modeNow() === 'night' && c === cfgNow() ? CFG[c].land : CFG[c].dep;

// ═════════════════════════ taxiways, holding points, stands (egll-ground.js) ═════════════════════════
const inF0 = (e, n) => { const p = EN(e, n); return [mOf(p), offOf(p)]; };
for (const [id, e, n] of G.nodes) gn(id, ...inF0(e, n));
for (const [id, e, n] of G.rnodes) gn(id, ...inF0(e, n));
for (const [a, b, tw, mid, line] of G.edges) { const k = GE.length; chain(a, mid.map(([e, n]) => inF0(e, n)), b, tw); markLine(k, line); }
const HOLDS = {}, FIL = {};
for (const [k, [node, rwy, on, m, off, dirs, end, tw]] of Object.entries(G.holds)) {
  HOLDS[k] = { node, rwy, on, m, off, dirs: dirs.split(','), end: end || null, ref: k.replace(/~\d+$/, ''), tw };
  const Rh = RWY_LIST.find(R => R.id === on) || R0;            // hlink is m/off in its own runway's frame: carry it into R0's
  chain(rwy, (G.hlink[k] || []).map(([m, o]) => { const p = Rh.rm(m, o); return [mOf(p), offOf(p)]; }), node, HOLDS[k].ref);
  FIL[k] = { W: G.fil[k], E: G.fil[k] };                  // the mapped centreline-to-taxiway curve, used either way
}
// the taxiways across the runway ends (Link 41 over the 27L threshold between November 1 and Sierra 1, and the links at
// the west ends) run behind the departures lining up there, through their holding points: the route searches cross the
// runways along their length instead (N4/S4, N5/S5, the Link 47 crossings), unless the controller names the end one
for (const e of GE) for (const R of RWY_LIST) {
  const a = GN[e.a].p, b = GN[e.b].p, oa = R.offOf(a), ob = R.offOf(b);
  if (Math.sign(oa) === Math.sign(ob) || Math.abs(oa) > 300 || Math.abs(ob) > 300) continue;
  const m = (R.mOf(a) + R.mOf(b))/2; if (m < 500 || m > R.len - 500) e.k = (e.k || 1) + 2500/Math.max(e.len/M2NM, 1);
}
// the runway-holding positions: a path point there stops the aircraft until cleared onto or across the runway
for (const [id, rid] of Object.entries(G.hs)) if (GN[id]) GN[id].p.hs = rid;
// stands (AD 2-EGLL-2-1): Terminal 2 (2xx), Terminal 3 (3xx), Terminal 4 (4xx), Terminal 5 (501-568: A, B and C), the
// Terminal 5 remote stands (572-596), the cargo stands (6xx) and the east remote stands (7xx). Stands numbered with an
// L or R are the two halves of a MARS stand: two narrowbodies side by side, or one widebody on the centre line.
const STANDS = G.gates.map(([id, term, [e, n], node, hdg, line]) => { const p = EN(e, n), rem = term === 'R' || term === 'C' || term === 'E';
  return { id, term, p, m: mOf(p), off: offOf(p), node, area: rem ? 'remote' : 'civil', occ: null, noLead: !line, h0: hdg,
    line: line ? line.map(([e, n]) => EN(e, n)) : null }; });
const marsBase = id => id.replace(/[LR]$/, '');
// a MARS stand's three lead-in lines are painted parallel: OpenStreetMap often has the L and R lines a few degrees off,
// drawn to a common point on the taxilane. Each line keeps its taxilane end and length and turns onto the centre line's
// heading (or the halves' mean heading where there is no centre line); the stand turns with it.
{ const groups = new Map();
  for (const s of STANDS) if (s.line && s.h0 != null) { const b = marsBase(s.id); if (!groups.has(b)) groups.set(b, []); groups.get(b).push(s); }
  for (const g of groups.values()) {
    if (g.length < 2) continue;
    const c = g.find(s => !/[LR]$/.test(s.id)), ref = c ? c.h0 : Math.atan2(g.reduce((a, s) => a + Math.sin(s.h0*D2R), 0), g.reduce((a, s) => a + Math.cos(s.h0*D2R), 0))*R2D;
    for (const s of g) {
      const d = ((ref - s.h0 + 540) % 360) - 180; if (Math.abs(d) < 0.5 || Math.abs(d) > 15) continue;
      const o = s.line[0], rot = q => { const r = dist(...o, ...q), b = brg(...o, ...q) + d; return add(o, b, r); };
      s.line = s.line.map((q, i) => i ? rot(q) : q); s.p = rot(s.p); s.h0 = (s.h0 + d + 360) % 360;
    }
  } }
STANDS.forEach(s => { s.lp = GN[s.node].p; s.hdg = s.h0 ?? brg(...s.lp, ...s.p); });
// the mapped stand line ends where the nose stops: the stand's point is the aircraft's middle, set back from that end by
// the stop-bar distance of the largest aircraft the stand takes (as at Madrid and Manchester)
{ const at = new Map();
  for (const t of STANDS) {
    const u = dirv(t.hdg); let lat = Infinity, near = Infinity;
    for (const o of STANDS) { if (o === t || marsBase(o.id) === marsBase(t.id)) continue;
      const dx = (o.p[0] - t.p[0])/M2NM, dy = (o.p[1] - t.p[1])/M2NM, al = dx*u[0] + dy*u[1], la = Math.abs(dx*u[1] - dy*u[0]);
      if (Math.abs(al) < 30 && la > 10) lat = Math.min(lat, la);
      if (la > 10 || Math.abs(al) > 10) near = Math.min(near, Math.hypot(dx, dy)); }
    const w = clamp(Math.min(isFinite(lat) ? lat : 45, near*1.1) - 1, 30, 82), sb = clamp(w + 6, 24, 80)*0.56 - 4;
    t.lat = isFinite(lat) ? lat : 90;
    at.set(t, add(t.p, t.hdg + 180, Math.min(sb, Math.max(0, dist(...t.lp, ...t.p)/M2NM - 15))*M2NM));
  }
  for (const [t, p] of at) { t.p = p; t.m = mOf(t.p); t.off = offOf(t.p); } }
// the largest wingspan each stand takes: twice the room to the stand beside it (not its own MARS halves), less half a
// narrowbody's span for the aircraft there and a few metres' clearance (ICAO code C 4.5 m, E 7.5 m). A MARS centre
// stand gets the whole width of its two halves.
for (const t of STANDS) t.maxSpan = Math.round(clamp(2*t.lat - 36 - 6, 30, 82));
// a stand line that ends on a taxiway centreline would leave the tail across it: such stands slide back along their
// line to the nearest spot at least 14 m clear (none at Heathrow at the time of writing; kept for the OSM refreshes)
{ const body = (c, h) => [add(c, h, 19*M2NM), add(c, h + 180, 19*M2NM), add(c, h - 90, 18*M2NM), add(c, h + 90, 18*M2NM)];
  for (const t of STANDS) {
    const u = t.hdg;
    const lanes = GE.filter(e => !e.bare && e.tw !== 'APRON' && dist(...GN[e.a].p, ...GN[e.b].p) > 1e-7 && segDistM(t.p, GN[e.a].p, GN[e.b].p) < 150);
    const clr = c => { const [n, tl, wl, wr] = body(c, u); let m = Infinity; for (const e of lanes) { const a = GN[e.a].p, b = GN[e.b].p; m = Math.min(m, segSegM(n, tl, a, b), segSegM(wl, wr, a, b)); } return m; };
    if (clr(t.p) >= 12) continue;
    const r0 = dist(...t.lp, ...t.p)/M2NM; let best = null;
    for (let r = 22; r <= 95; r++) { const c = add(t.lp, u, r*M2NM), k = clr(c), sc = k >= 14 ? 1000 - Math.abs(r - r0) : k; if (!best || sc > best.sc) best = { sc, c }; }
    t.p = best.c; t.m = mOf(t.p); t.off = offOf(t.p);
  } }
const APRONS = G.aprons.map(r => r.map(([e, n]) => inF0(e, n)));
const TERM_NAME = { '2': 'Terminal 2', '3': 'Terminal 3', '4': 'Terminal 4', '5': 'Terminal 5', R: 'Terminal 5 remote stands', C: 'cargo stands', E: 'east remote stands' };
// which side of each runway its exits are on: the side most of its holds are (the north runway's exits are all on the
// south side, along Alpha; the south runway has exits both sides, N to the Central Area and S to Terminal 4)
for (const R of RWY_LIST) { const o = Object.values(HOLDS).filter(H => H.on === R.id && !H.end).reduce((a, H) => a + Math.sign(H.off), 0); R.side = o >= 0 ? 1 : -1; }
// the south runway's exits for the Central Area are the N ones (north side)
RWY_LIST[1].side = Math.sign(HOLDS.N6 ? HOLDS.N6.off : 1);

// taxiway names: letters spoken one by one (AY5 "Alfa Yankee 5"), digits as numbers; Link 58 by name; the intermediate
// holding points with names (SNAPA, COBRA, LOKKI) as words
const NATO = { A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike',
  N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu' };
const twyWords = t => { const b = t.replace(/~\d+$/, ''), k = b.match(/^LINK(\d+)$/); if (k) return 'Link ' + k[1];
  if (/^[A-Z]{4,}$/.test(b)) return b[0] + b.slice(1).toLowerCase();
  const w = b.match(/^([A-Z]+)(\d+)([EW])$/); if (w) return [...w[1]].map(x => NATO[x]).join(' ') + ' ' + w[2] + ' ' + (w[3] === 'E' ? 'East' : 'West');
  return (b.match(/[A-Z]|\d+/g) || [b]).map(x => NATO[x] || x).join(' '); };
const PHON = {};
for (const e of GE) if (e.tw && e.tw !== 'APRON' && !PHON[e.tw]) PHON[e.tw] = twyWords(e.tw);
for (const k of Object.keys(HOLDS)) PHON[k] = twyWords(k);
for (const [id] of G.ihps) PHON[id] = twyWords(id);
PHON.APRON = 'the apron';

// ── each aircraft's runway. A departure leaves from the departure runway, or from the runway its holding point is on
// when the controller taxied it to the landing runway; an arrival lands on the landing runway unless cleared for the other
const endHolds = rw => Object.keys(HOLDS).filter(k => HOLDS[k].end === rw);
// an intersection departure point for runway rw: a holding point along it (not at its end) whose way on reaches the
// centreline facing the way it departs, without doubling back, with at least 2,400 m of runway ahead (N2E, S3 for 27L)
const LU_OK = new Map();
function luOk(k, rw){
  const ck = k + rw; if (LU_OK.has(ck)) return LU_OK.get(ck);
  const H = HOLDS[k], R = RWYS_BY_END(rw); let ok = false;
  if (H && H.on === R.id && !H.end) {
    const up = rw === R.lo, pts = [GN[H.node].p, ...holdLink(k), GN[H.rwy].p, ...filOut(k, up ? 'E' : 'W')], n = pts.length, m = R.mOf(pts[n-1]);
    ok = (up ? R.len - m : m) > 2400 && !doublesBack(pts) && Math.abs(angDiff(brg(...pts[n-2], ...pts[n-1]), crsOf(rw))) < 100;
  }
  LU_OK.set(ck, ok); return ok;
}
const fromNode = ac => ac.stand && !ac.leftStand ? ac.stand.node : (nearestNode([ac.x, ac.y], n => !/^R/.test(n.id)) || {}).id;
function depRwyOf(ac){
  const dep = depOf(), land = landOf();
  if (ac.depRwy && (ac.cto || ac.depRwy === dep || ac.depRwy === land)) return ac.depRwy;
  if (ac.hp && HOLDS[ac.hp] && HOLDS[ac.hp].on === RWYS_BY_END(land).id && HOLDS[ac.hp].on !== RWYS_BY_END(dep).id) return land;
  return dep;
}
// 06:00 to 07:00 both runways land: arrivals from the northern stacks (Bovingdon, Lambourne) to the northern runway,
// from the southern ones (Biggin, Ockham) to the southern runway
const NORTH_RWY = new Set(['27R', '09L']), NORTH_STACK = new Set(['BNN', 'LAM']);
const landRwyOf = ac => { const land = landOf();
  if (modeNow() !== 'dual' || !ac || ac.kind !== 'ARR') return land;
  return NORTH_STACK.has(HOLD_AT[ac.gate]) === NORTH_RWY.has(land) ? land : parallelOf(land); };

// departure entries: the holding points at the departure end of the aircraft's runway, nearest by taxi route (one
// multi-target search, routesFrom)
function depHold(ac){
  const rw = depRw(ac), from = fromNode(ac), ks = endHolds(rw).length ? endHolds(rw) : Object.keys(HOLDS).filter(k => luOk(k, rw));
  if (ks.length < 2 || !from) return ks[0];
  const rs = routesFrom(from, ks.map(k => HOLDS[k].node)); let best = ks[0], bl = Infinity;
  ks.forEach(k => { const r = rs.get(HOLDS[k].node), L = r ? pathLen(r.nodes) : Infinity; if (L < bl) { bl = L; best = k; } });
  return best;
}
// nose-in stands: the tug pushes the tail back onto the taxilane, then 40 m along it the way the tail points
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
// exits for a landing runway: those the roll-out direction can turn into, in the order met; the runway's terminal
// side first (the north runway's all go south onto Alpha), then the far side (the south runway's S exits to Terminal 4)
function exitsFor(rw){
  const R = RWYS_BY_END(rw), up = rw === R.lo, thr = R.thr[rw];
  const ks = Object.keys(HOLDS).filter(k => { const H = HOLDS[k]; return H.on === R.id && H.dirs.includes(rw) && (up ? H.m > thr + 900 : H.m < thr - 900); });
  const near = ks.filter(k => Math.sign(HOLDS[k].off) === R.side), far = ks.filter(k => Math.sign(HOLDS[k].off) !== R.side);
  const order = a => a.sort((x, y) => (HOLDS[x].m - HOLDS[y].m)*(up ? 1 : -1));
  return [...order(near), ...order(far)];
}
// a name the controller says ("VAC A10W") to the exit of that taxiway on the aircraft's runway, ahead of it
function exitFor(ac, name){
  const rw = ac.app || landRw(ac), R = RWYS_BY_END(rw);
  if (HOLDS[name] && HOLDS[name].on === (ac.rwyId || R.id)) return name;
  const m = R.mOf([ac.x, ac.y]), dir = rw === R.lo ? 1 : -1;
  const ks = Object.keys(HOLDS).filter(k => (HOLDS[k].ref === name || HOLDS[k].tw === name) && HOLDS[k].on === R.id && (HOLDS[k].m - m)*dir > 20);
  return ks.sort((a, b) => (Math.sign(HOLDS[b].off) === R.side) - (Math.sign(HOLDS[a].off) === R.side) || (HOLDS[a].m - HOLDS[b].m)*dir)[0] || null;
}
// an arrival for Terminal 4 or the cargo area (south of the south runway) vacates the south runway on its south side
function vacPrefsFor(ac){
  const rw = ac && (ac.app || landRw(ac)) || S.rwy, ks = exitsFor(rw), R = RWYS_BY_END(rw);
  const south = ac && ac.stand && R === RWY_LIST[1] && ['4', 'C'].includes(ac.stand.term);
  return south ? [...ks.filter(k => Math.sign(HOLDS[k].off) !== R.side), ...ks.filter(k => Math.sign(HOLDS[k].off) === R.side)] : ks;
}

// ═════════════════════════ aerodrome drawing ═════════════════════════
// taxiways 23 m (ICAO code E; code F routes for the A380); runways 50 m
const AD_SITE = { pave: { w: 23 }, aprons: APRONS, roads: [], buildings: [], twyExtra: [], shoulder: [0, RWY_M], serviceRoad: false, paag: [], floods: [], twyLabels: [], hotspots: [], labels: [] };
const TERM_LABELS = (() => { const by = {}; for (const s of STANDS) if (s.area === 'civil') (by[s.term] ||= []).push(s.p); return Object.entries(by).map(([t, ps]) => [TERM_NAME[t].toUpperCase(), ps.reduce((a, p) => [a[0] + p[0]/ps.length, a[1] + p[1]/ps.length], [0, 0])]); })();
// the lead-on and lead-off lines in map coordinates, worked out once (one per distinct fillet)
let LEADS = null;
const leadPts = () => LEADS || (LEADS = (() => { const seen = new Set(), out = [];
  for (const k in FIL) { const f = FIL[k].W, key = HOLDS[k].on + JSON.stringify(f); if (seen.has(key)) continue; seen.add(key);
    const R = rwyById(HOLDS[k].on); out.push(leadLine(f).map(p => R.rm(...p))); }
  return out; })());
// where a holding position line at offset o from runway R, near m, crosses the taxiways: [from, to] along the runway
// for each, overlapping ones joined
function holdSpan(R, m, o){
  const IMG = mapImagery(), iv = [];
  for (const e of GE) {
    if (e.tw === 'APRON') continue; const pa = GN[e.a].p, pb = GN[e.b].p, oa = R.offOf(pa), ob = R.offOf(pb);
    if ((oa - o)*(ob - o) > 0 || oa === ob) continue;
    const t = (o - oa)/(ob - oa), ma = R.mOf(pa), mb = R.mOf(pb), mx = ma + (mb - ma)*t; if (Math.abs(mx - m) > 60) continue;
    const sin = Math.abs(ob - oa)/Math.hypot(mb - ma, ob - oa), half = (IMG ? paveWidth(e.tw) : 23)/2/Math.max(sin, 0.3);
    iv.push([mx - half, mx + half]);
  }
  if (!iv.length) return [[m - 11, m + 11]];
  iv.sort((a, b) => a[0] - b[0]); const out = [iv[0].slice()];
  for (const [a, b] of iv.slice(1)) { const L = out[out.length - 1]; if (a <= L[1] + 1) L[1] = Math.max(L[1], b); else out.push([a, b]); }
  return out;
}
function drawEgll(){
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
    cx.lineWidth = lw(44); for (const s of STANDS) { pathP(s.line || [s.lp, s.p], false); cx.stroke(); }
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
      // ICAO Annex 14: threshold stripes (14 on a 50 m runway), aiming point at 400 m, touchdown zone bars in threes, twos
      // and ones to 900 m, arrows down the centreline before each displaced threshold (09L and 09R, about 305 m)
      for (const [m0, dir] of [[R.thr[R.lo], 1], [R.thr[R.hi], -1]]) {
        quad(m0, -hw, m0 + dir*3, hw);
        for (let i = 0; i < 7; i++) for (const k of [-1, 1]) { const o = k*(3 + i*(hw - 3)/7); quad(m0 + dir*6, o, m0 + dir*36, o + k*1.8); }
        for (const k of [-1, 1]) quad(m0 + dir*400, k*7, m0 + dir*460, k*16);
        for (const [d, n] of [[150, 3], [300, 3], [600, 2], [750, 2], [900, 1]]) for (const k of [-1, 1]) for (let j = 0; j < n; j++) {
          const o = k*(7 + j*3); quad(m0 + dir*d, o, m0 + dir*(d + 22.5), o + k*1.8);
        }
        const pre = dir > 0 ? m0 : R.len - m0;
        if (pre > 60) {
          cx.lineWidth = lw(0.9);
          for (let d = 30; d < pre - 15; d += 60) { const m = m0 - dir*d; pathP([R.rm(m - dir*18, 0), R.rm(m, 0)], false); cx.stroke(); pathP([R.rm(m - dir*8, -3), R.rm(m, 0), R.rm(m - dir*8, 3)], false); cx.stroke(); }
          for (const k of [-1, 1]) { const m = m0 - dir*8; pathP([R.rm(m - dir*10, k*6), R.rm(m, k*10), R.rm(m - dir*10, k*14)], false); cx.stroke(); }
        }
      }
      for (const [rw, m0] of [[R.lo, R.thr[R.lo] + 60], [R.hi, R.thr[R.hi] - 60]]) drawRwyDesignator(...P2(R.rm(m0, 0)), rw, crsOf(rw), Math.max(9, 14*mpx));
    }
    // lead-on and lead-off lines: the mapped fillet curves carried over the runway to its centreline
    { const leads = leadPts().map(l => l.map(p => P2(p))); groundLines(lw(0.35), () => leads.forEach(strokeSmooth)); }
    // taxiway centrelines, stopping at the runway edges
    paintEdgeLines(lw(0.35));
    // runway holding positions (pattern A): two solid and two dashed lines across the taxiway, parallel to the runway
    // painted from edge to edge of the pavement they cross: an angled taxiway (A4) is wider along the runway than
    // across itself, and where two taxiways meet at the holding position (a fillet beside the straight) both are covered
    cx.strokeStyle = C.yellow; cx.lineWidth = lw(0.3);
    for (const [id, rid] of Object.entries(G.hs)) {
      const n = GN[id]; if (!n) continue; const R = rwyById(rid), m = R.mOf(n.p), o = R.offOf(n.p), s = Math.sign(o);
      for (const [d, dash] of [[0.9, false], [0.3, false], [-0.3, true], [-0.9, true]]) { cx.setLineDash(dash ? [mpx + 1, mpx + 1] : []); for (const [a, b] of holdSpan(R, m, o + s*d)) { pathP([R.rm(a, o + s*d), R.rm(b, o + s*d)], false); cx.stroke(); } }
      cx.setLineDash([]);
    }
    // stand lead-in lines and numbers
    groundLines(lw(0.3), () => { for (const s of STANDS) if (!s.noLead) { pathP(s.line || [s.lp, s.p], false); cx.stroke(); } });
    if (IMG) { cx.save(); clipOut(G.buildings.map(b => b.pts.map(([e, n]) => P2(EN(e, n))))); drawStandDetail(null, null, mpx); cx.restore(); }   // stand paint stops at the terminal walls
    else if (sc > 600) { cx.fillStyle = rgba('lab', .8); cx.font = `600 ${Math.max(9, 4*mpx)}px ${FONT_L}`; for (const s of STANDS) { const [X, Y] = P2(s.p); cx.fillText(s.id, X + 3, Y - 3); } }
    drawGroundSigns();
  }
}
// lights and terminal names: drawn every frame over the airfield layer (in the dark theme the lights add their glow to
// what is under them, so they can't go in the layer)
function drawEgllTop(){
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
const DIR = EGLL.DIR, GATES = Object.keys(DIR);
const STAR_FIXES = new Set(Object.values(EGLL.STARS).flatMap(s => s.pts.map(p => p[0])));
const SID_ENDS = new Set(Object.values(EGLL.SIDS).map(s => s.pts[s.pts.length - 1][0]));
// the computed SID turn points and gates and the missed approach points are hidden; the RNP intermediate fixes drawn small
const CALC = id => /^[A-Z]\d{3}[A-Z]\d+$/.test(id) || /^MA\d\d[LR]$/.test(id);
for (const [id, p] of Object.entries(EGLL.FIX)) if (!EGLL.NAV[id]) wp(id, p[0], p[1], STAR_FIXES.has(id) || SID_ENDS.has(id) ? {} : { minor: true });
for (const id of Object.keys(EGLL.FIX)) if (CALC(id)) WP[id].hide = true;
for (const [id, n] of Object.entries(EGLL.NAV)) wp(id, ...n.p, { note: `${n.name} ${n.freq}` });
const RADAR_REF = ARP;
const STAR_OF = g => EGLL.STARS[DIR[g].star];
const starFrom = g => { const pts = STAR_OF(g).pts.map(p => p[0]); return pts.slice(Math.max(0, pts.indexOf(DIR[g].entry))); };
// the London holds (7-18, 7-19) and their levels: the shape AI Approach stacks arrivals in
for (const [id, h] of Object.entries(EGLL.HOLDS_AIR)) WP[id].hold = { inb: Math.round(h.inb), min: h.min, left: h.turn === 'L' };
const ENTRY = Object.fromEntries(GATES.map(g => [g, WP[DIR[g].entry].p]));
const ENTRY_ALT = Object.fromEntries(GATES.map(g => [g, DIR[g].alt]));
const PRE_ALT = Object.fromEntries(GATES.map(g => [g, DIR[g].alt + 12000]));
const HOLD_AT = Object.fromEntries(GATES.map(g => [g, STAR_OF(g).pts[STAR_OF(g).pts.length - 1][0]]));

// ── approaches. The charts give the ILS from the intermediate fix (about 10 NM, 3,000 ft) and the final approach point
// (D7.5, 2,500 ft), but Heathrow Director joins the localiser further out: about 14 NM from touchdown at 4,000 ft
// (well east over London for the 27s), the continuous descent approach meeting the 3° glidepath at about 12 NM. The
// final starts 3 NM before that joining point. The approach controller's "four miles" check: an arrival not visual
// goes around there.
const JOIN_NM = 14, JOIN_ALT = 4000;
const FINAL = {};
for (const [rw, I] of Object.entries(EGLL.ILS)) {
  const thr = THR[rw], out = norm(crsOf(rw) + 180), dIF = dist(...thr, ...WP[I.ifx].p), elev = THR_ELEV[rw], low = Math.round((elev + 1000)/100)*100;
  const J = 'J' + rw; WP[J] = { id: J, p: add(thr, out, JOIN_NM), hide: true, note: `${JOIN_NM} mile final ${rw}` };
  const F = { pts: [add(thr, out, JOIN_NM + 3), WP[J].p, add(thr, out, dIF), thr], alts: [JOIN_ALT, JOIN_ALT, Math.round(elev + 50 + dIF*318), elev + 50], elev,
    entry: J, entryName: `a ${JOIN_NM} mile final`, name: 'ILS ' + rw, alt: JOIN_ALT,
    decName: 'four miles', decNM: 4, decMin: 2.6, minAlt: low, minText: `${low.toLocaleString('en-GB')} ft`,
    mins: I.mins, minRate: 300, missed: [I.missed[0]], missAlt: I.missed[1],
    phrase: r => `cleared ILS approach runway ${r}`, read: r => `cleared ILS ${r}`,
    decCall: r => `${APT.tower[0]}, four miles, ILS runway ${r}`, decNeed: 'Four miles, needs landing clearance', decFail: 'not visual at the decision height' };
  F.cum = new Array(F.pts.length).fill(0); for (let i = F.pts.length - 2; i >= 0; i--) F.cum[i] = F.cum[i+1] + dist(...F.pts[i], ...F.pts[i+1]);
  const meet = (JOIN_ALT - elev - 50)/318;                   // 3° = 318 ft per NM
  F.prof = [[0, elev + 50], [meet, JOIN_ALT], [F.cum[0] + 1, JOIN_ALT]];
  FINAL[rw] = F;
}
// ── from the stack to the joining point: a downwind and base laid out beside the final (hidden points, the vectors
// Heathrow Director gives), so an arrival with no instructions still gets there
const FEED_ALT = {};
function feeder(rw, from){
  const thr = THR[rw], out = norm(crsOf(rw) + 180), J = 'J' + rw;
  const f = WP[from].p, dx = f[0] - thr[0], dy = f[1] - thr[1], ux = Math.sin(out*D2R), uy = Math.cos(out*D2R);
  const along = dx*ux + dy*uy, right = dx*uy - dy*ux, s = right >= 0 ? 1 : -1;
  const pt = (a, l) => add(add(thr, out, a), out + 90, l);
  // the downwind 1,000 ft above the joining altitude, the base at it. The two runways' finals are 0.8 NM apart, so
  // each runway's downwind is laid out on its own side.
  const tag = `${rw}${s > 0 ? 'R' : 'L'}`, mk = (k, p, note) => { WP[tag + k] = { id: tag + k, p, hide: true, note }; FEED_ALT[tag + k] = JOIN_ALT + (k === 'B' ? 0 : 1000); return tag + k; };
  if (along > JOIN_NM + 3 && Math.abs(right) < 2.5) return [J];
  const base = mk('B', pt(JOIN_NM + 4, s*3.5), `base for ${rw}`);
  if (along > JOIN_NM + 3) return [base, J];
  const dw2 = mk('D', pt(JOIN_NM + 3, s*8), `downwind for ${rw}`);
  if (along > 1) return [dw2, base, J];
  return [mk('A', pt(1, s*8), `downwind for ${rw}`), dw2, base, J];
}
const RWY_ENDS4 = ['27R', '27L', '09L', '09R'];
const ARR_ROUTE = Object.fromEntries(GATES.map(g => [g, Object.fromEntries(RWY_ENDS4.map(rw => {
  const star = starFrom(g);
  return [rw, [...star, ...feeder(rw, star[star.length - 1])]];
}))]));

// ── departures: a SID for each direction from each runway, flown from 500 ft to 6,000 ft (the transition altitude)
const sidName = (gate, rwy) => (DIR[gate] || DIR.S).sid[rwy || depRw()] || DIR.S.sid['27L'];
const sidSpoken = n => (EGLL.SIDS[n] || {}).spoken || n;
const sidTopOf = n => Math.max(...((EGLL.SIDS[n] || {}).pts || [[0, 6000]]).map(p => p[1] || 0));
const exitRoute = (g, rwy) => EGLL.SIDS[sidName(g, rwy)].pts.map(p => p[0]);
const EXIT_ROUTE = {}, EXIT_FIX = {};
for (const g of GATES) {
  Object.defineProperty(EXIT_ROUTE, g, { enumerable: true, get: () => exitRoute(g, depRw()) });
  Object.defineProperty(EXIT_FIX, g, { enumerable: true, get: () => { const r = exitRoute(g, depRw()); return r[r.length - 1]; } });
}
const NEXT_UNIT = Object.fromEntries(GATES.map(g => [g, EGLL.CTR[DIR[g].ctr]]));
const relUnit = ac => 'London';
const TEL = EGLL.TEL;
const isMil = ac => false;
const gateFor = ap => EGLL.PLACE_DIR[ap] || 'S';

// ═════════════════════════ schedule ═════════════════════════
const withGate = x => ({ ...x, gate: x.gate || gateFor(x.k === 'ARR' ? x.o : x.d) });
const TIMETABLE = EGLL.TIMETABLE;
const REGS = { C56X: 'G-LHRX', GLF6: 'G-LHRG' };
const LONG_STAY = EGLL.LONG_STAY;
const EXTRA = EGLL.EXTRA.map(withGate);
const EXERCISES = Object.fromEntries(Object.entries(EGLL.EXERCISES).map(([k, e]) => ['h' + k, { ...e, sched: e.sched.map(withGate) }]));
const WX_PRESETS = EGLL.WX_PRESETS;

// ═════════════════════════ weather rules ═════════════════════════
// strong south-westerlies bring turbulence and windshear on short final over the Hounslow and Staines rooftops
const TURB_TABLE = {};
function turbExcess(w){
  if (w.vrb || w.spd < 15) return 0;
  return Math.max(0, Math.max(w.spd, (w.gust || 0)*0.85) - 25);
}
// ILS CAT III on every runway end: RVR 75 m, no decision height
const minsOk = (w, rw) => { const m = (EGLL.ILS[rw] || EGLL.ILS['27R']).mins; return w.vis >= m.vis && w.ceil >= m.ceil; };
const sraMinsOk = w => minsOk(w, '27R');
// the session's clock: the time the position opened (or opens), for the runway alternation
function clockMs(){
  if (S.running && S.start) return S.start + S.t*1000;
  const ts = document.getElementById('trafficSel'), mode = ts ? ts.value : '';
  if (EXERCISES[mode]) return null;
  if (/^live/.test(mode)) return Date.now();
  const d = +((document.getElementById('daySel') || {}).value || 0), h = +((document.getElementById('hourSel') || {}).value || 12);
  return Date.UTC(2026, 9, 5 + d, Math.floor(h));
}
// the alternation's plan for this time (egll.js altPlan). tail: which way has more than 5 kt of tailwind
const tailOf = w => { const calm = w.vrb || w.spd < 4; return { 27: !calm && windComp(w, crsOf('27R')).headG <= -5, '09': !calm && windComp(w, crsOf('09L')).headG <= -5 }; };
const planNow = tail => { const t = clockMs(); if (t != null) return EGLL.altPlan(t, tail);
  const land = tail[27] ? '09L' : '27R'; return { mode: 'day', land, dep: parallelOf(land), lands: [land] }; };
// the landing runway this time, westerly or easterly (the Flow buttons)
const altLandNow = east => planNow({ 27: east, '09': !east }).land;
// the direction: westerly preferred (noise); easterly when the tailwind on 27 would exceed 5 kt (at night the week's
// runway, flown the other way round when the wind needs it). Either way the landing runway is the alternation's.
function rwyFor(w){ const P = planNow(tailOf(w)); return { land: P.land, dep: P.dep }; }
const depFor = rw => modeNow() === 'night' ? rw : CFG[configOf(rw)].dep;
// the alternation as the clock runs (UK local time): 06:00 both runways land, 07:00 one lands and one departs, 15:00
// they swap, 23:30 one runway for everything until 06:00. By day the direction stays as it is; at night the wind picks it
let altWas = null;
function stepAlternation(){
  if (!S.running || EXERCISES[S.mode]) { altWas = null; return; }
  const east = isEast(cfgNow()), P = modeNow() === 'night' ? planNow(tailOf(S.wx)) : planNow({ 27: east, '09': !east }), key = P.mode + P.land;
  if (altWas && key !== altWas) {
    if (P.land !== S.rwy) setRwy(P.land);
    else if (S.depRwy !== depFor(S.rwy)) { S.depRwy = depFor(S.rwy); nextAtis(false); renderAtis(); emit('rwy', S.rwy); }
    sys(P.mode === 'night' ? `Night-time runway alternation: runway ${P.land} for landing and departure until 06:00.`
      : P.mode === 'dual' ? `06:00, the arrivals rush: both runways for landing until 07:00, departures from ${P.dep}.`
      : `Runway alternation${altWas.startsWith('dual') ? ', 07:00' : ''}: runway ${P.land} for landing, ${P.dep} for departure.`);
  }
  altWas = key;
}
// central London's towers (the City and Canary Wharf, up to 1,016 ft at the Shard): the 27 approaches cross them high
const CITY = [[51.520, -0.115], [51.520, -0.065], [51.512, -0.010], [51.498, -0.005], [51.497, -0.030], [51.503, -0.090], [51.505, -0.115]].map(LL);

// ═════════════════════════ engine hooks ═════════════════════════
// the terminal an airline uses; overflow to the nearest other terminal (Terminal 5's to Terminal 3, as British Airways
// does, then the Terminal 5 remote stands)
const termOf = ac => EGLL.TERMINAL_OF[ac.cs.slice(0, 3)] || '2';
const SPILL = { '5': ['3', 'R', '2'], '3': ['2', '5'], '2': ['3', '4'], '4': ['C', '2', '3'] };
const fits = (s, ac) => !s.maxSpan || (ac.perf && ac.perf.span || 36) <= s.maxSpan + 1;
function standAt(ac, t){
  // the smallest stand that takes it: a narrowbody leaves the widebody stands (and the MARS centres) free
  const free = STANDS.filter(s => s.term === t && standFree(s, ac) && fits(s, ac)).sort((a, b) => a.maxSpan - b.maxSpan);
  const best = free.filter(s => s.maxSpan <= free[0].maxSpan + 6);
  return best[Math.floor(Math.random()*Math.min(best.length, 6))] || null;
}
const flowText = c => `land ${CFG[c].land}, depart ${CFG[c].dep}`;
const APT = {
  arrAlt: { ...arrAltOf(GATES.map(STAR_OF)), ...FEED_ALT, ...Object.fromEntries(Object.keys(FINAL).map(rw => ['J' + rw, JOIN_ALT])) },   // STAR levels, then the downwind, base and joining point
  icao: 'EGLL', name: 'London Heathrow', coordName: 'Heathrow', radarName: 'LHR',
  get utcOff(){ const t = clockMs(); return EGLL.londonOff(t == null ? Date.now() : t)/60; },   // BST or GMT
  radar: [EGLL.UNITS.app.name, EGLL.UNITS.app.freq], depRadar: ['London Control', EGLL.CTR.w[1]],
  tower: [EGLL.UNITS.twr.name, EGLL.UNITS.twr.freq],
  gnd: [EGLL.UNITS.gnd.name, EGLL.UNITS.gnd.freq],
  runways: RWY_LIST, rwyHalfWidth: 25,
  ihps: G.ihps.map(([id, node]) => ({ id, node })),
  xing: false, drawnTown: false, ta: EGLL.TA, initClimb: 6000, gaAlt: 3000, appAlt: 3000, handoffNM: 12, climbFL: 150, divertAlt: 7000,
  area: { dep: 45, arr: 80, div: 45 }, roll: [70, RWY_M - 70], defRwy: '27R', defWx: 'west',
  appName: 'ILS approach', appShort: 'ILS', minsText: 'weather below the approach minima', reqApp: rw => 'ILS approach',
  minsLong: 'Visibility is below even the ILS CAT III minima (RVR 75 m).',
  liveName: 'Heathrow Airport', liveThin: 30, atisFreq: EGLL.UNITS.atis.freq, turbName: 'Heathrow',
  sessionHours: Array.from({ length: 17 }, (_, i) => i + 5),   // 0500Z to 2100Z: 06:00 to 22:00 in London
  view: { app: [0, 0, 80], twr: [0, -0.4, 4.2], gnd: [mOf(EN(-200, -650)), offOf(EN(-200, -650)), 5200, 3600] },
  minsOk,
  // the landing runway and the departure runway: S.rwy lands, S.depRwy departs
  splitRwy: true, rwyFor, depFor, configOf: rw => isEast(configOf(rw)) ? 'E' : 'W',
  // the Flow buttons pick the direction only: the alternation picks which runway lands (read when the panel is drawn)
  rwyConfigs: [false, true].map(east => ({ key: east ? 'E' : 'W', name: east ? 'Easterly' : 'Westerly',
    get land(){ return altLandNow(east); }, get lands(){ const P = planNow({ 27: east, '09': !east }); return P.lands; }, get deps(){ return [depFor(this.land)]; } })),
  depRwyOf, landRwyOf,
  activeRwys: () => [landOf(), depOf()],   // the same runway twice at night
  depRwys: () => [depOf(), landOf()],
  appRwys: () => [landOf(), parallelOf(landOf())],
  // segregated parallel runways 1,415 m apart: a departure off one and an arrival on (or going around from) the other
  // are separated by the SID and missed-approach turns, which diverge
  sepOk: (a, b, d) => { const [x, y] = a.kind === 'DEP' ? [a, b] : [b, a];
    return x.kind === 'DEP' && y.kind === 'ARR' && x.depRwy && (y.app || y.gaRwy) && RWYS_BY_END(x.depRwy) !== RWYS_BY_END(y.app || y.gaRwy)
      && dist(x.x, x.y, ...ARP) < 6 && dist(y.x, y.y, ...ARP) < 6; },
  exitRouteOf: ac => exitRoute(ac.gate, ac.depRwy || depRw(ac)),
  // Heathrow's SIDs are pre-coordinated with London Control: no individual departure releases
  needRel: ac => false,
  sidAlt: ac => sidTopOf(ac.sid),
  onStep: stepAlternation,
  // stands: the airline's terminal, the smallest stand that takes the aircraft. Remote stands for long turnarounds
  remoteAreas: ['remote'],
  areaNames: { civil: 'terminal stands', remote: 'remote stands' },
  termName: t => (TERM_NAME[t] || 'Terminal ' + t).replace(/^./, c => c.toUpperCase()),
  remoteWord: s => 'remote stand',
  prefArea: ac => { const t = termOf(ac); return { key: t, name: TERM_NAME[t], has: s => s.term === t }; },
  standFor: ac => { const t = termOf(ac); for (const u of [t, ...(SPILL[t] || ['2'])]) { const s = standAt(ac, u); if (s) return s; } return null; },
  // first descent: the stack's floor
  inboundAlt: g => 7000,
  divertTo: ac => ['N', 'NW', 'W'].includes(ac.gate) ? ['Luton', 'BNN'] : ['NE', 'ESE'].includes(ac.gate) ? ['Stansted', 'LAM'] : ['Gatwick', 'OCK'],
  firstAlt: g => ENTRY_ALT[g] - 2000,
  rolledCall: 'request taxi',
  vacExits: ac => { const rw = ac.app || landRw(ac), R = RWYS_BY_END(rw), m = R.mOf([ac.x, ac.y]), dir = rw === R.lo ? 1 : -1;
    return exitsFor(rw).filter(k => (HOLDS[k].m - m)*dir > 30).slice(0, 4); },
  vacPrefs: (st, ac) => vacPrefsFor(ac),
  exitFor,
  lineUpWords: hp => 'line up and wait',
  terrain: { name: 'the City towers', poly: CITY, min: 2000, low: 1500, msg: ac => `${ac.cs} is over the City of London at ${Math.round(ac.alt)} ft (the Shard 1,016 ft, minimum 2,000 ft)${ac.alt < 1500 ? ', TERRAIN' : ''}.` },
  restricted: null,
  drawAirport: drawEgll, drawAirportTop: drawEgllTop,
  gaEarly(ac, rw){},
  // missed approach: climb to 3,000 ft; 27R turns right onto 315°, 27L and 09L turn left (146°, 035°), 09R straight on
  gaTurn(ac){ const rw = ac.gaRwy, F = FINAL[rw] || FINAL['27R'], I = EGLL.ILS[rw] || EGLL.ILS['27R'];
    if (ac.alt > ELEV + 900 || dist(ac.x, ac.y, ...(THR[rw] || ARP)) > 3) { ac.gaTurn = true; ac.mode = 'NAV'; ac.route = F.missed.slice(); ac.turnDir = I.turn; ac.tgtAlt = ac.cleared = Math.max(ac.cleared || 0, F.missAlt); } },
  // conventional SIDs flown by RNAV substitution: straight ahead on the runway track, then the route from 500 ft
  liftoff(ac){ ac.tgtHdg = Math.round(crsOf(ac.depRwy)); ac.turnDir = 0; },
  depTurn(ac){ if (!ac.turned && ac.alt >= ELEV + 500) ac.turned = true; },
  depClear: ac => !!ac.turned,
  shear(ac, rw, w){ return turbExcess(w) > 4 && Math.random() < 0.2 ? 'windshear on short final' : null; },
  shearWhy: rw => 'windshear on short final',
  faceHold: (st, f) => depHold({ stand: st, leftStand: false, x: st.p[0], y: st.p[1] }),
  faceWord: f => f,
  faceHdg: (st, f) => norm(laneDir(st, f) + 180),          // taxilanes run every way here: name the face by the compass
  // the departure-end holding points of the aircraft's runway nearest it, the intersection departure points, then the
  // landing runway's end (single-runway operation)
  taxiHolds: (south, ac) => { const rw = ac ? depRw(ac) : depRw(), p = ac ? (ac.stand && !ac.leftStand ? ac.stand.lp : [ac.x, ac.y]) : ARP;
    const near = ks => ks.sort((a, b) => dist(...p, ...GN[HOLDS[a].node].p) - dist(...p, ...GN[HOLDS[b].node].p));
    const other = [depOf(), landOf()].find(r => r !== rw), rec = ac && depHold(ac);
    const isx = near(Object.keys(HOLDS).filter(k => luOk(k, rw))).filter((k, i, a) => a.findIndex(j => HOLDS[j].node === HOLDS[k].node) === i);
    return [...new Set([rec, ...near(endHolds(rw)).slice(0, 2), ...isx.slice(0, 2), ...near(endHolds(other)).slice(0, 1)].filter(Boolean))].slice(0, 6); },
  luOk: (k, rw) => luOk(k, rw),
  taxiHint: rw => ({ '27L': 'Runway 27L departures enter at Sierra 1 (south side, from Terminal 4) or November 1 (north side, from the Central Area); intersection departures from November 2 East or Sierra 3.',
    '27R': 'Runway 27R departures enter at Alfa 1 or Alfa 2 at the east end, along Alfa from Terminal 5 and the Central Area.',
    '09R': 'Runway 09R departures enter at November 11 (north side) or Sierra 11 (south side, from Terminal 4) at the west end.',
    '09L': 'Runway 09L departures enter at Alfa 13 at the west end, by Terminal 5.' })[rw] + ' Terminal 4 and cargo traffic crosses the southern runway when told: hold short unless cleared to cross.',
  // medical diversions: flights crossing the London area
  diverts: [{ cs: 'EIN152', t: 'A20N', o: 'EIDW', gate: 'NW', to: 'Amsterdam' }, { cs: 'KLM1001', t: 'B738', o: 'EHAM', gate: 'NE', to: 'Dublin' },
    { cs: 'AFR1080', t: 'A320', o: 'LFPG', gate: 'S', to: 'Edinburgh' }, { cs: 'ICE450', t: 'B38M', o: 'BIKF', gate: 'N', to: 'Paris' }],
  airports: EGLL.AIRPORTS, via: {},
  airlineIcao: EGLL.AIRLINE_ICAO, airlineType: EGLL.AIRLINE_TYPE, defType: 'A320',
  placeIcao: EGLL.PLACES,
  // UK phraseology (CAP 413) from the engine, with Heathrow's own: the SID's 6,000 ft stop altitude in the clearance,
  // start-up and push from Heathrow Ground
  phr: {
    push: (ac, dn, face) => { const top = sidTopOf(ac.sid);
      return [`cleared to ${dn} via ${sidSpoken(ac.sid)} departure, runway ${depRw(ac)}, climb ${altWords(top)}, squawk ${ac.sqk}, start-up and push back approved, facing ${faceSay(ac, face)}, QNH ${S.wx.qnh}`,
        `cleared ${dn}, ${sidSpoken(ac.sid)}, runway ${depRw(ac)}, altitude ${altShort(top)}, squawk ${ac.sqk}, start and push approved facing ${faceSay(ac, face)}, QNH ${S.wx.qnh}`]; },
    startReq: ac => `${EGLL.UNITS.gnd.name}, stand ${ac.stand.id}, ${ac.perf.name} to ${AP[ac.d] ? AP[ac.d][2] : ac.d}, information ${phonetic(S.atis)}, request start-up and push back`,
    checkIn: ac => `${APT.radar[0]}, ${greet()}, ${altShort(Math.round(ac.alt/100)*100)} descending ${altShort(ac.tgtAlt)}, ${DIR[ac.gate] ? DIR[ac.gate].star.replace(/ (\d)([A-Z])$/, ' $1 $2') + ' arrival' : 'inbound ' + ac.route[0]}, information ${phonetic(S.atis)}`,
    vacated: ac => `${EGLL.UNITS.gnd.name}, runway ${rwyName(ac.rwyId)} vacated via ${PHON[ac.exit] || ac.exit.replace(/~\d+$/, '')}, request taxi${ac.stand ? ' to stand ' + ac.stand.id : ''}`,
    taxiIn: (ac, st, vw) => { const k = xingAhead(ac), hs = k >= 0 ? `, hold short runway ${rwyName(ac.path.pts[k].hs)}` : '', via = vw.length ? ' via ' + vw.map(t => PHON[t] || t).join(', ') : '';
      return [`taxi to stand ${st.id}${via}${hs}`, `stand ${st.id}${via}${hs}`]; },
    taxiHold: (ac, h, vw) => { const via = vw.length ? ' via ' + vw.map(t => PHON[t] || t).join(', ') : '', r = h.rwy ? rwyName(HOLDS[h.id].on) : null, at = hpWords(h.id);
      return r ? [`taxi to holding point ${at}${via}, hold short runway ${r}`, `holding point ${at}${via}, holding short ${r}`] : [`taxi to holding point ${at}${via}`, `holding point ${at}${via}`]; },
    atHoldPt: (ac, h) => h.rwy ? `holding short runway ${rwyName(HOLDS[h.id].on)} at ${hpWords(h.id)}` : `holding at ${hpWords(h.id)}`
  },
  atisPanel(w){
    const c = cfgNow(), cw = Math.abs(windComp(w, crsOf(S.rwy)).crossG), bad = !minsOk(w, S.rwy), r = rwyFor(w);
    return `<div class="warnline${bad ? ' bad' : ''}">${CFG[c].name}: ${flowText(c)}${isEast(configOf(r.land)) && !isEast(c) ? ' (wind favours the easterly)' : isEast(c) && !isEast(configOf(r.land)) ? ' (wind favours the westerly)' : ''} · ${bad ? 'below the ILS minima' : 'ILS approaches'} · crosswind ${Math.round(cw)} kt. ${({ east: 'Departures enter 09R at November 11 or Sierra 11.', east2: 'Departures enter 09L at Alfa 13.' })[c] || ''} Runway alternation at 15:00. Terminal 4 traffic crosses the southern runway.</div>`;
  },
  atisLines({ w, L, E, wind, vis, cloud }){
    const c = cfgNow();
    const out = [
      `This is Heathrow information ${L}, time ${zt(S.t).slice(0,5).replace(':', '')}.`,
      `Runways in use: landing ${CFG[c].land}, departures ${CFG[c].dep}. ILS approach runway ${CFG[c].land}.`,
      `Surface wind ${wind}. Visibility ${vis}. ${cloud}.`,
      `Temperature ${w.temp}, dew point ${w.dew}. QNH ${w.qnh} hectopascals. Transition level ${w.qnh < 977 ? 'flight level 90' : w.qnh < 995 ? 'flight level 80' : 'flight level 70'}.`
    ];
    if (w.vis < 600) out.push('Low visibility procedures in force.');
    if (turbExcess(w) > 0) out.push('Moderate turbulence and windshear reported on final.');
    if (E && E.ws) out.push(`Windshear reported on final runway ${E.ws.rw} at ${zt(E.ws.t).slice(0,5).replace(':', '')}, ${E.ws.text}.`);
    if (E && E.rwyBlock) out.push(`Runway ${blockRw()} closed: ${E.rwyBlock.why}. ${parallelEnd(blockRw()) ? `Arrivals expect runway ${parallelEnd(blockRw())}, departures continue on the other runway.` : "Expect delays."}`);
    if (!minsOk(w, S.rwy)) out.push('Visibility below the ILS minima. Expect holding at Bovingdon, Lambourne, Biggin or Ockham.');
    out.push('Runway alternation in progress: the landing runway changes at 15:00.');
    out.push('Traffic for Terminal 4 and the cargo area crosses the southern runway: hold short unless cleared to cross.');
    out.push(`Acknowledge receipt of information ${L} and advise aircraft type and stand on first contact.`);
    return out;
  },
  // the website: home hero, previews, scenario cards and Academy figures
  site: {
    hero: () => [
      ['BAW117', 51.48, -0.30, 270, 170, PAL.light.arr], ['VIR4', 51.62, -0.55, 116, 230, PAL.light.arr], ['QTR7', 51.33, -0.05, 302, 230, PAL.light.arr],
      ['BAW478', 51.46, -0.60, 255, 200, PAL.light.dep], ['UAE2', 51.53, -0.70, 296, 240, PAL.light.dep],
      ['DLH909', 51.30, -0.25, 140, 380, 'rgba(60,75,95,.7)'], ['EIN163', 51.62, -0.95, 300, 430, 'rgba(60,75,95,.7)'], ['AFR1381', 51.20, -0.60, 180, 420, 'rgba(60,75,95,.7)']
    ],
    demo(mk, park){
      const fin = add(THR['27R'], CRS['09L'], 2.6), out = add(THR['27L'], CRS['27L'], 3.5), inb = add(WP.BNN.p, 116, 5);
      const hk = endHolds('27L')[0], hp = GN[HOLDS[hk].node].p;
      const st = id => (STANDS.find(s => s.id === id) || STANDS.find(s => s.term === '5')).id;
      return [
        mk('BAW478', 'A320', 'DEP', park(st('518'), { need: null, reqAt: 99999 })), mk('BAW916', 'A20N', 'DEP', park(st('522'), { need: null, reqAt: 99999 })),
        mk('KLM1010', 'B738', 'DEP', park(st('406'), { need: null, reqAt: 99999 })), mk('UAE2', 'A388', 'DEP', park(st('335'), { need: null, reqAt: 99999 })),
        mk('DLH909', 'A321', 'DEP', { ground: true, state: 'HOLDPT', hp: hk, x: hp[0], y: hp[1], hdg: CRS['27L'], gs: 0 }),
        mk('BAW117', 'B77W', 'ARR', { state: 'FINAL', mode: 'FINAL', app: '27R', freq: 'TWR', x: fin[0], y: fin[1], hdg: CRS['27R'], alt: ELEV + 830, gs: 150, vs: -800, o: 'KJFK' }),
        mk('EIN163', 'A20N', 'DEP', { state: 'CLIMB', x: out[0], y: out[1], hdg: CRS['27L'], alt: ELEV + 2500, gs: 200, vs: 2000, tgtAlt: 6000, d: 'EIDW' }),
        mk('VIR4', 'A35K', 'ARR', { state: 'INBOUND', x: inb[0], y: inb[1], hdg: 116, alt: 8000, gs: 230, vs: -1000, tgtAlt: 7000, o: 'KJFK' })
      ];
    },
    thumb(k, zoom, W){
      if (k === 'app') return v => { v.scale *= 1.3; };
      if (k === 'twr') { const c = EN(0, -700); return v => { v.cx = c[0]; v.cy = c[1]; v.scale = W/4.0; }; }
      const s = STANDS.find(s => s.id === '518') || STANDS[0], c = zoom === 'apron' ? s.p : EN(-1100, -650);
      return v => { v.cx = c[0]; v.cy = c[1]; v.scale = W/((zoom === 'apron' ? 700 : 3000)*M2NM); };
    },
    figHold: 'BNN', emergHp: 'N1',
    figConsole: v => { v.scale *= 1.2; },
    cmdHint: 'Command, e.g. BAW117 H270 A40 · BAW478 TAXI S1 · QTR7 CROSS · / to focus, Tab cycles flights'
  }
};
// maintenance hangars (OpenStreetMap): British Airways' engineering base and the Virgin and United hangars at the east
// end, between the runways. Aircraft stored there at the start of a session are towed to a stand at their airline's
// terminal an hour before departure; the door is the nearest taxilane node.
APT.hangars = [[2447, -453, 'British Airways hangar'], [2665, -451, 'British Airways hangar'], [1886, -871, 'British Airways Fleet Support Unit'],
  [2123, -636, 'Virgin hangar'], [2289, -458, 'United Airlines hangar']]
  .map(([e, n, name]) => [e, n, name, (nearestNode(EN(e, n), nd => !/^R|^x/.test(nd.id)) || {}).id])
  .filter(([, , , node]) => node && GN[node])
  .map(([e, n, name, node], i) => ({ id: 'H' + (i + 1), name, in: inF0(e, n), door: [GN[node].m, GN[node].off], node, to: ['civil'],
    fits: ac => /^(BAW|VIR|UAL)$/.test(ac.cs.slice(0, 3)) ? ac.cs.slice(0, 3) === ({ 'Virgin hangar': 'VIR', 'United Airlines hangar': 'UAL' }[name] || 'BAW') : false,
    pick: ac => APT.standFor(ac) }));
