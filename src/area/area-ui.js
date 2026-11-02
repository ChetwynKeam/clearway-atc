// ═════════════════════════ Clearway Area Control · the console ═════════════════════════
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const FONT_L = '"Inter Tight", "Inter", system-ui, sans-serif', FONT_D = '"JetBrains Mono", ui-monospace, monospace';
const PAL = {
  light: { sea: '#cfe2ee', land: '#f3f0e7', wash: 'rgba(246,248,251,.38)', my: 'rgba(31,94,255,.07)', myEdge: 'rgba(31,94,255,.75)', nb: 'rgba(138,79,196,.55)', nbTxt: 'rgba(110,60,170,.85)',
    awy: 'rgba(90,105,125,.3)', awyTxt: 'rgba(80,95,115,.85)', fix: '#3a4a5e', apt: '#1452d9', arr: '#b75f00', dep: '#1452d9', ovf: '#0b3b5c', sel: '#0c1b2e', conf: '#d62d2d', off: '#8a4fc4',
    offer: '#b75f00', ghost: '#b4c2d1', ghostTxt: '#5d6f84', tagBg: 'rgba(255,255,255,.92)', tagEdge: 'rgba(12,27,46,.18)', cb: 'rgba(214,45,45,.16)', cbEdge: 'rgba(214,45,45,.6)', turb: 'rgba(183,95,0,.55)', pv: '#1f5eff', name: 'light' },
  dark: { sea: '#04121a', land: '#0d2427', wash: 'rgba(2,10,16,.35)', my: 'rgba(110,240,168,.06)', myEdge: 'rgba(110,240,168,.65)', nb: 'rgba(195,155,255,.45)', nbTxt: 'rgba(195,155,255,.8)',
    awy: 'rgba(160,190,200,.28)', awyTxt: 'rgba(170,195,205,.7)', fix: '#9fb3c8', apt: '#7cc7ff', arr: '#ffc164', dep: '#7cc7ff', ovf: '#cfe3e2', sel: '#ffffff', conf: '#ff5a5a', off: '#c39bff',
    offer: '#ffc164', ghost: '#5b6f80', ghostTxt: '#9fb3c8', tagBg: 'rgba(4,14,18,.78)', tagEdge: 'rgba(0,0,0,0)', cb: 'rgba(255,90,90,.16)', cbEdge: 'rgba(255,90,90,.6)', turb: 'rgba(255,193,100,.55)', pv: '#6ef0a8', name: 'dark' }
};
const C = { ...PAL.light };
const cv = $('scope'), cx = cv.getContext('2d');
let W = 800, H = 600, DPR = 1;
const V = { x: 0, y: 0, scale: 4 };
const sx = x => W/2 + (x - V.x)*V.scale, sy = y => H/2 - (y - V.y)*V.scale;
const wx2 = X => V.x + (X - W/2)/V.scale, wy2 = Y => V.y - (Y - H/2)/V.scale;
const SXY = (la, lo) => { const p = xy(la, lo); return [sx(p[0]), sy(p[1])]; };
const UI = { routes: 'sel', awy: true, voice: false, viewFL: 340 };

// ── the positions you can work ──
const SEATS = [
  { id: 'LS', code: 'EGTT · LAC', name: 'London Control South', short: 'London South', d: 'Worthing, Seaford, Dover and Hurn: the Channel, Heathrow and Gatwick departures south, Paris and Brest.', busy: 'Busy' },
  { id: 'LC', code: 'EGTT · LAC', name: 'London Control Central', short: 'London Central', d: 'Daventry and Clacton: the Midlands, the London TMA climbs and descents, Amsterdam and Maastricht.', busy: 'Busy' },
  { id: 'LW', code: 'EGTT · LAC', name: 'London Control West', short: 'London West', d: 'Berry Head, Brecon and Strumble: the South West, Wales and the westbound Atlantic and Irish flows.', busy: 'Medium' },
  { id: 'LN', code: 'EGTT · LAC', name: 'London Control North', short: 'London North', d: 'Lakes, Pole Hill and Ottringham: northern England, Scotland to London and the North Sea crossings.', busy: 'Medium' },
  { id: 'LE', code: 'EGTT · LAC', name: 'London Control East', short: 'London East', d: 'The North Sea: Clacton and Lambourne east, Amsterdam, Brussels and Maastricht hand-offs.', busy: 'Medium' },
  { id: 'L', code: 'EGTT · LAC', name: 'London Control (bandbox)', short: 'London bandbox', d: 'Every London upper sector on one frequency, the way a quiet night is run: England and Wales above the TMAs.', busy: 'Large' },
  { id: 'PC', code: 'EGPX · MAN', name: 'Manchester (Scottish Control)', short: 'Manchester', d: 'The Manchester sectors, worked from Prestwick: Manchester, Liverpool and Leeds arrivals, the Pennines and the Isle of Man.', busy: 'Training' },
  { id: 'S', code: 'EGPX · ScAC', name: 'Scottish Control', short: 'Scottish', d: 'Scotland, Northern Ireland and the far north of England: the North Atlantic tracks, Glasgow, Edinburgh and Aberdeen.', busy: 'Large' }
];
let SEAT = SEATS[0];

// ── drawing ──
function resize(){
  const r = cv.getBoundingClientRect(); DPR = window.devicePixelRatio || 1; W = Math.max(100, r.width); H = Math.max(100, r.height);
  cv.width = Math.round(W*DPR); cv.height = Math.round(H*DPR);
}
window.addEventListener('resize', () => { resize(); });
// your airspace as one shape: every sector of yours filled into a mask, the outline from its edge
let MYMASK = null;
function drawMine(){
  if (!MYMASK || MYMASK.w !== cv.width || MYMASK.h !== cv.height) MYMASK = { c: document.createElement('canvas'), w: cv.width, h: cv.height };
  const m = MYMASK.c; m.width = cv.width; m.height = cv.height; const g = m.getContext('2d'); g.setTransform(DPR, 0, 0, DPR, 0, 0);
  const path = P => { g.beginPath(); P.forEach(([la, lo], i) => { const [X, Y] = SXY(la, lo); i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath(); };
  g.strokeStyle = C.myEdge; g.lineWidth = 3.2; g.lineJoin = 'round';
  for (const s of MY) { path(s.p); g.stroke(); }
  g.globalCompositeOperation = 'destination-out'; g.fillStyle = '#000';
  for (const s of MY) { path(s.p); g.fill(); }
  g.globalCompositeOperation = 'source-over';
  cx.save(); cx.setTransform(1, 0, 0, 1, 0, 0); cx.drawImage(m, 0, 0); cx.restore();
  // a light fill inside, and the splits between your own sectors at the level shown
  cx.save(); cx.fillStyle = C.my;
  const fl = UI.viewFL;
  for (const s of MY) { if (fl < s.lo || fl >= s.hi) continue; cx.beginPath(); s.p.forEach(([la, lo], i) => { const [X, Y] = SXY(la, lo); i ? cx.lineTo(X, Y) : cx.moveTo(X, Y); }); cx.closePath(); cx.fill(); cx.strokeStyle = C.myEdge; cx.globalAlpha = .35; cx.lineWidth = 0.8; cx.setLineDash([3, 5]); cx.stroke(); cx.setLineDash([]); cx.globalAlpha = 1; }
  cx.restore();
}
// the sectors round you at the level shown: dashed, with who works them
function drawNeighbours(){
  const fl = UI.viewFL, seen = new Map();
  cx.save(); cx.strokeStyle = C.nb; cx.lineWidth = 1; cx.setLineDash([7, 5]);
  const [la1, lo1] = xy2ll(wx2(0), wy2(H)), [la2, lo2] = xy2ll(wx2(W), wy2(0));
  for (const s of SECS) {
    if (s.own === ME || s.ad || fl < s.lo || fl >= s.hi) continue;
    if (s.bb[2] < la1 || s.bb[0] > la2 || s.bb[3] < lo1 || s.bb[1] > lo2) continue;
    cx.beginPath(); s.p.forEach(([la, lo], i) => { const [X, Y] = SXY(la, lo); i ? cx.lineTo(X, Y) : cx.moveTo(X, Y); }); cx.closePath(); cx.stroke();
    const c = s.p.reduce((a, p) => [a[0] + p[0]/s.p.length, a[1] + p[1]/s.p.length], [0, 0]);
    if (!seen.has(s.own) || Math.random() < 0) seen.set(s.own, []);
    seen.get(s.own).push([c, s]);
  }
  cx.setLineDash([]);
  cx.font = `600 11px ${FONT_D}`; cx.fillStyle = C.nbTxt; cx.textAlign = 'center';
  for (const [code, list] of seen) {
    // one label per unit: at its biggest sector on screen
    const [c, s] = list.sort((a, b) => (b[1].bb[2] - b[1].bb[0])*(b[1].bb[3] - b[1].bb[1]) - (a[1].bb[2] - a[1].bb[0])*(a[1].bb[3] - a[1].bb[1]))[0];
    const [X, Y] = SXY(c[0], c[1]); if (X < 20 || Y < 60 || X > W - 20 || Y > H - 20) continue;
    cx.fillText(UNIT_SHORT(code).toUpperCase(), X, Y);
    cx.fillText(`${FLs(s.lo*100)}–${FLs(s.hi*100)}`, X, Y + 13);
  }
  cx.textAlign = 'left'; cx.restore();
}
function inView(la, lo, m = 40){ const [X, Y] = SXY(la, lo); return X > -m && Y > -m && X < W + m && Y < H + m; }
function drawAirways(){
  if (!UI.awy) return;
  const sc = V.scale;
  // the airway chart: upper (blue) and lower (amber) routes by level in view, RNAV and conventional, the designators on
  // the lines and the points with their symbols (awy.js); the flight's own route fixes are always named
  const mine = new Set(); if (S.sel && S.acs.includes(S.sel)) for (const q of S.sel.route) if (q[2]) mine.add(q[2]);
  if (sc >= 0.9) AW.drawChart({ cx, P: SXY, W, H, dark: C.name === 'dark', lvl: UI.viewFL > 245 ? 'U' : 'L', scale: sc, mine });
  cx.save();
  // airports
  for (const [k, v] of Object.entries(AREA.ap)) {
    if (!/^E[GI]/.test(k) || !inView(v[0], v[1]) || !STARS[k]) continue;
    const [X, Y] = SXY(v[0], v[1]); cx.strokeStyle = C.apt; cx.lineWidth = 1.3; cx.beginPath(); cx.arc(X, Y, 3.6, 0, 7); cx.stroke();
    if (sc > 2.4) { cx.font = `600 10px ${FONT_D}`; cx.fillStyle = C.apt; cx.fillText(k, X + 6, Y + 11); }
  }
  cx.restore();
}
// the SIDs (amber) and STARs (blue) of the airports in view, for the runway in use: the published lines as they are flown,
// the corners as fly-by arcs, each named at its far end (a SID at the fix it leaves on, a STAR at the fix it starts at)
function drawProcs(){
  if (!UI.proc || V.scale < 1.2) return;
  // zoomed out only the selected flight's airports; from about 6 px a mile every airport in view
  const sel = S.sel && S.acs.includes(S.sel) ? [S.sel.dep, S.sel.arr] : [];
  const R = AW.turnRadius(240, 25);
  cx.save(); cx.lineJoin = cx.lineCap = 'round'; cx.font = `600 10px ${FONT_D}`;
  for (const ic of Object.keys(AREA.ap)) {
    const A = AREA.ap[ic]; if (!inView(A[0], A[1], 300) || (!SIDS[ic] && !STARS[ic])) continue; if (V.scale < 6 && !sel.includes(ic)) continue;
    for (const [kind, list] of [['SID', SIDS[ic]], ['STAR', STARS[ic]]]) {
      if (!list) continue; const rw = rwyFor(ic, list, S.wdir); const col = kind === 'SID' ? '#e9a23b' : '#4fb3ff';
      const seen = new Set();
      for (const r of list) {
        if (r[0] !== rw) continue; const names = procPts(r); if (names.length < 2) continue;
        let pts = names.map(n => [FIXP[n][0], FIXP[n][1], n]);
        if (kind === 'SID') { const T = RWYS[ic] && RWYS[ic][rw]; if (T) pts = [[T[0], T[1], null], [T[3], T[4], null], ...pts]; else pts = [[A[0], A[1], null], ...pts]; }
        else { const T = RWYS[ic] && RWYS[ic][rw]; if (T && !pts.some(p => /^(CF|FI|FF)/.test(p[2]))) pts = [...pts, [T[0], T[1], null]]; }
        const path = AW.flyPath(pts, R);
        cx.strokeStyle = col; cx.globalAlpha = .75; cx.lineWidth = 1.4; cx.setLineDash(kind === 'SID' ? [] : [6, 4]); cx.beginPath();
        path.forEach((q, i) => { const [X, Y] = SXY(q[0], q[1]); i ? cx.lineTo(X, Y) : cx.moveTo(X, Y); }); cx.stroke(); cx.setLineDash([]);
        const e = kind === 'SID' ? pts[pts.length - 1] : pts[0]; if (seen.has(r[1])) continue; seen.add(r[1]);
        const [X, Y] = SXY(e[0], e[1]); cx.globalAlpha = 1; cx.fillStyle = col; cx.fillText(r[1], X + 5, Y + (kind === 'SID' ? -5 : 11));
      }
    }
  }
  cx.restore();
}
function drawWeather(){
  cx.save();
  for (const cb of S.cbs) {
    const [X, Y] = SXY(cb.la, cb.lo), r = cb.r*V.scale;
    const g = cx.createRadialGradient(X, Y, r*0.2, X, Y, r); g.addColorStop(0, C.name === 'dark' ? 'rgba(255,90,90,.32)' : 'rgba(214,45,45,.30)'); g.addColorStop(1, 'rgba(214,45,45,0)');
    cx.fillStyle = g; cx.beginPath(); cx.arc(X, Y, r, 0, 7); cx.fill();
    cx.strokeStyle = C.cbEdge; cx.setLineDash([4, 3]); cx.lineWidth = 1.2; cx.beginPath(); cx.arc(X, Y, r, 0, 7); cx.stroke(); cx.setLineDash([]);
    cx.font = `600 11px ${FONT_D}`; cx.fillStyle = C.conf; cx.fillText(`CB ${FLs(cb.top)}`, X + r*0.7, Y - r*0.7);
  }
  for (const T of S.turb) { const [X, Y] = SXY(T.la, T.lon), r = T.r*V.scale; cx.strokeStyle = C.turb; cx.setLineDash([2, 4]); cx.lineWidth = 1.4; cx.beginPath(); cx.arc(X, Y, r, 0, 7); cx.stroke(); cx.setLineDash([]); cx.font = `500 11px ${FONT_D}`; cx.fillStyle = C.turb; cx.fillText(`MOD TURB ${FLs(T.lo)}-${FLs(T.hi)}`, X - r*0.5, Y - r - 4); }
  cx.restore();
}
// the plane icon: the type's outline (shapes.js), or a plain one for traffic that isn't yours
function planeIcon(X, Y, hdg, col, sel, type){
  if (!type || typeof acShape !== 'function') return basicPlane(X, Y, hdg, col, sel);
  const fam = acFam(type), F = AC_FAM[fam], sh = acShape(type, F.ref[0], F.ref[1]);
  drawShape(sh, X, Y, hdg, 17*(AC_ICON_K[fam] || 1)/sh.size, col, { line: sel ? (C.name === 'dark' ? '#ffffff' : '#0c1b2e') : 'rgba(20,24,30,.55)', lw: sel ? 1.8 : 0.8 });
}
function basicPlane(X, Y, hdg, col, sel){
  cx.save(); cx.translate(X, Y); cx.rotate(hdg*D2R); const k = 0.8; cx.beginPath();
  cx.moveTo(0, -9*k); cx.quadraticCurveTo(1.6*k, -8*k, 1.6*k, -5*k); cx.lineTo(1.6*k, -2*k); cx.lineTo(9*k, 2*k); cx.lineTo(9*k, 3.6*k); cx.lineTo(1.6*k, 1.6*k);
  cx.lineTo(1.4*k, 6*k); cx.lineTo(4*k, 8*k); cx.lineTo(4*k, 9.2*k); cx.lineTo(0, 8.2*k); cx.lineTo(-4*k, 9.2*k); cx.lineTo(-4*k, 8*k); cx.lineTo(-1.4*k, 6*k);
  cx.lineTo(-1.6*k, 1.6*k); cx.lineTo(-9*k, 3.6*k); cx.lineTo(-9*k, 2*k); cx.lineTo(-1.6*k, -2*k); cx.lineTo(-1.6*k, -5*k); cx.quadraticCurveTo(-1.6*k, -8*k, 0, -9*k); cx.closePath();
  cx.fillStyle = col; cx.strokeStyle = sel ? '#0c1b2e' : 'rgba(30,40,55,.45)'; cx.lineWidth = sel ? 1.6 : .8; cx.fill(); cx.stroke(); cx.restore();
}
// what kind of flight it is for its colour: a UK arrival (amber), a UK departure (blue), an overflight (dark slate)
const kindOf = ac => arrivesHere(ac) && /^E[GI]/.test(ac.arr) && (distToGo(ac) < 260 || !(/^E[GI]/.test(ac.dep || ''))) ? 'ARR' : /^E[GI]/.test(ac.dep || '') && ac.dep && APS[ac.dep] && nm(ac.la, ac.lo, ...apLL(ac.dep)) < 260 ? 'DEP' : 'OVF';
function acColour(ac){
  if (inConflict(ac) || (ac.emg && ac.emg.kind !== 'FUEL')) return C.conf;
  if (ac.st === 'XFER') return C.off;
  if (!ac.mine && ac.st !== 'OFFER') return C.ghost;
  const k = kindOf(ac); return k === 'ARR' ? C.arr : k === 'DEP' ? C.dep : C.ovf;
}
const TAGS = new Map();   // where each data block was drawn, for clicks
function drawAircraft(){
  TAGS.clear();
  // traffic that isn't yours first, underneath
  for (const g of liveGhosts()) {
    if (!inView(g.la, g.lo)) continue; const [X, Y] = SXY(g.la, g.lo);
    basicPlane(X, Y, g.trk, C.ghost, false);
    if (V.scale > 5) { cx.font = `500 10.5px ${FONT_D}`; cx.fillStyle = C.ghostTxt; cx.fillText(`${g.cs}`, X + 10, Y - 6); cx.fillText(`${FLs(g.alt)} ${String(Math.round(g.gs/10)).padStart(2, '0')}`, X + 10, Y + 6); }
  }
  const list = S.acs.filter(a => a.st !== 'OUT').sort((a, b) => (a.mine ? 2 : a.st === 'OFFER' ? 1 : 0) - (b.mine ? 2 : b.st === 'OFFER' ? 1 : 0));
  for (const ac of list) {
    if (!inView(ac.la, ac.lo, 80)) continue;
    const [X, Y] = SXY(ac.la, ac.lo), sel = S.sel === ac, col = acColour(ac), mine = ac.mine || ac.st === 'OFFER' || ac.st === 'XFER';
    // a short history behind every flight of yours
    if (mine && UI.routes !== 'off' && !sel) { const T = ac.track.slice(-4); cx.save(); cx.strokeStyle = col; cx.globalAlpha = .5; cx.lineWidth = 2; cx.lineCap = 'round'; cx.beginPath(); T.forEach((p, i) => { const [x, y] = SXY(p[0], p[1]); i ? cx.lineTo(x, y) : cx.moveTo(x, y); }); cx.lineTo(X, Y); cx.stroke(); cx.restore(); }
    if (ac.mode === 'HOLD' && ac.hold && (mine || V.scale > 3)) drawHold(ac, col);
    planeIcon(X, Y, ac.hdg, col, sel, mine ? ac.t : null);
    if (sel) { cx.strokeStyle = C.sel; cx.lineWidth = 1.5; cx.beginPath(); cx.arc(X, Y, 15, 0, 7); cx.stroke(); }
    if (!mine && V.scale < 5 && !sel) continue;
    drawTag(ac, X, Y, col, mine, sel);
  }
}
function drawHold(ac, col){
  const h = ac.hold, leg = (ac.alt > 14000 ? 1.5 : 1)*ac.gs/60, r = ac.tas/3600/(turnRate(ac)*D2R), dir = h.left ? -1 : 1;
  const fix = h.c, outH = norm(h.inb + 180), side = norm(h.inb + 90*dir);
  const a = fix, b = moveLL(...fix, outH, leg), c = moveLL(...b, side, 2*r), d = moveLL(...fix, side, 2*r);
  cx.save(); cx.strokeStyle = col; cx.globalAlpha = .55; cx.lineWidth = 1.2; cx.setLineDash([4, 3]);
  cx.beginPath(); for (const [i, p] of [a, b, c, d, a].entries()) { const [X, Y] = SXY(p[0], p[1]); i ? cx.lineTo(X, Y) : cx.moveTo(X, Y); } cx.stroke(); cx.restore();
}
function drawTag(ac, X, Y, col, mine, sel){
  const trend = ac.vs > 300 ? '↑' : ac.vs < -300 ? '↓' : Math.abs(ac.cfl - ac.alt) > 200 ? (ac.cfl > ac.alt ? '↑' : '↓') : ' ';
  const l1 = ac.cs + (ac.need && ac.mine ? ' ◆' : '') + (ac.emg ? ` ${ac.sq}` : '');
  const l2 = `${FLs(ac.alt)}${trend}${Math.abs(ac.cfl - ac.alt) > 200 || trend !== ' ' ? FLs(ac.cfl) : '   '} ${String(Math.round(ac.gs/10)).padStart(2, '0')}`;
  let l3 = `${ac.t} ${ac.arr || ''}`;
  if (ac.st === 'OFFER') l3 = `${UNIT_SHORT(ac.from)} ${ac.accepted ? 'ACC' : 'OFFER'}`;
  else if (ac.st === 'XFER') l3 = `XFR ${UNIT_SHORT(ac.owner)}`;
  else if (ac.mine && ac.xferDue && ac.exit) l3 = `› ${UNIT_SHORT(ac.exit.code)} ${ac.t}`;
  else if (ac.mode === 'HOLD') l3 = `HOLD ${ac.hold.fix || 'PP'}`;
  cx.font = `${mine ? 600 : 500} 11.5px ${FONT_D}`;
  const w = Math.max(...[l1, l2, l3].map(t => cx.measureText(t).width));
  // the label goes where it covers no other label: up right, down right, up left, down left
  const cand = [[16, -26], [16, 22], [-w - 18, -26], [-w - 18, 22]], hit = (x, y) => { for (const r of TAGS.values()) if (x - 4 < r[0] + r[2] && x + w + 4 > r[0] && y - 11 < r[1] + r[3] && y + 30 > r[1]) return true; return false; };
  let [ox, oy] = ac.tagO || cand.find(([a, b]) => !hit(X + a, Y + b)) || cand[0];
  const lx = X + ox, ly = Y + oy;
  cx.strokeStyle = col; cx.globalAlpha = .55; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(X + Math.sign(ox)*8, Y + Math.sign(oy)*6); cx.lineTo(lx - 2, ly + 14); cx.stroke(); cx.globalAlpha = 1;
  cx.fillStyle = C.tagBg; cx.fillRect(lx - 4, ly - 11, w + 8, 41);
  if (mine) { cx.strokeStyle = sel ? C.sel : ac.st === 'OFFER' ? C.offer : col; cx.lineWidth = sel ? 1.6 : 1; if (ac.st === 'OFFER' && !ac.accepted) cx.setLineDash([4, 3]); cx.strokeRect(lx - 4.5, ly - 11.5, w + 9, 42); cx.setLineDash([]); }
  cx.fillStyle = ac.mine || ac.st === 'OFFER' ? (C.name === 'dark' ? '#e2ebef' : '#0c1b2e') : C.ghostTxt;
  if (inConflict(ac) || ac.emg) cx.fillStyle = C.conf;
  cx.fillText(l1, lx, ly); cx.font = `500 11.5px ${FONT_D}`; cx.fillText(l2, lx, ly + 13); cx.fillText(l3, lx, ly + 26);
  TAGS.set(ac, [lx - 4, ly - 11, w + 8, 41]);
}
// the selected flight: the track it has flown (solid, by altitude) and its route ahead (faint dashes) with fix ETAs
function drawSelRoute(ac, labels){
  // the route ahead is drawn as it will be flown: the leg it is on is anchored where it was joined (so the line does not
  // swing with the aircraft), the corners are fly-by arcs at its turn radius, a hold is its racetrack
  const here = [ac.la, ac.lo, null], R = AW.turnRadius(Math.max(160, ac.tas), 25);
  let pts = [here], hold = null;
  if (ac.mode === 'NAV') {
    const next = ac.route[ac.ri];
    // the leg's anchor: only while the aircraft is still on that leg and near its line
    if (next && ac.legTo === next && ac.legFrom && AW.gcNM(ac.legFrom, next) > 4) { const X = AW.xtk([ac.la, ac.lo], ac.legFrom, next); if (Math.abs(X.xte) < 1.5) pts = [[ac.legFrom[0], ac.legFrom[1], null], here]; }
    for (let i = ac.ri; i < ac.route.length; i++) pts.push(ac.route[i]);
  }
  else if (ac.mode === 'HDG') pts.push(moveLL(ac.la, ac.lo, ac.tgtHdg ?? ac.hdg, 60));
  else if (ac.mode === 'HOLD') { pts.push(ac.hold.c); hold = AW.holdPath(ac.hold.c, ac.hold.inb, ac.hold.left, Math.max(220, ac.tas), (ac.alt > 14000 ? 1.5 : 1)*Math.max(220, ac.tas)/60); }
  const anch = pts.length > 2 && pts[1] === here ? 1 : 0;   // when the first point is the anchor, the path starts at the aircraft
  const path = pts.length > 2 ? AW.flyPath(pts, R) : pts;
  const drawn = anch ? path.filter((q, k) => k === 0 || true) : path;
  cx.save(); cx.lineJoin = cx.lineCap = 'round'; cx.strokeStyle = C.pv; cx.lineWidth = 2.2; cx.globalAlpha = .55; cx.setLineDash([8, 6]);
  cx.beginPath();
  let prev = null, started = !anch;
  // skip the part of the path behind the aircraft (between the anchor and its position)
  const skipTo = anch ? drawn.findIndex(q => q[2] >= 1) : 0;
  drawn.forEach((p, i) => {
    if (anch && i < skipTo) return;
    if (prev && gcNM(prev, p) > 60) { const n = Math.ceil(gcNM(prev, p)/40); for (let k = 1; k < n; k++) { const q = gcAt(prev, p, k/n); const [X, Y] = SXY(q[0], q[1]); cx.lineTo(X, Y); } }
    const [X, Y] = SXY(p[0], p[1]); (prev ? cx.lineTo(X, Y) : cx.moveTo(X, Y)); prev = p;
  });
  if (hold) { const h0 = SXY(hold[0][0], hold[0][1]); cx.moveTo(h0[0], h0[1]); for (const q of hold) { const [X, Y] = SXY(q[0], q[1]); cx.lineTo(X, Y); } }
  cx.stroke(); cx.setLineDash([]); cx.globalAlpha = 1;
  if (labels && ac.mode === 'NAV') {
    cx.font = `700 11px ${FONT_D}`; let n = 0;
    for (let i = ac.ri; i < ac.route.length && n < 8; i++) {
      const p = ac.route[i]; if (!p[2] || !inView(p[0], p[1], 0)) continue; n++;
      const [X, Y] = SXY(p[0], p[1]);
      cx.fillStyle = C.name === 'dark' ? '#04121a' : '#ffffff'; cx.strokeStyle = C.pv; cx.lineWidth = 2; cx.globalAlpha = .6; cx.beginPath(); cx.arc(X, Y, 4.5, 0, 7); cx.fill(); cx.stroke(); cx.globalAlpha = 1;
      const t = `${p[2]} ${zHM(S.start + etaTo(ac, i)*1000)}`, w = cx.measureText(t).width;
      cx.fillStyle = C.tagBg; cx.fillRect(X + 7, Y + 4, w + 6, 15); cx.fillStyle = C.name === 'dark' ? '#6ef0a8' : '#1749cc'; cx.fillText(t, X + 10, Y + 15);
    }
  }
  cx.restore();
  // behind it: from its origin (solid, shaded by level) to where it is now
  if (labels) drawTrackLine([...(ac.past || []), ...ac.track, [ac.la, ac.lo, ac.alt]]);
}
function drawTrackLine(T){
  if (!T || T.length < 2) return;
  const NB = 14, band = p => 1 + Math.min(NB - 2, Math.floor(Math.sqrt(Math.max(0, p[2])/40000)*(NB - 1)));
  const col = b => `hsl(${Math.round(35 + (b - 1)/(NB - 2)*195)},${85 - (b - 1)*2}%,${58 - (b - 1)*2}%)`;
  cx.save(); cx.lineWidth = 2.6; cx.lineJoin = cx.lineCap = 'round'; cx.globalAlpha = .9;
  for (let b = 0; b < NB; b++) {
    cx.beginPath(); let on = false;
    for (let i = 1; i < T.length; i++) { const p = T[i], q = T[i - 1]; if (band(p) !== b) { on = false; continue; }
      if (!on) { const [X, Y] = SXY(q[0], q[1]); cx.moveTo(X, Y); on = true; } const [X, Y] = SXY(p[0], p[1]); cx.lineTo(X, Y); }
    cx.strokeStyle = col(b); cx.stroke();
  }
  cx.restore();
}
function drawConflicts(){
  const P = S.pairs; if (!P) return;
  cx.save();
  for (const [kind, list] of [['STCA', P.stca], ['LOSS', P.los]]) for (const [a, b] of list) {
    if (!S.acs.includes(a) && !a.ghost || !S.acs.includes(b) && !b.ghost) continue;
    const [X1, Y1] = SXY(a.la, a.lo), [X2, Y2] = SXY(b.la, b.lo);
    cx.strokeStyle = C.conf; cx.lineWidth = 1.6; cx.setLineDash([5, 4]); cx.beginPath(); cx.moveTo(X1, Y1); cx.lineTo(X2, Y2); cx.stroke(); cx.setLineDash([]);
    for (const [X, Y] of [[X1, Y1], [X2, Y2]]) { cx.beginPath(); cx.arc(X, Y, 5*V.scale/2 + 6, 0, 7); cx.stroke(); }
    const d = nm(a.la, a.lo, b.la, b.lo); cx.font = `700 11px ${FONT_D}`; cx.fillStyle = C.conf; cx.fillText(`${kind} ${d.toFixed(1)} NM ${Math.round(Math.abs(a.alt - b.alt)/100)*100} FT`, (X1 + X2)/2 + 8, (Y1 + Y2)/2 - 8);
  }
  cx.restore();
}
function drawScale(){
  const nmBar = [5, 10, 20, 50, 100].find(n => n*V.scale > 60) || 100, px = nmBar*V.scale;
  cx.save(); cx.strokeStyle = C.name === 'dark' ? '#9fb3c8' : '#3a4a5e'; cx.lineWidth = 1.2; const X = 16, Y = H - 44;
  cx.beginPath(); cx.moveTo(X, Y - 4); cx.lineTo(X, Y); cx.lineTo(X + px, Y); cx.lineTo(X + px, Y - 4); cx.stroke();
  cx.font = `500 11px ${FONT_D}`; cx.fillStyle = cx.strokeStyle; cx.fillText(`${nmBar} NM`, X + px/2 - 14, Y - 6); cx.restore();
}
function draw(){
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  cx.fillStyle = C.sea; cx.fillRect(0, 0, W, H);
  if (typeof drawImagery === 'function' && !TILE.failed) { drawImagery(); cx.fillStyle = C.wash; cx.fillRect(0, 0, W, H); }
  drawNeighbours(); drawMine(); drawAirways(); drawProcs(); drawWeather();
  if (UI.routes === 'all') for (const ac of S.acs) if (ac.mine && ac !== S.sel) drawSelRoute(ac, false);
  if (S.sel && UI.routes !== 'off' && S.acs.includes(S.sel)) drawSelRoute(S.sel, true);
  drawConflicts(); drawAircraft(); drawScale();
  if (typeof drawImageryCredit === 'function' && !TILE.failed) drawImageryCredit();
}

// ── panels ──
const seatName = () => SEAT.name;
function renderInfo(){
  const mine = S.acs.filter(a => a.mine), off = S.acs.filter(a => a.st === 'OFFER'), soon = S.acs.filter(a => a.st === 'AI' && !a.ghost).length;
  const u = unitOf(ME), W30 = windAt(30000);
  const ev = [];
  for (const [ic, A] of Object.entries(S.airports)) {
    const held = S.acs.filter(a => a.arr === ic && a.mode === 'HOLD').length;
    ev.push(A.closed ? `<div class="ev bad"><b>${ic}</b> ${esc(apName(ic))} closed: ${esc(A.why)}, until about ${zHM(S.start + A.until*1000)}Z</div>`
      : `<div class="ev"><b>${ic}</b> ${esc(apName(ic))}: ${A.delay} min delays, ${esc(A.why)}${held ? `, ${held} holding` : ''}. One arrival every ${(A.slotGap/60).toFixed(1)} min.</div>`);
  }
  for (const R of S.flowRegs) ev.push(`<div class="ev"><b>${esc(UNIT_SHORT(R.code))}</b> ${R.mit ? `one every ${Math.round(R.mit/60)} min` : ''}${R.mit && R.cap ? ', ' : ''}${R.cap ? `FL${FLs(R.cap)} max` : ''} until ${zHM(S.start + R.until*1000)}Z · ${esc(R.why)}</div>`);
  if (S.cbs.length) ev.push(`<div class="ev">Thunderstorms: ${S.cbs.length} cell${S.cbs.length > 1 ? 's' : ''}, tops to FL${FLs(Math.max(...S.cbs.map(c => c.top)))}</div>`);
  for (const T of S.turb) ev.push(`<div class="ev">Moderate turbulence FL${FLs(T.lo)}–${FLs(T.hi)}</div>`);
  $('secInfo').innerHTML = `<div class="secrow"><span class="nm">${esc(SEAT.short)}</span><span class="fq">${esc(u.cs)} · ${esc(u.freq)}</span></div>
    <div class="tiles"><div class="tile"><div class="lbl">Yours</div><div class="v">${mine.length}<small>+${off.length} offered</small></div></div>
    <div class="tile"><div class="lbl">Levels</div><div class="v">${MYLO ? 'FL' + FLs(MYLO*100) : 'SFC'}–${FLs(MYHI*100)}</div></div>
    <div class="tile"><div class="lbl">Wind FL300</div><div class="v">${hdg3(W30.dir)}/${Math.round(W30.kt)}</div></div></div>
    ${ev.length ? `<div class="events">${ev.join('')}</div>` : ''}
    ${/live/.test(S.mode) ? `<div class="warnline" style="color:var(--dim)">${LIVE.ok ? `Live: ${LIVE.ac.size} aircraft in the feed${LIVE.src ? ' (' + esc(LIVE.src) + ')' : ''}` : 'Connecting to the live traffic feed…'}</div>` : ''}`;
}
function renderCoord(){
  $('coordBox').innerHTML = `<div class="ph"><span class="lbl">Coordination</span><span class="grow"></span><span class="lbl dimmer">landline</span></div>` +
    (S.coord.length ? S.coord.slice(0, 6).map((c, i) => `<div class="co ${c.kind}"><span class="tm">${zHM(S.start + c.t*1000)}</span><b class="who">${esc(UNIT_SHORT(c.code))}</b>${esc(c.text)}${c.ac && c.ac.st === 'OFFER' && !c.ac.accepted ? ` <button data-acc="${esc(c.ac.cs)}">Accept</button>` : ''}</div>`).join('')
      : '<p class="dimmer" style="font-size:12px;margin:6px 0 0">Calls from the units next door appear here.</p>');
  $('coordBox').querySelectorAll('[data-acc]').forEach(b => b.onclick = () => command(`${b.dataset.acc} ACC`));
}
function stateText(ac){
  return { OFFER: ac.accepted ? 'ACCEPTED' : 'OFFERED', CALL: 'CHECKING IN', MINE: ac.mode === 'HOLD' ? 'HOLDING' : ac.vs > 300 ? 'CLIMBING' : ac.vs < -300 ? 'DESCENDING' : 'LEVEL', XFER: 'TRANSFERRED', AI: 'NOT YOURS' }[ac.st] || ac.st;
}
function renderSel(){
  const ac = S.sel, el = $('sel');
  el.classList.toggle('empty', !ac || !S.acs.includes(ac));
  if (!ac || !S.acs.includes(ac)) { el.innerHTML = '<span class="lbl">Selected flight</span><p class="dimmer" style="margin:6px 0 0;font-size:12.5px">Click an aircraft or a strip. Your flights have the type’s shape and a framed label; grey ones belong to other units.</p>'; return; }
  const k = kindOf(ac), X = ac.exit, ahead = ac.route.slice(ac.ri).filter(p => p[2]).slice(0, 7).map(p => p[2]);
  const nxt = ac.route.slice(ac.ri).filter(p => p[2] && FIXP[p[2]]).slice(0, 14).map(p => p[2]);
  const ag = X && X.from && X.to ? agreementFor(ac, X.from, X.to) : null;
  el.innerHTML = `<div class="sel-head"><span class="cs ${k}">${esc(ac.cs)}</span><span class="state ${ac.st}">${stateText(ac)}</span>${ac.emg ? `<span class="state" style="color:var(--alert)">${ac.emg.kind === 'NORDO' ? 'RADIO FAILURE' : 'EMERGENCY'} ${ac.sq}</span>` : ''}</div>
    <div class="dimmer" style="margin-top:6px;font-size:12.5px">${esc(ac.t)} · ${esc(ac.dep || '?')} → ${esc(ac.arr || '?')}${ac.real ? ` · real ${esc(ac.real)}` : ''}${ac.src === 'live' ? ' · live' : ''} · sq ${ac.sq}</div>
    ${ac.need && ac.mine ? `<div class="needline">◆ ${esc(ac.need)}</div>` : ''}
    <div class="tiles" style="grid-template-columns:repeat(4,minmax(0,1fr))">
      <div class="tile"><div class="lbl">FL</div><div class="v">${FLs(ac.alt)}</div></div>
      <div class="tile"><div class="lbl">Cleared</div><div class="v">${FLs(ac.cfl)}</div></div>
      <div class="tile"><div class="lbl">Requested</div><div class="v">${FLs(ac.rfl)}</div></div>
      <div class="tile"><div class="lbl">${ac.alt > 24500 ? 'Mach' : 'IAS'}</div><div class="v">${ac.alt > 24500 ? '.' + Math.round(machOf(ac.tas, ac.alt)*100) : Math.round(iasOf(ac))}${ac.spd ? '<small>set</small>' : ''}</div></div>
      <div class="tile"><div class="lbl">Heading</div><div class="v">${hdg3(ac.hdg)}${ac.mode === 'HDG' ? '<small>vect</small>' : ''}</div></div>
      <div class="tile"><div class="lbl">GS</div><div class="v">${Math.round(ac.gs)}</div></div>
      <div class="tile"><div class="lbl">Next</div><div class="v">${X ? esc(UNIT_SHORT(X.code)) : '—'}</div></div>
      <div class="tile"><div class="lbl">Exit</div><div class="v">${X ? Math.max(0, Math.round((X.t - S.t)/60)) + '<small>min</small>' : '—'}</div></div>
    </div>
    ${ag && (ag.des || ag.clb) ? `<div class="warnline" style="color:var(--ink-2)">Agreement with ${esc(UNIT_SHORT(X.code))}: ${ag.des ? `descending FL${String(ag.des).padStart(3, '0')}` : `climbing FL${String(ag.clb).padStart(3, '0')}`}${ag.fix !== '*' ? ' by ' + esc(ag.fix) : ''}</div>` : ''}
    <div class="route">${ac.mode === 'HOLD' ? `Holding at <b>${esc(ac.hold.fix || 'present position')}</b>, ${ac.hold.left ? 'left' : 'right'} hand, ${Math.round((S.t - ac.hold.since)/60)} min` : ac.mode === 'HDG' ? `Heading <b>${hdg3(ac.tgtHdg ?? ac.hdg)}</b>` : 'Route'} · ${ahead.map((n, i) => i ? esc(n) : `<b>${esc(n)}</b>`).join(' ')} ${ac.star ? '· ' + esc(ac.star) : ''}</div>
    ${ac.mine ? `<div class="lvrow"><button data-c="lv-20">−20</button><button data-c="lv-10">−10</button><input id="iLv" value="${FLs(ac.cfl)}" aria-label="Cleared level" inputmode="numeric"><button data-c="lv+10">+10</button><button data-c="lv+20">+20</button><button data-c="lvset" class="go">Level</button>${ac.rfl !== ac.cfl ? `<button data-c="rfl">FL${FLs(ac.rfl)}</button>` : ''}</div>
    <div class="acts">
      <select id="iDct" aria-label="Direct to"><option value="">Direct to…</option>${nxt.map(n => `<option>${n}</option>`).join('')}</select>
      <select id="iHold" aria-label="Hold at"><option value="">Hold at…</option>${(ac.holdFix && !nxt.includes(ac.holdFix) ? [ac.holdFix] : []).concat(nxt).map(n => `<option>${n}</option>`).join('')}<option value="PP">present position</option></select>
      <select id="iSpd" aria-label="Speed"><option value="">Speed…</option>${['M84', 'M82', 'M80', 'M78', 'M76', 'M74', 'S300', 'S280', 'S250', 'SN'].map(s => `<option>${s}</option>`).join('')}</select>
      <button data-c="hdg-10">◀ 10°</button><button data-c="hdg+10">10° ▶</button><button data-c="RES">Own nav</button>
      ${ac.need && ac.need !== 'Check-in' ? '<button data-c="UNABLE">Unable</button>' : ''}${ac.st === 'CALL' ? '<button data-c="ID" class="go">Identified</button>' : ''}
      ${ac.divAsk || (ac.emg && ac.emg.to) ? `<button data-c="DIV ${ac.divAsk || ac.emg.to}">Divert ${ac.divAsk || ac.emg.to}</button>` : ''}
      <button data-c="XFR" class="go"${X ? '' : ' disabled'}>Transfer${X ? ' to ' + esc(UNIT_SHORT(X.code)) : ''} ›</button>
    </div>` : ac.st === 'OFFER' ? `<div class="acts">${ac.accepted ? '<span class="dimmer" style="font-size:12.5px">Accepted. It calls you about a minute before your boundary.</span>' : '<button data-c="ACC" class="go">Accept from ' + esc(UNIT_SHORT(ac.from)) + '</button>'}</div>` : ''}`;
  el.querySelectorAll('[data-c]').forEach(b => b.onclick = () => {
    const c = b.dataset.c;
    if (c.startsWith('lv')) { if (c === 'lvset') return command(`${ac.cs} ${+$('iLv').value >= 0 ? (+$('iLv').value*100 > ac.alt ? 'C' : 'D') + String(+$('iLv').value).padStart(3, '0') : ''}`); const v = clamp(+$('iLv').value + +c.slice(2), 50, 450); $('iLv').value = FLs(v*100); return; }
    if (c === 'rfl') return command(`${ac.cs} C${FLs(ac.rfl)}`);
    if (c.startsWith('hdg')) return command(`${ac.cs} H${hdg3(norm((ac.tgtHdg ?? ac.hdg) + +c.slice(3)))}`);
    command(`${ac.cs} ${c}`);
  });
  const dct = $('iDct'); if (dct) dct.onchange = () => dct.value && command(`${ac.cs} DCT ${dct.value}`);
  const hl = $('iHold'); if (hl) hl.onchange = () => hl.value && command(`${ac.cs} HOLD${hl.value === 'PP' ? '' : ' ' + hl.value}`);
  const sp = $('iSpd'); if (sp) sp.onchange = () => sp.value && command(`${ac.cs} ${sp.value}`);
  const lv = $('iLv'); if (lv) lv.onkeydown = e => { if (e.key === 'Enter') el.querySelector('[data-c="lvset"]').click(); };
}
function stripOf(ac){
  const k = ac.st === 'OFFER' ? 'OFFER' : ac.st === 'XFER' ? 'XFER' : '', kind = kindOf(ac), X = ac.exit;
  let stt = '', cls = '';
  if (ac.st === 'OFFER') { stt = ac.accepted ? `${UNIT_SHORT(ac.from)} · in ${Math.max(0, Math.round((ac.entryEta - S.t)/60))} min` : `◆ Accept from ${UNIT_SHORT(ac.from)}`; cls = ac.accepted ? '' : 'due'; }
  else if (ac.st === 'XFER') stt = `→ ${UNIT_SHORT(ac.owner)}`;
  else if (ac.need) { stt = '◆ ' + ac.need; cls = 'bad'; }
  else if (ac.xferDue && X) { stt = `Transfer to ${UNIT_SHORT(X.code)}`; cls = 'due'; }
  else if (ac.mode === 'HOLD') stt = `Holding ${ac.hold.fix || 'PP'}`;
  else stt = `${FLs(ac.cfl)}${X ? ' · ' + UNIT_SHORT(X.code) : ''}`;
  const np = ac.route.slice(ac.ri).find(p => p[2] && FIXP[p[2]]);
  return `<button class="strip ${kind} ${k}${ac.need && ac.mine ? ' need' : ''}${inConflict(ac) ? ' conf' : ''}${S.sel === ac ? ' sel' : ''}" data-cs="${esc(ac.cs)}"><span class="bar"></span>
    <span><span class="cs">${esc(ac.cs)}</span><span class="ty">${esc(ac.t)} · ${FLs(ac.alt)}${ac.vs > 300 ? '↑' : ac.vs < -300 ? '↓' : ' '}${FLs(ac.cfl)}</span></span>
    <span class="c-a"><span class="rte">${esc(ac.dep || '—')} › ${esc(ac.arr || '—')}</span><span class="lv">${np ? esc(np[2]) + ' ' + zHM(S.start + etaTo(ac, ac.route.indexOf(np))*1000) : ''}</span></span>
    <span><span class="stt ${cls}">${esc(stt)}</span></span></button>`;
}
function renderStrips(){
  const need = S.acs.filter(a => a.mine && (a.need || a.xferDue) || a.st === 'OFFER' && !a.accepted);
  const mine = S.acs.filter(a => a.mine && !need.includes(a)), offer = S.acs.filter(a => a.st === 'OFFER' && a.accepted && !need.includes(a)).sort((a, b) => a.entryEta - b.entryEta);
  const done = S.acs.filter(a => a.st === 'XFER').sort((a, b) => b.xferT - a.xferT).slice(0, 4);
  const grp = (t, l) => l.length ? `<div class="stripgrp">${t} · ${l.length}</div>` + l.map(stripOf).join('') : '';
  $('strips').innerHTML = grp('Waiting on you', need) + grp('In your sector', mine) + grp('Inbound, accepted', offer) + grp('Transferred', done) || '<p class="dimmer" style="font-size:12.5px;padding:8px">No traffic yet.</p>';
  $('stripCount').textContent = `${S.acs.filter(a => a.mine).length} yours · ${S.acs.filter(a => a.st === 'OFFER').length} inbound`;
  $('strips').querySelectorAll('.strip').forEach(b => b.onclick = () => { const ac = S.acs.find(a => a.cs === b.dataset.cs); if (!ac) return; if (ac.st === 'OFFER' && !ac.accepted) command(`${ac.cs} ACC`); select(ac, true); });
}
function renderLog(){
  const el = $('log'), at = el.scrollTop + el.clientHeight > el.scrollHeight - 30;
  el.innerHTML = S.log.slice(-120).map(l => `<div class="ln ${l.cls.split(' ')[0] === 'atc' ? 'atc' : l.cls}"><span class="tm">${zHM(S.start + l.t*1000)}</span><span class="who">${esc(l.who)}</span><span class="tx">${esc(l.text)}</span></div>`).join('');
  if (at) el.scrollTop = el.scrollHeight;
}
function renderHud(){
  const st = S.stats;
  $('score').innerHTML = `<span><b>${S.score}</b> pts</span><span>Yours <b>${S.acs.filter(a => a.mine).length}</b></span><span>Handed <b>${st.handed || 0}</b></span><span class="${st.los ? 'bad' : ''}">LoS <b>${st.los || 0}</b></span><span class="${S.stca.size ? 'bad' : ''}">STCA <b>${S.stca.size}</b></span><span>Holds <b>${st.holds || 0}</b></span><span>Div <b>${st.div || 0}</b></span><span>Emg <b>${st.emg || 0}</b></span>`;
  const ms = simMs(); $('clock').textContent = zHMS(ms) + 'Z';
  { const t = zHMS(ms), c = $('sbClock'), h = `${t.slice(0, 5)}<span class="sb-s">${t.slice(5)}</span><small>Z</small>`; if (c && c.dataset.t !== t) { c.dataset.t = t; c.innerHTML = h; } }
  { const u = unitOf(ME), W30 = windAt(30000), mine = S.acs.filter(a => a.mine).length, need = S.acs.filter(a => a.mine && a.need || a.st === 'OFFER' && !a.accepted).length;
    const cell = (l, v, c = '') => `<span class="sb-c ${c}"><i>${l}</i>${v}</span>`;
    const h = cell('FREQ', esc(u.freq)) + cell('LEVELS', `${MYLO ? FLs(MYLO*100) : 'SFC'}–${FLs(MYHI*100)}`) + cell('WIND FL300', `${hdg3(W30.dir)}/${Math.round(W30.kt)}`) + cell('YOURS', mine) + cell('STCA', S.stca.size || 'NIL', S.stca.size ? 'bad' : 'ok');
    const b = $('sbSec'); if (b && b.dataset.h !== h) { b.dataset.h = h; b.innerHTML = h; }
    const m = $('mtNeed'); if (m) { m.hidden = !need; m.textContent = need; } }
  let loc = ''; try { loc = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(ms)); } catch (e) {}
  $('clockz').textContent = `LOCAL ${loc} · ${S.speed}× ${S.paused ? '· PAUSED' : ''}`;
}
function select(ac, centre){
  S.sel = ac; renderSel(); renderStrips();
  if (phoneMQ.matches) { const app = document.querySelector('.app'); if (ac && app.dataset.mtab !== 'flight') setMTab('flight'); else if (!ac && app.dataset.mtab === 'flight') setMTab('map'); }
  if (centre && ac) centreOnAc(ac);
}
// the map goes to a flight, in the middle of the part you can see: beside the flight card, or above the phone's panel
function centreOnAc(ac){
  const p = xy(ac.la, ac.lo), phone = phoneMQ.matches, open = phone && document.querySelector('.app').dataset.mtab !== 'map';
  const tx = phone ? W/2 : (W - 420)/2 + 12, ty = open ? (H*0.54)/2 + 24 : H/2 + 20;
  V.x = p[0] - (tx - W/2)/V.scale; V.y = p[1] - (H/2 - ty)/V.scale;
}
let dirty = { sel: true, strips: true, info: true, coord: true, log: true };
S.listeners.push(ev => {
  if (ev === 'log') dirty.log = true;
  if (ev === 'coord') { dirty.coord = true; dirty.info = true; }
  if (['offer', 'checkin', 'need', 'xfer', 'spawn', 'cmd', 'airport', 'flow', 'cb', 'emg', 'divert', 'los', 'stca'].includes(ev)) { dirty.strips = true; dirty.sel = true; dirty.info = true; }
  if (ev === 'say' || ev === 'need') dirty.strips = true;
});

// ── voice: the crews speak (your own instructions stay in the log) ──
const VOICES = { list: [] };
function loadVoices(){ try { VOICES.list = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang)); } catch (e) {} }
if ('speechSynthesis' in window) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
S.listeners.push((ev, d) => {
  if (ev !== 'say' || !UI.voice || !('speechSynthesis' in window) || S.speed > 2) return;
  const u = new SpeechSynthesisUtterance(d.text.replace(/\bFL(\d{3})\b/g, 'flight level $1'));
  const vs = VOICES.list; if (vs.length) u.voice = vs[d.ac.id % vs.length];
  u.rate = 1.12; u.pitch = 0.85 + (d.ac.id % 5)*0.07; speechSynthesis.speak(u);
});

// ── input ──
let drag = null;
cv.addEventListener('mousedown', e => { drag = { x: e.clientX, y: e.clientY, vx: V.x, vy: V.y, moved: false }; });
window.addEventListener('mousemove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true; V.x = drag.vx - dx/V.scale; V.y = drag.vy + dy/V.scale; });
window.addEventListener('mouseup', e => { if (drag && !drag.moved) clickAt(e); drag = null; });
cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(), X = e.clientX - r.left, Y = e.clientY - r.top, wx = wx2(X), wy = wy2(Y);
  V.scale = clamp(V.scale*Math.exp(-e.deltaY*0.0015), 0.35, 40); V.x = wx - (X - W/2)/V.scale; V.y = wy + (Y - H/2)/V.scale; }, { passive: false });
// touch: one finger pans, two pinch
let touch = null;
const tpos = t => { const r = cv.getBoundingClientRect(); return [t.clientX - r.left, t.clientY - r.top]; };
function touchFrom(list, moved){
  if (list.length >= 2) { const a = tpos(list[0]), b = tpos(list[1]), mx = (a[0] + b[0])/2, my = (a[1] + b[1])/2;
    touch = { pinch: Math.max(10, Math.hypot(a[0] - b[0], a[1] - b[1])), sc: V.scale, wx: wx2(mx), wy: wy2(my), moved: true }; }
  else if (list.length === 1) { const [x, y] = tpos(list[0]); touch = { x, y, vx: V.x, vy: V.y, moved }; }
  else touch = null;
}
cv.addEventListener('touchstart', e => touchFrom(e.touches, e.touches.length > 1), { passive: true });
cv.addEventListener('touchmove', e => {
  if (!touch) return; e.preventDefault();
  if (e.touches.length >= 2) {
    if (!touch.pinch) touchFrom(e.touches, true);
    const a = tpos(e.touches[0]), b = tpos(e.touches[1]), mx = (a[0] + b[0])/2, my = (a[1] + b[1])/2;
    V.scale = clamp(touch.sc*Math.hypot(a[0] - b[0], a[1] - b[1])/touch.pinch, 0.35, 40);
    V.x = touch.wx - (mx - W/2)/V.scale; V.y = touch.wy + (my - H/2)/V.scale;   // the map between the fingers stays there
  } else if (e.touches.length === 1) {
    if (touch.pinch) { touchFrom(e.touches, true); return; }
    const [x, y] = tpos(e.touches[0]), dx = x - touch.x, dy = y - touch.y; if (Math.abs(dx) + Math.abs(dy) > 6) touch.moved = true;
    V.x = touch.vx - dx/V.scale; V.y = touch.vy + dy/V.scale;
  }
}, { passive: false });
cv.addEventListener('touchend', e => {
  if (touch && !touch.pinch && !touch.moved && !e.touches.length) clickAt(e.changedTouches[0]);
  touchFrom(e.touches, true);   // a finger still down carries on from where it is
  if (!e.touches.length) touch = null;
  e.preventDefault();   // no copied mouse click after a tap
});
cv.addEventListener('touchcancel', e => { touchFrom(e.touches, true); if (!e.touches.length) touch = null; });
function clickAt(e){
  const r = cv.getBoundingClientRect(), X = e.clientX - r.left, Y = e.clientY - r.top;
  for (const [ac, [x, y, w, h]] of TAGS) if (X >= x && X <= x + w && Y >= y && Y <= y + h) return select(ac);
  let best = null, bd = 18;
  for (const ac of S.acs) { if (ac.st === 'OUT') continue; const [x, y] = SXY(ac.la, ac.lo), d = Math.hypot(x - X, y - Y); if (d < bd) { bd = d; best = ac; } }
  select(best);
}
$('cmdForm').onsubmit = e => { e.preventDefault(); const v = $('cmd').value.trim(); if (!v) return; command(v); $('cmd').value = ''; };
document.addEventListener('keydown', e => {
  if (!S.running) return;
  const inField = /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
  if (e.key === '/' && !inField) { e.preventDefault(); $('cmd').focus(); }
  else if (e.key === 'Tab' && (document.activeElement === $('cmd') || !inField)) { e.preventDefault(); const l = S.acs.filter(a => a.mine || a.st === 'OFFER'); if (!l.length) return; const i = l.indexOf(S.sel); select(l[(i + (e.shiftKey ? -1 : 1) + l.length) % l.length], true); if (document.activeElement === $('cmd') && !$('cmd').value) $('cmd').value = S.sel.cs + ' '; }
  else if (e.key === ' ' && !inField) { e.preventDefault(); $('tgPause').click(); }
  else if (e.key === 'Escape') { $('disPop').hidden = true; }
});
$('tgPause').onclick = e => { S.paused = !S.paused; e.currentTarget.textContent = S.paused ? 'Resume' : 'Pause'; };
$('tgSpeed').onclick = e => { S.speed = S.speed === 1 ? 2 : S.speed === 2 ? 4 : S.speed === 4 ? 8 : 1; e.currentTarget.textContent = S.speed + '×'; };
document.querySelectorAll('[data-routes]').forEach(b => b.onclick = () => { UI.routes = b.dataset.routes; document.querySelectorAll('[data-routes]').forEach(x => x.classList.toggle('on', x === b)); });
$('tgProc').onclick = e => { UI.proc = !UI.proc; e.currentTarget.classList.toggle('on', UI.proc); };
$('tgAwy').onclick = e => { UI.awy = !UI.awy; e.currentTarget.classList.toggle('on', UI.awy); };
$('tgVoice').onclick = e => { UI.voice = !UI.voice; e.currentTarget.classList.toggle('on', UI.voice); e.currentTarget.setAttribute('aria-pressed', UI.voice); if (!UI.voice && 'speechSynthesis' in window) speechSynthesis.cancel(); };
$('tgFull').onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen && document.documentElement.requestFullscreen(); };
$('tgExit').onclick = () => { stopSession(); location.hash = '#pick'; };
$('viewFL').onchange = e => { UI.viewFL = +e.target.value; };
function applyTheme(t){ Object.assign(C, PAL[t === 'dark' ? 'dark' : 'light']); document.body.classList.add('theme-dark');   // the console is always the night display; the choice is the map's
  document.querySelectorAll('[data-theme-set]').forEach(b => b.classList.toggle('on', b.dataset.themeSet === t)); try { localStorage.setItem('cw-map', t); } catch (e) {} }
document.querySelectorAll('[data-theme-set]').forEach(b => b.onclick = () => applyTheme(b.dataset.themeSet));
try { applyTheme(localStorage.getItem('cw-map') === 'light' ? 'light' : 'dark'); } catch (e) { applyTheme('dark'); }
// disruptions you can set off yourself
$('tgDis').onclick = () => { const p = $('disPop'); p.hidden = !p.hidden; if (!p.hidden) fillDis(); };
function fillDis(){
  const aps = [...new Set(S.acs.filter(a => a.arr && STARS[a.arr]).map(a => a.arr))].sort();
  for (const ic of ['EGLL', 'EGKK', 'EGSS', 'EGGW', 'EGCC', 'EGBB', 'EGPH', 'EGPF', 'EGGD', 'EGLC']) if (!aps.includes(ic) && STARS[ic]) aps.push(ic);
  $('dApt').innerHTML = aps.map(ic => `<option value="${ic}">${ic} ${esc(apName(ic))}</option>`).join('');
  const units = [...new Set(SECS.filter(s => s.own !== ME && !s.ad).map(s => s.own))].filter(c => S.acs.some(a => a.exit && a.exit.code === c) || ['P', 'BR', 'SNE', 'AE', 'TCSE', 'TCSW', 'L'].includes(c));
  $('dUnit').innerHTML = units.map(c => `<option value="${c}">${esc(UNIT_SHORT(c))}</option>`).join('');
  renderDisNow();
}
function renderDisNow(){
  const l = [];
  for (const [ic, A] of Object.entries(S.airports)) l.push(`<div class="${A.closed ? 'b' : 'w'}">${ic}: ${A.closed ? 'closed' : A.delay + ' min delays'} · ${esc(A.why)} <button data-clear="${ic}">End</button></div>`);
  for (const R of S.flowRegs) l.push(`<div class="w">${esc(UNIT_SHORT(R.code))}: ${R.mit ? 'one every ' + Math.round(R.mit/60) + ' min' : 'FL' + FLs(R.cap) + ' max'} <button data-unreg="${R.code}">End</button></div>`);
  if (S.cbs.length) l.push(`<div>${S.cbs.length} thunderstorm cells <button data-nocb="1">Clear</button></div>`);
  $('disNow').innerHTML = l.join('') || '<span class="dimmer">Nothing out of the ordinary.</span>';
  $('disNow').querySelectorAll('[data-clear]').forEach(b => b.onclick = () => { S.airports[b.dataset.clear].until = S.t - 1; setTimeout(renderDisNow, 300); });
  $('disNow').querySelectorAll('[data-unreg]').forEach(b => b.onclick = () => { S.flowRegs.forEach(R => { if (R.code === b.dataset.unreg) R.until = S.t - 1; }); setTimeout(renderDisNow, 300); });
  $('disNow').querySelectorAll('[data-nocb]').forEach(b => b.onclick = () => { S.cbs = []; renderDisNow(); });
}
$('dDelay').onclick = () => { airportDelay($('dApt').value, +$('dMins').value, pick(AP_WHY), 45); renderDisNow(); };
$('dClose').onclick = () => { airportClose($('dApt').value, pick(['an aircraft disabled on the runway', 'a runway closure', 'snow clearing', 'a fire service incident']), 35); renderDisNow(); };
$('dFlow').onclick = () => { const v = $('dReg').value, code = $('dUnit').value; flowReg(code, v.startsWith('mit') ? { why: 'an en-route regulation', mit: +v.slice(3)*60, dur: 40 } : { why: 'sector overload', cap: +v.slice(3)*100, dur: 40 }); renderDisNow(); };
$('dCB').onclick = () => { const c = randomInMine(); if (c) { addCB(c[0], c[1], 3); sys('Thunderstorms building in your airspace.'); } renderDisNow(); };
$('dTurb').onclick = () => { const c = randomInMine(), lo = Math.round(rnd(31, 37))*1000; if (c) { S.turb.push({ la: c[0], lon: c[1], r: 40, lo, hi: lo + 2000, until: S.t + 40*60 }); sys(`Moderate turbulence FL${FLs(lo)} to FL${FLs(lo + 2000)} near ${nearestFix(c[0], c[1])}.`); } };
$('dEmg').onchange = e => { if (e.target.value) { if (!emergency(e.target.value)) sys('No flight of yours to have it: wait for some traffic.'); e.target.value = ''; } };

// ── the landing page ──
function drawUkMap(){
  const c = $('ukMap'); if (!c) return; const g = c.getContext('2d'), w = c.width, h = c.height;
  g.fillStyle = '#cfe2ee'; g.fillRect(0, 0, w, h);
  // the street map (web mercator) under the sectors, the same tiles as the scope
  const z = 5, la1 = 61.2, la2 = 48.6, lo1 = -11.8, lo2 = 4.2, X0 = lon2tx(lo1, z), X1 = lon2tx(lo2, z), Y0 = lat2ty(la1, z), Y1 = lat2ty(la2, z);
  const kx = w/(X1 - X0), ky = h/(Y1 - Y0), k = Math.min(kx, ky), ox = (w - (X1 - X0)*k)/2, oy = (h - (Y1 - Y0)*k)/2;
  const P = (la, lo) => [ox + (lon2tx(lo, z) - X0)*k, oy + (lat2ty(la, z) - Y0)*k];
  let pending = 0;
  for (let x = Math.floor(X0); x <= Math.floor(X1); x++) for (let y = Math.floor(Y0); y <= Math.floor(Y1); y++) {
    const t = tileImg('street', z, x, y);
    if (t.ok) g.drawImage(t.img, ox + (x - X0)*k, oy + (y - Y0)*k, k + 1, k + 1); else if (!t.bad) { pending++; t.img.addEventListener('load', () => { clearTimeout(drawUkMap.t); drawUkMap.t = setTimeout(drawUkMap, 120); }, { once: true }); }
  }
  g.fillStyle = 'rgba(246,248,251,.35)'; g.fillRect(0, 0, w, h);
  const col = { LS: '31,94,255', LC: '18,128,92', LW: '138,79,196', LN: '183,95,0', LE: '214,45,45', PC: '15,138,122', S: '90,110,40' };
  const own = s => s.o.find(c => ['LS', 'LC', 'LN', 'LW', 'LE', 'PC', 'S'].includes(c));
  for (const s of SECS) { const o = own(s); if (!o || s.hi < 250 || s.ad) continue; g.beginPath(); s.p.forEach(([la, lo], i) => { const [X, Y] = P(la, lo); i ? g.lineTo(X, Y) : g.moveTo(X, Y); }); g.closePath();
    const on = SEAT && (SEAT.id === o || SEAT.id === 'L' && /^L/.test(o)); g.fillStyle = `rgba(${col[o]},${on ? .26 : .07})`; g.fill(); g.strokeStyle = `rgba(${col[o]},${on ? .9 : .32})`; g.lineWidth = on ? 1.4 : .7; g.stroke(); }
  g.font = '600 11px "JetBrains Mono", monospace';
  for (const [k2, v] of Object.entries(AREA.ap)) if (['EGLL', 'EGKK', 'EGCC', 'EGPH', 'EGPF', 'EGGD', 'EGSS', 'EGBB', 'EGAA', 'EIDW', 'EGPD', 'EGNT'].includes(k2)) { const [X, Y] = P(v[0], v[1]); g.fillStyle = '#1452d9'; g.beginPath(); g.arc(X, Y, 2.6, 0, 7); g.fill(); g.fillStyle = '#0c1b2e'; g.fillText(k2, X + 5, Y - 4); }
  g.font = '500 10px "Inter Tight", sans-serif'; g.fillStyle = 'rgba(30,40,55,.7)'; g.fillText('© OpenStreetMap contributors', 8, h - 8);
}
function renderSeats(){
  $('secGrid').innerHTML = SEATS.map(s => `<button class="seccard${s === SEAT ? ' on' : ''}" data-seat="${s.id}"><span class="code">${s.code} · ${esc(AREA.pos[s.id] ? AREA.pos[s.id][2] : '')}</span><b>${esc(s.name)}</b><p>${esc(s.d)}</p><span class="tags"><span class="${/Busy|Large/.test(s.busy) ? 'busy' : ''}">${s.busy}</span><span>${esc(levelsOf(s.id))}</span></span></button>`).join('');
  $('secGrid').querySelectorAll('[data-seat]').forEach(b => b.onclick = () => { SEAT = SEATS.find(s => s.id === b.dataset.seat); renderSeats(); setupFor(); location.hash = '#setupSec'; document.getElementById('setupSec').scrollIntoView({ behavior: 'smooth' }); });
  drawUkMap();
}
function levelsOf(id){ const own = SECS.filter(s => !s.ad && (id === 'L' ? s.o.includes('L') && !s.o.some(c => ['PC', 'S'].includes(c) && s.o.indexOf(c) < s.o.indexOf('L')) : s.o.includes(id))); if (!own.length) return ''; const lo = Math.min(...own.map(s => s.lo)); return `${lo ? 'FL' + FLs(lo*100) : 'SFC'}–FL${FLs(Math.max(...own.map(s => s.hi))*100)}`; }
function setupFor(){
  $('setupTitle').textContent = SEAT.name;
  const p = AREA.pos[SEAT.id]; $('setupSub').textContent = `${SEAT.code} · ${p ? p[0] + ' · ' + p[2] : ''} · ${levelsOf(SEAT.id)}`;
}
function fillSetup(){
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], now = new Date();
  $('aDay').innerHTML = days.map((d, i) => `<option value="${i}"${i === (now.getUTCDay() + 6) % 7 ? ' selected' : ''}>${d}</option>`).join('');
  $('aHour').innerHTML = Array.from({ length: 24 }, (_, h) => `<option value="${h}"${h === now.getUTCHours() ? ' selected' : ''}>${String(h).padStart(2, '0')}:00</option>`).join('');
  const sync = () => { const live = /live/.test($('aTraffic').value); $('aDay').disabled = $('aHour').disabled = live; };
  $('aTraffic').onchange = sync; sync();
  $('viewFL').innerHTML = [100, 150, 200, 250, 300, 340, 370, 400].map(f => `<option value="${f}"${f === 340 ? ' selected' : ''}>FL${f}</option>`).join('');
}

// ── the session ──
let raf = null, lastT = 0, acc = 0;
async function startSession(){
  const mode = $('aTraffic').value;
  Object.assign(S, { t: 0, running: true, paused: false, speed: 1, acs: [], sel: null, log: [], score: 0, stats: {}, coord: [], conflicts: new Map(), stca: new Set(), los: new Set(), airports: {}, flowRegs: [], cbs: [], turb: [], mode,
    opts: { disrupt: $('aDis').value, emerg: $('aEmg').value, autoId: $('aId').value === 'auto' } });
  const wind = { live: [255, 70], jet: [265, 140], calm: [240, 20], east: [80, 40] }[$('aWind').value] || [255, 70];
  S.wdir = wind[0]; S.wkt = wind[1];
  // the start time: now for live traffic, else the day and hour chosen (this week)
  let start = Date.now();
  if (!/live/.test(mode)) { const d = new Date(); const dow = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() + (+$('aDay').value - dow)); d.setUTCHours(+$('aHour').value, 0, 0, 0); start = d.getTime(); }
  S.start = start;
  openFor(SEAT.id);
  setOrigin((MYBB[0] + MYBB[2])/2, (MYBB[1] + MYBB[3])/2);
  ROUTE_MEMO.clear(); PLAN.list = []; LIVE.ac.clear(); LIVE.polls = 0; LIVE.ok = 0; LIVE.err = 0;
  document.body.classList.add('insim');
  $('page-area').hidden = true; $('page-sim').hidden = false;
  $('chipCode').textContent = SEAT.code.split(' ')[0]; $('chipName').textContent = SEAT.name;
  resize();
  const a = xy(MYBB[0], MYBB[1]), b = xy(MYBB[2], MYBB[3]); V.x = (a[0] + b[0])/2; V.y = (a[1] + b[1])/2; V.scale = clamp(Math.min(W/(b[0] - a[0]), H/(b[1] - a[1]))*0.9, 0.5, 12);
  UI.viewFL = MYHI < 300 ? 200 : 340; $('viewFL').value = String(UI.viewFL);
  sys(`${SEAT.name} is open: ${MY.length} sectors, FL${FLs(MYLO*100)} to FL${FLs(MYHI*100)}. ${/live/.test(mode) ? 'Connecting to the live traffic…' : 'Traffic from the airline timetables.'}`);
  if (mode !== 'live') { buildPlan(start, 4, mode === 'event' ? 'event' : mode === 'quiet' ? 'quiet' : 'normal'); if (mode === 'quiet') PLAN.list = PLAN.list.filter((f, i) => i % 2 === 0); }
  spawnPlanned();
  if (/live/.test(mode)) { await loadBoards(); pollLive(); clearInterval(LIVE.timer); LIVE.timer = setInterval(pollLive, 10000); }
  dirty = { sel: true, strips: true, info: true, coord: true, log: true };
  lastT = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame);
  setInterval(() => { if (S.running) { dirty.strips = true; dirty.sel = true; dirty.info = true; } }, 2000);
}
function stopSession(){ S.running = false; clearInterval(LIVE.timer); cancelAnimationFrame(raf); document.body.classList.remove('insim'); $('page-sim').hidden = true; $('page-area').hidden = false; if ('speechSynthesis' in window) speechSynthesis.cancel(); }
function frame(now){
  const dt = Math.min(0.25, (now - lastT)/1000); lastT = now;
  if (S.running && !S.paused) { acc += dt*S.speed; while (acc >= 1) { tick(1); acc -= 1; } }
  draw();
  if (dirty.log) { renderLog(); dirty.log = false; }
  if (dirty.coord) { renderCoord(); dirty.coord = false; }
  if (dirty.info) { renderInfo(); dirty.info = false; }
  if (dirty.strips) { renderStrips(); dirty.strips = false; }
  if (dirty.sel && document.activeElement && !/^(iLv|iDct|iHold|iSpd)$/.test(document.activeElement.id)) { renderSel(); dirty.sel = false; }
  renderHud();
  raf = requestAnimationFrame(frame);
}
$('aStart').onclick = () => startSession();
setInterval(() => { const t = $('topClock'); if (t) t.textContent = zHM(Date.now()) + 'Z'; }, 1000);
fillSetup(); renderSeats(); setupFor();

// ═════════════════ the console: menu, map tools, phone panels ═════════════════
const phoneMQ = matchMedia('(max-width: 900px)');
function setMTab(t){
  const app = document.querySelector('.app'); app.dataset.mtab = t;
  document.querySelectorAll('#mtabs [data-mtab]').forEach(b => b.classList.toggle('on', b.dataset.mtab === t));
  if (t === 'log') { const l = $('log'); l.scrollTop = l.scrollHeight; }
  requestAnimationFrame(resize);
}
document.querySelectorAll('#mtabs [data-mtab]').forEach(b => b.onclick = () => setMTab(b.dataset.mtab !== 'map' && document.querySelector('.app').dataset.mtab === b.dataset.mtab ? 'map' : b.dataset.mtab));
{
  const btn = $('tgMenu'), pop = $('menuPop');
  const set = open => { pop.hidden = !open; btn.setAttribute('aria-expanded', String(open)); btn.classList.toggle('on', open); };
  btn.onclick = e => { e.stopPropagation(); set(pop.hidden); };
  pop.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.click) $(b.dataset.click).click(); if (!b.closest('.seg')) set(false); });
  document.addEventListener('pointerdown', e => { if (!pop.hidden && !pop.contains(e.target) && !btn.contains(e.target)) set(false); });
  const zoom = f => { V.scale = clamp(V.scale*f, 0.35, 40); };
  $('mrIn').onclick = () => zoom(1.5); $('mrOut').onclick = () => zoom(1/1.5);
  $('mrCtr').onclick = () => { if (S.sel && S.acs.includes(S.sel)) centreOnAc(S.sel); };
  const bot = () => { const b = document.querySelector('.tabbed > .bottom'), app = document.querySelector('.app'); if (b) app.style.setProperty('--bot', b.offsetHeight + 'px'); };
  window.addEventListener('resize', bot); requestAnimationFrame(bot);
  phoneMQ.addEventListener && phoneMQ.addEventListener('change', () => requestAnimationFrame(resize));
}
