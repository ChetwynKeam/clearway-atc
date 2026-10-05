// Clearway owner API (Vercel function: /api/admin). Only emails in ADMIN_EMAILS may use it.
// GET                                  every commission, newest first
// POST {action: 'status', id, status, reply}   building / declined / launched, with an optional note to the player
// POST {action: 'release', id}         the airport is built: charge the saved card and unlock it for the player
import { json, fail, preflight, body, user, configured, db, stripeOn, isAdmin, chargeCommission } from './_lib.js';

const list = () => db('commissions?status=neq.cancelled&select=*&order=created_at.desc&limit=200');
async function handle(req){
  if (req.method === 'OPTIONS') return preflight(req);
  if (!configured()) return fail(req, 503, 'Accounts are not switched on yet.');
  const u = await user(req);
  if (!isAdmin(u)) return fail(req, 403, 'This page is for the Clearway team.');
  if (req.method === 'GET') return json(req, { commissions: await list() });
  const b = await body(req);
  try {
    const [c] = await db(`commissions?id=eq.${+b.id}&select=*`);
    if (!c) return fail(req, 404, 'Commission not found.');
    if (b.action === 'status') {
      if (!['building', 'declined', 'launched'].includes(b.status)) return fail(req, 400, 'Unknown status.');
      if (b.status === 'declined' && !['card', 'requested', 'building'].includes(c.status)) return fail(req, 409, 'Only an unpaid commission can be declined.');
      await db(`commissions?id=eq.${c.id}`, { method: 'PATCH', body: { status: b.status, ...(b.reply != null ? { reply: String(b.reply).slice(0, 600) || null } : {}) } });
      return json(req, { commissions: await list() });
    }
    if (b.action === 'release') {
      if (!stripeOn()) return fail(req, 503, 'Payments are not switched on yet.');
      if (!['requested', 'building'].includes(c.status)) return fail(req, 409, c.status === 'card' ? 'The player has not saved a card yet.' : `It is already ${c.status}.`);
      await db(`commissions?id=eq.${c.id}`, { method: 'PATCH', body: { ready_at: new Date().toISOString() } });
      const r = await chargeCommission(c);
      return json(req, { ...r, commissions: await list() });
    }
    return fail(req, 400, 'Unknown action.');
  } catch (e) { console.error(e); return fail(req, 500, 'Something went wrong. Please try again.'); }
}
export const GET = handle, POST = handle, OPTIONS = handle;
