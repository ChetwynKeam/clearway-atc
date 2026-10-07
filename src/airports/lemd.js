// ═════════════════════════ Madrid-Barajas (LEMD) airport profile ═════════════════════════
// Everything the Clearway engine needs to know that is true only of Madrid. Sources: Spanish AIP AD 2-LEMD (AIRAC 09/26):
// AD 2 text (runways 2.12, frequencies 2.18, configurations, exits and taxi routes 2.20), RNAV1 SIDs SID 1-8 and STARs
// STAR 1-4 with their coding tables, ILS Z approaches IAC 1, 7, 13 and 19 with their RNAV1 initial segments, and
// OpenStreetMap for the taxiways, stands, aprons and buildings (lemd-ground.js). Positions are lat/lon (WGS84); variation
// is 0°, so magnetic and true bearings are the same. Summary of the charts: airports/lemd/README.md.
// Madrid has four runways in two pairs and uses them two at a time each way: in the north flow arrivals land on 32L and
// 32R and departures take off from 36L and 36R; in the south flow arrivals land on 18L and 18R and departures take off
// from 14L and 14R. Arrivals from the west use 32L/18R, from the east 32R/18L.
// Plain data plus a few small functions, like egkk.js; lemd-engine.js turns it into the engine's globals.

const LEMD = (() => {
  const ll = (s) => {                                     // '402820N' / '0033339.0W' → decimal degrees
    const m = s.match(/^(\d{2,3})(\d{2})(\d{2}(?:\.\d+)?)([NSEW])$/);
    const v = +m[1] + m[2]/60 + m[3]/3600; return /[SW]/.test(m[4]) ? -v : v;
  };
  const P = (lat, lon) => [ll(lat), ll(lon)];

  // ── fixes (SID and STAR coding tables, ILS Z initial segments IAC 1, 7, 13, 19) ── SIDs and STARs: alt = the level
  // constraint at the fix (feet); the SIDs are cut at 13,000 ft, the transition altitude and the initial clearance
  const FIX = {
    ADUXO: P('403044.4N', '0020351.4W'), AVILA: P('403728.6N', '0043259.6W'), BAN: P('411925.2N', '0023747.7W'), BANEV: P('413009.4N', '0023052.3W'),
    BARDI: P('403500.6N', '0061808.8W'), BRA: P('402808.9N', '0033327.1W'), BUREX: P('394839.8N', '0035621.5W'), CCS: P('393127.7N', '0062604.8W'),
    CJN: P('402218.6N', '0023240.8W'), CNR: P('403845.8N', '0034408.5W'), DAQSE: P('402035.1N', '0040848.1W'), DISKO: P('410054.9N', '0041323.7W'),
    FAFEQ: P('401009.8N', '0032738.5W'), GOXOL: P('402448.3N', '0043855.0W'), LONGA: P('402618.1N', '0045237.6W'), LULER: P('405450.3N', '0032242.0W'),
    MD001: P('402330.0N', '0021920.0W'), MD012: P('403947.1N', '0034213.9W'), MD025: P('404416.5N', '0033327.4W'), MD030: P('401702.7N', '0032222.2W'),
    MD031: P('401146.7N', '0032528.0W'), MD033: P('401810.6N', '0040946.1W'), MD035: P('402131.0N', '0031952.5W'), MD039: P('403825.6N', '0034043.6W'),
    MD041: P('403627.7N', '0034758.2W'), MD044: P('404649.4N', '0033931.0W'), MD047: P('403537.1N', '0033217.6W'), MD048: P('404513.2N', '0032133.3W'),
    MD049: P('404212.4N', '0031619.9W'), MD050: P('402554.0N', '0032937.4W'), MD051: P('402215.5N', '0031945.0W'), MD052: P('402206.2N', '0043804.2W'),
    MD11L: P('401836.3N', '0032356.5W'), MD12R: P('401859.7N', '0032238.5W'), MD16L: P('404759.8N', '0033339.1W'), MD19R: P('405032.4N', '0033435.9W'),
    MD22W: P('405332.6N', '0033437.0W'), MD400: P('410025.6N', '0051656.3W'), MD405: P('394737.1N', '0042551.5W'), MD410: P('393327.7N', '0035946.8W'),
    MD414: P('401507.0N', '0032319.5W'), MD418: P('401225.5N', '0032503.7W'), MD420: P('400640.9N', '0033219.4W'), MD425: P('401145.0N', '0033349.8W'),
    MD430: P('403130.6N', '0041424.3W'), MD435: P('405206.1N', '0041310.1W'), MD440: P('395518.5N', '0034732.0W'), MD445: P('395005.4N', '0040719.4W'),
    MD450: P('394113.7N', '0040610.9W'), MD455: P('401108.7N', '0045327.7W'), MD460: P('393107.9N', '0041926.3W'), MD465: P('392520.8N', '0035307.4W'),
    MD477: P('401450.1N', '0032219.9W'), MD505: P('402628.7N', '0021830.4W'), MD516: P('401659.5N', '0031933.0W'), MD519: P('401615.4N', '0031357.6W'),
    MD530: P('402458.0N', '0030035.8W'), MD535: P('404707.2N', '0023841.3W'), MD545: P('404945.9N', '0023508.9W'), MD550: P('401544.1N', '0021656.4W'),
    MD620: P('405205.3N', '0033243.6W'), MD623: P('405501.5N', '0033056.4W'), MD626: P('405531.9N', '0032702.2W'), MD725: P('405657.3N', '0033438.2W'),
    MD730: P('405820.4N', '0034002.6W'), MD800: P('402624.5N', '0033117.1W'), MD801: P('402145.4N', '0032530.1W'), MD802: P('402006.3N', '0032345.8W'),
    MD810: P('401609.0N', '0032816.1W'), MD811: P('401328.1N', '0033658.6W'), MD813: P('402510.4N', '0034329.9W'), MD821: P('401406.7N', '0031602.3W'),
    MD822: P('401101.2N', '0030203.3W'), MD823: P('401548.4N', '0030144.0W'), MD824: P('402410.7N', '0030649.4W'), MD825: P('403351.5N', '0030939.9W'),
    MD826: P('403708.9N', '0031712.8W'), MD827: P('401815.0N', '0032258.5W'), MD828: P('401820.3N', '0031556.9W'), MD900: P('403521.6N', '0033334.9W'),
    MD901: P('403811.1N', '0033233.5W'), MD902: P('404212.6N', '0033212.0W'), MD910: P('404111.2N', '0033849.4W'), MD913: P('405408.6N', '0033434.5W'),
    MD920: P('404632.7N', '0032351.5W'), MD922: P('400758.5N', '0024825.3W'), MORAL: P('390000.0N', '0033231.8W'), NANDO: P('395919.9N', '0021028.4W'),
    NONTU: P('413001.1N', '0041008.4W'), NOSKO: P('403922.8N', '0024900.2W'), NVS: P('402206.8N', '0041457.7W'), ORBIS: P('411556.6N', '0041143.2W'),
    PDT: P('401510.5N', '0032052.9W'), PINAR: P('405849.1N', '0023557.0W'), PODOG: P('411843.2N', '0042625.0W'), PRADO: P('400851.0N', '0020037.2W'),
    RBO: P('405114.3N', '0031447.4W'), RIDAV: P('403206.9N', '0054829.8W'), RILKO: P('405844.1N', '0034748.6W'), ROFIX: P('401247.9N', '0034729.9W'),
    RUDBI: P('401529.4N', '0030810.0W'), SECQO: P('404407.3N', '0041537.1W'), SIE: P('410906.0N', '0033617.4W'), SIRGU: P('401537.8N', '0023600.5W'),
    SOTUK: P('391137.2N', '0044447.0W'), SSY: P('403247.1N', '0033431.3W'), TLD: P('395810.0N', '0042014.0W'), URRIF: P('401432.3N', '0034446.7W'),
    USATI: P('405738.0N', '0043640.0W'), VENUX: P('411200.9N', '0025126.6W'), VILLA: P('401358.6N', '0022437.6W'), VTB: P('394650.6N', '0032751.1W'),
    YUNYE: P('400238.7N', '0033744.2W'), ZMR: P('413148.2N', '0053823.1W')
  };
  const SIDS = {
    BARDI7L: { rwy: '36L', spoken: 'Bardi Seven Lima', pts: [['SSY',2400],['MD039',5200],['AVILA',12000],['LONGA',13000],['BARDI']] },
    CCS6L: { rwy: '36L', spoken: 'Caceres Six Lima', pts: [['SSY',2400],['MD039',5200],['AVILA',12000],['LONGA',13000],['CCS',13000]] },
    NANDO3N: { rwy: '36L', spoken: 'Nando Three November', pts: [['SSY',2400],['MD901'],['MD902'],['MD920',7000],['MD049',8000],['MD824',13000],['MD922',13000],['NANDO',13000]] },
    PINAR4N: { rwy: '36L', spoken: 'Pinar Four November', pts: [['SSY',2400],['MD901'],['MD902'],['RBO',8000],['PINAR',13000]] },
    RBO4N: { rwy: '36L', spoken: 'Robledillo Four November', pts: [['SSY',2400],['MD901'],['MD902'],['RBO',10000]] },
    SIE6L: { rwy: '36L', spoken: 'Sierra Six Lima', pts: [['SSY',2400],['MD039',5200],['SIE',12000]] },
    VTB6L: { rwy: '36L', spoken: 'Villatobas Six Lima', pts: [['SSY',2400],['MD012',5400],['MD041',6400],['BRA',12000],['VTB',13000]] },
    ZMR7L: { rwy: '36L', spoken: 'Zamora Seven Lima', pts: [['SSY',2400],['MD039',5200],['MD044',7600],['DISKO',12000],['ZMR',13000]] },
    BARDI6W: { rwy: '36R', spoken: 'Bardi Six Whiskey', pts: [['MD900'],['MD901',4500],['MD910'],['CNR'],['AVILA',12000],['LONGA',13000],['BARDI']] },
    CCS5W: { rwy: '36R', spoken: 'Caceres Five Whiskey', pts: [['MD900'],['MD901',4500],['MD910'],['CNR'],['AVILA',12000],['LONGA',13000],['CCS',13000]] },
    NANDO3R: { rwy: '36R', spoken: 'Nando Three Romeo', pts: [['MD047',3000],['MD048',7000],['MD049',8000],['MD824',13000],['MD922',13000],['NANDO',13000]] },
    PINAR4R: { rwy: '36R', spoken: 'Pinar Four Romeo', pts: [['MD047',3000],['RBO',10000],['PINAR',13000]] },
    RBO4R: { rwy: '36R', spoken: 'Robledillo Four Romeo', pts: [['MD047',3000],['RBO',10000]] },
    SIE3W: { rwy: '36R', spoken: 'Sierra Three Whiskey', pts: [['MD900'],['MD901',4500],['MD025',7000],['MD913',9000],['SIE',12000]] },
    VTB2R: { rwy: '36R', spoken: 'Villatobas Two Romeo', pts: [['MD047',3000],['MD048',7000],['MD049',8000],['PDT',13000],['VTB',13000]] },
    ZMR3W: { rwy: '36R', spoken: 'Zamora Three Whiskey', pts: [['MD900'],['MD901',4500],['MD025',7000],['DISKO',12000],['ZMR',13000]] },
    BARDI3V: { rwy: '14L', spoken: 'Bardi Three Victor', pts: [['MD802',5000],['MD810',6500],['NVS',8000],['GOXOL',13000],['BARDI']] },
    CCS4V: { rwy: '14L', spoken: 'Caceres Four Victor', pts: [['MD802',5000],['MD810',6500],['CCS',13000]] },
    NANDO2U: { rwy: '14L', spoken: 'Nando Two Uniform', pts: [['MD050',2600],['MD035',5700],['MD823',11000],['NANDO',13000]] },
    PINAR2U: { rwy: '14L', spoken: 'Pinar Two Uniform', pts: [['MD050',2600],['MD051',5700],['MD826',11000],['RBO',13000],['PINAR',13000]] },
    RBO2U: { rwy: '14L', spoken: 'Robledillo Two Uniform', pts: [['MD050',2600],['MD051',5700],['MD826',11000],['RBO',13000]] },
    SIE2U: { rwy: '14L', spoken: 'Sierra Two Uniform', pts: [['MD050',2600],['MD051',5700],['MD826',11000],['RBO',13000],['SIE',13000]] },
    VTB3V: { rwy: '14L', spoken: 'Villatobas Three Victor', pts: [['MD802',5000],['PDT',6500],['VTB',13000]] },
    ZMR3V: { rwy: '14L', spoken: 'Zamora Three Victor', pts: [['MD802',5000],['MD810',6500],['NVS',8000],['ZMR',13000]] },
    BARDI3S: { rwy: '14R', spoken: 'Bardi Three Sierra', pts: [['MD030',6200],['MD031',7600],['MD052',13000],['BARDI']] },
    CCS2S: { rwy: '14R', spoken: 'Caceres Two Sierra', pts: [['MD030',6200],['MD031',6800],['CCS',13000]] },
    NANDO3B: { rwy: '14R', spoken: 'Nando Three Bravo', pts: [['MD800'],['MD801',4700],['MD827'],['MD821'],['MD822',11000],['NANDO',13000]] },
    PINAR4B: { rwy: '14R', spoken: 'Pinar Four Bravo', pts: [['MD800'],['MD801',4700],['MD827'],['MD828',8000],['MD824'],['MD825',13000],['RBO'],['PINAR']] },
    RBO3B: { rwy: '14R', spoken: 'Robledillo Three Bravo', pts: [['MD800'],['MD801',4700],['MD827'],['MD828',8000],['MD824'],['MD825',13000],['RBO']] },
    SIE2S: { rwy: '14R', spoken: 'Sierra Two Sierra', pts: [['MD030',6200],['MD031',7600],['MD811',10000],['MD813',13000],['CNR',13000],['SIE']] },
    VTB2S: { rwy: '14R', spoken: 'Villatobas Two Sierra', pts: [['MD030',6200],['MD031',8100],['VTB',13000]] },
    ZMR2S: { rwy: '14R', spoken: 'Zamora Two Sierra', pts: [['MD030',6200],['MD031',6800],['MD033',13000],['ZMR',13000]] }
  };
  const STARS = {
    MORAL6C: { pts: [['MORAL'],['MD465',21000],['MD450',15000],['BUREX'],['MD440',8000],['YUNYE',7000],['MD420',6000],['FAFEQ']] },
    NONTU5C: { pts: [['NONTU',15000],['ORBIS',15000],['MD435',15000],['MD430',12000],['DAQSE'],['URRIF',7000],['MD425',6000],['FAFEQ']] },
    RIDAV5C: { pts: [['RIDAV'],['MD455',24000],['TLD'],['MD445'],['BUREX'],['MD440',8000],['YUNYE',7000],['MD420',6000],['FAFEQ']] },
    SOTUK5C: { pts: [['SOTUK'],['MD460',21000],['MD450',15000],['BUREX'],['MD440',8000],['YUNYE',7000],['MD420',6000],['FAFEQ']] },
    ADUXO3D: { pts: [['ADUXO',21000],['MD001',15000],['SIRGU'],['RUDBI',8000]] },
    PRADO4D: { pts: [['PRADO',21000],['MD550',15000],['SIRGU'],['RUDBI',8000]] },
    VILLA4D: { pts: [['VILLA',19000],['SIRGU'],['RUDBI',8000]] },
    MORAL7A: { pts: [['MORAL'],['MD410',20000],['TLD',15000],['NVS',12000],['SECQO',11000],['RILKO',11000]] },
    NONTU3A: { pts: [['NONTU',15000],['ORBIS',11000],['RILKO',11000]] },
    RIDAV3A: { pts: [['RIDAV'],['MD400',24000],['USATI',20000],['SECQO',12000],['RILKO',11000]] },
    SOTUK7A: { pts: [['SOTUK'],['MD405',20000],['TLD',15000],['NVS',12000],['SECQO',11000],['RILKO',11000]] },
    ADUXO7B: { pts: [['ADUXO',15000],['MD505',15000],['NOSKO',10000],['RBO'],['LULER']] },
    BANEV3B: { pts: [['BANEV',15000],['BAN',15000],['VENUX',12000],['LULER']] },
    PRADO8E: { pts: [['PRADO',15000],['CJN',15000],['NOSKO',10000],['RBO'],['LULER']] },
    VILLA7E: { pts: [['VILLA',10000],['CJN',10000],['NOSKO',10000],['RBO'],['LULER']] },
    ZMR6C: { pts: [['ZMR'],['AVILA'],['DAQSE'],['URRIF',7000],['MD425',6000],['FAFEQ']] },
    ZMR5A: { pts: [['ZMR'],['PODOG',15000],['ORBIS',11000],['RILKO',11000]] },
    BANEV5D: { pts: [['BANEV',15000],['BAN',15000],['PINAR',15000],['MD545',13000],['MD535',13000],['NOSKO',10000],['MD530',10000],['RUDBI',8000]] }
  };
  // VOR/DMEs (AD 2.19)
  const NAV = {
    BRA: { name: 'Barajas DVOR/DME', freq: '116.45', p: P('402808.9N', '0033327.1W') },
    SSY: { name: 'San Sebastián de los Reyes DVOR/DME', freq: '117.85', p: P('403247.1N', '0033431.3W') },
    PDT: { name: 'Perales DVOR/DME', freq: '116.95', p: P('401510.5N', '0032052.9W') },
    RBO: { name: 'Robledillo DVOR/DME', freq: '113.95', p: P('405114.3N', '0031447.4W') },
    SIE: { name: 'Sierra DVOR/DME', freq: '115.40', p: P('410906.1N', '0033616.8W') },
    CNR: { name: 'Colmenar Viejo DVOR/DME', freq: '117.30', p: P('403845.8N', '0034408.5W') },
    TLD: { name: 'Toledo DVOR/DME', freq: '113.20', p: P('395810.0N', '0042014.0W') },
    NVS: { name: 'Navas del Rey DVOR/DME', freq: '114.95', p: null },
    BAN: { name: 'Barahona DVOR/DME', freq: '112.80', p: null },
    CJN: { name: 'Castejón DVOR/DME', freq: '115.60', p: null }
  };
  for (const k in NAV) if (!NAV[k].p) NAV[k].p = FIX[k];

  // ── runways (AD 2.12): four 60 m runways. 14L, 14R, 36L and 36R are take-off only (their thresholds are the pavement
  // ends); 32R, 32L, 18L and 18R are landing only, with displaced thresholds
  const RWY = {
    list: ['14L32R', '14R32L', '18L36R', '18R36L'], var: 0,
    thr: { '14L': P('402941.71N', '0033328.33W'), '32R': P('402824.85N', '0033210.30W'), '14R': P('402905.50N', '0033433.64W'), '32L': P('402747.10N', '0033314.02W'),
      '18L': P('403141.22N', '0033333.68W'), '36R': P('403003.97N', '0033333.15W'), '18R': P('403122.40N', '0033429.27W'), '36L': P('402933.32N', '0033428.64W') },
    elev: { '14L': 1942, '32R': 1886, '14R': 1995, '32L': 1933, '18L': 1922, '36R': 1942, '18R': 1991, '36L': 1985 }
  };
  // the two runway configurations (AD 2.20): north flow (preferred) and south flow. "west" serves arrivals from the west
  // and the west departure runway; "east" the east ones
  const CONFIGS = {
    north: { land: { west: '32L', east: '32R' }, dep: { west: '36L', east: '36R' }, name: 'North' },
    south: { land: { west: '18R', east: '18L' }, dep: { west: '14R', east: '14L' }, name: 'South' }
  };

  // ── ILS Z approaches (IAC 13, 19, 7, 1). The RNAV1 initial segment from the STAR's last fix (the IAF) to the
  // intermediate fix, the platform altitude (the localiser is intercepted there), the final approach point distance
  // (NM from the threshold) and the missed approach: every one ends in the ROFIX hold south-west of the airport.
  const ILS = {
    '32L': { loc: 'MAA', freq: '109.90', ifx: 'MD11L', ifAlt: 4000, fap: 6.2, from: { FAFEQ: [['MD418', 5500], ['MD414', 4000]], RUDBI: [['MD519', 6000], ['MD516', 6000]] }, missed: ['ROFIX', 5000], turn: -1 },
    '32R': { loc: 'MBB', freq: '109.10', ifx: 'MD12R', ifAlt: 5000, fap: 9.4, from: { FAFEQ: [['MD418', 5500], ['MD477', 5000]], RUDBI: [['MD519', 6000], ['MD516', 6000]] }, missed: ['ROFIX', 6000], turn: -1 },
    '18R': { loc: 'IMR', freq: '110.70', ifx: 'MD19R', ifAlt: 7000, fap: 14.9, from: { RILKO: [['MD730', 10500], ['MD725', 8800], ['MD22W', 7800]], LULER: [['MD626', 8000], ['MD623', 7000]] }, missed: ['ROFIX', 6000], turn: 1 },
    '18L': { loc: 'IML', freq: '111.50', ifx: 'MD16L', ifAlt: 5500, fap: 10.8, from: { RILKO: [['MD730', 10500], ['MD725', 8800], ['MD22W', 7500]], LULER: [['MD626', 8000], ['MD623', 6500], ['MD620', 6000]] }, missed: ['ROFIX', 5000], turn: 1 }
  };
  // holds at the STAR ends and the missed-approach hold (inbound track, turn, minimum level)
  const HOLDS_AIR = {
    FAFEQ: { inb: 46, turn: 'R', min: 5000 }, RUDBI: { inb: 270, turn: 'L', min: 8000 },
    RILKO: { inb: 127, turn: 'L', min: 11000 }, LULER: { inb: 261, turn: 'L', min: 8000 }, ROFIX: { inb: 330, turn: 'R', min: 5000 }
  };

  // ── airway directions. Each has a STAR for each flow (north: to FAFEQ or RUDBI, south: to RILKO or LULER), the fix
  // where the simulator picks the arrival up on each (about 45-65 NM out), the side of the airport it lands on, the SID
  // family it departs by, and the Madrid ACC sector that takes the departure.
  const DIR = {
    N:   { star: { north: 'NONTU5C', south: 'NONTU3A' }, entry: { north: 'ORBIS', south: 'ORBIS' }, side: 'west', sid: 'SIE',   ctr: 'n', name: 'the Basque Country, France, the UK and Ireland' },
    NW:  { star: { north: 'ZMR6C',   south: 'ZMR5A' },   entry: { north: 'AVILA', south: 'PODOG' }, side: 'west', sid: 'ZMR',   ctr: 'n', name: 'Galicia, Asturias and North America' },
    W:   { star: { north: 'RIDAV5C', south: 'RIDAV3A' }, entry: { north: 'MD455', south: 'USATI' }, side: 'west', sid: 'BARDI', ctr: 'w', name: 'Portugal and Latin America' },
    SW:  { star: { north: 'SOTUK5C', south: 'SOTUK7A' }, entry: { north: 'MD460', south: 'MD405' }, side: 'west', sid: 'CCS',   ctr: 'w', name: 'Andalusia, the Canaries and West Africa' },
    S:   { star: { north: 'MORAL6C', south: 'MORAL7A' }, entry: { north: 'MD465', south: 'MD410' }, side: 'west', sid: 'VTB',   ctr: 's', name: 'Málaga, Granada and Morocco' },
    SE:  { star: { north: 'PRADO4D', south: 'PRADO8E' }, entry: { north: 'MD550', south: 'CJN' },   side: 'east', sid: 'NANDO', ctr: 's', name: 'Alicante, Murcia and Algeria' },
    E:   { star: { north: 'VILLA4D', south: 'VILLA7E' }, entry: { north: 'VILLA', south: 'VILLA' }, side: 'east', sid: 'NANDO', ctr: 'e', name: 'Valencia and the Balearic Islands' },
    ENE: { star: { north: 'ADUXO3D', south: 'ADUXO7B' }, entry: { north: 'MD001', south: 'MD505' }, side: 'east', sid: 'PINAR', ctr: 'e', name: 'Barcelona, Italy, Greece and the Middle East' },
    NE:  { star: { north: 'BANEV5D', south: 'BANEV3B' }, entry: { north: 'BAN', south: 'BAN' },     side: 'east', sid: 'RBO',   ctr: 'n', name: 'Zaragoza, eastern France, Germany and central Europe' }
  };
  const PLACE_DIR = {
    LEBB: 'N', LESO: 'N', LEXJ: 'N', LEPP: 'N', LFBD: 'N', LFBO: 'N', LFPG: 'N', LFPO: 'N', LFRS: 'N', EGLL: 'N', EGKK: 'N', EGSS: 'N', EGCC: 'N', EGGD: 'N', EGBB: 'N',
    EIDW: 'N', EINN: 'N', EHAM: 'N', EBBR: 'N', ELLX: 'N', EDDH: 'N', EKCH: 'N', ENGM: 'N', ESSA: 'N', EFHK: 'N', LFST: 'N',
    LEVX: 'NW', LECO: 'NW', LEST: 'NW', LEAS: 'NW', LELN: 'NW', KJFK: 'NW', KBOS: 'NW', KPHL: 'NW', KORD: 'NW', KEWR: 'NW', KIAD: 'NW', CYYZ: 'NW', CYUL: 'NW', KATL: 'NW',
    LPPT: 'W', LPPR: 'W', LPMA: 'W', LPPD: 'W', SKBO: 'W', SKCL: 'W', SKRG: 'W', SPJC: 'W', SAEZ: 'W', SAAR: 'W', SBGR: 'W', SBGL: 'W', MMMX: 'W', MMGL: 'W', MMUN: 'W', SCEL: 'W',
    SUMU: 'W', SEQM: 'W', SEGU: 'W', MUHA: 'W', SVMI: 'W', MPTO: 'W', MROC: 'W', MSLP: 'W', MDSD: 'W', MDPC: 'W', KMIA: 'W', KDFW: 'W', KLAX: 'W', SLVR: 'W', GVAC: 'W', TJSJ: 'W', MGGT: 'W',
    LEZL: 'SW', LEJR: 'SW', LEBZ: 'SW', GCXO: 'SW', GCTS: 'SW', GCLP: 'SW', GCRR: 'SW', GCFV: 'SW', GCLA: 'SW', LPFR: 'SW', GMMN: 'SW', GMMX: 'SW', GMAD: 'SW', GOBD: 'SW', DIAP: 'SW', DNMM: 'SW', GMFF: 'SW',
    LEMG: 'S', LEGR: 'S', GEML: 'S', GMTT: 'S', LXGB: 'S', GMME: 'S',
    LEAL: 'SE', LEMI: 'SE', LEAM: 'SE', DAAG: 'SE', DAOO: 'SE', DTTA: 'SE',
    LEVC: 'E', LEPA: 'E', LEIB: 'E', LEMH: 'E', LECH: 'E',
    LEBL: 'ENE', LEGE: 'ENE', LIRF: 'ENE', LIMC: 'ENE', LIML: 'ENE', LIPZ: 'ENE', LIRN: 'ENE', LIRQ: 'ENE', LIRP: 'ENE', LIPE: 'ENE', LICC: 'ENE', LICJ: 'ENE', LIEA: 'ENE', LIEE: 'ENE', LIPX: 'ENE',
    LIMF: 'ENE', LIBD: 'ENE', LGAV: 'ENE', LTFM: 'ENE', LTFJ: 'ENE', HECA: 'ENE', OTHH: 'ENE', OMDB: 'ENE', OMAA: 'ENE', OLBA: 'ENE', LLBG: 'ENE', LMML: 'ENE', LDDU: 'ENE', LFML: 'ENE', LFMN: 'ENE',
    ZBAA: 'ENE', ZSPD: 'ENE', RJAA: 'ENE', RKSI: 'ENE', VHHH: 'ENE', WSSS: 'ENE', VTBS: 'ENE', LROP: 'ENE', LBSF: 'ENE',
    LEZG: 'NE', LFLL: 'NE', LSGG: 'NE', LSZH: 'NE', LFSB: 'NE', EDDF: 'NE', EDDM: 'NE', EDDL: 'NE', EDDB: 'NE', EDDK: 'NE', EDDS: 'NE', LOWW: 'NE', LKPR: 'NE', EPWA: 'NE', EPKK: 'NE',
    EPKT: 'NE', LHBP: 'NE', EYKA: 'NE', LSGS: 'NE', LFSN: 'NE'
  };
  const dirFor = icao => DIR[PLACE_DIR[icao] || 'NE'];

  // ── units and frequencies (AD 2.18). Barajas Tower has one frequency per runway pair; the sim's single position
  // uses the one for the runway in question. Madrid ACC sectors are representative.
  const UNITS = {
    atis: { name: 'Barajas Information', freq: '118.255' }, del: { name: 'Madrid Clearances', freq: '130.355' },
    gnd: { name: 'Barajas Ground', freq: '121.980' },
    twr: { name: 'Barajas Tower', freq: { '18R': '118.080', '36L': '118.080', '32L': '118.155', '14R': '118.155', '18L': '118.680', '36R': '118.680', '32R': '118.980', '14L': '118.980' } },
    app: { name: 'Madrid Approach', freq: '127.505', alt: ['127.100', '118.400'] }, dep: { name: 'Madrid Departure', freq: { west: '124.230', east: '131.175' } }
  };
  const CTR = { n: ['Madrid Control', '133.950'], w: ['Madrid Control', '132.155'], s: ['Madrid Control', '135.700'], e: ['Madrid Control', '128.075'] };
  const TA = 13000, TZ = 'Europe/Madrid';
  // where cruising flights over central Spain divert to with a sick passenger (medical diversions in emerg.js)
  const ALTERNATES = [['Valencia', 'LEVC', 'VILLA'], ['Zaragoza', 'LEZG', 'BAN'], ['Seville', 'LEZL', 'SOTUK']];

  // ── traffic. A representative autumn week built from Madrid's own boards (2026-10-07), thinned to about 30 movements
  // an hour at the busiest (the real airport runs up to 100 on its four runways); the busy session ("rush hour") adds the
  // EXTRA flights. Operators and routes are the real ones; flight numbers and times are representative.
  // [operator, flight number, airport, type, arrival times (local), minutes on the ground, days]; the departure is the
  // next number. A first-wave departure night-stopped at Madrid; the last arrivals stay overnight.
  const L = (o, n, ap, t, times, turn, days = '1234567') => ({ o, n, ap, t, times, turn, days });
  const ROUTES = [
    // Iberia and Iberia Express: the hub at T-4 / T-4S
    L('IBE', 3401, 'LEBL', 'A321', ['08:10', '11:40', '15:10', '19:20'], 45), L('IBE', 3101, 'LPPT', 'A320', ['09:05', '14:35', '20:05'], 45), L('IBE', 3701, 'LFPO', 'A21N', ['10:20', '16:15'], 50),
    L('IBE', 3161, 'EGLL', 'A321', ['09:45', '13:10', '18:40'], 55), L('IBE', 3231, 'LIRF', 'A320', ['11:05', '17:30'], 50), L('IBE', 3251, 'LIMC', 'A320', ['12:15'], 45),
    L('IBE', 3311, 'EDDF', 'A321', ['10:55', '18:05'], 50), L('IBE', 3271, 'EDDM', 'A20N', ['12:40'], 50), L('IBE', 3201, 'EHAM', 'A20N', ['13:20'], 50),
    L('IBE', 3221, 'EBBR', 'A320', ['14:25'], 45), L('IBE', 3261, 'LSZH', 'A320', ['15:35'], 45), L('IBE', 3171, 'LGAV', 'A21N', ['16:50'], 55),
    L('IBE', 3501, 'GMMX', 'A320', ['13:45'], 50), L('IBE', 3611, 'LEBB', 'A320', ['08:35', '17:10'], 40), L('IBE', 3191, 'LIPZ', 'A320', ['15:05'], 45),
    L('IBE', 6251, 'KJFK', 'A359', ['08:20'], 150), L('IBE', 6011, 'MMMX', 'B789', ['14:55'], 160), L('IBE', 6845, 'SAEZ', 'A35K', ['07:10'], 170),
    L('IBE', 6589, 'SKBO', 'A359', ['13:00'], 150), L('IBE', 6651, 'SPJC', 'A333', ['06:45'], 170), L('IBE', 6123, 'KMIA', 'A333', ['15:40'], 150),
    L('IBE', 6024, 'SBGR', 'A359', ['06:35'], 170), L('IBE', 6831, 'SCEL', 'A359', ['07:25'], 170, '1357'), L('IBE', 6171, 'KBOS', 'A332', ['12:20'], 150),
    L('IBS', 3801, 'GCLP', 'A20N', ['10:40', '18:25'], 50), L('IBS', 3831, 'GCXO', 'A21N', ['09:15', '16:55'], 50), L('IBS', 3881, 'LEPA', 'A320', ['08:55', '13:35', '19:50'], 45),
    L('IBS', 3911, 'LECO', 'A320', ['09:25', '15:20', '21:05'], 40), L('IBS', 3941, 'LEVX', 'A320', ['10:05', '18:50'], 40), L('IBS', 3961, 'LEAS', 'A320', ['11:30', '19:40'], 40),
    L('IBS', 3851, 'LEMG', 'A320', ['12:05', '17:45'], 40), L('IBS', 3821, 'GCRR', 'A21N', ['14:10'], 50), L('IBS', 3871, 'LEIB', 'A320', ['13:15'], 45),
    // Air Nostrum (Iberia Regional), Vueling and Level at T-4
    L('ANE', 8301, 'LEPP', 'CRJ9', ['08:45', '16:35'], 35), L('ANE', 8321, 'LEXJ', 'CRJ9', ['09:30', '18:15'], 35), L('ANE', 8341, 'LEMH', 'CRJ9', ['12:50'], 35),
    L('ANE', 8361, 'GEML', 'AT76', ['10:15', '17:55'], 35), L('ANE', 8381, 'LESO', 'CRJ9', ['11:20', '19:05'], 35), L('ANE', 8401, 'LEAM', 'CRJ9', ['13:40'], 35),
    L('ANE', 8421, 'LFML', 'CRJ9', ['14:45'], 40), L('ANE', 8441, 'LELN', 'AT76', ['15:55'], 35), L('ANE', 8461, 'LEJR', 'CRJ9', ['16:20'], 35),
    L('VLG', 1001, 'LEBL', 'A320', ['09:55', '14:05', '20:20'], 40), L('VLG', 3101, 'LEPA', 'A320', ['12:35'], 40), L('VLG', 8701, 'LFPO', 'A320', ['17:20'], 45),
    // Air Europa (SkyTeam) at T-2 and the long-haul at T-1
    L('AEA', 1001, 'LEPA', 'B38M', ['08:25', '14:50', '20:30'], 45), L('AEA', 1031, 'LEBL', 'B738', ['10:30', '18:35'], 40), L('AEA', 1101, 'LEIB', 'B738', ['11:55'], 45),
    L('AEA', 1131, 'GCTS', 'B738', ['12:30'], 55), L('AEA', 1161, 'GCLP', 'B38M', ['13:55'], 55), L('AEA', 1231, 'LIRF', 'B38M', ['15:15'], 50),
    L('AEA', 1301, 'LFPG', 'B738', ['10:00', '16:45'], 50), L('AEA', 1401, 'LTFM', 'B38M', ['17:05'], 60), L('AEA', 1451, 'LEVX', 'E195', ['09:40', '17:40'], 40),
    L('AEA', 61, 'MUHA', 'B789', ['13:30'], 150), L('AEA', 19, 'KJFK', 'B789', ['09:20'], 150), L('AEA', 41, 'SKBO', 'B789', ['11:15'], 150), L('AEA', 75, 'SUMU', 'B789', ['07:50'], 170, '246'),
    // Ryanair at T-1
    L('RYR', 5401, 'LEPA', 'B38M', ['08:50', '15:30'], 30), L('RYR', 5411, 'EGSS', 'B738', ['10:10', '17:25'], 30), L('RYR', 5421, 'EIDW', 'B38M', ['11:45'], 30),
    L('RYR', 5431, 'LIRN', 'B738', ['12:55'], 30), L('RYR', 5441, 'LIRP', 'B38M', ['13:25'], 30), L('RYR', 5451, 'GMMX', 'B738', ['14:40'], 30),
    L('RYR', 5461, 'GCTS', 'B38M', ['16:00'], 30), L('RYR', 5471, 'LICC', 'B738', ['16:40'], 30), L('RYR', 5481, 'LIEA', 'B38M', ['18:10'], 30),
    L('RYR', 5491, 'GCRR', 'B38M', ['19:15'], 30), L('RYR', 5501, 'EGGD', 'B738', ['09:35'], 30), L('RYR', 5511, 'EPKT', 'B38M', ['15:50'], 30),
    // the oneworld partners at T-4S
    L('BAW', 456, 'EGLL', 'A320', ['10:35', '15:45', '20:55'], 55), L('AAL', 36, 'KJFK', 'B772', ['08:05'], 150), L('AAL', 69, 'KDFW', 'B789', ['10:50'], 150),
    L('AAL', 92, 'KPHL', 'B772', ['09:15'], 150), L('QTR', 149, 'OTHH', 'B77W', ['13:50'], 120), L('LAN', 704, 'SCEL', 'B789', ['12:25'], 150), L('LAN', 1446, 'SPJC', 'B789', ['13:15'], 150, '1357'),
    // other airlines at T-1 and T-2
    L('AFR', 1300, 'LFPG', 'A320', ['09:10', '13:55', '18:20'], 50), L('KLM', 1699, 'EHAM', 'B738', ['10:45', '17:15'], 50), L('DLH', 1110, 'EDDF', 'A321', ['10:25', '16:10'], 50),
    L('DLH', 1800, 'EDDM', 'A20N', ['12:10', '18:55'], 50), L('SWR', 2010, 'LSZH', 'A320', ['11:50', '17:50'], 45), L('TAP', 1012, 'LPPT', 'A20N', ['09:00', '15:25', '20:40'], 45),
    L('ITY', 62, 'LIRF', 'A20N', ['13:00', '19:30'], 45), L('THY', 1857, 'LTFM', 'A21N', ['14:20'], 65), L('AEE', 652, 'LGAV', 'A20N', ['15:40'], 55),
    L('LOT', 433, 'EPWA', 'B38M', ['13:35'], 50), L('SAS', 1578, 'EKCH', 'A20N', ['14:15'], 45), L('UAE', 141, 'OMDB', 'A388', ['14:30'], 150),
    L('ETD', 75, 'OMAA', 'B789', ['13:20'], 140), L('MSR', 753, 'HECA', 'B38M', ['14:05'], 70), L('RAM', 1050, 'GMMN', 'B738', ['11:25', '18:00'], 55),
    L('DAL', 108, 'KATL', 'A333', ['09:30'], 150), L('UAL', 54, 'KEWR', 'B763', ['08:30'], 150), L('AMX', 1, 'MMMX', 'B789', ['13:10'], 150),
    L('AVA', 10, 'SKBO', 'B788', ['12:50'], 150), L('ARG', 1132, 'SAEZ', 'A332', ['14:35'], 160), L('CCA', 907, 'ZBAA', 'A333', ['16:30'], 150, '1357'),
    L('EZY', 7461, 'LFSB', 'A320', ['11:05'], 40), L('WZZ', 2853, 'LROP', 'A21N', ['15:10'], 50), L('VOE', 2001, 'LEST', 'A320', ['10:55'], 35), L('TVF', 4840, 'LFPO', 'B738', ['16:05'], 40)
  ];
  // the first wave (night-stoppers, local off-blocks) and the last arrivals, which stay overnight
  const FIRST = [['IBE', 3399, 'LEBL', 'A321', '06:30'], ['IBS', 3879, 'LEPA', 'A320', '06:35'], ['AEA', 999, 'LEPA', 'B38M', '06:40'], ['IBE', 3099, 'LPPT', 'A320', '06:45'],
    ['VLG', 999, 'LEBL', 'A320', '06:50'], ['IBE', 3159, 'EGLL', 'A321', '06:55'], ['RYR', 5399, 'LEPA', 'B38M', '07:00'], ['IBS', 3909, 'LECO', 'A320', '07:05'],
    ['ANE', 8299, 'LEPP', 'CRJ9', '07:10'], ['AEA', 1299, 'LFPG', 'B738', '07:15'], ['IBE', 3699, 'LFPO', 'A21N', '07:20'], ['TAP', 1010, 'LPPT', 'A20N', '07:25'],
    ['IBS', 3799, 'GCLP', 'A20N', '07:30'], ['IBE', 3609, 'LEBB', 'A320', '07:35'], ['AFR', 1298, 'LFPG', 'A320', '07:40']];
  const LAST = [['IBE', 3409, 'LEBL', 'A321', '22:20'], ['IBS', 3889, 'LEPA', 'A320', '22:30'], ['AEA', 1009, 'LEPA', 'B38M', '22:40'], ['IBE', 3109, 'LPPT', 'A320', '22:50'],
    ['VLG', 1009, 'LEBL', 'A320', '23:00'], ['IBS', 3919, 'LECO', 'A320', '23:10']];
  // local times to the engine's UTC "HH:MM" (CEST, UTC+2)
  const utc = t => { const m = +t.slice(0, 2)*60 + +t.slice(3) - 120; const w = (m + 1440) % 1440; return String(Math.floor(w/60)).padStart(2, '0') + ':' + String(w % 60).padStart(2, '0'); };
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
    { cs: 'IBE3455', t: 'A21N', k: 'ARR', o: 'LEBL' }, { cs: 'IBS3884', t: 'A320', k: 'DEP', d: 'LEPA' }, { cs: 'AEA1071', t: 'B738', k: 'ARR', o: 'LEMG' },
    { cs: 'RYR5528', t: 'B38M', k: 'DEP', d: 'LIRF' }, { cs: 'IBE3313', t: 'A321', k: 'ARR', o: 'EDDF' }, { cs: 'VLG1022', t: 'A320', k: 'DEP', d: 'LEBL' },
    { cs: 'ANE8365', t: 'AT76', k: 'ARR', o: 'GEML' }, { cs: 'IBE3172', t: 'A21N', k: 'DEP', d: 'LGAV' }, { cs: 'AFR1302', t: 'A320', k: 'ARR', o: 'LFPG' },
    { cs: 'IBS3832', t: 'A21N', k: 'DEP', d: 'GCXO' }, { cs: 'TAP1018', t: 'A20N', k: 'ARR', o: 'LPPT' }, { cs: 'AEA1302', t: 'B738', k: 'DEP', d: 'LFPG' },
    { cs: 'RYR5463', t: 'B38M', k: 'ARR', o: 'GCTS' }, { cs: 'IBE3612', t: 'A320', k: 'DEP', d: 'LEBB' }, { cs: 'KLM1701', t: 'B738', k: 'ARR', o: 'EHAM' },
    { cs: 'IBE3234', t: 'A320', k: 'DEP', d: 'LIRF' }, { cs: 'AEA1453', t: 'E195', k: 'ARR', o: 'LEVX' }, { cs: 'DLH1113', t: 'A321', k: 'DEP', d: 'EDDF' }
  ];
  // the Academy endorsement: north flow (32L/32R in, 36L/36R out) in the usual light westerly
  const EXERCISES = {
    dep: { name: 'Madrid 1 · Off 36L from Terminal 4', wx: 'north', rwy: '32L', sched: [{ cs: 'IBE3402', t: 'A321', k: 'DEP', d: 'LEBL', m: 0, stand: '332' }] },
    arr: { name: 'Madrid 2 · Parallel ILS approaches to 32L and 32R', wx: 'north', rwy: '32L', sched: [{ cs: 'IBE3162', t: 'A321', k: 'ARR', o: 'EGLL', m: 0 }, { cs: 'AEA1012', t: 'B738', k: 'ARR', o: 'LEPA', m: 1 }] },
    mix: { name: 'Madrid 3 · Four runways at once', wx: 'north', rwy: '32L', sched: [{ cs: 'IBS3832', t: 'A21N', k: 'ARR', o: 'GCXO', m: 0 }, { cs: 'VLG1002', t: 'A320', k: 'ARR', o: 'LEBL', m: 1 },
      { cs: 'IBE3612', t: 'A320', k: 'DEP', d: 'LEBB', m: 0, stand: '512' }, { cs: 'RYR5412', t: 'B738', k: 'DEP', d: 'EGSS', m: 0, stand: '20' }] }
  };
  const WX_PRESETS = {
    north: { name: 'Light westerly: north flow, land 32L/32R, depart 36L/36R', short: 'North flow', metar: 'LEMD 071200Z 29008KT 9999 FEW040 21/08 Q1018' },
    south: { name: 'Southerly: south flow, land 18L/18R, depart 14L/14R',     short: 'South flow', metar: 'LEMD 071200Z 19012KT 9999 SCT035 23/11 Q1012' },
    calm:  { name: 'High pressure, calm and hazy: north flow',               short: 'Calm',       metar: 'LEMD 071200Z VRB02KT 8000 HZ NSC 26/06 Q1026' },
    low:   { name: 'Winter low cloud: ILS near the minima',                  short: 'Low cloud',  metar: 'LEMD 071200Z 33006KT 1800 BR OVC003 06/05 Q1021' },
    fog:   { name: 'Radiation fog on the Meseta: below the ILS minima',      short: 'Fog',        metar: 'LEMD 070600Z 00000KT 0200 R32L/0250N FG VV001 02/02 Q1027' },
    storm: { name: 'Summer thunderstorm: gusty, showers',                    short: 'Storm',      metar: 'LEMD 071600Z 22018G34KT 5000 TSRA BKN030CB 24/16 Q1010' }
  };

  // airline radio telephony and codes at Madrid (merged into the engine's tables)
  const TEL = { IBE: 'Iberia', IBS: 'Iberexpres', ANE: 'Air Nostrum', VLG: 'Vueling', AEA: 'Europa', RYR: 'Ryanair', BAW: 'Speedbird', AAL: 'American',
    QTR: 'Qatari', LAN: 'LAN Chile', AFR: 'Airfrans', KLM: 'KLM', DLH: 'Lufthansa', SWR: 'Swiss', TAP: 'Air Portugal', ITY: 'Itarrow', THY: 'Turkish',
    AEE: 'Aegean', LOT: 'Lot', SAS: 'Scandinavian', UAE: 'Emirates', ETD: 'Etihad', MSR: 'Egyptair', RAM: 'Royalair Maroc', DAL: 'Delta', UAL: 'United',
    AMX: 'Aeromexico', AVA: 'Avianca', ARG: 'Argentina', CCA: 'Air China', EZY: 'Easy', WZZ: 'Wizz Air', VOE: 'Volotea', TVF: 'France Soleil',
    EVE: 'Evelop', WFL: 'World Flight', PLM: 'Pullmantur', SWT: 'Swift', AZU: 'Azul', TAR: 'Tunair', MAC: 'Arabia Maroc', EWG: 'Eurowings', LVL: 'Level' };
  const AIRLINE_ICAO = { IB: 'IBE', I2: 'IBS', YW: 'ANE', VY: 'VLG', UX: 'AEA', FR: 'RYR', BA: 'BAW', AA: 'AAL', QR: 'QTR', LA: 'LAN', AF: 'AFR', KL: 'KLM',
    LH: 'DLH', LX: 'SWR', TP: 'TAP', AZ: 'ITY', TK: 'THY', A3: 'AEE', LO: 'LOT', SK: 'SAS', EK: 'UAE', EY: 'ETD', MS: 'MSR', AT: 'RAM', DL: 'DAL', UA: 'UAL',
    AM: 'AMX', AV: 'AVA', AR: 'ARG', CA: 'CCA', U2: 'EZY', W6: 'WZZ', V7: 'VOE', TO: 'TVF', E9: 'EVE', '2W': 'WFL', EB: 'PLM', WT: 'SWT', AD: 'AZU', TU: 'TAR',
    '3O': 'MAC', EW: 'EWG', '0V': 'LVL' };
  const AIRLINE_TYPE = { IBE: 'A320', IBS: 'A320', ANE: 'CRJ9', VLG: 'A320', AEA: 'B738', RYR: 'B38M', BAW: 'A320', AAL: 'B772', QTR: 'B77W', LAN: 'B789',
    AFR: 'A320', KLM: 'B738', DLH: 'A321', SWR: 'A320', TAP: 'A20N', ITY: 'A20N', THY: 'A21N', AEE: 'A20N', LOT: 'B38M', SAS: 'A20N', UAE: 'A388', ETD: 'B789',
    MSR: 'B38M', RAM: 'B738', DAL: 'A333', UAL: 'B763', AMX: 'B789', AVA: 'B788', ARG: 'A332', CCA: 'A333', EZY: 'A320', WZZ: 'A21N', VOE: 'A320', TVF: 'B738',
    EVE: 'A332', WFL: 'A333', PLM: 'A332', SWT: 'B738', AZU: 'A332', TAR: 'A320', MAC: 'A320', EWG: 'A20N', LVL: 'A332' };
  // the terminal each airline uses: 4 (T-4), 4S (T-4 satellite, oneworld long-haul and non-Schengen), 123 (T-1, T-2, T-3)
  const TERMINAL_OF = { IBE: '4', IBS: '4', ANE: '4', VLG: '4', LVL: '4S', BAW: '4S', AAL: '4S', QTR: '4S', LAN: '4S', CCA: '123' };
  const TYPES = {
    A321: { name: 'A321',          wake: 'M', vapp: 140, vr: 150, climb: 2200, desc: 2000, cruise: 290, span: 34.1, len: 44.5, shape: 'jet' },
    A333: { name: 'A330-300',      wake: 'H', vapp: 140, vr: 152, climb: 1900, desc: 2000, cruise: 300, span: 60.3, len: 63.7, shape: 'jet' },
    A359: { name: 'A350-900',      wake: 'H', vapp: 140, vr: 150, climb: 2100, desc: 2000, cruise: 300, span: 64.8, len: 66.8, shape: 'jet' },
    A35K: { name: 'A350-1000',     wake: 'H', vapp: 145, vr: 155, climb: 2000, desc: 2000, cruise: 300, span: 64.8, len: 73.8, shape: 'jet' },
    A388: { name: 'A380',          wake: 'H', vapp: 140, vr: 155, climb: 1600, desc: 1800, cruise: 300, span: 79.8, len: 72.7, shape: 'jet' },
    B38M: { name: '737 MAX 8',     wake: 'M', vapp: 145, vr: 150, climb: 2400, desc: 2100, cruise: 290, span: 35.9, len: 39.5, shape: 'jet' },
    B763: { name: '767-300',       wake: 'H', vapp: 140, vr: 150, climb: 2200, desc: 2000, cruise: 300, span: 47.6, len: 54.9, shape: 'jet' },
    B772: { name: '777-200',       wake: 'H', vapp: 140, vr: 155, climb: 1900, desc: 2000, cruise: 300, span: 60.9, len: 63.7, shape: 'jet' },
    B77W: { name: '777-300ER',     wake: 'H', vapp: 149, vr: 160, climb: 1800, desc: 2000, cruise: 300, span: 64.8, len: 73.9, shape: 'jet' },
    B788: { name: '787-8',         wake: 'H', vapp: 140, vr: 150, climb: 2200, desc: 2000, cruise: 300, span: 60.1, len: 56.7, shape: 'jet' },
    B789: { name: '787-9',         wake: 'H', vapp: 145, vr: 155, climb: 2100, desc: 2000, cruise: 300, span: 60.1, len: 62.8, shape: 'jet' },
    CRJ9: { name: 'CRJ1000',       wake: 'M', vapp: 135, vr: 140, climb: 2500, desc: 2000, cruise: 280, span: 26.2, len: 39.1, shape: 'jet' },
    E195: { name: 'Embraer 195',   wake: 'M', vapp: 130, vr: 138, climb: 2400, desc: 2000, cruise: 280, span: 28.7, len: 38.7, shape: 'jet' }
  };
  // Madrid's flight boards give places by city name
  const PLACES = {
    'barcelona': 'LEBL', 'palma de mallorca': 'LEPA', 'palma': 'LEPA', 'ibiza': 'LEIB', 'menorca': 'LEMH', 'valencia': 'LEVC', 'alicante': 'LEAL', 'murcia': 'LEMI',
    'almeria': 'LEAM', 'malaga': 'LEMG', 'granada': 'LEGR', 'sevilla': 'LEZL', 'seville': 'LEZL', 'jerez': 'LEJR', 'bilbao': 'LEBB', 'san sebastian': 'LESO',
    'santander': 'LEXJ', 'pamplona': 'LEPP', 'vigo': 'LEVX', 'a coruna': 'LECO', 'santiago de compostela': 'LEST', 'asturias': 'LEAS', 'leon': 'LELN', 'melilla': 'GEML',
    'tenerife': 'GCXO', 'tenerife north': 'GCXO', 'tenerife south': 'GCTS', 'gran canaria': 'GCLP', 'lanzarote': 'GCRR', 'fuerteventura': 'GCFV', 'santa cruz de la palma': 'GCLA',
    'lisbon': 'LPPT', 'porto': 'LPPR', 'funchal': 'LPMA', 'faro': 'LPFR', 'ponta delgada': 'LPPD', 'paris': 'LFPG', 'marseille': 'LFML', 'toulouse': 'LFBO', 'lyon': 'LFLL',
    'nice': 'LFMN', 'bordeaux': 'LFBD', 'strasbourg': 'LFST', 'basel/mulhouse': 'LFSB', 'london': 'EGLL', 'bristol': 'EGGD', 'manchester': 'EGCC', 'dublin': 'EIDW',
    'shannon': 'EINN', 'amsterdam': 'EHAM', 'brussels': 'EBBR', 'luxembourg': 'ELLX', 'frankfurt': 'EDDF', 'munich': 'EDDM', 'duesseldorf': 'EDDL', 'dusseldorf': 'EDDL',
    'berlin': 'EDDB', 'hamburg': 'EDDH', 'cologne': 'EDDK', 'stuttgart': 'EDDS', 'zurich': 'LSZH', 'geneva': 'LSGG', 'sion': 'LSGS', 'vienna': 'LOWW', 'prague': 'LKPR',
    'warsaw': 'EPWA', 'krakow/balice': 'EPKK', 'krakow': 'EPKK', 'katowice': 'EPKT', 'budapest': 'LHBP', 'bucharest': 'LROP', 'kaunas': 'EYKA', 'copenhagen': 'EKCH',
    'oslo': 'ENGM', 'stockholm': 'ESSA', 'helsinki': 'EFHK', 'rome': 'LIRF', 'milan': 'LIMC', 'venice': 'LIPZ', 'naples': 'LIRN', 'florence': 'LIRQ', 'pisa': 'LIRP',
    'bologna': 'LIPE', 'catania': 'LICC', 'palermo': 'LICJ', 'alghero': 'LIEA', 'cagliari': 'LIEE', 'verona': 'LIPX', 'turin': 'LIMF', 'bari': 'LIBD', 'dubrovnik': 'LDDU',
    'athens': 'LGAV', 'istanbul': 'LTFM', 'malta': 'LMML', 'tel aviv': 'LLBG', 'beirut': 'OLBA', 'cairo': 'HECA', 'doha': 'OTHH', 'dubai': 'OMDB', 'abu dhabi': 'OMAA',
    'beijing': 'ZBAA', 'shanghai': 'ZSPD', 'tokyo': 'RJAA', 'seoul': 'RKSI', 'casablanca': 'GMMN', 'marrakech': 'GMMX', 'agadir': 'GMAD', 'tangier': 'GMTT', 'fes': 'GMFF',
    'algiers': 'DAAG', 'oran': 'DAOO', 'tunis': 'DTTA', 'dakar': 'GOBD', 'abidjan': 'DIAP', 'lagos': 'DNMM', 'sal island': 'GVAC', 'new york': 'KJFK', 'newark': 'KEWR',
    'boston': 'KBOS', 'philadelphia': 'KPHL', 'chicago': 'KORD', 'washington': 'KIAD', 'atlanta': 'KATL', 'miami': 'KMIA', 'fort worth': 'KDFW', 'dallas': 'KDFW',
    'los angeles': 'KLAX', 'toronto': 'CYYZ', 'montreal': 'CYUL', 'mexico city': 'MMMX', 'guadalajara': 'MMGL', 'cancun': 'MMUN', 'havana': 'MUHA', 'santo domingo': 'MDSD',
    'punta cana': 'MDPC', 'san juan': 'TJSJ', 'bogota': 'SKBO', 'medellin': 'SKRG', 'cali': 'SKCL', 'lima': 'SPJC', 'quito': 'SEQM', 'guayaquil': 'SEGU', 'caracas': 'SVMI',
    'panama city': 'MPTO', 'san jose': 'MROC', 'san salvador': 'MSLP', 'guatemala city': 'MGGT', 'santa cruz': 'SLVR', 'buenos aires': 'SAEZ', 'rosario': 'SAAR',
    'montevideo': 'SUMU', 'santiago': 'SCEL', 'sao paulo': 'SBGR', 'rio de janeiro': 'SBGL', 'zaragoza': 'LEZG'
  };
  const AIRPORTS = {
    LEMD: [40.4722, -3.5608, 'Madrid'], LEBL: [41.2971, 2.0785, 'Barcelona'], LEPA: [39.5517, 2.7388, 'Palma'], LEIB: [38.8729, 1.3731, 'Ibiza'], LEMH: [39.8626, 4.2186, 'Menorca'],
    LEVC: [39.4893, -0.4816, 'Valencia'], LEAL: [38.2822, -0.5582, 'Alicante'], LEMI: [37.8030, -1.1250, 'Murcia'], LEAM: [36.8439, -2.3701, 'Almería'], LEMG: [36.6749, -4.4991, 'Málaga'],
    LEGR: [37.1887, -3.7774, 'Granada'], LEZL: [37.4180, -5.8931, 'Seville'], LEJR: [36.7446, -6.0601, 'Jerez'], LEBB: [43.3011, -2.9106, 'Bilbao'], LESO: [43.3565, -1.7906, 'San Sebastián'],
    LEXJ: [43.4271, -3.8200, 'Santander'], LEPP: [42.7700, -1.6463, 'Pamplona'], LEVX: [42.2318, -8.6268, 'Vigo'], LECO: [43.3021, -8.3773, 'A Coruña'], LEST: [42.8963, -8.4151, 'Santiago'],
    LEAS: [43.5636, -6.0346, 'Asturias'], LELN: [42.5890, -5.6556, 'León'], GEML: [35.2798, -2.9563, 'Melilla'], LEZG: [41.6662, -1.0415, 'Zaragoza'],
    GCXO: [28.4827, -16.3415, 'Tenerife North'], GCTS: [28.0445, -16.5725, 'Tenerife South'], GCLP: [27.9319, -15.3866, 'Gran Canaria'], GCRR: [28.9455, -13.6052, 'Lanzarote'],
    GCFV: [28.4527, -13.8638, 'Fuerteventura'], GCLA: [28.6265, -17.7556, 'La Palma'], LPPT: [38.7742, -9.1342, 'Lisbon'], LPPR: [41.2481, -8.6814, 'Porto'], LPMA: [32.6979, -16.7745, 'Madeira'],
    LPFR: [37.0144, -7.9659, 'Faro'], LPPD: [37.7412, -25.6979, 'Ponta Delgada'], LFPG: [49.0097, 2.5479, 'Paris CDG'], LFPO: [48.7233, 2.3794, 'Paris Orly'], LFML: [43.4393, 5.2214, 'Marseille'],
    LFBO: [43.6291, 1.3638, 'Toulouse'], LFLL: [45.7256, 5.0811, 'Lyon'], LFMN: [43.6584, 7.2159, 'Nice'], LFBD: [44.8283, -0.7156, 'Bordeaux'], LFST: [48.5383, 7.6282, 'Strasbourg'],
    LFSB: [47.5896, 7.5299, 'Basel'], EGLL: [51.4700, -0.4543, 'London Heathrow'], EGKK: [51.1481, -0.1903, 'London Gatwick'], EGSS: [51.8850, 0.2350, 'London Stansted'],
    EGGD: [51.3827, -2.7191, 'Bristol'], EGCC: [53.3537, -2.2750, 'Manchester'], EIDW: [53.4213, -6.2701, 'Dublin'], EINN: [52.7020, -8.9248, 'Shannon'], EHAM: [52.3086, 4.7639, 'Amsterdam'],
    EBBR: [50.9014, 4.4844, 'Brussels'], ELLX: [49.6233, 6.2044, 'Luxembourg'], EDDF: [50.0333, 8.5706, 'Frankfurt'], EDDM: [48.3538, 11.7861, 'Munich'], EDDL: [51.2895, 6.7668, 'Düsseldorf'],
    EDDB: [52.3667, 13.5033, 'Berlin'], EDDH: [53.6304, 9.9882, 'Hamburg'], EDDK: [50.8659, 7.1427, 'Cologne'], EDDS: [48.6899, 9.2220, 'Stuttgart'], LSZH: [47.4647, 8.5492, 'Zurich'],
    LSGG: [46.2381, 6.1090, 'Geneva'], LSGS: [46.2196, 7.3268, 'Sion'], LOWW: [48.1103, 16.5697, 'Vienna'], LKPR: [50.1008, 14.2600, 'Prague'], EPWA: [52.1657, 20.9671, 'Warsaw'],
    EPKK: [50.0777, 19.7848, 'Kraków'], EPKT: [50.4743, 19.0800, 'Katowice'], LHBP: [47.4298, 19.2611, 'Budapest'], LROP: [44.5711, 26.0850, 'Bucharest'], EYKA: [54.9639, 24.0848, 'Kaunas'],
    EKCH: [55.6181, 12.6561, 'Copenhagen'], ENGM: [60.1939, 11.1004, 'Oslo'], ESSA: [59.6519, 17.9186, 'Stockholm'], EFHK: [60.3172, 24.9633, 'Helsinki'], LIRF: [41.8003, 12.2389, 'Rome'],
    LIMC: [45.6306, 8.7281, 'Milan Malpensa'], LIML: [45.4451, 9.2767, 'Milan Linate'], LIPZ: [45.5053, 12.3519, 'Venice'], LIRN: [40.8860, 14.2908, 'Naples'], LIRQ: [43.8100, 11.2051, 'Florence'],
    LIRP: [43.6839, 10.3927, 'Pisa'], LIPE: [44.5354, 11.2887, 'Bologna'], LICC: [37.4668, 15.0664, 'Catania'], LICJ: [38.1760, 13.0910, 'Palermo'], LIEA: [40.6321, 8.2908, 'Alghero'],
    LIEE: [39.2515, 9.0543, 'Cagliari'], LIPX: [45.3957, 10.8885, 'Verona'], LIMF: [45.2008, 7.6496, 'Turin'], LIBD: [41.1389, 16.7606, 'Bari'], LDDU: [42.5614, 18.2682, 'Dubrovnik'],
    LGAV: [37.9364, 23.9445, 'Athens'], LTFM: [41.2753, 28.7519, 'Istanbul'], LMML: [35.8575, 14.4775, 'Malta'], LLBG: [32.0114, 34.8867, 'Tel Aviv'], OLBA: [33.8209, 35.4884, 'Beirut'],
    HECA: [30.1219, 31.4056, 'Cairo'], OTHH: [25.2731, 51.6081, 'Doha'], OMDB: [25.2532, 55.3657, 'Dubai'], OMAA: [24.4330, 54.6511, 'Abu Dhabi'], ZBAA: [40.0801, 116.5846, 'Beijing'],
    ZSPD: [31.1443, 121.8083, 'Shanghai'], RJAA: [35.7720, 140.3929, 'Tokyo Narita'], RKSI: [37.4602, 126.4407, 'Seoul'], GMMN: [33.3675, -7.5900, 'Casablanca'], GMMX: [31.6069, -8.0363, 'Marrakech'],
    GMAD: [30.3250, -9.4131, 'Agadir'], GMTT: [35.7269, -5.9169, 'Tangier'], GMFF: [33.9273, -4.9779, 'Fes'], DAAG: [36.6910, 3.2154, 'Algiers'], DAOO: [35.6239, -0.6212, 'Oran'],
    DTTA: [36.8510, 10.2272, 'Tunis'], GOBD: [14.6700, -17.0733, 'Dakar'], DIAP: [5.2614, -3.9263, 'Abidjan'], DNMM: [6.5774, 3.3212, 'Lagos'], GVAC: [16.7414, -22.9494, 'Sal'],
    KJFK: [40.6399, -73.7789, 'New York JFK'], KEWR: [40.6925, -74.1687, 'Newark'], KBOS: [42.3656, -71.0096, 'Boston'], KPHL: [39.8729, -75.2437, 'Philadelphia'], KORD: [41.9742, -87.9073, 'Chicago'],
    KIAD: [38.9531, -77.4565, 'Washington Dulles'], KATL: [33.6407, -84.4277, 'Atlanta'], KMIA: [25.7959, -80.2870, 'Miami'], KDFW: [32.8998, -97.0403, 'Dallas Fort Worth'],
    KLAX: [33.9416, -118.4085, 'Los Angeles'], CYYZ: [43.6777, -79.6248, 'Toronto'], CYUL: [45.4706, -73.7408, 'Montreal'], MMMX: [19.4361, -99.0719, 'Mexico City'],
    MMGL: [20.5218, -103.3112, 'Guadalajara'], MMUN: [21.0365, -86.8771, 'Cancún'], MUHA: [22.9892, -82.4091, 'Havana'], MDSD: [18.4297, -69.6689, 'Santo Domingo'],
    MDPC: [18.5674, -68.3634, 'Punta Cana'], TJSJ: [18.4394, -66.0018, 'San Juan'], SKBO: [4.7016, -74.1469, 'Bogotá'], SKRG: [6.1645, -75.4231, 'Medellín'], SKCL: [3.5432, -76.3816, 'Cali'],
    SPJC: [-12.0219, -77.1143, 'Lima'], SEQM: [-0.1292, -78.3575, 'Quito'], SEGU: [-2.1574, -79.8836, 'Guayaquil'], SVMI: [10.6031, -66.9906, 'Caracas'], MPTO: [9.0714, -79.3835, 'Panama City'],
    MROC: [9.9939, -84.2088, 'San José'], MSLP: [13.4409, -89.0557, 'San Salvador'], MGGT: [14.5833, -90.5275, 'Guatemala City'], SLVR: [-17.6448, -63.1354, 'Santa Cruz'],
    SAEZ: [-34.8222, -58.5358, 'Buenos Aires'], SAAR: [-32.9036, -60.7850, 'Rosario'], SUMU: [-34.8384, -56.0308, 'Montevideo'], SCEL: [-33.3930, -70.7858, 'Santiago'],
    SBGR: [-23.4356, -46.4731, 'São Paulo'], SBGL: [-22.8100, -43.2506, 'Rio de Janeiro'], LXGB: [36.1512, -5.3497, 'Gibraltar'], GMME: [34.0515, -6.7515, 'Rabat'], LECH: [40.2139, 0.0733, 'Castellón'],
    LFRS: [47.1532, -1.6107, 'Nantes'], LFSN: [48.6923, 6.2302, 'Nancy']
  };

  return {
    icao: 'LEMD', iata: 'MAD', name: 'Madrid-Barajas', city: 'Madrid', country: 'Spain', arp: P('402820N', '0033339W'), elev: 1998,
    FIX, NAV, RWY, CONFIGS, STARS, HOLDS_AIR, ILS, SIDS, DIR, PLACE_DIR, dirFor, UNITS, CTR, TA, TZ, ALTERNATES,
    TIMETABLE, LONG_STAY, EXTRA, EXERCISES, WX_PRESETS, TEL, AIRLINE_ICAO, AIRLINE_TYPE, TERMINAL_OF, TYPES, PLACES, AIRPORTS,
    data: { metar: 'lemd/metar.txt', flights: 'lemd/flights.json' },
    features: { roadCrossing: false, sra: false, ils: true, rnavSids: true, singleRunway: false, parallelRunways: true }
  };
})();
if (typeof module !== 'undefined') module.exports = LEMD;
