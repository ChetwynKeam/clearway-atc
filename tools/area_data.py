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
AWY = {}
def readawy(p, lvl):
    name = p.stem
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
    if segs: AWY.setdefault(name, {'l': lvl, 's': []})['s'].extend(segs)
R = SF/'ATS Routes'
for p in sorted((R/'RNAV'/'Upper').glob('*.txt')): readawy(p, 'U')
for p in sorted((R/'RNAV'/'Lower').glob('*.txt')): readawy(p, 'L')
for sub in (R/'Conventional - Non-UK').iterdir():
    for p in sorted(sub.glob('*.txt')): readawy(p, 'U' if sub.name == 'Upper' else 'L')

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
      'const AREA = ' + json.dumps({'fix': FIX, 'awy': AWY, 'ap': AP, 'sid': SID, 'star': STAR, 'sec': SEC, 'pos': POS, 'copx': COPX}, separators=(',', ':')) + ';\n')
out.write_text(js)
print(f'fixes {len(FIX)}, airways {len(AWY)}, airports {len(AP)}, sids {sum(len(v) for v in SID.values())}, stars {sum(len(v) for v in STAR.values())}, sectors {len(SEC)}, positions {len(POS)}, agreements {len(COPX)}, {len(js)//1024} KB')
