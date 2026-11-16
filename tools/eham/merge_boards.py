"""Join snapshots of the AMS boards (the eham-boards branch, one boards-<time>.json per fetch: each reaches about half a
day ahead) into one full day for make_profile.py. For each hour of the day, the rows come from the date whose boards
have the most flights in that hour (an hour the boards only half cover has fewer), so the day is complete but may mix
two weekdays.
usage: merge_boards.py boards-1.json [boards-2.json ...] > boards-day.json"""
import json, sys
from collections import defaultdict
hm = lambda s: int(s[:2])*60 + int(s[3:5])
rows = defaultdict(dict)          # (date, key) -> {(flight, sched): row}, later snapshots replacing earlier ones
offs = {}
for p in sys.argv[1:]:
    for day, v in json.load(open(p))['days'].items():
        offs[day] = v['utcOffsetMin']
        for key in ('arr', 'dep'):
            for r in v[key]: rows[(day, key)][(r['flight'], r['sched'])] = r
out = {'arr': [], 'dep': []}
dates = sorted(offs)
for key in ('arr', 'dep'):
    for h in range(24):
        n = {d: [r for r in rows[(d, key)].values() if hm(r['sched']) // 60 == h] for d in dates}
        best = max(dates, key=lambda d: len(n[d]))
        out[key] += sorted(n[best], key=lambda r: r['sched'])
        print(f'{key} {h:02d}: {best} {len(n[best])}', file=sys.stderr)
day = max(dates, key=lambda d: sum(len(rows[(d, k)]) for k in ('arr', 'dep')))
json.dump({'source': 'avionio.com', 'snapshots': [p.rsplit('/', 1)[-1] for p in sys.argv[1:]], 'days': {day: {'utcOffsetMin': offs[day], **out}}}, sys.stdout, indent=1, ensure_ascii=False)
