// ═════════════════════════ emergencies and things going wrong ═════════════════════════
// A scheduler picks an event that fits the traffic on frequency: a MAYDAY, a medical PAN, a medical diversion from an
// overflight, a bird strike, debris or an inspection closing the runway, a pedestrian jumping the barrier on the
// avenue, or a windshear report in the levanter. The first transmission to an emergency acknowledges it.
const EMG_RATE = { off: 0, some: 22*60, often: 9*60 };
const DIVERTS = APT.diverts || [
  { cs: 'TOM5HM', t: 'B738', o: 'EGBB', gate: 'E', to: 'Marrakech' },
  { cs: 'EZY35KM', t: 'A20N', o: 'EGKK', gate: 'E', to: 'Marrakech' },
  { cs: 'EXS4LW', t: 'B738', o: 'EGCC', gate: 'W', to: 'Tenerife' },
  { cs: 'RAM970', t: 'B738', o: 'GMMN', gate: 'S', to: 'Paris' }
];
const MAYDAYS = ['engine failure', 'engine fire, fire is out', 'smoke in the cabin', 'hydraulic failure'];
const MEDICAL = ['a passenger with suspected heart attack', 'a passenger having a stroke', 'a passenger unconscious, not responding', 'a crew member taken seriously ill'];
const pob = ac => ac.perf.wake === 'L' ? Math.round(rnd(3, 9)) : ac.t === 'AT76' ? Math.round(rnd(40, 68)) : Math.round(rnd(120, 186));
function emgInit(level){
  S.emg = { level, rate: EMG_RATE[level] || 0, next: S.t + rnd(7, 13)*60, rwyBlock: null, incursion: null, ws: null, inspectAfter: null, handled: 0 };
}
const rwyBlocked = () => S.emg && (S.emg.rwyBlock ? S.emg.rwyBlock.why : S.emg.incursion ? 'a pedestrian on the runway at the crossing' : null);
const onFinalNear = (ac, nm) => ac.airborne && ac.kind === 'ARR' && ac.mode === 'FINAL' && ac.app && ac.state !== 'MISSED' && finalDist(ac) < nm;
function finalDist(ac){ const F = finOf(ac); return F ? onFinal(ac, F).togo : 99; }

function declare(ac, k, why, extra){
  ac.emerg = { k, why, t: S.t, ack: false };
  ac.sqkWas = ac.sqk; ac.sqk = k === 'MAYDAY' ? '7700' : ac.sqk;
  const three = k === 'MAYDAY' ? 'MAYDAY MAYDAY MAYDAY' : 'PAN PAN, PAN PAN, PAN PAN';
  pilot(ac, `${three}, ${ac.unit()}, ${spoken(ac.cs)}, ${why}, ${extra}, ${pob(ac)} persons on board`);
  ac.need = `${k}: ${why.split(',')[0]}`;
  sys(`${k === 'MAYDAY' ? 'Distress' : 'Urgency'}: ${ac.cs} ${why}. Acknowledge it, give it priority and a straight-in approach. Emergency services are alerted.`, true);
  emit('emergency', ac);
  if (S.sel !== ac) select(ac);
}
// a departure in trouble becomes an arrival back to the home airport
function makeReturn(ac){
  Object.assign(ac, { kind: 'ARR', o: APT.icao, d: undefined, state: 'VECTORS', route: [], app: null, ctl: false, onSid: false, handed: false, turn: null, stand: null,
    checked: false, shearChecked: false, warnedCtl: false, warned15: false, warned10: false, askedApp: true, cto: false });
  if (ac.mode === 'NAV') { ac.mode = 'HDG'; ac.tgtHdg = Math.round(ac.hdg); }
  ac.tgtAlt = ac.cleared = Math.min(ac.tgtAlt || 4000, 4000);
  S.score.pts += 0;
}
function block(why, mins){
  const E = S.emg; E.rwyBlock = { why, until: S.t + mins*60 };
  sys(`Runway ${S.rwy} CLOSED: ${why}. About ${Math.round(mins)} minutes. Send arrivals around or hold them, and hold departures.`, true);
  for (const a of S.acs) if (a.ctl && a.airborne && a.mode === 'FINAL') sys(`${a.cs} is cleared to land on a closed runway: send it around.`, true);
  nextAtis(); renderAtis(); emit('rwyblock', why);
}

const EVENTS = {
  mayday(){
    const c = S.acs.filter(a => a.airborne && !a.emerg && a.state !== 'PRE' && !a.handed && a.state !== 'MISSED' && a.state !== 'DIVERTING' &&
      ((a.kind === 'ARR' && ['INBOUND','VECTORS','HOLDING'].includes(a.state) && Math.hypot(a.x - RADAR_REF[0], a.y - RADAR_REF[1]) > 10) || (a.kind === 'DEP' && a.state === 'CLIMB' && a.alt > 2500)));
    if (!c.length) return false;
    const ac = c[Math.floor(Math.random()*c.length)], why = MAYDAYS[Math.floor(Math.random()*MAYDAYS.length)];
    const ret = ac.kind === 'DEP'; if (ret) makeReturn(ac);
    if (/engine/.test(why)) ac.tgtSpd = Math.min(ac.tgtSpd || 999, ac.perf.vapp + 40);
    declare(ac, 'MAYDAY', why, `${altShort(Math.round(ac.alt/100)*100)}, request ${ret ? 'immediate return, ' : ''}priority landing runway ${S.rwy}`);
    return true;
  },
  medical(){
    const c = S.acs.filter(a => a.airborne && !a.emerg && a.kind === 'ARR' && ['INBOUND','VECTORS','HOLDING'].includes(a.state));
    if (!c.length) return false;
    const ac = c[Math.floor(Math.random()*c.length)];
    declare(ac, 'PAN', `medical emergency, ${MEDICAL[Math.floor(Math.random()*MEDICAL.length)]}`, 'request priority and an ambulance on arrival');
    return true;
  },
  divert(){
    if (S.acs.filter(a => a.airborne && a.kind === 'ARR').length > 5) return false;
    const opts = DIVERTS.filter(d => !S.acs.some(a => a.cs === d.cs)); if (!opts.length) return false;
    const d = opts[Math.floor(Math.random()*opts.length)];
    const ac = spawnArrival({ cs: d.cs, t: d.t, k: 'ARR', o: d.o, gate: d.gate, m: S.t/60, diverted: true });
    ac.need = null;
    declare(ac, 'PAN', `medical diversion, ${MEDICAL[Math.floor(Math.random()*MEDICAL.length)]}, we were en route to ${d.to}`, `request diversion to ${APT.name} and an ambulance on arrival`);
    return true;
  },
  bird(){
    const dep = S.acs.filter(a => a.kind === 'DEP' && a.airborne && !a.emerg && a.alt < 2500 && a.alt > 400);
    if (dep.length) {
      const ac = dep[0]; makeReturn(ac); ac.tgtSpd = ac.perf.vapp + 40;
      declare(ac, 'PAN', 'bird strike on departure, vibration on number two engine', `${altShort(Math.round(ac.alt/100)*100)}, request return runway ${S.rwy}`);
      S.emg.inspectAfter = 'bird'; block('runway inspection after a bird strike on departure', rnd(3, 5));
      return true;
    }
    const arr = S.acs.find(a => a.kind === 'ARR' && (a.state === 'ROLLED' || a.state === 'ROLLOUT'));
    if (arr) { pilot(arr, `be advised, we had a bird strike on short final, birds over the runway`); block('bird strike reported on short final, runway inspection and bird scaring', rnd(3, 5)); return true; }
    return false;
  },
  fod(){
    if (S.emg.rwyBlock || S.acs.some(a => a.onRwy || onFinalNear(a, 2))) return false;
    const what = [APT.xing ? 'debris (FOD) found on the runway near the crossing' : 'debris (FOD) found on the runway', 'a tyre fragment found on the runway', APT.xing ? 'a fuel spill on the runway from a vehicle at the crossing' : 'a fuel spill on the runway from a fire vehicle'][Math.floor(Math.random()*3)];
    block(what, rnd(4, 7)); return true;
  },
  incursion(){
    if (!APT.xing || S.xing.st !== 'CLOSED' || S.emg.incursion) return false;
    const ac = S.acs.find(a => onFinalNear(a, 4) && finalDist(a) > 1.2); if (!ac) return false;
    S.emg.incursion = { until: S.t + rnd(70, 110), ac: ac.cs, gaBy: null };
    sys(`RUNWAY INCURSION: a pedestrian has climbed the barrier at Winston Churchill Avenue and is on the runway. ${ac.cs} is on ${finalDist(ac).toFixed(1)} NM final: send it around (GA).`, true);
    emit('incursion', ac); if (S.sel !== ac) select(ac);
    return true;
  },
  windshear(){
    const w = S.wx, lev = w.dir >= 40 && w.dir <= 140 && w.spd >= 15;
    if (!lev && (w.gust || 0) < 25) return false;
    const ac = S.acs.find(a => onFinalNear(a, 4)) || S.acs.find(a => a.kind === 'ARR' && (a.state === 'ROLLED' || a.state === 'ROLLOUT'));
    if (!ac) return false;
    shearReport(ac, ac.app || S.rwy); return true;
  }
};
const loss = () => Math.round(rnd(3, 5))*5;
function shearReport(ac, rw){
  const kt = loss(), ft = Math.round(rnd(3, 8))*100;
  S.emg.ws = { t: S.t, rw, by: `${ac.t}`, cs: ac.cs, text: `loss of ${kt} knots at ${ft} feet` };
  pilot(ac, `be advised, windshear on final runway ${rw}, ${S.emg.ws.text}`);
  sys(`Windshear report from ${ac.cs}: pass it to arrivals on approach with WS. It is now on the ATIS.`, true);
  for (const a of S.acs) a.wsTold = false;
  nextAtis(); renderAtis();
}
function stepEmerg(dt){
  const E = S.emg; if (!E) return;
  if (E.rwyBlock && S.t >= E.rwyBlock.until) { E.rwyBlock = null; sys(`Runway ${S.rwy} inspection complete: the runway is open again.`); nextAtis(); renderAtis(); emit('rwyopen'); }
  if (E.incursion && S.t >= E.incursion.until) { E.incursion = null; sys('The pedestrian has been escorted off the runway by the police: the crossing is clear.'); }
  if (E.ws && S.t - E.ws.t > 25*60) { E.ws = null; nextAtis(); renderAtis(); }
  if (E.inspectAfter && E.inspectAfter.cs && !E.inspectAfter.onRwy && !E.inspectAfter.airborne) { E.inspectAfter = null; block('runway inspection after the emergency landing', rnd(2.5, 4)); }
  for (const ac of S.acs) if (ac.emerg && !ac.emerg.ack && !ac.emerg.late && S.t - ac.emerg.t > 60) { ac.emerg.late = true; S.score.pts -= 10; sys(`${ac.cs}'s ${ac.emerg.k} has not been acknowledged.`, true); }
  if (E.rate && S.t >= E.next && S.running) {
    E.next = S.t + E.rate*rnd(0.7, 1.3);
    const w = S.wx, windy = (w.dir >= 40 && w.dir <= 140 && w.spd >= 15) || (w.gust || 0) >= 25;
    const bag = ['mayday','medical','medical','divert','bird','bird','fod','incursion','incursion', ...(windy ? ['windshear','windshear','windshear'] : [])];
    for (let n = 0; n < 6; n++) { const k = bag.splice(Math.floor(Math.random()*bag.length), 1)[0]; if (k && EVENTS[k]()) break; }
  }
}
// hooks called from the command parser and the approach logic
function emgAck(ac){
  if (!ac.emerg || ac.emerg.ack) return null;
  ac.emerg.ack = true; if (!ac.emerg.late) S.score.pts += 10;
  if (ac.need && /^(MAYDAY|PAN)/.test(ac.need)) ac.need = null;
  return `roger ${ac.emerg.k}, ${ac.emerg.k === 'MAYDAY' ? 'you are number one, ' : ''}runway ${S.rwy}, emergency services are standing by`;
}
function emgOnGA(ac){
  const I = S.emg && S.emg.incursion;
  if (I && I.ac === ac.cs && !I.gaBy) { I.gaBy = 'atc'; S.score.pts += 20; S.score.good = (S.score.good || 0) + 1; sys(`Good call: ${ac.cs} sent around clear of the pedestrian on the runway.`); }
}
function emgBlockedFinal(ac, why){   // an arrival reaching short final with the runway closed goes around by itself
  const I = S.emg.incursion;
  if (I && I.ac === ac.cs) { I.gaBy = 'crew'; S.score.pts -= 25; sys(`${ac.cs}'s crew saw the pedestrian on the runway and went around on their own.`, true); }
  else if (ac.ctl) { S.score.pts -= 30; S.score.incidents++; sys(`${ac.cs} was still cleared to land on a closed runway and went around at short final.`, true); }
  return goAround(ac, I ? 'person on the runway' : 'runway closed');
}
function emgWS(ac){
  const W = S.emg && S.emg.ws;
  if (!W) return null;
  if (!ac.wsTold) { ac.wsTold = true; S.score.pts += 5; }
  const ago = Math.max(1, Math.round((S.t - W.t)/60));
  return `windshear reported on final runway ${W.rw} by ${W.cs === ac.cs ? 'you' : 'a ' + (TYPES[W.by] ? TYPES[W.by].name : W.by)} ${ago} minute${ago === 1 ? '' : 's'} ago, ${W.text}`;
}
S.listeners.push((ev, ac) => {
  if (ev === 'landed' && ac && ac.emerg) {
    S.score.pts += 40; S.emg.handled++;
    sys(`${ac.cs} has landed safely after its ${ac.emerg.k}. ${ac.emerg.k === 'MAYDAY' ? 'Fire service following it in.' : 'Ambulance meeting it on stand.'}`);
    if (ac.emerg.k === 'MAYDAY' || S.emg.inspectAfter === 'bird') S.emg.inspectAfter = ac;
    ac.emerg.done = true;
  }
});
// draw: closed runway crosses, a figure on the crossing during an incursion
function drawRwyBlock(){
  const E = S.emg; if (!E || (!E.rwyBlock && !E.incursion)) return;
  const pulse = E.still ? 1 : 0.55 + 0.45*Math.sin(performance.now()/220);
  cx.save(); cx.strokeStyle = C.conf; cx.lineWidth = 3; cx.globalAlpha = pulse;
  if (E.rwyBlock) for (const m of [RWY_M*0.18, RWY_M*0.5, RWY_M*0.82]) {
    const c0 = rm(m, 0), X = sx(c0[0]), Y = sy(c0[1]), k = Math.max(7, 30*M2NM*V.scale);   // never smaller than a few pixels
    cx.beginPath(); cx.moveTo(X - k, Y - k*0.5); cx.lineTo(X + k, Y + k*0.5); cx.moveTo(X - k, Y + k*0.5); cx.lineTo(X + k, Y - k*0.5); cx.stroke();
  }
  if (E.incursion && APT.xing) { const p = rm(xingM(4), 4); cx.fillStyle = C.conf; cx.beginPath(); cx.arc(sx(p[0]), sy(p[1]), 6, 0, 7); cx.fill(); }
  cx.restore();
}
