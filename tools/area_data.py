"""Area Control airspace for Clearway: UK (and neighbouring) sectors, positions, fixes, navaids, airways, SIDs and STARs.

Source: the VATSIM UK sector file (github.com/VATSIM-UK/UK-Sector-File), which follows the UK AIP (ENR 2 airspace,
ENR 3 ATS routes, ENR 4 navaids and significant points, AD 2 SIDs and STARs) with the sectorisation VATSIM UK uses
for London, Scottish and Manchester Control. Clone it beside this tool (or pass its path) and run:

    python3 tools/area_data.py /path/to/UK-Sector-File

It writes src/area/area-data.js. Coordinates are rounded to 1/10,000 of a degree (about 10 m)."""
import json, math, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SF = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else '/tmp/claude-0/uksf')
# the region the game knows about: the UK and Irish FIRs and the edges of their neighbours
LAT = (47.0, 62.5); LON = (-15.0, 6.5)
inside = lambda la, lo: LAT[0] <= la <= LAT[1] and LON[0] <= lo <= LON[1]

def dm(s):
    """N051.28.39.000 → 51.4775"""
    s = s.strip(); h = s[0]; d, m, sec = s[1:].split('.', 2)
    v = int(d) + int(m)/60 + float(sec)/3600
    return -v if h in 'SW' else v

def ll(tok_lat, tok_lon): return [round(dm(tok_lat), 4), round(dm(tok_lon), 4)]

def lines(p):
    for raw in p.read_text(errors='ignore').splitlines():
        t = raw.split(';', 1)[0].rstrip()
        if t.strip(): yield t

COORD = re.compile(r'([NS]\d{3}\.\d\d\.\d\d\.\d+)\s+([EW]\d{3}\.\d\d\.\d\d\.\d+)')
COORD2 = re.compile(r'([NS]\d{3}\.\d\d\.\d\d\.\d+):([EW]\d{3}\.\d\d\.\d\d\.\d+)')

# ── fixes and navaids ──
FIX = {}
def addfix(name, la, lo, kind, over=False):
    if not inside(la, lo): return
    if name in FIX and not over: return
    FIX[name] = [round(la, 4), round(lo, 4), kind]
NAV = SF/'Navaids'
for f, kind in [('VOR_UK.txt', 'V'), ('NDB_All.txt', 'N'), ('FIXES_UK.txt', 'F')]:
    for t in lines(NAV/f):
        m = COORD.search(t)
        if m: addfix(t.split()[0], dm(m.group(1)), dm(m.group(2)), kind)
for f in sorted((NAV/'Fixes_Non-UK').glob('*.txt')) + [NAV/'VOR_Non-UK.txt']:
    for t in lines(f):
        m = COORD.search(t)
        if m: addfix(t.split()[0], dm(m.group(1)), dm(m.group(2)), 'V' if 'VOR' in f.name else 'F')

# ── airports, SIDs and STARs ──
AP, SID, STAR, APFIX = {}, {}, {}, {}
for d in sorted((SF/'Airports').iterdir()):
    if not d.is_dir() or not re.fullmatch(r'[A-Z]{4}', d.name): continue
    b = d/'Basic.txt'
    if not b.exists(): continue
    L = list(lines(b))
    m = COORD.search(L[1]) if len(L) > 1 else None
    if not m: continue
    AP[d.name] = [round(dm(m.group(1)), 4), round(dm(m.group(2)), 4), L[0].strip()]
    loc = {}
    if (d/'Fixes.txt').exists():
        for t in lines(d/'Fixes.txt'):
            m = COORD.search(t)
            if m: loc[t.split()[0]] = [round(dm(m.group(1)), 4), round(dm(m.group(2)), 4)]
    for kind, store in (('Sids.txt', SID), ('Stars.txt', STAR)):
        if not (d/kind).exists(): continue
        seen = set()
        for t in lines(d/kind):
            p = t.split(':')
            if len(p) < 5: continue
            rw, name, route = p[2], p[3], p[4].split()
            pts = [x for x in route if not x.startswith('RW')]
            for x in pts:
                if x in loc and x not in FIX: APFIX.setdefault(x, loc[x])
            key = (name, rw)
            if key in seen: continue
            seen.add(key)
            store.setdefault(d.name, []).append([rw, name, pts])
for k, v in APFIX.items(): addfix(k, v[0], v[1], 'P')

# ── airways ──
# keyed by the real designator: the upper network is UL9, UN601 and so on (the sector file keeps the U in the folder name),
# the lower network L9, N601. l: U upper / L lower; t: R RNAV / C conventional
AWY = {}
def readawy(p, lvl, typ):
    name = ('U' if lvl == 'U' and typ == 'R' and not p.stem.startswith('U') else '') + p.stem
    pts = []
    for t in lines(p):
        w = t.split()
        if len(w) < 4: continue
        a, b = w[0], w[2]
        if not pts: pts.append(a)
        if pts[-1] != a: pts.append('|'); pts.append(a)   # a gap in the airway
        pts.append(b)
    segs, cur = [], []
    for x in pts:
        if x == '|':
            if len(cur) > 1: segs.append(cur)
            cur = []
        elif x in FIX: cur.append(x)
        else:
            if len(cur) > 1: segs.append(cur)
            cur = []
    if len(cur) > 1: segs.append(cur)
    if segs: AWY.setdefault(name, {'l': lvl, 't': typ, 's': []})['s'].extend(segs)
R = SF/'ATS Routes'
for p in sorted((R/'RNAV'/'Upper').glob('*.txt')): readawy(p, 'U', 'R')
for p in sorted((R/'RNAV'/'Lower').glob('*.txt')): readawy(p, 'L', 'R')
for p in sorted((R/'Other').glob('*.txt')): readawy(p, 'L', 'R')
for sub in (R/'Conventional - Non-UK').iterdir():
    for p in sorted(sub.glob('*.txt')): readawy(p, 'U' if sub.name == 'Upper' else 'L', 'C')

# ── runways: the thresholds, for the final approach and the take-off roll (true course from the coordinates) ──
RWY = {}
def course(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    y = math.sin(lo2 - lo1)*math.cos(la2); x = math.cos(la1)*math.sin(la2) - math.sin(la1)*math.cos(la2)*math.cos(lo2 - lo1)
    return round((math.degrees(math.atan2(y, x)) + 360) % 360, 1)
for d in sorted((SF/'Airports').iterdir()):
    f = d/'Runway.txt'
    if not d.is_dir() or not f.exists() or d.name not in AP: continue
    for t in lines(f):
        w = t.split()
        if len(w) < 8: continue
        try: a = [round(dm(w[4]), 5), round(dm(w[5]), 5)]; b = [round(dm(w[6]), 5), round(dm(w[7]), 5)]
        except Exception: continue
        RWY.setdefault(d.name, {})[w[0]] = [a[0], a[1], course(a, b), b[0], b[1]]
        RWY[d.name][w[1]] = [b[0], b[1], course(b, a), a[0], a[1]]
# ── sector boundary lines and sectors ──
SL = {}
for p in sorted((SF/'Sector Boundaries').glob('*.txt')):
    cur = None
    for t in lines(p):
        if t.startswith('SECTORLINE:'): cur = t.split(':', 1)[1].strip(); SL[cur] = []
        elif t.startswith('COORD:') and cur:
            m = COORD2.search(t)
            if m: SL[cur].append(ll(m.group(1), m.group(2)))
# airport files can carry their own sector lines (TMA and CTA pieces)
for d in sorted((SF/'Airports').iterdir()):
    f = d/'Sector_Boundaries.txt'
    if f.exists():
        cur = None
        for t in lines(f):
            if t.startswith('SECTORLINE:'): cur = t.split(':', 1)[1].strip(); SL[cur] = []
            elif t.startswith('COORD:') and cur:
                m = COORD2.search(t)
                if m: SL[cur].append(ll(m.group(1), m.group(2)))

def close(a, b, tol=0.004): return abs(a[0] - b[0]) < tol and abs(a[1] - b[1]) < tol*1.7
def ring(names):
    segs = [list(SL[n]) for n in names if n in SL and len(SL[n]) > 1]
    if not segs: return None
    out = segs.pop(0)
    while segs:
        e = out[-1]; best = None
        for i, s in enumerate(segs):
            for rev in (False, True):
                q = s[::-1] if rev else s
                d = abs(q[0][0] - e[0]) + abs(q[0][1] - e[1])
                if best is None or d < best[0]: best = (d, i, rev)
        d, i, rev = best
        s = segs.pop(i); s = s[::-1] if rev else s
        out += s[1:] if close(s[0], e) else s
    if close(out[0], out[-1]): out.pop()
    return out if len(out) >= 3 else None

SEC = []
def readown(p, region):
    blocks = p.read_text(errors='ignore').split('SECTOR:')[1:]
    for b in blocks:
        L = [x.split(';', 1)[0].strip() for x in b.splitlines()]
        head = L[0].split(':')
        if len(head) < 3: continue
        name, lo, hi = head[0], int(head[1] or 0), min(66000, int(head[2] or 0))
        own = next((x.split(':')[1:] for x in L if x.startswith('OWNER:')), None)
        bor = next((x.split(':')[1:] for x in L if x.startswith('BORDER:')), None)
        if not own or not bor or hi == 0: continue
        poly = ring(bor)
        if not poly or not any(inside(*q) for q in poly): continue
        SEC.append({'n': name, 'lo': lo//100, 'hi': hi//100, 'o': own, 'p': poly, 'r': region})
SO = SF/'Sector Ownership'
for d in sorted(SO.iterdir()):
    if not d.is_dir() or d.name == 'Alternate': continue
    for p in sorted(d.glob('*.txt')): readown(p, d.name)
for d in sorted((SF/'Airports').iterdir()):
    f = d/'Sector_Ownership.txt'
    if f.exists(): readown(f, 'AD ' + d.name)

# ── positions: callsign, name, frequency, the owner code sectors use ──
POS = {}
for p in sorted((SF/'Area Positions').glob('*.txt')):
    for t in lines(p):
        w = t.split(':')
        if len(w) < 4 or not re.fullmatch(r'\d{3}\.\d{2,3}', w[2]) or w[2].startswith('199'): continue
        code = w[3]
        POS.setdefault(code, [w[0], w[1], w[2]])
for d in sorted((SF/'Airports').iterdir()):
    f = d/'Positions.txt'
    if f.exists():
        for t in lines(f):
            w = t.split(':')
            if len(w) >= 4 and re.fullmatch(r'\d{3}\.\d{2,3}', w[2]) and not w[2].startswith('199'): POS.setdefault(w[3], [w[0], w[1], w[2]])

# keep the fixes the game uses: on an airway, a SID or a STAR, a navaid, or an airport's own point
used = set(k for k, v in FIX.items() if v[2] in 'VN')
for a in AWY.values():
    for s in a['s']: used.update(s)
for D in (SID, STAR):
    for rows in D.values():
        for r in rows: used.update(x for x in r[2] if x in FIX)
FIX = {k: v for k, v in FIX.items() if k in used}
# only owner codes some sector uses, or an airport position
codes = set(c for s in SEC for c in s['o'])
POS = {k: v for k, v in POS.items() if k in codes or v[0].endswith(('_APP', '_DEP', '_TWR'))}

# ── standing agreements (COPX): the level a flight is handed over at, by route and destination ──
# COPX:<fix before or departure airport>:<departure runway>:<fix>:<fix after or arrival airport>:<arrival runway>:
#      <from sector>:<to sector>:<climb level>:<descend level>:<name>
COPX = []
for p in sorted((SF/'Agreements').rglob('*.txt')):
    for t in lines(p):
        if not t.startswith('COPX:'): continue
        w = t.split(':')[1:]
        if len(w) < 10: continue
        fb, _, fix, fa, _, fr, to, clb, des = w[:9]
        if fix != '*' and fix not in FIX: continue
        num = lambda v: int(v)//100 if v.strip().isdigit() else 0
        COPX.append([fb, fix, fa, fr.strip(), to.strip(), num(clb), num(des)])

out = ROOT/'src'/'area'/'area-data.js'
out.parent.mkdir(exist_ok=True)
js = ('// Generated by tools/area_data.py from the VATSIM UK sector file (UK AIP airspace, routes, navaids, SIDs and STARs).\n'
      'const AREA = ' + json.dumps({'fix': FIX, 'awy': AWY, 'ap': AP, 'rwy': RWY, 'sid': SID, 'star': STAR, 'sec': SEC, 'pos': POS, 'copx': COPX}, separators=(',', ':')) + ';\n')
out.write_text(js)
# the airport consoles carry only the airway network: the points on airways, the airways, the airports and their runways
used_awy = set(n for a in AWY.values() for s_ in a['s'] for n in s_)
lite = {'fix': {k: v for k, v in FIX.items() if k in used_awy}, 'awy': AWY, 'ap': {k: v for k, v in AP.items() if k.startswith(('EG', 'EI', 'EH', 'EB', 'LF', 'LE', 'ED', 'EK', 'EN', 'LP', 'LS', 'LO', 'LI'))}, 'rwy': RWY}
# ── the rest of Europe, for the airport consoles' far traffic: the upper airways of the X-Plane default navdata
# (github.com/mcantsin/x-plane-navdata, GPL v3, AIRAC cycle 2012.08: older than the UK data, so a few routes have since been
# renumbered or withdrawn). The UK sector file stays the authority inside its own region; these fill in everywhere else.
NAVDATA = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else None
EU = {'la': (34.0, 66.0), 'lo': (-12.0, 32.0)}
if NAVDATA and (NAVDATA/'earth_awy.dat').exists():
    nav = {}
    for t in (NAVDATA/'earth_nav.dat').read_text(errors='ignore').splitlines():
        w = t.split()
        if len(w) > 7 and w[0] in ('2', '3'):
            try: nav.setdefault(w[7], []).append((float(w[1]), float(w[2]), 'N' if w[0] == '2' else 'V'))
            except ValueError: pass
    def kind(n, la, lo):
        for a, b, k in nav.get(n, []):
            if abs(a - la) < 0.06 and abs(b - lo) < 0.06: return k
        return 'F'
    def far(a, b): return math.hypot(a[0] - b[0], (a[1] - b[1])*math.cos(math.radians(a[0])))*60
    ext, edges, convs = dict(lite['fix']), {}, {}
    ok = lambda la, lo: EU['la'][0] <= la <= EU['la'][1] and EU['lo'][0] <= lo <= EU['lo'][1]
    for t in (NAVDATA/'earth_awy.dat').read_text(errors='ignore').splitlines():
        w = t.split()
        if len(w) != 10 or w[6] != '2': continue
        try: p1 = (float(w[1]), float(w[2])); p2 = (float(w[4]), float(w[5]))
        except ValueError: continue
        if not (ok(*p1) and ok(*p2)) or (inside(*p1) and inside(*p2)): continue
        a, b = w[0], w[3]
        if any(n in FIX and far(FIX[n][:2], q) > 5 for n, q in ((a, p1), (b, p2))): continue   # the same name somewhere else
        if any(n in ext and far(ext[n][:2], q) > 5 for n, q in ((a, p1), (b, p2))): continue
        for name in w[9].split('-'):
            if not re.fullmatch(r'[A-Z]{1,2}\d{1,3}', name) or name[0] == 'J': continue
            conv = len(name) > 3 and name[0] == 'U' and name[1] in 'ABGLMNRW'; nm = name if name[0] == 'U' and len(name) > 2 and name[1].isalpha() else 'U' + name
            edges.setdefault(nm, set()).add((a, b)); convs[nm] = conv
            for n, q in ((a, p1), (b, p2)): ext.setdefault(n, [round(q[0], 4), round(q[1], 4), kind(n, *q)])
    eawy = {}
    for nm, E in edges.items():
        adj = {}
        for a, b in E: adj.setdefault(a, set()).add(b); adj.setdefault(b, set()).add(a)
        left, segs = set(E), []
        while left:
            ends = [n for n, v in adj.items() if len(v) == 1 and any((n, m) in left or (m, n) in left for m in v)]
            cur = ends[0] if ends else next(iter(left))[0]; chain = [cur]
            while True:
                nxt = next((m for m in adj[cur] if (cur, m) in left or (m, cur) in left), None)
                if nxt is None: break
                left.discard((cur, nxt)); left.discard((nxt, cur)); chain.append(nxt); cur = nxt
            if len(chain) > 1: segs.append(chain)
        eawy[nm] = {'l': 'U', 't': 'C' if nm[1] in 'ABGJLMNPRW' and len(nm) > 3 and False else 'R', 's': segs}
    # conventional or RNAV: the old lettered routes (A B G L M N R W with the U prefix) are conventional
    for nm, A in eawy.items(): A['t'] = 'C' if convs.get(nm) else 'R'
    merged = {k: {**v, 's': list(v['s'])} for k, v in lite['awy'].items()}
    for nm, A in eawy.items():   # a route that continues beyond the UK file keeps its name: UL9 on into France
        if nm in merged and merged[nm]['l'] == 'U': merged[nm]['s'] += A['s']
        else: merged[nm] = A
    lite['awy'] = merged
    usedx = set(n for a in lite['awy'].values() for s_ in a['s'] for n in s_)
    lite['fix'] = {k: v for k, v in {**ext, **lite['fix']}.items() if k in usedx}
    lats = [v[0] for v in lite['fix'].values()]; lons = [v[1] for v in lite['fix'].values()]
    lite['cover'] = [round(min(lats) + 0.3, 2), round(max(lats) - 0.3, 2), round(min(lons) + 0.3, 2), round(max(lons) - 0.3, 2)]
    print(f'europe: +{len(eawy)} airways, {len(lite["fix"])} fixes in all, cover {lite["cover"]}')
lo = ROOT/'src'/'awy-data.js'
ljs = ('// Generated by tools/area_data.py: the airway network (UK AIP ENR 3 via the VATSIM UK sector file) for the airport consoles.\n'
       'const AWYDATA = ' + json.dumps(lite, separators=(',', ':')) + ';\n')
lo.write_text(ljs)
print(f'fixes {len(FIX)}, airways {len(AWY)}, airports {len(AP)}, runways {sum(len(v) for v in RWY.values())}, sids {sum(len(v) for v in SID.values())}, stars {sum(len(v) for v in STAR.values())}, sectors {len(SEC)}, positions {len(POS)}, agreements {len(COPX)}, {len(js)//1024} KB; airway file {len(ljs)//1024} KB')
