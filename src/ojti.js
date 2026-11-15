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
  // the flights you were working that should have landed or departed by now (due 15 minutes ago or more), against the
  // ones that did: so a quiet airport is judged on its own traffic, not a fixed rate
  const mine = AI_SEATS.filter(k => S.seats[k] !== 'AI'), arrMine = mine.some(k => k === 'APP' || k === 'TWR'), depMine = mine.some(k => k === 'TWR' || k === 'GND' || k === 'DEP');
  const due = S.sched.filter(f => f.m*60 <= S.t - 900 && f.m >= 0 && (f.k === 'ARR' ? arrMine : depMine)).length, flow = due ? Math.min(1, mv/due) : 1;
  const g = (ok, mid) => ok ? ['Competent', 'ok'] : mid ? ['Developing', 'mid'] : ['Not yet', 'bad'];
  const rows = [
    ['Separation', g(sc.los === 0, sc.los <= 1), sc.los ? `${sc.los} loss${sc.los > 1 ? 'es' : ''} of separation` : 'no losses of separation'],
    ['Runway safety', g(sc.incidents === 0, sc.incidents <= 1), sc.incidents ? `${sc.incidents} incident${sc.incidents > 1 ? 's' : ''}` : 'no runway incidents'],
    ['Traffic flow', g(flow >= 0.7 && sc.ga <= 2, flow >= 0.4), `${mv} movements of the ${due} due by now${due ? ` (${Math.round(flow*100)}%)` : ''}, ${sc.ga} go-around${sc.ga === 1 ? '' : 's'}${sc.div ? `, ${sc.div} diversion${sc.div > 1 ? 's' : ''}` : ''}`],
    ['Rules and procedures', g(sc.infr === 0, sc.infr <= 2), sc.infr ? `${sc.infr} infringement${sc.infr > 1 ? 's' : ''} (wrong readbacks left, spacing, holding with no EAT…)` : 'none'],
    ['Reporting', g(filed === mors, filed > 0), mors ? `${filed} of ${mors} occurrence report${mors > 1 ? 's' : ''} filed` : 'nothing to report']
  ];
  return `<div class="ojti"><div class="lbl">Assessment</div>${rows.map(([k, [v, c], d]) => `<div class="oj-r"><b>${k}</b><span class="oj-${c}">${v}</span><small>${esc(d)}</small></div>`).join('')}
    ${MOR.list.filter(m => !m.filed).map(m => `<button type="button" class="btn ghost oj-mor" data-mor="${m.id}">File the report: ${esc(MOR_NAME[m.k])} ${zt(m.t).slice(0, 5)}</button>`).join('')}</div>`;
}
document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('[data-mor]'); if (b) { const m = MOR.list.find(m => m.id === +b.dataset.mor); if (m) { morForm(m); b.remove(); } } });

// ── noise. Airports have noise preferential routes (NPRs): a departure stays on its SID track until it reaches the
// route's altitude. Turned off it lower than that, it flies over the towns the route avoids, and the complaints come in
// (more of them at night). At night each movement also uses the airport's night quota: quota count (QC) points for
// its noise class, and at some airports a number of movements; going over the session's share costs 20 points a time.
// The UK airports use their real rules (NOISE_RULES below); everywhere else keeps the generic ones (GENERIC_NOISE).
//
// Quota count. The Department for Transport's notice for Heathrow, Gatwick and Stansted (summer 2026, para 6.1 and the
// Schedule, para 12.1: https://ops.group/blog/wp-content/uploads/2026/04/EGLL-EGKK-noise-quota-system.pdf) classes each
// aircraft separately for landing and take-off: a landing by its certificated approach noise minus 9 EPNdB, a take-off
// by the average of its certificated flyover and sideline (lateral) noise. Below 81 EPNdB is QC/0, then 81 to 83.9 is
// QC/0.125, 84 to 86.9 QC/0.25, 87 to 89.9 QC/0.5, 90 to 92.9 QC/1, 93 to 95.9 QC/2, 96 to 98.9 QC/4, 99 to 101.9 QC/8
// and above that QC/16; light propeller aircraft of 8,618 kg or less are QC/0. Manchester and Bristol use the same
// classes (EGCC AD 2.21 para 3; Bristol's quota is in QC points too). The QC of each type here, [landing, take-off], was
// worked out with those rules from EASA's certification noise levels (https://www.easa.europa.eu/en/domains/environment/
// easa-certification-noise-levels: the jet database of 12 November 2026 and the heavy propeller one of 29 October 2026),
// taking the median of the type's entries (they differ with weight and engine). The real classification is per airframe
// (the UK CAA's noise certificates), so a particular aircraft can be a class either side. A type not in the table (the
// A400M, which is not in EASA's civil databases) keeps the generic class by wake.
const QC_TYPE = {
  A319: [0.25, 0.5],  A320: [0.25, 0.5],  A321: [0.5, 1],    A20N: [0.125, 0.125], A21N: [0.25, 0.25],
  A332: [1, 2],       A333: [0.5, 2],     A339: [0.5, 1],    A359: [0.5, 0.5],     A35K: [0.5, 1],    A388: [0.5, 2],
  BCS1: [0.125, 0.125], BCS3: [0.125, 0.25], B738: [0.5, 0.5], B38M: [0.25, 0.25], B752: [0.25, 0.5], B763: [0.5, 1],
  B772: [1, 2],       B77W: [1, 2],       B788: [0.25, 0.5], B789: [0.5, 0.5],     B78X: [0.25, 0.5],
  E145: [0.125, 0.125], E190: [0.125, 0.5], E195: [0.125, 0.5], E295: [0.125, 0.125],
  E55P: [0, 0],       CL35: [0, 0.125],   FA7X: [0.125, 0.25], GLF6: [0, 0.125],   C56X: [0.125, 0],
  AT76: [0.125, 0.125], DH8D: [0.25, 0.125], PC12: [0, 0]
};
// the largest maximum take-off mass (kg) in the same EASA databases, for the types light enough to be let off a
// noise route by weight (the PC-12 from EASA's light propeller database); airliners are all far heavier
const MTOM = { PC12: 4740, E55P: 8415, C56X: 9222, CL35: 18416, E145: 22000, AT76: 23500, DH8D: 29574, FA7X: 31751, GLF6: 46992 };
const isProp = ac => ac.perf && ac.perf.shape === 'prop';
const mtomOf = ac => MTOM[ac.t] ?? 1e9;
// local time: minutes since local midnight, and whether it falls in a window [from, to) that may run past midnight
const nzMin = (ms = (S.start || 0) + S.t*1000) => { const d = new Date(ms + tzOffH(ms)*3600e3); return d.getUTCHours()*60 + d.getUTCMinutes(); };
const nzIn = ([a, b], m = nzMin()) => a <= b ? m >= a && m < b : m >= a || m < b;
const nzHM = m => String(Math.floor(m/60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
// The quota seasons are the scheduling seasons: summer from the last Sunday in March to the last Sunday in October
// (summer 2026: 29 March 01:00 to 25 October 00:59, the DfT notice para 2.1), winter the rest. A seasonal limit is
// shared out evenly over the season's nights to give one night's share, and that is the session's allowance (a session
// is part of one night): Heathrow's summer quota of 2,735 points over the 210 nights of summer 2026 is 13.0 a night.
const nzSun = (y, mo) => { const d = new Date(Date.UTC(y, mo + 1, 0, 1)); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); return +d; };
function noiseSeason(ms){
  const y = new Date(ms).getUTCFullYear(), a = nzSun(y, 2), b = nzSun(y, 9);
  if (ms >= a && ms < b) return { k: 'summer', nights: Math.round((b - a)/864e5) };
  const [s, e] = ms >= b ? [b, nzSun(y + 1, 2)] : [nzSun(y - 1, 9), a];
  return { k: 'winter', nights: Math.round((e - s)/864e5) };
}
// Each airport: night, its night period (complaints about noise routes are worse then); quotas, the night quota
// windows, each with seasonal QC (and movement) limits; npr(ac, m), the altitude (ft QNH) a departure must reach before
// it may be turned off its route at local minute m (0 for none); rwyNight, runways not to be used at night.
const GENERIC_NOISE = {   // no published figures: the old generic rules (4,000 ft routes; 20 QC points 23:00 to 06:00, by wake)
  generic: true, night: [23*60, 6*60], quotas: [{ name: 'night quota', at: [23*60, 6*60], cap: 20 }], npr: () => 4000
};
const NOISE_RULES = {
  // Heathrow. Night 23:00 to 07:00, night quota period 23:30 to 06:00 (EGLL AD 2.21 para 3.4; DfT decision of December
  // 2024, https://assets.publishing.service.gov.uk/media/6752c47114973821ce2a6c90/decision-night-flight-restrictions-
  // heathrow-gatwick-stansted-from-oct-25.pdf: the limits stay as they were from October 2025 to October 2028): summer
  // 3,250 movements and 2,735 QC points, winter 2,550 and 2,415. NPRs: a departure may be turned off its route once at
  // 4,000 ft (AD 2.21 note 9); propeller aircraft of 5,700 kg or less are not bound by the routes, nor between 06:00 and
  // 23:30 those of 17,000 kg or less (para 3.8). The westerly preference (27 used when the tailwind is 5 kt or less, AD
  // 2.20 para 6) and the night runway alternation are egll.js and egll-engine.js's.
  EGLL: { name: 'Heathrow', night: [23*60, 7*60],
    quotas: [{ name: 'night quota period', at: [23*60 + 30, 6*60], qc: { summer: 2735, winter: 2415 }, mv: { summer: 3250, winter: 2550 } }],
    npr: (ac, m) => isProp(ac) && (mtomOf(ac) <= 5700 || (nzIn([6*60, 23*60 + 30], m) && mtomOf(ac) <= 17000)) ? 0 : 4000 },
  // Gatwick. Night 23:00 to 07:00, night quota period 23:30 to 06:00 (EGKK AD 2.21 para 4); summer 11,200 movements and
  // 5,150 QC points, winter 3,250 and 1,785 (the DfT decision above). NPRs (AD 2.21 notes 8 and 9): between 23:30 and
  // 06:00 every departure may be turned off at 4,000 ft; between 06:00 and 23:30 departures from 26L at 4,000 ft except
  // the NOVMA, IMVUR, KENET and SAM SIDs (3,000 ft), and from 08R at 3,000 ft except via Seaford (4,000 ft). Propeller
  // aircraft as at Heathrow (para 8). No preferential runway is published: the wind decides.
  EGKK: { name: 'Gatwick', night: [23*60, 7*60],
    quotas: [{ name: 'night quota period', at: [23*60 + 30, 6*60], qc: { summer: 5150, winter: 1785 }, mv: { summer: 11200, winter: 3250 } }],
    npr: (ac, m) => {
      if (isProp(ac) && (mtomOf(ac) <= 5700 || (nzIn([6*60, 23*60 + 30], m) && mtomOf(ac) <= 17000))) return 0;
      if (nzIn([23*60 + 30, 6*60], m)) return 4000;
      const sid = String(ac.sid || '').replace(/\d.*$/, ''), rw = ac.depRwy || '';
      return /^08/.test(rw) ? (sid === 'SFD' ? 4000 : 3000) : (['NOVMA', 'IMVUR', 'KENET', 'SAM'].includes(sid) ? 3000 : 4000);
    } },
  // Manchester. Night 23:00 to 07:00, core night 23:30 to 06:00 (ACL's MAN Local Rule 1, September 2025, https://www.
  // acl-uk.org/wp-content/uploads/2025/10/MAN-Local-Rule-1-September-2025-final.pdf). Quota points
  // (ACL capacity declarations: summer 2026, https://www.acl-uk.org/wp-content/uploads/2025/10/MAN-S26-Capacity-
  // Declaration.pdf, and winter 2026/27, https://www.acl-uk.org/wp-content/uploads/2026/04/MAN-W26-Capacity-
  // Declaration.pdf): the night period 11,498 in summer and 7,788 in winter, the core night 7,000 and 3,000. No
  // movement limit is published for noise. NPRs (EGCC AD 2.21 para 2): each SID until passing its altitude, ASMIM,
  // DESIG, POL and SONEX 4,000 ft, EKLAD and KUXEM 3,000 ft, LISTO and SANBA 5,000 ft; aircraft of 5,700 kg or less are
  // not bound, and between 07:00 and 23:00 ATC may turn early propeller aircraft of 23,000 kg or less and jets of
  // 35,000 kg or less (with the Embraer 135/145, CRJs, BAe 146, Global Express and Gulfstream V). Runway 2 (23L/05R) is
  // not normally used from 22:00 to 06:00 (AD 2.21 para 4); the westerly preference is egcc-engine.js's rwyFor.
  EGCC: { name: 'Manchester', night: [23*60, 7*60],
    quotas: [{ name: 'night period', at: [23*60, 7*60], qc: { summer: 11498, winter: 7788 } },
             { name: 'core night', at: [23*60 + 30, 6*60], qc: { summer: 7000, winter: 3000 } }],
    npr: (ac, m) => {
      if (mtomOf(ac) <= 5700) return 0;
      if (nzIn([7*60, 23*60], m) && ((isProp(ac) && mtomOf(ac) <= 23000) || (!isProp(ac) && (mtomOf(ac) <= 35000 || ac.t === 'E145')))) return 0;
      const sid = String(ac.sid || '').replace(/\d.*$/, '');
      return { ASMIM: 4000, DESIG: 4000, POL: 4000, SONEX: 4000, EKLAD: 3000, KUXEM: 3000, LISTO: 5000, SANBA: 5000 }[sid] || 4000;
    },
    rwyNight: { at: [22*60, 6*60], rwys: ['23L', '05R'], why: 'runway 23L/05R is not normally used between 22:00 and 06:00; use 23R/05L' } },
  // Bristol. Night flying restrictions 23:00 to 07:00 and the night quota 23:30 to 06:00 (EGGD AD 2.21); 1,260 QC points
  // in summer and 900 in winter (https://www.bristolairport.co.uk/corporate/environment/aircraft-noise/night-flying/);
  // 3,500 night movements in summer 2026 (https://www.acl-uk.org/wp-content/uploads/2025/09/BRS-Capacity-Declaration-
  // S26-1.pdf). The winter declaration gives only 4,000 a year across a summer and a winter together, so no winter
  // movement limit is used. NPRs: for aircraft over 5,700 kg, ending at 4,000 ft (AD 2.21).
  EGGD: { name: 'Bristol', night: [23*60, 7*60],
    quotas: [{ name: 'night quota', at: [23*60 + 30, 6*60], qc: { summer: 1260, winter: 900 }, mv: { summer: 3500 } }],
    npr: ac => mtomOf(ac) <= 5700 ? 0 : 4000 },
  // Belfast International. No night quota and no noise planning conditions, and no SIDs, so no noise preferential routes
  // (its noise action plan 2018-23, https://www.belfastairport.com/media/2076/bia-end-round-3-noise-action-plan-
  // 2018-23-v3-draft.pdf). From 22:00 to 07:00 departures over 5,700 kg climb on the runway track to 2,000 ft before
  // any turn (EGAA AD 2.21 para 3).
  EGAA: { name: 'Belfast International', night: [22*60, 7*60], quotas: [],
    npr: (ac, m) => nzIn([22*60, 7*60], m) && mtomOf(ac) > 5700 ? 2000 : 0, what: 'turned off the runway track' },
  // Belfast City is open 06:30 to 21:30 (EGAC AD 2.3), so it has no night quota; no noise route altitude is published
  // for it, so the generic 4,000 ft is kept.
  EGAC: { name: 'Belfast City', generic: true, night: [23*60, 6*60], quotas: [], npr: () => 4000 },
  // London City is closed at night (EGLC AD 2.3: Monday to Friday 06:30 to 22:00, Saturday 06:30 to 12:30, Sunday
  // 12:30 to 22:00), so it has no night quota; its noise routes are in the SIDs, with no vectoring altitude published,
  // so the generic 4,000 ft is kept.
  EGLC: { name: 'London City', generic: true, night: [23*60, 6*60], quotas: [], npr: () => 4000 }
};
// the rules for an aircraft (Belfast's page has both airports) or for the page's airport
const noiseRules = ac => (ac && APT.apOf && NOISE_RULES[APT.apOf(ac)]) || NOISE_RULES[APT.icao] || GENERIC_NOISE;
const qcFmt = x => String(+x.toFixed(3));
// a quota's allowance for this session: one night's share of the season's limit (or the generic cap)
function quotaCap(Q, k){
  if (Q.cap != null) return k === 'qc' ? Q.cap : null;
  const s = noiseSeason((S.start || 0) + S.t*1000), lim = Q[k] && Q[k][s.k];
  return lim == null ? null : { cap: Math.round(lim/s.nights*10)/10, lim, season: s.k, nights: s.nights };
}
const NOISE = { q: [], over: 0 };
const noiseQ = i => NOISE.q[i] ||= { qc: 0, mv: 0 };
function noiseCmd(ac, toks){
  if (aiCtx || !ac || ac.kind !== 'DEP' || !ac.airborne || !toks.some(t => /^[HLR]\d{1,3}$/.test(t)) || ac.nprOff) return;
  const R = noiseRules(ac), m = nzMin(), alt = R.npr(ac, m);
  if (!alt || ac.alt >= alt) return;
  ac.nprOff = true;
  const n = nzIn(R.night, m), p = n ? 0.8 : 0.4;
  if (Math.random() < p) { const k = n ? 15 : 5; SC(ac).pts -= k; sys(`Noise: ${ac.cs} was ${R.what || 'turned off its noise preferential route'} at ${altShort(Math.round(ac.alt/100)*100)} (below ${alt.toLocaleString('en-GB')} ft${R.generic ? '' : ' at ' + R.name})${n ? ' at night' : ''}; complaints from under the new track (−${k}).`, true); }
}
function noiseMove(ac){
  if (aiOwns(ac)) return;
  const R = noiseRules(ac), arr = ac.kind === 'ARR', m = nzMin();
  if (R.rwyNight && nzIn(R.rwyNight.at, m) && !ac.nRwy) {
    const rw = arr ? ac.app || landRw(ac) : ac.depRwy || depRw(ac);
    if (R.rwyNight.rwys.includes(rw)) { ac.nRwy = true; SC(ac).pts -= 5; sys(`Noise: ${ac.cs} ${arr ? 'landed on' : 'departed from'} ${rw} at night: at ${R.name} ${R.rwyNight.why} (−5).`, true); }
  }
  const real = !R.generic && QC_TYPE[ac.t], q = real ? real[arr ? 0 : 1] : { J: 8, H: 4, M: 1, L: 0.5 }[ac.perf.wake] ?? 1;
  R.quotas.forEach((Q, i) => {
    if (!nzIn(Q.at, m)) return;
    const N = noiseQ(i); N.qc += q; N.mv++;
    const c = quotaCap(Q, 'qc'), v = quotaCap(Q, 'mv'), cq = c && (c.cap ?? c), why = c && c.lim ? ` (${R.name}'s ${c.season} quota of ${c.lim.toLocaleString('en-GB')} points over ${c.nights} nights)` : '';
    if (cq != null && N.qc > cq) { NOISE.over++; SC(ac).pts -= 20; sys(`Night quota exceeded: ${ac.cs} (${ac.t} ${arr ? 'landing' : 'take-off'}, QC/${qcFmt(q)}) takes the ${Q.name} to ${qcFmt(N.qc)} of ${cq} points${why} (−20). At night, keep the noisiest types for the morning if their slot allows.`, true); }
    if (v && N.mv > v.cap) { NOISE.over++; SC(ac).pts -= 20; sys(`Night movement limit exceeded: ${ac.cs} is movement ${N.mv} in the ${Q.name}, over tonight's ${v.cap} (${R.name}'s ${v.season} limit of ${v.lim.toLocaleString('en-GB')} over ${v.nights} nights) (−20).`, true); }
  });
}
function noisePanel(){
  const R = noiseRules(), m = nzMin(), L = [];
  R.quotas.forEach((Q, i) => {
    if (!nzIn(Q.at, m) && !nzIn(R.night, m)) return;
    const N = NOISE.q[i] || { qc: 0, mv: 0 }, c = quotaCap(Q, 'qc'), v = quotaCap(Q, 'mv');
    L.push(`Night quota${R.generic ? '' : `, ${Q.name} ${nzHM(Q.at[0])}–${nzHM(Q.at[1])}`}: ${qcFmt(N.qc)} of ${c && (c.cap ?? c)} QC points${v ? `, ${N.mv} of ${v.cap} movements` : ''} used${c && c.lim ? ` (tonight's share of the ${c.season} ${c.lim.toLocaleString('en-GB')})` : ''}`);
  });
  if (R.rwyNight && nzIn(R.rwyNight.at, m)) L.push(`Night: ${R.rwyNight.why}.`);
  return L.map(t => `<div class="warnline dimmer">${esc(t)}</div>`).join('');
}

S.listeners.push((ev, d) => {
  if (ev === 'start') {
    MOR.list = []; OJTI.said.clear(); OJTI.t = 0; NOISE.q = []; NOISE.over = 0;
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
