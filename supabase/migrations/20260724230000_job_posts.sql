-- Server-managed yacht job posts with verified-employer enforcement.
-- Safe to re-run: objects are created conditionally or replaced by name.

begin;

create extension if not exists "pgcrypto";

create table if not exists public.job_posts (
  id uuid primary key default gen_random_uuid(),
  yacht_id uuid not null
    references public.yachts(id) on delete cascade,
  created_by uuid not null
    references auth.users(id) on delete restrict,
  updated_by uuid not null
    references auth.users(id) on delete restrict,
  title text not null default '',
  position text not null,
  department text not null,
  employment_type text not null,
  location text not null default '',
  start_date date,
  summary text not null default '',
  description text not null default '',
  responsibilities text[] not null default array[]::text[],
  requirements text[] not null default array[]::text[],
  benefits text[] not null default array[]::text[],
  salary_visible boolean not null default false,
  salary_min numeric(12, 2),
  salary_max numeric(12, 2),
  salary_currency text not null default 'EUR',
  salary_period text not null default 'month',
  show_yacht_name boolean not null default false,
  status text not null default 'draft',
  published_at timestamptz,
  published_by uuid
    references auth.users(id) on delete restrict,
  closes_at timestamptz,
  closed_at timestamptz,
  closed_by uuid
    references auth.users(id) on delete restrict,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_posts_title_length_check
    check (char_length(title) <= 120),
  constraint job_posts_position_length_check
    check (char_length(position) between 1 and 80),
  constraint job_posts_department_check
    check (
      department in (
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
      )
    ),
  constraint job_posts_employment_type_check
    check (
      employment_type in (
        'permanent',
        'temporary',
        'seasonal',
        'rotation',
        'daywork'
      )
    ),
  constraint job_posts_location_length_check
    check (char_length(location) <= 120),
  constraint job_posts_summary_length_check
    check (char_length(summary) <= 320),
  constraint job_posts_description_length_check
    check (char_length(description) <= 8000),
  constraint job_posts_responsibilities_check
    check (
      cardinality(responsibilities) <= 20
      and octet_length(array_to_string(responsibilities, '')) <= 8000
    ),
  constraint job_posts_requirements_check
    check (
      cardinality(requirements) <= 20
      and octet_length(array_to_string(requirements, '')) <= 8000
    ),
  constraint job_posts_benefits_check
    check (
      cardinality(benefits) <= 20
      and octet_length(array_to_string(benefits, '')) <= 8000
    ),
  constraint job_posts_salary_currency_check
    check (salary_currency ~ '^[A-Z]{3}$'),
  constraint job_posts_salary_period_check
    check (salary_period in ('day', 'week', 'month', 'year')),
  constraint job_posts_salary_range_check
    check (
      (salary_min is null or salary_min >= 0)
      and (salary_max is null or salary_max >= 0)
      and (
        salary_min is null
        or salary_max is null
        or salary_min <= salary_max
      )
      and (
        not salary_visible
        or salary_min is not null
        or salary_max is not null
      )
    ),
  constraint job_posts_status_check
    check (status in ('draft', 'published', 'closed')),
  constraint job_posts_version_check
    check (version > 0),
  constraint job_posts_lifecycle_fields_check
    check (
      (
        status = 'draft'
        and published_at is null
        and published_by is null
        and closed_at is null
        and closed_by is null
      )
      or (
        status = 'published'
        and published_at is not null
        and published_by is not null
        and closed_at is null
        and closed_by is null
      )
      or (
        status = 'closed'
        and closed_at is not null
        and closed_by is not null
        and (
          (published_at is null and published_by is null)
          or (published_at is not null and published_by is not null)
        )
      )
    ),
  constraint job_posts_closing_window_check
    check (
      closes_at is null
      or published_at is null
      or closes_at > published_at
    ),
  constraint job_posts_timestamp_order_check
    check (
      created_at <= updated_at
      and (published_at is null or created_at <= published_at)
      and (closed_at is null or created_at <= closed_at)
    )
);

create index if not exists job_posts_public_listing_idx
  on public.job_posts (published_at desc)
  where status = 'published';

create index if not exists job_posts_yacht_updated_at_idx
  on public.job_posts (yacht_id, updated_at desc);

create index if not exists job_posts_creator_updated_at_idx
  on public.job_posts (created_by, updated_at desc);

create table if not exists public.job_post_events (
  id uuid primary key default gen_random_uuid(),
  job_post_id uuid not null
    references public.job_posts(id) on delete restrict,
  actor_user_id uuid
    references auth.users(id) on delete set null,
  action text not null,
  from_status text,
  to_status text not null,
  version integer not null,
  created_at timestamptz not null default now(),
  constraint job_post_events_action_check
    check (
      action in (
        'created',
        'updated',
        'published',
        'unpublished',
        'closed',
        'reopened'
      )
    ),
  constraint job_post_events_from_status_check
    check (
      from_status is null
      or from_status in ('draft', 'published', 'closed')
    ),
  constraint job_post_events_to_status_check
    check (to_status in ('draft', 'published', 'closed')),
  constraint job_post_events_version_check
    check (version > 0),
  constraint job_post_events_transition_check
    check (
      (
        action = 'created'
        and from_status is null
        and to_status = 'draft'
      )
      or (
        action = 'published'
        and (
          (from_status is null and to_status = 'published')
          or (from_status = 'draft' and to_status = 'published')
        )
      )
      or (
        action = 'updated'
        and from_status = to_status
      )
      or (
        action = 'unpublished'
        and from_status = 'published'
        and to_status = 'draft'
      )
      or (
        action = 'closed'
        and from_status in ('draft', 'published')
        and to_status = 'closed'
      )
      or (
        action = 'reopened'
        and from_status = 'closed'
        and to_status = 'draft'
      )
    )
);

create index if not exists job_post_events_post_created_at_idx
  on public.job_post_events (job_post_id, created_at desc);

create index if not exists job_post_events_actor_created_at_idx
  on public.job_post_events (actor_user_id, created_at desc)
  where actor_user_id is not null;

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

  perform 1
  from public.yachts as yacht
  inner join public.employer_access as access
    on access.yacht_id = yacht.id
   and access.user_id = actor_id
  where yacht.id = new.yacht_id
    and yacht.owner_id = actor_id
    and access.status = 'verified'
    and access.can_post_jobs is true
  for share of yacht, access;

  if not found then
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
        message = 'Verified employer access is required for this yacht.';
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

create or replace function public.log_job_post_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  event_action text;
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
    case when tg_op = 'INSERT' then new.created_by else new.updated_by end,
    event_action,
    case when tg_op = 'INSERT' then null else old.status end,
    new.status,
    new.version,
    new.updated_at
  );

  return new;
end;
$function$;

create or replace function public.close_job_posts_on_employer_revocation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if old.status = 'verified' and new.status <> 'verified' then
    update public.job_posts
    set status = 'closed',
        updated_by = old.user_id
    where yacht_id = old.yacht_id
      and created_by = old.user_id
      and status in ('draft', 'published');
  end if;

  return new;
end;
$function$;

create or replace function public.close_job_posts_on_yacht_owner_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if old.owner_id is distinct from new.owner_id then
    update public.job_posts
    set status = 'closed',
        updated_by = created_by
    where yacht_id = old.id
      and status in ('draft', 'published');
  end if;

  return new;
end;
$function$;

drop trigger if exists job_posts_prepare_write
  on public.job_posts;
create trigger job_posts_prepare_write
before insert or update on public.job_posts
for each row execute function public.prepare_job_post_write();

drop trigger if exists job_posts_log_event
  on public.job_posts;
create trigger job_posts_log_event
after insert or update on public.job_posts
for each row execute function public.log_job_post_event();

-- This trigger sorts before employer_access_prepare_write. It closes active
-- posts while the previous verified access row is still the current row.
drop trigger if exists employer_access_00_close_job_posts
  on public.employer_access;
create trigger employer_access_00_close_job_posts
before update of status on public.employer_access
for each row execute function public.close_job_posts_on_employer_revocation();

drop trigger if exists yachts_00_close_job_posts_on_owner_change
  on public.yachts;
create trigger yachts_00_close_job_posts_on_owner_change
before update of owner_id on public.yachts
for each row
when (old.owner_id is distinct from new.owner_id)
execute function public.close_job_posts_on_yacht_owner_change();

alter table public.job_posts enable row level security;
alter table public.job_post_events enable row level security;

-- All reads and writes pass through narrowly scoped server routes. This keeps
-- private drafts, actor IDs and hidden compensation out of browser clients.
revoke all on table public.job_posts
  from public, anon, authenticated, service_role;
grant select, insert, update on table public.job_posts
  to service_role;

-- Events are append-only at runtime; the trigger is their only writer.
revoke all on table public.job_post_events
  from public, anon, authenticated, service_role;
grant select on table public.job_post_events
  to service_role;

revoke all on function public.prepare_job_post_write()
  from public, anon, authenticated, service_role;
revoke all on function public.log_job_post_event()
  from public, anon, authenticated, service_role;
revoke all on function public.close_job_posts_on_employer_revocation()
  from public, anon, authenticated, service_role;
revoke all on function public.close_job_posts_on_yacht_owner_change()
  from public, anon, authenticated, service_role;

-- Re-running the migration also reconciles any legacy active post whose
-- creator is no longer both the yacht owner and a verified employer.
update public.job_posts as post
set status = 'closed',
    updated_by = post.created_by
where post.status in ('draft', 'published')
  and not exists (
    select 1
    from public.yachts as yacht
    inner join public.employer_access as access
      on access.yacht_id = yacht.id
     and access.user_id = post.created_by
    where yacht.id = post.yacht_id
      and yacht.owner_id = post.created_by
      and access.status = 'verified'
      and access.can_post_jobs is true
  );

comment on table public.job_posts is
  'Server-managed yacht job posts owned by verified BlueDeck employers.';
comment on table public.job_post_events is
  'Append-only job post lifecycle audit generated by database triggers.';
comment on column public.job_posts.show_yacht_name is
  'Controls whether public job APIs may expose yacht name, model and flag.';
comment on column public.job_posts.version is
  'Monotonic optimistic-concurrency version maintained by trigger.';

commit;
