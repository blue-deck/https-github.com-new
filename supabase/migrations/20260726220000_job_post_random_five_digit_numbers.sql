-- Replace sequential public job references with private, shuffled five-digit
-- numbers. The display layer adds the leading `#`; the database stores only
-- the five digits so the value remains easy to validate and search.

begin;

lock table public.job_posts in access exclusive mode;

create schema if not exists private;

create table private.job_listing_number_slots (
  listing_number integer primary key,
  shuffle_key uuid not null default gen_random_uuid(),
  allocated_job_id uuid unique,
  allocated_at timestamptz,
  constraint job_listing_number_slots_range_check
    check (listing_number between 10000 and 99999),
  constraint job_listing_number_slots_allocation_check
    check (
      (allocated_job_id is null and allocated_at is null)
      or (allocated_job_id is not null and allocated_at is not null)
    )
);

insert into private.job_listing_number_slots (
  listing_number,
  shuffle_key
)
select available_number, gen_random_uuid()
from generate_series(10000, 99999) as available(available_number)
on conflict (listing_number) do nothing;

do $slot_inventory$
begin
  if (
    select count(*)
    from private.job_listing_number_slots
  ) <> 90000 then
    raise exception using
      errcode = '54000',
      message = 'The five-digit job reference inventory is incomplete.';
  end if;
end;
$slot_inventory$;

create index if not exists job_listing_number_slots_available_idx
  on private.job_listing_number_slots (shuffle_key, listing_number)
  where allocated_job_id is null;

alter table private.job_listing_number_slots enable row level security;
revoke all on table private.job_listing_number_slots
  from public, anon, authenticated, service_role;

-- Lifecycle triggers are paused only while the public reference is replaced.
-- This avoids artificial version changes and audit entries for existing jobs.
alter table public.job_posts
  disable trigger job_posts_prepare_write;
alter table public.job_posts
  disable trigger job_posts_log_event;
drop trigger if exists job_posts_listing_number_guard
  on public.job_posts;
drop trigger if exists job_posts_z_listing_number_guard
  on public.job_posts;

alter table public.job_posts
  drop constraint if exists job_posts_listing_number_format_check;

do $capacity_check$
begin
  if (
    select count(*)
    from public.job_posts
  ) > 90000 then
    raise exception using
      errcode = '54000',
      message = 'There are more job posts than available five-digit references.';
  end if;
end;
$capacity_check$;

with ranked_jobs as materialized (
  select
    post.id,
    row_number() over (order by post.created_at, post.id) as allocation_rank
  from public.job_posts as post
),
ranked_slots as materialized (
  select
    slot.listing_number,
    row_number() over (
      order by slot.shuffle_key, slot.listing_number
    ) as allocation_rank
  from private.job_listing_number_slots as slot
  where slot.allocated_job_id is null
),
assignments as materialized (
  select
    job.id as job_id,
    slot.listing_number
  from ranked_jobs as job
  inner join ranked_slots as slot
    on slot.allocation_rank = job.allocation_rank
),
claimed_slots as (
  update private.job_listing_number_slots as slot
  set allocated_job_id = assignment.job_id,
      allocated_at = clock_timestamp()
  from assignments as assignment
  where slot.listing_number = assignment.listing_number
  returning slot.listing_number, slot.allocated_job_id
)
update public.job_posts as post
set listing_number = claimed.listing_number::text
from claimed_slots as claimed
where post.id = claimed.allocated_job_id;

do $backfill_check$
begin
  if exists (
    select 1
    from public.job_posts as post
    left join private.job_listing_number_slots as slot
      on slot.allocated_job_id = post.id
     and slot.listing_number::text = post.listing_number
    where post.listing_number !~ '^[1-9][0-9]{4}$'
      or slot.listing_number is null
  ) then
    raise exception using
      errcode = '23514',
      message = 'Existing job references were not fully converted.';
  end if;
end;
$backfill_check$;

alter table public.job_posts
  add constraint job_posts_listing_number_format_check
  check (listing_number ~ '^[1-9][0-9]{4}$') not valid;

alter table public.job_posts
  validate constraint job_posts_listing_number_format_check;

alter table public.job_posts
  alter column listing_number set not null;

create or replace function public.prepare_job_post_listing_number()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  allocated_number integer;
begin
  if tg_op = 'INSERT' then
    if new.listing_number is not null then
      raise exception using
        errcode = '22023',
        message = 'Job post public numbers are assigned only by the database.';
    end if;

    if new.id is null then
      raise exception using
        errcode = '23502',
        message = 'A job post id is required before allocating its public number.';
    end if;

    with candidate as (
      select slot.listing_number
      from private.job_listing_number_slots as slot
      where slot.allocated_job_id is null
      order by slot.shuffle_key, slot.listing_number
      for update skip locked
      limit 1
    )
    update private.job_listing_number_slots as slot
    set allocated_job_id = new.id,
        allocated_at = clock_timestamp()
    from candidate
    where slot.listing_number = candidate.listing_number
    returning slot.listing_number
    into allocated_number;

    if allocated_number is null then
      raise exception using
        errcode = '54000',
        message = 'All five-digit job post public numbers have been allocated.';
    end if;

    new.listing_number := allocated_number::text;
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

create trigger job_posts_z_listing_number_guard
before insert or update of listing_number on public.job_posts
for each row execute function public.prepare_job_post_listing_number();

alter table public.job_posts
  enable trigger job_posts_prepare_write;
alter table public.job_posts
  enable trigger job_posts_log_event;

revoke all on function public.prepare_job_post_listing_number()
  from public, anon, authenticated, service_role;

alter sequence if exists public.job_posts_listing_number_seq
  owned by none;
drop sequence if exists public.job_posts_listing_number_seq;

comment on column public.job_posts.listing_number is
  'Immutable five-digit public job reference. User interfaces display the value with a leading #.';
comment on table private.job_listing_number_slots is
  'Private shuffled inventory for all 90,000 five-digit job references; allocations are never recycled.';

commit;
