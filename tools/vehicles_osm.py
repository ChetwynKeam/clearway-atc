# Airside road network and ground-vehicle places for one airport, from OpenStreetMap (vehicles-data branch,
# .github/workflows/vehicles-fetch.yml) -> src/airports/<icao>-veh.js
#   python3 tools/vehicles_osm.py LXGB vehicles-data/LXGB.json src/airports/lxgb-veh.js
# Airside roads: service roads and tracks inside the aerodrome boundary that join an apron without passing a security
# gate (barrier node), no tunnels, nothing across a runway. Places: fire stations, hangars, the fuel farm, catering
# units, the terminal faces and the jet bridges (their terminal end and their aircraft end). Coordinates are metres
# east/north of the airport origin used by the simulator (AIRPORT_ORIGIN in core.js).
import json, math, sys, collections
ICAO, SRC, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
ORIGIN = {'LXGB': (36.1512, -5.3494), 'LPMA': (32.6942, -16.7781), 'EGLC': (51.5053, 0.0553), 'LOWI': (47.2602, 11.3439),
          'KJFK': (40.639925, -73.778939), 'EGKK': (51 + 8/60 + 53/3600, -(11/60 + 25/3600)), 'LEMD': (40 + 28/60 + 20/3600, -(3 + 33/60 + 39/3600)),
          'EGCC': (53 + 21/60 + 13/3600, -(2 + 16/60 + 30/3600))}
LAT0, LON0 = ORIGIN[ICAO]
KX, KY = 60*1852*math.cos(math.radians(LAT0)), 60*1852
en = lambda g: ((g['lon'] - LON0)*KX, (g['lat'] - LAT0)*KY)
E = [e for f in SRC.split(',') for e in json.load(open(f))['elements']]   # several downloads: joined
T = lambda e: e.get('tags', {})
ways = [e for e in E if e['type'] == 'way' and 'geometry' in e]
NODE = {}
for w in ways:
    for nid, g in zip(w['nodes'], w['geometry']): NODE[nid] = en(g)
for e in E:
    if e['type'] == 'node': NODE[e['id']] = en(e)

def area(r): return abs(sum(r[i][0]*r[i-1][1] - r[i-1][0]*r[i][1] for i in range(len(r))))/2
def inside(p, r):
    c = False; j = len(r) - 1
    for i in range(len(r)):
        (xi, yi), (xj, yj) = r[i], r[j]
        if (yi > p[1]) != (yj > p[1]) and p[0] < (xj - xi)*(p[1] - yi)/(yj - yi) + xi: c = not c
        j = i
    return c
def rings(e):
    """closed rings of a way or a multipolygon relation (outer members joined end to end)"""
    if e['type'] == 'way': return [[en(g) for g in e['geometry']]] if len(e['geometry']) > 3 else []
    segs = [[en(g) for g in m['geometry']] for m in e.get('members', []) if m.get('role') == 'outer' and m.get('geometry')]
    out = []
    while segs:
        r = segs.pop(0)
        while math.dist(r[0], r[-1]) > 1:
            for k, s in enumerate(segs):
                if math.dist(r[-1], s[0]) < 1: r += s[1:]; break
                if math.dist(r[-1], s[-1]) < 1: r += s[::-1][1:]; break
            else: break
            segs.pop(k)
        if len(r) > 3: out.append(r)
    return out
def centroid(r): return (sum(p[0] for p in r)/len(r), sum(p[1] for p in r)/len(r))
def segd(p, a, b):
    dx, dy = b[0]-a[0], b[1]-a[1]; L = dx*dx + dy*dy
    t = 0 if L == 0 else max(0, min(1, ((p[0]-a[0])*dx + (p[1]-a[1])*dy)/L))
    return math.dist(p, (a[0] + t*dx, a[1] + t*dy))
def near_line(p, line, d): return any(segd(p, line[i], line[i+1]) < d for i in range(len(line)-1))
def cross(a, b, c, d):
    o = lambda p, q, r: (q[0]-p[0])*(r[1]-p[1]) - (q[1]-p[1])*(r[0]-p[0])
    return o(a, b, c)*o(a, b, d) < 0 and o(c, d, a)*o(c, d, b) < 0

rels = [e for e in E if e['type'] == 'relation']
# the aerodrome boundary: the biggest aeroway=aerodrome polygon
AD = max((r for e in ways + rels if T(e).get('aeroway') == 'aerodrome' for r in rings(e)), key=area)
inAD = lambda p: inside(p, AD)
APRONS = [r for e in ways + rels if T(e).get('aeroway') == 'apron' for r in rings(e)]
TWYS = [[en(g) for g in w['geometry']] for w in ways if T(w).get('aeroway') in ('taxiway', 'taxilane')]
# runways: a strip 45 m either side of each centreline (or the runway's own polygon)
RWYS = []
for w in ways:
    if T(w).get('aeroway') != 'runway': continue
    pts = [en(g) for g in w['geometry']]
    if math.dist(pts[0], pts[-1]) < 1 and len(pts) > 4:   # drawn as an area: its long axis
        best = max(((a, b) for a in pts for b in pts), key=lambda ab: math.dist(*ab)); pts = list(best)
    RWYS.append(pts)
def on_runway(a, b):
    for R in RWYS:
        for i in range(len(R)-1):
            p, q = R[i], R[i+1]; L = math.dist(p, q)
            if L < 100: continue
            ux, uy = (q[0]-p[0])/L, (q[1]-p[1])/L; nx, ny = -uy, ux
            corner = lambda m, o: (p[0] + ux*m + nx*o, p[1] + uy*m + ny*o)
            box = [corner(-30, -45), corner(L + 30, -45), corner(L + 30, 45), corner(-30, 45)]
            if inside(a, box) or inside(b, box) or any(cross(a, b, box[k], box[(k+1) % 4]) for k in range(4)): return True
    return False

# a security gate: a gate or barrier on a road where it passes through the airport fence (a gate across a road
# inside the airfield, away from any fence, doesn't separate airside from landside)
FENCES = [[en(g) for g in w['geometry']] for w in ways if T(w).get('barrier') in ('fence', 'wall')]
FENCE_GRID = collections.defaultdict(list)
for f in FENCES:
    for q in f: FENCE_GRID[(int(q[0]//100), int(q[1]//100))].append(f)
def on_fence(p):
    near = {id(f): f for i in (-1, 0, 1) for j in (-1, 0, 1) for f in FENCE_GRID[(int(p[0]//100) + i, int(p[1]//100) + j)]}
    return any(near_line(p, f, 15) for f in near.values())
BARRIER = {e['id'] for e in E if e['type'] == 'node' and T(e).get('barrier') in ('gate', 'lift_gate', 'swing_gate', 'sliding_gate', 'security_gate', 'border_control', 'chain', 'bollard', 'kissing_gate')
           and (T(e).get('barrier') in ('security_gate', 'border_control') or not FENCES or on_fence(NODE[e['id']]))}
OK_HW = {'service', 'track', 'unclassified'}
roads = []
for w in ways:
    t = T(w); hw = t.get('highway')
    if hw not in OK_HW or t.get('area') == 'yes': continue
    if t.get('tunnel') in ('yes', 'building_passage') or t.get('covered') == 'yes' or int(t.get('layer', '0') or 0) < 0: continue
    if t.get('service') in ('parking_aisle', 'drive-through'): continue
    if t.get('access') in ('customers', 'destination', 'permissive', 'yes', 'public'): continue
    pts = [NODE[n] for n in w['nodes']]
    if sum(inAD(p) for p in pts) < len(pts)*0.6: continue
    roads.append(w)
# junction graph over OSM node ids
adj = collections.defaultdict(set)
for w in roads:
    ns = w['nodes']
    for a, b in zip(ns, ns[1:]):
        if a == b or on_runway(NODE[a], NODE[b]): continue
        adj[a].add(b); adj[b].add(a)
def airside_seed(n):
    p = NODE[n]
    return any(inside(p, r) for r in APRONS) or any(near_line(p, t, 30) for t in TWYS)
seen = set(); q = collections.deque(n for n in adj if n not in BARRIER and airside_seed(n))
seen.update(q)
while q:
    u = q.popleft()
    for v in adj[u]:
        if v in seen or v in BARRIER or not inAD(NODE[v]): continue
        seen.add(v); q.append(v)
keep = {n: {v for v in adj[n] if v in seen} for n in seen}
# drop tiny islands (under 150 m of road)
comp, cid = {}, 0
for n in keep:
    if n in comp: continue
    st = [n]; comp[n] = cid
    while st:
        u = st.pop()
        for v in keep[u]:
            if v not in comp: comp[v] = cid; st.append(v)
    cid += 1
clen = collections.Counter()
for u in keep:
    for v in keep[u]: clen[comp[u]] += math.dist(NODE[u], NODE[v])/2
keep = {n: s for n, s in keep.items() if clen[comp[n]] >= 150}
# simplify: chains through degree-2 nodes, Douglas-Peucker at 1.5 m
def dp(pts, eps=1.5):
    if len(pts) < 3: return pts
    a, b = pts[0], pts[-1]; i, dm = 0, 0
    for k in range(1, len(pts)-1):
        d = segd(pts[k], a, b)
        if d > dm: i, dm = k, d
    return dp(pts[:i+1], eps)[:-1] + dp(pts[i:], eps) if dm > eps else [a, b]
junc = {n for n, s in keep.items() if len(s) != 2}
idx, nodes, edges, done = {}, [], [], set()
def nid(p):
    k = (round(p[0], 1), round(p[1], 1))
    if k not in idx: idx[k] = len(nodes); nodes.append([round(p[0]), round(p[1])])
    return idx[k]
def walk(a, b):
    chain = [a, b]
    while chain[-1] not in junc and chain[-1] != a:
        nx = [v for v in keep[chain[-1]] if v != chain[-2]]
        if not nx: break
        chain.append(nx[0])
    return chain
starts = list(junc) or list(keep)[:1]
for a in starts:
    for b in keep[a]:
        if (a, b) in done: continue
        ch = walk(a, b)
        for u, v in zip(ch, ch[1:]): done.add((u, v)); done.add((v, u))
        pts = dp([NODE[n] for n in ch])
        ids = [nid(p) for p in pts]
        for u, v in zip(ids, ids[1:]):
            if u != v: edges.append([u, v])
total = sum(math.dist(nodes[u], nodes[v]) for u, v in edges)

def named(e): return T(e).get('name') or T(e).get('operator') or ''
def bldg_pts(pred):
    out = []
    for e in ways + rels:
        if not pred(T(e)): continue
        for r in rings(e):
            c = centroid(r)
            if inAD(c) or min((math.dist(c, n) for n in nodes), default=1e9) < 150: out.append([round(c[0]), round(c[1]), named(e)])
    for e in E:
        if e['type'] == 'node' and pred(T(e)):
            c = NODE[e['id']]
            if inAD(c): out.append([round(c[0]), round(c[1]), named(e)])
    return out
fire = bldg_pts(lambda t: t.get('amenity') == 'fire_station' or t.get('building') == 'fire_station' or (t.get('emergency') == 'fire_station'))
# a fire training ground is where the tenders go to train, not a station; stations a few metres apart are one
firetrain = [p for p in fire if 'train' in p[2].lower()] + bldg_pts(lambda t: 'fire' in (t.get('name') or '').lower() and 'train' in (t.get('name') or '').lower())
fire = [p for p in fire if 'train' not in p[2].lower()]
def dedupe(L, d):
    out = []
    for p in sorted(L, key=lambda p: -len(p[2])):
        if all(math.dist(p[:2], q[:2]) > d for q in out): out.append(p)
    return out
fire, firetrain = dedupe(fire, 80), dedupe(firetrain, 150)
hangars = bldg_pts(lambda t: t.get('aeroway') == 'hangar' or t.get('building') == 'hangar')
tanks = [r for e in ways if T(e).get('man_made') == 'storage_tank' for r in rings(e) if inAD(centroid(r))]
fuel = []
if tanks:   # the biggest cluster of tanks inside the boundary
    cs = [centroid(r) for r in tanks]
    best = max(cs, key=lambda c: sum(math.dist(c, d) < 250 for d in cs))
    grp = [d for d in cs if math.dist(best, d) < 250]
    fuel = [[round(sum(p[0] for p in grp)/len(grp)), round(sum(p[1] for p in grp)/len(grp)), 'fuel farm']]
fuel += [p for p in bldg_pts(lambda t: 'fuel' in (t.get('name') or '').lower() and t.get('highway') is None)]
catering = bldg_pts(lambda t: any(k in (t.get('name') or '').lower() + (t.get('operator') or '').lower() for k in ('cater', 'gourmet', 'lsg', 'do & co', 'gategroup', 'newrest', 'flying food', 'alpha lsg')))
# terminal faces: points on each terminal outline nearest the aprons, every ~60 m
terms = []
for e in ways + rels:
    t = T(e)
    if t.get('aeroway') != 'terminal' and t.get('building') != 'terminal': continue
    for r in rings(e):
        for i in range(len(r)-1):
            a, b = r[i], r[i+1]; L = math.dist(a, b)
            for k in range(max(1, int(L//60))):
                p = (a[0] + (b[0]-a[0])*(k + 0.5)/max(1, int(L//60)), a[1] + (b[1]-a[1])*(k + 0.5)/max(1, int(L//60)))
                if any(inside(p, ap) for ap in APRONS) or any(near_line(p, ap, 25) for ap in APRONS): terms.append([round(p[0]), round(p[1])])
ded = []
for p in terms:
    if all(math.dist(p, q) > 80 for q in ded): ded.append(p)
terms = ded
bridges = []
for w in ways:
    if T(w).get('aeroway') != 'jet_bridge': continue
    pts = [en(g) for g in w['geometry']]
    bridges.append([[round(pts[0][0], 1), round(pts[0][1], 1)], [round(pts[-1][0], 1), round(pts[-1][1], 1)]])
data = {'nodes': nodes, 'edges': edges, 'fire': fire, 'firetrain': firetrain, 'hangars': hangars, 'fuel': fuel, 'catering': catering, 'terms': terms, 'bridges': bridges}
with open(OUT, 'w') as f:
    f.write(f'// {ICAO} airside roads and ground-vehicle places from OpenStreetMap (tools/vehicles_osm.py): {len(nodes)} nodes, '
            f'{len(edges)} edges, {total/1000:.1f} km of road; {len(fire)} fire station(s), {len(firetrain)} fire training ground(s), {len(hangars)} hangar(s), {len(fuel)} fuel, '
            f'{len(catering)} catering, {len(terms)} terminal faces, {len(bridges)} jet bridges. Metres east/north of the origin.\n')
    f.write('const VEH_DATA = ' + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + ';\n')
print(ICAO, len(nodes), 'nodes', len(edges), 'edges', round(total), 'm road;', 'fire', fire, 'train', firetrain, 'hangars', len(hangars), 'fuel', fuel, 'catering', catering, 'terms', len(terms), 'bridges', len(bridges))
