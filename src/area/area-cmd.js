// ═════════════════════════ Clearway Area Control · your instructions ═════════════════════════
// Typed like the airport consoles: the callsign (or its digits) then one or more instructions.
//   C350 / D240 / FL300 climb, descend or maintain a flight level (a bare 350 works too)
//   H270, L270, R270 heading (turn left or right)        DCT SFD direct to a point     RES resume own navigation
//   M78 / M.78 Mach, S280 indicated speed, SN no speed restriction                   RC1000 at 1,000 ft a minute or less
//   HOLD SFD (L) hold at a point, left-hand with L      XFR transfer to the next unit  ACC accept an offered flight
//   ID identified (answer a check-in)                    UNABLE turn down a request    DIV EGKK divert
const CMD_HELP = 'C350 D240 · H270 L270 R270 · DCT SFD · RES · M78 S280 SN · HOLD SFD · XFR · ACC · ID · UNABLE · DIV EGKK';
function command(str){
  const toks = String(str).trim().toUpperCase().replace(/,/g, ' ').split(/\s+/).filter(Boolean);
  if (!toks.length) return;
  let ac = findAc(toks[0]);
  if (ac) toks.shift(); else ac = S.sel;
  if (ac && toks[0] === ac.cs) toks.shift();
  if (!ac || !S.acs.includes(ac)) { sys('Select a flight first, or start the command with its callsign.'); return; }
  S.sel = ac;
  if (toks.length === 1 && /^(ACC|ACCEPT|A)$/.test(toks[0])) { if (ac.st === 'OFFER') { acceptOffer(ac); emit('cmd', ac); } else sys(`${ac.cs} is not being offered to you.`); return; }
  if (ac.st === 'OFFER') {
    if (!ac.accepted) acceptOffer(ac);
    sys(`${ac.cs} is not on your frequency yet: ${UNIT_SHORT(ac.from)} transfers it about a minute before your boundary. You have accepted it.`); return;
  }
  if (ac.st === 'XFER') { sys(`${ac.cs} has been transferred to ${UNIT_SHORT(ac.owner)}.`); return; }
  if (!ac.mine) { sys(`${ac.cs} is not yours: it is with ${UNIT_SHORT(ac.owner)}${ac.live ? ' (live traffic)' : ''}.`); return; }
  if (ac.emg && ac.emg.kind === 'NORDO' && !ac.emg.back) { sys(`${ac.cs} is not answering: no reply on the frequency (squawk 7600).`, true); return; }
  const said = [], reads = [];
  let answered = false, xfer = false;
  identified(ac);
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]; let r;
    if ((r = t.match(/^(?:[CDA]|FL)(\d{2,3})$/)) || (r = t.match(/^(\d{3})$/))) {
      const lv = +r[1]*100, P = PERF[ac.fam];
      if (lv > P.ceil) { say(ac, `${spoken(ac.cs)}, unable ${spokenFL(lv, true)}, maximum ${spokenFL(P.ceil, true)}`); continue; }
      const up = lv > ac.alt + 50, same = Math.abs(lv - ac.alt) <= 50;
      ac.cfl = lv; ac.rate = null; ac.aiCap = null;
      const w = same ? 'maintain' : up ? 'climb' : 'descend';
      said.push(`${w} ${spokenFL(lv, true)}`); reads.push(`${w} ${spokenFL(lv, true)}`);
      if ((up && /^Request (FL|climb)/.test(ac.need || '')) || (!up && /^Request descent/.test(ac.need || '')) || (/^Turbulence/.test(ac.need || '') && Math.abs(lv - ac.turbLv) < 1100)) answered = true;
      if (!up && ac.reqs.des == null && arrivesHere(ac)) ac.reqs.des = S.t;
      if (ac.emg && ac.emg.kind === 'PRESS' && lv <= 10000) ac.emg.ok = true;
    } else if ((r = t.match(/^([HLR])(\d{1,3})$/))) {
      const h = (+r[2]) % 360 || 360; ac.mode = 'HDG'; ac.tgtHdg = h; ac.turnDir = r[1] === 'L' ? -1 : r[1] === 'R' ? 1 : 0; ac.hold = null; ac.holdAt = null; ac.hdgT = S.t;
      const dif = angDiff(ac.hdg, h), ts = r[1] === 'L' ? 'turn left' : r[1] === 'R' ? 'turn right' : Math.abs(dif) < 4 ? 'fly' : dif < 0 ? 'turn left' : 'turn right';
      said.push(`${ts} heading ${hdg3(h)}`); reads.push(`${ts.replace('fly', '').replace('turn ', '')} heading ${hdg3(h)}`.trim());
      if (/^Weather/.test(ac.need || '') && Math.abs(angDiff(h, ac.wxHdg)) < 25) answered = true;
    } else if (t === 'PH') { ac.mode = 'HDG'; ac.tgtHdg = Math.round(ac.hdg); ac.turnDir = 0; ac.hdgT = S.t; said.push('continue present heading'); reads.push(`present heading ${hdg3(ac.hdg)}`); }
    else if (t === 'DCT' || t === 'DIR') {
      const f = toks[++i]; if (!f || !(FIXP[f] || APS[f])) { sys(`No point called ${f || '…'}.`); continue; }
      directTo(ac, f); said.push(`proceed direct ${f}`); reads.push(`direct ${f}`);
      if (/^Request direct/.test(ac.need || '')) answered = true;
      if (/^Weather/.test(ac.need || '')) answered = true;
    } else if (t === 'RES' || t === 'OWN') {
      rejoin(ac); const p = nextPt(ac); said.push(`resume own navigation${p && p[2] ? ', direct ' + p[2] : ''}`); reads.push(`own navigation${p && p[2] ? ' direct ' + p[2] : ''}`);
    } else if ((r = t.match(/^M\.?(\d{2})$/))) {
      const m = +r[1]/100; ac.spd = { k: 'M', v: clamp(m, .6, PERF[ac.fam].mach + .04) }; said.push(`maintain Mach ${DIG[r[1][0]]} ${DIG[r[1][1]]}`); reads.push(`Mach decimal ${DIG[r[1][0]]} ${DIG[r[1][1]]}`);
    } else if ((r = t.match(/^S(\d{3})$/))) { const v = clamp(+r[1], 180, 340); ac.spd = { k: 'K', v }; said.push(`speed ${v} knots`); reads.push(`speed ${v}`); }
    else if (t === 'SN' || t === 'S0') { ac.spd = null; said.push('no speed restriction'); reads.push('no speed restriction'); }
    else if ((r = t.match(/^RC(\d{3,4})$/))) { ac.rate = +r[1]; said.push(`rate ${r[1]} feet per minute or less`); reads.push(`rate ${r[1]} or less`); }
    else if (t === 'HOLD') {
      let f = toks[i + 1] && FIXP[toks[i + 1]] ? toks[++i] : null, left = false;
      if (toks[i + 1] === 'L') { left = true; i++; }
      let efc = null; if (toks[i + 1] && /^EFC?(\d{2})$/.test(toks[i + 1])) efc = +toks[++i].replace(/\D/g, '');
      if (!f) { // present position
        ac.mode = 'HOLD'; ac.hold = { fix: null, c: [ac.la, ac.lo], inb: ac.trk, left, ph: 'turn1', t: 0, since: S.t, laps: 0 };
        said.push(`hold at present position, ${left ? 'left' : 'right'} hand, expect further clearance in one zero minutes`); reads.push('hold present position');
      } else {
        const onRoute = ac.route.findIndex((p, k) => k >= ac.ri && p[2] === f);
        const inb = onRoute > 0 ? crs(ac.route[onRoute - 1][0], ac.route[onRoute - 1][1], FIXP[f][0], FIXP[f][1]) : crs(ac.la, ac.lo, FIXP[f][0], FIXP[f][1]);
        if (onRoute < 0) directTo(ac, f); else if (ac.mode !== 'NAV') rejoin(ac);
        ac.holdAt = { fix: f, inb, left, efc };
        if (nm(ac.la, ac.lo, FIXP[f][0], FIXP[f][1]) < 2) startHold(ac, ac.holdAt);
        said.push(`hold at ${f}, inbound track ${hdg3(inb)}, ${left ? 'left' : 'right'} hand pattern, expect further clearance ${efc != null ? `at ${String(efc).padStart(2, '0')}` : 'in one five minutes'}`);
        reads.push(`hold ${f}, inbound ${hdg3(inb)}${left ? ' left hand' : ''}`);
      }
      S.stats.holds = (S.stats.holds || 0) + 1;
    } else if (t === 'XFR' || t === 'HO' || t === 'CONTACT' || t === 'FREQ') { xfer = true; }
    else if (t === 'ID' || t === 'ROGER' || t === 'RT' || t === 'IDENT') { if (ac.need === 'Check-in') clearNeed(ac); said.push(`${meName()} identified`); }
    else if (t === 'UNABLE' || t === 'NEG') { if (ac.need && ac.need !== 'Check-in') { said.push(`unable, ${ac.need.replace(/^Request /, '').toLowerCase()} not available`); reads.push('roger'); clearNeed(ac); } }
    else if (t === 'DIV') {
      const d = toks[++i]; if (!d || !APS[d]) { sys(`No airport called ${d || '…'}.`); continue; }
      divert(ac, d); said.push(`divert to ${apName(d)}, route direct`); reads.push(`diverting ${apName(d)}`);
      if (/^Request divert|^PAN|^MAYDAY|Divert/.test(ac.need || '')) answered = true;
    } else if (t === 'SQ' || t === 'SQK') { const c = toks[++i]; if (c && /^\d{4}$/.test(c)) { ac.sq = c; said.push(`squawk ${c.split('').map(x => DIG[x]).join(' ')}`); reads.push(`squawk ${c}`); } }
    else { sys(`Not understood: ${t}. Commands: ${CMD_HELP}`); }
  }
  if (answered) clearNeed(ac);
  if (said.length && ac.need === 'Check-in') clearNeed(ac);
  if (said.length) atc(ac, `${spoken(ac.cs)}, ${said.join(', ')}`, reads.length ? `${reads.join(', ')}, ${spoken(ac.cs)}` : null);
  if (xfer) transfer(ac);
  emit('cmd', ac);
}
// a diversion: straight to the airport, its level down to 3 to 1 from there
function divert(ac, d){
  const p = apLL(d); ac.arr = d; ac.diverted = true;
  const i = ac.ri; ac.route = [...ac.route.slice(0, i), [p[0], p[1], d]]; ac.ri = i; ac.mode = 'NAV'; ac.hold = null; ac.holdAt = null;
  const st = STARS[d]; if (st && st.length) { const s = st[0]; ac.holdFix = holdFixOf(s); }
  S.stats.div = (S.stats.div || 0) + 1; emit('divert', ac);
}
