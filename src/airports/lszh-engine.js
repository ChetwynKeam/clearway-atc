// ═════════════════════════ Zurich (LSZH) airport profile for the engine ═════════════════════════
// Builds every global the engine reads from the chart data in lszh.js (LSZH) and the aerodrome in lszh-ground.js (metres
// east and north of the ARP). Adapted from the Schiphol engine (eham-engine.js). Three runways, each with its own frame:
// 16/34 (the longest, 3,700 m), 14/32 (3,300 m) and 10/28 (2,500 m, crossing 16/34). The runways in use are an operating
// concept (PREF in lszh.js): north by day (land 14 and 16, depart 28 and 16, or 10 with bise), east in the evening (land 28,
// depart 32 and 34) and south in the early morning (land 34, depart 32 and 28), with the second landing or take-off runway
// open in the Swiss hub's inbound and outbound waves. S.rwy is the first landing runway, S.depRwy the first take-off
// runway; the runway operations panel can set every runway end on its own.
Object.assign(TYPES, LSZH.TYPES);
const LL = p => xy(p[0], p[1]);
const G = LSZH_GROUND;
const EN = (e, n) => [e*M2NM, n*M2NM];                     // metres east and north of the ARP (the map origin) → NM

// ═════════════════════════ runways ═════════════════════════
// a frame along each runway: m from the pavement end a (the low-numbered end), off to the left
const STOPWAY = {};
function rwyFrame(r){
  const a = EN(...r.a), b = EN(...r.b), L = dist(...a, ...b), RU = [(b[0]-a[0])/L, (b[1]-a[1])/L], RN = [-RU[1], RU[0]];
  const rm = (m, off=0) => [a[0] + (RU[0]*m + RN[0]*off)*M2NM, a[1] + (RU[1]*m + RN[1]*off)*M2NM];
  const mOf = p => ((p[0]-a[0])*RU[0] + (p[1]-a[1])*RU[1])/M2NM, offOf = p => ((p[0]-a[0])*RN[0] + (p[1]-a[1])*RN[1])/M2NM;
  const len = r.len, sw = STOPWAY[r.id] || [0, 0];
  const TURN_W = [[30, 0]], TURN_E = [[len - 30, 0]];
  return { id: r.id, lo: r.lo, hi: r.hi, len, m0: -sw[0], m1: len + sw[1], thr: r.thr, elev: r.elev, rm, mOf, offOf, RU, TURN_W, TURN_E, TURN_END: { W: 30, E: len - 30 },
    roll: [70, len - 70], ends: true, width: r.width || 45 };
}
// 16/34 first: the runway the engine falls back on
const RWY_LIST = ['1634', '1432', '1028'].map(id => rwyFrame(G.runways.find(r => r.id === id)));
const R0 = RWY_LIST[0];
const rm = R0.rm, mOf = R0.mOf, offOf = R0.offOf, RU = R0.RU;
const RWY_M = R0.len, THR_LO_M = R0.thr['16'], THR_HI_M = R0.thr['34'];
const RW_LO = '16', RW_HI = '34';
const THR = {}, CRS = {}, THR_ELEV = {};
for (const R of RWY_LIST) {
  THR[R.lo] = R.rm(R.thr[R.lo], 0); THR[R.hi] = R.rm(R.thr[R.hi], 0);
  CRS[R.lo] = brg(...R.rm(0), ...R.rm(R.len)); CRS[R.hi] = norm(CRS[R.lo] + 180);
  THR_ELEV[R.lo] = R.elev[R.lo]; THR_ELEV[R.hi] = R.elev[R.hi];
}
const T_LO = THR[RW_LO], T_HI = THR[RW_HI], CRS_LO = CRS[RW_LO], CRS_HI = CRS[RW_HI];
const crsOf = rw => CRS[rw] ?? CRS_HI;
const ELEV = LSZH.elev;
const ARP = LL(LSZH.arp);
const parallelOf = rw => undefined;
const XING_M = -1e9, XING_SKEW = 0, XING_HW = 0, xingM = o => XING_M;
const FRONTIER = [], R164 = [], ROCK = [], ROCK_TOP = [0, 0];
const TURN_W = R0.TURN_W, TURN_E = R0.TURN_E, TURN_END = R0.TURN_END, TURN_PAD = {};
const RWYS_BY_END = rw => RWY_LIST.find(R => R.lo === rw || R.hi === rw) || R0;

// ═════════════════════════ the clock: Zurich time ═════════════════════════
// Central European Time, UTC+1, and summer time UTC+2 from the last Sunday of March to the last Sunday of October
const lastSun = (y, mo) => { const d = new Date(Date.UTC(y, mo + 1, 0)); return Date.UTC(y, mo, d.getUTCDate() - d.getUTCDay(), 1); };
const amsOff = ms => { const y = new Date(ms).getUTCFullYear(); return ms >= lastSun(y, 2) && ms < lastSun(y, 9) ? 120 : 60; };
function clockMs(){
  if (S.running && S.start) return S.start + S.t*1000;
  const ts = document.getElementById('trafficSel'), mode = ts ? ts.value : '';
  if (EXERCISES[mode]) return null;
  if (/^live/.test(mode)) return Date.now();
  const d = +((document.getElementById('daySel') || {}).value || 0), h = +((document.getElementById('hourSel') || {}).value || 12);
  return Date.UTC(2026, 9, 5 + d, Math.floor(h));   // as start() sets S.start
}
// the local weekday (0 Sunday): the German ordinance's weekend hours apply on Saturdays and Sundays
const localDay = () => { const t = clockMs(); if (t == null) return 1; return new Date(t + amsOff(t)*60000).getUTCDay(); };
const localMin = () => { const t = clockMs(); if (t == null) return null; const L = new Date(t + amsOff(t)*60000); return L.getUTCHours()*60 + L.getUTCMinutes(); };

// ═════════════════════════ the operating concepts ═════════════════════════
// The concept in use comes from the table for the time of day (PREF in lszh.js): by day the north concept (bise: departures
// off 10; a westerly: the east concept), in the German ordinance period (from 21:00 weekdays, 20:00 weekends) the east
// concept (the south concept when 28 is below its 4,300 m) and in the early morning (06:00 to 07:00, 09:00 at weekends)
// the south concept. The first whose runways all meet the wind limits and keep to the restrictions is the one in use.
// How many of its runways are open is the hub's wave for the time (PEAKS, CAP): an inbound wave (L) lands on L1 and L2,
// an outbound wave (S) departs from S1 and S2, between waves (O) and in the evening and early morning (N) one of each.
// S.rwy is L1; the Flow buttons choose a concept (APT.setConfig), else the one the rules give for S.rwy.
const PREF = LSZH.PREF, ALLP = [...PREF.day, ...PREF.night.filter(c => !PREF.day.some(d => d.k === c.k))];
const inLocal = ([a, b], m) => a <= b ? m >= a && m < b : m >= a || m < b;
const exNow = () => { const ts = document.getElementById('trafficSel'); return ts && EXERCISES[ts.value] || (S.running && EXERCISES[S.mode]) || null; };
const dvoOf = () => LSZH.DVO[[0, 6].includes(localDay()) ? 'weekend' : 'week'];
// day, night (the German ordinance, the evening) or morning (from 06:00 to the end of the ordinance period)
const periodNow = () => { const m = localMin(); if (m == null) return 'day'; const D = dvoOf();
  if (!inLocal(D, m)) return 'day'; return m >= 6*60 && m < D[1] ? 'morning' : 'night'; };
const tableOf = per => PREF[per] || PREF.day;
// the capacity declaration's mode now (an exercise sets its own; without a clock, off-peak)
function modeNow(){
  const m = localMin();
  if (m == null) { const E = exNow(); return E && E.peak || 'O'; }
  if (inLocal(dvoOf(), m)) return 'N';
  const r = LSZH.PEAKS.find(([a, b]) => m >= a && m < b); return r ? r[2] : 'O';
}
const visOf = w => w.vis < LSZH.VIS.limited[0] || w.ceil < LSZH.VIS.limited[1] ? 'limited' : w.vis >= LSZH.VIS.good[0] && w.ceil >= LSZH.VIS.good[1] ? 'good' : 'marginal';
// the uniform daylight period: from 15 minutes before sunrise to 15 minutes after sunset (the sun about 3° below the horizon)
const udpNow = () => true;
const wetOf = w => (w.wx || []).some(x => /RA|DZ|SN|SG|PL|GR|GS|UP/.test(x));
const gustOf = w => ({ ...w, gust: w.gust && w.gust - w.spd >= LSZH.WIND.gust ? w.gust : 0 });
function windOk(w, rw){
  if (w.vrb ? w.spd <= 6 : w.spd < 4) return true;
  const c = windComp(gustOf(w), crsOf(rw)), tail = wetOf(w) ? LSZH.WIND.tailWet : LSZH.WIND.tail;
  return Math.round(c.headG) >= -tail && Math.round(c.crossG) <= LSZH.WIND.cross && !(Math.round(c.headG) <= -tail && tail > 0 && Math.round(c.crossG) >= LSZH.WIND.cross);
}
// a runway not to be used this way now (AD 2.21 para 5.1)
// a runway not to be used this way now: never (no approach to 10 or 32; no take-off off 14), 14 and 16 for arrivals in the
// German ordinance period, 34 for arrivals outside it (its approach leads into uncontrolled airspace), 28 for arrivals
// below 4,300 m visibility
const rwyBanned = (rw, role, m = localMin(), w = S.wx) => LSZH.ONEWAY[role].includes(rw)
  || (role === 'arr' && m != null && inLocal(dvoOf(), m) && ['14', '16'].includes(rw))
  || (role === 'arr' && rw === '34' && m != null && !inLocal(dvoOf(), m))
  || (role === 'arr' && rw === '28' && w && w.vis < LSZH.MINS.V28.vis);
// the runways a preference opens in a mode (single: one landing and one take-off runway whatever the mode)
function usedOf(c, M, w, single){
  const lim = visOf(w) === 'limited';
  return { land: !single && M === 'L' && c.l[1] && !lim ? c.l.slice(0, 2) : [c.l[0]], dep: !single && M === 'S' && c.s[1] ? c.s.slice(0, 2) : [c.s[0]] };
}
// whether a preference can be used: its conditions, its runways' wind and the restrictions
function prefOk(c, w, M, single, strict = true){
  const v = visOf(w);
  if (c.need === 'udp' && !(v === 'good' && udpNow())) return false;
  if (c.need === 'good' && v !== 'good') return false;
  if (c.conv && w.ceil <= 2000) return false;
  const u = usedOf(c, M, w, single);
  if (strict && (u.land.some(r => rwyBanned(r, 'arr')) || u.dep.some(r => rwyBanned(r, 'dep')))) return false;
  return [...u.land, ...u.dep].every(r => windOk(w, r));
}
// the preference the rules give: the first of the table in force that passes, in full, then with one runway each way;
// then the other table's (the night procedures kept on to 06:30 while the day table's runways are still restricted, or
// a night runway in the day when the wind rules out every day preference); then, no other runway being usable (AD 2.21
// para 5.1 allows it), whatever restriction it breaks; at worst the one with the least crosswind and tailwind
function bestPref(w = S.wx, M = modeNow(), T = tableOf(periodNow())){
  const U = T === PREF.day ? PREF.night : PREF.day, NM = T === PREF.day ? 'N' : 'O';
  for (const [L, m, single, strict] of [[T, M, false, true], [T, M, true, true], [U, NM, true, true], [T, M, false, false], [T, M, true, false], [U, NM, true, false]]) {
    const c = L.find(c => prefOk(c, w, m, single, strict)); if (c) return { c, single: single || L !== T }; }
  const bad = r => { const k = windComp(gustOf(w), crsOf(r)); return k.crossG - Math.min(0, k.headG)*3; };
  return { c: ALLP.slice().sort((a, b) => Math.max(bad(a.l[0]), bad(a.s[0])) - Math.max(bad(b.l[0]), bad(b.s[0])))[0], single: true };
}
// the preference in use with L1 on a given runway: the one chosen on the Flow buttons, else the first that passes
let MANUAL = null, PCACHE = { key: null, v: null };
function prefFor(rw, w = S.wx){
  const M = modeNow(), per = periodNow(), key = [rw, MANUAL, w.raw, w.dir, w.spd, w.gust, w.vis, w.ceil, M, per, Math.floor((localMin() ?? 0)/10)].join('|');
  if (rw === S.rwy && PCACHE.key === key) return PCACHE.v;
  const T = tableOf(per), mine = T.filter(c => c.l[0] === rw);
  let v = null;
  const man = MANUAL && ALLP.find(c => c.k === MANUAL && c.l[0] === rw);
  if (man) v = { c: man, single: !prefOk(man, w, M, false, false) && prefOk(man, w, M, true, false) };
  if (!v) { const b = bestPref(w, M, T); if (b.c.l[0] === rw) v = b; }
  if (!v) for (const single of [false, true]) { const c = mine.find(c => prefOk(c, w, M, single, true)) || mine.find(c => prefOk(c, w, M, single, false)); if (c) { v = { c, single }; break; } }
  if (!v) { const c = mine[0] || ALLP.find(c => c.l[0] === rw) || ALLP.find(c => c.l.includes(rw)) || T[0]; v = { c, single: !mine[0] }; }
  v = { ...v, ...usedOf(v.c, M, w, v.single), M };
  if (rw === S.rwy) PCACHE = { key, v };
  return v;
}
const cfgNow = () => prefFor(S.rwy);
const configOf = rw => prefFor(rw).c.k;
const landList = () => cfgNow().land;
const depList = () => { const P = cfgNow(); return S.depRwy && !P.c.s.includes(S.depRwy) ? [S.depRwy] : P.dep; };
const depFor = rw => prefFor(rw).dep[0];
const depOf = () => S.depRwy || depFor(S.rwy);
function rwyFor(w){ const b = bestPref(w); const u = usedOf(b.c, modeNow(), w, b.single); return { land: b.c.l[0], dep: u.dep[0] }; }
// the clock (APT.onStep): at 23:00 and 06:00 local the night or day table comes in; at each change of mode the second
// runway opens or closes. The achieved rates are counted here, for the ATIS panel.
const MOVES = { arr: [], dep: [] };
let stepWas = null, hooked = false;
const hmLocal = m => String(Math.floor(m/60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const zOf = m => { const t = clockMs(); const off = t == null ? 60 : amsOff(t), z = ((m - off) % 1440 + 1440) % 1440; return String(Math.floor(z/60)).padStart(2, '0') + String(z % 60).padStart(2, '0') + 'Z'; };
const prefText = P => `the ${(P.c.name || P.c.k).toLowerCase()}${P.single && P.c.l.length + P.c.s.length > 2 ? ' (one runway each way)' : ''}: land ${P.land.join(' and ')}, depart ${P.dep.join(' and ')}`;
function stepPref(){
  if (!hooked && typeof S !== 'undefined' && S.listeners) { hooked = true;
    S.listeners.push((ev, d) => { if (ev === 'start') { MOVES.arr = []; MOVES.dep = []; stepWas = null; } else if (ev === 'rwy') stepWas = null; else if (ev === 'landed') MOVES.arr.push(S.t); else if (ev === 'takeoff') MOVES.dep.push(S.t); }); }
  if (!S.running || exNow()) { stepWas = null; return; }
  const per = periodNow(), M = modeNow(), P0 = cfgNow(), key = [per, M, P0.c.k, P0.land, P0.dep].join('|');
  if (stepWas && key !== stepWas && !S.rops) {
    const m = localMin(), at = `${hmLocal(m)} local (${zOf(m)})`, [wasPer, wasM] = stepWas.split('|');
    if (wasPer !== per) {
      MANUAL = null; PCACHE.key = null;
      const b = bestPref(S.wx); S.rwy = b.c.l[0]; const P = prefFor(S.rwy); S.depRwy = P.dep[0];
      sys(per === 'night' ? `${at}: the German ordinance period begins (no approaches to 14 or 16 over Germany): ${prefText(P)}.` : per === 'morning' ? `${at}: early morning, the German ordinance still in force: ${prefText(P)}.` : `${at}: the ordinance period is over: ${prefText(P)}.`);
    } else {
      PCACHE.key = null; const P = cfgNow(); if (!P.dep.includes(S.depRwy)) S.depRwy = P.dep[0];
      if (wasM !== M) sys(`${at}: ${LSZH.CAP[M].name.toLowerCase().replace(/^./, c => c.toUpperCase())} (${M}), declared ${LSZH.CAP[M].arr} arrivals and ${LSZH.CAP[M].dep} departures an hour: ${prefText(P)}.`);
      else sys(`${at}: ${prefText(P)}.`);
    }
    nextAtis(false); rerouteArrivals(); renderAtis(); emit('rwy', S.rwy);
    const P1 = cfgNow(); stepWas = [periodNow(), modeNow(), P1.c.k, P1.land, P1.dep].join('|'); return;
  }
  stepWas = key;
}
const stepAprons = () => {};
// landings and take-offs in the last hour (scaled to an hour after the first 10 minutes)
function achieved(){
  const span = Math.min(3600, S.t), cut = S.t - 3600, n = L => L.filter(t => t > cut).length;
  if (span < 600) return null;
  return { arr: Math.round(n(MOVES.arr)*3600/span), dep: Math.round(n(MOVES.dep)*3600/span), min: Math.round(span/60) };
}
// the declared landing rate for the mode, with the runways actually open
const arrCap = () => { const P = cfgNow(), M = P.M; return M === 'L' && P.land.length < 2 ? LSZH.CAP.O.arr : LSZH.CAP[M].arr; };
const depCap = () => { const P = cfgNow(), M = P.M; return M === 'S' && P.dep.length < 2 ? LSZH.CAP.O.dep : LSZH.CAP[M].dep; };
// an arrival's landing runway: where two land (14 and 16 in an inbound wave), the one nearer its initial approach fix, unless that runway already has two or more inbounds more than the other, as
// the arrival manager balances the two landing runways. Chosen once per arrival (and again if the runways change).
const IAF_OF = g => (LSZH.STARS[(LSZH.DIR[g] || {}).star] || {}).iaf || 'GIPOL';
function landFor(ac){
  const L = landList(); if (L.length < 2 || !ac) return L[0];
  const sig = L.join(',');
  if (ac.ehL && ac.ehLs === sig && L.includes(ac.ehL)) return ac.ehL;
  const f = WP[IAF_OF(ac.gate)], side = f ? L.slice().sort((a, b) => dist(...f.p, ...THR[a]) - dist(...f.p, ...THR[b])) : L.slice();
  const load = rw => S.acs.filter(o => o !== ac && o.kind === 'ARR' && o.airborne && !o.handed && o.ehLs === sig && (o.app || o.ehL) === rw).length;
  const pick = load(side[0]) > load(side[1]) + 1 ? side[1] : side[0];
  if (S.acs.includes(ac)) { ac.ehL = pick; ac.ehLs = sig; }
  return pick;
}
// a departure's take-off runway: where two depart, the one whose heading is nearer the destination's bearing
function depForAc(ac){
  const D = depList(); if (!ac) return D[0];
  // the long hauls and heavies need the length: 16 (3,700 m) in the north concept, 34 in the east (28 is 2,500 m, 32 is
  // 3,300 m); "RWY 16/34 will only be assigned if requested for performance reasons" (Jeppesen 10-1P1)
  const heavy = ac.perf && (ac.perf.wake === 'H' || ac.perf.wake === 'J'), P = cfgNow();
  if (heavy) { const long = P.c.s.find(r => r === '16' || r === '34'); if (long && !rwyBanned(long, 'dep')) return long; }
  if (D.length < 2) return D[0];
  if (D.includes('16') && D.includes('28') || D.includes('16') && D.includes('10')) return D.find(r => r !== '16');
  const b = ac.d ? destBrg(ac.d) : null; if (b == null) return D[0];
  return D.slice().sort((x, y) => Math.abs(angDiff(crsOf(x), b)) - Math.abs(angDiff(crsOf(y), b)))[0];
}

// ═════════════════════════ taxiways, holding points, stands (eham-ground.js) ═════════════════════════
const inF0 = (e, n) => { const p = EN(e, n); return [mOf(p), offOf(p)]; };
for (const [id, e, n] of G.nodes) gn(id, ...inF0(e, n));
for (const [id, e, n] of G.rnodes) gn(id, ...inF0(e, n));
// a runway crossing (through an x node on the centreline) follows its holding points' own links to the runway edge, so it
// is an unpainted link (bare): drawn as those links and the runway, not as a lane of its own
// the P-holding (P1, P2, P3 between B and A, north-east of the D and E piers): three one-way lanes, flown from B
// towards A (south-west), where arrivals queue out of the way for a stand that is still occupied. ow: 1 a → b, -1 b → a
const P_LANES = {};
for (const [a, b, tw, mid] of G.edges) { const n0 = GE.length; chain(a, mid.map(([e, n]) => inF0(e, n)), b, tw);
  if (a[0] === 'x' || b[0] === 'x') for (let i = n0; i < GE.length; i++) GE[i].bare = true;
  const ow = P_LANES[a + '>' + b]; if (ow) for (let i = n0; i < GE.length; i++) GE[i].ow = ow; }
const HOLDS = {}, FIL = {};
const CAT23 = new Set(G.cat23 || []);
for (const [k, [node, rwy, on, m, off, dirs, end]] of Object.entries(G.holds)) {
  HOLDS[k] = { node, rwy, on, m, off, dirs: dirs.split(',').filter(Boolean), end: end || null, ref: k.replace(/~\d+$/, '') };
  HOLDS[k].base = ((G.hside || {})[HOLDS[k].ref] || [])[0];
  { const Rh = RWY_LIST.find(R => R.id === on) || RWY_LIST[0], n0 = GE.length;
    chain(rwy, ((G.hlink || {})[k] || []).map(([mm, oo]) => { const p = Rh.rm(mm, oo); return [mOf(p), offOf(p)]; }), node, HOLDS[k].base || HOLDS[k].ref);
    for (let i = n0; i < GE.length; i++) GE[i].hl = true; }
  FIL[k] = { W: G.fil[k], E: G.fil[k] };
}
const RET_NODES = new Set((G.ret || []).map(k => HOLDS[k] && HOLDS[k].node).filter(Boolean));
for (const [id, rid] of Object.entries(G.hs)) if (GN[id]) GN[id].p.hs = rid;
// stands (OpenStreetMap, the Jeppesen 10-9D list): Dock A, Dock B and Dock E (the midfield dock) with their jet bridges,
// the remote C, D, G, H, I, P, T and W stands (bus), the freight stands F and the general aviation sectors
const AREA_OF = { A: 'pier', B: 'pier', E: 'pier', C: 'remote', D: 'remote', G: 'remote', H: 'remote', I: 'remote', P: 'remote', T: 'remote', W: 'remote',
  F: 'cargo', GA: 'ga' };
const STANDS = G.gates.filter(g => g[7] !== 'TT' && g[7] !== 'DI').map(g => { const [id, term, [e, n], node] = g, p = EN(e, n), sp = +g[6] || null;
  return { id, term, p, m: mOf(p), off: offOf(p), node, area: AREA_OF[term] || 'remote', occ: null, noLead: !g[5], line: g[5] ? g[5].map(([x, y]) => EN(x, y)) : null,
    use: g[7], h0: g[4], ...(sp ? { maxSpan: Math.round(sp*10)/10 } : {}), ...((G.vac || {})[id] ? { vacant: G.vac[id] } : {}) }; });
// the AIP gives the stop position (the nose): the aircraft's middle is set back along the lead-in by half the length of
// the largest type the stand takes (never more than 40% of the lead-in)
STANDS.forEach(s => { s.lp = GN[s.node].p; const L = dist(...s.lp, ...s.p)/M2NM, half = s.maxSpan ? Math.min(34, Math.max(11, s.maxSpan*0.52)) : 20, k = Math.min(half, L*0.4);
  if (L > 12) { const u = [(s.lp[0] - s.p[0])/(L*M2NM), (s.lp[1] - s.p[1])/(L*M2NM)]; s.p = [s.p[0] + u[0]*k*M2NM, s.p[1] + u[1]*k*M2NM]; s.m = mOf(s.p); s.off = offOf(s.p); }
  s.hdg = L > 3 ? brg(...s.lp, ...s.p) : (s.h0 ?? 0); });
// the stand plan (as Bristol's): Docks A, B and E are contact stands, with jet bridges; every other stand is bussed. The
// largest span each takes is from the spacing of its row (lszh-ground.js); the stand tags show its ICAO code letter. The
// 777s, A340s, A350s and A330s of the long haul fit only the code E stands (Dock E, the widest of B, the remote D, G and T)
for (const s of STANDS) if (s.area === 'pier' || s.area === 'remote') s.contact = s.area === 'pier';
// two holding points' links that cross on the way to the runway (N3 and N9, the two rapid exits off 09/27 that make an X):
// a node where they cross, so the two lanes meet there (the turn from one to the other is far too sharp to take)
function crossLinks(){
  const isLink = e => e.hl || (e.a + e.b).includes('sk'), inner = v => v > 0.02 && v < 0.98;
  // where p-q meets a-b: [t along p-q, u along a-b, the point]
  const xpt = (p, q, a, b) => { const d = (q[0]-p[0])*(b[1]-a[1]) - (q[1]-p[1])*(b[0]-a[0]); if (Math.abs(d) < 1e-14) return null;
    const t = ((a[0]-p[0])*(b[1]-a[1]) - (a[1]-p[1])*(b[0]-a[0]))/d, u = ((a[0]-p[0])*(q[1]-p[1]) - (a[1]-p[1])*(q[0]-p[0]))/d;
    return t > -0.02 && t < 1.02 && u > -0.02 && u < 1.02 ? [t, u, [p[0] + t*(q[0]-p[0]), p[1] + t*(q[1]-p[1])]] : null; };
  const all = GE.filter(e => !e.bare && !/^R/.test(e.a) && !/^R/.test(e.b)), C = 0.06, grid = new Map(), key = (x, y) => x + ',' + y;
  for (const e of all) { const a = GN[e.a].p, b = GN[e.b].p;
    for (let x = Math.floor(Math.min(a[0], b[0])/C); x <= Math.floor(Math.max(a[0], b[0])/C); x++) for (let y = Math.floor(Math.min(a[1], b[1])/C); y <= Math.floor(Math.max(a[1], b[1])/C); y++) {
      const k = key(x, y); if (!grid.has(k)) grid.set(k, []); grid.get(k).push(e); } }
  const splits = new Map(), seen = new Set(), add = (e, t, id) => { if (!splits.has(e)) splits.set(e, []); if (!splits.get(e).some(([, v]) => v === id)) splits.get(e).push([t, id]); };
  let nX = 0;
  for (const e1 of all.filter(isLink)) { const a = GN[e1.a].p, b = GN[e1.b].p, cand = new Set();
    for (let x = Math.floor(Math.min(a[0], b[0])/C); x <= Math.floor(Math.max(a[0], b[0])/C); x++) for (let y = Math.floor(Math.min(a[1], b[1])/C); y <= Math.floor(Math.max(a[1], b[1])/C); y++) for (const e of grid.get(key(x, y)) || []) cand.add(e);
    for (const e2 of cand) { if (e1 === e2 || [e1.a, e1.b].some(v => v === e2.a || v === e2.b)) continue;
      if (e1.tw === e2.tw && !(e1.a + e1.b + e2.a + e2.b).includes('sk')) continue;   // a stop bar's own turn-offs, overlapping
      const pk = [GE.indexOf(e1), GE.indexOf(e2)].sort().join(); if (seen.has(pk)) continue; seen.add(pk);
      const r = xpt(a, b, GN[e2.a].p, GN[e2.b].p); if (!r) continue; const [t, u, q] = r;
      if (inner(t) && inner(u)) { const id = 'kx' + (nX++); gn(id, mOf(q), offOf(q)); add(e1, t, id); add(e2, u, id); }
      else if (inner(t)) add(e1, t, u < 0.5 ? e2.a : e2.b);      // e2 ends on e1: a T, joined there
      else if (inner(u)) add(e2, u, t < 0.5 ? e1.a : e1.b); } }
  for (const [e, ss] of splits) { const hl = e.hl, line = e.line; GE.splice(GE.indexOf(e), 1);
    GN[e.a].adj = GN[e.a].adj.filter(([, x]) => x !== e); GN[e.b].adj = GN[e.b].adj.filter(([, x]) => x !== e);
    const seq = [e.a, ...ss.sort((x, y) => x[0] - y[0]).map(([, id]) => id), e.b];
    for (let i = 1; i < seq.length; i++) { ge(seq[i-1], seq[i], e.tw); const ne = GE[GE.length - 1]; if (hl) ne.hl = true; if (line) ne.line = line; } }
}
joinGaps(); tFillets({ R: 30 }); kinkLinks(); smoothKinks(); crossLinks();
const APRONS = G.aprons.map(r => r.map(([e, n]) => inF0(e, n)));
{ const civ = STANDS.filter(s => s.area === 'pier'), c = civ.reduce((a, s) => [a[0] + s.p[0]/civ.length, a[1] + s.p[1]/civ.length], [0, 0]); for (const R of RWY_LIST) R.side = Math.sign(R.offOf(c)) || 1; }

// taxiway names as said: letter by letter with the digits as numbers (A19W "Alfa 19 Whiskey"); the intermediate holding
// positions as the AIP names them (VK "Victor Kilo")
const NATO = { A: 'Alfa', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', G: 'Golf', H: 'Hotel', I: 'India', J: 'Juliett', K: 'Kilo', L: 'Lima', M: 'Mike',
  N: 'November', O: 'Oscar', P: 'Papa', Q: 'Quebec', R: 'Romeo', S: 'Sierra', T: 'Tango', U: 'Uniform', V: 'Victor', W: 'Whiskey', X: 'X-ray', Y: 'Yankee', Z: 'Zulu' };
const twyWords = t => { const b = t.replace(/~\d+$/, '');
  return (b.match(/[A-Z]|\d+/g) || [b]).map(x => NATO[x] || x).join(' '); };
const PHON = {};
for (const e of GE) if (e.tw && e.tw !== 'APRON' && !PHON[e.tw]) PHON[e.tw] = twyWords(e.tw);
for (const k of Object.keys(HOLDS)) PHON[k] = twyWords(k);
const IHP_LIST = (G.ihps || []).filter(([id, node]) => GN[node]).map(([id, node]) => ({ id, node, ph: twyWords(id), alias: [] }));
for (const h of IHP_LIST) PHON[h.id] = h.ph;
for (const [k, [ref, w]] of Object.entries(G.hside || {})) { PHON[k] = twyWords(ref) + (w ? ', ' + w : ''); for (const v of Object.keys(HOLDS)) if (HOLDS[v].ref === k) PHON[v] = PHON[k]; }
PHON.APRON = 'the apron';

// ── departure entries: the holding points at the runway end (the full length) and the AIP's intersection take-off points
// (AD 2.13: S8, S6 ... on 24; E5, E4 ... on 18L), each only where the aircraft can turn onto the runway the way it departs
const endHolds = rw => Object.keys(HOLDS).filter(k => HOLDS[k].end === rw);
const intxRun = (k, rw) => { const tr = (G.tora || {})[rw + '|' + HOLDS[k].ref]; if (tr) return tr;
  const H = HOLDS[k], R = rwyById(H.on), m = R.mOf(GN[H.rwy].p); return rw === R.lo ? R.len - m : m; };
const intxWay = (k, rw) => HOLDS[k].dirs.includes(rw);
const intxHolds = rw => Object.keys(HOLDS).filter(k => { const H = HOLDS[k], R = RWYS_BY_END(rw);
    return H.on === R.id && !H.end && ((G.intx || {})[rw] || []).includes(H.ref) && intxWay(k, rw); })
  .sort((a, b) => intxRun(b, rw) - intxRun(a, rw));
const depHolds = rw => [...endHolds(rw), ...intxHolds(rw)];
const depHoldAs = (ac, hp) => { const rw = depRw(ac), ok = depHolds(rw); if (!HOLDS[hp] || ok.includes(hp)) return hp;
  return ok.find(k => HOLDS[k].ref === HOLDS[hp].ref) || hp; };
// a departure's holding point: the runway end nearest by the taxi route; a medium (not a heavy) may be sent to an
// intersection with 2,500 m or more of runway ahead when the queue at the end is long (34 from E8, 16 from E3): about a
// minute and a half for each aircraft already waiting there
function depHold(ac){
  const rw = depRw(ac), from = ac.stand && !ac.leftStand ? ac.stand.node : (nearestNode([ac.x, ac.y], n => !/^R/.test(n.id)) || {}).id;
  const ends = endHolds(rw).length ? endHolds(rw) : depHolds(rw), med = ac.perf && ac.perf.wake !== 'H' && ac.perf.wake !== 'J';
  const ks = med ? [...ends, ...intxHolds(rw).filter(k => intxRun(k, rw) >= 2500)] : ends;
  let best = ends[0], bl = Infinity;
  if (!from) return best;
  const q = k => S.acs.filter(o => o !== ac && o.kind === 'DEP' && !o.airborne && o.hp === k && /TAXI|HOLDPT|HELD|LINEUP/.test(o.state)).length;
  const rs = routesFrom(from, ks.map(k => HOLDS[k].node));
  // an intersection that needs a runway crossing to reach costs four minutes more (one the far side of a runway is no help)
  for (const k of ks) { const r = rs.get(HOLDS[k].node), L = r ? pathLen(r.nodes) : Infinity, x = r ? r.nodes.filter(id => /^x/.test(id)).length : 0, c = L/12*3600 + 90*q(k) + (ends.includes(k) ? 0 : 60 + 240*x);
    if (c < bl) { bl = c; best = k; } }
  return best;
}
function pushRec(ac){
  const st = ac.stand, h = depHold(ac), to = h && HOLDS[h].node; if (!to) return 'east';
  const len = f => { const r = route(st.node, to, undefined, norm(laneDir(st, f) + 180)); return r ? pathLen(r.nodes) : Infinity; };
  const opts = ['east', 'west', 'north', 'south'].map(f => [f, len(f)]).sort((a, b) => a[1] - b[1]);
  if (opts[0][1] < Infinity) return opts[0][0];
  const r = route(st.node, to);
  if (!r || r.nodes.length < 2) return 'east';
  const b = brg(...st.lp, ...GN[r.nodes[1]].p), off = f => Math.abs(angDiff(norm(laneDir(st, f) + 180), b));
  return ['east', 'west', 'north', 'south'].sort((x, y) => off(x) - off(y))[0];
}
// the side of the runway an arrival vacates to: the terminal's, or its stand's
function sideFor(ac, R){
  if (!ac || !ac.stand) return R.side;
  const o = R.offOf(ac.stand.p); return Math.abs(o) > 60 ? Math.sign(o) : R.side;
}
function exitsFor(rw, ac){
  const R = RWYS_BY_END(rw), up = rw === R.lo, thr = R.thr[rw], side = sideFor(ac, R);
  const ks = Object.keys(HOLDS).filter(k => { const H = HOLDS[k]; return H.on === R.id && H.dirs.includes(rw) && (up ? H.m > thr + 600 : H.m < thr - 600); });
  const near = ks.filter(k => Math.sign(HOLDS[k].off) === side), far = ks.filter(k => Math.sign(HOLDS[k].off) !== side);
  const order = a => a.sort((x, y) => (HOLDS[x].m - HOLDS[y].m)*(up ? 1 : -1));
  return [...order(near), ...order(far)];
}
function exitFor(ac, name){
  const rw = ac.app || landRw(ac), R = RWYS_BY_END(rw);
  if (HOLDS[name] && HOLDS[name].on === (ac.rwyId || R.id)) return name;
  const m = R.mOf([ac.x, ac.y]), dir = rw === R.lo ? 1 : -1, side = sideFor(ac, R);
  const ks = Object.keys(HOLDS).filter(k => (HOLDS[k].ref === name || HOLDS[k].base === name) && HOLDS[k].on === R.id && (HOLDS[k].m - m)*dir > 20);
  return ks.sort((a, b) => (Math.sign(HOLDS[b].off) === side) - (Math.sign(HOLDS[a].off) === side) || (HOLDS[a].m - HOLDS[b].m)*dir)[0] || null;
}

// ═════════════════════════ aerodrome drawing ═════════════════════════
const AD_SITE = { pave: { w: 23 }, aprons: APRONS, roads: [], buildings: [], twyExtra: [], shoulder: [0, RWY_M], serviceRoad: false, paag: [], floods: [], twyLabels: [], hotspots: [], labels: [] };
const TERM_NAME = { A: 'DOCK A', B: 'DOCK B', E: 'DOCK E', C: 'C', D: 'D', G: 'G', H: 'H', I: 'I', P: 'P', T: 'T', W: 'W', F: 'FREIGHT', GA: 'GA' };
const TERM_LABELS = (() => { const by = {}; for (const s of STANDS) (by[s.term] ||= []).push(s.p); return Object.entries(by).map(([t, ps]) => [TERM_NAME[t] || t, ps.reduce((a, p) => [a[0] + p[0]/ps.length, a[1] + p[1]/ps.length], [0, 0])]); })();
// the hot spots (Jeppesen 10-9): HS1 where E and F cross 10/28 by the 16/34 crossing (beware the runway ahead; the sharp
// turn from E or F onto A for 28), HS2 where J and K cross 10/28 (beware the runway ahead)
const HS_AT = (e, n) => EN(e, n);
const HOTSPOTS = [
  { id: 'HS1', c: HS_AT(300, -10), r: 140, note: 'Taxiing on E or F: be aware of the runway ahead (10/28). Taxiing to runway 28: the sharp turn from E or F onto A.' },
  { id: 'HS2', c: HS_AT(950, -60), r: 190, note: 'Taxiing on J or K: be aware of the runway ahead (10/28).' }
];
const paveW = tw => 23;
function drawLszh(){
  const sc = V.scale, mpx = sc/1852, IMG = mapImagery();
  const P2 = p => [sx(p[0]), sy(p[1])];
  const pathP = (pts, close = true) => { cx.beginPath(); pts.forEach((p, i) => cx[i ? 'lineTo' : 'moveTo'](...P2(p))); if (close) cx.closePath(); };
  const lw = m => Math.max(1, m*mpx);
  const rwyPoly = (R, w, m0 = 0, m1 = R.len) => [R.rm(m0, -w/2), R.rm(m1, -w/2), R.rm(m1, w/2), R.rm(m0, w/2)];
  // 10/28 first, so 16/34's pavement and paint run on over it where they cross
  const ORDER = [RWY_LIST[2], RWY_LIST[1], RWY_LIST[0]];
  if (sc <= 70) { cx.fillStyle = rgba('rwyOut', .9); for (const R of ORDER) { pathP(rwyPoly(R, Math.max(R.width, 2.2/mpx), R.m0, R.m1)); cx.fill(); } return; }
  cx.lineJoin = 'round'; cx.lineCap = 'round';
  if (!IMG) {
    cx.fillStyle = C.concrete; for (const a of APRONS) { pathP(a.map(([m, o]) => rm(m, o))); cx.fill(); }
    cx.strokeStyle = C.concrete; cx.lineWidth = lw(60);
    for (const e of GE) { if (e.tw !== 'APRON') continue; pathP([GN[e.a].p, GN[e.b].p], false); cx.stroke(); }
    cx.lineWidth = lw(48); for (const s of STANDS) { pathP([s.lp, s.p], false); cx.stroke(); }
    cx.strokeStyle = C.asphalt;
    for (const e of GE) { if (e.tw === 'APRON') continue; cx.lineWidth = lw(paveW(e.tw)); pathP([GN[e.a].p, GN[e.b].p], false); cx.stroke(); }
    cx.lineWidth = lw(23); for (const k in FIL) { const R = rwyById(HOLDS[k].on); pathP(FIL[k].W.map(([m, o]) => R.rm(m, o)), false); cx.stroke(); }
  } else {
    const lines = GE.filter(e => e.tw !== 'APRON').map(e => ({ pts: [P2(GN[e.a].p), P2(GN[e.b].p)], w: paveWidth(e.tw) }));
    for (const k in FIL) { const R = rwyById(HOLDS[k].on); lines.push({ pts: FIL[k].W.map(([m, o]) => P2(R.rm(m, o))), w: paveWidth() }); }
    drawPavement(lines, G.buildings.map(b => b.pts.map(([e, n]) => P2(EN(e, n)))), mpx);
  }
  if (!IMG) { cx.fillStyle = C.bld; cx.strokeStyle = C.bldEdge; cx.lineWidth = 1; for (const b of G.buildings) { pathP(b.pts.map(([e, n]) => EN(e, n))); cx.fill(); cx.stroke(); } }
  // the taxiway bridges (A and B over the A4, V over the Hoofdvaart and the Hoofdweg): the deck a little wider than the
  // taxiway, with a parapet each side and the abutments marked at each end
  if (sc > 110) for (const [, line] of G.bridges || []) {
    const P = line.map(([e, n]) => EN(e, n)), hw = 23/2 + 6, side = k => P.map((p, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], h = brg(...a, ...b) + 90*k; return add(p, h, hw*M2NM); });
    const L = side(1), Rr = side(-1);
    cx.fillStyle = IMG ? 'rgba(120,124,128,.55)' : C.asphalt; pathP([...L, ...Rr.slice().reverse()]); cx.fill();
    cx.strokeStyle = C.name === 'dark' ? 'rgba(220,226,230,.8)' : 'rgba(60,64,70,.85)'; cx.lineWidth = Math.max(1.2, lw(1.2));
    for (const s of [L, Rr]) { pathP(s, false); cx.stroke(); }
    for (const i of [0, P.length - 1]) { pathP([L[i], Rr[i]], false); cx.stroke(); }
  }
  for (const R of ORDER) {
    cx.fillStyle = rgba('rwyOut', .55); pathP(rwyPoly(R, R.width + 15, R.m0, R.m1)); cx.fill();
    cx.fillStyle = C.rwy; pathP(rwyPoly(R, R.width, R.m0, R.m1)); cx.fill();
    if (sc > 150) drawRwyPaint(R, P2, pathP, lw, mpx);
  }
  if (sc > 150) {
    { const seen = new Set(), leads = []; for (const k in FIL) { for (const f of (G.leads || {})[k] || [FIL[k].W]) { const key = HOLDS[k].on + JSON.stringify(f); if (seen.has(key)) continue; seen.add(key);
      const R = rwyById(HOLDS[k].on), L = leadLine(f), sd = Math.sign(L[L.length - 1][1]) || 1;
      leads.push(L.map(([m, o]) => P2(R.rm(m, Math.abs(o) < 0.9 ? sd*0.9 : o)))); } }
      groundLines(lw(0.35), () => leads.forEach(strokeSmooth)); }
    paintEdgeLines(lw(0.35));
    // runway holding positions, pattern A, each with its stop bar
    cx.fillStyle = '#f5c518'; cx.strokeStyle = '#f5c518';
    for (const [id, rid] of Object.entries(G.hs)) {
      const n = GN[id]; if (!n || RET_NODES.has(id)) continue; const R = rwyById(rid), ws = waysOn(id); if (!ws.length) continue;
      let d = brg(...n.p, ...GN[ws[0][0]].p); if (Math.abs(R.offOf(add(n.p, d, 5*M2NM))) > Math.abs(R.offOf(n.p))) d += 180;
      const at = (k, w) => add(add(n.p, d, k*M2NM), d + 90, w*M2NM);
      cx.lineWidth = lw(0.3);
      for (const [k, dash] of [[-0.9, false], [-0.3, false], [0.3, true], [0.9, true]]) { cx.setLineDash(dash ? [mpx + 1, mpx + 1] : []); pathP([at(k, -11), at(k, 11)], false); cx.stroke(); }
      cx.setLineDash([]);
    }
    groundLines(lw(0.3), () => { for (const s of STANDS) if (!s.noLead) { if (s.line && s.line.length > 1 && s.lineOk !== false) { if (s.lineOk == null) { const L = s.line.reduce((a, q, i) => i ? a + dist(...s.line[i-1], ...q) : 0, 0); s.lineOk = L < 1.25*dist(...s.line[0], ...s.line[s.line.length-1]) + 10*M2NM; } if (s.lineOk) { pathP(s.line, false); cx.stroke(); continue; } } const L = dist(...s.lp, ...s.p)/M2NM, f = L > 90 ? 1 - 90/L : 0; pathP([[s.lp[0] + (s.p[0] - s.lp[0])*f, s.lp[1] + (s.p[1] - s.lp[1])*f], s.p], false); cx.stroke(); } });
    cx.save(); if (IMG) clipOut(G.buildings.map(b => b.pts.map(([e, n]) => P2(EN(e, n))))); drawStandDetail(null, null, mpx, false); cx.restore();
    drawGroundSigns();
  }
}
// ICAO Annex 14 runway markings: edge lines, the centreline between the thresholds, threshold stripes (16 on the 60 m
// 60 m runways), the aiming point (400 m in) and touchdown zone bars, the designators and the arrows before a displaced
// threshold (14, 34)
function drawRwyPaint(R, P2, pathP, lw, mpx){
  const hw = R.width/2 - 1.5, quad = (m1, o1, m2, o2) => { pathP([R.rm(m1, o1), R.rm(m2, o1), R.rm(m2, o2), R.rm(m1, o2)]); cx.fill(); };
  cx.fillStyle = C.paint; cx.strokeStyle = C.paint;
  cx.lineWidth = lw(0.9); pathP([R.rm(0, hw), R.rm(R.len, hw)], false); cx.stroke(); pathP([R.rm(0, -hw), R.rm(R.len, -hw)], false); cx.stroke();
  cx.beginPath(); for (let m = R.thr[R.lo] + 110; m < R.thr[R.hi] - 120; m += 50) { const [a, b] = [P2(R.rm(m, 0)), P2(R.rm(Math.min(m + 30, R.thr[R.hi] - 110), 0))]; cx.moveTo(...a); cx.lineTo(...b); } cx.stroke();
  const n = R.width >= 60 ? 8 : 6, aim = R.len >= 2400 ? 400 : 300, tdz = [[150, 3], [300, 3], [450, 2], [600, 2], [750, 1], [900, 1]];
  for (const [m0, dir] of [[R.thr[R.lo], 1], [R.thr[R.hi], -1]]) {
    quad(m0, -hw, m0 + dir*1.8, hw);
    for (let i = 0; i < n; i++) for (const k of [-1, 1]) { const o = k*(3 + i*(hw - 3)/n); quad(m0 + dir*6, o, m0 + dir*36, o + k*1.8); }
    for (const k of [-1, 1]) quad(m0 + dir*aim, k*6, m0 + dir*(aim + 50), k*16);
    for (const [d, c] of tdz) if (d !== aim) for (const k of [-1, 1]) for (let j = 0; j < c; j++) { const o = k*(6 + j*3.6); quad(m0 + dir*d, o, m0 + dir*(d + 22.5), o + k*1.8); }
    const pre = dir > 0 ? m0 : R.len - m0;
    if (pre > 60) {
      cx.lineWidth = lw(0.9);
      for (let d = 30; d < pre - 15; d += 60) { const m = m0 - dir*d; pathP([R.rm(m - dir*18, 0), R.rm(m, 0)], false); cx.stroke(); pathP([R.rm(m - dir*8, -3), R.rm(m, 0), R.rm(m - dir*8, 3)], false); cx.stroke(); }
      for (const k of [-1, 1]) { const m = m0 - dir*8; pathP([R.rm(m - dir*10, k*6), R.rm(m, k*10), R.rm(m - dir*10, k*14)], false); cx.stroke(); }
    }
  }
  for (const [rw, m0] of [[R.lo, R.thr[R.lo] + 70], [R.hi, R.thr[R.hi] - 70]]) drawRwyDesignator(...P2(R.rm(m0, 0)), rw, crsOf(rw), Math.max(9, 16*mpx));
}
function drawLszhTop(){
  const sc = V.scale, mpx = sc/1852, IMG = mapImagery();
  const P2 = p => [sx(p[0]), sy(p[1])];
  if (sc > 110) {
    cx.save(); cx.globalCompositeOperation = C.glow;
    const r = Math.max(1.1, 0.9*mpx), glow = (p, col) => { const [X, Y] = P2(p); cx.fillStyle = col; cx.beginPath(); cx.arc(X, Y, r, 0, 7); cx.fill(); };
    for (const R of RWY_LIST) {
      if (!rwysInUse().some(rw => RWYS_BY_END(rw) === R)) continue;
      const hw = R.width/2 + 0.5;
      for (let m = 0; m <= R.len; m += 60) { glow(R.rm(m, hw), 'rgba(255,244,214,.75)'); glow(R.rm(m, -hw), 'rgba(255,244,214,.75)'); }
      for (let o = -hw + 1; o <= hw - 1; o += 4) { glow(R.rm(R.thr[R.lo], o), 'rgba(90,255,140,.9)'); glow(R.rm(R.thr[R.hi], o), 'rgba(90,255,140,.9)'); }
      for (let m = R.thr[R.lo]; m <= R.thr[R.hi]; m += 30) glow(R.rm(m, 0), m > R.thr[R.hi] - 900 ? 'rgba(255,90,90,.7)' : 'rgba(255,250,235,.55)');
    }
    cx.restore();
  }
  if (sc > 160 && sc < 3000) { cx.save(); cx.strokeStyle = 'rgba(214,40,40,.75)'; cx.lineWidth = 1.6; cx.setLineDash([6, 4]); cx.font = `700 11px ${FONT_L}`; cx.fillStyle = 'rgba(214,40,40,.9)';
    for (const h of HOTSPOTS) { const [X, Y] = P2(h.c), r = h.r*mpx; cx.beginPath(); cx.arc(X, Y, r, 0, 7); cx.stroke(); cx.fillText(h.id, X + r*0.72, Y - r*0.72); }
    cx.restore(); }
  if (sc > 180 && sc < 2400) {
    cx.font = `600 12px ${FONT_L}`;
    if (IMG) { cx.fillStyle = C.name === 'dark' ? 'rgba(235,242,245,.92)' : '#fff'; cx.strokeStyle = 'rgba(0,0,0,.6)'; cx.lineWidth = 3; cx.lineJoin = 'round'; } else cx.fillStyle = rgba('lab', .72);
    for (const [t, p] of TERM_LABELS) { const [X, Y] = P2(p); if (IMG) cx.strokeText(t, X, Y); cx.fillText(t, X, Y); }
  }
}

// ═════════════════════════ fixes, STARs, SIDs ═════════════════════════
const STAR_LIST = Object.values(LSZH.STARS);
const STAR_FIXES = new Set([...STAR_LIST.flatMap(s => s.pts.map(p => p[0])), ...Object.values(LSZH.TRANS).flatMap(t => t.pts.map(p => p[0]))]);
const SID_FIXES = new Set(Object.values(LSZH.SIDS).flatMap(s => s.pts));
const APP_FIXES = new Set(Object.values(LSZH.ILS).flatMap(i => [i.ifx, i.faf]));
for (const [id, p] of Object.entries(LSZH.FIX)) wp(id, p[0], p[1], (STAR_FIXES.has(id) || APP_FIXES.has(id)) && !/^(ZD|ZRIL|ZH\d)/.test(id) ? {} : { minor: true });
for (const [id, n] of Object.entries(LSZH.NAV)) wp(id, ...n.p, { note: `${n.name} ${n.freq}` });
for (const id of Object.keys(LSZH.FIX)) if (/^(ZD|ZRIL)/.test(id)) WP[id].hide = true;
const RADAR_REF = ARP;
for (const [id, h] of Object.entries(LSZH.HOLDS_AIR)) if (WP[id]) {
  const inb = h.inb ?? (WP[h.to] ? brg(...WP[id].p, ...WP[h.to].p) : 0);
  WP[id].hold = { inb: Math.round(inb), min: h.min, left: h.turn === 'L' }; WP[id].minor = false; }
const GATES = Object.keys(LSZH.DIR);
const starOf = (g, rw) => LSZH.STARS[LSZH.DIR[g].star];
const ENTRY = Object.fromEntries(GATES.map(g => [g, WP[LSZH.DIR[g].entry].p]));
const ENTRY_ALT = Object.fromEntries(GATES.map(g => [g, 15000]));
const PRE_ALT = Object.fromEntries(GATES.map(g => [g, ENTRY_ALT[g] + 14000]));

// ── approaches: the localiser from 3 NM outside the intermediate fix, the 3° glidepath from its altitude
// a missed approach flown on a course ("track 055° MAG, climb to 2,000 ft") is laid out as hidden points along it, from the
// threshold (MA06A ...), so the go-around follows it the way it follows fixes
const missedIds = (rw, list) => { let at = THR[rw]; return list.map((m, i) => { if (typeof m === 'string') { at = WP[m] ? WP[m].p : at; return m; }
  const id = `MA${rw}${'ABCDEF'[i]}`; at = add(at, m.crs, m.nm); WP[id] = { id, p: at, minor: true, hide: true }; return id; }); };
const FINAL = {};
for (const [rw, I] of Object.entries(LSZH.ILS)) {
  if (!THR[rw]) continue;
  const thr = THR[rw], out = norm(crsOf(rw) + 180), dIF = dist(...thr, ...WP[I.ifx].p), dFAF = dist(...thr, ...WP[I.faf].p), elev = THR_ELEV[rw];
  const M = LSZH.MINS[I.cat], low = Math.round((elev + 1000)/100)*100;
  const F = { pts: [add(thr, out, dIF + 3), add(thr, out, dIF), thr], alts: [I.ifAlt, I.ifAlt, elev + 50], elev, entry: I.ifx, entryName: I.ifx, name: 'ILS ' + rw, alt: I.ifAlt,
    decName: I.faf, decNM: dFAF + 0.2, decMin: Math.max(1.6, dFAF - 1.6), minAlt: low, minText: `${low.toLocaleString('en-GB')} ft`,
    mins: M, minRate: 300, missed: missedIds(rw, I.missed), missAlt: I.missAlt,
    phrase: r => `cleared ILS approach runway ${r}, report established`, read: r => `cleared ILS ${r}, wilco`,
    decCall: r => `${APT.tower[0]}, ${I.faf.replace(/^AM/, 'A M ')}, ILS runway ${r}`, decNeed: `Inbound past the final approach fix, needs landing clearance`, decFail: 'not visual at minima' };
  F.cum = new Array(F.pts.length).fill(0); for (let i = F.pts.length - 2; i >= 0; i--) F.cum[i] = F.cum[i+1] + dist(...F.pts[i], ...F.pts[i+1]);
  const meet = (I.ifAlt - elev - 50)/(318*(I.gp || 3)/3);   // 28 and 34 have a 3.3° glidepath
  F.prof = [[0, elev + 50], [meet, I.ifAlt], [F.cum[0] + 1, I.ifAlt]];
  FINAL[rw] = F;
}
// the route on from the STAR: Zurich Arrival vectors from the initial approach fix to the intermediate fix. ARR_ROUTE[gate]
// is keyed by runway; APT.arrRoute picks the key for each arrival.
const LAND_RWYS = Object.keys(FINAL);
const TRANS_OF = (iaf, rw, when) => Object.values(LSZH.TRANS).find(t => t.iaf === iaf && t.rwy === rw && t.when === when);
// The vectors are laid out as hidden points beside the final, the pattern a director flies: from the initial
// approach fix a downwind on the side the arrival comes from, 7 NM off the centreline, then a base 5 NM outside the
// intermediate fix and 3 NM off, so the localiser is joined at about 30° (not the 120° turn straight from GIPOL or
// AMIKI to the intermediate fix). Downwind 1,000 ft above the intercept altitude, the base at it; an arrival that must
// cross a parallel's final to reach its own (the arrival manager balancing the two) stays 1,000 ft up across it.
const FEED_ALT = {};
function feeder(rw, from){
  const I = LSZH.ILS[rw], thr = THR[rw], out = norm(crsOf(rw) + 180), ifp = WP[I.ifx].p, dIF = dist(...thr, ...ifp);
  const f = WP[from].p, ux = Math.sin(out*D2R), uy = Math.cos(out*D2R), dx = f[0] - thr[0], dy = f[1] - thr[1];
  const along = dx*ux + dy*uy, right = dx*uy - dy*ux, s = right >= 0 ? 1 : -1;
  // already lined up (a turn of 30° or less at the intermediate fix): straight there
  if (along > dIF && Math.abs(angDiff(brg(...f, ...ifp), crsOf(rw))) <= 30) return [I.ifx];
  // a same-direction parallel on that side, between it and the arrival
  const cross = LAND_RWYS.some(o => o !== rw && THR[o] && Math.abs(angDiff(crsOf(o), crsOf(rw))) < 10 && (() => {
    const ox = THR[o][0] - thr[0], oy = THR[o][1] - thr[1], r = ox*uy - oy*ux; return Math.sign(r) === s && Math.abs(r) < 3; })());
  const pt = (a, l) => add(add(thr, out, a), out + 90, l), tag = `${rw}${s > 0 ? 'L' : 'R'}`;
  const mk = (k, p, note) => { WP[tag + k] = { id: tag + k, p, hide: true, minor: true, note }; FEED_ALT[tag + k] = I.ifAlt + (k === 'B' && !cross ? 0 : 1000); return tag + k; };
  const base = mk('B', pt(dIF + 5, s*3), `base for ${rw}`);
  if (along > dIF + 5) return [base, I.ifx];
  const dw = mk('D', pt(dIF + 5, s*7), `downwind for ${rw}`);
  if (along > 1) return [dw, base, I.ifx];
  return [mk('A', pt(1, s*7), `downwind for ${rw}`), dw, base, I.ifx];
}
const ARR_ROUTE = Object.fromEntries(GATES.map(g => { const st = starOf(g).pts.map(p => p[0]), iaf = IAF_OF(g), R = {};
  for (const rw of LAND_RWYS) {
    R[rw] = [...st, ...feeder(rw, iaf)];
    const n = TRANS_OF(iaf, rw, 'night'), d = TRANS_OF(iaf, rw, 'day');
    if (n) R[rw + ':N'] = [...st, ...n.pts.slice(1).map(p => p[0])];
    if (d) R[rw + ':X'] = [...st, ...d.pts.slice(1).map(p => p[0])];
  }
  return [g, R]; }));
const HOLD_AT = Object.fromEntries(GATES.map(g => [g, IAF_OF(g)]));
const nightNow = () => false;
const isJetAc = o => { const t = TYPES[o.t || (o.perf && o.perf.icao)] || o.perf; return !t || t.shape !== 'prop' && (t.cruise || 300) >= 250; };
function arrKeyOf(o){
  const rw = landRw(o), iaf = IAF_OF(o.gate);
  if (nightNow() && isJetAc(o) && TRANS_OF(iaf, rw, 'night')) return rw + ':N';
  if (!nightNow() && TRANS_OF(iaf, rw, 'day')) return rw + ':X';
  return rw;
}
// the altitudes along the routes: the STAR's (FL070 at the initial approach fix), the transitions' lowest altitudes, the
// intermediate fixes'
const ARR_ALT = (() => { const m = {}; for (const s of STAR_LIST) for (const [id, a] of s.pts) if (a && m[id] == null) m[id] = a;
  for (const t of Object.values(LSZH.TRANS)) for (const [id, a] of t.pts.slice(1)) if (a && m[id] == null) m[id] = a;
  for (const I of Object.values(LSZH.ILS)) m[I.ifx] = I.ifAlt; return { ...m, ...FEED_ALT }; })();

// ── departures: the SID of the take-off runway whose end is nearest the destination's bearing
const catOf = ac => 'CD';
const SID_BY_RWY = {};
for (const [n, s] of Object.entries(LSZH.SIDS)) (SID_BY_RWY[s.rwy] ||= []).push(n);
const ARP_LL = LSZH.arp;
const destBrg = icao => { const A = (LSZH.AIRPORTS[icao]) || (typeof AP !== 'undefined' && AP[icao]); if (!A) return null;
  const r = Math.PI/180, la1 = ARP_LL[0]*r, la2 = A[0]*r, dl = (A[1] - ARP_LL[1])*r;
  return norm(Math.atan2(Math.sin(dl)*Math.cos(la2), Math.cos(la1)*Math.sin(la2) - Math.sin(la1)*Math.cos(la2)*Math.cos(dl))/r); };
function sidName(gate, rwy, ac){
  rwy = rwy || depRw(ac); const list = SID_BY_RWY[rwy] || [];
  const b = ac && ac.d ? destBrg(ac.d) : (LSZH.DIR[gate] || {}).brg ?? 180;
  const endB = n => { const p = LSZH.SIDS[n].pts, f = WP[p[p.length - 1]]; return f ? brg(...ARP, ...f.p) : 0; };
  return list.slice().sort((x, y) => Math.abs(angDiff(endB(x), b)) - Math.abs(angDiff(endB(y), b)))[0] || null;
}
const sidSpoken = n => (LSZH.SIDS[n] || {}).spoken || n;
const exitRoute = (g, rwy, ac) => { const n = sidName(g, rwy, ac); return n ? LSZH.SIDS[n].pts.slice() : [LSZH.DIR[g].entry]; };
const EXIT_ROUTE = {}, EXIT_FIX = {};
for (const g of GATES) {
  Object.defineProperty(EXIT_ROUTE, g, { enumerable: true, get: () => exitRoute(g, depRw()) });
  Object.defineProperty(EXIT_FIX, g, { enumerable: true, get: () => { const r = exitRoute(g, depRw()); return r[r.length - 1]; } });
}
const ctrOf = g => { const b = LSZH.DIR[g].brg; return b < 45 || b >= 315 ? 'n' : b < 135 ? 'e' : b < 225 ? 's' : 'w'; };
const NEXT_UNIT = Object.fromEntries(GATES.map(g => [g, LSZH.CTR[ctrOf(g)]]));
const relUnit = ac => 'Swiss Radar';
const TEL = LSZH.TEL;
const isMil = ac => false;
const gateFor = ap => ap === 'LSZH' ? 'WIL' : (LSZH.PLACE_DIR[ap] || GATES.slice().sort((a, b) => { const B = destBrg(ap) ?? 180; return Math.abs(angDiff(LSZH.DIR[a].brg, B)) - Math.abs(angDiff(LSZH.DIR[b].brg, B)); })[0]);

// ═════════════════════════ schedule ═════════════════════════
const withGate = x => ({ ...x, gate: x.gate || gateFor(x.k === 'ARR' ? x.o : x.d) });
const TIMETABLE = LSZH.TIMETABLE;
const REGS = {};
const LONG_STAY = LSZH.LONG_STAY;
const EXTRA = LSZH.EXTRA.map(withGate);
const EXERCISES = Object.fromEntries(Object.entries(LSZH.EXERCISES).map(([k, e]) => ['z' + k, { ...e, sched: e.sched.map(withGate) }]));
const WX_PRESETS = LSZH.WX_PRESETS;

// ═════════════════════════ weather rules ═════════════════════════
const TURB_TABLE = {};
const minsOk = (w, rw) => { const I = LSZH.ILS[rw] || LSZH.ILS['14'], m = LSZH.MINS[I.cat]; return w.vis >= m.vis && w.ceil >= m.ceil; };
const sraMinsOk = w => minsOk(w, '14');

// ═════════════════════════ engine hooks ═════════════════════════
// Schengen or not (Dock E is the non-Schengen dock): the Schengen states' ICAO prefixes (Bulgaria and Romania since 2025)
const SCHENGEN = /^(E[BDEFHKLNPSVY]|L[BDEFGHIJKMOPRSZ]|BI|GC|LX)/;
const schengen = ac => { const o = ac.kind === 'ARR' ? ac.o : ac.d; return !o || SCHENGEN.test(o); };
const visTxt = v => v >= 9999 ? '10 kilometres or more' : v >= 5000 ? Math.round(v/1000) + ' kilometres' : v + ' metres';
const firstOf = (t, i = 0) => STANDS.filter(s => s.term === t)[i];
const landRwyOf = ac => landFor(ac);
const depRwyOf = ac => {
  if (ac && ac.cto && ac.depRwy) return ac.depRwy;
  if (ac && ac.hp && HOLDS[ac.hp]) { const on = HOLDS[ac.hp].on; const d = depList().find(r => RWYS_BY_END(r).id === on); if (d) return d; }
  return depForAc(ac);
};
const flowName = () => { const P = cfgNow(); return `${P.c.name || P.c.k}${P.single && P.c.l.length + P.c.s.length > 2 ? ' (one runway each way)' : ''} · ${LSZH.CAP[P.M].name} (${P.M})`; };
const twrOf = rw => LSZH.UNITS.twr.freq[RWYS_BY_END(rw).id] || '118.100';
const APT = {
  toVis: 125,
  lvp: w => w.vis < 550 || w.ceil < 200, lvpNote: 'arrivals intercept the localiser at least 9 NM out; "runway vacated" only past the holding point; stop bars in use',
  arrAlt: { ...ARR_ALT },
  icao: 'LSZH', name: 'Zurich', coordName: 'Zurich', radarName: 'Zurich', utcOff: 1, tz: 'Europe/Zurich',
  radar: [LSZH.UNITS.app.name, LSZH.UNITS.app.freq], depRadar: [LSZH.UNITS.dep.name, LSZH.UNITS.dep.freq],
  get tower(){ return [LSZH.UNITS.twr.name, twrOf(S.rwy)]; },
  gnd: [LSZH.UNITS.gnd.name, LSZH.UNITS.gnd.freq],
  runways: RWY_LIST, rwyHalfWidth: 22.5, holdSigns: true,
  ihps: IHP_LIST.map(({ id, node, tw, at, alias }) => ({ id, node, tw, at, alias })),
  // no independent parallels at Zurich: 14 and 16 converge, and 10/28 crosses 16/34, so the engine's own separation holds
  sepOk: (a, b, d) => false,
  // independent pairs (an arrival on the first runway no bar to a departure off the second): the Jeppesen briefing names
  // the dependent ones (DEP 16 / LDG 14, DEP 10 / LDG 14, DEP 32 / LDG 34) and 16/34 crosses 10/28; the rest (land 14 and
  // depart 28 in the north concept, land 28 and depart 32 in the east) run independently
  indepArr: (arr, dep) => ['14|28', '28|32'].includes(arr + '|' + dep),
  xing: false, drawnTown: false, ta: LSZH.TA, initClimb: LSZH.INIT_CLIMB, gaAlt: 2000, appAlt: 2000, handoffNM: 25, climbFL: 240, divertAlt: 7000,
  area: { dep: 40, arr: 70, div: 45 }, roll: [70, RWY_M - 70], defRwy: '14', defWx: 'north',
  appName: 'ILS approach', appShort: 'ILS', minsText: 'weather below the approach minima', reqApp: rw => 'ILS approach',
  minsLong: 'Visibility is below the minima (ILS CAT III on 14 and 16: RVR 75 m; CAT I on 34: 550 m; 28: 4,300 m).',
  liveName: 'Zurich Airport', atisFreq: LSZH.UNITS.atis.freq, turbName: 'Zurich',
  // the night curfew: no scheduled movements from 23:30 to 06:00 local, so the sessions start 04Z to 21Z (06:00 to 23:00 in summer)
  sessionHours: Array.from({ length: 18 }, (_, i) => i + 4),
  view: { app: [0, 0, 70], get twr(){ return [0, 0, 5.5]; },
    gnd: (() => { const c = EN(700, -350); return [mOf(c), offOf(c), 3200, 2600]; })() },
  minsOk,
  splitRwy: true, rwyFor, depFor, configOf,
  // the Flow buttons: the concepts of the table in force (day, evening or early morning), each with the runways it opens now
  get rwyConfigs(){ const M = modeNow(), w = S.wx, cur = cfgNow().c, T = tableOf(periodNow()); return (T.includes(cur) ? T : [...T, cur]).map(c => { const ok = prefOk(c, w, M, false), u = usedOf(c, M, w, !ok && prefOk(c, w, M, true));
    return { key: c.k, name: c.name || c.k, land: c.l[0], lands: u.land, deps: u.dep, ok: ok || prefOk(c, w, M, true) }; }); },
  setConfig(k){ const c = ALLP.find(c => c.k === k); if (!c) return;
    MANUAL = k; PCACHE.key = null; S.rops = null; S.ropsV++; S.rwy = c.l[0]; const P = prefFor(S.rwy); S.depRwy = P.dep[0];
    nextAtis(false); sys(`Runways: ${prefText(P)}. Information ${phonetic(S.atis)} is current.`);
    if (!prefOk(c, S.wx, P.M, P.single)) sys(`The ${(c.name || k).toLowerCase()} does not meet the wind, visibility or German ordinance rules now: crews may refuse, and it counts against the noise rules.`, true);
    rerouteArrivals(); renderAtis(); emit('rwy', S.rwy); },
  arrCap, depCap, ropsCan: (e, role) => !((role === 'ARR' || role === 'MIX') && LSZH.ONEWAY.arr.includes(e)) && !((role === 'DEP' || role === 'MIX') && LSZH.ONEWAY.dep.includes(e)),
  depRwyOf, landRwyOf, arrRoute: o => arrKeyOf(o),
  activeRwys: () => [...new Set([...landList(), ...depList()])],
  depRwys: () => depList(),
  appRwys: () => landList(),
  ropsSkip: [],
  exitRouteOf: ac => exitRoute(ac.gate, ac.depRwy || depRw(ac), ac),
  needRel: ac => false,
  sidAlt: ac => LSZH.INIT_CLIMB,
  remoteAreas: ['remote', 'cargo', 'ga'],
  areaNames: { pier: 'pier stands', remote: 'remote stands', cargo: 'cargo stands', ga: 'general aviation stands' },
  termName: t => (TERM_NAME[t] || t).toLowerCase().replace(/^./, c => c.toUpperCase()),
  remoteWord: s => 'remote stand',
  prefArea: ac => { const t = schengen(ac) ? (LSZH.TERMINAL_OF[ac.cs.slice(0, 3)] || LSZH.TERMINAL_DEFAULT)[0] : 'E'; return { key: t, name: TERM_NAME[t], has: s => s.term === t }; },
  standFor: ac => {
    const pick = list => { const free = list.filter(s => standFree(s, ac)).sort((a, b) => (a.maxSpan || 80) - (b.maxSpan || 80)), best = free.filter(s => (s.maxSpan || 80) <= (free[0] && free[0].maxSpan || 80) + 8);
      return best[Math.floor(Math.random()*best.length)] || null; };
    const al = ac.cs.slice(0, 3), long = ac.perf.wake === 'H' || ac.perf.wake === 'J';
    // business jets and light aircraft to the general aviation sectors
    if (ac.perf.shape === 'biz' || ac.perf.wake === 'L') { const s = pick(STANDS.filter(s => s.term === 'GA')); if (s) return s; }
    // Dock E takes the non-Schengen flights (long haul, the UK, Ireland, Israel, Turkey...), Docks A and B the Schengen
    // ones; the remote stands (by bus) take the overflow
    const order = long || !schengen(ac) ? ['E', 'B', 'D', 'C', 'G', 'I', 'H', 'T', 'W'] : (LSZH.TERMINAL_OF[al] || LSZH.TERMINAL_DEFAULT).concat(['B', 'A', 'C', 'D', 'H', 'I', 'G', 'T', 'W', 'P']);
    for (const t of order) { const s = pick(STANDS.filter(s => s.term === t)); if (s) return s; }
    return pick(STANDS.filter(s => s.area !== 'ga')) || pick(STANDS); },
  inboundAlt: g => 10000,
  divertTo: ac => ['Basel', 'GIPOL'],
  firstAlt: g => 13000,
  rolledCall: 'request taxi',
  vacExits: ac => { const rw = ac.app || landRw(ac), R = RWYS_BY_END(rw), m = R.mOf([ac.x, ac.y]), dir = rw === R.lo ? 1 : -1;
    const side = sideFor(ac, R); return exitsFor(rw, ac).filter(k => (HOLDS[k].m - m)*dir > 30 && Math.sign(HOLDS[k].off) === side).slice(0, 4); },
  vacPrefs: (st, ac) => exitsFor(ac && (ac.app || landRw(ac)) || S.rwy, ac),
  exitFor,
  lineUpWords: hp => 'line up and wait',
  terrain: null,
  restricted: null,
  drawAirport: drawLszh, drawAirportTop: drawLszhTop,
  entryCost: (ac, k, from) => 0,
  onStep: () => { stepPref(); stepAprons(); },
  gaEarly(ac, rw){},
  gaTurn(ac){ const rw = ac.gaRwy, F = FINAL[rw] || FINAL['14'];
    if (ac.alt > ELEV + 700 || dist(ac.x, ac.y, ...(THR[rw] || ARP)) > 2) { ac.gaTurn = true; ac.mode = 'NAV'; ac.route = F.missed.slice(); ac.turnDir = 0; ac.tgtAlt = ac.cleared = Math.max(ac.cleared || 0, F.missAlt); } },
  liftoff(ac){ ac.tgtHdg = Math.round(crsOf(ac.depRwy)); ac.turnDir = 0; },
  depTurn(ac){ if (ac.turned) return; if (ac.alt >= ELEV + 500) ac.turned = true; },
  depClear: ac => !!ac.turned && ac.alt > ELEV + 600,
  shear(ac, rw, w){ return turbExcess(w) > 4 && Math.random() < 0.2 ? 'windshear on short final' : null; },
  shearWhy: rw => 'windshear on short final',
  faceHold: (st, f) => depHold({ stand: st, leftStand: false, x: st.p[0], y: st.p[1], kind: 'DEP' }),
  faceWord: f => f,
  faceHdg: (st, f) => norm(laneDir(st, f) + 180),
  taxiHolds: (south, ac) => { const rw = depRw(ac), ks = endHolds(rw), p = ac ? (ac.stand && !ac.leftStand ? ac.stand.lp : [ac.x, ac.y]) : ARP;
    const rec = ac && depHold(ac), ends = [...new Set([rec, ...ks.sort((a, b) => dist(...p, ...GN[HOLDS[a].node].p) - dist(...p, ...GN[HOLDS[b].node].p))].filter(Boolean))].slice(0, 3);
    return [...ends, ...intxHolds(rw).filter(k => !ac || ac.perf.wake === 'M' || intxRun(k, rw) >= 2800)]; },
  holdNote: (hp, rw) => intxHolds(rw).includes(hp) ? ` · intersection, ${(Math.round(intxRun(hp, rw)/10)*10).toLocaleString('en-GB')} m of runway ahead` : '',
  depHoldAs,
  taxiCheck: (ac, hp) => { if (ac.kind !== 'DEP' || !HOLDS[hp]) return null; const rw = depRw(ac), ok = depHolds(rw);
    if (intxHolds(rw).includes(hp) && ac.perf.wake !== 'M' && intxRun(hp, rw) < 2800) return `${ac.cs} (${ac.t}, heavy) needs more runway than ${HOLDS[hp].ref} leaves (${intxRun(hp, rw).toLocaleString('en-GB')} m).`;
    if (ok.includes(hp)) return null;
    const ref = k => HOLDS[k].ref, ends = [...new Set(endHolds(rw).map(ref))], ix = [...new Set(intxHolds(rw).map(ref))];
    return `${ref(hp)} is not a runway ${rw} departure point. Runway ${rw} departures enter at ${ends.join(' or ') || 'its end'}${ix.length ? `, or at the intersection${ix.length > 1 ? 's' : ''} ${ix.join(', ')}` : ''}.`; },
  taxiHint: rw => ({ '28': 'Runway 28 departures enter at A1 or B1 at the east end (the full 2,500 m), or K (1,900 m).',
    '16': 'Runway 16 departures enter at E1 or E2 at the north end (3,700 m), up taxiway E, or the intersection E3 (3,000 m).',
    '32': 'Runway 32 departures enter at H3 or C3 at the south-east end (3,300 m).',
    '34': 'Runway 34 departures enter at the south end by E11 (3,700 m) or at E8 (3,270 m).',
    '10': 'Runway 10 departures enter at L9 at the west end, or the intersections L7 and ES.' })[rw] || '',
  diverts: [{ cs: 'BAW714', t: 'A320', o: 'EGLL', gate: 'BLM', to: 'Basel' }, { cs: 'DLH5WN', t: 'A20N', o: 'EDDF', gate: 'RILAX', to: 'Stuttgart' }],
  airports: LSZH.AIRPORTS, via: {},
  airlineIcao: LSZH.AIRLINE_ICAO, airlineType: LSZH.AIRLINE_TYPE, defType: 'A320',
  placeIcao: LSZH.PLACES,
  phr: {
    push: (ac, dn, face) => [`cleared to ${dn} via the ${sidSpoken(ac.sid)} departure, runway ${depRw(ac)}, climb altitude 5000 feet, squawk ${ac.sqk}, start-up and push back approved, face ${faceSay(ac, face)}, QNH ${S.wx.qnh}`,
      `cleared ${dn}, ${sidSpoken(ac.sid)}, runway ${depRw(ac)}, 5000 feet, squawk ${ac.sqk}, start and push approved facing ${faceSay(ac, face)}, QNH ${S.wx.qnh}`],
    startReq: ac => `${LSZH.UNITS.del.name}, stand ${ac.stand.id}, ${ac.perf.name} to ${AP[ac.d] ? AP[ac.d][2] : ac.d}, information ${phonetic(S.atis)}, request push and start`,
    checkIn: ac => { const st = starOf(ac.gate, landRw(ac)); return `${APT.radar[0]}, ${ac.cs.length > 0 ? '' : ''}${altShort(Math.round(ac.alt/100)*100)} descending ${altShort(ac.tgtAlt)}, ${st.spoken} arrival, information ${phonetic(S.atis)}`; },
    vacated: ac => `${LSZH.UNITS.gnd.name}, runway ${rwyName(ac.rwyId)} vacated via ${PHON[ac.exit] || ac.exit.replace(/~\d+$/, '')}${ac.stand ? ', for stand ' + ac.stand.id : ''}`,
    taxiIn: (ac, st, vw) => { const k = xingAhead(ac), hs = k >= 0 ? `, hold short runway ${rwyName(ac.path.pts[k].hs)}` : '', via = vw.length ? ' via ' + vw.map(t => PHON[t] || t).join(', ') : '';
      return [`taxi to stand ${st.id}${via}${hs}`, `stand ${st.id}${via}${hs}`]; },
    taxiHold: (ac, h, vw) => { const via = vw.length ? ' via ' + vw.map(t => PHON[t] || t).join(', ') : '', r = h.rwy ? rwyName(HOLDS[h.id].on) : null, at = PHON[h.id] || h.id;
      return r ? [`taxi to holding point ${at}${via}, hold short runway ${r}`, `holding point ${at}${via}, holding short ${r}`] : [`taxi${via}, hold at ${at}`, `${via ? via.slice(1) + ', ' : ''}holding at ${at}`]; },
    atHoldPt: (ac, h) => h.rwy ? `holding short runway ${rwyName(HOLDS[h.id].on)} at ${PHON[h.id] || h.id}` : `holding at ${PHON[h.id] || h.id}`
  },
  atisPanel(w){
    const c = windComp(w, crsOf(S.rwy)), bad = !minsOk(w, S.rwy), r = rwyFor(w), P = cfgNow(), A = S.running ? achieved() : null;
    const cap = `declared ${arrCap()} arrivals and ${depCap()} departures an hour${A ? `; achieved ${A.arr} and ${A.dep} an hour over the last ${A.min} min` : ''}`;
    return `<div class="warnline${bad ? ' bad' : ''}">${flowName()} · land ${landList().join(' and ')}, depart ${depList().join(' and ')}${r.land !== S.rwy ? ` (the rules now give the ${(bestPref(w).c.name || '').toLowerCase()}: land ${r.land}, depart ${r.dep})` : ''} · ${bad ? 'below the minima' : 'ILS approaches'} · crosswind ${Math.round(Math.abs(c.crossG))} kt.</div>`
      + `<div class="warnline dimmer">${cap}. ${periodNow() !== 'day' ? 'German ordinance period: no approaches to 14 or 16. ' : ''}${visOf(w) === 'limited' ? 'Low visibility: one landing runway.' : ''}${w.vis < LSZH.MINS.V28.vis ? ' Runway 28 below its 4,300 m visibility.' : ''}</div>`;
  },
  atisLines({ w, L, E }){
    const cl = w.clouds.length ? w.clouds.map(c => { const m = c.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3})/); return m ? `${{ FEW: 'few', SCT: 'scattered', BKN: 'broken', OVC: 'overcast', VV: 'vertical visibility' }[m[1]]} ${(+m[2]*100).toLocaleString('en-GB')} feet` : c; }).join(', ') : 'no significant cloud';
    const out = [
      `This is Zurich arrival information ${phonetic(L)}, time ${zt(S.t).slice(0,5).replace(':', '')}.`,
      `Expect ILS approach runway ${landList()[0]}${landList()[1] ? ` or ${landList()[1]}` : ''}. Departure runway${depList().length > 1 ? 's' : ''} ${depList().join(' and ')}.`,
      `Transition level ${w.qnh < 1013 ? 'flight level 90' : 'flight level 80'}.`,
      `Surface wind ${w.vrb ? 'variable' : hdg3(w.dir)} degrees ${w.spd} knots${w.gust ? ', gusting ' + w.gust : ''}. Visibility ${visTxt(w.vis)}${w.wx.length ? ', ' + w.wx.join(' ') : ''}. ${cl.replace(/^./, c => c.toUpperCase())}.`,
      `Temperature ${w.temp}, dew point ${w.dew}. QNH ${w.qnh}.`
    ];
    if (APT.lvp(w)) out.push('Low visibility procedures in force.');
    if (E && E.rwyBlock) out.push(`Runway ${blockRw()} closed: ${E.rwyBlock.why}.`);
    if (!minsOk(w, S.rwy)) out.push('Visibility below the approach minima. Expect holding.');
    out.push(`On first contact with Zurich Arrival report aircraft type and information ${phonetic(L)}.`);
    return out;
  },
  site: {
    hero: () => [
      ['SWR1239', 47.75, 8.45, 190, 230, PAL.light.arr], ['EDW215', 47.52, 8.05, 80, 220, PAL.light.arr], ['SWR17', 47.60, 8.90, 270, 200, PAL.light.arr],
      ['SWR38', 47.45, 8.35, 250, 240, PAL.light.dep], ['EZS1061', 47.30, 8.60, 160, 250, PAL.light.dep]
    ],
    demo(mk, park){
      const fin = add(THR['14'], norm(CRS['14'] + 180), 2.6), out = add(THR['28'], CRS['28'], 4), iaf = WP.AMIKI ? WP.AMIKI.p : add(ARP, 60, 15);
      const hold = endHolds('28')[0], hp = hold ? GN[HOLDS[hold].node].p : ARP;
      const ids = [firstOf('A', 0), firstOf('A', 6), firstOf('B', 2), firstOf('E', 1)].map(s => s ? s.id : STANDS[0].id);
      return [
        mk('SWR1001', 'A320', 'DEP', park(ids[0], { need: null, reqAt: 99999 })), mk('SWR1361', 'BCS3', 'DEP', park(ids[1], { need: null, reqAt: 99999 })),
        mk('EDW557', 'A320', 'DEP', park(ids[2], { need: null, reqAt: 99999 })), mk('SWR38', 'B77W', 'DEP', park(ids[3], { need: null, reqAt: 99999 })),
        mk('EZS1061', 'A320', 'DEP', { ground: true, state: 'HOLDPT', hp: hold, x: hp[0], y: hp[1], hdg: CRS['28'], gs: 0 }),
        mk('SWR1239', 'A320', 'ARR', { state: 'FINAL', mode: 'FINAL', app: '14', freq: 'TWR', x: fin[0], y: fin[1], hdg: CRS['14'], alt: 2200, gs: 140, vs: -750, o: 'EDDB' }),
        mk('DLH1186', 'A20N', 'ARR', { state: 'INBOUND', x: iaf[0], y: iaf[1], hdg: 270, alt: 7000, gs: 250, vs: 0, tgtAlt: 7000, o: 'EDDF' })
      ];
    },
    thumb(k, zoom, W){
      if (k === 'app') return v => { v.scale *= 1.3; };
      if (k === 'twr') return v => { v.cx = 0; v.cy = 0; v.scale = W/5; };
      const c = zoom === 'apron' ? (firstOf('A') || STANDS[0]).p : ARP;
      return v => { v.cx = c[0]; v.cy = c[1]; v.scale = W/((zoom === 'apron' ? 700 : 4200)*M2NM); };
    },
    figHold: 'AMIKI', emergHp: 'A1',
    figConsole: v => { v.scale *= 1.2; },
    cmdHint: 'Command, e.g. SWR1239 APP · SWR38 TAXI · / to focus, Tab cycles flights'
  }
};
APT.hangars = G.buildings.filter(b => b.roof === 'hangar').map(b => { const n = b.pts.length, c = b.pts.reduce((a, p) => [a[0] + p[0]/n, a[1] + p[1]/n], [0, 0]); return { c, area: Math.abs(b.pts.reduce((a, p, i) => a + p[0]*b.pts[(i + 1) % n][1] - b.pts[(i + 1) % n][0]*p[1], 0))/2, name: b.name }; })
  .filter(h => h.area > 4000).sort((a, b) => b.area - a.area).slice(0, 4)
  .map(h => [h, (nearestNode(EN(...h.c), nd => !/^[Rxs]/.test(nd.id)) || {}).id]).filter(([h, node]) => node && GN[node] && dist(...EN(...h.c), ...GN[node].p)/M2NM < 260)
  .map(([h, node], i) => ({ id: 'H' + (i + 1), name: h.name || 'SR Technics hangar', in: inF0(...h.c), door: [GN[node].m, GN[node].off], node, to: ['pier'],
    fits: ac => /^(SWR|EDW)$/.test(ac.cs.slice(0, 3)), pick: ac => APT.standFor(ac) }));
APT.queuePen = true;
// VFR traffic round Zurich: Swiss registrations (HB-), the Rega air ambulance, the Zurich cantonal police helicopter, and
// light aircraft and helicopters crossing the control zone (the heli routes E, W and S of the helicopter chart)
APT.vfrReg = () => 'HB-' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').sort(() => Math.random() - 0.5).slice(0, 3).join('');
APT.vfrTypes = [
  { t: 'C172', who: 'light aircraft', spd: 95, alt: 3500, reg: true },
  { t: 'PA28', who: 'light aircraft', spd: 100, alt: 4000, reg: true },
  { t: 'EC35', who: 'police helicopter', spd: 110, alt: 3000, cs: 'ZHPOL', heli: true },
  { t: 'EC35', who: 'air ambulance', spd: 120, alt: 3000, cs: 'REGA', heli: true, hems: true },
  { t: 'AS50', who: 'helicopter', spd: 105, alt: 3000, reg: true, heli: true }
];
// the Academy's aerodrome figure: all three runways
APT.figView = v => { const c = EN(0, 400); v.cx = c[0]; v.cy = c[1]; v.scale = Math.min(W/(4200*M2NM), H/(4800*M2NM)); };
