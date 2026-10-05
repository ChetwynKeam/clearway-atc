"""Turn avionio.com's live arrivals and departures boards for an airport into flights.json for Real world mode.
Used for London City and Innsbruck, whose own sites refuse automated requests. Codeshare rows are skipped; times are local.
Usage: avionio_flights.py arrivals.html departures.html out.json [Europe/London]"""
import datetime, html, json, re, sys
from zoneinfo import ZoneInfo
tz = ZoneInfo(sys.argv[4] if len(sys.argv) > 4 else 'Europe/London')
MON = {m: i + 1 for i, m in enumerate(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'])}
now = datetime.datetime.now(tz)
out = {'updated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'source': 'avionio.com', 'days': {}}
cell = lambda row, c: html.unescape(re.sub(r'<[^>]+>', ' ', (re.search(r'<td class="%s[^"]*"[^>]*>(.*?)</td>' % c, row, re.S) or [None, ''])[1])).split()
seen = set()
for path, key in ((sys.argv[1], 'arr'), (sys.argv[2], 'dep')):
    try: page = open(path, encoding='utf-8').read()
    except OSError: continue
    for row in re.findall(r'<tr class="tt-row ([^"]*)">(.*?)</tr>', page, re.S):
        cls, row = row
        if 'tt-child' in cls: continue                        # codeshare of the row above
        t, d, fl = cell(row, 'tt-t'), cell(row, 'tt-d'), cell(row, 'tt-f')
        if not t or len(d) < 2 or not fl or d[1] not in MON: continue
        year = now.year + (1 if MON[d[1]] < now.month - 6 else 0)
        day = datetime.date(year, MON[d[1]], int(d[0]))
        place = ' '.join(cell(row, 'tt-ap'))
        k = (day, key, t[0], place)                           # BA8454 and CJ8454 are one flight: keep the operator's number
        if k in seen and not fl[0].startswith('CJ'): continue
        if k in seen: out['days'][day.isoformat()][key] = [r for r in out['days'][day.isoformat()][key] if not (r['sched'] == t[0] and r['place'] == place)]
        seen.add(k)
        status = ' '.join(cell(row, 'tt-s')); m = re.search(r'(\d\d:\d\d)', status)
        off = int(datetime.datetime(day.year, day.month, day.day, 12, tzinfo=tz).utcoffset().total_seconds() // 60)
        e = out['days'].setdefault(day.isoformat(), {'utcOffsetMin': off, 'arr': [], 'dep': []})
        e[key].append({'place': place, 'flight': fl[0], 'sched': t[0], 'status': re.sub(r'\s*\d\d:\d\d\s*', '', status).strip(),
                       'expected': m.group(1) if m else ''})
json.dump(out, open(sys.argv[3], 'w'), indent=1, ensure_ascii=False)
print({k: (len(v['arr']), len(v['dep'])) for k, v in out['days'].items()})
