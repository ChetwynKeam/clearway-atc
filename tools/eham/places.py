"""Schiphol's destinations on the real boards (avionio.com AMS, November 2026): board name -> ICAO (the airport each
airline really uses where a city has several), and positions (deg) for the ones the other airports' tables lack.
Used by make_profile.py, with every airport position already in the game's profiles."""
import json, glob, re, os
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
AP = {}
for f in glob.glob(os.path.join(ROOT, 'src/airports/*.js')):
    for m in re.finditer(r"\b([A-Z]{4}): \[(-?\d+\.\d+), (-?\d+\.\d+), '([^']+)'\]", open(f).read()): AP.setdefault(m[1], (float(m[2]), float(m[3]), m[4]))
for f in glob.glob(os.path.join(ROOT, 'tools/*/places.py')):
    if f.endswith('eham/places.py'): continue
    for m in re.finditer(r"'([A-Z]{4})': \((-?\d+\.\d+), (-?\d+\.\d+), '([^']+)'\)", open(f).read()): AP.setdefault(m[1], (float(m[2]), float(m[3]), m[4]))
AP.update({
 'EKYT': (57.093, 9.849, 'Aalborg'), 'TJBQ': (18.495, -67.129, 'Aguadilla'), 'ENAL': (62.560, 6.120, 'Ålesund'), 'LTAC': (40.128, 32.995, 'Ankara'),
 'LFSB': (47.590, 7.529, 'Basel'), 'EGAA': (54.658, -6.216, 'Belfast International'), 'SKBO': (4.702, -74.147, 'Bogotá'), 'TNCB': (12.131, -68.268, 'Bonaire'),
 'MMUN': (21.037, -86.877, 'Cancún'), 'ZUTF': (30.312, 104.444, 'Chengdu Tianfu'), 'TNCC': (12.189, -68.960, 'Curaçao'), 'CYEG': (53.310, -113.580, 'Edmonton'),
 'LPMA': (32.694, -16.778, 'Madeira'), 'EPGD': (54.378, 18.466, 'Gdańsk'), 'LIMJ': (44.413, 8.838, 'Genoa'), 'ESGG': (57.663, 12.280, 'Gothenburg'),
 'EHGG': (53.120, 6.579, 'Groningen'), 'EDDV': (52.461, 9.685, 'Hanover'), 'EGNJ': (53.574, -0.351, 'Humberside'), 'LTBJ': (38.292, 27.157, 'İzmir'),
 'EPKK': (50.078, 19.785, 'Kraków'), 'ENCN': (58.204, 8.085, 'Kristiansand'), 'EGNM': (53.866, -1.661, 'Leeds Bradford'), 'ESSL': (58.406, 15.680, 'Linköping'),
 'LEMG': (36.675, -4.499, 'Málaga'), 'HEMA': (25.557, 34.584, 'Marsa Alam'), 'LIML': (45.445, 9.277, 'Milan Linate'), 'LIMC': (45.630, 8.723, 'Milan Malpensa'),
 'KMSP': (44.882, -93.222, 'Minneapolis'), 'EDDG': (52.135, 7.685, 'Münster Osnabrück'), 'GMMW': (34.989, -3.028, 'Nador'), 'KJFK': (40.640, -73.779, 'New York JFK'),
 'EGSH': (52.676, 1.283, 'Norwich'), 'EDDN': (49.499, 11.078, 'Nuremberg'), 'RJBB': (34.427, 135.244, 'Osaka Kansai'), 'LFPG': (49.010, 2.548, 'Paris CDG'),
 'EPPO': (52.421, 16.826, 'Poznań'), 'GVNP': (14.924, -23.494, 'Praia'), 'LFRN': (48.072, -1.733, 'Rennes'), 'BIKF': (63.985, -22.606, 'Reykjavík Keflavík'),
 'LIRF': (41.800, 12.239, 'Rome Fiumicino'), 'GVAC': (16.741, -22.949, 'Sal'), 'LIRI': (40.620, 14.911, 'Salerno'), 'MROC': (9.994, -84.209, 'San José'),
 'SBGR': (-23.432, -46.470, 'São Paulo'), 'RKSI': (37.460, 126.441, 'Seoul Incheon'), 'LEZL': (37.418, -5.893, 'Seville'), 'ESSA': (59.652, 17.919, 'Stockholm Arlanda'),
 'LLBG': (32.011, 34.887, 'Tel Aviv'), 'GCTS': (28.045, -16.573, 'Tenerife South'), 'RJAA': (35.765, 140.386, 'Tokyo Narita'), 'RJTT': (35.552, 139.780, 'Tokyo Haneda'),
 'ENVA': (63.458, 10.924, 'Trondheim'), 'EPWR': (51.103, 16.886, 'Wrocław'), 'LSZH': (47.458, 8.548, 'Zurich'), 'EGLL': (51.470, -0.454, 'London Heathrow'),
 'EGKK': (51.148, -0.190, 'London Gatwick'), 'EGGW': (51.875, -0.368, 'London Luton'), 'EGLC': (51.505, 0.055, 'London City'), 'EGSS': (51.885, 0.235, 'London Stansted'),
 'EGAC': (54.618, -5.873, 'Belfast City'), 'EDDL': (51.289, 6.767, 'Düsseldorf'), 'EHAM': (52.309, 4.764, 'Amsterdam')})
BOARD = {'Aalborg': 'EKYT', 'Aguadilla': 'TJBQ', 'Alesund': 'ENAL', 'Ankara': 'LTAC', 'Basel/Mulhouse': 'LFSB', 'Belfast': 'EGAA', 'Bogota': 'SKBO',
 'Bonaire': 'TNCB', 'Cancun': 'MMUN', 'Chengdu': 'ZUTF', 'Curacao': 'TNCC', 'Duesseldorf': 'EDDL', 'Edmonton': 'CYEG', 'Funchal': 'LPMA', 'Gdansk': 'EPGD',
 'Genoa': 'LIMJ', 'Goteborg': 'ESGG', 'Groningen': 'EHGG', 'Hannover': 'EDDV', 'Humberside': 'EGNJ', 'Izmir': 'LTBJ', 'Krakow/Balice': 'EPKK',
 'Kristiansand': 'ENCN', 'Leeds/Bradford': 'EGNM', 'Linkoping': 'ESSL', 'London': 'EGLL', 'Malaga': 'LEMG', 'Marsa Alam': 'HEMA', 'Milan': 'LIML',
 'Minneapolis/Saint Paul': 'KMSP', 'Münster/Osnabrück': 'EDDG', 'Nador': 'GMMW', 'New York': 'KJFK', 'Norwich': 'EGSH', 'Nuremberg': 'EDDN',
 'Osaka': 'RJBB', 'Paris': 'LFPG', 'Poznan': 'EPPO', 'Praia': 'GVNP', 'Rennes': 'LFRN', 'Reykjavik': 'BIKF', 'Rome': 'LIRF', 'Sal Island': 'GVAC',
 'Salerno': 'LIRI', 'San Jose': 'MROC', 'Sao Paulo': 'SBGR', 'Seoul': 'RKSI', 'Sevilla': 'LEZL', 'Stockholm': 'ESSA', 'Tel Aviv-Yafo': 'LLBG',
 'Tenerife': 'GCTS', 'Tokyo': 'RJAA', 'Trondheim': 'ENVA', 'Wroclaw': 'EPWR', 'Zurich': 'LSZH'}
# where an airline uses another of a city's airports: easyJet London Gatwick and Luton, Milan Malpensa; Delta New York JFK
BY_AIRLINE = {('London', 'U2'): 'EGKK', ('Milan', 'U2'): 'LIMC', ('Milan', 'FR'): 'LIME', ('London', 'BA'): 'EGLL', ('London', 'CJ'): 'EGLC',
              ('Belfast', 'U2'): 'EGAA', ('Tokyo', 'KL'): 'RJAA', ('New York', 'DL'): 'KJFK', ('New York', 'UA'): 'KEWR'}
_byname = {}
for k, v in AP.items(): _byname.setdefault(v[2].lower(), k)
def place_icao(name, airline=None):
    return BY_AIRLINE.get((name, airline)) or BOARD.get(name) or _byname.get(name.lower())
