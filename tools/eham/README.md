# Amsterdam Schiphol (EHAM) build

Sources: the Dutch AIP from LVNL's eAIP (AIRAC AMDT 12/2026, effective 26 November 2026, with AMDT 11/2026 alongside):
AD 2 EHAM (AD 2.12 runways, 2.13 declared distances and the intersection take-off positions, 2.20 local rules, 2.22
procedures and the SID and STAR coding tables), ENR 2.1, 3.1-3.3, 4.1 (navaids) and 4.4 (significant points) and the
charts (ADC, GMC, APDC Centre/K/M/U, the SID, STAR, transition and IAC charts). The Jeppesen trip kit of cycle 05-2025
(EHAM.pdf in the user's folder) is the cross-check only: where it differs from the current eAIP, the eAIP wins.
`.github/workflows/eham-fetch.yml` downloads the eAIP pages and every chart, the approach map's OpenStreetMap layers and
the avionio AMS boards, and publishes them to the `eham-data` branch (the eAIP and Overpass are not reachable from the
workspace).

1. `osm_fetch.py aerodrome.json`: the aerodrome from OpenStreetMap's map API in tiles (taxiway centrelines, aprons,
   terminals, hangars, bridges, airside roads), in the Overpass "out geom" shape the generators read.
2. `chart_feat.py`: georeferences GMC-1 (a similarity transform fitted to the 18R/36L and 04/22 pavement against the
   AD 2.12 coordinates: 7.04 m a point, 0.46° of rotation, within 3.8 m) and reads off it every stop bar (the rows of
   dark lights) and every taxiway designator -> `chart.json`.
3. `stands.py`: every stand's INS coordinates off the APDC charts -> `stands_aip.json` (276 stands). The R-apron is being
   rebuilt and has no stand coordinates in this AIRAC; P20-P26 and the remote holding positions P1-P3 and PA-PD are not
   stands.
4. `parse_procs.py` and `fixes.py`: the AD 2.22 coding tables (86 SIDs and 10 STARs) -> `procs.json`, and the points
   they use (ENR 4.4, ENR 4.1 and the AM-points in the coding tables) -> `fixes.json`. `parse_trans.py`: the ILS and
   RNP approach coding (intermediate and final approach fixes, missed approaches) and the RNAV transitions (the night
   transitions 1B, 1H and 1D to 06, 18C and 18R, and ARTIP 2X to 36R by day) -> `trans.json`.
5. `../eham_ground.py aerodrome.json chart.json stands_aip.json ../../src/airports/eham-ground.js`:
   - the six runways from AD 2.12 (the 18L pavement end 575 m north of its displaced threshold, the 60 m Polderbaan);
   - one holding point per stop bar on the chart, named off the chart; where a bar is just short of where two lanes merge
     on the way to the runway (E1, N3, W3, W10, W11 ...) it goes on just past the merge, so neither lane bypasses it;
   - N2 on E6 north of 09/27 for the southbound crossing; N2N and G6 are crossings only, not exits;
   - the runway-end entries, the AIP's intersection take-off points and their TORA; 06 has no full-length entry, so its
     departures line up at S1 or S10 (2,596 m);
   - the 273 stands at their AIP coordinates, their headings off OpenStreetMap's lead-in lines; the largest wingspan
     each takes worked out from the spacing of the row (the charts give it for few); 76 pairs too close to be used
     together; an apron patch under the stands OpenStreetMap leaves outside its apron outline (K11-K16, M53-M57);
   - G straight on through the G5 junction at the 04 end; junctions where taxiways cross with no shared node; lane stubs
     beyond the last stand and the closed stretch east of E7 pruned; the taxiway bridges (A and B over the A4, V over the
     Hoofdvaart and the Hoofdweg).
6. `make_profile.py boards-2026-11-16.json > ../../src/airports/eham.js`: the profile from `eham.template.js` (runways,
   ILS and missed approaches, frequencies, holds, the STARs to ARTIP, RIVER and SUGOL, the transitions and the SIDs,
   airline and type tables, the preferential runway system: the Besluit luchtverkeer's day and night preference tables,
   AD 2.21's wind and visibility criteria and night runway restrictions, and the winter 2026/27 capacity declaration's
   modes and wave schedule) and the AMS boards
   of Monday 16 November 2026 (from midday; the full day comes with Live now).
7. `../eham_geo.py <eham-data>/geo ../../src/airports/eham.geo.json` (shapely): the approach map, the land less the
   IJsselmeer, the Markermeer and the other lakes.
8. `../vehicles_osm.py EHAM aerodrome.json ../../src/airports/eham-veh.js`, then `../synth_bridges.py EHAM aerodrome.json
   stands_game.json ../../src/airports/eham-veh.js` (stands dumped from the running game): airside roads, the fire
   station, the fuel farm, KLM catering and 42 jet bridges.

Checks: `node tools/ground-audit.cjs eham` (0 issues), `node tools/ground-smoke.cjs eham 120`.
