// ═════════════════════════ rendering ═════════════════════════
let cv = document.getElementById('scope'), cx = cv.getContext('2d');
let W = 0, H = 0, DPR = 1;
function resize(){ const r = cv.getBoundingClientRect(); DPR = window.devicePixelRatio || 1; W = r.width; H = r.height; cv.width = Math.max(1, W*DPR); cv.height = Math.max(1, H*DPR); }
window.addEventListener('resize', () => { resize(); });
const V = S.view;
const sx = x => W/2 + (x - V.cx)*V.scale, sy = y => H/2 - (y - V.cy)*V.scale;
const wx2 = px => (px - W/2)/V.scale + V.cx, wy2 = py => -(py - H/2)/V.scale + V.cy;
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
    ring: 'rgba(11,42,74,.13)', ringTxt: 'rgba(11,42,74,.5)', arr: '#b75f00', dep: '#1452d9', sel: '#0c1b2e', conf: '#d62d2d',
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
    ring: 'rgba(125,255,176,.09)', ringTxt: 'rgba(125,255,176,.35)', arr: '#ffc164', dep: '#7cc7ff', sel: '#ffffff', conf: '#ff5a5a',
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
  if (!img) { cx.save(); if (ground && typeof AIRSIDE !== 'undefined') { cx.beginPath(); cx.rect(0, 0, W, H); AIRSIDE.forEach((p, i) => cx[i ? 'lineTo' : 'moveTo'](sx(p[0]), sy(p[1]))); cx.closePath(); cx.clip('evenodd'); }
  for (const l of COAST) { poly(l, false); cx.stroke(); } cx.restore(); }
  cx.globalAlpha = 1;
  if (!ground) drawRadarMap(); else if (!img) drawRockRelief();
  if (S.showProc) drawProcedures();
  drawAirport();
  if (S.preview) drawPreview(S.preview);
  for (const ac of S.acs) if (!ac.ground) drawAc(ac);
  for (const ac of S.acs) if (ac.ground) drawAc(ac);
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
  // R164
  cx.save(); poly(R164); cx.fillStyle = rgba('r164', .05); cx.fill(); cx.clip();
  cx.strokeStyle = rgba('r164', .10); cx.lineWidth = 1; for (let k = -W; k < W+H; k += 9) { cx.beginPath(); cx.moveTo(k, 0); cx.lineTo(k - H, H); cx.stroke(); }
  cx.restore();
  cx.save(); cx.strokeStyle = rgba('r164', .65); cx.setLineDash([6,4]); cx.lineWidth = 1.2; poly(R164); cx.stroke(); cx.restore();
  if (sc < 160) { cx.fillStyle = rgba('r164', .9); cx.font = `600 12px ${FONT_L}`; const p = xy(36.245,-5.40); cx.fillText('R164  SFC–FL300', sx(p[0]), sy(p[1])); }
  const IMGON = mapImagery();
  if (!IMGON) { cx.strokeStyle = C.border; cx.setLineDash([2,3]); for (const l of BORDERS) { poly(l,false); cx.stroke(); } cx.setLineDash([]);
  drawRockRelief(); }
  // towns and airports
  cx.font = `500 12px ${FONT_L}`;
  if (!IMGON) for (const [n,x,y] of TOWNS) { const X = sx(x), Y = sy(y); if (X < -40 || Y < -20 || X > W+40 || Y > H+20) continue; cx.fillStyle = rgba('town', .55); cx.fillRect(X-1.5, Y-1.5, 3, 3); cx.fillStyle = rgba('town', .6); cx.fillText(n.toUpperCase(), X+5, Y+4); }
  for (const [n,x,y] of AIRPORTS) { const X = sx(x), Y = sy(y); cx.strokeStyle = rgba('apt', .55); cx.lineWidth = 1; cx.beginPath(); cx.arc(X, Y, 4, 0, 7); cx.stroke(); cx.beginPath(); cx.moveTo(X-6, Y); cx.lineTo(X+6, Y); cx.stroke(); cx.fillStyle = rgba('apt', .6); cx.font = `10px ${FONT_D}`; cx.fillText(n, X+7, Y-5); }
  // range rings and bearing scale around GBR
  if (sc < 60) {
    const X0 = sx(GBR[0]), Y0 = sy(GBR[1]);
    cx.strokeStyle = C.ring; cx.lineWidth = 1; cx.fillStyle = C.ringTxt; cx.font = `10px ${FONT_D}`;
    for (let r = 5; r <= 50; r += 5) { cx.beginPath(); cx.arc(X0, Y0, r*sc, 0, 7); cx.stroke(); if (r % 10 === 0) cx.fillText(r, X0 + r*sc*0.707 + 2, Y0 - r*sc*0.707); }
    const R = 40*sc;
    for (let b = 0; b < 360; b += 5) { const L = b % 30 === 0 ? 10 : 4, s = Math.sin(b*D2R), c = Math.cos(b*D2R); cx.beginPath(); cx.moveTo(X0 + s*R, Y0 - c*R); cx.lineTo(X0 + s*(R+L), Y0 - c*(R+L)); cx.stroke(); if (b % 30 === 0) { cx.textAlign = 'center'; cx.fillText(String(b).padStart(3,'0'), X0 + s*(R+20), Y0 - c*(R+20) + 4); cx.textAlign = 'left'; } }
  }
}
function drawRockRelief(){
  const sc = V.scale;
  cx.fillStyle = rgba('reliefFill', .22); cx.strokeStyle = rgba('relief', .45); cx.lineWidth = 1; poly(ROCK); cx.fill(); cx.stroke();
  for (let k = 0.75; k > 0.15; k -= 0.2) { const pts = ROCK.map(p => [ROCK_TOP[0]+(p[0]-ROCK_TOP[0])*k, ROCK_TOP[1]+(p[1]-ROCK_TOP[1])*k]); cx.strokeStyle = rgba('relief', 0.18+0.25*(1-k)); poly(pts); cx.stroke(); }
  if (sc > 22 && sc < 900) { cx.fillStyle = rgba('reliefTxt', .95); cx.font = `500 12px ${FONT_L}`; cx.fillText('▲ 1398  ROCK · NO OVERFLIGHT', sx(ROCK_TOP[0])+6, sy(ROCK_TOP[1])+4); }
}

function drawProcedures(){
  const sc = V.scale; if (sc > 400) return;
  cx.lineWidth = 1;
  for (const g of ['E','W','S']) { cx.strokeStyle = rgba('proc', .26); cx.setLineDash([4,5]); poly(ARR_ROUTE[g][S.rwy].map(id => WP[id].p), false); cx.stroke(); }
  cx.setLineDash([]);
  for (const k of ['27','09']) {
    const F = FINAL[k]; cx.strokeStyle = k === S.rwy ? rgba('proc', .75) : rgba('lab', .2); cx.lineWidth = k === S.rwy ? 1.3 : 1;
    poly(F.pts, false); cx.stroke();
    if (k === '27') { const nx = Math.cos(CRS09*D2R), ny = Math.sin(CRS09*D2R); for (let n = 1; n <= 10; n++) { const p = add(T27, CRS09, n), L = n % 5 === 0 ? 7 : 4; cx.beginPath(); cx.moveTo(sx(p[0]) - nx*L, sy(p[1]) - ny*L); cx.lineTo(sx(p[0]) + nx*L, sy(p[1]) + ny*L); cx.stroke(); } }
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
    const X = sx(w.p[0]), Y = sy(w.p[1]); if (X < -50 || Y < -50 || X > W+50 || Y > H+50) continue;
    const pt = w.id === 'PTX' || w.id === 'PTY';
    if (pt && sc < 12) continue;
    cx.strokeStyle = pt ? rgba('proc', .9) : rgba('lab', .65);
    cx.beginPath(); cx.moveTo(X, Y-4.5); cx.lineTo(X+4, Y+3); cx.lineTo(X-4, Y+3); cx.closePath(); cx.stroke();
    if (sc > 5) { cx.fillStyle = pt ? rgba('proc', .9) : rgba('lab', .6); cx.fillText(pt ? (w.id === 'PTX' ? 'X 920' : 'Y 920') : w.id, X+6, Y+3); }
  }
  const X = sx(GBR[0]), Y = sy(GBR[1]); cx.strokeStyle = rgba('apt', .75); cx.beginPath(); for (let k=0;k<6;k++){ const a=k*Math.PI/3; cx[k?'lineTo':'moveTo'](X+5*Math.cos(a), Y+5*Math.sin(a)); } cx.closePath(); cx.stroke();
  if (sc < 120) { cx.fillStyle = rgba('apt', .75); cx.fillText('GBR', X+7, Y-6); }
}

// ── aerodrome ─────────────────────────────────────────────
const AD = {
  rwyPoly: [[0,-58],[0,58],[73,60],[194,22.5],[1688,22.5],[1724,56],[1798,57],[1798,-22.5],[197,-22.5],[73,-59]],
  civil: [[1110,113],[1387,113],[1387,240],[1110,240]],
  north: [[1395,113],[1446,228],[1511,204],[1486,113]],
  south: [[1017,-132],[1232,-132],[1184,-198],[1123,-210],[1114,-262],[1087,-248],[973,-193],[1000,-150]],
  twys: { A: [[TW.A,0],[TW.A,TW.B],[TW.A,LANE_N+8]], B: [[TW.A,TW.B],[TW.E,TW.B]], E: [[TW.E,TW.B],[TW.E,0]], C: [[TW.C,0],[TW.C,LANE_S-6]], D: [[TW.D,0],[TW.D,LANE_S-6]] },
  closedB: [[TW.E,TW.B],[1762,TW.B],[1788,96],[1800,72],[1798,58]],
  roadN: [[1000,22],[1006,120],[1013,250],[1018,330],[1022,430],[1024,520]],
  roadS: [[985,-22],[973,-54],[943,-175],[920,-250],[885,-330],[858,-420],[840,-520]],
  terminal: [[1182,241],[1161,245],[1161,278],[1166,282],[1210,282],[1212,319],[1216,324],[1357,322],[1361,317],[1361,245],[1356,240]],
  atc: [[1032,200],[1020,209],[1028,214],[1028,256],[1033,261],[1047,260],[1051,255],[1051,204],[1046,199]],
  hangars: [[[990,-195],[966,-187],[960,-181],[981,-126],[987,-121],[1011,-129],[1017,-135],[996,-189]],
            [[1125,-266],[1103,-252],[1099,-244],[1124,-210],[1126,-189],[1133,-185],[1163,-205],[1167,-210],[1129,-264]],
            [[1033,-284],[999,-267],[978,-253],[982,-235],[1005,-243],[1046,-258],[1048,-262],[1037,-282]]],
  floods: [1142,1194,1245,1287,1338,1385]
};
function drawAirport(){
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
  if (!IMG) { path(AD.roadN, false); cx.stroke(); path(AD.roadS, false); cx.stroke(); }
  // frontier fence with hatching on the Spanish side
  if (!IMG) { cx.strokeStyle = rgba('r164', .55); cx.lineWidth = 1.2; poly(FRONTIER, false); cx.stroke(); }
  if (sc > 160 && !IMG) { cx.strokeStyle = rgba('r164', .35); for (let i = 0; i < FRONTIER.length-1; i++) { const a = FRONTIER[i], b = FRONTIER[i+1], L = dist(...a, ...b)/M2NM, n = Math.floor(L/25); for (let k = 0; k < n; k++) { const f = k/n, x = a[0]+(b[0]-a[0])*f, y = a[1]+(b[1]-a[1])*f; const X = sx(x), Y = sy(y); cx.beginPath(); cx.moveTo(X, Y); cx.lineTo(X+5, Y-7); cx.stroke(); } } }
  // pavement
  cx.fillStyle = C.concrete; path(AD.civil); cx.fill(); path(AD.north); cx.fill(); path(AD.south); cx.fill();
  drawApronSlabs(path);
  drawRunwayShoulders(path);
  const twyTex = texPattern('twy', 40, RWY_ANGLE()) || C.asphalt;
  cx.strokeStyle = C.gShoulder; cx.lineWidth = lw(25);
  for (const k in AD.twys) { path(AD.twys[k], false); cx.stroke(); }
  cx.strokeStyle = twyTex; cx.lineWidth = lw(19);
  for (const k in AD.twys) { path(AD.twys[k], false); cx.stroke(); }
  cx.strokeStyle = C.closed; path(AD.closedB, false); cx.stroke();
  // fillets where taxiways meet the runway
  cx.fillStyle = twyTex;
  for (const m of [TW.A, TW.E]) { path([[m-30,20],[m+30,20],[m+9.5,45],[m-9.5,45]]); cx.fill(); }
  for (const m of [TW.C, TW.D]) { path([[m-30,-20],[m+30,-20],[m+9.5,-45],[m-9.5,-45]]); cx.fill(); }
  path([[TW.A-22,TW.B-9.5],[TW.A+9.5,TW.B-9.5],[TW.A+9.5,TW.B-30]]); cx.fill();
  path([[TW.E+9.5,TW.B+9.5],[TW.E-24,TW.B+9.5],[TW.E-9.5,TW.B-9.5],[TW.E-9.5,TW.B-26],[TW.E+9.5,TW.B-26]]); cx.fill();
  cx.fillStyle = texPattern('asphalt', 40, RWY_ANGLE()) || C.rwy;
  // turning pads at each end (paved circle plus fillet back to the runway edge)
  for (const k of ['E', 'W']) {
    const { c: [cm, co], r } = TURN_PAD[k], s = k === 'E' ? 1 : -1, [X, Y] = c(cm, co);
    cx.beginPath(); cx.arc(X, Y, (r + 8)*mpx, 0, 7); cx.fill();
    path(k === 'E' ? [[1668,22.5],[1730,50],[1764,62],[1790,50],[1790,0],[1668,0]] : [[RWY_M-1668,-22.5],[RWY_M-1730,-50],[RWY_M-1764,-62],[RWY_M-1790,-50],[RWY_M-1790,0],[RWY_M-1668,0]]); cx.fill();
  }
  drawPavingDetail(c, path, mpx);
  if (!IMG) drawBuildings(c, path, mpx);
  // Winston Churchill Avenue across the runway
  if (!IMG) { cx.save(); cx.globalAlpha = 0.55; cx.strokeStyle = C.road; cx.lineWidth = lw(14); cx.lineCap = 'butt'; path([[985,-22],[1000,22]], false); cx.stroke(); cx.restore(); }
  if (sc > 150) {
    // runway markings: AD 2.9 only says the TDZ marks are non-standard, so the set below follows the ICAO Annex 14 layout
    cx.fillStyle = C.paint; cx.strokeStyle = C.paint;
    cx.lineWidth = lw(0.9); path([[0,21.6],[RWY_M,21.6]], false); cx.stroke(); path([[0,-21.6],[RWY_M,-21.6]], false); cx.stroke();   // side stripes
    quad(0.5, -21.6, 1.4, 21.6); cx.fill(); quad(RWY_M - 1.4, -21.6, RWY_M - 0.5, 21.6); cx.fill();                                        // runway ends
    cx.lineWidth = lw(0.9); cx.setLineDash([30*mpx, 20*mpx]); path([[THR09_M+85,0],[THR27_M-85,0]], false); cx.stroke(); cx.setLineDash([]);
    for (const [m0, dir] of [[THR09_M, 1], [THR27_M, -1]]) {
      quad(m0, 21.6, m0 + dir*1.8, -21.6); cx.fill();                                                                // threshold bar
      for (let i = 0; i < 6; i++) for (const k of [-1, 1]) { const o = k*(3 + i*3.4); quad(m0 + dir*6, o - 0.9*k, m0 + dir*36, o + 0.9*k); cx.fill(); }   // 12 threshold stripes
      for (const k of [-1, 1]) { quad(m0 + dir*300, k*9, m0 + dir*345, k*15); cx.fill(); }                             // aiming point
      for (const [d, n] of [[150, 3], [450, 2], [600, 1]]) for (const k of [-1, 1]) for (let j = 0; j < n; j++) {       // touchdown zone pairs
        const o = k*(9 + j*3.3); quad(m0 + dir*d, o, m0 + dir*(d + 22.5), o + k*1.8); cx.fill();
      }
      // displaced threshold: centreline arrows and arrowheads in the pre-threshold area
      const pre = dir > 0 ? THR09_M : RWY_M - THR27_M;
      cx.lineWidth = lw(0.9);
      for (let d = 20; d < pre - 12; d += 40) { const m = m0 - dir*d; path([[m - dir*12, 0], [m, 0]], false); cx.stroke(); path([[m - dir*6, -2.5],[m, 0],[m - dir*6, 2.5]], false); cx.stroke(); }
      for (const k of [-1, 1]) { const m = m0 - dir*6; path([[m - dir*8, k*9],[m, k*12],[m - dir*8, k*15]], false); cx.stroke(); }
    }
    { cx.font = `700 ${Math.max(9, 14*mpx)}px ${FONT_L}`; for (const [m0, lab, h] of [[THR09_M+58,'09',CRS09],[THR27_M-58,'27',CRS27]]) { cx.save(); cx.translate(...c(m0,0)); cx.rotate(h*D2R); cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(lab, 0, 0); cx.restore(); } cx.textBaseline = 'alphabetic'; }
    // turn-pad guidance lines and edge markings
    cx.strokeStyle = C.yellow; cx.lineWidth = lw(0.35); path(TURN_E, false); cx.stroke(); path(TURN_W, false); cx.stroke();
    cx.strokeStyle = C.paint; cx.lineWidth = lw(0.6);
    for (const k of ['E', 'W']) { const { c: [cm, co], r } = TURN_PAD[k], [X, Y] = c(cm, co); cx.beginPath(); cx.arc(X, Y, (r + 7)*mpx, 0, 7); cx.stroke(); }
    // PAAG positions (yellow circular markings across the runway)
    cx.strokeStyle = 'rgba(231,194,58,.8)'; cx.lineWidth = lw(0.6);
    for (const m of [433, RWY_M - 405]) for (const o of [-14, 0, 14]) { const [X,Y] = c(m,o); cx.beginPath(); cx.arc(X, Y, Math.max(1.5, 3*mpx), 0, 7); cx.stroke(); }
    // taxiway centre and edge lines (solid yellow edges, AD 2.9)
    cx.strokeStyle = C.yellow; cx.lineWidth = lw(0.3);
    for (const k in AD.twys) { path(AD.twys[k], false); cx.stroke(); }
    cx.globalAlpha = 0.55; cx.lineWidth = lw(0.25);
    for (const k in AD.twys) { const pts = AD.twys[k]; for (const s of [-9, 9]) { const off = pts.map(([m,o],i) => { const v = i ? [m - pts[i-1][0], o - pts[i-1][1]] : [pts[1][0]-m, pts[1][1]-o]; const L = Math.hypot(...v) || 1; return [m - v[1]/L*s, o + v[0]/L*s]; }); path(off, false); cx.stroke(); } }
    cx.globalAlpha = 1;
    // apron taxilanes and stand lead-ins
    cx.lineWidth = lw(0.3); path([[TW.A,LANE_N],[1385,LANE_N],[1385,TW.B]], false); cx.stroke(); path([[TW.C,LANE_S],[TW.D,LANE_S]], false); cx.stroke(); path([[1440,TW.B],[1446,132]], false); cx.stroke();
    for (const s of STANDS) {
      const ln = s.area === 'north' ? [1446,132] : [s.m, s.lane];
      cx.strokeStyle = C.yellow; path([ln, [s.m + (s.m - ln[0])*0.2, s.off + (s.off - ln[1])*0.25]], false); cx.stroke();
      const nose = [s.m + (s.m - ln[0])*0.25, s.off + (s.off - ln[1])*0.3];
      cx.save(); cx.translate(...c(...nose)); cx.rotate(s.hdg*D2R); cx.fillStyle = C.yellow; cx.fillRect(-4*mpx-2, -0.6, 8*mpx+4, 1.4); cx.restore();
    }
    drawStandDetail(c, path, mpx);
    // closed portion of B and B1: unserviceable crosses
    cx.strokeStyle = 'rgba(255,255,255,.75)'; cx.lineWidth = lw(0.8);
    for (const [m,o] of [[1648,TW.B],[1785,92]]) { const [X,Y] = c(m,o), r = 6*mpx+2; cx.beginPath(); cx.moveTo(X-r,Y-r); cx.lineTo(X+r,Y+r); cx.moveTo(X+r,Y-r); cx.lineTo(X-r,Y+r); cx.stroke(); }
    // holding position markings (pattern A: solid lines on the taxiway side) and signs
    for (const [k, Hd] of Object.entries(HOLDS)) {
      const s = Math.sign(Hd.off);
      cx.strokeStyle = C.yellow; cx.lineWidth = lw(0.3);
      for (const [d, dash] of [[0.9,false],[0.3,false],[-0.3,true],[-0.9,true]]) { cx.setLineDash(dash ? [1*mpx+1, 1*mpx+1] : []); path([[Hd.m-9.5, Hd.off + s*d],[Hd.m+9.5, Hd.off + s*d]], false); cx.stroke(); }
      cx.setLineDash([]);
      if (sc > 220) {
        const fs = Math.max(9, 3.4*mpx), q = c(Hd.m + 14, Hd.off + s*2); const txt = `${k}  27-09`; cx.font = `700 ${fs}px ${FONT_L}`; const tw = cx.measureText(txt).width;
        cx.fillStyle = '#c8202a'; cx.fillRect(q[0], q[1]-fs*0.85, tw + 8, fs*1.2); cx.fillStyle = '#fff'; cx.fillText(txt, q[0]+4, q[1]+fs*0.15);
        cx.fillStyle = '#111'; cx.fillRect(q[0], q[1]-fs*0.85, fs*0.95+4, fs*1.2); cx.fillStyle = C.yellow; cx.fillText(k, q[0]+4, q[1]+fs*0.15);
      }
    }
    // taxiway designators along B
    if (sc > 220) for (const [k, m, o] of [['B',1300,TW.B],['B',1520,TW.B],['A',TW.A,40],['E',TW.E,36],['C',TW.C,-40],['D',TW.D,-40]]) {
      const fs = Math.max(9, 3.2*mpx), q = c(m + 12, o - 12); cx.font = `700 ${fs}px ${FONT_L}`; cx.fillStyle = '#111'; cx.fillRect(q[0], q[1]-fs*0.85, fs*0.95+4, fs*1.2); cx.fillStyle = C.yellow; cx.fillText(k, q[0]+4, q[1]+fs*0.15);
    }
    // HS1 hot spot
    { const [X,Y] = c(TW.A, 88); cx.strokeStyle = rgba('hot', .85); cx.lineWidth = 1.2; cx.beginPath(); cx.arc(X, Y, 26*mpx+6, 0, 7); cx.stroke(); cx.fillStyle = rgba('hot', .95); cx.font = `600 11px ${FONT_L}`; cx.fillText('HS1', X - 26*mpx - 30, Y + 4); }
  }
  // lighting (it is night at Gibraltar for the session)
  if (sc > 110) {
    cx.save(); cx.globalCompositeOperation = C.glow;
    const r = Math.max(1.1, 0.9*mpx), glow = (m, o, col, rr=r) => { const [X,Y] = c(m,o); cx.fillStyle = col; cx.beginPath(); cx.arc(X, Y, rr, 0, 7); cx.fill(); };
    for (let m = 0; m <= RWY_M; m += 60) { glow(m, 23, 'rgba(255,244,214,.75)'); glow(m, -23, 'rgba(255,244,214,.75)'); }
    for (let o = -22; o <= 22; o += 4) { glow(THR09_M, o, 'rgba(90,255,140,.9)'); glow(THR27_M, o, 'rgba(90,255,140,.9)'); glow(1, o, 'rgba(255,60,60,.85)'); glow(RWY_M-1, o, 'rgba(255,60,60,.85)'); }
    // SALS 300 m (09) and approach lights 27
    for (let d = 30; d <= 300; d += 30) glow(-d*0.15, 0, 'rgba(255,240,200,.0)');
    for (const k in AD.twys) { const pts = AD.twys[k]; for (let i = 0; i < pts.length-1; i++) { const [m1,o1] = pts[i], [m2,o2] = pts[i+1], L = Math.hypot(m2-m1, o2-o1), n = Math.floor(L/30); for (let j = 1; j < n; j++) { const f = j/n, m = m1+(m2-m1)*f, o = o1+(o2-o1)*f, vx = (m2-m1)/L, vy = (o2-o1)/L; glow(m - vy*10, o + vx*10, 'rgba(70,130,255,.85)'); glow(m + vy*10, o - vx*10, 'rgba(70,130,255,.85)'); } } }
    const on = Math.floor(S.t*1.4) % 2 === 0;
    for (const Hd of Object.values(HOLDS)) if (Hd.rgl) for (const sgn of [-1,1]) glow(Hd.m + sgn*12, Hd.off, (on === (sgn > 0)) ? 'rgba(255,190,40,.95)' : 'rgba(255,190,40,.18)', r*1.4);
    // apron floodlight pools
    for (const m of AD.floods) { const [X,Y] = c(m, 236), rr = 55*mpx; const g = cx.createRadialGradient(X, Y, 0, X, Y, rr); g.addColorStop(0, `rgba(255,220,160,${C.flood})`); g.addColorStop(1, 'rgba(255,220,160,0)'); cx.fillStyle = g; cx.beginPath(); cx.arc(X, Y, rr, 0, 7); cx.fill(); }
    cx.restore();
  }
  // barriers, traffic and pedestrians at the crossing
  const col = st === 'CLOSED' ? C.xClosed : st === 'OPEN' ? C.xOpen : C.xMid;
  for (const off of [40, -40]) { cx.strokeStyle = col; cx.lineWidth = Math.max(2, 1.4*mpx); const m0 = XING_M + off*0.34; path([[m0-8, off],[m0+8, off]], false); cx.stroke(); }
  if (sc > 160) {
    cx.font = `600 12px ${FONT_L}`; cx.fillStyle = col; const p = c(XING_M - 24, -70); cx.textAlign = 'right'; cx.fillText(`WINSTON CHURCHILL AVE · ${st}`, p[0], p[1]); cx.textAlign = 'left';
    const n = Math.min(70, Math.round(S.xing.queue/3)); cx.fillStyle = rgba('car', .85);
    for (let i = 0; i < n; i++) { const side = i % 2 ? 1 : -1, d = 50 + Math.floor(i/2)*6; const m = side > 0 ? 1000 + d*0.03 : 985 - (d-22)*0.25; const q = c(m + ((i*7)%3 - 1)*2.5, side*d); cx.fillRect(q[0]-1.6, q[1]-1.6, 3.2, 3.2); }
    if (st === 'OPEN' || st === 'OPENING') for (let i = 0; i < 10; i++) { const f = ((S.t*0.09 + i*0.1) % 1), o = -60 + f*120, m = 987 + (o+22)/44*13 + (i%2 ? 3 : -3); const q = c(m, i%2 ? o : -o); cx.fillStyle = i % 3 ? rgba('car', .9) : rgba('apt', .9); cx.fillRect(q[0]-1.5, q[1]-1.5, 3, 3); }
  }
  if (sc > 180 && sc < 2400) {
    cx.fillStyle = rgba('lab', .72); cx.font = `600 12px ${FONT_L}`;
    if (IMG) { cx.fillStyle = C.name === 'dark' ? 'rgba(235,242,245,.92)' : '#fff'; cx.strokeStyle = 'rgba(0,0,0,.6)'; cx.lineWidth = 3; cx.lineJoin = 'round'; }
    const lab = (txt, m, off) => { const p = c(m, off); if (IMG) cx.strokeText(txt, p[0], p[1]); cx.fillText(txt, p[0], p[1]); };
    lab('TERMINAL', 1225, 300); lab('CIVIL APRON', 1235, 228); lab('NORTH APRON', 1450, 240); lab('SOUTH APRON · RAF', 1000, -230); lab('ATC', 1056, 232);
    if (!IMG) { lab('SPAIN · LA LÍNEA', 600, 520); lab('GIBRALTAR', 1350, -420); } lab('WEST TURNING CIRCLE', 0, -78); lab('EAST TURNING CIRCLE', 1660, 75);
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
function drawAc(ac){
  const sc = V.scale, X = sx(ac.x), Y = sy(ac.y);
  if (X < -200 || Y < -200 || X > W+200 || Y > H+200) return;
  const sel = S.sel === ac, conf = S.conflictSet.has(ac.cs);
  const col = ac.state === 'PRE' ? (sel ? C.sel : C.pre) : conf ? C.conf : sel ? C.sel : ac.kind === 'ARR' ? C.arr : C.dep;
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
      if (ac.kind === 'ARR') cx.strokeRect(X-4, Y-4, 8, 8); else { cx.beginPath(); cx.arc(X, Y, 4.5, 0, 7); cx.stroke(); }
      const v = ac.gs/60; cx.beginPath(); cx.moveTo(X, Y); cx.lineTo(sx(ac.x + v*Math.sin(ac.trk*D2R)), sy(ac.y + v*Math.cos(ac.trk*D2R))); cx.stroke();
    }
  }
  if (ac.ground && sc < 70) return;
  if (dormant(ac) && !sel) return;   // parked with nothing due: no data block
  const lx = X + 16, ly = Y - 26;
  cx.strokeStyle = col; cx.globalAlpha = 0.6; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(X+5, Y-5); cx.lineTo(lx-2, ly+6); cx.stroke(); cx.globalAlpha = 1;
  cx.font = `500 11.5px ${FONT_D}`;
  const l1 = ac.cs + (ac.need ? ' ◆' : '');
  let l2, l3 = '';
  if (ac.ground) { l2 = `${ac.t}/${ac.perf.wake} ${stateLabel(ac)}`; if (ac.held) l3 = 'HOLD POSN'; else if (ac.waiting) l3 = `GIVING WAY ${ac.waiting}`; }
  else {
    const a = String(Math.max(0, Math.round(ac.alt/100))).padStart(3,'0'), tr = ac.vs > 300 ? '↑' : ac.vs < -300 ? '↓' : ' ';
    const cl = ac.mode === 'FINAL' ? 'SRA' : ac.tgtAlt != null ? String(Math.round(ac.tgtAlt/100)).padStart(3,'0') : '';
    l2 = `${a}${tr}${cl} ${String(Math.round(ac.gs/10)).padStart(2,'0')}`;
    l3 = ac.state === 'PRE' ? `${ac.t} ${ac.o} PENDING` : `${ac.t} ${ac.kind === 'ARR' ? (ac.app ? 'R'+ac.app : ac.o) : ac.d}${ac.freq === 'TWR' ? ' T' : ''}`;
  }
  const w = Math.max(cx.measureText(l1).width, cx.measureText(l2).width, l3 ? cx.measureText(l3).width : 0);
  { cx.fillStyle = C.tagBg; cx.fillRect(lx-3, ly-11, w+6, (l3 ? 3 : 2)*13 + 3); cx.strokeStyle = C.tagEdge; cx.lineWidth = 1; cx.strokeRect(lx-3.5, ly-11.5, w+7, (l3 ? 3 : 2)*13 + 4); }
  cx.fillStyle = col; cx.fillText(l1, lx, ly); cx.fillText(l2, lx, ly+13); if (l3) cx.fillText(l3, lx, ly+26);
}

function stateLabel(ac){
  return ({ PARKED:'STAND '+(ac.stand?ac.stand.id:''), PUSH:'PUSHBACK', READY:'STARTED', TAXI:'TAXI '+(ac.hp||''), HOLDPT:'HOLDING '+(ac.hp||''), LINEUP:'LINING UP', LINEDUP:'LINED UP', TAKEOFF:'TAKE-OFF', AIRBORNE:'AIRBORNE', CLIMB:'CLIMBING', INBOUND:'INBOUND', VECTORS:'VECTORS', FINAL:'SRA '+(ac.app||''), HOLDING:'HOLDING', MISSED:'MISSED APP', DIVERTING:'DIVERTING', ROLLOUT:'LANDING ROLL', TOW:'UNDER TOW', PRE:'PENDING', ROLLED:'ON RUNWAY', VACATING:'TAXI IN', ONSTAND:'ON STAND' })[ac.state] || ac.state;
}

// ═════════════════════════ console UI ═════════════════════════
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' })[c]);
function select(ac){ S.sel = ac; renderSel(); renderStrips(true); }
function renderAtis(){
  const w = S.wx, c = windComp(w, S.rwy === '27' ? CRS27 : CRS09), X = S.xing, tex = turbExcess(w);
  const cloud = w.clouds.length ? w.clouds.join(' ') : (w.raw.includes('CAVOK') ? 'CAVOK' : 'NSC');
  const pct = X.st === 'CLOSING' ? clamp(1 - (X.t - S.t)/150, 0, 1) : X.st === 'CLOSED' ? 1 : X.st === 'OPENING' ? clamp((X.t - S.t)/15, 0, 1) : 0;
  $('atis').innerHTML = `
    <div class="ph"><span class="lbl">ATIS</span><span class="atis-letter">${S.atis}</span><span class="lbl dimmer">${phonetic(S.atis)}</span>
      <span class="grow"></span><span class="lbl">Runway</span>
      <span class="seg sm"><button id="rw27" class="${S.rwy==='27'?'on':''}">27</button><button id="rw09" class="${S.rwy==='09'?'on':''}">09</button></span></div>
    <div class="metar"></div>
    <div class="tiles">
      <div class="tile"><div class="lbl">Wind</div><div class="v">${w.vrb?'VRB':hdg3(w.dir)}°/${w.spd}${w.gust?'<small>G'+w.gust+'</small>':''}</div></div>
      <div class="tile"><div class="lbl">Head / X ${S.rwy}</div><div class="v ${c.headG < -10 || c.crossG > 33 ? 'bad':''}">${Math.round(c.head)} / ${Math.round(c.cross)}</div></div>
      <div class="tile"><div class="lbl">Vis · Cloud</div><div class="v ${w.vis < 5000 ? 'bad' : ''}">${w.vis >= 9999 ? '10k+' : w.vis} <small>${esc(cloud.split(' ')[0] || '')}</small></div></div>
      <div class="tile"><div class="lbl">QNH</div><div class="v">${w.qnh}</div></div>
      <div class="tile"><div class="lbl">SRA mins</div><div class="v ${sraMinsOk(w)?'ok':'bad'}">${sraMinsOk(w)?'OK':'BELOW'}</div></div>
      <div class="tile"><div class="lbl">Temp / Dew</div><div class="v">${w.temp}° / ${w.dew}°</div></div>
    </div>
    ${tex > 0 ? `<div class="warnline">Turbulence: ${Math.round(tex)} kt over the Special Procedures limit. Expect windshear on final.</div>` : ''}
    <div class="xing st-${X.st}">
      <div class="xing-l"><div class="lbl">Winston Churchill Avenue</div>
        <div class="xing-st">${X.st}${X.st==='CLOSING'?' · <span id="xCount">'+Math.max(0,Math.ceil(X.t - S.t))+'</span> s':''}${X.st==='CLOSED'?' · '+Math.round(X.queue)+' waiting':''}</div>
        <div class="bar"><i style="width:${Math.round(pct*100)}%"></i></div></div>
      <button id="xBtn" class="${X.st==='OPEN'||X.st==='OPENING'?'danger':'go'}">${X.st==='OPEN'||X.st==='OPENING'?'Close road':'Open road'}</button></div>`;
  $('atis').querySelector('.metar').textContent = w.raw;
  $('rw27').onclick = () => setRwy('27'); $('rw09').onclick = () => setRwy('09');
  $('xBtn').onclick = toggleXing;
}
function setRwy(r){
  if (S.rwy === r) return; S.rwy = r; nextAtis(); sys(`Runway ${r} in use. Information ${phonetic(S.atis)} is current.`);
  for (const ac of S.acs) if (ac.kind === 'ARR' && !ac.app && ac.mode === 'NAV' && ac.airborne) { const rt = ARR_ROUTE[ac.gate][r]; const j = rt.findIndex(id => ac.route.includes(id)); ac.route = j >= 0 ? rt.slice(j) : rt.slice(-1); }
  renderAtis(); emit('rwy', r);
}
function toggleXing(){
  const X = S.xing;
  if (X.st === 'OPEN' || X.st === 'OPENING') { X.st = 'CLOSING'; X.t = S.t + 150; sys('Closing Winston Churchill Avenue: pedestrians and cyclists being cleared, barriers lowering, FOD check (about 2½ minutes).'); emit('xing', 'CLOSING'); }
  else { if (S.acs.some(a => a.onRwy)) { sys('The runway is occupied, the road must stay closed.', true); return; } X.st = 'OPENING'; X.t = S.t + 15; X.queue = 0; emit('xing', 'OPENING'); }
  renderAtis();
}
const ICON = {
  up: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2l5 6H9v6H7V8H3z" fill="currentColor"/></svg>',
  dn: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 14l5-6H9V2H7v6H3z" fill="currentColor"/></svg>'
};
function renderSel(){
  const ac = S.sel, el = $('sel');
  if (!ac || !S.acs.includes(ac)) { el.innerHTML = `<div class="ph"><span class="lbl">Selected flight</span></div><p class="empty">Click a target on the scope or a strip below. Flights marked <b class="need-dot">◆</b> are waiting on you. <kbd>Tab</kbd> cycles flights.</p>`; return; }
  const air = ac.airborne, route = ac.kind === 'ARR' ? `${ac.o} → LXGB` : `LXGB → ${ac.d}`;
  let html = `<div class="sel-head"><span class="cs ${ac.kind}">${ac.cs}</span><span class="chip ${ac.kind}">${ac.kind === 'ARR' ? 'Arrival' : 'Departure'}</span><span class="chip">${stateLabel(ac)}</span><span class="grow"></span><span class="lbl">${ac.state === 'PRE' ? 'Not on frequency' : ac.freq === 'TWR' ? 'Tower 131.2' : 'Radar 122.8'}</span></div>
    <div class="meta">${ac.perf.name} · ${ac.t}/${ac.perf.wake} · ${route} · sqk ${ac.sqk}${ac.reg ? ' · '+ac.reg : ''}<br>“${spoken(ac.cs)}”</div>`;
  if (ac.need) html += `<div class="needline">◆ ${esc(ac.need)}</div>`;
  const b = (c, label, en=true, cls='') => `<button class="${cls}" data-c="${c}" ${en ? '' : 'disabled'}>${label}</button>`;
  if (ac.state === 'PRE') { el.innerHTML = html + `<div class="readout"><span><b>${Math.round(ac.alt)}</b> ft</span><span>GS <b>${Math.round(ac.gs)}</b></span><span><b>${Math.round(Math.hypot(ac.x-GBR[0], ac.y-GBR[1]))}</b> NM</span></div><p class="empty">Not on your frequency yet. It is still with the previous sector and calls Gibraltar Radar at the boundary, about ${Math.max(1, Math.round((ac.preAt - S.t)/60))} min from now.</p>`; return; }
  if (air) {
    html += `<div class="readout"><span><b>${Math.round(ac.alt)}</b> ft ${ac.vs > 300 ? ICON.up : ac.vs < -300 ? ICON.dn : ''}→ ${ac.mode === 'FINAL' ? 'SRA profile' : (ac.tgtAlt ?? '–')}</span><span>HDG <b>${hdg3(ac.hdg)}</b></span><span>IAS <b>${Math.round(ac.ias)}</b></span><span>GS <b>${Math.round(ac.gs)}</b></span></div>
    ${ac.route.length || ac.mode === 'HOLD' ? `<div class="meta">${ac.route.length ? 'Route '+ac.route.join(' › ') : ''}${ac.mode === 'HOLD' ? 'Holding at '+ac.hold.name : ''}</div>` : ''}
    <div class="ctl"><label><span class="lbl">Heading</span><input id="iH" placeholder="270" inputmode="numeric"></label><label><span class="lbl">Altitude ×100</span><input id="iA" placeholder="40" inputmode="numeric"></label><label><span class="lbl">Speed</span><input id="iS" placeholder="180" inputmode="numeric"></label></div><div class="btns">`;
    if (ac.diverting) html += b(`DCT ${ac.diverting} A80`, 'Approve diversion', true, 'go');
    if (ac.kind === 'ARR') html += b('APP 27','SRA 27', true, S.rwy==='27'?'on':'') + b('APP 09','SRA 09', true, S.rwy==='09'?'on':'') + b('HO','To Tower', ac.freq !== 'TWR') + b('CTL','Cleared to land', true, 'go') + b('GA','Go around', true, 'danger') + b('HOLD','Hold');
    else html += b('HO', ac.freq === 'TWR' ? 'To Radar' : 'To '+NEXT_UNIT[ac.gate][0].split(' ')[0], true, 'go') + b('DCT '+EXIT_ROUTE[ac.gate][0], 'Direct '+EXIT_ROUTE[ac.gate][0]) + b('A80','Climb FL80');
    html += `<select id="iD" aria-label="Direct to fix"><option value="">Direct to…</option>${Object.keys(WP).map(k => `<option>${k}</option>`).join('')}</select></div>`;
  } else {
    html += `<div class="btns">`;
    if (ac.kind === 'DEP') {
      const south = ac.stand && ac.stand.area === 'south', canTaxi = ac.state === 'READY' || (ac.state === 'PARKED' && !!ac.need && ac.need !== 'Request tow') || ac.state === 'TAXI' || ac.state === 'HOLDPT';
      const startReq = ac.state === 'PARKED' && !!ac.need && ac.need !== 'Request tow';
      if (ac.need === 'Request tow') html += b('TOW', `Approve tow to stand ${ac.tow && ac.tow.to ? ac.tow.to.id : ''}`, true, 'go');
      html += b('POP:push','Start &amp; push…', startReq, startReq ? 'go' : '');
      html += b('POP:taxi', ac.state === 'TAXI' ? 'Re-route taxi…' : 'Taxi…', canTaxi && ac.state !== 'HOLDPT', ac.state === 'READY' && ac.need ? 'go' : '');
      html += b('LU','Line up', ac.state === 'HOLDPT') + b('CTO','Cleared take-off', ['HOLDPT','LINEUP','LINEDUP'].includes(ac.state), 'go');
    } else {
      const south = isMil(ac);
      html += (south ? ['C','D'] : ['A','E']).map(h => b('VAC '+h, 'Vacate '+h, ['ROLLED','ROLLOUT'].includes(ac.state))).join('');
      html += b('VAC','Backtrack &amp; taxi in', ['ROLLED','ROLLOUT'].includes(ac.state), 'go');
    }
    html += b(ac.held ? 'RES' : 'HP', ac.held ? 'Continue taxi' : 'Hold position', !!ac.path && ac.state !== 'TAKEOFF');
    html += `</div>`;
  }
  el.innerHTML = html;
  el.querySelectorAll('button[data-c]').forEach(bt => bt.onclick = () => { const c = bt.dataset.c; if (c === 'POP:push') openPushPop(ac, bt); else if (c === 'POP:taxi') openTaxiPop(ac, bt); else command(ac.cs+' '+c); });
  const keyCmd = (id, pre) => { const i = $(id); if (i) i.onkeydown = e => { if (e.key === 'Enter' && i.value.trim()) command(`${ac.cs} ${pre}${i.value.trim()}`); }; };
  keyCmd('iH','H'); keyCmd('iA','A'); keyCmd('iS','S');
  const d = $('iD'); if (d) d.onchange = () => d.value && command(`${ac.cs} DCT ${d.value}`);
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
  const st = ac.stand, rec = pushRec(ac), lh = mOf(st.lp);
  const opts = ['east', 'west'].map(f => {
    const pts = pushPath(ac, f), hp = f === 'east' ? (st.area === 'south' ? 'D' : 'E') : (st.area === 'south' ? 'C' : 'A');
    return { f, pts: [st.p, ...pts], hp, rec: f === rec };
  });
  showPop(ac, anchor, `<div class="lbl">Start-up and push back</div><h4>${ac.cs} <span>stand ${st.id} · ${ac.t}</span></h4>
    <p class="hint">Choose which way the nose faces after the push. Face the way it will taxi: runway ${S.rwy} departures leave from ${PHON[depHold(ac)]}.</p>
    <div class="opts two">${opts.map((o, j) => `<button class="opt${o.rec ? ' rec' : ''}" data-j="${j}">${COMPASS(o.f === 'east' ? CRS09 : CRS09 + 180)}<b>Face ${o.f}</b><span>Tail ${o.f === 'east' ? 'west' : 'east'} · towards ${PHON[o.hp]}</span>${o.rec ? '<i>Recommended</i>' : ''}</button>`).join('')}</div>
    <div class="phr">“${spoken(ac.cs)}, start-up and push back approved, facing <em>${rec}</em>, QNH ${S.wx.qnh}”</div>`, () => {
    pop.querySelectorAll('.opt').forEach(bt => {
      const o = opts[+bt.dataset.j];
      const pv = () => { S.preview = { pts: o.pts, label: 'Push · face ' + o.f }; pop.querySelector('.phr em').textContent = o.f; };
      bt.onmouseenter = pv; bt.onfocus = pv;
      bt.onclick = () => { command(`${ac.cs} PUSH ${o.f === 'east' ? 'E' : 'W'}`); closePop(); };
    });
    S.preview = { pts: opts.find(o => o.rec).pts, label: 'Push · face ' + rec };
  });
}
function openTaxiPop(ac, anchor){
  const south = ac.stand && ac.stand.area === 'south' && !ac.leftStand || (ac.leftStand && offOf([ac.x, ac.y]) < 0);
  const hps = south ? ['C', 'D'] : ['A', 'E'], rec = depHold(ac);
  hps.sort((a, b) => (b === rec) - (a === rec));
  const groups = hps.map(hp => ({ hp, opts: taxiOptions(ac, hp) })).filter(g => g.opts.length);
  const pre = ac.state === 'PARKED' ? [ac.stand.lp] : [[ac.x, ac.y]];
  const all = []; groups.forEach(g => g.opts.forEach((o, k) => all.push({ hp: g.hp, o, rec: g.hp === rec && k === 0 })));
  const H = (hp, o) => { const pts = [...pre, ...o.nodes.map(id => GN[id].p)]; if (ac.pushed && !ac.leftStand && pts.length > 2 && Math.abs(angDiff(ac.hdg, brg(ac.x, ac.y, ...pts[2]))) < 90) pts.splice(1, 1); return pts; };
  const len = o => Math.round(o.len / M2NM / 10) * 10;
  showPop(ac, anchor, `<div class="lbl">Taxi clearance · runway ${S.rwy}</div><h4>${ac.cs} <span>${ac.stand && !ac.leftStand ? 'stand ' + ac.stand.id : 'on the move'} · ${ac.t}</span></h4>
    <p class="hint">Pick a holding point and the routing. Hover to preview it on the scope. ${S.rwy === '27' ? 'From Alpha or Charlie a runway 27 departure backtracks east to the turning circle.' : 'From Echo or Delta a runway 09 departure backtracks west across the road to the turning circle.'}</p>
    ${groups.map(g => `<div class="grp"><div class="gh"><b>Holding point ${PHON[g.hp]}</b><span>${HOLDS[g.hp].rgl ? 'Guard lights' : ''}${g.hp === rec ? ' · runway ' + S.rwy + ' departure point' : ''}</span></div>
      ${g.opts.map(o => { const j = all.findIndex(a => a.o === o); const a = all[j]; return `<button class="opt row${a.rec ? ' rec' : ''}" data-j="${j}"><span class="hp">${g.hp}</span><b>via ${(o.via.length ? o.via : [g.hp]).map(t => PHON[t]).join(', ')}</b><span class="ln">${len(o)} m</span>${a.rec ? '<i>Recommended</i>' : ''}</button>`; }).join('')}</div>`).join('')}
    <div class="phr">“${spoken(ac.cs)}, taxi to holding point <em></em>, runway ${S.rwy}, QNH ${S.wx.qnh}”</div>`, () => {
    const say = a => pop.querySelector('.phr em').textContent = PHON[a.hp] + (a.o.via.length ? ' via ' + a.o.via.map(t => PHON[t]).join(', ') : '');
    pop.querySelectorAll('.opt').forEach(bt => {
      const a = all[+bt.dataset.j];
      const pv = () => { S.preview = { pts: H(a.hp, a.o), label: 'Hold ' + a.hp + (a.o.via.length ? ' via ' + a.o.via.join(' ') : '') }; say(a); };
      bt.onmouseenter = pv; bt.onfocus = pv;
      bt.onclick = () => { command(`${ac.cs} TAXI ${a.hp}${a.o.via.length ? ' VIA ' + a.o.via.join(' ') : ''}`); closePop(); };
    });
    const r0 = all.find(a => a.rec) || all[0]; if (r0) { S.preview = { pts: H(r0.hp, r0.o), label: 'Hold ' + r0.hp }; say(r0); }
  });
  if (V.name !== 'gnd' && V.scale < 70) setView('gnd');
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !pop.hidden) closePop(); });
document.addEventListener('pointerdown', e => { if (!pop.hidden && !pop.contains(e.target) && !(e.target.closest && e.target.closest('#sel'))) closePop(); });

let stripSig = '';
function renderStrips(force){
  const list = S.acs.filter(a => !dormant(a) || S.sel === a).sort((a,b) => (!!b.need - !!a.need) || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0));
  const sig = list.map(a => a.cs + a.state + (a.need||'') + (S.sel === a) + Math.round(a.alt/100) + a.freq).join(',');
  if (sig === stripSig && !force) return; stripSig = sig;
  const el = $('strips'); el.innerHTML = '';
  for (const ac of list) {
    const d = document.createElement('button'); d.type = 'button'; d.className = `strip ${ac.kind}${S.sel === ac ? ' sel' : ''}${ac.need ? ' need' : ''}`;
    d.innerHTML = `<span class="bar"></span><span class="c-a"><span class="cs"></span><span class="ty"></span></span><span class="c-b"><span class="rte"></span><span class="lv"></span></span><span class="c-c"><span class="stt"></span><span class="fq"></span></span>`;
    d.querySelector('.cs').textContent = ac.cs;
    d.querySelector('.ty').textContent = `${ac.t}/${ac.perf.wake} · ${ac.sqk}`;
    d.querySelector('.rte').textContent = ac.kind === 'ARR' ? `${ac.o} › LXGB` : `LXGB › ${ac.d}`;
    d.querySelector('.lv').textContent = ac.airborne ? (ac.alt > 6000 ? 'FL'+String(Math.round(ac.alt/100)).padStart(3,'0') : Math.round(ac.alt/100)*100+' ft') + (ac.tgtAlt ? ' › '+(ac.tgtAlt > 6000 ? 'FL'+Math.round(ac.tgtAlt/100) : ac.tgtAlt) : '') : (ac.stand && ac.state === 'PARKED' ? 'Stand '+ac.stand.id : ac.hp ? 'Hold '+ac.hp : 'Ground');
    const st = d.querySelector('.stt'); st.textContent = ac.need ? '◆ '+ac.need : stateLabel(ac);
    d.querySelector('.fq').textContent = ac.ground ? 'TWR' : ac.freq === 'TWR' ? 'TWR' : 'RAD';
    d.onclick = () => select(ac); el.appendChild(d);
  }
  if (!list.length) el.innerHTML = '<p class="empty">No traffic yet.</p>';
  const parked = S.acs.filter(dormant).length;
  $('stripCount').textContent = `${S.acs.length - parked} active · ${parked} parked · ${S.sched.filter(f => !f.spawned).length} to come`;
}
function renderScore(){
  const s = S.score;
  $('score').innerHTML = `<span><b>${s.pts}</b> pts</span><span>Landed <b>${s.landed}</b></span><span>Departed <b>${s.departed}</b></span><span>GA <b>${s.ga}</b></span><span>Div <b>${s.div}</b></span><span class="${s.los?'bad':''}">LoS <b>${s.los}</b></span><span class="${s.infr?'bad':''}">R164 <b>${s.infr}</b></span><span class="${s.incidents?'bad':''}">Incidents <b>${s.incidents}</b></span>`;
  const d = new Date(S.start + S.t*1000);
  $('clock').textContent = d.toISOString().substr(11,8)+'Z';
  $('clockz').textContent = 'local ' + new Date(d.getTime() + 2*3600e3).toISOString().substr(11,5) + ' · ' + (S.paused ? 'paused' : S.speed+'×');
  if (S.xing.st === 'CLOSING' || S.xing.st === 'OPENING') { const el = $('xCount'); if (el) el.textContent = Math.max(0, Math.ceil(S.xing.t - S.t)); const bar = document.querySelector('.xing .bar i'); if (bar) bar.style.width = Math.round((S.xing.st === 'CLOSING' ? clamp(1 - (S.xing.t - S.t)/150, 0, 1) : clamp((S.xing.t - S.t)/15, 0, 1))*100)+'%'; }
}

const RWY_MID = rm(900, 0);
function viewFor(k){
  const m = Math.min(W, H) || 600;
  if (k === 'app') { V.cx = GBR[0] - 2; V.cy = GBR[1] - 4; V.scale = m/84; }
  else if (k === 'twr') { V.cx = RWY_MID[0] - 1.2; V.cy = RWY_MID[1] - 1.1; V.scale = m/10; }
  else { const c = rm(1000, 0); V.cx = c[0]; V.cy = c[1]; V.scale = Math.min(W/(1950*M2NM), H/(820*M2NM)); }
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
    draw(); out = { cx: V.cx, cy: V.cy, scale: V.scale, W, H };
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
$('tgSpeed').onclick = e => { S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 4 : 1; e.currentTarget.textContent = S.speed+'×'; };
$('tgVoice').onclick = e => { S.voice = !S.voice; e.currentTarget.classList.toggle('on', S.voice); e.currentTarget.setAttribute('aria-pressed', S.voice); loadVoices(); if (!S.voice) try { speechSynthesis.cancel(); } catch(_) {} };
$('tgSetup').onclick = () => openSetup();
function openSetup(){ S.paused = true; $('tgPause').textContent = 'Resume'; $('startBtn').textContent = S.running ? 'Apply weather and resume' : 'Open the position'; $('setup').hidden = false; try { renderSlots(); } catch(_) {} }

let drag = null; const pointers = new Map();
cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); pointers.set(e.pointerId, [e.offsetX, e.offsetY]); drag = { x: e.offsetX, y: e.offsetY, cx: V.cx, cy: V.cy, moved: false, d0: null, s0: V.scale }; });
cv.addEventListener('pointermove', e => {
  if (!drag) return; pointers.set(e.pointerId, [e.offsetX, e.offsetY]);
  if (pointers.size === 2) { const [a,b] = [...pointers.values()]; const d = Math.hypot(a[0]-b[0], a[1]-b[1]); if (!drag.d0) drag.d0 = d; V.scale = clamp(drag.s0*d/drag.d0, 3, 12000); drag.moved = true; return; }
  const dx = e.offsetX - drag.x, dy = e.offsetY - drag.y; if (Math.hypot(dx,dy) > 4) drag.moved = true;
  if (drag.moved) { V.cx = drag.cx - dx/V.scale; V.cy = drag.cy + dy/V.scale; }
});
cv.addEventListener('pointerup', e => {
  pointers.delete(e.pointerId);
  if (drag && !drag.moved) { let best = null, bd = 26; for (const ac of S.acs) { const d = Math.hypot(sx(ac.x)-e.offsetX, sy(ac.y)-e.offsetY); if (d < bd) { bd = d; best = ac; } } if (best) select(best); }
  if (!pointers.size) drag = null;
});
cv.addEventListener('wheel', e => { e.preventDefault(); const f = Math.exp(-e.deltaY*0.0015), wxp = wx2(e.offsetX), wyp = wy2(e.offsetY); V.scale = clamp(V.scale*f, 3, 12000); V.cx = wxp - (e.offsetX - W/2)/V.scale; V.cy = wyp + (e.offsetY - H/2)/V.scale; }, { passive: false });

$('cmdForm').onsubmit = e => { e.preventDefault(); const v = $('cmd').value; if (v.trim()) command(v); $('cmd').value = ''; };
$('cmd').addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); const L = S.acs; if (!L.length) return; select(L[(L.indexOf(S.sel)+1) % L.length]); } });
document.addEventListener('keydown', e => { if (document.body.dataset.route !== 'sim') return; if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return; if (e.key === ' ') { e.preventDefault(); $('tgPause').click(); } if (e.key === '/') { e.preventDefault(); $('cmd').focus(); } });

const wxSel = $('wxPreset'); for (const [k,v] of Object.entries(WX_PRESETS)) { const o = document.createElement('option'); o.value = k; o.textContent = v.name; wxSel.appendChild(o); }
wxSel.value = 'fair';
// day and hour pickers: each slot carries its own timetable flights
const daySel = $('daySel'), hourSel = $('hourSel');
DAYS.forEach((n, i) => { const o = document.createElement('option'); o.value = i; o.textContent = n; daySel.appendChild(o); });
daySel.value = (new Date().getUTCDay() + 6) % 7;
const lt = h => String((h + 2) % 24).padStart(2,'0');
function renderSlots(){
  const d = +daySel.value, keep = hourSel.value, ex = !!EXERCISES[$('trafficSel').value];
  hourSel.innerHTML = '';
  for (const h of SESSION_HOURS) {
    const n = timetableFlights(d, h).length, o = document.createElement('option');
    o.value = h; o.textContent = `${String(h).padStart(2,'0')}00Z · ${lt(h)}:00 local · ${n ? n + ' scheduled' : 'quiet'}`; hourSel.appendChild(o);
  }
  hourSel.value = keep || 18;
  daySel.disabled = hourSel.disabled = ex || S.running;
  const fl = timetableFlights(d, +hourSel.value);
  $('slotList').innerHTML = ex ? '<span class="dimmer">Guided exercises use their own traffic.</span>'
    : fl.length ? fl.map(f => `<span class="slot ${f.k}"><b>${f.cs}</b> ${f.k === 'ARR' ? f.o + ' › LXGB' : 'LXGB › ' + f.d} <i>${f.at}Z</i></span>`).join('')
    : '<span class="dimmer">No scheduled flights in this slot. Pick “Timetable plus charters” for traffic, or another hour.</span>';
}
daySel.onchange = hourSel.onchange = renderSlots; $('trafficSel').addEventListener('change', renderSlots);
renderSlots();
function resetSession(){
  S.t = 0; S.acs = []; S.sel = null; S.sched = []; S.running = false; S.paused = true; S.conflicts = new Set(); S.conflictSet = new Set();
  S.xing = { st: 'OPEN', t: 0, queue: 0, totalClosed: 0 }; S.score = { landed: 0, departed: 0, ga: 0, div: 0, los: 0, infr: 0, incidents: 0, pts: 0 };
  STANDS.forEach(s => s.occ = null); logEl.innerHTML = ''; stripSig = '';
}
function start(){
  const pasted = $('wxPaste').value.trim();
  const mode = $('trafficSel').value;
  const ex = EXERCISES[mode];
  if (ex && !S.running) wxSel.value = ex.wx;
  S.wx = parseMetar(pasted && /\d{3,5}(G\d+)?KT|VRB|Q\d{4}/.test(pasted.toUpperCase()) ? pasted : WX_PRESETS[wxSel.value].metar);
  const c27 = windComp(S.wx, CRS27), c09 = windComp(S.wx, CRS09);
  const newRwy = c09.head > c27.head + 2 ? '09' : '27';
  if (!S.running) {
    resetSession();
    S.running = true; S.rwy = newRwy; S.mode = mode; S.atis = ATIS_LETTERS[8 + Math.floor(Math.random()*6)];
    const day = +daySel.value, hour = +hourSel.value;
    if (!ex) S.start = Date.UTC(2026, 9, 5 + day, hour, 0, 0); else S.start = Date.UTC(2026, 9, 4, 18, 55, 0);
    S.wx = parseMetar(S.wx.raw.replace(/^(LXGB )\d{6}Z/, (m, p) => { const z = new Date(S.start - 600e3); return p + String(z.getUTCDate()).padStart(2,'0') + String(z.getUTCHours()).padStart(2,'0') + '50Z'; }));
    S.sched = buildSchedule(mode, day, hour);
    sys(`Position open: Gibraltar Radar 122.8 and Tower 131.2 combined. ${S.wx.raw}. Runway ${S.rwy}, information ${phonetic(S.atis)}.`);
    if (!ex) sys(`${DAYS[day]} ${String(hour).padStart(2,'0')}00Z: ${S.sched.length} flight${S.sched.length === 1 ? '' : 's'} expected this session.`);
    if (turbExcess(S.wx) > 0) sys('Wind exceeds the Special Procedures turbulence limit: expect windshear on final and go-arounds.');
    if (!sraMinsOk(S.wx)) sys('Weather is below SRA minima (5 km, 1000 ft): arrivals will not be able to land.');
    step(0.01); setView(ex && ex.sched[0].k === 'DEP' ? 'gnd' : 'app');
    emit('start', mode);
  } else { nextAtis(); sys(`Weather updated: ${S.wx.raw}. Information ${phonetic(S.atis)}.`); if (newRwy !== S.rwy) sys(`Wind now favours runway ${newRwy}.`); }
  $('setup').hidden = true; S.paused = false; $('tgPause').textContent = 'Pause';
  renderAtis(); renderSel(); renderStrips(true);
}
$('startBtn').onclick = start;
$('newBtn').onclick = () => { S.running = false; resetSession(); openSetup(); renderAtis(); renderSel(); renderStrips(true); };

let last = performance.now(), uiT = 0;
function frame(now){
  const dtr = Math.min(0.25, (now - last)/1000); last = now;
  if (S.running && !S.paused) { let t = dtr*S.speed; while (t > 0) { const h = Math.min(0.2, t); step(h); t -= h; } }
  uiT += dtr;
  if (document.body.dataset.route === 'sim') {
    if (uiT > 0.5) { uiT = 0; renderStrips(); renderScore(); if (S.sel) { const a = document.activeElement; if (!(a && a.closest && a.closest('#sel'))) renderSel(); } emit('tick'); }
    if (cv.clientWidth && (Math.abs(cv.clientWidth - W) > 1 || Math.abs(cv.clientHeight - H) > 1)) resize();
    draw();
  }
  requestAnimationFrame(frame);
}
window.__S = S; window.__cmd = command; window.__step = step; window.__start = start;
