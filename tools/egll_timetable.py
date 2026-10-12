"""Build London Heathrow's timetable (the TIMETABLE rows in src/airports/egll.js) from a day of the real boards.
Input: flights.json as avionio_flights.py writes it (the whole day's arrivals and departures, local times).
Each arrival is paired with a later departure by the same airline (the same place first, as the airlines fly
out-and-back), within a turnaround that suits the aircraft: 40-150 minutes for a narrowbody, 90-260 for a widebody.
An arrival left over turns round to where it came from; a departure left over before 09:30 night-stopped at Heathrow
(it is parked there when the session starts), a later one came in from the same place earlier. The busiest hours are
then thinned to CAP movements an hour (the real airport runs about 85 on two runways), dropping whole turnarounds.
Types come from the airline and the distance (the boards don't give them).
Usage: egll_timetable.py flights.json day > rows.js"""
import json, math, random, re, sys

CAP = 40                    # movements an hour, both runways
ICAO = {'BA': 'BAW', 'VS': 'VIR', 'AA': 'AAL', 'UA': 'UAL', 'LH': 'DLH', 'EI': 'EIN', 'LX': 'SWR', 'DL': 'DAL', 'EW': 'EWG', 'AC': 'ACA',
        'SK': 'SAS', 'QR': 'QTR', 'AI': 'AIC', 'IB': 'IBE', 'KL': 'KLM', 'EK': 'UAE', 'VL': 'DLH', 'TP': 'TAP', 'VY': 'VLG', 'AF': 'AFR',
        'LM': 'LOG', 'B6': 'JBU', 'EY': 'ETD', 'SV': 'SVA', 'MS': 'MSR', 'TK': 'THY', 'CX': 'CPA', 'SQ': 'SIA', 'OS': 'AUA', 'AY': 'FIN',
        'LO': 'LOT', 'SN': 'BEL', 'A3': 'AEE', 'MH': 'MAS', 'JL': 'JAL', 'GF': 'GFA', 'TG': 'THA', 'AZ': 'ITY', 'LY': 'ELY', 'QF': 'QFA',
        'WB': 'RWD', 'KM': 'KMM', 'ME': 'MEA', 'FI': 'ICE', 'WS': 'WJA', 'JU': 'ASL', 'KQ': 'KQA', 'AV': 'AVA', 'VN': 'HVN', 'CA': 'CCA',
        '6E': 'IGO', 'CZ': 'CSN', 'OZ': 'AAR', 'KU': 'KAC', 'AS': 'ASA', 'JJ': 'TAM', 'RJ': 'RJA', 'AM': 'AMX', 'NH': 'ANA', 'CI': 'CAL',
        'FB': 'LZB', 'AT': 'RAM', 'AH': 'DAH', 'PK': 'PIA', 'ET': 'ETH', 'KE': 'KAL', 'MU': 'CES', 'WY': 'OMA', 'BR': 'EVA', 'JD': 'CBJ',
        'UL': 'ALK', 'RX': 'RXI'}
# short-haul and long-haul types for each operator: picked by flight number so a flight is always the same type
SHORT = {'BAW': ['A320', 'A320', 'A20N', 'A21N', 'A319', 'A321'], 'DLH': ['A20N', 'A320', 'A321'], 'SWR': ['BCS3', 'A20N', 'A21N'],
         'EIN': ['A20N', 'A320', 'A21N'], 'EWG': ['A20N', 'A319'], 'SAS': ['A20N'], 'IBE': ['A320', 'A21N'], 'KLM': ['B738', 'E195'],
         'TAP': ['A20N', 'A21N'], 'VLG': ['A320', 'A20N'], 'AFR': ['A320', 'A20N'], 'LOG': ['E145'], 'THY': ['A21N', 'A333'],
         'AUA': ['A320', 'A20N'], 'FIN': ['A321'], 'LOT': ['B38M', 'E195'], 'BEL': ['A320'], 'AEE': ['A20N', 'A21N'], 'ITY': ['A20N'],
         'ICE': ['B38M'], 'WJA': ['B38M'], 'ASL': ['A320'], 'LZB': ['A320'], 'DAH': ['B738'], 'RAM': ['B738'], 'MEA': ['A21N'],
         'KMM': ['A20N'], 'MSR': ['B38M', 'A21N'], 'ELY': ['B738'], 'RJA': ['A21N'], 'JBU': ['A21N'], 'SVA': ['A21N']}
LONG = {'BAW': ['B772', 'B77W', 'B788', 'B789', 'B78X', 'A35K', 'B772', 'B789'], 'VIR': ['A35K', 'A339', 'B789'],
        'AAL': ['B772', 'B77W', 'B789', 'B788'], 'UAL': ['B763', 'B772', 'B789', 'B78X'], 'DAL': ['A333', 'A339', 'B763', 'A359'],
        'ACA': ['B789', 'B788', 'B77W', 'A333'], 'QTR': ['A388', 'A35K', 'B77W', 'A359'], 'UAE': ['A388', 'A388', 'B77W'],
        'ETD': ['B789', 'B78X', 'A388'], 'AIC': ['B77W', 'B788', 'A359'], 'SVA': ['B789', 'B77W'], 'MSR': ['B789', 'A333'],
        'CPA': ['A35K', 'B77W'], 'SIA': ['A388', 'A359', 'B77W'], 'MAS': ['A359'], 'JAL': ['A35K', 'B77W'], 'GFA': ['B789'],
        'THA': ['B77W', 'A359'], 'QFA': ['B789', 'A388'], 'RWD': ['A333'], 'KQA': ['B788'], 'AVA': ['B788'], 'HVN': ['B789'],
        'CCA': ['B77W', 'B789'], 'IGO': ['B789'], 'CSN': ['B789', 'A359'], 'AAR': ['A359'], 'KAC': ['B77W'], 'ASA': ['B789'],
        'TAM': ['B789'], 'RJA': ['B788'], 'AMX': ['B789'], 'ANA': ['B77W'], 'CAL': ['A359'], 'RAM': ['B789'], 'PIA': ['B77W'],
        'ETH': ['B789', 'A359'], 'KAL': ['B77W', 'A388'], 'CES': ['A359'], 'OMA': ['B789'], 'EVA': ['B77W'], 'CBJ': ['A359'],
        'ALK': ['A333'], 'RXI': ['B789'], 'THY': ['A333', 'B789'], 'JBU': ['A21N'], 'ELY': ['B789'], 'ICE': ['B38M'], 'WJA': ['B789'],
        'DLH': ['A20N'], 'EIN': ['A21N']}
# British Airways' A380s and 747-replacement routes (2026): the A380 goes where the loads are
BA_A380 = {'Johannesburg', 'Los Angeles', 'Miami', 'San Francisco', 'Dubai', 'Singapore', 'Fort Worth', 'Washington', 'Boston'}
WIDE = {'A332', 'A333', 'A339', 'A359', 'A35K', 'A388', 'B763', 'B772', 'B77W', 'B788', 'B789', 'B78X'}

data = json.load(open(sys.argv[1]))
day = data['days'][sys.argv[2]]
ap = json.load(open(sys.argv[3]))           # {place: [icao, lat, lon]}
off = day['utcOffsetMin']
mins = lambda t: int(t[:2])*60 + int(t[3:])
LHR = (51.4700, -0.4543)
def nm(place):
    a = ap.get(place)
    if not a: return 500
    la1, lo1, la2, lo2 = map(math.radians, (LHR[0], LHR[1], a[1], a[2]))
    return 3440*math.acos(min(1, math.sin(la1)*math.sin(la2) + math.cos(la1)*math.cos(la2)*math.cos(lo2 - lo1)))
def typ(op, num, place):
    long = nm(place) > 2300
    if op == 'BAW' and long and place in BA_A380 and num % 3 == 0: return 'A388'
    lst = (LONG if long else SHORT).get(op) or (['B789'] if long else ['A320'])
    return lst[num % len(lst)]

rows = {'arr': [], 'dep': []}
for k in ('arr', 'dep'):
    for r in day[k]:
        m = re.match(r'^([A-Z0-9]{2})(\d+)$', r['flight'])
        if not m or m.group(1) not in ICAO: continue
        op, num = ICAO[m.group(1)], int(m.group(2))
        rows[k].append({'op': op, 'num': num, 'place': r['place'], 't': mins(r['sched']), 'cs': op + str(num), 'type': typ(op, num, r['place'])})
for k in rows: rows[k].sort(key=lambda r: r['t'])

used = set(); units = []
def win(t): return (90, 260, 150) if t in WIDE else (40, 150, 70)
for a in rows['arr']:
    lo, hi, ideal = win(a['type'])
    cands = [d for d in rows['dep'] if id(d) not in used and d['op'] == a['op'] and lo <= d['t'] - a['t'] <= hi
             and (d['type'] in WIDE) == (a['type'] in WIDE)]
    if not cands: continue
    d = min(cands, key=lambda d: (d['place'] != a['place'], abs(d['t'] - a['t'] - ideal)))
    used.add(id(d)); a['pair'] = d
taken = {r['cs'] for k in rows for r in rows[k]}
def free(op, num, step):
    while op + str(num) in taken: num += step
    taken.add(op + str(num)); return op + str(num)
for a in rows['arr']:
    d = a.get('pair')
    if d: units.append((a['cs'], a['place'], a['t'], d['cs'], d['place'], d['t'], a['type']))
    elif a['t'] < 20*60 + 30:
        lo, hi, ideal = win(a['type'])
        units.append((a['cs'], a['place'], a['t'], free(a['op'], a['num'] + 1, 2), a['place'], a['t'] + ideal, a['type']))
    else: units.append((a['cs'], a['place'], a['t'], None, None, None, a['type']))
for d in rows['dep']:
    if id(d) in used: continue
    lo, hi, ideal = win(d['type'])
    if d['t'] < 9*60 + 30 or d['t'] - ideal < 5*60 + 30: units.append((None, None, None, d['cs'], d['place'], d['t'], d['type']))
    else: units.append((free(d['op'], d['num'] - 1, -2), d['place'], d['t'] - ideal, d['cs'], d['place'], d['t'], d['type']))

# thin the busy hours: whole turnarounds, in a fixed random order, while every hour they touch is under CAP
random.seed(27)
random.shuffle(units)
count, keep = {}, []
hours = lambda u: [t//60 for t in (u[2], u[5]) if t is not None]
for u in units:
    if all(count.get(h, 0) < CAP for h in hours(u)):
        keep.append(u)
        for h in hours(u): count[h] = count.get(h, 0) + 1
keep.sort(key=lambda u: u[2] if u[2] is not None else u[5])
hhmm = lambda t: None if t is None else '%02d:%02d' % (((t - off) % 1440)//60, (t - off) % 60)
icao = lambda p: ap[p][0] if p in ap else None
q = lambda v: 'null' if v is None else "'%s'" % v
out = []
for a, o, ta, d, dd, td, t in keep:
    out.append('[%s, %s, %s, %s, %s, %s, %s]' % (q(a), q(icao(o) if o else None), q(hhmm(ta)), q(d), q(icao(dd) if dd else None), q(hhmm(td)), q(t)))
print('  const ROWS = [\n    ' + ',\n    '.join(', '.join(out[i:i+3]) for i in range(0, len(out), 3)) + '\n  ];')
sys.stderr.write('%d turnarounds kept of %d; movements by local hour: %s\n' % (len(keep), len(units), sorted(count.items())))
