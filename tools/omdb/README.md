# Dubai International (OMDB) build

Sources: the UAE eAIP AD 2 OMDB page and its charts (AIRAC 08/2026) and ENR 4.4, OpenStreetMap, and the avionio DXB
boards, all downloaded by `.github/workflows/omdb-fetch.yml` (branch `omdb-data`) and `omdb-enr.yml` (branch `omdb-enr`).

1. `stands.json`: the stand tables of the parking/docking charts AD 2-22A, 2-22B and 2-22C (`pdftotext -raw`): every
   stand's nose position and elevation; its code (C, D, E, F) read off the charts' colour key round each stand's table row.
   E30-E38 are box stands with no published position (OpenStreetMap's are used). H1-H4 (Dubai Air Wing) are not airline stands.
2. `chart_ihps.py <OMDB-AD-2-26.pdf>`: every named intermediate holding point of the stop bar chart, its stop bar's position
   (red dot rows in the rendering, georeferenced to the runways' published ends to about 4 m) → `ihps_chart.json`.
3. `../omdb_ground.py <aerodrome.json> stands.json ../../src/airports/omdb-ground.js`: taxiways, holding points, runway links
   and crossings, stands at their AIP nose positions, aprons and buildings. Checked against the charts:
   - all 72 runway holding points match the stop bar chart by name; OpenStreetMap's wrong or missing names corrected
     (M5A and N5 carried M5B's and M6's names, K12 is mapped as K21, M7B and M21 were unnamed; the duplicate M12B and the
     R stop line on M16 dropped);
   - all 141 intermediate holding points carry the chart's names (KB, NC, ZF, J1A ...): matched to OpenStreetMap's stop
     lines, the 29 it does not have added on the taxiway centreline at the chart's bar;
   - the links OpenStreetMap runs on under a neighbour's name take the chart's (J3, M5A, N5, M7B);
   - taxiway V (helicopters), K east of K18 (closed) and Apron S (no live movements) left out;
   - OpenStreetMap maps Dubai's junction curves itself, so the generator adds its own curve only at a corner that has none
     (none where a mapped curve starts, where the two arms meet again, or within 28 m of another junction).
4. `parse_procs.py <AD-2.OMDB html> <ENR-4.4 html>`: every SID, STAR and approach coding table, with ENR 4.4's coordinates
   → `procs.json`.
5. `make_profile.py <omdb_flights.json> > ../../src/airports/omdb.js`: the profile from `omdb.template.js`, the primary STARs,
   every SID, `places.py` (the boards' destinations) and the timetable: the real boards of 9-10 November 2026 (the night's
   arrivals and the evening's departures) filled out with each flight's turnaround and the day's other bank.
6. `../omdb_geo.py <omdb-data dir> ../../src/airports/omdb.geo.json` (needs shapely): the approach map.
7. `../vehicles_osm.py OMDB <aerodrome.json> ../../src/airports/omdb-veh.js`: airside roads, jet bridges, fire station, fuel farm.

Simplifications are listed in the Academy briefing (site.html, `dx-limits`).
