// ═════════════════════════ London Heathrow (EGLL) airport profile ═════════════════════════
// Everything the Clearway engine needs to know that is true only of Heathrow. Sources: UK AIP AD 2-EGLL (AIRAC 10/26):
// aerodrome chart 2-4 (thresholds, frequencies), parking charts 2-1 (stand positions), ground movement chart 2-2,
// the holding area charts 2-9 to 2-12 (27R, 27L, 09L, 09R), SIDs 6-1 to 6-6 (conventional, flown by RNAV substitution),
// RNAV1 STARs 7-1 to 7-12 with their coding tables 7-13 to 7-17, the BNN, LAM, BIG and OCK holds 7-18/7-19, the ILS/DME
// approaches 8-1 to 8-8 and the RNP approaches' coding (8-9 to 8-13), and OpenStreetMap for the taxiways, stands, aprons and
// buildings (egll-ground.js). Positions are lat/lon (WGS84); variation 1.2°E. Summary of the charts: airports/egll/README.md.
// Heathrow has two parallel runways 1,415 m apart, run in segregated mode: one lands, the other departs. In the westerly
// (about 70% of the year) the runways alternate at 15:00 local every day and week by week, so that the towns under the
// approaches get a break: one week 27L lands until 15:00 and 27R after, the next the other way round (altPlan). The
// easterly alternates the same way, 09R and 09L. Both runways land from 06:00 to 07:00; at night one runway does it
// all. The terminals sit between the runways (2 and 3 in the Central Area, 5 at the west end) and to the south (4, and the cargo area): their traffic crosses the southern runway.
// Plain data plus a few small functions, like egcc.js; egll-engine.js turns it into the engine's globals.

const EGLL = (() => {
  const ll = (s) => {                                     // '512839N' / '0002741.5W' → decimal degrees
    const m = s.match(/^(\d{2,3})(\d{2})(\d{2}(?:\.\d+)?)([NSEW])$/);
    const v = +m[1] + m[2]/60 + m[3]/3600; return /[SW]/.test(m[4]) ? -v : v;
  };
  const P = (lat, lon) => [ll(lat), ll(lon)];

  // ── fixes. STAR fixes from the coding tables (7-13..7-17); the SID end fixes; the RNP approaches' intermediate fixes
  // (8-9..8-13, 10 NM out on each centreline). The SIDs are conventional (VOR/DME): their turn points and level gates (a
  // LON, BUR, CHT, WOD, EPM, OCK, MID, DET or BPK radial and DME) are worked out here as points named after the chart's
  // definition (L255D7: LON radial 255 at 7 DME; B160L93: BUR radial 160 at LON 9.3 DME).
  const FIX = {
    // STARs
    OTMET: P('504055.06N', '0023053.37W'), SOKDU: P('503939.22N', '0020133.06W'), NEDUL: P('503958.00N', '0013251.86W'), BEGTO: P('504545.12N', '0011407.99W'),
    HAZEL: P('510019.03N', '0005904.06W'), LLS01: P('511021.99N', '0004108.43W'), ROXOG: P('501558.29N', '0013344.41W'), AMTOD: P('503215.69N', '0012544.46W'),
    ALESO: P('503432.24N', '0011331.50E'), ROTNO: P('505126.07N', '0004641.20E'), ETVAX: P('505806.99N', '0003556.27E'), TIGER: P('510401.82N', '0002621.54E'),
    LLE01: P('511113.96N', '0001521.68E'), HILLY: P('512006.04N', '0001437.38E'), TANET: P('512658.00N', '0005531.99E'), LLE02: P('511857.68N', '0002109.87E'),
    DORKI: P('511633.00N', '0001552.00W'), NUGRA: P('530146.43N', '0021813.52W'), TOBID: P('521259.55N', '0012759.21W'), SOPIT: P('515729.84N', '0010626.35W'),
    WEZKO: P('515110.51N', '0005744.67W'), DONNA: P('514200.38N', '0004437.04W'), BARMI: P('522841.76N', '0023413.73E'), SONOG: P('520619.71N', '0021610.08E'),
    LOGAN: P('514451.32N', '0013642.58E'), SABER: P('514213.76N', '0005658.19E'), BRASO: P('514106.57N', '0004100.03E'), WESUL: P('514015.29N', '0002909.27E'),
    LLW02: P('512403.91N', '0004336.89W'), FITBO: P('521308.55N', '0022412.55W'), SIRIC: P('512036.17N', '0013358.89W'), NIGIT: P('511846.96N', '0011014.71W'),
    LLW03: P('511832.83N', '0004556.94W'),
    // SID end fixes
    MAXIT: P('511459N', '0003343W'), MODMI: P('511401N', '0002910W'), UMLAT: P('514020N', '0004139W'), ULTIB: P('513936N', '0001644W'),
    GOGSI: P('511727N', '0010002W'), GASGU: P('511224N', '0005736W'),
    // SID turn points and gates: off 27R/27L
    L255D5: P('512802.4N', '0003547.8W'), L255D7: P('512733.8N', '0003854.9W'), L239D5: P('512644.9N', '0003458.0W'), B160L77: P('512340.5N', '0003633.4W'),
    B160L93: P('512103.7N', '0003507.7W'), B160L12: P('511741.6N', '0003317.2W'), B296L6: P('513008.3N', '0003731.4W'), B296L7: P('513037.0N', '0003901.1W'),
    C052R304: P('513353.6N', '0003836.4W'), C052R325: P('513537.9N', '0003452.6W'), B355L8: P('513047.9N', '0004035.9W'), B355L10: P('513503.5N', '0004103.1W'),
    W268L93: P('512715.3N', '0004235.5W'), W268L13: P('512712.1N', '0004837.1W'), S032D328: P('512445.8N', '0005151.7W'), S032D296: P('512205.1N', '0005440.5W'),
    L270D2: P('512834.1N', '0003132.1W'), D271D29: P('511920.8N', '0001041.8W'), D271D20: P('511900.1N', '0000344.6E'),
    // off 09R/09L
    L090D2: P('512838.8N', '0002445.7W'), L150D3: P('512625.7N', '0002531.5W'), W280L4: P('512418.6N', '0002933.9W'), L124D35: P('512712.9N', '0002324.5W'),
    L124D5: P('512621.1N', '0002126.4W'), M025D18: P('511923.0N', '0002444.4W'), M025D15: P('511641.5N', '0002652.0W'), L070D6: P('513110.0N', '0001852.8W'),
    L070D10: P('513227.4N', '0001248.0W'), K195D10: P('513522.8N', '0001052.8W'), K195D6: P('513913.3N', '0000905.3W'), G328D20: P('513701.8N', '0001421.6W'),
    D282D29: P('512451.3N', '0000930.1W'), D282D20: P('512248.0N', '0000434.1E'), L119D4: P('512713.3N', '0002226.9W'), O041D2: P('511946.9N', '0002440.6W'),
    O253D47: P('511701.2N', '0003405.7W'),
    // approaches: the RNP intermediate fixes (10 NM), used as the ILS intermediate fixes too
    ABAVI: P('512834.45N', '0004505.67W'), BENPA: P('512748.76N', '0004455.76W'), NEKSA: P('512755.72N', '0001001.89W'), IVLAR: P('512841.57N', '0001000.08W'),
    // missed approaches (8-1..8-8): 27R right onto 315°, 27L left onto 146°, 09L left onto 035°, 09R straight ahead
    MA27R: P('513153.9N', '0003406.1W'), MA27L: P('512406.3N', '0002501.6W'), MA09L: P('513217.5N', '0002143.7W'), MA09R: P('512750.4N', '0001712.8W')
  };
  // VOR/DMEs and the NDBs the SIDs use
  const NAV = {
    LON: { name: 'London VOR/DME', freq: '113.60', p: P('512914N', '0002800W') },
    BNN: { name: 'Bovingdon VOR/DME', freq: '113.75', p: P('514334.19N', '0003259.10W') },
    LAM: { name: 'Lambourne VOR/DME', freq: '115.60', p: P('513845.69N', '0000906.13E') },
    BIG: { name: 'Biggin VOR/DME', freq: '115.10', p: P('511951.15N', '0000205.32E') },
    OCK: { name: 'Ockham VOR/DME', freq: '115.30', p: P('511818.17N', '0002649.86W') },
    CPT: { name: 'Compton VOR/DME', freq: '114.35', p: P('512929.66N', '0011310.89W') },
    DET: { name: 'Detling VOR/DME', freq: '117.30', p: P('511814.41N', '0003550.19E') },
    BPK: { name: 'Brookmans Park VOR/DME', freq: '117.50', p: P('514459N', '0000624W') },
    MID: { name: 'Midhurst VOR/DME', freq: '114.00', p: P('510314N', '0003730W') },
    SAM: { name: 'Southampton VOR/DME', freq: '110.75', p: P('505719N', '0012042W') },
    HON: { name: 'Honiley VOR/DME', freq: '113.65', p: P('522124.04N', '0013949.41W') },
    WOD: { name: 'Woodley NDB', freq: '352', p: P('512710.02N', '0005243.68W') },
    EPM: { name: 'Epsom NDB', freq: '316', p: P('511910N', '0002219W') },
    CHT: { name: 'Chiltern NDB', freq: '277', p: P('513723N', '0003107W') },
    BUR: { name: 'Burnham NDB', freq: '421', p: P('513108N', '0004038W') }
  };

  // ── runways (AD 2-EGLL-2-4): 09L/27R 3902 × 50 m, 09R/27L 3660 × 50 m, both 09 thresholds displaced about 305 m.
  const RWY = {
    list: ['09L27R', '09R27L'], var: 1.2,
    thr: { '09L': P('512839.00N', '0002906.05W'), '27R': P('512839.63N', '0002559.74W'), '09R': P('512753.25N', '0002856.41W'), '27L': P('512753.83N', '0002602.68W') },
    elev: { '09L': 79, '27R': 78, '09R': 75, '27L': 77 }
  };
  // segregated mode: one runway lands, the other departs. Both directions alternate at 15:00, so there are two
  // configurations each way. Keyed by the configuration; the engine finds one from the landing runway.
  const CONFIGS = {
    west:  { land: '27R', dep: '27L', name: 'West 27R' },
    west2: { land: '27L', dep: '27R', name: 'West 27L' },
    east:  { land: '09L', dep: '09R', name: 'East 09L' },
    east2: { land: '09R', dep: '09L', name: 'East 09R' }
  };
  // runway alternation (Heathrow's Runway Alternation Programme 2026), in UK local time (BST from the last Sunday in
  // March to the last Sunday in October, else GMT). Weeks run from Monday 06:00 (the night before still follows the
  // week before), counted from the week commencing 5 January 2026.
  // - Day (06:00 to the last departure, about 23:30): one runway lands, the other departs, swapping at 15:00. Even
  //   weeks land on the southern runway (27L / 09R) until 15:00 and the northern one (27R / 09L) after, odd weeks the
  //   reverse (5 Jan: 27L then 27R; 12 Oct: 27L then 27R; 19 Oct: 27R then 27L).
  // - 06:00 to 07:00, the arrivals rush: both runways take arrivals; departures use the morning's departure runway.
  // - Night (23:30 to 06:00): one runway does everything, on a four-week cycle: 27R, 09R, 27L, 09L (primary), each
  //   flown the other way round (the secondary) when the wind needs it.
  const londonOff = ms => { const y = new Date(ms).getUTCFullYear(), lastSun = mo => { const d = new Date(Date.UTC(y, mo + 1, 0, 1)); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); return d.getTime(); };
    return ms >= lastSun(2) && ms < lastSun(9) ? 60 : 0; };
  const ALT_SWITCH = 15*60, DUAL = [6*60, 7*60], NIGHT_FROM = 23*60 + 30, NIGHT_TO = 6*60;
  const NIGHT_RWY = ['27R', '09R', '27L', '09L'], OTHER_END = { '27R': '09L', '09L': '27R', '27L': '09R', '09R': '27L' };
  // tail: { 27: true when 27 has more than 5 kt of tailwind, '09': the same for 09 }
  const altPlan = (ms, tail = {}) => {
    const L = ms + londonOff(ms)*60000, t = new Date(L), mins = t.getUTCHours()*60 + t.getUTCMinutes();
    const wk = Math.floor((L - 6*3600e3 - Date.UTC(2026, 0, 5))/(7*864e5)), mod = n => ((wk % n) + n) % n;
    if (mins >= NIGHT_FROM || mins < NIGHT_TO) {
      let rw = NIGHT_RWY[mod(4)]; if (tail[rw.slice(0, 2)]) rw = OTHER_END[rw];
      return { mode: 'night', land: rw, dep: rw, lands: [rw] };
    }
    const east = !!tail[27], pm = mins >= ALT_SWITCH, north = (mod(2) === 0) === pm;
    const land = east ? (north ? '09L' : '09R') : (north ? '27R' : '27L'), dep = { '27R': '27L', '27L': '27R', '09L': '09R', '09R': '09L' }[land];
    return mins < DUAL[1] ? { mode: 'dual', land, dep, lands: [land, dep] } : { mode: 'day', land, dep, lands: [land] };
  };
  const altLand = (ms, utcOffMin, east = false) => altPlan(ms, { 27: east }).land;

  // ── STARs (7-1..7-17). Every one ends at one of the four London holds at FL70; Heathrow Director vectors the
  // arrivals from the bottom of the stacks onto the ILS. Alt = level constraint (feet).
  const STARS = {
    'NUGRA 2H':  { pts: [['NUGRA'], ['TOBID', 20000], ['SOPIT', 15000], ['WEZKO'], ['BNN', 7000]] },
    'FITBO 2H':  { pts: [['FITBO', 18000], ['SOPIT', 15000], ['WEZKO'], ['BNN', 7000]] },
    'HON 2H':    { pts: [['HON'], ['TOBID'], ['SOPIT', 15000], ['WEZKO'], ['BNN', 7000]] },
    'SIRIC 1Z':  { pts: [['SIRIC', 14000], ['CPT'], ['BNN', 7000]] },
    'LAM 1Z':    { pts: [['LAM'], ['DONNA'], ['BNN', 7000]] },
    'BARMI 1H':  { pts: [['BARMI', 30000], ['SONOG'], ['LOGAN', 25000], ['SABER', 16000], ['BRASO'], ['WESUL'], ['LAM', 7000]] },
    'LOGAN 2H':  { pts: [['LOGAN', 25000], ['SABER', 16000], ['BRASO'], ['WESUL'], ['LAM', 7000]] },
    'ALESO 1H':  { pts: [['ALESO'], ['ROTNO'], ['ETVAX', 18000], ['TIGER'], ['LLE01'], ['BIG', 7000]] },
    'TANET 1Z':  { pts: [['TANET'], ['DET'], ['LLE02'], ['BIG', 7000]] },
    'LAM 1X':    { pts: [['LAM'], ['HILLY'], ['BIG', 7000]] },
    'OCK 1Z':    { pts: [['OCK'], ['DORKI'], ['HILLY'], ['BIG', 7000]] },
    'OTMET 1H':  { pts: [['OTMET', 27000], ['SOKDU'], ['NEDUL', 21000], ['BEGTO'], ['HAZEL', 13000], ['LLS01'], ['OCK', 7000]] },
    'ROXOG 1H':  { pts: [['ROXOG'], ['AMTOD'], ['BEGTO'], ['HAZEL', 13000], ['LLS01'], ['OCK', 7000]] },
    'HAZEL 1H':  { pts: [['HAZEL', 13000], ['LLS01'], ['OCK', 7000]] },
    'SIRIC 1H':  { pts: [['SIRIC', 14000], ['NIGIT'], ['LLW03'], ['OCK', 7000]] },
    'TOBID 1X':  { pts: [['TOBID'], ['WOD'], ['LLW02'], ['OCK', 7000]] },
    'BIG 1Z':    { pts: [['BIG'], ['DORKI'], ['OCK', 7000]] },
    'LAM 1Y':    { pts: [['LAM'], ['DORKI'], ['OCK', 7000]] }
  };
  // the London holds (7-18, 7-19): inbound track (true), turn, FL70 to FL150 (LAM and BIG FL140 published top), 220 kt
  const HOLDS_AIR = {
    BNN: { inb: 116.5, turn: 'R', min: 7000, max: 15000, maxKt: 220 },
    LAM: { inb: 263.0, turn: 'L', min: 7000, max: 14000, maxKt: 220 },
    BIG: { inb: 302.3, turn: 'R', min: 7000, max: 14000, maxKt: 220 },
    OCK: { inb: 328.5, turn: 'R', min: 7000, max: 15000, maxKt: 220 }
  };

  // ── approaches. ILS/DME on all four runway ends (8-1..8-8), CAT III: glidepath intercept at 3,000 ft about 9.5 NM
  // out, 2,500 ft at the final approach point (7.5 NM). Intermediate fix: the RNP approach's IF (10 NM) on the same
  // centreline. Missed approaches to 3,000 ft: 27R right onto 315°; 27L climb to 2,000 ft then left onto 146°; 09L left
  // onto 035°; 09R straight ahead.
  const ILS = {
    '27R': { loc: 'I-RR', freq: '110.30', ifx: 'IVLAR', ifAlt: 3000, missed: ['MA27R', 3000], turn: 1, mins: { vis: 75, ceil: 0 } },
    '27L': { loc: 'I-LL', freq: '109.50', ifx: 'NEKSA', ifAlt: 3000, missed: ['MA27L', 3000], turn: -1, mins: { vis: 75, ceil: 0 } },
    '09L': { loc: 'I-AA', freq: '110.30', ifx: 'ABAVI', ifAlt: 3000, missed: ['MA09L', 3000], turn: -1, mins: { vis: 75, ceil: 0 } },
    '09R': { loc: 'I-BB', freq: '109.50', ifx: 'BENPA', ifAlt: 3000, missed: ['MA09R', 3000], turn: 0, mins: { vis: 75, ceil: 0 } }
  };

  // ── SIDs (6-1..6-6), conventional, flown by RNAV substitution. All stop at 6,000 ft (the transition altitude), with
  // gates on the way. Designators: F off 27R, G off 27L, J off 09R, K off 09L. Alt = level at the fix (feet).
  const W27 = { CPT: [['L255D7'], ['WOD', 4000], ['CPT', 6000]], BPK: [['B296L6'], ['C052R304', 4000], ['C052R325', 5000], ['CHT', 6000], ['BPK', 6000]],
    UMLAT: [['B296L7'], ['B355L8', 3000], ['B355L10', 4000], ['UMLAT', 6000]], GOGSI: [['L255D7'], ['W268L93', 3000], ['W268L13', 4000], ['S032D328', 5000], ['S032D296', 6000], ['GOGSI', 6000]],
    DET: [['L270D2'], ['EPM', 4000], ['D271D29', 5000], ['D271D20', 6000], ['DET', 6000]] };
  const MAX = d => [[d], ['B160L77', 3000], ['B160L93', 4000], ['B160L12'], ['MAXIT', 6000]];
  const E09 = { CPT: [['L090D2'], ['L150D3'], ['W280L4'], ['WOD', 4000], ['CPT', 6000]], MODMI: [['L090D2'], ['L124D35'], ['M025D18', 4000], ['M025D15', 5000], ['MODMI', 6000]],
    BPK: [['L090D2'], ['L070D6'], ['L070D10', 3000], ['K195D10', 4000], ['K195D6', 6000], ['BPK', 6000]], ULTIB: [['L090D2'], ['L070D6'], ['L070D10', 3000], ['G328D20', 5000], ['ULTIB', 6000]],
    DET: [['L090D2'], ['L119D4'], ['D282D29', 3000], ['D282D20', 5000], ['DET', 6000]], GASGU: [['L090D2'], ['L124D5'], ['O041D2', 4000], ['OCK'], ['O253D47', 6000], ['GASGU', 6000]] };
  const SAY = { CPT: 'Compton', MAXIT: 'Maxit', MODMI: 'Modmi', BPK: 'Brookmans Park', UMLAT: 'Umlat', ULTIB: 'Ultib', DET: 'Detling', GOGSI: 'Gogsi', GASGU: 'Gasgu' };
  const NUM = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'], LET = { F: 'Foxtrot', G: 'Golf', J: 'Juliett', K: 'Kilo' };
  const RWY_OF = { F: '27R', G: '27L', J: '09R', K: '09L' };
  const SIDS = {};
  const sid = (base, n, d, pts) => { SIDS[base + n + d] = { rwy: RWY_OF[d], spoken: `${SAY[base]} ${NUM[n]} ${LET[d]}`, pts }; };
  sid('CPT', 3, 'F', W27.CPT); sid('CPT', 3, 'G', W27.CPT); sid('CPT', 5, 'J', E09.CPT); sid('CPT', 4, 'K', E09.CPT);
  sid('MAXIT', 1, 'F', MAX('L255D5')); sid('MAXIT', 1, 'G', MAX('L239D5')); sid('MODMI', 1, 'J', E09.MODMI); sid('MODMI', 1, 'K', E09.MODMI);
  sid('BPK', 7, 'F', W27.BPK); sid('BPK', 7, 'G', W27.BPK); sid('BPK', 6, 'J', E09.BPK); sid('BPK', 5, 'K', E09.BPK);
  sid('UMLAT', 1, 'F', W27.UMLAT); sid('UMLAT', 1, 'G', W27.UMLAT); sid('ULTIB', 1, 'J', E09.ULTIB); sid('ULTIB', 1, 'K', E09.ULTIB);
  sid('DET', 2, 'F', W27.DET); sid('DET', 2, 'G', W27.DET); sid('DET', 1, 'J', E09.DET); sid('DET', 1, 'K', E09.DET);
  sid('GOGSI', 2, 'F', W27.GOGSI); sid('GOGSI', 2, 'G', W27.GOGSI); sid('GASGU', 2, 'J', E09.GASGU); sid('GASGU', 2, 'K', E09.GASGU);
  // the SID family for each direction, by runway: west-about name and number, east-about name and number
  const fam = (w, e) => {
    const n = { CPT: ['3', '3', '5', '4'], MAXIT: ['1', '1'], BPK: ['7', '7', '6', '5'], UMLAT: ['1', '1'], DET: ['2', '2', '1', '1'], GOGSI: ['2', '2'], MODMI: [, , '1', '1'], ULTIB: [, , '1', '1'], GASGU: [, , '2', '2'] };
    return { '27R': w + n[w][0] + 'F', '27L': w + n[w][1] + 'G', '09R': e + n[e][2] + 'J', '09L': e + n[e][3] + 'K' };
  };

  // ── airway directions: the STAR an arrival flies, where the simulator picks it up (45-65 NM out), the SIDs and the
  // London Control sector that takes the departure (by SID: Compton and Gogsi/Gasgu west, Maxit/Modmi south, Detling
  // east, Brookmans Park north-east, Umlat/Ultib north)
  const DIR = {
    N:  { star: 'NUGRA 2H', entry: 'TOBID', alt: 17000, sid: fam('UMLAT', 'ULTIB'), ctr: 'n',  name: 'Scotland, northern England and Iceland' },
    NW: { star: 'FITBO 2H', entry: 'SOPIT', alt: 15000, sid: fam('CPT', 'CPT'),     ctr: 'w',  name: 'Ireland, Canada and the USA' },
    W:  { star: 'SIRIC 1H', entry: 'SIRIC', alt: 14000, sid: fam('CPT', 'CPT'),     ctr: 'w',  name: 'Wales, the West Country and the Channel Islands' },
    SW: { star: 'OTMET 1H', entry: 'NEDUL', alt: 17000, sid: fam('GOGSI', 'GASGU'), ctr: 'w', name: 'Portugal, the Canaries, West Africa and South America' },
    S:  { star: 'ROXOG 1H', entry: 'AMTOD', alt: 17000, sid: fam('MAXIT', 'MODMI'), ctr: 's', name: 'France, Spain, Morocco and Africa' },
    SE: { star: 'ALESO 1H', entry: 'ROTNO', alt: 18000, sid: fam('DET', 'DET'),     ctr: 'e',  name: 'Italy, the Balkans, Greece and the Middle East' },
    ESE:{ star: 'TANET 1Z', entry: 'TANET', alt: 15000, sid: fam('DET', 'DET'),     ctr: 'e',  name: 'Germany, central Europe, India and the Far East' },
    NE: { star: 'LOGAN 2H', entry: 'SABER', alt: 16000, sid: fam('BPK', 'BPK'),     ctr: 'ne', name: 'the Netherlands, Scandinavia and the Baltic' }
  };
  const PLACE_DIR = {
    EGPD: 'N', EGPE: 'N', EGPF: 'N', EGPH: 'N', EGPN: 'N', EGNT: 'N', EGCC: 'N', BIKF: 'N',
    EGAA: 'NW', EGAE: 'NW', EGNS: 'NW', EIDW: 'NW', EIKN: 'NW', EINN: 'NW', CYHZ: 'NW', CYOW: 'NW', CYUL: 'NW', CYYZ: 'NW', CYYC: 'NW', CYVR: 'NW', KBOS: 'NW', KJFK: 'NW',
    KPHL: 'NW', KBWI: 'NW', KIAD: 'NW', KCLT: 'NW', KRDU: 'NW', KATL: 'NW', KMIA: 'NW', KMCO: 'NW', KTPA: 'NW', KCVG: 'NW', KDTW: 'NW', KPIT: 'NW', KORD: 'NW', KMSP: 'NW',
    KSTL: 'NW', KBNA: 'NW', KMSY: 'NW', KAUS: 'NW', KDFW: 'NW', KIAH: 'NW', KDEN: 'NW', KPHX: 'NW', KLAS: 'NW', KSAN: 'NW', KLAX: 'NW', KSFO: 'NW', KPDX: 'NW', KSEA: 'NW',
    MMMX: 'NW', MYNN: 'NW', TXKF: 'NW', TBPB: 'SW',
    EICK: 'W', EGJJ: 'W', EGJB: 'W', EGGD: 'W', EGFF: 'W', EGHI: 'W',
    LPPT: 'SW', LPFR: 'SW', LEST: 'SW', LEBB: 'SW', LEZL: 'SW', LEMG: 'SW', LXGB: 'SW', GMMN: 'SW', GMMX: 'SW', SBGR: 'SW', SBGL: 'SW', SCEL: 'SW', SKBO: 'SW', DNMM: 'SW',
    DNAA: 'SW', DGAA: 'SW',
    LFPG: 'S', LFBO: 'S', LFLL: 'S', LFML: 'S', LFMN: 'S', LFSB: 'S', LEBL: 'S', LEMD: 'S', LEVC: 'S', LEPA: 'S', LEIB: 'S', DAAG: 'S', FAOR: 'S', FACT: 'S', HKJK: 'S',
    HRYR: 'S', HAAB: 'S', LSGG: 'S',
    LIRF: 'SE', LIRN: 'SE', LIRQ: 'SE', LIRP: 'SE', LIPE: 'SE', LIMC: 'SE', LIPZ: 'SE', LICJ: 'SE', LMML: 'SE', LGAV: 'SE', LGKR: 'SE', LGSR: 'SE', LDDU: 'SE', LDSP: 'SE',
    LDZA: 'SE', LJLJ: 'SE', LATI: 'SE', LYBE: 'SE', LBSF: 'SE', LROP: 'SE', LTFM: 'SE', LCLK: 'SE', LLBG: 'SE', OJAI: 'SE', OLBA: 'SE', HECA: 'SE', HELX: 'SE', OEJN: 'SE',
    OERK: 'SE', OKKK: 'SE', OBBI: 'SE', OTHH: 'SE', OMDB: 'SE', OMAA: 'SE', OOMS: 'SE', UGTB: 'SE', LSZH: 'SE',
    EDDF: 'ESE', EDDM: 'ESE', EDDS: 'ESE', EDDL: 'ESE', ELLX: 'ESE', EBBR: 'ESE', LOWW: 'ESE', LKPR: 'ESE', LHBP: 'ESE', EPWA: 'ESE', OPLA: 'ESE', VIDP: 'ESE', VABB: 'ESE',
    VOBL: 'ESE', VOMM: 'ESE', VOHS: 'ESE', VCBI: 'ESE', VTBS: 'ESE', VVNB: 'ESE', WMKK: 'ESE', WSSS: 'ESE', VHHH: 'ESE', ZGGG: 'ESE', ZSPD: 'ESE', RCTP: 'ESE',
    EHAM: 'NE', EDDH: 'NE', EDDB: 'NE', EDDV: 'NE', EKCH: 'NE', EKBI: 'NE', ESSA: 'NE', ESGG: 'NE', ENGM: 'NE', EFHK: 'NE', ZBAA: 'NE', ZSQD: 'NE', RKSI: 'NE', RJAA: 'NE',
    EGKK: 'S', EGSS: 'NE', EGGW: 'N', EGLC: 'NE'
  };
  const dirFor = icao => DIR[PLACE_DIR[icao] || 'S'];

  // ── units and frequencies (aerodrome chart 2-4, SIDs 6-1). Heathrow Tower splits into Arrivals (118.505) and
  // Departures (118.705); the approach is Heathrow Director; departures go to London Control by SID.
  const UNITS = {
    atis: { name: 'Heathrow Information', freq: '128.080' }, datis: { name: 'Heathrow Departure Information', freq: '121.935' },
    del: { name: 'Heathrow Delivery', freq: '121.980' }, gnd: { name: 'Heathrow Ground', freq: '121.905', alt: ['121.705', '121.855'] },
    twr: { name: 'Heathrow Tower', freq: '118.505', alt: ['118.705', '124.480'] },
    app: { name: 'Heathrow Director', freq: '119.730', alt: ['120.400', '127.525', '134.980'] }, dir: { name: 'Heathrow Radar', freq: '125.625' },
    fire: { name: 'Heathrow Fire', freq: '121.605' }
  };
  const CTR = { w: ['London Control', '134.125'], s: ['London Control', '133.180'], ne: ['London Control', '118.825'], n: ['London Control', '119.780'], e: ['London Control', '120.530'] };
  const TA = 6000, TZ = 'Europe/London';
  // where cruising flights over the south-east divert to with a sick passenger (medical diversions in emerg.js)
  const ALTERNATES = [['Gatwick', 'EGKK', 'OCK'], ['Stansted', 'EGSS', 'LAM'], ['Luton', 'EGGW', 'BNN']];

  // ── traffic. Built from Heathrow's real boards of Monday 2026-10-12 (tools/egll_timetable.py): every arrival paired
  // with a departure of the same airline (the same city first), thinned to 40 movements an hour (the real airport runs
  // about 85). [arrival, from, arrival UTC, departure, to, departure UTC, type]; a departure with no arrival night-stopped.
  const ROWS = [
    ['QFA219', 'WSSS', '04:05', 'QFA220', 'WSSS', '06:35', 'A388'], ['VIR92', 'KMCO', '04:20', 'VIR91', 'KMCO', '07:05', 'B789'], ['BAW16', 'WSSS', '04:35', 'BAW65', 'HKJK', '08:45', 'B772'],
    ['BAW56', 'FAOR', '04:35', 'BAW139', 'VABB', '08:40', 'B772'], ['CPA251', 'VHHH', '04:40', 'CPA254', 'VHHH', '07:10', 'B77W'], ['BAW184', 'KJFK', '04:50', 'BAW53', 'KSEA', '08:50', 'B772'],
    ['UAL16', 'KJFK', '04:55', 'UAL123', 'KJFK', '06:45', 'B763'], [null, null, null, 'SWR345', 'LSZH', '05:00', 'BCS3'], [null, null, null, 'AUA340', 'LOWW', '05:00', 'A320'],
    [null, null, null, 'TAP1363', 'LPPT', '05:00', 'A21N'], ['BAW78', 'DGAA', '05:15', 'BAW175', 'KJFK', '09:15', 'B772'], ['BAW64', 'HKJK', '05:15', 'BAW207', 'KMIA', '08:55', 'B772'],
    [null, null, null, 'BAW1436', 'EGPH', '05:15', 'A20N'], [null, null, null, 'AFR1381', 'LFPG', '05:15', 'A20N'], [null, null, null, 'BAW456', 'LEMD', '05:15', 'A320'],
    [null, null, null, 'BAW420', 'LEMG', '05:15', 'A320'], ['AAL50', 'KDFW', '05:20', 'AAL51', 'KDFW', '07:55', 'B789'], ['VIR4', 'KJFK', '05:20', 'VIR185', 'TBPB', '08:35', 'A339'],
    ['BAW216', 'KIAD', '05:20', 'BAW143', 'VIDP', '09:20', 'A388'], [null, null, null, 'BAW824', 'EIDW', '05:20', 'A20N'], [null, null, null, 'BAW472', 'LEBL', '05:25', 'A319'],
    [null, null, null, 'DLH921', 'EDDF', '05:30', 'A20N'], ['VIR450', 'FAOR', '05:30', 'VIR7', 'KLAX', '08:55', 'A35K'], [null, null, null, 'LOT286', 'EPWA', '05:30', 'B38M'],
    ['JBU1620', 'KBOS', '05:30', 'JBU1621', 'KBOS', '07:40', 'A21N'], [null, null, null, 'THY1988', 'LTFM', '05:30', 'A21N'], [null, null, null, 'BAW1472', 'EGPF', '05:30', 'A20N'],
    [null, null, null, 'KLM1000', 'EHAM', '05:30', 'B738'], [null, null, null, 'BAW742', 'LSGG', '05:35', 'A319'], [null, null, null, 'BAW850', 'LKPR', '05:35', 'A319'],
    ['BAW158', 'TXKF', '05:40', 'BAW285', 'KSFO', '09:45', 'B772'], [null, null, null, 'SAS1530', 'ESSA', '05:40', 'A20N'], [null, null, null, 'BAW546', 'LIRF', '05:40', 'A320'],
    [null, null, null, 'SAS500', 'EKCH', '05:40', 'A20N'], ['BAW52', 'KSEA', '05:45', 'BAW55', 'KSEA', '08:15', 'B78X'], ['UAL929', 'KORD', '05:45', 'UAL959', 'KORD', '10:05', 'B772'],
    ['VIR10', 'KJFK', '05:45', 'VIR302', 'VIDP', '09:40', 'A339'], [null, null, null, 'BAW902', 'EDDF', '05:45', 'A20N'], ['BAW142', 'VIDP', '05:50', 'BAW145', 'VIDP', '08:20', 'B772'],
    [null, null, null, 'BAW722', 'LOWW', '05:50', 'A20N'], ['BAW246', 'SBGR', '05:50', 'BAW247', 'SBGR', '08:20', 'B772'], [null, null, null, 'BAW428', 'EHAM', '05:50', 'A20N'],
    [null, null, null, 'BAW730', 'LSZH', '05:50', 'A319'], [null, null, null, 'BEL2104', 'EBBR', '05:50', 'A320'], ['UAL918', 'KIAD', '05:55', 'UAL879', 'KIAH', '09:00', 'B789'],
    [null, null, null, 'DLH2483', 'EDDM', '05:55', 'A321'], [null, null, null, 'BAW1300', 'EGPD', '05:55', 'A319'], ['ETD61', 'OMAA', '06:00', 'ETD62', 'OMAA', '08:30', 'B78X'],
    [null, null, null, 'SWR359', 'LSGG', '06:00', 'A21N'], [null, null, null, 'BAW704', 'LCLK', '06:00', 'A20N'], [null, null, null, 'BAW812', 'EKCH', '06:05', 'A20N'],
    [null, null, null, 'BAW770', 'ESSA', '06:05', 'A20N'], ['BAW212', 'KBOS', '06:05', 'BAW215', 'KBOS', '08:35', 'B78X'], [null, null, null, 'BAW926', 'EDDM', '06:10', 'A20N'],
    [null, null, null, 'BAW568', 'LIMC', '06:10', 'A319'], [null, null, null, 'BAW986', 'EDDB', '06:10', 'A20N'], [null, null, null, 'BAW918', 'EDDL', '06:10', 'A320'],
    [null, null, null, 'BAW500', 'LPPT', '06:15', 'A20N'], [null, null, null, 'BAW1326', 'EGNT', '06:15', 'A320'], [null, null, null, 'BAW490', 'LXGB', '06:20', 'A319'],
    ['BAW911', 'EDDF', '06:20', 'BAW474', 'LEBL', '07:30', 'A321'], ['VIR303', 'VIDP', '06:20', 'VIR105', 'KSEA', '10:40', 'A35K'], [null, null, null, 'BAW300', 'LFPG', '06:20', 'A320'],
    [null, null, null, 'BAW582', 'LIMC', '06:20', 'A320'], ['BAW1499', 'EGPF', '06:25', 'BAW1478', 'EGPF', '07:25', 'A321'], ['BAW971', 'EDDH', '06:25', 'BAW968', 'EDDH', '07:15', 'A321'],
    ['EWG9462', 'EDDL', '06:25', 'EWG9463', 'EDDL', '07:05', 'A20N'], [null, null, null, 'DLH2485', 'EDDM', '06:25', 'A320'], [null, null, null, 'BAW842', 'EPWA', '06:30', 'A20N'],
    [null, null, null, 'DLH923', 'EDDF', '06:30', 'A321'], [null, null, null, 'BAW780', 'ENGM', '06:30', 'A320'], ['SVA111', 'OERK', '06:30', 'SVA110', 'OERK', '09:00', 'B77W'],
    [null, null, null, 'FIN1340', 'EFHK', '06:30', 'A321'], [null, null, null, 'BAW1438', 'EGPH', '06:35', 'A319'], ['BAW445', 'EHAM', '06:40', 'BAW600', 'LIPZ', '07:50', 'A320'],
    ['DLH924', 'EDDF', '06:40', 'DLH925', 'EDDF', '07:30', 'A20N'], [null, null, null, 'BAW800', 'BIKF', '06:40', 'A20N'], ['BAW176', 'KJFK', '06:45', 'BAW189', 'KJFK', '09:15', 'B772'],
    ['UAL880', 'KIAH', '06:45', 'UAL17', 'KJFK', '09:25', 'B763'], [null, null, null, 'BAW366', 'LFBO', '06:50', 'A320'], ['AAL736', 'KPHL', '06:50', 'AAL9746', 'KPHL', '09:05', 'B772'],
    [null, null, null, 'BAW458', 'LEMD', '06:50', 'A20N'], ['SWR316', 'LSZH', '06:55', 'SWR317', 'LSZH', '07:40', 'A20N'], [null, null, null, 'BAW540', 'LIPE', '06:55', 'A320'],
    [null, null, null, 'BAW548', 'LIRF', '06:55', 'A20N'], [null, null, null, 'UAL958', 'KORD', '07:00', 'B789'], ['AAL108', 'KBOS', '07:00', 'AAL195', 'KPHX', '09:05', 'B772'],
    ['QTR119', 'OTHH', '07:00', 'QTR120', 'OTHH', '08:30', 'A359'], ['EIN152', 'EIDW', '07:05', 'EIN153', 'EIDW', '07:50', 'A21N'], ['EWG7460', 'EDDH', '07:05', 'EWG7461', 'EDDH', '07:45', 'A20N'],
    [null, null, null, 'BAW688', 'LGSR', '07:05', 'A319'], ['VIR6', 'KMIA', '07:05', 'VIR358', 'VABB', '11:25', 'A35K'], [null, null, null, 'BAW424', 'LEMG', '07:10', 'A319'],
    ['BAW248', 'SBGL', '07:10', 'BAW271', 'KLAS', '11:15', 'B772'], ['BAW1379', 'EGCC', '07:10', 'BAW1360', 'EGCC', '07:55', 'A321'], ['SWR352', 'LSGG', '07:15', 'SWR353', 'LSGG', '07:55', 'A20N'],
    [null, null, null, 'BAW826', 'EIDW', '07:15', 'A319'], [null, null, null, 'BAW614', 'LIRP', '07:20', 'A20N'], [null, null, null, 'BAW416', 'ELLX', '07:20', 'A20N'],
    [null, null, null, 'BAW712', 'GMMX', '07:25', 'A319'], ['BAW581', 'LIMC', '07:25', 'BAW570', 'LIMC', '08:30', 'A321'], ['BAW545', 'LIPE', '07:30', 'BAW526', 'LIRN', '09:05', 'A321'],
    ['BAW116', 'KJFK', '07:30', 'BAW181', 'KJFK', '11:30', 'B78X'], ['ACA856', 'CYYZ', '07:35', 'ACA855', 'CYYZ', '11:05', 'B789'], ['BAW941', 'EDDM', '07:35', 'BAW598', 'LIPZ', '09:10', 'A321'],
    ['BAW1467', 'EGPH', '07:35', 'BAW468', 'LEPA', '09:10', 'A21N'], ['MSR783', 'HECA', '07:40', 'MSR784', 'HECA', '08:40', 'A21N'], ['DLH900', 'EDDF', '07:40', 'DLH901', 'EDDF', '08:30', 'A20N'],
    [null, null, null, 'KLM1002', 'EHAM', '07:40', 'B738'], ['SAS525', 'ESSA', '07:55', 'SAS526', 'ESSA', '08:55', 'A20N'], ['KLM1003', 'EHAM', '08:00', 'KLM1004', 'EHAM', '08:55', 'E195'],
    ['AAL38', 'KMIA', '08:00', 'AAL39', 'KMIA', '11:15', 'B789'], ['EIN154', 'EIDW', '08:05', 'EIN155', 'EIDW', '08:50', 'A320'], ['EIN380', 'EINN', '08:05', 'EIN381', 'EINN', '08:50', 'A21N'],
    ['RWD710', 'HRYR', '08:05', 'RWD713', 'HRYR', '10:35', 'A333'], ['FIN1331', 'EFHK', '08:10', 'FIN1332', 'EFHK', '09:20', 'A321'], ['BAW487', 'LEBL', '08:10', 'BAW476', 'LEBL', '10:00', 'A320'],
    ['VIR158', 'KBOS', '08:15', 'VIR19', 'KSFO', '11:45', 'B789'], ['BAW190', 'KAUS', '08:15', 'BAW35', 'VOMM', '11:40', 'B772'], ['LOT281', 'EPWA', '08:20', 'LOT282', 'EPWA', '09:20', 'E195'],
    ['UAL940', 'KJFK', '08:20', 'UAL147', 'KJFK', '11:00', 'B763'], ['VIR198', 'TBPB', '08:20', 'VIR45', 'KJFK', '11:50', 'A35K'], ['BAW639', 'LGAV', '08:30', 'BAW706', 'LCLK', '09:40', 'A21N'],
    ['IBE713', 'LEMD', '08:30', 'IBE714', 'LEMD', '09:50', 'A21N'], ['ACA852', 'CYYZ', '08:35', 'ACA2081', 'CYHZ', '11:40', 'B789'], ['BAW1497', 'EGPF', '08:35', 'BAW848', 'LDZA', '09:35', 'A21N'],
    ['SAS803', 'ENGM', '08:35', 'SAS804', 'ENGM', '09:35', 'A20N'], ['BAW94', 'CYUL', '08:40', 'BAW5', 'RJAA', '12:05', 'B772'], ['BAW611', 'LIPZ', '08:50', 'BAW602', 'LIPZ', '10:50', 'A321'],
    ['BAW961', 'EDDH', '08:55', 'BAW964', 'EDDH', '10:05', 'A319'], ['BAW228', 'KBWI', '08:55', 'BAW81', 'DGAA', '12:30', 'B78X'], ['ACA864', 'CYUL', '09:00', 'ACA865', 'CYUL', '13:05', 'B789'],
    ['VIR359', 'VABB', '09:00', 'VIR208', 'RKSI', '12:25', 'B789'], ['BAW891', 'UGTB', '09:00', 'BAW494', 'LEPA', '10:10', 'A21N'], ['DAL3', 'KJFK', '09:04', 'DAL9', 'KMSP', '11:25', 'A359'],
    ['UAL923', 'KLAX', '09:10', 'UAL935', 'KLAX', '12:05', 'B78X'], ['BAW1427', 'EGPE', '09:10', 'BAW904', 'EDDF', '10:20', 'A321'], ['AAL728', 'KPHL', '09:20', 'AAL737', 'KPHL', '12:00', 'B772'],
    ['TAP1356', 'LPPT', '09:20', 'TAP1367', 'LPPT', '10:20', 'A20N'], ['UAL146', 'KJFK', '09:25', 'UAL949', 'KSFO', '12:00', 'B789'], ['AAL194', 'KPHX', '09:30', 'AAL55', 'KORD', '11:15', 'B789'],
    ['BAW721', 'LTFM', '09:30', 'BAW432', 'EHAM', '10:40', 'A320'], ['BAW182', 'KJFK', '09:35', 'BAW159', 'TXKF', '13:20', 'B772'], ['IBE715', 'LEMD', '09:35', 'IBE716', 'LEMD', '10:30', 'A21N'],
    ['BAW1437', 'EGPH', '09:35', 'BAW1448', 'EGPH', '11:55', 'A21N'], ['BAW1473', 'EGPF', '09:40', 'BAW1484', 'EGPF', '12:10', 'A21N'], ['BAW1343', 'EGJB', '09:45', 'BAW1344', 'EGJB', '10:55', 'A320'],
    ['BAW567', 'LIMC', '09:45', 'BAW574', 'LIMC', '10:55', 'A319'], ['BAW222', 'KBNA', '09:50', 'BAW273', 'KSAN', '13:30', 'B772'], ['BAW292', 'KIAD', '09:50', 'BAW287', 'KSFO', '13:30', 'B78X'],
    ['AAL54', 'KORD', '09:50', 'AAL91', 'KORD', '13:45', 'B789'], ['BAW192', 'KDFW', '09:55', 'BAW197', 'KIAH', '13:45', 'A388'], ['BAW1327', 'EGNT', '10:00', 'BAW554', 'LIRF', '11:10', 'A320'],
    ['BAW743', 'LSGG', '10:00', 'BAW748', 'LSGG', '10:45', 'A321'], ['BAW284', 'KSFO', '10:00', 'BAW269', 'KLAX', '14:05', 'B78X'], ['BAW1391', 'EGAA', '10:05', 'BAW1400', 'EGAA', '12:10', 'A321'],
    ['AAL134', 'KLAX', '10:05', 'AAL105', 'KJFK', '13:10', 'B789'], ['UAL948', 'KSFO', '10:10', 'UAL928', 'KORD', '13:10', 'B763'], ['BAW919', 'EDDL', '10:10', 'BAW1308', 'EGPD', '11:20', 'A320'],
    ['EIN158', 'EIDW', '10:10', 'EIN163', 'EIDW', '12:25', 'A21N'], ['BAW385', 'EBBR', '10:10', 'BAW386', 'EBBR', '10:55', 'A320'], ['BAW296', 'KORD', '10:15', 'BAW297', 'KORD', '14:15', 'B772'],
    ['AEE600', 'LGAV', '10:15', 'AEE601', 'LGAV', '11:15', 'A20N'], ['BAW270', 'KLAS', '10:15', 'BAW243', 'MMMX', '14:10', 'B772'], ['MEA201', 'OLBA', '10:15', 'MEA202', 'OLBA', '12:00', 'A21N'],
    ['BAW1301', 'EGPD', '10:15', 'BAW460', 'LEMD', '11:20', 'A321'], ['AUA333', 'LOWW', '10:25', 'AUA334', 'LOWW', '11:20', 'A20N'], ['AIC111', 'VIDP', '10:30', 'AIC112', 'VIDP', '12:15', 'B77W'],
    ['BAW1477', 'EGPF', '10:30', 'BAW630', 'LGAV', '11:35', 'A320'], ['BAW280', 'KLAX', '10:35', 'BAW115', 'KJFK', '14:20', 'B772'], ['BAW1347', 'EGJJ', '10:35', 'BAW448', 'LEIB', '11:50', 'A21N'],
    ['UAL5', 'KIAH', '10:35', 'UAL263', 'KDEN', '13:50', 'B772'], ['BAW252', 'MYNN', '10:40', 'BAW121', 'KCVG', '14:35', 'B78X'], ['BAW1439', 'EGPH', '10:40', 'BAW816', 'EKCH', '11:55', 'A321'],
    ['UAL938', 'KORD', '10:55', 'UAL941', 'KJFK', '15:00', 'B789'], ['ICE450', 'BIKF', '10:55', 'ICE451', 'BIKF', '12:05', 'B38M'], ['BAW777', 'ENGM', '10:55', 'BAW782', 'ENGM', '12:05', 'A20N'],
    ['BAW347', 'LFML', '11:00', 'BAW1424', 'EGPE', '12:10', 'A321'], ['BAW827', 'EIDW', '11:00', 'BAW830', 'EIDW', '12:00', 'A321'], ['BAW431', 'EHAM', '11:00', 'BAW718', 'LTFM', '12:10', 'A321'],
    ['WJA2', 'CYYC', '11:05', 'WJA1', 'CYYC', '12:55', 'B789'], ['THY1989', 'LTFM', '11:10', 'THY1992', 'LTFM', '13:40', 'A333'], ['BAW36', 'VOMM', '11:10', 'BAW267', 'KPDX', '14:40', 'B78X'],
    ['THY1987', 'LTFM', '11:15', 'THY1990', 'LTFM', '12:25', 'A21N'], ['BAW569', 'LIMC', '11:20', 'BAW576', 'LIMC', '13:10', 'A321'], ['BAW417', 'ELLX', '11:20', 'BAW788', 'ESGG', '12:40', 'A21N'],
    ['BAW367', 'LFBO', '11:25', 'BAW362', 'LFLL', '12:55', 'A320'], ['BAW196', 'KIAH', '11:25', 'BAW187', 'KAUS', '15:05', 'B78X'], ['UAE1', 'OMDB', '11:25', 'UAE2', 'OMDB', '13:25', 'A388'],
    ['BAW807', 'EKBI', '11:30', 'BAW774', 'ESSA', '13:05', 'A21N'], ['ASL210', 'LYBE', '11:30', 'ASL211', 'LYBE', '12:30', 'A320'], ['DLH906', 'EDDF', '11:40', 'DLH907', 'EDDF', '12:30', 'A20N'],
    ['SVA119', 'OEJN', '11:40', 'SVA120', 'OEJN', '13:40', 'B77W'], ['ETD63', 'OMAA', '11:45', 'ETD64', 'OMAA', '13:45', 'B789'], ['DLH2474', 'EDDM', '11:50', 'DLH2475', 'EDDM', '12:35', 'A321'],
    ['DAL10', 'KMSP', '11:52', 'DAL37', 'KATL', '14:15', 'B763'], ['SWR332', 'LSZH', '12:00', 'SWR333', 'LSZH', '12:50', 'A21N'], ['DAL36', 'KATL', '12:03', 'DAL4', 'KJFK', '15:20', 'A333'],
    ['BAW118', 'VOBL', '12:15', 'BAW123', 'VOBL', '14:45', 'B772'], ['BAW583', 'LIMC', '12:15', 'BAW578', 'LIMC', '14:25', 'A320'], ['BAW771', 'ESSA', '12:15', 'BAW844', 'EPWA', '13:20', 'A21N'],
    ['BAW541', 'LIPE', '12:20', 'BAW436', 'EHAM', '13:35', 'A320'], ['ACA860', 'CYVR', '12:20', 'ACA863', 'CYVR', '14:50', 'B789'], ['VIR18', 'KIAD', '12:20', 'VIR21', 'KIAD', '14:50', 'A35K'],
    ['EIN384', 'EINN', '12:30', 'EIN385', 'EINN', '13:40', 'A320'], ['EIN164', 'EIDW', '12:30', 'EIN161', 'EIDW', '14:10', 'A21N'], ['BAW863', 'LHBP', '12:45', 'BAW840', 'LDDU', '13:50', 'A321'],
    ['BAW48', 'KSEA', '12:45', 'BAW49', 'KSEA', '15:15', 'B772'], ['BAW276', 'VOHS', '12:50', 'BAW279', 'VOHS', '15:20', 'B78X'], ['KLM1009', 'EHAM', '12:50', 'KLM1010', 'EHAM', '13:45', 'E195'],
    ['EIN160', 'EIDW', '12:55', 'EIN167', 'EIDW', '14:50', 'A320'], ['BAW286', 'KSFO', '12:55', 'BAW289', 'KSFO', '15:25', 'B772'], ['BAW491', 'LXGB', '13:00', 'BAW724', 'LOWW', '14:10', 'A321'],
    ['UAL930', 'KSFO', '13:10', 'UAL925', 'KIAD', '15:40', 'B789'], ['AFR1780', 'LFPG', '13:10', 'AFR1781', 'LFPG', '14:20', 'A20N'], ['BAW511', 'LPFR', '13:10', 'BAW370', 'LFBO', '14:20', 'A320'],
    ['EWG7462', 'EDDH', '13:10', 'EWG7463', 'EDDH', '13:50', 'A20N'], ['VLG8960', 'LFPG', '13:15', 'VLG8961', 'LFPG', '14:00', 'A320'], ['BAW272', 'KSAN', '13:20', 'BAW281', 'KSAN', '15:50', 'B772'],
    ['BAW733', 'LSZH', '13:20', 'BAW578', 'LIMC', '14:30', 'A320'], ['AAR521', 'RKSI', '13:20', 'AAR522', 'RKSI', '15:50', 'A359'], ['QTR7', 'OTHH', '13:25', 'QTR10', 'OTHH', '15:55', 'A359'],
    ['VLG6022', 'LEZL', '13:25', 'VLG6023', 'LEZL', '14:10', 'A320'], ['AAL78', 'KDFW', '13:25', 'AAL141', 'KJFK', '17:05', 'B789'], ['BAW549', 'LIRF', '13:30', 'BAW528', 'LIRN', '14:40', 'A21N'],
    ['VIR317', 'VOBL', '13:35', 'VIR157', 'KBOS', '15:05', 'B789'], ['SAS805', 'ENGM', '13:35', 'SAS806', 'ENGM', '14:35', 'A20N'], ['DLH908', 'EDDF', '13:40', 'DLH909', 'EDDF', '14:30', 'A321'],
    ['BAW921', 'EDDL', '13:45', 'BAW542', 'LIPE', '15:00', 'A21N'], ['VLG6310', 'LEBB', '13:45', 'VLG6311', 'LEBB', '14:30', 'A320'], ['BAW801', 'BIKF', '13:50', 'BAW776', 'ESSA', '15:05', 'A21N'],
    ['VIR142', 'KLAX', '14:00', 'VIR143', 'KLAX', '16:30', 'A339'], ['BAW288', 'KPHX', '14:05', 'BAW183', 'KJFK', '18:25', 'B772'], ['THY1985', 'LTFM', '14:10', 'THY1986', 'LTFM', '16:40', 'A333'],
    ['CPA257', 'VHHH', '14:15', 'CPA258', 'VHHH', '16:45', 'B77W'], ['BAW585', 'LIMC', '14:15', 'BAW588', 'LIMC', '15:25', 'A21N'], ['BAW256', 'VIDP', '14:20', 'BAW257', 'VIDP', '16:50', 'B772'],
    ['BAW305', 'LFPG', '14:20', 'BAW310', 'LFPG', '15:30', 'A321'], ['BAW387', 'EBBR', '14:25', 'BAW388', 'EBBR', '15:35', 'A21N'], ['BAW349', 'LFML', '14:30', 'BAW350', 'LFML', '15:40', 'A320'],
    ['AEE602', 'LGAV', '14:30', 'AEE603', 'LGAV', '15:40', 'A20N'], ['UAL916', 'KJFK', '14:30', 'UAL921', 'KJFK', '17:00', 'B772'], ['LOG655', 'EGAE', '14:30', 'LOG656', 'EGAE', '15:40', 'E145'],
    ['BAW853', 'LKPR', '14:35', 'BAW856', 'LKPR', '15:45', 'A320'], ['BAW905', 'EDDF', '14:45', 'BAW906', 'EDDF', '15:55', 'A321'], ['SIA308', 'WSSS', '14:45', 'SIA309', 'WSSS', '17:15', 'B77W'],
    ['BAW627', 'LGAV', '14:50', 'BAW634', 'LGAV', '16:00', 'A21N'], ['VIR412', 'DNMM', '14:55', 'VIR413', 'DNMM', '17:25', 'A339'], ['AMX7', 'MMMX', '15:00', 'AMX8', 'MMMX', '17:30', 'B789'],
    ['BAW865', 'LHBP', '15:00', 'BAW868', 'LHBP', '16:10', 'A320'], ['AAL9779', 'KJFK', '15:00', 'AAL9780', 'KJFK', '17:30', 'B772'], ['BAW991', 'EDDB', '15:05', 'BAW992', 'EDDB', '16:15', 'A320'],
    ['UAE31', 'OMDB', '15:10', 'UAE32', 'OMDB', '17:40', 'A388'], ['BAW749', 'LSGG', '15:15', 'BAW752', 'LSGG', '16:25', 'A321'], ['IBE719', 'LEMD', '15:20', 'IBE720', 'LEMD', '16:30', 'A21N'],
    ['ANA211', 'RJAA', '15:20', 'ANA212', 'RJAA', '17:50', 'B77W'], ['SAS809', 'ENGM', '15:25', 'SAS810', 'ENGM', '16:35', 'A20N'], ['BAW1309', 'EGPD', '15:25', 'BAW1310', 'EGPD', '16:35', 'A320'],
    ['CAL81', 'RCTP', '15:30', 'CAL82', 'RCTP', '18:00', 'A359'], ['BAW969', 'EDDH', '15:30', 'BAW972', 'EDDH', '16:40', 'A21N'], ['BAW795', 'LJLJ', '15:35', 'BAW796', 'LJLJ', '16:45', 'A21N'],
    ['MAS4', 'WMKK', '15:35', 'MAS7', 'WMKK', '18:05', 'A359'], ['DLH914', 'EDDF', '15:40', 'DLH915', 'EDDF', '16:30', 'A321'], ['BAW1401', 'EGAA', '15:45', 'BAW1402', 'EGAA', '16:55', 'A21N'],
    ['LZB851', 'LBSF', '15:45', 'LZB852', 'LBSF', '16:55', 'A320'], ['RAM800', 'GMMN', '15:50', 'RAM801', 'GMMN', '17:00', 'B738'], ['BAW689', 'LGSR', '15:55', 'BAW692', 'LGSR', '17:05', 'A321'],
    ['SAS527', 'ESSA', '16:00', 'SAS528', 'ESSA', '17:10', 'A20N'], ['DAH2054', 'DAAG', '16:00', 'DAH2055', 'DAAG', '17:10', 'B738'], ['BAW1485', 'EGPF', '16:00', 'BAW1490', 'EGPF', '17:10', 'A21N'],
    ['BAW331', 'LFMN', '16:00', 'BAW336', 'LFMN', '17:10', 'A320'], ['PIA757', 'OPLA', '16:00', 'PIA758', 'OPLA', '18:30', 'B77W'], ['BAW575', 'LIMC', '16:05', 'BAW594', 'LIMC', '17:15', 'A321'],
    ['BEL2095', 'EBBR', '16:05', 'BEL2096', 'EBBR', '17:15', 'A320'], ['FIN1337', 'EFHK', '16:05', 'FIN1338', 'EFHK', '17:15', 'A321'], ['DLH2478', 'EDDM', '16:05', 'DLH2479', 'EDDM', '16:50', 'A20N'],
    ['BAW495', 'LEPA', '16:10', 'BAW496', 'LEPA', '17:20', 'A21N'], ['LOT279', 'EPWA', '16:10', 'LOT280', 'EPWA', '17:20', 'E195'], ['BAW1303', 'EGPD', '16:15', 'BAW1304', 'EGPD', '17:25', 'A320'],
    ['KAL907', 'RKSI', '16:20', 'KAL908', 'RKSI', '18:50', 'A388'], ['BAW773', 'ESSA', '16:20', 'BAW778', 'ESSA', '17:30', 'A321'], ['ETH710', 'HAAB', '16:20', 'ETH711', 'HAAB', '18:50', 'B789'],
    ['BAW415', 'ELLX', '16:25', 'BAW418', 'ELLX', '17:35', 'A320'], ['CCA937', 'ZBAA', '16:40', 'CCA938', 'ZBAA', '19:10', 'B789'], ['DLH916', 'EDDF', '16:40', 'DLH919', 'EDDF', '18:30', 'A320'],
    ['SAS1517', 'EKCH', '16:40', 'SAS1518', 'EKCH', '17:50', 'A20N'], ['BAW717', 'LTFM', '16:45', 'BAW720', 'LTFM', '17:55', 'A21N'], ['TAP1350', 'LPPT', '16:45', 'TAP1353', 'LPPT', '17:55', 'A20N'],
    ['HVN55', 'VVNB', '16:50', 'HVN58', 'VVNB', '19:20', 'B789'], ['AEE604', 'LGAV', '16:55', 'AEE605', 'LGAV', '18:05', 'A20N'], ['QTR1', 'OTHH', '17:00', 'QTR2', 'OTHH', '19:30', 'A35K'],
    ['VLG7112', 'LEST', '17:00', 'VLG7113', 'LEST', '18:10', 'A320'], ['EWG8464', 'EDDB', '17:05', 'EWG8465', 'EDDB', '18:15', 'A20N'], ['BAW817', 'EKCH', '17:05', 'BAW590', 'LIMC', '19:35', 'A320'],
    ['IGO3', 'VIDP', '17:10', 'IGO4', 'VIDP', '19:40', 'B789'], ['BAW951', 'LDSP', '17:10', 'BAW952', 'LDSP', '18:20', 'A21N'], ['DLH2486', 'EDDM', '17:25', 'DLH2487', 'EDDM', '18:10', 'A321'],
    ['BAW783', 'ENGM', '17:25', 'BAW784', 'ENGM', '18:35', 'A21N'], ['BAW607', 'LIPZ', '17:25', 'BAW610', 'LIPZ', '18:35', 'A320'], ['BAW555', 'LIRF', '17:25', 'BAW562', 'LIRF', '18:35', 'A21N'],
    ['SWR356', 'LSGG', '17:30', 'SWR357', 'LSGG', '18:15', 'A21N'], ['DLH918', 'EDDF', '17:40', 'DLH2481', 'EDDM', '19:25', 'A20N'], ['ETD67', 'OMAA', '17:45', 'ETD68', 'OMAA', '20:15', 'B78X'],
    ['BAW168', 'ZSPD', '17:45', 'BAW169', 'ZSPD', '20:15', 'B772'], ['VIR209', 'RKSI', '17:50', 'VIR210', 'RKSI', '20:20', 'B789'], ['AIC2017', 'VIDP', '18:00', 'AIC2018', 'VIDP', '20:30', 'B788'],
    ['BAW645', 'LGKR', '18:00', 'BAW646', 'LGKR', '19:10', 'A21N'], ['OMA101', 'OOMS', '18:10', 'OMA102', 'OOMS', '20:40', 'B789'], ['THA916', 'VTBS', '18:15', 'THA917', 'VTBS', '20:45', 'B77W'],
    ['CSN303', 'ZGGG', '18:20', 'CSN304', 'ZGGG', '20:50', 'A359'], ['EVA67', 'VTBS', '18:20', 'EVA68', 'VTBS', '20:50', 'B77W'], ['SWR338', 'LSZH', '18:20', 'SWR339', 'LSZH', '19:05', 'A21N'],
    ['SIA318', 'WSSS', '18:30', 'SIA319', 'WSSS', '21:00', 'A388'], ['AIC131', 'VABB', '18:30', 'AIC132', 'VABB', '21:00', 'A359'], ['AVA118', 'SKBO', '18:35', 'AVA121', 'SKBO', '21:05', 'B788'],
    ['BAW691', 'LGSR', '18:35', 'BAW694', 'LGSR', '19:45', 'A320'], ['DLH2480', 'EDDM', '18:40', 'DLH2489', 'EDDM', '19:50', 'A321'], ['BAW577', 'LIMC', '18:40', 'BAW596', 'LIMC', '19:50', 'A320'],
    ['CBJ431', 'ZSQD', '18:45', 'CBJ432', 'ZSQD', '21:15', 'A359'], ['BAW178', 'KJFK', '18:45', 'BAW203', 'KJFK', '21:15', 'B788'], ['BAW6', 'RJAA', '18:50', 'BAW11', 'RJAA', '21:20', 'B772'],
    ['ALK503', 'VCBI', '19:00', 'ALK504', 'VCBI', '21:30', 'A333'], ['VIR26', 'KJFK', '19:10', 'VIR27', 'KJFK', '21:40', 'B789'], ['UAE5', 'OMDB', '19:15', 'UAE6', 'OMDB', '21:45', 'B77W'],
    ['AIC133', 'VOBL', '19:20', 'AIC134', 'VOBL', '21:50', 'B788'], ['ELY317', 'LLBG', '19:20', 'ELY318', 'LLBG', '20:30', 'B738'], ['QTR15', 'OTHH', '19:25', 'QTR16', 'OTHH', '21:55', 'A359'],
    ['CCA855', 'ZBAA', '19:25', 'CCA856', 'ZBAA', '21:55', 'B789'], ['BAW579', 'LIMC', '19:30', null, null, null, 'A21N'], ['SVA117', 'OEJN', '19:30', null, null, null, 'B77W'],
    ['CPA253', 'VHHH', '19:35', null, null, null, 'B77W'], ['UAL934', 'KJFK', '19:40', null, null, null, 'B789'], ['DLH2482', 'EDDM', '19:45', null, null, null, 'A320'],
    ['JBU1107', 'KJFK', '19:45', null, null, null, 'A21N'], ['ACA2080', 'CYHZ', '20:00', null, null, null, 'B789'], ['MSR779', 'HECA', '20:05', null, null, null, 'A21N'],
    ['SWR358', 'LSGG', '20:30', null, null, null, 'A20N'], ['UAL122', 'KJFK', '20:35', null, null, null, 'B789'], ['AAL142', 'KJFK', '20:40', null, null, null, 'B789'],
    ['SWR340', 'LSZH', '20:45', null, null, null, 'A20N'], ['DLH922', 'EDDF', '21:10', null, null, null, 'A320'], ['DLH2484', 'EDDM', '21:40', null, null, null, 'A20N']
  ];
  const TIMETABLE = ROWS.map(r => [...r, '1234567', null]);
  const LONG_STAY = [];
  const EXTRA = [
    { cs: 'BAW917', t: 'A320', k: 'ARR', o: 'EDDF' }, { cs: 'BAW338', t: 'A20N', k: 'DEP', d: 'LFMN' }, { cs: 'VIR3', t: 'A35K', k: 'ARR', o: 'KJFK' },
    { cs: 'DLH909', t: 'A321', k: 'DEP', d: 'EDDF' }, { cs: 'BAW1307', t: 'A319', k: 'ARR', o: 'EGPD' }, { cs: 'UAE2', t: 'A388', k: 'DEP', d: 'OMDB' },
    { cs: 'BAW117', t: 'B77W', k: 'ARR', o: 'KJFK' }, { cs: 'EIN163', t: 'A20N', k: 'DEP', d: 'EIDW' }, { cs: 'SWR319', t: 'BCS3', k: 'ARR', o: 'LSZH' },
    { cs: 'BAW476', t: 'A21N', k: 'DEP', d: 'LEBL' }, { cs: 'AAL101', t: 'B77W', k: 'ARR', o: 'KJFK' }, { cs: 'KLM1009', t: 'B738', k: 'DEP', d: 'EHAM' },
    { cs: 'QTR9', t: 'A35K', k: 'ARR', o: 'OTHH' }, { cs: 'BAW1442', t: 'A320', k: 'DEP', d: 'EGPF' }, { cs: 'SAS1501', t: 'A20N', k: 'ARR', o: 'EKCH' },
    { cs: 'BAW282', t: 'B789', k: 'DEP', d: 'KLAX' }, { cs: 'AFR1381', t: 'A320', k: 'ARR', o: 'LFPG' }, { cs: 'IBE3171', t: 'A21N', k: 'DEP', d: 'LEMD' }
  ];
  // the Academy endorsement: the westerly with 27R landing and 27L departing (an odd week's morning)
  const EXERCISES = {
    dep: { name: 'Heathrow 1 · Push from Terminal 5 and depart 27L', wx: 'west', rwy: '27R', sched: [{ cs: 'BAW478', t: 'A320', k: 'DEP', d: 'LEBL', m: 0, stand: '518' }] },
    arr: { name: 'Heathrow 2 · From the Bovingdon stack to the ILS 27R', wx: 'west', rwy: '27R', sched: [{ cs: 'VIR4', t: 'A35K', k: 'ARR', o: 'KJFK', m: 0 }] },
    mix: { name: 'Heathrow 3 · Land 27R, cross 27L to Terminal 4, depart 27L', wx: 'west', rwy: '27R', sched: [{ cs: 'QTR7', t: 'B77W', k: 'ARR', o: 'OTHH', m: 0 },
      { cs: 'BAW916', t: 'A20N', k: 'DEP', d: 'EDDF', m: 0, stand: '522' }, { cs: 'KLM1010', t: 'B738', k: 'DEP', d: 'EHAM', m: 0, stand: '406' }] }
  };
  const WX_PRESETS = {
    west:  { name: 'Westerly: land 27R, depart 27L',                        short: 'Westerly',  metar: 'EGLL 121150Z 24012KT 9999 FEW025 SCT040 15/09 Q1014' },
    east:  { name: 'Easterly: land 09L or 09R in turn',                     short: 'Easterly',  metar: 'EGLL 121150Z 08011KT 9999 SCT032 12/05 Q1027' },
    rain:  { name: 'Thames Valley rain and low cloud',                      short: 'Low cloud', metar: 'EGLL 121150Z 22016KT 3500 RA BR BKN004 OVC009 13/12 Q0999' },
    fog:   { name: 'Thick fog: RVR 50 m, below even the CAT III minima',    short: 'Fog',       metar: 'EGLL 120650Z 00000KT 0050 R27R/0050N FG VV000 06/06 Q1025' },
    storm: { name: 'Atlantic gale: gusty crosswind and turbulence',         short: 'Storm',     metar: 'EGLL 121150Z 22030G46KT 9999 -SHRA FEW014 BKN028 12/07 Q0983' },
    calm:  { name: 'High pressure, light and variable, haze',               short: 'Calm',      metar: 'EGLL 121150Z VRB02KT 5000 HZ NSC 18/10 Q1034' }
  };

  // airline radio telephony and codes at Heathrow (merged into the engine's tables)
  const TEL = { BAW: 'Speedbird', VIR: 'Virgin', AAL: 'American', UAL: 'United', DLH: 'Lufthansa', EIN: 'Shamrock', SWR: 'Swiss', DAL: 'Delta', EWG: 'Eurowings',
    ACA: 'Air Canada', SAS: 'Scandinavian', QTR: 'Qatari', AIC: 'Air India', IBE: 'Iberia', KLM: 'KLM', UAE: 'Emirates', TAP: 'Air Portugal', VLG: 'Vueling',
    AFR: 'Airfrans', LOG: 'Logan', JBU: 'JetBlue', ETD: 'Etihad', SVA: 'Saudia', MSR: 'Egyptair', THY: 'Turkish', CPA: 'Cathay', SIA: 'Singapore', AUA: 'Austrian',
    FIN: 'Finnair', LOT: 'Lot', BEL: 'Beeline', AEE: 'Aegean', MAS: 'Malaysian', JAL: 'Japan Air', GFA: 'Gulf Air', THA: 'Thai', ITY: 'Itarrow', ELY: 'El Al',
    QFA: 'Qantas', RWD: 'Rwandair', KMM: 'Malta', MEA: 'Cedar Jet', ICE: 'Iceair', WJA: 'Westjet', ASL: 'Air Serbia', KQA: 'Kenya', AVA: 'Avianca',
    HVN: 'Viet Nam Airlines', CCA: 'Air China', IGO: 'Ifly', CSN: 'China Southern', AAR: 'Asiana', KAC: 'Kuwaiti', ASA: 'Alaska', TAM: 'Tam', RJA: 'Jordanian',
    AMX: 'Aeromexico', ANA: 'All Nippon', CAL: 'Dynasty', LZB: 'Flying Bulgaria', RAM: 'Royalair Maroc', DAH: 'Air Algerie', PIA: 'Pakistan', ETH: 'Ethiopian',
    KAL: 'Korean Air', CES: 'China Eastern', OMA: 'Oman Air', EVA: 'Eva', CBJ: 'Capital Jet', ALK: 'Srilankan', RXI: 'Riyadh Air', SHT: 'Shuttle' };
  // Lufthansa City Airlines (VL) flies Lufthansa flight numbers at Heathrow
  const AIRLINE_ICAO = { BA: 'BAW', VS: 'VIR', AA: 'AAL', UA: 'UAL', LH: 'DLH', EI: 'EIN', LX: 'SWR', DL: 'DAL', EW: 'EWG', AC: 'ACA', SK: 'SAS', QR: 'QTR',
    AI: 'AIC', IB: 'IBE', KL: 'KLM', EK: 'UAE', VL: 'DLH', TP: 'TAP', VY: 'VLG', AF: 'AFR', LM: 'LOG', B6: 'JBU', EY: 'ETD', SV: 'SVA', MS: 'MSR', TK: 'THY',
    CX: 'CPA', SQ: 'SIA', OS: 'AUA', AY: 'FIN', LO: 'LOT', SN: 'BEL', A3: 'AEE', MH: 'MAS', JL: 'JAL', GF: 'GFA', TG: 'THA', AZ: 'ITY', LY: 'ELY', QF: 'QFA',
    WB: 'RWD', KM: 'KMM', ME: 'MEA', FI: 'ICE', WS: 'WJA', JU: 'ASL', KQ: 'KQA', AV: 'AVA', VN: 'HVN', CA: 'CCA', '6E': 'IGO', CZ: 'CSN', OZ: 'AAR', KU: 'KAC',
    AS: 'ASA', JJ: 'TAM', RJ: 'RJA', AM: 'AMX', NH: 'ANA', CI: 'CAL', FB: 'LZB', AT: 'RAM', AH: 'DAH', PK: 'PIA', ET: 'ETH', KE: 'KAL', MU: 'CES', WY: 'OMA',
    BR: 'EVA', JD: 'CBJ', UL: 'ALK', RX: 'RXI' };
  const AIRLINE_TYPE = { BAW: 'A320', VIR: 'A35K', AAL: 'B77W', UAL: 'B789', DLH: 'A20N', EIN: 'A20N', SWR: 'BCS3', DAL: 'A339', EWG: 'A20N', ACA: 'B789',
    SAS: 'A20N', QTR: 'A35K', AIC: 'B77W', IBE: 'A21N', KLM: 'B738', UAE: 'A388', TAP: 'A20N', VLG: 'A320', AFR: 'A320', LOG: 'E145', JBU: 'A21N', ETD: 'B789',
    SVA: 'B789', MSR: 'B38M', THY: 'A21N', CPA: 'A35K', SIA: 'A388', AUA: 'A320', FIN: 'A321', LOT: 'B38M', BEL: 'A320', AEE: 'A20N', MAS: 'A359', JAL: 'A35K',
    GFA: 'B789', THA: 'B77W', ITY: 'A20N', ELY: 'B738', QFA: 'B789', RWD: 'A333', KMM: 'A20N', MEA: 'A21N', ICE: 'B38M', WJA: 'B789', ASL: 'A320', KQA: 'B788',
    AVA: 'B788', HVN: 'B789', CCA: 'B77W', IGO: 'B789', CSN: 'B789', AAR: 'A359', KAC: 'B77W', ASA: 'B789', TAM: 'B789', RJA: 'B788', AMX: 'B789', ANA: 'B77W',
    CAL: 'A359', LZB: 'A320', RAM: 'B738', DAH: 'B738', PIA: 'B77W', ETH: 'B789', KAL: 'B77W', CES: 'A359', OMA: 'B789', EVA: 'B77W', CBJ: 'A359', ALK: 'A333', RXI: 'B789' };
  // the terminal each airline uses (2026). Terminal 5: British Airways and Iberia (IAG), with BA's overflow at Terminal 3;
  // Terminal 3: oneworld and Virgin/Delta; Terminal 4: SkyTeam and the Gulf and Asian carriers; everyone else, the Star
  // Alliance and Aer Lingus, at Terminal 2. Approximate where an airline splits.
  const TERMINAL_OF = {
    BAW: '5', IBE: '5', VLG: '5',
    AAL: '3', CPA: '3', QFA: '3', JAL: '3', UAE: '3', VIR: '3', DAL: '3', FIN: '3', RJA: '3', MAS: '3', SVA: '3', ALK: '3', LOG: '3',
    QTR: '4', ETD: '4', KLM: '4', AFR: '4', KAL: '4', GFA: '4', RAM: '4', KQA: '4', HVN: '4', ELY: '4', KAC: '4', OMA: '4', RWD: '4', MEA: '4', DAH: '4', CES: '4',
    CSN: '4', PIA: '4', AMX: '4', TAM: '4', RXI: '4', CBJ: '4', ITY: '4', ASL: '4', LZB: '4', KMM: '4', IGO: '4', AAR: '4'
  };
  const TYPES = {
    A321: { name: 'A321',          wake: 'M', vapp: 140, vr: 150, climb: 2200, desc: 2000, cruise: 290, span: 34.1, len: 44.5, shape: 'jet' },
    B38M: { name: '737 MAX 8',     wake: 'M', vapp: 145, vr: 150, climb: 2400, desc: 2100, cruise: 290, span: 35.9, len: 39.5, shape: 'jet' },
    BCS3: { name: 'A220-300',      wake: 'M', vapp: 128, vr: 135, climb: 2600, desc: 2000, cruise: 290, span: 35.1, len: 38.7, shape: 'jet' },
    E145: { name: 'Embraer 145',   wake: 'M', vapp: 125, vr: 130, climb: 2400, desc: 2000, cruise: 270, span: 20.0, len: 29.9, shape: 'jet' },
    E195: { name: 'Embraer 195',   wake: 'M', vapp: 130, vr: 138, climb: 2400, desc: 2000, cruise: 280, span: 28.7, len: 38.7, shape: 'jet' },
    A333: { name: 'A330-300',      wake: 'H', vapp: 140, vr: 152, climb: 1900, desc: 2000, cruise: 300, span: 60.3, len: 63.7, shape: 'jet' },
    A339: { name: 'A330-900neo',   wake: 'H', vapp: 138, vr: 150, climb: 2000, desc: 2000, cruise: 300, span: 64.0, len: 63.7, shape: 'jet' },
    A359: { name: 'A350-900',      wake: 'H', vapp: 140, vr: 150, climb: 2100, desc: 2000, cruise: 300, span: 64.8, len: 66.8, shape: 'jet' },
    A35K: { name: 'A350-1000',     wake: 'H', vapp: 145, vr: 155, climb: 2000, desc: 2000, cruise: 300, span: 64.8, len: 73.8, shape: 'jet' },
    A388: { name: 'A380',          wake: 'H', vapp: 140, vr: 155, climb: 1600, desc: 1800, cruise: 300, span: 79.8, len: 72.7, shape: 'jet' },
    B763: { name: '767-300',       wake: 'H', vapp: 140, vr: 150, climb: 2200, desc: 2000, cruise: 300, span: 47.6, len: 54.9, shape: 'jet' },
    B772: { name: '777-200',       wake: 'H', vapp: 140, vr: 155, climb: 1900, desc: 2000, cruise: 300, span: 60.9, len: 63.7, shape: 'jet' },
    B77W: { name: '777-300ER',     wake: 'H', vapp: 149, vr: 160, climb: 1800, desc: 2000, cruise: 300, span: 64.8, len: 73.9, shape: 'jet' },
    B788: { name: '787-8',         wake: 'H', vapp: 140, vr: 150, climb: 2200, desc: 2000, cruise: 300, span: 60.1, len: 56.7, shape: 'jet' },
    B789: { name: '787-9',         wake: 'H', vapp: 145, vr: 155, climb: 2100, desc: 2000, cruise: 300, span: 60.1, len: 62.8, shape: 'jet' },
    B78X: { name: '787-10',        wake: 'H', vapp: 150, vr: 160, climb: 2000, desc: 2000, cruise: 300, span: 60.1, len: 68.3, shape: 'jet' }
  };
  // Heathrow's flight boards give places by city name
  const PLACES = {
    'aberdeen': 'EGPD', 'abu dhabi': 'OMAA', 'abuja': 'DNAA', 'accra': 'DGAA', 'addis ababa': 'HAAB', 'algiers': 'DAAG', 'amman': 'OJAI', 'amsterdam': 'EHAM',
    'athens': 'LGAV', 'atlanta': 'KATL', 'austin': 'KAUS', 'bahrain': 'OBBI', 'baltimore/washington': 'KBWI', 'bangkok': 'VTBS', 'barcelona': 'LEBL',
    'basel/mulhouse': 'LFSB', 'beijing': 'ZBAA', 'beirut': 'OLBA', 'belfast': 'EGAA', 'belgrade': 'LYBE', 'bengaluru': 'VOBL', 'berlin': 'EDDB', 'bermuda': 'TXKF',
    'bilbao': 'LEBB', 'billund': 'EKBI', 'bogota': 'SKBO', 'bologna': 'LIPE', 'boston': 'KBOS', 'bridgetown': 'TBPB', 'brussels': 'EBBR', 'bucharest': 'LROP',
    'budapest': 'LHBP', 'cairo': 'HECA', 'calgary': 'CYYC', 'cape town': 'FACT', 'casablanca': 'GMMN', 'charlotte': 'KCLT', 'chennai': 'VOMM', 'chicago': 'KORD',
    'cincinnati': 'KCVG', 'colombo': 'VCBI', 'copenhagen': 'EKCH', 'cork': 'EICK', 'delhi': 'VIDP', 'denver': 'KDEN', 'derry': 'EGAE', 'detroit': 'KDTW',
    'doha': 'OTHH', 'dubai': 'OMDB', 'dublin': 'EIDW', 'dubrovnik': 'LDDU', 'duesseldorf': 'EDDL', 'dundee': 'EGPN', 'edinburgh': 'EGPH', 'faro': 'LPFR',
    'florence': 'LIRQ', 'fort worth': 'KDFW', 'frankfurt': 'EDDF', 'geneva': 'LSGG', 'gibraltar': 'LXGB', 'glasgow': 'EGPF', 'goteborg': 'ESGG', 'guangzhou': 'ZGGG',
    'guernsey': 'EGJB', 'halifax': 'CYHZ', 'hamburg': 'EDDH', 'hannover': 'EDDV', 'hanoi': 'VVNB', 'helsinki': 'EFHK', 'hong kong': 'VHHH', 'houston': 'KIAH',
    'hyderabad': 'VOHS', 'ibiza': 'LEIB', 'inverness': 'EGPE', 'isle of man': 'EGNS', 'istanbul': 'LTFM', 'jeddah': 'OEJN', 'jersey': 'EGJJ', 'johannesburg': 'FAOR',
    'kerkyra': 'LGKR', 'kigali': 'HRYR', 'knock': 'EIKN', 'kuala lumpur': 'WMKK', 'kuwait': 'OKKK', 'lagos': 'DNMM', 'lahore': 'OPLA', 'larnaca': 'LCLK',
    'las vegas': 'KLAS', 'lisbon': 'LPPT', 'ljubljana': 'LJLJ', 'los angeles': 'KLAX', 'luxembourg': 'ELLX', 'luxor': 'HELX', 'lyon': 'LFLL', 'madrid': 'LEMD',
    'malaga': 'LEMG', 'malta': 'LMML', 'manchester': 'EGCC', 'marrakech': 'GMMX', 'marseille': 'LFML', 'mexico city': 'MMMX', 'miami': 'KMIA', 'milan': 'LIMC',
    'minneapolis/saint paul': 'KMSP', 'montreal': 'CYUL', 'mumbai': 'VABB', 'munich': 'EDDM', 'muscat': 'OOMS', 'nairobi': 'HKJK', 'naples': 'LIRN',
    'nashville': 'KBNA', 'nassau': 'MYNN', 'new orleans': 'KMSY', 'new york': 'KJFK', 'newcastle': 'EGNT', 'nice': 'LFMN', 'orlando': 'KMCO', 'oslo': 'ENGM',
    'ottawa': 'CYOW', 'palermo': 'LICJ', 'palma de mallorca': 'LEPA', 'paris': 'LFPG', 'philadelphia': 'KPHL', 'phoenix': 'KPHX', 'pisa': 'LIRP', 'pittsburgh': 'KPIT',
    'portland': 'KPDX', 'prague': 'LKPR', 'qingdao': 'ZSQD', 'raleigh/durham': 'KRDU', 'reykjavik': 'BIKF', 'rio de janeiro': 'SBGL', 'riyadh': 'OERK', 'rome': 'LIRF',
    'saint louis': 'KSTL', 'san diego': 'KSAN', 'san francisco': 'KSFO', 'santiago': 'SCEL', 'santiago de compostela': 'LEST', 'sao paulo': 'SBGR', 'seattle': 'KSEA',
    'seoul': 'RKSI', 'sevilla': 'LEZL', 'shanghai': 'ZSPD', 'shannon': 'EINN', 'singapore': 'WSSS', 'sofia': 'LBSF', 'split': 'LDSP', 'stockholm': 'ESSA',
    'stuttgart': 'EDDS', 'taipei': 'RCTP', 'tampa': 'KTPA', 'tbilisi': 'UGTB', 'tel aviv-yafo': 'LLBG', 'thira': 'LGSR', 'tirana': 'LATI', 'tokyo': 'RJAA',
    'toronto': 'CYYZ', 'toulouse': 'LFBO', 'valencia': 'LEVC', 'vancouver': 'CYVR', 'venice': 'LIPZ', 'vienna': 'LOWW', 'warsaw': 'EPWA', 'washington': 'KIAD',
    'zagreb': 'LDZA', 'zurich': 'LSZH'
  };
  const AIRPORTS = {
    EGLL: [51.4700, -0.4543, 'London Heathrow'], BIKF: [63.9850, -22.6056, 'Keflavík'], CYHZ: [44.8808, -63.5086, 'Halifax'], CYOW: [45.3225, -75.6692, 'Ottawa'],
    CYUL: [45.4706, -73.7408, 'Montreal'], CYVR: [49.1947, -123.1792, 'Vancouver'], CYYC: [51.1215, -114.0076, 'Calgary'], CYYZ: [43.6777, -79.6248, 'Toronto'],
    DAAG: [36.6910, 3.2154, 'Algiers'], DGAA: [5.6052, -0.1668, 'Accra'], DNAA: [9.0068, 7.2632, 'Abuja'], DNMM: [6.5774, 3.3212, 'Lagos'],
    EBBR: [50.9014, 4.4844, 'Brussels'], EDDB: [52.3667, 13.5033, 'Berlin'], EDDF: [50.0333, 8.5706, 'Frankfurt'], EDDH: [53.6304, 9.9882, 'Hamburg'],
    EDDL: [51.2895, 6.7668, 'Düsseldorf'], EDDM: [48.3538, 11.7861, 'Munich'], EDDS: [48.6899, 9.2220, 'Stuttgart'], EDDV: [52.4611, 9.6851, 'Hanover'],
    EFHK: [60.3172, 24.9633, 'Helsinki'], EGAA: [54.6575, -6.2158, 'Belfast'], EGAE: [55.0428, -7.1611, 'Derry'], EGCC: [53.3537, -2.2750, 'Manchester'],
    EGFF: [51.3967, -3.3433, 'Cardiff'], EGGD: [51.3827, -2.7191, 'Bristol'], EGGW: [51.8747, -0.3683, 'London Luton'], EGHI: [50.9503, -1.3568, 'Southampton'],
    EGJB: [49.4350, -2.6019, 'Guernsey'], EGJJ: [49.2079, -2.1955, 'Jersey'], EGKK: [51.1481, -0.1903, 'London Gatwick'], EGLC: [51.5053, 0.0553, 'London City'],
    EGNS: [54.0833, -4.6239, 'Isle of Man'], EGNT: [55.0375, -1.6917, 'Newcastle'], EGPD: [57.2019, -2.1978, 'Aberdeen'], EGPE: [57.5425, -4.0475, 'Inverness'],
    EGPF: [55.8719, -4.4331, 'Glasgow'], EGPH: [55.9500, -3.3725, 'Edinburgh'], EGPN: [56.4525, -3.0258, 'Dundee'], EGSS: [51.8850, 0.2350, 'London Stansted'],
    EHAM: [52.3086, 4.7639, 'Amsterdam'], EICK: [51.8413, -8.4911, 'Cork'], EIDW: [53.4213, -6.2701, 'Dublin'], EIKN: [53.9103, -8.8185, 'Knock'],
    EINN: [52.7020, -8.9248, 'Shannon'], EKBI: [55.7403, 9.1518, 'Billund'], EKCH: [55.6181, 12.6561, 'Copenhagen'], ELLX: [49.6233, 6.2044, 'Luxembourg'],
    ENGM: [60.1939, 11.1004, 'Oslo'], EPWA: [52.1657, 20.9671, 'Warsaw'], ESGG: [57.6628, 12.2798, 'Gothenburg'], ESSA: [59.6519, 17.9186, 'Stockholm'],
    FACT: [-33.9715, 18.6021, 'Cape Town'], FAOR: [-26.1392, 28.2460, 'Johannesburg'], GMMN: [33.3675, -7.5900, 'Casablanca'], GMMX: [31.6069, -8.0363, 'Marrakech'],
    HAAB: [8.9779, 38.7993, 'Addis Ababa'], HECA: [30.1219, 31.4056, 'Cairo'], HELX: [25.6710, 32.7066, 'Luxor'], HKJK: [-1.3192, 36.9278, 'Nairobi'],
    HRYR: [-1.9686, 30.1395, 'Kigali'], KATL: [33.6407, -84.4277, 'Atlanta'], KAUS: [30.1975, -97.6664, 'Austin'], KBNA: [36.1245, -86.6782, 'Nashville'],
    KBOS: [42.3656, -71.0096, 'Boston'], KBWI: [39.1754, -76.6683, 'Baltimore'], KCLT: [35.2140, -80.9431, 'Charlotte'], KCVG: [39.0488, -84.6678, 'Cincinnati'],
    KDEN: [39.8561, -104.6737, 'Denver'], KDFW: [32.8998, -97.0403, 'Dallas-Fort Worth'], KDTW: [42.2162, -83.3554, 'Detroit'],
    KIAD: [38.9531, -77.4565, 'Washington Dulles'], KIAH: [29.9902, -95.3368, 'Houston'], KJFK: [40.6399, -73.7789, 'New York JFK'],
    KLAS: [36.0840, -115.1537, 'Las Vegas'], KLAX: [33.9416, -118.4085, 'Los Angeles'], KMCO: [28.4312, -81.3081, 'Orlando'], KMIA: [25.7959, -80.2870, 'Miami'],
    KMSP: [44.8848, -93.2223, 'Minneapolis'], KMSY: [29.9934, -90.2580, 'New Orleans'], KORD: [41.9742, -87.9073, 'Chicago'], KPDX: [45.5887, -122.5975, 'Portland'],
    KPHL: [39.8729, -75.2437, 'Philadelphia'], KPHX: [33.4352, -112.0101, 'Phoenix'], KPIT: [40.4915, -80.2329, 'Pittsburgh'],
    KRDU: [35.8776, -78.7875, 'Raleigh-Durham'], KSAN: [32.7338, -117.1933, 'San Diego'], KSEA: [47.4502, -122.3088, 'Seattle'],
    KSFO: [37.6213, -122.3790, 'San Francisco'], KSTL: [38.7487, -90.3700, 'St Louis'], KTPA: [27.9755, -82.5332, 'Tampa'], LATI: [41.4147, 19.7206, 'Tirana'],
    LBSF: [42.6967, 23.4114, 'Sofia'], LCLK: [34.8751, 33.6249, 'Larnaca'], LDDU: [42.5614, 18.2682, 'Dubrovnik'], LDSP: [43.5389, 16.2980, 'Split'],
    LDZA: [45.7429, 16.0688, 'Zagreb'], LEBB: [43.3011, -2.9106, 'Bilbao'], LEBL: [41.2971, 2.0785, 'Barcelona'], LEIB: [38.8729, 1.3731, 'Ibiza'],
    LEMD: [40.4722, -3.5608, 'Madrid'], LEMG: [36.6749, -4.4991, 'Málaga'], LEPA: [39.5517, 2.7388, 'Palma'], LEST: [42.8963, -8.4151, 'Santiago'],
    LEVC: [39.4893, -0.4816, 'Valencia'], LEZL: [37.4180, -5.8931, 'Seville'], LFBO: [43.6291, 1.3638, 'Toulouse'], LFLL: [45.7256, 5.0811, 'Lyon'],
    LFML: [43.4393, 5.2214, 'Marseille'], LFMN: [43.6584, 7.2159, 'Nice'], LFPG: [49.0097, 2.5479, 'Paris CDG'], LFSB: [47.5896, 7.5299, 'Basel'],
    LGAV: [37.9364, 23.9445, 'Athens'], LGKR: [39.6019, 19.9117, 'Corfu'], LGSR: [36.3992, 25.4793, 'Santorini'], LHBP: [47.4298, 19.2611, 'Budapest'],
    LICJ: [38.1760, 13.0910, 'Palermo'], LIMC: [45.6306, 8.7281, 'Milan Malpensa'], LIPE: [44.5354, 11.2887, 'Bologna'], LIPZ: [45.5053, 12.3519, 'Venice'],
    LIRF: [41.8003, 12.2389, 'Rome'], LIRN: [40.8860, 14.2908, 'Naples'], LIRP: [43.6839, 10.3927, 'Pisa'], LIRQ: [43.8100, 11.2051, 'Florence'],
    LJLJ: [46.2237, 14.4576, 'Ljubljana'], LKPR: [50.1008, 14.2600, 'Prague'], LLBG: [32.0114, 34.8867, 'Tel Aviv'], LMML: [35.8575, 14.4775, 'Malta'],
    LOWW: [48.1103, 16.5697, 'Vienna'], LPFR: [37.0144, -7.9659, 'Faro'], LPPT: [38.7742, -9.1342, 'Lisbon'], LROP: [44.5711, 26.0850, 'Bucharest'],
    LSGG: [46.2381, 6.1090, 'Geneva'], LSZH: [47.4647, 8.5492, 'Zurich'], LTFM: [41.2753, 28.7519, 'Istanbul'], LXGB: [36.1512, -5.3497, 'Gibraltar'],
    LYBE: [44.8184, 20.3091, 'Belgrade'], MMMX: [19.4363, -99.0721, 'Mexico City'], MYNN: [25.0390, -77.4662, 'Nassau'], OBBI: [26.2708, 50.6336, 'Bahrain'],
    OEJN: [21.6796, 39.1565, 'Jeddah'], OERK: [24.9576, 46.6988, 'Riyadh'], OJAI: [31.7226, 35.9932, 'Amman'], OKKK: [29.2266, 47.9689, 'Kuwait'],
    OLBA: [33.8209, 35.4884, 'Beirut'], OMAA: [24.4330, 54.6511, 'Abu Dhabi'], OMDB: [25.2532, 55.3657, 'Dubai'], OOMS: [23.5933, 58.2844, 'Muscat'],
    OPLA: [31.5216, 74.4036, 'Lahore'], OTHH: [25.2731, 51.6081, 'Doha'], RCTP: [25.0777, 121.2328, 'Taipei'], RJAA: [35.7720, 140.3929, 'Tokyo Narita'],
    RKSI: [37.4602, 126.4407, 'Seoul Incheon'], SBGL: [-22.8100, -43.2506, 'Rio de Janeiro'], SBGR: [-23.4356, -46.4731, 'São Paulo'],
    SCEL: [-33.3930, -70.7858, 'Santiago'], SKBO: [4.7016, -74.1469, 'Bogotá'], TBPB: [13.0746, -59.4925, 'Barbados'], TXKF: [32.3640, -64.6787, 'Bermuda'],
    UGTB: [41.6692, 44.9547, 'Tbilisi'], VABB: [19.0896, 72.8656, 'Mumbai'], VCBI: [7.1808, 79.8841, 'Colombo'], VHHH: [22.3080, 113.9185, 'Hong Kong'],
    VIDP: [28.5665, 77.1031, 'Delhi'], VOBL: [13.1986, 77.7066, 'Bengaluru'], VOHS: [17.2403, 78.4294, 'Hyderabad'], VOMM: [12.9941, 80.1709, 'Chennai'],
    VTBS: [13.6900, 100.7501, 'Bangkok'], VVNB: [21.2212, 105.8072, 'Hanoi'], WMKK: [2.7456, 101.7099, 'Kuala Lumpur'], WSSS: [1.3644, 103.9915, 'Singapore'],
    ZBAA: [40.0801, 116.5846, 'Beijing'], ZGGG: [23.3924, 113.2988, 'Guangzhou'], ZSPD: [31.1443, 121.8083, 'Shanghai'], ZSQD: [36.3619, 120.0883, 'Qingdao']
  };

  return {
    icao: 'EGLL', iata: 'LHR', name: 'London Heathrow', city: 'London', country: 'United Kingdom', arp: P('512839N', '0002741W'), elev: 83,
    FIX, NAV, RWY, CONFIGS, altLand, altPlan, londonOff, STARS, HOLDS_AIR, ILS, SIDS, DIR, PLACE_DIR, dirFor, UNITS, CTR, TA, TZ, ALTERNATES,
    TIMETABLE, LONG_STAY, EXTRA, EXERCISES, WX_PRESETS, TEL, AIRLINE_ICAO, AIRLINE_TYPE, TERMINAL_OF, TYPES, PLACES, AIRPORTS,
    data: { metar: 'egll/metar.txt', flights: 'egll/flights.json' },
    features: { roadCrossing: false, sra: false, ils: true, rnavSids: true, singleRunway: false, parallelRunways: true }
  };
})();
if (typeof module !== 'undefined') module.exports = EGLL;
