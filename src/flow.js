// ═════════════════════════ area control flow stops ═════════════════════════
// Now and then the next unit can't take any more departures: its sectors are full, storms block the departure routes,
// the military have the danger areas, a radar has failed. It phones the Tower to stop departures (all of them, or only
// those for one exit) until a time, cancelling any releases it gave, sometimes extends the stop, and calls again when
// departures can go. While a stop is on, take-off clearances are refused. It often lands on a departure already lined
// up: hold it there, or take it off the runway (VAC: by an exit ahead, to wait clear of that exit's holding point) and
// later taxi it back to its holding point (TAXI) to queue again. Crews waiting ask for news; DLY passes the delay.
const FLOW_RATE = { off: 0, some: 40*60, often: 15*60 };
const FLOW_WHY = ['airspace full, all sectors at capacity', 'the sector is overloaded', 'traffic holding in the en-route stacks',
  'thunderstorms on the departure routes', 'military activity in the danger areas', 'a radar failure at the area centre',
  'a staffing shortage, sectors bandboxed', 'an en-route flow regulation'];
function flowInit(level){ const rate = FLOW_RATE[level] || 0; S.flow = { level, rate, next: S.t + Math.max(8*60, rate*rnd(0.35, 0.8)), stop: null, n: 0 }; }
// the stop that holds this departure, if any
function flowStop(ac){ const F = S.flow && S.flow.stop; return F && ac && ac.kind === 'DEP' && !ac.airborne && (!F.gates || F.gates.includes(ac.gate)) ? F : null; }
function flowWhat(F){ return F.gates ? `departures via ${F.fix}` : 'all departures'; }
function flowEnd(F){ return zt(F.until).slice(0, 5); }
function flowMins(F){ return Math.max(1, Math.ceil((F.until - S.t)/60)); }
function flowUS(){ return /^K/.test(APT.icao); }   // the FAA calls it a ground stop
// the warning line on the ATIS panel
function flowLine(){ const F = S.flow && S.flow.stop; return F ? `<div class="warnline bad">${esc(F.who)}: ${flowUS() ? 'ground stop for ' : ''}${esc(flowWhat(F))} ${flowUS() ? '' : 'stopped '}until ${flowEnd(F)}Z, ${esc(F.why)}. Take-offs are refused until then.</div>` : ''; }
// departures waiting at, or on, the runway: the moment a stop bites
function flowAtRwy(ac){ return ac.kind === 'DEP' && ac.ground && !ac.handed && (['HOLDPT', 'LINEUP', 'LINEDUP'].includes(ac.state) || (ac.state === 'TAXI' && !ac.holdAt && ac.hp && HOLDS[ac.hp])); }

// a stop for one exit is named the way the area says it: the SID's route name (EXMOR, DEGUN), else the exit fix
function flowFix(ac){ const sid = sidName(ac.gate, depRw(ac)), w = sid && String(sid).split(' ')[0]; return w && /^[A-Z]{3,5}$/.test(w) ? w : (exitRouteOf(ac) || [ac.gate])[0]; }
function flowStart(){
  const at = S.acs.filter(flowAtRwy), lined = at.filter(o => o.state === 'LINEDUP' || o.state === 'LINEUP');
  const ac = lined[0] || at[Math.floor(Math.random()*at.length)];
  const gates = Object.keys(NEXT_UNIT), one = gates.length > 1 && ac.gate && Math.random() < 0.45;
  const mins = Math.round(rnd(4, 12)), until = Math.ceil((S.t + mins*60 + S.start/1000)/60)*60 - S.start/1000;   // to a whole minute
  const F = S.flow.stop = { id: ++S.flow.n, who: relUnit(ac), why: FLOW_WHY[Math.floor(Math.random()*FLOW_WHY.length)], until, gates: one ? [ac.gate] : null, fix: one ? flowFix(ac) : null, t: S.t, ext: false };
  const hit = S.acs.filter(o => flowStop(o) && o.ground), cxl = hit.filter(o => o.rel && (o.rel.st === 'OK' || o.rel.st === 'REQ'));
  for (const o of cxl) o.rel = { st: 'CXL' };
  coord(`${APT.coordName}, ${F.who}, ${flowUS() ? 'ground stop' : 'stop'} ${flowWhat(F)}, ${F.why}, until ${flowEnd(F)}${cxl.length ? `, release${cxl.length > 1 ? 's' : ''} for ${cxl.map(o => spoken(o.cs)).join(', ')} cancelled` : ''}`, F.who.toUpperCase());
  const ln = hit.filter(o => o.state === 'LINEDUP' || o.state === 'LINEUP'), gone = hit.filter(o => o.cto && o.state !== 'TAKEOFF');
  sys(`${F.who} has stopped ${flowWhat(F)} until ${flowEnd(F)}Z (${F.why}). Take-off clearances are refused until then.`
    + (gone.length ? ` ${gone.map(o => o.cs).join(' and ')} ${gone.length > 1 ? 'are' : 'is'} already cleared for take-off: cancel it (CXL).` : '')
    + (ln.length ? ` ${ln.map(o => o.cs).join(' and ')} ${ln.length > 1 ? 'are' : 'is'} on the runway: hold ${ln.length > 1 ? 'them' : 'it'} there, or vacate (VAC) to keep the runway free.` : ''), true);
  // the AI Tower cancels a take-off it gave straight away
  if (typeof aiOwns === 'function') for (const o of gone) if (aiOwns(o)) aiDo('TWR', o, 'CXL');
  nextAtis(); renderAtis(); emit('flowstop', F);
  if (S.sel && hit.includes(S.sel)) renderSel();
}
function flowStopEnd(){
  const F = S.flow.stop;
  // now and then the area needs longer
  if (!F.ext && Math.random() < 0.25) { F.ext = true; F.until += Math.round(rnd(3, 6))*60;
    coord(`${APT.coordName}, ${F.who}, the stop for ${flowWhat(F)} is extended until ${flowEnd(F)}`, F.who.toUpperCase());
    sys(`${F.who} has extended the stop on ${flowWhat(F)} until ${flowEnd(F)}Z.`, true); renderAtis(); return; }
  S.flow.stop = null; S.flow.next = S.t + Math.max(6*60, S.flow.rate*rnd(0.6, 1.2));
  const rel = S.acs.some(o => o.kind === 'DEP' && o.ground && needRel(o) && (!F.gates || F.gates.includes(o.gate)));
  for (const o of S.acs) { if (o.rel && o.rel.st === 'CXL') o.rel = { st: 'EXP' }; if (o.need === 'Asking for the delay') o.need = o.needWas || null; }
  coord(`${APT.coordName}, ${F.who}, ${flowWhat(F)} may resume${rel ? ', request releases as normal' : ''}`, F.who.toUpperCase());
  sys(`${F.who}: ${flowWhat(F)} can go again${rel ? '. Request a new release (REL) for each' : ''}.`);
  nextAtis(); renderAtis(); emit('flowend', F);
  if (S.sel) renderSel();
}
function stepFlow(){
  const L = S.flow; if (!L) return;
  if (L.stop) {
    if (S.t >= L.stop.until) return flowStopEnd();
    // crews held at the runway, or waiting clear of it after vacating, ask what is going on after a while
    for (const ac of S.acs) {
      const F = flowStop(ac); if (!F || ac.flowTold === F.id || ac.lost) continue;
      const waiting = ['HOLDPT', 'LINEDUP'].includes(ac.state) || (ac.state === 'TAXI' && ac.holdAt && !ac.path);
      if (!waiting || !ac.need || ac.need === 'Asking for the delay') continue;
      if (!ac.flowAsk || ac.flowAsk.id !== F.id) { ac.flowAsk = { id: F.id, t: S.t + rnd(60, 150) }; continue; }
      if (S.t < ac.flowAsk.t) continue;
      ac.needWas = ac.need; ac.need = 'Asking for the delay'; ac.flowTold = F.id;
      pilot(ac, ac.state === 'LINEDUP' ? 'we\'ve been lined up a while now, any news on our departure?' : 'any idea how long the delay will be?');
      if (S.sel === ac) renderSel();
    }
    return;
  }
  if (!L.rate || !S.running || S.t < L.next) return;
  // it bites when there is a departure at the runway: wait a few minutes for one, then try again later
  if (S.acs.some(flowAtRwy)) { L.next = Infinity; flowStart(); }   // the next one is planned when this one ends
  else if (S.t > L.next + 300) L.next = S.t + L.rate*rnd(0.3, 0.6);
}
// DLY: tell the crew about the stop (it waits; most crews also want an expected time)
function flowTell(ac){
  const F = flowStop(ac); if (!F) return null;
  ac.flowTold = F.id; if (ac.need === 'Asking for the delay') ac.need = ac.needWas || null;
  return [`${F.who} have stopped ${flowWhat(F)}, ${F.why}, expect departure not before ${flowEnd(F)}`, `copied, not before ${flowEnd(F)}`];
}
