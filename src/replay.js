// ═════════════════════════ Replay and debrief ═════════════════════════
// The session is recorded as it runs: every aircraft's position, level and heading every 5 s (REC.frames, up to four
// hours), and the moments that matter (REC.events): losses of separation, go-arounds, runway incursions, emergencies,
// landings and departures. The debrief (menu › Debrief) plays it back on a small radar picture with a timeline
// marked with those moments; clicking one jumps there and shows what an assessor would say about it.
const REC = { frames: [], events: [], lastT: -1e9 };
const REC_DT = 5, REC_MAX = 2880;
function recStep(){
  if (!S.running || S.t - REC.lastT < REC_DT) return;
  REC.lastT = S.t;
  const a = [];
  for (const ac of S.acs) {
    if (ac.state === 'PRE' || (typeof dormant === 'function' && dormant(ac))) continue;
    a.push([ac.cs, Math.round(ac.x*1000)/1000, Math.round(ac.y*1000)/1000, Math.round(ac.alt), Math.round(ac.hdg), ac.kind === 'ARR' ? 1 : 0, ac.ground ? 1 : 0, aiOwns(ac) ? 1 : 0]);
  }
  REC.frames.push({ t: S.t, a });
  if (typeof CH !== 'undefined') for (const k in CH) chOcc(k);   // keeps each frequency's busiest ten minutes
  if (REC.frames.length > REC_MAX) REC.frames.shift();
}
// the frame nearest time t
function recAt(t){
  const F = REC.frames; if (!F.length) return null;
  let lo = 0, hi = F.length - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (F[m].t < t) lo = m + 1; else hi = m; }
  return lo > 0 && Math.abs(F[lo - 1].t - t) < Math.abs(F[lo].t - t) ? F[lo - 1] : F[lo];
}
const recPos = (f, cs) => f && f.a.find(r => r[0] === cs);

// ── what an assessor would say ──
function losNote(e){
  const f = recAt(e.t - 60), A = recPos(f, e.cs[0]), B = recPos(f, e.cs[1]);
  let before = '';
  if (A && B) { const d = Math.hypot(A[1] - B[1], A[2] - B[2]), dz = Math.abs(A[3] - B[3]); before = ` A minute before, they were ${d.toFixed(1)} NM and ${Math.round(dz/100)*100} ft apart: that was the moment to act.`; }
  return `They came within ${e.d.toFixed(1)} NM and ${Math.round(e.dz/100)*100} ft. The minimum is 3 NM or 1,000 ft (2.5 NM between two established on the same final).${before} Turn one away, or stop one's climb or descent a thousand feet clear of the other, before their paths meet; a level-off takes effect faster than a turn.`;
}
function gaNote(why){
  const w = String(why || '');
  if (/landing clearance/.test(w)) return 'It reached the minimum without a landing clearance. Clear it to land by about 2 NM, or earlier with "after the landing / departing traffic, cleared to land" when the runway will be free.';
  if (/occupied|vehicle on the runway|people on/.test(w)) return 'The runway was not free in time. With a departure going between two arrivals, about 6 NM between the arrivals is the usual gap; or hold the departure, or slow the arrival early.';
  if (/too high|unstable/.test(w)) return 'It arrived too high to land. Give the descent earlier: about 300 ft for every mile to go, and keep the speed down to 160 kt by 4 NM.';
  if (/^minima, low visibility procedures/.test(w)) return 'The crew could not fly a CAT II or III approach because low visibility procedures had not been declared. Declare LVP as soon as the RVR drops below 600 m.';
  if (/visual|minimums|minima|weather|wind|shear|turbulence/.test(w)) return 'Weather: the crew could not land safely. Nothing to have done differently, except to brief the next arrivals and consider the other runway or a diversion.';
  if (!w) return 'A go-around: plan the missed approach traffic so it has somewhere to climb to.';
  return `The crew went around (${w}). Look at what happened in the two minutes before it.`;
}
const INC_NOTE = 'Something was on the runway without a clearance to be there. Before clearing an aircraft to cross or enter, check the runway both ways, and hold short anything that could reach it while another is landing or taking off.';
S.listeners.push((ev, d) => {
  if (ev === 'start') { REC.frames = []; REC.events = []; REC.lastT = -1e9; return; }
  const add = (k, o) => REC.events.push({ t: S.t, k, ...o });
  if (ev === 'los' && d) add('los', { cs: [d.a.cs, d.b.cs], d: d.d, dz: d.dz, ai: !!d.ai });
  else if (ev === 'ga' && d) add('ga', { cs: [d.cs], why: d.gaWhy || '', ai: aiOwns(d) });
  else if (ev === 'incursion' && d) add('inc', { cs: [d.cs || ''], ai: aiOwns(d) });
  else if (ev === 'emergency' && d) add('emg', { cs: [d.cs], ai: aiOwns(d), why: d.emerg ? `${d.emerg.k}: ${d.emerg.why}` : '' });
  else if (ev === 'landed' && d) add('land', { cs: [d.cs] });
  else if (ev === 'takeoff' && d) add('dep', { cs: [d.cs] });
});
const EV_INFO = { los: ['Loss of separation', '#e5484d'], ga: ['Go-around', '#f0a020'], inc: ['Runway incursion', '#e5484d'], emg: ['Emergency', '#a855f7'], land: ['Landed', '#2f9e6a'], dep: ['Departed', '#3b82f6'] };
function evNote(e){ return e.k === 'los' ? losNote(e) : e.k === 'ga' ? gaNote(e.why) : e.k === 'inc' ? INC_NOTE : e.k === 'emg' ? (e.why ? e.why.replace(/[.\s]*$/, '.') : 'An emergency.') + ' Priority to it: a clear runway, the fire service told, and the traffic around it moved out of its way.' : ''; }
function evText(e){ return `${EV_INFO[e.k][0]}: ${e.cs.filter(Boolean).join(' and ')}${e.k === 'ga' && e.why ? ` (${e.why})` : ''}${e.ai ? ' · AI seat' : ''}`; }

// the busiest ten minutes each frequency had
const freqPeaks = () => { const L = typeof CH === 'undefined' ? [] : AI_SEATS.filter(k => CH[k] && CH[k].peak > 0).map(k => `${AI_NAME[k]} ${Math.round(CH[k].peak*100)}%`); return L.length ? ` · busiest frequency use: ${L.join(', ')}` : ''; };
// ── the debrief window ──
let DB = null;
function openDebrief(){
  if (!REC.frames.length) { sys('Nothing recorded yet: the debrief replays the session once it has been running.'); return; }
  closeDebrief();
  const wasPaused = S.paused; S.paused = true;
  const box = document.createElement('div'); box.className = 'debrief'; box.id = 'debrief';
  const key = ['los', 'ga', 'inc', 'emg'], allAI = AI_SEATS.every(k => S.seats[k] === 'AI'), mine = REC.events.filter(e => key.includes(e.k) && (!e.ai || allAI));
  const sc = allAI ? S.aiScore : S.score;
  box.innerHTML = `<div class="db-card" role="dialog" aria-label="Debrief">
    <div class="db-hd"><b>Debrief</b><span class="db-sum">${sc.landed} landed · ${sc.departed} departed · ${sc.ga} go-arounds · ${sc.los} losses of separation · ${sc.incidents} incidents · ${sc.pts} pts${allAI ? ' (AI)' : ''}${freqPeaks()}</span><span class="grow"></span><button type="button" class="db-x" aria-label="Close">✕</button></div>
    <div class="db-body"><div class="db-view"><canvas class="db-cv"></canvas><div class="db-zoom"><button type="button" data-z="1.6">+</button><button type="button" data-z="0.625">−</button></div></div>
      <div class="db-side"><p class="db-lead">${mine.length ? `${mine.length} moment${mine.length > 1 ? 's' : ''} to look at. Pick one to see it and what an assessor would say.` : 'No losses of separation, go-arounds or incursions on your positions: a clean session.'}${allAI ? ' (Every position was on AI.)' : ''}</p>${typeof ojtiReport === 'function' ? ojtiReport() : ''}<ol class="db-list"></ol><div class="db-note" hidden></div></div></div>
    <div class="db-ctl"><button type="button" class="db-play">Play</button><button type="button" class="db-spd">8×</button><span class="db-t"></span><div class="db-tl"><input type="range" class="db-rng" min="0" max="${REC.frames.length - 1}" value="${REC.frames.length - 1}" aria-label="Time"><div class="db-marks"></div></div></div>
  </div>`;
  document.body.appendChild(box);
  const q = s => box.querySelector(s), cv = q('.db-cv'), rng = q('.db-rng');
  const t0 = REC.frames[0].t, t1 = REC.frames[REC.frames.length - 1].t;
  DB = { box, cv, rng, i: REC.frames.length - 1, play: false, spd: 8, zoom: 1, c: [...RADAR_REF], wasPaused, sel: null, raf: 0, last: 0 };
  // the timeline: a tick for each moment, coloured by kind (landings and departures small)
  const marks = q('.db-marks');
  for (const e of REC.events) {
    const m = document.createElement('i'); m.className = 'db-m ' + e.k; m.style.left = `${(100*(e.t - t0)/Math.max(1, t1 - t0)).toFixed(2)}%`; m.style.background = EV_INFO[e.k][1]; m.title = `${zt(e.t).slice(0, 5)} ${evText(e)}`;
    marks.appendChild(m);
  }
  const list = q('.db-list');
  for (const e of REC.events.filter(e => key.includes(e.k))) {
    const li = document.createElement('li'); li.className = 'db-ev' + (e.ai ? ' ai' : '');
    li.innerHTML = `<span class="db-dot" style="background:${EV_INFO[e.k][1]}"></span><span class="db-tm">${zt(e.t).slice(0, 5)}</span><span class="db-tx"></span>`;
    li.querySelector('.db-tx').textContent = evText(e);
    li.onclick = () => { list.querySelectorAll('.on').forEach(x => x.classList.remove('on')); li.classList.add('on'); dbJump(e); };
    list.appendChild(li);
  }
  q('.db-x').onclick = closeDebrief;
  box.onclick = e => { if (e.target === box) closeDebrief(); };
  q('.db-play').onclick = () => { DB.play = !DB.play; if (DB.play && DB.i >= REC.frames.length - 1) DB.i = 0; q('.db-play').textContent = DB.play ? 'Pause' : 'Play'; };
  q('.db-spd').onclick = () => { DB.spd = DB.spd === 8 ? 30 : DB.spd === 30 ? 2 : 8; q('.db-spd').textContent = DB.spd + '×'; };
  rng.oninput = () => { DB.i = +rng.value; DB.play = false; q('.db-play').textContent = 'Play'; dbDraw(); };
  box.querySelectorAll('[data-z]').forEach(b => b.onclick = () => { DB.zoom = clamp(DB.zoom*+b.dataset.z, 0.25, 40); dbDraw(); });
  // drag to pan
  let drag = null;
  cv.onpointerdown = e => { drag = [e.clientX, e.clientY, ...DB.c]; cv.setPointerCapture(e.pointerId); };
  cv.onpointermove = e => { if (!drag) return; const k = dbScale(); DB.c = [drag[2] - (e.clientX - drag[0])/k, drag[3] + (e.clientY - drag[1])/k]; dbDraw(); };
  cv.onpointerup = () => { drag = null; };
  cv.onwheel = e => { e.preventDefault(); DB.zoom = clamp(DB.zoom*(e.deltaY < 0 ? 1.2 : 1/1.2), 0.25, 40); dbDraw(); };
  addEventListener('keydown', dbKey);
  const tick = now => { if (!DB) return; DB.raf = requestAnimationFrame(tick); const dt = DB.last ? (now - DB.last)/1000 : 0; DB.last = now;
    if (DB.play) { DB.acc = (DB.acc || 0) + dt*DB.spd/REC_DT; while (DB.acc >= 1) { DB.acc--; if (DB.i < REC.frames.length - 1) DB.i++; else { DB.play = false; q('.db-play').textContent = 'Play'; } } rng.value = DB.i; dbDraw(); } };
  DB.raf = requestAnimationFrame(tick);
  dbDraw();
}
function dbKey(e){ if (e.key === 'Escape' && DB) closeDebrief(); }
function closeDebrief(){
  if (!DB) return;
  cancelAnimationFrame(DB.raf); removeEventListener('keydown', dbKey);
  DB.box.remove(); S.paused = DB.wasPaused; DB = null;
}
// a moment picked: back 90 s before it, centred between those involved, playing up to it, with the note
function dbJump(e){
  const f = recAt(e.t), ps = e.cs.map(cs => recPos(f, cs)).filter(Boolean);
  if (ps.length) { DB.c = [ps.reduce((s, p) => s + p[1], 0)/ps.length, ps.reduce((s, p) => s + p[2], 0)/ps.length]; DB.zoom = ps.some(p => p[6]) ? 12 : 3; }
  DB.sel = new Set(e.cs);
  const target = REC.frames.indexOf(recAt(e.t - 90)); DB.i = Math.max(0, target); DB.play = true; DB.box.querySelector('.db-play').textContent = 'Pause';
  const n = DB.box.querySelector('.db-note'); n.hidden = false; n.innerHTML = `<b></b><p></p>`; n.querySelector('b').textContent = `${zt(e.t).slice(0, 5)} · ${evText(e)}`; n.querySelector('p').textContent = evNote(e);
  dbDraw();
}
// NM per pixel: 60 NM across at zoom 1
function dbScale(){ const w = DB.cv.clientWidth || 600; return w/60*DB.zoom; }
function dbDraw(){
  if (!DB) return;
  const cv = DB.cv, dpr = window.devicePixelRatio || 1, w = cv.clientWidth || 600, h = cv.clientHeight || 400;
  if (cv.width !== Math.round(w*dpr) || cv.height !== Math.round(h*dpr)) { cv.width = Math.round(w*dpr); cv.height = Math.round(h*dpr); }
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0);
  const k = dbScale(), X = x => w/2 + (x - DB.c[0])*k, Y = y => h/2 - (y - DB.c[1])*k;
  g.fillStyle = '#0d1b24'; g.fillRect(0, 0, w, h);
  // range rings every 10 NM round the field, and the runways
  g.strokeStyle = 'rgba(120,170,200,.18)'; g.lineWidth = 1;
  for (let r = 10; r <= 60; r += 10) { g.beginPath(); g.arc(X(RADAR_REF[0]), Y(RADAR_REF[1]), r*k, 0, 7); g.stroke(); }
  g.strokeStyle = '#c9d6df'; g.lineWidth = Math.max(2, 45/1852*k);
  for (const R of RWYS) { try { const a = R.rm(0, 0), b = R.rm(R.len || (typeof RWY_M !== 'undefined' ? RWY_M : 2000), 0); g.beginPath(); g.moveTo(X(a[0]), Y(a[1])); g.lineTo(X(b[0]), Y(b[1])); g.stroke(); } catch (e) {} }
  const f = REC.frames[DB.i]; if (!f) return;
  // trails: the last minute
  const trail = REC.frames.slice(Math.max(0, DB.i - 12), DB.i);
  g.fillStyle = 'rgba(160,200,230,.45)';
  for (const T of trail) for (const r of T.a) if (!r[6]) { g.fillRect(X(r[1]) - 1, Y(r[2]) - 1, 2, 2); }
  g.font = '11px ui-monospace, monospace'; g.textBaseline = 'middle';
  for (const r of f.a) {
    const [cs, x, y, alt, hdg, arr, gnd, ai] = r, sx = X(x), sy = Y(y);
    if (sx < -40 || sy < -40 || sx > w + 40 || sy > h + 40) continue;
    const hot = DB.sel && DB.sel.has(cs), col = hot ? '#ffd23f' : gnd ? '#8aa0ad' : arr ? '#7cc4ff' : '#9be38f';
    g.save(); g.translate(sx, sy); g.rotate(hdg*Math.PI/180); g.fillStyle = col; g.beginPath(); g.moveTo(0, -6); g.lineTo(4, 5); g.lineTo(-4, 5); g.closePath(); g.fill(); g.restore();
    if (gnd && DB.zoom < 6 && !hot) continue;
    g.fillStyle = col; g.fillText(`${cs}${ai ? '·AI' : ''}`, sx + 8, sy - 6);
    if (!gnd) g.fillText(String(Math.round(alt/100)).padStart(3, '0'), sx + 8, sy + 7);
  }
  DB.box.querySelector('.db-t').textContent = `${zt(f.t).slice(0, 8)}Z`;
}
{ const b = document.getElementById('tgDebrief'); if (b) b.onclick = () => openDebrief(); }
