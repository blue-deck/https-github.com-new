-- Stable, public-facing reference numbers for every yacht job post.
--
-- Numbers are allocated by a private database sequence and never reused. The
-- human-readable year is the UTC year in which the row was created; the
-- sequence suffix remains globally unique across years. Gaps are expected when
-- a transaction rolls back and prevent an abandoned reference being recycled.

begin;

create sequence if not exists public.job_posts_listing_number_seq
  as bigint
  increment by 1
  minvalue 100001
  no maxvalue
  start with 100001
  cache 1;

alter table public.job_posts
  add column if not exists listing_number text;

alter sequence public.job_posts_listing_number_seq
  owned by public.job_posts.listing_number;

-- Reconcile a partially applied environment before assigning missing values.
-- Existing valid references always move the allocator forward, so a retry can
-- never reuse one of their numeric suffixes.
--
-- The lifecycle triggers are paused only for this locked schema migration. A
-- reference backfill must not increment the business version, modify
-- updated_at, require current publisher authority, or create a fake audit
-- event for an otherwise unchanged historical post.
alter table public.job_posts
  disable trigger job_posts_prepare_write;
alter table public.job_posts
  disable trigger job_posts_log_event;

do $backfill$
declare
  highest_suffix bigint;
  allocator_value bigint;
  allocator_called boolean;
  target_job record;
  allocated_suffix bigint;
begin
  select max(
    substring(
      post.listing_number
      from '^BDJ-[0-9]{4}-([1-9][0-9]{5,})$'
    )::bigint
  )
  into highest_suffix
  from public.job_posts as post
  where post.listing_number is not null;

  select sequence_state.last_value, sequence_state.is_called
  into allocator_value, allocator_called
  from public.job_posts_listing_number_seq as sequence_state;

  -- Never rewind the allocator: rolled-back inserts deliberately leave gaps,
  -- and a later migration retry must not make those references reusable.
  if allocator_called then
    perform pg_catalog.setval(
      'public.job_posts_listing_number_seq'::regclass,
      greatest(allocator_value, coalesce(highest_suffix, 100001)),
      true
    );
  elsif highest_suffix is not null and highest_suffix >= allocator_value then
    perform pg_catalog.setval(
      'public.job_posts_listing_number_seq'::regclass,
      highest_suffix,
      true
    );
  end if;

  for target_job in
    select
      post.id,
      to_char(post.created_at at time zone 'UTC', 'YYYY') as created_year
    from public.job_posts as post
    where post.listing_number is null
    order by post.created_at, post.id
  loop
    allocated_suffix := nextval(
      'public.job_posts_listing_number_seq'::regclass
    );

    update public.job_posts as post
    set listing_number = format(
      'BDJ-%s-%s',
      target_job.created_year,
      lpad(
        allocated_suffix::text,
        greatest(6, length(allocated_suffix::text)),
        '0'
      )
    )
    where post.id = target_job.id;
  end loop;
end;
$backfill$;

alter table public.job_posts
  enable trigger job_posts_prepare_write;
alter table public.job_posts
  enable trigger job_posts_log_event;

alter table public.job_posts
  drop constraint if exists job_posts_listing_number_format_check;

alter table public.job_posts
  add constraint job_posts_listing_number_format_check
  check (
    listing_number ~ '^BDJ-[0-9]{4}-[1-9][0-9]{5,}$'
  ) not valid;

alter table public.job_posts
  validate constraint job_posts_listing_number_format_check;

alter table public.job_posts
  alter column listing_number set not null;

do $unique_constraint$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_record
    where constraint_record.conrelid = 'public.job_posts'::regclass
      and constraint_record.conname = 'job_posts_listing_number_key'
      and constraint_record.contype = 'u'
  ) then
    alter table public.job_posts
      add constraint job_posts_listing_number_key unique (listing_number);
  end if;
end;
$unique_constraint$;

create or replace function public.prepare_job_post_listing_number()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  allocated_suffix bigint;
  created_year text;
begin
  if tg_op = 'INSERT' then
    if new.listing_number is not null then
      raise exception using
        errcode = '22023',
        message = 'Job post public numbers are assigned only by the database.';
    end if;

    -- `job_posts_prepare_write` runs first by trigger-name order and replaces
    -- created_at with the authoritative write time. The fallback makes this
    -- function safe if it is reused during a controlled data repair.
    created_year := to_char(
      coalesce(new.created_at, now()) at time zone 'UTC',
      'YYYY'
    );
    allocated_suffix := nextval(
      'public.job_posts_listing_number_seq'::regclass
    );
    new.listing_number := format(
      'BDJ-%s-%s',
      created_year,
      lpad(
        allocated_suffix::text,
        greatest(6, length(allocated_suffix::text)),
        '0'
      )
    );
    return new;
  end if;

  if new.listing_number is distinct from old.listing_number then
    raise exception using
      errcode = '22023',
      message = 'Job post public numbers cannot be changed.';
  end if;

  return new;
end;
$function$;

drop trigger if exists job_posts_listing_number_guard
  on public.job_posts;
drop trigger if exists job_posts_z_listing_number_guard
  on public.job_posts;
create trigger job_posts_z_listing_number_guard
before insert or update of listing_number on public.job_posts
for each row execute function public.prepare_job_post_listing_number();

-- The security-definer trigger owns allocation. Neither browser sessions nor
-- service routes can reserve a number directly or invoke the guard function.
revoke all on sequence public.job_posts_listing_number_seq
  from public, anon, authenticated, service_role;
revoke all on function public.prepare_job_post_listing_number()
  from public, anon, authenticated, service_role;

comment on column public.job_posts.listing_number is
  'Immutable public job reference assigned by the database, for example BDJ-2026-100001.';
comment on sequence public.job_posts_listing_number_seq is
  'Private non-recycling allocator for globally unique job-post public-number suffixes.';

commit;
