# Dubai's approach map -> src/airports/omdb.geo.json: the land round the southern Gulf (the UAE coast from Abu Dhabi to
# Ras Al Khaimah with the Palm and World islands, the Musandam and the Hajar), the coast, the emirates' and Oman's
# borders, towns and the other airfields.
# usage: python3 tools/omdb_geo.py <omdb-data dir: coast.json towns.json airports.json border.json> out.geo.json
# OpenStreetMap coastline ways run with the land on their left; they are joined, closed with the map box and the pieces
# whose inside lies to the left of the coast are the land (as tools/yssy_geo.py).
import json, sys, glob
from shapely.geometry import LineString, box
from shapely.ops import unary_union, polygonize
OD, OUT = sys.argv[1], sys.argv[2]; CD = OD
S, W, N, E = 24.60, 54.60, 25.90, 56.40
BB = box(W, S, E, N)
seen, C = set(), []
for f in [CD + '/coast.json']:
    for e in json.load(open(f))['elements']:
        if e['id'] in seen or not e.get('geometry') or len(e['geometry']) < 2: continue
        seen.add(e['id']); C.append(e)
lines = [LineString([(g['lon'], g['lat']) for g in e['geometry']]).intersection(BB) for e in C]
flat = []
for l in lines: flat += list(l.geoms) if hasattr(l, 'geoms') else [l]
flat = [l for l in flat if l.geom_type == 'LineString' and l.length > 0]
polys = list(polygonize(unary_union(flat + [BB.exterior])))
def left_of_coast(pt):
    best = None
    for l in flat:
        d = l.distance(pt)
        if best is None or d < best[0]: best = (d, l)
    l = best[1]; s = l.project(pt); a = l.interpolate(max(0, s - 1e-4)); b = l.interpolate(min(l.length, s + 1e-4))
    return (b.x - a.x)*(pt.y - a.y) - (b.y - a.y)*(pt.x - a.x) > 0
land = [p for p in polys if p.area >= 2e-6 and left_of_coast(p.representative_point())]
print('coast ways', len(C), 'polygons', len(polys), 'land', len(land))
def ring(r): return [[round(x, 5), round(y, 5)] for x, y in r.coords]
simp = lambda p: p.simplify(0.0004)
import os
# the towns query came back empty on the download: positions from OpenStreetMap's place nodes, typed in
T = json.load(open(OD + '/towns.json'))['elements'] if os.path.exists(OD + '/towns.json') else [{'type': 'node', 'lat': la, 'lon': lo, 'tags': {'name': n, 'place': 'town'}} for n, la, lo in [
    ('Dubai', 25.204, 55.270), ('Sharjah', 25.346, 55.421), ('Ajman', 25.405, 55.513), ('Umm Al Quwain', 25.564, 55.555), ('Ras Al Khaimah', 25.789, 55.943),
    ('Jebel Ali', 25.011, 55.061), ('Hatta', 24.797, 56.118), ('Al Dhaid', 25.289, 55.882), ('Khor Fakkan', 25.339, 56.350), ('Dibba', 25.619, 56.273),
    ('Fujairah', 25.124, 56.326), ('Kalba', 25.051, 56.354), ('Masafi', 25.316, 56.165), ('Al Madam', 24.968, 55.781)]]
A = json.load(open(OD + '/airports.json'))['elements']; Bd = json.load(open(OD + '/border.json'))['elements']
KEEP = {'Dubai', 'Sharjah', 'Ajman', 'Umm Al Quwain', 'Ras Al Khaimah', 'Abu Dhabi', 'Al Ain', 'Hatta', 'Fujairah', 'Khor Fakkan', 'Dibba', 'Jebel Ali',
        'Al Dhaid', 'Masafi', 'Kalba', 'Khasab', 'Buraimi', 'Al Madam'}
towns = [[e['tags'].get('name:en', e['tags']['name']).upper(), round(e['lon'], 4), round(e['lat'], 4)] for e in T
         if e['type'] == 'node' and e.get('tags', {}).get('name') and (e['tags'].get('name:en', e['tags']['name']) in KEEP or e['tags'].get('place') == 'city') and S <= e['lat'] <= N and W <= e['lon'] <= E]
aps = []
for e in A:
    ic = e.get('tags', {}).get('icao'); c = e if 'lat' in e else e.get('center')
    if ic and ic != 'OMDB' and c and S <= c['lat'] <= N and W <= c['lon'] <= E: aps.append([ic, round(c['lon'], 4), round(c['lat'], 4)])
borders = []
for e in Bd:
    if e.get('tags', {}).get('maritime') == 'yes' or not e.get('geometry') or e.get('tags', {}).get('admin_level') not in ('2', '4'): continue
    l = LineString([(g['lon'], g['lat']) for g in e['geometry']]).intersection(BB)
    for g in (list(l.geoms) if hasattr(l, 'geoms') else [l]):
        if g.geom_type == 'LineString' and g.length > 0.01: borders.append([[round(x, 5), round(y, 5)] for x, y in g.simplify(0.0005).coords])
out = {'land': [[ring(simp(p).exterior)] + [ring(i) for i in simp(p).interiors] for p in land if not simp(p).is_empty],
       'coast': [[[round(x, 5), round(y, 5)] for x, y in l.simplify(0.0004).coords] for l in flat if l.length > 0.004],
       'borders': borders, 'towns': towns, 'airports': aps}
json.dump(out, open(OUT, 'w'), separators=(',', ':'))
print({k: len(v) for k, v in out.items()}, 'bytes', len(json.dumps(out)))
