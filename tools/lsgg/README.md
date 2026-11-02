# Geneva (LSGG) build, work in progress

- `extract.py`, `georef.py`, `fixes.py`, `navcalc.py`: pull waypoint symbols, runway anchor and scale bar out of the vACC SID/STAR/approach PDFs
  and chain STAR legs. Output `fixes_nm.json`: fix positions in NM east/north of the runway centre (true north-up chart frame, fitted variation ~5 deg).
- `../lsgg_ground.py`: Bristol generator being adapted to Geneva OSM data (osm-data-lsgg branch). Header, runway, taxiway naming and holds done;
  the stand section (drive-through stands round the three satellites, areas, duplicate ids) is still the Bristol one.
- Still to do: lsgg.js profile, lsgg-engine.js, lsgg-site.js, lsgg-veh.js, geo.json, build/site wiring, satellite shuttle buses, timetable, tests.
