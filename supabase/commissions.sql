-- Airport commissions: a player asks for an airport, it is built, then they pay a one-off sum and own it forever.
-- Run once in Supabase, after schema.sql: SQL Editor > New query > paste > Run. Safe to run again.

alter table public.accounts add column if not exists owned text[] not null default '{}';   -- commissioned airports, playable whatever the plan

create table if not exists public.commissions (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email text,
  icao text not null,
  name text,
  notes text,
  -- you move it along: requested -> building -> ready (the player can now pay) -> paid (by Stripe) -> launched (open to everyone)
  -- or declined (say why in reply), or cancelled (by the player, before paying)
  status text not null default 'requested',
  price_pence int not null default 2500,
  reply text,                     -- optional note shown to the player on their account
  ready_at timestamptz,
  paid_at timestamptz,
  public_from timestamptz,        -- paid_at + 1 month: the owner's head start before everyone else
  stripe_session text
);
alter table public.commissions enable row level security;
create index if not exists commissions_user on public.commissions (user_id, created_at);

-- stamp ready_at when you set status to ready in the Table Editor
create or replace function public.commission_ready() returns trigger language plpgsql as $$
begin
  if new.status = 'ready' and (old.status is distinct from 'ready') and new.ready_at is null then new.ready_at := now(); end if;
  return new;
end $$;
drop trigger if exists commission_ready on public.commissions;
create trigger commission_ready before update on public.commissions for each row execute function public.commission_ready();
