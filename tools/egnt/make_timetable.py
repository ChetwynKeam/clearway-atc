"""Build the TIMETABLE rows of src/airports/egnt.js from Newcastle's real boards (avionio.com, as tools/avionio_flights.py
writes them; the egnt-boards branch, .github/workflows/egnt-boards-fetch.yml). The day is Monday 16 November 2026:
its arrivals, and its departures to 16:45; the boards were read before the evening's departures were listed, so those
are Sunday 15 November's (the same airlines' evening flights, those not already on Monday's board).
Newcastle is a base for Jet2, easyJet, Ryanair and TUI: their aircraft night-stop and fly out first thing, and each of
their arrivals turns round onto the airline's next departure 25-150 minutes later, wherever it goes. Every other airline
flies in and back out to the same place (25-240 minutes on the ground: Ryanair turns round in 25). An arrival left over night-stops; a departure left
over before 11:00 night-stopped (parked at the start); a later one came in from the same place earlier, as the
previous flight number. Row: [arrival, from, arrival UTC, departure, to, departure UTC, type, days, stand].
Usage: make_timetable.py boards.json > rows.js"""
import json, sys, re
ICAO = {'U2': 'EZY', 'EC': 'EJU', 'FR': 'RYR', 'LS': 'EXS', 'BY': 'TOM', 'BA': 'BAW', 'KL': 'KLM', 'A5': 'HOP', 'EK': 'UAE', 'EA': 'EIN',
        'EW': 'EWG', 'D8': 'NSZ', 'SX': 'SXN'}
BASE = {'EZY', 'EJU', 'RYR', 'EXS', 'TOM'}
GROUP = {'EJU': 'EZY'}          # easyJet Europe's flights are easyJet's: one fleet at the base
TYPE = {'EZY': ['A320', 'A20N', 'A319', 'A21N'], 'EJU': ['A320'], 'RYR': ['B738', 'B38M'], 'EXS': ['B738', 'A21N', 'B738'], 'TOM': ['B38M', 'B738'],
        'BAW': ['A320', 'A20N', 'A319'], 'KLM': ['E190', 'E195', 'E295'], 'HOP': ['E190'], 'UAE': ['B77W'], 'EIN': ['AT76'], 'EWG': ['A320'],
        'NSZ': ['B738'], 'SXN': ['C56X']}
PLACE = {'Agadir': 'GMAD', 'Alicante': 'LEAL', 'Amsterdam': 'EHAM', 'Antalya': 'LTAI', 'Barcelona': 'LEBL', 'Belfast': 'EGAA', 'Bristol': 'EGGD',
         'Budapest': 'LHBP', 'Copenhagen': 'EKCH', 'Dubai': 'OMDB', 'Dublin': 'EIDW', 'Duesseldorf': 'EDDL', 'Enfidha': 'DTNH', 'Faro': 'LPFR',
         'Fuerteventura': 'GCFV', 'Funchal': 'LPMA', 'Gdansk': 'EPGD', 'Gran Canaria': 'GCLP', 'Hamburg': 'EDDH', 'Hurghada': 'HEGN',
         'Krakow/Balice': 'EPKK', 'Lanzarote': 'GCRR', 'Lisbon': 'LPPT', 'London': 'EGLL', 'Malaga': 'LEMG', 'Malta': 'LMML', 'Milan': 'LIMC',
         'Paris': 'LFPG', 'Prague': 'LKPR', 'Reykjavik': 'BIKF', 'Rome': 'LIRF', 'Sharm el-Sheikh': 'HESH', 'Southampton': 'EGHI', 'Tenerife': 'GCTS',
         'Vienna': 'LOWW', 'Wroclaw': 'EPWR', 'Bremen': 'EDDW', 'Blackbushe': 'EGLK'}
# the board's "Belfast" is International for easyJet, Belfast City for the rest; Rome is Fiumicino; Milan is Bergamo for Ryanair
PLACE_BY = {('EZY', 'Belfast'): 'EGAA', ('RYR', 'Milan'): 'LIME', ('RYR', 'Rome'): 'LIRF'}
def split(fl): m = re.match(r'^([A-Z0-9]{2})(\d+)$', fl); return (m[1], m[2]) if m else (None, None)
def hm(s): h, m = s.split(':'); return int(h)*60 + int(m)
def hh(m): m %= 1440; return '%02d:%02d' % (m // 60, m % 60)
B = json.load(open(sys.argv[1]))['days']
MON, SUN = B['2026-11-16'], B['2026-11-15']
def conv(r, off):
    a, n = split(r['flight']); al = ICAO.get(a)
    if not al: return None
    place = PLACE_BY.get((al, r['place'])) or PLACE.get(r['place'])
    if not place: return None
    t = TYPE[al][int(n) % len(TYPE[al])]
    return dict(cs=al + n, al=al, grp=GROUP.get(al, al), t=t, place=place, tm=(hm(r['sched']) - off) % 1440)
arr = [x for x in (conv(r, MON['utcOffsetMin']) for r in MON['arr'] if hm(r['sched']) >= 5*60) if x]
dep = [x for x in (conv(r, MON['utcOffsetMin']) for r in MON['dep']) if x]
have = {x['cs'] for x in dep}
dep += [x for x in (conv(r, SUN['utcOffsetMin']) for r in SUN['dep'] if 16*60 + 45 < hm(r['sched']) < 22*60 + 55) if x and x['cs'] not in have]
out, used = [], set()
for a in sorted(arr, key=lambda x: x['tm']):
    if a['grp'] in BASE: c = [x for x in dep if x['cs'] not in used and x['grp'] == a['grp'] and 25 <= x["tm"] - a["tm"] <= 150]
    else: c = [x for x in dep if x['cs'] not in used and x['al'] == a['al'] and x['place'] == a['place'] and 25 <= x["tm"] - a["tm"] <= 240]
    if c:
        x = min(c, key=lambda x: x['tm']); used.add(x['cs']); out.append([a['cs'], a['place'], hh(a['tm']), x['cs'], x['place'], hh(x['tm']), a['t'], '1234567', None])
    else: out.append([a['cs'], a['place'], hh(a['tm']), None, None, None, a['t'], '1234567', None])
for x in dep:
    if x['cs'] in used: continue
    if x['tm'] < 11*60: out.append([None, None, None, x['cs'], x['place'], hh(x['tm']), x['t'], '1234567', None])
    else:
        n = int(x['cs'][3:]); out.append([x['al'] + str(n - 1), x['place'], hh(x['tm'] - 90), x['cs'], x['place'], hh(x['tm']), x['t'], '1234567', None])
out.sort(key=lambda r: hm(r[2] or r[5]))
print('[\n' + ',\n'.join('    ' + json.dumps(r).replace('"', "'") for r in out) + '\n  ]')
print(len(out), 'rows', sum(1 for r in out if r[0]), 'arrivals', sum(1 for r in out if r[3]), 'departures', file=sys.stderr)
