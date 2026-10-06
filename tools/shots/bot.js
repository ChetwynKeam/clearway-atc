// A tidy controller for screenshots: works every flight with the obvious next clearance, so the
// pictures show a well-run session. Runs inside the simulator page (globals S, command, outOfCtl, ...).
window.__bot = function botTick(){
  const said = [];
  const go = (ac, c) => { said.push(ac.cs + ' ' + c); try { command(ac.cs + ' ' + c); } catch (_) {} };
  // Gibraltar: keep Winston Churchill Avenue closed while the bot works the traffic
  if (APT.xing && (S.xing.st === 'OPEN' || S.xing.st === 'OPENING') && !S.acs.some(a => a.onRwy)) toggleXing();
  for (const ac of S.acs) {
    if (outOfCtl(ac) || ac.state === 'PRE') continue;
    if (ac.emerg && !ac.emerg.ack) { go(ac, 'ROG'); continue; }
    if (ac.need === 'Say again' && ac.lastCmd) { command(ac.cs + ' ' + ac.lastCmd); continue; }
    if (ac.diverting) { go(ac, `DCT ${ac.diverting} A${(APT.divertAlt || 8000)/100}`); continue; }
    if (ac.kind === 'ARR') {
      if (ac.airborne) {
        const togo = Math.hypot(ac.x - RADAR_REF[0], ac.y - RADAR_REF[1]);
        // space the approaches: wait while another cleared arrival is within 7 NM of the same distance out
        const tooClose = S.acs.some(o => o !== ac && o.kind === 'ARR' && o.airborne && !outOfCtl(o) && (o.app || o.mode === 'FINAL') && Math.abs(Math.hypot(o.x - RADAR_REF[0], o.y - RADAR_REF[1]) - togo) < 7);
        if (ac.freq === 'RAD' && ac.mode !== 'FINAL' && !ac.app && ac.need && !tooClose) go(ac, /RNP/.test(ac.need) && APT.rnp ? APT.rnpButtons(S.rwy)[0][0] : 'APP');
        else if (ac.freq === 'RAD' && (ac.mode === 'FINAL' || ac.app) && togo < 14) go(ac, 'HO');
        else if (ac.freq === 'TWR' && !ac.ctl) go(ac, 'CTL');
      } else {
        if (typeof xingAhead === 'function' && xingAhead(ac) >= 0 && ac.hsAt) go(ac, 'CROSS ' + rwyName(ac.path.pts[xingAhead(ac)].hs));
        else if (ac.vacated && !ac.taxiIn && ac.state === 'VACATING' && !ac.onRwy) go(ac, 'TAXI');
      }
    } else {
      if (ac.airborne) { if (ac.need || ac.freq === 'TWR') go(ac, 'HO'); continue; }
      if (typeof xingAhead === 'function' && xingAhead(ac) >= 0 && ac.hsAt) { go(ac, 'CROSS ' + rwyName(ac.path.pts[xingAhead(ac)].hs)); continue; }
      if (ac.need === 'Request tow') go(ac, 'TOW');
      else if (ac.state === 'PARKED' && ac.need) go(ac, 'PUSH');
      else if (ac.state === 'READY' && ac.need) go(ac, 'TAXI');
      else if (ac.state === 'HOLDPT' || ac.state === 'TAXI') {
        if (needRel(ac) && (!ac.rel || ac.rel.st === 'EXP')) go(ac, 'REL');
        else if (ac.state === 'HOLDPT' && (!needRel(ac) || (ac.rel && ac.rel.st === 'OK' && !(ac.rel.nb && S.t < ac.rel.nb)))) {
          const busy = S.acs.some(o => o !== ac && !outOfCtl(o) && (o.onRwy || (o.kind === 'ARR' && o.airborne && o.mode === 'FINAL' && Math.hypot(o.x - RADAR_REF[0], o.y - RADAR_REF[1]) < 5)));
          if (!busy) go(ac, 'CTO');
        }
      }
    }
  }
  return said;
};
