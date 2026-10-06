# Gatwick (EGKK) aerodrome layout from OpenStreetMap + AIP AD 2-EGKK-2-3 stand coordinates -> src/airports/egkk-ground.js
import json, math, re, sys, collections
OSM, STANDS_TXT, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
A = (51 + 8/60 + 53/3600, -(11/60 + 25/3600))                      # ARP 510853N 0001125W
KX = 60*1852*math.cos(math.radians(A[0])); KY = 60*1852
def en(lat, lon): return ((lon - A[1])*KX, (lat - A[0])*KY)
def dms(s):
    m = re.match(r'^(\d{2,3})(\d{2})(\d{2}(?:\.\d+)?)([NSEW])$', s); v = int(m[1]) + int(m[2])/60 + float(m[3])/3600
    return -v if m[4] in 'SW' else v
r1 = lambda v: round(v, 1)
E = json.load(open(OSM))['elements']
NODE = {}                                                        # osm node id -> (e, n)
for e in E:
    if e['type'] == 'way' and 'geometry' in e:
        for nid, g in zip(e['nodes'], e['geometry']): NODE[nid] = en(g['lat'], g['lon'])
    if e['type'] == 'node': NODE[e['id']] = en(e['lat'], e['lon'])
ways = [e for e in E if e['type'] == 'way']
MAIN = next(w for w in ways if w['id'] == 2799094)               # 08R/26L
OLD = next(w for w in ways if w['id'] == 59366878)               # 08L/26R, now taxiway J
# ── runway frame: a = west pavement end, b = east end
a, b = NODE[MAIN['nodes'][0]], NODE[MAIN['nodes'][-1]]
if a[0] > b[0]: a, b = b, a
# the displaced-threshold parts of the pavement are separate OSM ways: join the collinear ones
L0 = math.dist(a, b); U0 = ((b[0]-a[0])/L0, (b[1]-a[1])/L0)
ext = []
for w in ways:
    if w is MAIN or w.get('tags', {}).get('runway') != 'displaced_threshold': continue
    off = [abs((NODE[n][0]-a[0])*-U0[1] + (NODE[n][1]-a[1])*U0[0]) for n in w['nodes']]
    if max(off) < 6: ext.append(w)
allp = [NODE[n] for w in [MAIN] + ext for n in w['nodes']]
proj = lambda p: (p[0]-a[0])*U0[0] + (p[1]-a[1])*U0[1]
a, b = min(allp, key=proj), max(allp, key=proj)
MAIN = {'id': MAIN['id'], 'nodes': [n for w in [MAIN] + ext for n in w['nodes']]}
L = math.dist(a, b); U = ((b[0]-a[0])/L, (b[1]-a[1])/L); N = (-U[1], U[0])
mo = lambda p: ((p[0]-a[0])*U[0] + (p[1]-a[1])*U[1], (p[0]-a[0])*N[0] + (p[1]-a[1])*N[1])
T08 = en(dms('510845.12N'), dms('0001224.52W')); T26 = en(dms('510902.42N'), dms('0001019.00W'))
thr = {'08R': r1(mo(T08)[0]), '26L': r1(mo(T26)[0])}
print('runway', r1(L), thr, 'thr offsets', r1(mo(T08)[1]), r1(mo(T26)[1]))
runway = {'id': '08R26L', 'lo': '08R', 'hi': '26L', 'a': [r1(a[0]), r1(a[1])], 'b': [r1(b[0]), r1(b[1])], 'len': r1(L), 'thr': thr, 'elev': {'08R': 196, '26L': 196}}
# ── taxi ways
def tagged(w, *k): return w.get('tags', {}).get('aeroway') in k
taxi = [w for w in ways if tagged(w, 'taxiway', 'taxilane') and 'geometry' in w]
taxi = [w for w in taxi if not all(NODE[n][0] < -1450 and NODE[n][1] > 300 for n in w['nodes'])]   # the fire training ground
OLDN = set(OLD['nodes'])
mainids = {2799094} | {w['id'] for w in ext}
for w in ways:                                                      # 08L/26R and its displaced-threshold ends: taxiway J
    if tagged(w, 'runway') and w['id'] not in mainids and w.get('tags', {}).get('area') != 'yes':
        taxi.append({'id': w['id'], 'nodes': w['nodes'], 'tags': {'aeroway': 'taxiway', 'ref': 'J', 'old': 1}})
OLDP = [NODE[n] for w in ways if tagged(w, 'runway') and w['id'] not in mainids and w.get('tags', {}).get('area') != 'yes' for n in w['nodes']]
MAINN = set(MAIN['nodes'])
HP = {e['id']: e.get('tags', {}).get('ref') for e in E if e['type'] == 'node' and e.get('tags', {}).get('aeroway') == 'holding_position'}
for n, r in list(HP.items()):                                       # unnamed ones (Foxtrot Romeo) take their taxiway's name
    if not r or r == '08L/26R': HP[n] = next((w['tags'].get('ref') for w in taxi if n in w['nodes'] and w['tags'].get('ref') and not w['tags'].get('old')), None)
use = collections.Counter(n for w in taxi for n in w['nodes'])
for w in ways:                                                      # runway nodes shared with taxiways are junctions
    if w is MAIN:
        for n in w['nodes']: use[n] += 1 if n in use else 0
ends = set(n for w in taxi for n in (w['nodes'][0], w['nodes'][-1]))
gnodes = set(n for n, c in use.items() if c > 1) | ends | (set(HP) & set(use))
# apron polygons (to name unnamed lanes)
def inpoly(p, poly):
    x, y = p; c = False
    for i in range(len(poly)):
        x1, y1 = poly[i]; x2, y2 = poly[i-1]
        if (y1 > y) != (y2 > y) and x < (x2-x1)*(y-y1)/(y2-y1) + x1: c = not c
    return c
aprons = [[NODE[n] for n in w['nodes']] for w in ways if tagged(w, 'apron')]
segs = []                                                           # [u, v, name, [mid points], wayid]
for w in taxi:
    ref = w['tags'].get('ref'); ns = w['nodes']; cur = [ns[0]]
    for n in ns[1:]:
        cur.append(n)
        if n in gnodes: segs.append([cur[0], cur[-1], ref, cur[1:-1], w['id']]); cur = [n]
# name the unnamed: inside an apron -> APRON; else the name shared by its neighbours, else the neighbour's
adj = collections.defaultdict(list)
for s in segs: adj[s[0]].append(s); adj[s[1]].append(s)
for it in range(6):
    for s in segs:
        if s[2]: continue
        mid = NODE[s[3][len(s[3])//2]] if s[3] else tuple((NODE[s[0]][i] + NODE[s[1]][i])/2 for i in range(2))
        if any(inpoly(mid, p) for p in aprons) and it == 0: s[2] = 'APRON'; continue
        if it == 0: continue
        na = [t[2] for t in adj[s[0]] if t is not s and t[2] and t[2] != 'APRON']; nb = [t[2] for t in adj[s[1]] if t is not s and t[2] and t[2] != 'APRON']
        common = [x for x in na if x in nb]
        if common: s[2] = common[0]
        elif it >= 2 and (na or nb):
            # a fillet joins two taxiways: it takes the name of the one it turns onto (the shorter, crossing one)
            s[2] = (nb or na)[0]
for s in segs:
    if not s[2]: s[2] = 'APRON'
    s[2] = {'S East': 'S', 'S West': 'S', '159': 'APRON', '41': 'APRON', '68': 'APRON', '10': 'APRON'}.get(s[2], s[2])
# ── the runway's entries and exits: from each holding position near 08R/26L, every way down to the centreline
nid = {}
def NID(n): return nid.setdefault(n, 'n%d' % len(nid))
onC = lambda p: abs(p[1]) < 3 and -60 < p[0] < L + 60
holds, fil, rnodes, hs = {}, {}, [], {}
paths = []                                                          # (hp node, [points mo from HP to centreline], segs used)
def inward(hp):
    res = []
    def dfs(n, pts, used, depth):
        if depth > 5 or len(res) > 6: return
        for t in adj[n]:
            if t in used: continue
            seq = (t[3] if t[0] == n else t[3][::-1]) + [t[1] if t[0] == n else t[0]]
            P = pts[:]; hit = False; bad = False
            for q in seq:
                pq = mo(NODE[q])
                if abs(pq[1]) > abs(P[-1][1]) + 2 and abs(P[-1][1]) > 6: bad = True; break
                P.append(pq)
                if onC(pq): hit = True; break
            if bad: continue
            o = seq[-1]
            if hit: res.append((P, used + [t])); continue
            if o in HP: continue
            dfs(o, P, used + [t], depth + 1)
    dfs(hp, [mo(NODE[hp])], [], 0)
    return res
main_hp = [n for n in HP if n in use and abs(mo(NODE[n])[1]) < 200 and -100 < mo(NODE[n])[0] < L + 100]
drop = set()
cnt = collections.Counter()
for h in sorted(main_hp, key=lambda n: mo(NODE[n])[0]):
    ps = inward(h)
    if not ps: continue
    ref = HP[h] if HP[h] and HP[h] != '08L/26R' else None
    if not ref: continue
    hs[NID(h)] = '08R26L'
    for P, used in ps:
        for t in used: drop.add(id(t))
        P = P[::-1]                                                   # centreline -> HP
        lim = min(40, abs(P[-1][1])*0.5)
        f = [P[0]]; rest = []
        for i in range(1, len(P)):
            if abs(P[i][1]) >= lim:
                p0, p1 = P[i-1], P[i]; k = (lim - abs(p0[1]))/(abs(p1[1]) - abs(p0[1]) or 1)
                f.append((p0[0] + (p1[0]-p0[0])*k, p0[1] + (p1[1]-p0[1])*k)); rest = P[i:-1]; break
            f.append(P[i])
        d = f[-1][0] - f[0][0]; ang = math.degrees(math.atan2(abs(f[-1][1] - f[0][1]), abs(d)))
        dirs = ['08R', '26L'] if ang > 55 else (['08R'] if d > 0 else ['26L'])
        m0 = f[0][0]; endr = '08R' if m0 < thr['08R'] + 60 else '26L' if m0 > thr['26L'] - 60 else ''
        if endr: dirs = ['08R', '26L']
        cnt[ref] += 1; key = ref if cnt[ref] == 1 else '%s~%d' % (ref, cnt[ref])
        rid = 'R%d' % len(rnodes); fe, fn = (a[0] + U[0]*f[-1][0] + N[0]*f[-1][1], a[1] + U[1]*f[-1][0] + N[1]*f[-1][1])
        rnodes.append([rid, r1(fe), r1(fn)])
        hp = mo(NODE[h])
        tws = [t[2] or 'APRON' for t in used]; tw = next((t for t in tws if t not in ('APRON',)), ref)
        holds[key] = [NID(h), rid, '08R26L', r1(hp[0]), r1(hp[1]), ','.join(dirs), endr, [[r1(m), r1(o)] for m, o in rest], tw]
        fil[key] = [[r1(m), r1(o)] for m, o in f]
        paths.append((h, f[0], key))
# crossings: holding positions either side that reach the same centreline point (Charlie and Yankee)
xedges, XN, pairs = [], {}, set()
for h1, c1, k1 in paths:
    for h2, c2, k2 in paths:
        if (h1, h2) in pairs: continue
        if h1 < h2 and abs(c1[0] - c2[0]) < 15 and mo(NODE[h1])[1]*mo(NODE[h2])[1] < 0:
            pairs.add((h1, h2)); x = 'x%d' % len(XN); XN[x] = (a[0] + U[0]*c1[0], a[1] + U[1]*c1[0])
            for h, k in ((h1, k1), (h2, k2)):
                R = fil[k] + holds[k][7]
                xedges.append([x, NID(h), 'C', [[r1(a[0] + U[0]*m + N[0]*o), r1(a[1] + U[1]*m + N[1]*o)] for m, o in R[1:]]])
print('main runway holds', sorted(holds), 'crossings', list(XN))
def runway_seg(s):
    return id(s) in drop or any(onC(mo(NODE[n])) for n in [s[0], s[1]] + s[3])
edges = []
for s in segs:
    if runway_seg(s): continue
    edges.append([NID(s[0]), NID(s[1]), s[2], [[r1(x) for x in NODE[n]] for n in s[3]]])
edges += xedges
# keep the largest connected component
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
nodes = [[k, r1(NODE[inv[k]][0]), r1(NODE[inv[k]][1])] for k in sorted({x for e in edges for x in e[:2]} | {h[0] for h in holds.values()}, key=lambda s: (s[0], int(s[1:])))]
holds = {k: h for k, h in holds.items() if h[0] in big}
hs = {k: v for k, v in hs.items() if k in big}
fil = {k: fil[k] for k in holds}
# ── IHPs: every other named holding position on the graph
ihps = []
for n, ref in HP.items():
    if n in nid and nid[n] in big and nid[n] not in [h[0] for h in holds.values()] and ref and ref != '08L/26R':
        if ref not in [i[0] for i in ihps]: ihps.append([ref, nid[n]])   # one per name (a few are mapped on both sides)
# ── stands: AIP coordinates, lead-in from the stand's axis (OSM parking position) to the nearest taxilane
txt = open(STANDS_TXT).read()
aip = {m[0]: en(dms(m[1]), dms(m[2])) for m in re.findall(r'\b(\d{1,3}[LREW]?)\s+(\d{6}\.\d{2}N)\s+(\d{7}\.\d{2}W)', txt)}
pp = {}
for w in ways:
    if tagged(w, 'parking_position') and w.get('tags', {}).get('ref'):
        r = re.sub(r'^(\d)M$', r'\1', w['tags']['ref']); pp[r] = [NODE[n] for n in w['nodes']]
segpts = []                                                        # lane polylines for projecting stand lead-ins
for e in edges:
    pl = [NODE[inv[e[0]]]] + [tuple(p) for p in e[3]] + [NODE[inv[e[1]]]]
    for i in range(len(pl) - 1): segpts.append((e, i, pl[i], pl[i+1]))
def ray_hit(p, dvec, maxd=140):
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
def term(sid):
    n = int(re.match(r'\d+', sid)[0])
    if n <= 38: return 'S'
    if 41 <= n <= 43: return 'R'                                   # the remote stands beside the North Terminal piers
    if n <= 68 or 551 <= n <= 574 or 681 <= n <= 690: return 'N'
    return 'R' if n < 200 else 'W'
gates, splits = [], []
for sid, p in sorted(aip.items(), key=lambda kv: (int(re.match(r'\d+', kv[0])[0]), kv[0])):
    if re.search(r'[LREW]$', sid) and re.sub(r'[LREW]$', '', sid) in aip: continue   # MARS left/right alternatives
    if sid.endswith(('E', 'W')): continue
    ax = None
    if sid in pp and len(pp[sid]) > 1:
        q = pp[sid]; d0, d1 = math.dist(q[0], p), math.dist(q[-1], p)
        far = q[0] if d0 > d1 else q[-1]; dv = (far[0]-p[0], far[1]-p[1]); Ld = math.hypot(*dv)
        if Ld > 5: ax = (dv[0]/Ld, dv[1]/Ld)
    hit = ray_hit(p, ax) if ax else None
    if not hit:
        ns = nearest_seg(p); q = ns[4]
        hit = (math.dist(p, q), ns[1], ns[2], ns[3])
    splits.append((sid, hit))
    gates.append([sid, term(sid), [r1(p[0]), r1(p[1])], hit])
# split edges at the stand lead-in points
byedge = collections.defaultdict(list)
for sid, (t, e, i, u) in splits: byedge[id(e)].append((i + u, sid, e))
newedges, gnode, POS = [], {}, {}
for e in edges:
    lst = sorted(byedge.get(id(e), []))
    if not lst: newedges.append(e); continue
    pl = [NODE[inv[e[0]]]] + [tuple(p) for p in e[3]] + [NODE[inv[e[1]]]]
    prev, mids, k = e[0], [], 0
    pos = 0.0
    for idx in range(len(pl) - 1):
        while k < len(lst) and lst[k][0] <= idx + 1:
            f = lst[k][0] - idx; q0, q1 = pl[idx], pl[idx+1]; q = (q0[0] + (q1[0]-q0[0])*f, q0[1] + (q1[1]-q0[1])*f)
            sid = lst[k][1]
            # stands sharing a lane point (within 4 m) share the node
            if mids == [] and prev in POS and math.dist(POS[prev], q) < 4: gnode[sid] = prev; k += 1; continue
            nn = 's' + sid
            nodes.append([nn, r1(q[0]), r1(q[1])]); POS[nn] = q
            newedges.append([prev, nn, e[2], [[r1(x) for x in m] for m in mids]]); prev, mids = nn, []; gnode[sid] = nn; k += 1
        if idx + 1 < len(pl) - 1: mids.append(pl[idx+1])
    newedges.append([prev, e[1], e[2], [[r1(x) for x in m] for m in mids]])
    for j in range(k, len(lst)): gnode[lst[j][1]] = e[1]
edges = newedges
for gt in gates: gt[3] = gnode[gt[0]]
# ── aprons, buildings, hangars
def ring(w): return [[r1(x) for x in NODE[n]] for n in w['nodes']]
aprons_out = [ring(w) for w in ways if tagged(w, 'apron')]
blds = []
for w in ways:
    t = w.get('tags', {})
    if 'geometry' not in w or w['nodes'][0] != w['nodes'][-1]: continue
    if t.get('aeroway') in ('terminal', 'hangar') or (t.get('building') and len(w['nodes']) > 4):
        pts = ring(w); xs = [p[0] for p in pts]; ys = [p[1] for p in pts]
        area = abs(sum(pts[i][0]*pts[i-1][1] - pts[i-1][0]*pts[i][1] for i in range(len(pts))))/2
        if area < 600 or not (-2600 < xs[0] < 2200 and -900 < ys[0] < 1500): continue
        blds.append({'pts': pts, 'h': 18 if t.get('aeroway') == 'hangar' or t.get('building') == 'hangar' else 14 if t.get('aeroway') == 'terminal' else 9,
                     **({'roof': 'hangar'} if t.get('aeroway') == 'hangar' or t.get('building') == 'hangar' else {}), **({'name': t['name']} if t.get('name') else {})})
for e in E:
    if e['type'] == 'relation' and e.get('tags', {}).get('aeroway') == 'terminal':
        for m in e.get('members', []):
            if m.get('role') == 'outer' and 'geometry' in m:
                blds.append({'pts': [[r1(x) for x in en(g['lat'], g['lon'])] for g in m['geometry']], 'h': 20, 'name': e['tags'].get('name')})
oldrwy = [[r1(x) for x in p] for p in sorted(OLDP, key=lambda p: p[0])]
oldrwy = [oldrwy[0], oldrwy[-1]]
out = {'runways': [runway], 'nodes': nodes, 'edges': edges, 'rnodes': rnodes,
       'holds': {k: h[:7] + [h[8]] for k, h in holds.items()}, 'hlink': {k: h[7] for k, h in holds.items() if h[7]}, 'fil': fil, 'hs': hs,
       'gates': gates, 'ihps': ihps, 'aprons': aprons_out, 'buildings': blds, 'oldRwy': oldrwy}
with open(OUT, 'w') as fo:
    fo.write('''// ═════════════════════════ London Gatwick (EGKK): aerodrome layout ═════════════════════════
// Generated from OpenStreetMap (taxiways, holding positions, parking positions, aprons, terminals, hangars) with the
// stands at their AIP AD 2-EGKK-2-3 coordinates and the 08R/26L thresholds from AD 2-EGKK-2-1. Positions are metres east
// and north of the ARP (51°08'53"N 000°11'25"W). Runway 08L/26R is no longer a runway: its centreline is part of taxiway J.
// runways: pavement ends a and b, length, thresholds in metres from a, elevations (ft)
// nodes [id, east, north], edges [a, b, taxiway, intermediate points], rnodes: runway-edge points 40 m out on each
// entry/exit; holds key: [hold node, runway-edge node, runway, m along it, offset, directions that can turn off there,
// runway end it serves]; hlink: the bend between the runway edge and the holding point; fil: centreline to runway-edge
// fillet in the runway frame; hs: holding positions before 08R/26L; gates: [stand, terminal (N, S, R remote, W west
// apron), nose [e, n], lead-in node]; ihps: [name, node] holding points away from the runway; oldRwy: 08L/26R centreline.
const EGKK_GROUND = ''')
    fo.write(json.dumps(out, separators=(',', ':')).replace('],[', '],\n[') if False else json.dumps(out, separators=(',', ':')))
    fo.write(';\nif (typeof module !== \'undefined\') module.exports = EGKK_GROUND;\n')
print('nodes', len(nodes), 'edges', len(edges), 'holds', len(holds), 'gates', len(gates), 'ihps', len(ihps), 'blds', len(blds))
print('holds', {k: (h[3], h[4], h[5], h[6]) for k, h in holds.items()})
print('names', collections.Counter(e[2] for e in edges))
