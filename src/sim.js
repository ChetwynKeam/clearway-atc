"use strict";
// ═══════════════════════════════════════════════════════════════════════════════════════
// Clearway ATC simulator — simulation engine (airport facts come from src/airports/<icao>.js)
// Sources: UK Mil AIP AD 2 LXGB (AD 2.2–2.14, charts B1, D1, E1, F1, H1, K1, K2). Coast: GSHHG full
// resolution, with the aerodrome shoreline traced from chart D1.
// ═══════════════════════════════════════════════════════════════════════════════════════

// flights for a session starting at hour h (UTC) on day d (0 = Monday): arrivals appear about 15 min before landing,
// departures ask for start-up 6 min before off-blocks; the session runs about 75 minutes
function timetableFlights(d, h){
  const day = String(d + 1), t0 = h*60, out = [];
  for (const [ac, o, ta, dc, dd, td, t, days, stand] of TIMETABLE) {
    if (!days.includes(day)) continue;
    const reg = REGS[t];
    if (ac) { const m = hm(ta) - 15 - t0; if (m >= -10 && m <= 62) out.push({ cs: ac, t, k: 'ARR', o, gate: gateFor(o), m: Math.max(0, m), at: ta, ...(reg ? { reg } : {}) }); }
    if (dc) { const m = hm(td) - 6 - t0; if (m >= 0 && m <= 70) out.push({ cs: dc, t, k: 'DEP', d: dd, gate: gateFor(dd), m, at: td, ...(stand ? { stand } : {}), ...(reg ? { reg } : {}) }); }
  }
  return out.sort((a,b) => a.m - b.m);
}
// what is on the ground and in the air for a session: arrivals carry their turnaround departure; aircraft already parked
// at the start (inbound landed earlier, or a departure with no inbound today) are residents
function timetableSession(d, h){
  const day = String(d + 1), t0 = h*60, sched = [], residents = [];
  for (const [ac, o, ta, dc, dd, td, t, days, stand] of TIMETABLE) {
    if (!days.includes(day)) continue;
    const reg = REGS[t] ? { reg: REGS[t] } : {}, arrM = ac ? hm(ta) - t0 : null, depM = dc ? hm(td) - t0 : null;
    if (ac && arrM - 15 >= -10) {                                                     // the rest of the day's arrivals
      sched.push({ cs: ac, t, k: 'ARR', o, gate: gateFor(o), m: Math.max(0, arrM - 15), at: ta, ...reg, turn: dc ? { cs: dc, d: dd, depM, at: td, stand } : null });
    } else if ((!ac || arrM - 15 < -10) && dc && depM > 0) {
      residents.push({ cs: dc, t, k: 'RES', d: dd, gate: gateFor(dd), m: 0, depM, at: td, stand, ...reg });
    } else if (ac && !dc && arrM - 15 < -10) {
      residents.push({ cs: ac, t, k: 'RES', o, gate: gateFor(o), m: 0, depM: null, at: ta, ...reg });   // arrived earlier, staying
    }
  }
  for (const [cs, t, stand, days] of LONG_STAY) if (days.includes(day)) residents.push({ cs, t, k: 'RES', o: 'LXGB', gate: 'E', m: 0, depM: null, stand, longStay: true });
  return { sched, residents };
}
const SESSION_HOURS = APT.sessionHours || Array.from({ length: 16 }, (_, i) => i + 6); // 06Z to 21Z, the civil operating day (New York: its own)
function buildSchedule(mode, day = 0, hour = 17){
  if (EXERCISES[mode]) return EXERCISES[mode].sched.map(x => ({...x}));
  const LS = /^live/.test(mode) && typeof liveSession === 'function' ? liveSession(Date.now(), mode) : null;   // Real world: today's real flights
  const T = LS || timetableSession(day, Math.floor(hour)), s = [...T.residents, ...T.sched];
  if (mode !== 'real' && mode !== 'live') {
    // busier sessions add charters, positioning flights and business jets on top of the timetable
    const used = new Set(s.map(x => x.cs)), extra = EXTRA.filter(x => !used.has(x.cs));
    const n = mode === 'event' ? extra.length : Math.min(8, extra.length), span = mode === 'event' ? 50 : 66;
    extra.slice(0, n).forEach((x,i) => s.push({ ...x, m: Math.max(2, Math.round(4 + i*span/n + rnd(-2,2))) }));
    if (mode === 'event') s.forEach(x => { if (x.k === 'ARR' && x.m > 0) x.m = Math.round(x.m*0.7); });
  }
  return s.sort((a,b) => a.m - b.m);
}

function parseMetar(m){
  m = m.trim().toUpperCase().replace(/\s+/g,' ');
  const w = { raw: m, dir: 0, spd: 0, gust: 0, vrb: false, vis: 9999, ceil: 9999, qnh: 1013, inhg: 29.92, temp: 15, dew: 10, wx: [], cb: false, clouds: [] };
  for (const tok of m.split(' RMK ')[0].split(' ')) {   // remarks (US METARs) are not weather
    let r;
    if ((r = tok.match(/^(\d{3}|VRB)(\d{2,3})(G(\d{2,3}))?(KT|MPS)$/))) { const f = r[5]==='MPS' ? 1.944 : 1; w.vrb = r[1]==='VRB'; w.dir = w.vrb ? 0 : +r[1]; w.spd = Math.round(+r[2]*f); w.gust = r[4] ? Math.round(+r[4]*f) : 0; }
    else if (/^\d{4}$/.test(tok)) w.vis = +tok;
    else if ((r = tok.match(/^(\d{1,2})SM$/))) w.vis = Math.min(9999, +r[1]*1609);
    else if ((r = tok.match(/^M?(\d)\/(\d{1,2})SM$/))) { w.vis = Math.round(((tok[0] === 'M' ? 0.5 : 1)*+r[1]/+r[2] + (w.whole || 0))*1609); delete w.whole; }   // 1/2SM, M1/4SM (US)
    else if (/^\d$/.test(tok)) w.whole = +tok;   // the 2 of "2 1/2SM"
    else if (tok === 'CAVOK') { w.vis = 9999; w.ceil = 9999; }
    else if ((r = tok.match(/^(BKN|OVC|VV)(\d{3})(CB|TCU)?$/))) { w.ceil = Math.min(w.ceil, +r[2]*100); if (r[3]) w.cb = true; w.clouds.push(tok); }
    else if ((r = tok.match(/^(FEW|SCT)(\d{3})(CB|TCU)?$/))) { if (r[3]) w.cb = true; w.clouds.push(tok); }
    else if ((r = tok.match(/^Q(\d{4})$/))) { w.qnh = +r[1]; w.inhg = Math.round(+r[1]/33.8639*100)/100; }
    else if ((r = tok.match(/^A(\d{4})$/))) { w.qnh = Math.round(+r[1]/100*33.8639); w.inhg = +r[1]/100; }   // the altimeter setting in inches (US)
    else if ((r = tok.match(/^(M?\d{2})\/(M?\d{2})$/))) { w.temp = +r[1].replace('M','-'); w.dew = +r[2].replace('M','-'); }
    else if (/^[-+]?(VC)?(TS|SH|FZ|MI|BC)?(RA|DZ|SN|FG|BR|HZ|GR|GS)+$/.test(tok) || /^[-+]?(VC)?TS$/.test(tok)) w.wx.push(tok);
  }
  if (w.wx.some(x => x.includes('TS'))) w.cb = true;
  delete w.whole;
  return w;
}
function windComp(w, crs){ const d = angDiff(crs, w.dir); const g = w.gust || w.spd; return { head: w.spd*Math.cos(d*D2R), cross: Math.abs(w.spd*Math.sin(d*D2R)), headG: g*Math.cos(d*D2R), crossG: Math.abs(g*Math.sin(d*D2R)) }; }

// ═════════════════════════ state ═════════════════════════
const S = {
  t: 0, start: Date.UTC(2026, 9, 4, 18, 55, 0), speed: 1, paused: true, running: false,
  wx: parseMetar(WX_PRESETS[APT.defWx].metar), rwy: APT.defRwy, atis: 'K', mode: 'summer',
  sched: [], acs: [], sel: null,
  xing: { st: APT.xing ? 'OPEN' : 'CLOSED', t: 0, queue: 0, totalClosed: 0 },
  score: { landed: 0, departed: 0, ga: 0, div: 0, los: 0, infr: 0, incidents: 0, pts: 0 },
  view: { cx: 0, cy: -2, scale: 14, name: 'app' }, showProc: true, voice: false, conflictSet: new Set(), conflicts: new Set(),
  listeners: []
};
const emit = (ev, data) => { for (const f of S.listeners) try { f(ev, data); } catch(e) {} };
// the departure runway: the runway in use, unless the airport departs the other way (Innsbruck lands 26, departs 08)
const depRw = () => S.depRwy || S.rwy;
// ── runways. A one-runway airport is described by its profile's globals (rm, mOf, offOf, RU, RW_LO/RW_HI, TURN_W/E);
// an airport with several runways (New York JFK) lists them in APT.runways, each with its own frame along the runway
// (metres from its low end, offset to the left), so landing and departing traffic can use different pavements.
const RWYS = APT.runways || [{ id: 'R', lo: RW_LO, hi: RW_HI, rm, mOf, offOf, RU, TURN_W, TURN_E, TURN_END, roll: APT.roll }];
const RW_ENDS = RWYS.flatMap(r => [r.lo, r.hi]);
const rwyOf = rw => RWYS.find(r => r.lo === rw || r.hi === rw) || RWYS[0];
const rwyById = id => RWYS.find(r => r.id === id) || RWYS[0];
const holdRwy = hp => rwyById(HOLDS[hp] && HOLDS[hp].on);
// intermediate holding points along the taxiways (APT.ihps, from the aerodrome chart): { id, node } or { id, tw, at }
const IHPS = {};
for (const h of APT.ihps || []) {
  const node = h.node || splitAt('IHP_' + h.id, h.at, h.tw); if (!node || !GN[node]) continue;
  const tw = h.tw || (GN[node].adj[0] && GN[node].adj[0][1].tw), nb = GN[node].adj.filter(([, e]) => e.tw === tw).map(([v]) => GN[v].p);
  const dir = nb.length > 1 ? brg(...nb[0], ...nb[1]) : nb.length ? brg(...GN[node].p, ...nb[0]) : 0;
  IHPS[h.id] = { id: h.id, node, tw, dir };
}
// any named holding point: a runway holding point or an intermediate one
const holdPt = id => HOLDS[id] ? { id, node: HOLDS[id].node, rwy: true } : IHPS[id] ? { id, node: IHPS[id].node, rwy: false } : null;
// something on the pavement of the runway that rw names (either direction)
const onRunway = (o, rw) => o.onRwy && (o.rwyId || RWYS[0].id) === rwyOf(rw).id;
// runways in use for landing or departure: taxiing traffic holds short of these until cleared to cross
const activeRwy = id => rwyOf(S.rwy).id === id || rwyOf(depRw()).id === id;
const rwyName = id => { const R = rwyById(id); return [S.rwy, depRw()].find(r => rwyOf(r) === R) || R.lo + '/' + R.hi; };

// ── phraseology. ICAO (UK and European) wording unless the profile overrides it (APT.phr: New York uses the FAA's).
// a holding point's spoken name: "T3" is Tango 3
const hpWords = id => { id = id.replace(/~\d+$/, ''); return PHON[id] || id.replace(/^([A-Z]+)(\d+)$/, (m, l, d) => (PHON[l] || l) + ' ' + d); };
const PH = Object.assign({
  altim: () => `QNH ${S.wx.qnh}`,
  alt: (a, up) => [`${up ? 'climb' : 'descend'} ${altWords(a)}`, `${up ? 'climb' : 'descend'} ${altShort(a)}`],
  via: a => [`descend via the procedure to ${altWords(a)}`, `descending via the procedure, ${altShort(a)}`],
  speed: (s, ac) => [`speed ${s} knots`, `speed ${s}`],
  taxi: (ac, hp, vw) => [`taxi to holding point ${PHON[hp]}${viaWords(vw)}, runway ${depRw()}, ${PH.altim()}`, `holding point ${PHON[hp]}${viaWords(vw)}, runway ${depRw()}, ${PH.altim()}`],
  atHold: (ac, hp) => `holding point ${PHON[hp]}, ready for departure`,
  lineUp: (ac, hp) => { const lu = APT.lineUpWords ? APT.lineUpWords(hp) : 'line up and backtrack'; return [`via ${PHON[hp]}, ${lu} runway ${depRw()}`, `${lu} runway ${depRw()}`]; },
  cto: (ac, sid, chg) => [`${chg ? 'amended clearance, ' : ''}${sidSpoken(sid)} departure, runway ${depRw()}, cleared for takeoff, ${windPhrase()}`, `${chg ? 'amended, ' : ''}${sidSpoken(sid)}, cleared for takeoff runway ${depRw()}`],
  ctl: (ac, rw) => [`runway ${rw}, cleared to land, ${windPhrase()}`, `cleared to land runway ${rw}`],
  push: (ac, dn, face) => [`cleared to ${dn} via ${sidSpoken(ac.sid)} departure, climb ${altWords(APT.initClimb)}, squawk ${ac.sqk}, start-up and push back approved, facing ${APT.faceWord(face)}, ${PH.altim()}`,
    `cleared ${dn}, ${sidSpoken(ac.sid)}, ${altShort(APT.initClimb)}, squawk ${ac.sqk}, start and push approved facing ${APT.faceWord(face)}, ${PH.altim()}`],
  pull: (ac, st) => [`pull forward onto ${APT.standWord || 'stand'} ${st.id}, call me for push back`, `pulling forward onto ${APT.standWord || 'stand'} ${st.id}`],
  startReq: ac => `${APT.tower[0]}, stand ${ac.stand.id}, ${ac.perf.name} to ${ac.d}, information ${phonetic(S.atis)}, request start-up and push back`,
  checkIn: ac => `${APT.radar[0]}, ${greet()}, ${altShort(Math.round(ac.alt/100)*100)} descending ${altShort(ac.tgtAlt)}, inbound ${ac.route[0]}, information ${phonetic(S.atis)}`,
  depCall: ac => `${(APT.depRadar || APT.radar)[0]}, passing ${Math.round(ac.alt/100)*100} feet climbing ${altShort(ac.tgtAlt)}, ${ac.onSid && ac.sid ? sidSpoken(ac.sid) + ' departure' : 'heading ' + hdg3(ac.hdg)}`,
  cross: (ac, rw) => [`cross runway ${rw}`, `crossing runway ${rw}`],
  vacated: ac => `runway vacated via ${PHON[ac.exit] || ac.exit.replace(/~\d+$/, "")}, request taxi${ac.stand ? ' to stand ' + ac.stand.id : ''}`,
  taxiIn: (ac, st, vw) => [`taxi to stand ${st.id}${viaWords(vw)}`, `stand ${st.id}${viaWords(vw)}`],
  taxiHold: (ac, h, vw) => [`taxi to holding point ${hpWords(h.id)}${viaWords(vw)}`, `holding point ${hpWords(h.id)}${viaWords(vw)}`],
  atHoldPt: (ac, h) => `holding at ${hpWords(h.id)}`,
  holdShort: (ac, rw) => `holding short of runway ${rw}`
}, APT.phr || {});

// ═════════════════════════ R/T log & speech ═════════════════════════
const logEl = document.getElementById('log');
const zt = t => new Date(S.start + t*1000).toISOString().substr(11,8);
function log(cls, text, who){
  const div = document.createElement('div'); div.className = 'ln ' + cls;
  const tm = document.createElement('span'); tm.className = 'tm'; tm.textContent = zt(S.t).slice(0,5);
  const wh = document.createElement('span'); wh.className = 'who'; wh.textContent = who || (cls === 'sys' || cls === 'bad' ? 'SYSTEM' : '');
  const tx = document.createElement('span'); tx.className = 'tx'; tx.textContent = text;
  div.append(tm, wh, tx);
  logEl.appendChild(div); while (logEl.childNodes.length > 300) logEl.removeChild(logEl.firstChild);
  logEl.scrollTop = logEl.scrollHeight;
}
let voices = [];
function loadVoices(){ try { voices = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang)); } catch(e) {} }
try { speechSynthesis.onvoiceschanged = loadVoices; loadVoices(); } catch(e) {}
function hash(s){ let h = 0; for (const c of String(s)) h = (h*31 + c.charCodeAt(0))|0; return Math.abs(h); }
function say(text, who){
  if (!S.voice) return;
  try {
    const u = new SpeechSynthesisUtterance(text.replace(/FL(\d+)/g, (m,a) => 'flight level '+a.split('').map(d=>DIG[d]).join(' ')));
    if (voices.length) u.voice = who === 'atc' ? voices[0] : voices[1 + hash(who) % Math.max(1, voices.length-1)] || voices[0];
    u.rate = 1.15; u.pitch = who === 'atc' ? 1 : 0.8 + (hash(who) % 35)/100;
    speechSynthesis.speak(u);
  } catch(e) {}
}
function atc(ac, text){ const line = `${spoken(ac.cs)}, ${text}`; log('atc', line, ac.freq === 'TWR' ? 'TOWER' : 'RADAR'); say(line, 'atc'); }
// Unprompted calls (not read-backs) now and then collide with another station and are blocked; the crew calls again.
let inCmd = false, lastCallT = -99;
function pilot(ac, text, again){
  if (!inCmd && !again && S.running && !ac.emerg && (S.t - lastCallT < 3 ? Math.random() < 0.6 : Math.random() < 0.025)) {
    log('blk', 'two stations transmitting at once, blocked', '· · ·'); if (typeof radioFx === 'function') radioFx('blocked');
    (S.recalls ||= []).push({ at: S.t + rnd(8, 16), ac, text }); lastCallT = S.t; return;
  }
  if (!inCmd) lastCallT = S.t;
  const line = `${text}, ${spoken(ac.cs)}`; log('plt', line, ac.cs); setTimeout(() => say(line, ac.cs), 300);
}
function sys(text, bad){ log(bad ? 'bad' : 'sys', text); }
// landline coordination with Sevilla / Casablanca (not on the frequency)
function coord(text, who){ log('coord', text, who); say(text, 'tel:' + who); }
// departures need a release from the next unit before take-off, unless the airport only asks for some (APT.needRel:
// New York calls for release only on flights under a flow restriction)
const needRel = ac => !APT.needRel || APT.needRel(ac);
function requestRelease(ac){
  const who = relUnit(ac), sid = sidName(ac.gate, depRw());
  ac.rel = { st: 'REQ', at: S.t + rnd(35, 110) };
  coord(`${who}, ${APT.coordName}, request release ${ac.cs}, ${ac.t} to ${ac.d}, ${sid}, runway ${depRw()}`, APT.coordName.toUpperCase());
}
function stepRelease(ac){
  const R = ac.rel, who = relUnit(ac);
  if (R.st === 'REQ' && S.t >= R.at) {
    if (Math.random() < 0.2) { const t = S.t + rnd(120, 240); R.nb = t + (60 - ((S.start/1000 + t) % 60)); }   // not before a whole minute
    R.st = 'OK'; R.until = (R.nb || S.t) + 600;
    coord(`${APT.coordName}, ${who}, ${ac.cs} released${R.nb ? ', not before ' + zt(R.nb).slice(0,5) : ''}, valid until ${zt(R.until).slice(0,5)}`, who.toUpperCase());
    if (S.sel === ac) renderSel();
  }
  if (R.st === 'OK' && ac.ground && !ac.cto && S.t > R.until) { R.st = 'EXP'; sys(`${ac.cs}: the ${who} release has expired. Request a new one with REL.`, true); if (S.sel === ac) renderSel(); }
}
const altWords = a => a > APT.ta ? 'flight level '+Math.round(a/100) : 'altitude '+a.toLocaleString('en-GB')+' feet';
const altShort = a => a > APT.ta ? 'FL'+Math.round(a/100) : a.toLocaleString('en-GB')+' feet';
const hdg3 = h => String(Math.round(h) % 360 || 360).padStart(3,'0');

// ═════════════════════════ aircraft ═════════════════════════
let sqk = 4610;
class Aircraft {
  constructor(f){
    Object.assign(this, f);
    this.perf = TYPES[f.t]; this.hist = []; this.histT = 0;
    this.mode = 'NAV'; this.route = []; this.turnDir = 0; this.tgtSpd = null; this.spdAssigned = false;
    this.app = null; this.ctl = false; this.cto = false; this.ground = false; this.onRwy = false; this.path = null;
    this.state = ''; this.need = null; this.handed = false; this.freq = 'RAD';
    this.ias = 0; this.alt = 0; this.vs = 0; this.hdg = 0; this.gs = 0; this.trk = 0; this.tgtAlt = null; this.cleared = null;
    this.sqk = String(sqk++).replace(/[89]/g, '7');
  }
  unit(){ return this.freq === 'TWR' ? APT.tower[0] : APT.radar[0]; }
  get airborne(){ return !this.ground; }
}

// arrivals show on radar about 35 NM beyond the boundary as pending tracks (not on frequency, no control) and call
// Gibraltar Radar when they reach the entry point inside the radar rings
const PRE_NM = 35, PRE_LEAD = 6.5*60;
const greet = () => { const h = ((new Date(S.start + S.t*1000).getUTCHours() + APT.utcOff) % 24 + 24) % 24; return h < 12 ? 'good morning' : h < 18 ? 'good afternoon' : 'good evening'; };
function spawnArrival(f){
  const ac = new Aircraft(f); ac.kind = 'ARR';
  const e = ENTRY[f.gate], first = WP[ARR_ROUTE[f.gate][S.rwy][0]];
  const left = f.m*60 - S.t;
  if (f.m > 0 && left > 5) { // pending: outside the boundary, inbound to the entry point
    const L = Math.hypot(e[0] - RADAR_REF[0], e[1] - RADAR_REF[1]), u = [(e[0] - RADAR_REF[0])/L, (e[1] - RADAR_REF[1])/L], frac = clamp(left/PRE_LEAD, 0, 1);
    ac.x = e[0] + u[0]*PRE_NM*frac; ac.y = e[1] + u[1]*PRE_NM*frac;
    // another pending track on top of it (the same minute, or two flows sharing the entry point): in trail, 8 NM behind
    for (let k = 0; k < 6 && S.acs.some(o => o.state === 'PRE' && Math.hypot(o.x - ac.x, o.y - ac.y) < 5); k++) { ac.x += u[0]*8; ac.y += u[1]*8; }
    ac.alt = ENTRY_ALT[f.gate] + (PRE_ALT[f.gate] - ENTRY_ALT[f.gate])*frac; ac.ias = 300; ac.gs = 330;
    ac.hdg = ac.trk = brg(ac.x, ac.y, ...e); ac.state = 'PRE'; ac.preAt = f.m*60; ac.route = []; ac.freq = 'PRE';
    S.acs.push(ac); emit('spawn', ac);
    return ac;
  }
  const d0 = f.m === 0 ? 0.55 : 0;                     // the first arrival starts part-way in
  ac.x = e[0] + (first.p[0]-e[0])*d0; ac.y = e[1] + (first.p[1]-e[1])*d0;
  ac.alt = d0 ? (APT.firstAlt ? APT.firstAlt(f.gate) : 9000) : ENTRY_ALT[f.gate];
  // another arrival already starting there (busy hours: New York, where two arrival flows share an entry fix):
  // this one starts 8 NM further out and 1,000 ft higher, as many times as it takes to be clear of everyone
  { const L = Math.hypot(e[0] - RADAR_REF[0], e[1] - RADAR_REF[1]), u = [(e[0] - RADAR_REF[0])/L, (e[1] - RADAR_REF[1])/L];
    for (let k = 0; k < 6 && entryBusy(ac, [ac.x, ac.y], ac.alt, 8, 3000); k++) { ac.x += u[0]*8; ac.y += u[1]*8; ac.alt += 1000; } }
  S.acs.push(ac);
  makeInbound(ac);
  emit('spawn', ac);
  return ac;
}
function makeInbound(ac, keepAlt){
  const first = WP[ARR_ROUTE[ac.gate][S.rwy][0]];
  ac.tgtAlt = ac.cleared = keepAlt ? Math.round(ac.alt/100)*100 : APT.inboundAlt(ac.gate); ac.freq = 'RAD';
  ac.ias = 260; ac.hdg = brg(ac.x, ac.y, ...first.p); ac.trk = ac.hdg; ac.state = 'INBOUND';
  ac.route = ARR_ROUTE[ac.gate][S.rwy].slice();
  pilot(ac, PH.checkIn(ac));
  ac.need = 'Initial call';
}
// someone already near this point (within nm) and level with it (within ft): a new arrival can't be handed over there yet
const entryBusy = (ac, p, alt, nm = 6, ft = 1000) => S.acs.some(o => o !== ac && o.airborne && o.state !== 'PRE' && Math.hypot(o.x - p[0], o.y - p[1]) < nm && Math.abs(o.alt - alt) < ft);
function stepPending(ac, dt){
  const e = ENTRY[ac.gate], d = dist(ac.x, ac.y, ...e);
  // the previous sector hands it over in trail: it slows down outside the entry point until the one ahead has moved on
  const busy = d < 15 && entryBusy(ac, e, ENTRY_ALT[ac.gate], 8, 3000);   // 8 NM in trail, whatever the one ahead is descending to
  if (busy) ac.gs = Math.max(200, ac.gs - 3*dt); else if (ac.gs < 330) ac.gs = Math.min(330, ac.gs + 3*dt);
  const mv = ac.gs/3600*dt;
  ac.hdg = ac.trk = brg(ac.x, ac.y, ...e);
  if (busy && d <= mv + 0.5 && S.t < ac.preAt + 600) return;   // waits at the boundary (at most ten minutes)
  if (busy ? S.t >= ac.preAt + 600 : d <= mv + 0.05 || S.t >= ac.preAt + 90) {
    // still blocked after the wait: handed over 1,000 ft above the traffic, and it stays there until you descend it
    ac.x = e[0]; ac.y = e[1]; ac.alt = ENTRY_ALT[ac.gate]; let up = false; while (entryBusy(ac, e, ac.alt)) { ac.alt += 1000; up = true; }
    makeInbound(ac, up); return;
  }
  ac.x += (e[0] - ac.x)/d*mv; ac.y += (e[1] - ac.y)/d*mv;
  const left = Math.max(1, ac.preAt - S.t); ac.alt = Math.max(ENTRY_ALT[ac.gate], ac.alt - (ac.alt - ENTRY_ALT[ac.gate])*dt/left);
  ac.vs = -(ac.alt - ENTRY_ALT[ac.gate])/left*60;
}
function spawnDeparture(f){
  const ac = new Aircraft(f); ac.kind = 'DEP'; ac.freq = 'TWR';
  const wantSouth = isMil(ac);
  const st = STANDS.find(s => s.id === f.stand && !s.occ) || (APT.standFor && APT.standFor(ac)) || STANDS.find(s => !s.occ && (wantSouth ? s.area === 'south' : s.area !== 'south')) || STANDS.find(s => !s.occ);
  if (!st) return null;
  st.occ = ac; ac.stand = st;
  ac.x = st.p[0]; ac.y = st.p[1]; ac.hdg = st.hdg;
  ac.ground = true; ac.alt = ELEV; ac.state = 'PARKED';
  ac.reqAt = S.t + (f.m === 0 ? 8 : rnd(10, 40));
  S.acs.push(ac);
  emit('spawn', ac);
  return ac;
}
const isBiz = ac => ac.perf.wake === 'L' || ac.t === 'GLF6' || ac.t === 'C56X';
// an aircraft already on the ground when the session opens. Airliners with a long wait sit on a remote stand (south or
// north apron) and are towed to a terminal stand about 35 minutes before departure for the turnaround.
function spawnResident(f){
  const ac = new Aircraft(f); ac.freq = 'TWR'; ac.ground = true; ac.alt = ELEV;
  const wait = f.depM == null ? Infinity : f.depM;
  const remote = !isMil(ac) && !isBiz(ac) && wait > 45;
  const order = isMil(ac) ? ['south'] : isBiz(ac) ? ['north', 'civil'] : remote ? ['south', 'north', 'civil'] : ['civil', 'north'];
  let st = (!remote || APT.standFor) && f.stand && STANDS.find(s => s.id === f.stand && !s.occ);
  if (!st && APT.standFor) st = APT.standFor(ac);   // New York: the airline's terminal, no remote stands or tows
  for (const a of order) if (!st) st = STANDS.find(s => !s.occ && s.area === a);
  if (!st) return null;
  st.occ = ac; ac.stand = st; ac.x = st.p[0]; ac.y = st.p[1]; ac.hdg = st.hdg;
  if (f.depM == null) { ac.kind = 'ARR'; ac.state = 'ONSTAND'; ac.doneAt = Infinity; }
  else { ac.kind = 'DEP'; ac.state = 'PARKED'; ac.reqAt = Math.max(8, (f.depM - 6)*60); if (remote && st.area !== 'civil') ac.tow = { at: Math.max(20, (f.depM - 35)*60), pref: f.stand }; }
  S.acs.push(ac); emit('spawn', ac);
  return ac;
}
// after an arrival is on stand it becomes its own turnaround departure (new callsign), or stays parked
function turnRound(ac){
  const tr = ac.turn;
  if (!tr) { ac.doneAt = ac.stand ? Infinity : S.t + 120; return; }
  const was = ac.cs;
  Object.assign(ac, { cs: tr.cs, kind: 'DEP', d: tr.d, gate: gateFor(tr.d), o: undefined, state: 'PARKED', need: null, freq: 'TWR', turn: null,
    app: null, ctl: false, checked: false, shearChecked: false, warnedCtl: false, warned15: false, warned10: false, pushed: false, leftStand: false,
    hp: null, cto: false, exit: null, backtrack: false, taxiVia: [], face: null, held: false, handed: false, onRwy: false, path: null, xok: null, xing: null, xcross: null, hsAt: null });
  ac.reqAt = Math.max(S.t + 20*60, (tr.depM - 6)*60);
  sys(`${was} is on stand ${ac.stand ? ac.stand.id : ''} and turns round as ${tr.cs} to ${tr.d}, off-blocks ${tr.at}Z.`);
  emit('turnround', ac);
}
function towPath(ac, to){
  const from = ac.stand, pts = [from.lp];
  const add = r => { if (r) for (const id of r.nodes.slice(1)) pts.push(GN[id].p); };
  if (from.area === 'south' && to.area !== 'south') {
    add(route(from.node, HOLDS.C.node)); pts.push(GN[HOLDS.C.rwy].p, ...filOut('C', 'E'), ...filIn('A', 'W'), GN[HOLDS.A.rwy].p, GN[HOLDS.A.node].p); add(route(HOLDS.A.node, to.node));
  } else add(route(from.node, to.node));
  pts.push(to.p);
  return pts;
}
function stepTows(){
  for (const ac of S.acs) {
    if (!ac.tow || ac.state !== 'PARKED' || ac.tow.asked || S.t < ac.tow.at) continue;
    const to = (ac.tow.pref && STANDS.find(s => s.id === ac.tow.pref && !s.occ && s.area === 'civil')) || STANDS.find(s => !s.occ && s.area === 'civil');
    if (!to) { ac.tow.at = S.t + 120; continue; }
    to.occ = ac; ac.tow.to = to; ac.tow.asked = true; ac.need = 'Request tow';
    const cross = ac.stand.area === 'south';
    log('plt', `${APT.tower[0]}, tug with ${ac.cs} on stand ${ac.stand.id}, request tow to stand ${to.id}${cross ? ', crossing the runway from Charlie to Alpha' : ''}`, 'TUG');
    say(`${APT.tower[0]}, tug with ${spoken(ac.cs)} on stand ${ac.stand.id}, request tow to stand ${to.id}`, 'tug');
  }
}
// parked aircraft with nothing due in the next 15 minutes stay off the strip board
const dormant = ac => ac.state === 'ONSTAND' || (ac.state === 'PARKED' && !ac.need && ac.reqAt - S.t > 15*60 && !(ac.tow && S.t >= ac.tow.at - 300));
function freeStand(ac){
  if (APT.standFor) { const s = APT.standFor(ac); if (s) return s; }
  const area = isMil(ac) ? ['south'] : ac.perf.wake === 'L' || ac.t === 'GLF6' ? ['north','civil'] : ['civil','north'];
  for (const a of area) { const s = STANDS.find(s => !s.occ && s.area === a); if (s) return s; }
  return STANDS.find(s => !s.occ);
}
const ATIS_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const PHON_ALPHA = ['Alfa','Bravo','Charlie','Delta','Echo','Foxtrot','Golf','Hotel','India','Juliett','Kilo','Lima','Mike','November','Oscar','Papa','Quebec','Romeo','Sierra','Tango','Uniform','Victor','Whiskey','X-ray','Yankee','Zulu'];
const phonetic = l => PHON_ALPHA[ATIS_LETTERS.indexOf(l)] || l;
function nextAtis(alert = true){ S.atis = ATIS_LETTERS[(ATIS_LETTERS.indexOf(S.atis)+1) % 26]; if (alert) S.atisAlert = true; }   // the warning stays until the controller acknowledges it

// ═════════════════════════ ground movement ═════════════════════════
const P = (m, off=0) => rm(m, off);
// a point marked hs (a holding position before a runway, New York) carries the runway's id: see stepGround
// turn radius that fits the lead-in from the taxiway onto a stand: about 70% of the lead-in's length, no tighter than 8 m
const standInR = (pts, st) => pts.length > 1 ? Math.max(8, dist(...pts[pts.length-2], ...st.p)*1852*0.7) : 8;
function setPath(ac, pts, spd, onDone, opts={}){ ac.path = { pts: pts.map(p => { const q = [p[0],p[1]]; if (p.hs) q.hs = p.hs; if (p.tight) q.tight = true; return q; }), spd, onDone, ...opts }; }
function taxiFrom(ac){ return ac.stand && !ac.leftStand ? ac.stand.node : nearestNode([ac.x, ac.y], n => !/^R/.test(n.id)).id; }
function taxiRoute(ac, hp, via){
  if (via && via.length) { const o = taxiOptions(ac, hp).find(r => r.via.join('') === via.join('')) || taxiOptions(ac, hp).find(r => via.every(v => r.via.includes(v))); if (o) return o;
    if (RWYS.length > 1) { const r = route(taxiFrom(ac), HOLDS[hp].node, e => via.includes(e.tw) || e.tw === 'APRON' ? 1 : 8); if (r) return r; } }   // big airports: keep to the named taxiways
  return route(taxiFrom(ac), HOLDS[hp].node);
}
// every sensible routing to a holding point: simple paths over the taxiway graph, one per distinct "via", shortest first
function taxiOptions(ac, hp){
  const from = taxiFrom(ac), to = HOLDS[hp].node, out = [], seen = new Set();
  // a big airport (several runways: New York): the shortest route, then the shortest avoiding each taxiway it uses
  if (RWYS.length > 1) {
    const best = route(from, to); if (!best) return [];
    const res = [], seen = new Set(), L0 = pathLen(best.nodes);
    const add = r => { if (!r) return; r.len = pathLen(r.nodes); r.via = viaOf(r.tws, hp); const k = r.via.join(''); if (seen.has(k) || r.len > L0*1.8) return; seen.add(k); res.push(r); };
    add(best);
    for (const tw of [...new Set(best.tws)].filter(t => t !== 'APRON' && t !== hp)) { if (res.length === 3) break; add(route(from, to, e => e.tw === tw ? 6 : 1)); }
    return res.sort((a, b) => a.len - b.len);
  }
  (function dfs(u, nodes, tws, len, vis){
    if (out.length > 40) return;
    if (u === to) { out.push({ nodes: [...nodes], tws: [...tws], len }); return; }
    for (const [v, e] of GN[u].adj) { if (vis.has(v) || (/^R/.test(v) && v !== to)) continue; vis.add(v); nodes.push(v); tws.push(e.tw); dfs(v, nodes, tws, len + e.len, vis); nodes.pop(); tws.pop(); vis.delete(v); }
  })(from, [from], [], 0, new Set([from]));
  out.sort((a, b) => a.len - b.len);
  const res = [];
  for (const r of out) { r.via = viaOf(r.tws, hp); const k = r.via.join(''); if (seen.has(k)) continue; seen.add(k); if (r.len > out[0].len*2.2 && res.length) continue; res.push(r); if (res.length === 3) break; }
  return res;
}
// a holding position the path goes through onto its runway (the next point is nearer the centreline), not one it only passes
const hsEnters = (pts, k) => { const p = pts[k], q = pts[k+1]; if (!p.hs || !q) return false; const R = rwyById(p.hs); return Math.abs(R.offOf(q)) < Math.abs(R.offOf(p)) - 3; };
// the next runway on the path that the aircraft needs a crossing clearance for (index into its path, or -1)
const xingAhead = ac => ac.path ? ac.path.pts.findIndex((p, i) => p.hs && i < ac.path.pts.length - 1 && p.hs !== ac.xing && hsEnters(ac.path.pts, i) && activeRwy(p.hs) && !(ac.xok || []).includes(p.hs)) : -1;
const pathLen = nodes => nodes.slice(1).reduce((L, id, i) => L + dist(...GN[nodes[i]].p, ...GN[id].p), 0);
// a point on a runway-end turning pad: the aircraft goes round it slowly and tight, staying on the pad
const padPt = (R, m, o) => { const q = R.rm(m, o); q.tight = true; return q; };
function lineUpPath(ac, hp){
  const H = HOLDS[hp], R = holdRwy(hp), pts = [GN[H.rwy].p];
  // a runway entered at its end (R.ends: New York) is lined up straight away, pointing down the runway
  if (R.ends) { const up = depRw() === R.lo; pts.push(...filOut(hp, up ? 'E' : 'W')); const e = pts[pts.length-1]; pts.push(R.rm(R.mOf(e) + (up ? 60 : -60), 0)); return pts; }
  if (depRw() === R.hi) { pts.push(...filOut(hp, 'E')); for (const [m,o] of R.TURN_E) if (m > H.m + 40) pts.push(padPt(R, m, o)); }
  else { pts.push(...filOut(hp, 'W')); for (const [m,o] of R.TURN_W) if (m < H.m - 40) pts.push(padPt(R, m, o)); }
  return pts;
}
// Leaving the runway. The crew picks the exit (APT.vacPrefs, for its stand) and keeps rolling; the controller can name
// another exit (VAC <exit>) at any time until it is off the runway. dir: the way it is moving along the runway.
const VAC_TURN = 16, VAC_RWY = 30, VAC_DEC = 2.5, VAC_CLEAR = 0.03;   // turn-off speed, backtrack speed (kt), braking (kt/s), how far past the holding point it stops (NM)
const stopDist = v => Math.max(0, v*v - VAC_TURN*VAC_TURN)/(2*VAC_DEC)*0.5144;   // metres to slow from v to the turn-off
function vacatePath(ac){
  const R = rwyById(ac.rwyId), m = R.mOf([ac.x, ac.y]), dir = Math.sin(ac.hdg*D2R)*R.RU[0] + Math.cos(ac.hdg*D2R)*R.RU[1] >= 0 ? 1 : -1;
  planStand(ac); const st = ac.stand;
  const prefs = APT.vacPrefs(st, ac);
  if (ac.reqExit && !prefs.includes(ac.reqExit) && !(APT.vacExits && APT.vacExits(ac).includes(ac.reqExit))) ac.reqExit = null;
  const pts = [];
  const filM = (e, d) => FIL[e][d > 0 ? 'W' : 'E'][0][0];
  const ahead = 15 + stopDist(ac.gs || 0);
  let ex = (ac.reqExit && HOLDS[ac.reqExit] ? [ac.reqExit] : prefs).find(e => (filM(e, dir) - m)*dir > ahead);
  ac.backtrack = false;
  // no turning circles (New York): too late for the exits it wanted, it takes the last one ahead of it
  if (!ex && R.ends) ex = prefs.filter(e => (filM(e, dir) - m)*dir > 15).sort((a, b) => (filM(b, dir) - filM(a, dir))*dir)[0];
  if (!ex) { // roll on to the turning circle and backtrack
    let cur;
    if (dir < 0) { for (const [mm,o] of R.TURN_W) pts.push(padPt(R, mm, o)); cur = R.TURN_END.W; }
    else { for (const [mm,o] of R.TURN_E) pts.push(padPt(R, mm, o)); cur = R.TURN_END.E; }
    ex = (ac.reqExit && HOLDS[ac.reqExit] ? ac.reqExit : prefs.slice().sort((a,b) => Math.abs(HOLDS[a].m-cur) - Math.abs(HOLDS[b].m-cur))[0]);
    ac.backtrack = true;
  }
  const H = HOLDS[ex]; ac.exit = ex;
  const moving = ac.backtrack ? -dir : dir;
  pts.push(...filIn(ex, moving > 0 ? 'W' : 'E'), GN[H.rwy].p, GN[H.node].p);
  // it stops once its tail is clear of the holding point, a little way along its likely route to the stand, and
  // waits there for the controller's taxi instruction (TAXI)
  let via = [], stop = H.node;
  if (st) { const r = route(H.node, st.node); if (r) { via = viaOf(r.tws, ex); let D = 0;
    for (let i = 1; i < r.nodes.length - 1 && D < VAC_CLEAR; i++) { const n = GN[r.nodes[i]];
      if (n.p.hs || /^R/.test(n.id) || n.id === st.node || (D += dist(...GN[r.nodes[i-1]].p, ...n.p)) > VAC_CLEAR*3) break;
      pts.push(n.p); stop = n.id; } } }
  ac.taxiVia = via; ac.vacNode = stop;
  return pts;
}
// ── taxiing ──
// Speeds change at TAXI_ACC/TAXI_DEC (kt/s); turns are arcs of radius taxiR, sized to the aircraft; the aircraft slows
// before each corner (the sharper, the slower) and before the end of its route.
const TAXI_ACC = 1.2, TAXI_DEC = 2, PAD_V = 6;
const taxiR = ac => ac.perf.wake === 'H' ? 45 : ac.perf.wake === 'L' ? 18 : 30;   // metres
function taxiLimit(ac){
  const P = ac.path.pts; let D = 0, from = [ac.x, ac.y], lim = Infinity;
  for (let i = 0; i < P.length && D < 0.25; i++) {
    D += dist(...from, ...P[i]);
    if (i === P.length - 1) { lim = Math.min(lim, Math.max(3, Math.sqrt(2*TAXI_DEC*D*3600))); break; }   // stop at the end
    if (P[i].tight) lim = Math.min(lim, Math.sqrt(PAD_V*PAD_V + 2*TAXI_DEC*D*3600));   // round a turning pad at walking pace
    // the turn at this point, measured over the next 40 m so a curve drawn as many short legs counts as one turn
    let j = i + 1; while (j < P.length - 1 && dist(...P[i], ...P[j]) < 0.022) j++;
    const th = Math.abs(angDiff(brg(...from, ...P[i]), brg(...P[i], ...P[j])));
    const onto = ac.path.inR && i === P.length - 2;   // the tight turn onto a stand's lead-in: at walking pace
    if (th > 12) { const vc = onto ? 4 : Math.max(7, ac.path.spd - th*0.12), lead = (onto ? Math.min(taxiR(ac), ac.path.inR) : taxiR(ac))/1852*Math.tan(Math.min(th, 150)*D2R/2);
      lim = Math.min(lim, Math.sqrt(vc*vc + 2*TAXI_DEC*Math.max(0, D - lead)*3600)); }
    from = P[i];
  }
  return lim;
}
// an arrival's stand is planned once it is cleared for an approach, so the card and strip show where it is going
function planStand(ac){
  if (ac.kind !== 'ARR' || (ac.stand && ac.stand.occ === ac)) return;
  const st = freeStand(ac); if (st) st.occ = ac; ac.stand = st;
}
function startVacate(ac, auto){
  const pts = vacatePath(ac); ac.state = 'VACATING'; ac.need = null; ac.vacAuto = !!auto; ac.xing = ac.rwyId; ac.vacated = false; ac.taxiIn = false;   // leaving the runway it landed on
  setPath(ac, pts, 16, () => { ac.vacated = true; ac.onRwy = false; if (!ac.taxiIn) { ac.need = 'Request taxi'; pilot(ac, PH.vacated(ac)); } emit('vacated', ac); });
}
// TAXI for an arrival that has vacated: to its planned stand, or another (st), by the shortest route or via named taxiways
function taxiIn(ac, st, via, hold){
  // still rolling off (or re-routed while taxiing in): carry on to the vacate stop point, then on from there
  const rolling = ac.path && !ac.taxiIn && !ac.vacated, from = rolling || !ac.path ? ac.vacNode || nearestNode([ac.x, ac.y], n => !/^R/.test(n.id)).id : nearestNode([ac.x, ac.y], n => !/^R/.test(n.id)).id;
  const r = route(from, hold ? hold.node : st.node, via.length ? e => via.includes(e.tw) || e.tw === 'APRON' ? 1 : 8 : undefined); if (!r) return null;
  if (!hold) { if (ac.stand && ac.stand !== st && ac.stand.occ === ac) ac.stand.occ = null; st.occ = ac; ac.stand = st; }
  const pts = r.nodes.map(id => GN[id].p);
  if (rolling) pts.splice(0, 1, ...ac.path.pts);
  else if (pts.length > 1 && (dist(ac.x, ac.y, ...pts[0]) < 0.01 || (ac.path && Math.abs(angDiff(ac.hdg, brg(ac.x, ac.y, ...pts[0]))) > 90 && Math.abs(angDiff(ac.hdg, brg(ac.x, ac.y, ...pts[1]))) < 90))) pts.shift();   // already there, or passed it
  ac.taxiIn = true; ac.need = null; ac.held = false; ac.holdAt = null; ac.taxiVia = viaOf(r.tws, ac.exit);
  // to a holding point: it stops there and waits for the next taxi instruction
  if (hold) { if (pts.length > 1 || dist(ac.x, ac.y, ...pts[0]) > 0.003) setPath(ac, pts, 15, () => atHoldIn(ac, hold)); else atHoldIn(ac, hold, true); return ac.taxiVia; }
  pts.push(st.p);
  setPath(ac, pts, 15, () => { ac.state = 'ONSTAND'; ac.hdg = st.hdg ?? ac.hdg; emit('onstand', ac); turnRound(ac); }, { inR: standInR(pts, st) });
  return ac.taxiVia;
}
function atHoldIn(ac, hold, quiet){
  ac.taxiIn = false; ac.vacated = true; ac.vacNode = hold.node; ac.holdAt = hold.id; ac.path = null; ac.gs = 0;
  ac.need = `Holding at ${hold.id.replace(/~\d+$/, '')}`; if (!quiet) pilot(ac, PH.atHoldPt(ac, hold));
}
// on the runway, a vacating aircraft keeps its roll-out speed (or backtracks at VAC_RWY) and brakes in time for the
// first real turn on its path: the turn-off, or the turning circle
function vacSpeed(ac, dt){
  const P = ac.path.pts, cur = ac.gs || 0;
  let v = cur > VAC_RWY ? Math.max(VAC_RWY, cur - 4.2*dt) : Math.min(VAC_RWY, cur + 2*dt);
  let d = 0, from = [ac.x, ac.y];
  let turnV = VAC_TURN;
  for (const p of P) {
    const seg = dist(...from, ...p); if (seg < 1e-6) continue;
    if (p.tight) { d += seg; turnV = PAD_V; break; }   // the turning pad: down to walking pace before it
    if (Math.abs(angDiff(ac.hdg, brg(...from, ...p))) > 25) break;
    d += seg; from = p;
  }
  return Math.max(Math.min(ac.path.spd, cur, turnV), Math.min(v, Math.sqrt(turnV*turnV + 2*VAC_DEC*d*3600)));
}
function startLineUp(ac){
  ac.state = 'LINEUP'; ac.onRwy = true; ac.rwyId = rwyOf(depRw()).id; ac.need = null;
  const back = true;
  // finish on a straight stretch of centreline, so the turn onto the runway rounds out into line instead of snapping onto it
  const pts = lineUpPath(ac, ac.hp), R = holdRwy(ac.hp), c = crsOf(depRw()), e = pts[pts.length-1];
  const dir = Math.sin(c*D2R)*R.RU[0] + Math.cos(c*D2R)*R.RU[1] >= 0 ? 1 : -1;
  pts.push(R.rm(R.mOf(e) + dir*10, 0), R.rm(R.mOf(e) + dir*Math.max(35, taxiR(ac)*2), 0));
  setPath(ac, pts, 18, () => { ac.state = 'LINEDUP'; ac.hdg = crsOf(depRw()); if (ac.cto) beginTakeoff(ac); else ac.need = 'Lined up'; }, { fine: true });
  return back;
}

// ═════════════════════════ commands ═════════════════════════
// a flight handed to the next unit is shown in its own colour and can't be selected or instructed
const outOfCtl = ac => !!ac.handed;
function findAc(token){
  if (!token) return null; token = token.toUpperCase();
  return S.acs.find(a => a.cs === token) || (token.length >= 3 && /\d/.test(token) ? S.acs.find(a => a.cs.endsWith(token)) : null) || null;
}
function windPhrase(){ const w = S.wx; return `wind ${w.vrb ? 'variable' : hdg3(w.dir)+' degrees'} ${w.spd} knots${w.gust ? ' gusting '+w.gust : ''}`; }
const viaWords = v => v.length ? ' via ' + v.map(t => PHON[t] || t).join(', ') : '';
const SAY_AGAIN = ['say again', 'say again, you were broken', `${APT.coordName}, readability two, say again`, 'say again the last instruction'];
const garbleable = (ac, toks) => ac.airborne && !ac.emerg && ac.mode !== 'FINAL' && ac.state !== 'PRE' && toks.length && toks.every(t => /^([HLRACDS]\d{1,5}|SN|DCT|APP|HOLD)$/.test(t) || RW_ENDS.includes(t) || WP[t]);
// a heading or a direct-to off an RNP AR approach ends it: the crew needs a new approach clearance
// taken off its own navigation mid-descent (a heading, a hold): the crew stops descending at the next hundred feet,
// never below the approach altitude, and says so
function viaStop(ac, said, reads){
  ac.via = false; const a = Math.max(ac.cleared ?? 0, Math.round((ac.alt + Math.min(0, ac.vs)/6)/100)*100);
  if (a > (ac.cleared ?? 0) + 50) { ac.tgtAlt = ac.cleared = a; said.push(`maintain ${altWords(a)}`); reads.push(`maintaining ${altShort(a)}`); }
}
function rnpCancel(ac){ ac.app = null; ac.appId = null; ac.finI = null; ac.askedApp = false; if (ac.mode === 'HOLD') ac.mode = 'HDG'; sys(`${ac.cs} is off the RNP approach: clear it again when you want it back on.`); }
function command(str){ inCmd = true; try { return commandRun(str); } finally { inCmd = false; } }
function commandRun(str){
  const toks = str.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (!toks.length) return;
  let ac = findAc(toks[0]);
  if (ac) toks.shift(); else ac = S.sel;
  if (!ac || !S.acs.includes(ac)) { sys('Select a flight first, or start the command with its callsign.'); return; }
  if (outOfCtl(ac)) { sys(`${ac.cs} has been transferred to ${NEXT_UNIT[ac.gate][0]}: it is no longer under your control.`); return; }
  if (ac.state === 'PRE') { select(ac); sys(`${ac.cs} is not on your frequency yet: it calls ${APT.radar[0]} at ${ARR_ROUTE[ac.gate][S.rwy][0] ? 'the boundary' : 'entry'}.`); return; }
  select(ac);
  const said = [], reads = [];
  const air = ac.airborne;
  if (ac.lost && !(toks.length === 1 && toks[0] === 'REL')) { sys(`${ac.cs} is not on your frequency: it was sent to ${ac.lost.f}. Wait for it to come back.`, true); return; }
  const snap = garbleable(ac, toks) && Math.random() < 0.05 ? { ...ac } : null;   // the crew misses it now and then
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]; let r;
    if ((r = t.match(/^([HLR])(\d{1,3})$/)) && air) {
      const h = (+r[2]) % 360 || 360; ac.mode = 'HDG'; ac.tgtHdg = h; ac.turnDir = r[1]==='L' ? -1 : r[1]==='R' ? 1 : 0; ac.route = []; ac.onSid = false; ac.divDct = false;
      if (['HOLDING','INBOUND','FINAL'].includes(ac.state)) ac.state = 'VECTORS';
      if (ac.appId) rnpCancel(ac);
      if (ac.via) viaStop(ac, said, reads);
      const dif = angDiff(ac.hdg, h);
      const ts = r[1]==='L' ? 'turn left' : r[1]==='R' ? 'turn right' : (Math.abs(dif) < 4 ? 'fly' : dif < 0 ? 'turn left' : 'turn right');
      said.push(`${ts} heading ${hdg3(h)}`); reads.push(`${ts.replace('turn ','').replace('fly','')} heading ${hdg3(h)}`.trim());
    } else if ((r = t.match(/^[ACD](\d{1,5})$/)) && air) {
      let a = +r[1]; if (a < 400) a *= 100; a = clamp(a, 1000, 30000);
      const up = a > ac.alt + 50; ac.tgtAlt = ac.cleared = a; ac.via = false; if (up && ac.need === 'Request climb') ac.need = null;
      const q = a <= APT.ta && ac.alt > APT.ta ? `, ${PH.altim()}` : '', [sa, ra] = PH.alt(a, up, ac);
      said.push(sa + q); reads.push(ra + q);
    } else if ((r = t.match(/^S(\d{2,3})$/)) && air && +r[1] > 0) {
      const s = clamp(+r[1], ac.perf.vapp, 330); ac.tgtSpd = s; ac.spdAssigned = true;
      { const [sa, ra] = PH.speed(s, ac); said.push(sa); reads.push(ra); }
    } else if ((t === 'SN' || t === 'S0') && air) { ac.spdAssigned = false; ac.tgtSpd = null; said.push('no speed restriction'); reads.push('no speed restriction'); }
    else if (t === 'DCT' && air) {
      const id = toks[i+1], w = id && WP[id];
      if (!w) { sys(`Unknown fix ${id||''}. Fixes: ${Object.keys(WP).filter(k => !WP[k].hide).join(' ')}`); return; }
      i++; const idx = ac.route.indexOf(id); ac.onSid = false;
      if (ac.appId && id !== finOf(ac).entry) rnpCancel(ac);
      ac.route = idx >= 0 ? ac.route.slice(idx) : (ac.kind === 'DEP' && EXIT_ROUTE[ac.gate].includes(id) ? EXIT_ROUTE[ac.gate].slice(EXIT_ROUTE[ac.gate].indexOf(id)) : [id]); ac.mode = 'NAV';
      if (ac.alt < 3500 && crossesRock(ac, w.p)) sys(`Caution: ${ac.cs} direct ${id} tracks over ${APT.terrain.name}.`, true);
      if (ac.state === 'HOLDING') ac.state = 'VECTORS';
      if (ac.kind === 'DEP' && ac.need && ac.need.startsWith('Request')) ac.need = null;
      if (ac.diverting && id === ac.diverting) { ac.need = null; ac.state = 'DIVERTING'; }
      said.push(`proceed direct ${id}`); reads.push(`direct ${id}`);
    } else if (t === 'APP' && air) {
      const rw = RW_ENDS.includes(toks[i+1]) ? toks[++i] : S.rwy;
      // RNP: "APP RNP", "APP 05 RNPY", "APP RNP Z" (airports with RNP approaches only)
      let v = null; if (APT.rnp && /^RNP[A-Z]?$/.test(toks[i+1] || '')) { v = toks[++i].slice(3) || (/^[A-Z]$/.test(toks[i+1] || '') ? toks[++i] : '*'); }
      if (ac.kind !== 'ARR') { sys(`${ac.cs} is a departure.`); continue; }
      const key = v ? APT.rnp(ac, rw, v) : null;
      if (v && !key) { sys(`There is no RNP ${v} approach to runway ${rw}.`); return; }
      const F = FINAL[key || rw];
      const lim = windLimit(ac, rw) || (appMinsOk(F, rw, S.wx) ? null : (F.rnp ? 'weather below the RNP minima' : APT.minsText));
      if (lim) {
        atc(ac, `this will be ${F.rnp ? 'the ' + F.spoken : 'a ' + APT.appName + ' runway ' + rw}`);
        // below the circling minima but good enough for RNP: the crew asks for it instead of holding
        if (!key && APT.rnp && !windLimit(ac, rw) && APT.rnpMinsOk(S.wx, rw)) { pilot(ac, `unable, ${lim} for runway ${rw}, request RNP approach`); ac.need = 'Request RNP approach'; return; }
        pilot(ac, `unable, ${lim} for runway ${rw}, we'll hold and see if it improves`); ac.need = 'Unable approach'; if (!ac.divertAt && !ac.diverting) { ac.divertAt = S.t + 120; ac.divertTo = APT.divertTo(ac); } return;
      }
      ac.app = rw; ac.appId = key; ac.finI = null; ac.missRoute = null; ac.gatesDone = null; ac.checked = false; ac.shearChecked = false; ac.warnedCtl = false; ac.diverting = null; ac.divertAt = null; ac.gaTurnDone = false;
      if (F.rnp && ac.mode !== 'NAV' && ac.mode !== 'HOLD') { ac.mode = 'NAV'; ac.route = []; }   // RNP AR is flown from the IAF, never joined from vectors
      if (ac.mode === 'HDG' && !willIntercept(ac, F)) { ac.mode = 'NAV'; ac.route = []; sys(`${ac.cs} is not on an intercept heading: it will route own navigation to ${F.entryName}.`); }
      if (ac.mode === 'NAV' || ac.mode === 'HOLD') {
        const entry = F.entry;
        const i2 = ac.route.indexOf(entry), iv = (F.via || []).map(x => ac.route.indexOf(x)).find(j => j >= 0);
        ac.route = i2 >= 0 ? ac.route.slice(0, i2+1) : iv != null ? [...ac.route.slice(0, iv+1), entry] : [entry];
        ac.mode = 'NAV'; ac.state = 'VECTORS';
      }
      // from own navigation the descent follows the published altitudes (viaAlt) down to the approach altitude;
      // joining from vectors it keeps its assigned altitude until established
      { const aa = F.alt || APT.appAlt, up = !!F.climbIaf && (ac.cleared ?? 0) < aa;   // climbIaf: the approach starts higher (Innsbruck's ELMEM)
        ac.via = ac.mode === 'NAV';
        if (up && ac.mode === 'NAV') { ac.tgtAlt = ac.cleared = aa; const [sa, ra] = PH.alt(aa, up, ac); said.push(sa); reads.push(ra); }
        else if ((ac.cleared ?? 99999) > aa && ac.mode === 'NAV') { ac.tgtAlt = ac.cleared = aa; const [sa, ra] = PH.via(aa, ac); said.push(sa + (ac.alt > APT.ta ? `, ${PH.altim()}` : '')); reads.push(ra); } }
      said.push(F.phrase ? F.phrase(rw) : `this will be a surveillance radar approach runway ${rw}, terminating at Point ${F.name}, report visual`);
      reads.push(F.read ? F.read(rw) : `SRA runway ${rw}, wilco`);
      if (ac.state === 'MISSED') { ac.state = 'VECTORS'; ac.gaTurn = true; }
      if (ac.need && /Initial|Holding|Missed|Request (RNP )?approach|Unable approach/.test(ac.need)) ac.need = null;
    } else if (t === 'HOLD' && air) {
      const fix = toks[i+1] && WP[toks[i+1]] ? toks[++i] : null;
      if (ac.via) viaStop(ac, said, reads);
      ac.mode = 'HOLD'; ac.state = 'HOLDING';
      ac.hold = fix ? { c: WP[fix].p, inb: (WP[fix].hold||{}).inb ?? brg(ac.x, ac.y, ...WP[fix].p), ph: 'in', name: fix, left: !!(WP[fix].hold||{}).left } : { c: [ac.x, ac.y], inb: ac.hdg, ph: 'turn1', name: 'present position', t: 0 };
      said.push(`hold at ${ac.hold.name}, ${ac.hold.left ? 'left' : 'right'} hand pattern${fix ? ', inbound track '+hdg3(ac.hold.inb) : ''}, expect further clearance in one zero minutes`);
      reads.push(`hold ${ac.hold.name}`);
    } else if (t === 'CTL') {
      if (ac.kind !== 'ARR' || !air) { sys(`${ac.cs} is not on approach.`); continue; }
      { const blk = rwyBlocked(); if (blk) { sys(`Runway ${S.rwy} is closed (${blk}): you can't clear ${ac.cs} to land. Hold it or send it around.`, true); continue; } }
      const rw = ac.app || S.rwy; ac.ctl = true; ac.need = null; ac.freq = 'TWR';
      { const [sa, ra] = PH.ctl(ac, rw); said.push(sa); reads.push(ra); }
      if (APT.xing && (S.xing.st === 'OPEN' || S.xing.st === 'OPENING')) sys('Winston Churchill Avenue is still open.');
    } else if (t === 'GA' && air) {
      if (ac.kind !== 'ARR') { sys(`${ac.cs} is a departure.`); continue; }
      emgOnGA(ac); goAround(ac, null); said.push(`go around, I say again go around, climb ${altWords(APT.gaAlt)}`); reads.push(`going around, climbing ${altShort(APT.gaAlt)}`);
    } else if (t === 'HO' || t === 'CONT') {
      if (!air) { sys(`${ac.cs} is on the ground and stays with Tower.`); continue; }
      const unit = ac.kind === 'DEP' ? (ac.freq === 'TWR' ? APT.depRadar || APT.radar : NEXT_UNIT[ac.gate]) : APT.tower;
      const fq = toks[i+1] && /^1\d\d(\.\d{1,3})?$/.test(toks[i+1]) ? toks[++i] : unit[1];
      if (fq !== unit[1] && +fq !== +unit[1]) {   // wrong frequency: the crew reads it back, finds nobody there and comes back
        ac.lost = { f: fq, until: S.t + rnd(25, 45) };
        said.push(`contact ${unit[0]} ${fq}`); reads.push(`${fq}, ${ac.kind === 'DEP' && ac.freq !== 'TWR' ? 'good day' : 'thanks'}`);
        if (ac.need && /^(Airborne|Ready for transfer|Back on)/.test(ac.need)) ac.need = null;
        continue;
      }
      if (ac.kind === 'DEP' && ac.freq === 'TWR') { ac.freq = 'RAD'; if (ac.need && /^(Airborne|Back on)/.test(ac.need)) ac.need = null; }
      else if (ac.kind === 'DEP') { ac.handed = true; ac.need = null; }
      else { ac.freq = 'TWR'; if (ac.need === 'Back on frequency') ac.need = null; }
      said.push(`contact ${unit[0]} ${unit[1]}`); reads.push(`${unit[1]}, ${ac.handed ? 'good day' : 'thanks'}`);
    } else if (t === 'TOW') {
      if (ac.need !== 'Request tow' || !ac.tow || !ac.tow.to) { sys(`${ac.cs} has no tow request.`); continue; }
      const to = ac.tow.to, from = ac.stand, cross = from.area === 'south';
      setPath(ac, towPath(ac, to), 5, () => { ac.state = 'PARKED'; ac.stand = to; ac.hdg = to.hdg; ac.onRwy = false; ac.tow = null; ac.towCross = false; ac.leftStand = false; ac.pushed = false; sys(`${ac.cs} is on stand ${to.id}.`); });
      if (from.occ === ac) from.occ = null; ac.state = 'TOW'; ac.need = null; ac.towCross = cross;
      log('atc', `Tug with ${ac.cs}, tow approved to stand ${to.id}${cross ? ', cross runway ' + S.rwy + ' at Charlie, report vacated' : ''}`, 'TOWER');
      say(`Tug with ${spoken(ac.cs)}, tow approved to stand ${to.id}`, 'atc');
      return renderSel && renderSel();
    } else if (t === 'PUSH') {
      if (ac.state !== 'PARKED' || !ac.need || ac.need === 'Request tow') { sys(`${ac.cs} has not asked for start-up.`); continue; }
      const dir = { E:'east', EAST:'east', W:'west', WEST:'west' }[toks[i+1]]; if (dir) i++;
      const face = dir || pushRec(ac); ac.state = 'PUSH'; ac.need = null; ac.face = face; ac.sid = sidName(ac.gate, depRw());
      ac.pushPts = pushPath(ac, face);
      setPath(ac, ac.pushPts, 3, () => { ac.state = 'READY'; ac.pushed = true; ac.readyAt = S.t + rnd(25, 70); }, { reverse: true });
      const dn = AP[ac.d] ? AP[ac.d][2] : ac.d;
      { const [sa, ra] = PH.push(ac, dn, face); said.push(sa); reads.push(ra); }
    } else if (t === 'PULL' || t === 'PULLBACK') {
      // pushed (or pushing) the wrong way: the tug tows it forward, back along the push line and onto its stand nose-in, to push again
      if (!['PUSH', 'READY'].includes(ac.state) || ac.leftStand || !ac.stand) { sys(`${ac.cs} ${ac.state === 'PARKED' ? 'is already on its ' + (APT.standWord || 'stand') : 'is not on push back'}: only an aircraft pushing or pushed back, and not yet taxiing, can be pulled forward.`); continue; }
      const st = ac.stand, pp = ac.pushPts || pushPath(ac, ac.face || pushRec(ac));
      const got = ac.state === 'READY' || !ac.path ? pp.length : Math.max(0, pp.length - ac.path.pts.length);   // push points already reached
      ac.state = 'PULL'; ac.need = null; ac.pushed = false; ac.held = false;
      setPath(ac, [...pp.slice(0, got).reverse(), st.p], 4, () => { ac.state = 'PARKED'; ac.hdg = st.hdg; ac.face = null; ac.pushPts = null; ac.reqAt = S.t + rnd(20, 45); sys(`${ac.cs} is back on ${APT.standWord || 'stand'} ${st.id}.`); }, { tug: true });
      { const [sa, ra] = PH.pull(ac, st); said.push(sa); reads.push(ra); }
    } else if (t === 'TAXI' && ac.kind === 'ARR') {
      if (ac.state !== 'VACATING') { sys(`${ac.cs} ${['ROLLED','ROLLOUT'].includes(ac.state) ? 'has not vacated the runway yet' : 'is not on the ground'}.`); continue; }
      if (ac.onRwy) { sys(`${ac.cs} is still on the runway: let it vacate first.`); continue; }
      let st = ac.stand, hold = null; if (toks[i+1] === 'STAND' || toks[i+1] === 'GATE') i++;
      else if (toks[i+1] && holdPt(toks[i+1])) hold = holdPt(toks[++i]);
      if (!hold && toks[i+1] && toks[i+1] !== 'VIA') { const want = STANDS.find(x => x.id.toUpperCase() === toks[i+1]); if (!want) { sys(`There is no stand ${toks[i+1]}.`); continue; } i++;
        if (want.occ && want.occ !== ac) { sys(`Stand ${want.id} is occupied (${want.occ.cs}).`); continue; } st = want; }
      if (!st) { st = freeStand(ac); if (!st) { sys(`No free stand for ${ac.cs}.`); continue; } }
      const via = []; if (toks[i+1] === 'VIA') { i++; while (toks[i+1] && /^[A-Z]{1,2}\d{0,2}$/.test(toks[i+1]) && PHON[toks[i+1]]) via.push(toks[++i]); }
      const vw = taxiIn(ac, st, via, hold); if (!vw) { sys(`No taxi route to ${hold ? 'holding point ' + hold.id : 'stand ' + st.id}.`); continue; }
      { const [sa, ra] = hold ? PH.taxiHold(ac, hold, vw) : PH.taxiIn(ac, st, vw); said.push(sa); reads.push(ra); }
    } else if (t === 'TAXI') {
      if (!(ac.state === 'READY' || ac.state === 'HOLDPT' || ac.state === 'TAXI' || ac.state === 'HELD' || (ac.state === 'PARKED' && ac.need))) { sys(`${ac.cs} is not ready to taxi.`); return; }
      const ihp = toks[i+1] && IHPS[toks[i+1]] && !HOLDS[toks[i+1]] ? IHPS[toks[++i]] : null;   // an intermediate holding point on the way
      let hp = toks[i+1] && HOLDS[toks[i+1]] ? toks[++i] : (ac.hp && ac.state !== 'READY' && ac.state !== 'PARKED' ? ac.hp : depHold(ac));
      const via = []; if (toks[i+1] === 'VIA') { i++; while (toks[i+1] && /^[A-Z]{1,2}\d{0,2}$/.test(toks[i+1]) && PHON[toks[i+1]]) via.push(toks[++i]); }
      { const why = APT.taxiCheck && APT.taxiCheck(ac, hp); if (why) { sys(why); continue; } }
      const rt = ihp ? route(taxiFrom(ac), ihp.node, via.length ? e => via.includes(e.tw) || e.tw === 'APRON' ? 1 : 8 : undefined) : taxiRoute(ac, hp, via);
      if (!rt) { sys(`No taxi route to holding point ${ihp ? ihp.id : hp}.`); continue; }
      ac.hp = hp;
      const pts = rt.nodes.map(id => GN[id].p);
      // pushed onto the lane already: don't taxi back to the stand's lead-in point if the next node is ahead
      if (ac.pushed && !ac.leftStand && pts.length > 1 && Math.abs(angDiff(ac.hdg, brg(ac.x, ac.y, ...pts[1]))) < 90 && Math.abs(angDiff(ac.hdg, brg(ac.x, ac.y, ...pts[0]))) > 90) pts.shift();
      if (ac.state === 'PARKED') { ac.pushed = false; pts.unshift(ac.stand.lp); }
      ac.state = 'TAXI'; ac.need = null; ac.leftStand = true; ac.held = false; ac.holdAt = null;
      if (ihp) setPath(ac, pts, 15, () => { ac.holdAt = ihp.id; ac.need = `Holding at ${ihp.id}`; pilot(ac, PH.atHoldPt(ac, ihp)); });
      else setPath(ac, pts, 15, () => { ac.state = 'HOLDPT'; if (!ac.cto) { ac.need = 'Ready for departure'; pilot(ac, PH.atHold(ac, hp)); } else startLineUp(ac); });
      if (ac.stand && ac.stand.occ === ac) ac.stand.occ = null;
      const vw = viaOf(rt.tws, hp);
      { const [sa, ra] = ihp ? PH.taxiHold(ac, ihp, vw) : PH.taxi(ac, hp, vw); said.push(sa); reads.push(ra); }
    } else if (t === 'CROSS' || t === 'X') {
      if (air || !ac.path) { sys(`${ac.cs} is not taxiing.`); continue; }
      const want = RW_ENDS.includes(toks[i+1]) ? rwyOf(toks[++i]).id : ac.hsAt || (xingAhead(ac) >= 0 ? ac.path.pts[xingAhead(ac)].hs : null);
      if (!want) { sys(`${ac.cs} has no runway to cross on its route.`); continue; }
      (ac.xok ||= []).push(want);
      const [sa, ra] = PH.cross(ac, rwyName(want)); said.push(sa); reads.push(ra);
      if (ac.hsAt === want && ac.need && ac.need.startsWith('Holding short')) ac.need = null;
    } else if (t === 'HP' || t === 'STOP') {
      if (air || !ac.path || ac.state === 'TAKEOFF') { sys(`${ac.cs} is not taxiing.`); continue; }
      ac.held = true; said.push('hold position'); reads.push('holding position');
    } else if (t === 'RES' || t === 'GO') {
      if (!ac.held) { sys(`${ac.cs} is not holding position.`); continue; }
      ac.held = false; said.push('continue taxi'); reads.push('continuing');
    } else if (t === 'LU') {
      if (ac.state !== 'HOLDPT') { sys(`${ac.cs} is not at a holding point.`); continue; }
      if (S.acs.some(o => o !== ac && onRunway(o, depRw()))) sys('Careful: the runway is occupied.', true);
      if (APT.xing && S.xing.st !== 'CLOSED' && ((S.rwy === RW_LO && HOLDS[ac.hp].m > XING_M) || (S.rwy === RW_HI && HOLDS[ac.hp].m < XING_M))) sys('The backtrack crosses Winston Churchill Avenue: close the road first.', true);
      startLineUp(ac);
      { const [sa, ra] = PH.lineUp(ac, ac.hp); said.push(sa); reads.push(ra); }
    } else if (t === 'CTO') {
      if (!['HOLDPT','LINEUP','LINEDUP'].includes(ac.state)) { sys(`${ac.cs} is not ready for takeoff.`); continue; }
      { const tl = APT.toLimit && APT.toLimit(depRw()); if (tl) { atc(ac, `runway ${depRw()}, cleared for takeoff`); pilot(ac, `unable, ${tl} for take-off, we'll wait at the holding point`); return; } }
      if (S.wx.vis < 1000) { atc(ac, `runway ${depRw()}, cleared for takeoff`); pilot(ac, 'unable, visibility is below our 1,000 metre departure minimum'); return; }
      if (S.xing.st !== 'CLOSED') { atc(ac, `runway ${depRw()}, cleared for takeoff`); pilot(ac, 'negative, the road crossing is still open, holding position'); return; }
      { const blk = rwyBlocked(); if (blk) { sys(`Runway ${S.rwy} is closed (${blk}): hold ${ac.cs}.`, true); continue; } }
      if (needRel(ac)) { const R = ac.rel, who = relUnit(ac);
        if (!R || R.st !== 'OK') { sys(`No release from ${who} for ${ac.cs}${R && R.st === 'REQ' ? ' yet: it is requested, wait for the call back' : R && R.st === 'EXP' ? ': it expired, request a new one with REL' : ': request one with REL first'}.`, true); continue; }
        if (R.nb && S.t < R.nb) { sys(`${who} released ${ac.cs} not before ${zt(R.nb).slice(0,5)}.`, true); continue; } }
      const sid = sidName(ac.gate, depRw()), chg = ac.sid && ac.sid !== sid; ac.sid = sid;
      ac.cto = true; ac.need = null; ac.depRwy = depRw();
      if (ac.state === 'HOLDPT') startLineUp(ac);
      { const [sa, ra] = PH.cto(ac, sid, chg); said.push(sa); reads.push(ra); }
      if (ac.state === 'LINEDUP') beginTakeoff(ac);
    } else if (t === 'VAC') {
      if (!(ac.state === 'ROLLED' || ac.state === 'ROLLOUT' || (ac.state === 'VACATING' && ac.onRwy))) { sys(`${ac.cs} is ${ac.state === 'VACATING' ? 'already off the runway' : 'not on the runway'}.`); continue; }
      if (toks[i+1] && APT.exitFor && /^[A-Z]{1,2}\d{0,2}(~\d)?$/.test(toks[i+1]) && APT.exitFor(ac, toks[i+1])) ac.reqExit = APT.exitFor(ac, toks[++i]);   // "VAC H": that taxiway's exit ahead
      else if (toks[i+1] && HOLDS[toks[i+1]]) ac.reqExit = toks[++i];
      startVacate(ac, false);
      said.push(`${ac.backtrack ? 'backtrack, ' : ''}vacate via ${PHON[ac.exit]}`); reads.push(`${ac.backtrack ? 'backtrack, ' : ''}vacate via ${PHON[ac.exit]}`);
    } else if (t === 'ROG') {
      const a = emgAck(ac); if (!a) { sys(`${ac.cs} has not declared an emergency.`); continue; } said.push(a); reads.push('roger');
    } else if (t === 'WS') {
      const a = emgWS(ac); if (!a) { sys('No windshear has been reported.'); continue; } said.push(a); reads.push('copied the windshear');
    } else if (t === 'REL') {
      if (ac.kind !== 'DEP' || air || !needRel(ac)) { sys(`${ac.cs} doesn't need a departure release.`); continue; }
      if (ac.rel && ac.rel.st === 'REQ') { sys(`Release for ${ac.cs} already requested: ${relUnit(ac)} will call back.`); continue; }
      if (ac.rel && ac.rel.st === 'OK') { sys(`${ac.cs} is already released until ${zt(ac.rel.until).slice(0,5)}.`); continue; }
      requestRelease(ac);
    } else if (t === 'IDENT' || t === 'SQK') { said.push('squawk ident'); reads.push('ident'); }
    else { sys(`Didn't understand "${t}" for ${ac.cs}${!air && /^[HLRACDS]\d/.test(t) ? ' (it is on the ground)' : ''}.`); return; }
  }
  if (said.length && snap) {
    atc(ac, said.join(', '));
    for (const k of Object.keys(ac)) if (!(k in snap)) delete ac[k];
    Object.assign(ac, snap); ac.lastCmd = toks.join(' ');
    pilot(ac, SAY_AGAIN[Math.floor(Math.random()*SAY_AGAIN.length)]); ac.need = 'Say again';
    renderSel(); renderStrips(true); return;
  }
  if (said.length) { if (ac.emerg && !ac.emerg.ack) { const a = emgAck(ac); if (a) { said.unshift(a); reads.unshift('roger'); } } atc(ac, said.join(', ')); pilot(ac, reads.join(', ')); if (ac.need === 'Initial call' || ac.need === 'Back on frequency' || ac.need === 'Say again') ac.need = null; emit('cmd', { ac, toks }); }
  renderSel(); renderStrips(true);
}
function willIntercept(ac, F){
  const probe = { x: ac.x, y: ac.y }; let prev = null;
  for (let d = 0; d < 30; d += 0.25) {
    probe.x = ac.x + Math.sin(ac.hdg*D2R)*d; probe.y = ac.y + Math.cos(ac.hdg*D2R)*d;
    const q = onFinal(probe, F);
    if (q.togo > 3.2 && q.togo < 25 && Math.abs(q.xte) < 0.45 && Math.abs(angDiff(ac.hdg, q.crs)) < 70) return true;
    if (prev && Math.sign(prev.xte) !== Math.sign(q.xte) && q.togo > 3.2 && q.togo < 25 && Math.abs(angDiff(ac.hdg, q.crs)) < 70) return true;
    prev = q;
  }
  return false;
}
function crossesRock(ac, p){ const T = APT.terrain; if (!T) return false; for (let f = 0; f <= 1; f += 0.02) { if (inPoly([ac.x + (p[0]-ac.x)*f, ac.y + (p[1]-ac.y)*f], T.poly)) return true; } return false; }
function beginTakeoff(ac){ ac.state = 'TAKEOFF'; ac.cto = true; ac.ias = 0; ac.depRwy = depRw(); ac.hdg = crsOf(depRw()); ac.path = null; ac.need = null; emit('takeoff', ac); }
function windLimit(ac, rw){ if (APT.windLimit) return APT.windLimit(ac, rw); const c = windComp(S.wx, crsOf(rw)); if (c.headG < -10) return 'tailwind out of limits'; if (c.crossG > (ac.perf.wake === 'L' ? 22 : 33)) return 'crosswind out of limits'; return null; }
function goAround(ac, why){
  if (ac.state === 'MISSED' || (ac.gaT && S.t - ac.gaT < 30)) return;
  const rw = ac.app || S.rwy;
  ac.state = 'MISSED'; ac.mode = 'HDG'; ac.tgtHdg = Math.round(crsOf(rw)); ac.turnDir = 0; ac.gaT = S.t;
  APT.gaEarly(ac, rw);
  { const F = finOf(ac); ac.missRoute = F && F.missed ? F.missed.slice() : null; ac.appId = null; ac.finI = null; }
  ac.tgtAlt = ac.cleared = APT.gaAlt; ac.via = false; ac.ctl = false; ac.app = null; ac.gaTurn = false; ac.checked = false; ac.shearChecked = false; ac.warnedCtl = false; ac.spdAssigned = false; ac.route = []; ac.freq = 'RAD';
  ac.gaRwy = rw; S.score.ga++; ac.gaCount = (ac.gaCount||0) + 1;
  if (why) pilot(ac, `going around, ${why}`);
  ac.need = 'Missed approach';
  if (ac.gaCount >= 2 && why) { // second weather/turbulence go-around: the crew elects to divert
    ac.divertAt = S.t + 25; ac.divertTo = APT.divertTo(ac);
  }
  emit('ga', ac);
}

// ═════════════════════════ simulation ═════════════════════════
function windAt(alt){ const w = S.wx; const k = alt < 1500 ? 1 : 1.3; const g = w.gust ? Math.random()*(w.gust-w.spd) : 0; const s = (w.spd + g*0.4)*k; const toward = (w.dir+180)*D2R; return [Math.sin(toward)*s, Math.cos(toward)*s]; }
// position relative to a final path: nearest segment, track miles to go, cross-track (+ right), segment course
// fly-by turn anticipation: how far before fix p to start turning towards nx, from the turn radius at 25° bank
function turnLead(ac, p, nx){
  const tas = Math.max(ac.ias*(1+ac.alt/1000*0.018), 60), r = tas*tas/(11.26*Math.tan(25*D2R))/6076;
  return clamp(r*Math.tan(Math.abs(angDiff(brg(ac.x, ac.y, ...p), brg(...p, ...nx)))/2*D2R), 0.3, 3);
}
// the point d NM further along an approach path from where the aircraft is abeam it (q from onFinal)
function pathAhead(F, q, d){
  let i = q.i, a = F.pts[i], b = F.pts[i+1], L = dist(...a, ...b), t = q.t + d;
  while (t > L && i < F.pts.length - 2) { t -= L; i++; a = F.pts[i]; b = F.pts[i+1]; L = dist(...a, ...b); }
  return [a[0] + (b[0]-a[0])/L*t, a[1] + (b[1]-a[1])/L*t];
}
function onFinal(ac, F){
  let best = null;
  // an RNP path doubles back on itself, so only look forward from the leg the aircraft was last on
  const i0 = F.rnp && ac.finI != null ? Math.max(0, ac.finI - 1) : 0;
  for (let i = i0; i < F.pts.length-1; i++) {
    const a = F.pts[i], b = F.pts[i+1], L = dist(...a, ...b), ux = (b[0]-a[0])/L, uy = (b[1]-a[1])/L;
    const t = clamp((ac.x-a[0])*ux + (ac.y-a[1])*uy, i === 0 ? -30 : 0, i === F.pts.length-2 ? L + 2 : L);
    const px = a[0]+ux*t, py = a[1]+uy*t, d = dist(ac.x, ac.y, px, py);
    if (!best || d < best.d - 1e-9) best = { d, i, togo: F.cum[i] - t, xte: (ac.x-a[0])*uy - (ac.y-a[1])*ux, crs: brg(...a, ...b), t, L };
  }
  if (F.rnp && best) ac.finI = best.i;
  return best;
}
// approach profile: Gibraltar's 2.8° SRA (920 ft at 3 NM) unless the final carries its own (threshold elevation, ft per NM)
// or a published profile F.prof: [track miles to go, altitude] pairs from the threshold outwards
// the approach an arrival is flying: its RNP procedure if it has one, else the runway's own final
const apk = ac => ac.appId || ac.app, finOf = ac => FINAL[apk(ac)];
const appMinsOk = (F, rw, w) => F && F.mins ? w.vis >= F.mins.vis && w.ceil >= F.mins.ceil : APT.minsOk(w, rw);
function profAt(P, t){ t = Math.max(0, t); for (let i = 1; i < P.length; i++) if (t <= P[i][0]) { const [a, A] = P[i-1], [b, B] = P[i]; return A + (B - A)*(t - a)/((b - a) || 1); } return P[P.length-1][1]; }
const gpAlt = (togo, rw) => { const F = rw && FINAL[rw]; return F && F.prof ? profAt(F.prof, togo) : ELEV + 40 + Math.max(0, togo)*297; };
const gpRate = (rw, togo) => { const F = rw && FINAL[rw]; if (!F || !F.prof) return 297; const r = (profAt(F.prof, togo + 0.6) - profAt(F.prof, togo))/0.6; return r > 1 ? Math.max(F.minRate ?? 150, r) : r; };   // the segment being flown: level on a platform, never early down a step
const tdElev = rw => { const F = rw && FINAL[rw]; return F && F.elev != null ? F.elev : ELEV; };
// above the published profile (joined high from vectors, beyond its start): a 3° (318 ft/NM) slope back up from the far
// end of its highest altitude, so a high aircraft comes down to it on a normal descent path instead of diving for it
function gpCeil(togo, rw){
  const F = rw && FINAL[rw]; if (!F || !F.prof) return gpAlt(togo, rw);
  const top = F._top ||= F.prof.reduce((m, p) => p[1] >= m[1] ? p : m, F.prof[0]);
  return togo > top[0] ? top[1] + (togo - top[0])*318 : gpAlt(togo, rw);
}
// "cleared approach" from own navigation (a STAR, a transition, the downwind and base): the crew descends with the
// published altitudes, not straight to the approach altitude. Each published altitude ahead (APT.arrAlt for the
// arrival fixes, then the approach profile from where the route joins it) allows a 3° descent path back from its fix;
// the aircraft keeps above the lowest of those paths and never goes below a published altitude before its fix.
function viaAlt(ac){
  const F = finOf(ac), R = ac.route; if (!F || !R.length) return null;
  const lead = (ac.gs || ac.ias)/3600*30, pub = APT.arrAlt || {};   // aim about 30 s ahead so the descent starts on time
  let d = 0, floor = -Infinity, ceil = Infinity, prev = [ac.x, ac.y];
  const con = (dd, a) => { if (a == null) return; floor = Math.max(floor, a); ceil = Math.min(ceil, a + Math.max(0, dd - lead)*318); };
  for (const id of R) { const p = WP[id].p; d += dist(...prev, ...p); prev = p; if (id !== F.entry) con(d, pub[id]); }
  const last = R[R.length - 1], k = apk(ac), J = F._join ||= {};
  const T0 = J[last] ??= (onFinal({ x: prev[0], y: prev[1] }, F) || { togo: 0 }).togo;
  con(d, gpAlt(T0, k));
  for (const [t, a] of F.prof || []) if (t < T0) con(d + T0 - t, a);
  return ceil === Infinity ? null : Math.max(floor === -Infinity ? 0 : Math.min(floor, ac.alt), ceil);
}

function step(dt){
  S.t += dt;
  for (const f of S.sched) if (!f.spawned && S.t >= f.m*60 - (f.k === 'ARR' && f.m > 0 ? PRE_LEAD : 0)) { f.spawned = true; if (f.k === 'ARR') spawnArrival(f); else if (f.k === 'RES') spawnResident(f); else spawnDeparture(f); }
  const X = S.xing;
  if (APT.xing) {
  if (X.st === 'CLOSING' && S.t >= X.t) { X.st = 'CLOSED'; sys('Winston Churchill Avenue closed: barriers down, crossing clear, FOD check complete.'); renderAtis(); emit('xing', 'CLOSED'); }
  if (X.st === 'OPENING' && S.t >= X.t) { X.st = 'OPEN'; renderAtis(); emit('xing', 'OPEN'); }
  if (X.st === 'CLOSED' || X.st === 'CLOSING') { X.queue += dt*0.8; X.totalClosed += dt; } else X.queue = Math.max(0, X.queue - dt*5);
  }

  stepTows(); if (S.emg) stepEmerg(dt);
  if (S.recalls && S.recalls.length) for (const r of S.recalls.splice(0)) { if (S.t < r.at) { S.recalls.push(r); continue; } if (S.acs.includes(r.ac)) pilot(r.ac, `${r.ac.unit()}, ${r.text}`, true); }
  for (const ac of S.acs) {
    if (ac.state === 'TOW') { ac.onRwy = Math.abs(offOf([ac.x, ac.y])) < 35; ac.rwyId = RWYS[0].id; }
    if (ac.kind === 'ARR' && ac.app && !ac.stand && !ac.handed) planStand(ac);
    if (ac.state === 'PRE') stepPending(ac, dt); else if (ac.ground) stepGround(ac, dt); else stepAir(ac, dt);
    stepNose(ac, dt);
    if (ac.rel) stepRelease(ac);
    if (ac.lost && S.t >= ac.lost.until) { const f = ac.lost.f; ac.lost = null; S.score.pts -= 10; pilot(ac, `${ac.unit()}, back with you, no reply on ${f}`); ac.need = 'Back on frequency'; if (S.sel === ac) renderSel(); }
    ac.histT += dt; if (ac.histT >= 4) { ac.histT = 0; ac.hist.push([ac.x, ac.y]); if (ac.hist.length > 7) ac.hist.shift(); }
  }
  S.acs = S.acs.filter(ac => {
    if (ac.state === 'ONSTAND' && S.t > ac.doneAt) { if (S.sel === ac) S.sel = null; if (ac.stand) ac.stand.occ = null; return false; }
    if (ac.divLanded) { S.score.div++; sys(`${ac.cs} has landed at ${ac.divLanded.name}.`); emit('divlanded', ac); if (S.sel === ac) S.sel = null; return false; }
    if (ac.airborne && ac.state !== 'PRE' && Math.hypot(ac.x - RADAR_REF[0], ac.y - RADAR_REF[1]) > (ac.kind === 'DEP' ? APT.area.dep : ac.state === 'DIVERTING' ? APT.area.div : APT.area.arr)) {
      if (ac.kind === 'DEP') { if (!ac.handed) { S.score.pts -= 30; sys(`${ac.cs} left your area without being transferred.`, true); } else S.score.pts += 20; S.score.departed++; }
      else { S.score.div++; S.score.pts -= ac.state === 'DIVERTING' ? 0 : 40; { const D = ac.state === 'DIVERTING' && divDest(ac); sys(D ? `${ac.cs} has left the area, flying on to ${D.name}.` : `${ac.cs} has left the area (diverted).`, ac.state !== 'DIVERTING'); } }
      emit('exit', ac);
      if (ac.stand && ac.stand.occ === ac) ac.stand.occ = null;
      if (S.sel === ac) S.sel = null; return false;
    }
    return true;
  });
  // separation: 3 NM / 1000 ft (2.5 NM between aircraft both established on final)
  const conf = new Set(), air = S.acs.filter(a => a.airborne && a.alt > 700 && a.state !== 'PRE');
  for (let i = 0; i < air.length; i++) for (let j = i+1; j < air.length; j++) {
    const a = air[i], b = air[j], d = dist(a.x,a.y,b.x,b.y);
    if (Math.abs(a.alt-b.alt) >= 950 || d >= 3) continue;
    if (a.mode === 'FINAL' && b.mode === 'FINAL' && d >= 2.5) continue;
    conf.add(a.cs); conf.add(b.cs);
    const key = [a.cs, b.cs].sort().join('|');
    if (!S.conflicts.has(key)) { S.conflicts.add(key); S.score.los++; S.score.pts -= 50; sys(`Loss of separation: ${a.cs} and ${b.cs} (${d.toFixed(1)} NM, ${Math.round(Math.abs(a.alt-b.alt))} ft).`, true); }
  }
  for (const k of [...S.conflicts]) { const [p,q] = k.split('|'); if (!conf.has(p) || !conf.has(q)) S.conflicts.delete(k); }
  S.conflictSet = conf;
}

function stepAir(ac, dt){
  const Pf = ac.perf, Wv = windAt(ac.alt);
  const dGBR = Math.hypot(ac.x - RADAR_REF[0], ac.y - RADAR_REF[1]);
  let fin = ac.mode === 'FINAL' ? onFinal(ac, finOf(ac)) : null;
  // ── speed
  let tgtS = ac.tgtSpd;
  if (!ac.spdAssigned) {
    if (ac.kind === 'DEP') tgtS = ac.alt < 3000 ? Pf.vr + 45 : ac.alt < 10000 ? 250 : Pf.cruise;
    else if (fin) tgtS = fin.togo < 5 ? Pf.vapp : 170;
    else if (ac.state === 'MISSED') tgtS = 180;
    else tgtS = dGBR < 14 ? 190 : dGBR < 25 ? 220 : 250;
    tgtS = Math.min(tgtS, Pf.cruise);
  }
  if (fin && fin.togo < 4) tgtS = Math.min(tgtS, Pf.vapp + (fin.togo > 2.5 ? 15 : 0));
  ac.ias += clamp(tgtS - ac.ias, -1.3*dt, 2.0*dt);

  // ── lateral
  let tgtH = ac.hdg, track = false;
  if (ac.mode === 'NAV' && ac.route.length) {
    const w = WP[ac.route[0]], d = dist(ac.x, ac.y, ...w.p);
    if (ac.kind === 'ARR' && !ac.app && !ac.askedApp && ac.state !== 'DIVERTING' && ac.route.length === 1 && d < 8) { ac.askedApp = true; if (!ac.need) { ac.need = 'Request approach'; pilot(ac, `approaching ${/final/.test(w.note||'') ? w.note : w.id}, request ${APT.reqApp ? APT.reqApp(S.rwy) : APT.appName} runway ${S.rwy}`); } }
    tgtH = brg(ac.x, ac.y, ...w.p); track = true;
    // fly-by: start the turn onto the next leg early by the turn radius at 25° bank × tan(half the course change)
    const nx = ac.route[1] ? WP[ac.route[1]].p : ac.kind === 'ARR' && ac.app && finOf(ac) ? (() => { const F = finOf(ac), q = onFinal({ x: w.p[0], y: w.p[1] }, F); return q && q.d < 0.5 ? pathAhead(F, q, 2) : null; })() : null;
    const lead = nx ? turnLead(ac, w.p, nx) : 0.7;
    if (d < lead) {
      ac.route.shift();
      if (!ac.route.length) {
        if (ac.kind === 'ARR' && ac.app) {
          // an RNP start fix reached heading the wrong way (MONEC from the north): one lap of its hold reverses the course
          const F = finOf(ac);
          if (F.rnp && w.hold && Math.abs(angDiff(ac.hdg, brg(...F.pts[0], ...F.pts[1]))) > 100) { ac.mode = 'HOLD'; ac.hold = { c: w.p, inb: w.hold.inb, left: !!w.hold.left, ph: 'in', name: w.id, t: 0, join: true, laps: 0 }; }
          else { ac.mode = 'FINAL'; ac.finI = null; fin = onFinal(ac, F); }
        }
        else if (ac.kind === 'ARR' && ac.state === 'DIVERTING') { ac.mode = 'HDG'; ac.tgtHdg = Math.round(ac.hdg); ac.divDct = true; }
        else if (ac.kind === 'ARR') {
          // end of the arrival routing without an approach clearance: hold where it is (on the final entry fix), never fly back to UPMUP/ODLUK
          const named = !!w.hold, hf = w.id;
          ac.mode = 'HOLD'; ac.state = 'HOLDING'; ac.hold = { c: w.p, inb: named ? w.hold.inb : ac.hdg, left: named && !!w.hold.left, ph: named ? 'in' : 'turn1', name: /final/.test(w.note||'') ? w.note : hf, t: 0 };
          pilot(ac, `no approach clearance, holding at ${ac.hold.name}, ${altShort(Math.round(ac.alt/100)*100)}, request ${APT.appName}`); ac.need = 'Request approach';
        }
        else { ac.mode = 'HDG'; ac.tgtHdg = Math.round(ac.hdg); }
      }
    }
  }
  if (ac.mode === 'HDG') tgtH = ac.tgtHdg;
  if (ac.mode === 'HOLD') {
    const h = ac.hold; h.t = (h.t||0) + dt;
    if (h.ph === 'in') { tgtH = brg(ac.x, ac.y, ...h.c); track = true; ac.turnDir = 0; if (h.join && h.laps && ac.app && dist(ac.x, ac.y, ...h.c) < (() => { const F = finOf(ac), q = onFinal({ x: h.c[0], y: h.c[1] }, F); return q && q.d < 0.5 ? turnLead(ac, h.c, pathAhead(F, q, 2)) : 1; })()) { ac.mode = 'FINAL'; ac.hold = null; ac.finI = null; fin = onFinal(ac, finOf(ac)); } else if (dist(ac.x, ac.y, ...h.c) < 0.5) { h.ph = 'turn1'; h.t = 0; } }
    else if (h.ph === 'turn1') { const hd = h.left ? -1 : 1; tgtH = norm(ac.hdg + 90*hd); ac.turnDir = hd; if (Math.abs(angDiff(ac.hdg, h.inb+180)) < 8) { h.ph = 'out'; h.t = 0; } }
    else if (h.ph === 'out') { tgtH = norm(h.inb + 180); track = true; ac.turnDir = 0; if (h.t > 60) { h.ph = 'turn2'; h.t = 0; } }
    else if (h.ph === 'turn2') { const hd = h.left ? -1 : 1; tgtH = norm(ac.hdg + 90*hd); ac.turnDir = hd; if (Math.abs(angDiff(ac.hdg, h.inb)) < 25) { h.ph = 'in'; h.laps = (h.laps || 0) + 1; } }
  }
  // capture the SRA final from vectors
  if (ac.kind === 'ARR' && ac.app && ac.mode === 'HDG' && !finOf(ac).rnp) {
    const q = onFinal(ac, finOf(ac));
    if (q.togo > 3.2 && q.togo < 25 && Math.abs(q.xte) < 0.45 && Math.abs(angDiff(ac.hdg, q.crs)) < 70 && (q.i > 0 || q.t > -12)) { ac.mode = 'FINAL'; fin = q; }
  }
  if (ac.mode === 'FINAL' && fin) {
    // close to the path it steers for a point about 15 seconds ahead along it, so curved (RF) legs are flown as one
    // smooth arc the way an RNP autopilot does; further off it intercepts at up to 35°
    const F = finOf(ac), la = clamp((ac.gs || ac.ias)/3600*15, 0.5, 1.5);
    if (Math.abs(fin.xte) > 0.8*la) tgtH = norm(fin.crs + clamp(-fin.xte*70, -35, 35));
    else tgtH = brg(ac.x, ac.y, ...pathAhead(F, fin, la));
    track = true; ac.state = 'FINAL'; ac.turnDir = 0;
  }
  let hdgCmd = tgtH;
  if (track) { const tas = ac.ias*(1+ac.alt/1000*0.018) || 1; const cw = Wv[0]*Math.cos(tgtH*D2R) - Wv[1]*Math.sin(tgtH*D2R); hdgCmd = norm(tgtH - Math.asin(clamp(cw/tas, -0.5, 0.5))*R2D); }
  const diff = angDiff(ac.hdg, hdgCmd);
  let turn = diff;
  if ((ac.mode === 'HDG' || ac.mode === 'HOLD') && ac.turnDir && Math.abs(diff) > 4) turn = ac.turnDir > 0 ? (diff < 0 ? 360+diff : diff) : (diff > 0 ? diff-360 : diff);
  if (ac.mode === 'HDG' && Math.abs(diff) < 2) ac.turnDir = 0;
  // turns are flown on bank angle like the autopilot: it rolls in and out at a few degrees a second, banks up to 25°,
  // and the rate of turn follows from bank and true airspeed (g·tan φ / V). Off the approach it keeps to rate one (3°/s).
  { const tas = Math.max(ac.ias*(1+ac.alt/1000*0.018), 60), K = 1091/tas;   // °/s of turn per unit of tan(bank)
    const cap = ac.mode === 'FINAL' ? 25 : Math.min(25, Math.atan(3/K)*R2D);
    const want = clamp(turn*1.6, -cap, cap), roll = Pf.wake === 'H' ? 4 : 5;
    ac.bank = (ac.bank || 0) + clamp(want - (ac.bank || 0), -roll*dt, roll*dt);
    ac.hdg = norm(ac.hdg + K*Math.tan(ac.bank*D2R)*dt); }

  // ── vertical
  let tgtA = ac.tgtAlt ?? ac.alt;
  if (ac.via && ac.app && ac.mode === 'NAV') { const p = viaAlt(ac); if (p != null && p > tgtA) tgtA = Math.min(p, Math.max(ac.alt, tgtA)); }
  if (fin) { const gp = gpAlt(fin.togo, apk(ac)); tgtA = Math.min(ac.alt, gp, ac.cleared ?? 1e9); if (ac.alt > gp + 40) tgtA = Math.min(ac.alt, Math.max(gp, gpCeil(fin.togo, apk(ac)))); }
  const vmax = tgtA > ac.alt ? Pf.climb*(ac.alt > 10000 ? 0.7 : 1) : (fin ? (ac.alt > gpAlt(fin.togo, apk(ac)) + 150 ? 2000 : 1100) : Pf.desc);
  if (fin && ac.alt <= gpAlt(fin.togo, apk(ac)) + 150) {
    // on the glidepath: feed-forward the 2.8° descent rate, correct the error, flare onto the runway
    const te = tdElev(apk(ac)), gp = fin.togo > 0.05 ? gpAlt(fin.togo, apk(ac)) : te;
    ac.vs = clamp(-ac.gs*gpRate(apk(ac), fin.togo)/60 + (gp - ac.alt)*4, -2000, 300);
    if (ac.alt + ac.vs/60*dt < te) ac.vs = (te - ac.alt)*60/dt;
  } else {
    // above the glidepath on final: descend at the glidepath's own rate plus the correction, so it gets back down onto it
    // (the correction alone settles a steady few hundred feet high, and the aircraft lands long)
    const ff = fin && tgtA < ac.alt ? ac.gs*gpRate(apk(ac), fin.togo)/60 : 0;
    ac.vs = clamp((tgtA - ac.alt)*3 - ff, -vmax, vmax);
  }
  ac.alt += ac.vs/60*dt;

  // ── motion
  const tas = ac.ias*(1+ac.alt/1000*0.018);
  const vx = tas*Math.sin(ac.hdg*D2R) + Wv[0], vy = tas*Math.cos(ac.hdg*D2R) + Wv[1];
  ac.gs = Math.hypot(vx, vy); ac.trk = norm(Math.atan2(vx, vy)*R2D);
  ac.x += vx/3600*dt; ac.y += vy/3600*dt;

  // ── departures
  if (ac.kind === 'DEP' && (ac.state === 'AIRBORNE' || ac.state === 'CLIMB')) {
    APT.depTurn(ac);
    if (ac.alt > 1000 && !ac.calledAir) { ac.calledAir = true; if (ac.freq === 'TWR') ac.need = 'Airborne, transfer to Radar'; }
    if (ac.freq === 'RAD' && !ac.calledRad) { ac.calledRad = true; ac.state = 'CLIMB'; pilot(ac, PH.depCall(ac)); }
    const clearRock = APT.depClear(ac);
    if (ac.onSid && ac.mode === 'HDG' && clearRock && (ac.alt > 3500 || !crossesRock(ac, WP[EXIT_ROUTE[ac.gate][0]].p))) { ac.onSid = false; ac.reqDct = true; ac.mode = 'NAV'; ac.route = EXIT_ROUTE[ac.gate].slice(); }
    if (ac.calledRad && !ac.reqDct && ac.mode === 'HDG' && clearRock) { ac.reqDct = true; const fx = EXIT_ROUTE[ac.gate][0]; pilot(ac, `request direct ${fx}`); ac.need = `Request direct ${fx}`; }
    if (ac.calledRad && !ac.reqClimb && !ac.need && ac.alt > APT.initClimb - 400 && (ac.tgtAlt ?? 0) <= APT.initClimb) { ac.reqClimb = true; pilot(ac, `${ac.sid ? 'on the ' + sidSpoken(ac.sid) + ', ' : ''}request further climb`); ac.need = 'Request climb'; }
    if (ac.mode === 'NAV' && !ac.route.length) { ac.mode = 'HDG'; ac.tgtHdg = Math.round(ac.hdg); }
    if (ac.calledRad && !ac.handed && dGBR > APT.handoffNM && !ac.askedHo) { ac.askedHo = true; ac.need = 'Ready for transfer'; }
  }

  if (ac.divertAt && S.t >= ac.divertAt) { ac.divertAt = null; pilot(ac, `we'd like to divert to ${ac.divertTo[0]}, request direct ${ac.divertTo[1]} climbing ${altWords(APT.divertAlt || 8000)}`); ac.need = `Diverting to ${ac.divertTo[0]}`; ac.diverting = ac.divertTo[1]; }
  // an approved diversion: past its fix it heads for the alternate, descends and lands there. Beyond the radar area
  // it is shown flying on to it (far.js)
  if (ac.state === 'DIVERTING' && ac.divDct && ac.mode === 'HDG') { const D = divDest(ac); if (D) {
    const d = dist(ac.x, ac.y, ...D.p); ac.tgtHdg = Math.round(brg(ac.x, ac.y, ...D.p)) || 360; ac.turnDir = 0;
    if (d < ac.alt/300 + 4) ac.tgtAlt = ac.cleared = Math.min(ac.tgtAlt ?? ac.alt, Math.max(1500, Math.round((d - 3)*3)*100));
    if (d < 3) ac.divLanded = D; } }
  // ── missed approach: climb 4000, turn south once clear (left for 27, right for 09)
  if (ac.state === 'MISSED' && ac.missRoute && ac.alt > 400) { ac.mode = 'NAV'; ac.route = ac.missRoute; ac.missRoute = null; ac.gaTurn = true; }   // RNP: fly the published missed approach
  else if (ac.state === 'MISSED' && !ac.missRoute && !ac.gaTurn && !ac.gaTurnDone) APT.gaTurn(ac);

  // ── approach checks
  if (fin && ac.state !== 'MISSED') {
    const rw = ac.app, w = S.wx, F = finOf(ac);
    if (APT.xing && !ac.warned15 && fin.togo < 15 && S.xing.st === 'OPEN') { ac.warned15 = true; sys(`${ac.cs} is inside 15 NM: close Winston Churchill Avenue to pedestrians now.`); }
    if (APT.xing && !ac.warned10 && fin.togo < 10) { ac.warned10 = true; if (S.xing.st === 'OPEN' || S.xing.st === 'OPENING') { S.score.pts -= 15; sys(`${ac.cs} at 10 NM with the road still open (late closure).`, true); } }
    if (!ac.checked && fin.togo < (F.decNM || 3.05) && fin.togo > (F.decMin || 1.5)) { // decision point (Gibraltar: Point X-Ray / Yankee)
      ac.checked = true; const dn = F.decName || `Point ${F.name}`;
      if (!appMinsOk(F, rw, w)) return goAround(ac, F.rnp ? 'not visual at minimums' : F.decFail || `not visual at ${dn}`);
      if (ac.alt < (F.minAlt || 880)) { S.score.incidents++; S.score.pts -= 40; sys(`${ac.cs} crossed ${dn} below ${F.minText || '920 ft'}.`, true); }
      pilot(ac, F.decCall ? F.decCall(rw) : `${dn}, visual`); ac.freq = 'TWR';   // F.decCall: the airport's own words at this point (London City: established on the ILS)
      if (!ac.ctl) ac.need = F.decNeed || 'Visual, needs landing clearance';
    }
    for (const g of F.gates || []) if (fin.togo < g.togo && !(ac.gatesDone ||= {})[g.at]) { ac.gatesDone[g.at] = true; if (ac.alt < g.min - 30) { S.score.incidents++; S.score.pts -= 30; sys(`${ac.cs} passed ${g.at} at ${Math.round(ac.alt)} ft, below the ${g.min} ft minimum.`, true); } }
    if (!ac.shearChecked && fin.togo < 2) {
      ac.shearChecked = true;
      const ex = turbExcess(w);
      let p = ex > 0 ? clamp(0.1 + ex/30, 0, 0.55) : 0;
      { const sw = APT.shear(ac, rw, w); if (sw) return goAround(ac, sw); }
      if (w.cb) p = Math.max(p, 0.15);
      const lim = windLimit(ac, rw); if (lim) return goAround(ac, lim);
      if (ac.wsTold) p *= 0.6;   // briefed crews add speed and are ready for it
      if (Math.random() < p) { if (S.emg && (!S.emg.ws || S.t - S.emg.ws.t > 300)) shearReport(ac, rw); return goAround(ac, APT.shearWhy(rw)); }
    }
    if (fin.togo < 0.9 && !ac.ctl && !ac.warnedCtl) { ac.warnedCtl = true; pilot(ac, `short final runway ${rw}, request landing clearance`); ac.need = 'Short final, no clearance'; }
    { const blk = rwyBlocked(); if (blk && fin.togo < 0.45) return emgBlockedFinal(ac, blk); }
    if (fin.togo < 0.4 && !ac.ctl) return goAround(ac, 'no landing clearance');
    if (fin.togo < 0.4 && S.acs.some(o => o !== ac && onRunway(o, rw))) return goAround(ac, 'runway occupied');
    if (APT.xing && fin.togo < 0.4 && S.xing.st !== 'CLOSED') { S.score.incidents++; S.score.pts -= 60; sys(`${ac.cs} went around: Winston Churchill Avenue was not closed.`, true); return goAround(ac, 'people on the runway crossing'); }
    if (fin.togo < 1.5 && ac.alt > gpAlt(fin.togo, apk(ac)) + 400) return goAround(ac, 'unstable, too high');
    if (fin.togo < 0.7) { // short final: settle onto the extended centreline (the 09 SRA joins it on a curve)
      const R = rwyOf(rw), m = R.mOf([ac.x, ac.y]), off = R.offOf([ac.x, ac.y]);
      if (Math.abs(off) < 400) { const k = Math.exp(-dt*0.7); [ac.x, ac.y] = R.rm(m, off*k); ac.hdg = norm(ac.hdg + clamp(angDiff(ac.hdg, crsOf(rw)), -3*dt, 3*dt)); }
    }
    if (fin.togo < -0.12 && ac.alt < tdElev(rw) + 70) { // touchdown
      const R = rwyOf(rw); ac.ground = true; ac.onRwy = true; ac.rwyId = R.id; ac.alt = ELEV; ac.state = 'ROLLOUT'; ac.mode = 'GROUND'; ac.vs = 0;
      ac.rollDir = rw === R.lo ? 1 : -1; ac.hdg = crsOf(rw); { const m = R.mOf([ac.x, ac.y]), off = R.offOf([ac.x, ac.y]); [ac.x, ac.y] = R.rm(m, clamp(off, -8, 8)); } S.score.landed++; S.score.pts += 25; ac.need = null;
      emit('landed', ac);
    }
  }
  { const Rz = APT.restricted; if (Rz && ac.alt < Rz.top && !(Rz.ok && Rz.ok(ac)) && inPoly([ac.x, ac.y], Rz.poly)) { if (!ac.infr) { ac.infr = true; S.score.infr++; S.score.pts -= 40; sys(Rz.msg(ac), true); } } else ac.infr = false; }
  { const T = APT.terrain, hit = T && (T.check ? T.check(ac) : ac.alt < T.min && inPoly([ac.x, ac.y], T.poly)); if (hit) { if (!ac.terr) { ac.terr = true; S.score.incidents++; S.score.pts -= (ac.alt < (T.lowAt ? T.lowAt(hit) : T.low) ? 80 : 30); sys(T.msg(ac, hit), true); } } else ac.terr = false; }
}

// aircraft giving way in a ring (A waits for B, B for C, C for A) would wait for ever: the one with right of way in
// the ring carries on. Right of way: on the runway first, then leaving it, then the lower callsign.
const wayRank = a => [a.onRwy ? 0 : 1, a.state === 'VACATING' ? 0 : 1, a.cs];
const rankLess = (a, b) => { const A = wayRank(a), B = wayRank(b); for (let i = 0; i < 3; i++) if (A[i] !== B[i]) return A[i] < B[i]; return false; };
function waitLoopWinner(ac, o){
  const ring = [ac]; let w = o;
  for (let n = 0; n < 8 && w; n++) {
    if (w === ac) return ring.every(x => x === ac || rankLess(ac, x));
    if (ring.includes(w)) return false;
    ring.push(w); w = w.waiting ? S.acs.find(x => x.cs === w.waiting) : null;
  }
  return false;
}
// A taxiing aircraft's position (x, y) is its nose: it stops with the nose at a holding point line and turns where
// the nose meets the turn, the body trailing behind. Parked, pushing or taking off, it is the middle of the aircraft.
// ac.nose (metres) is how far the middle sits behind (x, y); it eases between the two so the icon never jumps.
const NOSE_STATES = new Set(['TAXI', 'HOLDPT', 'HELD', 'VACATING', 'ROLLED', 'ROLLOUT', 'LINEUP', 'LINEDUP']);
function stepNose(ac, dt){
  const want = ac.ground && NOSE_STATES.has(ac.state) ? ac.perf.len/2 : 0, cur = ac.nose || 0;
  if (cur !== want) ac.nose = want > cur ? Math.min(want, cur + 4*dt) : Math.max(want, cur - 4*dt);
}
// where the middle of the aircraft is (draw the icon there, and hit-test clicks there)
const acMid = ac => ac.nose ? [ac.x - Math.sin(ac.hdg*D2R)*ac.nose*M2NM, ac.y - Math.cos(ac.hdg*D2R)*ac.nose*M2NM] : [ac.x, ac.y];
function stepGround(ac, dt){
  if (ac.state === 'PARKED' && ac.kind === 'DEP' && !ac.need && !ac.tow && S.t >= ac.reqAt) { ac.need = 'Request start-up'; pilot(ac, PH.startReq(ac)); }
  if (ac.state === 'READY' && !ac.need && S.t >= ac.readyAt) { ac.need = 'Ready to taxi'; pilot(ac, 'ready to taxi'); }
  if (ac.path) {
    const tgt = ac.path.pts[0], d = dist(ac.x, ac.y, ...tgt);
    let spd = ac.path.reverse ? ac.path.spd : Math.min(ac.path.spd, taxiLimit(ac));
    if (ac.state === 'VACATING' && ac.onRwy) spd = Math.min(vacSpeed(ac, dt), spd < ac.path.spd ? spd : Infinity);
    if (ac.held) spd = 0;
    // a runway in use ahead: stop at its holding position until cleared to cross (CROSS)
    { const k = xingAhead(ac);
      if (k >= 0) {
        let D = dist(ac.x, ac.y, ...ac.path.pts[0]); for (let i = 1; i <= k; i++) D += dist(...ac.path.pts[i-1], ...ac.path.pts[i]);
        if (D < 0.25) spd = Math.min(spd, D < 0.004 ? 0 : Math.max(3, Math.sqrt(2*TAXI_DEC*Math.max(0, D - 0.003)*3600)));
        if (D < 0.006 && ac.hsAt !== ac.path.pts[k].hs) { ac.hsAt = ac.path.pts[k].hs; ac.need = `Holding short ${rwyName(ac.hsAt)}`; pilot(ac, PH.holdShort(ac, rwyName(ac.hsAt))); }
      } }
    // a tow crossing from Charlie holds short of the runway while anything is at, or taxiing to, holding point Alpha,
    // where the crossing comes off; otherwise the tug and that departure block each other with the runway occupied
    if (ac.state === 'TOW' && ac.towCross && !ac.onRwy && spd > 0) {
      const off = offOf([ac.x, ac.y]);
      if (off < -36 && off > -90) {
        const blk = S.acs.find(o => o !== ac && o.ground && o.hp === 'A' && ['TAXI', 'HOLDPT', 'LINEUP', 'LINEDUP'].includes(o.state));
        if (blk) { spd = 0; if (ac.waiting !== blk.cs) { ac.waiting = blk.cs; log('plt', `tug with ${ac.cs}, holding short of the runway at Charlie, traffic for Alpha`, 'TUG'); } }
      }
    }
    // give way: stop if another aircraft on the ground is close ahead (not under a tug on its push line: that space is its own)
    if (!ac.path.reverse && !ac.path.tug && spd > 0) for (const o of S.acs) {
      if (o === ac || !o.ground) continue;
      const dd = dist(ac.x, ac.y, o.x, o.y)/M2NM; if (dd > 80 || dd < 1) continue;
      if (o.waiting === ac.cs && (ac.state === 'VACATING' || (o.state !== 'VACATING' && ac.cs < o.cs))) continue; // break a head-on stand-off: the aircraft leaving the runway goes first
      if (waitLoopWinner(ac, o)) continue;   // three or more waiting on each other in a ring: one of them goes first
      if (ac.onRwy && !o.onRwy && o.state === 'HOLDPT') continue;   // never stop on the runway for traffic waiting at a holding point
      if (Math.abs(angDiff(ac.hdg, brg(ac.x, ac.y, o.x, o.y))) < 40 && !(o.state === 'PARKED' || o.state === 'ONSTAND')) { spd = 0; ac.waiting = o.cs; break; }
    }
    if (spd > 0) ac.waiting = null;
    // speed builds up and drops off gradually; a stop for traffic brakes harder
    const cur = ac.gs || 0, v = spd >= cur ? Math.min(spd, cur + TAXI_ACC*dt) : Math.max(spd, cur - (spd === 0 || cur > spd + 8 ? 6 : TAXI_DEC)*dt);   // well over the limit for the turn ahead (off a runway at speed): firm braking
    const mv = v/3600*dt; ac.gs = v; ac.ias = v;
    const done = () => {
      const p = ac.path.pts.shift(); ac.path.prev = p;
      // crossing a runway: on it from the holding position on one side to the one on the other
      if (p.hs && p.hs === ac.xing) { if (ac.xcross) emit('rwyx', ac); ac.xing = null; ac.xcross = null; ac.onRwy = false; ac.xok = (ac.xok || []).filter(r => r !== p.hs); }
      else if (p.hs && ac.path.pts.length && hsEnters([p, ...ac.path.pts], 0)) { ac.xing = ac.xcross = p.hs; if (activeRwy(p.hs)) { ac.onRwy = true; ac.rwyId = p.hs; } if (ac.hsAt === p.hs) { ac.hsAt = null; if (ac.need && ac.need.startsWith('Holding short')) ac.need = null; } }
      if (!ac.path.pts.length) { const cb = ac.path.onDone; ac.path = null; ac.gs = 0; cb && cb(); }
    };
    if (v <= 0) {}
    else if (ac.path.reverse) {   // pushed by the tug: straight back along the push line
      const b = brg(ac.x, ac.y, ...tgt); ac.hdg = norm(ac.hdg + clamp(angDiff(ac.hdg, norm(b+180)), -25*dt, 25*dt));
      if (d <= mv) { ac.x = tgt[0]; ac.y = tgt[1]; done(); } else { ac.x += (tgt[0]-ac.x)/d*mv; ac.y += (tgt[1]-ac.y)/d*mv; }
    } else {
      // steered like a nosewheel: it rolls along its heading, turning no tighter than its radius allows, and starts each
      // turn early so it rounds the corner on an arc instead of pivoting on the point
      // the last turn, off the taxiway onto a short stand lead-in line, is made slowly and tight (path.inR, metres), so the
      // aircraft lines up on the lead-in instead of sailing past the stand and coming back round
      const R = ac.path.inR && ac.path.pts.length <= 2 ? Math.min(taxiR(ac), ac.path.inR) : tgt.tight || (ac.path.pts[1] && ac.path.pts[1].tight && d < 0.008) ? clamp(v*1.4, 12, taxiR(ac)) : taxiR(ac), want = brg(ac.x, ac.y, ...tgt);
      // steer for a point a little way ahead along the route (about two thirds of a turn radius), not the next point
      // itself: on a curve drawn as many short legs it then follows the curve instead of weaving across it
      // past the end it looks on along the last leg, so the aircraft finishes lined up with it
      const aim = (() => { let rem = Math.max(6, R*0.65)/1852, from = [ac.x, ac.y], back = ac.path.prev || from;
        for (const p of ac.path.pts) { const sg = dist(...from, ...p); if (sg >= rem) return [from[0] + (p[0]-from[0])*rem/sg, from[1] + (p[1]-from[1])*rem/sg]; rem -= sg; from = p; }
        const P = ac.path.pts, a = P.length > 1 ? P[P.length-2] : back, L = dist(...a, ...from);
        return L > 1e-6 ? [from[0] + (from[0]-a[0])/L*rem, from[1] + (from[1]-a[1])/L*rem] : from; })();
      const err = angDiff(ac.hdg, d > 0.0005 ? brg(ac.x, ac.y, ...aim) : want), errT = angDiff(ac.hdg, want);
      const rate = Math.max(v*0.5144/R*R2D, 4);
      ac.hdg = norm(ac.hdg + clamp(err, -rate*dt, rate*dt));
      const last = ac.path.pts.length === 1;
      if (last && d <= mv) { ac.x = tgt[0]; ac.y = tgt[1]; done(); }
      else {
        ac.x += Math.sin(ac.hdg*D2R)*mv; ac.y += Math.cos(ac.hdg*D2R)*mv;
        const d2 = dist(ac.x, ac.y, ...tgt);
        if (last) { if (d2 < (ac.path.fine ? mv : 0.0015) || (Math.abs(errT) > 90 && d2 < 0.01)) { ac.x = tgt[0]; ac.y = tgt[1]; done(); } }
        else {
          const nxt = ac.path.pts[1], th = Math.abs(angDiff(want, brg(...tgt, ...nxt)));
          const lead = Math.min(R/1852*Math.tan(Math.min(th, 150)*D2R/2), dist(...tgt, ...nxt)/2);
          if (d2 <= Math.max(lead, mv, 0.0008) || (Math.abs(angDiff(ac.hdg, brg(ac.x, ac.y, ...tgt))) > 90 && d2 < 2*R/1852)) done();   // reached, or already passed
        }
      }
    }
  }
  if (ac.onRwy && ac.state === 'VACATING' && !ac.xcross && Math.abs(rwyById(ac.rwyId).offOf([ac.x, ac.y])) > 45) ac.onRwy = false;
  if (ac.state === 'ROLLOUT') {
    const R = rwyById(ac.rwyId);
    ac.ias = Math.max(15, ac.ias - 4.2*dt); ac.gs = ac.ias;
    const mv = ac.ias/3600*dt; ac.x += R.RU[0]*ac.rollDir*mv; ac.y += R.RU[1]*ac.rollDir*mv;
    const m = R.mOf([ac.x, ac.y]), off = R.offOf([ac.x, ac.y]);
    if (Math.abs(off) > 0.05) [ac.x, ac.y] = R.rm(m, off*Math.exp(-dt*1.5));   // keep the roll-out on the centreline
    // below 40 kt the crew picks its exit and vacates by itself, reporting which way it is going. Landed long and
    // running out of runway, it brakes hard first: it never stops on the runway waiting to be told to vacate.
    if (ac.ias > 40 && (m < R.roll[0] || m > R.roll[1])) { ac.ias = Math.max(40, ac.ias - 12*dt); ac.gs = ac.ias; }
    if (ac.ias <= 40) {
      startVacate(ac, true);
      pilot(ac, `${ac.backtrack ? 'backtracking, ' : ''}vacating via ${PHON[ac.exit]}, ${ac.stand ? 'for stand ' + ac.stand.id : 'as directed'}`);
    }
  }
  if (ac.state === 'TAKEOFF') {
    ac.ias += (ac.perf.wake === 'H' ? 4.0 : 4.2)*dt; ac.gs = ac.ias;
    const R = rwyOf(ac.depRwy), u = ac.depRwy === R.hi ? -1 : 1, mv = ac.ias/3600*dt;
    ac.x += R.RU[0]*u*mv; ac.y += R.RU[1]*u*mv;
    if (ac.ias >= ac.perf.vr) {
      ac.ground = false; ac.onRwy = false; ac.state = 'AIRBORNE'; ac.mode = 'HDG'; ac.alt = ELEV + 10; ac.ias = ac.perf.vr;
      APT.liftoff(ac);
      ac.tgtAlt = ac.cleared = APT.initClimb; ac.onSid = true; S.score.pts += 10;
      emit('airborne', ac);
    }
  }
  // Road crossing: anything moving along the runway across the avenue with the barriers up is an incident
  if (APT.xing && ac.onRwy && ac.gs > 1) {
    const m = mOf([ac.x, ac.y]), mp = ac.lastM ?? m; ac.lastM = m;
    if ((mp - XING_M)*(m - XING_M) < 0 && Math.abs(offOf([ac.x, ac.y])) < 30 && S.xing.st !== 'CLOSED') {
      S.score.incidents++; S.score.pts -= 60; sys(`INCIDENT: ${ac.cs} crossed Winston Churchill Avenue with the barriers up.`, true);
    }
  } else ac.lastM = undefined;
}
