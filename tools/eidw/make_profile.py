#!/usr/bin/env python3
"""src/airports/eidw.js from the Dublin charts and the real boards.
Inputs: tools/eidw/procs.json (every SID, STAR and approach coding table of AIP Ireland AD 2.24, parsed by parse_procs.py:
fixes, legs, level and speed limits), tools/eidw/places.py (the destinations on the boards), the avionio DUB boards (the
eidw-data branch, eidw_flights.json) and tools/eidw/eidw.template.js (the hand-written parts: runways, approaches,
units, rules). usage: make_profile.py eidw_flights.json > src/airports/eidw.js"""
import json, math, re, sys, os, collections
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from places import AP, BOARD, BY_AIRLINE
J = json.load(open(os.path.join(HERE, 'procs.json'))); P = J['procs']; F = J['fixes']
ARP = (53 + 25/60 + 17/3600, -(6 + 16/60 + 12/3600))
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

# ── procedures. The chart's own typos: BAMLI 1H (RWY 34, CAT A/B) is printed "BAMLI1" and parsed with the next one.
STARS, SIDS = {}, {}
for key, p in P.items():
    name, legs = p['name'], p['legs']
    if not legs: continue
    if p['kind'] == 'STAR':
        grp = {'28L/R': '28', '10L/R': '10', '16': '16', '34': '34'}[p['rwy']]
        pts = []
        for l in legs:
            a = l['lo'] if l['lo'] and l['up'] and l['lo'] == l['up'] else (l['lo'] if l['lo'] and not l['up'] else None)
            pts.append([l['fix'], a] if a else [l['fix']])
        # the level the arrival is first cleared to: the point merge arc (FL70 south, FL80 north) or the IAF's 6,000 ft
        lev = next((l['lo'] for l in legs if l['lo'] and l['up'] and l['lo'] == l['up']), None) or next((l['lo'] for l in legs[::-1] if l['lo']), 6000)
        spd = next((l['spd'] for l in legs if l['spd']), None)
        STARS[f'{name}:{grp}'] = dict(name=name, rwy=grp, spoken=spoken(name), pts=pts, level=lev, spd=spd)
    else:
        rw = p['rwy']; cat = 'AB' if 'A' in p['cat'] else 'CD'
        # two SIDs printed in one table (PESIT 1N and BAMLI 1N, ABIDO 1H and BAMLI 1H): split at the second CA/DF start
        chunks, cur = [], []
        for l in legs:
            if cur and l['pt'] in ('CF', 'DF') and l['fix'] in ('DW020', 'DUB') and any(c['fix'] in ('PESIT',) for c in cur): chunks.append(cur); cur = []
            cur.append(l)
        chunks.append(cur)
        names = [name] + (['BAMLI1N'] if name == 'PESIT1N' else ['BAMLI1H'] if name == 'ABIDO1H' else [])
        for nm, ch in zip(names, chunks):
            pts = [l['fix'] for l in ch if l['fix'] in F]
            top = max([l['up'] for l in ch if l['up']] or [9000])
            SIDS[nm] = dict(rwy=rw, cat=cat, spoken=spoken(nm), pts=pts, top=top, end=pts[-1],
                            spd=max([l['spd'] for l in ch if l['spd']] or [0]) or None)
print('STARs', len(STARS), 'SIDs', len(SIDS), file=sys.stderr)

# ── gates: the direction sectors traffic comes from and leaves to. Each has the STAR entry nearest its bearing and the
# SID exit fixes nearest it (C/D jets and A/B propellers have their own SIDs; not every exit has both)
STAR_ENTRY = sorted({s['pts'][0][0] for s in STARS.values()})
SID_END = sorted({s['end'] for s in SIDS.values()})
B = lambda f: brg(ARP, F[f])
# one gate per STAR entry fix (so no two arrival streams share an entry point), named by its direction from Dublin; a
# departure's SID is picked from its own destination's bearing (eidw-engine.js), the gate's exit is only the fallback
ENTRY_NAMES = {'BAMLI': 'N', 'NIMAT': 'NNE', 'BOYNE': 'NE', 'BAGSO': 'ENE', 'ABLIN': 'SE', 'VATRY': 'SSE', 'NIRIF': 'S', 'BUNED': 'SSW', 'SUTEX': 'SW', 'OSGAR': 'WSW', 'OLAPO': 'WNW'}
GATES = sorted(((g, round(B(e))) for e, g in ENTRY_NAMES.items()), key=lambda t: t[1])
ENTRY_PICK = {g: e for e, g in ENTRY_NAMES.items()}
def sid_exit(c, cat):
    ends = sorted({s['end'] for s in SIDS.values() if s['cat'] == cat}, key=lambda f: ang(B(f), c))
    return ends[0]
DIRS = {}
for g, c in GATES:
    DIRS[g] = dict(c=c, entry=ENTRY_PICK[g], exitCD=sid_exit(c, 'CD'), exitAB=sid_exit(c, 'AB'))

# ── traffic: the real boards, paired like Belfast's (tools/belfast_timetable.py): each arrival with a later departure of
# the same airline to the same place (35-200 minutes on the ground), a long-haul one with the next departure there.
ICAO = {'FR': 'RYR', 'RK': 'RUK', 'EI': 'EIN', 'EA': 'EAI', 'DL': 'DAL', 'UA': 'UAL', 'BA': 'BAW', 'CJ': 'CFE', 'LH': 'DLH', 'LX': 'SWR', 'SK': 'SAS', 'AA': 'AAL',
        'EK': 'UAE', 'TK': 'THY', 'TP': 'TAP', 'QR': 'QTR', 'KL': 'KLM', 'TO': 'TVF', 'AC': 'ACA', 'A5': 'HOP', 'AY': 'FIN', 'EY': 'ETD', 'VL': 'LCA', 'FI': 'ICE',
        'PC': 'PGT', 'A3': 'AEE', 'LM': 'LOG', 'VY': 'VLG', 'EW': 'EWG', 'HV': 'TRA', 'AF': 'AFR', 'MU': 'CES', 'U2': 'EZY', 'IB': 'IBE', 'SN': 'BEL', 'W6': 'WZZ', 'LS': 'EXS'}
SHORT = {'RYR': ['B738', 'B738', 'B38M'], 'RUK': ['B738'], 'EIN': ['A320', 'A20N', 'A320', 'A21N'], 'EAI': ['AT76'], 'BAW': ['A320'], 'CFE': ['E190'], 'DLH': ['A20N', 'A320'],
         'SWR': ['BCS3'], 'SAS': ['A20N'], 'TAP': ['A20N'], 'THY': ['A321'], 'KLM': ['B738', 'E195'], 'TVF': ['B738'], 'HOP': ['E190'], 'FIN': ['A320'], 'LCA': ['A20N'],
         'ICE': ['B38M'], 'PGT': ['A20N'], 'AEE': ['A20N'], 'LOG': ['AT76'], 'VLG': ['A320'], 'EWG': ['A320'], 'TRA': ['B738'], 'AFR': ['A320'], 'EZY': ['A320'],
         'IBE': ['A320'], 'BEL': ['A320'], 'WZZ': ['A21N'], 'EXS': ['B738']}
LONG = {'EIN': {'KBOS': 'A21N', 'KPHL': 'A21N', 'KCLE': 'A21N', 'KIND': 'A21N', 'KPIT': 'A21N', 'KRDU': 'A21N', 'KMSP': 'A21N', '*': 'A333'},
        'DAL': {'KJFK': 'B763', '*': 'A332'}, 'UAL': {'KEWR': 'B763', 'KIAD': 'B763', '*': 'B788'}, 'AAL': {'*': 'B788'}, 'UAE': {'*': 'B77W'},
        'QTR': {'*': 'B788'}, 'ETD': {'*': 'B789'}, 'ACA': {'*': 'A333'}, 'CES': {'*': 'A359'}, 'ICE': {'*': 'B38M'}}
def is_long(icao): return icao[0] in 'KCOZ'
def hm(s): h, m = s.split(':'); return int(h)*60 + int(m)
def hh(m): return '%02d:%02d' % (m // 60, m % 60)
def rows(path):
    days = json.load(open(path))['days']; ks = sorted(days)
    d0, d1 = days[ks[0]], days[ks[1]] if len(ks) > 1 else {'arr': [], 'dep': []}
    first = min(hm(r['sched']) for r in d0['arr'] + d0['dep'])
    # the boards start at the time they were read (07:00): the early morning comes from the next day's board
    def take(day, lo, hi): return [r for r in day if lo <= hm(r['sched']) < hi]
    arr = take(d0['arr'], first, 1440) + take(d1['arr'], 300, first); dep = take(d0['dep'], first, 1440) + take(d1['dep'], 300, first)
    def conv(r):
        m = re.match(r'^([A-Z0-9]{2})(\d+)$', r['flight'])
        if not m: return None
        a, n = m[1], m[2]; al = ICAO.get(a)
        place = BY_AIRLINE.get((r['place'], a)) or BOARD.get(r['place'])
        if not al or not place: return None
        if is_long(place):
            L = LONG.get(al, {}); t = L.get(place) or L.get('*') or 'A333'
        else:
            T = SHORT.get(al, ['A320']); t = T[int(n) % len(T)]
        return dict(cs=al + n, al=al, t=t, place=place, tm=hm(r['sched']))
    A = [x for x in map(conv, arr) if x]; D = [x for x in map(conv, dep) if x]
    seen = set(); A = [x for x in A if not (x['cs'] in seen or seen.add(x['cs']))]; seen = set(); D = [x for x in D if not (x['cs'] in seen or seen.add(x['cs']))]
    out, used = [], set()
    for a in sorted(A, key=lambda x: x['tm']):
        lo, hi = (60, 300) if is_long(a['place']) else (30, 200)
        c = [x for x in D if x['cs'] not in used and x['al'] == a['al'] and x['place'] == a['place'] and lo <= x['tm'] - a['tm'] <= hi]
        if c:
            x = min(c, key=lambda x: x['tm']); used.add(x['cs']); out.append([a['cs'], a['place'], hh(a['tm']), x['cs'], x['place'], hh(x['tm']), a['t'], '1234567', None])
        else:
            out.append([a['cs'], a['place'], hh(a['tm']), None, None, None, a['t'], '1234567', None])
    for x in D:
        if x['cs'] in used: continue
        out.append([None, None, None, x['cs'], x['place'], hh(x['tm']), x['t'], '1234567', None])
    out.sort(key=lambda r: hm(r[2] or r[5]))
    return out
TT = rows(sys.argv[1])
print('timetable rows', len(TT), 'movements', sum((r[0] is not None) + (r[3] is not None) for r in TT), file=sys.stderr)
used_ap = sorted({r[1] for r in TT if r[1]} | {r[4] for r in TT if r[4]} | {'EIDW', 'EICK', 'EINN', 'EGAA', 'EGAC', 'EIKN', 'EGPF', 'EGCC', 'EGLL'})

# ── the fixes the procedures use (and the navaids)
USED = set()
for s in STARS.values(): USED |= {p[0] for p in s['pts']}
for s in SIDS.values(): USED |= set(s['pts'])
APP_FIX = ['LAPMO', 'MAXEV', 'ABIVU', 'OKEDO', 'SUBOF', 'EBEZA', 'RAQAR', 'GANET', 'BAPDA', 'GARTI', 'INTOP', 'ABDOX', 'ERUDA', 'UMDAR', 'AMDIL', 'DW017', 'SIDUQ',
           'DW034', 'DW040', 'DW041', 'DW042', 'DW906', 'DW907', 'DW908', 'BATAF', 'DW031', 'UMOWI', 'DW007', 'DW003', 'DW033', 'IFBAP', 'OSLEX', 'KERAV', 'SORIN', 'ULTAG', 'OXPOH']
USED |= set(APP_FIX)
NAVS = {'DUB', 'BAL', 'DAP'}
fix_js = ',\n    '.join(', '.join(f"{k}: [{F[k][0]:.6f}, {F[k][1]:.6f}]" for k in row) for row in
                       [sorted(k for k in USED if k in F and k not in NAVS)[i:i+5] for i in range(0, len(USED), 5)] if row)
def js(o): return json.dumps(o, separators=(', ', ': ')).replace('"', "'")
star_js = ',\n    '.join(f"'{k}': {{ name: '{v['name']}', rwy: '{v['rwy']}', spoken: '{v['spoken']}', level: {v['level']}, pts: {js(v['pts'])} }}" for k, v in sorted(STARS.items()))
sid_js = ',\n    '.join(f"{k}: {{ rwy: '{v['rwy']}', cat: '{v['cat']}', spoken: '{v['spoken']}', pts: {js(v['pts'])}, top: {v['top']}{', spd: ' + str(v['spd']) if v['spd'] else ''} }}" for k, v in sorted(SIDS.items()))
dir_js = ',\n    '.join(f"{g}: {{ brg: {d['c']}, entry: '{d['entry']}', exit: {{ CD: '{d['exitCD']}', AB: '{d['exitAB']}' }} }}" for g, d in DIRS.items())
tt_js = ',\n    '.join(js(r).replace('null', 'null') for r in TT)
ap_js = ', '.join(f"{k}: [{AP[k][0]}, {AP[k][1]}, '{AP[k][2]}']" for k in used_ap if k in AP)
pl = {**{k.lower(): v for k, v in BOARD.items()}, **{AP[k][2].lower(): k for k in used_ap if k in AP}}
pl_js = ', '.join(f"'{k}': '{v}'" for k, v in sorted(pl.items()))
# where a destination's traffic goes: the gate whose bearing is nearest the great-circle bearing to it
# BAGSO takes the north of England, the Benelux, Germany's north and Scandinavia (up to 104°), ABLIN London, the south of
# England and the near continent beyond it (the flows split about halfway between the two entries' bearings)
def gate_of(b):
    if 75 <= b < 104: return 'ENE'
    if 104 <= b < 141: return 'SE'
    return min(GATES, key=lambda g: ang(g[1], b))[0]
pd = {k: gate_of(brg(ARP, AP[k][:2])) for k in AP if k != 'EIDW'}
pd_js = ', '.join(f"{k}: '{v}'" for k, v in sorted(pd.items()))
sidx = {e: round(B(e)) for e in SID_END}
sx_js = ', '.join(f"{k}: {v}" for k, v in sorted(sidx.items()))
T = open(os.path.join(HERE, 'eidw.template.js')).read()
for k, v in {'@@FIX@@': fix_js, '@@STARS@@': star_js, '@@SIDS@@': sid_js, '@@DIRS@@': dir_js, '@@TIMETABLE@@': tt_js, '@@AIRPORTS@@': ap_js,
             '@@PLACES@@': pl_js, '@@PLACE_DIR@@': pd_js, '@@SID_BRG@@': sx_js, '@@NROWS@@': str(len(TT))}.items():
    assert k in T, k; T = T.replace(k, v)
sys.stdout.write(T)
