#!/usr/bin/env python3
"""src/airports/ekch.geo.json: Copenhagen's approach map. The land from OpenStreetMap's land polygons (osmdata.openstreetmap.de,
land-polygons-split-4326: Zealand, Amager, Saltholm, Skåne, Møn, Falster, Lolland, Funen's east coast, Bornholm is off the map),
clipped to the map box and simplified; its coast; the towns and the other airfields (no land border on the map: Denmark and
Sweden meet in the Øresund).
usage: make_geo.py <land_polygons.shp> > src/airports/ekch.geo.json"""
import json, sys
import shapefile
from shapely.geometry import shape, box
from shapely.ops import unary_union
W, S, E, N = 10.3, 54.3, 15.0, 56.95
BB = box(W, S, E, N)
r = shapefile.Reader(sys.argv[1])
parts = []
for sr in r.iterShapeRecords():
    b = sr.shape.bbox
    if b[2] < W or b[0] > E or b[3] < S or b[1] > N: continue
    g = shape(sr.shape.__geo_interface__).buffer(0).intersection(BB)
    if not g.is_empty: parts.append(g)
land = unary_union(parts)
polys = [g for g in (land.geoms if hasattr(land, 'geoms') else [land]) if g.geom_type == 'Polygon' and g.area > 1e-4]   # islands of about 25 ha and more
def ring(r): return [[round(x, 5), round(y, 5)] for x, y in r.coords]
out_land, coast = [], []
for p in polys:
    q = p.simplify(0.0012 if p.area > 0.02 else 0.0007)
    if q.is_empty or q.geom_type != 'Polygon': continue
    out_land.append([ring(q.exterior)] + [ring(i) for i in q.interiors if len(i.coords) > 4])
    # the coast: the outline less where it runs along the map box
    ext = q.exterior.difference(BB.exterior.buffer(1e-5))
    for l in (ext.geoms if hasattr(ext, 'geoms') else [ext]):
        if l.geom_type == 'LineString' and l.length > 0.003: coast.append(ring(l))
# the towns round the Øresund and on Zealand (OpenStreetMap place nodes)
towns = [['COPENHAGEN', 12.5683, 55.6761], ['MALMÖ', 13.0038, 55.6050], ['LUND', 13.1910, 55.7047], ['HELSINGBORG', 12.6945, 56.0465],
         ['HELSINGØR', 12.6082, 56.0361], ['LANDSKRONA', 12.8301, 55.8708], ['TRELLEBORG', 13.1567, 55.3751], ['ROSKILDE', 12.0803, 55.6419],
         ['KØGE', 12.1823, 55.4580], ['HILLERØD', 12.3108, 55.9267], ['HOLBÆK', 11.7149, 55.7175], ['RINGSTED', 11.7897, 55.4426],
         ['NÆSTVED', 11.7601, 55.2299], ['DRAGØR', 12.6750, 55.5933], ['YSTAD', 13.8205, 55.4295], ['FAXE', 12.1194, 55.2558],
         ['VORDINGBORG', 11.9123, 55.0084], ['KALUNDBORG', 11.0888, 55.6795], ['SLAGELSE', 11.3531, 55.4028], ['ÄNGELHOLM', 12.8622, 56.2428],
         ['ESLÖV', 13.3036, 55.8392], ['HÖÖR', 13.5410, 55.9363], ['STEGE', 12.2869, 54.9867], ['NYKØBING F', 11.8706, 54.7691]]
aps = [['EKRK', 12.1314, 55.5856], ['ESMS', 13.3762, 55.5363], ['ESTA', 12.8471, 56.2961], ['EKSN', 11.4167, 55.2167], ['EKMS', 12.2361, 55.0089],
       ['ESMK', 14.0855, 55.9217], ['EKVJ', 10.5, 56.0]]
aps = [a for a in aps if a[0] not in ('EKSN', 'EKMS', 'EKVJ')]
out = {'land': out_land, 'coast': coast, 'borders': [], 'towns': [t for t in towns if W <= t[1] <= E and S <= t[2] <= N], 'airports': aps}
sys.stdout.write(json.dumps(out, separators=(',', ':')))
print({k: len(v) for k, v in out.items()}, len(json.dumps(out)), file=sys.stderr)
