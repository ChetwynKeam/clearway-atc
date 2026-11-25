# Copenhagen (EKCH) build

Sources: the Jeppesen Copenhagen trip kit, terminal chart cycle 03-2020 (EKCH.pdf in the user's folder: the airport briefing
10-1P to 10-1P8, the STARs 10-2E to 10-2J, the SIDs 10-3B to 10-3X8, the ILS plates 11-1 to 11-6, the aerodrome and
parking charts 10-9 to 10-9C), openscope's EKCH airport file for the fix positions, OpenStreetMap, the avionio CPH boards
and the Iowa Environmental Mesonet METAR archive.

1. `osm_fetch.py aerodrome.json`: the aerodrome from OpenStreetMap's map API in tiles (runways, taxiways, holding
   positions, stands, aprons, terminals, hangars, airside roads), in the Overpass "out geom" shape.
2. `../ekch_ground.py aerodrome.json ../../src/airports/ekch-ground.js`: adapted from `../lszh_ground.py`.
   - the runways from OpenStreetMap's runway ways: 04L/22R 3,600 m with the 22R threshold 600 m in, 04R/22L 3,300 m, 12/30
     2,800 m (the pavement on beyond the 12 end, to take-off position X, kept; thresholds 435 m and 270 m in);
   - the holding points from OpenStreetMap's holding positions, named by their taxiway (A1-A10, B1-B5, E1-E4, K1-K3, V1,
     V2, G1, G2 ...; where a taxiway crosses a runway the sides: AN/AS, BN/BS, DN/DS, CW/CE, F2N/F2S);
   - crossings straight over a runway, and the three on the skew that are real: F2 over 12/30, I and C over 04R/22L; the
     stretches OpenStreetMap carries on inside the B4 and C stop bars dropped;
   - the take-off run available from each entry off the 10-9A (A10 3,000 m for 04L; A1/E1 3,600 m, A2 to A5 for 22R; B1 to
     B4 for 04R; V1 for 22L; K1 (position X), K2, K3 for 12; G1 for 30);
   - the stands from OpenStreetMap's parking position lines (G110-G137 are mapped without their G), checked against the
     10-9C list; the widebody stands E71, E74, E83, E86 and E89 each the middle of three (10-1P4), C27 and C39 code E;
   - the de-icing platform A lanes as waiting places DA1-DA3.
3. `chart_fixes.py known.json chartfix.json`: the charts georeferenced on their known fixes (openscope's and the game's
   airway data), to check them: they agree to a few hundredths of a mile. ERNOV is read off the 10-2E graticule; SOPUL,
   GITPO and TIDVU are worked out in `make_profile.py` from the charts' bearings and distances.
4. `make_profile.py boards-2026-11-24.json > ../../src/airports/ekch.js`: the profile from `ekch.template.js` (runways, ILS
   and missed approaches, frequencies, holds, the STARs with one designator per landing runway, the SIDs of every runway
   to the twelve exit points with their first legs worked out from the charts' wording, the preferential runway system)
   and the CPH boards of Tuesday 24 November 2026 (606 movements), the arrivals paired with departures out and back, or
   else with the next departure of the airline's bank. The arrival and departure banks come from the boards' hourly counts.
5. `make_geo.py land_polygons.shp > ../../src/airports/ekch.geo.json`: the approach map from OpenStreetMap's land
   polygons (osmdata.openstreetmap.de, land-polygons-split-4326): Zealand, Amager, Saltholm, Skåne and the islands.
6. `wxclim.py`: 1,800 real daytime EKCH METARs (150 a month, 2019-2024) for the "Typical" weather -> `ekch-wx.js`.
7. `../vehicles_osm.py EKCH aerodrome.json ../../src/airports/ekch-veh.js`, then `../synth_bridges.py EKCH aerodrome.json
   stands.json ../../src/airports/ekch-veh.js` (stands dumped from the running game, the contact stands as area `civil`):
   airside roads, the fire stations, the fuel farm and 43 jet bridges.

Checks: `node tools/ground-audit.cjs ekch` (stands 131, score 10: five arrivals reach A31's lead-in the wrong way),
`node tools/ground-smoke.cjs ekch 60`.
