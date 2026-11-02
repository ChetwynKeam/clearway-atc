# Geneva (LSGG) build, work in progress

- `extract.py`, `georef.py`, `fixes.py`, `navcalc.py`: pull waypoint symbols, runway anchor and scale bar out of the vACC SID/STAR/approach PDFs
  and chain STAR legs. Output `fixes_nm.json`: fix positions in NM east/north of the runway centre (true north-up chart frame, fitted variation ~5 deg).
- `../lsgg_ground.py`: Bristol generator being adapted to Geneva OSM data (osm-data-lsgg branch). Header, runway, taxiway naming and holds done;
  the stand section (drive-through stands round the three satellites, areas, duplicate ids) is still the Bristol one.
- Still to do: lsgg.js profile, lsgg-engine.js, lsgg-site.js, lsgg-veh.js, geo.json, build/site wiring, satellite shuttle buses, timetable, tests.

## Status (playable)
- `make_profile.py` + `lsgg.template.js` write `src/airports/lsgg.js`; `make_geo.py` writes `lsgg.geo.json` (Lake Geneva is a hand outline: the OSM relation download returned nothing);
  `../lsgg_ground.py` writes `lsgg-ground.js`; `../vehicles_osm.py LSGG` writes `lsgg-veh.js`.
- Satellite stands (31-34, 41-44, 121-127) are drive-through (`out` in the ground data, no push back). Their buses: `APT.shuttle` in `lsgg-engine.js`, `satBay`/`shuttleOut`/`termBay` in `src/vehicles.js`.
- Known simplifications: fix positions are read off charts (about 1 NM accuracy; the chart-derived CBY is nearer than the real one), SIDs are simplified routings, the timetable is a generated representative day.
