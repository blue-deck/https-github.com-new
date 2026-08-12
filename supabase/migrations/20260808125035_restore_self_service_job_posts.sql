-- Restore listings that were closed by the short-lived verified-employer
-- backfill, then left terminal when account-level self-service publishing was
-- reinstated. This is deliberately keyed to the exact backfill event rather
-- than a public listing number so a real publisher cancellation can never be
-- reopened by this repair.

begin;

set local timezone = 'UTC';

lock table public.job_posts in access exclusive mode;

create temporary table bluedeck_job_post_restore_targets (
  id uuid primary key,
  created_by uuid not null,
  original_published_at timestamptz not null,
  original_published_by uuid not null,
  original_closes_at timestamptz not null,
  closed_version integer not null,
  recovery_time timestamptz not null
) on commit drop;

insert into bluedeck_job_post_restore_targets (
  id,
  created_by,
  original_published_at,
  original_published_by,
  original_closes_at,
  closed_version,
  recovery_time
)
select
  post.id,
  post.created_by,
  post.published_at,
  post.published_by,
  post.closes_at,
  post.version,
  statement_timestamp()
from public.job_posts as post
where post.status = 'closed'
  and post.closure_reason = 'cancelled'
  and post.published_at is not null
  and post.published_by is not null
  and post.closes_at > statement_timestamp()
  and post.closed_at = timestamptz '2026-08-08 10:14:40.167629+00'
  and post.updated_at = post.closed_at
  and private.bluedeck_has_job_publisher_authority(post.created_by)
  and exists (
    select 1
    from supabase_migrations.schema_migrations as migration
    where migration.version = '20260808101440'
      and migration.name = 'verified_job_publishing'
  )
  and exists (
    select 1
    from supabase_migrations.schema_migrations as migration
    where migration.version = '20260808120201'
      and migration.name = 'enable_self_service_job_publishing'
  )
  and exists (
    select 1
    from public.job_post_events as event
    where event.job_post_id = post.id
      and event.actor_user_id = post.created_by
      and event.action = 'closed'
      and event.from_status = 'published'
      and event.to_status = 'closed'
      and event.version = post.version
      and event.created_at = post.closed_at
  )
  and not exists (
    select 1
    from public.job_post_events as later_event
    where later_event.job_post_id = post.id
      and later_event.version > post.version
  );

-- The normal lifecycle correctly keeps closed listings immutable. Disable
-- only that guard while performing one audited closed -> draft restoration;
-- the event trigger remains enabled and records the `reopened` transition.
alter table public.job_posts
  disable trigger job_posts_prepare_write;

update public.job_posts as post
set status = 'draft',
    published_at = null,
    published_by = null,
    closes_at = null,
    closed_at = null,
    closed_by = null,
    closure_reason = null,
    updated_by = target.created_by,
    updated_at = target.recovery_time,
    version = target.closed_version + 1
from bluedeck_job_post_restore_targets as target
where post.id = target.id
  and post.status = 'closed'
  and post.version = target.closed_version;

-- Restore the original publication window instead of moving the listing to
-- the top of the marketplace or granting an unintended extra month. The
-- event trigger records this valid draft -> published transition separately.
update public.job_posts as post
set status = 'published',
    published_at = target.original_published_at,
    published_by = target.original_published_by,
    closes_at = target.original_closes_at,
    closed_at = null,
    closed_by = null,
    closure_reason = null,
    updated_by = target.created_by,
    updated_at = target.recovery_time,
    version = target.closed_version + 2
from bluedeck_job_post_restore_targets as target
where post.id = target.id
  and post.status = 'draft'
  and post.version = target.closed_version + 1;

alter table public.job_posts
  enable trigger job_posts_prepare_write;

do $verification$
begin
  if exists (
    select 1
    from bluedeck_job_post_restore_targets as target
    left join public.job_posts as post on post.id = target.id
    where post.id is null
      or post.status is distinct from 'published'
      or post.published_at is distinct from target.original_published_at
      or post.closes_at is distinct from target.original_closes_at
      or post.closed_at is not null
      or post.closed_by is not null
      or post.closure_reason is not null
      or post.version is distinct from target.closed_version + 2
      or not exists (
        select 1
        from public.job_post_events as event
        where event.job_post_id = target.id
          and event.action = 'reopened'
          and event.from_status = 'closed'
          and event.to_status = 'draft'
          and event.version = target.closed_version + 1
      )
      or not exists (
        select 1
        from public.job_post_events as event
        where event.job_post_id = target.id
          and event.action = 'published'
          and event.from_status = 'draft'
          and event.to_status = 'published'
          and event.version = target.closed_version + 2
      )
  ) then
    raise exception 'Self-service job restoration did not complete atomically.';
  end if;
end;
$verification$;

commit;
