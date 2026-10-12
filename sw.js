// Clearway service worker: makes the site installable as an app and lets the last-opened pages load without a network.
// Pages are network-first (an update is live on the next launch); the cache is only the offline fallback.
// Everything else (flights.json, metar.txt, the Clearway API, Supabase, Stripe, ADS-B, map tiles, fonts) is never
// touched here, so live data and sign-in behave exactly as in a browser tab.
const CACHE = 'clearway-pages-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
self.addEventListener('fetch', e => {
  const q = e.request, u = new URL(q.url);
  if (q.method !== 'GET' || u.origin !== location.origin) return;
  const page = q.mode === 'navigate', icon = u.pathname.includes('/icons/') || u.pathname.endsWith('/manifest.webmanifest');
  if (!page && !icon) return;
  const key = page ? u.origin + u.pathname : q.url;   // one copy per page, whatever the #hash or ?query
  e.respondWith((async () => {
    try {
      const r = await fetch(q);
      if (r.ok && r.type === 'basic') { const c = r.clone(); caches.open(CACHE).then(cc => cc.put(key, c)).catch(() => {}); }
      return r;
    } catch (err) {
      const hit = await caches.match(key);
      if (hit) return hit;
      if (!page) throw err;
      return new Response('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Clearway: offline</title>'
        + '<body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#0b2a4a;color:#fff;font:16px system-ui,sans-serif;text-align:center">'
        + '<div><h1 style="font-size:22px">You are offline</h1><p>Clearway needs a connection for this page. It will open as soon as you are back online.</p>'
        + '<p><button onclick="location.reload()" style="font:inherit;padding:8px 18px;border:0;border-radius:8px;background:#5b8cff;color:#fff">Try again</button></p></div>',
        { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
  })());
});
