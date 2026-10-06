// ═════════════════════════ London City (EGLC) airport profile for the engine ═════════════════════════
// Builds every global the engine reads from the chart data in eglc.js and the OpenStreetMap aerodrome (taxiway
// centrelines, stands and the apron edge below, converted to runway metres from the 09 end of the pavement).
Object.assign(TYPES, EGLC.TYPES);
const LL = p => xy(p[0], p[1]);

// ── runway 09/27 (AD 2-EGLC-2-1): 1508 m × 30 m between the two AIP thresholds, which sit at the ends of the paved
// runway; the arrestor beds lie beyond each end. The frame runs from THR 09 (m = 0) along the centreline to THR 27.
const W_END = LL(EGLC.RWY.thr['09']), E_END = LL(EGLC.RWY.thr['27']);
const RWY_M = Math.round(dist(...W_END, ...E_END)/M2NM*10)/10;
const RU = [(E_END[0]-W_END[0])/(RWY_M*M2NM), (E_END[1]-W_END[1])/(RWY_M*M2NM)], RN = [-RU[1], RU[0]];   // along (east), normal (north)
function rm(m, off=0){ return [W_END[0] + (RU[0]*m + RN[0]*off)*M2NM, W_END[1] + (RU[1]*m + RN[1]*off)*M2NM]; }
function mOf(p){ return ((p[0]-W_END[0])*RU[0] + (p[1]-W_END[1])*RU[1]) / M2NM; }
function offOf(p){ return ((p[0]-W_END[0])*RN[0] + (p[1]-W_END[1])*RN[1]) / M2NM; }
const THR_LO_M = 0, THR_HI_M = RWY_M;
const RW_LO = '09', RW_HI = '27', T_LO = rm(THR_LO_M, 0), T_HI = rm(THR_HI_M, 0);
const CRS_LO = brg(...T_LO, ...T_HI), CRS_HI = norm(CRS_LO + 180);
const crsOf = rw => rw === RW_LO ? CRS_LO : CRS_HI;
const ELEV = 20;
const THR_ELEV = { '09': 19, '27': 20 };
const ARP = LL(EGLC.arp);
// no road crossing, no border fence, no rock
const XING_M = -1e9, XING_SKEW = 0, XING_HW = 0, xingM = o => XING_M;
const FRONTIER = [], R164 = [], ROCK = [], ROCK_TOP = [0, 0];

// ═════════════════════════ aerodrome layout (OpenStreetMap, checked against AD 2-EGLC-2-1 and 2-2) ═════════════════════════
// Taxiway T runs the length of the airport south of the runway; links A to F and K, L, M join it to the runway, most
// of them as a pair of curved fillets (one each way) meeting at the holding point. Runway 09 departures use Alpha (or
// Bravo), runway 27 departures Mike at the far east end: both are full length, so nobody backtracks unless they ask
// for an intersection further in.
// taxiway T, the parallel taxiway south of the runway (T1 by the GA apron to T9 by Mike), one node per junction and stand lead-in
const T_PTS = [[-220.1,-53.9],[-173.8,-54.1],[-170.1,-54.1],[-164.7,-54.1],[-161.2,-55.1],[-141.6,-64.9],[-138.3,-66.4],[-134.7,-67.2],[-131.4,-67.3],[-119.8,-67.4],[-85.8,-67.2],[-59.0,-67.1],[-49.6,-67.3],[-46.1,-67.6],[-38.3,-69.0],[-31.3,-70.5],[-20.2,-74.3],[-16.4,-76.2],[-12.6,-77.5],[-8.2,-78.0],[-1.9,-78.1],[13.9,-78.3],[18.2,-78.6],[22.4,-79.3],[27.1,-80.5],[30.3,-81.5],[34.1,-82.7],[36.2,-83.5],[38.7,-84.4],[41.6,-85.3],[45.3,-86.1],[49.2,-86.5],[52.7,-86.7],[56.7,-86.7],[68.7,-86.6],[94.1,-86.7],[112.1,-86.7],[155.5,-86.6],[198.7,-86.6],[242.1,-86.6],[285.4,-86.6],[306.5,-86.4],[328.7,-86.5],[363.6,-86.5],[384.9,-86.5],[391.9,-86.4],[414.7,-86.4],[419.9,-86.5],[423.8,-87.1],[428.0,-88.0],[433.7,-89.8],[438.6,-91.7],[443.6,-93.3],[447.4,-93.9],[452.0,-94.0],[461.3,-94.0],[477.8,-94.0],[508.5,-94.0],[554.3,-94.0],[556.1,-93.9],[603.2,-93.9],[635.5,-94.0],[651.0,-94.0],[664.6,-94.0],[698.4,-94.0],[745.7,-94.0],[793.0,-94.0],[815.5,-94.0],[846.4,-93.9],[1009.8,-93.6],[1060.5,-93.6],[1293.2,-93.4],[1365.1,-93.5],[1387.8,-93.4]];
const offT = m => { for (let i = 0; i < T_PTS.length - 1; i++) { const [a, oa] = T_PTS[i], [b, ob] = T_PTS[i+1]; if (m >= a && m <= b) return oa + (ob - oa)*(m - a)/(b - a || 1); } return m < T_PTS[0][0] ? T_PTS[0][1] : T_PTS[T_PTS.length-1][1]; };
const T_M = [-220.1, -119.8, -85.8, -49.6, -1.9, 30.3, 34.1, 38.7, 68.7, 94.1, 112.1, 155.5, 198.7, 242.1, 285.4, 306.5, 328.7, 363.6, 391.9, 461.3, 477.8, 508.5, 554.3, 603.2, 635.5, 651.0, 698.4, 745.7, 793.0, 1060.5, 1293.2, 1365.1, 1387.8];
T_M.forEach((m, i) => gn('T' + i, m, offT(m)));
for (let i = 0; i < T_M.length - 1; i++) { const a = T_M[i], b = T_M[i+1], mid = T_PTS.filter(([m]) => m > a + 1 && m < b - 1); chain('T' + i, mid, 'T' + (i+1), 'T'); }
// runway fillets: each starts on the centreline and curves off to the link (W: the side towards the 09 end, E: towards the 27 end)
const FIL = {
  A: { W: [[49.1,-0.4],[37.2,-0.6],[33.4,-1.3],[28.8,-2.3],[24.3,-4.2],[19.8,-6.9],[16.0,-10.4],[13.3,-13.6],[10.9,-17.7],[9.0,-22.6],[8.0,-27.2],[7.8,-32]], E: [[49.1,-0.4],[37.2,-0.6],[33.4,-1.3],[28.8,-2.3],[24.3,-4.2],[19.8,-6.9],[16.0,-10.4],[13.3,-13.6],[10.9,-17.7],[9.0,-22.6],[8.0,-27.2],[7.8,-32]] },
  B: { W: [[49.1,-0.4],[53.7,-1.8],[58.0,-3.5],[61.3,-5.8],[63.9,-8.2],[66.0,-11.5],[67.6,-14.9],[68.3,-18.7],[68.5,-22.2],[68.6,-26.2],[68.6,-30.3]], E: [[97.4,-0.4],[92.1,-1.7],[87.3,-3.2],[82.4,-5.8],[78.5,-8.6],[75.5,-11.8],[72.9,-15.3],[71.1,-18.6],[69.8,-22.3],[69.0,-26.2],[68.6,-30.3],[68.6,-32]] },
  C: { W: [[305.9,-0.4],[308.9,-1.4],[312.0,-2.2],[316.0,-3.6],[319.3,-5.4],[322.3,-7.4],[324.9,-9.9],[327.2,-12.5],[329.2,-15.3],[330.9,-18.7],[332.2,-22.2],[333.1,-25.7],[333.5,-29.5],[333.5,-32]], E: [[361.4,-0.3],[357.7,-1.5],[354.2,-2.5],[350.6,-3.8],[347.4,-5.7],[344.6,-7.6],[341.7,-10.3],[339.4,-13.0],[337.5,-15.9],[336.1,-18.8],[334.8,-22.3],[334.0,-25.6],[333.5,-29.5]] },
  D: { W: [[367.5,-0.4],[371.1,-1.7],[374.2,-2.9],[377.4,-4.2],[380.5,-5.9],[383.2,-7.8],[385.7,-10.3],[407.3,-32]], E: [[448.0,-0.3],[442.1,-1.6],[436.8,-3.4],[432.1,-5.9],[428.2,-9.0],[425.0,-12.3],[422.4,-16.2],[420.7,-20.1],[419.4,-24.5],[418.6,-29.2],[418.7,-32]] },
  E: { W: [[587.4,-0.3],[593.2,-1.7],[598.3,-3.3],[602.6,-5.5],[606.9,-8.8],[610.5,-13.0],[612.9,-16.7],[614.9,-21.0],[616.1,-26.2],[616.4,-31.5],[616.3,-32]], E: [[672.1,-0.3],[664.0,-1.7],[657.7,-3.9],[652.6,-7.1],[647.8,-11.6],[639.5,-19.9],[627.4,-32]] },
  F: { W: [[1095.4,-0.2],[1104.5,-4.6],[1110.4,-9.2],[1115.6,-15.1],[1118.6,-24.0],[1118.9,-32]], E: [[1176.5,-0.1],[1168.5,-1.3],[1163.1,-2.8],[1157.8,-5.4],[1151.9,-10.1],[1130.0,-32]] },
  K: { W: [[1269.5,-0.1],[1275.6,-1.5],[1281.8,-2.8],[1287.3,-4.8],[1292.5,-7.5],[1297.5,-11.2],[1301.6,-15.0],[1304.9,-19.0],[1308.1,-24.0],[1311.3,-29.5],[1312.7,-32]], E: [[1345.8,-0.1],[1339.1,-1.9],[1333.2,-4.1],[1328.4,-7.0],[1324.4,-10.7],[1321.2,-15.1],[1318.9,-19.5],[1317.4,-24.3],[1316.7,-30.1],[1316.8,-32]] },
  L: { W: [[1447.9,-0.3],[1451.8,-1.6],[1455.2,-3.1],[1458.3,-5.1],[1460.8,-7.2],[1462.8,-10.0],[1464.4,-13.0],[1465.6,-16.3],[1466.0,-20.2],[1465.8,-24.0],[1464.8,-27.9],[1463.1,-31.6],[1462.8,-32]], E: [[1447.9,-0.3],[1451.8,-1.6],[1455.2,-3.1],[1458.3,-5.1],[1460.8,-7.2],[1462.8,-10.0],[1464.4,-13.0],[1465.6,-16.3],[1466.0,-20.2],[1465.8,-24.0],[1464.8,-27.9],[1463.1,-31.6],[1462.8,-32]] },
  M: { W: [[1464.8,-0.3],[1470.7,-1.5],[1476.3,-3.1],[1481.1,-5.5],[1485.5,-9.0],[1489.0,-12.9],[1491.6,-17.0],[1493.6,-21.7],[1494.9,-27.7],[1494.9,-32]], E: [[1464.8,-0.3],[1470.7,-1.5],[1476.3,-3.1],[1481.1,-5.5],[1485.5,-9.0],[1489.0,-12.9],[1491.6,-17.0],[1493.6,-21.7],[1494.9,-27.7],[1494.9,-32]] }
};
gn('RA', 7.8, -36); gn('HA', 11.3, -59.3); ge('RA', 'HA', 'A');
gn('RB', 68.6, -36); gn('HB', 68.6, -59.5); ge('RB', 'HB', 'B');
gn('RC', 333.5, -36); gn('HC', 333.5, -59.1); ge('RC', 'HC', 'C');
gn('RD', 413.0, -36); gn('HD', 429, -63.6); ge('RD', 'HD', 'D');
gn('RE', 621.8, -36); gn('HE', 604, -59.7); ge('RE', 'HE', 'E');
gn('RF', 1124.5, -36); gn('HF', 1093, -59.3); ge('RF', 'HF', 'F');
gn('RK', 1314.8, -36); gn('HK', 1327, -59.2); ge('RK', 'HK', 'K');
gn('RL', 1462.8, -36); gn('HL', 1429, -66.3); ge('RL', 'HL', 'L');
gn('RM', 1494.9, -36); gn('HM', 1495.1, -59.1); ge('RM', 'HM', 'M');
chain('HA', [[11.9,-60.9],[13.4,-63.8],[15.3,-66.7],[16.9,-69.0],[19.0,-71.3],[21.0,-73.5],[23.2,-75.5],[25.5,-77.5],[28.0,-79.2],[30.6,-80.8]], 'T6', 'A');
chain('HA', [[11.9,-60.9],[11.6,-64.1],[11.0,-67.3],[9.9,-69.9],[8.3,-72.4],[6.3,-74.5],[4.0,-76.1],[1.4,-77.2]], 'T4', 'A');
chain('HB', [[68.6,-63.0],[68.1,-66.2],[67.2,-68.7],[66.1,-71.6],[64.5,-74.3],[62.6,-76.6],[60.5,-78.8],[58.2,-80.7],[55.6,-82.2],[52.9,-83.4],[50.0,-84.2],[47.1,-84.8],[44.1,-84.9]], 'T7', 'B');
chain('HB', [[69.3,-62.9],[70.3,-66.1],[71.3,-68.5],[72.5,-71.3],[74.4,-74.1],[76.0,-76.1],[78.2,-78.1],[80.6,-80.3],[83.0,-81.9],[85.8,-83.5],[88.6,-84.7],[91.6,-85.7]], 'T9', 'B');
chain('HC', [[333.5,-60.7],[333.0,-62.9],[331.8,-66.1],[330.7,-68.7],[329.3,-71.4],[326.4,-76.5],[322.0,-80.0],[316.6,-83.1],[311.1,-85.4]], 'T15', 'C');
chain('HC', [[333.5,-60.7],[334.2,-63.1],[335.3,-65.9],[336.4,-68.6],[337.7,-71.3],[339.4,-73.9],[341.3,-76.3],[343.4,-78.3],[345.8,-80.3],[348.2,-82.0],[350.8,-83.5],[353.7,-84.6],[356.6,-85.5]], 'T17', 'C');
chain('HD', [[461.5,-86.1],[466.1,-89.4],[471.5,-92.3]], 'T20', 'D');
chain('HD', [[417.3,-66.9],[415.5,-71.0],[413.5,-74.3],[411.5,-76.8],[409.4,-78.8],[407.0,-80.8],[404.5,-82.4],[401.8,-83.8],[399.0,-85.0],[395.5,-86.0]], 'T18', 'D');
chain('HE', [[608.5,-70.2],[609.0,-72.7],[610.4,-76.5],[612.3,-79.9],[614.7,-83.2],[617.5,-86.1],[620.6,-88.7],[624.1,-90.7],[627.9,-92.4],[631.6,-93.5]], 'T24', 'E');
chain('HE', [[596.7,-62.7],[576.2,-83.3],[573.0,-86.0],[569.8,-88.7],[566.4,-90.8],[562.8,-92.4],[558.6,-93.5],[556.1,-93.8]], 'T22', 'E');
chain('HF', [[1090.6,-72.0],[1083.4,-79.3],[1078.9,-83.4],[1074.1,-87.4],[1070.2,-90.2],[1066.6,-91.8],[1063.4,-93.0]], 'T29', 'F');
chain('HK', [[1326.6,-64.8],[1326.0,-70.1],[1324.1,-75.8],[1322.0,-79.5],[1318.1,-84.2],[1313.8,-88.0],[1308.4,-90.9],[1302.5,-92.9]], 'T30', 'K');
chain('HK', [[1331.2,-64.1],[1336.6,-73.4],[1339.9,-78.7],[1343.4,-83.4],[1347.8,-87.6],[1353.1,-90.6],[1358.8,-92.6]], 'T31', 'K');
chain('HL', [[1419.2,-75.4],[1415.0,-79.7],[1410.8,-83.8],[1406.4,-87.7],[1401.1,-90.8],[1395.6,-92.6]], 'T32', 'L');
chain('HM', [[1495.1,-63.0],[1494.3,-70.0],[1492.4,-75.5],[1489.7,-80.6],[1485.9,-85.0],[1481.1,-88.6],[1475.9,-91.4],[1470.2,-93.1],[1463.0,-93.5]], 'T32', 'M');
const HOLDS = {
  A: { node: 'HA', rwy: 'RA', m: 11.3, off: -59.3, rgl: true },
  B: { node: 'HB', rwy: 'RB', m: 68.6, off: -59.5, rgl: true },
  C: { node: 'HC', rwy: 'RC', m: 333.5, off: -59.1, rgl: true },
  D: { node: 'HD', rwy: 'RD', m: 429, off: -63.6, rgl: true },
  E: { node: 'HE', rwy: 'RE', m: 604, off: -59.7, rgl: true },
  F: { node: 'HF', rwy: 'RF', m: 1093, off: -59.3, rgl: true },
  K: { node: 'HK', rwy: 'RK', m: 1327, off: -59.2, rgl: true },
  L: { node: 'HL', rwy: 'RL', m: 1429, off: -66.3, rgl: true },
  M: { node: 'HM', rwy: 'RM', m: 1495.1, off: -59.1, rgl: true }
};
// stands from AD 2-EGLC-2-2 (WGS84), nose-in off taxiway T: main apron 3-10, west apron 12-14, GA apron 15, east apron 21-28
const STANDS = [
  { id: '15', m: -239.2, off: -75.2, node: 'T0', area: 'north' },
  { id: '14', m: -122.6, off: -101.7, node: 'T1', area: 'north' },
  { id: '13', m: -85.3, off: -101.7, node: 'T2', area: 'north' },
  { id: '12', m: -43.9, off: -104.8, node: 'T3', area: 'north' },
  { id: '10', m: 5.7, off: -104.8, node: 'T5', area: 'civil' },
  { id: '9', m: 48.8, off: -112.5, node: 'T8', area: 'civil' },
  { id: '8', m: 92.1, off: -112.5, node: 'T10', area: 'civil' },
  { id: '7', m: 135.3, off: -112.4, node: 'T11', area: 'civil' },
  { id: '6', m: 178.8, off: -112.4, node: 'T12', area: 'civil' },
  { id: '5', m: 222.1, off: -112.4, node: 'T13', area: 'civil' },
  { id: '4', m: 265.4, off: -112.4, node: 'T14', area: 'civil' },
  { id: '3', m: 308.1, off: -113.3, node: 'T16', area: 'civil' },
  { id: '21', m: 442.1, off: -125.1, node: 'T19', area: 'civil' },
  { id: '22', m: 489.2, off: -125.4, node: 'T21', area: 'civil' },
  { id: '23', m: 536.5, off: -125.2, node: 'T22', area: 'civil' },
  { id: '24', m: 583.8, off: -125.3, node: 'T23', area: 'civil' },
  { id: '25', m: 634.0, off: -124.0, node: 'T25', area: 'civil' },
  { id: '26', m: 681.5, off: -124.1, node: 'T26', area: 'civil' },
  { id: '27', m: 728.6, off: -124.1, node: 'T27', area: 'civil' },
  { id: '28', m: 776.0, off: -123.9, node: 'T28', area: 'civil' }
];
STANDS.forEach(s => { s.p = rm(s.m, s.off); s.occ = null; s.lp = GN[s.node].p; s.hdg = brg(...s.lp, ...s.p); });
const OSM_TWY = [
  ['x35787', [[10.0,-55.5],[9.8,-54.7],[8.6,-50.8],[8.2,-47.5],[7.8,-32.3],[8.0,-27.2],[9.0,-22.6],[10.9,-17.7],[13.3,-13.6],[16.0,-10.4],[19.8,-6.9],[24.3,-4.2],[28.8,-2.3],[33.4,-1.3],[37.2,-0.6],[49.1,-0.4]]],
  ['x35789', [[361.4,-0.3],[357.7,-1.5],[354.2,-2.5],[350.6,-3.8],[347.4,-5.7],[344.6,-7.6],[341.7,-10.3],[339.4,-13.0],[337.5,-15.9],[336.1,-18.8],[334.8,-22.3],[334.0,-25.6],[333.5,-29.5]]],
  ['x35007', [[1269.5,-0.1],[1275.6,-1.5],[1281.8,-2.8],[1287.3,-4.8],[1292.5,-7.5],[1297.5,-11.2],[1301.6,-15.0],[1304.9,-19.0],[1308.1,-24.0],[1311.3,-29.5],[1319.7,-44.1],[1324.6,-52.8],[1328.2,-59.1],[1331.2,-64.1]]],
  ['x35083', [[1447.9,-0.3],[1451.8,-1.6],[1455.2,-3.1],[1458.3,-5.1],[1460.8,-7.2],[1462.8,-10.0],[1464.4,-13.0],[1465.6,-16.3],[1466.0,-20.2],[1465.8,-24.0],[1464.8,-27.9],[1463.1,-31.6],[1460.6,-34.7],[1457.2,-38.1],[1429.0,-66.3]]],
  ['x18958', [[1331.2,-64.1],[1336.6,-73.4],[1339.9,-78.7],[1343.4,-83.4],[1347.8,-87.6],[1353.1,-90.6],[1358.8,-92.6],[1365.1,-93.5]]],
  ['x18964', [[305.9,-0.4],[308.9,-1.4],[312.0,-2.2],[316.0,-3.6],[319.3,-5.4],[322.3,-7.4],[324.9,-9.9],[327.2,-12.5],[329.2,-15.3],[330.9,-18.7],[332.2,-22.2],[333.1,-25.7],[333.5,-29.5],[333.5,-59.1]]],
  ['x23064', [[68.6,-56.1],[68.6,-30.3],[69.0,-26.2],[69.8,-22.3],[71.1,-18.6],[72.9,-15.3],[75.5,-11.8],[78.5,-8.6],[82.4,-5.8],[87.3,-3.2],[92.1,-1.7],[97.4,-0.4]]],
  ['x23065', [[333.5,-60.7],[334.2,-63.1],[335.3,-65.9],[336.4,-68.6],[337.7,-71.3],[339.4,-73.9],[341.3,-76.3],[343.4,-78.3],[345.8,-80.3],[348.2,-82.0],[350.8,-83.5],[353.7,-84.6],[356.6,-85.5],[363.6,-86.5]]],
  ['x23068', [[672.1,-0.3],[664.0,-1.7],[657.7,-3.9],[652.6,-7.1],[647.8,-11.6],[639.5,-19.9],[612.2,-47.1],[599.8,-59.6],[596.7,-62.7]]],
  ['x26009', [[38.7,-84.4],[44.1,-84.9],[47.1,-84.8],[50.0,-84.2],[52.9,-83.4],[55.6,-82.2],[58.2,-80.7],[60.5,-78.8],[62.6,-76.6],[64.5,-74.3],[66.1,-71.6],[67.2,-68.7],[68.1,-66.2],[68.6,-63.0],[68.6,-59.5]]],
  ['x37023', [[815.5,-94.0],[793.0,-94.0],[745.7,-94.0],[698.4,-94.0],[664.6,-94.0],[651.0,-94.0],[635.5,-94.0],[603.2,-93.9],[556.1,-93.9],[554.3,-94.0],[508.5,-94.0],[477.8,-94.0],[461.3,-94.0],[452.0,-94.0],[447.4,-93.9],[443.6,-93.3],[438.6,-91.7],[433.7,-89.8],[428.0,-88.0],[423.8,-87.1],[419.9,-86.5],[414.7,-86.4],[391.9,-86.4],[384.9,-86.5],[363.6,-86.5],[328.7,-86.5],[306.5,-86.4],[285.4,-86.6],[242.1,-86.6],[198.7,-86.6],[155.5,-86.6],[112.1,-86.7],[94.1,-86.7],[68.7,-86.6],[56.7,-86.7],[52.7,-86.7],[49.2,-86.5],[45.3,-86.1],[41.6,-85.3],[38.7,-84.4],[36.2,-83.5],[34.1,-82.7],[30.3,-81.5],[27.1,-80.5],[22.4,-79.3],[18.2,-78.6],[13.9,-78.3],[-1.9,-78.1],[-8.2,-78.0],[-12.6,-77.5],[-16.4,-76.2],[-20.2,-74.3],[-31.3,-70.5],[-38.3,-69.0],[-46.1,-67.6]]],
  ['x37024', [[-46.1,-67.6],[-49.6,-67.3],[-59.0,-67.1],[-85.8,-67.2],[-119.8,-67.4],[-131.4,-67.3],[-134.7,-67.2],[-138.3,-66.4],[-141.6,-64.9],[-161.2,-55.1]]],
  ['x37025', [[-161.2,-55.1],[-164.7,-54.1],[-170.1,-54.1],[-173.8,-54.1],[-220.1,-53.9]]],
  ['x55374', [[1495.1,-59.1],[1494.9,-27.7],[1493.6,-21.7],[1491.6,-17.0],[1489.0,-12.9],[1485.5,-9.0],[1481.1,-5.5],[1476.3,-3.1],[1470.7,-1.5],[1464.8,-0.3]]],
  ['x55376', [[11.9,-60.9],[11.6,-64.1],[11.0,-67.3],[9.9,-69.9],[8.3,-72.4],[6.3,-74.5],[4.0,-76.1],[1.4,-77.2],[-1.9,-78.1]]],
  ['x55377', [[68.6,-30.3],[68.6,-26.2],[68.5,-22.2],[68.3,-18.7],[67.6,-14.9],[66.0,-11.5],[63.9,-8.2],[61.3,-5.8],[58.0,-3.5],[53.7,-1.8],[49.1,-0.4]]],
  ['x55378', [[608.5,-70.2],[608.2,-68.8],[607.9,-63.2],[608.3,-59.8],[608.6,-57.0],[612.2,-47.1],[614.4,-41.7],[615.8,-36.7],[616.4,-31.5],[616.1,-26.2],[614.9,-21.0],[612.9,-16.7],[610.5,-13.0],[606.9,-8.8],[602.6,-5.5],[598.3,-3.3],[593.2,-1.7],[587.4,-0.3]]],
  ['x55379', [[1429.0,-66.3],[1419.2,-75.4],[1415.0,-79.7],[1410.8,-83.8],[1406.4,-87.7],[1401.1,-90.8],[1395.6,-92.6],[1387.8,-93.4]]],
  ['x47360', [[367.5,-0.4],[371.1,-1.7],[374.2,-2.9],[377.4,-4.2],[380.5,-5.9],[383.2,-7.8],[385.7,-10.3],[411.4,-36.1],[419.1,-43.7],[425.7,-50.4],[433.7,-58.2]]],
  ['x47361', [[419.5,-57.6],[419.3,-52.7],[419.1,-43.7],[418.8,-34.6],[418.6,-29.2],[419.4,-24.5],[420.7,-20.1],[422.4,-16.2],[425.0,-12.3],[428.2,-9.0],[432.1,-5.9],[436.8,-3.4],[442.1,-1.6],[448.0,-0.3]]],
  ['x47362', [[411.4,-36.1],[414.0,-39.3],[415.8,-42.2],[417.1,-45.3],[418.2,-48.1],[418.9,-50.5],[419.3,-52.7]]],
  ['x47363', [[418.8,-34.6],[419.8,-39.2],[421.3,-43.0],[423.0,-46.6],[425.7,-50.4]]],
  ['x53600', [[1326.6,-64.8],[1326.0,-70.1],[1324.1,-75.8],[1322.0,-79.5],[1318.1,-84.2],[1313.8,-88.0],[1308.4,-90.9],[1302.5,-92.9],[1293.2,-93.4]]],
  ['x53608', [[1176.5,-0.1],[1168.5,-1.3],[1163.1,-2.8],[1157.8,-5.4],[1151.9,-10.1],[1113.9,-48.1]]],
  ['x53609', [[1095.4,-0.2],[1104.5,-4.6],[1110.4,-9.2],[1115.6,-15.1],[1118.6,-24.0],[1119.0,-33.9],[1117.1,-42.1],[1113.9,-48.1],[1105.1,-57.5],[1103.3,-59.3],[1090.6,-72.0]]],
  ['x03908', [[1090.6,-72.0],[1083.4,-79.3],[1078.9,-83.4],[1074.1,-87.4],[1070.2,-90.2],[1066.6,-91.8],[1063.4,-93.0],[1060.5,-93.6]]],
  ['x03909', [[1387.8,-93.4],[1463.0,-93.5],[1470.2,-93.1],[1475.9,-91.4],[1481.1,-88.6],[1485.9,-85.0],[1489.7,-80.6],[1492.4,-75.5],[1494.3,-70.0],[1495.1,-63.0],[1495.1,-59.1]]],
  ['x03910', [[1324.6,-52.8],[1326.2,-59.4],[1326.6,-64.8]]],
  ['x03911', [[1345.8,-0.1],[1339.1,-1.9],[1333.2,-4.1],[1328.4,-7.0],[1324.4,-10.7],[1321.2,-15.1],[1318.9,-19.5],[1317.4,-24.3],[1316.7,-30.1],[1317.0,-35.7],[1318.2,-40.1],[1319.7,-44.1]]],
  ['x03912', [[635.5,-94.0],[631.6,-93.5],[627.9,-92.4],[624.1,-90.7],[620.6,-88.7],[617.5,-86.1],[614.7,-83.2],[612.3,-79.9],[610.4,-76.5],[609.0,-72.7],[608.5,-70.2]]],
  ['x03913', [[596.7,-62.7],[576.2,-83.3],[573.0,-86.0],[569.8,-88.7],[566.4,-90.8],[562.8,-92.4],[558.6,-93.5],[556.1,-93.8],[554.3,-94.0]]],
  ['x03914', [[391.9,-86.4],[395.5,-86.0],[399.0,-85.0],[401.8,-83.8],[404.5,-82.4],[407.0,-80.8],[409.4,-78.8],[411.5,-76.8],[413.5,-74.3],[415.5,-71.0],[417.3,-66.9],[418.5,-63.7],[419.5,-57.6]]],
  ['x03915', [[433.7,-58.2],[439.2,-63.6],[461.5,-86.1],[466.1,-89.4],[471.5,-92.3],[477.8,-94.0]]],
  ['x03916', [[333.5,-59.1],[333.5,-60.7],[333.0,-62.9],[331.8,-66.1],[330.7,-68.7],[329.3,-71.4],[326.4,-76.5],[322.0,-80.0],[316.6,-83.1],[311.1,-85.4],[306.5,-86.4]]],
  ['x03917', [[94.1,-86.7],[91.6,-85.7],[88.6,-84.7],[85.8,-83.5],[83.0,-81.9],[80.6,-80.3],[78.2,-78.1],[76.0,-76.1],[74.4,-74.1],[72.5,-71.3],[71.3,-68.5],[70.3,-66.1],[69.3,-62.9],[68.6,-59.5],[68.6,-56.1]]],
  ['x03918', [[34.1,-82.7],[30.6,-80.8],[28.0,-79.2],[25.5,-77.5],[23.2,-75.5],[21.0,-73.5],[19.0,-71.3],[16.9,-69.0],[15.3,-66.7],[13.4,-63.8],[11.9,-60.9],[11.3,-59.3],[10.0,-55.5]]],
  ['x03919', [[1387.8,-93.4],[1365.1,-93.5],[1293.2,-93.4],[1060.5,-93.6],[1009.8,-93.6],[846.4,-93.9],[815.5,-94.0]]]
];
const APRONS = [[[0.1,-101.0],[-0.1,-120.5],[8.6,-129.9],[12.2,-132.7],[16.1,-134.8],[20.7,-135.9],[26.8,-136.6],[433.4,-136.4],[433.5,-155.6],[440.4,-162.7],[585.8,-162.8],[595.0,-162.3],[602.6,-161.1],[614.0,-159.5],[620.3,-158.7],[626.2,-158.6],[818.1,-158.4],[817.9,-116.8],[450.1,-118.6],[446.1,-118.3],[441.5,-117.4],[437.8,-116.1],[434.1,-114.2],[430.4,-111.9],[426.4,-110.3],[420.3,-108.9],[415.5,-108.8],[48.6,-109.1],[40.2,-108.3],[27.9,-105.1],[7.6,-101.0],[0.1,-101.0]],[[-138.1,-99.1],[-132.0,-124.4],[-85.8,-124.2],[-63.6,-124.1],[-24.6,-123.7],[-22.6,-110.4],[-32.3,-103.8],[-37.3,-101.8],[-43.0,-100.2],[-49.5,-99.3],[-57.3,-99.0],[-138.1,-99.1]],[[-290.4,-23.1],[-291.3,-90.9],[-244.2,-92.6],[-244.4,-101.1],[-227.8,-103.7],[-209.7,-89.5],[-220.0,-77.7],[-220.1,-53.9],[-220.7,-22.9],[-250.6,-22.8],[-290.4,-23.1]]];
// the turning areas at each end (2-1): a tight loop on the runway and its southern widening, for a backtrack
const TURN_W = [[52,0],[38,1],[28,3],[20,6],[15,5],[13,1],[14,-4],[19,-7],[27,-7],[35,-4],[44,-1],[56,0]];
const TURN_E = TURN_W.map(([m, o]) => [+(RWY_M - m).toFixed(1), -o]);
const TURN_PAD = {};
const TURN_END = { E: TURN_E[TURN_E.length-1][0], W: TURN_W[TURN_W.length-1][0] };
const PHON = { A: 'Alpha', B: 'Bravo', C: 'Charlie', D: 'Delta', E: 'Echo', F: 'Foxtrot', K: 'Kilo', L: 'Lima', M: 'Mike', T: 'Tango' };
const T_LIM = [T_M[0], T_M[T_M.length-1]];
function depHold(ac){ return S.rwy === RW_LO ? 'A' : 'M'; }
// every stand is nose-in off T: the tug pushes the tail back onto T, then 40 m along it
function pushPath(ac, face){
  const st = ac.stand, lm = mOf(st.lp), tail = face === 'west' ? 1 : -1, m = clamp(lm + tail*40, T_LIM[0], T_LIM[1]);
  return [st.lp, rm(m, offT(m))];
}
const pushRec = ac => depHold(ac) === 'M' ? 'east' : 'west';
// exits in the order an arrival meets them: 27 arrivals roll west and take the angled exits E, D or C; 09 arrivals
// roll east to F, K, L or M
const VAC_PREFS = st => S.rwy === RW_HI ? ['E', 'D', 'C', 'B', 'A'] : ['F', 'K', 'L', 'M'];
const FACE_HOLD = (st, f) => f === 'east' ? 'M' : 'A';
const TAXI_HINT = {
  '27': 'Runway 27 departures normally go from Mike, the full length. Lima and Kilo are intersections: the crew backtracks to the turning area.',
  '09': 'Runway 09 departures normally go from Alpha, the full length. Bravo and Charlie are intersections: the crew backtracks to the turning area.'
};

// ═════════════════════════ aerodrome drawing (runway metres) ═════════════════════════
const AD_SITE = {
  aprons: APRONS, roads: [], buildings: [], twyExtra: OSM_TWY, shoulder: [0, RWY_M], serviceRoad: false, paag: [], floods: [],
  twyLabels: [['T', 180, -88], ['T', 900, -95], ['T', -100, -68], ['A', 12, -48], ['B', 70, -48], ['C', 335, -48], ['D', 425, -52], ['E', 604, -50], ['F', 1095, -50], ['K', 1322, -50], ['L', 1440, -55], ['M', 1490, -48]],
  hotspots: [['HS1', 0, -72]],
  labels: [['MAIN APRON', 180, -150], ['EAST APRON', 610, -170], ['WEST APRON', -70, -130], ['GA APRON', -255, -110], ['TERMINAL', 360, -190],
    ['ROYAL ALBERT DOCK', 700, 140], ['KING GEORGE V DOCK', 1150, -180], ['TURNING AREA', 20, 30, 'near'], ['TURNING AREA', RWY_M - 20, 30, 'near']]
};

// ═════════════════════════ fixes, STARs, SIDs ═════════════════════════
for (const [id, p] of Object.entries(EGLC.FIX)) wp(id, p[0], p[1]);
wp('LCY', ...EGLC.NAV.LCY.p, { note: 'London City NDB 322' });
for (const id of ['LCE01', 'LCE02', 'LCE03', 'LCE04', 'LCW01', 'LCN01', 'LCN02', 'LCN03', 'LCN04', 'LCN05', 'LCN06', 'LCE21', 'LCE22', 'LCE23', 'LCE11', 'LCE12', 'LCE13', 'TEVMO'])
  WP[id].hide = true;   // SID and transition waypoints: on the procedures layer, not in the fix list
for (const [id, h] of Object.entries(EGLC.HOLDS_AIR)) if (WP[id]) WP[id].hold = { inb: h.inb, min: h.min, left: h.turn === 'L' };
const RADAR_REF = WP.LCY.p;
// gates are the airway directions in eglc.js: each has a STAR (inbound, picked up 55-80 NM out) and a SID exit
const GATES = Object.keys(EGLC.DIR);
const STAR_OF = g => EGLC.STARS[EGLC.DIR[g].star];
const starFrom = g => { const pts = STAR_OF(g).pts.map(p => p[0]); return pts.slice(pts.indexOf(EGLC.DIR_ENTRY[g])); };
const ENTRY = Object.fromEntries(GATES.map(g => [g, WP[EGLC.DIR_ENTRY[g]].p]));
const ENTRY_ALT = { N: 13000, W: 13000, NE: 16000, E: 15000, SE: 14000, S: 15000, SW: 15000, CI: 14000 };
const PRE_ALT = { N: 27000, W: 27000, NE: 26000, E: 25000, SE: 24000, S: 27000, SW: 29000, CI: 24000 };
// after the hold, the RNAV transition: LAVNO 1J/1G onto the runway 27 final, ODLEG 1J/1G round the south to the 09 final
const transOf = (g, rw) => EGLC.TRANS[(rw === '27' ? 'LAVNO 1' : 'ODLEG 1') + (EGLC.DIR[g].hold === 'JACKO' ? 'J' : 'G')];
const ARR_ROUTE = Object.fromEntries(GATES.map(g => [g, Object.fromEntries(['09', '27'].map(rw => [rw, [...starFrom(g), ...transOf(g, rw).pts.map(p => p[0])]]))]));
const HOLD_AT = Object.fromEntries(GATES.map(g => [g, EGLC.DIR[g].hold]));
const sidName = (gate, rwy) => `${EGLC.DIR[gate].sid} 1${rwy === '09' ? 'H' : 'A'}`;
const sidSpoken = n => n.replace(/ 1([AH])$/, (m, l) => ' one ' + (l === 'A' ? 'Alpha' : 'Hotel'));
const sidOf = (gate, rwy) => EGLC.SIDS[rwy][sidName(gate, rwy)];
const EXIT_FIX = Object.fromEntries(GATES.map(g => [g, EGLC.DIR[g].sid]));
// the route after the straight-ahead leg depends on the runway in use, so it is read when asked for
const EXIT_ROUTE = {}; for (const g of GATES) Object.defineProperty(EXIT_ROUTE, g, { enumerable: true, get: () => sidOf(g, S.rwy).pts.slice(1).map(p => p[0]) });
const NEXT_UNIT = Object.fromEntries(GATES.map(g => [g, EGLC.NEXT[EGLC.DIR[g].sid]]));
const relUnit = ac => 'London';
const TEL = EGLC.TEL;
const isMil = ac => false;
const gateFor = ap => EGLC.PLACE_DIR[ap] || 'S';

// ── ILS/DME approaches with the 5.5° glidepath (585 ft per NM). 27: on the localiser by 6 DME at 3,000 ft, on the
// glidepath from about 5 DME. 09: on the localiser by 4.9 DME at 2,000 ft, glidepath from 3.4 DME. Arrivals reach the
// final from the end of their RNAV transition (LAVNO, ODLEG) or from vectors.
const FINAL = {};
(function(){
  const gp = 585;
  const mk = (rw, thr, out, alt, fafNM, entry) => {
    const elev = THR_ELEV[rw], p12 = add(thr, out, 12), pf = add(thr, out, fafNM);
    WP['F' + rw] = { id: 'F' + rw, p: add(thr, out, 8), note: '8 NM final ' + rw, hide: true };
    const F = { pts: [p12, pf, thr], alts: [alt, alt, elev + 35], elev, entry, entryName: entry, name: 'ILS ' + rw, alt,
      decName: 'four miles', decNM: 4, decMin: 2.6, minAlt: 1700, minText: '1,700 ft', mins: { vis: 1000, ceil: 300 }, minRate: 400,
      phrase: r => `cleared ILS approach runway ${r}, glidepath five decimal five degrees`, read: r => `cleared ILS runway ${r}`,
      decCall: r => `${APT.tower[0]}, four miles, ILS runway ${r}`, decNeed: 'Four miles, needs landing clearance', decFail: 'below the approach ban at four miles' };
    F.cum = new Array(F.pts.length).fill(0); for (let i = F.pts.length - 2; i >= 0; i--) F.cum[i] = F.cum[i+1] + dist(...F.pts[i], ...F.pts[i+1]);
    // the glidepath: level at the platform altitude until it meets the 5.5° slope, then 585 ft per NM to the threshold
    const meet = (alt - elev - 35)/gp;
    F.prof = [[0, elev + 35], [meet, alt], [F.cum[0] + 1, alt]];
    return F;
  };
  FINAL['27'] = mk('27', T_HI, CRS_LO, 3000, 5, 'LAVNO');
  FINAL['09'] = mk('09', T_LO, CRS_HI, 2000, 3.4, 'ODLEG');
})();

// ═════════════════════════ schedule ═════════════════════════
const withGate = x => ({ ...x, gate: x.gate || gateFor(x.k === 'ARR' ? x.o : x.d) });
const TIMETABLE = EGLC.TIMETABLE;
const REGS = { PC12: 'G-PCLC', E55P: 'G-FLXY', C56X: 'G-XLSM', FA7X: 'G-LCYJ' };
const LONG_STAY = EGLC.LONG_STAY;
const EXTRA = EGLC.EXTRA.map(withGate);
const EXERCISES = Object.fromEntries(Object.entries(EGLC.EXERCISES).map(([k, e]) => ['c' + k, { ...e, sched: e.sched.map(withGate) }]));
const WX_PRESETS = EGLC.WX_PRESETS;

// ═════════════════════════ weather rules ═════════════════════════
// gusty south-westerlies come off the buildings and over the docks onto short final: mechanical turbulence, worse on 27
const TURB_TABLE = {};
function turbExcess(w){
  if (w.vrb || w.spd < 12) return 0;
  const g = Math.max(w.spd, (w.gust || 0)*0.85);
  return Math.max(0, g - (w.dir >= 170 && w.dir <= 290 ? 22 : 28));
}
const sraMinsOk = w => w.vis >= 1000 && w.ceil >= 300;
const minsOk = (w, rw) => w.vis >= 1000 && w.ceil >= 300;

// Canary Wharf: below 1,200 ft over the towers is an obstacle incident; R160 central London is SFC-UNL
const CANARY = EGLC.TOWERS.map(p => xy(...p));
const R160 = EGLC.R160.map(p => xy(...p)), R159 = EGLC.R159.map(p => xy(...p));

// ═════════════════════════ engine hooks ═════════════════════════
// intermediate holding points T1-T9 along taxiway T (AD 2-EGLC-2-1), metres along the runway frame
const IHP_T = [['T1', -164], ['T2', -47], ['T3', 143], ['T4', 298], ['T5', 380], ['T6', 518], ['T7', 1001], ['T8', 1146], ['T9', 1281]];
const APT = {
  arrAlt: arrAltOf([...Object.values(EGLC.TRANS), ...GATES.map(STAR_OF)]),   // transitions (7-15..7-18) then STARs
  ihps: IHP_T.map(([id, m]) => ({ id, tw: 'T', at: rm(m, offT(m)) })),
  icao: 'EGLC', name: 'London City', coordName: 'Thames', radarName: 'LCY', utcOff: 1,
  radar: ['Thames Director', '132.700'], tower: ['City Tower', '118.080'],
  rwyHalfWidth: 15, xing: false, drawnTown: false, ta: 6000, initClimb: 3000, gaAlt: 2000, appAlt: 3000, handoffNM: 16, climbFL: 80,
  area: { dep: 40, arr: 90, div: 40 }, roll: [70, RWY_M - 70], defRwy: '27', defWx: 'sw',
  appName: 'ILS approach', appShort: 'ILS', minsText: 'weather below the approach ban', reqApp: rw => 'ILS approach',
  minsLong: 'Weather is below the ILS minima (1,000 m and a 300 ft cloud base): the approach ban applies.',
  liveName: 'London City Airport', atisFreq: '136.355', turbName: 'London City',
  view: { app: [3, -1, 95], twr: [0, -0.05, 1.5], gnd: [640, -50, 1850, 420] },
  minsOk,
  inboundAlt: gate => EGLC.DIR[gate].hold === 'JACKO' ? 9000 : 10000,
  divertTo: ac => ['Southend', 'RAVSA'],
  vacExits: ac => VAC_PREFS(ac.stand).slice(0, 4),
  vacPrefs: st => VAC_PREFS(st),
  lineUpWords: hp => (S.rwy === RW_HI ? hp === 'M' : hp === 'A') ? 'line up' : 'line up and backtrack',
  rolledCall: 'request taxi',
  terrain: { name: 'the Canary Wharf towers', poly: CANARY, min: 1200, low: 900, msg: ac => `${ac.cs} is over the Canary Wharf towers at ${Math.round(ac.alt)} ft (One Canada Square is 771 ft)${ac.alt < 900 ? ', OBSTACLE' : ''}.` },
  // R160 (central London, SFC-UNL) is open to traffic under an ATC clearance on the published procedures: the 09 final
  // crosses it. Vectoring through it below 3,000 ft, off the procedures, counts as an infringement.
  restricted: { poly: R160, top: 3000, label: 'R160  SFC–UNL', short: 'R160', labelAt: xy(51.53, -0.16), ok: ac => !!ac.app || ac.mode === 'NAV' || ac.mode === 'FINAL' || ac.state === 'MISSED',
    msg: ac => `${ac.cs} is in R160 (central London restricted area) at ${Math.round(ac.alt)} ft, off the published procedures.` },
  // missed approach: climb straight ahead to 2,000 ft; at 5.6 DME turn back (09 left, 27 right) to the LCY NDB and hold
  gaEarly(ac, rw){},
  gaTurn(ac){ const thr = ac.gaRwy === RW_LO ? T_LO : T_HI; if (dist(ac.x, ac.y, ...thr) > 5.6) { ac.gaTurn = true; ac.mode = 'NAV'; ac.route = ['LCY']; ac.turnDir = ac.gaRwy === RW_LO ? -1 : 1; } },
  // SIDs: straight ahead to LCE01 (09) or LCW01 (27), no turn below 570 ft (09) or 1,102 ft (27), then the RNAV route
  liftoff(ac){ ac.tgtHdg = Math.round(crsOf(ac.depRwy)); ac.turnDir = 0; },
  depTurn(ac){
    if (ac.turned) return;
    const I = EGLC.SIDS[ac.depRwy].init, f = WP[I.fix].p, past = mOf([ac.x, ac.y]) - mOf(f);
    if (ac.alt >= I.turnAt && (ac.depRwy === RW_LO ? past > -150 : past < 150)) ac.turned = true;
  },
  depClear: ac => !!ac.turned,
  shear(ac, rw, w){ return null; },
  shearWhy: rw => rw === '27' ? 'turbulence off the buildings on short final' : 'windshear over the docks',
  faceHold: (st, f) => FACE_HOLD(st, f),
  faceWord: f => f,
  taxiHolds: south => S.rwy === RW_HI ? ['M', 'L', 'K'] : ['A', 'B', 'C'],
  taxiHint: rw => TAXI_HINT[rw],
  // medical diversions: flights crossing the London TMA overhead
  diverts: [{ cs: 'EZY23JM', t: 'A320', o: 'LFPG', gate: 'S', to: 'Glasgow' }, { cs: 'KLM1009', t: 'B738', o: 'EHAM', gate: 'E', to: 'London Heathrow' },
    { cs: 'RYR45HL', t: 'B738', o: 'EIDW', gate: 'W', to: 'Stansted' }, { cs: 'SAS1531', t: 'A20N', o: 'EKCH', gate: 'NE', to: 'Heathrow' }],
  // the website: home hero, previews, scenario cards and Academy figures
  site: {
    hero: () => [
      ['CFE8704', 51.86, -0.05, 160, 250, PAL.light.arr], ['KLC985', 51.55, 0.85, 255, 240, PAL.light.arr], ['SWR462', 51.20, 0.30, 330, 230, PAL.light.arr],
      ['CFE8721', 51.53, -0.20, 275, 220, PAL.light.dep], ['DLH9RT', 51.60, 0.35, 75, 230, PAL.light.dep],
      ['BAW23K', 51.40, -0.75, 85, 420, 'rgba(60,75,95,.7)'], ['EZY81TP', 51.95, 0.40, 210, 410, 'rgba(60,75,95,.7)'], ['RYR4LG', 51.15, -0.30, 20, 430, 'rgba(60,75,95,.7)']
    ],
    demo(mk, park){
      const F = FINAL['27'], fin = add(T_HI, CRS_LO, 2.4), out = add(T_LO, CRS_HI, 4.5), inb = add(WP.JACKO.p, 200, 4), twy = GN[HOLDS.M.node].p;
      return [
        mk('CFE8703', 'E190', 'DEP', park('5', { need: null, reqAt: 99999 })), mk('KLC984', 'E295', 'DEP', park('22', { need: null, reqAt: 99999 })), mk('SWR459', 'BCS1', 'DEP', park('25', { need: null, reqAt: 99999 })),
        mk('GLCYJ', 'FA7X', 'DEP', park('13', { need: null, reqAt: 99999 })),
        mk('CFE8711', 'E190', 'DEP', { ground: true, state: 'HOLDPT', hp: 'M', x: twy[0], y: twy[1], hdg: CRS_HI, gs: 0 }),
        mk('KLC983', 'E295', 'ARR', { state: 'FINAL', mode: 'FINAL', app: '27', freq: 'TWR', x: fin[0], y: fin[1], hdg: CRS_HI, alt: 900, gs: 125, vs: -1200, o: 'EHAM' }),
        mk('CFE8721', 'E190', 'DEP', { state: 'CLIMB', x: out[0], y: out[1], hdg: 280, alt: 3000, gs: 210, vs: 0, tgtAlt: 3000, d: 'EIDW' }),
        mk('DLH926', 'E190', 'ARR', { state: 'INBOUND', x: inb[0], y: inb[1], hdg: 200, alt: 9000, gs: 250, vs: -1000, tgtAlt: 5000, o: 'EDDF' })
      ];
    },
    thumb(k, zoom, W){
      if (k === 'app') return v => { v.scale *= 1.5; v.cx -= 3; v.cy += 1; };
      if (k === 'twr') { const c = rm(RWY_M*0.8, -40); return v => { v.cx = c[0]; v.cy = c[1]; v.scale = W/0.7; }; }
      const c = zoom === 'apron' ? rm(330, -100) : rm(560, -60);
      return v => { v.cx = c[0]; v.cy = c[1]; v.scale = W/((zoom === 'apron' ? 650 : 1250)*M2NM); };
    },
    figHold: 'JACKO', emergHp: 'M',
    figConsole: v => { v.scale *= 1.6; v.cx += 2; v.cy += 2; },
    cmdHint: 'Command, e.g. KLC983 H090 A50 · CFE8703 TAXI M · / to focus, Tab cycles flights'
  },
  airports: EGLC.AIRPORTS, via: {}, cruise: EGLC.CRUISE,
  airlineIcao: EGLC.AIRLINE_ICAO, airlineType: EGLC.AIRLINE_TYPE, defType: 'E190',
  placeIcao: EGLC.PLACES,
  atisPanel(w){
    const c = windComp(w, crsOf(S.rwy)), bad = !minsOk(w, S.rwy);
    return `<div class="warnline${bad ? ' bad' : ''}">ILS ${S.rwy} · glidepath 5.5° · ${bad ? 'below the approach ban (1,000 m / 300 ft)' : 'above the ILS minima'} · crosswind ${Math.round(Math.abs(c.crossG))} kt</div>`;
  },
  atisLines({ w, L, E, wind, vis, cloud }){
    const out = [
      `This is London City information ${L}, time ${zt(S.t).slice(0,5).replace(':', '')}.`,
      `Runway in use ${S.rwy}. Expect ILS DME approach runway ${S.rwy}, glidepath 5.5 degrees.`,
      `Surface wind ${wind}. Visibility ${vis}. ${cloud}.`,
      `Temperature ${w.temp}, dew point ${w.dew}. QNH ${w.qnh} hectopascals.`
    ];
    if (turbExcess(w) > 0) out.push('Moderate turbulence and windshear reported on final.');
    if (E && E.ws) out.push(`Windshear reported on final runway ${E.ws.rw} at ${zt(E.ws.t).slice(0,5).replace(':', '')}, ${E.ws.text}.`);
    if (E && E.rwyBlock) out.push(`Runway ${S.rwy} closed: ${E.rwyBlock.why}. Expect delays.`);
    if (!minsOk(w, S.rwy)) out.push('Visibility below the approach ban. Expect holding.');
    out.push('Departures: release from London Control is required before take-off. Initial climb 3,000 feet.');
    out.push(`Acknowledge receipt of information ${L} and advise aircraft type on first contact.`);
    return out;
  }
};
