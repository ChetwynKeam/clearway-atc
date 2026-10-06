// Website screenshots taken from the real simulator, with the OpenStreetMap background.
// Runs in GitHub Actions (.github/workflows/shots.yml), where map tiles can load:
//   BASE=http://localhost:8080 OUT=shots node tools/shots/shots.cjs
// Each airport opens a timetable session with emergencies off, and a tidy bot (bot.js) works the
// traffic for a while so the pictures show a well-run session.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const BASE = process.env.BASE || 'http://localhost:8080', OUT = process.env.OUT || 'shots', ONLY = process.env.ONLY;
const BOT = fs.readFileSync(path.join(__dirname, 'bot.js'), 'utf8');
const AIRPORTS = [
  { k: 'kjfk', file: 'new-york-jfk-atc.html', mins: 45, hour: '16', full: true, twr: 1.2, gnd: 1.6 },
  { k: 'eglc', twr: 2.2, file: 'london-city-atc.html', mins: 35, hour: '16' },
  { k: 'lxgb', twr: 2.8, file: 'gibraltar-atc.html', mins: 35, hour: '12' },
  { k: 'lpma', twr: 2.2, file: 'madeira-atc.html', mins: 35, hour: '12' },
  { k: 'lowi', twr: 2, file: 'innsbruck-atc.html', mins: 35, hour: '12' },
];
fs.mkdirSync(OUT, { recursive: true });
const jpg = p => ({ path: path.join(OUT, p), type: 'jpeg', quality: 84 });

async function tiles(pg){
  // wait until every map tile the current view asked for has loaded (or failed)
  for (let i = 0, calm = 0; i < 60 && calm < 3; i++) {
    await pg.waitForTimeout(500);
    const n = await pg.evaluate(() => { let p = 0; TILE.cache.forEach(t => { if (!t.ok && !t.bad) p++; }); return p; });
    calm = n ? 0 : calm + 1;
  }
  return pg.evaluate(() => ({ ok: TILE.ok, err: TILE.err, failed: TILE.failed }));
}
async function view(pg, k, zoom = 1, theme = 'light', pick){
  await pg.evaluate(([k, zoom, theme, pick]) => {
    applyTheme(theme); setView(k); V.scale *= zoom; if (k === 'twr' && zoom > 1.5) { V.cx = RWY_MID[0]; V.cy = RWY_MID[1]; }
    const fin = a => a.kind === 'ARR' && a.airborne && !outOfCtl(a);
    const sel = pick === 'gnd' ? S.acs.find(a => !a.airborne && !outOfCtl(a) && a.path) : S.acs.filter(fin).sort((a, b) => (b.mode === 'FINAL') - (a.mode === 'FINAL'))[0];
    if (sel) select(sel);
  }, [k, zoom, theme, pick]);
  return tiles(pg);
}

(async () => {
  const br = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
  for (const A of AIRPORTS) {
    if (ONLY && !ONLY.split(',').includes(A.k)) continue;
    const ctx = await br.newContext({ viewport: { width: 1600, height: 960 } });
    // live feeds stay off so every run shows the same timetable day; only the map tiles load
    await ctx.route(/adsb|aviationweather|vatsim|vercel|workers\.dev|supabase|stripe/, r => r.abort());
    const pg = await ctx.newPage(), errs = [];
    pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(`${BASE}/${A.file}#sim`); await pg.waitForTimeout(1500);
    await pg.addScriptTag({ content: BOT });
    const sc = await pg.evaluate(([mins, hour]) => {
      const tr = document.getElementById('trafficSel'); tr.value = 'summer'; tr.dispatchEvent(new Event('change'));
      document.getElementById('hourSel').value = hour; document.getElementById('emgSel').value = 'off';
      __start();
      for (let i = 0; i < mins*60; i++) { __step(1); if (i % 5 === 0) __bot(); }
      S.paused = true; return S.score;
    }, [A.mins, A.hour]);
    console.log(A.k, JSON.stringify(sc));
    const scope = pg.locator('#scope');
    if (A.full) {
      console.log(' console', JSON.stringify(await view(pg, 'app', 1.5)));
      await pg.screenshot(jpg(`${A.k}-console.jpg`));
      console.log(' console dark', JSON.stringify(await view(pg, 'app', 1.5, 'dark')));
      await pg.screenshot(jpg(`${A.k}-console-dark.jpg`));
      await pg.addStyleTag({ content: '.scopewrap .toolbar{visibility:hidden}' });
      await pg.addStyleTag({ content: '.scopewrap .toolbar{visibility:visible}' });
      await pg.evaluate(() => { S.paused = false; });
      const [sw] = await Promise.all([ctx.waitForEvent('page'), pg.click('#popStrips')]);
      await sw.setViewportSize({ width: 1960, height: 540 }); await sw.waitForTimeout(2000);
      await sw.screenshot(jpg(`${A.k}-strips.jpg`)); await sw.close(); await pg.waitForTimeout(800);
      await pg.click('#tgFids'); await pg.waitForTimeout(300);
      const [fw] = await Promise.all([ctx.waitForEvent('page'), pg.click('#fidsPop')]);
      await fw.setViewportSize({ width: 1300, height: 720 }); await fw.waitForTimeout(2000);
      await fw.screenshot(jpg(`${A.k}-flights.jpg`)); await fw.close();
      await pg.evaluate(() => { S.paused = true; const f = document.getElementById('tgFids'); if (document.querySelector('.fids:not([hidden])')) f.click(); });
    }
    // tower picture: wait (up to 10 sim minutes) for something on or near the runway
    await pg.evaluate(() => { for (let i = 0; i < 600; i++) { if (S.acs.some(a => !outOfCtl(a) && (a.onRwy || (a.kind === 'ARR' && a.mode === 'FINAL' && finOf(a) && finOf(a).togo < 2.5)))) break; __step(1); if (i % 5 === 0) __bot(); } });
    await pg.addStyleTag({ content: '.scopewrap .toolbar,#score{display:none!important}' });
    console.log(' tower', JSON.stringify(await view(pg, 'twr', A.twr, 'light')));
    await scope.screenshot(jpg(`${A.k}-tower.jpg`));
    console.log(' runway', JSON.stringify(await view(pg, 'twr', A.twr*2.2, 'light')));
    await scope.screenshot(jpg(`${A.k}-runway.jpg`));
    console.log(' ground', JSON.stringify(await view(pg, 'gnd', A.gnd || 1, 'light', 'gnd')));
    await scope.screenshot(jpg(`${A.k}-ground.jpg`));
    console.log(' radar', JSON.stringify(await view(pg, 'app', 1.3, 'light')));
    await scope.screenshot(jpg(`${A.k}-radar.jpg`));
    if (errs.length) console.log(' page errors:', errs);
    await ctx.close();
  }
  await br.close();
})().catch(e => { console.error(e); process.exit(1); });
