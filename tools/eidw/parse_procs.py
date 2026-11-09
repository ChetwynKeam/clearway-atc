import re, json, glob, sys
D = '/home/claude/eidw/pg'
def dms(s, ns):
    s = s.replace(' ', '')
    if ns: d, m, x = int(s[0:2]), int(s[2:4]), float(s[4:])
    else: d, m, x = int(s[0:3]), int(s[3:5]), float(s[5:])
    return d + m/60 + x/3600
hdr = re.compile(r'^\s*([A-Z]{5}|[A-Z]{3}) ?(\d[A-Z])\s+(?:CAT ([A-D/, ]+?) )?(SID|STAR)\s+RWY ?([0-9LR/ ]+)')
leg = re.compile(r'RNAV ?1\s+([A-Z0-9]{2,5})\s+(\d{6}(?:\.\d+)?) ?/ ?(\d{7}(?:\.\d+)?)\s+([A-Z]{2})\s+(Fly-Over|Fly-By|-)\s+(.*)$')
procs = {}; fixes = {}
for f in sorted(glob.glob(D + '/*-p[23].txt')):
    pg = f.split('/')[-1]
    cur = None
    for line in open(f):
        m = hdr.match(line)
        if m:
            name = f'{m[1]}{m[2]}'; cat = (m[3] or '').replace(' ', ''); kind = m[4]; rwy = m[5].strip().replace(' ', '')
            key = f'{name}:{rwy}'
            cur = procs[key] = {'name': name, 'kind': kind, 'cat': cat, 'rwy': rwy, 'src': pg, 'legs': []}
            continue
        m = leg.search(line)
        if m and cur is not None:
            fx, la, lo, pt, fb, rest = m.groups()
            lat, lon = dms(la, True), -dms(lo, False)
            fixes.setdefault(fx, (round(lat, 7), round(lon, 7)))
            rest = re.sub(r'\s+', ' ', rest.strip())
            # track / distance / altitude / speed / remarks
            tm = re.match(r'(?:(\d{3}\.\d) ?/ ?(\d{3})|-)\s*(?:([\d.]+)|-)?\s*(.*)$', rest)
            trk = float(tm[1]) if tm and tm[1] else None; dist = float(tm[3]) if tm and tm[3] else None; tail = tm[4] if tm else rest
            # altitude: "-FL90 / -", "- / +A3000", "FL070 / FL070", "-FL180 / +FL150", "- / +FL060", "-", "A4000/A4000"
            am = re.match(r'((?:-|\+)?(?:FL|A)?\d{2,5}|-)\s*/\s*((?:-|\+)?\s?(?:FL|A)?\d{2,5}|-)\s*(.*)$', tail)
            up = lo_ = None; spd = None; rem = tail
            def ft(v):
                v = v.replace(' ', '').lstrip('+-')
                if v.startswith('FL'): return int(v[2:])*100
                if v.startswith('A'): return int(v[1:])
                return int(v) if v.isdigit() else None
            if am:
                up = ft(am[1]) if am[1] != '-' else None; lo_ = ft(am[2]) if am[2] != '-' else None
                r2 = am[3].split(' ', 1); 
                if r2 and r2[0].isdigit(): spd = int(r2[0]); rem = r2[1] if len(r2) > 1 else ''
                elif r2 and r2[0] == '-': rem = r2[1] if len(r2) > 1 else ''
                else: rem = am[3]
            elif tail.startswith('- '):
                r2 = tail[2:].split(' ', 1)
                if r2[0].isdigit(): spd = int(r2[0]); rem = r2[1] if len(r2) > 1 else ''
                else: rem = tail[2:]
            cur['legs'].append({'fix': fx, 'pt': pt, 'fo': fb == 'Fly-Over', 'trk': trk, 'nm': dist, 'up': up, 'lo': lo_, 'spd': spd, 'rem': rem.strip(' -')})
json.dump({'procs': procs, 'fixes': fixes}, open('/home/claude/eidw/procs.json', 'w'), indent=1)
print(len(procs), 'procedures', len(fixes), 'fixes')
for k, p in procs.items():
    print(f"{k:16} {p['kind']:4} {p['cat']:4} {p['src']:10} " + ' '.join(f"{l['fix']}{'/'+str(l['up'] or '') + '/' + str(l['lo'] or '') if (l['up'] or l['lo']) else ''}{'@'+str(l['spd']) if l['spd'] else ''}" for l in p['legs']))
