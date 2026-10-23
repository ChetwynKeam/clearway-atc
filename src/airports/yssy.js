// ═════════════════════════ Sydney Kingsford Smith (YSSY) airport profile ═════════════════════════
// Everything the Clearway engine needs to know that is true only of Sydney. Sources: Airservices Australia AIP / DAP
// (aerodrome and ground movement charts, apron charts, SIDs, STARs, ILS and RNP approaches, noise abatement, PRM and IVA
// user instructions, 09 JUL and 03 SEP 2026), the ERSA GEN IFR waypoint list (03 SEP 2026) for every fix position, and
// OpenStreetMap for taxiways, stands, aprons and terminals (yssy-ground.js). Positions are lat/lon (WGS84); bearings in the
// charts are MAGNETIC (variation 13°E: true = magnetic + 13). Plain data plus a few small functions, like kjfk.js;
// yssy-engine.js turns it into the engine's globals.
// Sydney has three runways: the parallel pair 16L/34R (2,438 m) and 16R/34L (3,962 m) and the crossing 07/25 (2,530 m).
// Simplifications (see the Academy briefing): the parallel pair is run in one configuration at a time (land on the short runway, depart the
// long one), 07/25 is run alone, the curfew (23:00 to 06:00 local) closes the session, and the centre sectors are representative.

const YSSY = (() => {
  // ── fixes (ERSA GEN IFR waypoints 03 SEP 2026), those on the SIDs, STARs and approaches used here
  const FIX = {
    SANAD: [-31.38639, 151.4125], OLTIN: [-32.55222, 151.2575], YAKKA: [-33.19222, 151.22278], MEPIL: [-33.40278, 151.21139],
    LANOL: [-33.60917, 151.19972], TESAT: [-33.94389, 151.1825], MARLN: [-34.03472, 152.06722], BIKUS: [-34.00556, 151.77944],
    WHALE: [-33.985, 151.57806], PRAWN: [-33.96417, 151.37944], VENUL: [-33.925, 151.5825], UXAMA: [-33.87389, 151.45861],
    JELLI: [-33.89389, 151.37861], MANFA: [-34.04278, 151.34611], JAKLN: [-34.14694, 151.37333], AKMIR: [-34.17861, 150.10667],
    UDODU: [-34.17222, 150.45028], MUBDI: [-34.13472, 150.53972], MITSA: [-34.03194, 150.78361], GURSI: [-34.00889, 150.88583],
    ANKUB: [-33.98667, 150.97639], RIVET: [-34.28083, 150.43028], POMEL: [-34.22694, 150.55056], BIGEM: [-34.18111, 150.65278],
    TAMMI: [-34.10222, 150.82806], TAXAT: [-34.07028, 150.89861], BOOGI: [-34.0225, 151.00444], DUDOK: [-34.08, 151.07722],
    NASHO: [-34.19528, 151.10722], BOREE: [-33.23722, 151.04389], VASRA: [-33.36722, 151.06889], KAFRI: [-33.49639, 151.09361],
    BEROW: [-33.61333, 151.11611], OVILS: [-33.70167, 151.13361], JENTL: [-33.81111, 151.155], MAJAR: [-33.82722, 151.28972],
    ZONKA: [-33.95806, 151.1125], DIPPA: [-33.95806, 151.32389], DALAR: [-33.53694, 151.07028], DUMOP: [-33.65139, 151.09972],
    URDEN: [-33.74667, 151.12417], IGALA: [-33.84611, 151.15], TONUX: [-33.71778, 151.12833], RENAM: [-33.86778, 151.16722],
    PEGBA: [-33.91583, 151.28194], VIDIK: [-33.96167, 151.08806], SOSIJ: [-34.17222, 151.23472], ATRET: [-34.05806, 151.205],
    OLSOG: [-34.04944, 151.21417], BOBIG: [-34.10278, 151.22806], ENDEV: [-34.18, 151.24833], IDBIM: [-34.00806, 151.24556],
    KEVIN: [-34.13667, 151.37139], EXOVA: [-34.06278, 151.46944], PEDLU: [-33.89444, 151.52472], NOBAR: [-33.78639, 151.74],
    DIPSO: [-33.90639, 152.07194], OLSEM: [-33.64778, 151.60528], OPTIC: [-34.40111, 151.88889], CAWLY: [-34.32611, 151.95778],
    EVONN: [-34.19528, 152.03111], OGESO: [-33.68028, 151.04972], AVMOV: [-33.70306, 151.31056], MARUB: [-33.93167, 151.48167],
    DUNES: [-34.02667, 151.175], DEENA: [-34.10667, 151.20167], GROOK: [-34.20111, 151.23306], KADOM: [-33.71083, 150.29972],
    OLVAG: [-34.25944, 151.15167], GUSPU: [-34.2375, 151.0475], EGOPO: [-34.11583, 151.01917], UPMAR: [-33.89556, 150.92944],
    STUIE: [-33.59694, 150.77639], URDOS: [-33.70194, 150.90889], ISBEX: [-34.37167, 150.99333], JULIA: [-34.24917, 151.32528],
    ABBEY: [-34.40306, 151.09472], TONTO: [-34.29278, 150.645], LAVEB: [-34.11417, 150.63444], KAKNU: [-34.03444, 150.57528]
  };
  // the field's beacons are not drawn: Sydney's procedures are RNAV, with the ILS DME and GNSS for distance

  // ── runways (AIP AD 2.12 / aerodrome chart; thresholds come from the OpenStreetMap runway ways in yssy-ground.js).
  // Bearings are magnetic on the charts: 16R/34L 155°/335°, 16L/34R 155°/335°, 07/25 062°/242°.
  const RWY = {
    lengthM: { '16L34R': 2438, '16R34L': 3962, '0725': 2530 }, widthM: 45, magHdg: { '16': 155, '34': 335, '07': 62, '25': 242 }, var: 13
  };

  // ── STARs (Airservices DAP, 09 JUL 2026). `pts` is the route to where the radar vectors start, `via` replaces it for a
  // runway where the chart has its own leg, `hold` is where an arrival waits if it is held.
  const STARS = {
    'MEPIL4': { from: 'N',  spoken: 'Mepil Four', pts: [['SANAD'], ['OLTIN'], ['YAKKA'], ['MEPIL', 8000], ['LANOL', 7000]], expect: 'expect radar vectors to final after LANOL' },
    'BOREE5A': { from: 'NW', spoken: 'Boree Five Alpha', pts: [['BOREE', 9000], ['VASRA', 8000], ['KAFRI', 12000], ['BEROW', 9000], ['OVILS']], expect: 'expect radar vectors to final after OVILS' },
    'RIVET5': { from: 'W',  spoken: 'Rivet Five', pts: [['RIVET'], ['POMEL'], ['BIGEM', 6000], ['TAMMI'], ['TAXAT', 9000], ['BOOGI', 6000]], expect: 'expect radar vectors to final after BOOGI' },
    'AKMIR1': { from: 'SW', spoken: 'Akmir One', pts: [['AKMIR'], ['UDODU'], ['MUBDI', 9000], ['MITSA', 9000]], rwx: { '07': [['GURSI', 4000]] }, then: [['ANKUB']], expect: 'expect radar vectors to final after ANKUB' },
    'MARLN6': { from: 'E',  spoken: 'Marlin Six', pts: [['MARLN'], ['BIKUS', 8000], ['WHALE', 9000], ['PRAWN', 6000]],
                via: { '25': [['MARLN'], ['BIKUS', 8000], ['VENUL', 9000], ['UXAMA']] }, rwx: { '34R': [['MANFA'], ['JAKLN']] }, expect: 'expect radar vectors to final after PRAWN' }
  };

  // ── ILS approaches (Airservices DAP ILS charts, profile views): the intermediate fix with its platform altitude and the
  // final approach fix with the altitude on the 3° path there; the decision altitude is 220 ft or so on every runway.
  const ILS = {
    '16L': { loc: 'ISS', freq: '110.90', ifx: 'TONUX', faf: 'RENAM', ifAlt: 4000, fafAlt: 1700, missedHdg: 125, missed: 3000 },
    '16R': { loc: 'IKS', freq: '109.50', ifx: 'URDEN', faf: 'IGALA', ifAlt: 3000, fafAlt: 1700, missedHdg: 170, missed: 3000 },
    '34L': { loc: 'ISN', freq: '110.10', ifx: 'SOSIJ', faf: 'ATRET', ifAlt: 3000, fafAlt: 1900, missedHdg: 320, missed: 3000 },
    '34R': { loc: 'IKN', freq: '109.30', ifx: 'BOBIG', faf: 'OLSOG', ifAlt: 2000, fafAlt: 1600, missedHdg: 60, missed: 4000 },
    '07':  { loc: 'ISY', freq: '109.90', ifx: 'ANKUB', faf: 'VIDIK', ifAlt: 3000, fafAlt: 1320, missedHdg: 62, missed: 3000 },
    '25':  { loc: 'ISW', freq: '109.70', ifx: 'JELLI', faf: 'PEGBA', ifAlt: 3000, fafAlt: 1610, missedHdg: 242, missed: 3000 }
  };


  // ── SIDs (Airservices DAP): RNAV SIDs by runway, the common climb from the runway, then the transitions. Initial
  // headings in the charts are magnetic. Where a destination has no RNAV SID off the runway in use it flies SYDNEY FOUR
  // (radar), straight ahead to the radar vectors.
  const SIDS = {
    SY4:    { spoken: 'Sydney Four', radar: true, top: 5000 },
    AVMOV1: { spoken: 'Avmov One', rnav: true, rwys: ['25', '34L'], pts: ['OGESO', 'AVMOV'], top: 5000 },
    KEVIN7: { spoken: 'Kevin Seven', rnav: true, rwys: ['16L'], pts: ['IDBIM', 'KEVIN'], top: 5000 },
    ABBEY3: { spoken: 'Abbey Three', rnav: true, rwys: ['16L'], pts: ['IDBIM', 'KEVIN', 'JULIA', 'ABBEY'], top: 5000 },
    OLSEM1: { spoken: 'Olsem One', rnav: true, rwys: ['34R'], pts: ['OLSEM'], top: 5000 },
    MARUB7: { spoken: 'Marub Seven', rnav: true, rwys: ['34R'], pts: ['MARUB'], top: 5000 },
    STUIE1: { spoken: 'Stuie One', rnav: true, rwys: ['25', '34L'], pts: ['URDOS', 'STUIE'], top: 5000 },
    GROOK2: { spoken: 'Grook Two', rnav: true, rwys: ['16R'], pts: ['DUNES', 'DEENA', 'GROOK'], top: 5000 },
    TONTO1: { spoken: 'Tonto One', rnav: true, rwys: ['34L'], pts: ['KAKNU', 'LAVEB', 'TONTO'], top: 5000 }
  };
  // transitions after the SID's last fix (from the charts: KEVIN7 and AVMOV1 to OLSEM and DIPSO; GROOK2 to KADOM and STUIE)
  const TRANS = {
    'KEVIN7:OLSEM': ['EXOVA', 'PEDLU', 'OLSEM'], 'KEVIN7:DIPSO': ['EXOVA', 'PEDLU', 'DIPSO'], 'AVMOV1:OLSEM': ['OLSEM'], 'AVMOV1:DIPSO': ['DIPSO'],
    'GROOK2:KADOM': ['OLVAG', 'GUSPU', 'EGOPO', 'ANKUB', 'KADOM'], 'GROOK2:STUIE': ['OLVAG', 'GUSPU', 'EGOPO', 'ANKUB', 'UPMAR', 'STUIE']
  };
  // airway directions. Each has the STAR an arrival flies, where the simulator picks it up, the departure exit fix, the SID
  // (and transition) by runway where an RNAV one serves it, and the centre sector that takes it.
  const DIR = {
    N:  { star: 'MEPIL4',  entry: 'YAKKA', exit: 'OLSEM', route: ['OLSEM'], sids: { '25': ['AVMOV1', 'OLSEM'], '34L': ['AVMOV1', 'OLSEM'], '34R': ['OLSEM1'], '16L': ['KEVIN7', 'OLSEM'] }, ctr: 'n', name: 'Newcastle, Brisbane, Cairns and the north' },
    NW: { star: 'BOREE5A', entry: 'BOREE', exit: 'STUIE', route: ['STUIE'], sids: { '25': ['STUIE1'], '34L': ['STUIE1'], '16R': ['GROOK2', 'STUIE'] }, ctr: 'w', name: 'Dubbo, Orange and Asia and the Middle East via the north-west' },
    W:  { star: 'RIVET5',  entry: 'RIVET', exit: 'STUIE', route: ['STUIE'], sids: { '25': ['STUIE1'], '34L': ['STUIE1'], '16R': ['GROOK2', 'STUIE'] }, ctr: 'w', name: 'Adelaide, Perth and the west' },
    SW: { star: 'AKMIR1',  entry: 'AKMIR', exit: 'TONTO', route: ['TONTO'], sids: { '34L': ['TONTO1'], '16R': ['GROOK2', 'KADOM'], '16L': ['ABBEY3'] }, ctr: 's', name: 'Canberra, Melbourne, Hobart and the south' },
    E:  { star: 'MARLN6',  entry: 'MARLN', exit: 'DIPSO', route: ['DIPSO'], sids: { '25': ['AVMOV1', 'DIPSO'], '34L': ['AVMOV1', 'DIPSO'], '16L': ['KEVIN7', 'DIPSO'] }, ctr: 'e', name: 'New Zealand, the Pacific and the Americas' }
  };
  const PLACE_DIR = {
    YBBN: 'N', YBCG: 'N', YBSU: 'N', YBCS: 'N', YBTL: 'N', YBMK: 'N', YBHM: 'N', YWLM: 'N', YPMQ: 'N', YCFS: 'N', YBNA: 'N', YARM: 'N', YSTW: 'N', YBRK: 'N', YPDN: 'N', YPPH: 'W', YPAD: 'W', YBAS: 'W', YAYE: 'W',
    YSDU: 'NW', YORG: 'NW', YBHI: 'W', YSWG: 'SW', YMAY: 'SW', YSCB: 'SW', YMML: 'SW', YMHB: 'SW', YMLT: 'SW', YMAV: 'SW',
    NZAA: 'E', NZWN: 'E', NZCH: 'E', NZQN: 'E', NFFN: 'E', NWWW: 'E', KLAX: 'E', KSFO: 'E', KDFW: 'E', PHNL: 'E', CYVR: 'E', SCEL: 'E', KIAH: 'E',
    WSSS: 'NW', VHHH: 'N', OMDB: 'NW', OTHH: 'NW', OMAA: 'NW', VTBS: 'N', WMKK: 'NW', RPLL: 'N', WIII: 'NW', WADD: 'N', RJAA: 'N', RJTT: 'N', RKSI: 'N', ZSPD: 'N', ZGGG: 'N', RCTP: 'N', VIDP: 'NW', FAOR: 'W'
  };
  const dirFor = icao => DIR[PLACE_DIR[icao] || 'N'];

  // ── units and frequencies (aerodrome chart, STAR and SID charts, 09 JUL 2026). The centre sectors are representative.
  const UNITS = {
    atis: { name: 'Sydney information', freq: '118.550' }, del: { name: 'Sydney Clearance', freq: '133.800' },
    gnd: { name: 'Sydney Ground', freq: '121.700', west: '126.500' },
    twr: { name: 'Sydney Tower', freq: { '16R34L': '120.500', '0725': '120.500', '16L34R': '124.700' } },
    app: { name: 'Sydney Approach', freq: '124.400', south: '128.300' }, dir: { east: '125.300', west: '126.100' }, dep: { name: 'Sydney Departures', freq: '123.000' }
  };
  const CTR = { n: ['Brisbane Centre', '128.400'], w: ['Melbourne Centre', '132.400'], s: ['Melbourne Centre', '125.700'], e: ['Brisbane Centre', '133.400'] };
  const APREQ = [];
  // transition altitude 10,000 ft (flight levels above), QNH in hectopascals; Sydney keeps AEDT (UTC+11) from October to April
  const TA = 10000, TZ = 'Australia/Sydney';

  // ── traffic. A representative day, thinned to about 25 movements an hour at the busiest (the real airport runs 45 an
  // hour). Operators, terminals and routes are the real ones; flight numbers and times are representative, not a published
  // timetable. [operator, flight number, airport, type, arrival times (local), minutes on the ground, days]; the departure
  // is the next number. The airport has a curfew from 23:00 to 06:00 local, so the session runs from 06:00 to 22:00.
  const L = (o, n, ap, t, times, turn, days = '1234567') => ({ o, n, ap, t, times, turn, days });
  const ROUTES = [
    // Qantas (Terminal 3) and QantasLink (Terminal 3)
    L('QFA', 400, 'YMML', 'B738', ['07:10', '09:40', '12:30', '15:20', '18:10', '20:30'], 50), L('QFA', 500, 'YBBN', 'B738', ['07:35', '10:15', '13:05', '16:25', '19:15'], 50),
    L('QFA', 600, 'YSCB', 'B738', ['08:20', '12:50', '17:40'], 45), L('QFA', 700, 'YPPH', 'A333', ['09:30', '14:10'], 80), L('QFA', 800, 'YPAD', 'B738', ['10:05', '15:40'], 55),
    L('QFA', 900, 'YMHB', 'B738', ['11:20', '17:15'], 55), L('QFA', 1000, 'YBCG', 'B738', ['08:50', '13:40', '18:30'], 50), L('QFA', 1100, 'YBCS', 'B738', ['11:35'], 70), L('QFA', 1200, 'YPDN', 'B738', ['12:20'], 70),
    L('QFA', 1, 'YMML', 'A333', ['06:50', '09:20', '11:40'], 60), L('QFA', 11, 'NZAA', 'B738', ['07:25', '13:30', '18:50'], 55), L('QFA', 21, 'NZWN', 'B738', ['10:45'], 60), L('QFA', 31, 'NZCH', 'B738', ['14:20'], 60),
    L('QFA', 41, 'WSSS', 'A333', ['06:30', '13:15'], 105), L('QFA', 51, 'VHHH', 'A333', ['09:00'], 110), L('QFA', 61, 'KLAX', 'A388', ['07:00'], 140), L('QFA', 71, 'KSFO', 'B789', ['08:15'], 135), L('QFA', 81, 'KDFW', 'B789', ['09:55'], 150),
    L('QLK', 2000, 'YSDU', 'DH8D', ['08:10', '13:50', '18:20'], 35), L('QLK', 2100, 'YORG', 'DH8D', ['09:25', '16:00'], 35), L('QLK', 2200, 'YPMQ', 'DH8D', ['07:40', '12:15', '17:25'], 35),
    L('QLK', 2300, 'YARM', 'DH8D', ['10:30'], 35), L('QLK', 2400, 'YCFS', 'DH8D', ['08:40', '14:45'], 35), L('QLK', 2500, 'YBNA', 'DH8D', ['11:10', '16:35'], 35), L('QLK', 2600, 'YSWG', 'DH8D', ['09:05', '15:25'], 35),
    // Jetstar (Terminal 2 and 3) and Virgin Australia (Terminal 2)
    L('JST', 400, 'YMML', 'A320', ['06:40', '08:30', '10:20', '12:50', '15:00', '17:20', '19:40'], 45), L('JST', 500, 'YBBN', 'A320', ['07:05', '09:15', '11:50', '14:10', '16:40', '19:00'], 45),
    L('JST', 600, 'YBCG', 'A320', ['08:00', '12:20', '17:00'], 45), L('JST', 700, 'YBCS', 'A320', ['09:45', '14:30'], 50), L('JST', 800, 'YPPH', 'B788', ['10:10'], 90), L('JST', 900, 'YMHB', 'A320', ['11:30'], 55),
    L('JST', 1000, 'YBCG', 'A21N', ['13:05'], 50), L('JST', 20, 'NZAA', 'A320', ['07:50', '15:30'], 55), L('JST', 30, 'WADD', 'B788', ['11:00'], 100), L('JST', 40, 'RJAA', 'B788', ['09:35'], 105),
    L('VOZ', 400, 'YMML', 'B738', ['06:55', '09:00', '11:15', '13:30', '15:50', '18:05', '20:15'], 45), L('VOZ', 500, 'YBBN', 'B738', ['07:15', '09:50', '12:10', '14:35', '17:00', '19:20'], 45),
    L('VOZ', 600, 'YSCB', 'B738', ['08:05', '13:25', '18:40'], 40), L('VOZ', 700, 'YPPH', 'B738', ['10:40', '16:10'], 75), L('VOZ', 800, 'YPAD', 'B738', ['11:45', '17:35'], 55), L('VOZ', 900, 'YBCG', 'B738', ['09:20', '15:05'], 45),
    L('VOZ', 1000, 'YMHB', 'B738', ['12:40'], 55), L('VOZ', 1100, 'YBCS', 'B738', ['10:25'], 60), L('VOZ', 1200, 'YBTL', 'B738', ['14:50'], 60), L('VOZ', 1300, 'YBMK', 'B738', ['08:45'], 60),
    L('RXA', 100, 'YSWG', 'SF34', ['07:55', '12:35', '17:45'], 30), L('RXA', 200, 'YMAY', 'SF34', ['09:10', '14:20', '18:35'], 30), L('RXA', 300, 'YORG', 'SF34', ['10:00', '15:45'], 30), L('RXA', 400, 'YSDU', 'SF34', ['11:05', '16:30'], 30),
    L('RXA', 500, 'YPMQ', 'SF34', ['12:00'], 30), L('RXA', 600, 'YCFS', 'SF34', ['13:20'], 30), L('RXA', 700, 'YMLT', 'B738', ['15:15'], 55), L('RXA', 800, 'YBHI', 'SF34', ['09:40'], 35),
    // international carriers (Terminal 1)
    L('ANZ', 100, 'NZAA', 'A320', ['06:35', '10:05', '13:45', '17:25', '20:35'], 55), L('ANZ', 200, 'NZWN', 'A320', ['08:15', '15:00'], 55), L('ANZ', 300, 'NZCH', 'A320', ['11:50'], 55), L('ANZ', 400, 'NZQN', 'A320', ['09:30'], 55),
    L('ANZ', 500, 'NFFN', 'B788', ['07:30'], 80), L('FJI', 900, 'NFFN', 'B738', ['06:45', '10:50'], 70), L('FJI', 910, 'NWWW', 'A333', ['13:35'], 75),
    L('UAE', 400, 'OMDB', 'A388', ['06:20', '15:45', '20:05'], 120), L('UAE', 410, 'YMML', 'A388', ['08:05'], 90), L('UAE', 420, 'NZAA', 'B77W', ['13:10'], 95), L('QTR', 900, 'OTHH', 'B77W', ['06:50'], 125), L('QTR', 910, 'OTHH', 'A359', ['21:10'], 110),
    L('ETD', 450, 'OMAA', 'B789', ['06:25', '20:20'], 120), L('SIA', 200, 'WSSS', 'A359', ['06:30', '10:20', '14:00', '17:15'], 100), L('SIA', 210, 'WSSS', 'A388', ['09:00'], 125), L('CPA', 100, 'VHHH', 'A359', ['06:55', '12:30'], 115), L('CPA', 110, 'VHHH', 'A35K', ['17:40'], 120),
    L('MAS', 120, 'WMKK', 'A333', ['07:20', '16:45'], 100), L('THA', 140, 'VTBS', 'A359', ['07:05', '17:10'], 105), L('PAL', 211, 'RPLL', 'A333', ['08:25'], 100), L('GIA', 715, 'WADD', 'B738', ['14:15'], 80), L('KAL', 400, 'RKSI', 'B789', ['06:45'], 120),
    L('JAL', 770, 'RJAA', 'B789', ['07:10'], 115), L('ANA', 880, 'RJTT', 'B789', ['06:40'], 115), L('CSN', 300, 'ZGGG', 'B789', ['08:40'], 110), L('CES', 500, 'ZSPD', 'B789', ['12:05'], 110), L('EVA', 300, 'RCTP', 'B78X', ['07:35'], 110),
    L('DAL', 40, 'KLAX', 'B77W', ['06:30'], 135), L('UAL', 100, 'KSFO', 'B789', ['06:20'], 130), L('UAL', 110, 'KLAX', 'B789', ['07:15'], 130), L('ACA', 33, 'CYVR', 'B789', ['06:40'], 135), L('LAN', 800, 'SCEL', 'B789', ['08:55'], 140, '1357'),
    L('SAA', 280, 'FAOR', 'A333', ['06:35'], 135, '246'), L('AIC', 301, 'VIDP', 'B789', ['09:20'], 135, '2467')
  ];
  // the first wave (night-stoppers, local off-blocks) and the last arrivals, which stay overnight
  const FIRST = [['QFA', 399, 'YMML', 'B738', '06:00'], ['VOZ', 399, 'YMML', 'B738', '06:05'], ['JST', 399, 'YMML', 'A320', '06:10'], ['QFA', 499, 'YBBN', 'B738', '06:15'], ['VOZ', 499, 'YBBN', 'B738', '06:20'],
    ['JST', 499, 'YBBN', 'A320', '06:25'], ['QFA', 599, 'YSCB', 'B738', '06:30'], ['QLK', 1999, 'YSDU', 'DH8D', '06:35'], ['RXA', 99, 'YSWG', 'SF34', '06:40'], ['JST', 599, 'YBCG', 'A320', '06:45'],
    ['ANZ', 99, 'NZAA', 'A320', '06:50'], ['VOZ', 799, 'YPAD', 'B738', '07:00']];
  const LAST = [['QFA', 1399, 'YMML', 'B738', '21:40'], ['JST', 1199, 'YMML', 'A320', '21:50'], ['VOZ', 1399, 'YBBN', 'B738', '21:55'], ['QFA', 1499, 'YBBN', 'B738', '22:10']];
  // local times (AEDT, UTC+11) to the engine's UTC "HH:MM"; times before 11:00 local fall on the previous UTC day, so the
  // clock runs on past 24:00 like the other airports' (a 06:00 Sydney morning is 19:00, 22:00 is 35:00)
  const utc = t => { const m = +t.slice(0, 2)*60 + +t.slice(3) + 13*60; return String(Math.floor(m/60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
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
    { cs: 'QFA441', t: 'B738', k: 'ARR', o: 'YMML' }, { cs: 'JST517', t: 'A320', k: 'DEP', d: 'YBBN' }, { cs: 'VOZ449', t: 'B738', k: 'ARR', o: 'YMML' }, { cs: 'QFA547', t: 'B738', k: 'DEP', d: 'YBBN' },
    { cs: 'UAE413', t: 'A388', k: 'ARR', o: 'OMDB' }, { cs: 'ANZ113', t: 'A320', k: 'DEP', d: 'NZAA' }, { cs: 'JST413', t: 'A320', k: 'ARR', o: 'YMML' }, { cs: 'QFA651', t: 'B738', k: 'DEP', d: 'YSCB' },
    { cs: 'SIA221', t: 'A359', k: 'ARR', o: 'WSSS' }, { cs: 'VOZ551', t: 'B738', k: 'DEP', d: 'YBBN' }, { cs: 'QLK2051', t: 'DH8D', k: 'ARR', o: 'YSDU' }, { cs: 'CPA111', t: 'A359', k: 'DEP', d: 'VHHH' },
    { cs: 'JST617', t: 'A320', k: 'ARR', o: 'YBCG' }, { cs: 'QFA445', t: 'B738', k: 'DEP', d: 'YMML' }, { cs: 'QTR901', t: 'B77W', k: 'ARR', o: 'OTHH' }, { cs: 'VOZ453', t: 'B738', k: 'DEP', d: 'YMML' },
    { cs: 'ANZ201', t: 'A320', k: 'ARR', o: 'NZWN' }, { cs: 'JST519', t: 'A320', k: 'DEP', d: 'YBCG' }, { cs: 'RXA201', t: 'SF34', k: 'ARR', o: 'YMAY' }, { cs: 'QFA503', t: 'B738', k: 'DEP', d: 'YBBN' }
  ];
  const EXERCISES = {
    dep: { name: 'Sydney 1 · Avmov One off 34L', wx: 'n', rwy: '34R', depRwy: '34L', sched: [{ cs: 'QFA441', t: 'B738', k: 'DEP', d: 'YBBN', m: 0, stand: '35' }] },
    arr: { name: 'Sydney 2 · ILS 34R and the runway crossing', wx: 'n', rwy: '34R', depRwy: '34L', sched: [{ cs: 'JST519', t: 'A320', k: 'ARR', o: 'YMML', m: 0 }] },
    mix: { name: 'Sydney 3 · A mixed hour on 16L and 16R', wx: 's', rwy: '16L', depRwy: '16R', sched: [{ cs: 'VOZ453', t: 'B738', k: 'ARR', o: 'YBBN', m: 0 }, { cs: 'QFA547', t: 'B738', k: 'DEP', d: 'YMML', m: 0, stand: '41' }, { cs: 'UAE413', t: 'A388', k: 'ARR', o: 'OMDB', m: 6 }] }
  };
  const WX_PRESETS = {
    n:     { name: 'Northerly: land 34R, depart 34L',                       short: 'Northerly',   metar: 'YSSY 051751Z 36012KT 9999 FEW040 SCT250 24/12 Q1016' },
    s:     { name: 'Southerly: land 16L, depart 16R',                       short: 'Southerly',   metar: 'YSSY 051751Z 17014KT 9999 SCT035 19/11 Q1018' },
    ne:    { name: 'North-east sea breeze: runway 07',                      short: 'Sea breeze',  metar: 'YSSY 051751Z 05014KT 9999 FEW030 26/17 Q1014' },
    w:     { name: 'Westerly: runway 25',                                   short: 'Westerly',    metar: 'YSSY 051751Z 27016G26KT 9999 FEW060 SCT120 21/05 Q1013' },
    bsb:   { name: 'Southerly buster: gusty 16L and 16R',                           short: 'Buster',      metar: 'YSSY 051751Z 17026G38KT 9999 SCT025 BKN040 17/13 Q1010' },
    ifr:   { name: 'Low cloud and drizzle, ILS 34R near the minima',        short: 'IFR',         metar: 'YSSY 051751Z 02010KT 3000 -DZ BR OVC004 17/16 Q1012' },
    storm: { name: 'Summer thunderstorms over the field',                   short: 'Storms',      metar: 'YSSY 051951Z 33018G34KT 4000 TSRA BKN030CB OVC060 29/21 Q1005' },
    fog:   { name: 'Winter fog: below the ILS minima',                      short: 'Fog',         metar: 'YSSY 051051Z 00000KT 0400 FG VV001 08/08 Q1021' }
  };

  // airline radio telephony and codes seen at Sydney (merged into the engine's tables)
  const TEL = { QFA: 'Qantas', QLK: 'Eagle', JST: 'Jetstar', VOZ: 'Velocity', RXA: 'Rex', ANZ: 'New Zealand', FJI: 'Fiji', UAE: 'Emirates', QTR: 'Qatari', ETD: 'Etihad',
    SIA: 'Singapore', CPA: 'Cathay', MAS: 'Malaysian', THA: 'Thai', PAL: 'Philippine', GIA: 'Indonesia', KAL: 'Korean Air', JAL: 'Japan Air', ANA: 'All Nippon', CSN: 'China Southern',
    CES: 'China Eastern', EVA: 'Eva', DAL: 'Delta', UAL: 'United', ACA: 'Air Canada', LAN: 'Lan', SAA: 'Springbok', AIC: 'Air India' };
  const AIRLINE_ICAO = { QF: 'QFA', QF2: 'QLK', JQ: 'JST', VA: 'VOZ', ZL: 'RXA', NZ: 'ANZ', FJ: 'FJI', EK: 'UAE', QR: 'QTR', EY: 'ETD', SQ: 'SIA', CX: 'CPA', MH: 'MAS', TG: 'THA',
    PR: 'PAL', GA: 'GIA', KE: 'KAL', JL: 'JAL', NH: 'ANA', CZ: 'CSN', MU: 'CES', BR: 'EVA', DL: 'DAL', UA: 'UAL', AC: 'ACA', LA: 'LAN', SA: 'SAA', AI: 'AIC' };
  const AIRLINE_TYPE = { QFA: 'B738', QLK: 'DH8D', JST: 'A320', VOZ: 'B738', RXA: 'SF34', ANZ: 'A320', FJI: 'B738', UAE: 'A388', QTR: 'B77W', ETD: 'B789', SIA: 'A359', CPA: 'A359',
    MAS: 'A333', THA: 'A359', PAL: 'A333', GIA: 'B738', KAL: 'B789', JAL: 'B789', ANA: 'B789', CSN: 'B789', CES: 'B789', EVA: 'B78X', DAL: 'B77W', UAL: 'B789', ACA: 'B789', LAN: 'B789', SAA: 'A333', AIC: 'B789' };
  const TYPES = {
    B738: { name: '737-800',       wake: 'M', vapp: 145, vr: 152, climb: 2200, desc: 2100, cruise: 290, span: 35.8, len: 39.5, shape: 'jet' },
    A320: { name: 'A320',          wake: 'M', vapp: 138, vr: 148, climb: 2200, desc: 2000, cruise: 290, span: 34.1, len: 37.6, shape: 'jet' },
    A21N: { name: 'A321neo',       wake: 'M', vapp: 142, vr: 155, climb: 2100, desc: 2000, cruise: 290, span: 35.8, len: 44.5, shape: 'jet' },
    DH8D: { name: 'Dash 8-400',    wake: 'M', vapp: 120, vr: 120, climb: 2000, desc: 1800, cruise: 260, span: 28.4, len: 32.8, shape: 'prop' },
    SF34: { name: 'Saab 340',      wake: 'M', vapp: 105, vr: 100, climb: 1500, desc: 1500, cruise: 230, span: 21.4, len: 19.7, shape: 'prop' },
    A333: { name: 'A330-300',      wake: 'H', vapp: 140, vr: 152, climb: 1900, desc: 2000, cruise: 300, span: 60.3, len: 63.7, shape: 'jet' },
    A359: { name: 'A350-900',      wake: 'H', vapp: 140, vr: 150, climb: 2100, desc: 2000, cruise: 300, span: 64.8, len: 66.8, shape: 'jet' },
    A35K: { name: 'A350-1000',     wake: 'H', vapp: 145, vr: 155, climb: 2000, desc: 2000, cruise: 300, span: 64.8, len: 73.8, shape: 'jet' },
    A388: { name: 'A380',          wake: 'H', vapp: 140, vr: 155, climb: 1600, desc: 1800, cruise: 300, span: 79.8, len: 72.7, shape: 'jet' },
    B77W: { name: '777-300ER',     wake: 'H', vapp: 149, vr: 160, climb: 1800, desc: 2000, cruise: 300, span: 64.8, len: 73.9, shape: 'jet' },
    B788: { name: '787-8',         wake: 'H', vapp: 145, vr: 155, climb: 2100, desc: 2000, cruise: 300, span: 60.1, len: 57.0, shape: 'jet' },
    B789: { name: '787-9',         wake: 'H', vapp: 145, vr: 155, climb: 2100, desc: 2000, cruise: 300, span: 60.1, len: 62.8, shape: 'jet' },
    B78X: { name: '787-10',        wake: 'H', vapp: 147, vr: 157, climb: 2000, desc: 2000, cruise: 300, span: 60.1, len: 68.3, shape: 'jet' }
  };
  const PLACES = {
    'melbourne': 'YMML', 'brisbane': 'YBBN', 'canberra': 'YSCB', 'gold coast': 'YBCG', 'coolangatta': 'YBCG', 'sunshine coast': 'YBSU', 'cairns': 'YBCS', 'townsville': 'YBTL', 'mackay': 'YBMK',
    'hamilton island': 'YBHM', 'newcastle': 'YWLM', 'port macquarie': 'YPMQ', 'coffs harbour': 'YCFS', 'ballina': 'YBNA', 'ballina byron': 'YBNA', 'armidale': 'YARM', 'tamworth': 'YSTW',
    'dubbo': 'YSDU', 'orange': 'YORG', 'wagga wagga': 'YSWG', 'albury': 'YMAY', 'broken hill': 'YBHI', 'adelaide': 'YPAD', 'perth': 'YPPH', 'hobart': 'YMHB', 'launceston': 'YMLT', 'darwin': 'YPDN',
    'alice springs': 'YBAS', 'ayers rock': 'YAYE', 'uluru': 'YAYE', 'auckland': 'NZAA', 'wellington': 'NZWN', 'christchurch': 'NZCH', 'queenstown': 'NZQN', 'nadi': 'NFFN', 'noumea': 'NWWW',
    'singapore': 'WSSS', 'hong kong': 'VHHH', 'dubai': 'OMDB', 'doha': 'OTHH', 'abu dhabi': 'OMAA', 'los angeles': 'KLAX', 'san francisco': 'KSFO', 'dallas': 'KDFW', 'dallas/fort worth': 'KDFW',
    'vancouver': 'CYVR', 'honolulu': 'PHNL', 'bangkok': 'VTBS', 'kuala lumpur': 'WMKK', 'manila': 'RPLL', 'jakarta': 'WIII', 'bali': 'WADD', 'denpasar': 'WADD', 'tokyo': 'RJTT', 'tokyo narita': 'RJAA',
    'seoul': 'RKSI', 'shanghai': 'ZSPD', 'guangzhou': 'ZGGG', 'taipei': 'RCTP', 'delhi': 'VIDP', 'johannesburg': 'FAOR', 'santiago': 'SCEL'
  };
  const AIRPORTS = {
    YSSY: [-33.9461, 151.1772, 'Sydney'], YMML: [-37.6733, 144.8433, 'Melbourne'], YBBN: [-27.3842, 153.1175, 'Brisbane'], YSCB: [-35.3069, 149.1950, 'Canberra'], YBCG: [-28.1644, 153.5047, 'Gold Coast'],
    YBSU: [-26.6033, 153.0911, 'Sunshine Coast'], YBCS: [-16.8858, 145.7553, 'Cairns'], YBTL: [-19.2525, 146.7653, 'Townsville'], YBMK: [-21.1717, 149.1797, 'Mackay'], YBHM: [-20.3581, 148.9519, 'Hamilton Island'],
    YWLM: [-32.7950, 151.8344, 'Newcastle'], YPMQ: [-31.4358, 152.8631, 'Port Macquarie'], YCFS: [-30.3206, 153.1164, 'Coffs Harbour'], YBNA: [-28.8339, 153.5622, 'Ballina'], YARM: [-30.5281, 151.6178, 'Armidale'],
    YSTW: [-31.0839, 150.8467, 'Tamworth'], YSDU: [-32.2167, 148.5747, 'Dubbo'], YORG: [-33.3817, 149.1331, 'Orange'], YSWG: [-35.1653, 147.4663, 'Wagga Wagga'], YMAY: [-36.0678, 146.9580, 'Albury'],
    YBHI: [-32.0014, 141.4722, 'Broken Hill'], YPAD: [-34.9450, 138.5306, 'Adelaide'], YPPH: [-31.9403, 115.9669, 'Perth'], YMHB: [-42.8361, 147.5103, 'Hobart'], YMLT: [-41.5453, 147.2142, 'Launceston'],
    YPDN: [-12.4147, 130.8770, 'Darwin'], YBAS: [-23.8067, 133.9022, 'Alice Springs'], YAYE: [-25.1861, 130.9756, 'Uluru'], NZAA: [-37.0082, 174.7917, 'Auckland'], NZWN: [-41.3272, 174.8053, 'Wellington'],
    NZCH: [-43.4894, 172.5322, 'Christchurch'], NZQN: [-45.0211, 168.7392, 'Queenstown'], NFFN: [-17.7554, 177.4434, 'Nadi'], NWWW: [-22.0146, 166.2130, 'Noumea'], WSSS: [1.3644, 103.9915, 'Singapore'],
    VHHH: [22.3080, 113.9185, 'Hong Kong'], OMDB: [25.2532, 55.3657, 'Dubai'], OTHH: [25.2731, 51.6081, 'Doha'], OMAA: [24.4330, 54.6511, 'Abu Dhabi'], KLAX: [33.9416, -118.4085, 'Los Angeles'],
    KSFO: [37.6213, -122.3790, 'San Francisco'], KDFW: [32.8998, -97.0403, 'Dallas-Fort Worth'], CYVR: [49.1947, -123.1792, 'Vancouver'], PHNL: [21.3187, -157.9224, 'Honolulu'], VTBS: [13.6900, 100.7501, 'Bangkok'],
    WMKK: [2.7456, 101.7099, 'Kuala Lumpur'], RPLL: [14.5086, 121.0194, 'Manila'], WIII: [-6.1256, 106.6559, 'Jakarta'], WADD: [-8.7482, 115.1675, 'Bali'], RJAA: [35.7720, 140.3929, 'Tokyo Narita'],
    RJTT: [35.5494, 139.7798, 'Tokyo Haneda'], RKSI: [37.4602, 126.4407, 'Seoul Incheon'], ZSPD: [31.1443, 121.8083, 'Shanghai'], ZGGG: [23.3924, 113.2988, 'Guangzhou'], RCTP: [25.0777, 121.2325, 'Taipei'],
    VIDP: [28.5562, 77.1000, 'Delhi'], FAOR: [-26.1392, 28.2460, 'Johannesburg'], SCEL: [-33.3930, -70.7858, 'Santiago']
  };
  // where cruising flights over Sydney divert to with a sick passenger (medical diversions in emerg.js)
  const ALTERNATES = [['Canberra', 'YSCB', 'AKMIR'], ['Newcastle', 'YWLM', 'MEPIL'], ['Melbourne', 'YMML', 'AKMIR']];

  return {
    icao: 'YSSY', iata: 'SYD', name: 'Sydney', city: 'Sydney', country: 'Australia', arp: [-(33 + 56/60 + 46/3600), 151 + 10/60 + 38/3600], elev: 21,
    FIX, RWY, STARS, ILS, SIDS, TRANS, DIR, PLACE_DIR, dirFor, UNITS, CTR, APREQ, TA, TZ, ALTERNATES,
    TIMETABLE, LONG_STAY, EXTRA, EXERCISES, WX_PRESETS, TEL, AIRLINE_ICAO, AIRLINE_TYPE, TYPES, PLACES, AIRPORTS,
    data: { metar: 'yssy/metar.txt', flights: 'yssy/flights.json' },
    features: { roadCrossing: false, sra: false, parallelRunways: true, crossings: true, faa: false }
  };
})();
if (typeof module !== 'undefined') module.exports = YSSY;
