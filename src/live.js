// ═════════════════════════ Real world mode: today's real flights and live traffic ═════════════════════════
// The session starts at the current time. Gibraltar's arrivals and departures come from the airport's own live flight
// information (flights.json beside the page, refreshed every 15 minutes by a scheduled job in the site's repo), with
// their expected times and delays. Aircraft in the air right now come from free ADS-B networks (adsb.lol, adsb.fi)
// through a small relay, because those feeds can't be read by a web page directly. Real Gibraltar inbounds take over
// their scheduled flight when they come within range; everything else is shown as background traffic.
const RELAY_URL = 'https://clearway-relay.ventrogroup.workers.dev';                     // the Cloudflare Worker in relay/worker.js, once deployed
const RELAY = (() => { try { return localStorage.getItem('cw-relay') || RELAY_URL; } catch (e) { return RELAY_URL; } })();
const LIVE = { data: null, loadedAt: 0, session: null, rows: null, ac: new Map(), ok: 0, err: 0, timer: null, bound: new Set(), hide: new Set() };
const isLiveMode = m => /^live/.test(m || S.mode || '');
const AIRLINE_ICAO = { BA: 'BAW', U2: 'EZY', DS: 'EZS', EC: 'EJU', AT: 'RAM', LS: 'EXS', BY: 'TOM', VY: 'VLG', FR: 'RYR', IB: 'IBE', I2: 'IBS', W6: 'WZZ', TO: 'TVF', RK: 'RUK', MT: 'TCX' };
const AIRLINE_TYPE = { BAW: 'A20N', EZY: 'A20N', EJU: 'A20N', EZS: 'A20N', RAM: 'AT76', EXS: 'B738', TOM: 'B738', RYR: 'B738', VLG: 'A320', RRR: 'A400' };
const PLACE_ICAO = { 'london gatwick': 'EGKK', 'gatwick': 'EGKK', 'london heathrow': 'EGLL', 'heathrow': 'EGLL', 'london luton': 'EGGW', 'luton': 'EGGW',
  'london stansted': 'EGSS', 'manchester': 'EGCC', 'bristol': 'EGGD', 'birmingham': 'EGBB', 'edinburgh': 'EGPH', 'brize norton': 'EGVN', 'raf brize norton': 'EGVN',
  'tangier': 'GMTT', 'tangiers': 'GMTT', 'casablanca': 'GMMN', 'marrakech': 'GMMX', 'madrid': 'LEMD', 'seville': 'LEZL', 'sevilla': 'LEZL', 'malaga': 'LEMG', 'málaga': 'LEMG',
  'paris': 'LFPG', 'paris cdg': 'LFPG', 'nice': 'LFMN', 'farnborough': 'EGLF' };
Object.assign(AP, { EGBB: [52.4539, -1.7480, 'Birmingham'], EGPH: [55.9500, -3.3725, 'Edinburgh'], GMMX: [31.6069, -8.0363, 'Marrakech'] });
const csOf = fl => { fl = fl.toUpperCase().replace(/\s/g, ''); let m = fl.match(/^([A-Z]{3})(\d{1,4}[A-Z]{0,2})$/); if (m) return fl; m = fl.match(/^([A-Z0-9]{2})(\d{1,4}[A-Z]?)$/); return m && AIRLINE_ICAO[m[1]] ? AIRLINE_ICAO[m[1]] + m[2] : fl; };
const placeOf = p => PLACE_ICAO[p.toLowerCase().trim()] || p;
const typeOf = cs => AIRLINE_TYPE[cs.slice(0, 3)] || 'A320';
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
function liveSession(now = Date.now()){
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
  return { sched, residents, T };
}
// session picker: today's real flights instead of the timetable slot
function renderLiveSlots(){
  const el = $('slotList'); el.innerHTML = '<span class="dimmer">Loading today’s flights from Gibraltar Airport…</span>';
  liveLoad().then(() => {
    if (!isLiveMode($('trafficSel').value)) return;
    const T = liveToday();
    if (!T) { el.innerHTML = '<span class="dimmer">Today’s flight information isn’t available on this page (it needs the site’s own web address). The session will use the timetable instead.</span>'; return; }
    const upd = LIVE.data.updated ? ` · updated ${LIVE.data.updated.substr(11, 5)}Z` : '';
    const row = r => `<span class="slot ${r.kind}${r.done || r.rel < -5 ? ' past' : ''}"><b>${r.cs}</b> ${r.kind === 'ARR' ? r.ap + ' › LXGB' : 'LXGB › ' + r.ap} <i>${zHM(Date.UTC(2026, 0, 1) + r.tm*60e3)}Z${r.cancelled ? ' cancelled' : ''}</i></span>`;
    el.innerHTML = `<span class="dimmer" style="flex-basis:100%">Real flights today from Gibraltar Airport${upd}. Your session starts now (${zHM(Date.now())}Z).</span>` + [...T.arr, ...T.dep].sort((a, b) => a.tm - b.tm).map(row).join('');
  });
}

// ── live traffic from the relay ──
async function pollTraffic(){
  if (!RELAY || !S.running || !isLiveMode()) return;
  try {
    const r = await fetch(RELAY.replace(/\/$/, '') + '/traffic?lat=36.15&lon=-5.35&r=200', { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    const j = await r.json(), now = Date.now();
    for (const a of j.ac || []) { a.ts = now - (a.seen || 0)*1000; LIVE.ac.set(a.hex, a); }
    for (const [k, a] of LIVE.ac) if (now - a.ts > 90e3) LIVE.ac.delete(k);
    if (!LIVE.ok) sys(`Live traffic connected: ${LIVE.ac.size} aircraft within 200 NM (${j.src || 'ADS-B'}).`);
    LIVE.ok = now; LIVE.err = 0; liveBind();
  } catch (e) { if (++LIVE.err === 3) sys('Live traffic feed not responding; retrying.', true); }
}
const liveLL = a => { const dt = Math.min(45, (Date.now() - a.ts)/1000), d = (a.gs || 0)*dt/3600, tr = (a.trk || 0)*D2R; return [a.lat + d*Math.cos(tr)/60, a.lon + d*Math.sin(tr)/(60*Math.cos(a.lat*D2R))]; };
// a real aircraft inbound to Gibraltar takes over its scheduled flight as a pending track at its real position
function liveBind(){
  for (const [hex, a] of LIVE.ac) {
    if (LIVE.bound.has(hex) || a.gnd || !a.alt) continue;
    const ll = liveLL(a), p = xy(...ll), dGbr = Math.hypot(p[0] - GBR[0], p[1] - GBR[1]);
    if (dGbr > 90 || dGbr < 12) continue;
    const toGbr = brg(p[0], p[1], ...GBR), off = Math.abs(((a.trk - toGbr) % 360 + 540) % 360 - 180);
    const byName = S.sched.find(f => f.k === 'ARR' && f.cs === a.cs && !f.liveHex);
    const byPath = !byName && off < 25 && a.alt < 26000 && (a.vs || 0) <= 300 && S.sched.find(f => f.k === 'ARR' && f.real && !f.liveHex && f.cs.slice(0, 3) === a.cs.slice(0, 3) && Math.abs(f.m*60 + 15*60 - S.t - dGbr/Math.max(150, a.gs || 250)*3600) < 40*60);
    const f = byName || byPath; if (!f) continue;
    let ac = S.acs.find(x => x.cs === f.cs);
    if (ac && ac.state !== 'PRE') { f.liveHex = hex; LIVE.bound.add(hex); continue; }   // already yours: just hide the live copy
    if (!ac) { f.spawned = true; ac = spawnArrival({ ...f, m: S.t/60 + PRE_LEAD/60 + 1 }); }
    if (!ac) continue;
    const gateNow = ['E', 'W', 'S'].sort((g1, g2) => dist(...ENTRY[g1], ...p) - dist(...ENTRY[g2], ...p))[0];
    ac.gate = gateNow; ac.x = p[0]; ac.y = p[1]; ac.alt = Math.max(ENTRY_ALT[gateNow], a.alt); ac.gs = a.gs || 300; ac.ias = Math.min(300, ac.gs);
    ac.hdg = ac.trk = a.trk || ac.hdg; ac.preAt = S.t + Math.max(30, dist(...p, ...ENTRY[gateNow])/Math.max(150, ac.gs)*3600);
    if (a.cs && a.cs !== ac.cs) { ac.real = a.cs; }
    ac.liveHex = hex; f.liveHex = hex; LIVE.bound.add(hex);
    FAR.list = FAR.list.filter(g => g.cs !== f.cs);
    sys(`${f.cs} is a real flight${a.cs && a.cs !== f.cs ? ` (callsign ${a.cs})` : ''}: picked up ${Math.round(dGbr)} NM out at ${altShort(Math.round(a.alt/100)*100)}.`);
  }
}
const liveHidden = (a, p) => LIVE.bound.has(a.hex) || a.gnd || (a.alt != null && a.alt < 3500 && Math.hypot(p[0] - GBR[0], p[1] - GBR[1]) < 6) || S.acs.some(x => x.cs === a.cs);
function drawLive(){
  if (!S.running || !isLiveMode() || !LIVE.ac.size) return;
  const tags = V.scale > 2.5, col = C.name === 'dark' ? '#9fb3c8' : '#5d6f84';
  for (const a of LIVE.ac.values()) {
    const ll = liveLL(a), p = xy(...ll); if (liveHidden(a, p)) continue;
    const X = sx(p[0]), Y = sy(p[1]); if (X < -60 || Y < -60 || X > W + 60 || Y > H + 60) continue;
    const inRadar = Math.hypot(p[0] - GBR[0], p[1] - GBR[1]) <= RADAR_NM;
    if (inRadar) {
      cx.strokeStyle = col; cx.lineWidth = 1.2; cx.strokeRect(X - 3, Y - 3, 6, 6);
      const L = (a.gs || 0)/60*V.scale; cx.beginPath(); cx.moveTo(X, Y); cx.lineTo(X + Math.sin((a.trk || 0)*D2R)*L, Y - Math.cos((a.trk || 0)*D2R)*L); cx.stroke();
      if (tags) { cx.font = `500 10.5px ${FONT_D}`; cx.fillStyle = col; cx.fillText(a.cs || a.reg || a.hex, X + 7, Y - 6); cx.fillText(`${FL(a.alt || 0)} ${a.t || ''}`, X + 7, Y + 6); }
    } else {
      planeIcon(X, Y, a.trk || 0, C.name === 'dark' ? '#8ea3b8' : '#b4c2d1');
      if (V.scale > 0.6) farTag(X, Y, a.cs || a.reg || a.hex, `${FL(a.alt || 0)} ${String(Math.round((a.gs || 0)/10)).padStart(2, '0')}`, `${a.t || '----'} LIVE`, col);
    }
  }
}
S.listeners.push(ev => {
  if (ev === 'start') {
    clearInterval(LIVE.timer); LIVE.timer = null; LIVE.ac.clear(); LIVE.bound.clear(); LIVE.ok = 0; LIVE.err = 0;
    if (isLiveMode()) {
      if (RELAY) { pollTraffic(); LIVE.timer = setInterval(pollTraffic, 10000); }
      else sys('Real world: live aircraft positions need the traffic relay, which isn’t set up yet. Today’s real Gibraltar flights are scheduled at their real times.');
    }
  }
});
