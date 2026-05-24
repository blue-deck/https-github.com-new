alter table public.crew_profiles
  add column if not exists profile_photo_url text,
  add column if not exists date_of_birth date,
  add column if not exists height_cm integer,
  add column if not exists weight_kg integer,
  add column if not exists visible_tattoos text,
  add column if not exists smoker text,
  add column if not exists current_positions text[] default '{}',
  add column if not exists seeking_positions text[] default '{}',
  add column if not exists work_preferences text[] default '{}',
  add column if not exists personal_skills text[] default '{}',
  add column if not exists personal_characteristics text[] default '{}',
  add column if not exists languages jsonb default '[]'::jsonb;

create table if not exists public.crew_documents (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now()
);

alter table public.crew_documents
  add column if not exists crew_profile_id uuid,
  add column if not exists document_type text,
  add column if not exists category text,
  add column if not exists issuer text,
  add column if not exists issue_date date,
  add column if not exists expiry_date date,
  add column if not exists no_expiry boolean default false,
  add column if not exists show_on_cv boolean default true,
  add column if not exists file_url text,
  add column if not exists notes text,
  add column if not exists created_at timestamptz default now();

do $$
begin
  alter table public.crew_documents
    add constraint crew_documents_crew_profile_id_fkey
    foreign key (crew_profile_id) references public.crew_profiles(id) on delete cascade;
exception
  when duplicate_object then null;
end $$;

create table if not exists public.crew_references (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz default now()
);

alter table public.crew_references
  add column if not exists crew_profile_id uuid,
  add column if not exists name text,
  add column if not exists role text,
  add column if not exists vessel text,
  add column if not exists company text,
  add column if not exists phone text,
  add column if not exists email text,
  add column if not exists notes text,
  add column if not exists show_on_cv boolean default true,
  add column if not exists created_at timestamptz default now();

do $$
begin
  alter table public.crew_references
    add constraint crew_references_crew_profile_id_fkey
    foreign key (crew_profile_id) references public.crew_profiles(id) on delete cascade;
exception
  when duplicate_object then null;
end $$;

alter table public.crew_documents enable row level security;
alter table public.crew_references enable row level security;

drop policy if exists "Crew documents owner access" on public.crew_documents;
create policy "Crew documents owner access"
on public.crew_documents
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

drop policy if exists "Crew references owner access" on public.crew_references;
create policy "Crew references owner access"
on public.crew_references
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

create index if not exists crew_documents_profile_idx on public.crew_documents(crew_profile_id);
create index if not exists crew_references_profile_idx on public.crew_references(crew_profile_id);

insert into storage.buckets (id, name, public)
values ('crew-documents', 'crew-documents', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('crew-portfolio', 'crew-portfolio', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated crew document uploads" on storage.objects;
create policy "Authenticated crew document uploads"
on storage.objects
for insert
to authenticated
with check (bucket_id in ('crew-documents', 'crew-portfolio'));

drop policy if exists "Authenticated crew document updates" on storage.objects;
create policy "Authenticated crew document updates"
on storage.objects
for update
to authenticated
using (bucket_id in ('crew-documents', 'crew-portfolio'))
with check (bucket_id in ('crew-documents', 'crew-portfolio'));

drop policy if exists "Public crew media read" on storage.objects;
create policy "Public crew media read"
on storage.objects
for select
using (bucket_id in ('crew-documents', 'crew-portfolio'));
