// ═════════════════════════ the team: handover chat, strategy, and the day's disruptions ═════════════════════════
// A shift (shift.js) starts with a handover in the team chat: the controller you relieve tells you how it is going,
// Airfield Ops and Engineering tell you what is broken or closed today, the flow manager (FMP) gives the demand
// against capacity, and the supervisor asks how you want to play it. The answers change the shift:
// • an arrival regulation (the FMP spaces the inbounds to the capacity, so fewer hold)
// • LVP declared early, the runway changed for you when the front comes through, arrivals briefed on gusty showers
// • a position split off from the start, works finished early (if Ops can), the ILS fixed sooner (if Engineering can)
// The chat stays open through the shift (menu › Team chat): the team posts updates, and you can write to it.
//
// Each shift also starts with one or two of the day's problems, picked at random:
// • a taxiway closed for resurfacing (never one that cuts a stand off from a runway, nor a runway entry or exit)
// • a runway shortened by works at one end: reduced take-off run and landing distance, too short for the heavies
// • an ILS out of service: no approach on that runway below 1,500 m or a 400 ft cloud base, and no CAT II/III
// • a runway inspection planned for later in the shift
const TEAM = { msgs: [], unread: 0, ask: [], strat: {}, people: null, open: false };
let WORKS = null;
const NAMES = ['Aoife', 'Ciarán', 'Sam', 'Priya', 'Tom', 'Niamh', 'Raj', 'Hannah', 'Mark', 'Gráinne', 'Jess', 'Dev', 'Fiona', 'Ollie', 'Maya', 'Conor'];
const ROLE = { OUT: 'outgoing controller', SUP: 'Supervisor', FMP: 'Flow (FMP)', OPS: 'Airfield Ops', ENG: 'Engineering', MET: 'Met office', REL: 'your relief' };
const who = k => `${TEAM.people[k]} · ${ROLE[k]}`;

// ── the day's problems
function bfsReach(from){
  const seen = new Set([from]), q = [from];
  while (q.length) { const u = q.pop(); for (const [v, e] of GN[u].adj) { if (e.closed || seen.has(v) || (v[0] === 'R' && !GN[v].p.hs)) continue; seen.add(v); q.push(v); } }
  return seen;
}
function pickTaxiway(){
  if (typeof HOLDS === 'undefined' || typeof GE === 'undefined' || !Object.keys(HOLDS).length) return null;
  const holdNodes = new Set(Object.values(HOLDS).map(h => h.node)), by = {};
  for (const e of GE) { if (!e.tw || e.tw === 'APRON' || /lane|stand|apron/i.test(e.tw)) continue; (by[e.tw] ||= []).push(e); }
  const start = Object.values(HOLDS)[0] && Object.values(HOLDS)[0].node; if (!start || !GN[start]) return null;
  const targets = [...new Set([...STANDS.map(s => s.node), ...holdNodes])].filter(n => n && GN[n]);
  const base = bfsReach(start), need = targets.filter(n => base.has(n));
  const names = Object.keys(by).sort(() => Math.random() - 0.5);
  for (const tw of names) {
    const es = by[tw], len = es.reduce((s, e) => s + e.len, 0)*1852;
    if (len < 200 || len > 1400 || es.some(e => e.closed || holdNodes.has(e.a) || holdNodes.has(e.b) || GN[e.a].p.hs || GN[e.b].p.hs)) continue;
    if (Object.values(HOLDS).some(h => h.tw === tw || h.ref === tw)) continue;
    for (const e of es) e.closed = true;
    TAXI_MEMO.clear();
    const now = bfsReach(start), ok = need.every(n => now.has(n));
    if (ok) return { tw, edges: es, len: Math.round(len/10)*10 };
    for (const e of es) e.closed = false; TAXI_MEMO.clear();
  }
  return null;
}
function worksInit(len){
  WORKS = { list: [] };
  const T = m => S.t + m*60, until = () => Math.random() < 0.5 ? null : T(Math.round(rnd(35, Math.max(40, len - 20))/5)*5);
  const why = ['resurfacing', 'lighting repairs', 'drainage works', 'a broken centreline light', 'markings being repainted'];
  const pool = [];
  pool.push(['twy', 0.6]); pool.push(['insp', 0.35]); pool.push(['ils', 0.25]);
  const longest = RWYS.filter(R => R.len && R.rm).reduce((a, R) => (R.len || 0) > (a.len || 0) ? R : a, RWYS[0]);
  if (RWYS.length > 1 && longest && (longest.len || 0) >= 2700) pool.push(['short', 0.35]);   // (a second runway to send the heavies to)
  const picks = pool.filter(([, p]) => Math.random() < p).map(([k]) => k).sort(() => Math.random() - 0.5).slice(0, 2);
  if (!picks.length) picks.push(Math.random() < 0.6 ? 'twy' : 'insp');
  for (const k of picks) {
    if (k === 'twy') { const t = pickTaxiway(); if (t) WORKS.list.push({ k, ...t, why: why[Math.floor(Math.random()*why.length)], until: until() }); }
    else if (k === 'short') {
      // what is left is enough for the narrowbodies (1,800 m to take off, 1,500 to land), not for the heavies
      const R = longest, avail = Math.round(rnd(1850, 2050)/50)*50, cut = Math.round((R.len - avail)/10)*10;
      // the works are at the far end for the flow in use, so arrivals touch down and depart from the open part
      const ld = typeof landRw === 'function' ? S.rwy : R.lo, atHi = rwyOf(ld) === R ? ld === R.lo : Math.random() < 0.5;
      WORKS.list.push({ k, rid: R.id, R, cut, end: atHi ? R.hi : R.lo, avail, why: 'works at the end of the runway', until: until() });
    }
    else if (k === 'ils') { const ends = RW_ENDS.filter(e => FINAL[e] && !FINAL[e].rnp), rw = ends.includes(S.rwy) && Math.random() < 0.7 ? S.rwy : ends[Math.floor(Math.random()*ends.length)]; if (rw) WORKS.list.push({ k, rw, why: 'a localiser fault', until: until() }); }
    else if (k === 'insp') { const at = T(Math.round(rnd(25, Math.max(30, len*0.6))/5)*5), rw = S.rwy; WORKS.list.push({ k, at, rw, mins: Math.round(rnd(8, 14)), why: 'a planned runway inspection' }); }
  }
}
const works = k => WORKS ? WORKS.list.filter(w => w.k === k && !w.done) : [];
// the take-off run and landing distance each wake category needs (m)
const NEED_TO = { J: 3000, H: 2800, M: 1800, L: 1000 }, NEED_LD = { J: 2300, H: 2100, M: 1500, L: 900 };
function worksLimit(ac, F, rw){
  if (!WORKS) return null;
  for (const w of works('short')) if (rwyOf(rw).id === w.rid && w.avail < (NEED_LD[ac.perf.wake] || 1500)) return `the landing distance available is too short for us with the works, ${w.avail.toLocaleString('en-GB')} metres`;
  for (const w of works('ils')) if (w.rw === rw && !(F && F.rnp) && (S.wx.vis < 1500 || S.wx.ceil < 400)) return `the ILS ${rw} is out of service and the weather is below the non-precision minima`;
  return null;
}
function worksToLimit(ac){
  if (!WORKS) return null; const rw = depRw(ac);
  for (const w of works('short')) if (rwyOf(rw).id === w.rid && w.avail < (NEED_TO[ac.perf.wake] || 1800)) return `the take-off run available is too short for us, ${w.avail.toLocaleString('en-GB')} metres`;
  return null;
}
// what the ATIS panel says
function worksPanel(){
  if (!WORKS) return '';
  const L = [];
  for (const w of WORKS.list) { if (w.done) continue;
    const till = w.until ? ` until ${hmZ(w.until)}` : '';
    if (w.k === 'twy') L.push(`Taxiway ${w.tw} closed (${w.why})${till}`);
    if (w.k === 'short') L.push(`Runway ${w.R.lo}/${w.R.hi}: ${w.cut} m closed at the ${w.end} end${till}; ${w.avail} m available, too short for heavy aircraft`);
    if (w.k === 'ils') L.push(`ILS ${w.rw} out of service${till}`);
    if (w.k === 'insp' && w.at > S.t) L.push(`Runway ${w.rw} inspection planned at ${hmZ(w.at)}, about ${w.mins} min`);
  }
  return L.map(l => `<div class="warnline">${esc(l)}</div>`).join('');
}
function worksEnd(w, early){
  w.done = true;
  if (w.k === 'twy') { for (const e of w.edges) e.closed = false; TAXI_MEMO.clear(); teamSay('OPS', `Taxiway ${w.tw} is open again${early ? ', we finished early' : ''}.`); }
  if (w.k === 'short') teamSay('OPS', `Works finished: runway ${w.R.lo}/${w.R.hi} full length available again, ${w.R.len} metres.`);
  if (w.k === 'ils') teamSay('ENG', `ILS ${w.rw} is back in service${early ? ', fixed early' : ''}.`);
  nextAtis(true); if (typeof renderAtis === 'function') renderAtis();
}
// the closed taxiway (red crosses) and the closed end of a shortened runway, on the ground picture
function drawWorks(){
  if (!WORKS || !S.running || V.scale < 40) return;
  cx.save(); cx.strokeStyle = 'rgba(230,40,40,.95)'; cx.lineWidth = 2;
  const X = (p, s) => { const x = sx(p[0]), y = sy(p[1]); cx.beginPath(); cx.moveTo(x - s, y - s); cx.lineTo(x + s, y + s); cx.moveTo(x + s, y - s); cx.lineTo(x - s, y + s); cx.stroke(); };
  for (const w of WORKS.list) { if (w.done) continue;
    if (w.k === 'twy') for (const e of w.edges) { const a = GN[e.a].p, b = GN[e.b].p, n = Math.max(1, Math.round(e.len*1852/60)); for (let i = 0; i <= n; i++) X([a[0] + (b[0] - a[0])*i/n, a[1] + (b[1] - a[1])*i/n], 4); }
    if (w.k === 'short') { const R = w.R, from = w.end === R.hi ? R.len - w.cut : 0, to = w.end === R.hi ? R.len : w.cut; for (let m = from + 40; m < to; m += 120) X(R.rm(m, 0), 9); }
  }
  cx.restore();
}

// ── the chat
function teamSay(k, text, quiet){
  if (!TEAM.people) return;
  const m = { k, who: k === 'ME' ? 'You' : who(k), text, t: S.t }; TEAM.msgs.push(m);
  if (!quiet && k !== 'ME') log('coord', text, k === 'ME' ? 'YOU' : `${TEAM.people[k]} (${ROLE[k]})`);
  if (!TEAM.open && k !== 'ME') { TEAM.unread++; teamBadge(); }
  teamRenderMsgs();
}
function teamBadge(){ const b = document.getElementById('tgTeam'); if (b) b.textContent = TEAM.unread ? `Team chat (${TEAM.unread})` : 'Team chat'; }
function teamRenderMsgs(){
  const el = document.querySelector('#teamchat .tc-msgs'); if (!el) return;
  el.innerHTML = '';
  for (const m of TEAM.msgs) { const d = document.createElement('div'); d.className = 'tc-m' + (m.k === 'ME' ? ' me' : ''); d.innerHTML = '<b></b><span></span>'; d.querySelector('b').textContent = m.who; d.querySelector('span').textContent = m.text; el.appendChild(d); }
  el.scrollTop = el.scrollHeight;
  const ch = document.querySelector('#teamchat .tc-chips'); if (!ch) return;
  ch.innerHTML = '';
  const q = TEAM.ask[0]; if (!q) return;
  for (const o of q.opts) { const b = document.createElement('button'); b.type = 'button'; b.className = 'tc-chip'; b.textContent = o.label; b.onclick = () => teamAnswer(q, o); ch.appendChild(b); }
}
// the team writes one message after another, as people typing
let teamQ = Promise.resolve();
function teamLater(k, text, gap){ teamQ = teamQ.then(() => new Promise(res => setTimeout(() => { teamSay(k, text, true); res(); }, gap ?? Math.min(1100, 350 + text.length*6)))); return teamQ; }
function teamAsk(q){ teamQ = teamQ.then(() => { TEAM.ask.push(q); if (TEAM.ask.length === 1) teamLater('SUP', q.text, 400); }); }
function teamAnswer(q, o){
  if (TEAM.ask[0] !== q) return;
  TEAM.ask.shift(); teamSay('ME', o.label, true);
  try { o.do && o.do(); } catch (e) {}
  if (o.reply) teamLater(o.by || 'SUP', o.reply, 500);
  if (TEAM.ask[0]) teamLater('SUP', TEAM.ask[0].text, 600);
  else teamQ.then(() => { if (TEAM.started) return; TEAM.started = true; teamLater('OUT', 'That\'s everything from me. Ready to take it?', 500); });
  teamRenderMsgs();
}
// typed into the chat: matched to the question being asked, or to a few things anyone might say
function teamTyped(text){
  const t = text.trim(); if (!t) return;
  const q = TEAM.ask[0], low = t.toLowerCase();
  if (q) { const o = q.opts.find(o => (o.keys || []).some(k => low.includes(k))); if (o) { teamSay('ME', t, true); TEAM.ask.shift(); try { o.do && o.do(); } catch (e) {} if (o.reply) teamLater(o.by || 'SUP', o.reply, 500); if (TEAM.ask[0]) teamLater('SUP', TEAM.ask[0].text, 600); else if (!TEAM.started) { TEAM.started = true; teamLater('OUT', 'That\'s everything from me. Ready to take it?', 500); } teamRenderMsgs(); return; } }
  teamSay('ME', t, true);
  // every topic the message asks about gets an answer from whoever knows (several topics, several answers)
  const ans = teamAnswers(low);
  for (const [k, txt] of ans) teamLater(k, txt);
  if (ans.length) return;
  if (q) teamLater('SUP', `Sorry, which is it? ${q.opts.map(o => o.label).join(', or ')}?`);
  else if (/\b(thank|thanks|cheers|ta)\b/.test(low) && !/\?/.test(t)) teamLater(TEAM.started && !SHIFT.done ? 'OUT' : 'SUP', TEAM.started ? 'No bother, have a good one.' : 'No problem.');
  else if (/\?|\b(any|what|how|is|are|do|does|will|can)\b/.test(low)) teamLater('SUP', 'Nothing I know of. Ask me about holds, flow and Area, weather, runways, works, traffic, staffing or your break.');
  else teamLater('SUP', 'Noted.');
}

// the answers to what you ask the team, by topic
function teamAnswers(low){
  const out = [], has = re => re.test(low);
  if (has(/hold|stack|delay|queue/)) {
    const H = S.acs.filter(a => a.kind === 'ARR' && a.airborne && a.mode === 'HOLD' && !outOfCtl(a));
    const fx = [...new Set(H.map(a => a.hold && a.hold.name).filter(Boolean))], long = H.reduce((m, a) => Math.max(m, a.holdNow || 0), 0);
    const h = demandIn(-2, 60), cap = capHour();
    out.push(['FMP', `${H.length ? `${H.length} holding now${fx.length ? ` (${fx.join(', ')})` : ''}, the longest ${Math.round(long/60)} min.` : 'Nobody holding at the moment.'} Next hour ${h.arr} inbound against about ${cap}: ${h.arr > cap ? `expect holding at the peak, around ${Math.round((h.arr - cap)*60/cap)} min.` : 'it should fit without much holding.'}${TEAM.strat.reg ? ` The regulation is in at ${TEAM.strat.reg} an hour.` : ''}`]);
  }
  if (has(/flow|regulat|area|control|centre|center|release|stop/)) {
    const F = S.flow && S.flow.stop, rel = S.acs.filter(a => a.rel && a.rel.st === 'REQ').length;
    out.push(['FMP', `${F ? `${F.who} has departures stopped${F.until ? ' until ' + hmZ(F.until) : ''}: ${F.why}.` : 'No departure stops from Area at the moment.'}${S.flow && S.flow.rate ? ` They've said they may stop departures now and then this shift.` : ''}${rel ? ` ${rel} release${rel > 1 ? 's' : ''} waiting on Area.` : ''}${TEAM.strat.reg ? ` Arrivals regulated to ${TEAM.strat.reg} an hour.` : ' No arrival regulation.'}`]);
  }
  if (has(/weather|fog|wind|front|shower|forecast|vis|rvr|cloud|metar/)) out.push(['MET', `Now ${S.wx.raw}.${S.rvr ? ` RVR ${S.rvr.tdz} m.` : ''} ${SHIFT && SHIFT.trend ? 'For the shift: ' + SHIFT.trend : 'No significant change expected.'}`]);
  if (has(/traffic|demand|busy|flights|how many|movements|peak/)) out.push(['FMP', demandLine()]);
  if (has(/taxiway|works|closed|ils|inspection|runway|airfield/)) out.push(['OPS', WORKS && WORKS.list.some(w => !w.done) ? WORKS.list.filter(w => !w.done).map(worksLine).join(' ') : `Nothing closed on the airfield. ${typeof depRw === 'function' && depRw() !== S.rwy ? `Landing ${S.rwy}, departing ${depRw()}.` : `Runway ${S.rwy} in use.`}`]);
  if (has(/lvp|low vis/)) out.push(['SUP', S.lvpOn ? 'Low visibility procedures are in force.' : typeof lvpPrep === 'function' && lvpPrep() ? 'Not yet, but the visibility is coming down: be ready to declare them.' : 'No need for LVP at the moment.']);
  if (has(/staff|split|band|ground|colleague|help/)) { const ai = AI_SEATS.filter(k => S.seats[k] === 'AI'); out.push(['SUP', `${ai.length ? `${ai.map(k => AI_NAME[k]).join(', ')} ${ai.length > 1 ? 'are' : 'is'} with a colleague.` : 'You have every position.'} I'll split one off if it gets busy, and band-box it back when it quietens.`]); }
  if (has(/break|relief|rest/)) out.push(['SUP', SHIFT && SHIFT.onT != null && SHIFT.end - S.t > 1200 && SHIFT.end - (SHIFT.onT + 7200) > 1200 ? `Your break is due at ${hmZ(SHIFT.onT + 7200 + (SHIFT.putOff || 0)*600)}.` : `No break this shift: your relief takes over at ${SHIFT ? hmZ(SHIFT.end) : 'the end'}.`]);
  if (has(/emergenc|mayday|pan\b/)) { const em = S.acs.filter(a => a.emerg && !a.emerg.done && !outOfCtl(a)); out.push(['SUP', em.length ? em.map(a => `${a.cs}: ${a.emerg.k}, ${a.emerg.why}`).join('; ') + '.' : 'No emergencies going on.']); }
  return out;
}

// ── what the team says
// landings an hour the airport declares in good weather (its single landing runway, or the pair it lands on)
const ARR_CAP = { EGLL: 44, EGKK: 30, EIDW: 32, EGCC: 34, EGAA: 20, EGGD: 20, KJFK: 40, OMDB: 40, YSSY: 44, LEMD: 48, LSGG: 28, EGLC: 18, LXGB: 10, LPMA: 12, LOWI: 12 };
const capHour = () => { let c = ARR_CAP[APT.icao] || 28; if (S.lvpOn || (typeof lvpNeeded === 'function' && lvpNeeded())) c = Math.round(c*0.6); else if (S.wx.gust >= 25 || S.wx.cb) c = Math.round(c*0.85); return c; };
// flights due in the window (minutes from now): arrivals still to come (not yet on the scope, or in the air by their
// estimate) and departures by their off-blocks time (parked ones by when they will ask to start, and any still to appear)
function demandIn(from, to){
  if (/^live/.test(S.mode) && typeof liveDemand === 'function') { const L = liveDemand(from, to); if (L) return L; }   // Live now: today's real flights still to come (liveshift.js)
  const t0 = S.t + from*60, t1 = S.t + to*60, inW = t => t >= t0 && t < t1;
  let arr = S.sched.filter(f => f.k === 'ARR' && !f.spawned && inW(f.m*60)).length;
  for (const ac of S.acs) if (ac.kind === 'ARR' && ac.airborne && !outOfCtl(ac) && ac.state !== 'DIVERTING') { let e = 600; try { if (typeof eta === 'function') e = eta(ac); } catch (_) {} if (inW(S.t + (isFinite(e) ? e : 600))) arr++; }
  let dep = S.sched.filter(f => f.k !== 'ARR' && f.k !== 'RES' && !f.spawned && inW(f.m*60)).length;
  for (const ac of S.acs) if (ac.kind === 'DEP' && !ac.airborne && !outOfCtl(ac)) { const t = ac.state === 'PARKED' && ac.reqAt != null ? ac.reqAt : S.t; if (inW(t)) dep++; }
  return { arr, dep };
}
function demandLine(){
  const h = demandIn(-2, 60), q = [0, 15, 30, 45].map(m => demandIn(m, m + 15).arr), pk = q.indexOf(Math.max(...q));
  return `Next hour: ${h.arr} arrivals and ${h.dep} departures. Busiest between ${hmZ(S.t + pk*900)} and ${hmZ(S.t + pk*900 + 900)} with ${q[pk]} inbound. Landing capacity in this weather is about ${capHour()} an hour.`;
}
function worksLine(w){
  const till = w.until ? `until about ${hmZ(w.until)}` : 'for the whole shift';
  if (w.k === 'twy') return `Taxiway ${w.tw} is closed for ${w.why}, ${till}: the routes go round it.`;
  if (w.k === 'short') return `Runway ${w.R.lo}/${w.R.hi} has ${w.cut} metres closed at the ${w.end} end for works, ${till}. ${w.avail} metres available: fine for the narrowbodies, but the heavies can't land or take off on it.`;
  if (w.k === 'ils') return `The ILS on ${w.rw} is out of service with ${w.why}, ${till}. RNP and visual approaches only: no use below 1,500 metres or a 400 ft cloud base.`;
  if (w.k === 'insp') return `We have a runway inspection planned on ${w.rw} at ${hmZ(w.at)}, about ${w.mins} minutes with the runway closed.`;
  return '';
}
function regulate(rate){
  // the FMP spaces the inbounds still to come over the next two hours so no more than the capacity arrive in an hour
  // (Live now: the real flights keep their times, which is how live.js knows each real aircraft as its flight; the plan
  // is worked out and described, not applied)
  const live = /^live/.test(S.mode), gap = 60/rate, list = S.sched.filter(f => f.k === 'ARR' && !f.spawned && !f.hold && f.m*60 >= S.t && f.m*60 < S.t + 7200).sort((a, b) => a.m - b.m);
  let last = S.t/60 + 6, n = 0, max = 0;
  for (const f of list) { const want = Math.max(f.m, last + gap); if (want > f.m + 0.5) { max = Math.max(max, want - f.m); n++; if (!live) f.m = want; } last = live ? Math.max(f.m, want) : f.m; }
  TEAM.strat.reg = rate;
  return { n, max: Math.round(max), live };
}
function teamScript(){
  const o = TEAM.people, mine = AI_SEATS.filter(k => S.seats[k] !== 'AI');
  const dep0 = typeof depRw === 'function' ? depRw() : S.rwy, air = S.acs.filter(a => a.airborne && a.state !== 'PRE').length;
  teamLater('OUT', `Hi, ${o.OUT} here, I'll hand over to you. ${dep0 === S.rwy ? `Runway ${S.rwy} for everything` : `Landing ${S.rwy}, departing ${dep0}`}. ${air ? `${air} airborne at the moment` : 'Nothing much on frequency right now'}.`, 300);
  teamLater('OUT', `Information ${phonetic(S.atis)}: ${S.wx.raw}.${S.rvr ? ` RVR ${S.rvr.tdz} m.` : ''}`);
  if (SHIFT && SHIFT.trend) teamLater('MET', `For your shift: ${SHIFT.trend}`);
  for (const w of WORKS.list) teamLater(w.k === 'ils' ? 'ENG' : 'OPS', worksLine(w));
  teamLater('FMP', demandLine());
  // the questions
  const h = demandIn(-2, 60), cap = capHour();
  if (h.arr > cap*0.85) teamAsk({ text: `That's ${h.arr} inbound against about ${cap} an hour. Do you want the FMP to put a regulation on the arrivals?`, opts: [
    { label: `Yes, regulate to ${cap} an hour`, keys: ['yes', 'regulat', 'cap'], do: () => { const r = regulate(cap); TEAM.regMsg = r; }, by: 'FMP', get reply(){ const r = TEAM.regMsg || { n: 0, max: 0 }; return r.live ? `I've asked for ${cap} an hour: it would hold ${r.n} inbound${r.n === 1 ? '' : 's'} at origin, the longest by about ${r.max} min. These are today's real flights, so they still turn up when they really do: treat it as the plan and expect holding at the peak until it bites.` : `Regulation in at ${cap} an hour: ${r.n} inbound${r.n === 1 ? '' : 's'} delayed on the ground at origin, the longest by ${r.max} min.`; } },
    { label: 'No, we\'ll hold them', keys: ['no', 'hold'], reply: 'OK. The stacks will fill at the peak: keep an eye on the holding times.' }] });
  const tr = (SHIFT && SHIFT.trend) || '';
  if (/fog|mist/i.test(tr) || (typeof lvpPrep === 'function' && lvpPrep() && !S.lvpOn)) teamAsk({ text: 'With the fog about: do you want LVP declared early, as soon as the RVR is under 1,500 metres, so the gaps are set before it gets thick?', opts: [
    { label: 'Yes, declare early', keys: ['yes', 'early', 'lvp'], do: () => { TEAM.strat.lvpEarly = true; }, reply: 'Will do: I\'ll declare it for you when the RVR drops under 1,500.' },
    { label: 'No, when it\'s needed', keys: ['no', 'need', 'wait'], reply: 'OK, your call. It\'s needed below 600 metres.' }] });
  if (/front/i.test(tr)) teamAsk({ text: 'The front brings a big wind shift. Do you want me to change the runway when it comes through?', opts: [
    { label: 'Yes, change it for me', keys: ['yes', 'change', 'you'], do: () => { TEAM.strat.autoRwy = true; }, reply: 'Will do. I\'ll tell you before I change it.' },
    { label: 'No, I\'ll call it', keys: ['no', 'i\'ll', 'myself'], reply: 'Fine. Watch the tailwind when it veers.' }] });
  if (/shower|thunder/i.test(tr)) teamAsk({ text: 'Showers with gusts: shall we have Approach brief every arrival on the gusts, so they add speed?', opts: [
    { label: 'Yes, brief them all', keys: ['yes', 'brief'], do: () => { TEAM.strat.gustBrief = true; }, reply: 'Done: arrivals will be told on first contact while the showers are about.' },
    { label: 'No need', keys: ['no'], reply: 'OK.' }] });
  for (const w of works('short')) teamAsk({ text: `The heavies can't use ${w.R.lo}/${w.R.hi} while the works are on. Do you want Ops to try to finish early?`, opts: [
    { label: 'Ask Ops to finish early', keys: ['yes', 'early', 'finish', 'ops'], by: 'OPS', do: () => { TEAM.opsEarly = Math.random() < 0.55; if (TEAM.opsEarly) w.until = Math.min(w.until || S.t + 3600, S.t + rnd(20, 35)*60); }, get reply(){ return TEAM.opsEarly ? `We can: the runway will be back to full length by about ${hmZ(w.until)}.` : 'Sorry, the concrete needs its time. No change.'; } },
    { label: 'Keep the plan, I\'ll work round it', keys: ['no', 'keep', 'round'], reply: 'OK. Put the heavies on the other runway if you can, or they hold.' }] });
  for (const w of works('ils')) teamAsk({ text: `Engineering are on the ILS ${w.rw}. Shall I ask them to make it a priority?`, opts: [
    { label: 'Yes, make it a priority', keys: ['yes', 'priority', 'fix'], by: 'ENG', do: () => { TEAM.engEarly = Math.random() < 0.5; if (TEAM.engEarly) w.until = Math.min(w.until || S.t + 5400, S.t + rnd(20, 40)*60); }, get reply(){ return TEAM.engEarly ? `We'll have it back by about ${hmZ(w.until)}.` : 'We\'re waiting on a part: it won\'t be quicker, sorry.'; } },
    { label: 'No, it\'s fine', keys: ['no', 'fine'], reply: 'OK.' }] });
  if (mine.length >= 3 && h.arr + h.dep >= 25) teamAsk({ text: `It's going to be busy, ${h.arr + h.dep} movements this hour. Do you want Ground split off to a colleague from the start?`, opts: [
    { label: 'Yes, split Ground off', keys: ['yes', 'split', 'ground'], do: () => { if (typeof shiftSeat === 'function' && S.seats.GND !== 'AI') { shiftSeat('GND', 'AI'); SHIFT.splits.push('GND'); } }, reply: 'Done: Ground is open on its own frequency.' },
    { label: 'No, I\'ll band-box', keys: ['no', 'band'], reply: 'OK, shout if it gets too much: I\'ll split it when it does.' }] });
  teamQ = teamQ.then(() => { if (!TEAM.ask.length && !TEAM.started) { TEAM.started = true; teamLater('OUT', 'That\'s everything from me. Ready to take it?', 500); } });
}

// ── the window: the briefing at the top, the chat under it
function teamOpen(handover){
  document.getElementById('teamchat')?.remove();
  const wasPaused = S.paused; if (handover && !(typeof SHIFT !== 'undefined' && SHIFT && SHIFT.live)) S.paused = true;   // (Live now runs on: liveshift.js)
  TEAM.open = true; TEAM.unread = 0; teamBadge();
  const box = document.createElement('div'); box.className = 'debrief'; box.id = 'teamchat';
  box.innerHTML = `<div class="db-card tc-card" role="dialog" aria-label="Team chat"><div class="db-hd"><b>${handover ? 'Shift handover · team chat' : 'Team chat'}</b><span class="db-sum">${hmZ(S.t)}</span><span class="grow"></span>${handover ? '' : '<button type="button" class="db-x" aria-label="Close">✕</button>'}</div>
    ${handover ? '<details class="tc-brief"><summary>Handover briefing</summary><dl class="ho-list"></dl></details>' : ''}
    <div class="tc-msgs" aria-live="polite"></div><div class="tc-chips"></div>
    <form class="tc-in"><input type="text" placeholder="Write to the team…" aria-label="Message to the team"><button type="submit" class="btn ghost">Send</button>${handover ? '<button type="button" class="btn" data-h="take">I have the position</button>' : ''}</form></div>`;
  document.body.appendChild(box);
  if (handover) { const dl = box.querySelector('.ho-list'); for (const [k, v] of shiftBrief(false)) { const dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = k; dd.textContent = v; dl.append(dt, dd); } }
  const inp = box.querySelector('.tc-in input');
  box.querySelector('.tc-in').onsubmit = e => { e.preventDefault(); teamTyped(inp.value); inp.value = ''; };
  const close = () => { box.remove(); TEAM.open = false; };
  const x = box.querySelector('.db-x'); if (x) x.onclick = close;
  const take = box.querySelector('[data-h="take"]');
  if (take) take.onclick = () => {
    // anything not answered keeps the plan as it is
    TEAM.ask.length = 0; close(); S.paused = false; if (typeof shiftTaken === 'function') shiftTaken();
    teamSay('OUT', 'You have it. Cheers!', true);
    sys(`Handover complete: you have the position until ${hmZ(SHIFT.end)}.${TEAM.strat.reg ? ` Arrivals regulated to ${TEAM.strat.reg} an hour.` : ''}`);
  };
  teamRenderMsgs();
}
function teamHandover(){ teamOpen(true); teamScript(); }

// ── through the shift
function teamStep(){
  if (!TEAM.people || !S.running) return;
  if (WORKS) for (const w of WORKS.list) {
    if (w.done) continue;
    if (w.until && S.t >= w.until) worksEnd(w, TEAM.opsEarly || TEAM.engEarly);
    if (w.k === 'insp' && !w.warned && w.at - S.t <= 300 && w.at > S.t) { w.warned = true; teamSay('OPS', `Inspection on ${w.rw} in five minutes, at ${hmZ(w.at)}: we'll need the runway for about ${w.mins} minutes.`); }
    if (w.k === 'insp' && S.t >= w.at) { w.done = true; if (S.emg && !S.emg.rwyBlock && typeof block === 'function') block('a planned runway inspection', w.mins, w.rw); }
  }
  if (TEAM.strat.lvpEarly && !S.lvpOn && typeof lvpPrep === 'function' && lvpPrep() && rvrTdz() < 1500) { lvpSet(true, true); teamSay('SUP', `RVR ${rvrTdz()} m: I've declared LVP as we agreed.`); }
  if (TEAM.strat.gustBrief && (S.wx.gust || S.wx.cb)) for (const a of S.acs) if (a.kind === 'ARR' && a.airborne && !a.wsTold && a.state !== 'PRE') a.wsTold = true;
}
S.listeners.push((ev, d) => {
  if (ev === 'start') {
    if (WORKS) for (const w of WORKS.list) if (w.k === 'twy') { for (const e of w.edges) e.closed = false; }
    WORKS = null; TEAM.msgs = []; TEAM.ask = []; TEAM.strat = {}; TEAM.unread = 0; TEAM.started = false; TEAM.people = null; teamQ = Promise.resolve();
    if (typeof TAXI_MEMO !== 'undefined') TAXI_MEMO.clear();
    const btn = document.getElementById('tgTeam'); if (btn) btn.hidden = true;
    if (typeof SHIFT === 'undefined' || !SHIFT) return;
    const pool = [...NAMES].sort(() => Math.random() - 0.5); TEAM.people = {}; Object.keys(ROLE).forEach((k, i) => TEAM.people[k] = pool[i]);
    worksInit(SHIFT.len);
    if (btn) { btn.hidden = false; teamBadge(); }
  }
  if (ev === 'wxchange' && TEAM.people && d) {
    teamSay('MET', `New observation: ${S.wx.raw}${d === 'the cold front has passed' ? '. The front has gone through.' : ''}`, true);
    if (d === 'the cold front has passed' && TEAM.strat.autoRwy && typeof wxBest === 'function') { const b = wxBest(); if (b) { teamSay('SUP', `The wind has veered: changing to runway ${b} as agreed.`); setRwy(b); } }
  }
});
{ const b = document.getElementById('tgTeam'); if (b) b.onclick = () => teamOpen(false); }
