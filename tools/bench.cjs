// Seeded AI benchmark: runs an airport with every seat on AI and event traffic for a number of minutes, with Math.random
// seeded (mulberry32), so two builds (main and a branch) can be compared like for like on identical traffic.
// usage: node tools/bench.cjs <icao> <seed> [minutes] [port]   (python3 -m http.server <port> at the repository root,
// python3 build.py done; NODE_PATH=$(npm root -g) for Playwright). Prints one JSON line:
//  landed, departed, los, ga, div   S.aiScore at the end
//  offArr, offDep                    arrivals and departures scheduled inside the run (offDep counts parked fillers too)
//  tko, wantDep                      take-offs, and departures whose crew was due to call for start-up inside the run
//  stalls                            ground aircraft in TAXI or TOW with a path, gs < 1, not holding short, still 10+ min
//  maxStill                          the longest such wait (s), and who
const { chromium } = require('playwright');
const [code, seed = '1', mins = '60', port = '8765', hour = '8', quiet = ''] = process.argv.slice(2);   // quiet: no emergencies, wind shifts or departure stops
(async () => {
  const b = await chromium.launch(), ctx = await b.newContext(), p = await ctx.newPage(), errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await ctx.route(/^https?:\/\/(?!localhost)/, r => r.abort());   // nothing from outside: no live weather, fonts or flights
  await p.addInitScript(s => { let a = s >>> 0; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0)/4294967296; }; }, +seed*7919 + 17);
  await p.goto(`http://localhost:${port}/dist/${code === 'lxgb' ? '' : code + '/'}index.html#wx/fair`); await p.waitForTimeout(1500);
  const r = await p.evaluate(([mins, hour, quiet]) => {
    try { cwGate = () => true; } catch (e) {}
    for (const k of AI_SEATS) S.seats[k] = 'AI'; try { liveBox.checked = false; } catch (e) {}
    $('trafficSel').value = 'event'; $('hourSel').value = String(hour); try { $('daySel').value = '1'; } catch (e) {} $('otherSel').value = 'off';
    if (quiet) for (const id of ['emgSel', 'windSel', 'flowSel']) { const e = document.getElementById(id); if (e) e.value = 'off'; }
    start(); S.paused = true;
    const offArr = S.sched.filter(f => f.k === 'ARR' && f.m >= 0 && f.m < mins).length, offDep = S.sched.filter(f => f.k !== 'ARR' && f.m < mins).length;
    const still = {}, stalls = [], seen = new Set(), want = new Set(); let max = { s: 0 }, tko = 0;
    S.listeners.push((ev, ac) => { if (ev === 'airborne' && ac && ac.kind === 'DEP') tko++; });
    for (let i = 0; i < mins*60; i++) {
      try { step(1); } catch (e) { return { err: String(e.message).slice(0, 200), t: S.t }; }
      for (const a of S.acs) {
        const st = a.state;
        if (a.kind === 'DEP' && a.reqAt != null && a.reqAt < mins*60) want.add(a.cs);
        const waiting = a.ground && (st === 'TAXI' || st === 'TOW') && a.path && (a.gs || 0) < 1 && !a.hsAt && !a.held;
        if (!waiting) { delete still[a.cs]; continue; }
        const w = still[a.cs] = (still[a.cs] || 0) + 1;
        if (w > max.s) max = { s: w, cs: a.cs, st, x: Math.round(a.x*1852), y: Math.round(a.y*1852), on: a.waiting || a.yieldTo || '' };
        if (w === 600 && !seen.has(a.cs)) { seen.add(a.cs); stalls.push({ cs: a.cs, st, kind: a.kind, t: Math.round(S.t/60), x: Math.round(a.x*1852), y: Math.round(a.y*1852), on: a.waiting || a.yieldTo || (a.gfWait && a.gfWait.cs) || '' }); }
      }
    }
    const A = S.aiScore;
    return { landed: A.landed, departed: A.departed, tko, wantDep: want.size, los: A.los, ga: A.ga, div: A.div, offArr, offDep, stalls: stalls.length, stallList: stalls.slice(0, 8), maxStill: max, air: S.acs.filter(a => a.airborne && a.kind === 'ARR').length };
  }, [+mins, +hour, quiet]);
  console.log(JSON.stringify({ icao: code, seed: +seed, ...r, errs: errs.slice(0, 2) }));
  await b.close();
})();
