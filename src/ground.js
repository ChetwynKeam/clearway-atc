// ═════════════════════════ ground detail: surfaces, textures, town, stands ═════════════════════════
// Drawn in the tower and ground views (scale > 70 px/NM). Airfield geometry follows chart D1/E1 (runway, taxiways,
// aprons, terminal, ATC, south apron hangars, airport service vehicle route). The town blocks of Gibraltar and La Línea
// are generated on a street grid inside the real coastline: indicative of the built-up area, not individual buildings.

// extra palette entries for the detailed ground (merged into both themes)
Object.assign(PAL.light, {
  gGrass: '#a9c08c', gGrass2: '#9fb782', gUrban: '#e9e4da', gBlock: '#ddd6c8', gBld: ['#cfc8bb', '#c7c0b2', '#d8d2c6', '#bfb7a8'], gBldEdge: 'rgba(90,80,65,.35)',
  gPark: '#bcd0a0', gScrub: '#a9b48e', gScrub2: '#93a078', gSand: '#efe2c0', gShoulder: '#8d939a', gRwy: '#4a5057', gTwy: '#5a6067', gApron: '#c2c5c8',
  gJoint: 'rgba(60,66,72,.18)', gRubber: 'rgba(20,22,25,.35)', gShadow: 'rgba(20,25,35,.22)', gRoof: '#e4e6e8', gRoof2: '#c9ced3', gRoofEdge: '#7f8a96',
  gRed: '#d0312d', gWhite: 'rgba(255,255,255,.92)', gRoad: '#f7f5f0', gRoadEdge: '#c9c1b2', gRoadLine: 'rgba(120,110,95,.6)', gCar: ['#3b4a5a', '#c8ccd2', '#8a1f1f', '#1f3d7a', '#e6e6e6', '#555b62']
});
Object.assign(PAL.dark, {
  gGrass: '#17271f', gGrass2: '#142219', gUrban: '#121c1f', gBlock: '#162226', gBld: ['#1c292d', '#1a2629', '#203033', '#18242a'], gBldEdge: 'rgba(120,150,150,.25)',
  gPark: '#14241b', gScrub: '#1a2a24', gScrub2: '#16241f', gSand: '#2a2a22', gShoulder: '#2c3336', gRwy: '#1d2326', gTwy: '#252c2f', gApron: '#30393c',
  gJoint: 'rgba(0,0,0,.25)', gRubber: 'rgba(0,0,0,.35)', gShadow: 'rgba(0,0,0,.35)', gRoof: '#2a3639', gRoof2: '#223033', gRoofEdge: '#4a5c60',
  gRed: '#c4473f', gWhite: 'rgba(236,240,232,.8)', gRoad: '#2e2a26', gRoadEdge: '#3a3530', gRoadLine: 'rgba(230,220,190,.35)', gCar: ['#5a6670', '#7d868f', '#7a3434', '#3d5a8a', '#9aa1a8', '#454b52']
});
// re-apply whichever theme is active so the new keys exist on C
setTheme(C.name || 'light');

// ── geometry helpers ──
function pipRing(p, r){ let c = false; for (let i = 0, j = r.length-1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < (xj-xi)*(p[1]-yi)/(yj-yi) + xi) c = !c; } return c; }
const onLand = p => LAND.some(pg => pg.reduce((c, r) => pipRing(p, r) ? !c : c, false));
const rmPoly = pts => pts.map(([m, o]) => rm(m, o));
function frontierOff(m){ // fence offset (m north of the centreline) at distance m along the runway
  const F = [[-260,486],[-207,482],[300,452],[718,418],[1300,272],[1875,126],[1905,118]];
  if (m <= F[0][0]) return F[0][1]; for (let i = 1; i < F.length; i++) if (m <= F[i][0]) { const [a, b] = [F[i-1], F[i]], f = (m - a[0])/(b[0]-a[0]); return a[1] + (b[1]-a[1])*f; } return F[F.length-1][1];
}
// airside boundary: the fence on the north, the RAF/airport boundary on the south (approximate)
const AIRSIDE_RM = [[-30, 470], [300, 448], [718, 414], [1300, 268], [1840, 128], [1846, -60], [1700, -95], [1300, -110], [1240, -150], [1190, -215], [1135, -285], [1040, -300], [960, -230], [930, -120], [600, -95], [200, -90], [-30, -90]];
const AIRSIDE = APT.drawnTown ? rmPoly(AIRSIDE_RM) : null;   // Gibraltar only: other airports rely on the street map
const SAND_RM = [[1846, 40], [1880, 30], [1905, -120], [1898, -330], [1870, -340], [1852, -120]];

// ── town generator (deterministic) ──
let GROUND = null;
function seeded(i){ const x = Math.sin(i*12.9898 + 78.233) * 43758.5453; return x - Math.floor(x); }
function groundInit(){
  const blocks = [], blds = [[], [], [], []], parks = [];
  const inRock = p => pipRing(p, ROCK);
  let k = 0;
  for (let m = -1500; m < 2600; m += 74) for (let o = -2600; o < 1900; o += 62) {
    k++;
    const north = o > frontierOff(m) + 25;
    const bw = north ? 58 : 60, bh = north ? 48 : 50;                 // block size, streets fill the rest
    const jm = (seeded(k)*8 - 4), jo = (seeded(k+7)*8 - 4);
    const q = [[m+jm, o+jo], [m+jm+bw, o+jo], [m+jm+bw, o+jo+bh], [m+jm, o+jo+bh]], cpt = rm(m+jm+bw/2, o+jo+bh/2);
    if (!q.every(([a, b]) => onLand(rm(a, b)))) continue;
    if (q.some(([a, b]) => pipRing(rm(a, b), AIRSIDE)) || pipRing(cpt, AIRSIDE)) continue;
    if (q.some(([a, b]) => inRock(rm(a, b)))) continue;
    if (!north && Math.abs(m + bw/2 - XING_M) < 40 && o > -700) continue;  // Winston Churchill Avenue corridor
    if (seeded(k+3) < 0.07) { parks.push(rmPoly(q)); continue; }
    blocks.push(rmPoly(q));
    // buildings: a perimeter of terraces or one or two larger blocks (estates)
    const r = seeded(k+11), inset = 3;
    const add = (a0, b0, a1, b1) => blds[Math.floor(seeded(k + a0*0.37 + b0*0.11)*4)].push(rmPoly([[a0,b0],[a1,b0],[a1,b1],[a0,b1]]));
    const M0 = m+jm+inset, O0 = o+jo+inset, M1 = m+jm+bw-inset, O1 = o+jo+bh-inset;
    if (r < 0.35) { add(M0, O0, M1, O1); }                                                   // whole-block building
    else if (r < 0.6) { const mid = M0 + (M1-M0)*(0.45 + seeded(k+5)*0.1); add(M0, O0, mid-2, O1); add(mid+2, O0, M1, O1); }
    else { const d = 11 + seeded(k+9)*4; add(M0, O0, M1, O0+d); add(M0, O1-d, M1, O1); if (seeded(k+13) < 0.7) { add(M0, O0+d+3, M0+d, O1-d-3); add(M1-d, O0+d+3, M1, O1-d-3); } }
  }
  const P = list => { const p = new Path2D(); for (const q of list) { q.forEach(([x, y], i) => i ? p.lineTo(x, y) : p.moveTo(x, y)); p.closePath(); } return p; };
  GROUND = { blocks: P(blocks), parks: P(parks), blds: blds.map(P), n: blds.reduce((s, b) => s + b.length, 0) };
}
// world (NM) → screen transform for Path2D fills
function worldTransform(){ const s = V.scale; cx.setTransform(DPR*s, 0, 0, -DPR*s, DPR*(W/2 - V.cx*s), DPR*(H/2 + V.cy*s)); }

// ── textures (world-anchored patterns) ──
const TEX = {};
function makeTex(name, size, paint){ const c = document.createElement('canvas'); c.width = c.height = size; paint(c.getContext('2d'), size); TEX[name] = { c, size }; }
function texPattern(name, metres, rotate = 0){
  const t = TEX[name]; if (!t) return null;
  const key = name + (C.name || 'light'); if (!t.pat || t.key !== key) { t.pat = cx.createPattern(t.c, 'repeat'); t.key = key; }
  const mpx = V.scale/1852, k = metres*mpx/t.size, o = rm(0, 0);
  try { t.pat.setTransform(new DOMMatrix().translate(sx(o[0]), sy(o[1])).rotate(rotate).scale(k)); } catch(e) {}
  return t.pat;
}
function buildTextures(){
  const noise = (g, n, a0, a1, col) => { for (let i = 0; i < n; i++) { g.fillStyle = `rgba(${col},${(a0 + Math.random()*(a1-a0)).toFixed(3)})`; g.fillRect(Math.random()*256, Math.random()*256, 1 + Math.random()*2, 1 + Math.random()*2); } };
  const dark = C.name === 'dark';
  makeTex('grass', 256, (g, n) => { g.fillStyle = C.gGrass; g.fillRect(0, 0, n, n); g.fillStyle = C.gGrass2; for (let y = 0; y < n; y += 64) g.fillRect(0, y, n, 32); noise(g, 2600, 0.03, 0.10, dark ? '0,0,0' : '60,80,40'); noise(g, 900, 0.03, 0.08, '255,255,230'); });
  makeTex('asphalt', 256, (g, n) => { g.fillStyle = C.gRwy; g.fillRect(0, 0, n, n); noise(g, 5000, 0.04, 0.12, '0,0,0'); noise(g, 2500, 0.03, 0.08, '255,255,255'); });
  makeTex('twy', 256, (g, n) => { g.fillStyle = C.gTwy; g.fillRect(0, 0, n, n); noise(g, 4000, 0.04, 0.10, '0,0,0'); noise(g, 2000, 0.03, 0.07, '255,255,255'); });
  makeTex('slab', 256, (g, n) => { g.fillStyle = C.gApron; g.fillRect(0, 0, n, n); noise(g, 2500, 0.02, 0.06, '0,0,0'); for (let i = 0; i < 6; i++) { const x = Math.random()*n, y = Math.random()*n; g.fillStyle = 'rgba(80,70,50,.06)'; g.beginPath(); g.ellipse(x, y, 10 + Math.random()*20, 6 + Math.random()*10, Math.random()*3, 0, 7); g.fill(); } g.strokeStyle = C.gJoint; g.lineWidth = 1; for (let i = 0; i <= n; i += 51.2) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, n); g.moveTo(0, i); g.lineTo(n, i); g.stroke(); } });
  makeTex('scrub', 256, (g, n) => { g.fillStyle = C.gScrub; g.fillRect(0, 0, n, n); for (let i = 0; i < 900; i++) { g.fillStyle = Math.random() < 0.5 ? C.gScrub2 : (dark ? 'rgba(0,0,0,.2)' : 'rgba(255,255,240,.18)'); g.beginPath(); g.arc(Math.random()*n, Math.random()*n, 1 + Math.random()*3.5, 0, 7); g.fill(); } });
  makeTex('sand', 256, (g, n) => { g.fillStyle = C.gSand; g.fillRect(0, 0, n, n); noise(g, 3000, 0.04, 0.10, '150,120,70'); });
  TEX.built = C.name || 'light';
}
const RWY_ANGLE = () => Math.atan2(-RU[1], RU[0]) * 180/Math.PI;

// ── base layer: town, airside grass, the Rock, beach ──
function drawGroundBase(){
  if (!APT.drawnTown) return;
  if (!GROUND) groundInit();
  if (TEX.built !== (C.name || 'light')) buildTextures();
  const sc = V.scale;
  // urban ground under the street grid
  cx.save(); cx.fillStyle = C.gUrban;
  for (const pg of LAND) { cx.beginPath(); for (const r of pg) { r.forEach((p,i) => { const X = sx(p[0]), Y = sy(p[1]); i ? cx.lineTo(X,Y) : cx.moveTo(X,Y); }); cx.closePath(); } cx.fill('evenodd'); }
  cx.restore();
  // blocks, parks and buildings (one transformed fill per tone)
  cx.save(); worldTransform();
  cx.fillStyle = C.gBlock; cx.fill(GROUND.blocks); cx.fillStyle = C.gPark; cx.fill(GROUND.parks);
  if (sc > 110) { // building shadows then roofs
    const sh = 2.2 / 1852; cx.save(); cx.translate(sh, -sh); cx.fillStyle = C.gShadow; for (const p of GROUND.blds) cx.fill(p); cx.restore();
  }
  GROUND.blds.forEach((p, i) => { cx.fillStyle = C.gBld[i]; cx.fill(p); });
  if (sc > 260) { cx.strokeStyle = C.gBldEdge; cx.lineWidth = 1/sc; GROUND.blds.forEach(p => cx.stroke(p)); }
  cx.restore();
  // airside grass (mown stripes run with the runway)
  cx.save(); cx.fillStyle = texPattern('grass', 60, RWY_ANGLE()) || C.gGrass; poly(AIRSIDE); cx.fill(); cx.restore();
  // the Rock: scrub and limestone
  cx.save(); cx.fillStyle = texPattern('scrub', 140) || C.gScrub; poly(ROCK); cx.fill(); cx.restore();
  // Eastern Beach
  cx.save(); cx.fillStyle = texPattern('sand', 80) || C.gSand; poly(rmPoly(SAND_RM)); cx.fill(); cx.restore();
}

// ── named roads (drawn over the grid, under the airfield) ──
const ROADS = [
  { name: 'Devil’s Tower Road', w: 12, pts: [[985, -260], [1100, -320], [1300, -330], [1500, -300], [1700, -250], [1860, -230]] },
  { name: 'Bayside Road', w: 10, pts: [[960, -420], [700, -460], [450, -470], [250, -480]] }
];
function drawRoads(){
  if (!APT.drawnTown) return;
  const mpx = V.scale/1852, c = (m, o) => { const p = rm(m, o); return [sx(p[0]), sy(p[1])]; };
  cx.save(); cx.lineJoin = cx.lineCap = 'round';
  for (const r of ROADS) {
    const trace = () => { cx.beginPath(); r.pts.forEach(([m, o], i) => cx[i ? 'lineTo' : 'moveTo'](...c(m, o))); };
    cx.strokeStyle = C.gRoadEdge; cx.lineWidth = Math.max(2, (r.w + 3)*mpx); trace(); cx.stroke();
    cx.strokeStyle = C.gRoad; cx.lineWidth = Math.max(1.5, r.w*mpx); trace(); cx.stroke();
    if (V.scale > 300) { cx.strokeStyle = C.gRoadLine; cx.lineWidth = Math.max(0.8, 0.15*mpx); cx.setLineDash([3*mpx, 6*mpx]); trace(); cx.stroke(); cx.setLineDash([]); }
    if (V.scale > 160 && V.scale < 2000) { const [a, b] = [r.pts[1], r.pts[2]], p = c((a[0]+b[0])/2, (a[1]+b[1])/2), q1 = c(...a), q2 = c(...b);
      cx.save(); cx.translate(...p); let ang = Math.atan2(q2[1]-q1[1], q2[0]-q1[0]); if (Math.abs(ang) > Math.PI/2) ang += Math.PI; cx.rotate(ang);
      cx.font = `500 11px ${FONT_L}`; cx.textAlign = 'center'; cx.fillStyle = C.name === 'dark' ? 'rgba(207,227,226,.6)' : 'rgba(60,55,45,.75)'; cx.fillText(r.name, 0, -Math.max(6, r.w*mpx/2 + 4)); cx.restore(); }
  }
  cx.restore();
}

function drawRunwayShoulders(path){
  cx.fillStyle = C.gShoulder;
  const [s0, s1] = AD.shoulder || [0, RWY_M]; for (const sgn of [-1, 1]) { path([[s0, sgn*(RHW - 0.5)], [s1, sgn*(RHW - 0.5)], [s1, sgn*(RHW + 7.5)], [s0, sgn*(RHW + 7.5)]]); cx.fill(); }
}
// ── detailed paving: shoulders, rubber, slab joints (called inside drawAirport before markings) ──
function drawPavingDetail(c, path, mpx){
  // runway shoulders (paler) then the textured runway surface 45 m wide
  cx.fillStyle = texPattern('asphalt', 40, RWY_ANGLE()) || C.gRwy; path(AD.rwyPoly); cx.fill();
  // rubber deposits in both touchdown zones
  for (const [m0, dir] of [[THR_LO_M, 1], [THR_HI_M, -1]]) for (let k = 0; k < 14; k++) {
    const a = m0 + dir*(120 + k*28), len = 30 + seeded(k + m0)*40, w = 4 + seeded(k*3 + m0)*5;
    cx.fillStyle = C.gRubber; cx.globalAlpha = 0.12 + 0.3*seeded(k*7 + m0)*(1 - k/16);
    for (const s of [-1, 1]) { path([[a, s*3.5 - w/2], [a + dir*len, s*3.5 - w/2], [a + dir*len, s*3.5 + w/2], [a, s*3.5 + w/2]]); cx.fill(); }
  }
  cx.globalAlpha = 1;
}
function drawApronSlabs(path){
  const pat = texPattern('slab', 25, RWY_ANGLE());
  if (!pat) return;
  cx.fillStyle = pat; for (const a of AD.aprons) { path(a); cx.fill(); }
}

// ── stands: lead-in, stop bar, safety box, number box; service road ──
function drawStandDetail(c, path, mpx){
  const sc = V.scale;
  // airport service vehicle route (E1): white edge lines along the south edge of the civil apron, zebra where lead-ins cross
  if (AD.serviceRoad) {
  cx.strokeStyle = C.gWhite; cx.lineWidth = Math.max(1, 0.25*mpx);
  for (const o of [120, 130]) { path([[1108, o], [1313, o]], false); cx.stroke(); }
  cx.setLineDash([3*mpx, 3*mpx]); path([[1108, 125], [1313, 125]], false); cx.stroke(); cx.setLineDash([]);
  if (sc > 350) { cx.font = `600 ${Math.max(8, 2.6*mpx)}px ${FONT_L}`; cx.fillStyle = C.gWhite; cx.textAlign = 'center'; const q = c(1270, 125); cx.save(); cx.translate(...q); cx.rotate(RWY_ANGLE()*Math.PI/180); cx.fillText('SERVICE ROAD', 0, Math.max(3, 0.9*mpx)); cx.restore(); cx.textAlign = 'left'; }
  }
  for (const s of STANDS) {
    const civil = s.area === 'civil', box = civil ? [33, 38] : s.area === 'north' ? [32, 32] : [44, 46];
    const h = s.hdg*D2R, P = [sx(s.p[0]), sy(s.p[1])];
    cx.save(); cx.translate(...P); cx.rotate(h);
    const bw = box[0]*mpx, bh = box[1]*mpx;
    // red apron safety (clearance) box and equipment restraint line
    cx.strokeStyle = C.gRed; cx.globalAlpha = 0.8; cx.lineWidth = Math.max(1, 0.3*mpx);
    cx.strokeRect(-bw/2, -bh*0.62, bw, bh);
    cx.setLineDash([2*mpx, 2*mpx]); cx.strokeRect(-bw/2 - 2.5*mpx, -bh*0.62 - 2.5*mpx, bw + 5*mpx, bh + 5*mpx); cx.setLineDash([]); cx.globalAlpha = 1;
    // stop bar at the nosewheel position with a short perpendicular tick
    cx.strokeStyle = C.yellow; cx.lineWidth = Math.max(1.2, 0.45*mpx);
    cx.beginPath(); cx.moveTo(-3.5*mpx, -bh*0.36); cx.lineTo(3.5*mpx, -bh*0.36); cx.stroke();
    // centreline continues through the stand
    cx.lineWidth = Math.max(1, 0.3*mpx); cx.beginPath(); cx.moveTo(0, bh*0.38); cx.lineTo(0, -bh*0.36); cx.stroke();
    // stand number: yellow on black box at the lead-in
    if (sc > 220) {
      const fs = Math.max(9, 3.4*mpx); cx.font = `700 ${fs}px ${FONT_L}`; const tw = cx.measureText(s.id).width + fs*0.6;
      const flip = Math.cos(h) < 0; if (flip) cx.rotate(Math.PI);
      const yb = flip ? -bh*0.38 + fs*0.2 : bh*0.38 - fs*1.4; cx.fillStyle = '#111'; cx.fillRect(-tw/2, yb, tw, fs*1.2); cx.fillStyle = C.yellow; cx.textAlign = 'center'; cx.fillText(s.id, 0, yb + fs*0.95); cx.textAlign = 'left';
    }
    cx.restore();
  }
}

// ── buildings with height: shadow, roof, roof detail ──
const BLD_INFO = () => AD.buildings || [];
function drawBuildings(c, path, mpx){
  const sc = V.scale, sh = (m) => m*mpx*0.6;
  for (const b of BLD_INFO()) {
    // cast shadow (sun from the south-west in the afternoon)
    cx.save(); cx.translate(sh(b.h), -sh(b.h)*0.7); cx.fillStyle = C.gShadow; path(b.pts); cx.fill(); cx.restore();
    const pts = b.pts.map(([m, o]) => c(m, o)), xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const g = cx.createLinearGradient(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
    g.addColorStop(0, C.gRoof); g.addColorStop(1, C.gRoof2);
    cx.fillStyle = g; cx.strokeStyle = C.gRoofEdge; cx.lineWidth = 1; path(b.pts); cx.fill(); cx.stroke();
    if (sc < 200) continue;
    cx.save(); path(b.pts); cx.clip(); cx.strokeStyle = C.gRoofEdge; cx.globalAlpha = 0.45; cx.lineWidth = Math.max(0.6, 0.12*mpx);
    if (b.roof === 'terminal') { for (let m = 1170; m < 1360; m += 9) { path([[m, 240], [m, 330]], false); cx.stroke(); } cx.globalAlpha = 0.8; cx.fillStyle = C.gRoof2; for (const [m, o] of [[1235, 300], [1300, 300], [1190, 260]]) { path([[m, o], [m+14, o], [m+14, o+8], [m, o+8]]); cx.fill(); cx.stroke(); } }
    if (b.roof === 'hangar') { const [p0, p1] = [b.pts[0], b.pts[Math.floor(b.pts.length/2)]]; cx.lineWidth = Math.max(1, 0.3*mpx); path([p0, p1], false); cx.stroke(); }
    cx.restore();
    if (b.roof === 'atc') { const q = c(1040, 230); cx.fillStyle = C.name === 'dark' ? '#3d5a63' : '#7fa3b8'; cx.strokeStyle = C.gRoofEdge; cx.beginPath(); cx.arc(q[0] + sh(b.h)*0.3, q[1] - sh(b.h)*0.2, Math.max(3, 7*mpx), 0, 7); cx.fill(); cx.stroke(); }
  }
  // fuel installation on the south apron (vent pipe marked on D1)
  if (APT.drawnTown) for (const [m, o, r] of [[1105, -215, 6], [1093, -228, 5]]) { const q = c(m, o); cx.fillStyle = C.gShadow; cx.beginPath(); cx.arc(q[0] + 2*mpx, q[1] + 2*mpx, r*mpx, 0, 7); cx.fill(); cx.fillStyle = C.gRoof; cx.strokeStyle = C.gRoofEdge; cx.beginPath(); cx.arc(q[0], q[1], r*mpx, 0, 7); cx.fill(); cx.stroke(); }
}
