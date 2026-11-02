// ═════════════════════════ Belfast (EGAA Aldergrove + EGAC City) airport profile ═════════════════════════
// One Clearway session for both Belfast airports, worked by one Belfast Approach (the airports are 14 NM apart and their
// approaches overlap): Aldergrove (Belfast International, 268 ft, runways 07/25 and 17/35) and Belfast City (15 ft,
// runway 04/22). Sources: UK AIP AD 2 EGAA and EGAC charts in the project's chart folder (aerodrome charts, parking,
// ATC surveillance minimum altitude charts, ILS/LOC/VOR/DME/NDB/RNP approaches and the EGAA RNP 07 coding table).
// Positions are lat/lon (WGS84); bearings are TRUE unless named "mag" (variation 1.2°W at Aldergrove, 1.0°W at City:
// 1.1°W used for the area, magnetic = true + 1.1).
//
// NO SIDs OR STARs ARE PUBLISHED for either airport. The routing below is Clearway's own standard routing, built on what
// the charts do give: the initial approach fixes (BEL VOR, HB NDB, SULEV, VAGMO, LIRGU), the final-approach tracks, the
// "direct arrival" sectors on the approach plates and the holds. The four gateway fixes are DERIVED points (a radial and
// distance from BEL VOR), named B<radial>D<nm>, so none is mistaken for a real AIP fix. Not for real-world navigation.
// Plain data plus a few small functions, like eggd.js.

const EGAA = (() => {
  const VAR = 1.1;                                          // degrees west, mean of the two airports
  const ll = (s) => {                                       // '543940N' / '0061348W' / '543908.12N' → decimal degrees
    const m = s.match(/^(\d{2,3})(\d{2})(\d{2}(?:\.\d+)?)([NSEW])$/);
    const v = +m[1] + m[2]/60 + m[3]/3600; return /[SW]/.test(m[4]) ? -v : v;
  };
  const P = (lat, lon) => [ll(lat), ll(lon)];
  // a point from [lat, lon] at a magnetic bearing and distance in NM (spherical earth, enough at this scale)
  const R_NM = 3440.065, rad = d => d*Math.PI/180, deg = r => r*180/Math.PI;
  const from = (p, magBrg, nm) => {
    const b = rad(magBrg - VAR), d = nm/R_NM, la1 = rad(p[0]), lo1 = rad(p[1]);
    const la2 = Math.asin(Math.sin(la1)*Math.cos(d) + Math.cos(la1)*Math.sin(d)*Math.cos(b));
    const lo2 = lo1 + Math.atan2(Math.sin(b)*Math.sin(d)*Math.cos(la1), Math.cos(d) - Math.sin(la1)*Math.sin(la2));
    return [deg(la2), deg(lo2)];
  };

  // ── the beacons (approach plates): BEL VOR/DME is Aldergrove's, HB NDB(L) is City's
  const NAV = {
    BEL: { name: 'Belfast VOR/DME', freq: '117.20', p: P('543940N', '0061348W') },
    HB:  { name: 'HB NDB(L)',       freq: '420',    p: P('543736N', '0055144W') }
  };

  // ── fixes: the RNP 07 coding table (500886) and the approach plates; B-points are derived gateways
  const FIX = {
    SULEV: P('543924.44N', '0063326.04W'), VAGMO: P('543245.91N', '0063732.93W'), LIRGU: P('543022.23N', '0062607.97W'),
    AA07I: P('543453.39N', '0062946.60W'), AA07F: P('543609.64N', '0062506.42W'),   // RNP 07 IF 10.1 NM and FAF 7.1 NM
    // the four gateways, where the simulator picks an arrival up (after Scottish or London Control) and hands a departure on
    B050D40: from(P('543940N', '0061348W'), 50, 40),      // north-east: Scotland, the Hebrides
    B120D40: from(P('543940N', '0061348W'), 120, 40),     // south-east: England, the near continent
    B190D40: from(P('543940N', '0061348W'), 190, 40),     // south: Dublin, Ireland, Iberia, the Canaries
    B300D40: from(P('543940N', '0061348W'), 300, 40)      // west: the Atlantic, North America
  };

  // ── runways. EGAA: 07/25 2,780 × 46 m and 17/35 1,891 × 46 m (chart 525678 gives the 07 and 35 ends; 25 and 17 are derived from
  // the length); EGAC: 04/22 1,829 × 46 m, chart threshold 04 543643.34N 0055247.14W, 22 end derived from the length.
  // Magnetic headings from the plates: 07 066°, 25 246°, 17 163°, 35 343°, 04 036°, 22 216°.
  const RWYS = {
    EGAA: [
      { id: '07/25', lo: '07', hi: '25', magHdg: { '07': 66, '25': 246 }, thr: { '07': P('543908.12N', '0061406.87W') }, len: 2780, width: 46, elev: { '07': 206, '25': 268 } },
      { id: '17/35', lo: '17', hi: '35', magHdg: { '17': 163, '35': 343 }, thr: { '35': P('543833.19N', '0061311.96W') }, len: 1891, width: 46, elev: { '17': 206, '35': 258 } }
    ],
    EGAC: [
      { id: '04/22', lo: '04', hi: '22', magHdg: { '04': 36, '22': 216 }, thr: { '04': P('543643.34N', '0055247.14W') }, len: 1829, width: 46, elev: { '04': 13, '22': 12 } }
    ]
  };
  // 07/25's other threshold from the 07 one, along 066° mag
  RWYS.EGAA[0].thr['25'] = from(RWYS.EGAA[0].thr['07'], 66, 2780/1852);
  RWYS.EGAA[1].thr['17'] = from(RWYS.EGAA[1].thr['35'], 343, 1891/1852);      // 17's end, from the 35 end up the runway
  RWYS.EGAC[0].thr['22'] = from(RWYS.EGAC[0].thr['04'], 36, 1829/1852);

  // ── holds (plates): BEL, the 050° hold at 3,000 ft or above (turn direction not on the plates: right-hand assumed);
  // HB, City's hold at 3,000 ft (inbound track not on the plates: 036° mag, the final approach course, assumed, right)
  const HOLDS_AIR = {
    BEL: { inb: 50 + VAR, turn: 'R', min: 3000, max: 10000, maxKt: 220 },
    HB:  { inb: 36 + VAR, turn: 'R', min: 3000, max: 10000, maxKt: 220 }
  };

  // ── approaches. ILS/DME 25 (500868) I-AG, ILS/DME/VOR 17 (500856) I-FT, ILS/DME/NDB(L) 04 (500829) I-HBD and 22 (500839)
  // I-BFH, all 3° glidepaths; 07 (RNP 500850, coding 500886, VOR/DME 500853) and 35 (VOR/DME 500883, SRA 500880) have no ILS.
  // ifx/faf are the intermediate and final approach fixes; IAF entries are the plates' (BEL, HB, or the RNP IAFs).
  // Alt = level constraint at the fix (feet).
  const ILS = {
    '25': { apt: 'EGAA', loc: 'I-AG',  freq: '109.90', iaf: ['BEL'], ifAlt: 4000, fafAlt: 2500, missed: ['BEL', 3000], turn: 1,  dmeOffsetNM: 1.1 },
    '17': { apt: 'EGAA', loc: 'I-FT',  freq: '110.90', iaf: ['BEL'], ifAlt: 4000, fafAlt: 2500, missed: ['BEL', 3000], turn: 1 },
    '04': { apt: 'EGAC', loc: 'I-HBD', freq: '108.10', iaf: ['HB'],  ifAlt: 3000, fafAlt: 3000, missed: ['HB', 3000],  turn: 1 },
    '22': { apt: 'EGAC', loc: 'I-BFH', freq: '108.10', iaf: ['HB'],  ifAlt: 2800, fafAlt: 2800, missed: ['HB', 3000],  turn: -1 }
  };
  // the RNP 07 approach: three IAFs at 4,000 ft, IF AA07I (2,500 ft, 10.1 NM), FAF AA07F (2,500 ft, 7.1 NM), 3° to RW07, 210 kt
  const RNP07 = { iaf: ['SULEV', 'VAGMO', 'LIRGU'], ifx: 'AA07I', faf: 'AA07F', ifAlt: 2500, fafAlt: 2500, maxKt: 210, missed: ['BEL', 3000] };

  // ── STARs (Clearway standard routing): from each gateway to the initial approach fix of the runway in use. Every one
  // gives up its height in two steps and ends at the fix the plate names, so the controller takes over from there.
  // Westerly (25 and 22) arrivals from the north-east, south-east and south end at BEL or HB; the west gateway comes in
  // over the Antrim hills. Easterly (07 and 04) arrivals use the RNP 07 IAFs (Aldergrove) and HB (City).
  const STARS = {
    'B050 25': { apt: 'EGAA', rwy: '25', from: 'NE', pts: [['B050D40', 8000], ['BEL', 4000]] },
    'B120 25': { apt: 'EGAA', rwy: '25', from: 'SE', pts: [['B120D40', 8000], ['BEL', 4000]] },
    'B190 25': { apt: 'EGAA', rwy: '25', from: 'S',  pts: [['B190D40', 8000], ['BEL', 4000]] },
    'B300 25': { apt: 'EGAA', rwy: '25', from: 'W',  pts: [['B300D40', 8000], ['BEL', 4000]] },
    'B050 07': { apt: 'EGAA', rwy: '07', from: 'NE', pts: [['B050D40', 8000], ['SULEV', 4000]] },
    'B120 07': { apt: 'EGAA', rwy: '07', from: 'SE', pts: [['B120D40', 8000], ['LIRGU', 4000]] },
    'B190 07': { apt: 'EGAA', rwy: '07', from: 'S',  pts: [['B190D40', 8000], ['LIRGU', 4000]] },
    'B300 07': { apt: 'EGAA', rwy: '07', from: 'W',  pts: [['B300D40', 8000], ['VAGMO', 4000]] },
    'B050 22': { apt: 'EGAC', rwy: '22', from: 'NE', pts: [['B050D40', 8000], ['HB', 3000]] },
    'B120 22': { apt: 'EGAC', rwy: '22', from: 'SE', pts: [['B120D40', 8000], ['HB', 3000]] },
    'B190 22': { apt: 'EGAC', rwy: '22', from: 'S',  pts: [['B190D40', 8000], ['HB', 3000]] },
    'B300 22': { apt: 'EGAC', rwy: '22', from: 'W',  pts: [['B300D40', 8000], ['HB', 3000]] },
    'B050 04': { apt: 'EGAC', rwy: '04', from: 'NE', pts: [['B050D40', 8000], ['HB', 3000]] },
    'B120 04': { apt: 'EGAC', rwy: '04', from: 'SE', pts: [['B120D40', 8000], ['HB', 3000]] },
    'B190 04': { apt: 'EGAC', rwy: '04', from: 'S',  pts: [['B190D40', 8000], ['HB', 3000]] },
    'B300 04': { apt: 'EGAC', rwy: '04', from: 'W',  pts: [['B300D40', 8000], ['HB', 3000]] }
  };

  // ── SIDs (Clearway standard routing): straight ahead to 3,000 ft, then the turn towards the gateway, climbing to 6,000 ft
  // (Belfast Approach hands on to Scottish Control, which is why every SID stops there). T<rwy> are the turn points.
  // Aldergrove 25 and 07 climb along the runway; 17 and 35 are the secondary runway and use the same gateways.
  const SIDS = {
    'NE25D': { apt: 'EGAA', rwy: '25', dir: 'NE', spoken: 'North-east, runway two five', pts: [['T25', 3000], ['B050D40', 6000]] },
    'SE25D': { apt: 'EGAA', rwy: '25', dir: 'SE', spoken: 'South-east, runway two five', pts: [['T25', 3000], ['B120D40', 6000]] },
    'S25D':  { apt: 'EGAA', rwy: '25', dir: 'S',  spoken: 'South, runway two five',      pts: [['T25', 3000], ['B190D40', 6000]] },
    'W25D':  { apt: 'EGAA', rwy: '25', dir: 'W',  spoken: 'West, runway two five',       pts: [['T25', 3000], ['B300D40', 6000]] },
    'NE07D': { apt: 'EGAA', rwy: '07', dir: 'NE', spoken: 'North-east, runway zero seven', pts: [['T07', 3000], ['B050D40', 6000]] },
    'SE07D': { apt: 'EGAA', rwy: '07', dir: 'SE', spoken: 'South-east, runway zero seven', pts: [['T07', 3000], ['B120D40', 6000]] },
    'S07D':  { apt: 'EGAA', rwy: '07', dir: 'S',  spoken: 'South, runway zero seven',      pts: [['T07', 3000], ['B190D40', 6000]] },
    'W07D':  { apt: 'EGAA', rwy: '07', dir: 'W',  spoken: 'West, runway zero seven',       pts: [['T07', 3000], ['B300D40', 6000]] },
    'NE22D': { apt: 'EGAC', rwy: '22', dir: 'NE', spoken: 'North-east, runway two two', pts: [['T22', 3000], ['B050D40', 6000]] },
    'SE22D': { apt: 'EGAC', rwy: '22', dir: 'SE', spoken: 'South-east, runway two two', pts: [['T22', 3000], ['B120D40', 6000]] },
    'S22D':  { apt: 'EGAC', rwy: '22', dir: 'S',  spoken: 'South, runway two two',      pts: [['T22', 3000], ['B190D40', 6000]] },
    'W22D':  { apt: 'EGAC', rwy: '22', dir: 'W',  spoken: 'West, runway two two',       pts: [['T22', 3000], ['B300D40', 6000]] },
    'NE04D': { apt: 'EGAC', rwy: '04', dir: 'NE', spoken: 'North-east, runway zero four', pts: [['T04', 3000], ['B050D40', 6000]] },
    'SE04D': { apt: 'EGAC', rwy: '04', dir: 'SE', spoken: 'South-east, runway zero four', pts: [['T04', 3000], ['B120D40', 6000]] },
    'S04D':  { apt: 'EGAC', rwy: '04', dir: 'S',  spoken: 'South, runway zero four',      pts: [['T04', 3000], ['B190D40', 6000]] },
    'W04D':  { apt: 'EGAC', rwy: '04', dir: 'W',  spoken: 'West, runway zero four',       pts: [['T04', 3000], ['B300D40', 6000]] }
  };
  // 17 and 35 reuse the 25 / 07 SIDs' gateways (turn point T17/T35 straight ahead along those runways)
  for (const r of ['17', '35']) for (const d of ['NE', 'SE', 'S', 'W']) {
    const g = { NE: 'B050D40', SE: 'B120D40', S: 'B190D40', W: 'B300D40' }[d];
    SIDS[`${d}${r}D`] = { apt: 'EGAA', rwy: r, dir: d, spoken: `${d}, runway ${r}`, pts: [[`T${r}`, 3000], [g, 6000]] };
  }

  // ── where each destination is: the gateway an arrival is brought in through and the SIDs that leave to it
  const DIR = {
    NE: { gate: 'B050D40', ctr: 'sc', name: 'Scotland, the Hebrides and the north of England' },
    SE: { gate: 'B120D40', ctr: 'lon', name: 'England, Wales and the near continent' },
    S:  { gate: 'B190D40', ctr: 'sc', name: 'Dublin, the south of Ireland, Iberia and the Canaries' },
    W:  { gate: 'B300D40', ctr: 'sc', name: 'the Atlantic and North America' }
  };
  const PLACE_DIR = {
    EGPF: 'NE', EGPH: 'NE', EGPD: 'NE', EGPE: 'NE', EGPK: 'NE', EGNT: 'NE', EGNM: 'SE', EGNX: 'SE', EGCC: 'SE', EGLL: 'SE', EGKK: 'SE', EGSS: 'SE',
    EGGW: 'SE', EGGD: 'SE', EGBB: 'SE', EGNS: 'SE', EHAM: 'SE', EDDF: 'SE', LFPG: 'SE', EBBR: 'SE', LSZH: 'SE', LSGG: 'SE',
    EIDW: 'S', EICK: 'S', EINN: 'S', EIKN: 'S', LEMG: 'S', LEPA: 'S', LEAL: 'S', LEBL: 'S', GCTS: 'S', GCRR: 'S', LPFR: 'S', LPPT: 'S', LIRF: 'S', LIMC: 'S',
    KJFK: 'W', KEWR: 'W', CYYZ: 'W', KBOS: 'W', BIKF: 'W'
  };
  const dirFor = icao => DIR[PLACE_DIR[icao] || 'SE'];

  // ── units and frequencies (the charts): Belfast Approach is one unit working both airports, with Aldergrove and City
  // Towers and a Director for the sequencing
  const UNITS = {
    EGAA: { atis: { name: 'Aldergrove Information', freq: '126.130' }, twr: { name: 'Aldergrove Tower', freq: '118.305' },
            app: { name: 'Aldergrove Approach', freq: '133.130' }, dir: { name: 'Aldergrove Director', freq: '120.905' } },
    EGAC: { atis: { name: 'Belfast Information', freq: '124.580' }, twr: { name: 'Belfast Tower', freq: '122.830' },
            app: { name: 'Belfast Approach', freq: '130.855' }, rad: { name: 'Belfast Radar', freq: '134.805' } }
  };
  const TA = 6000, TZ = 'Europe/London';
  const ALTERNATES = [['Dublin', 'EIDW', 'B190D40'], ['Derry', 'EGAE', 'B300D40'], ['Glasgow', 'EGPF', 'B050D40']];

  return {
    icao: 'EGAA', icaoAlt: 'EGAC', iata: 'BFS', name: 'Belfast', city: 'Belfast', country: 'United Kingdom',
    airfields: {
      EGAA: { name: 'Belfast International (Aldergrove)', iata: 'BFS', arp: P('543927N', '0061257W'), elev: 268, rwys: RWYS.EGAA },
      EGAC: { name: 'Belfast City (George Best)',         iata: 'BHD', arp: P('543705N', '0055221W'), elev: 15,  rwys: RWYS.EGAC }
    },
    VAR, from, FIX, NAV, HOLDS_AIR, ILS, RNP07, STARS, SIDS, DIR, PLACE_DIR, dirFor, UNITS, TA, TZ, ALTERNATES,
    // not yet built: TIMETABLE / EXTRA / EXERCISES / WX_PRESETS / TYPES / PLACES / AIRPORTS, the airside layout
    // (belfast-ground.js) and the engine adapter (egaa-engine.js)
    features: { dualAirport: true, roadCrossing: false, sra: true, ils: true, rnavSids: false, singleRunway: false, mixedMode: true }
  };
})();
if (typeof module !== 'undefined') module.exports = EGAA;
