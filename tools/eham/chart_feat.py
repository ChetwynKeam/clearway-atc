# Amsterdam Schiphol (EHAM): read the Dutch AIP's aerodrome ground movement chart (AD 2 EHAM GMC-1, AIRAC AMDT 12/2026)
# -> tools/eham/chart.json: every holding position's row of stop bar lights and every taxiway name, in metres east and
# north of the ARP (521829N 0044551E), for tools/eham_ground.py.
# usage: python3 tools/eham/chart_feat.py EHAM-GMC.pdf tools/eham/chart.json   (needs pymupdf, numpy, scipy)
# 1. Georeference. The chart is drawn at 1:20,000, north up. The runway pavements are grey polygons; the two whose
#    drawn length matches the AIP (18R/36L 3,800 m and 04/22 2,020 m: the others are drawn with their blast pads) are
#    fitted end to end to the AIP's pavement-end coordinates (AD 2.12) with a similarity transform: 7.04 m a point,
#    0.46 degrees of rotation, the four ends within 3.3 m. Checked on the other two: the 18C end and the 06 end within 3 m.
# 2. Holding positions: on this chart every stop bar is a row of small black dots across the taxiway. The dots are
#    clustered into rows (single linkage, 4.5 points), each row kept as its dots' positions.
# 3. Names: every word that is a taxiway or holding point designator (A, A19W, S7E, VK ...), at its centre.
# The insets (P6/P7 remote holding, hot spots HS1-HS3, the A30 R-apron inset) are drawn at another scale elsewhere on the
# sheet: anything inside them is dropped.
import pymupdf, numpy as np, math, re, json, sys
from scipy.cluster.hierarchy import fcluster, linkage
PDF, OUT = sys.argv[1:3]
A = (52 + 18/60 + 29/3600, 4 + 45/60 + 51/3600)
KX = 60*1852*math.cos(math.radians(A[0])); KY = 60*1852
def dms(s):
    m = re.match(r'^(\d{2,3})(\d{2})(\d{2}(?:\.\d+)?)([NSEW])$', s); v = int(m[1]) + int(m[2])/60 + float(m[3])/3600
    return -v if m[4] in 'SW' else v
P = lambda la, lo: ((dms(lo) - A[1])*KX, (dms(la) - A[0])*KY)
ENDS = {3800: (P('522145.65N', '0044243.01E'), P('521942.88N', '0044231.81E')),     # 18R/36L: north end, 36L threshold
        2020: (P('521801.35N', '0044700.55E'), P('521850.51N', '0044810.90E'))}     # 04/22: the two thresholds
pg = pymupdf.open(PDF)[0]
polys = []
for d in pg.get_drawings():
    if tuple(round(x, 2) for x in (d.get('fill') or ())) != (0.9, 0.91, 0.91): continue
    pts = []
    for it in d['items']:
        for p in it[1:]:
            if hasattr(p, 'x'): pts.append((p.x, p.y))
            elif hasattr(p, 'x0'): pts += [(p.x0, p.y0), (p.x1, p.y1), (p.x0, p.y1), (p.x1, p.y0)]
    pts = np.array(pts)
    if len(pts) < 3: continue
    c = pts - pts.mean(0); _, _, vt = np.linalg.svd(c, full_matrices=False); a = c @ vt[0]
    if np.ptp(a) > 150 and np.ptp(c @ vt[1]) < 20: polys.append((np.ptp(a)*7.04, pts[a < a.min() + 1].mean(0), pts[a > a.max() - 1].mean(0)))
src, dst = [], []
for L0, (n_end, s_end) in ENDS.items():
    L, e0, e1 = min(polys, key=lambda q: abs(q[0] - L0))
    north, south = (e0, e1) if e0[1] < e1[1] else (e1, e0)
    hi, lo = (n_end, s_end) if n_end[1] > s_end[1] else (s_end, n_end)
    src += [north, south]; dst += [hi, lo]
M, rhs = [], []
for (x, y), (e, n) in zip(src, dst): M += [[x, y, 1, 0], [-y, x, 0, 1]]; rhs += [e, n]
a_, b_, tx, ty = np.linalg.lstsq(np.array(M, float), np.array(rhs, float), rcond=None)[0]
tr = lambda x, y: (a_*x + b_*y + tx, b_*x - a_*y + ty)
res = [math.dist(tr(*s), d) for s, d in zip(src, dst)]
print('scale %.3f m/pt, rotation %.2f deg, ends within %.1f m' % (math.hypot(a_, b_), math.degrees(math.atan2(b_, a_)), max(res)))
INSETS = [('box', 196, 262, 537, 563), ('box', 320, 1139, 452, 1237), ('circ', 229, 851, 85), ('circ', 1014, 694, 85), ('circ', 177, 1145, 100)]
def in_inset(x, y):
    for s in INSETS:
        if s[0] == 'box' and s[1] <= x <= s[3] and s[2] <= y <= s[4]: return True
        if s[0] == 'circ' and math.dist((x, y), s[1:3]) <= s[3]: return True
    return False
dots = []
for d in pg.get_drawings():
    r = d['rect']
    if tuple(round(x, 2) for x in (d.get('fill') or ())) == (0.14, 0.12, 0.13) and 0.5 < r.width < 2.6 and r.height < 2.6 and abs(r.width - r.height) < 0.6:
        c = ((r.x0 + r.x1)/2, (r.y0 + r.y1)/2)
        if not in_inset(*c): dots.append(c)
dots = np.array(dots); cl = fcluster(linkage(dots, 'single'), 4.5, 'distance')
rows = [[[round(v, 1) for v in tr(*p)] for p in dots[cl == k]] for k in sorted(set(cl)) if (cl == k).sum() >= 2]
STOP = {'AD', 'AIP', 'ARE', 'AT', 'BE', 'BY', 'CL', 'FT', 'IN', 'IS', 'OF', 'ON', 'OR', 'TO', 'I', 'II', 'III', 'ATC', 'RTF', 'THE', 'USE', 'VIA',
        'MAY', 'NOT', 'ALL', 'AND', 'BAR', 'BTN', 'END', 'RWY', 'TWY', 'MAX', 'GMC', 'VAR', 'NOV', 'ARP', 'DEG', 'REF', 'INS', 'LAT', 'FOR', 'HS1', 'HS2', 'HS3'}
words = []
for w in pg.get_text('words'):
    t = w[4]; c = ((w[0] + w[2])/2, (w[1] + w[3])/2)
    if re.fullmatch(r'[A-Z]{1,2}\d{0,2}[A-Z]?', t) and t not in STOP and not in_inset(*c): words.append([t] + [round(v, 1) for v in tr(*c)])
json.dump({'source': 'AIP Netherlands AD 2 EHAM GMC-1, AIRAC AMDT 12/2026 (26 NOV 2026)', 'rows': rows, 'words': words}, open(OUT, 'w'), separators=(',', ':'))
print(len(rows), 'stop bars,', len(words), 'names')
