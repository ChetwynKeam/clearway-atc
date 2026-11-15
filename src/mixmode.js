// ═════════════════════════ mixed-mode runway tactics ═════════════════════════
// On a runway that lands and departs at once, the arrival spacing decides how many departures get away between the
// landings. Set it on the ATIS panel, per runway:
// • Auto: as before, a departure gap after every landing while the holds are quiet, every second or third when busy
// • 6 NM gaps: every arrival at least 6 NM behind the one ahead, one departure in each gap
// • 8 NM gaps: at least 8 NM, room for a departure even behind a heavy or a slow line-up
// • a departure between every arrival: the gap for the departure waiting after every landing, however busy the holds
// With a set spacing the Tower works the gaps tightly, as a real mixed-mode runway does: a departure is cleared for
// take-off with the next arrival still at least about 3 NM out, rather than the AI's usual wide margin.
// The AI Approach spaces its arrivals to it (landGapS and holdGap in ai.js). The panel shows the runway's capacity
// with each choice, in arrivals and departures an hour (other limits, the holds, the taxi, can keep the real numbers lower), and the flow manager (in the team chat on a shift, else on the landline) agrees
// or warns what it costs against the inbounds due in the next hour.
const MIX_OPTS = [['auto', 'Auto'], ['6', '6 NM gaps'], ['8', '8 NM gaps'], ['alt', 'Dep. every arrival']];
const MIX_SAY = { auto: 'auto spacing', 6: '6 NM gaps', 8: '8 NM gaps', alt: 'a departure between every arrival' };
const MIX_CLR = 30;   // seconds on top of the line-up and roll the next arrival must still be away (the AI's usual: 110)
const mixOf = R => (R && S.mix && S.mix[R.id]) || null;
const mixNM = R => { const k = mixOf(R); return k === '6' ? 6 : k === '8' ? 8 : 0; };
// the runways landing and departing now
function mixRwys(){
  const land = new Set(), dep = new Set();
  try { land.add(rwyOf(S.rwy).id); } catch (e) {}
  for (const o of S.acs) if (o.kind === 'ARR' && o.airborne && !o.handed) { try { land.add(rwyOf(landRw(o)).id); } catch (e) {} }
  try { for (const r of depRwys()) dep.add(rwyOf(r).id); } catch (e) {}
  return [...land].filter(id => dep.has(id)).map(id => rwyById(id)).filter(Boolean);
}
// the arrivals and departures an hour each choice gives on this runway (medium behind medium at 140 kt, landings
// vacating as they have been, departures lined up and waiting)
function mixRates(R, k){
  const v = 140, wx = wxSlow(), occ = occS(R), base = Math.max(4/v*3600, occ + 25)*wx, depInt = 90*wx;
  const clr = k && k !== 'auto' ? MIX_CLR : 110, need = 45 + clr;   // the departure's roll plus the margin, after the landing has vacated
  const fit = I => I - occ < need ? 0 : 1 + Math.floor((I - occ - need)/depInt);
  const gapAuto = occ + need + 15;
  let arr, dep;
  if (k === '6' || k === '8') { const I = Math.max(base, (k === '6' ? 6 : 8)/v*3600*wx); arr = 3600/I; dep = arr*fit(I); }
  else if (k === 'alt') { const I = Math.max(base, occ + need + 15); arr = 3600/I; dep = arr*fit(I); }
  else { const cyc = 2*base + Math.max(base, gapAuto); arr = 3*3600/cyc; dep = 3600/cyc*fit(Math.max(base, gapAuto)); }   // busy holds: a gap every third landing
  return { arr: Math.round(arr), dep: Math.round(dep) };
}
// the flow manager's view: the inbounds due in the next hour against the new landing rate
function mixSay(R, k){
  const r = mixRates(R, k), h = typeof demandIn === 'function' ? demandIn(-2, 60) : { arr: 0, dep: 0 };
  const name = MIX_SAY[k || 'auto'];
  let text;
  if (h.arr > r.arr + 1) text = `${name[0].toUpperCase() + name.slice(1)} on ${R.lo}/${R.hi} takes us to about ${r.arr} arrivals an hour, and I've got ${h.arr} inbound in the next hour: expect holding to build, around ${Math.round((h.arr - r.arr)*60/Math.max(1, r.arr))} minutes by the end of it. I'd keep it short, or regulate the arrivals.`;
  else if (h.dep > r.dep + 2 && k !== 'alt') text = `${name[0].toUpperCase() + name.slice(1)} on ${R.lo}/${R.hi}: about ${r.arr} arrivals and ${r.dep} departures an hour. The arrivals fit (${h.arr} due), but there are ${h.dep} departures waiting to go this hour, so the queue will grow.`;
  else text = `Agreed, ${name} on ${R.lo}/${R.hi}: about ${r.arr} arrivals and ${r.dep} departures an hour. ${h.arr} inbound and ${h.dep} departures due this hour, so that works.`;
  if (typeof TEAM !== 'undefined' && TEAM.people && typeof teamSay === 'function') teamSay('FMP', text, true);
  else if (typeof cbAdd === 'function') cbAdd({ from: 'Flow manager', text });
}
function mixSet(id, k){
  const R = rwyById(id); if (!R) return;
  S.mix ||= {}; if (!k || k === 'auto') delete S.mix[id]; else S.mix[id] = k;
  if (typeof AMAN !== 'undefined') AMAN.t = -1;
  sys(`Runway ${R.lo}/${R.hi}: ${k && k !== 'auto' ? MIX_SAY[k] + ' for the arrivals' : 'arrival spacing back to auto'}.`);
  mixSay(R, k);
  if (typeof renderAtis === 'function') renderAtis();
}
function mixPanel(){
  if (!S.running) return '';
  return mixRwys().map(R => { const cur = mixOf(R) || 'auto';
    return `<div class="mix"><div class="mix-h"><span class="lbl">Mixed mode ${esc(R.lo)}/${esc(R.hi)} · arrival spacing</span><span class="dimmer mix-n">runway capacity an hour</span></div>
      <div class="mix-o">${MIX_OPTS.map(([k, l]) => { const r = mixRates(R, k); return `<button type="button" data-mix="${esc(R.id)}:${k}" class="${cur === k ? 'on' : ''}" title="${esc(l)}: about ${r.arr} arrivals and ${r.dep} departures an hour"><b>${esc(l)}</b><span>${r.arr} arr · ${r.dep} dep /h</span></button>`; }).join('')}</div></div>`; }).join('');
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-mix]'); if (!b) return; const [id, k] = b.dataset.mix.split(':'); mixSet(id, k); });
S.listeners.push(ev => { if (ev === 'start') S.mix = {}; });
window.__mix = { rates: mixRates, set: mixSet, rwys: mixRwys };
