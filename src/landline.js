// ═════════════════════════ push-to-talk on the landlines ═════════════════════════
// The speech recognition used for the radio (voice.js), for the coordination board and the team chat: hold the
// Landline button (on the coordination board, its pop-out and the team chat) or hold L, and say it:
// • an answer to the call ringing: "approve", "accept", "unable", "acknowledge", "request ten miles in trail",
//   "roger, my traffic", "yes, new slot", "no, it will make it"… (a callsign picks the call when several are ringing)
// • an answer to the supervisor's question in the team chat ("yes, regulate", "no, we'll hold them"), or a question
//   for the team ("how many are holding?", "what's the weather doing?")
// • "declare LVP" / "cancel LVP"
// • "split ground" (or departure, approach, tower) to a colleague, "band-box ground" to take it back
// • "request release for <callsign>"
// • "regulate the arrivals" (to the capacity, or "to 30 an hour") on a shift
// What was heard and what it did shows on the board or chat; anything not understood says so, with what can be said
// right now. Said on the radio button (T) with no instruction for a flight in it, a landline phrase is taken too.
const LLN = { rec: null, talking: false, held: false, text: '', endT: 0 };
const LL_STOP = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'its', 'you', 'your', 'will', 'can', 'now', 'have', 'it']);
const LL_NUM = { ten: 10, twenty: 20, thirty: 30, forty: 40, fifty: 50, fifteen: 15, twelve: 12, eleven: 11, eight: 8, five: 5, six: 6, seven: 7, nine: 9, four: 4, three: 3, two: 2, one: 1 };
function llNorm(raw){
  let s = ' ' + String(raw).toLowerCase().replace(/[,.;:!?']/g, ' ').replace(/-/g, ' ') + ' ';
  s = s.replace(/ nautical miles? /g, ' nm ').replace(/ miles? /g, ' nm ').replace(/ low vis(ibility)?( procedures)? /g, ' lvp ').replace(/ l v p /g, ' lvp ')
    .replace(/ band ?box(ing)? /g, ' bandbox ').replace(/ in ?trail /g, ' trail ').replace(/ okay /g, ' ok ');
  s = s.replace(/ (ten|twenty|thirty|forty|fifty|fifteen|twelve|eleven|one|two|three|four|five|six|seven|eight|nine) /g, (m, w) => ` ${LL_NUM[w]} `).replace(/ (\d+) (\d) /g, (m, a, b) => +a % 10 === 0 && +a >= 20 ? ` ${+a + +b} ` : m);
  return s.replace(/\s+/g, ' ');
}
const LL_YES = / (approve|approved|accept|accepted|agree|agreed|affirm|affirmative|yes|yeah|go ahead|fine|ok|please do|do it|sure) /;
const LL_NO = / (unable|negative|no|decline|not|won t|keep|later) /;
const LL_ACK = / (acknowledge|acknowledged|copied|copy|roger|wilco|understood|noted) /;
// the kind of answer an option is, from how its label starts
const llKind = label => { const l = label.toLowerCase(); return /^(acknowledge|roger)/.test(l) ? 'ack' : /^(no\b|unable|later|keep|not\b)/.test(l) ? 'no' : 'yes'; };
// the option of a call (or question) that what was said best matches: its words, and yes / no / acknowledge
function llPick(s, opts){
  const said = LL_YES.test(s) ? 'yes' : LL_ACK.test(s) ? 'ack' : LL_NO.test(s) ? 'no' : null;
  const sc = opts.map(o => {
    const words = llNorm(o.label).trim().split(' ').filter(w => (w.length >= 3 || /^\d+$/.test(w)) && !LL_STOP.has(w));
    let n = words.filter(w => s.includes(' ' + w + ' ')).length*2 + (o.keys || []).filter(k => s.includes(k)).length*2;
    const k = llKind(o.label); if (said && (said === k || (said === 'yes' && k === 'ack' && opts.length === 1))) n += 3;
    if (said === 'no' && k === 'yes') n -= 2; if (said === 'yes' && k === 'no') n -= 2;
    return n;
  });
  const best = Math.max(...sc); if (best <= 0) return null;
  return sc.filter(x => x === best).length === 1 ? opts[sc.indexOf(best)] : null;
}
const LL_SEAT = { ground: 'GND', departure: 'DEP', departures: 'DEP', director: 'DEP', approach: 'APP', radar: 'APP', tower: 'TWR', delivery: 'GND' };
// what the words ask for: { did } once done, { why } if it could not be, or null when nothing matched
function llMatch(raw){
  const s = llNorm(raw); let m;
  // LVP
  if (/ (declare|declaring|start|in force) lvp /.test(s) || / lvp (in force|declared|on) /.test(s)) {
    if (typeof lvpSet !== 'function') return { why: 'There are no low visibility procedures at this airport.' };
    if (S.lvpOn) return { why: 'LVP are already in force.' };
    lvpSet(true, true); return { did: 'LVP declared' };
  }
  if (/ (cancel|cancelling|end|off) lvp /.test(s) || / lvp (cancelled|off) /.test(s)) {
    if (!S.lvpOn) return { why: 'LVP are not in force.' };
    if (typeof lvpCanCancel === 'function' && !lvpCanCancel()) return { why: 'The RVR is still under 800 m: LVP stay in force.' };
    lvpSet(false, true); return { did: 'LVP cancelled' };
  }
  // splitting a position off to a colleague, or band-boxing it back
  if ((m = s.match(/ (split|open|split off) (ground|departure|departures|director|approach|radar|tower|delivery)/)) || (m = s.match(/ (ground|departure|director|approach|radar|tower) (split|split off|to a colleague) /))) {
    const k = LL_SEAT[m[2]] || LL_SEAT[m[1]]; if (!k) return null;
    if (S.seats[k] === 'AI') return { why: `${AI_NAME[k]} is already with a colleague.` };
    if (AI_SEATS.filter(x => S.seats[x] !== 'AI').length < 2) return { why: `${AI_NAME[k]} is the only position you have: there is nothing to split it from.` };
    if (typeof shiftSeat === 'function' && typeof SHIFT !== 'undefined' && SHIFT) { shiftSeat(k, 'AI'); SHIFT.splits.push(k); } else setSeat(k, 'AI');
    llTeam('SUP', `Done: ${AI_NAME[k]} is split off, a colleague has ${seatUnit(k)}.`);
    return { did: `${AI_NAME[k]} split off to a colleague` };
  }
  if ((m = s.match(/ (bandbox|band box|combine|take back|i ll take|give me) (ground|departure|departures|director|approach|radar|tower)/)) || (m = s.match(/ (ground|departure|director|approach|radar|tower) (back|bandbox|bandboxed) /))) {
    const k = LL_SEAT[m[2]] || LL_SEAT[m[1]]; if (!k) return null;
    if (S.seats[k] !== 'AI') return { why: `You are already working ${AI_NAME[k]}.` };
    if (typeof shiftSeat === 'function' && typeof SHIFT !== 'undefined' && SHIFT) { shiftSeat(k, 'ME'); SHIFT.splits = SHIFT.splits.filter(x => x !== k); } else setSeat(k, 'ME');
    llTeam('SUP', `OK, ${AI_NAME[k]} is band-boxed back with you.`);
    return { did: `${AI_NAME[k]} band-boxed back with you` };
  }
  // a release
  if (/ (request|requesting|need) (a )?release /.test(s) || / release (for|on) /.test(s)) {
    const ac = llCallsign(raw) || (S.sel && S.sel.kind === 'DEP' ? S.sel : null);
    if (!ac) return { why: 'Say which flight the release is for (or select it first).' };
    if (typeof needRel === 'function' && !needRel(ac)) return { why: `${ac.cs} doesn't need a release.` };
    if (ac.rel && (ac.rel.st === 'REQ' || ac.rel.st === 'OK')) return { why: `${ac.cs}'s release is already ${ac.rel.st === 'OK' ? 'given' : 'requested'}.` };
    command(`${ac.cs} REL`); return { did: `release requested for ${ac.cs}` };
  }
  // the arrivals regulated (a shift's flow manager)
  if (/ regulat/.test(s) && !(typeof TEAM !== 'undefined' && TEAM.ask[0] && TEAM.ask[0].opts.some(o => (o.keys || []).includes('regulat')))) {
    if (typeof regulate !== 'function' || typeof TEAM === 'undefined' || !TEAM.people) return { why: 'The flow manager is only in the team chat on a shift.' };
    const n = (m = s.match(/ (\d{1,2}) /)) ? +m[1] : capHour(), r = regulate(n);
    llTeam('ME', `Can we regulate the arrivals to ${n} an hour?`); llTeam('FMP', `Regulation in at ${n} an hour: ${r.n} inbound${r.n === 1 ? '' : 's'} delayed on the ground at origin, the longest by ${r.max} min.`);
    return { did: `arrivals regulated to ${n} an hour` };
  }
  // the call ringing on the board (the one named, else the oldest)
  if (typeof CB !== 'undefined') {
    const ring = CB.calls.filter(c => c.st === 'RING');
    if (ring.length) {
      const named = ring.find(c => c.ac && s.includes(' ' + llSpoken(c.ac.cs) + ' ')) || ring.find(c => { const a = llCallsign(raw); return a && c.ac === a; });
      const c = named || ring[0], o = llPick(s, c.opts);
      if (o) { cbAnswer(c.id, c.opts.indexOf(o)); return { did: `${c.from}: “${o.label}”` }; }
      if (ring.length && !(typeof TEAM !== 'undefined' && TEAM.ask[0])) return { why: `Not understood for ${c.from}. Say one of: ${c.opts.map(o => '“' + o.label + '”').join(', ')}.` };
    }
  }
  // the supervisor's question in the team chat
  if (typeof TEAM !== 'undefined' && TEAM.ask[0]) {
    const q = TEAM.ask[0], o = llPick(s, q.opts);
    if (o) { teamAnswer(q, o); return { did: `team chat: “${o.label}”` }; }
    return { why: `Not understood. The supervisor asks: ${q.opts.map(o => '“' + o.label + '”').join(' or ')}?` };
  }
  // a question for the team
  if (typeof TEAM !== 'undefined' && TEAM.people && typeof teamAnswers === 'function' && teamAnswers(s).length) { teamTyped(String(raw)); return { did: 'asked the team' }; }
  return null;
}
const llSpoken = cs => (typeof spoken === 'function' ? spoken(cs) : cs).toLowerCase().replace(/[,.;:!?']/g, ' ').replace(/\s+/g, ' ').trim();
function llCallsign(raw){ try { const w = normSpeech(raw); for (let i = 0; i < w.length; i++) { const h = heardCallsign(w.slice(i)); if (h) return h[0]; } } catch (e) {} return null; }
function llTeam(k, text){ if (typeof TEAM !== 'undefined' && TEAM.people && typeof teamSay === 'function') teamSay(k, text, true); }
// what can be said right now, for the "not understood" line
function llHint(){
  const ring = typeof CB !== 'undefined' ? CB.calls.filter(c => c.st === 'RING') : [];
  if (ring.length) return `${ring[0].from} is ringing: say ${ring[0].opts.map(o => '“' + o.label + '”').join(' or ')}.`;
  if (typeof TEAM !== 'undefined' && TEAM.ask[0]) return `The supervisor asks: ${TEAM.ask[0].opts.map(o => '“' + o.label + '”').join(' or ')}.`;
  return 'Try “declare LVP”, “split ground”, “band-box ground”, “request release for …”' + (typeof TEAM !== 'undefined' && TEAM.people ? ', or ask the team (“how many are holding?”)' : '') + '.';
}
// the feedback, on the board, its pop-out and the chat (and the line over the scope)
function llFeedback(t, cls){
  const docs = [document]; if (typeof CB !== 'undefined' && CB.win && !CB.win.closed) docs.push(CB.win.document);
  for (const d of docs) for (const n of d.querySelectorAll('.ll-fb')) { n.textContent = t; n.className = 'll-fb' + (cls ? ' ' + cls : ''); n.hidden = !t; }
  if (typeof setHeard === 'function') setHeard(t, cls);
  clearTimeout(LLN.fbT); if (cls) LLN.fbT = setTimeout(() => llFeedback(''), 9000);
}
function llHeard(text){
  text = (text || '').trim();
  if (!text) { llFeedback('Nothing heard on the landline.', 'bad'); return false; }
  let r; try { r = llMatch(text); } catch (e) { r = { why: 'Something went wrong with that: try again.' }; }
  if (r && r.did) { llFeedback(`☎ “${text}” → ${r.did}`, 'ok'); log('sys', `Landline: “${text}” → ${r.did}.`); return true; }
  const why = r && r.why ? r.why : `Not understood. ${llHint()}`;
  llFeedback(`☎ “${text}” · ${why}`, 'bad'); log('sys', `Landline: heard “${text}”. ${why}`);
  return false;
}
// ── the recogniser, held like the radio's
function llStart(btn){
  LLN.held = true; const SRc = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SRc) { llFeedback('This browser has no speech recognition. Chrome, Edge and Safari support it.', 'bad'); return; }
  if (LLN.talking) return;
  try { speechSynthesis.cancel(); } catch (_) {}
  const r = LLN.rec = new SRc(); r.lang = 'en-GB'; r.interimResults = true; r.continuous = true;
  LLN.text = ''; LLN.talking = true; LLN.btn = btn; document.querySelectorAll('.ll-talk').forEach(b => b.classList.add('on')); llFeedback('☎ Listening on the landline…');
  r.onstart = () => { if (!LLN.held) llStop(); };
  r.onresult = e => { if (r !== LLN.rec) return; let t = ''; for (const x of e.results) t += x[0].transcript + ' '; LLN.text = t.trim(); if (LLN.held) llFeedback('☎ ' + (LLN.text || 'Listening…')); };
  r.onerror = e => { if (e.error === 'not-allowed' || e.error === 'service-not-allowed') { LLN.talking = false; LLN.rec = null; llFeedback('The microphone is blocked here: allow it for this site to talk on the landlines.', 'bad'); } };
  r.onend = () => llFinish(r);
  try { r.start(); } catch (e) { LLN.talking = false; LLN.rec = null; }
}
function llStop(){ LLN.held = false; const r = LLN.rec; if (!r || !LLN.talking) return; try { r.stop(); } catch (_) {} clearTimeout(LLN.endT); LLN.endT = setTimeout(() => llFinish(r), 1200); }
function llFinish(r){
  if (r !== LLN.rec || !LLN.talking) return;
  LLN.talking = false; LLN.rec = null; clearTimeout(LLN.endT); try { r.abort(); } catch (_) {}
  document.querySelectorAll('.ll-talk').forEach(b => b.classList.remove('on'));
  if (typeof CB !== 'undefined' && CB.win && !CB.win.closed) CB.win.document.querySelectorAll('.ll-talk').forEach(b => b.classList.remove('on'));
  llHeard(LLN.text);
}
const LL_BTN = '<button type="button" class="btn ghost ll-talk" title="Hold to talk on the landline (or hold L)" aria-label="Hold to talk on the landline"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2.5h3l1 3-1.6 1a8 8 0 0 0 4.1 4.1l1-1.6 3 1v3a1.5 1.5 0 0 1-1.6 1.5A12 12 0 0 1 1.5 4.1 1.5 1.5 0 0 1 3 2.5z" fill="currentColor"/></svg> Landline</button>';
function llWire(doc){
  if (doc.__llWired) return; doc.__llWired = true;
  doc.addEventListener('pointerdown', e => { const b = e.target.closest && e.target.closest('.ll-talk'); if (!b) return; e.preventDefault(); try { b.setPointerCapture(e.pointerId); } catch (_) {} llStart(b); });
  for (const ev of ['pointerup', 'pointercancel']) doc.addEventListener(ev, e => { if (LLN.held && e.target.closest && e.target.closest('.ll-talk')) llStop(); });
  doc.addEventListener('lostpointercapture', e => { if (LLN.held && e.target.closest && e.target.closest('.ll-talk')) llStop(); });
  doc.addEventListener('contextmenu', e => { if (e.target.closest && e.target.closest('.ll-talk')) e.preventDefault(); });
}
llWire(document);
// hold L to talk on the landline (when not typing)
document.addEventListener('keydown', e => { if (document.body.dataset.route !== 'sim' || e.repeat || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; if (e.key === 'l' || e.key === 'L') { e.preventDefault(); llStart(null); } });
document.addEventListener('keyup', e => { if (e.key === 'l' || e.key === 'L') llStop(); });
// the buttons, on the board (drawer and pop-out) and in the team chat
function llAddTo(top, before){ if (!top || top.querySelector('.ll-talk')) return; const t = document.createElement('template'); t.innerHTML = LL_BTN; const b = t.content.firstChild; if (before) top.insertBefore(b, before); else top.appendChild(b);
  const fb = top.ownerDocument.createElement('div'); fb.className = 'll-fb'; fb.hidden = true; top.after(fb); }
if (typeof cbOpen === 'function') { const _o = cbOpen; cbOpen = function(){ _o(); const d = document.getElementById('coordbd'); if (d) llAddTo(d.querySelector('.cb-top'), d.querySelector('[data-cb="pop"]')); }; }
if (typeof cbPop === 'function') { const _p = cbPop; cbPop = function(){ _p(); if (CB.win && !CB.win.closed) { const doc = CB.win.document; llWire(doc); const top = doc.querySelector('.cb-top'); if (top && !top.querySelector('.ll-talk')) { top.insertAdjacentHTML('beforeend', '<span class="grow"></span>' + LL_BTN); const fb = doc.createElement('div'); fb.className = 'll-fb'; fb.hidden = true; top.after(fb); }
  doc.addEventListener('keydown', e => { if (!e.repeat && (e.key === 'l' || e.key === 'L')) llStart(null); }); doc.addEventListener('keyup', e => { if (e.key === 'l' || e.key === 'L') llStop(); }); } }; }
if (typeof teamOpen === 'function') { const _t = teamOpen; teamOpen = function(h){ _t(h); const f = document.querySelector('#teamchat .tc-in'); if (f) llAddTo(f, f.querySelector('button[type="submit"]')); }; }
window.__ll = { match: llMatch, heard: llHeard, norm: llNorm };
