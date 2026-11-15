// ═════════════════════════ the arrival manager display (AMAN) ═════════════════════════
// A timeline of every inbound against its landing slot on each runway (menu › Arrival manager): a drawer beside the
// scope that can also go on its own page (Pop out). Time runs down the page from now; each flight's label sits at its
// slot, with a mark on the time line at its estimate, and shows the estimate, the slot, the delay still to absorb (and
// how: speed, the hold, or nothing), the wake category and the gap behind the one ahead. Flights you work that need
// something doing are coloured: red, a hold is needed (or the gap on the approach is short); amber, slow it down;
// blue, its delay is used up and it can leave the hold or turn in.
// The slots are the AI Approach's own plan (amanPlan in ai.js where the arrival manager runs, landOrder elsewhere),
// worked out here for every inbound whoever works it, without touching the AI's state. Drag a flight's label onto
// another's to swap their places in the order: the plan (and the AI Approach) then works to the new order.
const AM = { open: false, win: null, timer: 0, drag: null, last: null };
const AM_PX = 15;   // pixels a minute
const AM_LAB = 40;  // label height and the least space between two
const amIn = o => o.kind === 'ARR' && o.airborne && !o.handed && o.state !== 'DIVERTING' && o.need !== 'Unable approach' && !o.lost;
// the plan, worked out on a copy of the arrival manager's state (its order keys and cache put back as they were, so the
// AI's own plan and every seeded run are just as they would be without the display)
function amanSnap(){
  const all = S.acs.filter(amIn), cols = {};
  if (typeof AMAN_ON !== 'undefined' && AMAN_ON && typeof amanPlan === 'function') {
    const list = all.filter(o => !o.app || o.state === 'MISSED'), saved = AMAN, keys = list.map(a => [a, a.amKey, a.amGa]);
    for (const a of list) if (a.amKey == null && a.amVK != null) { a.amKey = a.amVK; a.amGa = a.amVGa; }
    AMAN = { t: -1, m: new Map(), line: {} };
    let line = {};
    try { amanPlan(list); line = AMAN.line; } catch (e) { line = {}; }
    finally { for (const [a, k, g] of keys) { if (k == null) { a.amVK = a.amKey; a.amVGa = a.amGa; } a.amKey = k; a.amGa = g; } AMAN = saved; }
    for (const id in line) {
      const R = rwyById(id), L = line[id].slice().sort((a, b) => a.t - b.t);
      cols[id] = { R, rows: L.map(e => {
        const F = FINAL[landRw(e.ac)], eta = e.fixed ? e.t : S.t + e.tMin;
        const route = e.fixed ? 0 : Math.max(0, e.tNow - e.tMin);   // the time it can lose just flying its route (a point merge arc)
        return { ac: e.ac, rw: landRw(e.ac), eta, sta: e.t, fixed: e.fixed, k: e.k, route, F };
      }) };
    }
  } else if (typeof landOrder === 'function') {
    const byR = {};
    for (const o of all) { const L = landOrder(o); if (!L) continue; const R = rwyOf(L.rw); (byR[R.id] ||= { R, rows: [] }).rows.push({ ac: o, rw: L.rw, eta: S.t + L.e, sta: S.t + L.t, fixed: !!o.app && o.state !== 'MISSED', k: amOrdK(o, L.e), route: 0, F: o.app ? finOf(o) : FINAL[L.rw] }); }
    for (const id in byR) cols[id] = byR[id];
  }
  // what each needs: the delay, how it is taken up, the gap behind the one ahead
  for (const id in cols) {
    const R = cols[id].R, rows = cols[id].rows.sort((a, b) => a.sta - b.sta);
    rows.forEach((r, i) => { r.prev = i ? rows[i - 1] : null; });
    for (const r of rows) {
      const ac = r.ac, mine = !(typeof aiOwns === 'function' && aiOwns(ac)), early = ac.state === 'PRE';
      r.delay = Math.max(0, r.sta - r.eta);
      let spd = 0; try { spd = r.F && typeof amanAbsorb === 'function' ? amanAbsorb(ac, r.F) : 0; } catch (e) {}
      r.how = r.fixed ? (ac.state === 'MISSED' ? 'go-around' : 'cleared') : r.delay < 20 ? 'none' : ac.mode === 'HOLD' ? 'hold' : r.delay <= r.route + 10 ? 'route' : r.delay <= r.route + spd ? 'speed' : 'hold';
      if (r.prev) { r.gap = r.sta - r.prev.sta; r.need = landGapS(r.prev.ac, ac, R); r.nm = r.gap*(ac.perf.vapp || 135)/3600; }
      // the colours: only flights you work (and that are on your frequency) need anything from you
      r.act = '';
      if (mine && !early) {
        if (r.fixed && r.prev && r.gap < r.need*0.9) r.act = 'red';
        else if (!r.fixed && r.how === 'hold' && ac.mode !== 'HOLD') r.act = 'red';
        else if (!r.fixed && r.how === 'speed' && !(ac.spdAssigned && ac.tgtSpd <= 220)) r.act = 'amber';
        else if (!r.fixed && ac.mode === 'HOLD' && r.delay < 45 && r === rows.find(x => !x.fixed)) r.act = 'blue';
      }
      r.mine = mine; r.early = early; r.lock = r.fixed || !!ac.emerg;
    }
  }
  return cols;
}
const amMS = s => { s = Math.round(s); const m = Math.floor(Math.abs(s)/60), x = Math.abs(s) % 60; return (s < 0 ? '−' : '') + m + ':' + String(x).padStart(2, '0'); };
const AM_HOW = { none: '—', route: 'route', speed: 'speed', hold: 'hold', cleared: 'cleared', 'go-around': 'go-around' };
function amanBody(narrow, cols){
  cols = cols || amanSnap(); const LAB = narrow ? 54 : AM_LAB;
  const ids = Object.keys(cols).filter(id => cols[id].rows.length);
  AM.last = cols;
  if (!S.running && !S.acs.length) return '<p class="dimmer am-empty">Start a session to see the arrivals.</p>';
  if (!ids.length) return '<p class="dimmer am-empty">No inbounds right now.</p>';
  const now = S.t, base = S.start/1000, t0 = Math.ceil((base + now)/60)*60 - base;   // the first whole minute on the clock
  return `<div class="am-key"><span class="am-k red">hold needed / gap short</span><span class="am-k amber">slow down</span><span class="am-k blue">can leave the hold</span><span class="am-k">drag a label onto another to swap them</span></div>
  <div class="am-cols">${ids.map(id => {
    const C = cols[id], rows = C.rows, end = Math.max(now + 30*60, ...rows.map(r => Math.max(r.sta, r.eta) + 180));
    const y = t => 18 + (t - now)/60*AM_PX;
    let ly = -1e9; const pos = rows.map(r => { const v = Math.max(y(r.sta) - LAB/2, ly + LAB + 2, 4); ly = v; return v; });
    const H = Math.max(y(end), ly + LAB + 10);
    let ticks = ''; for (let t = t0; t <= end; t += 60) { if (t <= now) continue; const m = Math.round((base + t)/60) % 60, big = m % 5 === 0; ticks += `<i class="am-tk${big ? ' big' : ''}" style="top:${y(t).toFixed(1)}px"></i>${big ? `<b class="am-tl" style="top:${(y(t) - 7).toFixed(1)}px">${zt(t).slice(0, 5)}</b>` : ''}`; }
    const rwys = [...new Set(rows.map(r => r.rw))].join(' / ');
    return `<section class="am-col" data-r="${esc(id)}"><div class="am-ch"><b>${esc(rwys)}</b><span>${rows.length} inbound${rows.length === 1 ? '' : 's'}</span></div>
      <div class="am-lad" style="height:${H.toFixed(0)}px"><div class="am-axis">${ticks}<i class="am-now" style="top:18px"></i><b class="am-tl now" style="top:2px">${zt(now).slice(0, 5)}</b></div>
      ${rows.map((r, i) => { const ac = r.ac, ys = y(r.sta), ye = y(r.eta), py = pos[i];
        const lead = `<i class="am-del" style="top:${Math.min(ye, ys).toFixed(1)}px;height:${Math.max(1, Math.abs(ys - ye)).toFixed(1)}px"></i><i class="am-eta" style="top:${(ye - 4).toFixed(1)}px"></i><i class="am-sta ${r.act}" style="top:${(ys - 4).toFixed(1)}px"></i>`;
        const line = `<svg class="am-ld" style="top:${Math.min(ys, py + LAB/2).toFixed(1)}px;height:${(Math.abs(ys - py - LAB/2) + 2).toFixed(1)}px" preserveAspectRatio="none" viewBox="0 0 10 10"><line x1="0" y1="${ys <= py + LAB/2 ? 0 : 10}" x2="10" y2="${ys <= py + LAB/2 ? 10 : 0}"/></svg>`;
        const short = r.prev && r.gap < r.need*0.9;
        return lead + line + `<div class="am-lab ${r.act}${r.lock ? ' fixed' : ''}${S.sel === ac ? ' sel' : ''}${r.mine ? '' : ' ai'}" data-cs="${esc(ac.cs)}" data-r="${esc(id)}" style="top:${py.toFixed(1)}px" title="${esc(ac.cs)}: ${r.fixed ? 'cleared for the approach' : ac.emerg ? 'emergency: first in' : 'drag onto another flight to swap them'}">
          ${r.lock ? '' : '<span class="am-grip" aria-hidden="true">⋮⋮</span>'}<div class="am-l1"><b>${i + 1}</b> <b class="am-cs">${esc(ac.cs)}</b> <span>${esc(ac.t || '')}/${esc(ac.perf.wake || 'M')}</span>${r.mine ? '' : ' <em>AI</em>'}${r.early ? ' <em>not yet with you</em>' : ''}${ac.emerg ? ' <em class="am-em">emergency</em>' : ''}${ac.mode === 'HOLD' ? ` <em>holding ${esc(ac.hold ? ac.hold.name : '')}</em>` : ''}${ac.amMoved && !r.fixed ? ' <em>moved</em>' : ''}</div>
          <div class="am-l2"><span>ETA ${zt(r.eta).slice(0, 5)}</span><span>slot ${zt(r.sta).slice(0, 5)}</span><span class="am-dl">${r.fixed ? AM_HOW[r.how] : r.delay < 20 ? 'on time' : '+' + amMS(r.delay) + ' ' + AM_HOW[r.how]}</span><span class="${short ? 'am-short' : ''}">${r.prev ? `gap ${amMS(r.gap)} · ${r.nm.toFixed(1)} NM` : 'first'}</span></div></div>`; }).join('')}
      </div></section>`; }).join('')}</div>`;
}
function amanRender(){
  if (AM.drag) return;   // not while a label is being dragged
  const on = AM.open || (AM.win && !AM.win.closed), cols = on ? amanSnap() : null;
  const d = document.getElementById('amandock'); if (d) { const b = d.querySelector('.am-body'), st = b.scrollTop, n = b.clientWidth < 420; b.classList.toggle('narrow', n); b.innerHTML = amanBody(n, cols); b.scrollTop = st; }
  if (AM.win && !AM.win.closed) { const b = AM.win.document.querySelector('.am-body'); if (b) { const st = AM.win.document.scrollingElement.scrollTop, n = b.clientWidth < 420; b.classList.toggle('narrow', n); b.innerHTML = amanBody(n, cols); AM.win.document.scrollingElement.scrollTop = st; } }
  if (!AM.open && !(AM.win && !AM.win.closed)) { clearInterval(AM.timer); AM.timer = 0; }
}
// swap two flights' places in the landing order (the plan is worked out again straight away)
function amanSwap(a, b){
  const cols = AM.last || amanSnap(); let ra, rb, C;
  for (const id in cols) for (const r of cols[id].rows) { if (r.ac === a) { ra = r; C = cols[id]; } if (r.ac === b) rb = r; }
  if (!ra || !rb || ra.lock || rb.lock) { sys('Only flights not yet cleared for the approach (and not in an emergency) can be moved in the order.', true); return false; }
  if (rwyOf(ra.rw).id !== rwyOf(rb.rw).id) { sys(`${a.cs} and ${b.cs} land on different runways.`, true); return false; }
  // the order on this runway as it is shown, with the two swapped, takes the same order keys in turn (so the rest of the
  // plan, and flights that turn up later, keep their places around them)
  const mov = C.rows.filter(r => !r.lock), keys = mov.map(r => r.k ?? r.sta).sort((x, y) => x - y);
  const ia = mov.indexOf(ra), ib = mov.indexOf(rb); mov[ia] = rb; mov[ib] = ra;
  mov.forEach((r, i) => { r.ac.amSeq = keys[i] + i*1e-3; });
  a.amMoved = b.amMoved = true;
  if (typeof AMAN !== 'undefined') AMAN.t = -1;
  if (S.landOrd) S.landOrd.t = -1;
  const first = ia < ib ? b : a, second = first === a ? b : a;
  sys(`Arrival manager: ${first.cs} now lands ahead of ${second.cs}.`);
  amanRender();
  return true;
}
// dragging a label (mouse, pen or a finger on its grip), in the drawer or the popped-out page
function amanDown(e){
  const lab = e.target.closest && e.target.closest('.am-lab'); if (!lab || lab.classList.contains('fixed')) return;
  if (e.pointerType === 'touch' && !e.target.closest('.am-grip')) return;   // a finger elsewhere on the label scrolls
  AM.drag = { lab, cs: lab.dataset.cs, r: lab.dataset.r, y0: e.clientY, top: parseFloat(lab.style.top), moved: false, doc: lab.ownerDocument };
  try { lab.setPointerCapture(e.pointerId); } catch (_) {}
  e.preventDefault();
}
function amanMove(e){
  const D = AM.drag; if (!D) return;
  const dy = e.clientY - D.y0; if (Math.abs(dy) > 4) D.moved = true;
  D.lab.style.top = (D.top + dy) + 'px'; D.lab.classList.add('drag');
  for (const n of D.doc.querySelectorAll('.am-lab.over')) n.classList.remove('over');
  const t = amanTarget(D, e.clientY); if (t) t.classList.add('over');
}
function amanTarget(D, cy){
  for (const n of D.doc.querySelectorAll(`.am-lab[data-r="${CSS.escape(D.r)}"]`)) { if (n === D.lab || n.classList.contains('fixed')) continue; const b = n.getBoundingClientRect(); if (cy >= b.top && cy <= b.bottom) return n; }
  return null;
}
function amanUp(e){
  const D = AM.drag; if (!D) return; AM.drag = null;
  const t = D.moved ? amanTarget(D, e.clientY) : null, a = S.acs.find(x => x.cs === D.cs);
  if (!D.moved) { if (a && typeof select === 'function') select(a); amanRender(); return; }
  const b = t && S.acs.find(x => x.cs === t.dataset.cs);
  if (a && b) amanSwap(a, b); else amanRender();
}
function amanWire(doc){
  doc.addEventListener('pointerdown', amanDown);
  doc.addEventListener('pointermove', amanMove);
  doc.addEventListener('pointerup', amanUp);
  doc.addEventListener('pointercancel', () => { AM.drag = null; amanRender(); });
}
amanWire(document);
function amanTick(){ if (!AM.timer) AM.timer = setInterval(amanRender, 1000); amanRender(); }
function amanOpen(){
  AM.open = true;
  let d = document.getElementById('amandock');
  if (!d) {
    d = document.createElement('aside'); d.id = 'amandock'; d.className = 'cb-drawer am-drawer'; d.setAttribute('aria-label', 'Arrival manager');
    d.innerHTML = `<div class="cb-top"><b>Arrival manager</b><span class="grow"></span><button type="button" class="btn ghost" data-am="pop">Pop out</button><button type="button" class="db-x" data-am="x" aria-label="Close">✕</button></div><div class="am-body cb-body"></div>`;
    document.body.appendChild(d);
    d.querySelector('[data-am="x"]').onclick = () => { d.remove(); AM.open = false; };
    d.querySelector('[data-am="pop"]').onclick = () => { d.remove(); AM.open = false; amanPop(); };
  }
  amanTick();
}
function amanPop(){
  if (AM.win && !AM.win.closed) { AM.win.focus(); return; }
  const w = popWin('cwAman', `${APT.icao} arrival manager`, 760, 900); if (!w) return;
  AM.win = w; w.document.body.innerHTML = `<div class="cb-page am-page"><div class="cb-top"><b>${esc(APT.name)} · arrival manager</b></div><div class="am-body"></div></div>`;
  amanWire(w.document);
  amanTick();
}
S.listeners.push(ev => { if (ev === 'start') { AM.drag = null; if (AM.open || AM.win) amanRender(); } });
{ const b = document.getElementById('tgAman'); if (b) b.onclick = () => amanOpen(); }
window.__aman = { snap: amanSnap, swap: amanSwap, open: amanOpen, pop: amanPop };
