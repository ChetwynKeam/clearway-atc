// ═════════════════════════ shifts in Live now ═════════════════════════
// A shift (shift.js, team.js) in a Live now session, adapted for real time and real flights:
// • the handover and the flow manager's figures count today's real flights still to come (the live board, refreshed
//   through the session), not a timetable
// • the weather is the live METAR: no forecast plan. The Met office describes the METAR and its trend (the TEMPO and
//   BECMG groups, NOSIG, and how it has changed since the last one), and each new live METAR is posted to the team chat
//   as it arrives
// • an arrival regulation leaves the real flights' times alone (live.js recognises each real aircraft as its flight by
//   its time on the board, so moving it would break the matching): the flow manager describes the plan instead
// • the session isn't paused: during the handover the outgoing controller (an AI colleague) keeps working your positions
//   until you take them, and a break is 30 real minutes with the colleague on your positions (or skip it, −15)
// • taxiway closures, a shortened runway, an ILS out of service and planned inspections come as in any shift
const isLiveShift = () => typeof SHIFT !== 'undefined' && SHIFT && SHIFT.live;
// ── the real flights still to come, from the live board
function liveDemand(from, to){
  const T = typeof LIVE !== 'undefined' && LIVE.session && LIVE.session.T; if (!T) return null;
  const now = nowMin(), lo = now + from, hi = now + to, inW = m => { for (const d of [0, 1440, -1440]) if (m + d >= lo && m + d < hi) return true; return false; };
  const landed = new Set(S.acs.filter(a => a.kind !== 'ARR' || a.ground).map(a => a.cs)), gone = new Set(S.acs.filter(a => a.kind === 'DEP' && a.airborne).map(a => a.cs));
  const arr = T.arr.filter(r => !r.cancelled && !r.done && !landed.has(r.cs) && inW(r.tm)).length;
  const dep = T.dep.filter(r => !r.cancelled && !r.done && !gone.has(r.cs) && inW(r.tm)).length;
  return { arr, dep };
}
// ── the Met office's reading of a METAR: its trend groups, and what has changed since the last one
const WXW = { RA: 'rain', SHRA: 'showers of rain', TSRA: 'thunderstorms with rain', TS: 'thunderstorms', DZ: 'drizzle', SN: 'snow', SHSN: 'snow showers', FG: 'fog', BR: 'mist', HZ: 'haze', BCFG: 'fog patches', MIFG: 'shallow fog', FZFG: 'freezing fog', SHGS: 'hail showers', GR: 'hail', RASN: 'rain and snow', FZRA: 'freezing rain', FZDZ: 'freezing drizzle' };
const CLW = { FEW: 'a few clouds', SCT: 'scattered cloud', BKN: 'broken cloud', OVC: 'overcast', VV: 'sky obscured, vertical visibility' };
function metWords(toks){
  const out = [];
  for (const t of toks) {
    let m;
    if ((m = t.match(/^(\d{3}|VRB)(\d{2,3})(G(\d{2,3}))?KT$/))) out.push(`wind ${m[1] === 'VRB' ? 'variable' : m[1] + '°'} ${+m[2]} kt${m[4] ? ' gusting ' + +m[4] : ''}`);
    else if ((m = t.match(/^(\d{4})$/))) out.push(+m[1] >= 9999 ? 'visibility 10 km or more' : `visibility ${(+m[1]).toLocaleString('en-GB')} m`);
    else if (t === 'CAVOK') out.push('CAVOK');
    else if (t === 'NSW') out.push('the weather clearing');
    else if (t === 'NSC') out.push('no significant cloud');
    else if ((m = t.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3})(CB|TCU)?$/))) out.push(`${CLW[m[1]]} at ${(+m[2]*100).toLocaleString('en-GB')} ft${m[3] === 'CB' ? ' (cumulonimbus)' : m[3] === 'TCU' ? ' (towering cumulus)' : ''}`);
    else if ((m = t.match(/^([+-])?(VC)?([A-Z]{2,6})$/)) && (WXW[m[3]] || WXW[m[3].slice(2)])) out.push(`${m[1] === '+' ? 'heavy ' : m[1] === '-' ? 'light ' : ''}${WXW[m[3]] || WXW[m[3].slice(2)]}${m[2] ? ' nearby' : ''}`);
    else if ((m = t.match(/^(FM|TL|AT)(\d{4})$/))) out.push(`${{ FM: 'from', TL: 'until', AT: 'at' }[m[1]]} ${m[2].slice(0, 2)}:${m[2].slice(2)}Z`);
  }
  return out.join(', ');
}
function metTrend(raw){
  const s = String(raw || '').replace(/=$/, '');
  if (/\bNOSIG\b/.test(s)) return 'No significant change expected in the next two hours (NOSIG).';
  const parts = s.split(/\b(?=TEMPO\b|BECMG\b)/).slice(1).map(p => { const t = p.trim().split(/\s+/), k = t.shift(); const w = metWords(t); return w ? `${k === 'TEMPO' ? 'temporarily' : 'becoming'} ${w}` : ''; }).filter(Boolean);
  return parts.length ? `Trend for the next two hours: ${parts.join('; ')}.` : 'No trend given with this report.';
}
function metChange(w, p){
  if (!p) return '';
  const ch = [], d = w.vrb || p.vrb ? 0 : Math.abs(angDiff(p.dir, w.dir));
  if (d >= 30) ch.push(`the wind has ${angDiff(p.dir, w.dir) > 0 ? 'veered' : 'backed'} ${Math.round(d/10)*10}°`);
  if (Math.abs((w.spd || 0) - (p.spd || 0)) >= 5) ch.push(`${w.spd > p.spd ? 'picked up' : 'eased'} to ${w.spd} kt`);
  if ((w.gust || 0) && !(p.gust || 0)) ch.push(`gusts to ${w.gust} kt`);
  if (Math.abs(w.vis - p.vis) >= Math.max(500, 0.3*Math.min(w.vis, p.vis)) && Math.min(w.vis, p.vis) < 9999) ch.push(`visibility ${w.vis < p.vis ? 'down' : 'up'} to ${w.vis >= 9999 ? '10 km+' : w.vis.toLocaleString('en-GB') + ' m'}`);
  const ceil = x => x.ceil ?? 99999;
  if (ceil(w) < 1500 && Math.abs(ceil(w) - ceil(p)) >= 200) ch.push(`cloud base ${ceil(w) < ceil(p) ? 'lowering' : 'lifting'}, now ${ceil(w)} ft`);
  if (Math.abs(w.qnh - p.qnh) >= 2) ch.push(`QNH ${w.qnh > p.qnh ? 'up' : 'down'} to ${w.qnh}`);
  return ch.length ? `Since the last one: ${ch.join(', ')}.` : 'Little change since the last one.';
}
function metDescribe(w, prev){ return `Live METAR ${w.raw.replace(/\s+(NOSIG|TEMPO|BECMG)\b.*$/, '')}: ${metWords(w.raw.replace(/\s+(NOSIG|TEMPO|BECMG)\b.*$/, '').split(/\s+/).slice(2)) || 'as reported'}. ${metTrend(w.raw)} ${metChange(w, prev)}`.trim(); }
// a new live METAR during a Live now shift: the Met office posts it, with its trend
if (typeof applyLiveMetar === 'function') { const _a = applyLiveMetar; applyLiveMetar = function(raw){
  const prev = S.wx && S.running ? { ...S.wx } : null; _a(raw);
  if (!isLiveShift() || !S.running) return;
  SHIFT.trend = `${metTrend(S.wx.raw)} It's the live weather: there is no forecast plan in Live now.`;
  if (typeof teamSay === 'function' && TEAM.people) teamSay('MET', `New METAR in: ${metDescribe(S.wx, prev)}`);
}; }

// ── the handover in real time: the outgoing controller keeps your positions until you take them
function liveHandoverSeats(){
  const mine = AI_SEATS.filter(k => S.seats[k] !== 'AI'); SHIFT.hoSeats = mine;
  for (const k of mine) shiftSeat(k, 'AI');
  if (mine.length) sys(`Live now doesn't stop: the outgoing controller keeps working ${mine.map(k => AI_NAME[k]).join(', ')} until you take the position.`);
}
function shiftTaken(){
  if (!SHIFT || !SHIFT.hoSeats) return;
  for (const k of SHIFT.hoSeats) shiftSeat(k, 'ME');
  SHIFT.hoSeats = null; SHIFT.onT = S.t;
}

// ── breaks in real time: 30 real minutes with a colleague on your positions, or skipped (−15)
const BRK_SKIP = 15;
function liveBreakTake(box){
  const mine = AI_SEATS.filter(k => S.seats[k] !== 'AI');
  SHIFT.liveBrk = { end: S.t + BRK_LEN, mine, before: { rwy: S.rwy, dep: typeof depRw === 'function' ? depRw() : S.rwy, wx: S.wx.raw, lvp: !!S.lvpOn, land: S.aiScore.landed, dept: S.aiScore.departed, los: S.aiScore.los, ga: S.aiScore.ga } };
  SHIFT.onBreak = true; for (const k of mine) shiftSeat(k, 'AI');
  if (typeof teamSay === 'function' && TEAM.people) teamSay('REL', `I have the position. Enjoy your break, see you at ${hmZ(SHIFT.liveBrk.end)}.`, true);
  box && box.remove(); liveBreakBar();
}
function liveBreakSkip(box){
  S.score.pts -= BRK_SKIP; SHIFT.onT = S.t; SHIFT.putOff = 0; SHIFT.brkWarn = SHIFT.brkAsk = SHIFT.overT = false;
  supSay(`Break skipped (−${BRK_SKIP}). That's not good for you: you're due another one in two hours.`);
  box && box.remove();
}
function liveBreakBar(){
  document.getElementById('lbrk')?.remove();
  const B = SHIFT && SHIFT.liveBrk; if (!B) return;
  const d = document.createElement('div'); d.id = 'lbrk'; d.className = 'lbrk';
  d.innerHTML = `<b>On your break</b><span class="lbrk-t"></span><button type="button" class="btn ghost" data-lb="back">Come back now (−5)</button>`;
  document.body.appendChild(d);
  d.querySelector('[data-lb="back"]').onclick = () => { S.score.pts -= 5; supSay('Back early (−5): take your full break next time.'); liveBreakEnd(); };
  liveBreakTick();
}
function liveBreakTick(){ const B = SHIFT && SHIFT.liveBrk, t = document.querySelector('#lbrk .lbrk-t'); if (B && t) { const s = Math.max(0, Math.round(B.end - S.t)); t.textContent = `${TEAM.people ? TEAM.people.REL : 'A colleague'} has your positions · back at ${hmZ(B.end)} (${Math.floor(s/60)}:${String(s % 60).padStart(2, '0')})`; } }
function liveBreakEnd(){
  const B = SHIFT && SHIFT.liveBrk; if (!B) return;
  SHIFT.liveBrk = null; document.getElementById('lbrk')?.remove();
  for (const k of B.mine) shiftSeat(k, 'ME');
  SHIFT.onBreak = false; SHIFT.onT = S.t; SHIFT.putOff = 0; SHIFT.brkWarn = SHIFT.brkAsk = SHIFT.overT = false;
  const b = B.before, ch = [];
  ch.push(`${S.aiScore.landed - b.land} landed and ${S.aiScore.departed - b.dept} departed while you were away${S.aiScore.ga > b.ga ? `, ${S.aiScore.ga - b.ga} go-around${S.aiScore.ga - b.ga > 1 ? 's' : ''}` : ''}${S.aiScore.los > b.los ? `, ${S.aiScore.los - b.los} loss${S.aiScore.los - b.los > 1 ? 'es' : ''} of separation` : ''}.`);
  if (S.rwy !== b.rwy || (typeof depRw === 'function' && depRw() !== b.dep)) ch.push(`Runways changed: now landing ${S.rwy}${typeof depRw === 'function' && depRw() !== S.rwy ? ', departing ' + depRw() : ''}.`);
  if (S.wx.raw !== b.wx) ch.push(`New weather, information ${phonetic(S.atis)}: ${S.wx.raw}.`);
  if (!!S.lvpOn !== b.lvp) ch.push(S.lvpOn ? 'Low visibility procedures are now in force.' : 'Low visibility procedures have been cancelled.');
  if (typeof teamSay === 'function' && TEAM.people) teamSay('REL', `Welcome back. ${ch.join(' ')}`, true);
  shiftModalBack(ch);
}

// ── the area's "ten miles in trail" for two real flights: their times on the board stay as they are (they are how the
// real aircraft are recognised); once both are real tracks heading for the boundary, the second is brought to it later
function cbTrail(){
  for (const f of S.sched) {
    if (!f.trail) continue;
    const b = S.acs.find(a => a.cs === f.cs), a = S.acs.find(x => x.cs === f.trail);
    if (!b || b.state !== 'PRE') { if (b && b.state !== 'PRE') f.trail = null; continue; }
    if (!a) continue;
    if (a.state === 'PRE' && b.preAt < a.preAt + 150) b.preAt = a.preAt + 150;
    else if (a.state !== 'PRE' && b.preAt < S.t + 60 && dist(a.x, a.y, b.x, b.y) < 10) b.preAt = S.t + 90;
  }
}
S.listeners.push(ev => { if (ev === 'start') document.getElementById('lbrk')?.remove(); });
window.__lsh = { liveDemand, metDescribe, metTrend, liveBreakEnd, liveBreakTake, liveBreakSkip };
