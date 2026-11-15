// ═════════════════════════ holding: expected approach times and fuel ═════════════════════════
// A flight that holds needs an expected approach time (EAT): UK practice is to give one when the delay will be 20
// minutes or more. Crews ask for it after about 10 minutes in the hold (EAT gives one worked out from the
// sequence; EAT 1432 a time of your own). Holding 20 minutes with none given costs 5 points.
// Each arrival carries holding fuel for 30 to 70 minutes. With 15 minutes left the crew says "minimum fuel"; when it
// runs out it declares a MAYDAY for fuel. An EAT later than its fuel allows gets "unable, we'll divert at …".
// (Your flights only: the AI controllers keep their own counts.)
const fuelHoldS = ac => (30 + hash(ac.cs + 'fuel') % 41)*60;
function eatFor(ac){
  // behind everything already on the approach, and the flights that have held longer than this one
  const ahead = S.acs.filter(o => o !== ac && o.kind === 'ARR' && o.airborne && (o.app || (o.mode === 'HOLD' && (o.holdS || 0) > (ac.holdS || 0)))).length;
  const gap = 60/Math.max(10, typeof capHour === 'function' ? capHour() : 30);
  const t = S.t + (3 + ahead*gap)*60;
  return Math.ceil(t/60)*60;
}
function eatCmd(ac, tok, said, reads){
  if (ac.kind !== 'ARR' || !ac.airborne) { sys(`${ac.cs} is not an arrival in the air.`); return; }
  let t = null;
  if (tok && /^\d{4}$/.test(tok)) { const h = +tok.slice(0, 2), m = +tok.slice(2), base = Math.floor(((S.start || 0) + S.t*1000)/864e5)*864e5; t = (base + (h*60 + m)*60e3 - (S.start || 0))/1000; if (t < S.t - 600) t += 86400; }
  else t = eatFor(ac);
  ac.eat = t; ac.eatAsked = false; if (ac.need === 'Request EAT') ac.need = null;
  const hm = zt(t).slice(0, 5).replace(':', '');
  said.push(`expect approach at ${hm}`);
  const left = fuelHoldS(ac) - (ac.holdS || 0), wait = t - S.t;
  if (!aiOwns(ac) && wait > left + 60) { const until = zt(S.t + Math.max(0, left)).slice(0, 5).replace(':', ''); reads.push(`unable to hold until ${hm}, we can hold until ${until} then we'll divert`); ac.fuelDiv = S.t + Math.max(60, left); }
  else reads.push(`expect approach ${hm}`);
}
function holdStep(dt){
  for (const ac of S.acs) {
    if (ac.kind !== 'ARR' || !ac.airborne || ac.state === 'PRE') continue;
    if (ac.mode === 'HOLD') { ac.holdS = (ac.holdS || 0) + dt; ac.holdNow = (ac.holdNow || 0) + dt; } else ac.holdNow = 0;
    if (aiOwns(ac) || ac.diverting || ac.emerg) continue;
    if (ac.mode === 'HOLD' && !ac.eat && !ac.eatAsked && ac.holdNow > 600) { ac.eatAsked = true; if (!ac.need) ac.need = 'Request EAT'; pilot(ac, 'request expected approach time'); }
    if (ac.mode === 'HOLD' && !ac.eat && !ac.eatLate && ac.holdNow > 1200) { ac.eatLate = true; SC(ac).pts -= 5; sys(`${ac.cs} has held 20 minutes with no expected approach time (−5): give it one with EAT.`, true); }
    const left = fuelHoldS(ac) - (ac.holdS || 0);
    if (!ac.minFuel && left < 900 && ac.holdS > 0) { ac.minFuel = true; ac.need = 'Minimum fuel'; pilot(ac, `minimum fuel, we can accept little further delay`); }
    if (!ac.fuelMay && left <= 0 && typeof declare === 'function') { ac.fuelMay = true; declare(ac, 'MAYDAY', 'fuel', 'request an immediate approach'); }
    if (ac.fuelDiv && S.t >= ac.fuelDiv && !ac.app && ac.mode === 'HOLD') { ac.fuelDiv = null; if (!ac.divertAt && !ac.diverting) { ac.divertAt = S.t; ac.divertTo = APT.divertTo(ac); } }
  }
}
