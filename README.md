# Clearway ATC

Browser-based air traffic control simulation, starting with Gibraltar (LXGB): radar, tower and ground, SRA approaches,
Winston Churchill Avenue closures, levanter and live weather, a weekly timetable, spoken commands and accented pilots.

Play it at the GitHub Pages address for this repository.

## Build

`python3 build.py` assembles `src/` into `dist/index.html` (standalone) and `dist/gibraltar-atc.html`.
Copy `dist/index.html` to `index.html` at the repository root to publish.

Subscriptions, feedback and airport requests: see [SUBSCRIPTIONS.md](SUBSCRIPTIONS.md) (all switched off until set up).

## Notes

- Spoken commands use the browser's speech recognition (Chrome, Edge or Safari) and need microphone permission.
- Live METAR comes from the NOAA Aviation Weather Center (aviationweather.gov) and refreshes every 10 minutes.
- Aerodrome data from UK Mil AIP AD 2 LXGB. Airline schedule and town buildings are representative. Not for real-world navigation.
