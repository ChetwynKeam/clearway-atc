"""Copenhagen's destinations on the real boards (avionio.com CPH, Tuesday 24 November 2026): Zurich's table (tools/lszh/places.py,
Schiphol's with every airport already in the game) and the places it lacks."""
import os, importlib.util
_spec = importlib.util.spec_from_file_location('lszh_places', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'lszh', 'places.py'))
_m = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(_m)
AP, _pi = _m.AP, _m.place_icao
AP.update({
 'EKAH': (56.300, 10.619, 'Aarhus'), 'EKRN': (55.063, 14.760, 'Bornholm'), 'EKVG': (62.064, -7.277, 'Vágar'), 'ESOK': (59.444, 13.337, 'Karlstad'),
 'EKKA': (56.297, 9.124, 'Karup'), 'EYPA': (55.973, 21.094, 'Palanga'), 'VTSG': (8.099, 98.986, 'Krabi'), 'EDDP': (51.432, 12.242, 'Leipzig/Halle'),
 'EGNX': (52.831, -1.328, 'East Midlands'), 'BGGH': (64.191, -51.678, 'Nuuk'), 'EKSB': (54.964, 9.792, 'Sønderborg'), 'ENTC': (69.683, 18.919, 'Tromsø')})
BOARD = {'Aarhus': 'EKAH', 'Bornholm': 'EKRN', 'Faroe Islands': 'EKVG', 'Karlstad': 'ESOK', 'Karup': 'EKKA', 'Klaipeda/Palanga': 'EYPA', 'Krabi': 'VTSG',
 'Leipzig/Halle': 'EDDP', 'Nottingham': 'EGNX', 'Nuuk': 'BGGH', 'Sonderborg': 'EKSB', 'Tromso': 'ENTC'}
def place_icao(name, al):
    return BOARD.get(name) or _pi(name, al)
