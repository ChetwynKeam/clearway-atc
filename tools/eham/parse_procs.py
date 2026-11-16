#!/usr/bin/env python3
"""Every SID, STAR and RNAV transition of the Dutch AIP's AD 2 EHAM (AD 2.22 para 1.5 and 2: the coding tables, and the
waypoint co-ordinates printed under them; AIRAC AMDT 12/2026) -> tools/eham/procs.json.
usage: parse_procs.py EH-AD_2_EHAM_1-en-GB.html tools/eham/procs.json
SIDs: each table's legs (path terminator, fix, fly-over, course, distance, turn, altitude, speed). STARs and transitions:
the abbreviated description of each leg ("RIVER [K250-, B F100 F070]")."""
import sys, re, json, html
from html.parser import HTMLParser
class T(HTMLParser):
    def __init__(s): super().__init__(); s.tables = []; s.stack = []; s.cell = None; s.row = None
    def handle_starttag(s, t, a):
        if t == 'table': s.stack.append([])
        elif t == 'tr' and s.stack: s.row = []
        elif t in ('td', 'th') and s.row is not None: s.cell = []
        elif t == 'br' and s.cell is not None: s.cell.append('\n')
    def handle_endtag(s, t):
        if t == 'table' and s.stack: s.tables.append(s.stack.pop())
        elif t == 'tr' and s.row is not None and s.stack: s.stack[-1].append(s.row); s.row = None
        elif t in ('td', 'th') and s.cell is not None and s.row is not None: s.row.append(re.sub(r'[ \t\xa0]+', ' ', ''.join(s.cell)).strip()); s.cell = None
    def handle_data(s, d):
        if s.cell is not None: s.cell.append(d)
p = T(); p.feed(open(sys.argv[1], errors='ignore').read())
FIX = {}; SIDS = {}; STARS = {}
def alt(a):
    a = a.replace(' ', '')
    m = re.findall(r'(FL\d{2,3}|\d{3,5}(?:FT)?)', a); return a or None
for tb in p.tables:
    for r in tb:
        for c in r:
            if 'Co-ordinates' in c or 'Waypoints' in c: pass
    # waypoint lists: a cell "Waypoints:\nA\nB" next to "Co-ordinates:\n..N ..E\n..."
    for r in tb:
        for i, c in enumerate(r):
            if re.match(r'(Waypoints|RF arc centres)\s*:', c) and i + 1 < len(r):
                ids = [x.strip() for x in c.split('\n')[1:] if x.strip()]
                cs = re.findall(r'(\d{6}(?:\.\d+)?N)\s+(\d{7}(?:\.\d+)?E)', r[i+1])
                for k, (la, lo) in zip(ids, cs): FIX[k] = [la, lo]
    if not tb or not tb[0]: continue
    head = tb[0][0]
    m = re.match(r'^([A-Z]{2,5} \d[A-Z])\s*\n?\s*\[([A-Z0-9]+)\]', head.replace('\n', ' ').strip()) or re.match(r'^([A-Z]{2,5} \d[A-Z])\s*\[([A-Z0-9]+)\]', head.replace('\n', ' '))
    if not m:
        # STARs and transitions: the name alone, then a header row, then "[DENU3A] | formal | abbreviated | path | fly-over"
        m2 = re.fullmatch(r'([A-Z]{2,5} \d[A-Z])', head.strip())
        if not m2 or len(tb) < 3: continue
        name = m2[1]; legs = []; arinc = None
        for r in tb[2:]:
            if r and r[0].startswith('['): arinc = r[0].strip('[]'); r = r[1:]
            elif len(r) >= 4 and r[0] == '': r = r[1:]   # the ARINC column left empty on a STAR's later rows (BLUFA 1A)
            if len(r) >= 3 and re.match(r'^[A-Z0-9]{2,5}\b', r[1]): legs.append(dict(desc=r[0], abbr=r[1], pt=r[2], fo=(r[3] if len(r) > 3 else '') == 'Y'))
        STARS[name] = dict(arinc=arinc, remarks=tb[0][1] if len(tb[0]) > 1 else '', legs=legs); continue
    name, arinc = m[1], m[2]; remarks = tb[0][1] if len(tb[0]) > 1 else ''
    hdr = next((i for i, r in enumerate(tb) if r and r[0].startswith('Serial')), None)
    if hdr is not None:
        legs = []
        for r in tb[hdr+1:]:
            if len(r) < 10 or not re.fullmatch(r'\d{3}', r[0]): continue
            legs.append(dict(pt=r[1], fix=r[2] if r[2] != '-' else None, fo=r[3] == 'Y', crs=r[4], nav=r[5], dist=r[6], turn=r[7], alt=r[8] if r[8] != '-' else None, spd=r[9] if r[9] != '-' else None))
        SIDS[name] = dict(arinc=arinc, remarks=remarks, legs=legs)
    else:
        legs = []
        for r in tb[1:]:
            if len(r) >= 3 and re.match(r'^[A-Z0-9]{2,5}\b', r[1] if len(r) > 1 else ''):
                legs.append(dict(desc=r[0], abbr=r[1], pt=r[2] if len(r) > 2 else '', fo=(r[3] if len(r) > 3 else '') == 'Y'))
        STARS[name] = dict(arinc=arinc, remarks=remarks, legs=legs)
json.dump({'fixes': FIX, 'sids': SIDS, 'stars': STARS}, open(sys.argv[2], 'w'), indent=0)
print(len(FIX), 'fixes', len(SIDS), 'SIDs', len(STARS), 'STARs/transitions')
print(sorted(SIDS)); print(sorted(STARS))
