# Newcastle's approach map -> src/airports/egnt.geo.json: the land west of the North Sea coast from the Tees to the Firth
# of Forth, the coast, the River Tyne (OpenStreetMap water areas: the tidal river through Newcastle to the sea), the towns
# and the other airfields. Input: the osm-data-egnt branch (.github/workflows/egnt-osm-fetch.yml).
# usage: python3 tools/egnt/make_geo.py <osm-data-egnt dir> src/airports/egnt.geo.json
# OpenStreetMap coastline ways run with the land on their left; they are joined, closed with the map box and the pieces
# whose inside lies to the left of the coast are the land (as tools/eidw_geo.py).
import json, sys, glob
from shapely.geometry import LineString, Polygon, box
from shapely.ops import unary_union, polygonize
D, OUT = sys.argv[1], sys.argv[2]
S, W, N, E = 54.20, -3.60, 56.10, -0.20
BB = box(W, S, E, N)
seen, C = set(), []
for f in sorted(glob.glob(D + '/coast_*.json')):
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
# the Tyne below Newcastle (and the Wear and Tees mouths): OpenStreetMap's river water areas, cut out of the land
water = []
for e in json.load(open(D + '/rivers.json'))['elements']:
    if e['type'] == 'way' and e.get('geometry') and len(e['geometry']) > 3 and e['geometry'][0] == e['geometry'][-1]:
        try:
            p = Polygon([(g['lon'], g['lat']) for g in e['geometry']]).buffer(0)
            if p.area > 2e-7: water.append(p)
        except Exception: pass
if water:
    W_ = unary_union(water); land = [p.difference(W_) for p in land]
    flatland = []
    for p in land: flatland += list(p.geoms) if hasattr(p, 'geoms') else [p]
    land = [p for p in flatland if p.geom_type == 'Polygon' and p.area >= 2e-6]
print('coast ways', len(C), 'polygons', len(polys), 'land', len(land), 'river areas', len(water))
def ring(r): return [[round(x, 5), round(y, 5)] for x, y in r.coords]
simp = lambda p: p.simplify(0.0004)
T = json.load(open(D + '/towns.json'))['elements']; A = json.load(open(D + '/airports.json'))['elements']
KEEP = {'Newcastle upon Tyne', 'Sunderland', 'Durham', 'Gateshead', 'South Shields', 'North Shields', 'Tynemouth', 'Whitley Bay', 'Blyth', 'Cramlington',
        'Morpeth', 'Ashington', 'Hexham', 'Consett', 'Stanley', 'Chester-le-Street', 'Washington', 'Hartlepool', 'Middlesbrough', 'Stockton-on-Tees',
        'Darlington', 'Bishop Auckland', 'Peterlee', 'Alnwick', 'Berwick-upon-Tweed', 'Carlisle', 'Penrith', 'Kelso', 'Hawick', 'Jedburgh',
        'Edinburgh', 'Ponteland', 'Prudhoe', 'Seaham', 'Redcar', 'Whitby', 'Amble', 'Haltwhistle', 'Galashiels', 'Dunbar', 'Northallerton', 'Ripon'}
towns = [[{'Newcastle upon Tyne': 'Newcastle'}.get(e['tags']['name'], e['tags'].get('name:en', e['tags']['name'])).upper(), round(e['lon'], 4), round(e['lat'], 4)] for e in T
         if e['type'] == 'node' and e.get('tags', {}).get('name') and e['tags']['name'] in KEEP and S <= e['lat'] <= N and W <= e['lon'] <= E]
aps = []
for e in A:
    ic = e.get('tags', {}).get('icao'); c = e if 'lat' in e else e.get('center')
    if ic and ic != 'EGNT' and c and S <= c['lat'] <= N and W <= c['lon'] <= E: aps.append([ic, round(c['lon'], 4), round(c['lat'], 4)])
out = {'land': [[ring(simp(p).exterior)] + [ring(i) for i in simp(p).interiors] for p in land if not simp(p).is_empty],
       'coast': [[[round(x, 5), round(y, 5)] for x, y in l.simplify(0.0004).coords] for l in flat if l.length > 0.004],
       'borders': [], 'towns': towns, 'airports': aps}
json.dump(out, open(OUT, 'w'), separators=(',', ':'))
print({k: len(v) for k, v in out.items()}, 'bytes', len(json.dumps(out)))
