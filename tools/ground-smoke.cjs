// Ground smoke test: runs an airport with every seat on AI and event traffic, and watches the aircraft on the ground.
// usage: node tools/ground-smoke.cjs [icao] [minutes]  (server on :8765 as for glitch-test.cjs)
//  TURNABOUT  a taxiing aircraft swings round more than 120° within 8 s while moving (turning about on a taxiway)
//  STUCK      a taxiing aircraft, not holding short or waiting, has not moved for 4 minutes
// and counts what moved: pushbacks, departures off the ground, arrivals on stand.
const { chromium } = require('playwright');
const code = process.argv[2] || 'egaa', mins = +process.argv[3] || 90;
(async () => {
  const b = await chromium.launch(), p = await b.newPage(), errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(`http://localhost:8765/dist/${code}/index.html#wx/fair`); await p.waitForTimeout(2500);
  const r = await p.evaluate(mins => {
    try { cwGate = () => true; } catch (e) {}
    for (const k of AI_SEATS) S.seats[k] = 'AI'; try { liveBox.checked = false; } catch (e) {}
    $('trafficSel').value = 'event'; $('hourSel').value = '8'; $('daySel').value = '1'; start();
    const G = [], seen = {}, add = (t, cs, msg) => { if (seen[t + cs]) return; seen[t + cs] = 1; G.push({ t, cs, msg, time: Math.round(S.t) }); };
    const T = {}, C = { push: 0, dep: 0, onStand: 0 }, wasState = {};
    for (let i = 0; i < mins*60; i++) {
      try { step(1); } catch (e) { add('EXC', '-', String(e.message).slice(0, 160)); break; }
      for (const a of S.acs) {
        const st = a.state, ws = wasState[a.cs]; wasState[a.cs] = st;
        if (ws && ws !== st) { if (st === 'PUSH') C.push++; if (!a.ground && ws && /TAKEOFF|LINEUP|ROLL/.test(ws)) C.dep++; if (st === 'ONSTAND' && a.kind === 'ARR') C.onStand++; }
        if (!a.ground || /ONSTAND|PRE|PUSH|READY|PARKED/.test(st)) { delete T[a.cs]; continue; }
        const t = T[a.cs] = T[a.cs] || { h: [], still: 0, x: a.x, y: a.y };
        t.h.push([a.hdg, a.gs || 0, a.x, a.y]); if (t.h.length > 8) t.h.shift();
        if (t.h.length === 8) { const d = Math.abs(((t.h[7][0] - t.h[0][0]) + 540)%360 - 180), moved = Math.hypot(t.h[7][2] - t.h[0][2], t.h[7][3] - t.h[0][3])*1852;
          if (d > 120 && moved > 15 && moved < 120 && !/PULL|PUSH/.test(st)) add('TURNABOUT', a.cs, `${a.kind} ${st} swung ${Math.round(d)}° near ${Math.round(a.x*1852)}, ${Math.round(a.y*1852)} m`); }
        if (Math.hypot(a.x - t.x, a.y - t.y)*1852 < 3) t.still++; else { t.still = 0; t.x = a.x; t.y = a.y; }
        if (t.still === 240 && !/HOLD|WAIT|LINEUP/.test(st) && !a.need) add('STUCK', a.cs, `${a.kind} ${st} still 4 min at ${Math.round(a.x*1852)}, ${Math.round(a.y*1852)} m`);
      }
    }
    return { G, C, t: S.t, n: S.acs.length };
  }, mins);
  console.log(code.toUpperCase(), 'simmed', Math.round(r.t/60), 'min;', JSON.stringify(r.C), '; errors', errs.slice(0, 3).join(' | ') || 'none');
  const by = {}; for (const g of r.G) (by[g.t] = by[g.t] || []).push(g);
  for (const k in by) { console.log(' ', k, by[k].length); for (const g of by[k].slice(0, 6)) console.log('     ', g.cs, g.msg); }
  await b.close();
})();
