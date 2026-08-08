-- Authorization is bound only to an active Auth UUID. Mutable profile or
-- invitation emails are never identity, and disabled JWTs fail closed at the
-- database/storage boundary even before their token naturally expires.

begin;

create schema if not exists private;

create or replace function private.bluedeck_is_active_account()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select
    auth.uid() is not null
    and exists (
      select 1
      from auth.users as account
      where account.id = auth.uid()
        and account.email_confirmed_at is not null
        and account.deleted_at is null
        and (
          account.banned_until is null
          or account.banned_until <= statement_timestamp()
        )
    );
$function$;

create or replace function private.bluedeck_current_email()
returns text
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select coalesce((
    select lower(btrim(account.email))
    from auth.users as account
    where account.id = auth.uid()
      and account.email_confirmed_at is not null
      and account.deleted_at is null
      and (
        account.banned_until is null
        or account.banned_until <= statement_timestamp()
      )
  ), '');
$function$;

create or replace function private.bluedeck_is_own_crew_profile(
  target_crew_profile_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
  select
    private.bluedeck_is_active_account()
    and target_crew_profile_id is not null
    and exists (
      select 1
      from public.crew_profiles as profile
      where profile.id = target_crew_profile_id
        and profile.user_id = auth.uid()
    );
$function$;

create or replace function private.bluedeck_is_own_membership(
  target_membership_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
  select
    private.bluedeck_is_active_account()
    and target_membership_id is not null
    and exists (
      select 1
      from public.yacht_crew_memberships as membership
      inner join public.crew_profiles as profile
        on profile.id = membership.crew_profile_id
       and profile.user_id = auth.uid()
      where membership.id = target_membership_id
    );
$function$;

create or replace function private.bluedeck_is_yacht_owner(
  target_yacht_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
  select
    private.bluedeck_is_active_account()
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
set search_path = pg_catalog, public, private
as $function$
  select
    private.bluedeck_is_active_account()
    and target_yacht_id is not null
    and exists (
      select 1
      from public.yacht_crew_memberships as membership
      inner join public.crew_profiles as profile
        on profile.id = membership.crew_profile_id
       and profile.user_id = auth.uid()
      where membership.yacht_id = target_yacht_id
        and lower(btrim(coalesce(membership.status, ''))) = 'active'
    );
$function$;

create or replace function private.bluedeck_has_yacht_access(
  target_yacht_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
  select
    private.bluedeck_is_yacht_owner(target_yacht_id)
    or private.bluedeck_is_active_yacht_member(target_yacht_id);
$function$;

create or replace function private.bluedeck_is_yacht_manager(
  target_yacht_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
  select private.bluedeck_is_yacht_owner(target_yacht_id);
$function$;

create or replace function private.bluedeck_has_crew_career_access()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
  select
    private.bluedeck_is_active_account()
    and exists (
      select 1
      from public.marketplace_entitlements as entitlement
      where entitlement.user_id = auth.uid()
        and entitlement.account_role in ('crew', 'captain')
    );
$function$;

create or replace function private.bluedeck_is_own_invitation(
  target_invitation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
  select
    private.bluedeck_is_active_account()
    and target_invitation_id is not null
    and exists (
      select 1
      from public.crew_invitations as invitation
      inner join private.crew_invitation_targets as target
        on target.invitation_id = invitation.id
       and target.target_user_id = auth.uid()
      left join public.crew_profiles as profile
        on profile.id = invitation.crew_profile_id
      where invitation.id = target_invitation_id
        and (
          invitation.identity_mode = 'email'
          or (
            invitation.identity_mode = 'crew_id'
            and profile.user_id = auth.uid()
          )
        )
    );
$function$;

create or replace function private.bluedeck_owns_crew_profile_storage_path(
  object_name text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
  select
    private.bluedeck_is_active_account()
    and object_name is not null
    and exists (
      select 1
      from public.crew_profiles as profile
      where profile.user_id = auth.uid()
        and object_name like profile.id::text || '/%'
    );
$function$;

create table if not exists private.membership_authority_quarantine (
  membership_id uuid primary key,
  yacht_id uuid,
  crew_profile_id uuid,
  prior_status text not null,
  reason text not null,
  quarantined_at timestamptz not null default statement_timestamp(),
  check (octet_length(prior_status) <= 32),
  check (octet_length(reason) <= 160)
);

create or replace function private.bluedeck_guard_active_membership_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  profile_user_id uuid;
  account_is_active boolean := false;
begin
  if lower(btrim(coalesce(new.status, ''))) <> 'active' then
    return new;
  end if;

  select profile.user_id
  into profile_user_id
  from public.crew_profiles as profile
  where profile.id = new.crew_profile_id
  for share nowait;

  if profile_user_id is not null then
    select true
    into account_is_active
    from auth.users as account
    where account.id = profile_user_id
      and account.email_confirmed_at is not null
      and account.deleted_at is null
      and (
        account.banned_until is null
        or account.banned_until <= statement_timestamp()
      )
    for share nowait;
  end if;

  if profile_user_id is null or not account_is_active then
    raise exception using
      errcode = '23514',
      message = 'Active yacht membership requires an active linked account.';
  end if;

  return new;
exception
  when lock_not_available then
    raise exception using
      errcode = '40001',
      message = 'Membership identity changed concurrently; retry the request.';
end;
$function$;

-- Install all runtime guards while account/profile/membership writes are held.
-- This removes the rollout window in which an activation could race the final
-- quarantine sweep. The explicit order is shared by every deployment run.
lock table auth.users in share row exclusive mode;
lock table public.crew_profiles in share row exclusive mode;
lock table public.yacht_crew_memberships in share row exclusive mode;

drop trigger if exists yacht_membership_00_active_identity
  on public.yacht_crew_memberships;
create trigger yacht_membership_00_active_identity
before insert or update of crew_profile_id, status
on public.yacht_crew_memberships
for each row execute function private.bluedeck_guard_active_membership_identity();

create or replace function private.bluedeck_suspend_memberships_on_account_loss()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  account_disabled boolean;
begin
  if tg_op = 'DELETE' then
    account_disabled := true;
  else
    account_disabled :=
      new.email_confirmed_at is null
      or new.deleted_at is not null
      or (
        new.banned_until is not null
        and new.banned_until > statement_timestamp()
      );
  end if;

  if account_disabled then
    insert into private.membership_authority_quarantine (
      membership_id,
      yacht_id,
      crew_profile_id,
      prior_status,
      reason
    )
    select
      membership.id,
      membership.yacht_id,
      membership.crew_profile_id,
      left(coalesce(membership.status, ''), 8),
      'active_membership_account_disabled'
    from public.yacht_crew_memberships as membership
    inner join public.crew_profiles as profile
      on profile.id = membership.crew_profile_id
     and profile.user_id = old.id
    where lower(btrim(coalesce(membership.status, ''))) = 'active'
    on conflict (membership_id) do nothing;

    update public.yacht_crew_memberships as membership
    set status = 'inactive'
    from public.crew_profiles as profile
    where profile.id = membership.crew_profile_id
      and profile.user_id = old.id
      and lower(btrim(coalesce(membership.status, ''))) = 'active';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

drop trigger if exists auth_users_00_suspend_yacht_memberships
  on auth.users;
create trigger auth_users_00_suspend_yacht_memberships
before update of email_confirmed_at, deleted_at, banned_until or delete
on auth.users
for each row execute function private.bluedeck_suspend_memberships_on_account_loss();

create or replace function private.bluedeck_suspend_memberships_on_profile_identity_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  if tg_op = 'DELETE' then
    null;
  elsif old.user_id is not distinct from new.user_id then
    return new;
  end if;

    insert into private.membership_authority_quarantine (
      membership_id,
      yacht_id,
      crew_profile_id,
      prior_status,
      reason
    )
    select
      membership.id,
      membership.yacht_id,
      membership.crew_profile_id,
      left(coalesce(membership.status, ''), 8),
      'active_membership_profile_identity_changed'
    from public.yacht_crew_memberships as membership
    where membership.crew_profile_id = old.id
      and lower(btrim(coalesce(membership.status, ''))) = 'active'
    on conflict (membership_id) do nothing;

    update public.yacht_crew_memberships as membership
    set status = 'inactive'
    where membership.crew_profile_id = old.id
      and lower(btrim(coalesce(membership.status, ''))) = 'active';

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

drop trigger if exists crew_profiles_00_suspend_yacht_memberships
  on public.crew_profiles;
create trigger crew_profiles_00_suspend_yacht_memberships
before update of user_id or delete
on public.crew_profiles
for each row execute function private.bluedeck_suspend_memberships_on_profile_identity_change();

-- Final, serialized cleanup after every guard is live. Preserve only a bounded
-- pseudonymous status sample in the private audit table.
insert into private.membership_authority_quarantine (
  membership_id,
  yacht_id,
  crew_profile_id,
  prior_status,
  reason
)
select
  membership.id,
  membership.yacht_id,
  membership.crew_profile_id,
  left(coalesce(membership.status, ''), 8),
  case
    when profile.user_id is null then 'active_membership_without_auth_user'
    else 'active_membership_with_inactive_auth_user'
  end
from public.yacht_crew_memberships as membership
left join public.crew_profiles as profile
  on profile.id = membership.crew_profile_id
left join auth.users as account
  on account.id = profile.user_id
where lower(btrim(coalesce(membership.status, ''))) = 'active'
  and (
    profile.user_id is null
    or account.id is null
    or account.email_confirmed_at is null
    or account.deleted_at is not null
    or (
      account.banned_until is not null
      and account.banned_until > statement_timestamp()
    )
  )
on conflict (membership_id) do nothing;

update public.yacht_crew_memberships as membership
set status = 'inactive'
where lower(btrim(coalesce(membership.status, ''))) = 'active'
  and not exists (
    select 1
    from public.crew_profiles as profile
    inner join auth.users as account
      on account.id = profile.user_id
     and account.email_confirmed_at is not null
     and account.deleted_at is null
     and (
       account.banned_until is null
       or account.banned_until <= statement_timestamp()
     )
    where profile.id = membership.crew_profile_id
  );

do $invariant$
begin
  if exists (
    select 1
    from public.yacht_crew_memberships as membership
    left join public.crew_profiles as profile
      on profile.id = membership.crew_profile_id
    left join auth.users as account
      on account.id = profile.user_id
    where lower(btrim(coalesce(membership.status, ''))) = 'active'
      and (
        profile.user_id is null
        or account.id is null
        or account.email_confirmed_at is null
        or account.deleted_at is not null
        or (
          account.banned_until is not null
          and account.banned_until > statement_timestamp()
        )
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'Inactive account retained an active membership after quarantine.';
  end if;
end;
$invariant$;

-- Base profile and yacht writes previously compared only a JWT UUID. Gate the
-- direct table path with the canonical active-account check as well.
drop policy if exists bluedeck_profiles_select_own on public.profiles;
create policy bluedeck_profiles_select_own
on public.profiles for select to authenticated
using (private.bluedeck_is_active_account() and id = auth.uid());

drop policy if exists bluedeck_profiles_insert_own on public.profiles;
create policy bluedeck_profiles_insert_own
on public.profiles for insert to authenticated
with check (private.bluedeck_is_active_account() and id = auth.uid());

drop policy if exists bluedeck_profiles_update_own on public.profiles;
create policy bluedeck_profiles_update_own
on public.profiles for update to authenticated
using (private.bluedeck_is_active_account() and id = auth.uid())
with check (private.bluedeck_is_active_account() and id = auth.uid());

drop policy if exists bluedeck_yachts_insert_owner on public.yachts;
create policy bluedeck_yachts_insert_owner
on public.yachts for insert to authenticated
with check (
  private.bluedeck_is_active_account()
  and owner_id = auth.uid()
);

drop policy if exists bluedeck_yachts_update_owner on public.yachts;
create policy bluedeck_yachts_update_owner
on public.yachts for update to authenticated
using (private.bluedeck_is_yacht_owner(id))
with check (
  private.bluedeck_is_active_account()
  and owner_id = auth.uid()
);

drop policy if exists bluedeck_yachts_delete_owner on public.yachts;
create policy bluedeck_yachts_delete_owner
on public.yachts for delete to authenticated
using (private.bluedeck_is_yacht_owner(id));

drop policy if exists "Users read own employer access"
  on public.employer_access;
create policy "Users read own employer access"
on public.employer_access for select to authenticated
using (
  private.bluedeck_is_active_account()
  and auth.uid() = user_id
);

-- Preserve the immutable application-media lock while gating every direct
-- portfolio object path, including dashboard avatars, on an active account.
-- Repeat the private-bucket boundary here so this migration also repairs
-- policy/bucket drift instead of relying exclusively on the earlier rollout.
insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'crew-portfolio',
  'crew-portfolio',
  false,
  10485760,
  array[
    'image/avif',
    'image/gif',
    'image/jpeg',
    'image/png',
    'image/webp'
  ]::text[]
)
on conflict (id) do update
set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public crew media read" on storage.objects;
drop policy if exists "Crew portfolio owner read" on storage.objects;
create policy "Crew portfolio owner read"
on storage.objects for select to authenticated
using (
  bucket_id = 'crew-portfolio'
  and private.bluedeck_is_active_account()
  and (
    (
      private.bluedeck_has_crew_career_access()
      and (
        name like (auth.uid()::text || '/%')
        or private.bluedeck_owns_crew_profile_storage_path(name)
      )
    )
    or name like (auth.uid()::text || '/dashboard-%')
  )
);

drop policy if exists "Authenticated crew portfolio uploads"
  on storage.objects;
create policy "Authenticated crew portfolio uploads"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'crew-portfolio'
  and private.bluedeck_is_active_account()
  and not public.bluedeck_job_application_media_path_locked(name)
  and (
    (
      private.bluedeck_has_crew_career_access()
      and (
        name like (auth.uid()::text || '/%')
        or private.bluedeck_owns_crew_profile_storage_path(name)
      )
    )
    or name like (auth.uid()::text || '/dashboard-%')
  )
);

drop policy if exists "Authenticated crew portfolio deletes"
  on storage.objects;
create policy "Authenticated crew portfolio deletes"
on storage.objects for delete to authenticated
using (
  bucket_id = 'crew-portfolio'
  and private.bluedeck_is_active_account()
  and not public.bluedeck_job_application_media_path_locked(name)
  and (
    (
      private.bluedeck_has_crew_career_access()
      and (
        name like (auth.uid()::text || '/%')
        or private.bluedeck_owns_crew_profile_storage_path(name)
      )
    )
    or name like (auth.uid()::text || '/dashboard-%')
  )
);

revoke all privileges on table private.membership_authority_quarantine
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_is_active_account()
  from public, anon, authenticated, service_role;
grant execute on function private.bluedeck_is_active_account()
  to authenticated, service_role;
revoke all on function private.bluedeck_guard_active_membership_identity()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_suspend_memberships_on_account_loss()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_suspend_memberships_on_profile_identity_change()
  from public, anon, authenticated, service_role;

comment on function private.bluedeck_is_active_account() is
  'True only for the current confirmed, non-deleted and non-banned Auth UUID.';
comment on table private.membership_authority_quarantine is
  'Pseudonymous audit of legacy active memberships disabled because no active immutable Auth owner existed.';

commit;
