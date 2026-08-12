-- Record the material change from opt-in Find Crew visibility to automatic
-- directory inclusion for active, confirmed Crew and Captain accounts. New
-- signups must accept the new policy versions; historical acceptance evidence
-- remains immutable and valid for accounts that already exist.

begin;

alter table private.bluedeck_legal_acceptances
  drop constraint if exists bluedeck_legal_acceptance_versions_check;

alter table private.bluedeck_legal_acceptances
  add constraint bluedeck_legal_acceptance_versions_check check (
    privacy_policy_version = terms_of_use_version
    and privacy_policy_version in ('2026-08-01', '2026-08-08')
  );

create or replace function private.bluedeck_validate_signup_legal_acceptance()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
declare
  acceptance jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb)
    -> 'bluedeck_legal_acceptance';
  provider text := coalesce(new.raw_app_meta_data ->> 'provider', 'email');
begin
  if current_user = 'supabase_auth_admin'
    and provider = 'email'
    and (
      jsonb_typeof(acceptance) is distinct from 'object'
      or acceptance -> 'accepted' is distinct from 'true'::jsonb
      or acceptance ->> 'privacyVersion' is distinct from '2026-08-08'
      or acceptance ->> 'termsVersion' is distinct from '2026-08-08'
    )
  then
    raise exception using
      errcode = '23514',
      message = 'Current BlueDeck legal acceptance is required.';
  end if;
  return new;
end;
$function$;

create or replace function private.bluedeck_capture_signup_legal_acceptance()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  acceptance jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb)
    -> 'bluedeck_legal_acceptance';
begin
  if jsonb_typeof(acceptance) = 'object'
    and acceptance -> 'accepted' = 'true'::jsonb
    and acceptance ->> 'privacyVersion' = '2026-08-08'
    and acceptance ->> 'termsVersion' = '2026-08-08'
  then
    insert into private.bluedeck_legal_acceptances (
      user_id,
      privacy_policy_version,
      terms_of_use_version,
      accepted_at,
      source
    )
    values (
      new.id,
      '2026-08-08',
      '2026-08-08',
      statement_timestamp(),
      'account_signup'
    )
    on conflict (
      user_id,
      privacy_policy_version,
      terms_of_use_version
    ) do nothing;
  end if;
  return new;
end;
$function$;

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
        and acceptance.privacy_policy_version = acceptance.terms_of_use_version
        and acceptance.privacy_policy_version in ('2026-08-01', '2026-08-08')
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
        and acceptance.privacy_policy_version = acceptance.terms_of_use_version
        and acceptance.privacy_policy_version in ('2026-08-01', '2026-08-08')
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

revoke all on function private.bluedeck_validate_signup_legal_acceptance()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_capture_signup_legal_acceptance()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_ensure_default_signup_account(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_provision_default_email_signup()
  from public, anon, authenticated, service_role;

comment on table private.bluedeck_legal_acceptances is
  'Immutable, server-timestamped evidence of each exact Privacy Policy and Terms of Use version accepted during account signup; historical versions are retained without fabricating renewed acceptance.';

commit;
