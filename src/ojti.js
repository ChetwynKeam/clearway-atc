// ═════════════════════════ occurrence reports, the instructor, and noise ═════════════════════════

// ── occurrence reports (MOR). A loss of separation, an airprox or a runway incursion on your positions needs a
// report: the coordination board rings with it. Filing it (a few questions, as on the real form) earns 5 points;
// one still outstanding when the session ends costs 10. Your reports are kept on this device and in the debrief.
const MOR = { list: [] };
const MOR_Q = {
  los: { what: ['Climb or descent given too late', 'Conflict not seen', 'Readback error not caught', 'Crew did not follow the clearance', 'Speed control on final'], did: ['Avoiding action given', 'Traffic information passed', 'Separation restored with a level change', 'Nothing in time'] },
  airprox: { what: ['VFR cleared into the approach path', 'VFR left where it was told to hold', 'Arrival not seen near the zone crossing'], did: ['Traffic information to both', 'Avoiding action given', 'Nothing in time'] },
  inc: { what: ['Crossing or line-up clearance not given', 'Crew or driver went past the stop bar', 'Runway not checked before the clearance'], did: ['Arrival sent around', 'Departure take-off cancelled', 'Stopped the aircraft or vehicle', 'Nothing in time'] }
};
const MOR_NAME = { los: 'Loss of separation', airprox: 'Airprox', inc: 'Runway incursion' };
function morNeed(k, text, cs){
  const m = { id: MOR.list.length + 1, k, text, cs, t: S.t, filed: false };
  MOR.list.push(m);
  if (typeof cbAdd === 'function') cbAdd({ from: 'Supervisor', text: `${MOR_NAME[k]}: ${text}. An occurrence report (MOR) is needed.`, opts: [{ label: 'File the report now', do: () => morForm(m) }, { label: 'Later (from the debrief)' }], missed: 'File it from the debrief before the end of the session.' });
}
function morForm(m){
  if (m.filed) return;
  document.getElementById('morform')?.remove();
  const Q = MOR_Q[m.k], box = document.createElement('div'); box.className = 'debrief'; box.id = 'morform';
  const radio = (n, opts) => opts.map((o, i) => `<label class="mor-o"><input type="radio" name="${n}" value="${i}"${i ? '' : ' checked'}> ${esc(o)}</label>`).join('');
  box.innerHTML = `<div class="db-card ho-card" role="dialog" aria-label="Occurrence report"><div class="db-hd"><b>Occurrence report · ${MOR_NAME[m.k]}</b><span class="db-sum">${hmZ(m.t)}</span></div>
    <form class="mor"><p>${esc(m.text)}</p><div class="lbl">What led to it?</div>${radio('what', Q.what)}<div class="lbl">What did you do?</div>${radio('did', Q.did)}
    <div class="lbl">Anything else (optional)</div><textarea rows="2" name="note"></textarea>
    <div class="ho-ctl"><button type="button" class="btn ghost" data-m="x">Cancel</button><button type="submit" class="btn">File the report</button></div></form></div>`;
  document.body.appendChild(box);
  const wasPaused = S.paused; S.paused = true;
  box.querySelector('[data-m="x"]').onclick = () => { box.remove(); S.paused = wasPaused; };
  box.querySelector('form').onsubmit = e => {
    e.preventDefault(); const f = e.target;
    m.filed = true; m.what = Q.what[+f.what.value]; m.did = Q.did[+f.did.value]; m.note = f.note.value.trim();
    S.score.pts += 5; sys(`Occurrence report filed: ${MOR_NAME[m.k]}, ${m.cs} (+5). Thank you: reports are how the unit learns.`);
    try { const L = JSON.parse(localStorage.getItem('cw-mors') || '[]'); L.push({ ap: APT.icao, at: Date.now(), k: m.k, text: m.text, what: m.what, did: m.did, note: m.note }); localStorage.setItem('cw-mors', JSON.stringify(L.slice(-100))); } catch (_) {}
    box.remove(); S.paused = wasPaused;
  };
}

// ── the instructor (Session › Instructor). An on-the-job training instructor sits with you and says what they see,
// once for each thing: conflicts building, wake gaps on final, a landing clearance due, a readback not caught, a
// departure waiting on a free runway, an emergency not acknowledged, a long hold with no EAT. In a shift the
// instructor is in the team chat; otherwise in the radio log.
const OJTI = { on: false, said: new Set(), t: 0, name: 'Instructor' };
function ojtiSay(key, text){
  if (OJTI.said.has(key)) return; OJTI.said.add(key);
  if (typeof TEAM !== 'undefined' && TEAM.people && typeof teamSay === 'function') { TEAM.people.OJTI ||= OJTI.name; ROLE.OJTI = 'instructor'; teamSay('OJTI', text); }
  else log('coord', text, 'INSTRUCTOR');
}
const mineAc = ac => ac && ac.state !== 'PRE' && !outOfCtl(ac) && !aiOwns(ac);
function ojtiStep(){
  if (!OJTI.on || !S.running || S.t - OJTI.t < 5) return; OJTI.t = S.t;
  const air = S.acs.filter(a => a.airborne && mineAc(a));
  // conflicts in the next two minutes (straight lines), between flights at about the same level
  for (let i = 0; i < air.length; i++) for (let j = i + 1; j < air.length; j++) {
    const a = air[i], b = air[j]; if (Math.abs(a.alt - b.alt) >= 1000 && Math.abs((a.tgtAlt ?? a.alt) - (b.tgtAlt ?? b.alt)) >= 1000) continue;
    if (a.mode === 'FINAL' && b.mode === 'FINAL') continue;
    let min = 1e9, at = 0;
    for (let s = 0; s <= 120; s += 10) { const p = q => [q.x + Math.sin((q.trk ?? q.hdg)*D2R)*q.ias/3600*s, q.y + Math.cos((q.trk ?? q.hdg)*D2R)*q.ias/3600*s], d = dist(...p(a), ...p(b)); if (d < min) { min = d; at = s; } }
    if (min < 3 && at > 20 && dist(a.x, a.y, b.x, b.y) > 4) ojtiSay(`cf${[a.cs, b.cs].sort()}`, `Watch ${a.cs} and ${b.cs}: they'll be about ${min.toFixed(1)} miles apart in ${at} seconds, ${Math.abs(a.alt - b.alt) < 1000 ? 'at the same level' : 'one of them climbing or descending through the other'}. Turn one or stop one off now.`);
  }
  // wake on final
  const fin = air.filter(a => a.mode === 'FINAL' && a.app).sort((a, b) => finalDist(a) - finalDist(b));
  for (let i = 1; i < fin.length; i++) {
    const L = fin[i - 1], F = fin[i]; if (L.app !== F.app) continue;
    const need = WAKE_NM[(L.perf.wake || 'M') + (F.perf.wake || 'M')] || 3, gap = finalDist(F) - finalDist(L);
    if (need > 3 && gap < need && finalDist(F) < 12) ojtiSay(`wk${F.cs}`, `Wake: ${F.cs} needs ${need} miles behind ${L.cs} (${L.perf.wake === 'H' ? 'a heavy' : L.perf.wake}), it has ${gap.toFixed(1)}. Slow it right down or take it off the approach.`);
  }
  for (const a of air) {
    if (a.kind === 'ARR' && a.mode === 'FINAL' && !a.ctl && finalDist(a) < 4 && finalDist(a) > 2 && !S.acs.some(o => o !== a && o.onRwy && rwyOf(landRw(a)).id === o.rwyId)) ojtiSay(`ctl${a.cs}${a.gaCount || 0}`, `${a.cs} is at four miles and the runway is free: clear it to land now, don't leave it late.`);
    if (a.rbErr && S.t - a.rbErr.t > 20) ojtiSay(`rb${a.cs}${a.rbErr.t}`, `Listen to the readbacks: ${a.cs} read back ${a.rbErr.kind === 'alt' ? altShort(a.rbErr.wrong) : a.rbErr.kind === 'spd' ? a.rbErr.wrong + ' knots' : 'heading ' + a.rbErr.wrong}, not what you said. Correct it.`);
    if (a.csErr && S.t - a.csErr.t > 15) ojtiSay(`cs${a.cs}${a.csErr.t}`, `That instruction was for ${a.csErr.for}, but ${a.cs} took it. Put ${a.cs} right, then give ${a.csErr.for} its instruction again.`);
    if (a.mode === 'HOLD' && (a.holdNow || 0) > 900 && !a.eat) ojtiSay(`eat${a.cs}`, `${a.cs} has been holding a quarter of an hour: give it an expected approach time (EAT).`);
    if (a.emerg && !a.emerg.ack && S.t - a.emerg.t > 20) ojtiSay(`em${a.cs}`, `${a.cs} has declared a ${a.emerg.k}: acknowledge it first, then deal with everything else.`);
  }
  for (const a of S.acs) if (mineAc(a) && a.ground && a.need === 'Ready for departure' && a.state === 'HOLDPT' && S.t - (a.readyT ??= S.t) > 120 && !S.acs.some(o => o.onRwy || (o.mode === 'FINAL' && finalDist(o) < 5))) ojtiSay(`dep${a.cs}`, `${a.cs} has been ready for two minutes and the runway is free: line it up and get it away.`);
}
// the checkout: the competencies an assessor scores, from what happened on your positions
function ojtiReport(){
  const sc = S.score, hrs = Math.max(0.25, S.t/3600), mv = sc.landed + sc.departed, mors = MOR.list.length, filed = MOR.list.filter(m => m.filed).length;
  const g = (ok, mid) => ok ? ['Competent', 'ok'] : mid ? ['Developing', 'mid'] : ['Not yet', 'bad'];
  const rows = [
    ['Separation', g(sc.los === 0, sc.los <= 1), sc.los ? `${sc.los} loss${sc.los > 1 ? 'es' : ''} of separation` : 'no losses of separation'],
    ['Runway safety', g(sc.incidents === 0, sc.incidents <= 1), sc.incidents ? `${sc.incidents} incident${sc.incidents > 1 ? 's' : ''}` : 'no runway incidents'],
    ['Traffic flow', g(mv/hrs >= 10 && sc.ga <= 2, mv/hrs >= 5), `${mv} movements (${Math.round(mv/hrs)} an hour), ${sc.ga} go-around${sc.ga === 1 ? '' : 's'}${sc.div ? `, ${sc.div} diversion${sc.div > 1 ? 's' : ''}` : ''}`],
    ['Rules and procedures', g(sc.infr === 0, sc.infr <= 2), sc.infr ? `${sc.infr} infringement${sc.infr > 1 ? 's' : ''} (wrong readbacks left, spacing, holding with no EAT…)` : 'none'],
    ['Reporting', g(filed === mors, filed > 0), mors ? `${filed} of ${mors} occurrence report${mors > 1 ? 's' : ''} filed` : 'nothing to report']
  ];
  return `<div class="ojti"><div class="lbl">Assessment</div>${rows.map(([k, [v, c], d]) => `<div class="oj-r"><b>${k}</b><span class="oj-${c}">${v}</span><small>${esc(d)}</small></div>`).join('')}
    ${MOR.list.filter(m => !m.filed).map(m => `<button type="button" class="btn ghost oj-mor" data-mor="${m.id}">File the report: ${esc(MOR_NAME[m.k])} ${zt(m.t).slice(0, 5)}</button>`).join('')}</div>`;
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-mor]'); if (b) { const m = MOR.list.find(m => m.id === +b.dataset.mor); if (m) { morForm(m); b.remove(); } } });

// ── noise. UK airports have noise preferential routes: a departure stays on its SID track until it is at 4,000 ft.
// Turned off it lower than that, it flies over the towns the route avoids, and the complaints come in (more of them at
// night, 23:00 to 06:00 local). At night each movement also uses the airport's night quota (QC points: a heavy 4, a
// medium 1, a light 0.5); going over the session's allowance costs 20 points a time.
const NOISE = { qc: 0, cap: 20, over: 0 };
const nightLocal = () => { const ms = (S.start || 0) + S.t*1000, h = ((new Date(ms).getUTCHours() + tzOffH(ms)) % 24 + 24) % 24; return h >= 23 || h < 6; };
function noiseCmd(ac, toks){
  if (aiCtx || !ac || ac.kind !== 'DEP' || !ac.airborne || ac.alt >= 4000 || !toks.some(t => /^[HLR]\d{1,3}$/.test(t)) || ac.nprOff) return;
  ac.nprOff = true;
  const n = nightLocal(), p = n ? 0.8 : 0.4;
  if (Math.random() < p) { const k = n ? 15 : 5; SC(ac).pts -= k; sys(`Noise: ${ac.cs} was turned off its noise preferential route at ${altShort(Math.round(ac.alt/100)*100)} (below 4,000 ft)${n ? ' at night' : ''}; complaints from under the new track (−${k}).`, true); }
}
function noiseMove(ac){
  if (!nightLocal() || aiOwns(ac)) return;
  const q = { J: 8, H: 4, M: 1, L: 0.5 }[ac.perf.wake] ?? 1; NOISE.qc += q;
  if (NOISE.qc > NOISE.cap) { NOISE.over++; SC(ac).pts -= 20; sys(`Night quota exceeded: ${ac.cs} (${q} QC) takes the session to ${NOISE.qc} of ${NOISE.cap} points (−20). At night, keep the noisiest types for the morning if their slot allows.`, true); }
}
function noisePanel(){ return nightLocal() ? `<div class="warnline dimmer">Night quota: ${NOISE.qc} of ${NOISE.cap} QC points used</div>` : ''; }

S.listeners.push((ev, d) => {
  if (ev === 'start') {
    MOR.list = []; OJTI.said.clear(); OJTI.t = 0; NOISE.qc = 0; NOISE.over = 0;
    const el = document.getElementById('ojtiSel'); OJTI.on = !!(el && el.value === 'on'); OJTI.name = ['Alex', 'Siobhán', 'Paddy', 'Rachel', 'Imran', 'Claire'][hash(String(S.start)) % 6];
    return;
  }
  if (ev === 'shiftend') { const left = MOR.list.filter(m => !m.filed).length; if (left) { S.score.pts -= 10*left; sys(`${left} occurrence report${left > 1 ? 's' : ''} not filed by the end of the shift (−${10*left}). File ${left > 1 ? 'them' : 'it'} from the debrief.`, true); } return; }
  if (!S.running) return;
  if (ev === 'los' && d && !d.ai) morNeed('los', `${d.a.cs} and ${d.b.cs}, ${d.d.toFixed(1)} NM and ${Math.round(d.dz/100)*100} ft`, `${d.a.cs}/${d.b.cs}`);
  if (ev === 'airprox' && d && S.seats.APP !== 'AI') morNeed('airprox', `${d.v.cs} (VFR) and ${d.a.cs}`, `${d.v.cs}/${d.a.cs}`);
  if (ev === 'incursion' && d && !aiOwns(d)) morNeed('inc', `${d.cs || 'a vehicle'} on the runway without a clearance`, d.cs || '');
  if ((ev === 'landed' || ev === 'takeoff') && d) noiseMove(d);
  if (ev === 'cmd' && d) noiseCmd(d.ac, d.toks || []);
});
