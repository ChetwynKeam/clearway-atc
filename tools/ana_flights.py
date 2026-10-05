"""Turn ANA's flight feed (madeiraairport.pt /en/flights_proxy, JSON) into lpma/flights.json for Real world mode.
Usage: ana_flights.py arrivals.json departures.json out.json [Atlantic/Madeira]. Times are local; kept as shown, with the UTC offset."""
import json, sys, datetime
from zoneinfo import ZoneInfo
tz = ZoneInfo(sys.argv[4] if len(sys.argv) > 4 else 'Atlantic/Madeira')
out = {'updated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ'), 'source': 'madeiraairport.pt', 'days': {}}
seen = set()
for path, key in ((sys.argv[1], 'arr'), (sys.argv[2], 'dep')):
    try: rows = json.load(open(path, encoding='utf-8')).get('flights') or []
    except (OSError, ValueError): continue
    for f in rows:
        if f.get('movtype') and f['movtype'] != ('A' if key == 'arr' else 'D'): continue
        try: d = datetime.datetime.strptime(f['day'], '%d/%m/%Y').date()
        except (KeyError, ValueError): continue
        flight = (f.get('flightNumber') or '').replace(' ', '')
        if not flight or (d, key, flight) in seen: continue
        seen.add((d, key, flight))
        st = f.get('state') or {}; label = (st.get('label') or '').strip(); val = (st.get('value') or '').strip()
        off = int(datetime.datetime(d.year, d.month, d.day, 12, tzinfo=tz).utcoffset().total_seconds() // 60)
        e = out['days'].setdefault(d.isoformat(), {'utcOffsetMin': off, 'arr': [], 'dep': []})
        e[key].append({'place': (f.get('destination') or '').replace(', ', ' ').strip(), 'flight': flight, 'sched': f.get('time', ''),
                       'status': label, 'expected': val})
json.dump(out, open(sys.argv[3], 'w'), indent=1, ensure_ascii=False)
print({k: (len(v['arr']), len(v['dep'])) for k, v in out['days'].items()})
