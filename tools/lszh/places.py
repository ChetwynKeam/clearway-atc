"""Zurich's destinations on the real boards (avionio.com ZRH, Monday 23 November 2026): Schiphol's table (tools/eham/places.py,
which also reads every airport already in the game) and the places it lacks."""
import os, importlib.util
_spec = importlib.util.spec_from_file_location('eham_places', os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'eham', 'places.py'))
_m = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(_m)
AP, _pi = _m.AP, _m.place_icao
AP.update({
 'LSZR': (47.485, 9.561, 'Altenrhein'), 'LSZB': (46.914, 7.499, 'Bern'), 'GVBA': (16.137, -22.889, 'Boa Vista'), 'SKCG': (10.442, -75.513, 'Cartagena'),
 'LRCL': (46.785, 23.686, 'Cluj-Napoca'), 'EDDK': (50.866, 7.143, 'Cologne Bonn'), 'EDDC': (51.133, 13.767, 'Dresden'), 'GMFK': (31.948, -4.401, 'Errachidia'),
 'EDNY': (47.671, 9.511, 'Friedrichshafen'), 'LOWG': (46.991, 15.440, 'Graz'), 'LZKZ': (48.663, 21.241, 'Košice'), 'LICA': (38.909, 16.242, 'Lamezia Terme'),
 'LOWL': (48.233, 14.188, 'Linz'), 'FSIA': (-4.674, 55.522, 'Mahé'), 'VRMM': (4.192, 73.529, 'Malé'), 'LEPA': (39.552, 2.739, 'Palma de Mallorca'),
 'LFBI': (46.588, 0.307, 'Poitiers'), 'BKPR': (42.573, 21.036, 'Pristina'), 'EDDR': (49.215, 7.110, 'Saarbrücken'), 'LWSK': (41.962, 21.621, 'Skopje')})
BOARD = {'Altenrhein': 'LSZR', 'Bern': 'LSZB', 'Boa Vista Island': 'GVBA', 'Cartagena': 'SKCG', 'Cluj-Napoca': 'LRCL', 'Cologne/Bonn': 'EDDK', 'Dresden': 'EDDC',
 'Errachidia': 'GMFK', 'Friedrichshafen': 'EDNY', 'Graz': 'LOWG', 'Kosice': 'LZKZ', 'Lamezia Terme': 'LICA', 'Linz': 'LOWL', 'Mahe Island': 'FSIA', 'Male': 'VRMM',
 'Palma de Mallorca': 'LEPA', 'Poitiers': 'LFBI', 'Pristina': 'BKPR', 'Saarbruecken': 'EDDR', 'Skopje': 'LWSK'}
def place_icao(name, al):
    return BOARD.get(name) or _pi(name, al)
