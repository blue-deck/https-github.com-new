-- Server-owned, calendar-month expiry for marketplace job posts.
--
-- `closed` remains the durable archival state: applications, public numbers,
-- and audit events are intentionally retained. `closure_reason` distinguishes
-- a publisher cancellation from an automatic expiry without adding a second
-- terminal status to the existing lifecycle.

begin;

set local timezone = 'UTC';

create extension if not exists pg_cron;

lock table public.job_posts in access exclusive mode;

alter table public.job_posts
  add column closure_reason text;

-- Normalize legacy data without manufacturing actor events or optimistic-lock
-- changes. Every previously published record receives the same system rule as
-- a new publication; legacy publisher-selected deadlines are discarded.
alter table public.job_posts
  disable trigger job_posts_prepare_write;
alter table public.job_posts
  disable trigger job_posts_log_event;

with normalized as materialized (
  select
    post.id,
    case
      when post.published_at is null then null
      else (
        (post.published_at at time zone 'UTC' + interval '1 month')
        at time zone 'UTC'
      )
    end as normalized_closes_at
  from public.job_posts as post
)
update public.job_posts as post
set closes_at = normalized.normalized_closes_at,
    closure_reason = case
      when post.status <> 'closed' then null
      when post.published_at is not null
        and post.closed_at is not null
        and normalized.normalized_closes_at is not null
        and post.closed_at >= normalized.normalized_closes_at
      then 'expired'
      else 'cancelled'
    end
from normalized
where normalized.id = post.id;

alter table public.job_posts
  drop constraint job_posts_closing_window_check;

alter table public.job_posts
  add constraint job_posts_closing_window_check
  check (
    (
      published_at is null
      and closes_at is null
    )
    or (
      published_at is not null
      and closes_at is not null
      and closes_at > published_at
      and closes_at = (
        (published_at at time zone 'UTC' + interval '1 month')
        at time zone 'UTC'
      )
    )
  ) not valid;

alter table public.job_posts
  add constraint job_posts_closure_reason_check
  check (
    (
      status = 'closed'
      and closure_reason in ('expired', 'cancelled')
    )
    or (
      status <> 'closed'
      and closure_reason is null
    )
  ) not valid;

alter table public.job_posts
  add constraint job_posts_expired_closure_check
  check (
    closure_reason is distinct from 'expired'
    or (
      published_at is not null
      and closes_at is not null
      and closed_at is not null
      and closed_at >= closes_at
    )
  ) not valid;

alter table public.job_posts
  validate constraint job_posts_closing_window_check;
alter table public.job_posts
  validate constraint job_posts_closure_reason_check;
alter table public.job_posts
  validate constraint job_posts_expired_closure_check;

-- The setting read below can only affect a transition that is already due.
-- It is set transaction-locally by the private, non-callable expiry function
-- so ordinary publisher closures are always persisted as `cancelled`.
create or replace function public.prepare_job_post_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
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

    automatic_expiry_close := (
      coalesce(
        current_setting('bluedeck.job_post_expiry_run', true),
        ''
      ) = 'on'
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
      and new.closure_reason is not distinct from old.closure_reason
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
      or (old.status = 'published' and new.status = 'closed')
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

  if new.status = 'published'
    and (
      char_length(new.title) < 3
      or char_length(new.location) < 2
      or char_length(new.summary) < 20
      or char_length(new.description) < 60
    )
  then
    raise exception using
      errcode = '23514',
      message = 'Published job posts require complete public details.';
  end if;

  if tg_op = 'INSERT' then
    new.created_at := write_time;
    new.updated_at := write_time;
    new.version := 1;

    if new.status = 'published' then
      new.published_at := write_time;
      new.published_by := actor_id;
      new.closes_at := (
        (write_time at time zone 'UTC' + interval '1 month')
        at time zone 'UTC'
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
      (write_time at time zone 'UTC' + interval '1 month')
      at time zone 'UTC'
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

-- Automatic transitions remain ordinary append-only `closed` events, but a
-- null actor makes it explicit that the scheduler, not the publisher, acted.
create or replace function public.log_job_post_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  event_action text;
  event_actor uuid;
begin
  if tg_op = 'INSERT' then
    event_action := case
      when new.status = 'published' then 'published'
      else 'created'
    end;
  elsif new.status is not distinct from old.status then
    event_action := 'updated';
  elsif old.status = 'published' and new.status = 'draft' then
    event_action := 'unpublished';
  elsif old.status = 'closed' and new.status = 'draft' then
    event_action := 'reopened';
  elsif new.status = 'published' then
    event_action := 'published';
  elsif new.status = 'closed' then
    event_action := 'closed';
  end if;

  event_actor := case
    when tg_op = 'UPDATE'
      and old.status = 'published'
      and new.status = 'closed'
      and new.closure_reason = 'expired'
    then null
    when tg_op = 'INSERT' then new.created_by
    else new.updated_by
  end;

  insert into public.job_post_events (
    job_post_id,
    actor_user_id,
    action,
    from_status,
    to_status,
    version,
    created_at
  )
  values (
    new.id,
    event_actor,
    event_action,
    case when tg_op = 'INSERT' then null else old.status end,
    new.status,
    new.version,
    new.updated_at
  );

  return new;
end;
$function$;

alter table public.job_posts
  enable trigger job_posts_prepare_write;
alter table public.job_posts
  enable trigger job_posts_log_event;

create index if not exists job_posts_published_expiry_idx
  on public.job_posts (closes_at)
  where status = 'published';

create or replace function private.bluedeck_expire_due_job_posts()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, private
set timezone = 'UTC'
as $function$
declare
  affected_count integer := 0;
begin
  perform set_config('bluedeck.job_post_expiry_run', 'on', true);

  update public.job_posts as post
  set status = 'closed',
      updated_by = post.created_by
  where post.status = 'published'
    and post.closes_at is not null
    and post.closes_at <= statement_timestamp();

  get diagnostics affected_count = row_count;
  perform set_config('bluedeck.job_post_expiry_run', 'off', true);

  return affected_count;
exception
  when others then
    perform set_config('bluedeck.job_post_expiry_run', 'off', true);
    raise;
end;
$function$;

revoke all on function private.bluedeck_expire_due_job_posts()
  from public, anon, authenticated, service_role;

-- Keep the write boundary fail-closed as a separate first-in-order trigger.
-- This is deliberately redundant with `prepare_job_application_write`: the
-- latter still performs role, yacht-authority and immutable-snapshot checks.
create or replace function private.bluedeck_guard_job_application_deadline()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  if not exists (
    select 1
    from public.job_posts as post
    where post.id = new.job_post_id
      and post.status = 'published'
      and post.closes_at is not null
      and post.closes_at > statement_timestamp()
  ) then
    raise exception using
      errcode = '42501',
      message = 'This job is not currently accepting applications.';
  end if;

  return new;
end;
$function$;

drop trigger if exists job_applications_00_deadline_guard
  on public.job_applications;
create trigger job_applications_00_deadline_guard
before insert on public.job_applications
for each row execute function private.bluedeck_guard_job_application_deadline();

revoke all on function private.bluedeck_guard_job_application_deadline()
  from public, anon, authenticated, service_role;

-- Fail closed at the database boundary even if a caller omits the public API's
-- equivalent timestamp filter. The application-write trigger has the same
-- protection and the published-state constraint guarantees non-null expiry.
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

revoke all on function public.bluedeck_can_apply_to_job(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.bluedeck_can_apply_to_job(uuid, uuid)
  to service_role;

-- Reconcile already-due published rows through the normal trigger path so
-- versioning and append-only audit history remain intact.
select private.bluedeck_expire_due_job_posts();

-- A stable name makes future schedule changes an in-place replacement for the
-- same database role. Public/apply timestamp guards enforce the exact cutoff;
-- this job durably archives due rows within five minutes.
select cron.schedule(
  'bluedeck-expire-job-posts',
  '*/5 * * * *',
  $cron$select private.bluedeck_expire_due_job_posts();$cron$
);

comment on column public.job_posts.closes_at is
  'Private system-managed expiry boundary. New publications receive one UTC calendar month and callers cannot change or reset it.';
comment on column public.job_posts.closure_reason is
  'Terminal reason retained with the archived post: expired or cancelled.';
comment on function private.bluedeck_expire_due_job_posts() is
  'Private idempotent scheduler target that archives due job posts without deleting applications or audit history.';

commit;
