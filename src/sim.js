"use strict";
// ═══════════════════════════════════════════════════════════════════════════════════════
// CALPE · Gibraltar ATC simulator — simulation core
// Sources: UK Mil AIP AD 2 LXGB (AD 2.2–2.14, charts B1, D1, E1, F1, H1, K1, K2). Coast: GSHHG full
// resolution, with the aerodrome shoreline traced from chart D1.
// ═══════════════════════════════════════════════════════════════════════════════════════

// ═════════════════════════ geometry ═════════════════════════
const D2R = Math.PI/180, R2D = 180/Math.PI;
const LAT0 = 36.1512, LON0 = -5.3494, COSL = Math.cos(LAT0*D2R);
const M2NM = 1/1852;
const dms = (d, m, s=0) => d + m/60 + s/3600;
function xy(lat, lon){ return [(lon-LON0)*60*COSL, (lat-LAT0)*60]; }
const norm = a => ((a%360)+360)%360;
const angDiff = (a,b) => { let d = norm(b-a); return d>180 ? d-360 : d; };
const brg = (x1,y1,x2,y2) => norm(Math.atan2(x2-x1, y2-y1)*R2D);
const dist = (x1,y1,x2,y2) => Math.hypot(x2-x1, y2-y1);
const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
const rnd = (a,b) => a + Math.random()*(b-a);
const dirv = h => [Math.sin(h*D2R), Math.cos(h*D2R)];
const add = (p, h, d) => [p[0]+Math.sin(h*D2R)*d, p[1]+Math.cos(h*D2R)*d];

// Runway 09/27 (AD 2.12): 1798 × 45 m, true bearing 087.5°/267.5°. Declared distances (AD 2.13) put
// THR 09 138 m and THR 27 132 m in from the runway ends.
const T09 = xy(dms(36,9,3.17), -dms(5,21,29.16));
const T27 = xy(dms(36,9,5.29), -dms(5,20,28.21));
const ELEV = 12;
const CRS09 = brg(...T09, ...T27), CRS27 = norm(CRS09+180);
const RU = dirv(CRS09), RN = [-RU[1], RU[0]];           // along (east), normal (north)
const THR_GAP_M = dist(...T09, ...T27)/M2NM;            // 1528 m LDA
const W_OFF = 138;
const RWY_M = 1757;                                    // paved length to the turning pads as mapped (AD 2.12 declares 1798 m)
const THR09_M = W_OFF, THR27_M = W_OFF + THR_GAP_M;
const W_END = [T09[0]-RU[0]*W_OFF*M2NM, T09[1]-RU[1]*W_OFF*M2NM];
// aerodrome coordinates: metres along the runway from the west end, metres north of the centreline
function rm(m, off=0){ return [W_END[0] + (RU[0]*m + RN[0]*off)*M2NM, W_END[1] + (RU[1]*m + RN[1]*off)*M2NM]; }
function mOf(p){ return ((p[0]-W_END[0])*RU[0] + (p[1]-W_END[1])*RU[1]) / M2NM; }
function offOf(p){ return ((p[0]-W_END[0])*RN[0] + (p[1]-W_END[1])*RN[1]) / M2NM; }
const XING_M = 984;                                     // Winston Churchill Avenue crosses the runway here (centre of the OSM crossing)
const XING_SKEW = 0.125, XING_HW = 15;                  // the crossing runs slightly skewed to the runway; half-width of the paved crossing (m)
const xingM = o => XING_M + XING_SKEW*o;                // runway distance of the crossing's centre line at offset o
const GBR = xy(dms(36,8,36.63), -dms(5,20,33.50));     // TACAN Ch 83X
const ARP = xy(dms(36,9,4.21), -dms(5,20,59.10));

// ═════════════════════════ aerodrome layout (OpenStreetMap geometry, checked against AD 2 / chart D1) ═════════════════════════
// Centrelines, aprons and stand lead-ins are OpenStreetMap ways converted to runway metres (m along from the west end,
// off north of the centreline), so the drawn aerodrome sits on the street map. All taxiways 19 m wide; guard lights at
// holding points A, C, D and E. Each runway entry splits into two curved fillets, one towards each end.
const TW = { A: 1155, C: 1057, D: 1190.5, E: 1558, B: 109.5 };
const LANE_N = 109.5, LANE_S = -120;                     // B doubles as the civil apron taxilane; south apron taxilane
const GN = {}, GE = [];
function gn(id, m, off){ GN[id] = { id, m, off, p: rm(m, off), adj: [] }; }
function ge(a, b, tw){ const e = { a, b, tw, len: dist(...GN[a].p, ...GN[b].p) }; GE.push(e); GN[a].adj.push([b, e]); GN[b].adj.push([a, e]); }
let kN = 0;
// a chain of points becomes graph nodes joined by edges carrying the taxiway designator
function chain(a, pts, b, tw){ let prev = a; for (const [m, o] of pts) { const id = 'k' + (kN++); gn(id, m, o); ge(prev, id, tw); prev = id; } ge(prev, b, tw); }
// runway entries: junction node, holding point, and the fillet points from the runway centreline to the junction
gn('RA', 1155.6, 45); gn('HA', 1155, 68); gn('JA', 1155, 78);
gn('RE', 1558.6, 24.6); gn('HE', 1558.1, 82);
gn('RC', 1057.2, -41.1); gn('HC', 1056.8, -78); gn('SC', 1056.5, LANE_S);
gn('RD', 1190.8, -45.1); gn('HD', 1190.5, -78); gn('SD', 1190.5, LANE_S);
const FIL = {
  A: { W: [[1103.8,0],[1122.7,2.5],[1136.4,9.9],[1145.1,18],[1151.8,28.5]], E: [[1211.5,0],[1189.2,3.6],[1176.6,9.7],[1166.1,19.1],[1159.3,30.2]] },
  C: { W: [[1001.6,0],[1020.7,-3.6],[1038.3,-12.4],[1050.5,-25.2]], E: [[1103.8,0],[1083.6,-7.9],[1067.8,-21.5]] },
  D: { W: [[1143.9,0],[1165.6,-8.5],[1180.5,-21.3]], E: [[1240.5,0],[1213.7,-10.1],[1198.1,-25.9]] },
  E: { W: [[1532.1,0],[1549.8,5.8],[1556.7,15.1]], E: [[1585.9,0],[1565.3,7.7],[1559.2,19]] }
};
const HOLDS = {
  A: { node: 'HA', rwy: 'RA', m: TW.A, off: 68,  rgl: true },
  E: { node: 'HE', rwy: 'RE', m: TW.E, off: 82,  rgl: true },
  C: { node: 'HC', rwy: 'RC', m: TW.C, off: -78, rgl: true },
  D: { node: 'HD', rwy: 'RD', m: TW.D, off: -78, rgl: true }
};
// B and the civil apron: B runs along the apron edge and stands 2–5 lead straight off it
gn('AW', 1140.3, 118); gn('BW', 1191.1, 109.3); gn('BN', 1367.2, 109.1); gn('B1435', 1435.3, 109.2); gn('BE', 1540, 109.6);
gn('NT', 1407.7, 145.2); gn('NA', 1418.5, 174.6); gn('NB', 1430.3, 207);
const STANDS = [
  { id: '1', m: 1125.1, off: 184, lead: [1125.1, 150], area: 'civil' },
  ...[['2', 1165.7], ['3', 1206.2], ['4', 1246.3], ['5', 1293]].map(([id, m]) => ({ id, m, off: 184, lead: [m, LANE_N], area: 'civil' })),
  { id: 'N1', m: 1382, off: 170, node: 'NA', area: 'north' }, { id: 'N2', m: 1398, off: 214, node: 'NB', area: 'north' },
  { id: 'S1', m: 1090, off: -165, lead: [1090, LANE_S], area: 'south' }, { id: 'S2', m: 1150, off: -160, lead: [1150, LANE_S], area: 'south' }
];
STANDS.forEach(s => {
  s.p = rm(s.m, s.off); s.occ = null;
  if (!s.node) { s.node = 'L' + s.id; gn(s.node, ...s.lead); }
  s.lp = GN[s.node].p;
  s.hdg = brg(...s.lp, ...s.p);                           // parked nose-in, facing away from the lane
});
// edges: taxiway designators drive the phraseology
ge('RA','HA','A'); ge('HA','JA','A');
chain('JA', [[1153.7,92.6],[1151.8,101.6],[1147.2,110.4]], 'AW', 'A');
chain('JA', [[1157.1,84.3],[1162.4,93.9],[1168.3,99.9],[1176.5,105.3]], 'BW', 'A');
chain('AW', [[1149.6,112.1]], 'L2', 'APRON'); ge('L2','BW','APRON');
chain('AW', [[1129.9,131.4]], 'L1', 'APRON');
ge('BW','L3','B'); ge('L3','L4','B'); ge('L4','L5','B'); ge('L5','BN','B'); ge('BN','B1435','B'); ge('B1435','BE','B');
chain('BE', [[1552.7,103.3],[1556.8,95]], 'HE', 'E'); ge('HE','RE','E');
chain('BN', [[1384.1,115.1],[1396.5,124.9],[1404.4,137.1]], 'NT', 'APRON');
chain('B1435', [[1419.6,114.6],[1410.1,126.3]], 'NT', 'APRON');
ge('NT','NA','APRON'); ge('NA','NB','APRON');
ge('RC','HC','C'); ge('HC','SC','C'); ge('RD','HD','D'); ge('HD','SD','D');
ge('SC','LS1','APRON'); ge('LS1','LS2','APRON'); ge('LS2','SD','APRON');
// fillet points from the runway to a holding point's junction (side W meets the runway west of the junction)
const filIn = (hp, side) => FIL[hp][side].map(([m, o]) => rm(m, o));
const filOut = (hp, side) => filIn(hp, side).reverse();
const PHON = { A:'Alpha', B:'Bravo', C:'Charlie', D:'Delta', E:'Echo' };
function route(from, to){
  const dd = { [from]: 0 }, prev = {}, done = new Set();
  while (true) {
    let u = null, best = Infinity; for (const k in dd) if (!done.has(k) && dd[k] < best) { best = dd[k]; u = k; }
    if (u === null) return null; if (u === to) break; done.add(u);
    for (const [v, e] of GN[u].adj) { if (/^R/.test(v) && v !== to) continue; const nd = dd[u] + e.len; if (dd[v] === undefined || nd < dd[v]) { dd[v] = nd; prev[v] = [u, e]; } }
  }
  const nodes = [to], tws = []; let c = to;
  while (c !== from) { const [u, e] = prev[c]; nodes.unshift(u); tws.unshift(e.tw); c = u; }
  return { nodes, tws };
}
function viaOf(tws, hp){ const v = []; for (const t of tws) if (t !== 'APRON' && t !== hp && v[v.length-1] !== t) v.push(t); return v; }
function nearestNode(p, filter){ let best = null, bd = Infinity; for (const n of Object.values(GN)) { if (filter && !filter(n)) continue; const d = dist(...p, ...n.p); if (d < bd) { bd = d; best = n; } } return best; }

// Rock of Gibraltar (upper slopes, approximate) – summit 1398 ft. Overflight prohibited.
const ROCK = [[36.1468,-5.3462],[36.1452,-5.3418],[36.1400,-5.3388],[36.1320,-5.3380],[36.1240,-5.3392],[36.1170,-5.3410],[36.1132,-5.3440],[36.1185,-5.3478],[36.1290,-5.3492],[36.1380,-5.3490],[36.1440,-5.3482]].map(p=>xy(...p));
const ROCK_TOP = xy(36.1240,-5.3430);
// Frontier fence (D1) and R164 Spanish restricted area SFC–FL300 north of it (northern boundary approximated from K5)
const FRONTIER = [[-260,486],[-207,482],[300,452],[718,418],[1300,272],[1875,126],[1905,118]].map(([m,o]) => rm(m,o));
const R164 = [...FRONTIER.slice(1), ...[[36.1700,-5.3150],[36.2300,-5.2950],[36.3100,-5.3300],[36.3100,-5.4600],[36.2100,-5.4500],[36.1750,-5.4100],[36.1585,-5.3790]].map(p=>xy(...p))];
function inPoly(p, poly){ let c=false; for(let i=0,j=poly.length-1;i<poly.length;j=i++){ const [xi,yi]=poly[i],[xj,yj]=poly[j]; if(((yi>p[1])!==(yj>p[1])) && (p[0] < (xj-xi)*(p[1]-yi)/(yj-yi)+xi)) c=!c; } return c; }

// ═════════════════════════ fixes & procedures (charts H1, K1, K2) ═════════════════════════
const WP = {};
function wp(id, lat, lon, opts={}){ WP[id] = { id, p: xy(lat,lon), ...opts }; }
wp('PIMOS', dms(36,9.02), -dms(4,53.61), { note:'MGA 47.2d', exit:true });
wp('UPMUP', dms(36,0),    -dms(5,0),     { note:'GBR 18.7d', hold:{ inb:297, min:3000 } });
wp('UNBUT', dms(36,0),    -dms(5,20),    { note:'GBR 8.6d' });
wp('RIPRA', dms(36,0),    -dms(5,24),    { note:'GBR 9d' });
wp('ODLUK', dms(35,54),   -dms(5,40),    { note:'GBR 21.5d', hold:{ inb:74, min:4000 } });
wp('LINTO', dms(35,50),   -dms(5,57.27), { note:'GBR 35.1d', exit:true });
wp('TTN',   dms(35,35.85),-dms(5,19.13), { note:'Tetouan VOR 117.3', exit:true });
wp('VJF',   dms(36,14.36),-dms(5,58.53), { note:'Vejer VOR 117.8' });
// SRA final paths. 27: straight in on 267.5°, Point Yankee at 3 NM. 09: RIPRA 359° to Point X-Ray (3 NM track distance),
// then a descending right turn onto 087.5°. 2.8° profile: 920 ft at 3 NM, 1520 ft at 5 NM.
const FINAL = {};
(function(){
  const p10 = add(T27, CRS09, 10), pY = add(T27, CRS09, 3), p5 = add(T27, CRS09, 5);
  WP['F27'] = { id:'F27', p: p10, note:'10 NM final 27' }; WP['PTY'] = { id:'PTY', p: pY, note:'Point Yankee' };
  FINAL['27'] = { pts: [p10, p5, pY, T27], name: 'Yankee' };
  const r = 1.2, straight = 1.1;
  const S0 = add(T09, CRS27, straight);
  const C = add(S0, norm(CRS09+90), r);
  const arc = [];
  for (let k = 0; k <= 6; k++) { const h = norm(CRS09 - 90 + k*15); arc.push(add(C, norm(h-90), r)); }
  const X = arc[0];
  WP['PTX'] = { id:'PTX', p: X, note:'Point X-Ray' };
  FINAL['09'] = { pts: [WP.RIPRA.p, ...arc, T09], name: 'X-Ray' };
  for (const k of ['27','09']) { const f = FINAL[k]; f.cum = new Array(f.pts.length).fill(0); for (let i = f.pts.length-2; i >= 0; i--) f.cum[i] = f.cum[i+1] + dist(...f.pts[i], ...f.pts[i+1]); }
})();
const ARR_ROUTE = {
  E: { '27': ['PIMOS','UPMUP','F27'],                 '09': ['PIMOS','UPMUP','UNBUT','RIPRA'] },
  W: { '27': ['LINTO','ODLUK','RIPRA','UNBUT','F27'], '09': ['LINTO','ODLUK','RIPRA'] },
  S: { '27': ['UNBUT','F27'],                         '09': ['UNBUT','RIPRA'] }
};
const HOLD_AT = { E: 'UPMUP', W: 'ODLUK', S: 'UPMUP' };
const EXIT_FIX = { E: 'PIMOS', W: 'LINTO', S: 'TTN' };
const EXIT_ROUTE = { E: ['UPMUP','PIMOS'], W: ['ODLUK','LINTO'], S: ['TTN'] };
const ENTRY = { E: xy(36.33,-4.50), W: xy(35.80,-6.22), S: xy(35.48,-5.33) };
const NEXT_UNIT = { E: ['Sevilla Control','132.6'], W: ['Sevilla Control','132.6'], S: ['Casablanca Control','125.5'] };
// Standard departure routes. Gibraltar publishes no SIDs: these named routes are the simulator's own, built from the
// post-departure turn (27: left heading 200; 09: straight ahead to 1,500 ft, right heading 160) and the exit fixes.
const sidName = (gate, rwy) => `${EXIT_FIX[gate]} 1${rwy === '27' ? 'A' : 'B'}`;
const sidSpoken = n => n.replace(/ 1([AB])$/, (m, l) => ' one ' + (l === 'A' ? 'Alpha' : 'Bravo'));
const relUnit = ac => NEXT_UNIT[ac.gate][0].split(' ')[0];

// ═════════════════════════ aircraft performance ═════════════════════════
const TYPES = {
  A20N: { name:'A320neo',       wake:'M', vapp:136, vr:145, climb:2400, desc:2000, cruise:290, span:35.8, len:37.6, shape:'jet' },
  A320: { name:'A320',          wake:'M', vapp:138, vr:148, climb:2200, desc:2000, cruise:290, span:34.1, len:37.6, shape:'jet' },
  A319: { name:'A319',          wake:'M', vapp:132, vr:140, climb:2500, desc:2000, cruise:290, span:34.1, len:33.8, shape:'jet' },
  A21N: { name:'A321neo',       wake:'M', vapp:142, vr:155, climb:2100, desc:2000, cruise:290, span:35.8, len:44.5, shape:'jet' },
  B738: { name:'737-800',       wake:'M', vapp:145, vr:152, climb:2200, desc:2100, cruise:290, span:35.8, len:39.5, shape:'jet' },
  AT76: { name:'ATR 72-600',    wake:'M', vapp:110, vr:110, climb:1300, desc:1500, cruise:240, span:27.1, len:27.2, shape:'prop' },
  A332: { name:'A330 Voyager',  wake:'H', vapp:140, vr:155, climb:1900, desc:2000, cruise:300, span:60.3, len:58.8, shape:'jet' },
  A400: { name:'A400M Atlas',   wake:'H', vapp:115, vr:110, climb:1800, desc:1800, cruise:280, span:42.4, len:45.1, shape:'prop' },
  C56X: { name:'Citation XLS',  wake:'L', vapp:115, vr:110, climb:2800, desc:2200, cruise:260, span:17.2, len:15.8, shape:'biz' },
  GLF6: { name:'Gulfstream G650', wake:'M', vapp:125, vr:130, climb:3000, desc:2200, cruise:300, span:30.4, len:30.4, shape:'biz' },
  PC12: { name:'Pilatus PC-12', wake:'L', vapp:90,  vr:85,  climb:1500, desc:1200, cruise:220, span:16.3, len:14.4, shape:'prop' }
};
const TEL = { BAW:'Speedbird', EZY:'Easy', EJU:'Alpine', RAM:'Royal Air Maroc', RRR:'Ascot', NJE:'Fraction', VJT:'Vista', EXS:'Channex', TOM:'Tomjet', SWN:'Swiss Ambulance' };
const DIG = ['zero','one','two','three','four','five','six','seven','eight','niner'];
function spoken(cs){ const p = cs.slice(0,3); if (TEL[p]) return TEL[p]+' '+cs.slice(3).split('').map(c => /\d/.test(c) ? DIG[c] : c).join(' '); return cs.split('').join(' '); }
const isMil = ac => ac.t === 'A332' || ac.t === 'A400';

// ═════════════════════════ schedule ═════════════════════════
// Weekly timetable (summer pattern, times UTC; local is UTC+2). Rotations are representative of the real LXGB operators:
// British Airways (Heathrow), easyJet (Gatwick, Manchester, Bristol, Luton), Royal Air Maroc (Tangier), RAF air bridge (Brize Norton),
// charters and business aviation. Flight numbers and times are representative, not a published timetable.
// [arrival cs, from, landing, departure cs, to, off-blocks, type, days (1 = Monday), stand hint]; either half may be null.
const TIMETABLE = [
  ['EXS96K',  'EGCC', '07:40', 'EXS97K',  'EGCC', '08:30', 'B738', '6',       '1'],
  ['BAW490',  'EGLL', '08:55', 'BAW491',  'EGLL', '09:50', 'A20N', '1234567', '2'],
  ['RAM1471', 'GMTT', '09:10', 'RAM1472', 'GMTT', '09:45', 'AT76', '1357',    '4'],
  ['EZY8903', 'EGKK', '10:25', 'EZY8904', 'EGKK', '11:05', 'A20N', '13567',   '3'],
  ['SWN12',   'LEZL', '10:50', 'SWN13',   'LEZL', '12:20', 'PC12', '2',       'N2'],
  ['RRR4417', 'EGVN', '11:30', 'RRR4418', 'EGVN', '13:30', 'A400', '3',       'S1'],
  ['RAM1475', 'GMTT', '11:50', 'RAM1476', 'GMTT', '12:25', 'AT76', '246',     '4'],
  ['EZY1963', 'EGGW', '12:30', 'EZY1964', 'EGGW', '13:10', 'A320', '246',     '5'],
  ['BAW494',  'EGLL', '13:20', 'BAW495',  'EGLL', '14:15', 'A21N', '57',      '2'],
  ['RRR2201', 'EGVN', '14:40', 'RRR2202', 'EGVN', '16:10', 'A332', '25',      'S1'],
  [null,      null,   null,    'VJT612',  'EGLF', '15:10', 'GLF6', '57',      'N1'],
  ['NJE478Q', 'LEMD', '15:40', null,      null,   null,    'C56X', '567',     null],
  ['TOM6262', 'EGGW', '16:00', 'TOM6263', 'EGGW', '16:55', 'B738', '6',       '1'],
  ['EJU5521', 'LFPG', '16:20', 'EJU5522', 'LFPG', '17:00', 'A20N', '47',      '3'],
  ['BAW492',  'EGLL', '17:55', 'BAW493',  'EGLL', '18:55', 'A20N', '1234567', '2'],
  ['C56XG',   'LEMG', '18:30', null,      null,   null,    'C56X', '146',     null],
  [null,      null,   null,    'GLF6R',   'LFMN', '19:00', 'GLF6', '15',      'N1'],
  ['EZY8901', 'EGKK', '19:05', 'EZY8902', 'EGKK', '19:45', 'A20N', '1234567', '3'],
  ['RAM1477', 'GMTT', '19:10', 'RAM1478', 'GMTT', '19:35', 'AT76', '1357',    '4'],
  ['EZY6497', 'EGGD', '19:40', 'EZY6498', 'EGGD', '20:20', 'A319', '1357',    '5'],
  ['EZY2069', 'EGCC', '19:50', 'EZY2070', 'EGCC', '20:30', 'A320', '2467',    '1'],
  ['EZY8905', 'EGKK', '21:15', 'EZY8906', 'EGKK', '21:55', 'A20N', '56',      '3']
];
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const REGS = { C56X: 'G-CXLS', GLF6: 'G-ULFS' };
const hm = t => +t.slice(0,2)*60 + +t.slice(3);
const gateFor = ap => ap === 'GMTT' || ap === 'GMMN' ? 'S' : ['EGCC','EGGD','EGVN','EGGW','LEZL'].includes(ap) ? 'W' : 'E';
// flights for a session starting at hour h (UTC) on day d (0 = Monday): arrivals appear about 15 min before landing,
// departures ask for start-up 6 min before off-blocks; the session runs about 75 minutes
function timetableFlights(d, h){
  const day = String(d + 1), t0 = h*60, out = [];
  for (const [ac, o, ta, dc, dd, td, t, days, stand] of TIMETABLE) {
    if (!days.includes(day)) continue;
    const reg = REGS[t];
    if (ac) { const m = hm(ta) - 15 - t0; if (m >= -10 && m <= 62) out.push({ cs: ac, t, k: 'ARR', o, gate: gateFor(o), m: Math.max(0, m), at: ta, ...(reg ? { reg } : {}) }); }
    if (dc) { const m = hm(td) - 6 - t0; if (m >= 0 && m <= 70) out.push({ cs: dc, t, k: 'DEP', d: dd, gate: gateFor(dd), m, at: td, ...(stand ? { stand } : {}), ...(reg ? { reg } : {}) }); }
  }
  return out.sort((a,b) => a.m - b.m);
}
// long-stay aircraft parked on the remote stands all day (representative): [callsign/registration, type, stand, days]
const LONG_STAY = [['RRR4419', 'A400', 'S2', '14'], ['GXJET', 'C56X', 'N2', '2357'], ['GOMAR', 'PC12', 'N2', '146']];
// what is on the ground and in the air for a session: arrivals carry their turnaround departure; aircraft already parked
// at the start (inbound landed earlier, or a departure with no inbound today) are residents
function timetableSession(d, h){
  const day = String(d + 1), t0 = h*60, sched = [], residents = [];
  for (const [ac, o, ta, dc, dd, td, t, days, stand] of TIMETABLE) {
    if (!days.includes(day)) continue;
    const reg = REGS[t] ? { reg: REGS[t] } : {}, arrM = ac ? hm(ta) - t0 : null, depM = dc ? hm(td) - t0 : null;
    if (ac && arrM - 15 >= -10) {                                                     // the rest of the day's arrivals
      sched.push({ cs: ac, t, k: 'ARR', o, gate: gateFor(o), m: Math.max(0, arrM - 15), at: ta, ...reg, turn: dc ? { cs: dc, d: dd, depM, at: td, stand } : null });
    } else if ((!ac || arrM - 15 < -10) && dc && depM > 0) {
      residents.push({ cs: dc, t, k: 'RES', d: dd, gate: gateFor(dd), m: 0, depM, at: td, stand, ...reg });
    } else if (ac && !dc && arrM - 15 < -10) {
      residents.push({ cs: ac, t, k: 'RES', o, gate: gateFor(o), m: 0, depM: null, at: ta, ...reg });   // arrived earlier, staying
    }
  }
  for (const [cs, t, stand, days] of LONG_STAY) if (days.includes(day)) residents.push({ cs, t, k: 'RES', o: 'LXGB', gate: 'E', m: 0, depM: null, stand, longStay: true });
  return { sched, residents };
}
const SESSION_HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 06Z to 21Z, the civil operating day
const EXTRA = [
  { cs:'EXS96K',  t:'B738', k:'ARR', o:'EGCC', gate:'W' }, { cs:'EZY8915', t:'A20N', k:'DEP', d:'EGKK', gate:'E' },
  { cs:'EJU5521', t:'A20N', k:'ARR', o:'LFPG', gate:'E' }, { cs:'VJT612',  t:'GLF6', k:'DEP', d:'EGLF', gate:'E' },
  { cs:'TOM6262', t:'B738', k:'ARR', o:'EGGW', gate:'E' }, { cs:'RAM1473', t:'AT76', k:'DEP', d:'GMMN', gate:'S' },
  { cs:'NJE478Q', t:'C56X', k:'ARR', o:'LEMD', gate:'E' }, { cs:'EXS97K',  t:'B738', k:'DEP', d:'EGCC', gate:'W' },
  { cs:'BAW494',  t:'A21N', k:'ARR', o:'EGLL', gate:'E' }, { cs:'EJU5522', t:'A20N', k:'DEP', d:'LFPG', gate:'E' },
  { cs:'RRR4417', t:'A400', k:'ARR', o:'EGVN', gate:'W' }, { cs:'SWN12',   t:'PC12', k:'ARR', o:'LEZL', gate:'W' }
];
const EXERCISES = {
  dep: { name: 'Exercise 1 · First departure', wx: 'fair', sched: [{ cs:'BAW493', t:'A20N', k:'DEP', d:'EGLL', gate:'E', m: 0, stand:'3' }] },
  arr: { name: 'Exercise 2 · First arrival',   wx: 'fair', sched: [{ cs:'EZY8901', t:'A20N', k:'ARR', o:'EGKK', gate:'E', m: 0 }] },
  lev: { name: 'Exercise 3 · Levanter, runway 09', wx: 'levanter', sched: [{ cs:'BAW492', t:'A20N', k:'ARR', o:'EGLL', gate:'E', m: 0 }, { cs:'RAM1472', t:'AT76', k:'DEP', d:'GMTT', gate:'S', m: 1, stand:'S1' }] }
};
function buildSchedule(mode, day = 0, hour = 17){
  if (EXERCISES[mode]) return EXERCISES[mode].sched.map(x => ({...x}));
  const LS = /^live/.test(mode) && typeof liveSession === 'function' ? liveSession() : null;   // Real world: today's real flights
  const T = LS || timetableSession(day, Math.floor(hour)), s = [...T.residents, ...T.sched];
  if (mode !== 'real' && mode !== 'live') {
    // busier sessions add charters, positioning flights and business jets on top of the timetable
    const used = new Set(s.map(x => x.cs)), extra = EXTRA.filter(x => !used.has(x.cs));
    const n = mode === 'event' ? extra.length : Math.min(8, extra.length), span = mode === 'event' ? 50 : 66;
    extra.slice(0, n).forEach((x,i) => s.push({ ...x, m: Math.max(2, Math.round(4 + i*span/n + rnd(-2,2))) }));
    if (mode === 'event') s.forEach(x => { if (x.k === 'ARR' && x.m > 0) x.m = Math.round(x.m*0.7); });
  }
  return s.sort((a,b) => a.m - b.m);
}

// ═════════════════════════ weather ═════════════════════════
const WX_PRESETS = {
  fair:     { name:'Fair evening, light westerly',            short:'Fair',       metar:'LXGB 041850Z 26008KT 9999 FEW030 22/15 Q1018' },
  levanter: { name:'Levanter: easterly gale, cloud on the Rock', short:'Levanter', metar:'LXGB 041850Z 10026G38KT 9999 BKN012 20/17 Q1014' },
  southerly:{ name:'Southerly, severe turbulence in the lee',  short:'Southerly',  metar:'LXGB 041850Z 18020G30KT 9999 SCT018 21/16 Q1012' },
  poniente: { name:'Poniente: gusty south-westerly, waterspouts', short:'Poniente', metar:'LXGB 041850Z 23028G38KT 9999 SCT025 21/14 Q1009' },
  cross:    { name:'Strong northerly crosswind',               short:'Crosswind',  metar:'LXGB 041850Z 34020G30KT 9999 SCT020 18/10 Q1020' },
  fog:      { name:'Sea fog, below SRA minima',                short:'Sea fog',    metar:'LXGB 041850Z 10004KT 3000 BR BKN006 17/17 Q1019' },
  storm:    { name:'Thunderstorms in the Strait',              short:'Storms',     metar:'LXGB 041850Z 24016G30KT 6000 TSRA BKN014CB 19/17 Q1007' }
};
function parseMetar(m){
  m = m.trim().toUpperCase().replace(/\s+/g,' ');
  const w = { raw: m, dir: 0, spd: 0, gust: 0, vrb: false, vis: 9999, ceil: 9999, qnh: 1013, temp: 15, dew: 10, wx: [], cb: false, clouds: [] };
  for (const tok of m.split(' ')) {
    let r;
    if ((r = tok.match(/^(\d{3}|VRB)(\d{2,3})(G(\d{2,3}))?(KT|MPS)$/))) { const f = r[5]==='MPS' ? 1.944 : 1; w.vrb = r[1]==='VRB'; w.dir = w.vrb ? 0 : +r[1]; w.spd = Math.round(+r[2]*f); w.gust = r[4] ? Math.round(+r[4]*f) : 0; }
    else if (/^\d{4}$/.test(tok)) w.vis = +tok;
    else if ((r = tok.match(/^(\d{1,2})SM$/))) w.vis = Math.min(9999, +r[1]*1609);
    else if (tok === 'CAVOK') { w.vis = 9999; w.ceil = 9999; }
    else if ((r = tok.match(/^(BKN|OVC|VV)(\d{3})(CB|TCU)?$/))) { w.ceil = Math.min(w.ceil, +r[2]*100); if (r[3]) w.cb = true; w.clouds.push(tok); }
    else if ((r = tok.match(/^(FEW|SCT)(\d{3})(CB|TCU)?$/))) { if (r[3]) w.cb = true; w.clouds.push(tok); }
    else if ((r = tok.match(/^Q(\d{4})$/))) w.qnh = +r[1];
    else if ((r = tok.match(/^A(\d{4})$/))) w.qnh = Math.round(+r[1]/100*33.8639);
    else if ((r = tok.match(/^(M?\d{2})\/(M?\d{2})$/))) { w.temp = +r[1].replace('M','-'); w.dew = +r[2].replace('M','-'); }
    else if (/^[-+]?(VC)?(TS|SH|FZ|MI|BC)?(RA|DZ|SN|FG|BR|HZ|GR|GS)+$/.test(tok) || /^[-+]?(VC)?TS$/.test(tok)) w.wx.push(tok);
  }
  if (w.wx.some(x => x.includes('TS'))) w.cb = true;
  return w;
}
function windComp(w, crs){ const d = angDiff(crs, w.dir); const g = w.gust || w.spd; return { head: w.spd*Math.cos(d*D2R), cross: Math.abs(w.spd*Math.sin(d*D2R)), headG: g*Math.cos(d*D2R), crossG: Math.abs(g*Math.sin(d*D2R)) }; }
// Special Procedures (1): wind speed above which turbulence / windshear is likely on final (110°–250°M)
const TURB_TABLE = { 110:27, 120:22, 130:19, 140:17, 150:15, 160:14, 170:12, 180:11, 190:12, 200:13, 210:13, 220:15, 230:17, 240:19, 250:21 };
function turbExcess(w){
  if (w.vrb || w.dir < 105 || w.dir > 255) return 0;
  const k = clamp(Math.round(w.dir/10)*10, 110, 250); return Math.max(0, Math.max(w.spd, w.gust*0.85) - TURB_TABLE[k]);
}
const sraMinsOk = w => w.vis >= 5000 && w.ceil >= 1000;

// ═════════════════════════ state ═════════════════════════
const S = {
  t: 0, start: Date.UTC(2026, 9, 4, 18, 55, 0), speed: 1, paused: true, running: false,
  wx: parseMetar(WX_PRESETS.fair.metar), rwy: '27', atis: 'K', mode: 'summer',
  sched: [], acs: [], sel: null,
  xing: { st: 'OPEN', t: 0, queue: 0, totalClosed: 0 },
  score: { landed: 0, departed: 0, ga: 0, div: 0, los: 0, infr: 0, incidents: 0, pts: 0 },
  view: { cx: 0, cy: -2, scale: 14, name: 'app' }, showProc: true, voice: false, conflictSet: new Set(), conflicts: new Set(),
  listeners: []
};
const emit = (ev, data) => { for (const f of S.listeners) try { f(ev, data); } catch(e) {} };

// ═════════════════════════ R/T log & speech ═════════════════════════
const logEl = document.getElementById('log');
const zt = t => new Date(S.start + t*1000).toISOString().substr(11,8);
function log(cls, text, who){
  const div = document.createElement('div'); div.className = 'ln ' + cls;
  const tm = document.createElement('span'); tm.className = 'tm'; tm.textContent = zt(S.t).slice(0,5);
  const wh = document.createElement('span'); wh.className = 'who'; wh.textContent = who || (cls === 'sys' || cls === 'bad' ? 'SYSTEM' : '');
  const tx = document.createElement('span'); tx.className = 'tx'; tx.textContent = text;
  div.append(tm, wh, tx);
  logEl.appendChild(div); while (logEl.childNodes.length > 300) logEl.removeChild(logEl.firstChild);
  logEl.scrollTop = logEl.scrollHeight;
}
let voices = [];
function loadVoices(){ try { voices = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang)); } catch(e) {} }
try { speechSynthesis.onvoiceschanged = loadVoices; loadVoices(); } catch(e) {}
function hash(s){ let h = 0; for (const c of String(s)) h = (h*31 + c.charCodeAt(0))|0; return Math.abs(h); }
function say(text, who){
  if (!S.voice) return;
  try {
    const u = new SpeechSynthesisUtterance(text.replace(/FL(\d+)/g, (m,a) => 'flight level '+a.split('').map(d=>DIG[d]).join(' ')));
    if (voices.length) u.voice = who === 'atc' ? voices[0] : voices[1 + hash(who) % Math.max(1, voices.length-1)] || voices[0];
    u.rate = 1.15; u.pitch = who === 'atc' ? 1 : 0.8 + (hash(who) % 35)/100;
    speechSynthesis.speak(u);
  } catch(e) {}
}
function atc(ac, text){ const line = `${spoken(ac.cs)}, ${text}`; log('atc', line, ac.freq === 'TWR' ? 'TOWER' : 'RADAR'); say(line, 'atc'); }
function pilot(ac, text){ const line = `${text}, ${spoken(ac.cs)}`; log('plt', line, ac.cs); setTimeout(() => say(line, ac.cs), 300); }
function sys(text, bad){ log(bad ? 'bad' : 'sys', text); }
// landline coordination with Sevilla / Casablanca (not on the frequency)
function coord(text, who){ log('coord', text, who); say(text, who === 'GIBRALTAR' ? 'atc' : who); }
function requestRelease(ac){
  const who = relUnit(ac), sid = sidName(ac.gate, S.rwy);
  ac.rel = { st: 'REQ', at: S.t + rnd(35, 110) };
  coord(`${who}, Gibraltar, request release ${ac.cs}, ${ac.t} to ${ac.d}, ${sid}, runway ${S.rwy}`, 'GIBRALTAR');
}
function stepRelease(ac){
  const R = ac.rel, who = relUnit(ac);
  if (R.st === 'REQ' && S.t >= R.at) {
    if (Math.random() < 0.2) { const t = S.t + rnd(120, 240); R.nb = t + (60 - ((S.start/1000 + t) % 60)); }   // not before a whole minute
    R.st = 'OK'; R.until = (R.nb || S.t) + 600;
    coord(`Gibraltar, ${who}, ${ac.cs} released${R.nb ? ', not before ' + zt(R.nb).slice(0,5) : ''}, valid until ${zt(R.until).slice(0,5)}`, who.toUpperCase());
    if (S.sel === ac) renderSel();
  }
  if (R.st === 'OK' && ac.ground && !ac.cto && S.t > R.until) { R.st = 'EXP'; sys(`${ac.cs}: the ${who} release has expired. Request a new one with REL.`, true); if (S.sel === ac) renderSel(); }
}
const altWords = a => a > 6000 ? 'flight level '+Math.round(a/100) : 'altitude '+a.toLocaleString('en-GB')+' feet';
const altShort = a => a > 6000 ? 'FL'+Math.round(a/100) : a.toLocaleString('en-GB')+' feet';
const hdg3 = h => String(Math.round(h) % 360 || 360).padStart(3,'0');

// ═════════════════════════ aircraft ═════════════════════════
let sqk = 4610;
class Aircraft {
  constructor(f){
    Object.assign(this, f);
    this.perf = TYPES[f.t]; this.hist = []; this.histT = 0;
    this.mode = 'NAV'; this.route = []; this.turnDir = 0; this.tgtSpd = null; this.spdAssigned = false;
    this.app = null; this.ctl = false; this.cto = false; this.ground = false; this.onRwy = false; this.path = null;
    this.state = ''; this.need = null; this.handed = false; this.freq = 'RAD';
    this.ias = 0; this.alt = 0; this.vs = 0; this.hdg = 0; this.gs = 0; this.trk = 0; this.tgtAlt = null; this.cleared = null;
    this.sqk = String(sqk++).replace(/[89]/g, '7');
  }
  unit(){ return this.freq === 'TWR' ? 'Gibraltar Tower' : 'Gibraltar Radar'; }
  get airborne(){ return !this.ground; }
}

// arrivals show on radar about 35 NM beyond the boundary as pending tracks (not on frequency, no control) and call
// Gibraltar Radar when they reach the entry point inside the radar rings
const PRE_NM = 35, PRE_LEAD = 6.5*60;
const ENTRY_ALT = { E: 14000, W: 12000, S: 10000 }, PRE_ALT = { E: 26000, W: 24000, S: 20000 };
const greet = () => { const h = (new Date(S.start + S.t*1000).getUTCHours() + 2) % 24; return h < 12 ? 'good morning' : h < 18 ? 'good afternoon' : 'good evening'; };
function spawnArrival(f){
  const ac = new Aircraft(f); ac.kind = 'ARR';
  const e = ENTRY[f.gate], first = WP[ARR_ROUTE[f.gate][S.rwy][0]];
  const left = f.m*60 - S.t;
  if (f.m > 0 && left > 5) { // pending: outside the boundary, inbound to the entry point
    const L = Math.hypot(e[0] - GBR[0], e[1] - GBR[1]), u = [(e[0] - GBR[0])/L, (e[1] - GBR[1])/L], frac = clamp(left/PRE_LEAD, 0, 1);
    ac.x = e[0] + u[0]*PRE_NM*frac; ac.y = e[1] + u[1]*PRE_NM*frac;
    ac.alt = ENTRY_ALT[f.gate] + (PRE_ALT[f.gate] - ENTRY_ALT[f.gate])*frac; ac.ias = 300; ac.gs = 330;
    ac.hdg = ac.trk = brg(ac.x, ac.y, ...e); ac.state = 'PRE'; ac.preAt = f.m*60; ac.route = []; ac.freq = 'PRE';
    S.acs.push(ac); emit('spawn', ac);
    return ac;
  }
  const d0 = f.m === 0 ? 0.55 : 0;                     // the first arrival starts part-way in
  ac.x = e[0] + (first.p[0]-e[0])*d0; ac.y = e[1] + (first.p[1]-e[1])*d0;
  ac.alt = d0 ? 9000 : ENTRY_ALT[f.gate];
  S.acs.push(ac);
  makeInbound(ac);
  emit('spawn', ac);
  return ac;
}
function makeInbound(ac){
  const first = WP[ARR_ROUTE[ac.gate][S.rwy][0]];
  ac.tgtAlt = ac.cleared = ac.gate === 'E' ? 8000 : 7000; ac.freq = 'RAD';
  ac.ias = 260; ac.hdg = brg(ac.x, ac.y, ...first.p); ac.trk = ac.hdg; ac.state = 'INBOUND';
  ac.route = ARR_ROUTE[ac.gate][S.rwy].slice();
  pilot(ac, `Gibraltar Radar, ${greet()}, ${altShort(Math.round(ac.alt/100)*100)} descending ${altShort(ac.tgtAlt)}, inbound ${ac.route[0]}, information ${phonetic(S.atis)}`);
  ac.need = 'Initial call';
}
function stepPending(ac, dt){
  const e = ENTRY[ac.gate], d = dist(ac.x, ac.y, ...e), mv = ac.gs/3600*dt;
  ac.hdg = ac.trk = brg(ac.x, ac.y, ...e);
  if (d <= mv + 0.05 || S.t >= ac.preAt + 90) { ac.x = e[0]; ac.y = e[1]; ac.alt = ENTRY_ALT[ac.gate]; makeInbound(ac); return; }
  ac.x += (e[0] - ac.x)/d*mv; ac.y += (e[1] - ac.y)/d*mv;
  const left = Math.max(1, ac.preAt - S.t); ac.alt = Math.max(ENTRY_ALT[ac.gate], ac.alt - (ac.alt - ENTRY_ALT[ac.gate])*dt/left);
  ac.vs = -(ac.alt - ENTRY_ALT[ac.gate])/left*60;
}
function spawnDeparture(f){
  const ac = new Aircraft(f); ac.kind = 'DEP'; ac.freq = 'TWR';
  const wantSouth = isMil(ac);
  const st = STANDS.find(s => s.id === f.stand && !s.occ) || STANDS.find(s => !s.occ && (wantSouth ? s.area === 'south' : s.area !== 'south')) || STANDS.find(s => !s.occ);
  if (!st) return null;
  st.occ = ac; ac.stand = st;
  ac.x = st.p[0]; ac.y = st.p[1]; ac.hdg = st.hdg;
  ac.ground = true; ac.alt = ELEV; ac.state = 'PARKED';
  ac.reqAt = S.t + (f.m === 0 ? 8 : rnd(10, 40));
  S.acs.push(ac);
  emit('spawn', ac);
  return ac;
}
const isBiz = ac => ac.perf.wake === 'L' || ac.t === 'GLF6' || ac.t === 'C56X';
// an aircraft already on the ground when the session opens. Airliners with a long wait sit on a remote stand (south or
// north apron) and are towed to a terminal stand about 35 minutes before departure for the turnaround.
function spawnResident(f){
  const ac = new Aircraft(f); ac.freq = 'TWR'; ac.ground = true; ac.alt = ELEV;
  const wait = f.depM == null ? Infinity : f.depM;
  const remote = !isMil(ac) && !isBiz(ac) && wait > 45;
  const order = isMil(ac) ? ['south'] : isBiz(ac) ? ['north', 'civil'] : remote ? ['south', 'north', 'civil'] : ['civil', 'north'];
  let st = !remote && f.stand && STANDS.find(s => s.id === f.stand && !s.occ);
  for (const a of order) if (!st) st = STANDS.find(s => !s.occ && s.area === a);
  if (!st) return null;
  st.occ = ac; ac.stand = st; ac.x = st.p[0]; ac.y = st.p[1]; ac.hdg = st.hdg;
  if (f.depM == null) { ac.kind = 'ARR'; ac.state = 'ONSTAND'; ac.doneAt = Infinity; }
  else { ac.kind = 'DEP'; ac.state = 'PARKED'; ac.reqAt = Math.max(8, (f.depM - 6)*60); if (remote && st.area !== 'civil') ac.tow = { at: Math.max(20, (f.depM - 35)*60), pref: f.stand }; }
  S.acs.push(ac); emit('spawn', ac);
  return ac;
}
// after an arrival is on stand it becomes its own turnaround departure (new callsign), or stays parked
function turnRound(ac){
  const tr = ac.turn;
  if (!tr) { ac.doneAt = ac.stand ? Infinity : S.t + 120; return; }
  const was = ac.cs;
  Object.assign(ac, { cs: tr.cs, kind: 'DEP', d: tr.d, gate: gateFor(tr.d), o: undefined, state: 'PARKED', need: null, freq: 'TWR', turn: null,
    app: null, ctl: false, checked: false, shearChecked: false, warnedCtl: false, warned15: false, warned10: false, pushed: false, leftStand: false,
    hp: null, cto: false, exit: null, backtrack: false, taxiVia: [], face: null, held: false, handed: false, onRwy: false, path: null });
  ac.reqAt = Math.max(S.t + 20*60, (tr.depM - 6)*60);
  sys(`${was} is on stand ${ac.stand ? ac.stand.id : ''} and turns round as ${tr.cs} to ${tr.d}, off-blocks ${tr.at}Z.`);
  emit('turnround', ac);
}
function towPath(ac, to){
  const from = ac.stand, pts = [from.lp];
  const add = r => { if (r) for (const id of r.nodes.slice(1)) pts.push(GN[id].p); };
  if (from.area === 'south' && to.area !== 'south') {
    add(route(from.node, HOLDS.C.node)); pts.push(GN[HOLDS.C.rwy].p, ...filOut('C', 'E'), ...filIn('A', 'W'), GN[HOLDS.A.rwy].p, GN[HOLDS.A.node].p); add(route(HOLDS.A.node, to.node));
  } else add(route(from.node, to.node));
  pts.push(to.p);
  return pts;
}
function stepTows(){
  for (const ac of S.acs) {
    if (!ac.tow || ac.state !== 'PARKED' || ac.tow.asked || S.t < ac.tow.at) continue;
    const to = (ac.tow.pref && STANDS.find(s => s.id === ac.tow.pref && !s.occ && s.area === 'civil')) || STANDS.find(s => !s.occ && s.area === 'civil');
    if (!to) { ac.tow.at = S.t + 120; continue; }
    to.occ = ac; ac.tow.to = to; ac.tow.asked = true; ac.need = 'Request tow';
    const cross = ac.stand.area === 'south';
    log('plt', `Gibraltar Tower, tug with ${ac.cs} on stand ${ac.stand.id}, request tow to stand ${to.id}${cross ? ', crossing the runway from Charlie to Alpha' : ''}`, 'TUG');
    say(`Gibraltar Tower, tug with ${spoken(ac.cs)} on stand ${ac.stand.id}, request tow to stand ${to.id}`, 'tug');
  }
}
// parked aircraft with nothing due in the next 15 minutes stay off the strip board
const dormant = ac => ac.state === 'ONSTAND' || (ac.state === 'PARKED' && !ac.need && ac.reqAt - S.t > 15*60 && !(ac.tow && S.t >= ac.tow.at - 300));
function freeStand(ac){
  const area = isMil(ac) ? ['south'] : ac.perf.wake === 'L' || ac.t === 'GLF6' ? ['north','civil'] : ['civil','north'];
  for (const a of area) { const s = STANDS.find(s => !s.occ && s.area === a); if (s) return s; }
  return STANDS.find(s => !s.occ);
}
const ATIS_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const PHON_ALPHA = ['Alfa','Bravo','Charlie','Delta','Echo','Foxtrot','Golf','Hotel','India','Juliett','Kilo','Lima','Mike','November','Oscar','Papa','Quebec','Romeo','Sierra','Tango','Uniform','Victor','Whiskey','X-ray','Yankee','Zulu'];
const phonetic = l => PHON_ALPHA[ATIS_LETTERS.indexOf(l)] || l;
function nextAtis(alert = true){ S.atis = ATIS_LETTERS[(ATIS_LETTERS.indexOf(S.atis)+1) % 26]; if (alert) S.atisAlert = true; }   // the warning stays until the controller acknowledges it

// ═════════════════════════ ground movement ═════════════════════════
const P = (m, off=0) => rm(m, off);
function setPath(ac, pts, spd, onDone, opts={}){ ac.path = { pts: pts.map(p => [p[0],p[1]]), spd, onDone, ...opts }; }
function depHold(ac){
  if (ac.stand && ac.stand.area === 'south') return S.rwy === '27' ? 'D' : 'C';
  return S.rwy === '27' ? 'E' : 'A';
}
function taxiFrom(ac){ return ac.stand && !ac.leftStand ? ac.stand.node : nearestNode([ac.x, ac.y], n => !/^R/.test(n.id)).id; }
function taxiRoute(ac, hp, via){
  if (via && via.length) { const o = taxiOptions(ac, hp).find(r => r.via.join('') === via.join('')) || taxiOptions(ac, hp).find(r => via.every(v => r.via.includes(v))); if (o) return o; }
  return route(taxiFrom(ac), HOLDS[hp].node);
}
// every sensible routing to a holding point: simple paths over the taxiway graph, one per distinct "via", shortest first
function taxiOptions(ac, hp){
  const from = taxiFrom(ac), to = HOLDS[hp].node, out = [], seen = new Set();
  (function dfs(u, nodes, tws, len, vis){
    if (out.length > 40) return;
    if (u === to) { out.push({ nodes: [...nodes], tws: [...tws], len }); return; }
    for (const [v, e] of GN[u].adj) { if (vis.has(v) || (/^R/.test(v) && v !== to)) continue; vis.add(v); nodes.push(v); tws.push(e.tw); dfs(v, nodes, tws, len + e.len, vis); nodes.pop(); tws.pop(); vis.delete(v); }
  })(from, [from], [], 0, new Set([from]));
  out.sort((a, b) => a.len - b.len);
  const res = [];
  for (const r of out) { r.via = viaOf(r.tws, hp); const k = r.via.join(''); if (seen.has(k)) continue; seen.add(k); if (r.len > out[0].len*2.2 && res.length) continue; res.push(r); if (res.length === 3) break; }
  return res;
}
// pushback: straight back onto the taxilane, then along it so the nose ends up facing the chosen way
function pushPath(ac, face){
  const st = ac.stand, lm = mOf(st.lp), lo = offOf(st.lp);
  if (st.id === '1') return [st.lp, rm(1132, 124)];                       // stand 1 pushes back onto the curve to Alpha
  if (st.area === 'north') return [st.lp, rm(1411, 155)];                 // north stands push back down the apron taxiway
  const lim = st.area === 'civil' ? [1150, 1330] : [1060, 1185];
  const tail = face === 'west' ? 1 : -1;                     // facing east means the tail goes west
  return [st.lp, rm(clamp(lm + tail*40, lim[0], lim[1]), lo)];
}
const pushRec = ac => (depHold(ac) === 'E' || depHold(ac) === 'D') ? 'east' : 'west';
// turnaround on the turning circles (no 180s on the runway above 17 t MTOM)
// East pad lies north of the centreline (D1). The aircraft swings left round a 24 m radius circle on the pad
// and rejoins the centreline facing west. The west pad is the same figure rotated 180° (south side).
const TURN_PAD = { E: { c: [1733, 9], r: 21 }, W: { c: [26, -9], r: 21 } };
// east pad loop as mapped: in along the south side, round the east end, back west along the north side to the centreline
const TURN_E = [[1680,0],[1695.6,0.4],[1706.7,-1.5],[1712.2,-4],[1718.2,-9.1],[1726,-12.8],[1731.2,-13.5],[1737,-12.5],[1744,-9.7],[1748.3,-5],[1751.5,0.4],
  [1753.4,9.6],[1752.7,15.6],[1749,23.2],[1744,27.7],[1738.2,30.7],[1734.5,31],[1703.8,30.9],[1696,28.1],[1652.6,6.2],[1645.6,2.7],[1626.3,0.3]];
const TURN_W = TURN_E.map(([m,o]) => [+(1759 - m).toFixed(1), -o]);   // the west pad is the same figure turned round
const TURN_END = { E: TURN_E[TURN_E.length-1][0], W: TURN_W[TURN_W.length-1][0] };
function lineUpPath(ac, hp){
  const H = HOLDS[hp], pts = [GN[H.rwy].p];
  if (S.rwy === '27') { pts.push(...filOut(hp, 'E')); for (const [m,o] of TURN_E) if (m > H.m + 40) pts.push(P(m,o)); }
  else { pts.push(...filOut(hp, 'W')); for (const [m,o] of TURN_W) if (m < H.m - 40) pts.push(P(m,o)); }
  return pts;
}
function vacatePath(ac){
  const m = mOf([ac.x, ac.y]), dir = ac.rollDir;
  const st = freeStand(ac); if (st) st.occ = ac; ac.stand = st;
  const prefs = st && st.area === 'south' ? ['C','D'] : ['A','E'];
  if (ac.reqExit && !prefs.includes(ac.reqExit)) ac.reqExit = null;
  const pts = [];
  const filM = (e, d) => FIL[e][d > 0 ? 'W' : 'E'][0][0];
  let ex = (ac.reqExit && HOLDS[ac.reqExit] ? [ac.reqExit] : prefs).find(e => (filM(e, dir) - m)*dir > 15);
  ac.backtrack = false;
  if (!ex) { // roll on to the turning circle and backtrack
    let cur;
    if (dir < 0) { for (const [mm,o] of TURN_W) pts.push(P(mm,o)); cur = TURN_END.W; }
    else { for (const [mm,o] of TURN_E) pts.push(P(mm,o)); cur = TURN_END.E; }
    ex = (ac.reqExit && HOLDS[ac.reqExit] ? ac.reqExit : prefs.slice().sort((a,b) => Math.abs(HOLDS[a].m-cur) - Math.abs(HOLDS[b].m-cur))[0]);
    ac.backtrack = true;
  }
  const H = HOLDS[ex]; ac.exit = ex;
  const moving = ac.backtrack ? -dir : dir;
  pts.push(...filIn(ex, moving > 0 ? 'W' : 'E'), GN[H.rwy].p, GN[H.node].p);
  let via = [];
  if (st) { const r = route(H.node, st.node); if (r) { for (const id of r.nodes.slice(1)) pts.push(GN[id].p); via = viaOf(r.tws, ex); } pts.push(st.p); }
  ac.taxiVia = via;
  return pts;
}
function startLineUp(ac){
  ac.state = 'LINEUP'; ac.onRwy = true; ac.need = null;
  const back = true;
  setPath(ac, lineUpPath(ac, ac.hp), 18, () => { ac.state = 'LINEDUP'; ac.hdg = S.rwy === '27' ? CRS27 : CRS09; if (ac.cto) beginTakeoff(ac); else ac.need = 'Lined up'; });
  return back;
}

// ═════════════════════════ commands ═════════════════════════
function findAc(token){
  if (!token) return null; token = token.toUpperCase();
  return S.acs.find(a => a.cs === token) || (token.length >= 3 && /\d/.test(token) ? S.acs.find(a => a.cs.endsWith(token)) : null) || null;
}
function windPhrase(){ const w = S.wx; return `wind ${w.vrb ? 'variable' : hdg3(w.dir)+' degrees'} ${w.spd} knots${w.gust ? ' gusting '+w.gust : ''}`; }
const viaWords = v => v.length ? ' via ' + v.map(t => PHON[t] || t).join(', ') : '';
function command(str){
  const toks = str.trim().toUpperCase().split(/\s+/).filter(Boolean);
  if (!toks.length) return;
  let ac = findAc(toks[0]);
  if (ac) toks.shift(); else ac = S.sel;
  if (!ac || !S.acs.includes(ac)) { sys('Select a flight first, or start the command with its callsign.'); return; }
  if (ac.state === 'PRE') { select(ac); sys(`${ac.cs} is not on your frequency yet: it calls Gibraltar Radar at ${ARR_ROUTE[ac.gate][S.rwy][0] ? 'the boundary' : 'entry'}.`); return; }
  select(ac);
  const said = [], reads = [];
  const air = ac.airborne;
  if (ac.lost && !(toks.length === 1 && toks[0] === 'REL')) { sys(`${ac.cs} is not on your frequency: it was sent to ${ac.lost.f}. Wait for it to come back.`, true); return; }
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i]; let r;
    if ((r = t.match(/^([HLR])(\d{1,3})$/)) && air) {
      const h = (+r[2]) % 360 || 360; ac.mode = 'HDG'; ac.tgtHdg = h; ac.turnDir = r[1]==='L' ? -1 : r[1]==='R' ? 1 : 0; ac.route = []; ac.onSid = false;
      if (['HOLDING','INBOUND','FINAL'].includes(ac.state)) ac.state = 'VECTORS';
      const dif = angDiff(ac.hdg, h);
      const ts = r[1]==='L' ? 'turn left' : r[1]==='R' ? 'turn right' : (Math.abs(dif) < 4 ? 'fly' : dif < 0 ? 'turn left' : 'turn right');
      said.push(`${ts} heading ${hdg3(h)}`); reads.push(`${ts.replace('turn ','').replace('fly','')} heading ${hdg3(h)}`.trim());
    } else if ((r = t.match(/^[ACD](\d{1,5})$/)) && air) {
      let a = +r[1]; if (a < 400) a *= 100; a = clamp(a, 1000, 30000);
      const up = a > ac.alt + 50; ac.tgtAlt = ac.cleared = a; if (up && ac.need === 'Request climb') ac.need = null;
      const q = a <= 6000 && ac.alt > 6000 ? `, QNH ${S.wx.qnh}` : '';
      said.push(`${up ? 'climb' : 'descend'} ${altWords(a)}${q}`); reads.push(`${up?'climb':'descend'} ${altShort(a)}${q}`);
    } else if ((r = t.match(/^S(\d{2,3})$/)) && air && +r[1] > 0) {
      const s = clamp(+r[1], ac.perf.vapp, 330); ac.tgtSpd = s; ac.spdAssigned = true;
      said.push(`speed ${s} knots`); reads.push(`speed ${s}`);
    } else if ((t === 'SN' || t === 'S0') && air) { ac.spdAssigned = false; ac.tgtSpd = null; said.push('no speed restriction'); reads.push('no speed restriction'); }
    else if (t === 'DCT' && air) {
      const id = toks[i+1], w = id && WP[id];
      if (!w) { sys(`Unknown fix ${id||''}. Fixes: ${Object.keys(WP).join(' ')}`); return; }
      i++; const idx = ac.route.indexOf(id); ac.onSid = false;
      ac.route = idx >= 0 ? ac.route.slice(idx) : (ac.kind === 'DEP' && EXIT_ROUTE[ac.gate].includes(id) ? EXIT_ROUTE[ac.gate].slice(EXIT_ROUTE[ac.gate].indexOf(id)) : [id]); ac.mode = 'NAV';
      if (ac.alt < 3500 && crossesRock(ac, w.p)) sys(`Caution: ${ac.cs} direct ${id} tracks over the Rock.`, true);
      if (ac.state === 'HOLDING') ac.state = 'VECTORS';
      if (ac.kind === 'DEP' && ac.need && ac.need.startsWith('Request')) ac.need = null;
      if (ac.diverting && id === ac.diverting) { ac.need = null; ac.state = 'DIVERTING'; }
      said.push(`proceed direct ${id}`); reads.push(`direct ${id}`);
    } else if (t === 'APP' && air) {
      const rw = toks[i+1] === '09' || toks[i+1] === '27' ? toks[++i] : S.rwy;
      if (ac.kind !== 'ARR') { sys(`${ac.cs} is a departure.`); continue; }
      const lim = windLimit(ac, rw) || (sraMinsOk(S.wx) ? null : 'weather below SRA minima');
      if (lim) { atc(ac, `this will be a surveillance radar approach runway ${rw}`); pilot(ac, `unable, ${lim} for runway ${rw}, we'll hold and see if it improves`); ac.need = 'Unable approach'; if (!ac.divertAt && !ac.diverting) { ac.divertAt = S.t + 120; ac.divertTo = ac.gate === 'S' ? ['Tangier','TTN'] : ['Málaga','PIMOS']; } return; }
      ac.app = rw; ac.checked = false; ac.shearChecked = false; ac.warnedCtl = false; ac.diverting = null; ac.divertAt = null; ac.gaTurnDone = false;
      const F = FINAL[rw];
      if (ac.mode === 'HDG' && !willIntercept(ac, F)) { ac.mode = 'NAV'; ac.route = []; sys(`${ac.cs} is not on an intercept heading: it will route own navigation to ${rw === '27' ? '10 NM final' : 'RIPRA'}.`); }
      if (ac.mode === 'NAV' || ac.mode === 'HOLD') {
        const entry = rw === '27' ? 'F27' : 'RIPRA';
        const i2 = ac.route.indexOf(entry);
        ac.route = i2 >= 0 ? ac.route.slice(0, i2+1) : [entry];
        ac.mode = 'NAV'; ac.state = 'VECTORS';
      }
      if ((ac.cleared ?? 99999) > 3000 && ac.mode === 'NAV') { ac.tgtAlt = ac.cleared = 3000; said.push('descend altitude 3,000 feet' + (ac.alt > 6000 ? `, QNH ${S.wx.qnh}` : '')); reads.push('descend 3,000 feet'); }
      said.push(`this will be a surveillance radar approach runway ${rw}, terminating at Point ${F.name}, report visual`);
      reads.push(`SRA runway ${rw}, wilco`);
      if (ac.state === 'MISSED') { ac.state = 'VECTORS'; ac.gaTurn = true; }
      if (ac.need && /Initial|Holding|Missed|Request approach/.test(ac.need)) ac.need = null;
    } else if (t === 'HOLD' && air) {
      const fix = toks[i+1] && WP[toks[i+1]] ? toks[++i] : null;
      ac.mode = 'HOLD'; ac.state = 'HOLDING';
      ac.hold = fix ? { c: WP[fix].p, inb: (WP[fix].hold||{}).inb ?? brg(ac.x, ac.y, ...WP[fix].p), ph: 'in', name: fix } : { c: [ac.x, ac.y], inb: ac.hdg, ph: 'turn1', name: 'present position', t: 0 };
      said.push(`hold at ${ac.hold.name}, right hand pattern${fix ? ', inbound track '+hdg3(ac.hold.inb) : ''}, expect further clearance in one zero minutes`);
      reads.push(`hold ${ac.hold.name}`);
    } else if (t === 'CTL') {
      if (ac.kind !== 'ARR' || !air) { sys(`${ac.cs} is not on approach.`); continue; }
      const rw = ac.app || S.rwy; ac.ctl = true; ac.need = null; ac.freq = 'TWR';
      said.push(`runway ${rw}, cleared to land, ${windPhrase()}`); reads.push(`cleared to land runway ${rw}`);
      if (S.xing.st === 'OPEN' || S.xing.st === 'OPENING') sys('Winston Churchill Avenue is still open.');
    } else if (t === 'GA' && air) {
      if (ac.kind !== 'ARR') { sys(`${ac.cs} is a departure.`); continue; }
      goAround(ac, null); said.push('go around, I say again go around, climb altitude 4,000 feet'); reads.push('going around, climbing 4,000 feet');
    } else if (t === 'HO' || t === 'CONT') {
      if (!air) { sys(`${ac.cs} is on the ground and stays with Tower.`); continue; }
      const unit = ac.kind === 'DEP' ? (ac.freq === 'TWR' ? ['Gibraltar Radar','122.8'] : NEXT_UNIT[ac.gate]) : ['Gibraltar Tower','131.2'];
      const fq = toks[i+1] && /^1\d\d(\.\d{1,3})?$/.test(toks[i+1]) ? toks[++i] : unit[1];
      if (fq !== unit[1] && +fq !== +unit[1]) {   // wrong frequency: the crew reads it back, finds nobody there and comes back
        ac.lost = { f: fq, until: S.t + rnd(25, 45) };
        said.push(`contact ${unit[0]} ${fq}`); reads.push(`${fq}, ${ac.kind === 'DEP' && ac.freq !== 'TWR' ? 'good day' : 'thanks'}`);
        if (ac.need && /^(Airborne|Ready for transfer|Back on)/.test(ac.need)) ac.need = null;
        continue;
      }
      if (ac.kind === 'DEP' && ac.freq === 'TWR') { ac.freq = 'RAD'; if (ac.need && /^(Airborne|Back on)/.test(ac.need)) ac.need = null; }
      else if (ac.kind === 'DEP') { ac.handed = true; ac.need = null; }
      else { ac.freq = 'TWR'; if (ac.need === 'Back on frequency') ac.need = null; }
      said.push(`contact ${unit[0]} ${unit[1]}`); reads.push(`${unit[1]}, ${ac.handed ? 'good day' : 'thanks'}`);
    } else if (t === 'TOW') {
      if (ac.need !== 'Request tow' || !ac.tow || !ac.tow.to) { sys(`${ac.cs} has no tow request.`); continue; }
      const to = ac.tow.to, from = ac.stand, cross = from.area === 'south';
      setPath(ac, towPath(ac, to), 5, () => { ac.state = 'PARKED'; ac.stand = to; ac.hdg = to.hdg; ac.onRwy = false; ac.tow = null; ac.towCross = false; ac.leftStand = false; ac.pushed = false; sys(`${ac.cs} is on stand ${to.id}.`); });
      if (from.occ === ac) from.occ = null; ac.state = 'TOW'; ac.need = null; ac.towCross = cross;
      log('atc', `Tug with ${ac.cs}, tow approved to stand ${to.id}${cross ? ', cross runway ' + S.rwy + ' at Charlie, report vacated' : ''}`, 'TOWER');
      say(`Tug with ${spoken(ac.cs)}, tow approved to stand ${to.id}`, 'atc');
      return renderSel && renderSel();
    } else if (t === 'PUSH') {
      if (ac.state !== 'PARKED' || !ac.need || ac.need === 'Request tow') { sys(`${ac.cs} has not asked for start-up.`); continue; }
      const dir = { E:'east', EAST:'east', W:'west', WEST:'west' }[toks[i+1]]; if (dir) i++;
      const face = dir || pushRec(ac); ac.state = 'PUSH'; ac.need = null; ac.face = face; ac.sid = sidName(ac.gate, S.rwy);
      setPath(ac, pushPath(ac, face), 3, () => { ac.state = 'READY'; ac.pushed = true; ac.readyAt = S.t + rnd(25, 70); }, { reverse: true });
      const dn = AP[ac.d] ? AP[ac.d][2] : ac.d;
      said.push(`cleared to ${dn} via ${sidSpoken(ac.sid)} departure, climb altitude 4,000 feet, squawk ${ac.sqk}, start-up and push back approved, facing ${face}, QNH ${S.wx.qnh}`); reads.push(`cleared ${dn}, ${sidSpoken(ac.sid)}, 4,000 feet, squawk ${ac.sqk}, start and push approved facing ${face}, QNH ${S.wx.qnh}`);
    } else if (t === 'TAXI') {
      if (!(ac.state === 'READY' || ac.state === 'HOLDPT' || ac.state === 'TAXI' || ac.state === 'HELD' || (ac.state === 'PARKED' && ac.need))) { sys(`${ac.cs} is not ready to taxi.`); return; }
      let hp = toks[i+1] && HOLDS[toks[i+1]] ? toks[++i] : (ac.hp && ac.state !== 'READY' && ac.state !== 'PARKED' ? ac.hp : depHold(ac));
      const via = []; if (toks[i+1] === 'VIA') { i++; while (toks[i+1] && /^[ABCDE]$/.test(toks[i+1])) via.push(toks[++i]); }
      if (ac.stand && ac.stand.area === 'south' && (hp === 'A' || hp === 'E')) { sys(`${ac.cs} is on the south apron: it can only reach holding points C and D.`); continue; }
      if (ac.stand && ac.stand.area !== 'south' && (hp === 'C' || hp === 'D') && !ac.leftStand) { sys(`${ac.cs} is north of the runway: holding points C and D are on the south side.`); continue; }
      const rt = taxiRoute(ac, hp, via); if (!rt) { sys(`No taxi route to holding point ${hp}.`); continue; }
      ac.hp = hp;
      const pts = rt.nodes.map(id => GN[id].p);
      // pushed onto the lane already: don't taxi back to the stand's lead-in point if the next node is ahead
      if (ac.pushed && !ac.leftStand && pts.length > 1 && Math.abs(angDiff(ac.hdg, brg(ac.x, ac.y, ...pts[1]))) < 90 && Math.abs(angDiff(ac.hdg, brg(ac.x, ac.y, ...pts[0]))) > 90) pts.shift();
      if (ac.state === 'PARKED') { ac.pushed = false; pts.unshift(ac.stand.lp); }
      ac.state = 'TAXI'; ac.need = null; ac.leftStand = true; ac.held = false;
      setPath(ac, pts, 15, () => { ac.state = 'HOLDPT'; if (!ac.cto) { ac.need = 'Ready for departure'; pilot(ac, `holding point ${PHON[hp]}, ready for departure`); } else startLineUp(ac); });
      if (ac.stand && ac.stand.occ === ac) ac.stand.occ = null;
      const vw = viaOf(rt.tws, hp);
      said.push(`taxi to holding point ${PHON[hp]}${viaWords(vw)}, runway ${S.rwy}, QNH ${S.wx.qnh}`); reads.push(`holding point ${PHON[hp]}${viaWords(vw)}, runway ${S.rwy}, QNH ${S.wx.qnh}`);
    } else if (t === 'HP' || t === 'STOP') {
      if (air || !ac.path || ac.state === 'TAKEOFF') { sys(`${ac.cs} is not taxiing.`); continue; }
      ac.held = true; said.push('hold position'); reads.push('holding position');
    } else if (t === 'RES' || t === 'GO') {
      if (!ac.held) { sys(`${ac.cs} is not holding position.`); continue; }
      ac.held = false; said.push('continue taxi'); reads.push('continuing');
    } else if (t === 'LU') {
      if (ac.state !== 'HOLDPT') { sys(`${ac.cs} is not at a holding point.`); continue; }
      if (S.acs.some(o => o !== ac && o.onRwy)) sys('Careful: the runway is occupied.', true);
      if (S.xing.st !== 'CLOSED' && ((S.rwy === '09' && HOLDS[ac.hp].m > XING_M) || (S.rwy === '27' && HOLDS[ac.hp].m < XING_M))) sys('The backtrack crosses Winston Churchill Avenue: close the road first.', true);
      startLineUp(ac);
      said.push(`via ${PHON[ac.hp]}, line up and backtrack runway ${S.rwy}`); reads.push(`line up and backtrack runway ${S.rwy}`);
    } else if (t === 'CTO') {
      if (!['HOLDPT','LINEUP','LINEDUP'].includes(ac.state)) { sys(`${ac.cs} is not ready for takeoff.`); continue; }
      if (S.wx.vis < 1000) { atc(ac, `runway ${S.rwy}, cleared for takeoff`); pilot(ac, 'unable, visibility is below our 1,000 metre departure minimum'); return; }
      if (S.xing.st !== 'CLOSED') { atc(ac, `runway ${S.rwy}, cleared for takeoff`); pilot(ac, 'negative, the road crossing is still open, holding position'); return; }
      { const R = ac.rel, who = relUnit(ac);
        if (!R || R.st !== 'OK') { sys(`No release from ${who} for ${ac.cs}${R && R.st === 'REQ' ? ' yet: it is requested, wait for the call back' : R && R.st === 'EXP' ? ': it expired, request a new one with REL' : ': request one with REL first'}.`, true); continue; }
        if (R.nb && S.t < R.nb) { sys(`${who} released ${ac.cs} not before ${zt(R.nb).slice(0,5)}.`, true); continue; } }
      const sid = sidName(ac.gate, S.rwy), chg = ac.sid && ac.sid !== sid; ac.sid = sid;
      ac.cto = true; ac.need = null; ac.depRwy = S.rwy;
      if (ac.state === 'HOLDPT') startLineUp(ac);
      said.push(`${chg ? 'amended clearance, ' : ''}${sidSpoken(sid)} departure, runway ${S.rwy}, cleared for takeoff, ${windPhrase()}`); reads.push(`${chg ? 'amended, ' : ''}${sidSpoken(sid)}, cleared for takeoff runway ${S.rwy}`);
      if (ac.state === 'LINEDUP') beginTakeoff(ac);
    } else if (t === 'VAC') {
      if (ac.state !== 'ROLLED' && ac.state !== 'ROLLOUT') { sys(`${ac.cs} is not on the runway.`); continue; }
      if (toks[i+1] && HOLDS[toks[i+1]]) ac.reqExit = toks[++i];
      const pts = vacatePath(ac); ac.state = 'VACATING'; ac.need = null;
      setPath(ac, pts, 16, () => { ac.state = 'ONSTAND'; ac.hdg = ac.stand ? ac.stand.hdg : ac.hdg; emit('onstand', ac); turnRound(ac); });
      const stp = ac.stand ? `stand ${ac.stand.id}` : 'as directed';
      said.push(`${ac.backtrack ? 'backtrack, ' : ''}vacate via ${PHON[ac.exit]}, taxi ${stp}${viaWords(ac.taxiVia || [])}`); reads.push(`${ac.backtrack ? 'backtrack, ' : ''}vacate ${PHON[ac.exit]}, ${stp}`);
    } else if (t === 'REL') {
      if (ac.kind !== 'DEP' || air) { sys(`${ac.cs} doesn't need a departure release.`); continue; }
      if (ac.rel && ac.rel.st === 'REQ') { sys(`Release for ${ac.cs} already requested: ${relUnit(ac)} will call back.`); continue; }
      if (ac.rel && ac.rel.st === 'OK') { sys(`${ac.cs} is already released until ${zt(ac.rel.until).slice(0,5)}.`); continue; }
      requestRelease(ac);
    } else if (t === 'IDENT' || t === 'SQK') { said.push('squawk ident'); reads.push('ident'); }
    else { sys(`Didn't understand "${t}" for ${ac.cs}${!air && /^[HLRACDS]\d/.test(t) ? ' (it is on the ground)' : ''}.`); return; }
  }
  if (said.length) { atc(ac, said.join(', ')); pilot(ac, reads.join(', ')); if (ac.need === 'Initial call' || ac.need === 'Back on frequency') ac.need = null; emit('cmd', { ac, toks }); }
  renderSel(); renderStrips(true);
}
function willIntercept(ac, F){
  const probe = { x: ac.x, y: ac.y }; let prev = null;
  for (let d = 0; d < 30; d += 0.25) {
    probe.x = ac.x + Math.sin(ac.hdg*D2R)*d; probe.y = ac.y + Math.cos(ac.hdg*D2R)*d;
    const q = onFinal(probe, F);
    if (q.togo > 3.2 && q.togo < 25 && Math.abs(q.xte) < 0.45 && Math.abs(angDiff(ac.hdg, q.crs)) < 70) return true;
    if (prev && Math.sign(prev.xte) !== Math.sign(q.xte) && q.togo > 3.2 && q.togo < 25 && Math.abs(angDiff(ac.hdg, q.crs)) < 70) return true;
    prev = q;
  }
  return false;
}
function crossesRock(ac, p){ for (let f = 0; f <= 1; f += 0.02) { if (inPoly([ac.x + (p[0]-ac.x)*f, ac.y + (p[1]-ac.y)*f], ROCK)) return true; } return false; }
function beginTakeoff(ac){ ac.state = 'TAKEOFF'; ac.cto = true; ac.ias = 0; ac.depRwy = S.rwy; ac.hdg = S.rwy === '27' ? CRS27 : CRS09; ac.path = null; ac.need = null; emit('takeoff', ac); }
function windLimit(ac, rw){ const c = windComp(S.wx, rw === '09' ? CRS09 : CRS27); if (c.headG < -10) return 'tailwind out of limits'; if (c.crossG > (ac.perf.wake === 'L' ? 22 : 33)) return 'crosswind out of limits'; return null; }
function goAround(ac, why){
  if (ac.state === 'MISSED' || (ac.gaT && S.t - ac.gaT < 30)) return;
  const rw = ac.app || S.rwy;
  ac.state = 'MISSED'; ac.mode = 'HDG'; ac.tgtHdg = Math.round(rw === '09' ? CRS09 : CRS27); ac.turnDir = 0; ac.gaT = S.t;
  if (rw === '09' && ac.x < T09[0] - 0.4) { ac.tgtHdg = 200; ac.turnDir = -1; ac.gaTurnDone = true; } // still over the bay: turn away from the harbour and the Rock
  ac.tgtAlt = ac.cleared = 4000; ac.ctl = false; ac.app = null; ac.gaTurn = false; ac.checked = false; ac.shearChecked = false; ac.warnedCtl = false; ac.spdAssigned = false; ac.route = []; ac.freq = 'RAD';
  ac.gaRwy = rw; S.score.ga++; ac.gaCount = (ac.gaCount||0) + 1;
  if (why) pilot(ac, `going around, ${why}`);
  ac.need = 'Missed approach';
  if (ac.gaCount >= 2 && why) { // second weather/turbulence go-around: the crew elects to divert
    const alt = ac.gate === 'S' ? ['Tangier','TTN'] : ['Málaga','PIMOS'];
    ac.divertAt = S.t + 25; ac.divertTo = alt;
  }
  emit('ga', ac);
}

// ═════════════════════════ simulation ═════════════════════════
function windAt(alt){ const w = S.wx; const k = alt < 1500 ? 1 : 1.3; const g = w.gust ? Math.random()*(w.gust-w.spd) : 0; const s = (w.spd + g*0.4)*k; const toward = (w.dir+180)*D2R; return [Math.sin(toward)*s, Math.cos(toward)*s]; }
// position relative to a final path: nearest segment, track miles to go, cross-track (+ right), segment course
function onFinal(ac, F){
  let best = null;
  for (let i = 0; i < F.pts.length-1; i++) {
    const a = F.pts[i], b = F.pts[i+1], L = dist(...a, ...b), ux = (b[0]-a[0])/L, uy = (b[1]-a[1])/L;
    const t = clamp((ac.x-a[0])*ux + (ac.y-a[1])*uy, i === 0 ? -30 : 0, i === F.pts.length-2 ? L + 2 : L);
    const px = a[0]+ux*t, py = a[1]+uy*t, d = dist(ac.x, ac.y, px, py);
    if (!best || d < best.d - 1e-9) best = { d, i, togo: F.cum[i] - t, xte: (ac.x-a[0])*uy - (ac.y-a[1])*ux, crs: brg(...a, ...b), t, L };
  }
  return best;
}
const gpAlt = togo => ELEV + 40 + Math.max(0, togo)*297;   // 2.8° profile: 920 ft at 3 NM

function step(dt){
  S.t += dt;
  for (const f of S.sched) if (!f.spawned && S.t >= f.m*60 - (f.k === 'ARR' && f.m > 0 ? PRE_LEAD : 0)) { f.spawned = true; if (f.k === 'ARR') spawnArrival(f); else if (f.k === 'RES') spawnResident(f); else spawnDeparture(f); }
  const X = S.xing;
  if (X.st === 'CLOSING' && S.t >= X.t) { X.st = 'CLOSED'; sys('Winston Churchill Avenue closed: barriers down, crossing clear, FOD check complete.'); renderAtis(); emit('xing', 'CLOSED'); }
  if (X.st === 'OPENING' && S.t >= X.t) { X.st = 'OPEN'; renderAtis(); emit('xing', 'OPEN'); }
  if (X.st === 'CLOSED' || X.st === 'CLOSING') { X.queue += dt*0.8; X.totalClosed += dt; } else X.queue = Math.max(0, X.queue - dt*5);

  stepTows();
  for (const ac of S.acs) {
    if (ac.state === 'TOW') ac.onRwy = Math.abs(offOf([ac.x, ac.y])) < 35;
    if (ac.state === 'PRE') stepPending(ac, dt); else if (ac.ground) stepGround(ac, dt); else stepAir(ac, dt);
    if (ac.rel) stepRelease(ac);
    if (ac.lost && S.t >= ac.lost.until) { const f = ac.lost.f; ac.lost = null; S.score.pts -= 10; pilot(ac, `${ac.unit()}, back with you, no reply on ${f}`); ac.need = 'Back on frequency'; if (S.sel === ac) renderSel(); }
    ac.histT += dt; if (ac.histT >= 4) { ac.histT = 0; ac.hist.push([ac.x, ac.y]); if (ac.hist.length > 7) ac.hist.shift(); }
  }
  S.acs = S.acs.filter(ac => {
    if (ac.state === 'ONSTAND' && S.t > ac.doneAt) { if (S.sel === ac) S.sel = null; if (ac.stand) ac.stand.occ = null; return false; }
    if (ac.airborne && ac.state !== 'PRE' && Math.hypot(ac.x - GBR[0], ac.y - GBR[1]) > (ac.kind === 'DEP' ? 48 : ac.state === 'DIVERTING' ? 40 : 58)) {
      if (ac.kind === 'DEP') { if (!ac.handed) { S.score.pts -= 30; sys(`${ac.cs} left your area without being transferred.`, true); } else S.score.pts += 20; S.score.departed++; }
      else { S.score.div++; S.score.pts -= ac.state === 'DIVERTING' ? 0 : 40; sys(`${ac.cs} has left the area (diverted).`, ac.state !== 'DIVERTING'); }
      emit('exit', ac);
      if (S.sel === ac) S.sel = null; return false;
    }
    return true;
  });
  // separation: 3 NM / 1000 ft (2.5 NM between aircraft both established on final)
  const conf = new Set(), air = S.acs.filter(a => a.airborne && a.alt > 700 && a.state !== 'PRE');
  for (let i = 0; i < air.length; i++) for (let j = i+1; j < air.length; j++) {
    const a = air[i], b = air[j], d = dist(a.x,a.y,b.x,b.y);
    if (Math.abs(a.alt-b.alt) >= 950 || d >= 3) continue;
    if (a.mode === 'FINAL' && b.mode === 'FINAL' && d >= 2.5) continue;
    conf.add(a.cs); conf.add(b.cs);
    const key = [a.cs, b.cs].sort().join('|');
    if (!S.conflicts.has(key)) { S.conflicts.add(key); S.score.los++; S.score.pts -= 50; sys(`Loss of separation: ${a.cs} and ${b.cs} (${d.toFixed(1)} NM, ${Math.round(Math.abs(a.alt-b.alt))} ft).`, true); }
  }
  for (const k of [...S.conflicts]) { const [p,q] = k.split('|'); if (!conf.has(p) || !conf.has(q)) S.conflicts.delete(k); }
  S.conflictSet = conf;
}

function stepAir(ac, dt){
  const Pf = ac.perf, Wv = windAt(ac.alt);
  const dGBR = Math.hypot(ac.x - GBR[0], ac.y - GBR[1]);
  let fin = ac.mode === 'FINAL' ? onFinal(ac, FINAL[ac.app]) : null;
  // ── speed
  let tgtS = ac.tgtSpd;
  if (!ac.spdAssigned) {
    if (ac.kind === 'DEP') tgtS = ac.alt < 3000 ? Pf.vr + 45 : ac.alt < 10000 ? 250 : Pf.cruise;
    else if (fin) tgtS = fin.togo < 5 ? Pf.vapp : 170;
    else if (ac.state === 'MISSED') tgtS = 180;
    else tgtS = dGBR < 14 ? 190 : dGBR < 25 ? 220 : 250;
    tgtS = Math.min(tgtS, Pf.cruise);
  }
  if (fin && fin.togo < 4) tgtS = Math.min(tgtS, Pf.vapp + (fin.togo > 2.5 ? 15 : 0));
  ac.ias += clamp(tgtS - ac.ias, -1.3*dt, 2.0*dt);

  // ── lateral
  let tgtH = ac.hdg, track = false;
  if (ac.mode === 'NAV' && ac.route.length) {
    const w = WP[ac.route[0]], d = dist(ac.x, ac.y, ...w.p);
    if (ac.kind === 'ARR' && !ac.app && !ac.askedApp && ac.state !== 'DIVERTING' && ac.route.length === 1 && d < 8) { ac.askedApp = true; if (!ac.need) { ac.need = 'Request approach'; pilot(ac, `approaching ${/final/.test(w.note||'') ? w.note : w.id}, request surveillance radar approach runway ${S.rwy}`); } }
    tgtH = brg(ac.x, ac.y, ...w.p); track = true;
    if (d < Math.max(0.7, ac.gs/3600*22)) {
      ac.route.shift();
      if (!ac.route.length) {
        if (ac.kind === 'ARR' && ac.app) { ac.mode = 'FINAL'; fin = onFinal(ac, FINAL[ac.app]); }
        else if (ac.kind === 'ARR' && ac.state === 'DIVERTING') { ac.mode = 'HDG'; ac.tgtHdg = Math.round(ac.hdg); }
        else if (ac.kind === 'ARR') {
          // end of the arrival routing without an approach clearance: hold where it is (on the final entry fix), never fly back to UPMUP/ODLUK
          const named = !!w.hold, hf = w.id;
          ac.mode = 'HOLD'; ac.state = 'HOLDING'; ac.hold = { c: w.p, inb: named ? w.hold.inb : ac.hdg, ph: named ? 'in' : 'turn1', name: /final/.test(w.note||'') ? w.note : hf, t: 0 };
          pilot(ac, `no approach clearance, holding at ${ac.hold.name}, ${altShort(Math.round(ac.alt/100)*100)}, request surveillance radar approach`); ac.need = 'Request approach';
        }
        else { ac.mode = 'HDG'; ac.tgtHdg = Math.round(ac.hdg); }
      }
    }
  }
  if (ac.mode === 'HDG') tgtH = ac.tgtHdg;
  if (ac.mode === 'HOLD') {
    const h = ac.hold; h.t = (h.t||0) + dt;
    if (h.ph === 'in') { tgtH = brg(ac.x, ac.y, ...h.c); track = true; ac.turnDir = 0; if (dist(ac.x, ac.y, ...h.c) < 0.5) { h.ph = 'turn1'; h.t = 0; } }
    else if (h.ph === 'turn1') { tgtH = norm(ac.hdg + 90); ac.turnDir = 1; if (Math.abs(angDiff(ac.hdg, h.inb+180)) < 8) { h.ph = 'out'; h.t = 0; } }
    else if (h.ph === 'out') { tgtH = norm(h.inb + 180); track = true; ac.turnDir = 0; if (h.t > 60) { h.ph = 'turn2'; h.t = 0; } }
    else if (h.ph === 'turn2') { tgtH = norm(ac.hdg + 90); ac.turnDir = 1; if (Math.abs(angDiff(ac.hdg, h.inb)) < 25) h.ph = 'in'; }
  }
  // capture the SRA final from vectors
  if (ac.kind === 'ARR' && ac.app && ac.mode === 'HDG') {
    const q = onFinal(ac, FINAL[ac.app]);
    if (q.togo > 3.2 && q.togo < 25 && Math.abs(q.xte) < 0.45 && Math.abs(angDiff(ac.hdg, q.crs)) < 70 && (q.i > 0 || q.t > -12)) { ac.mode = 'FINAL'; fin = q; }
  }
  if (ac.mode === 'FINAL' && fin) {
    const F = FINAL[ac.app]; let crs = fin.crs;
    if (fin.i < F.pts.length-2 && fin.L - fin.t < 0.2) crs = brg(...F.pts[fin.i+1], ...F.pts[fin.i+2]);
    tgtH = norm(crs + clamp(-fin.xte*70, -35, 35)); track = true; ac.state = 'FINAL'; ac.turnDir = 0;
  }
  let hdgCmd = tgtH;
  if (track) { const tas = ac.ias*(1+ac.alt/1000*0.018) || 1; const cw = Wv[0]*Math.cos(tgtH*D2R) - Wv[1]*Math.sin(tgtH*D2R); hdgCmd = norm(tgtH - Math.asin(clamp(cw/tas, -0.5, 0.5))*R2D); }
  const diff = angDiff(ac.hdg, hdgCmd);
  const rate = (Pf.wake === 'H' ? 2.4 : 3) * (ac.mode === 'FINAL' ? 1.3 : 1);
  let turn = diff;
  if ((ac.mode === 'HDG' || ac.mode === 'HOLD') && ac.turnDir && Math.abs(diff) > 4) turn = ac.turnDir > 0 ? (diff < 0 ? 360+diff : diff) : (diff > 0 ? diff-360 : diff);
  if (ac.mode === 'HDG' && Math.abs(diff) < 2) ac.turnDir = 0;
  ac.hdg = norm(ac.hdg + clamp(turn, -rate*dt, rate*dt));

  // ── vertical
  let tgtA = ac.tgtAlt ?? ac.alt;
  if (fin) { const gp = gpAlt(fin.togo); tgtA = Math.min(ac.alt, gp, ac.cleared ?? 1e9); if (ac.alt > gp + 40) tgtA = gp; }
  const vmax = tgtA > ac.alt ? Pf.climb*(ac.alt > 10000 ? 0.7 : 1) : (fin ? (ac.alt > gpAlt(fin.togo) + 150 ? 2000 : 1100) : Pf.desc);
  if (fin && ac.alt <= gpAlt(fin.togo) + 150) {
    // on the glidepath: feed-forward the 2.8° descent rate, correct the error, flare onto the runway
    const gp = fin.togo > 0.05 ? gpAlt(fin.togo) : ELEV;
    ac.vs = clamp(-ac.gs*297/60 + (gp - ac.alt)*4, -2000, 300);
    if (ac.alt + ac.vs/60*dt < ELEV) ac.vs = (ELEV - ac.alt)*60/dt;
  } else ac.vs = clamp((tgtA - ac.alt)*3, -vmax, vmax);
  ac.alt += ac.vs/60*dt;

  // ── motion
  const tas = ac.ias*(1+ac.alt/1000*0.018);
  const vx = tas*Math.sin(ac.hdg*D2R) + Wv[0], vy = tas*Math.cos(ac.hdg*D2R) + Wv[1];
  ac.gs = Math.hypot(vx, vy); ac.trk = norm(Math.atan2(vx, vy)*R2D);
  ac.x += vx/3600*dt; ac.y += vy/3600*dt;

  // ── departures
  if (ac.kind === 'DEP' && (ac.state === 'AIRBORNE' || ac.state === 'CLIMB')) {
    if (ac.depRwy === '09' && !ac.turned && ac.alt >= 1500) { ac.turned = true; if (ac.mode === 'HDG' && ac.tgtHdg === Math.round(CRS09)) { ac.tgtHdg = 160; ac.turnDir = 1; } }
    if (ac.alt > 1000 && !ac.calledAir) { ac.calledAir = true; if (ac.freq === 'TWR') ac.need = 'Airborne, transfer to Radar'; }
    if (ac.freq === 'RAD' && !ac.calledRad) { ac.calledRad = true; ac.state = 'CLIMB'; pilot(ac, `Gibraltar Radar, passing ${Math.round(ac.alt/100)*100} feet climbing ${altShort(ac.tgtAlt)}, ${ac.onSid && ac.sid ? sidSpoken(ac.sid) + ' departure' : 'heading ' + hdg3(ac.hdg)}`); }
    const clearRock = ac.y < xy(36.095,0)[1] || ac.x > 2.5 || ac.alt > 3900;
    if (ac.onSid && ac.mode === 'HDG' && clearRock && (ac.alt > 3500 || !crossesRock(ac, WP[EXIT_ROUTE[ac.gate][0]].p))) { ac.onSid = false; ac.reqDct = true; ac.mode = 'NAV'; ac.route = EXIT_ROUTE[ac.gate].slice(); }
    if (ac.calledRad && !ac.reqDct && ac.mode === 'HDG' && clearRock) { ac.reqDct = true; const fx = EXIT_ROUTE[ac.gate][0]; pilot(ac, `request direct ${fx}`); ac.need = `Request direct ${fx}`; }
    if (ac.calledRad && !ac.reqClimb && !ac.need && ac.alt > 3600 && (ac.tgtAlt ?? 0) <= 4000) { ac.reqClimb = true; pilot(ac, `${ac.sid ? 'on the ' + sidSpoken(ac.sid) + ', ' : ''}request further climb`); ac.need = 'Request climb'; }
    if (ac.mode === 'NAV' && !ac.route.length) { ac.mode = 'HDG'; ac.tgtHdg = Math.round(ac.hdg); }
    if (ac.calledRad && !ac.handed && dGBR > 22 && !ac.askedHo) { ac.askedHo = true; ac.need = 'Ready for transfer'; }
  }

  if (ac.divertAt && S.t >= ac.divertAt) { ac.divertAt = null; pilot(ac, `we'd like to divert to ${ac.divertTo[0]}, request direct ${ac.divertTo[1]} climbing flight level 80`); ac.need = `Diverting to ${ac.divertTo[0]}`; ac.diverting = ac.divertTo[1]; }
  // ── missed approach: climb 4000, turn south once clear (left for 27, right for 09)
  if (ac.state === 'MISSED' && !ac.gaTurn && !ac.gaTurnDone && ac.alt > 1800) { ac.gaTurn = true; ac.tgtHdg = ac.gaRwy === '27' ? 200 : 160; ac.turnDir = ac.gaRwy === '27' ? -1 : 1; }

  // ── approach checks
  if (fin && ac.state !== 'MISSED') {
    const rw = ac.app, w = S.wx, F = FINAL[rw];
    if (!ac.warned15 && fin.togo < 15 && S.xing.st === 'OPEN') { ac.warned15 = true; sys(`${ac.cs} is inside 15 NM: close Winston Churchill Avenue to pedestrians now.`); }
    if (!ac.warned10 && fin.togo < 10) { ac.warned10 = true; if (S.xing.st === 'OPEN' || S.xing.st === 'OPENING') { S.score.pts -= 15; sys(`${ac.cs} at 10 NM with the road still open (late closure).`, true); } }
    if (!ac.checked && fin.togo < 3.05 && fin.togo > 1.5) { // Point X-Ray / Yankee decision
      ac.checked = true;
      if (!sraMinsOk(w)) return goAround(ac, `not visual at Point ${F.name}`);
      if (ac.alt < 880) { S.score.incidents++; S.score.pts -= 40; sys(`${ac.cs} crossed Point ${F.name} below 920 ft.`, true); }
      pilot(ac, `Point ${F.name}, visual`); ac.freq = 'TWR';
      if (!ac.ctl) ac.need = 'Visual, needs landing clearance';
    }
    if (!ac.shearChecked && fin.togo < 2) {
      ac.shearChecked = true;
      const ex = turbExcess(w);
      let p = ex > 0 ? clamp(0.1 + ex/30, 0, 0.55) : 0;
      if (rw === '27' && w.dir >= 200 && w.dir <= 250 && w.spd >= 25 && Math.random() < 0.25) return goAround(ac, 'waterspout on the approach');
      if (w.cb) p = Math.max(p, 0.15);
      const lim = windLimit(ac, rw); if (lim) return goAround(ac, lim);
      if (Math.random() < p) return goAround(ac, rw === '09' ? 'severe turbulence and windshear in the lee of the Rock' : 'windshear');
    }
    if (fin.togo < 0.9 && !ac.ctl && !ac.warnedCtl) { ac.warnedCtl = true; pilot(ac, `short final runway ${rw}, request landing clearance`); ac.need = 'Short final, no clearance'; }
    if (fin.togo < 0.4 && !ac.ctl) return goAround(ac, 'no landing clearance');
    if (fin.togo < 0.4 && S.acs.some(o => o !== ac && o.onRwy)) return goAround(ac, 'runway occupied');
    if (fin.togo < 0.4 && S.xing.st !== 'CLOSED') { S.score.incidents++; S.score.pts -= 60; sys(`${ac.cs} went around: Winston Churchill Avenue was not closed.`, true); return goAround(ac, 'people on the runway crossing'); }
    if (fin.togo < 1.5 && ac.alt > gpAlt(fin.togo) + 400) return goAround(ac, 'unstable, too high');
    if (fin.togo < 0.7) { // short final: settle onto the extended centreline (the 09 SRA joins it on a curve)
      const m = mOf([ac.x, ac.y]), off = offOf([ac.x, ac.y]);
      if (Math.abs(off) < 400) { const k = Math.exp(-dt*0.7); [ac.x, ac.y] = rm(m, off*k); ac.hdg = norm(ac.hdg + clamp(angDiff(ac.hdg, rw === '09' ? CRS09 : CRS27), -3*dt, 3*dt)); }
    }
    if (fin.togo < -0.12 && ac.alt < ELEV + 70) { // touchdown
      ac.ground = true; ac.onRwy = true; ac.alt = ELEV; ac.state = 'ROLLOUT'; ac.mode = 'GROUND'; ac.vs = 0;
      ac.rollDir = rw === '09' ? 1 : -1; ac.hdg = rw === '09' ? CRS09 : CRS27; { const m = mOf([ac.x, ac.y]), off = offOf([ac.x, ac.y]); [ac.x, ac.y] = rm(m, clamp(off, -8, 8)); } S.score.landed++; S.score.pts += 25; ac.need = null;
      emit('landed', ac);
    }
  }
  if (ac.alt < 30000 && inPoly([ac.x, ac.y], R164)) { if (!ac.infr) { ac.infr = true; S.score.infr++; S.score.pts -= 40; sys(`${ac.cs} has entered R164 (Spanish restricted area).`, true); } } else ac.infr = false;
  if (ac.alt < 3000 && inPoly([ac.x, ac.y], ROCK)) { if (!ac.terr) { ac.terr = true; S.score.incidents++; S.score.pts -= (ac.alt < 1800 ? 80 : 30); sys(`${ac.cs} is over the Rock at ${Math.round(ac.alt)} ft: overflight is prohibited${ac.alt < 1800 ? ', TERRAIN' : ''}.`, true); } } else ac.terr = false;
}

function stepGround(ac, dt){
  if (ac.state === 'PARKED' && ac.kind === 'DEP' && !ac.need && !ac.tow && S.t >= ac.reqAt) { ac.need = 'Request start-up'; pilot(ac, `Gibraltar Tower, stand ${ac.stand.id}, ${ac.perf.name} to ${ac.d}, information ${phonetic(S.atis)}, request start-up and push back`); }
  if (ac.state === 'READY' && !ac.need && S.t >= ac.readyAt) { ac.need = 'Ready to taxi'; pilot(ac, 'ready to taxi'); }
  if (ac.path) {
    const tgt = ac.path.pts[0], d = dist(ac.x, ac.y, ...tgt);
    let spd = ac.path.spd;
    if (ac.path.pts.length > 1) { // slow for corners
      const nxt = ac.path.pts[1], turn = Math.abs(angDiff(brg(ac.x, ac.y, ...tgt), brg(...tgt, ...nxt)));
      if (d < 0.025 && turn > 35) spd = Math.min(spd, 8);
    }
    if (ac.held) spd = 0;
    // a tow crossing from Charlie holds short of the runway while anything is at, or taxiing to, holding point Alpha,
    // where the crossing comes off; otherwise the tug and that departure block each other with the runway occupied
    if (ac.state === 'TOW' && ac.towCross && !ac.onRwy && spd > 0) {
      const off = offOf([ac.x, ac.y]);
      if (off < -36 && off > -90) {
        const blk = S.acs.find(o => o !== ac && o.ground && o.hp === 'A' && ['TAXI', 'HOLDPT', 'LINEUP', 'LINEDUP'].includes(o.state));
        if (blk) { spd = 0; if (ac.waiting !== blk.cs) { ac.waiting = blk.cs; log('plt', `tug with ${ac.cs}, holding short of the runway at Charlie, traffic for Alpha`, 'TUG'); } }
      }
    }
    // give way: stop if another aircraft on the ground is close ahead
    if (!ac.path.reverse && spd > 0) for (const o of S.acs) {
      if (o === ac || !o.ground) continue;
      const dd = dist(ac.x, ac.y, o.x, o.y)/M2NM; if (dd > 80 || dd < 1) continue;
      if (o.waiting === ac.cs && (ac.state === 'VACATING' || (o.state !== 'VACATING' && ac.cs < o.cs))) continue; // break a head-on stand-off: the aircraft leaving the runway goes first
      if (ac.onRwy && !o.onRwy && o.state === 'HOLDPT') continue;   // never stop on the runway for traffic waiting at a holding point
      if (Math.abs(angDiff(ac.hdg, brg(ac.x, ac.y, o.x, o.y))) < 40 && !(o.state === 'PARKED' || o.state === 'ONSTAND')) { spd = 0; ac.waiting = o.cs; break; }
    }
    if (spd > 0) ac.waiting = null;
    const mv = spd/3600*dt; ac.gs = spd; ac.ias = spd;
    if (d > 1e-6 && spd > 0) { const b = brg(ac.x, ac.y, ...tgt); const want = ac.path.reverse ? norm(b+180) : b; ac.hdg = norm(ac.hdg + clamp(angDiff(ac.hdg, want), -25*dt, 25*dt)); }
    if (spd === 0) {}
    else if (d <= mv) { ac.x = tgt[0]; ac.y = tgt[1]; ac.path.pts.shift(); if (!ac.path.pts.length) { const cb = ac.path.onDone; ac.path = null; ac.gs = 0; cb && cb(); } }
    else { ac.x += (tgt[0]-ac.x)/d*mv; ac.y += (tgt[1]-ac.y)/d*mv; }
  }
  if (ac.onRwy && ac.state === 'VACATING' && Math.abs(offOf([ac.x, ac.y])) > 45) ac.onRwy = false;
  if (ac.state === 'ROLLOUT') {
    ac.ias = Math.max(15, ac.ias - 4.2*dt); ac.gs = ac.ias;
    const mv = ac.ias/3600*dt; ac.x += RU[0]*ac.rollDir*mv; ac.y += RU[1]*ac.rollDir*mv;
    const m = mOf([ac.x, ac.y]), off = offOf([ac.x, ac.y]);
    if (Math.abs(off) > 0.05) [ac.x, ac.y] = rm(m, off*Math.exp(-dt*1.5));   // keep the roll-out on the centreline
    if (ac.ias <= 15.5 || m < 110 || m > 1700) { ac.state = 'ROLLED'; ac.gs = 0; ac.need = 'Request vacate'; pilot(ac, `runway ${ac.app}, request backtrack and taxi`); }
  }
  if (ac.state === 'TAKEOFF') {
    ac.ias += (ac.perf.wake === 'H' ? 4.0 : 4.2)*dt; ac.gs = ac.ias;
    const u = ac.depRwy === '27' ? -1 : 1, mv = ac.ias/3600*dt;
    ac.x += RU[0]*u*mv; ac.y += RU[1]*u*mv;
    if (ac.ias >= ac.perf.vr) {
      ac.ground = false; ac.onRwy = false; ac.state = 'AIRBORNE'; ac.mode = 'HDG'; ac.alt = ELEV + 10; ac.ias = ac.perf.vr;
      if (ac.depRwy === '27') { ac.tgtHdg = 200; ac.turnDir = -1; } else { ac.tgtHdg = Math.round(CRS09); ac.turnDir = 0; }
      ac.tgtAlt = ac.cleared = 4000; ac.onSid = true; S.score.pts += 10;
      emit('airborne', ac);
    }
  }
  // Road crossing: anything moving along the runway across the avenue with the barriers up is an incident
  if (ac.onRwy && ac.gs > 1) {
    const m = mOf([ac.x, ac.y]), mp = ac.lastM ?? m; ac.lastM = m;
    if ((mp - XING_M)*(m - XING_M) < 0 && Math.abs(offOf([ac.x, ac.y])) < 30 && S.xing.st !== 'CLOSED') {
      S.score.incidents++; S.score.pts -= 60; sys(`INCIDENT: ${ac.cs} crossed Winston Churchill Avenue with the barriers up.`, true);
    }
  } else ac.lastM = undefined;
}
