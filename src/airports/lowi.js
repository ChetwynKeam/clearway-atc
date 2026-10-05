// ═════════════════════════ Innsbruck (LOWI) airport profile ═════════════════════════
// Everything the Clearway engine needs to know that is true only of Innsbruck. Sources: AIP Austria LOWI AD 2 (text
// pages AD 2.1 to 2.25, AMDT 353) and its charts: aerodrome chart 1-1, SIDs 9-1 and 9-2, STARs 11-1, surveillance
// minimum altitudes 12-1, LOC/DME East 13-1-2-1, RNP VISUAL V 08 13-2-1, RNP E 26 13-2-2, RNP Z 08 and 26 (AR) 13-3,
// visual approach chart 14-1. OpenStreetMap for the taxiway centrelines and stands. Positions are lat/lon (WGS84);
// bearings are TRUE unless named "mag" (variation 4°E: true = magnetic + 4). Summary: airports/lowi/README.md.
// Plain data plus a few small functions, like lpma.js; airports/PLAN-multi-airport.md lists the engine globals.

const LOWI = (() => {
  const ll = s => {                                       // '47 15 31.97N' / '011 19 54.11E' → decimal degrees
    const m = s.trim().match(/^(\d{2,3}) (\d{2}) (\d{2}(?:\.\d+)?)([NSEW])$/);
    const v = +m[1] + m[2]/60 + m[3]/3600; return /[SW]/.test(m[4]) ? -v : v;
  };
  const P = s => { const [a, b] = s.split(/(?<=[NS]) /); return [ll(a), ll(b)]; };

  // ── designated points (AD 2.23 item 2), procedure fixes
  const FIX = {
    ADILO: P('47 20 44.93N 010 56 51.55E'), ADWIG: P('47 20 06.82N 011 51 20.45E'), BILDU: P('47 10 13.60N 010 39 42.41E'),
    BRENO: P('46 58 48.00N 011 22 36.00E'), ELMEM: P('47 17 08.28N 010 34 14.66E'), KOGOL: P('47 37 20.16N 011 23 59.46E'),
    LIZUM: P('47 06 54.25N 011 45 21.73E'), MADEB: P('47 19 27.75N 010 17 19.99E'), MOGTI: P('47 23 20.33N 010 43 00.61E'),
    NANIT: P('47 23 34.87N 012 20 47.17E'), OBEDI: P('47 19 40.43N 013 19 47.09E'), TULSI: P('47 42 05.79N 011 47 19.53E'),
    UMVEG: P('47 12 41.83N 011 53 47.66E'), UNKEN: P('47 49 18.42N 012 36 03.59E'), XEBIX: P('47 24 00.04N 010 28 47.55E'),
    WI002: P('47 22 36.01N 011 49 30.01E'), WI005: P('47 15 08.72N 011 16 06.82E'), WI006: P('47 18 20.40N 011 05 09.80E'),
    WI007: P('47 19 12.18N 010 58 59.94E'), WI008: P('47 16 38.56N 010 59 21.62E'), WI103: P('47 16 16.49N 011 26 47.56E'),
    WI505: P('47 15 08.72N 011 16 06.85E'), WI506: P('47 17 24.69N 011 08 21.27E'), WI507: P('47 18 20.40N 011 05 09.75E'),
    WI520: P('47 16 22.53N 011 26 33.78E'), WI521: P('47 18 41.52N 011 38 50.93E'), WI522: P('47 23 47.76N 011 49 38.00E'),
    WI528: P('47 15 29.00N 011 19 27.00E'), WI529: P('47 15 42.00N 011 16 18.00E'), WI531: P('47 15 04.00N 011 22 06.00E'),
    WI601: P('47 02 04.00N 011 31 44.00E'), WI610: P('47 23 22.41N 011 46 54.41E'), WI611: P('47 19 44.76N 011 40 55.80E'),
    WI612: P('47 18 21.49N 011 38 38.95E'), WI613: P('47 17 53.55N 011 35 47.48E'), WI614: P('47 15 44.57N 011 22 42.29E'),
    WI666: P('47 22 35.13N 011 45 36.39E'), WI700: P('47 15 30.91N 011 20 26.63E'), WI749: P('47 17 22.16N 010 38 42.94E'),
    WI751: P('47 18 34.91N 011 03 09.49E'), WI752: P('47 18 21.18N 011 05 08.91E'), WI753: P('47 15 18.89N 011 14 22.66E'),
    WI754: P('47 15 07.99N 011 16 12.91E'), WI802: P('47 17 46.91N 010 50 22.55E'), WI810: P('47 17 23.71N 010 40 36.33E'),
    WI811: P('47 17 41.19N 010 47 53.94E'), WI812: P('47 17 48.33N 010 50 56.30E'), WI813: P('47 18 04.14N 010 57 49.49E'),
    WI814: P('47 18 13.91N 011 02 13.67E')
  };
  // centres of the RNP AR radius-to-fix arcs (coding tables 13-3-1, 13-3-2, 9-2-2)
  const ARC = { WI009: P('47 17 53.02N 010 58 34.83E'), WI755: P('47 15 40.17N 011 03 27.53E'), WI756: P('47 17 13.57N 011 15 43.43E') };
  // AD 2.19; SBG from STAR 11-1; KPT and PAT positions as published on the SID and visual charts (KPT approximate)
  const NAV = {
    INN: { name: 'Innsbruck NDB', freq: '420', p: P('47 13 48.07N 011 24 06.69E') },
    RTT: { name: 'Rattenberg NDB', freq: '303', p: P('47 25 51.32N 011 56 24.19E') },
    RUM: { name: 'RUM locator', freq: '320', p: P('47 16 33.36N 011 27 53.99E') },
    OEV: { name: 'LOC/DME OEV', freq: '111.10', p: P('47 15 30.84N 011 20 26.21E'), dme: P('47 15 35.48N 011 21 12.73E'), crsMag: 254 },
    OEJ: { name: 'LOC/DME OEJ', freq: '109.70', p: P('47 18 53.41N 011 36 07.82E'), dme: P('47 18 53.37N 011 36 08.03E'), crsMag: 65 },
    SBG: { name: 'Salzburg VOR/DME', freq: '113.80', p: P('48 00 09.30N 012 53 33.94E') },
    PAT: { name: 'Patscherkofel DME', freq: 'CH57X', p: P('47 12 31.00N 011 27 37.00E') },
    KPT: { name: 'Kempten VOR/DME', freq: '109.60', p: [47.7445, 10.3517] }
  };
  // VFR reporting points (AD 2.23 item 3), for the map
  const VFR = { BRENNER: P('47 00 43.00N 011 29 54.00E'), FOXTROT: P('47 17 22.00N 011 52 25.00E'), GOLF: P('47 15 47.00N 011 17 41.00E'),
    HOTEL: P('47 19 48.00N 011 07 27.00E'), INDIA: P('47 14 10.00N 011 16 49.00E'), KILO: P('47 12 40.00N 011 00 00.00E'),
    'MIKE 1': P('47 24 10.00N 011 48 13.00E'), 'MIKE 2': P('47 17 56.00N 011 39 56.00E'), 'MIKE 3': P('47 14 24.00N 011 25 06.00E'),
    'NOVEMBER 1': P('47 23 10.00N 011 15 31.00E'), 'NOVEMBER 2': P('47 20 09.00N 011 10 39.00E'), OSCAR: P('47 14 50.00N 011 24 00.00E'),
    SIERRA: P('47 10 57.00N 011 23 55.00E'), 'WHISKEY 1': P('47 16 40.00N 010 57 51.00E'), 'WHISKEY 2': P('47 17 11.00N 011 10 11.00E') };

  // ── runway (AD 2.12 to 2.14). RWY 08 threshold displaced 60 m; THR 26 at the east end of the pavement.
  const RWY = {
    lo: '08', hi: '26', magHdg: { '08': 77, '26': 257 }, trueHdg: { '08': 80.97, '26': 260.99 }, var: 4,
    thr: { '08': P('47 15 31.97N 011 19 54.11E'), '26': P('47 15 41.82N 011 21 25.24E') },
    elev: { '08': 1907, '26': 1894 }, length: 2000, width: 45, dthr08: 60,
    tora: { '08': 2000, '26': 1940 }, lda: { '08': 1940, '26': 1940 },
    // intersection take-off distances (AD 2.13)
    toraFrom: { '08': { Y: 1806, A: 1586, Z: 671 }, '26': { B: 1602, Z: 1282 } },
    papi: { '08': 'PAPI 3.5°, both sides, MEHT 41 ft', '26': 'PAPI 3.5°, left side, MEHT 44 ft; PALS CAT I 600 m' }
  };

  // ── ground: taxiway names (AD 2.8). A, B and L join the south apron to the runway; Y and Z serve the north (GA) side.
  // Centrelines, holding points and stands come from the OpenStreetMap aerodrome (lowi-engine.js).
  const TAXI = { PHON: { A: 'Alpha', B: 'Bravo', L: 'Lima', Y: 'Yankee', Z: 'Zulu' }, exits: ['A', 'L', 'B'] };

  // ── STARs (chart 11-1), all RNAV. Alt = at-or-above constraint (ft). Clearance limits RTT (east) and ELMEM (west).
  const STARS = {
    'BRENO 3A': { from: 'S',  pts: [['BRENO', 14000], ['LIZUM', 14000], ['UMVEG', 12000], ['RTT', 9500]] },
    'ELMEM 1A': { from: 'W',  pts: [['ELMEM', 14000], ['WI601', 14000], ['LIZUM', 14000], ['UMVEG', 12000], ['RTT', 9500]] },
    'NANIT 2A': { from: 'E',  pts: [['NANIT', 15000], ['RTT', 9500]] },
    'SBG 3A':   { from: 'NE', pts: [['SBG', 9500], ['RTT', 9500]] },
    'TULSI 3A': { from: 'N',  pts: [['TULSI', 9500], ['RTT', 9500]] },
    'BRENO 4B': { from: 'S',  pts: [['BRENO', 14000], ['BILDU', 14000], ['ELMEM', 13000]] },
    'MADEB 1B': { from: 'W',  pts: [['MADEB', 13000], ['ELMEM', 13000]] },
    'XEBIX 1B': { from: 'W',  pts: [['XEBIX', 13000], ['ELMEM', 13000]] },
    'RTT 1B':   { from: 'E',  pts: [['RTT', 13000], ['ELMEM', 13000]] }
  };
  // holdings (chart 11-1D): inbound true, turn, minimum holding altitude, 1 minute legs
  const HOLDS_AIR = {
    RTT: { inb: 228.7, turn: 'R', min: 9500 },
    ELMEM: { inb: 151.6, turn: 'L', min: 13000 }
  };

  // ── SIDs (charts 9-1, 9-2-1). Conventional SIDs fly the LOC OEJ 065 (mag) course east down the valley; in the sim
  // they are flown as these fixes: RWY 08 "J" runway track until intercepting LOC OEJ near RUM, along the LOC to 9500 ft,
  // then on. RWY 26 "H": runway track to D1.2 W OEV (WI528), right onto 271 (mag), at D3.3 W OEV (WI529, 3200 ft or
  // above) a visual LEFT turn back east to join LOC OEJ (via WI531, as coded for RTT 1 R). MOGTI 3 H goes west (RNAV).
  // 'loc' marks the points on the LOC OEJ course (hidden on the map). climbPct: minimum gradient (shown in the strip).
  const SIDS = {
    '08': {
      init: { trk: 81, note: 'runway track with maximum gradient until intercepting LOC OEJ 065, about D7.5 OEJ' },
      'RTT 3J':   { pts: [['RUM'], ['OEJL'], ['RTT']], climbPct: 8.5, turnAlt: 9500 },
      'UNKEN 2J': { pts: [['RUM'], ['OEJL'], ['RTT'], ['UNKEN']], climbPct: 8.5, turnAlt: 9500 },
      'OBEDI 3J': { pts: [['RUM'], ['OEJL'], ['RTT'], ['OBEDI', 13000]], climbPct: 8.5, turnAlt: 9500 },
      'KOGOL 3J': { pts: [['RUM'], ['OEJL'], ['RTT'], ['KOGOL']], climbPct: 8.5, turnAlt: 9500 },
      'BRENO 2J': { pts: [['RUM'], ['OEJ'], ['INN'], ['BRENO']], climbPct: 8.8 },
      'ADILO 2J': { pts: [['RUM'], ['OEJ'], ['INN'], ['ADILO', 13000]], climbPct: 8.8 },
      'KPT 5J':   { pts: [['RUM'], ['INN'], ['MOGTI'], ['KPT']], climbPct: 10.2 }
    },
    '26': {
      init: { trk: 261, note: 'climb visually on runway track, right onto 271 at D1.2 W OEV, visual left turn back east at D3.3 W OEV (3200 ft or above)' },
      'RTT 4H':   { pts: [['WI528'], ['WI529', 3200], ['WI531'], ['WI521'], ['RTT']], climbPct: 6.5 },
      'UNKEN 3H': { pts: [['WI528'], ['WI529', 3200], ['WI531'], ['WI521'], ['RTT'], ['UNKEN']], climbPct: 6.5 },
      'OBEDI 4H': { pts: [['WI528'], ['WI529', 3200], ['WI531'], ['WI521'], ['RTT'], ['OBEDI', 13000]], climbPct: 6.5 },
      'KOGOL 4H': { pts: [['WI528'], ['WI529', 3200], ['WI531'], ['WI521'], ['RTT'], ['KOGOL']], climbPct: 6.5 },
      'BRENO 3H': { pts: [['WI528'], ['WI529', 3200], ['WI531'], ['OEJ'], ['INN'], ['BRENO']], climbPct: 6.5 },
      'MOGTI 3H': { pts: [['WI505', 4000], ['WI506', 7850], ['WI507', 8400], ['WI802', 11350], ['MOGTI', 13000]], climbPct: 11.0, rnav: true }
    }
  };
  // airway directions: each has the STAR an inbound flies and the SID end fix (by departure runway)
  const DIR = {
    // Vienna, Graz, Linz, eastern Europe: east via NANIT / OBEDI
    E:  { star: 'NANIT 2A', sid: { '08': 'OBEDI 3J', '26': 'OBEDI 4H' }, exit: 'OBEDI', acc: 'wien' },
    // Salzburg, Berlin, Hamburg, Scandinavia: north-east via SBG / UNKEN
    NE: { star: 'SBG 3A', sid: { '08': 'UNKEN 2J', '26': 'UNKEN 3H' }, exit: 'UNKEN', acc: 'muenchen' },
    // Munich, Frankfurt, Benelux, UK: north via TULSI / KOGOL
    N:  { star: 'TULSI 3A', sid: { '08': 'KOGOL 3J', '26': 'KOGOL 4H' }, exit: 'KOGOL', acc: 'muenchen' },
    // Italy, Mediterranean: south via BRENO
    S:  { star: 'BRENO 3A', sid: { '08': 'BRENO 2J', '26': 'BRENO 3H' }, exit: 'BRENO', acc: 'padova' },
    // Switzerland, France, Spain, UK from the west: west via ELMEM / ADILO, MOGTI
    W:  { star: 'ELMEM 1A', starW: 'MADEB 1B', sid: { '08': 'ADILO 2J', '26': 'MOGTI 3H' }, exit: { '08': 'ADILO', '26': 'MOGTI' }, acc: 'wien' }
  };
  const PLACE_DIR = {
    LOWW: 'E', LOWG: 'E', LOWL: 'E', LOWK: 'E', LHBP: 'E', LKPR: 'NE', EPWA: 'NE', LOWS: 'NE', EDDB: 'NE', EDDH: 'NE', EDDP: 'NE', EKCH: 'NE', ESSA: 'NE', ENGM: 'NE', EFHK: 'NE',
    EDDM: 'N', EDDF: 'N', EDDS: 'N', EDDK: 'N', EDDL: 'N', EDDN: 'N', EHAM: 'N', EHRD: 'N', EHEH: 'N', EBBR: 'N', ELLX: 'N', EGLL: 'N', EGKK: 'N', EGSS: 'N', EGGW: 'N', EGCC: 'N', EGBB: 'N', EGGD: 'N',
    EGNX: 'N', EGNM: 'N', EGPH: 'N', EGPF: 'N', EGNT: 'N', EGAA: 'N', EIDW: 'N', EGHH: 'N', EGLC: 'N',
    LIRF: 'S', LIML: 'S', LIMC: 'S', LIPB: 'S', LIPZ: 'S', LIRN: 'S', LGAV: 'S', LMML: 'S', LTFM: 'S', LLBG: 'S', HEGN: 'S',
    LSZH: 'W', LSGG: 'W', LFPG: 'W', LFPO: 'W', LEMD: 'W', LEBL: 'W', LEPA: 'W', LPPT: 'W', LFMN: 'W', EGHI: 'W'
  };
  const dirFor = icao => DIR[PLACE_DIR[icao] || 'N'];

  // ── approaches (AD 2.22 items 3.4 to 3.10; charts 13-1-2-1, 13-2-1, 13-2-2, 13-3-1, 13-3-2; visual chart 14-1).
  // LOC/DME East: from RTT on QDR 207 to intercept LOC OEV 254 (mag) about D21 OEV (ADWIG); FAF D19 OEV 9500 ft,
  // then 3.77° (400 ft/NM) with check altitudes at DME fixes; MAPt by missed-approach climb gradient. After the MAPt:
  // straight in to RWY 26, or the right-hand visual circuit south of the field to RWY 08 (chart 14-1: at D4.2 OEV left
  // onto 230, downwind 264 at 3,700 ft minimum, turn at D3.5 W OEV, right base and final 084 to RWY 08).
  const LOC_EAST = {
    crsMag: 254, faf: { dme: 19, alt: 9500 }, intercept: { dme: 21, fix: 'ADWIG' },
    checks: [[19, 9500], [16, 8300], [15, 7900], [14, 7500], [10, 5900], [7, 4700]],
    // OCA by missed approach climb gradient (2.5%, 4%, 5%) and the MAPt that goes with it; the sim uses the 4% line
    oca: [{ grad: 2.5, oca: 4900, mapt: 7.5 }, { grad: 4, oca: 3700, mapt: 4.5 }, { grad: 5, oca: 3300, mapt: 3.5 }],
    // approach clearance minima (AD 2.22 3.2.1); flight visibility in the visual segment 5 km cat C/D (3.1.2.10, chart 14-1)
    minima: { vis: 5000, ceil: 1800 },
    missed: 'at D1.0 OEV turn left onto QDM 060 to RUM, rejoin LOC OEJ outbound, climbing; crossing D14 OEV turn left to RTT, 9500 ft, hold',
    circling: { mnm: 3700, turnOut: 4.2, downwindMag: 264, baseAt: 3.5 }
  };
  const APPROACHES = {
    // RNP E RWY 26 (LPV only, no special authorization): WI610 9500 - WI666 9000 - WI611 7200 - IF WI612 6300 - FAP WI613
    // 5750, 3.5° to MATF WI614 (4.7° offset left of the centreline). OCA 3900 ft at the 5% missed-approach gradient.
    'RNP E 26': {
      rwy: '26', key: 'RNPE26', short: 'RNP E', spoken: 'RNP Echo approach runway two six', iaf: 'WI610', via: ['RTT'],
      legs: [['WI610', 9500], ['WI666', 9000], ['WI611', 7200], ['WI612', 6300], ['WI613', 5750, null, 'FAP'], ['RW26', 1944]],
      profile: [[10, 5750], [9, 5360], [8, 4980], [7, 4590], [6, 4200], [5, 3820], [4, 3440]],
      minima: { da: 3900, dh: 2006, vis: 5000 }, ar: false,
      missed: { legs: [['WI614'], ['WI103'], ['WI612'], ['WI610'], ['RTT']], alt: 9500 }
    },
    // RNP Z RWY 26 (AR): RTT - FAP WI002 - WI103 - RW26, 3.5°; missed approach west, the RF turn round WI009 and back east
    'RNP Z 26': {
      rwy: '26', key: 'RNPZ26', short: 'RNP Z', spoken: 'RNP Zulu approach runway two six', iaf: 'RTT', ar: true,
      legs: [['RTT', 9500], ['WI002', 9500, null, 'FAP'], ['WI103', 3240], ['RW26', 1944]],
      minima: { da: 3700, dh: 1806, vis: 3000 },
      missed: { legs: [['WI005'], ['WI006'], ['WI007'], ['WI008', null, ['WI009', 'L']], ['WI006'], ['WI005'], ['WI103'], ['WI002'], ['RTT']], alt: 11500 }
    },
    // RNP Z RWY 08 (AR), from the west: ELMEM - FAP WI749 13000 - WI751 - RF WI752 - WI753 - RF WI754 - RW08, 3.6°
    'RNP Z 08': {
      rwy: '08', key: 'RNPZ08', short: 'RNP Z', spoken: 'RNP Zulu approach runway zero eight', iaf: 'ELMEM', ar: true,
      legs: [['ELMEM', 13000], ['WI749', 13000, null, 'FAP'], ['WI751', 7500], ['WI752', 7100, ['WI755', 'R']], ['WI753', 4500], ['WI754', 3900, ['WI756', 'L']], ['RW08', 1957]],
      minima: { da: 3700, dh: 1793, vis: 3000 },
      missed: { legs: [['WI103'], ['WI002'], ['RTT']], alt: 9500 }
    },
    // RNP VISUAL V RWY 08: ELMEM - IAF WI810 13000 - WI811 10600 - WI812 9600 - FAF WI813 8300 - MAPt WI814 7100, then
    // visual along the coded track WI006 - WI005 (right) - RW08 (left), 3.77°. Needs 5 km and a 5,200 ft (AAL) ceiling.
    'RNP V 08': {
      rwy: '08', key: 'RNPV08', short: 'RNP Visual V', spoken: 'RNP Visual Victor approach runway zero eight', iaf: 'ELMEM', ar: false, visual: true,
      legs: [['ELMEM', 13000], ['WI810', 13000], ['WI811', 10600], ['WI812', 9600], ['WI813', 8300, null, 'FAP'], ['WI814', 7100], ['WI006', 6600], ['WI005', 3700], ['RW08', 1957]],
      minima: { da: 7100, dh: 5193, vis: 5000 },
      missed: { legs: [['WI005'], ['WI103'], ['RTT']], alt: 9500 }
    }
  };

  // ── foehn (AD 2.22 items 2.10 and 3.1.2.5): surface wind 100°-180°, mean 15-25 kt, gusts 30-50 kt. Severe turbulence,
  // horizontal windshear and downdraughts at all levels, worst over the city below 5,000 ft and on final 08 over the Inn.
  const inSector = (d, a, b) => a <= b ? d >= a && d <= b : d >= a || d <= b;
  const isFoehn = w => !w.vrb && inSector(w.dir, 100, 190) && (w.spd >= 15 || w.gust >= 25);
  // chance of a turbulence or windshear go-around on short final
  function turbulence(w, rwy){
    if (w.vrb || w.spd < 8) return 0;
    if (isFoehn(w)) return Math.min(0.55, 0.12 + Math.max(0, (Math.max(w.gust, w.spd) - 25))/40 + (rwy === '08' ? 0.08 : 0));
    return Math.min(0.12, Math.max(0, (Math.max(w.gust || 0, w.spd) - 22)/60));
  }

  // ── surveillance minimum altitudes (chart 12-1, AMDT 306). Sector name, altitude (ft), polygon (lat/lon). Sectors
  // that follow the state boundary are closed straight across. Applies to vectored flights, not to aircraft on a
  // published procedure (STARs and approaches go much lower down the valley).
  const S_ = s => s.split(' - ').map(P);
  const MVA = [
    ['LOS222', 11000, S_('47 23 44.17N 011 06 15.71E - 47 21 11.11N 011 03 58.50E - 47 17 09.00N 011 00 22.00E - 47 13 20.14N 011 06 54.11E - 47 08 00.00N 011 16 00.00E - 47 05 06.00N 011 21 31.00E - 47 00 03.00N 011 25 50.00E - 46 58 27.93N 011 26 08.52E - 47 00 18.35N 011 30 30.81E - 47 08 00.00N 011 32 30.00E - 47 12 20.00N 011 45 10.00E - 47 13 30.00N 011 57 30.00E - 47 16 11.07N 012 04 26.24E - 47 17 30.00N 012 05 50.00E - 47 16 00.00N 011 54 00.00E - 47 17 25.33N 011 45 37.47E - 47 18 20.00N 011 48 10.00E - 47 18 36.00N 011 38 38.00E - 47 17 53.00N 011 34 21.00E - 47 14 30.00N 011 27 05.00E - 47 13 48.03N 011 24 06.75E - 47 14 00.00N 011 15 38.00E - 47 22 00.00N 011 07 00.00E')],
    ['LOS202', 10600, S_('47 18 36.00N 011 38 38.00E - 47 17 53.00N 011 34 21.00E - 47 14 30.00N 011 27 05.00E - 47 13 48.03N 011 24 06.75E - 47 14 00.00N 011 15 38.00E - 47 22 00.00N 011 07 00.00E - 47 23 44.17N 011 06 15.71E - 47 30 31.23N 011 28 28.14E - 47 28 16.50N 011 38 47.40E')],
    ['LOS208', 10000, S_('47 28 16.50N 011 38 47.40E - 47 27 42.00N 011 41 25.00E - 47 22 20.00N 011 43 40.00E - 47 18 45.10N 011 39 31.75E - 47 19 27.00N 011 47 28.00E - 47 18 15.26N 011 50 48.43E - 47 18 09.92N 011 53 45.05E - 47 20 00.00N 011 56 37.50E - 47 22 09.00N 012 13 16.00E - 47 37 31.11N 012 30 44.17E - 47 20 10.00N 012 29 40.00E - 47 17 43.17N 012 07 46.04E - 47 17 30.00N 012 05 50.00E - 47 16 00.00N 011 54 00.00E - 47 17 25.33N 011 45 37.47E - 47 18 20.00N 011 48 10.00E - 47 18 36.00N 011 38 38.00E')],
    ['LOS203', 9000, S_('47 40 46.03N 012 15 18.88E - 47 30 17.00N 012 11 48.50E - 47 22 17.00N 011 54 15.50E - 47 22 20.00N 011 43 40.00E - 47 27 42.00N 011 41 25.00E - 47 28 16.50N 011 38 47.40E - 47 30 31.23N 011 28 28.14E')],
    ['LOS204', 9500, S_('47 22 20.00N 011 43 40.00E - 47 18 45.10N 011 39 31.75E - 47 19 27.00N 011 47 28.00E - 47 18 15.26N 011 50 48.43E - 47 18 09.92N 011 53 45.05E - 47 20 00.00N 011 56 37.50E - 47 22 09.00N 012 13 16.00E - 47 37 31.11N 012 30 44.17E - 47 40 46.03N 012 15 18.88E - 47 30 17.00N 012 11 48.50E - 47 22 17.00N 011 54 15.50E')],
    ['LOS201', 10600, S_('47 21 11.11N 011 03 58.50E - 47 17 09.00N 011 00 22.00E - 47 17 03.13N 010 58 39.77E - 47 16 05.18N 010 56 24.77E - 47 15 00.22N 010 55 27.52E - 47 14 41.87N 010 41 38.17E - 47 19 05.91N 010 41 24.98E - 47 16 08.62N 010 13 57.14E - 47 16 12.00N 010 10 42.00E - 47 28 45.13N 010 52 53.93E - 47 21 24.23N 010 53 26.78E')],
    ['LOS216', 11500, S_('47 28 45.13N 010 52 53.93E - 47 21 24.23N 010 53 26.78E - 47 21 11.11N 011 03 58.50E - 47 23 44.17N 011 06 15.71E')],
    ['LOS221', 11500, S_('47 16 12.90N 010 10 26.58E - 47 16 04.00N 010 10 00.00E - 47 11 28.00N 010 28 19.00E - 47 12 55.94N 011 01 40.22E - 47 13 20.14N 011 06 54.11E - 47 17 09.00N 011 00 22.00E - 47 17 03.13N 010 58 39.77E - 47 16 05.18N 010 56 24.77E - 47 15 00.22N 010 55 27.52E - 47 14 41.87N 010 41 38.17E - 47 19 05.91N 010 41 24.98E - 47 16 08.62N 010 13 57.14E - 47 16 12.00N 010 10 42.00E')],
    ['LOS215', 13000, S_('46 59 32.12N 011 19 09.64E - 47 07 59.55N 011 15 59.35E - 47 07 55.00N 011 10 05.00E - 47 08 00.00N 010 40 51.52E - 47 11 28.00N 010 28 19.00E - 47 12 55.94N 011 01 40.22E - 47 13 20.14N 011 06 54.11E - 47 08 00.00N 011 16 00.00E - 47 05 06.00N 011 21 31.00E - 47 00 03.00N 011 25 50.00E - 46 58 27.93N 011 26 08.52E')],
    ['LOS220', 13500, S_('46 59 32.12N 011 19 09.64E - 47 07 59.55N 011 15 59.35E - 47 07 55.00N 011 10 05.00E - 47 08 00.00N 010 40 51.52E - 46 58 27.17N 011 15 24.10E')],
    ['LOS217', 15500, S_('47 03 38.78N 009 36 25.48E - 47 11 28.00N 010 28 19.00E - 47 08 00.00N 010 40 51.52E - 46 58 27.17N 011 15 24.10E - 46 51 17.69N 010 28 10.75E')],
    ['LOS218', 15500, S_('47 11 28.00N 010 28 19.00E - 47 16 04.00N 010 10 00.00E - 47 18 08.23N 010 02 44.78E - 47 24 30.42N 009 39 06.87E - 47 03 38.78N 009 36 25.48E')],
    ['LOS219', 10300, S_('47 24 30.42N 009 39 06.87E - 47 18 08.23N 010 02 44.78E - 47 16 04.00N 010 10 00.00E - 47 16 12.90N 010 10 26.58E - 47 32 00.43N 009 43 41.00E')],
    ['LOS213', 11500, S_('47 08 00.00N 011 32 30.00E - 47 12 20.00N 011 45 10.00E - 47 13 30.00N 011 57 30.00E - 47 16 11.07N 012 04 26.24E - 47 09 59.40N 011 57 52.97E')],
    ['LOS214', 13500, S_('47 08 00.00N 011 32 30.00E - 47 09 59.40N 011 57 52.97E - 46 59 32.85N 011 46 54.39E - 47 00 18.35N 011 30 30.81E')],
    ['LOS211', 14500, S_('47 17 30.00N 012 05 50.00E - 47 17 43.17N 012 07 46.04E - 47 17 00.00N 012 29 00.00E - 47 10 45.00N 012 07 55.00E - 47 09 59.40N 011 57 52.97E - 47 16 11.07N 012 04 26.24E')],
    ['LOS210', 14500, S_('46 59 32.85N 011 46 54.39E - 47 09 59.40N 011 57 52.97E - 47 10 45.00N 012 07 55.00E - 47 17 00.00N 012 29 00.00E - 47 02 58.28N 011 59 39.81E')],
    ['LOS209', 14500, S_('47 17 43.17N 012 07 46.04E - 47 20 10.00N 012 29 40.00E - 47 17 00.00N 012 29 00.00E')],
    ['LOS207', 14500, S_('47 02 58.28N 011 59 39.81E - 47 17 00.00N 012 29 00.00E - 47 15 57.01N 012 51 38.93E - 46 37 59.74N 012 48 14.33E')],
    ['LOS206', 14500, S_('47 20 10.00N 012 29 40.00E - 47 20 10.00N 012 54 50.00E - 47 14 00.00N 013 30 00.00E - 47 15 57.01N 012 51 38.93E - 47 17 00.00N 012 29 00.00E')],
    ['LOS205', 11500, S_('47 37 31.11N 012 30 44.17E - 47 20 10.00N 012 29 40.00E - 47 20 10.00N 012 54 50.00E - 47 14 00.00N 013 30 00.00E - 47 02 45.00N 013 41 00.00E - 47 12 00.00N 013 56 50.00E - 47 25 39.98N 013 39 52.49E - 47 34 48.00N 013 29 41.00E - 47 27 14.00N 013 29 45.00E - 47 20 31.00N 013 33 37.00E - 47 18 01.00N 013 13 18.00E - 47 27 14.00N 013 13 08.00E - 47 37 06.10N 013 04 47.66E')],
    ['EDS4', 9500, S_('47 46 20.00N 011 55 00.00E - 47 47 47.00N 012 39 17.00E - 47 44 03.00N 012 46 18.00E - 47 43 32.09N 012 54 15.38E - 47 40 49.74N 013 04 43.58E - 47 37 52.00N 012 55 43.00E - 47 41 00.00N 012 53 00.00E - 47 41 00.00N 012 46 00.00E - 47 39 58.45N 012 45 41.09E - 47 30 31.23N 011 28 28.14E')],
    ['EDS5', 7500, S_('47 50 30.00N 012 00 00.00E - 47 52 03.00N 012 16 13.00E - 47 51 17.00N 012 34 46.00E - 47 48 53.00N 012 37 52.00E - 47 47 47.00N 012 39 17.00E - 47 46 20.00N 011 55 00.00E')]
  ].map(([name, alt, poly]) => ({ name, alt, poly }));
  // MSA 25 NM from RTT (chart 13-1-2-1): 10300 ft 270°-120° (mag), 14200 ft 120°-210°, 11600 ft 210°-270°
  const MSA = { ref: 'RTT', sectors: [[270, 120, 10300], [120, 210, 14200], [210, 270, 11600]] };
  // high ground round the valley (spot heights, ft) from the charts, for the map
  const PEAKS = [['Nordkette', 47.3075, 11.3807, 7657], ['Patscherkofel', 47.2086, 11.4603, 7369], ['Serles', 47.1253, 11.3893, 8944],
    ['Kellerjoch', 47.3285, 11.7375, 7690], ['Glungezer', 47.2213, 11.5264, 8783], ['Hohe Munde', 47.3375, 11.0995, 8622], ['Rangger Köpfl', 47.2433, 11.2380, 6430],
    ['Hoher Burgstall', 47.1607, 11.3036, 8681], ['Nockspitze', 47.1840, 11.2880, 7890], ['Zugspitze', 47.4211, 10.9853, 9718]];
  const CTR = S_('47 25 00.00N 011 44 20.00E - 47 24 06.00N 011 44 51.00E - 47 23 40.00N 011 45 04.00E - 47 23 04.00N 011 45 27.00E - 47 18 20.00N 011 48 10.00E - 47 12 30.00N 011 26 45.00E - 47 11 15.00N 011 22 10.00E - 47 07 55.00N 011 10 05.00E - 47 10 40.00N 011 00 45.00E - 47 15 12.00N 011 02 40.00E - 47 15 48.00N 011 00 50.00E - 47 18 09.00N 011 00 06.00E - 47 19 17.00N 011 01 25.00E - 47 19 30.00N 011 04 30.00E - 47 17 23.00N 011 13 14.00E - 47 18 25.00N 011 17 22.00E');
  const RADAR_REF = NAV.INN.p;

  // ── units, frequencies, coordination (AD 2.18). Releases and hand-offs: Wien Radar (east, west), München Radar
  // (north, north-east), Padova (south, over the Brenner).
  const UNITS = {
    app: { name: 'Innsbruck Radar', freq: '128.975' }, twr: { name: 'Innsbruck Tower', freq: '120.100' }, atis: { name: 'Innsbruck information', freq: '126.030' }
  };
  const ACC = { wien: ['Wien Radar', '134.675'], muenchen: ['München Radar', '129.100'], padova: ['Padova Control', '120.725'] };
  const release = icao => ACC[dirFor(icao).acc];
  // no transition altitude is published (MRVA too varied); departures change to flight levels at 10,000 ft (AD 2.17)
  const TA = 10000, TZ = 'Europe/Vienna';
  const ALTERNATES = [['Munich', 'EDDM', 'KOGOL'], ['Salzburg', 'LOWS', 'UNKEN'], ['Bolzano', 'LIPB', 'BRENO']];

  // ── traffic. A representative autumn week, times UTC (local is UTC+2 in summer time). Operators are the real ones
  // serving Innsbruck; flight numbers and times are representative, not a published timetable. The winter Saturday
  // charter wave (UK, Netherlands, Scandinavia) is on day 6.
  // [arrival cs, from, landing, departure cs, to, off-blocks, type, days (1 = Monday), stand hint]
  const TIMETABLE = [
    ['AUA901',  'LOWW', '05:50', 'AUA902',  'LOWW', '06:30', 'DH8D', '123456', null],
    ['KLM1993', 'EHAM', '08:05', 'KLM1994', 'EHAM', '08:45', 'E195', '1357', null],
    ['EWG7942', 'EDDH', '08:30', 'EWG7943', 'EDDH', '09:10', 'A319', '15', null],
    ['AUA903',  'LOWW', '09:15', 'AUA904',  'LOWW', '09:55', 'E195', '1234567', null],
    ['EZY8341', 'EGKK', '10:10', 'EZY8342', 'EGKK', '10:50', 'A319', '36', null],
    ['TRA6871', 'EHRD', '10:35', 'TRA6872', 'EHRD', '11:15', 'B738', '6', null],
    ['BAW588',  'EGLL', '10:55', 'BAW589',  'EGLL', '11:45', 'A320', '67', null],
    ['EWG2852', 'EDDB', '11:20', 'EWG2853', 'EDDB', '12:00', 'A320', '47', null],
    ['EXS3141', 'EGCC', '11:40', 'EXS3142', 'EGCC', '12:30', 'B738', '6', null],
    ['SXS2716', 'EDDK', '12:05', 'SXS2717', 'EDDK', '12:45', 'B738', '6', null],
    ['TOM3402', 'EGGW', '12:25', 'TOM3403', 'EGGW', '13:15', 'B738', '6', null],
    ['AUA905',  'LOWW', '13:30', 'AUA906',  'LOWW', '14:10', 'E195', '1234567', null],
    ['EZY8459', 'EGGD', '14:05', 'EZY8460', 'EGGD', '14:45', 'A320', '6', null],
    ['NOZ5536', 'ENGM', '14:30', 'NOZ5537', 'ENGM', '15:20', 'B38M', '6', null],
    ['KLM1995', 'EHAM', '15:20', 'KLM1996', 'EHAM', '16:00', 'E190', '257', null],
    ['EWG7944', 'EDDL', '15:50', 'EWG7945', 'EDDL', '16:30', 'A319', '36', null],
    ['DLH2286', 'EDDF', '16:15', 'DLH2287', 'EDDF', '16:55', 'CRJ9', '1357', null],
    ['AUA907',  'LOWW', '17:10', 'AUA908',  'LOWW', '17:50', 'DH8D', '1234567', null],
    ['EZY8343', 'EGKK', '17:35', 'EZY8344', 'EGKK', '18:15', 'A319', '15', null],
    ['SXS7810', 'LTAI', '18:05', 'SXS7811', 'LTAI', '18:45', 'B738', '3', null],
    ['AUA909',  'LOWW', '19:40', null, null, null, 'DH8D', '1234567', null],
    [null, null, null, 'KLM1992', 'EHAM', '06:10', 'E195', '246', null]
  ];
  const LONG_STAY = [['OEFIT', 'C56X', null, '1234567'], ['OEGVA', 'GLF6', null, '67']];
  const EXTRA = [
    { cs: 'TYW4421', t: 'PC12', k: 'ARR', o: 'LOWW' }, { cs: 'NJE341T', t: 'C56X', k: 'DEP', d: 'EGGW' },
    { cs: 'EJU7633', t: 'A320', k: 'ARR', o: 'LFPG' }, { cs: 'VJT603',  t: 'GLF6', k: 'DEP', d: 'LFPB' },
    { cs: 'CLH9441', t: 'CRJ9', k: 'ARR', o: 'EDDM' }, { cs: 'TVS1702', t: 'B738', k: 'DEP', d: 'LKPR' },
    { cs: 'EDW128',  t: 'A320', k: 'ARR', o: 'LSZH' }, { cs: 'SAS2917', t: 'A20N', k: 'DEP', d: 'EKCH' },
    { cs: 'OEFJL',   t: 'C56X', k: 'ARR', o: 'LIRF' }, { cs: 'JAF7712', t: 'B38M', k: 'DEP', d: 'EBBR' }
  ];
  const EXERCISES = {
    dep: { name: 'Innsbruck 1 · First departure down the valley', wx: 'west', rwy: '26', depRwy: '08', sched: [{ cs: 'AUA904', t: 'E195', k: 'DEP', d: 'LOWW', m: 0 }] },
    arr: { name: 'Innsbruck 2 · The LOC/DME East', wx: 'west', rwy: '26', depRwy: '08', sched: [{ cs: 'KLM1993', t: 'E195', k: 'ARR', o: 'EHAM', m: 0 }] },
    foehn: { name: 'Innsbruck 3 · Föhn', wx: 'foehn', rwy: '26', depRwy: '08', sched: [{ cs: 'EZY8341', t: 'A319', k: 'ARR', o: 'EGKK', m: 0 }, { cs: 'EWG7943', t: 'A319', k: 'DEP', d: 'EDDH', m: 2 }, { cs: 'AUA903', t: 'E195', k: 'ARR', o: 'LOWW', m: 5 }] }
  };
  const WX_PRESETS = {
    west:    { name: 'Light westerly, land 26, depart 08',              short: 'Westerly',  metar: 'LOWI 051350Z 25006KT 9999 FEW060 17/07 Q1018' },
    calm:    { name: 'Calm autumn morning, valley haze',                short: 'Calm',      metar: 'LOWI 050650Z VRB02KT 6000 HZ FEW045 08/05 Q1021' },
    foehn:   { name: 'Föhn: southerly gale over the Wipptal',           short: 'Föhn',      metar: 'LOWI 051350Z 18018G32KT 9999 FEW090 SCT140 22/04 Q1006' },
    east:    { name: 'Easterly: circle to land on runway 08',           short: 'Easterly',  metar: 'LOWI 051350Z 07012KT 9999 SCT045 15/08 Q1015' },
    stratus: { name: 'Low stratus in the valley, below LOC minima',     short: 'Low cloud', metar: 'LOWI 050650Z 24004KT 4000 BR BKN012 OVC030 07/06 Q1023' },
    snow:    { name: 'Snow showers, ceiling at the RNP E minima',       short: 'Snow',      metar: 'LOWI 051350Z 27008KT 5000 -SHSN BKN020 OVC040 M01/M03 Q1012' },
    storm:   { name: 'Afternoon thunderstorms over the Nordkette',      short: 'Storm',     metar: 'LOWI 051350Z 28012G26KT 8000 TSRA FEW040CB BKN070 21/15 Q1012' }
  };

  // airline radio telephony and ICAO codes seen at Innsbruck (merged into the engine's tables)
  const TEL = { AUA: 'Austrian', KLM: 'KLM', EWG: 'Eurowings', EZY: 'Easy', EJU: 'Alpine', BAW: 'Speedbird', EXS: 'Channex', TOM: 'Tomjet', TRA: 'Transavia',
    SXS: 'Sunexpress', NOZ: 'Nordic', DLH: 'Lufthansa', CLH: 'Hansaline', EDW: 'Edelweiss', SAS: 'Scandinavian', TVS: 'Skytravel', JAF: 'Beauty',
    TYW: 'Tyrol', NJE: 'Fraction', VJT: 'Vista' };
  const AIRLINE_ICAO = { OS: 'AUA', KL: 'KLM', EW: 'EWG', U2: 'EZY', DS: 'EZS', EC: 'EJU', BA: 'BAW', LS: 'EXS', BY: 'TOM', HV: 'TRA', XQ: 'SXS', DY: 'NOZ', D8: 'NOZ',
    LH: 'DLH', CL: 'CLH', WK: 'EDW', SK: 'SAS', QS: 'TVS', TB: 'JAF', FR: 'RYR', EN: 'DLA', '4Y': 'OCN', LG: 'LGL', OK: 'CSA', JU: 'ASL', SN: 'BEL', AF: 'AFR' };
  const AIRLINE_TYPE = { AUA: 'E195', KLM: 'E195', EWG: 'A319', EZY: 'A319', EZS: 'A320', EJU: 'A320', BAW: 'A320', EXS: 'B738', TOM: 'B738', TRA: 'B738', SXS: 'B738',
    NOZ: 'B38M', DLH: 'CRJ9', CLH: 'CRJ9', EDW: 'A320', SAS: 'A20N', TVS: 'B738', JAF: 'B38M', RYR: 'B738', DLA: 'E195', OCN: 'A320', LGL: 'DH8D', CSA: 'A320' };
  const TYPES = {
    DH8D: { name: 'Dash 8-400',    wake: 'M', vapp: 120, vr: 120, climb: 2000, desc: 1800, cruise: 260, span: 28.4, len: 32.8, shape: 'prop' },
    E195: { name: 'Embraer 195',   wake: 'M', vapp: 130, vr: 135, climb: 2300, desc: 2000, cruise: 280, span: 28.7, len: 38.7, shape: 'jet' },
    E190: { name: 'Embraer 190',   wake: 'M', vapp: 128, vr: 132, climb: 2400, desc: 2000, cruise: 280, span: 28.7, len: 36.2, shape: 'jet' },
    CRJ9: { name: 'CRJ900',        wake: 'M', vapp: 135, vr: 140, climb: 2500, desc: 2000, cruise: 280, span: 24.9, len: 36.2, shape: 'jet' },
    B38M: { name: '737 MAX 8',     wake: 'M', vapp: 145, vr: 150, climb: 2400, desc: 2100, cruise: 290, span: 35.9, len: 39.5, shape: 'jet' }
  };
  const PLACES = {
    'wien': 'LOWW', 'vienna': 'LOWW', 'amsterdam': 'EHAM', 'hamburg': 'EDDH', 'berlin': 'EDDB', 'düsseldorf': 'EDDL', 'dusseldorf': 'EDDL', 'köln': 'EDDK', 'koeln': 'EDDK', 'cologne': 'EDDK',
    'frankfurt': 'EDDF', 'nuremberg': 'EDDN', 'nürnberg': 'EDDN', 'münchen': 'EDDM', 'munich': 'EDDM', 'london gatwick': 'EGKK', 'london-gatwick': 'EGKK', 'gatwick': 'EGKK', 'london heathrow': 'EGLL', 'london-heathrow': 'EGLL', 'heathrow': 'EGLL',
    'london luton': 'EGGW', 'london stansted': 'EGSS', 'london city': 'EGLC', 'manchester': 'EGCC', 'birmingham': 'EGBB', 'bristol': 'EGGD', 'edinburgh': 'EGPH', 'glasgow': 'EGPF',
    'east midlands': 'EGNX', 'leeds': 'EGNM', 'newcastle': 'EGNT', 'belfast': 'EGAA', 'dublin': 'EIDW', 'rotterdam': 'EHRD', 'eindhoven': 'EHEH', 'brüssel': 'EBBR', 'brussels': 'EBBR',
    'kopenhagen': 'EKCH', 'copenhagen': 'EKCH', 'stockholm': 'ESSA', 'oslo': 'ENGM', 'helsinki': 'EFHK', 'zürich': 'LSZH', 'zurich': 'LSZH', 'genf': 'LSGG', 'geneva': 'LSGG',
    'paris': 'LFPG', 'rom': 'LIRF', 'rome': 'LIRF', 'antalya': 'LTAI', 'palma': 'LEPA', 'madrid': 'LEMD', 'barcelona': 'LEBL', 'prag': 'LKPR', 'prague': 'LKPR', 'warschau': 'EPWA', 'warsaw': 'EPWA',
    'bournemouth': 'EGHH', 'southampton': 'EGHI', 'salzburg': 'LOWS', 'graz': 'LOWG', 'linz': 'LOWL', 'klagenfurt': 'LOWK', 'luxemburg': 'ELLX', 'luxembourg': 'ELLX', 'nizza': 'LFMN', 'nice': 'LFMN'
  };
  const AIRPORTS = {
    LOWI: [47.2602, 11.3439, 'Innsbruck'], LOWW: [48.1103, 16.5697, 'Vienna'], LOWS: [47.7933, 13.0043, 'Salzburg'], EDDM: [48.3538, 11.7861, 'Munich'],
    EHAM: [52.3086, 4.7639, 'Amsterdam'], EHRD: [51.9569, 4.4372, 'Rotterdam'], EDDH: [53.6304, 9.9882, 'Hamburg'], EDDB: [52.3667, 13.5033, 'Berlin'],
    EDDL: [51.2895, 6.7668, 'Düsseldorf'], EDDK: [50.8659, 7.1427, 'Cologne'], EDDF: [50.0333, 8.5706, 'Frankfurt'], EGLL: [51.4700, -0.4543, 'London Heathrow'],
    EGKK: [51.1481, -0.1903, 'London Gatwick'], EGGW: [51.8747, -0.3683, 'London Luton'], EGCC: [53.3537, -2.2750, 'Manchester'], EGGD: [51.3827, -2.7191, 'Bristol'],
    ENGM: [60.1939, 11.1004, 'Oslo'], LTAI: [36.8987, 30.8005, 'Antalya'], LSZH: [47.4647, 8.5492, 'Zurich'], LFPG: [49.0097, 2.5479, 'Paris CDG'],
    LIRF: [41.8003, 12.2389, 'Rome'], LIPB: [46.4602, 11.3264, 'Bolzano'], EKCH: [55.6181, 12.6561, 'Copenhagen'], LKPR: [50.1008, 14.2600, 'Prague'], EBBR: [50.9014, 4.4844, 'Brussels']
  };

  return {
    icao: 'LOWI', iata: 'INN', name: 'Innsbruck', city: 'Innsbruck', country: 'Austria', arp: P('47 15 37.00N 011 20 38.00E'), elev: 1907,
    FIX, ARC, NAV, VFR, RWY, TAXI, STARS, HOLDS_AIR, SIDS, DIR, PLACE_DIR, dirFor, LOC_EAST, APPROACHES,
    isFoehn, turbulence, MVA, MSA, PEAKS, CTR, RADAR_REF, UNITS, ACC, release, TA, TZ, ALTERNATES,
    TIMETABLE, LONG_STAY, EXTRA, EXERCISES, WX_PRESETS, TEL, AIRLINE_ICAO, AIRLINE_TYPE, TYPES, PLACES, AIRPORTS,
    data: { metar: 'lowi/metar.txt', flights: 'lowi/flights.json' },
    features: { roadCrossing: false, sra: false, splitRunways: true, foehn: true, rnpAR: true, circling: true, mva: true }
  };
})();
if (typeof module !== 'undefined') module.exports = LOWI;
