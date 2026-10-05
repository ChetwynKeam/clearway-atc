// ═════════════════════════ New York JFK (KJFK) airport profile ═════════════════════════
// Everything the Clearway engine needs to know that is true only of Kennedy. Sources: the FAA CIFP (ARINC 424, cycle
// 2610) for thresholds, fixes, the ILS approaches, STARs and RNAV SIDs; the FAA d-TPP charts (NE-2, 01 OCT 2026):
// airport diagram, KENNEDY FIVE departure, DEEZZ6 and SKORR6, CAMRN5, PARCH4, PAWLN1 and PUCKY1 arrivals, the ILS
// plates and the NE hot spot list. OpenStreetMap for taxiways, gates, aprons and terminals (kjfk-ground.js). Positions
// are lat/lon (WGS84); courses are TRUE (variation 13° W: true = magnetic − 13). Summary: airports/kjfk/README.md.
// Plain data plus a few small functions, like lowi.js; kjfk-engine.js turns it into the engine's globals.

const KJFK = (() => {
  // ── fixes (CIFP terminal and enroute waypoints)
  const FIX = {
    BOTON: [39.41447, -74.45474], HOGGS: [39.58285, -74.27057], PANZE: [39.67599, -74.16818], KARRS: [39.84087, -73.98599], CAMRN: [40.01730, -73.86106],
    PARCH: [41.09923, -72.12074], TRAIT: [41.28465, -71.91760], ROBER: [40.68546, -73.03261], CRAIL: [40.68697, -73.34341],
    PAWLN: [41.76986, -73.60073], DEEDE: [41.64661, -73.54048], LOVES: [41.53879, -73.48809], EEGOR: [41.16082, -73.12435], BELTT: [41.06350, -72.98709],
    PUCKY: [40.90674, -74.12086], VADDR: [40.78339, -73.86861], FUUEL: [41.35714, -74.08778], DOORE: [41.02818, -74.36770], YODAA: [41.72255, -74.03132],
    AROKE: [40.47238, -73.90211], KRSTL: [40.55872, -73.83497], ZETAL: [40.48994, -73.87592], EBBEE: [40.56081, -73.82076],
    TELEX: [40.71180, -73.90968], CAXUN: [40.69477, -73.87199], ROSLY: [40.79721, -73.63574], ZALPO: [40.72329, -73.69377], CORVT: [40.79984, -73.65787],
    MATTR: [40.72662, -73.70973], ZACHS: [40.52880, -73.55386], MEALS: [40.58621, -73.67979], CATOD: [40.54261, -73.53723], MALDE: [40.56488, -73.58601],
    ZULAB: [40.59648, -73.65529], DUFFY: [40.79111, -73.52261], CHANT: [40.31619, -73.75694], MOVFA: [40.23179, -74.06624], DEEZZ: [41.11444, -73.77778],
    HEERO: [41.16886, -74.11558], KURNL: [41.20131, -74.45844], CANDR: [40.97099, -74.95983], SKORR: [40.59639, -73.88940], CESID: [40.54023, -73.85696],
    YNKEE: [40.48358, -73.84922], METSS: [40.56340, -73.93464], RNGRR: [40.23016, -74.20575], GAYEL: [41.40669, -74.35714], COATE: [41.13623, -74.69517],
    NEION: [41.22811, -74.58077], MERIT: [41.38195, -73.13743], GREKI: [41.48001, -73.31416], BETTE: [40.55924, -73.01172], WAVEY: [40.23458, -73.39438],
    SHIPP: [40.32943, -73.24727], WHITE: [40.00676, -74.25128], DIXIE: [40.09937, -74.16449], HAAYS: [41.32001, -74.46718], BAYYS: [41.28924, -72.97131],
    LANNA: [40.55974, -75.02773]
  };
  // VOR/DMEs (CIFP section D)
  const NAV = {
    JFK: { name: 'Kennedy VOR/DME', freq: '115.90', p: [40.632883, -73.771392] },
    CRI: { name: 'Canarsie VOR/DME', freq: '112.30', p: [40.612469, -73.894464] },
    LGA: { name: 'La Guardia VOR/DME', freq: '113.10', p: [40.783714, -73.868600] },
    DPK: { name: 'Deer Park VOR/DME', freq: '117.70', p: [40.791767, -73.303678] },
    CCC: { name: 'Calverton VOR/DME', freq: '114.55', p: [40.929619, -72.798858] }
  };

  // ── runways (CIFP thresholds; lengths from the airport diagram). Two pairs of parallels: 4L/22R and 4R/22L, 13L/31R
  // and 13R/31L. 13R/31L is 14,511 ft long and 200 ft wide, one of the longest commercial runways in North America.
  const RWY = {
    thr: { '4L': [40.623106, -73.784736], '22R': [40.642433, -73.769636], '4R': [40.625428, -73.770344], '22L': [40.645236, -73.754861],
           '13L': [40.656492, -73.787431], '31R': [40.645167, -73.762453], '13R': [40.645494, -73.810386], '31L': [40.632578, -73.781886] },
    lengthFt: { '4L22R': 12079, '4R22L': 8400, '13L31R': 10000, '13R31L': 14511 }, widthFt: { '4L22R': 200, '4R22L': 150, '13L31R': 150, '13R31L': 200 },
    var: -13
  };

  // ── STARs (CIFP, charts). All end "expect radar vectors to final approach course"; expect-altitudes from the charts.
  const STARS = {
    'CAMRN5': { from: 'S',  pts: [['BOTON'], ['HOGGS'], ['PANZE'], ['KARRS'], ['CAMRN', 11000]], expect: 'expect 11,000 and 250 knots' },
    'PARCH4': { from: 'NE', pts: [['TRAIT'], ['PARCH'], ['CCC'], ['ROBER', 12000]], rw22: ['CRAIL'], expect: 'expect 12,000 and 250 knots' },
    'PAWLN1': { from: 'N',  pts: [['PAWLN'], ['DEEDE'], ['LOVES'], ['EEGOR'], ['BELTT'], ['DPK', 12000]], expect: 'expect radar vectors from Deer Park' },
    'PUCKY1': { from: 'W',  pts: [['YODAA'], ['FUUEL'], ['DOORE'], ['PUCKY', 10000], ['VADDR']], expect: 'expect FL190 and 250 knots, then descent' }
  };

  // ── ILS approaches (CIFP): intermediate fix, final approach fix and their altitudes, glideslope 3°, CAT I DA 200 ft,
  // 1/2 SM (RVR 1800). Missed approaches climb to the published altitude and fix.
  const ILS = {
    '4L':  { loc: 'I-HIQ', freq: '110.90', ifx: 'AROKE', faf: 'KRSTL', ifAlt: 2000, fafAlt: 1500, missed: ['DUFFY', 3000] },
    '4R':  { loc: 'I-JFK', freq: '109.50', ifx: 'ZETAL', faf: 'EBBEE', ifAlt: 2000, fafAlt: 1500, missed: ['DPK', 4000] },
    '13L': { loc: 'I-TLK', freq: '111.50', ifx: 'TELEX', faf: 'CAXUN', ifAlt: 2100, fafAlt: 1500, missed: ['DPK', 4000] },
    '22L': { loc: 'I-IWY', freq: '110.90', ifx: 'ROSLY', faf: 'ZALPO', ifAlt: 3000, fafAlt: 1800, missed: ['CHANT', 3000] },
    '22R': { loc: 'I-JOC', freq: '111.70', ifx: 'CORVT', faf: 'MATTR', ifAlt: 3000, fafAlt: 1900, missed: ['CHANT', 4000] },
    '31L': { loc: 'I-MOH', freq: '111.50', ifx: 'ZACHS', faf: 'MEALS', ifAlt: 2000, fafAlt: 1800, missed: ['CHANT', 3000] },
    '31R': { loc: 'I-RTH', freq: '109.50', ifx: 'CATOD', faf: 'ZULAB', ifAlt: 3000, fafAlt: 1900, missed: ['MOVFA', 4000] }
  };
  // 13R has no ILS: the VOR/DME CRI "Canarsie" approach and the Parkway Visual; the sim lands 13L and departs 13R.

  // ── SIDs. KENNEDY FIVE (JFK5, conventional): radar vectors to the filed exit fix after an initial heading by runway,
  // top altitude 5,000 ft, expect filed altitude ten minutes after departure. RNAV: DEEZZ6 (4L, 4R, 31L/R) north-west,
  // SKORR6 (31L/R) south-west. Initial headings from the JFK5 chart (true): 4L/R right turn heading 099 mag (086 true);
  // 22L/R heading 224 mag (211 true); 31L/R the Breezy Point climb, left turn direct CRI then CRI R-223; 13L/R as assigned.
  const SIDS = {
    JFK5:   { spoken: 'Kennedy Five', init: { '4L': 86, '4R': 86, '22L': 211, '22R': 211, '13L': 121, '13R': 121, '31L': 'CRI', '31R': 'CRI' }, top: 5000 },
    DEEZZ6: { spoken: 'Deezz Six', rnav: true, rwys: ['4L', '4R', '31L', '31R'], pts: ['DEEZZ', 'HEERO', 'KURNL'] },
    SKORR6: { spoken: 'Skorr Six', rnav: true, rwys: ['31L', '31R'], pts: ['SKORR', 'METSS', 'RNGRR'] }
  };
  // airway directions. Each has the STAR an arrival flies, where the simulator picks it up, the departure exit fix
  // (vectored on the Kennedy Five unless an RNAV SID fits) and the New York Center sector that takes it.
  const DIR = {
    N:  { star: 'PAWLN1', entry: 'EEGOR', exit: 'GREKI', route: ['GREKI'], ctr: 'n', name: 'New England, upstate and Canada' },
    NE: { star: 'PARCH4', entry: 'CCC', exit: 'MERIT', route: ['MERIT'], ctr: 'n', name: 'Boston' },
    E:  { star: 'PARCH4', entry: 'CCC', exit: 'BETTE', route: ['BETTE'], ctr: 'e', name: 'Europe, the Middle East and Asia over the North Atlantic' },
    S:  { star: 'CAMRN5', entry: 'KARRS', exit: 'WAVEY', route: ['WAVEY'], ctr: 's', name: 'Florida, the Caribbean and South America over the ocean' },
    SW: { star: 'CAMRN5', entry: 'KARRS', exit: 'RNGRR', route: ['RNGRR'], rnav: 'SKORR6', ctr: 's', name: 'Washington, the South-East and Texas' },
    W:  { star: 'PUCKY1', entry: 'FUUEL', exit: 'COATE', route: ['COATE'], rnav: 'DEEZZ6', ctr: 'w', name: 'the Midwest and the West Coast' },
    NW: { star: 'PUCKY1', entry: 'FUUEL', exit: 'GAYEL', route: ['GAYEL'], rnav: 'DEEZZ6', ctr: 'w', name: 'Toronto, Detroit and the North-West' }
  };
  const PLACE_DIR = {
    KBOS: 'NE', KPVD: 'NE', KPWM: 'NE', KBTV: 'N', KALB: 'N', KSYR: 'N', KROC: 'N', KBUF: 'NW', KITH: 'N', KHYA: 'NE', KMVY: 'NE', KACK: 'NE', CYUL: 'N', CYQB: 'N', CYYZ: 'NW', KSLK: 'N',
    EGLL: 'E', EGKK: 'E', EGCC: 'E', EIDW: 'E', LFPG: 'E', EDDF: 'E', EDDM: 'E', EHAM: 'E', LSZH: 'E', LEMD: 'E', LEBL: 'E', LPPT: 'E', LIRF: 'E', LIMC: 'E', LTFM: 'E', LLBG: 'E',
    OMDB: 'E', OMAA: 'E', OTHH: 'E', VABB: 'E', VIDP: 'E', HECA: 'E', LYBE: 'E', EKCH: 'E', ESSA: 'E', ENGM: 'E', EBBR: 'E', LGAV: 'E', LXGB: 'E', LPMA: 'E', EGLC: 'E', LOWI: 'E',
    KMIA: 'S', KFLL: 'S', KMCO: 'S', KTPA: 'S', KPBI: 'S', KRSW: 'S', KJAX: 'S', TJSJ: 'S', MYNN: 'S', MKJS: 'S', MDPC: 'S', MDSD: 'S', TNCA: 'S', MMUN: 'S', MWCR: 'S', MPTO: 'S',
    SKBO: 'S', SCEL: 'S', SBGR: 'S', SAEZ: 'S', TXKF: 'S', TBPB: 'S',
    KDCA: 'SW', KIAD: 'SW', KBWI: 'SW', KPHL: 'SW', KORF: 'SW', KRIC: 'SW', KRDU: 'SW', KCLT: 'SW', KATL: 'SW', KBNA: 'SW', KMSY: 'SW', KDFW: 'SW', KIAH: 'SW', KAUS: 'SW', KCVG: 'SW', KILM: 'SW', MMMX: 'SW',
    KORD: 'W', KMDW: 'W', KMSP: 'W', KDEN: 'W', KLAS: 'W', KPHX: 'W', KLAX: 'W', KSFO: 'W', KSAN: 'W', KSEA: 'W', KPDX: 'W', KSLC: 'W', KMKE: 'W', KSTL: 'W', KTEB: 'W', KMMU: 'W',
    KDTW: 'NW', KPIT: 'NW', KCLE: 'NW',
    RKSI: 'NW', RJTT: 'NW', RJAA: 'NW', VHHH: 'NW', ZSPD: 'NW', ZGGG: 'NW', WSSS: 'E'
  };
  const dirFor = icao => DIR[PLACE_DIR[icao] || 'W'];

  // ── units and frequencies (airport diagram, ILS and SID charts). New York Center sectors are representative.
  const UNITS = {
    atis: { name: 'Kennedy information', freq: '128.725' }, del: { name: 'Kennedy Clearance', freq: '135.050' },
    gnd: { name: 'Kennedy Ground', freq: '121.900' },
    twr: { name: 'Kennedy Tower', freq: { '4R22L': '119.100', '13L31R': '119.100', '4L22R': '123.900', '13R31L': '123.900' } },
    app: { name: 'New York Approach', freq: '128.125' }, dep: { name: 'New York Departure', freq: '135.900' }
  };
  const CTR = { n: ['New York Center', '125.325'], e: ['New York Center', '128.300'], s: ['New York Center', '127.975'], w: ['New York Center', '132.175'] };
  // flights needing an Approval Request (call for release) from New York Center: the short north-east corridor
  const APREQ = ['KBOS', 'KDCA', 'KIAD', 'KBWI', 'KPHL', 'KPVD', 'KPWM', 'KBTV', 'KSYR', 'KROC', 'KBUF', 'KALB', 'KORF', 'KRIC', 'KPIT'];
  // transition altitude 18,000 ft (flight levels above), altimeter in inches of mercury; New York is UTC−4 in summer
  const TA = 18000, TZ = 'America/New_York';

  // ── traffic. A representative autumn week, thinned to about 20 movements an hour at the busiest (the real airport
  // runs 60-70); the busy session ("rush hour") adds the EXTRA flights and closes up the arrivals. Operators, terminals
  // and routes are the real ones; flight numbers and times are representative, not a published timetable.
  // [operator, flight number, airport, type, arrival times (local), minutes on the ground, days]; the departure is the
  // next number. A null arrival list is a first-wave departure that night-stopped; turn 0 means it stays overnight.
  const L = (o, n, ap, t, times, turn, days = '1234567') => ({ o, n, ap, t, times, turn, days });
  const ROUTES = [
    // Delta and Delta Connection (Terminal 4)
    L('DAL', 400, 'KLAX', 'A321', ['07:40', '12:30', '17:15'], 75), L('DAL', 420, 'KSFO', 'A321', ['08:50', '15:20'], 80),
    L('DAL', 1100, 'KATL', 'A321', ['07:10', '10:05', '13:35', '16:50', '20:20'], 55), L('DAL', 1300, 'KMCO', 'B739', ['09:15', '14:40', '19:30'], 55),
    L('DAL', 1500, 'KMIA', 'A321', ['11:20', '18:10'], 60), L('DAL', 900, 'KSEA', 'A321', ['10:30', '16:40'], 70), L('DAL', 1700, 'KLAS', 'B739', ['13:05'], 65),
    L('DAL', 2000, 'KMSP', 'A320', ['09:50', '18:35'], 55), L('DAL', 2200, 'KDTW', 'A320', ['08:05', '14:55'], 50), L('DAL', 1910, 'KSLC', 'A321', ['12:10'], 70),
    L('EDV', 5300, 'KBOS', 'E175', ['07:30', '11:45', '16:10', '19:55'], 45), L('EDV', 5400, 'KDCA', 'CRJ9', ['08:15', '13:20', '17:50'], 45),
    L('EDV', 5500, 'KRDU', 'E175', ['09:40', '15:50'], 45), L('EDV', 5310, 'KITH', 'CRJ9', ['10:55'], 40), L('EDV', 5600, 'KBNA', 'E175', ['12:40'], 45),
    L('DAL', 264, 'LFPG', 'A333', ['13:20'], 270), L('DAL', 30, 'EGLL', 'A333', ['14:05'], 255), L('DAL', 72, 'LIMC', 'A339', ['15:40'], 140),
    L('DAL', 200, 'EDDF', 'A339', ['12:50'], 280, '13567'), L('DAL', 172, 'EKCH', 'A333', ['14:35'], 225, '246'),
    // JetBlue (Terminal 5)
    L('JBU', 600, 'KMCO', 'A320', ['07:30', '10:50', '14:10', '17:40', '21:00'], 50), L('JBU', 700, 'KFLL', 'A320', ['08:20', '12:40', '16:30', '20:15'], 50),
    L('JBU', 100, 'KBOS', 'E190', ['07:00', '09:30', '13:00', '17:15', '21:30'], 40), L('JBU', 1100, 'KLAX', 'A321', ['09:10', '16:00'], 70),
    L('JBU', 2400, 'TJSJ', 'A321', ['13:30', '22:10'], 60), L('JBU', 1800, 'MYNN', 'A320', ['15:10'], 55), L('JBU', 1000, 'KSFO', 'A321', ['10:40'], 75),
    L('JBU', 1500, 'KRSW', 'A320', ['11:35', '18:50'], 50), L('JBU', 1300, 'MMUN', 'A320', ['14:50'], 60), L('JBU', 1200, 'TNCA', 'A320', ['16:20'], 55, '1357'),
    L('JBU', 1600, 'KLAS', 'A321', ['12:20'], 65), L('JBU', 800, 'KDEN', 'A320', ['15:45'], 60), L('JBU', 1900, 'KJAX', 'E190', ['10:15'], 45),
    L('JBU', 7, 'EGLL', 'A21N', ['10:20'], 550), L('JBU', 1, 'LFPG', 'A21N', ['11:10'], 540, '12457'),
    // American and American Eagle (Terminal 8)
    L('AAL', 1, 'KLAX', 'A321', ['08:00', '13:45', '18:30'], 75), L('AAL', 300, 'KMIA', 'A321', ['09:40', '16:20'], 60), L('AAL', 2000, 'KDFW', 'A321', ['10:20', '17:10'], 65),
    L('AAL', 2290, 'KAUS', 'A321', ['11:00'], 60), L('AAL', 180, 'KPHX', 'A321', ['14:25'], 65), L('AAL', 100, 'EGLL', 'B77W', ['09:05'], 550), L('AAL', 66, 'LEMD', 'B789', ['15:30'], 150),
    L('RPA', 4400, 'KCLT', 'E175', ['08:40', '14:05', '19:20'], 45), L('RPA', 4490, 'KORD', 'E175', ['08:20', '12:50', '17:40'], 45), L('RPA', 4600, 'KCVG', 'E175', ['11:15'], 40),
    L('RPA', 4700, 'CYQB', 'E175', ['13:10'], 45, '1357'), L('RPA', 4800, 'KORF', 'E175', ['15:55'], 40),
    // oneworld partners at Terminal 8
    L('BAW', 115, 'EGLL', 'B772', ['10:50', '15:05'], 120), L('BAW', 175, 'EGLL', 'A35K', ['17:20'], 115), L('IBE', 6251, 'LEMD', 'A332', ['14:40'], 135),
    L('QTR', 701, 'OTHH', 'B77W', ['07:15'], 165), L('JAL', 5, 'RJTT', 'B77W', ['11:00'], 150), L('CPA', 840, 'VHHH', 'B77W', ['16:30'], 150),
    L('ASA', 10, 'KSEA', 'A321', ['07:50', '15:30'], 70), L('ASA', 1490, 'KSFO', 'B739', ['12:05'], 60),
    // Terminal 4 partners
    L('VIR', 3, 'EGLL', 'A35K', ['12:15'], 105), L('VIR', 25, 'EGLL', 'B789', ['16:40'], 110), L('KLM', 641, 'EHAM', 'B789', ['14:00'], 130),
    L('UAE', 201, 'OMDB', 'A388', ['08:50'], 190), L('UAE', 203, 'OMDB', 'B77W', ['16:00'], 175), L('ETD', 101, 'OMAA', 'B789', ['10:15'], 150),
    L('SIA', 26, 'EDDF', 'A359', ['11:10'], 160), L('AIC', 119, 'VIDP', 'B77W', ['10:00'], 180), L('ELY', 1, 'LLBG', 'B789', ['06:05'], 200),
    L('AMX', 404, 'MMMX', 'B738', ['07:55', '15:30'], 70), L('CMP', 802, 'MPTO', 'B38M', ['13:10'], 60), L('AVA', 20, 'SKBO', 'A21N', ['07:20'], 80),
    // Terminal 1
    L('AFR', 6, 'LFPG', 'B77W', ['13:05'], 145), L('AFR', 22, 'LFPG', 'A359', ['16:30'], 150), L('DLH', 400, 'EDDF', 'B748', ['13:45'], 140),
    L('DLH', 410, 'EDDM', 'A388', ['15:20'], 150), L('SWR', 14, 'LSZH', 'A333', ['13:15'], 140), L('THY', 3, 'LTFM', 'B77W', ['14:30'], 150),
    L('THY', 11, 'LTFM', 'A359', ['18:05'], 140), L('KAL', 81, 'RKSI', 'A388', ['10:50'], 150), L('ANA', 10, 'RJAA', 'B789', ['10:30'], 140),
    L('CES', 587, 'ZSPD', 'B77W', ['14:45'], 160), L('TAP', 203, 'LPPT', 'A339', ['14:20'], 120), L('EIN', 105, 'EIDW', 'A21N', ['12:20'], 120),
    L('ASL', 500, 'LYBE', 'A332', ['13:50'], 120, '1357'), L('MSR', 985, 'HECA', 'B77W', ['15:00'], 150), L('CFG', 2050, 'EDDF', 'A339', ['12:45'], 120, '246'),
    L('CAY', 792, 'MWCR', 'B38M', ['14:55'], 60), L('UAL', 1916, 'KSFO', 'B763', ['09:00'], 70), L('FFT', 1600, 'KATL', 'A20N', ['13:10'], 50)
  ];
  // the first wave (night-stoppers, local off-blocks) and the last arrivals, which stay overnight
  const FIRST = [['DAL', 1099, 'KATL', 'A321', '06:00'], ['JBU', 599, 'KMCO', 'A320', '06:10'], ['AAL', 2099, 'KDFW', 'A321', '06:15'], ['JBU', 99, 'KBOS', 'E190', '06:20'],
    ['DAL', 399, 'KLAX', 'A321', '06:30'], ['RPA', 4489, 'KORD', 'E175', '06:40'], ['JBU', 1099, 'KLAX', 'A321', '06:45'], ['DAL', 1299, 'KMCO', 'B739', '06:50'],
    ['AAL', 299, 'KMIA', 'A321', '07:00'], ['ASA', 9, 'KSEA', 'A321', '07:05'], ['EDV', 5299, 'KBOS', 'E175', '07:10'], ['JBU', 699, 'KFLL', 'A320', '07:15']];
  const LAST = [['DAL', 1199, 'KATL', 'A321', '22:30'], ['JBU', 1699, 'KMCO', 'A320', '22:40'], ['AAL', 3099, 'KMIA', 'A321', '22:50'], ['JBU', 199, 'KBOS', 'E190', '23:05']];
  // local times to the engine's UTC "HH:MM" (EDT, UTC−4); times after midnight UTC run on past 24:00 so a session
  // late in the New York evening still sees them
  const utc = t => { const m = +t.slice(0, 2)*60 + +t.slice(3) + 4*60; return String(Math.floor(m/60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  const plus = (t, min) => { const m = +t.slice(0, 2)*60 + +t.slice(3) + min; return String(Math.floor(m/60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  const TIMETABLE = [];
  for (const r of ROUTES) r.times.forEach((t, k) => {
    const a = r.o + (r.n + 2*k), d = r.o + (r.n + 2*k + 1);
    TIMETABLE.push([a, r.ap, utc(t), r.turn ? d : null, r.turn ? r.ap : null, r.turn ? utc(plus(t, r.turn)) : null, r.t, r.days, null]);
  });
  for (const [o, n, ap, t, at] of FIRST) TIMETABLE.push([null, null, null, o + n, ap, utc(at), t, '1234567', null]);
  for (const [o, n, ap, t, at] of LAST) TIMETABLE.push([o + n, ap, utc(at), null, null, null, t, '1234567', null]);
  const LONG_STAY = [];
  const EXTRA = [
    { cs: 'DAL1477', t: 'A321', k: 'ARR', o: 'KATL' }, { cs: 'JBU613', t: 'A320', k: 'DEP', d: 'KMCO' }, { cs: 'AAL2117', t: 'A321', k: 'ARR', o: 'KDFW' },
    { cs: 'EDV5383', t: 'E175', k: 'DEP', d: 'KPIT' }, { cs: 'BAW179', t: 'B772', k: 'ARR', o: 'EGLL' }, { cs: 'JBU1227', t: 'A321', k: 'DEP', d: 'KLAX' },
    { cs: 'DAL917', t: 'A321', k: 'ARR', o: 'KSLC' }, { cs: 'RPA4521', t: 'E175', k: 'DEP', d: 'KBNA' }, { cs: 'VIR137', t: 'A339', k: 'ARR', o: 'EGLL' },
    { cs: 'JBU2213', t: 'A320', k: 'DEP', d: 'TJSJ' }, { cs: 'UAE205', t: 'B77W', k: 'ARR', o: 'OMDB' }, { cs: 'DAL1361', t: 'B739', k: 'DEP', d: 'KTPA' },
    { cs: 'AAL1185', t: 'A321', k: 'ARR', o: 'KLAX' }, { cs: 'EJA622', t: 'C56X', k: 'DEP', d: 'KPBI' }, { cs: 'JBU2721', t: 'A320', k: 'ARR', o: 'KPBI' },
    { cs: 'DAL2307', t: 'A320', k: 'DEP', d: 'KMSP' }, { cs: 'KLM643', t: 'B789', k: 'ARR', o: 'EHAM' }, { cs: 'AFR11', t: 'B77W', k: 'DEP', d: 'LFPG' },
    { cs: 'EDV5547', t: 'CRJ9', k: 'ARR', o: 'KRIC' }, { cs: 'JBU1371', t: 'A321', k: 'DEP', d: 'KSFO' }, { cs: 'AAL2633', t: 'A321', k: 'ARR', o: 'KMIA' },
    { cs: 'THY1', t: 'B77W', k: 'DEP', d: 'LTFM' }, { cs: 'DAL455', t: 'A321', k: 'ARR', o: 'KLAX' }, { cs: 'JBU1029', t: 'E190', k: 'DEP', d: 'KBUF' }
  ];
  const EXERCISES = {
    dep: { name: 'New York 1 · Kennedy Five off 22R', wx: 'sw', rwy: '22L', depRwy: '22R', sched: [{ cs: 'DAL1103', t: 'A321', k: 'DEP', d: 'KATL', m: 0, stand: 'B31' }] },
    arr: { name: 'New York 2 · ILS 22L and a runway crossing', wx: 'sw', rwy: '22L', depRwy: '22R', sched: [{ cs: 'JBU702', t: 'A320', k: 'ARR', o: 'KBOS', m: 0 }] },
    cross: { name: 'New York 3 · Crossings and releases', wx: 'sw', rwy: '22L', depRwy: '22R', sched: [{ cs: 'AAL1', t: 'A321', k: 'ARR', o: 'KLAX', m: 0 }, { cs: 'JBU101', t: 'E190', k: 'DEP', d: 'KBOS', m: 0, stand: '5-12' }, { cs: 'DAL401', t: 'A321', k: 'DEP', d: 'KLAX', m: 6, stand: 'B24' }] }
  };
  const WX_PRESETS = {
    sw:    { name: 'Sea breeze from the south-west: land 22L, depart 22R', short: 'South-west',  metar: 'KJFK 051751Z 21012KT 10SM FEW040 SCT250 22/13 A2997' },
    ne:    { name: 'North-easter: land 4R, depart 4L',                      short: 'North-east',  metar: 'KJFK 051751Z 04014KT 10SM BKN035 16/09 A3021' },
    nw:    { name: 'Clear north-westerly: land 31R, depart 31L',            short: 'North-west',  metar: 'KJFK 051751Z 31016G24KT 10SM FEW050 14/02 A3008' },
    se:    { name: 'Low cloud off the ocean: land 13L, depart 13R',         short: 'South-east',  metar: 'KJFK 051751Z 13010KT 6SM BR OVC012 15/13 A3002' },
    ifr:   { name: 'Rain and low ceiling, ILS 4R near the minima',          short: 'IFR',         metar: 'KJFK 051751Z 04010KT 1 1/2SM -RA BR OVC004 13/12 A3011' },
    storm: { name: 'Summer thunderstorms over the field',                   short: 'Storms',      metar: 'KJFK 051951Z 24018G30KT 3SM TSRA BKN030CB OVC060 27/22 A2978' },
    fog:   { name: 'Dense fog: below the ILS minima',                       short: 'Fog',         metar: 'KJFK 051051Z 00000KT 1/4SM FG VV001 12/12 A3015' },
    snow:  { name: 'Snow on a north-easterly gale',                         short: 'Snow',        metar: 'KJFK 051451Z 03018G27KT 1SM -SN BR BKN008 OVC015 M01/M03 A2989' }
  };

  // airline radio telephony and codes seen at Kennedy (merged into the engine's tables)
  const TEL = { DAL: 'Delta', JBU: 'JetBlue', AAL: 'American', UAL: 'United', EDV: 'Endeavor', RPA: 'Brickyard', ASA: 'Alaska', FFT: 'Frontier Flight',
    BAW: 'Speedbird', VIR: 'Virgin', AFR: 'Airfrans', DLH: 'Lufthansa', KLM: 'KLM', IBE: 'Iberia', SWR: 'Swiss', EIN: 'Shamrock', TAP: 'Air Portugal',
    UAE: 'Emirates', QTR: 'Qatari', ETD: 'Etihad', THY: 'Turkish', ELY: 'El Al', KAL: 'Korean Air', JAL: 'Japan Air', ANA: 'All Nippon', CPA: 'Cathay',
    SIA: 'Singapore', CES: 'China Eastern', CSN: 'China Southern', AIC: 'Air India', AMX: 'Aeromexico', CMP: 'Copa', AVA: 'Avianca', ASL: 'Air Serbia',
    MSR: 'Egyptair', CAY: 'Cayman', CFG: 'Condor', EJA: 'Execjet', KAP: 'Cair', AAR: 'Asiana', ITY: 'Itarrow', LAN: 'LAN', WJA: 'Westjet', ACA: 'Air Canada' };
  const AIRLINE_ICAO = { DL: 'DAL', B6: 'JBU', AA: 'AAL', UA: 'UAL', '9E': 'EDV', YX: 'RPA', AS: 'ASA', F9: 'FFT', BA: 'BAW', VS: 'VIR', AF: 'AFR', LH: 'DLH', KL: 'KLM',
    IB: 'IBE', LX: 'SWR', EI: 'EIN', TP: 'TAP', EK: 'UAE', QR: 'QTR', EY: 'ETD', TK: 'THY', LY: 'ELY', KE: 'KAL', JL: 'JAL', NH: 'ANA', CX: 'CPA', SQ: 'SIA',
    MU: 'CES', CZ: 'CSN', AI: 'AIC', AM: 'AMX', CM: 'CMP', AV: 'AVA', JU: 'ASL', MS: 'MSR', KX: 'CAY', DE: 'CFG', '1I': 'EJA', '9K': 'KAP', OZ: 'AAR', AZ: 'ITY',
    LA: 'LAN', WS: 'WJA', AC: 'ACA', OO: 'SKW', MQ: 'ENY' };
  const AIRLINE_TYPE = { DAL: 'A321', JBU: 'A320', AAL: 'A321', UAL: 'B763', EDV: 'E175', RPA: 'E175', SKW: 'E175', ENY: 'E175', ASA: 'A321', FFT: 'A20N',
    BAW: 'B772', VIR: 'A35K', AFR: 'B77W', DLH: 'B748', KLM: 'B789', IBE: 'A332', SWR: 'A333', EIN: 'A21N', TAP: 'A339', UAE: 'A388', QTR: 'B77W', ETD: 'B789',
    THY: 'B77W', ELY: 'B789', KAL: 'A388', JAL: 'B77W', ANA: 'B789', CPA: 'B77W', SIA: 'A359', CES: 'B77W', CSN: 'B789', AIC: 'B77W', AMX: 'B738', CMP: 'B38M',
    AVA: 'A21N', ASL: 'A332', MSR: 'B77W', CAY: 'B38M', CFG: 'A339', EJA: 'C56X', KAP: 'PC12', AAR: 'A359', ITY: 'A359', LAN: 'B789', WJA: 'B38M', ACA: 'E175' };
  const TYPES = {
    A321: { name: 'A321',          wake: 'M', vapp: 140, vr: 150, climb: 2200, desc: 2000, cruise: 290, span: 34.1, len: 44.5, shape: 'jet' },
    B739: { name: '737-900',       wake: 'M', vapp: 148, vr: 155, climb: 2100, desc: 2100, cruise: 290, span: 35.8, len: 42.1, shape: 'jet' },
    B38M: { name: '737 MAX 8',     wake: 'M', vapp: 145, vr: 150, climb: 2400, desc: 2100, cruise: 290, span: 35.9, len: 39.5, shape: 'jet' },
    E175: { name: 'Embraer 175',   wake: 'M', vapp: 128, vr: 135, climb: 2400, desc: 2000, cruise: 280, span: 26.0, len: 31.7, shape: 'jet' },
    E190: { name: 'Embraer 190',   wake: 'M', vapp: 128, vr: 132, climb: 2400, desc: 2000, cruise: 280, span: 28.7, len: 36.2, shape: 'jet' },
    CRJ9: { name: 'CRJ900',        wake: 'M', vapp: 135, vr: 140, climb: 2500, desc: 2000, cruise: 280, span: 24.9, len: 36.2, shape: 'jet' },
    A332: { name: 'A330-200',      wake: 'H', vapp: 138, vr: 150, climb: 1900, desc: 2000, cruise: 300, span: 60.3, len: 58.8, shape: 'jet' },
    A333: { name: 'A330-300',      wake: 'H', vapp: 140, vr: 152, climb: 1900, desc: 2000, cruise: 300, span: 60.3, len: 63.7, shape: 'jet' },
    A339: { name: 'A330-900neo',   wake: 'H', vapp: 138, vr: 150, climb: 2000, desc: 2000, cruise: 300, span: 64.0, len: 63.7, shape: 'jet' },
    A359: { name: 'A350-900',      wake: 'H', vapp: 140, vr: 150, climb: 2100, desc: 2000, cruise: 300, span: 64.8, len: 66.8, shape: 'jet' },
    A35K: { name: 'A350-1000',     wake: 'H', vapp: 145, vr: 155, climb: 2000, desc: 2000, cruise: 300, span: 64.8, len: 73.8, shape: 'jet' },
    A388: { name: 'A380',          wake: 'H', vapp: 140, vr: 155, climb: 1600, desc: 1800, cruise: 300, span: 79.8, len: 72.7, shape: 'jet' },
    B763: { name: '767-300',       wake: 'H', vapp: 140, vr: 150, climb: 2200, desc: 2000, cruise: 300, span: 47.6, len: 54.9, shape: 'jet' },
    B772: { name: '777-200',       wake: 'H', vapp: 140, vr: 155, climb: 1900, desc: 2000, cruise: 300, span: 60.9, len: 63.7, shape: 'jet' },
    B77W: { name: '777-300ER',     wake: 'H', vapp: 149, vr: 160, climb: 1800, desc: 2000, cruise: 300, span: 64.8, len: 73.9, shape: 'jet' },
    B748: { name: '747-8',         wake: 'H', vapp: 152, vr: 165, climb: 1700, desc: 2000, cruise: 300, span: 68.4, len: 76.3, shape: 'jet' },
    B789: { name: '787-9',         wake: 'H', vapp: 145, vr: 155, climb: 2100, desc: 2000, cruise: 300, span: 60.1, len: 62.8, shape: 'jet' }
  };
  const PLACES = {
    'boston': 'KBOS', 'washington': 'KDCA', 'washington dulles': 'KIAD', 'baltimore': 'KBWI', 'philadelphia': 'KPHL', 'norfolk': 'KORF', 'richmond': 'KRIC', 'raleigh/durham': 'KRDU',
    'charlotte': 'KCLT', 'atlanta': 'KATL', 'nashville': 'KBNA', 'new orleans': 'KMSY', 'dallas': 'KDFW', 'fort worth': 'KDFW', 'dallas/fort worth': 'KDFW', 'houston': 'KIAH', 'austin': 'KAUS',
    'cincinnati': 'KCVG', 'wilmington': 'KILM', 'mexico city': 'MMMX', 'chicago': 'KORD', 'minneapolis/saint paul': 'KMSP', 'minneapolis': 'KMSP', 'denver': 'KDEN', 'las vegas': 'KLAS',
    'phoenix': 'KPHX', 'los angeles': 'KLAX', 'san francisco': 'KSFO', 'san diego': 'KSAN', 'seattle': 'KSEA', 'portland': 'KPDX', 'salt lake city': 'KSLC', 'milwaukee': 'KMKE',
    'st. louis': 'KSTL', 'detroit': 'KDTW', 'pittsburgh': 'KPIT', 'cleveland': 'KCLE', 'buffalo': 'KBUF', 'rochester': 'KROC', 'syracuse': 'KSYR', 'albany': 'KALB', 'burlington': 'KBTV',
    'ithaca': 'KITH', 'portland (me)': 'KPWM', 'providence': 'KPVD', 'hyannis': 'KHYA', 'nantucket': 'KACK', "martha's vineyard": 'KMVY', 'saranac lake': 'KSLK', 'islip': 'KISP',
    'teterboro': 'KTEB', 'morristown': 'KMMU', 'toronto': 'CYYZ', 'montreal': 'CYUL', 'quebec': 'CYQB', 'miami': 'KMIA', 'fort lauderdale': 'KFLL', 'orlando': 'KMCO', 'tampa': 'KTPA',
    'west palm beach': 'KPBI', 'fort myers': 'KRSW', 'jacksonville': 'KJAX', 'san juan': 'TJSJ', 'nassau': 'MYNN', 'montego bay': 'MKJS', 'punta cana': 'MDPC', 'santo domingo': 'MDSD',
    'aruba': 'TNCA', 'cancun': 'MMUN', 'grand cayman island': 'MWCR', 'grand cayman': 'MWCR', 'panama city': 'MPTO', 'bogota': 'SKBO', 'santiago': 'SCEL', 'sao paulo': 'SBGR',
    'buenos aires': 'SAEZ', 'london': 'EGLL', 'london heathrow': 'EGLL', 'london gatwick': 'EGKK', 'manchester': 'EGCC', 'dublin': 'EIDW', 'paris': 'LFPG', 'frankfurt': 'EDDF',
    'munich': 'EDDM', 'amsterdam': 'EHAM', 'zurich': 'LSZH', 'madrid': 'LEMD', 'barcelona': 'LEBL', 'lisbon': 'LPPT', 'rome': 'LIRF', 'milan': 'LIMC', 'istanbul': 'LTFM',
    'tel aviv': 'LLBG', 'dubai': 'OMDB', 'abu dhabi': 'OMAA', 'doha': 'OTHH', 'mumbai': 'VABB', 'delhi': 'VIDP', 'new delhi': 'VIDP', 'cairo': 'HECA', 'belgrade': 'LYBE',
    'copenhagen': 'EKCH', 'stockholm': 'ESSA', 'oslo': 'ENGM', 'brussels': 'EBBR', 'athens': 'LGAV', 'seoul': 'RKSI', 'tokyo': 'RJTT', 'tokyo narita': 'RJAA', 'hong kong': 'VHHH',
    'shanghai': 'ZSPD', 'guangzhou': 'ZGGG', 'singapore': 'WSSS'
  };
  const AIRPORTS = {
    KJFK: [40.6399, -73.7789, 'New York JFK'], KMKE: [42.9472, -87.8966, 'Milwaukee'], KISP: [40.7952, -73.1002, 'Islip'], VABB: [19.0896, 72.8656, 'Mumbai'], ZGGG: [23.3924, 113.2988, 'Guangzhou'],
    KHYA: [41.6693, -70.2804, 'Hyannis'], KTEB: [40.8501, -74.0608, 'Teterboro'], KSLK: [44.3853, -74.2062, 'Saranac Lake'], KSAN: [32.7338, -117.1933, 'San Diego'], KBOS: [42.3656, -71.0096, 'Boston'], KDCA: [38.8521, -77.0377, 'Washington'], KIAD: [38.9445, -77.4558, 'Washington Dulles'],
    KBWI: [39.1754, -76.6683, 'Baltimore'], KPHL: [39.8719, -75.2411, 'Philadelphia'], KORF: [36.8946, -76.2012, 'Norfolk'], KRIC: [37.5052, -77.3197, 'Richmond'],
    KRDU: [35.8776, -78.7875, 'Raleigh-Durham'], KCLT: [35.2140, -80.9431, 'Charlotte'], KATL: [33.6407, -84.4277, 'Atlanta'], KBNA: [36.1245, -86.6782, 'Nashville'],
    KDFW: [32.8998, -97.0403, 'Dallas-Fort Worth'], KAUS: [30.1975, -97.6664, 'Austin'], KCVG: [39.0488, -84.6678, 'Cincinnati'], KORD: [41.9742, -87.9073, 'Chicago'],
    KMSP: [44.8848, -93.2223, 'Minneapolis'], KDEN: [39.8561, -104.6737, 'Denver'], KLAS: [36.0840, -115.1537, 'Las Vegas'], KPHX: [33.4352, -112.0101, 'Phoenix'],
    KLAX: [33.9416, -118.4085, 'Los Angeles'], KSFO: [37.6213, -122.3790, 'San Francisco'], KSEA: [47.4502, -122.3088, 'Seattle'], KSLC: [40.7899, -111.9791, 'Salt Lake City'],
    KDTW: [42.2162, -83.3554, 'Detroit'], KPIT: [40.4915, -80.2329, 'Pittsburgh'], KBUF: [42.9405, -78.7322, 'Buffalo'], KITH: [42.4910, -76.4584, 'Ithaca'],
    CYQB: [46.7911, -71.3933, 'Québec'], CYYZ: [43.6777, -79.6248, 'Toronto'], KMIA: [25.7959, -80.2870, 'Miami'], KFLL: [26.0742, -80.1506, 'Fort Lauderdale'],
    KMCO: [28.4312, -81.3081, 'Orlando'], KTPA: [27.9755, -82.5332, 'Tampa'], KPBI: [26.6832, -80.0956, 'West Palm Beach'], KRSW: [26.5362, -81.7552, 'Fort Myers'],
    KJAX: [30.4941, -81.6879, 'Jacksonville'], TJSJ: [18.4394, -66.0018, 'San Juan'], MYNN: [25.0390, -77.4662, 'Nassau'], TNCA: [12.5014, -70.0152, 'Aruba'],
    MMUN: [21.0365, -86.8771, 'Cancún'], MWCR: [19.2928, -81.3577, 'Grand Cayman'], MPTO: [9.0714, -79.3835, 'Panama City'], SKBO: [4.7016, -74.1469, 'Bogotá'],
    MMMX: [19.4363, -99.0721, 'Mexico City'], EGLL: [51.4700, -0.4543, 'London Heathrow'], EIDW: [53.4213, -6.2701, 'Dublin'], LFPG: [49.0097, 2.5479, 'Paris CDG'],
    EDDF: [50.0333, 8.5706, 'Frankfurt'], EDDM: [48.3538, 11.7861, 'Munich'], EHAM: [52.3086, 4.7639, 'Amsterdam'], LSZH: [47.4647, 8.5492, 'Zurich'],
    LEMD: [40.4983, -3.5676, 'Madrid'], LPPT: [38.7742, -9.1342, 'Lisbon'], LIMC: [45.6306, 8.7281, 'Milan Malpensa'], LTFM: [41.2753, 28.7519, 'Istanbul'],
    LLBG: [32.0114, 34.8867, 'Tel Aviv'], OMDB: [25.2532, 55.3657, 'Dubai'], OMAA: [24.4330, 54.6511, 'Abu Dhabi'], OTHH: [25.2731, 51.6081, 'Doha'],
    VIDP: [28.5562, 77.1000, 'Delhi'], HECA: [30.1219, 31.4056, 'Cairo'], LYBE: [44.8184, 20.3091, 'Belgrade'], EKCH: [55.6181, 12.6561, 'Copenhagen'],
    RKSI: [37.4602, 126.4407, 'Seoul Incheon'], RJTT: [35.5494, 139.7798, 'Tokyo Haneda'], RJAA: [35.7720, 140.3929, 'Tokyo Narita'], VHHH: [22.3080, 113.9185, 'Hong Kong'],
    ZSPD: [31.1443, 121.8083, 'Shanghai'], KPWM: [43.6462, -70.3093, 'Portland'], KPVD: [41.7240, -71.4282, 'Providence'], KBTV: [44.4720, -73.1533, 'Burlington']
  };
  // where cruising flights over New York divert to with a sick passenger (medical diversions in emerg.js)
  const ALTERNATES = [['Newark', 'KEWR', 'PUCKY'], ['La Guardia', 'KLGA', 'VADDR'], ['Boston', 'KBOS', 'MERIT']];

  return {
    icao: 'KJFK', iata: 'JFK', name: 'New York JFK', city: 'New York', country: 'United States', arp: [40.639925, -73.778939], elev: 13,
    FIX, NAV, RWY, STARS, ILS, SIDS, DIR, PLACE_DIR, dirFor, UNITS, CTR, APREQ, TA, TZ, ALTERNATES,
    TIMETABLE, LONG_STAY, EXTRA, EXERCISES, WX_PRESETS, TEL, AIRLINE_ICAO, AIRLINE_TYPE, TYPES, PLACES, AIRPORTS,
    data: { metar: 'kjfk/metar.txt', flights: 'kjfk/flights.json' },
    features: { roadCrossing: false, sra: false, parallelRunways: true, crossings: true, faa: true }
  };
})();
if (typeof module !== 'undefined') module.exports = KJFK;
