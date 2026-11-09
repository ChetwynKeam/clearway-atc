# Dublin's approach map -> src/airports/eidw.geo.json: the land round the Irish Sea (the Irish east coast, the Isle of
# Man, Anglesey and north Wales, Galloway), the coast, the Irish border, towns and the other airfields.
# usage: python3 tools/eidw_geo.py <dir with coast_a..d.json> <dir with towns.json airports.json border.json> out.geo.json
# OpenStreetMap coastline ways run with the land on their left; they are joined, closed with the map box and the pieces
# whose inside lies to the left of the coast are the land (as tools/yssy_geo.py).
import json, sys, glob
from shapely.geometry import LineString, box
from shapely.ops import unary_union, polygonize
CD, OD, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
S, W, N, E = 52.30, -7.80, 54.40, -4.00
BB = box(W, S, E, N)
seen, C = set(), []
for f in sorted(glob.glob(CD + '/coast_*.json')):
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
T = json.load(open(OD + '/towns.json'))['elements']; A = json.load(open(OD + '/airports.json'))['elements']; Bd = json.load(open(OD + '/border.json'))['elements']
KEEP = {'Dublin', 'Drogheda', 'Dundalk', 'Swords', 'Bray', 'Navan', 'Wicklow', 'Arklow', 'Balbriggan', 'Skerries', 'Malahide', 'Maynooth', 'Naas', 'Newbridge',
        'Greystones', 'Ashbourne', 'Trim', 'Kells', 'Mullingar', 'Newry', 'Holyhead', 'Douglas', 'Gorey', 'Wexford', 'Carlow', 'Kilkenny', 'Athlone', 'Dún Laoghaire', 'Tallaght', 'Blanchardstown', 'Ramsey', 'Bangor', 'Caernarfon', 'Llandudno'}
towns = [[e['tags'].get('name:en', e['tags']['name']).upper(), round(e['lon'], 4), round(e['lat'], 4)] for e in T
         if e['type'] == 'node' and e.get('tags', {}).get('name') and (e['tags'].get('name:en', e['tags']['name']) in KEEP or e['tags'].get('place') == 'city') and S <= e['lat'] <= N and W <= e['lon'] <= E]
aps = []
for e in A:
    ic = e.get('tags', {}).get('icao'); c = e if 'lat' in e else e.get('center')
    if ic and ic != 'EIDW' and c and S <= c['lat'] <= N and W <= c['lon'] <= E: aps.append([ic, round(c['lon'], 4), round(c['lat'], 4)])
borders = []
for e in Bd:
    if e.get('tags', {}).get('maritime') == 'yes' or not e.get('geometry'): continue
    l = LineString([(g['lon'], g['lat']) for g in e['geometry']]).intersection(BB)
    for g in (list(l.geoms) if hasattr(l, 'geoms') else [l]):
        if g.geom_type == 'LineString' and g.length > 0.01: borders.append([[round(x, 5), round(y, 5)] for x, y in g.simplify(0.0005).coords])
out = {'land': [[ring(simp(p).exterior)] + [ring(i) for i in simp(p).interiors] for p in land if not simp(p).is_empty],
       'coast': [[[round(x, 5), round(y, 5)] for x, y in l.simplify(0.0004).coords] for l in flat if l.length > 0.004],
       'borders': borders, 'towns': towns, 'airports': aps}
json.dump(out, open(OUT, 'w'), separators=(',', ':'))
print({k: len(v) for k, v in out.items()}, 'bytes', len(json.dumps(out)))
