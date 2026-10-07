// ═════════════════════════ Real world mode: today's real flights and live traffic ═════════════════════════
// The session starts at the current time. Gibraltar's arrivals and departures come from the airport's own live flight
// information (flights.json beside the page, refreshed every 15 minutes by a scheduled job in the site's repo), with
// their expected times and delays. Aircraft in the air right now come from free ADS-B networks (adsb.lol, adsb.fi)
// through a small relay, because those feeds can't be read by a web page directly. Real Gibraltar inbounds take over
// their scheduled flight when they come within range; everything else is shown as background traffic.
// live-traffic relays, tried in order: the Vercel function (api/traffic.js) and the Cloudflare Worker (relay/worker.js)
const RELAY_URLS = ['https://clearway-atc.vercel.app/api/traffic', 'https://clearway-relay.ventrogroup.workers.dev/traffic'];
const RELAYS = (() => { try { const o = localStorage.getItem('cw-relay'); return o ? [o] : RELAY_URLS; } catch (e) { return RELAY_URLS; } })();
const RELAY = RELAYS[0];
const LIVE = { relay: 0, data: null, loadedAt: 0, session: null, rows: null, ac: new Map(), ok: 0, err: 0, timer: null, bound: new Set(), hide: new Set(), prev: new Map(), joined: 0, used: new Set() };
const isLiveMode = m => /^live/.test(m || S.mode || '');
const AIRLINE_ICAO = { BA: 'BAW', U2: 'EZY', DS: 'EZS', EC: 'EJU', AT: 'RAM', LS: 'EXS', BY: 'TOM', VY: 'VLG', FR: 'RYR', IB: 'IBE', I2: 'IBS', W6: 'WZZ', TO: 'TVF', RK: 'RUK', MT: 'TCX' };
const AIRLINE_TYPE = { BAW: 'A20N', EZY: 'A20N', EJU: 'A20N', EZS: 'A20N', RAM: 'AT76', EXS: 'B738', TOM: 'B738', RYR: 'B738', VLG: 'A320', RRR: 'A400' };
const PLACE_ICAO = { 'london gatwick': 'EGKK', 'gatwick': 'EGKK', 'london heathrow': 'EGLL', 'heathrow': 'EGLL', 'london luton': 'EGGW', 'luton': 'EGGW',
  'london stansted': 'EGSS', 'manchester': 'EGCC', 'bristol': 'EGGD', 'birmingham': 'EGBB', 'edinburgh': 'EGPH', 'brize norton': 'EGVN', 'raf brize norton': 'EGVN',
  'tangier': 'GMTT', 'tangiers': 'GMTT', 'casablanca': 'GMMN', 'marrakech': 'GMMX', 'madrid': 'LEMD', 'seville': 'LEZL', 'sevilla': 'LEZL', 'malaga': 'LEMG', 'málaga': 'LEMG',
  'paris': 'LFPG', 'paris cdg': 'LFPG', 'nice': 'LFMN', 'farnborough': 'EGLF' };
Object.assign(AIRLINE_ICAO, APT.airlineIcao || {}); Object.assign(AIRLINE_TYPE, APT.airlineType || {}); Object.assign(PLACE_ICAO, APT.placeIcao || {});
Object.assign(AP, { EGBB: [52.4539, -1.7480, 'Birmingham'], EGPH: [55.9500, -3.3725, 'Edinburgh'], GMMX: [31.6069, -8.0363, 'Marrakech'] });
const csOf = fl => { fl = fl.toUpperCase().replace(/\s/g, ''); let m = fl.match(/^([A-Z]{3})(\d{1,4}[A-Z]{0,2})$/); if (m) return fl; m = fl.match(/^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/); return m && AIRLINE_ICAO[m[1]] ? AIRLINE_ICAO[m[1]] + m[2] : fl; };
const placeOf = p => PLACE_ICAO[p.toLowerCase().trim()] || p;
const typeOf = cs => AIRLINE_TYPE[cs.slice(0, 3)] || APT.defType || 'A320';
const fnum = cs => +((cs.match(/(\d+)/) || [0, 0])[1]);

async function liveLoad(force){
  if (LIVE.data && !force && Date.now() - LIVE.loadedAt < 5*60e3) return LIVE.data;
  try {
    const r = await fetch('flights.json?_=' + Date.now(), { cache: 'no-store' });
    if (r.ok) { LIVE.data = await r.json(); LIVE.loadedAt = Date.now(); }
  } catch (e) {}
  return LIVE.data;
}
// today's rows in UTC minutes from 00Z, with the airport's own status text
function liveToday(now = Date.now()){
  const D = LIVE.data && LIVE.data.days; if (!D) return null;
  const tryKey = off => new Date(now + off*60e3).toISOString().slice(0, 10);
  const key = Object.keys(D).find(k => k === tryKey(D[k].utcOffsetMin)); if (!key) return null;
  const day = D[key], off = day.utcOffsetMin, nowUtc = new Date(now).getUTCHours()*60 + new Date(now).getUTCMinutes();
  const conv = (r, kind) => {
    const cs = csOf(r.flight), t = hm(r.expected && /^\d\d:\d\d$/.test(r.expected) ? r.expected : r.sched) - off, sch = hm(r.sched) - off;
    const st = (r.status || '').trim(), stl = st.toLowerCase();
    return { cs, flight: r.flight, t: typeOf(cs), ap: placeOf(r.place), place: r.place, tm: t, sched: sch, kind,
      real: st + (r.expected && !/landed|departed|airborne|arrived/i.test(st) ? ' ' + r.expected + ' local' : ''),
      cancelled: /cancel/.test(stl), done: kind === 'ARR' ? /landed|arrived|on stand|on blocks/.test(stl) : /departed|airborne|closed/.test(stl), rel: t - nowUtc };
  };
  return { arr: day.arr.map(r => conv(r, 'ARR')).sort((a, b) => a.tm - b.tm), dep: day.dep.map(r => conv(r, 'DEP')).sort((a, b) => a.tm - b.tm), nowUtc, key, off };
}
// sched (arrivals with their turnaround) and residents, the same shape as timetableSession, with m relative to now
function liveSession(now = Date.now(), mode = 'live'){
  const T = liveToday(now); if (!T) return null;
  const sched = [], residents = [], used = new Set();
  const pairFor = a => T.dep.find(d => !used.has(d) && !d.cancelled && d.ap === a.ap && fnum(d.cs) - fnum(a.cs) === 1 && d.cs.slice(0, 3) === a.cs.slice(0, 3))
                    || T.dep.find(d => !used.has(d) && !d.cancelled && d.ap === a.ap && d.cs.slice(0, 3) === a.cs.slice(0, 3) && d.tm > a.tm);
  for (const a of T.arr) {
    if (a.cancelled) continue;
    const d = pairFor(a); if (d) used.add(d);
    const depOpen = d && !d.done && d.rel > 0, o = a.ap, landed = a.done || a.rel < -5;
    if (!landed) sched.push({ cs: a.cs, t: a.t, k: 'ARR', o, gate: gateFor(o), m: Math.max(0, a.rel - 15), at: zHM(Date.UTC(2026, 0, 1) + a.tm*60e3), real: true,
                               turn: d ? { cs: d.cs, d: d.ap, depM: Math.max(8, d.rel), at: zHM(Date.UTC(2026, 0, 1) + d.tm*60e3) } : null });
    else if (depOpen) residents.push({ cs: d.cs, t: d.t, k: 'RES', d: d.ap, gate: gateFor(d.ap), m: 0, depM: d.rel, at: zHM(Date.UTC(2026, 0, 1) + d.tm*60e3), real: true });
  }
  for (const d of T.dep) if (!used.has(d) && !d.cancelled && !d.done && d.rel > 0)   // night-stoppers and positioning flights
    residents.push({ cs: d.cs, t: d.t, k: 'RES', d: d.ap, gate: gateFor(d.ap), m: 0, depM: d.rel, at: zHM(Date.UTC(2026, 0, 1) + d.tm*60e3), real: true });
  // a very busy airport (New York JFK: APT.liveThin movements an hour) keeps an even share of its real flights in Live now;
  // Live now plus extra traffic keeps them all
  if (APT.liveThin && mode !== 'liveplus') {
    const mov = sched.filter(f => f.m < 180).length*2 + residents.filter(f => f.depM < 180).length, k = Math.max(1, Math.ceil(mov/(3*APT.liveThin)));
    return { sched: sched.filter((f, i) => i % k === 0), residents: residents.filter((f, i) => i % k === 0), T };
  }
  return { sched, residents, T };
}
// session picker: today's real flights instead of the timetable slot
function renderLiveSlots(){
  const el = $('slotList'); el.innerHTML = `<span class="dimmer">Loading today’s flights from ${APT.liveName}…</span>`;
  liveLoad().then(() => {
    if (!isLiveMode($('trafficSel').value)) return;
    const T = liveToday();
    if (!T) { el.innerHTML = '<span class="dimmer">Today’s flight information isn’t available on this page (it needs the site’s own web address). The session will use the timetable instead.</span>'; return; }
    const upd = LIVE.data.updated ? ` · updated ${LIVE.data.updated.substr(11, 5)}Z` : '';
    const row = r => `<span class="slot ${r.kind}${r.done || r.rel < -5 ? ' past' : ''}"><b>${r.cs}</b> ${r.kind === 'ARR' ? r.ap + ' › ' + APT.icao : APT.icao + ' › ' + r.ap} <i>${zHM(Date.UTC(2026, 0, 1) + r.tm*60e3)}Z${r.cancelled ? ' cancelled' : ''}</i></span>`;
    el.innerHTML = `<span class="dimmer" style="flex-basis:100%">Real flights today from ${APT.liveName}${upd}. Your session starts now (${zHM(Date.now())}Z).</span>` + [...T.arr, ...T.dep].sort((a, b) => a.tm - b.tm).map(row).join('');
  });
}

// ── live traffic from the relay ──
async function pollTraffic(){
  if (!RELAY || !S.running || !isLiveMode()) return;
  try {
    let j = null;
    for (let i = 0; i < RELAYS.length && !j; i++) {
      const k = (LIVE.relay + i) % RELAYS.length, base = RELAYS[k].replace(/\/$/, '');
      try {
        const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 8000);
        const r = await fetch((/\/(traffic|api\/traffic)$/.test(base) ? base : base + '/traffic') + `?lat=${LAT0.toFixed(2)}&lon=${LON0.toFixed(2)}&r=200`, { cache: 'no-store', signal: ctl.signal }); clearTimeout(to);
        if (r.ok) { j = await r.json(); LIVE.relay = k; }
      } catch (e) {}
    }
    if (!j) throw new Error('no relay');
    const now = Date.now();
    for (const a of j.ac || []) { a.ts = now - (a.seen || 0)*1000; LIVE.ac.set(a.hex, a); }
    for (const [k, a] of LIVE.ac) if (now - a.ts > 90e3) LIVE.ac.delete(k);
    for (const a of j.ac || []) { const o = LIVE.prev.get(a.hex); a.pgs = o ? o.gs : null; }   // the speed before: speeding up or slowing down
    LIVE.prev = new Map((j.ac || []).map(a => [a.hex, a]));
    if (!LIVE.ok) sys(`Live traffic connected: ${LIVE.ac.size} aircraft within 200 NM (${j.src || 'ADS-B'}).`);
    LIVE.ok = now; LIVE.err = 0;
    liveJoin(S.t >= LIVE_JOIN_S);
    S.liveWait = 0;
    liveBind();
  } catch (e) { if (++LIVE.err === 3) sys('Live traffic feed not responding; retrying.', true); }
}
const liveLL = a => { const dt = Math.min(45, (Date.now() - a.ts)/1000), d = (a.gs || 0)*dt/3600, tr = (a.trk || 0)*D2R; return [a.lat + d*Math.cos(tr)/60, a.lon + d*Math.sin(tr)/(60*Math.cos(a.lat*D2R))]; };
// a real aircraft inbound to Gibraltar takes over its scheduled flight as a pending track at its real position
function liveBind(){
  for (const [hex, a] of LIVE.ac) {
    if (LIVE.bound.has(hex) || a.gnd || !a.alt) continue;
    const ll = liveLL(a), p = xy(...ll), dGbr = Math.hypot(p[0] - RADAR_REF[0], p[1] - RADAR_REF[1]);
    if (dGbr > 90 || dGbr < 12) continue;
    const toGbr = brg(p[0], p[1], ...RADAR_REF), off = Math.abs(((a.trk - toGbr) % 360 + 540) % 360 - 180);
    const byName = S.sched.find(f => f.k === 'ARR' && f.cs === a.cs && !f.liveHex);
    const byPath = !byName && off < 25 && a.alt < 26000 && (a.vs || 0) <= 300 && S.sched.find(f => f.k === 'ARR' && f.real && !f.liveHex && f.cs.slice(0, 3) === a.cs.slice(0, 3) && Math.abs(f.m*60 + 15*60 - S.t - dGbr/Math.max(150, a.gs || 250)*3600) < 40*60);
    const f = byName || byPath; if (!f) continue;
    let ac = S.acs.find(x => x.cs === f.cs);
    if (ac && ac.state !== 'PRE' && S.t < LIVE_JOIN_S && !ac.liveHex && !ac.told) { dropAc(ac); ac = null; f.spawned = false; }   // just joined: the real one replaces the simulated copy
    if (ac && ac.state !== 'PRE') { f.liveHex = hex; LIVE.bound.add(hex); continue; }   // already yours: just hide the live copy
    // already inside your airspace (the session has just opened): it is yours where it is, not sent back out to the boundary
    if (dGbr < entryNM(nearGate(p)) + 1) { if (adoptArr(a, p, { cs: f.cs, t: f.t, ap: f.o })) sys(`${f.cs} is a real flight${a.cs && a.cs !== f.cs ? ` (callsign ${a.cs})` : ''}: it is yours ${Math.round(dGbr)} NM out at ${altShort(Math.round(a.alt/100)*100)}.`); continue; }
    if (!ac) { f.spawned = true; ac = spawnArrival({ ...f, m: S.t/60 + PRE_LEAD/60 + 1 }); }
    if (!ac) continue;
    const gateNow = nearGate(p);
    ac.gate = gateNow; ac.x = p[0]; ac.y = p[1]; ac.alt = Math.max(ENTRY_ALT[gateNow], a.alt); ac.gs = a.gs || 300; ac.ias = Math.min(300, ac.gs);
    ac.hdg = ac.trk = a.trk || ac.hdg; ac.preAt = S.t + Math.max(30, dist(...p, ...ENTRY[gateNow])/Math.max(150, ac.gs)*3600);
    if (a.cs && a.cs !== ac.cs) { ac.real = a.cs; }
    ac.liveHex = hex; f.liveHex = hex; LIVE.bound.add(hex);
    FAR.list = FAR.list.filter(g => g.cs !== f.cs);
    sys(`${f.cs} is a real flight${a.cs && a.cs !== f.cs ? ` (callsign ${a.cs})` : ''}: picked up ${Math.round(dGbr)} NM out at ${altShort(Math.round(a.alt/100)*100)}.`);
  }
}
// ── joining a session: the real aircraft already in your airspace or on your airport are yours where they are ──
// For the first minutes of a Real world session every live aircraft that is landing at, taking off from or moving on
// this airport is taken over in its current state: on final (cleared to land if it is very close in), inbound on its
// arrival route, being vectored, climbing out on its departure, rolling on the runway, taxiing or at a holding point.
// It keeps its real callsign or takes over its flight from today's list. Departures already beyond the hand-off range
// stay with the next sector, overflights and other airports' traffic stay grey, and parked aircraft are the stands' own
// (residents). Its live copy is hidden from then on.
const LIVE_JOIN_S = 180;
// their first calls, one after another a few seconds apart (not all at once, blocking each other)
function liveCall(ac, text){
  for (const u of [APT.radar, APT.depRadar, APT.tower]) if (u && text.startsWith(u[0] + ', ')) text = text.slice(u[0].length + 2);
  const q = (S.recalls ||= []), at = Math.max(S.t + 1, LIVE.callAt || 0); LIVE.callAt = at + 4.5;
  q.push({ at, ac, text });
}
const adsbCs = a => (a.cs || '').toUpperCase().replace(/\s/g, '');
const airlineCs = cs => /^[A-Z]{3}\d/.test(cs);
const liveType = (a, cs) => TYPES[a.t] ? a.t : typeOf(cs);
const liveIas = a => clamp((a.gs || 0)/(1 + Math.max(0, a.alt || 0)/1000*0.018), 0, 340);
const entryNM = g => Math.hypot(ENTRY[g][0] - RADAR_REF[0], ENTRY[g][1] - RADAR_REF[1]);
const nearGate = p => Object.keys(ENTRY).sort((g1, g2) => dist(...ENTRY[g1], ...p) - dist(...ENTRY[g2], ...p))[0];
// distance from q to the line through p along track trk (NM), and how far ahead along it q is
const lineTo = (p, trk, q) => { const ux = Math.sin(trk*D2R), uy = Math.cos(trk*D2R), dx = q[0] - p[0], dy = q[1] - p[1]; return { off: Math.abs(dx*uy - dy*ux), ahead: dx*ux + dy*uy }; };
const segDist = (p, a, b) => { const L = dist(...a, ...b) || 1e-9, t = clamp(((p[0]-a[0])*(b[0]-a[0]) + (p[1]-a[1])*(b[1]-a[1]))/(L*L), 0, 1); return dist(...p, a[0] + (b[0]-a[0])*t, a[1] + (b[1]-a[1])*t); };
// the rest of a route from where the aircraft is: from the leg it is nearest to
function routeOn(p, from, names){
  const pts = [from, ...names.map(n => WP[n].p)]; let bi = 1, bd = Infinity;
  for (let i = 1; i < pts.length; i++) { const d = segDist(p, pts[i-1], pts[i]); if (d < bd - 0.01) { bd = d; bi = i; } }
  return names.slice(bi - 1);
}
// today's flight it is: by its callsign, or the same airline's flight due nearest the time it lands or took off (eta, minutes from now)
function liveRow(a, kind, eta, tol = 40){
  const T = LIVE.session && LIVE.session.T; if (!T) return null;
  const cs = adsbCs(a), now = (Date.now() - S.start)/60e3, rows = kind === 'ARR' ? T.arr : T.dep;
  const free = r => !r.cancelled && !LIVE.used.has(r.cs) && !S.acs.some(x => x.cs === r.cs && (x.liveHex || x.told));
  const exact = rows.find(r => free(r) && r.cs === cs); if (exact) return exact;
  const taken = new Set([...LIVE.ac.values()].map(adsbCs));
  if (!airlineCs(cs)) return null;
  let best = null, bd = tol;
  for (const r of rows) if (free(r) && !taken.has(r.cs) && r.cs.slice(0, 3) === cs.slice(0, 3)) { const d = Math.abs(r.rel - (eta + now)); if (d < bd) { bd = d; best = r; } }
  return best;
}
// a place to come from or go to for a flight that isn't on today's list: one of today's that uses the same gate
const apForGate = (g, kind) => { const T = LIVE.session && LIVE.session.T, r = T && (kind === 'ARR' ? T.arr : T.dep).find(r => gateFor(r.ap) === g);
  return r ? r.ap : Object.keys(AP).find(k => k !== APT.icao && gateFor(k) === g) || ''; };
// the exit gate a departure is heading for: the one whose last fix lies the way it is going
const depGateOf = (p, trk) => { const b = dist(...p, ...RADAR_REF) > 3 ? brg(...RADAR_REF, ...p) : trk;
  return Object.keys(EXIT_ROUTE).filter(g => NEXT_UNIT[g] && EXIT_ROUTE[g].length).sort((g1, g2) => { const f = g => Math.abs(angDiff(b, brg(...RADAR_REF, ...WP[EXIT_ROUTE[g][EXIT_ROUTE[g].length-1]].p))); return f(g1) - f(g2); })[0]; };
// a simulated copy of the same flight (spawned from the schedule) gives way to the real one
function dropAc(ac){
  S.acs = S.acs.filter(x => x !== ac); if (ac.stand && ac.stand.occ === ac) ac.stand.occ = null;
  if (ac.tow && ac.tow.to && ac.tow.to.occ === ac) ac.tow.to.occ = null; if (S.sel === ac) S.sel = null;
}
function liveAc(a, p, row, kind, gate){
  const cs = row ? row.cs : adsbCs(a) || (a.reg || a.hex).toUpperCase();
  LIVE.used.add(cs);
  const f = S.sched.find(x => x.cs === cs && (kind === 'ARR' ? x.k === 'ARR' : x.k !== 'ARR'));
  for (const o of S.acs.filter(x => x.cs === cs)) dropAc(o);
  if (f) { f.spawned = true; f.liveHex = a.hex; }
  const base = f ? { ...f } : { cs, t: liveType(a, cs), real: true, ...(kind === 'ARR' ? { o: row ? row.ap : apForGate(gate, kind) } : { d: row ? row.ap : apForGate(gate, kind) }) };
  if (TYPES[a.t]) base.t = a.t;
  base.gate = gate; base.m = 0;
  const ac = new Aircraft(base); ac.kind = kind; ac.x = p[0]; ac.y = p[1];
  ac.hdg = ac.trk = a.trk || 0; ac.gs = a.gs || 0; ac.ias = liveIas(a); ac.alt = a.gnd ? ELEV : Math.max(ELEV, a.alt || ELEV); ac.vs = a.vs || 0;
  if (a.cs && adsbCs(a) !== cs) ac.real = adsbCs(a);
  ac.liveHex = a.hex; LIVE.bound.add(a.hex); ac.joined = true;
  FAR.list = FAR.list.filter(g => g.cs !== cs);
  S.acs.push(ac);
  return ac;
}
// a level it was cleared to: where it is levelling, or the next thousand feet below it while descending
const liveLevel = a => { const alt = Math.round((a.alt || 0)/100)*100; return (a.vs || 0) < -300 ? Math.max(APT.appAlt || 3000, Math.floor((alt - 500)/1000)*1000) : Math.max(APT.appAlt || 3000, Math.round(alt/1000)*1000); };
// lined up with one of the finals and on its profile: { key, rw, F, q }
function liveFinal(p, a){
  let best = null;
  for (const [key, F] of Object.entries(FINAL)) {
    const rw = F.rnp ? F.rwy : key; if (!F || !F.pts || !RW_ENDS.includes(rw)) continue;
    const q = onFinal({ x: p[0], y: p[1] }, F); if (!q || q.togo < -0.3 || q.togo > 16) continue;
    if (Math.abs(q.xte) > 0.5 + q.togo*0.05 || Math.abs(angDiff(a.trk || 0, q.crs)) > 30 || a.alt > gpAlt(Math.max(0, q.togo), key) + 1500) continue;
    if (!best || Math.abs(q.xte) < Math.abs(best.q.xte) || (F.rnp && !best.F.rnp && Math.abs(q.xte) < 0.3)) best = { key, rw, F, q };
  }
  return best;
}
function adoptFinal(a, p, row, fin){
  const ac = liveAc(a, p, row, 'ARR', nearGate(p)), F = fin.F, togo = fin.q.togo;
  Object.assign(ac, { app: fin.rw, appId: F.rnp ? fin.key : null, mode: 'FINAL', state: 'FINAL', route: [], via: false, finI: null, freq: 'RAD' });
  ac.tgtAlt = ac.cleared = F.alt || APT.appAlt || 3000;
  ac.warned15 = ac.warned10 = true; ac.gatesDone = {}; for (const g of F.gates || []) if (togo < g.togo) ac.gatesDone[g.at] = true;   // gates it passed before it was yours
  if (togo < (F.decNM || 3.05)) {   // past the point where it reports visual: with Tower, and cleared to land if it is close in
    ac.checked = true; ac.freq = 'TWR';
    if (togo < 2) { ac.ctl = true; ac.need = null; } else ac.need = F.decNeed || 'Visual, needs landing clearance';
    if (APT.xing && S.xing.st !== 'CLOSED') { S.xing.st = 'CLOSED'; renderAtis(); sys('Winston Churchill Avenue is already closed for it.'); }
    liveCall(ac, `${APT.tower[0]}, ${ac.ctl ? `short final runway ${fin.rw}, cleared to land` : `${togo.toFixed(0)} miles final runway ${fin.rw}`}`);
  } else {
    if (APT.xing && togo < 10 && S.xing.st === 'OPEN') sys(`${ac.cs} is inside 10 NM: close Winston Churchill Avenue now.`);
    ac.need = 'Initial call'; liveCall(ac, `${APT.radar[0]}, ${greet()}, established ${F.rnp ? F.short || 'RNP' : APT.appShort || 'final'} runway ${fin.rw}, ${altShort(Math.round(ac.alt/100)*100)}`);
  }
  return ac;
}
function adoptArr(a, p, row){
  const gate = nearGate(p), ac = liveAc(a, p, row, 'ARR', gate), d = dist(...p, ...RADAR_REF);
  ac.tgtAlt = ac.cleared = liveLevel(a); ac.freq = 'RAD';
  if (d < 12 && a.alt < 7000) {   // in the circuit or on vectors close in: on its heading, waiting for yours
    ac.mode = 'HDG'; ac.tgtHdg = Math.round(a.trk || 0) || 360; ac.state = 'VECTORS'; ac.route = [];
    liveCall(ac, `${APT.radar[0]}, ${greet()}, ${altShort(Math.round(ac.alt/100)*100)}${ac.tgtAlt < ac.alt - 200 ? ' descending ' + altShort(ac.tgtAlt) : ''}, heading ${hdg3(ac.tgtHdg)}, information ${phonetic(S.atis)}`);
  } else {   // on its arrival route: from the leg it is on
    ac.mode = 'NAV'; ac.state = 'INBOUND'; ac.route = routeOn(p, ENTRY[gate], ARR_ROUTE[gate][S.rwy]);
    liveCall(ac, PH.checkIn(ac));
  }
  ac.need = 'Initial call';
  return ac;
}
function adoptDepAir(a, p, row){
  const gate = row ? gateFor(row.ap) : depGateOf(p, a.trk || 0), ac = liveAc(a, p, row, 'DEP', gate), d = dist(...p, ...RADAR_REF);
  Object.assign(ac, { depRwy: depRw(), sid: sidName(gate, depRw()), cto: true, turned: true, pushed: true, leftStand: true, state: 'AIRBORNE', reqDct: true, onSid: false });
  const top = sidTop(ac); ac.tgtAlt = ac.cleared = a.alt > top - 300 ? Math.ceil((a.alt + 1500)/1000)*1000 : top;
  ac.route = routeOn(p, RADAR_REF, EXIT_ROUTE[gate]); ac.mode = ac.route.length ? 'NAV' : 'HDG'; ac.tgtHdg = Math.round(a.trk || 0) || 360;
  if (d < 4 && a.alt < ELEV + 2500) { ac.freq = 'TWR'; ac.calledAir = false; }   // just airborne: still with Tower, transfer it to Radar
  else { ac.freq = 'RAD'; ac.calledAir = ac.calledRad = true; ac.state = 'CLIMB'; ac.reqClimb = ac.tgtAlt > top; liveCall(ac, PH.depCall(ac)); }
  return ac;
}
// on the airport: rolling on a runway, lined up, at a holding point or taxiing
function adoptGround(a, p){
  const cs = adsbCs(a), gs = a.gs || 0, R = RWYS.find(R => Math.abs(R.offOf(p)) < 40 && R.mOf(p) > -60 && R.mOf(p) < (R.roll ? R.roll[1] + 130 : 4500));
  if (!TYPES[a.t] && !airlineCs(cs) && !a.reg) return null;   // a vehicle
  const exArr = liveRow(a, 'ARR', -5, 0), exDep = liveRow(a, 'DEP', 10, 0);   // by callsign only
  if (R) {
    const dir = Math.sin((a.trk || 0)*D2R)*R.RU[0] + Math.cos((a.trk || 0)*D2R)*R.RU[1] >= 0 ? 1 : -1, rw = dir > 0 ? R.lo : R.hi;
    const along = Math.abs(angDiff(a.trk || 0, crsOf(rw))) < 25;
    if (gs > 30 && along) {
      // rolling: a take-off if it is speeding up, a landing if it is slowing down (wait for a second look when unknown)
      if (a.pgs == null && !exArr && !exDep) return 'later';
      const dep = exDep ? true : exArr ? false : gs > a.pgs + 2;
      const m = R.mOf(p), q = R.rm(m, clamp(R.offOf(p), -8, 8));
      if (dep) { const row = exDep || liveRow(a, 'DEP', 0, 30), gate = row ? gateFor(row.ap) : depGateOf(p, a.trk || 0), ac = liveAc(a, q, row, 'DEP', gate);
        Object.assign(ac, { ground: true, onRwy: true, rwyId: R.id, state: 'TAKEOFF', cto: true, depRwy: rw, sid: sidName(gate, rw), pushed: true, leftStand: true, hdg: crsOf(rw), mode: 'GROUND', ias: gs, freq: 'TWR' });
        return ac; }
      const row = exArr || liveRow(a, 'ARR', -2, 25), ac = liveAc(a, q, row, 'ARR', nearGate(p));
      Object.assign(ac, { ground: true, onRwy: true, rwyId: R.id, state: 'ROLLOUT', app: rw, rollDir: dir, hdg: crsOf(rw), mode: 'GROUND', ias: gs, freq: 'TWR', checked: true, ctl: true });
      return ac;
    }
    if (gs <= 30 && along && !exArr && rwyOf(depRw()) === R) {   // stopped on the runway, lined up: a departure waiting for take-off clearance
      const row = exDep || liveRow(a, 'DEP', 3, 30), gate = row ? gateFor(row.ap) : depGateOf(p, crsOf(depRw())), ac = liveAc(a, R.rm(R.mOf(p), 0), row, 'DEP', gate);
      Object.assign(ac, { ground: true, onRwy: true, rwyId: R.id, state: 'LINEDUP', hdg: crsOf(depRw()), sid: sidName(gate, depRw()), pushed: true, leftStand: true, mode: 'GROUND', freq: 'TWR', gs: 0, ias: 0, need: 'Lined up' });
      liveCall(ac, `${APT.tower[0]}, ${greet()}, lined up runway ${depRw()}`);
      return ac;
    }
  }
  // parked (or just being pushed) on a stand: the stand's own aircraft, already there
  if (gs < 6 && STANDS.some(s => dist(...s.p, ...p) < 60*M2NM)) return null;
  const node = nearestNode(p, n => !/^R/.test(n.id)); if (!node || dist(...node.p, ...p) > 150*M2NM) return null;
  const hold = Object.keys(HOLDS).find(k => HOLDS[k].node && GN[HOLDS[k].node] && holdRwy(k) === rwyOf(depRw()) && dist(...GN[HOLDS[k].node].p, ...p) < 70*M2NM);
  // which way it is going: a callsign on today's list, or a departure if it is heading for the departure holding points
  let kind = exDep ? 'DEP' : exArr ? 'ARR' : null;
  if (!kind) { const hp = HOLDS[depHold({ x: p[0], y: p[1], leftStand: true, stand: null })], to = hp && GN[hp.node] ? GN[hp.node].p : RADAR_REF, ahead = [p[0] + Math.sin((a.trk||0)*D2R)*0.1, p[1] + Math.cos((a.trk||0)*D2R)*0.1];
    kind = hold && gs < 4 ? 'DEP' : dist(...ahead, ...to) < dist(...p, ...to) ? 'DEP' : 'ARR'; }
  if (kind === 'DEP') {
    const row = exDep || liveRow(a, 'DEP', 8, 40), gate = row ? gateFor(row.ap) : depGateOf(p, a.trk || 0), at = hold && gs < 4 ? GN[HOLDS[hold].node].p : node.p, ac = liveAc(a, at, row, 'DEP', gate);
    Object.assign(ac, { ground: true, sid: sidName(gate, depRw()), pushed: true, leftStand: true, mode: 'GROUND', freq: 'TWR', gs: 0, ias: 0 });
    if (hold && gs < 4) { ac.state = 'HOLDPT'; ac.hp = hold; ac.need = 'Ready for departure'; liveCall(ac, PH.atHold(ac, hold)); }
    else { ac.state = 'READY'; ac.need = 'Ready to taxi'; liveCall(ac, `${APT.tower[0]}, ${greet()}, ready to taxi`); }
    return ac;
  }
  const row = exArr || liveRow(a, 'ARR', -6, 25), ac = liveAc(a, node.p, row, 'ARR', nearGate(p));
  const ex = Object.keys(HOLDS).sort((k1, k2) => dist(...GN[HOLDS[k1].node].p, ...p) - dist(...GN[HOLDS[k2].node].p, ...p))[0];
  Object.assign(ac, { ground: true, state: 'VACATING', vacated: true, onRwy: false, path: null, vacNode: node.id, exit: ex, app: S.rwy, mode: 'GROUND', freq: 'TWR', gs: 0, ias: 0, checked: true, ctl: true });
  ac.need = 'Needs a stand'; liveCall(ac, `${APT.tower[0]}, ${greet()}, request taxi`);
  return ac;
}
// late: after the first minutes, only arrivals crossing into the airspace that nothing else has picked up (a flight
// not on the Flights board, or flying under a different callsign) are handed over, at the boundary
function liveJoin(late){
  const got = { fin: 0, arr: 0, dep: 0, gnd: 0 }, mine = [];
  // nearest first: the aircraft closest in call first, and take their own flights before anyone else's guess at them
  const near = [...LIVE.ac.values()].filter(a => !LIVE.bound.has(a.hex) && a.lat != null).map(a => { const p = xy(...liveLL(a)); return { a, p, d: dist(...p, ...RADAR_REF) }; }).sort((x, y) => x.d - y.d);
  for (const { a, p, d } of near) {
    const cs = adsbCs(a);
    if (cs && S.acs.some(x => x.cs === cs && (x.liveHex || x.told))) continue;   // you are already working a flight with its callsign
    const onGround = a.gnd || (a.alt != null && a.alt < ELEV + 150 && (a.gs || 0) < 60 && d < 2);
    let ac = null;
    if (late && (onGround || !a.alt || d < entryNM(nearGate(p)) - 8)) continue;
    if (onGround) { if (d < 3) { ac = adoptGround(a, p); if (ac === 'later') continue; if (ac) got.gnd++; } }
    else if (a.alt) {
      const toB = brg(...p, ...RADAR_REF), off = Math.abs(angDiff(a.trk || 0, toB)), gs = Math.max(120, a.gs || 250);
      const fin = d < 20 && liveFinal(p, a);
      if (fin && !late) { ac = adoptFinal(a, p, liveRow(a, 'ARR', fin.q.togo/gs*60, 30), fin); got.fin++; }
      else {
        // climbing away from the airport, inside the hand-off range: one of its departures
        const exDep = liveRow(a, 'DEP', 0, 0), climbing = (a.vs || 0) > 300 || (a.alt < ELEV + 1500 && d < 4);
        const back = lineTo(p, a.trk || 0, RADAR_REF), row = exDep || (climbing && off > 110 ? liveRow(a, 'DEP', -(d/gs*60 + 1), 25) : null);
        if (!late && d < APT.handoffNM && (exDep || (climbing && off > 110 && (row || (d < 6 && back.ahead < 0 && back.off < 3 && a.alt < ELEV + 5000))))) { ac = adoptDepAir(a, p, row); got.dep++; }
        // inside the airspace and coming in (or flying the circuit close in), low enough to be landing here
        else if (d < entryNM(nearGate(p)) + 2 && (off < 60 || d < 15) && (a.vs || 0) < 600 && a.alt < Math.min(26000, d*400 + 6000)) {
          const row = liveRow(a, 'ARR', d/gs*60*1.3 + 3, late ? 20 : 40);
          if (late && (!row || S.acs.some(x => x.cs === row.cs) || (row.cs !== cs && a.alt > d*350 + 3000))) continue;   // a guess at the boundary must look like an approach here
          if (row || (d < 12 && a.alt < ELEV + 4000 && off < 45 && (airlineCs(cs) || TYPES[a.t]))) { ac = adoptArr(a, p, row); got.arr++; }
        }
      }
    }
    if (ac) { mine.push(ac); emit('spawn', ac); }
  }
  if (!mine.length || late) return;
  // whatever the real controllers had already separated is not a loss of separation for you
  const air = S.acs.filter(o => o.airborne && o.state !== 'PRE' && o.alt > 700);
  for (const a of mine) if (a.airborne) for (const b of air) if (a !== b && Math.abs(a.alt - b.alt) < 950 && dist(a.x, a.y, b.x, b.y) < 3) S.conflicts.add([a.cs, b.cs].sort().join('|'));
  const n = got.fin + got.arr + got.dep + got.gnd, part = [got.fin && `${got.fin} on final`, got.arr && `${got.arr} inbound`, got.dep && `${got.dep} climbing out`, got.gnd && `${got.gnd} on the ground`].filter(Boolean).join(', ');
  sys(`${LIVE.joined ? 'More real traffic' : 'You have taken over the real traffic'}: ${n} aircraft ${n === 1 ? 'is' : 'are'} now yours where ${n === 1 ? 'it is' : 'they are'} (${part}).`);
  LIVE.joined += n;
  if (typeof renderStrips === 'function') renderStrips(true);
}
const liveHidden = (a, p) => LIVE.bound.has(a.hex) || a.gnd || (a.alt != null && a.alt < 3500 && Math.hypot(p[0] - RADAR_REF[0], p[1] - RADAR_REF[1]) < 6) || S.acs.some(x => x.cs === a.cs);
function drawLive(){
  if (!S.running || !isLiveMode() || !LIVE.ac.size) return;
  const col = C.name === 'dark' ? '#9fb3c8' : '#5d6f84';
  for (const a of LIVE.ac.values()) {
    const ll = liveLL(a), p = xy(...ll); if (liveHidden(a, p)) continue;
    const X = sx(p[0]), Y = sy(p[1]); if (X < -60 || Y < -60 || X > W + 60 || Y > H + 60) continue;
    planeIcon(X, Y, a.trk || 0, C.name === 'dark' ? '#8ea3b8' : '#b4c2d1');   // grey, basic shape, wherever it is
    if (V.scale > 0.6) farTag(X, Y, a.cs || a.reg || a.hex, `${FL(a.alt || 0)} ${String(Math.round((a.gs || 0)/10)).padStart(2, '0')}`, '', col);
  }
}
S.listeners.push((ev, data) => {
  if (ev === 'cmd' && data && data.ac) data.ac.told = true;   // one you have worked: a real flight never replaces it
  if (ev === 'start') {
    clearInterval(LIVE.timer); LIVE.timer = null; LIVE.ac.clear(); LIVE.bound.clear(); LIVE.prev.clear(); LIVE.ok = 0; LIVE.err = 0; LIVE.joined = 0; LIVE.used = new Set();
    if (isLiveMode()) {
      if (RELAY) { pollTraffic(); LIVE.timer = setInterval(pollTraffic, 10000); }
      else sys('Real world: live aircraft positions need the traffic relay, which isn’t set up yet. Today’s real ${APT.name} flights are scheduled at their real times.');
    }
  }
});
