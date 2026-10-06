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
const nearGib = ll => gcDist(ll, AP[APT.icao]) < 70;
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
  const e = ENTRY[f.gate], L0 = Math.hypot(e[0] - RADAR_REF[0], e[1] - RADAR_REF[1]), u = [(e[0] - RADAR_REF[0])/L0, (e[1] - RADAR_REF[1])/L0];
  const endLL = toLL([e[0] + u[0]*PRE_NM, e[1] + u[1]*PRE_NM]);
  const via = (VIA[f.o] || []).filter(p => !nearGib(p) && gcDist(p, endLL) > 40).slice().reverse();
  const leg = makeLeg([AP[f.o].slice(0, 2), ...via, endLL]), [spd, fl] = CRUISE[f.t] || [450, 37000];
  const cruise = Math.min(fl, 9000 + leg.D*75), tStart = tEnd - leg.D/spd*3600;
  FAR.list.push({ cs: f.cs, t: f.t, from: f.o, to: APT.icao, kind: 'ARR', leg, tStart, tEnd, spd, cruise, endAlt: PRE_ALT[f.gate], f });
}
// outbound: from wherever it left the radar area on to the destination
function addDepGhost(ac, at){
  if (!AP[ac.d]) return;
  const p0 = at || toLL([ac.x, ac.y]);
  const via = (VIA[ac.d] || []).filter(p => !nearGib(p) && gcDist(p, p0) > 30 && gcDist(p, AP[ac.d]) < gcDist(p0, AP[ac.d]));
  const leg = makeLeg([p0, ...via, AP[ac.d].slice(0, 2)]), [spd, fl] = CRUISE[ac.t] || [450, 37000];
  const t0 = S.t + (at ? ac.dt0 || 0 : 0);
  FAR.list.push({ cs: ac.cs, t: ac.t, from: ac.from || APT.icao, to: ac.d, kind: ac.from ? 'DIV' : 'DEP', leg, tStart: t0, tEnd: t0 + leg.D/spd*3600, spd, cruise: Math.min(fl, 9000 + leg.D*75), startAlt: at ? APT.initClimb : ac.alt, endAlt: 0 });
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
    const c = xy(...ll), a = (S.t*3) % 360, r = 0.7*(g.spd/250);
    return { p: [c[0] + Math.sin(a*D2R)*r, c[1] + Math.cos(a*D2R)*r], hdg: norm(a + 90), alt, gs: Math.round(g.spd*0.8), holding: true };
  }
  return { p: xy(...ll), hdg, alt, gs: g.v || g.spd };
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
// plane icons shaped by aircraft type, nose along the heading. Coordinates are in units of the icon's half-size
// (about 9 px), nose at -1 and tail at +1, so every type sits in the same footprint as the yellow en-route icons.
const ICON_CAT = t => /^(A20N|A319|A320|A321|A21N|B73|B738|B38M|B39M|E19|A220|BCS)/.test(t || '') ? 'jet' : /^(A33|A35|B77|B78|A34|B76|B74|A38)/.test(t || '') ? 'wide'
  : /^(AT[47]|DH8|PC12|C208|BE20|SF34|F50)/.test(t || '') ? 'prop' : /^A400|^C130|^C30J/.test(t || '') ? 'mil' : /^(C56X|C68A|GLF|GL[57]|CL|LJ|E55|FA|C25|PC24|H25)/.test(t || '') ? 'biz' : 'jet';
const ICON_SHAPE = {
  jet:  { k: 1.0, body: 0.13, wing: [[0.12, -0.12], [0.98, 0.26], [0.98, 0.36], [0.12, 0.16]], tail: [[0.09, 0.72], [0.40, 0.92], [0.40, 0.99], [0.07, 0.92]], eng: [[0.42, 0.06, 0.07, 0.15]] },
  wide: { k: 1.15, body: 0.15, wing: [[0.14, -0.16], [1.0, 0.30], [1.0, 0.40], [0.14, 0.14]], tail: [[0.10, 0.70], [0.42, 0.92], [0.42, 0.99], [0.08, 0.92]], eng: [[0.40, 0.04, 0.09, 0.17]] },
  biz:  { k: 0.85, body: 0.11, wing: [[0.10, -0.02], [0.95, 0.30], [0.95, 0.38], [0.10, 0.22]], tail: [[0.06, 0.86], [0.38, 0.95], [0.38, 1.0], [0.05, 0.98]], eng: [[0.19, 0.55, 0.07, 0.15]] },
  prop: { k: 1.0, body: 0.11, wing: [[0.10, -0.24], [1.0, -0.20], [1.0, -0.06], [0.10, -0.06]], tail: [[0.07, 0.80], [0.34, 0.84], [0.34, 0.94], [0.06, 0.94]], eng: [[0.33, -0.28, 0.06, 0.16]], prop: true },
  mil:  { k: 1.1, body: 0.15, wing: [[0.12, -0.24], [1.0, -0.16], [1.0, -0.02], [0.12, -0.04]], tail: [[0.10, 0.78], [0.40, 0.86], [0.40, 0.96], [0.08, 0.96]], eng: [[0.30, -0.28, 0.06, 0.15], [0.62, -0.24, 0.06, 0.14]], prop: true }
};
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
  const S0 = ICON_SHAPE[ICON_CAT(type)], u = 9*S0.k, b = S0.body;
  cx.save(); cx.translate(X, Y); cx.rotate(hdg*D2R); cx.scale(u, u);
  cx.beginPath();
  // fuselage: rounded nose, straight sides, tapered tail cone
  cx.moveTo(0, -1); cx.quadraticCurveTo(b, -0.98, b, -0.72); cx.lineTo(b, 0.62); cx.quadraticCurveTo(b*0.8, 0.92, 0, 1.0); cx.quadraticCurveTo(-b*0.8, 0.92, -b, 0.62); cx.lineTo(-b, -0.72); cx.quadraticCurveTo(-b, -0.98, 0, -1); cx.closePath();
  for (const part of [S0.wing, S0.tail]) for (const s of [1, -1]) { cx.moveTo(s*part[0][0], part[0][1]); for (const [x, y] of part.slice(1)) cx.lineTo(s*x, y); cx.closePath(); }
  for (const [ex, ey, ew, el] of S0.eng) for (const s of [1, -1]) { cx.moveTo(s*ex + ew, ey); cx.ellipse(s*ex, ey, ew, el, 0, 0, Math.PI*2); }
  cx.fillStyle = col; cx.fill('nonzero');
  cx.lineWidth = (sel ? 1.8 : 0.8)/u; cx.strokeStyle = sel ? '#0c1b2e' : 'rgba(20,24,30,.55)'; cx.lineJoin = 'round'; cx.stroke();
  if (S0.prop) { cx.strokeStyle = 'rgba(20,24,30,.8)'; cx.lineWidth = 1.2/u; cx.beginPath(); for (const [ex, ey, , el] of S0.eng) for (const s of [1, -1]) { cx.moveTo(s*ex - 0.13, ey - el - 0.02); cx.lineTo(s*ex + 0.13, ey - el - 0.02); } cx.stroke(); }
  cx.restore();
}
function farTag(X, Y, l1, l2, l3, col){
  const lx = X + 14, ly = Y - 18, n = l3 ? 3 : 2; cx.font = `500 11px ${FONT_D}`;
  const w = Math.max(cx.measureText(l1).width, cx.measureText(l2).width, l3 ? cx.measureText(l3).width : 0);
  cx.fillStyle = C.tagBg; cx.fillRect(lx - 3, ly - 11, w + 6, n*13 + 3); cx.strokeStyle = C.tagEdge; cx.lineWidth = 1; cx.strokeRect(lx - 3.5, ly - 11.5, w + 7, n*13 + 4);
  cx.fillStyle = col; cx.fillText(l1, lx, ly); cx.fillText(l2, lx, ly + 13); if (l3) cx.fillText(l3, lx, ly + 26);
}
const FL = a => String(Math.max(0, Math.round(a/100))).padStart(3, '0');
function drawFar(){
  const tags = V.scale > 0.6;
  for (const g of FAR.list) {
    const st = farState(g); if (!st) continue;
    const X = sx(st.p[0]), Y = sy(st.p[1]); if (X < -60 || Y < -60 || X > W + 60 || Y > H + 60) continue;
    planeIcon(X, Y, st.hdg, '#f7c600');
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
    if (ac) return ac.ground ? (['ONSTAND', 'PARKED'].includes(ac.state) ? ['On stand', 'ok'] : ['Landed', 'ok']) : ac.state === 'PRE' ? ['Approaching', 'live'] : ac.state === 'DIVERTING' ? ['Diverting', 'bad'] : ['On approach', 'live'];
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
