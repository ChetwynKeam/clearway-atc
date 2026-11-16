#!/usr/bin/env python3
"""src/airports/egph.js from tools/egph/egph.template.js and a day of Edinburgh's real boards.
usage: python3 tools/egph/make_profile.py tools/egph/boards-2026-11-15.json '15 Nov' > src/airports/egph.js
The boards (avionio.com's EDI arrivals and departures, saved with each row's airport code by tools/egph/README.md's
step 2) give every scheduled flight of the day. Each arrival is paired with the same airline's departure back to where
it came from (flight number one up or down, 30 minutes to 7 hours later); failing that, for the base airlines (easyJet,
Ryanair, Jet2, Loganair, British Airways), with the airline's next unpaired departure 35 to 150 minutes later (the
aircraft flying on). Unpaired departures before 10:00 night-stopped; unpaired arrivals after 20:00 stay the night.
Private and air ambulance flights are left out (LONG_STAY and EXTRA have business jets)."""
import json, math, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
ALL = json.load(open(sys.argv[1])); rows = [r for r in ALL if r['date'] == sys.argv[2]]
T = open(os.path.join(HERE, 'egph.template.js')).read()
ICAO = dict(re.findall(r"(\w\w): '([A-Z]{3})'", T[T.index('const AIRLINE_ICAO'):T.index('const AIRLINE_TYPE')]))
ATYPE = dict(re.findall(r"([A-Z]{3}): '(\w+)'", T[T.index('const AIRLINE_TYPE'):T.index('const APRON_OF')]))
# the type by route where the airline flies more than one (representative of each airline's Edinburgh fleet)
def typ(al, n, place):
    if al == 'RYR': return 'B38M' if n % 3 == 0 else 'B738'
    if al in ('EZY', 'EJU'): return ['A320', 'A20N', 'A319', 'A21N', 'A320'][n % 5]
    if al == 'BAW': return 'A20N' if n % 2 else 'A320'
    if al == 'LOG': return 'E145' if place in ('EGNS', 'EGAE', 'EGHH', 'EGTE', 'EGFF', 'EGNX', 'EGHI') else 'AT76'
    if al == 'KLM': return 'E295' if n % 2 else 'E190'
    if al == 'UAL' and place == 'KEWR': return 'B752'
    return ATYPE.get(al, 'A320')
IATA = {'ACE': 'GCRR', 'AGA': 'GMAD', 'AGP': 'LEMG', 'ALC': 'LEAL', 'AMS': 'EHAM', 'ARN': 'ESSA', 'ATH': 'LGAV', 'AYT': 'LTAI', 'BCN': 'LEBL', 'BER': 'EDDB',
    'BFS': 'EGAA', 'BGY': 'LIME', 'BHD': 'EGAC', 'BHX': 'EGBB', 'BOD': 'LFBD', 'BOH': 'EGHH', 'BRS': 'EGGD', 'BRU': 'EBBR', 'BSL': 'LFSB', 'BUD': 'LHBP',
    'BVA': 'LFOB', 'CDG': 'LFPG', 'CIA': 'LIRA', 'CPH': 'EKCH', 'CRL': 'EBCI', 'CWL': 'EGFF', 'DOH': 'OTHH', 'DUB': 'EIDW', 'DUS': 'EDDL', 'DXB': 'OMDB',
    'EMA': 'EGNX', 'EWR': 'KEWR', 'EXT': 'EGTE', 'FAE': 'EKVG', 'FAO': 'LPFR', 'FCO': 'LIRF', 'FKB': 'EDSB', 'FNC': 'LPMA', 'FRA': 'EDDF', 'FUE': 'GCFV',
    'GDN': 'EPGD', 'GLA': 'EGPF', 'GVA': 'LSGG', 'HEL': 'EFHK', 'HRG': 'HEGN', 'IOM': 'EGNS', 'IST': 'LTFM', 'JFK': 'KJFK', 'KEF': 'BIKF', 'KOI': 'EGPA',
    'KRK': 'EPKK', 'KUN': 'EYKA', 'LBG': 'LFPB', 'LCY': 'EGLC', 'LDY': 'EGAE', 'LEJ': 'EDDP', 'LGW': 'EGKK', 'LHR': 'EGLL', 'LIN': 'LIML', 'LIS': 'LPPT',
    'LPA': 'GCLP', 'LSI': 'EGPB', 'LTN': 'EGGW', 'LUX': 'ELLX', 'MAD': 'LEMD', 'MLA': 'LMML', 'MUC': 'EDDM', 'MXP': 'LIMC', 'NBE': 'DTNH', 'NOC': 'EIKN',
    'NRN': 'EDLV', 'OPO': 'LPPR', 'ORK': 'EICK', 'ORY': 'LFPO', 'OSL': 'ENGM', 'OTP': 'LROP', 'PEK': 'ZBAA', 'PFO': 'LCPH', 'PHL': 'KPHL', 'POZ': 'EPPO',
    'PRG': 'LKPR', 'RAK': 'GMMX', 'RZE': 'EPRZ', 'SAW': 'LTFJ', 'SDR': 'LEXJ', 'SEN': 'EGMC', 'SNN': 'EINN', 'SOF': 'LBSF', 'SOU': 'EGHI', 'STN': 'EGSS',
    'SVQ': 'LEZL', 'SYY': 'EGPO', 'TFS': 'GCTS', 'TIA': 'LATI', 'VCE': 'LIPZ', 'VIE': 'LOWW', 'WIC': 'EGPC', 'WMI': 'EPMO', 'WRO': 'EPWR', 'ZRH': 'LSZH'}
# coordinates: the other airports' profiles and the airway data, and these
CO = {}
for f in os.listdir(os.path.join(ROOT, 'src/airports')):
    if f.endswith('.js') and not re.search(r'ground|veh|egph', f):
        for m in re.finditer(r"\b([A-Z]{4}): \[(-?\d+\.\d+), (-?\d+\.\d+), '([^']+)'\]", open(os.path.join(ROOT, 'src/airports', f)).read()): CO.setdefault(m[1], [float(m[2]), float(m[3]), m[4]])
s = open(os.path.join(ROOT, 'src/awy-data.js')).read(); AW = json.loads(s[s.index('{'):s.rindex('}') + 1])
for k, v in AW['ap'].items(): CO.setdefault(k, v)
CO.update({'EDDP': [51.4239, 12.2364, 'Leipzig'], 'EKVG': [62.0636, -7.2772, 'Vágar'], 'EDSB': [48.7794, 8.0805, 'Karlsruhe/Baden-Baden'],
    'LFOB': [49.4544, 2.1128, 'Paris Beauvais'], 'LIRA': [41.7994, 12.5949, 'Rome Ciampino'], 'LFPB': [48.9694, 2.4414, 'Paris Le Bourget'],
    'LIML': [45.4451, 9.2767, 'Milan Linate'], 'ELLX': [49.6233, 6.2044, 'Luxembourg'], 'EDLV': [51.6024, 6.1422, 'Weeze'], 'LFPO': [48.7233, 2.3794, 'Paris Orly'],
    'LTFJ': [40.8986, 29.3092, 'Istanbul Sabiha Gökçen'], 'EGMC': [51.5714, 0.6956, 'Southend'], 'EGPO': [58.2156, -6.3311, 'Stornoway'],
    'EGPC': [58.4589, -3.0931, 'Wick'], 'EGPB': [59.8789, -1.2956, 'Sumburgh'], 'EGPA': [58.9578, -2.9050, 'Kirkwall'], 'EGPH': [55.9500, -3.3725, 'Edinburgh'],
    'EGNT': [55.0375, -1.6917, 'Newcastle'], 'EGPD': [57.2019, -2.1978, 'Aberdeen'], 'EGPF': [55.8719, -4.4331, 'Glasgow'],
    'LIME': [45.6739, 9.7042, 'Milan Bergamo'], 'EPMO': [52.4511, 20.6518, 'Warsaw Modlin'], 'EPRZ': [50.1100, 22.0190, 'Rzeszów'], 'LEXJ': [43.4271, -3.8200, 'Santander']})
ARP = (55.95, -3.3725)
def brg(a, b):
    la1, lo1, la2, lo2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    return (math.degrees(math.atan2(math.sin(lo2 - lo1)*math.cos(la2), math.cos(la1)*math.sin(la2) - math.sin(la1)*math.cos(la2)*math.cos(lo2 - lo1))) + 360) % 360
# the direction a place is flown to and from: north (GRICE, PTH 1G), the Atlantic (GOSAM, TUNSO 1E), Ireland and the
# Isle of Man (GOSAM, GIRVA 1E), south (Talla, INPIP 1E), south-east (Talla and Y96, AGPED 1E), east (Saint Abbs, AGPED 1E)
def gate(ic):
    if ic.startswith('K') or ic in ('BIKF', 'EKVG', 'EGPO'): return 'W' if ic.startswith('K') else 'N'
    if ic[:2] in ('EI',) or ic in ('EGAA', 'EGAC', 'EGAE', 'EGNS'): return 'WA'
    b = brg(ARP, CO[ic])
    if b >= 300 or b < 45: return 'N'
    if b < 105 and CO[ic][0] >= 52: return 'E'                     # the Middle East (Doha, Dubai) goes south-east
    if b < 165 or b < 105: return 'SE'
    if b < 230: return 'S'
    return 'WA'
hm = lambda s: int(s[:2])*60 + int(s[3:5]); hh = lambda m: '%02d:%02d' % ((m % 1440)//60, m % 60)
fl = []
for r in rows:
    m = re.match(r'^([A-Z0-9]{2})(\d+)$', r['flight'])
    if not m or m[1] not in ICAO or r['iata'] not in IATA: continue
    fl.append(dict(kind=r['kind'], al=ICAO[m[1]], n=int(m[2]), place=IATA[r['iata']], t=hm(r['sched'])))
arrs = sorted([f for f in fl if f['kind'] == 'arr'], key=lambda f: f['t']); deps = sorted([f for f in fl if f['kind'] == 'dep'], key=lambda f: f['t'])
used, TT = set(), []
cs = lambda f: f"{f['al']}{f['n']}"
for a in arrs:
    d = next((d for d in deps if id(d) not in used and d['al'] == a['al'] and d['place'] == a['place'] and abs(d['n'] - a['n']) <= 1 and 30 <= d['t'] - a['t'] <= 420), None)
    if not d and a['al'] in ('EZY', 'EJU', 'RYR', 'RUK', 'EXS', 'LOG', 'BAW', 'CFE'):
        d = next((d for d in deps if id(d) not in used and d['al'] == a['al'] and 35 <= d['t'] - a['t'] <= 150), None)
    if d: used.add(id(d)); TT.append([cs(a), a['place'], hh(a['t']), cs(d), d['place'], hh(d['t']), typ(a['al'], a['n'], a['place'])])
    elif a['t'] >= 20*60: TT.append([cs(a), a['place'], hh(a['t']), None, None, None, typ(a['al'], a['n'], a['place'])])
    else: TT.append([cs(a), a['place'], hh(a['t']), None, None, None, typ(a['al'], a['n'], a['place'])])
for d in deps:
    if id(d) in used: continue
    TT.append([None, None, None, cs(d), d['place'], hh(d['t']), typ(d['al'], d['n'], d['place'])])
TT.sort(key=lambda r: hm(r[2] or r[5]))
print('rows', len(TT), 'arrivals', sum(1 for r in TT if r[0]), 'departures', sum(1 for r in TT if r[3]), file=sys.stderr)
js = lambda o: json.dumps(o).replace('"', "'").replace("'null'", 'null')
aps = sorted({r[1] for r in TT if r[1]} | {r[4] for r in TT if r[4]} | {IATA[r['iata']] for r in ALL if r['iata'] in IATA} | {'EGPH', 'EGPF', 'EGNT', 'EGPD', 'EGPB', 'EGPA', 'EGPE'})
miss = [a for a in aps if a not in CO]
if miss: sys.exit('no coordinates for ' + ', '.join(miss))
out = T.replace('@@TIMETABLE@@', ',\n    '.join(js(r + ['1234567', None]) for r in TT))
out = out.replace('@@AIRPORTS@@', ',\n    '.join(', '.join(f"{k}: [{CO[k][0]:.4f}, {CO[k][1]:.4f}, {json.dumps(CO[k][2], ensure_ascii=False)}]" for k in aps[i:i + 3]) for i in range(0, len(aps), 3)).replace('"', "'"))
names = {}
for r in ALL:   # every place on the boards, for Live now
    if r['iata'] in IATA: names.setdefault(r['place'].lower(), IATA[r['iata']])
names.update({'london': 'EGLL', 'london heathrow': 'EGLL', 'london gatwick': 'EGKK', 'london city': 'EGLC', 'london luton': 'EGGW', 'london stansted': 'EGSS',
    'belfast city': 'EGAC', 'belfast': 'EGAA', 'paris': 'LFPG', 'milan': 'LIMC', 'rome': 'LIRF', 'istanbul': 'LTFM', 'new york': 'KEWR', 'brussels': 'EBBR',
    'duesseldorf': 'EDDL', 'glasgow': 'EGPF', 'newcastle': 'EGNT', 'aberdeen': 'EGPD', 'inverness': 'EGPE'})
out = out.replace('@@PLACES@@', ',\n    '.join(', '.join(f"'{k}': '{v}'" for k, v in sorted(names.items())[i:i + 5]) for i in range(0, len(names), 5)))
pd = {k: gate(k) for k in aps if k != 'EGPH'}
out = out.replace('@@PLACE_DIR@@', ',\n    '.join(', '.join(f"{k}: '{v}'" for k, v in sorted(pd.items())[i:i + 10]) for i in range(0, len(pd), 10)))
sys.stdout.write(out)
