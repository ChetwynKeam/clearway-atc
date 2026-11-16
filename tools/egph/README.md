# Edinburgh (EGPH) build

Sources: the UK AIP AD 2 EGPH (AIRAC 10/2026, NATS Aurora eAIP) and its charts (AD 2-EGPH-2-1 aerodrome, 2-2 parking/docking,
2-3 Code E ground movement, 4-1 CTR, 5-1 ATCSMAC, 6-1..6-3 SIDs, 7-1..7-7 STARs, coding tables and holds, 8-1..8-6
approaches), OpenStreetMap (the API's map call for the aerodrome; `.github/workflows/egph-fetch.yml` for the coast and
towns, branch `egph-data`) and the avionio EDI boards.

1. Aerodrome: `curl "https://api.openstreetmap.org/api/0.6/map.json?bbox=-3.405,55.932,-3.320,55.966"`, turned into the
   Overpass "out geom" shape the generators read (ways with their geometry).
2. `chart_fix.py AD2-EGPH-2-2.pdf aerodrome.json chart_fix.json` (pymupdf, scipy): georeferences the parking chart to
   OpenStreetMap's centrelines (median miss 0.5 m) and reads off it: the taxiway nodes OpenStreetMap has off the paint
   (taxiway G's zigzag along the Southeast and Midfield aprons), P1 and H7 (holding points OpenStreetMap lacks), and the
   stand headings where OpenStreetMap has no line or one more than 4° off the chart's.
3. `stands_aip.json`: the parking chart's stand table, every stand's coordinates.
4. `../egph_ground.py aerodrome.json chart_fix.json stands_aip.json ../../src/airports/egph-ground.js`:
   - runway 06/24 from the AIP thresholds and insets (2,558 m); 12/30 is shown on the charts only as disused pavement and is
     not modelled;
   - runway-holding positions A1, B1, C1, D1; every other named bar (A3-A20, B3, C3, D3, E1-E2, F1-F2, G1-G3, H3-H7, L1-L2,
     M1-M4, P1, Q1, S1, V2-V3, W2-W3) as an intermediate holding point;
   - the 81 stands at their AIP coordinates; the MARS-style alternatives (4A, 15, 16, 21, 23, the Turnhouse L/R stands,
     100) never in use with their neighbours; 211 joined to taxiway S, whose axis its lead-in continues;
   - the GA Apron's two marshalled spots (no numbers on the chart), entered off H and left forwards (AD 2.20 item 2:
     aircraft there may be turned nose out and taxi from there); lane stubs beyond the last stands pruned.
5. `make_profile.py boards-2026-11-15.json '15 Nov' > ../../src/airports/egph.js`: the profile from `egph.template.js` and
   the boards of Sunday 15 November 2026 (each row with its airport code), every place on them named for Live now.
6. `../egph_geo.py <egph-data> ../../src/airports/egph.geo.json` (shapely): the approach map.
7. `../vehicles_osm.py EGPH aerodrome.json ../../src/airports/egph-veh.js`, then `../synth_bridges.py EGPH aerodrome.json
   stands.json ../../src/airports/egph-veh.js` (stands dumped from the running game): airside roads, the fire station and
   16 jet bridges at the terminal and the pier.

Checks: `node tools/ground-audit.cjs egph` (0 issues), `node tools/ground-smoke.cjs egph 120` (no turn-abouts or stuck
aircraft). Simplifications are listed in the Academy briefing (site.html, `ed-limits`).
