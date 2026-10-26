"use strict";
// ═════════════════════════ Clearway Area Control · geometry, airspace and routes ═════════════════════════
// The airspace (sectors with their levels and owners, positions and frequencies, airways, fixes, navaids, SIDs, STARs
// and the standing agreements between sectors) comes from area-data.js (tools/area_data.py, built from the VATSIM UK
// sector file, which follows the UK AIP). Aircraft fly in latitude/longitude; the scope draws them through a flat
// projection centred on the position you work (xy, NM east and north of the centre).

const D2R = Math.PI/180, R2D = 180/Math.PI, M2NM = 1/1852;
let LAT0 = 52.5, LON0 = -1.5, COSL = Math.cos(LAT0*D2R);
function setOrigin(la, lo){ LAT0 = la; LON0 = lo; COSL = Math.cos(la*D2R); }
const xy = (la, lo) => [(lo - LON0)*60*COSL, (la - LAT0)*60];
const norm = a => ((a % 360) + 360) % 360;
const angDiff = (a, b) => { let d = norm(b - a); return d > 180 ? d - 360 : d; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random()*(b - a);
const pick = a => a[Math.floor(Math.random()*a.length)];
const dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
const brg = (x1, y1, x2, y2) => norm(Math.atan2(x2 - x1, y2 - y1)*R2D);
// distances and courses between two lat/lon points, flat over the short distances that matter for separation
function nm(la1, lo1, la2, lo2){ const c = Math.cos((la1 + la2)/2*D2R); return Math.hypot((lo2 - lo1)*60*c, (la2 - la1)*60); }
function crs(la1, lo1, la2, lo2){ const c = Math.cos((la1 + la2)/2*D2R); return norm(Math.atan2((lo2 - lo1)*c, la2 - la1)*R2D); }
function moveLL(la, lo, h, d){ return [la + d*Math.cos(h*D2R)/60, lo + d*Math.sin(h*D2R)/(60*Math.cos(la*D2R))]; }
// great circles, for flights coming from or going to far away
function gcNM(a, b){ const p1 = a[0]*D2R, p2 = b[0]*D2R, dp = p2 - p1, dl = (b[1] - a[1])*D2R;
  const h = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2; return 2*3440.065*Math.asin(Math.min(1, Math.sqrt(h))); }
function gcAt(a, b, f){
  const d = gcNM(a, b)/3440.065; if (d < 1e-9) return a.slice();
  const A = Math.sin((1 - f)*d)/Math.sin(d), B = Math.sin(f*d)/Math.sin(d), p1 = a[0]*D2R, l1 = a[1]*D2R, p2 = b[0]*D2R, l2 = b[1]*D2R;
  const x = A*Math.cos(p1)*Math.cos(l1) + B*Math.cos(p2)*Math.cos(l2), y = A*Math.cos(p1)*Math.sin(l1) + B*Math.cos(p2)*Math.sin(l2), z = A*Math.sin(p1) + B*Math.sin(p2);
  return [Math.atan2(z, Math.hypot(x, y))*R2D, Math.atan2(y, x)*R2D];
}
const hdg3 = h => String(Math.round(norm(h)) || 360).padStart(3, '0');
const FLs = a => String(Math.max(0, Math.round(a/100))).padStart(3, '0');

// ── fixes, airports and airways ──
const FIXP = {};   // name → [lat, lon, kind]: V VOR/DME, N NDB, F named point, P a procedure point
for (const [k, v] of Object.entries(AREA.fix)) FIXP[k] = v;
const APS = {};    // ICAO → [lat, lon, name]
for (const [k, v] of Object.entries(AREA.ap)) APS[k] = v;
// airports beyond the map that flights come from and go to (the timetables add their own)
Object.assign(APS, {
  KJFK: [40.6399, -73.7789, 'New York JFK'], KEWR: [40.6925, -74.1687, 'Newark'], KBOS: [42.3656, -71.0096, 'Boston'], KORD: [41.9786, -87.9048, 'Chicago'],
  KIAD: [38.9445, -77.4558, 'Washington Dulles'], KATL: [33.6367, -84.4281, 'Atlanta'], KMIA: [25.7932, -80.2906, 'Miami'], KLAX: [33.9425, -118.4081, 'Los Angeles'],
  KSFO: [37.6188, -122.3750, 'San Francisco'], KSEA: [47.4502, -122.3088, 'Seattle'], KDFW: [32.8968, -97.0380, 'Dallas'], CYYZ: [43.6772, -79.6306, 'Toronto'],
  CYUL: [45.4706, -73.7408, 'Montréal'], CYVR: [49.1939, -123.1844, 'Vancouver'], BIKF: [63.9850, -22.6056, 'Keflavík'], KMCO: [28.4294, -81.3090, 'Orlando'],
  EHAM: [52.3086, 4.7639, 'Amsterdam'], EDDF: [50.0333, 8.5706, 'Frankfurt'], EDDM: [48.3538, 11.7861, 'Munich'], EDDB: [52.3667, 13.5033, 'Berlin'],
  EDDH: [53.6304, 9.9882, 'Hamburg'], EDDL: [51.2895, 6.7668, 'Düsseldorf'], LFPG: [49.0097, 2.5479, 'Paris CDG'], LFPO: [48.7233, 2.3794, 'Paris Orly'],
  LFMN: [43.6584, 7.2159, 'Nice'], LFLL: [45.7256, 5.0811, 'Lyon'], LFBD: [44.8283, -0.7156, 'Bordeaux'], LFRS: [47.1532, -1.6107, 'Nantes'],
  LEMD: [40.4719, -3.5626, 'Madrid'], LEBL: [41.2971, 2.0785, 'Barcelona'], LEMG: [36.6749, -4.4991, 'Málaga'], LEAL: [38.2822, -0.5582, 'Alicante'],
  LEPA: [39.5517, 2.7388, 'Palma'], GCLP: [27.9319, -15.3866, 'Gran Canaria'], GCTS: [28.0445, -16.5725, 'Tenerife South'], LPPT: [38.7742, -9.1342, 'Lisbon'],
  LPFR: [37.0144, -7.9659, 'Faro'], LIRF: [41.8003, 12.2389, 'Rome'], LIMC: [45.6306, 8.7231, 'Milan'], LSZH: [47.4647, 8.5492, 'Zürich'],
  LSGG: [46.2381, 6.1089, 'Geneva'], LOWW: [48.1103, 16.5697, 'Vienna'], EBBR: [50.9014, 4.4844, 'Brussels'], EKCH: [55.6181, 12.6561, 'Copenhagen'],
  ENGM: [60.1939, 11.1004, 'Oslo'], ESSA: [59.6519, 17.9186, 'Stockholm'], EFHK: [60.3172, 24.9633, 'Helsinki'], EPWA: [52.1657, 20.9671, 'Warsaw'],
  LKPR: [50.1008, 14.2600, 'Prague'], LHBP: [47.4369, 19.2556, 'Budapest'], LGAV: [37.9364, 23.9445, 'Athens'], LTFM: [41.2753, 28.7519, 'Istanbul'],
  OMDB: [25.2528, 55.3644, 'Dubai'], OTHH: [25.2731, 51.6081, 'Doha'], OEJN: [21.6796, 39.1565, 'Jeddah'], HECA: [30.1219, 31.4056, 'Cairo'],
  VIDP: [28.5665, 77.1031, 'Delhi'], VABB: [19.0887, 72.8679, 'Mumbai'], LLBG: [32.0114, 34.8867, 'Tel Aviv'], GMMX: [31.6069, -8.0363, 'Marrakech'],
  EINN: [52.7020, -8.9248, 'Shannon'], EICK: [51.8413, -8.4911, 'Cork'], EIDW: [53.4213, -6.2701, 'Dublin']
});
const apLL = ic => APS[ic] ? [APS[ic][0], APS[ic][1]] : null;
const apName = ic => APS[ic] ? APS[ic][2] : ic;
// airway graph: each fix's neighbours along every airway it is on
const ADJ = {}, AWY_SEGS = [];
for (const [name, A] of Object.entries(AREA.awy)) for (const s of A.s) {
  for (let i = 1; i < s.length; i++) {
    const a = s[i - 1], b = s[i], pa = FIXP[a], pb = FIXP[b]; if (!pa || !pb || a === b) continue;
    const d = nm(pa[0], pa[1], pb[0], pb[1]); if (d > 400) continue;
    (ADJ[a] ||= []).push([b, name, d, A.l]); (ADJ[b] ||= []).push([a, name, d, A.l]);
    AWY_SEGS.push([a, b, name, A.l]);
  }
}
const AWY_NODES = Object.keys(ADJ);
// SIDs and STARs: the airport's procedures with the points they pass
const SIDS = AREA.sid, STARS = AREA.star;
const procPts = r => r[2].filter(n => FIXP[n]);
const procLen = (pts, from) => { let d = 0, p = from; for (const n of pts) { const q = FIXP[n]; d += nm(p[0], p[1], q[0], q[1]); p = q; } return d; };
// the runway in use for a westerly or easterly wind (the higher numbered end in a westerly)
function rwyFor(ic, list, wdir){
  const rws = [...new Set(list.map(r => r[0]))]; if (!rws.length) return null;
  return rws.sort((a, b) => Math.abs(angDiff(+a.slice(0, 2)*10, wdir)) - Math.abs(angDiff(+b.slice(0, 2)*10, wdir)))[0];
}
// the point an arrival holds at before its approach: the last named fix of its STAR before the final approach points
function holdFixOf(star){
  const pts = star[2]; let h = null;
  for (const n of pts) { if (/^(CF|FI|FF|CD|CI|D\d|[A-Z]{2}\d{2}[A-Z]?$|\d)/.test(n) || !FIXP[n]) break; h = n; }
  return h || pts.find(n => FIXP[n] && FIXP[n][2] === 'V') || pts[0];
}

// ── routes: SID, airways, STAR ──
// a min-heap for the searches
function hpush(h, it){ let i = h.length; h.push(it); while (i) { const p = (i - 1) >> 1; if (h[p][0] <= it[0]) break; h[i] = h[p]; i = p; } h[i] = it; }
function hpop(h){ const top = h[0], last = h.pop(), n = h.length; if (!n) return top; let i = 0;
  for (;;) { let c = 2*i + 1; if (c >= n) break; if (c + 1 < n && h[c+1][0] < h[c][0]) c++; if (h[c][0] >= last[0]) break; h[i] = h[c]; i = c; } h[i] = last; return top; }
// where a great circle from far away first comes within the map (and the last point it leaves it): null when it never does
const MAPBOX = { la: [48.2, 61.5], lo: [-13.5, 4.8] };
const inMap = p => p[0] > MAPBOX.la[0] && p[0] < MAPBOX.la[1] && p[1] > MAPBOX.lo[0] && p[1] < MAPBOX.lo[1];
function edgeOf(far, near){
  const D = gcNM(far, near), n = Math.max(8, Math.ceil(D/25));
  for (let i = 0; i <= n; i++) { const p = gcAt(far, near, i/n); if (inMap(p)) return p; }
  return null;
}
// the shortest airway routing from a point to a point. starts/goals: [[fix, extra cost]] (the SID or STAR to reach them),
// or a radius round the point to join at any airway fix. Returns the fixes, or null.
function awyRoute(from, to, starts, goals, hi, farFrom, farTo){
  const dist0 = new Map(), prev = new Map(), done = new Set(), h = [];
  const goalCost = new Map(), target = farTo || to;
  // the end: the STAR's first fix, any airway fix near an airport on the map, or (for an airport far away) the airway
  // fixes near where the great circle to it leaves the map, costed by the distance still to fly
  if (goals) for (const [f, c] of goals) goalCost.set(f, c);
  else for (const f of AWY_NODES) { const p = FIXP[f];
    if (farTo) { const e = nm(p[0], p[1], to[0], to[1]); if (e < 220) goalCost.set(f, gcNM(p, farTo) - gcNM(to, farTo) + e*0.6); }
    else { const d = nm(p[0], p[1], to[0], to[1]); if (d < 70) goalCost.set(f, d*1.3); } }
  const hOf = f => (farTo ? Math.max(0, gcNM(FIXP[f], farTo) - gcNM(to, farTo)) : nm(FIXP[f][0], FIXP[f][1], to[0], to[1]))*0.95;
  const add = (f, c, pr) => { const o = dist0.get(f); if (o === undefined || c < o) { dist0.set(f, c); prev.set(f, pr); hpush(h, [c + hOf(f), f]); } };
  if (starts) for (const [f, c] of starts) { if (FIXP[f]) add(f, c, null); }
  else for (const f of AWY_NODES) { const p = FIXP[f];
    if (farFrom) { const e = nm(p[0], p[1], from[0], from[1]); if (e < 220) add(f, e*0.6, null); }
    else { const d = nm(p[0], p[1], from[0], from[1]); if (d < 70) add(f, d*1.3, null); } }
  if (!h.length || !goalCost.size) return null;
  let best = null, bestC = Infinity;
  while (h.length) {
    const [k, u] = hpop(h); if (done.has(u)) continue; done.add(u);
    const cu = dist0.get(u);
    if (k >= bestC) break;
    if (goalCost.has(u) && cu + goalCost.get(u) < bestC) { bestC = cu + goalCost.get(u); best = u; }
    for (const [v, , d, l] of ADJ[u] || []) { if (done.has(v)) continue; add(v, cu + d*(hi && l === 'L' ? 1.08 : !hi && l === 'U' ? 1.15 : 1) + 2, u); }
  }
  if (!best) return null;
  const out = [best]; let c = best; while (prev.get(c)) { c = prev.get(c); out.unshift(c); }
  return out;
}
// a flight's whole route: { pts: [[lat, lon, name?]], sid, star, holdFix } from its origin to its destination. Airports on
// the map fly their real SID and STAR; far ones join and leave the airways where the great circle crosses the map's edge.
function planRoute(o, d, wdir = 250, rflHi = true){
  const O = apLL(o), Dd = apLL(d); if (!O || !Dd) return null;
  const sids = SIDS[o], stars = STARS[d];
  let start = O, startPts = [], starts = null, sidName = null;
  let end = Dd, goals = null, starName = null, holdFix = null;
  const oIn = inMap(O), dIn = inMap(Dd);
  if (!oIn) { start = edgeOf(O, Dd); if (!start) return null; }
  if (!dIn) { end = edgeOf(Dd, O); if (!end) return null; }
  // the SID whose end lies the way the flight is going (the runway for the wind)
  let sidSet = null;
  if (oIn && sids) {
    const rw = rwyFor(o, sids, wdir), list = sids.filter(r => r[0] === rw && procPts(r).length);
    if (list.length) { sidSet = list; starts = list.map(r => { const p = procPts(r); return [p[p.length - 1], procLen(p, O)*1.05, r]; }); }
  }
  let starSet = null;
  if (dIn && stars) {
    const rw = rwyFor(d, stars, wdir), list = stars.filter(r => r[0] === rw && procPts(r).length);
    if (list.length) { starSet = list; goals = list.map(r => { const p = procPts(r); return [p[0], procLen(p.slice(1), FIXP[p[0]])*1.05, r]; }); }
  }
  // short hops (Heathrow to Manchester) still go by airway; very short ones fly direct
  const via = gcNM(start, end) > 40 ? awyRoute(start, end, starts && starts.map(s => [s[0], s[1]]), goals && goals.map(g => [g[0], g[1]]), rflHi, oIn ? null : O, dIn ? null : Dd) : null;
  const pts = [[O[0], O[1], o]];
  if (via) {
    const sid = starts && starts.find(s => s[0] === via[0]);
    if (sid) { sidName = sid[2][1]; for (const n of procPts(sid[2]).slice(0, -1)) pts.push([FIXP[n][0], FIXP[n][1], n]); }
    else if (!oIn) pts.push([start[0], start[1], null]);
    for (const n of via) pts.push([FIXP[n][0], FIXP[n][1], n]);
    const star = goals && goals.find(g => g[0] === via[via.length - 1]);
    if (star) { starName = star[2][1]; holdFix = holdFixOf(star[2]); for (const n of procPts(star[2]).slice(1)) { if (/^(CF|FI|FF)/.test(n)) break; pts.push([FIXP[n][0], FIXP[n][1], n]); } }
    else if (!dIn) pts.push([end[0], end[1], null]);
  } else {
    if (!oIn) pts.push([start[0], start[1], null]);
    if (!dIn) pts.push([end[0], end[1], null]);
  }
  pts.push([Dd[0], Dd[1], d]);
  // drop a doubled point and any turn back on itself (a SID end behind the first airway fix)
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) { const p = pts[i], q = out[out.length - 1]; if (nm(p[0], p[1], q[0], q[1]) < 0.5) { if (p[2] && !q[2]) out[out.length - 1] = p; continue; } out.push(p); }
  for (let i = 1; i < out.length - 1; i++) {
    const a = out[i - 1], b = out[i], c = out[i + 1];
    if (Math.abs(angDiff(crs(a[0], a[1], b[0], b[1]), crs(b[0], b[1], c[0], c[1]))) > 150 && i > 1 && i < out.length - 2) { out.splice(i, 1); i--; }
  }
  return { pts: out, sid: sidName, star: starName, holdFix };
}
// the length of a route from index i (and the distance along it to each point)
function routeLen(pts){ let d = 0; const cum = [0]; for (let i = 1; i < pts.length; i++) { d += gcNM(pts[i - 1], pts[i]); cum.push(d); } return { total: d, cum }; }
function alongRoute(pts, cum, s){
  if (s <= 0) return { p: pts[0].slice(0, 2), i: 1, h: crs(pts[0][0], pts[0][1], pts[1][0], pts[1][1]) };
  for (let i = 1; i < pts.length; i++) if (cum[i] >= s) {
    const L = cum[i] - cum[i - 1] || 1, f = (s - cum[i - 1])/L, p = gcAt(pts[i - 1], pts[i], f);
    return { p, i, h: crs(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) };
  }
  const n = pts.length; return { p: pts[n - 1].slice(0, 2), i: n - 1, h: crs(pts[n - 2][0], pts[n - 2][1], pts[n - 1][0], pts[n - 1][1]) };
}

// ── sectors: who owns the airspace at a point and level ──
const SECS = AREA.sec.map((s, i) => {
  let a = [90, 180, -90, -180]; for (const [la, lo] of s.p) { a[0] = Math.min(a[0], la); a[1] = Math.min(a[1], lo); a[2] = Math.max(a[2], la); a[3] = Math.max(a[3], lo); }
  const base = s.n.replace(/\s*\(.*\)$/, '').replace(/\s+\d+[a-z]?$/i, '').trim();
  return { i, n: s.n, base, lo: s.lo, hi: s.hi, o: s.o, p: s.p, bb: a, r: s.r, ad: /^AD /.test(s.r) };
});
function pip(la, lo, P){
  let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [yi, xi] = P[i], [yj, xj] = P[j];
    if (((yi > la) !== (yj > la)) && lo < (xj - xi)*(la - yi)/(yj - yi) + xi) c = !c;
  } return c;
}
// the sectors a point is in (fl in hundreds of feet)
function secsAt(la, lo, fl){
  const out = [];
  for (const s of SECS) { if (fl < s.lo || fl >= s.hi || la < s.bb[0] || la > s.bb[2] || lo < s.bb[1] || lo > s.bb[3]) continue; if (pip(la, lo, s.p)) out.push(s); }
  return out;
}
// the positions open in the session: you and the AI controllers round you. A sector belongs to the first of its owners
// that is open, else to the last one listed (the unit's own bandbox: Paris, Brest, Shannon, a terminal radar)
const UK_OPEN = ['LS', 'LC', 'LN', 'LW', 'LE', 'TCSE', 'TCSW', 'TCNE', 'TCNW', 'TCE', 'PC', 'S'];
let OPEN = [], ME = 'LS';
function openFor(me){
  ME = me;
  OPEN = me === 'L' ? ['L', 'TCSE', 'TCSW', 'TCNE', 'TCNW', 'TCE', 'PC', 'S'] : [me, ...UK_OPEN.filter(c => c !== me), 'L'];
  for (const s of SECS) s.own = s.o.find(c => OPEN.includes(c)) || s.o[s.o.length - 1];
  MY = SECS.filter(s => s.own === ME);
  let a = [90, 180, -90, -180]; for (const s of MY) { a[0] = Math.min(a[0], s.bb[0]); a[1] = Math.min(a[1], s.bb[1]); a[2] = Math.max(a[2], s.bb[2]); a[3] = Math.max(a[3], s.bb[3]); }
  MYBB = a;
  MYLO = Math.min(...MY.map(s => s.lo)); MYHI = Math.max(...MY.map(s => s.hi));
}
let MY = [], MYBB = [0, 0, 0, 0], MYLO = 0, MYHI = 660;
// the owner at a point: whoever owns the most specific sector there (the narrowest band of levels: an approach unit's
// box under an upper sector), you when that is yours
function specific(ss){ let best = null; for (const s of ss) if (!best || (s.hi - s.lo) < (best.hi - best.lo) || ((s.hi - s.lo) === (best.hi - best.lo) && s.own === ME)) best = s; return best; }
// low down near an airport the airport's own radar works the traffic, whatever the area sectors above say
const APP_ZONES = Object.keys(AREA.ap).filter(k => (SIDS[k] || STARS[k]) && /^E[GI]/.test(k)).map(k => ({ k, la: AREA.ap[k][0], lo: AREA.ap[k][1], r: /^(EGLL|EGKK|EGSS|EGGW|EGLC|EGCC|EGPH|EGPF|EIDW)$/.test(k) ? 30 : 22 }));
function appAt(la, lo, alt){
  if (alt >= 9500) return null;
  for (const z of APP_ZONES) if (Math.abs(la - z.la) < 0.6 && nm(la, lo, z.la, z.lo) < z.r + Math.max(0, (9500 - alt)/1000)*1.5) return 'APP:' + z.k;
  return null;
}
function ownerAt(la, lo, alt){ const ap = appAt(la, lo, alt); if (ap) { const ss = secsAt(la, lo, alt/100).filter(s => s.ad || /^TC/.test(s.own)); return ss.length ? specific(ss).own : ap; } const ss = secsAt(la, lo, alt/100); return ss.length ? specific(ss).own : firAt(la, lo); }
function secAtMine(la, lo, alt){
  const fl = alt/100; if (la < MYBB[0] || la > MYBB[2] || lo < MYBB[1] || lo > MYBB[3] || fl < MYLO || fl >= MYHI) return null;
  if (fl < 95 && appAt(la, lo, alt)) return null;
  const ss = secsAt(la, lo, fl); if (!ss.length) return null; const s = specific(ss); return s.own === ME ? s : null;
}
const mineAt = (la, lo, alt) => !!secAtMine(la, lo, alt);
// outside every sector the data knows: the flight information region round about
function firAt(la, lo){
  if (lo < -10 || (lo < -8 && la > 51)) return la > 54 ? 'NAT' : 'SNE';
  if (la < 50.4 && lo < -1.5) return 'BR';
  if (la < 51.2) return 'P';
  if (la > 57.5 && lo > -1) return 'N';
  if (lo > 2.5) return la > 53.6 ? 'BMN' : 'AE';
  return 'L';
}
// a position's name and frequency
const UNIT_NAME = { L: 'London Control', S: 'Scottish Control', PC: 'Scottish Control', NAT: 'Shanwick', SNE: 'Shannon Control', BR: 'Brest Control', P: 'Paris Control',
  BMN: 'Bremen Radar', AE: 'Amsterdam Radar', N: 'Polaris Control', CUV: 'Copenhagen Control', BE: 'Brussels Control', IR: 'Reykjavik Control' };
function unitOf(code){
  if (/^APP:/.test(code)) { const ic = code.slice(4), q = Object.values(AREA.pos).find(v => v[0] === ic + '_APP') || Object.values(AREA.pos).find(v => v[0].startsWith(ic + '_') && /_APP|_DEP/.test(v[0]));
    return { code, name: q ? q[1] : apName(ic) + ' Radar', freq: q ? q[2] : '', cs: q ? q[0] : ic + '_APP' }; }
  const p = AREA.pos[code];
  let name = UNIT_NAME[code] || (p ? p[1] : code), freq = p ? p[2] : '';
  if (/^TC/.test(code)) name = 'London Control';   // the terminal sectors answer as London too
  if (code === 'NAT') { name = 'Shanwick'; freq = '127.900'; }
  return { code, name, freq, cs: p ? p[0] : code };
}
// the sector a code works, for the strips (the TC sectors and approach units by their own name)
const UNIT_SHORT = c => /^APP:/.test(c) ? unitOf(c).name.replace(/ (Radar|Approach|Director|Control)$/, '') : ({ L: 'London', LS: 'London S', LC: 'London C', LN: 'London N', LW: 'London W', LE: 'London E', S: 'Scottish', PC: 'Manchester',
  TCSE: 'TC South-East', TCSW: 'TC South-West', TCNE: 'TC North-East', TCNW: 'TC North-West', TCE: 'TC East', NAT: 'Shanwick', SNE: 'Shannon', BR: 'Brest', P: 'Paris',
  AE: 'Amsterdam', BMN: 'Bremen', N: 'Polaris', BE: 'Brussels', CUV: 'Copenhagen' })[c] || (AREA.pos[c] ? AREA.pos[c][1].replace(/ (Control|Radar|Director|Approach)$/, '') : c);

// ── standing agreements: the level a flight crosses into the next sector at ──
// COPX rows: [fix before or departure airport, fix, fix after or arrival airport, from sector, to sector, climb FL, descend FL]
const COPX = AREA.copx.map(r => ({ fb: r[0], fix: r[1], fa: r[2], fr: r[3], to: r[4], clb: r[5], des: r[6] }));
const secBase = n => n.replace(/\s*\(.*\)$/, '').replace(/\s+\d+[a-z]?$/i, '').trim();
// the agreement for a flight crossing from sector a to sector b on its route: the most specific match
function agreementFor(ac, a, b){
  if (!a || !b) return null;
  const fr = secBase(a.n), to = secBase(b.n), names = new Set(ac.route.map(p => p[2]).filter(Boolean));
  let best = null, score = -1;
  for (const r of COPX) {
    if (!(fr.startsWith(r.fr) || r.fr.startsWith(fr)) || !(to.startsWith(r.to) || r.to.startsWith(to))) continue;
    if (r.fix !== '*' && !names.has(r.fix)) continue;
    let sc = r.fix !== '*' ? 2 : 0;
    if (r.fa !== '*') { if (r.fa === ac.arr) sc += 4; else if (names.has(r.fa)) sc += 1; else continue; }
    if (r.fb !== '*') { if (r.fb === ac.dep) sc += 4; else if (names.has(r.fb)) sc += 1; else continue; }
    if (sc > score) { score = sc; best = r; }
  }
  return best;
}

// ── routes from where a flight is now (live traffic: we only know where it is, and perhaps where it is going) ──
// on: the airway fixes ahead of it (within 80° of its track), joined at the nearest; then airways to the STAR of its
// destination, or towards a far destination (or, not knowing, a point far ahead on its track) until the map's edge
// joining fixes: well ahead (a gentle turn onto the airway, not a sharp one), the straighter the better
function startsAhead(la, lo, trk, r = 80){
  const out = [];
  for (let cone = 35; cone <= 80 && out.length < 3; cone += 15) {
    out.length = 0;
    for (const f of AWY_NODES) { const p = FIXP[f], d = nm(la, lo, p[0], p[1]), off = Math.abs(angDiff(trk, crs(la, lo, p[0], p[1])));
      if (d < r && d > 10 && off < cone) out.push([f, d*1.25 + off*0.8]); }
  }
  return out;
}
// a route from where an aircraft is that starts with a turn of more than 25°: it joins along a gentle intercept instead,
// a point ahead on its present track first, and drops any point it would have to turn back for
function smoothJoin(route, la, lo, trk){
  if (!route || route.length < 2) return route;
  let i = 1;
  while (i < route.length - 1) { const p = route[i], d = nm(la, lo, p[0], p[1]); if (Math.abs(angDiff(trk, crs(la, lo, p[0], p[1]))) > 70 || d < 4) i++; else break; }
  const out = [route[0], ...route.slice(i)], p = out[1], d = nm(la, lo, p[0], p[1]), off = angDiff(trk, crs(la, lo, p[0], p[1]));
  if (Math.abs(off) > 25 && d > 12) {
    // fly on for a while, then turn half way, so the turn onto the route is spread out
    const a = moveLL(la, lo, trk, Math.min(14, d*0.3)), b = moveLL(a[0], a[1], norm(trk + off*0.6), Math.min(14, d*0.25));
    out.splice(1, 0, [a[0], a[1], null], [b[0], b[1], null]);
  }
  return out;
}
function routeOnward(la, lo, trk, arr){
  const here = [la, lo, null], D = arr && apLL(arr);
  const starts = startsAhead(la, lo, trk);
  if (!starts.length) return null;
  let via = null, tail = [];
  if (D && inMap(D) && STARS[arr]) {
    const rw = rwyFor(arr, STARS[arr], S.wdir), list = STARS[arr].filter(r => r[0] === rw && procPts(r).length);
    const goals = list.map(r => { const p = procPts(r); return [p[0], procLen(p.slice(1), FIXP[p[0]])*1.05, r]; });
    if (nm(la, lo, D[0], D[1]) < 50) return [here, [D[0], D[1], arr]];
    via = awyRoute([la, lo], D, starts, goals.map(g => [g[0], g[1]]), true);
    const g = via && goals.find(x => x[0] === via[via.length - 1]);
    if (g) for (const n of procPts(g[2]).slice(1)) { if (/^(CF|FI|FF)/.test(n)) break; tail.push([FIXP[n][0], FIXP[n][1], n]); }
    tail.push([D[0], D[1], arr]);
  } else {
    const far = D || moveLL(la, lo, trk, 900), edge = inMap(far) ? far : edgeOf(far, [la, lo]);
    if (!edge) return null;
    via = awyRoute([la, lo], edge, starts, null, true, null, inMap(far) ? null : far);
    tail.push(D ? [D[0], D[1], arr] : [far[0], far[1], null]);
  }
  if (!via) return null;
  return [here, ...via.map(n => [FIXP[n][0], FIXP[n][1], n]), ...tail];
}
// back: from its origin (its SID, airways) to where it is now
function routeBack(la, lo, trk, dep){
  const O = dep && apLL(dep); if (!O) return null;
  const back = norm(trk + 180), goals = startsAhead(la, lo, back, 70);
  if (!goals.length) return [[O[0], O[1], dep], [la, lo, null]];
  let starts = null, sidPts = [];
  if (inMap(O) && SIDS[dep]) {
    const rw = rwyFor(dep, SIDS[dep], S.wdir), list = SIDS[dep].filter(r => r[0] === rw && procPts(r).length);
    starts = list.map(r => { const p = procPts(r); return [p[p.length - 1], procLen(p, O)*1.05, r]; });
  }
  const from = inMap(O) ? O : edgeOf(O, [la, lo]); if (!from) return [[O[0], O[1], dep], [la, lo, null]];
  const via = awyRoute(from, [la, lo], starts && starts.map(s => [s[0], s[1]]), goals, true, inMap(O) ? null : O, null);
  if (!via) return [[O[0], O[1], dep], [la, lo, null]];
  const sid = starts && starts.find(s => s[0] === via[0]);
  if (sid) sidPts = procPts(sid[2]).slice(0, -1).map(n => [FIXP[n][0], FIXP[n][1], n]);
  const pts = [[O[0], O[1], dep], ...sidPts, ...via.map(n => [FIXP[n][0], FIXP[n][1], n])], last = pts[pts.length - 1], d = nm(la, lo, last[0], last[1]);
  // the last stretch arrives along the way it is flying now, not at an angle
  if (d > 12 && Math.abs(angDiff(back, crs(la, lo, last[0], last[1]))) > 20) { const q = moveLL(la, lo, back, Math.min(14, d*0.35)); pts.push([q[0], q[1], null]); }
  return [...pts, [la, lo, null]];
}
// a past route with the levels it would have flown: up from the airport at about 230 ft a mile, never above where it is now
function pastWithAlt(pts, altNow){
  if (!pts || pts.length < 2) return null;
  const out = []; let s = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i) { const L = gcNM(pts[i - 1], pts[i]), n = Math.max(1, Math.ceil(L/30)); for (let k = 1; k <= n; k++) { const q = gcAt(pts[i - 1], pts[i], k/n); out.push([q[0], q[1], Math.min(altNow, 500 + (s + L*k/n)*230)]); } s += L; }
    else out.push([pts[0][0], pts[0][1], 0]);
  }
  return out;
}
