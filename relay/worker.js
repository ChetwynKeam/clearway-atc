// Clearway live-traffic relay (Cloudflare Worker).
// Browsers can't read the free ADS-B feeds directly (no CORS), so this fetches them for the simulator.
// Only fixed upstream URLs are used, so it can't be turned into an open proxy.
const FEEDS = [
  (la, lo, r) => `https://api.adsb.lol/v2/point/${la}/${lo}/${r}`,
  (la, lo, r) => `https://opendata.adsb.fi/api/v2/lat/${la}/lon/${lo}/dist/${r}`
];
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS' };
const num = (v, d, lo, hi) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

export default {
  async fetch(req) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const u = new URL(req.url);
    if (u.pathname !== '/traffic') return new Response('Clearway relay: use /traffic', { status: 404, headers: CORS });
    const la = num(u.searchParams.get('lat'), 36.15, -90, 90).toFixed(3), lo = num(u.searchParams.get('lon'), -5.35, -180, 180).toFixed(3);
    const r = Math.round(num(u.searchParams.get('r'), 150, 10, 250));
    for (const f of FEEDS) {
      try {
        const res = await fetch(f(la, lo, r), { headers: { 'user-agent': 'clearway-atc relay (github.com/ChetwynKeam/clearway-atc)' }, cf: { cacheTtl: 4, cacheEverything: true } });
        if (!res.ok) continue;
        const j = await res.json(), list = j.ac || j.aircraft || [];
        const ac = list.filter(a => a.lat != null).map(a => ({ hex: a.hex, cs: (a.flight || '').trim(), reg: a.r || '', t: a.t || '', lat: a.lat, lon: a.lon,
          alt: a.alt_baro === 'ground' ? 0 : (a.alt_baro ?? a.alt_geom ?? null), gnd: a.alt_baro === 'ground', gs: a.gs ?? null, trk: a.track ?? a.true_heading ?? null,
          vs: a.baro_rate ?? a.geom_rate ?? 0, sq: a.squawk || '', seen: a.seen_pos ?? a.seen ?? 0 }));
        return new Response(JSON.stringify({ now: Date.now()/1000, src: new URL(f(0, 0, 1)).hostname, ac }), { headers: { ...CORS, 'content-type': 'application/json', 'cache-control': 'max-age=4' } });
      } catch (e) {}
    }
    return new Response(JSON.stringify({ error: 'feeds unavailable' }), { status: 502, headers: { ...CORS, 'content-type': 'application/json' } });
  }
};
