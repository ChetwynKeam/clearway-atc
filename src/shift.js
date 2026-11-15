// ═════════════════════════ shifts ═════════════════════════
// A shift (Session › Shift: 1, 2 or 4 hours) is a stretch of duty that changes as it goes, as a real one does:
// • you take the position over with a handover briefing (runways, weather and how it is expected to change,
//   procedures in force, the traffic about to come), and hand it to your relief at the end, then the debrief
// • the weather follows a forecast for the time of day: fog that forms through the night and lifts after sunrise, a
//   front that brings rain, low cloud and a wind shift, showers with gusts, or a settled spell. Each change is a new
//   METAR and ATIS letter
// • the supervisor splits positions off to a colleague (an AI controller) when you are working several and the
//   traffic builds up, and band-boxes them back to you when it quietens down
const SHIFT_SPLIT = 12, SHIFT_BOX = 6;   // flights on your frequencies to split a position off, and to take it back
let SHIFT = null;
const pad = (n, k) => String(Math.abs(Math.round(n))).padStart(k, '0');
const hmZ = t => zt(t).slice(0, 5) + 'Z';

// ── the weather, as a METAR built from its parts
function metarOf(f){
  const z = new Date((S.start || Date.now()) + S.t*1000);
  const stamp = pad(z.getUTCDate(), 2) + pad(z.getUTCHours(), 2) + pad(z.getUTCMinutes() - z.getUTCMinutes() % 10, 2) + 'Z';
  const wind = f.spd < 2 ? '00000KT' : f.vrb ? `VRB${pad(f.spd, 2)}KT` : `${pad(Math.round((f.dir || 360)/10)*10 || 360, 3)}${pad(f.spd, 2)}${f.gust ? 'G' + pad(f.gust, 2) : ''}KT`;
  const vis = f.vis >= 9999 ? '9999' : pad(f.vis, 4);
  const rvr = f.vis < 1500 ? ` R${S.rwy}/${pad(clamp(Math.round(f.vis*1.1/25)*25, 50, 1500), 4)}` : '';
  const sky = f.clouds.length ? f.clouds.join(' ') : 'NSC';
  const tt = t => (t < 0 ? 'M' : '') + pad(t, 2);
  const p = APT.inHg ? 'A' + pad(f.qnh*2.953, 4) : 'Q' + pad(f.qnh, 4);
  return [APT.icao, stamp, wind, vis + rvr, ...f.wx, sky, `${tt(f.temp)}/${tt(Math.min(f.temp, f.dew))}`, p].join(' ');
}
const wxParts = w => ({ dir: w.dir, spd: w.spd, gust: w.gust, vrb: w.vrb, vis: w.vis, wx: [...w.wx], clouds: [...w.clouds], temp: w.temp, dew: w.dew, qnh: w.qnh });
function wxApply(f, why){
  const raw = metarOf(f); if (raw === S.wx.raw) return;
  const was = S.rwy; S.wx = parseMetar(raw); nextAtis(true);
  sys(`Weather${why ? ' (' + why + ')' : ''}: ${raw}. Information ${phonetic(S.atis)}.`, true);
  if (typeof rvrUpdate === 'function') rvrUpdate(true);
  if (typeof wxBest === 'function') { const b = wxBest(); if (b && b !== was) sys(`The wind now favours runway ${b}.`, true); }
  if (typeof renderAtis === 'function') renderAtis();
  emit('wxchange', why);
}

// ── the forecast for the shift: a list of changes, each at a time, and a line saying what to expect
function wxPlan(len){
  const w = S.wx, base = wxParts(w), out = [], t0 = S.t, T = (min) => t0 + min*60;
  const [la, lo] = aptLL(), sunAt = t => sunElev((S.start || 0) + t*1000, la, lo);
  let rise = null; for (let m = 0; m <= len + 240; m += 5) if (sunAt(T(m)) >= -0.833 && sunAt(T(m - 5)) < -0.833) { rise = m; break; }
  const lift = from => {   // fog thinning and lifting, a step every quarter of an hour or so
    let m = from; const steps = [[400, ['FG'], ['VV002']], [800, ['BR'], ['BKN003']], [1500, ['BR'], ['BKN005']], [3000, ['BR'], ['SCT006', 'BKN012']], [6000, [], ['SCT012']], [9999, [], ['FEW020']]];
    for (const [vis, wx, clouds] of steps) { if (vis <= base.vis) continue; out.push({ at: T(m), f: { vis, wx, clouds }, why: 'fog lifting' }); m += rnd(10, 20); }
  };
  const foggy = w.vis < 1500 && w.wx.some(x => /FG|BR/.test(x));
  const fogRisk = !w.cb && (w.vrb || w.spd <= 7) && w.temp - w.dew <= 3 && sunAt(T(Math.min(len, 120))) < 8;
  if (foggy) {
    const from = rise != null ? Math.max(20, rise + rnd(45, 110)) : len + 60;
    lift(from);
    return { out, text: rise != null && from < len ? `Fog, expected to lift from about ${hmZ(T(from))}, an hour or two after sunrise (${hmZ(T(rise))}).` : 'Fog, not expected to lift before the end of the shift.' };
  }
  if (fogRisk && (rise == null || rise > 40)) {
    let m = rnd(15, 40); const start = m;
    for (const [vis, wx, clouds] of [[5000, ['BR'], base.clouds], [2500, ['BR'], ['BKN008']], [1200, ['BR'], ['BKN004']], [600, ['FG'], ['VV002']], [300, ['FG'], ['VV001']], [Math.round(rnd(125, 225)/25)*25, ['FG'], ['VV001']]]) {
      out.push({ at: T(m), f: { vis, wx, clouds, spd: Math.min(base.spd, 3), gust: 0, dew: base.temp }, why: 'fog forming' }); m += rnd(8, 15);
    }
    if (rise != null) { base.vis = 150; lift(Math.max(m + 20, rise + rnd(45, 100))); }
    return { out, text: `Light wind and a damp air mass: mist from about ${hmZ(T(start))}, thickening to fog${rise != null && rise < len ? `, lifting after sunrise (${hmZ(T(rise))})` : ' through the night'}.` };
  }
  const r = Math.random();
  if (r < 0.45) {   // a warm front, then the cold front: the wind backs and freshens, rain and low cloud, then a veer and clearing showers
    const t1 = rnd(20, 45), t2 = t1 + rnd(25, 40), t3 = t2 + rnd(20, 35), d = base.dir || 240;
    out.push({ at: T(t1), f: { dir: norm(d - 30), spd: base.spd + 6, gust: 0, vrb: false, vis: 7000, wx: ['-RA'], clouds: ['BKN012', 'OVC025'], qnh: base.qnh - 3 }, why: 'front approaching' });
    out.push({ at: T(t2), f: { dir: norm(d - 20), spd: base.spd + 10, gust: base.spd + 22, vis: 3500, wx: ['RA'], clouds: ['BKN006', 'OVC012'], qnh: base.qnh - 5 }, why: 'rain' });
    out.push({ at: T(t3), f: { dir: norm(d + rnd(70, 100)), spd: base.spd + 8, gust: base.spd + 20, vis: 9999, wx: ['-SHRA'], clouds: ['FEW015', 'SCT030CB'], temp: base.temp - 3, dew: base.dew - 4, qnh: base.qnh - 1 }, why: 'the cold front has passed' });
    out.push({ at: T(t3 + rnd(20, 30)), f: { spd: base.spd + 4, gust: 0, wx: [], clouds: ['FEW025', 'SCT040'] }, why: 'clearing behind the front' });
    return { out, text: `A front: rain and cloud lowering to about 600 ft from ${hmZ(T(t1))}, then a wind shift of 70 to 100° behind it at about ${hmZ(T(t3))} (expect a runway change).` };
  }
  if (r < 0.8) {   // showers, now and then a thunderstorm, with gusts
    let m = rnd(10, 25);
    while (m < len) {
      const ts = Math.random() < 0.2, dur = rnd(8, 15);
      out.push({ at: T(m), f: { gust: base.spd + rnd(10, 18), vis: ts ? 2000 : 4000, wx: [ts ? 'TSRA' : '+SHRA'], clouds: [ts ? 'BKN015CB' : 'BKN018TCU'] }, why: ts ? 'thunderstorm' : 'a heavy shower' });
      out.push({ at: T(m + dur), f: { gust: 0, vis: 9999, wx: [], clouds: ['FEW020', 'SCT035'] }, why: 'the shower has passed' });
      m += dur + rnd(20, 40);
    }
    return { out, text: 'Showers about, some heavy with gusts and the odd thunderstorm: each lasting ten minutes or so.' };
  }
  let m = rnd(25, 40);   // settled: a little change in the wind and the pressure
  while (m < len) { out.push({ at: T(m), f: { dir: base.vrb ? base.dir : norm(base.dir + rnd(-30, 30)), spd: Math.max(3, base.spd + Math.round(rnd(-4, 4))), qnh: base.qnh + Math.round(rnd(-1, 1)) }, why: 'routine update' }); m += rnd(30, 45); }
  return { out, text: 'Settled: no significant change expected.' };
}

// ── the handover briefing
function shiftBrief(out){
  const mine = AI_SEATS.filter(k => S.seats[k] !== 'AI'), ais = AI_SEATS.filter(k => S.seats[k] === 'AI');
  const on = a => a.state !== 'PRE' && !outOfCtl(a);
  const air = S.acs.filter(a => on(a) && a.airborne), hold = air.filter(a => a.mode === 'HOLD');
  const taxi = S.acs.filter(a => on(a) && a.ground && (a.path || a.hsAt || a.onRwy)), waiting = S.acs.filter(a => on(a) && a.ground && a.need && !a.path);
  const soon = S.sched.filter(f => !f.spawned && f.m*60 - S.t < 1800 && f.m*60 >= S.t - 60), arr = soon.filter(f => f.k === 'ARR').length, dep = soon.length - arr;
  const dep0 = typeof depRw === 'function' ? depRw() : S.rwy, st = typeof sunTimes === 'function' ? sunTimes() : {};
  const L = [];
  L.push(['Position', `${mine.length ? mine.map(k => `${AI_NAME[k]} (${seatUnit(k)})`).join(', ') : 'none: every position is on AI'}${ais.length && mine.length ? `. AI colleagues on ${ais.map(k => AI_NAME[k]).join(', ')}` : ''}.`]);
  L.push(['Runways', `${dep0 === S.rwy ? `${S.rwy} for landing and take-off` : `landing ${S.rwy}, departing ${dep0}`}.${S.emg && S.emg.rwyBlock ? ` Runway ${blockRw()} closed: ${S.emg.rwyBlock.why}.` : ''}`]);
  L.push(['Weather', `Information ${phonetic(S.atis)}: ${S.wx.raw}.${S.rvr ? ` RVR ${S.rvr.tdz}/${S.rvr.mid}/${S.rvr.end} m.` : ''}`]);
  if (!out && SHIFT && SHIFT.trend) L.push(['Forecast', SHIFT.trend]);
  L.push(['Procedures', [S.lvpOn ? 'Low visibility procedures in force' : (typeof lvpPrep === 'function' && lvpPrep() ? 'Visibility low: be ready to declare LVP' : 'Normal procedures'), S.flow && S.flow.stop ? `${S.flow.stop.who} has stopped departures` : '', isNight() ? `night, ${st.rise ? 'sunrise ' + st.rise + 'Z' : 'lights on'}` : (st.set ? `sunset ${st.set}Z` : '')].filter(Boolean).join('; ') + '.']);
  L.push(['Traffic', `${air.length ? `${air.length} airborne${hold.length ? `, ${hold.length} holding (${[...new Set(hold.map(a => a.hold && a.hold.name).filter(Boolean))].join(', ') || 'in the stacks'})` : ''}` : 'nothing airborne'}; ${taxi.length ? `${taxi.length} taxiing` : 'nothing taxiing'}${waiting.length ? `, ${waiting.length} on stand waiting for you` : ''}. ${out ? '' : `In the next half hour: ${arr} arrival${arr === 1 ? '' : 's'} and ${dep} departure${dep === 1 ? '' : 's'}.`}`]);
  const em = S.acs.filter(a => on(a) && a.emerg && !a.emerg.done); if (em.length) L.push(['Emergencies', em.map(a => `${a.cs}: ${a.emerg.k}, ${a.emerg.why}`).join('; ') + '.']);
  if (!out && SHIFT) L.push(['Shift', `${SHIFT.len >= 60 ? SHIFT.len/60 + ' hour' + (SHIFT.len > 60 ? 's' : '') : SHIFT.len + ' minutes'}: your relief takes over at ${hmZ(SHIFT.end)}. The supervisor splits positions off to a colleague when it gets busy, and band-boxes them back when it quietens.`]);
  return L;
}
function shiftModal(out){
  document.getElementById('handover')?.remove();
  const wasPaused = S.paused; S.paused = true;
  const box = document.createElement('div'); box.className = 'debrief'; box.id = 'handover';
  box.innerHTML = `<div class="db-card ho-card" role="dialog" aria-label="Handover"><div class="db-hd"><b>${out ? 'Handing over to your relief' : 'Taking over the position'}</b><span class="db-sum">${hmZ(S.t)}</span><span class="grow"></span></div>
    <dl class="ho-list"></dl><div class="ho-ctl">${out ? '<button type="button" class="btn" data-h="debrief">Open the debrief</button><button type="button" class="btn ghost" data-h="close">Close</button>' : '<button type="button" class="btn" data-h="close">I have the position</button>'}</div></div>`;
  const dl = box.querySelector('.ho-list');
  for (const [k, v] of shiftBrief(out)) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; dl.append(dt, dd); }
  document.body.appendChild(box);
  box.querySelector('[data-h="close"]').onclick = () => { box.remove(); S.paused = out ? true : wasPaused; if (!out) sys(`Handover complete: you have the position until ${hmZ(SHIFT.end)}.`); };
  const d = box.querySelector('[data-h="debrief"]'); if (d) d.onclick = () => { box.remove(); if (typeof openDebrief === 'function') openDebrief(); };
}

// ── splitting and band-boxing
function shiftSeat(k, who){
  S.seats[k] = who;
  for (const ac of S.acs) { if (ac.meSeat === k) ac.meSeat = null; if (ac.aiSeat === k) ac.aiSeat = null; }
  if (typeof renderSeats === 'function') renderSeats(); renderSel(); renderStrips(true);
}
const seatLoad = k => S.acs.filter(a => seatOf(a) === k && !outOfCtl(a) && (a.airborne || a.path || a.hsAt || a.onRwy || a.need)).length;
function shiftStaff(){
  const mine = AI_SEATS.filter(k => S.seats[k] !== 'AI'), load = mine.reduce((s, k) => s + seatLoad(k), 0);
  // busy with several positions: split one off (Ground first, then Departure, then Approach)
  if (mine.length >= 2 && load >= SHIFT_SPLIT) {
    SHIFT.busyT ||= S.t;
    if (S.t - SHIFT.busyT > 240) {
      const k = ['GND', 'DEP', 'APP', 'TWR'].find(x => mine.includes(x)); SHIFT.busyT = 0;
      shiftSeat(k, 'AI'); SHIFT.splits.push(k);
      supSay(`You have ${load} flights, I'm splitting ${AI_NAME[k]} off. A colleague has opened ${seatUnit(k)} and takes its traffic from now.`);
    }
  } else SHIFT.busyT = 0;
  // quiet again: band-box the last position split off back in with yours
  if (SHIFT.splits.length) {
    const k = SHIFT.splits[SHIFT.splits.length - 1];
    if (load + seatLoad(k) <= SHIFT_BOX) {
      SHIFT.quietT ||= S.t;
      if (S.t - SHIFT.quietT > 480) { SHIFT.quietT = 0; SHIFT.splits.pop(); shiftSeat(k, 'ME'); supSay(`It's quiet, I'm band-boxing ${AI_NAME[k]} back with you. You are working ${AI_NAME[k]} (${seatUnit(k)}) again.`); }
    } else SHIFT.quietT = 0;
  }
}

const supSay = t => typeof TEAM !== 'undefined' && TEAM.people ? teamSay('SUP', t) : sys('Supervisor: ' + t, true);
function shiftStep(){
  if (!SHIFT || !S.running) return;
  while (SHIFT.plan.length && S.t >= SHIFT.plan[0].at) { const p = SHIFT.plan.shift(); wxApply({ ...wxParts(S.wx), ...p.f }, p.why); }
  if (SHIFT.onBreak) return;   // the colleague on your positions
  breakStep();
  if (S.t - SHIFT.staffT >= 30) { SHIFT.staffT = S.t; shiftStaff(); }
  if (!SHIFT.warned && SHIFT.end - S.t <= 900) { SHIFT.warned = true; sys(`Your relief arrives at ${hmZ(SHIFT.end)}, in 15 minutes.`); }
  if (!SHIFT.done && S.t >= SHIFT.end) { SHIFT.done = true; emit('shiftend'); if (typeof TEAM !== 'undefined' && TEAM.people) teamSay('REL', `Hi, ${TEAM.people.REL} here. Ready to take over when you are.`); else sys('Your relief is here: hand the position over.'); for (const k of SHIFT.splits) S.seats[k] = 'ME'; shiftModal(true); }
}
S.listeners.push(ev => {
  if (ev !== 'start') return;
  if (SHIFT && SHIFT.orig) for (const k of AI_SEATS) S.seats[k] = SHIFT.orig[k];   // the last shift's splits do not carry over
  SHIFT = null;
  const el = document.getElementById('shiftSel'), len = el ? +el.value : 0;
  if (!len || EXERCISES[S.mode] || /^live/.test(S.mode)) return;
  const P = wxPlan(len);
  S.wshift = null;   // the shift's forecast replaces the random wind shifts
  SHIFT = { len, onT: S.t, end: S.t + len*60, plan: P.out.sort((a, b) => a.at - b.at), trend: P.text, splits: [], orig: { ...S.seats }, staffT: 0, busyT: 0, quietT: 0 };
  setTimeout(() => { if (SHIFT && S.running) (typeof teamHandover === 'function' ? teamHandover() : shiftModal(false)); }, 0);
});

// ── rest breaks. UK rules allow at most two hours on position; then a 30-minute break while a colleague works it.
// The supervisor warns ten minutes before. You can put it off twice by ten minutes; after that it is not optional,
// and going past two hours costs 10 points. On the break the AI colleague works your positions and the game runs
// the half hour through; you come back to a briefing on what changed while you were away.
const BRK_ON = 7200, BRK_LEN = 1800;
function breakStep(){
  if (!SHIFT || SHIFT.onBreak || SHIFT.done) return;
  SHIFT.onT ??= S.t - 0;
  const due = SHIFT.onT + BRK_ON + (SHIFT.putOff || 0)*600;
  if (SHIFT.end - due < 20*60) return;   // the end of the shift comes first
  if (!SHIFT.brkWarn && S.t >= due - 600) { SHIFT.brkWarn = true; supSay(`Your break is due at ${hmZ(due)}. ${typeof TEAM !== 'undefined' && TEAM.people ? TEAM.people.REL : 'A colleague'} will relieve you.`); }
  if (!SHIFT.brkAsk && S.t >= due) { SHIFT.brkAsk = true; breakModal(); }
  if (!SHIFT.overT && S.t >= SHIFT.onT + BRK_ON + 1500) { SHIFT.overT = true; S.score.pts -= 10; supSay('You are well past two hours on position (−10). Take your break now.'); breakModal(); }
}
function breakModal(){
  document.getElementById('handover')?.remove();
  S.paused = true;
  const can = (SHIFT.putOff || 0) < 2 && !SHIFT.overT;
  const box = document.createElement('div'); box.className = 'debrief'; box.id = 'handover';
  box.innerHTML = `<div class="db-card ho-card" role="dialog" aria-label="Break"><div class="db-hd"><b>Time for your break</b><span class="db-sum">${hmZ(S.t)}</span></div>
    <p class="ho-p">You have been on position for ${Math.round((S.t - SHIFT.onT)/60)} minutes. ${typeof TEAM !== 'undefined' && TEAM.people ? TEAM.people.REL : 'A colleague'} takes your positions for 30 minutes; the game runs the half hour through and you come back to a briefing.</p>
    <div class="ho-bar" hidden><i></i></div>
    <div class="ho-ctl">${can ? '<button type="button" class="btn ghost" data-h="later">Ten more minutes</button>' : ''}<button type="button" class="btn" data-h="go">Hand over and take the break</button></div></div>`;
  document.body.appendChild(box);
  const later = box.querySelector('[data-h="later"]');
  if (later) later.onclick = () => { SHIFT.putOff = (SHIFT.putOff || 0) + 1; SHIFT.brkAsk = false; SHIFT.brkWarn = true; box.remove(); S.paused = false; supSay(`OK, ten more minutes${SHIFT.putOff >= 2 ? ', but that\'s the last time' : ''}.`); };
  box.querySelector('[data-h="go"]').onclick = () => breakRun(box);
}
function breakRun(box){
  const mine = AI_SEATS.filter(k => S.seats[k] !== 'AI'), before = { rwy: S.rwy, dep: typeof depRw === 'function' ? depRw() : S.rwy, wx: S.wx.raw, atis: S.atis, lvp: !!S.lvpOn, land: S.aiScore.landed, dept: S.aiScore.departed, los: S.aiScore.los, ga: S.aiScore.ga };
  SHIFT.onBreak = true; for (const k of mine) shiftSeat(k, 'AI');
  if (typeof teamSay === 'function' && TEAM.people) teamSay('REL', 'I have the position. Enjoy your break.', true);
  box.querySelector('.ho-ctl').hidden = true; const bar = box.querySelector('.ho-bar'); bar.hidden = false;
  box.querySelector('.ho-p').textContent = 'On your break: the position is being worked for you…';
  const end = S.t + BRK_LEN;
  const chunk = () => {
    if (!S.running) return;
    for (let i = 0; i < 60 && S.t < end; i++) step(1);
    bar.firstChild.style.width = `${100*(1 - (end - S.t)/BRK_LEN)}%`;
    if (S.t < end) return setTimeout(chunk, 0);
    for (const k of mine) shiftSeat(k, 'ME');
    SHIFT.onBreak = false; SHIFT.onT = S.t; SHIFT.putOff = 0; SHIFT.brkWarn = SHIFT.brkAsk = SHIFT.overT = false;
    const ch = [];
    ch.push(`${S.aiScore.landed - before.land} landed and ${S.aiScore.departed - before.dept} departed while you were away${S.aiScore.ga > before.ga ? `, ${S.aiScore.ga - before.ga} go-around${S.aiScore.ga - before.ga > 1 ? 's' : ''}` : ''}${S.aiScore.los > before.los ? `, ${S.aiScore.los - before.los} loss${S.aiScore.los - before.los > 1 ? 'es' : ''} of separation` : ''}.`);
    if (S.rwy !== before.rwy || (typeof depRw === 'function' && depRw() !== before.dep)) ch.push(`Runways changed: now landing ${S.rwy}${typeof depRw === 'function' && depRw() !== S.rwy ? ', departing ' + depRw() : ''}.`);
    if (S.wx.raw !== before.wx) ch.push(`New weather, information ${phonetic(S.atis)}: ${S.wx.raw}.`);
    if (!!S.lvpOn !== before.lvp) ch.push(S.lvpOn ? 'Low visibility procedures are now in force.' : 'Low visibility procedures have been cancelled.');
    box.remove();
    if (typeof teamSay === 'function' && TEAM.people) teamSay('REL', `Welcome back. ${ch.join(' ')}`, true);
    shiftModalBack(ch);
  };
  chunk();
}
function shiftModalBack(changes){
  const box = document.createElement('div'); box.className = 'debrief'; box.id = 'handover';
  box.innerHTML = `<div class="db-card ho-card" role="dialog" aria-label="Back from your break"><div class="db-hd"><b>Back from your break</b><span class="db-sum">${hmZ(S.t)}</span></div><dl class="ho-list"></dl><div class="ho-ctl"><button type="button" class="btn" data-h="close">I have the position</button></div></div>`;
  const dl = box.querySelector('.ho-list');
  for (const [k, v] of [['While you were away', changes.join(' ')], ...shiftBrief(false).filter(([k]) => k !== 'Shift' && k !== 'Forecast')]) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; dl.append(dt, dd); }
  document.body.appendChild(box);
  box.querySelector('[data-h="close"]').onclick = () => { box.remove(); S.paused = false; sys('Back on position after your break.'); };
}
