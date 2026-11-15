// ═════════════════════════ equipment failures ═════════════════════════
// Now and then (Session › Failures and VFR traffic) something breaks for 8 to 20 minutes, and Engineering tells you:
// • radar: the picture is lost. Airborne flights show only as their last reported position (a grey plot updated
//   once a minute, as position reports come in) and you cannot vector: separate them with levels, holds and the
//   procedures until it comes back
// • your main transmitter on one position: nothing you say on it gets out until you select the standby (STBY),
//   which is weaker (more "say again")
// • the ATIS: arriving crews have no information and ask for the weather, which you pass with WX (−5 for each one
//   that lands without it)
const EQ = { on: null, next: 0, level: 'some' };
const EQ_RATE = { off: 0, some: 35*60, often: 15*60 };
function eqSay(t, bad){ if (typeof teamSay === 'function' && typeof TEAM !== 'undefined' && TEAM.people) teamSay('ENG', t); else sys('Engineering: ' + t, bad); }
function eqStart(k){
  const mine = AI_SEATS.filter(s => S.seats[s] !== 'AI'); if (!mine.length) return false;
  const mins = Math.round(rnd(8, 20));
  if (k === 'radar' && !mine.some(s => s === 'APP' || s === 'DEP')) return false;
  EQ.on = { k, until: S.t + mins*60, seat: k === 'freq' ? mine[Math.floor(Math.random()*mine.length)] : null, stby: false, plots: {} };
  if (k === 'radar') { eqPlots(true); eqSay(`Radar failure: we've lost the picture. About ${mins} minutes. You have position reports only: no vectoring, separate by levels and the procedures.`, true); }
  if (k === 'freq') eqSay(`Your main transmitter on ${AI_NAME[EQ.on.seat]} has failed. Select the standby (STBY) to keep talking. About ${mins} minutes to fix.`, true);
  if (k === 'atis') { eqSay(`The ATIS has failed. Arriving crews won't have the information: pass them the weather (WX). About ${mins} minutes.`, true); }
  if (typeof renderAtis === 'function') renderAtis();
  return true;
}
function eqEnd(){
  const k = EQ.on.k; EQ.on = null;
  eqSay(k === 'radar' ? 'Radar is back: normal service.' : k === 'freq' ? 'Main transmitter repaired: you can go back to it.' : 'The ATIS is broadcasting again.');
  if (typeof renderAtis === 'function') renderAtis();
}
// the last position each airborne flight reported (updated once a minute while the radar is out)
function eqPlots(all){
  for (const ac of S.acs) if (!ac.ground && ac.state !== 'PRE') { const p = EQ.on.plots[ac.cs]; if (all || !p || S.t - p.t >= 60) EQ.on.plots[ac.cs] = { x: ac.x, y: ac.y, alt: ac.alt, t: S.t + (all ? 0 : -(hash(ac.cs) % 60)) }; }
}
function eqStep(){
  if (!S.running || S.t < 1) return;   // (not before the session's own settings are read)
  if (EQ.on) {
    if (S.t >= EQ.on.until) eqEnd();
    else if (EQ.on.k === 'radar') eqPlots(false);
    else if (EQ.on.k === 'atis') for (const ac of S.acs) if (ac.kind === 'ARR' && ac.airborne && ac.state !== 'PRE' && !aiOwns(ac) && !ac.noAtis && !ac.wxGiven) { ac.noAtis = true; pilot(ac, 'we have not received the ATIS, request the weather'); if (!ac.need) ac.need = 'Request weather'; }
    return;
  }
  if (!EQ_RATE[EQ.level]) return;
  if (!EQ.next) EQ.next = S.t + (EQ_RATE[EQ.level] || 0)*rnd(0.5, 1.1);
  if (EQ_RATE[EQ.level] && S.t >= EQ.next) { EQ.next = S.t + EQ_RATE[EQ.level]*rnd(0.8, 1.4); const ks = ['radar', 'freq', 'atis'].sort(() => Math.random() - 0.5); for (const k of ks) if (eqStart(k)) break; }
}
// an instruction the failure stops: returns why, or null
function eqBlock(ac, toks){
  if (!EQ.on || aiCtx) return null;
  if (EQ.on.k === 'freq' && !EQ.on.stby && seatOf(ac) === EQ.on.seat) return `Nothing heard: your main transmitter on ${AI_NAME[EQ.on.seat]} has failed. Select the standby with STBY.`;
  if (EQ.on.k === 'radar' && ac.airborne && toks.some(t => /^[HLR]\d{1,3}$/.test(t))) return `No radar: you cannot give ${ac.cs} a heading. Use levels, holds (HOLD), the procedures (APP, DCT) instead.`;
  return null;
}
const eqMissAdd = ac => EQ.on && EQ.on.k === 'freq' && EQ.on.stby && seatOf(ac) === EQ.on.seat ? 0.08 : 0;
// STBY (no callsign): over to the standby transmitter
function eqCommand(toks){
  if (toks[0] !== 'STBY' || toks.length !== 1) return false;
  if (!EQ.on || EQ.on.k !== 'freq') { sys('All transmitters are working: no need for the standby.'); return true; }
  EQ.on.stby = true; sys(`Standby transmitter selected on ${AI_NAME[EQ.on.seat]}: you can talk again, but the signal is weaker.`); return true;
}
// WX: the weather passed to a crew that has no ATIS
function wxCmd(ac, said, reads){
  const w = S.wx;
  said.push(`no ATIS available, wind ${w.vrb ? 'variable' : hdg3(w.dir) + ' degrees'} ${w.spd} knots, ${w.vis >= 9999 ? 'visibility 10 kilometres or more' : 'visibility ' + w.vis + ' metres'}, QNH ${APT.inHg ? w.inhg.toFixed(2) : w.qnh}, runway ${S.rwy}`);
  reads.push(`QNH ${APT.inHg ? w.inhg.toFixed(2) : w.qnh}, runway ${S.rwy}`); ac.wxGiven = true; if (ac.need === 'Request weather') ac.need = null;
}
S.listeners.push((ev, ac) => {
  if (ev === 'start') { EQ.on = null; EQ.next = 0; const el = document.getElementById('otherSel'); EQ.level = el ? el.value : 'some'; if (EXERCISES[S.mode]) EQ.level = 'off'; }
  if (ev === 'landed' && ac && ac.noAtis && !ac.wxGiven && !aiOwns(ac)) { SC(ac).pts -= 5; sys(`${ac.cs} landed without being given the weather (no ATIS) (−5).`, true); }
});
// the radar picture while it is out: grey plots and levels, no symbols
const _drawAc = drawAc;
drawAc = function(ac){
  if (EQ.on && EQ.on.k === 'radar' && !ac.ground && ac.state !== 'PRE') {
    const p = EQ.on.plots[ac.cs]; if (!p) return;
    const X = sx(p.x), Y = sy(p.y); cx.strokeStyle = 'rgba(160,170,180,.9)'; cx.lineWidth = 1.5;
    cx.beginPath(); cx.moveTo(X - 5, Y - 5); cx.lineTo(X + 5, Y + 5); cx.moveTo(X + 5, Y - 5); cx.lineTo(X - 5, Y + 5); cx.stroke();
    cx.fillStyle = 'rgba(180,190,200,.95)'; cx.font = `11px ${typeof FONT_L !== 'undefined' ? FONT_L : 'monospace'}`; cx.fillText(`${ac.cs} ${Math.round(p.alt/100)} · ${Math.round((S.t - p.t)/60)}m`, X + 8, Y - 4);
    return;
  }
  return _drawAc(ac);
};
function eqPanel(){
  if (!EQ.on) return '';
  const left = Math.max(1, Math.ceil((EQ.on.until - S.t)/60));
  const t = EQ.on.k === 'radar' ? 'RADAR FAILURE: position reports only, no vectoring' : EQ.on.k === 'freq' ? `TRANSMITTER FAILURE on ${AI_NAME[EQ.on.seat]}${EQ.on.stby ? ': on standby' : ': select STBY'}` : 'ATIS FAILURE: pass the weather with WX';
  return `<div class="warnline bad">${t} · about ${left} min</div>`;
}
