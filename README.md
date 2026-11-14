# Clearway ATC

Browser-based air traffic control simulation, starting with Gibraltar (LXGB): radar, tower and ground, SRA approaches,
Winston Churchill Avenue closures, levanter and live weather, a weekly timetable, spoken commands and accented pilots.

Play it at the GitHub Pages address for this repository.

## Build

`python3 build.py` assembles `src/` into `dist/index.html` (standalone) and `dist/gibraltar-atc.html`.
Copy `dist/index.html` to `index.html` at the repository root to publish.

## Notes

- Spoken commands use the browser's speech recognition (Chrome, Edge or Safari) and need microphone permission.
- Live METAR comes from the NOAA Aviation Weather Center (aviationweather.gov) and refreshes every 10 minutes.
- Aerodrome data from UK Mil AIP AD 2 LXGB. Airline schedule and town buildings are representative. Not for real-world navigation.

## Ground audit

`node tools/ground-audit.cjs [icao ...] [--shots]` (with `python3 build.py` done and `python3 -m http.server 8765` running at
the repository root; needs Playwright) checks every airport's taxiway graph the way the game uses it: islands, dead ends,
unjoined lanes, taxiways that cross with no junction, lanes and stands off the drawn pavement, and, for every stand,
whether it can push and taxi forward to each runway's departure holding points and be reached facing forward from every
runway exit. It writes `tools/audit/REPORT.md` (worst airport first) and, with `--shots`, pictures of each airport's worst spots.
