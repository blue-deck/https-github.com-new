-- Permanent, server-managed employer hiring access.
-- Safe to re-run: every object is created conditionally or replaced by name.

begin;

create extension if not exists "pgcrypto";

create table if not exists public.employer_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null
    references auth.users(id) on delete cascade,
  yacht_id uuid not null
    references public.yachts(id) on delete cascade,
  requested_role text not null,
  status text not null default 'pending',
  can_post_jobs boolean not null default false,
  request_note text not null default '',
  review_note text not null default '',
  reviewed_by uuid
    references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employer_access_requested_role_check
    check (requested_role in ('owner', 'captain', 'management')),
  constraint employer_access_status_check
    check (status in ('pending', 'verified', 'rejected', 'suspended')),
  constraint employer_access_request_note_length_check
    check (char_length(request_note) <= 240),
  constraint employer_access_review_note_length_check
    check (char_length(review_note) <= 240),
  constraint employer_access_posting_state_check
    check (can_post_jobs = (status = 'verified')),
  constraint employer_access_review_state_check
    check (
      (
        status = 'pending'
        and reviewed_at is null
        and reviewed_by is null
        and review_note = ''
      )
      or (
        status = 'verified'
        and reviewed_at is not null
      )
      or (
        status in ('rejected', 'suspended')
        and reviewed_at is not null
        and char_length(btrim(review_note)) > 0
      )
    ),
  constraint employer_access_timestamp_order_check
    check (
      created_at <= updated_at
      and requested_at <= updated_at
      and (reviewed_at is null or reviewed_at <= updated_at)
    )
);

create unique index if not exists employer_access_user_yacht_unique_idx
  on public.employer_access (user_id, yacht_id);

create index if not exists employer_access_status_updated_at_idx
  on public.employer_access (status, updated_at desc);

create index if not exists employer_access_yacht_id_idx
  on public.employer_access (yacht_id);

create table if not exists public.employer_access_events (
  id uuid primary key default gen_random_uuid(),
  access_id uuid not null
    references public.employer_access(id) on delete cascade,
  actor_user_id uuid
    references auth.users(id) on delete set null,
  action text not null,
  from_status text,
  to_status text not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint employer_access_events_action_check
    check (
      action in (
        'requested',
        'resubmitted',
        'verified',
        'rejected',
        'suspended',
        'restored'
      )
    ),
  constraint employer_access_events_from_status_check
    check (
      from_status is null
      or from_status in ('pending', 'verified', 'rejected', 'suspended')
    ),
  constraint employer_access_events_to_status_check
    check (to_status in ('pending', 'verified', 'rejected', 'suspended')),
  constraint employer_access_events_note_length_check
    check (char_length(note) <= 240),
  constraint employer_access_events_transition_check
    check (
      (action = 'requested' and from_status is null and to_status = 'pending')
      or (
        action = 'resubmitted'
        and from_status = 'rejected'
        and to_status = 'pending'
      )
      or (
        action = 'verified'
        and from_status in ('pending', 'rejected')
        and to_status = 'verified'
      )
      or (
        action = 'rejected'
        and from_status = 'pending'
        and to_status = 'rejected'
      )
      or (
        action = 'suspended'
        and from_status = 'verified'
        and to_status = 'suspended'
      )
      or (
        action = 'restored'
        and from_status = 'suspended'
        and to_status = 'verified'
      )
    )
);

create index if not exists employer_access_events_access_created_at_idx
  on public.employer_access_events (access_id, created_at desc);

create index if not exists employer_access_events_actor_created_at_idx
  on public.employer_access_events (actor_user_id, created_at desc)
  where actor_user_id is not null;

create or replace function public.prepare_employer_access_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  write_time timestamptz := now();
begin
  new.request_note := coalesce(new.request_note, '');
  new.review_note := coalesce(new.review_note, '');

  if tg_op = 'INSERT' then
    if new.status is distinct from 'pending' then
      raise exception using
        errcode = '23514',
        message = 'New employer access requests must start in pending status.';
    end if;

    perform 1
    from public.yachts
    where id = new.yacht_id
      and owner_id = new.user_id
    for share;

    if not found then
      raise exception using
        errcode = '23514',
        message = 'Employer access requires a yacht owned by the applicant.';
    end if;

    new.can_post_jobs := false;
    new.review_note := '';
    new.reviewed_by := null;
    new.reviewed_at := null;
    new.requested_at := coalesce(new.requested_at, write_time);
    new.created_at := coalesce(new.created_at, write_time);
    new.updated_at := coalesce(new.updated_at, write_time);
    return new;
  end if;

  if new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.yacht_id is distinct from old.yacht_id
    or new.created_at is distinct from old.created_at
  then
    raise exception using
      errcode = '22023',
      message = 'Employer access identity fields cannot be changed.';
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'pending' and new.status in ('verified', 'rejected'))
      or (old.status = 'verified' and new.status = 'suspended')
      or (
        old.status = 'rejected'
        and new.status in ('pending', 'verified')
      )
      or (old.status = 'suspended' and new.status = 'verified')
    ) then
      raise exception using
        errcode = '23514',
        message = format(
          'Employer access cannot move from %s to %s.',
          old.status,
          new.status
        );
    end if;

    if new.status in ('pending', 'verified') then
      perform 1
      from public.yachts
      where id = new.yacht_id
        and owner_id = new.user_id
      for share;

      if not found then
        raise exception using
          errcode = '23514',
          message = 'Employer access requires a yacht owned by the applicant.';
      end if;
    end if;

    if old.status = 'rejected' and new.status = 'pending' then
      new.requested_at := write_time;
      new.review_note := '';
      new.reviewed_by := null;
      new.reviewed_at := null;
    else
      if new.reviewed_by is null then
        raise exception using
          errcode = '23502',
          message = 'Employer access decisions require a reviewer.';
      end if;
      new.reviewed_at := write_time;
    end if;
  else
    new.requested_at := old.requested_at;
  end if;

  new.can_post_jobs := (new.status = 'verified');
  new.created_at := old.created_at;
  new.updated_at := write_time;
  return new;
end;
$function$;

create or replace function public.log_employer_access_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  event_action text;
  event_actor uuid;
  event_note text;
begin
  if tg_op = 'INSERT' then
    event_action := 'requested';
    event_actor := new.user_id;
    event_note := new.request_note;
  elsif old.status is not distinct from new.status then
    return new;
  elsif old.status = 'rejected' and new.status = 'pending' then
    event_action := 'resubmitted';
    event_actor := new.user_id;
    event_note := new.request_note;
  else
    event_action := case
      when old.status = 'suspended' and new.status = 'verified'
        then 'restored'
      when new.status = 'verified'
        then 'verified'
      when new.status = 'rejected'
        then 'rejected'
      when new.status = 'suspended'
        then 'suspended'
    end;
    event_actor := new.reviewed_by;
    event_note := new.review_note;
  end if;

  insert into public.employer_access_events (
    access_id,
    actor_user_id,
    action,
    from_status,
    to_status,
    note,
    created_at
  )
  values (
    new.id,
    event_actor,
    event_action,
    case when tg_op = 'INSERT' then null else old.status end,
    new.status,
    event_note,
    new.updated_at
  );

  return new;
end;
$function$;

drop trigger if exists employer_access_prepare_write
  on public.employer_access;
create trigger employer_access_prepare_write
before insert or update on public.employer_access
for each row execute function public.prepare_employer_access_write();

drop trigger if exists employer_access_log_event
  on public.employer_access;
create trigger employer_access_log_event
after insert or update on public.employer_access
for each row execute function public.log_employer_access_event();

alter table public.employer_access enable row level security;
alter table public.employer_access_events enable row level security;

drop policy if exists "Users read own employer access"
  on public.employer_access;
create policy "Users read own employer access"
on public.employer_access
for select
to authenticated
using ((select auth.uid()) = user_id);

-- Requests and decisions are written only by trusted server routes. Events are
-- append-only at runtime: the trigger is their only writer, and no application
-- role receives UPDATE, DELETE, or TRUNCATE privileges.
revoke all on table public.employer_access
  from public, anon, authenticated, service_role;
grant select on table public.employer_access
  to authenticated;
grant select, insert, update on table public.employer_access
  to service_role;

revoke all on table public.employer_access_events
  from public, anon, authenticated, service_role;
grant select on table public.employer_access_events
  to service_role;

revoke all on function public.prepare_employer_access_write()
  from public, anon, authenticated, service_role;
revoke all on function public.log_employer_access_event()
  from public, anon, authenticated, service_role;

comment on table public.employer_access is
  'Verified, server-managed hiring access for one account and yacht.';
comment on table public.employer_access_events is
  'Append-only lifecycle audit generated automatically from employer_access.';
comment on column public.employer_access.can_post_jobs is
  'Derived by trigger; true only while status is verified.';

commit;
