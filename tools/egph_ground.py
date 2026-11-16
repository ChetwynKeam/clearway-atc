# Edinburgh (EGPH) aerodrome layout from OpenStreetMap + the UK AIP: the runway thresholds (AD 2.12), the stand table of the
# parking/docking chart (AD 2-EGPH-2-2) and the corrections read off that chart (tools/egph/chart_fix.py) -> src/airports/egph-ground.js
# usage: python3 tools/egph_ground.py aerodrome.json tools/egph/chart_fix.json tools/egph/stands_aip.json src/airports/egph-ground.js
# One runway, 06/24, with taxiway A along its south side from A1 (the 06 end) to D1 (the 24 end), the V and W passing
# loops at either end, and B, C and D off the runway. Runway 12/30 is not on the charts (only "disused" pavement east of
# the GA Apron): it is not modelled. Same method as tools/eggd_ground.py: the runway frame, holding points and stands.
import json, math, re, sys, collections, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ground_lanes import add_crossovers
OSM, FIX, STANDS_JSON, OUT = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
FX = json.load(open(FIX))
A = (55 + 57/60, -(3 + 22/60 + 21/3600))                          # ARP 555700N 0032221W
KX = 60*1852*math.cos(math.radians(A[0])); KY = 60*1852
def en(lat, lon): return ((lon - A[1])*KX, (lat - A[0])*KY)
def dms(s):
    m = re.match(r'^(\d{2,3})(\d{2})(\d{2}(?:\.\d+)?)([NSEW])$', s); v = int(m[1]) + int(m[2])/60 + float(m[3])/3600
    return -v if m[4] in 'SW' else v
P = lambda la, lo: en(dms(la), dms(lo))
r1 = lambda v: round(v, 1)
E = json.load(open(OSM))['elements']
NODE = {}
for e in E:
    if e['type'] == 'way' and 'geometry' in e:
        for nid, g in zip(e['nodes'], e['geometry']): NODE[nid] = en(g['lat'], g['lon'])
    if e['type'] == 'node': NODE[e['id']] = en(e['lat'], e['lon'])
ways = [e for e in E if e['type'] == 'way']
def tagged(w, *k): return w.get('tags', {}).get('aeroway') in k
# AD 2-EGPH-2-2: taxiway nodes OpenStreetMap has more than 2.5 m off the painted centreline (the stand lead-in junctions on
# taxiway G along the Southeast and Midfield aprons sit ~4.5 m south of the line, so G zigzags): onto the paint
for k, (de, dn) in FX['node_shift'].items():
    if int(k) in NODE: NODE[int(k)] = (NODE[int(k)][0] + de, NODE[int(k)][1] + dn)
# AD 2.12: the OSM runway way, the thresholds (06 inset 214 m, 24 inset 211 m: the pavement before each is mapped as a
# displaced-threshold way, joined in) and their elevations (ft)
RWYS = [
    (4147210, '06', '24', P('555641.99N', '0032313.90W'), P('555717.66N', '0032128.66W'), 110, 100),
]
runways, FR = [], {}
for wid, lo, hi, tlo, thi, elo, ehi in RWYS:
    W = next(w for w in ways if w['id'] == wid)
    p0, p1 = NODE[W['nodes'][0]], NODE[W['nodes'][-1]]
    U0 = ((thi[0]-tlo[0])/math.dist(tlo, thi), (thi[1]-tlo[1])/math.dist(tlo, thi))
    # the displaced-threshold parts of the pavement are separate OSM ways: join the collinear ones
    allp = [NODE[n] for n in W['nodes']]
    for w in ways:
        if w is W or w.get('tags', {}).get('runway') != 'displaced_threshold': continue
        off = [abs((NODE[n][0]-p0[0])*-U0[1] + (NODE[n][1]-p0[1])*U0[0]) for n in w['nodes']]
        if max(off) < 8: allp += [NODE[n] for n in w['nodes']]
    proj = lambda p: (p[0]-tlo[0])*U0[0] + (p[1]-tlo[1])*U0[1]
    a, b = min(allp, key=proj), max(allp, key=proj)
    # the pavement ends from the AIP (2,558 m; 06 threshold inset 214 m, 24 inset 211 m), on the line through the thresholds:
    # OpenStreetMap's way is 11 m short
    a = (tlo[0] - U0[0]*214, tlo[1] - U0[1]*214); b = (thi[0] + U0[0]*211, thi[1] + U0[1]*211)
    L = math.dist(a, b); U = ((b[0]-a[0])/L, (b[1]-a[1])/L); N = (-U[1], U[0])
    mo = (lambda a, U, N: lambda p: ((p[0]-a[0])*U[0] + (p[1]-a[1])*U[1], (p[0]-a[0])*N[0] + (p[1]-a[1])*N[1]))(a, U, N)
    thr = {lo: r1(max(0, mo(tlo)[0])), hi: r1(min(L, mo(thi)[0]))}
    rid = lo + hi
    print(rid, 'len', r1(L), 'thr', thr, 'thr offsets', r1(mo(tlo)[1]), r1(mo(thi)[1]))
    runways.append({'id': rid, 'lo': lo, 'hi': hi, 'a': [r1(a[0]), r1(a[1])], 'b': [r1(b[0]), r1(b[1])], 'len': r1(L), 'thr': thr, 'elev': {lo: elo, hi: ehi}})
    FR[rid] = {'a': a, 'U': U, 'N': N, 'L': L, 'mo': mo, 'thr': thr, 'lo': lo, 'hi': hi, 'way': wid}
RW_WAYS = {R['way'] for R in FR.values()}
def onC_of(R): return lambda p: abs(p[1]) < 3 and -60 < p[0] < R['L'] + 60
def onAny(p): return any(onC_of(R)(R['mo'](p)) for R in FR.values())
# ── taxi ways: OSM refs are written "A-12": the AIP says A12
def tname(r):
    if not r: return None
    r = r.strip().upper()
    m = re.match(r'^LINK (\d+)$', r)
    if m: return 'LINK' + m[1]                                      # Link 1 to Link 5 (spoken "Link 4")
    r = re.sub(r' (BLUE|ORANGE)$', '', r)                           # the dual-function lanes NA, NB and Z: blue and orange lines
    r = re.sub(r'^EXIT ', '', r)                                    # "Exit AE", "Exit BD"
    if 'APRON' in r or 'TURNING' in r: return 'APRON'                # Fairey's Apron, the Juliet and mid turning circles
    r = re.sub(r'^([A-Z]+)-?(\d+)(-\d+)?$', r'\1\2', r).replace('-', '').replace(' ', '')
    return r
taxi = [w for w in ways if tagged(w, 'taxiway', 'taxilane') and 'geometry' in w]
taxi = [w for w in taxi if w.get('tags', {}).get('access') != 'no']
# every taxiway OpenStreetMap names carries the AIP's single-letter name; its unnamed links take a neighbour's below
NAMED = {}
for w in taxi:
    if w['id'] in NAMED: w['tags'] = {**w['tags'], 'ref': NAMED[w['id']]}
HP = {}
for e in E:
    if e['type'] == 'node' and e.get('tags', {}).get('aeroway') == 'holding_position':
        HP[e['id']] = tname(e['tags'].get('ref'))
for n, r in list(HP.items()):                                      # unnamed ones take their taxiway's name
    if not r: HP[n] = next((tname(w['tags'].get('ref')) for w in taxi if n in w['nodes'] and w['tags'].get('ref') and tname(w['tags'].get('ref')) != 'APRON'), None)
# P1 and H7 (AD 2-EGPH-2-1/2-2) are not mapped in OSM: on the centreline of P and H where the chart's bar crosses it
for fid, ref, tw in ((-1, 'P1', 'P'), (-2, 'H7', 'H')):
    q = FX['holds'][ref]; W_ = next(w for w in taxi if w.get('tags', {}).get('ref') == tw); ns = W_['nodes']; best = None
    for i in range(len(ns) - 1):
        a, b = NODE[ns[i]], NODE[ns[i+1]]; ex, ey = b[0]-a[0], b[1]-a[1]; u = max(0, min(1, ((q[0]-a[0])*ex + (q[1]-a[1])*ey)/(ex*ex + ey*ey)))
        c = (a[0] + ex*u, a[1] + ey*u)
        if best is None or math.dist(c, q) < best[0]: best = (math.dist(c, q), i, c)
    NODE[fid] = best[2]; ns.insert(best[1] + 1, fid); HP[fid] = ref
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
    ref = tname(w['tags'].get('ref')); ns = w['nodes']; cur = [ns[0]]
    for n in ns[1:]:
        cur.append(n)
        if n in gnodes: segs.append([cur[0], cur[-1], ref, cur[1:-1], w['id']]); cur = [n]
adj = collections.defaultdict(list)
for s in segs: adj[s[0]].append(s); adj[s[1]].append(s)
LINE = {}                                                          # no multi-line lanes at Edinburgh
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
paths = []
cnt = collections.Counter()
drop = set()
def nearest_rwy(p):
    best = None
    for rid, R in FR.items():
        m, o = R['mo'](p)
        if -350 < m < R['L'] + 350 and abs(o) < 235 and (best is None or abs(o) < best[1]): best = (rid, abs(o))
    return best and best[0]
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
# the runway-holding positions (AD 2-EGPH-2-1): A1 at the 06 end, D1 at the 24 end, B1 and C1 between. Every other
# named bar (A3-A20 along A, B3, C3 and D3 the CAT II/III positions, V2/V3, W2/W3 ...) is an intermediate holding point
RWY_HOLDS = {'A1', 'B1', 'C1', 'D1'}
for n in HP:
    if n not in use or HP[n] not in RWY_HOLDS: continue
    rid = nearest_rwy(NODE[n])
    if rid: byrwy[rid].append(n)
for rid, R in FR.items():
    mo = R['mo']; thr = R['thr']; lo, hi = R['lo'], R['hi']; a, U, N = R['a'], R['U'], R['N']
    for h in sorted(byrwy[rid], key=lambda n: mo(NODE[n])[0]):
        ps = inward(h, R)
        if not ps or not HP[h]: continue
        ref = HP[h]
        hs[NID(h)] = rid
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
            dirs = [lo, hi] if ang > 55 else ([lo] if d > 0 else [hi])
            m0 = f[0][0]; endr = lo if m0 < 250 and hp_m < 170 else hi if m0 > R['L'] - 250 and hp_m > R['L'] - 170 else ''
            if endr: dirs = [lo, hi]
            elif hairpin(Pp): dirs = []                  # it doubles back between the runway and the hold: no way off (or on) there
            cnt[ref] += 1; key = ref if cnt[ref] == 1 else '%s~%d' % (ref, cnt[ref])
            rn = 'R%d' % len(rnodes); fe, fn = (a[0] + U[0]*f[-1][0] + N[0]*f[-1][1], a[1] + U[1]*f[-1][0] + N[1]*f[-1][1])
            rnodes.append([rn, r1(fe), r1(fn)])
            hp = mo(NODE[h])
            tws = [t[2] or 'APRON' for t in used]; tw = next((t for t in tws if t != 'APRON'), ref)
            holds[key] = [NID(h), rn, rid, r1(hp[0]), r1(hp[1]), ','.join(dirs), endr, [[r1(m), r1(o)] for m, o in rest], tw]
            fil[key] = [[r1(m), r1(o)] for m, o in f]
            paths.append((h, f[0], key, rid))
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
for h1, c1, k1, r1d in paths:
    for h2, c2, k2, r2d in paths:
        if r1d != r2d or (h1, h2) in pairs or h1 >= h2: continue
        R = FR[r1d]; mo = R['mo']
        if abs(c1[0] - c2[0]) < 15 and mo(NODE[h1])[1]*mo(NODE[h2])[1] < 0:
            pairs.add((h1, h2)); x = 'x%d' % len(XN); a, U, N = R['a'], R['U'], R['N']
            XN[x] = (a[0] + U[0]*c1[0], a[1] + U[1]*c1[0])
            for h, k in ((h1, k1), (h2, k2)):
                Rr = fil[k] + holds[k][7]
                xedges.append([x, NID(h), holds[k][8], [[r1(a[0] + U[0]*m + N[0]*o), r1(a[1] + U[1]*m + N[1]*o)] for m, o in Rr[1:]]])
print('holds', len(holds), 'crossings', len(XN))
def runway_seg(s): return id(s) in drop or any(onAny(NODE[n]) for n in [s[0], s[1]] + s[3])
edges = []
for s in segs:
    if runway_seg(s): continue
    edges.append([NID(s[0]), NID(s[1]), s[2], [[r1(x) for x in NODE[n]] for n in s[3]]] + ([LINE[s[4]]] if s[4] in LINE else []))
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
# ── IHPs: every other named holding position on the graph (one per name)
ihps = []
hnodes = {h[0] for h in holds.values()}
for n, ref in HP.items():
    if n in nid and nid[n] in big and nid[n] not in hnodes and ref:
        if ref not in [i[0] for i in ihps] and ref not in holds: ihps.append([ref, nid[n]])
# ── stands: OSM parking positions. The stop point is the end away from the taxilane; the lead-in runs back along the
# painted line to the lane it starts from.
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
    """the segment a-b crosses a taxiway segment other than on the edge it ends on"""
    def cr(o, p, q): return (p[0]-o[0])*(q[1]-o[1]) - (p[1]-o[1])*(q[0]-o[0])
    for e, i, q0, q1 in segpts:
        if e is skip: continue
        d1, d2, d3, d4 = cr(a, b, q0), cr(a, b, q1), cr(q0, q1, a), cr(q0, q1, b)
        if d1*d2 < 0 and d3*d4 < 0:
            # where it crosses: a lane met within 6 m of either end of the line is the one it starts from or runs onto
            den = (b[0]-a[0])*(q1[1]-q0[1]) - (b[1]-a[1])*(q1[0]-q0[0]); tt = ((q0[0]-a[0])*(q1[1]-q0[1]) - (q0[1]-a[1])*(q1[0]-q0[0]))/den
            Lab = math.dist(a, b)
            if 6 < tt*Lab < Lab - 6: return True
    return False
# AD 2-EGPH-2-2 gives every stand's coordinates (the stop mark): every stand stops there. Its lead-in is OpenStreetMap's
# painted line (which matches the chart's to a metre or two at most stands), ending at the chart's stop mark; where
# OpenStreetMap has no line (21 and 23, added on G in 2026; 46A and 46B by taxiway S) or one more than 4 degrees off the
# chart's (6, 15B, 20, 22, 106, 200, 201, 205), a straight lead-in from the lane along the chart's heading.
AIP_STANDS = {k: P(a, b) for k, (a, b) in json.load(open(STANDS_JSON)).items()}
AIPHD = {k: float(v) for k, v in FX['stand_hdg'].items()}
pp = {}
osm_lines = collections.defaultdict(list)
for w in ways:
    if tagged(w, 'parking_position') and w['nodes'][0] != w['nodes'][-1] and w.get('tags', {}).get('ref'):
        osm_lines[w['tags']['ref']].append([NODE[n] for n in w['nodes']])
for sid, ap in AIP_STANDS.items():
    cand = [q if math.dist(q[-1], ap) <= math.dist(q[0], ap) else q[::-1] for q in osm_lines.get(sid, [])]
    cand = [q for q in cand if math.dist(q[-1], ap) < 15]
    if sid in AIPHD or not cand: pp[sid] = ([ap], 0); continue
    q = min(cand, key=lambda q: math.dist(q[-1], ap))[:-1] + [ap]
    pp[sid] = (q, sum(math.dist(q[i], q[i+1]) for i in range(len(q) - 1)))
DRIVE = set()                                                        # every numbered stand is nose-in, push back (AD 2.20 item 2)
# the GA Apron (AD 2.9, 2.20 item 2): no numbered stands; aircraft are marshalled on, may be turned to face nose out, and
# start and taxi from there. Two parking spots east of H7, each entered off taxiway H and left forwards back onto it
# (a U-turn on the apron, as the marshaller turns them)
_h = [w for w in taxi if w.get('tags', {}).get('ref') == 'H'][0]; _h7 = NODE[-2]; _he = NODE[_h['nodes'][-1]]
_u = ((_he[0] - _h7[0])/math.dist(_h7, _he), (_he[1] - _h7[1])/math.dist(_h7, _he)); _s = (_u[1], -_u[0])   # along H, and to its south side
_at = lambda a, c: (_h7[0] + _u[0]*a + _s[0]*c, _h7[1] + _u[1]*a + _s[1]*c)
_HL = math.dist(_h7, _he)
for sid, a0, a1 in (('GA1', 12, 52), ('GA2', 58, _HL)):
    pp[sid] = ([_at(a0, 0), _at((a0 + a1)/2, 34), _at(a1, 0)], 2*math.hypot((a1 - a0)/2, 34)); DRIVE.add(sid)
# AD 2-EGPH-2-2: the aprons
def term(sid):
    if sid.startswith('GA'): return 'G'                              # the GA Apron, marshalled
    n = int(re.match(r'\d+', sid)[0])
    if n <= 14: return 'T'                                           # the Main Apron at the terminal: 1-6 off E, 7-14 off F
    if n <= 19: return 'P'                                           # the pier: 15-19
    if n <= 33: return 'S'                                           # the Southeast Apron: 20-33 off G and H
    if n in (46,): return 'B'                                        # 46A/46B by the Business Aviation Centre
    if n <= 106: return 'R'                                          # the Main Apron's west side, off E: 99-106
    if n <= 208: return 'N'                                          # the North Apron: 200-208 off P
    if n <= 212: return 'E'                                          # the East Apron: 210-212
    if n <= 317: return 'H'                                          # the Turnhouse Apron: 308-317A off H
    return 'M'                                                       # the Midfield Apron: 403-407 off G
# the stands that overlap (the parking chart's MARS-style alternatives): never both in use. The large stands (AD 2-EGPH-2-2
# "maximum stand sizes": 4A, 12, 15, 16, 18 a 777-300ER, 21 a 787-8, 23 an A340-200) and their narrowbody neighbours
VAC = {'4A': ['4', '5'], '15': ['15A', '15B'], '16': ['16A', '16B'], '21': ['20', '22'], '23': ['22', '24'],
       '310': ['310R'], '311': ['311L', '311R'], '312': ['312L'], '310R': ['311R'], '311L': ['312L'], '317': ['317A'], '100': ['99', '101']}
SPAN = {'4A': 64.8, '12': 64.8, '15': 64.8, '16': 64.8, '18': 64.8, '21': 60.1, '23': 60.3}
gates, splits = [], []
outs = {}
def along(pl, d):
    """the point d metres along a polyline, and the index of the segment it is on"""
    for i in range(len(pl) - 1):
        s_ = math.dist(pl[i], pl[i+1])
        if d <= s_ or i == len(pl) - 2:
            f = min(1, d/(s_ or 1)); return (pl[i][0] + (pl[i+1][0]-pl[i][0])*f, pl[i][1] + (pl[i+1][1]-pl[i][1])*f), i
        d -= s_
TPTS = [NODE[n] for w in ways if w.get('tags', {}).get('aeroway') == 'terminal' for n in w['nodes'] if n in NODE]
def tdist(p): return min((math.dist(p, t) for t in TPTS), default=1e9)
def bear(a, b): return math.degrees(math.atan2(b[0]-a[0], b[1]-a[1])) % 360
for sid, (q, L) in sorted(pp.items(), key=lambda kv: (int(re.search(r'\d+', kv[0])[0]) + (900 if kv[0].startswith('GA') else 0), kv[0])):
    line = None
    if len(q) > 1:
        n0, n1 = nearest_seg(q[0]), nearest_seg(q[-1])
        # (within 55 m of a lane at both ends: the west remote ramp's 70-74, 80 and 231 groups, whose left and right
        # lines end short of the far lane, stop where their centre lines do)
        if sid in DRIVE and n0[0] < 55 and n1[0] < 55 and L > 60:
            # the mapped line runs from one lane to another (the lane behind the Terminal 1-2-3 stands, the remote ramps'
            # drive-through stands): the aircraft comes in from the lane further from a terminal building and stops at the
            # line's middle vertex (halfway along it when it has none)
            if tdist(q[0]) < tdist(q[-1]): q = q[::-1]; n0, n1 = n1, n0
            if len(q) == 3: p, k = q[1], 0
            else: p, k = along(q, L/2)
            line = q[:k+1] + [p]; hit = (n0[0], n0[1], n0[2], n0[3])
            hd = bear(q[k], p) if math.dist(q[k], p) > 1 else bear(q[k], q[k+1])
            # a drive-through stand: taxi in from one lane, out (or in) from the other, no push back
            outs[sid] = ([p] + q[k+1:], (n1[0], n1[1], n1[2], n1[3])); print('drive-through stand', sid)
        else:
            if n0[0] > n1[0]: q = q[::-1]; n0, n1 = n1, n0          # q runs from the lane end to the stop point
            p = q[-1]; line = q
            hd = bear(q[-2], q[-1]) if math.dist(q[-2], q[-1]) > 2 else bear(q[0], q[-1])
            if n0[0] <= 30: hit = (n0[0], n0[1], n0[2], n0[3])      # the painted line meets its lane here
            else:
                dv = (q[0][0]-p[0], q[0][1]-p[1]); Ld = math.hypot(*dv)
                hit = ray_hit(p, (dv[0]/Ld, dv[1]/Ld)) if Ld > 5 else None
    elif sid in AIPHD:
        # the chart's stand: back from the T-bar along its heading to the first lane
        p = q[0]; hd = AIPHD[sid]; b_ = math.radians(hd + 180)
        hit = ray_hit(p, (math.sin(b_), math.cos(b_)), 200)
        if hit:
            t_, e_, i_, u_ = hit; q0, q1 = segpts_of(e_, i_); line = [(q0[0] + (q1[0]-q0[0])*u_, q0[1] + (q1[1]-q0[1])*u_), p]
    else:
        p = q[0]; hit = None; hd = None
    if not hit:
        ns = nearest_seg(p)
        if ns[0] > 220: continue
        hit = (ns[0], ns[1], ns[2], ns[3])
    t, e, i, u = hit; q0, q1 = segpts_of(e, i); lq = (q0[0] + (q1[0]-q0[0])*u, q0[1] + (q1[1]-q0[1])*u)
    if hd is None: hd = bear(lq, p)
    # the painted lead-in: the mapped line from where it meets the lane; a straight one from the lane only when short.
    # None where it would cross another lane
    paint = [lq] + (line[1:] if line else [p]) if line or math.dist(p, lq) <= 45 else None
    if paint and any(crosses(paint[j], paint[j+1], e) for j in range(len(paint) - 1)): paint = None
    splits.append((sid, hit))
    if sid in outs: splits.append((sid + '>', outs[sid][1]))
    gates.append([sid, term(sid), [r1(p[0]), r1(p[1])], hit, round(hd, 1), [[r1(x) for x in pt] for pt in paint] if paint else 0])
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
            newedges.append([prev, nn, e[2], [[r1(x) for x in m] for m in mids]] + e[4:]); prev, mids = nn, []; gnode[sid] = nn; k += 1
        if idx + 1 < len(pl) - 1: mids.append(pl[idx+1])
    newedges.append([prev, e[1], e[2], [[r1(x) for x in m] for m in mids]] + e[4:])
    for j in range(k, len(lst)): gnode[lst[j][1]] = e[1]
edges = newedges
for gt in gates:
    gt[3] = gnode[gt[0]]
    gt.append([gnode[gt[0] + '>'], [[r1(x) for x in pt] for pt in outs[gt[0]][0]]] if gt[0] in outs and (gt[0] + '>') in gnode else 0)
edges = add_crossovers(edges, nodes, gates, r1)
# AD 2-EGPH-2-2: stand 211 sits on taxiway S's axis, its lead-in line the straight continuation of S's centreline across
# the East Apron lane (the lane's own fillets from S curve away east and west either side of it)
_PN = {n[0]: (n[1], n[2]) for n in nodes}
_sj = min((n for n in _PN if n.startswith('n') and any(e[2] == 'S' and n in e[:2] for e in edges)), key=lambda n: math.dist(_PN[n], (1501, -103)))
edges.append([_sj, gnode['211'], 'S', []])
# lane stubs past the last stand (the East Apron's ends, taxiway P beyond 208, E beyond 1B, H west of 308): pruned back to
# the stand, holding point or junction before them
_keep = set(gnode.values()) | {h[0] for h in holds.values()} | {i[1] for i in ihps} | {h[1] for h in holds.values()}
while True:
    deg = collections.Counter(x for e in edges for x in e[:2])
    dead = {n for n, c in deg.items() if c == 1 and n not in _keep}
    if not dead: break
    edges = [e for e in edges if e[0] not in dead and e[1] not in dead]
_PN = {n[0]: (n[1], n[2]) for n in nodes}
for e in edges: e[3] = [q for q in e[3] if math.dist(q, _PN[e[0]]) > 0.5 and math.dist(q, _PN[e[1]]) > 0.5]   # no mid point on an end
_used = {x for e in edges for x in e[:2]} | {h[0] for h in holds.values()}
nodes = [n for n in nodes if n[0] in _used]
# ── aprons, buildings, hangars
def ring(pts): return [[r1(x) for x in p] for p in pts]
aprons_out = [ring(p) for p in aprons]
blds = []
for w in ways:
    t = w.get('tags', {})
    if 'geometry' not in w or w['nodes'][0] != w['nodes'][-1]: continue
    if t.get('aeroway') in ('terminal', 'hangar') or (t.get('building') and len(w['nodes']) > 4):
        pts = ring([NODE[n] for n in w['nodes']]); xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        area = abs(sum(pts[i][0]*pts[i-1][1] - pts[i-1][0]*pts[i][1] for i in range(len(pts))))/2
        if area < 900 or not (-4000 < xs[0] < 4000 and -4000 < ys[0] < 4000): continue
        hang = t.get('aeroway') == 'hangar' or t.get('building') == 'hangar'
        blds.append({'pts': pts, 'h': 18 if hang else 16 if t.get('aeroway') == 'terminal' else 9, **({'roof': 'hangar'} if hang else {}), **({'name': t['name']} if t.get('name') else {})})
for e in E:
    if e['type'] == 'relation' and e.get('tags', {}).get('aeroway') == 'terminal':
        for m in e.get('members', []):
            if m.get('role') == 'outer' and 'geometry' in m:
                blds.append({'pts': ring([en(g['lat'], g['lon']) for g in m['geometry']]), 'h': 18, 'name': e['tags'].get('name')})
# the Midfield Apron (403-407) and the Business Aviation Centre's apron (46A, 46B) are not mapped in OSM: the box round their stands, from the lane edge to past the stop marks
for _t in ('M', 'B'):
  mid = [g for g in gates if g[1] == _t]
  if mid:
    hd = math.radians(sum(g[4] for g in mid)/len(mid)); u = (math.sin(hd), math.cos(hd)); v = (u[1], -u[0])
    al = [g[2][0]*u[0] + g[2][1]*u[1] for g in mid]; ac = [g[2][0]*v[0] + g[2][1]*v[1] for g in mid]
    a0, a1, c0, c1 = min(al) - (105 if _t == 'M' else 60), max(al) + 15, min(ac) - 30, max(ac) + 30
    aprons_out.append([[r1(a*u[0] + c*v[0]), r1(a*u[1] + c*v[1])] for a, c in ((a0, c0), (a1, c0), (a1, c1), (a0, c1))])
out = {'runways': runways, 'nodes': nodes, 'edges': edges, 'rnodes': rnodes,
       'holds': {k: h[:7] + [h[8]] for k, h in holds.items()}, 'hlink': {k: h[7] for k, h in holds.items() if h[7]}, 'fil': fil, 'hs': hs,
       'gates': gates, 'ihps': ihps, 'aprons': aprons_out, 'buildings': blds, 'vac': VAC, 'span': SPAN}
with open(OUT, 'w') as fo:
    fo.write('''// ═════════════════════════ Edinburgh (EGPH): aerodrome layout ═════════════════════════
// Generated by tools/egph_ground.py from OpenStreetMap (taxiways, holding positions, aprons, terminals, hangars) checked
// against the UK AIP: thresholds AD 2.12, stands at the AD 2-EGPH-2-2 stand table's coordinates, holding points and
// centrelines corrected to the charts (tools/egph/chart_fix.py). Positions are metres east and north of the ARP
// (55°57'00"N 003°22'21"W).
// runways: pavement ends a (the low-numbered end) and b, length, thresholds in metres from a, elevations (ft)
// nodes [id, east, north] (x: on a runway centreline, s: a stand's lead-in, c: a crossover's end), edges [a, b, taxiway,
// intermediate points],
// rnodes: runway-edge points 40 m out on each entry/exit; holds key: [hold node, runway-edge node, runway, m along it,
// offset, directions that can turn off there, runway end it serves, taxiway]; hlink: the bend between the runway edge and
// the holding point; fil: centreline to runway-edge fillet in the runway frame; hs: holding positions before a runway;
// gates: [stand, apron (T terminal, P pier, S southeast, R west remote, N north, E east, M midfield, H Turnhouse, B business), stop point [e, n], lead-in node, heading into the stand, the painted lead-in line from the lane (0: none)]; ihps: [name, node] holding points away
// from the runways; vac: stands never in use together; span: the chart's largest wingspan for a stand (m).
const EGPH_GROUND = ''')
    fo.write(json.dumps(out, separators=(',', ':')))
    fo.write(';\nif (typeof module !== \'undefined\') module.exports = EGPH_GROUND;\n')
print('nodes', len(nodes), 'edges', len(edges), 'holds', len(holds), 'gates', len(gates), 'ihps', len(ihps), 'blds', len(blds))
for rid in FR:
    print(rid, sorted([(k, h[3], h[4], h[5], h[6]) for k, h in holds.items() if h[2] == rid], key=lambda x: x[1]))
print('names', len(collections.Counter(e[2] for e in edges)))
