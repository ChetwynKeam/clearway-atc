// Clearway route lookup (Vercel function: /api/routes). Area Control asks where the live aircraft near your sector are
// going: their origin and destination by callsign, from the adsb.lol route set (the community's callsign-to-route data,
// checked against the aircraft's position). ?q=CALLSIGN,lat,lon;CALLSIGN,lat,lon (up to 40). Answers
// { routes: { BAW123: ["EGLL", "KJFK"], ... } }. Only the one fixed upstream URL is used, so it can't be an open proxy.
const UA = 'Mozilla/5.0 (compatible; clearway-atc relay; +https://github.com/ChetwynKeam/clearway-atc)';
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS' };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'content-type': 'application/json', 'cache-control': 'max-age=300' } });

async function handle(req){
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const q = new URL(req.url).searchParams.get('q') || '';
  const planes = q.split(';').slice(0, 40).map(s => s.split(',')).filter(p => /^[A-Z0-9]{2,8}$/.test(p[0] || ''))
    .map(([cs, la, lo]) => ({ callsign: cs, lat: Math.max(-90, Math.min(90, +la || 0)), lng: Math.max(-180, Math.min(180, +lo || 0)) }));
  if (!planes.length) return json({ routes: {} });
  try {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 8000);
    const res = await fetch('https://api.adsb.lol/api/0/routeset', { method: 'POST', headers: { 'user-agent': UA, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ planes }), signal: ctl.signal });
    clearTimeout(to);
    if (!res.ok) return json({ routes: {}, error: `HTTP ${res.status}` }, 200);
    const list = await res.json(), routes = {};
    for (const r of Array.isArray(list) ? list : []) {
      if (!r || !r.callsign || r.plausible === 0 || r.plausible === false) continue;
      const codes = Array.isArray(r._airports) && r._airports.length >= 2 ? r._airports.map(a => a.icao) : String(r.airport_codes || '').split('-');
      const c = codes.filter(x => /^[A-Z]{4}$/.test(x || ''));
      if (c.length >= 2) routes[r.callsign] = [c[0], c[c.length - 1]];
    }
    return json({ routes });
  } catch (e) { return json({ routes: {}, error: e.message }, 200); }
}
export const GET = handle, OPTIONS = handle;
