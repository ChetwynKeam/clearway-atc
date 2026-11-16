#!/usr/bin/env python3
"""src/airports/eham.js from the Dutch AIP and the real Schiphol boards.
Inputs: tools/eham/procs.json (every SID and STAR coding table of AD 2 EHAM AD 2.22, parse_procs.py), tools/eham/fixes.json
(the points they use, fixes.py), tools/eham/places.py (the destinations on the boards), the avionio AMS boards (the
eham-data branch, boards.json) and tools/eham/eham.template.js (the hand-written parts: runways, approaches, units, rules).
usage: make_profile.py boards.json > src/airports/eham.js"""
import json, math, re, sys, os, collections
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from places import AP, place_icao
J = json.load(open(os.path.join(HERE, 'procs.json'))); F = json.load(open(os.path.join(HERE, 'fixes.json')))
ARP = (52 + 18/60 + 29/3600, 4 + 45/60 + 51/3600)
def brg(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    y = math.sin(lo2 - lo1)*math.cos(la2); x = math.cos(la1)*math.sin(la2) - math.sin(la1)*math.cos(la2)*math.cos(lo2 - lo1)
    return (math.degrees(math.atan2(y, x)) + 360) % 360
def ang(a, b): return abs((a - b + 180) % 360 - 180)
NATO = dict(A='Alpha', B='Bravo', C='Charlie', D='Delta', E='Echo', F='Foxtrot', G='Golf', H='Hotel', J='Juliett', K='Kilo', L='Lima', M='Mike', N='November',
            P='Papa', Q='Quebec', R='Romeo', S='Sierra', T='Tango', U='Uniform', V='Victor', W='Whiskey', X='X-ray', Y='Yankee', Z='Zulu')
NUM = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
def spoken(name):
    m = re.match(r'^([A-Z]+) ?(\d)([A-Z])$', name)
    if not m: return name
    w = {'SPY': 'Spijkerboor'}.get(m[1], m[1].title())
    return f'{w} {NUM[int(m[2])]} {NATO[m[3]]}'
def lev(s):
    """the abbreviated description's levels: [F240-] at or below, [B F100 F070] between -> (lowest, highest)"""
    s = s or ''; m = re.search(r'B F(\d+) F(\d+)', s)
    if m: return int(m[2])*100, int(m[1])*100
    m = re.search(r'F(\d+)-', s)
    if m: return None, int(m[1])*100
    return None, None

# ── STARs (AD 2.22 para 2.4: RNAV1, every one to an initial approach fix, ARTIP, RIVER or SUGOL, crossed between FL100
# and FL070 at 250 kt; from there radar vectors to the ILS by day)
STARS = {}
for name, s in J['stars'].items():
    pts = []
    for l in s['legs']:
        fx = re.match(r'[A-Z0-9]+', l['abbr'])[0]; lo, hi = lev(l['abbr'])
        pts.append([fx, lo] if lo else [fx])
    if pts[-1][0] not in ('ARTIP', 'RIVER', 'SUGOL'): continue          # the night transitions are read with the approaches
    STARS[name.replace(' ', '')] = dict(name=name.replace(' ', ''), spoken=spoken(name), iaf=pts[-1][0], level=7000, pts=pts)
print('STARs', len(STARS), sorted(STARS), file=sys.stderr)

# ── RNAV transitions (trans.json, parse_trans.py): the night transitions to the ILS of 06, 18C and 18R (1B, 1H, 1D) and
# the day transition ARTIP 2X to 36R, each point with its lowest altitude and highest speed (the RNP ones are not flown)
TJ = json.load(open(os.path.join(HERE, 'trans.json')))
def t_alt(a):
    if not a: return None
    v = [int(x[2:])*100 if x.startswith('FL') else int(x) for x in re.findall(r'FL ?\d{2,3}|\d{4,5}', a.replace('FL ', 'FL'))]
    if not v: return None
    return min(v) if a.strip()[0] in '+B' or ' + ' in a else (v[-1] if a.strip()[0] == '@' else None)
TRANS = {}
for name, t in TJ.items():
    if t['kind'] != 'transition' or t['app'] != 'ILS': continue
    pts = [[l['fix'], t_alt(l['alt']), int(re.sub(r'\D', '', l['spd'])) if l['spd'] and re.search(r'\d', l['spd']) else None] for l in t['legs'] if l['fix'] in F]
    TRANS[name.replace(' ', '')] = dict(iaf=pts[0][0], rwy=t['rwy'], when=t['when'], pts=pts)
print('transitions', sorted(TRANS), file=sys.stderr)

# ── SIDs (AD 2.22 para 1.5): RNAV1. The designator's letter is the runway (the charts SID-04 ... SID-36L)
SUFFIX = {'F': '04', 'G': '22', 'R': '06', 'T': '06', 'S': '24', 'Q': '24', 'J': '24', 'K': '24', 'N': '09', 'M': '09', 'P': '27',
          'X': '18C', 'Y': '18C', 'W': '36C', 'E': '18L', 'V': '36L', 'Z': '36L'}
SIDS = {}
for name, s in J['sids'].items():
    rw = SUFFIX[name[-1]]
    pts = [l['fix'] for l in s['legs'] if l['fix'] and l['fix'] in F]
    alts = [int(re.sub(r'\D', '', l['alt'])) for l in s['legs'] if l['alt'] and re.search(r'\d{3,}', l['alt'])]
    SIDS[name.replace(' ', '')] = dict(rwy=rw, spoken=spoken(name), pts=pts, end=pts[-1], top=6000)
print('SIDs', len(SIDS), file=sys.stderr)

# ── gates: one per STAR entry fix, named by its direction from Schiphol
ENTRY = {s['pts'][0][0]: n for n, s in STARS.items()}
B = lambda f: brg(ARP, F[f])
CMP = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']
GATES = {e: dict(c=round(B(e)), entry=e, star=ENTRY[e]) for e in sorted(ENTRY, key=B)}   # one per entry fix, named after it
def gate_of(b): return min(GATES, key=lambda g: ang(GATES[g]['c'], b))

# ── traffic: the real boards, paired: each arrival with a later departure of the same airline to the same place
# (35-200 minutes on the ground; 60-300 for long haul), the rest as single movements
ICAO = {'KL': 'KLM', 'HV': 'TRA', 'DL': 'DAL', 'EC': 'EJU', 'LH': 'DLH', 'U2': 'EZY', 'FR': 'RYR', 'WA': 'KLC', 'OS': 'AUA', 'LX': 'SWR', 'VY': 'VLG',
        'SK': 'SAS', 'CJ': 'CFE', 'AZ': 'ITY', 'UA': 'UAL', 'BA': 'BAW', 'QR': 'QTR', 'OR': 'TFL', 'AF': 'AFR', 'EK': 'UAE', 'TK': 'THY', 'EI': 'EIN',
        'TP': 'TAP', 'CZ': 'CSN', 'LO': 'LOT', 'BT': 'BTI', 'XQ': 'SXS', 'SQ': 'SIA', 'IB': 'IBE', 'CK': 'CKK', 'VF': 'TKJ', 'CA': 'CCA', 'PC': 'PGT',
        'RO': 'ROT', 'MP': 'MPH', 'AA': 'AAL', 'MB': 'MNB', 'FI': 'ICE', 'TG': 'THA', 'SX': 'SXN', 'GQ': 'SEH', '5Y': 'GTI', 'MS': 'MSR', 'AM': 'AMX',
        'KQ': 'KQA', 'D8': 'NSZ', '7L': 'AZG', 'DY': 'NOZ', 'UX': 'AEA', 'YW': 'ANE', 'JU': 'ASL', '3O': 'MAC', 'AC': 'ACA', 'CX': 'CPA', 'ZQ': 'GER',
        'GA': 'GIA', 'PL': 'SOU', 'CD': 'TCD', 'BI': 'RBA', 'JJ': 'TAM', 'A3': 'AEE', 'SN': 'BEL', 'W6': 'WZZ', 'WK': 'EDW', 'TO': 'TVF', 'A9': 'TGZ',
        'BJ': 'LBT', '2L': 'OAW', 'PS': 'AUI', 'JL': 'JAL', 'KE': 'KAL', 'NH': 'ANA', 'MU': 'CES', 'HU': 'CHH', 'EY': 'ETD', 'ET': 'ETH', 'RJ': 'RJA',
        'AT': 'RAM', 'LY': 'ELY', '6E': 'IGO', 'MH': 'MAS', 'SV': 'SVA', 'PG': 'BKP', 'AY': 'FIN', 'BG': 'BBC', 'OK': 'CSA', 'JP': 'ADR', 'LG': 'LGL'}
SHORT = {'KLM': ['B738', 'B739', 'B737', 'E195', 'E295', 'B738'], 'KLC': ['E195', 'E295', 'E175', 'E190'], 'TRA': ['B738', 'B38M', 'A20N'], 'EJU': ['A320', 'A20N', 'A319'],
         'EZY': ['A320', 'A319'], 'DLH': ['A20N', 'A321', 'A319'], 'RYR': ['B738', 'B38M'], 'AUA': ['A320', 'E195'], 'SWR': ['BCS3', 'A320'], 'VLG': ['A320'],
         'SAS': ['A20N'], 'CFE': ['E190'], 'ITY': ['A20N'], 'BAW': ['A320', 'A20N'], 'TFL': ['B38M'], 'AFR': ['A320', 'A20N'], 'THY': ['A321', 'A21N'],
         'EIN': ['A320'], 'TAP': ['A20N'], 'LOT': ['E195', 'B38M'], 'BTI': ['BCS3'], 'SXS': ['B38M'], 'IBE': ['A320'], 'PGT': ['A20N'], 'ROT': ['B738'],
         'ICE': ['B38M'], 'SXN': ['B738'], 'SEH': ['A320'], 'NSZ': ['B38M'], 'NOZ': ['B38M'], 'AEA': ['B738'], 'ANE': ['CRJ9'], 'MAC': ['A320'], 'TCD': ['A320'],
         'AEE': ['A20N'], 'BEL': ['A320'], 'WZZ': ['A21N'], 'EDW': ['A320'], 'TVF': ['B738'], 'LBT': ['A320'], 'FIN': ['A320'], 'CSA': ['A320'], 'LGL': ['E295'],
         'RAM': ['B738'], 'MSR': ['B738'], 'RJA': ['A320'], 'ELY': ['B738'], 'AZG': ['B744'], 'MPH': ['B744'], 'CKK': ['B744'], 'GTI': ['B744'], 'ASL': ['A320']}
LONG = {'KLM': {'*': 'B77W', 'KJFK': 'B789', 'TNCC': 'A333', 'TNCB': 'A333', 'KMSP': 'A333', 'OMDB': 'B78X', 'RJBB': 'B789', 'SBGR': 'B77W', 'RKSI': 'B78X'},
        'DAL': {'*': 'A333'}, 'UAL': {'*': 'B763'}, 'AAL': {'*': 'B788'}, 'QTR': {'*': 'B77W'}, 'UAE': {'*': 'A388'}, 'CSN': {'*': 'B789'}, 'SIA': {'*': 'A359'},
        'CCA': {'*': 'A333'}, 'THA': {'*': 'B77W'}, 'AMX': {'*': 'B789'}, 'KQA': {'*': 'B788'}, 'ACA': {'*': 'B789'}, 'CPA': {'*': 'A35K'}, 'GIA': {'*': 'A339'},
        'TAM': {'*': 'B77W'}, 'MNB': {'*': 'B744'}, 'CKK': {'*': 'B744'}, 'TKJ': {'*': 'B77W'}, 'GER': {'*': 'B788'}, 'SOU': {'*': 'B789'}, 'RBA': {'*': 'B788'},
        'TRA': {'*': 'B738'}, 'TFL': {'*': 'B788'}, 'ETD': {'*': 'B789'}, 'MAS': {'*': 'A359'}}
def is_long(icao): return icao[0] in 'KCMSTRZVWOFDHL' and icao[:2] not in ('LE', 'LF', 'LI', 'LP', 'LG', 'LH', 'LK', 'LO', 'LR', 'LS', 'LT', 'LJ', 'LD', 'LB', 'LZ', 'LW', 'LY', 'LU', 'LA', 'LC', 'LL', 'LM', 'LN', 'LQ', 'LX') and not icao.startswith(('GC', 'GM', 'GV', 'HE', 'DT', 'OJ', 'LL'))
def hm(s): h, m = s.split(':'); return int(h)*60 + int(m)
def hh(m): return '%02d:%02d' % (m // 60 % 24, m % 60)
def rows(path):
    days = json.load(open(path))['days']; ks = sorted(days)
    d0 = days[ks[0]]; d1 = days[ks[1]] if len(ks) > 1 else {'arr': [], 'dep': []}; off = d0['utcOffsetMin']
    first = min(hm(r['sched']) for r in d0['arr'] + d0['dep'])
    take = lambda day, lo, hi: [r for r in day if lo <= hm(r['sched']) < hi]
    arr = take(d0['arr'], first, 1440) + take(d1['arr'], 0, first); dep = take(d0['dep'], first, 1440) + take(d1['dep'], 0, first)
    def conv(r):
        m = re.match(r'^([A-Z0-9]{2})(\d+[A-Z]?)$', r['flight'])
        if not m: return None
        a, n = m[1], m[2]; al = ICAO.get(a); place = place_icao(r['place'], a)
        if not al or not place or place not in AP: return None
        if is_long(place) and al in LONG: L = LONG[al]; t = L.get(place) or L['*']
        else: T = SHORT.get(al, ['A320']); t = T[int(re.sub(r'\D', '', n) or 0) % len(T)]
        return dict(cs=al + n, al=al, t=t, place=place, tm=(hm(r['sched']) - off) % 1440)
    A = [x for x in map(conv, arr) if x]; D = [x for x in map(conv, dep) if x]
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
used_ap = sorted({r[1] for r in TT if r[1]} | {r[4] for r in TT if r[4]} | {'EHAM', 'EHRD', 'EHEH', 'EBBR', 'EDDL', 'EGLL', 'EDDF', 'LFPG'} & set(AP))

# ── the fixes the procedures use
USED = set()
for s in STARS.values(): USED |= {p[0] for p in s['pts']}
for s in SIDS.values(): USED |= set(s['pts'])
APP_FIX = ['OSRON', 'AM609', 'SIDNI', 'AM630', 'PEVOS', 'AM621', 'AM624', 'AM649', 'AM650', 'TIDVO', 'AM639', 'OLGAX', 'AM632', 'NEWCO', 'AM636',
           'AM637', 'AM163', 'NARSO', 'SPL', 'PAM', 'SPY']
for t in TRANS.values(): USED |= {p[0] for p in t['pts']}
USED |= {f for f in APP_FIX if f in F}
NAVS = {'SPL', 'PAM', 'SPY'}
fix_js = ',\n    '.join(', '.join(f"{k}: [{F[k][0]:.6f}, {F[k][1]:.6f}]" for k in row) for row in
                       [sorted(k for k in USED if k in F and k not in NAVS)[i:i+5] for i in range(0, len(USED), 5)] if row)
def js(o): return json.dumps(o, separators=(', ', ': ')).replace('"', "'")
star_js = ',\n    '.join(f"'{k}': {{ name: '{v['name']}', spoken: '{v['spoken']}', iaf: '{v['iaf']}', level: {v['level']}, pts: {js(v['pts'])} }}" for k, v in sorted(STARS.items()))
trans_js = ',\n    '.join(f"'{k}': {{ iaf: '{v['iaf']}', rwy: '{v['rwy']}', when: '{v['when']}', pts: {js(v['pts'])} }}" for k, v in sorted(TRANS.items()))
sid_js = ',\n    '.join(f"'{k}': {{ rwy: '{v['rwy']}', spoken: '{v['spoken']}', pts: {js(v['pts'])}, top: {v['top']} }}" for k, v in sorted(SIDS.items()))
dir_js = ',\n    '.join(f"\"{g}\": {{ brg: {d['c']}, entry: '{d['entry']}', star: '{d['star']}' }}" for g, d in GATES.items())
tt_js = ',\n    '.join(js(r) for r in TT)
ap_js = ', '.join(f"{k}: [{AP[k][0]}, {AP[k][1]}, {json.dumps(AP[k][2], ensure_ascii=False)}]" for k in used_ap)
pd_js = ', '.join(f"{k}: \"{gate_of(brg(ARP, AP[k][:2]))}\"" for k in used_ap if k != 'EHAM')
sidx = {e: round(B(e)) for e in sorted({s['end'] for s in SIDS.values()})}
sx_js = ', '.join(f"{k}: {v}" for k, v in sidx.items())
pl = {}
for r in TT:
    for k in (r[1], r[4]):
        if k: pl[AP[k][2].lower()] = k
pl_js = ', '.join(f"{json.dumps(k, ensure_ascii=False)}: '{v}'" for k, v in sorted(pl.items()))
T = open(os.path.join(HERE, 'eham.template.js')).read()
for k, v in {'@@FIX@@': fix_js, '@@STARS@@': star_js, '@@SIDS@@': sid_js, '@@TRANS@@': trans_js, '@@DIRS@@': dir_js, '@@TIMETABLE@@': tt_js, '@@AIRPORTS@@': ap_js,
             '@@PLACES@@': pl_js, '@@PLACE_DIR@@': pd_js, '@@SID_BRG@@': sx_js, '@@NROWS@@': str(len(TT))}.items():
    assert k in T, k; T = T.replace(k, v)
sys.stdout.write(T)
