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
  if (kind === 'DEP') { const { owner } = slotFind(cs, kind); if (owner && SLOT[owner.cs] && SLOT[owner.cs].cancel && !(e && e.cancel)) return ['Cancelled · no aircraft', 'bad']; }
  if (!e || !slotCtl(cs, kind).ok) return null;
  if (e.cancel) return ['Cancelled', 'bad'];
  if (e.hold) {
    if (kind === 'DEP') return ['Held on stand', 'bad'];
    const g = slotGhost(cs);
    return [g && g.hold && g.hold.ground ? `Held at ${g.from}` : 'Holding · held by you', 'bad'];
  }
  if (kind === 'DEP' && e.ctot != null) return [`Slot ${hhmm(e.ctot)}`, 'live'];
  if (Math.round(e.tm) > e.base + 2) return [`Delayed · ${kind === 'ARR' ? 'exp' : 'new'} ${hhmm(e.tm)}`, 'bad'];
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
    if (towing) ac.tow.at = Math.max(S.t + 20, (depM - 35)*60);
    if (asking && ac.reqAt > S.t + 90) { ac.need = null; atc(ac, `start-up delayed, expect start-up at ${zt(ac.reqAt).slice(0, 5)}`); pilot(ac, `expect start-up at ${zt(ac.reqAt).slice(0, 5)}`); }
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
  (kind === 'ARR' ? slotApplyArr : slotApplyDep)(cs);
  const what = 'reset' in ch ? 'back on its schedule' : e.cancel ? 'cancelled' : e.hold ? (kind === 'ARR' ? 'held outside your airspace' : 'held on stand') :
    'ctot' in ch ? (e.ctot != null ? `given slot ${hhmm(e.ctot)}Z` : 'slot removed') : `${kind === 'ARR' ? 'expected' : 'off-blocks'} ${hhmm(e.tm)}Z`;
  sys(`Flow: ${cs} ${what}.`);
  renderFids(); slotRender();
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
    const tow = ac.tow && !ac.tow.asked && ac.tow.at < Infinity ? ` Tow to a terminal stand at about ${zt(ac.tow.at).slice(0, 5)}Z.` : '';
    return `On stand: calls for start-up at about ${zt(ac.reqAt).slice(0, 5)}Z.${tow}`;
  }
  if (tr) return `Turnround of the inbound ${slotFind(cs, kind).owner.cs}: calls for start-up about ${hhmm((e ? e.tm : tr.depM + slotH0()) - 6)}Z, at least 20 minutes after it is on stand.${e && e.hold ? ' Held: it will stay on stand when it turns round.' : ''}`;
  return e && e.hold ? 'Held: it will not appear until you release it.' : '';
}
function slotRender(){
  for (const doc of slotDocs) {
    const bar = doc.getElementById('fidsSlot') || doc.getElementById('fbSlot'); if (!bar) continue;
    const cs = SLOT.sel, kind = SLOT.selK;
    if (!cs || !S.running) { bar.hidden = !S.running; bar.innerHTML = `<p class="sl-tip">Click a flight to change its time, hold it, cancel it or give a departure a slot (CTOT).</p>`; continue; }
    bar.hidden = false;
    const c = slotCtl(cs, kind), e = SLOT[cs], tm = e ? e.tm : SLOT.selBase, ARR = kind === 'ARR';
    const B = (a, label, cls = '', dis = !c.ok) => `<button data-a="${a}" class="${cls}" ${dis ? 'disabled' : ''}>${label}</button>`;
    bar.innerHTML = `<div class="sl-hd"><b>${esc(cs)}</b><span>${ARR ? 'Arrival' : 'Departure'} · scheduled ${hhmm(SLOT.selBase)}Z</span><button class="x" data-a="close" aria-label="Close">×</button></div>
      <div class="sl-row"><label>${ARR ? 'Landing' : 'Off-blocks'} <input data-i="tm" value="${hhmm(tm)}" maxlength="5" inputmode="numeric" ${c.ok ? '' : 'disabled'}></label>
        ${B('-5', '−5')}${B('+5', '+5')}${B('+15', '+15')}${B('+30', '+30')}
        ${ARR ? '' : `<label>CTOT <input data-i="ctot" value="${e && e.ctot != null ? hhmm(e.ctot) : ''}" placeholder="--:--" maxlength="5" inputmode="numeric" ${c.ok ? '' : 'disabled'}></label>`}</div>
      <div class="sl-row">${e && e.hold ? B('rel', 'Release', 'go', !c.ok || (e && e.cancel)) : B('hold', 'Hold', 'warn', !c.ok || (e && e.cancel))}${e && e.cancel ? B('reinst', 'Reinstate', 'go') : B('cancel', 'Cancel flight', 'danger', !c.ok || c.pre)}${B('reset', 'Back to schedule', '', !c.ok || !e)}</div>
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
    };
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
