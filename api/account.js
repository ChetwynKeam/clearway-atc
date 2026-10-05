// Clearway account API (Vercel function: /api/account).
// GET  -> the signed-in player's plan and what they may open
// POST {action: 'airports', airports: [ICAO...]}   choose the airports a 1/3/5/10 plan unlocks
// POST {action: 'checkout', plan, early}           start a subscription (Stripe Checkout, 2-day trial the first time)
// POST {action: 'portal'}                          Stripe's billing page: change plan, card, invoices, cancel
// POST {action: 'early', on}                       add or remove the early access add-on
// POST {action: 'commission', icao, name, notes}   ask for an airport to be built: save a card now, charged only on release
// POST {action: 'commission_card', id}             save the card for a commission that has none yet
// POST {action: 'commission_pay', id}              pay by hand if the release charge needed the player (Stripe Checkout)
// POST {action: 'commission_cancel', id}           withdraw a commission before it is released (nothing is charged)
import { json, fail, preflight, body, user, account, saveAccount, entitlement, configured, stripe, stripeOn, db, customerOf, commissionCardSession,
  PLANS, EARLY_PRICE, COMMISSION_PENCE, SITE_URL, TRIAL_DAYS } from './_lib.js';

const ICAO = /^[A-Z]{4}$/, SWAP_DAYS = 30, COUPON = () => (process.env.STRIPE_COUPON || '').trim();

async function handle(req){
  if (req.method === 'OPTIONS') return preflight(req);
  if (!configured()) return fail(req, 503, 'Accounts are not switched on yet.');
  const u = await user(req);
  if (!u) return fail(req, 401, 'Please sign in.');
  let a = await account(u);
  const mine = () => db(`commissions?user_id=eq.${u.id}&status=neq.cancelled&select=id,created_at,icao,name,notes,status,price_pence,reply,ready_at,paid_at,public_from&order=created_at.desc`).catch(() => []);
  const cardFor = async c => json(req, { url: (await commissionCardSession(c, await customerOf(u, a))).url });
  if (req.method === 'GET') return json(req, { email: u.email, ...entitlement(a), billing: !!a.stripe_customer, payments: stripeOn(), commissions: await mine() });
  const b = await body(req), ent = entitlement(a);
  try {
    if (b.action === 'commission') {
      if (!stripeOn()) return fail(req, 503, 'Payments are not switched on yet.');
      const icao = String(b.icao || '').toUpperCase().trim(), clip = (v, n) => String(v || '').trim().slice(0, n) || null;
      if (!ICAO.test(icao)) return fail(req, 400, 'Please give the airport’s four-letter ICAO code.');
      const open = (await mine()).filter(c => ['card', 'requested', 'building', 'ready'].includes(c.status));
      const again = open.find(c => c.icao === icao && c.status === 'card');   // started before but the card was not saved
      if (again) return await cardFor({ ...again, user_id: u.id });
      if (open.some(c => c.icao === icao)) return fail(req, 409, `You have already commissioned ${icao}.`);
      if ((a.owned || []).includes(icao)) return fail(req, 409, `${icao} is already yours.`);
      if (open.length >= 3) return fail(req, 429, 'You can have three commissions waiting at a time.');
      const [c] = await db('commissions', { method: 'POST', prefer: 'return=representation',
        body: { user_id: u.id, email: u.email, icao, name: clip(b.name, 80), notes: clip(b.notes, 1500), price_pence: COMMISSION_PENCE(), status: 'card' } });
      return await cardFor(c);
    }
    if (b.action === 'commission_card') {
      const [c] = await db(`commissions?id=eq.${+b.id}&user_id=eq.${u.id}&status=eq.card&select=*`);
      if (!c) return fail(req, 404, 'Commission not found.');
      if (!stripeOn()) return fail(req, 503, 'Payments are not switched on yet.');
      return await cardFor(c);
    }
    if (b.action === 'commission_cancel') {
      const [c] = await db(`commissions?id=eq.${+b.id}&user_id=eq.${u.id}&status=in.(card,requested,building)`, { method: 'PATCH', body: { status: 'cancelled' }, prefer: 'return=representation' });
      // forget the saved card too
      if (c && c.payment_method && stripeOn()) await stripe(`payment_methods/${c.payment_method}/detach`, {}).catch(e => console.error(e.message));
      return json(req, { commissions: await mine() });
    }
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
    if (b.action === 'commission_pay') {
      const [c] = await db(`commissions?id=eq.${+b.id}&user_id=eq.${u.id}&select=*`);
      if (!c) return fail(req, 404, 'Commission not found.');
      if (c.status !== 'ready') return fail(req, 409, c.status === 'paid' ? 'Already paid: it is yours.' : 'You pay once the airport is released.');
      const s = await stripe('checkout/sessions', {
        mode: 'payment', client_reference_id: u.id,
        line_items: [{ quantity: 1, price_data: { currency: 'gbp', unit_amount: c.price_pence || COMMISSION_PENCE(),
          product_data: { name: `Airport commission: ${c.icao}${c.name ? ' ' + c.name : ''}`, description: 'Yours to control forever, with a one-month head start before it opens to everyone.' } } }],
        metadata: { kind: 'commission', commission_id: c.id, user_id: u.id },
        ...(a.stripe_customer ? { customer: a.stripe_customer } : { customer_email: u.email, customer_creation: 'always' }),
        success_url: SITE_URL + '?checkout=done#account', cancel_url: SITE_URL + '#account',
      });
      await db(`commissions?id=eq.${c.id}`, { method: 'PATCH', body: { stripe_session: s.id } });
      return json(req, { url: s.url });
    }
    if (b.action === 'checkout') {
      const plan = PLANS[b.plan]; if (!plan || !plan.price()) return fail(req, 400, 'Unknown plan.');
      const items = [{ price: plan.price(), quantity: 1 }];
      if (b.early && !plan.early && EARLY_PRICE()) items.push({ price: EARLY_PRICE(), quantity: 1 });
      const s = await stripe('checkout/sessions', {
        mode: 'subscription', client_reference_id: u.id, line_items: items,
        // a launch offer coupon applies itself; otherwise players may type a promotion code (Stripe allows one or the other)
        ...(COUPON() ? { discounts: [{ coupon: COUPON() }] } : { allow_promotion_codes: 'true' }),
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
