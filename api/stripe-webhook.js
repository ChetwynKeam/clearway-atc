// Stripe webhook (Vercel function: /api/stripe-webhook). Keeps each player's plan in Supabase in step with Stripe.
// Events: checkout.session.completed (plans and airport commissions), customer.subscription.created / updated / deleted.
import { stripeEvent, stripe, db, saveAccount, planOfPrice, EARLY_PRICE, PLANS } from './_lib.js';

// a paid commission: the airport joins the player's account for good, with a month before it opens to everyone
async function commissionPaid(o){
  const id = +o.metadata.commission_id, user = o.metadata.user_id || o.client_reference_id;
  const [c] = await db(`commissions?id=eq.${id}&user_id=eq.${user}&select=*`);
  if (!c || c.status === 'paid' || c.status === 'launched') return;   // Stripe can send an event twice
  const now = new Date(), pub = new Date(now); pub.setMonth(pub.getMonth() + 1);
  await db(`commissions?id=eq.${id}`, { method: 'PATCH', body: { status: 'paid', paid_at: now.toISOString(), public_from: pub.toISOString(), stripe_session: o.id } });
  const [a] = await db(`accounts?user_id=eq.${user}&select=owned,stripe_customer`);
  const owned = [...new Set([...((a && a.owned) || []), c.icao])];
  await saveAccount(user, { owned, ...(a && !a.stripe_customer && o.customer ? { stripe_customer: o.customer } : {}) });
}

const iso = s => s ? new Date(s*1000).toISOString() : null;
async function sync(sub, userId){
  let id = userId || (sub.metadata && sub.metadata.user_id);
  if (!id) { const r = await db(`accounts?stripe_customer=eq.${sub.customer}&select=user_id`); id = r[0] && r[0].user_id; }
  if (!id) return;
  const prices = sub.items.data.map(i => i.price.id), plan = prices.map(planOfPrice).find(Boolean) || null;
  const item = sub.items.data[0] || {}, end = sub.current_period_end || item.current_period_end;
  const cur = (await db(`accounts?user_id=eq.${id}&select=airports,subscription_id`))[0] || {};
  // an old, ended subscription must not overwrite a newer one
  if (cur.subscription_id && cur.subscription_id !== sub.id && !['active', 'trialing'].includes(sub.status)) return;
  const lim = plan ? PLANS[plan].airports : 0, airports = cur.airports || [];
  await saveAccount(id, {
    stripe_customer: sub.customer, subscription_id: sub.id, plan, status: sub.status,
    early: !!EARLY_PRICE() && prices.includes(EARLY_PRICE()),
    trial_end: iso(sub.trial_end), period_end: iso(end), cancel_at: iso(sub.cancel_at),
    ...(sub.trial_start ? { trial_used: true } : {}),
    // moving to a smaller plan keeps the first airports chosen
    ...(lim && airports.length > lim ? { airports: airports.slice(0, lim) } : {}),
  });
}

export async function POST(req){
  const raw = await req.text(), ev = stripeEvent(raw, req.headers.get('stripe-signature'));
  if (!ev) return new Response('bad signature', { status: 400 });
  try {
    const o = ev.data.object;
    if (ev.type === 'checkout.session.completed' && o.mode === 'subscription' && o.client_reference_id) {
      await saveAccount(o.client_reference_id, { stripe_customer: o.customer, subscription_id: o.subscription });
      await sync(await stripe(`subscriptions/${o.subscription}`), o.client_reference_id);
    } else if (/^checkout\.session\.(completed|async_payment_succeeded)$/.test(ev.type) && o.mode === 'payment' && o.payment_status === 'paid'
      && o.metadata && o.metadata.kind === 'commission') await commissionPaid(o);
    else if (/^customer\.subscription\./.test(ev.type)) await sync(o);
  } catch (e) { console.error(e); return new Response('retry', { status: 500 }); }   // Stripe retries on failure
  return new Response('ok');
}
