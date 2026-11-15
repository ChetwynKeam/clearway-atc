// ═════════════════════════ the departure manager (DMAN) and slot (CTOT) compliance ═════════════════════════
// Switched on in the session setup (Departure manager), or from its own panel (menu › Departure manager, which can pop
// out like the coordination board). It plans every departure's take-off on each runway:
// • TOBT  target off-block time: when the crew will be ready (when they call, or are due to call, for start-up)
// • TTOT  target take-off time: the TOBT plus the taxi time out (EXOT), then the runway's departure intervals (wake,
//         and two minutes on a runway that is also landing), the gap behind the last departure on the same route (two
//         minutes; five while that route is under a flow regulation), and the slot (CTOT) if it has one
// • TSAT  target start-up approval time: the TTOT less the taxi time, so the queue waits on stand, engines off,
//         rather than at the holding point. A crew calling before its TSAT is given a start-up delay (TSAT command,
//         or the button on the panel): "start-up delayed, expect start-up at …", and calls again then.
// Slots: with the departure manager on, some flights are given a CTOT (a flow regulation on their route or at their
// destination). The window is −5 to +10 minutes; a take-off outside it costs 15 points, inside it earns 2. When a flight
// won't make its window the flow manager phones (coordination board) offering to ask for a new slot, and when one is
// missed, phones with the new one. After an area flow stop ends, the routes it stopped are held at five minutes
// between departures for 20 minutes while the backlog clears.
// The AI Ground and Tower work to it too (start-up delays, route gaps). Off (the default), none of this runs.
const DM = { on: false, open: false, win: null, timer: 0, regs: {}, lastRte: {}, exot: {}, plan: null, planT: -1 };
const DM_MDI = 120, DM_MDI_REG = 300;
const DM_BUF = 240;   // the TSAT leaves a few minutes in hand: a short queue at the holding point keeps the runway busy
const dmOn = () => DM.on && S.running && !(typeof EXERCISES !== 'undefined' && EXERCISES[S.mode]);
// a departure's route: its SID's name without the designator (DEXEN for DEXEN2J), else its exit fix
const dmRoute = ac => { try { const sid = ac.sid || sidName(ac.gate, depRw(ac), ac), m = sid && /^[A-Z]{2,5}/.exec(String(sid)); if (m) return m[0]; const ex = exitRouteOf(ac) || []; return ex[ex.length - 1] || ac.gate; } catch (e) { return ac.gate; } };
const dmTm = t => hhmm(nowMin() + (t - S.t)/60);   // a session time as HH:MM on the clock
const dmCtotT = ac => { const e = typeof SLOT !== 'undefined' && SLOT[ac.cs]; return e && e.ctot != null ? S.t + (e.ctot - nowMin())*60 : null; };
// the route's current minimum departure interval, and the regulation behind it
function dmReg(ac){ for (const k of [dmRoute(ac), '@' + ac.gate, '*']) { const R = DM.regs[k]; if (R && R.until > S.t) return R; } return null; }
const dmMdi = ac => { const R = dmReg(ac); return R ? R.mdi : DM_MDI; };
// taxi time out from its stand: push and start, then the taxi route to its holding point at about 12 kt (worked out
// once per stand and runway)
function dmExot(ac){
  const rw = depRw(ac), key = (ac.stand ? ac.stand.id : '-') + '/' + rw;
  if (DM.exot[key] != null) return DM.exot[key];
  let L = null;
  try { const hp = typeof depHold === 'function' ? depHold(ac) : ac.hp; const r = ac.stand && HOLDS[hp] && route(ac.stand.node, HOLDS[hp].node); if (r) L = pathLen(r.nodes); } catch (e) {}
  if (L == null || !isFinite(L)) L = BIG_GROUND ? 2.2 : 1.1;
  return (DM.exot[key] = Math.round(150 + L/12*3600));
}
// what is left of it for a flight already on the move
function dmLeft(ac){
  const st = ac.state;
  if (st === 'LINEUP' || st === 'LINEDUP') return 30;
  if (st === 'HOLDPT') return 75;
  if (st === 'PUSH' || st === 'READY' || st === 'PULL') return Math.max(120, dmExot(ac) - 90);
  const H = ac.hp && HOLDS[ac.hp]; let d = 1;
  try { if (H) d = dist(ac.x, ac.y, ...GN[H.node].p)*1.3; } catch (e) {}
  return 45 + d/14*3600;
}
const DM_MOVING = ['PUSH', 'PULL', 'READY', 'TAXI', 'HOLDPT', 'LINEUP', 'LINEDUP'];
// the plan: every departure on the ground, in take-off order on each runway (worked out at most every 5 s)
function dmPlan(){
  const k = Math.floor(S.t/5); if (DM.plan && DM.planT === k) return DM.plan;
  const byR = {};
  for (const ac of S.acs) {
    if (ac.kind !== 'DEP' || !ac.ground || ac.handed || ac.slotCancelled || ac.cto || ac.state === 'TAKEOFF') continue;
    const moving = DM_MOVING.includes(ac.state); if (!moving && ac.state !== 'PARKED') continue;
    const asking = ac.need === 'Request start-up', held = !moving && ac.slotHold;
    if (held) continue;
    const tobt = moving ? null : asking ? S.t : Math.max(S.t, ac.reqAt ?? S.t);
    if (!moving && (!isFinite(tobt) || tobt - S.t > 90*60)) continue;   // not due for an hour and a half: not planned yet
    const exot = dmExot(ac), left = moving ? dmLeft(ac) : exot;
    const R = rwyOf(depRw(ac)), ctot = dmCtotT(ac);
    const earliest = (moving ? S.t : tobt) + left;
    (byR[R.id] ||= { R, rw: depRw(ac), rows: [] }).rows.push({ ac, moving, asking, tobt, exot, left, earliest, ctot, route: dmRoute(ac), k: moving ? earliest - 1e6 : Math.max(earliest, ctot != null ? ctot - 4*60 : 0) });
  }
  const arrR = new Set(S.acs.filter(o => o.kind === 'ARR' && o.airborne && !o.handed).map(o => { try { return rwyOf(landRw(o)).id; } catch (e) { return null; } }));   // runways landing as well (mixed mode)
  for (const id in byR) {
    const C = byR[id], last = (S.lastTO || {})[id];
    C.rows.sort((a, b) => a.k - b.k);
    let prev = last ? { t: last.t, wake: last.wake, sid: last.sid } : null;
    const rte = {}; for (const r in DM.lastRte) rte[r] = DM.lastRte[r].t;
    for (const r of C.rows) {
      const ac = r.ac; let t = r.earliest, why = '';
      if (r.ctot != null && r.ctot - 4*60 > t) { t = r.ctot - 4*60; why = 'slot'; }
      if (prev) { const g = Math.max(toGapS(prev, ac), arrR.has(id) ? 120 : 0); if (prev.t + g > t) { t = prev.t + g; why = 'runway'; } }
      const m = dmMdi(ac); if (rte[r.route] != null && rte[r.route] + m > t) { t = rte[r.route] + m; why = `${r.route} ${m/60} min`; }
      r.ttot = t; r.why = why;
      r.tsat = r.moving ? null : Math.max(r.tobt, t - r.exot - DM_BUF);
      r.mdi = m;
      prev = { t, wake: ac.perf.wake, sid: ac.sid || (typeof sidName === 'function' ? sidName(ac.gate, depRw(ac), ac) : null) };
      rte[r.route] = t;
      // the slot window, −5 to +10 minutes: met, or going to be missed
      r.slotBad = r.ctot != null && (t > r.ctot + 10*60 || t < r.ctot - 5*60);
      r.act = r.slotBad ? 'red' : !r.moving && r.asking && r.tsat > S.t + 120 ? 'amber' : !r.moving && r.asking ? 'blue' : '';
    }
    C.rate = C.rows.filter(r => r.ttot - S.t <= 3600).length;
  }
  DM.plan = byR; DM.planT = k;
  return byR;
}
const dmRow = ac => { const P = dmPlan(); for (const id in P) { const r = P[id].rows.find(x => x.ac === ac); if (r) return r; } return null; };

// ── TSAT: the start-up delay (typed, or from the panel's button, or by the AI Ground) ──
function dmCmd(ac, said, reads){
  if (!dmOn()) { sys('The departure manager is off: switch it on in the session setup or on its panel (menu › Departure manager).'); return; }
  if (ac.kind !== 'DEP' || ac.state !== 'PARKED') { sys(`${ac.cs} isn't waiting on ${APT.standWord || 'stand'} for start-up.`); return; }
  DM.planT = -1; const r = dmRow(ac); if (!r) { sys(`${ac.cs} has no start-up time planned yet.`); return; }
  if (r.tsat <= S.t + 60) { sys(`${ac.cs}'s TSAT is ${dmTm(r.tsat)}: it can start now.`); return; }
  const at = dmTm(r.tsat);
  if (ac.dmTobt == null) ac.dmTobt = r.tobt;   // the TOBT stays what it was: only the start-up moves
  ac.need = null; ac.reqAt = Math.max(S.t + 60, r.tsat - 20); ac.dmTsat = r.tsat;
  said.push(`start-up delayed${r.ctot != null ? ' for your slot' : ''}, expect start-up at ${at}${r.ctot != null ? `, CTOT ${dmTm(r.ctot)}` : ''}`); reads.push(`expect start-up at ${at}`);
  DM.planT = -1;
}
// the AI Ground: a crew calling well before its TSAT is told to wait on stand
function dmanHoldStart(ac){
  if (!dmOn() || ac.state !== 'PARKED') return false;
  const r = dmRow(ac); if (!r || r.tsat <= S.t + 90) return false;
  aiDo('GND', ac, 'TSAT'); return true;
}
// the AI Tower: not before the gap behind the last departure on the same route
function dmanHoldTO(ac){
  if (!dmOn()) return null;
  const rt = dmRoute(ac), L = DM.lastRte[rt], m = dmMdi(ac);
  return L && S.t - L.t < m ? `${m/60} min behind ${L.cs} on ${rt}` : null;
}

// ── slots: given out, kept to, and re-slotted ──
const DM_FM = 'FLOW MANAGER';
function dmSetCtot(ac, m){
  const row = fidsRows('DEP').find(r => r.cs === ac.cs), base = row ? row.tm : Math.round(nowMin());
  const e = slotEntry(ac.cs, 'DEP', base); e.ctot = Math.round(m);
  if (typeof renderFids === 'function') renderFids(); if (S.sel === ac) renderSel();
  DM.planT = -1;
}
function dmAllocate(){
  for (const ac of S.acs) {
    if (ac.kind !== 'DEP' || ac.state !== 'PARKED' || ac.dmChk || ac.slotHold || ac.slotCancelled) continue;
    const lead = (ac.reqAt ?? S.t) - S.t; if (lead > 90*60 || lead < 12*60) continue;
    ac.dmChk = true;
    if (dmCtotT(ac) != null) continue;   // you gave it one already
    const reg = dmReg(ac), p = reg && reg.slots ? 0.75 : 0.1;
    if (Math.random() >= p) continue;
    const row = dmRow(ac), off = Math.max(lead + dmExot(ac), row ? row.ttot - S.t : 0);   // not before the plan can get it away
    const m = Math.ceil(nowMin() + off/60 + rnd(4, reg ? 35 : 25));
    dmSetCtot(ac, m);
    coord(`${ac.cs} has a slot: CTOT ${hhmm(m)}, ${reg && reg.slots ? reg.why : ['a regulation at ' + (ac.d || 'its destination'), 'en-route sector capacity', 'weather at ' + (ac.d || 'its destination')][Math.floor(Math.random()*3)]}`, DM_FM);
  }
}
function dmWatch(){
  const P = dmPlan(), mine = typeof cbMine === 'function' && (cbMine('TWR') || cbMine('GND'));
  for (const id in P) for (const r of P[id].rows) {
    const ac = r.ac, e = SLOT[ac.cs]; if (r.ctot == null || !e) continue;
    // missed: still on the ground with the window gone, a new slot is found and phoned through
    if (S.t > r.ctot + 10*60) {
      const old = e.ctot, m = Math.ceil(nowMin() + (Math.max(r.ttot, S.t + r.left) - S.t)/60 + rnd(5, 15)); dmSetCtot(ac, m);
      const text = `${ac.cs} has missed its slot at ${hhmm(old)}. I've got it a new one: CTOT ${hhmm(m)}.`;
      if (mine) cbAdd({ from: 'Flow manager', ac, text, opts: [{ label: 'Acknowledge', reply: `${APT.coordName}: ${ac.cs} CTOT ${hhmm(m)}, copied.` }], missed: 'The new slot stands all the same.' });
      else coord(text, DM_FM);
      continue;
    }
    // going to miss it: the flow manager offers to ask for a later one (once per slot)
    if (r.slotBad && r.ttot > r.ctot + 10*60 && S.t > r.ctot - 30*60 && e.dmAsk !== e.ctot) {
      e.dmAsk = e.ctot; const m = Math.ceil(nowMin() + (r.ttot - S.t)/60 + rnd(2, 6)), cur = e.ctot;
      const text = `${ac.cs} won't make its slot at ${hhmm(cur)}: your plan has it off at ${dmTm(r.ttot)}. Shall I ask for a later one? I can get ${hhmm(m)}.`;
      const doIt = () => { if (S.acs.includes(ac) && !ac.airborne && SLOT[ac.cs] && SLOT[ac.cs].ctot === cur) { dmSetCtot(ac, m); SLOT[ac.cs].dmAsk = SLOT[ac.cs].ctot; } };
      if (mine) cbAdd({ from: 'Flow manager', ac, text, opts: [{ label: `Yes, new slot ${hhmm(m)}`, do: doIt, reply: `Flow manager: ${ac.cs} CTOT ${hhmm(m)}.` }, { label: 'No, it will make it', reply: `${APT.coordName}: ${ac.cs} will make ${hhmm(cur)}.` }], missed: 'It keeps its slot.' });
      else { doIt(); coord(`${ac.cs} re-slotted to CTOT ${hhmm(m)}: it wouldn't make ${hhmm(cur)}`, DM_FM); }
    }
  }
}
// a flow regulation on one route at the start of the session (now and then)
function dmStartRegs(){
  // one of the quieter routes (not the one most departures use, which would choke the airport)
  const c = {}; let n = 0; for (const a of S.acs) if (a.kind === 'DEP') { const r = dmRoute(a); if (r) { c[r] = (c[r] || 0) + 1; n++; } }
  const routes = Object.keys(c).filter(r => c[r] <= Math.max(3, n*0.3));
  if (!routes.length || Math.random() > 0.6) return;
  const rt = routes[Math.floor(Math.random()*routes.length)], mins = Math.round(rnd(60, 150)), why = ['an en-route regulation, sector capacity', 'a regulation for weather on the route', 'military activity next to the route'][Math.floor(Math.random()*3)];
  DM.regs[rt] = { mdi: DM_MDI_REG, until: S.t + mins*60, why, slots: true, name: rt };
  coord(`Regulation on ${rt} departures until ${dmTm(S.t + mins*60)}, ${why}: ${DM_MDI_REG/60} minutes between departures on the route, and slots for most of them`, DM_FM);
}
function dmanStep(){
  if (!dmOn() || Math.floor(S.t) % 15 !== 0 || DM.stepT === Math.floor(S.t)) return;
  DM.stepT = Math.floor(S.t);
  dmAllocate(); dmWatch();
}
S.listeners.push((ev, x) => {
  if (ev === 'start') {
    DM.regs = {}; DM.lastRte = {}; DM.exot = {}; DM.plan = null; DM.planT = -1; DM.stepT = -1;
    const el = document.getElementById('dmanSel'); DM.on = !!(el && el.value === 'on') && !(typeof EXERCISES !== 'undefined' && EXERCISES[S.mode]);
    if (DM.on) { dmStartRegs(); sys('Departure manager on: crews get a TSAT (start-up time) to wait on stand for, and some flights have slots (CTOTs). Menu › Departure manager.'); }
    dmRender(); return;
  }
  if (!dmOn()) return;
  if (ev === 'takeoff' && x) {
    const ac = x, rt = dmRoute(ac), L = DM.lastRte[rt], m = dmMdi(ac), mine = !(typeof aiOwns === 'function' && aiOwns(ac));
    if (L && S.t - L.t < m*0.9 && mine && humanWorking()) { SC(ac).pts -= 10; SC(ac).infr++; sys(`Route spacing: ${ac.cs} took off ${Math.round(S.t - L.t)} s after ${L.cs} on ${rt} (needs ${m/60} min${dmReg(ac) ? ', a flow regulation' : ''}). −10`, true); }
    DM.lastRte[rt] = { t: S.t, cs: ac.cs };
    const e = SLOT[ac.cs];
    if (e && e.ctot != null) { const off = nowMin() - e.ctot; if (off < -5 || off > 10) { SC(ac).pts -= 15; sys(`${ac.cs} took off outside its slot window: −15.`, true); } else SC(ac).pts += 2; }
    DM.planT = -1;
  }
  // after an area flow stop: the routes it stopped go at five minutes for 20 minutes while the backlog clears
  if (ev === 'flowend' && x) { const keys = x.gates ? x.gates.map(g => '@' + g) : ['*'];
    for (const k of keys) DM.regs[k] = { mdi: DM_MDI_REG, until: S.t + 20*60, why: `recovery after the ${x.gates ? x.fix + ' ' : ''}flow stop`, name: x.gates ? x.fix : 'All routes' };
    coord(`After the stop, ${x.gates ? x.fix + ' departures' : 'all departures'} at ${DM_MDI_REG/60} minute intervals per route until ${dmTm(S.t + 20*60)}`, DM_FM); }
});

// ── the panel ──
function dmBody(){
  if (!S.running && !S.acs.length) return '<p class="dimmer am-empty">Start a session to see the departures.</p>';
  const on = dmOn(), regs = Object.entries(DM.regs).filter(([, R]) => R.until > S.t);
  const tog = `<label class="dm-tog"><input type="checkbox" data-dm="on" ${DM.on ? 'checked' : ''}> Departure manager on</label>`;
  if (!on) return `<div class="dm-hd">${tog}</div><p class="dimmer am-empty">Off: switch it on to plan start-up and take-off times (TSAT, TTOT), keep route spacing and work to slots (CTOT).</p>`;
  const P = dmPlan(), ids = Object.keys(P);
  const head = `<div class="dm-hd">${tog}<span class="dm-key"><span class="am-k amber">delay start-up to the TSAT</span><span class="am-k blue">start-up due</span><span class="am-k red">slot at risk</span></span></div>
    <div class="dm-regs">${regs.length ? regs.map(([k, R]) => `<span><b>${esc(R.name || k)}</b> ${R.mdi/60} min until ${dmTm(R.until)} · ${esc(R.why)}</span>`).join('') : `<span>Same route: ${DM_MDI/60} min between departures</span>`}</div>`;
  if (!ids.length) return head + '<p class="dimmer am-empty">No departures planned in the next 90 minutes.</p>';
  return head + ids.map(id => { const C = P[id];
    return `<section class="dm-col"><div class="am-ch"><b>${esc(C.rw)}</b><span>${C.rows.length} departure${C.rows.length === 1 ? '' : 's'} · ${C.rate} planned off in the next hour</span></div>
    <div class="dm-wrap"><table class="dm-t"><thead><tr><th>#</th><th>Flight</th><th>Status</th><th>Route</th><th class="dm-st">Stand</th><th>TOBT</th><th>TSAT</th><th>TTOT</th><th>CTOT</th></tr></thead><tbody>
    ${C.rows.map((r, i) => { const ac = r.ac, st = r.moving ? ({ PUSH: 'pushing', PULL: 'pulling forward', READY: 'ready to taxi', TAXI: 'taxiing', HOLDPT: 'at the holding point', LINEUP: 'lining up', LINEDUP: 'lined up' })[ac.state] : r.asking ? 'asking for start-up' : ac.dmTsat ? 'start-up delayed' : 'on stand';
      const btn = r.act === 'amber' ? ` <button type="button" class="dm-b" data-dmd="${esc(ac.cs)}">Delay to ${dmTm(r.tsat)}</button>` : r.act === 'blue' ? ' <b class="dm-go">start now</b>' : '';
      return `<tr class="${r.act}${S.sel === ac ? ' sel' : ''}" data-dmcs="${esc(ac.cs)}"><td>${i + 1}</td><td><b>${esc(ac.cs)}</b> <span class="dim">${esc(ac.t)}/${esc(ac.perf.wake || 'M')}</span>${aiOwns(ac) ? ' <em>AI</em>' : ''}</td><td>${st}${btn}</td><td>${esc(r.route || '')}${r.mdi > DM_MDI ? ` <em>${r.mdi/60}′</em>` : ''}</td><td class="dm-st">${esc(ac.stand ? ac.stand.id : '')}</td>
        <td>${r.tobt != null ? dmTm(ac.dmTobt ?? r.tobt) : '—'}</td><td>${r.tsat != null ? dmTm(r.tsat) : '—'}</td><td title="${esc(r.why ? 'held by: ' + r.why : 'its earliest')}">${dmTm(r.ttot)}${r.why ? '<i>*</i>' : ''}</td>
        <td>${r.ctot != null ? `<span class="${r.slotBad ? 'am-short' : ''}">${dmTm(r.ctot)}</span><small> ${dmTm(r.ctot - 300)}–${dmTm(r.ctot + 600)}</small>` : ''}</td></tr>`; }).join('')}
    </tbody></table></div></section>`; }).join('');
}
function dmRender(){
  const on = DM.open || (DM.win && !DM.win.closed); if (!on) { clearInterval(DM.timer); DM.timer = 0; return; }
  const html = dmBody();
  const d = document.getElementById('dmandock'); if (d) { const b = d.querySelector('.dm-body'), st = b.scrollTop; b.innerHTML = html; b.scrollTop = st; }
  if (DM.win && !DM.win.closed) { const b = DM.win.document.querySelector('.dm-body'); if (b) b.innerHTML = html; }
}
function dmClick(e){
  const b = e.target.closest && e.target.closest('[data-dmd]'); if (b) { command(`${b.dataset.dmd} TSAT`); DM.planT = -1; dmRender(); return; }
  const tr = e.target.closest && e.target.closest('tr[data-dmcs]'); if (tr) { const ac = S.acs.find(a => a.cs === tr.dataset.dmcs); if (ac) select(ac); dmRender(); }
}
function dmChange(e){ if (e.target && e.target.dataset && e.target.dataset.dm === 'on') { DM.on = e.target.checked; const s = document.getElementById('dmanSel'); if (s) s.value = DM.on ? 'on' : 'off'; DM.planT = -1; sys(DM.on ? 'Departure manager on.' : 'Departure manager off.'); dmRender(); } }
document.addEventListener('click', e => { if (e.target.closest && e.target.closest('#dmandock')) dmClick(e); });
document.addEventListener('change', dmChange);
function dmOpen(){
  DM.open = true;
  let d = document.getElementById('dmandock');
  if (!d) {
    d = document.createElement('aside'); d.id = 'dmandock'; d.className = 'cb-drawer am-drawer'; d.setAttribute('aria-label', 'Departure manager');
    d.innerHTML = `<div class="cb-top"><b>Departure manager</b><span class="grow"></span><button type="button" class="btn ghost" data-dmx="pop">Pop out</button><button type="button" class="db-x" data-dmx="x" aria-label="Close">✕</button></div><div class="dm-body cb-body"></div>`;
    document.body.appendChild(d);
    d.querySelector('[data-dmx="x"]').onclick = () => { d.remove(); DM.open = false; };
    d.querySelector('[data-dmx="pop"]').onclick = () => { d.remove(); DM.open = false; dmPop(); };
  }
  if (!DM.timer) DM.timer = setInterval(dmRender, 1000);
  dmRender();
}
function dmPop(){
  if (DM.win && !DM.win.closed) { DM.win.focus(); return; }
  const w = popWin('cwDman', `${APT.icao} departure manager`, 900, 760); if (!w) return;
  DM.win = w; w.document.body.innerHTML = `<div class="cb-page am-page"><div class="cb-top"><b>${esc(APT.name)} · departure manager</b></div><div class="dm-body am-body"></div></div>`;
  w.document.addEventListener('click', dmClick); w.document.addEventListener('change', dmChange);
  if (!DM.timer) DM.timer = setInterval(dmRender, 1000);
  dmRender();
}
{ const b = document.getElementById('tgDman'); if (b) b.onclick = () => dmOpen(); }
window.__dman = { plan: dmPlan, row: dmRow, open: dmOpen, pop: dmPop, DM };
