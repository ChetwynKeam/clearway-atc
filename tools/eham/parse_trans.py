#!/usr/bin/env python3
"""The approaches and RNAV transitions of the Dutch AIP's AD 2 EHAM (AD 2.22 para 2.11.3): each runway's ILS and RNP
approach coding (intermediate fix, final approach, missed approach), the night transitions from ARTIP, RIVER and SUGOL
to the ILS or RNP of 06, 18C and 18R, and the day transition ARTIP 2X to 36R -> tools/eham/trans.json.
usage: parse_trans.py EH-AD_2_EHAM_1-en-GB.html tools/eham/trans.json
Each heading ("2.11.3.5.3 ARTIP1D transition to ILS RWY 18R (night)") names the coding table under it. A transition's
legs are kept up to its last fix before the threshold (some tables run on into the approach)."""
import sys, re, json, html
src = open(sys.argv[1], errors='ignore').read()
clean = lambda s: re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s))).strip()
heads = [(m.start(), clean(m.group(0))) for m in re.finditer(r'<h6[^>]*>.*?</h6>', src, re.S)]
heads = [(i, h) for i, h in heads if re.search(r'transition|approach RWY', h, re.I)]
tables = [m.start() for m in re.finditer(r'<table[^>]*IndSubTable', src)]
out = {}
for k, (pos, h) in enumerate(heads):
    m = re.search(r'([A-Z]{5})\s?(\d[A-Z])\s+transition(?: to\s+(ILS|RNP))?\s+RWY\s+(\d\d[LCR]?)\s*(?:\((night|day)\))?', h)
    a = re.search(r'(COPTER )?(ILS|RNP) approach RWY (\d\d[LCR]?)\s*\(([a-z/]+)\)', h)
    if not m and not a: print('?', h); continue
    nxt = heads[k + 1][0] if k + 1 < len(heads) else len(src)
    t0 = next((t for t in tables if pos < t < nxt), None)
    if t0 is None: print('no table', h); continue
    tb = src[t0:src.index('</table>', t0)]
    rows = [[clean(c) for c in re.findall(r'<td[^>]*>(.*?)</td>', r, re.S)] for r in re.findall(r'<tr[^>]*>(.*?)</tr>', tb, re.S)]
    legs, seen = [], 0
    for r in rows:
        if len(r) < 10 or not re.fullmatch(r'\d{3}', r[0]): continue
        if r[0] == '001': seen += 1
        if m and (seen > 1 or r[2].startswith('THR')): break   # a transition ends where the approach begins
        legs.append(dict(pt=r[1], fix=r[2], fo=r[3] == 'Y', crs=r[4], dist=r[6], turn=r[7], alt=r[8] if r[8] != '-' else None, spd=r[9] if r[9] != '-' else None))
    if a: out[('COPTER ' if a[1] else '') + a[2] + ' ' + a[3]] = dict(kind='approach', app=a[2], rwy=a[3], when=a[4], heading=h, legs=legs); continue
    out[m[1] + ' ' + m[2]] = dict(kind='transition', app=m[3] or 'ILS', rwy=m[4], when=m[5] or 'day', heading=h, legs=legs)
json.dump(out, open(sys.argv[2], 'w'), indent=0)
for n, v in out.items(): print(n, v['kind'], v['rwy'], v['when'], ' '.join(f"{l['fix']}({l['pt']}{','+l['alt'] if l['alt'] else ''})" for l in v['legs']))
