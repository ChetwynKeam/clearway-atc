
// ═════════════════════════ Madeira (LPMA) airport profile for the engine ═════════════════════════
// Builds every global the engine reads from the chart data in lpma.js (LPMA) and the OpenStreetMap aerodrome
// (runway ends, taxiways, stands and turn loops below, converted to runway metres from the 05 end of the pavement).
Object.assign(TYPES, LPMA.TYPES);
const LL = p => xy(p[0], p[1]);

// ── runway 05/23: frame along the OpenStreetMap centreline, 2779 m of pavement from the 05 end to the 23 end
const W_END = xy(32.6889728, -16.7848722), E_END = xy(32.7067981, -16.7640337);
const RWY_M = 2778.6;
const RU = [(E_END[0]-W_END[0])/(RWY_M*M2NM), (E_END[1]-W_END[1])/(RWY_M*M2NM)], RN = [-RU[1], RU[0]];   // along (north-east), normal (north-west)
function rm(m, off=0){ return [W_END[0] + (RU[0]*m + RN[0]*off)*M2NM, W_END[1] + (RU[1]*m + RN[1]*off)*M2NM]; }
function mOf(p){ return ((p[0]-W_END[0])*RU[0] + (p[1]-W_END[1])*RU[1]) / M2NM; }
function offOf(p){ return ((p[0]-W_END[0])*RN[0] + (p[1]-W_END[1])*RN[1]) / M2NM; }
const THR_LO_M = 149.6, THR_HI_M = 2630.8;                 // OSM thresholds (AIP: 2481 m LDA; 150 m of pavement behind THR 23)
const RW_LO = '05', RW_HI = '23', T_LO = rm(THR_LO_M, 0), T_HI = rm(THR_HI_M, 0);
const CRS_LO = brg(...T_LO, ...T_HI), CRS_HI = norm(CRS_LO + 180);
const crsOf = rw => rw === RW_LO ? CRS_LO : CRS_HI;
const ELEV = 191;                                           // aerodrome elevation; touchdown uses each threshold's own
const THR_ELEV = { '05': 146, '23': 191 };
const ARP = LL(LPMA.arp);
// no road crossing, no restricted area, no border fence
const XING_M = -1e9, XING_SKEW = 0, XING_HW = 0, xingM = o => XING_M;
const FRONTIER = [], R164 = [], ROCK = [], ROCK_TOP = [0, 0];

// ═════════════════════════ aerodrome layout (OpenStreetMap, checked against AD 2.24.02) ═════════════════════════
// Taxilane A runs along apron A; Charlie joins it to the runway at the south-west, Bravo at the north-east. There is
// no parallel taxiway, so every departure backtracks to a turn loop: 05 from Charlie to the loop south of the 05
// end, 23 from Bravo to the loop beyond THR 23.
const FIL = {
  C: { W: [[583.8,0.3],[597.1,-1.5],[604.7,-3.9],[611.3,-6.7],[618.9,-11.7],[624.9,-16.8]], E: [[709,-0.9],[703.9,-1.6],[698.5,-3.8],[692.1,-7.1],[687,-10.9],[682.7,-15.2],[678.5,-20.7],[674,-29.7],[671.6,-41.9],[671.3,-50.5],[674,-59.4],[678,-68.2]] },
  B: { W: [[1643.7,-0.4],[1659.3,-6.4],[1670.4,-16.2],[1676.4,-25.6],[1678.7,-33.9],[1680.2,-42],[1680,-48.8],[1678.8,-55.4],[1676.4,-63.3],[1673.5,-68.6]], E: [[1762.9,-0.3],[1752.6,-1.9],[1743.1,-5.6],[1736.3,-9.4],[1731.3,-12.9],[1725.9,-17.9]] }
};
gn('RC', 683.7, -75.7); gn('HC', 696.2, -88.7); gn('JC', 702.5, -94.8);
gn('RB', 1668.5, -75.3); gn('HB', 1559.3, -137.7); gn('JB', 1386.0, -133.2);
const HOLDS = {
  C: { node: 'HC', rwy: 'RC', m: 696.2, off: -88.7, rgl: true },
  B: { node: 'HB', rwy: 'RB', m: 1559.3, off: -137.7, rgl: true, across: -1 }
};
const STANDS = [
  { id: 'A1', m: 699.8, off: -174.6, lead: [702.5,-94.8], area: 'civil', node: 'JC' },
  { id: 'A2', m: 741.8, off: -177.3, lead: [745.6,-116.6], area: 'civil' },
  { id: 'A3', m: 783.0, off: -179.9, lead: [786.7,-117.2], area: 'civil' },
  { id: 'A4', m: 824.5, off: -182.4, lead: [828.3,-118.4], area: 'civil' },
  { id: 'A5', m: 865.5, off: -188.7, lead: [869.9,-119.4], area: 'civil' },
  { id: 'A6', m: 907.2, off: -190.4, lead: [911.4,-121], area: 'civil' },
  { id: 'A7', m: 951.1, off: -193.3, lead: [954.9,-121.6], area: 'civil' },
  { id: 'A8', m: 995.9, off: -195.4, lead: [1000.4,-123.3], area: 'civil' },
  { id: 'A9', m: 1041.4, off: -199.9, lead: [1046,-124.3], area: 'civil' },
  { id: 'A10', m: 1086.7, off: -201.5, lead: [1091.4,-125.4], area: 'civil' },
  { id: 'A11', m: 1130.8, off: -222.1, lead: [1136.7,-126.7], area: 'civil' },
  { id: 'A12', m: 1176.1, off: -225.4, lead: [1182.2,-128], area: 'civil' },
  { id: 'A13', m: 1227.8, off: -235.6, lead: [1234.7,-129.3], area: 'civil' },
  { id: 'A14', m: 1281.2, off: -219.3, lead: [1286.6,-130.7], area: 'civil' },
  { id: 'A15', m: 1287.9, off: -229.0, lead: [1294,-130.7], area: 'civil' },
  { id: 'A16', m: 1332.2, off: -230.3, lead: [1338.4,-131.9], area: 'civil' },
  { id: 'A17', m: 1344.3, off: -215.6, lead: [1349.4,-132.2], area: 'civil' },
  { id: 'A18', m: 1306.4, off: -190.4, lead: [1332.3,-131.6], area: 'civil' }
];
STANDS.forEach(s => { s.p = rm(s.m, s.off); s.occ = null; if (!s.node) { s.node = 'L' + s.id; gn(s.node, ...s.lead); } s.lp = GN[s.node].p; s.hdg = brg(...s.lp, ...s.p); });
chain('JC', [[708.9,-101.3],[712.4,-104.1],[716.9,-107.2],[729.1,-113.6],[741.8,-116.2]], 'LA2', 'A');
ge('LA2', 'LA3', 'A');
ge('LA3', 'LA4', 'A');
ge('LA4', 'LA5', 'A');
ge('LA5', 'LA6', 'A');
ge('LA6', 'LA7', 'A');
ge('LA7', 'LA8', 'A');
ge('LA8', 'LA9', 'A');
ge('LA9', 'LA10', 'A');
ge('LA10', 'LA11', 'A');
ge('LA11', 'LA12', 'A');
ge('LA12', 'LA13', 'A');
ge('LA13', 'LA14', 'A');
ge('LA14', 'LA15', 'A');
ge('LA15', 'LA18', 'A');
ge('LA18', 'LA16', 'A');
ge('LA16', 'LA17', 'A');
ge('LA17','JB','A');
ge('RC', 'HC', 'C'); ge('HC', 'JC', 'C');
chain('JB', [], 'HB', 'B'); chain('HB', [[1583.8,-138.2],[1592.9,-137],[1602.8,-134.2],[1611,-130.1],[1618.1,-124.9],[1627.2,-116.7]], 'RB', 'B');
const TURN_W = [[149.6,-0.7],[142.3,-1.1],[136,-2.1],[129.3,-4.4],[123.6,-7.1],[107.1,-16.8],[92.4,-25.1],[79.9,-32.5],[69.6,-38.5],[61.4,-43],[55.3,-46.5],[51,-48.2],[47.5,-49.1],[43.8,-49.6],[40.2,-49.7],[36.1,-49.4],[31.6,-48.2],[27.1,-46.5],[24.4,-44.9],[21.6,-42.9],[18.4,-40.1],[15.9,-37.1],[13.1,-32.9],[11,-28.1],[10,-23.7],[9.6,-20.7],[9.3,-16.5],[9.6,-13.7],[10.3,-9.8],[11.3,-6.8],[12.7,-3.4],[14.1,-0.6],[16.3,2.5],[18.9,5.3],[21.5,7.6],[24,9.5],[27.5,11.5],[31.5,13.1],[34.6,14],[38,14.5],[42.1,14.7],[46.3,14.4],[50.8,13.4],[53.7,12.4],[56.7,11],[64,6.9],[70.4,4],[76.1,2.5],[80.7,1.5],[89.1,0.8],[112.9,0],[124.2,0.1],[143.7,-0.5]];
const TURN_E = [[2630.8,0.3],[2640.8,1.7],[2647.6,3.4],[2654.2,6.3],[2662.4,11.1],[2684.2,23.4],[2710.7,38.3],[2725.5,46.8],[2729.8,48.7],[2734.6,50],[2740.1,50.3],[2745.9,49.9],[2752.1,47.9],[2757.8,45.1],[2762.3,41.6],[2766.4,37.2],[2769,33],[2771.2,28.4],[2772.1,24.4],[2772.7,20.9],[2772.8,16],[2772.5,11.6],[2770.9,6.2],[2769.1,1.5],[2766.8,-1.8],[2764.9,-4.2],[2762.3,-6.9],[2759.6,-9.3],[2754.8,-12.1],[2751.2,-13.8],[2746.6,-15.1],[2743.2,-15.7],[2738.1,-15.6],[2734.6,-15.3],[2731.5,-14.7],[2727.9,-13.4],[2722.9,-10.9],[2718.6,-8.5],[2715.4,-6.9],[2711.4,-5.1],[2708.2,-3.9],[2703.1,-2.6],[2699.6,-1.9],[2630.8,0.3]];
const TURN_MID = [[2181.7,-0.1],[2209.7,6.6],[2262.7,37.3],[2285.6,49.3],[2295.3,50.4],[2304.6,49],[2313.1,44.6],[2319.4,39.4],[2325.8,28.1],[2327.4,20],[2327.4,12.1],[2324.3,4.8],[2322,0.1],[2316.3,-7.4],[2308.7,-12.2],[2304.1,-13.9],[2296.8,-15.5],[2285.9,-15.3],[2275.9,-11.3],[2257,-0.1]];
const APRON_A = [[1337,-250.2],[1336.8,-258.5],[1244.4,-255.4],[1215.9,-254.6],[1134.4,-252.1],[1134.6,-244.5],[1127.5,-244.3],[1127.6,-236.8],[1120,-236.4],[1112.9,-236.1],[1112.9,-232.7],[1112.6,-228.5],[1097.8,-228.5],[1097.9,-220.7],[1056.1,-219.6],[1007,-218.5],[931.6,-216.8],[902.9,-215.1],[903.4,-208.3],[879.7,-207.3],[821.1,-205.7],[821,-213],[805.9,-212.6],[805.7,-220.1],[798.4,-219.8],[798.2,-228.4],[791,-228.2],[790.8,-234.7],[782,-234.5],[781.7,-243.3],[677.8,-240],[679.3,-179.9],[681.6,-123.1],[714.3,-124.1],[1362.5,-144.8],[1359.1,-250.9],[1337,-250.2]];
const TERMINAL = [[[883,-234.2],[883.1,-233],[883.2,-231.3],[888.9,-231.7],[896.7,-232.3],[903.3,-232.7],[905.6,-232.9],[909.6,-233.2],[916,-233.6],[920,-233.9],[921.6,-234],[928.1,-234.4],[933.8,-234.8],[938.2,-235.1],[940.4,-235.3],[942.4,-235.4],[948.3,-235.8],[954.6,-236.2],[958.3,-236.5],[960.2,-236.6],[962.1,-236.7],[966.1,-237],[971.4,-237.4],[975.9,-237.7],[979,-237.9],[982.8,-238.2],[1006.3,-239.8],[1026.9,-241.2],[1026.8,-242.3],[1035.3,-242.9],[1099.3,-247.3],[1098.6,-258.8],[1109.2,-259.5],[1108.7,-266.5],[1107.2,-288.4],[1106.5,-299.3],[1106.3,-301.6],[879.3,-286.1],[879.4,-284.4],[881.2,-258.6],[883,-234.2]],[[881.2,-258.6],[850,-256.4],[849.2,-268.4],[839.8,-267.7],[840.8,-253.7],[840.9,-250.9],[842.1,-233.9],[842.3,-231.4],[883,-234.2],[881.2,-258.6]]];
const TWR_BLD = [[991.9,-253.8],[987.7,-253.5],[984.6,-256.1],[984,-260.4],[987.3,-264],[991,-264],[994.3,-261],[994.6,-256.7],[991.9,-253.8]];
const TURN_PAD = {};
const TURN_END = { E: TURN_E[TURN_E.length-1][0], W: TURN_W[TURN_W.length-1][0] };
const PHON = { A: 'Alpha', B: 'Bravo', C: 'Charlie' };
const LANE_LIM = [745, 1380];
function depHold(ac){ return S.rwy === RW_LO ? 'C' : 'B'; }
function pushPath(ac, face){
  const st = ac.stand, lm = mOf(st.lp), lo = offOf(st.lp);
  if (st.id === 'A1') return [st.lp, rm(face === 'east' ? 724 : 690, face === 'east' ? -110 : -88)];
  const tail = face === 'west' ? 1 : -1;                    // facing north-east means the tail goes south-west
  return [st.lp, rm(clamp(lm + tail*40, LANE_LIM[0], LANE_LIM[1]), lo)];
}
const pushRec = ac => depHold(ac) === 'B' ? 'east' : 'west';

// ═════════════════════════ fixes, STARs, SIDs (AD 2.24.08, 2.24.10, 2.24.12) ═════════════════════════
for (const [id, p] of Object.entries(LPMA.FIX)) wp(id, p[0], p[1]);
wp('FUN', ...LPMA.NAV.FUN.p, { note: 'Funchal DVOR 112.2' }); wp('SNT', ...LPMA.NAV.SNT.p, { note: 'Porto Santo DVOR 114.9' });
for (const [id, h] of Object.entries(LPMA.HOLDS_AIR)) if (WP[id]) WP[id].hold = { inb: h.inb, min: h.min, left: h.turn === 'L' };
const RADAR_REF = WP.FUN.p;
// gates are the airway directions in lpma.js: each has a STAR (inbound) and a SID end fix (outbound)
const GATES = Object.keys(LPMA.DIR);
const STAR_OF = g => LPMA.STARS[LPMA.DIR[g].star];
const ENTRY = Object.fromEntries(GATES.map(g => [g, WP[STAR_OF(g).pts[0][0]].p]));
const ENTRY_ALT = Object.fromEntries(GATES.map(g => [g, g === 'PS' ? 7000 : 11000])), PRE_ALT = Object.fromEntries(GATES.map(g => [g, g === 'PS' ? 12000 : 25000]));
const ARR_ROUTE = Object.fromEntries(GATES.map(g => { const r = [...STAR_OF(g).pts.map(p => p[0]), 'ABUSU']; return [g, { '05': r, '23': r }]; }));
const HOLD_AT = Object.fromEntries(GATES.map(g => [g, 'PILIM']));
const sidName = (gate, rwy) => `${LPMA.DIR[gate].sid} 1${rwy === RW_LO ? 'E' : 'W'}`;
const sidSpoken = n => n.replace(/ 1([EW])$/, (m, l) => ' one ' + (l === 'E' ? 'Echo' : 'Whiskey'));
const sidOf = (gate, rwy) => LPMA.SIDS[rwy][sidName(gate, rwy)];
const EXIT_FIX = Object.fromEntries(GATES.map(g => [g, LPMA.DIR[g].sid]));
// the route after the initial turn depends on the runway in use, so it is read when asked for
const EXIT_ROUTE = {}; for (const g of GATES) Object.defineProperty(EXIT_ROUTE, g, { enumerable: true, get: () => sidOf(g, S.rwy).pts.map(p => p[0]) });
const NEXT_UNIT = Object.fromEntries(GATES.map(g => [g, LPMA.release()]));
const relUnit = ac => 'Lisboa';
const TEL = LPMA.TEL;
const isMil = ac => false;
const gateFor = ap => ap === 'LPMA' ? 'NE' : (LPMA.PLACE_DIR[ap] || 'NE');

// ── approaches. VOR DME 05: inbound 207° over FUN, MAPt 3.6 DME, on to 6 DME FUN, then the visual circuit past Gelo
// and Rosário onto a short final 05. VOR DME 23: the same inbound to the MAPt, then visual 235° (mag) to runway 23.
const FINAL = {};
(function(){
  const fun = WP.FUN.p, inb = 207, out = norm(inb + 180);   // 207° checks out as a true track: 6 DME on it is the chart's first visual point
  const faf = add(fun, out, 7), mapt = add(fun, out, 3.6);
  const nm = LPMA.APPROACHES['VOR 05'].visual.nm, thrA = LL(LPMA.RWY.thr['05']);
  const vis = nm.slice(0, -1).map(([e, n]) => [thrA[0] + e, thrA[1] + n]);
  WP.FAF = { id: 'FAF', p: faf, note: 'FUN 7 DME' }; WP.MAPT = { id: 'MAPT', p: mapt, note: 'FUN 3.6 DME, MAPt' };
  WP.GELO = { id: 'GELO', p: vis[3], note: 'Gelo, 850 ft', decLabel: 'GELO 850' }; WP.ROSAR = { id: 'ROSAR', p: vis[5], note: 'Rosário, 460 ft', decLabel: 'ROSÁRIO 460' };
  // altitudes at each point of the path: 3000 to the FAF, 2200 at the MAPt, then down the visual circuit
  // (the first visual point is 6 DME FUN itself)
  FINAL['05'] = { pts: [WP.ABUSU.p, faf, mapt, fun, ...vis, T_LO], alts: [3000, 3000, 2200, 1500, 1100, 1040, 990, 940, 740, 540, 340, THR_ELEV['05'] + 50],
    elev: THR_ELEV['05'], entry: 'ABUSU', entryName: 'ABUSU', name: 'MAPt', decName: 'the missed approach point', minAlt: 2000, minText: '2,200 ft',
    gates: [{ at: 'GELO', idx: 7, min: 850 }, { at: 'Rosário', idx: 9, min: 460 }] };
  const p2 = add(T_HI, CRS_LO, 2.2);
  FINAL['23'] = { pts: [WP.ABUSU.p, faf, mapt, p2, T_HI], alts: [3000, 3000, 2200, 940, THR_ELEV['23'] + 50],
    elev: THR_ELEV['23'], entry: 'ABUSU', entryName: 'ABUSU', name: 'MAPt', decName: 'the missed approach point', minAlt: 2000, minText: '2,200 ft' };
  for (const k of ['05', '23']) { const f = FINAL[k]; f.cum = new Array(f.pts.length).fill(0); for (let i = f.pts.length-2; i >= 0; i--) f.cum[i] = f.cum[i+1] + dist(...f.pts[i], ...f.pts[i+1]);
    f.prof = f.cum.map((c, i) => [c, f.alts[i]]).reverse(); f.decNM = f.cum[2] + 0.1; f.decMin = f.cum[2] - 1.2;
    if (f.gates) for (const g of f.gates) g.togo = f.cum[g.idx]; }
})();

// ═════════════════════════ schedule ═════════════════════════
const withGate = x => ({ ...x, gate: x.gate || gateFor(x.k === 'ARR' ? x.o : x.d) });
const TIMETABLE = LPMA.TIMETABLE;
const REGS = {};
const LONG_STAY = LPMA.LONG_STAY;
const EXTRA = LPMA.EXTRA.map(withGate);
const EXERCISES = Object.fromEntries(Object.entries(LPMA.EXERCISES).map(([k, e]) => ['m' + k, { ...e, sched: e.sched.map(withGate) }]));
const WX_PRESETS = LPMA.WX_PRESETS;

// ═════════════════════════ weather rules ═════════════════════════
const inSect = (d, a, b) => a <= b ? d >= a && d <= b : d >= a || d <= b;
// turbulence and windshear on short final: worst with the wind over the high ground (north-west to north-east) and
// in south-westerlies round the Rosário cliffs. Returns knots above the "rough" threshold, like Gibraltar's table.
const TURB_TABLE = {};
function turbExcess(w){
  if (w.vrb || w.spd < 10) return 0;
  const mag = norm(w.dir - LPMA.RWY.var), g = Math.max(w.spd, (w.gust || 0)*0.85);
  return Math.max(0, g - (inSect(mag, 290, 50) || inSect(mag, 180, 250) ? 15 : 24));
}
const sraMinsOk = w => w.vis >= 5000 && w.ceil >= 800;
const MINIMA = { '05': { vis: 5000, ceil: 800 }, '23': { vis: 7000, ceil: 1200 } };
const minsOk = (w, rw) => w.vis >= MINIMA[rw || '05'].vis && w.ceil >= MINIMA[rw || '05'].ceil;
// wind limits are checked against both anemometers (MID and ROSÁRIO), whichever is worse
const anem = w => LPMA.anemometers(w);
function lpmaLimit(phase, rw){ const A = anem(S.wx); return LPMA.windLimit(phase, rw, A.ROSARIO) || LPMA.windLimit(phase, rw, A.MID) || (() => { const c = windComp(S.wx, crsOf(rw)); return c.headG < -10 ? 'tailwind out of limits' : null; })(); }

// a rough outline of the island's high interior (above about 1,500 ft), kept clear of the coastal strip round the
// airport: below 5,000 ft inside it is a terrain incident (the MVA over the island is 9,000 ft)
const ISLAND_HIGH = [[32.845,-17.20],[32.865,-17.00],[32.825,-16.86],[32.785,-16.80],[32.735,-16.81],[32.712,-16.84],[32.700,-16.92],[32.690,-17.05],[32.715,-17.18],[32.760,-17.24]].map(p => xy(...p));

// ═════════════════════════ aerodrome drawing (runway metres) ═════════════════════════
const AD_SITE = {
  aprons: [APRON_A], roads: [], buildings: [...TERMINAL.map(p => ({ pts: p, h: 14, roof: '' })), { pts: TWR_BLD, h: 30, roof: '' }],
  twyExtra: [['MID', TURN_MID]], shoulder: [0, RWY_M], serviceRoad: false, paag: [], floods: [],
  twyLabels: [['A', 1000, -123], ['A', 1450, -136], ['B', 1640, -105], ['C', 660, -70]], hotspots: [],
  labels: [['TERMINAL', 860, -280], ['APRON A', 1000, -160], ['TWR', 985, -262], ['SANTA CRUZ', 900, -700], ['MACHICO', 3400, 900]]
};

// ═════════════════════════ engine hooks ═════════════════════════
const APT = {
  icao: 'LPMA', name: 'Madeira', coordName: 'Madeira', radarName: 'FUN', utcOff: 1,
  radar: ['Madeira Approach', '119.605'], tower: ['Madeira Tower', '124.660'],
  xing: false, drawnTown: false, ta: 5000, initClimb: 6000, gaAlt: 3000, appAlt: 3000, handoffNM: 20, climbFL: 100,
  area: { dep: 80, arr: 100, div: 30 }, roll: [60, RWY_M - 60], defRwy: '05', defWx: 'trade',   // STAR entries are on the TMA edge, up to 70 NM from FUN
  appName: 'VOR approach', appShort: 'VOR', minsText: 'weather below the circling minima',
  minsLong: 'Weather is below the VOR circling minima (05: 5 km and 800 ft; 23: 7 km and 1,200 ft).',
  liveName: 'Madeira Airport', atisFreq: '130.355', turbName: 'Madeira',
  view: { app: [-5, -6, 70], twr: [0, -0.05, 2.4], gnd: [1350, -90, 2950, 760] },
  minsOk,
  inboundAlt: gate => 7000,
  divertTo: ac => ['Porto Santo', 'MARCU'],
  vacPrefs: st => ['B', 'C'],
  terrain: { name: 'the island', poly: ISLAND_HIGH, min: 5000, low: 3000, msg: ac => `${ac.cs} is over the high ground of Madeira at ${Math.round(ac.alt)} ft: the minimum vectoring altitude over the island is 9,000 ft${ac.alt < 3000 ? ', TERRAIN' : ''}.` },
  restricted: null,
  windLimit: (ac, rw) => lpmaLimit('land', rw),
  toLimit: rw => lpmaLimit('takeoff', rw),
  // missed approach: climb 3,000 ft, turn onto 137° over the sea towards FUSUL
  gaEarly(ac, rw){},
  gaTurn(ac){ if (ac.alt > 800) { ac.gaTurn = true; ac.tgtHdg = 137; ac.turnDir = ac.gaRwy === RW_LO ? 1 : -1; } },
  // SIDs: 05 starts the right turn onto 087° (mag) as soon as practicable, 23 the left turn onto 175° (high ground on the
  // runway's inland side); the DEGUN, MARCU and LAPPA 1W cross 4,000 ft before turning left towards MA647
  liftoff(ac){ ac.tgtHdg = Math.round(crsOf(ac.depRwy)); ac.turnDir = 0; },
  depTurn(ac){ if (!ac.turned && ac.alt >= 500) { ac.turned = true; if (ac.mode === 'HDG' && ac.tgtHdg === Math.round(crsOf(ac.depRwy))) { const lo = ac.depRwy === RW_LO; ac.tgtHdg = norm((lo ? 87 : 175) + LPMA.RWY.var); ac.turnDir = lo ? 1 : -1; } } },
  depClear: ac => ac.turned && ac.alt > ((sidOf(ac.gate, ac.depRwy) || {}).turnAt || 1500) - 100,
  shear(ac, rw, w){ return null; },
  shearWhy: rw => rw === RW_LO ? 'severe turbulence off the cliffs at Rosário' : 'windshear on short final',
  faceHold: (st, f) => f === 'east' ? 'B' : 'C',
  faceWord: f => f === 'east' ? 'north-east' : 'south-west',
  taxiHolds: south => ['C', 'B'],
  taxiHint: rw => rw === RW_LO ? 'Runway 05 departures leave from Charlie and backtrack to the turn loop at the south-west end.' : 'Runway 23 departures leave from Bravo and backtrack to the turn loop beyond the 23 threshold.',
  // medical diversions: flights passing Madeira on the way to the Canaries and Cape Verde
  diverts: [{ cs: 'TOM61X', t: 'B38M', o: 'EGKK', gate: 'N', to: 'Tenerife' }, { cs: 'EXS53L', t: 'B738', o: 'EGCC', gate: 'N', to: 'Lanzarote' },
    { cs: 'TAP1515', t: 'A21N', o: 'LPPT', gate: 'NE', to: 'Sal' }, { cs: 'EWG7522', t: 'A320', o: 'EDDL', gate: 'NE', to: 'Fuerteventura' }],
  airports: Object.fromEntries(Object.entries(LPMA.AIRPORTS)), via: {},
  airlineIcao: LPMA.AIRLINE_ICAO, airlineType: LPMA.AIRLINE_TYPE,
  placeIcao: LPMA.PLACES,
  atisPanel(w){
    const A = anem(w), f = a => `${a.vrb ? 'VRB' : hdg3(norm(a.dir - LPMA.RWY.var))}°/${a.spd}${a.gust ? 'G' + a.gust : ''}`;
    const L = lpmaLimit('land', S.rwy), T = lpmaLimit('takeoff', S.rwy);
    return `<div class="warnline${L || T ? ' bad' : ''}">Anemometers (mag): MID ${f(A.MID)} · ROSÁRIO ${f(A.ROSARIO)}. ${L ? `Landing ${S.rwy}: ${esc(L)}.` : `Landing ${S.rwy} within limits.`} ${T ? `Take-off: ${esc(T)}.` : ''}</div>`;
  },
  atisLines({ w, L, E, wind, vis, cloud }){
    const A = anem(w), f = a => `${hdg3(norm(a.dir - LPMA.RWY.var))} degrees ${a.spd} knots${a.gust ? ' gusting ' + a.gust : ''}`;
    const out = [
      `This is Madeira arrival information ${L}, time ${zt(S.t).slice(0,5).replace(':', '')}.`,
      `Expect VOR DME approach runway ${S.rwy}${S.rwy === RW_LO ? ', circling via Gelo and Rosário' : ', visual on track 235'}. Runway in use ${S.rwy}.`,
      `Surface wind ${wind}. Wind at Mid Point ${f(A.MID)}, at Rosário ${f(A.ROSARIO)}. Visibility ${vis}. ${cloud}.`,
      `Temperature ${w.temp}, dew point ${w.dew}. QNH ${w.qnh} hectopascals. Transition level flight level 60.`
    ];
    const lim = lpmaLimit('land', S.rwy); if (lim) out.push(`Warning: wind limits exceeded for runway ${S.rwy}, ${lim}. Expect holding at PILIM.`);
    if (turbExcess(w) > 0) out.push('Moderate to severe turbulence and windshear on final.');
    if (E && E.ws) out.push(`Windshear reported on final runway ${E.ws.rw} at ${zt(E.ws.t).slice(0,5).replace(':', '')}, ${E.ws.text}.`);
    if (E && E.rwyBlock) out.push(`Runway ${S.rwy} closed: ${E.rwyBlock.why}. Expect delays.`);
    if (!minsOk(w, S.rwy)) out.push('Weather below the circling minima.');
    out.push('Departures: release from Lisboa Control is required before take-off.');
    out.push(`Acknowledge receipt of information ${L} and advise aircraft type on first contact.`);
    return out;
  }
};
