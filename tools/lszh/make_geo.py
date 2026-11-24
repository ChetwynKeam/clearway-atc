#!/usr/bin/env python3
"""src/airports/lszh.geo.json from the OpenStreetMap downloads (.github/workflows/lszh-fetch.yml, branch osm-data-lszh): the
land with the lakes as holes (Lake Zurich, the Greifensee, the Pfäffikersee, Lake Constance and the rest), their shores, the
Swiss borders with Germany and Austria (the Rhine), the towns and the other airfields.
usage: make_geo.py <dir with water.json borders.json towns.json airports.json> > src/airports/lszh.geo.json"""
import json, sys, os
from shapely.geometry import LineString, Polygon, box
from shapely.ops import unary_union, polygonize
D = sys.argv[1]
J = lambda f: json.load(open(os.path.join(D, f + '.json')))['elements'] if os.path.exists(os.path.join(D, f + '.json')) else []
W, S, E, N = 7.75, 46.95, 9.75, 47.95
BB = box(W, S, E, N)
polys = []
for e in J('water'):
    if e['type'] == 'way' and e.get('geometry') and len(e['geometry']) > 3 and e['nodes'][0] == e['nodes'][-1]:
        polys.append(Polygon([(g['lon'], g['lat']) for g in e['geometry']]))
    if e['type'] == 'relation':
        outer = [LineString([(g['lon'], g['lat']) for g in m['geometry']]) for m in e.get('members', []) if m.get('role') == 'outer' and m.get('geometry') and len(m['geometry']) > 1]
        inner = [LineString([(g['lon'], g['lat']) for g in m['geometry']]) for m in e.get('members', []) if m.get('role') == 'inner' and m.get('geometry') and len(m['geometry']) > 1]
        P = unary_union(list(polygonize(unary_union(outer))))
        if inner: P = P.difference(unary_union(list(polygonize(unary_union(inner)))))
        polys.append(P)
water = unary_union([p.buffer(0) for p in polys if not p.is_empty]).intersection(BB)
water = unary_union([g for g in (water.geoms if hasattr(water, 'geoms') else [water]) if g.area > 2e-5])   # lakes of about 15 ha and more
def ring(r): return [[round(x, 5), round(y, 5)] for x, y in r.coords]
rings = []
for g in (water.geoms if hasattr(water, 'geoms') else [water]):
    if g.geom_type != 'Polygon': continue
    q = g.simplify(0.0003)
    if not q.is_empty and q.geom_type == 'Polygon': rings.append(ring(q.exterior))
land = [[[[W, S], [E, S], [E, N], [W, N], [W, S]]] + rings]
coast = rings
borders = []
for e in J('borders'):
    if not e.get('geometry'): continue
    l = LineString([(g['lon'], g['lat']) for g in e['geometry']]).intersection(BB.buffer(-1e-6))
    for g in (list(l.geoms) if hasattr(l, 'geoms') else [l]):
        if g.geom_type == 'LineString' and g.length > 0.005: borders.append([[round(x, 5), round(y, 5)] for x, y in g.simplify(0.0004).coords])
KEEP = {'Zürich', 'Winterthur', 'Kloten', 'Bülach', 'Dübendorf', 'Uster', 'Wetzikon', 'Baden', 'Wettingen', 'Schaffhausen', 'Frauenfeld', 'Rapperswil-Jona',
        'Zug', 'Luzern', 'Aarau', 'Wil', 'St. Gallen', 'Konstanz', 'Kreuzlingen', 'Waldshut-Tiengen', 'Singen (Hohentwiel)', 'Dietikon', 'Wädenswil',
        'Horgen', 'Thalwil', 'Opfikon', 'Wallisellen', 'Regensdorf', 'Embrach', 'Eglisau', 'Rafz', 'Jestetten', 'Bad Zurzach', 'Lenzburg', 'Brugg',
        'Olten', 'Pfäffikon ZH', 'Affoltern am Albis', 'Einsiedeln', 'Schwyz', 'Glarus', 'Friedrichshafen', 'Radolfzell am Bodensee', 'Weinfelden', 'Arbon'}
towns = []
for e in J('towns'):
    t = e.get('tags', {}); nm = t.get('name')
    if e['type'] != 'node' or not nm or not (S <= e['lat'] <= N and W <= e['lon'] <= E): continue
    if nm in KEEP or t.get('place') == 'city': towns.append([nm.split(' (')[0].upper(), round(e['lon'], 4), round(e['lat'], 4)])
aps = []
for e in J('airports'):
    ic = e.get('tags', {}).get('icao'); c = e if 'lat' in e else e.get('center')
    if ic and ic != 'LSZH' and c and S <= c['lat'] <= N and W <= c['lon'] <= E and not any(a[0] == ic for a in aps): aps.append([ic, round(c['lon'], 4), round(c['lat'], 4)])
out = {'land': land, 'coast': coast, 'borders': borders, 'towns': towns, 'airports': aps}
sys.stdout.write(json.dumps(out, separators=(',', ':')))
print({k: len(v) for k, v in out.items()}, len(json.dumps(out)), file=sys.stderr)
