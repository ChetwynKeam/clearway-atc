// ═════════════════════════ Newcastle (EGNT) airport profile ═════════════════════════
// Everything the Clearway engine needs to know that is true only of Newcastle. Sources: UK AIP AD 2 EGNT charts (aerodrome
// 2-1, parking/docking 2-2, control zone 4-1, ATC surveillance minimum altitudes 5-1, the GIRLI SIDs 6-1 to 6-3 and their
// coding tables 6-4, the POL 1N and RIMTO 2N STARs 7-1 and their coding tables 7-3, the ETSES 1J and 1K transitions 7-2 and
// 7-5, the ETSES hold 7-4, the ILS/DME/NDB, LOC/DME/NDB, NDB/DME and RNP approaches 8-1 to 8-10), the VATSIM UK Newcastle
// vMATS Part 2 (2024/11) and crib sheet for the standard routes, the omni-directional departures and the stand table, and
// Newcastle's Noise Action Plan 2024-2028. The ground layout is egnt-ground.js (tools/egnt_ground.py, from the charts).
// Positions are lat/lon (WGS84); bearings are TRUE unless named "mag" (variation 0.5°E: magnetic = true − 0.5).
// Newcastle is one runway, 07/25 (2,330 m), with the terminal and the Main Apron at the 07 end of the north side and
// taxiway D running the length of it to the 25 end. Its only SIDs go south (GIRLI): every other departure leaves on an
// omni-directional departure, straight ahead to FL80, and is vectored to its airway once above 4,000 ft. Arrivals from the
// south come down the POL 1N and RIMTO 2N STARs to ETSES and on by the RNAV transitions to the RNP approaches' initial
// fixes; arrivals from the north and west have no STAR and are vectored to the ILS. Plain data plus a few small functions,
// like eggd.js; egnt-engine.js turns it into the engine's globals.

const EGNT = (() => {
  const ll = (s) => {                                     // '550202.35N' / '0014216.68W' → decimal degrees
    const m = s.match(/^(\d{2,3})(\d{2})(\d{2}(?:\.\d+)?)([NSEW])$/);
    const v = +m[1] + m[2]/60 + m[3]/3600; return /[SW]/.test(m[4]) ? -v : v;
  };
  const P = (lat, lon) => [ll(lat), ll(lon)];

  // ── fixes: the SID coding tables (6-4), the STAR and transition coding tables (7-3, 7-5), the RNP approach coding tables
  // (8-9, 8-10); the airway joining points of the standard routes (UK AIP ENR 4.4 via the airway data and OpenNav)
  const FIX = {
    NTE05: P('550446.74N', '0013155.15W'), NTS12: P('545830.52N', '0013156.79W'), GIRLI: P('544240.51N', '0014811.49W'),
    NTW03: P('550044.97N', '0014707.72W'), NTS08: P('545533.93N', '0014440.11W'), NTW02: P('550123.26N', '0014443.75W'), NITUD: P('544854.94N', '0015314.14W'),
    RIMTO: P('534303.25N', '0012558.78W'), KEFTE: P('540112.37N', '0014435.47W'), GOKOV: P('540824.00N', '0015202.53W'), IRKOR: P('542415.37N', '0014703.99W'),
    XODRU: P('543207.74N', '0014434.30W'), ETSES: P('544157.09N', '0014126.13W'),
    NTS01: P('544629.31N', '0015524.85W'), ERUXI: P('545019.48N', '0015756.18W'), NTS02: P('545137.68N', '0013819.19W'), UPMOP: P('550131.69N', '0012146.79W'),
    KUSEG: P('550242.68N', '0020024.82W'), NTW04: P('545600.82N', '0015804.58W'), NT07I: P('545810.42N', '0015645.55W'), NT07F: P('545949.01N', '0015037.35W'),
    NTM01: P('550407.75N', '0013423.02W'), ASGEB: P('551057.54N', '0012920.76W'), SUPIG: P('550624.81N', '0012542.12W'), NT25F: P('550444.99N', '0013201.83W'),
    NTM02: P('550049.86N', '0014649.24W'),
    ALASO: P('552650N', '0013354W'), RITSI: [55.7026, -1.6571], ERLOT: P('551714N', '0003506W'), LONAM: P('535022N', '0035633E'),
    ERKIT: [54.0302, -0.8302], OTBED: P('531717N', '0000155E'), HAVEN: P('552740N', '0025947W'), IPSAD: [55.3625, -2.6872], OTBUN: [55.2806, -2.4333],
    TLA: [55.4991, -3.3528], NATEB: P('550218N', '0014154W'), TILNI: [54.5476, -1.855]
  };
  // the beacons named on the charts
  const NAV = {
    NT:  { name: 'Newcastle NDB', freq: '352', p: P('550301N', '0013834W') },
    NEW: { name: 'Newcastle VOR/DME', freq: '114.25', p: P('550218.41N', '0014154.14W') },
    POL: { name: 'Pole Hill VOR/DME', freq: '112.10', p: P('534437.60N', '0020611.83W') },
    DCS: { name: 'Dean Cross VOR/DME', freq: '115.20', p: [54.7219, -3.3406] }
  };

  // ── runway (AD 2-EGNT-2-1): 07/25, 2,330 × 45 m asphalt, magnetic 065°/245°; the 07 threshold displaced 124 m, the 25
  // threshold 137 m (the pavement before each is for departures). Rwy 07 THR 263 ft, Rwy 25 THR 239 ft.
  const RWY = {
    lo: '07', hi: '25', magHdg: { '07': 65, '25': 245 }, var: 0.5,
    thr: { '07': P('550202.35N', '0014216.68W'), '25': P('550230.46N', '0014030.76W') },
    elev: { '07': 263, '25': 239 }, length: 2330, width: 45
  };

  // ── STARs (7-1, 7-3), RNAV1, both to ETSES at FL90 (hold there: 7-4). Arrivals from the north, north-east, north-west and
  // west have none (vMATS APC 3.2: non-RNAV1 traffic is routed via NATEB or direct NT): they are brought in from where
  // Scottish Control releases them and vectored to the final approach. Alt = level constraint at the fix (feet).
  const STARS = {
    'POL 1N':   { from: 'SW', pts: [['POL'], ['GOKOV'], ['IRKOR', 16000], ['XODRU', 12000], ['ETSES', 9000]] },
    'RIMTO 2N': { from: 'S',  pts: [['RIMTO'], ['KEFTE', 25000], ['GOKOV'], ['IRKOR', 16000], ['XODRU', 12000], ['ETSES', 9000]] },
    // the routings from the north and west (no STAR: as Scottish Control releases them, at the level agreed with Newcastle Radar)
    'ALASO':    { from: 'N',  route: true, pts: [['RITSI'], ['ALASO', 8000]] },
    'ERLOT':    { from: 'NE', route: true, pts: [['ERLOT', 8000]] },
    'HAVEN':    { from: 'NW', route: true, pts: [['HAVEN'], ['IPSAD'], ['OTBUN', 8000]] },
    'DCS':      { from: 'W',  route: true, pts: [['DCS', 9000]] }
  };
  // the RNAV transitions (7-2, 7-5) from ETSES to the RNP approaches' initial approach fixes, and on to their intermediate fixes
  // (RNP 07 via ERUXI, 8-9; RNP 25 via UPMOP, 8-10): ETSES 1J for runway 07, ETSES 1K for runway 25
  const TRANS = {
    '07': [['NTS01', 6000], ['ERUXI', 5500], ['NTW04', 3500], ['NT07I', 2600]],
    '25': [['NTS02', 6000], ['UPMOP', 4000], ['SUPIG', 2600]]
  };
  // the RNP approaches' other initial approach fixes, for arrivals from the north and west: KUSEG (07) and ASGEB (25)
  const IAF_N = { '07': [['KUSEG', 4000], ['NT07I', 2600]], '25': [['ASGEB', 4000], ['SUPIG', 2600]] };
  // the holds: ETSES (7-4, the STAR arrivals: inbound 010° mag, left, FL90 to FL110, 220 kt) and NT (the NDB, on the
  // approach charts: inbound 246° mag, left, 2,000 ft upwards, 210 kt; held at 3,500 ft and above, the missed approach's)
  const HOLDS_AIR = {
    ETSES: { inb: 10.5, turn: 'L', min: 9000, max: 11000, maxKt: 220 },
    NT:    { inb: 246.5, turn: 'L', min: 3500, max: 25000, maxKt: 210 }
  };

  // ── ILS/DME approaches (8-1, 8-5; the RNP coding tables for the fixes): 3° glidepath, I-NC (07) and I-NWC (25) on 111.50,
  // DME zero-ranged to each threshold. Intermediate fix NT07I (07, 9.2 NM) and SUPIG (25, 9.4 NM) at 2,600 ft, final approach
  // fix NT07F/NT25F at 2,000 ft. Both runways are CAT II/III. Missed approach: 07 straight ahead to the NT NDB at 2,500 ft; 25
  // climb straight ahead to 2,500 ft or I-NWC D4, whichever is later, then right turn back to NT at 2,500 ft.
  const ILS = {
    '07': { loc: 'I-NC',  freq: '111.50', ifx: 'NT07I', faf: 'NT07F', ifAlt: 2600, fafAlt: 2000, missed: ['NT', 2500], turn: 0 },
    '25': { loc: 'I-NWC', freq: '111.50', ifx: 'SUPIG', faf: 'NT25F', ifAlt: 2600, fafAlt: 2000, missed: ['NT', 2500], turn: 1 }
  };

  // ── departures. SIDs (6-1 to 6-4) only to GIRLI (airway P18 south). GIRLI 1Y is for runway 25 when the Currock Hill
  // gliding site (8 NM south-west) is active, GIRLI 3X when it isn't. Alt = level constraint at the fix (feet). T25 is the
  // GIRLI 1Y's climb to 1,100 ft on 245° before it turns direct to NTW03.
  // Every other route leaves on an omni-directional departure (vMATS ADC 1.2.4, the Noise Action Plan's NPRs): straight ahead
  // to FL80, except towards GIRLI and ERKIT: from 07 straight ahead to NEW D3.5, then right heading 190°; from 25 straight
  // ahead to NEW D1.5, then left heading 210° (180° when Currock Hill is active). Newcastle Radar then vectors it to its
  // airway once above 4,000 ft (the NPRs end there). The standard routes (vMATS ADC 1.2.2, crib sheet): north P18 ALASO;
  // north-east P15 ERLOT; east N610 LONAM; south-east N110 ERKIT and Y70 OTBED; south-west P18 GIRLI (the SIDs); west DCS;
  // north-west Y96 HAVEN.
  const SIDS = {
    GIRLI1T: { rwy: '07', spoken: 'Girli One Tango', sid: true, pts: [['NTE05', 2000], ['NTS12', 4000], ['GIRLI', 8000]] },
    GIRLI3X: { rwy: '25', spoken: 'Girli Three X-ray', sid: true, pts: [['NTW02', 1100], ['NITUD', 8000], ['GIRLI', 8000]] },
    GIRLI1Y: { rwy: '25', spoken: 'Girli One Yankee', sid: true, currock: true, pts: [['T25G', 1100], ['NTW03', 2000], ['NTS08', 4000], ['GIRLI', 8000]] }
  };
  // the omni-directional departures to each joining point: [airway, the route's fixes, which way it turns off the NPR]
  const DEP_ROUTES = {
    N:  { airway: 'P18', via: ['ALASO'], omni: 'S' },
    NE: { airway: 'P15', via: ['ERLOT'], omni: 'S' },
    E:  { airway: 'N610', via: ['LONAM'], omni: 'S' },
    SE: { airway: 'N110', via: ['ERKIT'], omni: 'T' },
    L:  { airway: 'Y70', via: ['OTBED'], omni: 'S' },
    W:  { airway: 'DCS', via: ['DCS'], omni: 'S' },
    NW: { airway: 'Y96', via: ['HAVEN', 'TLA'], omni: 'S' }
  };
  const DEP_ALT = 8000, DEP_ALT_LOW = 9000;              // initial climb FL80; FL90 when the QNH is below 976 hPa
  // airway directions: the arrival route (STAR or routing), where the simulator picks the arrival up, the departure (SID
  // or omni-directional route) for each runway, and the unit that takes the departure
  const DIR = {
    SW: { star: 'POL 1N',   entry: 'GOKOV', dep: 'SW', ctr: 's',  name: 'the south-west and Midlands of England, Wales, Spain, Portugal, the Canaries and Morocco' },
    S:  { star: 'RIMTO 2N', entry: 'KEFTE', dep: 'SE', ctr: 's',  name: 'France, Switzerland, Italy, the eastern Mediterranean, Egypt and the Gulf' },
    L:  { star: 'RIMTO 2N', entry: 'KEFTE', dep: 'L',  ctr: 's',  name: 'London' },
    E:  { star: 'RIMTO 2N', entry: 'KEFTE', dep: 'E',  ctr: 'ns', name: 'the Netherlands, Belgium, Germany and central Europe' },
    NE: { star: 'ERLOT',    entry: 'ERLOT', dep: 'NE', ctr: 'ns', name: 'Scandinavia and northern Germany' },
    N:  { star: 'ALASO',    entry: 'RITSI', dep: 'N',  ctr: 'sc', name: 'the north of Scotland' },
    NW: { star: 'HAVEN',    entry: 'HAVEN', dep: 'NW', ctr: 'sc', name: 'the west of Scotland, Iceland and North America' },
    W:  { star: 'DCS',      entry: 'DCS',   dep: 'W',  ctr: 'sc', name: 'Ireland, Northern Ireland and the Isle of Man' }
  };
  const PLACE_DIR = {
    EGGD: 'SW', EGHI: 'SW', EGFF: 'SW', EGBB: 'SW', EGCC: 'SW', EGTE: 'SW', EGJJ: 'SW', EGJB: 'SW', EGHH: 'SW', EGKB: 'SW',
    LEAL: 'SW', LEMG: 'SW', LEPA: 'SW', LEBL: 'SW', LEIB: 'SW', LEMH: 'SW', LERS: 'SW', LEGE: 'SW', LEMD: 'SW', LEBB: 'SW', LEZL: 'SW', LEAM: 'SW',
    LPFR: 'SW', LPPT: 'SW', LPPR: 'SW', LPMA: 'SW', GCTS: 'SW', GCRR: 'SW', GCLP: 'SW', GCFV: 'SW', GMAD: 'SW', GMMX: 'SW', LXGB: 'SW', GVAC: 'SW',
    LFPG: 'S', LFPO: 'S', LFMN: 'S', LSGG: 'S', LSZH: 'S', LIRF: 'S', LIMC: 'S', LIME: 'S', LIPZ: 'S', LIRP: 'S', LMML: 'S', LGAV: 'S', LGKR: 'S',
    LGIR: 'S', LGRP: 'S', LGKO: 'S', LGZA: 'S', LTAI: 'S', LTBS: 'S', LTFE: 'S', LTFM: 'S', LCLK: 'S', LCPH: 'S', HEGN: 'S', HESH: 'S', DTNH: 'S',
    OMDB: 'S', LDDU: 'S', LDSP: 'S', LBBG: 'S', LBSF: 'S', LROP: 'S',
    EGLL: 'L', EGKK: 'L', EGSS: 'L', EGGW: 'L', EGLC: 'L', EGLK: 'L', EGLF: 'L',
    EHAM: 'E', EBBR: 'E', EDDL: 'E', EDDF: 'E', EDDM: 'E', EDDB: 'E', LKPR: 'E', LOWW: 'E', LHBP: 'E', EPKK: 'E', EPWR: 'E', EPGD: 'E', EPWA: 'E',
    EPKT: 'E', EVRA: 'E', EYVI: 'E', LZIB: 'E',
    EKCH: 'NE', EKBI: 'NE', ENGM: 'NE', ENBR: 'NE', ENZV: 'NE', ESSA: 'NE', EDDH: 'NE', EDDW: 'NE',
    EGPD: 'N', EGPE: 'N', EGPA: 'N', EGPB: 'N', EGPC: 'N',
    EGPF: 'NW', EGPH: 'NW', EGPO: 'NW', BIKF: 'NW', KJFK: 'NW', KEWR: 'NW', CYYZ: 'NW',
    EIDW: 'W', EICK: 'W', EINN: 'W', EIKN: 'W', EGAA: 'W', EGAC: 'W', EGAE: 'W', EGNS: 'W'
  };
  const dirFor = icao => DIR[PLACE_DIR[icao] || 'SW'];

  // ── units and frequencies (AD 2-EGNT-2-1, the SID, STAR and approach charts). Departures pass from Newcastle Radar to
  // Scottish Control (the ACC on the SID charts); the North Sea routes to London Control.
  const UNITS = {
    atis: { name: 'Newcastle Information', freq: '118.380' }, gnd: { name: 'Newcastle Ground', freq: '121.730' },
    twr: { name: 'Newcastle Tower', freq: '119.705' }, app: { name: 'Newcastle Radar', freq: '124.380' },
    dir: { name: 'Newcastle Director', freq: '125.830' }, fire: { name: 'Newcastle Fire', freq: '121.605' }
  };
  const CTR = { s: ['Scottish Control', '133.800'], sc: ['Scottish Control', '133.800'], ns: ['London Control', '128.130'] };
  const TA = 6000, TZ = 'Europe/London';
  // where cruising flights over the north-east divert to with a sick passenger (medical diversions in emerg.js)
  const ALTERNATES = [['Teesside', 'EGNV', 'TILNI'], ['Edinburgh', 'EGPH', 'ALASO'], ['Leeds Bradford', 'EGNM', 'GOKOV']];

  // ── traffic: one real day of Newcastle's boards (avionio.com: Monday 16 November 2026, with Sunday's evening departures,
  // tools/egnt/make_timetable.py), times UTC. Newcastle is a base for Jet2, easyJet, Ryanair and TUI: their aircraft
  // night-stop and leave first thing, and turn round onto the airline's next departure in the afternoon.
  // [arrival, from, arrival UTC, departure, to, departure UTC, type, days, stand]
  const TIMETABLE = [
    [null, null, null, 'KLM952', 'EHAM', '05:50', 'E195', '1234567', null],
    [null, null, null, 'EXS573', 'LMML', '06:15', 'B738', '1234567', null],
    [null, null, null, 'HOP1559', 'LFPG', '06:20', 'E190', '1234567', null],
    [null, null, null, 'EXS583', 'LEAL', '06:30', 'A21N', '1234567', null],
    [null, null, null, 'EXS557', 'LEMG', '06:30', 'B738', '1234567', null],
    [null, null, null, 'RYR6241', 'LHBP', '06:30', 'B38M', '1234567', null],
    [null, null, null, 'EZY5611', 'LFPG', '06:30', 'A21N', '1234567', null],
    [null, null, null, 'EXS537', 'LIRF', '06:45', 'B738', '1234567', null],
    [null, null, null, 'BAW1341', 'EGLL', '06:45', 'A320', '1234567', null],
    [null, null, null, 'RYR17', 'EIDW', '07:00', 'B38M', '1234567', null],
    [null, null, null, 'EZY5601', 'LEMG', '07:10', 'A20N', '1234567', null],
    [null, null, null, 'RYR8310', 'EPWR', '07:10', 'B738', '1234567', null],
    [null, null, null, 'EZY5639', 'LIRF', '07:25', 'A21N', '1234567', null],
    ['EZY67', 'EGAA', '07:45', 'EZY68', 'EGAA', '08:15', 'A21N', '1234567', null],
    [null, null, null, 'EXS1907', 'BIKF', '07:45', 'B738', '1234567', null],
    [null, null, null, 'EXS545', 'GCRR', '08:00', 'B738', '1234567', null],
    ['EZY237', 'EGGD', '08:10', 'EZY238', 'EGGD', '08:50', 'A20N', '1234567', null],
    ['EIN3350', 'EIDW', '08:15', 'EIN3351', 'EIDW', '08:45', 'AT76', '1234567', null],
    ['BAW1328', 'EGLL', '08:30', 'BAW1329', 'EGLL', '09:20', 'A319', '1234567', null],
    [null, null, null, 'EXS517', 'GCTS', '08:40', 'A21N', '1234567', null],
    ['KLM953', 'EHAM', '09:00', 'KLM954', 'EHAM', '09:35', 'E295', '1234567', null],
    ['RYR16', 'EIDW', '09:40', 'RYR450', 'EPKK', '10:05', 'B738', '1234567', null],
    ['EZY5634', 'HESH', '09:50', 'EZY5635', 'HESH', '11:20', 'A21N', '1234567', null],
    [null, null, null, 'EXS529', 'LPMA', '10:15', 'A21N', '1234567', null],
    ['HOP1058', 'LFPG', '10:30', 'HOP1059', 'LFPG', '11:15', 'E190', '1234567', null],
    ['KLM955', 'EHAM', '10:30', 'KLM956', 'EHAM', '11:10', 'E195', '1234567', null],
    [null, null, null, 'TOM1176', 'GCLP', '10:40', 'B38M', '1234567', null],
    ['EZY69', 'EGAA', '11:10', 'EZY70', 'EGAA', '11:40', 'A20N', '1234567', null],
    ['UAE35', 'OMDB', '11:20', 'UAE36', 'OMDB', '13:15', 'B77W', '1234567', null],
    ['EWG9338', 'EDDL', '11:40', 'EWG9339', 'EDDL', '12:25', 'A320', '1234567', null],
    ['BAW1330', 'EGLL', '11:45', 'BAW1331', 'EGLL', '12:35', 'A20N', '1234567', null],
    ['RYR8309', 'EPWR', '12:15', 'RYR416', 'GCTS', '13:05', 'B38M', '1234567', null],
    ['RYR6240', 'LHBP', '12:20', 'RYR414', 'GCRR', '13:25', 'B738', '1234567', null],
    ['BAW1332', 'EGLL', '12:50', 'BAW1333', 'EGLL', '13:40', 'A320', '1234567', null],
    ['KLM957', 'EHAM', '12:55', 'KLM958', 'EHAM', '13:25', 'E190', '1234567', null],
    ['EXS584', 'LEAL', '13:40', 'EXS1953', 'LOWW', '14:40', 'B738', '1234567', null],
    ['EXS538', 'LIRF', '13:45', 'EXS1901', 'EPKK', '14:45', 'A21N', '1234567', null],
    ['EXS1908', 'BIKF', '13:50', 'EXS507', 'LTAI', '14:50', 'B738', '1234567', null],
    ['EXS558', 'LEMG', '13:50', 'EXS509', 'LKPR', '15:15', 'B738', '1234567', null],
    ['EZY5640', 'LIRF', '14:00', 'EZY5647', 'EPKK', '14:35', 'A320', '1234567', null],
    ['EZY5602', 'LEMG', '14:10', 'EZY72', 'EGAA', '16:30', 'A319', '1234567', null],
    ['EXS574', 'LMML', '14:35', null, null, null, 'A21N', '1234567', null],
    ['RYR451', 'EPKK', '15:40', 'RYR4080', 'LEAL', '16:30', 'B38M', '1234567', null],
    ['BAW1334', 'EGLL', '15:45', 'BAW1335', 'EGLL', '16:40', 'A319', '1234567', null],
    ['EZY71', 'EGAA', '16:00', null, null, null, 'A21N', '1234567', null],
    ['HOP1158', 'LFPG', '16:20', 'HOP1159', 'LFPG', '17:50', 'E190', '1234567', null],
    ['KLM959', 'EHAM', '16:35', 'KLM960', 'EHAM', '17:50', 'E295', '1234567', null],
    ['EZY5628', 'LKPR', '17:15', 'EZY5629', 'LKPR', '18:45', 'A20N', '1234567', null],
    ['BAW1338', 'EGLL', '17:25', 'BAW1337', 'EGLL', '20:15', 'A320', '1234567', null],
    ['EXS546', 'GCRR', '18:00', null, null, null, 'B738', '1234567', null],
    ['EXS518', 'GCTS', '19:15', null, null, null, 'B738', '1234567', null],
    ['EXS530', 'LPMA', '19:40', null, null, null, 'B738', '1234567', null],
    ['EZY239', 'EGGD', '20:50', 'EZY240', 'EGGD', '22:20', 'A320', '1234567', null],
    ['RYR20', 'EIDW', '22:30', 'RYR21', 'EIDW', '22:55', 'B738', '1234567', null],
    ['RYR415', 'GCRR', '22:45', null, null, null, 'B38M', '1234567', null],
    ['RYR4093', 'LEAL', '23:00', null, null, null, 'B38M', '1234567', null],
    ['RYR417', 'GCTS', '23:00', null, null, null, 'B38M', '1234567', null]
  ];

  const LONG_STAY = [['GNEWC', 'PC12', '51', '1234567']];
  const EXTRA = [
    { cs: 'EXS5591', t: 'B738', k: 'ARR', o: 'LEPA' }, { cs: 'EZY6417', t: 'A20N', k: 'DEP', d: 'LEAL' }, { cs: 'TOM6544', t: 'B38M', k: 'ARR', o: 'LGRP' },
    { cs: 'RYR2463', t: 'B738', k: 'DEP', d: 'LEMG' }, { cs: 'KLM961', t: 'E195', k: 'ARR', o: 'EHAM' }, { cs: 'BAW1339', t: 'A320', k: 'DEP', d: 'EGLL' },
    { cs: 'LOG362', t: 'E145', k: 'ARR', o: 'EGPD' }, { cs: 'EXS1957', t: 'A21N', k: 'DEP', d: 'LTAI' }, { cs: 'EIN3352', t: 'AT76', k: 'ARR', o: 'EIDW' },
    { cs: 'EZY5651', t: 'A320', k: 'DEP', d: 'LSGG' }, { cs: 'THY1958', t: 'A21N', k: 'ARR', o: 'LTFM' }, { cs: 'TOM2713', t: 'B738', k: 'DEP', d: 'GCTS' },
    { cs: 'NSZ3528', t: 'B738', k: 'ARR', o: 'EKCH' }, { cs: 'SXN561', t: 'C56X', k: 'DEP', d: 'EGHI' }, { cs: 'EXS513', t: 'B738', k: 'ARR', o: 'LPFR' }
  ];
  const EXERCISES = {
    dep: { name: 'Newcastle 1 · Off 25 on the Girli Three X-ray', wx: 'west', rwy: '25', sched: [{ cs: 'EXS583', t: 'B738', k: 'DEP', d: 'LEAL', m: 0, stand: '8' }] },
    arr: { name: 'Newcastle 2 · From the POL 1N arrival to the ILS 25', wx: 'west', rwy: '25', sched: [{ cs: 'KLM953', t: 'E195', k: 'ARR', o: 'EHAM', m: 0 }] },
    mix: { name: 'Newcastle 3 · One runway, both ways', wx: 'west', rwy: '25', sched: [{ cs: 'EXS584', t: 'B738', k: 'ARR', o: 'LEAL', m: 0 },
      { cs: 'RYR17', t: 'B38M', k: 'DEP', d: 'EIDW', m: 0, stand: '5' }, { cs: 'KLM954', t: 'E195', k: 'DEP', d: 'EHAM', m: 0, stand: '11' }] }
  };
  const WX_PRESETS = {
    west:  { name: 'South-westerly, runway 25',                          short: 'Westerly',  metar: 'EGNT 161220Z 24014KT 9999 FEW025 SCT040 10/05 Q1011' },
    east:  { name: 'Easterly off the North Sea: runway 07',              short: 'Easterly',  metar: 'EGNT 161220Z 07012KT 9999 BKN018 07/04 Q1027' },
    low:   { name: 'Sea fret (haar) rolling in: ILS 07 near the minima',  short: 'Low cloud', metar: 'EGNT 161220Z 08008KT 1200 BR OVC002 06/06 Q1022' },
    fog:   { name: 'Freezing fog: low visibility procedures',            short: 'Fog',       metar: 'EGNT 160750Z 00000KT 0150 R25/0175N FZFG VV001 M01/M01 Q1031' },
    storm: { name: 'Atlantic gale over the Pennines: gusty crosswind',    short: 'Storm',     metar: 'EGNT 161220Z 28030G48KT 9999 -SHRA SCT015CB 09/04 Q0981' },
    calm:  { name: 'High pressure, light and variable',                  short: 'Calm',      metar: 'EGNT 161220Z VRB02KT CAVOK 12/06 Q1033' }
  };

  // airline radio telephony and codes at Newcastle (merged into the engine's tables)
  const TEL = { EZY: 'Easy', EJU: 'Alpine', RYR: 'Ryanair', EXS: 'Channex', TOM: 'Tomjet', BAW: 'Speedbird', KLM: 'KLM', HOP: 'Air Hop', UAE: 'Emirates',
    EIN: 'Shamrock', EWG: 'Eurowings', NSZ: 'Rednose', SXN: 'Saxonair', LOG: 'Logan', THY: 'Turkish', VLG: 'Vueling', AFR: 'Airfrans', DLH: 'Lufthansa' };
  const AIRLINE_ICAO = { U2: 'EZY', EC: 'EJU', FR: 'RYR', LS: 'EXS', BY: 'TOM', BA: 'BAW', KL: 'KLM', A5: 'HOP', EK: 'UAE', EA: 'EIN', EI: 'EIN', EW: 'EWG',
    D8: 'NSZ', SX: 'SXN', LM: 'LOG', TK: 'THY', VY: 'VLG', AF: 'AFR', LH: 'DLH' };
  const AIRLINE_TYPE = { EZY: 'A320', EJU: 'A320', RYR: 'B738', EXS: 'B738', TOM: 'B38M', BAW: 'A320', KLM: 'E195', HOP: 'E190', UAE: 'B77W', EIN: 'AT76',
    EWG: 'A320', NSZ: 'B738', SXN: 'C56X', LOG: 'E145', THY: 'A21N', VLG: 'A320', AFR: 'A320', DLH: 'A320' };
  // the stands each airline normally uses (vMATS ADC 2.9 stand allocation, after the airport's own plan): best first
  const STAND_OF = {
    BAW: ['3', '4'], EZY: ['4', '5', '6'], EJU: ['4', '5', '6'], RYR: ['4', '5', '6'], EWG: ['4', '5', '6'], LOG: ['1', '2'], EIN: ['1', '2'],
    EXS: ['6', '7', '8', '9', '10', '11', '12'], TOM: ['6', '7', '8', '9', '10', '11', '12'], KLM: ['10', '11', '12'], HOP: ['10', '11', '12'],
    AFR: ['10', '11', '12'], DLH: ['10', '11', '12'], VLG: ['10'], UAE: ['30'], THY: ['3', '4'], NSZ: ['13', '14', '15']
  };
  // the largest aircraft each stand takes (vMATS ADC 2.9, by type: DH8D 1-2; A319/737-700 15, 31; A320/737-800 6, 12, 13,
  // 25L, 25R; A321 3; 757 4, 5, 7, 8, 10, 11, 14, 18-23; 787-8 9, 16, 17, 24; 747/777/A330 25 and 30), wingspan m; the GA
  // Apron (AD 2.20 via vMATS ADC 1.10: over 16 m only on 53 and 54, taxiway F at most 27.5 m) and the Golf Apron (cargo)
  const STAND_SPAN = { 1: 29, 2: 29, 3: 36, 4: 39, 5: 39, 6: 36, 7: 39, 8: 39, 9: 61, 10: 39, 11: 39, 12: 36, 13: 36, 14: 39, 15: 36, 16: 61, 17: 61,
    18: 39, 19: 39, 20: 39, 21: 39, 22: 39, 23: 39, 24: 61, 25: 65, '25L': 36, '25R': 36, 30: 65, 31: 36, 50: 16, 51: 16, 52: 16, 53: 28, 54: 28,
    60: 39, 61: 39, 62: 39 };
  // stands laid over others (AD 2.20): 25 over 25L and 25R; 30 diagonally across 9, 31 diagonally across 1. Never both at once.
  const STAND_VACANT = { 25: ['25L', '25R'], 30: ['9'], 31: ['1'] };
  const TYPES = {
    B38M: { name: '737 MAX 8',     wake: 'M', vapp: 145, vr: 150, climb: 2400, desc: 2100, cruise: 290, span: 35.9, len: 39.5, shape: 'jet' },
    E190: { name: 'Embraer 190',   wake: 'M', vapp: 128, vr: 135, climb: 2500, desc: 2000, cruise: 280, span: 28.7, len: 36.2, shape: 'jet' },
    E195: { name: 'Embraer 195',   wake: 'M', vapp: 130, vr: 138, climb: 2400, desc: 2000, cruise: 280, span: 28.7, len: 38.7, shape: 'jet' },
    E295: { name: 'Embraer 195-E2', wake: 'M', vapp: 127, vr: 138, climb: 2400, desc: 2000, cruise: 280, span: 35.1, len: 41.5, shape: 'jet' },
    E145: { name: 'Embraer 145',   wake: 'M', vapp: 125, vr: 130, climb: 2400, desc: 2000, cruise: 270, span: 20.0, len: 29.9, shape: 'jet' },
    B77W: { name: '777-300ER',     wake: 'H', vapp: 149, vr: 160, climb: 1800, desc: 2000, cruise: 300, span: 64.8, len: 73.9, shape: 'jet' },
    B752: { name: '757-200',       wake: 'M', vapp: 135, vr: 145, climb: 2800, desc: 2200, cruise: 290, span: 38.1, len: 47.3, shape: 'jet' },
    B788: { name: '787-8',         wake: 'H', vapp: 145, vr: 155, climb: 2100, desc: 2000, cruise: 300, span: 60.1, len: 57.0, shape: 'jet' }
  };
  // Newcastle's flight boards give places by city name
  const PLACES = {
    'aberdeen': 'EGPD', 'agadir': 'GMAD', 'alicante': 'LEAL', 'amsterdam': 'EHAM', 'antalya': 'LTAI', 'barcelona': 'LEBL', 'belfast': 'EGAA',
    'belfast city': 'EGAC', 'berlin': 'EDDB', 'birmingham': 'EGBB', 'blackbushe': 'EGLK', 'bremen': 'EDDW', 'bristol': 'EGGD', 'brussels': 'EBBR',
    'budapest': 'LHBP', 'cardiff': 'EGFF', 'chania': 'LGSA', 'copenhagen': 'EKCH', 'corfu': 'LGKR', 'dalaman': 'LTBS', 'dubai': 'OMDB',
    'dublin': 'EIDW', 'dubrovnik': 'LDDU', 'duesseldorf': 'EDDL', 'dusseldorf': 'EDDL', 'enfidha': 'DTNH', 'exeter': 'EGTE', 'faro': 'LPFR',
    'frankfurt': 'EDDF', 'fuerteventura': 'GCFV', 'funchal': 'LPMA', 'gdansk': 'EPGD', 'geneva': 'LSGG', 'gran canaria': 'GCLP', 'hamburg': 'EDDH',
    'heraklion': 'LGIR', 'hurghada': 'HEGN', 'ibiza': 'LEIB', 'isle of man': 'EGNS', 'istanbul': 'LTFM', 'jersey': 'EGJJ', 'kos': 'LGKO',
    'krakow': 'EPKK', 'krakow/balice': 'EPKK', 'lanzarote': 'GCRR', 'larnaca': 'LCLK', 'lisbon': 'LPPT', 'london': 'EGLL', 'london heathrow': 'EGLL',
    'london gatwick': 'EGKK', 'london stansted': 'EGSS', 'malaga': 'LEMG', 'malta': 'LMML', 'menorca': 'LEMH', 'milan': 'LIMC', 'munich': 'EDDM',
    'naples': 'LIRN', 'nice': 'LFMN', 'oslo': 'ENGM', 'palma': 'LEPA', 'palma de mallorca': 'LEPA', 'paphos': 'LCPH', 'paris': 'LFPG', 'porto': 'LPPR',
    'prague': 'LKPR', 'reus': 'LERS', 'reykjavik': 'BIKF', 'rhodes': 'LGRP', 'riga': 'EVRA', 'rome': 'LIRF', 'salzburg': 'LOWS',
    'sharm el-sheikh': 'HESH', 'southampton': 'EGHI', 'split': 'LDSP', 'stavanger': 'ENZV', 'stockholm': 'ESSA', 'tenerife': 'GCTS',
    'venice': 'LIPZ', 'vienna': 'LOWW', 'vilnius': 'EYVI', 'warsaw': 'EPWA', 'wroclaw': 'EPWR', 'zakynthos': 'LGZA', 'zante': 'LGZA', 'zurich': 'LSZH'
  };
  const AIRPORTS = {
    EGNT: [55.0375, -1.6917, 'Newcastle'], EGNV: [54.5092, -1.4294, 'Teesside'], EGNM: [53.8659, -1.6606, 'Leeds Bradford'],
    EGPH: [55.9500, -3.3725, 'Edinburgh'], EGPF: [55.8719, -4.4331, 'Glasgow'], EGPD: [57.2019, -2.1978, 'Aberdeen'], EGPE: [57.5425, -4.0475, 'Inverness'],
    EGPA: [58.9578, -2.9050, 'Kirkwall'], EGPB: [59.8789, -1.2956, 'Sumburgh'], EGAA: [54.6575, -6.2158, 'Belfast'], EGAC: [54.6181, -5.8725, 'Belfast City'],
    EGNS: [54.0833, -4.6239, 'Isle of Man'], EIDW: [53.4213, -6.2701, 'Dublin'], EICK: [51.8413, -8.4911, 'Cork'], EINN: [52.7020, -8.9248, 'Shannon'],
    EGGD: [51.3827, -2.7191, 'Bristol'], EGHI: [50.9503, -1.3568, 'Southampton'], EGFF: [51.3967, -3.3433, 'Cardiff'], EGBB: [52.4539, -1.7480, 'Birmingham'],
    EGCC: [53.3537, -2.2750, 'Manchester'], EGTE: [50.7344, -3.4139, 'Exeter'], EGJJ: [49.2079, -2.1955, 'Jersey'], EGJB: [49.4350, -2.6019, 'Guernsey'],
    EGLL: [51.4700, -0.4543, 'London Heathrow'], EGKK: [51.1481, -0.1903, 'London Gatwick'], EGSS: [51.8850, 0.2350, 'London Stansted'],
    EGGW: [51.8747, -0.3683, 'London Luton'], EGLC: [51.5053, 0.0553, 'London City'], EGLK: [51.3239, -0.8475, 'Blackbushe'], EGLF: [51.2758, -0.7763, 'Farnborough'],
    EHAM: [52.3086, 4.7639, 'Amsterdam'], EBBR: [50.9014, 4.4844, 'Brussels'], EDDL: [51.2895, 6.7668, 'Düsseldorf'], EDDF: [50.0379, 8.5622, 'Frankfurt'],
    EDDM: [48.3538, 11.7861, 'Munich'], EDDB: [52.3667, 13.5033, 'Berlin'], EDDH: [53.6304, 9.9882, 'Hamburg'], EDDW: [53.0475, 8.7867, 'Bremen'],
    EKCH: [55.6181, 12.6561, 'Copenhagen'], ENGM: [60.1939, 11.1004, 'Oslo'], ENBR: [60.2934, 5.2181, 'Bergen'], ENZV: [58.8767, 5.6378, 'Stavanger'],
    ESSA: [59.6519, 17.9186, 'Stockholm'], LKPR: [50.1008, 14.2600, 'Prague'], LOWW: [48.1103, 16.5697, 'Vienna'], LOWS: [47.7933, 13.0043, 'Salzburg'],
    LHBP: [47.4298, 19.2611, 'Budapest'], EPKK: [50.0777, 19.7848, 'Kraków'], EPWR: [51.1027, 16.8858, 'Wrocław'], EPGD: [54.3776, 18.4662, 'Gdańsk'],
    EPWA: [52.1657, 20.9671, 'Warsaw'], EVRA: [56.9236, 23.9711, 'Riga'], EYVI: [54.6341, 25.2858, 'Vilnius'],
    LFPG: [49.0097, 2.5479, 'Paris CDG'], LFMN: [43.6584, 7.2159, 'Nice'], LSGG: [46.2381, 6.1090, 'Geneva'], LSZH: [47.4647, 8.5492, 'Zurich'],
    LIRF: [41.8003, 12.2389, 'Rome'], LIMC: [45.6306, 8.7281, 'Milan Malpensa'], LIME: [45.6739, 9.7042, 'Milan Bergamo'], LIRN: [40.8860, 14.2908, 'Naples'],
    LIPZ: [45.5053, 12.3519, 'Venice'], LMML: [35.8575, 14.4775, 'Malta'], LGAV: [37.9364, 23.9445, 'Athens'], LGKR: [39.6019, 19.9117, 'Corfu'],
    LGIR: [35.3397, 25.1803, 'Heraklion'], LGRP: [36.4054, 28.0862, 'Rhodes'], LGKO: [36.7933, 27.0917, 'Kos'], LGZA: [37.7509, 20.8843, 'Zakynthos'],
    LGSA: [35.5317, 24.1497, 'Chania'], LDDU: [42.5614, 18.2682, 'Dubrovnik'], LDSP: [43.5389, 16.2980, 'Split'], LTAI: [36.8987, 30.8005, 'Antalya'],
    LTBS: [36.7131, 28.7925, 'Dalaman'], LTFE: [37.2506, 27.6643, 'Bodrum'], LTFM: [41.2753, 28.7519, 'Istanbul'], LCLK: [34.8751, 33.6249, 'Larnaca'],
    LCPH: [34.7180, 32.4857, 'Paphos'], HEGN: [27.1783, 33.7994, 'Hurghada'], HESH: [27.9773, 34.3950, 'Sharm el-Sheikh'], DTNH: [36.0758, 10.4386, 'Enfidha'],
    OMDB: [25.2528, 55.3644, 'Dubai'], LEAL: [38.2822, -0.5582, 'Alicante'], LEMG: [36.6749, -4.4991, 'Málaga'], LEPA: [39.5517, 2.7388, 'Palma'],
    LEBL: [41.2971, 2.0785, 'Barcelona'], LEIB: [38.8729, 1.3731, 'Ibiza'], LEMH: [39.8626, 4.2186, 'Menorca'], LERS: [41.1474, 1.1672, 'Reus'],
    LEMD: [40.4983, -3.5676, 'Madrid'], LPFR: [37.0144, -7.9659, 'Faro'], LPPT: [38.7742, -9.1342, 'Lisbon'], LPPR: [41.2481, -8.6814, 'Porto'],
    LPMA: [32.6942, -16.7781, 'Funchal'], GCTS: [28.0445, -16.5725, 'Tenerife South'], GCRR: [28.9455, -13.6052, 'Lanzarote'],
    GCLP: [27.9319, -15.3866, 'Gran Canaria'], GCFV: [28.4527, -13.8638, 'Fuerteventura'], GMAD: [30.3250, -9.4131, 'Agadir'],
    BIKF: [63.9850, -22.6056, 'Reykjavík Keflavík'], KJFK: [40.6399, -73.7789, 'New York JFK']
  };

  return {
    icao: 'EGNT', iata: 'NCL', name: 'Newcastle', city: 'Newcastle upon Tyne', country: 'United Kingdom', arp: P('550217N', '0014123W'), elev: 266,
    FIX, NAV, RWY, STARS, TRANS, IAF_N, HOLDS_AIR, ILS, SIDS, DEP_ROUTES, DEP_ALT, DEP_ALT_LOW, DIR, PLACE_DIR, dirFor, UNITS, CTR, TA, TZ, ALTERNATES,
    TIMETABLE, LONG_STAY, EXTRA, EXERCISES, WX_PRESETS, TEL, AIRLINE_ICAO, AIRLINE_TYPE, STAND_OF, STAND_SPAN, STAND_VACANT, TYPES, PLACES, AIRPORTS,
    data: { metar: 'egnt/metar.txt', flights: 'egnt/flights.json' },
    features: { roadCrossing: false, sra: false, ils: true, rnavSids: true, singleRunway: true, mixedMode: true }
  };
})();
if (typeof module !== 'undefined') module.exports = EGNT;
