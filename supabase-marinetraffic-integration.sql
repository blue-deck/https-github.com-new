-- BlueDeck MarineTraffic integration.
-- Run in Supabase SQL Editor after the production hardening script.
-- Idempotent: this file can be re-run safely.
-- Also set MARINETRAFFIC_API_KEY in Vercel/local env.
-- Optional: set MARINETRAFFIC_VOYAGE_FORECAST_URL_TEMPLATE when your contracted
-- MarineTraffic service uses a custom endpoint shape.

create extension if not exists "pgcrypto";

alter table public.yachts
  add column if not exists mmsi text,
  add column if not exists marine_traffic_enabled boolean default true,
  add column if not exists updated_at timestamptz default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'yachts_mmsi_format_chk'
      and conrelid = 'public.yachts'::regclass
  ) then
    alter table public.yachts
      add constraint yachts_mmsi_format_chk
      check (mmsi is null or mmsi ~ '^[0-9]{9}$')
      not valid;
  end if;
end $$;

create index if not exists yachts_mmsi_idx
on public.yachts(mmsi)
where mmsi is not null;

create table if not exists public.yacht_positions (
  id uuid primary key default gen_random_uuid(),
  yacht_id uuid references public.yachts(id) on delete cascade,
  latitude numeric,
  longitude numeric,
  speed numeric,
  heading numeric,
  location_name text,
  source text default 'MarineTraffic',
  created_at timestamptz default now()
);

alter table public.yacht_positions
  add column if not exists yacht_id uuid references public.yachts(id) on delete cascade,
  add column if not exists latitude numeric,
  add column if not exists longitude numeric,
  add column if not exists speed numeric,
  add column if not exists heading numeric,
  add column if not exists location_name text,
  add column if not exists source text default 'MarineTraffic',
  add column if not exists created_at timestamptz default now();

create index if not exists yacht_positions_yacht_created_idx
on public.yacht_positions(yacht_id, created_at desc);

create table if not exists public.voyages (
  id uuid primary key default gen_random_uuid(),
  yacht_id uuid references public.yachts(id) on delete cascade,
  title text,
  departure_port text,
  arrival_port text,
  fuel_estimate numeric default 0,
  fuel_remaining numeric default 0,
  source text default 'MarineTraffic',
  source_mmsi text,
  eta text,
  status text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.voyages
  add column if not exists yacht_id uuid references public.yachts(id) on delete cascade,
  add column if not exists title text,
  add column if not exists departure_port text,
  add column if not exists arrival_port text,
  add column if not exists fuel_estimate numeric default 0,
  add column if not exists fuel_remaining numeric default 0,
  add column if not exists source text default 'MarineTraffic',
  add column if not exists source_mmsi text,
  add column if not exists eta text,
  add column if not exists status text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create index if not exists voyages_yacht_created_idx
on public.voyages(yacht_id, created_at desc);

create table if not exists public.marinetraffic_snapshots (
  id uuid primary key default gen_random_uuid(),
  yacht_id uuid references public.yachts(id) on delete cascade,
  mmsi text,
  payload jsonb,
  created_at timestamptz default now()
);

create index if not exists marinetraffic_snapshots_yacht_created_idx
on public.marinetraffic_snapshots(yacht_id, created_at desc);

alter table public.yachts enable row level security;
alter table public.yacht_positions enable row level security;
alter table public.voyages enable row level security;
alter table public.marinetraffic_snapshots enable row level security;

drop policy if exists "Users manage own yachts" on public.yachts;
create policy "Users manage own yachts"
on public.yachts
for all
to authenticated
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "Authenticated read yacht positions" on public.yacht_positions;
create policy "Authenticated read yacht positions"
on public.yacht_positions
for select
to authenticated
using (true);

drop policy if exists "Authenticated read voyages" on public.voyages;
create policy "Authenticated read voyages"
on public.voyages
for select
to authenticated
using (true);

drop policy if exists "Authenticated read MarineTraffic snapshots" on public.marinetraffic_snapshots;
create policy "Authenticated read MarineTraffic snapshots"
on public.marinetraffic_snapshots
for select
to authenticated
using (true);
