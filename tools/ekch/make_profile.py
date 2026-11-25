#!/usr/bin/env python3
"""src/airports/ekch.js from the Jeppesen Copenhagen trip kit (terminal chart cycle 03-2020, in the user's folder) and the real
Copenhagen boards. Inputs: known.json (fix positions: openscope's EKCH airport file and the game's airway data; they agree with
the Jeppesen charts georeferenced by chart_fixes.py to a few hundredths of a mile), the points worked out here from the charts'
bearings, distances and radial/DME wording, the avionio CPH boards (boards-2026-11-24.json, a whole Tuesday), places.py, and
ekch.template.js (the hand-written parts: runways, procedures, units, the preferential runway system).
usage: make_profile.py boards-2026-11-24.json > src/airports/ekch.js"""
import json, math, re, sys, os
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from places import AP, place_icao
K = json.load(open(os.path.join(HERE, 'known.json'))); C = json.load(open(os.path.join(HERE, 'chartfix.json')))
ARP = (55 + 37.07/60, 12 + 39.36/60)
VAR = 4                                                     # magnetic variation 4°E (Jeppesen 2020): true = magnetic + 4
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
def mean(*ps): return (round(sum(p[0] for p in ps)/len(ps), 5), round(sum(p[1] for p in ps)/len(ps), 5))

# ── fixes: the known ones (openscope, airways) and those worked out from the charts
F = {k: tuple(v) for k, v in K.items()}
KAS = F['KAS']
# ERNOV, read off the STAR chart 10-2E (N56 10.0 E012 34.7: the chart's graticule); SOPUL and GITPO 15 NM from it on
# 208° and 169° (magnetic)
F['ERNOV'] = (56.1675, 12.5783)
F['SOPUL'] = dest(F['ERNOV'], 208 + VAR, 15.0); F['GITPO'] = dest(F['ERNOV'], 169 + VAR, 15.0)
# TIDVU, the far end of the three legs of the 10-2H: DESAS on 308° 18.1 NM, VENOM 283° 15.2 NM, VEGUD 253° 12.5 NM
F['TIDVU'] = mean(dest(F['DESAS'], 308 + VAR + 180, 18.1), dest(F['VENOM'], 283 + VAR + 180, 15.2), dest(F['VEGUD'], 253 + VAR + 180, 12.5))
# runway ends (pavement) and thresholds (OpenStreetMap; tools/ekch_ground.py): departure course true
RW = {'04L': ((55.5921912, 12.6035205), (55.6162133, 12.640677)), '22R': ((55.6162133, 12.640677), (55.5921912, 12.6035205)),
      '04R': ((55.6030842, 12.6330328), (55.6254458, 12.667644)), '22L': ((55.6254458, 12.667644), (55.6030842, 12.6330328)),
      '12': ((55.6275523, 12.629904), (55.612517, 12.6705341)), '30': ((55.612517, 12.6705341), (55.6275523, 12.629904))}
THR = {'04L': RW['04L'][0], '22R': dest(RW['22R'][0], brg(*RW['22R']), 600/1852), '04R': RW['04R'][0], '22L': RW['22L'][0],
       '12': (55.6241401, 12.6391219), '30': (55.6138522, 12.6669333)}
CRS = {k: brg(a, b) for k, (a, b) in RW.items()}
def along(rw, n):   # n NM before the threshold, on the extended centreline
    return dest(THR[rw], (CRS[rw] + 180) % 360, n)
def ahead(rw, n):   # n NM past the far end of the runway, on the departure track
    return dest(RW[rw][1], CRS[rw], n)
def at_dme(rw, d):  # the point on the extended centreline beyond the far end d NM from KAS
    t = 0.0
    while nm(ahead(rw, t), KAS) < d and t < 20: t += 0.01
    return ahead(rw, t)
def r(radial, d, frm=None): return dest(frm or KAS, radial + VAR, d)
# the ILS approaches (11-1 to 11-6): the intermediate fix at D9.3 (BASLO on 04L, LAMOX on 22L) and the final approach fix
# at D5.0 (D6.0 on 04R) of each ILS DME, whose DME reads zero at the threshold
F['LEVDO'] = at_dme('22L', 2.0); F['RUBAT2'] = at_dme('22R', 2.0)
for rw, d_if, d_faf in (('04L', 9.3, 5.0), ('04R', 9.2, 6.0), ('22L', 9.3, 5.0), ('22R', 9.3, 5.0), ('12', 9.0, 5.0), ('30', 9.3, 5.0)):
    F['CI' + rw] = along(rw, d_if); F['CF' + rw] = along(rw, d_faf)
print('BASLO off 04L IF', round(nm(F['BASLO'], F['CI04L']), 2), 'LAMOX off 22L IF', round(nm(F['LAMOX'], F['CI22L']), 2),
      'RUBAT', round(nm(F['RUBAT'], F['RUBAT2']), 2), 'LEVDO vs chart', round(nm(F['LEVDO'], tuple(C['LEVDO'][:2])), 2), file=sys.stderr)
del F['CI04L'], F['CI22L']   # BASLO and LAMOX are the 04L and 22L intermediate fixes
# the SIDs' first legs (10-3 series): 04L/04R straight ahead to 1,700 ft then direct; for the west and north SIDs (ODN,
# MIKSI, GOLGA, VEDAR) to 600 ft or D3.0 KAS (CH367, CH360), left onto a 008° track to 1,700 ft. 22R and 22L to D2.0 KAS
# (RUBAT, LEVDO) or 1,500 ft. 12 to KAS R076 (ODMEG) or 600 ft, then left onto 101°, or right onto 128°, 148° or 162°, to
# 1,700 ft. 30 to KAS R356 (INKIG) or 600 ft, then right onto 316° or left onto 286°, to 2,100 ft. Hidden points (CDxxx).
F['CD04LA'] = ahead('04L', 2.5); F['CD04RA'] = ahead('04R', 2.5)
F['CD04LN'] = dest(F['CH367'], 8 + VAR, 3.0); F['CD04RN'] = dest(F['CH360'], 8 + VAR, 3.0)
F['CD12L'] = dest(F['ODMEG'], 101 + VAR, 2.5)
for t in (128, 148, 162): F['CD12R%d' % t] = dest(F['ODMEG'], t + VAR, 2.5)
F['CD30R'] = dest(F['INKIG'], 316 + VAR, 3.0); F['CD30L'] = dest(F['INKIG'], 286 + VAR, 3.0)
LET = {'04R': 'A', '12': 'B', '22R': 'C', '30': 'D', '04L': 'E', '22L': 'F'}
NUM = {'ASTOS': '3A 4B 3C 4D 1E 1F', 'KEMAX': '4A 5B 4C 5D 1E 1F', 'BALOX': '4A 5B 4C 5D 1E 1F', 'SIMEG': '7A 8B 8C 8D 1E 1F',
       'BETUD': '1A 2B 1C 2D 1E 1F', 'NEXEN': '1A 2B 1C 2D 1E 1F', 'KOPEX': '1A 2B 1C 2D 1E 1F', 'LANGO': '1A 2B 1C 2D 1E 1F',
       'MIKSI': '2A 2B 1C 2D 2E 1F', 'ODN': '2A 2B 1C 2D 2E 1F', 'GOLGA': '2A 2B 1C 2D 2E 1F', 'VEDAR': '3A 2B 1C 2D 2E 1F'}
# the routes after the first leg, as the charts give them (10-3B to 10-3X8)
ROUTE = {
  'ASTOS': {'04': ['CH361'], '12': ['CH363'], '22': ['CH377', 'CH381', 'CH361'], '30': ['CH398']},
  'KEMAX': {'04': ['CH361'], '12': ['CH363', 'CH361'], '22': ['CH377', 'CH381', 'CH361'], '30': ['CH398', 'CH370', 'CH392']},
  'BALOX': {'04': ['CH361', 'CH362', 'CH365', 'GAVBA'], '12': ['CH382', 'GAVBA'], '22': ['CH377', 'CH381', 'CH382', 'GAVBA'], '30': ['CH399', 'CH374', 'CH365', 'GAVBA']},
  'SIMEG': {'04': ['CH361', 'CH362', 'CH364', 'DENEK'], '12': ['DENEK'], '22': ['CH377', 'CH381', 'DENEK'], '30': ['CH399', 'CH374', 'CH364', 'DENEK']},
  'BETUD': {'04': ['CH361', 'CH362', 'CH366', 'BISTA'], '12': ['CH396', 'BISTA'], '22': ['BISTA'], '30': ['CH399', 'CH374', 'BISTA']},
  'NEXEN': {'04': ['CH361', 'CH362', 'CH366', 'BISTA'], '12': ['CH396', 'BISTA'], '22': ['BISTA'], '30': ['CH399', 'CH374', 'BISTA']},
  'KOPEX': {'04': ['CH361', 'CH362', 'CH363', 'CH365', 'MAXEL'], '12': ['CH395', 'MAXEL'], '22': ['MAXEL'], '30': ['CH399', 'CH374', 'MAXEL']},
  'LANGO': {'04': ['CH361', 'CH362', 'CH363', 'TOBIS'], '12': ['CH365', 'TOBIS'], '22': ['TOBIS'], '30': ['CH399', 'TOBIS']},
  'MIKSI': {'04': ['CH369', 'SORGA'], '12': ['CH363', 'CH361', 'CH378', 'SORGA'], '22': ['CH384', 'SORGA'], '30': ['CH398', 'SORGA']},
  'ODN':   {'04': ['CH368', 'CH371', 'DOBEL'], '12': ['CH363', 'CH361', 'CH378', 'DOBEL'], '22': ['DOBEL'], '30': ['CH399', 'DOBEL']},
  'GOLGA': {'04': ['CH370', 'MIRGO', 'TISKA'], '12': ['CH363', 'CH389', 'CH379', 'MIRGO', 'TISKA'], '22': ['CH385', 'MIRGO', 'TISKA'], '30': ['CH398', 'MIRGO', 'TISKA']},
  'VEDAR': {'04': ['CH370', 'NOVPO'], '12': ['CH363', 'CH390', 'NOVPO'], '22': ['CH386', 'NOVPO'], '30': ['CH398', 'NOVPO']},
}
# the first leg's hidden points, by runway and the way the SID turns off it
TURN12 = {'ASTOS': 'L', 'KEMAX': 'L', 'BALOX': 148, 'SIMEG': 128, 'BETUD': 162, 'NEXEN': 162, 'KOPEX': 162, 'LANGO': 162, 'MIKSI': 'L', 'ODN': 'L', 'GOLGA': 'L', 'VEDAR': 'L'}
TURN30 = {'ASTOS': 'R', 'KEMAX': 'R', 'BALOX': 'L', 'SIMEG': 'L', 'BETUD': 'L', 'NEXEN': 'L', 'KOPEX': 'L', 'LANGO': 'L', 'MIKSI': 'R', 'ODN': 'L', 'GOLGA': 'R', 'VEDAR': 'R'}
NORTH = {'MIKSI', 'ODN', 'GOLGA', 'VEDAR'}
def first(ex, rw):
    if rw in ('04L', '04R'): return ['CD%sN' % rw] if ex in NORTH else ['CD%sA' % rw]
    if rw == '22R': return ['RUBAT']
    if rw == '22L': return ['LEVDO']
    if rw == '12': t = TURN12[ex]; return ['ODMEG', 'CD12L' if t == 'L' else 'CD12R%d' % t]
    return ['INKIG', 'CD30' + TURN30[ex]]
SID_PTS = {}
for ex, nums in NUM.items():
    for code in nums.split():
        rw = next(k for k, v in LET.items() if v == code[1])
        SID_PTS[ex + code] = (rw, first(ex, rw) + ROUTE[ex][rw[:2]] + [ex])
NATO = dict(A='Alfa', B='Bravo', C='Charlie', D='Delta', E='Echo', F='Foxtrot')
NUMW = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']
def spoken(name):
    m = re.match(r'^([A-Z]+)(\d)([A-Z])$', name)
    w = {'ODN': 'Odin'}.get(m[1], m[1].title())
    return f'{w} {NUMW[int(m[2])]} {NATO[m[3]]}'
# ── STARs (10-2E to 10-2J): conventional arrivals that end in radar vectors, one designator per landing runway (the letter
# as the SIDs': A 04R, B 12, C 22R, D 30, E 04L, F 22L). ERNOV from the north to SOPUL (GITPO for 12 and 30), MONAK from
# the south over CDA to NEKSO (KUBIS), TESPI from the west by ROSBI to TNO, TUDLO from the south-west by LUGAS to KOR, TIDVU
# from the east (over Sweden) to VENOM (DESAS for 12, VEGUD for 30). The P-RNAV arrivals to the ILS (10-2 to 10-2D) are
# flown by request: here the vectors.
STAR_NUM = {'ERNOV': '1', 'MONAK': '2', 'TESPI': '2', 'TUDLO': '2', 'TIDVU': '1'}
def star_pts(entry, rw):
    L = LET[rw]
    if entry == 'ERNOV': return [['ERNOV', 11000], ['SOPUL' if L in 'ACEF' else 'GITPO', 8000]]
    if entry == 'MONAK': return [['MONAK'], ['CDA', 10000], ['NEKSO' if L in 'ACEF' else 'KUBIS', 8000 if L in 'AED' else 10000]]
    if entry == 'TESPI': return [['TESPI'], ['ROSBI'], ['TNO', 12000]]
    if entry == 'TUDLO': return [['TUDLO'], ['LUGAS'], ['KOR', 8000 if L == 'D' else 11000]]
    return [['TIDVU', 8000], ['VENOM' if L in 'ACEF' else 'DESAS' if L == 'B' else 'VEGUD', 5000]]
STARS = {}
for e, n in STAR_NUM.items():
    for rw, L in LET.items():
        pts = star_pts(e, rw); STARS[e + n + L] = (pts, pts[-1][0], rw)
for n, (pts, iaf, rw) in STARS.items():
    for p in pts: assert p[0] in F, (n, p)
for n, (rw, pts) in SID_PTS.items():
    for f in pts: assert f in F, (n, f)

# ── traffic: the real boards, paired: each arrival with a later departure of the same airline, to the same place where
# there is one (30-200 minutes on the ground; 60-300 for long haul), else the next of its bank; the rest as single movements
ICAO = {'SK': 'SAS', 'D8': 'NSZ', 'DY': 'NAX', 'FR': 'RYR', 'LH': 'DLH', '6I': 'MMD', 'QY': 'BCS', 'KL': 'KLM', 'BA': 'BAW', 'AY': 'FIN', 'R6': 'DNU',
        'AF': 'AFR', 'U2': 'EZY', 'TK': 'THY', 'LX': 'SWR', 'EK': 'UAE', 'SN': 'BEL', 'FI': 'ICE', 'TP': 'TAP', 'SQ': 'SIA', 'EY': 'ETD', 'DK': 'VKG',
        'LO': 'LOT', 'RC': 'FLI', 'OS': 'AUA', 'PC': 'PGT', 'GL': 'GRL', 'EC': 'EJU', 'BT': 'BTI', 'LG': 'LGL', 'CA': 'CCA', 'CK': 'CKK', 'DX': 'DTR',
        'IB': 'IBE', 'QR': 'QTR', 'VF': 'TKJ', 'VY': 'VLG', 'OU': 'CTN', 'A3': 'AEE', 'EW': 'EWG', 'JU': 'ASL', '3V': 'TAY', '5O': 'FPO', 'TG': 'THA',
        '6B': 'BLX', 'WX': 'BCY', 'FH': 'FHY', 'OZ': 'AAR'}
SHORT = {'SAS': ['A20N', 'A20N', 'CRJ9', 'A20N', 'E195', 'AT76', 'A21N', 'A320', 'A20N', 'CRJ9'], 'NSZ': ['B38M', 'B738'], 'NAX': ['B38M', 'B738'],
         'RYR': ['B738'], 'DLH': ['A20N', 'CRJ9', 'A321'], 'MMD': ['AT76'], 'BCS': ['A306'], 'KLM': ['E295', 'B738', 'E195'], 'BAW': ['A320', 'A20N'],
         'FIN': ['A320', 'A321', 'AT76'], 'DNU': ['AT76'], 'AFR': ['A20N', 'A320'], 'EZY': ['A20N', 'A320'], 'THY': ['A21N', 'A321'], 'SWR': ['BCS3', 'A320'],
         'BEL': ['A320'], 'ICE': ['B38M'], 'TAP': ['A20N'], 'VKG': ['A321'], 'LOT': ['E195', 'B38M'], 'FLI': ['A320'], 'AUA': ['A320'], 'PGT': ['A20N'],
         'EJU': ['A20N'], 'BTI': ['BCS3'], 'LGL': ['DH8D', 'E295'], 'DTR': ['AT76'], 'IBE': ['A20N'], 'TKJ': ['B38M'], 'VLG': ['A320'], 'CTN': ['A20N'],
         'AEE': ['A20N'], 'EWG': ['A20N'], 'ASL': ['A320'], 'TAY': ['B738'], 'FPO': ['B738'], 'BLX': ['B38M'], 'BCY': ['CRJ9'], 'FHY': ['A320']}
LONG = {'SAS': {'*': ['A333', 'A359'], 'KBOS': 'A21N', 'CYYZ': 'A21N', 'KDCA': 'A21N', 'KMIA': 'A333', 'KATL': 'A333', 'KIAH': 'A333',
                'KORD': 'A359', 'KLAX': 'A359', 'KSFO': 'A359', 'RJAA': 'A359', 'ZSPD': 'A359', 'KJFK': 'A333', 'BIKF': 'A20N'},
        'UAE': {'*': 'A388'}, 'SIA': {'*': 'A359'}, 'ETD': {'*': 'B789'}, 'QTR': {'*': 'B788'}, 'THA': {'*': 'A359'}, 'CCA': {'*': 'A333'},
        'CKK': {'*': 'B77W'}, 'GRL': {'*': 'A333'}, 'AAR': {'*': 'B77W'}, 'THY': {'*': 'A21N'}, 'ICE': {'*': 'B38M'}}
def is_long(icao): return icao[0] in 'KCMSTRZVWOFDHPNUYB' and not icao.startswith(('GC', 'GM', 'GV', 'HE', 'DT', 'OJ', 'OL', 'LL', 'BI')) or icao.startswith(('OM', 'OT', 'OE', 'OB', 'OK'))
def hm(s): h, m = s.split(':'); return int(h)*60 + int(m)
def hh(m): return '%02d:%02d' % (m // 60 % 24, m % 60)
DAY = '2026-11-24'
def rows(path):
    days = json.load(open(path))['days']; d0 = days[DAY]; off = d0['utcOffsetMin']
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
    # a hub: SAS's aircraft come in from one city and go out to another, so after the out-and-back pairs (the same place),
    # each arrival takes the next departure of the same airline, the same class (long haul or not) and family of type,
    # 35 to 150 minutes later (90 to 300 for the long haul): the rotation a bank gives it
    out, used, pair = [], set(), {}
    fam = lambda t: 'L' if t in ('A333', 'A359', 'A388', 'B77W', 'B788', 'B789', 'A306') else 'P' if t in ('AT76', 'DH8D') else 'R' if t in ('CRJ9', 'E195', 'E295') else 'N'
    AS = sorted(A, key=lambda x: x['tm'])
    for a in AS:
        lo, hi = (60, 300) if is_long(a['place']) else (30, 200)
        c = [x for x in D if x['cs'] not in used and x['al'] == a['al'] and x['place'] == a['place'] and lo <= (x['tm'] - a['tm']) % 1440 <= hi]
        if c: x = min(c, key=lambda x: (x['tm'] - a['tm']) % 1440); used.add(x['cs']); pair[a['cs']] = x
    for a in AS:
        if a['cs'] in pair: continue
        lo, hi = (90, 300) if is_long(a['place']) else (35, 150)
        c = [x for x in D if x['cs'] not in used and x['al'] == a['al'] and is_long(x['place']) == is_long(a['place']) and fam(x['t']) == fam(a['t'])
             and lo <= x['tm'] - a['tm'] <= hi]
        if c: x = min(c, key=lambda x: x['tm']); used.add(x['cs']); pair[a['cs']] = x
    for a in AS:
        x = pair.get(a['cs'])
        if x: out.append([a['cs'], a['place'], hh(a['tm']), x['cs'], x['place'], hh(x['tm']), a['t'], '1234567', None])
        else: out.append([a['cs'], a['place'], hh(a['tm']), None, None, None, a['t'], '1234567', None])
    for x in D:
        if x['cs'] not in used: out.append([None, None, None, x['cs'], x['place'], hh(x['tm']), x['t'], '1234567', None])
    out.sort(key=lambda r: hm(r[2] or r[5]))
    return out
TT = rows(sys.argv[1])
print('timetable rows', len(TT), 'movements', sum((r[0] is not None) + (r[3] is not None) for r in TT), file=sys.stderr)
# the capacity modes through the day from the boards themselves: each hour (local) an arrival peak (L: the second landing
# runway, dependent parallel approaches) where the arrivals outnumber the departures by half again, a departure peak (S)
# the other way
def loc(t): return (hm(t) + 60) % 1440       # UTC to Copenhagen winter time
bins = {}
for r in TT:
    if r[2]: bins.setdefault(loc(r[2])//60, [0, 0])[0] += 1
    if r[5]: bins.setdefault(loc(r[5])//60, [0, 0])[1] += 1
peaks = []
for b in range(6, 23):
    a, d = bins.get(b, [0, 0]); m = 'L' if a >= 18 and a >= 1.4*d else 'S' if d >= 18 and d >= 1.4*a else 'O'
    if peaks and peaks[-1][2] == m and peaks[-1][1] == b*60: peaks[-1][1] = (b + 1)*60
    else: peaks.append([b*60, (b + 1)*60, m])
peaks_js = ', '.join(f"[hm({a//60}, {a%60}), hm({b//60}, {b%60}), '{m}']" for a, b, m in peaks)
print('peaks', peaks, file=sys.stderr)
used_ap = sorted({r[1] for r in TT if r[1]} | {r[4] for r in TT if r[4]} | {'EKCH', 'ESMS', 'EKBI', 'EKAH', 'ESSA', 'ENGM', 'EGLL', 'EHAM', 'EDDF', 'LFPG', 'KJFK', 'ESGG', 'EGSS', 'KORD', 'EDDM', 'EGKK'} & set(AP))
# ── gates: one per STAR entry, bearing from the field
GATES = {e: dict(c=round(brg(ARP, F[e])), entry=e, star=e + STAR_NUM[e]) for e in STAR_NUM}
def gate_of(b): return min(GATES, key=lambda g: ang(GATES[g]['c'], b))
USED = set()
for pts, iaf, rw in STARS.values(): USED |= {p[0] for p in pts}
for rw, pts in SID_PTS.values(): USED |= set(pts)
USED |= {k for k in F if re.match(r'C[IF](04|22|12|30)', k)} | {'KAS', 'CDA', 'TNO', 'KOR', 'ODN', 'ABEGI', 'ADOVI', 'BASLO', 'DOPEM', 'EPOXO', 'ERPUK', 'LAMOX', 'ULTIS', 'ROSBI', 'LUGAS'}
NAVS = {'KAS': ('Kastrup VOR/DME', '112.50'), 'CDA': ('Codan VOR/DME', '114.90'), 'TNO': ('Trano VOR/DME', '117.40'),
        'KOR': ('Korsa VOR/DME', '112.80'), 'ODN': ('Odin VOR/DME', '115.50')}
fixes = sorted(k for k in USED if k not in NAVS)
fix_js = ',\n    '.join(', '.join(f"{k}: [{F[k][0]:.5f}, {F[k][1]:.5f}]" for k in fixes[i:i+5]) for i in range(0, len(fixes), 5))
nav_js = ',\n    '.join(f"{k}: {{ p: [{F[k][0]:.5f}, {F[k][1]:.5f}], name: '{v[0]}', freq: '{v[1]}' }}" for k, v in NAVS.items())
def js(o): return json.dumps(o, separators=(', ', ': ')).replace('"', "'")
star_js = ',\n    '.join(f"'{k}': {{ name: '{k}', spoken: '{spoken(k)}', rwy: '{rw}', iaf: '{iaf}', pts: {js(pts)} }}" for k, (pts, iaf, rw) in STARS.items())
sid_js = ',\n    '.join(f"'{k}': {{ rwy: '{rw}', spoken: '{spoken(k)}', pts: {js(pts)} }}" for k, (rw, pts) in SID_PTS.items())
dir_js = ',\n    '.join(f"{g}: {{ brg: {d['c']}, entry: '{d['entry']}', star: '{d['star']}' }}" for g, d in GATES.items())
tt_js = ',\n    '.join(js(r) for r in TT)
ap_js = ', '.join(f"{k}: [{AP[k][0]}, {AP[k][1]}, {json.dumps(AP[k][2], ensure_ascii=False)}]" for k in used_ap)
pd_js = ', '.join(f"{k}: '{gate_of(brg(ARP, AP[k][:2]))}'" for k in used_ap if k != 'EKCH')
sx_js = ', '.join(f"{k}: {round(brg(ARP, F[k]))}" for k in NUM)
pl = {}
for r in TT:
    for k in (r[1], r[4]):
        if k: pl[AP[k][2].lower()] = k
pl_js = ', '.join(f"{json.dumps(k, ensure_ascii=False)}: '{v}'" for k, v in sorted(pl.items()))
T = open(os.path.join(HERE, 'ekch.template.js')).read()
for k, v in {'@@FIX@@': fix_js, '@@NAV@@': nav_js, '@@STARS@@': star_js, '@@SIDS@@': sid_js, '@@DIRS@@': dir_js, '@@TIMETABLE@@': tt_js, '@@AIRPORTS@@': ap_js,
             '@@PLACES@@': pl_js, '@@PLACE_DIR@@': pd_js, '@@SID_BRG@@': sx_js, '@@NROWS@@': str(len(TT)), '@@PEAKS@@': peaks_js}.items():
    assert k in T, k; T = T.replace(k, v)
sys.stdout.write(T)
