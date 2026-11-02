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
  NAV.TRN = { name: 'Turnberry VOR/DME', freq: '117.5', p: P('551848N', '0044702W') };
  NAV.IOM = { name: 'Isle of Man VOR/DME', freq: '112.2', p: P('540401N', '0044549W') };
  const _brg = (a, b) => { const r = x => x*Math.PI/180, y = Math.sin(r(b[1]-a[1]))*Math.cos(r(b[0])),
    x = Math.cos(r(a[0]))*Math.sin(r(b[0])) - Math.sin(r(a[0]))*Math.cos(r(b[0]))*Math.cos(r(b[1]-a[1])); return (Math.atan2(y, x)*180/Math.PI + 360) % 360 + VAR; };
  const _BEL = NAV.BEL.p, _toTRN = _brg(_BEL, NAV.TRN.p), _toIOM = _brg(_BEL, NAV.IOM.p);
  Object.assign(FIX, {
    BELZU: P('543942N', '0061348W'),                                // the TMA transition point (official en-route coordinates; replaces the BEL VOR)
    BLACA: P('545300N', '0050932W'),                               // P600: the departure route runs out BEL R075 to BLACA (VATSIM UK / IVAO)
    RINGA: P('542354N', '0053416W'), NELBO: P('542924N', '0051810W'),   // L10, between IOM and BEL
    REMSI: P('535737N', '0034932W'), MASOP: P('540921N', '0042115W'),                      // UP6 south-east of IOM
    NEVRI: P('540406N', '0061612W'), ABSUN: P('541732N', '0061518W'),  // N34 from the south (Dublin)
    // departure routes (VATSIM UK): S via P620 LISBO-NUMPI-NIMAT; SE via L10 LISBO-PEPOD-IOM (FL90+) or LISBO-RINGA-SLYDA-IOM (FL70-)
    MAGEE: P('544730N', '0053630W'),                               // City's arrival hold and ILS 22 entry: BEL R071 D23 (plate 500839), 2,800 ft
    LISBO: P('543130N', '0060524W'),                               // near Lisburn: every south and south-east departure crosses it at or above 4,000 ft
    NUMPI: P('540840N', '0053536W'), NIMAT: P('535754N', '0054432W'),
    PEPOD: P('541616N', '0053409W'), SLYDA: P('541204N', '0050515W'),
    KELLY: P('535419N', '0042151W')                       // beyond IOM: jets to FL290+ cross it at or above FL290
  });
  FIX.LOUGH = [54.690, -5.760];                              // over the middle of Belfast Lough, where GB and European arrivals cross
  // the final-approach intercepts the vectors normally end at: ILS 25 at I-AG D14 (4,000 ft, the plate's "direct arrival
  // via south-east" point is D14.9), ILS 22 at I-BFH D12.5 (2,800 ft, the plate's direct arrival via the north-east) and
  // ILS 04 at I-HBD D13.5 (3,000 ft, the plate's direct arrival via the south-west); set below once the runways are known
  

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

  // ── holds: BEL, the 050° hold at 3,000 ft or above, MSL to FL140 (plates; turn direction not published: right-hand assumed);
  // HB 038°/right at 3,000 ft and MAGEE 253°/left at 3,000 ft (IVAO EGAC local procedure). inb is the TRUE inbound track:
  // true = magnetic - 1.1° (variation is west).
  const HOLDS_AIR = {
    BEL:   { inb: 50 - VAR,  turn: 'R', min: 3000, max: 14000, maxKt: 220 },
    HB:    { inb: 38 - VAR,  turn: 'R', min: 3000, max: 10000, maxKt: 220 },
    MAGEE: { inb: 253 - VAR, turn: 'L', min: 3000, max: 10000, maxKt: 220 }
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

  // ── runway geometry helpers: the landing threshold, the extended centreline and the circuit points either side of it
  const THR = { ...RWYS.EGAA[0].thr, ...RWYS.EGAA[1].thr, ...RWYS.EGAC[0].thr };
  const MAGH = { '07': 66, '25': 246, '17': 163, '35': 343, '04': 36, '22': 216 };
  const RECIP = { '07': '25', '25': '07', '17': '35', '35': '17', '04': '22', '22': '04' };
  const fin = (r, nm) => from(THR[r], (MAGH[r] + 180) % 360, nm);                    // nm out along the extended centreline
  const off = (r, nm, lat, side) => from(fin(r, nm), (MAGH[r] + (side === 'R' ? 90 : 270)) % 360, lat);   // lat NM to the L/R of it
  // a circuit leg on one side: A abeam the threshold, B out at the intercept, the base leg then runs back across to the final.
  // Right-hand circuit = downwind on the right of the landing direction and right turns; left-hand likewise.
  const CIRC = { '25': 14, '22': 12.5, '04': 13.5 };
  for (const r of Object.keys(CIRC)) for (const sd of ['L', 'R']) { FIX[`${r}${sd}A`] = off(r, 0, 4, sd); FIX[`${r}${sd}B`] = off(r, CIRC[r], 4.5, sd); }
  FIX.S25BA = off('25', 9, 6, 'L'); FIX.INT25S = fin('25', 9);                       // from the south: base leg across to D9

  // ── arrival tracks (Clearway "real" routing, standing in for the radar vectors). Key = direction + runway.
  // Entry legs are the standard initial routes (VATSIM UK / IVAO); after the last of them the controller vectors, written here as
  // the circuit the vectors normally make: straight in when the final points at the traffic, a base leg when it must cross
  // the final (south-east traffic over the Lough, south traffic below it), a full downwind and base when it must pass over.
  // Alt = level constraint at the fix (feet). The engine flies every corner as a fly-by turn at the aircraft's own radius.
  const STARS = {
    // ── Aldergrove 25: the 25 final points north-east, so P600 traffic is straight in; Lough traffic turns left onto it
    'NE 25': { apt: 'EGAA', rwy: '25', from: 'NE', pts: [['TRN', 12000], ['BLACA', 8000], ['INT25', 4000]] },
    'SE 25': { apt: 'EGAA', rwy: '25', from: 'SE', pts: [['IOM', 12000], ['RINGA', 8000], ['LOUGH', 5000], ['INT25', 4000]] },
    'S 25':  { apt: 'EGAA', rwy: '25', from: 'S',  pts: [['NEVRI', 12000], ['ABSUN', 8000], ['S25BA', 5000], ['INT25S', 3000]] },
    'W 25':  { apt: 'EGAA', rwy: '25', from: 'W',  pts: [['B300D40', 8000], ['BEL', 5000], ['25RA', 4500], ['25RB', 4000], ['INT25', 4000]] },
    // ── Aldergrove 07: the RNP initial approach fixes (the plate's IAFs) are the end of the route
    'NE 07': { apt: 'EGAA', rwy: '07', from: 'NE', pts: [['TRN', 12000], ['BLACA', 8000], ['SULEV', 4000]] },
    'SE 07': { apt: 'EGAA', rwy: '07', from: 'SE', pts: [['IOM', 12000], ['RINGA', 8000], ['LISBO', 6000], ['LIRGU', 4000]] },
    'S 07':  { apt: 'EGAA', rwy: '07', from: 'S',  pts: [['NEVRI', 12000], ['ABSUN', 8000], ['LIRGU', 4000]] },
    'W 07':  { apt: 'EGAA', rwy: '07', from: 'W',  pts: [['B300D40', 8000], ['VAGMO', 4000]] },
    // ── City: every route ends at the MAGEE hold (BEL R071 D23, plate 500839; IVAO "BLACA - MAGEE", "IOM - RINGA - MAGEE"), then vectors.
    // 22: MAGEE lies on the 22 final's north-east approach, so it is straight in. 04: down the east side of the Lough in a
    // right-hand circuit. (Base leg or visual: 2,500 ft until established; 04 intercept at 1,500 ft by 5 DME.)
    'NE 22': { apt: 'EGAC', rwy: '22', from: 'NE', pts: [['TRN', 12000], ['BLACA', 8000], ['MAGEE', 3000], ['INT22', 2800]] },
    'SE 22': { apt: 'EGAC', rwy: '22', from: 'SE', pts: [['IOM', 12000], ['RINGA', 8000], ['MAGEE', 3000], ['INT22', 2800]] },
    'S 22':  { apt: 'EGAC', rwy: '22', from: 'S',  pts: [['NEVRI', 12000], ['ABSUN', 8000], ['MAGEE', 3000], ['INT22', 2800]] },
    'W 22':  { apt: 'EGAC', rwy: '22', from: 'W',  pts: [['B300D40', 8000], ['MAGEE', 3000], ['INT22', 2800]] },
    'NE 04': { apt: 'EGAC', rwy: '04', from: 'NE', pts: [['TRN', 12000], ['BLACA', 8000], ['MAGEE', 3000], ['04RA', 3000], ['04RB', 3000], ['INT04', 3000]] },
    'SE 04': { apt: 'EGAC', rwy: '04', from: 'SE', pts: [['IOM', 12000], ['RINGA', 8000], ['MAGEE', 3000], ['04RA', 3000], ['04RB', 3000], ['INT04', 3000]] },
    'S 04':  { apt: 'EGAC', rwy: '04', from: 'S',  pts: [['NEVRI', 12000], ['ABSUN', 8000], ['INT04', 3000]] },
    'W 04':  { apt: 'EGAC', rwy: '04', from: 'W',  pts: [['B300D40', 8000], ['MAGEE', 3000], ['04RA', 3000], ['04RB', 3000], ['INT04', 3000]] }
  };
  // the high-level alternatives (level bands as the sources give them; the simulator picks by the flight's cruise level)
  const STAR_ALT = { SE: [{ min: 8000, via: ['NELBO'] }, { min: 25000, via: ['REMSI', 'MASOP', 'NELBO'] }], NE: [], S: [] };
  // typical speed limits the vectors work to (Belfast International noise document): knots
  const APP_SPEEDS = { hold: 220, twentyNM: 220, base: 180, established: [180, 160], to4dme: 160, cdaFromTo: ['22:00', '07:00'] };
  // runway use: Aldergrove prefers 25 (Cat III ILS), then 07 (IVAO: 07/25 in regular operations, tailwind under 5 kt);
  // 17/35 only for crosswind or weather. City: 22 or 04 by wind.
  const RWY_USE = { EGAA: { main: ['25', '07'], secondary: ['17', '35'] }, EGAC: { main: ['22', '04'], secondary: [] } };

  // ── departures. NO SIDs: ATC clears the aircraft to its destination via the first airway with a tactical instruction ("cleared
  // to Stansted via L10, climb straight ahead, runway heading, squawk 4321"), then Belfast Radar gives a heading to the first
  // fix. The text-defined outbound routes (VATSIM UK / IVAO, UK AIP): north via P600 out BEL R075 to BLACA; south via P620 to
  // LISBO, NUMPI, NIMAT; south-east via L10 to LISBO, PEPOD, IOM (FL90 and above) or LISBO, RINGA, SLYDA, IOM (FL70 and below).
  const DEP_ROUTES = {
    N:    { airway: 'P600', via: ['BLACA', 'TRN'],                          note: 'BEL R075 out to BLACA, Scotland and Iceland' },
    S:    { airway: 'P620', via: ['LISBO', 'NUMPI', 'NIMAT'],               note: 'Dublin and Irish airspace; cross LISBO at or above 4,000 ft' },
    SE_H: { airway: 'L10',  via: ['LISBO', 'PEPOD', 'IOM'],                 note: 'cruise FL90 and above; cross LISBO at or above 4,000 ft', minFL: 90 },
    SE_L: { airway: 'L10',  via: ['LISBO', 'RINGA', 'SLYDA', 'IOM'],        note: 'cruise FL70 and below; cross LISBO at or above 4,000 ft', maxFL: 70 }
  };
  const DEP_RULES = {
    lisboMin: 4000,                                                        // south and south-east departures cross LISBO at or above 4,000 ft
    kelly: { fix: 'KELLY', minFL: 290, whenCruiseFL: 290, speedKt: 250, speedUntilFL: 250 },   // IOM jets to FL290+: KELLY at or above FL290, 250 kt to FL250
    night: { from: '22:00', to: '07:00', mtowOverKg: 5700, straightAheadTo: 2000 },        // noise: climb straight ahead to 2,000 ft before turning
    clearance: (dest, airway, rwyHdg) => `cleared to ${dest} via ${airway}, climb straight ahead, runway heading ${rwyHdg}`
  };
  // ── City (EGAC) departures. No SIDs; every departure needs a release from Aldergrove Radar (City departures are not free flow)
  // and is handed to it straight after take-off, no later than 2,000 ft. Standard routes (IVAO EGAC local procedure, VATSIM UK):
  // 04 turns RIGHT and 22 turns LEFT, direct to the first fix: north BLACA then TRN (P600); south NUMPI then NIMAT (P620);
  // south-east L10 via PEPOD to IOM (FL90 and above; IVAO has DUFFY first at FL75+) or via RINGA, SLYDA to IOM (below FL75).
  // They skip LISBO. Initial climb (Boeing noise page): 04 turns left to track 034°M at 500 ft QNH or 0.4 DME, 22 goes straight
  // ahead; then climb to 1,500 ft (propeller 13,000 kg or less), 2,000 ft (propeller over) or 3,000 ft (jets) before any turn.
  const DEP_ROUTES_EGAC = {
    N:    { airway: 'P600', via: ['BLACA', 'TRN'],             note: 'direct BLACA' },
    S:    { airway: 'P620', via: ['NUMPI', 'NIMAT'],           note: 'direct NUMPI' },
    SE_H: { airway: 'L10',  via: ['PEPOD', 'IOM'],             note: 'cruise FL90 and above (IVAO: DUFFY at FL75+)', minFL: 90 },
    SE_L: { airway: 'L10',  via: ['RINGA', 'SLYDA', 'IOM'],    note: 'cruise below FL75', maxFL: 70 }
  };
  const EGAC_RULES = {
    release: 'Aldergrove Radar', transferByFt: 2000, minutesBetween: { diverging45: 1, similar: 2 },
    turnAlt: { propLight: 1500, propHeavy: 2000, jet: 3000 }, initialTrack04: 34,   // 04: left to 034°M at 500 ft or 0.4 DME
    preferredDeparture: '04', hours: ['06:30', '21:30'], speedBelowFL100: 250,
    clearance: (dest, airway, turn, fix) => `cleared to ${dest} via ${airway}, after departure ${turn} turn direct ${fix}, climb altitude 3000 ft`
  };
  DEP_RULES.EGAC = EGAC_RULES;

  // the straight-ahead point and the SIDs built on it: climb straight ahead to the turn altitude (2,000 ft at Aldergrove, 3,000 ft
  // for City's jets), then a turn to the first fix, then the route. T<rwy> is where the climb reaches it.
  const DEP_TURN_ALT = { EGAA: 2000, EGAC: 3000 };
  const DEP_TURN_OVR = { '25 N': 'R' };                                    // Aldergrove north from 25: the long way round, clear of Belfast
  const DEP_TURN_FIXED = { '04': 'R', '22': 'L' };                         // City: 04 right, 22 left, whatever the route
  const SIDS = {}, DEP_PTS = {};
  const dirOfKey = { N: 'N', S: 'S', SE_H: 'SE', SE_L: 'SE' };
  for (const [apt, rw] of Object.entries({ EGAA: ['25', '07'], EGAC: ['22', '04'] })) for (const r of rw) {
    const T = from(THR[RECIP[r]], MAGH[r], 3.5); DEP_PTS['T' + r] = T; FIX['T' + r] = T;
    for (const [key, R] of Object.entries(apt === 'EGAC' ? DEP_ROUTES_EGAC : DEP_ROUTES)) {
      const first = FIX[R.via[0]];
      const b = (Math.atan2(Math.sin(rad(first[1] - T[1]))*Math.cos(rad(first[0])), Math.cos(rad(T[0]))*Math.sin(rad(first[0])) - Math.sin(rad(T[0]))*Math.cos(rad(first[0]))*Math.cos(rad(first[1] - T[1]))) * 180/Math.PI + 360 + VAR) % 360;
      const rel = ((b - MAGH[r] + 540) % 360) - 180;                       // + right, - left
      const turn = apt === 'EGAC' ? DEP_TURN_FIXED[r] : (key === 'N' && DEP_TURN_OVR[`${r} N`]) || (rel >= 0 ? 'R' : 'L');
      const turnDeg = apt === 'EGAC' ? Math.round(((turn === 'R' ? rel : -rel) + 360) % 360) : Math.round(Math.abs(rel));   // the way actually turned
      const pts = [['T' + r, DEP_TURN_ALT[apt]]];
      // a turn of more than 120° is flown as two: out to a wide-turn point 3.5 NM off the climb-out line, then on to the first fix
      if (turnDeg > 120) { const X = from(T, (MAGH[r] + (turn === 'R' ? 90 : 270)) % 360, 3.5); FIX[`X${r}${turn}`] = X; pts.push([`X${r}${turn}`, DEP_TURN_ALT[apt] + 1000]); }
      R.via.forEach((f, i) => pts.push([f, apt === 'EGAA' && i === 0 && key !== 'N' ? DEP_RULES.lisboMin : (i === R.via.length - 1 ? (key === 'N' ? 8000 : 7000) : 6000)]));
      SIDS[`${r} ${key}`] = { apt, rwy: r, dir: dirOfKey[key], airway: R.airway, turn, turnDeg, wide: turnDeg > 120, pts, note: R.note,
        spoken: `${R.airway}, runway ${r}`, cond: key.startsWith('SE') ? { kelly: DEP_RULES.kelly } : null, release: apt === 'EGAC' ? EGAC_RULES.release : null,
        initialTrack: r === '04' ? EGAC_RULES.initialTrack04 : null };
    }
  }

  // ── where each destination is: the gateway an arrival is brought in through and the SIDs that leave to it
  const DIR = {
    NE: { dep: 'N', gate: 'B050D40', ctr: 'sc', name: 'Scotland, the Hebrides and the north of England' },
    SE: { dep: 'SE', gate: 'B120D40', ctr: 'lon', name: 'England, Wales and the near continent' },
    S:  { dep: 'S', gate: 'B190D40', ctr: 'sc', name: 'Dublin, the south of Ireland, Iberia and the Canaries' },
    W:  { dep: 'N', gate: 'B300D40', ctr: 'sc', name: 'the Atlantic and North America' }
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


  // ── traffic: the real boards of Belfast International and Belfast City on Monday 2 November 2026 (avionio.com; times UTC, which
  // is local in winter), paired by tools/belfast_timetable.py: each arrival with a later departure of the same airline to the same
  // place, an unpaired departure before 11:00 night-stopped. Row: [arrival, from, arrival UTC, departure, to, departure UTC, type,
  // days, stand, airfield (A Aldergrove, C City)]. The scheduled flight feed (egaa/flights.json, both airports) takes over in Real
  // world mode.
  const TIMETABLE = [
    ['EZY985', 'EGKK', '09:00', 'EZY802', 'EGKK', '09:45', 'A20N', '1234567', null, 'C'],
    ['RUK129', 'EGSS', '09:10', null, null, null, 'B738', '1234567', null, 'A'],
    ['EZY221', 'EGGD', '09:10', null, null, null, 'A319', '1234567', null, 'A'],
    ['KLM947', 'EHAM', '09:10', null, null, null, 'E190', '1234567', null, 'C'],
    ['EZY68', 'EGNT', '09:15', 'EZY69', 'EGNT', '10:15', 'A319', '1234567', null, 'A'],
    [null, null, null, 'EZY49', 'EGNM', '09:15', 'A20N', '1234567', null, 'A'],
    ['EIN3651', 'EGPH', '09:20', 'EIN3652', 'EGPH', '10:55', 'AT76', '1234567', null, 'C'],
    ['EZY26', 'EGBB', '09:25', 'EZY27', 'EGBB', '10:45', 'A319', '1234567', null, 'A'],
    [null, null, null, 'CFE1393', 'EGLL', '09:25', 'E190', '1234567', null, 'C'],
    [null, null, null, 'EZY986', 'EGKK', '09:30', 'A319', '1234567', null, 'C'],
    ['RYR9561', 'LPFR', '09:35', null, null, null, 'B738', '1234567', null, 'A'],
    [null, null, null, 'RUK178', 'EGPH', '09:35', 'B38M', '1234567', null, 'A'],
    ['EZY16', 'EGKK', '09:40', 'EZY820', 'EGKK', '10:15', 'A20N', '1234567', null, 'A'],
    [null, null, null, 'EZY222', 'EGGD', '09:40', 'A320', '1234567', null, 'A'],
    ['EIN3671', 'EGNM', '09:40', 'EIN3672', 'EGNM', '10:25', 'AT76', '1234567', null, 'C'],
    [null, null, null, 'KLM948', 'EHAM', '09:40', 'E190', '1234567', null, 'C'],
    ['EIN3611', 'EGCC', '09:50', 'EIN3612', 'EGCC', '11:30', 'AT76', '1234567', null, 'C'],
    [null, null, null, 'EIN3622', 'EGPF', '09:50', 'AT76', '1234567', null, 'C'],
    [null, null, null, 'EZY3051', 'EHAM', '09:55', 'A320', '1234567', null, 'A'],
    ['EIN3641', 'EGBB', '09:55', null, null, null, 'AT76', '1234567', null, 'C'],
    [null, null, null, 'RYR9560', 'LPFR', '10:00', 'B38M', '1234567', null, 'A'],
    [null, null, null, 'EXS301', 'LEAL', '10:00', 'A21N', '1234567', null, 'A'],
    [null, null, null, 'EZY39', 'EGKK', '10:00', 'A320', '1234567', null, 'A'],
    ['CFE8752', 'EGLL', '10:05', 'CFE8753', 'EGLL', '10:40', 'E190', '1234567', null, 'C'],
    ['EZY819', 'EGKK', '10:10', null, null, null, 'A320', '1234567', null, 'A'],
    [null, null, null, 'EIN3642', 'EGBB', '10:10', 'AT76', '1234567', null, 'C'],
    ['EZY703', 'EGCC', '10:20', 'EZY704', 'EGCC', '11:50', 'A319', '1234567', null, 'A'],
    ['EIN3621', 'EGFF', '10:25', null, null, null, 'AT76', '1234567', null, 'C'],
    [null, null, null, 'EIN3604', 'EGHI', '10:25', 'AT76', '1234567', null, 'C'],
    [null, null, null, 'EZY51', 'EGPH', '10:40', 'A320', '1234567', null, 'A'],
    ['CFE1394', 'EGLL', '10:45', 'CFE1395', 'EGLL', '11:40', 'E190', '1234567', null, 'C'],
    ['LOG161', 'EGPE', '10:50', 'LOG162', 'EGPE', '12:20', 'E145', '1234567', null, 'C'],
    ['EZY419', 'EGPF', '11:15', 'EZY420', 'EGPF', '12:05', 'A319', '1234567', null, 'A'],
    ['EZY703', 'EGCC', '11:20', null, null, null, 'A20N', '1234567', null, 'A'],
    ['EZY343', 'EGPH', '11:20', 'EZY344', 'EGPH', '12:50', 'A319', '1234567', null, 'C'],
    ['EZY50', 'EGNM', '11:35', null, null, null, 'A319', '1234567', null, 'A'],
    ['RUK179', 'EGPH', '11:45', null, null, null, 'B738', '1234567', null, 'A'],
    ['EZY3018', 'GCRR', '11:45', 'EZY3019', 'GCRR', '13:15', 'A20N', '1234567', null, 'A'],
    ['LOG85', 'EGPD', '11:50', null, null, null, 'E145', '1234567', null, 'C'],
    ['EIN3623', 'EGPF', '12:00', null, null, null, 'AT76', '1234567', null, 'C'],
    ['EZY3014', 'GCFV', '12:10', 'EZY3015', 'GCFV', '13:40', 'A320', '1234567', null, 'A'],
    ['EIN3679', 'EGNX', '12:10', 'EIN3680', 'EGNX', '13:40', 'AT76', '1234567', null, 'C'],
    ['EZY343', 'EGPH', '12:20', null, null, null, 'A20N', '1234567', null, 'C'],
    ['RUK129', 'EGSS', '12:30', 'RUK130', 'EGSS', '14:00', 'B38M', '1234567', null, 'A'],
    ['EZY70', 'EGNT', '12:35', 'EZY71', 'EGNT', '15:05', 'A20N', '1234567', null, 'A'],
    ['EIN3613', 'EGCC', '12:50', 'EIN3614', 'EGCC', '14:20', 'AT76', '1234567', null, 'C'],
    ['EZY52', 'EGPH', '12:55', null, null, null, 'A20N', '1234567', null, 'A'],
    ['EZY3016', 'GCTS', '12:55', 'EZY3017', 'GCTS', '14:25', 'A319', '1234567', null, 'A'],
    ['EZY3384', 'LIRF', '13:05', 'EZY3385', 'LIRF', '14:35', 'A20N', '1234567', null, 'A'],
    ['EZY40', 'EGKK', '13:10', 'EZY41', 'EGKK', '15:05', 'A20N', '1234567', null, 'A'],
    ['EXS378', 'LTBS', '13:10', 'EXS379', 'LTBS', '14:40', 'A21N', '1234567', null, 'A'],
    ['RUK570', 'GCRR', '13:10', 'RUK571', 'GCRR', '14:40', 'B738', '1234567', null, 'A'],
    ['EZY3012', 'LEMG', '13:10', 'EZY3013', 'LEMG', '14:40', 'A20N', '1234567', null, 'A'],
    ['EIN3643', 'EGBB', '13:10', 'EIN3644', 'EGBB', '14:00', 'AT76', '1234567', null, 'C'],
    ['EIN3653', 'EGPH', '13:15', 'EIN3656', 'EGPH', '15:20', 'AT76', '1234567', null, 'C'],
    ['EIN3673', 'EGNM', '13:15', 'EIN3676', 'EGNM', '14:50', 'AT76', '1234567', null, 'C'],
    ['EZY28', 'EGBB', '13:25', 'EZY29', 'EGBB', '14:35', 'A20N', '1234567', null, 'A'],
    ['EZY90', 'EGCC', '13:30', 'EZY91', 'EGCC', '15:00', 'A20N', '1234567', null, 'A'],
    ['CFE8756', 'EGLL', '13:30', 'CFE8757', 'EGLL', '14:35', 'E190', '1234567', null, 'C'],
    ['EIN3645', 'EGBB', '13:30', 'EIN3646', 'EGBB', '15:00', 'AT76', '1234567', null, 'C'],
    ['EZY889', 'EGKK', '13:35', 'EZY890', 'EGKK', '14:20', 'A20N', '1234567', null, 'C'],
    ['EXS362', 'LEPA', '13:45', null, null, null, 'B738', '1234567', null, 'A'],
    ['EZY3006', 'LEAL', '13:45', null, null, null, 'A320', '1234567', null, 'A'],
    ['EZY533', 'EGGP', '13:45', 'EZY534', 'EGGP', '14:20', 'A319', '1234567', null, 'C'],
    ['RUK9559', 'LEAL', '13:50', null, null, null, 'B738', '1234567', null, 'A'],
    ['EZY821', 'EGKK', '13:50', 'EZY632', 'EGKK', '15:20', 'A319', '1234567', null, 'A'],
    ['CFE1398', 'EGLL', '13:50', 'CFE1399', 'EGLL', '14:50', 'E190', '1234567', null, 'C'],
    ['EZY3052', 'EHAM', '13:55', null, null, null, 'A20N', '1234567', null, 'A'],
    ['EXS320', 'LGIR', '13:55', 'EXS321', 'LGIR', '15:25', 'A21N', '1234567', null, 'A'],
    ['EZY429', 'EGPF', '14:00', 'EZY430', 'EGPF', '15:30', 'A20N', '1234567', null, 'C'],
    ['EZY503', 'EGGP', '14:05', null, null, null, 'A319', '1234567', null, 'A'],
    ['LOG85', 'EGPD', '14:05', 'LOG86', 'EGPD', '15:35', 'E145', '1234567', null, 'C'],
    ['EIN3605', 'EGHI', '14:10', null, null, null, 'AT76', '1234567', null, 'C'],
    ['EIN3613', 'EGCC', '14:25', null, null, null, 'AT76', '1234567', null, 'C'],
    ['EXS388', 'LEMG', '14:35', null, null, null, 'B738', '1234567', null, 'A'],
    ['EZY631', 'EGKK', '14:50', null, null, null, 'A20N', '1234567', null, 'A'],
    ['EZY429', 'EGPF', '15:00', null, null, null, 'A320', '1234567', null, 'C'],
    ['LOG161', 'EGPE', '15:05', null, null, null, 'E145', '1234567', null, 'C'],
    ['EZY505', 'EGGP', '15:45', null, null, null, 'A20N', '1234567', null, 'A'],
    ['RUK157', 'EGSS', '16:00', 'RUK158', 'EGSS', '17:30', 'B38M', '1234567', null, 'A'],
    ['EIN3681', 'EGNX', '16:40', null, null, null, 'AT76', '1234567', null, 'C'],
    ['KLM949', 'EHAM', '16:45', null, null, null, 'E190', '1234567', null, 'C'],
    ['EZY331', 'EGPH', '16:50', null, null, null, 'A20N', '1234567', null, 'A'],
    ['CFE1402', 'EGLL', '16:50', null, null, null, 'E190', '1234567', null, 'C'],
    ['RUK131', 'EGSS', '17:05', null, null, null, 'B738', '1234567', null, 'A'],
    ['EXS302', 'LEAL', '17:20', null, null, null, 'B738', '1234567', null, 'A'],
    ['EIN3615', 'EGCC', '17:20', null, null, null, 'AT76', '1234567', null, 'C'],
    ['EXS378', 'GCTS', '19:00', null, null, null, 'B738', '1234567', null, 'A'],
    ['RUK159', 'EGSS', '20:35', null, null, null, 'B738', '1234567', null, 'A'],
    ['RUK191', 'EGCC', '20:35', 'RUK192', 'EGCC', '22:05', 'B38M', '1234567', null, 'A'],
    ['RUK193', 'EGCC', '21:40', null, null, null, 'B738', '1234567', null, 'A'],
    ['RUK570', 'GCRR', '23:55', null, null, null, 'B38M', '1234567', null, 'A']
  ];
  const LONG_STAY = [];
  const EXTRA = [
    { cs: 'EZY6215', t: 'A20N', k: 'ARR', o: 'LEMG', ap: 'EGAA' }, { cs: 'RYR4561', t: 'B38M', k: 'DEP', d: 'LEPA', ap: 'EGAA' }, { cs: 'EXS1866', t: 'B738', k: 'ARR', o: 'GCTS', ap: 'EGAA' },
    { cs: 'EZY6231', t: 'A320', k: 'DEP', d: 'LPFR', ap: 'EGAA' }, { cs: 'EIN3683', t: 'AT76', k: 'ARR', o: 'EGPH', ap: 'EGAC' }, { cs: 'CFE1409', t: 'E190', k: 'DEP', d: 'EGLL', ap: 'EGAC' },
    { cs: 'LOG87', t: 'E145', k: 'ARR', o: 'EGPD', ap: 'EGAC' }, { cs: 'EZY6249', t: 'A21N', k: 'DEP', d: 'GCRR', ap: 'EGAA' }, { cs: 'KLM951', t: 'E190', k: 'DEP', d: 'EHAM', ap: 'EGAC' },
    { cs: 'RYR8125', t: 'B738', k: 'ARR', o: 'LEAL', ap: 'EGAA' }
  ];
  const EXERCISES = {
    dep: { name: 'Belfast 1 · Off 25 at Aldergrove', wx: 'west', rwy: '25', sched: [{ cs: 'EZY6201', t: 'A320', k: 'DEP', d: 'EGKK', m: 0, ap: 'EGAA' }] },
    arr: { name: 'Belfast 2 · From BLACA to the ILS 22 at City', wx: 'west', rwy: '25', sched: [{ cs: 'CFE1394', t: 'E190', k: 'ARR', o: 'EGLL', m: 0, ap: 'EGAC' }] },
    mix: { name: 'Belfast 3 · Two airports, one approach', wx: 'west', rwy: '25', sched: [{ cs: 'EZY2819', t: 'A20N', k: 'ARR', o: 'EGKK', m: 0, ap: 'EGAA' },
      { cs: 'EIN3651', t: 'AT76', k: 'ARR', o: 'EGPH', m: 0, ap: 'EGAC' }, { cs: 'EZY6233', t: 'A320', k: 'DEP', d: 'EGGD', m: 0, ap: 'EGAA' }, { cs: 'CFE1395', t: 'E190', k: 'DEP', d: 'EGLL', m: 0, ap: 'EGAC' }] }
  };
  const WX_PRESETS = {
    west:  { name: 'South-westerly: runway 25 at Aldergrove, 22 at City', short: 'Westerly',  metar: 'EGAA 021250Z 24012KT 9999 FEW022 SCT040 11/07 Q1014' },
    east:  { name: 'Easterly: runway 07 at Aldergrove, 04 at City',       short: 'Easterly',  metar: 'EGAA 021250Z 07010KT 9999 SCT035 09/03 Q1028' },
    low:   { name: 'Low cloud: ILS near the minima',                      short: 'Low cloud', metar: 'EGAA 021250Z 23008KT 2000 -DZ BR OVC003 10/10 Q1009' },
    fog:   { name: 'Thick fog: below the ILS minima',                     short: 'Fog',       metar: 'EGAA 020550Z 20003KT 0300 R25/0350N FG VV001 07/07 Q1018' },
    storm: { name: 'Atlantic gale: gusty crosswind',                      short: 'Storm',     metar: 'EGAA 021250Z 20028G44KT 8000 -RA BKN010 11/09 Q0988' },
    calm:  { name: 'High pressure, light and variable',                   short: 'Calm',      metar: 'EGAA 021250Z VRB02KT 9999 FEW040 08/02 Q1031' }
  };
  const TEL = { EZY: 'Easy', RUK: 'Ryanair', RYR: 'Ryanair', EXS: 'Channex', EIN: 'Shamrock', CFE: 'Flyer', BAW: 'Speedbird', KLM: 'KLM', LOG: 'Logan' };
  const AIRLINE_ICAO = { U2: 'EZY', RK: 'RUK', FR: 'RYR', LS: 'EXS', EI: 'EIN', BA: 'CFE', CJ: 'CFE', KL: 'KLM', LM: 'LOG' };
  const AIRLINE_TYPE = { EZY: 'A320', RUK: 'B738', RYR: 'B38M', EXS: 'B738', EIN: 'AT76', CFE: 'E190', BAW: 'A320', KLM: 'E190', LOG: 'E145' };
  const TYPES = {"B38M":{"name":"737 MAX 8","wake":"M","vapp":145,"vr":150,"climb":2400,"desc":2100,"cruise":290,"span":35.9,"len":39.5,"shape":"jet"},"E190":{"name":"Embraer 190","wake":"M","vapp":128,"vr":135,"climb":2500,"desc":2000,"cruise":280,"span":28.7,"len":36.2,"shape":"jet"},"E145":{"name":"Embraer 145","wake":"M","vapp":125,"vr":130,"climb":2400,"desc":2000,"cruise":270,"span":20,"len":29.9,"shape":"jet"}};
  const PLACES = {"aberdeen":"EGPD","agadir":"GMAD","alicante":"LEAL","amsterdam":"EHAM","antalya":"LTAI","athens":"LGAV","barcelona":"LEBL","belfast":"EGAA","belfast city":"EGAC","bergerac":"LFBE","berlin":"EDDB","bilbao":"LEBB","bodrum":"LTFE","bordeaux":"LFBD","bucharest":"LROP","bydgoszcz":"EPBY","chania":"LGSA","copenhagen":"EKCH","corfu":"LGKR","cork":"EICK","dalaman":"LTBS","dublin":"EIDW","dubrovnik":"LDDU","edinburgh":"EGPH","enfidha":"DTNH","faro":"LPFR","geneva":"LSGG","gibraltar":"LXGB","girona":"LEGE","glasgow":"EGPF","gran canaria":"GCLP","guernsey":"EGJB","heraklion":"LGIR","hurghada":"HEGN","ibiza":"LEIB","inverness":"EGPE","isle of man":"EGNS","jersey":"EGJJ","kerkyra":"LGKR","knock":"EIKN","kos":"LGKO","krakow":"EPKK","krakow/balice":"EPKK","lanzarote":"GCRR","larnaca":"LCLK","lisbon":"LPPT","london":"EGLL","madrid":"LEMD","malaga":"LEMG","malta":"LMML","manchester":"EGCC","marrakech":"GMMX","milan":"LIMC","munich":"EDDM","murcia":"LEMI","newcastle":"EGNT","nice":"LFMN","palma":"LEPA","palma de mallorca":"LEPA","paphos":"LCPH","paris":"LFPG","pisa":"LIRP","porto":"LPPR","poznan":"EPPO","prague":"LKPR","preveza/lefkada":"LGPZ","reus":"LERS","rhodes":"LGRP","rome":"LIRF","sal island":"GVAC","shannon":"EINN","sharm el-sheikh":"HESH","skiathos":"LGSK","sofia":"LBSF","tenerife":"GCTS","venice":"LIPZ","verona":"LIPX","wroclaw":"EPWR","leeds/bradford":"EGNM","liverpool":"EGGP","nottingham":"EGNX","southampton":"EGHI","fuerteventura":"GCFV","cardiff":"EGFF","derry":"EGAE","london heathrow":"EGLL","london gatwick":"EGKK","london stansted":"EGSS","belfast international":"EGAA"};
  const AIRPORTS = {"EGGD":[51.3827,-2.7191,"Bristol"],"EGFF":[51.3967,-3.3433,"Cardiff"],"EGTE":[50.7344,-3.4139,"Exeter"],"EPPO":[52.4211,16.8263,"Poznań"],"EPBY":[53.0968,17.9777,"Bydgoszcz"],"LFBE":[44.8253,0.5186,"Bergerac"],"EIDW":[53.4213,-6.2701,"Dublin"],"LEMG":[36.6749,-4.4991,"Málaga"],"LPFR":[37.0144,-7.9659,"Faro"],"EPKK":[50.0777,19.7848,"Kraków"],"EGJJ":[49.2079,-2.1955,"Jersey"],"GCTS":[28.0445,-16.5725,"Tenerife South"],"LEAL":[38.2822,-0.5582,"Alicante"],"EGAA":[54.6575,-6.2158,"Belfast International"],"EPWR":[51.1027,16.8858,"Wrocław"],"EGJB":[49.435,-2.6019,"Guernsey"],"LEBL":[41.2971,2.0785,"Barcelona"],"EGPH":[55.95,-3.3725,"Edinburgh"],"EGNT":[55.0375,-1.6917,"Newcastle"],"LPPT":[38.7742,-9.1342,"Lisbon"],"EHAM":[52.3086,4.7639,"Amsterdam"],"EGPF":[55.8719,-4.4331,"Glasgow"],"EGPD":[57.2019,-2.1978,"Aberdeen"],"LBSF":[42.6967,23.4114,"Sofia"],"LEPA":[39.5517,2.7388,"Palma"],"LMML":[35.8575,14.4775,"Malta"],"LGRP":[36.4054,28.0862,"Rhodes"],"GMMX":[31.6069,-8.0363,"Marrakech"],"LEIB":[38.8729,1.3731,"Ibiza"],"GCRR":[28.9455,-13.6052,"Lanzarote"],"LCPH":[34.718,32.4857,"Paphos"],"GCLP":[27.9319,-15.3866,"Gran Canaria"],"HESH":[27.9773,34.395,"Sharm el-Sheikh"],"HEGN":[27.1783,33.7994,"Hurghada"],"LTBS":[36.7131,28.7925,"Dalaman"],"LGSA":[35.5317,24.1497,"Chania"],"LTAI":[36.8987,30.8005,"Antalya"],"GVAC":[16.7414,-22.9494,"Sal"],"LEGE":[41.901,2.7605,"Girona"],"LSGG":[46.2381,6.109,"Geneva"],"LFPG":[49.0097,2.5479,"Paris CDG"],"LIRP":[43.6839,10.3927,"Pisa"],"LIPX":[45.3957,10.8885,"Verona"],"LEBB":[43.3011,-2.9106,"Bilbao"],"LXGB":[36.1512,-5.3497,"Gibraltar"],"DTNH":[36.0758,10.4386,"Enfidha"],"LGKR":[39.6019,19.9117,"Corfu"],"LGPZ":[38.9255,20.7653,"Preveza"],"GMAD":[30.325,-9.4131,"Agadir"],"LGAV":[37.9364,23.9445,"Athens"],"LGSK":[39.1771,23.5037,"Skiathos"],"LGIR":[35.3397,25.1803,"Heraklion"],"LTFE":[37.2506,27.6643,"Bodrum"],"LGKO":[36.7933,27.0917,"Kos"],"EGPE":[57.5425,-4.0475,"Inverness"],"LKPR":[50.1008,14.26,"Prague"],"LIMC":[45.6306,8.7281,"Milan Malpensa"],"LERS":[41.1474,1.1672,"Reus"],"EIKN":[53.9103,-8.8185,"Knock"],"LEMI":[37.803,-1.125,"Murcia"],"LDDU":[42.5614,18.2682,"Dubrovnik"],"EICK":[51.8413,-8.4911,"Cork"],"LFMN":[43.6584,7.2159,"Nice"],"LEMD":[40.4983,-3.5676,"Madrid"],"LIPZ":[45.5053,12.3519,"Venice"],"LROP":[44.5711,26.085,"Bucharest"],"EDDM":[48.3538,11.7861,"Munich"],"EDDB":[52.3667,13.5033,"Berlin"],"LFBD":[44.8283,-0.7156,"Bordeaux"],"EKCH":[55.6181,12.6561,"Copenhagen"],"LIRF":[41.8003,12.2389,"Rome"],"LPPR":[41.2481,-8.6814,"Porto"],"EGLL":[51.47,-0.4543,"London Heathrow"],"LCLK":[34.8751,33.6249,"Larnaca"],"EGKK":[51.1481,-0.1903,"London Gatwick"],"EGCC":[53.3537,-2.275,"Manchester"],"EGSS":[51.885,0.235,"London Stansted"],"EGHH":[50.78,-1.8425,"Bournemouth"],"EGBB":[52.4539,-1.748,"Birmingham"],"EGAC":[54.6181,-5.8725,"Belfast City"],"EGNS":[54.0833,-4.6239,"Isle of Man"],"EINN":[52.702,-8.9248,"Shannon"],"EGNM":[53.8659,-1.6606,"Leeds Bradford"],"EGGP":[53.3336,-2.8497,"Liverpool"],"EGNX":[52.8311,-1.3281,"East Midlands"],"EGHI":[50.9503,-1.3568,"Southampton"],"GCFV":[28.4527,-13.8638,"Fuerteventura"],"EGAE":[55.0428,-7.1611,"Derry"]};

  return {
    icao: 'EGAA', icaoAlt: 'EGAC', iata: 'BFS', name: 'Belfast', city: 'Belfast', country: 'United Kingdom',
    airfields: {
      EGAA: { name: 'Belfast International (Aldergrove)', iata: 'BFS', arp: P('543927N', '0061257W'), elev: 268, rwys: RWYS.EGAA },
      EGAC: { name: 'Belfast City (George Best)',         iata: 'BHD', arp: P('543705N', '0055221W'), elev: 15,  rwys: RWYS.EGAC }
    },
    VAR, from, FIX, NAV, HOLDS_AIR, ILS, RNP07, STARS, STAR_ALT, APP_SPEEDS, RWY_USE, DEP_ROUTES, DEP_ROUTES_EGAC, DEP_RULES, DEP_PTS, SIDS, fin, off, DIR, PLACE_DIR, dirFor, UNITS, TA, TZ, ALTERNATES,
    TIMETABLE, LONG_STAY, EXTRA, EXERCISES, WX_PRESETS, TEL, AIRLINE_ICAO, AIRLINE_TYPE, TYPES, PLACES, AIRPORTS,
    data: { metar: 'egaa/metar.txt', flights: 'egaa/flights.json' },
    features: { dualAirport: true, roadCrossing: false, sra: true, ils: true, rnavSids: false, singleRunway: false, mixedMode: true }
  };
})();
if (typeof module !== 'undefined') module.exports = EGAA;
