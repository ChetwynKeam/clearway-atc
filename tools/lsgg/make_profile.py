#!/usr/bin/env python3
"""Writes src/airports/lsgg.js (the Geneva profile) from the chart-derived fixes (fixes_nm.json) plus hand-entered procedure data.
usage: python3 tools/lsgg/make_profile.py <bris.json: AIRPORTS/PLACES dumped from eggd.js> > src/airports/lsgg.js"""
import json, math, sys, random, os
HERE = os.path.dirname(os.path.abspath(__file__))
bris = json.load(open(sys.argv[1]))
nm = json.load(open(os.path.join(HERE, 'fixes_nm.json')))
nm.pop('ROCCA_a', None); nm.pop('ROCCA_b', None)

# runway: OSM ends (04 pavement end, 22 end), 04 threshold displaced 343 m
A = (46.2278299, 6.093929); B = (46.2504045, 6.1270817)
lat0 = (A[0] + B[0]) / 2; lon0 = (A[1] + B[1]) / 2
def en(lat, lon): return ((lon - lon0) * 60 * math.cos(math.radians(lat0)), (lat - lat0) * 60)   # NM
def ll(e, n): return (lat0 + n / 60, lon0 + e / (60 * math.cos(math.radians(lat0))))
def rot(p, a=-1.05):
    r = math.radians(a); c, s = math.cos(r), math.sin(r); return (p[0] * c + p[1] * s, -p[0] * s + p[1] * c)
def mv(p, b, d): r = math.radians(b); return (p[0] + d * math.sin(r), p[1] + d * math.cos(r))
a, b = en(*A), en(*B)
trk = (math.degrees(math.atan2(b[0] - a[0], b[1] - a[1])) + 360) % 360       # 04 -> 22 direction, true
thr22 = b; thr04 = mv(a, trk, 343 / 1852)
F = {k: rot(v) for k, v in nm.items()}
# fixes computed from the charts' distances: the ILS fixes on the extended centrelines (DME zero at each threshold), the
# STAR chain from VADAR (chart bearings are magnetic: variation ~3 E)
F['INDIS'] = mv(thr04, trk + 180, 17.6); F['BELKA'] = mv(thr04, trk + 180, 14.4); F['GG852'] = mv(thr22, trk, 7)
F['GG808'] = mv(thr22, trk, 8.3); F['GG803'] = mv(a, trk + 180, 5)
V = 3.0
def chain(p, legs):
    for n, br, d in legs:
        p = mv(p, br + V, d); F[n] = p
chain(F['VADAR'], [('GG514', 245, 18.2), ('SOVAD', 223, 17.4), ('KERAD', 222, 8.7)])
F['GG503'] = mv(F['INDIS'], 133 + V, -6)
def P(n): lat, lon = ll(*F[n]); return "[%.5f, %.5f]" % (lat, lon)

# ── STARs: fixes in flying order (the engine adds the ILS intermediate fix)
STARS = {
    # runway 22 (ends at SAPRE, the ILS 22 intermediate fix)
    'BANKO 3R': ('22', 'SE', ['BANKO', 'GG520', 'GOLEB', 'VALBU', 'SUVEL', 'BIVLO', 'GG525', 'GG512', 'SAPRE']),
    'BELUS 3R': ('22', 'SW', ['BELUS', 'RILTI', 'CBY', 'GG502', 'PITOM', 'BIVLO', 'GG525', 'GG512', 'SAPRE']),
    'KINES 2R': ('22', 'S', ['KINES', 'GG519', 'ROCCA', 'BIVLO', 'GG525', 'GG512', 'SAPRE']),
    'BENOT 2R': ('22', 'NE', ['BENOT', 'NEMOS', 'VADAR', 'SAPRE']),
    'FRIBU 1R': ('22', 'N', ['FRIBU', 'VADAR', 'SAPRE']),
    'ULMES 2R': ('22', 'E', ['ULMES', 'ESEVA', 'VADAR', 'SAPRE']),
    # runway 04 (ends at GG502 or GG503, then to INDIS)
    'BANKO 3N': ('04', 'SE', ['BANKO', 'GG520', 'GOLEB', 'VALBU', 'SUVEL', 'BIVLO', 'PITOM', 'GG502']),
    'BELUS 4N': ('04', 'SW', ['BELUS', 'RILTI', 'CBY', 'GG502']),
    'KINES 2N': ('04', 'S', ['KINES', 'GG519', 'ROCCA', 'BIVLO', 'PITOM', 'GG502']),
    'BENOT 1N': ('04', 'NE', ['BENOT', 'NEMOS', 'GG514', 'SOVAD', 'KERAD', 'GG503']),
    'FRIBU 1P': ('04', 'N', ['FRIBU', 'VADAR', 'GG512', 'BIVLO', 'PITOM', 'GG502']),
    'ULMES 1N': ('04', 'E', ['ULMES', 'ESEVA', 'VADAR', 'GG514', 'SOVAD', 'KERAD', 'GG503']),
}
LEVELS = {'BANKO': 14000, 'BELUS': 14000, 'KINES': 14000, 'BENOT': 15000, 'FRIBU': 15000, 'ULMES': 15000, 'GG520': 12000, 'GOLEB': 11000, 'NEMOS': 13000,
          'VADAR': 11000, 'ESEVA': 13000, 'CBY': 11000, 'ROCCA': 11000, 'BIVLO': 9000, 'SAPRE': 7000, 'GG512': 8000, 'GG525': 8500, 'GG514': 10000, 'KERAD': 8000,
          'GG503': 7000, 'GG502': 7000, 'PITOM': 8000, 'SOVAD': 9000}
def star_js(name, rw, g, pts):
    return "    '%s': { rwy: '%s', from: '%s', pts: [%s] }" % (name, rw, g, ', '.join("['%s'%s]" % (p, ', %d' % LEVELS[p] if p in LEVELS else '') for p in pts))
STAR_JS = ',\n'.join(star_js(n, *v) for n, v in STARS.items())
GATE_STAR = {}
for n, (rw, g, pts) in STARS.items(): GATE_STAR.setdefault(g, {})[rw] = (n, pts[0])

# ── SIDs: [rwy, spoken, turn, [(fix, alt)...]]  T04/T22 = the climb-out turn points (hidden)
SIDS = {
    'ARBOS1N': ('04', 'Arbos One November', 'L', ['T04', 'GG608', 'LEGVO', 'LIKIQ', 'ARBOS']),
    'SIROD1N': ('04', 'Sirod One November', 'L', ['T04', 'KOVIM', 'SIROD']),
    'SOSAL1N': ('04', 'Sosal One November', 'R', ['T04', 'TINAM', 'SOSAL']),
    'SAPRE1N': ('04', 'Sapre One November', 'R', ['T04', 'SAPRE']),
    'MEDAM1N': ('04', 'Medam One November', 'R', ['T04', 'GG604', 'ALPOZ', 'VANAS', 'MEDAM']),
    'ROCCA1N': ('04', 'Rocca One November', 'R', ['T04', 'GG604', 'ALPOZ', 'ROCCA']),
    'BALSI1N': ('04', 'Balsi One November', 'R', ['T04', 'GG604', 'ODIKI', 'BALSI']),
    'CBY2N':   ('04', 'Charlie Bravo Yankee Two November', 'L', ['T04', 'GG603', 'GG618', 'CBY']),
    'DEPUL1P': ('04', 'Depul One Papa', 'L', ['T04', 'GG603', 'GG611', 'DEPUL']),
    'DIPIR1A': ('22', 'Dipir One Alfa', 'R', ['T22', 'KELUK', 'DIPIR']),
    'KONIL1R': ('22', 'Konil One Romeo', 'L', ['T22', 'DEREM', 'KONIL']),
    'SOSAL1R': ('22', 'Sosal One Romeo', 'L', ['T22', 'DEREM', 'MOLUS', 'SOSAL']),
    'MEDAM1A': ('22', 'Medam One Alfa', 'L', ['T22', 'BEVEN', 'VANAS', 'MEDAM']),
    'ROCCA1A': ('22', 'Rocca One Alfa', 'L', ['T22', 'BEVEN', 'ROCCA']),
    'BALSI1A': ('22', 'Balsi One Alfa', 'L', ['T22', 'GG622', 'BALSI']),
    'CBY2A':   ('22', 'Charlie Bravo Yankee Two Alfa', 'L', ['T22', 'CBY']),
    'DEPUL1A': ('22', 'Depul One Alfa', 'R', ['T22', 'ARGIS', 'DEPUL']),
}
SID_ALT = {'T04': 7000, 'T22': 7000}
def sid_js(n, v):
    rw, sp, tn, pts = v
    top = 11000 if n.startswith(('ARBOS', 'SOSAL', 'MEDAM', 'ROCCA', 'BALSI')) else 9000
    out = []
    for p in pts:
        alt = 7000 if p in ('T04', 'T22') else None
        out.append("['%s'%s]" % (p, ', %d' % alt if alt else ''))
    out[-1] = "['%s', %d]" % (pts[-1], top)
    return "    '%s': { rwy: '%s', spoken: '%s', turn: '%s', pts: [%s] }" % (n, rw, sp, tn, ', '.join(out))
SID_JS = ',\n'.join(sid_js(n, v) for n, v in SIDS.items())
DIRSID = {'NE': ('ARBOS1N', 'DIPIR1A'), 'N': ('SIROD1N', 'KONIL1R'), 'E': ('SOSAL1N', 'SOSAL1R'), 'SE': ('MEDAM1N', 'MEDAM1A'), 'S': ('BALSI1N', 'BALSI1A'), 'SW': ('CBY2N', 'CBY2A')}
DIRNAME = {'NE': 'the UK, Ireland, the Benelux, northern Germany, Scandinavia and the Baltic', 'N': 'Switzerland, southern Germany and Austria',
           'E': 'eastern Europe, the Balkans, Greece and Turkey', 'SE': 'Italy, Malta, Cyprus and the eastern Mediterranean',
           'S': 'southern France, eastern Spain, the Balearics and North Africa', 'SW': 'Iberia, the Atlantic islands and West Africa'}
CTRKEY = {'NE': 'n', 'N': 'n', 'E': 'e', 'SE': 'e', 'S': 's', 'SW': 's'}
DIR_JS = ',\n'.join("    %s: { star: { '04': '%s', '22': '%s' }, entry: { '04': '%s', '22': '%s' }, sid: { '04': '%s', '22': '%s' }, ctr: '%s', name: '%s' }" % (
    g, GATE_STAR[g]['04'][0], GATE_STAR[g]['22'][0], GATE_STAR[g]['04'][1], GATE_STAR[g]['22'][1], DIRSID[g][0], DIRSID[g][1], CTRKEY[g], DIRNAME[g]) for g in ['NE', 'N', 'E', 'SE', 'S', 'SW'])

# ── airports and the directions they lie in (bearing/distance from Geneva)
AP = dict(bris['AIRPORTS']); PL = dict(bris['PLACES'])
AP.update({'LSZH': [47.4647, 8.5492, 'Zurich'], 'LFLL': [45.7256, 5.0811, 'Lyon'], 'LFPO': [48.7233, 2.3794, 'Paris Orly'], 'EGKK': [51.1481, -0.1903, 'London Gatwick'],
           'LSGG': [46.2381, 6.1090, 'Geneva'], 'LFSB': [47.5896, 7.5299, 'Basel'], 'LIML': [45.4451, 9.2767, 'Milan Linate'], 'LEMD': [40.4983, -3.5676, 'Madrid'],
           'EBBR': [50.9014, 4.4844, 'Brussels'], 'EDDF': [50.0333, 8.5706, 'Frankfurt'], 'LTFM': [41.2753, 28.7519, 'Istanbul'], 'LFMN': [43.6584, 7.2159, 'Nice'],
           'LFML': [43.4393, 5.2214, 'Marseille'], 'LEBL': [41.2971, 2.0785, 'Barcelona'], 'LEMG': [36.6749, -4.4991, 'Málaga'], 'LPPT': [38.7742, -9.1342, 'Lisbon'],
           'EGLL': [51.4700, -0.4543, 'London Heathrow'], 'EGLC': [51.5053, 0.0553, 'London City'], 'EGSS': [51.8850, 0.2350, 'London Stansted'], 'EGGW': [51.8747, -0.3683, 'London Luton'],
           'EIDW': [53.4213, -6.2701, 'Dublin'], 'LOWW': [48.1103, 16.5697, 'Vienna'], 'EDDM': [48.3538, 11.7861, 'Munich'], 'LIMC': [45.6306, 8.7281, 'Milan Malpensa'],
           'LIRF': [41.8003, 12.2389, 'Rome'], 'LGAV': [37.9364, 23.9445, 'Athens'], 'LEPA': [39.5517, 2.7388, 'Palma'], 'LFBO': [43.6291, 1.3638, 'Toulouse'],
           'LFRS': [47.1532, -1.6107, 'Nantes'], 'LFBD': [44.8283, -0.7156, 'Bordeaux'], 'LPPR': [41.2481, -8.6814, 'Porto'], 'GMMN': [33.3675, -7.5898, 'Casablanca'],
           'DTTA': [36.851, 10.2272, 'Tunis'], 'EHAM': [52.3086, 4.7639, 'Amsterdam'], 'EKCH': [55.6181, 12.6561, 'Copenhagen'], 'LKPR': [50.1008, 14.2600, 'Prague'],
           'EGCC': [53.3537, -2.2750, 'Manchester'], 'EGPH': [55.9500, -3.3725, 'Edinburgh'], 'LEIB': [38.8729, 1.3731, 'Ibiza'], 'LFSB': [47.5896, 7.5299, 'Basel'], 'LBSF': [42.6967, 23.4114, 'Sofia'],
           'LCLK': [34.8751, 33.6249, 'Larnaca'], 'LLBG': [32.0114, 34.8867, 'Tel Aviv'], 'OMDB': [25.2528, 55.3644, 'Dubai'], 'OTHH': [25.2731, 51.6081, 'Doha'], 'LSZA': [46.0043, 8.9106, 'Lugano']})
AP.pop('EGGD', None)
def bd(lat, lon):
    la0, lo0 = math.radians(46.2381), math.radians(6.1090); la, lo = math.radians(lat), math.radians(lon); dl = lo - lo0
    y = math.sin(dl) * math.cos(la); x = math.cos(la0) * math.sin(la) - math.sin(la0) * math.cos(la) * math.cos(dl)
    br = (math.degrees(math.atan2(y, x)) + 360) % 360
    d = 6371 * 2 * math.asin(math.sqrt(math.sin((la - la0) / 2) ** 2 + math.cos(la0) * math.cos(la) * math.sin(dl / 2) ** 2)); return br, d
def gate_for(lat, lon):
    br, d = bd(lat, lon)
    if br >= 285 or br < 30: return 'NE'
    if br < 80: return 'N' if d < 900 else 'E'
    if br < 115: return 'E' if d > 450 else 'N'
    if br < 170: return 'SE'
    if br < 215: return 'S'
    return 'SW'
PD = {ic: gate_for(v[0], v[1]) for ic, v in AP.items() if ic != 'LSGG'}
PD.update({'LFPG': 'NE', 'LFPO': 'NE', 'EGLL': 'NE', 'EGKK': 'NE', 'EGLC': 'NE', 'EGSS': 'NE', 'EGGW': 'NE'})
PD_JS = ',\n'.join('    ' + ', '.join("%s: '%s'" % (k, PD[k]) for k in sorted(PD)[i:i + 8]) for i in range(0, len(PD), 8))
AP_JS = ',\n'.join("    %s: [%s, %s, '%s']" % (k, v[0], v[1], v[2]) for k, v in sorted(AP.items()))
PL.update({'geneva': 'LSGG', 'zurich': 'LSZH', 'lyon': 'LFLL', 'basel': 'LFSB', 'orly': 'LFPO', 'paris orly': 'LFPO', 'frankfurt': 'EDDF', 'brussels': 'EBBR', 'vienna': 'LOWW',
           'istanbul': 'LTFM', 'marseille': 'LFML', 'toulouse': 'LFBO', 'nantes': 'LFRS', 'casablanca': 'GMMN', 'tunis': 'DTTA', 'london heathrow': 'EGLL', 'london gatwick': 'EGKK',
           'london luton': 'EGGW', 'london city': 'EGLC', 'milan linate': 'LIML', 'milan malpensa': 'LIMC', 'tel aviv': 'LLBG', 'dubai': 'OMDB', 'doha': 'OTHH', 'lugano': 'LSZA'})
PL.pop('geneva', None); PL['geneva'] = 'LSGG'
PL_JS = ', '.join("'%s': '%s'" % (k, v) for k, v in sorted(PL.items()))

# ── timetable: a representative Geneva day (airline, flight prefix, destination, type, first arrival UTC, rotation spacing). Turnarounds 40-75 min.
random.seed(2026)
ROT = [
    # (airline, [dest...], types, count, depart-only count)
    ('SWR', ['LSZH', 'EGLL', 'LFPG', 'LIRF', 'EDDF', 'LEBL', 'LEMD', 'LPPT', 'EHAM', 'LEMG', 'LGAV'], ['A320', 'A319', 'A21N', 'BCS3'], 14),
    ('EZY', ['EGLL', 'EGKK', 'EGGW', 'EGPH', 'EGCC', 'LPPT', 'LEBL', 'EHAM', 'LFPO', 'LIRF', 'LGAV', 'EGPF', 'EGAA'], ['A320', 'A319', 'A20N', 'A21N'], 10),
    ('EZS', ['EGKK', 'EGGW', 'LEBL', 'LEPA', 'LEMG', 'LIRF', 'LFPG', 'EGPH', 'LPPT', 'LGAV'], ['A320', 'A319'], 9),
    ('AFR', ['LFPG', 'LFPO', 'LFLL', 'LFMN'], ['A320', 'A319', 'A20N'], 6),
    ('BAW', ['EGLL', 'EGKK', 'EGLC'], ['A320', 'A319', 'A21N'], 6),
    ('DLH', ['EDDF', 'EDDM'], ['A320', 'A319', 'E190'], 5),
    ('KLM', ['EHAM'], ['E190', 'A320'], 3),
    ('IBE', ['LEMD', 'LEBL'], ['A320', 'A20N'], 3),
    ('VLG', ['LEBL', 'LEMG', 'LEPA'], ['A320', 'A320'], 3),
    ('RYR', ['EGSS', 'LEMG', 'LIRF', 'EIDW'], ['B738'], 3),
    ('TAP', ['LPPT'], ['A320', 'A319'], 2),
    ('EDW', ['LEPA', 'LEMG', 'LGAV', 'LCLK'], ['A320', 'A333'], 3),
    ('TVF', ['LFMN', 'LFBO', 'LFBD'], ['B738'], 2),
    ('ITY', ['LIRF', 'LIML'], ['A319', 'A320'], 2),
    ('TUI', ['LEPA', 'LEMG'], ['B738', 'B738'], 1),
    ('NJE', ['EGGW', 'EGLC', 'LFPG'], ['C56X', 'GLF6'], 5)
]
TT = []
used = set()
def fn(al):
    while True:
        n = '%s%d' % (al, random.randint(100, 999) if al != 'NJE' else random.randint(400, 799))
        if n not in used: used.add(n); return n
def t(m): return '%02d:%02d' % (m // 60, m % 60)
for al, dests, types, cnt in ROT:
    for i in range(cnt):
        d = random.choice(dests); ty = random.choice(types)
        if al == 'NJE' or al == 'EZY' and random.random() < 0.2: ty = random.choice(types)
        arr = random.randint(5 * 60 + 30, 19 * 60)
        mode = random.random()
        if mode < 0.12: TT.append([None, None, None, fn(al), d, t(random.randint(5 * 60, 10 * 60)), ty, '1234567', None])
        elif mode < 0.22: TT.append([fn(al), d, t(arr), None, None, None, ty, '1234567', None])
        else:
            dd = random.choice(dests) if al not in ('SWR',) else d
            TT.append([fn(al), d, t(arr), fn(al), dd, t(arr + random.randint(40, 80)), ty, '1234567', None])
TT.sort(key=lambda r: hm if False else (r[2] or r[5]))
def row(r): return '    [' + ', '.join('null' if x is None else "'%s'" % x for x in r) + ']'
TT_JS = ',\n'.join(row(r) for r in TT)

FIX_JS = ',\n'.join('    %s: %s' % (k, P(k)) for k in sorted(F) if not k.startswith('ROCCA_'))
HOLD_JS = """    SAPRE: { inb: 223, turn: 'R', min: 7000, max: 23000, maxKt: 230 },
    GEVEA: { inb: 223, turn: 'R', min: 7000, max: 15000, maxKt: 220 },
    VADAR: { inb: 223, turn: 'R', min: 10000, max: 23000, maxKt: 230 },
    NEMOS: { inb: 223, turn: 'R', min: 11000, max: 23000, maxKt: 230 },
    GOLEB: { inb: 301, turn: 'R', min: 18000, max: 24000, maxKt: 250 },
    CBY:   { inb: 43, turn: 'R', min: 10000, max: 14000, maxKt: 220 }"""

js = open(os.path.join(HERE, 'lsgg.template.js')).read()
for k, v in {'@@FIX@@': FIX_JS, '@@STARS@@': STAR_JS, '@@HOLDS@@': HOLD_JS, '@@SIDS@@': SID_JS, '@@DIR@@': DIR_JS, '@@PLACEDIR@@': PD_JS,
             '@@TIMETABLE@@': TT_JS, '@@AIRPORTS@@': AP_JS, '@@PLACES@@': PL_JS,
             '@@THR04@@': "[%.5f, %.5f]" % ll(*thr04), '@@THR22@@': "[%.5f, %.5f]" % ll(*thr22), '@@TRK@@': '%.2f' % trk}.items():
    js = js.replace(k, v)
sys.stdout.write(js)
