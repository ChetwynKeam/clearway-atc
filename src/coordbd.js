// ═════════════════════════ coordination: the phone lines ═════════════════════════
// Everything said on the landlines (releases, flow stops, Ops, estimates, the other positions) lands on the
// coordination board: a drawer in the console (menu › Coordination) that can also go on its own page (Pop out).
// Calls that need an answer ring: a notification pops in at the top of the screen, and the call waits on the board
// for you to pick an answer. An unanswered call goes cold after 45 seconds (−5): the caller says so and you lose
// whatever they were offering.
//
// Calls that come in:
// • Area: two inbounds estimated close together at the boundary, asking whether you accept them as they are or want
//   10 NM in trail (the second then arrives two or three minutes later)
// • Area: asks to take one of your departures direct to its exit point (approve, and the instruction is given)
// • Area: cancels a release it gave (acknowledge; a new one comes a few minutes later), and its flow stops
// • the AI Tower or Approach colleague: a go-around, and what they are doing with it
const CB = { calls: [], id: 0, open: false, win: null, nextDct: 0, unread: 0 };
const CB_TIMEOUT = 45;
const cbMine = k => S.seats && S.seats[k] !== 'AI';
function cbAdd(c){
  c.id = ++CB.id; c.t = S.t; c.st = c.opts ? 'RING' : 'INFO'; CB.calls.push(c);
  if (CB.calls.length > 200) CB.calls.shift();
  if (c.opts) { cbToast(c); cbRing(); }
  if (!CB.open) { CB.unread++; cbBadge(); }
  cbRender();
  return c;
}
// every landline message is on the board as well as in the radio log
const _coordLog = coord;
coord = function(text, who){
  _coordLog(text, who);
  if (!S.running || CB.quiet) return;
  const from = !who ? 'Landline' : who === who.toUpperCase() ? who.toLowerCase().replace(/\b[a-z]/g, c => c.toUpperCase()) : who;
  // a stop order to a Tower you are working: read it back
  if (/\b(stop|ground stop)\b.*\buntil\b|is extended until/.test(text) && cbMine('TWR') && !aiCtx) cbAdd({ from, text, opts: [{ label: 'Acknowledge the stop', reply: `${APT.coordName}: stop copied.` }], missed: 'The stop applies all the same.' });
  else cbAdd({ from, text, ai: !!aiCtx });
};
function cbAnswer(id, i){
  const c = CB.calls.find(c => c.id === id); if (!c || c.st !== 'RING') return;
  const o = c.opts[i]; c.st = 'DONE'; c.ans = o.label;
  try { o.do && o.do(); } catch (e) {}
  if (o.reply) { CB.quiet = true; try { coord(o.reply, c.from.toUpperCase()); } finally { CB.quiet = false; } c.reply = o.reply; }
  document.querySelectorAll(`.cb-toast[data-id="${id}"]`).forEach(n => n.remove());
  cbRender();
}
function cbStep(){
  if (!S.running) return;
  for (const c of CB.calls) if (c.st === 'RING' && S.t - c.t > CB_TIMEOUT) {
    c.st = 'MISSED'; S.score.pts -= 5;
    sys(`Missed call from ${c.from}: "${c.text.slice(0, 80)}${c.text.length > 80 ? '…' : ''}" (−5). ${c.missed || ''}`, true);
    try { c.onMiss && c.onMiss(); } catch (e) {}
    document.querySelectorAll(`.cb-toast[data-id="${c.id}"]`).forEach(n => n.remove());
    cbRender();
  }
  if (Math.floor(S.t) % 15 === 0) { cbEstimates(); cbDirect(); cbRelCancel(); }
  if (/^live/.test(S.mode) && typeof cbTrail === 'function') cbTrail();
}

// ── the calls
const areaName = () => (typeof relUnit === 'function' && S.acs[0] ? relUnit(S.acs[0]) : null) || 'Area';
function cbEstimates(){
  if (!cbMine('APP') || S.t < (CB.nextEst || 0)) return;
  const list = S.sched.filter(f => f.k === 'ARR' && !f.spawned && !f.hold).sort((a, b) => a.m - b.m);
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1], b = list[i], lead = b.m*60 - PRE_LEAD - S.t;
    if (a.estd || b.estd || lead < 60 || lead > 300 || (b.m - a.m) > 1.5 || b.gate !== a.gate) continue;
    a.estd = b.estd = true; CB.nextEst = S.t + rnd(4, 8)*60;
    const fix = (ARR_ROUTE[b.gate] && ARR_ROUTE[b.gate][arrKey(b)] || [])[0] || 'the boundary';
    cbAdd({ from: areaName(), text: `Estimates ${a.cs} and ${b.cs}, ${fix} at ${hhmmOf(a.m)} and ${hhmmOf(b.m)}, same level. Do you accept them as they are?`, opts: [
      { label: 'Accept, I\'ll sequence them', reply: `${APT.coordName}: accepted, ${a.cs} and ${b.cs}.` },
      // (Live now: a real flight keeps its time on the board, which is how the real aircraft is recognised; the area
      // spaces it at the boundary instead, liveshift.js cbTrail)
      { label: 'Request 10 NM in trail', do: () => { if (b.real && /^live/.test(S.mode)) b.trail = a.cs; else if (!b.spawned) b.m = Math.max(b.m, a.m) + rnd(2, 3); }, get reply(){ return b.trail ? `${areaName()}: 10 in trail, ${b.cs} will be behind ${a.cs} at the boundary.` : `${areaName()}: 10 in trail, ${b.cs} new estimate ${hhmmOf(b.m)}.`; } }],
      missed: 'They come as they are.' });
    return;
  }
}
const hhmmOf = m => zt(m*60).slice(0, 5);
function cbDirect(){
  const seat = cbMine('DEP') ? 'DEP' : cbMine('APP') ? 'APP' : null; if (!seat || S.t < CB.nextDct) return;
  CB.nextDct = S.t + rnd(10, 20)*60;
  const ac = S.acs.find(a => a.kind === 'DEP' && a.airborne && !a.handed && seatOf(a) === seat && !aiOwns(a) && a.alt > 3000 && a.mode === 'NAV' && !a.reqDct);
  if (!ac) return;
  const R = exitRouteOf(ac) || [], fx = R[R.length - 1] || R[0]; if (!fx || !WP[fx] || ac.route[0] === fx) return;
  cbAdd({ from: areaName(), ac, text: `${ac.cs}: can we have it direct ${fx}? Nothing in the way at our end.`, opts: [
    { label: `Approve: ${ac.cs} direct ${fx}`, do: () => { if (S.acs.includes(ac) && ac.airborne && !ac.handed) command(`${ac.cs} DCT ${fx}`); }, reply: `${APT.coordName}: ${ac.cs} direct ${fx}, approved.` },
    { label: 'Unable, traffic', reply: `${APT.coordName}: unable for ${ac.cs}, traffic.` }] });
}
function cbRelCancel(){
  if (!cbMine('TWR') && !cbMine('GND')) return;
  const ac = S.acs.find(a => a.rel && a.rel.st === 'OK' && a.ground && !a.cto && !a.rel.cxlTried && !aiOwns(a));
  if (!ac) return; ac.rel.cxlTried = true;
  if (Math.random() > 0.15) return;
  const who = relUnit(ac), wait = Math.round(rnd(3, 6));
  ac.rel.st = 'REQ'; ac.rel.at = S.t + wait*60; ac.rel.nb = null;
  if (ac.cto) ac.cto = false;
  cbAdd({ from: who, ac, text: `Release for ${ac.cs} is cancelled, sector overload. We'll release it again in about ${wait} minutes.`, opts: [
    { label: 'Acknowledge', reply: `${APT.coordName}: release for ${ac.cs} cancelled, copied.` }],
    missed: `${ac.cs} is not released: don't let it go.` });
  if (S.sel === ac) renderSel();
}
// a go-around, from the AI colleague on the other position
S.listeners.push((ev, ac) => {
  if (ev === 'start') { CB.calls = []; CB.unread = 0; CB.nextDct = S.t + 600; CB.nextEst = 0; cbBadge(); cbRender(); document.querySelectorAll('.cb-toast').forEach(n => n.remove()); return; }
  if (ev !== 'ga' || !ac || !S.running) return;
  const twr = cbMine('TWR'), app = cbMine('APP'), alt = altShort(APT.gaAlt);
  if (app && !twr) cbAdd({ from: AI_NAME.TWR + ' (AI)', ac, text: `Go-around, ${ac.cs}${ac.gaWhy ? ', ' + ac.gaWhy : ''}: runway heading, climbing ${alt}. Your traffic.`, opts: [{ label: 'Roger, my traffic', reply: `${APT.coordName}: ${ac.cs}, my traffic.` }], missed: 'Tower carries on with it.' });
  else if (twr && !app) cbAdd({ from: AI_NAME.APP + ' (AI)', ac, text: `For the go-around ${ac.cs}: runway heading, ${alt}, then transfer it to me.` });
});

// ── notifications and the board
function cbRing(){
  if (!S.voice || typeof audio !== 'function') return;
  const a = audio(); if (!a) return;
  try { for (const k of [0, 0.25]) { const o = a.createOscillator(), g = a.createGain(), t = a.currentTime + k; o.frequency.value = 880; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.08, t + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18); o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + 0.2); } } catch (e) {}
}
function cbCallHtml(c){
  return `<div class="cb-call ${c.st.toLowerCase()}" data-id="${c.id}"><div class="cb-h"><b>${esc(c.from)}</b><span>${zt(c.t).slice(0, 5)}</span>${c.st === 'RING' ? '<i class="cb-ring">ringing</i>' : c.st === 'MISSED' ? '<i class="cb-miss">missed</i>' : ''}</div>
    <p>${esc(c.text)}</p>${c.st === 'RING' ? `<div class="cb-opts">${c.opts.map((o, i) => `<button type="button" data-a="${c.id}:${i}">${esc(o.label)}</button>`).join('')}</div>` : c.ans ? `<p class="cb-ans">You: ${esc(c.ans)}</p>${c.reply ? `<p class="cb-ans">${esc(c.reply)}</p>` : ''}` : ''}</div>`;
}
function cbToast(c){
  let box = document.querySelector('.cb-toasts'); if (!box) { box = document.createElement('div'); box.className = 'cb-toasts'; document.body.appendChild(box); }
  const n = document.createElement('div'); n.className = 'cb-toast'; n.dataset.id = c.id; n.innerHTML = cbCallHtml(c); box.appendChild(n);
  while (box.children.length > 3) box.firstChild.remove();
}
function cbBadge(){ const b = document.getElementById('tgCoord'); if (b) b.textContent = CB.unread ? `Coordination (${CB.unread})` : 'Coordination'; }
function cbBody(){
  const ring = CB.calls.filter(c => c.st === 'RING'), rest = CB.calls.filter(c => c.st !== 'RING').slice(-60).reverse();
  const rel = S.acs.filter(a => a.rel && a.ground && !a.airborne).map(a => `<span class="cb-rel ${relCls(a)}">${esc(a.cs)} ${{ ok: 'released' + (a.rel.nb ? ' NB ' + zt(a.rel.nb).slice(0, 5) : '') + ' until ' + zt(a.rel.until).slice(0, 5), req: 'requested', exp: 'expired' }[relCls(a)]}</span>`).join('');
  return `<div class="cb-sec"><div class="lbl">Ringing</div>${ring.length ? ring.map(cbCallHtml).join('') : '<p class="dimmer">No calls waiting.</p>'}</div>
    ${rel ? `<div class="cb-sec"><div class="lbl">Releases</div><div class="cb-rels">${rel}</div></div>` : ''}
    <div class="cb-sec"><div class="lbl">Earlier calls</div>${rest.map(cbCallHtml).join('') || '<p class="dimmer">None yet.</p>'}</div>`;
}
function cbRender(){
  const d = document.getElementById('coordbd'); if (d) d.querySelector('.cb-body').innerHTML = cbBody();
  if (CB.win && !CB.win.closed) { const b = CB.win.document.querySelector('.cb-body'); if (b) b.innerHTML = cbBody(); }
  for (const n of document.querySelectorAll('.cb-toast')) { const c = CB.calls.find(c => c.id === +n.dataset.id); if (!c || c.st !== 'RING') n.remove(); }
}
function cbClick(e){ const b = e.target.closest && e.target.closest('[data-a]'); if (!b) return; const [id, i] = b.dataset.a.split(':').map(Number); cbAnswer(id, i); }
document.addEventListener('click', e => { cbClick(e); const t = e.target.closest && e.target.closest('.cb-toast'); if (t && !e.target.closest('[data-a]')) cbOpen(); });
function cbOpen(){
  CB.open = true; CB.unread = 0; cbBadge();
  let d = document.getElementById('coordbd');
  if (!d) {
    d = document.createElement('aside'); d.id = 'coordbd'; d.className = 'cb-drawer'; d.setAttribute('aria-label', 'Coordination');
    d.innerHTML = `<div class="cb-top"><b>Coordination</b><span class="grow"></span><button type="button" class="btn ghost" data-cb="pop">Pop out</button><button type="button" class="db-x" data-cb="x" aria-label="Close">✕</button></div><div class="cb-body"></div>`;
    document.body.appendChild(d);
    d.querySelector('[data-cb="x"]').onclick = () => { d.remove(); CB.open = false; };
    d.querySelector('[data-cb="pop"]').onclick = () => { cbPop(); d.remove(); CB.open = false; };
  }
  cbRender();
}
function cbPop(){
  if (CB.win && !CB.win.closed) { CB.win.focus(); return; }
  const w = popWin('cwCoord', `${APT.icao} coordination`, 520, 800); if (!w) return;
  CB.win = w; w.document.body.innerHTML = `<div class="cb-page"><div class="cb-top"><b>${esc(APT.name)} · coordination</b></div><div class="cb-body"></div></div>`;
  w.document.addEventListener('click', cbClick);
  cbRender();
}
{ const b = document.getElementById('tgCoord'); if (b) b.onclick = () => cbOpen(); }
