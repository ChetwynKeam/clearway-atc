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
// turning points outbound from Gibraltar (inbounds fly them in reverse)
const VIA_N = [[37.25, -4.55], [40.00, -3.80], [43.30, -2.30], [46.20, -1.30]];          // up through Spain and western France
const VIA_W = [[36.40, -6.70], [37.40, -9.10], [40.50, -9.80], [43.90, -9.40], [48.00, -6.50]]; // west of Portugal, Biscay, Cornwall
const VIA = {
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
const nearGib = ll => gcDist(ll, AP.LXGB) < 70;
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
  const e = ENTRY[f.gate], L0 = Math.hypot(e[0] - GBR[0], e[1] - GBR[1]), u = [(e[0] - GBR[0])/L0, (e[1] - GBR[1])/L0];
  const endLL = toLL([e[0] + u[0]*PRE_NM, e[1] + u[1]*PRE_NM]);
  const via = (VIA[f.o] || []).filter(p => !nearGib(p) && gcDist(p, endLL) > 40).slice().reverse();
  const leg = makeLeg([AP[f.o].slice(0, 2), ...via, endLL]), [spd, fl] = CRUISE[f.t] || [450, 37000];
  const cruise = Math.min(fl, 9000 + leg.D*75), tStart = tEnd - leg.D/spd*3600;
  FAR.list.push({ cs: f.cs, t: f.t, from: f.o, to: 'LXGB', kind: 'ARR', leg, tStart, tEnd, spd, cruise, endAlt: PRE_ALT[f.gate], f });
}
// outbound: from wherever it left the radar area on to the destination
function addDepGhost(ac, at){
  if (!AP[ac.d]) return;
  const p0 = at || toLL([ac.x, ac.y]);
  const via = (VIA[ac.d] || []).filter(p => !nearGib(p) && gcDist(p, p0) > 30 && gcDist(p, AP[ac.d]) < gcDist(p0, AP[ac.d]));
  const leg = makeLeg([p0, ...via, AP[ac.d].slice(0, 2)]), [spd, fl] = CRUISE[ac.t] || [450, 37000];
  const t0 = S.t + (at ? ac.dt0 || 0 : 0);
  FAR.list.push({ cs: ac.cs, t: ac.t, from: 'LXGB', to: ac.d, kind: 'DEP', leg, tStart: t0, tEnd: t0 + leg.D/spd*3600, spd, cruise: Math.min(fl, 9000 + leg.D*75), startAlt: at ? 6000 : ac.alt, endAlt: 0 });
}
// at the start of a session: inbounds already airborne or due later, and today's earlier departures still en route
function buildFar(){
  FAR.list = [];
  if (EXERCISES[S.mode]) return;
  for (const f of S.sched) if (f.k === 'ARR') addArrGhost(f);
  const day = String((S.day || 0) + 1), t0 = (S.hour || 0)*60;
  if (/^live/.test(S.mode)) { const T = LIVE.session && LIVE.session.T; if (T) for (const d of T.dep) {   // today's real departures still en route
    const off = (d.tm + 8 - t0)*60; if (!d.cancelled && off >= -5*3600 && off < -600) addDepGhost({ cs: d.cs, t: d.t, d: d.ap, dt0: off - S.t }, toLL(rm(THR27_M - 1500, 0))); } return; }
  for (const [, , , dc, dd, td, t, days] of TIMETABLE) {
    if (!dc || !days.includes(day)) continue;
    const off = (hm(td) + 8 - t0)*60;                 // airborne about eight minutes after off-blocks
    if (off >= -5*3600 && off < -600) addDepGhost({ cs: dc, t, d: dd, dt0: off - S.t }, toLL(rm(THR27_M - 1500, 0)));
  }
}
function farState(g){
  if (S.t < g.tStart || S.t > g.tEnd) return null;
  const d = (S.t - g.tStart)/3600*g.spd, { ll, hdg } = legAt(g.leg, d), left = g.leg.D - d;
  const up = g.kind === 'DEP' ? (g.startAlt || 0) + d*330 : 1500 + d*330, down = g.endAlt + left*300;
  return { p: xy(...ll), hdg, alt: Math.max(0, Math.min(g.cruise, up, down)), gs: g.spd };
}
S.listeners.push((ev, d) => {
  if (ev === 'start') buildFar();
  if (ev === 'exit' && d && d.kind === 'DEP') addDepGhost(d);
});
// sim aircraft beyond radar cover are drawn the same way
const RADAR_NM = 60;
const outsideRadar = ac => ac.state === 'PRE' || Math.hypot(ac.x - GBR[0], ac.y - GBR[1]) > RADAR_NM;

// ── drawing ──
function planeIcon(X, Y, hdg, col, sel){
  cx.save(); cx.translate(X, Y); cx.rotate(hdg*D2R); const k = 0.9;
  cx.beginPath();
  cx.moveTo(0, -9*k); cx.quadraticCurveTo(1.6*k, -8*k, 1.6*k, -5*k); cx.lineTo(1.6*k, -2*k); cx.lineTo(9*k, 2*k); cx.lineTo(9*k, 3.6*k); cx.lineTo(1.6*k, 1.6*k);
  cx.lineTo(1.4*k, 6*k); cx.lineTo(4*k, 8*k); cx.lineTo(4*k, 9.2*k); cx.lineTo(0, 8.2*k); cx.lineTo(-4*k, 9.2*k); cx.lineTo(-4*k, 8*k); cx.lineTo(-1.4*k, 6*k);
  cx.lineTo(-1.6*k, 1.6*k); cx.lineTo(-9*k, 3.6*k); cx.lineTo(-9*k, 2*k); cx.lineTo(-1.6*k, -2*k); cx.lineTo(-1.6*k, -5*k); cx.quadraticCurveTo(-1.6*k, -8*k, 0, -9*k); cx.closePath();
  cx.fillStyle = col; cx.strokeStyle = sel ? '#0c1b2e' : 'rgba(40,30,0,.85)'; cx.lineWidth = sel ? 1.8 : 1; cx.fill(); cx.stroke();
  cx.restore();
}
function farTag(X, Y, l1, l2, l3, col){
  const lx = X + 14, ly = Y - 18; cx.font = `500 11px ${FONT_D}`;
  const w = Math.max(cx.measureText(l1).width, cx.measureText(l2).width, cx.measureText(l3).width);
  cx.fillStyle = C.tagBg; cx.fillRect(lx - 3, ly - 11, w + 6, 3*13 + 3); cx.strokeStyle = C.tagEdge; cx.lineWidth = 1; cx.strokeRect(lx - 3.5, ly - 11.5, w + 7, 3*13 + 4);
  cx.fillStyle = col; cx.fillText(l1, lx, ly); cx.fillText(l2, lx, ly + 13); cx.fillText(l3, lx, ly + 26);
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
  planeIcon(X, Y, ac.trk || ac.hdg, sel ? '#ffe066' : '#f7c600', sel);
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
const nowMin = () => (S.hour || 0)*60 + S.t/60;
function fidsRows(kind){
  const day = String((S.day || 0) + 1), rows = [];
  const LT = /^live/.test(S.mode) && LIVE.session && LIVE.session.T;
  if (LT) {   // Real world: the airport's own list, with its status where the session hasn't got the flight yet
    for (const r of kind === 'ARR' ? LT.arr : LT.dep) rows.push({ cs: r.cs, t: r.t, ap: r.ap, apName: r.place, tm: r.tm, stand: '', real: r.cancelled ? 'Cancelled' : r.real });
    for (const f of S.sched) if (f.k === kind && !rows.some(r => r.cs === f.cs)) rows.push({ cs: f.cs, t: f.t, ap: kind === 'ARR' ? f.o : f.d, tm: Math.round((S.hour || 0)*60 + f.m + (kind === 'ARR' ? 15 : 6)), stand: f.stand || '', extra: true });
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
    if (FAR.done[r.cs]) return [FAR.done[r.cs], 'ok'];
    if (g && S.t >= g.tStart && S.t <= g.tEnd) { const eta = zHM(S.start + (g.tEnd + PRE_LEAD + 15*60)*1000); return [`En route · exp ${eta}`, 'live']; }
    if (S.running && r.tm < (S.hour || 0)*60) return ['Landed', 'ok'];
    return late && S.running ? ['Delayed', 'bad'] : ['Scheduled', ''];
  }
  if (ac) {
    if (ac.airborne) return ['Departed', 'ok'];
    return ({ PARKED: ac.need ? ['Boarding', 'live'] : ['At stand', ''], PUSH: ['Pushing back', 'live'], READY: ['Taxiing', 'live'], TAXI: ['Taxiing', 'live'], TOW: ['Under tow', ''],
              HOLDPT: ['Ready', 'live'], LINEUP: ['Lining up', 'live'], LINEDUP: ['Lined up', 'live'], TAKEOFF: ['Taking off', 'live'] })[ac.state] || ['At stand', ''];
  }
  if (g && S.t <= g.tEnd) return [S.t >= g.tStart ? `Departed · arr ${zHM(S.start + g.tEnd*1000)}` : 'Departed', 'ok'];
  if (FAR.done[r.cs]) return [FAR.done[r.cs], 'ok'];
  if (S.running && r.tm < (S.hour || 0)*60) return ['Departed', 'ok'];
  const arr = TIMETABLE.find(x => x[3] === r.cs); if (arr && arr[0] && !S.acs.some(a => a.cs === arr[0]) && !FAR.done[arr[0]] && hm(arr[2]) > nowMin() - 5 && S.running && r.tm > nowMin()) return ['Aircraft inbound', ''];
  return late && S.running ? ['Delayed', 'bad'] : ['Scheduled', ''];
}
let fidsTab = 'ARR';
function renderFids(){
  const el = document.getElementById('fidsBody'); if (!el || document.getElementById('fids').hidden) return;
  const rows = fidsRows(fidsTab), nm = nowMin();
  document.getElementById('fidsClock').textContent = S.running ? `${DAYS[S.day || 0]} · ${zHM(S.start + S.t*1000)}Z` : 'Open a session to see live status';
  el.innerHTML = rows.length ? rows.map(r => {
    const [st, cls] = fidsStatus(r, fidsTab), past = r.tm < nm - 30 && /Landed|Departed|On stand/.test(st);
    return `<tr class="${past ? 'past' : ''}"><td class="tm">${String(Math.floor(r.tm/60) % 24).padStart(2, '0')}:${String(r.tm % 60).padStart(2, '0')}</td><td class="fl">${r.cs}</td><td>${AP[r.ap] ? AP[r.ap][2] : r.apName || r.ap}<span class="ic">${AP[r.ap] ? r.ap : ''}</span></td><td class="ty">${r.t}</td><td class="sd">${r.stand || ''}</td><td class="st ${cls}">${st}</td></tr>`;
  }).join('') : `<tr><td colspan="6" class="none">No ${fidsTab === 'ARR' ? 'arrivals' : 'departures'} scheduled today.</td></tr>`;
  document.getElementById('fidsAp').textContent = fidsTab === 'ARR' ? 'From' : 'To';
  document.querySelectorAll('[data-fids]').forEach(b => b.classList.toggle('on', b.dataset.fids === fidsTab));
}
{
  const bt = document.getElementById('tgFids'), box = document.getElementById('fids');
  if (bt && box) {
    bt.onclick = () => { box.hidden = !box.hidden; renderFids(); };
    document.getElementById('fidsClose').onclick = () => { box.hidden = true; };
    document.querySelectorAll('[data-fids]').forEach(b => b.onclick = () => { fidsTab = b.dataset.fids; renderFids(); });
    S.listeners.push(ev => { if (ev === 'tick' || ev === 'start') renderFids(); });
  }
}
