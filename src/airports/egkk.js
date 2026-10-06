// ═════════════════════════ London Gatwick (EGKK) airport profile ═════════════════════════
// Everything the Clearway engine needs to know that is true only of Gatwick. Sources: UK AIP AD 2 EGKK charts
// (aerodrome 2-1, ground movement 2-2, stand coordinates 2-3, RNAV1 SIDs 6-1..6-22 with their coding tables, STARs
// 7-1..7-14, holds 7-15/7-16, ILS initial approaches 7-17/7-18, ILS/DME 8-1 and 8-5, RNP coding 8-9) and OpenStreetMap
// for the taxiways, aprons and buildings (egkk-ground.js). Positions are lat/lon (WGS84); bearings are TRUE unless named
// "mag" (variation 1.3°E: magnetic = true − 1.3). Summary of the charts: airports/egkk/README.md.
// Gatwick is the world's busiest single-runway airport: 08R/26L is the only runway. The old 08L/26R is now part of
// taxiway J (it was the emergency runway) and is drawn and used as a taxiway only.
// Plain data plus a few small functions, like kjfk.js; egkk-engine.js turns it into the engine's globals.

const EGKK = (() => {
  const ll = (s) => {                                     // '510627.14N' / '0002853.92W' → decimal degrees
    const m = s.match(/^(\d{2,3})(\d{2})(\d{2}(?:\.\d+)?)([NSEW])$/);
    const v = +m[1] + m[2]/60 + m[3]/3600; return /[SW]/.test(m[4]) ? -v : v;
  };
  const P = (lat, lon) => [ll(lat), ll(lon)];

  // ── fixes (SID, STAR, hold and approach coding tables 6-18..6-22, 7-10..7-16, 8-9)
  const FIX = {
    ABIBI: P('510627.14N', '0002853.92W'), ABSAV: P('503828.94N', '0011029.05W'), ABTUM: P('512603.66N', '0012228.98E'),
    AMDUT: P('504027.90N', '0004746.38E'), ARNUN: P('510325.98N', '0005552.98E'), AVANT: P('504912.00N', '0005618.05W'),
    BARMI: P('522841.76N', '0023413.73E'), BOGNA: P('504207.00N', '0001505.57W'), CLN: P('515054.50N', '0010851.32E'),
    DAGGA: P('514919.37N', '0004739.00E'), DET: P('511814.41N', '0003550.19E'), DISIT: P('520610.84N', '0014240.91W'),
    DISVO: P('503931.38N', '0010257.16W'), ELDAX: P('502918.36N', '0003930.42E'), ELDER: P('503948.10N', '0012013.93W'),
    FRANE: P('512306.00N', '0003739.40E'), GWC: P('505118.79N', '0004524.25W'), HARDY: P('502815.75N', '0002928.04E'),
    HASTY: P('504342.46N', '0003200.37E'), HOLLY: P('505312.18N', '0000542.23W'), IMVUR: P('511028.90N', '0003156.40W'),
    K08RF: P('510653.25N', '0002548.08W'), K26LF: P('511052.33N', '0000305.46E'), KIDLI: P('514617.00N', '0012140.87W'),
    KKE02: P('510953.05N', '0000410.13W'), KKE03: P('510958.00N', '0000334.10W'), KKE04: P('511008.38N', '0000218.83W'),
    KKE05: P('511005.90N', '0000235.70W'), KKE10: P('510955.93N', '0000909.88E'), KKE12: P('511459.25N', '0000624.07E'),
    KKE17: P('510957.12N', '0001937.59E'), KKE25: P('510957.30N', '0003244.84E'), KKE35: P('511659.04N', '0002316.22E'),
    KKE63: P('505856.70N', '0004051.78E'), KKE64: P('504915.77N', '0003030.52E'), KKN09: P('511353.10N', '0000355.30W'),
    KKN43: P('512453.61N', '0001809.13E'), KKN48: P('512931.14N', '0001508.68E'), KKS06: P('510422.79N', '0001744.35W'),
    KKS08: P('510544.80N', '0000209.20W'), KKS09: P('510347.42N', '0001043.34W'), KKS11: P('510442.43N', '0002505.76W'),
    KKS12: P('510155.10N', '0000020.40W'), KKS13: P('510205.06N', '0002223.13W'), KKS14: P('510311.65N', '0000652.24W'),
    KKS16: P('505805.21N', '0000128.29E'), KKS17: P('510022.73N', '0002432.75W'), KKS19: P('505729.42N', '0001402.01W'),
    KKS20: P('505524.03N', '0002354.89W'), KKS21: P('505610.56N', '0001139.14W'), KKS22: P('505220.70N', '0000410.60E'),
    KKS25: P('504958.32N', '0002313.74W'), KKS33: P('510327.27N', '0002657.12E'), KKS36: P('510503.33N', '0003055.89E'),
    KKW04: P('510750.70N', '0001857.30W'), KKW06: P('510726.09N', '0002153.73W'), KKW07: P('510717.20N', '0002300.00W'),
    KKW08: P('510656.84N', '0002522.88W'), KKW09: P('510654.30N', '0002544.30W'), KKW10: P('510648.64N', '0002621.35W'),
    KKW11: P('510338.83N', '0002514.22W'), KKW19: P('511158.00N', '0002034.30W'), KONAN: P('510750.75N', '0020000.00E'),
    KUNAV: P('503054.00N', '0010356.00E'), LAM: P('513845.69N', '0000906.13E'), LARCK: P('505441.83N', '0002647.93E'),
    MAY: P('510101.86N', '0000658.04E'), MID: P('510314.23N', '0003730.01W'), NEDUL: P('503958.00N', '0013251.86W'),
    NETVU: P('502445.00N', '0002854.00E'), NEVIL: P('500000.00N', '0002205.64W'), NIGIT: P('511846.96N', '0011014.71W'),
    NOVMA: P('510211.79N', '0004514.92W'), ODROB: P('513915.11N', '0015445.17E'), ODVIK: P('510957.40N', '0002909.33E'),
    OLEVI: P('511117.40N', '0000611.30E'), OSDEB: P('505654.53N', '0002447.85E'), OSPOL: P('500900.00N', '0001107.84W'),
    OTMET: P('504055.06N', '0023053.37W'), SFD: P('504538.48N', '0000718.89E'), SIRIC: P('512036.17N', '0013358.89W'),
    SOKDU: P('503939.22N', '0020133.06W'), SONOG: P('520619.71N', '0021610.08E'), SUNAV: P('511536.90N', '0001139.80E'),
    TEBRA: P('512920.30N', '0013643.00E'), TELTU: P('504839.92N', '0004517.69W'), TIMBA: P('505643.99N', '0001542.25E'),
    TUFOZ: P('510101.01N', '0003024.31W'), VASUX: P('503009.23N', '0011516.99W'), WILLO: P('505905.88N', '0001130.30W'),
    WIZAD: P('510700.00N', '0005711.09E'), ZOPHI: P('510126.60N', '0000055.43W')
  };
  // VOR/DMEs named on the SID and STAR charts
  const NAV = {
    MAY: { name: 'Mayfield VOR/DME', freq: '117.90', p: P('510101.86N', '0000658.04E') },
    MID: { name: 'Midhurst VOR/DME', freq: '114.00', p: P('510314.23N', '0003730.01W') },
    SFD: { name: 'Seaford VOR/DME', freq: '117.00', p: P('504538.48N', '0000718.89E') },
    LAM: { name: 'Lambourne VOR/DME', freq: '115.60', p: P('513845.69N', '0000906.13E') },
    DET: { name: 'Detling VOR/DME', freq: '117.30', p: P('511814.41N', '0003550.19E') },
    GWC: { name: 'Goodwood VOR/DME', freq: '114.75', p: P('505118.79N', '0004524.25W') },
    CLN: { name: 'Clacton VOR/DME', freq: '114.55', p: P('515054.50N', '0010851.32E') }
  };

  // ── runway (AD 2-EGKK-2-1): 08R/26L 3316 × 45 m asphalt, magnetic 076°/256°. 26L threshold displaced; the pavement
  // east of it is the 26L starter extension (departures from M1). 08L/26R (the old emergency runway) is taxiway J.
  const RWY = {
    lo: '08R', hi: '26L', magHdg: { '08R': 76, '26L': 256 }, var: 1.3,
    thr: { '08R': P('510845.12N', '0001224.52W'), '26L': P('510902.42N', '0001019.00W') },
    elev: { '08R': 196, '26L': 196 }, length: 3316, width: 45
  };

  // ── STARs (7-1..7-14). Gatwick's arrivals end at the TIMBA (east) or WILLO (west) hold at FL70; Gatwick Director
  // vectors them from there onto the ILS. Alt = level constraint at the fix (feet).
  const STARS = {
    'KIDLI 1G': { from: 'N',  pts: [['KIDLI', 15000], ['MID'], ['TUFOZ'], ['HOLLY'], ['WILLO', 7000]] },
    'SIRIC 1G': { from: 'W',  pts: [['SIRIC', 14000], ['NIGIT'], ['MID'], ['TUFOZ'], ['HOLLY'], ['WILLO', 7000]] },
    'TEBRA 2G': { from: 'NE', pts: [['TEBRA'], ['ABTUM', 14000], ['ARNUN'], ['KKE63'], ['LARCK'], ['TIMBA', 7000]] },
    'KONAN 2G': { from: 'E',  pts: [['KONAN'], ['ARNUN'], ['KKE63'], ['LARCK'], ['TIMBA', 7000]] },
    'KUNAV 1G': { from: 'SE', pts: [['KUNAV'], ['AMDUT', 16000], ['KKE64'], ['TIMBA', 7000]] },
    'NEVIL 1G': { from: 'S',  pts: [['NEVIL', 22000], ['OSPOL'], ['NETVU', 14000], ['ELDAX'], ['AMDUT'], ['KKE64'], ['TIMBA', 7000]] },
    'VASUX 1G': { from: 'SW', pts: [['VASUX'], ['DISVO'], ['TELTU', 13000], ['HOLLY'], ['WILLO', 7000]] },
    'ABSAV 1G': { from: 'CI', pts: [['ABSAV'], ['AVANT'], ['GWC', 13000], ['HOLLY'], ['WILLO', 7000]] }
  };
  // the STAR holds (7-15, 7-16): inbound track true, turn, levels, speed
  const HOLDS_AIR = {
    TIMBA: { inb: 308.6, turn: 'R', min: 7000, max: 15000, maxKt: 220 },
    WILLO: { inb: 284.0, turn: 'L', min: 7000, max: 15000, maxKt: 220 }
  };

  // ── ILS/DME approaches (8-1, 8-5; initial approach 7-17, 7-18): 3° glidepath, intercept 3000 ft. IF ABIBI (08R) and
  // OLEVI (26L) at 10.6 NM, final approach point K08RF/K26LF at 8.6 NM. Missed approach: climb straight ahead to 3000 ft;
  // at 2000 ft turn (08R right, 26L left) heading 177° mag towards Mayfield (MAY), not above 3000 ft.
  const ILS = {
    '08R': { loc: 'I-GG', freq: '110.90', ifx: 'ABIBI', faf: 'K08RF', ifAlt: 3000, fafAlt: 3000, missed: ['MAY', 3000], turn: 1 },
    '26L': { loc: 'I-WW', freq: '110.90', ifx: 'OLEVI', faf: 'K26LF', ifAlt: 3000, fafAlt: 3000, missed: ['MAY', 3000], turn: -1 }
  };

  // ── SIDs (6-1..6-22), all RNAV1. Each climbs to its stop altitude (most 6000 ft, the Midhurst routes 4000 ft, the
  // Lambourne and Clacton routes from 26L 5000 ft) and London Control climbs it further. 08R departures turn at the
  // KKE fixes; 26L departures fly straight ahead to the KKW fixes first. Alt = level constraint at the fix (feet).
  const SIDS = {
    'LAM1Z':   { rwy: '08R', spoken: 'Lambourne One Zulu', pts: [['KKE02', 2000], ['KKE12', 3000], ['SUNAV', 5000], ['KKE35', 5000], ['KKN43', 5000], ['KKN48', 6000], ['LAM', 6000]] },
    'FRANE1Z': { rwy: '08R', spoken: 'Frane One Zulu', pts: [['KKE04', 2000], ['KKE10', 3000], ['KKE17', 5000], ['KKE25', 5000], ['DET', 5000], ['FRANE', 6000]] },
    'IMVUR1Z': { rwy: '08R', spoken: 'Imvur One Zulu', pts: [['KKE05', 2500], ['KKN09', 3000], ['KKW19', 3000], ['IMVUR', 4000]] },
    'ODVIK2Z': { rwy: '08R', spoken: 'Odvik Two Zulu', pts: [['KKE04', 2000], ['KKE10', 3000], ['KKE17', 5000], ['ODVIK', 6000]] },
    'SFD4Z':   { rwy: '08R', spoken: 'Seaford Four Zulu', pts: [['KKE03', 2000], ['KKS08', 3000], ['KKS12'], ['KKS16', 5000], ['KKS22', 6000], ['SFD', 6000]] },
    'BOGNA1X': { rwy: '26L', spoken: 'Bogna One X-ray', pts: [['KKW06', 2500], ['KKW08'], ['KKS11', 4000], ['KKS17', 5000], ['KKS20', 6000], ['KKS25', 6000], ['BOGNA', 6000]] },
    'HARDY1X': { rwy: '26L', spoken: 'Hardy One X-ray', pts: [['KKW06', 2500], ['KKW08'], ['KKS11', 4000], ['KKS17', 5000], ['KKS20', 6000], ['KKS25', 6000], ['BOGNA', 6000], ['HARDY', 6000]] },
    'NOVMA1X': { rwy: '26L', spoken: 'Novma One X-ray', pts: [['KKW07', 2500], ['KKW09', 3000], ['MID', 4000], ['NOVMA', 4000]] },
    'SFD1X':   { rwy: '26L', spoken: 'Seaford One X-ray', pts: [['KKW06', 2500], ['KKW10'], ['KKW11'], ['KKS13', 4000], ['KKS19', 5000], ['KKS21', 6000], ['SFD', 6000]] },
    'WIZAD1X': { rwy: '26L', spoken: 'Wizad One X-ray', pts: [['KKW04', 2000], ['KKS06', 3000], ['KKS09'], ['KKS14', 4000], ['MAY', 5000], ['KKS33', 6000], ['WIZAD', 6000]] },
    'TIGER1X': { rwy: '26L', spoken: 'Tiger One X-ray', pts: [['KKW04', 2000], ['KKS06', 3000], ['KKS09'], ['KKS14', 4000], ['MAY', 5000], ['KKS36', 5000], ['LAM', 5000]] },
    'DAGGA1X': { rwy: '26L', spoken: 'Dagga One X-ray', pts: [['KKW04', 2000], ['KKS06', 3000], ['KKS09'], ['KKS14', 4000], ['MAY', 5000], ['KKS36', 5000], ['DET', 5000], ['DAGGA', 5000], ['CLN', 5000]] }
  };
  // airway directions: the STAR an arrival flies, where the simulator picks it up (about 40-60 NM out, after London
  // Control has brought it down), the SID for each runway and the London Control sector that takes the departure
  const DIR = {
    N:  { star: 'KIDLI 1G', entry: 'MID',   sid: { '08R': 'LAM1Z',   '26L': 'TIGER1X' }, ctr: 'n', name: 'Scotland and the north of England' },
    W:  { star: 'SIRIC 1G', entry: 'NIGIT', sid: { '08R': 'IMVUR1Z', '26L': 'NOVMA1X' }, ctr: 'w', name: 'Ireland, Wales and the west' },
    NE: { star: 'TEBRA 2G', entry: 'ABTUM', sid: { '08R': 'FRANE1Z', '26L': 'DAGGA1X' }, ctr: 'e', name: 'Scandinavia, the Baltic and the Netherlands' },
    E:  { star: 'KONAN 2G', entry: 'ARNUN', sid: { '08R': 'ODVIK2Z', '26L': 'WIZAD1X' }, ctr: 'e', name: 'Germany, central and eastern Europe' },
    SE: { star: 'KUNAV 1G', entry: 'AMDUT', sid: { '08R': 'ODVIK2Z', '26L': 'WIZAD1X' }, ctr: 'e', name: 'Switzerland, Italy, Greece, Turkey and beyond' },
    S:  { star: 'NEVIL 1G', entry: 'NETVU', sid: { '08R': 'SFD4Z',   '26L': 'SFD1X' },   ctr: 's', name: 'France and the western Mediterranean' },
    SW: { star: 'VASUX 1G', entry: 'DISVO', sid: { '08R': 'SFD4Z',   '26L': 'HARDY1X' }, ctr: 's', name: 'Spain, Portugal, the Canaries and North Africa' },
    CI: { star: 'ABSAV 1G', entry: 'AVANT', sid: { '08R': 'SFD4Z',   '26L': 'BOGNA1X' }, ctr: 's', name: 'the Channel Islands and the Atlantic' }
  };
  const PLACE_DIR = {
    EGPH: 'N', EGPF: 'N', EGPD: 'N', EGPE: 'N', EGAA: 'N', EGAC: 'N', EGNS: 'N', EGNT: 'N', EGCC: 'N', EGPK: 'N', EGPB: 'N', BIRK: 'N', BIKF: 'N', BIAR: 'N',
    EIDW: 'W', EINN: 'W', EICK: 'W', EIKN: 'W', EGFF: 'W', EGHQ: 'W', KJFK: 'W', KMCO: 'W', MMUN: 'W', KBOS: 'W', CYYZ: 'W', MDPC: 'W', TBPB: 'W', MKJS: 'W', TAPA: 'W',
    EKCH: 'NE', ESSA: 'NE', ENGM: 'NE', EKBI: 'NE', EFHK: 'NE', EETN: 'NE', EVRA: 'NE', EYVI: 'NE', EHAM: 'NE', ENBR: 'NE', EPGD: 'NE',
    EDDF: 'E', EDDL: 'E', EDDM: 'E', EDDS: 'E', EDDH: 'E', EDDB: 'E', EDDK: 'E', LKPR: 'E', EPKK: 'E', EPWA: 'E', LHBP: 'E', LOWW: 'E', LOWS: 'E', LOWI: 'E', LZIB: 'E',
    LSZH: 'SE', LSGG: 'SE', LIMC: 'SE', LIML: 'SE', LIPZ: 'SE', LIRF: 'SE', LIRN: 'SE', LIRP: 'SE', LIRQ: 'SE', LIPX: 'SE', LIBD: 'SE', LICC: 'SE', LIEO: 'SE', LIEE: 'SE',
    LDDU: 'SE', LDSP: 'SE', LDZD: 'SE', LDPL: 'SE', LATI: 'SE', LGAV: 'SE', LGTS: 'SE', LGKR: 'SE', LGIR: 'SE', LGSA: 'SE', LGRP: 'SE', LGKO: 'SE', LGZA: 'SE', LGKF: 'SE',
    LGPZ: 'SE', LGKL: 'SE', LGSR: 'SE', LGMK: 'SE', LGSK: 'SE', LTFM: 'SE', LTFJ: 'SE', LTAI: 'SE', LTBS: 'SE', LTFE: 'SE', LTBJ: 'SE', LCPH: 'SE', LCLK: 'SE', LMML: 'SE',
    LLBG: 'SE', HEGN: 'SE', HESH: 'SE', OMDB: 'SE', OTHH: 'SE', ZSPD: 'SE', WSSS: 'SE', DNAA: 'SE', HUEN: 'SE', DTNH: 'SE', DAAG: 'SE', DGAA: 'SE', LBBG: 'SE', LBWN: 'SE',
    LFPG: 'S', LFPO: 'S', LFMN: 'S', LFLL: 'S', LFMT: 'S', LFBD: 'S', LFKJ: 'S', LEBL: 'S', LEPA: 'S', LEMH: 'S', LEIB: 'S', LEVC: 'S', LEAL: 'S', LEAM: 'S',
    LEMD: 'SW', LEMG: 'SW', LEZL: 'SW', LEBB: 'SW', LPPT: 'SW', LPFR: 'SW', LPPR: 'SW', LPMA: 'SW', LXGB: 'SW', GCRR: 'SW', GCTS: 'SW', GCFV: 'SW', GCLP: 'SW', GMMX: 'SW', GMAD: 'SW', GMMN: 'SW',
    EGLL: 'N', EGJJ: 'CI', EGJB: 'CI', EGJA: 'CI', EGHH: 'CI', EGTE: 'CI'
  };
  const dirFor = icao => DIR[PLACE_DIR[icao] || 'S'];

  // ── units and frequencies (AD 2-EGKK 2-1 and the approach charts). London Control sectors are representative.
  const UNITS = {
    atis: { name: 'Gatwick Information', freq: '136.525' }, del: { name: 'Gatwick Delivery', freq: '121.955' },
    gnd: { name: 'Gatwick Ground', freq: '121.805' }, twr: { name: 'Gatwick Tower', freq: '124.230', alt: ['134.230'] },
    app: { name: 'Gatwick Director', freq: '126.825', alt: ['118.950', '129.025'] }, fire: { name: 'Gatwick Fire', freq: '121.605' }
  };
  const CTR = { n: ['London Control', '134.125'], w: ['London Control', '124.225'], e: ['London Control', '118.825'], s: ['London Control', '120.025'] };
  const TA = 6000, TZ = 'Europe/London';
  // where cruising flights over the London area divert to with a sick passenger (medical diversions in emerg.js)
  const ALTERNATES = [['Stansted', 'EGSS', 'LAM'], ['Bournemouth', 'EGHH', 'GWC'], ['Southampton', 'EGHI', 'GWC']];

  // ── traffic. A representative autumn week, thinned to about 20 movements an hour at the busiest (the real airport
  // runs up to 55 on its one runway); the busy session ("rush hour") adds the EXTRA flights. Operators and routes are the
  // real ones from Gatwick's boards; flight numbers and times are representative, not a published timetable.
  // [operator, flight number, airport, type, arrival times (local), minutes on the ground, days]; the departure is the
  // next number. A first-wave departure night-stopped at Gatwick; the last arrivals stay overnight.
  const L = (o, n, ap, t, times, turn, days = '1234567') => ({ o, n, ap, t, times, turn, days });
  const ROUTES = [
    // easyJet, Gatwick's largest airline
    L('EZY', 8201, 'LEMG', 'A20N', ['08:55', '15:45'], 50), L('EZY', 8121, 'GCRR', 'A21N', ['11:20', '17:35'], 55), L('EZY', 8041, 'GCFV', 'A320', ['13:05'], 50),
    L('EZY', 8031, 'GCTS', 'A21N', ['09:40', '16:55'], 55), L('EZY', 8521, 'LPMA', 'A320', ['12:15'], 50), L('EZY', 8701, 'GMMX', 'A20N', ['10:30', '18:20'], 50),
    L('EZY', 8241, 'LGSA', 'A320', ['14:05'], 45), L('EZY', 8181, 'LGAV', 'A21N', ['13:30'], 55), L('EZY', 8661, 'LCLK', 'A320', ['15:10'], 50),
    L('EZY', 8551, 'LTBS', 'A20N', ['16:15'], 50), L('EZY', 8561, 'LTBJ', 'A320', ['12:40'], 50), L('EZY', 8781, 'LKPR', 'A319', ['09:15', '17:20'], 40),
    L('EZY', 8681, 'EHAM', 'A319', ['08:20', '13:50', '19:40'], 40), L('EZY', 8471, 'LSZH', 'A320', ['10:05', '18:45'], 40), L('EZY', 8491, 'LSGG', 'A320', ['07:50', '16:30'], 40),
    L('EZY', 8321, 'LIRF', 'A320', ['11:45', '20:10'], 45), L('EZY', 8291, 'LIMC', 'A319', ['09:55', '17:50'], 40), L('EZY', 8341, 'LIRN', 'A320', ['14:40'], 45),
    L('EZY', 8421, 'LFMN', 'A319', ['08:40', '15:20', '21:05'], 40), L('EZY', 8601, 'LDDU', 'A320', ['13:15'], 45), L('EZY', 8761, 'LMML', 'A320', ['12:55'], 50),
    L('EZY', 811, 'EGPH', 'A319', ['07:35', '12:25', '18:05'], 35), L('EZY', 861, 'EGPF', 'A319', ['08:25', '14:50', '20:35'], 35), L('EZY', 801, 'EGAA', 'A319', ['09:05', '16:05'], 35),
    L('EZY', 845, 'EGNS', 'A319', ['11:05'], 35), L('EZY', 875, 'EGJJ', 'A319', ['10:45', '17:10'], 35), L('EZY', 857, 'EGPD', 'A319', ['13:40'], 35),
    L('EZY', 8111, 'LEAL', 'A20N', ['10:15', '19:05'], 45), L('EZY', 8081, 'LEPA', 'A320', ['11:55', '18:35'], 45), L('EZY', 8531, 'LPFR', 'A320', ['08:10', '14:25', '20:50'], 45),
    L('EJU', 8301, 'LIML', 'A320', ['09:30', '16:40'], 40), L('EJU', 8341, 'LIRN', 'A320', ['15:30'], 45), L('EZS', 8491, 'LSGG', 'A320', ['12:05', '19:15'], 40),
    // British Airways (BA Euroflyer short-haul, 777s long-haul)
    L('BAW', 2641, 'LEMG', 'A320', ['09:20', '16:20'], 50), L('BAW', 2661, 'LPFR', 'A320', ['10:50', '17:45'], 50), L('BAW', 2681, 'LEIB', 'A20N', ['13:20'], 50),
    L('BAW', 2589, 'LIPX', 'A320', ['11:30'], 45), L('BAW', 2721, 'LDDU', 'A320', ['14:15'], 45), L('BAW', 2811, 'GMMX', 'A21N', ['12:35'], 50),
    L('BAW', 2705, 'GCRR', 'A21N', ['15:05'], 55), L('BAW', 2667, 'LPPR', 'A320', ['10:25', '18:55'], 45), L('BAW', 2615, 'LMML', 'A320', ['16:50'], 50),
    L('BAW', 2524, 'EGJJ', 'A320', ['08:05', '18:10'], 35), L('BAW', 2039, 'KMCO', 'B772', ['09:10'], 150), L('BAW', 2203, 'MMUN', 'B772', ['10:40'], 140),
    L('BAW', 2067, 'DGAA', 'B772', ['07:25'], 160), L('BAW', 2159, 'TBPB', 'B772', ['14:55'], 150, '1357'),
    // TUI, Jet2, Ryanair, Wizz Air, Norwegian, Vueling
    L('TOM', 4248, 'LGRP', 'B38M', ['08:45', '14:35'], 55), L('TOM', 4275, 'LEPA', 'B738', ['13:40'], 50), L('TOM', 436, 'HEGN', 'B789', ['12:20'], 90),
    L('TOM', 506, 'LTAI', 'B38M', ['14:10'], 60), L('TOM', 626, 'LTBS', 'B738', ['16:35'], 55), L('TOM', 4215, 'LGSA', 'B38M', ['11:15'], 55),
    L('EXS', 3103, 'GCRR', 'B738', ['10:35'], 55), L('EXS', 3179, 'GCTS', 'A21N', ['12:10'], 60), L('EXS', 3173, 'LGRP', 'B738', ['15:25'], 55),
    L('RYR', 117, 'EIDW', 'B38M', ['07:15', '12:00', '16:25', '20:25'], 30), L('RYR', 1183, 'EINN', 'B738', ['13:35'], 30),
    L('WUK', 5729, 'LTFJ', 'A21N', ['12:30'], 60), L('WUK', 5803, 'LLBG', 'A21N', ['13:00'], 65), L('WUK', 5709, 'LTBS', 'A21N', ['15:55'], 55), L('WUK', 5731, 'LPFR', 'A21N', ['13:25'], 50),
    L('NSZ', 4456, 'ESSA', 'B38M', ['12:15'], 45), L('NSZ', 3524, 'EKCH', 'B38M', ['09:50', '15:20'], 40), L('NSZ', 3535, 'EKBI', 'B738', ['14:35'], 40), L('NAX', 1306, 'ENGM', 'B38M', ['13:25'], 40),
    L('VLG', 7826, 'LEBL', 'A320', ['08:35', '12:40', '17:55'], 50), L('VLG', 6206, 'LIRQ', 'A320', ['13:55'], 40), L('VLG', 8946, 'LEVC', 'A320', ['15:00'], 45),
    // other European and long-haul operators
    L('AUR', 606, 'EGJB', 'E195', ['07:45', '11:40', '14:45', '19:50'], 40), L('TAP', 1336, 'LPPT', 'A20N', ['09:35', '14:35'], 50), L('PGT', 1185, 'LTFJ', 'A21N', ['13:15'], 65),
    L('THY', 1997, 'LTFM', 'A21N', ['15:40'], 55), L('ICE', 472, 'BIKF', 'B38M', ['13:40'], 60), L('BTI', 871, 'EVRA', 'BCS3', ['16:00'], 40, '1357'),
    L('RAM', 802, 'GMMN', 'B738', ['14:50'], 60), L('AFR', 1706, 'LFPG', 'BCS3', ['10:00', '15:00'], 45), L('AEA', 1015, 'LEMD', 'B38M', ['15:25'], 60),
    L('CFG', 4245, 'EDDF', 'A20N', ['13:40'], 55), L('EWG', 2468, 'EDDS', 'A20N', ['16:45'], 45), L('BTI', 671, 'EVRA', 'BCS3', ['09:20'], 40, '246'),
    L('UAE', 15, 'OMDB', 'A388', ['13:00'], 155), L('UAE', 11, 'OMDB', 'B77W', ['07:40'], 150), L('QTR', 27, 'OTHH', 'B789', ['12:45'], 140),
    L('CES', 213, 'ZSPD', 'A359', ['14:00'], 150, '1357'), L('SIA', 313, 'WSSS', 'A359', ['07:55'], 140), L('WJA', 22, 'CYYZ', 'B789', ['11:10'], 120, '2467'),
    L('NBT', 701, 'KJFK', 'B789', ['10:05'], 130), L('UGD', 110, 'HUEN', 'A339', ['16:10'], 150, '246'), L('APK', 7574, 'DNAA', 'B772', ['16:10'], 150, '1357')
  ];
  // the first wave (night-stoppers, local off-blocks) and the last arrivals, which stay overnight
  const FIRST = [['EZY', 8199, 'LEMG', 'A20N', '06:00'], ['EZY', 8679, 'EHAM', 'A319', '06:05'], ['BAW', 2639, 'LEMG', 'A320', '06:10'], ['EZY', 809, 'EGPH', 'A319', '06:15'],
    ['TOM', 4246, 'LGRP', 'B38M', '06:20'], ['EZY', 8419, 'LFMN', 'A319', '06:25'], ['VLG', 7824, 'LEBL', 'A320', '06:30'], ['EZY', 8529, 'LPFR', 'A320', '06:35'],
    ['RYR', 115, 'EIDW', 'B38M', '06:40'], ['EZY', 859, 'EGPF', 'A319', '06:45'], ['BAW', 2659, 'LPFR', 'A320', '06:50'], ['EXS', 3101, 'GCRR', 'B738', '06:55'],
    ['EZY', 8489, 'LSGG', 'A320', '07:00'], ['AUR', 604, 'EGJB', 'E195', '07:05'], ['EZY', 8779, 'LKPR', 'A319', '07:10']];
  const LAST = [['EZY', 8209, 'LEMG', 'A20N', '22:10'], ['EZY', 819, 'EGPH', 'A319', '22:20'], ['BAW', 2649, 'LEMG', 'A320', '22:30'], ['EZY', 8539, 'LPFR', 'A320', '22:40'],
    ['TOM', 4250, 'LGRP', 'B38M', '22:50'], ['EZY', 8689, 'EHAM', 'A319', '23:00']];
  // local times to the engine's UTC "HH:MM" (BST, UTC+1)
  const utc = t => { const m = +t.slice(0, 2)*60 + +t.slice(3) - 60; return String(Math.floor(m/60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  const plus = (t, min) => { const m = +t.slice(0, 2)*60 + +t.slice(3) + min; return String(Math.floor(m/60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  const TIMETABLE = [];
  for (const r of ROUTES) r.times.forEach((t, k) => {
    const a = r.o + (r.n + 2*k), d = r.o + (r.n + 2*k + 1);
    TIMETABLE.push([a, r.ap, utc(t), r.turn ? d : null, r.turn ? r.ap : null, r.turn ? utc(plus(t, r.turn)) : null, r.t, r.days, null]);
  });
  for (const [o, n, ap, t, at] of FIRST) TIMETABLE.push([null, null, null, o + n, ap, utc(at), t, '1234567', null]);
  for (const [o, n, ap, t, at] of LAST) TIMETABLE.push([o + n, ap, utc(at), null, null, null, t, '1234567', null]);
  // business aviation on the west apron (stands 230-235)
  TIMETABLE.push(['GLGWX', 'LFMN', '09:10', 'GLGWX', 'LFMN', '13:30', 'C56X', '135', '231'], ['NJE712', 'LSGG', '11:40', 'NJE713', 'LSGG', '16:20', 'C56X', '246', '232']);
  const LONG_STAY = [['GKKPC', 'PC12', '234', '1234567']];
  const EXTRA = [
    { cs: 'EZY8253', t: 'A20N', k: 'ARR', o: 'LEAL' }, { cs: 'EZY8338', t: 'A320', k: 'DEP', d: 'LIRF' }, { cs: 'BAW2701', t: 'A320', k: 'ARR', o: 'LEMD' },
    { cs: 'RYR123', t: 'B38M', k: 'DEP', d: 'EIDW' }, { cs: 'TOM4263', t: 'B38M', k: 'ARR', o: 'LGKO' }, { cs: 'EZY8706', t: 'A20N', k: 'DEP', d: 'GMMX' },
    { cs: 'WUK5737', t: 'A21N', k: 'ARR', o: 'LPFR' }, { cs: 'EZY828', t: 'A319', k: 'DEP', d: 'EGAA' }, { cs: 'VLG7829', t: 'A320', k: 'ARR', o: 'LEBL' },
    { cs: 'EZY8285', t: 'A320', k: 'DEP', d: 'LIRN' }, { cs: 'NSZ3527', t: 'B38M', k: 'ARR', o: 'EKCH' }, { cs: 'BAW2683', t: 'A20N', k: 'DEP', d: 'LEIB' },
    { cs: 'EZY8653', t: 'A320', k: 'ARR', o: 'LCPH' }, { cs: 'EXS3176', t: 'A21N', k: 'DEP', d: 'GCTS' }, { cs: 'EZY8045', t: 'A21N', k: 'ARR', o: 'GCFV' },
    { cs: 'EZY8826', t: 'A319', k: 'DEP', d: 'EPKK' }, { cs: 'TAP1338', t: 'A20N', k: 'ARR', o: 'LPPT' }, { cs: 'EZY8474', t: 'A320', k: 'DEP', d: 'LSZH' }
  ];
  const EXERCISES = {
    dep: { name: 'Gatwick 1 · Off 26L from the North Terminal', wx: 'west', rwy: '26L', sched: [{ cs: 'EZY8203', t: 'A20N', k: 'DEP', d: 'LEMG', m: 0, stand: '553' }] },
    arr: { name: 'Gatwick 2 · From TIMBA to the ILS 26L', wx: 'west', rwy: '26L', sched: [{ cs: 'BAW2616', t: 'A320', k: 'ARR', o: 'LMML', m: 0 }] },
    mix: { name: 'Gatwick 3 · Mixed mode on one runway', wx: 'west', rwy: '26L', sched: [{ cs: 'TOM4249', t: 'B38M', k: 'ARR', o: 'LGRP', m: 0 },
      { cs: 'EZY8492', t: 'A320', k: 'DEP', d: 'LSGG', m: 0, stand: '31' }, { cs: 'BAW2662', t: 'A320', k: 'DEP', d: 'LPFR', m: 0, stand: '555' }] }
  };
  const WX_PRESETS = {
    west:  { name: 'South-westerly, runway 26L',                       short: 'Westerly',  metar: 'EGKK 061250Z 23011KT 9999 FEW028 SCT045 18/11 Q1016' },
    east:  { name: 'Easterly: runway 08R, arrivals over Crawley',        short: 'Easterly',  metar: 'EGKK 061250Z 07012KT 9999 SCT033 15/06 Q1027' },
    low:   { name: 'Low cloud and drizzle, ILS 26L near the minima',     short: 'Low cloud', metar: 'EGKK 061250Z 22009KT 2500 -DZ BR OVC003 13/12 Q1008' },
    fog:   { name: 'Weald fog: below the ILS minima',                    short: 'Fog',       metar: 'EGKK 060550Z 18002KT 0350 R26L/0400N FG VV001 09/09 Q1020' },
    storm: { name: 'Atlantic storm: gusty crosswind on 26L',             short: 'Storm',     metar: 'EGKK 061250Z 20026G40KT 9999 -RA BKN012 15/12 Q0991' },
    calm:  { name: 'High pressure, light and variable, haze',            short: 'Calm',      metar: 'EGKK 061250Z VRB02KT 7000 HZ NSC 21/13 Q1030' }
  };

  // airline radio telephony and codes at Gatwick (merged into the engine's tables)
  const TEL = { EZY: 'Easy', EJU: 'Alpine', EZS: 'Topswiss', BAW: 'Speedbird', TOM: 'Tomjet', EXS: 'Channex', RYR: 'Ryanair', WUK: 'Wizz Go', NSZ: 'Rednose',
    NAX: 'Nor Shuttle', VLG: 'Vueling', AUR: 'Ayline', TAP: 'Air Portugal', PGT: 'Sunturk', THY: 'Turkish', ICE: 'Iceair', BTI: 'Air Baltic', RAM: 'Royalair Maroc',
    AFR: 'Airfrans', AEA: 'Europa', CFG: 'Condor', EWG: 'Eurowings', UAE: 'Emirates', QTR: 'Qatari', CES: 'China Eastern', SIA: 'Singapore', WJA: 'Westjet',
    NBT: 'Norse UK', UGD: 'Crane', APK: 'Peace Bird', ENT: 'Enter', TVS: 'Skytravel', SEH: 'Air Crete', NJE: 'Fraction', DLH: 'Lufthansa', KLM: 'KLM' };
  // BA Euroflyer (A0) flies as British Airways; easyJet's European (EC) and Swiss (DS) airlines keep their own callsigns
  const AIRLINE_ICAO = { U2: 'EZY', EC: 'EJU', DS: 'EZS', BA: 'BAW', A0: 'BAW', BY: 'TOM', LS: 'EXS', FR: 'RYR', W9: 'WUK', D8: 'NSZ', DY: 'NAX', VY: 'VLG',
    GR: 'AUR', TP: 'TAP', PC: 'PGT', TK: 'THY', FI: 'ICE', BT: 'BTI', AT: 'RAM', AF: 'AFR', UX: 'AEA', DE: 'CFG', EW: 'EWG', EK: 'UAE', QR: 'QTR', MU: 'CES',
    SQ: 'SIA', WS: 'WJA', Z0: 'NBT', UR: 'UGD', P4: 'APK', E4: 'ENT', QS: 'TVS', GQ: 'SEH' };
  const AIRLINE_TYPE = { EZY: 'A320', EJU: 'A320', EZS: 'A320', BAW: 'A320', TOM: 'B38M', EXS: 'B738', RYR: 'B38M', WUK: 'A21N', NSZ: 'B38M', NAX: 'B38M',
    VLG: 'A320', AUR: 'E195', TAP: 'A20N', PGT: 'A21N', THY: 'A21N', ICE: 'B38M', BTI: 'BCS3', RAM: 'B738', AFR: 'BCS3', AEA: 'B38M', CFG: 'A20N', EWG: 'A20N',
    UAE: 'A388', QTR: 'B789', CES: 'A359', SIA: 'A359', WJA: 'B789', NBT: 'B789', UGD: 'A339', APK: 'B772', ENT: 'B738', TVS: 'B738', SEH: 'A20N' };
  // the terminal each airline uses (easyJet runs from both; others approximate the 2026 allocation)
  const TERMINAL_OF = { EZY: 'N', BAW: 'N', UAE: 'N', QTR: 'N', TOM: 'N', THY: 'N', CES: 'N', SIA: 'N', EJU: 'N', EZS: 'N',
    RYR: 'S', WUK: 'S', NSZ: 'S', NAX: 'S', VLG: 'S', EXS: 'S', AUR: 'S', TAP: 'S', PGT: 'S', ICE: 'S', BTI: 'S', RAM: 'S', AFR: 'S', AEA: 'S', CFG: 'S',
    EWG: 'S', WJA: 'S', NBT: 'S', UGD: 'S', APK: 'S', ENT: 'S', TVS: 'S', SEH: 'S' };
  const TYPES = {
    A321: { name: 'A321',          wake: 'M', vapp: 140, vr: 150, climb: 2200, desc: 2000, cruise: 290, span: 34.1, len: 44.5, shape: 'jet' },
    B38M: { name: '737 MAX 8',     wake: 'M', vapp: 145, vr: 150, climb: 2400, desc: 2100, cruise: 290, span: 35.9, len: 39.5, shape: 'jet' },
    BCS3: { name: 'A220-300',      wake: 'M', vapp: 128, vr: 135, climb: 2600, desc: 2000, cruise: 290, span: 35.1, len: 38.7, shape: 'jet' },
    E195: { name: 'Embraer 195',   wake: 'M', vapp: 130, vr: 138, climb: 2400, desc: 2000, cruise: 280, span: 28.7, len: 38.7, shape: 'jet' },
    A339: { name: 'A330-900neo',   wake: 'H', vapp: 138, vr: 150, climb: 2000, desc: 2000, cruise: 300, span: 64.0, len: 63.7, shape: 'jet' },
    A359: { name: 'A350-900',      wake: 'H', vapp: 140, vr: 150, climb: 2100, desc: 2000, cruise: 300, span: 64.8, len: 66.8, shape: 'jet' },
    A388: { name: 'A380',          wake: 'H', vapp: 140, vr: 155, climb: 1600, desc: 1800, cruise: 300, span: 79.8, len: 72.7, shape: 'jet' },
    B772: { name: '777-200',       wake: 'H', vapp: 140, vr: 155, climb: 1900, desc: 2000, cruise: 300, span: 60.9, len: 63.7, shape: 'jet' },
    B77W: { name: '777-300ER',     wake: 'H', vapp: 149, vr: 160, climb: 1800, desc: 2000, cruise: 300, span: 64.8, len: 73.9, shape: 'jet' },
    B789: { name: '787-9',         wake: 'H', vapp: 145, vr: 155, climb: 2100, desc: 2000, cruise: 300, span: 60.1, len: 62.8, shape: 'jet' }
  };
  // Gatwick's flight boards give places by city name
  const PLACES = {
    'edinburgh': 'EGPH', 'glasgow': 'EGPF', 'aberdeen': 'EGPD', 'inverness': 'EGPE', 'belfast': 'EGAA', 'belfast city': 'EGAC', 'isle of man': 'EGNS', 'newcastle': 'EGNT',
    'manchester': 'EGCC', 'newquay': 'EGHQ', 'jersey': 'EGJJ', 'guernsey': 'EGJB', 'alderney': 'EGJA', 'dublin': 'EIDW', 'shannon': 'EINN', 'cork': 'EICK', 'knock': 'EIKN',
    'london': 'EGLL', 'reykjavik': 'BIKF', 'akureyri': 'BIAR', 'oslo': 'ENGM', 'bergen': 'ENBR', 'stockholm': 'ESSA', 'copenhagen': 'EKCH', 'billund': 'EKBI', 'helsinki': 'EFHK',
    'tallinn': 'EETN', 'riga': 'EVRA', 'vilnius': 'EYVI', 'gdansk': 'EPGD', 'krakow': 'EPKK', 'krakow/balice': 'EPKK', 'warsaw': 'EPWA', 'amsterdam': 'EHAM',
    'frankfurt': 'EDDF', 'duesseldorf': 'EDDL', 'dusseldorf': 'EDDL', 'munich': 'EDDM', 'stuttgart': 'EDDS', 'hamburg': 'EDDH', 'berlin': 'EDDB', 'cologne': 'EDDK',
    'prague': 'LKPR', 'budapest': 'LHBP', 'vienna': 'LOWW', 'salzburg': 'LOWS', 'innsbruck': 'LOWI', 'bratislava': 'LZIB', 'zurich': 'LSZH', 'geneva': 'LSGG',
    'milan': 'LIMC', 'milan linate': 'LIML', 'venice': 'LIPZ', 'verona': 'LIPX', 'rome': 'LIRF', 'naples': 'LIRN', 'pisa': 'LIRP', 'florence': 'LIRQ', 'bari': 'LIBD',
    'catania': 'LICC', 'olbia': 'LIEO', 'cagliari': 'LIEE', 'dubrovnik': 'LDDU', 'split': 'LDSP', 'zadar': 'LDZD', 'pula': 'LDPL', 'tirana': 'LATI', 'athens': 'LGAV',
    'thessaloniki': 'LGTS', 'kerkyra': 'LGKR', 'corfu': 'LGKR', 'heraklion': 'LGIR', 'chania': 'LGSA', 'rhodes': 'LGRP', 'kos': 'LGKO', 'zakynthos island': 'LGZA',
    'zakynthos': 'LGZA', 'kefallinia': 'LGKF', 'preveza/lefkada': 'LGPZ', 'kalamata': 'LGKL', 'thira': 'LGSR', 'santorini': 'LGSR', 'mykonos': 'LGMK', 'skiathos': 'LGSK',
    'istanbul': 'LTFM', 'antalya': 'LTAI', 'dalaman': 'LTBS', 'izmir': 'LTBJ', 'bodrum': 'LTFE', 'paphos': 'LCPH', 'larnaca': 'LCLK', 'malta': 'LMML', 'tel aviv-yafo': 'LLBG',
    'tel aviv': 'LLBG', 'hurghada': 'HEGN', 'sharm el-sheikh': 'HESH', 'dubai': 'OMDB', 'doha': 'OTHH', 'shanghai': 'ZSPD', 'singapore': 'WSSS', 'abuja': 'DNAA',
    'entebbe': 'HUEN', 'accra': 'DGAA', 'enfidha': 'DTNH', 'algiers': 'DAAG', 'burgas': 'LBBG', 'varna': 'LBWN', 'paris': 'LFPG', 'nice': 'LFMN', 'lyon': 'LFLL',
    'montpellier': 'LFMT', 'bordeaux': 'LFBD', 'ajaccio': 'LFKJ', 'barcelona': 'LEBL', 'palma de mallorca': 'LEPA', 'palma': 'LEPA', 'menorca': 'LEMH', 'ibiza': 'LEIB',
    'valencia': 'LEVC', 'alicante': 'LEAL', 'almeria': 'LEAM', 'madrid': 'LEMD', 'malaga': 'LEMG', 'sevilla': 'LEZL', 'seville': 'LEZL', 'bilbao': 'LEBB', 'lisbon': 'LPPT',
    'faro': 'LPFR', 'porto': 'LPPR', 'funchal': 'LPMA', 'gibraltar': 'LXGB', 'lanzarote': 'GCRR', 'tenerife': 'GCTS', 'fuerteventura': 'GCFV', 'gran canaria': 'GCLP',
    'marrakech': 'GMMX', 'agadir': 'GMAD', 'casablanca': 'GMMN', 'new york': 'KJFK', 'orlando': 'KMCO', 'cancun': 'MMUN', 'boston': 'KBOS', 'toronto': 'CYYZ',
    'punta cana': 'MDPC', 'barbados': 'TBPB', 'montego bay': 'MKJS', 'antigua': 'TAPA', 'bournemouth': 'EGHH', 'exeter': 'EGTE'
  };
  const AIRPORTS = {
    EGKK: [51.1481, -0.1903, 'London Gatwick'], EGPH: [55.9500, -3.3725, 'Edinburgh'], EGPF: [55.8719, -4.4331, 'Glasgow'], EGPD: [57.2019, -2.1978, 'Aberdeen'],
    EGPE: [57.5425, -4.0475, 'Inverness'], EGAA: [54.6575, -6.2158, 'Belfast'], EGNS: [54.0833, -4.6239, 'Isle of Man'], EGJJ: [49.2079, -2.1955, 'Jersey'],
    EGJB: [49.4350, -2.6019, 'Guernsey'], EIDW: [53.4213, -6.2701, 'Dublin'], EINN: [52.7020, -8.9248, 'Shannon'], BIKF: [63.9850, -22.6056, 'Keflavík'],
    BIAR: [65.6600, -18.0727, 'Akureyri'], ENGM: [60.1939, 11.1004, 'Oslo'], ESSA: [59.6519, 17.9186, 'Stockholm'], EKCH: [55.6181, 12.6561, 'Copenhagen'],
    EKBI: [55.7403, 9.1518, 'Billund'], EETN: [59.4133, 24.8328, 'Tallinn'], EVRA: [56.9236, 23.9711, 'Riga'], EPKK: [50.0777, 19.7848, 'Kraków'],
    EHAM: [52.3086, 4.7639, 'Amsterdam'], EDDF: [50.0333, 8.5706, 'Frankfurt'], EDDL: [51.2895, 6.7668, 'Düsseldorf'], EDDS: [48.6899, 9.2220, 'Stuttgart'],
    LKPR: [50.1008, 14.2600, 'Prague'], LOWI: [47.2602, 11.3440, 'Innsbruck'], LSZH: [47.4647, 8.5492, 'Zurich'], LSGG: [46.2381, 6.1090, 'Geneva'],
    LIMC: [45.6306, 8.7281, 'Milan Malpensa'], LIML: [45.4451, 9.2767, 'Milan Linate'], LIPZ: [45.5053, 12.3519, 'Venice'], LIPX: [45.3957, 10.8885, 'Verona'],
    LIRF: [41.8003, 12.2389, 'Rome'], LIRN: [40.8860, 14.2908, 'Naples'], LIRP: [43.6839, 10.3927, 'Pisa'], LIRQ: [43.8100, 11.2051, 'Florence'],
    LIBD: [41.1389, 16.7606, 'Bari'], LICC: [37.4668, 15.0664, 'Catania'], LIEO: [40.8987, 9.5176, 'Olbia'], LDDU: [42.5614, 18.2682, 'Dubrovnik'],
    LDSP: [43.5389, 16.2980, 'Split'], LDZD: [44.1083, 15.3467, 'Zadar'], LATI: [41.4147, 19.7206, 'Tirana'], LGAV: [37.9364, 23.9445, 'Athens'],
    LGTS: [40.5197, 22.9709, 'Thessaloniki'], LGKR: [39.6019, 19.9117, 'Corfu'], LGIR: [35.3397, 25.1803, 'Heraklion'], LGSA: [35.5317, 24.1497, 'Chania'],
    LGRP: [36.4054, 28.0862, 'Rhodes'], LGKO: [36.7933, 27.0917, 'Kos'], LGZA: [37.7509, 20.8843, 'Zakynthos'], LGKF: [38.1201, 20.5005, 'Kefalonia'],
    LGPZ: [38.9255, 20.7653, 'Preveza'], LGKL: [37.0683, 22.0255, 'Kalamata'], LGSR: [36.3992, 25.4793, 'Santorini'], LGMK: [37.4351, 25.3481, 'Mykonos'],
    LGSK: [39.1771, 23.5037, 'Skiathos'], LTFM: [41.2753, 28.7519, 'Istanbul'], LTFJ: [40.8986, 29.3092, 'Istanbul Sabiha Gökçen'], LTAI: [36.8987, 30.8005, 'Antalya'],
    LTBS: [36.7131, 28.7925, 'Dalaman'], LTBJ: [38.2924, 27.1570, 'Izmir'], LTFE: [37.2506, 27.6643, 'Bodrum'], LCPH: [34.7180, 32.4857, 'Paphos'],
    LCLK: [34.8751, 33.6249, 'Larnaca'], LMML: [35.8575, 14.4775, 'Malta'], LLBG: [32.0114, 34.8867, 'Tel Aviv'], HEGN: [27.1783, 33.7994, 'Hurghada'],
    HESH: [27.9773, 34.3950, 'Sharm el-Sheikh'], OMDB: [25.2532, 55.3657, 'Dubai'], OTHH: [25.2731, 51.6081, 'Doha'], ZSPD: [31.1443, 121.8083, 'Shanghai'],
    WSSS: [1.3644, 103.9915, 'Singapore'], DNAA: [9.0068, 7.2632, 'Abuja'], HUEN: [0.0424, 32.4435, 'Entebbe'], DGAA: [5.6052, -0.1668, 'Accra'],
    DTNH: [36.0758, 10.4386, 'Enfidha'], DAAG: [36.6910, 3.2154, 'Algiers'], LFPG: [49.0097, 2.5479, 'Paris CDG'], LFMN: [43.6584, 7.2159, 'Nice'],
    LFMT: [43.5762, 3.9630, 'Montpellier'], LEBL: [41.2971, 2.0785, 'Barcelona'], LEPA: [39.5517, 2.7388, 'Palma'], LEMH: [39.8626, 4.2186, 'Menorca'],
    LEIB: [38.8729, 1.3731, 'Ibiza'], LEVC: [39.4893, -0.4816, 'Valencia'], LEAL: [38.2822, -0.5582, 'Alicante'], LEAM: [36.8439, -2.3701, 'Almería'],
    LEMD: [40.4983, -3.5676, 'Madrid'], LEMG: [36.6749, -4.4991, 'Málaga'], LEZL: [37.4180, -5.8931, 'Seville'], LEBB: [43.3011, -2.9106, 'Bilbao'],
    LPPT: [38.7742, -9.1342, 'Lisbon'], LPFR: [37.0144, -7.9659, 'Faro'], LPPR: [41.2481, -8.6814, 'Porto'], LPMA: [32.6979, -16.7745, 'Madeira'],
    LXGB: [36.1512, -5.3497, 'Gibraltar'], GCRR: [28.9455, -13.6052, 'Lanzarote'], GCTS: [28.0445, -16.5725, 'Tenerife South'], GCFV: [28.4527, -13.8638, 'Fuerteventura'],
    GCLP: [27.9319, -15.3866, 'Gran Canaria'], GMMX: [31.6069, -8.0363, 'Marrakech'], GMAD: [30.3250, -9.4131, 'Agadir'], GMMN: [33.3675, -7.5900, 'Casablanca'],
    KJFK: [40.6399, -73.7789, 'New York JFK'], KMCO: [28.4312, -81.3081, 'Orlando'], MMUN: [21.0365, -86.8771, 'Cancún'], CYYZ: [43.6777, -79.6248, 'Toronto'],
    TBPB: [13.0746, -59.4925, 'Barbados'], EGSS: [51.8850, 0.2350, 'London Stansted'], EGHH: [50.7800, -1.8425, 'Bournemouth'], EGHI: [50.9503, -1.3568, 'Southampton'],
    EGAC: [54.6181, -5.8725, 'Belfast City'], EGNT: [55.0375, -1.6917, 'Newcastle'], EGCC: [53.3537, -2.2750, 'Manchester'], EGHQ: [50.4406, -4.9954, 'Newquay'],
    EGJA: [49.7061, -2.2147, 'Alderney'], EICK: [51.8413, -8.4911, 'Cork'], EIKN: [53.9103, -8.8185, 'Knock'], ENBR: [60.2934, 5.2181, 'Bergen'],
    EFHK: [60.3172, 24.9633, 'Helsinki'], EYVI: [54.6341, 25.2858, 'Vilnius'], EPGD: [54.3776, 18.4662, 'Gdańsk'], EPWA: [52.1657, 20.9671, 'Warsaw'],
    EDDM: [48.3538, 11.7861, 'Munich'], EDDH: [53.6304, 9.9882, 'Hamburg'], EDDB: [52.3667, 13.5033, 'Berlin'], EDDK: [50.8659, 7.1427, 'Cologne'],
    LHBP: [47.4298, 19.2611, 'Budapest'], LOWW: [48.1103, 16.5697, 'Vienna'], LOWS: [47.7933, 13.0043, 'Salzburg'], LZIB: [48.1702, 17.2127, 'Bratislava'],
    LIEE: [39.2515, 9.0543, 'Cagliari'], LDPL: [44.8935, 13.9222, 'Pula'], LBBG: [42.5696, 27.5152, 'Burgas'], LBWN: [43.2321, 27.8251, 'Varna'],
    LFLL: [45.7256, 5.0811, 'Lyon'], LFBD: [44.8283, -0.7156, 'Bordeaux'], LFKJ: [41.9236, 8.8029, 'Ajaccio'], KBOS: [42.3656, -71.0096, 'Boston'],
    MDPC: [18.5674, -68.3634, 'Punta Cana'], MKJS: [18.5037, -77.9134, 'Montego Bay'], TAPA: [17.1367, -61.7927, 'Antigua'], EGTE: [50.7344, -3.4139, 'Exeter'],
    EGLL: [51.4700, -0.4543, 'London Heathrow'], EGLC: [51.5053, 0.0553, 'London City']
  };

  return {
    icao: 'EGKK', iata: 'LGW', name: 'London Gatwick', city: 'London', country: 'United Kingdom', arp: P('510853N', '0001125W'), elev: 203,
    FIX, NAV, RWY, STARS, HOLDS_AIR, ILS, SIDS, DIR, PLACE_DIR, dirFor, UNITS, CTR, TA, TZ, ALTERNATES,
    TIMETABLE, LONG_STAY, EXTRA, EXERCISES, WX_PRESETS, TEL, AIRLINE_ICAO, AIRLINE_TYPE, TERMINAL_OF, TYPES, PLACES, AIRPORTS,
    data: { metar: 'egkk/metar.txt', flights: 'egkk/flights.json' },
    features: { roadCrossing: false, sra: false, ils: true, rnavSids: true, singleRunway: true, mixedMode: true }
  };
})();
if (typeof module !== 'undefined') module.exports = EGKK;
