-- Clearway accounts, feedback and airport requests. Run once in Supabase: SQL Editor > New query > paste > Run.
-- Row level security is on with no public policies: only the Clearway API (service role key, server side) reads or writes.

create table if not exists public.accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  stripe_customer text unique,
  subscription_id text,
  plan text,                      -- a1, a3, a5, a10, all
  status text,                    -- Stripe: trialing, active, past_due, canceled, ...
  early boolean not null default false,
  airports text[] not null default '{}',
  airports_changed_at timestamptz,
  trial_used boolean not null default false,
  trial_end timestamptz,
  period_end timestamptz,
  cancel_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feedback (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null default 'other',  -- bug, idea, praise, other
  rating smallint,
  message text not null,
  page text,
  airport text,
  email text,
  user_id uuid references auth.users(id) on delete set null,
  voter text,                          -- account id, or a one-way hash for anonymous senders (rate limit)
  ua text,
  status text not null default 'new'   -- for you: new, read, planned, done
);

create table if not exists public.request_votes (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  icao text not null,
  name text,
  reason text,
  voter text not null,
  user_id uuid references auth.users(id) on delete set null,
  weight smallint not null default 1,  -- early access members count double
  unique (icao, voter)
);

create or replace view public.request_tally as
  select icao, (array_agg(name order by created_at) filter (where name is not null))[1] as name,
         sum(weight)::int as votes, count(*)::int as people, max(created_at) as last_at
  from public.request_votes group by icao;

alter table public.accounts enable row level security;
alter table public.feedback enable row level security;
alter table public.request_votes enable row level security;
revoke all on public.request_tally from anon, authenticated;
create index if not exists feedback_voter on public.feedback (voter, created_at);
create index if not exists request_votes_voter on public.request_votes (voter, created_at);
