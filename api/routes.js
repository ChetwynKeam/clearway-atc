// Clearway route lookup (Vercel function: /api/routes). Area Control asks where the live aircraft near your sector are
// going: their origin and destination by callsign, from the adsb.lol route set (the community's callsign-to-route data,
// checked against the aircraft's position), then hexdb.io's callsign routes. ?q=CALLSIGN,lat,lon;CALLSIGN,lat,lon (up to 40). Answers
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
  const routes = {}, tried = [];
  // 1. the route set (adsb.im, the source tar1090 uses, mirrored by adsb.lol): checked against each aircraft's position
  for (const url of ['https://adsb.im/api/0/routeset', 'https://api.adsb.lol/api/0/routeset']) {
    try {
      const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 6000);
      const res = await fetch(url, { method: 'POST', headers: { 'user-agent': UA, 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify({ planes }), signal: ctl.signal });
      clearTimeout(to);
      const text = await res.text();
      if (!res.ok || !text.trim()) { tried.push(`${url}: HTTP ${res.status}${text.trim() ? '' : ' (empty)'}`); continue; }
      let list; try { list = JSON.parse(text); } catch (e) { tried.push(`${url}: not JSON`); continue; }
      for (const r of Array.isArray(list) ? list : []) {
        if (!r || !r.callsign || r.plausible === 0 || r.plausible === false) continue;
        // the first and last airport, with their positions and names when the route set gives them
        const A = Array.isArray(r._airports) ? r._airports.filter(a => a && /^[A-Z]{4}$/.test(a.icao || '')) : [];
        if (A.length >= 2) { const f = A[0], l = A[A.length - 1], pt = a => a.lat != null && a.lon != null ? [+a.lat, +a.lon, a.location || a.name || a.icao] : null;
          routes[r.callsign] = [f.icao, l.icao, pt(f), pt(l)]; continue; }
        const c = String(r.airport_codes || '').split('-').filter(x => /^[A-Z]{4}$/.test(x));
        if (c.length >= 2) routes[r.callsign] = [c[0], c[c.length - 1], null, null];
      }
      tried.push(`${url}: OK`); break;
    } catch (e) { tried.push(`${url}: ${e.message}`); }
  }
  // 2. hexdb.io's callsign-to-route table for the rest (one request each, a few at a time)
  const rest = planes.filter(p => !routes[p.callsign]).map(p => p.callsign);
  const one = async cs => {
    try { const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 4000);
      const r = await fetch(`https://hexdb.io/callsign-route?callsign=${encodeURIComponent(cs)}`, { headers: { 'user-agent': UA }, signal: ctl.signal }); clearTimeout(to);
      if (!r.ok) return; const t = (await r.text()).trim(), c = t.split('-').filter(x => /^[A-Z]{4}$/.test(x));
      if (c.length >= 2) routes[cs] = [c[0], c[c.length - 1], null, null];
    } catch (e) {}
  };
  for (let i = 0; i < rest.length; i += 8) await Promise.all(rest.slice(i, i + 8).map(one));
  // 3. where those airports are, for any the route set didn't place (hexdb.io's airport table)
  const need = [...new Set(Object.values(routes).flatMap(r => [r[2] ? null : r[0], r[3] ? null : r[1]]).filter(Boolean))].slice(0, 24), at = {};
  await Promise.all(need.map(async ic => {
    try { const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 4000);
      const r = await fetch(`https://hexdb.io/api/v1/airport/icao/${ic}`, { headers: { 'user-agent': UA }, signal: ctl.signal }); clearTimeout(to);
      if (!r.ok) return; const j = await r.json(); if (j && isFinite(j.latitude) && isFinite(j.longitude)) at[ic] = [+j.latitude, +j.longitude, j.airport || ic];
    } catch (e) {}
  }));
  for (const r of Object.values(routes)) { if (!r[2] && at[r[0]]) r[2] = at[r[0]]; if (!r[3] && at[r[1]]) r[3] = at[r[1]]; }
  return json({ routes, tried });
}
export const GET = handle, OPTIONS = handle;
