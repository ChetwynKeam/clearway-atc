// ═════════════════════════ Belfast (EGAA Aldergrove + EGAC City) airport profile ═════════════════════════
// One Clearway session for both Belfast airports, worked by one Belfast Approach (the airports are 14 NM apart and their
// approaches overlap): Aldergrove (Belfast International, 268 ft, runways 07/25 and 17/35) and Belfast City (15 ft,
// runway 04/22). Sources: UK AIP AD 2 EGAA and EGAC charts in the project's chart folder (aerodrome charts, parking,
// ATC surveillance minimum altitude charts, ILS/LOC/VOR/DME/NDB/RNP approaches and the EGAA RNP 07 coding table).
// Positions are lat/lon (WGS84); bearings are TRUE unless named "mag" (variation 1.2°W at Aldergrove, 1.0°W at City:
// 1.1°W used for the area, magnetic = true + 1.1).
//
// NO SIDs OR STARs ARE PUBLISHED at either airport (Belfast International's own noise document says so): in real life
// arrivals are radar-vectored, with a 220 kt limit from the hold (or 20 NM), 180 kt on base and 180-160 kt when
// established, 160 kt to 4 DME, continuous descent 2200-0700; BEL is the hold, used in winter weather. Runway 25 is
// Aldergrove's preferred runway (it has the Cat III ILS) and 07 the other direction; 17/35 is secondary and only used
// when the weather needs it. So the "routes" below are not charts: they are the tracks the radar vectors normally make,
// written as STAR-like legs so the simulator can fly them. UK and European arrivals come down over Belfast Lough and turn
// sharply (60-85°) onto the ILS 25 final at 12-14 DME or the City 22 final at 12.5 DME; the other directions use BEL,
// the RNP 07 IAFs or City's 04 direct arrival. Gateway points are DERIVED (B<radial>D<nm> from BEL VOR) and LOUGH is a
// position over Belfast Lough; none is a real AIP fix. Not for real-world navigation.
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
  // ── the standard initial routes the VATSIM UK and IVAO local procedures give (no STARs are published; routes may be varied
  // by ATC): NE via P600 TRN-BLACA-BEL(ZU); SE via L10 IOM-RINGA-BEL (FL80 and above) or IOM-NELBO-BEL (FL60 and below),
  // via UP6 REMSI-MASOP-NELBO-BEL; S via N34 NEVRI-ABSUN-BEL; W, NW and N direct from the TMA boundary. The two sources
  // disagree on which of RINGA/NELBO is high and which is low, and on whether the route ends at BEL or BELZU.
  // THE NAMES ARE REAL BUT THE POSITIONS BELOW ARE APPROXIMATE (placed along the airways by bearing and distance from BEL):
  // replace them with the AIP ENR 4.4 / ENR 6 coordinates. TRN and IOM are the Turnberry and Isle of Man VORs.
  NAV.TRN = { name: 'Turnberry VOR/DME', freq: '117.5', p: P('551838N', '0044717W'), approx: true };
  NAV.IOM = { name: 'Isle of Man VOR/DME', freq: '112.2', p: P('540400N', '0044600W'), approx: true };
  const _brg = (a, b) => { const r = x => x*Math.PI/180, y = Math.sin(r(b[1]-a[1]))*Math.cos(r(b[0])),
    x = Math.cos(r(a[0]))*Math.sin(r(b[0])) - Math.sin(r(a[0]))*Math.cos(r(b[0]))*Math.cos(r(b[1]-a[1])); return (Math.atan2(y, x)*180/Math.PI + 360) % 360 + VAR; };
  const _BEL = NAV.BEL.p, _toTRN = _brg(_BEL, NAV.TRN.p), _toIOM = _brg(_BEL, NAV.IOM.p);
  Object.assign(FIX, {
    BELZU: from(_BEL, 90, 8),                                // the TMA transition point: position unknown, placed east of BEL (approx)
    BLACA: from(_BEL, _toTRN, 35),                           // P600, between TRN and BEL
    RINGA: from(_BEL, _toIOM, 38), NELBO: from(_BEL, _toIOM, 55),   // L10, between IOM and BEL
    REMSI: from(_BEL, _toIOM + 25, 110), MASOP: from(_BEL, _toIOM + 18, 78),                      // UP6 south-east of IOM
    NEVRI: from(_BEL, 185, 72), ABSUN: from(_BEL, 185, 38)   // N34 from the south (Dublin)
  });
  FIX.LOUGH = [54.690, -5.760];                              // over the middle of Belfast Lough, where GB and European arrivals cross
  // the final-approach intercepts the vectors normally end at: ILS 25 at I-AG D14 (4,000 ft, the plate's "direct arrival
  // via south-east" point is D14.9), ILS 22 at I-BFH D12.5 (2,800 ft, the plate's direct arrival via the north-east) and
  // ILS 04 at I-HBD D13.5 (3,000 ft, the plate's direct arrival via the south-west); set below once the runways are known
  const _INT = {};

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
  FIX.INT25 = from(RWYS.EGAA[0].thr['25'], 66, 14);           // the 25 final's reciprocal is 066° mag
  FIX.INT22 = from(RWYS.EGAC[0].thr['22'], 36, 12.5);
  FIX.INT04 = from(RWYS.EGAC[0].thr['04'], 216, 13.5);

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
    '17': { apt: 'EGAA', secondary: true, loc: 'I-FT',  freq: '110.90', iaf: ['BEL'], ifAlt: 4000, fafAlt: 2500, missed: ['BEL', 3000], turn: 1 },
    '04': { apt: 'EGAC', loc: 'I-HBD', freq: '108.10', iaf: ['HB'],  ifAlt: 3000, fafAlt: 3000, missed: ['HB', 3000],  turn: 1 },
    '22': { apt: 'EGAC', loc: 'I-BFH', freq: '108.10', iaf: ['HB'],  ifAlt: 2800, fafAlt: 2800, missed: ['HB', 3000],  turn: -1 }
  };
  // the RNP 07 approach: three IAFs at 4,000 ft, IF AA07I (2,500 ft, 10.1 NM), FAF AA07F (2,500 ft, 7.1 NM), 3° to RW07, 210 kt
  const RNP07 = { iaf: ['SULEV', 'VAGMO', 'LIRGU'], ifx: 'AA07I', faf: 'AA07F', ifAlt: 2500, fafAlt: 2500, maxKt: 210, missed: ['BEL', 3000] };

  // ── arrival tracks (Clearway standard routing, standing in for the radar vectors). Key = gateway + runway.
  //   UK and Europe (NE, SE): over Belfast Lough, then the sharp turn onto the final (25, 22), or round to the RNP 07 IAFs.
  //   South and west: straight to BEL (25), the RNP 07 IAFs, or City's 04 direct arrival.
  const STARS = {
    // north-east: P600 from Turnberry, then over the Lough to the sharp turn onto the final
    'NE 25': { apt: 'EGAA', rwy: '25', from: 'NE', pts: [['TRN', 12000], ['BLACA', 8000], ['LOUGH', 5000], ['INT25', 4000]] },
    // south-east: L10 from the Isle of Man (RINGA low route shown; NELBO for the high one), up the Down coast and over the Lough
    'SE 25': { apt: 'EGAA', rwy: '25', from: 'SE', pts: [['IOM', 12000], ['RINGA', 8000], ['LOUGH', 5000], ['INT25', 4000]] },
    // south: N34 from the Dublin side
    'S 25':  { apt: 'EGAA', rwy: '25', from: 'S',  pts: [['NEVRI', 12000], ['ABSUN', 8000], ['BEL', 4000]] },
    // west, north-west and north: direct from the TMA boundary
    'W 25':  { apt: 'EGAA', rwy: '25', from: 'W',  pts: [['B300D40', 8000], ['BEL', 4000]] },
    'NE 07': { apt: 'EGAA', rwy: '07', from: 'NE', pts: [['TRN', 12000], ['BLACA', 8000], ['SULEV', 4000]] },
    'SE 07': { apt: 'EGAA', rwy: '07', from: 'SE', pts: [['IOM', 12000], ['RINGA', 8000], ['LIRGU', 4000]] },
    'S 07':  { apt: 'EGAA', rwy: '07', from: 'S',  pts: [['NEVRI', 12000], ['ABSUN', 8000], ['LIRGU', 4000]] },
    'W 07':  { apt: 'EGAA', rwy: '07', from: 'W',  pts: [['B300D40', 8000], ['VAGMO', 4000]] },
    // City follows the same entry routes, then its own direct arrivals (22 from the north-east, 04 from the south-west)
    'NE 22': { apt: 'EGAC', rwy: '22', from: 'NE', pts: [['TRN', 12000], ['BLACA', 8000], ['INT22', 2800]] },
    'SE 22': { apt: 'EGAC', rwy: '22', from: 'SE', pts: [['IOM', 12000], ['RINGA', 8000], ['LOUGH', 5000], ['INT22', 2800]] },
    'S 22':  { apt: 'EGAC', rwy: '22', from: 'S',  pts: [['NEVRI', 12000], ['ABSUN', 8000], ['LOUGH', 5000], ['INT22', 2800]] },
    'W 22':  { apt: 'EGAC', rwy: '22', from: 'W',  pts: [['B300D40', 8000], ['LOUGH', 5000], ['INT22', 2800]] },
    'NE 04': { apt: 'EGAC', rwy: '04', from: 'NE', pts: [['TRN', 12000], ['BLACA', 8000], ['LOUGH', 5000], ['HB', 3000], ['INT04', 3000]] },
    'SE 04': { apt: 'EGAC', rwy: '04', from: 'SE', pts: [['IOM', 12000], ['RINGA', 8000], ['INT04', 3000]] },
    'S 04':  { apt: 'EGAC', rwy: '04', from: 'S',  pts: [['NEVRI', 12000], ['ABSUN', 8000], ['INT04', 3000]] },
    'W 04':  { apt: 'EGAC', rwy: '04', from: 'W',  pts: [['B300D40', 8000], ['INT04', 3000]] }
  };
  // the high-level alternatives (level bands as the sources give them; the simulator picks by the flight's cruise level)
  const STAR_ALT = {
    SE: [{ min: 8000, via: ['NELBO'] }, { min: 25000, via: ['REMSI', 'MASOP', 'NELBO'] }],
    NE: [], S: []
  };
  // typical speed limits the vectors work to (Belfast International noise document): knots
  const APP_SPEEDS = { hold: 220, twentyNM: 220, base: 180, established: [180, 160], to4dme: 160, cdaFromTo: ['22:00', '07:00'] };
  // runway use: Aldergrove prefers 25 (Cat III ILS), then 07; 17/35 only for crosswind or weather. City: 22 or 04 by wind.
  const RWY_USE = { EGAA: { main: ['25', '07'], secondary: ['17', '35'] }, EGAC: { main: ['22', '04'], secondary: [] } };

  // ── SIDs (Clearway standard routing; real departures climb on the runway track to 2,000 ft at night, then follow ATC):
  // straight ahead to 2,000 ft (Aldergrove) or 3,000 ft (City), then the turn towards the gateway, climbing to 6,000 ft
  // (Belfast Approach hands on to Scottish Control, which is why every SID stops there). T<rwy> are the turn points.
    const SIDS = {
    'NE25D': { apt: 'EGAA', rwy: '25', dir: 'NE', spoken: 'North-east, runway two five', pts: [['T25', 2000], ['B050D40', 6000]] },
    'SE25D': { apt: 'EGAA', rwy: '25', dir: 'SE', spoken: 'South-east, runway two five', pts: [['T25', 2000], ['B120D40', 6000]] },
    'S25D':  { apt: 'EGAA', rwy: '25', dir: 'S',  spoken: 'South, runway two five',      pts: [['T25', 2000], ['B190D40', 6000]] },
    'W25D':  { apt: 'EGAA', rwy: '25', dir: 'W',  spoken: 'West, runway two five',       pts: [['T25', 2000], ['B300D40', 6000]] },
    'NE07D': { apt: 'EGAA', rwy: '07', dir: 'NE', spoken: 'North-east, runway zero seven', pts: [['T07', 2000], ['B050D40', 6000]] },
    'SE07D': { apt: 'EGAA', rwy: '07', dir: 'SE', spoken: 'South-east, runway zero seven', pts: [['T07', 2000], ['B120D40', 6000]] },
    'S07D':  { apt: 'EGAA', rwy: '07', dir: 'S',  spoken: 'South, runway zero seven',      pts: [['T07', 2000], ['B190D40', 6000]] },
    'W07D':  { apt: 'EGAA', rwy: '07', dir: 'W',  spoken: 'West, runway zero seven',       pts: [['T07', 2000], ['B300D40', 6000]] },
    'NE22D': { apt: 'EGAC', rwy: '22', dir: 'NE', spoken: 'North-east, runway two two', pts: [['T22', 3000], ['B050D40', 6000]] },
    'SE22D': { apt: 'EGAC', rwy: '22', dir: 'SE', spoken: 'South-east, runway two two', pts: [['T22', 3000], ['B120D40', 6000]] },
    'S22D':  { apt: 'EGAC', rwy: '22', dir: 'S',  spoken: 'South, runway two two',      pts: [['T22', 3000], ['B190D40', 6000]] },
    'W22D':  { apt: 'EGAC', rwy: '22', dir: 'W',  spoken: 'West, runway two two',       pts: [['T22', 3000], ['B300D40', 6000]] },
    'NE04D': { apt: 'EGAC', rwy: '04', dir: 'NE', spoken: 'North-east, runway zero four', pts: [['T04', 3000], ['B050D40', 6000]] },
    'SE04D': { apt: 'EGAC', rwy: '04', dir: 'SE', spoken: 'South-east, runway zero four', pts: [['T04', 3000], ['B120D40', 6000]] },
    'S04D':  { apt: 'EGAC', rwy: '04', dir: 'S',  spoken: 'South, runway zero four',      pts: [['T04', 3000], ['B190D40', 6000]] },
    'W04D':  { apt: 'EGAC', rwy: '04', dir: 'W',  spoken: 'West, runway zero four',       pts: [['T04', 3000], ['B300D40', 6000]] }
  };

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
    VAR, from, FIX, NAV, HOLDS_AIR, ILS, RNP07, STARS, STAR_ALT, APP_SPEEDS, RWY_USE, SIDS, DIR, PLACE_DIR, dirFor, UNITS, TA, TZ, ALTERNATES,
    // not yet built: TIMETABLE / EXTRA / EXERCISES / WX_PRESETS / TYPES / PLACES / AIRPORTS, the airside layout
    // (belfast-ground.js) and the engine adapter (egaa-engine.js)
    features: { dualAirport: true, roadCrossing: false, sra: true, ils: true, rnavSids: false, singleRunway: false, mixedMode: true }
  };
})();
if (typeof module !== 'undefined') module.exports = EGAA;
