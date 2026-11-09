# Geneva (LSGG) build, work in progress

- `extract.py`, `georef.py`, `fixes.py`, `navcalc.py`: pull waypoint symbols, runway anchor and scale bar out of the vACC SID/STAR/approach PDFs
  and chain STAR legs. Output `fixes_nm.json`: fix positions in NM east/north of the runway centre (true north-up chart frame, fitted variation ~5 deg).
- `../lsgg_ground.py`: Bristol generator being adapted to Geneva OSM data (osm-data-lsgg branch). Header, runway, taxiway naming and holds done;
  the stand section (drive-through stands round the three satellites, areas, duplicate ids) is still the Bristol one.
- Still to do: lsgg.js profile, lsgg-engine.js, lsgg-site.js, lsgg-veh.js, geo.json, build/site wiring, satellite shuttle buses, timetable, tests.

## Status (playable)
- `make_profile.py` + `lsgg.template.js` write `src/airports/lsgg.js`; `make_geo.py` writes `lsgg.geo.json` (Lake Geneva is a hand outline: the OSM relation download returned nothing);
  `../lsgg_ground.py` writes `lsgg-ground.js`; `../vehicles_osm.py LSGG` writes `lsgg-veh.js`.
- Satellite stands (31-34, 42-44, 121-127) are drive-through (`out` in the ground data, no push back). Their buses: `APT.shuttle` in `lsgg-engine.js`, `satBay`/`shuttleOut`/`termBay` in `src/vehicles.js`.
- Known simplifications: fix positions are read off charts (about 1 NM accuracy; the chart-derived CBY is nearer than the real one), SIDs are simplified routings, the timetable is a generated representative day.

## Checked against the vACC Switzerland GND charts (GND 01 aerodrome/taxi and GND 02 parking, 11 JUN 26)
- `../lsgg_ground.py` fits a similarity from the parking chart (600 dpi pixels) to the game frame on the three satellite
  centres (`CHART()`); the runway falls on the chart's runway to within a few metres, so chart positions can be used directly.
- Stands: 9-12, 14-19 (with the 141/142 ... 191/192 MARS halves), 21-28 and F7 added from the chart; 61-68 and 89-89C stop
  where the chart's arrows end (OpenStreetMap ran them lane to lane); 3A, 64A and 66A sit between their halves; 41 (not on
  the chart) dropped; the Aero Club stands are I1 and I2. MARS groups are in `lsgg-engine.js` (`MARS`): never centre and half at once.
- Holding points: runway-holding positions only from OpenStreetMap's `holding_position:type=runway`; the CAT II/III ones
  (type ILS, the chart's dashed red bars) are drawn as pattern B (`cat23`). P2 is the CAT II/III point on holding bay P.
  The charts publish no intermediate holding points: IHP1-IHP13 are the painted ones OpenStreetMap has plus four added at
  the busy south-side junctions (Outer at Link 0/1, before D, before Link 5, and A short of C).
- Taxiway names: holding-bay lanes are P and Q (P2/Q2 are holding points, not taxiways); the Outer-Inner connector at F is Link 0.
- Line-ups: A/G at the ends, F (04, 3,200 m) and C (22, 2,000 m) intersections; North Apron traffic uses Q1 (04) or P1 (22)
  and vacates at Q or P. Runway crossings go straight across between the two holds.
