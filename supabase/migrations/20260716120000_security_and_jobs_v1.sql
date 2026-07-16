-- BlueDeck security hardening and Jobs V1.
--
-- Prerequisites:
--   * The existing BlueDeck foundation tables (profiles, crew_profiles, yachts,
--     yacht_crew_memberships, crew_invitations, yacht_checklists,
--     yacht_checklist_items and yacht_contracts) already exist.
--   * Run through a privileged Supabase migration connection.
--
-- This migration is intentionally defensive:
--   * all existing policies on sensitive BlueDeck tables are replaced;
--   * existing operational modules keep their table-specific yacht policies;
--   * sensitive storage buckets become private and writes are path-scoped;
--   * Jobs V1 tables include constraints, indexes, triggers and RLS.

begin;

create extension if not exists "pgcrypto";

alter table public.yacht_checklists
  add column if not exists created_by uuid
  references auth.users(id) on delete set null;

create index if not exists yacht_checklists_created_by_idx
  on public.yacht_checklists (created_by, created_at desc)
  where created_by is not null;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.is_platform_jobs_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'platform_role', '') in ('admin', 'moderator');
$$;

create or replace function public.owns_crew_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.crew_profiles profile
    where profile.id = target_profile_id
      and profile.user_id = auth.uid()
  );
$$;

create or replace function public.is_unclaimed_crew_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select target_profile_id is null
      or exists (
        select 1
        from public.crew_profiles profile
        where profile.id = target_profile_id
          and profile.user_id is null
      );
$$;

create or replace function public.is_yacht_owner(target_yacht_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.yachts yacht
    where yacht.id = target_yacht_id
      and yacht.owner_id = auth.uid()
  );
$$;

create or replace function public.is_active_yacht_member(target_yacht_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.yacht_crew_memberships membership
    left join public.crew_profiles profile
      on profile.id = membership.crew_profile_id
    where membership.yacht_id = target_yacht_id
      and lower(coalesce(membership.status, '')) = 'active'
      and (
        profile.user_id = auth.uid()
        or (
          (membership.crew_profile_id is null or profile.user_id is null)
          and
          coalesce(auth.jwt() ->> 'email', '') <> ''
          and lower(coalesce(membership.invited_email, '')) =
              lower(auth.jwt() ->> 'email')
        )
      )
  );
$$;

create or replace function public.can_access_yacht(target_yacht_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_yacht_owner(target_yacht_id)
      or public.is_active_yacht_member(target_yacht_id);
$$;

create or replace function public.can_access_yacht(target_yacht_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(target_yacht_id, '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  return public.can_access_yacht(target_yacht_id::uuid);
end;
$$;

create or replace function public.can_manage_yacht(target_yacht_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_yacht_owner(target_yacht_id)
      or exists (
        select 1
        from public.yacht_crew_memberships membership
        left join public.crew_profiles profile
          on profile.id = membership.crew_profile_id
        where membership.yacht_id = target_yacht_id
          and lower(coalesce(membership.status, '')) = 'active'
          and (
            profile.user_id = auth.uid()
            or (
              (membership.crew_profile_id is null or profile.user_id is null)
              and
              coalesce(auth.jwt() ->> 'email', '') <> ''
              and lower(coalesce(membership.invited_email, '')) =
                  lower(auth.jwt() ->> 'email')
            )
          )
          and lower(coalesce(membership.position, '')) in (
            'master',
            'captain',
            'fleet captain',
            'relief captain',
            'staff captain',
            'build captain',
            'yacht manager'
          )
      );
$$;

create or replace function public.can_manage_yacht(target_yacht_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(target_yacht_id, '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  return public.can_manage_yacht(target_yacht_id::uuid);
end;
$$;

create or replace function public.can_write_yacht_departments(
  target_yacht_id uuid,
  allowed_departments text[]
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.can_manage_yacht(target_yacht_id)
      or exists (
        select 1
        from public.yacht_crew_memberships membership
        left join public.crew_profiles profile
          on profile.id = membership.crew_profile_id
        where membership.yacht_id = target_yacht_id
          and lower(coalesce(membership.status, '')) = 'active'
          and (
            profile.user_id = auth.uid()
            or (
              (membership.crew_profile_id is null or profile.user_id is null)
              and
              coalesce(auth.jwt() ->> 'email', '') <> ''
              and lower(coalesce(membership.invited_email, '')) =
                  lower(auth.jwt() ->> 'email')
            )
          )
          and exists (
            select 1
            from unnest(coalesce(allowed_departments, '{}'::text[])) department
            where lower(department) =
              lower(coalesce(membership.department, ''))
          )
      );
$$;

create or replace function public.can_write_yacht_departments(
  target_yacht_id text,
  allowed_departments text[]
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(target_yacht_id, '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  return public.can_write_yacht_departments(
    target_yacht_id::uuid,
    allowed_departments
  );
end;
$$;

create or replace function public.can_supervise_yacht_departments(
  target_yacht_id uuid,
  allowed_departments text[]
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.can_manage_yacht(target_yacht_id)
      or exists (
        select 1
        from public.yacht_crew_memberships membership
        left join public.crew_profiles profile
          on profile.id = membership.crew_profile_id
        where membership.yacht_id = target_yacht_id
          and lower(coalesce(membership.status, '')) = 'active'
          and (
            profile.user_id = auth.uid()
            or (
              (membership.crew_profile_id is null or profile.user_id is null)
              and
              coalesce(auth.jwt() ->> 'email', '') <> ''
              and lower(coalesce(membership.invited_email, '')) =
                  lower(auth.jwt() ->> 'email')
            )
          )
          and exists (
            select 1
            from unnest(coalesce(allowed_departments, '{}'::text[])) department
            where lower(department) =
              lower(coalesce(membership.department, ''))
          )
          and lower(coalesce(membership.position, '')) in (
            'chief officer',
            'chief mate',
            'first officer',
            'first mate',
            'second officer',
            '2nd officer',
            'third officer',
            '3rd officer',
            'junior officer',
            'officer of the watch',
            'safety officer',
            'bosun',
            'boatswain',
            'lead deckhand',
            'chief engineer',
            'sole engineer',
            'second engineer',
            '2nd engineer',
            'third engineer',
            '3rd engineer',
            'eto',
            'interior manager',
            'chief steward/ess',
            'chief stewardess',
            'chief steward',
            'sole steward/ess',
            'head of service',
            'head housekeeper',
            'second steward/ess',
            '2nd stewardess',
            'second stewardess',
            'senior butler',
            'executive chef',
            'head chef',
            'chef',
            'sole chef',
            'sous chef',
            'chief purser',
            'purser',
            'yacht administrator',
            'guest relations manager',
            'watersports manager',
            'helicopter landing officer'
          )
      );
$$;

create or replace function public.can_supervise_yacht_departments(
  target_yacht_id text,
  allowed_departments text[]
)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
begin
  if coalesce(target_yacht_id, '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  return public.can_supervise_yacht_departments(
    target_yacht_id::uuid,
    allowed_departments
  );
end;
$$;

create or replace function public.owns_crew_storage_object(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select split_part(coalesce(object_name, ''), '/', 1) = auth.uid()::text
      or exists (
        select 1
        from public.crew_profiles profile
        where profile.user_id = auth.uid()
          and profile.id::text = split_part(coalesce(object_name, ''), '/', 1)
      );
$$;

create or replace function public.can_access_yacht_storage_object(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  yacht_path_id text := split_part(coalesce(object_name, ''), '/', 1);
begin
  return public.can_access_yacht(yacht_path_id);
end;
$$;

create or replace function public.try_parse_jsonb(value text)
returns jsonb
language plpgsql
immutable
set search_path = public, pg_temp
as $$
begin
  if nullif(btrim(coalesce(value, '')), '') is null then
    return '{}'::jsonb;
  end if;

  return value::jsonb;
exception
  when others then
    return '{}'::jsonb;
end;
$$;

create or replace function public.can_upload_task_photo(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  yacht_path_id text := split_part(coalesce(object_name, ''), '/', 1);
  task_path_id text := split_part(coalesce(object_name, ''), '/', 2);
begin
  if yacht_path_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  if task_path_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  return exists (
    select 1
    from public.yacht_checklist_items item
    join public.yacht_checklists checklist
      on checklist.id = item.checklist_id
    where item.id = task_path_id::uuid
      and checklist.yacht_id = yacht_path_id::uuid
      and lower(coalesce(checklist.status, 'open')) = 'open'
      and not coalesce(item.completed, false)
      and public.can_access_yacht(checklist.yacht_id)
      and (
        public.can_manage_yacht(checklist.yacht_id)
        or
        public.owns_crew_profile(checklist.assigned_to)
        or checklist.created_by = auth.uid()
      )
  );
end;
$$;

create or replace function public.can_read_task_photo(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  yacht_path_id text := split_part(coalesce(object_name, ''), '/', 1);
  task_path_id text := split_part(coalesce(object_name, ''), '/', 2);
begin
  if yacht_path_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or task_path_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return false;
  end if;

  return exists (
    select 1
    from public.yacht_checklist_items item
    join public.yacht_checklists checklist
      on checklist.id = item.checklist_id
    where item.id = task_path_id::uuid
      and checklist.yacht_id = yacht_path_id::uuid
      and public.can_access_yacht(checklist.yacht_id)
      and (
        public.can_manage_yacht(checklist.yacht_id)
        or checklist.created_by = auth.uid()
        or public.owns_crew_profile(checklist.assigned_to)
      )
  );
end;
$$;

revoke all on function public.is_platform_jobs_admin() from public;
revoke all on function public.owns_crew_profile(uuid) from public;
revoke all on function public.is_unclaimed_crew_profile(uuid) from public;
revoke all on function public.is_yacht_owner(uuid) from public;
revoke all on function public.is_active_yacht_member(uuid) from public;
revoke all on function public.can_access_yacht(uuid) from public;
revoke all on function public.can_access_yacht(text) from public;
revoke all on function public.can_manage_yacht(uuid) from public;
revoke all on function public.can_manage_yacht(text) from public;
revoke all on function public.can_write_yacht_departments(uuid, text[]) from public;
revoke all on function public.can_write_yacht_departments(text, text[]) from public;
revoke all on function public.can_supervise_yacht_departments(uuid, text[]) from public;
revoke all on function public.can_supervise_yacht_departments(text, text[]) from public;
revoke all on function public.owns_crew_storage_object(text) from public;
revoke all on function public.can_access_yacht_storage_object(text) from public;
revoke all on function public.can_upload_task_photo(text) from public;
revoke all on function public.can_read_task_photo(text) from public;

grant execute on function public.is_platform_jobs_admin() to anon, authenticated;
grant execute on function public.owns_crew_profile(uuid) to authenticated;
grant execute on function public.is_unclaimed_crew_profile(uuid) to authenticated;
grant execute on function public.is_yacht_owner(uuid) to authenticated;
grant execute on function public.is_active_yacht_member(uuid) to authenticated;
grant execute on function public.can_access_yacht(uuid) to authenticated;
grant execute on function public.can_access_yacht(text) to authenticated;
grant execute on function public.can_manage_yacht(uuid) to authenticated;
grant execute on function public.can_manage_yacht(text) to authenticated;
grant execute on function public.can_write_yacht_departments(uuid, text[]) to authenticated;
grant execute on function public.can_write_yacht_departments(text, text[]) to authenticated;
grant execute on function public.can_supervise_yacht_departments(uuid, text[]) to authenticated;
grant execute on function public.can_supervise_yacht_departments(text, text[]) to authenticated;
grant execute on function public.owns_crew_storage_object(text) to authenticated;
grant execute on function public.can_access_yacht_storage_object(text) to authenticated;
grant execute on function public.can_upload_task_photo(text) to authenticated;
grant execute on function public.can_read_task_photo(text) to authenticated;

-- Repair legacy duplicate memberships before enforcing race-safe uniqueness.
lock table
  public.yacht_contracts,
  public.yacht_crew_memberships,
  public.crew_invitations
in share row exclusive mode;

with ranked_memberships as (
  select
    membership.id,
    first_value(membership.id) over (
      partition by membership.yacht_id, membership.crew_profile_id
      order by
        case when lower(coalesce(membership.status, '')) = 'active' then 0 else 1 end,
        membership.created_at desc nulls last,
        membership.id
    ) as canonical_id,
    row_number() over (
      partition by membership.yacht_id, membership.crew_profile_id
      order by
        case when lower(coalesce(membership.status, '')) = 'active' then 0 else 1 end,
        membership.created_at desc nulls last,
        membership.id
    ) as duplicate_rank
  from public.yacht_crew_memberships membership
  where membership.crew_profile_id is not null
),
duplicate_memberships as (
  select id, canonical_id
  from ranked_memberships
  where duplicate_rank > 1
)
update public.yacht_contracts contract
set membership_id = duplicate.canonical_id
from duplicate_memberships duplicate
where contract.membership_id = duplicate.id;

with ranked_memberships as (
  select
    membership.id,
    row_number() over (
      partition by membership.yacht_id, membership.crew_profile_id
      order by
        case when lower(coalesce(membership.status, '')) = 'active' then 0 else 1 end,
        membership.created_at desc nulls last,
        membership.id
    ) as duplicate_rank
  from public.yacht_crew_memberships membership
  where membership.crew_profile_id is not null
)
delete from public.yacht_crew_memberships membership
using ranked_memberships ranked
where membership.id = ranked.id
  and ranked.duplicate_rank > 1;

with invitation_profiles as (
  select
    invitation.id,
    min(membership.crew_profile_id::text)::uuid as crew_profile_id
  from public.crew_invitations invitation
  join public.yacht_crew_memberships membership
    on membership.yacht_id = invitation.yacht_id
   and lower(coalesce(membership.invited_email, '')) =
       lower(coalesce(invitation.invited_email, ''))
  where lower(coalesce(invitation.status, '')) = 'accepted'
    and invitation.crew_profile_id is null
    and nullif(btrim(coalesce(invitation.invited_email, '')), '') is not null
    and membership.crew_profile_id is not null
  group by invitation.id
  having count(distinct membership.crew_profile_id) = 1
)
update public.crew_invitations invitation
set crew_profile_id = profile.crew_profile_id
from invitation_profiles profile
where invitation.id = profile.id;

create unique index if not exists yacht_memberships_profile_unique_idx
on public.yacht_crew_memberships (yacht_id, crew_profile_id)
where crew_profile_id is not null;

create unique index if not exists yacht_memberships_unclaimed_email_unique_idx
on public.yacht_crew_memberships (yacht_id, lower(invited_email))
where crew_profile_id is null
  and nullif(btrim(coalesce(invited_email, '')), '') is not null;

create unique index if not exists crew_invitations_token_unique_idx
on public.crew_invitations (token)
where token is not null;

with ranked_profile_invitations as (
  select
    invitation.id,
    row_number() over (
      partition by invitation.yacht_id, invitation.crew_profile_id
      order by invitation.created_at desc nulls last, invitation.id desc
    ) as duplicate_rank
  from public.crew_invitations invitation
  where lower(coalesce(invitation.status, 'pending')) in ('pending', 'processing')
    and invitation.crew_profile_id is not null
)
delete from public.crew_invitations invitation
using ranked_profile_invitations ranked
where invitation.id = ranked.id
  and ranked.duplicate_rank > 1;

with ranked_email_invitations as (
  select
    invitation.id,
    row_number() over (
      partition by invitation.yacht_id, lower(invitation.invited_email)
      order by invitation.created_at desc nulls last, invitation.id desc
    ) as duplicate_rank
  from public.crew_invitations invitation
  where lower(coalesce(invitation.status, 'pending')) in ('pending', 'processing')
    and invitation.crew_profile_id is null
    and nullif(btrim(coalesce(invitation.invited_email, '')), '') is not null
)
delete from public.crew_invitations invitation
using ranked_email_invitations ranked
where invitation.id = ranked.id
  and ranked.duplicate_rank > 1;

create unique index if not exists crew_invitations_pending_profile_unique_idx
on public.crew_invitations (yacht_id, crew_profile_id)
where lower(coalesce(status, 'pending')) in ('pending', 'processing')
  and crew_profile_id is not null;

create unique index if not exists crew_invitations_pending_email_unique_idx
on public.crew_invitations (yacht_id, lower(invited_email))
where lower(coalesce(status, 'pending')) in ('pending', 'processing')
  and crew_profile_id is null
  and nullif(btrim(coalesce(invited_email, '')), '') is not null;

-- ---------------------------------------------------------------------------
-- Jobs V1 schema
-- ---------------------------------------------------------------------------

create table if not exists public.employer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  display_name text not null,
  company_name text,
  employer_type text not null default 'yacht',
  logo_url text,
  website_url text,
  country_code text,
  description text not null default '',
  verification_status text not null default 'unverified',
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employer_profiles_display_name_length_chk
    check (char_length(btrim(display_name)) between 2 and 120),
  constraint employer_profiles_company_name_length_chk
    check (company_name is null or char_length(btrim(company_name)) between 2 and 160),
  constraint employer_profiles_type_chk
    check (employer_type in (
      'yacht',
      'captain',
      'owner',
      'management_company',
      'recruitment_agency',
      'other'
    )),
  constraint employer_profiles_country_code_chk
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint employer_profiles_verification_status_chk
    check (verification_status in (
      'unverified',
      'pending',
      'verified',
      'rejected',
      'suspended'
    )),
  constraint employer_profiles_verified_at_chk
    check (verification_status <> 'verified' or verified_at is not null)
);

create table if not exists public.job_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  position text not null,
  department text not null,
  employment_type text not null,
  employer_id uuid not null references public.employer_profiles(id) on delete cascade,
  yacht_id uuid references public.yachts(id) on delete set null,
  location text not null,
  country_code text,
  yacht_name text,
  yacht_type text not null,
  yacht_length_metres numeric(7,2),
  yacht_program text,
  rotation text,
  start_date date,
  end_date date,
  summary text not null default '',
  description text not null default '',
  responsibilities text[] not null default '{}',
  requirements text[] not null default '{}',
  benefits text[] not null default '{}',
  certifications text[] not null default '{}',
  visas text[] not null default '{}',
  languages text[] not null default '{}',
  minimum_experience_years numeric(5,2) not null default 0,
  application_instructions text not null default '',
  salary_currency text,
  salary_minimum numeric(14,2),
  salary_maximum numeric(14,2),
  salary_period text,
  salary_visible boolean not null default false,
  featured boolean not null default false,
  openings_count integer not null default 1,
  status text not null default 'draft',
  application_deadline timestamptz,
  published_at timestamptz,
  expires_at timestamptz,
  closed_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_posts_slug_chk
    check (
      char_length(slug) between 3 and 160
      and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'
    ),
  constraint job_posts_title_length_chk
    check (char_length(btrim(title)) between 3 and 160),
  constraint job_posts_position_length_chk
    check (char_length(btrim(position)) between 2 and 100),
  constraint job_posts_department_chk
    check (department in (
      'Command',
      'Deck',
      'Engineering',
      'Interior',
      'Galley',
      'Purser',
      'Guest',
      'Toys',
      'Safety',
      'Security',
      'Medical'
    )),
  constraint job_posts_employment_type_chk
    check (employment_type in (
      'permanent',
      'seasonal',
      'rotational',
      'temporary',
      'delivery',
      'freelance',
      'daywork'
    )),
  constraint job_posts_country_code_chk
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  constraint job_posts_yacht_type_chk
    check (yacht_type in (
      'motor_yacht',
      'sailing_yacht',
      'catamaran',
      'motor_catamaran',
      'gulet',
      'expedition_yacht',
      'support_vessel',
      'chase_boat',
      'commercial_vessel',
      'other'
    )),
  constraint job_posts_yacht_program_chk
    check (
      yacht_program is null
      or yacht_program in (
        'private',
        'charter',
        'private_charter',
        'new_build',
        'refit',
        'delivery',
        'yard_period',
        'race_regatta',
        'other'
      )
    ),
  constraint job_posts_length_chk
    check (yacht_length_metres is null or yacht_length_metres between 1 and 300),
  constraint job_posts_dates_chk
    check (end_date is null or start_date is null or end_date >= start_date),
  constraint job_posts_experience_chk
    check (minimum_experience_years between 0 and 80),
  constraint job_posts_salary_values_chk
    check (
      (salary_minimum is null or salary_minimum >= 0)
      and (salary_maximum is null or salary_maximum >= 0)
      and (
        salary_minimum is null
        or salary_maximum is null
        or salary_maximum >= salary_minimum
      )
    ),
  constraint job_posts_salary_currency_chk
    check (salary_currency is null or salary_currency ~ '^[A-Z]{3}$'),
  constraint job_posts_salary_period_chk
    check (
      salary_period is null
      or salary_period in ('hour', 'day', 'week', 'month', 'year', 'contract')
    ),
  constraint job_posts_salary_completeness_chk
    check (
      (salary_minimum is null and salary_maximum is null)
      or (salary_currency is not null and salary_period is not null)
    ),
  constraint job_posts_hidden_salary_chk
    check (
      salary_visible
      or (salary_minimum is null and salary_maximum is null)
    ),
  constraint job_posts_openings_count_chk
    check (openings_count between 1 and 100),
  constraint job_posts_status_chk
    check (status in (
      'draft',
      'pending_review',
      'published',
      'paused',
      'filled',
      'closed',
      'rejected',
      'expired'
    )),
  constraint job_posts_publish_timestamp_chk
    check (status <> 'published' or published_at is not null),
  constraint job_posts_expiry_chk
    check (expires_at is null or published_at is null or expires_at > published_at)
);

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_posts(id) on delete cascade,
  crew_profile_id uuid not null references public.crew_profiles(id) on delete cascade,
  applicant_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'applied',
  cover_note text not null default '',
  answers jsonb not null default '{}'::jsonb,
  profile_snapshot jsonb not null default '{}'::jsonb,
  consent_to_share_profile boolean not null default false,
  submitted_at timestamptz not null default now(),
  viewed_at timestamptz,
  shortlisted_at timestamptz,
  interview_at timestamptz,
  offered_at timestamptz,
  hired_at timestamptz,
  rejected_at timestamptz,
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_applications_status_chk
    check (status in (
      'applied',
      'viewed',
      'shortlisted',
      'interview',
      'reference_check',
      'offer',
      'hired',
      'rejected',
      'withdrawn'
    )),
  constraint job_applications_cover_note_length_chk
    check (char_length(cover_note) <= 5000),
  constraint job_applications_answers_shape_chk
    check (jsonb_typeof(answers) = 'object'),
  constraint job_applications_snapshot_shape_chk
    check (jsonb_typeof(profile_snapshot) = 'object'),
  constraint job_applications_job_crew_unique
    unique (job_id, crew_profile_id),
  constraint job_applications_job_user_unique
    unique (job_id, applicant_user_id)
);

create table if not exists public.saved_jobs (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.job_posts(id) on delete cascade,
  crew_profile_id uuid not null references public.crew_profiles(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint saved_jobs_user_job_unique unique (user_id, job_id)
);

create unique index if not exists employer_profiles_user_id_idx
  on public.employer_profiles(user_id);
create index if not exists employer_profiles_verification_idx
  on public.employer_profiles(verification_status, created_at desc);
create index if not exists job_posts_public_feed_idx
  on public.job_posts(status, featured desc, published_at desc)
  where status = 'published';
create index if not exists job_posts_employer_idx
  on public.job_posts(employer_id, created_at desc);
create index if not exists job_posts_yacht_idx
  on public.job_posts(yacht_id, created_at desc)
  where yacht_id is not null;
create index if not exists job_posts_department_idx
  on public.job_posts(department, employment_type, published_at desc);
create index if not exists job_posts_country_idx
  on public.job_posts(country_code, published_at desc)
  where country_code is not null;
create index if not exists job_posts_certifications_gin_idx
  on public.job_posts using gin(certifications);
create index if not exists job_posts_languages_gin_idx
  on public.job_posts using gin(languages);
create index if not exists job_posts_search_idx
  on public.job_posts using gin(
    to_tsvector(
      'simple',
      coalesce(title, '') || ' ' ||
      coalesce(position, '') || ' ' ||
      coalesce(department, '') || ' ' ||
      coalesce(location, '') || ' ' ||
      coalesce(summary, '') || ' ' ||
      coalesce(description, '')
    )
  );
create index if not exists job_applications_applicant_idx
  on public.job_applications(applicant_user_id, submitted_at desc);
create index if not exists job_applications_job_pipeline_idx
  on public.job_applications(job_id, status, submitted_at desc);
create index if not exists job_applications_crew_idx
  on public.job_applications(crew_profile_id, submitted_at desc);
create index if not exists saved_jobs_user_idx
  on public.saved_jobs(user_id, created_at desc);
create index if not exists saved_jobs_crew_idx
  on public.saved_jobs(crew_profile_id, created_at desc);

create or replace function public.owns_employer_profile(target_employer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.employer_profiles employer
    where employer.id = target_employer_id
      and employer.user_id = auth.uid()
  );
$$;

create or replace function public.owns_job_employer(target_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.job_posts job
    join public.employer_profiles employer
      on employer.id = job.employer_id
    where job.id = target_job_id
      and employer.user_id = auth.uid()
  );
$$;

create or replace function public.owns_verified_job_employer(target_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.job_posts job
    join public.employer_profiles employer
      on employer.id = job.employer_id
    where job.id = target_job_id
      and employer.user_id = auth.uid()
      and employer.verification_status = 'verified'
  );
$$;

create or replace function public.is_public_job_open(target_job_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.job_posts job
    join public.employer_profiles employer
      on employer.id = job.employer_id
    where job.id = target_job_id
      and job.status = 'published'
      and job.published_at <= now()
      and (job.expires_at is null or job.expires_at > now())
      and (job.application_deadline is null or job.application_deadline >= now())
      and employer.verification_status = 'verified'
  );
$$;

revoke all on function public.owns_employer_profile(uuid) from public;
revoke all on function public.owns_job_employer(uuid) from public;
revoke all on function public.owns_verified_job_employer(uuid) from public;
revoke all on function public.is_public_job_open(uuid) from public;
grant execute on function public.owns_employer_profile(uuid) to anon, authenticated;
grant execute on function public.owns_job_employer(uuid) to authenticated;
grant execute on function public.owns_verified_job_employer(uuid) to authenticated;
grant execute on function public.is_public_job_open(uuid) to authenticated;

create or replace function public.guard_employer_profile_security()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or auth.role() = 'service_role'
     or public.is_platform_jobs_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.user_id is distinct from auth.uid()
       or new.verification_status <> 'unverified'
       or new.verified_at is not null then
      raise exception 'Employer identity or verification fields cannot be assigned by this user'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.user_id is distinct from old.user_id
     or new.verification_status is distinct from old.verification_status
     or new.verified_at is distinct from old.verified_at then
    raise exception 'Employer identity or verification fields are protected'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.set_job_status_timestamps()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'published' and new.published_at is null then
      new.published_at = now();
    end if;

    if new.status in ('filled', 'closed', 'rejected', 'expired')
       and new.closed_at is null then
      new.closed_at = now();
    end if;
  else
    if new.status = 'published'
       and old.status is distinct from 'published'
       and new.published_at is null then
      new.published_at = now();
    end if;

    if new.status in ('filled', 'closed', 'rejected', 'expired')
       and old.status is distinct from new.status
       and new.closed_at is null then
      new.closed_at = now();
    end if;
  end if;

  if new.status not in ('filled', 'closed', 'rejected', 'expired') then
    new.closed_at = null;
  end if;

  return new;
end;
$$;

create or replace function public.guard_job_post_security()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  status_transition_allowed boolean;
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or auth.role() = 'service_role'
     or public.is_platform_jobs_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.created_by is distinct from auth.uid()
       or not public.owns_employer_profile(new.employer_id)
       or new.status <> 'draft'
       or new.featured
       or new.published_at is not null
       or new.closed_at is not null then
      raise exception 'Only a protected employer draft can be created'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.employer_id is distinct from old.employer_id
     or new.created_by is distinct from old.created_by then
    raise exception 'Job ownership fields are immutable'
      using errcode = '42501';
  end if;

  if not public.owns_employer_profile(old.employer_id) then
    raise exception 'Job access denied'
      using errcode = '42501';
  end if;

  if new.featured is distinct from old.featured
     or new.published_at is distinct from old.published_at then
    raise exception 'Job moderation fields are protected'
      using errcode = '42501';
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  status_transition_allowed := case old.status
    when 'draft' then new.status in ('pending_review', 'closed')
    when 'pending_review' then new.status in ('draft', 'closed')
    when 'published' then new.status in ('paused', 'filled', 'closed')
    when 'paused' then new.status in ('pending_review', 'closed')
    when 'filled' then new.status = 'closed'
    when 'closed' then new.status = 'draft'
    when 'rejected' then new.status = 'draft'
    when 'expired' then new.status = 'draft'
    else false
  end;

  if not status_transition_allowed then
    raise exception 'Job status transition is not allowed'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create or replace function public.set_job_application_status_timestamps()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'UPDATE' then
    if new.status is not distinct from old.status then
      return new;
    end if;
  end if;

  if new.status = 'viewed' and new.viewed_at is null then
    new.viewed_at = now();
  elsif new.status = 'shortlisted' and new.shortlisted_at is null then
    new.shortlisted_at = now();
  elsif new.status = 'interview' and new.interview_at is null then
    new.interview_at = now();
  elsif new.status = 'offer' and new.offered_at is null then
    new.offered_at = now();
  elsif new.status = 'hired' and new.hired_at is null then
    new.hired_at = now();
  elsif new.status = 'rejected' and new.rejected_at is null then
    new.rejected_at = now();
  elsif new.status = 'withdrawn' and new.withdrawn_at is null then
    new.withdrawn_at = now();
  end if;

  return new;
end;
$$;

create or replace function public.guard_job_application_security()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  status_transition_allowed boolean;
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or auth.role() = 'service_role'
     or public.is_platform_jobs_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.applicant_user_id is distinct from auth.uid()
       or not public.owns_crew_profile(new.crew_profile_id)
       or not public.is_public_job_open(new.job_id)
       or new.status <> 'applied'
       or not new.consent_to_share_profile then
      raise exception 'A valid applicant profile and consent are required'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if new.job_id is distinct from old.job_id
     or new.crew_profile_id is distinct from old.crew_profile_id
     or new.applicant_user_id is distinct from old.applicant_user_id
     or new.submitted_at is distinct from old.submitted_at
     or new.cover_note is distinct from old.cover_note
     or new.answers is distinct from old.answers
     or new.profile_snapshot is distinct from old.profile_snapshot
     or new.consent_to_share_profile is distinct from old.consent_to_share_profile then
    raise exception 'Submitted application content is immutable'
      using errcode = '42501';
  end if;

  if new.status is not distinct from old.status then
    return new;
  end if;

  if old.applicant_user_id = auth.uid() then
    if new.status <> 'withdrawn'
       or old.status in ('hired', 'rejected', 'withdrawn') then
      raise exception 'Applicants may only withdraw an active application'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if not public.owns_verified_job_employer(old.job_id) then
    raise exception 'Application access denied'
      using errcode = '42501';
  end if;

  status_transition_allowed := case old.status
    when 'applied' then new.status in ('viewed', 'shortlisted', 'rejected')
    when 'viewed' then new.status in ('shortlisted', 'interview', 'rejected')
    when 'shortlisted' then new.status in ('interview', 'reference_check', 'offer', 'rejected')
    when 'interview' then new.status in ('shortlisted', 'reference_check', 'offer', 'rejected')
    when 'reference_check' then new.status in ('interview', 'offer', 'rejected')
    when 'offer' then new.status in ('hired', 'rejected')
    else false
  end;

  if not status_transition_allowed then
    raise exception 'Application status transition is not allowed'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists employer_profiles_touch_updated_at on public.employer_profiles;
create trigger employer_profiles_touch_updated_at
before update on public.employer_profiles
for each row execute function public.touch_updated_at();

drop trigger if exists employer_profiles_guard_security on public.employer_profiles;
create trigger employer_profiles_guard_security
before insert or update on public.employer_profiles
for each row execute function public.guard_employer_profile_security();

drop trigger if exists job_posts_touch_updated_at on public.job_posts;
create trigger job_posts_touch_updated_at
before update on public.job_posts
for each row execute function public.touch_updated_at();

drop trigger if exists a_job_posts_set_status_timestamps on public.job_posts;
create trigger a_job_posts_set_status_timestamps
before insert or update on public.job_posts
for each row execute function public.set_job_status_timestamps();

drop trigger if exists z_job_posts_guard_security on public.job_posts;
create trigger z_job_posts_guard_security
before insert or update on public.job_posts
for each row execute function public.guard_job_post_security();

drop trigger if exists job_applications_touch_updated_at on public.job_applications;
create trigger job_applications_touch_updated_at
before update on public.job_applications
for each row execute function public.touch_updated_at();

drop trigger if exists a_job_applications_set_status_timestamps on public.job_applications;
create trigger a_job_applications_set_status_timestamps
before insert or update on public.job_applications
for each row execute function public.set_job_application_status_timestamps();

drop trigger if exists z_job_applications_guard_security on public.job_applications;
create trigger z_job_applications_guard_security
before insert or update on public.job_applications
for each row execute function public.guard_job_application_security();

-- Invitations and membership changes are security-sensitive onboarding actions.
-- They are written only by authenticated server routes using the service role;
-- browser clients retain scoped read access but cannot mutate these records.
create or replace function public.guard_crew_invitation_security()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or auth.role() = 'service_role' then
    return new;
  end if;

  raise exception 'Yacht invitations must be changed through the secure server workflow'
    using errcode = '42501';
end;
$$;

drop trigger if exists crew_invitations_guard_security on public.crew_invitations;
create trigger crew_invitations_guard_security
before insert or update on public.crew_invitations
for each row execute function public.guard_crew_invitation_security();

create or replace function public.guard_yacht_membership_security()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or auth.role() = 'service_role' then
    return new;
  end if;

  raise exception 'Yacht memberships must be changed through the secure server workflow'
    using errcode = '42501';
end;
$$;

drop trigger if exists yacht_memberships_guard_security on public.yacht_crew_memberships;
create trigger yacht_memberships_guard_security
before insert or update on public.yacht_crew_memberships
for each row execute function public.guard_yacht_membership_security();

create or replace function public.guard_yacht_checklist_security()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  old_status text := lower(coalesce(old.status, 'open'));
  new_status text;
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or auth.role() = 'service_role' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if old_status = 'completed' then
    raise exception 'Completed checklists are immutable audit records'
      using errcode = '42501';
  end if;

  if not public.can_access_yacht(old.yacht_id) then
    raise exception 'Current yacht access is required to change checklist records'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    if public.can_manage_yacht(old.yacht_id)
       or old.created_by = auth.uid() then
      return old;
    end if;

    raise exception 'Only yacht management or the checklist creator may delete an open checklist'
      using errcode = '42501';
  end if;

  if new.id is distinct from old.id
     or new.yacht_id is distinct from old.yacht_id
     or new.created_at is distinct from old.created_at
     or new.created_by is distinct from old.created_by
     or new.assigned_to is distinct from old.assigned_to then
    raise exception 'Checklist identity fields are immutable'
      using errcode = '42501';
  end if;

  new_status := lower(coalesce(new.status, ''));
  if old_status <> 'open'
     or new_status not in ('open', 'completed')
     or (new_status = 'open' and new.completed_at is not null)
     or (
       new_status = 'completed'
       and (
         new.completed_at is null
         or new.completed_at < old.created_at
         or new.completed_at > now() + interval '5 minutes'
       )
     ) then
    raise exception 'Invalid checklist completion transition'
      using errcode = '42501';
  end if;

  if new_status = 'completed'
     and (
       not exists (
         select 1
         from public.yacht_checklist_items item
         where item.checklist_id = old.id
       )
       or exists (
         select 1
         from public.yacht_checklist_items item
         where item.checklist_id = old.id
           and not coalesce(item.completed, false)
       )
     ) then
    raise exception 'Every checklist item must be completed first'
      using errcode = '23514';
  end if;

  if public.can_manage_yacht(old.yacht_id) then
    return new;
  end if;

  if not public.owns_crew_profile(old.assigned_to)
     or new.title is distinct from old.title
     or new.department is distinct from old.department
     or new.checklist_type is distinct from old.checklist_type
     or new.items is distinct from old.items
     or new.due_date is distinct from old.due_date then
    raise exception 'Crew may only complete their own unchanged checklist'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists yacht_checklists_guard_security on public.yacht_checklists;
create trigger yacht_checklists_guard_security
before update or delete on public.yacht_checklists
for each row execute function public.guard_yacht_checklist_security();

create or replace function public.guard_yacht_checklist_item_security()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  checklist_record public.yacht_checklists%rowtype;
  old_note jsonb;
  new_note jsonb;
  old_before_photo text;
  new_before_photo text;
  old_after_photo text;
  new_after_photo text;
  expected_storage_prefix text;
  expected_storage_url_prefix text;
  current_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or auth.role() = 'service_role' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  select *
  into checklist_record
  from public.yacht_checklists checklist
  where checklist.id = old.checklist_id;

  if checklist_record.id is null then
    raise exception 'Checklist record not found'
      using errcode = '23503';
  end if;

  if lower(coalesce(checklist_record.status, 'open')) = 'completed' then
    raise exception 'Completed checklist evidence is immutable'
      using errcode = '42501';
  end if;

  if not public.can_access_yacht(checklist_record.yacht_id) then
    raise exception 'Current yacht access is required to change checklist evidence'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    if public.can_manage_yacht(checklist_record.yacht_id)
       or checklist_record.created_by = auth.uid() then
      return old;
    end if;

    raise exception 'Only yacht management or the checklist creator may delete an open checklist item'
      using errcode = '42501';
  end if;

  if new.id is distinct from old.id
     or new.checklist_id is distinct from old.checklist_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Checklist item identity fields are immutable'
      using errcode = '42501';
  end if;

  old_note := public.try_parse_jsonb(old.note);
  new_note := public.try_parse_jsonb(new.note);
  old_before_photo := nullif(old_note ->> 'before_photo_url', '');
  new_before_photo := nullif(new_note ->> 'before_photo_url', '');
  old_after_photo := nullif(old_note ->> 'after_photo_url', '');
  new_after_photo := nullif(new_note ->> 'after_photo_url', '');
  expected_storage_prefix :=
    checklist_record.yacht_id::text || '/' || old.id::text || '/';
  expected_storage_url_prefix :=
    regexp_replace(coalesce(auth.jwt() ->> 'iss', ''), '/auth/v1/?$', '')
    || '/storage/v1/object/public/task-photos/';

  if old_before_photo is not null
     and new_before_photo is distinct from old_before_photo then
    raise exception 'Existing before-task proof cannot be replaced'
      using errcode = '42501';
  end if;

  if old_after_photo is not null
     and new_after_photo is distinct from old_after_photo then
    raise exception 'Existing after-task proof cannot be replaced'
      using errcode = '42501';
  end if;

  if new_before_photo is distinct from old_before_photo
     and (
       new_before_photo is null
       or position(expected_storage_url_prefix || expected_storage_prefix in new_before_photo) <> 1
       or not exists (
         select 1
         from storage.objects object
         where object.bucket_id = 'task-photos'
           and object.name = substr(
             new_before_photo,
             char_length(expected_storage_url_prefix) + 1
           )
           and object.name like expected_storage_prefix || '%'
       )
     ) then
    raise exception 'Before-task proof must reference the assigned task storage path'
      using errcode = '42501';
  end if;

  if new_after_photo is distinct from old_after_photo
     and (
       new_after_photo is null
       or position(expected_storage_url_prefix || expected_storage_prefix in new_after_photo) <> 1
       or not exists (
         select 1
         from storage.objects object
         where object.bucket_id = 'task-photos'
           and object.name = substr(
             new_after_photo,
             char_length(expected_storage_url_prefix) + 1
           )
           and object.name like expected_storage_prefix || '%'
       )
     ) then
    raise exception 'After-task proof must reference the assigned task storage path'
      using errcode = '42501';
  end if;

  if coalesce(old.completed, false) then
    raise exception 'Completed checklist items are immutable audit records'
      using errcode = '42501';
  end if;

  if coalesce(new.completed, false) then
    if new.completed_at is null
       or new.completed_at < old.created_at
       or new.completed_at > now() + interval '5 minutes'
       or current_email = ''
       or lower(coalesce(new.completed_by, '')) <> current_email then
      raise exception 'Task completion must be attributed to the signed-in crew member'
        using errcode = '42501';
    end if;
  elsif new.completed_at is not null
        or nullif(btrim(coalesce(new.completed_by, '')), '') is not null then
    raise exception 'Incomplete tasks cannot retain a completion timestamp'
      using errcode = '23514';
  end if;

  if public.can_manage_yacht(checklist_record.yacht_id) then
    if new_after_photo is distinct from old_after_photo
       and not public.owns_crew_profile(checklist_record.assigned_to) then
      raise exception 'Only the assigned crew member may add after-task proof'
        using errcode = '42501';
    end if;

    return new;
  end if;

  if checklist_record.created_by = auth.uid()
     and not public.owns_crew_profile(checklist_record.assigned_to) then
    if new.task_text is distinct from old.task_text
       or new.completed is distinct from old.completed
       or new.completed_at is distinct from old.completed_at
       or new.completed_by is distinct from old.completed_by
       or new_after_photo is distinct from old_after_photo
       or new_before_photo is null
       or old_before_photo is not null
       or (new_note - 'before_photo_url') is distinct from (old_note - 'before_photo_url') then
      raise exception 'Checklist creators may only attach the initial before-task proof'
        using errcode = '42501';
    end if;

    return new;
  end if;

  if not public.owns_crew_profile(checklist_record.assigned_to)
     or new.task_text is distinct from old.task_text then
    raise exception 'Crew may only update completion evidence on assigned tasks'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists yacht_checklist_items_guard_security on public.yacht_checklist_items;
create trigger yacht_checklist_items_guard_security
before update or delete on public.yacht_checklist_items
for each row execute function public.guard_yacht_checklist_item_security();

create or replace function public.guard_yacht_contract_signature()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or auth.role() = 'service_role' then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not public.can_manage_yacht(new.yacht_id)
       or lower(coalesce(new.status, '')) not in ('studio_draft', 'sent_for_signature')
       or nullif(btrim(coalesce(new.contract_text, '')), '') is null
       or new.signed_name is not null
       or new.signed_at is not null then
      raise exception 'Contracts must begin as an unsigned draft or signature request'
        using errcode = '42501';
    end if;

    if lower(coalesce(new.status, '')) = 'sent_for_signature'
       and (
         new.crew_profile_id is null
         or new.membership_id is null
         or new.sent_at is null
         or not exists (
           select 1
           from public.yacht_crew_memberships membership
           where membership.id = new.membership_id
             and membership.yacht_id = new.yacht_id
             and membership.crew_profile_id = new.crew_profile_id
             and lower(coalesce(membership.status, '')) = 'active'
         )
       ) then
      raise exception 'Signature requests require a matching active yacht membership'
        using errcode = '23514';
    end if;

    return new;
  end if;

  if lower(coalesce(old.status, '')) = 'signed' then
    raise exception 'Signed contracts are immutable audit records'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    if public.can_manage_yacht(old.yacht_id) then
      return old;
    end if;

    raise exception 'Only yacht management may delete an unsigned contract'
      using errcode = '42501';
  end if;

  if new.id is distinct from old.id
     or new.yacht_id is distinct from old.yacht_id
     or new.crew_profile_id is distinct from old.crew_profile_id
     or new.membership_id is distinct from old.membership_id then
    raise exception 'Contract identity fields are immutable'
      using errcode = '42501';
  end if;

  if public.owns_crew_profile(old.crew_profile_id) then
    if lower(coalesce(old.status, '')) <> 'sent_for_signature'
       or not exists (
         select 1
         from public.yacht_crew_memberships membership
         where membership.id = old.membership_id
           and membership.yacht_id = old.yacht_id
           and membership.crew_profile_id = old.crew_profile_id
           and lower(coalesce(membership.status, '')) = 'active'
       )
       or new.contract_text is distinct from old.contract_text
       or new.sent_at is distinct from old.sent_at
       or lower(coalesce(new.status, '')) <> 'signed'
       or char_length(btrim(coalesce(new.signed_name, ''))) not between 2 and 160
       or old.sent_at is null
       or new.signed_at is null
       or new.signed_at < old.sent_at
       or new.signed_at > now() + interval '5 minutes' then
      raise exception 'Crew may only sign their own unchanged sent contract'
        using errcode = '42501';
    end if;

    return new;
  end if;

  if public.can_manage_yacht(old.yacht_id) then
    if lower(coalesce(old.status, '')) not in ('draft', 'studio_draft')
       or lower(coalesce(new.status, '')) <> lower(coalesce(old.status, ''))
       or new.signed_name is distinct from old.signed_name
       or new.signed_at is distinct from old.signed_at then
      raise exception 'Only unsigned contract drafts may be edited'
        using errcode = '42501';
    end if;

    return new;
  end if;

  raise exception 'Contract access denied'
    using errcode = '42501';
end;
$$;

drop trigger if exists yacht_contracts_guard_signature on public.yacht_contracts;
create trigger yacht_contracts_guard_signature
before insert or update or delete on public.yacht_contracts
for each row execute function public.guard_yacht_contract_signature();

-- Base account roles are user-editable account preferences, not authorization
-- claims. Yacht authority is derived only from yacht ownership and active
-- membership position by the security functions above.
update public.profiles
set role = lower(btrim(role))
where lower(btrim(coalesce(role, ''))) in (
  'crew',
  'captain',
  'owner',
  'management'
)
and role is distinct from lower(btrim(role));

update public.profiles
set role = 'crew'
where role is null
   or role not in ('crew', 'captain', 'owner', 'management');

alter table public.profiles
  alter column role set default 'crew',
  alter column role set not null;

alter table public.profiles
  drop constraint if exists profiles_role_chk;

alter table public.profiles
  add constraint profiles_role_chk
  check (role in ('crew', 'captain', 'owner', 'management'));

comment on column public.profiles.role is
  'User-editable BlueDeck account preference. Never use for authorization.';

-- Private-by-default database baseline. Public marketplace access is restored
-- later only for the curated employer/job columns explicitly listed below.
do $$
declare
  target_table text;
begin
  for target_table in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format('revoke all on table public.%I from anon', target_table);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Replace unsafe policies on profile and yacht foundation tables.
-- ---------------------------------------------------------------------------

do $$
declare
  target_table text;
  existing_policy record;
begin
  foreach target_table in array array[
    'profiles',
    'crew_profiles',
    'crew_experiences',
    'crew_documents',
    'crew_references',
    'crew_portfolio_photos',
    'yachts',
    'yacht_crew_memberships',
    'crew_invitations',
    'yacht_checklists',
    'yacht_checklist_items',
    'yacht_contracts',
    'employer_profiles',
    'job_posts',
    'job_applications',
    'saved_jobs'
  ]
  loop
    if to_regclass(format('public.%I', target_table)) is null then
      continue;
    end if;

    execute format('alter table public.%I enable row level security', target_table);

    for existing_policy in
      select policyname
      from pg_policies
      where schemaname = 'public'
        and tablename = target_table
    loop
      execute format(
        'drop policy if exists %I on public.%I',
        existing_policy.policyname,
        target_table
      );
    end loop;

    execute format('revoke all on table public.%I from anon', target_table);
    execute format('revoke all on table public.%I from authenticated', target_table);
  end loop;
end;
$$;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.crew_profiles to authenticated;
grant select, insert, update, delete on public.crew_experiences to authenticated;
grant select, insert, update, delete on public.crew_documents to authenticated;
grant select, insert, update, delete on public.crew_references to authenticated;
grant select, insert, update, delete on public.crew_portfolio_photos to authenticated;
grant select, insert, update, delete on public.yachts to authenticated;
grant select on public.yacht_crew_memberships to authenticated;
grant select on public.crew_invitations to authenticated;
grant select, update, delete on public.yacht_checklists to authenticated;
grant select, update, delete on public.yacht_checklist_items to authenticated;
grant select, insert, update, delete on public.yacht_contracts to authenticated;

create policy "Profiles owner access"
on public.profiles
for all
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Crew profiles owner access"
on public.crew_profiles
for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Crew profiles yacht manager read"
on public.crew_profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.yacht_crew_memberships membership
    where membership.crew_profile_id = crew_profiles.id
      and public.can_manage_yacht(membership.yacht_id)
  )
);

create policy "Crew experiences owner access"
on public.crew_experiences
for all
to authenticated
using (public.owns_crew_profile(crew_profile_id))
with check (public.owns_crew_profile(crew_profile_id));

create policy "Crew documents owner access"
on public.crew_documents
for all
to authenticated
using (public.owns_crew_profile(crew_profile_id))
with check (public.owns_crew_profile(crew_profile_id));

create policy "Crew references owner access"
on public.crew_references
for all
to authenticated
using (public.owns_crew_profile(crew_profile_id))
with check (public.owns_crew_profile(crew_profile_id));

create policy "Crew portfolio owner access"
on public.crew_portfolio_photos
for all
to authenticated
using (public.owns_crew_profile(crew_profile_id))
with check (public.owns_crew_profile(crew_profile_id));

create policy "Yachts owner read"
on public.yachts
for select
to authenticated
using (public.can_access_yacht(id));

create policy "Yachts owner create"
on public.yachts
for insert
to authenticated
with check (owner_id = auth.uid());

create policy "Yachts owner update"
on public.yachts
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy "Yachts owner delete"
on public.yachts
for delete
to authenticated
using (owner_id = auth.uid());

create policy "Yacht memberships scoped read"
on public.yacht_crew_memberships
for select
to authenticated
using (
  public.can_manage_yacht(yacht_id)
  or public.owns_crew_profile(crew_profile_id)
  or (
    public.is_unclaimed_crew_profile(crew_profile_id)
    and
    coalesce(auth.jwt() ->> 'email', '') <> ''
    and lower(coalesce(invited_email, '')) = lower(auth.jwt() ->> 'email')
  )
);

create policy "Crew invitations recipient or manager read"
on public.crew_invitations
for select
to authenticated
using (
  public.can_manage_yacht(yacht_id)
  or public.owns_crew_profile(crew_profile_id)
  or (
    public.is_unclaimed_crew_profile(crew_profile_id)
    and
    coalesce(auth.jwt() ->> 'email', '') <> ''
    and lower(coalesce(invited_email, '')) = lower(auth.jwt() ->> 'email')
  )
);

create policy "Yacht checklists scoped read"
on public.yacht_checklists
for select
to authenticated
using (
  public.can_manage_yacht(yacht_id)
  or (
    public.can_access_yacht(yacht_id)
    and (
      created_by = auth.uid()
      or public.owns_crew_profile(assigned_to)
    )
  )
);

create policy "Yacht checklists manager or assignee update"
on public.yacht_checklists
for update
to authenticated
using (
  public.can_manage_yacht(yacht_id)
  or (
    public.can_access_yacht(yacht_id)
    and public.owns_crew_profile(assigned_to)
  )
)
with check (
  public.can_manage_yacht(yacht_id)
  or (
    public.can_access_yacht(yacht_id)
    and public.owns_crew_profile(assigned_to)
  )
);

create policy "Yacht checklists manager delete"
on public.yacht_checklists
for delete
to authenticated
using (
  public.can_manage_yacht(yacht_id)
  or (
    public.can_access_yacht(yacht_id)
    and created_by = auth.uid()
  )
);

create policy "Yacht checklist items scoped read"
on public.yacht_checklist_items
for select
to authenticated
using (
  exists (
    select 1
    from public.yacht_checklists checklist
    where checklist.id = checklist_id
      and (
        public.can_manage_yacht(checklist.yacht_id)
        or (
          public.can_access_yacht(checklist.yacht_id)
          and (
            checklist.created_by = auth.uid()
            or public.owns_crew_profile(checklist.assigned_to)
          )
        )
      )
  )
);

create policy "Yacht checklist items manager or assignee update"
on public.yacht_checklist_items
for update
to authenticated
using (
  exists (
    select 1
    from public.yacht_checklists checklist
    where checklist.id = checklist_id
      and (
        public.can_manage_yacht(checklist.yacht_id)
        or (
          public.can_access_yacht(checklist.yacht_id)
          and (
            checklist.created_by = auth.uid()
            or public.owns_crew_profile(checklist.assigned_to)
          )
        )
      )
  )
)
with check (
  exists (
    select 1
    from public.yacht_checklists checklist
    where checklist.id = checklist_id
      and (
        public.can_manage_yacht(checklist.yacht_id)
        or (
          public.can_access_yacht(checklist.yacht_id)
          and (
            checklist.created_by = auth.uid()
            or public.owns_crew_profile(checklist.assigned_to)
          )
        )
      )
  )
);

create policy "Yacht checklist items manager delete"
on public.yacht_checklist_items
for delete
to authenticated
using (
  exists (
    select 1
    from public.yacht_checklists checklist
    where checklist.id = checklist_id
      and (
        public.can_manage_yacht(checklist.yacht_id)
        or (
          public.can_access_yacht(checklist.yacht_id)
          and checklist.created_by = auth.uid()
        )
      )
  )
);

create policy "Yacht contracts manager or crew read"
on public.yacht_contracts
for select
to authenticated
using (
  public.can_manage_yacht(yacht_id)
  or public.owns_crew_profile(crew_profile_id)
);

create policy "Yacht contracts manager create"
on public.yacht_contracts
for insert
to authenticated
with check (public.can_manage_yacht(yacht_id));

create policy "Yacht contracts manager or crew sign"
on public.yacht_contracts
for update
to authenticated
using (
  public.can_manage_yacht(yacht_id)
  or (
    public.owns_crew_profile(crew_profile_id)
    and exists (
      select 1
      from public.yacht_crew_memberships membership
      where membership.id = yacht_contracts.membership_id
        and membership.yacht_id = yacht_contracts.yacht_id
        and membership.crew_profile_id = yacht_contracts.crew_profile_id
        and lower(coalesce(membership.status, '')) = 'active'
    )
  )
)
with check (
  public.can_manage_yacht(yacht_id)
  or (
    public.owns_crew_profile(crew_profile_id)
    and exists (
      select 1
      from public.yacht_crew_memberships membership
      where membership.id = yacht_contracts.membership_id
        and membership.yacht_id = yacht_contracts.yacht_id
        and membership.crew_profile_id = yacht_contracts.crew_profile_id
        and lower(coalesce(membership.status, '')) = 'active'
    )
  )
);

create policy "Yacht contracts manager delete"
on public.yacht_contracts
for delete
to authenticated
using (public.can_manage_yacht(yacht_id));

-- Enforce tenant isolation across every legacy operational table that carries
-- yacht_id without erasing its module-specific permissive policies. A
-- restrictive boundary is ANDed with those policies, so no authenticated
-- account can cross from one yacht into another. Tables without any existing
-- authenticated permissive policy receive a tenant-scoped compatibility
-- fallback. Writes are then narrowed to management, the responsible
-- department, or the small set of deliberately collaborative modules.
do $$
declare
  target_table text;
  has_select_policy boolean;
  has_insert_policy boolean;
  has_update_policy boolean;
  has_delete_policy boolean;
  member_write_tables text[] := array[
    'bluedeck_events',
    'inventory_items'
  ];
  engineering_write_tables text[] := array[
    'engine_hours',
    'engine_logs',
    'engineering_assets',
    'engineering_service_logs',
    'fuel_logs',
    'maintenance_logs',
    'maintenance_schedules',
    'maintenance_tasks',
    'quick_engine_reports'
  ];
  deck_write_tables text[] := array[
    'ais_targets',
    'anchor_watch',
    'marina_operations',
    'voyage_plans',
    'voyages',
    'weather_snapshots',
    'watchkeeping_duties',
    'watchkeeping_logs',
    'watchkeeping_rota'
  ];
  restricted_finance_tables text[] := array[
    'finance_items',
    'yacht_expenses'
  ];
  restricted_document_tables text[] := array[
    'expiry_alerts'
  ];
  restricted_guest_tables text[] := array[
    'guest_profiles',
    'guest_requests'
  ];
  manager_only_tables text[] := array[
    'app_users',
    'captain_logbook',
    'captain_logs',
    'command_alerts',
    'crew_assignments',
    'crew_contracts',
    'crew_members',
    'crew_role_assignments',
    'crews',
    'operation_reports',
    'owner_preparations',
    'owner_updates',
    'role_assignments',
    'user_profiles',
    'yacht_documents',
    'yacht_reports'
  ];
begin
  for target_table in
    select columns.table_name
    from information_schema.columns columns
    join information_schema.tables tables
      on tables.table_schema = columns.table_schema
     and tables.table_name = columns.table_name
    where columns.table_schema = 'public'
      and columns.column_name = 'yacht_id'
      and tables.table_type = 'BASE TABLE'
      and columns.table_name not in (
        'crew_profiles',
        'crew_documents',
        'crew_invitations',
        'job_posts',
        'yacht_checklists',
        'yacht_contracts',
        'yacht_crew_memberships'
      )
  loop
    execute format('alter table public.%I enable row level security', target_table);
    execute format('revoke all on table public.%I from anon', target_table);
    execute format(
      'grant select, insert, update, delete on table public.%I to authenticated',
      target_table
    );

    execute format(
      'drop policy if exists %I on public.%I',
      'BlueDeck yacht tenant boundary',
      target_table
    );
    execute format(
      'create policy %I on public.%I as restrictive for all to authenticated using (public.can_access_yacht(yacht_id)) with check (public.can_access_yacht(yacht_id))',
      'BlueDeck yacht tenant boundary',
      target_table
    );

    execute format(
      'drop policy if exists %I on public.%I',
      'BlueDeck scoped module access',
      target_table
    );
    execute format('drop policy if exists %I on public.%I', 'BlueDeck scoped module select', target_table);
    execute format('drop policy if exists %I on public.%I', 'BlueDeck scoped module insert', target_table);
    execute format('drop policy if exists %I on public.%I', 'BlueDeck scoped module update', target_table);
    execute format('drop policy if exists %I on public.%I', 'BlueDeck scoped module delete', target_table);

    select exists (
      select 1
      from pg_policies policy
      where policy.schemaname = 'public'
        and policy.tablename = target_table
        and policy.permissive = 'PERMISSIVE'
        and policy.cmd in ('ALL', 'SELECT')
        and (
          'authenticated' = any(policy.roles)
          or 'public' = any(policy.roles)
        )
    )
    into has_select_policy;

    select exists (
      select 1
      from pg_policies policy
      where policy.schemaname = 'public'
        and policy.tablename = target_table
        and policy.permissive = 'PERMISSIVE'
        and policy.cmd in ('ALL', 'INSERT')
        and (
          'authenticated' = any(policy.roles)
          or 'public' = any(policy.roles)
        )
    )
    into has_insert_policy;

    select exists (
      select 1
      from pg_policies policy
      where policy.schemaname = 'public'
        and policy.tablename = target_table
        and policy.permissive = 'PERMISSIVE'
        and policy.cmd in ('ALL', 'UPDATE')
        and (
          'authenticated' = any(policy.roles)
          or 'public' = any(policy.roles)
        )
    )
    into has_update_policy;

    select exists (
      select 1
      from pg_policies policy
      where policy.schemaname = 'public'
        and policy.tablename = target_table
        and policy.permissive = 'PERMISSIVE'
        and policy.cmd in ('ALL', 'DELETE')
        and (
          'authenticated' = any(policy.roles)
          or 'public' = any(policy.roles)
        )
    )
    into has_delete_policy;

    if not has_select_policy then
      execute format(
        'create policy %I on public.%I as permissive for select to authenticated using (public.can_access_yacht(yacht_id))',
        'BlueDeck scoped module select',
        target_table
      );
    end if;

    if not has_insert_policy then
      execute format(
        'create policy %I on public.%I as permissive for insert to authenticated with check (public.can_access_yacht(yacht_id))',
        'BlueDeck scoped module insert',
        target_table
      );
    end if;

    if not has_update_policy then
      execute format(
        'create policy %I on public.%I as permissive for update to authenticated using (public.can_access_yacht(yacht_id)) with check (public.can_access_yacht(yacht_id))',
        'BlueDeck scoped module update',
        target_table
      );
    end if;

    if not has_delete_policy then
      execute format(
        'create policy %I on public.%I as permissive for delete to authenticated using (public.can_access_yacht(yacht_id))',
        'BlueDeck scoped module delete',
        target_table
      );
    end if;

    execute format(
      'drop policy if exists %I on public.%I',
      'BlueDeck sensitive module manager boundary',
      target_table
    );
    execute format(
      'drop policy if exists %I on public.%I',
      'BlueDeck critical module manager insert boundary',
      target_table
    );
    execute format(
      'drop policy if exists %I on public.%I',
      'BlueDeck critical module manager update boundary',
      target_table
    );
    execute format(
      'drop policy if exists %I on public.%I',
      'BlueDeck critical module manager delete boundary',
      target_table
    );
    execute format(
      'drop policy if exists %I on public.%I',
      'BlueDeck department module insert boundary',
      target_table
    );
    execute format(
      'drop policy if exists %I on public.%I',
      'BlueDeck department module update boundary',
      target_table
    );
    execute format(
      'drop policy if exists %I on public.%I',
      'BlueDeck department module delete boundary',
      target_table
    );
    execute format(
      'drop policy if exists %I on public.%I',
      'BlueDeck department module read boundary',
      target_table
    );

    if target_table = any(manager_only_tables) then
      execute format(
        'create policy %I on public.%I as restrictive for all to authenticated using (public.can_manage_yacht(yacht_id)) with check (public.can_manage_yacht(yacht_id))',
        'BlueDeck sensitive module manager boundary',
        target_table
      );
    elsif target_table = any(restricted_finance_tables) then
      execute format(
        'create policy %I on public.%I as restrictive for select to authenticated using (public.can_supervise_yacht_departments(yacht_id, array[''Purser'']::text[]))',
        'BlueDeck department module read boundary',
        target_table
      );
      execute format(
        'create policy %I on public.%I as restrictive for insert to authenticated with check (public.can_supervise_yacht_departments(yacht_id, array[''Purser'']::text[]))',
        'BlueDeck department module insert boundary',
        target_table
      );
      execute format(
        'create policy %I on public.%I as restrictive for update to authenticated using (public.can_supervise_yacht_departments(yacht_id, array[''Purser'']::text[])) with check (public.can_supervise_yacht_departments(yacht_id, array[''Purser'']::text[]))',
        'BlueDeck department module update boundary',
        target_table
      );
      execute format(
        'create policy %I on public.%I as restrictive for delete to authenticated using (public.can_manage_yacht(yacht_id))',
        'BlueDeck department module delete boundary',
        target_table
      );
    elsif target_table = any(restricted_document_tables) then
      execute format(
        'create policy %I on public.%I as restrictive for select to authenticated using (public.can_supervise_yacht_departments(yacht_id, array[''Command'', ''Deck'', ''Engineering'', ''Interior'', ''Purser'']::text[]))',
        'BlueDeck department module read boundary',
        target_table
      );
      execute format(
        'create policy %I on public.%I as restrictive for insert to authenticated with check (public.can_supervise_yacht_departments(yacht_id, array[''Command'', ''Deck'', ''Engineering'', ''Interior'', ''Purser'']::text[]))',
        'BlueDeck department module insert boundary',
        target_table
      );
      execute format(
        'create policy %I on public.%I as restrictive for update to authenticated using (public.can_supervise_yacht_departments(yacht_id, array[''Command'', ''Deck'', ''Engineering'', ''Interior'', ''Purser'']::text[])) with check (public.can_supervise_yacht_departments(yacht_id, array[''Command'', ''Deck'', ''Engineering'', ''Interior'', ''Purser'']::text[]))',
        'BlueDeck department module update boundary',
        target_table
      );
      execute format(
        'create policy %I on public.%I as restrictive for delete to authenticated using (public.can_manage_yacht(yacht_id))',
        'BlueDeck department module delete boundary',
        target_table
      );
    elsif target_table = any(restricted_guest_tables) then
      execute format(
        'create policy %I on public.%I as restrictive for select to authenticated using (public.can_write_yacht_departments(yacht_id, array[''Interior'', ''Guest'', ''Purser'']::text[]))',
        'BlueDeck department module read boundary',
        target_table
      );
      execute format(
        'create policy %I on public.%I as restrictive for insert to authenticated with check (public.can_write_yacht_departments(yacht_id, array[''Interior'', ''Guest'', ''Purser'']::text[]))',
        'BlueDeck department module insert boundary',
        target_table
      );
      execute format(
        'create policy %I on public.%I as restrictive for update to authenticated using (public.can_supervise_yacht_departments(yacht_id, array[''Interior'', ''Guest'', ''Purser'']::text[])) with check (public.can_supervise_yacht_departments(yacht_id, array[''Interior'', ''Guest'', ''Purser'']::text[]))',
        'BlueDeck department module update boundary',
        target_table
      );
      execute format(
        'create policy %I on public.%I as restrictive for delete to authenticated using (public.can_manage_yacht(yacht_id))',
        'BlueDeck department module delete boundary',
        target_table
      );
    elsif target_table = any(engineering_write_tables) then
      execute format(
        'create policy %I on public.%I as restrictive for insert to authenticated with check (public.can_write_yacht_departments(yacht_id, array[''Engineering'']::text[]))',
        'BlueDeck department module insert boundary',
        target_table
      );
      execute format(
        'create policy %I on public.%I as restrictive for update to authenticated using (public.can_supervise_yacht_departments(yacht_id, array[''Engineering'']::text[])) with check (public.can_supervise_yacht_departments(yacht_id, array[''Engineering'']::text[]))',
        'BlueDeck department module update boundary',
        target_table
      );
      execute format(
        'create policy %I on public.%I as restrictive for delete to authenticated using (public.can_manage_yacht(yacht_id))',
        'BlueDeck department module delete boundary',
        target_table
      );
    elsif target_table = any(deck_write_tables) then
      execute format(
        'create policy %I on public.%I as restrictive for insert to authenticated with check (public.can_write_yacht_departments(yacht_id, array[''Command'', ''Deck'', ''Safety'', ''Security'']::text[]))',
        'BlueDeck department module insert boundary',
        target_table
      );
      execute format(
        'create policy %I on public.%I as restrictive for update to authenticated using (public.can_supervise_yacht_departments(yacht_id, array[''Command'', ''Deck'', ''Safety'', ''Security'']::text[])) with check (public.can_supervise_yacht_departments(yacht_id, array[''Command'', ''Deck'', ''Safety'', ''Security'']::text[]))',
        'BlueDeck department module update boundary',
        target_table
      );
      execute format(
        'create policy %I on public.%I as restrictive for delete to authenticated using (public.can_manage_yacht(yacht_id))',
        'BlueDeck department module delete boundary',
        target_table
      );
    elsif target_table = any(member_write_tables) then
      execute format(
        'create policy %I on public.%I as restrictive for update to authenticated using (public.can_supervise_yacht_departments(yacht_id, array[''Command'', ''Deck'', ''Engineering'', ''Interior'', ''Galley'', ''Purser'', ''Guest'', ''Toys'', ''Safety'', ''Security'', ''Medical'']::text[])) with check (public.can_supervise_yacht_departments(yacht_id, array[''Command'', ''Deck'', ''Engineering'', ''Interior'', ''Galley'', ''Purser'', ''Guest'', ''Toys'', ''Safety'', ''Security'', ''Medical'']::text[]))',
        'BlueDeck department module update boundary',
        target_table
      );
      execute format(
        'create policy %I on public.%I as restrictive for delete to authenticated using (public.can_manage_yacht(yacht_id))',
        'BlueDeck critical module manager delete boundary',
        target_table
      );
    else
      execute format(
        'create policy %I on public.%I as restrictive for insert to authenticated with check (public.can_manage_yacht(yacht_id))',
        'BlueDeck critical module manager insert boundary',
        target_table
      );
      execute format(
        'create policy %I on public.%I as restrictive for update to authenticated using (public.can_manage_yacht(yacht_id)) with check (public.can_manage_yacht(yacht_id))',
        'BlueDeck critical module manager update boundary',
        target_table
      );
      execute format(
        'create policy %I on public.%I as restrictive for delete to authenticated using (public.can_manage_yacht(yacht_id))',
        'BlueDeck critical module manager delete boundary',
        target_table
      );
    end if;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Jobs RLS and grants
-- ---------------------------------------------------------------------------

alter table public.employer_profiles enable row level security;
alter table public.job_posts enable row level security;
alter table public.job_applications enable row level security;
alter table public.saved_jobs enable row level security;

grant select (
  id,
  display_name,
  company_name,
  employer_type,
  logo_url,
  website_url,
  country_code,
  description,
  verification_status,
  verified_at,
  created_at,
  updated_at
) on public.employer_profiles to anon, authenticated;

grant select (
  id,
  slug,
  title,
  position,
  department,
  employment_type,
  employer_id,
  location,
  country_code,
  yacht_name,
  yacht_type,
  yacht_length_metres,
  yacht_program,
  rotation,
  start_date,
  end_date,
  summary,
  description,
  responsibilities,
  requirements,
  benefits,
  certifications,
  visas,
  languages,
  minimum_experience_years,
  application_instructions,
  salary_currency,
  salary_minimum,
  salary_maximum,
  salary_period,
  salary_visible,
  featured,
  openings_count,
  status,
  application_deadline,
  published_at,
  expires_at,
  closed_at,
  created_at,
  updated_at
) on public.job_posts to anon, authenticated;
grant select on public.job_applications to authenticated;
grant select, insert, delete on public.saved_jobs to authenticated;

create policy "Employer profiles public or owner read"
on public.employer_profiles
for select
to anon, authenticated
using (
  user_id = auth.uid()
  or verification_status = 'verified'
  or public.is_platform_jobs_admin()
);

create policy "Jobs public or employer read"
on public.job_posts
for select
to anon, authenticated
using (
  (
    status = 'published'
    and published_at <= now()
    and (expires_at is null or expires_at > now())
    and (application_deadline is null or application_deadline >= now())
    and exists (
      select 1
      from public.employer_profiles employer
      where employer.id = job_posts.employer_id
        and employer.verification_status = 'verified'
    )
  )
  or public.owns_employer_profile(employer_id)
  or public.is_platform_jobs_admin()
);

create policy "Applications applicant or employer read"
on public.job_applications
for select
to authenticated
using (
  applicant_user_id = auth.uid()
  or public.owns_verified_job_employer(job_id)
  or public.is_platform_jobs_admin()
);

create policy "Saved jobs owner read"
on public.saved_jobs
for select
to authenticated
using (user_id = auth.uid());

create policy "Saved jobs owner create"
on public.saved_jobs
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.owns_crew_profile(crew_profile_id)
  and public.is_public_job_open(job_id)
);

create policy "Saved jobs owner delete"
on public.saved_jobs
for delete
to authenticated
using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Storage: private documents, public portfolio reads, owner/yacht path writes.
-- ---------------------------------------------------------------------------

update storage.buckets
set
  public = false,
  file_size_limit = 25000000,
  allowed_mime_types = array[
    'application/msword',
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/avif',
    'image/bmp',
    'image/gif',
    'image/heic',
    'image/heif',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'image/webp'
  ]::text[]
where id in (
  'crew-documents',
  'documents',
  'yacht-documents'
);

update storage.buckets
set
  public = true,
  file_size_limit = 25000000,
  allowed_mime_types = array[
    'image/avif',
    'image/bmp',
    'image/gif',
    'image/heic',
    'image/heif',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'image/webp'
  ]::text[]
where id = 'crew-portfolio';

update storage.buckets
set
  public = false,
  file_size_limit = 25000000,
  allowed_mime_types = array[
    'image/avif',
    'image/bmp',
    'image/gif',
    'image/heic',
    'image/heif',
    'image/jpeg',
    'image/png',
    'image/tiff',
    'image/webp'
  ]::text[]
where id = 'task-photos';

-- Remove only known legacy BlueDeck policies that granted bucket-wide access.
-- Policies for unrelated storage buckets are deliberately preserved.
drop policy if exists "BlueDeck authenticated storage read" on storage.objects;
drop policy if exists "BlueDeck authenticated storage uploads" on storage.objects;
drop policy if exists "BlueDeck authenticated storage updates" on storage.objects;
drop policy if exists "BlueDeck authenticated storage delete" on storage.objects;
drop policy if exists "Authenticated crew document uploads" on storage.objects;
drop policy if exists "Authenticated crew document updates" on storage.objects;
drop policy if exists "Public crew media read" on storage.objects;

drop policy if exists "BlueDeck public crew portfolio read" on storage.objects;

drop policy if exists "BlueDeck crew media owner read" on storage.objects;
create policy "BlueDeck crew media owner read"
on storage.objects
for select
to authenticated
using (
  bucket_id in ('crew-documents', 'crew-portfolio')
  and public.owns_crew_storage_object(name)
);

drop policy if exists "BlueDeck crew media owner create" on storage.objects;
create policy "BlueDeck crew media owner create"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('crew-documents', 'crew-portfolio')
  and public.owns_crew_storage_object(name)
);

drop policy if exists "BlueDeck crew media owner update" on storage.objects;
create policy "BlueDeck crew media owner update"
on storage.objects
for update
to authenticated
using (
  bucket_id in ('crew-documents', 'crew-portfolio')
  and public.owns_crew_storage_object(name)
)
with check (
  bucket_id in ('crew-documents', 'crew-portfolio')
  and public.owns_crew_storage_object(name)
);

drop policy if exists "BlueDeck crew media owner delete" on storage.objects;
create policy "BlueDeck crew media owner delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('crew-documents', 'crew-portfolio')
  and public.owns_crew_storage_object(name)
);

drop policy if exists "BlueDeck yacht assets member read" on storage.objects;
drop policy if exists "BlueDeck task proof member read" on storage.objects;
create policy "BlueDeck task proof member read"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'task-photos'
  and public.can_read_task_photo(name)
);

drop policy if exists "BlueDeck yacht documents manager read" on storage.objects;
create policy "BlueDeck yacht documents manager read"
on storage.objects
for select
to authenticated
using (
  bucket_id in ('documents', 'yacht-documents')
  and public.can_manage_yacht(split_part(name, '/', 1))
);

drop policy if exists "BlueDeck yacht assets member create" on storage.objects;
drop policy if exists "BlueDeck task proof member create" on storage.objects;
create policy "BlueDeck task proof member create"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'task-photos'
  and public.can_upload_task_photo(name)
);

drop policy if exists "BlueDeck yacht documents manager create" on storage.objects;
create policy "BlueDeck yacht documents manager create"
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('documents', 'yacht-documents')
  and public.can_manage_yacht(split_part(name, '/', 1))
);

drop policy if exists "BlueDeck yacht assets member update" on storage.objects;
drop policy if exists "BlueDeck yacht assets manager update" on storage.objects;
create policy "BlueDeck yacht assets manager update"
on storage.objects
for update
to authenticated
using (
  bucket_id in ('documents', 'yacht-documents')
  and public.can_manage_yacht(split_part(name, '/', 1))
)
with check (
  bucket_id in ('documents', 'yacht-documents')
  and public.can_manage_yacht(split_part(name, '/', 1))
);

drop policy if exists "BlueDeck yacht assets manager delete" on storage.objects;
create policy "BlueDeck yacht assets manager delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('documents', 'yacht-documents')
  and public.can_access_yacht_storage_object(name)
  and public.can_manage_yacht(split_part(name, '/', 1))
);

commit;
