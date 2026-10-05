"""Turn the Gibraltar Airport live flight information page into flights.json for the simulator's Real world mode.
Times on the page are Gibraltar local time; they are kept as shown, with the UTC offset for that date."""
import html, json, re, sys, datetime
from zoneinfo import ZoneInfo
src = open(sys.argv[1], encoding='utf-8', errors='replace').read()
tz = ZoneInfo('Europe/Gibraltar')
clean = lambda s: re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', s))).strip()
out = {'updated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'source': 'gibraltarairport.gi', 'days': {}}
for kind in ('arrivals', 'departures'):
    a = src.find(f'id="live-flight-info-{kind}"')
    if a < 0: continue
    nxt = src.find('id="live-flight-info-', a + 30); body = src[a:nxt if nxt > 0 else len(src)]
    for day in re.split(r'<div class="flight-day">', body)[1:]:
        m = re.search(r'<h6>(.*?)</h6>', day, re.S)
        if not m: continue
        try: d = datetime.datetime.strptime(clean(m.group(1)), '%A %d %B %Y').date()
        except ValueError: continue
        off = int(datetime.datetime(d.year, d.month, d.day, 12, tzinfo=tz).utcoffset().total_seconds()//60)
        rows = []
        for tr in re.findall(r'<tr>(.*?)</tr>', day, re.S):
            td = [clean(x) for x in re.findall(r'<td[^>]*>(.*?)</td>', tr, re.S)]
            if len(td) < 3: continue
            rows.append({'place': td[0], 'flight': td[1].replace(' ', ''), 'sched': td[2], 'status': td[3] if len(td) > 3 else '', 'expected': td[4] if len(td) > 4 else ''})
        e = out['days'].setdefault(d.isoformat(), {'utcOffsetMin': off, 'arr': [], 'dep': []})
        e['arr' if kind == 'arrivals' else 'dep'] += rows
json.dump(out, open(sys.argv[2], 'w'), indent=1)
print({k: (len(v['arr']), len(v['dep'])) for k, v in out['days'].items()})
