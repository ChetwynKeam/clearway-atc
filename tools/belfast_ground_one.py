# Bristol (EGGD) aerodrome layout from OpenStreetMap + the AIP aerodrome chart (AD 2-EGGD-2-1) thresholds and the
# parking/docking chart (2-2) stand coordinates -> src/airports/eggd-ground.js
# usage: python3 tools/eggd_ground.py osm.json AD2-EGGD-2-1-508518.txt (the parking chart text) src/airports/eggd-ground.js
# One runway, 09/27, with taxiway Z (and G to the west) along the north side by the aprons; D/H and B/J cross it to the
# southern parking area. Same method as tools/eggd_ground.py: the runway frame, holding points, crossings and stands.
import json, math, re, sys, collections, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ground_lanes import add_crossovers
AF, OSM, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
CFG = {
 'EGAA': dict(arp=(54 + 39/60 + 27/3600, -(6 + 12/60 + 57/3600)),                      # ARP 543927N 0061257W
   rwys=[(19619156, '07', '25', ('543908.12N', '0061406.87W'), ('543945.96N', '0061146.24W'), 206, 268),
         (19619153, '17', '35', ('543928.52N', '0061343.04W'), ('543833.19N', '0061311.96W'), 206, 258)],
   named={}, term=lambda sid: 'M', pfx=''),
 'EGAC': dict(arp=(54 + 37/60 + 5/3600, -(5 + 52/60 + 21/3600)),                       # ARP 543705N 0055221W
   rwys=[(383394276, '04', '22', ('543643.34N', '0055247.14W'), ('543729.48N', '0055151.95W'), 13, 12)],
   named={596794119: 'A', 383586401: 'A'}, term=lambda sid: 'C', pfx='C'),
}[AF]
A = CFG['arp']
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
# AD 2-EGGD-2-1: the OSM runway way, the thresholds and their elevations (ft). The pavement east of the 27 threshold
# is mapped as a displaced-threshold way (joined in).
RWYS = [(w, lo, hi, P(*t0), P(*t1), e0, e1) for w, lo, hi, t0, t1, e0, e1 in CFG["rwys"]]
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
    L = math.dist(a, b); U = ((b[0]-a[0])/L, (b[1]-a[1])/L); N = (-U[1], U[0])
    mo = (lambda a, U, N: lambda p: ((p[0]-a[0])*U[0] + (p[1]-a[1])*U[1], (p[0]-a[0])*N[0] + (p[1]-a[1])*N[1]))(a, U, N)
    thr = {lo: r1(max(0, mo(tlo)[0])), hi: r1(min(L, mo(thi)[0]))}
    if abs(mo(tlo)[1]) > 30: thr[lo] = 0
    if abs(mo(thi)[1]) > 30: thr[hi] = r1(L)
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
taxi = [w for w in taxi if w.get('tags', {}).get('access') != 'no' and 'DISUSED' not in (w.get('tags', {}).get('ref') or '').upper()]
for w in taxi:
    if AF == 'EGAC' and re.match(r'^\d', w.get('tags', {}).get('ref') or ''): w['tags'] = {**w['tags'], 'ref': 'Apron lane'}
# AD 2-EGGD-2-1: the loop from taxiway G round to the 09 end is G (holding point GX); the way south from the runway at
# Bravo to the southern parking area is J (holding point JX)
NAMED = CFG['named']
for w in taxi:
    if w['id'] in NAMED: w['tags'] = {**w['tags'], 'ref': NAMED[w['id']]}
HP = {}
for e in E:
    if e['type'] == 'node' and e.get('tags', {}).get('aeroway') == 'holding_position':
        HP[e['id']] = tname(e['tags'].get('ref'))
for n, r in list(HP.items()):                                      # unnamed ones take their taxiway's name
    if not r: HP[n] = next((tname(w['tags'].get('ref')) for w in taxi if n in w['nodes'] and w['tags'].get('ref') and tname(w['tags'].get('ref')) != 'APRON'), None)
# OSM here has taxiways that end a few metres short of the one they meet: snap an end to the nearest node of another way
SNAP = 9
allp = [(n, NODE[n], w['id']) for w in taxi for n in w['nodes']]
for w in taxi:
    for idx in (0, -1):
        n0 = w['nodes'][idx]; best = None
        for n, p_, wid in allp:
            if wid == w['id'] or n == n0: continue
            d = math.dist(p_, NODE[n0])
            if d < SNAP and (best is None or d < best[0]): best = (d, n)
        if best: w['nodes'][idx] = best[1]
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
LINE = {}                                                          # no multi-line lanes at Bristol
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
def NID(n): return nid.setdefault(n, CFG['pfx'] + 'n%d' % len(nid))
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
for n in HP:
    if n not in use: continue
    rid = nearest_rwy(NODE[n])
    if rid: byrwy[rid].append(n)
for rid, R in FR.items():
    mo = R['mo']; thr = R['thr']; lo, hi = R['lo'], R['hi']; a, U, N = R['a'], R['U'], R['N']
    for h in sorted(byrwy[rid], key=lambda n: mo(NODE[n])[0]):
        if not HP[h] or not re.match(r'^[A-Z]\d?$', HP[h]): continue
        ps = inward(h, R)
        if not ps:                                               # OSM has no connector from the hold to the runway: a straight one
            hm = mo(NODE[h])
            if abs(hm[1]) > 230 or abs(hm[1]) < 12: continue
            ps = [([hm, (hm[0], 0.0)], [])]
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
            rn = CFG['pfx'] + 'R%d' % len(rnodes); fe, fn = (a[0] + U[0]*f[-1][0] + N[0]*f[-1][1], a[1] + U[1]*f[-1][0] + N[1]*f[-1][1])
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
XTOL = 130
for h1, c1, k1, r1d in paths:
    for h2, c2, k2, r2d in paths:
        if r1d != r2d or (h1, h2) in pairs or h1 >= h2: continue
        R = FR[r1d]; mo = R['mo']
        if abs(c1[0] - c2[0]) < XTOL and mo(NODE[h1])[1]*mo(NODE[h2])[1] < 0:
            pairs.add((h1, h2)); x = CFG['pfx'] + 'x%d' % len(XN); a, U, N = R['a'], R['U'], R['N']
            xm = (c1[0] + c2[0])/2; XN[x] = (a[0] + U[0]*xm, a[1] + U[1]*xm)
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
nodes = [[k, r1(NODE[inv[k]][0]), r1(NODE[inv[k]][1])] for k in sorted({x for e in edges for x in e[:2]} | {h[0] for h in holds.values()}, key=lambda s: (re.sub(r'\d+$', '', s), int((re.search(r'\d+$', s) or ['0'])[0])))]
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
# AD 2-EGGD-2-2 gives coordinates for most stands, and they are where the nose stops (the T-bar): every stand with
# coordinates stops there. OSM's stand lines agree with them on the Main Apron's 1-3 and the far west 38-40, but on the
# West Apron they show the layout before it was re-marked (lines 25-30 m east of the chart's, the W3/W4 lane mapped
# ~15 m east) and on 17-20 and 22-25 they end 11-14 m away. So a stand with coordinates is drawn as the chart has it: a
# straight lead-in from its lane to the T-bar, along the stand's heading. The heading is the chart's (AIP_HDG) on the
# West Apron, otherwise that of the mapped line through the T-bar. Drive-through lines with two stop marks (28, 31, 33:
# W and E) take the E mark, entered from the west. The stands the AIP has still "to be surveyed" (5-12, 14-16, the East
# Apron) keep their OSM lines, which match the chart there. The MARS alternatives (26L/26R, 28W, 31W, 33W, E1-E3,
# W1-W8) are left out: each is drawn as its main stand.
AIP_ALL = {}
# a stand with its own line in OpenStreetMap is placed by that line (the street map under the chart shows the same paint);
# the AIP coordinate only for one OpenStreetMap does not have
_osm_refs = {w.get('tags', {}).get('ref') for w in ways if tagged(w, 'parking_position') and w['nodes'][0] != w['nodes'][-1]}
AIP_ALL = {k: v for k, v in AIP_ALL.items() if re.sub(r'[EW]$', '', k) not in _osm_refs or k in ('34', '40')}
AIP_STANDS = {k: v for k, v in AIP_ALL.items() if re.match(r'^\d{1,2}$', k)}
for k in ('28', '31', '33'):
    if k + 'E' in AIP_ALL: AIP_STANDS[k] = AIP_ALL[k + 'E']
# true headings into the stand from the chart (AD 2-EGGD-2-2, West Apron): 28-31 and 33 east off the lanes (along
# taxiway Z's line, 087°), 32 west off the W3/W4 lane, 34-36 west-north-west off W1, 37 north-west from Z; and 17 and
# 18 (East Apron, not mapped) north off Z like 19 and 20
AIP_HDG = {}
lines = []
# a stand's painted line takes the number of the stand box it lies in: OpenStreetMap has some lines one number out from
# their boxes (37-39 drawn in the boxes of 38-40, 35 and 36 swapped), and the box is what the map shows the number on
def _inpoly(p, poly):
    x, y = p; c = False
    for i in range(len(poly)):
        x1, y1 = poly[i]; x2, y2 = poly[i-1]
        if (y1 > y) != (y2 > y) and x < (x2-x1)*(y-y1)/(y2-y1) + x1: c = not c
    return c
_boxes = [(w['tags'].get('ref'), [NODE[n] for n in w['nodes']]) for w in ways if tagged(w, 'parking_position') and w['nodes'][0] == w['nodes'][-1] and w.get('tags', {}).get('ref')]
for w in ways:
    if not tagged(w, 'parking_position') or w['nodes'][0] == w['nodes'][-1]: continue
    pts = [NODE[n] for n in w['nodes']]
    if len(pts) < 2: continue
    r = w.get('tags', {}).get('ref'); inb = [b for b, bp in _boxes if _inpoly(pts[-1], bp) or _inpoly(pts[0], bp)]
    if r and re.match(r'^\d{1,2}$', r) and len(inb) == 1 and re.match(r'^\d{1,2}$', inb[0]) and inb[0] != r: print('stand line', r, 'is in box', inb[0]); r = inb[0]
    lines.append((r, pts))
def seg_near(p):
    """the mapped stand line segment nearest p: (distance, a, b)"""
    best = None
    for r, q in lines:
        for i in range(len(q) - 1):
            a, b = q[i], q[i+1]; ex, ey = b[0]-a[0], b[1]-a[1]; LL = ex*ex + ey*ey or 1
            u = max(0, min(1, ((p[0]-a[0])*ex + (p[1]-a[1])*ey)/LL)); d = math.dist(p, (a[0] + ex*u, a[1] + ey*u))
            if best is None or d < best[0]: best = (d, a, b)
    return best
pp, used, AIPHD = {}, set(), {}
for sid, ap in AIP_STANDS.items():
    if sid in AIP_HDG: AIPHD[sid] = AIP_HDG[sid]
    else:
        d, a, b = seg_near(ap)
        if d < 15:   # the mapped line's direction, pointing at whichever of its ends is nearer the T-bar
            if math.dist(a, ap) < math.dist(b, ap): a, b = b, a
            AIPHD[sid] = math.degrees(math.atan2(b[0]-a[0], b[1]-a[1])) % 360
    # OpenStreetMap has the stand as a point, or only its box: there, not the chart's coordinate
    osm_pt = next((NODE[e['id']] for e in E if e['type'] == 'node' and e.get('tags', {}).get('aeroway') == 'parking_position' and e['tags'].get('ref') == sid), None)
    box = next(([NODE[n] for n in w['nodes'][:-1]] for w in ways if tagged(w, 'parking_position') and w.get('tags', {}).get('ref') == sid and w['nodes'][0] == w['nodes'][-1]), None)
    if osm_pt: ap = osm_pt
    elif box: ap = (sum(p[0] for p in box)/len(box), sum(p[1] for p in box)/len(box))
    pp[sid] = ([ap], 0)
    for k, (r, q) in enumerate(lines):
        if (r in (None, sid)) and min(math.dist(ap, q[0]), math.dist(ap, q[-1])) < 20: used.add(k)
for k, (r, q) in enumerate(lines):
    if k in used or not r or not re.match(r'^\d{1,2}$', r) or r in pp: continue
    pp[r] = (q, sum(math.dist(q[i], q[i+1]) for i in range(len(q)-1)))
# stands OSM maps only as a box or a point: the box centre
for w in ways:
    t = w.get('tags', {})
    if tagged(w, 'parking_position') and w['nodes'][0] == w['nodes'][-1] and re.match(r'^\d{1,2}[A-Z]?$', t.get('ref') or '') and t['ref'] not in pp:
        bx = [NODE[n] for n in w['nodes'][:-1]]; pp[t['ref']] = ([(sum(p_[0] for p_ in bx)/len(bx), sum(p_[1] for p_ in bx)/len(bx))], 0)
for e in E:
    if e['type'] == 'node' and e.get('tags', {}).get('aeroway') == 'parking_position' and re.match(r'^\d{1,2}[A-Z]?$', e['tags'].get('ref') or '') and e['tags']['ref'] not in pp:
        pp[e['tags']['ref']] = ([NODE[e['id']]], 0)
# AD 2-EGGD-2-2: the Main Apron in front of the terminal (1-6, 21-26), the East Apron (7-20, E1-E3) and the West Apron
# (28-40, W1-W8)
def term(sid): return CFG["term"](sid)
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
for sid, (q, L) in sorted(pp.items(), key=lambda kv: (int(re.search(r'\d+', kv[0])[0]), kv[0])):
    line = None
    if len(q) > 1:
        n0, n1 = nearest_seg(q[0]), nearest_seg(q[-1])
        # (within 55 m of a lane at both ends: the west remote ramp's 70-74, 80 and 231 groups, whose left and right
        # lines end short of the far lane, stop where their centre lines do)
        if n0[0] < 55 and n1[0] < 55 and L > 60:
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
            nn = CFG['pfx'] + 's' + sid
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
out = {'runways': runways, 'nodes': nodes, 'edges': edges, 'rnodes': rnodes,
       'holds': {k: h[:7] + [h[8]] for k, h in holds.items()}, 'hlink': {k: h[7] for k, h in holds.items() if h[7]}, 'fil': fil, 'hs': hs,
       'gates': gates, 'ihps': ihps, 'aprons': aprons_out, 'buildings': blds}
json.dump(out, open(OUT, 'w'), separators=(',', ':'))
print('nodes', len(nodes), 'edges', len(edges), 'holds', len(holds), 'gates', len(gates), 'ihps', len(ihps), 'blds', len(blds))
for rid in FR:
    print(rid, sorted([(k, h[3], h[4], h[5], h[6]) for k, h in holds.items() if h[2] == rid], key=lambda x: x[1]))
print('names', len(collections.Counter(e[2] for e in edges)))
