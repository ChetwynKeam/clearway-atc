// Feedback and airport requests (Vercel function: /api/feedback). Anyone may send; signed-in players are linked to their account.
// POST {kind: 'bug'|'idea'|'praise'|'other', rating 1-5, message, page, airport, email}  -> stored for Chet to read in Supabase
// GET  ?requests                                -> the most requested airports
// POST {kind: 'request', icao, name, reason}     -> one vote per player (early access members' votes count double)
import { json, fail, preflight, body, user, db, configured, anonId, account, entitlement } from './_lib.js';

const cut = (s, n) => String(s == null ? '' : s).trim().slice(0, n);
async function limited(table, voter, max){
  const since = new Date(Date.now() - 10*60e3).toISOString();
  const r = await db(`${table}?voter=eq.${voter}&created_at=gte.${since}&select=id`);
  return r.length >= max;
}
async function handle(req){
  if (req.method === 'OPTIONS') return preflight(req);
  if (!configured()) return fail(req, 503, 'Feedback is not switched on yet.');
  try {
    if (req.method === 'GET') return json(req, { requests: await db('request_tally?select=*&order=votes.desc,last_at.desc&limit=30') });
    const b = await body(req), u = await user(req), voter = u ? u.id : anonId(req);
    if (b.kind === 'request') {
      const icao = cut(b.icao, 4).toUpperCase();
      if (!/^[A-Z0-9]{4}$/.test(icao)) return fail(req, 400, 'Please give the airport’s four-letter ICAO code, for example LEMG.');
      if (await limited('request_votes', voter, 10)) return fail(req, 429, 'Thanks! That is plenty of requests for now.');
      const early = u ? entitlement(await account(u)).early : false;
      await db('request_votes?on_conflict=icao,voter', { method: 'POST', prefer: 'resolution=ignore-duplicates',
        body: { icao, name: cut(b.name, 80) || null, reason: cut(b.reason, 600) || null, voter, user_id: u ? u.id : null, weight: early ? 2 : 1 } });
      return json(req, { ok: true, requests: await db('request_tally?select=*&order=votes.desc,last_at.desc&limit=30') });
    }
    const message = cut(b.message, 4000);
    if (message.length < 3) return fail(req, 400, 'Please write a few words.');
    if (await limited('feedback', voter, 5)) return fail(req, 429, 'Thanks! Please wait a few minutes before sending more.');
    const rating = Math.round(+b.rating);
    await db('feedback', { method: 'POST', body: { kind: ['bug', 'idea', 'praise', 'other'].includes(b.kind) ? b.kind : 'other',
      rating: rating >= 1 && rating <= 5 ? rating : null, message, page: cut(b.page, 120), airport: cut(b.airport, 4) || null,
      email: cut(u ? u.email : b.email, 200) || null, user_id: u ? u.id : null, voter, ua: cut(req.headers.get('user-agent'), 200) } });
    return json(req, { ok: true });
  } catch (e) { console.error(e); return fail(req, 500, 'Something went wrong. Please try again.'); }
}
export const GET = handle, POST = handle, OPTIONS = handle;
