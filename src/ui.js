// ═════════════════════════ rendering ═════════════════════════
let cv = document.getElementById('scope'), cx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize(){ const r = cv.getBoundingClientRect(); DPR = window.devicePixelRatio || 1; W = r.width; H = r.height; cv.width = Math.max(1, W*DPR); cv.height = Math.max(1, H*DPR); }
window.addEventListener('resize', () => { resize(); });
const V = S.view;
// Web Mercator display (like FlightRadar24): x stays linear in longitude, y is stretched by latitude so the map keeps
// its shape at any zoom. MY maps sim y (NM north of LAT0) to Mercator NM at Gibraltar's scale; IMY inverts it.
const MK = R2D*60*COSL, MY0 = Math.log(Math.tan(Math.PI/4 + LAT0*D2R/2));
const MY = y => (Math.log(Math.tan(Math.PI/4 + (LAT0 + y/60)*D2R/2)) - MY0)*MK;
const IMY = Y => ((2*Math.atan(Math.exp(Y/MK + MY0)) - Math.PI/2)*R2D - LAT0)*60;
const sx = x => W/2 + (x - V.cx)*V.scale, sy = y => H/2 - (MY(y) - MY(V.cy))*V.scale;
const wx2 = px => (px - W/2)/V.scale + V.cx, wy2 = py => IMY(MY(V.cy) - (py - H/2)/V.scale);
function poly(pts, close=true){ cx.beginPath(); pts.forEach((p,i) => { const X = sx(p[0]), Y = sy(p[1]); i ? cx.lineTo(X,Y) : cx.moveTo(X,Y); }); if (close) cx.closePath(); }
const ll2xy = ([lo,la]) => xy(la,lo);
const LAND = GEO ? GEO.land.map(pg => pg.map(r => r.map(ll2xy))) : [];
const COAST = GEO ? GEO.coast.map(l => l.map(ll2xy)) : [];
const BORDERS = GEO ? GEO.borders.map(l => l.map(ll2xy)) : [];
const TOWNS = GEO ? GEO.towns.map(([n,lo,la]) => [n, ...xy(la,lo)]) : [];
const AIRPORTS = GEO ? (GEO.airports||[]).map(([n,lo,la]) => [n, ...xy(la,lo)]) : [];
const FONT_L = '"Inter Tight", "Inter", system-ui, sans-serif', FONT_D = '"JetBrains Mono", ui-monospace, monospace';
// map palettes: a light chart (default) and the night radar display; every themed canvas colour lives here
const PAL = {
  light: {
    sea: '#cfe2ee', land: '#f3f0e7', landHi: '#ebe6d8', coast: '#86a3b6', border: 'rgba(90,70,110,.55)',
    ring: 'rgba(11,42,74,.13)', ringTxt: 'rgba(11,42,74,.5)', arr: '#b75f00', dep: '#1452d9', sel: '#0c1b2e', conf: '#d62d2d', off: '#8a4fc4', clr: '#12805c', div: '#c2187a',
    ground: '#e4e9d6', grass: '#dde5cc', asphalt: '#9ba4ad', rwy: '#5d656e', concrete: '#c4cad1', apronLine: '#8a949e',
    bld: '#d9dde3', bldEdge: '#8b96a3', road: '#d3c9b8', paint: 'rgba(255,255,255,.95)', yellow: '#f5c400', closed: '#b9c0c7',
    acArr: '#fff1d6', acDep: '#ffffff', pre: 'rgba(80,92,108,.7)', tagBg: 'rgba(255,255,255,.9)', tagEdge: 'rgba(12,27,46,.18)',
    xClosed: '#d62d2d', xOpen: '#12805c', xMid: '#b75f00', pv: '#12a46b', pvTxt: '#0d7a52', pvBg: 'rgba(255,255,255,.95)',
    glow: 'source-over', flood: 0,
    rgb: { lab: '30,45,65', proc: '183,95,0', apt: '20,82,217', relief: '95,115,70', reliefFill: '120,140,90', reliefTxt: '70,85,50',
           town: '60,75,95', car: '60,70,85', r164: '200,50,40', hot: '192,24,122', rwyOut: '45,55,68' }
  },
  dark: {
    sea: '#04121a', land: '#0d2427', landHi: '#13302f', coast: '#3b7a7e', border: 'rgba(170,200,200,.45)',
    ring: 'rgba(125,255,176,.09)', ringTxt: 'rgba(125,255,176,.35)', arr: '#ffc164', dep: '#7cc7ff', sel: '#ffffff', conf: '#ff5a5a', off: '#c39bff', clr: '#5fe39a', div: '#ff6fbf',
    ground: '#162523', grass: '#14231f', asphalt: '#262e31', rwy: '#20272a', concrete: '#353f42', apronLine: '#4b585c',
    bld: '#0b1214', bldEdge: '#3c4a4c', road: '#2e2a26', paint: 'rgba(236,240,232,.86)', yellow: '#e7c23a', closed: '#1f2628',
    acArr: '#e9d7b0', acDep: '#d6e8f5', pre: 'rgba(160,190,190,.55)', tagBg: 'rgba(4,14,18,.72)', tagEdge: 'rgba(0,0,0,0)',
    xClosed: '#ff5a5a', xOpen: '#4fd18b', xMid: '#ffc164', pv: '#7dffb0', pvTxt: '#7dffb0', pvBg: 'rgba(4,18,26,.92)',
    glow: 'lighter', flood: 0.10,
    rgb: { lab: '207,227,226', proc: '255,200,120', apt: '124,199,255', relief: '190,205,170', reliefFill: '150,170,130', reliefTxt: '210,220,195',
           town: '160,190,190', car: '255,230,180', r164: '255,130,100', hot: '255,110,150', rwyOut: '225,238,238' }
  }
};
const C = { ...PAL.light };
const rgba = (k, a) => `rgba(${C.rgb[k]},${a})`;
function setTheme(t){ Object.assign(C, PAL[t === 'dark' ? 'dark' : 'light']); C.name = t; }

function draw(){
  cx.setTransform(DPR,0,0,DPR,0,0);
  const sc = V.scale, ground = sc > 70;
  cx.fillStyle = C.sea; cx.fillRect(0,0,W,H);
  // land (even-odd so traced harbours/bays inside the chart frame stay water)
  cx.fillStyle = ground ? C.ground : C.land;
  for (const pg of LAND) { cx.beginPath(); for (const r of pg) { r.forEach((p,i) => { const X = sx(p[0]), Y = sy(p[1]); i ? cx.lineTo(X,Y) : cx.moveTo(X,Y); }); cx.closePath(); } cx.fill('evenodd'); }
  const img = mapImagery();
  if (img) drawImagery();
  else if (ground) { drawGroundBase(); drawRoads(); }
  cx.strokeStyle = C.coast; cx.lineWidth = ground ? 1.4 : 1; cx.globalAlpha = ground ? 0.8 : 1;
  if (!img) { cx.save(); if (ground && typeof AIRSIDE !== 'undefined' && AIRSIDE) { cx.beginPath(); cx.rect(0, 0, W, H); AIRSIDE.forEach((p, i) => cx[i ? 'lineTo' : 'moveTo'](sx(p[0]), sy(p[1]))); cx.closePath(); cx.clip('evenodd'); }
  for (const l of COAST) { poly(l, false); cx.stroke(); } cx.restore(); }
  cx.globalAlpha = 1;
  if (!ground) drawRadarMap(); else if (!img) drawRockRelief();
  if (S.showProc && sc >= 3) drawProcedures();
  drawAirport();
  if (S.preview) drawPreview(S.preview);
  if (typeof drawFar === 'function' && cv.id === 'scope') drawFar();
  if (typeof drawLive === 'function' && cv.id === 'scope') drawLive();
  if (typeof drawRwyBlock === 'function') drawRwyBlock();
  for (const ac of S.acs) if (!ac.ground) { if (typeof drawFarAc === 'function' && outsideRadar(ac)) drawFarAc(ac); else drawAc(ac); }
  // a tug calling for a tow shows where it would go; any other route only while you have that aircraft selected
  for (const ac of S.acs) if (towPending(ac) || (S.sel === ac && towOn(ac))) drawTowRoute(ac);
  if (S.sel && S.sel.ground && S.sel.path && !towOn(S.sel)) drawTaxiRoute(S.sel);
  else if (S.sel) drawVacRoute(S.sel);
  for (const ac of S.acs) if (ac.ground && (!inHangar(ac) || towPending(ac))) drawAc(ac);   // stored in a hangar: out of sight until a tug calls for it
  if (img) drawImageryCredit();
  else if (MAP_LAYER !== 'drawn' && TILE.failed && cv.id === 'scope') { cx.font = `11px ${FONT_L}`; cx.fillStyle = rgba('lab', .7); cx.textAlign = 'right'; cx.fillText('Map imagery could not load here, so the drawn chart is shown', W - 12, H - 8); cx.textAlign = 'left'; }
  // scale bar
  cx.fillStyle = rgba('lab', .75); cx.font = `11px ${FONT_D}`;
  const nm = sc > 900 ? 0.05 : sc > 300 ? 0.2 : sc > 100 ? 0.5 : sc > 30 ? 1 : 5, lp = nm*sc;
  cx.fillRect(W-20-lp, H-30, lp, 2); cx.fillRect(W-20-lp, H-34, 1, 6); cx.fillRect(W-21, H-34, 1, 6);
  cx.textAlign = 'right'; cx.fillText(nm < 1 ? Math.round(nm*1852)+' m' : nm+' NM', W-20, H-38); cx.textAlign = 'left';
  // north arrow
  cx.save(); cx.translate(W-28, 74); cx.strokeStyle = rgba('lab', .6); cx.fillStyle = rgba('lab', .75); cx.lineWidth = 1;
  cx.beginPath(); cx.moveTo(0,-14); cx.lineTo(5,6); cx.lineTo(0,2); cx.lineTo(-5,6); cx.closePath(); cx.fill(); cx.font = `600 11px ${FONT_L}`; cx.textAlign = 'center'; cx.fillText('N', 0, -18); cx.restore(); cx.textAlign = 'left';
}

function drawRadarMap(){
  const sc = V.scale;
  // restricted area (Gibraltar: R164)
  if (R164.length) { cx.save(); poly(R164); cx.fillStyle = rgba('r164', .05); cx.fill(); cx.clip();
  cx.strokeStyle = rgba('r164', .10); cx.lineWidth = 1; for (let k = -W; k < W+H; k += 9) { cx.beginPath(); cx.moveTo(k, 0); cx.lineTo(k - H, H); cx.stroke(); }
  cx.restore();
  cx.save(); cx.strokeStyle = rgba('r164', .65); cx.setLineDash([6,4]); cx.lineWidth = 1.2; poly(R164); cx.stroke(); cx.restore(); }
  if (sc < 3) return;                                   // zoomed out to the wider map: no radar furniture
  if (sc < 160 && APT.restricted && APT.restricted.label) { cx.fillStyle = rgba('r164', .9); cx.font = `600 12px ${FONT_L}`; const p = APT.restricted.labelAt; cx.fillText(APT.restricted.label, sx(p[0]), sy(p[1])); }
  const IMGON = mapImagery();
  if (!IMGON) { cx.strokeStyle = C.border; cx.setLineDash([2,3]); for (const l of BORDERS) { poly(l,false); cx.stroke(); } cx.setLineDash([]);
  drawRockRelief(); }
  // towns and airports
  cx.font = `500 12px ${FONT_L}`;
  if (!IMGON) for (const [n,x,y] of TOWNS) { const X = sx(x), Y = sy(y); if (X < -40 || Y < -20 || X > W+40 || Y > H+20) continue; cx.fillStyle = rgba('town', .55); cx.fillRect(X-1.5, Y-1.5, 3, 3); cx.fillStyle = rgba('town', .6); cx.fillText(n.toUpperCase(), X+5, Y+4); }
  for (const [n,x,y] of AIRPORTS) { const X = sx(x), Y = sy(y); cx.strokeStyle = rgba('apt', .55); cx.lineWidth = 1; cx.beginPath(); cx.arc(X, Y, 4, 0, 7); cx.stroke(); cx.beginPath(); cx.moveTo(X-6, Y); cx.lineTo(X+6, Y); cx.stroke(); cx.fillStyle = rgba('apt', .6); cx.font = `10px ${FONT_D}`; cx.fillText(n, X+7, Y-5); }
  // range rings and bearing scale around the radar reference
  if (sc < 60) {
    const X0 = sx(RADAR_REF[0]), Y0 = sy(RADAR_REF[1]);
    cx.strokeStyle = C.ring; cx.lineWidth = 1; cx.fillStyle = C.ringTxt; cx.font = `10px ${FONT_D}`;
    for (let r = 5; r <= 50; r += 5) { cx.beginPath(); cx.arc(X0, Y0, r*sc, 0, 7); cx.stroke(); if (r % 10 === 0) cx.fillText(r, X0 + r*sc*0.707 + 2, Y0 - r*sc*0.707); }
    const R = 40*sc;
    for (let b = 0; b < 360; b += 5) { const L = b % 30 === 0 ? 10 : 4, s = Math.sin(b*D2R), c = Math.cos(b*D2R); cx.beginPath(); cx.moveTo(X0 + s*R, Y0 - c*R); cx.lineTo(X0 + s*(R+L), Y0 - c*(R+L)); cx.stroke(); if (b % 30 === 0) { cx.textAlign = 'center'; cx.fillText(String(b).padStart(3,'0'), X0 + s*(R+20), Y0 - c*(R+20) + 4); cx.textAlign = 'left'; } }
  }
}
function drawRockRelief(){
  if (!APT.drawnTown) { if (APT.drawRelief) APT.drawRelief(); return; }
  const sc = V.scale;
  cx.fillStyle = rgba('reliefFill', .22); cx.strokeStyle = rgba('relief', .45); cx.lineWidth = 1; poly(ROCK); cx.fill(); cx.stroke();
  for (let k = 0.75; k > 0.15; k -= 0.2) { const pts = ROCK.map(p => [ROCK_TOP[0]+(p[0]-ROCK_TOP[0])*k, ROCK_TOP[1]+(p[1]-ROCK_TOP[1])*k]); cx.strokeStyle = rgba('relief', 0.18+0.25*(1-k)); poly(pts); cx.stroke(); }
  if (sc > 22 && sc < 900) { cx.fillStyle = rgba('reliefTxt', .95); cx.font = `500 12px ${FONT_L}`; cx.fillText('▲ 1398  ROCK · NO OVERFLIGHT', sx(ROCK_TOP[0])+6, sy(ROCK_TOP[1])+4); }
}

function drawProcedures(){
  const sc = V.scale; if (sc > 400) return;
  cx.lineWidth = 1;
  for (const g of Object.keys(ARR_ROUTE)) { cx.strokeStyle = rgba('proc', .26); cx.setLineDash([4,5]); poly(ARR_ROUTE[g][S.rwy].map(id => WP[id].p), false); cx.stroke(); }
  cx.setLineDash([]);
  for (const k of RW_ENDS) {
    const F = FINAL[k]; if (!F) continue; cx.strokeStyle = k === S.rwy ? rgba('proc', .75) : rgba('lab', .2); cx.lineWidth = k === S.rwy ? 1.3 : 1;
    poly(F.pts, false); cx.stroke();
    if (F.ticks) { const ob = norm(crsOf(k) + 180), nx = Math.cos(ob*D2R), ny = Math.sin(ob*D2R); for (let n = 1; n <= 10; n++) { const p = add(F.pts[F.pts.length-1], ob, n), L = n % 5 === 0 ? 7 : 4; cx.beginPath(); cx.moveTo(sx(p[0]) - nx*L, sy(p[1]) - ny*L); cx.lineTo(sx(p[0]) + nx*L, sy(p[1]) + ny*L); cx.stroke(); } }
  }
  // RNP AR paths to the runway in use (dashed), and the one the selected flight is cleared for (solid)
  for (const F of Object.values(FINAL)) if (F.rnp && F.rwy === S.rwy) {
    const mine = S.sel && finOf(S.sel) === F; cx.strokeStyle = rgba('proc', mine ? .8 : .35); cx.lineWidth = mine ? 1.4 : 1; cx.setLineDash(mine ? [] : [6, 4]);
    poly(F.pts, false); cx.stroke(); if (mine) { cx.setLineDash([2, 4]); poly(F.missPts, false); cx.stroke(); }
    cx.setLineDash([]);
  }
  cx.strokeStyle = rgba('proc', .4); cx.lineWidth = 1;
  for (const w of Object.values(WP)) if (w.hold) {
    const inb = w.hold.inb, out = add(w.p, inb+180, 3.2), side = add(w.p, inb+90, 1.6), side2 = add(out, inb+90, 1.6);
    poly([w.p, out], false); cx.stroke(); poly([side, side2], false); cx.stroke();
    cx.beginPath(); const a1 = sx(w.p[0]), b1 = sy(w.p[1]), a2 = sx(side[0]), b2 = sy(side[1]); cx.arc((a1+a2)/2, (b1+b2)/2, Math.hypot(a2-a1, b2-b1)/2, Math.atan2(b2-b1, a2-a1) + Math.PI, Math.atan2(b2-b1, a2-a1) + 2*Math.PI); cx.stroke();
    if (sc > 6) { cx.fillStyle = rgba('proc', .6); cx.font = `10px ${FONT_D}`; cx.fillText(`HOLD ${w.hold.min}+`, sx(side2[0])+4, sy(side2[1])+4); }
  }
  cx.font = `10.5px ${FONT_D}`;
  for (const w of Object.values(WP)) {
    if (w.hide) continue;
    const X = sx(w.p[0]), Y = sy(w.p[1]); if (X < -50 || Y < -50 || X > W+50 || Y > H+50) continue;
    const pt = !!w.decLabel;
    if ((pt && sc < 12) || (w.minor && sc < 9)) continue;
    cx.strokeStyle = pt ? rgba('proc', .9) : rgba('lab', .65);
    cx.beginPath(); cx.moveTo(X, Y-4.5); cx.lineTo(X+4, Y+3); cx.lineTo(X-4, Y+3); cx.closePath(); cx.stroke();
    if (sc > 5) { cx.fillStyle = pt ? rgba('proc', .9) : rgba('lab', .6); cx.fillText(pt ? w.decLabel : w.id, X+6, Y+3); }
  }
  const X = sx(RADAR_REF[0]), Y = sy(RADAR_REF[1]); cx.strokeStyle = rgba('apt', .75); cx.beginPath(); for (let k=0;k<6;k++){ const a=k*Math.PI/3; cx[k?'lineTo':'moveTo'](X+5*Math.cos(a), Y+5*Math.sin(a)); } cx.closePath(); cx.stroke();
  if (sc < 120) { cx.fillStyle = rgba('apt', .75); cx.fillText(APT.radarName, X+7, Y-6); }
}

// ── aerodrome ─────────────────────────────────────────────
const RHW = APT.rwyHalfWidth || 22.5, RSS = RHW - 0.9;   // runway half-width (45 m at Gibraltar and Madeira) and its side stripes
const AD = {
  rwyPoly: [[0,-RHW],[0,RHW],[RWY_M,RHW],[RWY_M,-RHW]],
  // taxiway centrelines: every taxi-graph edge, the runway fillets and the north apron taxiway's far end
  twys: Object.fromEntries([
    ...GE.map((e, i) => ['e' + i, [[GN[e.a].m, GN[e.a].off], [GN[e.b].m, GN[e.b].off]]]),
    ...Object.entries(FIL).flatMap(([k, f]) => ['W', 'E'].map(d => [k + d, [...f[d], [GN[HOLDS[k].rwy].m, GN[HOLDS[k].rwy].off]]])),
    ...(AD_SITE.twyExtra || [])
  ]),
  ...AD_SITE
};
// Which lines are painted: where the profile has the real OpenStreetMap centrelines (osmLines, London City) those alone,
// so the taxi graph's own straight links don't draw a second, slightly different line beside them; elsewhere every graph
// edge and fillet. Painted edge lines are Gibraltar's (AD 2.9, edgeLines) and only run along plain taxiways, never the
// runway links or apron taxilanes where they would cut across the fillets and stands; the blue edge lights follow the same set.
const LINE_KEYS = Object.keys(AD.twys).filter(k => !AD.osmLines || (AD.twyExtra || []).some(e => e[0] === k));
const EDGE_KEYS = LINE_KEYS.filter(k => AD.twys[k].every(([, o]) => Math.abs(o) > RHW + 25) && !(/^e\d+$/.test(k) && GE[+k.slice(1)].tw === 'APRON'));
// ── taxiway designators and intermediate holding points, shared by every airport ──
// Designators come from the taxi graph: one sign at the middle of each stretch of a named taxiway and more along long
// ones, drawn as yellow-on-black location signs. Where they would overlap, the more important one (the longer
// taxiway) wins, so the map stays readable at any zoom.
let TWY_ANCH = null;
function twyAnchors(){
  if (TWY_ANCH) return TWY_ANCH;
  const out = [], SP = 380*M2NM;
  const byTw = {}; for (const e of GE) if (e.tw && e.tw !== 'APRON' && !/~/.test(e.tw)) (byTw[e.tw] ||= []).push(e);
  for (const [tw, es] of Object.entries(byTw)) {
    // connected stretches of this taxiway
    const seen = new Set();
    for (const e0 of es) {
      if (seen.has(e0)) continue;
      const comp = [], q = [e0]; seen.add(e0);
      while (q.length) { const e = q.shift(); comp.push(e); for (const n of [e.a, e.b]) for (const [, x] of GN[n].adj) if (x.tw === tw && !seen.has(x)) { seen.add(x); q.push(x); } }
      const L = comp.reduce((s, e) => s + e.len, 0); if (L < 25*M2NM) continue;
      let acc = 0, next = Math.min(L/2, SP/2);
      for (const e of comp) {
        while (acc + e.len >= next) { const f = (next - acc)/(e.len || 1), a = GN[e.a].p, b = GN[e.b].p; out.push({ tw, p: [a[0] + (b[0] - a[0])*f, a[1] + (b[1] - a[1])*f], pri: L, k: Math.round((next - Math.min(L/2, SP/2))/SP) }); next += SP; }
        acc += e.len;
      }
    }
  }
  // drawn-only taxiways (no traffic) named by the profile
  const tws = new Set(Object.keys(byTw));
  if (typeof rm === 'function') for (const [k, m, o] of AD.twyLabels || []) if (!tws.has(k)) out.push({ tw: k, p: rm(m, o), pri: 0, k: 0 });
  out.sort((a, b) => b.pri - a.pri);
  return TWY_ANCH = out;
}
// ── lead-on and lead-off lines ──
// The yellow taxiway centreline carries on over the runway along each fillet curve until it meets the runway centreline,
// then runs 60 m beside it, 0.9 m to the side (ICAO Annex 14 5.2.8; the FAA lead-on and lead-off lines are laid out the
// same way). A taxiway that meets the runway square on (a crossing) just runs straight across.
function leadLine(pts){   // [m, off] in a runway frame, from the runway centreline out to the taxiway
  const out = pts.map(p => p.slice()), [a, b] = out, dm = b[0] - a[0], s = Math.sign(out[out.length - 1][1]) || 1;
  if (Math.abs(dm) < Math.abs(b[1] - a[1])*0.4) return out;
  const d = Math.sign(dm); out[0] = [a[0], s*0.9];
  return [[a[0] - d*60, s*0.9], ...out];
}
// yellow ground paint: over the pale street map a thin dark casing goes underneath so the line still reads
// (draw strokes the paths and leaves the colour and width alone)
function groundLines(w, draw){
  if (mapImagery() && C.name !== 'dark') { cx.save(); cx.strokeStyle = 'rgba(30,34,40,.55)'; cx.lineWidth = w + 1.6; draw(); cx.restore(); }
  cx.strokeStyle = C.yellow; cx.lineWidth = w; draw();
}
// ── taxiway pavement at its published width, laid over the street map ──
// AD.pave per airport: w = default width (m), by = widths per taxiway (0: not paved, e.g. grass), edge = 'faa' for the
// FAA continuous double yellow edge marking. lines: [{ pts: screen points, w }],
// blds: building outlines (screen points) the paving must not cover.
function paveWidth(tw){ const P = AD.pave || {}, b = P.by || {}; return tw in b ? b[tw] : (P.w || 18); }
// clip the building outlines (screen points) out of what is drawn next, inside a save/restore
function clipOut(blds){ if (!blds.length) return; cx.beginPath(); cx.rect(0, 0, W, H); for (const b of blds) { b.forEach((q, i) => cx[i ? 'lineTo' : 'moveTo'](...q)); cx.closePath(); } cx.clip('evenodd'); }
function drawPavement(lines, blds, mpx){
  const P = AD.pave || {}, byW = new Map();
  // one opaque path per width, so where stretches overlap at a junction the shading never shows a darker patch
  for (const l of lines) if (l.w > 0 && l.pts.length > 1) { if (!byW.has(l.w)) byW.set(l.w, []); byW.get(l.w).push(l); }
  const pass = (col, dw) => {
    cx.strokeStyle = col;
    for (const [w, ls] of byW) { if (w + dw <= 0) continue; cx.lineWidth = Math.max(1, (w + dw)*mpx); cx.beginPath(); for (const l of ls) l.pts.forEach((q, i) => cx[i ? 'lineTo' : 'moveTo'](...q)); cx.stroke(); }
  };
  cx.save(); cx.lineJoin = cx.lineCap = 'round';
  clipOut(blds);
  pass(C.asphalt, 0);
  if (P.edge === 'faa' && mpx > 1.1) {
    // two 15 cm yellow lines 15 cm apart at the pavement edge: drawn as nested strokes so they break where taxiways meet
    const gap = Math.max(0.35, 1/mpx);
    pass(C.yellow, 0); pass(C.asphalt, -gap); pass(C.yellow, -2*gap); pass(C.asphalt, -3*gap);
  }
  cx.restore();
}
// ── stand markings: lead-in, stop bar, number box; on the drawn chart also the red stand safety box and restraint line ──
// The box is as wide as the stand: the gap to the stand beside it, so neighbouring boxes share a line, as painted.
// Multiple-apron-ramp stands (47 with 47L/47R, A7 with A7A/A7B) keep one box for the full-size stand; the others get their own
// lead-in and stop bar inside it.
let STAND_SZ = null;
function standSize(s){
  if (AD.standBox) return AD.standBox(s);
  if (!STAND_SZ) {
    STAND_SZ = new Map();
    const ids = new Set(STANDS.map(t => t.id)), base = t => { const m = /^(.*\d)[LRAB]$/.exec(t.id); return m && ids.has(m[1]) ? m[1] : t.id; };
    for (const t of STANDS) {
      const u = [Math.sin(t.hdg*D2R), Math.cos(t.hdg*D2R)]; let lat = Infinity, near = Infinity;
      for (const o of STANDS) {
        if (o === t || base(o) === base(t)) continue;
        const dx = (o.p[0] - t.p[0])/M2NM, dy = (o.p[1] - t.p[1])/M2NM, al = dx*u[0] + dy*u[1], la = Math.abs(dx*u[1] - dy*u[0]);
        if (Math.abs(al) < 30 && la > 10) lat = Math.min(lat, la);
        if (la > 10 || Math.abs(al) > 10) near = Math.min(near, Math.hypot(dx, dy));
      }
      // stands round a curved pier fan out, so the nearest stand at any angle also caps the width
      const w = clamp(Math.min(isFinite(lat) ? lat : 38, near*1.1) - 1, 30, 82);
      STAND_SZ.set(t, { w, l: clamp(w + 6, 24, 80), f: 0.56, sub: base(t) !== t.id });
    }
  }
  return STAND_SZ.get(s);
}
function strokeSmooth(P){   // screen points, rounded through the mid-points so mapped curves stay smooth
  cx.beginPath(); cx.moveTo(...P[0]);
  for (let i = 1; i < P.length - 1; i++) cx.quadraticCurveTo(P[i][0], P[i][1], (P[i][0] + P[i+1][0])/2, (P[i][1] + P[i+1][1])/2);
  cx.lineTo(...P[P.length - 1]); cx.stroke();
}
// a runway designator, read from the approach: a parallel runway's letter sits under the number, nearer the threshold
function drawRwyDesignator(X, Y, rw, crs, size){
  const num = rw.replace(/[LRC]$/, ''), let_ = rw.slice(num.length);
  cx.save(); cx.translate(X, Y); cx.rotate(crs*D2R); cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.font = `700 ${size}px ${FONT_L}`;
  if (let_) { cx.fillText(let_, 0, size*0.55); cx.fillText(num, 0, -size*0.55); } else cx.fillText(rw, 0, 0);
  cx.restore(); cx.textBaseline = 'alphabetic'; cx.textAlign = 'left';
}
function drawGroundSigns(){
  const sc = V.scale, mpx = sc/1852; if (sc < 140) return;
  const P2 = p => [sx(p[0]), sy(p[1])], boxes = [];
  const free = (x, y, w, h) => { if (x + w < 0 || y + h < 0 || x > W || y > H) return false; for (const b of boxes) if (x < b[0] + b[2] + 4 && b[0] < x + w + 4 && y < b[1] + b[3] + 3 && b[1] < y + h + 3) return false; boxes.push([x, y, w, h]); return true; };
  const off = (p, d, m) => [p[0] + Math.sin(d*D2R)*m*M2NM, p[1] + Math.cos(d*D2R)*m*M2NM];
  // intermediate holding positions: a single dashed yellow line across the taxiway, and a sign with its name
  const fsH = clamp(3.4*mpx, 10, 16);
  for (const h of Object.values(IHPS)) {
    const p = GN[h.node].p, a = P2(off(p, h.dir + 90, 13)), b = P2(off(p, h.dir - 90, 13));
    cx.save(); cx.lineCap = 'butt';
    cx.strokeStyle = 'rgba(20,23,26,.75)'; cx.lineWidth = Math.max(4, 1.3*mpx); cx.beginPath(); cx.moveTo(...a); cx.lineTo(...b); cx.stroke();
    cx.strokeStyle = '#f5c518'; cx.lineWidth = Math.max(2.4, 0.8*mpx); cx.setLineDash([Math.max(4, 1.6*mpx), Math.max(3, 1.1*mpx)]);
    cx.beginPath(); cx.moveTo(...a); cx.lineTo(...b); cx.stroke(); cx.restore();
    // the sign stands on the runway side of the taxiway, clear of the stands
    const side = typeof offOf === 'function' && !APT.runways && Math.abs(offOf(off(p, h.dir - 90, 20))) < Math.abs(offOf(off(p, h.dir + 90, 20))) ? -90 : 90;
    cx.font = `700 ${fsH}px ${FONT_L}`; const tw = cx.measureText(h.id).width + 8, q = P2(off(p, h.dir + side, 22));
    const x = q[0] - tw/2, y = q[1] - fsH*0.6;
    if (free(x, y, tw, fsH*1.25)) { cx.fillStyle = '#f5c518'; cx.fillRect(x, y, tw, fsH*1.25); cx.strokeStyle = '#111'; cx.lineWidth = 1; cx.strokeRect(x + 0.5, y + 0.5, tw - 1, fsH*1.25 - 1); cx.fillStyle = '#111'; cx.fillText(h.id, x + 4, y + fsH*0.98); }
  }
  // several runways (New York): a red mandatory sign with the runway at each holding position
  if (APT.runways && sc > 800) { const fr = clamp(3*mpx, 9.5, 14); cx.font = `700 ${fr}px ${FONT_L}`;
    for (const n of Object.values(GN)) { if (!n.p.hs) continue; const R = rwyById(n.p.hs), t = `${R.lo}-${R.hi}`, w = cx.measureText(t).width + 8, [X, Y] = P2(n.p), x = X + 6, y = Y - fr*1.5;
      if (!free(x, y, w, fr*1.25)) continue; cx.fillStyle = '#c8202a'; cx.fillRect(x, y, w, fr*1.25); cx.fillStyle = '#fff'; cx.fillText(t, x + 4, y + fr*0.98); } }
  // taxiway designators
  const fs = clamp(3.6*mpx, 10.5, 17); cx.font = `700 ${fs}px ${FONT_L}`;
  for (const a of twyAnchors()) {
    if (a.k && sc < 600) continue;   // zoomed out: one sign per stretch
    const [X, Y] = P2(a.p), w = cx.measureText(a.tw).width + 8, h = fs*1.25, x = X - w/2, y = Y - h/2;
    if (!free(x, y, w, h)) continue;
    cx.fillStyle = '#14171a'; cx.fillRect(x, y, w, h); cx.strokeStyle = '#f5c518'; cx.lineWidth = 1; cx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    cx.fillStyle = '#f5c518'; cx.fillText(a.tw, x + 4, y + fs*0.98);
  }
}
function drawAirport(){
  if (APT.drawAirport) return APT.drawAirport();   // several runways (New York) draw themselves
  const sc = V.scale, mpx = sc/1852;
  const c = (m, off) => { const p = rm(m, off); return [sx(p[0]), sy(p[1])]; };
  const path = (pts, close=true) => { cx.beginPath(); pts.forEach(([m,o],i) => cx[i?'lineTo':'moveTo'](...c(m,o))); if (close) cx.closePath(); };
  const quad = (m1, o1, m2, o2) => path([[m1,o1],[m2,o1],[m2,o2],[m1,o2]]);
  const dot = (m, o, r, col) => { const [X,Y] = c(m,o); cx.fillStyle = col; cx.beginPath(); cx.arc(X, Y, r, 0, 7); cx.fill(); };
  if (sc <= 70) { // radar: runway outline only
    cx.fillStyle = rgba('rwyOut', .9); path(AD.rwyPoly); cx.fill();
    return;
  }
  const lw = m => Math.max(1, m*mpx);
  const IMG = mapImagery(), st = S.xing.st;
  // airfield ground (D1: non-load-bearing surfaces) and roads
  cx.lineJoin = 'round'; cx.lineCap = 'round';
  cx.strokeStyle = C.road; cx.lineWidth = lw(14);
  if (!IMG) for (const r of AD.roads || []) { path(r, false); cx.stroke(); }
  // frontier fence with hatching on the Spanish side
  if (!IMG && FRONTIER.length) { cx.strokeStyle = rgba('r164', .55); cx.lineWidth = 1.2; poly(FRONTIER, false); cx.stroke(); }
  if (sc > 160 && !IMG) { cx.strokeStyle = rgba('r164', .35); for (let i = 0; i < FRONTIER.length-1; i++) { const a = FRONTIER[i], b = FRONTIER[i+1], L = dist(...a, ...b)/M2NM, n = Math.floor(L/25); for (let k = 0; k < n; k++) { const f = k/n, x = a[0]+(b[0]-a[0])*f, y = a[1]+(b[1]-a[1])*f; const X = sx(x), Y = sy(y); cx.beginPath(); cx.moveTo(X, Y); cx.lineTo(X+5, Y-7); cx.stroke(); } } }
  // pavement: over the street map the mapped aprons and taxiways are already there, so only the drawn chart paves them
  if (!IMG) {
    cx.fillStyle = C.concrete; for (const a of AD.aprons) { path(a); cx.fill(); }
    drawApronSlabs(path);
  }
  drawRunwayShoulders(path);
  if (IMG) {
    const lines = [];
    for (const k of LINE_KEYS) {
      const e = /^e\d+$/.test(k) && GE[+k.slice(1)];
      if (e && e.tw === 'APRON') continue;
      lines.push({ pts: AD.twys[k].map(([m, o]) => c(m, o)), w: paveWidth(e ? e.tw : k.replace(/[a-z]+$/, '')) });
    }
    drawPavement(lines, (AD.buildings || []).map(b => b.pts.map(([m, o]) => c(m, o))), mpx);
  } else {
    const twyTex = texPattern('twy', 40, RWY_ANGLE()) || C.asphalt;
    cx.strokeStyle = C.gShoulder; cx.lineWidth = lw(25);
    for (const k in AD.twys) { path(AD.twys[k], false); cx.stroke(); }
    cx.strokeStyle = twyTex; cx.lineWidth = lw(19);
    for (const k in AD.twys) { path(AD.twys[k], false); cx.stroke(); }
    if (AD.closedB && AD.closedB.length) { cx.strokeStyle = C.closed; path(AD.closedB, false); cx.stroke(); }
  }
  cx.fillStyle = texPattern('asphalt', 40, RWY_ANGLE()) || C.rwy;
  // turning pads at each end: the mapped loop paved 23 m wide plus the pad itself
  cx.strokeStyle = cx.fillStyle; cx.lineWidth = lw(23); path(TURN_E, false); cx.stroke(); path(TURN_W, false); cx.stroke();
  for (const k of ['E', 'W']) { if (!TURN_PAD[k]) continue; const { c: [cm, co], r } = TURN_PAD[k], [X, Y] = c(cm, co); cx.beginPath(); cx.arc(X, Y, (r + 8)*mpx, 0, 7); cx.fill(); }
  drawPavingDetail(c, path, mpx);
  if (!IMG) drawBuildings(c, path, mpx);
  // Winston Churchill Avenue across the runway
  if (!IMG && APT.xing) { cx.save(); cx.globalAlpha = 0.55; cx.strokeStyle = C.road; cx.lineWidth = lw(14); cx.lineCap = 'butt'; path([[985,-22],[1000,22]], false); cx.stroke(); cx.restore(); }
  if (sc > 150) {
    // runway markings: AD 2.9 only says the TDZ marks are non-standard, so the set below follows the ICAO Annex 14 layout
    cx.fillStyle = C.paint; cx.strokeStyle = C.paint;
    cx.lineWidth = lw(0.9); path([[0,RSS],[RWY_M,RSS]], false); cx.stroke(); path([[0,-RSS],[RWY_M,-RSS]], false); cx.stroke();   // side stripes
    quad(0.5, -RSS, 1.4, RSS); cx.fill(); quad(RWY_M - 1.4, -RSS, RWY_M - 0.5, RSS); cx.fill();                                        // runway ends
    cx.lineWidth = lw(0.9); cx.setLineDash([30*mpx, 20*mpx]); path([[THR_LO_M+85,0],[THR_HI_M-85,0]], false); cx.stroke(); cx.setLineDash([]);
    for (const [m0, dir] of [[THR_LO_M, 1], [THR_HI_M, -1]]) {
      quad(m0, RSS, m0 + dir*1.8, -RSS); cx.fill();                                                                // threshold bar
      for (let i = 0; i < (RHW > 20 ? 6 : 4); i++) for (const k of [-1, 1]) { const o = k*(3 + i*3.4); quad(m0 + dir*6, o - 0.9*k, m0 + dir*36, o + 0.9*k); cx.fill(); }   // 12 threshold stripes
      for (const k of [-1, 1]) { quad(m0 + dir*300, k*9, m0 + dir*345, k*15); cx.fill(); }                             // aiming point
      for (const [d, n] of [[150, 3], [450, 2], [600, 1]]) for (const k of [-1, 1]) for (let j = 0; j < n; j++) {       // touchdown zone pairs
        const o = k*(9 + j*3.3); quad(m0 + dir*d, o, m0 + dir*(d + 22.5), o + k*1.8); cx.fill();
      }
      // displaced threshold: centreline arrows and arrowheads in the pre-threshold area
      const pre = dir > 0 ? THR_LO_M : RWY_M - THR_HI_M;
      cx.lineWidth = lw(0.9);
      for (let d = 20; d < pre - 12; d += 40) { const m = m0 - dir*d; path([[m - dir*12, 0], [m, 0]], false); cx.stroke(); path([[m - dir*6, -2.5],[m, 0],[m - dir*6, 2.5]], false); cx.stroke(); }
      for (const k of [-1, 1]) { const m = m0 - dir*6; path([[m - dir*8, k*9],[m, k*12],[m - dir*8, k*15]], false); cx.stroke(); }
    }
    for (const [m0, lab, h] of [[THR_LO_M+58,RW_LO,CRS_LO],[THR_HI_M-58,RW_HI,CRS_HI]]) drawRwyDesignator(...c(m0, 0), lab, h, Math.max(9, 14*mpx));
    // turn-pad guidance lines and edge markings
    cx.strokeStyle = C.yellow; cx.lineWidth = lw(0.35); path(TURN_E, false); cx.stroke(); path(TURN_W, false); cx.stroke();
    cx.strokeStyle = C.paint; cx.lineWidth = lw(0.6);
    for (const k of ['E', 'W']) { if (!TURN_PAD[k]) continue; const { c: [cm, co], r } = TURN_PAD[k], [X, Y] = c(cm, co); cx.beginPath(); cx.arc(X, Y, (r + 7.5)*mpx, 0, 7); cx.stroke(); }
    // PAAG positions (yellow circular markings across the runway)
    cx.strokeStyle = 'rgba(231,194,58,.8)'; cx.lineWidth = lw(0.6);
    for (const m of AD.paag || []) for (const o of [-14, 0, 14]) { const [X,Y] = c(m,o); cx.beginPath(); cx.arc(X, Y, Math.max(1.5, 3*mpx), 0, 7); cx.stroke(); }
    // taxiway centre and edge lines (solid yellow edges, AD 2.9)
    cx.save(); cx.beginPath(); cx.rect(0, 0, W, H); AD.rwyPoly.forEach(([m,o],k) => cx[k?'lineTo':'moveTo'](...c(m, o*1.02))); cx.closePath(); cx.clip('evenodd');   // taxi lines stop at the runway edge
    groundLines(lw(0.3), () => { for (const k of LINE_KEYS) { path(AD.twys[k], false); cx.stroke(); } });
    cx.strokeStyle = C.yellow; cx.globalAlpha = 0.55; cx.lineWidth = lw(0.25);
    if (AD.edgeLines) for (const k of EDGE_KEYS) { const pts = AD.twys[k]; for (const s of [-9, 9]) { const off = pts.map(([m,o],i) => { const v = i ? [m - pts[i-1][0], o - pts[i-1][1]] : [pts[1][0]-m, pts[1][1]-o]; const L = Math.hypot(...v) || 1; return [m - v[1]/L*s, o + v[0]/L*s]; }); path(off, false); cx.stroke(); } }
    cx.globalAlpha = 1;
    cx.restore();
    // lead-on and lead-off lines over the runway, both ways from every entry
    { const seen = new Set(), leads = [];
      for (const f of Object.values(FIL)) for (const pts of [f.W, f.E]) { const key = JSON.stringify(pts); if (seen.has(key)) continue; seen.add(key); leads.push(leadLine(pts).map(([m, o]) => c(m, o))); }
      groundLines(lw(0.3), () => leads.forEach(strokeSmooth)); }
    // apron taxilanes and stand lead-ins (the stand box carries on the centreline and stop bar)
    groundLines(lw(0.3), () => { for (const s of STANDS) if (!s.noLead) { path([[mOf(s.lp), offOf(s.lp)], [s.m, s.off]], false); cx.stroke(); } });
    cx.save(); if (IMG) clipOut((AD.buildings || []).map(b => b.pts.map(([m, o]) => c(m, o)))); drawStandDetail(c, path, mpx); cx.restore();   // stand paint stops at the terminal walls
    // closed portion of B and B1: unserviceable crosses
    cx.strokeStyle = 'rgba(255,255,255,.75)'; cx.lineWidth = lw(0.8);
    // holding position markings (pattern A: solid lines on the taxiway side) and signs
    for (const [k, Hd] of Object.entries(HOLDS)) {
      const s = Math.sign(Hd.off);
      cx.strokeStyle = C.yellow; cx.lineWidth = lw(0.3);
      for (const [d, dash] of [[0.9,false],[0.3,false],[-0.3,true],[-0.9,true]]) { cx.setLineDash(dash ? [1*mpx+1, 1*mpx+1] : []); path(Hd.across ? [[Hd.m + Hd.across*d, Hd.off-9.5],[Hd.m + Hd.across*d, Hd.off+9.5]] : [[Hd.m-9.5, Hd.off + s*d],[Hd.m+9.5, Hd.off + s*d]], false); cx.stroke(); }
      cx.setLineDash([]);
      if (sc > 220) {
        const fs = Math.max(9, 3.4*mpx), q = c(Hd.m + 14, Hd.off + s*2); const txt = `${k}  ${RW_HI}-${RW_LO}`; cx.font = `700 ${fs}px ${FONT_L}`; const tw = cx.measureText(txt).width;
        cx.fillStyle = '#c8202a'; cx.fillRect(q[0], q[1]-fs*0.85, tw + 8, fs*1.2); cx.fillStyle = '#fff'; cx.fillText(txt, q[0]+4, q[1]+fs*0.15);
        cx.fillStyle = '#111'; cx.fillRect(q[0], q[1]-fs*0.85, fs*0.95+4, fs*1.2); cx.fillStyle = C.yellow; cx.fillText(k, q[0]+4, q[1]+fs*0.15);
      }
    }
    drawGroundSigns();
    // hot spots
    for (const [hn, hm, ho] of AD.hotspots || []) { const [X,Y] = c(hm, ho); cx.strokeStyle = rgba('hot', .85); cx.lineWidth = 1.2; cx.beginPath(); cx.arc(X, Y, 26*mpx+6, 0, 7); cx.stroke(); cx.fillStyle = rgba('hot', .95); cx.font = `600 11px ${FONT_L}`; cx.fillText(hn, X - 26*mpx - 30, Y + 4); }
  }
  // lighting (it is night at Gibraltar for the session)
  if (sc > 110) {
    cx.save(); cx.globalCompositeOperation = C.glow;
    const r = Math.max(1.1, 0.9*mpx), glow = (m, o, col, rr=r) => { const [X,Y] = c(m,o); cx.fillStyle = col; cx.beginPath(); cx.arc(X, Y, rr, 0, 7); cx.fill(); };
    for (let m = 0; m <= RWY_M; m += 60) { glow(m, RHW + 0.5, 'rgba(255,244,214,.75)'); glow(m, -RHW - 0.5, 'rgba(255,244,214,.75)'); }
    for (let o = -RHW + 0.5; o <= RHW - 0.5; o += 4) { glow(THR_LO_M, o, 'rgba(90,255,140,.9)'); glow(THR_HI_M, o, 'rgba(90,255,140,.9)'); glow(1, o, 'rgba(255,60,60,.85)'); glow(RWY_M-1, o, 'rgba(255,60,60,.85)'); }
    // SALS 300 m (09) and approach lights 27
    for (let d = 30; d <= 300; d += 30) glow(-d*0.15, 0, 'rgba(255,240,200,.0)');
    for (const k of EDGE_KEYS) { const pts = AD.twys[k]; for (let i = 0; i < pts.length-1; i++) { const [m1,o1] = pts[i], [m2,o2] = pts[i+1], L = Math.hypot(m2-m1, o2-o1), n = Math.floor(L/30); for (let j = 1; j < n; j++) { const f = j/n, m = m1+(m2-m1)*f, o = o1+(o2-o1)*f, vx = (m2-m1)/L, vy = (o2-o1)/L; glow(m - vy*10, o + vx*10, 'rgba(70,130,255,.85)'); glow(m + vy*10, o - vx*10, 'rgba(70,130,255,.85)'); } } }
    const on = Math.floor(S.t*1.4) % 2 === 0;
    for (const Hd of Object.values(HOLDS)) if (Hd.rgl) for (const sgn of [-1,1]) glow(Hd.m + sgn*12, Hd.off, (on === (sgn > 0)) ? 'rgba(255,190,40,.95)' : 'rgba(255,190,40,.18)', r*1.4);
    // apron floodlight pools
    for (const m of AD.floods || []) { const [X,Y] = c(m, 214), rr = 50*mpx; const g = cx.createRadialGradient(X, Y, 0, X, Y, rr); g.addColorStop(0, `rgba(255,220,160,${C.flood})`); g.addColorStop(1, 'rgba(255,220,160,0)'); cx.fillStyle = g; cx.beginPath(); cx.arc(X, Y, rr, 0, 7); cx.fill(); }
    cx.restore();
  }
  if (APT.xing) {
  // barriers, traffic and pedestrians at the crossing (laid along the OpenStreetMap crossing: footways, cycle lanes and service road)
  const col = st === 'CLOSED' ? C.xClosed : st === 'OPEN' ? C.xOpen : C.xMid;
  const down = st === 'CLOSED' || st === 'CLOSING';
  for (const off of [48, -48]) {
    const m0 = xingM(off), L = down ? XING_HW : XING_HW*0.35;            // a raised barrier shows as a short stub
    const a = c(m0 - XING_HW, off), b = c(m0 - XING_HW + 2*L, off), n = 6;
    cx.lineCap = 'butt'; cx.lineWidth = Math.max(2.5, 1.6*mpx);
    for (let k = 0; k < n; k++) { cx.strokeStyle = k % 2 ? (C.name === 'dark' ? '#e8edf2' : '#fff') : col; cx.beginPath(); cx.moveTo(a[0] + (b[0]-a[0])*k/n, a[1] + (b[1]-a[1])*k/n); cx.lineTo(a[0] + (b[0]-a[0])*(k+1)/n, a[1] + (b[1]-a[1])*(k+1)/n); cx.stroke(); }
    for (const e of [-1, 1]) { const q = c(m0 + e*XING_HW, off); cx.fillStyle = '#20262e'; cx.beginPath(); cx.arc(q[0], q[1], Math.max(1.8, 0.8*mpx), 0, 7); cx.fill(); }
  }
  if (sc > 160) {
    // people and bikes waiting beyond each barrier, and crossing when it is open
    const n = Math.min(60, Math.round(S.xing.queue/3)); cx.fillStyle = rgba('car', .85);
    for (let i = 0; i < n; i++) { const side = i % 2 ? 1 : -1, row = Math.floor(i/2), o = side*(56 + Math.floor(row/4)*4), w = ((row % 4) - 1.5)/1.5*XING_HW*0.75; const q = c(xingM(o) + w, o); cx.beginPath(); cx.arc(q[0], q[1], 1.6, 0, 7); cx.fill(); }
    if (st === 'OPEN' || st === 'OPENING') for (let i = 0; i < 10; i++) { const f = ((S.t*0.05 + i*0.1) % 1), o = (i % 2 ? 1 : -1)*(-60 + f*120), w = ((i*7) % 5 - 2)/2*XING_HW*0.7; const q = c(xingM(o) + w, o); cx.fillStyle = i % 3 ? rgba('car', .9) : rgba('apt', .9); cx.beginPath(); cx.arc(q[0], q[1], 1.5, 0, 7); cx.fill(); }
    if (sc > 650) {   // label in a small tag beside the southern barrier, clear of the runway
      const txt = `WINSTON CHURCHILL AVE · ${st}`, p = c(xingM(-66) - XING_HW - 6, -66); cx.font = `600 11px ${FONT_L}`;
      const w = cx.measureText(txt).width; cx.fillStyle = C.tagBg; cx.fillRect(p[0] - w - 10, p[1] - 9, w + 8, 16); cx.strokeStyle = col; cx.lineWidth = 1; cx.strokeRect(p[0] - w - 10.5, p[1] - 9.5, w + 9, 17);
      cx.fillStyle = col; cx.textAlign = 'right'; cx.fillText(txt, p[0] - 6, p[1] + 3); cx.textAlign = 'left';
    }
  }
  }
  if (sc > 180 && sc < 2400) {
    cx.fillStyle = rgba('lab', .72); cx.font = `600 12px ${FONT_L}`;
    if (IMG) { cx.fillStyle = C.name === 'dark' ? 'rgba(235,242,245,.92)' : '#fff'; cx.strokeStyle = 'rgba(0,0,0,.6)'; cx.lineWidth = 3; cx.lineJoin = 'round'; }
    const lab = (txt, m, off) => { const p = c(m, off); if (IMG) cx.strokeText(txt, p[0], p[1]); cx.fillText(txt, p[0], p[1]); };
    for (const [txt, m, off, when] of AD.labels || []) if (when === 'near' ? sc > 650 : !IMG) lab(txt, m, off);
  }
}

// ── aircraft ──────────────────────────────────────────────
function silhouette(ac, X, Y, mpx, col, shadow){
  const P = ac.perf, span = Math.max(9, P.span*mpx), len = Math.max(9, P.len*mpx);
  cx.save(); cx.translate(X, Y); cx.rotate(ac.hdg*D2R);
  cx.fillStyle = col; cx.strokeStyle = shadow ? 'rgba(0,0,0,0)' : 'rgba(0,0,0,.55)'; cx.lineWidth = 0.8;
  const L = len/2, fw = Math.max(1.2, len*0.06);
  cx.beginPath();
  // fuselage
  cx.moveTo(0, -L); cx.quadraticCurveTo(fw, -L*0.85, fw, -L*0.6); cx.lineTo(fw, L*0.75); cx.lineTo(0, L); cx.lineTo(-fw, L*0.75); cx.lineTo(-fw, -L*0.6); cx.quadraticCurveTo(-fw, -L*0.85, 0, -L);
  cx.fill(); cx.stroke();
  // wings (swept for jets, straight for props)
  const sw = P.shape === 'prop' ? 0.02 : 0.22, root = P.shape === 'prop' ? -0.12 : -0.06;
  cx.beginPath(); cx.moveTo(fw, L*root); cx.lineTo(span/2, L*(root+sw+0.1)); cx.lineTo(span/2, L*(root+sw+0.2)); cx.lineTo(fw, L*(root+0.32)); cx.lineTo(-fw, L*(root+0.32)); cx.lineTo(-span/2, L*(root+sw+0.2)); cx.lineTo(-span/2, L*(root+sw+0.1)); cx.lineTo(-fw, L*root); cx.closePath(); cx.fill(); cx.stroke();
  // tailplane
  cx.beginPath(); cx.moveTo(0, L*0.7); cx.lineTo(span*0.17, L*0.93); cx.lineTo(span*0.17, L*0.98); cx.lineTo(-span*0.17, L*0.98); cx.lineTo(-span*0.17, L*0.93); cx.closePath(); cx.fill(); cx.stroke();
  // engines
  cx.fillStyle = 'rgba(0,0,0,.35)';
  if (P.shape === 'jet') for (const s of [-1,1]) { cx.fillRect(s*span*0.17 - fw*0.55, L*(root+0.02), fw*1.1, L*0.22); }
  if (P.shape === 'biz') for (const s of [-1,1]) { cx.fillRect(s*fw*1.6 - fw*0.5, L*0.45, fw, L*0.2); }
  if (P.shape === 'prop') for (const s of [-1,1]) { cx.fillRect(s*span*0.2 - fw*0.4, L*(root-0.1), fw*0.8, L*0.25); }
  // nav lights + beacon
  if (mpx > 0.12 && !shadow) {
    const lr = Math.max(1.2, 0.8*mpx);
    cx.fillStyle = 'rgba(255,60,60,.95)'; cx.beginPath(); cx.arc(-span/2, L*(root+sw+0.15), lr, 0, 7); cx.fill();
    cx.fillStyle = 'rgba(60,255,120,.95)'; cx.beginPath(); cx.arc(span/2, L*(root+sw+0.15), lr, 0, 7); cx.fill();
    if (ac.state !== 'PARKED' && ac.state !== 'ONSTAND' && Math.floor(S.t*1.2 + hash(ac.cs)%7) % 2 === 0) { cx.fillStyle = 'rgba(255,40,40,.95)'; cx.beginPath(); cx.arc(0, 0, lr*1.6, 0, 7); cx.fill(); }
    if (ac.onRwy && Math.floor(S.t*2.2) % 3 === 0) { cx.fillStyle = 'rgba(255,255,255,.95)'; cx.beginPath(); cx.arc(-span/2, L*(root+sw+0.15), lr*1.7, 0, 7); cx.arc(span/2, L*(root+sw+0.15), lr*1.7, 0, 7); cx.fill(); }
  }
  cx.restore();
  return Math.max(span, len);
}
// a landing or take-off clearance that still stands: cleared to land until it is off the runway (or goes around),
// cleared for take-off until it is airborne
const clrOf = ac => outOfCtl(ac) || ac.state === 'PRE' ? null : ac.ctl && (!ac.ground || ac.onRwy) ? 'CTL' : ac.cto && ac.ground && ac.kind === 'DEP' ? 'CTO' : null;
function drawAc(ac){
  const sc = V.scale, M = acMid(ac), X = sx(M[0]), Y = sy(M[1]);
  if (X < -200 || Y < -200 || X > W+200 || Y > H+200) return;
  const sel = S.sel === ac, conf = S.conflictSet.has(ac.cs);
  const col = ac.state === 'PRE' ? (sel ? C.sel : C.pre) : outOfCtl(ac) ? (conf ? C.conf : C.off) : conf || (ac.emerg && !ac.emerg.done) ? C.conf : sel ? C.sel : ac.state === 'DIVERTING' ? C.div : ac.kind === 'ARR' ? C.arr : C.dep;   // an approved diversion stands out in magenta
  cx.fillStyle = col; cx.globalAlpha = 0.45;
  if (!ac.ground && sc < 400) for (const [hx,hy] of ac.hist) cx.fillRect(sx(hx)-1, sy(hy)-1, 2, 2);
  cx.globalAlpha = 1;
  const mpx = sc/1852;
  if ((ac.ground && sc > 150) || (sc > 400 && ac.alt < 2000)) {
    if (ac.ground && C.gShadow) { const d = Math.max(1.5, 2.5*mpx); silhouette(ac, X + d, Y + d*0.7, mpx, C.gShadow, true); }
    const sz = silhouette(ac, X, Y, mpx, ac.ground ? (ac.kind === 'ARR' ? C.acArr : C.acDep) : col);
    if (sel || ac.need) { cx.strokeStyle = sel ? C.sel : rgba('proc', .9); cx.lineWidth = 1.2; cx.setLineDash(sel ? [] : [3,3]); cx.beginPath(); cx.arc(X, Y, sz/2 + 5, 0, 7); cx.stroke(); cx.setLineDash([]); }
  } else {
    cx.strokeStyle = col; cx.lineWidth = sel ? 2 : 1.3;
    if (ac.ground) { cx.beginPath(); cx.arc(X, Y, 3, 0, 7); cx.stroke(); }
    else {
      planeIcon(X, Y, bodyHdg(ac), col, sel, ac.t);   // type-shaped icon pointing along the heading
    }
  }
  if (ac.ground && sc < 70) return;
  if (dormant(ac) && !sel) return;   // parked with nothing due: no data block
  const lx = X + 16, ly = Y - 26;
  cx.strokeStyle = col; cx.globalAlpha = 0.6; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(X+8, Y-8); cx.lineTo(lx-2, ly+6); cx.stroke(); cx.globalAlpha = 1;
  cx.font = `500 11.5px ${FONT_D}`;
  const l1 = ac.cs + (ac.emerg && !ac.emerg.done ? ' ' + ac.emerg.k : '') + (ac.need ? ' ◆' : '');
  let l2, l3 = '';
  if (ac.ground) { l2 = `${ac.t}/${ac.perf.wake} ${stateLabel(ac)}`; if (ac.held) l3 = 'HOLD POSN';
    else if (towOn(ac)) l3 = 'TOW › ' + (ac.path && ac.towTgt ? ac.towTgt + ' › ' : '') + ac.tow.to.id; else if (ac.waiting) l3 = `GIVING WAY ${ac.waiting}`; }
  else {
    const a = String(Math.max(0, Math.round(ac.alt/100))).padStart(3,'0'), tr = ac.vs > 300 ? '↑' : ac.vs < -300 ? '↓' : ' ';
    const cl = ac.mode === 'FINAL' ? (ac.appId ? 'RNP' : APT.appShort) : ac.tgtAlt != null ? String(Math.round(ac.tgtAlt/100)).padStart(3,'0') : '';
    l2 = `${a}${tr}${cl} ${String(Math.round(ac.gs/10)).padStart(2,'0')}`;
    l3 = ac.state === 'PRE' ? `${ac.t} ${ac.o} PENDING` : `${ac.t} ${ac.kind === 'ARR' ? (ac.state === 'DIVERTING' ? 'DIV ' + ((divDest(ac) || {}).icao || ac.diverting || '') : ac.app ? 'R'+ac.app : ac.o) : ac.d}${outOfCtl(ac) ? ' XFR' : ac.freq === 'TWR' ? ' T' : ''}`;
  }
  const w = Math.max(cx.measureText(l1).width, cx.measureText(l2).width, l3 ? cx.measureText(l3).width : 0);
  const clr = clrOf(ac), ck = clr ? ` ✓ ${clr}` : '', ckW = clr ? cx.measureText(ck).width : 0, W1 = Math.max(w, cx.measureText(l1).width + ckW + 3);
  { cx.fillStyle = C.tagBg; cx.fillRect(lx-3, ly-11, W1+6, (l3 ? 3 : 2)*13 + 3);
    cx.strokeStyle = clr ? C.clr : C.tagEdge; cx.lineWidth = clr ? 2 : 1; cx.strokeRect(lx-3.5, ly-11.5, W1+7, (l3 ? 3 : 2)*13 + 4); }
  cx.fillStyle = col; cx.fillText(l1, lx, ly); cx.fillText(l2, lx, ly+13); if (l3) cx.fillText(l3, lx, ly+26);
  if (clr) { cx.fillStyle = C.clr; cx.font = `700 11.5px ${FONT_D}`; cx.fillText(ck, lx + cx.measureText(l1).width - 1, ly); }
}

function stateLabel(ac){
  return ({ PARKED:(ac.stand && ac.stand.area === 'hangar' ? 'HANGAR ' : 'STAND ')+(ac.stand?ac.stand.id:''), PUSH:'PUSHBACK', PULL:'PULL FORWARD', READY:'STARTED', TAXI:ac.holdAt && !ac.path ? 'HOLDING '+ac.holdAt : 'TAXI '+(ac.hp||''), HOLDPT:'HOLDING '+(ac.hp||''), LINEUP:'LINING UP', LINEDUP:'LINED UP', TAKEOFF:'TAKE-OFF', AIRBORNE:'AIRBORNE', CLIMB:'CLIMBING', INBOUND:'INBOUND', VECTORS:'VECTORS', FINAL:(ac.appId ? finOf(ac).short : APT.appShort)+' '+(ac.app||''), HOLDING:'HOLDING', MISSED:'MISSED APP', DIVERTING:'DIVERTING', ROLLOUT:'LANDING ROLL', TOW:ac.towHold ? 'TOW HOLDING '+ac.towHold : 'UNDER TOW', PRE:'PENDING', ROLLED:'ON RUNWAY', VACATING:ac.taxiIn ? 'TAXI IN' : ac.holdAt ? 'HOLDING '+ac.holdAt.replace(/~\d+$/, '') : ac.vacated ? 'VACATED' : 'VACATING', ONSTAND:'ON STAND' })[ac.state] || ac.state;
}

// ═════════════════════════ console UI ═════════════════════════
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
function select(ac){ if (ac && outOfCtl(ac)) return; S.sel = ac; renderSel(); renderStrips(true); }
// ── phone and tablet: one panel at a time under the scope, chosen from a tab bar ──
const phoneMQ = matchMedia('(max-width: 900px)');
function setMTab(t){
  const app = document.querySelector('.app'); if (!app) return;
  app.dataset.mtab = t;
  document.querySelectorAll('#mtabs [data-mtab]').forEach(b => b.classList.toggle('on', b.dataset.mtab === t));
  if (t === 'log') { const l = $('log'); l.scrollTop = l.scrollHeight; }
  requestAnimationFrame(resize);
}
function tapSelect(ac){ select(ac); if (phoneMQ.matches && document.querySelector('.app').dataset.mtab !== 'flight') setMTab('flight'); }
document.querySelectorAll('#mtabs [data-mtab]').forEach(b => b.onclick = () => setMTab(b.dataset.mtab));
setMTab('strips');
phoneMQ.addEventListener && phoneMQ.addEventListener('change', () => requestAnimationFrame(resize));
function renderAtis(){
  const w = S.wx, c = windComp(w, crsOf(S.rwy)), X = S.xing, tex = turbExcess(w), wl = windLimit({ perf: { wake: 'M' } }, S.rwy);
  const cloud = w.clouds.length ? w.clouds.join(' ') : (w.raw.includes('CAVOK') ? 'CAVOK' : 'NSC');
  const pct = X.st === 'CLOSING' ? clamp(1 - (X.t - S.t)/150, 0, 1) : X.st === 'CLOSED' ? 1 : X.st === 'OPENING' ? clamp((X.t - S.t)/15, 0, 1) : 0;
  $('atis').innerHTML = `
    <div class="ph"><span class="lbl">ATIS</span><button id="atisRead" class="atis-letter" title="Read the ATIS broadcast">${S.atis}</button>${APT.splitRwy ? '' : `<span class="lbl dimmer">${phonetic(S.atis)}</span>`}
      <span class="grow"></span>${S.atisAlert ? '<button id="atisWarn" class="atis-warn" title="The ATIS has changed: check the runway in use and your clearances, then click to acknowledge">ATIS</button>' : ''}<span class="lbl">${APT.rwyConfigs ? 'Flow' : APT.splitRwy ? 'Land' : 'Runway'}</span>
      ${APT.rwyConfigs ? `<span class="seg sm">${APT.rwyConfigs.map(c => `<button data-cfg="${c.land}" class="${APT.configOf(S.rwy) === c.key ? 'on' : ''}" title="Land ${c.lands.join(' and ')}, depart ${c.deps.join(' and ')}">${c.name}</button>`).join('')}</span>`
        : RW_ENDS.length > 2 ? `<select id="rwSel" class="rwsel" aria-label="Landing runway">${RW_ENDS.map(r => `<option${r === S.rwy ? ' selected' : ''}>${r}</option>`).join('')}</select><span class="lbl">Dep</span><select id="drSel" class="rwsel" aria-label="Departure runway">${RW_ENDS.map(r => `<option${r === depRw() ? ' selected' : ''}>${r}</option>`).join('')}</select>`
        : `<span class="seg sm"><button id="rwHi" class="${S.rwy===RW_HI?'on':''}">${RW_HI}</button><button id="rwLo" class="${S.rwy===RW_LO?'on':''}">${RW_LO}</button></span>${APT.splitRwy ? `<span class="lbl">Dep</span><span class="seg sm"><button id="drHi" class="${depRw()===RW_HI?'on':''}">${RW_HI}</button><button id="drLo" class="${depRw()===RW_LO?'on':''}">${RW_LO}</button></span>` : ''}`}</div>
    <div class="metar"></div>
    <div class="tiles">
      <div class="tile"><div class="lbl">Wind</div><div class="v">${w.vrb?'VRB':hdg3(w.dir)}°/${w.spd}${w.gust?'<small>G'+w.gust+'</small>':''}</div></div>
      <div class="tile"><div class="lbl">Head / X ${S.rwy}</div><div class="v ${wl ? 'bad':''}" ${wl ? `title="${esc(wl)}"` : ''}>${Math.round(c.head)} / ${Math.round(c.cross)}</div></div>
      <div class="tile"><div class="lbl">Vis · Cloud</div><div class="v ${w.vis < 5000 ? 'bad' : ''}">${w.vis >= 9999 ? '10k+' : w.vis} <small>${esc(cloud.split(' ')[0] || '')}</small></div></div>
      <div class="tile"><div class="lbl">${APT.inHg ? 'Altimeter' : 'QNH'}</div><div class="v">${APT.inHg ? w.inhg.toFixed(2) : w.qnh}</div></div>
      ${APT.rnp ? (() => { const a = APT.minsOk(w, S.rwy), r = APT.rnpMinsOk(w, S.rwy); return `<div class="tile" title="Circling minima / RNP AR minima"><div class="lbl">${APT.appShort} · RNP</div><div class="v ${a ? 'ok' : r ? '' : 'bad'}">${a ? 'OK' : 'BELOW'} · ${r ? 'OK' : 'BELOW'}</div></div>`; })()
        : `<div class="tile"><div class="lbl">${APT.appShort} mins</div><div class="v ${APT.minsOk(w, S.rwy)?'ok':'bad'}">${APT.minsOk(w, S.rwy)?'OK':'BELOW'}</div></div>`}
      <div class="tile"><div class="lbl">Temp / Dew</div><div class="v">${w.temp}° / ${w.dew}°</div></div>
    </div>
    ${S.emg && S.emg.rwyBlock ? `<div class="warnline bad">Runway ${S.rwy} closed: ${esc(S.emg.rwyBlock.why)}. Reopens in about ${Math.max(1, Math.ceil((S.emg.rwyBlock.until - S.t)/60))} min.</div>` : ''}
    ${S.emg && S.emg.ws ? `<div class="warnline">Windshear reported on final ${S.emg.ws.rw} by ${esc(S.emg.ws.cs)}: ${esc(S.emg.ws.text)}. Pass it with <b>WS</b>.</div>` : ''}
    ${tex > 0 ? `<div class="warnline">Turbulence: ${Math.round(tex)} kt over the ${APT.turbName || 'Special Procedures'} limit. Expect windshear on final.</div>` : ''}
    ${APT.atisPanel ? APT.atisPanel(w) : ''}
    ${!APT.xing ? '' : `<div class="xing st-${X.st}">
      <div class="xing-l"><div class="lbl">Winston Churchill Avenue</div>
        <div class="xing-st">${X.st}${X.st==='CLOSING'?' · <span id="xCount">'+Math.max(0,Math.ceil(X.t - S.t))+'</span> s':''}${X.st==='CLOSED'?' · '+Math.round(X.queue)+' waiting':''}</div>
        <div class="bar"><i style="width:${Math.round(pct*100)}%"></i></div></div>
      <button id="xBtn" class="${X.st==='OPEN'||X.st==='OPENING'?'danger':'go'}">${X.st==='OPEN'||X.st==='OPENING'?'Close road':'Open road'}</button></div>`}`;
  $('atis').querySelector('.metar').textContent = w.raw;
  $('atisRead').onclick = () => openAtis();
  if (APT.rwyConfigs) $('atis').querySelectorAll('[data-cfg]').forEach(bt => bt.onclick = () => setRwy(bt.dataset.cfg));
  else if ($('rwSel')) { $('rwSel').onchange = e => setRwy(e.target.value); $('drSel').onchange = e => setDepRwy(e.target.value); }
  else { $('rwHi').onclick = () => setRwy(RW_HI); $('rwLo').onclick = () => setRwy(RW_LO); }
  if ($('drHi')) { $('drHi').onclick = () => setDepRwy(RW_HI); $('drLo').onclick = () => setDepRwy(RW_LO); }
  if ($('atisWarn')) $('atisWarn').onclick = () => { S.atisAlert = false; sys(`ATIS information ${phonetic(S.atis)} acknowledged.`); renderAtis(); };
  if ($('xBtn')) $('xBtn').onclick = toggleXing;
}
function setRwy(r){
  // New York: the landing runway brings its departure runway
  if (S.rwy === r) return; S.rwy = r; if (APT.depFor) S.depRwy = APT.depFor(r); nextAtis(false); sys(`Runway ${r} in use. Information ${phonetic(S.atis)} is current.`);
  for (const ac of S.acs) if (ac.kind === 'ARR' && !ac.app && ac.mode === 'NAV' && ac.airborne) { const rt = ARR_ROUTE[ac.gate][r]; const j = rt.findIndex(id => ac.route.includes(id)); ac.route = j >= 0 ? rt.slice(j) : rt.slice(-1); }
  renderAtis(); emit('rwy', r);
}
// airports that land one way and depart the other (Innsbruck) choose the departure runway separately
function setDepRwy(r){ if (depRw() === r) return; S.depRwy = r; nextAtis(false); sys(`Departure runway ${r}. Information ${phonetic(S.atis)} is current.`); renderAtis(); emit('rwy', r); }
function toggleXing(){
  const X = S.xing;
  if (X.st === 'OPEN' || X.st === 'OPENING') { X.st = 'CLOSING'; X.t = S.t + 150; sys('Closing Winston Churchill Avenue: pedestrians and cyclists being cleared, barriers lowering, FOD check (about 2½ minutes).'); emit('xing', 'CLOSING'); }
  else { if (S.acs.some(a => a.onRwy)) { sys('The runway is occupied, the road must stay closed.', true); return; } X.st = 'OPENING'; X.t = S.t + 15; X.queue = 0; emit('xing', 'OPENING'); }
  renderAtis();
}
// strips show flight levels above this (the US transition altitude is 18,000 ft)
const FL_ABOVE = APT.inHg ? APT.ta : 6000;
const ICON = {
  up: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2l5 6H9v6H7V8H3z" fill="currentColor"/></svg>',
  dn: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14l5-6H9V2H7v6H3z" fill="currentColor"/></svg>'
};
const relCls = ac => { const R = ac.rel; return !R ? 'none' : R.st === 'REQ' ? 'req' : R.st === 'EXP' ? 'exp' : R.nb && S.t < R.nb ? 'req' : 'ok'; };
function relText(ac){
  const R = ac.rel, who = relUnit(ac), sid = ac.sid || sidName(ac.gate, depRw(ac));
  const st = !needRel(ac) ? 'no release needed' : !R ? `no release from ${who} yet` : R.st === 'REQ' ? `release requested, ${who} will call back` : R.st === 'EXP' ? 'release expired: request a new one' : R.nb && S.t < R.nb ? `released not before ${zt(R.nb).slice(0,5)}, until ${zt(R.until).slice(0,5)}` : `released until ${zt(R.until).slice(0,5)}`;
  return `<b>${esc(sid)}</b> · ${st}`;
}
function renderSel(){
  if (S.sel && outOfCtl(S.sel)) S.sel = null;   // transferred to the next unit: no longer yours to select
  const ac = S.sel, el = $('sel');
  if (!ac || !S.acs.includes(ac)) { el.innerHTML = `<div class="ph"><span class="lbl">Selected flight</span></div><p class="empty">Click a target on the scope or a strip below. Flights marked <b class="need-dot">◆</b> are waiting on you. <kbd>Tab</kbd> cycles flights.</p>`; return; }
  const air = ac.airborne, route = ac.kind === 'ARR' ? `${ac.o} → ${APT.icao}` : `${APT.icao} → ${ac.d}`;
  let html = `<div class="sel-head"><span class="cs ${ac.kind}">${ac.cs}</span><span class="chip ${ac.kind}">${ac.kind === 'ARR' ? 'Arrival' : 'Departure'}</span><span class="chip">${stateLabel(ac)}</span>${ac.kind === 'ARR' && ac.stand && ac.state !== 'ONSTAND' && !ac.handed ? `<span class="chip stand">Stand ${ac.stand.id}</span>` : ''}<span class="grow"></span><button class="rm" data-rm title="Remove this flight from the session (if it gets stuck)" aria-label="Remove ${ac.cs}">Remove</button><span class="lbl">${ac.state === 'PRE' ? 'Not on frequency' : ac.freq === 'TWR' ? `${APT.tower[0].split(' ').pop()} ${APT.tower[1]}` : `${APT.radar[0].split(' ').pop()} ${APT.radar[1]}`}</span></div>
    <div class="meta">${ac.perf.name} · ${ac.t}/${ac.perf.wake} · ${route} · sqk ${ac.sqk}${ac.reg ? ' · '+ac.reg : ''}<br>“${spoken(ac.cs)}”</div>`;
  if (ac.emerg && !ac.emerg.done) html += `<div class="emgline"><b>${ac.emerg.k}</b> ${esc(ac.emerg.why)}${ac.emerg.ack ? '' : ` <button data-c="ROG" class="danger">Roger ${ac.emerg.k}</button>`}</div>`;
  if (ac.need && !(ac.emerg && /^(MAYDAY|PAN)/.test(ac.need))) html += `<div class="needline">◆ ${esc(ac.need)}</div>`;
  if (ac.kind === 'ARR' && !['PRE', 'ONSTAND', 'DIVERTING', 'TOW'].includes(ac.state)) html += standLine(ac);
  if (ac.kind === 'DEP' && ac.ground && ac.state !== 'PRE') html += `<div class="relline ${needRel(ac) ? relCls(ac) : 'ok'}">${relText(ac)}</div>`;
  // a parked departure that hasn't called yet: say when it will, so the greyed-out buttons make sense
  if (ac.kind === 'DEP' && !ac.airborne && SLOT[ac.cs] && SLOT[ac.cs].ctot != null) { const c = SLOT[ac.cs].ctot; html += `<div class="meta">Slot (CTOT) <b>${hhmm(c)}Z</b>: take-off between ${hhmm(c - 5)} and ${hhmm(c + 10)}Z.</div>`; }
  if (towOn(ac)) html += `<div class="meta">Under tow to ${towDest(ac.tow.to)}${ac.towHold ? `, the tug holding at ${ac.towHold}: send it on, or pick another route or holding point.` : ac.towTgt ? `, stopping at holding point ${ac.towTgt} to wait for you.` : '. Hold position stops it.'}</div>`;
  if (inHangar(ac)) html += `<div class="meta">In ${ac.stand.name}${ac.kind === 'DEP' ? (ac.tow && !ac.tow.asked && ac.tow.at < Infinity ? `: the tug calls to tow it out to a stand at about ${zt(ac.tow.at).slice(0,5)}Z, an hour before off-blocks.` : '.') : ', stored for the day.'}</div>`;
  if (ac.kind === 'DEP' && ac.state === 'PARKED' && ac.slotHold) html += `<div class="meta">Held on stand from the Flights board: the crew won’t call for start-up until you release it there.</div>`;
  else if (ac.kind === 'DEP' && ac.state === 'PARKED' && !ac.need && ac.reqAt > S.t) html += `<div class="meta">Parked. The crew calls for start-up at about ${zt(ac.reqAt).slice(0,5)}Z (in ${Math.max(1, Math.round((ac.reqAt - S.t)/60))} min). Start, push and taxi open then; you can ask for the release now, but it is only valid for about ten minutes.</div>`;
  const b = (c, label, en=true, cls='') => `<button class="${cls}" data-c="${c}" ${en ? '' : 'disabled'}>${label}</button>`;
  const wireRm = () => { const r = el.querySelector('[data-rm]'); if (r) r.onclick = () => { if (confirm(`Remove ${ac.cs} from the session? Use this if it is stuck: its stand and anything it was blocking are freed.`)) command(ac.cs + ' REMOVE'); }; };
  if (ac.state === 'PRE') { el.innerHTML = html + `<div class="readout"><span><b>${Math.round(ac.alt)}</b> ft</span><span>GS <b>${Math.round(ac.gs)}</b></span><span><b>${Math.round(Math.hypot(ac.x-RADAR_REF[0], ac.y-RADAR_REF[1]))}</b> NM</span></div><p class="empty">Not on your frequency yet. It is still with the previous sector and ${ac.slotHold ? 'is holding outside your airspace until you release it on the Flights board' : `calls ${APT.radar[0]} at the boundary, about ${Math.max(1, Math.round((ac.preAt - S.t)/60))} min from now`}.</p>`; wireRm(); return; }
  if (air) {
    html += `<div class="readout"><span><b>${Math.round(ac.alt)}</b> ft ${ac.vs > 300 ? ICON.up : ac.vs < -300 ? ICON.dn : ''}→ ${ac.mode === 'FINAL' ? (ac.appId ? finOf(ac).short : APT.appShort) + ' profile' : (ac.tgtAlt ?? '–') + (ac.via && ac.app ? ' via procedure' : '')}</span><span>HDG <b>${hdg3(ac.hdg)}</b></span><span>IAS <b>${Math.round(ac.ias)}</b></span><span>GS <b>${Math.round(ac.gs)}</b></span></div>
    ${ac.route.length || ac.mode === 'HOLD' || ac.onSid ? `<div class="meta">${ac.onSid ? ac.sid + ' departure, initial turn, then ' + exitRouteOf(ac).join(' › ') : ac.route.length ? 'Route '+ac.route.filter(k => !WP[k].hide).join(' › ') : ''}${ac.mode === 'HOLD' ? 'Holding at '+ac.hold.name : ''}</div>` : ''}
    <div class="ctl"><label><span class="lbl">Heading</span><input id="iH" placeholder="270" inputmode="numeric"></label><label><span class="lbl">Altitude ×100</span><input id="iA" placeholder="40" inputmode="numeric"></label><label><span class="lbl">Speed</span><input id="iS" placeholder="180" inputmode="numeric"></label></div><div class="btns">`;
    if (ac.diverting && ac.state !== 'DIVERTING') html += b(`DCT ${ac.diverting} A${(APT.divertAlt || 8000)/100}`, 'Approve diversion', true, 'go');
    if (ac.need === 'Say again' && ac.lastCmd) html += b(ac.lastCmd, 'Say again: ' + esc(ac.lastCmd), true, 'go');
    if (ac.kind === 'ARR' && S.emg && S.emg.ws && !ac.wsTold) html += b('WS', 'Pass windshear', true, 'go');
    // the exit to vacate by after landing, once it is cleared for an approach: only those it can still make
    if (ac.kind === 'ARR' && ac.app && !['MISSED', 'DIVERTING'].includes(ac.state)) { const ch = vacChoices(ac); if (ac.reqExit && !ch.includes(ac.reqExit)) ch.unshift(ac.reqExit);
      html += ch.map(h => b('VAC '+h, vacLabel(ac, h), true, ac.reqExit === h ? 'on' : '')).join(''); }
    if (ac.kind === 'ARR') html += (APT.appRwys ? APT.appRwys() : [RW_HI, RW_LO]).map(r => b('APP '+r, APT.appShort+' '+r, true, landRw(ac)===r?'on':'')).join('') + (APT.rnp ? APT.rnpButtons(S.rwy).map(([c, l]) => b(c, l, true, ac.need === 'Request RNP approach' ? 'go' : '')).join('') : '') + b('HO','To Tower', ac.freq !== 'TWR') + b('CTL','Cleared to land', true, 'go') + b('GA','Go around', true, 'danger') + b('HOLD','Hold');
    else html += b('HO', ac.freq === 'TWR' ? `To ${(APT.depRadar || APT.radar)[0].split(' ').pop()} ${(APT.depRadar || APT.radar)[1]}` : `To ${NEXT_UNIT[ac.gate][0].split(' ')[0]} ${NEXT_UNIT[ac.gate][1]}`, true, 'go') + b('DCT '+exitRouteOf(ac)[0], 'Direct '+exitRouteOf(ac)[0]) + b('A'+APT.climbFL, 'Climb FL'+APT.climbFL);
    html += `<select id="iD" aria-label="Direct to fix"><option value="">Direct to…</option>${Object.keys(WP).filter(k => !WP[k].hide).map(k => `<option>${k}</option>`).join('')}</select></div>`;
  } else {
    html += `<div class="btns">`;
    if (towAsk(ac)) html += b('TOW', `${ac.towHold ? 'Continue tow' : 'Approve tow'} to ${towDest(ac.tow.to)}`, true, 'go') + b('POP:tow', ac.towHold ? 'Tow route or hold…' : 'Tow by route or to hold…');
    if (ac.kind === 'ARR' && (ac.state === 'ONSTAND' || ac.state === 'TOW')) {}   // parked for the day: only a tug moves it
    else if (ac.kind === 'DEP') {
      const south = ac.stand && ac.stand.area === 'south', canTaxi = ac.state === 'READY' || (ac.state === 'PARKED' && !!ac.need && ac.need !== 'Request tow') || ac.state === 'TAXI' || ac.state === 'HOLDPT';
      const startReq = ac.state === 'PARKED' && !!ac.need && ac.need !== 'Request tow';
      html += b('POP:push','Start &amp; push…', startReq, startReq ? 'go' : '');
      if (ac.state === 'PUSH' || ac.state === 'READY') html += b('PULL', `Pull back to ${APT.standWord || 'stand'} ${ac.stand ? ac.stand.id : ''}`, !ac.leftStand);
      html += b('POP:taxi', ac.state === 'TAXI' ? 'Re-route taxi…' : 'Taxi…', canTaxi && ac.state !== 'HOLDPT', ac.state === 'READY' && ac.need ? 'go' : '');
      const R = ac.rel, relOk = !needRel(ac) || (R && R.st === 'OK' && !(R.nb && S.t < R.nb)), canRel = ac.state !== 'TOW';
      if (needRel(ac)) html += b('REL', R && R.st === 'REQ' ? 'Release requested…' : relOk ? 'Released' : 'Request release', canRel && (!R || R.st === 'EXP'), ac.state === 'HOLDPT' && !R ? 'go' : '');
      // taxiing to the runway, it can be cleared on before it reaches the holding point, and won't stop there
      const onTaxi = luTaxi(ac), cleared = onTaxi && (ac.luq || ac.cto);
      html += b('LU', ac.luq && onTaxi ? 'Lining up' : 'Line up', ac.state === 'HOLDPT' || (onTaxi && !cleared), ac.luq && onTaxi ? 'on' : '')
        + b('CTO', 'Cleared take-off', (['HOLDPT','LINEUP','LINEDUP'].includes(ac.state) && !(ac.state === 'LINEUP' && ac.cto)) || (onTaxi && !ac.cto), ac.cto && (onTaxi || ac.state === 'LINEUP') ? 'on' : relOk ? 'go' : '');
    } else {
      // the runway exits offered come from the airport's profile
      // it vacates by itself; these override the exit until it is off the runway
      const canVac = ['ROLLED','ROLLOUT'].includes(ac.state) || (ac.state === 'VACATING' && ac.onRwy);
      const ch = canVac ? vacChoices(ac) : APT.vacExits ? APT.vacExits(ac) : Object.keys(HOLDS); if (canVac && ac.reqExit && !ch.includes(ac.reqExit)) ch.unshift(ac.reqExit);
      html += ch.map(h => b('VAC '+h, canVac && ac.state !== 'VACATING' ? vacLabel(ac, h) : 'Vacate '+h.replace(/~\d+$/, ''), canVac, (ac.state === 'VACATING' ? ac.exit : ac.reqExit) === h ? 'on' : '')).join('');
      html += b('VAC','Backtrack', ['ROLLED','ROLLOUT'].includes(ac.state), ac.state === 'ROLLED' ? 'go' : '');
      // clear of the runway it stops and waits for this
      const canIn = ac.state === 'VACATING' && !ac.onRwy;
      const sw = APT.standWord || 'stand', sid = ac.stand ? sw + ' ' + ac.stand.id : 'a ' + sw;
      html += b('TAXI', (ac.taxiIn ? 'Taxiing to ' : 'Taxi to ') + sid, canIn && !ac.taxiIn && !!ac.stand, ac.taxiIn ? 'on' : ac.vacated && ac.stand ? 'go' : '');
      html += b('POP:holdin', 'Taxi to holding point…', canIn);
    }
    if (xingAhead(ac) >= 0) { const r = rwyName(ac.path.pts[xingAhead(ac)].hs); html += b('CROSS ' + r, 'Cross runway ' + r, true, ac.hsAt ? 'go' : ''); }
    html += b(ac.held ? 'RES' : 'HP', ac.held ? 'Continue taxi' : 'Hold position', !!ac.path && ac.state !== 'TAKEOFF');
    html += `</div>`;
  }
  el.innerHTML = html; wireRm();
  // pointing at an exit button shows that way off the runway on the map
  el.onmouseover = e => { const bt = e.target.closest && e.target.closest('button[data-c^="VAC "]'); vacHover = bt && !bt.disabled ? { ac: S.sel, ex: bt.dataset.c.slice(4) } : null; };
  el.onmouseleave = () => { vacHover = null; };
  { const sp = $('iStand'); if (sp) sp.onchange = () => sp.value && command(`${ac.cs} STAND ${sp.value}`); }
  el.querySelectorAll('button[data-c]').forEach(bt => bt.onclick = () => { const c = bt.dataset.c; if (c === 'POP:push') openPushPop(ac, bt); else if (c === 'POP:taxi') openTaxiPop(ac, bt); else if (c === 'POP:holdin') openHoldInPop(ac, bt); else if (c === 'POP:tow') openTowPop(ac, bt); else command(ac.cs+' '+c); });
  const keyCmd = (id, pre) => { const i = $(id); if (i) i.onkeydown = e => { if (e.key === 'Enter' && i.value.trim()) command(`${ac.cs} ${pre}${i.value.trim()}`); }; };
  keyCmd('iH','H'); keyCmd('iA','A'); keyCmd('iS','S');
  const d = $('iD'); if (d) d.onchange = () => d.value && command(`${ac.cs} DCT ${d.value}`);
}
// an arrival's stand: the one assigned, the airline's usual area, and a picker of the free stands (that area first)
function standLine(ac){
  const sw = APT.standWord || 'stand', Sw = sw[0].toUpperCase() + sw.slice(1), pa = prefArea(ac), ch = standChoices(ac);
  const grp = s => s.term ? (APT.termName ? APT.termName(s.term) : 'Terminal ' + s.term) : (APT.areaNames || AREA_NAMES)[s.area] || s.area;
  const opt = s => `<option value="${s.id}"${ac.stand === s ? ' selected' : ''}>${s.id}${pa.has(s) ? '' : ' · ' + grp(s)}</option>`;
  const mine = ch.filter(s => pa.has(s)), rest = ch.filter(s => !pa.has(s)), locked = ac.taxiIn;
  return `<div class="standline${ac.stand ? '' : ' none'}"><span class="lbl">${Sw}</span><b>${ac.stand ? ac.stand.id : 'not assigned'}</b><span class="pref">prefers ${esc(pa.name)}</span>
    <select id="iStand" aria-label="Assign ${sw}"${locked ? ' disabled title="Taxiing in: re-route it with TAXI and a ' + sw + '"' : ''}><option value="">${ac.stand ? 'Change' : 'Assign'} ${sw}…</option>${mine.length ? `<optgroup label="${esc(pa.name)}">${mine.map(opt).join('')}</optgroup>` : ''}${rest.length ? `<optgroup label="Elsewhere">${rest.map(opt).join('')}</optgroup>` : ''}</select></div>`;
}
// ── clearance pop-outs (push direction, taxi routing) ──
function drawPreview(pv){
  cx.save(); cx.lineJoin = cx.lineCap = 'round';
  cx.strokeStyle = 'rgba(0,0,0,.55)'; cx.lineWidth = 7; poly(pv.pts, false); cx.stroke();
  cx.strokeStyle = C.pv; cx.lineWidth = 3; cx.setLineDash([9, 6]); cx.lineDashOffset = -performance.now()/40; poly(pv.pts, false); cx.stroke(); cx.setLineDash([]);
  const e = pv.pts[pv.pts.length-1]; cx.fillStyle = C.pv; cx.beginPath(); cx.arc(sx(e[0]), sy(e[1]), 5, 0, 7); cx.fill();
  if (pv.label) { cx.font = `600 12px ${FONT_L}`; const t = pv.label, w = cx.measureText(t).width + 12; cx.fillStyle = C.pvBg; cx.fillRect(sx(e[0]) + 9, sy(e[1]) - 22, w, 18); cx.fillStyle = C.pvTxt; cx.fillText(t, sx(e[0]) + 15, sy(e[1]) - 9); }
  cx.restore();
}
// a tug asking for a tow: the aircraft shows on the map (even inside its hangar) with the route it would be towed along,
// so you can see where it is and where it is going before you approve
const towPending = ac => ac.need === 'Request tow' && !!(ac.tow && ac.tow.to && ac.stand);
const towOn = ac => ac.state === 'TOW' && !!(ac.tow && ac.tow.to);   // under tow, or held by the tug at a holding point
const towAsk = ac => towPending(ac) || (towOn(ac) && !!ac.towHold);   // waiting for your word
// under tow, the route still to go and where it ends
function drawTowRoute(ac){
  const T = ac.tow; let pts;
  if (ac.state === 'TOW' && ac.path) pts = ac.towNext ? [...ac.path.pts, ...ac.towNext] : ac.path.pts;   // pushing back: and the tow after it
  else { const k = T.to.id + '|' + (ac.towNode || ac.stand.id); if (T.pvKey !== k) { T.pvKey = k; try { T.pv = towPath(ac, T.to); } catch(e) { T.pv = null; } } pts = T.pv; }
  if (!pts || !pts.length || V.scale < 100) return;
  cx.save(); cx.globalAlpha = S.sel === ac || ac.state === 'TOW' ? 1 : 0.7;
  drawPreview({ pts: [acMid(ac), ...pts], label: 'Tow ' + ac.cs + (ac.path && ac.towTgt ? ' to hold ' + ac.towTgt + ', then ' : ' to ') + towDest(T.to) }); cx.restore();
}
// the selected aircraft's taxi route still to go, and where it ends
function drawTaxiRoute(ac){
  if (V.scale < 100 || !ac.path.pts.length) return;
  const hp = (ac.holdAt || ac.hp || '').replace(/~\d+$/, '');
  const end = ac.state === 'PUSH' ? 'Push back' : ac.state === 'PULL' ? 'Pull forward to ' + (APT.standWord || 'stand') + ' ' + ac.stand.id
    : ac.kind === 'ARR' ? (ac.taxiIn && ac.stand ? 'Taxi to ' + (APT.standWord || 'stand') + ' ' + ac.stand.id : ac.holdAt ? 'Hold ' + hp : 'Vacate ' + (ac.exit || '').replace(/~\d+$/, ''))
    : hp ? 'Taxi to hold ' + hp : 'Taxi';
  drawPreview({ pts: [acMid(ac), ...ac.path.pts], label: ac.cs + ' · ' + end });
}
// an arrival on final or rolling out: the exit you gave it (or the one you are pointing at on its card), from touchdown
let vacHover = null;
// two exits by the same name (Gatwick's Golf 1s): each says how far down the runway it is
const vacLabel = (ac, h) => { const c = exitCheck(ac, h), n = h.replace(/~\d+$/, ''), twin = Object.keys(HOLDS).some(k => k !== h && k.replace(/~\d+$/, '') === n && (HOLDS[k].on || 0) === (HOLDS[h].on || 0));
  return (c && c.back ? 'Backtrack to ' : 'Vacate ') + n + (twin && c && !c.back ? ` · ${(Math.max(0, c.ahead)/1000).toFixed(1)} km` : ''); };
function drawVacRoute(ac){
  if (V.scale < 100 || ac.kind !== 'ARR' || ac.vacated || (ac.ground && ac.path)) return;
  const ex = (vacHover && vacHover.ac === ac && vacHover.ex) || ac.reqExit, pts = ex && vacPreview(ac, ex); if (!pts) return;
  drawPreview({ pts, label: ac.cs + ' · Vacate ' + ex.replace(/~\d+$/, '') + (exitCheck(ac, ex).back ? ' (backtrack)' : '') });
}
const pop = document.createElement('div'); pop.className = 'pop'; pop.hidden = true; pop.setAttribute('role', 'dialog'); document.body.appendChild(pop);
let popAc = null;
function closePop(){ pop.hidden = true; popAc = null; S.preview = null; }
function placePop(anchor){
  const r = anchor.getBoundingClientRect(), w = pop.offsetWidth, h = pop.offsetHeight, vw = innerWidth, vh = innerHeight;
  if (vw < 700) { pop.classList.add('sheet'); pop.style.left = pop.style.top = ''; return; }
  pop.classList.remove('sheet');
  let x = r.left - w - 12; if (x < 8) x = Math.min(vw - w - 8, r.left);
  pop.style.left = x + 'px'; pop.style.top = clamp(r.top - 40, 64, vh - h - 12) + 'px';
}
function showPop(ac, anchor, html, bind){
  popAc = ac; pop.innerHTML = html + `<button class="pop-x" aria-label="Close">×</button>`; pop.hidden = false;
  pop.querySelector('.pop-x').onclick = closePop;
  bind(); placePop(anchor);
  const first = pop.querySelector('.opt'); if (first) first.focus({ preventScroll: true });
}
const COMPASS = d => `<svg viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="none" stroke="currentColor" stroke-opacity=".3"/><path d="M20 4v4M20 32v4M4 20h4M32 20h4" stroke="currentColor" stroke-opacity=".4"/><g transform="rotate(${d} 20 20)"><path d="M20 9l6 14h-12z" fill="currentColor"/><rect x="18.5" y="22" width="3" height="9" rx="1" fill="currentColor" opacity=".5"/></g></svg>`;
function openPushPop(ac, anchor){
  const st = ac.stand, rec = pushFace(ac), lh = mOf(st.lp);
  const opts = ['east', 'west'].map(f => {
    const pts = pushPath(ac, f), hp = APT.faceHold(st, f);
    return { f, pts: [st.p, ...pts], hp, rec: f === rec };
  });
  showPop(ac, anchor, `<div class="lbl">Start-up and push back</div><h4>${ac.cs} <span>stand ${st.id} · ${ac.t}</span></h4>
    <p class="hint">Choose which way the nose faces after the push. Face the way it will taxi: runway ${depRw(ac)} departures leave from ${PHON[depHold(ac)]}.</p>
    <div class="opts two">${opts.map((o, j) => `<button class="opt${o.rec ? ' rec' : ''}" data-j="${j}">${COMPASS(APT.faceHdg ? APT.faceHdg(st, o.f) : o.f === 'east' ? CRS_LO : CRS_HI)}<b>Face ${faceSay(ac, o.f)}</b><span>Tail ${APT.faceHdg ? compassWord(APT.faceHdg(st, o.f) + 180) : APT.faceWord(o.f === 'east' ? 'west' : 'east')} · towards ${PHON[o.hp]}</span>${o.rec ? '<i>Recommended</i>' : ''}</button>`).join('')}</div>
    <div class="phr">“${spoken(ac.cs)}, start-up and push back approved, facing <em>${faceSay(ac, rec)}</em>, ${PH.altim()}”</div>`, () => {
    pop.querySelectorAll('.opt').forEach(bt => {
      const o = opts[+bt.dataset.j];
      const pv = () => { S.preview = { pts: o.pts, label: 'Push · face ' + faceSay(ac, o.f) }; pop.querySelector('.phr em').textContent = faceSay(ac, o.f); };
      bt.onmouseenter = pv; bt.onfocus = pv;
      bt.onclick = () => { command(`${ac.cs} PUSH ${APT.faceHdg ? ({ north: 'N', 'north-east': 'NE', east: 'E', 'south-east': 'SE', south: 'S', 'south-west': 'SW', west: 'W', 'north-west': 'NW' })[faceSay(ac, o.f)] : o.f === 'east' ? 'E' : 'W'}`); closePop(); };
    });
    S.preview = { pts: opts.find(o => o.rec).pts, label: 'Push · face ' + faceSay(ac, rec) };
  });
}
function openTaxiPop(ac, anchor){
  const south = ac.stand && ac.stand.area === 'south' && !ac.leftStand || (ac.leftStand && offOf([ac.x, ac.y]) < 0);
  const hps = APT.taxiHolds(south, ac), rec = depHold(ac);
  hps.sort((a, b) => (b === rec) - (a === rec));
  const groups = hps.map(hp => ({ hp, opts: taxiOptions(ac, hp) })).filter(g => g.opts.length);
  const pre = ac.state === 'PARKED' ? [ac.stand.lp] : [[ac.x, ac.y]];
  const all = []; groups.forEach(g => g.opts.forEach((o, k) => all.push({ hp: g.hp, o, rec: g.hp === rec && k === 0 })));
  // intermediate holding points along the taxiways (London City T1-T9, Innsbruck L1/B1): taxi there and wait
  const ihp = ihpOptions(...taxiStart(ac)); ihp.forEach(a => all.push(a));
  const H = (hp, o) => { const pts = [...pre, ...o.nodes.map(id => GN[id].p)]; if (ac.pushed && !ac.leftStand && pts.length > 2 && Math.abs(angDiff(ac.hdg, brg(ac.x, ac.y, ...pts[2]))) < 90) pts.splice(1, 1); return pts; };
  const len = o => Math.round(o.len / M2NM / 10) * 10;
  showPop(ac, anchor, `<div class="lbl">Taxi clearance · runway ${depRw(ac)}</div><h4>${ac.cs} <span>${ac.stand && !ac.leftStand ? 'stand ' + ac.stand.id : 'on the move'} · ${ac.t}</span></h4>
    <p class="hint">Pick a holding point and the routing. Hover to preview it on the scope. ${APT.taxiHint(depRw(ac))}</p>
    ${groups.map(g => `<div class="grp"><div class="gh"><b>Holding point ${PHON[g.hp]}</b><span>${HOLDS[g.hp].rgl ? 'Guard lights' : ''}${g.hp === rec ? ' · runway ' + depRw(ac) + ' departure point' : HOLDS[g.hp].end && HOLDS[g.hp].end !== depRw(ac) ? ' · runway ' + HOLDS[g.hp].end : ''}</span></div>
      ${g.opts.map(o => { const j = all.findIndex(a => a.o === o); const a = all[j]; return `<button class="opt row${a.rec ? ' rec' : ''}" data-j="${j}"><span class="hp">${g.hp.replace(/~\d+$/, '')}</span><b>via ${(o.via.length ? o.via : [g.hp]).map(t => PHON[t]).join(', ')}</b><span class="ln">${len(o)} m</span>${a.rec ? '<i>Recommended</i>' : ''}</button>`; }).join('')}</div>`).join('')}
    ${ihpGroup(all, ihp)}
    <div class="phr">“${spoken(ac.cs)}, ${APT.phr && APT.phr.taxiPop ? APT.phr.taxiPop() : `taxi to holding point <em></em>, runway ${depRw(ac)}, ${PH.altim()}`}”</div>`, () => {
    const say = a => pop.querySelector('.phr em').textContent = a.ihp ? hpWords(a.hp) + (a.o.via.length ? ' via ' + a.o.via.map(t => PHON[t] || t).join(', ') : '') : APT.phr && APT.phr.taxiPop ? [...a.o.via, HOLDS[a.hp].ref].map(t => PHON[t] || t).join(', ')
      : PHON[a.hp] + (a.o.via.length ? ' via ' + a.o.via.map(t => PHON[t]).join(', ') : '');
    pop.querySelectorAll('.opt').forEach(bt => {
      const a = all[+bt.dataset.j];
      const pv = () => { S.preview = { pts: H(a.hp, a.o), label: 'Hold ' + a.hp + (a.o.via.length ? ' via ' + a.o.via.join(' ') : '') }; say(a); };
      bt.onmouseenter = pv; bt.onfocus = pv;
      bt.onclick = () => { command(`${ac.cs} TAXI ${a.hp}${!a.ihp && a.o.via.length ? ' VIA ' + a.o.via.join(' ') : ''}`); closePop(); };
    });
    const r0 = all.find(a => a.rec) || all[0]; if (r0) { S.preview = { pts: H(r0.hp, r0.o), label: 'Hold ' + r0.hp }; say(r0); }
  });
  if (V.name !== 'gnd' && V.scale < 70) setView('gnd');
}
// shortest route from a node to each intermediate holding point (and, for arrivals, the runway holding points too)
function ihpOptions(from, face, rwyHolds){
  const ids = [...Object.keys(IHPS), ...(rwyHolds ? Object.keys(HOLDS).filter(id => !/~\d+$/.test(id) || !HOLDS[id.replace(/~\d+$/, '')]) : [])];
  const hs = ids.map(id => [id, holdPt(id)]), R = routesFrom(from, hs.filter(([, h]) => h).map(([, h]) => h.node), face);
  const all = hs.map(([id, h]) => { const r = h && h.node !== from && R.get(h.node); return r && { hp: id, ihp: true, rwy: h.rwy, o: { nodes: r.nodes, via: viaOf(r.tws, id).filter(t => t !== 'APRON'), len: pathLen(r.nodes) } }; })
    .filter(Boolean).sort((a, b) => a.o.len - b.o.len);
  return [...all.filter(a => !a.rwy), ...all.filter(a => a.rwy).slice(0, 8)];
}
function ihpGroup(all, opts){
  const row = a => `<button class="opt row" data-j="${all.indexOf(a)}"><span class="hp">${a.hp.replace(/~\d+$/, '')}</span><b>${hpWords(a.hp)}</b><span class="ln">${a.o.via.length ? 'via ' + a.o.via.join(' ') + ' · ' : ''}${Math.round(a.o.len / M2NM / 10) * 10} m</span></button>`;
  const grp = (list, h, sub) => list.length ? `<div class="grp"><div class="gh"><b>${h}</b><span>${sub}</span></div>${list.map(row).join('')}</div>` : '';
  return grp(opts.filter(a => !a.rwy), 'Intermediate holding points', 'stop there and wait for the next instruction') + grp(opts.filter(a => a.rwy), 'Runway holding points', 'hold short of the runway');
}
// an arrival clear of the runway: taxi to a holding point instead of straight to the stand
function openHoldInPop(ac, anchor){
  const [from, face] = ac.path ? [ac.vacNode || taxiFrom(ac), null] : taxiStart(ac), all = ihpOptions(from, face, true);
  if (!all.length) { sys(`There are no holding points to taxi ${ac.cs} to.`); return; }
  const H = o => [[ac.x, ac.y], ...o.nodes.map(id => GN[id].p)];
  showPop(ac, anchor, `<div class="lbl">Taxi to a holding point</div><h4>${ac.cs} <span>${ac.taxiIn ? 'taxiing in' : 'clear of the runway'} · ${ac.t}</span></h4>
    <p class="hint">It taxis to the holding point by the shortest route and waits there. Give it its stand afterwards. Hover to preview the route.</p>
    ${ihpGroup(all, all)}
    <div class="phr">“${spoken(ac.cs)}, taxi to holding point <em></em>”</div>`, () => {
    const say = a => pop.querySelector('.phr em').textContent = hpWords(a.hp) + (a.o.via.length ? ' via ' + a.o.via.map(t => PHON[t] || t).join(', ') : '');
    pop.querySelectorAll('.opt').forEach(bt => {
      const a = all[+bt.dataset.j];
      const pv = () => { S.preview = { pts: H(a.o), label: 'Hold ' + a.hp.replace(/~\d+$/, '') }; say(a); };
      bt.onmouseenter = pv; bt.onfocus = pv;
      bt.onclick = () => { command(`${ac.cs} TAXI ${a.hp}`); closePop(); };
    });
    S.preview = { pts: H(all[0].o), label: 'Hold ' + all[0].hp.replace(/~\d+$/, '') }; say(all[0]);
  });
  if (V.name !== 'gnd' && V.scale < 70) setView('gnd');
}
// a tug's tow: the routings to its destination, or a holding point to stop at and wait (TOW [hp] [VIA ..])
function openTowPop(ac, anchor){
  const to = ac.tow.to, routes = towOptions(ac).map((o, k) => ({ o, k, rec: !k })), hps = ihpOptions(ac.towNode || ac.stand.node, null, true);
  const all = [...routes, ...hps], len = o => Math.round(o.len / M2NM / 10) * 10;
  const P = a => a.ihp ? towPath(ac, to, { hold: holdPt(a.hp) }) : towPath(ac, to, a.k ? { via: a.o.via } : {});
  const lab = a => a.ihp ? 'Tow to hold ' + a.hp.replace(/~\d+$/, '') : 'Tow to ' + towDest(to) + (a.o.via.length ? ' via ' + a.o.via.join(' ') : '');
  const row = (a, j) => `<button class="opt row${a.rec ? ' rec' : ''}" data-j="${j}"><span class="hp">${to.id}</span><b>${a.o.via.length ? 'via ' + a.o.via.map(t => PHON[t] || t).join(', ') : 'direct across the apron'}</b><span class="ln">${len(a.o)} m</span>${a.rec ? '<i>Shortest</i>' : ''}</button>`;
  showPop(ac, anchor, `<div class="lbl">Tow · ${towDest(to)}</div><h4>${ac.cs} <span>${ac.towHold ? 'tug holding at ' + ac.towHold : ac.stand.area === 'hangar' ? 'in ' + ac.stand.name : (APT.standWord || 'stand') + ' ' + ac.stand.id} · ${ac.t}</span></h4>
    <p class="hint">Send the tug to ${towDest(to)} by one of these routes, or to a holding point to stop and wait for you. Hover to preview it on the map.</p>
    ${routes.length ? `<div class="grp"><div class="gh"><b>To ${towDest(to)}</b><span>the tug's routing</span></div>${routes.map(a => row(a, all.indexOf(a))).join('')}</div>` : ''}
    ${ihpGroup(all, hps)}
    <div class="phr">“Tug with ${spoken(ac.cs)}, <em></em>”</div>`, () => {
    const say = a => pop.querySelector('.phr em').textContent = a.ihp ? `tow to holding point ${hpWords(a.hp)}, hold there` : `${ac.towHold ? 'continue tow' : 'tow approved'} to ${towDest(to)}${a.o.via.length ? ', via ' + a.o.via.map(t => PHON[t] || t).join(', ') : ''}`;
    const pv = a => { const p = P(a); S.preview = p ? { pts: [acMid(ac), ...p], label: lab(a) } : null; say(a); };
    pop.querySelectorAll('.opt').forEach(bt => {
      const a = all[+bt.dataset.j];
      bt.onmouseenter = () => pv(a); bt.onfocus = () => pv(a);
      bt.onclick = () => { command(`${ac.cs} TOW${a.ihp ? ' ' + a.hp : a.o.via.length && a.k ? ' VIA ' + a.o.via.join(' ') : ''}`); closePop(); };
    });
    if (all.length) pv(all[0]);
  });
  if (V.name !== 'gnd' && V.scale < 70) setView('gnd');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) closePop(); });
document.addEventListener('pointerdown', e => { if (!pop.hidden && !pop.contains(e.target) && !(e.target.closest && e.target.closest('#sel'))) closePop(); });

let stripSig = '';
// one flight progress strip; doc is the document it goes in (the console, or the pop-out strip board)
function makeStrip(ac, doc = document){
  const d = doc.createElement('button'); d.type = 'button'; d.className = `strip ${ac.kind}${outOfCtl(ac) ? ' off' : ''}${S.sel === ac ? ' sel' : ''}${ac.need ? ' need' : ''}${ac.emerg && !ac.emerg.done ? ' emg' : ''}${clrOf(ac) ? ' clr' : ''}${ac.state === 'DIVERTING' && !outOfCtl(ac) ? ' div' : ''}`;
  d.innerHTML = `<span class="bar"></span><span class="c-a"><span class="cs"></span><span class="ty"></span></span><span class="c-b"><span class="rte"></span><span class="lv"></span></span><span class="c-c"><span class="stt"></span><span class="fq"></span></span>`;
  d.querySelector('.cs').textContent = ac.cs;
  d.querySelector('.ty').textContent = `${ac.t}/${ac.perf.wake} · ${ac.sqk}${ac.kind === 'DEP' && !ac.airborne && SLOT[ac.cs] && SLOT[ac.cs].ctot != null ? ' · CTOT ' + hhmm(SLOT[ac.cs].ctot).replace(':', '') : ''}`;
  d.querySelector('.rte').textContent = ac.kind === 'ARR' ? `${ac.o} › ${APT.icao}` : `${APT.icao} › ${ac.d}`;
  d.querySelector('.lv').textContent = ac.airborne ? (ac.alt > FL_ABOVE ? 'FL'+String(Math.round(ac.alt/100)).padStart(3,'0') : Math.round(ac.alt/100)*100+' ft') + (ac.tgtAlt ? ' › '+(ac.tgtAlt > FL_ABOVE ? 'FL'+Math.round(ac.tgtAlt/100) : ac.tgtAlt) : '') : (ac.stand && ac.state === 'PARKED' ? (ac.stand.area === 'hangar' ? 'Hangar ' : 'Stand ')+ac.stand.id : towOn(ac) ? 'Tow › '+(ac.path && ac.towTgt ? ac.towTgt : ac.tow.to.id) : ac.hp ? 'Hold '+ac.hp.replace(/~\d+$/, '') : 'Ground');
  // arrivals show the stand they are going to, once it is planned
  if (ac.kind === 'ARR' && ac.stand && !outOfCtl(ac)) { const r = d.querySelector('.rte'); r.title = `${r.textContent}, to stand ${ac.stand.id}`; r.textContent = `Stand ${ac.stand.id}`; }
  else if (ac.kind === 'ARR' && !outOfCtl(ac) && (ac.ground || ac.app) && ac.state !== 'DIVERTING') { const r = d.querySelector('.rte'); r.title = `${r.textContent}, no stand assigned (prefers ${prefArea(ac).name})`; r.textContent = 'Stand ?'; r.classList.add('nostand'); }
  const st = d.querySelector('.stt'); st.textContent = ac.need ? '◆ '+ac.need : stateLabel(ac);
  d.querySelector('.fq').textContent = ac.ground ? 'TWR' : ac.freq === 'TWR' ? 'TWR' : 'RAD';
  if (ac.kind === 'DEP' && ac.ground && ac.rel) { const r = doc.createElement('span'); r.className = 'rel ' + relCls(ac); r.textContent = { ok: 'REL', req: 'REL…', exp: 'REL ✕' }[relCls(ac)]; d.querySelector('.fq').append(' ', r); }
  if (clrOf(ac)) { const k = doc.createElement('span'); k.className = 'clrk'; k.textContent = '✓ ' + clrOf(ac); k.title = clrOf(ac) === 'CTL' ? 'Cleared to land' : 'Cleared for take-off'; d.querySelector('.fq').append(' ', k); }
  if (outOfCtl(ac)) { st.textContent = 'Transferred'; d.disabled = true; d.title = `Handed to ${NEXT_UNIT[ac.gate][0]}: no longer under your control`; }
  else d.onclick = () => { tapSelect(ac); if (towAsk(ac) && !phoneMQ.matches) centreOn(ac); };   // a tow request: show me where it is
  // the selected flight's strip gets a recentre button: the map jumps to it (close in on the ground, the radar picture in the air)
  if (S.sel === ac && !outOfCtl(ac)) {
    const c = doc.createElement('span'); c.className = 'ctr'; c.setAttribute('role', 'button'); c.tabIndex = 0; c.title = 'Centre the map on ' + ac.cs; c.setAttribute('aria-label', c.title);
    c.innerHTML = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="4.5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="8" cy="8" r="1.6" fill="currentColor"/><path d="M8 0.5v3M8 12.5v3M0.5 8h3M12.5 8h3" stroke="currentColor" stroke-width="1.6"/></svg>';
    c.onclick = e => { e.stopPropagation(); centreOn(ac); };
    c.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); centreOn(ac); } };
    d.querySelector('.c-a').prepend(c);
  }
  return d;
}
function centreOn(ac){
  const m = Math.min(W, H) || 600, [x, y] = acMid(ac);
  if (ac.ground) { V.scale = Math.max(V.scale, m/(700*M2NM)); V.name = 'gnd'; }   // about 700 m across the scope
  else { V.scale = m/APT.view.app[2]; V.name = 'app'; }
  V.cx = x; V.cy = y;
  document.querySelectorAll('[data-view]').forEach(bt => bt.classList.toggle('on', bt.dataset.view === V.name));
  if (phoneMQ.matches) setMTab('map');
}
function renderStrips(force){
  const list = S.acs.filter(a => !dormant(a) || S.sel === a).sort((a,b) => (!!b.need - !!a.need) || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0));
  const sig = list.map(a => a.cs + a.state + (a.need||'') + (S.sel === a) + outOfCtl(a) + Math.round(a.alt/100) + a.freq + (a.rel ? relCls(a) : '') + (clrOf(a) || '') + (a.stand ? a.stand.id : '')).join(',');
  if (stripWin && stripWin.closed) closeStripBoard();
  if (sig === stripSig && !force) return; stripSig = sig;
  const el = $('strips'); el.innerHTML = '';
  for (const ac of list) el.appendChild(makeStrip(ac));
  if (!list.length) el.innerHTML = '<p class="empty">No traffic yet.</p>';
  const parked = S.acs.filter(dormant).length;
  { const n = S.acs.filter(a => a.need).length, m = $('mtNeed'); if (m) { m.hidden = !n; m.textContent = n; } }
  $('stripCount').textContent = `${S.acs.length - parked} active · ${parked} parked · ${S.sched.filter(f => !f.spawned).length} to come`;
  renderStripBoard(list);
}

// ── pop-out windows: the strip board and the flights board in their own browser windows (a second screen) ──
// The window is drawn from here, so clicks in it act on the simulator directly.
function popWin(name, title, w, h){
  const win = window.open('', name, `popup,width=${w},height=${h}`);
  if (!win) { sys('Your browser blocked the new window. Allow pop-ups for this site and try again.', true); return null; }
  const doc = win.document;
  doc.open(); doc.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head><body class="popwin"></body></html>`); doc.close();
  for (const n of document.querySelectorAll('style, link[rel="stylesheet"]')) doc.head.appendChild(doc.importNode(n, true));
  doc.body.className = 'popwin ' + document.body.className;
  addEventListener('pagehide', () => { try { win.close(); } catch(_) {} });
  return win;
}
// where a strip sits on the board, left to right as a flight moves through the unit (UK-style bays)
const BAYS = [
  ['pend', 'Pending', 'Inbounds not yet with you'],
  ['air', 'Approach and radar', 'Airborne: arrivals, holds, departures climbing out'],
  ['rwy', 'Runway', 'Final, lined up, rolling and landing'],
  ['hold', 'Holding points', 'Waiting to enter the runway'],
  ['gnd', 'Ground movement', 'Pushing, taxiing out and in'],
  ['del', 'Stands and delivery', 'On stand: clearances, start-up and tows'],
  ['done', 'Transferred', 'Handed to the next unit'],
];
function bayOf(ac){
  if (outOfCtl(ac)) return 'done';
  const st = ac.state;
  if (st === 'PRE') return 'pend';
  if (['PARKED', 'TOW', 'ONSTAND'].includes(st)) return 'del';
  if (st === 'HOLDPT' || (st === 'TAXI' && ac.holdAt && !ac.path && ac.kind === 'DEP')) return 'hold';
  if (['FINAL', 'LINEUP', 'LINEDUP', 'TAKEOFF', 'ROLLOUT', 'ROLLED'].includes(st) || (st === 'VACATING' && !ac.taxiIn && !ac.vacated)) return 'rwy';
  if (['PUSH', 'PULL', 'READY', 'TAXI', 'VACATING'].includes(st)) return 'gnd';
  return 'air';
}
let stripWin = null;
function openStripBoard(){
  if (stripWin && !stripWin.closed) { stripWin.focus(); return; }
  stripWin = popWin('cwStrips', `${APT.icao} strip board`, 1840, 760); if (!stripWin) return;
  const d = stripWin.document;
  d.body.innerHTML = `<div class="app sboard"><div class="sb-hd"><b>${esc(APT.name)} · flight progress strips</b><span class="lbl" id="sbCount"></span><span class="grow"></span><span class="lbl">Click a strip to select the flight in the simulator</span></div>
    <div class="sb-bays">${BAYS.map(([k, n, t]) => `<section class="sb-bay" data-bay="${k}"><div class="sb-bh"><span class="lbl">${n}</span><span class="sb-n"></span></div><p class="sb-t">${t}</p><div class="sb-list"></div></section>`).join('')}</div></div>`;
  document.querySelector('.app').classList.add('strips-out');
  stripWin.addEventListener('pagehide', () => setTimeout(() => { if (stripWin && stripWin.closed) closeStripBoard(); }, 50));
  renderStrips(true);
}
function closeStripBoard(){ stripWin = null; const a = document.querySelector('.app'); if (a) a.classList.remove('strips-out'); }
function renderStripBoard(list){
  if (!stripWin || stripWin.closed) return;
  const d = stripWin.document; d.body.className = 'popwin ' + document.body.className;
  const by = {}; for (const ac of list) (by[bayOf(ac)] ||= []).push(ac);
  for (const [k] of BAYS) {
    const sec = d.querySelector(`[data-bay="${k}"]`); if (!sec) continue;
    const box = sec.querySelector('.sb-list'), L = by[k] || []; box.innerHTML = '';
    for (const ac of L) box.appendChild(makeStrip(ac, d));
    sec.querySelector('.sb-n').textContent = L.length || '';
  }
  const c = d.getElementById('sbCount'); if (c) c.textContent = $('stripCount').textContent;
}
$('popStrips').onclick = openStripBoard;
$('backStrips').onclick = () => { if (stripWin && !stripWin.closed) stripWin.close(); closeStripBoard(); };
function renderScore(){
  const s = S.score;
  $('score').innerHTML = `<span><b>${s.pts}</b> pts</span><span>Landed <b>${s.landed}</b></span><span>Departed <b>${s.departed}</b></span><span>GA <b>${s.ga}</b></span><span>Div <b>${s.div}</b></span><span class="${s.los?'bad':''}">LoS <b>${s.los}</b></span>${APT.restricted ? `<span class="${s.infr?'bad':''}">${APT.restricted.short || 'Infr'} <b>${s.infr}</b></span>` : ''}<span class="${s.incidents?'bad':''}">Incidents <b>${s.incidents}</b></span>`;
  const d = new Date(S.start + S.t*1000);
  $('clock').textContent = d.toISOString().substr(11,8)+'Z';
  $('clockz').textContent = 'local ' + new Date(d.getTime() + APT.utcOff*3600e3).toISOString().substr(11,5) + ' · ' + (S.paused ? 'paused' : S.speed+'×');
  if (S.xing.st === 'CLOSING' || S.xing.st === 'OPENING') { const el = $('xCount'); if (el) el.textContent = Math.max(0, Math.ceil(S.xing.t - S.t)); const bar = document.querySelector('.xing .bar i'); if (bar) bar.style.width = Math.round((S.xing.st === 'CLOSING' ? clamp(1 - (S.xing.t - S.t)/150, 0, 1) : clamp((S.xing.t - S.t)/15, 0, 1))*100)+'%'; }
}

const RWY_MID = rm(RWY_M/2, 0);
function viewFor(k){
  const m = Math.min(W, H) || 600;
  if (k === 'app') { V.cx = RADAR_REF[0] + APT.view.app[0]; V.cy = RADAR_REF[1] + APT.view.app[1]; V.scale = m/APT.view.app[2]; }
  else if (k === 'twr') { V.cx = RWY_MID[0] + APT.view.twr[0]; V.cy = RWY_MID[1] + APT.view.twr[1]; V.scale = m/APT.view.twr[2]; }
  else { const g = APT.view.gnd, c = rm(g[0], g[1]); V.cx = c[0]; V.cy = c[1]; V.scale = Math.min(W/(g[2]*M2NM), H/(g[3]*M2NM)); }
  V.name = k;
}
// Render a view into another canvas (overview thumbnails, training figures) without disturbing the live scope.
function drawTo(canvas, k, opts = {}){
  const th = C.name; setTheme('light'); // website thumbnails always use the light chart
  const sv = { cv, cx, W, H, DPR, vx: V.cx, vy: V.cy, vs: V.scale, vn: V.name, acs: S.acs, proc: S.showProc };
  cv = canvas; cx = canvas.getContext('2d'); resize();
  let out = null;
  if (W && H) {
    viewFor(k); if (opts.tweak) opts.tweak(V);
    if (opts.acs) S.acs = opts.acs; if (opts.proc !== undefined) S.showProc = opts.proc;
    draw(); if (opts.post) opts.post(); out = { cx: V.cx, cy: V.cy, scale: V.scale, W, H, pins: opts.pins ? opts.pins.map(p => [sx(p[0]), sy(p[1])]) : null };
  }
  cv = sv.cv; cx = sv.cx; W = sv.W; H = sv.H; DPR = sv.DPR; V.cx = sv.vx; V.cy = sv.vy; V.scale = sv.vs; V.name = sv.vn; S.acs = sv.acs; S.showProc = sv.proc;
  setTheme(th);
  return out;
}
function setView(k){
  viewFor(k);
  document.querySelectorAll('[data-view]').forEach(bt => bt.classList.toggle('on', bt.dataset.view === k));
}
document.querySelectorAll('[data-view]').forEach(bt => bt.onclick = () => setView(bt.dataset.view));
// display theme: light chart or night radar, remembered per browser
function applyTheme(t){
  setTheme(t); document.body.classList.toggle('theme-dark', t === 'dark');
  document.querySelectorAll('[data-theme-set]').forEach(bt => bt.classList.toggle('on', bt.dataset.themeSet === t));
  try { localStorage.setItem('cw-theme', t); } catch(_) {}
}
document.querySelectorAll('[data-theme-set]').forEach(bt => bt.onclick = () => applyTheme(bt.dataset.themeSet));
try { applyTheme(localStorage.getItem('cw-theme') === 'dark' ? 'dark' : 'light'); } catch(_) { applyTheme('light'); }
$('tgProc').onclick = e => { S.showProc = !S.showProc; e.currentTarget.classList.toggle('on', S.showProc); };
$('tgPause').onclick = e => { if (!S.running) return; S.paused = !S.paused; e.currentTarget.textContent = S.paused ? 'Resume' : 'Pause'; };
$('tgSpeed').onclick = e => {
  if (S.running && /^live/.test(S.mode)) { S.speed = 1; e.currentTarget.textContent = '1×'; sys('Live now runs in real time, so the real flights stay in step with yours.'); return; }
  S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 4 : 1; e.currentTarget.textContent = S.speed+'×';
};
$('tgVoice').onclick = e => { S.voice = !S.voice; e.currentTarget.classList.toggle('on', S.voice); e.currentTarget.setAttribute('aria-pressed', S.voice); loadVoices(); if (!S.voice) try { speechSynthesis.cancel(); } catch(_) {} };
$('tgSetup').onclick = () => openSetup();
function openSetup(){ S.paused = true; $('tgPause').textContent = 'Resume'; $('startBtn').textContent = S.running ? 'Apply weather and resume' : 'Open the position'; $('setup').hidden = false; try { renderSlots(); } catch(_) {} }

let drag = null; const pointers = new Map();
cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pointers.set(e.pointerId, [e.offsetX, e.offsetY]); drag = { x: e.offsetX, y: e.offsetY, cx: V.cx, cy: V.cy, moved: false, d0: null, s0: V.scale }; });
cv.addEventListener('pointermove', e => {
  if (!drag) return; pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
  if (pointers.size === 2) { const [a,b] = [...pointers.values()]; const d = Math.hypot(a[0]-b[0], a[1]-b[1]); if (!drag.d0) drag.d0 = d; V.scale = clamp(drag.s0*d/drag.d0, 0.2, 12000); drag.moved = true; return; }
  const dx = e.offsetX - drag.x, dy = e.offsetY - drag.y; if (Math.hypot(dx,dy) > 4) drag.moved = true;
  if (drag.moved) { V.cx = drag.cx - dx/V.scale; V.cy = IMY(MY(drag.cy) + dy/V.scale); }
});
cv.addEventListener('pointerup', e => {
  pointers.delete(e.pointerId);
  if (drag && !drag.moved) { let best = null, bd = 26; for (const ac of S.acs) { if (outOfCtl(ac) || (inHangar(ac) && !towPending(ac))) continue; const M = acMid(ac), d = Math.hypot(sx(M[0])-e.offsetX, sy(M[1])-e.offsetY); if (d < bd) { bd = d; best = ac; } } if (best) tapSelect(best); }
  if (!pointers.size) drag = null;
});
cv.addEventListener('wheel', e => { e.preventDefault(); const f = Math.exp(-e.deltaY*0.0015), wxp = wx2(e.offsetX), wyp = wy2(e.offsetY); V.scale = clamp(V.scale*f, 0.2, 12000); V.cx = wxp - (e.offsetX - W/2)/V.scale; V.cy = IMY(MY(wyp) + (e.offsetY - H/2)/V.scale); }, { passive: false });

$('cmdForm').onsubmit = e => { e.preventDefault(); const v = $('cmd').value; if (v.trim()) command(v); $('cmd').value = ''; };
$('cmd').addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); const L = S.acs.filter(a => !outOfCtl(a)); if (!L.length) return; select(L[(L.indexOf(S.sel)+1) % L.length]); } });
document.addEventListener('keydown', e => { if (document.body.dataset.route !== 'sim') return; if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; if (e.key === ' ') { e.preventDefault(); $('tgPause').click(); } if (e.key === '/') { e.preventDefault(); $('cmd').focus(); } });

const wxSel = $('wxPreset'); { const o = document.createElement('option'); o.value = 'live'; o.textContent = `Live weather · current ${APT.icao} METAR`; wxSel.appendChild(o); }
for (const [k,v] of Object.entries(WX_PRESETS)) { const o = document.createElement('option'); o.value = k; o.textContent = v.name; wxSel.appendChild(o); }
wxSel.value = APT.defWx;
// day and hour pickers: each slot carries its own timetable flights
const daySel = $('daySel'), hourSel = $('hourSel');
DAYS.forEach((n, i) => { const o = document.createElement('option'); o.value = i; o.textContent = n; daySel.appendChild(o); });
daySel.value = (new Date().getUTCDay() + 6) % 7;
const lt = h => String(((h + APT.utcOff) % 24 + 24) % 24).padStart(2,'0');   // New York is behind UTC
function renderSlots(){
  const d = +daySel.value, keep = hourSel.value, ex = !!EXERCISES[$('trafficSel').value];
  if (/^live/.test($('trafficSel').value)) { daySel.disabled = hourSel.disabled = true; if (typeof renderLiveSlots === 'function') renderLiveSlots(); return; }
  hourSel.innerHTML = '';
  for (const h of SESSION_HOURS) {
    const n = timetableFlights(d, h).length, o = document.createElement('option');
    o.value = h; o.textContent = `${String(h % 24).padStart(2,'0')}00Z · ${lt(h)}:00 local · ${n ? n + ' scheduled' : 'quiet'}`; hourSel.appendChild(o);
  }
  hourSel.value = keep || 18;
  daySel.disabled = hourSel.disabled = ex || S.running;
  if ($('trafficSel').value === 'custom' && typeof renderCustomSlots === 'function') return renderCustomSlots();
  const fl = timetableFlights(d, +hourSel.value);
  $('slotList').innerHTML = ex ? '<span class="dimmer">Guided exercises use their own traffic.</span>'
    : fl.length ? fl.map(f => `<span class="slot ${f.k}"><b>${f.cs}</b> ${f.k === 'ARR' ? f.o + ' › ' + APT.icao : APT.icao + ' › ' + f.d} <i>${f.at}Z</i></span>`).join('')
    : '<span class="dimmer">No scheduled flights in this slot. Pick “Timetable plus charters” for traffic, or another hour.</span>';
}
daySel.onchange = hourSel.onchange = renderSlots; $('trafficSel').addEventListener('change', renderSlots);
renderSlots();
function resetSession(){
  S.t = 0; S.acs = []; S.sel = null; S.sched = []; S.atisAlert = false; S.running = false; S.paused = true; S.conflicts = new Set(); S.conflictSet = new Set();
  S.emg = null; S.rtow = null; S.recalls = []; S.xing = { st: APT.xing ? 'OPEN' : 'CLOSED', t: 0, queue: 0, totalClosed: 0 }; S.score = { landed: 0, departed: 0, ga: 0, div: 0, los: 0, infr: 0, incidents: 0, pts: 0 };
  STANDS.forEach(s => s.occ = null); HANGARS.forEach(h => h.occ = null); logEl.innerHTML = ''; stripSig = '';
}
function start(){
  if (!S.running && !cwGate()) return;   // opening a position needs a plan that includes this airport (account.js)
  const pasted = $('wxPaste').value.trim();
  const mode = $('trafficSel').value;
  const ex = EXERCISES[mode];
  if (ex && !S.running) { wxSel.value = ex.wx; if (liveBox.checked) { liveBox.checked = false; liveBox.onchange(); } }   // exercises use their own weather
  S.wx = parseMetar(pasted && /\d{3,5}(G\d+)?KT|VRB|Q\d{4}/.test(pasted.toUpperCase()) ? pasted : (WX_PRESETS[wxSel.value] || WX_PRESETS[APT.defWx]).metar);
  const cHi = windComp(S.wx, CRS_HI), cLo = windComp(S.wx, CRS_LO);
  const RF = APT.rwyFor && APT.rwyFor(S.wx), newRwy = RF ? RF.land : cLo.head > cHi.head + 2 ? RW_LO : RW_HI;
  if (!S.running) {
    resetSession();
    S.running = true; S.rwy = newRwy; S.depRwy = RF ? (ex && ex.depRwy) || RF.dep : null; S.mode = mode; S.atis = ATIS_LETTERS[8 + Math.floor(Math.random()*6)];
    const live = /^live/.test(mode), now = new Date(Math.floor(Date.now()/60e3)*60e3);
    const day = live ? (now.getUTCDay() + 6) % 7 : +daySel.value, hour = live ? now.getUTCHours() + now.getUTCMinutes()/60 : +hourSel.value; S.day = day; S.hour = hour;
    if (live) { S.start = +now; S.speed = 1; $('tgSpeed').textContent = '1×'; } else if (!ex) S.start = Date.UTC(2026, 9, 5 + day, hour, 0, 0); else S.start = Date.UTC(2026, 9, 4, 18, 55, 0);
    if (!live) S.wx = parseMetar(S.wx.raw.replace(new RegExp(`^(${APT.icao} )\\d{6}Z`), (m, p) => { const z = new Date(S.start - 600e3); return p + String(z.getUTCDate()).padStart(2,'0') + String(z.getUTCHours()).padStart(2,'0') + '50Z'; }));
    S.sched = buildSchedule(mode, day, hour);
    S.liveWait = live && typeof liveJoin === 'function' ? 20 : 0;   // Real world: arrivals wait (up to 20 s) for the live traffic, which may already be flying them
    sys(`Position open: ${APT.radar[0]} ${APT.radar[1]} and ${APT.tower[0].split(' ').pop()} ${APT.tower[1]} combined. ${S.wx.raw}. ${APT.rwyConfigs ? (c => `${c.name} flow: runways ${c.lands.join(' and ')} for landing, ${c.deps.join(' and ')} for departure`)(APT.rwyConfigs.find(c => c.key === APT.configOf(S.rwy))) : `Runway ${S.rwy}${S.depRwy && S.depRwy !== S.rwy ? ` for landing, ${S.depRwy} for departure` : ''}`}, information ${phonetic(S.atis)}.`);
    if (live && LIVE.session) sys(`Real world, ${DAYS[day]} ${zHM(S.start)}Z: ${S.sched.length} real flight${S.sched.length === 1 ? '' : 's'} still to come today, from ${APT.liveName}’s live flight information${LIVE.data.updated ? ` (updated ${LIVE.data.updated.substr(11, 5)}Z)` : ''}.`);
    else if (live) sys('Real world: today’s flight information could not be loaded here, so the session uses the timetable for this hour.', true);
    else if (mode === 'custom') sys(`${DAYS[day]} ${String(hour).padStart(2,'0')}00Z, custom traffic: ${S.sched.filter(f => f.k === 'ARR').length} arrivals and ${S.sched.filter(f => f.k !== 'ARR').length} departures over the next hour, from ${CUSTOM.src}.`);
    else if (!ex) sys(`${DAYS[day]} ${String(hour).padStart(2,'0')}00Z: ${S.sched.length} flight${S.sched.length === 1 ? '' : 's'} expected for the rest of the day.`);
    if (turbExcess(S.wx) > 0) sys(`Wind exceeds the ${APT.turbName || 'Special Procedures'} turbulence limit: expect windshear on final and go-arounds.`);
    if (!APT.minsOk(S.wx, S.rwy)) sys(APT.minsLong.replace(/\.$/, '') + (APT.rnp && APT.rnpMinsOk(S.wx, S.rwy) ? ': arrivals will ask for an RNP approach.' : ': arrivals will not be able to land.'));
    if (APT.windLimit && windLimit({ perf: { wake: 'M' } }, S.rwy)) sys(`Wind is outside the ${APT.name} limits for runway ${S.rwy}: landings and take-offs are not allowed until it eases.`, true);
    emgInit(ex ? 'off' : ($('emgSel') ? $('emgSel').value : 'some'));
    S.rtow = ex ? null : { next: rnd(4, 10)*60 };   // random tows around the apron (sim.js stepRandomTows)
    if (S.emg.rate) sys(`Emergencies are ${S.emg.level === 'often' ? 'frequent' : 'occasional'} this session: expect MAYDAYs, medical diversions, bird strikes and runway closures.`);
    step(0.01); setView(ex && ex.sched[0].k === 'DEP' ? 'gnd' : 'app');
    emit('start', mode);
  } else { nextAtis(); sys(`Weather updated: ${S.wx.raw}. Information ${phonetic(S.atis)}.`); if (newRwy !== S.rwy) sys(`Wind now favours runway ${newRwy}${RF ? ' for landing' : ''}.`); if (RF && RF.dep !== depRw()) sys(`Wind now favours departures from runway ${RF.dep}.`); }
  $('setup').hidden = true; S.paused = false; $('tgPause').textContent = 'Pause';
  renderAtis(); renderSel(); renderStrips(true);
}
// Real world sessions load today's flights (and the live METAR) before the position opens
$('startBtn').onclick = async () => {
  const mode = $('trafficSel').value;
  const liveTraffic = /^live/.test(mode) && !S.running, liveWeather = wxSel.value === 'live' && !S.running;
  if (liveTraffic || liveWeather) {
    const bt = $('startBtn'), txt = bt.textContent; bt.disabled = true; bt.textContent = liveTraffic ? 'Loading today’s flights…' : 'Fetching the live METAR…';
    try {
      if (liveTraffic) { await liveLoad(true); LIVE.session = liveSession(Date.now(), mode); }
      if (!liveBox.checked) { liveBox.checked = true; setLive(true); }
      const m = await fetchMetar();
      if (m) { $('wxPaste').value = m; liveLast = m; }
      else if (liveWeather && !$('wxPaste').value.trim()) sys('Live weather is unavailable on this page, so the session uses fair weather.', true);
    } finally { bt.disabled = false; bt.textContent = txt; }
  }
  start();
};
$('newBtn').onclick = () => { S.running = false; resetSession(); openSetup(); renderAtis(); renderSel(); renderStrips(true); };

let last = performance.now(), uiT = 0;
function frame(now){
  const dtr = Math.min(0.25, (now - last)/1000); last = now;
  if (S.running && !S.paused) { let t = dtr*S.speed; while (t > 0) { const h = Math.min(0.2, t); step(h); t -= h; } }
  uiT += dtr; if (typeof careerTick === 'function') careerTick(dtr);
  if (document.body.dataset.route === 'sim') {
    if (uiT > 0.5) { uiT = 0; renderStrips(); renderScore(); if (S.sel) { const a = document.activeElement; if (!(a && a.closest && a.closest('#sel'))) renderSel(); } emit('tick'); }
    if (cv.clientWidth && (Math.abs(cv.clientWidth - W) > 1 || Math.abs(cv.clientHeight - H) > 1)) resize();
    draw();
  }
  requestAnimationFrame(frame);
}
window.__S = S; window.__cmd = command; window.__step = step; window.__start = start;
