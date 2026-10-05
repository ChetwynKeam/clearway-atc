-- Airport commissions: a player asks for an airport and saves a card; it is built; on release the card is charged
-- once and the airport is theirs for good. Run once in Supabase, after schema.sql: SQL Editor > New query > paste > Run.
-- Safe to run again.

alter table public.accounts add column if not exists owned text[] not null default '{}';   -- commissioned airports, playable whatever the plan

create table if not exists public.commissions (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  icao text not null,
  name text,
  notes text,
  -- card (waiting for the player to save a card) -> requested -> building -> paid (charged on release) -> launched (open to everyone)
  -- ready: released but the card could not be charged, so the player pays from their account
  -- declined (say why in reply; nothing is charged), cancelled (withdrawn by the player)
  status text not null default 'card',
  price_pence int not null default 2500,
  reply text,                     -- optional note shown to the player on their account
  payment_method text,            -- the saved card (Stripe), charged on release
  payment_intent text,
  stripe_session text,
  ready_at timestamptz,           -- released
  paid_at timestamptz,
  public_from timestamptz         -- paid_at + 1 month: the owner's head start before everyone else
);
alter table public.commissions add column if not exists payment_method text;
alter table public.commissions add column if not exists payment_intent text;
alter table public.commissions alter column status set default 'card';
alter table public.commissions enable row level security;
create index if not exists commissions_user on public.commissions (user_id, created_at);
drop trigger if exists commission_ready on public.commissions;
drop function if exists public.commission_ready();
