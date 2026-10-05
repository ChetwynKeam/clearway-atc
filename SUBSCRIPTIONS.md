# Clearway subscriptions, feedback and airport requests

Everything ships switched off. Until `subs.json` says otherwise, every airport stays free, the pricing page says
"free during the preview", and the feedback button is hidden. Nothing charges money until you turn it on.

## How it fits together

| Piece | Service | Cost to start |
|---|---|---|
| Website | GitHub Pages (as now) | free |
| Player accounts (email code sign-in) and the database | Supabase | free tier |
| Payments, 2-day trial, invoices, billing page | Stripe Checkout + Customer Portal | no monthly fee; about 1.5% + 20p per UK card payment |
| Server code that connects them (`api/`) | Vercel (the existing `clearway-atc` project) | Hobby is free but is for non-commercial use only. Move to Pro (about $20 a month) before you take real payments |
| Sign-in emails | Supabase's built-in sender for testing; a proper sender (e.g. Resend, free tier) before launch | free |
| Visitor counts (optional) | Cloudflare Web Analytics, no cookies | free |

Files: `api/account.js` (plan, checkout, billing page, airport choice, early access), `api/stripe-webhook.js` (keeps plans in step
with Stripe), `api/feedback.js` (feedback and airport requests), `api/_lib.js` (shared), `supabase/schema.sql` (tables),
`src/account.*` (pricing, account, request and legal pages, feedback form, paywall), `subs.json` (switches and display prices).

## Plans

| Plan | Key | Airports | Suggested price |
|---|---|---|---|
| Alpha | `a1` | 1 | £4.99 / month |
| Bravo | `a3` | 3 | £9.99 / month |
| Charlie | `a5` | 5 | £14.99 / month |
| Delta | `a10` | 10 | £24.99 / month |
| Echo | `all` | every airport, Foxtrot included | £29.99 / month |
| Foxtrot (early access add-on) | `early` | airports in development, double-weight airport requests | £4.99 / month |

The prices players see come from `subs.json`; the prices they pay come from Stripe. Keep the two the same.
Every plan starts with a 2-day free trial of one airport of the player's choice (whatever the plan), once per player, with a card taken at sign-up and cancellable before day 2. The rest of the plan's airports unlock when the trial ends.
Players tick their airports on the Account page. Empty places can be filled any time; swaps are free in the trial and then once every 30 days.

## How strong the protection is

The paywall runs in the player's browser and checks their plan with the server. It stops normal players, but the repository is
public, so someone technical could read or run the simulator code directly. To make it properly locked: make the repository private,
serve the site from Vercel instead of GitHub Pages, and have Vercel check the sign-in before sending each airport's page. That is a
follow-up once there are paying players.

## Setup (in this order)

### 1. Supabase
1. Create a project at supabase.com (region: London).
2. SQL Editor > New query: paste `supabase/schema.sql` and Run.
3. Authentication > Sign In / Providers > Email: keep Email on.
4. Players sign in with the emailed link. Once a custom sender is connected (step 6), Authentication > Emails > Templates > Magic link or OTP can add `Your Clearway code is {{ .Token }}` so they can type a code instead.
5. Authentication > URL Configuration: Site URL `https://www.clearway-atc.co.uk/`.
6. Before launch: Authentication > Emails > SMTP Settings, connect a real sender. The built-in sender only allows a few emails an hour.
7. Project Settings > API Keys: copy the publishable key (`sb_publishable_...`, goes in subs.json) and the secret key (`sb_secret_...`, Vercel only). The legacy `anon` and `service_role` keys also work. The Project URL is under Project Settings > Data API.

### 2. Stripe (test mode first)
1. Create a Stripe account. Leave it in Test mode.
2. Product catalogue: create a product "Clearway" with five recurring monthly GBP prices (the plans above), and a product
   "Clearway early access" with one monthly price. Copy the six price IDs (`price_...`).
3. Settings > Billing > Customer portal: allow cancelling (at period end), updating the card, and switching plan between the five plan prices.
4. Developers > Webhooks > Add endpoint: `https://clearway-atc.vercel.app/api/stripe-webhook`, events
   `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`.
   Copy the signing secret (`whsec_...`).
5. Developers > API keys: copy the secret key (`sk_test_...`).
6. Launch offer: Product catalogue > Coupons > New, 30% off, duration "Repeating" for 3 months. Copy its ID into the Vercel variable `STRIPE_COUPON`; Checkout then applies it to every new subscription. The pricing page shows the offer from `subs.json` (`offer`: percent, months, label); set `offer` to `null` and delete `STRIPE_COUPON` to end it.

### 3. Vercel environment variables
Vercel > clearway-atc > Settings > Environment Variables (Production), then redeploy:

```
SUPABASE_URL              https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY (the sb_secret_... key; never put it in subs.json)
STRIPE_SECRET_KEY         sk_test_...
STRIPE_WEBHOOK_SECRET     whsec_...
PRICE_1 PRICE_3 PRICE_5 PRICE_10 PRICE_UNLIMITED PRICE_EARLY   price_...
SITE_URL                  https://www.clearway-atc.co.uk/
TRIAL_DAYS                2
STRIPE_COUPON             (the launch offer coupon ID, optional)
COMMISSION_PRICE          2500 (a commissioned airport, in pence; optional, 2500 = £25)
```

### 4. Turn it on (`subs.json`, then `python3 build.py` and copy the pages)
- `supabase_url`, `supabase_anon_key`: from step 1 (the anon key is meant to be public).
- `feedback: true` switches on the feedback button and airport requests. This can go live before payments.
- `enabled: true` switches on sign-in, plans and the paywall. With Stripe in test mode, use card `4242 4242 4242 4242`.
- `commission`: the commissioned-airport price shown on the site (25). Keep it in step with `COMMISSION_PRICE`.
- `contact_email`: shown on the Terms and Privacy pages.
- `analytics_token`: Cloudflare Web Analytics site token, optional.

### 5. Going live with real money
Activate the Stripe account (business details, bank account), recreate the prices in Live mode, swap `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET` and the `PRICE_*` variables for the live ones, and move Vercel to Pro. Have the Terms and Privacy pages
checked first; they are a reasonable starting draft for a UK sole trader, not legal advice.

## Reading feedback and requests
Supabase > Table Editor: `feedback` (set `status` to read / planned / done as you go) and `request_tally` (requests, most votes first).

## Commissioned airports (£25 once, yours for good)
Run `supabase/commissions.sql` once in the SQL Editor (after `schema.sql`). It adds the `commissions` table and an
`owned` list on each account. No Stripe product is needed: the checkout creates a one-off £25 line itself.

1. A signed-in player sends an airport from the Request page. It appears in Table Editor > `commissions` as `requested`.
   Nothing is charged.
2. Set `status` to `building` while you work on it (the player sees "Being built"), or `declined` with a short note in
   `reply` if it cannot be built. A player can withdraw it until it is ready.
3. When the airport's simulator is live on the site (it can still show as In development), set `status` to `ready`.
   The player gets a Pay £25 button on their account.
4. Stripe takes the payment and the webhook marks it `paid`, sets `public_from` to a month later and adds the airport to
   the player's `owned` list. Owned airports open whatever plan the player is on, including none.
5. After `public_from`, mark the airport live in the catalogue for everyone and set the commission to `launched`.
