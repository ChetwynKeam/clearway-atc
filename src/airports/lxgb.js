
// ═════════════════════════ Gibraltar (LXGB) airport profile ═════════════════════════
// Everything the engine needs that is true only of Gibraltar. Loaded after core.js and before sim.js.

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
const PHON = { A:'Alpha', B:'Bravo', C:'Charlie', D:'Delta', E:'Echo' };

// Rock of Gibraltar (upper slopes, approximate) – summit 1398 ft. Overflight prohibited.
const ROCK = [[36.1468,-5.3462],[36.1452,-5.3418],[36.1400,-5.3388],[36.1320,-5.3380],[36.1240,-5.3392],[36.1170,-5.3410],[36.1132,-5.3440],[36.1185,-5.3478],[36.1290,-5.3492],[36.1380,-5.3490],[36.1440,-5.3482]].map(p=>xy(...p));
const ROCK_TOP = xy(36.1240,-5.3430);
// Frontier fence (D1) and R164 Spanish restricted area SFC–FL300 north of it (northern boundary approximated from K5)
const FRONTIER = [[-260,486],[-207,482],[300,452],[718,418],[1300,272],[1875,126],[1905,118]].map(([m,o]) => rm(m,o));
const R164 = [...FRONTIER.slice(1), ...[[36.1700,-5.3150],[36.2300,-5.2950],[36.3100,-5.3300],[36.3100,-5.4600],[36.2100,-5.4500],[36.1750,-5.4100],[36.1585,-5.3790]].map(p=>xy(...p))];

// ═════════════════════════ fixes & procedures (charts H1, K1, K2) ═════════════════════════
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
  FINAL['27'].ticks = true; WP.PTX.decLabel = 'X 920'; WP.PTY.decLabel = 'Y 920';
  FINAL['27'].entry = 'F27'; FINAL['27'].entryName = '10 NM final'; FINAL['09'].entry = 'RIPRA'; FINAL['09'].entryName = 'RIPRA';
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

const TEL = { BAW:'Speedbird', EZY:'Easy', EJU:'Alpine', RAM:'Royal Air Maroc', RRR:'Ascot', NJE:'Fraction', VJT:'Vista', EXS:'Channex', TOM:'Tomjet', SWN:'Swiss Ambulance' };
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
const REGS = { C56X: 'G-CXLS', GLF6: 'G-ULFS' };
const gateFor = ap => ap === 'GMTT' || ap === 'GMMN' ? 'S' : ['EGCC','EGGD','EGVN','EGGW','LEZL'].includes(ap) ? 'W' : 'E';
// long-stay aircraft parked on the remote stands all day (representative): [callsign/registration, type, stand, days]
const LONG_STAY = [['RRR4419', 'A400', 'S2', '14'], ['GXJET', 'C56X', 'N2', '2357'], ['GOMAR', 'PC12', 'N2', '146']];
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
// Special Procedures (1): wind speed above which turbulence / windshear is likely on final (110°–250°M)
const TURB_TABLE = { 110:27, 120:22, 130:19, 140:17, 150:15, 160:14, 170:12, 180:11, 190:12, 200:13, 210:13, 220:15, 230:17, 240:19, 250:21 };
function turbExcess(w){
  if (w.vrb || w.dir < 105 || w.dir > 255) return 0;
  const k = clamp(Math.round(w.dir/10)*10, 110, 250); return Math.max(0, Math.max(w.spd, w.gust*0.85) - TURB_TABLE[k]);
}
const sraMinsOk = w => w.vis >= 5000 && w.ceil >= 1000;

const ENTRY_ALT = { E: 14000, W: 12000, S: 10000 }, PRE_ALT = { E: 26000, W: 24000, S: 20000 };
function depHold(ac){
  if (ac.stand && ac.stand.area === 'south') return S.rwy === '27' ? 'D' : 'C';
  return S.rwy === '27' ? 'E' : 'A';
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

// ═════════════════════════ engine hooks ═════════════════════════
// Generic names the engine uses: the "low" runway lands in the direction of increasing m (rollDir +1).
const RW_LO = '09', RW_HI = '27', T_LO = T09, T_HI = T27, CRS_LO = CRS09, CRS_HI = CRS27, THR_LO_M = THR09_M, THR_HI_M = THR27_M;
const RADAR_REF = GBR;
const crsOf = rw => rw === RW_LO ? CRS_LO : CRS_HI;
const APT = {
  // published arrival altitudes (chart H2): UPMUP 3000, ODLUK 4000; the 2.8° SRA profile takes over on final
  arrAlt: { UPMUP: 3000, ODLUK: 4000 },
  icao: 'LXGB', name: 'Gibraltar', radarName: 'GBR', coordName: 'Gibraltar', utcOff: 2,
  radar: ['Gibraltar Radar', '122.8'], tower: ['Gibraltar Tower', '131.2'],
  xing: true, drawnTown: true, ta: 6000, initClimb: 4000, gaAlt: 4000, appAlt: 3000, handoffNM: 22,
  area: { dep: 48, arr: 58, div: 40 }, roll: [110, 1700], defRwy: '27', defWx: 'fair',
  appName: 'surveillance radar approach', appShort: 'SRA', minsText: 'weather below SRA minima', minsLong: 'Weather is below SRA minima (5 km, 1000 ft).',
  liveName: 'Gibraltar Airport', atisFreq: '131.2', climbFL: 80,
  faceHold: (st, f) => f === 'east' ? (st.area === 'south' ? 'D' : 'E') : (st.area === 'south' ? 'C' : 'A'),
  faceWord: f => f,
  taxiCheck(ac, hp){
    if (ac.stand && ac.stand.area === 'south' && (hp === 'A' || hp === 'E')) return `${ac.cs} is on the south apron: it can only reach holding points C and D.`;
    if (ac.stand && ac.stand.area !== 'south' && (hp === 'C' || hp === 'D') && !ac.leftStand) return `${ac.cs} is north of the runway: holding points C and D are on the south side.`;
    return null;
  },
  taxiHolds: south => south ? ['C', 'D'] : ['A', 'E'],
  taxiHint: rw => rw === '27' ? 'From Alpha or Charlie a runway 27 departure backtracks east to the turning circle.' : 'From Echo or Delta a runway 09 departure backtracks west across the road to the turning circle.',
  view: { app: [-2, -4, 84], twr: [1.4616, 0.1005, 4.6], gnd: [1000, 0, 1950, 820] },
  minsOk: (w, rw) => sraMinsOk(w),
  inboundAlt: gate => gate === 'E' ? 8000 : 7000,
  divertTo: ac => ac.gate === 'S' ? ['Tangier','TTN'] : ['Málaga','PIMOS'],
  vacExits: ac => isMil(ac) ? ['C','D'] : ['A','E'],
  vacPrefs: st => st && st.area === 'south' ? ['C','D'] : ['A','E'],
  terrain: { name: 'the Rock', poly: ROCK, min: 3000, low: 1800, msg: (ac) => `${ac.cs} is over the Rock at ${Math.round(ac.alt)} ft: overflight is prohibited${ac.alt < 1800 ? ', TERRAIN' : ''}.` },
  restricted: { poly: R164, top: 30000, label: 'R164  SFC–FL300', short: 'R164', labelAt: xy(36.245,-5.40), msg: ac => `${ac.cs} has entered R164 (Spanish restricted area).` },
  // missed approach: early turn while still over the bay on 09; later turn south (left for 27, right for 09)
  gaEarly(ac, rw){ if (rw === '09' && ac.x < T09[0] - 0.4) { ac.tgtHdg = 200; ac.turnDir = -1; ac.gaTurnDone = true; } },
  gaTurn(ac){ if (ac.alt > 1800) { ac.gaTurn = true; ac.tgtHdg = ac.gaRwy === '27' ? 200 : 160; ac.turnDir = ac.gaRwy === '27' ? -1 : 1; } },
  liftoff(ac){ if (ac.depRwy === '27') { ac.tgtHdg = 200; ac.turnDir = -1; } else { ac.tgtHdg = Math.round(CRS09); ac.turnDir = 0; } },
  depTurn(ac){ if (ac.depRwy === '09' && !ac.turned && ac.alt >= 1500) { ac.turned = true; if (ac.mode === 'HDG' && ac.tgtHdg === Math.round(CRS09)) { ac.tgtHdg = 160; ac.turnDir = 1; } } },
  depClear: ac => ac.y < xy(36.095,0)[1] || ac.x > 2.5 || ac.alt > 3900,
  shear(ac, rw, w){ if (rw === '27' && w.dir >= 200 && w.dir <= 250 && w.spd >= 25 && Math.random() < 0.25) return 'waterspout on the approach'; return null; },
  shearWhy: rw => rw === '09' ? 'severe turbulence and windshear in the lee of the Rock' : 'windshear'
};

// ═════════════════════════ aerodrome drawing (runway metres) ═════════════════════════
const AD_SITE = {
  // OpenStreetMap aprons in runway metres
  civil: [[1314.7,216.1],[1315.1,116.7],[1106.4,115.9],[1105.4,210.8],[1110.8,210.8],[1110.8,215.4]],
  north: [[1400.9,262.4],[1457.4,241.8],[1477.6,234.4],[1492.3,229.6],[1464.4,155.7],[1463.4,149.2],[1464,144.2],[1467.2,136.2],[1472.7,128.4],[1480.1,123.1],[1490.7,118.5],[1343.6,118.4],[1336.5,122.2],[1355,151],[1397.5,261.5]],
  south: [[1044.6,-90.9],[1042.2,-139.8],[1039.1,-148.3],[1026,-183.2],[1106.9,-225.4],[1138.8,-181],[1151.6,-190.4],[1173.9,-206.6],[1179.2,-193.8],[1197.6,-157.3],[1196.8,-91.7],[1169.6,-91.8],[1162.1,-99.7],[1153.5,-104.4],[1145.1,-106.7],[1135.3,-107.8],[1109.8,-108.2],[1100.8,-107.4],[1094.8,-105.9],[1086.8,-102.3],[1079.2,-96.9],[1072.8,-91]],
  closedB: [],
  roadN: [[1000,22],[1006,120],[1013,250],[1018,330],[1022,430],[1024,520]],
  roadS: [[985,-22],[973,-54],[943,-175],[920,-250],[885,-330],[858,-420],[840,-520]],
  terminal: [[1182,241],[1161,245],[1161,278],[1166,282],[1210,282],[1212,319],[1216,324],[1357,322],[1361,317],[1361,245],[1356,240]],
  atc: [[1032,200],[1020,209],[1028,214],[1028,256],[1033,261],[1047,260],[1051,255],[1051,204],[1046,199]],
  hangars: [[[990,-195],[966,-187],[960,-181],[981,-126],[987,-121],[1011,-129],[1017,-135],[996,-189]],
            [[1125,-266],[1103,-252],[1099,-244],[1124,-210],[1126,-189],[1133,-185],[1163,-205],[1167,-210],[1129,-264]],
            [[1033,-284],[999,-267],[978,-253],[982,-235],[1005,-243],[1046,-258],[1048,-262],[1037,-282]]],
  floods: [1125,1166,1206,1246,1293],
  aprons: [],
  roads: [],
  twyExtra: [['N', [[1430.3,207],[1440.4,234.4]]]], edgeLines: true,
  paag: [433, RWY_M - 405],
  twyLabels: [['B',1330,TW.B],['B',1490,TW.B],['A',TW.A,52],['E',TW.E,50],['C',TW.C,-55],['D',TW.D,-55]],
  hotspots: [['HS1', TW.A, 88]],
  labels: [['TERMINAL', 1225, 300], ['CIVIL APRON', 1235, 228], ['NORTH APRON', 1450, 240], ['SOUTH APRON · RAF', 1000, -230], ['ATC', 1056, 232],
    ['SPAIN · LA LÍNEA', 600, 520], ['GIBRALTAR', 1350, -420], ['WEST TURNING CIRCLE', 0, -78, 'near'], ['EAST TURNING CIRCLE', 1660, 75, 'near']]
};
AD_SITE.aprons = [AD_SITE.civil, AD_SITE.north, AD_SITE.south]; AD_SITE.shoulder = [196, 1690]; AD_SITE.serviceRoad = true;
AD_SITE.buildings = [{ pts: AD_SITE.terminal, h: 14, roof: 'terminal' }, { pts: AD_SITE.atc, h: 18, roof: 'atc' }, ...AD_SITE.hangars.map(p => ({ pts: p, h: 12, roof: 'hangar' }))]; AD_SITE.roads = [AD_SITE.roadN, AD_SITE.roadS];
