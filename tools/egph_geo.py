# Edinburgh's approach map -> src/airports/egph.geo.json: the land of central and southern Scotland round the Firth of Forth,
# the Firth of Clyde and the North Sea coast, the coast, towns and the other airfields (no borders inside the map).
# usage: python3 tools/egph_geo.py <dir with coast.json towns.json (the egph-data branch)> src/airports/egph.geo.json
# OpenStreetMap coastline ways run with the land on their left; they are joined, closed with the map box and the pieces
# whose inside lies to the left of the coast are the land (as tools/eidw_geo.py).
import json, sys, glob
from shapely.geometry import LineString, box
from shapely.ops import unary_union, polygonize
CD, OUT = sys.argv[1], sys.argv[2]
OD = CD
S, W, N, E = 54.90, -5.20, 57.00, -1.40
BB = box(W, S, E, N)
seen, C = set(), []
for f in sorted(glob.glob(CD + '/coast*.json')):
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
T = json.load(open(OD + '/towns.json'))['elements']; Bd = []
KEEP = {'Edinburgh', 'Glasgow', 'Livingston', 'Dunfermline', 'Kirkcaldy', 'Falkirk', 'Stirling', 'Perth', 'Dundee', 'Musselburgh', 'Dalkeith',
        'Penicuik', 'Bathgate', 'Linlithgow', 'Grangemouth', 'Glenrothes', 'North Berwick', 'Dunbar', 'Peebles', 'Galashiels', 'Hawick', 'Lanark',
        'Motherwell', 'Hamilton', 'St Andrews', 'Haddington', 'Cumbernauld', 'Alloa', 'Kirkintilloch', 'Berwick-upon-Tweed', 'Eyemouth', 'Kelso', 'Moffat', 'Biggar', 'Cupar', 'Arbroath', 'Ayr', 'Kilmarnock', 'East Kilbride', 'Queensferry', 'South Queensferry', 'Broxburn', 'Leven'}
towns = [[e['tags'].get('name:en', e['tags']['name']).upper(), round(e['lon'], 4), round(e['lat'], 4)] for e in T
         if e['type'] == 'node' and e.get('tags', {}).get('name') and (e['tags'].get('name:en', e['tags']['name']) in KEEP or e['tags'].get('place') == 'city') and S <= e['lat'] <= N and W <= e['lon'] <= E]
# the other airfields (UK AIP AD 2 reference points)
aps = [['EGPF', -4.4331, 55.8719], ['EGPK', -4.5869, 55.5094], ['EGPN', -3.0258, 56.4525], ['EGQL', -2.8684, 56.3729], ['EGPT', -3.3722, 56.4392],
       ['EGPG', -3.9750, 55.9747], ['EGNT', -1.6917, 55.0375], ['EGQS', -3.3392, 57.7052]]
aps = [a for a in aps if S <= a[2] <= N and W <= a[1] <= E]
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
