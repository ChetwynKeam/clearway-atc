"""Merge the Belfast International (BFS) and Belfast City (BHD) boards, as tools/avionio_flights.py writes them, into one
egaa/flights.json for Real world mode. Each row gets "air": "A" (Aldergrove) or "C" (City) so the simulator knows which
airfield a flight uses; rows are sorted by scheduled time.
Usage: belfast_flights_merge.py bfs.json bhd.json out.json"""
import json, sys
a, c = json.load(open(sys.argv[1])), json.load(open(sys.argv[2]))
out = {'updated': max(a.get('updated', ''), c.get('updated', '')), 'source': 'avionio.com', 'days': {}}
for src, tag in ((a, 'A'), (c, 'C')):
    for day, v in src['days'].items():
        e = out['days'].setdefault(day, {'utcOffsetMin': v['utcOffsetMin'], 'arr': [], 'dep': []})
        for k in ('arr', 'dep'):
            e[k] += [dict(r, air=tag) for r in v[k]]
for v in out['days'].values():
    for k in ('arr', 'dep'): v[k].sort(key=lambda r: r['sched'])
json.dump(out, open(sys.argv[3], 'w'), indent=1, ensure_ascii=False)
print({d: (len(v['arr']), len(v['dep'])) for d, v in out['days'].items()})
