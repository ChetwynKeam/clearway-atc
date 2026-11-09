#!/usr/bin/env python3
"""src/airports/omdb.js from the Dubai AIP and the real boards.
Inputs: tools/omdb/procs.json (every SID, STAR and approach coding table of AD 2.22 with ENR 4.4's coordinates, from
parse_procs.py), tools/omdb/places.py (the boards' destinations), the avionio DXB boards (the omdb-data branch,
omdb_flights.json) and tools/omdb/omdb.template.js (the hand-written parts). usage: make_profile.py omdb_flights.json > src/airports/omdb.js"""
import json, math, re, sys, os, random
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from places import AP, BOARD, BY_AIRLINE
J = json.load(open(os.path.join(HERE, 'procs.json'))); PR = J['procs']; F = J['fixes']
ARP = (25 + 15/60 + 10/3600, 55 + 21/60 + 52/3600)
def brg(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    y = math.sin(lo2 - lo1)*math.cos(la2); x = math.cos(la1)*math.sin(la2) - math.sin(la1)*math.cos(la2)*math.cos(lo2 - lo1)
    return (math.degrees(math.atan2(y, x)) + 360) % 360
def ang(a, b): return abs((a - b + 180) % 360 - 180)
NATO = dict(A='Alpha', B='Bravo', C='Charlie', D='Delta', E='Echo', F='Foxtrot', G='Golf', H='Hotel', J='Juliett', K='Kilo', L='Lima', M='Mike', N='November',
            P='Papa', Q='Quebec', R='Romeo', S='Sierra', T='Tango', U='Uniform', V='Victor', W='Whiskey', X='X-ray', Y='Yankee', Z='Zulu')
NUM = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
def spoken(name):
    m = re.match(r'^([A-Z]+)(\d)([A-Z])$', name)
    return f'{m[1].title()} {NUM[int(m[2])]} {NATO[m[3]]}' if m else name
lev = lambda a: int(a[1:]) if a else None

# ── STARs: the primary ones of AD 2.22.5.8 (DATOB is at ATC discretion only)
PRIMARY = {'12': ['IMPED3E', 'LORID1E', 'PUVAL2E', 'VUTEB3B'], '30': ['IMPED3C', 'LORID4C', 'PUVAL5C', 'VUTEB4C']}
STARS = {}
for grp, names in PRIMARY.items():
    for nm in names:
        legs = PR[nm]['legs']; pts = []
        for l in legs:
            a = l['alt']; v = int(a[1:]) if a and a[0] in '@-' else None   # an "at or below" or "at" level is where it descends to
            pts.append([l['fix'], v] if v else [l['fix']])
        first = next((int(l['alt'][1:]) for l in legs if l['alt'] and l['alt'][0] in '-@'), 11000)
        STARS[f'{nm}:{grp}'] = dict(name=nm, rwy=grp, spoken=spoken(nm), pts=pts, level=first)
# ── SIDs: every one (each for both runways of its direction)
SIDS = {}
for nm, p in PR.items():
    if p['kind'] != 'SID': continue
    pts = [l['fix'] for l in p['legs'] if l['fix'] in F]
    alts = [int(l['alt'][1:]) for l in p['legs'] if l['alt'] and l['alt'][0] == '+']
    SIDS[nm] = dict(rwy=p['rwy'], cat='CD', spoken=spoken(nm), pts=pts, top=max(alts) if alts else 7000, end=pts[-1])
print('STARs', len(STARS), 'SIDs', len(SIDS), file=sys.stderr)

# ── gates: one per STAR entry, named by its direction from Dubai
ENTRY_NAMES = {'PUVAL': 'NE', 'IMPED': 'ESE', 'LORID': 'SW', 'VUTEB': 'NW'}
B = lambda f: brg(ARP, F[f])
GATES = sorted(((g, round(B(e))) for e, g in ENTRY_NAMES.items()), key=lambda t: t[1])
SID_END = sorted({s['end'] for s in SIDS.values()})
DIRS = {g: dict(c=c, entry=[e for e, n in ENTRY_NAMES.items() if n == g][0], exitCD=min(SID_END, key=lambda f: ang(B(f), c))) for g, c in GATES}
# a hold at each entry, inbound along the STAR's first leg (representative)
HOLDS = {}
for e in ENTRY_NAMES:
    s = next(v for v in STARS.values() if v['pts'][0][0] == e); nx = s['pts'][1][0]
    HOLDS[e] = round(brg(F[e], F[nx]))

# ── traffic. The boards (local time, UTC+4) cover the evening's departures and the night's arrivals. Each arrival is
# paired with its return flight (Emirates and flydubai number it one lower: EK315 in from Singapore, EK314 out), real
# where the board has it, else after the airline's usual turnaround; a departure the board shows with no arrival gets
# the inbound flight that brought the aircraft. The day's other bank (09:00 to 21:00 local, which the boards did not
# reach) repeats the night's routes with the next flight numbers, twelve hours on. A representative day, not a record.
ICAO = {'EK': 'UAE', 'FZ': 'FDB', 'IX': 'AXB', 'SV': 'SVA', '6E': 'IGO', 'SG': 'SEJ', 'QR': 'QTR', 'AI': 'AIC', 'GF': 'GFA', 'RJ': 'RJA', 'WY': 'OMA', 'FG': 'AFG',
        'KQ': 'KQA', 'ME': 'MEA', 'UL': 'ALK', 'KU': 'KAC', 'AF': 'AFR', 'SU': 'AFL', 'BG': 'BBC', 'ET': 'ETH', 'PA': 'ABQ', 'BA': 'BAW', 'WB': 'RWD', 'PC': 'PGT',
        'TC': 'ATC', 'RA': 'RNA', 'XQ': 'SXS', 'VF': 'TKJ', 'MS': 'MSR', 'F3': 'FAD'}
A380 = {'EGLL', 'EGKK', 'EGCC', 'EGBB', 'EGPF', 'EGNT', 'LFPG', 'EDDF', 'EDDM', 'EHAM', 'LIMC', 'LEMD', 'LEBL', 'LIRF', 'LOWW', 'LSZH', 'EKCH', 'ENGM', 'ESSA',
        'KJFK', 'KIAH', 'KLAX', 'KSFO', 'KBOS', 'KDFW', 'CYYZ', 'YSSY', 'YMML', 'YBBN', 'YPPH', 'NZAA', 'WSSS', 'VTBS', 'VHHH', 'RJTT', 'RJBB', 'RKSI', 'ZBAD',
        'ZGGG', 'ZSPD', 'WMKK', 'WIII', 'RPLL', 'FAOR', 'FACT', 'SBGR', 'VABB', 'VOMM', 'VOBL', 'VIDP', 'OEJN', 'OERK', 'HECA', 'MMMX', 'KMCO', 'UUDD'}
NARROW = {'FDB': ['B38M', 'B738', 'B39M'], 'AXB': ['B38M'], 'IGO': ['A21N', 'A20N'], 'SEJ': ['B738'], 'AIC': ['A20N'], 'GFA': ['A20N'], 'RJA': ['A320'],
          'OMA': ['B738'], 'AFG': ['A320'], 'MEA': ['A21N'], 'KAC': ['A20N'], 'BBC': ['B738'], 'ETH': ['B38M'], 'ABQ': ['A320'], 'PGT': ['A20N'], 'ATC': ['A20N'],
          'RNA': ['A320'], 'SXS': ['B38M'], 'TKJ': ['A20N'], 'MSR': ['B738'], 'FAD': ['A20N'], 'SVA': ['A320', 'B77W'], 'QTR': ['A320']}
WIDE = {'KQA': 'B788', 'ALK': 'A333', 'AFR': 'B77W', 'AFL': 'A333', 'BAW': 'A388', 'RWD': 'A333'}
def typ(al, place, n):
    if al == 'UAE': return 'A388' if place in A380 else ('B77W' if n % 5 else 'B77L')
    if al in WIDE: return WIDE[al]
    T = NARROW.get(al, ['A320']); return T[n % len(T)]
def hm(s): h, m = s.split(':'); return int(h)*60 + int(m)
def hh(m): m %= 1440; return '%02d:%02d' % (m // 60, m % 60)
def ground(al, place, t):   # minutes on the ground
    if al == 'UAE': return 165 if t == 'A388' else 135
    if al in WIDE: return 150
    return 70 if al == 'FDB' else 80
days = json.load(open(sys.argv[1]))['days']
seen, recs = set(), []
for day, d in sorted(days.items()):
    for kind in ('arr', 'dep'):
        for r in d[kind]:
            m = re.match(r'^([A-Z0-9]{2})(\d+)$', r['flight'])
            if not m or m[1] not in ICAO: continue
            al, n = ICAO[m[1]], int(m[2]); place = BY_AIRLINE.get((r['place'], m[1])) or BOARD.get(r['place'])
            if not place: continue
            key = (kind, al, n)
            if key in seen: continue
            seen.add(key); recs.append(dict(kind=kind, al=al, n=n, place=place, tm=(hm(r['sched']) - 240) % 1440))   # UTC
arrs = {(r['al'], r['n']): r for r in recs if r['kind'] == 'arr'}; deps = {(r['al'], r['n']): r for r in recs if r['kind'] == 'dep'}
rows, used_dep, used_cs = [], set(), set()
def ret_no(al, n): return n - 1 if n % 2 else n + 1
for (al, n), a in sorted(arrs.items(), key=lambda kv: kv[1]['tm']):
    t = typ(al, a['place'], n); g = ground(al, a['place'], t); dn = ret_no(al, n)
    d = deps.get((al, dn))
    if d and d['place'] == a['place'] and 30 <= (d['tm'] - a['tm']) % 1440 <= 420: dt = d['tm']; used_dep.add((al, dn))
    else: dt = (a['tm'] + g) % 1440
    rows.append([al + str(n), a['place'], hh(a['tm']), al + str(dn), a['place'], hh(dt), t]); used_cs |= {al + str(n), al + str(dn)}
for (al, n), d in sorted(deps.items(), key=lambda kv: kv[1]['tm']):
    if (al, n) in used_dep: continue
    an = ret_no(al, n)
    if al + str(an) in used_cs: continue
    t = typ(al, d['place'], n); g = ground(al, d['place'], t)
    rows.append([al + str(an), d['place'], hh(d['tm'] - g), al + str(n), d['place'], hh(d['tm']), t]); used_cs |= {al + str(an), al + str(n)}
# the day's other bank: the routes again, twelve hours on, under the next flight numbers free
rnd = random.Random(26)
extra = []
for r in rows:
    al = re.match(r'^[A-Z]{3}', r[0])[0]; na, nd = int(r[0][3:]), int(r[3][3:])
    if rnd.random() > 0.85: continue
    for k in range(2, 40, 2):
        ca, cd = al + str(na + k), al + str(nd + k)
        if ca not in used_cs and cd not in used_cs: break
    used_cs |= {ca, cd}; jit = rnd.randint(-25, 25)
    extra.append([ca, r[1], hh(hm(r[2]) + 720 + jit), cd, r[4], hh(hm(r[5]) + 720 + jit), r[6]])
TT = [r + ['1234567', None] for r in rows + extra]
TT.sort(key=lambda r: hm(r[2]))
print('timetable rows', len(TT), 'movements', 2*len(TT), file=sys.stderr)
used_ap = sorted({r[1] for r in TT} | {r[4] for r in TT} | {'OMDB', 'OMDW', 'OMSJ', 'OMAA', 'OMAL', 'OMRK', 'OMFJ'})

# ── fixes used
USED = set()
for s in STARS.values(): USED |= {p[0] for p in s['pts']}
for s in SIDS.values(): USED |= set(s['pts'])
for k, p in PR.items():
    if p['kind'] in ('ILS', 'RNP'): USED |= {l['fix'] for l in p['legs'] if l['fix'] in F}
fix_js = ',\n    '.join(', '.join(f"{k}: [{F[k][0]:.6f}, {F[k][1]:.6f}]" for k in row) for row in
                       [sorted(k for k in USED if k in F)[i:i+5] for i in range(0, len(USED), 5)] if row)
def js(o): return json.dumps(o, separators=(', ', ': ')).replace('"', "'")
star_js = ',\n    '.join(f"'{k}': {{ name: '{v['name']}', rwy: '{v['rwy']}', spoken: '{v['spoken']}', level: {v['level']}, pts: {js(v['pts'])} }}" for k, v in sorted(STARS.items()))
sid_js = ',\n    '.join(f"{k}: {{ rwy: '{v['rwy']}', cat: 'CD', spoken: '{v['spoken']}', pts: {js(v['pts'])}, top: {v['top']} }}" for k, v in sorted(SIDS.items()))
dir_js = ',\n    '.join(f"{g}: {{ brg: {d['c']}, entry: '{d['entry']}', exit: {{ CD: '{d['exitCD']}', AB: '{d['exitCD']}' }} }}" for g, d in DIRS.items())
hold_js = ', '.join(f"{e}: {{ inb: {b}, turn: 'R', min: 1 }}" for e, b in sorted(HOLDS.items()))
tt_js = ',\n    '.join(js(r) for r in TT)
ap_js = ', '.join(f"{k}: [{AP[k][0]}, {AP[k][1]}, '{AP[k][2]}']" for k in used_ap if k in AP)
pl = {**{k.lower(): v for k, v in BOARD.items()}, **{AP[k][2].lower(): k for k in used_ap if k in AP}}
pl_js = ', '.join(f"'{k}': '{v}'" for k, v in sorted(pl.items()))
def gate_of(b): return min(GATES, key=lambda g: ang(g[1], b))[0]
pd = {k: gate_of(brg(ARP, AP[k][:2])) for k in AP if k != 'OMDB'}
pd_js = ', '.join(f"{k}: '{v}'" for k, v in sorted(pd.items()))
sb_js = ', '.join(f"{f}: {round(B(f))}" for f in SID_END)
T = open(os.path.join(HERE, 'omdb.template.js')).read()
for k, v in {'FIX': fix_js, 'STARS': star_js, 'SIDS': sid_js, 'DIRS': dir_js, 'HOLDS': hold_js, 'TIMETABLE': tt_js, 'NROWS': str(len(TT)),
             'AIRPORTS': ap_js, 'PLACES': pl_js, 'PLACE_DIR': pd_js, 'SID_BRG': sb_js}.items():
    T = T.replace('@@' + k + '@@', v)
sys.stdout.write(T)
