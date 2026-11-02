"""Build the TIMETABLE rows of src/airports/egaa.js (Belfast International and Belfast City together) from a day of the
real boards (avionio.com, as tools/avionio_flights.py writes them: local times, here GMT). Each arrival is paired with a
later departure of the same airline to the same place (35-200 minutes on the ground); an arrival left over turns round to
where it came from; a departure left over before 11:00 night-stopped (parked when the session starts), a later one came
in from the same place about 90 minutes earlier. Row: [arrival, from, arrival UTC, departure, to, departure UTC, type,
days, stand, airfield (A International, C City)].
Usage: belfast_timetable.py bfs.json bhd.json day > rows.js"""
import json, sys, re
ICAO = {'U2': 'EZY', 'RK': 'RUK', 'FR': 'RYR', 'LS': 'EXS', 'EI': 'EIN', 'BA': 'CFE', 'CJ': 'CFE', 'KL': 'KLM', 'LM': 'LOG'}
TYPE = {'EZY': ['A320', 'A20N', 'A319'], 'RUK': ['B38M', 'B738'], 'RYR': ['B38M', 'B738'], 'EXS': ['B738', 'A21N'], 'EIN': ['AT76'], 'BAW': ['A320'],
        'CFE': ['E190'], 'KLM': ['E190'], 'LOG': ['E145']}
PLACE = {'London': None, 'Bristol': 'EGGD', 'Newcastle': 'EGNT', 'Birmingham': 'EGBB', 'Faro': 'LPFR', 'Glasgow': 'EGPF', 'Manchester': 'EGCC',
         'Leeds/Bradford': 'EGNM', 'Edinburgh': 'EGPH', 'Palma de Mallorca': 'LEPA', 'Alicante': 'LEAL', 'Amsterdam': 'EHAM', 'Liverpool': 'EGGP',
         'Malaga': 'LEMG', 'Tenerife': 'GCTS', 'Lanzarote': 'GCRR', 'Fuerteventura': 'GCFV', 'Rome': 'LIRF', 'Dalaman': 'LTBS', 'Heraklion': 'LGIR',
         'Cardiff': 'EGFF', 'Aberdeen': 'EGPD', 'Southampton': 'EGHI', 'Inverness': 'EGPE', 'Nottingham': 'EGNX'}
LON = {'U2': 'EGKK', 'RK': 'EGSS', 'BA': 'EGLL', 'CJ': 'EGLL', 'EI': 'EGLL', 'FR': 'EGSS'}
def split(fl): m = re.match(r'^([A-Z0-9]{2})(\d+)$', fl); return m[1], m[2]
def hm(s): h, m = s.split(':'); return int(h)*60 + int(m)
def hh(m): m %= 1440; return '%02d:%02d' % (m // 60, m % 60)
def rows_for(path, day, ap):
    d = json.load(open(path))['days'][day]; off = d['utcOffsetMin']
    def conv(r, kind):
        a, n = split(r['flight']); al = ICAO.get(a)
        place = PLACE.get(r['place'], 'X')
        if place is None or r['place'] == 'London': place = LON.get(a, 'EGLL')
        if place == 'X' or not al: return None
        i = int(n); t = TYPE[al][i % len(TYPE[al])]
        return dict(cs=al + n, al=al, t=t, place=place, tm=(hm(r['sched']) - off) % 1440)
    arr = [x for x in (conv(r, 'a') for r in d['arr']) if x]; dep = [x for x in (conv(r, 'd') for r in d['dep']) if x]
    out, used = [], set()
    for a in sorted(arr, key=lambda x: x['tm']):
        c = [x for x in dep if x['cs'] not in used and x['al'] == a['al'] and x['place'] == a['place'] and 35 <= x['tm'] - a['tm'] <= 200]
        if c:
            x = min(c, key=lambda x: x['tm']); used.add(x['cs']); out.append([a['cs'], a['place'], hh(a['tm']), x['cs'], x['place'], hh(x['tm']), a['t'], '1234567', None, ap])
        else:
            out.append([a['cs'], a['place'], hh(a['tm']), None, None, None, a['t'], '1234567', None, ap])
    for x in dep:
        if x['cs'] in used: continue
        if x['tm'] < 11*60: out.append([None, None, None, x['cs'], x['place'], hh(x['tm']), x['t'], '1234567', None, ap])
        else: out.append([None, None, None, x['cs'], x['place'], hh(x['tm']), x['t'], '1234567', None, ap])
    return out
day = sys.argv[3]
rows = rows_for(sys.argv[1], day, 'A') + rows_for(sys.argv[2], day, 'C')
rows.sort(key=lambda r: hm(r[2] or r[5]))
print('[\n' + ',\n'.join('    ' + json.dumps(r).replace('null', 'null').replace('"', "'") for r in rows) + '\n  ]')
print(len(rows), 'rows', file=sys.stderr)
