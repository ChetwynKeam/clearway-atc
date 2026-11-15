# Replace an airport ground file's apron outlines with OpenStreetMap's (closed aeroway=apron ways and the outer rings of
# apron multipolygons), calibrated to the file's own frame by its runway ends.
# usage: python3 tools/osm_aprons.py osm.json src/airports/<icao>-ground.js LAT0 LON0
# LAT0/LON0: the frame origin the file's header names (degrees). The offset between the file's runway ends and OSM's,
# projected about that origin, is measured and applied, so the aprons line up with the runways and stands already there.
import json, math, re, sys
osm, path, lat0, lon0 = sys.argv[1], sys.argv[2], float(sys.argv[3]), float(sys.argv[4])
E = json.load(open(osm))['elements']
en = lambda la, lo: ((lo - lon0)*60*1852*math.cos(math.radians(lat0)), (la - lat0)*60*1852)
src = open(path).read()
# calibration: each runway's pavement ends in the file against the nearest OSM runway end
rw = json.loads(re.search(r'runways: (\[.*?\]),\n', src).group(1))
ends = [en(p['lat'], p['lon']) for e in E if e['type'] == 'way' and e.get('tags', {}).get('aeroway') == 'runway' for p in (e['geometry'][0], e['geometry'][-1])]
dx, dy, n = 0, 0, 0
for r in rw:
    for P in (r['a'], r['b']):
        q = min(ends, key=lambda q: (q[0]-P[0])**2 + (q[1]-P[1])**2)
        if math.hypot(q[0]-P[0], q[1]-P[1]) < 60: dx += P[0] - q[0]; dy += P[1] - q[1]; n += 1
dx, dy = dx/max(n, 1), dy/max(n, 1)
print(f'calibrated on {n} runway ends: offset {dx:.1f} m east, {dy:.1f} m north')
rings = []
for e in E:
    t = e.get('tags', {})
    if t.get('aeroway') != 'apron': continue
    if e['type'] == 'way' and e['geometry'][0] == e['geometry'][-1]: rings.append(e['geometry'])
    elif e['type'] == 'relation':
        for m in e.get('members', []):
            if m.get('role') == 'outer' and 'geometry' in m: rings.append(m['geometry'])
out = [[[round(x + dx, 1), round(y + dy, 1)] for x, y in (en(p['lat'], p['lon']) for p in g)] for g in rings]
new = 'aprons: ' + json.dumps(out, separators=(',', ':'))
src2, k = re.subn(r'aprons: \[\[\[.*?\]\]\]', lambda m: new, src, count=1, flags=re.S)
if not k: sys.exit('no aprons array found')
open(path, 'w').write(src2)
print(f'{len(out)} apron rings, {sum(len(r) for r in out)} points')
