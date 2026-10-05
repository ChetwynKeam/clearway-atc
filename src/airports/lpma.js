// ═════════════════════════ Madeira (LPMA) airport profile ═════════════════════════
// Everything the Clearway engine needs to know that is true only of Madeira. Sources: AIP Portugal LPMA AD 2.24
// charts (aerodrome, parking, SIDs, STARs, surveillance minimum altitudes, instrument and visual approach charts) and
// OpenStreetMap for the taxiway centrelines. Positions are lat/lon (WGS84); bearings are TRUE unless named "mag"
// (variation 4°W: magnetic = true + 4). Summary of the source charts: airports/lpma/README.md.
// The profile is plain data plus a few small functions; airports/PLAN-multi-airport.md lists which engine globals
// each field replaces.

const LPMA = (() => {
  const ll = (s) => {                                     // '323854.22N' / '0163245.95W' → decimal degrees
    const m = s.match(/^(\d{2,3})(\d{2})(\d{2}(?:\.\d+)?)([NSEW])$/);
    const v = +m[1] + m[2]/60 + m[3]/3600; return /[SW]/.test(m[4]) ? -v : v;
  };
  const P = (lat, lon) => [ll(lat), ll(lon)];
  const D = (d, m, s = 0, neg = false) => (neg ? -1 : 1)*(d + m/60 + s/3600);

  // ── fixes (coding tables AD 2.24.08, 2.24.10 and 2.24.12)
  const FIX = {
    // STAR entry points and route fixes
    EKNOT: P('321035.26N', '0161744.50W'), IBBAN: P('332034.58N', '0170831.84W'), KICAS: P('334501.68N', '0162824.45W'),
    LIDRO: P('334002.64N', '0155658.55W'), NIDUL: P('322154.82N', '0172110.52W'), RAKUN: P('333325.01N', '0154652.55W'),
    MA516: P('322143.93N', '0165214.76W'), MA533: P('324719.71N', '0163004.62W'), MA534: P('325542.82N', '0163042.44W'),
    MA536: P('330551.59N', '0162303.02W'), MA538: P('325944.07N', '0163600.54W'), MA542: P('325143.46N', '0165334.35W'),
    PILIM: P('325114.86N', '0163528.64W'), MONEC: P('322722.93N', '0164949.39W'),
    // SID fixes
    MA647: P('323854.22N', '0163245.95W'), MA400: P('323928.20N', '0164534.96W'), MA401: P('323739.11N', '0164640.82W'),
    MA402: P('323458.58N', '0164817.98W'), MA403: P('323657.06N', '0170720.84W'), DEGUN: P('332507.35N', '0153929.87W'),
    GALOZ: P('330200.61N', '0172514.49W'), GOSGA: P('320455.63N', '0163752.30W'), LAPPA: P('331744.85N', '0162131.41W'),
    MARCU: P('325103.62N', '0162028.43W'), PS702: P('330230.19N', '0161012.43W'), PS703: P('330653.28N', '0161022.27W'),
    PS704: P('331802.42N', '0161047.36W'),
    // conventional approach (AD 2.24.12-1/-3)
    ABUSU: [D(32,52,1), D(16,38,8,true)], FUSUL: [D(32,36,5), D(16,39,43,true)],
    // RNP AR approaches (coding tables AD 2.24.12-6, -8, -10): RNP Y and Z 05, RNP 23, their missed approaches
    MA512: P('323018.539N', '0164833.962W'), MA510: P('323201.424N', '0164812.538W'), MA508: P('323602.429N', '0164812.538W'),
    MA504: P('323933.590N', '0164812.538W'), MA502: P('324058.101N', '0164731.493W'),
    MA530: P('324946.215N', '0163703.180W'), MA528: P('324802.705N', '0163815.303W'), MA526: P('323832.210N', '0164206.696W'),
    MA522: P('323639.123N', '0164634.442W'), MA520: P('323833.470N', '0164812.538W'),
    MA410: P('324825.446N', '0163847.606W'), MA408: P('324617.264N', '0164118.075W'), MA416: P('323048.439N', '0164821.110W'),
    MA414: P('323233.960N', '0164703.405W'), MA413: P('323702.651N', '0164157.741W'), MA412: P('324205.123N', '0163612.753W'),
    MA550: P('324224.500N', '0164550.480W'), MA552: P('324327.944N', '0164344.183W'), MA554: P('323506.473N', '0163834.850W'),
    MA407: P('324123.753N', '0164701.505W'), MA406: P('323939.233N', '0164801.455W'),
    // other TMA boundary points (AD 2.24.11), for the map
  };
  // centres of the RNP AR radius-to-fix arcs
  const ARC = {
    MAC01: P('323933.568N', '0164550.396W'), MAC02: P('323850.704N', '0164209.486W'), MAC03: P('323201.285N', '0165407.396W'),
    MAC04: P('323833.448N', '0164550.423W'), MAC05: P('323916.937N', '0164429.882W'), MAC06: P('324625.002N', '0163238.764W'),
    MAC07: P('322905.437N', '0164247.860W'), MAC08: P('324410.341N', '0163846.385W'), MAC09: P('323930.609N', '0164528.402W'),
    MAC10: P('323931.136N', '0164223.286W')
  };
  const NAV = {
    FUN: { name: 'Funchal DVOR/DME', freq: '112.200', ch: '59X', p: [D(32,44,50), D(16,42,20,true)], elev: 500 },
    SNT: { name: 'Porto Santo DVOR/DME', freq: '114.900', ch: '96X', p: [D(33,5,25), D(16,21,2,true)], elev: 400 }
  };

  // ── runway (AD 2.24.01): thresholds, elevations, declared distances
  const RWY = {
    lo: '05', hi: '23', magHdg: { '05': 49, '23': 229 }, var: -4,
    thr: { '05': [D(32,41,24), D(16,47,2,true)], '23': [D(32,42,21), D(16,45,55,true)] },
    elev: { '05': 146, '23': 191 }, length: 2481, width: 45,
    tora: { '05': 2481, '23': 2631 },                     // RWY 23 take-off starts 150 m before its threshold
    papi: { '05': 'PAPI 3°, slewed 5° right (to the sea)', '23': 'PAPI 3°, left side' }
  };

  // ── stands (AD 2.24.02, AIRAC 007-26). Apron A, nose-in onto taxilane A except A18 (nose-out).
  const STANDS = [
    ['A1', '324132.12N', '0164641.43W', 'A320'], ['A2', '324133.01N', '0164640.24W', 'A320'], ['A3', '324133.91N', '0164639.05W', 'A320'],
    ['A4', '324134.80N', '0164637.86W', 'A320'], ['A5', '324135.70N', '0164636.67W', 'A320'], ['A6', '324136.60N', '0164635.48W', 'A320'],
    ['A7', '324138.46N', '0164632.87W', 'B752'], ['A8', '324139.45N', '0164631.57W', 'B752'], ['A9', '324140.43N', '0164630.27W', 'B752'],
    ['A10', '324140.98N', '0164628.50W', 'B752'], ['A11', '324141.96N', '0164627.20W', 'B752'], ['A12', '324142.92N', '0164625.51W', 'B753'],
    ['A13', '324144.51N', '0164624.51W', 'A332'], ['A14', '324145.45N', '0164624.08W', 'A320'], ['A15', '324145.45N', '0164622.82W', 'A320'],
    ['A16', '324146.07N', '0164622.94W', 'B752'], ['A17', '324146.51N', '0164625.53W', 'B752'], ['A18', '324147.06N', '0164624.86W', 'B742']
  ].map(([id, la, lo, max]) => ({ id, p: [ll(la), ll(lo)], max, area: 'A' }));
  const STAND_EXCLUDE = [['A14', 'A15'], ['A16', 'A17'], ['A18', 'A14'], ['A18', 'A15'], ['A18', 'A16'], ['A18', 'A17']];

  // ── ground: taxiway names. Centrelines and holding points come from the OSM aerodrome data (lpma-osm.js).
  const TAXI = { PHON: { A: 'Alpha', B: 'Bravo', C: 'Charlie' }, exits: ['B', 'C'] };
  // departures enter at the end they take off from: 05 from Charlie (backtrack to the 05 pad), 23 from Bravo
  const depHold = rwy => rwy === '05' ? 'C' : 'B';

  // ── STARs (AD 2.24.10). Alt = at-or-above constraint in feet.
  const STARS = {
    'EKNOT 1P': { from: 'SE', pts: [['EKNOT'], ['MA533', 4000], ['PILIM', 3000]] },
    'IBBAN 1P': { from: 'NW', pts: [['IBBAN'], ['MA538'], ['PILIM', 3000]] },
    'KICAS 1P': { from: 'N',  pts: [['KICAS'], ['PILIM', 3000]] },
    'LIDRO 1P': { from: 'NE', pts: [['LIDRO'], ['MA536'], ['MA534', 4000], ['PILIM', 3000]] },
    'NIDUL 1P': { from: 'SW', pts: [['NIDUL', 10000], ['MA542', 8200], ['MA538'], ['MA534', 4000], ['PILIM', 3000]] },
    'NIDUL 2R': { from: 'SW', rwy: '05', pts: [['NIDUL', 10000], ['MA516'], ['MONEC', 3000]] },
    'RAKUN 1P': { from: 'NE', pts: [['RAKUN'], ['MA534', 4000], ['PILIM', 3000]] }
  };
  // holds at the IAFs and the missed approach fix (inbound course true; turn L/R; MHA)
  const HOLDS_AIR = {
    PILIM: { inb: 42, turn: 'L', min: 3000, maxKt: 230 },
    MONEC: { inb: 20, turn: 'L', min: 3000, maxKt: 230, legMin: 1 },
    FUSUL: { inb: 346, turn: 'L', min: 3000 },
    ABUSU: { inb: 207, turn: 'R', min: 3000 }
  };

  // ── SIDs (AD 2.24.08). Initial track then fixes; climb FL60 (FL100 GALOZ); contact Approach passing 1000 ft.
  const SIDS = {
    '05': {
      init: { trk: 83, note: 'track 087 mag; start the right turn as soon as practicable, high ground on the left' },
      'DEGUN 1E': { pts: [['MA647', 4000], ['DEGUN']], climb: 6000 },
      'MARCU 1E': { pts: [['MA647', 4000], ['MARCU']], climb: 6000 },
      'LAPPA 1E': { pts: [['MA647', 4000], ['PS702'], ['PS703'], ['PS704', 4000], ['LAPPA', 3000]], climb: 6000 },
      'GALOZ 1E': { pts: [['MA400'], ['MA401'], ['MA402'], ['MA403', 5000], ['GALOZ']], climb: 10000, rightTurn: true },
      'NIDUL 1E': { pts: [['MA400'], ['MA401'], ['MA402'], ['NIDUL']], climb: 6000, rightTurn: true },
      'GOSGA 1E': { pts: [['GOSGA']], climb: 6000, rightTurn: true }
    },
    '23': {
      init: { trk: 171, note: 'track 175 mag; start the left turn as soon as practicable, high ground on the right' },
      'DEGUN 1W': { pts: [['MA647', 4000], ['DEGUN']], climb: 6000, turnAt: 4000 },
      'MARCU 1W': { pts: [['MA647', 4000], ['MARCU']], climb: 6000, turnAt: 4000 },
      'LAPPA 1W': { pts: [['MA647', 4000], ['PS702'], ['PS703'], ['PS704', 4000], ['LAPPA', 3000]], climb: 6000, turnAt: 4000 },
      'GALOZ 1W': { pts: [['MA401'], ['MA402'], ['MA403', 5000], ['GALOZ']], climb: 10000 },
      'NIDUL 1W': { pts: [['MA401'], ['MA402'], ['NIDUL']], climb: 6000 },
      'GOSGA 1W': { pts: [['GOSGA']], climb: 6000 }
    }
  };
  // exit fix for a destination (airway direction), and the STAR an inbound from that place flies
  const DIR = {
    // Portugal mainland, Spain, France, Italy, Switzerland, Germany south: north-east
    NE: { sid: 'DEGUN', star: 'LIDRO 1P' },
    // UK, Ireland, Benelux, Scandinavia, Germany north: north
    N: { sid: 'LAPPA', star: 'KICAS 1P' },
    // Azores, North America: north-west
    NW: { sid: 'GALOZ', star: 'IBBAN 1P' },
    // Canary Islands, Africa: south
    S: { sid: 'GOSGA', star: 'EKNOT 1P' },
    // Porto Santo: short hop
    PS: { sid: 'MARCU', star: 'RAKUN 1P' }
  };
  const PLACE_DIR = {
    LPPT: 'NE', LPPR: 'NE', LPFR: 'NE', LEMD: 'NE', LEBL: 'NE', LFPO: 'NE', LFPG: 'NE', LFLL: 'NE', LFML: 'NE', LSZH: 'NE', LSGG: 'NE', LFSB: 'NE',
    LIMC: 'NE', LIME: 'NE', LIRF: 'NE', EDDF: 'NE', EDDM: 'NE', EDDS: 'NE', EDDK: 'NE', EDDL: 'NE', LOWW: 'NE', ELLX: 'NE',
    EGKK: 'N', EGLL: 'N', EGSS: 'N', EGGW: 'N', EGCC: 'N', EGBB: 'N', EGGD: 'N', EGNM: 'N', EGPH: 'N', EGPF: 'N', EIDW: 'N', EHAM: 'N',
    EBBR: 'N', EBCI: 'N', EKCH: 'N', ESSA: 'N', ENGM: 'N', EFHK: 'N', EDDH: 'N', EDDB: 'N', EPWA: 'N', EVRA: 'N',
    LPPD: 'NW', LPLA: 'NW', KJFK: 'NW', KEWR: 'NW', CYYZ: 'NW', KBOS: 'NW',
    GCLP: 'S', GCXO: 'S', GCTS: 'S', GCRR: 'S', GCFV: 'S', GVAC: 'S', GMMX: 'S',
    LPPS: 'PS'
  };
  const dirFor = icao => DIR[PLACE_DIR[icao] || 'NE'];

  // ── approaches (AD 2.24.12, 2.24.13). Paths are built by the engine from these definitions.
  // 'nm' points are offsets east/north in NM from THR 05, read off the 1:75 000 visual approach chart.
  const APPROACHES = {
    'VOR 05': {
      rwy: '05', type: 'VOR-circling', spoken: 'VOR DME approach runway zero five, circling via Rosário',
      iaf: 'ABUSU', faf: { dme: 7, alt: 3000 }, inbound: 207, mapt: { dme: 3.6 },
      // after the MAPt: continue to 6 DME FUN, right turn offshore, Gelo, Rosário, short final 05
      visual: { nm: [[1.23, -1.92], [0.28, -2.70], [-0.49, -2.39], [-0.93, -1.75], [-0.97, -1.19], [-0.72, -0.64], [-0.35, -0.27], [0, 0]],
        points: { GELO: { at: 3, minAlt: 850 }, ROSARIO: { at: 5, minAlt: 460 } }, ias: 190 },
      profile: [[7, 3000], [6, 2755], [5, 2550], [4, 2325], [3, 2100], [2, 1875], [1, 1650]],   // DME FUN → ft
      minima: { mda: 940, vis: 5000, ceil: 800 },
      missed: { hdg: 137, intercept: 'R170 FUN', fix: 'FUSUL', alt: 3000 }
    },
    'VOR 23': {
      rwy: '23', type: 'VOR-circling', spoken: 'VOR DME approach runway two three',
      iaf: 'ABUSU', faf: { dme: 7, alt: 3000 }, inbound: 207, mapt: { dme: 3.6 },
      visual: { track: 231, note: 'visual 235 mag onto 23; do not deviate right of the extended centreline; straight-in from the VOR not authorised' },
      profile: [[7, 3000], [6, 2800], [5, 2550], [4, 2300], [3, 2050], [2, 1800], [1, 1550]],
      minima: { mda: 1300, vis: 7000, ceil: 1200 },
      missed: { hdg: 137, intercept: 'R170 FUN', fix: 'FUSUL', alt: 3000 }
    },
    // RNP AR (AD 2.24.12-5 to -10): crew-flown published paths with radius-to-fix (RF) arcs. Each leg is [fix, alt, arc]:
    // alt is the profile altitude the sim flies at that fix (the coding table's "+2000" is at or above), arc is
    // [centre, 'L'|'R'] for an RF leg ending at that fix. DA(H) and OCH are cat C, RNP 0.3. Visibility is not on the
    // chart (operators set it); the sim uses 1,500 m for 05 and 2,000 m for 23.
    'RNP Y 05': {
      rwy: '05', key: 'RNPY05', short: 'RNP Y', spoken: 'RNP Yankee approach runway zero five', iaf: 'MONEC', via: ['PILIM'],
      legs: [['MONEC', 3000], ['MA512'], ['MA510', 2000, ['MAC03', 'L']], ['MA508', 2000, null, 'FAP'], ['MA504', 890], ['MA502', 390, ['MAC01', 'R']], ['RW05']],
      minima: { da: 910, dh: 764, vis: 1500 },
      missed: { legs: [['MA550'], ['MA552', null, ['MAC10', 'R']], ['MA554', null, ['MAC02', 'R']], ['MONEC']], alt: 3000 }
    },
    'RNP Z 05': {
      rwy: '05', key: 'RNPZ05', short: 'RNP Z', spoken: 'RNP Zulu approach runway zero five', iaf: 'PILIM',
      legs: [['PILIM', 3000], ['MA530'], ['MA528', 2000, ['MAC06', 'L']], ['MA526', 2000], ['MA522', 2000, ['MAC09', 'R'], 'FAP'], ['MA520', 1200, ['MAC04', 'R']], ['MA504', 890], ['MA502', 390, ['MAC01', 'R']], ['RW05']],
      minima: { da: 910, dh: 764, vis: 1500 },
      missed: { legs: [['MA550'], ['MA552', null, ['MAC10', 'R']], ['MA554', null, ['MAC02', 'R']], ['MONEC']], alt: 3000 }
    },
    'RNP 23': {
      rwy: '23', key: 'RNP23', short: 'RNP', spoken: 'RNP approach runway two three', iaf: 'PILIM',
      legs: [['PILIM', 3000], ['MA410', 2000], ['MA408', 2000, null, 'FAP'], ['RW23']],
      minima: { da: 1200, dh: 1009, vis: 2000 },
      missed: { legs: [['MA407'], ['MA406', null, ['MAC05', 'L']], ['MONEC']], alt: 3000 }
    },
    'RNP 23 MONEC': {
      rwy: '23', key: 'RNP23M', short: 'RNP', spoken: 'RNP approach runway two three', iaf: 'MONEC', transition: true,
      legs: [['MONEC', 3000], ['MA416'], ['MA414', 2000, ['MAC07', 'R']], ['MA413', 2000], ['MA412', 2000], ['MA408', 2000, ['MAC08', 'L'], 'FAP'], ['RW23']],
      minima: { da: 1200, dh: 1009, vis: 2000 },
      missed: { legs: [['MA407'], ['MA406', null, ['MAC05', 'L']], ['MONEC']], alt: 3000 }
    }
  };

  // ── wind limits (wind rose on every approach and take-off chart; AD 2.20 has the full text).
  // Sectors in degrees MAGNETIC; mean = max mean wind (kt), gust = max gust; null = no limit in that sector.
  // Measured at the MID or ROSÁRIO anemometer, whichever is worse.
  const WIND_LIMITS = {
    land: {
      '05': [[300, 10, 15, 25], [20, 40, 20, 30], [120, 190, 20, 30], [200, 230, 25, 25]],
      '23': [[300, 10, 15, 25], [20, 40, 20, 30], [120, 190, 15, 25], [200, 230, 25, 25]]
    },
    takeoff: {
      '05': [[300, 10, 20, null], [20, 40, 25, null], [120, 190, 25, null]],
      '23': [[300, 10, 20, null], [20, 40, 25, null], [120, 190, 20, null]]
    }
  };
  const inSector = (d, a, b) => a <= b ? d >= a && d <= b : d >= a || d <= b;
  // wind is a METAR (true) direction; returns a reason string when the limit is exceeded
  function windLimit(phase, rwy, w){
    if (w.vrb) return null;
    const mag = ((w.dir - RWY.var) % 360 + 360) % 360;
    for (const [a, b, mean, gust] of WIND_LIMITS[phase][rwy]) {
      if (!inSector(mag, a, b)) continue;
      if (w.spd > mean) return `wind ${Math.round(mag)}° ${w.spd} kt above the ${mean} kt limit`;
      if (gust && w.gust > gust) return `gusts ${w.gust} kt above the ${gust} kt limit`;
      if (!gust && w.gust > mean) return `gusts ${w.gust} kt above the ${mean} kt limit`;
    }
    return null;
  }
  // the two anemometers disagree: Rosário (south-west end, under the cliffs) reads gustier in northerlies and westerlies
  function anemometers(w){
    const lee = !w.vrb && inSector(w.dir, 280, 30);
    return { MID: { dir: w.dir, spd: w.spd, gust: w.gust }, ROSARIO: { dir: (w.dir + (lee ? 20 : 5)) % 360, spd: Math.round(w.spd*(lee ? 1.15 : 1)), gust: w.gust ? Math.round(w.gust*(lee ? 1.2 : 1.05)) : (lee && w.spd > 12 ? w.spd + 9 : 0) } };
  }
  // chance of a turbulence or windshear go-around on short final, beside the hard limits
  function turbulence(w, rwy){
    if (w.vrb || w.spd < 12) return 0;
    const mag = ((w.dir - RWY.var) % 360 + 360) % 360, g = Math.max(w.spd, (w.gust || 0)*0.85);
    const rough = inSector(mag, 290, 50) || inSector(mag, 110, 240);
    return rough ? Math.min(0.5, Math.max(0, (g - 12)/40)) : Math.min(0.15, Math.max(0, (g - 20)/60));
  }

  // ── airspace and terrain (AD 2.24.11 and the visual charts)
  // minimum vectoring altitude 9000 ft in the sector over the island: bounded by the 222° and 263° bearings from the
  // Porto Santo radar towards the island, the 25 NM ring round FUN, and the TMA edge (polygon approximated from the chart)
  const MVA = [
    { alt: 9000, name: 'Madeira island sector', poly: [[32.80, -16.50], [32.98, -17.38], [32.40, -17.45], [32.25, -17.05], [32.70, -16.61]] },
    { alt: 3000, name: 'TMA Madeira', poly: null }
  ];
  // high ground near the field (spot heights, ft) for the terrain picture and the "turns over the sea" rule
  const PEAKS = [['Pico Ruivo', 32.7593, -16.9428, 6107], ['Pico do Arieiro', 32.7356, -16.9286, 5965], ['', 32.7395, -16.7960, 2329],
    ['', 32.7110, -16.8150, 2467], ['', 32.7330, -16.7640, 1932], ['', 32.7105, -16.7915, 1542], ['', 32.7180, -16.7640, 1149],
    ['', 32.7045, -16.7650, 466], ['', 32.6930, -16.7760, 709], ['', 32.6865, -16.7930, 662], ['', 32.6800, -16.7950, 755]];
  // "execute all turns over the sea": the island coast is the line not to manoeuvre inside below the MSA
  const TMA_NM = 60, RADAR_REF = NAV.SNT.p;

  // ── units, frequencies, coordination
  const UNITS = {
    app: { name: 'Madeira Approach', freq: '119.605' }, twr: { name: 'Madeira Tower', freq: '124.660' },
    atisArr: { name: 'Madeira arrival information', freq: '130.355' }, atisDep: { name: 'Madeira departure information', freq: '121.630' },
    acc: { name: 'Lisboa Control', freq: '132.255' }
  };
  const release = () => ['Lisboa Control', '132.255'];
  const TA = 5000, TZ = 'Atlantic/Madeira';
  const ALTERNATES = [['Porto Santo', 'LPPS', 'MARCU'], ['Gran Canaria', 'GCLP', 'GOSGA'], ['Lisbon', 'LPPT', 'DEGUN']];

  // ── traffic. Weekly summer pattern, times UTC (local is UTC+1 in summer). Operators are the real ones serving
  // Funchal; flight numbers and times are representative, not a published timetable.
  // [arrival cs, from, landing, departure cs, to, off-blocks, type, days (1 = Monday), stand hint]
  const TIMETABLE = [
    ['TAP1679', 'LPPT', '07:15', 'TAP1680', 'LPPT', '08:05', 'A20N', '1234567', 'A3'],
    ['IBB1601', 'LPPS', '07:35', 'IBB1602', 'LPPS', '08:10', 'AT76', '1234567', 'A1'],
    ['RYR8152', 'LPPR', '08:10', 'RYR8153', 'LPPR', '08:40', 'B738', '1357', 'A5'],
    ['TAP1687', 'LPPT', '08:50', 'TAP1688', 'LPPT', '09:40', 'A321', '1234567', 'A7'],
    ['EZY8711', 'EGKK', '09:30', 'EZY8712', 'EGKK', '10:15', 'A20N', '1234567', 'A4'],
    ['EXS1291', 'EGCC', '10:05', 'EXS1292', 'EGCC', '11:00', 'B738', '246', 'A6'],
    ['TRA6531', 'EHAM', '10:20', 'TRA6532', 'EHAM', '11:05', 'B738', '1357', 'A8'],
    ['IBB1603', 'LPPS', '10:30', 'IBB1604', 'LPPS', '11:00', 'AT76', '1234567', 'A1'],
    ['EDW376',  'LSZH', '11:10', 'EDW377',  'LSZH', '12:00', 'A320', '37', 'A9'],
    ['TAP1691', 'LPPT', '11:30', 'TAP1692', 'LPPT', '12:20', 'A20N', '1234567', 'A3'],
    ['RZO161',  'LPPD', '11:45', 'RZO162',  'LPPD', '12:30', 'A21N', '257', 'A10'],
    ['EWG1384', 'EDDL', '12:10', 'EWG1385', 'EDDL', '13:00', 'A320', '46', 'A11'],
    ['CFG1554', 'EDDF', '12:35', 'CFG1555', 'EDDF', '13:30', 'A21N', '6', 'A12'],
    ['EZY6801', 'EGGD', '12:50', 'EZY6802', 'EGGD', '13:35', 'A320', '15', 'A4'],
    ['IBB1427', 'GCLP', '13:05', 'IBB1428', 'GCLP', '13:45', 'AT76', '2467', 'A2'],
    ['TOM6420', 'EGKK', '13:20', 'TOM6421', 'EGKK', '14:20', 'B38M', '36', 'A13'],
    ['EJU5143', 'LSGG', '13:40', 'EJU5144', 'LSGG', '14:25', 'A20N', '36', 'A5'],
    ['TAP1695', 'LPPT', '14:10', 'TAP1696', 'LPPT', '15:00', 'A321', '1234567', 'A7'],
    ['RYR2442', 'EGSS', '14:30', 'RYR2443', 'EGSS', '15:00', 'B738', '247', 'A6'],
    ['TAP1709', 'LPPR', '14:55', 'TAP1710', 'LPPR', '15:40', 'E195', '1357', 'A2'],
    ['IBB1605', 'LPPS', '15:15', 'IBB1606', 'LPPS', '15:45', 'AT76', '1234567', 'A1'],
    ['EXS1873', 'EGBB', '15:35', 'EXS1874', 'EGBB', '16:30', 'A321', '15', 'A8'],
    ['NOZ1820', 'EKCH', '15:50', 'NOZ1821', 'EKCH', '16:40', 'B38M', '4', 'A9'],
    ['DLH1792', 'EDDM', '16:10', 'DLH1793', 'EDDM', '17:05', 'A20N', '26', 'A10'],
    ['EZY8713', 'EGKK', '16:30', 'EZY8714', 'EGKK', '17:15', 'A20N', '1234567', 'A4'],
    ['TAP1699', 'LPPT', '17:00', 'TAP1700', 'LPPT', '17:50', 'A20N', '1234567', 'A3'],
    ['TVF7684', 'LFPO', '17:25', 'TVF7685', 'LFPO', '18:10', 'B738', '57', 'A11'],
    ['RYR5761', 'LPPT', '17:45', 'RYR5762', 'LPPT', '18:15', 'B738', '1234567', 'A6'],
    ['IBB1607', 'LPPS', '18:20', 'IBB1608', 'LPPS', '18:50', 'AT76', '1234567', 'A1'],
    ['EXS1293', 'EGCC', '18:40', 'EXS1294', 'EGCC', '19:35', 'B738', '7', 'A8'],
    ['TAP1703', 'LPPT', '19:20', 'TAP1704', 'LPPT', '20:10', 'A321', '1234567', 'A7'],
    ['BAW2580', 'EGLL', '19:45', 'BAW2581', 'EGLL', '20:40', 'A320', '6', 'A12'],
    ['EZY6813', 'EGGD', '20:10', null, null, null, 'A320', '35', 'A5'],
    ['TAP1707', 'LPPT', '21:30', null, null, null, 'A20N', '1234567', 'A3'],
    [null, null, null, 'EZY6814', 'EGGD', '07:20', 'A320', '46', 'A5'],
    [null, null, null, 'TAP1678', 'LPPT', '06:30', 'A20N', '1234567', 'A3']
  ];
  const LONG_STAY = [['CSDPT', 'C56X', 'A18', '1234567']];
  const EXTRA = [
    { cs: 'ENT7365', t: 'B738', k: 'ARR', o: 'EPWA' }, { cs: 'LGL6461', t: 'E195', k: 'DEP', d: 'ELLX' },
    { cs: 'SXS3592', t: 'B738', k: 'ARR', o: 'EDDK' }, { cs: 'BTI6741', t: 'BCS3', k: 'DEP', d: 'EVRA' },
    { cs: 'JAF3477', t: 'B38M', k: 'ARR', o: 'EBBR' }, { cs: 'VJT771',  t: 'GLF6', k: 'DEP', d: 'EGLF' },
    { cs: 'TAP1711', t: 'A20N', k: 'ARR', o: 'LPPT' }, { cs: 'IBB1609', t: 'AT76', k: 'DEP', d: 'LPPS' },
    { cs: 'NJE712K', t: 'C56X', k: 'ARR', o: 'LPPT' }, { cs: 'WZZ4371', t: 'A21N', k: 'DEP', d: 'EPWA' }
  ];
  const EXERCISES = {
    dep: { name: 'Madeira 1 · First departure', wx: 'trade', rwy: '05', sched: [{ cs: 'TAP1688', t: 'A321', k: 'DEP', d: 'LPPT', m: 0, stand: 'A7' }] },
    arr: { name: 'Madeira 2 · The Rosário circuit', wx: 'trade', rwy: '05', sched: [{ cs: 'EZY8711', t: 'A20N', k: 'ARR', o: 'EGKK', m: 0, app: 'VOR 05' }] },
    wind: { name: 'Madeira 3 · Wind limits and Porto Santo', wx: 'nortada', rwy: '05', sched: [{ cs: 'EXS1291', t: 'B738', k: 'ARR', o: 'EGCC', m: 0 }, { cs: 'TAP1691', t: 'A20N', k: 'ARR', o: 'LPPT', m: 4 }] }
  };
  const WX_PRESETS = {
    trade:    { name: 'North-east trade wind, runway 05',                short: 'Trade wind', metar: 'LPMA 041850Z 04012KT 9999 FEW025 22/16 Q1019' },
    nortada:  { name: 'Strong northerly: over the limit at Rosário',     short: 'Northerly',  metar: 'LPMA 041850Z 35019G31KT 9999 SCT030 19/13 Q1017' },
    tradeMax: { name: 'Gale-force trade wind, 05 at the limit',          short: 'Strong NE',  metar: 'LPMA 041850Z 03019G29KT 9999 SCT022 20/14 Q1016' },
    sw:       { name: 'South-westerly front, runway 23 in rain',         short: 'Front',      metar: 'LPMA 041850Z 21016G24KT 8000 -RA BKN014 OVC025 18/16 Q1008' },
    low:      { name: 'Low cloud below the VOR 23 circling minima',      short: 'Low cloud',  metar: 'LPMA 041850Z 20010KT 5000 -RA BKN009 OVC015 18/17 Q1010' },
    murk:     { name: 'Drizzle and low cloud: RNP only on runway 05',     short: 'RNP only',   metar: 'LPMA 041850Z 05010KT 3000 -DZ BR BKN008 OVC015 19/18 Q1014' },
    calima:   { name: 'Calima: Saharan dust haze, visibility 3 km',      short: 'Calima',     metar: 'LPMA 041850Z 11012KT 3000 HZ NSC 29/12 Q1012' },
    calm:     { name: 'Light and variable, morning sea breeze',          short: 'Calm',       metar: 'LPMA 041850Z VRB03KT CAVOK 21/15 Q1021' }
  };

  // airline radio telephony and ICAO codes seen at Funchal (merged into the engine's tables)
  const TEL = { TAP: 'Air Portugal', IBB: 'Binter', RZO: 'Air Azores', RYR: 'Ryanair', EZY: 'Easy', EJU: 'Alpine', EZS: 'Topswiss', EXS: 'Channex',
    TOM: 'Tomjet', TRA: 'Transavia', TVF: 'France Soleil', EDW: 'Edelweiss', EWG: 'Eurowings', CFG: 'Condor', DLH: 'Lufthansa', NOZ: 'Nordic',
    BAW: 'Speedbird', ENT: 'Enter', LGL: 'Luxair', SXS: 'Sunexpress', BTI: 'Air Baltic', JAF: 'Beauty', WZZ: 'Wizz Air', NJE: 'Fraction', VJT: 'Vista',
    IBE: 'Iberia', FIN: 'Finnair', TVS: 'Skytravel', NOS: 'Moonflower' };
  const AIRLINE_ICAO = { TP: 'TAP', NT: 'IBB', S4: 'RZO', FR: 'RYR', U2: 'EZY', DS: 'EZS', EC: 'EJU', LS: 'EXS', BY: 'TOM', HV: 'TRA', TO: 'TVF',
    WK: 'EDW', EW: 'EWG', DE: 'CFG', LH: 'DLH', DY: 'NOZ', D8: 'NOZ', BA: 'BAW', E4: 'ENT', LG: 'LGL', XQ: 'SXS', BT: 'BTI', TB: 'JAF', W6: 'WZZ',
    IB: 'IBE', AY: 'FIN', QS: 'TVS', NO: 'NOS' };
  const AIRLINE_TYPE = { TAP: 'A20N', IBB: 'AT76', RZO: 'A21N', RYR: 'B738', EZY: 'A20N', EJU: 'A20N', EZS: 'A20N', EXS: 'B738', TOM: 'B38M',
    TRA: 'B738', TVF: 'B738', EDW: 'A320', EWG: 'A320', CFG: 'A21N', DLH: 'A20N', NOZ: 'B38M', BAW: 'A320', ENT: 'B738', LGL: 'E195', BTI: 'BCS3', JAF: 'B38M',
    IBE: 'A20N', FIN: 'A321', TVS: 'B738', NOS: 'B738' };
  const TYPES = {
    A321: { name: 'A321',          wake: 'M', vapp: 140, vr: 150, climb: 2000, desc: 2000, cruise: 290, span: 34.1, len: 44.5, shape: 'jet' },
    B38M: { name: '737 MAX 8',     wake: 'M', vapp: 145, vr: 150, climb: 2400, desc: 2100, cruise: 290, span: 35.9, len: 39.5, shape: 'jet' },
    E195: { name: 'Embraer 195',   wake: 'M', vapp: 130, vr: 135, climb: 2300, desc: 2000, cruise: 280, span: 28.7, len: 38.7, shape: 'jet' },
    BCS3: { name: 'A220-300',      wake: 'M', vapp: 132, vr: 135, climb: 2600, desc: 2000, cruise: 290, span: 35.1, len: 38.7, shape: 'jet' }
  };
  const PLACES = {
    'lisboa': 'LPPT', 'lisbon': 'LPPT', 'porto': 'LPPR', 'oporto': 'LPPR', 'faro': 'LPFR', 'porto santo': 'LPPS', 'ponta delgada': 'LPPD', 'terceira': 'LPLA',
    'las palmas': 'GCLP', 'gran canaria': 'GCLP', 'tenerife': 'GCXO', 'tenerife norte': 'GCXO', 'tenerife sul': 'GCTS', 'tenerife south': 'GCTS', 'lanzarote': 'GCRR',
    'londres gatwick': 'EGKK', 'london gatwick': 'EGKK', 'gatwick': 'EGKK', 'london heathrow': 'EGLL', 'heathrow': 'EGLL', 'london stansted': 'EGSS', 'stansted': 'EGSS',
    'london luton': 'EGGW', 'luton': 'EGGW', 'manchester': 'EGCC', 'birmingham': 'EGBB', 'bristol': 'EGGD', 'leeds bradford': 'EGNM', 'edinburgh': 'EGPH', 'glasgow': 'EGPF',
    'dublin': 'EIDW', 'amesterdão': 'EHAM', 'amsterdam': 'EHAM', 'bruxelas': 'EBBR', 'brussels': 'EBBR', 'charleroi': 'EBCI', 'paris orly': 'LFPO', 'paris': 'LFPG',
    'lyon': 'LFLL', 'marselha': 'LFML', 'marseille': 'LFML', 'genebra': 'LSGG', 'geneva': 'LSGG', 'zurique': 'LSZH', 'zurich': 'LSZH', 'basileia': 'LFSB', 'basel': 'LFSB',
    'frankfurt': 'EDDF', 'munique': 'EDDM', 'munich': 'EDDM', 'dusseldorf': 'EDDL', 'düsseldorf': 'EDDL', 'colónia': 'EDDK', 'cologne': 'EDDK', 'estugarda': 'EDDS', 'stuttgart': 'EDDS',
    'hamburgo': 'EDDH', 'hamburg': 'EDDH', 'berlim': 'EDDB', 'berlin': 'EDDB', 'viena': 'LOWW', 'vienna': 'LOWW', 'luxemburgo': 'ELLX', 'luxembourg': 'ELLX',
    'copenhaga': 'EKCH', 'copenhagen': 'EKCH', 'estocolmo': 'ESSA', 'stockholm': 'ESSA', 'oslo': 'ENGM', 'helsínquia': 'EFHK', 'helsinki': 'EFHK',
    'varsóvia': 'EPWA', 'warsaw': 'EPWA', 'riga': 'EVRA', 'madrid': 'LEMD', 'barcelona': 'LEBL', 'milão': 'LIMC', 'milan': 'LIMC', 'bergamo': 'LIME', 'roma': 'LIRF', 'rome': 'LIRF',
    'nova iorque': 'KJFK', 'new york': 'KJFK', 'newark': 'KEWR', 'toronto': 'CYYZ', 'boston': 'KBOS'
  };
  // ANA's flight feed writes places as "City, Airport"; tools/ana_flights.py drops the comma. Directions as PLACE_DIR.
  const ANA = {
    'paris orly': 'LFPO NE', 'paris ch. de gaulle': 'LFPG NE', 'paris beauvais': 'LFOB NE', 'lyon st. exupery': 'LFLL NE', 'nice': 'LFMN NE', 'nantes': 'LFRS NE',
    'bordeaux': 'LFBD NE', 'toulouse blagnac': 'LFBO NE', 'lille': 'LFQQ N', 'rome fiumicino': 'LIRF NE', 'milan malpensa': 'LIMC NE', 'milan bergamo': 'LIME NE',
    'milan linate': 'LIML NE', 'venice marco polo': 'LIPZ NE', 'bologna': 'LIPE NE', 'naples': 'LIRN NE', 'berlin brandenburg': 'EDDB N', 'cologne bonn': 'EDDK NE',
    'frankfurt hahn': 'EDFH NE', 'dusseldorf weeze': 'EDLV N', 'memmingen': 'EDJA NE', 'karlsruhe': 'EDSB NE', 'nuremberg': 'EDDN NE', 'leipzig': 'EDDP N',
    'brussels charleroi': 'EBCI N', 'eindhoven': 'EHEH N', 'rotterdam': 'EHRD N', 'london gatwick': 'EGKK N', 'london heathrow': 'EGLL N', 'london luton': 'EGGW N',
    'london stansted': 'EGSS N', 'belfast': 'EGAA N', 'liverpool': 'EGGP N', 'newcastle': 'EGNT N', 'east midlands': 'EGNX N', 'leeds': 'EGNM N', 'norwich': 'EGSH N',
    'bournemouth': 'EGHH N', 'aberdeen dyce': 'EGPD N', 'newquay cornwall': 'EGHQ N', 'prestwick': 'EGPK N', 'cork': 'EICK N', 'shannon': 'EINN N',
    'knock ireland west': 'EIKN N', 'katowice': 'EPKT N', 'poznan': 'EPPO N', 'budapest': 'LHBP NE', 'prague': 'LKPR NE', 'vilnius': 'EYVI N', 'billund': 'EKBI N',
    'helsinki vantaa': 'EFHK N', 'stockholm arlanda': 'ESSA N', 'bucharest otopeni': 'LROP NE', 'sofia': 'LBSF NE', 'istanbul': 'LTFM NE', 'izmir': 'LTBJ NE',
    'tel aviv': 'LLBG NE', 'athens': 'LGAV NE', 'valencia': 'LEVC NE', 'sevilla': 'LEZL NE', 'alicante': 'LEAL NE', 'malaga': 'LEMG NE', 'bilbao': 'LEBB NE',
    'palma mallorca': 'LEPA NE', 'ibiza': 'LEIB NE', 'menorca': 'LEMH NE', 'casablanca': 'GMMN S', 'marrakech': 'GMMX S', 'rabat': 'GMME S', 'tunis': 'DTTA NE',
    'new york jfk': 'KJFK NW', 'washington dulles': 'KIAD NW', 'philadelphia': 'KPHL NW', 'miami': 'KMIA NW', 'montreal trudeau': 'CYUL NW', 'halifax': 'CYHZ NW',
    'são paulo guarulhos': 'SBGR S', 'são paulo viracopos': 'SBKP S', 'rio de janeiro': 'SBGL S', 'fortaleza': 'SBFZ S', 'recife': 'SBRF S', 'salvador': 'SBSV S',
    'luanda antonio neto': 'FNLU S', 'dakar blaise diagne': 'GOBD S', 'praia': 'GVNP S', 'sal': 'GVAC S', 'são vicente': 'GVSV S', 'madeira': 'LPMA NE',
    'reykjavik': 'BIKF NW', 'pico': 'LPPI NW', 'horta': 'LPHR NW', 'flores': 'LPFL NW', 'corvo': 'LPCR NW', 'são jorge': 'LPSJ NW', 'graciosa': 'LPGR NW', 'santa maria': 'LPAZ NW'
  };
  for (const [k, v] of Object.entries(ANA)) { const [icao, dir] = v.split(' '); PLACES[k] ||= icao; PLACE_DIR[icao] ||= dir; }
  const AIRPORTS = {
    LPMA: [32.6942, -16.7781, 'Madeira'], LPPS: [33.0734, -16.3500, 'Porto Santo'], LPPT: [38.7742, -9.1342, 'Lisbon'], LPPR: [41.2481, -8.6814, 'Porto'],
    LPPD: [37.7412, -25.6979, 'Ponta Delgada'], GCLP: [27.9319, -15.3866, 'Gran Canaria'], GCXO: [28.4827, -16.3415, 'Tenerife North'],
    EHAM: [52.3086, 4.7639, 'Amsterdam'], LSZH: [47.4647, 8.5492, 'Zurich'], LSGG: [46.2381, 6.1090, 'Geneva'], EDDL: [51.2895, 6.7668, 'Düsseldorf'],
    EDDF: [50.0333, 8.5706, 'Frankfurt'], EDDM: [48.3538, 11.7861, 'Munich'], EKCH: [55.6181, 12.6561, 'Copenhagen'], LFPO: [48.7233, 2.3794, 'Paris Orly'],
    EGSS: [51.8850, 0.2350, 'London Stansted'], EGKK: [51.1481, -0.1903, 'London Gatwick'], EGLL: [51.4700, -0.4543, 'London Heathrow'],
    EGCC: [53.3537, -2.2750, 'Manchester'], EGBB: [52.4539, -1.7480, 'Birmingham'], EGGD: [51.3827, -2.7191, 'Bristol'],
    EPWA: [52.1657, 20.9671, 'Warsaw'], ELLX: [49.6233, 6.2044, 'Luxembourg'], EDDK: [50.8659, 7.1427, 'Cologne'], EVRA: [56.9236, 23.9711, 'Riga'], EBBR: [50.9014, 4.4844, 'Brussels']
  };

  return {
    icao: 'LPMA', iata: 'FNC', name: 'Madeira', city: 'Funchal', country: 'Portugal', arp: [D(32,41,39), D(16,46,41,true)], elev: 191,
    FIX, ARC, NAV, RWY, STANDS, STAND_EXCLUDE, TAXI, depHold, STARS, HOLDS_AIR, SIDS, DIR, PLACE_DIR, dirFor, APPROACHES,
    WIND_LIMITS, windLimit, anemometers, turbulence, MVA, PEAKS, TMA_NM, RADAR_REF, UNITS, release, TA, TZ, ALTERNATES,
    TIMETABLE, LONG_STAY, EXTRA, EXERCISES, WX_PRESETS, TEL, AIRLINE_ICAO, AIRLINE_TYPE, TYPES, PLACES, AIRPORTS,
    data: { metar: 'lpma/metar.txt', flights: 'lpma/flights.json' },
    features: { roadCrossing: false, sra: false, windLimits: true, anemometers: ['MID', 'ROSARIO'], rnpAR: true, circling: true }
  };
})();
if (typeof module !== 'undefined') module.exports = LPMA;
