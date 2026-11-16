# Newcastle (EGNT): what the ground layout is read from, straight off the UK AIP charts.
#   AD 2-EGNT-2-1 (aerodrome chart, 526110.pdf): the runway, the taxiway and apron pavement, the holding point bars and names
#   AD 2-EGNT-2-2 (parking/docking chart, 526113.pdf): the painted taxiway centrelines, stand lead-in lines and T-bars, the
#   stand coordinate table, the holding point bars, the buildings
# Both charts are georeferenced in metres east and north of the ARP (550217N 0014123W): the parking chart by a similarity
# fitted to its 36 stands' published coordinates at the end of each stand's painted line (rms 0.8 m), the aerodrome chart by
# the two published thresholds (07 550202.35N 0014216.68W, 25 550230.46N 0014030.76W). Where the two overlap they agree to
# about 2 m.
import re, math, json, subprocess, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pdfvec import load
ARP = (55 + 2/60 + 17/3600, -(1 + 41/60 + 23/3600))
KX = 60*1852*math.cos(math.radians(ARP[0])); KY = 60*1852
def dms(s):
    m = re.match(r'^(\d{2,3})(\d{2})(\d{2}(?:\.\d+)?)([NSEW])$', s); v = int(m[1]) + int(m[2])/60 + float(m[3])/3600
    return -v if m[4] in 'SW' else v
def en(la, lo): return ((dms(lo) - ARP[1])*KX, (dms(la) - ARP[0])*KY)
THR = {'07': en('550202.35N', '0014216.68W'), '25': en('550230.46N', '0014030.76W')}
def fit_sim(src, dst):
    # e = a*x + b*y + tx, n = b*x - a*y + ty (the chart's y runs down the page)
    A, B = [], []
    for (x, y), (e, n) in zip(src, dst): A += [[x, y, 1, 0], [-y, x, 0, 1]]; B += [e, n]
    return list(np.linalg.lstsq(np.array(A), np.array(B), rcond=None)[0])
def ap(sol, p):
    a, b, tx, ty = sol; x, y = p; return (a*x + b*y + tx, b*x - a*y + ty)
yellow = lambda c: bool(c) and c[0] > 0.9 and c[1] > 0.85 and c[2] < 0.35
near = lambda c: (lambda f: bool(f) and all(abs(a - b) < 0.035 for a, b in zip(f, c)))
class Charts:
    def __init__(self, adc_pdf, park_pdf):
        raw = subprocess.run(['pdftotext', '-raw', park_pdf, '-'], capture_output=True, text=True).stdout
        self.stands = {m[1]: en(m[2], m[3]) for m in re.finditer(r'^(\d+[LR]?) (\d{6}\.\d+N) (\d{7}\.\d+W)$', raw, re.M)}
        pdr, pwords, _ = load(park_pdf); adr, awords, _ = load(adc_pdf)
        # parking chart: first fit on the stand numbers' label positions, then on the end of each stand's painted line
        lab = {}
        for w in pwords:
            if w[0] in self.stands and abs(w[3] - 7.7) < 0.2 and w[0] not in lab: lab[w[0]] = (w[1], w[2])
        ks = sorted(lab); sol = fit_sim([lab[k] for k in ks], [self.stands[k] for k in ks])
        ysegs = [p for g in pdr if g['type'] == 's' and yellow(g['color']) for p in g['paths']]
        a_, b_, tx, ty = sol; Mi = np.linalg.inv(np.array([[a_, b_], [b_, -a_]]))
        for _ in range(3):
            src, dst = [], []
            for k, e in self.stands.items():
                q = Mi @ np.array([e[0] - sol[2], e[1] - sol[3]]); best = None
                for p in ysegs:
                    if sum(math.dist(p[i], p[i+1]) for i in range(len(p)-1)) < 12: continue
                    for t in (p[0], p[-1]):
                        d = math.dist(t, q)
                        if best is None or d < best[0]: best = (d, t)
                if best[0] < 8: src.append(best[1]); dst.append(e)
            sol = fit_sim(src, dst); Mi = np.linalg.inv(np.array([[sol[0], sol[1]], [sol[1], -sol[0]]]))
        err = [math.dist(ap(sol, s), d) for s, d in zip(src, dst)]
        self.park_fit = dict(n=len(src), rms=round(float(np.sqrt(np.mean(np.square(err)))), 2), max=round(max(err), 2))
        self.sol_p = sol
        self.sol_a = fit_sim([self._thr_mark(adr)[k] for k in ('07', '25')], [THR['07'], THR['25']])
        P = lambda p: ap(self.sol_p, p); A = lambda p: ap(self.sol_a, p)
        # painted centrelines and stand lines (parking chart): [{pts, L}]
        self.lines = []
        for g in pdr:
            if g['type'] == 's' and yellow(g['color']):
                for p in g['paths']:
                    q = [P(x) for x in p]; L = sum(math.dist(q[i], q[i+1]) for i in range(len(q)-1))
                    self.lines.append({'pts': q, 'L': L, 'closed': math.dist(q[0], q[-1]) < 0.5})
        # holding point bars: yellow filled dashes in clusters, on both charts, named by the nearest sign
        self.pdr, self.adr, self.pwords, self.awords = pdr, adr, pwords, awords
        self.bars_p = self._bars(pdr, pwords, P); self.bars_a = self._bars(adr, awords, A)
    def _thr_mark(self, adr):
        # the orange threshold symbols (the "Rwy 07/25 Thr" callout circles) on the aerodrome chart
        cs = []
        for g in adr:
            if g['fill'] and abs(g['fill'][0] - 0.89) < 0.04 and abs(g['fill'][1] - 0.63) < 0.04:
                for p in g['paths']:
                    xs = [q[0] for q in p]; ys = [q[1] for q in p]
                    if 40 < len(p) < 90 and 4 < max(xs) - min(xs) < 5.5: cs.append((sum(xs)/len(xs), sum(ys)/len(ys)))
        cs.sort(); return {'07': cs[0], '25': cs[-1]}
    def _bars(self, dr, words, T, names=None):
        from shapely.geometry import Polygon
        from shapely.ops import unary_union
        P = []
        for g in dr:
            if g['type'] in ('f', 'fs') and yellow(g['fill']):
                for p in g['paths']:
                    if len(p) >= 4:
                        try:
                            q = Polygon([T(x) for x in p]).buffer(0)
                            if 0.5 < q.area < 40: P.append(q)
                        except Exception: pass
        U = unary_union([p.buffer(3) for p in P]); gs = list(U.geoms) if hasattr(U, 'geoms') else [U]
        lab = [(w[0], T((w[1], w[2]))) for w in words if re.match(r'^(A[1-5]|B2?|C[WE]|D[1-8]|[EFG])$', w[0]) and 6.3 < w[3] < 7.0]
        out = []
        for g in gs:
            mem = [p for p in P if g.contains(p.centroid)]
            if len(mem) < 3: continue
            pts = np.array([c for p in mem for c in p.exterior.coords]); c = pts.mean(0)
            u, s, vt = np.linalg.svd(pts - c); L = (pts - c) @ vt[0]
            nm = min(lab, key=lambda l: math.dist(l[1], c))[0] if lab else None
            out.append({'name': nm, 'c': (float(c[0]), float(c[1])), 'ax': (float(vt[0][0]), float(vt[0][1])), 'len': float(L.max() - L.min()),
                        'pts': [tuple(map(float, q)) for q in pts]})
        return out
    def polys(self, which, test):
        from shapely.geometry import Polygon
        dr, T = (self.adr, lambda p: ap(self.sol_a, p)) if which == 'adc' else (self.pdr, lambda p: ap(self.sol_p, p))
        out = []
        for g in dr:
            if g['type'] in ('f', 'fs') and g['fill'] and test(g['fill']):
                for p in g['paths']:
                    if len(p) >= 4:
                        try:
                            q = Polygon([T(x) for x in p]).buffer(0)
                            if q.area > 1: out.append(q)
                        except Exception: pass
        return out
    def pave_mask(self, box=(-1300, -700, 1150, 700)):
        """the aerodrome chart's taxiway and apron pavement, 1 m cells, drawn in the chart's order with its even-odd fills
        (the grass islands inside the taxiways stay grass)"""
        from skimage.draw import polygon as dpoly
        X0, Y0, X1, Y1 = box; W, H = X1 - X0, Y1 - Y0; M = np.zeros((H, W), bool)
        for g in self.adr:
            if g['type'] not in ('f', 'fs') or not g['fill']: continue
            f = g['fill']
            if near((0.85, 0.76, 0.65))(f) or near((0.83, 0.84, 0.84))(f): k = True
            elif f == (1.0, 1.0, 1.0) or near((0.62, 0.78, 0.71))(f) or near((0.46, 0.49, 0.5))(f): k = False
            else: continue
            Z = np.zeros((H, W), bool)
            for p in g['paths']:
                if len(p) < 4: continue
                q = [ap(self.sol_a, x) for x in p]
                rr, cc = dpoly([Y1 - y for x, y in q], [x - X0 for x, y in q], (H, W)); Z[rr, cc] ^= True
            M[Z] = k
        return M, box
def skeleton_branches(M, box, eps=0.8):
    """the medial lines of the pavement mask, traced into branches between junctions and ends (metres)"""
    from skimage.morphology import skeletonize
    sk = skeletonize(M); X0, Y0, X1, Y1 = box
    pix = set(zip(*np.nonzero(sk)))
    nb = lambda p: [(p[0] + a, p[1] + b) for a in (-1, 0, 1) for b in (-1, 0, 1) if (a or b) and (p[0] + a, p[1] + b) in pix]
    nodes = {p for p in pix if len(nb(p)) != 2}; seen = set(); out = []
    xy = lambda r, c: (c + X0 + 0.5, Y1 - r - 0.5)
    def rdp(pts):
        if len(pts) < 3: return pts
        a, b = pts[0], pts[-1]; dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy) or 1
        d = [abs(dx*(p[1] - a[1]) - dy*(p[0] - a[0]))/L for p in pts]; i = int(np.argmax(d))
        return rdp(pts[:i+1])[:-1] + rdp(pts[i:]) if d[i] > eps else [a, b]
    for s in nodes:
        for n in nb(s):
            path = [s, n]; prev, cur = s, n
            while cur not in nodes:
                nx = [q for q in nb(cur) if q != prev and q not in path[-3:]]
                if not nx: break
                prev, cur = cur, nx[0]; path.append(cur)
            key = frozenset([path[0], path[-1], path[len(path)//2]])
            if key in seen: continue
            seen.add(key); out.append(rdp([xy(*p) for p in path]))
    return out
