#!/usr/bin/env python3
"""Every SID, STAR and approach coding table of the UAE AIP AD 2 OMDB (AD 2.22.4.9, 2.22.5.7, 2.22.6), with the
coordinates of their points from ENR 4.4 -> procs.json.  usage: parse_procs.py AD-2.OMDB-en-GB.html ENR-4.4-en-GB.html"""
import re, sys, json, html, os
HERE = os.path.dirname(os.path.abspath(__file__))
def text(path):
    t = open(path, encoding='utf-8', errors='replace').read()
    t = re.sub(r'(?is)<(script|style).*?</\1>', '', t); t = re.sub(r'(?i)</(tr|p|div|h\d|li)>', '\n', t); t = re.sub(r'(?i)</t[dh]>', ' | ', t)
    t = html.unescape(re.sub(r'<[^>]+>', '', t)); t = re.sub(r'[ \t\xa0]+', ' ', t); return re.sub(r'\n\s*\n+', '\n', t)
def dms(s):
    h = s[-1]; s = s[:-1]; a, fr = (s.split('.')[0], '.' + s.split('.')[1]) if '.' in s else (s, '')
    v = int(a[:-4]) + int(a[-4:-2])/60 + float(a[-2:] + fr)/3600; return -v if h in 'SW' else v
AD, ENR = text(sys.argv[1]), text(sys.argv[2])
FIX = {m[1]: [round(dms(m[2]), 6), round(dms(m[3]), 6)] for m in re.finditer(r'\b([A-Z]{5}|[A-Z]{2}\d{3})\b\s*\|\s*(\d{6}(?:\.\d+)?N)\s+(\d{7}(?:\.\d+)?E)', ENR)}
procs, cur, kind, rwy = {}, None, None, None
for line in AD.split('\n'):
    line = line.strip()
    m = re.match(r'^2\.22\.(4\.9\.[23]|5\.7\.[23]) (SID|STAR) RWY ?(\d\d) L/R', line)
    if m: kind, rwy = m[2], m[3]; continue
    m = re.match(r'^2\.22\.6\.[23]\.\d (?:RNP RWY (\d\d[LR])|RWY (\d\d[LR]) ILS)', line)
    if m: kind = 'RNP' if m[1] else 'ILS'; rwy = m[1] or m[2]; cur = procs.setdefault(f'{kind} {rwy}', {'kind': kind, 'rwy': rwy, 'legs': []}); continue
    if line.startswith('2.22.5.8') or line.startswith('2.22.7'): kind = None; cur = None; continue
    m = re.match(r'^[ivx]+\) ([A-Z]{5}) (\d[A-Z]) \(RNAV 1 (SID|STAR) RWY', line)
    if m and kind in ('SID', 'STAR'): cur = procs.setdefault(m[1] + m[2], {'kind': kind, 'rwy': rwy, 'legs': []}); continue
    m = re.match(r'^(\d+) \| ([A-Z]{2}) \| ([A-Z0-9]+(?: L/R)?) \|(.*)$', line)
    if m and cur is not None:
        cells = [c.strip() for c in m[4].split('|')]
        # levels (+ at or above, - at or below, @ at) and speeds share the columns' form: a figure up to 300 is a speed
        # (the "+180"/"+200" a SID gives its first turn point is the speed-free height of the turn: left out)
        toks = [c.replace(' ', '') for c in cells if re.fullmatch(r'[-+@]\s?(?:FL ?)?\d+', c)]
        val = lambda c: int(c[3:])*100 if 'FL' in c else int(c[1:])
        alt = next((c[0] + str(val(c)) for c in toks if val(c) > 300), None)
        spd = next((c for c in toks if val(c) <= 300 and c[0] in '-@'), None)
        turn = next((c for c in cells if c in ('Left', 'Right')), None)
        cur['legs'].append({'pt': m[2], 'fix': m[3].replace(' L/R', ''), 'alt': alt, 'spd': spd, 'turn': turn})
used = {l['fix'] for p in procs.values() for l in p['legs']}
miss = sorted(f for f in used if f not in FIX and not f.startswith('RW'))
print('procedures', len(procs), 'fixes', len(used), 'missing', miss, file=sys.stderr)
json.dump({'procs': procs, 'fixes': {k: FIX[k] for k in sorted(used) if k in FIX}}, open(os.path.join(HERE, 'procs.json'), 'w'), indent=0)
