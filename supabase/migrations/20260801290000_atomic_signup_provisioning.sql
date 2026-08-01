-- Make every public email signup a complete, internally consistent Crew
-- account inside the auth.users transaction. The application can then promote
-- that default account to the validated requested role with one service-only,
-- idempotent database transaction.

begin;

create schema if not exists private;

create table if not exists private.bluedeck_account_provisioning (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state text not null default 'pending',
  failure_code text not null default '',
  cleanup_attempts integer not null default 0,
  cleanup_attempted_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  constraint bluedeck_account_provisioning_state_check check (
    state in ('pending', 'ready', 'failed')
  ),
  constraint bluedeck_account_provisioning_failure_check check (
    (state = 'failed' and failure_code ~ '^[a-z0-9_]{1,64}$')
    or (state <> 'failed' and failure_code = '')
  ),
  constraint bluedeck_account_provisioning_time_check check (
    created_at <= updated_at
    and cleanup_attempts between 0 and 1000
    and (
      cleanup_attempted_at is null
      or created_at <= cleanup_attempted_at
    )
  )
);

alter table private.bluedeck_account_provisioning enable row level security;
revoke all on table private.bluedeck_account_provisioning
  from public, anon, authenticated, service_role;

create or replace function private.bluedeck_ensure_default_signup_account(
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  account_email text;
  account_name text;
begin
  if p_user_id is null then
    return false;
  end if;

  select
    lower(btrim(coalesce(account.email, ''))),
    left(btrim(coalesce(account.raw_user_meta_data ->> 'full_name', '')), 120)
  into account_email, account_name
  from auth.users as account
  where account.id = p_user_id
    and account.deleted_at is null
  for update;

  if not found
    or account_email = ''
    or octet_length(account_email) > 320
    or not exists (
      select 1
      from private.bluedeck_legal_acceptances as acceptance
      where acceptance.user_id = p_user_id
        and acceptance.privacy_policy_version = '2026-08-01'
        and acceptance.terms_of_use_version = '2026-08-01'
    )
  then
    return false;
  end if;

  insert into private.bluedeck_account_provisioning (
    user_id,
    state,
    failure_code
  ) values (
    p_user_id,
    'pending',
    ''
  )
  on conflict (user_id) do nothing;

  insert into public.profiles (id, email, full_name, role)
  values (
    p_user_id,
    account_email,
    nullif(account_name, ''),
    'crew'
  )
  on conflict (id) do nothing;

  if not exists (
    select 1
    from public.profiles as profile
    where profile.id = p_user_id
      and lower(btrim(coalesce(profile.role, 'crew'))) in (
        'crew',
        'captain',
        'owner',
        'management'
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'The signup base profile has an invalid account role.';
  end if;

  insert into public.crew_profiles (
    user_id,
    email,
    full_name,
    current_positions
  )
  values (
    p_user_id,
    account_email,
    nullif(account_name, ''),
    '{}'::text[]
  )
  on conflict (user_id) where user_id is not null do nothing;

  if not exists (
    select 1
    from public.crew_profiles as profile
    where profile.user_id = p_user_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'The signup crew profile could not be provisioned.';
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
    'crew',
    'free',
    'self_service',
    'enabled'
  )
  on conflict (user_id) do nothing;

  if not exists (
    select 1
    from public.marketplace_entitlements as entitlement
    where entitlement.user_id = p_user_id
      and entitlement.account_role in (
        'crew',
        'captain',
        'owner',
        'management'
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'The signup marketplace entitlement could not be provisioned.';
  end if;

  return true;
end;
$function$;

create or replace function private.bluedeck_provision_default_email_signup()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  provider text := lower(
    btrim(coalesce(new.raw_app_meta_data ->> 'provider', 'email'))
  );
begin
  if provider = 'email'
    and exists (
      select 1
      from private.bluedeck_legal_acceptances as acceptance
      where acceptance.user_id = new.id
        and acceptance.privacy_policy_version = '2026-08-01'
        and acceptance.terms_of_use_version = '2026-08-01'
    )
    and not private.bluedeck_ensure_default_signup_account(new.id)
  then
    raise exception using
      errcode = '23514',
      message = 'BlueDeck signup provisioning failed closed.';
  end if;

  return new;
end;
$function$;

drop trigger if exists bluedeck_zzz_provision_default_email_signup
  on auth.users;
create trigger bluedeck_zzz_provision_default_email_signup
after insert on auth.users
for each row execute function private.bluedeck_provision_default_email_signup();

create or replace function public.bluedeck_provision_signup_account(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_account_role text,
  p_position text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  normalized_email text := lower(btrim(coalesce(p_email, '')));
  normalized_name text := btrim(coalesce(p_full_name, ''));
  normalized_role text := lower(btrim(coalesce(p_account_role, '')));
  normalized_position text := btrim(coalesce(p_position, ''));
  account_metadata jsonb;
  account_email text;
begin
  if p_user_id is null
    or normalized_email = ''
    or octet_length(normalized_email) > 320
    or normalized_name = ''
    or octet_length(normalized_name) > 512
    or normalized_role not in ('crew', 'captain', 'owner', 'management')
    or normalized_position = ''
    or octet_length(normalized_position) > 256
  then
    return false;
  end if;

  select
    lower(btrim(coalesce(account.email, ''))),
    coalesce(account.raw_app_meta_data, '{}'::jsonb)
  into account_email, account_metadata
  from auth.users as account
  where account.id = p_user_id
    and account.deleted_at is null
    and (
      account.banned_until is null
      or account.banned_until <= statement_timestamp()
    )
  for update;

  if not found
    or account_email is distinct from normalized_email
    or not private.bluedeck_ensure_default_signup_account(p_user_id)
    or not exists (
      select 1
      from private.bluedeck_account_provisioning as provisioning
      where provisioning.user_id = p_user_id
        and provisioning.state in ('pending', 'ready')
    )
  then
    return false;
  end if;

  if exists (
    select 1
    from public.marketplace_entitlements as entitlement
    where entitlement.user_id = p_user_id
      and entitlement.entitlement_source <> 'self_service'
      and entitlement.account_role is distinct from normalized_role
  ) then
    return false;
  end if;

  update auth.users as account
  set
    raw_app_meta_data = account_metadata || jsonb_build_object(
      'role', normalized_role,
      'position', normalized_position,
      'bluedeck_account_role', normalized_role,
      'bluedeck_signup_position', normalized_position
    ),
    updated_at = statement_timestamp()
  where account.id = p_user_id;

  update public.profiles as profile
  set
    email = normalized_email,
    full_name = normalized_name,
    role = normalized_role
  where profile.id = p_user_id;

  update public.crew_profiles as profile
  set
    email = normalized_email,
    full_name = normalized_name,
    current_position = normalized_position,
    current_positions = array[normalized_position]::text[]
  where profile.user_id = p_user_id;

  update public.marketplace_entitlements as entitlement
  set account_role = normalized_role
  where entitlement.user_id = p_user_id;

  if not found then
    raise exception using
      errcode = '23514',
      message = 'The signup entitlement disappeared during provisioning.';
  end if;

  update private.bluedeck_account_provisioning as provisioning
  set
    state = 'ready',
    failure_code = '',
    updated_at = statement_timestamp()
  where provisioning.user_id = p_user_id
    and provisioning.state in ('pending', 'ready');

  if not found then
    raise exception using
      errcode = '23514',
      message = 'The signup provisioning state could not be finalized.';
  end if;

  return true;
end;
$function$;

create or replace function public.bluedeck_fail_signup_provisioning(
  p_user_id uuid,
  p_failure_code text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  normalized_failure text := lower(btrim(coalesce(p_failure_code, '')));
  affected integer;
begin
  if p_user_id is null or normalized_failure !~ '^[a-z0-9_]{1,64}$' then
    return false;
  end if;

  update private.bluedeck_account_provisioning as provisioning
  set
    state = 'failed',
    failure_code = normalized_failure,
    updated_at = statement_timestamp()
  where provisioning.user_id = p_user_id
    and provisioning.state <> 'ready';

  get diagnostics affected = row_count;
  if affected <> 1 then
    return false;
  end if;

  update auth.users as account
  set
    banned_until = statement_timestamp() + interval '100 years',
    updated_at = statement_timestamp()
  where account.id = p_user_id;

  return found;
end;
$function$;

create or replace function public.bluedeck_account_is_ready(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $function$
  select
    p_user_id is not null
    and exists (
      select 1
      from auth.users as account
      where account.id = p_user_id
        and account.email_confirmed_at is not null
        and account.deleted_at is null
        and (
          account.banned_until is null
          or account.banned_until <= statement_timestamp()
        )
    )
    and not exists (
      select 1
      from private.bluedeck_account_provisioning as provisioning
      where provisioning.user_id = p_user_id
        and provisioning.state <> 'ready'
    );
$function$;

create or replace function private.bluedeck_has_live_authenticated_session()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select
    coalesce(auth.jwt() ->> 'session_id', '') <> ''
    and not (
      coalesce(auth.jwt() -> 'amr', '[]'::jsonb)
        @> '[{"method":"recovery"}]'::jsonb
    )
    and exists (
      select 1
      from auth.sessions as account_session
      where account_session.id::text = auth.jwt() ->> 'session_id'
        and account_session.user_id = auth.uid()
        and (
          account_session.not_after is null
          or account_session.not_after > statement_timestamp()
        )
    );
$function$;

create or replace function private.bluedeck_is_active_account()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $function$
  select
    auth.uid() is not null
    and public.bluedeck_account_is_ready(auth.uid())
    and private.bluedeck_has_live_authenticated_session();
$function$;

create or replace function private.bluedeck_current_email()
returns text
language sql
stable
security definer
set search_path = pg_catalog, private
as $function$
  select coalesce((
    select lower(btrim(account.email))
    from auth.users as account
    where account.id = auth.uid()
      and private.bluedeck_is_active_account()
  ), '');
$function$;

revoke all on function private.bluedeck_ensure_default_signup_account(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_provision_default_email_signup()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_has_live_authenticated_session()
  from public, anon, authenticated, service_role;
revoke all on function public.bluedeck_provision_signup_account(
  uuid, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.bluedeck_provision_signup_account(
  uuid, text, text, text, text
) to service_role;
revoke all on function public.bluedeck_fail_signup_provisioning(uuid, text)
  from public, anon, authenticated;
grant execute on function public.bluedeck_fail_signup_provisioning(uuid, text)
  to service_role;
revoke all on function public.bluedeck_account_is_ready(uuid)
  from public, anon, authenticated;
grant execute on function public.bluedeck_account_is_ready(uuid)
  to service_role;

comment on function public.bluedeck_provision_signup_account(
  uuid, text, text, text, text
) is
  'Atomically and idempotently applies the server-validated BlueDeck signup identity, role, position and marketplace entitlement.';

comment on table private.bluedeck_account_provisioning is
  'Fail-closed signup state. New public email accounts remain pending until the trusted application transaction marks them ready; failed cleanup is quarantined.';

comment on function private.bluedeck_has_live_authenticated_session() is
  'Rejects revoked, expired and recovery-only JWT sessions before ordinary application RLS grants authority.';

commit;
