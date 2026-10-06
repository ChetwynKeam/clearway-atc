// ═════════════════════════ slot control: you run the arrival and departure times from the Flights board ═════════════════════════
// Click a flight on the board to give it a new time, hold it, cancel it or (departures) give it a CTOT, like a flow
// manager. Everything the flight does follows: an inbound held or slotted later waits outside your airspace (in the
// air, or on the ground at its origin if it hasn't left), a departure calls for start-up to match its new off-blocks
// time or slot, a remote-stand tow comes 35 minutes before it, and a turnround departure keeps its link to the inbound.
// Times are minutes of the UTC day; SLOT[cs] = { base, tm, hold, cancel, ctot } for every flight you have touched.
const SLOT = { sel: null, selK: null };
const slotH0 = () => (S.hour || 0)*60;
S.listeners.push((ev, ac) => {
  if (ev === 'start') { for (const k of Object.keys(SLOT)) delete SLOT[k]; SLOT.sel = SLOT.selK = null; slotRender(); }
  // an arrival turning round into its departure, or a departure appearing on stand: it picks up any slot you gave it
  if (ev === 'turnround' && ac) { ac.slotMin = S.t + 20*60; if (SLOT[ac.cs]) slotApplyDep(ac.cs); }
  if (ev === 'spawn' && ac && ac.kind === 'DEP' && SLOT[ac.cs]) slotApplyDep(ac.cs);
  // a slot is a take-off window, five minutes early to ten minutes late
  if (ev === 'takeoff' && ac && SLOT[ac.cs] && SLOT[ac.cs].ctot != null) {
    const off = nowMin() - SLOT[ac.cs].ctot;
    if (off < -5 || off > 10) sys(`${ac.cs} took off ${Math.abs(Math.round(off))} min ${off < 0 ? 'before' : 'after'} its slot (CTOT ${hhmm(SLOT[ac.cs].ctot)}Z, window −5/+10).`, true);
    else sys(`${ac.cs} took off inside its slot (CTOT ${hhmm(SLOT[ac.cs].ctot)}Z).`);
  }
});

// ── finding the flight behind a board row ──
function slotFind(cs, kind){
  const ac = S.acs.find(a => a.cs === cs), f = S.sched.find(x => x.cs === cs && (kind === 'ARR' ? x.k === 'ARR' : x.k !== 'ARR'));
  const owner = kind === 'DEP' ? S.sched.find(x => x.turn && x.turn.cs === cs) : null;   // the inbound that turns round into it
  return { ac, f, owner, tr: owner && owner.turn };
}
// can you still change it, and if not, why not
function slotCtl(cs, kind){
  if (!S.running) return { ok: false, why: 'Open a session to control the flights.' };
  if (EXERCISES[S.mode]) return { ok: false, why: 'Exercises have fixed traffic.' };
  if (SLOT[cs] && SLOT[cs].divert) return { ok: false, why: `${cs} has diverted to ${SLOT[cs].divert}.` };
  const { ac, f, owner } = slotFind(cs, kind);
  if (kind === 'ARR') {
    if (ac && ac.kind === 'ARR' && ac.state === 'PRE') return { ok: true, pre: true };
    if (ac && ac.kind === 'ARR') return { ok: false, why: `${cs} is with you now: use the radar controls (hold, speed, vectors) to fit it in.` };
    if (f && (!f.spawned || f.slotCancel)) return { ok: true };
    return { ok: false, why: `${cs} is not in this session any more.` };
  }
  if (ac && (ac.slotCancelled || (ac.kind === 'DEP' && ac.state === 'PARKED'))) return { ok: true, ac };
  if (ac && ac.kind === 'DEP') return { ok: false, why: `${cs} is already ${ac.airborne ? 'airborne' : 'moving'}: its slot is in your hands on the scope now.` };
  if (owner) {
    if (SLOT[owner.cs] && SLOT[owner.cs].divert) return { ok: false, why: `The inbound ${owner.cs} diverted, so there is no aircraft for ${cs}.` };
    if (SLOT[owner.cs] && SLOT[owner.cs].cancel) return { ok: false, why: `The inbound ${owner.cs} is cancelled, so there is no aircraft for ${cs}. Reinstate ${owner.cs} first.` };
    const oa = S.acs.find(a => a.turn === owner.turn);
    if (owner.turn && (!owner.spawned || oa)) return { ok: true, turn: true };
  }
  if (f && f.k === 'DEP' && (!f.spawned || f.slotCancel)) return { ok: true };
  return { ok: false, why: `${cs} is not in this session any more.` };
}
// the board's status for a flight you have held or cancelled (null: the normal status)
function slotStatus(cs, kind){
  const e = SLOT[cs];
  if (e && e.divert) return [`Diverted to ${e.divert}`, 'bad'];
  if (kind === 'DEP') { const { owner } = slotFind(cs, kind), oe = owner && SLOT[owner.cs]; if (oe && (oe.cancel || oe.divert) && !(e && e.cancel)) return ['Cancelled · no aircraft', 'bad']; }
  if (!e || !slotCtl(cs, kind).ok) return null;
  if (e.cancel) return ['Cancelled', 'bad'];
  if (e.hold) {
    if (kind === 'DEP') return ['Held on stand', 'bad'];
    const g = slotGhost(cs);
    return [g && g.hold && g.hold.ground ? `Held at ${g.from}` : 'Holding · held by you', 'bad'];
  }
  if (kind === 'DEP' && e.ctot != null) return [`Slot ${hhmm(e.ctot)}`, 'live'];
  if (Math.round(e.tm) > e.base + 2) return [`Delayed${e.reason ? ' · ' + e.reason : ''} · ${kind === 'ARR' ? 'exp' : 'new'} ${hhmm(e.tm)}`, 'bad'];
  if (Math.round(e.tm) < e.base - 2) return [`Early · ${kind === 'ARR' ? 'exp' : 'new'} ${hhmm(e.tm)}`, 'live'];
  return null;
}
const slotGhost = cs => FAR.list.find(g => g.kind === 'ARR' && g.cs === cs) || (SLOT[cs] && SLOT[cs].ghost);

// ── arrivals ──
function slotApplyArr(cs){
  const e = SLOT[cs], { ac, f } = slotFind(cs, 'ARR');
  if (ac && ac.state === 'PRE') {   // a pending track: the previous sector holds it, or brings it to the boundary for its new time
    const d = Math.hypot(ac.x - ENTRY[ac.gate][0], ac.y - ENTRY[ac.gate][1]), soonest = S.t + d/330*3600;
    ac.slotHold = !!e.hold;
    if (!e.hold) { ac.preAt = Math.max(soonest, (e.tm - 15 - slotH0())*60); e.tm = slotH0() + ac.preAt/60 + 15; }
    return;
  }
  if (!f) return;
  let g = slotGhost(cs);
  if (e.cancel) {
    if (!f.slotCancel) { f.spawned = true; f.slotCancel = true; }
    if (g && FAR.list.includes(g)) { FAR.list.splice(FAR.list.indexOf(g), 1); e.ghost = g; }
    return;
  }
  if (f.slotCancel) {   // reinstated
    f.spawned = false; f.slotCancel = false;
    if (e.ghost) { FAR.list.push(e.ghost); e.ghost = null; }
  }
  if (e.hold) {
    f.hold = true;
    if (g && !g.hold) { const air = S.t >= g.tStart; g.hold = { d: air ? farDist(g) : 0, ground: !air }; g.tEnd = Infinity; }
    return;
  }
  f.hold = false;
  let T = (e.tm - 15 - slotH0())*60 - PRE_LEAD;   // when it reaches the pending-track point
  if (g) {
    const D = g.leg.D, enRoute = g.hold ? !g.hold.ground : S.t >= g.tStart;
    if (!enRoute && !g.hold && T - D/g.spd*3600 >= S.t) {   // not left yet and can make it at normal speed: it simply leaves later or earlier
      const sh = T - g.tEnd; g.tStart += sh; g.tEnd = T; g.t1 = g.d1 = g.v = undefined;
    } else {
      const d1 = enRoute ? (g.hold ? g.hold.d : farDist(g)) : 0, left = D - d1;
      // flying at up to 15% faster than normal to make up time, or slowing to 75% and holding near the end if early
      T = Math.max(T, S.t + left/(g.spd*1.15)*3600);
      if (!enRoute) g.tStart = S.t;
      g.t1 = S.t; g.d1 = d1; g.tEnd = T; g.hold = null;
      g.v = clamp(T > S.t ? left/((T - S.t)/3600) : g.spd*1.15, g.spd*0.75, g.spd*1.15);
    }
  } else T = Math.max(T, S.t + 30);
  f.m = (T + PRE_LEAD)/60; e.tm = slotH0() + f.m + 15;
}

// ── departures ──
function slotApplyDep(cs){
  const e = SLOT[cs], { ac, f, tr } = slotFind(cs, 'DEP');
  const depM = e.tm - slotH0(), callM = Math.max(depM - 6, e.ctot != null ? e.ctot - slotH0() - 15 : -Infinity);
  if (ac && (ac.slotCancelled || (ac.kind === 'DEP' && ac.state === 'PARKED'))) {
    const asking = ac.need === 'Request start-up';
    if (e.cancel) {
      if (ac.slotCancelled) return;
      // it stays on its stand for the day
      if (ac.tow && ac.tow.to && ac.tow.to.occ === ac) ac.tow.to.occ = null;
      ac.slotCancelled = { tow: ac.tow ? { pref: ac.tow.pref } : null };
      if (asking || ac.need === 'Request tow') { atc(ac, 'your flight is cancelled, shut down and remain on stand'); pilot(ac, 'shutting down on stand'); }
      Object.assign(ac, { kind: 'ARR', state: 'ONSTAND', need: null, tow: null, doneAt: Infinity, slotHold: false });
      sys(`${cs} cancelled: it stays on ${APT.standWord || 'stand'} ${ac.stand ? ac.stand.id : ''}.`);
      return;
    }
    if (ac.slotCancelled) {   // reinstated: back to a departure waiting to call
      const t = ac.slotCancelled.tow;
      Object.assign(ac, { kind: 'DEP', state: 'PARKED', doneAt: undefined, slotCancelled: null });
      if (t) ac.tow = { at: 0, pref: t.pref };
      sys(`${cs} reinstated, off-blocks ${hhmm(e.tm)}Z.`);
    }
    const towing = ac.tow && !ac.tow.asked;
    if (e.hold) {
      ac.slotHold = true; ac.reqAt = Infinity; if (towing) ac.tow.at = Infinity;
      if (asking) { ac.need = null; atc(ac, 'hold on stand, start-up is delayed, I will call you back'); pilot(ac, 'holding on stand'); }
      return;
    }
    ac.slotHold = false;
    ac.reqAt = Math.max(S.t + 15, ac.slotMin || 0, callM*60);
    if (towing) ac.tow.at = Math.max(S.t + 20, (depM - towLead(ac))*60);
    if (asking && ac.reqAt > S.t + 90) { ac.need = null; if (!e.quiet) atc(ac, `start-up delayed, expect start-up at ${zt(ac.reqAt).slice(0, 5)}`); if (!e.quiet) pilot(ac, `expect start-up at ${zt(ac.reqAt).slice(0, 5)}`); }
    return;
  }
  if (tr) { tr.cancel = !!e.cancel; tr.depM = depM; tr.at = hhmm(e.tm); return; }   // applied in full when the inbound turns round
  if (f && f.k === 'DEP') {   // an extra departure not on stand yet
    if (e.cancel) { if (!f.spawned) { f.spawned = true; f.slotCancel = true; } return; }
    if (f.slotCancel) { f.spawned = false; f.slotCancel = false; }
    f.hold = !!e.hold; f.m = Math.max(S.t/60, callM);
  }
}

// ── what you do on the board ──
function slotEntry(cs, kind, tm){
  return SLOT[cs] ||= { base: tm, tm, hold: false, cancel: false, ctot: null, k: kind };
}
function slotSet(cs, kind, base, ch){
  const c = slotCtl(cs, kind); if (!c.ok) { sys(c.why, true); return; }
  const e = slotEntry(cs, kind, base);
  if ('reset' in ch) Object.assign(e, { tm: e.base, hold: false, cancel: false, ctot: null });
  if ('tm' in ch) e.tm = ch.tm;
  if ('hold' in ch) e.hold = ch.hold;
  if ('cancel' in ch) { if (ch.cancel && c.pre) { sys(`${cs} is already inbound to your sector: hold it instead.`, true); return; } e.cancel = ch.cancel; if (ch.cancel) e.hold = false; }
  if ('ctot' in ch) e.ctot = ch.ctot;
  if ('reason' in ch) e.reason = ch.reason;
  if ('reset' in ch) e.reason = null;
  e.quiet = !!ch.reason; (kind === 'ARR' ? slotApplyArr : slotApplyDep)(cs); e.quiet = false;   // a delay with a reason has its own radio call
  if (ch.reason) { slotAnnounce(cs, kind, e, ch); renderFids(); slotRender(); return; }
  const what = 'reset' in ch ? 'back on its schedule' : e.cancel ? 'cancelled' : e.hold ? (kind === 'ARR' ? 'held outside your airspace' : 'held on stand') :
    'ctot' in ch ? (e.ctot != null ? `given slot ${hhmm(e.ctot)}Z` : 'slot removed') : `${kind === 'ARR' ? 'expected' : 'off-blocks'} ${hhmm(e.tm)}Z`;
  sys(`Flow: ${cs} ${what}.`);
  renderFids(); slotRender();
}
// ── delays with a reason: who says so depends on whose problem it is. The airline's (the crew, or the handling agent on
// the landline when the crew isn't talking to you yet); a flow or weather delay you pass on yourself ──
const DELAY_WHY = {
  DEP: [['technical', 'a technical problem', 1], ['crew', 'crew running late', 1], ['passengers', 'late passengers', 1], ['baggage', 'baggage loading', 1],
        ['catering', 'catering', 1], ['fuel', 'a late fuel bowser', 1], ['medical', 'a medical issue on board', 1], ['flow', 'ATC flow restrictions en route', 0],
        ['weather', 'weather at the destination', 0], ['security', 'a security check', 1]],
  ARR: [['late departure', 'a late departure', 1], ['technical', 'a technical problem before departure', 1], ['crew', 'crew running late', 1],
        ['flow', 'ATC flow restrictions en route', 0], ['weather', 'weather en route', 0], ['passengers', 'late passengers', 1]]
};
const slotWhy = (kind, k) => (DELAY_WHY[kind].find(r => r[0] === k) || [k, k, 1]);
function slotAnnounce(cs, kind, e, ch){
  const [k, words, airline] = slotWhy(kind, ch.reason), ac = S.acs.find(a => a.cs === cs), mins = Math.round(e.tm - e.base);
  const late = `${mins > 0 ? mins + ' minutes late' : 'delayed'}`, ops = (cs.match(/^[A-Z]{3}/) ? cs.slice(0, 3) + ' ' : '') + 'ops';
  if (kind === 'DEP' && ac && ac.kind === 'DEP' && ac.ground) {
    if (airline) pilot(ac, `${ac.unit()}, we've got ${words}, we'll be about ${late}, new off-blocks ${hhmm(e.tm)}`, true);
    else { atc(ac, `${words}, your new off-blocks time is ${hhmm(e.tm)}${e.ctot != null ? ', slot ' + hhmm(e.ctot) : ''}`); pilot(ac, `new off-blocks ${hhmm(e.tm)}`, true); }
  } else if (kind === 'ARR') coord(`${ops}: ${cs} is running ${late} with ${words}, new estimate ${hhmm(e.tm)}`, 'OPS');
  else coord(`${ops}: ${cs} will be ${late} with ${words}, new off-blocks ${hhmm(e.tm)}`, 'OPS');
  sys(`Delay: ${cs} ${kind === 'ARR' ? 'expected' : 'off-blocks'} ${hhmm(e.tm)}Z (${k}${ch.auto ? ', from the airline' : ''}).`);
}

// ── stands: an arrival goes to the stand you give it; a departure already on stand is towed there; a turnround's
// departure leaves from whichever stand its inbound goes to ──
function standCtl(cs, kind){
  if (!S.running || EXERCISES[S.mode]) return { ok: false };
  if (SLOT[cs] && (SLOT[cs].divert || SLOT[cs].cancel)) return { ok: false };
  const { ac, f, owner } = slotFind(cs, kind);
  if (kind === 'ARR') {
    if (ac && ac.kind === 'ARR') return ['ONSTAND', 'PARKED', 'DIVERTING'].includes(ac.state) || outOfCtl(ac) ? { ok: false } : { ok: true, ac };
    return f && !f.spawned ? { ok: true, f } : { ok: false };
  }
  if (ac && ac.kind === 'DEP') return ac.state === 'PARKED' ? { ok: true, ac, tow: true } : { ok: false };
  if (owner) { const oa = S.acs.find(a => a.turn === owner.turn); if (oa) return { ok: true, ac: oa }; if (!owner.spawned) return { ok: true, f: owner }; }
  if (f && f.k === 'DEP' && !f.spawned) return { ok: true, fd: f };
  return { ok: false };
}
function slotStand(cs, kind, base, id){
  const c = standCtl(cs, kind); if (!c.ok) { sys(`${cs}'s stand can't be changed now.`, true); return; }
  const st = STANDS.find(s => s.id === id), W = APT.standWord || 'stand'; if (!st) return;
  const busy = st.occ && st.occ !== c.ac;
  if (c.tow) {   // on stand (or in a hangar): a tug moves it
    const ac = c.ac; if (ac.stand === st) return;
    if (busy) { sys(`${W[0].toUpperCase() + W.slice(1)} ${id} is occupied (${st.occ.cs}).`, true); return; }
    if (ac.stand.area !== 'south' && st.area === 'south') { sys(`${cs} can't be towed across the runway to the south apron.`, true); return; }
    if (ac.tow && ac.tow.asked && ac.tow.to && ac.tow.to.occ === ac) ac.tow.to.occ = null;
    const asking = ac.need === 'Request start-up' || ac.need === 'Request tow';
    ac.tow = { at: ac.tow && !ac.tow.asked && inHangar(ac) ? ac.tow.at : S.t + 15, pref: id, only: true };
    if (asking) { ac.need = null; atc(ac, `${W} change, a tug will tow you to ${W} ${id}, call for start-up when you're there`); pilot(ac, `tow to ${W} ${id}`); }
    sys(`${W[0].toUpperCase() + W.slice(1)} change: ${cs} will be towed from ${inHangar(ac) ? ac.stand.name : W + ' ' + ac.stand.id} to ${W} ${id}.`);
  } else if (c.ac) {   // an arrival: re-planned, or re-routed if already taxiing in
    const ac = c.ac;
    if (busy) { sys(`${W[0].toUpperCase() + W.slice(1)} ${id} is occupied (${st.occ.cs}).`, true); return; }
    ac.standPref = id;
    if (ac.taxiIn && ac.state === 'VACATING') command(`${ac.cs} TAXI ${id}`);
    else { if (ac.stand && ac.stand.occ === ac) ac.stand.occ = null; st.occ = ac; ac.stand = st; if (ac.ground && ac.vacated) atc(ac, `${W} ${id}`); }
    sys(`${W[0].toUpperCase() + W.slice(1)} change: ${ac.cs} now goes to ${W} ${id}.`);
  } else if (c.f) { c.f.standPref = id; sys(`${W[0].toUpperCase() + W.slice(1)} change: ${c.f.cs} will go to ${W} ${id}${busy ? ' if it is free by then' : ''}.`); }
  else if (c.fd) { c.fd.stand = id; sys(`${W[0].toUpperCase() + W.slice(1)} change: ${cs} will be on ${W} ${id}.`); }
  slotEntry(cs, kind, base).stand = id;
  const { owner } = slotFind(cs, kind); if (owner && SLOT[owner.cs]) SLOT[owner.cs].stand = id; else if (owner) slotEntry(owner.cs, 'ARR', slotH0() + owner.m + 15).stand = id;
  renderFids(); slotRender();
}

// ── diverting an inbound before it reaches you: it turns for its alternate ──
function slotDivert(cs, base){
  const c = slotCtl(cs, 'ARR'); if (!c.ok) { sys(c.why, true); return; }
  const { ac, f } = slotFind(cs, 'ARR'), src = ac || f, alt = APT.divertTo({ gate: src.gate, t: src.t, cs })[0], ic = DIVERT_AP[alt] && DIVERT_AP[alt][0];
  const e = slotEntry(cs, 'ARR', base); e.divert = alt; e.hold = false;
  if (ac) {
    S.acs.splice(S.acs.indexOf(ac), 1); if (ac.stand && ac.stand.occ === ac) ac.stand.occ = null; if (S.sel === ac) S.sel = null;
    if (ic) addDepGhost({ cs, t: ac.t, d: ic, from: ac.o, x: ac.x, y: ac.y, alt: ac.alt });
  } else if (f) {
    f.spawned = true; f.slotCancel = true;
    const g = slotGhost(cs), st = g && FAR.list.includes(g) && farState(g);
    if (g && FAR.list.includes(g)) FAR.list.splice(FAR.list.indexOf(g), 1);
    if (st && ic) addDepGhost({ cs, t: f.t, d: ic, from: f.o, x: st.p[0], y: st.p[1], alt: st.alt });
  }
  FAR.done[cs] = 'Diverted to ' + alt;
  coord(`${cs} won't be coming to you: diverting to ${alt}`, 'PREV');
  renderFids(); slotRender();
}

// ── airline delays: switched on, about one flight in five gets delayed during the session, announced 15 to 45 minutes ahead ──
SLOT.disrupt = (() => { try { return localStorage.getItem('cw-disrupt') === '1'; } catch (_) { return false; } })();
SLOT.plan = {};
function slotPlanDelays(){
  if (!SLOT.disrupt || !S.running || EXERCISES[S.mode]) return;
  const now = nowMin();
  for (const kind of ['DEP', 'ARR']) for (const r of fidsRows(kind)) {
    if (r.cs in SLOT.plan || r.tm < now + (kind === 'ARR' ? 45 : 20) || r.tm > now + 240) continue;
    SLOT.plan[r.cs] = Math.random() < (kind === 'DEP' ? 0.2 : 0.15) ? { kind, base: r.tm, at: (r.tm - now - (kind === 'ARR' ? 22 : 0) - rnd(15, 45))*60 + S.t,   // inbounds: before they reach you
      min: [10, 15, 20, 25, 30, 45, 60][Math.floor(Math.random()*7)], why: DELAY_WHY[kind][Math.floor(Math.random()*DELAY_WHY[kind].length)][0] } : null;
  }
}
S.listeners.push(ev => {
  if (ev === 'start') { SLOT.plan = {}; SLOT.planT = 0; slotPlanDelays(); }
  if (ev !== 'tick' || !SLOT.disrupt) return;
  if (!(S.t - SLOT.planT < 60)) { SLOT.planT = S.t; slotPlanDelays(); }
  for (const [cs, p] of Object.entries(SLOT.plan)) {
    if (!p || p.done || S.t < p.at) continue; p.done = true;
    const e = SLOT[cs]; if (e && (e.hold || e.cancel || e.divert) || !slotCtl(cs, p.kind).ok) continue;
    slotSet(cs, p.kind, p.base, { tm: (e ? e.tm : p.base) + p.min, reason: p.why, auto: true });
  }
});
function slotDisrupt(on){
  SLOT.disrupt = on; try { localStorage.setItem('cw-disrupt', on ? '1' : '0'); } catch (_) {}
  if (on) slotPlanDelays(); sys(on ? 'Airline delays on: some flights will be delayed during the session (technical, crew, passengers, flow…).' : 'Airline delays off.');
  slotRender();
}

// a time typed as HH:MM, on the session's day (the evening before or the early hours after when that is nearer)
function slotParse(v, near){
  const m = /^(\d{1,2}):?(\d{2})$/.exec(String(v).trim()); if (!m || +m[1] > 23 || +m[2] > 59) return null;
  let t = +m[1]*60 + +m[2]; while (t < near - 720) t += 1440; while (t > near + 720) t -= 1440; return t;
}

// ── the editor bar over the board (main board and pop-out). Rebuilt only when you pick a flight or change it, so typing isn't
// interrupted by the board refreshing; its status line updates every tick ──
const slotDocs = new Set();
function slotWire(doc){
  slotDocs.add(doc);
  doc.addEventListener('click', ev => {
    const tr = ev.target.closest && ev.target.closest('.fids tr[data-cs]'); if (!tr) return;
    SLOT.sel = tr.dataset.cs; SLOT.selK = tr.dataset.k; SLOT.selBase = +tr.dataset.tm;
    renderFids(); slotRender();
  });
  slotRender();
}
function slotNote(cs, kind){
  const c = slotCtl(cs, kind); if (!c.ok) return c.why;
  const e = SLOT[cs], { ac, tr, f } = slotFind(cs, kind);
  if (e && e.cancel) return kind === 'ARR' ? 'Cancelled: it will not come. Its turnround departure has no aircraft.' : 'Cancelled: it stays on stand. Reinstate to bring it back.';
  if (kind === 'ARR') {
    if (ac) return ac.slotHold ? 'Held by the previous sector, orbiting outside your airspace until you release it.' : `Pending track: calls you at the boundary at about ${zt(ac.preAt).slice(0, 5)}Z, lands about ${hhmm(slotH0() + ac.preAt/60 + 15)}Z.`;
    const g = slotGhost(cs);
    if (e && e.hold) return g && g.hold && !g.hold.ground ? 'Held en route: orbiting where it is until you release it.' : 'Held on the ground at its origin until you release it.';
    if (f) return `Shows as a pending track at about ${zt(f.m*60 - PRE_LEAD).slice(0, 5)}Z and calls you at about ${zt(f.m*60).slice(0, 5)}Z.`;
    return '';
  }
  if (ac) {
    if (ac.slotHold) return 'Held on stand: the crew won’t call for start-up until you release it.';
    if (ac.need) return `On stand, ${ac.need.toLowerCase()} now.`;
    const tow = ac.tow && !ac.tow.asked && ac.tow.at < Infinity ? ` ${ac.stand && ac.stand.area === 'hangar' ? 'In ' + ac.stand.name + ': tow out' : 'Tow to a terminal stand'} at about ${zt(ac.tow.at).slice(0, 5)}Z.` : '';
    return `On stand: calls for start-up at about ${zt(ac.reqAt).slice(0, 5)}Z.${tow}`;
  }
  if (tr) return `Turnround of the inbound ${slotFind(cs, kind).owner.cs}: calls for start-up about ${hhmm((e ? e.tm : tr.depM + slotH0()) - 6)}Z, at least 20 minutes after it is on stand.${e && e.hold ? ' Held: it will stay on stand when it turns round.' : ''}`;
  return e && e.hold ? 'Held: it will not appear until you release it.' : '';
}
function slotRender(){
  for (const doc of slotDocs) {
    const bar = doc.getElementById('fidsSlot') || doc.getElementById('fbSlot'); if (!bar) continue;
    const cs = SLOT.sel, kind = SLOT.selK;
    if (!cs || !S.running) {
      bar.hidden = !S.running;
      bar.innerHTML = `<div class="sl-row"><p class="sl-tip">Click a flight to retime, delay, hold, cancel or divert it, change its ${APT.standWord || 'stand'}, or give a departure a slot (CTOT).</p>
        <label class="sl-dis" title="About one flight in five gets delayed during the session, announced by the crew or the airline"><input type="checkbox" data-i="dis" ${SLOT.disrupt ? 'checked' : ''}> Airline delays</label></div>`;
      const d = bar.querySelector('[data-i="dis"]'); if (d) d.onchange = () => slotDisrupt(d.checked);
      continue;
    }
    bar.hidden = false;
    const c = slotCtl(cs, kind), sc = standCtl(cs, kind), e = SLOT[cs], tm = e ? e.tm : SLOT.selBase, ARR = kind === 'ARR';
    const row = fidsRows(kind).find(r => r.cs === cs), curStand = row ? fidsStand(row) : '';
    const B = (a, label, cls = '', dis = !c.ok) => `<button data-a="${a}" class="${cls}" ${dis ? 'disabled' : ''}>${label}</button>`;
    bar.innerHTML = `<div class="sl-hd"><b>${esc(cs)}</b><span>${ARR ? 'Arrival' : 'Departure'} · scheduled ${hhmm(SLOT.selBase)}Z</span><button class="x" data-a="close" aria-label="Close">×</button></div>
      <div class="sl-row"><label>${ARR ? 'Landing' : 'Off-blocks'} <input data-i="tm" value="${hhmm(tm)}" maxlength="5" inputmode="numeric" ${c.ok ? '' : 'disabled'}></label>
        ${B('-5', '−5')}${B('+5', '+5')}${B('+15', '+15')}${B('+30', '+30')}
        ${ARR ? '' : `<label>CTOT <input data-i="ctot" value="${e && e.ctot != null ? hhmm(e.ctot) : ''}" placeholder="--:--" maxlength="5" inputmode="numeric" ${c.ok ? '' : 'disabled'}></label>`}</div>
      <div class="sl-row"><label>Delay <select data-i="why" ${c.ok ? '' : 'disabled'}>${DELAY_WHY[kind].map(([k, w]) => `<option value="${k}">${k}</option>`).join('')}</select></label>${[10, 20, 30, 60].map(n => B('d' + n, '+' + n + ' min')).join('')}</div>
      <div class="sl-row"><label>${(APT.standWord || 'stand').replace(/^./, x => x.toUpperCase())} <select data-i="stand" ${sc.ok ? '' : 'disabled'}><option value="">${esc(curStand || '–')}</option>${STANDS.map(st => `<option value="${st.id}">${st.id}${st.occ && st.occ.cs !== cs ? ' · ' + st.occ.cs : ''}</option>`).join('')}</select></label><span class="sl-hint">${sc.ok ? (sc.tow ? 'towed there by a tug' : sc.f || sc.fd ? 'planned' : 'goes there after landing') : ''}</span></div>
      <div class="sl-row">${e && e.hold ? B('rel', 'Release', 'go', !c.ok || (e && e.cancel)) : B('hold', 'Hold', 'warn', !c.ok || (e && e.cancel))}${e && e.cancel ? B('reinst', 'Reinstate', 'go') : B('cancel', 'Cancel flight', 'danger', !c.ok || c.pre)}${ARR ? B('divert', 'Divert', 'danger', !c.ok || (e && e.cancel)) : ''}${B('reset', 'Back to schedule', '', !c.ok || !e)}</div>
      <p class="sl-note"></p>`;
    const go = ch => slotSet(cs, kind, SLOT.selBase, ch);
    for (const b of bar.querySelectorAll('button[data-a]')) b.onclick = () => {
      const a = b.dataset.a, cur = SLOT[cs] ? SLOT[cs].tm : SLOT.selBase;
      if (a === 'close') { SLOT.sel = null; renderFids(); slotRender(); }
      else if (/^[+-]\d+$/.test(a)) go({ tm: cur + +a });
      else if (a === 'hold') go({ hold: true });
      else if (a === 'rel') go({ hold: false });
      else if (a === 'cancel') go({ cancel: true });
      else if (a === 'reinst') go({ cancel: false });
      else if (a === 'reset') go({ reset: true });
      else if (/^d\d+$/.test(a)) go({ tm: cur + +a.slice(1), reason: bar.querySelector('[data-i="why"]').value });
      else if (a === 'divert') slotDivert(cs, SLOT.selBase);
    };
    { const sel = bar.querySelector('select[data-i="stand"]'); if (sel) sel.onchange = () => sel.value && slotStand(cs, kind, SLOT.selBase, sel.value); }
    for (const i of bar.querySelectorAll('input[data-i]')) {
      const set = () => {
        const v = i.value.trim();
        if (i.dataset.i === 'ctot' && !v) { if (SLOT[cs] && SLOT[cs].ctot != null) go({ ctot: null }); return; }
        const t = slotParse(v, SLOT.selBase); if (t == null) { i.classList.add('bad'); return; }
        go(i.dataset.i === 'tm' ? { tm: t } : { ctot: t });
      };
      i.onkeydown = ev => { ev.stopPropagation(); if (ev.key === 'Enter') { i.onchange = null; set(); } };
      i.onchange = set;
    }
  }
  slotTickAll();
}
function slotTick(doc){
  const bar = doc.getElementById('fidsSlot') || doc.getElementById('fbSlot'); if (!bar || !SLOT.sel) return;
  const n = bar.querySelector('.sl-note'); if (n) n.textContent = slotNote(SLOT.sel, SLOT.selK);
}
function slotTickAll(){ for (const d of slotDocs) slotTick(d); }
if (document.getElementById('fidsSlot')) slotWire(document);
