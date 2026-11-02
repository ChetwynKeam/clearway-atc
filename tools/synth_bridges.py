# Jet bridges for airports whose OpenStreetMap data has few or none of them. Where a real terminal outline (OSM) lies close
# beside a stand's left (passenger) side, a bridge is laid from the nearest point of the building face to that stand's front
# door (a widebody's second door too; an A380's three: main deck 1 and 2 and the upper deck). Stands that already have a bridge in
# the airport's data are left alone. It writes the extra bridges into the airport's -veh.js, marked in its header.
#   python3 tools/synth_bridges.py EGKK /tmp/vd/EGKK.json /tmp/vd/stands_EGKK.json src/airports/egkk-veh.js
# stands json: [{id, x, y (metres east/north of the origin), hdg, area, term, span}] dumped from the running game (STANDS).
import json, math, re, sys
ICAO, SRC, STANDS_F, OUT = sys.argv[1:5]
ORIGIN = {'EGKK': (51 + 8/60 + 53/3600, -(11/60 + 25/3600)), 'LEMD': (40 + 28/60 + 20/3600, -(3 + 33/60 + 39/3600)),
          'EGCC': (53 + 21/60 + 13/3600, -(2 + 16/60 + 30/3600)), 'EGLL': (51 + 28/60 + 39/3600, -(27/60 + 41/3600)),
          'KJFK': (40.639925, -73.778939), 'YSSY': (-(33 + 56/60 + 46/3600), 151 + 10/60 + 38/3600)}
LAT0, LON0 = ORIGIN[ICAO]; KX, KY = 60*1852*math.cos(math.radians(LAT0)), 60*1852
en = lambda g: ((g['lon'] - LON0)*KX, (g['lat'] - LAT0)*KY)
E = json.load(open(SRC))['elements']; T = lambda e: e.get('tags', {})
def rings(e):
    if e['type'] == 'way': return [[en(g) for g in e['geometry']]] if len(e.get('geometry', [])) > 3 else []
    segs = [[en(g) for g in m['geometry']] for m in e.get('members', []) if m.get('role') == 'outer' and m.get('geometry')]; out = []
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
def inside(p, r):
    c = False; j = len(r) - 1
    for i in range(len(r)):
        (xi, yi), (xj, yj) = r[i], r[j]
        if (yi > p[1]) != (yj > p[1]) and p[0] < (xj - xi)*(p[1] - yi)/(yj - yi) + xi: c = not c
        j = i
    return c
def segpt(p, a, b):
    dx, dy = b[0]-a[0], b[1]-a[1]; L = dx*dx + dy*dy
    t = 0 if L == 0 else max(0, min(1, ((p[0]-a[0])*dx + (p[1]-a[1])*dy)/L)); return (a[0] + t*dx, a[1] + t*dy)
BLD = []
for e in E:
    t = T(e)
    if e['type'] == 'node' or t.get('building') in ('hangar', 'warehouse', 'industrial', 'parking', 'garage', 'roof'): continue
    if t.get('aeroway') == 'terminal' or t.get('building') in ('terminal', 'airport_terminal') or t.get('building') == 'transportation':
        BLD += rings(e)
def facing(p, hmax):   # the nearest point on a building outline to p, and its distance
    best = None
    for r in BLD:
        for i in range(len(r) - 1):
            q = segpt(p, r[i], r[i+1]); d = math.dist(p, q)
            if (best is None or d < best[0]): best = (d, q)
    return best
def nearest_free(p, left, lo, hi):   # a face point on the left, in the reach, with the stand side clear of the building
    best = None
    for r in BLD:
        if inside(p, r): return None
        for i in range(len(r) - 1):
            q = segpt(p, r[i], r[i+1]); d = math.dist(p, q)
            if d < lo or d > hi or (best is not None and d >= best[0]): continue
            v = ((q[0]-p[0])/d, (q[1]-p[1])/d)
            if v[0]*left[0] + v[1]*left[1] < math.cos(math.radians(65)): continue   # more or less abeam on the left
            best = (d, q)
    return best
src = open(OUT).read(); m = re.search(r'const VEH_DATA = (\{.*\});', src)
data = json.loads(m.group(1)); real = list(data['bridges'])
stands = json.load(open(STANDS_F)); new = []
def segd2(a, b, c, d):   # the closest two segments come, metres
    def ps(p, q, r):
        dx, dy = r[0]-q[0], r[1]-q[1]; L = dx*dx + dy*dy; t = 0 if L == 0 else max(0, min(1, ((p[0]-q[0])*dx + (p[1]-q[1])*dy)/L)); return math.dist(p, (q[0] + t*dx, q[1] + t*dy))
    o = lambda p, q, r: (q[0]-p[0])*(r[1]-p[1]) - (q[1]-p[1])*(r[0]-p[0])
    if o(a, b, c)*o(a, b, d) < 0 and o(c, d, a)*o(c, d, b) < 0: return 0
    return min(ps(a, c, d), ps(b, c, d), ps(c, a, b), ps(d, a, b))
def over_stand(me, a, b):   # does the tunnel a-b pass through another stand's fuselage?
    for o in stands:
        if o is me or o.get('area') != 'civil' or math.dist((o['x'], o['y']), (me['x'], me['y'])) < 14: continue
        sp = o.get('span') or 36; Lo = 72.7 if sp >= 78 else 63.7 if sp > 52 else 37.5; ho = math.radians(o['hdg'])
        for i in range(13):
            p = (a[0] + (b[0]-a[0])*i/12 - o['x'], a[1] + (b[1]-a[1])*i/12 - o['y'])
            f = p[0]*math.sin(ho) + p[1]*math.cos(ho); sd = p[0]*math.cos(ho) - p[1]*math.sin(ho)
            if abs(f) < Lo/2 + 3 and abs(sd) < fusw(Lo)/2 + 2.5: return True
    return False
def fusw(L): return max(2.2, min(6.2, L*0.1))
for s in stands:
    if s.get('area') != 'civil': continue
    span = s.get('span') or 36
    # the largest aircraft the stand takes sets its doors
    L, doors = (72.7, [0.385, 0.30, 0.22]) if span >= 78 else (63.7, [0.38, 0.25]) if span > 52 else (37.5, [0.35])
    h = math.radians(s['hdg']); fwd = (math.sin(h), math.cos(h)); left = (-math.cos(h), math.sin(h)); w = fusw(L)/2
    mid = (s['x'], s['y']); k0 = len(new)
    D1 = (mid[0] + fwd[0]*L*doors[0] + left[0]*(w+1), mid[1] + fwd[1]*L*doors[0] + left[1]*(w+1))
    for d in doors:
        f = L*d; D = (mid[0] + fwd[0]*f + left[0]*(w+1), mid[1] + fwd[1]*f + left[1]*(w+1)); A = (D[0] + left[0]*3.5, D[1] + left[1]*3.5)
        if any(math.dist(D, e) < 2.5 for b in real + new for e in b[:2]): continue   # a bridge (real or laid) is already at this door
        hit = nearest_free(A, left, 9, 44)
        if not hit: continue
        root = hit[1]
        if any(math.dist(root, n[0]) < 6 for n in real + new): continue
        if over_stand(s, root, D) or any(segd2(root, D, b[0], b[1]) < 3.5 for b in real + new): continue   # never across a neighbour's aircraft or another tunnel
        new.append([[round(root[0], 1), round(root[1], 1)], [round(D[0], 1), round(D[1], 1)]])
n0 = len(real); merged = []
for b in new:
    if any(math.dist(b[0], o[0]) < 4 and math.dist(b[1], o[1]) < 4 for o in data['bridges'] + merged): continue
    merged.append(b)
data['bridges'] = data['bridges'] + merged
head, _, rest = src.partition('\n'); hl = len(head)
head = re.sub(r' Metres east/north', f' {len(merged)} more jet bridges laid from the terminal outlines to the stands (tools/synth_bridges.py). Metres east/north', head, count=1) if 'synth_bridges' not in head else head
open(OUT, 'w').write(head + '\n' + src[hl + 1:m.start(1)] + json.dumps(data, separators=(',', ':')) + src[m.end(1):])
print(ICAO, 'real', n0, 'added', len(merged), 'terminal rings', len(BLD))
