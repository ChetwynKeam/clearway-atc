// ═════════════════════════ London City (EGLC) airport profile ═════════════════════════
// Everything the Clearway engine needs to know that is true only of London City. Sources: UK AIP AD 2 EGLC charts
// (aerodrome and parking 2-1/2-2, RNAV1 SIDs 6-1..6-8, RNAV5 STARs 7-1..7-14, RNAV1 approach transitions 7-15..7-18,
// RNAV holds 7-19, ILS/DME 5.5° approaches 8-1..8-6) and OpenStreetMap for the taxiway centrelines.
// Positions are lat/lon (WGS84); bearings are TRUE unless named "mag" (variation 1.4°E in 2027: magnetic = true - 1.4).
// Summary of the source charts: airports/eglc/README.md. eglc-engine.js turns this into the engine's globals.

const EGLC = (() => {
  const ll = (s) => {                                     // '513014.67N' / '0000529.91E' → decimal degrees
    const m = s.match(/^(\d{2,3})(\d{2})(\d{2}(?:\.\d+)?)([NSEW])$/);
    const v = +m[1] + m[2]/60 + m[3]/3600; return /[SW]/.test(m[4]) ? -v : v;
  };
  const P = (lat, lon) => [ll(lat), ll(lon)];

  // ── fixes (SID, STAR, transition and hold coding tables)
  const FIX = {
    // SIDs (6-1..6-8)
    LCE01: P('513014.67N', '0000529.91E'), LCE02: P('513316.42N', '0000950.44E'), LCE03: P('513346.90N', '0001436.66E'),
    LCE04: P('513619.70N', '0001222.73E'), LCW01: P('513024.40N', '0000020.78E'), LCN01: P('513332.44N', '0000109.21W'),
    LCN02: P('513408.09N', '0000016.11W'), LCN03: P('513448.85N', '0000347.24E'), LCN04: P('513436.75N', '0000056.79E'),
    LCN05: P('513538.42N', '0000257.77E'), LCN06: P('513608.68N', '0001118.82E'), SOQQA: P('513623.75N', '0002328.43E'),
    ODUKU: P('513531.78N', '0001715.47E'), BPK: P('514459.05N', '0000624.25W'), SAXBI: P('514504.03N', '0001113.77W'),
    // STARs (7-9..7-14)
    SUMUM: P('513814.25N', '0020627.77E'), XAMAN: P('514704.77N', '0021326.94E'), LOGAN: P('514451.32N', '0013642.58E'),
    JACKO: P('514408.65N', '0012536.00E'), GODLU: P('510958.44N', '0011704.26E'), KONAN: P('510750.75N', '0020000.00E'),
    SOVAT: P('504645.67N', '0012800.00E'), ERKEX: P('505240.62N', '0011936.96E'), OKVAP: P('505748.96N', '0011955.98E'),
    TEVMO: P('511024.94N', '0012459.14E'), HON: P('522124.04N', '0013949.41W'), LISTO: P('530835.93N', '0021156.54W'),
    PEDIG: P('524447.59N', '0014309.97W'), ROGBI: P('521746.63N', '0012006.37W'), TIXEX: P('520748.00N', '0010043.20W'),
    ODVOD: P('520755.98N', '0000852.98E'), ROPMU: P('520614.46N', '0002917.16E'), NUDNA: P('520354.90N', '0005016.56E'),
    INLIM: P('515422.98N', '0011912.90E'), KATHY: P('503113.59N', '0012000.23W'), SAM: P('505718.90N', '0012042.20W'),
    BIDVA: P('504338.76N', '0005839.48W'), EVEXU: P('504115.78N', '0003440.86W'), SOXUX: P('503546.32N', '0005545.48E'),
    AVANT: P('504912.00N', '0005618.05W'), NEVIL: P('500000.00N', '0002205.64W'), OSPOL: P('500900.00N', '0001107.84W'),
    NETVU: P('502445.00N', '0002854.00E'), SIRIC: P('512036.17N', '0013358.89W'), BIG: P('511951.15N', '0000205.32E'),
    UMTUM: P('511227.30N', '0010102.78E'), SILVA: P('515051.34N', '0010019.40W'), BOMBO: P('515944.29N', '0002346.85W'),
    BKY: P('515923.17N', '0000342.87E'), BRAIN: P('514839.91N', '0003906.00E'), CLN: P('515054.50N', '0010851.32E'),
    // approach transitions (7-15..7-18): LAVNO 1G/1J to runway 27, ODLEG 1G/1J to runway 09
    NONVA: P('513846.45N', '0012144.31E'), BABKU: P('513519.59N', '0011916.23E'), LCE21: P('513006.82N', '0012130.07E'),
    LCE22: P('512443.87N', '0012054.73E'), LCE23: P('511945.28N', '0011734.94E'), ELMIV: P('512033.08N', '0011533.36E'),
    LCE11: P('512504.57N', '0011834.81E'), LCE12: P('512958.17N', '0011906.68E'), LCE13: P('513442.46N', '0011704.79E'),
    RAVSA: P('512829.01N', '0005513.72E'), GAPGI: P('512844.89N', '0004820.99E'), ATPEV: P('512918.05N', '0003322.74E'),
    LCE07: P('512929.22N', '0002807.69E'), TOPDU: P('512945.72N', '0002009.82E'), LAVNO: P('512959.14N', '0001329.17E'),
    OSVEV: P('512549.36N', '0001808.59E'), LCS01: P('512603.37N', '0001109.39E'), LCS02: P('512619.24N', '0000259.13E'),
    TODBI: P('512636.35N', '0000611.78W'), ODLEG: P('512925.35N', '0000716.56W')
  };
  const NAV = {
    LCY: { name: 'London City NDB(L)', freq: '322.0', p: P('513015.66N', '0000403.01E') },
    LST: { name: 'I-LST ILS/DME 09', freq: '111.15', ch: '48Y', p: P('513017.44N', '0000403.03E') },
    LSR: { name: 'I-LSR ILS/DME 27', freq: '111.15', ch: '48Y', p: P('513020.30N', '0000231.79E') },
    LON: { name: 'London DVOR/DME', freq: '113.60', ch: '83X', p: P('512914.00N', '0002800.00W') }
  };

  // ── runway (AD 2-EGLC-2-1): 1508 × 30 m grooved asphalt, magnetic 091°/271° (2026), arrestor beds at both ends
  const RWY = {
    lo: '09', hi: '27', magHdg: { '09': 91, '27': 271 }, var: 1.4,
    thr: { '09': P('513020.06N', '0000239.58E'), '27': P('513017.60N', '0000357.68E') },
    elev: { '09': 19, '27': 20 }, length: 1508, width: 30,
    papi: { '09': 'PAPI 5.5°, MEHT 49 ft', '27': 'PAPI 5.5°, MEHT 49 ft' },
    gs: 5.5, rdh: 35
  };

  // ── stands (AD 2-EGLC-2-2). Main apron 3-15 (10L not yet surveyed) numbered from the east, East apron 21-28.
  // All nose-in onto taxiway Tango's apron edge; the jet centre (GA apron) is west of the fire station.
  const STANDS = [
    ['15', '513018.02N', '0000226.95E'], ['14', '513016.97N', '0000232.94E'], ['13', '513016.91N', '0000234.88E'], ['12', '513016.74N', '0000237.02E'],
    ['10', '513016.66N', '0000239.60E'], ['9', '513016.34N', '0000241.82E'], ['8', '513016.27N', '0000244.07E'], ['7', '513016.20N', '0000246.32E'],
    ['6', '513016.13N', '0000248.58E'], ['5', '513016.06N', '0000250.83E'], ['4', '513015.99N', '0000253.08E'], ['3', '513015.89N', '0000255.30E'],
    ['21', '513015.29N', '0000302.23E'], ['22', '513015.20N', '0000304.68E'], ['23', '513015.13N', '0000307.14E'], ['24', '513015.05N', '0000309.60E'],
    ['25', '513015.01N', '0000312.21E'], ['26', '513014.93N', '0000314.68E'], ['27', '513014.85N', '0000317.13E'], ['28', '513014.78N', '0000319.59E']
  ].map(([id, la, lo]) => ({ id, p: P(la, lo), area: +id > 20 ? 'east' : +id > 11 ? 'west' : 'main' }));

  // ── STARs (7-1..7-14), RNAV5. London Control brings arrivals down to the JACKO (north and east) or GODLU (south)
  // holds; Thames Director takes them from there. Alt = level constraint at the fix (feet).
  const STARS = {
    'LISTO 1C': { from: 'N',  pts: [['LISTO'], ['PEDIG'], ['ROGBI'], ['TIXEX'], ['ODVOD', 22000], ['ROPMU'], ['NUDNA'], ['INLIM', 12000], ['JACKO', 9000]] },
    'HON 1C':   { from: 'W',  pts: [['HON'], ['ROGBI', 20000], ['TIXEX'], ['ODVOD'], ['ROPMU'], ['NUDNA'], ['INLIM', 12000], ['JACKO', 9000]] },
    'SILVA 1C': { from: 'NW', pts: [['SILVA'], ['BOMBO'], ['BKY'], ['BRAIN'], ['CLN'], ['JACKO', 9000]] },
    'XAMAN 1C': { from: 'NE', pts: [['XAMAN'], ['LOGAN'], ['JACKO', 9000]] },
    'SUMUM 1C': { from: 'E',  pts: [['SUMUM'], ['LOGAN'], ['JACKO', 9000]] },
    'KONAN 1C': { from: 'SE', pts: [['KONAN'], ['GODLU', 10000]] },
    'SOVAT 1C': { from: 'S',  pts: [['SOVAT'], ['ERKEX'], ['OKVAP'], ['GODLU', 10000]] },
    'NEVIL 1C': { from: 'SW', pts: [['NEVIL', 22000], ['OSPOL'], ['NETVU', 14000], ['SOXUX'], ['OKVAP'], ['GODLU', 10000]] },
    'KATHY 1C': { from: 'CI', pts: [['KATHY'], ['BIDVA', 13000], ['EVEXU'], ['SOXUX'], ['OKVAP'], ['GODLU', 10000]] },
    'SAM 1C':   { from: 'CI', pts: [['SAM'], ['BIDVA', 13000], ['EVEXU'], ['SOXUX'], ['OKVAP'], ['GODLU', 10000]] },
    'AVANT 1C': { from: 'W',  pts: [['AVANT', 19000], ['BIG', 16000], ['UMTUM'], ['GODLU', 10000]] },
    'SIRIC 1C': { from: 'W',  pts: [['SIRIC', 18000], ['BIG', 16000], ['UMTUM'], ['GODLU', 10000]] },
    'XAMAN 1X': { from: 'NE', pts: [['XAMAN'], ['TEVMO'], ['GODLU', 10000]] },
    'SUMUM 1X': { from: 'E',  pts: [['SUMUM'], ['TEVMO'], ['GODLU', 10000]] }
  };
  // RNAV1 approach transitions from the holds (7-15..7-18). The published routes swing round an arc (LCE21-23 or
  // LCE11-13) so Thames can stretch or shorten them; the shortest published path cuts straight to RAVSA, used here.
  const TRANS = {
    'LAVNO 1J': { rwy: '27', from: 'JACKO', pts: [['NONVA'], ['BABKU'], ['RAVSA', 6000], ['GAPGI', 6000], ['ATPEV'], ['LCE07', 4000], ['TOPDU'], ['LAVNO', 3000]], arc: ['LCE21', 'LCE22', 'LCE23'] },
    'LAVNO 1G': { rwy: '27', from: 'GODLU', pts: [['ELMIV'], ['RAVSA', 6000], ['GAPGI', 6000], ['ATPEV'], ['LCE07', 4000], ['TOPDU'], ['LAVNO', 3000]], arc: ['LCE11', 'LCE12', 'LCE13'] },
    'ODLEG 1J': { rwy: '09', from: 'JACKO', pts: [['NONVA'], ['BABKU'], ['RAVSA', 6000], ['GAPGI', 6000], ['ATPEV'], ['LCE07', 4000], ['OSVEV', 3000], ['LCS01', 3000], ['LCS02', 2000], ['TODBI', 2000], ['ODLEG']], arc: ['LCE21', 'LCE22', 'LCE23'] },
    'ODLEG 1G': { rwy: '09', from: 'GODLU', pts: [['ELMIV'], ['RAVSA', 6000], ['GAPGI', 6000], ['ATPEV'], ['LCE07', 4000], ['OSVEV', 3000], ['LCS01', 3000], ['LCS02', 2000], ['TODBI', 2000], ['ODLEG']], arc: ['LCE11', 'LCE12', 'LCE13'] }
  };
  // RNAV holds (7-19 and the transition charts): inbound track true, turn, levels
  const HOLDS_AIR = {
    JACKO: { inb: 265.7, turn: 'L', min: 8000, max: 14000, maxKt: 210 },
    GODLU: { inb: 311.4, turn: 'R', min: 8000, max: 12000, maxKt: 210 },
    ATPEV: { inb: 274.9, turn: 'L', min: 4000, max: 6000, maxKt: 185, note: 'Thames hold over the estuary ("ATPEV left hand"; a right-hand twin also exists)' },
    LCY:   { inb: 273.4, turn: 'L', min: 2000, max: 3000, maxKt: 185, note: 'missed approach hold over the NDB' }
  };

  // ── SIDs (6-1..6-8), RNAV1. All climb to 3000 ft (airspace: the London TMA sits on top), max 210 kt (BPK/SAXBI 200)
  // to the first turn. 09: straight ahead to LCE01, no turns below 570 ft. 27: straight ahead to LCW01, no turns below
  // 1102 ft. Climb gradients 8.0% (09) / 7.2% (27) for the obstacles, Canary Wharf above all.
  const SIDS = {
    '09': {
      init: { fix: 'LCE01', turnAt: 570, note: 'straight ahead to LCE01; no turns below 570 ft' },
      'SOQQA 1H': { pts: [['LCE01'], ['LCE02', 3000], ['LCE03', 3000], ['SOQQA', 3000]] },
      'ODUKU 1H': { pts: [['LCE01'], ['LCE02', 3000], ['ODUKU', 3000]] },
      'BPK 1H':   { pts: [['LCE01'], ['LCN03', 3000], ['BPK', 3000]] },
      'SAXBI 1H': { pts: [['LCE01'], ['LCN03', 3000], ['BPK', 3000], ['SAXBI', 3000]] }
    },
    '27': {
      init: { fix: 'LCW01', turnAt: 1102, note: 'straight ahead to LCW01; no turns below 1102 ft' },
      'SOQQA 1A': { pts: [['LCW01'], ['LCN02', 3000], ['LCN06', 3000], ['SOQQA', 3000]] },
      'ODUKU 1A': { pts: [['LCW01'], ['LCN02', 3000], ['LCE04', 3000], ['ODUKU', 3000]] },
      'BPK 1A':   { pts: [['LCW01'], ['LCN01'], ['LCN04', 3000], ['LCN05', 3000], ['BPK', 3000]] },
      'SAXBI 1A': { pts: [['LCW01'], ['LCN01'], ['LCN04', 3000], ['LCN05', 3000], ['BPK', 3000], ['SAXBI', 3000]] }
    }
  };
  // airway directions: departure SID (exit) and arrival STAR for each
  const DIR = {
    N:  { sid: 'BPK',   star: 'LISTO 1C', hold: 'JACKO', name: 'Scotland and the north' },
    W:  { sid: 'SAXBI', star: 'HON 1C',   hold: 'JACKO', name: 'Ireland and the west' },
    NE: { sid: 'SOQQA', star: 'XAMAN 1C', hold: 'JACKO', name: 'Scandinavia and north Germany' },
    E:  { sid: 'SOQQA', star: 'SUMUM 1C', hold: 'JACKO', name: 'the Netherlands' },
    SE: { sid: 'ODUKU', star: 'KONAN 1C', hold: 'GODLU', name: 'Belgium, Luxembourg and Germany' },
    S:  { sid: 'ODUKU', star: 'SOVAT 1C', hold: 'GODLU', name: 'France, Switzerland and Italy' },
    SW: { sid: 'ODUKU', star: 'NEVIL 1C', hold: 'GODLU', name: 'Spain and Portugal' },
    CI: { sid: 'SAXBI', star: 'KATHY 1C', hold: 'GODLU', name: 'the Channel Islands' }
  };
  // where each gate's STAR is picked up inside the simulator's area (about 50-80 NM out; the northern STARs join at INLIM,
  // after London Control has brought them round the north of the TMA)
  const DIR_ENTRY = { N: 'INLIM', W: 'INLIM', NE: 'XAMAN', E: 'SUMUM', SE: 'KONAN', S: 'SOVAT', SW: 'NETVU', CI: 'BIDVA' };
  const PLACE_DIR = {
    EGPH: 'N', EGPF: 'N', EGPD: 'N', EGPE: 'N', EGAC: 'N', EGAA: 'N', EGNS: 'N', EGNT: 'N', EGNM: 'N', EGCC: 'N', EGPN: 'N',
    EIDW: 'W', EICK: 'W', EINN: 'W', EGFF: 'W', EGGD: 'W', EGHQ: 'W', EGTE: 'W',
    EKCH: 'NE', ESSA: 'NE', ENGM: 'NE', EFHK: 'NE', EDDH: 'NE', EDDB: 'NE', EKBI: 'NE',
    EHAM: 'E', EHRD: 'E', EHEH: 'E', EDDL: 'E', EDDK: 'E',
    EBBR: 'SE', EBAW: 'SE', ELLX: 'SE', EDDF: 'SE', EDDM: 'SE', EDDS: 'SE', LOWW: 'SE', LKPR: 'SE',
    LSZH: 'S', LSGG: 'S', LFPG: 'S', LFPB: 'S', LFPO: 'S', LFMN: 'S', LFLL: 'S', LIML: 'S', LIMC: 'S', LIRQ: 'S', LIRF: 'S', LIPB: 'S', LIPZ: 'S', LFKJ: 'S', LFLB: 'S',
    LEMD: 'SW', LESO: 'SW', LEBL: 'SW', LEPA: 'SW', LEIB: 'SW', LEMG: 'SW', LPPT: 'SW', LPFR: 'SW', LEMH: 'SW', LFBD: 'SW', LXGB: 'SW', LPMA: 'SW',
    EGJJ: 'CI', EGJB: 'CI', EGHI: 'CI', EGHH: 'CI'
  };
  const dirFor = icao => DIR[PLACE_DIR[icao] || 'S'];

  // ── ILS/DME approaches (8-1, 8-4): 5.5° glidepath (585 ft/NM), only for aircraft certified for steep approaches.
  // 27: established on the localiser by I-LSR 6 DME at 3000 ft, glidepath from about 5 DME. 09: on the localiser by
  // I-LST 4.9 DME at 2000 ft, glidepath from 3.4 DME. DME zero-ranged to each threshold.
  const APPROACHES = {
    'ILS 27': { rwy: '27', type: 'ILS', spoken: 'ILS approach runway two seven', gs: 5.5, faf: { dme: 5, alt: 3000 }, loc: 'I-LSR',
      profile: [[3.4, 2000], [3.0, 1820], [2.0, 1230], [1.0, 650]], minima: { da: 440, vis: 1000, ceil: 300 },
      missed: { text: 'climb straight ahead 2000 ft; at I-LSR 5.6 DME turn right, back to the LCY NDB', alt: 2000, turnAt: 5.6, turn: 'R', fix: 'LCY' } },
    'ILS 09': { rwy: '09', type: 'ILS', spoken: 'ILS approach runway zero niner', gs: 5.5, faf: { dme: 3.4, alt: 2000 }, loc: 'I-LST',
      profile: [[3.4, 2000], [3.0, 1810], [2.0, 1230], [1.0, 640]], minima: { da: 440, vis: 1000, ceil: 300 },
      missed: { text: 'climb straight ahead 2000 ft; at I-LST 5.6 DME turn left, back to the LCY NDB', alt: 2000, turnAt: 5.6, turn: 'L', fix: 'LCY' } }
  };

  // ── airspace (2-EGLC chart notes and the SID/STAR charts)
  // R160 central London, SFC-UNL, traced off SID chart 6-1 (good to about 0.2 NM). R159 (Isle of Dogs) and R157/R158
  // (Hyde Park, City of London) are SFC-1400 ft; aircraft on City's own procedures are exempt, so only R160 is scored.
  const R160 = [[51.50535, -0.26287], [51.5892, -0.21534], [51.56809, -0.13717], [51.57815, -0.0484], [51.53179, -0.00825], [51.45198, -0.00656],
    [51.46348, -0.09074], [51.43532, -0.1862], [51.49794, -0.21411]];
  const R159 = [[51.49915, 0.00011], [51.4971, 0.00066], [51.49243, -0.00707], [51.49493, -0.01316], [51.50639, -0.02376], [51.51194, -0.02623],
    [51.52026, -0.01242], [51.51585, -0.00161], [51.50378, -0.00292]];
  // Canary Wharf: the tall towers 2-3 NM west of runway 09 (One Canada Square 771 ft amsl) that make the 5.5° slope
  const TOWERS = [[51.5096, -0.0275], [51.5097, -0.0130], [51.4990, -0.0110], [51.4985, -0.0285]];
  const OBST = [['One Canada Square', 51.5049, -0.0195, 771], ['Landmark Pinnacle', 51.5017, -0.0247, 764], ['8 Canada Square', 51.5052, -0.0167, 653],
    ['The Shard', 51.5045, -0.0865, 1016], ['22 Bishopsgate', 51.5143, -0.0825, 912], ['Crystal Palace mast', 51.4243, -0.0742, 1000]];
  const TMA_NM = 60, TA = 6000;
  const UNITS = {
    app: { name: 'Thames Director', freq: '132.700', alt: ['128.025', '133.455'] }, twr: { name: 'City Tower', freq: '118.080', alt: ['129.455'] },
    gnd: { name: 'City Ground', freq: '121.830' }, atis: { name: 'City Information', freq: '136.355' }, fire: { name: 'City Fire', freq: '121.600' },
    heathrow: { name: 'Heathrow Radar', freq: '125.625' }
  };
  // departures need a release; Thames hands them to London Control (TC) climbing out of 3000 ft. TC frequencies are
  // representative (not in the AD 2 charts).
  const NEXT = { BPK: ['London Control', '121.230'], SAXBI: ['London Control', '121.230'], SOQQA: ['London Control', '118.825'], ODUKU: ['London Control', '118.825'] };
  const TZ = 'Europe/London';
  const ALTERNATES = [['Southend', 'EGMC', 'RAVSA'], ['Stansted', 'EGSS', 'BPK'], ['Luton', 'EGGW', 'BPK']];
  // opening hours (local): Mon-Fri 06:30-22:30, Sat 06:30-12:30, Sun 12:30-22:30. The timetable respects them.
  const HOURS = { weekday: ['06:30', '22:30'], sat: ['06:30', '12:30'], sun: ['12:30', '22:30'] };

  // ── traffic. Weekly summer pattern, times UTC (local is UTC+1 in summer). Operators are the real ones serving
  // London City; flight numbers and times are representative, not a published timetable. Only types cleared for the
  // 5.5° approach: Embraer E190/E195-E2, A220-100, Dash 8-400, ATR 72 and business jets.
  // [arrival cs, from, landing, departure cs, to, off-blocks, type, days (1 = Monday), stand hint]
  const WK = '12345', WK6 = '123456', WK7 = '123457', ALL = '1234567';
  const TIMETABLE = [
    // the first wave: aircraft that night-stopped at City
    [null, null, null, 'CFE8701', 'EGPH', '05:35', 'E190', WK6, '5'],
    [null, null, null, 'CFE8721', 'EIDW', '05:40', 'E190', WK6, '6'],
    [null, null, null, 'CFE8761', 'EHAM', '05:45', 'E190', WK, '7'],
    [null, null, null, 'CFE8781', 'LSZH', '05:50', 'E190', WK, '8'],
    [null, null, null, 'CFE8731', 'EGPF', '05:55', 'E190', WK, '9'],
    [null, null, null, 'LGL4592', 'ELLX', '06:00', 'DH8D', WK6, '22'],
    [null, null, null, 'EAI3201', 'EIDW', '06:05', 'AT76', WK6, '23'],
    // through the day
    ['KLC981',  'EHAM', '06:10', 'KLC982',  'EHAM', '06:45', 'E295', WK6, '3'],
    ['SWR456',  'LSZH', '06:30', 'SWR457',  'LSZH', '07:10', 'BCS1', WK6, '21'],
    ['CFE8702', 'EGPH', '07:05', 'CFE8703', 'EGPH', '07:40', 'E190', WK, '5'],
    ['DLH922',  'EDDF', '07:15', 'DLH923',  'EDDF', '07:55', 'E190', WK6, '4'],
    ['CFE8722', 'EIDW', '07:20', 'CFE8723', 'EIDW', '07:55', 'E190', WK, '6'],
    ['LOG57',   'EGNS', '07:35', 'LOG58',   'EGNS', '08:10', 'AT76', '135', '24'],
    ['CFE8762', 'EHAM', '07:50', 'CFE8763', 'EHAM', '08:25', 'E190', WK, '7'],
    ['KLC983',  'EHAM', '08:05', 'KLC984',  'EHAM', '08:40', 'E295', WK6, '3'],
    ['CFE8782', 'LSZH', '08:35', 'CFE8783', 'LSZH', '09:10', 'E190', WK, '8'],
    ['LGL4593', 'ELLX', '08:40', 'LGL4594', 'ELLX', '09:15', 'E295', WK, '22'],
    ['AUR681',  'EGJB', '08:55', 'AUR682',  'EGJB', '09:30', 'AT76', WK6, '25'],
    ['CFE8732', 'EGPF', '09:10', 'CFE8733', 'EGPF', '09:45', 'E190', WK, '9'],
    ['SWR458',  'LSGG', '09:30', 'SWR459',  'LSGG', '10:10', 'BCS1', WK6, '21'],
    ['CFE8741', 'LIML', '10:05', 'CFE8742', 'LIML', '10:45', 'E190', '1357', '10'],
    ['EAI3202', 'EIDW', '10:15', 'EAI3203', 'EIDW', '10:50', 'AT76', ALL, '23'],
    ['CFE8791', 'LFMN', '10:40', 'CFE8792', 'LFMN', '11:20', 'E190', '24567', '4'],
    ['KLC985',  'EHAM', '11:05', 'KLC986',  'EHAM', '11:40', 'E295', ALL, '3'],
    ['BCI871',  'EGJJ', '11:20', 'BCI872',  'EGJJ', '11:55', 'AT76', '1357', '24'],
    // Saturday closes at 12:30 local; Sunday opens at 12:30 local
    ['CFE8704', 'EGPH', '12:05', 'CFE8705', 'EGPH', '12:40', 'E190', WK7, '5'],
    ['DLH924',  'EDDF', '12:20', 'DLH925',  'EDDF', '13:00', 'E190', WK7, '6'],
    ['CFE8751', 'LEPA', '12:35', 'CFE8752', 'LEPA', '13:20', 'E190', '57', '7'],
    ['SWR460',  'LSZH', '13:00', 'SWR461',  'LSZH', '13:40', 'BCS1', WK7, '21'],
    ['CFE8724', 'EIDW', '13:25', 'CFE8725', 'EIDW', '14:00', 'E190', WK7, '8'],
    ['LGL4595', 'ELLX', '13:40', 'LGL4596', 'ELLX', '14:15', 'DH8D', WK7, '22'],
    ['KLC987',  'EHAM', '14:05', 'KLC988',  'EHAM', '14:40', 'E295', WK7, '3'],
    ['CFE8771', 'LIRQ', '14:25', 'CFE8772', 'LIRQ', '15:05', 'E190', '1467', '9'],
    ['CFE8734', 'EGPF', '14:50', 'CFE8735', 'EGPF', '15:25', 'E190', WK7, '10'],
    ['EAI3204', 'EIDW', '15:15', 'EAI3205', 'EIDW', '15:50', 'AT76', WK7, '23'],
    ['CFE8764', 'EHAM', '15:40', 'CFE8765', 'EHAM', '16:15', 'E190', WK7, '7'],
    ['AUR683',  'EGJB', '15:55', 'AUR684',  'EGJB', '16:30', 'AT76', WK7, '25'],
    ['CFE8784', 'LSZH', '16:20', 'CFE8785', 'LSZH', '16:55', 'E190', WK7, '8'],
    ['DLH926',  'EDDF', '16:35', 'DLH927',  'EDDF', '17:15', 'E190', WK7, '4'],
    ['KLC989',  'EHAM', '16:50', 'KLC990',  'EHAM', '17:25', 'E295', WK7, '3'],
    ['SWR462',  'LSGG', '17:10', 'SWR463',  'LSGG', '17:50', 'BCS1', WK7, '21'],
    ['CFE8706', 'EGPH', '17:30', 'CFE8707', 'EGPH', '18:05', 'E190', WK7, '5'],
    ['LOG59',   'EGNS', '17:45', 'LOG60',   'EGNS', '18:20', 'AT76', '135', '24'],
    ['CFE8726', 'EIDW', '18:05', 'CFE8727', 'EIDW', '18:40', 'E190', WK7, '6'],
    ['LGL4597', 'ELLX', '18:25', 'LGL4598', 'ELLX', '19:00', 'E295', WK7, '22'],
    ['CFE8736', 'EGPF', '18:50', 'CFE8737', 'EGPF', '19:25', 'E190', WK7, '9'],
    ['KLC991',  'EHAM', '19:15', 'KLC992',  'EHAM', '19:50', 'E295', WK7, '3'],
    ['SWR464',  'LSZH', '19:40', 'SWR465',  'LSZH', '20:20', 'BCS1', WK7, '21'],
    // the last wave: aircraft that night-stop at City
    ['CFE8708', 'EGPH', '20:05', null, null, null, 'E190', WK7, '5'],
    ['CFE8728', 'EIDW', '20:20', null, null, null, 'E190', WK7, '6'],
    ['CFE8766', 'EHAM', '20:35', null, null, null, 'E190', WK7, '7'],
    ['CFE8786', 'LSZH', '20:50', null, null, null, 'E190', WK7, '8'],
    ['CFE8738', 'EGPF', '21:05', null, null, null, 'E190', WK7, '9'],
    ['LGL4599', 'ELLX', '21:10', null, null, null, 'DH8D', WK7, '22'],
    ['EAI3206', 'EIDW', '21:20', null, null, null, 'AT76', WK7, '23'],
    // business aviation at the jet centre
    ['VJT144',  'LFMN', '08:20', 'VJT145',  'LFMN', '12:00', 'CL35', '25', '14'],
    ['NJE62Y',  'LSGG', '09:45', 'NJE63Y',  'LSGG', '17:30', 'E55P', '14', '15'],
    [null, null, null, 'GLCYJ', 'LFPB', '07:30', 'FA7X', '3', '14'],
    ['GXLSM', 'EGJJ', '16:10', null, null, null, 'C56X', '5', '15']
  ];
  const LONG_STAY = [['GPCLC', 'PC12', '12', '1234567'], ['GFLXY', 'E55P', '13', '1357']];
  const EXTRA = [
    { cs: 'CFE8743', t: 'E190', k: 'ARR', o: 'LIML' }, { cs: 'KLC993', t: 'E295', k: 'DEP', d: 'EHAM' },
    { cs: 'SWR466', t: 'BCS1', k: 'ARR', o: 'LSZH' }, { cs: 'CFE8753', t: 'E190', k: 'DEP', d: 'LEIB' },
    { cs: 'EAI3207', t: 'AT76', k: 'ARR', o: 'EIDW' }, { cs: 'LGL4600', t: 'E295', k: 'DEP', d: 'ELLX' },
    { cs: 'AUR685', t: 'AT76', k: 'ARR', o: 'EGJB' }, { cs: 'VJT221', t: 'CL35', k: 'DEP', d: 'LSGG' },
    { cs: 'NJE81K', t: 'E55P', k: 'ARR', o: 'EBBR' }, { cs: 'DLH928', t: 'E190', k: 'DEP', d: 'EDDF' }
  ];
  const EXERCISES = {
    dep: { name: 'London City 1 · First departure', wx: 'sw', rwy: '27', sched: [{ cs: 'CFE8703', t: 'E190', k: 'DEP', d: 'EGPH', m: 0, stand: '5' }] },
    arr: { name: 'London City 2 · The steep approach', wx: 'sw', rwy: '27', sched: [{ cs: 'KLC983', t: 'E295', k: 'ARR', o: 'EHAM', m: 0 }] },
    east: { name: 'London City 3 · Easterly: runway 09 over Canary Wharf', wx: 'east', rwy: '09', sched: [{ cs: 'SWR458', t: 'BCS1', k: 'ARR', o: 'LSGG', m: 0 }, { cs: 'CFE8723', t: 'E190', k: 'DEP', d: 'EIDW', m: 0, stand: '6' }] }
  };
  const WX_PRESETS = {
    sw:    { name: 'South-westerly, runway 27',                         short: 'South-west', metar: 'EGLC 041850Z 23011KT 9999 FEW030 SCT045 17/10 Q1014' },
    east:  { name: 'Easterly: runway 09, the approach over Canary Wharf', short: 'Easterly',  metar: 'EGLC 041850Z 08013KT 9999 SCT028 14/07 Q1026' },
    low:   { name: 'Low cloud and drizzle, ILS to minima',              short: 'Low cloud',   metar: 'EGLC 041850Z 24009KT 4000 -DZ BR OVC004 13/12 Q1009' },
    fog:   { name: 'Thames fog: below the approach ban',                short: 'Fog',         metar: 'EGLC 041850Z 00000KT 0400 FG VV002 09/09 Q1029' },
    storm: { name: 'Atlantic storm: gusty crosswind over the docks',    short: 'Storm',       metar: 'EGLC 041850Z 20027G41KT 9999 -RA BKN014 15/12 Q0992' },
    calm:  { name: 'High pressure, light and variable, haze',           short: 'Calm',        metar: 'EGLC 041850Z VRB03KT 6000 HZ NSC 22/12 Q1031' }
  };

  // airline radio telephony and codes at City (merged into the engine's tables)
  const TEL = { CFE: 'Flyer', KLC: 'City', SWR: 'Swiss', DLH: 'Lufthansa', LGL: 'Luxair', EAI: 'Emerald', LOG: 'Logan', AUR: 'Ayline', BCI: 'Blue Island',
    VJT: 'Vista', NJE: 'Fraction', ITY: 'Itarrow', BAW: 'Speedbird', SNR: 'Skyalps', EXS: 'Channex', KLM: 'KLM', EZY: 'Easy', RYR: 'Ryanair', TAP: 'Air Portugal' };
  // British Airways flights from City are flown by BA CityFlyer (callsign Flyer); KLM's by KLM Cityhopper (City)
  const AIRLINE_ICAO = { BA: 'CFE', CJ: 'CFE', KL: 'KLC', WA: 'KLC', LX: 'SWR', LH: 'DLH', LG: 'LGL', EI: 'EAI', LM: 'LOG', GR: 'AUR', SI: 'BCI', AZ: 'ITY', S7: 'SNR', BQ: 'SNR' };
  const AIRLINE_TYPE = { CFE: 'E190', KLC: 'E295', SWR: 'BCS1', DLH: 'E190', LGL: 'DH8D', EAI: 'AT76', LOG: 'AT76', AUR: 'AT76', BCI: 'AT76', ITY: 'E190', SNR: 'DH8D',
    VJT: 'CL35', NJE: 'E55P' };
  const TYPES = {
    E190: { name: 'Embraer 190',     wake: 'M', vapp: 125, vr: 135, climb: 2400, desc: 2000, cruise: 280, span: 28.7, len: 36.2, shape: 'jet' },
    E295: { name: 'Embraer 195-E2',  wake: 'M', vapp: 127, vr: 138, climb: 2400, desc: 2000, cruise: 280, span: 35.1, len: 41.5, shape: 'jet' },
    BCS1: { name: 'A220-100',        wake: 'M', vapp: 122, vr: 130, climb: 2700, desc: 2000, cruise: 290, span: 35.1, len: 35.0, shape: 'jet' },
    DH8D: { name: 'Dash 8-400',      wake: 'M', vapp: 115, vr: 115, climb: 1800, desc: 1800, cruise: 260, span: 28.4, len: 32.8, shape: 'prop' },
    E55P: { name: 'Phenom 300',      wake: 'L', vapp: 110, vr: 105, climb: 3000, desc: 2200, cruise: 280, span: 16.2, len: 15.6, shape: 'biz' },
    CL35: { name: 'Challenger 350',  wake: 'M', vapp: 120, vr: 120, climb: 3200, desc: 2200, cruise: 300, span: 21.0, len: 20.9, shape: 'biz' },
    FA7X: { name: 'Falcon 7X',       wake: 'M', vapp: 110, vr: 120, climb: 3000, desc: 2200, cruise: 300, span: 26.2, len: 23.4, shape: 'biz' }
  };
  const CRUISE = { E190: [440, 37000], E295: [450, 39000], BCS1: [450, 39000], DH8D: [310, 25000], E55P: [420, 41000], CL35: [460, 43000], FA7X: [470, 45000] };
  // London City's flight pages give places by city name
  const PLACES = {
    'edinburgh': 'EGPH', 'glasgow': 'EGPF', 'aberdeen': 'EGPD', 'inverness': 'EGPE', 'belfast city': 'EGAC', 'belfast': 'EGAC', 'isle of man': 'EGNS', 'newquay': 'EGHQ',
    'dundee': 'EGPN', 'dublin': 'EIDW', 'cork': 'EICK', 'shannon': 'EINN', 'jersey': 'EGJJ', 'guernsey': 'EGJB', 'southampton': 'EGHI', 'exeter': 'EGTE',
    'amsterdam': 'EHAM', 'rotterdam': 'EHRD', 'frankfurt': 'EDDF', 'munich': 'EDDM', 'düsseldorf': 'EDDL', 'dusseldorf': 'EDDL', 'hamburg': 'EDDH', 'berlin': 'EDDB',
    'zurich': 'LSZH', 'zürich': 'LSZH', 'geneva': 'LSGG', 'luxembourg': 'ELLX', 'brussels': 'EBBR', 'antwerp': 'EBAW', 'paris': 'LFPG', 'paris orly': 'LFPO',
    'paris le bourget': 'LFPB', 'nice': 'LFMN', 'lyon': 'LFLL', 'milan': 'LIML', 'milan linate': 'LIML', 'florence': 'LIRQ', 'rome': 'LIRF', 'venice': 'LIPZ',
    'bolzano': 'LIPB', 'chambery': 'LFLB', 'chambéry': 'LFLB', 'ajaccio': 'LFKJ', 'madrid': 'LEMD', 'barcelona': 'LEBL', 'palma': 'LEPA', 'palma de mallorca': 'LEPA',
    'mallorca': 'LEPA', 'ibiza': 'LEIB', 'malaga': 'LEMG', 'málaga': 'LEMG', 'menorca': 'LEMH', 'mahon': 'LEMH', 'faro': 'LPFR', 'lisbon': 'LPPT', 'bordeaux': 'LFBD', 'san sebastian': 'LESO',
    'copenhagen': 'EKCH', 'stockholm': 'ESSA', 'oslo': 'ENGM', 'billund': 'EKBI', 'helsinki': 'EFHK', 'vienna': 'LOWW', 'prague': 'LKPR', 'gibraltar': 'LXGB',
    'manchester': 'EGCC', 'newcastle': 'EGNT', 'leeds bradford': 'EGNM', 'cardiff': 'EGFF', 'bristol': 'EGGD', 'sylt': 'EDXW'
  };
  const AIRPORTS = {
    EGLC: [51.5053, 0.0553, 'London City'], EGPH: [55.9500, -3.3725, 'Edinburgh'], EGPF: [55.8719, -4.4331, 'Glasgow'], EGPD: [57.2019, -2.1978, 'Aberdeen'],
    EGAC: [54.6181, -5.8725, 'Belfast City'], EGNS: [54.0833, -4.6239, 'Isle of Man'], EGPN: [56.4525, -3.0258, 'Dundee'], EIDW: [53.4213, -6.2701, 'Dublin'],
    EICK: [51.8413, -8.4911, 'Cork'], EGJJ: [49.2079, -2.1955, 'Jersey'], EGJB: [49.4350, -2.6019, 'Guernsey'], EHAM: [52.3086, 4.7639, 'Amsterdam'],
    EHRD: [51.9569, 4.4372, 'Rotterdam'], EDDF: [50.0333, 8.5706, 'Frankfurt'], EDDM: [48.3538, 11.7861, 'Munich'], EDDL: [51.2895, 6.7668, 'Düsseldorf'],
    LSZH: [47.4647, 8.5492, 'Zurich'], LSGG: [46.2381, 6.1090, 'Geneva'], ELLX: [49.6233, 6.2044, 'Luxembourg'], EBBR: [50.9014, 4.4844, 'Brussels'],
    LFPB: [48.9694, 2.4414, 'Paris Le Bourget'], LFMN: [43.6584, 7.2159, 'Nice'], LIML: [45.4451, 9.2767, 'Milan Linate'], LIRQ: [43.8100, 11.2051, 'Florence'],
    LEPA: [39.5517, 2.7388, 'Palma'], LESO: [43.3565, -1.7906, 'San Sebastián'], LEIB: [38.8729, 1.3731, 'Ibiza'], LEMG: [36.6749, -4.4991, 'Málaga'], EGMC: [51.5714, 0.6956, 'Southend'],
    EGSS: [51.8850, 0.2350, 'London Stansted'], EGGW: [51.8747, -0.3683, 'London Luton'], EDXW: [54.9132, 8.3405, 'Sylt'], LIPB: [46.4602, 11.3264, 'Bolzano']
  };

  return {
    icao: 'EGLC', iata: 'LCY', name: 'London City', city: 'London', country: 'United Kingdom', arp: P('513019N', '0000319E'), elev: 20,
    FIX, NAV, RWY, STANDS, STARS, TRANS, HOLDS_AIR, SIDS, DIR, DIR_ENTRY, PLACE_DIR, dirFor, APPROACHES, R160, R159, TOWERS, OBST, TMA_NM, TA,
    UNITS, NEXT, TZ, ALTERNATES, HOURS, TIMETABLE, LONG_STAY, EXTRA, EXERCISES, WX_PRESETS, TEL, AIRLINE_ICAO, AIRLINE_TYPE, TYPES, CRUISE, PLACES, AIRPORTS,
    data: { metar: 'eglc/metar.txt', flights: 'eglc/flights.json' },
    features: { roadCrossing: false, sra: false, windLimits: false, ils: true, steepApproach: 5.5, rnavSids: true, remoteTower: true }
  };
})();
if (typeof module !== 'undefined') module.exports = EGLC;
