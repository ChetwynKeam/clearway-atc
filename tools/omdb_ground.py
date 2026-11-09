# Dubai International (OMDB) aerodrome layout from OpenStreetMap + the UAE AIP -> src/airports/omdb-ground.js
# usage: python3 tools/omdb_ground.py osm.json tools/omdb/stands.json src/airports/omdb-ground.js
# Two parallel runways 384 m apart, staggered by 1.6 km: 12L/30R (north, 4,351 m, thresholds displaced 450 m at 12L and
# 300 m at 30R) and 12R/30L (south, 4,447 m, displaced 715 m at 12R and 132 m at 30L). Taxiway N runs north of the north
# runway, M between the two, K south of the south runway, with Z, J and U round Concourses A, B, C and D and P along
# Terminal 2. Every runway gets its own frame (m from its low-numbered end, offset to the left), its holding points and its
# crossings. stands.json: the stand tables of the aircraft parking/docking charts (AD 2-22A, 2-22B, 2-22C: every stand's
# nose position and elevation), each stand's code (C, D, E or F) read off the charts' colour key (tools/omdb/README.md).
# ihps_chart.json: every named intermediate holding position of the stop bar chart (AD 2-26), the stop bar's position
# read off the chart (georeferenced to the runway ends, about 5 m).
import json, math, re, sys, os, collections
OSM, BAYS, OUT = sys.argv[1], sys.argv[2], sys.argv[3]; BAYS_PATH = BAYS
A = (25 + 15/60 + 10/3600, 55 + 21/60 + 52/3600)                    # ARP 251510N 0552152E (AD 2.2)
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
_ways0 = [e for e in E if e['type'] == 'way']
def _ll(p): return (A[0] + p[1]/KY, A[1] + p[0]/KX)
_new = [-100]
def _nn(p, tags=None):
    _new[0] -= 1; i = _new[0]; NODE[i] = p; la, lo = _ll(p)
    E.append({'type': 'node', 'id': i, 'lat': la, 'lon': lo, **({'tags': tags} if tags else {})}); return i
# ── OpenStreetMap fixes, each checked against the aerodrome chart (AD 2-21) and the stop bar chart (AD 2-26):
# taxiway V (and V1-V5) beside 12R/30L is the helicopter taxiway (AD 2.22.13.8; V5 is closed): not for aeroplanes.
# K east of K18 is closed (AD 2.8). Apron Sierra has no live aircraft movements: its lanes and stands are left out.
_drop = set()
for w in _ways0:
    r = (w.get('tags', {}).get('ref') or '').upper()
    if w.get('tags', {}).get('aeroway') in ('taxiway', 'taxilane') and re.fullmatch(r'V\d?', r): _drop.add(w['id'])
# K east of K18 (the stretch on round to V5 and Apron H, the Dubai Air Wing apron) is closed: every taxiway south of
# 12R/30L beyond K18 goes, and the Air Wing stands H1-H4 are not airline stands
_a, _b = P('251522.30N', '0552129.92E'), P('251407.06N', '0552345.61E'); _L = math.dist(_a, _b); _U = ((_b[0]-_a[0])/_L, (_b[1]-_a[1])/_L)
_mS = lambda q: ((q[0]-_a[0])*_U[0] + (q[1]-_a[1])*_U[1], (q[0]-_a[0])*-_U[1] + (q[1]-_a[1])*_U[0])
for w in _ways0:
    if w.get('tags', {}).get('aeroway') in ('taxiway', 'taxilane') and all(_mS(NODE[n])[0] > 4625 and _mS(NODE[n])[1] < -80 for n in w['nodes']): _drop.add(w['id'])
E = [e for e in E if not (e['type'] == 'way' and e['id'] in _drop)]
_ways0 = [e for e in E if e['type'] == 'way']
# runway holding positions on taxiways OpenStreetMap leaves unnamed: M7B (opposite K4, at the 12R threshold) and M21
# (opposite K18, at the 30L end), as on the aerodrome chart
for e in E:
    if e['type'] == 'node' and e['id'] in (12441935750, 2116814636): e.setdefault('tags', {})['ref'] = {12441935750: 'M7B', 2116814636: 'M21'}[e['id']]
CAT23 = set()
RRH = []
ways = [e for e in E if e['type'] == 'way']
def tagged(w, *k): return w.get('tags', {}).get('aeroway') in k
# runways (AD 2.12): the pavement ends ("RWY end") and the thresholds as published; the OSM runway ways match them to a
# metre. Threshold elevations (ft): 12R 10.9, 30L 59.8, 12L 11.7, 30R 32.6.
RWYS = [
    ('12R', '30L', P('251522.30N', '0552129.92E'), P('251407.06N', '0552345.61E'), P('251510.21N', '0552151.75E'), P('251409.31N', '0552341.57E'), 11, 60),
    ('12L', '30R', P('251600.28N', '0552047.76E'), P('251446.67N', '0552300.51E'), P('251552.66N', '0552101.52E'), P('251451.75N', '0552251.35E'), 12, 33),
]
runways, FR = [], {}
for lo, hi, a, b, tlo, thi, elo, ehi in RWYS:
    L = math.dist(a, b); U = ((b[0]-a[0])/L, (b[1]-a[1])/L); N = (-U[1], U[0])
    mo = (lambda a, U, N: lambda p: ((p[0]-a[0])*U[0] + (p[1]-a[1])*U[1], (p[0]-a[0])*N[0] + (p[1]-a[1])*N[1]))(a, U, N)
    thr = {lo: r1(mo(tlo)[0]), hi: r1(mo(thi)[0])}
    rid = lo + hi
    print(rid, 'len', r1(L), 'thr', thr, 'thr offsets', r1(mo(tlo)[1]), r1(mo(thi)[1]))
    runways.append({'id': rid, 'lo': lo, 'hi': hi, 'a': [r1(a[0]), r1(a[1])], 'b': [r1(b[0]), r1(b[1])], 'len': r1(L), 'thr': thr, 'elev': {lo: elo, hi: ehi}})
    FR[rid] = {'a': a, 'U': U, 'N': N, 'L': L, 'mo': mo, 'thr': thr, 'lo': lo, 'hi': hi, 'way': None}
RW_WAYS = {R['way'] for R in FR.values()}
def onC_of(R): return lambda p: abs(p[1]) < 3 and -60 < p[0] < R['L'] + 60
def onAny(p): return any(onC_of(R)(R['mo'](p)) for R in FR.values())
# ── taxi ways: OSM refs are written "A-12": the AIP says A12
def tname(r):
    """the AIP's names, as written (M13A, K15A, J1); OpenStreetMap's K21 is the chart's K12"""
    if not r: return None
    r = re.sub(r'\(.*?\)', '', r).strip().upper().replace('-', '').replace(' ', '')
    return {'K21': 'K12'}.get(r, r)
taxi = [w for w in ways if tagged(w, 'taxiway', 'taxilane') and 'geometry' in w]
taxi = [w for w in taxi if w.get('tags', {}).get('access') != 'no']
HP = {}; HPTYPE = {}
for e in E:
    if e['type'] == 'node' and e.get('tags', {}).get('aeroway') == 'holding_position':
        HP[e['id']] = tname(e['tags'].get('ref')); HPTYPE[e['id']] = e['tags'].get('holding_position:type', 'runway')
for n, r in list(HP.items()):                                      # unnamed ones take their taxiway's name
    if not r:   # its taxiway's ref, or a name that is a taxiway designator (OSM has G1 as name=G1)
        tref = lambda w: w['tags'].get('ref') or (w['tags'].get('name') if re.fullmatch(r'[A-Z]{1,2}\d{0,2}', w['tags'].get('name') or '') else None)
        HP[n] = next((tname(tref(w)) for w in taxi if n in w['nodes'] and tref(w) and tname(tref(w)) != 'APRON'), None)
print('runway holding positions with no name', [n for n, r in HP.items() if not r and HPTYPE.get(n) == 'runway'])
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
# OpenStreetMap runs some links on under a neighbour's name: the M5B way on up to 12L (its north half is M5A), the M6
# way on across 12L (its north half is N5), J on north to Z (that stretch is J3: J3A and J3B are on it), and M7B, opposite
# K4, unnamed (it took K4's name). Each stretch takes the chart's name by where it lies.
def _segmid(sg):
    pts = [NODE[sg[0]]] + [NODE[n] for n in sg[3]] + [NODE[sg[1]]]; return pts[len(pts)//2] if len(pts) > 2 else tuple((pts[0][i] + pts[1][i])/2 for i in (0, 1))
def _pd(p, a, b):
    dx, dy = b[0]-a[0], b[1]-a[1]; L2 = dx*dx + dy*dy; u = max(0, min(1, ((p[0]-a[0])*dx + (p[1]-a[1])*dy)/L2)); return math.dist(p, (a[0]+dx*u, a[1]+dy*u))
_FN, _FS = FR['12L30R']['mo'], FR['12R30L']['mo']
for sg in segs:
    q = _segmid(sg); on, os_ = _FN(q)[1], _FS(q)[1]
    if sg[2] == 'M5B' and abs(on) < abs(os_): sg[2] = 'M5A'
    elif sg[2] == 'M6' and on > 3: sg[2] = 'N5'
    elif sg[2] == 'J' and _pd(q, (1165, -1395), (1305, -1165)) < 30: sg[2] = 'J3'
    elif sg[4] == 1059547920: sg[2] = 'M7B'
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
            lim = min(32, abs(Pp[-1][1])*0.5)   # where the lead lines leave the taxiway: about 10 m out from the runway edge
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
        if abs(c1[0] - c2[0]) < 15 and mo(NODE[h1])[1]*mo(NODE[h2])[1] < 0 and abs(mo(NODE[h1])[0] - mo(NODE[h2])[0]) < 160 and 120 < c1[0] < R['L'] - 120:   # not over a runway end's threshold   # facing each other across the runway, not diagonally
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
# ── IHPs: the stop bar chart (AD 2-26) names every intermediate holding position (KB, MA, NC, ZF, J1A ...). Each chart
# stop bar is matched to the nearest OpenStreetMap holding position on a taxiway (intermediate or ILS type) within 40 m;
# a chart stop bar OpenStreetMap does not have is put on the taxiway centreline nearest the bar, where it crosses it.
# OpenStreetMap stop lines the chart does not name are not holding points (left as taxiway); the ILS-type ones on a
# runway link (the CAT II/III stop bars behind a runway holding point) are drawn as pattern B.
from scipy.optimize import linear_sum_assignment
CH = json.load(open(os.path.join(os.path.dirname(BAYS_PATH), 'ihps_chart.json')))
hnodes = {h[0] for h in holds.values()}
_pos = {k: NODE[inv[k]] for k in {x for e in edges for x in e[:2]} | hnodes}
cand = sorted({nid[n] for n, t in HPTYPE.items() if t != 'runway' and n in nid and nid[n] in _pos and nid[n] not in hnodes})
bars = [(nm, tuple(b['p'])) for nm, v in CH.items() for b in v['bars']] + [(nm, tuple(v['label'][0])) for nm, v in CH.items() if not v['bars']]
Cm = [[(math.dist(bp, _pos[c]) if math.dist(bp, _pos[c]) < (40 if i < sum(len(v['bars']) for v in CH.values()) else 70) else 1e6) for c in cand] for i, (nm, bp) in enumerate(bars)]
ri, ci = linear_sum_assignment(Cm) if cand else ([], [])
ihps, named, used_bar = [], {}, set()
for i, j in zip(ri, ci):
    if Cm[i][j] >= 1e5: continue
    nm = bars[i][0]; used_bar.add(i)
    if nm in named and named[nm] == cand[j]: continue
    named.setdefault(nm, cand[j]); ihps.append([nm, cand[j], r1(Cm[i][j])])
# chart stop bars with no OpenStreetMap stop line: a new node where the bar crosses the nearest taxiway centreline
_ins = [0]
def _split_at(p, maxd=30):
    best = None
    for k, e in enumerate(edges):
        pl = [_pos[e[0]]] + [tuple(q) for q in e[3]] + [_pos[e[1]]]
        for s_ in range(len(pl) - 1):
            a_, b_ = pl[s_], pl[s_+1]; dx, dy = b_[0]-a_[0], b_[1]-a_[1]; LL = dx*dx + dy*dy or 1
            u = max(0, min(1, ((p[0]-a_[0])*dx + (p[1]-a_[1])*dy)/LL)); q = (a_[0] + dx*u, a_[1] + dy*u)
            if best is None or math.dist(p, q) < best[0]: best = (math.dist(p, q), k, s_, q)
    if not best or best[0] > maxd: return None
    d, k, s_, q = best; e = edges[k]; pl = [_pos[e[0]]] + [tuple(x) for x in e[3]] + [_pos[e[1]]]
    for end in (e[0], e[1]):
        if math.dist(_pos[end], q) < 6: return end
    _ins[0] += 1; nn = 'i%d' % _ins[0]; _pos[nn] = q; NODE[nn] = q; inv[nn] = nn
    edges[k:k+1] = [[e[0], nn, e[2], [list(x) for x in pl[1:s_+1]]], [nn, e[1], e[2], [list(x) for x in pl[s_+1:-1]]]]
    return nn
added = []
for i, (nm, bp) in enumerate(bars):
    if i in used_bar or nm in named or not CH[nm]['bars']: continue
    n = _split_at(bp)
    if n: named[nm] = n; ihps.append([nm, n, -1]); added.append(nm)
print('IHPs named', len(ihps), 'added off the chart', added, 'chart names not placed', sorted(set(CH) - set(named)))
ihps = [[a, b] for a, b, _ in ihps]
nodes = [[k, r1(_pos[k][0]), r1(_pos[k][1])] for k in sorted({x for e in edges for x in e[:2]} | {h[0] for h in holds.values()}, key=lambda s: (s[0], int(s[1:])))]
# the CAT II/III stop bars (OpenStreetMap ILS type, pattern B) the chart does not name: on the runway links behind the
# runway holding points
CAT23 = {n for n, t in HPTYPE.items() if t == 'ILS' and n in nid and nid[n] not in set(named.values())}
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
ppall = collections.defaultdict(list)                              # ref -> [(pts, length)] of every mapped way
for w in ways:
    r = (w.get('tags', {}).get('ref') or '').strip().rstrip('.')
    if not tagged(w, 'parking_position') or not r or not re.match(r'^[A-HQS]\d{1,2}[LR]?$', r): continue
    pts = [NODE[n] for n in w['nodes']]
    if len(pts) < 2: continue
    ppall[r].append((pts, sum(math.dist(pts[i], pts[i+1]) for i in range(len(pts)-1))))
for e in E:                                                        # three stands are mapped as points only
    r = e.get('tags', {}).get('ref')
    if e['type'] == 'node' and e.get('tags', {}).get('aeroway') == 'parking_position' and r and r not in ppall: ppall[r].append(([NODE[e['id']]], 0))
BAYS = json.load(open(BAYS))
BAYS = {k: v for k, v in BAYS.items() if k[0] != 'H'}
for _sid, _b in BAYS.items(): _b['cond'] = 'TOW ON, TOW OFF' if _sid[0] == 'S' else 'TAXI IN, PUSH OUT'
def term(sid, p=None):
    """the apron of a stand, its letter (AD 2-22A to 2-22C): A and D round Concourse A, B and F round Concourses B and C,
    C at Concourse D and the west, E, G and Q the remote aprons north of the runways (Q the Emirates hangar stands), H the
    cargo stands at the 30L end, S Sierra (no live aircraft movements: tow on and off only)"""
    return sid[0]
pp = {}
for r, ws in ppall.items():
    best = max(ws, key=lambda x: x[1])
    if r in BAYS or not BAYS: pp[r] = best
    else:
        # an OSM ref the AIP does not list (the old numbering at Pier 1 and the West Apron): only the AIP's stands are used
        c = best[0][len(best[0])//2]
        print('OSM stand not in the AIP, dropped', r)
# AIP stands with no parking position of their own in OpenStreetMap: a stand at the AIP coordinate (the nose position)
for b, v in BAYS.items():
    if b in pp or v.get('lat') is None: continue
    p = en(v['lat'], v['lon'])
    pp[b] = ([p], 0); print('stand from the AIP only', b)
gates, splits = [], []
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
# headings of the mapped stand lines (lane end to stop point), for the AIP stands OpenStreetMap does not have
MAPPED_HD = []
for sid_, (q_, L_) in pp.items():
    if len(q_) < 2 or L_ < 15: continue
    a_, b_ = nearest_seg(q_[0]), nearest_seg(q_[-1]); qq = q_ if a_[0] <= b_[0] else q_[::-1]
    if math.dist(qq[-2], qq[-1]) > 2: MAPPED_HD.append((qq[-1], bear(qq[-2], qq[-1])))
BLD_PTS = [NODE[n] for w in ways if w.get('tags', {}).get('aeroway') == 'terminal' or w.get('tags', {}).get('building') in ('terminal', 'pier', 'yes', 'transportation') and w.get('tags', {}).get('aeroway') != 'hangar' for n in w['nodes'] if n in NODE]
def guess_hd(p):
    near = sorted(MAPPED_HD, key=lambda t: math.dist(t[0], p))
    if near and math.dist(near[0][0], p) < 90: return near[0][1]
    b = min(BLD_PTS, key=lambda q: math.dist(p, q), default=None)
    if b and math.dist(b, p) < 70: return bear(p, b)
    return near[0][1] if near and math.dist(near[0][0], p) < 250 else None
# the stands OpenStreetMap does not map (or maps off the painted line): the bearing from the AIP nose position back along
# the painted lead-in line to the lane it leaves, measured off the parking/docking chart (AD 2.24-2, georeferenced to
# the taxiway centrelines to about 4 m). The C stands on Apron Taxiway 6 lead in diagonally, as painted.
STAND_BACK = {}
for sid, (q, L) in sorted(pp.items(), key=lambda kv: (kv[0][0], int(re.search(r'\d+', kv[0])[0]), kv[0])):
    if sid in STAND_BACK and sid in BAYS:
        p = en(BAYS[sid]['lat'], BAYS[sid]['lon']); bb = math.radians(STAND_BACK[sid])
        hit = ray_hit(p, (math.sin(bb), math.cos(bb)), 240)
        if hit:
            t, e, i, u = hit; q0, q1 = segpts_of(e, i); lq = (q0[0] + (q1[0]-q0[0])*u, q0[1] + (q1[1]-q0[1])*u)
            splits.append((sid, hit)); B = BAYS[sid]
            gates.append([sid, term(sid, p), [r1(p[0]), r1(p[1])], hit, round((STAND_BACK[sid] + 180) % 360, 1), [[r1(x) for x in lq], [r1(p[0]), r1(p[1])]], B.get('span', ''), {'TAXI IN, PUSH OUT': 'P', 'TOW IN, PUSH OUT': 'T', 'SELF MANOEUVRING': 'S', 'TOW ON, TOW OFF': 'TT', 'TOW ON, TAXI OFF': 'TS'}.get(B.get('cond'), 'P')])
            continue
        print('stand %s: no lane along the charted lead-in' % sid)
    line = None
    if len(q) > 1:
        n0, n1 = nearest_seg(q[0]), nearest_seg(q[-1])
        if n0[0] < 8 and n1[0] < 8 and L > 60:
            # the mapped line runs from one lane to another (the lane behind the Terminal 1-2-3 stands, the remote ramps'
            # drive-through stands): the aircraft comes in from the lane further from a terminal building and stops at the
            # line's middle vertex (halfway along it when it has none)
            if tdist(q[0]) < tdist(q[-1]): q = q[::-1]; n0, n1 = n1, n0
            if len(q) == 3: p, k = q[1], 0
            else: p, k = along(q, L/2)
            line = q[:k+1] + [p]; hit = (n0[0], n0[1], n0[2], n0[3])
            hd = bear(q[k], p) if math.dist(q[k], p) > 1 else bear(q[k], q[k+1])
        else:
            if n0[0] > n1[0]: q = q[::-1]; n0, n1 = n1, n0          # q runs from the lane end to the stop point
            p = q[-1]; line = q
            hd = bear(q[-2], q[-1]) if math.dist(q[-2], q[-1]) > 2 else bear(q[0], q[-1])
            if n0[0] <= 30: hit = (n0[0], n0[1], n0[2], n0[3])      # the painted line meets its lane here
            else:
                dv = (q[0][0]-p[0], q[0][1]-p[1]); Ld = math.hypot(*dv)
                hit = ray_hit(p, (dv[0]/Ld, dv[1]/Ld)) if Ld > 5 else None
    else:
        p = q[0]; hit = None; hd = guess_hd(p)
        if hd is not None:
            h3 = ray_hit(p, (-math.sin(math.radians(hd)), -math.cos(math.radians(hd))), 160)
            if h3: hit = h3
    if not hit:
        ns = nearest_seg(p)
        if ns[0] > 220: continue
        hit = (ns[0], ns[1], ns[2], ns[3])
    t, e, i, u = hit; q0, q1 = segpts_of(e, i); lq = (q0[0] + (q1[0]-q0[0])*u, q0[1] + (q1[1]-q0[1])*u)
    # the AIP's nose position is where the aircraft stops: the mapped line is kept for the lead-in, ending there
    if sid in BAYS and BAYS[sid].get('lat') is not None:
        pa = en(BAYS[sid]['lat'], BAYS[sid]['lon']); dd = math.dist(p, pa)
        if dd > 12: print('stand %s: OSM stop %.0f m from the AIP nose position' % (sid, dd))
        if line and dd < 45: line = line[:-1] + [pa]
        elif line: line = None; hd = None
        p = pa
    if hd is None: hd = bear(lq, p)
    # the painted line may run on through the lane in front of the stand to one further away: the lead-in starts at the
    # first lane met going back from the stop point along the stand's heading
    rb = (-math.sin(math.radians(hd)), -math.cos(math.radians(hd))); h2 = ray_hit(p, rb, 200)
    if h2 and h2[0] < math.dist(p, lq) - 12:
        t, e, i, u = h2; q0, q1 = segpts_of(e, i); lq = (q0[0] + (q1[0]-q0[0])*u, q0[1] + (q1[1]-q0[1])*u); hit = (t, e, i, u); line = None
    # the painted lead-in: the mapped line from where it meets the lane; a straight one from the lane only when short.
    # None where it would cross another lane
    paint = [lq] + (line[1:] if line else [p]) if line or math.dist(p, lq) <= 170 else None   # Dubai's widebody lead-ins run 130-150 m
    if paint and any(crosses(paint[j], paint[j+1], e) for j in range(len(paint) - 1)): paint = None
    splits.append((sid, hit))
    B = BAYS.get(sid, {}); gates.append([sid, term(sid, p), [r1(p[0]), r1(p[1])], hit, round(hd, 1), [[r1(x) for x in pt] for pt in paint] if paint else 0, B.get('span', ''), {'TAXI IN, PUSH OUT': 'P', 'TOW IN, PUSH OUT': 'T', 'SELF MANOEUVRING': 'S', 'TOW ON, TOW OFF': 'TT', 'TOW ON, TAXI OFF': 'TS'}.get(B.get('cond'), 'P')])
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
        blds.append({'pts': pts, 'h': 18 if hang else 16 if t.get('aeroway') == 'terminal' else 9, **({'roof': 'hangar'} if hang else {}), **({'name': t.get('name:en') or t['name']} if t.get('name') else {})})
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
# ── junction fillets: OpenStreetMap has the taxiways meeting at sharp corners, where the painted centrelines (and
# the pavement) sweep round in curves. At every junction or bend, each pair of taxiway stretches that turns between 30
# and 150 degrees gets a curve from a point up to 45 m along one to a point along the other; at a plain bend the sharp
# corner goes. Holding points, stands, runway and crossing points keep their corners.
FIL_R = 45
pos = {n[0]: (n[1], n[2]) for n in nodes}
keepN = {h[0] for h in holds.values()} | set(hs) | set(gnode.values()) | {b for a, b in ihps} | {n for n in pos if n[0] in 'Rxs'}
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
def is_curve(e):
    """a way that turns more than 25 degrees between its two ends: a mapped junction curve"""
    pl = epl(e)
    if len(pl) < 3 or plen(pl) < 15: return False
    h = lambda a, b: math.atan2(b[0]-a[0], b[1]-a[1])
    q0 = (cut_at(pl, min(10, plen(pl)*0.3)) or (pl[1],))[0]; q1 = (cut_at(pl[::-1], min(10, plen(pl)*0.3)) or (pl[-2],))[0]
    return abs((math.degrees(h(pl[0], q0) - h(q1, pl[-1])) + 180) % 360 - 180) > 25
def arm_nodes(n, e, reach=140):
    """the nodes along a stretch leaving n, up to `reach` metres out through plain bends (and the first junction)"""
    # (straight on through a junction too: where several ways cross within a few metres, the arm runs on through them)
    def hd(x, a):
        pl = away(x, a); q = (cut_at(pl, min(12, plen(pl)*0.5)) or (pl[1],))[0]; return math.atan2(q[0]-pl[0][0], q[1]-pl[0][1])
    out, prev, cur, L = [], n, e, 0
    while True:
        nx = cur[1] if cur[0] == prev else cur[0]; L += plen(epl(cur))
        if L > reach: break
        out.append(nx)
        nxt = [x for x in inc[nx] if x is not cur]
        if not nxt: break
        if len(nxt) > 1:
            pl = away(cur, nx); q = (cut_at(pl, min(12, plen(pl)*0.5)) or (pl[1],))[0]; hin = math.atan2(pl[0][0]-q[0], pl[0][1]-q[1])
            st = min(nxt, key=lambda x: abs((math.degrees(hd(x, nx) - hin) + 180) % 360 - 180))
            if abs((math.degrees(hd(st, nx) - hin) + 180) % 360 - 180) > 30: break
            nxt = [st]
        prev, cur = nx, nxt[0]
    return out
def mapped_curve(n, ea, eb):
    A, B = set(arm_nodes(n, ea)), set(arm_nodes(n, eb))
    if not A or not B: return False
    if A & B: return True          # the two arms meet again: one of them is the mapped curve
    for a in A:
        for x in inc[a]:
            if x is ea or x is eb: continue
            o = x[1] if x[0] == a else x[0]
            if o in B and o != n and a != n: return True
    return False
fid = [0]; newn = []; fillets = []; cut = {}   # cut[(id(edge), node)] = distance from that node to its new point
for n, es in inc.items():
    if n in keepN or len(es) < 2: continue
    es = [e for e in es if e[2] != 'APRON']   # apron lanes keep their own mapped paint
    # Dubai's junctions are mapped with their curves (each turn its own way, sweeping off the straight a few tens of
    # metres out): a node where a mapped curve starts gets no curve of its own, nor does one a few metres from another
    # junction (the ways crossing there are one junction, its curves mapped)
    if any(is_curve(e) for e in es) or any(m != n and len(inc[m]) >= 3 and math.dist(pos[m], pos[n]) < 28 for m in pos if abs(pos[m][0] - pos[n][0]) < 28): continue
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
        # OpenStreetMap often maps the junction's curves itself (a short way from one arm to the other, 40-120 m out):
        # where it has, the arms already turn into each other there, and a second curve at the crossing point would
        # draw the junction as a tangle of lines and let aircraft cut across it
        if mapped_curve(n, ea, eb): continue
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
    def curve(dd):   # the painted fillet for a turn onto the centreline heading dd (None: a turn of more than 135 degrees)
        if dd*(-tv[0]) < -0.7 or t > 4*oe: return None
        C = (X[0] - dd*t, 0.0)
        return [[r1((1-u)**2*C[0] + 2*(1-u)*u*X[0] + u*u*E[0]), r1((1-u)**2*C[1] + 2*(1-u)*u*X[1] + u*u*E[1])] for u in [j/16 for j in range(17)]]
    if h[6]:
        # at a runway end the only turn is onto the runway, away from the end: lining up there, or a landing that has
        # rolled to the end turning off (the same curve), never a line out over the end
        dEnd = -1 if h[6] == FR[h[2]]['lo'] else 1
        c = curve(dEnd)
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

# ── the runway-end entries (AD 2.13 and 2.22.12/14): the full-length points and those ATC counts as the same departure
# point for wake purposes. 12L: N1, N1A, N1B and M1, M1A, M1B (CAT II/III: N1A and M1A); 12R: K1 and M4 (and K2, M5B);
# 30R: N10 and M14A (the primary entry for the stagger), N11, M15, N12 and M15A; 30L: K17 and M20 (K18 and M21 taxi
# forward to the K17/M20 position before the take-off run, so they are the same point here).
# OpenStreetMap's names checked against the chart: the M taxiway stop bars it names after a neighbour (M5B's ref runs on
# to the M5A stop bar south of 12L, M6's to N5 north of it, K12 is mapped as K21), the second M12B stop bar (a duplicate
# 13 m behind the first) and the R stop bar, which is M16's (the RET carries straight on into R)
RENAME = {'M5BN': 'M5B', 'M5BS': 'M5A', 'M6N': 'N5', 'M6S': 'M6', 'M12BN1': 'M12B', 'K21': 'K12'}
DROP = {'M12BN2', 'R'}
holds = {k: h for k, h in holds.items() if k.split('~')[0] not in DROP}
def _ren(k): b, _, v = k.partition('~'); return RENAME.get(b, b) + ('~' + v if v else '')
holds = {_ren(k): h for k, h in holds.items()}; fil = {_ren(k): f for k, f in fil.items() if _ren(k) in {_ren(x) for x in holds} and k.split('~')[0] not in DROP}
leads = {_ren(k): f for k, f in leads.items() if k.split('~')[0] not in DROP}
for k in list(RENAME) + list(DROP): hside.pop(k, None)
holds = {k: h for k, h in holds.items() if abs(h[4]) >= 40}; fil = {k: fil[k] for k in holds}; hs = {n: r for n, r in hs.items() if n in {h[0] for h in holds.values()}}
END = {'N1': '12L', 'N1A': '12L', 'N1B': '12L', 'M1': '12L', 'M1A': '12L', 'M1B': '12L', 'K1': '12R', 'M4': '12R', 'K2': '12R', 'M5B': '12R',
       'N10': '30R', 'M14A': '30R', 'N11': '30R', 'M15': '30R', 'N12': '30R', 'M15A': '30R', 'K17': '30L', 'M20': '30L', 'K18': '30L', 'M21': '30L'}
for k, h in holds.items():
    e = END.get(k.split('~')[0])
    if e and (FR[h[2]]['lo'] == e or FR[h[2]]['hi'] == e): h[6] = e; h[5] = FR[h[2]]['lo'] + ',' + FR[h[2]]['hi']
# CAT II/III holding positions (pattern B, the ladder) on the taxiways the CAT I ones are on; the rapid exit taxiways
# (aerodrome chart note 4: S5, N3, N5), which have no holding position marking, only the no-entry bar where they meet the
# parallel taxiway; the runway-holding positions on a runway before another (runway, m, +1/-1: which way the other runway is)
_nodeset = {n[0] for n in nodes}
cat23 = sorted({nid[n] for n in CAT23 if n in nid and nid[n] in _nodeset})
# the rapid exit taxiways (AD 2.20.5.1's exit table): ways off a runway, never on (AD 2.13 note 4: no intersection departures)
RETS = {'N3', 'N3A', 'N5', 'N5A', 'N6', 'N8', 'M3', 'M3A', 'M6', 'M7A', 'M8', 'M9', 'M11', 'M12A', 'M12B', 'M16', 'M18', 'K6', 'K8', 'K9', 'K13', 'K15'}
ret = sorted(k for k in holds if k.split('~')[0] in RETS)
def _xm(R, R2):
    a, U = R['a'], R['U']; c, V = R2['a'], R2['U']; den = U[0]*V[1] - U[1]*V[0]
    return ((c[0]-a[0])*V[1] - (c[1]-a[1])*V[0])/den
rrh = []
for n in RRH:
    p = NODE[n]
    for rid, R in FR.items():
        m, o = R['mo'](p)
        if abs(o) < 6 and -50 < m < R['L'] + 50:
            xm = min((_xm(R, R2) for r2, R2 in FR.items() if r2 != rid), key=lambda v: abs(v - m)); rrh.append([rid, r1(m), 1 if xm > m else -1])
# the AIP's stand dependencies (stand table remarks: "STANDS 107L, 107R VACANT", "STAND 200T VACANT AT ENTRY/EXIT"):
# a stand is not used while one it names is occupied (and the other way round)
vac = collections.defaultdict(set); _ids = {g[0] for g in gates}
for sid, B in BAYS.items():
    for grp in re.findall(r'STANDS? ([0-9A-Z ,&]+?) VACANT', (B.get('rem') or '').upper()):
        for o in re.split(r'\s*(?:,|&|AND)\s*', grp.strip()):
            if o in _ids and sid in _ids and o != sid: vac[sid].add(o); vac[o].add(sid)
vac = {k: sorted(v) for k, v in sorted(vac.items())}
_chart = {'K1','K2','K3','K4','K5','K6','K7','K8','K9','K10','K11','K12','K13','K14','K15','K15A','K16','K17','K18','M1','M1A','M1B','M1C','M2','M3','M3A','M4','M5A','M5B','M6','M7A','M7B','M8','M9','M10A','M10B','M11','M12A','M12B','M13','M13A','M13B','M14A','M14B','M15','M15A','M15B','M16','M17','M18','M18A','M19','M20','M21','N1','N1A','N1B','N1C','N2','N3','N3A','N4','N5','N5A','N6','N7','N8','N8A','N9','N10','N11','N12'}
_have = {k.split('~')[0] for k in holds}
print('runway holding points: missing from the chart', sorted(_chart - _have), 'not on the chart', sorted(_have - _chart))
print('CAT II/III', len(cat23), 'RETs', ret, 'runway-runway holds', rrh, 'stand dependencies', sum(len(v) for v in vac.values())//2)
out = {'runways': runways, 'nodes': nodes, 'edges': edges, 'rnodes': rnodes,
       'holds': {k: h[:7] + [h[8]] for k, h in holds.items()}, 'hlink': {k: h[7] for k, h in holds.items() if h[7]}, 'fil': fil, 'hs': hs,
       'gates': gates, 'ihps': ihps, 'aprons': aprons_out, 'buildings': blds, 'hside': hside, 'leads': leads,
       'cat23': cat23, 'ret': ret, 'rrh': rrh, 'vac': vac}
with open(OUT, 'w') as fo:
    fo.write('''// ═════════════════════════ Dubai International (OMDB): aerodrome layout ═════════════════════════
// Generated by tools/omdb_ground.py from OpenStreetMap (runways, taxiways, holding positions, parking positions, aprons,
// terminals, hangars) with every stand's nose position and code from the AIP parking/docking charts (OMDB AD 2-22A to 2-22C) and every
// intermediate holding position named as on the stop bar chart (AD 2-26).
// Positions are metres east and north of the ARP (25°15'10"N 55°21'52"E).
// runways: pavement ends a (the low-numbered end) and b, length, thresholds in metres from a, elevations (ft)
// nodes [id, east, north] (x: on a runway centreline, s: a stand's lead-in), edges [a, b, taxiway, intermediate points],
// rnodes: runway-edge points on each entry/exit; holds key: [hold node, runway-edge node, runway, m along it, offset,
// directions that can turn off there, runway end it serves, taxiway]; hlink: the bend between the runway edge and the
// holding point; fil: centreline to runway-edge fillet in the runway frame; hs: holding positions before a runway;
// gates: [stand, apron (its letter), stop point [e, n], lead-in node, heading
// into the stand, the painted lead-in line from the lane (0: none), largest wingspan (m), use (P taxi in and push out,
// S self-manoeuvring, T tow in, TT tow on and off, TS tow on and taxi off)]; ihps: [name, node] holding points away from the runways.
const OMDB_GROUND = ''')
    fo.write(json.dumps(out, separators=(',', ':')))
    fo.write(';\nif (typeof module !== \'undefined\') module.exports = OMDB_GROUND;\n')
print('nodes', len(nodes), 'edges', len(edges), 'holds', len(holds), 'gates', len(gates), 'ihps', len(ihps), 'blds', len(blds))
for rid in FR:
    print(rid, sorted([(k, h[3], h[4], h[5], h[6]) for k, h in holds.items() if h[2] == rid], key=lambda x: x[1]))
print('names', len(collections.Counter(e[2] for e in edges)))
