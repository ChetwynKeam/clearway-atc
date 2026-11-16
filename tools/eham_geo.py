# Schiphol's approach map -> src/airports/eham.geo.json: the land round the North Sea coast of the Netherlands, less the
# IJsselmeer, the Markermeer and the other big lakes, the coast, the Belgian and German borders, towns and the other
# airfields. usage: python3 tools/eham_geo.py <dir with coast.json water.json towns.json borders.json airports.json> out.geo.json
# (the eham-data branch's geo/, from .github/workflows/eham-fetch.yml). OpenStreetMap coastline ways run with the land on
# their left; they are joined, closed with the map box and the pieces whose inside lies to the left of the coast are the
# land (as tools/eidw_geo.py). The lakes behind the Afsluitdijk and the Houtribdijk are water, not sea, so they are cut out.
import json, sys, os
from shapely.geometry import LineString, Polygon, box
from shapely.ops import unary_union, polygonize
GD, OUT = sys.argv[1], sys.argv[2]
S, W, N, E = 51.40, 3.30, 53.20, 6.30
BB = box(W, S, E, N)
J = lambda f: json.load(open(os.path.join(GD, f + '.json')))['elements'] if os.path.exists(os.path.join(GD, f + '.json')) else []
C = [e for e in J('coast') if e.get('geometry') and len(e['geometry']) > 1]
lines = [LineString([(g['lon'], g['lat']) for g in e['geometry']]).intersection(BB) for e in C]
flat = []
for l in lines: flat += list(l.geoms) if hasattr(l, 'geoms') else [l]
flat = [l for l in flat if l.geom_type == 'LineString' and l.length > 0]
polys = list(polygonize(unary_union(flat + [BB.exterior])))
def left_of_coast(pt):
    l = min(flat, key=lambda l: l.distance(pt)); s = l.project(pt); a = l.interpolate(max(0, s - 1e-4)); b = l.interpolate(min(l.length, s + 1e-4))
    return (b.x - a.x)*(pt.y - a.y) - (b.y - a.y)*(pt.x - a.x) > 0
land = unary_union([p for p in polys if p.area >= 2e-6 and left_of_coast(p.representative_point())])
# the lakes: closed ways, and relations' outer rings joined up
wpolys = []
for e in J('water'):
    if e['type'] == 'way' and e.get('geometry') and len(e['geometry']) > 3 and e['nodes'][0] == e['nodes'][-1]:
        wpolys.append(Polygon([(g['lon'], g['lat']) for g in e['geometry']]))
    if e['type'] == 'relation':
        outer = [LineString([(g['lon'], g['lat']) for g in m['geometry']]) for m in e.get('members', []) if m.get('role') == 'outer' and m.get('geometry') and len(m['geometry']) > 1]
        wpolys += list(polygonize(unary_union(outer)))
water = unary_union([p.buffer(0) for p in wpolys if p.is_valid or p.buffer(0).is_valid]).intersection(BB)
land = land.difference(water)
print('coast ways', len(C), 'lakes', len(wpolys), 'land area', round(land.area, 3))
def ring(r): return [[round(x, 5), round(y, 5)] for x, y in r.coords]
geoms = list(land.geoms) if hasattr(land, 'geoms') else [land]
out_land = []
for p in geoms:
    q = p.simplify(0.0005)
    if q.is_empty or q.area < 2e-6: continue
    for g in (list(q.geoms) if hasattr(q, 'geoms') else [q]):
        if g.geom_type == 'Polygon': out_land.append([ring(g.exterior)] + [ring(i) for i in g.interiors if Polygon(i).area > 2e-6])
shore = []
for g in [*flat, *(list(water.boundary.geoms) if hasattr(water.boundary, 'geoms') else [water.boundary])]:
    if g.geom_type == 'LineString' and g.length > 0.004: shore.append([[round(x, 5), round(y, 5)] for x, y in g.simplify(0.0004).coords])
KEEP = {'Amsterdam', 'Haarlem', 'Leiden', 'Den Haag', "'s-Gravenhage", 'Rotterdam', 'Utrecht', 'Almere', 'Lelystad', 'Hilversum', 'Zaandam', 'IJmuiden',
        'Alkmaar', 'Hoofddorp', 'Amstelveen', 'Purmerend', 'Hoorn', 'Zandvoort', 'Delft', 'Gouda', 'Amersfoort', 'Den Helder', 'Enkhuizen', 'Alphen aan den Rijn',
        'Noordwijk', 'Katwijk', 'Beverwijk', 'Heerhugowaard', 'Zwolle', 'Apeldoorn', 'Arnhem', 'Nijmegen', 'Eindhoven', 'Dordrecht', 'Harderwijk', 'Lisse', 'Velsen'}
towns = []
for e in J('towns'):
    t = e.get('tags', {}); nm = t.get('name')
    if e['type'] != 'node' or not nm or not (S <= e['lat'] <= N and W <= e['lon'] <= E): continue
    if nm in KEEP or t.get('place') == 'city':
        towns.append(['DEN HAAG' if nm in ("'s-Gravenhage", 'Den Haag') else nm.upper(), round(e['lon'], 4), round(e['lat'], 4)])
aps = []
for e in J('airports'):
    ic = e.get('tags', {}).get('icao'); c = e if 'lat' in e else e.get('center')
    if ic and ic != 'EHAM' and c and S <= c['lat'] <= N and W <= c['lon'] <= E and not any(a[0] == ic for a in aps): aps.append([ic, round(c['lon'], 4), round(c['lat'], 4)])
borders = []
for e in J('borders'):
    if e.get('tags', {}).get('maritime') == 'yes' or not e.get('geometry'): continue
    l = LineString([(g['lon'], g['lat']) for g in e['geometry']]).intersection(BB.buffer(-1e-6))
    for g in (list(l.geoms) if hasattr(l, 'geoms') else [l]):
        if g.geom_type == 'LineString' and g.length > 0.01 and not g.within(water): borders.append([[round(x, 5), round(y, 5)] for x, y in g.simplify(0.0005).coords])
out = {'land': out_land, 'coast': shore, 'borders': borders, 'towns': towns, 'airports': aps}
json.dump(out, open(OUT, 'w'), separators=(',', ':'))
print({k: len(v) for k, v in out.items()}, 'bytes', len(json.dumps(out)))
