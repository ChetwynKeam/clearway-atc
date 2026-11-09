# Dublin (EIDW) aerodrome layout from OpenStreetMap + the AIP stand table -> src/airports/eidw-ground.js
# usage: python3 tools/eidw_ground.py osm.json stands.json src/airports/eidw-ground.js
# Three runways: the parallel pair 10R/28L (south, 2,637 m) and 10L/28R (north, 3,110 m, displaced thresholds both ends)
# and the crossing runway 16/34 (2,072 m), which crosses taxiway N north of the terminals and meets 10R/28L at the 28L/34
# end (hot spot HS1). Every runway gets its own frame (m from its low-numbered end, offset to the left), its holding points
# and its crossings. stands.json: AIP AD 2.24-2.2 (EIDW aircraft parking/docking chart, INS check points): every stand's
# nose position, largest wingspan and length, and how it is used, parsed by tools/eidw/stands.py.
import json, math, re, sys, os, collections
OSM, BAYS, OUT = sys.argv[1], sys.argv[2], sys.argv[3]; BAYS_PATH = BAYS
A = (53 + 25/60 + 17/3600, -(6 + 16/60 + 12/3600))                 # ARP 532517N 0061612W (aerodrome chart AD 2.24-1)
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
# ── OpenStreetMap fixes, checked against the aerodrome chart (AD 2.24-1) and the parking/docking chart (AD 2.24-2):
# taxiway N4 runs from N up to 10L/28R where 16/34 crosses it, but the stretch between its two mapped pieces is missing,
# and its runway-holding position for 10L/28R is tagged intermediate
_wid = {e['id']: e for e in E if e['type'] == 'way'}
if 5123779 in _wid and 1121017724 in _wid:
    a, b = _wid[5123779], _wid[1121017724]
    E.append({'type': 'way', 'id': -1, 'nodes': [a['nodes'][-1], b['nodes'][0]], 'geometry': [a['geometry'][-1], b['geometry'][0]], 'tags': {'aeroway': 'taxiway', 'ref': 'N4'}})
for e in E:
    if e['type'] == 'node' and e['id'] == 10253443011: e['tags']['holding_position:type'] = 'runway'
# the stop bar on N1 east of K (the parking/docking chart's red bar between N and N1) is mapped as N1's runway-holding
# position, 400 m from the runway: it is an intermediate one. N1's two holding positions are at its runway end
# (CAT I, pattern A, 103 m from the 10L/28R centreline; CAT II/III, pattern B, 138 m), positions read off AD 2.24-2.
for e in E:
    if e['type'] == 'node' and e['id'] == 10253454832: e['tags']['holding_position:type'] = 'intermediate'
_ways0 = [e for e in E if e['type'] == 'way']
def _ll(p): return (A[0] + p[1]/KY, A[1] + p[0]/KX)
_new = [-100]
def _nn(p, tags=None):
    _new[0] -= 1; i = _new[0]; NODE[i] = p; la, lo = _ll(p)
    E.append({'type': 'node', 'id': i, 'lat': la, 'lon': lo, **({'tags': tags} if tags else {})}); return i
def osm_insert(wid, p, tags=None):
    """a new node on way wid at its nearest point to p (en metres); returns the node id"""
    w = next(x for x in _ways0 if x['id'] == wid); best = None
    for i in range(len(w['nodes']) - 1):
        a, b = NODE[w['nodes'][i]], NODE[w['nodes'][i+1]]; dx, dy = b[0]-a[0], b[1]-a[1]; L2 = dx*dx + dy*dy or 1
        u = max(0.02, min(0.98, ((p[0]-a[0])*dx + (p[1]-a[1])*dy)/L2)); q = (a[0] + dx*u, a[1] + dy*u)
        if best is None or math.dist(p, q) < best[0]: best = (math.dist(p, q), i, q)
    _, i, q = best; n = _nn(q, tags); la, lo = _ll(q)
    w['nodes'].insert(i + 1, n); w['geometry'].insert(i + 1, {'lat': la, 'lon': lo}); return n
CAT23 = {35354349, 10253397851, 10253397889, 10253397816, 248047533, 10253329357, 10089110388, 6425915348}   # CAT II/III holding positions (pattern B): S6, S5, S4, S3, S2, E1, N2, S7
osm_insert(996711265, (2085.2, 1392.8), {'aeroway': 'holding_position', 'ref': 'N1', 'holding_position:type': 'runway'})
CAT23.add(osm_insert(996711265, (2081.4, 1357.9), {'aeroway': 'holding_position', 'ref': 'N1', 'holding_position:type': 'intermediate'}))
# W4 and E2 cross 16/34 between Link 6 and the West Apron hangars (hot spot HS2; open since November 2025: the OSM note
# still has it as not yet open). OpenStreetMap stops both at the runway edges and has no stop bar on E2: the crossing is
# joined over the centreline, and E2's CAT I holding position (34-16) added 94 m east of 16/34, as charted.
_w4 = next(x for x in _ways0 if x['id'] == 63233063); _e2 = next(x for x in _ways0 if x['id'] == 1210050661)
_a, _b = NODE[_w4['nodes'][0]], NODE[_e2['nodes'][0]]
_r16 = next(x for x in _ways0 if x['id'] == 4841028)
def _cl(p):   # signed offset from the 16/34 centreline
    a, b = NODE[_r16['nodes'][0]], NODE[_r16['nodes'][-1]]; L = math.dist(a, b); return ((p[0]-a[0])*-(b[1]-a[1]) + (p[1]-a[1])*(b[0]-a[0]))/L
_t = _cl(_a)/(_cl(_a) - _cl(_b)); _c = (_a[0] + (_b[0]-_a[0])*_t, _a[1] + (_b[1]-_a[1])*_t)
_cn = _nn(_c)
E.append({'type': 'way', 'id': -2, 'nodes': [_w4['nodes'][0], _cn, _e2['nodes'][0]], 'geometry': [{'lat': _ll(q)[0], 'lon': _ll(q)[1]} for q in (_a, _c, _b)], 'tags': {'aeroway': 'taxiway', 'ref': 'W4'}})
osm_insert(1210050661, (897.1, 1122.5), {'aeroway': 'holding_position', 'ref': 'E2', 'holding_position:type': 'runway'})
# K: the taxiway from N down to Link 7 and the North Apron (unnamed in OpenStreetMap, so it took N's name)
for x in _ways0:
    if x['id'] in (1102552459, 1102552460, 1102552455): x.setdefault('tags', {})['ref'] = 'K'
# Z: the South Apron taxiway from Link 1 east past Pluto to Mars, parallel to B1 (not in OpenStreetMap; traced off AD 2.24-2)
_z0 = osm_insert(63233001, (1494.3, 57.3)); _z1 = osm_insert(1435977450, (1830.0, 80.0))
_zp = [NODE[_z0]] + [(1517.8, 65.4), (1576.1, 64.5), (1692.8, 63.9), (1751.2, 66.5), (1780.6, 75.1)] + [NODE[_z1]]
_zn = [_z0] + [_nn(q) for q in _zp[1:-1]] + [_z1]
E.append({'type': 'way', 'id': -3, 'nodes': _zn, 'geometry': [{'lat': _ll(q)[0], 'lon': _ll(q)[1]} for q in _zp], 'tags': {'aeroway': 'taxiway', 'ref': 'Z'}})
# F1, from Link 2 down to Link 1 and Z east of 34 (open on the October 2026 charts; OpenStreetMap still has it as a closed
# stub): without it the only way from A to B2 is over 16/34 and back
_f1 = 13745260603
E.append({'type': 'way', 'id': -4, 'nodes': [_f1, _z0], 'geometry': [{'lat': _ll(q)[0], 'lon': _ll(q)[1]} for q in (NODE[_f1], NODE[_z0])], 'tags': {'aeroway': 'taxiway', 'ref': 'F1'}})
# runway-holding positions on a runway before the one it meets (mapped in OpenStreetMap off the taxiways): 10L/28R either
# side of 16/34, 16/34 south of 10L/28R, 10R/28L west of the 28L/34 end. Painted only.
RRH = [10253454827, 10253454828, 10253454829, 10253329346]
ways = [e for e in E if e['type'] == 'way']
def tagged(w, *k): return w.get('tags', {}).get('aeroway') in k
# thresholds: the ends of the OSM runway ways, which match the aerodrome chart's threshold coordinates to a metre or so
# (10R 532520.75N 0061724.27W, 28L 532512.94N 0061502.08W, 10L 532613.79N 0061650.22W, 28R 532606.73N 0061441.87W,
# 16 532613.16N 0061543.12W, 34 532511.66N 0061458.54W). 10L/28R's pavement runs on past both thresholds: the displaced
# parts (280 m west of 10L, 450 m east of 28R: LDA 2,829 m and 2,659 m against a TORA of 3,109 m) are separate OSM ways
# joined on below. Threshold elevations (ft) from the aerodrome chart.
def wend(wid, k):
    w = next(w for w in ways if w['id'] == wid); g = w['geometry'][k]; return en(g['lat'], g['lon'])
RWYS = [
    (4841009, '10R', '28L', wend(4841009, 0), wend(4841009, -1), 243, 202),
    (734632648, '10L', '28R', wend(734632648, 0), wend(734632648, -1), 235, 213),
    (4841028, '16', '34', wend(4841028, 0), wend(4841028, -1), 218, 202),
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
    L = math.dist(a, b); U = ((b[0]-a[0])/L, (b[1]-a[1])/L); N = (-U[1], U[0])
    # the OSM way for 07/25 stops 114 m short of the 25 end (taxiways E and G4 join beyond it): extend to the AIP length
    AIPLEN = None
    if AIPLEN and L < AIPLEN - 20: b = (a[0] + U[0]*AIPLEN, a[1] + U[1]*AIPLEN); thi = b; L = AIPLEN
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
    """the AIP's names: Link 1 to Link 7 (LINK1), F-Inner and F-Outer (FINNER, FOUTER), Apron Taxiway 1 to 6 (AT1, mapped as
    APRON TWY 1 or APRON 4), DN and DS (Delta North and South), and the lettered ones as written (N2, S7, E1)"""
    if not r: return None
    r = re.sub(r'\(.*?\)', '', r).strip().upper()
    m = re.match(r'^APRON(?: TWY| TAXIWAY)? ?(\d)$', r)
    if m: return 'AT' + m[1]
    r = re.sub(r'^([A-Z]+)-?(\d+)(-\d+)?$', r'\1\2', r).replace('-', '').replace(' ', '')
    return r
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
# ── IHPs: every other named holding position on the graph (one per name)
ihps = []
hnodes = {h[0] for h in holds.values()}
# intermediate holding positions (OSM holding_position:type=intermediate, mostly unnamed): named after their taxiway and
# numbered along it after the taxiways that already have the name (B11, B12 ... on B, whose B1-B10 are taxiways), one per stop line
_byref = collections.defaultdict(list)
TAKEN = {tname(w['tags'].get('ref') or w['tags'].get('name') or '') for w in taxi} | {re.sub(r'~\d+$', '', k) for k in holds} | {v for v in HP.values() if v}
TAKEN |= {p for t in list(TAKEN) if t for p in t.split('/')}
for n, ref in HP.items():
    if HPTYPE.get(n) == 'runway' or not ref or n not in nid or nid[n] not in big or nid[n] in hnodes: continue
    if any(math.dist(NODE[n], NODE[inv_h]) < 25 for inv_h in [k for k, v in nid.items() if v in hnodes]): continue
    _byref[re.match(r'[A-Z]+', ref)[0] if re.match(r'[A-Z]+', ref) else ref].append(n)   # by its taxiway's letter(s): on B4 or B10 it is one of the B series
for ref, ns in sorted(_byref.items()):
    ns.sort(key=lambda n: (round(-NODE[n][1]/60), NODE[n][0]))   # north to south, then west to east
    seen = set(); num = 0
    for n in ns:
        if nid[n] in seen: continue
        seen.add(nid[n]); num += 1
        while ref + str(num) in TAKEN: num += 1   # numbered on past the taxiways and holding points that already use the name (B1-B10)
        TAKEN.add(ref + str(num)); ihps.append(['%s%d' % (ref, num), nid[n]])
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
    if not tagged(w, 'parking_position') or not r or not re.match(r'^(\d{1,3}[A-Z]?|L\d)$', r): continue
    pts = [NODE[n] for n in w['nodes']]
    if len(pts) < 2: continue
    ppall[r].append((pts, sum(math.dist(pts[i], pts[i+1]) for i in range(len(pts)-1))))
for e in E:                                                        # three stands are mapped as points only
    r = e.get('tags', {}).get('ref')
    if e['type'] == 'node' and e.get('tags', {}).get('aeroway') == 'parking_position' and r and r not in ppall: ppall[r].append(([NODE[e['id']]], 0))
BAYS = json.load(open(BAYS))
def term(sid, p=None):
    """the pier or apron of a stand (aircraft parking/docking chart AD 2.24-2): Pier 1 (121-127) and the North Apron stands
    in front of it (105-114), Pier 2 (200-207) and the stands west of it (220-223), Pier 3 (311-318), Pier 4 at Terminal 2
    (400-409), the South Apron (411-418), the remote North Apron by Hangar 6 (131-145, 50-54) and the West Apron (605-621,
    and L1-L3 by the hangars, tow on and off only)"""
    n = int(re.sub(r'\D', '', sid) or 0)
    if sid.startswith('L'): return 'W'
    if 50 <= n <= 54 or 131 <= n <= 145: return 'N'
    if 105 <= n <= 127: return 'P1'
    if 200 <= n <= 223: return 'P2'
    if 300 <= n <= 318: return 'P3'
    if 400 <= n <= 409: return 'P4'
    if 411 <= n <= 418: return 'S'
    return 'W'
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
    if b in pp: continue
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
STAND_BACK = {'50C': 340, '51C': 332, '52': 337, '53': 334, '54': 334, '112C': 260, '113C': 248, '113R': 247, '114C': 214, '114L': 248,
              '131C': 204, '132C': 204, '133C': 204, '134C': 204, '135C': 204, '131R': 184, '134L': 184, '132R': 184, '132L': 184, '135L': 184, '135R': 184,
              '136L': 184, '136R': 184, '136S': 183, '138T': 221, '139L': 184, '139S': 185, '139T': 223, '139R': 184, '141S': 186, '142L': 185, '142S': 187,
              '144R': 165, '316': 182, '317': 173, '318L': 128, '318C': 147, '318R': 147}
for sid, (q, L) in sorted(pp.items(), key=lambda kv: (int(re.search(r'\d+', kv[0])[0]), kv[0])):
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
    if sid in BAYS:
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
    paint = [lq] + (line[1:] if line else [p]) if line or math.dist(p, lq) <= 110 else None
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
# ── junction fillets: OpenStreetMap has the taxiways meeting at sharp corners, where the painted centrelines (and
# the pavement) sweep round in curves. At every junction or bend, each pair of taxiway stretches that turns between 30
# and 140 degrees gets a curve from a point up to 45 m along one to a point along the other; at a plain bend the sharp
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
            if 30 <= turn <= 125: pairs.append((es[i], es[j], turn))
    for ea, eb, turn in pairs:
        la, lb = plen(away(ea, n)), plen(away(eb, n))
        r = min(FIL_R*(1 if turn < 100 else 0.7), 0.42*la, 0.42*lb)
        if r < 10: continue
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

# ── the chart's names and the runway-end entries. OpenStreetMap leaves N1 (the 28R end) unnamed, so it took N's name, and
# S1 has a stop bar before each runway it meets (28L and 34): the one before 28L is S1, the one before 34 S1 West.
# The entries at each runway end (aerodrome chart; CAT II/III holding points 28L E1, 10R S7, 28R N2, 10L N6): 10L N7 and
# N6 (10L's threshold is displaced 280 m, so both give the full take-off run), 28R N1 and N2, 10R S7, 28L E1, 34 B2
# (beside the shared 28L/34 threshold, hot spot HS1) or, from the west side without crossing 34, S1 West (240 m in), and
# 16 at N, where the taxiway crosses 430 m from the threshold.
RENAME = {'NS': 'N1', 'S1N': 'S1', 'N4S': 'N4'}
# a stop bar mapped inside the runway strip (N4's north stretch, 25 m from the 10L/28R centreline) is not a holding point
holds = {k: h for k, h in holds.items() if abs(h[4]) >= 40}; fil = {k: fil[k] for k in holds}; hs = {n: r for n, r in hs.items() if n in {h[0] for h in holds.values()}}
hside.pop('N4N', None)
def _ren(k): b, _, v = k.partition('~'); return RENAME.get(b, b) + ('~' + v if v else '')
holds = {_ren(k): h for k, h in holds.items()}; fil = {_ren(k): f for k, f in fil.items()}; leads = {_ren(k): f for k, f in leads.items()}
for k in RENAME: hside.pop(k, None)
if 'S1W' in hside: hside['S1W'] = ['S1', 'runway 34']
if 'NE' in hside: hside['NE'] = ['N', 'runway 16']   # (before N1 had its own holding position, N's two stop bars were NE and NS)
END = {'N7': '10L', 'N6': '10L', 'N2': '28R', 'N1': '28R', 'S7': '10R', 'E1': '28L', 'B2': '34', 'S1W': '34', 'NE': '16', 'N': '16'}
for k, h in holds.items():
    e = END.get(k.split('~')[0])
    if e and FR[h[2]]['lo'] in (e,) + () or (e and FR[h[2]]['hi'] == e): h[6] = e; h[5] = FR[h[2]]['lo'] + ',' + FR[h[2]]['hi']
# intermediate holding positions: Venus and Neptune on N (named on the parking/docking chart), the others numbered IHP1,
# IHP2 ... from west to east (the chart does not name them)
_pos = {n[0]: (n[1], n[2]) for n in nodes}
_named = [x for x in ihps if re.match(r'^(VENUS|NEPTUNE)', x[0])]
_rest = sorted([x for x in ihps if x not in _named], key=lambda x: (_pos.get(x[1], (0, 0))[0], -_pos.get(x[1], (0, 0))[1]))
ihps = [[re.sub(r'\d+$', '', a).title(), b] for a, b in _named] + [['IHP%d' % (i + 1), b] for i, (a, b) in enumerate(_rest)]
# CAT II/III holding positions (pattern B, the ladder) on the taxiways the CAT I ones are on; the rapid exit taxiways
# (aerodrome chart note 4: S5, N3, N5), which have no holding position marking, only the no-entry bar where they meet the
# parallel taxiway; the runway-holding positions on a runway before another (runway, m, +1/-1: which way the other runway is)
_nodeset = {n[0] for n in nodes}
cat23 = sorted({nid[n] for n in CAT23 if n in nid and nid[n] in _nodeset})
ret = sorted(k for k in holds if k.split('~')[0] in ('S5', 'N3', 'N5'))
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
print('CAT II/III', len(cat23), 'RETs', ret, 'runway-runway holds', rrh, 'stand dependencies', sum(len(v) for v in vac.values())//2)
out = {'runways': runways, 'nodes': nodes, 'edges': edges, 'rnodes': rnodes,
       'holds': {k: h[:7] + [h[8]] for k, h in holds.items()}, 'hlink': {k: h[7] for k, h in holds.items() if h[7]}, 'fil': fil, 'hs': hs,
       'gates': gates, 'ihps': ihps, 'aprons': aprons_out, 'buildings': blds, 'hside': hside, 'leads': leads,
       'cat23': cat23, 'ret': ret, 'rrh': rrh, 'vac': vac}
with open(OUT, 'w') as fo:
    fo.write('''// ═════════════════════════ Dublin (EIDW): aerodrome layout ═════════════════════════
// Generated by tools/eidw_ground.py from OpenStreetMap (runways, taxiways, holding positions, parking positions, aprons,
// terminals, hangars) with every stand's nose position, size and use from the AIP parking/docking chart (EIDW AD 2.24-2).
// Positions are metres east and north of the ARP (53°25'17"N 6°16'12"W).
// runways: pavement ends a (the low-numbered end) and b, length, thresholds in metres from a, elevations (ft)
// nodes [id, east, north] (x: on a runway centreline, s: a stand's lead-in), edges [a, b, taxiway, intermediate points],
// rnodes: runway-edge points on each entry/exit; holds key: [hold node, runway-edge node, runway, m along it, offset,
// directions that can turn off there, runway end it serves, taxiway]; hlink: the bend between the runway edge and the
// holding point; fil: centreline to runway-edge fillet in the runway frame; hs: holding positions before a runway;
// gates: [stand, pier or apron (P1-P4, N North Apron, S South Apron, W West Apron), stop point [e, n], lead-in node, heading
// into the stand, the painted lead-in line from the lane (0: none), largest wingspan (m), use (P taxi in and push out,
// S self-manoeuvring, T tow in, TT tow on and off, TS tow on and taxi off)]; ihps: [name, node] holding points away from the runways.
const EIDW_GROUND = ''')
    fo.write(json.dumps(out, separators=(',', ':')))
    fo.write(';\nif (typeof module !== \'undefined\') module.exports = EIDW_GROUND;\n')
print('nodes', len(nodes), 'edges', len(edges), 'holds', len(holds), 'gates', len(gates), 'ihps', len(ihps), 'blds', len(blds))
for rid in FR:
    print(rid, sorted([(k, h[3], h[4], h[5], h[6]) for k, h in holds.items() if h[2] == rid], key=lambda x: x[1]))
print('names', len(collections.Counter(e[2] for e in edges)))
