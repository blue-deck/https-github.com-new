-- Least-privilege access for BlueDeck's core identity and yacht tables.
--
-- This migration deliberately keeps service_role as the only browser-bypassing
-- writer for memberships and invitations. Public routes that need broader data
-- validate the caller first and then use service_role.
--
-- Safe to re-run:
--   * helper functions are replaced in place;
--   * every policy on the managed tables is removed by catalog lookup;
--   * grants and triggers are reset explicitly.

begin;

create schema if not exists private;

-- Conservatively link legacy crew profiles before ownership-only storage and
-- table policies take effect. A row is linked only when both sides have one
-- unique normalized email, the auth email is confirmed, and that auth user is
-- not already linked to another crew profile.
with legacy_profile_links as (
  select
    crew_profile.id as crew_profile_id,
    auth_user.id as user_id
  from public.crew_profiles as crew_profile
  join auth.users as auth_user
    on lower(btrim(auth_user.email))
      = lower(btrim(crew_profile.email))
  where crew_profile.user_id is null
    and nullif(btrim(coalesce(crew_profile.email, '')), '') is not null
    and auth_user.email_confirmed_at is not null
    and not exists (
      select 1
      from auth.users as other_auth_user
      where other_auth_user.id <> auth_user.id
        and lower(btrim(other_auth_user.email))
          = lower(btrim(auth_user.email))
    )
    and not exists (
      select 1
      from public.crew_profiles as other_crew_profile
      where other_crew_profile.id <> crew_profile.id
        and lower(btrim(coalesce(other_crew_profile.email, '')))
          = lower(btrim(crew_profile.email))
    )
    and not exists (
      select 1
      from public.crew_profiles as linked_crew_profile
      where linked_crew_profile.user_id = auth_user.id
    )
)
update public.crew_profiles as crew_profile
set user_id = legacy_profile_links.user_id
from legacy_profile_links
where crew_profile.id = legacy_profile_links.crew_profile_id
  and crew_profile.user_id is null;

-- A confirmed account email is used only for legacy rows which have not yet
-- been linked to a user id. If a crew profile is linked to a different user,
-- email never overrides that link.
create or replace function private.bluedeck_current_email()
returns text
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select lower(btrim(coalesce(account.email, '')))
  from auth.users as account
  where account.id = auth.uid()
    and account.email_confirmed_at is not null;
$function$;

create or replace function private.bluedeck_is_own_crew_profile(
  target_crew_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select
    auth.uid() is not null
    and target_crew_profile_id is not null
    and exists (
      select 1
      from public.crew_profiles as crew_profile
      where crew_profile.id = target_crew_profile_id
        and (
          crew_profile.user_id = auth.uid()
          or (
            crew_profile.user_id is null
            and private.bluedeck_current_email() <> ''
            and lower(btrim(coalesce(crew_profile.email, '')))
              = private.bluedeck_current_email()
          )
        )
    );
$function$;

create or replace function private.bluedeck_is_own_membership(
  target_membership_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select
    auth.uid() is not null
    and target_membership_id is not null
    and exists (
      select 1
      from public.yacht_crew_memberships as membership
      left join public.crew_profiles as crew_profile
        on crew_profile.id = membership.crew_profile_id
      where membership.id = target_membership_id
        and (
          crew_profile.user_id = auth.uid()
          or (
            crew_profile.user_id is null
            and private.bluedeck_current_email() <> ''
            and (
              lower(btrim(coalesce(crew_profile.email, '')))
                = private.bluedeck_current_email()
              or lower(btrim(coalesce(membership.invited_email, '')))
                = private.bluedeck_current_email()
            )
          )
          or (
            membership.crew_profile_id is null
            and private.bluedeck_current_email() <> ''
            and lower(btrim(coalesce(membership.invited_email, '')))
              = private.bluedeck_current_email()
          )
        )
    );
$function$;

create or replace function private.bluedeck_is_yacht_owner(
  target_yacht_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select
    auth.uid() is not null
    and target_yacht_id is not null
    and exists (
      select 1
      from public.yachts as yacht
      where yacht.id = target_yacht_id
        and yacht.owner_id = auth.uid()
    );
$function$;

create or replace function private.bluedeck_is_active_yacht_member(
  target_yacht_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select
    auth.uid() is not null
    and target_yacht_id is not null
    and exists (
      select 1
      from public.yacht_crew_memberships as membership
      left join public.crew_profiles as crew_profile
        on crew_profile.id = membership.crew_profile_id
      where membership.yacht_id = target_yacht_id
        and lower(btrim(coalesce(membership.status, ''))) = 'active'
        and (
          crew_profile.user_id = auth.uid()
          or (
            crew_profile.user_id is null
            and private.bluedeck_current_email() <> ''
            and (
              lower(btrim(coalesce(crew_profile.email, '')))
                = private.bluedeck_current_email()
              or lower(btrim(coalesce(membership.invited_email, '')))
                = private.bluedeck_current_email()
            )
          )
          or (
            membership.crew_profile_id is null
            and private.bluedeck_current_email() <> ''
            and lower(btrim(coalesce(membership.invited_email, '')))
              = private.bluedeck_current_email()
          )
        )
    );
$function$;

create or replace function private.bluedeck_has_yacht_access(
  target_yacht_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select
    private.bluedeck_is_yacht_owner(target_yacht_id)
    or private.bluedeck_is_active_yacht_member(target_yacht_id);
$function$;

-- Manager authority intentionally comes only from immutable yacht ownership.
-- Legacy memberships were writable under an earlier broad policy, so Captain
-- or Yacht Manager labels are not safe authorization claims. A separately
-- reviewed management-grant model can be added later without weakening this
-- rollout.
create or replace function private.bluedeck_is_yacht_manager(
  target_yacht_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select private.bluedeck_is_yacht_owner(target_yacht_id);
$function$;

create or replace function private.bluedeck_is_own_invitation(
  target_invitation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select
    auth.uid() is not null
    and target_invitation_id is not null
    and exists (
      select 1
      from public.crew_invitations as invitation
      left join public.crew_profiles as crew_profile
        on crew_profile.id = invitation.crew_profile_id
      where invitation.id = target_invitation_id
        and (
          crew_profile.user_id = auth.uid()
          or (
            crew_profile.user_id is null
            and private.bluedeck_current_email() <> ''
            and (
              lower(btrim(coalesce(crew_profile.email, '')))
                = private.bluedeck_current_email()
              or lower(btrim(coalesce(invitation.invited_email, '')))
                = private.bluedeck_current_email()
            )
          )
          or (
            invitation.crew_profile_id is null
            and private.bluedeck_current_email() <> ''
            and lower(btrim(coalesce(invitation.invited_email, '')))
              = private.bluedeck_current_email()
          )
        )
    );
$function$;

create or replace function private.bluedeck_can_read_checklist(
  target_checklist_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
    from public.yacht_checklists as checklist
    where checklist.id = target_checklist_id
      and private.bluedeck_has_yacht_access(checklist.yacht_id)
  );
$function$;

create or replace function private.bluedeck_can_edit_checklist(
  target_checklist_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
    from public.yacht_checklists as checklist
    where checklist.id = target_checklist_id
      and (
        private.bluedeck_is_yacht_manager(checklist.yacht_id)
        or (
          private.bluedeck_is_active_yacht_member(checklist.yacht_id)
          and private.bluedeck_is_own_crew_profile(checklist.assigned_to)
        )
      )
  );
$function$;

create or replace function private.bluedeck_can_manage_checklist(
  target_checklist_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select exists (
    select 1
    from public.yacht_checklists as checklist
    where checklist.id = target_checklist_id
      and private.bluedeck_is_yacht_manager(checklist.yacht_id)
  );
$function$;

create or replace function private.bluedeck_is_contract_party(
  target_crew_profile_id uuid,
  target_membership_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select
    private.bluedeck_is_own_crew_profile(target_crew_profile_id)
    or private.bluedeck_is_own_membership(target_membership_id);
$function$;

-- Assigned crew can complete a checklist, but cannot rewrite its assignment or
-- captain-authored instructions.
create or replace function private.bluedeck_guard_checklist_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  task_count integer;
  incomplete_task_count integer;
begin
  if auth.uid() is null
    or auth.role() = 'service_role'
    or private.bluedeck_is_yacht_manager(old.yacht_id)
  then
    return new;
  end if;

  if (
    to_jsonb(new)
      - array['status', 'completed_at', 'updated_at']::text[]
  ) is distinct from (
    to_jsonb(old)
      - array['status', 'completed_at', 'updated_at']::text[]
  ) then
    raise exception using
      errcode = '42501',
      message = 'Assigned crew may update only checklist completion fields.';
  end if;

  if new.status is not distinct from old.status then
    if new.completed_at is distinct from old.completed_at then
      raise exception using
        errcode = '42501',
        message = 'Checklist completion time is maintained by BlueDeck.';
    end if;

    return new;
  end if;

  if lower(btrim(coalesce(old.status, ''))) <> 'open'
    or lower(btrim(coalesce(new.status, ''))) <> 'completed'
  then
    raise exception using
      errcode = '23514',
      message = 'Assigned crew may only move an open checklist to completed.';
  end if;

  select
    count(*)::integer,
    count(*) filter (where item.completed is distinct from true)::integer
  into task_count, incomplete_task_count
  from public.yacht_checklist_items as item
  where item.checklist_id = old.id;

  if task_count = 0 or incomplete_task_count > 0 then
    raise exception using
      errcode = '23514',
      message = 'Every checklist task must be completed first.';
  end if;

  new.status := 'completed';
  new.completed_at := now();
  return new;
end;
$function$;

-- Task proof and completion fields stay editable by assigned crew. The task
-- identity, checklist assignment, and authored instruction remain immutable.
create or replace function private.bluedeck_guard_checklist_item_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  source_yacht_id uuid;
  source_status text;
  source_completed_at timestamptz;
begin
  if auth.uid() is null or auth.role() = 'service_role' then
    return new;
  end if;

  select checklist.yacht_id, checklist.status, checklist.completed_at
  into source_yacht_id, source_status, source_completed_at
  from public.yacht_checklists as checklist
  where checklist.id = old.checklist_id;

  if private.bluedeck_is_yacht_manager(source_yacht_id) then
    return new;
  end if;

  if (
    to_jsonb(new)
      - array[
        'completed',
        'completed_at',
        'completed_by',
        'before_photo_url',
        'after_photo_url',
        'note',
        'updated_at'
      ]::text[]
  ) is distinct from (
    to_jsonb(old)
      - array[
        'completed',
        'completed_at',
        'completed_by',
        'before_photo_url',
        'after_photo_url',
        'note',
        'updated_at'
      ]::text[]
  ) then
    raise exception using
      errcode = '42501',
      message = 'Assigned crew may update only task completion and proof fields.';
  end if;

  if lower(btrim(coalesce(source_status, ''))) = 'completed'
    and (
      source_completed_at is null
      or source_completed_at <= now() - interval '24 hours'
    )
  then
    raise exception using
      errcode = '42501',
      message = 'Archived checklist evidence can no longer be changed.';
  end if;

  if new.completed is distinct from old.completed then
    if lower(btrim(coalesce(source_status, ''))) = 'completed' then
      raise exception using
        errcode = '23514',
        message = 'A completed checklist task cannot be reopened.';
    end if;

    if new.completed is true then
      new.completed_at := now();
      new.completed_by := coalesce(
        nullif(private.bluedeck_current_email(), ''),
        auth.uid()::text
      );
    else
      new.completed_at := null;
      new.completed_by := null;
    end if;
  elsif new.completed_at is distinct from old.completed_at
    or new.completed_by is distinct from old.completed_by
  then
    raise exception using
      errcode = '42501',
      message = 'Task completion identity and time are maintained by BlueDeck.';
  end if;

  return new;
end;
$function$;

drop trigger if exists bluedeck_guard_checklist_update
  on public.yacht_checklists;
create trigger bluedeck_guard_checklist_update
before update on public.yacht_checklists
for each row
execute function private.bluedeck_guard_checklist_update();

drop trigger if exists bluedeck_guard_checklist_item_update
  on public.yacht_checklist_items;
create trigger bluedeck_guard_checklist_item_update
before update on public.yacht_checklist_items
for each row
execute function private.bluedeck_guard_checklist_item_update();

-- RLS can restrict which contract rows a crew member may update, but it cannot
-- compare OLD and NEW values. This guard prevents a signer from rewriting the
-- contract body, its yacht, or its recipient while preserving manager writes.
create or replace function private.bluedeck_guard_contract_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  -- Database maintenance and service_role requests are already privileged.
  if auth.uid() is null or auth.role() = 'service_role' then
    return new;
  end if;

  if private.bluedeck_is_yacht_manager(old.yacht_id) then
    if new.yacht_id is distinct from old.yacht_id then
      raise exception using
        errcode = '42501',
        message = 'A contract cannot be moved to another yacht.';
    end if;

    if lower(btrim(coalesce(old.status, ''))) = 'signed'
      or old.signed_at is not null
    then
      if to_jsonb(new) is distinct from to_jsonb(old) then
        raise exception using
          errcode = '42501',
          message = 'A signed contract is an immutable record.';
      end if;
      return new;
    end if;

    if new.signed_name is distinct from old.signed_name
      or new.signed_at is distinct from old.signed_at
      or lower(btrim(coalesce(new.status, ''))) = 'signed'
    then
      raise exception using
        errcode = '42501',
        message = 'Only the assigned crew member may sign a contract.';
    end if;

    return new;
  end if;

  if not private.bluedeck_is_contract_party(
    old.crew_profile_id,
    old.membership_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'Only the contract manager or assigned crew member may update this contract.';
  end if;

  if lower(btrim(coalesce(old.status, ''))) = 'signed'
    or old.signed_at is not null
  then
    raise exception using
      errcode = '42501',
      message = 'A signed contract is an immutable record.';
  end if;

  if (
    to_jsonb(new)
      - array['status', 'signed_name', 'signed_at']::text[]
  ) is distinct from (
    to_jsonb(old)
      - array['status', 'signed_name', 'signed_at']::text[]
  ) then
    raise exception using
      errcode = '42501',
      message = 'Crew members may update only their contract signature.';
  end if;

  if lower(btrim(coalesce(new.status, ''))) <> 'signed'
    or nullif(btrim(coalesce(new.signed_name, '')), '') is null
    or new.signed_at is null
  then
    raise exception using
      errcode = '23514',
      message = 'A signed contract requires a signature name and timestamp.';
  end if;

  new.signed_at := now();
  return new;
end;
$function$;

drop trigger if exists bluedeck_guard_contract_update
  on public.yacht_contracts;
create trigger bluedeck_guard_contract_update
before update on public.yacht_contracts
for each row
execute function private.bluedeck_guard_contract_update();

-- The live project also contains the legacy crew_contracts model. It is not
-- used by the current UI, but it contains the same sensitive agreement data and
-- therefore receives equivalent manager/signer separation when present.
create or replace function private.bluedeck_guard_crew_contract_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if auth.uid() is null or auth.role() = 'service_role' then
    return new;
  end if;

  if private.bluedeck_is_yacht_manager(old.yacht_id) then
    if new.yacht_id is distinct from old.yacht_id then
      raise exception using
        errcode = '42501',
        message = 'A contract cannot be moved to another yacht.';
    end if;

    if lower(btrim(coalesce(old.status, ''))) = 'signed'
      or old.signed_at is not null
      or old.signed_by_crew is true
    then
      if to_jsonb(new) is distinct from to_jsonb(old) then
        raise exception using
          errcode = '42501',
          message = 'A signed contract is an immutable record.';
      end if;
      return new;
    end if;

    if new.signed_by_crew is distinct from old.signed_by_crew
      or new.signed_at is distinct from old.signed_at
      or lower(btrim(coalesce(new.status, ''))) = 'signed'
    then
      raise exception using
        errcode = '42501',
        message = 'Only the assigned crew member may sign a contract.';
    end if;

    return new;
  end if;

  if not private.bluedeck_is_own_crew_profile(old.crew_id) then
    raise exception using
      errcode = '42501',
      message = 'Only the contract manager or assigned crew member may update this contract.';
  end if;

  if lower(btrim(coalesce(old.status, ''))) = 'signed'
    or old.signed_at is not null
    or old.signed_by_crew is true
  then
    raise exception using
      errcode = '42501',
      message = 'A signed contract is an immutable record.';
  end if;

  if (
    to_jsonb(new)
      - array['status', 'signed_by_crew', 'signed_at']::text[]
  ) is distinct from (
    to_jsonb(old)
      - array['status', 'signed_by_crew', 'signed_at']::text[]
  ) then
    raise exception using
      errcode = '42501',
      message = 'Crew members may update only their contract signature.';
  end if;

  if new.signed_by_crew is distinct from true
    or new.signed_at is null
    or lower(btrim(coalesce(new.status, ''))) <> 'signed'
  then
    raise exception using
      errcode = '23514',
      message = 'A signed contract requires crew confirmation and a timestamp.';
  end if;

  new.signed_at := now();
  return new;
end;
$function$;

create or replace function private.bluedeck_guard_signed_contract_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if auth.uid() is null or auth.role() = 'service_role' then
    return old;
  end if;

  if lower(btrim(coalesce(old.status, ''))) = 'signed'
    or old.signed_at is not null
  then
    raise exception using
      errcode = '42501',
      message = 'A signed contract is an immutable record.';
  end if;

  return old;
end;
$function$;

drop trigger if exists bluedeck_guard_signed_contract_delete
  on public.yacht_contracts;
create trigger bluedeck_guard_signed_contract_delete
before delete on public.yacht_contracts
for each row
execute function private.bluedeck_guard_signed_contract_delete();

do $block$
begin
  if to_regclass('public.crew_contracts') is not null then
    execute
      'drop trigger if exists bluedeck_guard_crew_contract_update '
      'on public.crew_contracts';
    execute
      'create trigger bluedeck_guard_crew_contract_update '
      'before update on public.crew_contracts '
      'for each row execute function '
      'private.bluedeck_guard_crew_contract_update()';
    execute
      'drop trigger if exists bluedeck_guard_signed_contract_delete '
      'on public.crew_contracts';
    execute
      'create trigger bluedeck_guard_signed_contract_delete '
      'before delete on public.crew_contracts '
      'for each row execute function '
      'private.bluedeck_guard_signed_contract_delete()';
  end if;
end;
$block$;

-- PostgreSQL grants EXECUTE on new functions to PUBLIC by default. Remove that
-- implicit grant, then expose only the predicate functions needed by RLS.
revoke all on function private.bluedeck_current_email() from public;
revoke all on function private.bluedeck_is_own_crew_profile(uuid) from public;
revoke all on function private.bluedeck_is_own_membership(uuid) from public;
revoke all on function private.bluedeck_is_yacht_owner(uuid) from public;
revoke all on function private.bluedeck_is_active_yacht_member(uuid) from public;
revoke all on function private.bluedeck_has_yacht_access(uuid) from public;
revoke all on function private.bluedeck_is_yacht_manager(uuid) from public;
revoke all on function private.bluedeck_is_own_invitation(uuid) from public;
revoke all on function private.bluedeck_can_read_checklist(uuid) from public;
revoke all on function private.bluedeck_can_edit_checklist(uuid) from public;
revoke all on function private.bluedeck_can_manage_checklist(uuid) from public;
revoke all on function private.bluedeck_is_contract_party(uuid, uuid) from public;
revoke all on function private.bluedeck_guard_checklist_update() from public;
revoke all on function private.bluedeck_guard_checklist_item_update() from public;
revoke all on function private.bluedeck_guard_contract_update() from public;
revoke all on function private.bluedeck_guard_crew_contract_update() from public;
revoke all on function private.bluedeck_guard_signed_contract_delete() from public;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

grant execute on function private.bluedeck_current_email()
  to authenticated, service_role;
grant execute on function private.bluedeck_is_own_crew_profile(uuid)
  to authenticated, service_role;
grant execute on function private.bluedeck_is_own_membership(uuid)
  to authenticated, service_role;
grant execute on function private.bluedeck_is_yacht_owner(uuid)
  to authenticated, service_role;
grant execute on function private.bluedeck_is_active_yacht_member(uuid)
  to authenticated, service_role;
grant execute on function private.bluedeck_has_yacht_access(uuid)
  to authenticated, service_role;
grant execute on function private.bluedeck_is_yacht_manager(uuid)
  to authenticated, service_role;
grant execute on function private.bluedeck_is_own_invitation(uuid)
  to authenticated, service_role;
grant execute on function private.bluedeck_can_read_checklist(uuid)
  to authenticated, service_role;
grant execute on function private.bluedeck_can_edit_checklist(uuid)
  to authenticated, service_role;
grant execute on function private.bluedeck_can_manage_checklist(uuid)
  to authenticated, service_role;
grant execute on function private.bluedeck_is_contract_party(uuid, uuid)
  to authenticated, service_role;
grant execute on function private.bluedeck_guard_checklist_update()
  to service_role;
grant execute on function private.bluedeck_guard_checklist_item_update()
  to service_role;
grant execute on function private.bluedeck_guard_contract_update()
  to service_role;
grant execute on function private.bluedeck_guard_crew_contract_update()
  to service_role;
grant execute on function private.bluedeck_guard_signed_contract_delete()
  to service_role;

alter table public.profiles enable row level security;
alter table public.crew_profiles enable row level security;
alter table public.crew_documents enable row level security;
alter table public.crew_references enable row level security;
alter table public.crew_experiences enable row level security;
alter table public.crew_portfolio_photos enable row level security;
alter table public.yachts enable row level security;
alter table public.yacht_crew_memberships enable row level security;
alter table public.crew_invitations enable row level security;
alter table public.yacht_checklists enable row level security;
alter table public.yacht_checklist_items enable row level security;
alter table public.yacht_contracts enable row level security;
alter table public.yacht_documents enable row level security;
alter table public.expiry_alerts enable row level security;

do $block$
begin
  if to_regclass('public.crew_contracts') is not null then
    execute 'alter table public.crew_contracts enable row level security';
  end if;
end;
$block$;

-- Remove every legacy policy, including policies whose names differ between
-- environments, before installing the canonical set below.
do $block$
declare
  target_table text;
  policy_row record;
begin
  foreach target_table in array array[
    'profiles',
    'crew_profiles',
    'crew_documents',
    'crew_references',
    'crew_experiences',
    'crew_portfolio_photos',
    'yachts',
    'yacht_crew_memberships',
    'crew_invitations',
    'yacht_checklists',
    'yacht_checklist_items',
    'yacht_contracts',
    'yacht_documents',
    'expiry_alerts',
    'crew_contracts'
  ]
  loop
    for policy_row in
      select policyname
      from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename = target_table
    loop
      execute format(
        'drop policy if exists %I on public.%I',
        policy_row.policyname,
        target_table
      );
    end loop;
  end loop;
end;
$block$;

-- Reset direct table privileges. RLS decides rows; grants decide operations.
revoke all privileges on table
  public.profiles,
  public.crew_profiles,
  public.crew_documents,
  public.crew_references,
  public.crew_experiences,
  public.crew_portfolio_photos,
  public.yachts,
  public.yacht_crew_memberships,
  public.crew_invitations,
  public.yacht_checklists,
  public.yacht_checklist_items,
  public.yacht_contracts,
  public.yacht_documents,
  public.expiry_alerts
from public, anon, authenticated;

grant select, insert, update
  on table public.profiles, public.crew_profiles
  to authenticated;

grant select, insert, update, delete
  on table
    public.crew_documents,
    public.crew_references,
    public.crew_experiences,
    public.crew_portfolio_photos
  to authenticated;

grant select, insert, update, delete
  on table public.yachts
  to authenticated;

grant select
  on table public.yacht_crew_memberships, public.crew_invitations
  to authenticated;

grant select, insert, update, delete
  on table
    public.yacht_checklists,
    public.yacht_checklist_items,
    public.yacht_contracts,
    public.yacht_documents,
    public.expiry_alerts
  to authenticated;

grant all privileges
  on table
    public.profiles,
    public.crew_profiles,
    public.crew_documents,
    public.crew_references,
    public.crew_experiences,
    public.crew_portfolio_photos,
    public.yachts,
    public.yacht_crew_memberships,
    public.crew_invitations,
    public.yacht_checklists,
    public.yacht_checklist_items,
    public.yacht_contracts,
    public.yacht_documents,
    public.expiry_alerts
  to service_role;

do $block$
begin
  if to_regclass('public.crew_contracts') is not null then
    execute
      'revoke all privileges on table public.crew_contracts '
      'from public, anon, authenticated';
    execute
      'grant select, insert, update, delete '
      'on table public.crew_contracts to authenticated';
    execute
      'grant all privileges on table public.crew_contracts to service_role';
  end if;
end;
$block$;

-- Base and crew profiles: the authenticated account may see and maintain only
-- its own rows. A legacy unlinked crew profile may be claimed by matching the
-- confirmed account email, but the resulting row must be linked to auth.uid().
create policy bluedeck_profiles_select_own
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy bluedeck_profiles_insert_own
on public.profiles
for insert
to authenticated
with check (id = auth.uid());

create policy bluedeck_profiles_update_own
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy bluedeck_crew_profiles_select_own
on public.crew_profiles
for select
to authenticated
using (private.bluedeck_is_own_crew_profile(id));

create policy bluedeck_crew_profiles_insert_own
on public.crew_profiles
for insert
to authenticated
with check (user_id = auth.uid());

create policy bluedeck_crew_profiles_update_own
on public.crew_profiles
for update
to authenticated
using (private.bluedeck_is_own_crew_profile(id))
with check (user_id = auth.uid());

-- Supporting CV/profile records contain private identity, document and
-- reference data. They are never read directly for public crew discovery;
-- server routes expose only explicit, consent-aware allowlists.
create policy bluedeck_crew_documents_select_own
on public.crew_documents
for select
to authenticated
using (private.bluedeck_is_own_crew_profile(crew_profile_id));

create policy bluedeck_crew_documents_insert_own
on public.crew_documents
for insert
to authenticated
with check (private.bluedeck_is_own_crew_profile(crew_profile_id));

create policy bluedeck_crew_documents_update_own
on public.crew_documents
for update
to authenticated
using (private.bluedeck_is_own_crew_profile(crew_profile_id))
with check (private.bluedeck_is_own_crew_profile(crew_profile_id));

create policy bluedeck_crew_documents_delete_own
on public.crew_documents
for delete
to authenticated
using (private.bluedeck_is_own_crew_profile(crew_profile_id));

create policy bluedeck_crew_references_select_own
on public.crew_references
for select
to authenticated
using (private.bluedeck_is_own_crew_profile(crew_profile_id));

create policy bluedeck_crew_references_insert_own
on public.crew_references
for insert
to authenticated
with check (private.bluedeck_is_own_crew_profile(crew_profile_id));

create policy bluedeck_crew_references_update_own
on public.crew_references
for update
to authenticated
using (private.bluedeck_is_own_crew_profile(crew_profile_id))
with check (private.bluedeck_is_own_crew_profile(crew_profile_id));

create policy bluedeck_crew_references_delete_own
on public.crew_references
for delete
to authenticated
using (private.bluedeck_is_own_crew_profile(crew_profile_id));

create policy bluedeck_crew_experiences_select_own
on public.crew_experiences
for select
to authenticated
using (private.bluedeck_is_own_crew_profile(crew_profile_id));

create policy bluedeck_crew_experiences_insert_own
on public.crew_experiences
for insert
to authenticated
with check (private.bluedeck_is_own_crew_profile(crew_profile_id));

create policy bluedeck_crew_experiences_update_own
on public.crew_experiences
for update
to authenticated
using (private.bluedeck_is_own_crew_profile(crew_profile_id))
with check (private.bluedeck_is_own_crew_profile(crew_profile_id));

create policy bluedeck_crew_experiences_delete_own
on public.crew_experiences
for delete
to authenticated
using (private.bluedeck_is_own_crew_profile(crew_profile_id));

create policy bluedeck_crew_portfolio_photos_select_own
on public.crew_portfolio_photos
for select
to authenticated
using (private.bluedeck_is_own_crew_profile(crew_profile_id));

create policy bluedeck_crew_portfolio_photos_insert_own
on public.crew_portfolio_photos
for insert
to authenticated
with check (private.bluedeck_is_own_crew_profile(crew_profile_id));

create policy bluedeck_crew_portfolio_photos_update_own
on public.crew_portfolio_photos
for update
to authenticated
using (private.bluedeck_is_own_crew_profile(crew_profile_id))
with check (private.bluedeck_is_own_crew_profile(crew_profile_id));

create policy bluedeck_crew_portfolio_photos_delete_own
on public.crew_portfolio_photos
for delete
to authenticated
using (private.bluedeck_is_own_crew_profile(crew_profile_id));

-- Yacht metadata is visible to its owner and active crew. Only the real
-- auth.users owner may create or mutate the yacht row.
create policy bluedeck_yachts_select_authorized
on public.yachts
for select
to authenticated
using (private.bluedeck_has_yacht_access(id));

create policy bluedeck_yachts_insert_owner
on public.yachts
for insert
to authenticated
with check (owner_id = auth.uid());

create policy bluedeck_yachts_update_owner
on public.yachts
for update
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create policy bluedeck_yachts_delete_owner
on public.yachts
for delete
to authenticated
using (owner_id = auth.uid());

-- Yacht documents and expiry records can contain captain/owner-only compliance
-- material. Until an owner-approved delegation model exists, both reads and
-- lifecycle changes remain restricted to the immutable yacht owner.
create policy bluedeck_yacht_documents_select_manager
on public.yacht_documents
for select
to authenticated
using (private.bluedeck_is_yacht_manager(yacht_id));

create policy bluedeck_yacht_documents_insert_manager
on public.yacht_documents
for insert
to authenticated
with check (private.bluedeck_is_yacht_manager(yacht_id));

create policy bluedeck_yacht_documents_update_manager
on public.yacht_documents
for update
to authenticated
using (private.bluedeck_is_yacht_manager(yacht_id))
with check (private.bluedeck_is_yacht_manager(yacht_id));

create policy bluedeck_yacht_documents_delete_manager
on public.yacht_documents
for delete
to authenticated
using (private.bluedeck_is_yacht_manager(yacht_id));

create policy bluedeck_expiry_alerts_select_manager
on public.expiry_alerts
for select
to authenticated
using (private.bluedeck_is_yacht_manager(yacht_id));

create policy bluedeck_expiry_alerts_insert_manager
on public.expiry_alerts
for insert
to authenticated
with check (private.bluedeck_is_yacht_manager(yacht_id));

create policy bluedeck_expiry_alerts_update_manager
on public.expiry_alerts
for update
to authenticated
using (private.bluedeck_is_yacht_manager(yacht_id))
with check (private.bluedeck_is_yacht_manager(yacht_id));

create policy bluedeck_expiry_alerts_delete_manager
on public.expiry_alerts
for delete
to authenticated
using (private.bluedeck_is_yacht_manager(yacht_id));

-- Membership and invitation writes are intentionally absent: only service_role
-- server routes can create, accept, edit, or remove them.
create policy bluedeck_memberships_select_authorized
on public.yacht_crew_memberships
for select
to authenticated
using (
  private.bluedeck_is_yacht_manager(yacht_id)
  or private.bluedeck_is_own_membership(id)
);

create policy bluedeck_invitations_select_authorized
on public.crew_invitations
for select
to authenticated
using (
  private.bluedeck_is_yacht_manager(yacht_id)
  or private.bluedeck_is_own_invitation(id)
);

-- Every checklist read stays inside an accessible yacht. Managers can manage
-- the whole yacht; active crew can create/update only checklists assigned to
-- their own crew profile.
create policy bluedeck_checklists_select_yacht
on public.yacht_checklists
for select
to authenticated
using (private.bluedeck_has_yacht_access(yacht_id));

create policy bluedeck_checklists_insert_authorized
on public.yacht_checklists
for insert
to authenticated
with check (
  private.bluedeck_is_yacht_manager(yacht_id)
  or (
    private.bluedeck_is_active_yacht_member(yacht_id)
    and private.bluedeck_is_own_crew_profile(assigned_to)
  )
);

create policy bluedeck_checklists_update_authorized
on public.yacht_checklists
for update
to authenticated
using (
  private.bluedeck_is_yacht_manager(yacht_id)
  or (
    private.bluedeck_is_active_yacht_member(yacht_id)
    and private.bluedeck_is_own_crew_profile(assigned_to)
  )
)
with check (
  private.bluedeck_is_yacht_manager(yacht_id)
  or (
    private.bluedeck_is_active_yacht_member(yacht_id)
    and private.bluedeck_is_own_crew_profile(assigned_to)
  )
);

create policy bluedeck_checklists_delete_manager
on public.yacht_checklists
for delete
to authenticated
using (private.bluedeck_is_yacht_manager(yacht_id));

create policy bluedeck_checklist_items_select_yacht
on public.yacht_checklist_items
for select
to authenticated
using (private.bluedeck_can_read_checklist(checklist_id));

create policy bluedeck_checklist_items_insert_authorized
on public.yacht_checklist_items
for insert
to authenticated
with check (private.bluedeck_can_edit_checklist(checklist_id));

create policy bluedeck_checklist_items_update_authorized
on public.yacht_checklist_items
for update
to authenticated
using (private.bluedeck_can_edit_checklist(checklist_id))
with check (private.bluedeck_can_edit_checklist(checklist_id));

create policy bluedeck_checklist_items_delete_manager
on public.yacht_checklist_items
for delete
to authenticated
using (private.bluedeck_can_manage_checklist(checklist_id));

-- Managers own the contract lifecycle. Assigned crew may read their contract
-- and update it only through the signature-safe trigger above.
create policy bluedeck_contracts_select_authorized
on public.yacht_contracts
for select
to authenticated
using (
  private.bluedeck_is_yacht_manager(yacht_id)
  or private.bluedeck_is_contract_party(crew_profile_id, membership_id)
);

create policy bluedeck_contracts_insert_manager
on public.yacht_contracts
for insert
to authenticated
with check (private.bluedeck_is_yacht_manager(yacht_id));

create policy bluedeck_contracts_update_authorized
on public.yacht_contracts
for update
to authenticated
using (
  private.bluedeck_is_yacht_manager(yacht_id)
  or private.bluedeck_is_contract_party(crew_profile_id, membership_id)
)
with check (
  private.bluedeck_is_yacht_manager(yacht_id)
  or private.bluedeck_is_contract_party(crew_profile_id, membership_id)
);

create policy bluedeck_contracts_delete_manager
on public.yacht_contracts
for delete
to authenticated
using (private.bluedeck_is_yacht_manager(yacht_id));

do $block$
begin
  if to_regclass('public.crew_contracts') is not null then
    execute $policy$
      create policy bluedeck_crew_contracts_select_authorized
      on public.crew_contracts
      for select
      to authenticated
      using (
        private.bluedeck_is_yacht_manager(yacht_id)
        or private.bluedeck_is_own_crew_profile(crew_id)
      )
    $policy$;

    execute $policy$
      create policy bluedeck_crew_contracts_insert_manager
      on public.crew_contracts
      for insert
      to authenticated
      with check (private.bluedeck_is_yacht_manager(yacht_id))
    $policy$;

    execute $policy$
      create policy bluedeck_crew_contracts_update_authorized
      on public.crew_contracts
      for update
      to authenticated
      using (
        private.bluedeck_is_yacht_manager(yacht_id)
        or private.bluedeck_is_own_crew_profile(crew_id)
      )
      with check (
        private.bluedeck_is_yacht_manager(yacht_id)
        or private.bluedeck_is_own_crew_profile(crew_id)
      )
    $policy$;

    execute $policy$
      create policy bluedeck_crew_contracts_delete_manager
      on public.crew_contracts
      for delete
      to authenticated
      using (private.bluedeck_is_yacht_manager(yacht_id))
    $policy$;
  end if;
end;
$block$;

-- Predicate lookup indexes used by the policies above.
create index if not exists yacht_memberships_yacht_status_idx
  on public.yacht_crew_memberships (yacht_id, status);
create index if not exists yacht_memberships_profile_idx
  on public.yacht_crew_memberships (crew_profile_id)
  where crew_profile_id is not null;
create index if not exists yacht_memberships_invited_email_lower_idx
  on public.yacht_crew_memberships (lower(btrim(invited_email)))
  where invited_email is not null;
create index if not exists crew_invitations_profile_idx
  on public.crew_invitations (crew_profile_id)
  where crew_profile_id is not null;
create index if not exists crew_invitations_invited_email_lower_idx
  on public.crew_invitations (lower(btrim(invited_email)))
  where invited_email is not null;
create index if not exists yacht_checklists_yacht_idx
  on public.yacht_checklists (yacht_id);
create index if not exists yacht_checklist_items_checklist_idx
  on public.yacht_checklist_items (checklist_id);
create index if not exists yacht_contracts_membership_idx
  on public.yacht_contracts (membership_id)
  where membership_id is not null;
create index if not exists yacht_documents_yacht_idx
  on public.yacht_documents (yacht_id);
create index if not exists expiry_alerts_yacht_idx
  on public.expiry_alerts (yacht_id);
create index if not exists crew_documents_profile_idx
  on public.crew_documents (crew_profile_id);
create index if not exists crew_references_profile_idx
  on public.crew_references (crew_profile_id);
create index if not exists crew_experiences_profile_idx
  on public.crew_experiences (crew_profile_id);
create index if not exists crew_portfolio_photos_profile_idx
  on public.crew_portfolio_photos (crew_profile_id);

do $block$
begin
  if to_regclass('public.crew_contracts') is not null then
    execute
      'create index if not exists crew_contracts_yacht_idx '
      'on public.crew_contracts (yacht_id)';
    execute
      'create index if not exists crew_contracts_crew_idx '
      'on public.crew_contracts (crew_id) '
      'where crew_id is not null';
  end if;
end;
$block$;

commit;
