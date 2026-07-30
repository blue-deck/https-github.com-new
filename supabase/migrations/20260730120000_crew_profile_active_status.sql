-- Keep public crew-directory eligibility reproducible across fresh and
-- previously provisioned BlueDeck environments.

alter table public.crew_profiles
  add column if not exists status text;

alter table public.crew_profiles
  alter column status set default 'active';

update public.crew_profiles
set status = 'active'
where status is null or btrim(status) = '';

alter table public.crew_profiles
  alter column status set not null;

create index if not exists crew_profiles_active_directory_idx
  on public.crew_profiles (public_crew_id, user_id)
  where status = 'active';

comment on column public.crew_profiles.status is
  'Lifecycle status used to include only active crew profiles in public discovery.';
