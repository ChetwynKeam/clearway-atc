# Edinburgh (EGPH): read the AIP parking/docking chart (AD 2-EGPH-2-2) against OpenStreetMap -> tools/egph/chart_fix.json
# usage: python3 tools/egph/chart_fix.py AD2-EGPH-2-2.pdf aerodrome.json tools/egph/chart_fix.json   (needs pymupdf, scipy)
# 1. The chart is rendered at 250 dpi and georeferenced: an affine fit of OpenStreetMap's taxiway and stand centrelines
#    to the chart's yellow centreline paint (ICP, from a first fit of the stand labels to the AIP stand coordinates).
#    Median miss after the fit: 1 px (0.5 m).
# 2. Taxiway nodes OpenStreetMap has more than 2.5 m off the painted centreline (taxiway G along the Southeast and
#    Midfield aprons: the stand lead-in junctions added later sit about 4.5 m south of the line, so G zigzags) are moved
#    onto the paint: { node id: [de, dn] }.
# 3. P1 and H7, holding points on the chart that OpenStreetMap lacks: their labels' positions (the bar crosses the
#    taxiway beside the label; the generator puts them on the centreline there).
# 4. Stand headings into the stand off the chart's lead-in lines, for the stands OpenStreetMap has no line for (21 and
#    23, added in 2026; 46A and 46B) or a line more than 4 degrees off the chart's.
import pymupdf, json, re, math, sys, numpy as np
from PIL import Image
from scipy import ndimage
PDF, OSM, OUT = sys.argv[1:4]
A = (55 + 57/60, -(3 + 22/60 + 21/3600))
KX = 60*1852*math.cos(math.radians(A[0])); KY = 60*1852
en = lambda la, lo: ((lo - A[1])*KX, (la - A[0])*KY)
def dms(s):
    m = re.match(r'^(\d{2,3})(\d{2})(\d{2}(?:\.\d+)?)([NSEW])$', s); v = int(m[1]) + int(m[2])/60 + float(m[3])/3600
    return -v if m[4] in 'SW' else v
Z = 250/72; doc = pymupdf.open(PDF); pg = doc[0]; R = pg.rotation_matrix
pix = pg.get_pixmap(matrix=pymupdf.Matrix(Z, Z)); im = np.frombuffer(pix.samples, np.uint8).reshape(pix.height, pix.width, pix.n)[..., :3].astype(int)
text = pg.get_text()
ST = {k: en(dms(a), dms(b)) for k, a, b in re.findall(r'\b(\d{1,3}[A-Z]?)\s+(\d{6}\.\d{2}N)\s+(\d{7}\.\d{2}W)', text)}
words = [(w[4], *(lambda c: (c.x*Z, c.y*Z))(pymupdf.Point((w[0]+w[2])/2, (w[1]+w[3])/2)*R)) for w in pg.get_text('words')]
fit = lambda s, d: np.linalg.lstsq(np.c_[s, np.ones(len(s))], d, rcond=None)[0]
src = np.array([ST[t] for t, x, y in words if t in ST and not (x > 2180 and y < 1020) and not (x < 1320 and y < 130)]); dst = np.array([(x, y) for t, x, y in words if t in ST and not (x > 2180 and y < 1020) and not (x < 1320 and y < 130)])
T = fit(src, dst)
for it in range(3):                                                # drop the labels set well off their stand
    r = np.linalg.norm(np.c_[src, np.ones(len(src))] @ T - dst, axis=1); k = r < np.percentile(r, 85); T = fit(src[k], dst[k])
yel = (im[..., 0] > 200) & (im[..., 1] > 190) & (im[..., 2] < 120)
dt, idx = ndimage.distance_transform_edt(~yel, return_indices=True); H, W = yel.shape
E = json.load(open(OSM))['elements']
ways = [e for e in E if e['type'] == 'way' and e.get('tags', {}).get('aeroway') in ('taxiway', 'taxilane', 'parking_position')]
P = []
for e in ways:
    pts = [en(q['lat'], q['lon']) for q in e['geometry']]
    for i in range(len(pts) - 1):
        n = max(1, int(math.dist(pts[i], pts[i+1])/2))
        P += [(pts[i][0] + (pts[i+1][0]-pts[i][0])*k/n, pts[i][1] + (pts[i+1][1]-pts[i][1])*k/n) for k in range(n)]
P = np.array(P)
for it in range(40):
    q = np.c_[P, np.ones(len(P))] @ T; xi, yi = np.round(q[:, 0]).astype(int), np.round(q[:, 1]).astype(int)
    ok = (xi >= 0) & (xi < W) & (yi >= 0) & (yi < H); d = np.full(len(P), 1e9); d[ok] = dt[yi[ok], xi[ok]]
    use = ok & (d < (max(6, np.percentile(d[ok], 70)) if it < 10 else 8))
    T = fit(P[use], np.c_[idx[1][yi[use], xi[use]], idx[0][yi[use], xi[use]]])
Ti = np.linalg.inv(np.c_[T, [0, 0, 1]]); pxm = (np.linalg.norm(T[0]) + np.linalg.norm(T[1]))/2
print('fit: median miss', np.median(d[ok])/pxm, 'm')
toE = lambda X, Y: (np.array([X, Y, 1]) @ Ti)[:2]
shift = {}
for e in ways:
    if e['tags']['aeroway'] == 'parking_position': continue
    for nid, g in zip(e['nodes'], e['geometry']):
        p = en(g['lat'], g['lon']); x, y = np.array([p[0], p[1], 1]) @ T; xi, yi = int(round(x)), int(round(y))
        if not (0 <= xi < W and 0 <= yi < H) or dt[yi, xi]/pxm <= 2.5 or dt[yi, xi]/pxm > 7: continue
        q = toE(idx[1][yi, xi], idx[0][yi, xi]); shift[str(nid)] = [round(q[0] - p[0], 1), round(q[1] - p[1], 1)]
holds = {t: [round(v, 1) for v in toE(x, y)] for t, x, y in words if t in ('P1', 'H7')}
ys, xs = np.nonzero(yel); YE = np.c_[xs, ys, np.ones(len(xs))] @ Ti; YE = YE[:, :2]
def chart_hdg(p):
    v = YE - p; dd = np.linalg.norm(v, axis=1); v = v[(dd > 6) & (dd < 32)]; best = None
    for a in range(360):
        u = np.array([math.sin(math.radians(a)), math.cos(math.radians(a))]); n = ((np.abs(v[:, 0]*u[1] - v[:, 1]*u[0]) < 1.5) & (v @ u > 0)).sum()
        if best is None or n > best[0]: best = (n, a)
    return (best[1] + 180) % 360
osm_h = {}
for e in ways:
    r = e['tags'].get('ref')
    if e['tags']['aeroway'] != 'parking_position' or r not in ST: continue
    pts = [en(q['lat'], q['lon']) for q in e['geometry']]
    if math.dist(pts[0], ST[r]) < math.dist(pts[-1], ST[r]): pts = pts[::-1]
    if math.dist(pts[-1], ST[r]) < 15: osm_h[r] = math.degrees(math.atan2(pts[-1][0]-pts[-2][0], pts[-1][1]-pts[-2][1])) % 360
hdg = {}
for k, p in ST.items():
    h = chart_hdg(np.array(p))
    if k not in osm_h or abs((h - osm_h[k] + 180) % 360 - 180) > 4: hdg[k] = h
json.dump({'node_shift': shift, 'holds': holds, 'stand_hdg': hdg}, open(OUT, 'w'), indent=1)
print(len(shift), 'nodes moved;', holds, hdg)
