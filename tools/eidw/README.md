# Dublin (EIDW) build

Sources: the AIP Ireland AD 2.24 EIDW charts (AIRAC 10/26) in the project's chart folder, OpenStreetMap (branches
`osm-data-eidw`, `osm-data-eidw-coast`, `eidw-data`, from the `eidw-*.yml` workflows) and a day of the avionio DUB boards.

1. `parse_procs.py <chart pages as text>`: every SID, STAR and approach coding table → `procs.json`.
2. `stands.py`: the stand table of chart 2.24-2 → `stands.json` (191 stands: nose position, wingspan, length, use).
3. `../eidw_ground.py <osm aerodrome.json> stands.json ../../src/airports/eidw-ground.js`: the taxiways, holding points,
   runway links and crossings, stands at their AIP nose positions, aprons and buildings. OSM fixes: the missing stretch
   of N4 and its holding point (aerodrome chart); only the AIP's stands are kept.
4. `make_profile.py boards-2026-11-09.json > ../../src/airports/eidw.js`: the profile, from `eidw.template.js`, the
   parsed procedures, `places.py` (the boards' destinations) and the boards (the timetable).
5. `../eidw_geo.py` (needs shapely; run by `eidw-geo.yml`): the approach map, `src/airports/eidw.geo.json`.
6. `../vehicles_osm.py EIDW` and `../synth_bridges.py EIDW` (airbridges at Piers 2 and 4): `src/airports/eidw-veh.js`.

Simplifications are listed in the Academy briefing (site.html, `e-limits`).
