-- Separate recruitment listings from Captain Workspace yachts.
--
-- Job ownership is the immutable creator account. Legacy yacht references are
-- cleared and kept nullable only as a dormant compatibility slot; no runtime
-- function, API or lifecycle trigger uses them after this migration.

begin;

create schema if not exists private;

create or replace function private.bluedeck_has_job_publisher_authority(
  p_actor_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select
    p_actor_user_id is not null
    and exists (
      select 1
      from public.marketplace_entitlements as entitlement
      inner join auth.users as account
        on account.id = entitlement.user_id
      where entitlement.user_id = p_actor_user_id
        and entitlement.account_role in ('captain', 'owner', 'management')
        and entitlement.posting_status = 'enabled'
        and account.email_confirmed_at is not null
        and account.deleted_at is null
    );
$function$;

create or replace function public.bluedeck_can_publish_jobs(
  p_actor_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
  select private.bluedeck_has_job_publisher_authority(p_actor_user_id);
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
  select
    private.bluedeck_has_job_publisher_authority(p_actor_user_id)
    and exists (
      select 1
      from public.job_posts as post
      where post.id = p_job_post_id
        and post.created_by = p_actor_user_id
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
set search_path = pg_catalog, public, private
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
        and post.closes_at is not null
        and post.closes_at > statement_timestamp()
        and post.created_by <> p_actor_user_id
        and private.bluedeck_has_job_publisher_authority(post.created_by)
    );
$function$;

create or replace function public.prepare_job_post_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
set timezone = 'UTC'
as $function$
declare
  actor_id uuid;
  authority_revocation_close boolean := false;
  automatic_expiry_close boolean := false;
  write_time timestamptz := statement_timestamp();
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
  new.salary_visible := new.salary_min is not null or new.salary_max is not null;
  -- These legacy columns are intentionally inert. A future recruitment/yacht
  -- association must be introduced explicitly instead of reviving this link.
  new.yacht_id := null;
  new.show_yacht_name := false;

  if tg_op = 'INSERT' then
    if new.created_by is null or new.updated_by is distinct from new.created_by then
      raise exception using
        errcode = '23514',
        message = 'A job post requires one authenticated creator.';
    end if;
    actor_id := new.created_by;
  else
    if new.id is distinct from old.id
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
    then
      raise exception using
        errcode = '22023',
        message = 'Job post identity fields cannot be changed.';
    end if;
    if new.updated_by is null or new.updated_by is distinct from old.created_by then
      raise exception using
        errcode = '42501',
        message = 'Only the account that created this job post may update it.';
    end if;
    actor_id := new.updated_by;

    automatic_expiry_close := (
      coalesce(current_setting('bluedeck.job_post_expiry_run', true), '') = 'on'
      and old.status = 'published'
      and new.status = 'closed'
      and old.closes_at is not null
      and old.closes_at <= write_time
    );

    if old.status = 'closed' then
      raise exception using
        errcode = '23514',
        message = 'Closed job posts are immutable.';
    end if;

    if old.status = 'published'
      and old.closes_at is not null
      and old.closes_at <= write_time
      and new.status is not distinct from old.status
    then
      raise exception using
        errcode = '23514',
        message = 'Expired job posts cannot be edited.';
    end if;
  end if;

  if not private.bluedeck_has_job_publisher_authority(actor_id) then
    authority_revocation_close := (
      tg_op = 'UPDATE'
      and old.status in ('draft', 'published')
      and new.status = 'closed'
      and new.updated_by = old.created_by
      and new.title is not distinct from old.title
      and new.position is not distinct from old.position
      and new.department is not distinct from old.department
      and new.employment_type is not distinct from old.employment_type
      and new.candidate_type is not distinct from old.candidate_type
      and new.smoker_policy is not distinct from old.smoker_policy
      and new.visible_tattoo_policy is not distinct from old.visible_tattoo_policy
      and new.required_languages is not distinct from old.required_languages
      and new.required_skills is not distinct from old.required_skills
      and new.required_characteristics is not distinct from old.required_characteristics
      and new.required_certificates is not distinct from old.required_certificates
      and new.required_visas is not distinct from old.required_visas
      and new.yacht_brand is not distinct from old.yacht_brand
      and new.yacht_flag_country_code is not distinct from old.yacht_flag_country_code
      and new.yacht_build_year is not distinct from old.yacht_build_year
      and new.yacht_type is not distinct from old.yacht_type
      and new.yacht_length is not distinct from old.yacht_length
      and new.yacht_length_unit is not distinct from old.yacht_length_unit
      and new.crew_member_count is not distinct from old.crew_member_count
      and new.minimum_yacht_experience is not distinct from old.minimum_yacht_experience
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
      and new.closes_at is not distinct from old.closes_at
      and new.closure_reason is not distinct from old.closure_reason
    );

    if not authority_revocation_close then
      raise exception using
        errcode = '42501',
        message = 'Current account-level job publishing authority is required.';
    end if;
  end if;

  if tg_op = 'UPDATE'
    and new.status is distinct from old.status
    and not (
      (old.status = 'draft' and new.status in ('published', 'closed'))
      or (old.status = 'published' and new.status = 'closed')
    )
  then
    raise exception using
      errcode = '23514',
      message = format('Job post cannot move from %s to %s.', old.status, new.status);
  end if;

  if new.status = 'published'
    and (
      char_length(new.title) < 3
      or char_length(new.position) < 1
      or char_length(new.location) < 2
      or new.start_date is null
      or new.yacht_type is null
      or new.yacht_length is null
      or new.yacht_length_unit is null
      or not new.salary_visible
      or greatest(coalesce(new.salary_min, 0), coalesce(new.salary_max, 0)) <= 0
      or char_length(new.description) < 60
    )
  then
    raise exception using
      errcode = '23514',
      message = 'Published job posts require position, employment type, location, start date, salary, yacht type, yacht length and description.';
  end if;

  if tg_op = 'INSERT' then
    new.created_at := write_time;
    new.updated_at := write_time;
    new.version := 1;

    if new.status = 'published' then
      new.published_at := write_time;
      new.published_by := actor_id;
      new.closes_at := (
        (write_time at time zone 'UTC' + interval '1 month') at time zone 'UTC'
      );
      new.closed_at := null;
      new.closed_by := null;
      new.closure_reason := null;
    elsif new.status = 'draft' then
      new.published_at := null;
      new.published_by := null;
      new.closes_at := null;
      new.closed_at := null;
      new.closed_by := null;
      new.closure_reason := null;
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
    new.closes_at := old.closes_at;
    new.closed_at := old.closed_at;
    new.closed_by := old.closed_by;
    new.closure_reason := old.closure_reason;
  elsif new.status = 'published' then
    new.published_at := write_time;
    new.published_by := actor_id;
    new.closes_at := (
      (write_time at time zone 'UTC' + interval '1 month') at time zone 'UTC'
    );
    new.closed_at := null;
    new.closed_by := null;
    new.closure_reason := null;
  elsif new.status = 'closed' then
    new.published_at := old.published_at;
    new.published_by := old.published_by;
    new.closes_at := old.closes_at;
    new.closed_at := write_time;
    new.closed_by := actor_id;
    new.closure_reason := case
      when automatic_expiry_close then 'expired'
      else 'cancelled'
    end;
  end if;

  return new;
end;
$function$;

create or replace function public.close_job_posts_on_marketplace_entitlement_loss()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  affected_user_id uuid;
begin
  affected_user_id := case when tg_op = 'DELETE' then old.user_id else new.user_id end;

  if tg_op = 'DELETE'
    or not private.bluedeck_has_job_publisher_authority(affected_user_id)
  then
    update public.job_posts as post
    set status = 'closed',
        updated_by = post.created_by
    where post.created_by = affected_user_id
      and post.status in ('draft', 'published');
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

-- Yacht operational changes must never mutate recruitment listings.
drop trigger if exists yachts_00_close_job_posts_on_owner_change
  on public.yachts;
drop trigger if exists yacht_memberships_00_close_marketplace_jobs
  on public.yacht_crew_memberships;
drop trigger if exists crew_profiles_00_close_marketplace_jobs
  on public.crew_profiles;
drop trigger if exists employer_access_00_close_job_posts
  on public.employer_access;

drop function if exists public.close_job_posts_on_yacht_owner_change();
drop function if exists public.close_job_posts_on_marketplace_membership_loss();
drop function if exists public.close_job_posts_on_crew_profile_unlink();
drop function if exists public.close_job_posts_on_employer_revocation();

create or replace function public.prepare_job_application_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  write_time timestamptz := statement_timestamp();
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
      or current_job.closes_at is null
      or current_job.closes_at <= write_time
      or not private.bluedeck_has_job_publisher_authority(current_job.created_by)
    then
      raise exception using
        errcode = '42501',
        message = 'This job is not currently accepting applications.';
    end if;

    if current_job.created_by = new.applicant_user_id then
      raise exception using
        errcode = '42501',
        message = 'A publisher cannot apply to their own job post.';
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

    if account_email is null or resolved_role not in ('crew', 'captain') then
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
        message = 'Current job publisher authority is required.';
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
  new.withdrawn_at := case when new.status = 'withdrawn' then write_time else null end;
  new.updated_at := write_time;
  new.version := old.version + 1;
  return new;
end;
$function$;

-- Clear every historical Captain Workspace association and prevent new job
-- posts from requiring one. The application layer no longer accepts either
-- field, and all public/employer projections exclude them.
alter table public.job_posts
  drop constraint if exists job_posts_yacht_id_fkey,
  alter column yacht_id drop not null;

alter table public.job_posts disable trigger user;

update public.job_posts
set yacht_id = null,
    show_yacht_name = false,
    salary_visible = (salary_min is not null or salary_max is not null)
where yacht_id is not null
   or show_yacht_name is true
   or salary_visible is distinct from (
     salary_min is not null or salary_max is not null
   );

alter table public.job_posts enable trigger user;

alter table public.job_posts
  drop constraint if exists job_posts_captain_workspace_decoupled_check,
  add constraint job_posts_captain_workspace_decoupled_check
  check (yacht_id is null and show_yacht_name is false) not valid;

alter table public.job_posts
  validate constraint job_posts_captain_workspace_decoupled_check;

drop index if exists public.job_posts_yacht_updated_at_idx;

revoke all on function private.bluedeck_has_job_publisher_authority(uuid)
  from public, anon, authenticated, service_role;
revoke all on function public.bluedeck_can_publish_jobs(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.bluedeck_can_publish_jobs(uuid)
  to service_role;

revoke all on function public.bluedeck_can_manage_job(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.bluedeck_can_manage_job(uuid, uuid)
  to service_role;

revoke all on function public.bluedeck_can_apply_to_job(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.bluedeck_can_apply_to_job(uuid, uuid)
  to service_role;

comment on function private.bluedeck_has_job_publisher_authority(uuid) is
  'Account-level job publishing authority; deliberately independent from yachts and Captain Workspace memberships.';
comment on function public.bluedeck_can_manage_job(uuid, uuid) is
  'True only for the active publisher account that created the job post.';
comment on column public.job_posts.yacht_id is
  'Deprecated null-only compatibility field with no yacht foreign key. Recruitment listings cannot create or consume Captain Workspace links.';
comment on column public.job_posts.show_yacht_name is
  'Deprecated and permanently ignored by job APIs; public yacht identity is never exposed.';

commit;
