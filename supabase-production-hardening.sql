-- BlueDeck production hardening.
-- Run once in Supabase SQL Editor after the original blueprint/profile scripts.
-- This file is idempotent: it can be re-run safely after future deployments.

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  phone text,
  role text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.profiles
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists role text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

create table if not exists public.crew_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  public_crew_id text default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  status text not null default 'active',
  email text,
  full_name text,
  phone text,
  current_position text,
  profile_photo_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.crew_profiles
  add column if not exists user_id uuid references auth.users(id) on delete cascade,
  add column if not exists public_crew_id text,
  add column if not exists status text default 'active',
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists current_position text,
  add column if not exists profile_photo_url text,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update public.crew_profiles
set status = 'active'
where status is null or btrim(status) = '';

alter table public.crew_profiles
  alter column status set default 'active',
  alter column status set not null;

create unique index if not exists profiles_id_unique_idx on public.profiles(id);
create unique index if not exists crew_profiles_user_id_unique_idx on public.crew_profiles(user_id) where user_id is not null;
create unique index if not exists crew_profiles_public_crew_id_unique_idx on public.crew_profiles(public_crew_id) where public_crew_id is not null;
create unique index if not exists crew_profiles_email_unique_idx on public.crew_profiles(lower(email)) where email is not null;

create table if not exists public.yachts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  name text,
  model text,
  flag text,
  created_at timestamptz default now()
);

create table if not exists public.yacht_crew_memberships (
  id uuid primary key default gen_random_uuid(),
  yacht_id uuid,
  crew_profile_id uuid,
  invited_email text,
  position text,
  department text,
  status text default 'invited',
  accepted_at timestamptz,
  created_at timestamptz default now()
);

alter table public.yacht_crew_memberships
  add column if not exists accepted_at timestamptz,
  add column if not exists invited_email text,
  add column if not exists status text default 'invited';

create unique index if not exists yacht_memberships_yacht_profile_unique_idx
on public.yacht_crew_memberships(yacht_id, crew_profile_id)
where crew_profile_id is not null;

create unique index if not exists yacht_memberships_yacht_email_unique_idx
on public.yacht_crew_memberships(yacht_id, lower(invited_email))
where invited_email is not null;

create table if not exists public.crew_invitations (
  id uuid primary key default gen_random_uuid(),
  yacht_id uuid,
  crew_profile_id uuid,
  public_crew_id text,
  invited_email text,
  position text,
  department text,
  status text default 'pending',
  token text default gen_random_uuid()::text,
  invite_link text,
  accepted_at timestamptz,
  created_at timestamptz default now()
);

alter table public.crew_invitations
  add column if not exists accepted_at timestamptz,
  add column if not exists invited_email text,
  add column if not exists invite_link text,
  add column if not exists status text default 'pending';

create unique index if not exists crew_invitations_token_unique_idx on public.crew_invitations(token);

create table if not exists public.yacht_checklists (
  id uuid primary key default gen_random_uuid(),
  yacht_id uuid,
  title text,
  department text,
  checklist_type text,
  frequency text,
  due_date date,
  captain_note text,
  assigned_to uuid,
  status text default 'open',
  completed_at timestamptz,
  created_at timestamptz default now()
);

alter table public.yacht_checklists
  add column if not exists frequency text,
  add column if not exists due_date date,
  add column if not exists captain_note text,
  add column if not exists status text default 'open',
  add column if not exists completed_at timestamptz;

create table if not exists public.yacht_checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid,
  task_text text,
  completed boolean default false,
  completed_at timestamptz,
  completed_by text,
  before_photo_url text,
  after_photo_url text,
  created_at timestamptz default now()
);

alter table public.yacht_checklist_items
  add column if not exists completed boolean default false,
  add column if not exists completed_at timestamptz,
  add column if not exists completed_by text,
  add column if not exists before_photo_url text,
  add column if not exists after_photo_url text;

create table if not exists public.yacht_contracts (
  id uuid primary key default gen_random_uuid(),
  yacht_id uuid,
  crew_profile_id uuid,
  membership_id uuid,
  contract_text text,
  status text default 'sent_for_signature',
  sent_at timestamptz default now(),
  signed_name text,
  signed_at timestamptz
);

insert into storage.buckets (id, name, public)
values
  ('crew-documents', 'crew-documents', true),
  ('crew-portfolio', 'crew-portfolio', true),
  ('task-photos', 'task-photos', true),
  ('yacht-documents', 'yacht-documents', true)
on conflict (id) do nothing;

alter table public.profiles enable row level security;
alter table public.crew_profiles enable row level security;
alter table public.yacht_crew_memberships enable row level security;
alter table public.crew_invitations enable row level security;
alter table public.yacht_checklists enable row level security;
alter table public.yacht_checklist_items enable row level security;
alter table public.yacht_contracts enable row level security;

drop policy if exists "Users manage own base profile" on public.profiles;
create policy "Users manage own base profile"
on public.profiles
for all
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "Users manage own crew profile" on public.crew_profiles;
create policy "Users manage own crew profile"
on public.crew_profiles
for all
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "BlueDeck authenticated storage read" on storage.objects;
create policy "BlueDeck authenticated storage read"
on storage.objects
for select
to authenticated
using (bucket_id in ('crew-documents', 'crew-portfolio', 'task-photos', 'yacht-documents'));

drop policy if exists "BlueDeck authenticated storage uploads" on storage.objects;
create policy "BlueDeck authenticated storage uploads"
on storage.objects
for insert
to authenticated
with check (bucket_id in ('crew-documents', 'crew-portfolio', 'task-photos', 'yacht-documents'));

drop policy if exists "BlueDeck authenticated storage updates" on storage.objects;
create policy "BlueDeck authenticated storage updates"
on storage.objects
for update
to authenticated
using (bucket_id in ('crew-documents', 'crew-portfolio', 'task-photos', 'yacht-documents'))
with check (bucket_id in ('crew-documents', 'crew-portfolio', 'task-photos', 'yacht-documents'));

drop policy if exists "BlueDeck authenticated storage delete" on storage.objects;
create policy "BlueDeck authenticated storage delete"
on storage.objects
for delete
to authenticated
using (bucket_id in ('crew-documents', 'crew-portfolio', 'task-photos', 'yacht-documents'));
