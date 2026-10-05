// Shared helpers for the Clearway account API (Vercel functions). Files starting with _ are not routes.
// Accounts and data live in Supabase (service role, server side only); payments in Stripe. No npm packages: plain fetch.
// Environment variables (Vercel project settings): see SUBSCRIPTIONS.md.
import crypto from 'node:crypto';

const env = k => (process.env[k] || '').trim();
export const SITE_URL = env('SITE_URL') || 'https://www.clearway-atc.co.uk/';
export const TRIAL_DAYS = +env('TRIAL_DAYS') || 2;

// The plans. Keep in step with PLANS in src/account.js (the pricing page). Prices are set in Stripe, not here.
export const PLANS = {
  a1:  { airports: 1,  price: () => env('PRICE_1') },
  a3:  { airports: 3,  price: () => env('PRICE_3') },
  a5:  { airports: 5,  price: () => env('PRICE_5') },
  a10: { airports: 10, price: () => env('PRICE_10') },
  all: { airports: 0,  price: () => env('PRICE_UNLIMITED'), early: true },   // 0 = every airport; early access included
};
export const EARLY_PRICE = () => env('PRICE_EARLY');
// a commissioned airport: one-off, in pence (the player pays only once it is built)
export const COMMISSION_PENCE = () => +env('COMMISSION_PRICE') || 2500;
export const planOfPrice = id => Object.keys(PLANS).find(k => PLANS[k].price() && PLANS[k].price() === id) || null;

// Only the Clearway website (and local testing) may call the API with a player's sign-in.
const ORIGINS = [SITE_URL.replace(/\/$/, ''), 'https://www.clearway-atc.co.uk', 'https://clearway-atc.co.uk', 'https://chetwynkeam.github.io'];
const cors = req => {
  const o = req.headers.get('origin') || '';
  const ok = ORIGINS.includes(o) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o) || /\.claudeusercontent\.com$/.test(o);
  return { 'access-control-allow-origin': ok ? o : ORIGINS[0], 'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-allow-headers': 'authorization, content-type', vary: 'origin' };
};
export const json = (req, o, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors(req), 'content-type': 'application/json', 'cache-control': 'no-store' } });
export const preflight = req => new Response(null, { status: 204, headers: cors(req) });
export const fail = (req, status, error) => json(req, { error }, status);
export async function body(req){ try { return await req.json(); } catch { return {}; } }

// ── Supabase ──
const SB = () => env('SUPABASE_URL').replace(/\/$/, ''), SBK = () => env('SUPABASE_SERVICE_ROLE_KEY');
export const configured = () => !!(SB() && SBK());
// PostgREST call with the service role (bypasses row level security; the tables have none open to the public)
export async function db(path, { method = 'GET', body: b, prefer } = {}){
  // new-style secret keys (sb_secret_...) go in apikey only; legacy service_role JWTs also as the bearer token
  const auth = SBK().startsWith('sb_') ? {} : { authorization: `Bearer ${SBK()}` };
  const res = await fetch(`${SB()}/rest/v1/${path}`, { method, headers: { apikey: SBK(), ...auth, 'content-type': 'application/json',
    ...(prefer ? { prefer } : {}) }, body: b == null ? undefined : JSON.stringify(b) });
  const t = await res.text();
  if (!res.ok) throw new Error(`db ${res.status}: ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}
// the signed-in player, from the Supabase access token the site sends (Authorization: Bearer ...), or null
export async function user(req){
  const h = req.headers.get('authorization') || '', tok = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!tok || !configured()) return null;
  const res = await fetch(`${SB()}/auth/v1/user`, { headers: { apikey: SBK(), authorization: `Bearer ${tok}` } });
  if (!res.ok) return null;
  const u = await res.json();
  return u && u.id ? { id: u.id, email: u.email } : null;
}
export async function account(u){
  const rows = await db(`accounts?user_id=eq.${u.id}&select=*`);
  if (rows[0]) return rows[0];
  const [row] = await db('accounts', { method: 'POST', body: { user_id: u.id, email: u.email }, prefer: 'return=representation,resolution=merge-duplicates' });
  return row;
}
export const saveAccount = (id, patch) => db(`accounts?user_id=eq.${id}`, { method: 'PATCH', body: { ...patch, updated_at: new Date().toISOString() }, prefer: 'return=representation' }).then(r => r[0]);

// What a player may open. status: Stripe subscription status. A failed renewal keeps access for 3 days while Stripe retries.
export function entitlement(a){
  const now = Date.now(), end = a && a.period_end ? Date.parse(a.period_end) : 0;
  const active = !!a && (a.status === 'trialing' || a.status === 'active' || (a.status === 'past_due' && now < end + 3*864e5));
  const plan = active ? PLANS[a.plan] : null;
  // the free trial is one airport of the player's choice, whatever the plan; the rest unlock when it ends
  const trial = active && a.status === 'trialing', limit = !plan ? null : trial ? 1 : plan.airports;
  return { active, plan: active ? a.plan : null, status: a ? a.status || null : null, limit, trial, plan_airports: plan ? plan.airports : null,
    airports: active ? (limit === 0 ? '*' : (a.airports || []).slice(0, limit || 0)) : [],
    early: active && !trial && !!(a.early || (plan && plan.early)), trial_end: a && a.trial_end, period_end: a && a.period_end,
    cancel_at: a && a.cancel_at, trial_used: !!(a && a.trial_used), airports_changed_at: a && a.airports_changed_at,
    owned: (a && a.owned) || [] };   // commissioned airports: theirs whatever the plan, even with none
}

// ── Stripe (REST, form encoded) ──
const form = (o, pre = '') => Object.entries(o).flatMap(([k, v]) => {
  const key = pre ? `${pre}[${k}]` : k;
  if (v == null) return [];
  if (typeof v === 'object') return form(v, key);
  return [`${encodeURIComponent(key)}=${encodeURIComponent(v)}`];
}).flat();
export async function stripe(path, params, method = params ? 'POST' : 'GET'){
  const res = await fetch(`https://api.stripe.com/v1/${path}`, { method, headers: { authorization: `Bearer ${env('STRIPE_SECRET_KEY')}`,
    'content-type': 'application/x-www-form-urlencoded' }, body: params ? form(params).join('&') : undefined });
  const j = await res.json();
  if (!res.ok) throw new Error(`stripe ${res.status}: ${j.error && j.error.message}`);
  return j;
}
export const stripeOn = () => !!env('STRIPE_SECRET_KEY');
// Stripe-Signature check (t=..., v1=...): HMAC-SHA256 of "t.payload" with the endpoint secret, within 5 minutes
export function stripeEvent(raw, sig){
  const secret = env('STRIPE_WEBHOOK_SECRET'); if (!secret || !sig) return null;
  const parts = Object.fromEntries(sig.split(',').map(p => p.split('=')).filter(p => p.length === 2 && p[0] !== 'v1'));
  const v1 = sig.split(',').filter(p => p.startsWith('v1=')).map(p => p.slice(3));
  const t = +parts.t; if (!t || Math.abs(Date.now()/1000 - t) > 300) return null;
  const want = crypto.createHmac('sha256', secret).update(`${t}.${raw}`).digest('hex');
  const ok = v1.some(s => s.length === want.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(want)));
  return ok ? JSON.parse(raw) : null;
}
// a one-way hash for anonymous votes and rate limits (no raw IPs are stored)
export const anonId = req => crypto.createHash('sha256').update((req.headers.get('x-forwarded-for') || '').split(',')[0].trim() + '|' + env('SUPABASE_SERVICE_ROLE_KEY').slice(-12)).digest('hex').slice(0, 24);
