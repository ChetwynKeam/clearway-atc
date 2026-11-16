# Newcastle (EGNT) aerodrome layout from the UK AIP charts -> src/airports/egnt-ground.js
# usage: python3 tools/egnt_ground.py <AD 2-EGNT-2-1 pdf> <AD 2-EGNT-2-2 pdf> <osm aerodrome.json> src/airports/egnt-ground.js
# (the charts are 526110.pdf and 526113.pdf in the AIP download; aerodrome.json is the osm-data-egnt branch's, for the
# buildings only). Every taxiway centreline, holding point and stand comes from the charts (tools/egnt/chart.py):
#  - the painted centrelines of the parking/docking chart (2-2) for the Main Apron, A, B, D as far as D5, E, F, G and the
#    GA and Golf aprons;
#  - beyond what 2-2 covers (D east of D5, the Delta loop at the 25 end, Charlie and its CW link) no paint is charted, so
#    the centreline is the middle of the aerodrome chart's (2-1) taxiway pavement (its skeleton);
#  - the holding points where each chart's yellow bars cross the centreline, named by the sign beside them: runway holding
#    points A1, B, CW, CE, D1, E, F, G (black signs); the CAT II/III points A2, D2 and D3 (vMATS: LVP holds) and the
#    intermediate holding points A3-A5, B2, D4-D8 (red signs) as intermediate holding points;
#  - every stand at its published coordinate (the T-bar where the nose stops), on the heading of its painted lead-in line,
#    lead in from the lane that line comes off.
# One runway, 07/25 (2,330 m pavement with the thresholds displaced 124 m and 137 m). Then the method of
# tools/eggd_ground.py: the runway frame, the holding points' links to the centreline, the crossing (B to F), the stands.
import json, math, re, sys, collections, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), 'egnt'))
from chart import Charts, skeleton_branches, en, THR, near
from shapely.geometry import Point, LineString
from ground_lanes import add_crossovers
ADC, PARK, OSM, OUT = sys.argv[1:5]
C = Charts(ADC, PARK)
print('parking chart fit', C.park_fit)
r1 = lambda v: round(v, 1)
# ── the runway (AD 2-EGNT-2-1): the pavement ends from the chart's runway, on the line through the two thresholds
tlo, thi = THR['07'], THR['25']
U = ((thi[0]-tlo[0])/math.dist(tlo, thi), (thi[1]-tlo[1])/math.dist(tlo, thi)); N = (-U[1], U[0])
rpoly = max(C.polys('adc', near((0.46, 0.49, 0.5))), key=lambda p: p.area)
ms = [(q[0]-tlo[0])*U[0] + (q[1]-tlo[1])*U[1] for q in rpoly.exterior.coords]
a = (tlo[0] + U[0]*min(ms), tlo[1] + U[1]*min(ms)); L = max(ms) - min(ms)
b = (a[0] + U[0]*L, a[1] + U[1]*L)
mo = lambda p: ((p[0]-a[0])*U[0] + (p[1]-a[1])*U[1], (p[0]-a[0])*N[0] + (p[1]-a[1])*N[1])
fr = lambda m, o: (a[0] + U[0]*m + N[0]*o, a[1] + U[1]*m + N[1]*o)
thr = {'07': r1(mo(tlo)[0]), '25': r1(mo(thi)[0])}
print('runway', r1(L), 'm, thresholds', thr)
runways = [{'id': '0725', 'lo': '07', 'hi': '25', 'a': [r1(a[0]), r1(a[1])], 'b': [r1(b[0]), r1(b[1])], 'len': r1(L), 'thr': thr, 'elev': {'07': 263, '25': 239}}]
onC = lambda p: abs(p[1]) < 3 and -60 < p[0] < L + 60
inRwy = lambda p: abs(mo(p)[1]) < 30 and -5 < mo(p)[0] < L + 5
# ── centrelines
stand_pts = list(C.stands.values())
def is_stand_line(l): return min(math.dist(l['pts'][0], s) for s in stand_pts) < 6 or min(math.dist(l['pts'][-1], s) for s in stand_pts) < 6
painted = [l['pts'] for l in C.lines if l['L'] >= 12 and not l['closed'] and not is_stand_line(l)]
# the end of the painted Delta (by D5): beyond it the skeleton of the aerodrome chart's pavement
d_paint = max(painted, key=lambda q: sum(math.dist(q[i], q[i+1]) for i in range(len(q)-1)))
d_end = max(d_paint, key=lambda p: p[0])
M, box = C.pave_mask()
sk = []
for br in skeleton_branches(M, box):
    Lb = sum(math.dist(br[i], br[i+1]) for i in range(len(br)-1))
    if Lb < 6: continue
    if min(p[0] for p in br) < d_end[0] - 2: continue               # covered by the paint
    mp = br[len(br)//2]
    if 895 < mp[0] < 970 and 425 < mp[1] < 480: continue            # the disused stub off the runway by the 25 threshold (no name, leads nowhere)
    if all(abs(mo(p)[1]) < 60 for p in br): continue                # bits of the runway end, its stopway and D1's splayed mouth
    # spurs: a short branch with a free end (the skeleton's whiskers into the corners of the pavement)
    sk.append(br)
# drop the whiskers: branches under 15 m with an end that no other branch shares
ends = collections.Counter((round(p[0]), round(p[1])) for br in sk for p in (br[0], br[-1]))
def shared(p): return any(abs(q[0] - p[0]) <= 2 and abs(q[1] - p[1]) <= 2 and n > 0 for q, n in ends.items() if (q[0], q[1]) != (round(p[0]), round(p[1]))) or ends[(round(p[0]), round(p[1]))] > 1
sk = [br for br in sk if sum(math.dist(br[i], br[i+1]) for i in range(len(br)-1)) >= 15 or (shared(br[0]) and shared(br[-1]))]
# duplicates (the tracer walks each branch from both ends)
uniq = []
for br in sk:
    mid_ = lambda q: LineString(q).interpolate(0.5, normalized=True)
    if any((math.dist(br[0], o[-1]) < 1.5 and math.dist(br[-1], o[0]) < 1.5 or math.dist(br[0], o[0]) < 1.5 and math.dist(br[-1], o[-1]) < 1.5)
           and mid_(br).distance(mid_(o)) < 3 for o in uniq): continue
    uniq.append(br)
sk = uniq
# where the skeleton runs along a painted line (Charlie below its fork) the paint is kept: the skeleton is cut back to
# where it leaves it
from shapely.geometry import LineString as _LS
_pl = [_LS(q) for q in painted]
def _onpaint(p): return any(l.distance(Point(p)) < 4 for l in _pl)
cut = []
for br in sk:
    k0, k1 = 0, len(br)
    while k0 < k1 - 1 and _onpaint(br[k0]): k0 += 1
    while k1 - 1 > k0 and _onpaint(br[k1 - 1]): k1 -= 1
    q = br[max(0, k0 - 1):min(len(br), k1 + 1)] if (k0 or k1 < len(br)) else br
    if k1 - k0 < 2 and all(_onpaint(p) for p in br): continue
    if k0: q[0] = tuple(min(_pl, key=lambda l: l.distance(Point(br[k0]))).interpolate(min(_pl, key=lambda l: l.distance(Point(br[k0]))).project(Point(br[k0]))).coords[0])
    if k1 < len(br): l_ = min(_pl, key=lambda l: l.distance(Point(br[k1 - 1]))); q[-1] = tuple(l_.interpolate(l_.project(Point(br[k1 - 1]))).coords[0])
    if sum(math.dist(q[i], q[i+1]) for i in range(len(q)-1)) >= 4: cut.append(q)
sk = cut
# the skeleton is traced on a 1 m grid: smoothed (a few passes of a three-point average, the ends kept) and resampled
def smooth(q, n=4):
    q = [tuple(p) for p in q]
    dense = [q[0]]
    for i in range(len(q) - 1):
        k = max(1, int(math.dist(q[i], q[i+1])/3))
        for j in range(1, k + 1): dense.append((q[i][0] + (q[i+1][0]-q[i][0])*j/k, q[i][1] + (q[i+1][1]-q[i][1])*j/k))
    for _ in range(n*3):
        dense = [dense[0]] + [((dense[i-1][0] + 2*dense[i][0] + dense[i+1][0])/4, (dense[i-1][1] + 2*dense[i][1] + dense[i+1][1])/4) for i in range(1, len(dense) - 1)] + [dense[-1]]
    out = [dense[0]]
    for p in dense[1:-1]:
        if math.dist(p, out[-1]) >= 6: out.append(p)
    return out + [dense[-1]]
sk = [smooth(q) for q in sk]
# the skeleton's Delta starts at the end of the paint
for br in sk:
    for k in (0, -1):
        if math.dist(br[k], d_end) < 25: pass
sk_d = min(sk, key=lambda br: min(math.dist(br[0], d_end), math.dist(br[-1], d_end)))
if math.dist(sk_d[-1], d_end) < math.dist(sk_d[0], d_end): sk_d.reverse()
# the skeleton branch from west of the paint's end: cut where the paint ends
sk_d[0] = d_end
ways = [list(map(tuple, w)) for w in painted] + [list(map(tuple, br)) for br in sk]
print('painted lanes', len(painted), 'skeleton lanes', len(sk))
# runway links: a lane that ends on the runway strip is carried on to the centreline along its last direction
for w in ways:
    for k in (0, -1):
        p = w[k]; m_, o_ = mo(p)
        if abs(o_) < 50 and -5 < m_ < L + 5 and abs(o_) > 3:
            q = w[1] if k == 0 else w[-2]; mq, oq = mo(q)
            if abs(oq) <= abs(o_): continue
            dm, do = m_ - mq, o_ - oq
            t = -o_/do; c = fr(m_ + dm*t, 0)
            if k == 0: w.insert(0, c)
            else: w.append(c)
def _unused(): pass
def seg_proj(p, q0, q1):
    ex, ey = q1[0]-q0[0], q1[1]-q0[1]; LL = ex*ex + ey*ey or 1e-9; u = max(0, min(1, ((p[0]-q0[0])*ex + (p[1]-q0[1])*ey)/LL))
    return math.dist(p, (q0[0] + ex*u, q0[1] + ey*u)), u
# the chart paints some stretches twice (Bravo between B2 and the B holding point: two lines a metre apart, one running
# on past the other's end). The lanes are laid out every 3 m, and a lane's end that runs within 2.5 m along another lane
# is cut back to where it leaves it, so each stretch of taxiway has one centreline
def densify(q, step=3.0):
    out = [q[0]]
    for i in range(len(q) - 1):
        k = max(1, int(math.dist(q[i], q[i+1])/step))
        for j in range(1, k + 1): out.append((q[i][0] + (q[i+1][0]-q[i][0])*j/k, q[i][1] + (q[i+1][1]-q[i][1])*j/k))
    return out
ways = [densify(w) for w in ways]
for wi, w in enumerate(ways):
    others = [LineString(o) for wj, o in enumerate(ways) if wj != wi and len(o) > 1]
    on = lambda p: any(l.distance(Point(p)) < 2.5 for l in others)
    k0, k1 = 0, len(w)
    while k0 < k1 - 1 and on(w[k0]): k0 += 1
    while k1 - 1 > k0 and on(w[k1 - 1]): k1 -= 1
    run0 = sum(math.dist(w[i], w[i+1]) for i in range(max(0, k0 - 1))) if k0 else 0
    run1 = sum(math.dist(w[i], w[i+1]) for i in range(k1, len(w) - 1)) if k1 < len(w) else 0
    if run0 > 20 or run1 > 20:
        print('lane end along another lane cut back', round(run0), round(run1), 'm at', tuple(round(v) for v in w[0]))
        ways[wi] = w[max(0, k0 - 1) if run0 > 20 else 0: min(len(w), k1 + 1) if run1 > 20 else len(w)]
ways = [w for w in ways if len(w) > 1 and sum(math.dist(w[i], w[i+1]) for i in range(len(w)-1)) > 4]
# a lane end that stops short of the lane it points at (the paint breaks at a holding point bar: the A holding bay's top
# end by A3) is carried on along its own direction onto it, up to 15 m
def ray_seg(p, d, q0, q1):
    ex, ey = q1[0]-q0[0], q1[1]-q0[1]; den = d[0]*ey - d[1]*ex
    if abs(den) < 1e-9: return None
    t = ((q0[0]-p[0])*ey - (q0[1]-p[1])*ex)/den; u = ((q0[0]-p[0])*d[1] - (q0[1]-p[1])*d[0])/den
    return t if 0 <= u <= 1 else None
for wi, w in enumerate(ways):
    for k in (0, -1):
        p, q = w[k], (w[1] if k == 0 else w[-2])
        if abs(mo(p)[1]) < 50 and -5 < mo(p)[0] < L + 5: continue
        if any(seg_proj(p, o[i], o[i+1])[0] < 5.0 for wj, o in enumerate(ways) if wj != wi for i in range(len(o) - 1)): continue
        Lq = math.dist(p, q) or 1; d = ((p[0]-q[0])/Lq, (p[1]-q[1])/Lq); best = None
        for wj, o in enumerate(ways):
            if wj == wi: continue
            for i in range(len(o) - 1):
                t = ray_seg(p, d, o[i], o[i+1])
                if t is not None and 0 < t < 15 and (best is None or t < best): best = t
        if best:
            e_ = (p[0] + d[0]*(best + 0.5), p[1] + d[1]*(best + 0.5))
            if k == 0: w.insert(0, e_)
            else: w.append(e_)
            print('lane end carried on', round(best, 1), 'm at', tuple(round(v) for v in p))
# ── junctions: lane ends snapped onto the lane they stop at, crossings split, so the lanes share nodes
SNAP = 5.0
def insert_at(w, p):
    """put point p on lane w at its nearest segment; return its index"""
    best = None
    for i in range(len(w) - 1):
        d, u = seg_proj(p, w[i], w[i+1])
        if best is None or d < best[0]: best = (d, i, u)
    d, i, u = best
    if u < 1e-3 and math.dist(w[i], p) < 1.0: w[i] = p; return i
    if u > 1 - 1e-3 and math.dist(w[i+1], p) < 1.0: w[i+1] = p; return i + 1
    w.insert(i + 1, p); return i + 1
for wi, w in enumerate(ways):
    for k in (0, -1):
        p = w[k]
        if inRwy(p) and abs(mo(p)[1]) < 1: continue
        best = None
        for wj, o in enumerate(ways):
            if wj == wi: continue
            for i in range(len(o) - 1):
                d, u = seg_proj(p, o[i], o[i+1])
                if d < SNAP and (best is None or d < best[0]): best = (d, wj, i, u)
        if best:
            d, wj, i, u = best; o = ways[wj]; q = (o[i][0] + (o[i+1][0]-o[i][0])*u, o[i][1] + (o[i+1][1]-o[i][1])*u)
            # snap to an existing vertex within 2 m
            vs = [v for v in o if math.dist(v, q) < 2.0]
            if vs: q = min(vs, key=lambda v: math.dist(v, q))
            else: insert_at(o, q)
            w[k] = q
# a lane end snapped onto a lane whose own end then moved can be left a metre or two short of it: lane ends within 3 m
# of each other are joined at one point (an interior vertex of a lane there if there is one, so that junction stays)
for _ in range(2):
    ends = [(wi, k) for wi in range(len(ways)) for k in (0, -1)]
    for ia in range(len(ends)):
        for ib in range(ia + 1, len(ends)):
            (wa, ka), (wb, kb) = ends[ia], ends[ib]
            pa, pb = ways[wa][ka], ways[wb][kb]
            if wa == wb or pa == pb or math.dist(pa, pb) > 3.5: continue
            inner = [v for w in ways for v in w[1:-1] if v in (pa, pb)]
            if len(inner) > 1: continue
            q = inner[0] if inner else ((pa[0] + pb[0])/2, (pa[1] + pb[1])/2)
            ways[wa][ka] = q; ways[wb][kb] = q
            for w in ways:
                for i in (0, -1):
                    if w[i] in (pa, pb): w[i] = q
def xing(p1, p2, p3, p4):
    d = (p2[0]-p1[0])*(p4[1]-p3[1]) - (p2[1]-p1[1])*(p4[0]-p3[0])
    if abs(d) < 1e-9: return None
    t = ((p3[0]-p1[0])*(p4[1]-p3[1]) - (p3[1]-p1[1])*(p4[0]-p3[0]))/d; u = ((p3[0]-p1[0])*(p2[1]-p1[1]) - (p3[1]-p1[1])*(p2[0]-p1[0]))/d
    if 0.02 < t < 0.98 and 0.02 < u < 0.98: return (p1[0] + (p2[0]-p1[0])*t, p1[1] + (p2[1]-p1[1])*t)
for _ in range(3):
    for wi in range(len(ways)):
        for wj in range(wi + 1, len(ways)):
            w, o = ways[wi], ways[wj]; done = False
            for i in range(len(w) - 1):
                for j in range(len(o) - 1):
                    x = xing(w[i], w[i+1], o[j], o[j+1])
                    if x: w.insert(i + 1, x); o.insert(j + 1, x); done = True; break
                if done: break
# ── holding points: where each bar crosses a lane. The parking chart's bars where it has them (it is drawn larger), else
# the aerodrome chart's; the aerodrome chart's CW and CE bars are drawn as one block across both arms of Charlie
bars = {b['name']: b for b in C.bars_a}
bars.update({b['name']: b for b in C.bars_p if b['name'] != 'CW'})
HP = {}
def bar_hits(b, pad=4):
    c, ax, hl = b['c'], b['ax'], b['len']/2 + pad
    p0, p1 = (c[0] - ax[0]*hl, c[1] - ax[1]*hl), (c[0] + ax[0]*hl, c[1] + ax[1]*hl)
    hits = []
    for wi, w in enumerate(ways):
        for i in range(len(w) - 1):
            d = (p1[0]-p0[0])*(w[i+1][1]-w[i][1]) - (p1[1]-p0[1])*(w[i+1][0]-w[i][0])
            if abs(d) < 1e-9: continue
            t = ((w[i][0]-p0[0])*(w[i+1][1]-w[i][1]) - (w[i][1]-p0[1])*(w[i+1][0]-w[i][0]))/d; u = ((w[i][0]-p0[0])*(p1[1]-p0[1]) - (w[i][1]-p0[1])*(p1[0]-p0[0]))/d
            if 0 <= t <= 1 and 0 <= u <= 1: hits.append((wi, (p0[0] + (p1[0]-p0[0])*t, p0[1] + (p1[1]-p0[1])*t), abs(t - 0.5)))
    return hits
for nm, b in sorted(bars.items()):
    hs = bar_hits(b)
    if nm == 'CE':   # one block over both arms: the west arm's crossing is CW, the east arm's CE
        hs = sorted(hs, key=lambda h: h[1][0])
        if len(hs) >= 2:
            for (wi, p, _), nm_ in ((hs[0], 'CW'), (hs[-1], 'CE')): insert_at(ways[wi], p); HP[p] = nm_
        print('CW/CE bar crosses', [(round(p[0]), round(p[1])) for _, p, _ in hs])
        continue
    if not hs: print('no lane under bar', nm); continue
    # A2 runs across both A and its holding bay lane: one holding point on each; the rest have one lane under them
    pick = hs if nm == 'A2' else [min(hs, key=lambda h: h[2])]
    for wi, p, _ in pick: insert_at(ways[wi], p); HP[p] = nm
print('holding points', sorted(collections.Counter(HP.values()).items()))
RWY_HOLDS = {'A1', 'B', 'CW', 'CE', 'D1', 'E', 'F', 'G'}
CAT23 = {'A2', 'D2', 'D3'}
# ── nodes and segments (as tools/eggd_ground.py: graph nodes where lanes meet or end, and at holding points)
NODE, ids = {}, {}
def pid(p):
    k = (round(p[0], 2), round(p[1], 2))
    if k not in ids: ids[k] = len(ids); NODE[ids[k]] = p
    return ids[k]
wn = [[pid(p) for p in w] for w in ways]
wn = [[n for i, n in enumerate(w) if i == 0 or n != w[i-1]] for w in wn]
HPN = {pid(p): nm for p, nm in HP.items()}
# the junctions' painted turn-off curves: lanes under 90 m that leave one lane and join another (no stand comes off them)
_cnt = collections.Counter(n for w in wn for n in set(w))
FILLET = {i for i, w in enumerate(wn) if sum(math.dist(NODE[w[k]], NODE[w[k+1]]) for k in range(len(w)-1)) < 90 and _cnt[w[0]] > 1 and _cnt[w[-1]] > 1
          and not any(n in HPN for n in w)}
use = collections.Counter(n for w in wn for n in set(w))
endsN = set(n for w in wn for n in (w[0], w[-1]))
gnodes = set(n for n, c in use.items() if c > 1) | endsN | set(HPN)
# ── names: the chart's taxiway labels (2-1, 2-2) for each lane, by where it runs
TWYLAB = []
for w in C.awords:
    if w[0].startswith('Twy') or w[0] in ('A', 'B', 'C', 'D', 'E', 'F', 'G'): pass
aprons_adc = C.polys('adc', near((0.83, 0.84, 0.84)))
from shapely.geometry import Point, LineString
def name_of(w):
    pts = [NODE[n] for n in w]; mid = LineString(pts).interpolate(0.5, normalized=True); mp = (mid.x, mid.y)
    m_, o_ = mo(mp)
    if o_ < -20:                                       # south of the runway
        if mp[0] > -260: return 'G'
        if mp[0] > -420: return 'E'
        if mp[1] > -470 and mp[0] > -560: return 'F'
        return 'APRON'                                 # the GA Apron's lanes
    if mp[0] > 330 and mp[1] < 330 and o_ > 0: return 'C'        # Charlie and its CW link, between Delta and the runway
    if any(a_.contains(Point(mp)) for a_ in aprons_adc) and not (-1000 < mp[0] < -820): return None   # apron lanes: named by their neighbours (D and B run on across the Main Apron)
    return None
names = [name_of(w) for w in wn]
# the long lanes by what they are: Delta (the painted one and the skeleton on to the loop), Alfa, Bravo
def wlen(w): return sum(math.dist(NODE[w[i]], NODE[w[i+1]]) for i in range(len(w)-1))
def mid(w): q = LineString([NODE[n] for n in w]).interpolate(0.5, normalized=True); return (q.x, q.y)
for i, w in enumerate(wn):
    if names[i]: continue
    mp = mid(w); m_, o_ = mo(mp); Lw = wlen(w)
    xs = [NODE[n][0] for n in w]; ys = [NODE[n][1] for n in w]
    if mp[0] > -840 and o_ > 60 and mp[1] > -60: names[i] = 'D'                       # Delta, from the Main Apron to the 25 end
    elif max(ys) - min(ys) > 200 and -960 < mp[0] < -840: names[i] = 'A'              # Alfa through the Main Apron
    elif -1110 < mp[0] < -1000 and mp[1] < -250: names[i] = 'A'                         # Alfa south of Bravo to the 07 end, and its holding bay lane
    elif max(xs) - min(xs) > 200 and mp[1] < -180: names[i] = 'B'                      # Bravo
    elif max(xs) - min(xs) > 600: names[i] = 'D'
# Charlie: the lanes from the runway up to Delta, with the CW and CE holding points on its two arms (AD 2-EGNT-2-1: TWY C
# "RWY to CE" and "CW Link")
cw = {pid(p) for p, nm in HP.items() if nm in ('CW', 'CE')}
for i, w in enumerate(wn):
    if cw & set(w) or (330 < mid(w)[0] < 480 and mid(w)[1] < 330 and mo(mid(w))[1] > 0): names[i] = 'C'
segs = []
for wi, w in enumerate(wn):
    cur = [w[0]]
    for n in w[1:]:
        cur.append(n)
        if n in gnodes: segs.append([cur[0], cur[-1], names[wi], cur[1:-1], wi]); cur = [n]
# the skeleton runs the end of Delta's paint and the CW arm together through their junction: a Charlie segment more
# than 162 m from the runway centreline is Delta (Delta runs 170-185 m out there, Charlie's arms below 160 m)
for s_ in segs:
    if s_[2] == 'C':
        q = [NODE[s_[0]]] + [NODE[n] for n in s_[3]] + [NODE[s_[1]]]
        if mo(LineString(q).interpolate(0.5, normalized=True).coords[0])[1] > 162: s_[2] = 'D'
adj = collections.defaultdict(list)
for s in segs: adj[s[0]].append(s); adj[s[1]].append(s)
for it in range(8):
    for s in segs:
        if s[2]: continue
        na = [t[2] for t in adj[s[0]] if t is not s and t[2] and t[2] != 'APRON']; nb = [t[2] for t in adj[s[1]] if t is not s and t[2] and t[2] != 'APRON']
        common = [x for x in na if x in nb]
        if common: s[2] = common[0]
        elif it >= 2 and (na or nb): s[2] = (nb or na)[0]
for s in segs:
    if not s[2]: s[2] = 'APRON'
# the apron lanes in front of the stands are Delta (north of the pier) and Bravo (south): the chart labels them so
print('taxiway names', sorted(collections.Counter(s[2] for s in segs).items()))
# ── each holding point's way down to the centreline (eggd_ground.py)
nid = {}
def NID(n): return nid.setdefault(n, 'n%d' % len(nid))
holds, fil, rnodes, hs, paths, drop, hold_used = {}, {}, [], {}, [], set(), []
cnt = collections.Counter()
def inward(hp):
    res = []
    def dfs(n, pts, used, depth):
        if depth > 8 or len(res) > 6: return
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
            if o in HPN: continue
            dfs(o, Pp, used + [t], depth + 1)
    dfs(hp, [mo(NODE[hp])], [], 0)
    return res
for h in sorted([n for n, nm in HPN.items() if nm in RWY_HOLDS], key=lambda n: mo(NODE[n])[0]):
    ref = HPN[h]; ps = inward(h)
    if not ps: print('holding point', ref, 'has no way to the runway'); continue
    hs[NID(h)] = '0725'
    for Pp, used in ps:
        for t in used: drop.add(id(t))
        hold_used.append((h, used))
        Pp = Pp[::-1]
        lim = min(40, abs(Pp[-1][1])*0.5)
        f = [Pp[0]]; rest = []
        for i in range(1, len(Pp)):
            if abs(Pp[i][1]) >= lim:
                p0, p1 = Pp[i-1], Pp[i]; k = (lim - abs(p0[1]))/(abs(p1[1]) - abs(p0[1]) or 1)
                f.append((p0[0] + (p1[0]-p0[0])*k, p0[1] + (p1[1]-p0[1])*k)); rest = Pp[i:-1]; break
            f.append(Pp[i])
        hp_m = mo(NODE[h])[0]
        d = f[-1][0] - f[0][0]; ang = math.degrees(math.atan2(abs(f[-1][1] - f[0][1]), abs(d)))
        dirs = ['07', '25'] if ang > 55 else (['07'] if d > 0 else ['25'])
        m0 = f[0][0]; endr = '07' if m0 < 250 and hp_m < 250 else '25' if m0 > L - 250 and hp_m > L - 250 else ''
        if endr: dirs = ['07', '25']
        cnt[ref] += 1; key = ref if cnt[ref] == 1 else '%s~%d' % (ref, cnt[ref])
        rn = 'R%d' % len(rnodes); fe = fr(*f[-1])
        rnodes.append([rn, r1(fe[0]), r1(fe[1])])
        hp = mo(NODE[h])
        tws = [t[2] or 'APRON' for t in used]; tw = next((t for t in tws if t != 'APRON'), ref)
        holds[key] = [NID(h), rn, '0725', r1(hp[0]), r1(hp[1]), ','.join(dirs), endr, [[r1(m), r1(o)] for m, o in rest], tw]
        fil[key] = [[r1(m), r1(o)] for m, o in f]
        paths.append((h, f[0], key))
def on_rwy(t): return any(onC(mo(NODE[q])) for q in [t[0], t[1]] + t[3])
keep = set()
for h, used in hold_used:
    n, seq = h, []
    for t in used: n = t[1] if t[0] == n else t[0]; seq.append(n)
    last = -1
    for i, n in enumerate(seq[:-1]):
        if any(t not in used and id(t) not in drop and not on_rwy(t) for t in adj[n]): last = i
    for t in used[:last + 1]: keep.add(id(t))
drop -= keep
# the crossing: Bravo (angled off the runway, north) and Foxtrot (square, south) meet it 40 m apart, the only place a
# taxiway on one side faces one on the other. The crossing node is on the centreline between them; the aircraft taxis
# straight across (sim.js straightCross).
xedges, XN, pairs = [], {}, set()
for h1, c1, k1 in paths:
    for h2, c2, k2 in paths:
        if (h1, h2) in pairs or h1 >= h2: continue
        if abs(c1[0] - c2[0]) < 50 and mo(NODE[h1])[1]*mo(NODE[h2])[1] < 0:
            pairs.add((h1, h2)); x = 'x%d' % len(XN); XN[x] = fr((c1[0] + c2[0])/2, 0)
            for h, k in ((h1, k1), (h2, k2)):
                Rr = fil[k] + holds[k][7]
                xedges.append([x, NID(h), holds[k][8], [[r1(v) for v in fr(m, o)] for m, o in Rr[1:]]])
print('holds', len(holds), 'crossings', len(XN), [(HPN[h1], HPN[h2]) for h1, h2 in pairs])
def runway_seg(s): return id(s) in drop or any(onC(mo(NODE[n])) for n in [s[0], s[1]] + s[3])
edges, EFILLET = [], set()
for s in segs:
    if runway_seg(s): continue
    edges.append([NID(s[0]), NID(s[1]), s[2], [[r1(x) for x in NODE[n]] for n in s[3]]])
    if s[4] in FILLET: EFILLET.add(id(edges[-1]))
edges += xedges
g = collections.defaultdict(set)
for e in edges: g[e[0]].add(e[1]); g[e[1]].add(e[0])
for h in holds.values(): g[h[0]].add(h[1]); g[h[1]].add(h[0])
inv = {v: k for k, v in nid.items()}
for x, p in XN.items(): inv[x] = x; NODE[x] = p
nodes = [[k, r1(NODE[inv[k]][0]), r1(NODE[inv[k]][1])] for k in sorted({x for e in edges for x in e[:2]} | {h[0] for h in holds.values()}, key=lambda s: (s[0], int(s[1:])))]
fil = {k: fil[k] for k in holds}
# ── intermediate holding points (red signs) and the CAT II/III points, one entry per node (A2 has two, one on each lane)
ihps, cat23 = [], []
for n, ref in HPN.items():
    if ref in RWY_HOLDS or n not in nid: continue
    k = ref if ref not in [i[0] for i in ihps] else ref + '~2'
    ihps.append([k, nid[n]])
    if ref in CAT23: cat23.append(nid[n])
print('ihps', sorted(i[0] for i in ihps), 'cat23', len(cat23))
# ── stands (AD 2-EGNT-2-2): the T-bar at the published coordinate; the heading and the lead-in from the painted line
segpts = []
for e in edges:
    if id(e) in EFILLET: continue                          # stands come off the taxiway, never a junction's turn-off curve
    pl = [NODE[inv[e[0]]]] + [tuple(p) for p in e[3]] + [NODE[inv[e[1]]]]
    for i in range(len(pl) - 1): segpts.append((e, i, pl[i], pl[i+1]))
def ray_hit(p, dvec, maxd=200):
    best = None
    for e, i, q0, q1 in segpts:
        if e[2] in ('B', 'D', 'A', 'APRON', 'F', 'G') or True:
            ex, ey = q1[0]-q0[0], q1[1]-q0[1]; den = dvec[0]*ey - dvec[1]*ex
            if abs(den) < 1e-9: continue
            t = ((q0[0]-p[0])*ey - (q0[1]-p[1])*ex)/den; u = ((q0[0]-p[0])*dvec[1] - (q0[1]-p[1])*dvec[0])/den
            if 5 < t < maxd and -0.001 <= u <= 1.001 and (best is None or t < best[0]): best = (t, e, i, u)
    return best
def nearest_seg(p):
    best = None
    for e, i, q0, q1 in segpts:
        d, u = seg_proj(p, q0, q1)
        if best is None or d < best[0]: best = (d, e, i, u)
    return best
def segpts_of(e, i):
    pl = [NODE[inv[e[0]]]] + [tuple(p) for p in e[3]] + [NODE[inv[e[1]]]]
    return pl[i], pl[i+1]
def bear(p, q): return math.degrees(math.atan2(q[0]-p[0], q[1]-p[1])) % 360
slines = [l['pts'] for l in C.lines if l['L'] >= 12 and not l['closed'] and is_stand_line(l)]
# AD 2-EGNT-2-2 areas: the pier stands round the terminal (1-12, and 30 and 31 laid diagonally over 9 and 1 for widebodies),
# the north part of the Main Apron (13-25R), the GA Apron by the GA Centre (50-54, across the runway) and the Golf Apron (60-62,
# cargo, across the runway)
def term(sid):
    n = int(re.match(r'\d+', sid)[0])
    return 'T' if n <= 12 or n in (30, 31) else 'N' if n <= 25 else 'G' if n < 60 else 'C'
# stand 30's painted line, run on, meets Alfa where it is still heading north, too sharp a turn in for a widebody coming up
# from Bravo; the chart's arrowed curve off Alfa towards the apron (west of the Alfa/Delta junction) is the way in to 9 and 30
# Stand 7 likewise: the chart's caution (AD 2-EGNT-2-2) has it entered by following its lead-in from Bravo, where the
# arrowed curves off Alfa and Bravo meet, not by turning off Alfa towards A4
TURN_IN = {'30': (-972, -25), '7': (-991.4, -195.0)}
gates, splits = [], []
for sid, sp in sorted(C.stands.items(), key=lambda kv: (int(re.match(r'\d+', kv[0])[0]), kv[0])):
    ln = min(slines, key=lambda q: min(math.dist(q[0], sp), math.dist(q[-1], sp)))
    if math.dist(ln[0], sp) < math.dist(ln[-1], sp): ln = ln[::-1]       # from its far end to the T-bar
    hd = bear(ln[-2], ln[-1]) if math.dist(ln[-2], ln[-1]) > 2 else bear(ln[0], ln[-1])
    n0 = nearest_seg(ln[0])
    if n0[0] <= 12:                                       # the painted line comes off its lane: in along it
        hit = n0; t_, e_, i_, u_ = hit; q0, q1 = segpts_of(e_, i_); lq = (q0[0] + (q1[0]-q0[0])*u_, q0[1] + (q1[1]-q0[1])*u_)
        paint = [lq] + ln[1:-1] + [sp] if math.dist(lq, ln[0]) < 3 else [lq] + ln[:-1] + [sp]
    else:                                                 # the painted line stops short of the lane: on back along it
        b_ = math.radians(bear(ln[-1], ln[0]))
        hit = ray_hit(ln[0], (math.sin(b_), math.cos(b_)), 160) or ray_hit(sp, (math.sin(b_), math.cos(b_)), 220)
        if not hit: n1 = nearest_seg(ln[0]); hit = n1
        t_, e_, i_, u_ = hit; q0, q1 = segpts_of(e_, i_); lq = (q0[0] + (q1[0]-q0[0])*u_, q0[1] + (q1[1]-q0[1])*u_)
        paint = [lq] + ln[:-1] + [sp]
    if sid in TURN_IN:                                    # the chart's arrowed turn-in curve for this stand
        best = None
        for e in edges:
            pl = [NODE[inv[e[0]]]] + [tuple(p) for p in e[3]] + [NODE[inv[e[1]]]]
            for i in range(len(pl) - 1):
                d, u = seg_proj(TURN_IN[sid], pl[i], pl[i+1])
                if best is None or d < best[0]: best = (d, e, i, u)
        hit = best; t_, e_, i_, u_ = hit; q0, q1 = segpts_of(e_, i_); lq = (q0[0] + (q1[0]-q0[0])*u_, q0[1] + (q1[1]-q0[1])*u_)
        paint = [lq] + ln[:-1] + [sp]
    splits.append((sid, (hit[0], hit[1], hit[2], hit[3])))
    gates.append([sid, term(sid), [r1(sp[0]), r1(sp[1])], None, round(hd, 1), [[r1(x) for x in pt] for pt in paint]])
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
for gt in gates:
    gt[3] = gnode[gt[0]]
    # the painted line starts where the lane is: the lead-in point
    lp = POS.get(gt[3]) or NODE[inv[gt[3]]]
    gt[5][0] = [r1(lp[0]), r1(lp[1])]
    gt.append(0)
edges = add_crossovers(edges, nodes, gates, r1)
# lanes that lead nowhere the game goes: the GA Apron's rows for light aircraft (no numbered stands) and the skeleton's
# whiskers. Off the routing graph, kept as paint to draw. Echo stays: it leads to the maintenance hangar (egnt-engine.js)
keepn = {g[3] for g in gates} | {h[0] for h in holds.values()} | set(XN)
paint = []
while True:
    deg = collections.Counter(x for e in edges for x in e[:2])
    elen = lambda e: (lambda P: sum(math.dist(P[i], P[i+1]) for i in range(len(P)-1)))([NODE[inv[e[0]]] if e[0] in inv else (0, 0)] + [tuple(p) for p in e[3]] + [NODE[inv[e[1]]] if e[1] in inv else (0, 0)])
    dead = [e for e in edges if (e[2] != 'E' or len([x for x in e[:2] if deg[x] == 1]) and sum(1 for f in edges if f[2] == 'E' and any(deg[x] == 1 for x in f[:2])) > 1 and elen(e) < 40)
            and any(deg[x] == 1 and x not in keepn for x in e[:2])]
    if not dead: break
    for e in dead:
        Pn = {n[0]: (n[1], n[2]) for n in nodes}
        paint.append([list(Pn[e[0]])] + e[3] + [list(Pn[e[1]])]); edges.remove(e)
# a stand's lane left ending a few metres short of the taxiway once the rows beyond it went (stand 53 on the GA Apron):
# joined straight to the nearest lane node within 8 m
deg = collections.Counter(x for e in edges for x in e[:2]); Pn = {n[0]: (n[1], n[2]) for n in nodes}
nbr = collections.defaultdict(set)
for e in edges: nbr[e[0]].add(e[1]); nbr[e[1]].add(e[0])
for n, d in list(deg.items()):
    if d != 1 or deg[n] != 1 or n in {h[0] for h in holds.values()} or n in XN: continue
    cand = [m for m in deg if m != n and m not in nbr[n] and math.dist(Pn[n], Pn[m]) < 8]
    if cand:
        m = min(cand, key=lambda m: math.dist(Pn[n], Pn[m])); tw = next(e[2] for e in edges if n in e[:2])
        edges.append([n, m, tw, []]); deg[n] += 1; deg[m] += 1; nbr[n].add(m); nbr[m].add(n); print('lane end joined', round(math.dist(Pn[n], Pn[m]), 1), 'm to', m)
used_n = {x for e in edges for x in e[:2]} | {h[0] for h in holds.values()}
nodes = [n for n in nodes if n[0] in used_n]
print('pruned', len(paint), 'dead-end lane pieces (kept as paint)')
# ── pavement and buildings for drawing: the aerodrome chart's aprons and taxiways, the buildings from OpenStreetMap
def ring(pts): return [[r1(x) for x in p] for p in pts]
aprons_out = []
for P in C.polys('adc', near((0.83, 0.84, 0.84))) + C.polys('park', near((0.5, 0.51, 0.52))):
    for g_ in (P.geoms if hasattr(P, 'geoms') else [P]):
        if g_.area > 400: aprons_out.append(ring(list(g_.simplify(0.5).exterior.coords)))
twypave = []
for P in C.polys('adc', near((0.85, 0.76, 0.65))):
    for g_ in (P.geoms if hasattr(P, 'geoms') else [P]):
        if g_.area > 200: twypave.append({'out': ring(list(g_.simplify(0.5).exterior.coords)), 'holes': [ring(list(h.coords)) for h in g_.interiors]})
A0 = ARP = (55 + 2/60 + 17/3600, -(1 + 41/60 + 23/3600))
KX = 60*1852*math.cos(math.radians(A0[0])); KY = 60*1852
E = json.load(open(OSM))['elements']
blds = []
for w in E:
    t = w.get('tags', {})
    if w['type'] != 'way' or 'geometry' not in w or w['nodes'][0] != w['nodes'][-1]: continue
    if t.get('aeroway') in ('terminal', 'hangar') or t.get('building'):
        pts = ring([((g_['lon'] - A0[1])*KX, (g_['lat'] - A0[0])*KY) for g_ in w['geometry']])
        area = abs(sum(pts[i][0]*pts[i-1][1] - pts[i-1][0]*pts[i][1] for i in range(len(pts))))/2
        if area < 300 or not all(-1500 < x < 1300 and -900 < y < 900 for x, y in pts): continue
        hang = t.get('aeroway') == 'hangar' or t.get('building') == 'hangar'
        term_ = t.get('aeroway') == 'terminal' or t.get('building') == 'terminal'
        blds.append({'pts': pts, 'h': 18 if hang else 16 if term_ else 9, **({'roof': 'hangar'} if hang else {}), **({'name': t['name']} if t.get('name') else {})})
# tidy: lane points that repeat the one before (a split at an existing vertex) and lanes of no length between two nodes
# at the same spot. A zero-length step has no direction, and the taxiing aircraft weaves on it.
Pn = {n[0]: (n[1], n[2]) for n in nodes}
rank = lambda i: 0 if i in {h[0] for h in holds.values()} else 1 if i[0] == 's' else 2 if i[0] == 'x' else 3
while True:
    z = next((e for e in edges if not e[3] and e[0] != e[1] and math.dist(Pn[e[0]], Pn[e[1]]) < 0.6), None)
    if not z: break
    keep_, gone = sorted(z[:2], key=rank)
    edges.remove(z)
    for e in edges:
        for i in (0, 1):
            if e[i] == gone: e[i] = keep_
    for g in gates:
        if g[3] == gone: g[3] = keep_
    for h in holds.values():
        if h[0] == gone: h[0] = keep_
    for i in ihps:
        if i[1] == gone: i[1] = keep_
    cat23 = [keep_ if c == gone else c for c in cat23]
    hs = {(keep_ if k == gone else k): v for k, v in hs.items()}
    print('merged node', gone, 'into', keep_)
edges = [e for e in edges if e[0] != e[1]]
for e in edges:
    pl, out_ = [Pn[e[0]]], []
    for q in e[3]:
        if math.dist(pl[-1], q) >= 0.6 and math.dist(q, Pn[e[1]]) >= 0.6: out_.append(q); pl.append(q)
    e[3] = out_
# the lanes were laid out every 3 m to find their junctions; drawn that densely a taxiing aircraft (one path point a
# second) falls behind its own path and wanders. Straight runs keep only their ends; curves keep a point every few metres
def rdp(P, tol=0.3):
    if len(P) < 3: return P
    a, b = P[0], P[-1]; L = math.dist(a, b) or 1e-9
    d = [abs((b[0]-a[0])*(a[1]-p[1]) - (a[0]-p[0])*(b[1]-a[1]))/L for p in P[1:-1]]
    i = max(range(len(d)), key=lambda j: d[j])
    if d[i] <= tol: return [a, b]
    return rdp(P[:i+2], tol)[:-1] + rdp(P[i+1:], tol)
# the holding points' links to the runway likewise (runway frame), and the crossing's lanes keep only the points of
# those links (and of the line onto the runway), so they stay on one line with them
# (Charlie's two arms share their link down to the runway: a point either keeps, both keep, so the shared stretch stays one line)
KEEP = {tuple(q) for h in holds.values() if h[7] for q in rdp([tuple(q) for q in h[7]])}
for h in holds.values():
    if h[7]: h[7] = [list(q) for q in h[7] if tuple(q) in KEEP]
HLK = [fr(*q) for h in holds.values() for q in (h[7] or [])]
for e in edges:
    if e[0] in XN or e[1] in XN:
        e[3] = [q for q in e[3] if abs(mo(q)[1]) <= 40.5 or any(math.dist(q, z) < 0.6 for z in HLK)]
before = sum(len(e[3]) for e in edges)
for e in edges:
    if e[0] in XN or e[1] in XN: continue
    pl = [Pn[e[0]]] + [tuple(q) for q in e[3]] + [Pn[e[1]]]
    e[3] = [[r1(x) for x in q] for q in rdp(pl)[1:-1]]
print('lane points', before, '->', sum(len(e[3]) for e in edges))
used_n = {x for e in edges for x in e[:2]} | {h[0] for h in holds.values()}
nodes = [n for n in nodes if n[0] in used_n]
out = {'runways': runways, 'nodes': nodes, 'edges': edges, 'rnodes': rnodes,
       'holds': {k: h[:7] + [h[8]] for k, h in holds.items()}, 'hlink': {k: h[7] for k, h in holds.items() if h[7]}, 'fil': fil, 'hs': hs,
       'gates': gates, 'ihps': ihps, 'cat23': cat23, 'paint': paint, 'aprons': aprons_out, 'twypave': twypave, 'buildings': blds}
with open(OUT, 'w') as fo:
    fo.write('''// ═════════════════════════ Newcastle (EGNT): aerodrome layout ═════════════════════════
// Generated by tools/egnt_ground.py from the UK AIP charts AD 2-EGNT-2-1 (aerodrome) and 2-2 (parking/docking): taxiway
// centrelines (the painted ones, and the middle of the charted pavement where none is painted), holding points where the
// charts' bars cross them, stands at their published coordinates; buildings from OpenStreetMap. Positions are metres east
// and north of the ARP (55°02'17"N 001°41'23"W).
// runways: pavement ends a (07 end) and b, length, thresholds in metres from a, elevations (ft)
// nodes [id, east, north] (x: on the runway centreline, s: a stand's lead-in, c: a crossover's end), edges [a, b, taxiway,
// intermediate points]; rnodes: runway-edge points on each entry/exit; holds key: [hold node, runway-edge node, runway,
// m along it, offset, directions that can turn off there, runway end it serves, taxiway]; hlink: the way between the
// runway edge and the holding point; fil: centreline to runway-edge fillet in the runway frame; hs: holding positions
// before the runway; gates: [stand, area (T pier, N north Main Apron, G GA Apron, C Golf Apron), T-bar [e, n], lead-in node,
// heading into the stand, the painted lead-in line from the lane, 0]; ihps: [name, node] intermediate and CAT II/III holding
// points; cat23: the CAT II/III ones; paint: painted lanes off the routing graph (the GA Apron's light-aircraft rows); aprons: apron outlines; twypave: the charted taxiway pavement (outline and grass islands).
const EGNT_GROUND = ''')
    fo.write(json.dumps(out, separators=(',', ':')))
    fo.write(';\nif (typeof module !== \'undefined\') module.exports = EGNT_GROUND;\n')
json.dump({'segs': [[NODE[s[0]], NODE[s[1]], s[2], [NODE[n] for n in s[3]]] for s in segs], 'hp': [[p, n] for p, n in HP.items()], 'fil': {k: [fr(*q) for q in v] for k, v in fil.items()}}, open('/tmp/egnt_dbg.json', 'w'))
print('nodes', len(nodes), 'edges', len(edges), 'holds', len(holds), 'gates', len(gates), 'ihps', len(ihps), 'blds', len(blds))
for k, h in sorted(holds.items(), key=lambda kv: kv[1][3]): print(' ', k, h[3], h[4], h[5], h[6], h[8])
