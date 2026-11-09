#!/usr/bin/env python3
"""The pavement of the OMDB stop bar chart (AD 2-26) as a mask -> tools/omdb/chart_pavement.png (+ .json: its frame).
usage: chart_paved.py OMDB-AD-2-26.pdf
The chart draws paved surfaces mid grey (135,135,135), grass light grey (220,220,220). Rendered at 300 dpi and
resampled onto a 3 m grid in metres east/north of the ARP (the same runway-end georeference as chart_ihps.py), with the
paint on the pavement (centrelines, stop bars, labels) counted as pavement when grey surrounds it. omdb_ground.py uses
it to fill the areas between taxiways that are paved (a mapped junction's curves enclose them) and to check that no
taxiway runs over grass."""
import sys, json, math, os, subprocess, tempfile
import numpy as np
from PIL import Image
from scipy import ndimage
Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(os.path.abspath(__file__)); TMP = tempfile.mkdtemp()
subprocess.run(['pdftoppm', '-r', '300', '-png', sys.argv[1], TMP + '/c'], check=True)
a = np.asarray(Image.open(TMP + '/c-1.png').convert('RGB')).astype(int)
A = (25 + 15/60 + 10/3600, 55 + 21/60 + 52/3600); KX = 60*1852*math.cos(math.radians(A[0])); KY = 60*1852
def dms(s):
    s = s[:-1]; i, fr = (s.split('.')[0], '.' + s.split('.')[1]) if '.' in s else (s, '')
    return int(i[:-4]) + int(i[-4:-2])/60 + float(i[-2:] + fr)/3600
en = lambda la, lo: ((dms(lo) - A[1])*KX, (dms(la) - A[0])*KY)
CP = [((755, 1325), en('251600.28N', '0552047.76E')), ((5493, 1325), en('251446.67N', '0552300.51E')),
      ((2525, 1741), en('251522.30N', '0552129.92E')), ((7350, 1741), en('251407.06N', '0552345.61E'))]
M, *_ = np.linalg.lstsq(np.c_[np.array([c[0] for c in CP], float), np.ones(4)], np.array([c[1] for c in CP]), rcond=None)
Ai = np.linalg.inv(np.c_[M, [0, 0, 1]])
grey = (abs(a[..., 0] - 135) < 14) & (abs(a[..., 1] - 135) < 14) & (abs(a[..., 2] - 135) < 14)
grass = (a[..., 0] > 205) & (a[..., 0] < 232) & (abs(a[..., 0] - a[..., 1]) < 6) & (abs(a[..., 1] - a[..., 2]) < 6)
# paint, signs and text on the pavement: anything neither grey nor grass, with grey closer than grass around it
other = ~grey & ~grass
dg = ndimage.distance_transform_edt(~grey); dgr = ndimage.distance_transform_edt(~grass)
pave = grey | (other & (dg < dgr) & (dg < 30))
E0, N0, E1, N1, R = -3200, -2700, 3900, 2300, 3.0
xs = np.arange(E0, E1, R); ys = np.arange(N1, N0, -R)
EE, NN = np.meshgrid(xs, ys)
P = np.stack([EE.ravel(), NN.ravel(), np.ones(EE.size)], 1) @ Ai
px, py = np.round(P[:, 0]).astype(int), np.round(P[:, 1]).astype(int)
ok = (px >= 0) & (py >= 0) & (px < a.shape[1]) & (py < a.shape[0])
val = np.zeros(EE.size, np.uint8)
val[ok] = np.where(pave[py[ok], px[ok]], 255, np.where(grass[py[ok], px[ok]], 0, 128))   # 255 paved, 0 grass, 128 neither
Image.fromarray(val.reshape(EE.shape)).save(os.path.join(HERE, 'chart_pavement.png'), optimize=True)
json.dump({'e0': E0, 'n1': N1, 'res': R, 'note': '255 paved, 0 grass, 128 other (buildings, runways, outside the chart)'}, open(os.path.join(HERE, 'chart_pavement.json'), 'w'))
print('grid', EE.shape, 'paved %.0f%%' % (100*(val == 255).mean()))
