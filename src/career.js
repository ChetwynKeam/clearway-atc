// ═════════════════════════ career log: time on frequency, score history, badges ═════════════════════════
// Kept in this browser's local storage. Each session is one entry, updated as it runs, so closing the tab keeps it.
const CAREER_KEY = 'cw-career';
const BADGES = [
  { id: 'first',    name: 'First contact',     d: 'Work a position for five minutes.',                          ic: 'M12 3v4M5 8l3 2M19 8l-3 2M7 17a5 5 0 0 1 10 0' },
  { id: 'wheels',   name: 'Wheels down',       d: 'Land your first arrival.',                                  ic: 'M3 17h18M6 13l4-1 6-6 2 1-4 6 4 1-1 2-6-1-4 1z' },
  { id: 'clean',    name: 'Clean shift',       d: '30 minutes and 6+ movements with no loss of separation or incident.', ic: 'M5 12l4 4 10-10' },
  { id: 'busy',     name: 'Busy Rock',         d: '20 movements in one session.',                              ic: 'M3 20l6-12 4 6 3-4 5 10z' },
  { id: 'levanter', name: 'Levanter tamer',    d: 'Land three aircraft in one session with a strong easterly.', ic: 'M3 8h12a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8' },
  { id: 'coolhead', name: 'Cool head',         d: 'Bring an emergency aircraft in safely.',                    ic: 'M12 3l9 16H3zM12 10v4M12 17v.5' },
  { id: 'goodcall', name: 'Good call',         d: 'Send an arrival around for a person on the runway.',        ic: 'M4 18c4-8 8-12 16-12M16 3l4 3-3 4' },
  { id: 'live',     name: 'Real world',        d: 'Work 15 minutes of Live now with real flights.',            ic: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18' },
  { id: 'graduate', ap: 'LXGB', name: 'Academy graduate',  d: 'Complete the three Gibraltar guided exercises.',                      ic: 'M2 9l10-5 10 5-10 5zM6 11v5c3 2 9 2 12 0v-5' },
  { id: 'hour',     name: 'One hour',          d: 'One hour on frequency in total.',                           ic: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z' },
  { id: 'ten',      name: 'Ten hours',         d: 'Ten hours on frequency in total.',                          ic: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM4 4l2 2M20 4l-2 2' },
  { id: 'century',  name: 'Century',           d: '100 movements in total.',                                   ic: 'M4 17V7M8 7h4v10H8zM14 7h4v10h-4z' },
  // each new airport adds one or two badges of its own; the logbook and the rest of the set are shared by every airport
  { id: 'rosario',  ap: 'LPMA', name: 'Rosário turn',   d: 'Land three aircraft on runway 05 at Madeira in one session.', ic: 'M4 20c0-8 6-14 16-14M16 3l4 3-4 3M4 20h6' },
  { id: 'island',   ap: 'LPMA', name: 'Island endorsement', d: 'Complete the three Madeira guided exercises.',           ic: 'M3 17c3-2 5-6 9-6s6 4 9 6M3 21h18M12 3v4' },
  { id: 'steep',    ap: 'EGLC', name: 'Five point five',    d: 'Land five arrivals on the 5.5° glidepath at London City in one session.', ic: 'M3 6l18 12M3 18h18M15 18a6 6 0 0 0-2-4.5' },
  { id: 'docklands', ap: 'EGLC', name: 'Docklands endorsement', d: 'Complete the three London City guided exercises.',    ic: 'M4 21V9h4v12M10 21V4h4v17M16 21v-8h4v8M2 21h20' },
  { id: 'foehn',    ap: 'LOWI', name: 'Föhn tamer',        d: 'Land three arrivals at Innsbruck in föhn conditions in one session.', ic: 'M3 8h11a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h8' },
  { id: 'valley',   ap: 'LOWI', name: 'Valley endorsement', d: 'Complete the three Innsbruck guided exercises.',         ic: 'M2 20l6-11 4 6 3-4 7 9zM8 9l2-4 2 4' },
  { id: 'crossing', ap: 'KJFK', name: 'Crossing guard',    d: 'Cross ten aircraft over an active runway at Kennedy in one session, with no incidents.', ic: 'M2 8h20M2 16h20M12 3v18M9 18l3 3 3-3' },
  { id: 'kennedy',  ap: 'KJFK', name: 'Kennedy endorsement', d: 'Complete the three New York JFK guided exercises.',     ic: 'M4 21V11l8-6 8 6v10M9 21v-6h6v6M2 21h20' },
  { id: 'gapfiller', ap: 'EGKK', name: 'Gap filler',       d: 'Fit a departure between two landings on Gatwick’s one runway ten times in one session.', ic: 'M2 12h20M5 8l-3 4 3 4M19 8l3 4-3 4M12 6v12' },
  { id: 'gatwick',  ap: 'EGKK', name: 'Gatwick endorsement', d: 'Complete the three London Gatwick guided exercises.',   ic: 'M3 18h18M5 18l3-9h8l3 9M9 9V5h6v4' },
  { id: 'sidebyside', ap: 'LEMD', name: 'Side by side',     d: 'Land five arrivals on each runway of a parallel pair at Madrid in one session.', ic: 'M7 21L10 3M14 21L17 3M3 21h18' },
  { id: 'barajas',  ap: 'LEMD', name: 'Barajas endorsement', d: 'Complete the three Madrid-Barajas guided exercises.',   ic: 'M2 16c4-4 8-6 10-6s6 2 10 6M2 20h20M6 16v4M12 10v10M18 16v4' }
];
const AP_NAME = { LXGB: 'Gibraltar', LPMA: 'Madeira', EGLC: 'London City', LOWI: 'Innsbruck', KJFK: 'New York JFK', EGKK: 'London Gatwick', LEMD: 'Madrid-Barajas' };
function careerLoad(){ try { const c = JSON.parse(localStorage.getItem(CAREER_KEY)); if (c && Array.isArray(c.sessions)) return { badges: {}, ex: {}, ...c }; } catch(e) {} return { sessions: [], badges: {}, ex: {} }; }
function careerSave(c){ try { localStorage.setItem(CAREER_KEY, JSON.stringify(c)); } catch(e) {} }
let CAR = careerLoad(), carCur = null, carDirty = false;
const carTotals = c => {
  const t = { secs: 0, mov: 0, n: c.sessions.length, best: null, land: 0, dep: 0 };
  for (const s of c.sessions) { t.secs += s.secs; t.mov += s.landed + s.departed; t.land += s.landed; t.dep += s.departed; if (t.best === null || s.pts > t.best) t.best = s.pts; }
  return t;
};
function careerAward(id){
  if (CAR.badges[id]) return;
  CAR.badges[id] = Date.now(); const b = BADGES.find(x => x.id === id);
  if (b && S.running) sys(`Badge earned: ${b.name}. ${b.d}`);
  carDirty = true;
}
function careerCheck(){
  const s = carCur, T = carTotals(CAR);
  if (s) {
    const mov = s.landed + s.departed;
    if (s.secs >= 300 && !s.ex) careerAward('first');
    if (s.landed >= 1) careerAward('wheels');
    if (s.secs >= 1800 && mov >= 6 && !s.los && !s.incidents) careerAward('clean');
    if (mov >= 20) careerAward('busy');
    if (s.levanter && s.landed >= 3) careerAward('levanter');
    if (s.emg >= 1) careerAward('coolhead');
    if (s.good >= 1) careerAward('goodcall');
    if (/^live/.test(s.mode) && s.secs >= 900) careerAward('live');
    if (s.ap === 'LPMA' && (s.l05 || 0) >= 3) careerAward('rosario');
    if (s.ap === 'EGLC' && s.landed >= 5) careerAward('steep');
    if (s.ap === 'LOWI' && (s.lfoehn || 0) >= 3) careerAward('foehn');
    if (s.ap === 'KJFK' && (s.rwyx || 0) >= 10 && !s.incidents) careerAward('crossing');
    if (s.ap === 'EGKK' && (s.gaps || 0) >= 10) careerAward('gapfiller');
    if (s.ap === 'LEMD' && s.lrw && [['32L', '32R'], ['18R', '18L']].some(([a, b]) => (s.lrw[a] || 0) >= 5 && (s.lrw[b] || 0) >= 5)) careerAward('sidebyside');
  }
  if (['dep','arr','lev'].every(k => CAR.ex[k])) careerAward('graduate');
  if (['mdep','marr','mwind'].every(k => CAR.ex[k])) careerAward('island');
  if (['cdep','carr','ceast'].every(k => CAR.ex[k])) careerAward('docklands');
  if (['idep','iarr','ifoehn'].every(k => CAR.ex[k])) careerAward('valley');
  if (['kdep','karr','kcross'].every(k => CAR.ex[k])) careerAward('kennedy');
  if (['gdep','garr','gmix'].every(k => CAR.ex[k])) careerAward('gatwick');
  if (['ldep','larr','lmix'].every(k => CAR.ex[k])) careerAward('barajas');
  if (T.secs >= 3600) careerAward('hour');
  if (T.secs >= 36000) careerAward('ten');
  if (T.mov >= 100) careerAward('century');
}
// called every frame with the real seconds that passed while the sim ran
function careerTick(dtr){
  if (!S.running || S.paused || !carCur) return;
  carCur.secs += dtr; carDirty = true;
}
function careerSync(){
  if (!carCur) return;
  const sc = S.score;
  Object.assign(carCur, { pts: sc.pts, landed: sc.landed, departed: sc.departed, ga: sc.ga, los: sc.los, incidents: sc.incidents + sc.infr, emg: S.emg ? S.emg.handled : 0, good: sc.good || 0 });
  if (carCur.secs >= 60 && !CAR.sessions.includes(carCur)) CAR.sessions.push(carCur);
  if (CAR.sessions.length > 200) CAR.sessions.splice(0, CAR.sessions.length - 200);
  careerCheck();
  if (carDirty) { careerSave(CAR); carDirty = false; }
}
S.listeners.push((ev, d) => {
  if (ev === 'landed' && carCur && d && d.app === '05' && APT.icao === 'LPMA') { carCur.l05 = (carCur.l05 || 0) + 1; carDirty = true; }
  if (ev === 'landed' && carCur && APT.icao === 'LOWI' && LOWI.isFoehn(S.wx)) { carCur.lfoehn = (carCur.lfoehn || 0) + 1; carDirty = true; }
  // Gatwick: a departure that got airborne between two landings fills a gap
  if (APT.icao === 'EGKK' && carCur && ev === 'airborne' && d && d.kind === 'DEP' && carCur.land1) carCur.depGap = true;
  if (APT.icao === 'EGKK' && carCur && ev === 'landed') { if (carCur.depGap) { carCur.gaps = (carCur.gaps || 0) + 1; carDirty = true; } carCur.land1 = true; carCur.depGap = false; }
  // Madrid: landings on each runway, for Side by side
  if (APT.icao === 'LEMD' && carCur && ev === 'landed' && d && d.app) { (carCur.lrw ||= {})[d.app] = (carCur.lrw[d.app] || 0) + 1; carDirty = true; }
  if (ev === 'rwyx' && carCur) { carCur.rwyx = (carCur.rwyx || 0) + 1; carDirty = true; }
  if (ev === 'start') {
    careerSync();
    const w = S.wx, lev = w.dir >= 40 && w.dir <= 140 && w.spd >= 18;
    carCur = { at: Date.now(), mode: S.mode, ex: !!EXERCISES[S.mode], ap: APT.icao, wx: w.raw.split(' ').slice(2, 3).join(''), rwy: S.rwy, levanter: lev, secs: 0, pts: 0, landed: 0, departed: 0, ga: 0, los: 0, incidents: 0, emg: 0, good: 0 };
  }
});
setInterval(careerSync, 15000);
addEventListener('pagehide', careerSync);
function careerExercise(ex){ if (!CAR.ex[ex]) { CAR.ex[ex] = Date.now(); carDirty = true; careerSync(); } }

// ── career page ──
const fmtHrs = s => s < 3600 ? `${Math.round(s/60)} min` : `${(s/3600).toFixed(s < 36000 ? 1 : 0)} h`;
const MODE_NAME = { live: 'Live now', liveplus: 'Live now +', real: 'Timetable', summer: 'Summer', event: 'Event', custom: 'Custom', dep: 'Exercise 1', arr: 'Exercise 2', lev: 'Exercise 3',
  mdep: 'Exercise 1', marr: 'Exercise 2', mwind: 'Exercise 3', cdep: 'Exercise 1', carr: 'Exercise 2', ceast: 'Exercise 3', idep: 'Exercise 1', iarr: 'Exercise 2', ifoehn: 'Exercise 3', kdep: 'Exercise 1', karr: 'Exercise 2', kcross: 'Exercise 3',
  gdep: 'Exercise 1', garr: 'Exercise 2', gmix: 'Exercise 3' };
function renderCareer(){
  careerSync();
  const T = carTotals(CAR), L = CAR.sessions.slice().reverse();
  $('crStats').innerHTML = [
    ['On frequency', fmtHrs(T.secs)], ['Sessions', T.n], ['Movements', T.mov], ['Best score', T.best ?? '–'], ['Airports', new Set(CAR.sessions.map(x => x.ap || 'LXGB')).size || '–'], ['Badges', `${Object.keys(CAR.badges).length} / ${BADGES.length}`]
  ].map(([k, v]) => `<div class="cr-stat"><div class="lbl">${k}</div><div class="v">${v}</div></div>`).join('');
  // score history: last 24 sessions, bars to one scale with a zero line
  const H = CAR.sessions.slice(-24), W = Math.max(340, $('crChart').clientWidth || 720), Ht = 220, pad = { l: 44, r: 12, t: 14, b: 26 };
  let svg = '';
  if (H.length) {
    const hi = Math.max(50, ...H.map(s => s.pts)), lo = Math.min(0, ...H.map(s => s.pts));
    const step = (hi - lo) > 400 ? 200 : (hi - lo) > 200 ? 100 : 50;
    const top = Math.ceil(hi/step)*step, bot = Math.floor(lo/step)*step;
    const y = v => pad.t + (top - v)/(top - bot)*(Ht - pad.t - pad.b), bw = (W - pad.l - pad.r)/Math.max(H.length, 8);
    for (let v = bot; v <= top; v += step) svg += `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" class="${v === 0 ? 'zero' : 'grid'}"/><text x="${pad.l - 8}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
    H.forEach((s, i) => {
      const x = pad.l + i*bw + bw*0.18, w = bw*0.64, y0 = y(0), y1 = y(s.pts);
      svg += `<rect x="${x.toFixed(1)}" y="${Math.min(y0, y1).toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(1, Math.abs(y1 - y0)).toFixed(1)}" rx="2" class="${s.pts < 0 ? 'neg' : s.ex ? 'ex' : 'pos'}"><title>${new Date(s.at).toLocaleDateString('en-GB')} · ${AP_NAME[s.ap || 'LXGB'] || s.ap} · ${MODE_NAME[s.mode] || s.mode} · ${s.pts} pts</title></rect>`;
      if (H.length*46 <= W || i % 2 === 0) svg += `<text x="${(x + w/2).toFixed(1)}" y="${Ht - 8}" text-anchor="middle">${new Date(s.at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</text>`;
    });
  }
  $('crChart').innerHTML = H.length ? `<svg viewBox="0 0 ${W} ${Ht}" role="img" aria-label="Score per session">${svg}</svg>` : `<p class="empty">No sessions yet. Work a position for a minute or more and it appears here.</p>`;
  $('crBadges').innerHTML = BADGES.map(b => { const got = CAR.badges[b.id]; return `<div class="cr-badge ${got ? 'got' : ''}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${b.ic}"/></svg><div><b>${b.name}</b>${b.ap ? `<span class="cr-ap">${AP_NAME[b.ap]}</span>` : ''}<p>${b.d}</p><span class="lbl">${got ? 'Earned ' + new Date(got).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Locked'}</span></div></div>`; }).join('');
  $('crTable').innerHTML = L.length ? `<table><tr><th>Date</th><th>Airport</th><th>Session</th><th>Runway</th><th class="n">Time</th><th class="n">Landed</th><th class="n">Departed</th><th class="n">Go-arounds</th><th class="n">LoS / incidents</th><th class="n">Score</th></tr>${L.slice(0, 30).map(s => `<tr><td>${new Date(s.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td><td class="mono">${s.ap || 'LXGB'}</td><td>${MODE_NAME[s.mode] || esc(s.mode)}</td><td class="mono">${s.rwy}</td><td class="n">${fmtHrs(s.secs)}</td><td class="n">${s.landed}</td><td class="n">${s.departed}</td><td class="n">${s.ga}</td><td class="n">${s.los} / ${s.incidents}</td><td class="n ${s.pts < 0 ? 'bad' : ''}"><b>${s.pts}</b></td></tr>`).join('')}</table>` : '';
  const rb = $('crReset'), rc = $('crResetConfirm');
  rb.onclick = () => { rc.hidden = false; rb.hidden = true; };
  rc.querySelector('[data-a=no]').onclick = () => { rc.hidden = true; rb.hidden = false; };
  rc.querySelector('[data-a=yes]').onclick = () => { CAR = { sessions: [], badges: {}, ex: {} }; carCur = null; careerSave(CAR); rc.hidden = true; rb.hidden = false; renderCareer(); };
}
