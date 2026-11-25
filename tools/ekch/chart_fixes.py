# usage: python3 tools/ekch/chart_fixes.py known.json chartfix2.json (the Jeppesen trip kit at /mnt/user-data/uploads)
# Fix positions off the Jeppesen SID/STAR/approach charts: each chart's fix symbols (the RNAV star, the VOR/DME box,
# the triangle), each fix label matched to the nearest symbol, an affine fit from the fixes of known position on the
# page to their lat/lon (equirectangular about Copenhagen), then every unknown fix on the page placed by it.
import pymupdf, json, re, math, sys, collections
import numpy as np
K = json.load(open(sys.argv[1] if len(sys.argv) > 1 else 'known.json'))
LAT0 = 55.62; KX = math.cos(math.radians(LAT0))
d = pymupdf.open('/mnt/user-data/uploads/59a48669-EKCH.pdf')
FIXRE = re.compile(r'^(CH\d[\d~]\d|[A-Z]{5}|[A-Z]{3})[,.]?$')
out = collections.defaultdict(list); report = []
pages = list(range(13, 62)) + list(range(74, 85))
for pn in pages:
    p = d[pn - 1]
    syms = []
    for g in p.get_drawings():
        r = g['rect']; n = len(g['items'])
        if 9 <= r.width <= 16 and 9 <= r.height <= 16 and n in (8, 4, 3, 12, 6, 16):
            syms.append(((r.x0 + r.x1)/2, (r.y0 + r.y1)/2, n))
    words = [(w[4].rstrip(',.'), (w[0] + w[2])/2, (w[1] + w[3])/2) for w in p.get_text('words')]
    labs = [(t.replace('~', '0'), x, y) for t, x, y in words if FIXRE.match(t) and t not in ('RWY', 'MAX', 'KT', 'SID', 'ATC', 'ALL', 'LOST', 'COMMS', 'RNAV', 'GNSS', 'DME', 'VOR', 'NDB', 'ILS', 'LOC', 'MSA', 'ARP', 'THR', 'FAF', 'IAF', 'MAP', 'APT', 'TWR', 'GND', 'ACFT', 'LEFT', 'RIGHT', 'BELOW', 'ABOVE', 'CHANGES', 'ROUTING', 'SPEED', 'NOT', 'AVBL', 'FOR', 'SCALE', 'TO', 'THE', 'AND', 'VIA', 'THEN', 'DIRECT', 'TURN', 'CLIMB', 'CROSS', 'LSMD', 'LSZH', 'EDNY', 'LFSB', 'LSZR')]
    # one symbol per label: the nearest within 30 pt
    pts = {}
    for t, x, y in labs:
        if not syms: break
        s = min(syms, key=lambda s: math.hypot(s[0] - x, s[1] - y))
        dd = math.hypot(s[0] - x, s[1] - y)
        if dd < 32 and (t not in pts or dd < pts[t][2]): pts[t] = (s[0], s[1], dd)
    kn = [(t, v) for t, v in pts.items() if t in K and abs(K[t][0] - LAT0) < 1.5 and abs(K[t][1] - 12.65) < 3.5]
    if len(kn) < 3: report.append((pn, 'too few known', [t for t, _ in kn])); continue
    A = np.array([[v[0], v[1], 1] for t, v in kn]); B = np.array([[(K[t][1] - 12.65)*60*KX, (K[t][0] - LAT0)*60] for t, v in kn])
    # robust: drop the worst point while the residual is big
    use = list(range(len(kn)))
    for it in range(4):
        X, *_ = np.linalg.lstsq(A[use], B[use], rcond=None); res = np.linalg.norm(A @ X - B, axis=1)
        worst = max(use, key=lambda i: res[i])
        if res[worst] > 0.6 and len(use) > 4: use.remove(worst)
        else: break
    rms = float(np.sqrt(np.mean(res[use]**2)))
    report.append((pn, 'fit', len(use), 'of', len(kn), 'rms NM', round(rms, 2), 'dropped', [kn[i][0] for i in range(len(kn)) if i not in use]))
    for t, v in pts.items():
        e, n = np.array([v[0], v[1], 1]) @ X
        out[t].append((pn, LAT0 + n/60, 12.65 + e/60/KX, rms, len(use)))
for r in report: print(*r)
res = {}
for t, L in sorted(out.items()):
    L = [l for l in L if l[3] < 0.5]
    if not L: continue
    la = float(np.median([l[1] for l in L])); lo = float(np.median([l[2] for l in L]))
    sp = max(math.hypot((l[1] - la)*60, (l[2] - lo)*60*KX) for l in L)
    k = K.get(t); err = round(math.hypot((k[0] - la)*60, (k[1] - lo)*60*KX), 2) if k else None
    res[t] = [round(la, 5), round(lo, 5), len(L), round(sp, 2), err]
json.dump(res, open(sys.argv[2] if len(sys.argv) > 2 else 'chartfix.json', 'w'), indent=0)
for t, v in res.items(): print(t, v)
