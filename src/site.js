// ═════════════════════════ site: routing, overview, training, coach ═════════════════════════
const ROUTES = ['home', 'airports', 'lxgb', 'sim', 'training'];
let curRoute = null;
function go(r){
  if (!ROUTES.includes(r)) r = 'home';
  if (r === curRoute) return;
  const prev = curRoute; curRoute = r;
  document.body.dataset.route = r;
  document.querySelectorAll('[data-page]').forEach(p => p.hidden = p.dataset.page !== r);
  document.querySelectorAll('.nav [data-route]').forEach(a => a.classList.toggle('on', a.dataset.route === r));
  if (r === 'sim') { resize(); if (!S.running) setView(V.name || 'app'); }
  if (prev === 'sim' && r !== 'sim') exitFull();
  if (r !== 'sim' && prev === 'sim' && S.running && !S.paused) { S.paused = true; $('tgPause').textContent = 'Resume'; sys('Simulation paused while you are away from the scope.'); }
  if (r === 'home' || r === 'lxgb') requestAnimationFrame(renderThumbs);
  if (r === 'training') requestAnimationFrame(() => { renderFigure(); spy(); });
  window.scrollTo(0, 0);
}
function fromHash(){
  const h = location.hash.replace('#', '');
  if (ROUTES.includes(h)) return go(h);
  const el = h && document.getElementById(h);
  if (el && el.closest('[data-page="training"]')) { go('training'); requestAnimationFrame(() => el.scrollIntoView()); return; }
  go(curRoute || 'home');
}
window.addEventListener('hashchange', fromHash);

// top bar clock: real UTC, so the site feels like a live position
function topClock(){ const d = new Date(); $('topClock').textContent = 'UTC ' + d.toISOString().substr(11,5) + 'Z'; }
setInterval(topClock, 10000); topClock();

// ── airport network ──
// Only LXGB is built. The rest are the roadmap: real airports and runway designators, no invented performance data.
const AIRPORTS_NET = [
  { icao:'LXGB', iata:'GIB', name:'Gibraltar', ctry:'Gibraltar (UK)', region:'Europe', rwys:['09/27'], status:'live', pos:['APP','TWR','GND'], diff:4, blurb:'A public road across the runway, the levanter off the Rock, and Spanish restricted airspace at the fence.' },
  { icao:'EGLC', iata:'LCY', name:'London City', ctry:'United Kingdom', region:'UK & Ireland', rwys:['09/27'], status:'dev', pos:['TWR','GND'], diff:3, blurb:'Steep approaches between the Docklands towers, a short runway and a tight apron.' },
  { icao:'LPMA', iata:'FNC', name:'Madeira', ctry:'Portugal', region:'Europe', rwys:['05/23'], status:'dev', pos:['APP','TWR'], diff:5, blurb:'A runway extended over the sea on columns, strict wind limits, and a visual turn onto 05 past the cliffs.' },
  { icao:'LOWI', iata:'INN', name:'Innsbruck', ctry:'Austria', region:'Europe', rwys:['08/26'], status:'plan', pos:['APP','TWR'], diff:5, blurb:'Approaches down the Inn valley with terrain on every side and foehn winds off the Alps.' },
  { icao:'LFMN', iata:'NCE', name:'Nice Côte d’Azur', ctry:'France', region:'Europe', rwys:['04L/22R','04R/22L'], status:'plan', pos:['APP','TWR','GND'], diff:3, blurb:'Parallel runways on reclaimed land, approaches along the coast, and the Alps close to the north.' },
  { icao:'LEMG', iata:'AGP', name:'Málaga', ctry:'Spain', region:'Europe', rwys:['13/31','12/30'], status:'plan', pos:['APP','TWR','GND'], diff:3, blurb:'Gibraltar’s busy neighbour: summer peaks, two runways and the Costa del Sol sea breeze.' },
  { icao:'EGLL', iata:'LHR', name:'London Heathrow', ctry:'United Kingdom', region:'UK & Ireland', rwys:['09L/27R','09R/27L'], status:'plan', pos:['APP','TWR','GND'], diff:5, blurb:'Four holding stacks, runway alternation and a heavy wake mix on two parallel runways.' },
  { icao:'EGKK', iata:'LGW', name:'London Gatwick', ctry:'United Kingdom', region:'UK & Ireland', rwys:['08R/26L','08L/26R'], status:'plan', pos:['TWR','GND'], diff:4, blurb:'One of the busiest single-runway operations in the world. Every gap in the departure flow counts.' },
  { icao:'TNCM', iata:'SXM', name:'Princess Juliana', ctry:'Sint Maarten', region:'Caribbean', rwys:['10/28'], status:'plan', pos:['APP','TWR'], diff:3, blurb:'Low arrivals over Maho Beach, Caribbean squalls and a single runway between the sea and the lagoon.' },
  { icao:'VQPR', iata:'PBH', name:'Paro', ctry:'Bhutan', region:'Asia', rwys:['15/33'], status:'plan', pos:['TWR'], diff:5, blurb:'A visual approach through a Himalayan valley, with daylight-only operations.' },
  { icao:'KSAN', iata:'SAN', name:'San Diego', ctry:'United States', region:'North America', rwys:['09/27'], status:'plan', pos:['APP','TWR','GND'], diff:3, blurb:'A busy single runway, with downtown buildings under the approach to 27.' },
  { icao:'LGSK', iata:'JSI', name:'Skiathos', ctry:'Greece', region:'Europe', rwys:['02/20'], status:'plan', pos:['TWR'], diff:3, blurb:'A short island runway that ends at the sea, with summer charter waves.' }
];
const STATUS_TXT = { live: 'Open now', dev: 'In development', plan: 'Planned' };
// runway diagram drawn from the designators: heading = number × 10, parallels offset left/right
function rwyDiagram(ap){
  const W = 300, H = 150, cx0 = W/2, cy0 = H/2, L = 104, out = [];
  out.push(`<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" aria-hidden="true">`);
  out.push(`<g stroke="#cfd8e3" fill="none">${[30,52].map(r => `<circle cx="${cx0}" cy="${cy0}" r="${r}"/>`).join('')}</g>`);
  for (let a = 0; a < 360; a += 30) { const s = Math.sin(a*D2R), c = Math.cos(a*D2R); out.push(`<line x1="${cx0+s*58}" y1="${cy0-c*58}" x2="${cx0+s*(a%90?62:66)}" y2="${cy0-c*(a%90?62:66)}" stroke="#a9b6c6"/>`); }
  out.push(`<text x="${cx0}" y="${cy0-69}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="9" fill="#66778b">N</text>`);
  const n = ap.rwys.length;
  ap.rwys.forEach((r, k) => {
    const [a, b] = r.split('/'), hdg = parseInt(a, 10)*10, side = a.endsWith('L') ? -1 : a.endsWith('R') ? 1 : (n > 1 ? (k ? 1 : -1) : 0);
    const par = n > 1 && ap.rwys.every(x => /[LR]/.test(x)), off = n > 1 ? side*13 : 0, len = n > 1 ? (k ? L*0.9 : L) : L;
    const tx = cx0 + Math.cos(hdg*D2R)*off, ty = cy0 + Math.sin(hdg*D2R)*off;
    const rot = hdg - 90;
    out.push(`<g transform="translate(${tx.toFixed(1)} ${ty.toFixed(1)}) rotate(${rot})">`);
    out.push(`<rect x="${-len/2}" y="-4.5" width="${len}" height="9" rx="1" fill="${ap.status === 'live' ? '#0b2a4a' : '#7b8da3'}"/>`);
    out.push(`<line x1="${-len/2+12}" y1="0" x2="${len/2-12}" y2="0" stroke="#ffffff" stroke-width="1.2" stroke-dasharray="5 4"/>`);
    out.push(`</g>`);
    // designators at each end, upright
    const ex = Math.sin(hdg*D2R)*(len/2+12), ey = -Math.cos(hdg*D2R)*(len/2+12);
    out.push(`<text x="${(tx-ex).toFixed(1)}" y="${(ty-ey+3).toFixed(1)}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="#3a4a5e">${a}</text>`);
    out.push(`<text x="${(tx+ex).toFixed(1)}" y="${(ty+ey+3).toFixed(1)}" text-anchor="middle" font-family="JetBrains Mono, monospace" font-size="10" fill="#3a4a5e">${b}</text>`);
  });
  out.push('</svg>'); return out.join('');
}
function apCard(ap){
  const live = ap.status === 'live', tag = live ? 'a' : 'div';
  return `<${tag} class="ap${live ? '' : ' off'}"${live ? ' href="#lxgb"' : ''}>
    <div class="dia">${rwyDiagram(ap)}</div>
    <div class="bd"><div class="id"><span class="icao">${ap.icao}</span><span class="icao" style="color:var(--faint)">${ap.iata}</span><span class="badge ${ap.status}">${STATUS_TXT[ap.status]}</span></div>
    <h3>${esc(ap.name)}</h3><div class="ctry">${esc(ap.ctry)} · ${esc(ap.region)}</div><p>${esc(ap.blurb)}</p>
    <div class="ft">${ap.pos.map(p => `<span class="pos">${p}</span>`).join('')}<span>RWY ${ap.rwys.join(' · ')}</span><span class="diff" title="Difficulty ${ap.diff} of 5">${[1,2,3,4,5].map(i => `<i class="${i <= ap.diff ? 'on' : ''}"></i>`).join('')}</span></div></div>
  </${tag}>`;
}
const apf = { region: 'All', q: '', live: false };
function renderAirports(){
  $('apFeatured').innerHTML = AIRPORTS_NET.slice(0, 8).map(apCard).join('');
  const regions = ['All', ...new Set(AIRPORTS_NET.map(a => a.region))];
  $('apRegions').innerHTML = regions.map(r => `<button type="button" class="${r === apf.region ? 'on' : ''}" data-r="${esc(r)}">${esc(r)}</button>`).join('');
  $('apRegions').querySelectorAll('button').forEach(b => b.onclick = () => { apf.region = b.dataset.r; renderAirports(); });
  const q = apf.q.trim().toLowerCase();
  const list = AIRPORTS_NET.filter(a => (apf.region === 'All' || a.region === apf.region) && (!apf.live || a.status === 'live') && (!q || [a.icao, a.iata, a.name, a.ctry].join(' ').toLowerCase().includes(q)));
  $('apGrid').innerHTML = list.map(apCard).join(''); $('apEmpty').hidden = list.length > 0;
  $('statAirports').textContent = AIRPORTS_NET.length; $('statLive').textContent = AIRPORTS_NET.filter(a => a.status === 'live').length;
}
$('apSearch').addEventListener('input', e => { apf.q = e.target.value; renderAirports(); });
$('apLiveOnly').addEventListener('change', e => { apf.live = e.target.checked; renderAirports(); });

// ── overview: animated hero scope ──
const hero = { cv: $('heroScope'), base: null, map: null, ang: 0, blips: [], trail: [] };
const HERO_TRAFFIC = [
  // [label, start lat, lon, track, speed kt, colour]
  ['BAW492',  36.62, -4.55, 236, 290, PAL.light.arr], ['EZY8902', 36.18, -5.33, 70, 230, PAL.light.dep],
  ['RAM1472', 35.80, -5.55, 25, 210, PAL.light.arr], ['TOM6262', 36.40, -4.85, 245, 260, PAL.light.arr],
  ['EXS97K',  36.05, -5.20, 92, 250, PAL.light.dep], ['IBE3421', 35.70, -4.70, 300, 440, 'rgba(60,75,95,.7)'],
  ['RYR8RK',  36.75, -5.95, 140, 420, 'rgba(60,75,95,.7)'], ['VLG41AM', 35.95, -6.20, 60, 430, 'rgba(60,75,95,.7)']
];
function heroInit(){
  const r = hero.cv.getBoundingClientRect(); if (!r.width) return false;
  hero.base = document.createElement('canvas'); hero.base.style.width = r.width + 'px'; hero.base.style.height = r.height + 'px';
  // drawTo sizes from getBoundingClientRect, which a detached canvas lacks: borrow the hero canvas for the static map
  const dpr = window.devicePixelRatio || 1;
  hero.map = drawTo(hero.cv, 'app', { acs: [], proc: true, tweak: v => { v.cx = GBR[0] - 1; v.cy = GBR[1] - 1; v.scale = r.height/62; v.cx = GBR[0] + (r.width > 700 ? 3 : 0); } });
  hero.base.width = hero.cv.width; hero.base.height = hero.cv.height;
  hero.base.getContext('2d').drawImage(hero.cv, 0, 0);
  hero.dpr = dpr; hero.w = r.width; hero.h = r.height;
  hero.blips = HERO_TRAFFIC.map(([cs, la, lo, trk, kt, col]) => ({ cs, p: xy(la, lo), trk, kt, col, hist: [] }));
  return true;
}
let heroLast = performance.now();
function heroFrame(now){
  const dt = Math.min(0.1, (now - heroLast)/1000); heroLast = now;
  if (curRoute === 'home' && (hero.map || heroInit())) {
    const g = hero.cv.getContext('2d'), m = hero.map, w = hero.w, h = hero.h;
    const hx = x => w/2 + (x - m.cx)*m.scale, hy = y => h/2 - (y - m.cy)*m.scale;
    g.setTransform(1,0,0,1,0,0); g.drawImage(hero.base, 0, 0); g.setTransform(hero.dpr,0,0,hero.dpr,0,0);
    const ox = hx(GBR[0]), oy = hy(GBR[1]), R = Math.hypot(w, h);
    const prevAng = hero.ang; hero.ang = (hero.ang + dt*Math.PI*2/4.8) % (Math.PI*2);
    // sweep wedge
    const grd = g.createConicGradient ? g.createConicGradient(hero.ang - Math.PI/2 - 0.9, ox, oy) : null;
    if (grd) { grd.addColorStop(0, 'rgba(31,94,255,0)'); grd.addColorStop(0.143, 'rgba(31,94,255,.14)'); grd.addColorStop(0.1431, 'rgba(31,94,255,0)'); g.fillStyle = grd; g.fillRect(0,0,w,h); }
    g.strokeStyle = 'rgba(31,94,255,.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + Math.sin(hero.ang)*R, oy - Math.cos(hero.ang)*R); g.stroke();
    // targets move continuously; the displayed return only updates as the sweep passes
    for (const b of hero.blips) {
      const sp = b.kt/3600*dt*6; // 6× time so the picture visibly moves
      b.p = [b.p[0] + Math.sin(b.trk*D2R)*sp, b.p[1] + Math.cos(b.trk*D2R)*sp];
      if (Math.hypot(b.p[0] - GBR[0], b.p[1] - GBR[1]) > 46) { b.trk = (b.trk + 180) % 360; }
      const a = (Math.atan2(b.p[0] - GBR[0], b.p[1] - GBR[1]) + Math.PI*2) % (Math.PI*2);
      const crossed = prevAng <= hero.ang ? (a > prevAng && a <= hero.ang) : (a > prevAng || a <= hero.ang);
      if (crossed || !b.shown) { if (b.shown) { b.hist.unshift(b.shown); b.hist.length = Math.min(b.hist.length, 5); } b.shown = [...b.p]; b.lit = now; }
      for (let i = 0; i < b.hist.length; i++) { g.fillStyle = `rgba(11,42,74,${0.4 - i*0.07})`; g.fillRect(hx(b.hist[i][0]) - 1, hy(b.hist[i][1]) - 1, 2, 2); }
      const X = hx(b.shown[0]), Y = hy(b.shown[1]), fade = clamp(1 - (now - b.lit)/4800, 0.45, 1);
      g.globalAlpha = fade; g.strokeStyle = b.col; g.lineWidth = 1.4; g.strokeRect(X - 3.5, Y - 3.5, 7, 7);
      g.beginPath(); g.moveTo(X, Y); g.lineTo(X + Math.sin(b.trk*D2R)*16, Y - Math.cos(b.trk*D2R)*16); g.stroke();
      g.fillStyle = b.col; g.font = `500 11px ${FONT_D}`; g.fillText(b.cs, X + 8, Y - 6); g.globalAlpha = 1;
    }
  }
  requestAnimationFrame(heroFrame);
}
window.addEventListener('resize', () => { hero.map = null; if (curRoute === 'home' || curRoute === 'lxgb') renderThumbs(); if (curRoute === 'training') renderFigure(); });

// position thumbnails reuse the real renderer
function renderThumbs(){
  document.querySelectorAll('canvas[data-thumb]').forEach(c => {
    const k = c.dataset.thumb;
    drawTo(c, k, { proc: true, tweak: k === 'app' ? (v => { v.scale *= 1.6; v.cx += 2; v.cy += 3; }) : null });
  });
}

// scenarios: one card per weather preset, opening the simulator with that weather
const SCEN_TEXT = {
  fair: 'A gentle westerly and good visibility. Learn the flow: road closures, backtracks and the SRA to runway 27.',
  levanter: 'The easterly gale and its banner cloud. Runway 09, approaches through RIPRA, and turbulence curling off the Rock.',
  southerly: 'The Rock sits directly upwind of final. The wind is beyond the Special Procedures turbulence limit, so expect go-arounds.',
  poniente: 'A gusty south-westerly with waterspouts on the runway 27 approach. Crosswind limits start to bite.',
  cross: 'A northerly blowing straight across the runway. Smaller types will refuse the approach and hold.',
  fog: 'Sea fog below SRA minima. Hold arrivals, plan diversions to Málaga and Tangier, and keep the departures moving.',
  storm: 'Cumulonimbus in the Strait. Reduced visibility, gusts, and crews asking to avoid cells.'
};
function renderScenarios(){
  const g = $('scenGrid'); g.innerHTML = '';
  for (const [k, v] of Object.entries(WX_PRESETS)) {
    const b = document.createElement('button'); b.type = 'button';
    b.innerHTML = `<span class="nm">${esc(v.short)}</span><span class="ds">${esc(SCEN_TEXT[k] || v.name)}</span><span class="mt">${esc(v.metar.replace(/^LXGB \d{6}Z /, ''))}</span><span class="go">Open position ›</span>`;
    b.onclick = () => { $('wxPreset').value = k; $('trafficSel').value = 'summer'; $('wxPaste').value = ''; if (S.running) { S.running = false; resetSession(); } location.hash = 'sim'; openSetup(); };
    g.appendChild(b);
  }
}

// ── training guide ──
function buildToc(){
  const ol = $('tocList'); ol.innerHTML = '';
  document.querySelectorAll('#page-training section[id^="t-"]').forEach(sec => {
    const h = sec.querySelector('h2'); if (!h) return;
    const li = document.createElement('li'), a = document.createElement('a');
    a.href = '#' + sec.id; a.textContent = h.textContent.replace(/^\d+/, '').trim(); a.dataset.for = sec.id;
    li.appendChild(a); ol.appendChild(li);
  });
}
function spy(){
  if (curRoute !== 'training') return;
  const secs = [...document.querySelectorAll('#page-training section[id^="t-"]')];
  let cur = secs[0];
  for (const s of secs) if (s.getBoundingClientRect().top < 140) cur = s;
  document.querySelectorAll('#tocList a').forEach(a => a.classList.toggle('on', cur && a.dataset.for === cur.id));
}
window.addEventListener('scroll', spy, { passive: true });
function buildTurbTable(){
  const ks = Object.keys(TURB_TABLE);
  $('turbTable').innerHTML = `<thead><tr><th scope="row">Wind from (°M)</th>${ks.map(k => `<th>${k}</th>`).join('')}</tr></thead><tbody><tr><th scope="row">Turbulence above (kt)</th>${ks.map(k => `<td>${TURB_TABLE[k]}</td>`).join('')}</tr></tbody>`;
}
function renderFigure(){
  const c = $('figAerodrome'); if (!c) return;
  c.style.aspectRatio = '2.25 / 1';
  drawTo(c, 'gnd', { acs: [], proc: false });
}

// ── guided exercises (coach card) ──
const A = cs => S.acs.find(a => a.cs === cs);
const seen = {}; // per-callsign milestones that survive the aircraft leaving the picture
S.listeners.push((ev, d) => {
  if (!d || !d.cs) { if (ev === 'cmd' && d && d.ac) (seen[d.ac.cs] ||= {}).cmd = true; return; }
  const f = (seen[d.cs] ||= {});
  if (ev === 'landed') f.landed = true; if (ev === 'airborne') f.airborne = true; if (ev === 'exit') f.exit = true; if (ev === 'onstand') f.onstand = true; if (ev === 'takeoff') f.takeoff = true;
});
const st = (cs, ...l) => { const a = A(cs); return !!a && l.includes(a.state); };
const sn = cs => seen[cs] || {};
const roadShut = () => S.xing.st === 'CLOSING' || S.xing.st === 'CLOSED';
const COACH = {
  dep: [
    { h: 'Wait for the start-up call', p: 'BAW493 is on stand 3 for London Heathrow. Watch the strip and the message log: in a moment the crew asks for start-up and push back.', ok: () => !!(A('BAW493') && A('BAW493').need) || st('BAW493','PUSH','READY','TAXI') },
    { h: 'Approve start-up and push', p: 'Select BAW493 (click the strip or the aircraft), then press <b>Push</b>, or type <code>BAW493 PUSH</code>. The tug pushes it back onto the apron lane.', cmd: 'BAW493 PUSH', ok: () => !!(A('BAW493') && A('BAW493').pushed) || st('BAW493','TAXI','HOLDPT','LINEUP','LINEDUP','TAKEOFF') || sn('BAW493').airborne },
    { h: 'Taxi to holding point Echo', p: 'With runway 27 in use, departures hold at Echo, east of the terminal. When the crew reports ready, type <code>BAW493 TAXI E</code>. The clearance reads back as "taxi to holding point Echo via Bravo".', cmd: 'BAW493 TAXI E', ok: () => st('BAW493','TAXI','HOLDPT','LINEUP','LINEDUP','TAKEOFF') || sn('BAW493').airborne },
    { h: 'Close Winston Churchill Avenue', p: 'Before anything goes onto the runway the road must be shut. Press <b>Close road</b> in the ATIS panel. Barriers and the FOD check take about 2½ minutes, so do it now while the aircraft taxies.', road: true, ok: () => roadShut() || sn('BAW493').airborne },
    { h: 'Line up and backtrack', p: 'Echo joins the runway at its eastern end. An A320 is over 17 tonnes, so it must use the turning circle before facing west. Type <code>BAW493 LU</code>. You will be warned if the road is still open across the backtrack.', cmd: 'BAW493 LU', ok: () => st('BAW493','LINEUP','LINEDUP','TAKEOFF') || sn('BAW493').airborne },
    { h: 'Clear for take-off', p: 'Once the road shows <b>Closed</b>, type <code>BAW493 CTO</code>. Tower passes the surface wind with the clearance.', cmd: 'BAW493 CTO', ok: () => sn('BAW493').takeoff || sn('BAW493').airborne },
    { h: 'Transfer to Gibraltar Radar', p: 'Once airborne, transfer the flight to Radar on 122.8 with <code>BAW493 HO</code>. It calls passing its altitude and heading.', cmd: 'BAW493 HO', ok: () => (A('BAW493') && A('BAW493').freq === 'RAD') || sn('BAW493').exit },
    { h: 'Hand off to Sevilla', p: 'The departure follows its routing out of the zone. Once it is clear of the Rock and climbing, hand it to Sevilla Control with <code>BAW493 HO</code>, then reopen the road.', cmd: 'BAW493 HO', ok: () => (A('BAW493') && A('BAW493').handed) || sn('BAW493').exit },
    { h: 'Reopen the road', p: 'The runway is clear, so press <b>Open road</b> to let the traffic and pedestrians across.', road: true, ok: () => S.xing.st === 'OPEN' || S.xing.st === 'OPENING' }
  ],
  arr: [
    { h: 'Take the initial call', p: 'EZY8901 from Gatwick calls inbound from the east via PIMOS. Select it and give a descent: type <code>EZY8901 A60</code> for 6,000 feet on the QNH.', cmd: 'EZY8901 A60', ok: () => sn('EZY8901').cmd || sn('EZY8901').landed },
    { h: 'Clear the SRA approach', p: 'Type <code>EZY8901 APP</code>. The flight routes to a 10 NM final for runway 27, descends to 3,000 feet and flies the surveillance radar approach down to Point Yankee.', cmd: 'EZY8901 APP', ok: () => !!(A('EZY8901') && A('EZY8901').app) || sn('EZY8901').landed },
    { h: 'Close the road in time', p: 'Walkers must be clear by 15 NM and traffic by 10 NM. Press <b>Close road</b> now, while the arrival is still well out.', road: true, ok: () => roadShut() || sn('EZY8901').landed },
    { h: 'Transfer to Tower', p: 'At about 5 NM, transfer the flight to Tower on 131.2 with <code>EZY8901 HO</code>.', cmd: 'EZY8901 HO', ok: () => (A('EZY8901') && A('EZY8901').freq === 'TWR') || sn('EZY8901').landed },
    { h: 'Clear to land', p: 'With the road closed, type <code>EZY8901 CTL</code>. Without a landing clearance by short final, the crew goes around.', cmd: 'EZY8901 CTL', ok: () => !!(A('EZY8901') && A('EZY8901').ctl) || sn('EZY8901').landed },
    { h: 'Watch the landing', p: 'Scroll in on the runway to see the touchdown. Gibraltar has no rapid exits, so the aircraft rolls out on the runway and asks to backtrack.', ok: () => sn('EZY8901').landed && st('EZY8901','ROLLED','VACATING','ONSTAND') },
    { h: 'Backtrack and taxi to stand', p: 'Type <code>EZY8901 VAC</code>. It backtracks, turns off at Alpha or Echo and taxies to a civil stand. The road stays shut until it is off the runway.', cmd: 'EZY8901 VAC', ok: () => st('EZY8901','VACATING','ONSTAND') || sn('EZY8901').onstand },
    { h: 'Reopen the road', p: 'Once the aircraft is off the runway, press <b>Open road</b>.', road: true, ok: () => S.xing.st === 'OPEN' || S.xing.st === 'OPENING' }
  ],
  lev: [
    { h: 'Runway 09 in the levanter', p: 'An easterly is blowing at gale force, so runway 09 is in use and the banner cloud sits on the Rock. Check the ATIS panel. Arrivals join from the south via RIPRA and turn in over the bay.', ok: () => S.rwy === '09' },
    { h: 'Clear BAW492 for the SRA 09', p: 'Give BAW492 a descent if you like, then type <code>BAW492 APP</code>. It routes to RIPRA for the approach to Point X-Ray.', cmd: 'BAW492 APP', ok: () => !!(A('BAW492') && A('BAW492').app) || sn('BAW492').landed },
    { h: 'Start RAM1472 on the south apron', p: 'The Royal Air Maroc ATR is on south stand 1. When it calls, approve the push with <code>RAM1472 PUSH</code>.', cmd: 'RAM1472 PUSH', ok: () => !!(A('RAM1472') && A('RAM1472').pushed) || st('RAM1472','TAXI','HOLDPT','LINEUP','LINEDUP','TAKEOFF') || sn('RAM1472').airborne },
    { h: 'Taxi the ATR to Charlie', p: 'Type <code>RAM1472 TAXI C</code>. Charlie leads straight from the south apron to the runway, just east of the road. The ATR waits there while the arrival lands.', cmd: 'RAM1472 TAXI C', ok: () => st('RAM1472','TAXI','HOLDPT','LINEUP','LINEDUP','TAKEOFF') || sn('RAM1472').airborne },
    { h: 'Close the road', p: 'Press <b>Close road</b> before the arrival reaches 10 NM.', road: true, ok: () => roadShut() || sn('BAW492').landed },
    { h: 'Transfer and clear BAW492 to land', p: 'Send it to Tower with <code>BAW492 HO</code>, then <code>BAW492 CTL</code>. In this wind, a windshear go-around is possible. If it happens, re-clear the approach with <code>APP</code>.', cmd: ['BAW492 HO', 'BAW492 CTL'], ok: () => !!(A('BAW492') && A('BAW492').ctl) || sn('BAW492').landed },
    { h: 'Vacate the arrival', p: 'After touchdown, type <code>BAW492 VAC</code>. It backtracks to Alpha and taxies to the civil apron. Wait until it is off the runway before you line up the ATR.', cmd: 'BAW492 VAC', ok: () => (st('BAW492','VACATING','ONSTAND') && !A('BAW492').onRwy) || sn('BAW492').onstand },
    { h: 'Line up and depart the ATR', p: 'With BAW492 off the runway, type <code>RAM1472 LU</code>, then <code>RAM1472 CTO</code>.', cmd: ['RAM1472 LU', 'RAM1472 CTO'], ok: () => sn('RAM1472').takeoff || sn('RAM1472').airborne },
    { h: 'Hand off and reopen', p: 'Transfer RAM1472 to Radar and then Casablanca with <code>HO</code>, and press <b>Open road</b> once the runway is clear.', cmd: 'RAM1472 HO', road: true, ok: () => (S.xing.st === 'OPEN' || S.xing.st === 'OPENING') && sn('RAM1472').airborne }
  ]
};
const coach = { ex: null, i: 0, hidden: false };
const stepCs = s => s && s.cmd ? [].concat(s.cmd)[0].split(' ')[0] : null;
const canDo = s => !!(s && s.cmd && A(stepCs(s)));
function coachSig(){ const L = COACH[coach.ex], s = L && L[coach.i]; return coach.ex + coach.i + (canDo(s) ? '+' : '-'); }
function coachStart(ex){ for (const k in seen) delete seen[k]; coach.ex = ex; coach.i = 0; coach.hidden = false; coachCheck(); }
function coachCheck(){
  if (!coach.ex) { $('coach').hidden = true; return; }
  const L = COACH[coach.ex]; const before = coach.i;
  while (coach.i < L.length && L[coach.i].ok()) coach.i++;
  if (coach.i !== before || $('coach').dataset.sig !== coachSig()) renderCoach();
}
function renderCoach(){
  const el = $('coach'), L = COACH[coach.ex], n = L.length, done = coach.i >= n, s = L[Math.min(coach.i, n-1)];
  el.dataset.sig = coachSig(); el.hidden = coach.hidden || curRoute !== 'sim';
  const bars = L.map((_, j) => `<i class="${j < coach.i ? 'done' : j === coach.i ? 'cur' : ''}"></i>`).join('');
  el.innerHTML = done
    ? `<div class="lbl">${esc(EXERCISES[coach.ex].name)} · complete</div><h4>Well controlled.</h4><div class="steps">${bars}</div><p>Score <b>${S.score.pts}</b> points, ${S.score.incidents} incidents. Try the next exercise, or open a full session with real traffic.</p><div class="row"><a class="btn primary" href="#training" data-hash="t-exercises">Next exercise</a><button class="btn" data-c="session">Full session</button><button class="btn" data-c="hide">Close</button></div>`
    : `<div class="lbl">${esc(EXERCISES[coach.ex].name)} · step ${coach.i + 1} of ${n}</div><h4>${s.h}</h4><div class="steps">${bars}</div><p>${s.p}</p><div class="row">${canDo(s) ? `<button class="btn" data-c="do">Do it for me</button>` : ''}${s.road ? `<button class="btn" data-c="road">Press it for me</button>` : ''}<button class="btn" data-c="hide">Hide</button></div>`;
  el.querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
    const c = b.dataset.c;
    if (c === 'do') runCoachCmd(s.cmd);
    if (c === 'road') toggleXing();
    if (c === 'hide') { coach.hidden = true; el.hidden = true; }
    if (c === 'session') { coach.ex = null; el.hidden = true; $('trafficSel').value = 'real'; S.running = false; resetSession(); openSetup(); }
    coachCheck();
  });
}
// a step may need several transmissions, each with its own read-back
function runCoachCmd(c){ for (const t of [].concat(c)) command(t); }
S.listeners.push(ev => { if (ev === 'start') { const m = S.mode; if (COACH[m]) coachStart(m); else { coach.ex = null; $('coach').hidden = true; } } else if (coach.ex) coachCheck(); });

function startExercise(ex){
  $('trafficSel').value = ex; $('wxPaste').value = '';
  S.running = false; resetSession();
  location.hash = 'sim'; go('sim');
  requestAnimationFrame(() => { resize(); start(); });
}
document.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => startExercise(b.dataset.ex));
document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[data-hash]'); if (a) { e.preventDefault(); location.hash = a.dataset.hash; } });

// ── boot ──
renderAirports(); renderScenarios(); buildToc(); buildTurbTable();
fromHash();
resize(); setView('app'); renderAtis(); renderSel(); renderStrips(true); renderScore();
requestAnimationFrame(frame); requestAnimationFrame(heroFrame);

// full-screen position: Launch takes the browser full screen (where the frame allows it) and the site bar hides on #sim
function canFull(){ return !!(document.documentElement.requestFullscreen && document.fullscreenEnabled); }
function enterFull(){ if (canFull() && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); }
function exitFull(){ if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); }
document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href="#sim"]'); if (a) enterFull(); });
$('tgExit').onclick = () => { exitFull(); location.hash = '#lxgb'; };
$('tgFull').onclick = () => document.fullscreenElement ? exitFull() : enterFull();
function syncFull(){ const b = $('tgFull'); b.hidden = !canFull(); b.textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen'; b.classList.toggle('on', !!document.fullscreenElement); }
document.addEventListener('fullscreenchange', () => { syncFull(); if (curRoute === 'sim') resize(); });
syncFull();
