// Clearway live-traffic relay (Vercel function: /api/traffic). Same logic as relay/worker.js; the free ADS-B feeds
// turn away Cloudflare Workers, so this runs on Vercel instead.
// Browsers can't read the free ADS-B feeds directly (no CORS), so this fetches them for the simulator.
// Only fixed upstream URLs are used, so it can't be turned into an open proxy. Add ?debug=1 to see each feed's answer.
const UA = 'Mozilla/5.0 (compatible; clearway-atc relay; +https://github.com/ChetwynKeam/clearway-atc)';
const map = a => ({ hex: a.hex, cs: (a.flight || '').trim(), reg: a.r || '', t: a.t || '', lat: a.lat, lon: a.lon,
  alt: a.alt_baro === 'ground' ? 0 : (a.alt_baro ?? a.alt_geom ?? null), gnd: a.alt_baro === 'ground', gs: a.gs ?? null, trk: a.track ?? a.true_heading ?? null,
  vs: a.baro_rate ?? a.geom_rate ?? 0, sq: a.squawk || '', seen: a.seen_pos ?? a.seen ?? 0 });
const FEEDS = [
  { name: 'adsb.lol', url: (la, lo, r) => `https://api.adsb.lol/v2/point/${la}/${lo}/${r}`, parse: j => (j.ac || []).filter(a => a.lat != null).map(map) },
  { name: 'adsb.fi', url: (la, lo, r) => `https://opendata.adsb.fi/api/v2/lat/${la}/lon/${lo}/dist/${r}`, parse: j => (j.aircraft || j.ac || []).filter(a => a.lat != null).map(map) },
  { name: 'opensky', url: (la, lo, r) => { const dl = r/60, dn = r/(60*Math.cos(la*Math.PI/180)); return `https://opensky-network.org/api/states/all?lamin=${(la - dl).toFixed(2)}&lomin=${(lo - dn).toFixed(2)}&lamax=${(+la + dl).toFixed(2)}&lomax=${(+lo + dn).toFixed(2)}`; },
    parse: j => (j.states || []).filter(s => s[6] != null).map(s => ({ hex: s[0], cs: (s[1] || '').trim(), reg: '', t: '', lat: s[6], lon: s[5],
      alt: s[8] ? 0 : (s[7] != null ? Math.round(s[7]/0.3048) : null), gnd: !!s[8], gs: s[9] != null ? Math.round(s[9]*1.94384) : null, trk: s[10], vs: s[11] != null ? Math.round(s[11]*196.85) : 0, sq: s[14] || '', seen: Math.max(0, (j.time || 0) - (s[3] || j.time || 0)) })) }
];
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS' };
const num = (v, d, lo, hi) => { const n = parseFloat(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'content-type': 'application/json', 'cache-control': 'max-age=4' } });

async function handle(req){
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const u = new URL(req.url);
  const la = num(u.searchParams.get('lat'), 36.15, -90, 90).toFixed(3), lo = num(u.searchParams.get('lon'), -5.35, -180, 180).toFixed(3);
  const r = Math.round(num(u.searchParams.get('r'), 150, 10, 250)), debug = u.searchParams.has('debug'), tried = [];
  for (const f of FEEDS) {
    try {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 7000);
      const res = await fetch(f.url(la, lo, r), { headers: { 'user-agent': UA, 'accept': 'application/json' }, signal: ctl.signal }); clearTimeout(to);
      const body = await res.text();
      if (!res.ok) { tried.push(`${f.name}: HTTP ${res.status} ${body.slice(0, 160)}`); continue; }
      const ac = f.parse(JSON.parse(body));
      if (debug) tried.push(`${f.name}: OK, ${ac.length} aircraft`);
      if (!debug) return json({ now: Date.now()/1000, src: f.name, ac });
    } catch (e) { tried.push(`${f.name}: ${e.message}`); }
  }
  return json(debug ? { tried } : { error: 'feeds unavailable', tried }, debug ? 200 : 502);
}
export const GET = handle, OPTIONS = handle;
