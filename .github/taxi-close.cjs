// temporary: close-up ground views with the real map tiles (removed before merge) v2
const { chromium } = require('playwright');
const fs = require('fs');
const BASE = process.env.BASE, OUT = process.env.OUT;
const BOT = fs.readFileSync('tools/shots/bot.js', 'utf8');
const AP = [['kjfk','new-york-jfk-atc.html','16'],['eglc','london-city-atc.html','16'],['lxgb','gibraltar-atc.html','12'],['lpma','madeira-atc.html','12'],['lowi','innsbruck-atc.html','12'],['egkk','london-gatwick-atc.html','12']];
fs.mkdirSync(OUT, { recursive: true });
async function tiles(pg){ for (let i = 0, calm = 0; i < 60 && calm < 3; i++) { await pg.waitForTimeout(500); const n = await pg.evaluate(() => { let p = 0; TILE.cache.forEach(t => { if (!t.ok && !t.bad) p++; }); return p; }); calm = n ? 0 : calm + 1; } }
(async () => {
  const br = await chromium.launch();
  for (const [k, file, hour] of AP) {
    const ctx = await br.newContext({ viewport: { width: 1600, height: 960 } });
    await ctx.route(/adsb|aviationweather|vatsim|vercel|workers\.dev|supabase|stripe/, r => r.abort());
    const pg = await ctx.newPage();
    await pg.goto(`${BASE}/${file}#sim`); await pg.waitForTimeout(1500);
    await pg.addScriptTag({ content: BOT });
    await pg.evaluate(([hour]) => { const tr = document.getElementById('trafficSel'); tr.value = 'summer'; tr.dispatchEvent(new Event('change'));
      document.getElementById('hourSel').value = hour; document.getElementById('emgSel').value = 'off'; __start();
      for (let i = 0; i < 1500; i++) { __step(1); if (i % 5 === 0) __bot(); } S.paused = true; }, [hour]);
    await pg.addStyleTag({ content: '.scopewrap .toolbar,#score{display:none!important}' });
    for (const th of ['light', 'dark']) {
      await pg.evaluate(([th]) => { applyTheme(th); setView('gnd'); const st = STANDS[Math.floor(STANDS.length/3)]; V.cx = st.p[0]; V.cy = st.p[1]; V.scale *= 3; }, [th]);
      await tiles(pg);
      await pg.locator('#scope').screenshot({ path: `${OUT}/${k}-close-${th}.jpg`, type: 'jpeg', quality: 84 });
    }
    await ctx.close();
  }
  await br.close();
})().catch(e => { console.error(e); process.exit(1); });
