-- BlueDeck production foundation.
-- Run this in Supabase SQL Editor before using the new profile, invitation,
-- checklist photo, contract and IMO crew list workflows.

create extension if not exists "pgcrypto";

alter table if exists public.profiles
  add column if not exists phone text;

create table if not exists public.crew_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete cascade,
  public_crew_id text unique not null default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  email text unique,
  full_name text,
  phone text,
  gender text,
  nationality text,
  current_position text,
  location text,
  bio text,
  passport_number text,
  passport_expiry date,
  visa_country text,
  visa_expiry date,
  stcw_expiry date,
  medical_expiry date,
  seaman_book_expiry date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.crew_experiences (
  id uuid primary key default gen_random_uuid(),
  crew_profile_id uuid references public.crew_profiles(id) on delete cascade,
  yacht_name text,
  position text,
  start_date date,
  end_date date,
  description text,
  photo_url text,
  created_at timestamptz default now()
);

create table if not exists public.crew_portfolio_photos (
  id uuid primary key default gen_random_uuid(),
  crew_profile_id uuid references public.crew_profiles(id) on delete cascade,
  title text,
  image_url text,
  location text,
  created_at timestamptz default now()
);

create table if not exists public.yacht_crew_memberships (
  id uuid primary key default gen_random_uuid(),
  yacht_id uuid not null references public.yachts(id) on delete cascade,
  crew_profile_id uuid references public.crew_profiles(id) on delete set null,
  invited_email text,
  position text,
  department text,
  status text default 'invited',
  accepted_at timestamptz,
  created_at timestamptz default now(),
  unique (yacht_id, crew_profile_id)
);

create table if not exists public.crew_invitations (
  id uuid primary key default gen_random_uuid(),
  yacht_id uuid not null references public.yachts(id) on delete cascade,
  crew_profile_id uuid references public.crew_profiles(id) on delete set null,
  public_crew_id text,
  invited_email text,
  position text,
  department text,
  status text default 'pending',
  token text unique not null,
  invite_link text,
  accepted_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.yacht_checklists (
  id uuid primary key default gen_random_uuid(),
  yacht_id uuid not null references public.yachts(id) on delete cascade,
  title text,
  department text,
  checklist_type text,
  frequency text,
  due_date date,
  captain_note text,
  assigned_to uuid references public.crew_profiles(id) on delete set null,
  status text default 'open',
  completed_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.yacht_checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid references public.yacht_checklists(id) on delete cascade,
  task_text text,
  completed boolean default false,
  completed_at timestamptz,
  completed_by text,
  before_photo_url text,
  after_photo_url text,
  created_at timestamptz default now()
);

create table if not exists public.yacht_contracts (
  id uuid primary key default gen_random_uuid(),
  yacht_id uuid not null references public.yachts(id) on delete cascade,
  crew_profile_id uuid references public.crew_profiles(id) on delete set null,
  membership_id uuid references public.yacht_crew_memberships(id) on delete set null,
  contract_text text,
  status text default 'sent_for_signature',
  sent_at timestamptz default now(),
  signed_name text,
  signed_at timestamptz
);

create table if not exists public.expiry_alerts (
  id uuid primary key default gen_random_uuid(),
  yacht_id uuid references public.yachts(id) on delete cascade,
  crew_profile_id uuid references public.crew_profiles(id) on delete cascade,
  source_type text,
  source_id uuid,
  title text,
  expiry_date date,
  alert_level text,
  status text default 'open',
  created_at timestamptz default now()
);

create table if not exists public.yacht_documents (
  id uuid primary key default gen_random_uuid(),
  yacht_id uuid not null references public.yachts(id) on delete cascade,
  title text,
  category text,
  file_name text,
  file_url text,
  expiry_date date,
  created_at timestamptz default now()
);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists crew_profiles_touch_updated_at on public.crew_profiles;
create trigger crew_profiles_touch_updated_at
before update on public.crew_profiles
for each row execute function public.touch_updated_at();

alter table public.crew_profiles enable row level security;
alter table public.crew_experiences enable row level security;
alter table public.crew_portfolio_photos enable row level security;
alter table public.yacht_crew_memberships enable row level security;
alter table public.crew_invitations enable row level security;
alter table public.yacht_checklists enable row level security;
alter table public.yacht_checklist_items enable row level security;
alter table public.yacht_contracts enable row level security;

drop policy if exists "Users manage own crew profile" on public.crew_profiles;
create policy "Users manage own crew profile"
on public.crew_profiles
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Crew profile experience owner access" on public.crew_experiences;
create policy "Crew profile experience owner access"
on public.crew_experiences
for all
using (
  exists (
    select 1 from public.crew_profiles p
    where p.id = crew_profile_id and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.crew_profiles p
    where p.id = crew_profile_id and p.user_id = auth.uid()
  )
);

drop policy if exists "Crew profile portfolio owner access" on public.crew_portfolio_photos;
create policy "Crew profile portfolio owner access"
on public.crew_portfolio_photos
for all
using (
  exists (
    select 1 from public.crew_profiles p
    where p.id = crew_profile_id and p.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from public.crew_profiles p
    where p.id = crew_profile_id and p.user_id = auth.uid()
  )
);

-- During early product setup, yacht operational tables are readable/writable
-- to authenticated users. Tighten these policies by yacht ownership before launch.
drop policy if exists "Authenticated yacht memberships" on public.yacht_crew_memberships;
create policy "Authenticated yacht memberships"
on public.yacht_crew_memberships
for all to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated crew invitations" on public.crew_invitations;
create policy "Authenticated crew invitations"
on public.crew_invitations
for all to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated yacht checklists" on public.yacht_checklists;
create policy "Authenticated yacht checklists"
on public.yacht_checklists
for all to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated yacht checklist items" on public.yacht_checklist_items;
create policy "Authenticated yacht checklist items"
on public.yacht_checklist_items
for all to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated yacht contracts" on public.yacht_contracts;
create policy "Authenticated yacht contracts"
on public.yacht_contracts
for all to authenticated
using (true)
with check (true);

create index if not exists crew_profiles_public_crew_id_idx on public.crew_profiles(public_crew_id);
create index if not exists crew_invitations_token_idx on public.crew_invitations(token);
create index if not exists yacht_checklists_assigned_to_idx on public.yacht_checklists(assigned_to);
create index if not exists yacht_contracts_crew_profile_id_idx on public.yacht_contracts(crew_profile_id);

insert into storage.buckets (id, name, public)
values ('task-photos', 'task-photos', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('crew-portfolio', 'crew-portfolio', true)
on conflict (id) do nothing;
