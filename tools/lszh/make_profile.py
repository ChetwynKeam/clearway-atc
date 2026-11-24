#!/usr/bin/env python3
"""src/airports/lszh.js from the Jeppesen Zurich trip kit (cycle 07-2023, in the user's folder) and the real Zurich boards.
Inputs: known.json (fix positions: openscope's LSZH airport file and the game's airway data), chartfix2.json (the RNAV
points read off the Jeppesen SID/STAR charts by georeferencing each chart on its known fixes: chart_fixes.py), the points
worked out here from the charts' radial/DME and track descriptions, the avionio ZRH boards (boards-2026-11-23.json, a whole
Monday), places.py, and lszh.template.js (the hand-written parts: runways, procedures, units, the operating concepts).
usage: make_profile.py boards-2026-11-23.json > src/airports/lszh.js"""
import json, math, re, sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from places import AP, place_icao
K = json.load(open(os.path.join(HERE, 'known.json'))); C = json.load(open(os.path.join(HERE, 'chartfix2.json')))
ARP = (47.458, 8.548)
VAR = 3                                                     # magnetic variation 3°E (Jeppesen 2023): true = magnetic + 3
def dest(p, brg_true, nm):
    la, lo = map(math.radians, p); b = math.radians(brg_true); d = nm/3440.065
    la2 = math.asin(math.sin(la)*math.cos(d) + math.cos(la)*math.sin(d)*math.cos(b))
    lo2 = lo + math.atan2(math.sin(b)*math.sin(d)*math.cos(la), math.cos(d) - math.sin(la)*math.sin(la2))
    return (round(math.degrees(la2), 5), round(math.degrees(lo2), 5))
def brg(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    y = math.sin(lo2 - lo1)*math.cos(la2); x = math.cos(la1)*math.sin(la2) - math.sin(la1)*math.cos(la2)*math.cos(lo2 - lo1)
    return (math.degrees(math.atan2(y, x)) + 360) % 360
def nm(a, b): return math.hypot((a[0] - b[0])*60, (a[1] - b[1])*60*math.cos(math.radians(a[0])))
def ang(a, b): return abs((a - b + 180) % 360 - 180)

# ── fixes: the known ones (openscope, airways), the chart-read RNAV points, and those worked out from the charts' wording
F = {}
for k, v in K.items(): F[k] = tuple(v)
for k, v in C.items():
    if k not in F and re.fullmatch(r'ZH\d{3}|[A-Z]{5}', k) and (v[2] >= 2 and v[3] < 1.0 or v[2] == 1): F[k] = (v[0], v[1])
KLO = F['KLO']; ZUE = F['ZUE']; WIL = F['WIL']; TRA = F['TRA']
R = lambda radial, d, frm=None: dest(frm or KLO, radial + VAR, d)          # radial (magnetic) and DME from a VOR
# runway ends (pavement) and thresholds (OpenStreetMap; lsszh_ground.py), departure courses (true)
RW = {'10': ((47.458939, 8.537479), (47.456599, 8.570453)), '28': ((47.456599, 8.570453), (47.458939, 8.537479)),
      '14': ((47.481148, 8.537356), (47.461291, 8.564461)), '32': ((47.461291, 8.564461), (47.483075, 8.534723)),
      '16': ((47.475713, 8.535937), (47.445562, 8.556699)), '34': ((47.449276, 8.554143), (47.475713, 8.535937))}
CRS = {k: brg(a, b) for k, (a, b) in RW.items()}
def at_dme(rw, d):
    """the point on the runway's departure track (from its far end) d NM from KLO"""
    a, b = RW[rw]; c = CRS[rw]; t = 0.0
    while nm(dest(b, c, t), KLO) < d and t < 20: t += 0.02
    return dest(b, c, t)
def along(rw, n):   # n NM along the extended centreline before the threshold (approach side)
    a, b = RW[rw]; return dest(a, (CRS[rw] + 180) % 360, n)
# the 28, 16, 10, 32 and 34 SIDs' first legs, as the charts describe them (hidden points ZDxxN in the game)
F['ZD28A'] = at_dme('28', 2.3)                                # 28: straight ahead to D2.3 KLO
F['ZH552'] = R(252, 6.5)                                      # DEGES 3W: at ZH552 / D6.5 KLO on R252 turn left
F['ZD28B'] = R(231, 4.5)                                      # ... intercept KLO R231 inbound to KLO
F['ZD16A'] = dest(RW['16'][1], CRS['16'], 0.9)                # 16: straight ahead, at 2,000 ft but not before D1.0 KLO
F['ZD16B'] = R(110, 3.5)                                      # 16 left turn: east, then north across KLO R360 at 4,000 ft
F['ZD16C'] = R(25, 3.5)
F['ZD16D'] = R(330, 3.0)                                      # ... and on south-west to BREGO (WIL R053 inbound)
F['ZD10A'] = at_dme('10', 2.1)                                # 10: straight ahead to D2.1 KLO
F['ZD10B'] = R(55, 3.6)                                       # 10 left turn round to the north, KLO R360 at 4,000 ft
F['ZD10C'] = R(345, 3.2)
F['ZD32A'] = at_dme('32', 2.0)                                # 32: to D2.0 KLO, right onto 329 track to D4.0 KLO
F['ZD32B'] = dest(F['ZD32A'], 329 + VAR, 2.0)
F['ZD34A'] = at_dme('34', 4.0)                                # 34: 332 track to D4.0 KLO
F['ZD32C'] = dest(F['ZD32B'], 244 + VAR, 3.0)                 # GERSA 1N/1H: left, 244 track to TRA R190
F['ZD34C'] = dest(F['ZD34A'], 244 + VAR, 3.0)
F['ZH580'] = dest(RW['32'][1], 327 + VAR, 2.4)                # VEBIT 4N: 327 track to ZH580 (3,500 ft at 14.6 %)
F['ZH570'] = dest(RW['34'][1], 331 + VAR, 2.2)                # VEBIT 4H: 331 track to ZH570
F['ZH577'] = dest(F['ZH580'], 241 + VAR, 3.5)                 # ... left, 241 track to ZH577, then BREGO
# ZH503: where the DEGES 4N/4H, coming right off the 329/332 track at D4.0 KLO, join ZUE R254 inbound
F['ZH503'] = R(254, 11.0, ZUE)
# the approaches: intermediate fixes and final approach fixes (Jeppesen 11-1 to 11-4)
F['ZH413'] = along('14', 12.0); F['OSNEM'] = along('14', 8.0)    # ILS 14: OSNEM D8.2 IKL, 4,000 ft
F['ZH712'] = R(315, 11.5); F['ENUSO'] = along('16', 7.9)         # ILS 16: ZH712 D11.5 KLO R315, ENUSO D8.2 IZH
if 'ZH703' not in F: F['ZH703'] = R(93, 16.0)
if 'ZH726' not in F: F['ZH726'] = R(152, 16.0)
if 'RAMEM' not in F: F['RAMEM'] = along('28', 10.0)
F['EDUMI'] = F.get('EDUMI', R(359, 16.0))

SID_PTS = {
    # runway 28 (the W set: RNAV 5, the ones in daily use): DEGES over the field via R231, GERSA and VEBIT via BREGO
    'DEGES3W': ('28', ['ZD28A', 'ZH552', 'ZD28B', 'KLO', 'MOMOL', 'KOLUL', 'ZH504', 'ZH525', 'DEGES']),
    'GERSA2W': ('28', ['ZD28A', 'BREGO', 'ZH556', 'ZH557', 'AFOLT', 'ARTAG', 'GERSA']),
    'VEBIT4W': ('28', ['ZD28A', 'BREGO', 'ZH554', 'ZH558', 'VEBIT']),
    # runway 16 (the S set): the left turn east, then DEGES by R084 or round to the north and west to BREGO
    'DEGES3S': ('16', ['ZD16A', 'ZH502', 'KOLUL', 'ZH504', 'ZH525', 'DEGES']),
    'GERSA2S': ('16', ['ZD16A', 'ZD16B', 'ZD16C', 'ZD16D', 'BREGO', 'ZH556', 'ZH557', 'AFOLT', 'ARTAG', 'GERSA']),
    'VEBIT4S': ('16', ['ZD16A', 'ZD16B', 'ZD16C', 'ZD16D', 'BREGO', 'ZH554', 'ZH558', 'VEBIT']),
    # runway 32 (the N set)
    'DEGES4N': ('32', ['ZD32A', 'ZD32B', 'ZH503', 'ZH506', 'KOLUL', 'ZH504', 'ZH525', 'DEGES']),
    'GERSA1N': ('32', ['ZD32A', 'ZD32B', 'ZD32C', 'BREGO', 'ZH556', 'ZH557', 'AFOLT', 'ARTAG', 'GERSA']),
    'VEBIT4N': ('32', ['ZH580', 'ZH577', 'BREGO', 'ZH554', 'ZH558', 'VEBIT']),
    # runway 34 (the H set)
    'DEGES4H': ('34', ['ZD34A', 'ZH503', 'ZH506', 'KOLUL', 'ZH504', 'ZH525', 'DEGES']),
    'GERSA1H': ('34', ['ZD34A', 'ZD34C', 'BREGO', 'ZH556', 'ZH557', 'AFOLT', 'ARTAG', 'GERSA']),
    'VEBIT4H': ('34', ['ZH570', 'ZH577', 'BREGO', 'ZH554', 'ZH558', 'VEBIT']),
    # runway 10 (the E set, with bise)
    'DEGES2E': ('10', ['ZD10A', 'ZH502', 'KOLUL', 'ZH504', 'ZH525', 'DEGES']),
    'GERSA1E': ('10', ['ZD10A', 'ZD10B', 'ZD10C', 'BREGO', 'ZH556', 'ZH557', 'AFOLT', 'ARTAG', 'GERSA']),
    'VEBIT3E': ('10', ['ZD10A', 'ZD10B', 'ZD10C', 'BREGO', 'ZH554', 'ZH558', 'VEBIT']),
}
NATO = dict(A='Alfa', B='Bravo', C='Charlie', D='Delta', E='Echo', F='Foxtrot', G='Golf', H='Hotel', J='Juliett', K='Kilo', L='Lima', M='Mike', N='November',
            P='Papa', Q='Quebec', R='Romeo', S='Sierra', T='Tango', U='Uniform', V='Victor', W='Whiskey', X='X-ray', Y='Yankee', Z='Zulu')
NUM = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
def spoken(name):
    m = re.match(r'^([A-Z]+) ?(\d)([A-Z])$', name)
    w = {'BLM': 'Basel-Mulhouse', 'TRA': 'Trasadingen', 'WIL': 'Willisau'}.get(m[1], m[1].title())
    return f'{w} {NUM[int(m[2])]} {NATO[m[3]]}'
STARS = {
    'BLM3G':   (['BLM', ['ZH677', 12000], ['GIPOL', 7000]], 'GIPOL'),
    'BERSU2G': (['BERSU', 'TADOB', ['ERMUS', 8000], ['GIPOL', 7000]], 'GIPOL'),
    'DOPIL2G': (['DOPIL', 'NOLKA', ['ERMUS', 8000], ['GIPOL', 7000]], 'GIPOL'),
    'KELIP3G': (['KELIP', ['MOSIT', 14000], ['ZH628', 10000], 'ZH627', 'ZH501', ['GIPOL', 7000]], 'GIPOL'),
    'WIL3Z':   (['WIL', ['GIPOL', 7000]], 'GIPOL'),
    'NEGRA2A': (['NEGRA', 'MATIV', ['AMIKI', 7000]], 'AMIKI'),
    'TRA2A':   (['TRA', ['AMIKI', 7000]], 'AMIKI'),
    'RILAX':   ([['RILAX', 7000]], 'RILAX'),
}
for n, (pts, iaf) in STARS.items():
    for p in pts:
        f = p if isinstance(p, str) else p[0]
        assert f in F, (n, f)
for n, (rw, pts) in SID_PTS.items():
    for f in pts: assert f in F, (n, f)

# ── traffic: the real boards, paired (as tools/eham/make_profile.py): each arrival with a later departure of the same
# airline to the same place (35-200 minutes on the ground; 60-300 for long haul), the rest as single movements
ICAO = {'LX': 'SWR', 'WK': 'EDW', 'EW': 'EWG', 'LH': 'DLH', 'OS': 'AUA', 'BA': 'BAW', 'KL': 'KLM', 'BT': 'BTI', '2L': 'OAW', 'EC': 'EJU', 'SN': 'BEL',
        'U2': 'EZY', 'SK': 'SAS', 'AF': 'AFR', 'TK': 'THY', 'IB': 'IBE', 'TP': 'TAP', 'UA': 'UAL', 'EY': 'ETD', 'CJ': 'CFE', 'DE': 'CFG', 'VY': 'VLG',
        'JU': 'ASL', 'LO': 'LOT', 'AY': 'FIN', 'PC': 'PGT', 'UX': 'AEA', 'AZ': 'ITY', 'OU': 'CTN', 'A3': 'AEE', 'EK': 'UAE', 'EN': 'DLA', 'SA': 'SAA',
        'ET': 'ETH', 'TG': 'THA', 'CX': 'CPA', 'SQ': 'SIA', 'AA': 'AAL', 'AC': 'ACA', 'EI': 'EIN', 'DL': 'DAL', 'DS': 'EZS', 'LY': 'ELY', 'FI': 'ICE',
        'LS': 'EXS', 'XQ': 'SXS', 'MS': 'MSR', 'VF': 'TKJ', 'QR': 'QTR', 'SV': 'SVA', 'KM': 'KMM', 'B6': 'JBU', 'LG': 'LGL', 'FR': 'RYR', 'W6': 'WZZ',
        'GQ': 'SEH', 'AT': 'RAM', 'ME': 'MEA', 'RJ': 'RJA', 'KE': 'KAL', 'NH': 'ANA', 'CA': 'CCA', 'AI': 'AIC', 'HU': 'CHH', 'JL': 'JAL'}
SHORT = {'SWR': ['A320', 'BCS3', 'A20N', 'A321', 'BCS1', 'A21N', 'A320', 'BCS3'], 'EDW': ['A320', 'A20N'], 'EWG': ['A319', 'A320', 'A20N'],
         'DLH': ['A20N', 'A321', 'CRJ9'], 'AUA': ['A320', 'E195', 'A20N'], 'BAW': ['A320', 'A20N', 'A321'], 'KLM': ['E295', 'B738', 'E195'],
         'BTI': ['BCS3'], 'OAW': ['E295', 'E190'], 'EJU': ['A320', 'A20N'], 'BEL': ['A320', 'A319'], 'EZY': ['A320', 'A20N'], 'SAS': ['A20N'],
         'AFR': ['A20N', 'A320'], 'THY': ['A321', 'A21N', 'B38M'], 'IBE': ['A20N', 'A320'], 'TAP': ['A20N', 'A320'], 'CFE': ['E190'], 'CFG': ['A20N', 'A321'],
         'VLG': ['A320'], 'ASL': ['A320'], 'LOT': ['E195', 'B38M'], 'FIN': ['A320', 'A321'], 'PGT': ['A20N'], 'AEA': ['B738'], 'ITY': ['A20N'],
         'CTN': ['A20N', 'DH8D'], 'AEE': ['A20N'], 'DLA': ['E195'], 'EIN': ['A20N'], 'EZS': ['A320', 'A20N'], 'ELY': ['B738'], 'ICE': ['B38M'],
         'EXS': ['A21N'], 'SXS': ['B38M'], 'MSR': ['A20N'], 'TKJ': ['B38M'], 'KMM': ['A20N'], 'LGL': ['E295', 'DH8D'], 'RYR': ['B738'], 'WZZ': ['A21N'],
         'SEH': ['A20N'], 'RAM': ['B738'], 'MEA': ['A21N'], 'RJA': ['A320']}
LONG = {'SWR': {'*': ['A333', 'B77W', 'A343', 'A359'], 'KJFK': 'B77W', 'KEWR': 'A333', 'KLAX': 'B77W', 'KSFO': 'B77W', 'VHHH': 'B77W', 'WSSS': 'B77W',
                'VTBS': 'B77W', 'ZSPD': 'B77W', 'RJTT': 'B77W', 'KMIA': 'B77W', 'SBGR': 'B77W', 'VABB': 'A333', 'VIDP': 'A333', 'KBOS': 'A333', 'CYUL': 'A333',
                'FAJS': 'B77W', 'OMDB': 'A333', 'KORD': 'B77W', 'KIAD': 'A333', 'HECA': 'A21N', 'LLBG': 'A21N', 'OLBA': 'A320', 'OJAI': 'A320'},
        'EDW': {'*': ['A359', 'A343']}, 'UAL': {'*': 'B763'}, 'ETD': {'*': 'B789'}, 'UAE': {'*': 'A388'}, 'SAA': {'*': 'A359'}, 'ETH': {'*': 'B788'},
        'THA': {'*': 'B77W'}, 'CPA': {'*': 'A359'}, 'SIA': {'*': 'A359'}, 'AAL': {'*': 'B788'}, 'ACA': {'*': 'B789'}, 'DAL': {'*': 'A333'},
        'QTR': {'*': 'B77W'}, 'SVA': {'*': 'A333'}, 'JBU': {'*': 'A21N'}, 'KAL': {'*': 'B77W'}, 'ANA': {'*': 'B789'}, 'CCA': {'*': 'A333'},
        'AIC': {'*': 'B788'}, 'CHH': {'*': 'B789'}, 'JAL': {'*': 'B789'}, 'THY': {'*': 'A21N'}, 'ELY': {'*': 'B738'}, 'MSR': {'*': 'A20N'}}
def is_long(icao): return icao[0] in 'KCMSTRZVWOFDHPNUY' and not icao.startswith(('GC', 'GM', 'GV', 'HE', 'DT', 'OJ', 'OL', 'LL', 'OM')) or icao.startswith(('OM', 'OT', 'OE', 'OB', 'OK'))
def hm(s): h, m = s.split(':'); return int(h)*60 + int(m)
def hh(m): return '%02d:%02d' % (m // 60 % 24, m % 60)
def rows(path):
    days = json.load(open(path))['days']; d0 = days['2026-11-23']; off = d0['utcOffsetMin']
    def conv(r):
        m = re.match(r'^([A-Z0-9]{2})(\d+[A-Z]?)$', r['flight'])
        if not m: return None
        a, n = m[1], m[2]; al = ICAO.get(a); place = place_icao(r['place'], a)
        if not al or not place or place not in AP: return None
        k = int(re.sub(r'\D', '', n) or 0)
        if (is_long(place) or place in LONG.get(al, {})) and al in LONG:
            L = LONG[al]; t = L.get(place) or L['*']
            if isinstance(t, list): t = t[k % len(t)]
        else: T = SHORT.get(al, ['A320']); t = T[k % len(T)]
        return dict(cs=al + n, al=al, t=t, place=place, tm=(hm(r['sched']) - off) % 1440)
    A = [x for x in map(conv, d0['arr']) if x]; D = [x for x in map(conv, d0['dep']) if x]
    seen = set(); A = [x for x in A if not (x['cs'] in seen or seen.add(x['cs']))]; seen = set(); D = [x for x in D if not (x['cs'] in seen or seen.add(x['cs']))]
    out, used = [], set()
    for a in sorted(A, key=lambda x: x['tm']):
        lo, hi = (60, 300) if is_long(a['place']) else (30, 200)
        c = [x for x in D if x['cs'] not in used and x['al'] == a['al'] and x['place'] == a['place'] and lo <= (x['tm'] - a['tm']) % 1440 <= hi]
        if c:
            x = min(c, key=lambda x: (x['tm'] - a['tm']) % 1440); used.add(x['cs']); out.append([a['cs'], a['place'], hh(a['tm']), x['cs'], x['place'], hh(x['tm']), a['t'], '1234567', None])
        else: out.append([a['cs'], a['place'], hh(a['tm']), None, None, None, a['t'], '1234567', None])
    for x in D:
        if x['cs'] not in used: out.append([None, None, None, x['cs'], x['place'], hh(x['tm']), x['t'], '1234567', None])
    out.sort(key=lambda r: hm(r[2] or r[5]))
    return out
TT = rows(sys.argv[1])
print('timetable rows', len(TT), 'movements', sum((r[0] is not None) + (r[3] is not None) for r in TT), file=sys.stderr)
# the capacity modes through the day from the boards themselves: each hour (local) an inbound wave (L: the second
# landing runway open) where the arrivals outnumber the departures by half again, an outbound wave (S) the other way
def loc(t): return (hm(t) + 60) % 1440       # UTC to Zurich winter time (the boards' day is 23 November)
bins = {}
for r in TT:
    if r[2]: bins.setdefault(loc(r[2])//60, [0, 0])[0] += 1
    if r[5]: bins.setdefault(loc(r[5])//60, [0, 0])[1] += 1
peaks = []   # by the hour, so the second runway opens and closes no more often than that
for b in range(6, 24):
    a, d = bins.get(b, [0, 0]); m = 'L' if a >= 12 and a >= 1.4*d else 'S' if d >= 12 and d >= 1.4*a else 'O'
    if peaks and peaks[-1][2] == m and peaks[-1][1] == b*60: peaks[-1][1] = (b + 1)*60
    else: peaks.append([b*60, (b + 1)*60, m])
peaks_js = ', '.join(f"[hm({a//60}, {a%60}), hm({b//60}, {b%60}), '{m}']" for a, b, m in peaks)
print('peaks', peaks, file=sys.stderr)
used_ap = sorted({r[1] for r in TT if r[1]} | {r[4] for r in TT if r[4]} | {'LSZH', 'LSGG', 'LSZB', 'LFSB', 'EDDS', 'EDDM', 'EDDF', 'LIMC', 'EGLL', 'KLAX', 'LEPA', 'KJFK', 'EGGD', 'LFPG', 'EDDB'} & set(AP))

# ── gates: one per STAR (its entry fix), bearing from the field
GATES = {}
for n, (pts, iaf) in STARS.items():
    e = pts[0] if isinstance(pts[0], str) else pts[0][0]
    GATES[e] = dict(c=round(brg(ARP, F[e])), entry=e, star=n)
# RILAX's own gate: arrivals from the north fly the airway to RILAX; the entry is laid out 25 NM up it (hidden)
F['ZRILN'] = dest(F['RILAX'], 355, 25); GATES['RILAX']['entry'] = 'ZRILN'; STARS['RILAX'] = ([['ZRILN'], ['RILAX', 7000]], 'RILAX')
def gate_of(b): return min(GATES, key=lambda g: ang(GATES[g]['c'], b))
USED = set()
for pts, iaf in STARS.values(): USED |= {p if isinstance(p, str) else p[0] for p in pts}
for rw, pts in SID_PTS.values(): USED |= set(pts)
USED |= {'ZH413', 'OSNEM', 'ZH712', 'ENUSO', 'ZH703', 'RAMEM', 'ZH726', 'MILNI', 'UTIXO', 'EDUMI', 'ZUE', 'KLO', 'WIL', 'TRA', 'BLM', 'AMIKI', 'GIPOL', 'RILAX'}
NAVS = {'KLO': ('Kloten VOR/DME', '114.85'), 'ZUE': ('Zurich East VOR/DME', '110.05'), 'WIL': ('Willisau VOR/DME', '116.90'),
        'TRA': ('Trasadingen VOR/DME', '114.30'), 'BLM': ('Basel-Mulhouse VOR/DME', '115.35')}
fixes = sorted(k for k in USED if k not in NAVS)
fix_js = ',\n    '.join(', '.join(f"{k}: [{F[k][0]:.5f}, {F[k][1]:.5f}]" for k in fixes[i:i+5]) for i in range(0, len(fixes), 5))
nav_js = ',\n    '.join(f"{k}: {{ p: [{F[k][0]:.5f}, {F[k][1]:.5f}], name: '{v[0]}', freq: '{v[1]}' }}" for k, v in NAVS.items())
def js(o): return json.dumps(o, separators=(', ', ': ')).replace('"', "'")
star_js = ',\n    '.join(f"'{k}': {{ name: '{k}', spoken: '{spoken(k) if k != 'RILAX' else 'Rilax'}', iaf: '{iaf}', level: 7000, pts: {js([[p] if isinstance(p, str) else p for p in pts])} }}" for k, (pts, iaf) in STARS.items())
sid_js = ',\n    '.join(f"'{k}': {{ rwy: '{rw}', spoken: '{spoken(k)}', pts: {js(pts)}, top: 5000 }}" for k, (rw, pts) in SID_PTS.items())
dir_js = ',\n    '.join(f"\"{g}\": {{ brg: {d['c']}, entry: '{d['entry']}', star: '{d['star']}' }}" for g, d in GATES.items())
tt_js = ',\n    '.join(js(r) for r in TT)
ap_js = ', '.join(f"{k}: [{AP[k][0]}, {AP[k][1]}, {json.dumps(AP[k][2], ensure_ascii=False)}]" for k in used_ap)
pd_js = ', '.join(f"{k}: \"{gate_of(brg(ARP, AP[k][:2]))}\"" for k in used_ap if k != 'LSZH')
sidx = {e: round(brg(ARP, F[e])) for e in ('DEGES', 'GERSA', 'VEBIT')}
sx_js = ', '.join(f"{k}: {v}" for k, v in sidx.items())
pl = {}
for r in TT:
    for k in (r[1], r[4]):
        if k: pl[AP[k][2].lower()] = k
pl_js = ', '.join(f"{json.dumps(k, ensure_ascii=False)}: '{v}'" for k, v in sorted(pl.items()))
T = open(os.path.join(HERE, 'lszh.template.js')).read()
for k, v in {'@@FIX@@': fix_js, '@@NAV@@': nav_js, '@@STARS@@': star_js, '@@SIDS@@': sid_js, '@@DIRS@@': dir_js, '@@TIMETABLE@@': tt_js, '@@AIRPORTS@@': ap_js,
             '@@PLACES@@': pl_js, '@@PLACE_DIR@@': pd_js, '@@SID_BRG@@': sx_js, '@@NROWS@@': str(len(TT)), '@@PEAKS@@': peaks_js}.items():
    assert k in T, k; T = T.replace(k, v)
sys.stdout.write(T)
