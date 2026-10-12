// ═════════════════════════ Bristol (EGGD) airport profile ═════════════════════════
// Everything the Clearway engine needs to know that is true only of Bristol. Sources: UK AIP AD 2 EGGD charts (aerodrome
// 2-1, parking/docking 2-2, ATC surveillance minimum altitudes 5-1, SIDs 6-1..6-3, STARs 7-1..7-9 with their coding
// tables, the BRI hold 7-10, ILS/DME, LOC/DME, NDB and RNP approaches 8-1..8-9) and OpenStreetMap for the taxiways,
// aprons and buildings (eggd-ground.js). Positions are lat/lon (WGS84); bearings are TRUE unless named "mag" (variation
// 0.5°E: magnetic = true − 0.5). Summary of the charts: airports/eggd/README.md.
// Bristol is a one-runway airport on Broadfield Down, 622 ft up, 7 NM south-west of the city: runway 09/27, taxiway Z
// along the aprons, and every arrival route ends at the BRI hold overhead the field.
// Plain data plus a few small functions, like egkk.js; eggd-engine.js turns it into the engine's globals.

const EGGD = (() => {
  const ll = (s) => {                                     // '512253.19N' / '0024303.14W' → decimal degrees
    const m = s.match(/^(\d{2,3})(\d{2})(\d{2}(?:\.\d+)?)([NSEW])$/);
    const v = +m[1] + m[2]/60 + m[3]/3600; return /[SW]/.test(m[4]) ? -v : v;
  };
  const P = (lat, lon) => [ll(lat), ll(lon)];

  // ── fixes (STAR coding tables 7-8, 7-9, the SID charts 6-1..6-3 and the RNP coding table 8-9)
  const FIX = {
    WEVBE: P('520736.93N', '0025921.14W'), UBCAM: P('515704.18N', '0030012.19W'), INGUR: P('514241.67N', '0025136.75W'),
    FIFAH: P('515248.51N', '0041534.00W'), AMMAN: P('515025.95N', '0035954.00W'), PEGZA: P('513730.55N', '0030609.50W'),
    BAJJA: P('514805.01N', '0041705.77W'), FANFE: P('514620.78N', '0035248.88W'),
    ICTAM: P('513137.37N', '0010948.12W'), SAWPE: P('513504.67N', '0013916.42W'), ASHUM: P('513607.25N', '0015336.46W'), POMAX: P('513137.63N', '0020452.42W'),
    DAWLY: P('503427.31N', '0032750.23W'), EXMOR: P('511042.76N', '0032135.11W'),
    TOJAQ: P('502859.78N', '0033956.26W'), FARJO: P('505616.27N', '0033442.70W'), IZLAW: P('510325.45N', '0032251.31W'),
    HAWFA: P('513209N', '0023813W'), YORQI: P('513119N', '0022536W'), SOMOT: P('511733N', '0025953W'),
    EMPAS: P('512216.22N', '0030019.64W'), GD09F: P('512233.79N', '0025309.69W'), ADVED: P('511740.00N', '0030227.78W'),
    ELROV: P('512334.71N', '0022645.91W'), GD27F: P('512320.55N', '0023308.38W'), BAXUN: P('511935.41N', '0022623.58W')
  };
  // the beacons named on the charts
  const NAV = {
    BRI: { name: 'Bristol NDB', freq: '414', p: P('512253.19N', '0024303.14W') },
    BCN: { name: 'Brecon VOR/DME', freq: '117.45', p: P('514331.89N', '0031546.92W') },
    HON: { name: 'Honiley VOR/DME', freq: '113.65', p: P('522124N', '0013949W') },
    CPT: { name: 'Compton VOR/DME', freq: '114.35', p: P('512930N', '0011311W') }
  };

  // ── runway (AD 2-EGGD-2-1): 09/27 2011 × 45 m grooved asphalt, magnetic 086°/266°. The 27 threshold is displaced
  // 128 m: the pavement east of it is used for 27 departures from AX.
  const RWY = {
    lo: '09', hi: '27', magHdg: { '09': 86, '27': 266 }, var: 0.5,
    thr: { '09': P('512255.59N', '0024400.61W'), '27': P('512259.37N', '0024223.50W') },
    elev: { '09': 613, '27': 601 }, length: 2011, width: 45
  };

  // ── STARs (7-1..7-9), RNAV5 (TOJAQ and BAJJA RNAV1). Every one ends at the BRI hold over the airfield at FL70;
  // Bristol Radar normally vectors arrivals off them before that. Alt = level constraint at the fix (feet).
  const STARS = {
    'WEVBE 1B': { from: 'N',  pts: [['WEVBE', 16000], ['UBCAM', 15000], ['INGUR'], ['BRI', 7000]] },
    'FIFAH 1B': { from: 'W',  pts: [['FIFAH', 17000], ['AMMAN'], ['BCN'], ['PEGZA'], ['BRI', 7000]] },
    'BAJJA 1B': { from: 'WA', pts: [['BAJJA'], ['FANFE', 18000], ['BCN'], ['PEGZA'], ['BRI', 7000]] },
    'ICTAM 1B': { from: 'E',  pts: [['ICTAM', 22000], ['SAWPE'], ['ASHUM'], ['POMAX'], ['BRI', 7000]] },
    'DAWLY 1B': { from: 'SW', pts: [['DAWLY'], ['EXMOR'], ['BRI', 7000]] },
    'TOJAQ 2B': { from: 'S',  pts: [['TOJAQ'], ['FARJO'], ['IZLAW'], ['EXMOR'], ['BRI', 7000]] }
  };
  // the STAR hold (7-10): over the BRI NDB, inbound 089° mag (089.6° true), left turns, 1 minute, 3,000 ft to FL100,
  // 220 kt at FL70 and above, 185 kt below. It is also the hold the missed approach goes back to.
  const HOLDS_AIR = {
    BRI: { inb: 89.6, turn: 'L', min: 3000, max: 10000, maxKt: 220 }
  };

  // ── ILS/DME approaches (8-1, 8-5; RNP coding 8-9 for the fixes): 3° glidepath, I-BON (09) and I-BTS (27) on 110.15,
  // DME zero-ranged to each threshold. Intermediate fix EMPAS (09, 10.2 NM) and ELROV (27, 9.8 NM) at 2,500 ft, final
  // approach fix GD09F/GD27F at 5.7-5.8 NM. Missed approach: climb straight ahead to 3,000 ft and back to the BRI hold.
  const ILS = {
    '09': { loc: 'I-BON', freq: '110.15', ifx: 'EMPAS', faf: 'GD09F', ifAlt: 2500, fafAlt: 2500, missed: ['BRI', 3000], turn: -1 },
    '27': { loc: 'I-BTS', freq: '110.15', ifx: 'ELROV', faf: 'GD27F', ifAlt: 2500, fafAlt: 2500, missed: ['BRI', 3000], turn: 1 }
  };

  // ── SIDs (6-1..6-3): conventional, flown by RNAV substitution. Climb straight ahead to the ILS DME turn point (I-BTS
  // D5.2 / I-BON D4.5 for 27, I-BON D5.4 / I-BTS D4.7 for 09) at or above 3,000 ft, then turn; every SID stops at
  // 6,000 ft. "X" SIDs are runway 27, "Z" runway 09. T27 and T09 are the turn points; the BCN radial points are where
  // the chart's crossing restrictions are (BCN D20 / D30 and D15 on the radial flown).
  // Alt = level constraint at the fix (feet).
  const SIDS = {
    'BCN1X':   { rwy: '27', spoken: 'Brecon One X-ray', turn: 'R', pts: [['T27', 3000], ['BCN20', 4500], ['BCN15S', 6000], ['BCN', 6000]] },
    'HAWFA1X': { rwy: '27', spoken: 'Hawfa One X-ray', turn: 'R', pts: [['T27', 3000], ['HAWFA', 6000]] },
    'EXMOR1X': { rwy: '27', spoken: 'Exmor One X-ray', turn: 'L', pts: [['T27', 3000], ['SOMOT', 3500], ['EXMOR', 6000]] },
    'BCN1Z':   { rwy: '09', spoken: 'Brecon One Zulu', turn: 'L', pts: [['T09', 3000], ['BCN30', 4500], ['BCN15E', 6000], ['BCN', 6000]] },
    'YORQI1Z': { rwy: '09', spoken: 'Yorqi One Zulu', turn: 'L', pts: [['T09', 3000], ['YORQI', 6000]] },
    'EXMOR1Z': { rwy: '09', spoken: 'Exmor One Zulu', turn: 'R', pts: [['T09', 3000], ['SOMOT', 3500], ['EXMOR', 6000]] }
  };
  // the SIDs' computed points: [from, true bearing, NM] (T27/T09 straight ahead along the runway from the far threshold)
  const SID_PTS = { BCN20: ['BCN', 149.5, 20], BCN30: ['BCN', 124.5, 30], BCN15S: ['BCN', 149.5, 15], BCN15E: ['BCN', 124.5, 15] };
  // airway directions: the STAR an arrival flies, where the simulator picks it up (after Cardiff Radar or London Control
  // have brought it down), the SID for each runway and the unit that takes the departure. Cardiff Radar works the west
  // and south-west (cruising levels up to FL165), London Control the rest.
  const DIR = {
    N:  { star: 'WEVBE 1B', entry: 'UBCAM', sid: { '09': 'YORQI1Z', '27': 'HAWFA1X' }, ctr: 'n', name: 'Scotland, the north of England and Northern Ireland' },
    W:  { star: 'FIFAH 1B', entry: 'AMMAN', sid: { '09': 'BCN1Z',   '27': 'BCN1X' },   ctr: 'w', name: 'Dublin and the east of Ireland' },
    WA: { star: 'BAJJA 1B', entry: 'FANFE', sid: { '09': 'BCN1Z',   '27': 'BCN1X' },   ctr: 'w', name: 'the west of Ireland' },
    E:  { star: 'ICTAM 1B', entry: 'SAWPE', sid: { '09': 'YORQI1Z', '27': 'HAWFA1X' }, ctr: 'e', name: 'the Netherlands, Germany, Scandinavia, eastern Europe, Greece and Turkey' },
    S:  { star: 'TOJAQ 2B', entry: 'FARJO', sid: { '09': 'EXMOR1Z', '27': 'EXMOR1X' }, ctr: 's', name: 'France, Italy, the Channel Islands, eastern Spain and the Mediterranean' },
    SW: { star: 'DAWLY 1B', entry: 'DAWLY', sid: { '09': 'EXMOR1Z', '27': 'EXMOR1X' }, ctr: 's', name: 'Portugal, western Spain, the Canaries and North Africa' }
  };
  const PLACE_DIR = {
    EGPH: 'N', EGPF: 'N', EGPD: 'N', EGPE: 'N', EGNT: 'N', EGAA: 'N', EGAC: 'N', EGNS: 'N', EGCC: 'N',
    EIDW: 'W', EICK: 'WA', EIKN: 'WA', EINN: 'WA',
    EHAM: 'E', EDDM: 'E', EDDB: 'E', EKCH: 'E', EPKK: 'E', EPWR: 'E', EPPO: 'E', EPBY: 'E', LKPR: 'E', LROP: 'E', LBSF: 'E', LSGG: 'E', EGLL: 'E', EGKK: 'E', EGSS: 'E',
    LGAV: 'E', LGKR: 'E', LGPZ: 'E', LGSK: 'E', LGIR: 'E', LGRP: 'E', LGKO: 'E', LGSA: 'E', LTBS: 'E', LTFE: 'E', LTAI: 'E', LCPH: 'E', LCLK: 'E', HESH: 'E', HEGN: 'E',
    LDDU: 'E', LIPZ: 'E', LIPX: 'E', LIMC: 'E',
    LFPG: 'S', LFBD: 'S', LFBE: 'S', LFMN: 'S', LEBL: 'S', LEGE: 'S', LERS: 'S', LEPA: 'S', LEIB: 'S', LEAL: 'S', LEMI: 'S', LMML: 'S', DTNH: 'S', EGJJ: 'S', EGJB: 'S',
    LIRP: 'S', LIRF: 'S',
    LEMG: 'SW', LEMD: 'SW', LEBB: 'SW', LPFR: 'SW', LPPT: 'SW', LPPR: 'SW', GCTS: 'SW', GCLP: 'SW', GCRR: 'SW', GVAC: 'SW', GMAD: 'SW', GMMX: 'SW', LXGB: 'SW'
  };
  const dirFor = icao => DIR[PLACE_DIR[icao] || 'S'];

  // ── units and frequencies (AD 2-EGGD-2-1, the SID, STAR and approach charts). Bristol has no delivery frequency any
  // more (removed 8/26): Ground gives the clearance.
  const UNITS = {
    atis: { name: 'Bristol Information', freq: '126.030' }, gnd: { name: 'Bristol Ground', freq: '121.930' },
    twr: { name: 'Bristol Tower', freq: '133.855', alt: ['136.080'] },
    app: { name: 'Bristol Radar', freq: '125.655', alt: ['136.080'] }, dir: { name: 'Bristol Director', freq: '136.080' }, fire: { name: 'Bristol Fire', freq: '121.605' }
  };
  const CTR = { n: ['London Control', '134.755'], e: ['London Control', '134.755'], w: ['Cardiff Radar', '125.855'], s: ['Cardiff Radar', '125.855'] };
  const TA = 6000, TZ = 'Europe/London';
  // where cruising flights over the west of England divert to with a sick passenger (medical diversions in emerg.js)
  const ALTERNATES = [['Cardiff', 'EGFF', 'BCN'], ['Exeter', 'EGTE', 'EXMOR'], ['Birmingham', 'EGBB', 'HON']];

  // ── traffic: one real day of Bristol's boards (Sunday 11 October 2026, avionio.com), times local (BST) and turned to
  // UTC below. Bristol is a base airport: most aircraft night-stop and fly out first thing, so the arrival before each
  // departure is the same airline's previous inbound (30-150 minutes earlier). Late-evening arrivals stay overnight;
  // the arrivals after midnight are left out (the session day runs 07:00 to 22:00 local).
  // [arrival, from, arrival UTC, departure, to, departure UTC, type, days, stand]
  const TIMETABLE = [
    [null, null, null, 'EZY2815', 'LGPZ', '05:00', 'A21N', '1234567', null],
    [null, null, null, 'TOM6736', 'LEPA', '05:00', 'B738', '1234567', null],
    [null, null, null, 'TOM766', 'DTNH', '05:00', 'B738', '1234567', null],
    [null, null, null, 'EXS3415', 'GMAD', '05:10', 'B738', '1234567', null],
    [null, null, null, 'EZY2715', 'LEMG', '05:10', 'A20N', '1234567', null],
    [null, null, null, 'EZY2803', 'LGAV', '05:10', 'A20N', '1234567', null],
    [null, null, null, 'EXS1815', 'LGKR', '05:15', 'B738', '1234567', null],
    [null, null, null, 'EXS1871', 'LEPA', '05:15', 'B738', '1234567', null],
    [null, null, null, 'EZY2731', 'GCTS', '05:15', 'A320', '1234567', null],
    [null, null, null, 'EZY2759', 'LXGB', '05:15', 'A21N', '1234567', null],
    [null, null, null, 'KLM1074', 'EHAM', '05:15', 'E190', '1234567', null],
    [null, null, null, 'EZY2839', 'LIRP', '05:35', 'A320', '1234567', null],
    [null, null, null, 'EZY2821', 'LGRP', '05:45', 'A21N', '1234567', null],
    [null, null, null, 'TOM6718', 'LGIR', '05:50', 'B38M', '1234567', null],
    [null, null, null, 'EZY2867', 'LPPT', '05:55', 'A21N', '1234567', null],
    [null, null, null, 'EXS1807', 'LEMG', '06:00', 'B738', '1234567', null],
    [null, null, null, 'EXS1821', 'LPFR', '06:00', 'B738', '1234567', null],
    [null, null, null, 'EZY2721', 'LEAL', '06:00', 'A21N', '1234567', null],
    [null, null, null, 'EZY2829', 'LGSK', '06:05', 'A320', '1234567', null],
    [null, null, null, 'EZY2853', 'LTFE', '06:05', 'A319', '1234567', null],
    [null, null, null, 'EZY2863', 'LIPX', '06:05', 'A21N', '1234567', null],
    [null, null, null, 'EXS1805', 'LEAL', '06:20', 'B738', '1234567', null],
    [null, null, null, 'EZY2805', 'LGKO', '06:20', 'A21N', '1234567', null],
    [null, null, null, 'EZY2709', 'LEPA', '06:25', 'A320', '1234567', null],
    [null, null, null, 'EXS1873', 'LGPZ', '06:30', 'B738', '1234567', null],
    [null, null, null, 'EZY2883', 'LSGG', '06:35', 'A320', '1234567', null],
    [null, null, null, 'EZY2921', 'EHAM', '06:35', 'A21N', '1234567', null],
    ['RYR504', 'EIDW', '06:10', 'RYR9503', 'EPBY', '06:40', 'B738', '1234567', null],
    [null, null, null, 'EZY2733', 'GCRR', '06:55', 'A20N', '1234567', null],
    [null, null, null, 'EZY2737', 'LEBB', '06:55', 'A319', '1234567', null],
    [null, null, null, 'RYR505', 'EIDW', '07:00', 'B738', '1234567', null],
    ['EIN3280', 'EIDW', '06:55', 'EIN3281', 'EIDW', '07:25', 'AT76', '1234567', null],
    [null, null, null, 'EXS1883', 'GCTS', '07:30', 'B738', '1234567', null],
    [null, null, null, 'EZY2921', 'EHAM', '08:00', 'A21N', '1234567', null],
    [null, null, null, 'RYR4121', 'LEMG', '08:10', 'B738', '1234567', null],
    ['RYR4122', 'LEMG', '07:45', 'RYR5517', 'EPKK', '08:40', 'B38M', '1234567', null],
    ['EJU7507', 'LPFR', '08:00', 'EJU7508', 'LPFR', '08:30', 'A320', '1234567', null],
    ['RYR5518', 'EPKK', '08:15', 'RYR3161', 'LEBL', '08:55', 'B38M', '1234567', null],
    ['LOG581', 'EGJJ', '08:30', 'LOG582', 'EGJJ', '09:00', 'AT76', '1234567', null],
    ['RYR5164', 'EIDW', '08:30', 'RYR4753', 'GCTS', '09:15', 'B38M', '1234567', null],
    ['RYR4754', 'GCTS', '08:50', 'RYR2292', 'LEAL', '09:40', 'B738', '1234567', null],
    ['RYR2291', 'LEAL', '09:15', 'RYR6026', 'LFBE', '09:55', 'B738', '1234567', null],
    ['RYR9335', 'LEGE', '09:30', 'RYR8212', 'EPWR', '11:15', 'B38M', '1234567', null],
    ['EZY2922', 'EHAM', '10:00', 'EZY213', 'EGPH', '10:30', 'A20N', '1234567', null],
    ['EZY137', 'EGAA', '10:05', 'EZY138', 'EGAA', '10:50', 'A20N', '1234567', null],
    ['RYR8265', 'LEIB', '10:25', 'RYR749', 'LKPR', '11:15', 'B738', '1234567', null],
    [null, null, null, 'EZY2723', 'LEAL', '11:00', 'A20N', '1234567', null],
    ['EZY2884', 'LSGG', '10:35', 'EZY207', 'EGPF', '11:05', 'A20N', '1234567', null],
    ['VJT418', 'LFPG', '10:35', 'VJT418', 'EGLL', '11:45', 'GLF6', '1234567', null],
    ['RYR4148', 'LPFR', '10:40', 'RYR3560', 'LIMC', '11:30', 'B38M', '1234567', null],
    ['RYR8213', 'EPWR', '10:50', 'RYR7727', 'LEPA', '13:05', 'B738', '1234567', null],
    ['TOM6737', 'LEPA', '10:50', 'TOM324', 'HEGN', '12:55', 'B738', '1234567', null],
    ['EXS1872', 'LEPA', '10:55', 'EXS1863', 'GCLP', '13:05', 'B738', '1234567', null],
    ['EZY2840', 'LIRP', '10:55', 'EZY2711', 'LEPA', '11:40', 'A20N', '1234567', null],
    ['EZY2864', 'LIPX', '11:00', 'EZY2897', 'LERS', '12:00', 'A320', '1234567', null],
    ['EZY2738', 'LEBB', '11:05', 'EZY2701', 'LEMI', '12:00', 'A20N', '1234567', null],
    ['AUR642', 'EGJB', '11:25', 'AUR643', 'EGJB', '12:00', 'AT76', '1234567', null],
    ['EZY2716', 'LEMG', '11:25', 'EZY245', 'EGPE', '12:20', 'A319', '1234567', null],
    ['EZY2760', 'LXGB', '11:25', 'EZY2893', 'LDDU', '12:10', 'A20N', '1234567', null],
    ['EZY2722', 'LEAL', '11:40', 'EZY2811', 'LGKR', '12:45', 'A319', '1234567', null],
    ['EZY2868', 'LPPT', '11:40', 'EZY2935', 'LKPR', '12:30', 'A320', '1234567', null],
    ['RYR9504', 'EPBY', '11:45', null, null, null, 'B38M', '1234567', null],
    ['EXS1822', 'LPFR', '12:05', 'EXS1847', 'LGKO', '13:05', 'B738', '1234567', null],
    ['TOM767', 'DTNH', '12:05', 'TOM6746', 'LCPH', '13:15', 'B38M', '1234567', null],
    ['EXS1808', 'LEMG', '12:10', 'EXS1849', 'LTBS', '13:10', 'B738', '1234567', null],
    ['EZY2710', 'LEPA', '12:10', 'EZY320', 'EGPH', '12:55', 'A319', '1234567', null],
    ['EXS1806', 'LEAL', '12:15', 'EXS1803', 'GCRR', '13:40', 'B738', '1234567', null],
    ['EXS1816', 'LGKR', '12:30', 'EXS1811', 'LCPH', '14:10', 'B738', '1234567', null],
    ['EZY2816', 'LGPZ', '12:55', 'EZY2767', 'LFMN', '13:45', 'A20N', '1234567', null],
    ['EIN3284', 'EIDW', '13:25', 'EIN3285', 'EIDW', '13:55', 'AT76', '1234567', null],
    ['EJU7191', 'LEBL', '13:25', 'EJU7190', 'LEBL', '13:55', 'A320', '1234567', null],
    ['EXS3416', 'GMAD', '13:30', 'EXS1845', 'LTAI', '14:45', 'B738', '1234567', null],
    ['RYR506', 'EIDW', '13:30', 'RYR5341', 'LROP', '14:25', 'B38M', '1234567', null],
    ['EZY214', 'EGPH', '13:35', 'EZY2855', 'LTAI', '14:20', 'A320', '1234567', null],
    ['RYR6027', 'LFBE', '13:35', 'RYR8202', 'EIKN', '14:55', 'B38M', '1234567', null],
    ['EZY2804', 'LGAV', '13:40', 'EZY201', 'EGPF', '14:25', 'A320', '1234567', null],
    ['EZY240', 'EGNT', '13:55', 'EZY239', 'EGNT', '14:30', 'A21N', '1234567', null],
    ['EZY208', 'EGPF', '14:05', 'EZY261', 'EGAA', '14:45', 'A320', '1234567', null],
    ['RYR3160', 'LEBL', '14:05', 'RYR8123', 'LEMG', '16:10', 'B38M', '1234567', null],
    [null, null, null, 'TOM6758', 'GCRR', '14:40', 'B38M', '1234567', null],
    ['EZY2732', 'GCTS', '14:15', 'EZY217', 'EGPH', '15:05', 'A20N', '1234567', null],
    ['EXS1874', 'LGPZ', '14:20', 'EXS1835', 'LEIB', '15:25', 'B738', '1234567', null],
    ['EJU7659', 'LPPT', '14:30', 'EJU7660', 'LPPT', '15:00', 'A320', '1234567', null],
    ['EZY2830', 'LGSK', '14:30', 'EZY205', 'EGAA', '15:20', 'A319', '1234567', null],
    ['EIN3286', 'EIDW', '15:00', 'EIN3843', 'EICK', '15:30', 'AT76', '1234567', null],
    ['TOM6719', 'LGIR', '15:10', 'TOM6764', 'LCLK', '16:30', 'B38M', '1234567', null],
    ['EZY2822', 'LGRP', '15:15', 'EZY2937', 'EPKK', '16:05', 'A320', '1234567', null],
    ['EZY2854', 'LTFE', '15:25', 'EZY2925', 'EHAM', '16:05', 'A20N', '1234567', null],
    ['EZY2806', 'LGKO', '15:30', 'EZY2753', 'GMAD', '16:20', 'A20N', '1234567', null],
    ['EZY2734', 'GCRR', '15:35', 'EZY2837', 'LIRF', '16:30', 'A320', '1234567', null],
    ['RYR8122', 'LEMG', '15:45', 'RYR155', 'LEMD', '16:20', 'B738', '1234567', null],
    ['EZY246', 'EGPE', '15:50', 'EZY2707', 'LEMD', '17:00', 'A20N', '1234567', null],
    ['RYR750', 'LKPR', '15:55', 'RYR8296', 'LEAL', '16:30', 'B738', '1234567', null],
    ['EZY319', 'EGPH', '16:00', 'EZY2929', 'EDDM', '17:10', 'A320', '1234567', null],
    ['KLM1081', 'EHAM', '16:00', 'KLM1082', 'EHAM', '16:35', 'E190', '1234567', null],
    ['RYR8297', 'LEAL', '16:05', 'RYR1361', 'LIPZ', '16:35', 'B738', '1234567', null],
    ['RYR3559', 'LIMC', '16:10', 'RYR7949', 'EPPO', '18:10', 'B738', '1234567', null],
    ['EZY2724', 'LEAL', '16:40', 'EZY2931', 'EKCH', '17:55', 'A319', '1234567', null],
    ['EZY2898', 'LERS', '16:40', 'EZY2933', 'EDDB', '17:15', 'A20N', '1234567', null],
    ['EXS1884', 'GCTS', '17:00', null, null, null, 'B738', '1234567', null],
    ['EZY2712', 'LEPA', '17:15', 'EZY2873', 'LPFR', '18:00', 'A320', '1234567', null],
    ['EZY202', 'EGPF', '17:20', 'EZY211', 'EGPF', '18:25', 'A319', '1234567', null],
    ['EZY2936', 'LKPR', '17:20', 'EZY2705', 'LEBL', '18:05', 'A21N', '1234567', null],
    ['EZY262', 'EGAA', '17:35', 'EZY2775', 'LFPG', '18:35', 'A320', '1234567', null],
    [null, null, null, 'RYR1331', 'LPPR', '18:10', 'B738', '1234567', null],
    ['RYR7948', 'EPPO', '17:45', 'RYR509', 'EIDW', '18:55', 'B38M', '1234567', null],
    ['RYR8203', 'EIKN', '17:45', null, null, null, 'B738', '1234567', null],
    ['EZY2702', 'LEMI', '17:50', 'EZY2769', 'LFBD', '18:35', 'A320', '1234567', null],
    ['EZY218', 'EGPH', '18:05', 'EZY2743', 'LEAL', '18:50', 'A320', '1234567', null],
    ['LOG583', 'EGJJ', '18:05', 'LOG584', 'EGJJ', '18:35', 'AT76', '1234567', null],
    ['EZY206', 'EGAA', '18:10', 'EZY229', 'EGAA', '19:00', 'A320', '1234567', null],
    ['LOG45', 'EGPD', '18:25', 'LOG46', 'EGPD', '18:55', 'E145', '1234567', null],
    ['EZY2894', 'LDDU', '18:30', 'EZY219', 'EGPH', '19:10', 'A320', '1234567', null],
    ['RYR7728', 'LEPA', '18:30', null, null, null, 'B38M', '1234567', null],
    ['EZY9007', 'EGAA', '18:47', 'EZY209', 'EGPF', '19:30', 'A21N', '1234567', null],
    ['EIN3842', 'EICK', '18:50', 'EIN3289', 'EIDW', '19:25', 'AT76', '1234567', null],
    ['EZY2766', 'LFMN', '18:50', 'EZY241', 'EGNT', '19:45', 'A21N', '1234567', null],
    ['EZY7267', 'LEPA', '19:10', null, null, null, 'A21N', '1234567', null],
    ['EZY2926', 'EHAM', '19:15', null, null, null, 'A20N', '1234567', null],
    [null, null, null, 'EJU7268', 'LEPA', '19:45', 'A320', '1234567', null],
    ['EZY2812', 'LGKR', '20:20', null, null, null, 'A21N', '1234567', null],
    ['EXS1836', 'LEIB', '21:05', null, null, null, 'B738', '1234567', null],
    ['KLM1083', 'EHAM', '21:05', null, null, null, 'E190', '1234567', null],
    ['EZY212', 'EGPF', '21:20', null, null, null, 'A320', '1234567', null],
    ['RYR154', 'LEMD', '21:25', null, null, null, 'B738', '1234567', null],
    ['RYR508', 'EIDW', '21:30', null, null, null, 'B738', '1234567', null],
    ['RYR1362', 'LIPZ', '21:40', null, null, null, 'B738', '1234567', null],
    ['EZY2776', 'LFPG', '21:45', null, null, null, 'A21N', '1234567', null],
    ['RYR5342', 'LROP', '21:45', null, null, null, 'B38M', '1234567', null],
    ['EZY230', 'EGAA', '21:50', null, null, null, 'A320', '1234567', null],
    ['EZY2930', 'EDDM', '21:55', null, null, null, 'A20N', '1234567', null],
    ['EZY2934', 'EDDB', '21:55', null, null, null, 'A320', '1234567', null],
    ['EZY2938', 'EPKK', '21:55', null, null, null, 'A20N', '1234567', null],
    ['EZY2708', 'LEMD', '22:05', null, null, null, 'A320', '1234567', null],
    ['EXS1848', 'LGKO', '22:10', null, null, null, 'B738', '1234567', null],
    ['EXS1864', 'GCLP', '22:10', null, null, null, 'B738', '1234567', null],
    ['EZY220', 'EGPH', '22:10', null, null, null, 'A320', '1234567', null],
    ['EZY2770', 'LFBD', '22:15', null, null, null, 'A20N', '1234567', null],
    ['EXS1804', 'GCRR', '22:20', null, null, null, 'B738', '1234567', null],
    ['EZY242', 'EGNT', '22:25', null, null, null, 'A320', '1234567', null],
    ['EZY2932', 'EKCH', '22:25', null, null, null, 'A319', '1234567', null],
    ['EXS1850', 'LTBS', '22:30', null, null, null, 'B738', '1234567', null],
    ['EZY210', 'EGPF', '22:35', null, null, null, 'A320', '1234567', null],
    ['EZY2838', 'LIRF', '22:35', null, null, null, 'A320', '1234567', null],
    ['RYR1332', 'LPPR', '22:50', null, null, null, 'B738', '1234567', null]
  ];

  const LONG_STAY = [['GBRSG', 'PC12', null, '1234567']];
  const EXTRA = [
    { cs: 'EZY6215', t: 'A20N', k: 'ARR', o: 'LEMG' }, { cs: 'RYR4561', t: 'B38M', k: 'DEP', d: 'LEPA' }, { cs: 'EXS1866', t: 'B738', k: 'ARR', o: 'GCTS' },
    { cs: 'EZY6231', t: 'A320', k: 'DEP', d: 'LPFR' }, { cs: 'TOM6742', t: 'B38M', k: 'ARR', o: 'LGKO' }, { cs: 'EZY405', t: 'A319', k: 'DEP', d: 'EGPH' },
    { cs: 'KLM1077', t: 'E190', k: 'ARR', o: 'EHAM' }, { cs: 'RYR8125', t: 'B738', k: 'DEP', d: 'LEAL' }, { cs: 'LOG585', t: 'AT76', k: 'ARR', o: 'EGJJ' },
    { cs: 'EZY6249', t: 'A21N', k: 'DEP', d: 'GCRR' }, { cs: 'AUR644', t: 'AT76', k: 'ARR', o: 'EGJB' }, { cs: 'EIN3283', t: 'AT76', k: 'DEP', d: 'EIDW' },
    { cs: 'EXS1823', t: 'B738', k: 'ARR', o: 'LPFR' }, { cs: 'EZY6203', t: 'A320', k: 'DEP', d: 'LEBL' }, { cs: 'NJE427L', t: 'C56X', k: 'ARR', o: 'LFPG' }
  ];
  const EXERCISES = {
    dep: { name: 'Bristol 1 · Off 27 from the West Apron', wx: 'west', rwy: '27', sched: [{ cs: 'EZY6201', t: 'A320', k: 'DEP', d: 'LEMG', m: 0, stand: '31' }] },
    arr: { name: 'Bristol 2 · From the ICTAM arrival to the ILS 27', wx: 'west', rwy: '27', sched: [{ cs: 'KLM1081', t: 'E190', k: 'ARR', o: 'EHAM', m: 0 }] },
    mix: { name: 'Bristol 3 · One runway, both ways', wx: 'west', rwy: '27', sched: [{ cs: 'EXS1885', t: 'B738', k: 'ARR', o: 'GCTS', m: 0 },
      { cs: 'RYR4122', t: 'B38M', k: 'DEP', d: 'LEMG', m: 0, stand: '9' }, { cs: 'EZY6233', t: 'A20N', k: 'DEP', d: 'LPFR', m: 0, stand: '24' }] }
  };
  const WX_PRESETS = {
    west:  { name: 'South-westerly, runway 27',                          short: 'Westerly',  metar: 'EGGD 111250Z 24012KT 9999 FEW022 SCT040 15/10 Q1014' },
    east:  { name: 'Easterly: runway 09, a tailwind take-off slope',     short: 'Easterly',  metar: 'EGGD 111250Z 08010KT 9999 SCT035 13/05 Q1028' },
    low:   { name: 'Hill fog on Broadfield Down: ILS 27 near the minima', short: 'Low cloud', metar: 'EGGD 111250Z 23008KT 1500 -DZ BR OVC002 12/12 Q1009' },
    fog:   { name: 'Thick fog: below the ILS minima',                     short: 'Fog',       metar: 'EGGD 110550Z 20003KT 0300 R27/0350N FG VV001 10/10 Q1018' },
    storm: { name: 'Atlantic gale: gusty crosswind on 27',                short: 'Storm',     metar: 'EGGD 111250Z 20028G44KT 8000 -RA BKN010 14/12 Q0988' },
    calm:  { name: 'High pressure, light and variable',                   short: 'Calm',      metar: 'EGGD 111250Z VRB02KT 9999 FEW040 18/09 Q1031' }
  };

  // airline radio telephony and codes at Bristol (merged into the engine's tables). Aer Lingus Regional (EA, flown by
  // Emerald) uses Aer Lingus's EIN/Shamrock; easyJet Europe (EC) keeps Alpine.
  const TEL = { EZY: 'Easy', EJU: 'Alpine', RYR: 'Ryanair', EXS: 'Channex', TOM: 'Tomjet', KLM: 'KLM', EIN: 'Shamrock', LOG: 'Logan', AUR: 'Ayline',
    VJT: 'Vista', NJE: 'Fraction', BAW: 'Speedbird' };
  const AIRLINE_ICAO = { U2: 'EZY', EC: 'EJU', FR: 'RYR', LS: 'EXS', BY: 'TOM', KL: 'KLM', EA: 'EIN', EI: 'EIN', LM: 'LOG', GR: 'AUR', BA: 'BAW' };
  const AIRLINE_TYPE = { EZY: 'A320', EJU: 'A320', RYR: 'B38M', EXS: 'B738', TOM: 'B38M', KLM: 'E190', EIN: 'AT76', LOG: 'AT76', AUR: 'AT76', VJT: 'GLF6', BAW: 'A320' };
  // the apron each airline normally uses: easyJet (Bristol's largest airline) on the West Apron and the Main Apron,
  // Ryanair, Jet2 and TUI on the East Apron, the regional and KLM flights on the Main Apron by the terminal
  const APRON_OF = { EZY: 'W', EJU: 'W', RYR: 'E', EXS: 'E', TOM: 'E', KLM: 'M', EIN: 'M', LOG: 'M', AUR: 'M', BAW: 'M' };
  const TYPES = {
    B38M: { name: '737 MAX 8',     wake: 'M', vapp: 145, vr: 150, climb: 2400, desc: 2100, cruise: 290, span: 35.9, len: 39.5, shape: 'jet' },
    E190: { name: 'Embraer 190',   wake: 'M', vapp: 128, vr: 135, climb: 2500, desc: 2000, cruise: 280, span: 28.7, len: 36.2, shape: 'jet' },
    E145: { name: 'Embraer 145',   wake: 'M', vapp: 125, vr: 130, climb: 2400, desc: 2000, cruise: 270, span: 20.0, len: 29.9, shape: 'jet' }
  };
  // Bristol's flight boards give places by city name
  const PLACES = {
    'aberdeen': 'EGPD', 'agadir': 'GMAD', 'alicante': 'LEAL', 'amsterdam': 'EHAM', 'antalya': 'LTAI', 'athens': 'LGAV', 'barcelona': 'LEBL',
    'belfast': 'EGAA', 'belfast city': 'EGAC', 'bergerac': 'LFBE', 'berlin': 'EDDB', 'bilbao': 'LEBB', 'bodrum': 'LTFE', 'bordeaux': 'LFBD',
    'bucharest': 'LROP', 'bydgoszcz': 'EPBY', 'chania': 'LGSA', 'copenhagen': 'EKCH', 'corfu': 'LGKR', 'cork': 'EICK', 'dalaman': 'LTBS',
    'dublin': 'EIDW', 'dubrovnik': 'LDDU', 'edinburgh': 'EGPH', 'enfidha': 'DTNH', 'faro': 'LPFR', 'geneva': 'LSGG', 'gibraltar': 'LXGB',
    'girona': 'LEGE', 'glasgow': 'EGPF', 'gran canaria': 'GCLP', 'guernsey': 'EGJB', 'heraklion': 'LGIR', 'hurghada': 'HEGN', 'ibiza': 'LEIB',
    'inverness': 'EGPE', 'isle of man': 'EGNS', 'jersey': 'EGJJ', 'kerkyra': 'LGKR', 'knock': 'EIKN', 'kos': 'LGKO', 'krakow': 'EPKK',
    'krakow/balice': 'EPKK', 'lanzarote': 'GCRR', 'larnaca': 'LCLK', 'lisbon': 'LPPT', 'london': 'EGLL', 'madrid': 'LEMD', 'malaga': 'LEMG',
    'malta': 'LMML', 'manchester': 'EGCC', 'marrakech': 'GMMX', 'milan': 'LIMC', 'munich': 'EDDM', 'murcia': 'LEMI', 'newcastle': 'EGNT',
    'nice': 'LFMN', 'palma': 'LEPA', 'palma de mallorca': 'LEPA', 'paphos': 'LCPH', 'paris': 'LFPG', 'pisa': 'LIRP', 'porto': 'LPPR',
    'poznan': 'EPPO', 'prague': 'LKPR', 'preveza/lefkada': 'LGPZ', 'reus': 'LERS', 'rhodes': 'LGRP', 'rome': 'LIRF', 'sal island': 'GVAC',
    'shannon': 'EINN', 'sharm el-sheikh': 'HESH', 'skiathos': 'LGSK', 'sofia': 'LBSF', 'tenerife': 'GCTS', 'venice': 'LIPZ', 'verona': 'LIPX',
    'wroclaw': 'EPWR'
  };
  const AIRPORTS = {
    EGGD: [51.3827, -2.7191, 'Bristol'], EGFF: [51.3967, -3.3433, 'Cardiff'], EGTE: [50.7344, -3.4139, 'Exeter'],
    EPPO: [52.4211, 16.8263, 'Poznań'], EPBY: [53.0968, 17.9777, 'Bydgoszcz'], LFBE: [44.8253, 0.5186, 'Bergerac'],
    EIDW: [53.4213, -6.2701, 'Dublin'], LEMG: [36.6749, -4.4991, 'Málaga'], LPFR: [37.0144, -7.9659, 'Faro'], EPKK: [50.0777, 19.7848, 'Kraków'],
    EGJJ: [49.2079, -2.1955, 'Jersey'], GCTS: [28.0445, -16.5725, 'Tenerife South'], LEAL: [38.2822, -0.5582, 'Alicante'],
    EGAA: [54.6575, -6.2158, 'Belfast'], EPWR: [51.1027, 16.8858, 'Wrocław'], EGJB: [49.4350, -2.6019, 'Guernsey'],
    LEBL: [41.2971, 2.0785, 'Barcelona'], EGPH: [55.9500, -3.3725, 'Edinburgh'], EGNT: [55.0375, -1.6917, 'Newcastle'],
    LPPT: [38.7742, -9.1342, 'Lisbon'], EHAM: [52.3086, 4.7639, 'Amsterdam'], EGPF: [55.8719, -4.4331, 'Glasgow'],
    EGPD: [57.2019, -2.1978, 'Aberdeen'], LBSF: [42.6967, 23.4114, 'Sofia'], LEPA: [39.5517, 2.7388, 'Palma'], LMML: [35.8575, 14.4775, 'Malta'],
    LGRP: [36.4054, 28.0862, 'Rhodes'], GMMX: [31.6069, -8.0363, 'Marrakech'], LEIB: [38.8729, 1.3731, 'Ibiza'],
    GCRR: [28.9455, -13.6052, 'Lanzarote'], LCPH: [34.7180, 32.4857, 'Paphos'], GCLP: [27.9319, -15.3866, 'Gran Canaria'],
    HESH: [27.9773, 34.3950, 'Sharm el-Sheikh'], HEGN: [27.1783, 33.7994, 'Hurghada'], LTBS: [36.7131, 28.7925, 'Dalaman'],
    LGSA: [35.5317, 24.1497, 'Chania'], LTAI: [36.8987, 30.8005, 'Antalya'], GVAC: [16.7414, -22.9494, 'Sal'], LEGE: [41.9010, 2.7605, 'Girona'],
    LSGG: [46.2381, 6.1090, 'Geneva'], LFPG: [49.0097, 2.5479, 'Paris CDG'], LIRP: [43.6839, 10.3927, 'Pisa'], LIPX: [45.3957, 10.8885, 'Verona'],
    LEBB: [43.3011, -2.9106, 'Bilbao'], LXGB: [36.1512, -5.3497, 'Gibraltar'], DTNH: [36.0758, 10.4386, 'Enfidha'], LGKR: [39.6019, 19.9117, 'Corfu'],
    LGPZ: [38.9255, 20.7653, 'Preveza'], GMAD: [30.3250, -9.4131, 'Agadir'], LGAV: [37.9364, 23.9445, 'Athens'], LGSK: [39.1771, 23.5037, 'Skiathos'],
    LGIR: [35.3397, 25.1803, 'Heraklion'], LTFE: [37.2506, 27.6643, 'Bodrum'], LGKO: [36.7933, 27.0917, 'Kos'], EGPE: [57.5425, -4.0475, 'Inverness'],
    LKPR: [50.1008, 14.2600, 'Prague'], LIMC: [45.6306, 8.7281, 'Milan Malpensa'], LERS: [41.1474, 1.1672, 'Reus'], EIKN: [53.9103, -8.8185, 'Knock'],
    LEMI: [37.8030, -1.1250, 'Murcia'], LDDU: [42.5614, 18.2682, 'Dubrovnik'], EICK: [51.8413, -8.4911, 'Cork'], LFMN: [43.6584, 7.2159, 'Nice'],
    LEMD: [40.4983, -3.5676, 'Madrid'], LIPZ: [45.5053, 12.3519, 'Venice'], LROP: [44.5711, 26.0850, 'Bucharest'], EDDM: [48.3538, 11.7861, 'Munich'],
    EDDB: [52.3667, 13.5033, 'Berlin'], LFBD: [44.8283, -0.7156, 'Bordeaux'], EKCH: [55.6181, 12.6561, 'Copenhagen'], LIRF: [41.8003, 12.2389, 'Rome'],
    LPPR: [41.2481, -8.6814, 'Porto'], EGLL: [51.4700, -0.4543, 'London Heathrow'], LCLK: [34.8751, 33.6249, 'Larnaca'],
    EGKK: [51.1481, -0.1903, 'London Gatwick'], EGCC: [53.3537, -2.2750, 'Manchester'], EGSS: [51.8850, 0.2350, 'London Stansted'],
    EGHH: [50.7800, -1.8425, 'Bournemouth'], EGBB: [52.4539, -1.7480, 'Birmingham'],
    EGAC: [54.6181, -5.8725, 'Belfast City'], EGNS: [54.0833, -4.6239, 'Isle of Man'], EINN: [52.7020, -8.9248, 'Shannon']
  };

  return {
    icao: 'EGGD', iata: 'BRS', name: 'Bristol', city: 'Bristol', country: 'United Kingdom', arp: P('512258N', '0024309W'), elev: 622,
    FIX, NAV, RWY, STARS, HOLDS_AIR, ILS, SIDS, SID_PTS, DIR, PLACE_DIR, dirFor, UNITS, CTR, TA, TZ, ALTERNATES,
    TIMETABLE, LONG_STAY, EXTRA, EXERCISES, WX_PRESETS, TEL, AIRLINE_ICAO, AIRLINE_TYPE, APRON_OF, TYPES, PLACES, AIRPORTS,
    data: { metar: 'eggd/metar.txt', flights: 'eggd/flights.json' },
    features: { roadCrossing: false, sra: false, ils: true, rnavSids: false, singleRunway: true, mixedMode: true }
  };
})();
if (typeof module !== 'undefined') module.exports = EGGD;
