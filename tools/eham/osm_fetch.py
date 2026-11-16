# Schiphol's aerodrome from OpenStreetMap -> one JSON in Overpass "out geom" shape (what tools/eham_ground.py and
# tools/vehicles_osm.py read): every node, way and relation in the box, ways and relation members with their geometry.
# usage: python3 tools/eham/osm_fetch.py out.json
# The OSM editing API's map call (https://api.openstreetmap.org/api/0.6/map) is used in tiles of 0.02° x 0.019°; a tile
# with more than its 50,000-node limit (the terminal, the A4 and A9 junctions) is split in four and fetched again.
import json, sys, time, urllib.request, urllib.error
import xml.etree.ElementTree as ET
W, E, S, N = 4.695, 4.835, 52.270, 52.384
UA = {'User-Agent': 'clearway-atc tools/eham/osm_fetch.py'}
nodes, ways, rels = {}, {}, {}
def tags(el): return {t.get('k'): t.get('v') for t in el.findall('tag')}
def fetch(w, s, e, n, depth=0):
    url = f'https://api.openstreetmap.org/api/0.6/map?bbox={w:.5f},{s:.5f},{e:.5f},{n:.5f}'
    for attempt in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=180) as r: data = r.read(); break
        except urllib.error.HTTPError as x:
            if x.code == 400 and depth < 4:   # too many nodes: four smaller tiles
                mx, my = (w + e)/2, (s + n)/2
                for b in ((w, s, mx, my), (mx, s, e, my), (w, my, mx, n), (mx, my, e, n)): fetch(*b, depth + 1)
                return
            if attempt == 3: raise
            time.sleep(5*(attempt + 1))
        except urllib.error.URLError:
            if attempt == 3: raise
            time.sleep(5*(attempt + 1))
    root = ET.fromstring(data)
    for el in root:
        i = int(el.get('id', 0))
        if el.tag == 'node': nodes[i] = {'type': 'node', 'id': i, 'lat': float(el.get('lat')), 'lon': float(el.get('lon')), **({'tags': tags(el)} if el.find('tag') is not None else {})}
        elif el.tag == 'way': ways[i] = {'type': 'way', 'id': i, 'nodes': [int(nd.get('ref')) for nd in el.findall('nd')], 'tags': tags(el)}
        elif el.tag == 'relation': rels[i] = {'type': 'relation', 'id': i, 'members': [{'type': m.get('type'), 'ref': int(m.get('ref')), 'role': m.get('role')} for m in el.findall('member')], 'tags': tags(el)}
    print(f'tile {w:.3f},{s:.3f}: {len(nodes)} nodes {len(ways)} ways', file=sys.stderr)
x = W
while x < E - 1e-9:
    y = S
    while y < N - 1e-9:
        fetch(x, y, min(E, x + 0.02), min(N, y + 0.019)); y += 0.019; time.sleep(1)
    x += 0.02
out = []
for w in ways.values():
    if all(n in nodes for n in w['nodes']): w['geometry'] = [{'lat': nodes[n]['lat'], 'lon': nodes[n]['lon']} for n in w['nodes']]
    out.append(w)
for r in rels.values():
    for m in r['members']:
        if m['type'] == 'way' and m['ref'] in ways and 'geometry' in ways[m['ref']]: m['geometry'] = ways[m['ref']]['geometry']
    out.append(r)
json.dump({'elements': list(nodes.values()) + out}, open(sys.argv[1], 'w'))
print('nodes', len(nodes), 'ways', len(ways), 'relations', len(rels), file=sys.stderr)
