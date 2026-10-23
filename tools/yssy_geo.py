# Sydney land and coast for the approach map -> src/airports/yssy.geo.json
# usage: python3 tools/yssy_geo.py osm_coast.json osm_area.json out.geo.json
# OpenStreetMap coastline ways run with the land on their left; they are joined, closed with the map box and the pieces whose
# inside lies to the left of the coast are the land.
import json, sys, math
from shapely.geometry import LineString, box, Point
from shapely.ops import unary_union, polygonize, linemerge
C = json.load(open(sys.argv[1]))['elements']; A = json.load(open(sys.argv[2]))['elements']
S, W, N, E = -34.60, 150.55, -33.30, 151.75
BB = box(W, S, E, N)
lines = [LineString([(g['lon'], g['lat']) for g in e['geometry']]) for e in C if e.get('geometry') and len(e['geometry']) > 1]
lines = [l.intersection(BB) for l in lines]
flat = []
for l in lines:
    flat += list(l.geoms) if hasattr(l, 'geoms') else [l]
flat = [l for l in flat if l.geom_type == 'LineString' and l.length > 0]
net = unary_union(flat + [BB.exterior])
polys = list(polygonize(net))
def left_of_coast(pt):
    best = None
    for l in flat:
        d = l.distance(pt)
        if best is None or d < best[0]: best = (d, l)
    l = best[1]; s = l.project(pt); a = l.interpolate(max(0, s - 1e-4)); b = l.interpolate(min(l.length, s + 1e-4))
    return (b.x - a.x)*(pt.y - a.y) - (b.y - a.y)*(pt.x - a.x) > 0
land = []
for p in polys:
    if p.area < 1e-7: continue
    if left_of_coast(p.representative_point()): land.append(p)
print('polygons', len(polys), 'land', len(land))
def ring(r): return [[round(x, 5), round(y, 5)] for x, y in r.coords]
simp = lambda p: p.simplify(0.0003)
out = {'land': [[ring(simp(p).exterior)] + [ring(i) for i in simp(p).interiors] for p in land if not simp(p).is_empty],
       'coast': [[[round(x, 5), round(y, 5)] for x, y in l.simplify(0.0003).coords] for l in flat if l.length > 0.003],
       'borders': [],
       'towns': [[e['tags']['name'].upper(), round(e['lon'], 4), round(e['lat'], 4)] for e in A if e['type'] == 'node' and e.get('tags', {}).get('place') in ('city',) or (e['type'] == 'node' and e.get('tags', {}).get('place') == 'town' and e['tags'].get('name') in ('Parramatta', 'Penrith', 'Liverpool', 'Campbelltown', 'Manly', 'Hornsby', 'Richmond', 'Chatswood'))],
       'airports': [[e['tags']['icao'], round(e.get('lon', e.get('center', {}).get('lon')), 4), round(e.get('lat', e.get('center', {}).get('lat')), 4)] for e in A if e.get('tags', {}).get('icao') and e['tags']['icao'] != 'YSSY' and e.get('lat', e.get('center'))]}
json.dump(out, open(sys.argv[3], 'w'), separators=(',', ':'))
print({k: len(v) for k, v in out.items()}, 'bytes', len(json.dumps(out)))
