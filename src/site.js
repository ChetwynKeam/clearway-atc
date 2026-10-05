// ═════════════════════════ site: routing, overview, training, coach ═════════════════════════
const ROUTES = ['home', 'airports', 'lxgb', 'lpma', 'eglc', 'lowi', 'kjfk', 'sim', 'training', 'career'];
// One website: SITE_HOST's page (index.html) shows the whole site, with every airport's briefing and the whole Academy.
// Every other airport's page (SITE, from build.py) only runs its simulator: #sim, #ex/<exercise>, #wx/<preset>, #live.
// Anything else there goes to the host page. #embed turns a page into a map renderer for the host (see embedDraw).
const AP_ROUTE = { LXGB: 'lxgb', LPMA: 'lpma', EGLC: 'eglc', LOWI: 'lowi', KJFK: 'kjfk' }, HOME_RT = AP_ROUTE[APT.icao];
const LIVE_APS = Object.keys(AP_ROUTE);
const IS_HOST = APT.icao === SITE_HOST, EMBED = location.hash.startsWith('#embed');
const SIM_HASH = /^(sim|ex\/|wx\/|live$)/;
const otherPage = h => IS_HOST || EMBED || SIM_HASH.test(h) ? null : SITE[SITE_HOST] + '#' + (h || HOME_RT);
const isApRoute = r => Object.values(AP_ROUTE).includes(r);
// the airport a block of the site belongs to: its data-apt, or the airport briefing page it sits on
const blockAp = el => { const a = el.closest('[data-apt]'); if (a) return a.dataset.apt; const p = el.closest('[data-page]'); return p && LIVE_APS.find(k => AP_ROUTE[k] === p.dataset.page) || null; };
if (otherPage(location.hash.slice(1))) location.replace(otherPage(location.hash.slice(1)));
if (!EMBED) try { localStorage.setItem('cw-airport', APT.icao); } catch(e) {}
let curRoute = null;
function go(r){
  if (!ROUTES.includes(r)) r = 'home';
  { const o = otherPage(r); if (o) { location.href = o; return; } }
  if (r === curRoute) return;
  const prev = curRoute; curRoute = r;
  document.body.dataset.route = r;
  document.querySelectorAll('[data-page]').forEach(p => p.hidden = p.dataset.page !== r);
  document.querySelectorAll('.nav [data-route]').forEach(a => a.classList.toggle('on', a.dataset.route === r));
  if (r === 'sim') { resize(); if (!S.running) setView(V.name || 'app'); }
  if (prev === 'sim' && r !== 'sim') exitFull();
  if (r !== 'sim' && prev === 'sim' && S.running && !S.paused) { S.paused = true; $('tgPause').textContent = 'Resume'; sys('Simulation paused while you are away from the scope.'); }
  if (r === 'home' || isApRoute(r)) requestAnimationFrame(renderThumbs);
  if (r === 'training') requestAnimationFrame(() => { renderFigure(); spy(); });
  if (r === 'career') renderCareer();
  if (r === 'airports' && apf.view === 'map') requestAnimationFrame(wmRender);
  window.scrollTo(0, 0);
}
function fromHash(){
  const h = location.hash.replace('#', '');
  if (EMBED) return;
  { const o = otherPage(h); if (o) { location.replace(o); return; } }
  // from the host page's Academy, scenario cards and Live now links: #ex/<key>, #wx/<preset>, #live
  if (h.startsWith('ex/')) { const k = h.slice(3); if (EXERCISES[k]) { history.replaceState(null, '', '#sim'); return startExercise(k); } }
  if (h.startsWith('wx/')) { const k = h.slice(3); history.replaceState(null, '', '#sim'); return WX_PRESETS[k] ? openScenario(k) : go('sim'); }
  if (h === 'live') { history.replaceState(null, '', '#sim'); go('sim'); const sel = $('trafficSel'); if (!S.running) { sel.value = 'live'; sel.dispatchEvent(new Event('change')); } return; }
  if (ROUTES.includes(h)) return go(h);
  const el = h && document.getElementById(h);
  if (el && el.closest('[data-page="training"]')) { const ap = el.closest('[data-apt]'); if (ap) setEndorse(ap.dataset.apt); go('training'); requestAnimationFrame(() => el.scrollIntoView()); return; }
  go(curRoute || 'home');
}
window.addEventListener('hashchange', fromHash);

// top bar clock: real UTC, so the site feels like a live position
function topClock(){ const d = new Date(); $('topClock').textContent = 'UTC ' + d.toISOString().substr(11,5) + 'Z'; }
setInterval(topClock, 10000); topClock();

// ── airport network ──
// LXGB, LPMA, EGLC, LOWI and KJFK are built. The rest are the roadmap: real airports and runway designators, no invented performance data.
// ll: aerodrome reference point [lat, lon], for the pins on the Airports map.
const AIRPORTS_NET = [
  { icao:'LXGB', ll:[36.151, -5.349], iata:'GIB', name:'Gibraltar', ctry:'Gibraltar (UK)', region:'Europe', rwys:['09/27'], status:'live', pos:['APP','TWR','GND'], diff:4, blurb:'A public road across the runway, the levanter off the Rock, and Spanish restricted airspace at the fence.' },
  { icao:'LPMA', ll:[32.698, -16.774], iata:'FNC', name:'Madeira', ctry:'Portugal', region:'Europe', rwys:['05/23'], status:'live', isNew: true, pos:['APP','TWR','GND'], diff:5, blurb:'A runway extended over the sea on columns, strict wind limits, and a visual turn onto 05 past the cliffs.' },
  { icao:'EGLC', ll:[51.505, 0.055], iata:'LCY', name:'London City', ctry:'United Kingdom', region:'UK & Ireland', rwys:['09/27'], status:'live', isNew: true, pos:['APP','TWR','GND'], diff:4, blurb:'A 5.5° glidepath past the Canary Wharf towers, RNAV-only SIDs under the London TMA, and a short runway between two docks.' },
  { icao:'LOWI', ll:[47.26, 11.344], iata:'INN', name:'Innsbruck', ctry:'Austria', region:'Europe', rwys:['08/26'], status:'live', isNew: true, pos:['APP','TWR','GND'], diff:5, blurb:'An Alpine valley: the offset LOC/DME East, circling to 08, RNP AR approaches, arrivals and departures head-on, and föhn off the Brenner.' },
  { icao:'KJFK', ll:[40.640, -73.779], iata:'JFK', name:'New York JFK', ctry:'United States', region:'North America', rwys:['04L/22R','04R/22L','13L/31R','13R/31L'], status:'live', isNew: true, pos:['APP','TWR','GND'], diff:5, blurb:'Four runways in two parallel pairs on Jamaica Bay, arrivals crossing the departure runway, the Kennedy Five and FAA phraseology.' },
  { icao:'LFMN', ll:[43.658, 7.216], iata:'NCE', name:'Nice Côte d’Azur', ctry:'France', region:'Europe', rwys:['04L/22R','04R/22L'], status:'dev', pos:['APP','TWR','GND'], diff:3, blurb:'Parallel runways on reclaimed land, approaches along the coast, and the Alps close to the north.' },
  { icao:'LEMG', ll:[36.675, -4.499], iata:'AGP', name:'Málaga', ctry:'Spain', region:'Europe', rwys:['13/31','12/30'], status:'plan', pos:['APP','TWR','GND'], diff:3, blurb:'Gibraltar’s busy neighbour: summer peaks, two runways and the Costa del Sol sea breeze.' },
  { icao:'EGLL', ll:[51.47, -0.454], iata:'LHR', name:'London Heathrow', ctry:'United Kingdom', region:'UK & Ireland', rwys:['09L/27R','09R/27L'], status:'plan', pos:['APP','TWR','GND'], diff:5, blurb:'Four holding stacks, runway alternation and a heavy wake mix on two parallel runways.' },
  { icao:'EGKK', ll:[51.148, -0.19], iata:'LGW', name:'London Gatwick', ctry:'United Kingdom', region:'UK & Ireland', rwys:['08R/26L','08L/26R'], status:'plan', pos:['TWR','GND'], diff:4, blurb:'One of the busiest single-runway operations in the world. Every gap in the departure flow counts.' },
  { icao:'TNCM', ll:[18.041, -63.109], iata:'SXM', name:'Princess Juliana', ctry:'Sint Maarten', region:'Caribbean', rwys:['10/28'], status:'plan', pos:['APP','TWR'], diff:3, blurb:'Low arrivals over Maho Beach, Caribbean squalls and a single runway between the sea and the lagoon.' },
  { icao:'VQPR', ll:[27.403, 89.425], iata:'PBH', name:'Paro', ctry:'Bhutan', region:'Asia', rwys:['15/33'], status:'plan', pos:['TWR'], diff:5, blurb:'A visual approach through a Himalayan valley, with daylight-only operations.' },
  { icao:'KSAN', ll:[32.734, -117.19], iata:'SAN', name:'San Diego', ctry:'United States', region:'North America', rwys:['09/27'], status:'plan', pos:['APP','TWR','GND'], diff:3, blurb:'A busy single runway, with downtown buildings under the approach to 27.' },
  { icao:'LGSK', ll:[39.177, 23.504], iata:'JSI', name:'Skiathos', ctry:'Greece', region:'Europe', rwys:['02/20'], status:'plan', pos:['TWR'], diff:3, blurb:'A short island runway that ends at the sea, with summer charter waves.' }
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
  const live = ap.status === 'live', tag = live ? 'a' : 'div', rt = AP_ROUTE[ap.icao];
  const href = live ? '#' + rt : '';
  return `<${tag} class="ap${live ? '' : ' off'}"${live ? ` href="${href}"` : ''}>
    <div class="dia">${rwyDiagram(ap)}</div>
    <div class="bd"><div class="id"><span class="icao">${ap.icao}</span><span class="icao" style="color:var(--faint)">${ap.iata}</span><span class="badge ${ap.status}">${STATUS_TXT[ap.status]}</span>${ap.isNew ? '<span class="badge new">New</span>' : ''}</div>
    <h3>${esc(ap.name)}</h3><div class="ctry">${esc(ap.ctry)} · ${esc(ap.region)}</div><p>${esc(ap.blurb)}</p>
    <div class="ft">${ap.pos.map(p => `<span class="pos">${p}</span>`).join('')}<span>RWY ${ap.rwys.join(' · ')}</span><span class="diff" title="Difficulty ${ap.diff} of 5">${[1,2,3,4,5].map(i => `<i class="${i <= ap.diff ? 'on' : ''}"></i>`).join('')}</span></div></div>
  </${tag}>`;
}
const apf = { region: 'All', q: '', live: false, view: 'list' };
function renderAirports(){
  $('apFeatured').innerHTML = AIRPORTS_NET.slice(0, 8).map(apCard).join('');
  const regions = ['All', ...new Set(AIRPORTS_NET.map(a => a.region))];
  $('apRegions').innerHTML = regions.map(r => `<button type="button" class="${r === apf.region ? 'on' : ''}" data-r="${esc(r)}">${esc(r)}</button>`).join('');
  $('apRegions').querySelectorAll('button').forEach(b => b.onclick = () => { apf.region = b.dataset.r; renderAirports(); if (apf.view === 'map') wmFit(); });
  const q = apf.q.trim().toLowerCase();
  const list = AIRPORTS_NET.filter(a => (apf.region === 'All' || a.region === apf.region) && (!apf.live || a.status === 'live') && (!q || [a.icao, a.iata, a.name, a.ctry].join(' ').toLowerCase().includes(q)));
  $('apGrid').innerHTML = list.map(apCard).join(''); $('apEmpty').hidden = list.length > 0;
  WM.list = list; if (apf.view === 'map') wmRender();
  $('statAirports').textContent = AIRPORTS_NET.length; $('statLive').textContent = AIRPORTS_NET.filter(a => a.status === 'live').length;
}
$('apSearch').addEventListener('input', e => { apf.q = e.target.value; renderAirports(); });
$('apLiveOnly').addEventListener('change', e => { apf.live = e.target.checked; renderAirports(); });

// ── airports: world map view ──
// A flat Web Mercator world (OpenStreetMap tiles) with a pin per airport, coloured by status. Pins close together
// on screen merge into a numbered cluster; clicking one zooms in. Open airports go straight to their page; roadmap
// airports show a short card. Where tiles can't load (the claude.ai viewer) the map keeps a plain ocean and graticule.
const WM = { list: AIRPORTS_NET, cx: 0.5, cy: 0.5, z: 1, tiles: new Map(), ok: 0, err: 0, failed: false, w: 0, h: 0, dpr: 1, raf: 0, sel: null };
const WM_COL = { live: '#12805c', dev: '#c2700a', plan: '#7b8da3' };
const WM_RANK = { live: 0, dev: 1, plan: 2 };
const wmX = lon => (lon + 180)/360;
const wmY = lat => { const r = clamp(lat, -85, 85)*D2R; return (1 - Math.log(Math.tan(r) + 1/Math.cos(r))/Math.PI)/2; };
const wmLat = y => Math.atan(Math.sinh(Math.PI*(1 - 2*y)))*R2D;
const wmWorld = () => 256*2**WM.z;
const wmZmin = () => Math.max(0, Math.log2(Math.max(WM.w, WM.h)/256) - 0.05);
function wmClamp(){
  WM.z = clamp(WM.z, wmZmin(), 12);
  const ws = wmWorld(), hy = WM.h/2/ws;
  WM.cy = hy >= 0.5 ? 0.5 : clamp(WM.cy, hy, 1 - hy);
  WM.cx = ((WM.cx % 1) + 1) % 1;
}
// screen position of a point, taking the copy of the (wrapping) world nearest the centre
function wmScreen(nx, ny){
  const ws = wmWorld(); let dx = nx - WM.cx; dx -= Math.round(dx);
  return [WM.w/2 + dx*ws, WM.h/2 + (ny - WM.cy)*ws];
}
function wmTile(z, x, y){
  const k = `${z}/${x}/${y}`; let t = WM.tiles.get(k);
  if (!t) {
    if (WM.tiles.size > 400) { const old = [...WM.tiles.entries()].sort((a, b) => a[1].use - b[1].use).slice(0, 120); for (const [kk] of old) WM.tiles.delete(kk); }
    const img = new Image(); t = { img, ok: false, use: 0 };
    img.onload = () => { t.ok = true; WM.ok++; wmDraw(); };
    img.onerror = () => { WM.err++; if (!WM.ok && WM.err >= 4 && !WM.failed) { WM.failed = true; wmDraw(); } };
    img.src = MAP_SRC.street.url(z, x, y); WM.tiles.set(k, t);
  }
  t.use = ++TILE.use; return t;
}
function wmDraw(){
  if (WM.raf) return;
  WM.raf = requestAnimationFrame(() => { WM.raf = 0; wmPaint(); wmPins(); });
}
function wmPaint(){
  const cv = $('apMapCv'), g = cv.getContext('2d'), { w, h, dpr } = WM;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = '#aad3df'; g.fillRect(0, 0, w, h);    // OSM's own sea colour, so the fallback and the tiles match
  const ws = wmWorld();
  if (!WM.failed) {
    const tz = clamp(Math.round(WM.z), 0, 19), n = 2**tz, ts = ws/n;
    const x0 = Math.floor((WM.cx - w/2/ws)*n), x1 = Math.floor((WM.cx + w/2/ws)*n);
    const y0 = Math.max(0, Math.floor((WM.cy - h/2/ws)*n)), y1 = Math.min(n - 1, Math.floor((WM.cy + h/2/ws)*n));
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
      const xx = ((x % n) + n) % n, X = Math.floor(w/2 + (x/n - WM.cx)*ws), Y = Math.floor(h/2 + (y/n - WM.cy)*ws), S = Math.ceil(ts) + 1;
      const t = wmTile(tz, xx, y);
      if (t.ok) { g.drawImage(t.img, X, Y, S, S); continue; }
      // not loaded yet: stretch the nearest loaded parent tile so panning never flashes blank
      for (let up = 1; up <= tz; up++) {
        const k = 2**up, p = WM.tiles.get(`${tz - up}/${Math.floor(xx/k)}/${Math.floor(y/k)}`);
        if (p && p.ok) { const s = 256/k; g.drawImage(p.img, (xx % k)*s, (y % k)*s, s, s, X, Y, S, S); break; }
      }
    }
  }
  if (WM.failed) {
    // graticule every 30° (15° once zoomed in), with the equator and Greenwich a little stronger
    const step = WM.z > 3 ? 15 : 30;
    g.lineWidth = 1; g.font = '11px JetBrains Mono, monospace'; g.fillStyle = 'rgba(11,42,74,.45)';
    for (let lon = -180; lon < 180; lon += step) {
      const [X] = wmScreen(wmX(lon), 0); g.strokeStyle = lon === 0 ? 'rgba(11,42,74,.35)' : 'rgba(11,42,74,.16)';
      g.beginPath(); g.moveTo(X + .5, 0); g.lineTo(X + .5, h); g.stroke();
      g.fillText((Math.abs(lon)) + '°' + (lon < 0 ? 'W' : lon > 0 ? 'E' : ''), X + 4, h - 26);
    }
    for (let lat = -75; lat <= 75; lat += step) {
      const [, Y] = wmScreen(0, wmY(lat)); if (Y < 0 || Y > h) continue;
      g.strokeStyle = lat === 0 ? 'rgba(11,42,74,.35)' : 'rgba(11,42,74,.16)';
      g.beginPath(); g.moveTo(0, Y + .5); g.lineTo(w, Y + .5); g.stroke();
      g.fillText(Math.abs(lat) + '°' + (lat < 0 ? 'S' : lat > 0 ? 'N' : ''), 6, Y - 4);
    }
  }
  if (WM.failed && !WM.noted) { WM.noted = true; $('apMapCredit').textContent = 'Map imagery can’t load here: showing a plain grid'; }
}
// pins: merge ones closer than 26 px into clusters, then lay out as buttons over the canvas
function wmPins(){
  const pts = WM.list.map(ap => { const [x, y] = wmScreen(wmX(ap.ll[1]), wmY(ap.ll[0])); return { ap, x, y }; });
  const groups = [];
  pts.sort((a, b) => WM_RANK[a.ap.status] - WM_RANK[b.ap.status]).forEach(p => {
    const g = groups.find(g => Math.hypot(g.x - p.x, g.y - p.y) < 26);
    if (g) { g.m.push(p); g.x = g.m.reduce((s, q) => s + q.x, 0)/g.m.length; g.y = g.m.reduce((s, q) => s + q.y, 0)/g.m.length; }
    else groups.push({ x: p.x, y: p.y, m: [p] });
  });
  const vis = groups.filter(g => g.x > -30 && g.x < WM.w + 30 && g.y > -30 && g.y < WM.h + 30);
  $('apMapPins').innerHTML = vis.map((g, i) => {
    if (g.m.length > 1) {
      const names = g.m.map(p => p.ap.name).join(', '), st = g.m[0].ap.status;
      return `<button type="button" class="wm-clu" data-g="${i}" style="left:${g.x.toFixed(1)}px;top:${g.y.toFixed(1)}px;--c:${WM_COL[st]}" aria-label="${g.m.length} airports: ${esc(names)}. Zoom in" title="${esc(names)}">${g.m.length}</button>`;
    }
    const ap = g.m[0].ap, live = ap.status === 'live';
    const lab = `${ap.name}, ${STATUS_TXT[ap.status]}`;
    return `<button type="button" class="wm-pin${WM.sel === ap.icao ? ' sel' : ''}" data-icao="${ap.icao}" style="left:${g.x.toFixed(1)}px;top:${g.y.toFixed(1)}px;--c:${WM_COL[ap.status]}" aria-label="${esc(lab)}${live ? '. Open its page' : ''}" title="${esc(lab)}"><svg viewBox="0 0 24 32" aria-hidden="true"><path d="M12 31C12 31 2 18.6 2 11.5A10 10 0 0 1 22 11.5C22 18.6 12 31 12 31Z"/><circle cx="12" cy="11.5" r="4"/></svg><span>${ap.icao}</span></button>`;
  }).join('');
  $('apMapPins').querySelectorAll('.wm-clu').forEach(b => b.onclick = () => { const g = vis[+b.dataset.g]; wmFitPts(g.m.map(p => p.ap), 2, 11); });
  $('apMapPins').querySelectorAll('.wm-pin').forEach(b => b.onclick = e => { e.stopPropagation(); wmOpen(b.dataset.icao); });
  wmPopPlace();
}
function wmHref(ap){ return '#' + AP_ROUTE[ap.icao]; }
function wmOpen(icao){
  const ap = AIRPORTS_NET.find(a => a.icao === icao);
  if (ap.status === 'live') { location.href = wmHref(ap); return; }
  // roadmap airports have no page yet: show a short card at the pin
  WM.sel = icao;
  $('apMapPop').innerHTML = `<button type="button" class="x" aria-label="Close">×</button>
    <div class="id"><span class="icao">${ap.icao}</span><span class="icao" style="color:var(--faint)">${ap.iata}</span><span class="badge ${ap.status}">${STATUS_TXT[ap.status]}</span></div>
    <h3>${esc(ap.name)}</h3><div class="ctry">${esc(ap.ctry)} · RWY ${ap.rwys.join(' · ')}</div><p>${esc(ap.blurb)}</p>
    <div class="note">On the roadmap. It can't be controlled yet.</div>`;
  $('apMapPop').hidden = false; $('apMapPop').querySelector('.x').onclick = wmClose;
  wmPins();
}
function wmClose(){ if (!WM.sel) return; WM.sel = null; $('apMapPop').hidden = true; wmPins(); }
function wmPopPlace(){
  const pop = $('apMapPop'); if (!WM.sel || pop.hidden) return;
  const ap = AIRPORTS_NET.find(a => a.icao === WM.sel), [x, y] = wmScreen(wmX(ap.ll[1]), wmY(ap.ll[0]));
  if (!WM.list.includes(ap) || x < 0 || x > WM.w || y < 0 || y > WM.h) { WM.sel = null; pop.hidden = true; return; }
  const pw = pop.offsetWidth, ph = pop.offsetHeight;
  pop.style.left = clamp(x - pw/2, 8, WM.w - pw - 8) + 'px';
  pop.style.top = (y - 40 - ph > 8 ? y - 40 - ph : Math.min(y + 14, WM.h - ph - 8)) + 'px';
}
// frame a set of airports (or the whole world when empty), zooming in at least minStep and no further than maxZ
function wmFitPts(aps, minStep, maxZ = 6){
  if (!aps.length) { WM.cx = 0.5; WM.cy = 0.5; WM.z = 0; wmClamp(); return wmDraw(); }
  const xs = aps.map(a => wmX(a.ll[1])), ys = aps.map(a => wmY(a.ll[0]));
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const span = Math.max((x1 - x0)/(WM.w - 120), (y1 - y0)/(WM.h - 120), 1e-9);
  let z = Math.min(Math.log2(1/(256*span)), maxZ);
  if (minStep) z = Math.min(Math.max(z, WM.z + minStep), 11);
  WM.cx = (x0 + x1)/2; WM.cy = (y0 + y1)/2; WM.z = z; wmClamp(); wmDraw();
}
function wmFit(){ wmFitPts(WM.list); }
function wmSize(){
  const box = $('apMap'), r = box.getBoundingClientRect(); if (!r.width) return false;
  WM.dpr = window.devicePixelRatio || 1; WM.w = r.width; WM.h = r.height;
  const cv = $('apMapCv'); cv.width = Math.round(r.width*WM.dpr); cv.height = Math.round(r.height*WM.dpr);
  wmClamp(); return true;
}
function wmRender(){ if (wmSize()) wmDraw(); }
function wmZoomAt(dz, px, py){
  // keep the point under the cursor fixed
  const ws0 = wmWorld(), nx = WM.cx + (px - WM.w/2)/ws0, ny = WM.cy + (py - WM.h/2)/ws0;
  WM.z += dz; wmClamp();
  const ws = wmWorld(); WM.cx = nx - (px - WM.w/2)/ws; WM.cy = ny - (py - WM.h/2)/ws; wmClamp(); wmDraw();
}
function setApView(v){
  apf.view = v;
  $('apView').dataset.v = v;
  $('apView').querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', String(b.dataset.v === v)));
  $('apGrid').hidden = v !== 'list'; $('apMap').hidden = v !== 'map';
  if (v === 'map') { const first = !WM.w; wmSize(); if (first) wmFit(); wmDraw(); }
}
$('apView').querySelectorAll('button').forEach(b => b.onclick = () => setApView(b.dataset.v));
$('apView').addEventListener('keydown', e => { if (/^Arrow/.test(e.key)) { e.preventDefault(); const v = apf.view === 'list' ? 'map' : 'list'; setApView(v); $('apView').querySelector(`[data-v="${v}"]`).focus(); } });
$('apMap').querySelector('.wm-zoom').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return; const dz = +b.dataset.z;
  if (dz) wmZoomAt(dz, WM.w/2, WM.h/2); else { WM.z = 0; WM.cx = 0.5; WM.cy = 0.5; wmClamp(); wmDraw(); }
});
$('apMap').addEventListener('wheel', e => {
  e.preventDefault(); const r = $('apMap').getBoundingClientRect();
  wmZoomAt(clamp(-e.deltaY*(e.deltaMode ? 0.05 : 0.0025), -1, 1), e.clientX - r.left, e.clientY - r.top);
}, { passive: false });
{ // drag to pan, pinch to zoom; a press that doesn't move is a click
  const ptr = new Map(); let pinch = null, moved = false;
  const box = $('apMap');
  box.addEventListener('pointerdown', e => {
    if (e.target.closest('button, a, .wm-pop')) return;
    box.setPointerCapture(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]); moved = false;
    if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]), z: WM.z }; }
  });
  box.addEventListener('pointermove', e => {
    const p = ptr.get(e.pointerId); if (!p) return;
    const dx = e.clientX - p[0], dy = e.clientY - p[1]; ptr.set(e.pointerId, [e.clientX, e.clientY]);
    if (Math.abs(dx) + Math.abs(dy) > 0) moved = true;
    if (ptr.size === 2 && pinch) {
      const [a, b] = [...ptr.values()], r = box.getBoundingClientRect();
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]); wmZoomAt(pinch.z + Math.log2(d/pinch.d) - WM.z, (a[0] + b[0])/2 - r.left, (a[1] + b[1])/2 - r.top);
      return;
    }
    if (ptr.size === 1) { const ws = wmWorld(); WM.cx -= dx/ws; WM.cy -= dy/ws; wmClamp(); wmDraw(); box.classList.add('drag'); }
  });
  const up = e => {
    if (!ptr.delete(e.pointerId)) return; if (ptr.size < 2) pinch = null;
    if (!ptr.size) { box.classList.remove('drag'); if (!moved) wmClose(); }
  };
  box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
  box.addEventListener('dblclick', e => { if (e.target.closest('button, .wm-pop')) return; const r = box.getBoundingClientRect(); wmZoomAt(1, e.clientX - r.left, e.clientY - r.top); });
}
window.addEventListener('resize', () => { if (apf.view === 'map' && curRoute === 'airports') wmRender(); });
$('apMapKey').innerHTML = ['live', 'dev', 'plan'].map(s => `<span><i style="background:${WM_COL[s]}"></i>${STATUS_TXT[s]}</span>`).join('');

// ── overview: animated hero scope ──
const hero = { cv: $('heroScope'), base: null, map: null, ang: 0, blips: [], trail: [] };
const HERO_TRAFFIC = APT.site && APT.site.hero ? APT.site.hero() : APT.icao === 'LPMA' ? [
  ['TAP1681', 33.30, -16.15, 225, 280, PAL.light.arr], ['EZY8712', 32.68, -16.62, 87, 220, PAL.light.dep],
  ['EXS1291', 33.35, -16.95, 160, 250, PAL.light.arr], ['IBB3021', 32.25, -16.45, 20, 230, PAL.light.arr],
  ['TOM4407', 32.95, -16.40, 40, 260, PAL.light.dep], ['TAP211', 31.95, -17.45, 30, 450, 'rgba(60,75,95,.7)'],
  ['RYR5TQ', 33.55, -17.30, 160, 440, 'rgba(60,75,95,.7)'], ['CFG1KD', 32.15, -15.95, 330, 440, 'rgba(60,75,95,.7)']
] : [
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
  hero.map = drawTo(hero.cv, 'app', { acs: [], proc: true, tweak: v => { v.cy = RADAR_REF[1] - 1; v.scale = r.height/62; v.cx = RADAR_REF[0] + (r.width > 700 ? 3 : 0); } });
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
    const hx = x => w/2 + (x - m.cx)*m.scale, hy = y => h/2 - (MY(y) - MY(m.cy))*m.scale;
    g.setTransform(1,0,0,1,0,0); g.drawImage(hero.base, 0, 0); g.setTransform(hero.dpr,0,0,hero.dpr,0,0);
    const ox = hx(RADAR_REF[0]), oy = hy(RADAR_REF[1]), R = Math.hypot(w, h);
    const prevAng = hero.ang; hero.ang = (hero.ang + dt*Math.PI*2/4.8) % (Math.PI*2);
    // sweep wedge
    const grd = g.createConicGradient ? g.createConicGradient(hero.ang - Math.PI/2 - 0.9, ox, oy) : null;
    if (grd) { grd.addColorStop(0, 'rgba(31,94,255,0)'); grd.addColorStop(0.143, 'rgba(31,94,255,.14)'); grd.addColorStop(0.1431, 'rgba(31,94,255,0)'); g.fillStyle = grd; g.fillRect(0,0,w,h); }
    g.strokeStyle = 'rgba(31,94,255,.5)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(ox, oy); g.lineTo(ox + Math.sin(hero.ang)*R, oy - Math.cos(hero.ang)*R); g.stroke();
    // targets move continuously; the displayed return only updates as the sweep passes
    for (const b of hero.blips) {
      const sp = b.kt/3600*dt*6; // 6× time so the picture visibly moves
      b.p = [b.p[0] + Math.sin(b.trk*D2R)*sp, b.p[1] + Math.cos(b.trk*D2R)*sp];
      if (Math.hypot(b.p[0] - RADAR_REF[0], b.p[1] - RADAR_REF[1]) > 46) { b.trk = (b.trk + 180) % 360; }
      const a = (Math.atan2(b.p[0] - RADAR_REF[0], b.p[1] - RADAR_REF[1]) + Math.PI*2) % (Math.PI*2);
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
window.addEventListener('resize', () => { hero.map = null; if (curRoute === 'home' || isApRoute(curRoute)) renderThumbs(); if (curRoute === 'training') renderFigure(); if (curRoute === 'career') renderCareer(); });

// position thumbnails reuse the real renderer
// sample traffic for the previews: parked, taxiing, on final and climbing out
function demoTraffic(){
  const mk = (cs, t, k, set) => { const ac = new Aircraft({ cs, t, k, o: 'EGLL', d: 'EGKK' }); ac.kind = k; Object.assign(ac, set); ac.trk = ac.hdg; return ac; };
  const st = id => STANDS.find(s => s.id === id), park = (id, extra) => ({ ground: true, state: 'PARKED', stand: st(id), x: st(id).p[0], y: st(id).p[1], hdg: st(id).hdg, reqAt: 0, need: 'Start-up', ...extra });
  if (APT.site && APT.site.demo) return APT.site.demo(mk, park);
  if (APT.icao === 'LPMA') {
    // on the visual circuit to 05, rounding Rosário onto short final
    const FP = FINAL[RW_LO].pts, k0 = FP.length - 3, fin = FP[k0], fhd = Math.round(norm(Math.atan2(FP[k0+1][0] - fin[0], FP[k0+1][1] - fin[1])/D2R)), end = rm(RWY_M, 0), out = [end[0] + Math.sin(100*D2R)*5, end[1] + Math.cos(100*D2R)*5], twy = GN.JC.p;
    const pil = WP.PILIM.p, ent = ENTRY.N, inb = [pil[0] + (ent[0] - pil[0])*0.2, pil[1] + (ent[1] - pil[1])*0.2];
    return [
      mk('TAP1680', 'A20N', 'DEP', park('A3', { need: null, reqAt: 99999 })), mk('EZY8712', 'A20N', 'DEP', park('A6', { need: null, reqAt: 99999 })), mk('TOM4407', 'B38M', 'DEP', park('A9', { need: null, reqAt: 99999 })),
      mk('IBB3020', 'AT76', 'DEP', park('A12', { need: null, reqAt: 99999 })),
      mk('EXS1292', 'B738', 'DEP', { ground: true, state: 'TAXI', hp: 'C', x: twy[0], y: twy[1], hdg: CRS_HI, gs: 12 }),
      mk('TAP1681', 'A21N', 'ARR', { state: 'FINAL', mode: 'FINAL', app: RW_LO, freq: 'TWR', x: fin[0], y: fin[1], hdg: fhd, alt: 600, gs: 140, vs: -700, o: 'LPPT' }),
      mk('EZY8714', 'A20N', 'DEP', { state: 'CLIMB', x: out[0], y: out[1], hdg: 90, alt: 5000, gs: 220, vs: 1500, tgtAlt: 6000, d: 'EGKK' }),
      mk('EXS1291', 'B738', 'ARR', { state: 'INBOUND', x: inb[0], y: inb[1], hdg: 200, alt: 9000, gs: 260, vs: -1200, tgtAlt: 5000, o: 'EGCC' })
    ];
  }
  const fin = rm(THR27_M + 2.1*1852, 0), out = rm(-9*1852, -9*1852), twy = GN.L4.p, inb = xy(36.42, -4.86);
  return [
    mk('BAW491', 'A20N', 'DEP', park('2', { need: null, reqAt: 99999 })), mk('EZY8904', 'A20N', 'DEP', park('3', { need: null, reqAt: 99999 })), mk('RRR4419', 'A400', 'DEP', park('S2', { need: null, reqAt: 99999 })),
    mk('GXJET', 'C56X', 'DEP', park('N1', { need: null, reqAt: 99999 })),
    mk('EZY8902', 'A20N', 'DEP', { ground: true, state: 'TAXI', hp: 'E', x: twy[0], y: twy[1], hdg: CRS09, gs: 12 }),
    mk('BAW492', 'A20N', 'ARR', { state: 'FINAL', mode: 'FINAL', app: '27', freq: 'TWR', x: fin[0], y: fin[1], hdg: CRS27, alt: 700, gs: 140, vs: -700, o: 'EGLL' }),
    mk('RAM1473', 'AT76', 'DEP', { state: 'CLIMB', x: out[0], y: out[1], hdg: 200, alt: 4000, gs: 200, vs: 1200, tgtAlt: 6000, d: 'GMMN' }),
    mk('TOM6262', 'B738', 'ARR', { state: 'INBOUND', x: inb[0], y: inb[1], hdg: 245, alt: 8000, gs: 280, vs: -1200, tgtAlt: 7000, o: 'EGGW' })
  ];
}
function renderThumbs(){
  const acs = demoTraffic();
  document.querySelectorAll('canvas[data-thumb]').forEach(c => {
    if (!c.getBoundingClientRect().width) return;
    const ap = blockAp(c) || APT.icao;
    if (ap === APT.icao) drawThumb(c, acs); else embedDraw(c, ap, 'thumb');
  });
}
function drawThumb(c, acs){
  {
    const k = c.dataset.thumb;
    // the ground card zooms in on the civil apron; the aerodrome figure keeps the whole runway
    const lp = APT.icao === 'LPMA', apron = c.dataset.zoom === 'apron' ? (lp ? STANDS.reduce((a, s) => [a[0] + s.p[0]/STANDS.length, a[1] + s.p[1]/STANDS.length], [0, 0]) : rm(1215, 95)) : null;
    // Madeira's runway runs diagonally: frame the whole runway (aerodrome) or the 05 end and short final (tower)
    const W = c.getBoundingClientRect().width, mid = lp && rm(RWY_M*0.5, -120), twr = lp && (() => { const FP = FINAL[RW_LO].pts, f = FP[FP.length - 3], t = rm(THR_LO_M, 0); return [(f[0] + t[0])/2, (f[1] + t[1])/2]; })();
    const lpT = k === 'gnd' ? (v => { v.cx = mid[0]; v.cy = mid[1]; v.scale = W/2900*1852; }) : k === 'twr' ? (v => { v.cx = twr[0]; v.cy = twr[1]; v.scale = W/3; }) : null;
    if (APT.site && APT.site.thumb) return drawTo(c, k, { proc: true, acs, tweak: APT.site.thumb(k, c.dataset.zoom, W) });
    drawTo(c, k, { proc: true, acs, tweak: k === 'app' ? (lp ? (v => { v.scale *= 1.3; }) : (v => { v.scale *= 1.6; v.cx += 2; v.cy += 3; })) : apron ? (v => { v.cx = apron[0]; v.cy = apron[1]; v.scale = 1852*(lp ? 0.8 : 1.05); }) : lp ? lpT : null });
  }
}
function refreshPreviews(){
  if (EMBED) { if (window.cwOnRefresh) window.cwOnRefresh(); else if (window.cwPaint) window.cwPaint(); return; }
  if (curRoute === 'home' || isApRoute(curRoute)) { renderThumbs(); hero.map = null; }
  if (curRoute === 'training') renderFigure();
}

// ── another airport's maps on the host page ──
// Each airport's maps need its own engine (geometry, stands, procedures), so the host page asks that airport's page to
// draw them: a hidden same-origin helper frame (#embed) draws each canvas at the right size and the host copies the
// pixels. Where the frame can't be scripted (a different origin), the canvas is replaced by a small frame of its own.
const HELP = {};
function helperFor(ic){
  if (HELP[ic]) return HELP[ic];
  const fr = document.createElement('iframe'), h = HELP[ic] = { fr, win: null, dead: false };
  fr.className = 'embed-helper'; fr.tabIndex = -1; fr.title = `${ic} map renderer`; fr.setAttribute('aria-hidden', 'true');
  fr.addEventListener('load', () => {
    try { const w = fr.contentWindow; if (typeof w.cwDraw !== 'function') throw 0; w.cwOnRefresh = () => drawEmbeds(ic); h.win = w; } catch(e) { h.dead = true; }
    drawEmbeds(ic);
  });
  fr.src = SITE[ic] + '#embed'; document.body.appendChild(fr);
  return h;
}
function embedDraw(c, ic, kind){
  c.dataset.embed = ic; c.dataset.embedKind = kind;
  const h = helperFor(ic), r = c.getBoundingClientRect(); if (!r.width) return;
  const sp = { kind, k: c.dataset.thumb, zoom: c.dataset.zoom };
  if (h.win) {
    try { const src = h.win.cwDraw(sp, r.width, r.height); c.width = src.width; c.height = src.height; c.getContext('2d').drawImage(src, 0, 0); } catch(e) { console.warn('embed', e); }
  } else if (h.dead && !c.dataset.framed) {
    c.dataset.framed = '1';
    const f = document.createElement('iframe'); f.className = 'embed-fr'; f.loading = 'lazy'; f.tabIndex = -1; f.title = c.getAttribute('aria-label') || ic;
    f.src = `${SITE[ic]}#embed:${kind}:${sp.k || ''}:${sp.zoom || ''}`; f.style.aspectRatio = `${r.width} / ${r.height}`;
    c.style.display = 'none'; c.after(f);
  }
}
function drawEmbeds(ic){ document.querySelectorAll(`canvas[data-embed="${ic}"]`).forEach(c => { if (c.getBoundingClientRect().width) embedDraw(c, ic, c.dataset.embedKind); }); }
// this page as the renderer: cwDraw for the host's helper frame, or one full-window map for #embed:<kind>:<key>:<zoom>
function drawSpec(c, sp){
  if (sp.kind === 'fig') return drawTo(c, 'gnd', { acs: [], proc: false });
  c.dataset.thumb = sp.k; if (sp.zoom) c.dataset.zoom = sp.zoom; else delete c.dataset.zoom;
  drawThumb(c, demoTraffic());
}
if (EMBED) {
  document.body.classList.add('embed');
  const ecv = document.createElement('canvas'), [, kind, k, zoom] = location.hash.split(':');
  ecv.className = 'embed-cv'; document.body.appendChild(ecv);
  window.cwDraw = (sp, w, h) => { ecv.style.width = w + 'px'; ecv.style.height = h + 'px'; drawSpec(ecv, sp); return ecv; };
  if (kind) { ecv.classList.add('full'); window.cwPaint = () => drawSpec(ecv, { kind, k, zoom }); window.addEventListener('resize', window.cwPaint); requestAnimationFrame(window.cwPaint); }
}

// scenarios: one card per weather preset, opening the simulator with that weather
const SCEN_TEXT = { LPMA: {
  trade: 'The north-east trade wind, the usual Madeira day. Runway 05 with the VOR approach and the Rosário circuit.',
  nortada: 'A strong northerly over the limit at Rosário. Arrivals refuse the approach: hold them at PILIM and plan for Porto Santo.',
  tradeMax: 'The trade wind at gale force, right at the 05 limit. Some crews land, some hold. Watch every gust.',
  sw: 'A south-westerly front with rain. Runway 23, the higher VOR 23 minima and a visual approach close to the cliffs.',
  low: 'Low cloud below the runway 23 circling and RNP minima. Crews hold and divert while the departures keep moving.',
  murk: 'Drizzle and cloud at 800 ft. Below the VOR circling minima but above the RNP ones, so every arrival needs an RNP AR approach.',
  calima: 'Saharan dust from the south-east. Visibility down to 3 km and a light easterly.',
  calm: 'Light and variable wind and a clear sky. A good day to learn the circuit.'
}, EGLC: {
  sw: 'The usual south-westerly. Runway 27 with the ILS from the LAVNO transition, departures from Mike on RNAV SIDs capped at 3,000 ft.',
  east: 'An easterly. Runway 09, arrivals round the south of London to ODLEG and a short final past the Canary Wharf towers.',
  low: 'Drizzle and a 400 ft cloud base. The 5.5° ILS still works, just: watch the four-mile check against the approach ban.',
  fog: 'Thames fog below the ILS minima. Hold arrivals at JACKO and GODLU and plan diversions to Southend while departures wait for the visibility.',
  storm: 'A gusty south-westerly gale across the docks. Expect turbulence on short final and some go-arounds.',
  calm: 'High pressure, light and variable winds and haze. A quiet day to learn the flow.'
}, KJFK: {
  sw: 'The summer sea breeze from the south-west. Land 22L, depart 22R, and cross every arrival over 22R on its way to the terminals.',
  ne: 'A north-easter off the Atlantic. Land 4R, depart 4L: the arrivals cross 4L at the end of their roll-out.',
  nw: 'A clear, gusty north-westerly behind a cold front. Land 31R over Howard Beach, depart 31L with the Breezy Point climb.',
  se: 'Low cloud off the ocean. Land the ILS 13L over Jamaica Bay, depart 13R towards the Canarsie VOR.',
  ifr: 'Rain and a 400 ft ceiling, the ILS 4R close to its minimums. Expect missed approaches and keep the spacing wide.',
  storm: 'Summer thunderstorms over the field. Gusts and microburst alerts on final: some arrivals will go around.',
  fog: 'Dense fog below the CAT I minimums. Hold arrivals at the end of their arrivals and plan diversions to Newark and Boston.',
  snow: 'Snow on a north-easterly gale. Low visibility, a wet runway and a long wait for every departure.'
}, LOWI: {
  west: 'The usual light westerly. Arrivals land 26 off the LOC/DME East while departures leave on 08 down the valley towards them.',
  calm: 'A still autumn morning with haze in the valley. Land 26, depart 08, and sequence them head-on through the Inn valley.',
  foehn: 'A föhn gale off the Brenner. Severe turbulence and downdraughts on final: expect go-arounds and diversions to Munich.',
  east: 'An easterly. Arrivals fly the LOC/DME East and circle south of the city to land on 08, or the RNP approaches from the west.',
  stratus: 'Low stratus fills the valley, below the LOC/DME East minima and the RNP ones. Hold at RTT and plan the diversions.',
  snow: 'Winter snow showers and a 2,000 ft ceiling, just above the LOC/DME East minima. Watch every approach.',
  storm: 'Afternoon thunderstorms over the Nordkette, gusty and wet. Some arrivals will go around.'
}, LXGB: {
  fair: 'A gentle westerly and good visibility. Learn the flow: road closures, backtracks and the SRA to runway 27.',
  levanter: 'The easterly gale and its banner cloud. Runway 09, approaches through RIPRA, and turbulence curling off the Rock.',
  southerly: 'The Rock sits directly upwind of final. The wind is beyond the Special Procedures turbulence limit, so expect go-arounds.',
  poniente: 'A gusty south-westerly with waterspouts on the runway 27 approach. Crosswind limits start to bite.',
  cross: 'A northerly blowing straight across the runway. Smaller types will refuse the approach and hold.',
  fog: 'Sea fog below SRA minima. Hold arrivals, plan diversions to Málaga and Tangier, and keep the departures moving.',
  storm: 'Cumulonimbus in the Strait. Reduced visibility, gusts, and crews asking to avoid cells.'
} };
function openScenario(k){
  $('wxPreset').value = k; $('wxPreset').dispatchEvent(new Event('change')); $('trafficSel').value = 'summer'; $('wxPaste').value = '';
  if (S.running) { S.running = false; resetSession(); }
  location.hash = 'sim'; go('sim'); openSetup();
}
// each grid shows its own airport's presets; another airport's card opens that airport's simulator
function renderScenarios(){
  document.querySelectorAll('[data-scen]').forEach(g => { g.innerHTML = '';
  const ic = blockAp(g) || APT.icao, here = ic === APT.icao, P = here ? WX_PRESETS : AP_DATA[ic] && AP_DATA[ic].WX_PRESETS;
  for (const [k, v] of Object.entries(P || {})) {
    const b = document.createElement('button'); b.type = 'button';
    b.innerHTML = `<span class="nm">${esc(v.short)}</span><span class="ds">${esc((SCEN_TEXT[ic] || {})[k] || v.name)}</span><span class="mt">${esc(v.metar.replace(/^[A-Z]{4} \d{6}Z /, ''))}</span><span class="go">Open position ›</span>`;
    b.onclick = () => here ? openScenario(k) : (location.href = SITE[ic] + '#wx/' + k);
    g.appendChild(b);
  } });
}

// ── training guide ──
// The core course, then one airport endorsement at a time: pick it on the hub, the picker after the core course or the
// contents list. Every airport's endorsement is on this page, so the choice only shows and hides sections.
let endorse = (() => { try { const v = localStorage.getItem('cw-endorse'); if (LIVE_APS.includes(v)) return v; } catch(e) {} return APT.icao; })();
const endorseCss = document.head.appendChild(document.createElement('style'));
const firstSec = ic => document.querySelector(`#page-training section[data-track="ap"][data-apt="${ic}"]`);
function setEndorse(ic){
  if (!LIVE_APS.includes(ic) || !firstSec(ic)) return;
  endorse = ic; try { localStorage.setItem('cw-endorse', ic); } catch(e) {}
  endorseCss.textContent = `#page-training [data-apt]:not([data-apt~="${ic}"]){display:none!important}`;
  buildToc(); renderPicker();
  if (curRoute === 'training') requestAnimationFrame(() => { renderFigure(); spy(); });
}
function renderPicker(){
  const pk = $('endPick'); if (!pk) return;
  pk.innerHTML = `<div class="lbl">Core course complete? Choose your endorsement</div><div class="opts">${LIVE_APS.filter(firstSec).map(ic => `<a href="#${firstSec(ic).id}" class="${ic === endorse ? 'on' : ''}" aria-current="${ic === endorse}"><b>${ic}</b>${esc(ENDORSE[ic].name)}</a>`).join('')}</div>`;
}
const guideSecs = () => [...document.querySelectorAll('#page-training section[data-track]')].filter(s => !s.dataset.apt || s.dataset.apt === endorse);
function buildToc(){
  const box = $('tocList'); box.innerHTML = '';
  const groups = [['core', 'Core course'], ['ap', `${ENDORSE[endorse].name} endorsement`]];
  let n = 0;
  for (const [tr, title] of groups) {
    const lbl = document.createElement('div'); lbl.className = 'lbl'; lbl.textContent = title; box.appendChild(lbl);
    if (tr === 'ap') { const sw = document.createElement('div'); sw.className = 'tocap'; sw.innerHTML = LIVE_APS.filter(firstSec).map(ic => `<a href="#${firstSec(ic).id}" class="${ic === endorse ? 'on' : ''}" title="${esc(ENDORSE[ic].name)} endorsement">${ic}</a>`).join(''); box.appendChild(sw); }
    const ol = document.createElement('ol'); box.appendChild(ol); let k = 0;
    for (const sec of guideSecs().filter(s => s.dataset.track === tr)) {
      const h = sec.querySelector('h2'); if (!h) continue;
      const num = h.querySelector('.n'); if (num) num.textContent = tr === 'core' ? 'C' + (++k) : String(++n).padStart(2, '0');
      const li = document.createElement('li'), a = document.createElement('a');
      a.href = '#' + sec.id; a.textContent = h.textContent.replace(/^(C\d+|\d+)/, '').trim(); a.dataset.for = sec.id;
      li.appendChild(a); ol.appendChild(li);
    }
  }
  // the endorsement's exercises, named as on its exercise cards
  const exName = k => { const b = document.querySelector(`#page-training .ex [data-ex="${k}"]`), nm = b && b.closest('.ex').querySelector('.nm'); return nm ? nm.textContent : k; };
  $('tocEx').innerHTML = ENDORSE[endorse].ex.map(k => `<button class="btn" data-ex="${k}">${esc(exName(k))}</button>`).join('');
  $('tocEx').querySelectorAll('[data-ex]').forEach(b => b.onclick = () => startExercise(b.dataset.ex));
}
// Academy hub: the core course and one endorsement card per open airport, with exercise progress from the logbook
const ENDORSE = {
  LXGB: { name: 'Gibraltar', ex: ['dep', 'arr', 'lev'], badge: 'graduate', p: 'The road across the runway, the SRA, the levanter and releases from Sevilla and Casablanca.' },
  LPMA: { name: 'Madeira', ex: ['mdep', 'marr', 'mwind'], badge: 'island', p: 'Wind limits at two anemometers, the Rosário circuit to runway 05, SIDs out to sea and Lisboa releases.' },
  EGLC: { name: 'London City', ex: ['cdep', 'carr', 'ceast'], badge: 'docklands', p: 'The 5.5° ILS past Canary Wharf, RNAV SIDs held at 3,000 ft under the London TMA, and arrivals from the JACKO and GODLU holds.' },
  LOWI: { name: 'Innsbruck', ex: ['idep', 'iarr', 'ifoehn'], badge: 'valley', p: 'The offset LOC/DME East from RTT, circling to 08, departures down the valley against the arrivals, minimum vectoring altitudes and föhn.' },
  KJFK: { name: 'New York JFK', ex: ['kdep', 'karr', 'kcross'], badge: 'kennedy', p: 'Four runways in two parallel pairs, the Kennedy Five, ILS approaches, runway crossings, calls for release on flow-restricted routes and FAA phraseology.' }
};
function renderHub(){
  const h = $('acHub'); if (!h) return;
  const done = k => !!(CAR.ex && CAR.ex[k]);
  const card = (ic, E) => { const n = E.ex.filter(done).length, here = ic === endorse, got = CAR.badges && CAR.badges[E.badge], b = BADGES.find(x => x.id === E.badge);
    return `<div class="hubcard${here ? ' here' : ''}"><div class="lbl">${ic} · endorsement</div><h3>${E.name}</h3><p>${E.p}</p>
      <div class="hubprog">${E.ex.map(k => `<i class="${done(k) ? 'done' : ''}"></i>`).join('')}<span>${n} of 3 exercises${got ? ` · <b>${esc(b.name)}</b> earned` : ''}</span></div>
      <a class="btn${here ? ' primary' : ''}" href="#${firstSec(ic) ? firstSec(ic).id : 'training'}">${here ? 'Read the briefing' : 'Open ' + E.name}</a></div>`; };
  const core = guideSecs().find(s => s.dataset.track === 'core');
  h.innerHTML = `<div class="hubcard"><div class="lbl">Every airport</div><h3>Core course</h3><p>The scope, strips and side panel, the radio, every command, emergencies and how scoring works.</p><div class="hubprog"><span>${guideSecs().filter(s => s.dataset.track === 'core').length} lessons</span></div><a class="btn" href="#${core ? core.id : ''}">Start the core course</a></div>`
    + LIVE_APS.filter(ic => ENDORSE[ic]).map(ic => card(ic, ENDORSE[ic])).join('');
}
function spy(){
  if (curRoute !== 'training') return;
  const secs = guideSecs();
  let cur = secs[0];
  for (const s of secs) if (s.getBoundingClientRect().top < 140) cur = s;
  document.querySelectorAll('#tocList li a').forEach(a => a.classList.toggle('on', cur && a.dataset.for === cur.id));
}
window.addEventListener('scroll', spy, { passive: true });
function buildTurbTable(){
  const ks = Object.keys(TURB_TABLE); if (!ks.length || !$('turbTable')) return;
  $('turbTable').innerHTML = `<thead><tr><th scope="row">Wind from (°M)</th>${ks.map(k => `<th>${k}</th>`).join('')}</tr></thead><tbody><tr><th scope="row">Turbulence above (kt)</th>${ks.map(k => `<td>${TURB_TABLE[k]}</td>`).join('')}</tr></tbody>`;
}
function renderFigure(){
  renderHub();
  document.querySelectorAll('canvas[data-fig="aerodrome"]').forEach(c => {
    const ap = blockAp(c) || APT.icao;
    c.style.aspectRatio = ap === 'LPMA' ? '1.9 / 1' : ap === 'EGLC' ? '3.6 / 1' : ap === 'LOWI' ? '3 / 1' : ap === 'KJFK' ? '1.5 / 1' : '2.25 / 1';
    if (!c.getBoundingClientRect().width) return;
    if (ap === APT.icao) drawTo(c, 'gnd', { acs: [], proc: false }); else embedDraw(c, ap, 'fig');
  });
  renderAcademyFigs();
}
// ── Academy figures, drawn live from the simulator so they always match what you see on the scope ──
const dirNM = h => [Math.sin(h*D2R), Math.cos(h*D2R)];
const addv = (p, h, d) => [p[0] + dirNM(h)[0]*d, p[1] + dirNM(h)[1]*d];
function sidPath(gate, rw){
  const pts = [];
  if (rw === '27') { const p0 = rm(150, 0); pts.push(p0); let p = addv(p0, CRS27, 0.6); pts.push(p); for (const h of [250, 230, 212]) { p = addv(p, h, 0.35); pts.push(p); } p = addv(p, 200, 2.6); pts.push(p); }
  else { const p0 = rm(RWY_M - 150, 0); pts.push(p0); let p = addv(p0, CRS09, 1.3); pts.push(p); for (const h of [110, 135, 152]) { p = addv(p, h, 0.35); pts.push(p); } p = addv(p, 160, 2.2); pts.push(p); }
  for (const id of EXIT_ROUTE[gate]) pts.push(WP[id].p);
  return pts;
}
function figPins(fig, pins){
  fig.querySelectorAll('.pin').forEach(p => p.remove());
  const cv = fig.querySelector('canvas'), r = cv.getBoundingClientRect();
  pins.forEach(([x, y], i) => { const b = document.createElement('span'); b.className = 'pin'; b.textContent = i + 1; b.style.left = (x/r.width*100) + '%'; b.style.top = (y/r.height*100) + '%'; fig.querySelector('.figwrap').appendChild(b); });
}
function renderAcademyFigs(){
  const acs = demoTraffic();
  // 1 · console anatomy
  const fc = $('figConsole');
  if (fc) {
    fc.style.aspectRatio = '1.7 / 1';
    const inbA = acs.find(a => a.kind === 'ARR' && a.state === 'INBOUND'), depA = acs.find(a => a.state === 'CLIMB'), fin = acs.find(a => a.state === 'FINAL');
    const lp = APT.icao !== 'LXGB', zone = lp ? APT.terrain.poly : R164, hold = APT.site && APT.site.figHold ? WP[APT.site.figHold].p : lp ? WP.PILIM.p : WP.UPMUP.p;
    const zc = zone.reduce((a, p) => [a[0] + p[0]/zone.length, a[1] + p[1]/zone.length], [0, 0]);
    const o = drawTo(fc, 'app', { proc: true, acs, tweak: APT.site && APT.site.figConsole ? APT.site.figConsole : lp ? (v => { v.scale *= 1.25; v.cx += 2; }) : (v => { v.scale *= 1.7; v.cx += 2.5; v.cy += 3.5; }), pins: [[inbA.x - 1.6, inbA.y - 0.4], [depA.x - 1.6, depA.y - 0.4], [fin.x + 0.6, fin.y - 1.6], [hold[0] - 1.2, hold[1] - 1.2], zc] });
    if (o) figPins(fc.closest('figure'), o.pins);
  }
  // 2 · departure routes
  const fs = $('figSids');
  if (fs && APT.icao === 'LXGB') {
    fs.style.aspectRatio = '1.5 / 1';
    drawTo(fs, 'app', { proc: false, acs: [], tweak: v => { v.scale *= 1.3; v.cx += 0.5; v.cy -= 5.5; }, post: () => {
      const col = { '27': '#1f5eff', '09': '#c2700a' };
      cx.save(); cx.lineJoin = cx.lineCap = 'round';
      for (const rw of ['27', '09']) for (const g of ['E', 'W', 'S']) {
        const pts = sidPath(g, rw);
        cx.strokeStyle = 'rgba(255,255,255,.85)'; cx.lineWidth = 6; cx.setLineDash([]); cx.beginPath(); pts.forEach((p, i) => i ? cx.lineTo(sx(p[0]), sy(p[1])) : cx.moveTo(sx(p[0]), sy(p[1]))); cx.stroke();
        cx.strokeStyle = col[rw]; cx.lineWidth = 2.6; cx.setLineDash(rw === '09' ? [8, 6] : []); cx.stroke();
      }
      cx.setLineDash([]); cx.font = `700 12.5px ${FONT_D}`;
      const lab = { E: [8, -6], W: [-10, -10], S: [12, 4] };
      for (const g of ['E', 'W', 'S']) { const p = WP[EXIT_FIX[g]].p, X = sx(p[0]) + lab[g][0], Y = sy(p[1]) + lab[g][1]; const t = `${EXIT_FIX[g]} 1A · 1B`; const w = cx.measureText(t).width; const X2 = g === 'W' ? X - w : X; cx.fillStyle = 'rgba(255,255,255,.92)'; cx.fillRect(X2 - 4, Y - 13, w + 8, 18); cx.fillStyle = '#0c1b2e'; cx.fillText(t, X2, Y); }
      cx.restore();
    } });
  }
  // 3 · emergency on short final with the runway closed
  const fe = $('figEmerg');
  if (fe) {
    fe.style.aspectRatio = '2.2 / 1';
    const lo = APT.icao === 'LPMA', fin = lo ? rm(THR_LO_M - 0.75*1852, 0) : rm(THR_HI_M + 0.75*1852, 0), hpk = APT.site && APT.site.emergHp || (lo ? 'C' : 'A'), hp = GN[HOLDS[hpk].node].p, rwF = lo ? RW_LO : RW_HI, crsF = lo ? CRS_LO : CRS_HI;
    const may = new Aircraft({ cs: 'EXS96K', t: 'B738', k: 'ARR', o: 'EGCC' }); Object.assign(may, { kind: 'ARR', state: 'FINAL', mode: 'FINAL', app: rwF, freq: 'TWR', x: fin[0], y: fin[1], hdg: crsF, trk: crsF, alt: 450, gs: 150, vs: -700, emerg: { k: 'MAYDAY', why: 'engine failure', ack: true }, sqk: '7700', need: 'Runway closed' });
    const dep = new Aircraft({ cs: 'EZY8902', t: 'A20N', k: 'DEP', d: 'EGKK' }); Object.assign(dep, { kind: 'DEP', ground: true, state: 'HOLDPT', hp: hpk, x: hp[0], y: hp[1], hdg: 180, trk: 180, rel: { st: 'OK', until: 1e9 } });
    const keep = S.emg; S.emg = { rwyBlock: { why: 'debris', until: 1e12 }, still: true };
    try { const c0 = rm(RWY_M*(lo ? 0.25 : 0.75), 0); drawTo(fe, 'twr', { proc: true, acs: [may, dep], tweak: v => { v.cx = c0[0] + (lo ? -0.25 : 0.25); v.cy = c0[1] - 0.12; v.scale *= lo ? 1.4 : 2.1; } }); } finally { S.emg = keep; }
  }
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
    { h: 'Approve start-up and push', p: 'Select BAW493 (click the strip or the aircraft), then press <b>Push</b>, or type <code>BAW493 PUSH</code>. The clearance includes its route, the PIMOS 1A departure, and its squawk, and the tug pushes it back onto the apron lane.', cmd: 'BAW493 PUSH', ok: () => !!(A('BAW493') && A('BAW493').pushed) || st('BAW493','TAXI','HOLDPT','LINEUP','LINEDUP','TAKEOFF') || sn('BAW493').airborne },
    { h: 'Taxi to holding point Echo', p: 'With runway 27 in use, departures hold at Echo, east of the terminal. When the crew reports ready, type <code>BAW493 TAXI E</code>. The clearance reads back as "taxi to holding point Echo via Bravo".', cmd: 'BAW493 TAXI E', ok: () => st('BAW493','TAXI','HOLDPT','LINEUP','LINEDUP','TAKEOFF') || sn('BAW493').airborne },
    { h: 'Request the release from Sevilla', p: 'Every Gibraltar departure needs a release from the next unit before it can take off. Press <b>Request release</b> or type <code>BAW493 REL</code>. Sevilla calls back on the landline (pink in the log) within a couple of minutes with a release and a time it is valid until.', cmd: 'BAW493 REL', ok: () => !!(A('BAW493') && A('BAW493').rel) || sn('BAW493').airborne },
    { h: 'Close Winston Churchill Avenue', p: 'Before anything goes onto the runway the road must be shut. Press <b>Close road</b> in the ATIS panel. Barriers and the FOD check take about 2½ minutes, so do it now while the aircraft taxies.', road: true, ok: () => roadShut() || sn('BAW493').airborne },
    { h: 'Line up and backtrack', p: 'Echo joins the runway at its eastern end. An A320 is over 17 tonnes, so it must use the turning circle before facing west. Type <code>BAW493 LU</code>. You will be warned if the road is still open across the backtrack.', cmd: 'BAW493 LU', ok: () => st('BAW493','LINEUP','LINEDUP','TAKEOFF') || sn('BAW493').airborne },
    { h: 'Clear for take-off', p: 'Once the road shows <b>Closed</b> and Sevilla has released the flight, type <code>BAW493 CTO</code>. Tower confirms the PIMOS 1A departure and passes the surface wind.', cmd: 'BAW493 CTO', ok: () => sn('BAW493').takeoff || sn('BAW493').airborne, wait: () => { const a = A('BAW493'); return !!a && !(a.rel && a.rel.st === 'OK' && S.xing.st === 'CLOSED'); } },
    { h: 'Transfer to Gibraltar Radar', p: 'Once airborne, transfer the flight to Radar on 122.8 with <code>BAW493 HO</code>. It calls passing its altitude and heading.', cmd: 'BAW493 HO', ok: () => (A('BAW493') && A('BAW493').freq === 'RAD') || sn('BAW493').exit },
    { h: 'Climb it and hand off to Sevilla', p: 'On the PIMOS 1A it turns left, then routes UPMUP and PIMOS by itself. When it asks for more, climb it with <code>BAW493 A80</code>. Beyond about 22 NM it is ready for Sevilla Control on 132.6: type <code>BAW493 HO 132.6</code> (or just <code>HO</code>). Send it to the wrong frequency and it comes back to you.', cmd: ['BAW493 A80', 'BAW493 HO 132.6'], ok: () => (A('BAW493') && A('BAW493').handed) || sn('BAW493').exit, wait: () => { const a = A('BAW493'); return !!a && a.need !== 'Ready for transfer'; } },
    { h: 'Reopen the road', p: 'The runway is clear, so press <b>Open road</b> to let the traffic and pedestrians across.', road: true, ok: () => S.xing.st === 'OPEN' || S.xing.st === 'OPENING' }
  ],
  arr: [
    { h: 'Take the initial call', p: 'EZY8901 from Gatwick calls inbound from the east via PIMOS. Select it and give a descent: type <code>EZY8901 A60</code> for 6,000 feet on the QNH.', cmd: 'EZY8901 A60', ok: () => sn('EZY8901').cmd || sn('EZY8901').landed },
    { h: 'Clear the SRA approach', p: 'Type <code>EZY8901 APP</code>. The flight routes to a 10 NM final for runway 27, descends to 3,000 feet and flies the surveillance radar approach down to Point Yankee.', cmd: 'EZY8901 APP', ok: () => !!(A('EZY8901') && A('EZY8901').app) || sn('EZY8901').landed },
    { h: 'Close the road in time', p: 'Walkers must be clear by 15 NM and traffic by 10 NM. Press <b>Close road</b> now, while the arrival is still well out.', road: true, ok: () => roadShut() || sn('EZY8901').landed },
    { h: 'Transfer to Tower', p: 'At about 5 NM, transfer the flight to Tower on 131.2 with <code>EZY8901 HO</code>.', cmd: 'EZY8901 HO', ok: () => (A('EZY8901') && A('EZY8901').freq === 'TWR') || sn('EZY8901').landed },
    { h: 'Clear to land', p: 'With the road closed, type <code>EZY8901 CTL</code>. Without a landing clearance by short final, the crew goes around.', cmd: 'EZY8901 CTL', ok: () => !!(A('EZY8901') && A('EZY8901').ctl) || sn('EZY8901').landed },
    { h: 'Watch the landing', p: 'Scroll in on the runway to see the touchdown. Gibraltar has no rapid exits, so the aircraft rolls out on the runway and vacates by itself.', ok: () => sn('EZY8901').landed && st('EZY8901','ROLLED','VACATING','ONSTAND') },
    { h: 'Watch it vacate', p: 'As it slows, the crew picks its exit and vacates by itself: it backtracks, turns off at Alpha or Echo and taxies to a civil stand. To send it another way, press an exit button or type <code>EZY8901 VAC E</code> before it leaves the runway. The road stays shut until it is off.', ok: () => (st('EZY8901','VACATING','ONSTAND') && !A('EZY8901').onRwy) || sn('EZY8901').onstand },
    { h: 'Reopen the road', p: 'Once the aircraft is off the runway, press <b>Open road</b>.', road: true, ok: () => S.xing.st === 'OPEN' || S.xing.st === 'OPENING' }
  ],
  lev: [
    { h: 'Runway 09 in the levanter', p: 'An easterly is blowing at gale force, so runway 09 is in use and the banner cloud sits on the Rock. Check the ATIS panel. Arrivals join from the south via RIPRA and turn in over the bay.', ok: () => S.rwy === '09' },
    { h: 'Clear BAW492 for the SRA 09', p: 'Give BAW492 a descent if you like, then type <code>BAW492 APP</code>. It routes to RIPRA for the approach to Point X-Ray.', cmd: 'BAW492 APP', ok: () => !!(A('BAW492') && A('BAW492').app) || sn('BAW492').landed },
    { h: 'Start RAM1472 on the south apron', p: 'The Royal Air Maroc ATR is on south stand 1. When it calls, approve the push with <code>RAM1472 PUSH</code>.', cmd: 'RAM1472 PUSH', ok: () => !!(A('RAM1472') && A('RAM1472').pushed) || st('RAM1472','TAXI','HOLDPT','LINEUP','LINEDUP','TAKEOFF') || sn('RAM1472').airborne },
    { h: 'Taxi the ATR to Charlie', p: 'Type <code>RAM1472 TAXI C</code>. Charlie leads straight from the south apron to the runway, just east of the road. The ATR waits there while the arrival lands.', cmd: 'RAM1472 TAXI C', ok: () => st('RAM1472','TAXI','HOLDPT','LINEUP','LINEDUP','TAKEOFF') || sn('RAM1472').airborne },
    { h: 'Close the road', p: 'Press <b>Close road</b> before the arrival reaches 10 NM.', road: true, ok: () => roadShut() || sn('BAW492').landed },
    { h: 'Transfer and clear BAW492 to land', p: 'Send it to Tower with <code>BAW492 HO</code>, then <code>BAW492 CTL</code>. In this wind, a windshear go-around is possible. If it happens, re-clear the approach with <code>APP</code>.', cmd: ['BAW492 HO', 'BAW492 CTL'], ok: () => !!(A('BAW492') && A('BAW492').ctl) || sn('BAW492').landed },
    { h: 'Let the arrival vacate', p: 'After touchdown it vacates by itself and taxies to the civil apron (<code>BAW492 VAC</code> and an exit overrides its choice). Wait until it is off the runway before you line up the ATR.', ok: () => (st('BAW492','VACATING','ONSTAND') && !A('BAW492').onRwy) || sn('BAW492').onstand },
    { h: 'Get the release from Casablanca', p: 'RAM1472 is going south to Morocco, so its release comes from Casablanca rather than Sevilla. A release is only valid for about ten minutes, so ask now, as the arrival vacates: type <code>RAM1472 REL</code>.', cmd: 'RAM1472 REL', ok: () => !!(A('RAM1472') && A('RAM1472').rel) || sn('RAM1472').airborne },
    { h: 'Line up and depart the ATR', p: 'With BAW492 off the runway and Casablanca’s release in, type <code>RAM1472 LU</code>, then <code>RAM1472 CTO</code>.', cmd: ['RAM1472 LU', 'RAM1472 CTO'], ok: () => sn('RAM1472').takeoff || sn('RAM1472').airborne, wait: () => { const a = A('RAM1472'); return !!a && !(a.rel && a.rel.st === 'OK'); } },
    { h: 'Hand off and reopen', p: 'Transfer RAM1472 to Radar with <code>HO</code>, and later to Casablanca Control on 125.5 with <code>HO 125.5</code>. Press <b>Open road</b> once the runway is clear.', cmd: 'RAM1472 HO', road: true, ok: () => (S.xing.st === 'OPEN' || S.xing.st === 'OPENING') && sn('RAM1472').airborne }
  ]
};
const wxOver = () => !!(APT.windLimit && APT.windLimit(null, S.rwy));
Object.assign(COACH, {
  mdep: [
    { h: 'Wait for the start-up call', p: 'TAP1688, an A321 on stand A7, is going to Lisbon. In a moment the crew asks for start-up and push back. Check the anemometers in the ATIS panel while you wait: the trade wind is well inside the limits.', ok: () => !!(A('TAP1688') && A('TAP1688').need) || st('TAP1688','PUSH','READY','TAXI') },
    { h: 'Approve start-up and push', p: 'Select TAP1688 and press <b>Push</b>, or type <code>TAP1688 PUSH</code>. The clearance gives its SID, DEGUN 1E, climb to FL60 and a squawk, and the tug pushes it back onto taxilane Alpha facing south-west.', cmd: 'TAP1688 PUSH', ok: () => !!(A('TAP1688') && A('TAP1688').pushed) || st('TAP1688','TAXI','HOLDPT','LINEUP','LINEDUP','TAKEOFF') || sn('TAP1688').airborne },
    { h: 'Taxi to holding point Charlie', p: 'Runway 05 departures leave from Charlie, at the south-west end of the apron. When the crew reports ready, type <code>TAP1688 TAXI C</code>.', cmd: 'TAP1688 TAXI C', ok: () => st('TAP1688','TAXI','HOLDPT','LINEUP','LINEDUP','TAKEOFF') || sn('TAP1688').airborne },
    { h: 'Request the release from Lisboa', p: 'Madeira is in the Lisboa FIR, and every departure needs a release from Lisboa Control. Press <b>Request release</b> or type <code>TAP1688 REL</code>. Lisboa calls back on the landline (pink in the log).', cmd: 'TAP1688 REL', ok: () => !!(A('TAP1688') && A('TAP1688').rel) || sn('TAP1688').airborne },
    { h: 'Line up and backtrack', p: 'Charlie joins the runway near the 05 end, so the A321 backtracks to the turn pad and turns round. Type <code>TAP1688 LU</code>.', cmd: 'TAP1688 LU', ok: () => st('TAP1688','LINEUP','LINEDUP','TAKEOFF') || sn('TAP1688').airborne },
    { h: 'Clear for take-off', p: 'With Lisboa’s release in, type <code>TAP1688 CTO</code>. Watch the right turn after lift-off: the SID turns out to sea as soon as practicable, away from the high ground on the left.', cmd: 'TAP1688 CTO', ok: () => sn('TAP1688').takeoff || sn('TAP1688').airborne, wait: () => { const a = A('TAP1688'); return !!a && !(a.rel && a.rel.st === 'OK'); } },
    { h: 'Transfer to Madeira Approach', p: 'Once airborne, send it to Approach on 119.605 with <code>TAP1688 HO</code>.', cmd: 'TAP1688 HO', ok: () => (A('TAP1688') && A('TAP1688').freq === 'RAD') || sn('TAP1688').exit },
    { h: 'Climb it and hand off to Lisboa', p: 'It follows the DEGUN 1E by itself. When it asks for more, climb it with <code>TAP1688 A100</code>. When it is ready for transfer, send it to Lisboa Control: <code>TAP1688 HO 132.255</code> (or just <code>HO</code>).', cmd: ['TAP1688 A100', 'TAP1688 HO 132.255'], ok: () => (A('TAP1688') && A('TAP1688').handed) || sn('TAP1688').exit, wait: () => { const a = A('TAP1688'); return !!a && a.need !== 'Ready for transfer'; } }
  ],
  marr: [
    { h: 'Take the initial call', p: 'EZY8711 from Gatwick calls on the KICAS 1P towards PILIM. Select it and give a descent: <code>EZY8711 A50</code> for 5,000 feet, the transition altitude.', cmd: 'EZY8711 A50', ok: () => sn('EZY8711').cmd || sn('EZY8711').landed },
    { h: 'Clear the VOR approach', p: 'Type <code>EZY8711 APP</code>. It routes via ABUSU onto the FUN 211° radial and descends to the missed approach point at 3.6 DME. There is no straight-in approach to runway 05.', cmd: 'EZY8711 APP', ok: () => !!(A('EZY8711') && A('EZY8711').app) || sn('EZY8711').landed },
    { h: 'Transfer to Tower', p: 'Once it is established on the approach, send it to Madeira Tower on 124.660 with <code>EZY8711 HO</code>.', cmd: 'EZY8711 HO', ok: () => (A('EZY8711') && A('EZY8711').freq === 'TWR') || sn('EZY8711').landed },
    { h: 'Clear to land', p: 'Type <code>EZY8711 CTL</code>. Then zoom in and watch the circuit: a right turn past the GELO point at 850 ft and Rosário at 460 ft, onto a short final over the sea.', cmd: 'EZY8711 CTL', ok: () => !!(A('EZY8711') && A('EZY8711').ctl) || sn('EZY8711').landed },
    { h: 'Watch the landing', p: 'After touchdown the aircraft rolls out, slows and picks its own exit.', ok: () => sn('EZY8711').landed && st('EZY8711','ROLLED','VACATING','ONSTAND') },
    { h: 'Watch it vacate', p: 'As it slows, the crew picks its exit and vacates by itself: it turns off at Bravo, or backtracks to it, and taxies along Alpha to its stand. To use Charlie instead, press its exit button or type <code>EZY8711 VAC C</code> while it is still on the runway.', ok: () => (st('EZY8711','VACATING','ONSTAND') && !A('EZY8711').onRwy) || sn('EZY8711').onstand }
  ],
  mwind: [
    { h: 'Read the anemometers', p: 'A strong northerly is blowing. The ATIS panel shows the MID and Rosário readings, and the line is red: the wind from 300°–010° is over the 15 kt / gust 25 limit for landing. Two arrivals are on their way in.', ok: () => !!(A('EXS1291') && A('EXS1291').need) },
    { h: 'Offer the approach', p: 'Clear EXS1291 for the approach anyway with <code>EXS1291 APP</code>. The crew checks the wind and refuses.', cmd: 'EXS1291 APP', ok: () => { const a = A('EXS1291'); return !!a && (a.need === 'Unable approach' || !!a.divertAt || !!a.diverting) || !!sn('EXS1291').landed; } },
    { h: 'Hold it at PILIM', p: 'Send it to the published hold: <code>EXS1291 HOLD PILIM A30</code>, at 3,000 feet. It flies left-hand turns over the sea while you wait for the wind.', cmd: 'EXS1291 HOLD PILIM A30', ok: () => { const a = A('EXS1291'); return !a || a.state === 'HOLDING' || !!a.diverting; } },
    { h: 'Stack the second arrival', p: 'TAP1691 from Lisbon is behind it. Offer it the approach too with <code>TAP1691 APP</code>, and when it refuses, hold it at PILIM 1,000 ft higher: <code>TAP1691 HOLD PILIM A40</code>.', cmd: ['TAP1691 APP', 'TAP1691 HOLD PILIM A40'], ok: () => { const a = A('TAP1691'); return !!a && (a.state === 'HOLDING' || !!a.diverting) || !!sn('TAP1691').landed; } },
    { h: 'Approve the diversion', p: 'After a couple of minutes in the hold, EXS1291 asks to divert to Porto Santo. Press <b>Approve diversion</b>, or type <code>EXS1291 DCT MARCU A80</code>.', cmd: 'EXS1291 DCT MARCU A80', ok: () => { const a = A('EXS1291'); return !a || a.state === 'DIVERTING'; }, wait: () => { const a = A('EXS1291'); return !!a && !a.diverting; } },
    { h: 'And the second one', p: 'TAP1691 asks too. Approve it the same way with <b>Approve diversion</b> or <code>TAP1691 DCT MARCU A80</code>, and keep the two 1,000 ft apart as they climb out.', cmd: 'TAP1691 DCT MARCU A80', ok: () => { const a = A('TAP1691'); return !a || a.state === 'DIVERTING'; }, wait: () => { const a = A('TAP1691'); return !!a && !a.diverting; } }
  ]
});
const coach = { ex: null, i: 0, hidden: false };
const stepCs = s => s && s.cmd ? [].concat(s.cmd)[0].split(' ')[0] : null;
const canDo = s => !!(s && s.cmd && A(stepCs(s))) && !(s.wait && s.wait());
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
  if (done) careerExercise(coach.ex);
  el.innerHTML = done
    ? `<div class="lbl">${esc(EXERCISES[coach.ex].name)} · complete</div><h4>Well controlled.</h4><div class="steps">${bars}</div><p>Score <b>${S.score.pts}</b> points, ${S.score.incidents} incidents. Try the next exercise, or open a full session with real traffic.</p><div class="row"><a class="btn primary" href="#training" data-hash="${({ LPMA: 'm-exercises', EGLC: 'c-exercises', LOWI: 'i-exercises', KJFK: 'k-exercises' })[APT.icao] || 't-exercises'}">Next exercise</a><button class="btn" data-c="session">Full session</button><button class="btn" data-c="hide">Close</button></div>`
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
  if (!EXERCISES[ex]) { const ic = Object.keys(ENDORSE).find(k => ENDORSE[k].ex.includes(ex)); if (ic && ic !== APT.icao) location.href = SITE[ic] + '#ex/' + ex; return; }
  $('trafficSel').value = ex; $('wxPaste').value = '';
  S.running = false; resetSession();
  location.hash = 'sim'; go('sim');
  requestAnimationFrame(() => { resize(); start(); });
}
document.querySelectorAll('[data-ex]').forEach(b => b.onclick = () => startExercise(b.dataset.ex));
document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[data-hash]'); if (a) { e.preventDefault(); location.hash = a.dataset.hash; } });

// ── this page's airport: labels, links and the exercise list ──
function airportChrome(){
  const lower = APT.icao.toLowerCase();
  const chip = $('apChip'); chip.href = '#' + lower; chip.title = `${APT.name} airport briefing`; chip.innerHTML = `<b>${APT.icao}</b><span>${esc(APT.name)}</span>`;
  $('fidsTitle').textContent = `${APT.name} · flight information`;
  document.querySelectorAll('[data-icao]').forEach(e => e.textContent = APT.icao);
  $('awcLink').href = `https://aviationweather.gov/data/metar/?id=${APT.icao}&hours=0`;
  $('wxPaste').placeholder = WX_PRESETS[APT.defWx].metar;
  if (APT.icao === 'LPMA') $('cmd').placeholder = 'Command, e.g. TAP1681 A30 APP · EZY8712 TAXI C · / to focus, Tab cycles flights';
  if (APT.site && APT.site.cmdHint) $('cmd').placeholder = APT.site.cmdHint;
  $('exGroup').innerHTML = Object.entries(EXERCISES).map(([k, e], i) => `<option value="${k}">Exercise ${i + 1} · ${esc(e.name.replace(/^.*?·\s*/, ''))}</option>`).join('');
  const others = LIVE_APS.filter(k => k !== APT.icao);
  $('setupAp').innerHTML = `<span class="lbl">Airport</span><b>${esc(APT.name)} · ${APT.icao}</b>${others.map(k => `<a href="${SITE[k]}#sim">Switch to ${ENDORSE[k].name}</a>`).join('')}`;
  // on another airport's page, site links go to the host page; on the host, another airport's position and Live now
  // buttons open its own simulator, and its "Academy" buttons open its endorsement
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    const h = a.getAttribute('href').slice(1), o = otherPage(h); if (o) { a.href = o; return; }
    const ic = IS_HOST && blockAp(a); if (!ic || ic === APT.icao) return;
    if (h === 'sim') a.href = SITE[ic] + (a.hasAttribute('data-live') ? '#live' : '#sim');
    else if (h === 'training' && firstSec(ic)) a.href = '#' + firstSec(ic).id;
  });
}
airportChrome();
// ── boot ──
renderAirports(); renderScenarios(); setEndorse(endorse); buildTurbTable();
fromHash();
resize(); setView('app'); renderAtis(); renderSel(); renderStrips(true); renderScore();
if (!EMBED) { requestAnimationFrame(frame); requestAnimationFrame(heroFrame); }

// full-screen position: Launch takes the browser full screen (where the frame allows it) and the site bar hides on #sim
function canFull(){ return !!(document.documentElement.requestFullscreen && document.fullscreenEnabled); }
function enterFull(){ if (canFull() && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {}); }
function exitFull(){ if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {}); }
document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href="#sim"]'); if (a) enterFull(); });
$('tgExit').onclick = () => { exitFull(); location.hash = '#' + HOME_RT; };
$('tgFull').onclick = () => document.fullscreenElement ? exitFull() : enterFull();
function syncFull(){ const b = $('tgFull'); b.hidden = !canFull(); b.textContent = document.fullscreenElement ? 'Exit full screen' : 'Full screen'; b.classList.toggle('on', !!document.fullscreenElement); }
document.addEventListener('fullscreenchange', () => { syncFull(); if (curRoute === 'sim') resize(); });
syncFull();

// "Live now" links open the simulator set up for a Real world session
document.querySelectorAll('[data-live]').forEach(a => a.addEventListener('click', () => {
  if (a.getAttribute('href') !== '#sim') return;
  const sel = $('trafficSel'); if (S.running) return;
  sel.value = 'live'; sel.dispatchEvent(new Event('change'));
}));
