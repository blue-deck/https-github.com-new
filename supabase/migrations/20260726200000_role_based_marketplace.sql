-- Self-service, role-based yacht jobs marketplace and mediated applications.
--
-- Account roles are durable database records. A protected base-profile role or
-- privileged app metadata is consulted only when the entitlement is first
-- created/backfilled; mutable user metadata is never an authority source.
-- Browser roles receive no direct access
-- to marketplace tables or privileged helpers.
--
-- Safe to re-run: tables/columns/indexes are conditional, functions are
-- replaced by name, triggers are recreated deterministically, and backfills do
-- not overwrite an existing (possibly billing-suspended) entitlement.

begin;

create extension if not exists "pgcrypto";
create schema if not exists private;

-- `plan_code` intentionally is not an enum: a future billing rollout can add
-- plans without rewriting every row. `posting_status` is the billing/admin
-- kill-switch; it does not prevent a captain from applying for another job.
create table if not exists public.marketplace_entitlements (
  user_id uuid primary key
    references auth.users(id) on delete cascade,
  account_role text not null,
  plan_code text not null default 'free',
  entitlement_source text not null default 'self_service',
  posting_status text not null default 'enabled',
  suspension_reason text not null default '',
  suspended_at timestamptz,
  suspended_by uuid
    references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_entitlements_account_role_check
    check (account_role in ('crew', 'captain', 'owner', 'management')),
  constraint marketplace_entitlements_plan_code_check
    check (plan_code ~ '^[a-z0-9][a-z0-9_-]{0,62}$'),
  constraint marketplace_entitlements_source_check
    check (
      entitlement_source in (
        'self_service',
        'legacy_verified',
        'admin',
        'billing'
      )
    ),
  constraint marketplace_entitlements_posting_status_check
    check (posting_status in ('enabled', 'suspended')),
  constraint marketplace_entitlements_suspension_reason_length_check
    check (char_length(suspension_reason) <= 500),
  constraint marketplace_entitlements_suspension_state_check
    check (
      (
        posting_status = 'enabled'
        and suspension_reason = ''
        and suspended_at is null
        and suspended_by is null
      )
      or (
        posting_status = 'suspended'
        and char_length(btrim(suspension_reason)) between 1 and 500
        and suspended_at is not null
      )
    ),
  constraint marketplace_entitlements_timestamp_order_check
    check (
      created_at <= updated_at
      and (suspended_at is null or created_at <= suspended_at)
    )
);

create index if not exists marketplace_entitlements_role_status_idx
  on public.marketplace_entitlements (account_role, posting_status);

-- Existing profile RLS lets an account edit its own display fields. Lock the
-- authorization-bearing role without reducing that useful profile access.
-- Trusted signup/service writes may set any canonical self-service role; a
-- browser-created fallback profile can start only as crew and can never promote
-- itself by changing profiles.role.
create or replace function public.guard_profile_account_role()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if auth.uid() is null or auth.role() = 'service_role' then
    return new;
  end if;

  if new.id is distinct from auth.uid() then
    raise exception using
      errcode = '42501',
      message = 'Accounts may write only their own base profile.';
  end if;

  if tg_op = 'INSERT' then
    if lower(btrim(coalesce(new.role, 'crew'))) <> 'crew' then
      raise exception using
        errcode = '42501',
        message = 'Only the trusted signup service may assign an account role.';
    end if;
    new.role := 'crew';
    return new;
  end if;

  if new.id is distinct from old.id
    or new.role is distinct from old.role
  then
    raise exception using
      errcode = '42501',
      message = 'Account roles cannot be changed from the browser.';
  end if;

  return new;
end;
$function$;

drop trigger if exists profiles_guard_account_role
  on public.profiles;
create trigger profiles_guard_account_role
before insert or update on public.profiles
for each row execute function public.guard_profile_account_role();

create or replace function public.prepare_marketplace_entitlement_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  write_time timestamptz := now();
begin
  new.account_role := lower(btrim(coalesce(new.account_role, '')));
  new.plan_code := lower(btrim(coalesce(new.plan_code, 'free')));
  new.entitlement_source := lower(
    btrim(coalesce(new.entitlement_source, 'self_service'))
  );
  new.posting_status := lower(btrim(coalesce(new.posting_status, 'enabled')));
  new.suspension_reason := btrim(coalesce(new.suspension_reason, ''));

  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id
      or new.created_at is distinct from old.created_at
    then
      raise exception using
        errcode = '22023',
        message = 'Marketplace entitlement identity fields cannot be changed.';
    end if;
    new.created_at := old.created_at;
  else
    new.created_at := coalesce(new.created_at, write_time);
  end if;

  if new.posting_status = 'enabled' then
    new.suspension_reason := '';
    new.suspended_at := null;
    new.suspended_by := null;
  elsif new.posting_status = 'suspended' then
    if new.suspension_reason = '' then
      raise exception using
        errcode = '23514',
        message = 'A posting suspension requires a reason.';
    end if;

    if tg_op = 'INSERT'
      or old.posting_status is distinct from 'suspended'
    then
      new.suspended_at := write_time;
    else
      new.suspended_at := old.suspended_at;
    end if;
  end if;

  new.updated_at := write_time;
  return new;
end;
$function$;

drop trigger if exists marketplace_entitlements_prepare_write
  on public.marketplace_entitlements;
create trigger marketplace_entitlements_prepare_write
before insert or update on public.marketplace_entitlements
for each row execute function public.prepare_marketplace_entitlement_write();

-- Canonical role resolution order:
--   1. existing durable marketplace entitlement;
--   2. an existing verified employer-access relationship (legacy safety);
--   3. the durable base profile written by the signup server route;
--   4. one-time privileged app-metadata fallback for older accounts;
--   5. crew.
create or replace function public.bluedeck_resolve_account_role(
  p_user_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
declare
  resolved_role text;
  account_metadata jsonb;
begin
  if p_user_id is null then
    return null;
  end if;

  select entitlement.account_role
  into resolved_role
  from public.marketplace_entitlements as entitlement
  where entitlement.user_id = p_user_id;

  if resolved_role in ('crew', 'captain', 'owner', 'management') then
    return resolved_role;
  end if;

  select lower(btrim(access.requested_role))
  into resolved_role
  from public.employer_access as access
  where access.user_id = p_user_id
    and access.status = 'verified'
    and access.can_post_jobs is true
    and lower(btrim(access.requested_role)) in (
      'captain',
      'owner',
      'management'
    )
  order by access.updated_at desc, access.id
  limit 1;

  if resolved_role in ('captain', 'owner', 'management') then
    return resolved_role;
  end if;

  select lower(btrim(profile.role))
  into resolved_role
  from public.profiles as profile
  where profile.id = p_user_id;

  if resolved_role in ('crew', 'captain', 'owner', 'management') then
    return resolved_role;
  end if;

  select coalesce(account.raw_app_meta_data, '{}'::jsonb)
  into account_metadata
  from auth.users as account
  where account.id = p_user_id;

  if not found then
    return null;
  end if;

  resolved_role := lower(btrim(coalesce(account_metadata ->> 'role', '')));
  if resolved_role in ('crew', 'captain', 'owner', 'management') then
    return resolved_role;
  end if;

  return 'crew';
end;
$function$;

create or replace function public.bluedeck_ensure_marketplace_entitlement(
  p_user_id uuid,
  p_requested_role text default null,
  p_entitlement_source text default 'self_service'
)
returns setof public.marketplace_entitlements
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  resolved_role text;
  resolved_source text := lower(
    btrim(coalesce(p_entitlement_source, 'self_service'))
  );
begin
  if p_user_id is null
    or not exists (select 1 from auth.users where id = p_user_id)
  then
    raise exception using
      errcode = '22023',
      message = 'A valid account is required.';
  end if;

  if p_requested_role is null then
    resolved_role := public.bluedeck_resolve_account_role(p_user_id);
  else
    resolved_role := lower(btrim(p_requested_role));
  end if;

  if resolved_role not in ('crew', 'captain', 'owner', 'management') then
    raise exception using
      errcode = '22023',
      message = 'Account role must be crew, captain, owner or management.';
  end if;

  if resolved_source not in (
    'self_service',
    'legacy_verified',
    'admin',
    'billing'
  ) then
    raise exception using
      errcode = '22023',
      message = 'Invalid marketplace entitlement source.';
  end if;

  insert into public.marketplace_entitlements (
    user_id,
    account_role,
    plan_code,
    entitlement_source,
    posting_status
  )
  values (
    p_user_id,
    resolved_role,
    'free',
    resolved_source,
    'enabled'
  )
  on conflict (user_id) do nothing;

  return query
  select entitlement.*
  from public.marketplace_entitlements as entitlement
  where entitlement.user_id = p_user_id;
end;
$function$;

create or replace function public.bluedeck_marketplace_capabilities(
  p_user_id uuid
)
returns table (
  account_role text,
  plan_code text,
  posting_status text,
  can_post_jobs boolean,
  can_apply_jobs boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select
    entitlement.account_role,
    entitlement.plan_code,
    entitlement.posting_status,
    (
      entitlement.account_role in ('captain', 'owner', 'management')
      and entitlement.posting_status = 'enabled'
    ) as can_post_jobs,
    entitlement.account_role in ('crew', 'captain') as can_apply_jobs
  from public.marketplace_entitlements as entitlement
  where entitlement.user_id = p_user_id;
$function$;

-- Yacht authority is deliberately stronger than the selected account role.
-- Every publisher must point to a real yacht and must either own it or have a
-- directly user-linked active membership with an exact, role-appropriate
-- onboard position. Owners must be the yacht.owner_id; an "Owner" membership
-- label is not an ownership grant. Email-only legacy memberships never grant
-- publishing.
create or replace function private.bluedeck_has_yacht_publisher_authority(
  p_actor_user_id uuid,
  p_yacht_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select
    p_actor_user_id is not null
    and p_yacht_id is not null
    and exists (
      select 1
      from public.marketplace_entitlements as entitlement
      inner join auth.users as account
        on account.id = entitlement.user_id
      where entitlement.user_id = p_actor_user_id
        and entitlement.account_role in ('captain', 'owner', 'management')
        and account.email_confirmed_at is not null
        and account.deleted_at is null
        and (
          exists (
            select 1
            from public.yachts as yacht
            where yacht.id = p_yacht_id
              and yacht.owner_id = p_actor_user_id
          )
          or exists (
            select 1
            from public.yacht_crew_memberships as membership
            inner join public.crew_profiles as crew_profile
              on crew_profile.id = membership.crew_profile_id
             and crew_profile.user_id = p_actor_user_id
            where membership.yacht_id = p_yacht_id
              and lower(btrim(coalesce(membership.status, ''))) = 'active'
              and (
                (
                  entitlement.account_role = 'captain'
                  and lower(btrim(coalesce(membership.position, ''))) in (
                    'master',
                    'captain',
                    'fleet captain',
                    'relief captain',
                    'staff captain',
                    'build captain'
                  )
                )
                or (
                  entitlement.account_role = 'management'
                  and lower(btrim(coalesce(membership.position, ''))) in (
                    'yacht manager',
                    'fleet manager',
                    'management company representative',
                    'designated person ashore',
                    'dpa'
                  )
                )
              )
          )
        )
    );
$function$;

create or replace function public.bluedeck_can_manage_yacht_marketplace(
  p_actor_user_id uuid,
  p_yacht_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
  select
    private.bluedeck_has_yacht_publisher_authority(
      p_actor_user_id,
      p_yacht_id
    )
    and exists (
      select 1
      from public.marketplace_entitlements as entitlement
      where entitlement.user_id = p_actor_user_id
        and entitlement.posting_status = 'enabled'
    );
$function$;

create or replace function public.bluedeck_can_manage_job(
  p_actor_user_id uuid,
  p_job_post_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
  select exists (
    select 1
    from public.job_posts as post
    where post.id = p_job_post_id
      and public.bluedeck_can_manage_yacht_marketplace(
        p_actor_user_id,
        post.yacht_id
      )
  );
$function$;

create or replace function public.bluedeck_can_apply_to_job(
  p_actor_user_id uuid,
  p_job_post_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select
    exists (
      select 1
      from public.marketplace_entitlements as entitlement
      inner join auth.users as account
        on account.id = entitlement.user_id
      where entitlement.user_id = p_actor_user_id
        and entitlement.account_role in ('crew', 'captain')
        and account.email_confirmed_at is not null
        and account.deleted_at is null
    )
    and exists (
      select 1
      from public.job_posts as post
      where post.id = p_job_post_id
        and post.status = 'published'
        and (post.closes_at is null or post.closes_at > now())
        and not private.bluedeck_has_yacht_publisher_authority(
          p_actor_user_id,
          post.yacht_id
        )
        and public.bluedeck_can_manage_yacht_marketplace(
          post.created_by,
          post.yacht_id
        )
    );
$function$;

-- Preserve the existing start date field and make the migration safe on a
-- partially bootstrapped environment.
alter table public.job_posts
  add column if not exists start_date date;

-- Replace the legacy admin-verification gate with durable self-service role,
-- posting entitlement, and real yacht authority checks. All other job-post
-- validation and lifecycle behavior remains unchanged.
create or replace function public.prepare_job_post_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  actor_id uuid;
  authority_revocation_close boolean := false;
  write_time timestamptz := now();
begin
  new.title := btrim(coalesce(new.title, ''));
  new.position := btrim(coalesce(new.position, ''));
  new.department := btrim(coalesce(new.department, ''));
  new.employment_type := lower(btrim(coalesce(new.employment_type, '')));
  new.location := btrim(coalesce(new.location, ''));
  new.summary := btrim(coalesce(new.summary, ''));
  new.description := btrim(coalesce(new.description, ''));
  new.responsibilities := coalesce(new.responsibilities, array[]::text[]);
  new.requirements := coalesce(new.requirements, array[]::text[]);
  new.benefits := coalesce(new.benefits, array[]::text[]);
  new.salary_currency := upper(btrim(coalesce(new.salary_currency, 'EUR')));
  new.salary_period := lower(btrim(coalesce(new.salary_period, 'month')));

  if tg_op = 'INSERT' then
    if new.created_by is null or new.updated_by is distinct from new.created_by then
      raise exception using
        errcode = '23514',
        message = 'A job post requires one authenticated creator.';
    end if;
    actor_id := new.created_by;
  else
    if new.id is distinct from old.id
      or new.yacht_id is distinct from old.yacht_id
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
    then
      raise exception using
        errcode = '22023',
        message = 'Job post identity fields cannot be changed.';
    end if;
    if new.updated_by is null then
      raise exception using
        errcode = '23502',
        message = 'A job post update requires an authenticated actor.';
    end if;
    actor_id := new.updated_by;
  end if;

  if not public.bluedeck_can_manage_yacht_marketplace(
    actor_id,
    new.yacht_id
  ) then
    authority_revocation_close := (
      tg_op = 'UPDATE'
      and old.status in ('draft', 'published')
      and new.status = 'closed'
      and new.updated_by = old.created_by
      and new.title is not distinct from old.title
      and new.position is not distinct from old.position
      and new.department is not distinct from old.department
      and new.employment_type is not distinct from old.employment_type
      and new.location is not distinct from old.location
      and new.start_date is not distinct from old.start_date
      and new.summary is not distinct from old.summary
      and new.description is not distinct from old.description
      and new.responsibilities is not distinct from old.responsibilities
      and new.requirements is not distinct from old.requirements
      and new.benefits is not distinct from old.benefits
      and new.salary_visible is not distinct from old.salary_visible
      and new.salary_min is not distinct from old.salary_min
      and new.salary_max is not distinct from old.salary_max
      and new.salary_currency is not distinct from old.salary_currency
      and new.salary_period is not distinct from old.salary_period
      and new.show_yacht_name is not distinct from old.show_yacht_name
      and new.closes_at is not distinct from old.closes_at
    );

    if not authority_revocation_close then
      raise exception using
        errcode = '42501',
        message = 'Current marketplace publishing authority is required for this yacht.';
    end if;
  end if;

  if tg_op = 'UPDATE'
    and new.status is distinct from old.status
    and not (
      (old.status = 'draft' and new.status in ('published', 'closed'))
      or (old.status = 'published' and new.status in ('draft', 'closed'))
      or (old.status = 'closed' and new.status = 'draft')
    )
  then
    raise exception using
      errcode = '23514',
      message = format(
        'Job post cannot move from %s to %s.',
        old.status,
        new.status
      );
  end if;

  if new.status = 'published' then
    if char_length(new.title) < 3
      or char_length(new.location) < 2
      or char_length(new.summary) < 20
      or char_length(new.description) < 60
    then
      raise exception using
        errcode = '23514',
        message = 'Published job posts require complete public details.';
    end if;

    if new.closes_at is not null and new.closes_at <= write_time then
      raise exception using
        errcode = '23514',
        message = 'Published job posts require a future closing time.';
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.created_at := write_time;
    new.updated_at := write_time;
    new.version := 1;

    if new.status = 'published' then
      new.published_at := write_time;
      new.published_by := actor_id;
      new.closed_at := null;
      new.closed_by := null;
    elsif new.status = 'draft' then
      new.published_at := null;
      new.published_by := null;
      new.closed_at := null;
      new.closed_by := null;
    else
      raise exception using
        errcode = '23514',
        message = 'New job posts must start as draft or published.';
    end if;

    return new;
  end if;

  new.created_at := old.created_at;
  new.updated_at := write_time;
  new.version := old.version + 1;

  if new.status is not distinct from old.status then
    new.published_at := old.published_at;
    new.published_by := old.published_by;
    new.closed_at := old.closed_at;
    new.closed_by := old.closed_by;
  elsif new.status = 'published' then
    new.published_at := write_time;
    new.published_by := actor_id;
    new.closed_at := null;
    new.closed_by := null;
  elsif new.status = 'draft' then
    new.published_at := null;
    new.published_by := null;
    new.closed_at := null;
    new.closed_by := null;
  elsif new.status = 'closed' then
    new.published_at := old.published_at;
    new.published_by := old.published_by;
    new.closed_at := write_time;
    new.closed_by := actor_id;
  end if;

  return new;
end;
$function$;

-- Close current posts whenever durable posting entitlement or the active
-- membership that supplied authority is lost. Ownership loss remains covered
-- by the existing `yachts_00_close_job_posts_on_owner_change` trigger.
create or replace function public.close_job_posts_on_marketplace_entitlement_loss()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if tg_op = 'DELETE' then
    update public.job_posts as post
    set status = 'closed',
        updated_by = post.created_by
    where post.created_by = old.user_id
      and post.status in ('draft', 'published');

    return old;
  end if;

  -- Re-evaluate every current post even when both old/new roles can normally
  -- publish: management -> captain can invalidate a Yacht Manager membership.
  update public.job_posts as post
  set status = 'closed',
      updated_by = post.created_by
  where post.created_by = old.user_id
    and post.status in ('draft', 'published')
    and not public.bluedeck_can_manage_yacht_marketplace(
      new.user_id,
      post.yacht_id
    );

  return new;
end;
$function$;

-- Employer-access review remains available as legacy history, but it no longer
-- controls posting. Self-service role + entitlement + yacht authority are the
-- sole marketplace gate from this migration onward.
drop trigger if exists employer_access_00_close_job_posts
  on public.employer_access;

drop trigger if exists marketplace_entitlements_00_close_job_posts
  on public.marketplace_entitlements;
create trigger marketplace_entitlements_00_close_job_posts
after update of account_role, posting_status or delete
on public.marketplace_entitlements
for each row execute function public.close_job_posts_on_marketplace_entitlement_loss();

create or replace function public.close_job_posts_on_marketplace_membership_loss()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  previous_actor uuid;
begin
  select crew_profile.user_id
  into previous_actor
  from public.crew_profiles as crew_profile
  where crew_profile.id = old.crew_profile_id;

  if previous_actor is not null then
    update public.job_posts as post
    set status = 'closed',
        updated_by = post.created_by
    where post.created_by = previous_actor
      and post.yacht_id = old.yacht_id
      and post.status in ('draft', 'published')
      and not public.bluedeck_can_manage_yacht_marketplace(
        previous_actor,
        old.yacht_id
      );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

drop trigger if exists yacht_memberships_00_close_marketplace_jobs
  on public.yacht_crew_memberships;
create trigger yacht_memberships_00_close_marketplace_jobs
after update of yacht_id, crew_profile_id, position, status
  or delete
on public.yacht_crew_memberships
for each row execute function public.close_job_posts_on_marketplace_membership_loss();

create or replace function public.close_job_posts_on_crew_profile_unlink()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if old.user_id is not null then
    update public.job_posts as post
    set status = 'closed',
        updated_by = post.created_by
    where post.created_by = old.user_id
      and post.status in ('draft', 'published')
      and not public.bluedeck_can_manage_yacht_marketplace(
        old.user_id,
        post.yacht_id
      );
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

drop trigger if exists crew_profiles_00_close_marketplace_jobs
  on public.crew_profiles;
create trigger crew_profiles_00_close_marketplace_jobs
after update of user_id or delete
on public.crew_profiles
for each row execute function public.close_job_posts_on_crew_profile_unlink();

-- One account may apply only once to a job. Personal fields are immutable
-- server-side snapshots so employers can review the submission even if the
-- applicant later edits their public profile.
create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_post_id uuid not null
    references public.job_posts(id) on delete restrict,
  applicant_user_id uuid not null
    references auth.users(id) on delete restrict,
  crew_profile_id uuid
    references public.crew_profiles(id) on delete restrict,
  applicant_role text not null,
  applicant_name_snapshot text not null,
  applicant_email_snapshot text not null,
  applicant_position_snapshot text not null default '',
  cover_note text not null default '',
  status text not null default 'submitted',
  submitted_at timestamptz not null default now(),
  status_changed_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid not null
    references auth.users(id) on delete restrict,
  version integer not null default 1,
  constraint job_applications_applicant_role_check
    check (applicant_role in ('crew', 'captain')),
  constraint job_applications_name_length_check
    check (char_length(applicant_name_snapshot) between 1 and 120),
  constraint job_applications_email_length_check
    check (char_length(applicant_email_snapshot) between 3 and 320),
  constraint job_applications_position_length_check
    check (char_length(applicant_position_snapshot) <= 120),
  constraint job_applications_cover_note_length_check
    check (char_length(cover_note) <= 2000),
  constraint job_applications_status_check
    check (
      status in (
        'submitted',
        'reviewing',
        'shortlisted',
        'rejected',
        'withdrawn',
        'hired'
      )
    ),
  constraint job_applications_withdrawn_state_check
    check (
      (status = 'withdrawn' and withdrawn_at is not null)
      or (status <> 'withdrawn' and withdrawn_at is null)
    ),
  constraint job_applications_version_check
    check (version > 0),
  constraint job_applications_timestamp_order_check
    check (
      created_at <= updated_at
      and created_at <= submitted_at
      and submitted_at <= status_changed_at
      and status_changed_at <= updated_at
      and (withdrawn_at is null or submitted_at <= withdrawn_at)
    )
);

create unique index if not exists job_applications_job_applicant_uidx
  on public.job_applications (job_post_id, applicant_user_id);

create index if not exists job_applications_applicant_updated_idx
  on public.job_applications (applicant_user_id, updated_at desc);

create index if not exists job_applications_job_status_updated_idx
  on public.job_applications (job_post_id, status, updated_at desc);

create table if not exists public.job_application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null
    references public.job_applications(id) on delete restrict,
  actor_user_id uuid
    references auth.users(id) on delete set null,
  action text not null,
  from_status text,
  to_status text not null,
  version integer not null,
  created_at timestamptz not null default now(),
  constraint job_application_events_action_check
    check (
      action in (
        'submitted',
        'reviewing',
        'shortlisted',
        'rejected',
        'withdrawn',
        'hired'
      )
    ),
  constraint job_application_events_from_status_check
    check (
      from_status is null
      or from_status in (
        'submitted',
        'reviewing',
        'shortlisted',
        'rejected',
        'withdrawn',
        'hired'
      )
    ),
  constraint job_application_events_to_status_check
    check (
      to_status in (
        'submitted',
        'reviewing',
        'shortlisted',
        'rejected',
        'withdrawn',
        'hired'
      )
    ),
  constraint job_application_events_version_check
    check (version > 0),
  constraint job_application_events_transition_check
    check (
      (
        action = 'submitted'
        and from_status is null
        and to_status = 'submitted'
      )
      or (
        action <> 'submitted'
        and from_status is not null
        and action = to_status
        and from_status <> to_status
      )
    )
);

create index if not exists job_application_events_application_created_idx
  on public.job_application_events (application_id, created_at desc);

create index if not exists job_application_events_actor_created_idx
  on public.job_application_events (actor_user_id, created_at desc)
  where actor_user_id is not null;

create or replace function public.prepare_job_application_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  write_time timestamptz := now();
  account_email text;
  account_name text;
  resolved_role text;
  resolved_crew_profile_id uuid;
  resolved_position text;
  current_job public.job_posts%rowtype;
  actor_is_applicant boolean;
  actor_is_publisher boolean;
begin
  if tg_op = 'INSERT' then
    if new.applicant_user_id is null
      or new.updated_by is distinct from new.applicant_user_id
    then
      raise exception using
        errcode = '23514',
        message = 'A job application requires one authenticated applicant.';
    end if;

    select post.*
    into current_job
    from public.job_posts as post
    where post.id = new.job_post_id
    for share;

    if current_job.id is null
      or current_job.status <> 'published'
      or (
        current_job.closes_at is not null
        and current_job.closes_at <= write_time
      )
      or not public.bluedeck_can_manage_yacht_marketplace(
        current_job.created_by,
        current_job.yacht_id
      )
    then
      raise exception using
        errcode = '42501',
        message = 'This job is not currently accepting applications.';
    end if;

    if private.bluedeck_has_yacht_publisher_authority(
      new.applicant_user_id,
      current_job.yacht_id
    ) then
      raise exception using
        errcode = '42501',
        message = 'A yacht publisher cannot apply to a job they manage.';
    end if;

    select
      lower(btrim(account.email)),
      coalesce(
        nullif(btrim(profile.full_name), ''),
        nullif(btrim(crew_profile.full_name), ''),
        nullif(btrim(account.raw_user_meta_data ->> 'full_name'), ''),
        split_part(lower(btrim(account.email)), '@', 1)
      ),
      entitlement.account_role,
      crew_profile.id,
      coalesce(
        nullif(btrim(crew_profile.current_position), ''),
        nullif(btrim(crew_profile.position), ''),
        nullif(btrim(account.raw_user_meta_data ->> 'position'), ''),
        ''
      )
    into
      account_email,
      account_name,
      resolved_role,
      resolved_crew_profile_id,
      resolved_position
    from auth.users as account
    inner join public.marketplace_entitlements as entitlement
      on entitlement.user_id = account.id
    left join public.profiles as profile
      on profile.id = account.id
    left join lateral (
      select candidate.*
      from public.crew_profiles as candidate
      where candidate.user_id = account.id
      order by candidate.created_at, candidate.id
      limit 1
    ) as crew_profile on true
    where account.id = new.applicant_user_id
      and account.email_confirmed_at is not null
      and account.deleted_at is null;

    if account_email is null
      or resolved_role not in ('crew', 'captain')
    then
      raise exception using
        errcode = '42501',
        message = 'Only confirmed crew and captain accounts may apply.';
    end if;

    new.crew_profile_id := resolved_crew_profile_id;
    new.applicant_role := resolved_role;
    new.applicant_name_snapshot := left(account_name, 120);
    new.applicant_email_snapshot := left(account_email, 320);
    new.applicant_position_snapshot := left(resolved_position, 120);
    new.cover_note := btrim(coalesce(new.cover_note, ''));
    new.status := 'submitted';
    new.submitted_at := write_time;
    new.status_changed_at := write_time;
    new.withdrawn_at := null;
    new.created_at := write_time;
    new.updated_at := write_time;
    new.updated_by := new.applicant_user_id;
    new.version := 1;
    return new;
  end if;

  if new.id is distinct from old.id
    or new.job_post_id is distinct from old.job_post_id
    or new.applicant_user_id is distinct from old.applicant_user_id
    or new.crew_profile_id is distinct from old.crew_profile_id
    or new.applicant_role is distinct from old.applicant_role
    or new.applicant_name_snapshot is distinct from old.applicant_name_snapshot
    or new.applicant_email_snapshot is distinct from old.applicant_email_snapshot
    or new.applicant_position_snapshot is distinct from old.applicant_position_snapshot
    or new.cover_note is distinct from old.cover_note
    or new.submitted_at is distinct from old.submitted_at
    or new.created_at is distinct from old.created_at
  then
    raise exception using
      errcode = '22023',
      message = 'Submitted application identity and snapshot fields are immutable.';
  end if;

  if new.updated_by is null then
    raise exception using
      errcode = '23502',
      message = 'An application update requires an authenticated actor.';
  end if;

  if new.status is not distinct from old.status then
    raise exception using
      errcode = '22023',
      message = 'An application update requires a new lifecycle status.';
  end if;

  if old.status in ('rejected', 'withdrawn', 'hired') then
    raise exception using
      errcode = '23514',
      message = format('Application status %s is terminal.', old.status);
  end if;

  actor_is_applicant := new.updated_by = old.applicant_user_id;
  actor_is_publisher := public.bluedeck_can_manage_job(
    new.updated_by,
    old.job_post_id
  );

  if new.status = 'withdrawn' then
    if not actor_is_applicant
      or old.status not in ('submitted', 'reviewing', 'shortlisted')
    then
      raise exception using
        errcode = '42501',
        message = 'Only the applicant may withdraw an active application.';
    end if;
  elsif new.status in ('reviewing', 'shortlisted', 'rejected', 'hired') then
    if not actor_is_publisher then
      raise exception using
        errcode = '42501',
        message = 'Current yacht publisher authority is required.';
    end if;
  else
    raise exception using
      errcode = '23514',
      message = format('Application cannot move from %s to %s.', old.status, new.status);
  end if;

  if not (
    (old.status = 'submitted' and new.status in (
      'reviewing', 'shortlisted', 'rejected', 'withdrawn', 'hired'
    ))
    or (old.status = 'reviewing' and new.status in (
      'shortlisted', 'rejected', 'withdrawn', 'hired'
    ))
    or (old.status = 'shortlisted' and new.status in (
      'reviewing', 'rejected', 'withdrawn', 'hired'
    ))
  ) then
    raise exception using
      errcode = '23514',
      message = format('Application cannot move from %s to %s.', old.status, new.status);
  end if;

  new.created_at := old.created_at;
  new.submitted_at := old.submitted_at;
  new.status_changed_at := write_time;
  new.withdrawn_at := case
    when new.status = 'withdrawn' then write_time
    else null
  end;
  new.updated_at := write_time;
  new.version := old.version + 1;
  return new;
end;
$function$;

create or replace function public.log_job_application_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  insert into public.job_application_events (
    application_id,
    actor_user_id,
    action,
    from_status,
    to_status,
    version,
    created_at
  )
  values (
    new.id,
    new.updated_by,
    new.status,
    case when tg_op = 'INSERT' then null else old.status end,
    new.status,
    new.version,
    new.updated_at
  );

  return new;
end;
$function$;

drop trigger if exists job_applications_prepare_write
  on public.job_applications;
create trigger job_applications_prepare_write
before insert or update on public.job_applications
for each row execute function public.prepare_job_application_write();

drop trigger if exists job_applications_log_event
  on public.job_applications;
create trigger job_applications_log_event
after insert or update on public.job_applications
for each row execute function public.log_job_application_event();

create or replace function public.bluedeck_submit_job_application(
  p_job_post_id uuid,
  p_applicant_user_id uuid,
  p_cover_note text default ''
)
returns setof public.job_applications
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  return query
  insert into public.job_applications (
    job_post_id,
    applicant_user_id,
    applicant_role,
    applicant_name_snapshot,
    applicant_email_snapshot,
    applicant_position_snapshot,
    cover_note,
    status,
    updated_by
  )
  values (
    p_job_post_id,
    p_applicant_user_id,
    'crew',
    'Pending snapshot',
    'pending@invalid.local',
    '',
    p_cover_note,
    'submitted',
    p_applicant_user_id
  )
  returning *;
end;
$function$;

create or replace function public.bluedeck_withdraw_job_application(
  p_application_id uuid,
  p_applicant_user_id uuid,
  p_expected_version integer
)
returns setof public.job_applications
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  affected_rows integer;
begin
  if p_expected_version is null or p_expected_version <= 0 then
    raise exception using
      errcode = '22023',
      message = 'A positive expected application version is required.';
  end if;

  return query
  update public.job_applications as application
  set status = 'withdrawn',
      updated_by = p_applicant_user_id
  where application.id = p_application_id
    and application.applicant_user_id = p_applicant_user_id
    and application.version = p_expected_version
  returning application.*;

  get diagnostics affected_rows = row_count;
  if affected_rows = 0 then
    if exists (
      select 1
      from public.job_applications as application
      where application.id = p_application_id
        and application.applicant_user_id = p_applicant_user_id
    ) then
      raise exception using
        errcode = '40001',
        message = 'Job application version conflict.';
    end if;

    raise exception using
      errcode = '42501',
      message = 'The application is unavailable to this applicant.';
  end if;
end;
$function$;

create or replace function public.bluedeck_update_job_application_status(
  p_application_id uuid,
  p_publisher_user_id uuid,
  p_status text,
  p_expected_version integer
)
returns setof public.job_applications
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  resolved_status text := lower(btrim(coalesce(p_status, '')));
  affected_rows integer;
begin
  if resolved_status not in ('reviewing', 'shortlisted', 'rejected', 'hired') then
    raise exception using
      errcode = '22023',
      message = 'Publishers may set reviewing, shortlisted, rejected or hired.';
  end if;

  if p_expected_version is null or p_expected_version <= 0 then
    raise exception using
      errcode = '22023',
      message = 'A positive expected application version is required.';
  end if;

  return query
  update public.job_applications as application
  set status = resolved_status,
      updated_by = p_publisher_user_id
  where application.id = p_application_id
    and application.version = p_expected_version
    and public.bluedeck_can_manage_job(
      p_publisher_user_id,
      application.job_post_id
    )
  returning application.*;

  get diagnostics affected_rows = row_count;
  if affected_rows = 0 then
    if exists (
      select 1
      from public.job_applications as application
      where application.id = p_application_id
        and public.bluedeck_can_manage_job(
          p_publisher_user_id,
          application.job_post_id
        )
    ) then
      raise exception using
        errcode = '40001',
        message = 'Job application version conflict.';
    end if;

    raise exception using
      errcode = '42501',
      message = 'Current yacht publisher authority is required.';
  end if;
end;
$function$;

create or replace function public.bluedeck_list_job_applications(
  p_actor_user_id uuid,
  p_job_post_id uuid default null
)
returns setof public.job_applications
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $function$
begin
  if p_job_post_id is not null
    and not public.bluedeck_can_manage_job(
      p_actor_user_id,
      p_job_post_id
    )
    and not exists (
      select 1
      from public.job_applications as application
      where application.job_post_id = p_job_post_id
        and application.applicant_user_id = p_actor_user_id
    )
  then
    raise exception using
      errcode = '42501',
      message = 'Job applications are unavailable to this account.';
  end if;

  return query
  select application.*
  from public.job_applications as application
  where (
      p_job_post_id is null
      or application.job_post_id = p_job_post_id
    )
    and (
      application.applicant_user_id = p_actor_user_id
      or public.bluedeck_can_manage_job(
        p_actor_user_id,
        application.job_post_id
      )
    )
  order by application.updated_at desc, application.id;
end;
$function$;

-- Backfill every existing account once. Verified legacy employers win over a
-- stale `crew` profile so the current verified owner retains publishing.
insert into public.marketplace_entitlements (
  user_id,
  account_role,
  plan_code,
  entitlement_source,
  posting_status
)
select
  account.id,
  coalesce(
    legacy_access.requested_role,
    case
      when lower(btrim(coalesce(profile.role, ''))) in (
        'crew', 'captain', 'owner', 'management'
      ) then lower(btrim(profile.role))
      when lower(btrim(coalesce(account.raw_app_meta_data ->> 'role', ''))) in (
        'crew', 'captain', 'owner', 'management'
      ) then lower(btrim(account.raw_app_meta_data ->> 'role'))
      else 'crew'
    end
  ),
  'free',
  case
    when legacy_access.requested_role is not null then 'legacy_verified'
    else 'self_service'
  end,
  'enabled'
from auth.users as account
left join public.profiles as profile
  on profile.id = account.id
left join lateral (
  select lower(btrim(access.requested_role)) as requested_role
  from public.employer_access as access
  where access.user_id = account.id
    and access.status = 'verified'
    and access.can_post_jobs is true
    and lower(btrim(access.requested_role)) in (
      'captain', 'owner', 'management'
    )
  order by access.updated_at desc, access.id
  limit 1
) as legacy_access on true
where account.deleted_at is null
on conflict (user_id) do nothing;

-- A legacy active post remains active only when its creator has current
-- self-service entitlement and real yacht authority after the backfill.
update public.job_posts as post
set status = 'closed',
    updated_by = post.created_by
where post.status in ('draft', 'published')
  and not public.bluedeck_can_manage_yacht_marketplace(
    post.created_by,
    post.yacht_id
  );

alter table public.marketplace_entitlements enable row level security;
alter table public.job_applications enable row level security;
alter table public.job_application_events enable row level security;

-- APIs authenticate the end user, pass the immutable user UUID to these
-- service-only functions, and return an explicit allowlist. No authenticated
-- client can insert a captain entitlement, read another application, or mutate
-- lifecycle state directly.
revoke all on table public.marketplace_entitlements
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.marketplace_entitlements
  to service_role;

revoke all on table public.job_applications
  from public, anon, authenticated, service_role;
grant select on table public.job_applications to service_role;

revoke all on table public.job_application_events
  from public, anon, authenticated, service_role;
grant select on table public.job_application_events to service_role;

revoke all on function public.prepare_marketplace_entitlement_write()
  from public, anon, authenticated, service_role;
revoke all on function public.guard_profile_account_role()
  from public, anon, authenticated, service_role;
revoke all on function public.prepare_job_application_write()
  from public, anon, authenticated, service_role;
revoke all on function public.log_job_application_event()
  from public, anon, authenticated, service_role;
revoke all on function public.close_job_posts_on_marketplace_entitlement_loss()
  from public, anon, authenticated, service_role;
revoke all on function public.close_job_posts_on_marketplace_membership_loss()
  from public, anon, authenticated, service_role;
revoke all on function public.close_job_posts_on_crew_profile_unlink()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_has_yacht_publisher_authority(uuid, uuid)
  from public, anon, authenticated, service_role;

revoke all on function public.bluedeck_resolve_account_role(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.bluedeck_resolve_account_role(uuid)
  to service_role;

revoke all on function public.bluedeck_ensure_marketplace_entitlement(uuid, text, text)
  from public, anon, authenticated, service_role;
grant execute on function public.bluedeck_ensure_marketplace_entitlement(uuid, text, text)
  to service_role;

revoke all on function public.bluedeck_marketplace_capabilities(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.bluedeck_marketplace_capabilities(uuid)
  to service_role;

revoke all on function public.bluedeck_can_manage_yacht_marketplace(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.bluedeck_can_manage_yacht_marketplace(uuid, uuid)
  to service_role;

revoke all on function public.bluedeck_can_manage_job(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.bluedeck_can_manage_job(uuid, uuid)
  to service_role;

revoke all on function public.bluedeck_can_apply_to_job(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.bluedeck_can_apply_to_job(uuid, uuid)
  to service_role;

revoke all on function public.bluedeck_submit_job_application(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.bluedeck_submit_job_application(uuid, uuid, text)
  to service_role;

revoke all on function public.bluedeck_withdraw_job_application(uuid, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.bluedeck_withdraw_job_application(uuid, uuid, integer)
  to service_role;

revoke all on function public.bluedeck_update_job_application_status(uuid, uuid, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.bluedeck_update_job_application_status(uuid, uuid, text, integer)
  to service_role;

revoke all on function public.bluedeck_list_job_applications(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.bluedeck_list_job_applications(uuid, uuid)
  to service_role;

comment on table public.marketplace_entitlements is
  'Durable account role and future-billing posting entitlement for the jobs marketplace.';
comment on column public.marketplace_entitlements.account_role is
  'Canonical signup role: crew, captain, owner or management.';
comment on column public.marketplace_entitlements.plan_code is
  'Extensible billing plan identifier; free until paid plans are introduced.';
comment on column public.marketplace_entitlements.posting_status is
  'Independent posting kill-switch used by future billing or platform enforcement.';
comment on table public.job_applications is
  'Private service-mediated applications with immutable applicant snapshots and optimistic versioning.';
comment on table public.job_application_events is
  'Append-only application lifecycle audit written only by the database trigger.';
comment on column public.job_posts.start_date is
  'Optional advertised employment commencement date.';

commit;
