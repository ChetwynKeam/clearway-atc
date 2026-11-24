# Zurich (LSZH) build

Sources: the Jeppesen Zurich trip kit, terminal chart cycle 07-2023 (LSZH.pdf in the user's folder: the airport briefing
10-1P, the STARs 10-2 to 10-2L, the SIDs 10-3 to 10-3X1, the ILS plates 11-1 to 11-4, the aerodrome charts 10-9 to
10-9E), the helicopter visual approach chart (LSZH-HEL.pdf), Flughafen Zürich's description of the north, east and
south concepts, OpenStreetMap, the avionio ZRH boards and the Iowa Environmental Mesonet METAR archive. The Swiss eAIP
needs a login, so the charts are the reference.

1. `osm_fetch.py aerodrome.json`: the aerodrome from OpenStreetMap's map API in tiles (runways, taxiways, holding
   positions, stands, aprons, terminals, hangars, airside roads), in the Overpass "out geom" shape.
2. `../lszh_ground.py aerodrome.json ../../src/airports/lszh-ground.js`: adapted from `../eham_ground.py`.
   - the runways from OpenStreetMap's runway ways: 16/34 3,700 m with the 34 threshold 455 m in, 14/32 3,300 m with the
     14 threshold 150 m in, 10/28 2,500 m;
   - the holding points from OpenStreetMap's holding positions (the runway ones by their ref, or the link's own name
     where OSM gives only the parallel taxiway's; the CAT II/III ones left out; the intermediate ones as IHPs, A2, B2,
     P1, P2, Y1 and Z1 by name, the rest numbered along their taxiway);
   - crossings only straight over a runway (the diagonal pairings across 10/28 dropped); the north-side stop bars of the
     J and K crossings renamed JN and KN;
   - the intersection take-off points and their take-off run available off the Jeppesen 10-9A (K for 28, E3 for 16, E8
     for 34, L7 and ES for 10);
   - the stands from OpenStreetMap's parking position lines (the stop point the end away from the lane), checked against
     the 10-9D list; a dozen GA stands in dead-end nooks left out (the ground audit).
3. `chart_fixes.py known.json chartfix2.json`: the RNAV points of the SIDs and STARs (ZH4xx, ZH5xx, ZH6xx) read off the
   Jeppesen charts. Each chart's fix symbols are matched to their labels, an affine transform is fitted from the fixes of
   known position on that chart (`known.json`: openscope's LSZH file and the game's airway data) and the others placed by
   it; a second pass uses the first pass's points as anchors. Good to a few hundred metres.
4. `make_profile.py boards-2026-11-23.json > ../../src/airports/lszh.js`: the profile from `lszh.template.js` (runways,
   ILS and missed approaches, frequencies, holds, the STARs to GIPOL, AMIKI and RILAX, one SID set per runway to DEGES,
   GERSA and VEBIT with their first legs worked out from the charts' wording, the operating concepts and the German
   ordinance) and the ZRH boards of Monday 23 November 2026 (585 movements, types by airline and route). The hub's
   inbound and outbound waves (when 16 opens as a second runway) come from the boards' hourly counts.
5. `make_geo.py <osm-data-lszh> > ../../src/airports/lszh.geo.json` (shapely): the approach map, from
   `.github/workflows/lszh-fetch.yml` (Overpass is not reachable from the workspace): the lakes, the borders, the towns
   and the airfields.
6. `wxclim.py`: 1,800 real daytime LSZH METARs (150 a month, 2019-2024) for the "Typical" weather -> `lszh-wx.js`.
7. `../vehicles_osm.py LSZH aerodrome.json ../../src/airports/lszh-veh.js`, then `../synth_bridges.py LSZH aerodrome.json
   stands.json ../../src/airports/lszh-veh.js` (stands dumped from the running game, the dock stands as area `civil`):
   airside roads, the two fire stations, catering and 44 jet bridges at Docks A, B and E.

Checks: `node tools/ground-audit.cjs lszh` (stands 241, score 49: three taxiway crossings OSM leaves unjoined, a few
lead-ins met at a sharp angle), `node tools/ground-smoke.cjs lszh 60`.
