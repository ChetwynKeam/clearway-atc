// Clearway live flights board (Vercel function: /api/flights?apt=EIDW). The scheduled GitHub job that writes each
// airport's flights.json is meant to run every 15 minutes, but GitHub runs it every few hours, so its times miss the
// day's delays. A Real world session asks here first: this reads the same avionio.com boards fresh, but only the pages
// around now (from about an hour ago to a few hours ahead), and answers in flights.json's shape. The simulator lays these
// rows over its flights.json, which still covers the rest of the day.
// Only fixed avionio.com board URLs are fetched, so it can't be turned into an open proxy. Answers are cached at
// Vercel's edge for a few minutes, so however many people are playing, each board is read at most that often.
// Same parsing as tools/avionio_flights.py (codeshare rows skipped, times local) and tools/belfast_flights_merge.py.
const UA = 'Mozilla/5.0 (clearway-atc; github.com/ChetwynKeam/clearway-atc)';
// airport: avionio codes (Belfast: International then City, tagged A and C), time zone, board pages to read
const BOARDS = {
  LXGB: null,   // Gibraltar and Madeira read their own airports' sites (scheduled job only)
  EGLC: { codes: ['lcy'], tz: 'Europe/London', pages: [-1, 0, 1] },
  LOWI: { codes: ['inn'], tz: 'Europe/Vienna', pages: [-1, 0, 1] },
  KJFK: { codes: ['jfk'], tz: 'America/New_York', pages: [-1, 0, 1, 2, 3] },
  EGKK: { codes: ['lgw'], tz: 'Europe/London', pages: [-1, 0, 1, 2, 3] },
  LEMD: { codes: ['mad'], tz: 'Europe/Madrid', pages: [-1, 0, 1, 2, 3] },
  EGCC: { codes: ['man'], tz: 'Europe/London', pages: [-1, 0, 1, 2, 3] },
  EGLL: { codes: ['lhr'], tz: 'Europe/London', pages: [-1, 0, 1, 2, 3, 4] },
  EGGD: { codes: ['brs'], tz: 'Europe/London', pages: [-1, 0, 1, 2] },
  EGAA: { codes: ['bfs', 'bhd'], tz: 'Europe/London', pages: [-1, 0, 1], tags: ['A', 'C'] },
  YSSY: { codes: ['syd'], tz: 'Australia/Sydney', pages: [-1, 0, 1, 2, 3] },
  EIDW: { codes: ['dub'], tz: 'Europe/Dublin', pages: [-1, 0, 1, 2] },
  OMDB: { codes: ['dxb'], tz: 'Asia/Dubai', pages: [-1, 0, 1, 2, 3] },
  LSGG: { codes: ['gva'], tz: 'Europe/Zurich', pages: [-1, 0, 1, 2] },
};
const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, OPTIONS' };
const MON = { Jan: 1, Feb: 2, Mar: 3, Apr: 4, May: 5, Jun: 6, Jul: 7, Aug: 8, Sep: 9, Oct: 10, Nov: 11, Dec: 12 };
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
const unesc = s => s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()] ?? m);
const cell = (row, c) => { const m = row.match(new RegExp(`<td class="${c}[^"]*"[^>]*>([\\s\\S]*?)</td>`)); return m ? unesc(m[1].replace(/<[^>]+>/g, ' ')).split(/\s+/).filter(Boolean) : []; };
// the zone's offset from UTC at noon on a day, in minutes (as the Python tool works it out)
const offsetMin = (tz, y, mo, d) => { const p = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'longOffset' }).formatToParts(new Date(Date.UTC(y, mo - 1, d, 12)));
  const m = (p.find(x => x.type === 'timeZoneName') || {}).value.match(/GMT([+-])(\d\d):?(\d\d)?/); return m ? (m[1] === '-' ? -1 : 1)*(+m[2]*60 + +(m[3] || 0)) : 0; };
const nowMonth = tz => +new Intl.DateTimeFormat('en-US', { timeZone: tz, month: 'numeric' }).format(new Date());
const nowYear = tz => +new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric' }).format(new Date());

function parse(pages, tz, tag){
  const days = {}, seen = new Set(), mo = nowMonth(tz), yr = nowYear(tz);
  for (const key of ['arr', 'dep']) {
    for (const [, cls, row] of pages[key].join('').matchAll(/<tr class="tt-row ([^"]*)">([\s\S]*?)<\/tr>/g)) {
      if (cls.includes('tt-child')) continue;   // codeshare of the row above
      const t = cell(row, 'tt-t'), d = cell(row, 'tt-d'), fl = cell(row, 'tt-f');
      if (!t.length || d.length < 2 || !fl.length || !MON[d[1]]) continue;
      const year = yr + (MON[d[1]] < mo - 6 ? 1 : 0), dayKey = `${year}-${String(MON[d[1]]).padStart(2, '0')}-${String(+d[0]).padStart(2, '0')}`;
      const place = cell(row, 'tt-ap').join(' '), k = `${dayKey}|${key}|${t[0]}|${place}`;
      const e = days[dayKey] ||= { utcOffsetMin: offsetMin(tz, year, MON[d[1]], +d[0]), arr: [], dep: [] };
      if (seen.has(k) && !fl[0].startsWith('CJ')) continue;   // BA8454 and CJ8454 are one flight: keep the operator's number
      if (seen.has(k)) e[key] = e[key].filter(r => !(r.sched === t[0] && r.place === place));
      seen.add(k);
      const status = cell(row, 'tt-s').join(' '), m = status.match(/(\d\d:\d\d)/);
      e[key].push({ place, flight: fl[0], sched: t[0], status: status.replace(/\s*\d\d:\d\d\s*/g, ' ').trim(), expected: m ? m[1] : '', ...(tag ? { air: tag } : {}) });
    }
  }
  return days;
}
// one board page. avionio.com answers bursts with HTTP 429, so a turned-away read waits (its Retry-After, at most
// two seconds) and tries once more, and nothing new starts once the time budget is used up
async function page(code, kind, p, log, until){
  for (let i = 0; i < 2 && Date.now() < until; i++) {
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), Math.max(500, Math.min(6000, until - Date.now())));
    let wait = 500;
    try {
      const r = await fetch(`https://www.avionio.com/en/airport/${code}/${kind}?page=${p}`, { headers: { 'user-agent': UA, accept: 'text/html' }, signal: ctl.signal });
      const t = r.ok ? await r.text() : '';
      if (t.includes('tt-row')) { log.push(`${code} ${kind} ${p}: OK`); return t; }
      log.push(`${code} ${kind} ${p}: HTTP ${r.status}${r.ok ? ' (no rows)' : ''}`);
      if (r.ok) return t;   // a real empty page (nothing that far ahead)
      if (r.status === 429) wait = Math.min(2000, (+r.headers.get('retry-after') || 1)*1000);
    } catch (e) { log.push(`${code} ${kind} ${p}: ${e.name === 'AbortError' ? 'timeout' : e.message}`); }
    finally { clearTimeout(to); }
    await new Promise(r => setTimeout(r, wait));
  }
  return '';
}
// two reads at a time, a moment apart; the pages nearest now first, so a cut-short answer still has the next hours
async function pool(jobs, n){ let i = 0; await Promise.all(Array.from({ length: n }, async () => { while (i < jobs.length) { await jobs[i++](); await new Promise(r => setTimeout(r, 150)); } })); }
const json = (o, status = 200, cache = 's-maxage=300, stale-while-revalidate=600') => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'content-type': 'application/json', 'cache-control': 'public, max-age=60', 'cdn-cache-control': cache } });

async function handle(req){
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const u = new URL(req.url), apt = (u.searchParams.get('apt') || '').toUpperCase(), B = BOARDS[apt], debug = u.searchParams.has('debug'), log = [];
  if (!B) return json({ error: 'no live board for this airport' }, 404, 's-maxage=3600');
  const out = { updated: new Date().toISOString().slice(0, 19) + 'Z', source: 'avionio.com', live: true, days: {} };
  let rows = 0;
  const pages = B.codes.map(() => ({ arr: [], dep: [] }));
  const until = Date.now() + 8000, order = B.pages.map((p, j) => j).sort((x, y) => Math.abs(B.pages[x] - 0.5) - Math.abs(B.pages[y] - 0.5));
  await pool(order.flatMap(j => B.codes.flatMap((code, i) => ['arr', 'dep'].map(k => async () => { pages[i][k][j] = await page(code, k === 'arr' ? 'arrivals' : 'departures', B.pages[j], log, until); }))), 2);
  B.codes.forEach((code, i) => {
    for (const [day, v] of Object.entries(parse(pages[i], B.tz, B.tags && B.tags[i]))) {
      const e = out.days[day] ||= { utcOffsetMin: v.utcOffsetMin, arr: [], dep: [] };
      e.arr.push(...v.arr); e.dep.push(...v.dep); rows += v.arr.length + v.dep.length;
    }
  });
  if (debug) return json({ rows, log }, 200, 'no-store');
  if (log.some(l => !/: OK$/.test(l) && !/no rows/.test(l))) out.partial = true;
  if (!rows) return json({ error: 'board unavailable' }, 502, 's-maxage=60');
  for (const v of Object.values(out.days)) for (const k of ['arr', 'dep']) v[k].sort((a, b) => a.sched.localeCompare(b.sched));
  return json(out, 200, out.partial ? 's-maxage=60, stale-while-revalidate=120' : undefined);
}
export const GET = handle, OPTIONS = handle;
