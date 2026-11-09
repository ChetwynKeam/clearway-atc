#!/usr/bin/env python3
"""The named intermediate holding points of the OMDB stop bar chart (AD 2-26) -> tools/omdb/ihps_chart.json.
usage: chart_ihps.py OMDB-AD-2-26.pdf
Needs poppler (pdftotext, pdftoppm), numpy, scipy and Pillow.
1. The chart's words with their positions (pdftotext -bbox); each holding point label is classed by the colour behind it
   in a 300 dpi rendering: red boxes are intermediate holding points, black ones runway holding points (taxiway names)
   or the CAT II/III-style full stop bars (KH, KJ, LA, LB, MA, MS, NC, NP, PA, TC, KZA).
2. The stop bars themselves: rows of small red dots in the rendering, clustered; each label takes the bar nearest it.
3. Georeferenced to the runways' published ends: the chart is drawn with the runways level, and their pavement ends found
   in the rendering give an affine fit good to about 4 m (metres east/north of the ARP, as omdb_ground.py).
A few bars the dot finder misses (a black "no sign" dot in the middle breaks them up, or two bars run together) are
read off the chart by eye: MANUAL, in rendering pixels."""
import sys, re, json, math, os, subprocess, tempfile, collections
import numpy as np
from PIL import Image
from scipy import ndimage
from scipy.cluster.hierarchy import fcluster, linkage
from scipy.optimize import linear_sum_assignment
Image.MAX_IMAGE_PIXELS = None
PDF = sys.argv[1]; HERE = os.path.dirname(os.path.abspath(__file__)); TMP = tempfile.mkdtemp()
A = (25 + 15/60 + 10/3600, 55 + 21/60 + 52/3600); KX = 60*1852*math.cos(math.radians(A[0])); KY = 60*1852
def dms(s):
    s = s[:-1]; a, fr = (s.split('.')[0], '.' + s.split('.')[1]) if '.' in s else (s, '')
    return int(a[:-4]) + int(a[-4:-2])/60 + float(a[-2:] + fr)/3600
en = lambda la, lo: ((dms(lo) - A[1])*KX, (dms(la) - A[0])*KY)
subprocess.run(['pdftotext', '-bbox', PDF, TMP + '/w.html'], check=True)
subprocess.run(['pdftoppm', '-r', '300', '-png', PDF, TMP + '/c'], check=True)
im = Image.open(TMP + '/c-1.png').convert('RGB'); px = im.load(); K = 300/72
W = [(float(a), float(b), float(c), float(d), w) for a, b, c, d, w in re.findall(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>', open(TMP + '/w.html').read())]
# ── georeference: the runways' pavement ends (AD 2.12 "RWY end"), found in the rendering at the 300 dpi pixels below
CP = [((755, 1325), en('251600.28N', '0552047.76E')), ((5493, 1325), en('251446.67N', '0552300.51E')),
      ((2525, 1741), en('251522.30N', '0552129.92E')), ((7350, 1741), en('251407.06N', '0552345.61E'))]
M, *_ = np.linalg.lstsq(np.c_[np.array([c[0] for c in CP], float), np.ones(4)], np.array([c[1] for c in CP]), rcond=None)
px2en = lambda x, y: tuple(float(v) for v in np.array([x, y, 1.0]) @ M)
# ── labels
labels = []
for x0, y0, x1, y1, w in W:
    # (a red box round a taxiway's own name, J, J5 or V, is a no-entry or closure note; Q11 is a stand)
    if not re.fullmatch(r'[J-Z]{1,3}\d{0,2}[A-Z]?', w) or w in ('X', 'R1', 'J', 'J5', 'V', 'Q11'): continue
    c = collections.Counter()
    for xx in range(int(x0*K), int(x1*K)):
        for yy in range(int(y0*K), int(y1*K)):
            r, g, b = px[xx, yy]
            if r > 180 and g < 80 and b < 80: c['red'] += 1
            elif r < 50 and g < 50 and b < 50: c['black'] += 1
            elif r > 200 and g > 150 and b < 80: c['yellow'] += 1
    tot = sum(c.values()) or 1
    kind = 'RED' if c['red'] > 0.25*tot else 'BLK' if c['black'] > 0.25*tot and c['yellow'] > 0.1*tot else None
    if kind and not (kind == 'BLK' and re.fullmatch(r'[KMN]\d{1,2}[A-C]?', w)): labels.append((w, kind, (x0 + x1)/2*K, (y0 + y1)/2*K))
# the legend's sample label (UD, far from the field) is not a holding point
labels = [l for l in labels if not (l[0] == 'UD' and l[3] < 1000)]
# ── stop bars: rows of small red dots
a = np.asarray(im).astype(int); red = (a[..., 0] > 190) & (a[..., 1] < 90) & (a[..., 2] < 90)
lab, n = ndimage.label(red); sl = ndimage.find_objects(lab); area = ndimage.sum(red, lab, range(1, n + 1)); cen = ndimage.center_of_mass(red, lab, range(1, n + 1))
dots = np.array([(c[1], c[0]) for c, ar, s in zip(cen, area, sl) if 15 <= ar <= 220 and s[0].stop - s[0].start < 22 and s[1].stop - s[1].start < 22])
cl = fcluster(linkage(dots, 'single'), 32, 'distance')
bars = [dots[cl == k].mean(0) for k in set(cl) if (cl == k).sum() >= 3]
C = np.full((len(labels), len(bars)), 1e6)
for i, (w, k, x, y) in enumerate(labels):
    for j, b in enumerate(bars):
        d = math.dist((x, y), b)
        if d < 180: C[i, j] = d
ri, ci = linear_sum_assignment(C)
pos = collections.defaultdict(list)
for i, j in zip(ri, ci):
    if C[i, j] <= 80: pos[labels[i][0]].append(tuple(bars[j]))   # matched further off than that: the wrong bar
# read off the chart by eye (rendering pixels): bars the dot finder runs together or breaks up
MANUAL = {'PD': (2033, 1005), 'NE': (2033, 1100), 'ZA': (601, 2131), 'Z1A': (535, 2216), 'UD': (3251, 2568), 'QB': (4012, 962), 'QA': (4014, 860),
          'KB': (596, 2024), 'MN': (5275, 1533), 'ZN': (4270, 2053), 'P9A': (5205, 797)}
for k, p in MANUAL.items(): pos[k] = [p]
# KP and NQ: the dot finder hands them a neighbour's bar (NQ's is the unnamed bar on P8 north of N; NQ's own is across
# N west of P8); their own, in metres from the ARP, read off the chart
MANUAL_EN = {'KP': [602.0, -705.6], 'NQ': [1634.0, -321.0]}
# KY, NM, NS and PL: no bar of their own found (it runs into the next one); matched to OpenStreetMap's stop line by the label
for k in ('KY', 'NM', 'NS', 'PL'): pos[k] = []
out = {}
for w, k, x, y in labels:
    o = out.setdefault(w, {'label': [], 'bars': [], 'full': k == 'BLK'})
    o['label'].append([round(c, 1) for c in px2en(x, y)])
    for p in ([None] if w in MANUAL_EN else pos.get(w, [])):
        e = MANUAL_EN[w] if w in MANUAL_EN else [round(c, 1) for c in px2en(*p)]
        if e not in [b['p'] for b in o['bars']]: o['bars'].append({'p': e, 'ax': [0, 0], **({'manual': True} if w in MANUAL or w in MANUAL_EN else {})})
print(len(out), 'holding points;', 'no bar found:', sorted(k for k, v in out.items() if not v['bars']))
json.dump(out, open(os.path.join(HERE, 'ihps_chart.json'), 'w'), indent=0, sort_keys=True)
