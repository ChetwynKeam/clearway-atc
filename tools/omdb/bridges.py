#!/usr/bin/env python3
"""The jet bridges of Dubai's contact stands -> the 'bridges' of src/airports/omdb-veh.js.
usage: bridges.py <aerodrome.json> ../../src/airports/omdb-ground.js ../../src/airports/omdb-veh.js
OpenStreetMap maps Dubai's bridges in pieces (the fixed link out of the concourse, the rotunda and the tunnel as separate
ways, some tunnels not joined to anything), so the game took each piece for a bridge of its own: stubs at the building,
tunnels floating on the apron. They are laid here instead, the way the concourses have them: out of the concourse face
ahead of every contact stand (a nose-in stand whose nose is within 45 m of a terminal), one bridge per main door the
stand's largest aircraft uses: an A380 stand (code F) three (main deck 1 and 2 and the upper deck), a widebody stand
(code E) two, any other one. Each bridge's root is on the face ahead of the aircraft's left side, further left the further
aft its door, so the tunnels fan out side by side to their doors and never cross (they draw together only at the doors). Bridge ends are at the design doors
(the game's door table, src/vehicles.js doorsOf): the tunnel telescopes to whichever type is on the stand."""
import sys, json, math, re
OSM, GROUND, OUT = sys.argv[1:4]
A = (25 + 15/60 + 10/3600, 55 + 21/60 + 52/3600); KX = 60*1852*math.cos(math.radians(A[0])); KY = 60*1852
OSMB = [[((g['lon'] - A[1])*KX, (g['lat'] - A[0])*KY) for g in w['geometry']] for w in json.load(open(OSM))['elements']
        if w['type'] == 'way' and w.get('tags', {}).get('aeroway') == 'jet_bridge' and w.get('geometry')]
g = open(GROUND).read(); G = json.loads(g[g.index('{'):g.rindex('}') + 1])
TERM = [b['pts'] for b in G['buildings'] if b['h'] == 16 and not b.get('roof')]
ALLB = [(r[i], r[i + 1]) for b in G['buildings'] if not b.get('roof') for r in [b['pts']] for i in range(len(r) - 1)]
EDGES = [(r[i], r[i + 1]) for r in TERM for i in range(len(r) - 1)]
def ray(p, d, maxd):   # the first terminal face the ray p + t*d meets (t <= maxd), or None
    best = None
    for a, b in EDGES:
        ex, ey = b[0] - a[0], b[1] - a[1]; den = d[0]*ey - d[1]*ex
        if abs(den) < 1e-9: continue
        t = ((a[0] - p[0])*ey - (a[1] - p[1])*ex)/den; u = ((a[0] - p[0])*d[1] - (a[1] - p[1])*d[0])/den
        if 0 <= u <= 1 and 0 < t <= maxd and (best is None or t < best): best = t
    return best
def segd(a, b, c, d):   # the closest two segments come
    def ps(p, q, r):
        dx, dy = r[0] - q[0], r[1] - q[1]; L = dx*dx + dy*dy; t = 0 if L == 0 else max(0, min(1, ((p[0] - q[0])*dx + (p[1] - q[1])*dy)/L))
        return math.dist(p, (q[0] + t*dx, q[1] + t*dy))
    o = lambda p, q, r: (q[0] - p[0])*(r[1] - p[1]) - (q[1] - p[1])*(r[0] - p[0])
    if o(a, b, c)*o(a, b, d) < 0 and o(c, d, a)*o(c, d, b) < 0: return 0
    return min(ps(a, c, d), ps(b, c, d), ps(c, a, b), ps(d, a, b))
def design(span):   # the stand's largest aircraft: length, and its bridge doors (fractions of the length forward of its middle)
    if span >= 78: return 72.7, [0.385, 0.30, 0.22]
    if span > 52: return 63.7, [0.38, 0.25]
    return 37.5, [0.35]
fusw = lambda L: max(2.2, min(6.2, L*0.1))
stands = []
for gt in G['gates']:
    sid, ap, nose, node, hdg, lead, span = gt[:7]
    L, doors = design(span); h = math.radians(hdg); fwd = (math.sin(h), math.cos(h)); left = (-math.cos(h), math.sin(h))
    mid = (nose[0] - fwd[0]*L/2, nose[1] - fwd[1]*L/2)
    stands.append(dict(id=sid, nose=nose, L=L, doors=doors, fwd=fwd, left=left, mid=mid, w=fusw(L)/2))
def over_stand(me, a, b):   # does the tunnel a-b pass over another stand's aircraft?
    for o in stands:
        if o is me or math.dist(o['mid'], me['mid']) < 14: continue
        for i in range(13):
            p = (a[0] + (b[0] - a[0])*i/12 - o['mid'][0], a[1] + (b[1] - a[1])*i/12 - o['mid'][1])
            f = p[0]*o['fwd'][0] + p[1]*o['fwd'][1]; s = p[0]*o['left'][0] + p[1]*o['left'][1]
            if abs(f) < o['L']/2 + 3 and abs(s) < o['w'] + 2.5: return True
    return False
bridges = []; served = {}
for s in stands:
    gap = ray(s['nose'], s['fwd'], 45)
    if gap is None: continue   # a remote stand: no terminal ahead of its nose
    laid = []
    for k, fr in enumerate(s['doors']):
        f = s['L']*fr; D = tuple(s['mid'][i] + s['fwd'][i]*f + s['left'][i]*(s['w'] + 1) for i in (0, 1))
        lat = s['w'] + 6 + 9*k   # the root's offset to the left of the aircraft's centreline
        Q = tuple(s['mid'][i] + s['fwd'][i]*(s['L']/2) + s['left'][i]*lat for i in (0, 1))
        t = ray(Q, s['fwd'], gap + 25)
        if t is None: continue
        R = (Q[0] + s['fwd'][0]*t, Q[1] + s['fwd'][1]*t)
        if not 10 <= math.dist(R, D) <= 62: continue
        if over_stand(s, R, D) or any(segd(R, D, b[0], b[1]) < 3.5 for b in bridges) or any(segd(R, D, b[0], b[1]) < 2 for b in laid) or any(math.dist(R, b[0]) < 5 for b in bridges + laid): continue
        laid.append([[round(R[0], 1), round(R[1], 1)], [round(D[0], 1), round(D[1], 1)]])
    if laid: bridges += laid; served[s['id']] = len(laid)
# the stands no straight face is ahead of (the concourse ends, Terminal 1's angled faces): OpenStreetMap's own bridges
# there, where one is mapped whole: one end on a building, the other at the stand's front door (one of the design doors)
def pseg(p, a, b):
    dx, dy = b[0] - a[0], b[1] - a[1]; L = dx*dx + dy*dy; t = 0 if L == 0 else max(0, min(1, ((p[0] - a[0])*dx + (p[1] - a[1])*dy)/L))
    return math.dist(p, (a[0] + t*dx, a[1] + t*dy))
on_bld = lambda p: min(pseg(p, a, b) for a, b in ALLB) < 4
def doors_of(s):   # the left front doors of a narrowbody, a widebody and an A380 on the stand
    out = []
    for L, fr in ((37.5, [0.35]), (63.7, [0.38, 0.25]), (72.7, [0.385, 0.30, 0.22])):
        mid = (s['nose'][0] - s['fwd'][0]*L/2, s['nose'][1] - s['fwd'][1]*L/2); w = fusw(L)/2
        out += [tuple(mid[i] + s['fwd'][i]*L*f + s['left'][i]*(w + 1) for i in (0, 1)) for f in fr]
    return out
kept = 0
for pts in OSMB:
    for r, e in ((pts[0], pts[-1]), (pts[-1], pts[0])):
        if not on_bld(r) or on_bld(e): continue
        d, s = min(((min(math.dist(e, q) for q in doors_of(s)), s) for s in stands), key=lambda x: x[0])
        if d > 10: break
        if s['id'] in served and served[s['id']] > 0: break   # laid from the face already
        if any(segd(r, e, b[0], b[1]) < 3 for b in bridges): break
        bridges.append([[round(r[0], 1), round(r[1], 1)], [round(e[0], 1), round(e[1], 1)]]); kept += 1
        served.setdefault('osm:' + s['id'], 0); served['osm:' + s['id']] += 1
        break
# the stands OpenStreetMap shows bridges at but maps only in pieces there: laid from the nearest point of the face that is
# ahead of the door and well to the aircraft's left (round a concourse's end, the face is beside the aircraft, not ahead)
FACE = [(a[0] + (b[0] - a[0])*k/n, a[1] + (b[1] - a[1])*k/n) for a, b in EDGES for n in [max(1, int(math.dist(a, b)))] for k in range(n + 1)]
for s in stands:
    if s['id'] in served or 'osm:' + s['id'] in served: continue
    if not any(min(math.dist(p, q) for q in doors_of(s)) < 30 for pts in OSMB for p in (pts[0], pts[-1])): continue
    laid = []
    for k, fr in enumerate(s['doors']):
        f = s['L']*fr; D = tuple(s['mid'][i] + s['fwd'][i]*f + s['left'][i]*(s['w'] + 1) for i in (0, 1)); best = None
        for R in FACE:
            v = (R[0] - s['mid'][0], R[1] - s['mid'][1]); rf = v[0]*s['fwd'][0] + v[1]*s['fwd'][1]; rs = v[0]*s['left'][0] + v[1]*s['left'][1]
            dd = math.dist(R, D)
            if rs < s['w'] + 6 or rf < f - 3 or not 10 <= dd <= 62 or (best and dd >= best[0]): continue
            if any(math.dist(R, b[0]) < 6 for b in bridges + laid): continue
            best = (dd, R)
        if not best: continue
        R = best[1]
        if over_stand(s, R, D) or any(segd(R, D, b[0], b[1]) < 3.5 for b in bridges) or any(segd(R, D, b[0], b[1]) < 2 for b in laid): continue
        laid.append([[round(R[0], 1), round(R[1], 1)], [round(D[0], 1), round(D[1], 1)]])
    if laid: bridges += laid; served[s['id']] = len(laid)
src = open(OUT).read(); m = re.search(r'const VEH_DATA = (\{.*\});', src)
data = json.loads(m.group(1)); data['bridges'] = bridges
new = src[:m.start(1)] + json.dumps(data, separators=(',', ':')) + src[m.end(1):]
head, _, rest = new.partition('\n')
head = re.sub(r'\d+ jet bridges( \([^)]*\))?\.', f'{len(bridges)} jet bridges ({len(bridges) - kept} laid from the concourse faces to the contact stands\' doors, {kept} as mapped: tools/omdb/bridges.py).', head, count=1)
open(OUT, 'w').write(head + '\n' + rest)
by = {}
for k, v in served.items(): by.setdefault(k.split(':')[-1][0] + (' osm' if ':' in k else ''), []).append(v)
print('OSM pieces', len(OSMB), '-> bridges', len(bridges), f'({kept} as mapped) at', len(served), 'stands;', {k: (len(v), sum(v)) for k, v in sorted(by.items())})
print('code F stands without three:', sorted(s['id'] for s in stands if s['L'] > 70 and served.get(s['id'], 0) < 3))
