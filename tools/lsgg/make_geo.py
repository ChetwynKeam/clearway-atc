#!/usr/bin/env python3
"""src/airports/lsgg.geo.json from the OSM downloads (workflow lsgg-osm-fetch, branch osm-data-lsgg): land with the lakes as holes
(even-odd), the lake shores, the France-Switzerland border, towns and nearby airports.
usage: make_geo.py <dir with lakeways.json border.json towns.json airports.json> > lsgg.geo.json"""
import json, sys, math
D = sys.argv[1]
ld = lambda n: json.load(open(f'{D}/{n}.json'))['elements']
W, S, E, N = 5.45, 45.75, 7.05, 46.75           # map extent (lon, lat)
def clip(poly):
    def cl(pts, inside, inter):
        out = []
        for i, p in enumerate(pts):
            q = pts[i - 1]
            if inside(p):
                if not inside(q): out.append(inter(q, p))
                out.append(p)
            elif inside(q): out.append(inter(q, p))
        return out
    X = lambda x: (lambda a, b: (x, a[1] + (b[1] - a[1]) * (x - a[0]) / (b[0] - a[0])))
    Y = lambda y: (lambda a, b: (a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]), y))
    for ins, it in ((lambda p: p[0] >= W, X(W)), (lambda p: p[0] <= E, X(E)), (lambda p: p[1] >= S, Y(S)), (lambda p: p[1] <= N, Y(N))):
        if not poly: break
        poly = cl(poly, ins, it)
    return poly
def area(r): return abs(sum(r[i][0] * r[i - 1][1] - r[i - 1][0] * r[i][1] for i in range(len(r)))) / 2
# join the lake ways end to end into rings (the big lakes are relations whose member ways are separate)
ways = [[(g['lon'], g['lat']) for g in e['geometry']] for e in ld('lakeways') if e['tags'].get('natural') == 'water' and e['tags'].get('water') in (None, 'lake')]
named = [e for e in ld('lakeways') if e['tags'].get('water') == 'lake' or e['tags'].get('name')]
rings = []; open_ = []
for w in ways:
    (rings if w[0] == w[-1] else open_).append(w)
changed = True
while open_ and changed:
    changed = False
    a = open_.pop()
    for i, b in enumerate(open_):
        for x, y in ((a, b), (a, b[::-1]), (b, a), (b[::-1], a)):
            if x[-1] == y[0]: m = x + y[1:]; open_.pop(i); (rings if m[0] == m[-1] else open_).append(m); changed = True; break
        if changed: break
    if not changed: open_.insert(0, a); break
        # unmatched pieces are dropped
# Lake Geneva itself is a relation the OSM download did not return, so its shore is a hand outline through the main towns
# (good to about a kilometre: it only has to read as the lake on the map)
LEMAN = [(6.152, 46.208), (6.165, 46.255), (6.185, 46.31), (6.215, 46.355), (6.235, 46.385), (6.29, 46.43), (6.34, 46.462), (6.42, 46.49), (6.50, 46.505),
         (6.58, 46.512), (6.64, 46.512), (6.70, 46.503), (6.77, 46.49), (6.84, 46.465), (6.90, 46.435), (6.93, 46.405), (6.88, 46.388), (6.81, 46.392),
         (6.72, 46.40), (6.59, 46.397), (6.48, 46.395), (6.40, 46.385), (6.32, 46.37), (6.26, 46.33), (6.23, 46.295), (6.19, 46.255), (6.17, 46.22)]
rings.append([*LEMAN, LEMAN[0]])
keep = []
for r in rings:
    if len(r) < 5: continue
    c = clip(r[:-1])
    if len(c) >= 3 and area(c) > 2e-5: keep.append([[round(x, 5), round(y, 5)] for x, y in c])
land = [[[[W, S], [E, S], [E, N], [W, N]]] + keep]
coast = [r + [r[0]] for r in keep]
borders = []
for e in ld('border'):
    pts = [(g['lon'], g['lat']) for g in e['geometry']]
    if len(pts) > 1: borders.append([[round(x, 5), round(y, 5)] for x, y in pts])
towns = []
for e in ld('towns'):
    t = e['tags']
    if t.get('place') in ('city', 'town') and t.get('name'): towns.append([t['name'].upper(), round(e['lon'], 4), round(e['lat'], 4)])
aps = []
for e in ld('airports'):
    t = e['tags']; ic = t.get('icao') or t.get('ref')
    if ic and len(ic) == 4 and ic.startswith(('LS', 'LF')) and ic != 'LSGG':
        la = e.get('lat') or e.get('center', {}).get('lat'); lo = e.get('lon') or e.get('center', {}).get('lon')
        if la and not any(a[0] == ic for a in aps): aps.append([ic, round(lo, 4), round(la, 4)])
json.dump({'land': land, 'coast': coast, 'borders': borders, 'towns': towns, 'airports': aps}, sys.stdout, separators=(',', ':'))
sys.stderr.write(f'lakes {len(keep)} (rings {len(rings)} open {len(open_)}) borders {len(borders)} towns {len(towns)} airports {len(aps)}\n')
