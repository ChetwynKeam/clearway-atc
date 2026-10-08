// ═════════════════════════ Manchester (EGCC) airport profile ═════════════════════════
// Everything the Clearway engine needs to know that is true only of Manchester. Sources: UK AIP AD 2-EGCC (AIRAC 8/26):
// aerodrome chart 2-1 (thresholds, frequencies, hot spots), parking/docking chart 2-2 (stands and their aprons), SIDs 6-1
// to 6-6 (conventional, flown by RNAV substitution), RNAV1 STARs 7-1 to 7-4 with their coding tables 7-5 to 7-7, the ROSUN,
// MIRSI and DAYNE holds 7-8, ILS/DME approaches 8-1 (05R), 8-4 (05L) and 8-7 (23R) and the RNP approach coding tables
// 8-11 and 8-12, and OpenStreetMap for the taxiways, stands, aprons and buildings (egcc-ground.js). Positions are lat/lon
// (WGS84); variation 0.5°E. Summary of the charts: airports/egcc/README.md.
// Manchester has two parallel runways 390 m apart and staggered: 05L/23R (runway 1, beside the terminals) and 05R/23L
// (runway 2, to the south-west, with its exits all at its north-east end). In the usual westerly arrivals land on 23R and
// departures leave from 23L, crossing runway 1 to get there; in an easterly arrivals land on 05R and cross runway 1 to
// the terminals, and departures leave from 05L. At night, or when one runway is closed, runway 1 runs both.
// Plain data plus a few small functions, like egkk.js; egcc-engine.js turns it into the engine's globals.

const EGCC = (() => {
  const ll = (s) => {                                     // '532113N' / '0021630.5W' → decimal degrees
    const m = s.match(/^(\d{2,3})(\d{2})(\d{2}(?:\.\d+)?)([NSEW])$/);
    const v = +m[1] + m[2]/60 + m[3]/3600; return /[SW]/.test(m[4]) ? -v : v;
  };
  const P = (lat, lon) => [ll(lat), ll(lon)];

  // ── fixes. STAR and hold fixes from the coding tables (7-5..7-8), SID fixes from the SID charts, the RNP approaches'
  // initial and final approach fixes (8-11, 8-12). The SIDs are conventional (VOR/DME): their turn points and level
  // gates (an MCT, POL, WAL or HON radial and DME) are worked out here as points with the chart's name for them.
  const FIX = {
    // STARs
    LAKEY: P('541420.00N', '0025852.38W'), DIZZE: P('535042.74N', '0023232.91W'), ROSUN: P('534008.09N', '0022057.26W'), SETEL: P('540044.64N', '0022608.71W'),
    TILNI: P('543251.41N', '0015117.89W'), GASKO: P('541328.97N', '0015721.30W'), BEGAM: P('540924.84N', '0020715.43W'), LIBSO: P('533129.33N', '0000536.32E'),
    FIZED: P('533444.87N', '0003917.40W'), GOLES: P('533629.08N', '0010500.37W'), BURNI: P('534337.76N', '0023103.86W'), OTBED: P('531716.71N', '0000154.61E'),
    MAKUX: P('535829.90N', '0045227.89W'), SOSIM: P('534855.75N', '0043030.46W'), GIGTO: P('533801.06N', '0040550.62W'), IBRAR: P('533154.28N', '0034110.87W'),
    MIRSI: P('533216.69N', '0024242.16W'), MALUD: P('532448.17N', '0033630.30W'), AXCIS: P('524319.48N', '0031634.76W'), MONTY: P('525334.00N', '0031026.44W'),
    REXAM: P('530400.00N', '0030937.21W'), PENIL: P('533657.47N', '0033948.72W'), ELVOS: P('524201.00N', '0011825.00W'), QUSHI: P('530629.30N', '0014629.41W'),
    DAYNE: P('531419.12N', '0020145.26W'), LESTA: P('524427.09N', '0010419.42W'),
    // SID end and route fixes
    KUXEM: P('531511N', '0024047W'), EKLAD: P('531514N', '0024929W'), ASMIM: P('532646N', '0023911W'), XOBRO: P('532817N', '0022518W'),
    LISTO: P('530836N', '0021157W'), XUMAT: P('532757N', '0022823W'), SONEX: P('532953N', '0021021W'), DESIG: P('533138N', '0015334W'),
    TABLY: P('531619N', '0022702W'), SANBA: P('530822N', '0022003W'),
    // SID turn points and gates: MCT D3 straight ahead off 23R (MC231) and 23L (MC232, D3.2), the intercepts of MCT R253
    // (MC253A/MC232A), MCT R253 D8/D12/D13/D16, MCT D8 on track 342 (MC342), MCT D5 on track 272/282, MCT D7 on track 160
    // (HO337B, LISTO 2R/2Y), POL R218 D16/D9, WAL R079 D28/D33, HON R332 D58; off 05L: MCT D1.2/D2 (MC051A/B), MCT R051
    // D7/D12/D14, MCT D2.7 on track 147, POL R185 D24/D28/D33, POL R179 D12/D8
    MC231: P('531939.4N', '0021949.0W'), MC232: P('531921.8N', '0021950.6W'), MC253A: P('531947.4N', '0022457.2W'), MC232A: P('531957.6N', '0022359.7W'),
    MC258: P('531908.7N', '0022835.1W'), MC2512: P('531800.5N', '0023500.7W'), MC2513: P('531743.5N', '0023637.1W'), MC2516: P('531652.3N', '0024126.3W'),
    MC342: P('532741.7N', '0022404.1W'), MC342B: P('532738.0N', '0022412.9W'), MC272: P('531945.3N', '0022337.9W'), MC282: P('531952.5N', '0022342.1W'),
    MC231B: P('532016.7N', '0021830.4W'), HO337B: P('531425.5N', '0021502.3W'), HO337C: P('531424.9N', '0021543.0W'),
    PO21816: P('533206.7N', '0022302.5W'), PO2189: P('533735.4N', '0021540.4W'), WA07928: P('532825.6N', '0022150.5W'), WA07933: P('532918.2N', '0021335.2W'),
    HO33258: P('531256.4N', '0022322.4W'),
    MC051A: P('532209.8N', '0021409.6W'), MC051B: P('532239.7N', '0021306.6W'), MC0517: P('532546.5N', '0020633.3W'), MC05112: P('532853.2N', '0015959.9W'),
    MC05114: P('533007.9N', '0015722.5W'), MC147: P('532000.8N', '0021151.9W'), PO18524: P('532044.6N', '0021005.4W'), PO18528: P('531645.7N', '0021044.3W'),
    PO18533: P('531147.1N', '0021132.9W'), PO17912: P('533238.0N', '0020601.4W'), PO1798: P('533638.0N', '0020604.9W'),
    // approaches: the RNP initial/intermediate fixes (8-11, 8-12), used as the ILS intermediate fixes (the ILS intercept
    // points are 11-12 NM out on the same centrelines), and the final approach fixes
    TICZU: P('532856.73N', '0020026.09W'), FECJO: P('531255.83N', '0023300.52W'), EVAKU: P('531355.13N', '0023132.41W'), NODUC: P('532905.02N', '0015934.99W'),
    TINVA: P('533257.59N', '0020449.54W'), DOMIG: P('533211.72N', '0015303.47W'), OSNAP: P('532512.22N', '0015421.40W'),
    C23RF: P('532600.48N', '0020633.98W'), C23LF: P('532515.77N', '0020733.36W'), C05LF: P('531626.24N', '0022622.30W'), C05RF: P('531527.01N', '0022750.62W'),
    // missed approaches: 23R turn right onto 355°, 05R turn right onto 185°, 05L straight ahead (6-9 NM out, 3500 ft)
    MA23R: P('532739.6N', '0021620.7W'), MA05R: P('531356.8N', '0021936.2W'), MA05L: P('532627.4N', '0020528.0W')
  };
  // VOR/DMEs
  const NAV = {
    MCT: { name: 'Manchester VOR/DME', freq: '113.55', p: P('532125N', '0021544W') },
    POL: { name: 'Pole Hill VOR/DME', freq: '112.10', p: P('534437.60N', '0020611.83W') },
    WAL: { name: 'Wallasey VOR/DME', freq: '114.10', p: P('532330.97N', '0030804.06W') },
    TNT: { name: 'Trent VOR/DME', freq: '115.70', p: P('530314.23N', '0014011.90W') },
    HON: { name: 'Honiley VOR/DME', freq: '113.65', p: P('522124N', '0013949W') }
  };

  // ── runways (AD 2-EGCC-2-1): 05L/23R 3048 × 45 m, 05R/23L 3050 × 45 m, magnetic 051°/231°. Thresholds and elevations.
  const RWY = {
    list: ['05L23R', '05R23L'], var: 0.5,
    thr: { '05L': P('532051.20N', '0021715.95W'), '23R': P('532140.75N', '0021533.41W'), '05R': P('531955.10N', '0021838.38W'), '23L': P('532053.35N', '0021637.95W') },
    elev: { '05L': 212, '23R': 249, '05R': 186, '23L': 227 }
  };
  // the two directions of dual-runway operation: arrivals on one runway, departures on the other. Runway 2's exits are
  // all at its north-east end, so it is used for departures towards the south-west (23L) and for landings towards the
  // north-east (05R).
  const CONFIGS = {
    west: { land: '23R', dep: '23L', name: 'Westerly' },
    east: { land: '05R', dep: '05L', name: 'Easterly' }
  };

  // ── STARs (7-1..7-7). Every one ends at a hold at FL70 (MIRSI FL60 minimum): ROSUN north of the airport, MIRSI to the
  // west and DAYNE to the south-east. Manchester Radar vectors the arrivals from there onto the ILS. Alt = level constraint.
  const STARS = {
    'LAKEY 1M': { pts: [['LAKEY', 20000], ['DIZZE'], ['ROSUN', 7000]] },
    'SETEL 1M': { pts: [['SETEL'], ['ROSUN', 7000]] },
    'TILNI 2M': { pts: [['TILNI', 26000], ['GASKO'], ['BEGAM'], ['SETEL'], ['ROSUN', 7000]] },
    'LIBSO 1M': { pts: [['LIBSO', 29000], ['FIZED'], ['GOLES', 17000], ['POL'], ['BURNI'], ['ROSUN', 7000]] },
    'OTBED 1M': { pts: [['OTBED', 29000], ['GOLES', 17000], ['POL'], ['BURNI'], ['ROSUN', 7000]] },
    'MAKUX 1M': { pts: [['MAKUX', 27000], ['SOSIM'], ['GIGTO'], ['IBRAR', 17000], ['WAL'], ['MIRSI', 7000]] },
    'MALUD 1M': { pts: [['MALUD', 17000], ['WAL'], ['MIRSI', 7000]] },
    'AXCIS 1M': { pts: [['AXCIS', 20000], ['MONTY'], ['REXAM'], ['WAL'], ['MIRSI', 7000]] },
    'PENIL 1M': { pts: [['PENIL', 17000], ['WAL'], ['MIRSI', 7000]] },
    'ELVOS 1M': { pts: [['ELVOS', 20000], ['TNT'], ['QUSHI'], ['DAYNE', 8000]] },
    'LESTA 1M': { pts: [['LESTA', 20000], ['TNT'], ['QUSHI'], ['DAYNE', 8000]] }
  };
  // the holds (7-8): inbound track (magnetic + 0.5°), right-hand, levels FL70 (MIRSI FL60) to FL140, 230 kt
  const HOLDS_AIR = {
    ROSUN: { inb: 171.6, turn: 'R', min: 7000, max: 14000, maxKt: 230 },
    MIRSI: { inb: 60.5, turn: 'R', min: 6000, max: 14000, maxKt: 230 },
    DAYNE: { inb: 310.5, turn: 'R', min: 7000, max: 14000, maxKt: 230 }
  };

  // ── approaches. ILS/DME 23R (8-7: glidepath from 3500 ft at I-NN D10), 05L (8-4: 3000 ft at I-MM D8.6) and 05R (8-1:
  // 3000 ft at I-MC D8.7); 23L has no ILS: its approach is the RNP (8-10, 8-12: NODUC at 3500 ft, FAF C23LF at 2500 ft,
  // 7 NM). Intermediate fix: the RNP approach's IF on the same centreline. Missed approaches: 23R climb 3500 ft straight ahead
  // until 750 ft (expedite: 23L departures), then right onto 355°; 05R straight ahead to 700 ft, then right onto 185°; 05L
  // straight ahead; 23L straight ahead; all to 3500 ft.
  const ILS = {
    '23R': { loc: 'I-NN', freq: '109.50', ifx: 'TICZU', ifAlt: 3500, missed: ['MA23R', 3500], turn: 1, mins: { vis: 550, ceil: 200 } },
    '05L': { loc: 'I-MM', freq: '109.50', ifx: 'EVAKU', ifAlt: 3000, missed: ['MA05L', 3500], turn: 0, mins: { vis: 550, ceil: 200 } },
    '05R': { loc: 'I-MC', freq: '111.55', ifx: 'FECJO', ifAlt: 3000, missed: ['MA05R', 3500], turn: 1, mins: { vis: 550, ceil: 200 } },
    '23L': { loc: null, freq: null, rnp: true, ifx: 'NODUC', ifAlt: 3500, missed: ['MA23R', 3500], turn: 0, mins: { vis: 1500, ceil: 400 } }
  };

  // ── SIDs (6-1..6-6), conventional, flown by RNAV substitution. All stop at 5000 ft (the transition altitude), with
  // gates on the way. The R and Y designators are 23R and 23L, S and Z are 05L and 05R. Alt = level at the fix (feet).
  const SIDS = {
    'KUXEM1R': { rwy: '23R', spoken: 'Kuxem One Romeo', pts: [['MC231'], ['MC253A'], ['MC258', 2500], ['MC2512'], ['KUXEM', 5000]] },
    'KUXEM1Y': { rwy: '23L', spoken: 'Kuxem One Yankee', pts: [['MC232'], ['MC232A'], ['MC258', 2500], ['MC2512'], ['KUXEM', 5000]] },
    'EKLAD1R': { rwy: '23R', spoken: 'Eklad One Romeo', pts: [['MC231'], ['MC253A'], ['MC258', 2500], ['MC2513', 4000], ['MC2516', 5000], ['EKLAD', 5000]] },
    'EKLAD1Y': { rwy: '23L', spoken: 'Eklad One Yankee', pts: [['MC232'], ['MC232A'], ['MC258', 2500], ['MC2513', 4000], ['MC2516', 5000], ['EKLAD', 5000]] },
    'LISTO2R': { rwy: '23R', spoken: 'Listo Two Romeo', pts: [['MC231B'], ['HO337B', 3000], ['LISTO', 5000]] },
    'LISTO2Y': { rwy: '23L', spoken: 'Listo Two Yankee', pts: [['MC232'], ['HO337C', 3000], ['LISTO', 5000]] },
    'POL5R':   { rwy: '23R', spoken: 'Pole Hill Five Romeo', pts: [['MC231'], ['MC342', 2500], ['PO21816', 4000], ['PO2189', 5000], ['POL', 5000]] },
    'POL1Y':   { rwy: '23L', spoken: 'Pole Hill One Yankee', pts: [['MC232'], ['MC342B', 2500], ['PO21816', 4000], ['PO2189', 5000], ['POL', 5000]] },
    'SONEX1R': { rwy: '23R', spoken: 'Sonex One Romeo', pts: [['MC231'], ['MC342', 2500], ['WA07928'], ['WA07933', 5000], ['SONEX', 5000]] },
    'SONEX1Y': { rwy: '23L', spoken: 'Sonex One Yankee', pts: [['MC232'], ['MC342B', 2500], ['WA07928'], ['WA07933', 5000], ['SONEX', 5000]] },
    'SANBA1R': { rwy: '23R', spoken: 'Sanba One Romeo', pts: [['MC231'], ['MC272'], ['TABLY'], ['HO33258', 3000], ['SANBA', 5000]] },
    'SANBA1Y': { rwy: '23L', spoken: 'Sanba One Yankee', pts: [['MC232'], ['MC282'], ['TABLY'], ['HO33258', 3000], ['SANBA', 5000]] },
    'ASMIM1S': { rwy: '05L', spoken: 'Asmim One Sierra', pts: [['MC051B'], ['XOBRO', 2500], ['ASMIM', 5000]] },
    'ASMIM1Z': { rwy: '05R', spoken: 'Asmim One Zulu', pts: [['MC051B'], ['XOBRO', 2500], ['ASMIM', 5000]] },
    'LISTO2S': { rwy: '05L', spoken: 'Listo Two Sierra', pts: [['MC051A'], ['MC147'], ['PO18524', 2000], ['PO18528', 3000], ['PO18533', 4000], ['LISTO', 5000]] },
    'LISTO2Z': { rwy: '05R', spoken: 'Listo Two Zulu', pts: [['MC147'], ['PO18524', 2000], ['PO18528', 3000], ['PO18533', 4000], ['LISTO', 5000]] },
    'POL4S':   { rwy: '05L', spoken: 'Pole Hill Four Sierra', pts: [['MC0517'], ['PO17912', 4000], ['PO1798', 5000], ['POL', 5000]] },
    'POL1Z':   { rwy: '05R', spoken: 'Pole Hill One Zulu', pts: [['MC0517'], ['PO17912', 4000], ['PO1798', 5000], ['POL', 5000]] },
    'DESIG1S': { rwy: '05L', spoken: 'Desig One Sierra', pts: [['MC0517'], ['MC05112', 4000], ['MC05114'], ['DESIG', 5000]] },
    'DESIG1Z': { rwy: '05R', spoken: 'Desig One Zulu', pts: [['MC0517'], ['MC05112', 4000], ['MC05114'], ['DESIG', 5000]] }
  };
  // the SID family for each direction, by runway
  const fam = (w, e) => ({ '23R': w + (w === 'POL' ? '5R' : w === 'LISTO' ? '2R' : '1R'), '23L': w + (w === 'LISTO' ? '2Y' : '1Y'),
    '05L': e + (e === 'POL' ? '4S' : e === 'LISTO' ? '2S' : '1S'), '05R': e + (e === 'LISTO' ? '2Z' : '1Z') });

  // ── airway directions: the STAR an arrival flies, where the simulator picks it up (45-65 NM out), the SIDs and the
  // Scottish Control sector that takes the departure (Manchester's en-route sectors are worked from Prestwick)
  const DIR = {
    N:  { star: 'LAKEY 1M', entry: 'LAKEY', alt: 15000, sid: fam('POL', 'POL'),     ctr: 'n', name: 'Glasgow, the Highlands and Iceland' },
    NE: { star: 'TILNI 2M', entry: 'GASKO', alt: 15000, sid: fam('POL', 'POL'),     ctr: 'n', name: 'Edinburgh, Aberdeen and Norway' },
    E:  { star: 'LIBSO 1M', entry: 'GOLES', alt: 17000, sid: fam('SONEX', 'DESIG'), ctr: 'e', name: 'Scandinavia, the Baltic and the Netherlands' },
    ESE:{ star: 'OTBED 1M', entry: 'GOLES', alt: 16000, sid: fam('SONEX', 'DESIG'), ctr: 'e', name: 'Germany, Poland and central Europe' },
    SE: { star: 'LESTA 1M', entry: 'LESTA', alt: 16000, sid: fam('LISTO', 'LISTO'), ctr: 's', name: 'Switzerland, Italy, Greece, Turkey and the Middle East' },
    S:  { star: 'ELVOS 1M', entry: 'ELVOS', alt: 16000, sid: fam('SANBA', 'LISTO'), ctr: 's', name: 'France, eastern Spain and the Balearics' },
    SW: { star: 'AXCIS 1M', entry: 'AXCIS', alt: 16000, sid: fam('KUXEM', 'ASMIM'), ctr: 'w', name: 'Portugal, southern Spain, the Canaries and Morocco' },
    W:  { star: 'MAKUX 1M', entry: 'IBRAR', alt: 15000, sid: fam('EKLAD', 'ASMIM'), ctr: 'w', name: 'Ireland and North America' },
    NW: { star: 'PENIL 1M', entry: 'PENIL', alt: 15000, sid: fam('EKLAD', 'ASMIM'), ctr: 'w', name: 'Belfast, the Isle of Man and Derry' }
  };
  const PLACE_DIR = {
    EGPF: 'N', EGPK: 'N', EGPE: 'N', EGPO: 'N', EGPB: 'N', BIKF: 'N', BIAR: 'N', EGPH: 'NE', EGPD: 'NE', EGNT: 'NE', ENGM: 'NE', ENBR: 'NE', ENVA: 'NE', ENZV: 'NE',
    EKCH: 'E', ESSA: 'E', EFHK: 'E', EETN: 'E', EVRA: 'E', EYVI: 'E', EHAM: 'E', EHEH: 'E', EKBI: 'E', ESGG: 'E', EPGD: 'E',
    EDDF: 'ESE', EDDM: 'ESE', EDDB: 'ESE', EDDK: 'ESE', EDDL: 'ESE', EDDH: 'ESE', EDDS: 'ESE', LKPR: 'ESE', EPWA: 'ESE', EPKK: 'ESE', EPWR: 'ESE', EPKT: 'ESE',
    LHBP: 'ESE', LOWW: 'ESE', LZIB: 'ESE', EBBR: 'ESE', ELLX: 'ESE', LROP: 'ESE', LBSF: 'ESE',
    LSZH: 'SE', LSGG: 'SE', LIMC: 'SE', LIML: 'SE', LIPZ: 'SE', LIPX: 'SE', LIPE: 'SE', LIRF: 'SE', LIRN: 'SE', LIRP: 'SE', LICC: 'SE', LICJ: 'SE', LIBD: 'SE',
    LDDU: 'SE', LDSP: 'SE', LDZA: 'SE', LATI: 'SE', LGAV: 'SE', LGRP: 'SE', LGIR: 'SE', LGSA: 'SE', LGKR: 'SE', LGSR: 'SE', LGZA: 'SE', LGKO: 'SE', LGTS: 'SE',
    LTFM: 'SE', LTAI: 'SE', LTBS: 'SE', LTFE: 'SE', LTBJ: 'SE', LCPH: 'SE', LCLK: 'SE', LMML: 'SE', LLBG: 'SE', HEGN: 'SE', HESH: 'SE', HECA: 'SE',
    OTHH: 'SE', OMDB: 'SE', OMAA: 'SE', OBBI: 'SE', OEJN: 'SE', VHHH: 'SE', WSSS: 'SE', ZSPD: 'SE', YMML: 'SE', VIDP: 'SE', OPLA: 'SE', OPIS: 'SE',
    LFPG: 'S', LFPO: 'S', LFMN: 'S', LFLL: 'S', LFML: 'S', LFCK: 'S', LFBL: 'S', LFMU: 'S', LFBD: 'S', LFBO: 'S', LFRN: 'S',
    LEBL: 'S', LEGE: 'S', LERS: 'S', LEPA: 'S', LEIB: 'S', LEMH: 'S', LEVC: 'S', LEAL: 'S', LEMI: 'S', LEAM: 'S', LEMD: 'S', LEBB: 'S', DAAG: 'S', DTTA: 'S', DTNH: 'S',
    LPPT: 'SW', LPFR: 'SW', LPPR: 'SW', LPMA: 'SW', LEMG: 'SW', LEZL: 'SW', LXGB: 'SW', GCTS: 'SW', GCXO: 'SW', GCLP: 'SW', GCRR: 'SW', GCFV: 'SW', GCLA: 'SW',
    GMAD: 'SW', GMMX: 'SW', GMMN: 'SW', GVAC: 'SW', GVBA: 'SW', EGJJ: 'SW', EGJB: 'SW', EGHQ: 'SW', EGFF: 'SW', EGGD: 'SW', EICK: 'SW', EIKY: 'SW', MMUN: 'SW', TBPB: 'SW', MKJS: 'SW',
    EIDW: 'W', EINN: 'W', EIKN: 'W', KJFK: 'W', KEWR: 'W', KBOS: 'W', KATL: 'W', KMCO: 'W', KORD: 'W', KLAS: 'W', CYYZ: 'W', CYUL: 'W', CYVR: 'W', KIAD: 'W', KPHL: 'W',
    EGAA: 'NW', EGAC: 'NW', EGNS: 'NW', EGAE: 'NW', EGLL: 'SE', EGKK: 'SE', EGSS: 'SE', EGGP: 'W'
  };
  const dirFor = icao => DIR[PLACE_DIR[icao] || 'S'];

  // ── units and frequencies (aerodrome chart 2-1, ILS 23R 8-7, SIDs). Manchester's departures go to Scottish Control
  // (the Prestwick Centre sectors that work the Manchester area); its approach is Manchester Radar and Director.
  const UNITS = {
    atis: { name: 'Manchester Information', freq: '128.180' }, datis: { name: 'Manchester Departure Information', freq: '121.980' },
    del: { name: 'Manchester Delivery', freq: '121.705' }, gnd: { name: 'Manchester Ground', freq: '121.855' },
    twr: { name: 'Manchester Tower', freq: '118.630', alt: ['119.405'] },
    app: { name: 'Manchester Radar', freq: '118.580', alt: ['135.005'] }, dir: { name: 'Manchester Director', freq: '121.355' }, fire: { name: 'Manchester Fire', freq: '121.605' }
  };
  const CTR = { n: ['Scottish Control', '133.055'], w: ['Scottish Control', '128.055'], s: ['Scottish Control', '134.430'], e: ['Scottish Control', '134.430'] };
  const TA = 5000, TZ = 'Europe/London';
  // where cruising flights over the north-west divert to with a sick passenger (medical diversions in emerg.js)
  const ALTERNATES = [['Liverpool', 'EGGP', 'WAL'], ['Leeds Bradford', 'EGNM', 'POL'], ['East Midlands', 'EGNX', 'TNT']];

  // ── traffic. A representative autumn week built from Manchester's boards (2026-10-08), thinned to about 26 movements
  // an hour at the busiest (the real airport runs up to 60 on two runways); the busy session ("rush hour") adds the EXTRA
  // flights. Operators and routes are the real ones; flight numbers and times are representative.
  // [operator, flight number, airport, type, arrival times (local), minutes on the ground, days]; the departure is the
  // next number. A first-wave departure night-stopped at Manchester; the last arrivals stay overnight.
  const L = (o, n, ap, t, times, turn, days = '1234567') => ({ o, n, ap, t, times, turn, days });
  const ROUTES = [
    // Jet2, easyJet and TUI: the holiday flights, mostly Terminal 2
    L('EXS', 221, 'GCTS', 'B738', ['11:40', '18:25'], 55), L('EXS', 271, 'LEPA', 'B738', ['10:05', '16:40'], 50), L('EXS', 297, 'LEAL', 'A21N', ['09:30', '15:55'], 50),
    L('EXS', 241, 'LEMG', 'B738', ['12:15'], 50), L('EXS', 311, 'LGRP', 'B752', ['14:05'], 60), L('EXS', 355, 'LTBS', 'A21N', ['13:20'], 55),
    L('EXS', 283, 'GCRR', 'B738', ['15:30'], 55), L('EXS', 389, 'LPFR', 'B738', ['10:50', '19:10'], 50), L('EXS', 337, 'LTAI', 'A21N', ['16:15'], 60),
    L('EXS', 401, 'GCFV', 'B738', ['13:45'], 55), L('EXS', 361, 'LGKR', 'B752', ['17:20'], 55), L('EXS', 255, 'LEIB', 'B738', ['12:50'], 50),
    L('EZY', 1903, 'LEMG', 'A20N', ['09:45', '16:20'], 45), L('EZY', 1871, 'LPFR', 'A320', ['10:25', '17:55'], 45), L('EZY', 1915, 'GCTS', 'A21N', ['13:10'], 55),
    L('EZY', 1803, 'EGAA', 'A319', ['08:20', '13:35', '19:45'], 35), L('EZY', 1897, 'LEBL', 'A320', ['11:15', '18:40'], 40), L('EZY', 1961, 'LKPR', 'A319', ['12:30'], 40),
    L('EZY', 1951, 'LIMC', 'A320', ['14:20'], 40), L('EZY', 1983, 'LSGG', 'A320', ['10:55', '17:35'], 40), L('EZY', 2252, 'HEGN', 'A21N', ['15:45'], 65),
    L('EZY', 1935, 'EHAM', 'A319', ['09:20', '14:45'], 35), L('EZY', 1921, 'LGAV', 'A21N', ['16:05'], 55),
    L('TOM', 2101, 'GCLP', 'B38M', ['12:05'], 55), L('TOM', 2215, 'LTAI', 'B738', ['14:35'], 60), L('TOM', 2347, 'HESH', 'B789', ['13:55'], 80),
    L('TOM', 2163, 'LEPA', 'B38M', ['10:40'], 50), L('TOM', 51, 'MMUN', 'B789', ['15:10'], 120, '246'),
    // Ryanair (Terminal 3), the largest operator on the boards
    L('RYR', 2112, 'EIDW', 'B38M', ['07:55', '12:40', '17:25', '21:35'], 30), L('RYR', 8931, 'LMML', 'B738', ['13:15'], 30), L('RYR', 3561, 'LIRF', 'B38M', ['11:20'], 30),
    L('RYR', 1683, 'LEAL', 'B738', ['09:05', '18:15'], 30), L('RYR', 2231, 'LEMG', 'B38M', ['14:50'], 30), L('RYR', 6221, 'LIMC', 'B738', ['10:35'], 30),
    L('RYR', 4021, 'GCRR', 'B38M', ['16:30'], 30), L('RYR', 3305, 'EPKK', 'B738', ['12:10'], 30), L('RYR', 1241, 'LIPZ', 'B38M', ['15:25'], 30),
    L('RYR', 9671, 'EICK', 'B738', ['08:45', '19:20'], 30), L('RYR', 2401, 'LEPA', 'B38M', ['11:55'], 30), L('RYR', 5521, 'GMMX', 'B738', ['13:40'], 30),
    L('RYR', 4405, 'LPPR', 'B38M', ['10:10'], 30), L('RYR', 1911, 'LHBP', 'B738', ['17:05'], 30), L('RYR', 8711, 'EIKN', 'B38M', ['14:05'], 30, '1357'),
    // British Airways, Loganair and Aer Lingus (Terminal 3)
    L('BAW', 1385, 'EGLL', 'A320', ['07:40', '10:30', '14:55', '18:35', '21:20'], 45), L('LOG', 671, 'EGPE', 'E145', ['09:10', '17:45'], 35), L('LOG', 85, 'EGNS', 'AT76', ['11:30'], 30),
    L('EIN', 3201, 'EIDW', 'AT76', ['08:05', '13:00', '18:50'], 30), L('EIN', 3271, 'EGAC', 'AT76', ['10:15', '16:10'], 30),
    // European network airlines (Terminal 2)
    L('KLM', 1071, 'EHAM', 'E190', ['08:35', '12:20', '16:45', '20:30'], 40), L('DLH', 940, 'EDDF', 'A20N', ['09:50', '17:10'], 45), L('DLH', 2500, 'EDDM', 'A20N', ['13:30'], 45),
    L('SWR', 352, 'LSZH', 'A20N', ['10:45', '17:00'], 45), L('BEL', 2177, 'EBBR', 'A320', ['11:05', '18:00'], 40), L('AFR', 1668, 'LFPG', 'A320', ['09:35', '15:15'], 45),
    L('SAS', 1543, 'EKCH', 'A20N', ['12:45'], 40), L('NOZ', 1351, 'ENGM', 'B38M', ['14:15'], 40), L('VLG', 8851, 'LEBL', 'A320', ['13:00'], 45), L('TAP', 1335, 'LPPT', 'A20N', ['15:35'], 50),
    L('THY', 1993, 'LTFM', 'A21N', ['12:00'], 70), L('AEA', 1043, 'LEMD', 'B38M', ['14:40'], 55),
    // long-haul (Terminal 2)
    L('UAE', 17, 'OMDB', 'A388', ['12:40'], 130), L('UAE', 21, 'OMDB', 'B77W', ['07:25'], 120), L('UAE', 19, 'OMDB', 'A388', ['14:45'], 120),
    L('QTR', 21, 'OTHH', 'B77W', ['13:15'], 110), L('QTR', 29, 'OTHH', 'A359', ['07:05'], 110), L('ETD', 15, 'OMAA', 'B789', ['12:55'], 120), L('ETD', 21, 'OMAA', 'B789', ['07:15'], 120),
    L('SIA', 51, 'WSSS', 'A359', ['08:15'], 120), L('CPA', 219, 'VHHH', 'A359', ['07:50'], 130, '1357'), L('GFA', 21, 'OBBI', 'B789', ['13:40'], 120),
    L('VIR', 127, 'KATL', 'A339', ['08:30'], 150), L('VIR', 73, 'KMCO', 'A333', ['11:10'], 150), L('AAL', 734, 'KPHL', 'B772', ['08:00'], 150),
    L('UAL', 15, 'KEWR', 'B763', ['08:20'], 150), L('DAL', 59, 'KJFK', 'A333', ['08:45'], 150), L('ACA', 838, 'CYYZ', 'B789', ['09:00'], 130, '1357'),
    L('SVA', 123, 'OEJN', 'B789', ['14:10'], 130, '246'), L('PIA', 701, 'OPIS', 'B77W', ['15:50'], 130, '1357'), L('CES', 213, 'ZSPD', 'A359', ['15:20'], 140, '246')
  ];
  // the first wave (night-stoppers, local off-blocks) and the last arrivals, which stay overnight
  const FIRST = [['EXS', 219, 'GCTS', 'B738', '06:00'], ['EZY', 1901, 'LEMG', 'A20N', '06:05'], ['RYR', 2110, 'EIDW', 'B38M', '06:10'], ['TOM', 2161, 'LEPA', 'B38M', '06:15'],
    ['EXS', 269, 'LEPA', 'B738', '06:20'], ['BAW', 1383, 'EGLL', 'A320', '06:25'], ['EZY', 1801, 'EGAA', 'A319', '06:30'], ['RYR', 1681, 'LEAL', 'B738', '06:35'],
    ['KLM', 1069, 'EHAM', 'E190', '06:40'], ['EXS', 295, 'LEAL', 'A21N', '06:45'], ['EIN', 3199, 'EIDW', 'AT76', '06:50'], ['LOG', 669, 'EGPE', 'E145', '06:55'],
    ['EZY', 1933, 'EHAM', 'A319', '07:00'], ['DLH', 938, 'EDDF', 'A20N', '07:05'], ['RYR', 9669, 'EICK', 'B738', '07:10']];
  const LAST = [['EXS', 223, 'GCTS', 'B738', '22:20'], ['EZY', 1909, 'LEMG', 'A20N', '22:30'], ['RYR', 2120, 'EIDW', 'B38M', '22:40'], ['TOM', 2169, 'LEPA', 'B38M', '22:50'],
    ['EXS', 391, 'LPFR', 'B738', '23:00'], ['BAW', 1395, 'EGLL', 'A320', '23:10']];
  // local times to the engine's UTC "HH:MM" (BST, UTC+1)
  const utc = t => { const m = +t.slice(0, 2)*60 + +t.slice(3) - 60; const w = (m + 1440) % 1440; return String(Math.floor(w/60)).padStart(2, '0') + ':' + String(w % 60).padStart(2, '0'); };
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
    { cs: 'EXS297', t: 'A21N', k: 'ARR', o: 'LEAL' }, { cs: 'RYR2116', t: 'B38M', k: 'DEP', d: 'EIDW' }, { cs: 'EZY1873', t: 'A320', k: 'ARR', o: 'LPFR' },
    { cs: 'TOM2164', t: 'B38M', k: 'DEP', d: 'LEPA' }, { cs: 'KLM1075', t: 'E190', k: 'ARR', o: 'EHAM' }, { cs: 'EXS242', t: 'B738', k: 'DEP', d: 'LEMG' },
    { cs: 'RYR3563', t: 'B38M', k: 'ARR', o: 'LIRF' }, { cs: 'EZY1898', t: 'A320', k: 'DEP', d: 'LEBL' }, { cs: 'BAW1389', t: 'A320', k: 'ARR', o: 'EGLL' },
    { cs: 'EXS390', t: 'B738', k: 'DEP', d: 'LPFR' }, { cs: 'LOG86', t: 'AT76', k: 'DEP', d: 'EGNS' }, { cs: 'EZY1917', t: 'A21N', k: 'ARR', o: 'GCTS' },
    { cs: 'DLH941', t: 'A20N', k: 'DEP', d: 'EDDF' }, { cs: 'EXS313', t: 'B752', k: 'ARR', o: 'LGRP' }, { cs: 'RYR6222', t: 'B738', k: 'DEP', d: 'LIMC' },
    { cs: 'EIN3203', t: 'AT76', k: 'ARR', o: 'EIDW' }, { cs: 'EZY1952', t: 'A320', k: 'DEP', d: 'LIMC' }, { cs: 'TOM2103', t: 'B38M', k: 'ARR', o: 'GCLP' }
  ];
  // the Academy endorsement: the usual westerly, land 23R and depart 23L
  const EXERCISES = {
    dep: { name: 'Manchester 1 · Across runway 1 to depart 23L', wx: 'west', rwy: '23R', sched: [{ cs: 'RYR2232', t: 'B38M', k: 'DEP', d: 'LEMG', m: 0, stand: '43' }] },
    arr: { name: 'Manchester 2 · From ROSUN to the ILS 23R', wx: 'west', rwy: '23R', sched: [{ cs: 'KLM1071', t: 'E190', k: 'ARR', o: 'EHAM', m: 0 }] },
    mix: { name: 'Manchester 3 · Two runways: land 23R, depart 23L', wx: 'west', rwy: '23R', sched: [{ cs: 'EZY1916', t: 'A21N', k: 'ARR', o: 'GCTS', m: 0 },
      { cs: 'KLM1072', t: 'E190', k: 'DEP', d: 'EHAM', m: 0, stand: '207' }, { cs: 'EXS298', t: 'A21N', k: 'DEP', d: 'LEAL', m: 0, stand: '25' }] }
  };
  const WX_PRESETS = {
    west:  { name: 'South-westerly: land 23R, depart 23L',                short: 'Westerly',  metar: 'EGCC 081150Z 23012KT 9999 FEW025 SCT040 14/09 Q1012' },
    east:  { name: 'Easterly: land 05R, depart 05L',                      short: 'Easterly',  metar: 'EGCC 081150Z 06010KT 9999 SCT030 11/04 Q1026' },
    rain:  { name: 'Pennine rain and low cloud: ILS 23R near the minima', short: 'Low cloud', metar: 'EGCC 081150Z 22014KT 3000 RA BR BKN004 OVC008 12/11 Q0998' },
    fog:   { name: 'Cheshire Plain fog: below the ILS minima',            short: 'Fog',       metar: 'EGCC 080650Z 00000KT 0300 R23R/0350N FG VV001 07/07 Q1024' },
    storm: { name: 'Atlantic gale: gusty crosswind and turbulence',       short: 'Storm',     metar: 'EGCC 081150Z 27028G44KT 9999 -SHRA FEW012 BKN025 11/06 Q0981' },
    calm:  { name: 'High pressure, light and variable, haze',             short: 'Calm',      metar: 'EGCC 081150Z VRB02KT 6000 HZ NSC 17/09 Q1033' }
  };

  // airline radio telephony and codes at Manchester (merged into the engine's tables)
  const TEL = { EXS: 'Channex', EZY: 'Easy', TOM: 'Tomjet', RYR: 'Ryanair', RUK: 'Bluemax', BAW: 'Speedbird', LOG: 'Logan', EIN: 'Shamrock', KLM: 'KLM',
    DLH: 'Lufthansa', SWR: 'Swiss', BEL: 'Beeline', AFR: 'Airfrans', SAS: 'Scandinavian', NOZ: 'Nordic', VLG: 'Vueling', TAP: 'Air Portugal', THY: 'Turkish',
    AEA: 'Europa', UAE: 'Emirates', QTR: 'Qatari', ETD: 'Etihad', SIA: 'Singapore', CPA: 'Cathay', GFA: 'Gulf Air', VIR: 'Virgin', AAL: 'American', UAL: 'United',
    DAL: 'Delta', ACA: 'Air Canada', SVA: 'Saudia', PIA: 'Pakistan', CES: 'China Eastern', WZZ: 'Wizz Air', WUK: 'Wizz Go', EJU: 'Alpine', EZS: 'Topswiss',
    ICE: 'Iceair', FIN: 'Finnair', AUA: 'Austrian', LOT: 'Lot', BTI: 'Air Baltic', SXS: 'Sunexpress', PGT: 'Sunturk', RAM: 'Royalair Maroc', CFG: 'Condor',
    EWG: 'Eurowings', AWC: 'Zap', NJE: 'Fraction', EXM: 'Exec Air' };
  // Ryanair UK (RK) flies as Bluemax; easyJet's European (EC) and Swiss (DS) airlines keep their own callsigns
  const AIRLINE_ICAO = { LS: 'EXS', U2: 'EZY', EC: 'EJU', DS: 'EZS', BY: 'TOM', FR: 'RYR', RK: 'RUK', BA: 'BAW', LM: 'LOG', EI: 'EIN', KL: 'KLM', LH: 'DLH',
    LX: 'SWR', SN: 'BEL', AF: 'AFR', SK: 'SAS', DY: 'NOZ', VY: 'VLG', TP: 'TAP', TK: 'THY', UX: 'AEA', EK: 'UAE', QR: 'QTR', EY: 'ETD', SQ: 'SIA', CX: 'CPA',
    GF: 'GFA', VS: 'VIR', AA: 'AAL', UA: 'UAL', DL: 'DAL', AC: 'ACA', SV: 'SVA', PK: 'PIA', MU: 'CES', W6: 'WZZ', W9: 'WUK', FI: 'ICE', AY: 'FIN', OS: 'AUA',
    LO: 'LOT', BT: 'BTI', XQ: 'SXS', PC: 'PGT', AT: 'RAM', DE: 'CFG', EW: 'EWG' };
  const AIRLINE_TYPE = { EXS: 'B738', EZY: 'A320', EJU: 'A320', EZS: 'A320', TOM: 'B38M', RYR: 'B38M', RUK: 'B738', BAW: 'A320', LOG: 'E145', EIN: 'AT76',
    KLM: 'E190', DLH: 'A20N', SWR: 'A20N', BEL: 'A320', AFR: 'A320', SAS: 'A20N', NOZ: 'B38M', VLG: 'A320', TAP: 'A20N', THY: 'A21N', AEA: 'B38M', UAE: 'A388',
    QTR: 'B77W', ETD: 'B789', SIA: 'A359', CPA: 'A359', GFA: 'B789', VIR: 'A339', AAL: 'B772', UAL: 'B763', DAL: 'A333', ACA: 'B789', SVA: 'B789', PIA: 'B77W',
    CES: 'A359', WZZ: 'A21N', WUK: 'A21N', ICE: 'B38M', FIN: 'A321', AUA: 'A320', LOT: 'B38M', BTI: 'BCS3', SXS: 'B38M', PGT: 'A21N', RAM: 'B738', CFG: 'A20N', EWG: 'A20N' };
  // the terminal each airline uses (2026): Ryanair, British Airways, Loganair and Aer Lingus at Terminal 3; everyone else
  // at Terminal 2 (Terminal 1 has closed; its Pier C is now part of Terminal 2)
  const TERMINAL_OF = { RYR: '3', RUK: '3', BAW: '3', LOG: '3', EIN: '3' };
  const TYPES = {
    A321: { name: 'A321',          wake: 'M', vapp: 140, vr: 150, climb: 2200, desc: 2000, cruise: 290, span: 34.1, len: 44.5, shape: 'jet' },
    B38M: { name: '737 MAX 8',     wake: 'M', vapp: 145, vr: 150, climb: 2400, desc: 2100, cruise: 290, span: 35.9, len: 39.5, shape: 'jet' },
    B752: { name: '757-200',       wake: 'M', vapp: 135, vr: 145, climb: 2800, desc: 2200, cruise: 290, span: 38.1, len: 47.3, shape: 'jet' },
    BCS3: { name: 'A220-300',      wake: 'M', vapp: 128, vr: 135, climb: 2600, desc: 2000, cruise: 290, span: 35.1, len: 38.7, shape: 'jet' },
    E190: { name: 'Embraer 190',   wake: 'M', vapp: 128, vr: 135, climb: 2500, desc: 2000, cruise: 280, span: 28.7, len: 36.2, shape: 'jet' },
    E145: { name: 'Embraer 145',   wake: 'M', vapp: 125, vr: 130, climb: 2400, desc: 2000, cruise: 270, span: 20.0, len: 29.9, shape: 'jet' },
    A333: { name: 'A330-300',      wake: 'H', vapp: 140, vr: 152, climb: 1900, desc: 2000, cruise: 300, span: 60.3, len: 63.7, shape: 'jet' },
    A339: { name: 'A330-900neo',   wake: 'H', vapp: 138, vr: 150, climb: 2000, desc: 2000, cruise: 300, span: 64.0, len: 63.7, shape: 'jet' },
    A359: { name: 'A350-900',      wake: 'H', vapp: 140, vr: 150, climb: 2100, desc: 2000, cruise: 300, span: 64.8, len: 66.8, shape: 'jet' },
    A388: { name: 'A380',          wake: 'H', vapp: 140, vr: 155, climb: 1600, desc: 1800, cruise: 300, span: 79.8, len: 72.7, shape: 'jet' },
    B763: { name: '767-300',       wake: 'H', vapp: 140, vr: 150, climb: 2200, desc: 2000, cruise: 300, span: 47.6, len: 54.9, shape: 'jet' },
    B772: { name: '777-200',       wake: 'H', vapp: 140, vr: 155, climb: 1900, desc: 2000, cruise: 300, span: 60.9, len: 63.7, shape: 'jet' },
    B77W: { name: '777-300ER',     wake: 'H', vapp: 149, vr: 160, climb: 1800, desc: 2000, cruise: 300, span: 64.8, len: 73.9, shape: 'jet' },
    B789: { name: '787-9',         wake: 'H', vapp: 145, vr: 155, climb: 2100, desc: 2000, cruise: 300, span: 60.1, len: 62.8, shape: 'jet' }
  };
  // Manchester's flight boards give places by city name
  const PLACES = {
    'glasgow': 'EGPF', 'edinburgh': 'EGPH', 'aberdeen': 'EGPD', 'inverness': 'EGPE', 'newcastle': 'EGNT', 'belfast': 'EGAA', 'belfast city': 'EGAC', 'derry': 'EGAE',
    'isle of man': 'EGNS', 'london': 'EGLL', 'jersey': 'EGJJ', 'guernsey': 'EGJB', 'newquay': 'EGHQ', 'cardiff': 'EGFF', 'bristol': 'EGGD', 'liverpool': 'EGGP',
    'dublin': 'EIDW', 'shannon': 'EINN', 'cork': 'EICK', 'knock': 'EIKN', 'kerry': 'EIKY', 'reykjavik': 'BIKF', 'oslo': 'ENGM', 'bergen': 'ENBR',
    'stockholm': 'ESSA', 'gothenburg': 'ESGG', 'copenhagen': 'EKCH', 'billund': 'EKBI', 'helsinki': 'EFHK', 'tallinn': 'EETN', 'riga': 'EVRA', 'vilnius': 'EYVI',
    'gdansk': 'EPGD', 'krakow': 'EPKK', 'krakow/balice': 'EPKK', 'katowice': 'EPKT', 'warsaw': 'EPWA', 'wroclaw': 'EPWR', 'amsterdam': 'EHAM', 'eindhoven': 'EHEH',
    'brussels': 'EBBR', 'luxembourg': 'ELLX', 'frankfurt': 'EDDF', 'munich': 'EDDM', 'berlin': 'EDDB', 'cologne/bonn': 'EDDK', 'cologne': 'EDDK', 'duesseldorf': 'EDDL',
    'dusseldorf': 'EDDL', 'hamburg': 'EDDH', 'stuttgart': 'EDDS', 'prague': 'LKPR', 'budapest': 'LHBP', 'vienna': 'LOWW', 'bratislava': 'LZIB', 'bucharest': 'LROP',
    'sofia': 'LBSF', 'zurich': 'LSZH', 'geneva': 'LSGG', 'milan': 'LIMC', 'milan linate': 'LIML', 'venice': 'LIPZ', 'verona': 'LIPX', 'bologna': 'LIPE', 'rome': 'LIRF',
    'naples': 'LIRN', 'pisa': 'LIRP', 'catania': 'LICC', 'palermo': 'LICJ', 'bari': 'LIBD', 'dubrovnik': 'LDDU', 'split': 'LDSP', 'zagreb': 'LDZA', 'tirana': 'LATI',
    'athens': 'LGAV', 'thessaloniki': 'LGTS', 'rhodes': 'LGRP', 'heraklion': 'LGIR', 'chania': 'LGSA', 'kerkyra': 'LGKR', 'corfu': 'LGKR', 'thira': 'LGSR', 'santorini': 'LGSR',
    'zakynthos island': 'LGZA', 'zakynthos': 'LGZA', 'kos': 'LGKO', 'istanbul': 'LTFM', 'antalya': 'LTAI', 'dalaman': 'LTBS', 'bodrum': 'LTFE', 'izmir': 'LTBJ',
    'paphos': 'LCPH', 'larnaca': 'LCLK', 'malta': 'LMML', 'tel aviv': 'LLBG', 'hurghada': 'HEGN', 'sharm el-sheikh': 'HESH', 'cairo': 'HECA', 'doha': 'OTHH',
    'dubai': 'OMDB', 'abu dhabi': 'OMAA', 'bahrain': 'OBBI', 'jeddah': 'OEJN', 'islamabad': 'OPIS', 'lahore': 'OPLA', 'delhi': 'VIDP', 'hong kong': 'VHHH',
    'singapore': 'WSSS', 'shanghai': 'ZSPD', 'melbourne': 'YMML', 'paris': 'LFPG', 'nice': 'LFMN', 'lyon': 'LFLL', 'marseille': 'LFML', 'carcassonne': 'LFCK',
    'limoges': 'LFBL', 'beziers': 'LFMU', 'bordeaux': 'LFBD', 'toulouse': 'LFBO', 'barcelona': 'LEBL', 'girona': 'LEGE', 'reus': 'LERS', 'palma de mallorca': 'LEPA',
    'palma': 'LEPA', 'ibiza': 'LEIB', 'menorca': 'LEMH', 'valencia': 'LEVC', 'alicante': 'LEAL', 'murcia': 'LEMI', 'almeria': 'LEAM', 'madrid': 'LEMD', 'bilbao': 'LEBB',
    'malaga': 'LEMG', 'sevilla': 'LEZL', 'seville': 'LEZL', 'gibraltar': 'LXGB', 'lisbon': 'LPPT', 'faro': 'LPFR', 'porto': 'LPPR', 'funchal': 'LPMA', 'tenerife': 'GCTS',
    'tenerife south': 'GCTS', 'gran canaria': 'GCLP', 'lanzarote': 'GCRR', 'fuerteventura': 'GCFV', 'santa cruz de la palma': 'GCLA', 'agadir': 'GMAD', 'marrakech': 'GMMX',
    'casablanca': 'GMMN', 'sal island': 'GVAC', 'boa vista island': 'GVBA', 'enfidha': 'DTNH', 'tunis': 'DTTA', 'algiers': 'DAAG', 'new york': 'KJFK', 'newark': 'KEWR',
    'boston': 'KBOS', 'philadelphia': 'KPHL', 'atlanta': 'KATL', 'orlando': 'KMCO', 'chicago': 'KORD', 'las vegas': 'KLAS', 'washington': 'KIAD', 'toronto': 'CYYZ',
    'montreal': 'CYUL', 'vancouver': 'CYVR', 'cancun': 'MMUN', 'barbados': 'TBPB', 'montego bay': 'MKJS'
  };
  const AIRPORTS = {
    EGCC: [53.3537, -2.2750, 'Manchester'], EGPF: [55.8719, -4.4331, 'Glasgow'], EGPH: [55.9500, -3.3725, 'Edinburgh'], EGPD: [57.2019, -2.1978, 'Aberdeen'],
    EGPE: [57.5425, -4.0475, 'Inverness'], EGNT: [55.0375, -1.6917, 'Newcastle'], EGAA: [54.6575, -6.2158, 'Belfast'], EGAC: [54.6181, -5.8725, 'Belfast City'],
    EGAE: [55.0428, -7.1611, 'Derry'], EGNS: [54.0833, -4.6239, 'Isle of Man'], EGLL: [51.4700, -0.4543, 'London Heathrow'], EGJJ: [49.2079, -2.1955, 'Jersey'],
    EGJB: [49.4350, -2.6019, 'Guernsey'], EGHQ: [50.4406, -4.9954, 'Newquay'], EGFF: [51.3967, -3.3433, 'Cardiff'], EGGD: [51.3827, -2.7191, 'Bristol'],
    EGGP: [53.3336, -2.8497, 'Liverpool'], EGNM: [53.8659, -1.6606, 'Leeds Bradford'], EGNX: [52.8311, -1.3281, 'East Midlands'],
    EIDW: [53.4213, -6.2701, 'Dublin'], EINN: [52.7020, -8.9248, 'Shannon'], EICK: [51.8413, -8.4911, 'Cork'], EIKN: [53.9103, -8.8185, 'Knock'], EIKY: [52.1809, -9.5238, 'Kerry'],
    BIKF: [63.9850, -22.6056, 'Keflavík'], ENGM: [60.1939, 11.1004, 'Oslo'], ENBR: [60.2934, 5.2181, 'Bergen'], ESSA: [59.6519, 17.9186, 'Stockholm'], ESGG: [57.6628, 12.2798, 'Gothenburg'],
    EKCH: [55.6181, 12.6561, 'Copenhagen'], EKBI: [55.7403, 9.1518, 'Billund'], EFHK: [60.3172, 24.9633, 'Helsinki'], EETN: [59.4133, 24.8328, 'Tallinn'],
    EVRA: [56.9236, 23.9711, 'Riga'], EYVI: [54.6341, 25.2858, 'Vilnius'], EPGD: [54.3776, 18.4662, 'Gdańsk'], EPKK: [50.0777, 19.7848, 'Kraków'], EPKT: [50.4743, 19.0800, 'Katowice'],
    EPWA: [52.1657, 20.9671, 'Warsaw'], EPWR: [51.1027, 16.8858, 'Wrocław'], EHAM: [52.3086, 4.7639, 'Amsterdam'], EHEH: [51.4501, 5.3745, 'Eindhoven'],
    EBBR: [50.9014, 4.4844, 'Brussels'], ELLX: [49.6233, 6.2044, 'Luxembourg'], EDDF: [50.0333, 8.5706, 'Frankfurt'], EDDM: [48.3538, 11.7861, 'Munich'],
    EDDB: [52.3667, 13.5033, 'Berlin'], EDDK: [50.8659, 7.1427, 'Cologne'], EDDL: [51.2895, 6.7668, 'Düsseldorf'], EDDH: [53.6304, 9.9882, 'Hamburg'],
    EDDS: [48.6899, 9.2220, 'Stuttgart'], LKPR: [50.1008, 14.2600, 'Prague'], LHBP: [47.4298, 19.2611, 'Budapest'], LOWW: [48.1103, 16.5697, 'Vienna'],
    LZIB: [48.1702, 17.2127, 'Bratislava'], LROP: [44.5711, 26.0850, 'Bucharest'], LBSF: [42.6967, 23.4114, 'Sofia'], LSZH: [47.4647, 8.5492, 'Zurich'],
    LSGG: [46.2381, 6.1090, 'Geneva'], LIMC: [45.6306, 8.7281, 'Milan Malpensa'], LIML: [45.4451, 9.2767, 'Milan Linate'], LIPZ: [45.5053, 12.3519, 'Venice'],
    LIPX: [45.3957, 10.8885, 'Verona'], LIPE: [44.5354, 11.2887, 'Bologna'], LIRF: [41.8003, 12.2389, 'Rome'], LIRN: [40.8860, 14.2908, 'Naples'], LIRP: [43.6839, 10.3927, 'Pisa'],
    LICC: [37.4668, 15.0664, 'Catania'], LICJ: [38.1760, 13.0910, 'Palermo'], LIBD: [41.1389, 16.7606, 'Bari'], LDDU: [42.5614, 18.2682, 'Dubrovnik'], LDSP: [43.5389, 16.2980, 'Split'],
    LDZA: [45.7429, 16.0688, 'Zagreb'], LATI: [41.4147, 19.7206, 'Tirana'], LGAV: [37.9364, 23.9445, 'Athens'], LGTS: [40.5197, 22.9709, 'Thessaloniki'],
    LGRP: [36.4054, 28.0862, 'Rhodes'], LGIR: [35.3397, 25.1803, 'Heraklion'], LGSA: [35.5317, 24.1497, 'Chania'], LGKR: [39.6019, 19.9117, 'Corfu'],
    LGSR: [36.3992, 25.4793, 'Santorini'], LGZA: [37.7509, 20.8843, 'Zakynthos'], LGKO: [36.7933, 27.0917, 'Kos'], LTFM: [41.2753, 28.7519, 'Istanbul'],
    LTAI: [36.8987, 30.8005, 'Antalya'], LTBS: [36.7131, 28.7925, 'Dalaman'], LTFE: [37.2506, 27.6643, 'Bodrum'], LTBJ: [38.2924, 27.1570, 'Izmir'],
    LCPH: [34.7180, 32.4857, 'Paphos'], LCLK: [34.8751, 33.6249, 'Larnaca'], LMML: [35.8575, 14.4775, 'Malta'], LLBG: [32.0114, 34.8867, 'Tel Aviv'],
    HEGN: [27.1783, 33.7994, 'Hurghada'], HESH: [27.9773, 34.3950, 'Sharm el-Sheikh'], HECA: [30.1219, 31.4056, 'Cairo'], OTHH: [25.2731, 51.6081, 'Doha'],
    OMDB: [25.2532, 55.3657, 'Dubai'], OMAA: [24.4330, 54.6511, 'Abu Dhabi'], OBBI: [26.2708, 50.6336, 'Bahrain'], OEJN: [21.6796, 39.1565, 'Jeddah'],
    OPIS: [33.5490, 72.8257, 'Islamabad'], OPLA: [31.5216, 74.4036, 'Lahore'], VIDP: [28.5665, 77.1031, 'Delhi'], VHHH: [22.3080, 113.9185, 'Hong Kong'],
    WSSS: [1.3644, 103.9915, 'Singapore'], ZSPD: [31.1443, 121.8083, 'Shanghai'], YMML: [-37.6690, 144.8410, 'Melbourne'], LFPG: [49.0097, 2.5479, 'Paris CDG'],
    LFPO: [48.7233, 2.3794, 'Paris Orly'], LFMN: [43.6584, 7.2159, 'Nice'], LFLL: [45.7256, 5.0811, 'Lyon'], LFML: [43.4393, 5.2214, 'Marseille'], LFCK: [43.2160, 2.3063, 'Carcassonne'],
    LFBL: [45.8628, 1.1794, 'Limoges'], LFMU: [43.3235, 3.3539, 'Béziers'], LFBD: [44.8283, -0.7156, 'Bordeaux'], LFBO: [43.6291, 1.3638, 'Toulouse'],
    LEBL: [41.2971, 2.0785, 'Barcelona'], LEGE: [41.9010, 2.7605, 'Girona'], LERS: [41.1474, 1.1672, 'Reus'], LEPA: [39.5517, 2.7388, 'Palma'], LEIB: [38.8729, 1.3731, 'Ibiza'],
    LEMH: [39.8626, 4.2186, 'Menorca'], LEVC: [39.4893, -0.4816, 'Valencia'], LEAL: [38.2822, -0.5582, 'Alicante'], LEMI: [37.8030, -1.1250, 'Murcia'],
    LEAM: [36.8439, -2.3701, 'Almería'], LEMD: [40.4722, -3.5608, 'Madrid'], LEBB: [43.3011, -2.9106, 'Bilbao'], LEMG: [36.6749, -4.4991, 'Málaga'],
    LEZL: [37.4180, -5.8931, 'Seville'], LXGB: [36.1512, -5.3497, 'Gibraltar'], LPPT: [38.7742, -9.1342, 'Lisbon'], LPFR: [37.0144, -7.9659, 'Faro'],
    LPPR: [41.2481, -8.6814, 'Porto'], LPMA: [32.6979, -16.7745, 'Madeira'], GCTS: [28.0445, -16.5725, 'Tenerife South'], GCLP: [27.9319, -15.3866, 'Gran Canaria'],
    GCRR: [28.9455, -13.6052, 'Lanzarote'], GCFV: [28.4527, -13.8638, 'Fuerteventura'], GCLA: [28.6265, -17.7556, 'La Palma'], GMAD: [30.3250, -9.4131, 'Agadir'],
    GMMX: [31.6069, -8.0363, 'Marrakech'], GMMN: [33.3675, -7.5900, 'Casablanca'], GVAC: [16.7414, -22.9494, 'Sal'], GVBA: [16.1365, -22.8889, 'Boa Vista'],
    DTNH: [36.0758, 10.4386, 'Enfidha'], DTTA: [36.8510, 10.2272, 'Tunis'], DAAG: [36.6910, 3.2154, 'Algiers'], KJFK: [40.6399, -73.7789, 'New York JFK'],
    KEWR: [40.6925, -74.1687, 'Newark'], KBOS: [42.3656, -71.0096, 'Boston'], KPHL: [39.8729, -75.2437, 'Philadelphia'], KATL: [33.6407, -84.4277, 'Atlanta'],
    KMCO: [28.4312, -81.3081, 'Orlando'], KORD: [41.9742, -87.9073, 'Chicago'], KLAS: [36.0840, -115.1537, 'Las Vegas'], KIAD: [38.9531, -77.4565, 'Washington Dulles'],
    CYYZ: [43.6777, -79.6248, 'Toronto'], CYUL: [45.4706, -73.7408, 'Montreal'], CYVR: [49.1947, -123.1792, 'Vancouver'], MMUN: [21.0365, -86.8771, 'Cancún'],
    TBPB: [13.0746, -59.4925, 'Barbados'], MKJS: [18.5037, -77.9134, 'Montego Bay']
  };

  return {
    icao: 'EGCC', iata: 'MAN', name: 'Manchester', city: 'Manchester', country: 'United Kingdom', arp: P('532113N', '0021630W'), elev: 257,
    FIX, NAV, RWY, CONFIGS, STARS, HOLDS_AIR, ILS, SIDS, DIR, PLACE_DIR, dirFor, UNITS, CTR, TA, TZ, ALTERNATES,
    TIMETABLE, LONG_STAY, EXTRA, EXERCISES, WX_PRESETS, TEL, AIRLINE_ICAO, AIRLINE_TYPE, TERMINAL_OF, TYPES, PLACES, AIRPORTS,
    data: { metar: 'egcc/metar.txt', flights: 'egcc/flights.json' },
    features: { roadCrossing: false, sra: false, ils: true, rnavSids: true, singleRunway: false, parallelRunways: true }
  };
})();
if (typeof module !== 'undefined') module.exports = EGCC;
