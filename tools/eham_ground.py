# Amsterdam Schiphol (EHAM) aerodrome layout from OpenStreetMap + the Dutch AIP (AIRAC AMDT 12/2026) -> src/airports/eham-ground.js
# usage: python3 tools/eham_ground.py aerodrome.json tools/eham/chart.json tools/eham/stands_aip.json src/airports/eham-ground.js
# Six runways, every one with its own frame (m from its low-numbered end, offset to the left), holding points and crossings:
#   18R/36L Polderbaan (3,800 x 60 m; 18R landing only, 36L take-off only), 18C/36C Zwanenburgbaan, 18L/36R Aalsmeerbaan
#   (18L take-off only, 36R landing only), 06/24 Kaagbaan, 09/27 Buitenveldertbaan (crosses 18L/36R) and 04/22 Oostbaan.
# Sources: the runway ends and thresholds are the AIP's (AD 2.12, AD 2.13 for the displaced thresholds); the taxiway
# centrelines, aprons and buildings OpenStreetMap's (the API's map call, tiles over the aerodrome: tools/eham/osm_fetch.py);
# every holding position is the AIP ground movement chart's (GMC-1: tools/eham/chart_feat.py reads each stop bar's row of
# lights and the taxiway names off it); the taxiways OpenStreetMap leaves unnamed take the chart's name printed beside them
# (or, failing that, their neighbours'); every stand is at the AIP's INS coordinates (APDC charts: tools/eham/stands.py).
import json, math, re, sys, os, collections
import numpy as np
OSM, CHART, STANDS_JSON, OUT = sys.argv[1:5]
A = (52 + 18/60 + 29/3600, 4 + 45/60 + 51/3600)                      # ARP 521829N 0044551E (AD 2.2)
KX = 60*1852*math.cos(math.radians(A[0])); KY = 60*1852
def en(lat, lon): return ((lon - A[1])*KX, (lat - A[0])*KY)
def dms(s):
    m = re.match(r'^(\d{2,3})(\d{2})(\d{2}(?:\.\d+)?)([NSEW])$', s); v = int(m[1]) + int(m[2])/60 + float(m[3])/3600
    return -v if m[4] in 'SW' else v
P = lambda la, lo: en(dms(la), dms(lo))
r1 = lambda v: round(v, 1)
E = json.load(open(OSM))['elements']
CH = json.load(open(CHART))
NODE = {}
for e in E:
    if e['type'] == 'way' and 'geometry' in e:
        for nid, g in zip(e['nodes'], e['geometry']): NODE[nid] = en(g['lat'], g['lon'])
    if e['type'] == 'node': NODE[e['id']] = en(e['lat'], e['lon'])
def _ll(p): return (A[0] + p[1]/KY, A[1] + p[0]/KX)
_new = [-100]
def _nn(p, tags=None):
    _new[0] -= 1; i = _new[0]; NODE[i] = p; la, lo = _ll(p)
    E.append({'type': 'node', 'id': i, 'lat': la, 'lon': lo, **({'tags': tags} if tags else {})}); return i
ways = [e for e in E if e['type'] == 'way']
WAY = {w['id']: w for w in ways}
def tagged(w, *k): return w.get('tags', {}).get('aeroway') in k
def insert_at(w, i, q, tags=None):
    n = _nn(q, tags); la, lo = _ll(q); w['nodes'].insert(i + 1, n); w['geometry'].insert(i + 1, {'lat': la, 'lon': lo}); return n

# ── runways (AD 2.12): pavement ends a (the low-numbered end) and b, the thresholds where they are displaced (AD 2.13:
# 06 by 244 m, 09 by 90 m, 36C by 450 m, 18R by 270 m; 18L by 575 m for an emergency landing only) and the threshold
# elevations (ft)
RWYS = [
    ('0422', '04', '22', P('521801.35N', '0044700.55E'), P('521850.51N', '0044810.90E'), {'04': 0, '22': 0}, -13, -14),
    ('0624', '06', '24', P('521716.57N', '0044403.07E'), P('521815.66N', '0044636.93E'), {'06': 244, '24': 0}, -11, -12),
    ('0927', '09', '27', P('521859.92N', '0044446.83E'), P('521906.16N', '0044748.88E'), {'09': 90, '27': 0}, -12, -12),
    ('18C36C', '18C', '36C', P('521953.04N', '0044424.11E'), P('521806.42N', '0044414.32E'), {'18C': 0, '36C': 450}, -12, -12),
    # 18L/36R: the AIP's 18L threshold (521858.19N 0044646.89E) is displaced 575 m from the pavement's north end
    ('18L36R', '18L', '36R', None, P('521726.97N', '0044638.45E'), {'18L': 575, '36R': 0}, -12, -11),
    ('18R36L', '18R', '36L', P('522145.65N', '0044243.01E'), P('521942.88N', '0044231.81E'), {'18R': 270, '36L': 0}, -13, -12),
]
runways, FR = [], {}
# the 24 end: the pavement runs on 60 m past the 24 threshold (the stopway, AD 2.12), up to 18L/36R; the full-length
# entry S7E joins it there (TORA 3,435 m from S7E)
EXT = {'0624': (0, 60)}
for rid, lo, hi, a, b, dth, elo, ehi in RWYS:
    if rid in EXT:
        d = math.dist(a, b); u_ = ((b[0]-a[0])/d, (b[1]-a[1])/d); e0, e1 = EXT[rid]
        a = (a[0] - u_[0]*e0, a[1] - u_[1]*e0); b = (b[0] + u_[0]*e1, b[1] + u_[1]*e1); dth = {lo: dth[lo] + e0, hi: dth[hi] + e1}
    if a is None:
        t = P('521858.19N', '0044646.89E'); d = math.dist(t, b); a = (t[0] + (t[0]-b[0])/d*575, t[1] + (t[1]-b[1])/d*575)
    L = math.dist(a, b); U = ((b[0]-a[0])/L, (b[1]-a[1])/L); N = (-U[1], U[0])
    mo = (lambda a, U, N: lambda p: ((p[0]-a[0])*U[0] + (p[1]-a[1])*U[1], (p[0]-a[0])*N[0] + (p[1]-a[1])*N[1]))(a, U, N)
    thr = {lo: r1(dth[lo]), hi: r1(L - dth[hi])}
    print(rid, 'len', r1(L), 'thr', thr)
    runways.append({'id': rid, 'lo': lo, 'hi': hi, 'a': [r1(a[0]), r1(a[1])], 'b': [r1(b[0]), r1(b[1])], 'len': r1(L), 'thr': thr, 'elev': {lo: elo, hi: ehi},
                    'width': 60 if rid == '18R36L' else 45})
    FR[rid] = {'a': a, 'U': U, 'N': N, 'L': L, 'mo': mo, 'thr': thr, 'lo': lo, 'hi': hi, 'w': 60 if rid == '18R36L' else 45}
def onC_of(R): return lambda p: abs(p[1]) < 3 and -60 < p[0] < R['L'] + 60
def onAny(p): return any(onC_of(R)(R['mo'](p)) for R in FR.values())

# ── taxi ways
def tname(r):
    """the chart's names as written (A, A19W, S7E, W13); OpenStreetMap's "A-12" is A12"""
    if not r: return None
    r = re.sub(r'\(.*?\)', '', r).strip().upper()
    r = re.sub(r'^([A-Z]+)-?(\d+)(-\d+)?$', r'\1\2', r).replace('-', '').replace(' ', '')
    return r if re.fullmatch(r'[A-Z]{1,2}\d{0,2}[A-Z]?', r) else None
taxi = [w for w in ways if tagged(w, 'taxiway', 'taxilane') and 'geometry' in w and w.get('tags', {}).get('access') != 'no'
        and w.get('tags', {}).get('service') != 'drive-through' and not re.search(r'(?i)vehicle|road', w.get('tags', {}).get('name', ''))]
# keep only what lies on the aerodrome (the tiles take in a margin)
taxi = [w for w in taxi if any(-4200 < NODE[n][0] < 3200 and -2600 < NODE[n][1] < 6400 for n in w['nodes'])]
# The chart's names: each word goes to the taxiway way nearest it (within 45 m); a way OpenStreetMap leaves unnamed takes
# the nearest such name. Holding position labels (S7E, W1 ...) name their exit taxiways this way too.
def seg_d(p, a, b):
    dx, dy = b[0]-a[0], b[1]-a[1]; L2 = dx*dx + dy*dy or 1e-9; u = max(0, min(1, ((p[0]-a[0])*dx + (p[1]-a[1])*dy)/L2))
    return math.dist(p, (a[0] + dx*u, a[1] + dy*u))
def way_d(p, w): return min(seg_d(p, NODE[w['nodes'][i]], NODE[w['nodes'][i+1]]) for i in range(len(w['nodes']) - 1))
IHP_NAMES = {'VK', 'VL', 'VM', 'AS', 'BS', 'GD', 'GL', 'HN'}
# Z1, Z2 (on Z, south of the 36C threshold) and Y1, Y2 (on Y, north of 18C): runway-holding positions that keep taxiing
# traffic out of 18C/36C's obstacle limitation surfaces (AD 2.20 para 14); there is no runway beyond them
OLS_HOLDS = {'Z1', 'Z2', 'Y1', 'Y2'}           # AD 2.20 para 14: the intermediate holding positions
STAND_LABELS = {'B15', 'C6', 'G71', 'G73', 'R71', 'R77'}
CHWORDS = [(t, (x, y)) for t, x, y in CH['words']]
lab_for = collections.defaultdict(list)
for t, p in CHWORDS:
    if t in IHP_NAMES or t in STAND_LABELS or re.fullmatch(r'P\d+[AB]?', t): continue
    cand = sorted(((way_d(p, w), w['id']) for w in taxi if any(math.dist(p, NODE[n]) < 400 for n in w['nodes'][::2] + [w['nodes'][-1]])))
    if cand and cand[0][0] < 45: lab_for[cand[0][1]].append((cand[0][0], t))
named_by_chart = 0
for w in taxi:
    if tname(w['tags'].get('ref')): continue
    if lab_for.get(w['id']): w['tags'] = {**w['tags'], 'ref': min(lab_for[w['id']])[1]}; named_by_chart += 1
print('unnamed ways named off the chart', named_by_chart)

# ── OpenStreetMap against the chart: what it lacks
def nearest_taxi_node(p, ok=lambda w: True):
    return min(((math.dist(NODE[n], p), n) for w in taxi if ok(w) for n in w['nodes']), key=lambda t: t[0])[1]
def add_way(ref, pts, start=None, end=None):
    ids = ([start] if start else []) + [_nn(q) for q in pts] + ([end] if end else [])
    w = {'type': 'way', 'id': -len(ways) - 1000, 'nodes': ids, 'geometry': [{'lat': _ll(NODE[i])[0], 'lon': _ll(NODE[i])[1]} for i in ids], 'tags': {'aeroway': 'taxiway', 'ref': ref}}
    E.append(w); ways.append(w); taxi.append(w); WAY[w['id']] = w; return w
def on_centre(rid, m):
    R = FR[rid]; return (R['a'][0] + R['U'][0]*m, R['a'][1] + R['U'][1]*m)
# N1 runs on north to the 27 end (the 27 full-length entry): OpenStreetMap stops it 250 m short
_n1 = nearest_taxi_node((2224, 905), lambda w: tname(w['tags'].get('ref')) == 'N1' or not w['tags'].get('ref'))
add_way('N1', [(2219, 1000), (2216, 1095)], start=_n1, end=_nn(on_centre('0927', FR['0927']['L'] - 8)))
# G runs straight on through its junction with G5 at the 04 end (the chart); OpenStreetMap has only the curves either side
add_way('G', [], start=nearest_taxi_node((1550, -946)), end=nearest_taxi_node((1567, -908)))
# taxiways that cross with no shared node in OpenStreetMap (A19 over A19W and A19E): a junction where they cross
def _xpt(p, q, a, b):
    d = (q[0]-p[0])*(b[1]-a[1]) - (q[1]-p[1])*(b[0]-a[0])
    if abs(d) < 1e-9: return None
    t = ((a[0]-p[0])*(b[1]-a[1]) - (a[1]-p[1])*(b[0]-a[0]))/d; u = ((a[0]-p[0])*(q[1]-p[1]) - (a[1]-p[1])*(q[0]-p[0]))/d
    return (p[0] + t*(q[0]-p[0]), p[1] + t*(q[1]-p[1])) if 0.02 < t < 0.98 and 0.02 < u < 0.98 else None
_cell = collections.defaultdict(list)
for w in taxi:
    for i in range(len(w['nodes']) - 1):
        a, b = NODE[w['nodes'][i]], NODE[w['nodes'][i+1]]
        for cx_ in range(int(min(a[0], b[0])//80), int(max(a[0], b[0])//80) + 1):
            for cy_ in range(int(min(a[1], b[1])//80), int(max(a[1], b[1])//80) + 1): _cell[(cx_, cy_)].append((w['id'], i))
_hits, _seen = collections.defaultdict(list), set()
for lst in _cell.values():
    for j, (w1, i1) in enumerate(lst):
        for w2, i2 in lst[j+1:]:
            if w1 == w2 or (w1, i1, w2, i2) in _seen: continue
            _seen.add((w1, i1, w2, i2)); A1, B1 = WAY[w1]['nodes'][i1:i1+2]; A2, B2 = WAY[w2]['nodes'][i2:i2+2]
            if {A1, B1} & {A2, B2}: continue
            if WAY[w1].get('tags', {}).get('layer') != WAY[w2].get('tags', {}).get('layer'): continue
            q = _xpt(NODE[A1], NODE[B1], NODE[A2], NODE[B2])
            if q: _hits[w1].append((i1, q)); _hits[w2].append((i2, q))
_jn = {}
for wid, hs_ in _hits.items():
    w = WAY[wid]
    for i, q in sorted(hs_, key=lambda t: (-t[0], -math.dist(NODE[w['nodes'][t[0]]], t[1]))):
        k = (round(q[0], 1), round(q[1], 1))
        if k in _jn:
            n = _jn[k]; la, lo = _ll(q); w['nodes'].insert(i + 1, n); w['geometry'].insert(i + 1, {'lat': la, 'lon': lo})
        else: _jn[k] = insert_at(w, i, q)
print('junctions added where taxiways cross', len(_jn))
# S7 (with S7E beyond it) is the full-length entry to 24: the S7 stop bar is the holding position for the line-up and
# for crossing to S7W; S7E's own bar at the edge of the 24 end's pavement is not modelled separately (24 departures
# "via S7E" go to S7)
MANUAL_HOLDS = []

# ── holding positions: one per stop bar on the chart (rows of lights; a double row, ten lights, is two bars side by side
# on a twin-lane taxiway). Each goes where its row crosses a taxiway centreline, as a node on that way. OpenStreetMap's own
# holding positions are not used: they are fewer than the chart's and their refs are runway designators ("36C-18C").
for e in E:
    if e['type'] == 'node' and e.get('tags', {}).get('aeroway') == 'holding_position': e['tags'] = {k: v for k, v in e['tags'].items() if k != 'aeroway'}
rows = []
for row in CH['rows']:
    Pr = np.array(row); c = Pr.mean(0); u = np.linalg.svd(Pr - c)[2][0]; a = (Pr - c) @ u
    if len(Pr) >= 8 and min(np.abs(a)) > 2: rows += [Pr[a < 0], Pr[a >= 0]]
    else: rows.append(Pr)
def seg_x(p, q, a, b):
    d = (q[0]-p[0])*(b[1]-a[1]) - (q[1]-p[1])*(b[0]-a[0])
    if abs(d) < 1e-9: return None
    t = ((a[0]-p[0])*(b[1]-a[1]) - (a[1]-p[1])*(b[0]-a[0]))/d; s = ((a[0]-p[0])*(q[1]-p[1]) - (a[1]-p[1])*(q[0]-p[0]))/d
    return (t, s) if 0 <= t <= 1 and 0 <= s <= 1 else None
def label_near(c, ok, within):
    best = sorted((math.dist(c, p), t) for t, p in CHWORDS if ok(t))
    return best[0][1] if best and best[0][0] <= within else None
CHART_HOLDS = []
for Pr in rows:
    c = Pr.mean(0)
    if not (-4200 < c[0] < 3200 and -2600 < c[1] < 6400): continue        # the legend's sample bar
    u = np.linalg.svd(Pr - c)[2][0] if len(Pr) > 1 else np.array([1.0, 0]); ext = max(abs((Pr - c) @ u)) + 14
    p, q = c - u*ext, c + u*ext
    hits = []
    for w in taxi:
        ns = w['nodes']
        for i in range(len(ns) - 1):
            r = seg_x(p, q, NODE[ns[i]], NODE[ns[i+1]])
            if r: hits.append((abs(r[0] - 0.5), w, i, r[1]))
    near_p = label_near(c, lambda t: re.fullmatch(r'P\d+[AB]?', t), 110)
    if near_p and not label_near(c, lambda t: t in IHP_NAMES, 70): continue   # the remote holding positions' stop lines (P6A ...): stands, not holding points
    if any(math.dist(NODE[n], c) < 30 for n, _ in MANUAL_HOLDS): continue
    if not hits: print('stop bar on no mapped taxiway at', [round(v) for v in c]); continue
    _, w, i, s = min(hits, key=lambda h: h[0])
    a_, b_ = NODE[w['nodes'][i]], NODE[w['nodes'][i+1]]; at = (a_[0] + (b_[0]-a_[0])*s, a_[1] + (b_[1]-a_[1])*s)
    ref = tname(w['tags'].get('ref'))
    letter = lambda t: re.match(r'[A-Z]+', t)[0]
    ihp = label_near(c, lambda t: t in IHP_NAMES, 90)
    if ihp: name = ihp
    elif ref and re.search(r'\d', ref): name = ref
    else:   # the bar's own name, printed beside it (the exit or link taxiway), else its taxiway's
        lab = label_near(c, lambda t: re.fullmatch(r'[A-Z]{1,2}\d{1,2}[A-Z]?', t) and t not in STAND_LABELS and not re.fullmatch(r'P\d+[AB]?', t), 160)
        name = lab or ref or label_near(c, lambda t: t not in STAND_LABELS, 140)
    # a row across a runway itself (the 36R displaced runway end, the lights where N2/E6 cross 09/27) is no holding position
    if any(abs(R['mo'](tuple(c))[1]) < 35 and 100 < R['mo'](tuple(c))[0] < R['L'] - 100 for R in FR.values()): continue
    # a node of the way within 3 m is the holding position itself, otherwise a new one
    hit_node = next((n for n in w['nodes'] if math.dist(NODE[n], at) < 3), None)
    if hit_node is None: hit_node = insert_at(w, i, at)
    CHART_HOLDS.append((hit_node, name, ihp is not None))
CHART_HOLDS += [(n, nm, False) for n, nm in MANUAL_HOLDS]
# two bars with one name on one taxiway (W7's CAT I and CAT II/III positions): the one nearer the runway
def _rwy_off(p): return min(abs(R['mo'](p)[1]) for R in FR.values())
_keep = []
for n, name, ihp in CHART_HOLDS:
    twin = [m for m, nm2, _ in CHART_HOLDS if m != n and nm2 == name and math.dist(NODE[m], NODE[n]) < 150]
    if twin and _rwy_off(NODE[n]) > min(_rwy_off(NODE[m]) for m in twin): continue
    _keep.append((n, name, ihp))
CHART_HOLDS = _keep
# the crossing of 09/27 at N2/E6 (northbound to the 18L end): the chart has the stop bars on N2 south of the runway only;
# a holding position on E6 north of it, 90 m out as the others on 09/27, for traffic crossing southbound
for w in [w for w in taxi if tname(w['tags'].get('ref')) == 'E6']:
    R = FR['0927']; ns = w['nodes']
    for i in range(len(ns) - 1):
        o0, o1 = R['mo'](NODE[ns[i]])[1], R['mo'](NODE[ns[i+1]])[1]
        if (o0 - 90)*(o1 - 90) < 0:
            f = (90 - o0)/(o1 - o0); q = (NODE[ns[i]][0] + (NODE[ns[i+1]][0]-NODE[ns[i]][0])*f, NODE[ns[i]][1] + (NODE[ns[i+1]][1]-NODE[ns[i]][1])*f)
            CHART_HOLDS.append((insert_at(w, i, q), 'N2', False)); break
# a stop bar just short of where two lanes merge on the way to the runway (E1, N3): its row of lights spans both, but the
# mapped point is on one of them, so the other would meet the runway with no holding point and a hairpin onto the first.
# The holding point goes on just past the merge, where both have joined.
_wn = collections.defaultdict(list)
for w in taxi:
    for i, n in enumerate(w['nodes']): _wn[n].append((w, i))
moved = []
_chn = {n for n, _, _ in CHART_HOLDS}
for idx, (n, name, ihp) in enumerate(CHART_HOLDS):
    if ihp or name == 'G2': continue      # G2's lanes merge only on the far side of its crossing of 04/22
    o_n = _rwy_off(NODE[n]); best = None
    for w, i in _wn[n]:
        for st in (1, -1):
          for j in range(i + st, i + st*8, st):
            if not (0 <= j < len(w['nodes'])): break
            J = w['nodes'][j]
            if _rwy_off(NODE[J]) >= o_n or math.dist(NODE[J], NODE[n]) > 60: break
            # another lane comes in at J, between the stop bar and the runway, with no stop bar of its own
            others = [x for x, _ in _wn[J] if x is not w]
            if not others or any(math.dist(NODE[m], NODE[J]) < 60 for x in others for m in x['nodes'] if m in _chn): continue
            # a taxiway of its own (L at G7, W at W12) has its own way in; W10's second lane, which OpenStreetMap calls B, does not
            if name != 'W10' and any(tname(x['tags'].get('ref')) not in (None, name) for x in others): continue
            # the way on from J towards the runway, and the lane that joins at J from beside
            on = [(x, k, s2) for x, k in _wn[J] for s2 in (1, -1) if 0 <= k + s2 < len(x['nodes']) and _rwy_off(NODE[x['nodes'][k + s2]]) < _rwy_off(NODE[J]) - 3]
            if on: best = (J, on[0]); break
    if not best: continue
    J, (x, k, s2) = best; K = x['nodes'][k + s2]; f = min(0.5, 6/max(1, math.dist(NODE[J], NODE[K])))
    q = (NODE[J][0] + (NODE[K][0]-NODE[J][0])*f, NODE[J][1] + (NODE[K][1]-NODE[J][1])*f)
    CHART_HOLDS[idx] = (insert_at(x, k if s2 > 0 else k - 1, q), name, ihp); moved.append((name, [o['tags'].get('ref') for o in [y for y, _ in _wn[J] if y is not x]]))
print('holding points moved past a merge', moved)
HP = {}; HPTYPE = {}
def near_runway(p):
    for R in FR.values():
        m, o = R['mo'](p)
        if -400 < m < R['L'] + 400 and abs(o) < 260: return True
    return False
for n, name, ihp in CHART_HOLDS:
    HP[n] = name; HPTYPE[n] = 'intermediate' if ihp or name in OLS_HOLDS or not near_runway(NODE[n]) else 'runway'
for e in E:
    if e['type'] == 'node' and e['id'] in HP: e.setdefault('tags', {}).update({'aeroway': 'holding_position', 'ref': HP[e['id']]})
print('holding positions off the chart', len(HP), collections.Counter(HPTYPE.values()))
print(sorted((str(v), HPTYPE[k]) for k, v in HP.items()))
print('unnamed holding positions', [[round(c) for c in NODE[k]] for k, v in HP.items() if not v])
use = collections.Counter(n for w in taxi for n in w['nodes'])
ends = set(n for w in taxi for n in (w['nodes'][0], w['nodes'][-1]))
gnodes = set(n for n, c in use.items() if c > 1) | ends | (set(HP) & set(use))
def inpoly(p, poly):
    x, y = p; c = False
    for i in range(len(poly)):
        x1, y1 = poly[i]; x2, y2 = poly[i-1]
        if (y1 > y) != (y2 > y) and x < (x2-x1)*(y-y1)/(y2-y1) + x1: c = not c
    return c
apron_ways = [w for w in ways if tagged(w, 'apron') and w['nodes'][0] == w['nodes'][-1]]
aprons = [[NODE[n] for n in w['nodes']] for w in apron_ways]
for e in E:
    if e['type'] == 'relation' and e.get('tags', {}).get('aeroway') == 'apron':
        for m in e.get('members', []):
            if m.get('role') == 'outer' and 'geometry' in m: aprons.append([en(g['lat'], g['lon']) for g in m['geometry']])
segs = []                                                          # [u, v, name, [mid points], wayid]
for w in taxi:
    ref = tname(w['tags'].get('ref') or (w['tags'].get('name') if re.match(r'^[A-Za-z]{1,5}-?\d{0,2}[A-Za-z]?$', w['tags'].get('name') or '') else None)); ns = w['nodes']; cur = [ns[0]]
    for n in ns[1:]:
        cur.append(n)
        if n in gnodes: segs.append([cur[0], cur[-1], ref, cur[1:-1], w['id']]); cur = [n]
adj = collections.defaultdict(list)
for s in segs: adj[s[0]].append(s); adj[s[1]].append(s)
for it in range(8):
    for s in segs:
        if s[2]: continue
        mid = NODE[s[3][len(s[3])//2]] if s[3] else tuple((NODE[s[0]][i] + NODE[s[1]][i])/2 for i in range(2))
        if it == 0:
            if any(inpoly(mid, p) for p in aprons): s[2] = 'APRON'
            continue
        na = [t[2] for t in adj[s[0]] if t is not s and t[2] and t[2] != 'APRON']; nb = [t[2] for t in adj[s[1]] if t is not s and t[2] and t[2] != 'APRON']
        common = [x for x in na if x in nb]
        if common: s[2] = common[0]
        elif it >= 2 and (na or nb): s[2] = (nb or na)[0]
for s in segs:
    if not s[2]: s[2] = 'APRON'
# ── each runway's entries and exits: from each holding position near it, every way down to its centreline
nid = {}
def NID(n): return nid.setdefault(n, 'n%d' % len(nid))
holds, fil, rnodes, hs = {}, {}, [], {}
usedBy = {}
paths = []
cnt = collections.Counter()
drop = set()
def nearest_rwy(p):
    best = None
    for rid, R in FR.items():
        m, o = R['mo'](p)
        if -350 < m < R['L'] + 350 and abs(o) < 235 and (best is None or abs(o) < best[1]): best = (rid, abs(o))
    return best and best[0]
def near_rwys(p):
    out = []
    for rid, R in FR.items():
        m, o = R['mo'](p)
        if -350 < m < R['L'] + 350 and abs(o) < 260: out.append((abs(o), rid))
    return [r for _, r in sorted(out)]
def inward(hp, R):
    onC = onC_of(R); mo = R['mo']; res = []
    def dfs(n, pts, used, depth):
        if depth > 6 or len(res) > 6: return
        for t in adj[n]:
            if t in used: continue
            seq = (t[3] if t[0] == n else t[3][::-1]) + [t[1] if t[0] == n else t[0]]
            Pp = pts[:]; hit = False; bad = False
            for q in seq:
                pq = mo(NODE[q])
                if abs(pq[1]) > abs(Pp[-1][1]) + 2 and abs(Pp[-1][1]) > 6: bad = True; break
                Pp.append(pq)
                if onC(pq): hit = True; break
            if bad: continue
            o = seq[-1]
            if hit: res.append((Pp, used + [t])); continue
            if o in HP: continue
            dfs(o, Pp, used + [t], depth + 1)
    dfs(hp, [mo(NODE[hp])], [], 0)
    return res
def hairpin(pl, win=80, most=150):
    """the line doubles back on itself: within win metres its heading swings round by more than most degrees"""
    L, B = [], []
    for i in range(1, len(pl)):
        d = math.dist(pl[i-1], pl[i])
        if d < 0.5: continue
        L.append(d); B.append(math.degrees(math.atan2(pl[i][0]-pl[i-1][0], pl[i][1]-pl[i-1][1])))
    for i in range(len(B)):
        acc = 0
        for j in range(i + 1, len(B)):
            acc += L[j-1]
            if acc > win: break
            if abs((B[j] - B[i] + 180) % 360 - 180) > most: return True
    return False
hold_used = []
byrwy = collections.defaultdict(list)
for n in HP:
    if n not in use: continue
    if HPTYPE.get(n) != 'runway': continue   # intermediate and ILS holding positions are not runway holding points (intermediate ones become IHPs)
    for rid in near_rwys(NODE[n]): byrwy[rid].append(n)
for rid, R in FR.items():
    mo = R['mo']; thr = R['thr']; lo, hi = R['lo'], R['hi']; a, U, N = R['a'], R['U'], R['N']
    for h in sorted(byrwy[rid], key=lambda n: mo(NODE[n])[0]):
        # a holding position near two runways serves the nearer one it has a way onto
        if any(inward(h, FR[r2]) for r2 in near_rwys(NODE[h])[:near_rwys(NODE[h]).index(rid)]): continue
        ps = inward(h, R)
        if not ps or not HP[h]: continue
        ref = HP[h]
        hs[NID(h)] = rid
        for Pp, used in ps:
            for t in used: drop.add(id(t))
            hold_used.append((h, used))
            Pp = Pp[::-1]
            # where the lead lines leave the taxiway: about 10 m out from the runway edge; at a runway end, where the line-up
            # turn is a hook through more than 90 degrees (E6 at the 18L end), further out so it sweeps round more widely
            _hm = mo(NODE[h])[0]; _end = (Pp[0][0] < 250 and _hm < 120) or (Pp[0][0] > R['L'] - 250 and _hm > R['L'] - 120)
            lim = min(50 if _end else 32, abs(Pp[-1][1])*0.5)
            f = [Pp[0]]; rest = []
            for i in range(1, len(Pp)):
                if abs(Pp[i][1]) >= lim:
                    p0, p1 = Pp[i-1], Pp[i]; k = (lim - abs(p0[1]))/(abs(p1[1]) - abs(p0[1]) or 1)
                    f.append((p0[0] + (p1[0]-p0[0])*k, p0[1] + (p1[1]-p0[1])*k)); rest = Pp[i:-1]; break
                f.append(Pp[i])
            hp_m = mo(NODE[h])[0]
            d = f[-1][0] - f[0][0]; ang = math.degrees(math.atan2(abs(f[-1][1] - f[0][1]), abs(d)))
            dirs = [lo, hi] if ang > 55 else ([lo] if d > 0 else [hi])
            m0 = f[0][0]; endr = lo if m0 < 250 and hp_m < 120 else hi if m0 > R['L'] - 250 and hp_m > R['L'] - 120 else ''
            if endr: dirs = [lo, hi]
            elif hairpin(Pp): dirs = []                  # it doubles back between the runway and the hold: no way off (or on) there
            cnt[ref] += 1; key = ref if cnt[ref] == 1 else '%s~%d' % (ref, cnt[ref])
            rn = 'R%d' % len(rnodes); fe, fn = (a[0] + U[0]*f[-1][0] + N[0]*f[-1][1], a[1] + U[1]*f[-1][0] + N[1]*f[-1][1])
            rnodes.append([rn, r1(fe), r1(fn)])
            hp = mo(NODE[h])
            tws = [t[2] or 'APRON' for t in used]; tw = next((t for t in tws if t != 'APRON'), ref)
            usedBy[key] = (h, used)
            holds[key] = [NID(h), rn, rid, r1(hp[0]), r1(hp[1]), ','.join(dirs), endr, [[r1(m), r1(o)] for m, o in rest], tw]
            fil[key] = [[r1(m), r1(o)] for m, o in f]
            paths.append((h, f[0], key, rid))
# ── a holding position meets its runway by several routes through the junction (B's nine ways onto 16R/34L), all drawn
# as fillet lines. Of the routes that serve the same directions only the most direct stays; the taxiways the others ran
# along are ordinary taxiways again (they were dropped as runway links).
def flen(k):
    pts = fil[k] + holds[k][7]; return sum(math.dist(pts[j], pts[j+1]) for j in range(len(pts) - 1))
pick = {}
for k, h in holds.items():
    g = (h[0], h[2], h[5], h[6])
    if g not in pick or flen(k) < flen(pick[g]) - 1: pick[g] = k
keepk = set(pick.values()); ren = {}; nref = collections.Counter(); newh, newf = {}, {}
for k in holds:
    if k not in keepk: continue
    base = k.split('~')[0]; nref[base] += 1; ren[k] = base if nref[base] == 1 else '%s~%d' % (base, nref[base])
    newh[ren[k]] = holds[k]; newf[ren[k]] = fil[k]
print('holds', len(holds), '->', len(newh))
print('runway holding positions with no way onto a runway', sorted((str(HP[n]), [round(c) for c in NODE[n]]) for n in HP if HPTYPE[n] == 'runway' and not any(usedBy[k][0] == n for k in usedBy)))
paths_all, holds_all, fil_all = paths, holds, fil
paths = [(h, c, ren[k], rid) for h, c, k, rid in paths if k in ren]
hold_used = [usedBy[k] for k in holds if k in keepk]
drop = {id(t) for h, used in hold_used for t in used}
holds, fil = newh, newf
# a dropped taxiway the runway links don't actually run along (a connector a hold's path only passed through) is a taxiway again
def to_world(k):
    R = FR[holds[k][2]]; a, U, N = R['a'], R['U'], R['N']
    return [(a[0] + U[0]*m + N[0]*o, a[1] + U[1]*m + N[1]*o) for m, o in fil[k] + holds[k][7]]
def pdist(p, a, b):
    dx, dy = b[0]-a[0], b[1]-a[1]; L2 = dx*dx + dy*dy or 1e-9; u = max(0, min(1, ((p[0]-a[0])*dx + (p[1]-a[1])*dy)/L2)); return math.dist(p, (a[0] + dx*u, a[1] + dy*u))
LINKS = [to_world(k) for k in holds]
restored = 0
for t in segs:
    if id(t) not in drop or any(onAny(NODE[n]) for n in [t[0], t[1]] + t[3]): continue
    pts = [NODE[t[0]]] + [NODE[n] for n in t[3]] + [NODE[t[1]]]; S = []
    for j in range(len(pts) - 1):
        L = math.dist(pts[j], pts[j+1]); k = max(1, int(L / 6))
        S += [(pts[j][0] + (pts[j+1][0]-pts[j][0])*i/k, pts[j][1] + (pts[j+1][1]-pts[j][1])*i/k) for i in range(k)]
    cov = sum(1 for q in S if any(pdist(q, w[i], w[i+1]) < 22 for w in LINKS for i in range(len(w) - 1)))
    if cov < 0.5*len(S): drop.discard(id(t)); restored += 1
print('taxiway segments restored', restored)
# a holding point short of a junction (ZW2/ZW3: the parallel taxiway and W1 meet between the holds and runway 18R/36L):
# the way on to the last junction that leads anywhere else stays a taxiway, so the taxiways there stay joined up; only
# the rest is the runway link
def on_rwy(t): return any(onAny(NODE[q]) for q in [t[0], t[1]] + t[3])
keep = set()
for h, used in hold_used:
    n, seq = h, []
    for t in used: n = t[1] if t[0] == n else t[0]; seq.append(n)
    last = -1
    for i, n in enumerate(seq[:-1]):
        if any(t not in used and id(t) not in drop and not on_rwy(t) for t in adj[n]): last = i
    for t in used[:last + 1]: keep.add(id(t))
drop -= keep
print('kept as taxiway', len(keep))
# crossings: holding positions either side of one runway that reach the same centreline point
xedges, XN, pairs = [], {}, set()
for h1, c1, k1, r1d in paths_all:
    for h2, c2, k2, r2d in paths_all:
        if r1d != r2d or (h1, h2) in pairs or h1 >= h2: continue
        R = FR[r1d]; mo = R['mo']
        if abs(c1[0] - c2[0]) < 15 and mo(NODE[h1])[1]*mo(NODE[h2])[1] < 0 and abs(mo(NODE[h1])[0] - mo(NODE[h2])[0]) < 260 and 120 < c1[0] < R['L'] - 120:   # not over a runway end's threshold   # facing each other across the runway, not diagonally
            pairs.add((h1, h2)); x = 'x%d' % len(XN); a, U, N = R['a'], R['U'], R['N']
            XN[x] = (a[0] + U[0]*c1[0], a[1] + U[1]*c1[0])
            for h, k in ((h1, k1), (h2, k2)):
                Rr = [fil_all[k][-1]] + holds_all[k][7]   # straight over the runway from the centreline to where its taxiway meets the edge, then on to the hold
                xedges.append([x, NID(h), holds_all[k][8], [[r1(a[0] + U[0]*m + N[0]*o), r1(a[1] + U[1]*m + N[1]*o)] for m, o in Rr]])
print('holds', len(holds), 'crossings', len(XN))
def runway_seg(s): return id(s) in drop or any(onAny(NODE[n]) for n in [s[0], s[1]] + s[3])
edges = []
for s in segs:
    if runway_seg(s): continue
    edges.append([NID(s[0]), NID(s[1]), s[2], [[r1(x) for x in NODE[n]] for n in s[3]]])
edges += xedges
g = collections.defaultdict(set)
for e in edges: g[e[0]].add(e[1]); g[e[1]].add(e[0])
for h in holds.values(): g[h[0]].add(h[1]); g[h[1]].add(h[0])
seen = set(); comps = []
for n0 in list(g):
    if n0 in seen: continue
    st = [n0]; comp = set()
    while st:
        x = st.pop()
        if x in comp: continue
        comp.add(x); st += list(g[x])
    seen |= comp; comps.append(comp)
big = max(comps, key=len); print('components', sorted(len(c) for c in comps)[-6:])
edges = [e for e in edges if e[0] in big]
inv = {v: k for k, v in nid.items()}
for x, p in XN.items(): inv[x] = x; NODE[x] = p
holds = {k: h for k, h in holds.items() if h[0] in big}
nodes = [[k, r1(NODE[inv[k]][0]), r1(NODE[inv[k]][1])] for k in sorted({x for e in edges for x in e[:2]} | {h[0] for h in holds.values()}, key=lambda s: (s[0], int(s[1:])))]
hs = {k: v for k, v in hs.items() if k in big}
fil = {k: fil[k] for k in holds}
# ── one junction is often mapped as several nodes a few metres apart (one per overlapping way: B, B8 and B9 over the same
# pavement), which draws the junction as a mesh of near-parallel lines. Nodes within 7 m become one, and of the edges that
# then join the same two nodes only the shortest stays.
MERGE_M = 7
deg = collections.Counter()
for e in edges: deg[e[0]] += 1; deg[e[1]] += 1
hold_nodes = {h[0] for h in holds.values()}
ids = sorted({x for e in edges for x in e[:2]} | hold_nodes, key=lambda i: (i not in hold_nodes, -deg[i], i))
grid = collections.defaultdict(list); M = {}
for i in ids:
    if i[0] == 'x': M[i] = i; continue
    p = NODE[inv[i]]; gx, gy = int(p[0] // MERGE_M), int(p[1] // MERGE_M)
    rep = next((q for dx in (-1, 0, 1) for dy in (-1, 0, 1) for q in grid[(gx + dx, gy + dy)] if math.dist(NODE[inv[q]], p) < MERGE_M), None)
    if rep is None: grid[(gx, gy)].append(i); rep = i
    M[i] = rep
def elen(e): 
    pts = [NODE[inv[e[0]]]] + [tuple(q) for q in e[3]] + [NODE[inv[e[1]]]]
    return sum(math.dist(pts[j], pts[j+1]) for j in range(len(pts) - 1))
best = {}
for e in edges:
    a, b = M[e[0]], M[e[1]]
    if a == b: continue
    k = (min(a, b), max(a, b)); L = elen(e)
    if k not in best or L < best[k][0] - 0.5 or (abs(L - best[k][0]) <= 0.5 and (best[k][1][2] == 'APRON') and e[2] != 'APRON'): best[k] = (L, [a, b, e[2], e[3]])
print('merged nodes', len(ids) - len(set(M.values())), 'edges', len(edges), '->', len(best))
edges = [v[1] for v in best.values()]
holds = {k: [M.get(h[0], h[0])] + h[1:] for k, h in holds.items()}
hs = {M.get(k, k): v for k, v in hs.items()}
nid = {k: M.get(v, v) for k, v in nid.items()}
nodes = [[k, r1(NODE[inv[k]][0]), r1(NODE[inv[k]][1])] for k in sorted({x for e in edges for x in e[:2]} | {h[0] for h in holds.values()}, key=lambda s: (s[0], int(s[1:])))]
# ── IHPs: the intermediate holding positions. The ones the AIP names (VK, VL, VM on V; AS on A, BS on B; GD and GL at the
# K-apron; HN on H) keep their names; any other stop bar away from a runway is named after its taxiway, numbered along
# it past every name already in use (taxiways, holding points and stands: A31 is a stand, so A's go on from there)
ihps = []
hnodes = {h[0] for h in holds.values()}
_byref = collections.defaultdict(list)
TAKEN = {tname(w['tags'].get('ref') or '') for w in taxi} | {re.sub(r'~\d+$', '', k) for k in holds} | {v for v in HP.values() if v} | set(json.load(open(STANDS_JSON)))
for n, ref in HP.items():
    if HPTYPE.get(n) == 'runway' or not ref or n not in nid or nid[n] not in big or nid[n] in hnodes: continue
    if ref in IHP_NAMES or ref in OLS_HOLDS:
        if ref not in [x[0] for x in ihps]: ihps.append([ref, nid[n]])
        continue
    if any(math.dist(NODE[n], NODE[inv_h]) < 25 for inv_h in [k for k, v in nid.items() if v in hnodes]): continue
    _byref[re.match(r'[A-Z]+', ref)[0]].append(n)
for ref, ns in sorted(_byref.items()):
    ns.sort(key=lambda n: (round(-NODE[n][1]/60), NODE[n][0]))
    seen = set(); num = 0
    for n in ns:
        if nid[n] in seen: continue
        seen.add(nid[n]); num += 1
        while ref + str(num) in TAKEN: num += 1
        TAKEN.add(ref + str(num)); ihps.append(['%s%d' % (ref, num), nid[n]])
# ── stands: every one at the AIP's INS coordinates (the stop position). The lead-in is OpenStreetMap's painted line for
# the stand where it ends within 15 m of the AIP position; otherwise a straight line back from the stop position along
# the heading of the nearest mapped stand line on the same row (or square to the lane in front) to the lane.
segpts = []
for e in edges:
    pl = [NODE[inv[e[0]]]] + [tuple(p) for p in e[3]] + [NODE[inv[e[1]]]]
    for i in range(len(pl) - 1): segpts.append((e, i, pl[i], pl[i+1]))
def ray_hit(p, dvec, maxd=160):
    best = None
    for e, i, q0, q1 in segpts:
        ex, ey = q1[0]-q0[0], q1[1]-q0[1]; den = dvec[0]*ey - dvec[1]*ex
        if abs(den) < 1e-9: continue
        t = ((q0[0]-p[0])*ey - (q0[1]-p[1])*ex)/den; u = ((q0[0]-p[0])*dvec[1] - (q0[1]-p[1])*dvec[0])/den
        if 5 < t < maxd and -0.001 <= u <= 1.001 and (best is None or t < best[0]): best = (t, e, i, u)
    return best
def nearest_seg(p):
    best = None
    for e, i, q0, q1 in segpts:
        ex, ey = q1[0]-q0[0], q1[1]-q0[1]; LL = ex*ex + ey*ey or 1; u = max(0, min(1, ((p[0]-q0[0])*ex + (p[1]-q0[1])*ey)/LL))
        q = (q0[0] + ex*u, q0[1] + ey*u); d = math.dist(p, q)
        if best is None or d < best[0]: best = (d, e, i, u, q)
    return best
def segpts_of(e, i):
    pl = [NODE[inv[e[0]]]] + [tuple(p) for p in e[3]] + [NODE[inv[e[1]]]]
    return pl[i], pl[i+1]
def crosses(a, b, skip):
    def cr(o, p, q): return (p[0]-o[0])*(q[1]-o[1]) - (p[1]-o[1])*(q[0]-o[0])
    for e, i, q0, q1 in segpts:
        if e is skip: continue
        d1, d2, d3, d4 = cr(a, b, q0), cr(a, b, q1), cr(q0, q1, a), cr(q0, q1, b)
        if d1*d2 < 0 and d3*d4 < 0:
            den = (b[0]-a[0])*(q1[1]-q0[1]) - (b[1]-a[1])*(q1[0]-q0[0]); tt = ((q0[0]-a[0])*(q1[1]-q0[1]) - (q0[1]-a[1])*(q1[0]-q0[0]))/den
            Lab = math.dist(a, b)
            if 6 < tt*Lab < Lab - 6: return True
    return False
def bear(a, b): return math.degrees(math.atan2(b[0]-a[0], b[1]-a[1])) % 360
AIP = {k: P(a, b) for k, (a, b) in json.load(open(STANDS_JSON)).items()}
# the mapped stand lines, lane end first
osm_lines = collections.defaultdict(list)
for w in ways:
    r = tname(w.get('tags', {}).get('ref'))
    if tagged(w, 'parking_position') and r and len(w['nodes']) > 1: osm_lines[r].append([NODE[n] for n in w['nodes']])
LINE, MAPPED_HD = {}, []
for sid, ap in AIP.items():
    best = None
    for q in osm_lines.get(sid, []):
        if math.dist(q[0], ap) < math.dist(q[-1], ap): q = q[::-1]
        if math.dist(q[-1], ap) < 15 and (best is None or math.dist(q[-1], ap) < math.dist(best[-1], ap)): best = q
    if best and math.dist(best[0], best[-1]) > 12:
        LINE[sid] = best[:-1] + [ap]; MAPPED_HD.append((ap, bear(best[-2] if math.dist(best[-2], best[-1]) > 3 else best[0], best[-1]), sid))
# the aprons and piers (APDC Schiphol Centre, AD 2.8): A-apron (31-85: the cargo and remote apron south of the B-pier),
# the B, C, D, E, F, G and H piers, the D-apron (D88-D95) and E-apron (E72-E77), the J-apron (J80-J87, not controlled by
# ATC; P10-P16 its de-icing pads), the K-apron (general aviation, Schiphol East), the M-apron and pier (Schiphol South-East),
# the S-apron (cargo, south of 06/24), the U-apron (tow-only parking, north-west) and the Y-apron (Y71-Y74 by 18C)
def term(sid):
    k = re.match(r'[A-Z]+', sid)[0]; n = int(re.sub(r'\D', '', sid) or 0)
    if k == 'D' and n >= 88: return 'DA'
    if k == 'E' and n >= 70: return 'EA'
    if k == 'P': return 'DI'
    return k
# how each stand is used: K-apron stands are self-parking, nose in, the aircraft turned by tow truck (AD 2.20 para 13);
# the U-apron is towing traffic only (AD 2.20 para 14); P10-P16 are the de-icing pads; the rest taxi in and push back
def use_of(sid):
    t = term(sid)
    return 'TT' if t == 'U' else 'DI' if t == 'DI' else 'P'
gates, splits = [], []
for sid, ap in sorted(AIP.items(), key=lambda kv: (re.match(r'[A-Z]+', kv[0])[0], int(re.sub(r'\D', '', kv[0]) or 0), kv[0])):
    p = ap; line = LINE.get(sid)
    if line:
        hd = bear(line[-2], p) if math.dist(line[-2], p) > 3 else bear(line[0], p)
        n0 = nearest_seg(line[0])
        hit = (n0[0], n0[1], n0[2], n0[3]) if n0[0] < 30 else ray_hit(p, (-math.sin(math.radians(hd)), -math.cos(math.radians(hd))), 200)
    else:
        # the heading of the nearest mapped stand line on its row (same apron, within 70 m), else square to the lane in front
        near = sorted((math.dist(q, p), h) for q, h, s2 in MAPPED_HD if term(s2) == term(sid))
        ns = nearest_seg(p)
        hd = near[0][1] if near and near[0][0] < 70 else bear(ns[4], p)
        hit = ray_hit(p, (-math.sin(math.radians(hd)), -math.cos(math.radians(hd))), 200)
    if not hit:
        ns = nearest_seg(p)
        if ns[0] > 220: print('stand', sid, 'no lane'); continue
        hit = (ns[0], ns[1], ns[2], ns[3])
    t, e, i, u = hit; q0, q1 = segpts_of(e, i); lq = (q0[0] + (q1[0]-q0[0])*u, q0[1] + (q1[1]-q0[1])*u)
    # the painted line may run on through the lane in front of the stand to one further away: the lead-in starts at the
    # first lane met going back from the stop point along the stand's heading
    rb = (-math.sin(math.radians(hd)), -math.cos(math.radians(hd))); h2 = ray_hit(p, rb, 200)
    if h2 and h2[0] < math.dist(p, lq) - 12:
        t, e, i, u = h2; q0, q1 = segpts_of(e, i); lq = (q0[0] + (q1[0]-q0[0])*u, q0[1] + (q1[1]-q0[1])*u); hit = (t, e, i, u); line = None
    paint = [lq] + (line[1:] if line else [p]) if line or math.dist(p, lq) <= 110 else None
    if paint and any(crosses(paint[j], paint[j+1], e) for j in range(len(paint) - 1)): paint = None
    splits.append((sid, hit))
    gates.append([sid, term(sid), [r1(p[0]), r1(p[1])], hit, round(hd, 1), [[r1(x) for x in pt] for pt in paint] if paint else 0, '', use_of(sid)])
# the largest wingspan each stand takes: the AIP charts give it only for some (A-apron 36 m and so on), so it is worked
# out from the spacing of the stands on the row: the distance to the nearest stand it can be used alongside, less a 7.5 m
# clearance (code C 3 m to code E/F 4.5 m either side, AD 2.20 para 4.1), between 24 m and 80 m. Stands closer together
# than 32 m overlap (the MARS-style alternatives: U10E/U10W, M61/M62/M63 ...) and are never used together ("vac").
POS_ = {g[0]: tuple(g[2]) for g in gates}
vac = collections.defaultdict(set)
for a_ in POS_:
    for b_ in POS_:
        if a_ < b_ and term(a_) == term(b_) and math.dist(POS_[a_], POS_[b_]) < 32: vac[a_].add(b_); vac[b_].add(a_)
for g in gates:
    sid = g[0]; others = [math.dist(POS_[sid], POS_[o]) for o in POS_ if o != sid and o not in vac[sid] and term(o) == term(sid)]
    d = min(others) if others else 80
    g[6] = r1(max(24, min(80, d - 7.5)))
vac = {k: sorted(v) for k, v in sorted(vac.items())}
print('stands', len(gates), 'overlapping pairs', sum(len(v) for v in vac.values())//2)
byedge = collections.defaultdict(list)
for sid, (t, e, i, u) in splits: byedge[id(e)].append((i + u, sid, e))
newedges, gnode, POS = [], {}, {}
for e in edges:
    lst = sorted(byedge.get(id(e), []))
    if not lst: newedges.append(e); continue
    pl = [NODE[inv[e[0]]]] + [tuple(p) for p in e[3]] + [NODE[inv[e[1]]]]
    prev, mids, k = e[0], [], 0
    for idx in range(len(pl) - 1):
        while k < len(lst) and lst[k][0] <= idx + 1:
            f = lst[k][0] - idx; q0, q1 = pl[idx], pl[idx+1]; q = (q0[0] + (q1[0]-q0[0])*f, q0[1] + (q1[1]-q0[1])*f)
            sid = lst[k][1]
            if mids == [] and prev in POS and math.dist(POS[prev], q) < 4: gnode[sid] = prev; k += 1; continue
            if mids == [] and prev not in POS and math.dist(NODE[inv[prev]], q) < 3: gnode[sid] = prev; k += 1; continue
            nn = 's' + sid
            nodes.append([nn, r1(q[0]), r1(q[1])]); POS[nn] = q
            newedges.append([prev, nn, e[2], [[r1(x) for x in m] for m in mids]]); prev, mids = nn, []; gnode[sid] = nn; k += 1
        if idx + 1 < len(pl) - 1: mids.append(pl[idx+1])
    newedges.append([prev, e[1], e[2], [[r1(x) for x in m] for m in mids]])
    for j in range(k, len(lst)): gnode[lst[j][1]] = e[1]
edges = newedges
for gt in gates: gt[3] = gnode[gt[0]]
# ── aprons, buildings, hangars
def ring(pts): return [[r1(x) for x in p] for p in pts]
aprons_out = [ring(p) for p in aprons]
# a stand OpenStreetMap leaves just outside its apron outline (K11-K16 along G, M53-M57 by the M-apron road): a patch of
# apron round the stand and back to its lane, so it is drawn on pavement
for g in gates:
    p = g[2]; q = g[5][0] if g[5] else p; hd = math.radians(g[4]); u = (math.sin(hd), math.cos(hd)); v = (u[1], -u[0])
    L = max(20, math.dist(p, q)); W_ = 24
    mid = (p[0] - u[0]*min(34, L*0.4), p[1] - u[1]*min(34, L*0.4))   # where the game puts the aircraft's middle
    if g[7] in ('TT', 'DI') or all(any(inpoly(x, ap) for ap in aprons) for x in (p, mid)): continue
    pts = [(p[0] + u[0]*20 + v[0]*s_*W_, p[1] + u[1]*20 + v[1]*s_*W_) for s_ in (-1, 1)] + [(p[0] - u[0]*L + v[0]*s_*W_, p[1] - u[1]*L + v[1]*s_*W_) for s_ in (1, -1)]
    aprons_out.append(ring(pts))
AIRSIDE = [n for w in taxi for n in w['nodes'][::3] if n in NODE] + [n for w in apron_ways for n in w['nodes'] if n in NODE]
blds = []
for w in ways:
    t = w.get('tags', {})
    if 'geometry' not in w or w['nodes'][0] != w['nodes'][-1]: continue
    if t.get('aeroway') in ('terminal', 'hangar') or (t.get('building') and len(w['nodes']) > 4):
        pts = ring([NODE[n] for n in w['nodes']]); xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        area = abs(sum(pts[i][0]*pts[i-1][1] - pts[i-1][0]*pts[i][1] for i in range(len(pts))))/2
        if area < 900 or not (-3500 < xs[0] < 3500 and -3500 < ys[0] < 3500): continue
        cxy = (sum(xs)/len(xs), sum(ys)/len(ys))
        if t.get('aeroway') not in ('terminal', 'hangar') and min(math.dist(cxy, NODE[n]) for n in AIRSIDE) > 140: continue
        hang = t.get('aeroway') == 'hangar' or t.get('building') == 'hangar'
        blds.append({'pts': pts, 'h': 18 if hang else 16 if t.get('aeroway') == 'terminal' else 9, **({'roof': 'hangar'} if hang else {}), **({'name': t['name']} if t.get('name') else {})})
for e in E:
    if e['type'] == 'relation' and e.get('tags', {}).get('aeroway') == 'terminal':
        for m in e.get('members', []):
            if m.get('role') == 'outer' and 'geometry' in m:
                blds.append({'pts': ring([en(g['lat'], g['lon']) for g in m['geometry']]), 'h': 18, 'name': e['tags'].get('name')})
# no taxiway along or diagonally over a runway's pavement: OpenStreetMap joins some taxiways across a runway (B10 to L over
# 16R/34L), but the way over a runway is a crossing (x) or a holding point's own link, never an ordinary taxiway
def on_rwy_pave(p):
    for R in FR.values():
        m, o = R['mo'](p)
        if -60 < m < R['L'] + 60 and abs(o) < 30: return True
    return False
_posn = {n[0]: (n[1], n[2]) for n in nodes}
_before = len(edges)
def _over(e):
    if e[0][0] in 'xR' or e[1][0] in 'xR': return False
    pl = [_posn[e[0]]] + [tuple(p) for p in e[3]] + [_posn[e[1]]]
    mids = pl + [((pl[i][0]+pl[i+1][0])/2, (pl[i][1]+pl[i+1][1])/2) for i in range(len(pl) - 1)]
    return sum(on_rwy_pave(p) for p in mids) >= 1
edges = [e for e in edges if not _over(e)]
print('taxiway stretches over a runway removed', _before - len(edges))
# lanes that just stop (an OpenStreetMap taxilane mapped on past the last stand, a stub at an apron edge): pruned back to the
# junction they leave (up to 1,500 m: the lanes towards the R-apron, closed for rebuilding, and the like). Holding points, stands' lead-in nodes, IHPs and crossings stay.
keep = {h[0] for h in holds.values()} | {g[3] for g in gates} | {i[1] for i in ihps} | set(hs)
_pos = {n[0]: (n[1], n[2]) for n in nodes}
def _elen(e): pl = [_pos[e[0]]] + [tuple(q) for q in e[3]] + [_pos[e[1]]]; return sum(math.dist(pl[i], pl[i+1]) for i in range(len(pl) - 1))
pruned = 0
def _near_pt(e, n): pl = [_pos[e[0]]] + [tuple(q) for q in e[3]] + [_pos[e[1]]]; return pl[1] if e[0] == n else pl[-2]
while True:
    deg = collections.Counter(x for e in edges for x in e[:2])
    gone = set()
    # two curves left meeting in a V where the lane they joined was pruned (N, by the closed stretch east of E7)
    for n, d in deg.items():
        if d != 2 or n in keep or n[0] in 'xRs': continue
        es = [e for e in edges if n in e[:2]]; P0 = _pos[n]; a, b = (_near_pt(e, n) for e in es)
        h1, h2 = math.atan2(a[0]-P0[0], a[1]-P0[1]), math.atan2(b[0]-P0[0], b[1]-P0[1])
        if abs((math.degrees(h1 - h2) + 180) % 360 - 180) < 30 and all(deg[e[0] if e[1] == n else e[1]] >= 3 for e in es): gone |= {id(e) for e in es}
    for n, d in deg.items():
        if d != 1 or n in keep or n[0] in 'xRs': continue
        chain, cur, L = [], n, 0
        while True:
            e = next(e for e in edges if cur in e[:2] and id(e) not in {id(c) for c in chain}); chain.append(e); L += _elen(e)
            nx = e[1] if e[0] == cur else e[0]
            if deg[nx] != 2 or nx in keep or nx[0] in 'xRs' or L > 1500: break
            cur = nx
        if L <= 1500 and (deg[nx] >= 3 or nx in keep): gone |= {id(e) for e in chain}
    if not gone: break
    pruned += len(gone); edges[:] = [e for e in edges if id(e) not in gone]
used_n = {x for e in edges for x in e[:2]} | {h[0] for h in holds.values()}
nodes[:] = [n for n in nodes if n[0] in used_n or n[0] in keep]
print('dead-end lane stubs pruned', pruned)
# shape points on top of an edge's own end (a stand's lead-in node mapped on a lane vertex) make a zero-length stub
for e in edges: e[3] = [q for q in e[3] if math.dist(q, _pos[e[0]]) > 0.5 and math.dist(q, _pos[e[1]]) > 0.5]
# ── junction fillets: OpenStreetMap has the taxiways meeting at sharp corners, where the painted centrelines (and
# the pavement) sweep round in curves. At every junction or bend, each pair of taxiway stretches that turns between 30
# and 150 degrees gets a curve from a point up to 45 m along one to a point along the other; at a plain bend the sharp
# corner goes. Holding points, stands, runway and crossing points keep their corners.
FIL_R = 45
pos = {n[0]: (n[1], n[2]) for n in nodes}
keepN = {h[0] for h in holds.values()} | set(hs) | set(gnode.values()) | {n for n in pos if n[0] in 'Rxs'}
def plen(pl): return sum(math.dist(pl[i], pl[i+1]) for i in range(len(pl) - 1))
def epl(e): return [pos[e[0]]] + [tuple(p) for p in e[3]] + [pos[e[1]]]
def cut_at(pl, d):
    """split a polyline d metres from its start: (point, the part before, the part after)"""
    for i in range(len(pl) - 1):
        L = math.dist(pl[i], pl[i+1])
        if d <= L:
            f = d/L if L else 0; q = (pl[i][0] + (pl[i+1][0]-pl[i][0])*f, pl[i][1] + (pl[i+1][1]-pl[i][1])*f)
            return q, pl[:i+1] + [q], [q] + pl[i+1:]
        d -= L
    return None
inc = collections.defaultdict(list)
for e in edges: inc[e[0]].append(e); inc[e[1]].append(e)
def away(e, n): pl = epl(e); return pl if e[0] == n else pl[::-1]
fid = [0]; newn = []; fillets = []; cut = {}   # cut[(id(edge), node)] = distance from that node to its new point
for n, es in inc.items():
    if n in keepN or len(es) < 2: continue
    es = [e for e in es if e[2] != 'APRON']   # apron lanes keep their own mapped paint
    pairs = []
    for i in range(len(es)):
        for j in range(i + 1, len(es)):
            a, b = away(es[i], n), away(es[j], n)
            if len(a) < 2 or len(b) < 2: continue
            pa_, pb_ = (cut_at(a, min(12, plen(a)*0.5)) or (a[1],))[0], (cut_at(b, min(12, plen(b)*0.5)) or (b[1],))[0]   # the heading over its first 12 m
            ha = math.atan2(pa_[0]-a[0][0], pa_[1]-a[0][1]); hb = math.atan2(pb_[0]-b[0][0], pb_[1]-b[0][1])
            turn = 180 - abs((math.degrees(ha - hb) + 180) % 360 - 180)   # 0: straight on, 180: back the way it came
            if 30 <= turn <= 150: pairs.append((es[i], es[j], turn))   # (above 115 an aircraft can't make the corner itself)
    for ea, eb, turn in pairs:
        la, lb = plen(away(ea, n)), plen(away(eb, n))
        r = min(FIL_R*(1 if turn < 100 else 0.7 if turn <= 125 else 0.55), 0.42*la, 0.42*lb)
        if r < (10 if turn <= 115 else 5): continue   # a sharp turn gets a curve however short its stretches: without one it can't be made
        for e in (ea, eb): cut[(id(e), n)] = max(cut.get((id(e), n), 0), r)
        fillets.append((n, ea, eb, r))
# split each edge at its cut points (one at either end at most), keeping the middle; the corner bits stay only at a junction
def split(e):
    pl = epl(e); L = sum(math.dist(pl[i], pl[i+1]) for i in range(len(pl) - 1))
    da, db = cut.get((id(e), e[0]), 0), cut.get((id(e), e[1]), 0)
    if da + db > L - 4: return None
    pts, ids = pl, [e[0], e[1]]; segs = []
    na = nb = None
    if da:
        q, pre, pl = cut_at(pl, da); na = 'f%d' % fid[0]; fid[0] += 1; newn.append([na, r1(q[0]), r1(q[1])]); pos[na] = q
        segs.append([e[0], na, e[2], [[r1(x) for x in p] for p in pre[1:-1]]])
    if db:
        q, mid, post = cut_at(pl, sum(math.dist(pl[i], pl[i+1]) for i in range(len(pl) - 1)) - db); nb = 'f%d' % fid[0]; fid[0] += 1; newn.append([nb, r1(q[0]), r1(q[1])]); pos[nb] = q
        segs.append([na or e[0], nb, e[2], [[r1(x) for x in p] for p in mid[1:-1]]]); segs.append([nb, e[1], e[2], [[r1(x) for x in p] for p in post[1:-1]]])
    else: segs.append([na or e[0], e[1], e[2], [[r1(x) for x in p] for p in pl[1:-1]]])
    return segs, na, nb
cutn = {}; out_edges = []
for e in edges:
    if (id(e), e[0]) in cut or (id(e), e[1]) in cut:
        r = split(e)
        if r is None: out_edges.append(e); continue
        segs, na, nb = r; out_edges.extend(segs)
        if na: cutn[(id(e), e[0])] = na
        if nb: cutn[(id(e), e[1])] = nb
    else: out_edges.append(e)
nfil = 0
for n, ea, eb, r in fillets:
    pa, pb = cutn.get((id(ea), n)), cutn.get((id(eb), n))
    if not pa or not pb: continue
    A, B, C = pos[pa], pos[pb], pos[n]
    curve = [[r1((1-t)**2*A[0] + 2*(1-t)*t*C[0] + t*t*B[0]), r1((1-t)**2*A[1] + 2*(1-t)*t*C[1] + t*t*B[1])] for t in [j/12 for j in range(1, 12)]]
    tw = ea[2] if ea[2] == eb[2] or eb[2] == 'APRON' else eb[2] if ea[2] == 'APRON' else min(ea[2], eb[2], key=lambda t: (len(t), t))
    out_edges.append([pa, pb, tw, curve]); nfil += 1
# a plain bend (two stretches, both cut): the sharp corner goes
corner_drop = 0
for n, es in inc.items():
    if n in keepN or len(es) != 2: continue
    if all((id(e), n) in cutn for e in es):
        before = len(out_edges)
        out_edges = [e for e in out_edges if not ((e[0] == n or e[1] == n) and (e[0] in (cutn[(id(es[0]), n)], cutn[(id(es[1]), n)]) or e[1] in (cutn[(id(es[0]), n)], cutn[(id(es[1]), n)])))]
        corner_drop += before - len(out_edges)
edges = out_edges
used = {x for e in edges for x in e[:2]}
nodes = [nd for nd in nodes if nd[0] in used or nd[0] in keepN] + [nd for nd in newn if nd[0] in used]
print('junction fillets', nfil, 'corner stubs dropped', corner_drop)
# a stub that ends on a runway's pavement (N4's mapped way on along the 10L/28R edge towards the 16 threshold, cut where it
# runs over the runway) leads nowhere: dropped
while True:
    dg = collections.Counter(x for e in edges for x in e[:2]); _p = {n[0]: (n[1], n[2]) for n in nodes + newn}
    dead = {x for x, c in dg.items() if c == 1 and x[0] not in 'sR' and x not in (keepN - {h[0] for h in holds.values() if abs(h[4]) < 40} - {n for n in keepN if n[0] == 'x'}) and x in _p and on_rwy_pave(_p[x])}
    if not dead: break
    edges = [e for e in edges if e[0] not in dead and e[1] not in dead]; print('stub on a runway dropped', sorted(dead))
used = {x for e in edges for x in e[:2]}
nodes = [nd for nd in nodes if nd[0] in used or nd[0] in keepN]
# ── holding point names: one name per stop bar. OSM names a holding position after its taxiway, so a taxiway that crosses
# a runway (F, G) has one each side, and G meets two runways: where a name is shared the side of the runway it is on
# goes after it (F West, F East: FW and FE), with a number on the end only if that is still not enough. The variants of
# one stop bar (the turn each way onto the runway) keep the one name, with ~2, ~3 on the key as before.
SIDE = {}
for k, h in holds.items():
    R = FR[h[2]]; o = h[4]; nx, ny = R['N'][0]*o, R['N'][1]*o
    SIDE[k] = ('E' if nx > 0 else 'W') if abs(nx) >= abs(ny) else ('N' if ny > 0 else 'S')
base = {}
for k, h in holds.items(): base.setdefault(re.sub(r'~\d+$', '', k).rstrip(), set())
bars = collections.defaultdict(dict)       # ref -> {hold node: [keys]}
for k, h in holds.items(): bars[re.sub(r'~\d+$', '', k)].setdefault(h[0], []).append(k)
rename, hside = {}, {}
taken = set()
for ref, byn in sorted(bars.items()):
    if len(byn) == 1:
        nm = {n: ref for n in byn}
    else:
        nm = {}
        for n, ks in byn.items(): nm[n] = ref + SIDE[ks[0]]
        cnt = collections.Counter(nm.values())
        per = collections.Counter(holds[ks[0]][2] for ks in byn.values())
        for side in [v for v, c in cnt.items() if c > 1]:
            same = [n for n in byn if nm[n] == side]
            if len({holds[byn[n][0]][2] for n in same}) == len(same):   # on different runways: the one where the taxiway crosses keeps it, the others take their runway
                same.sort(key=lambda n: -per[holds[byn[n][0]][2]])
                for n in same[1:]: nm[n] = ref + FR[holds[byn[n][0]][2]]['lo']
            else:
                same.sort(key=lambda n: holds[byn[n][0]][3])
                for i, n in enumerate(same): nm[n] = side + str(i + 1)
    for n, ks in byn.items():
        new = nm[n]
        while new in taken and new not in [rename.get(x) for x in ks]: new += "'"
        taken.add(new)
        if new != ref:
            rest = new[len(ref):]
            hside[new] = [ref, {'E': 'east', 'W': 'west', 'N': 'north', 'S': 'south'}[rest[0]] + (' ' + rest[1:] if rest[1:] else '') if rest[0] in 'EWNS' and not rest[0].isdigit() else 'runway ' + rest]
        for i, k in enumerate(sorted(ks, key=lambda k: (k != ref, int(k.split('~')[1]) if '~' in k else 1))): rename[k] = new if i == 0 else '%s~%d' % (new, i + 1)
holds = {rename[k]: h for k, h in holds.items()}
fil = {rename[k]: f for k, f in fil.items()}
print('holding points', len({re.sub(r'~\d+$', '', k) for k in holds}), 'stop bars; renamed', sorted(hside))
# ── lead-on/lead-off lines: OpenStreetMap often carries a taxiway straight on across the runway to the far side, so the
# mapped way from the runway edge to the centreline can be a long diagonal over the runway. Each one is drawn instead as the
# painted curve: from where the taxiway meets the runway edge, along the taxiway's own heading, sweeping round onto the
# centreline in the direction it serves (a turn of the taxiway's angle to the runway, no tighter than its distance out).
# The two-way ones (a taxiway square to the runway) go straight to the centreline.
def bez(P0, P1, P2, P3, n=10):
    return [tuple((1-t)**3*P0[i] + 3*(1-t)**2*t*P1[i] + 3*(1-t)*t*t*P2[i] + t**3*P3[i] for i in (0, 1)) for t in [j/n for j in range(n + 1)]]
nsmooth = 0
leads = {}   # paint only, where it differs from the path an aircraft takes: a two-way entry's curve each way
# the variants of one stop bar (each turn onto the runway) leave it by one way to the runway edge, the most direct of them;
# the lead lines fan out from there
prim = {}
for k, h in holds.items():
    L = sum(math.dist(p, q) for p, q in zip(([(h[3], h[4])] + h[7][::-1])[:-1], ([(h[3], h[4])] + h[7][::-1])[1:])) + math.dist((h[7][0] if h[7] else (h[3], h[4])), fil[k][-1])
    if h[0] not in prim or L < prim[h[0]][1]: prim[h[0]] = (k, L)
for k, h in holds.items():
    p = prim[h[0]][0]
    if p != k and math.dist(fil[k][-1], fil[p][-1]) < 45:   # a separate way onto the runway (T4's rapid exit, 400 m on) keeps its own
        d0 = 1 if fil[k][-1][0] > fil[k][0][0] else -1
        holds[k][1] = holds[p][1]; holds[k][7] = holds[p][7]; E = fil[p][-1]
        fil[k] = [[E[0] - d0*10, 0.0], E]   # only its direction matters here; the curve is drawn below
def back_dir(k, E, want=25):
    """the taxiway's heading onto the runway at E: from a point about 25 m back along its link towards the holding point"""
    h = holds[k]; path = [E] + list(h[7]) + [(h[3], h[4])]; acc = 0
    for i in range(1, len(path)):
        acc += math.dist(path[i-1], path[i])
        if acc >= want or i == len(path) - 1: q = path[i]; break
    v = (E[0] - q[0], E[1] - q[1]); L = math.hypot(*v)
    return (v[0]/L, v[1]/L) if L > 1 else None
for k, f in list(fil.items()):
    h = holds[k]; E = f[-1]; C0 = f[0]
    if abs(E[1]) < 5: continue
    tv = back_dir(k, E)
    if not tv or tv[1]*E[1] > -0.2: continue                   # not heading in towards the centreline: leave the mapped line
    oe = abs(E[1]); t = oe/abs(tv[1]); X = (E[0] + tv[0]*t, 0.0)   # where the taxiway's line meets the centreline
    two = set(h[5].split(',')) >= {FR[h[2]]['lo'], FR[h[2]]['hi']} and len(h[5].split(',')) == 2
    d = 1 if E[0] > C0[0] else -1                              # the way along the runway it serves (as the mapped line did)
    def curve(dd, reach=0):   # the painted fillet for a turn onto the centreline heading dd (None: a turn of more than 135 degrees)
        if dd*(-tv[0]) < -0.7 or t > 4*oe: return None
        C = (X[0] - dd*max(t, reach), 0.0)
        return [[r1((1-u)**2*C[0] + 2*(1-u)*u*X[0] + u*u*E[0]), r1((1-u)**2*C[1] + 2*(1-u)*u*X[1] + u*u*E[1])] for u in [j/16 for j in range(17)]]
    if h[6]:
        # at a runway end the only turn is onto the runway, away from the end: lining up there, or a landing that has
        # rolled to the end turning off (the same curve), never a line out over the end
        dEnd = -1 if h[6] == FR[h[2]]['lo'] else 1
        # the line-up turn there sweeps round onto the centreline at least 90 m in (E6 at the 18L end comes in square and
        # turns through 140 degrees): the threshold is displaced well beyond that wherever the entry is a hook
        tv60 = back_dir(k, E, 60) or tv
        c = curve(dEnd, 90 if tv60[0]*dEnd > 0.2 else 0)   # the aircraft travels -dEnd along the runway
        if c: fil[k] = c; leads[k] = [c]; nsmooth += 1; continue
    if two or not h[5] or d*(-tv[0]) < -0.7 or t > 4*oe:
        # both ways (or a turn of more than 135 degrees): the aircraft goes straight on along its line to the centreline;
        # what is painted is a curve each way it can turn (and the straight line only where it is square to the runway)
        mc = X[0] if t <= 1.3*oe else E[0]
        fil[k] = [[r1(mc), 0.0], [r1(E[0]), r1(E[1])]]; nsmooth += 1
        if two: leads[k] = [c for c in (curve(1), curve(-1)) if c] + ([fil[k]] if abs(tv[0]) < 0.35 else [])
        continue
    # one way: the painted fillet, a smooth curve tangent to the taxiway's line at E and to the centreline, as far back
    # along it from where the two lines meet as E is from there (a quadratic, so it never bulges or doubles back)
    C = (X[0] - d*t, 0.0)
    pts = [((1-u)**2*C[0] + 2*(1-u)*u*X[0] + u*u*E[0], (1-u)**2*C[1] + 2*(1-u)*u*X[1] + u*u*E[1]) for u in [j/16 for j in range(17)]]
    fil[k] = [[r1(p[0]), r1(p[1])] for p in pts]; nsmooth += 1
print('lead lines drawn as curves', nsmooth, 'of', len(fil))
# runway crossings: from each holding point the same way to the runway edge as its stop bar's turn-ons use, straight over
# between the two edge points, the crossing node on the centreline halfway between them
def W(rid, m, o): R = FR[rid]; a, U, N = R['a'], R['U'], R['N']; return [r1(a[0] + U[0]*m + N[0]*o), r1(a[1] + U[1]*m + N[1]*o)]
pkey = {h[0]: prim[h[0]][0] for h in holds.values()}
xs = collections.defaultdict(list)
for e in edges:
    if e[0][0] == 'x' and e[1] in pkey: xs[e[0]].append(e)
npos = {n[0]: n for n in nodes}
for x, es in xs.items():
    Es = []
    for e in es:
        k = pkey[e[1]]; h = holds[k]; E = fil[k][-1]
        e[3] = [W(h[2], *E)] + [W(h[2], m, o) for m, o in h[7]]; Es.append((h[2], E[0]))
    if x in npos and Es: rid = Es[0][0]; mm = sum(m for _, m in Es)/len(Es); p = W(rid, mm, 0); npos[x][1], npos[x][2] = p[0], p[1]
# where a crossing bends at the runway edge (the taxiways either side are offset: P1 to W3, M1 to W2), it is rounded off
# so an aircraft sweeps through the turn instead of pivoting on the edge line (two rounds of corner cutting)
def chaikin(pl, n=2):
    for _ in range(n):
        out = [pl[0]]
        for i in range(len(pl) - 1):
            a, b = pl[i], pl[i+1]; out += [(0.75*a[0] + 0.25*b[0], 0.75*a[1] + 0.25*b[1]), (0.25*a[0] + 0.75*b[0], 0.25*a[1] + 0.75*b[1])]
        pl = out[:1] + out[2:-1] + [pl[-1]] if len(pl) > 2 else pl
        pl = [pl[0]] + pl[1:-1] + [pl[-1]]
    return pl
_np = {n[0]: (n[1], n[2]) for n in nodes}
for x, es in xs.items():
    for e in es:
        pl = [_np[x]] + [tuple(q) for q in e[3]] + [_np[e[1]]]
        if len(pl) > 2: e[3] = [[r1(q[0]), r1(q[1])] for q in chaikin(pl)[1:-1]]
print('crossings redrawn', len(xs))


# ── the runway-end entries (AD 2.13: the full-length take-off positions) and where the AIP allows intersection take-offs
# from. Every other runway holding point is an exit (or a crossing).
INTX = {'04': ['G5'], '22': ['G1', 'G2'], '06': ['S1', 'S10'], '24': ['S7E', 'S8', 'S6', 'S5', 'S4', 'S3'], '09': ['N5', 'N4', 'N3'],
        '18C': ['W1', 'W2', 'W3', 'W4', 'W5'], '36C': ['W10', 'W11', 'W9', 'W12', 'W8', 'W7'], '18L': ['E5', 'E4', 'E8', 'E2'], '36L': ['V3', 'V2', 'V1']}
TORA = {('04', 'G5'): 1909, ('22', 'G1'): 2015, ('22', 'G2'): 1714, ('06', 'S1'): 2596, ('06', 'S10'): 2596, ('24', 'S7E'): 3435, ('24', 'S8'): 3266,
        ('24', 'S6'): 3245, ('24', 'S5'): 3205, ('24', 'S4'): 2611, ('24', 'S3'): 1981, ('09', 'N5'): 3434, ('09', 'N4'): 2400, ('09', 'N3'): 1881,
        ('18C', 'W1'): 3271, ('18C', 'W2'): 3072, ('18C', 'W3'): 2681, ('18C', 'W4'): 2378, ('18C', 'W5'): 2090, ('36C', 'W10'): 3300,
        ('36C', 'W11'): 3297, ('36C', 'W9'): 3050, ('36C', 'W12'): 3050, ('36C', 'W8'): 2695, ('36C', 'W7'): 2131, ('18L', 'E5'): 2820,
        ('18L', 'E4'): 2582, ('18L', 'E8'): 2547, ('18L', 'E2'): 2114, ('36L', 'V3'): 3247, ('36L', 'V2'): 2748, ('36L', 'V1'): 2148}
ends_found = collections.defaultdict(list)
for k, h in holds.items():
    if h[6]: ends_found[h[6]].append(k)
print('runway-end entries', dict(ends_found))
print('IHPs', ihps)
# N2N (on E6 north of 09/27) is for crossing southbound only: north of it E6 leads to the 18L end and nothing else, so it
# is no exit off 09/27
for k in holds:
    if re.sub(r'~\d+$', '', k) == 'N2N': holds[k][5] = ''
# G6, north of 04/22 at the 04 end, leads only to E10 at the 18L/36R end: a crossing to and from G5, no exit off 04/22
for k in holds:
    if re.sub(r'~\d+$', '', k) == 'G6': holds[k][5] = ''
# runway 06 has no full-length entry (its threshold is displaced 244 m and the AIP's take-off positions are S1 and S10,
# 2,596 m): those two are where 06 departures line up, so they are its departure end
for k, h in holds.items():
    if re.sub(r'~\d+$', '', k) in ('S1', 'S10') and '06' in h[5].split(','): h[6] = '06'
# taxiway bridges (OpenStreetMap bridge=yes): A and B over the A4 south of 36C, V over the Hoofdvaart and the Hoofdweg on
# the way to the Polderbaan (where V and Y cross the A5 the motorway is in a tunnel under them: nothing to draw)
bridges = [[tname(w['tags'].get('ref')) or '', [[r1(NODE[n][0]), r1(NODE[n][1])] for n in w['nodes']]] for w in ways
           if w.get('tags', {}).get('aeroway') == 'taxiway' and w.get('tags', {}).get('bridge') not in (None, 'no')]
print('taxiway bridges', [(b[0], len(b[1])) for b in bridges])
out = {'runways': runways, 'nodes': nodes, 'edges': edges, 'rnodes': rnodes,
       'holds': {k: h[:7] + [h[8]] for k, h in holds.items()}, 'hlink': {k: h[7] for k, h in holds.items() if h[7]}, 'fil': fil, 'hs': hs,
       'gates': gates, 'ihps': ihps, 'aprons': aprons_out, 'buildings': blds, 'hside': hside, 'leads': leads, 'vac': vac,
       'bridges': bridges, 'intx': INTX, 'tora': {f'{a}|{b}': v for (a, b), v in TORA.items()}}
with open(OUT, 'w') as fo:
    fo.write('''// ═════════════════════════ Amsterdam Schiphol (EHAM): aerodrome layout ═════════════════════════
// Generated by tools/eham_ground.py from OpenStreetMap (taxiway centrelines, aprons, terminals, hangars) and the Dutch AIP
// (AIRAC AMDT 12/2026): runway ends and thresholds AD 2.12/2.13, every stop bar and taxiway name off the ground movement
// chart (GMC-1), every stand at the parking/docking charts' INS coordinates. Positions are metres east and north of the
// ARP (52°18'29"N 4°45'51"E).
// runways: pavement ends a (the low-numbered end) and b, length, thresholds in metres from a, elevations (ft), width
// nodes [id, east, north] (x: on a runway centreline, s: a stand's lead-in), edges [a, b, taxiway, intermediate points],
// rnodes: runway-edge points on each entry/exit; holds key: [hold node, runway-edge node, runway, m along it, offset,
// directions that can turn off there, runway end it serves, taxiway]; hlink: the bend between the runway edge and the
// holding point; fil: centreline to runway-edge fillet in the runway frame; hs: holding positions before a runway;
// gates: [stand, apron or pier, stop point [e, n], lead-in node, heading into the stand, the painted lead-in line from the
// lane (0: none), largest wingspan (m), use (P taxi in and push back, TT tow on and off, DI de-icing pad)]; ihps: [name,
// node] holding points away from the runways; vac: stands never in use together; intx: the AIP's intersection take-off
// points by runway; tora: their take-off run available (m); bridges: [taxiway, centreline] where it crosses a road or
// canal on a bridge.
const EHAM_GROUND = ''')
    fo.write(json.dumps(out, separators=(',', ':')))
    fo.write(';\nif (typeof module !== \'undefined\') module.exports = EHAM_GROUND;\n')
print('nodes', len(nodes), 'edges', len(edges), 'holds', len(holds), 'gates', len(gates), 'ihps', len(ihps), 'blds', len(blds))
for rid in FR:
    print(rid, sorted([(k, h[3], h[4], h[5], h[6]) for k, h in holds.items() if h[2] == rid], key=lambda x: x[1]))
