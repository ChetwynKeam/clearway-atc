// ═════════════════════════ Clearway Area Control · traffic ═════════════════════════
// Planned traffic: the weekly airline timetables of the UK airports in the game (Heathrow, Gatwick, Manchester, Bristol,
// London City), each flight flown from its origin to its destination along its SID, airways and STAR, plus the other
// flows over the UK (Stansted, Luton, Birmingham, Edinburgh, Dublin, the North Atlantic, Europe to Europe). Live
// traffic: the aircraft in the air right now (ADS-B through the site's relay). Real flights in your airspace when you
// open the position are yours where they are; the rest are offered to you as they come your way.

const UK_PROFILES = [typeof EGLL !== 'undefined' && EGLL, typeof EGKK !== 'undefined' && EGKK, typeof EGCC !== 'undefined' && EGCC, typeof EGGD !== 'undefined' && EGGD, typeof EGLC !== 'undefined' && EGLC].filter(Boolean);
const AIRLINE_ICAO = { BA: 'BAW', U2: 'EZY', FR: 'RYR', W6: 'WZZ', LS: 'EXS', BY: 'TOM', VS: 'VIR', EI: 'EIN', LH: 'DLH', AF: 'AFR', KL: 'KLM', IB: 'IBE', VY: 'VLG', AA: 'AAL', UA: 'UAL', DL: 'DAL', EK: 'UAE', QR: 'QTR' };
for (const P of UK_PROFILES) {
  Object.assign(TEL, P.TEL || {}); Object.assign(AIRLINE_ICAO, P.AIRLINE_ICAO || {});
  for (const [k, v] of Object.entries(P.AIRPORTS || {})) if (!APS[k] && v && v.length >= 2) APS[k] = [v[0], v[1], v[2] || k];
}
// other flows over the UK that the five timetables don't carry: [from, to, airlines, types, flights an hour at the busiest]
const FLOWS = [
  ['EGSS', 'LEMG', ['RYR'], ['B738', 'B38M'], 1.2], ['EGSS', 'LEPA', ['RYR'], ['B738'], .8], ['EGSS', 'LPFR', ['RYR', 'JET'], ['B738'], .6], ['EGSS', 'LEAL', ['RYR'], ['B738'], .8],
  ['LEMG', 'EGSS', ['RYR'], ['B738'], 1.1], ['LEPA', 'EGGW', ['EZY', 'WUK'], ['A20N', 'A21N'], .8], ['EGGW', 'LEMG', ['EZY'], ['A320'], .7], ['EGGW', 'LPFR', ['EZY'], ['A20N'], .5],
  ['EGSS', 'EIDW', ['RYR'], ['B738'], .9], ['EIDW', 'EGSS', ['RYR'], ['B738'], .9], ['EGBB', 'LEPA', ['TOM', 'RYR'], ['B38M', 'B738'], .6], ['EGBB', 'LEMG', ['RYR', 'EXS'], ['B738'], .6],
  ['EGNX', 'LEAL', ['RYR'], ['B738'], .5], ['EGPH', 'LEMG', ['EZY', 'RYR'], ['A320', 'B738'], .4], ['EGPF', 'LEPA', ['EZY', 'TOM'], ['A320', 'B738'], .3], ['EGPH', 'EGSS', ['RYR'], ['B738'], .4],
  ['EGPH', 'EGGW', ['EZY'], ['A320'], .5], ['EGGW', 'EGPH', ['EZY'], ['A320'], .5], ['EGPH', 'EHAM', ['KLM', 'EZY'], ['E190', 'A320'], .4], ['EGPD', 'EHAM', ['KLM'], ['E190'], .2],
  ['EIDW', 'LFPG', ['EIN', 'AFR'], ['A20N', 'A320'], .7], ['EIDW', 'EDDF', ['EIN', 'DLH'], ['A320'], .5], ['EIDW', 'EHAM', ['EIN', 'KLM'], ['A320', 'B738'], .6], ['EIDW', 'LEMD', ['EIN', 'IBE'], ['A320'], .4],
  ['LFPG', 'EIDW', ['AFR', 'EIN'], ['A320'], .6], ['EHAM', 'EIDW', ['KLM', 'EIN'], ['B738'], .6], ['EDDF', 'EIDW', ['DLH'], ['A320'], .4], ['EIDW', 'LEMG', ['RYR'], ['B738'], .5],
  ['KJFK', 'EHAM', ['KLM', 'DAL'], ['B772', 'A333'], .5], ['KJFK', 'EDDF', ['DLH'], ['B748'], .4], ['KBOS', 'EDDF', ['DLH'], ['A359'], .25], ['KORD', 'EDDF', ['UAL', 'DLH'], ['B789'], .3],
  ['CYYZ', 'EDDF', ['ACA'], ['B77W'], .2], ['KIAD', 'EHAM', ['UAL'], ['B763'], .2], ['KEWR', 'EHAM', ['UAL'], ['B763'], .2], ['KATL', 'EHAM', ['DAL'], ['A333'], .2],
  ['EDDF', 'KJFK', ['DLH'], ['B748'], .4], ['EHAM', 'KJFK', ['KLM', 'DAL'], ['B772', 'A333'], .4], ['EDDM', 'KORD', ['DLH'], ['A359'], .2], ['EKCH', 'KEWR', ['SAS'], ['A333'], .15],
  ['ENGM', 'KEWR', ['SAS'], ['A333'], .15], ['EDDF', 'CYYZ', ['DLH'], ['B744'], .15], ['LSZH', 'KJFK', ['SWR'], ['B77W'], .2], ['EHAM', 'KATL', ['DAL'], ['A359'], .15],
  ['EHAM', 'LPPT', ['KLM', 'TAP'], ['B738', 'A20N'], .3], ['LPPT', 'EHAM', ['TAP', 'KLM'], ['A20N'], .3], ['EKCH', 'LEMG', ['NAX'], ['B38M'], .15], ['ENGM', 'LEAL', ['NAX'], ['B738'], .15],
  ['EGNT', 'LEPA', ['TOM', 'EZY'], ['B738'], .25], ['EGNM', 'LEAL', ['RYR', 'EXS'], ['B738'], .3], ['EGGP', 'LEMG', ['EZY', 'RYR'], ['A320'], .3], ['EGFF', 'LEPA', ['TOM'], ['B738'], .15],
  ['EGAA', 'EGSS', ['EZY', 'RYR'], ['A320'], .3], ['EGAA', 'EGGW', ['EZY'], ['A320'], .3], ['EGAC', 'EGLL', ['BAW'], ['A320'], .2], ['EGPF', 'EGSS', ['EZY'], ['A320'], .3],
  ['EGSS', 'EPWA', ['RYR', 'LOT'], ['B738'], .3], ['EGGW', 'EPKK', ['WZZ'], ['A21N'], .3], ['EGSS', 'LIRF', ['RYR'], ['B738'], .3], ['EGGW', 'LFMN', ['EZY'], ['A320'], .3],
  ['EGBB', 'EHAM', ['KLM'], ['E190'], .3], ['EGBB', 'EDDF', ['DLH'], ['A320'], .2], ['EGNX', 'EDDK', ['UPS', 'DHK'], ['B763', 'B752'], .2], ['EGNX', 'EBLG', ['DHK'], ['B752'], .15]
];
Object.assign(APS, { EGNT: [55.0375, -1.6917, 'Newcastle'], EPKK: [50.0777, 19.7848, 'Kraków'], EDDK: [50.8659, 7.1427, 'Cologne'], EBLG: [50.6374, 5.4432, 'Liège'] });
const typeFam = t => famOf(t);
// a flight's cruising level for its length and direction (odd eastbound, even westbound)
function rflFor(fam, dist, course){
  const P = PERF[fam]; let lv = dist < 120 ? (fam === 'prop' ? 15000 : 21000) : dist < 220 ? (fam === 'prop' ? 19000 : 27000) : dist < 400 ? Math.min(P.rfl[1], 35000) : rnd(P.rfl[0], P.rfl[1]);
  lv = Math.min(P.ceil, lv); return levelFor(course, lv);
}

// ── planned flights: where each one is at any moment ──
const PLAN = { list: [], byCs: new Map(), built: false };
// distance flown since take-off (NM) for a time airborne (s): a slower climb and descent at each end
function flown(F, tau){
  if (tau <= 0) return 0;
  const vC = F.fam === 'prop' ? 200 : 320, vR = F.vc, vD = F.fam === 'prop' ? 210 : 300;
  const C = F.cl, Dd = F.dl, T1 = C/vC*3600, T2 = T1 + (F.L - C - Dd)/vR*3600;
  if (tau < T1) return tau/3600*vC;
  if (tau < T2) return C + (tau - T1)/3600*vR;
  return Math.min(F.L, C + (F.L - C - Dd) + (tau - T2)/3600*vD);
}
const durOf = F => { const vC = F.fam === 'prop' ? 200 : 320, vD = F.fam === 'prop' ? 210 : 300; return (F.cl/vC + (F.L - F.cl - F.dl)/F.vc + F.dl/vD)*3600; };
function altAt(F, s){ const e0 = 500, e1 = 1000; return Math.min(F.rfl, e0 + s*(F.rfl/F.cl), e1 + (F.L - s)*(F.rfl/F.dl)); }
// build a flight: its route and timing. kind ARR: tArr is when it lands; DEP and overflights: tOff is when it takes off
function makePlan(cs, t, dep, arr, when, kind){
  const fam = typeFam(t), R = planRoute(dep, arr, S.wdir, fam !== 'prop'); if (!R || R.pts.length < 2) return null;
  const { total, cum } = routeLen(R.pts);
  const F = { cs, t, fam, dep, arr, R, L: total, cum, rfl: 0, vc: fam === 'heavy' ? 485 : fam === 'prop' ? 280 : fam === 'biz' ? 460 : 455, kind, spawned: false };
  F.rfl = rflFor(fam, total, crs(R.pts[0][0], R.pts[0][1], R.pts[R.pts.length - 1][0], R.pts[R.pts.length - 1][1]));
  F.cl = Math.min(total*0.45, F.rfl/1000*4.2 + 10); F.dl = Math.min(total*0.45, F.rfl/1000*3.1 + 14);
  F.tOff = kind === 'ARR' ? when - durOf(F)*1000 : when;
  return F;
}
// the five timetables for a day (0 Monday) from a start time, and the other flows
function buildPlan(startMs, hours, busy){
  PLAN.list = []; PLAN.byCs = new Map();
  const day0 = new Date(startMs); day0.setUTCHours(0, 0, 0, 0);
  const dow = (new Date(startMs).getUTCDay() + 6) % 7;
  const from = startMs - 9*3600e3, to = startMs + hours*3600e3;
  const at = (hm, dayOff = 0) => day0.getTime() + dayOff*864e5 + (+hm.slice(0, 2)*60 + +hm.slice(3))*60e3;
  const add = F => { if (F && !PLAN.byCs.has(F.cs)) { PLAN.list.push(F); PLAN.byCs.set(F.cs, F); } };
  for (const P of UK_PROFILES) for (const r of P.TIMETABLE) {
    const [aCs, o, aT, dCs, d, dT, t, days] = r;
    for (const off of [-1, 0]) {
      const dd = (dow + off + 7) % 7; if (days && !String(days).includes(String(dd + 1))) continue;
      if (aCs && aT) { const w = at(aT, off); if (w > from + 3*3600e3 && w < to + 10*3600e3) add(planOnce(aCs, t, o, P.icao, w, 'ARR')); }
      if (dCs && dT) { const w = at(dT, off); if (w > from && w < to) add(planOnce(dCs, t, P.icao, d, w, 'DEP')); }
    }
  }
  // the other flows, spread through the hours at their rates (busier through the day, quiet at night)
  const k = busy === 'event' ? 1.8 : busy === 'quiet' ? 0.5 : 1;
  for (const [o, d, als, tys, rate] of FLOWS) {
    for (let w = from; w < to; ) {
      const h = new Date(w).getUTCHours(), dayK = h < 5 ? 0.15 : h < 7 ? 0.6 : h > 21 ? 0.4 : 1;
      const gap = 3600e3/(rate*k*dayK + 0.01)*rnd(0.5, 1.5); w += gap; if (w >= to) break;
      const al = pick(als), cs = al + (100 + Math.floor(Math.random()*8900));
      add(planOnce(cs, pick(tys), o, d, w, 'DEP'));
    }
  }
  // an airport sends its flights off a couple of minutes apart (the timetables put many on the same minute), and lands
  // them a minute and a half apart
  const byAp = {};
  for (const F of PLAN.list) (byAp[F.kind === 'ARR' ? 'A' + F.arr : 'D' + F.dep] ||= []).push(F);
  for (const [k, L] of Object.entries(byAp)) {
    const gap = (k[0] === 'A' ? 95 : 110)*1000, key = F => k[0] === 'A' ? F.tOff + durOf(F)*1000 : F.tOff;
    L.sort((a, b) => key(a) - key(b)); let last = -Infinity;
    for (const F of L) { const t = key(F); if (t < last + gap) { F.tOff += last + gap - t; } last = key(F); }
  }
  PLAN.built = true;
}
// routes are shared between flights on the same city pair (the search takes a few milliseconds)
const ROUTE_MEMO = new Map();
function planOnce(cs, t, o, d, when, kind){
  if (!APS[o] || !APS[d] || o === d) return null;
  const key = o + '>' + d + '>' + (typeFam(t) === 'prop' ? 'L' : 'U');
  let F;
  if (ROUTE_MEMO.has(key)) { const M = ROUTE_MEMO.get(key); if (!M) return null; F = { ...M, cs, t, fam: typeFam(t), kind, spawned: false }; F.vc = F.fam === 'heavy' ? 485 : F.fam === 'prop' ? 280 : F.fam === 'biz' ? 460 : 455; F.rfl = rflFor(F.fam, F.L, crs(F.R.pts[0][0], F.R.pts[0][1], F.R.pts[F.R.pts.length - 1][0], F.R.pts[F.R.pts.length - 1][1])); F.cl = Math.min(F.L*0.45, F.rfl/1000*4.2 + 10); F.dl = Math.min(F.L*0.45, F.rfl/1000*3.1 + 14); F.tOff = kind === 'ARR' ? when - durOf(F)*1000 : when; }
  else { F = makePlan(cs, t, o, d, when, kind); ROUTE_MEMO.set(key, F ? { R: F.R, L: F.L, cum: F.cum, dep: o, arr: d } : null); }
  // only flights that come near you matter
  if (F && !routeNearMe(F)) return null;
  return F;
}
function routeNearMe(F){
  const m = 1.4, bb = [MYBB[0] - m, MYBB[1] - m*1.7, MYBB[2] + m, MYBB[3] + m*1.7];
  return F.R.pts.some((p, i) => { if (i && gcNM(F.R.pts[i - 1], p) > 60) { for (let f = 0.1; f < 1; f += 0.1) { const q = gcAt(F.R.pts[i - 1], p, f); if (q[0] > bb[0] && q[0] < bb[2] && q[1] > bb[1] && q[1] < bb[3]) return true; } }
    return p[0] > bb[0] && p[0] < bb[2] && p[1] > bb[1] && p[1] < bb[3]; });
}
// the box round your airspace inside which planned flights are flown (outside it they are just drawn from the clock)
const nearBox = (la, lo, m = 1.1) => la > MYBB[0] - m && la < MYBB[2] + m && lo > MYBB[1] - m*1.7 && lo < MYBB[3] + m*1.7;
function planState(F, ms){
  const tau = (ms - F.tOff)/1000; if (tau < 0) return null;
  const s = flown(F, tau); if (s >= F.L - 2) return null;
  const q = alongRoute(F.R.pts, F.cum, s);
  return { la: q.p[0], lo: q.p[1], i: q.i, h: q.h, alt: altAt(F, s), s, climbing: s < F.cl, desc: s > F.L - F.dl };
}
// every 5 s: flights that have come into the box start flying for real
function spawnPlanned(){
  const ms = simMs();
  for (const F of PLAN.list) {
    if (F.spawned || F.gone) continue;
    if (F.tOff > ms + 60e3) continue;
    const st = planState(F, ms);
    if (!st) { if (ms - F.tOff > 3600e3*14) F.gone = true; continue; }
    if (!nearBox(st.la, st.lo)) continue;
    if (F.live || S.acs.some(a => a.cs === F.cs) || LIVE.cs.has(F.cs)) { F.spawned = true; continue; }
    spawnFlight(F, st);
  }
}
function spawnFlight(F, st){
  F.spawned = true;
  const ac = new Aircraft({ cs: F.cs, t: F.t, dep: F.dep, arr: F.arr, la: st.la, lo: st.lo, alt: Math.round(st.alt/100)*100, hdg: st.h, route: F.R.pts.map(p => p.slice()), ri: st.i,
    rfl: F.rfl, sid: F.R.sid, star: F.R.star, holdFix: F.R.holdFix, src: 'plan' });
  ac.tas = tasTarget(ac); ac.gs = ac.tas;
  ac.past = pastWithAlt([...F.R.pts.slice(0, st.i), [st.la, st.lo, null]], st.alt);
  if (st.climbing) ac.cfl = F.rfl; else if (st.desc) ac.cfl = Math.max(2000, Math.floor(ac.alt/1000)*1000); else ac.cfl = F.rfl;
  ac.alt = Math.min(ac.alt, ac.cfl > ac.alt ? ac.alt : ac.alt);
  ac.owner = ownerAt(ac.la, ac.lo, ac.alt);
  // a delayed departure airport: it leaves late (a planned flight just becomes later)
  if (ac.owner === ME) {
    if (S.t < 30) { ac.st = 'MINE'; ac.accepted = true; ac.wasIn = true; ac.idT = S.t; ac.cfl = levelFor(ac.trk, ac.alt) === ac.alt ? ac.alt : Math.round(ac.alt/1000)*1000; if (Math.abs(ac.cfl - ac.alt) < 600) ac.alt = ac.cfl; }
    else { ac.st = 'OFFER'; ac.from = firAt(ac.la, ac.lo); ac.offerT = S.t; ac.entryEta = S.t; ac.accepted = true; }
  }
  S.acs.push(ac); emit('spawn', ac);
  return ac;
}

// ── live traffic ──
const RELAY_URLS = ['https://clearway-atc.vercel.app/api/traffic', 'https://clearway-relay.ventrogroup.workers.dev/traffic'];
const LIVE = { cs: new Set(), ac: new Map(), ok: 0, err: 0, timer: null, relay: 0, polls: 0, routes: new Map(), asked: new Set(), src: '' };
// today's real flights at the five airports by callsign: where each comes from or goes to
const BOARD = new Map();
async function loadBoards(){
  const base = location.pathname.replace(/area\/?(index\.html)?$/, '');
  const PLACE = {};
  for (const P of UK_PROFILES) Object.assign(PLACE, P.PLACES || {});
  const placeOf = p => { const s = String(p || '').toLowerCase().trim(); return PLACE[s] || Object.entries(PLACE).find(([k]) => s.startsWith(k))?.[1] || null; };
  const csOf = fl => { fl = String(fl).toUpperCase().replace(/\s/g, ''); let m = fl.match(/^([A-Z]{3})(\d{1,4}[A-Z]{0,2})$/); if (m) return fl; m = fl.match(/^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/); return m && AIRLINE_ICAO[m[1]] ? AIRLINE_ICAO[m[1]] + m[2].replace(/^0+/, '') : fl; };
  await Promise.all(UK_PROFILES.map(async P => {
    try {
      const r = await fetch(base + P.icao.toLowerCase() + '/flights.json?_=' + Date.now(), { cache: 'no-store' }); if (!r.ok) return;
      const j = await r.json();
      for (const day of Object.values(j.days || {})) {
        for (const a of day.arr || []) { const o = placeOf(a.place); if (o) BOARD.set(csOf(a.flight), { dep: o, arr: P.icao, status: a.status, sched: a.sched, exp: a.expected, off: day.utcOffsetMin }); }
        for (const d of day.dep || []) { const a = placeOf(d.place); if (a) BOARD.set(csOf(d.flight), { dep: P.icao, arr: a, status: d.status, sched: d.sched, exp: d.expected, off: day.utcOffsetMin }); }
      }
    } catch (e) {}
  }));
  // the boards' delays show at the airports: an hour's average lateness of the arrivals still to come
  return BOARD.size;
}
async function pollLive(){
  if (!S.running || !/live/.test(S.mode)) return;
  const c = [(MYBB[0] + MYBB[2])/2, (MYBB[1] + MYBB[3])/2], r = Math.min(250, Math.round(nm(MYBB[0], MYBB[1], MYBB[2], MYBB[3])/2 + 90));
  let j = null;
  for (let i = 0; i < RELAY_URLS.length && !j; i++) {
    const k = (LIVE.relay + i) % RELAY_URLS.length;
    try { const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 9000);
      const res = await fetch(`${RELAY_URLS[k]}?lat=${c[0].toFixed(2)}&lon=${c[1].toFixed(2)}&r=${r}`, { cache: 'no-store', signal: ctl.signal }); clearTimeout(to);
      if (res.ok) { j = await res.json(); LIVE.relay = k; } } catch (e) {}
  }
  if (!j) { if (++LIVE.err === 3) sys('The live traffic feed is not answering: retrying. Planned traffic carries on.', true); return; }
  const now = Date.now();
  for (const a of j.ac || []) { if (a.gnd || a.lat == null || !a.alt) continue; a.ts = now - (a.seen || 0)*1000; a.cs = String(a.cs || '').toUpperCase().replace(/\s/g, ''); LIVE.ac.set(a.hex, a); }
  for (const [k, a] of LIVE.ac) if (now - a.ts > 90e3) LIVE.ac.delete(k);
  if (!LIVE.ok) sys(`Live traffic connected: ${LIVE.ac.size} aircraft in the air within ${r} NM (${j.src || 'ADS-B'}).`);
  LIVE.ok = now; LIVE.err = 0; LIVE.polls++; LIVE.src = j.src || '';
  LIVE.cs = new Set([...LIVE.ac.values()].map(a => a.cs).filter(Boolean));
  await askRoutes();
  // a timetable flight that is really in the air: the real one replaces it (yours, offered or not)
  for (const a of LIVE.ac.values()) {
    if (a.adopted || !a.cs) continue;
    const o = S.acs.find(x => x.cs === a.cs && x.src === 'plan' && x.st !== 'OUT'); if (!o) continue;
    if (o.mine || o.st === 'OFFER') { const n = adoptLive(a, o.mine); if (o.st === 'OFFER') { n.st = 'OFFER'; n.from = o.from; n.offerT = o.offerT; n.entryEta = o.entryEta; n.accepted = o.accepted; } }
    else { S.acs.splice(S.acs.indexOf(o), 1); if (S.sel === o) S.sel = null; }
  }
  liveAdopt(LIVE.polls <= 2);
}
// where a live flight is going: today's boards, the relay's route lookup, else a guess from how it is flying
async function askRoutes(){
  const want = [...LIVE.ac.values()].filter(a => a.cs && !BOARD.has(a.cs) && !LIVE.routes.has(a.cs) && !LIVE.asked.has(a.cs) && nearBox(a.lat, a.lon, 2)).slice(0, 40);
  if (!want.length) return;
  for (const a of want) LIVE.asked.add(a.cs);
  try {
    const base = RELAY_URLS[0].replace(/\/traffic$/, '/routes');
    const res = await fetch(`${base}?q=${encodeURIComponent(want.map(a => `${a.cs},${a.lat.toFixed(2)},${a.lon.toFixed(2)}`).join(';'))}`, { cache: 'no-store' });
    if (!res.ok) return; const j = await res.json();
    for (const [cs, r] of Object.entries(j.routes || {})) {
      if (!r) continue;
      for (const k of [0, 1]) if (!APS[r[k]] && r[k + 2] && isFinite(r[k + 2][0])) APS[r[k]] = [r[k + 2][0], r[k + 2][1], String(r[k + 2][2] || r[k])];
      if (APS[r[0]] && APS[r[1]]) LIVE.routes.set(cs, [r[0], r[1]]);
    }
    // flights already taken over before their route was known: on their real route now, if you haven't re-routed them
    for (const ac of S.acs) {
      const rt = ac.src === 'live' && !ac.arr && LIVE.routes.get(ac.cs); if (!rt || ac.told) continue;
      ac.dep = rt[0]; ac.arr = rt[1];
      const on = routeOnward(ac.la, ac.lo, ac.trk, ac.arr); if (on) { ac.route = on; ac.ri = 1; }
      if (!ac.past) { const t0 = ac.track[0] || [ac.la, ac.lo, ac.alt], t1 = ac.track[1] || [ac.la, ac.lo]; ac.past = pastWithAlt(routeBack(t0[0], t0[1], crs(t0[0], t0[1], t1[0], t1[1]) || ac.trk, ac.dep), t0[2]); }
      if (STARS[ac.arr] && STARS[ac.arr][0]) ac.holdFix = holdFixOf(STARS[ac.arr][0]);
    }
  } catch (e) {}
}
const liveLL = a => { const dt = Math.min(60, (Date.now() - a.ts)/1000), d = (a.gs || 0)*dt/3600; return moveLL(a.lat, a.lon, a.trk || 0, d); };
const liveAlt = a => { const dt = Math.min(60, (Date.now() - a.ts)/1000); return Math.max(0, (a.alt || 0) + (a.vs || 0)*dt/60); };
// a live aircraft becomes one you work: at its real position, level and speed, on its real (or likeliest) route
function adoptLive(a, mineNow){
  const [la, lo] = liveLL(a), alt = liveAlt(a);
  const cs = a.cs || (a.reg || a.hex).toUpperCase();
  let dep = null, arr = null;
  const b = BOARD.get(cs), rt = LIVE.routes.get(cs);
  if (b) { dep = b.dep; arr = b.arr; } else if (rt) { dep = rt[0]; arr = rt[1]; }
  if (!arr && (a.vs || 0) < -500 && alt < 26000) {   // coming down: the airport ahead
    let best = null, bd = 170;
    for (const [k, v] of Object.entries(APS)) { if (!STARS[k]) continue; const d = nm(la, lo, v[0], v[1]), off = Math.abs(angDiff(a.trk || 0, crs(la, lo, v[0], v[1]))); if (off < 35 && d < bd) { bd = d; best = k; } }
    arr = best;
  }
  let route = null, star = null, holdFix = null, past = null;
  if (arr && APS[arr] && dep && APS[dep]) {
    const R = planRoute(dep, arr, S.wdir, true);
    if (R) { route = R.pts.map(p => p.slice()); star = R.star; holdFix = R.holdFix; }
  }
  if (arr && STARS[arr] && STARS[arr][0]) holdFix = holdFix || holdFixOf(STARS[arr][0]);
  // where it has come from (the airways back to its origin) and where it is going from here: airways, never a straight line
  let onward = null;
  if (route) { let bi = 1, bd = Infinity; for (let i = 1; i < route.length; i++) { const d = segNM([la, lo], route[i - 1], route[i]); if (d < bd) { bd = d; bi = i; } }
    if (bd < 25) { past = [...route.slice(0, bi), [la, lo, null]]; onward = [[la, lo, null], ...route.slice(bi)]; } }
  if (!onward) onward = routeOnward(la, lo, a.trk || 0, arr) || (() => { const f = arr && apLL(arr) || moveLL(la, lo, a.trk || 0, 600); return [[la, lo, null], [f[0], f[1], arr || null]]; })();
  if (!past && dep) past = routeBack(la, lo, a.trk || 0, dep);
  route = onward;
  const ac = new Aircraft({ cs, t: a.t || 'A320', dep, arr, la, lo, alt: Math.round(alt/100)*100, hdg: a.trk || 0, route, ri: 1, src: 'live', live: a.hex, star, holdFix });
  ac.tas = Math.max(180, (a.gs || 400) - windAt(alt).kt*Math.cos(((windAt(alt).dir + 180) - (a.trk || 0))*D2R)); ac.gs = a.gs || ac.tas;
  if (a.cs && a.cs !== cs) ac.real = a.cs;
  ac.past = pastWithAlt(past, alt);
  // its cleared level: where it is levelling, or the next whole thousand the way it is going
  const vs = a.vs || 0; ac.vs = vs;
  ac.cfl = Math.abs(vs) < 300 ? Math.round(alt/1000)*1000 : vs > 0 ? Math.max(Math.ceil((alt + 1500)/1000)*1000, Math.min(36000, ac.rfl)) : Math.max(5000, Math.floor((alt - 2500)/1000)*1000);
  ac.rfl = Math.min(PERF[ac.fam].ceil, Math.abs(vs) < 300 && alt > 24000 ? Math.round(alt/1000)*1000 : Math.max(ac.cfl, rflFor(ac.fam, 500, a.trk || 0)));
  if (Math.abs(vs) < 300) ac.alt = ac.cfl;
  ac.owner = mineNow ? ME : ownerAt(la, lo, alt);
  ac.adopted = true;
  if (mineNow) { ac.st = 'MINE'; ac.accepted = true; ac.wasIn = true; ac.idT = S.t; }
  // its planned copy (the same flight from the timetable) gives way
  for (const o of S.acs.filter(x => x.cs === cs && x.src === 'plan')) { S.acs.splice(S.acs.indexOf(o), 1); if (S.sel === o) S.sel = ac; }
  const F = PLAN.byCs.get(cs); if (F) { F.live = true; F.spawned = true; }
  S.acs.push(ac); a.adopted = true; emit('spawn', ac);
  return ac;
}
const segNM = (p, a, b) => { const c = Math.cos(p[0]*D2R), ax = (a[1] - p[1])*60*c, ay = (a[0] - p[0])*60, bx = (b[1] - p[1])*60*c, by = (b[0] - p[0])*60, dx = bx - ax, dy = by - ay, L = dx*dx + dy*dy || 1e-9, u = clamp(-(ax*dx + ay*dy)/L, 0, 1); return Math.hypot(ax + dx*u, ay + dy*u); };
function liveAdopt(first){
  let n = 0;
  for (const a of LIVE.ac.values()) {
    if (a.adopted || !a.alt || a.alt < 1500) continue;
    if (a.cs && S.acs.some(x => x.cs === a.cs && x.src === 'live')) { a.adopted = true; continue; }
    const [la, lo] = liveLL(a), alt = liveAlt(a);
    if (first && mineAt(la, lo, alt)) { adoptLive(a, true); n++; continue; }
    // about to come your way (straight on at its present climb or descent, four minutes)
    for (let t = 30; t <= 300; t += 30) {
      const p = moveLL(la, lo, a.trk || 0, (a.gs || 0)*t/3600), z = clamp(alt + (a.vs || 0)*t/60, 0, 45000);
      if (mineAt(p[0], p[1], z)) { adoptLive(a, false); break; }
    }
  }
  if (first && n) sys(`You have taken over the real traffic in your airspace: ${n} aircraft ${n === 1 ? 'is' : 'are'} now yours where ${n === 1 ? 'it is' : 'they are'}.`);
}
// live aircraft you are not working: drawn grey, and counted for separation against yours
function liveGhosts(){
  const out = [];
  for (const a of LIVE.ac.values()) { if (a.adopted) continue; const [la, lo] = liveLL(a); out.push({ cs: a.cs || a.hex, t: a.t, la, lo, alt: liveAlt(a), trk: a.trk || 0, hdg: a.trk || 0, gs: a.gs || 0, vs: a.vs || 0, cfl: liveAlt(a), ghost: true }); }
  return out;
}

// ── delays, disruption and the unexpected ──
// airports: { delay minutes, hold (arrivals hold in the stacks), slotGap (s between arrivals TC will take), closed, why, until }
const AP_WHY = ['strong winds, reduced landing rate', 'low visibility procedures', 'a runway inspection', 'a runway closure for repairs', 'thunderstorms over the airport', 'an aircraft disabled on the runway', 'air traffic control staffing'];
const BIG = { EGLL: 42, EGKK: 32, EGCC: 32, EGSS: 26, EGGW: 22, EGBB: 24, EGPH: 26, EGPF: 20, EGGD: 18, EGLC: 18, EGNX: 16, EGAA: 14, EIDW: 30, EHAM: 50, LFPG: 50, EDDF: 50 };
const ALTS = { EGLL: ['EGKK', 'EGSS', 'EGGW'], EGKK: ['EGLL', 'EGSS', 'EGHH'], EGSS: ['EGGW', 'EGLL', 'EGKK'], EGGW: ['EGSS', 'EGLL'], EGCC: ['EGGP', 'EGNM', 'EGBB'],
  EGBB: ['EGNX', 'EGCC'], EGPH: ['EGPF', 'EGPK', 'EGNT'], EGPF: ['EGPK', 'EGPH'], EGGD: ['EGFF', 'EGTE', 'EGBB'], EGLC: ['EGMC', 'EGSS', 'EGKK'], EGNX: ['EGBB', 'EGCC'], EIDW: ['EINN', 'EICK', 'EGAA'] };
function setAirport(ic, o){
  const A = S.airports[ic] = { ...(S.airports[ic] || {}), ...o };
  const rate = BIG[ic] || 16;
  if (A.closed) { A.hold = false; A.slotGap = 0; }
  else if (A.delay) { A.hold = true; A.slotGap = 3600/rate*(1 + A.delay/25); }
  else { A.hold = false; A.slotGap = 0; }
  emit('airport', ic);
}
function airportDelay(ic, mins, why, dur){
  setAirport(ic, { delay: mins, why, until: S.t + (dur || rnd(30, 70))*60, closed: false });
  coord(`${UNIT_SHORT(tcFor(ic))}: ${apName(ic)} arrivals are holding, ${mins} minute delays (${why}). Arrivals at minimum clean speed; I'll take one every ${Math.round(S.airports[ic].slotGap/60*10)/10} minutes and call you with each slot.`, tcFor(ic), 'warn');
}
function airportClose(ic, why, dur){
  setAirport(ic, { closed: true, why, until: S.t + (dur || rnd(25, 50))*60, delay: 0 });
  coord(`${UNIT_SHORT(tcFor(ic))}: ${apName(ic)} is closed, ${why}, expect at least ${Math.round((S.airports[ic].until - S.t)/60)} minutes. Arrivals will be asking to divert.`, tcFor(ic), 'bad');
  // its arrivals: the ones you work ask for a diversion; the others' units divert them
  for (const ac of S.acs) if (ac.arr === ic && ac.st !== 'OUT') {
    const alt = (ALTS[ic] || nearestAirports(ac, 3)).find(a => APS[a] && !(S.airports[a] && S.airports[a].closed));
    if (!alt) continue;
    if (ac.mine) { ac.divAsk = alt; ac.needSay = `${apName(ic)} is closed, request diversion to ${apName(alt)}`; setNeed(ac, `Request divert ${alt}`); say(ac, `${spoken(ac.cs)}, ${ac.needSay}`); }
    else if (Math.random() < 0.7) divert(ac, alt);
  }
}
function nearestAirports(ac, n){ return Object.entries(APS).filter(([k]) => STARS[k] && /^EG/.test(k)).sort((a, b) => nm(ac.la, ac.lo, a[1][0], a[1][1]) - nm(ac.la, ac.lo, b[1][0], b[1][1])).slice(0, n).map(e => e[0]); }
// the terminal unit an airport's arrivals go to
function tcFor(ic){ const p = apLL(ic); if (!p) return 'L'; const ss = secsAt(p[0], p[1], 60).filter(s => s.own !== ME).sort((a, b) => (a.hi - a.lo) - (b.hi - b.lo)); return ss.length ? ss[0].own : 'L'; }
// a neighbour restricts what it takes: one every few minutes (a regulation), or nothing above a level
function flowReg(code, o){
  const R = { code, why: o.why, mit: o.mit || 0, cap: o.cap || 0, until: S.t + (o.dur || 40)*60, last: null };
  S.flowRegs = S.flowRegs.filter(x => x.code !== code); S.flowRegs.push(R);
  coord(`${UNIT_SHORT(code)}: ${o.why}. ${R.mit ? `I can take one every ${Math.round(R.mit/60)} minutes` : ''}${R.mit && R.cap ? ', and ' : ''}${R.cap ? `nothing above FL${FLs(R.cap)}` : ''} until ${zHM(simMs() + o.dur*60e3)}.`, code, 'warn');
  emit('flow', R);
}
// thunderstorms: cells drifting with the wind, tops up to FL450, that crews ask to go round
function addCB(la, lo, n){
  for (let i = 0; i < n; i++) {
    const p = i ? moveLL(la, lo, rnd(0, 360), rnd(8, 35)) : [la, lo];
    S.cbs.push({ la: p[0], lo: p[1], r: rnd(6, 14), top: Math.round(rnd(33, 45))*1000, born: S.t, life: rnd(40, 90)*60, id: ++S.seq });
  }
  emit('cb');
}
// an emergency on one of your flights
const EMG = {
  MED: ac => { const d = nearestAirports(ac, 2)[0]; ac.emg = { kind: 'MED', t: S.t, to: d }; ac.sq = '7700'; ac.needSay = `pan pan, pan pan, pan pan, medical emergency on board, request diversion to ${apName(d)}`; setNeed(ac, `PAN medical: request divert ${d}`); say(ac, `${meName()}, ${spoken(ac.cs)}, ${ac.needSay}`); },
  PRESS: ac => { ac.emg = { kind: 'PRESS', t: S.t }; ac.sq = '7700'; ac.cfl = 10000; ac.emgDesc = true; ac.mode = 'HDG'; ac.tgtHdg = norm(ac.trk + (Math.random() < .5 ? -30 : 30)); ac.hdgT = S.t;
    ac.needSay = 'mayday mayday mayday, rapid depressurisation, emergency descent, turning off the airway'; setNeed(ac, 'MAYDAY: emergency descent FL100'); say(ac, `${meName()}, ${spoken(ac.cs)}, ${ac.needSay}`); },
  ENG: ac => { const d = nearestAirports(ac, 2)[0]; ac.emg = { kind: 'ENG', t: S.t, to: d }; ac.cfl = Math.min(ac.cfl, ac.fam === 'heavy' ? 26000 : 22000); ac.spd = null;
    ac.needSay = `pan pan, pan pan, pan pan, engine failure, drifting down to ${spokenFL(ac.cfl, true)}, request diversion to ${apName(d)}`; setNeed(ac, `PAN engine: request divert ${d}`); say(ac, `${meName()}, ${spoken(ac.cs)}, ${ac.needSay}`); },
  NORDO: ac => { ac.emg = { kind: 'NORDO', t: S.t, back: false }; ac.sq = '7600'; clearNeed(ac); sys(`${ac.cs} is squawking 7600: radio failure. It carries on at its cleared level on its route.`, true); },
  FUEL: ac => { ac.emg = { kind: 'FUEL', t: S.t }; ac.needSay = 'minimum fuel, request priority and direct routing'; setNeed(ac, 'Minimum fuel'); say(ac, `${spoken(ac.cs)}, ${ac.needSay}`); }
};
function emergency(kind){
  const pool = S.acs.filter(a => a.st === 'MINE' && !a.emg && a.alt > 15000); if (!pool.length) return false;
  const ac = pick(pool); kind = kind || pick(['MED', 'MED', 'PRESS', 'ENG', 'NORDO', 'FUEL']); EMG[kind](ac); S.stats.emg = (S.stats.emg || 0) + 1; emit('emg', ac); return ac;
}
// what happens on its own, at the rate the session asked for
const DIS_RATE = { off: 0, some: 1, often: 2.2 };
function stepEvents(dt){
  const k = DIS_RATE[S.opts.disrupt || 'some'] || 0, ek = DIS_RATE[S.opts.emerg || 'some'] || 0;
  if (Math.floor(S.t) % 5 === 0 && Math.floor(S.t - dt) % 5 !== 0) spawnPlanned();
  // expiries
  for (const [ic, A] of Object.entries(S.airports)) if (A.until && S.t > A.until) {
    const was = A.closed ? 'is open again' : 'delays are over: arrivals are no longer holding';
    delete S.airports[ic]; coord(`${UNIT_SHORT(tcFor(ic))}: ${apName(ic)} ${was}.`, tcFor(ic), 'ok'); emit('airport', ic);
    for (const ac of S.acs) if (ac.arr === ic && ac.mode === 'HOLD' && !ac.mine) { ac.aiHold = S.t + rnd(30, 240); }
  }
  for (const R of S.flowRegs) if (S.t > R.until && !R.done) { R.done = true; coord(`${UNIT_SHORT(R.code)}: the restriction is lifted.`, R.code, 'ok'); }
  S.flowRegs = S.flowRegs.filter(R => !R.done);
  for (const cb of S.cbs) { const W = windAt(30000), p = moveLL(cb.la, cb.lo, W.dir + 180, W.kt*0.35*dt/3600); cb.la = p[0]; cb.lo = p[1]; }
  S.cbs = S.cbs.filter(c => S.t - c.born < c.life);
  S.turb = S.turb.filter(T => S.t < T.until);
  // the slot: the terminal unit calls when it can take the next arrival from a stack of yours
  for (const [ic, A] of Object.entries(S.airports)) if (A.slotGap && !A.closed && (A.lastIn == null || S.t - A.lastIn >= A.slotGap)) {
    const held = S.acs.filter(a => a.arr === ic && a.mine && a.mode === 'HOLD' && !a.slotOk).sort((a, b) => a.hold.since - b.hold.since)[0];
    if (held) { held.slotOk = true; A.lastIn = S.t; coord(`${UNIT_SHORT(tcFor(ic))}: slot for ${held.cs}, send it now`, tcFor(ic), 'ok', held); }
  }
  // NORDO comes back after a few minutes
  for (const ac of S.acs) if (ac.emg && ac.emg.kind === 'NORDO' && !ac.emg.back && S.t - ac.emg.t > 300 && Math.random() < dt/90) { ac.emg.back = true; ac.sq = String(1000 + Math.floor(Math.random()*6777)).replace(/[89]/g, '7'); say(ac, `${meName()}, ${spoken(ac.cs)}, back with you, sorry, we had a radio failure`); setNeed(ac, 'Check-in'); }
  if (!S.running || S.t < 120) return;
  const p = dt/3600;
  if (Math.random() < p*k*1.2) randomAirportEvent();
  if (Math.random() < p*k*0.8) randomFlowReg();
  if (Math.random() < p*k*0.9 && S.cbs.length < 10) { const c = randomInMine(); if (c) { addCB(c[0], c[1], Math.ceil(rnd(1, 4))); sys('Weather: thunderstorms building in your airspace. Crews will ask to go round them.'); } }
  if (Math.random() < p*k*1.2 && S.turb.length < 3) { const c = randomInMine(), lo = Math.round(rnd(30, 37))*1000; if (c) { S.turb.push({ la: c[0], lon: c[1], r: rnd(25, 50), lo, hi: lo + 2000, until: S.t + rnd(20, 45)*60 }); sys(`Moderate turbulence reported FL${FLs(lo)} to FL${FLs(lo + 2000)} near ${nearestFix(c[0], c[1])}.`); } }
  if (Math.random() < p*ek*1.6) emergency();
}
function randomInMine(){ for (let i = 0; i < 40; i++) { const la = rnd(MYBB[0], MYBB[2]), lo = rnd(MYBB[1], MYBB[3]); if (MY.some(s => pip(la, lo, s.p))) return [la, lo]; } return null; }
function nearestFix(la, lo){ let b = null, bd = Infinity; for (const n of AWY_NODES) { const p = FIXP[n], d = nm(la, lo, p[0], p[1]); if (d < bd && FIXP[n][2] !== 'P') { bd = d; b = n; } } return b; }
function randomAirportEvent(){
  // an airport your traffic is going to
  const cnt = {}; for (const a of S.acs) if (a.arr && STARS[a.arr] && (a.mine || a.st === 'OFFER' || a.st === 'AI')) cnt[a.arr] = (cnt[a.arr] || 0) + 1;
  const list = Object.entries(cnt).filter(([ic]) => !S.airports[ic]).sort((a, b) => b[1] - a[1]); if (!list.length) return;
  const ic = pick(list.slice(0, 3))[0];
  if (Math.random() < 0.22) airportClose(ic, pick(['an aircraft disabled on the runway', 'a runway closure', 'snow clearing', 'a fire service incident']));
  else airportDelay(ic, Math.round(rnd(10, 35)/5)*5, pick(AP_WHY));
}
function randomFlowReg(){
  const cnt = {}; for (const a of S.acs) if (a.mine && a.exit && a.exit.code) cnt[a.exit.code] = (cnt[a.exit.code] || 0) + 1;
  const list = Object.keys(cnt).filter(c => !S.flowRegs.some(R => R.code === c)); if (!list.length) return;
  const code = pick(list), cap = Math.random() < 0.35;
  flowReg(code, cap ? { why: pick(['sector overload', 'military activity in the upper airspace', 'staffing, sectors bandboxed']), cap: pick([30000, 32000, 34000]), dur: rnd(25, 50) }
                    : { why: pick(['an en-route regulation, sectors at capacity', 'industrial action', 'a radar failure, reduced capacity', 'thunderstorms in the sectors']), mit: pick([3, 4, 5, 6])*60, dur: rnd(25, 50) });
}
