// Clearway account API (Vercel function: /api/account).
// GET  -> the signed-in player's plan and what they may open
// POST {action: 'airports', airports: [ICAO...]}   choose the airports a 1/3/5/10 plan unlocks
// POST {action: 'checkout', plan, early}           start a subscription (Stripe Checkout, 2-day trial the first time)
// POST {action: 'portal'}                          Stripe's billing page: change plan, card, invoices, cancel
// POST {action: 'early', on}                       add or remove the early access add-on
import { json, fail, preflight, body, user, account, saveAccount, entitlement, configured, stripe, stripeOn, PLANS, EARLY_PRICE, SITE_URL, TRIAL_DAYS } from './_lib.js';

const ICAO = /^[A-Z]{4}$/, SWAP_DAYS = 30;

async function handle(req){
  if (req.method === 'OPTIONS') return preflight(req);
  if (!configured()) return fail(req, 503, 'Accounts are not switched on yet.');
  const u = await user(req);
  if (!u) return fail(req, 401, 'Please sign in.');
  let a = await account(u);
  if (req.method === 'GET') return json(req, { email: u.email, ...entitlement(a), billing: !!a.stripe_customer, payments: stripeOn() });
  const b = await body(req), ent = entitlement(a);
  try {
    if (b.action === 'airports') {
      const list = [...new Set((b.airports || []).map(s => String(s).toUpperCase()))].filter(s => ICAO.test(s));
      if (!ent.active) return fail(req, 402, 'Start a trial or a plan first.');
      if (ent.limit === 0) return json(req, entitlement(a));   // Unlimited: nothing to choose
      if (list.length > ent.limit) return fail(req, 400, `Your plan includes ${ent.limit} airport${ent.limit > 1 ? 's' : ''}.`);
      // Fill empty slots any time; swapping one out is free during the trial, then once every 30 days
      const old = a.airports || [], adding = old.every(x => list.includes(x));
      const last = a.airports_changed_at ? Date.parse(a.airports_changed_at) : 0;
      if (!adding && ent.status !== 'trialing' && Date.now() - last < SWAP_DAYS*864e5) {
        const next = new Date(last + SWAP_DAYS*864e5).toISOString().slice(0, 10);
        return fail(req, 409, `You can swap airports again on ${next}.`);
      }
      a = await saveAccount(u.id, { airports: list, ...(adding ? {} : { airports_changed_at: new Date().toISOString() }) });
      return json(req, entitlement(a));
    }
    if (!stripeOn()) return fail(req, 503, 'Payments are not switched on yet.');
    if (b.action === 'portal' || (b.action === 'checkout' && ent.active && a.subscription_id)) {
      if (!a.stripe_customer) return fail(req, 400, 'No billing account yet.');
      const s = await stripe('billing_portal/sessions', { customer: a.stripe_customer, return_url: SITE_URL + '#account' });
      return json(req, { url: s.url });
    }
    if (b.action === 'checkout') {
      const plan = PLANS[b.plan]; if (!plan || !plan.price()) return fail(req, 400, 'Unknown plan.');
      const items = [{ price: plan.price(), quantity: 1 }];
      if (b.early && !plan.early && EARLY_PRICE()) items.push({ price: EARLY_PRICE(), quantity: 1 });
      const s = await stripe('checkout/sessions', {
        mode: 'subscription', client_reference_id: u.id, line_items: items, allow_promotion_codes: 'true',
        ...(a.stripe_customer ? { customer: a.stripe_customer } : { customer_email: u.email }),
        subscription_data: { metadata: { user_id: u.id }, ...(a.trial_used ? {} : { trial_period_days: TRIAL_DAYS }) },
        success_url: SITE_URL + '?checkout=done#account', cancel_url: SITE_URL + '#pricing',
      });
      return json(req, { url: s.url });
    }
    if (b.action === 'early') {
      if (!a.subscription_id || !EARLY_PRICE()) return fail(req, 400, 'Start a plan first.');
      const sub = await stripe(`subscriptions/${a.subscription_id}`);
      const item = sub.items.data.find(i => i.price.id === EARLY_PRICE());
      if (b.on && !item) await stripe('subscription_items', { subscription: sub.id, price: EARLY_PRICE(), quantity: 1, proration_behavior: 'create_prorations' });
      if (!b.on && item) await stripe(`subscription_items/${item.id}`, { proration_behavior: 'create_prorations' }, 'DELETE');
      a = await saveAccount(u.id, { early: !!b.on });   // the webhook confirms it from Stripe moments later
      return json(req, entitlement(a));
    }
    return fail(req, 400, 'Unknown action.');
  } catch (e) { console.error(e); return fail(req, 500, 'Something went wrong. Please try again.'); }
}
export const GET = handle, POST = handle, OPTIONS = handle;
