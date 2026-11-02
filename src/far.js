// ═════════════════════════ the wider picture: flights en route to and from Gibraltar ═════════════════════════
// Every timetabled flight is shown for its whole journey. Inbounds leave their origin at the right time and fly a
// rough airway route (great circles between turning points) to the point where they appear as pending tracks;
// departures carry on to their destination after they leave the radar area. Outside radar cover they are drawn as
// plane icons with a data tag, like a flight-tracking map. Positions are worked out from the clock, so nothing drifts.
const AP = {
  EGLL: [51.4700, -0.4543, 'London Heathrow'], EGKK: [51.1481, -0.1903, 'London Gatwick'], EGGW: [51.8747, -0.3683, 'London Luton'],
  EGSS: [51.8850, 0.2350, 'London Stansted'], EGCC: [53.3537, -2.2750, 'Manchester'], EGGD: [51.3827, -2.7191, 'Bristol'],
  EGVN: [51.7500, -1.5836, 'RAF Brize Norton'], EGLF: [51.2758, -0.7763, 'Farnborough'], LFPG: [49.0097, 2.5479, 'Paris CDG'],
  LFMN: [43.6584, 7.2159, 'Nice'], LEMD: [40.4719, -3.5626, 'Madrid'], LEZL: [37.4180, -5.8931, 'Seville'],
  LEMG: [36.6749, -4.4991, 'Málaga'], GMTT: [35.7269, -5.9169, 'Tangier'], GMMN: [33.3675, -7.5899, 'Casablanca'],
  LXGB: [36.1512, -5.3494, 'Gibraltar']
};
Object.assign(AP, APT.airports || {});
// diversion airports, by the name each profile's APT.divertTo gives
const DIVERT_AP = { 'Tangier': ['GMTT'], 'Málaga': ['LEMG'], 'Southend': ['EGMC', 51.5714, 0.6956], 'Stansted': ['EGSS'], 'Luton': ['EGGW'],
  'Porto Santo': ['LPPS', 33.0734, -16.3500, 'Porto Santo'], 'Salzburg': ['LOWS', 47.7933, 13.0043], 'Munich': ['EDDM', 48.3538, 11.7861],
  'Newark': ['KEWR', 40.6925, -74.1687], 'La Guardia': ['KLGA', 40.7769, -73.8740], 'Boston': ['KBOS', 42.3656, -71.0096] };
for (const [nm, [ic, la, lo]] of Object.entries(DIVERT_AP)) if (!AP[ic] && la != null) AP[ic] = [la, lo, nm];
function divDest(ac){
  const nm = ac.divertTo && ac.divertTo[0], e = DIVERT_AP[nm], a = e && AP[e[0]]; if (!a) return null;
  return { icao: e[0], name: nm, ll: [a[0], a[1]], p: xy(a[0], a[1]) };
}
// turning points outbound from Gibraltar (inbounds fly them in reverse)
const VIA_N = [[37.25, -4.55], [40.00, -3.80], [43.30, -2.30], [46.20, -1.30]];          // up through Spain and western France
const VIA_W = [[36.40, -6.70], [37.40, -9.10], [40.50, -9.80], [43.90, -9.40], [48.00, -6.50]]; // west of Portugal, Biscay, Cornwall
const VIA = APT.via || {
  EGLL: VIA_N, EGKK: VIA_N, EGSS: VIA_N, EGLF: VIA_N, LFPG: [[37.25, -4.55], [40.00, -3.80], [43.30, -1.00]],
  EGCC: VIA_W, EGGD: VIA_W, EGVN: VIA_W, EGGW: VIA_W,
  LFMN: [[36.85, -3.00], [38.60, 0.40], [41.50, 4.00]], LEMD: [[37.25, -4.55]], GMMN: [[35.40, -6.40]]
};
const CRUISE = { AT76: [270, 21000], PC12: [260, 26000], A400: [340, 31000], C56X: [430, 41000], GLF6: [480, 45000] };
const FAR = { list: [] };
const toLL = p => [LAT0 + p[1]/60, LON0 + p[0]/(60*COSL)];
const gcDist = ([a1, o1], [a2, o2]) => { const p1 = a1*D2R, p2 = a2*D2R, dp = p2 - p1, dl = (o2 - o1)*D2R; const h = Math.sin(dp/2)**2 + Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2; return 2*3440.065*Math.asin(Math.min(1, Math.sqrt(h))); };
const gcBrg = ([a1, o1], [a2, o2]) => { const p1 = a1*D2R, p2 = a2*D2R, dl = (o2 - o1)*D2R; return norm(Math.atan2(Math.sin(dl)*Math.cos(p2), Math.cos(p1)*Math.sin(p2) - Math.sin(p1)*Math.cos(p2)*Math.cos(dl))*R2D); };
function gcAt([a1, o1], [a2, o2], f){
  const d = gcDist([a1, o1], [a2, o2])/3440.065; if (d < 1e-9) return [a1, o1];
  const A = Math.sin((1 - f)*d)/Math.sin(d), B = Math.sin(f*d)/Math.sin(d), p1 = a1*D2R, l1 = o1*D2R, p2 = a2*D2R, l2 = o2*D2R;
  const x = A*Math.cos(p1)*Math.cos(l1) + B*Math.cos(p2)*Math.cos(l2), y = A*Math.cos(p1)*Math.sin(l1) + B*Math.cos(p2)*Math.sin(l2), z = A*Math.sin(p1) + B*Math.sin(p2);
  return [Math.atan2(z, Math.hypot(x, y))*R2D, Math.atan2(y, x)*R2D];
}
// local map position of a lat/lon, longitude taken the short way round from this airport (so a flight across the date line
// leaves one edge of the world and comes back in from the other)
const llxy = (lat, lon) => [(((lon - LON0 + 540) % 360) - 180)*60*COSL, (lat - LAT0)*60];
const nearGib = ll => gcDist(ll, AP[APT.icao]) < 70;
// ── a realistic airway-like route: the great circle broken into legs of 150-300 NM whose turning points sit a little to
// one side or the other (as airways do), and every corner flown as a smooth turn, never a sharp one
const gcDest = ([a, o], b, nm) => { const d = nm/3440.065, p1 = a*D2R, l1 = o*D2R, t = b*D2R, p2 = Math.asin(Math.sin(p1)*Math.cos(d) + Math.cos(p1)*Math.sin(d)*Math.cos(t));
  return [p2*R2D, (l1 + Math.atan2(Math.sin(t)*Math.sin(d)*Math.cos(p1), Math.cos(d) - Math.sin(p1)*Math.sin(p2)))*R2D]; };
const hashOf = s => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
// The route between points is the real airway network (awy.js: the UK AIP / sector-file ATS routes, Dijkstra between the two
// nearest joins), so far flights follow the airways the way they are filed; where there are none (the ocean, beyond the
// data) it is the great circle with a gentle zig-zag of turning points, as before. Corners are flown as fly-by turns.
if (typeof AWYDATA !== 'undefined' && typeof AW !== 'undefined' && !AW.ready) { try { AW.init(AWYDATA); } catch (e) { /* the old routes */ } }
function airwayPts(pts, seed, keepLast){
  let rnd = hashOf(seed); const rn = () => ((rnd = Math.imul(rnd ^ (rnd >>> 15), 2246822507) >>> 0) / 4294967296)*2 - 1;
  const out = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const A = pts[i-1], B = pts[i], D = gcDist(A, B), last = keepLast && i === pts.length - 1;
    if (!last && D >= 60 && typeof AW !== 'undefined' && AW.ready) {
      let fx = []; try { fx = AW.legBetween([A[0], A[1]], [B[0], B[1]], { rf: 70, rt: 70 }); } catch (e) { fx = []; }
      // no doubling back: a joining fix behind the start or beyond the end is dropped
      fx = fx.filter(q => gcDist(A, q) < D + 40 && gcDist(q, B) < D + 40);
      if (fx.length) { for (const q of fx) out.push([q[0], q[1]]); out.push(B); continue; }
    }
    // the great circle broken into legs whose turning points sit a little to one side or the other (as airways do)
    // beyond the airway data: long-haul and oceanic legs (over 1,800 NM) are a great circle, as they are filed; shorter legs over
    // the continent bend a little at turning points every 120 NM or so, the way airway routes do
    const legNM = 120, n = last || D < 150 || D > 1800 ? 1 : Math.max(2, Math.round(D/legNM));
    let off = 0;
    for (let j = 1; j < n; j++) {
      const L = D/n, cap = Math.min(D > 1800 ? 18 : 9, L*0.075);
      off = clamp(off*0.6 + rn()*cap, -cap*1.4, cap*1.4);
      const k = Math.min(1, j, n - j)*(j === 1 || j === n - 1 ? 0.5 : 1);
      const q = gcAt(A, B, j/n), h = gcBrg(gcAt(A, B, j/n - 0.01), q); out.push(gcDest(q, h + 90, off*k));
    }
    out.push(B);
  }
  return out;
}
// how fast an aircraft turns on its way (degrees per NM flown): a steady 25 degrees of bank at its speed, so a slow climbing departure
// turns tight (about a 2 NM radius at 250 kt) and a cruising one wide (about 6 NM at 450 kt); it rolls into the turn over the first few miles
const turnRate = (gs, k) => clamp(57.3/(Math.pow(clamp(gs || 250, 180, 480)*0.5144, 2)/(9.81*0.466)/1852), 7, 30)*Math.min(1, 0.3 + 0.35*k);
function smoothPts(pts, keepLast){
  // each corner rounded off: a curve from a point before the turning point to one after it (never more than about a third
  // of either leg), so the heading changes gradually through the turn
  if (pts.length < 3) return pts;
  pts = pts.map(p => p.slice()); for (let i = 1; i < pts.length; i++) { while (pts[i][1] - pts[i-1][1] > 180) pts[i][1] -= 360; while (pts[i][1] - pts[i-1][1] < -180) pts[i][1] += 360; }   // longitudes made continuous over the date line
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++) {
    const A = pts[i-1], V = pts[i], B = pts[i+1], la = gcDist(A, V), lb = gcDist(V, B);
    // a fly-by turn as an airliner flies it: straight to the turning point, round at about a 6 NM radius (25 degrees of bank at
    // cruise speed), straight on again; the turn starts radius x tan(half the change of course) before the point
    const turn = Math.abs(angDiff(gcBrg(A, V), gcBrg(V, B)))*D2R;
    const c = Math.min(6*Math.tan(Math.min(turn, 2.6)/2), la/2.2, (keepLast && i === pts.length - 2 ? lb/3 : lb/2.2)); if (c < 0.15) { out.push(V); continue; }
    const P = gcAt(V, A, c/la), Q = gcAt(V, B, c/lb);
    const n = clamp(Math.ceil(c/1.2), 12, 60);   // about a point a mile, so a wide curve has no visible facets close in
    for (let k = 0; k <= n; k++) { const t = k/n, u = 1 - t;   // quadratic through the corner, in degrees (short distances)
      out.push([u*u*P[0] + 2*u*t*V[0] + t*t*Q[0], u*u*P[1] + 2*u*t*V[1] + t*t*Q[1]]); }
  }
  out.push(pts[pts.length - 1]);
  return out;
}
const airway = (pts, seed, keepLast) => smoothPts(airwayPts(pts, seed, keepLast), keepLast);
function makeLeg(pts){ const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i-1] + gcDist(pts[i-1], pts[i])); return { pts, cum, D: cum[cum.length-1] }; }
function legAt(L, d){
  d = clamp(d, 0, L.D); let i = 1; while (i < L.cum.length - 1 && L.cum[i] < d) i++;
  const seg = L.cum[i] - L.cum[i-1] || 1, f = (d - L.cum[i-1])/seg;
  return { ll: gcAt(L.pts[i-1], L.pts[i], f), hdg: gcBrg(gcAt(L.pts[i-1], L.pts[i], Math.max(0, f - 0.01)), gcAt(L.pts[i-1], L.pts[i], Math.min(1, f + 0.01))) };
}
// inbound: origin to the pending-track position, arriving there exactly when the sim takes over
function addArrGhost(f){
  if (!AP[f.o] || !(f.m > 0)) return;
  const tEnd = f.m*60 - PRE_LEAD; if (tEnd <= 0) return;
  const e = ENTRY[f.gate], { u, nm: preNM } = preVec(f);
  const endLL = toLL([e[0] + u[0]*preNM, e[1] + u[1]*preNM]);
  const via = (VIA[f.o] || []).filter(p => !nearGib(p) && gcDist(p, endLL) > 40).slice().reverse();
  // it joins the entry point flying in along the same line the pending track then follows, with no turn at the handover
  const join = gcDist(AP[f.o], endLL) > 190 ? [toLL([e[0] + u[0]*(PRE_NM + 90), e[1] + u[1]*(PRE_NM + 90)])] : [];
  const leg = makeLeg(airway([AP[f.o].slice(0, 2), ...via.filter(p => gcDist(p, join[0] || endLL) > 60), ...join, endLL], f.cs + f.o, true)), [spd, fl] = CRUISE[f.t] || [450, 37000];
  const cruise = Math.min(fl, 9000 + leg.D*75), tStart = tEnd - leg.D/spd*3600;
  FAR.list.push({ cs: f.cs, t: f.t, from: f.o, to: APT.icao, kind: 'ARR', leg, tStart, tEnd, spd, cruise, endAlt: PRE_ALT[f.gate], f });
}
// outbound: from wherever it left the radar area on to the destination
function addDepGhost(ac, at){
  const p0 = at || toLL([ac.x, ac.y]);
  // a departure whose destination we don't know (a live flight not on the board): it flies on the way it left for a few
  // hundred miles, its line smooth, rather than vanishing at the edge of radar cover
  if (!AP[ac.d]) { if (at || ac.hdg == null) return; const leg = makeLeg(smoothPts([p0, gcDest(p0, ac.hdg, 40), gcDest(gcDest(p0, ac.hdg, 40), ac.hdg, 360)])), [spd, fl] = CRUISE[ac.t] || [450, 37000];
    FAR.list.push({ cs: ac.cs, t: ac.t, from: APT.icao, to: ac.d || '?', kind: 'DEP', track: ac.track, leg, tStart: S.t, tEnd: S.t + leg.D/spd*3600, spd, cruise: Math.min(fl, 9000 + leg.D*75), startAlt: ac.alt, endAlt: 30000 }); return; }
  const via = (VIA[ac.d] || []).filter(p => !nearGib(p) && gcDist(p, p0) > 30 && gcDist(p, AP[ac.d]) < gcDist(p0, AP[ac.d]));
  // on from where it left the radar area along the heading it had, then round towards the destination
  // on along the heading it left with for a short way (further the more it has to turn), then round towards the destination
  // it turns from the heading it left with onto its way to the destination as an aircraft does: 15 degrees each 6 NM
  // (a steady turn), then the airway route on from there
  const lead = [];
  if (!at && ac.hdg != null && gcDist(p0, AP[ac.d]) > 150) { let p = p0, h = ac.trk ?? ac.hdg;
    for (let k = 0; k < 90; k++) { const d = angDiff(h, gcBrg(p, AP[ac.d])); if (Math.abs(d) < 2) break; h = norm(h + Math.sign(d)*Math.min(turnRate(ac.gs, k/2)*0.5, Math.abs(d))); p = gcDest(p, h, 0.5); lead.push(p); } }
  // the turn off its heading and the airway route on from there, smoothed as one so the join is not a corner
  const leg = makeLeg(smoothPts([p0, ...lead.slice(0, -1), ...airwayPts([lead.length ? lead[lead.length - 1] : p0, ...via, AP[ac.d].slice(0, 2)], ac.cs + ac.d, false)])), [spd, fl] = CRUISE[ac.t] || [450, 37000];
  const t0 = S.t + (at ? ac.dt0 || 0 : 0);
  FAR.list.push({ cs: ac.cs, t: ac.t, from: ac.from || APT.icao, to: ac.d, kind: ac.from ? 'DIV' : 'DEP', track: ac.track, leg, tStart: t0, tEnd: t0 + leg.D/spd*3600, spd, cruise: Math.min(fl, 9000 + leg.D*75), startAlt: at ? APT.initClimb : ac.alt, endAlt: 0 });
}
// ── the whole route of a selected flight: what it has flown (solid) and the rough airway route on to its destination or back to
// where it came from (dashed), as [x, y, altitude, on the ground] points
function legPts(leg, d0, d1, altAt){
  // every point of the route itself (so a turn keeps all its points), plus extra points along any long straight stretch
  const out = [], step = Math.max(2, leg.D/400), ds = [d0];
  for (let i = 1; i < leg.cum.length; i++) {
    const a = leg.cum[i - 1], b = leg.cum[i]; if (b <= d0 || a >= d1) continue;
    const lo = Math.max(a, d0), hi = Math.min(b, d1), n = Math.ceil((hi - lo)/step);
    for (let k = 1; k <= n; k++) ds.push(lo + (hi - lo)*k/n);
  }
  if (ds[ds.length - 1] < d1) ds.push(d1);
  for (const d of ds) { const p = llxy(...legAt(leg, d).ll), q = out[out.length - 1];
    if (q && Math.hypot(p[0] - q[0], p[1] - q[1]) < 0.05) continue;
    out.push([p[0], p[1], Math.round(altAt(d)), 0, q && Math.abs(p[0] - q[0]) > 60*COSL*100 ? 1 : 0]); }   // 1: the world's edge, the line starts again on the other side
  return out;
}
// the straight line from a flight's position on to the airport it is bound for (dashed on the map)
function crowFly(from, to, alt0, alt1, climb){
  const L = makeLeg([from, to]), cr = 0;
  return legPts(L, 0, L.D, x => climb ? Math.min(alt0 + x*330, 40000, Math.max(0, (L.D - x)*300)) : Math.max(alt1, alt0 - x*330));
}
// ── a flight's route on from where it is, flown the way an aircraft flies it: the points it is still cleared to, then a
// steady turn off its heading (about a 6 NM radius) onto the airway route to its destination. Unknown destination: on
// the way it is going. Corners are all rounded, so the line never has a sharp angle.
function wayOn(o, dest, seed){
  const here = toLL([o.x, o.y]); let p = here, h = o.trk ?? o.hdg ?? 0; const pts = [here];
  // the points it is still cleared to: only while it is yours inside radar cover (once handed on, the next unit has it on
  // its way), and only those still ahead of it, never ones it has already flown past
  const mine = !(typeof outOfCtl === 'function' && outOfCtl(o)) && !(typeof outsideRadar === 'function' && outsideRadar(o));
  const cleared = !mine ? [] : o.kind === 'DEP' && !o.ground ? ((o.mode === 'NAV' && o.route && o.route.length ? o.route : (o.onSid ? exitRouteOf(o) || [] : [])) || []) : (o.mode === 'NAV' && o.route ? o.route : []);
  let firstFix = true;
  // a departure still on the ground: from the runway it will take, along its SID's fixes, then on as below
  if (o.kind === 'DEP' && o.ground && mine && typeof exitRouteOf === 'function') {
    const rw = depRw(o), R = rwyOf(rw), up = rw === R.lo, fx = (exitRouteOf(o) || []).filter(id => WP[id]);
    if (R && R.rm && fx.length) {
      const endR = toLL(R.rm(up ? R.len : 0, 0)), rh = crsOf(rw);
      pts.length = 0; pts.push(...flyPts(toLL(R.rm(R.len*0.5, 0)), rh, [endR, gcDest(endR, rh, 1), ...fx.map(id => toLL(WP[id].p))], 0.3));
      p = pts[pts.length - 1]; h = gcBrg(pts[pts.length - 2], p);
      if (!dest) { pts.push(gcDest(p, h, 300)); return smoothPts(pts); }
      for (let k = 0; k < 90 && gcDist(p, dest) > 15; k++) { const d = angDiff(h, gcBrg(p, dest)); if (Math.abs(d) < 2) break; h = norm(h + Math.sign(d)*Math.min(turnRate(o.gs, k/2)*0.5, Math.abs(d))); p = gcDest(p, h, 0.5); pts.push(p); }
      const via = (VIA[o.d] || []).filter(q => !nearGib(q) && gcDist(q, p) > 30 && gcDist(q, dest) < gcDist(p, dest));
      return smoothPts([...pts.slice(0, -1), ...airwayPts([p, ...via, dest], seed, false)]);
    }
  }
  for (const id of cleared) { if (!WP[id]) continue; const q = toLL(WP[id].p);
    const off = Math.abs(angDiff(h, gcBrg(p, q))), dq = gcDist(p, q);
    if (dq < 1 || off > 95 || (off > 45 && dq < 4)) continue;   // behind it already, or too close to turn for
    // the first point it turns towards as it would: round from its heading, not a corner where it is
    if (firstFix) { const T = flyTurn(p, h, q, clamp(dq/30, 0.5, 1.5)); pts.push(...T.slice(1)); h = gcBrg(T[Math.max(0, T.length - 2)], q); firstFix = false; }
    else { pts.push(q); h = gcBrg(p, q); }
    p = q; }
  if (!dest) { pts.push(gcDest(p, h, 300)); return smoothPts(pts); }
  for (let k = 0; k < 90 && gcDist(p, dest) > 15; k++) { const d = angDiff(h, gcBrg(p, dest)); if (Math.abs(d) < 2) break; h = norm(h + Math.sign(d)*Math.min(turnRate(o.gs, k/2)*0.5, Math.abs(d))); p = gcDest(p, h, 0.5); pts.push(p); }
  const via = (VIA[o.d] || []).filter(q => !nearGib(q) && gcDist(q, p) > 30 && gcDist(q, dest) < gcDist(p, dest));
  return smoothPts([...pts.slice(0, -1), ...airwayPts([p, ...via, dest], seed, false)]);
}
// ── where a flight came from: its origin, the airway route, and a last stretch that arrives along the way it was flying
// where we first saw it (no kink where the line meets its track)
function wayIn(o, from, end, dir){
  const O = from, D = gcDist(O, end);
  const via = (VIA[o.o] || []).filter(p => !nearGib(p) && gcDist(p, end) > 40 && gcDist(p, O) > 30).slice().reverse();
  // a short hop: worked back from where we saw it, a steady turn round towards its origin, so it meets its track in line
  if (D < 70) {
    // lined up with where it came from: a steady turn onto its track. Well off that line (it is flying across the way in from its origin) the
    // route goes straight to a point just back along its track, not out and round to come back on it
    const a0 = Math.abs(angDiff(dir, gcBrg(O, end)));
    if (a0 > 20) return makeLeg(smoothPts([O, gcDest(end, dir + 180, Math.min(6, D/6)), end]));
    return makeLeg(intercept(O, gcBrg(O, end), end, dir, clamp(D/60, 0.4, 1)));
  }
  // the airway route to a point well back along the line it was flying, then a steady turn to intercept that line
  // (only a long way back when the track it was flying points along the way in from its origin: a vector or downwind leg
  // close in says nothing about the route it flew to get there)
  const al = Math.abs(angDiff(dir, gcBrg(O, end))), back = D > 190 ? (al < 30 ? 110 : al < 60 ? 45 : 15) : Math.min(al < 60 ? 45 : 15, D/2.2);
  const J = gcDest(end, dir + 180, back);
  const vv = via.filter(p => gcDist(p, J) > 60 && gcDist(p, end) > gcDist(J, end));
  // J lies on that line, so the airway's last leg meets it at a corner: rounded off as one wide curve that ends up along the
  // line, rather than an autopilot intercept begun at J itself (which overshot and looped round to come back to it)
  return makeLeg(smoothPts([...airwayPts([O, ...vv, J], o.cs + (o.o || ''), false), end]));
}
// a smooth way from A (flying ha) to B (arriving on hb): drawn from both ends at once, onward from A and backwards from B,
// each end turning steadily towards the other until they meet, so it leaves A and reaches B on their headings, no corners
function meet(A, ha, B, hb, st, tight){
  const ha0 = ha, hb0 = hb, A0 = A, B0 = B, fa = [A], fb = [B]; hb = norm(hb + 180); let ta = 0, tb = 0;
  for (let k = 0; k < 240 && gcDist(A, B) > st*2.2; k++) {
    let d = angDiff(ha, gcBrg(A, B)), t = Math.sign(d)*Math.min(11, Math.abs(d)); ha = norm(ha + t); ta += t; A = gcDest(A, ha, st); fa.push(A);
    if (gcDist(A, B) <= st*2.2) break;
    d = angDiff(hb, gcBrg(B, A)); t = Math.sign(d)*Math.min(11, Math.abs(d)); hb = norm(hb + t); tb += t; B = gcDest(B, hb, st); fb.push(B);
    // circling round each other (too close for the turn): give up and join the two directly, rounded off
    if (Math.abs(ta) > 270 || Math.abs(tb) > 270) return tight ? smoothPts([A0, B0]) : meet(A0, ha0, B0, hb0, Math.max(0.1, st/3), true); }
  return [...fa, ...fb.reverse()];
}
// an arrival picked up close in, drawn in by the procedure: the airway route from its origin to the arrival gate on that
// side (its stack or feed fix), down that gate's arrival route as far as the leg nearest where we saw it, then onto the
// track it was flying there. Picked up further out than that (still on its way in): the airway route straight to its track
function arrIn(o, first, dir, f0){
  const O = AP[o.o].slice(0, 2), home = AP[APT.icao].slice(0, 2), bo = gcBrg(home, O);
  const gt = Object.keys(ENTRY).sort((a, b) => Math.abs(angDiff(brg(...RADAR_REF, ...ENTRY[a]), bo)) - Math.abs(angDiff(brg(...RADAR_REF, ...ENTRY[b]), bo)))[0];
  const ids = gt && ARR_ROUTE[gt] ? (ARR_ROUTE[gt][arrKey(o)] || []).filter(id => WP[id]) : [];
  if (gt && gcDist(O, home) > 60) {
    const ch = [ENTRY[gt], ...ids.map(id => WP[id].p)]; let bi = 1, bd = Infinity;
    for (let i = 1; i < ch.length; i++) { const d = segDist(f0, ch[i-1], ch[i]); if (d < bd - 0.01) { bd = d; bi = i; } }
    if (bd < 15 || dist(...f0, ...RADAR_REF) < 30) {
      const pre = [ENTRY[gt], ...ids.slice(0, bi - 1).map(id => WP[id].p)].map(p => toLL(p)).filter(q => gcDist(q, first) > 4);
      if (pre.length) {
        const head = wayIn(o, O, pre[0], gcBrg(pre[0], pre[1] || first)), last = pre[pre.length - 1];
        const hL = gcBrg(pre.length > 1 ? pre[pre.length - 2] : head.pts[Math.max(0, head.pts.length - 2)], last);
        return makeLeg(smoothPts([...head.pts.slice(0, -1), ...pre.slice(0, -1), ...meet(last, hL, first, dir, clamp(gcDist(last, first)/24, 0.3, 1))]));
      }
    }
  }
  return wayIn(o, O, first, dir);
}
// the last stretch of an inbound: from its last arrival point, a steady turn to intercept the final approach course
function ontoFinal(from, h, F, home){
  if (!F || !F.pts || F.pts.length < 2) return [from, home];
  const thr = toLL(F.pts[F.pts.length - 1]), crs = gcBrg(toLL(F.pts[F.pts.length - 2]), thr);
  return intercept(from, h, thr, crs, 0.4);
}
const ptsLeg = pts => makeLeg(pts.map(p => p.slice(0, 2)));
// flown as an autopilot joins a line: from p on heading h it steers for a point a little way along the line (through
// `to`, on course crs) ahead of itself, so it turns steadily, intercepts and settles on the line, then flies on to `to`
function intercept(p, h, to, crs, step = 0.4){
  const out = [p], ux = Math.sin(crs*D2R), uy = Math.cos(crs*D2R);
  for (let k = 0; k < 300; k++) {
    const v = llxy(...p), t = llxy(...to), ax = v[0] - t[0], ay = v[1] - t[1], along = ax*ux + ay*uy;   // along < 0: still short of `to`
    if (along > -step*1.5) break;
    // the point it steers for: further ahead for a wider turn, so it settles on the line without overshooting
    const look = Math.min(-along, Math.max(2.5, step*5)), cx0 = t[0] + ux*(along + look), cy0 = t[1] + uy*(along + look);
    const want = brg(v[0], v[1], cx0, cy0), d = angDiff(h, want);
    h = norm(h + Math.sign(d)*Math.min(9, Math.abs(d))); p = gcDest(p, h, step); out.push(p);
  }
  out.push(to); return out;
}
// flown as an aircraft turns: from p on heading h, round at a steady rate (radius about 2.5 NM) until it points at the
// target, then straight there. Used where a line has to turn a long way in a short distance (out of a SID, onto final).
function flyTurn(p, h, target, step = 0.5, side = 0){
  // side: the way a procedure turns (1 right, -1 left), kept while the target is well round behind
  const out = [p];
  for (let k = 0; k < 80 && gcDist(p, target) > step*2; k++) {
    const d = angDiff(h, gcBrg(p, target)); if (Math.abs(d) < 4) break;
    h = norm(h + (side && Math.abs(d) > 110 ? side : Math.sign(d))*Math.min(11, Math.abs(d))); p = gcDest(p, h, step); out.push(p);
  }
  out.push(target); return out;
}
// flown through a list of points the way an aircraft flies them: from p on heading h, a steady turn towards each in turn
// (radius about 5 x step), then straight to it; so a procedure's hairpin (out west, back east) is a real turn, not a corner
function flyPts(p, h, targets, step = 0.3){
  const out = [p];
  for (const t of targets) { if (gcDist(p, t) < 0.2) continue; const T = flyTurn(p, h, t, step); out.push(...T.slice(1)); h = gcBrg(T[Math.max(0, T.length - 2)], t); p = t; }
  return out;
}
// the destination of a departure: its airport, or none when we don't know where it is
const destOf = o => AP[o.d] ? AP[o.d].slice(0, 2) : null;
function trkRoute(o){
  const cr = CRUISE[o.t] || [450, 37000], home = AP[APT.icao].slice(0, 2);
  if (o.leg) {   // a flight beyond radar cover (yellow plane)
    const g = o, D = g.leg.D, d = Math.min(D, farDist(g)), alt = x => Math.max(0, Math.min(g.cruise, (g.kind !== 'ARR' ? (g.startAlt || 0) : 1500) + x*330, (g.endAlt || 0) + (D - x)*300));
    const rec = (g.track || []).concat(legPts(g.leg, 0, d, alt));
    // ahead: the rest of the same route (to the pending-track point, then on to the airport for an inbound)
    const ext = [legPts(g.leg, d, D, alt)];
    if (g.kind === 'ARR') { const e = legAt(g.leg, D).ll, fx = ((g.f && ARR_ROUTE[g.f.gate] && ARR_ROUTE[g.f.gate][arrKey(g.f)]) || []).filter(id => WP[id]).map(id => toLL(WP[id].p)), lastP = fx.length ? fx[fx.length - 1] : e, inH = fx.length ? gcBrg(fx.length > 1 ? fx[fx.length - 2] : e, lastP) : legAt(g.leg, D).hdg, L = ptsLeg([...smoothPts([e, ...fx]).slice(0, -1), ...ontoFinal(lastP, inH, FINAL[S.rwy], home)]); ext.push(legPts(L, 0, L.D, x => Math.max(0, (g.endAlt || 6000) - x*300))); }
    return { rec, ext };
  }
  let rec = o.track || [];
  const ext = [], here = toLL([o.x, o.y]);
  const first = rec.length ? toLL([rec[0][0], rec[0][1]]) : here, dir = rec.length > 1 ? gcBrg(first, toLL([rec[Math.min(3, rec.length - 1)][0], rec[Math.min(3, rec.length - 1)][1]])) : (o.trk ?? o.hdg ?? 0);
  if (o.kind === 'ARR' && AP[o.o]) {
    // the whole way in from its origin: the route its en-route plane flew, else one built to meet its track smoothly
    if (!o._tb || o._tb.o !== o.o || o._tb.n0 !== (rec[0] || here)[0]) { const g = FAR.list.find(g => g.cs === o.cs && g.kind === 'ARR');
      const L = g && g.leg && gcDist(legAt(g.leg, g.leg.D).ll, first) < 8 ? g.leg : arrIn(o, first, dir, rec[0] ? [rec[0][0], rec[0][1]] : [o.x, o.y]);
      const a0 = rec.length ? rec[0][2] : o.alt || 6000, c = Math.min(cr[1], 9000 + L.D*75);
      o._tb = { o: o.o, n0: (rec[0] || here)[0], pts: legPts(L, 0, L.D, x => Math.max(0, Math.min(c, 1500 + x*330, a0 + (L.D - x)*300))) }; }
    rec = o._tb.pts.concat(rec);
    // ahead: what it is cleared to (drawn as the clearance line) when in radar cover, else its arrival route to the airport
    if (o.airborne && (o.state === 'PRE' || (typeof outsideRadar === 'function' && outsideRadar(o)))) {
      const fx = ((o.route && o.route.length ? o.route : (ARR_ROUTE[o.gate] && ARR_ROUTE[o.gate][arrKey(o)])) || []).filter(id => WP[id]).map(id => toLL(WP[id].p));
      const lastP = fx.length ? fx[fx.length - 1] : here, prevP = fx.length > 1 ? fx[fx.length - 2] : here, inH = fx.length ? gcBrg(prevP, lastP) : (o.trk ?? o.hdg ?? 0);
      const L = ptsLeg([...smoothPts([here, ...fx]).slice(0, -1), ...ontoFinal(lastP, inH, FINAL[landRw(o)], home)]); ext.push(legPts(L, 0, L.D, x => Math.max(0, o.alt - x*300)));
    }
  } else if (o.kind === 'DEP' && o.state !== 'PRE') {
    // a real departure picked up already airborne: from the runway to where we first saw it
    if (!o.ground && rec.length && gcDist(first, home) > 2 && !(rec[0] && rec[0][3])) {
      if (!o._db || o._db.n0 !== rec[0][0]) { const rh = crsOf(depRw(o)), D0 = gcDist(home, first), out = gcDest(home, rh, Math.min(3, D0/4)), back = gcDest(first, dir + 180, Math.min(5, D0/4));
        // flown by the procedure: off the runway it took, along its SID's fixes as far as the leg nearest where we saw it,
        // then onto the track it was flying there; the corners are rounded as an aircraft turns
        const rw = depRw(o), R = rwyOf(rw), up = rw === R.lo, lift = toLL(R.rm(R.len*(up ? 0.55 : 0.45), 0)), endR = toLL(R.rm(up ? R.len : 0, 0));
        const fx = (exitRouteOf(o) || []).filter(id => WP[id]), ch = [R.rm(up ? R.len : 0, 0), ...fx.map(id => WP[id].p)], f0 = [rec[0][0], rec[0][1]];
        let bi = 1, bd = Infinity;
        for (let i = 1; i < ch.length; i++) { const d = segDist(f0, ch[i-1], ch[i]); if (d < bd - 0.01) { bd = d; bi = i; } }
        // the SID as far as it is behind where we saw it when it was on it (within 3 NM of a leg); vectored off it, only its
        // first fix, which sets the way the procedure turns off the runway (unless that is already past where we saw it)
        const n = bi === 1 ? 0 : bd < 3 ? bi - 1 : 1, pre = fx.slice(0, n).map(id => toLL(WP[id].p)).filter(q => gcDist(q, first) > 3);
        const S0 = [lift, endR, gcDest(endR, rh, 1), ...pre], A0 = S0[S0.length - 1], hA = gcBrg(S0[S0.length - 2], A0);
        // then a steady turn towards a point a few miles back along the track it was flying when we saw it, and along that
        // track to where it appeared; every corner rounded as it would fly it
        const J = gcDest(first, norm(dir + 180), clamp(gcDist(A0, first)/3, 1.5, 6));
        // the way the SID itself turns there (or, not yet at its first fix, the way it turns at that fix)
        const ll = id => toLL(WP[id].p), side = pre.length ? (n < fx.length ? Math.sign(angDiff(hA, gcBrg(A0, ll(fx[n])))) : 0)
          : fx.length > 1 ? Math.sign(angDiff(gcBrg(endR, ll(fx[0])), gcBrg(ll(fx[0]), ll(fx[1])))) : 0;
        const T = gcDist(A0, J) > 1 ? flyTurn(A0, hA, J, clamp(D0/30, 0.3, 0.9), side) : [A0, J];
        const F = flyPts(lift, rh, S0.slice(1), 0.3), hF = gcBrg(F[Math.max(0, F.length - 2)], A0);
        // the procedure's own turn first (when it turns back on itself), then a smooth join onto its track from both ends
        const T2 = side && Math.abs(angDiff(hF, gcBrg(A0, first))) > 110 ? flyTurn(A0, hF, first, 0.3, side).slice(0, -1) : [A0];
        const P2 = T2[T2.length - 1], h2 = T2.length > 1 ? gcBrg(T2[T2.length - 2], P2) : hF;
        const L = ptsLeg(smoothPts([...F, ...T2.slice(1), ...meet(P2, h2, first, dir, clamp(gcDist(P2, first)/24, 0.3, 0.9)).slice(1)]));
        o._db = { n0: rec[0][0], pts: legPts(L, 0, L.D, x => Math.min(rec[0][2], x*350)) }; }
      rec = o._db.pts.concat(rec);
    }
    const L = ptsLeg(wayOn(o, destOf(o), o.cs + (o.d || '')));
    ext.push(legPts(L, 0, L.D, x => Math.max(0, Math.min(40000, (o.ground ? 0 : o.alt) + x*330, destOf(o) ? (L.D - x)*300 : 40000))));
  }
  return { rec, ext };
}
// the flight beyond radar cover under a click
function farAt(px, py){
  let best = null, bd = 20;
  for (const g of FAR.list) { const st = farState(g); if (!st) continue; const d = Math.hypot(sx(st.p[0]) - px, sy(st.p[1]) - py); if (d < bd) { bd = d; best = g; } }
  return best;
}
// at the start of a session: inbounds already airborne or due later, and today's earlier departures still en route
function buildFar(){
  FAR.list = [];
  if (EXERCISES[S.mode]) return;
  for (const f of S.sched) if (f.k === 'ARR') addArrGhost(f);
  const day = String((S.day || 0) + 1), t0 = (S.hour || 0)*60;
  if (/^live/.test(S.mode)) { const T = LIVE.session && LIVE.session.T; if (T) for (const d of T.dep) {   // today's real departures still en route
    const off = (d.tm + 8 - t0)*60; if (!d.cancelled && off >= -5*3600 && off < -600) addDepGhost({ cs: d.cs, t: d.t, d: d.ap, dt0: off - S.t }, toLL(rm(THR_HI_M - 1500, 0))); } return; }
  if (S.mode === 'custom') return;   // custom traffic: only the flights you asked for
  for (const [, , , dc, dd, td, t, days] of TIMETABLE) {
    if (!dc || !days.includes(day)) continue;
    const off = (hm(td) + 8 - t0)*60;                 // airborne about eight minutes after off-blocks
    if (off >= -5*3600 && off < -600) addDepGhost({ cs: dc, t, d: dd, dt0: off - S.t }, toLL(rm(THR_HI_M - 1500, 0)));
  }
}
// how far along its route a flight is. A retimed inbound (Flights board) flies on from (t1, d1) at speed v; one that
// would get there early, or one you have put on hold, flies a holding pattern (hold.d) until it is due
const farDist = g => g.hold ? g.hold.d : Math.min(g.leg.D, (g.d1 || 0) + (S.t - (g.t1 ?? g.tStart))/3600*(g.v || g.spd));
function farState(g){
  if (S.t > g.tEnd || (g.hold ? g.hold.ground : S.t < g.tStart)) return null;
  const d = farDist(g), { ll, hdg } = legAt(g.leg, d), left = g.leg.D - d;
  const up = g.kind !== 'ARR' ? (g.startAlt || 0) + d*330 : 1500 + d*330, down = g.endAlt + left*300;
  const alt = Math.max(0, Math.min(g.cruise, up, down));
  if (g.hold || (g.t1 != null && d >= g.leg.D - 0.01)) {   // holding: a rate-one orbit round the point it stopped at
    const c = llxy(...ll), a = (S.t*3) % 360, r = 0.7*(g.spd/250);
    return { p: [c[0] + Math.sin(a*D2R)*r, c[1] + Math.cos(a*D2R)*r], hdg: norm(a + 90), alt, gs: Math.round(g.spd*0.8), holding: true };
  }
  return { p: llxy(...ll), hdg, alt, gs: g.v || g.spd };
}
S.listeners.push((ev, d) => {
  if (ev === 'start') buildFar();
  if (ev === 'exit' && d && d.kind === 'DEP') addDepGhost(d);
  // a diversion leaving the radar area flies on to its alternate
  if (ev === 'exit' && d && d.kind === 'ARR' && d.state === 'DIVERTING') { const D = divDest(d); if (D) { addDepGhost({ cs: d.cs, t: d.t, d: D.icao, from: d.o, x: d.x, y: d.y, alt: d.alt }); FAR.done[d.cs] = 'Diverted to ' + D.name; } }
  if (ev === 'divlanded') FAR.done[d.cs] = 'Diverted to ' + d.divLanded.name;
});
// sim aircraft beyond radar cover are drawn the same way
const RADAR_NM = 60;
const outsideRadar = ac => ac.state === 'PRE' || Math.hypot(ac.x - RADAR_REF[0], ac.y - RADAR_REF[1]) > RADAR_NM;

// ── drawing ──
// the basic flight-tracker plane: en-route (yellow) and live background (grey) traffic
function basicPlane(X, Y, hdg, col, sel){
  cx.save(); cx.translate(X, Y); cx.rotate(hdg*D2R); const k = 0.9;
  cx.beginPath();
  cx.moveTo(0, -9*k); cx.quadraticCurveTo(1.6*k, -8*k, 1.6*k, -5*k); cx.lineTo(1.6*k, -2*k); cx.lineTo(9*k, 2*k); cx.lineTo(9*k, 3.6*k); cx.lineTo(1.6*k, 1.6*k);
  cx.lineTo(1.4*k, 6*k); cx.lineTo(4*k, 8*k); cx.lineTo(4*k, 9.2*k); cx.lineTo(0, 8.2*k); cx.lineTo(-4*k, 9.2*k); cx.lineTo(-4*k, 8*k); cx.lineTo(-1.4*k, 6*k);
  cx.lineTo(-1.6*k, 1.6*k); cx.lineTo(-9*k, 3.6*k); cx.lineTo(-9*k, 2*k); cx.lineTo(-1.6*k, -2*k); cx.lineTo(-1.6*k, -5*k); cx.quadraticCurveTo(-1.6*k, -8*k, 0, -9*k); cx.closePath();
  cx.fillStyle = col; cx.strokeStyle = sel ? '#0c1b2e' : 'rgba(40,30,0,.85)'; cx.lineWidth = sel ? 1.8 : 1; cx.fill(); cx.stroke();
  cx.restore();
}
// with a type: the shape of that aircraft (your own flights inside radar cover); without one: the basic plane
function planeIcon(X, Y, hdg, col, sel, type){
  if (!type) return basicPlane(X, Y, hdg, col, sel);
  // the type's real outline (shapes.js) at a fixed on-screen size by family, so a heavy still reads bigger than a bizjet
  const fam = acFam(type), F = AC_FAM[fam], sh = acShape(type, F.ref[0], F.ref[1]);
  drawShape(sh, X, Y, hdg, 18*(AC_ICON_K[fam] || 1)/sh.size, col, { line: sel ? '#0c1b2e' : 'rgba(20,24,30,.55)', lw: sel ? 1.8 : 0.8 });
}
function farTag(X, Y, l1, l2, l3, col){
  const lx = X + 14, ly = Y - 18, n = l3 ? 3 : 2; cx.font = `500 11px ${FONT_D}`;
  const w = Math.max(cx.measureText(l1).width, cx.measureText(l2).width, l3 ? cx.measureText(l3).width : 0);
  cx.fillStyle = C.tagBg; cx.fillRect(lx - 3, ly - 11, w + 6, n*13 + 3); cx.strokeStyle = C.tagEdge; cx.lineWidth = 1; cx.strokeRect(lx - 3.5, ly - 11.5, w + 7, n*13 + 4);
  cx.fillStyle = col; cx.fillText(l1, lx, ly); cx.fillText(l2, lx, ly + 13); if (l3) cx.fillText(l3, lx, ly + 26);
}
const FL = a => String(Math.max(0, Math.round(a/100))).padStart(3, '0');
// the airway chart under the far traffic when zoomed out to the wider picture (the same chart as Area Control: awy.js)
function drawAirwayChart(){
  if (typeof AW === 'undefined' || !AW.ready || V.scale >= 4 || ground3()) return;
  const P = (la, lo) => { const q = llxy(la, lo); return [sx(q[0]), sy(q[1])]; };
  const mine = new Set(); for (const g of FAR.list) if (g.names) for (const n of g.names) mine.add(n);
  AW.drawChart({ cx, P, W, H, dark: C.name === 'dark', lvl: 'U', scale: V.scale, mine, label: V.scale > 0.5 });
}
const ground3 = () => V.scale > 70;
function drawFar(){
  drawAirwayChart();
  const tags = V.scale > 0.6;
  for (const g of FAR.list) {
    const st = farState(g); if (!st) continue;
    const X = sx(st.p[0]), Y = sy(st.p[1]); if (X < -60 || Y < -60 || X > W + 60 || Y > H + 60) continue;
    planeIcon(X, Y, st.hdg, S.trk === g ? '#ffe066' : '#f7c600', S.trk === g);
    if (tags) farTag(X, Y, g.cs, `${FL(st.alt)} ${String(Math.round(st.gs/10)).padStart(2, '0')}`, `${g.t} ${g.from}-${g.to}`, C.name === 'dark' ? '#f7d34a' : '#5b4a00');
  }
}
function drawFarAc(ac){   // a sim aircraft outside radar cover: plane icon plus its normal tag lines
  const X = sx(ac.x), Y = sy(ac.y); if (X < -60 || Y < -60 || X > W + 60 || Y > H + 60) return;
  const sel = S.sel === ac;
  planeIcon(X, Y, ac.hdg, sel ? '#ffe066' : '#f7c600', sel);
  if (V.scale > 0.6 || sel) farTag(X, Y, ac.cs + (ac.need ? ' ◆' : ''), `${FL(ac.alt)} ${String(Math.round(ac.gs/10)).padStart(2, '0')}`, ac.state === 'PRE' ? `${ac.t} ${ac.o} PENDING` : `${ac.t} ${ac.kind === 'ARR' ? ac.o : ac.d}`, C.name === 'dark' ? '#f7d34a' : '#5b4a00');
}

// ═════════════════════════ flight information board (today's arrivals and departures) ═════════════════════════
FAR.done = {};
S.listeners.push((ev, d) => {
  if (!d || !d.cs) return;
  if (ev === 'landed') FAR.done[d.cs] = 'Landed';
  if (ev === 'onstand') FAR.done[d.cs] = 'On stand';
  if (ev === 'takeoff' || ev === 'airborne') FAR.done[d.cs] = 'Departed';
  if (ev === 'start') FAR.done = {};
});
const zHM = ms => new Date(ms).toISOString().substr(11, 5);
const hhmm = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(m/60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const nowMin = () => (S.hour || 0)*60 + S.t/60;
function fidsRows(kind){
  const day = String((S.day || 0) + 1), rows = [];
  const LT = /^live/.test(S.mode) && LIVE.session && LIVE.session.T;
  if (LT) {   // Real world: the airport's own list, with its status where the session hasn't got the flight yet
    for (const r of kind === 'ARR' ? LT.arr : LT.dep) rows.push({ cs: r.cs, t: r.t, ap: r.ap, apName: r.place, tm: r.tm, stand: '', real: r.cancelled ? 'Cancelled' : r.real });
    for (const f of S.sched) if (f.k === kind && !rows.some(r => r.cs === f.cs)) rows.push({ cs: f.cs, t: f.t, ap: kind === 'ARR' ? f.o : f.d, tm: Math.round((S.hour || 0)*60 + f.m + (kind === 'ARR' ? 15 : 6)), stand: f.stand || '', extra: true });
    return rows.sort((a, b) => a.tm - b.tm);
  }
  if (S.mode === 'custom') {   // custom traffic: the made-up flights only, parked departures included
    for (const f of S.sched) if (f.k === kind || (kind === 'DEP' && f.k === 'RES' && f.depM != null))
      rows.push({ cs: f.cs, t: f.t, ap: kind === 'ARR' ? f.o : f.d, tm: Math.round((S.hour || 0)*60 + (f.k === 'RES' ? f.depM : f.m + (kind === 'ARR' ? 15 : 6))), stand: f.stand || '' });
    return rows.sort((a, b) => a.tm - b.tm);
  }
  for (const [ac, o, ta, dc, dd, td, t, days, stand] of TIMETABLE) {
    if (!days.includes(day)) continue;
    if (kind === 'ARR' && ac) rows.push({ cs: ac, t, ap: o, tm: hm(ta), stand: dc ? stand : '' });
    if (kind === 'DEP' && dc) rows.push({ cs: dc, t, ap: dd, tm: hm(td), stand: stand || '' });
  }
  for (const f of S.sched) if (f.k === kind && !rows.some(r => r.cs === f.cs)) rows.push({ cs: f.cs, t: f.t, ap: kind === 'ARR' ? f.o : f.d, tm: Math.round((S.hour || 0)*60 + f.m + (kind === 'ARR' ? 15 : 6)), stand: f.stand || '', extra: true });
  return rows.sort((a, b) => a.tm - b.tm);
}
function fidsStatus(r, kind){
  const ac = S.acs.find(a => a.cs === r.cs), g = FAR.list.find(x => x.cs === r.cs);
  const late = nowMin() > r.tm + 5;
  if (r.real && !ac && !FAR.done[r.cs] && !(g && S.t >= g.tStart && S.t <= g.tEnd)) return [r.real, /cancel/i.test(r.real) ? 'bad' : /landed|departed|arrived/i.test(r.real) ? 'ok' : /estimated|delayed/i.test(r.real) ? 'live' : ''];
  if (kind === 'ARR') {
    if (ac) return ac.ground ? (['ONSTAND', 'PARKED', 'TOW'].includes(ac.state) ? ['On stand', 'ok'] : ['Landed', 'ok']) : ac.state === 'PRE' ? ['Approaching', 'live'] : ac.state === 'DIVERTING' ? ['Diverting', 'bad'] : ['On approach', 'live'];
    if (FAR.done[r.cs]) return [FAR.done[r.cs], /^Diverted/.test(FAR.done[r.cs]) ? 'bad' : 'ok'];
    if (g && g.kind === 'ARR' && S.t >= g.tStart && S.t <= g.tEnd) { const eta = zHM(S.start + (g.tEnd + PRE_LEAD + 15*60)*1000); return [`En route · exp ${eta}`, 'live']; }
    if (S.running && r.tm < (S.hour || 0)*60) return ['Landed', 'ok'];
    return late && S.running ? ['Delayed', 'bad'] : ['Scheduled', ''];
  }
  if (ac) {
    if (ac.airborne) return ['Departed', 'ok'];
    return ({ PARKED: ac.need ? ['Boarding', 'live'] : ['At stand', ''], PUSH: ['Pushing back', 'live'], PULL: ['Returning to stand', 'live'], READY: ['Taxiing', 'live'], TAXI: ['Taxiing', 'live'], TOW: ['Under tow', ''],
              HOLDPT: ['Ready', 'live'], LINEUP: ['Lining up', 'live'], LINEDUP: ['Lined up', 'live'], TAKEOFF: ['Taking off', 'live'] })[ac.state] || ['At stand', ''];
  }
  if (g && S.t <= g.tEnd) return [S.t >= g.tStart ? `Departed · arr ${zHM(S.start + g.tEnd*1000)}` : 'Departed', 'ok'];
  if (FAR.done[r.cs]) return [FAR.done[r.cs], 'ok'];
  if (S.running && r.tm < (S.hour || 0)*60) return ['Departed', 'ok'];
  const arr = S.mode !== 'custom' && TIMETABLE.find(x => x[3] === r.cs); if (arr && arr[0] && !S.acs.some(a => a.cs === arr[0]) && !FAR.done[arr[0]] && hm(arr[2]) > nowMin() - 5 && S.running && r.tm > nowMin()) return ['Aircraft inbound', ''];
  return late && S.running ? ['Delayed', 'bad'] : ['Scheduled', ''];
}
let fidsTab = 'ARR';
// the stand: the timetable's, else the one the flight has been given in the session
function fidsStand(r){
  if (SLOT[r.cs] && SLOT[r.cs].stand) return SLOT[r.cs].stand;   // changed on the board
  if (r.stand) return r.stand;
  const ac = S.acs.find(a => a.cs === r.cs); return ac && ac.stand ? ac.stand.id : '';
}
function fidsBodyHTML(kind){
  const rows = fidsRows(kind), nm = nowMin();
  return rows.length ? rows.map(r => {
    // slot control: a retimed flight shows its new time and is judged late or not by it; held and cancelled flights say so
    const e = SLOT[r.cs], ctl = slotCtl(r.cs, kind), rr = e ? { ...r, tm: e.tm } : r;
    const [st, cls] = slotStatus(r.cs, kind) || fidsStatus(rr, kind), past = r.tm < nm - 30 && /Landed|Departed|On stand/.test(st);
    const nt = [e && Math.round(e.tm) !== r.tm ? `<b>${hhmm(e.tm)}</b>` : '', e && e.ctot != null ? `<i>CTOT ${hhmm(e.ctot)}</i>` : ''].filter(Boolean).join(' ');
    return `<tr class="${past ? 'past' : ''}${ctl.ok ? ' can' : ''}${SLOT.sel === r.cs ? ' pick' : ''}" data-cs="${r.cs}" data-k="${kind}" data-tm="${r.tm}"><td class="tm">${hhmm(r.tm)}</td><td class="nt">${nt}</td><td class="fl">${r.cs}</td><td>${AP[r.ap] ? AP[r.ap][2] : r.apName || r.ap}<span class="ic">${AP[r.ap] ? r.ap : ''}</span></td><td class="ty">${r.t}</td><td class="sd">${fidsStand(r)}</td><td class="st ${cls}">${st}</td></tr>`;
  }).join('') : `<tr><td colspan="7" class="none">No ${kind === 'ARR' ? 'arrivals' : 'departures'} scheduled today.</td></tr>`;
}
const fidsClockText = () => S.running ? `${DAYS[S.day || 0]} · ${zHM(S.start + S.t*1000)}Z` : 'Open a session to see live status';
let fidsWin = null;
function renderFids(){
  if (fidsWin && !fidsWin.closed) {   // the pop-out board: arrivals and departures side by side
    const d = fidsWin.document;
    for (const k of ['ARR', 'DEP']) { const b = d.getElementById('fb' + k); if (b) b.innerHTML = fidsBodyHTML(k); }
    const c = d.getElementById('fbClock'); if (c) c.textContent = fidsClockText();
    slotTick(d);
  }
  const el = document.getElementById('fidsBody'); if (!el || document.getElementById('fids').hidden) return;
  document.getElementById('fidsClock').textContent = fidsClockText();
  el.innerHTML = fidsBodyHTML(fidsTab); slotTick(document);
  document.getElementById('fidsAp').textContent = fidsTab === 'ARR' ? 'From' : 'To';
  document.querySelectorAll('[data-fids]').forEach(b => b.classList.toggle('on', b.dataset.fids === fidsTab));
}
function openFidsBoard(){
  if (fidsWin && !fidsWin.closed) { fidsWin.focus(); return; }
  fidsWin = popWin('cwFlights', `${APT.icao} flights`, 1200, 700); if (!fidsWin) return;
  const tbl = k => `<section><h2>${k === 'ARR' ? 'Arrivals' : 'Departures'}</h2><div class="fids-wrap"><table><thead><tr><th>Sched</th><th>New</th><th>Flight</th><th>${k === 'ARR' ? 'From' : 'To'}</th><th>Type</th><th>Stand</th><th>Status</th></tr></thead><tbody id="fb${k}"></tbody></table></div></section>`;
  fidsWin.document.body.innerHTML = `<div class="fids fboard"><div class="fids-hd"><div><b>${esc(APT.name)} · flight information</b><span id="fbClock"></span></div><span class="fids-tip">Click a flight to change its time, hold it or cancel it</span></div><div class="slotbar" id="fbSlot" hidden></div><div class="fb-cols">${tbl('ARR')}${tbl('DEP')}</div></div>`;
  slotWire(fidsWin.document);
  document.getElementById('fids').hidden = true;
  renderFids();
}
{
  const bt = document.getElementById('tgFids'), box = document.getElementById('fids');
  if (bt && box) {
    bt.onclick = () => { if (fidsWin && !fidsWin.closed) { fidsWin.focus(); return; } box.hidden = !box.hidden; renderFids(); };
    document.getElementById('fidsClose').onclick = () => { box.hidden = true; };
    document.getElementById('fidsPop').onclick = openFidsBoard;
    document.querySelectorAll('[data-fids]').forEach(b => b.onclick = () => { fidsTab = b.dataset.fids; renderFids(); });
    S.listeners.push(ev => { if (ev === 'tick' || ev === 'start') renderFids(); });
  }
}
