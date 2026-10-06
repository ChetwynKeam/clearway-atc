// ═════════════════════════ Custom traffic: you choose how many flights ═════════════════════════
// The session picker's "Custom" mode takes a number of arrivals, departures and general aviation flights and makes up a
// session from the start hour you pick. Airlines, flight numbers, aircraft types and origins/destinations are drawn from
// the airport's own history: its weekly timetable, its extra charters and business jets, and every day of real flights
// in flights.json (the live flight pages the site records). GA flights use the business jets and light aircraft the
// airport already sees, with a registration from the home country or the country they fly to or from.
const CUSTOM = { sched: null, key: '', n: { arr: 6, dep: 6, ga: 2 }, src: '' };
try { const o = JSON.parse(localStorage.getItem('cw-custom') || 'null'); if (o) for (const k of ['arr', 'dep', 'ga']) if (o[k] >= 0) CUSTOM.n[k] = Math.min(60, Math.round(o[k])); } catch (e) {}
const CUSTOM_MAX = 60, CUSTOM_ARR_SPAN = 58, CUSTOM_DEP = [4, 68];   // minutes from the start: arrivals reach the entry point, departures leave the stand
const isGaType = t => !!TYPES[t] && (TYPES[t].shape === 'biz' || TYPES[t].wake === 'L');
const pick = a => a[Math.floor(Math.random()*a.length)];
// registration prefixes by ICAO region (callsign form, no hyphen) and the letters after them
const REG_NAT = [['EG', 'G', 4], ['LX', 'G', 4], ['LF', 'F', 4], ['LE', 'EC', 3], ['LI', 'I', 4], ['ED', 'D', 4], ['LS', 'HB', 3], ['LO', 'OE', 3], ['LP', 'CS', 3],
                 ['EH', 'PH', 3], ['EB', 'OO', 3], ['EI', 'EI', 3], ['GM', 'CN', 3], ['K', 'N', 0], ['C', 'C', 4]];
function regFor(icao){
  const r = REG_NAT.find(([p]) => (icao || '').startsWith(p)) || REG_NAT[0], L = () => String.fromCharCode(65 + Math.floor(Math.random()*26));
  if (r[1] === 'N') { const cs = 'N' + (100 + Math.floor(Math.random()*900)) + L() + L(); return { cs, reg: cs }; }   // N123AB
  let s = ''; for (let i = 0; i < r[2]; i++) s += L();
  return { cs: r[1] + s, reg: r[1] + '-' + s };
}
// everything the airport has seen: [{ cs, t, place, kind, stand }] split into airline and GA flights
function customPool(){
  const air = [], ga = [], days = new Set();
  const add = (cs, t, place, kind, stand, from) => {
    if (!cs || !t || !TYPES[t] || !place || place === APT.icao || !AP[place]) return;
    (isGaType(t) ? ga : air).push({ cs, t, place, kind, stand: stand || null });
    if (from) days.add(from);
  };
  for (const [ac, o, , dc, dd, , t, , stand] of TIMETABLE) { add(ac, t, o, 'ARR'); add(dc, t, dd, 'DEP', stand); }
  for (const x of EXTRA) add(x.cs, x.t, x.k === 'ARR' ? x.o : x.d, x.k === 'ARR' ? 'ARR' : 'DEP', x.stand);
  const D = typeof LIVE !== 'undefined' && LIVE.data && LIVE.data.days;
  if (D) for (const k of Object.keys(D)) for (const kind of ['arr', 'dep']) for (const r of D[k][kind] || []) {
    const cs = csOf(r.flight || ''); if (!/^[A-Z]{3}\d/.test(cs)) continue;
    add(cs, typeOf(cs), placeOf(r.place || ''), kind === 'arr' ? 'ARR' : 'DEP', null, k);
  }
  return { air, ga, days: days.size };
}
// a new flight number for an airline, close to the ones it really uses (same number of digits, same letter suffix)
function customCs(e, used){
  const m = e.cs.match(/^([A-Z]{3})(\d+)([A-Z]*)$/); if (!m) return null;
  const len = m[2].length, lo = len > 1 ? 10**(len - 1) : 1, hi = 10**len - 1;
  for (let i = 0; i < 30; i++) {
    const n = Math.min(hi, Math.max(lo, +m[2] + Math.round(rnd(-40, 40)))), cs = m[1] + n + m[3];
    if (!used.has(cs)) { used.add(cs); return cs; }
  }
  return null;
}
function customFlights(n, kind, P, used){
  const out = [];
  for (let i = 0; i < n; i++) {
    let f = null;
    for (let k = 0; k < 12 && !f; k++) {
      if (kind === 'GA') {
        const e = P.ga.length ? pick(P.ga) : null;
        const t = e ? e.t : pick(Object.keys(TYPES).filter(isGaType).concat(['C56X']).filter(x => TYPES[x]));
        const place = e && Math.random() < 0.7 ? e.place : pick((P.ga.length ? P.ga : P.air).map(x => x.place));
        let cs = null, reg = null;
        if (e && /^[A-Z]{3}\d/.test(e.cs) && TEL[e.cs.slice(0, 3)] && Math.random() < 0.5) cs = customCs(e, used);   // a business jet operator (NetJets, VistaJet...)
        if (!cs) { const r = regFor(Math.random() < 0.6 ? APT.icao : place); if (used.has(r.cs)) continue; used.add(r.cs); cs = r.cs; reg = r.reg; }
        f = { cs, t, place, ga: true, ...(reg ? { reg } : {}) };
      } else {
        const e = pick(P.air); if (!e) break;
        const al = e.cs.slice(0, 3), mine = P.air.filter(x => x.cs.startsWith(al));
        const cs = customCs(e, used); if (!cs) continue;
        const stand = kind === 'DEP' && e.kind === 'DEP' && e.stand && STANDS.some(s => s.id === e.stand) ? e.stand : null;
        f = { cs, t: Math.random() < 0.8 ? e.t : pick(mine).t, place: Math.random() < 0.6 ? e.place : pick(mine).place, ...(stand ? { stand } : {}) };   // mostly the type that flies that number
      }
    }
    if (f) out.push(f);
  }
  return out;
}
// times spread evenly across the window with some jitter, in a shuffled order
const spread = (n, a, b) => Array.from({ length: n }, (_, i) => Math.round(Math.max(a, Math.min(b, a + (i + 0.5 + rnd(-0.35, 0.35))*(b - a)/n))));
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random()*(i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function customGenerate(day, hour, n = CUSTOM.n){
  const P = customPool(), used = new Set();
  for (const [ac, , , dc] of TIMETABLE) { if (ac) used.add(ac); if (dc) used.add(dc); }   // never the same as a real timetabled flight
  for (const [cs] of LONG_STAY) used.add(cs);
  const gaArr = Math.round(n.ga/2 + (n.ga % 2 ? rnd(-0.5, 0.5) : 0)), gaDep = n.ga - gaArr;
  const arrs = shuffle([...customFlights(n.arr, 'ARR', P, used), ...customFlights(gaArr, 'GA', P, used)]);
  const deps = shuffle([...customFlights(n.dep, 'DEP', P, used), ...customFlights(gaDep, 'GA', P, used)]);
  const t0 = Math.floor(hour)*60, sched = [];
  spread(arrs.length, 0, CUSTOM_ARR_SPAN).forEach((m, i) => { const f = arrs[i];
    sched.push({ cs: f.cs, t: f.t, k: 'ARR', o: f.place, gate: gateFor(f.place), m, at: hhmm(t0 + m + 15), turn: null, gen: true, ...(f.reg ? { reg: f.reg } : {}) }); });
  // departures leaving in the first half hour are already parked when the position opens (up to half the stands, so the
  // arrivals have somewhere to go); later ones appear on their stand shortly before they call for start-up
  const cap = Math.max(1, Math.floor(STANDS.length/2)); let res = 0;
  spread(deps.length, ...CUSTOM_DEP).sort((a, b) => a - b).forEach((off, i) => { const f = deps[i];
    const base = { cs: f.cs, t: f.t, d: f.place, gate: gateFor(f.place), at: hhmm(t0 + off), gen: true, ...(f.stand ? { stand: f.stand } : {}), ...(f.reg ? { reg: f.reg } : {}) };
    if (off <= 35 && res < cap) { res++; sched.push({ ...base, k: 'RES', m: 0, depM: off }); }
    else sched.push({ ...base, k: 'DEP', m: Math.max(0, off - 6) });
  });
  CUSTOM.src = P.days ? `${APT.icao}’s timetable and ${P.days} day${P.days === 1 ? '' : 's'} of its real flights` : `${APT.icao}’s timetable`;
  return sched.sort((a, b) => a.m - b.m);
}
// the session's flights: the ones shown in the picker, if they were made for this day, hour and numbers
function customSchedule(day, hour){
  const key = [day, Math.floor(hour), CUSTOM.n.arr, CUSTOM.n.dep, CUSTOM.n.ga].join('/');
  if (!CUSTOM.sched || CUSTOM.key !== key) { CUSTOM.sched = customGenerate(day, hour); CUSTOM.key = key; }
  return CUSTOM.sched.map(x => ({ ...x }));
}

// ── session picker ──
const customBox = $('customBox');
function customRead(){
  for (const k of ['arr', 'dep', 'ga']) { const v = Math.round(+$('cn_' + k).value); CUSTOM.n[k] = isFinite(v) ? Math.max(0, Math.min(CUSTOM_MAX, v)) : 0; }
  try { localStorage.setItem('cw-custom', JSON.stringify(CUSTOM.n)); } catch (e) {}
}
function renderCustomSlots(fresh){
  if (fresh) CUSTOM.sched = null;
  const S0 = customSchedule(+daySel.value, +hourSel.value), el = $('slotList');
  const total = CUSTOM.n.arr + CUSTOM.n.dep + CUSTOM.n.ga;
  el.innerHTML = !total ? '<span class="dimmer">Type how many arrivals, departures and GA flights you want.</span>'
    : `<span class="dimmer" style="flex-basis:100%">${S0.length} flights over about an hour, callsigns and types from ${CUSTOM.src}. Shuffle for a different set.</span>`
      + S0.map(f => { const dep = f.k !== 'ARR'; return `<span class="slot ${dep ? 'DEP' : 'ARR'}${f.reg || isGaType(f.t) ? ' ga' : ''}"><b>${f.cs}</b> ${f.t} ${dep ? APT.icao + ' › ' + f.d : f.o + ' › ' + APT.icao} <i>${f.at}Z</i></span>`; }).join('');
}
for (const k of ['arr', 'dep', 'ga']) { const i = $('cn_' + k); i.value = CUSTOM.n[k]; i.addEventListener('input', () => { customRead(); if ($('trafficSel').value === 'custom') renderCustomSlots(true); }); }
$('cnShuffle').onclick = () => renderCustomSlots(true);
$('trafficSel').addEventListener('change', () => {
  const on = $('trafficSel').value === 'custom'; customBox.hidden = !on;
  if (on && typeof liveLoad === 'function') liveLoad().then(() => { if ($('trafficSel').value === 'custom' && !S.running) renderCustomSlots(true); });   // add the real flight history once it has loaded
});
