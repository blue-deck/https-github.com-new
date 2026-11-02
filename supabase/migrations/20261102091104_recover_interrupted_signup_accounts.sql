-- An Auth signup commits before the HTTP route finalizes its application
-- account. A terminated request must not leave a confirmed member permanently
-- locked out. Recover only the intact, trusted rows created by that transaction;
-- never infer authority from mutable signup metadata or revive a failed account.
begin;

create or replace function public.bluedeck_recover_signup_account(
  p_user_id uuid,
  p_session_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  account_metadata jsonb;
  provisioning_state text;
  profile_role text;
  entitlement_role text;
  metadata_role text;
  metadata_account_role text;
begin
  if p_user_id is null or p_session_id is null then
    return false;
  end if;

  -- Match the parent-to-child lock order used by signup provisioning.
  select coalesce(account.raw_app_meta_data, '{}'::jsonb)
  into account_metadata
  from auth.users as account
  where account.id = p_user_id
    and account.email_confirmed_at is not null
    and account.deleted_at is null
    and (account.banned_until is null or account.banned_until <= statement_timestamp())
  for update;
  if not found then
    return false;
  end if;

  -- The API verifies the JWT first. Bind its subject/session again here, and
  -- reject signup, invitation, recovery and other proof-only Auth sessions.
  perform 1
  from auth.sessions as account_session
  where account_session.id = p_session_id
    and account_session.user_id = p_user_id
    and (account_session.not_after is null or account_session.not_after > statement_timestamp())
    and exists (
      select 1 from auth.mfa_amr_claims as amr
      where amr.session_id = account_session.id
        and amr.authentication_method = 'password'
    )
    and not exists (
      select 1 from auth.mfa_amr_claims as amr
      where amr.session_id = account_session.id
        and amr.authentication_method not in (
          'password', 'totp', 'mfa/phone', 'mfa/webauthn', 'token_refresh'
        )
    )
  for share;
  if not found then
    return false;
  end if;

  select provisioning.state into provisioning_state
  from private.bluedeck_account_provisioning as provisioning
  where provisioning.user_id = p_user_id
  for update;
  if not found or provisioning_state = 'failed' then
    return false;
  end if;
  if provisioning_state = 'ready' then
    return true;
  end if;

  if not exists (
    select 1 from private.bluedeck_legal_acceptances as acceptance
    where acceptance.user_id = p_user_id
      and acceptance.privacy_policy_version = acceptance.terms_of_use_version
      and acceptance.privacy_policy_version in ('2026-08-01', '2026-08-08')
      and acceptance.source = 'account_signup'
  ) then
    return false;
  end if;

  select lower(btrim(profile.role)) into profile_role
  from public.profiles as profile where profile.id = p_user_id
  for share;
  select entitlement.account_role into entitlement_role
  from public.marketplace_entitlements as entitlement
  where entitlement.user_id = p_user_id
  for share;
  metadata_account_role := nullif(lower(btrim(account_metadata ->> 'bluedeck_account_role')), '');
  metadata_role := nullif(lower(btrim(account_metadata ->> 'role')), '');

  -- Default signup rows are Crew. A different role can only be preserved if
  -- the protected profile and service-managed entitlement already agree.
  if profile_role is null
    or profile_role not in ('crew', 'captain', 'owner', 'management')
    or entitlement_role is distinct from profile_role
    or (metadata_account_role is not null and metadata_account_role <> profile_role)
    or (metadata_role is not null and metadata_role <> profile_role)
    or not exists (select 1 from public.crew_profiles where user_id = p_user_id)
  then
    return false;
  end if;

  update private.bluedeck_account_provisioning
  set state = 'ready', failure_code = '', updated_at = statement_timestamp()
  where user_id = p_user_id and state = 'pending';
  return found;
end;
$function$;

revoke all on function public.bluedeck_recover_signup_account(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.bluedeck_recover_signup_account(uuid, uuid)
  to service_role;

comment on function public.bluedeck_recover_signup_account(uuid, uuid) is
  'Service-only finalization of intact pending signups after verified password login; preserves trusted account roles and all profile data.';

-- Finalized signup retries are strictly idempotent.
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
  account_confirmed_at timestamptz;
  provisioning_state text;
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
    coalesce(account.raw_app_meta_data, '{}'::jsonb),
    account.email_confirmed_at
  into account_email, account_metadata, account_confirmed_at
  from auth.users as account
  where account.id = p_user_id
    and account.deleted_at is null
    and (
      account.banned_until is null
      or account.banned_until <= statement_timestamp()
    )
  for update;

  if not found or account_email is distinct from normalized_email then
    return false;
  end if;

  select provisioning.state into provisioning_state
  from private.bluedeck_account_provisioning as provisioning
  where provisioning.user_id = p_user_id
  for update;

  -- Retried signup responses may identify an existing unconfirmed user. Once
  -- finalized, return success without rewriting that member's profile or role.
  if provisioning_state = 'ready' then
    return true;
  end if;

  -- An existing confirmed member must recover through the verified password
  -- session boundary, never through another anonymous signup submission.
  if account_confirmed_at is not null
    or provisioning_state is distinct from 'pending'
    or not private.bluedeck_ensure_default_signup_account(p_user_id)
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

-- Persist the server-validated signup choice before calling Auth. The opaque
-- token carries no authority itself: only an unexpired, unconsumed private row
-- matching the new Auth email can finalize the account inside its INSERT.
create table private.bluedeck_signup_intents (
  token uuid primary key default gen_random_uuid(),
  email text not null,
  full_name text not null,
  account_role text not null check (account_role in ('crew', 'captain', 'owner', 'management')),
  position text not null,
  created_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null default statement_timestamp() + interval '15 minutes',
  consumed_user_id uuid references auth.users(id) on delete cascade,
  consumed_at timestamptz,
  constraint bluedeck_signup_intent_text_bounds check (
    email = lower(btrim(email)) and octet_length(email) between 3 and 320
    and char_length(full_name) between 1 and 120
    and octet_length(position) between 1 and 256
  ),
  constraint bluedeck_signup_intent_times check (
    expires_at > created_at and expires_at <= created_at + interval '15 minutes'
    and ((consumed_user_id is null and consumed_at is null)
      or (consumed_user_id is not null and consumed_at is not null))
  )
);
create index bluedeck_signup_intents_expiry_idx
  on private.bluedeck_signup_intents (expires_at);
create index bluedeck_signup_intents_email_idx
  on private.bluedeck_signup_intents (email) where consumed_at is null;
create index bluedeck_signup_intents_consumed_user_idx
  on private.bluedeck_signup_intents (consumed_user_id) where consumed_user_id is not null;
alter table private.bluedeck_signup_intents enable row level security;
revoke all on table private.bluedeck_signup_intents from public, anon, authenticated, service_role;

create or replace function public.bluedeck_prepare_signup_account(
  p_email text,
  p_full_name text,
  p_account_role text,
  p_position text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  normalized_email text := lower(btrim(coalesce(p_email, '')));
  normalized_name text := btrim(coalesce(p_full_name, ''));
  normalized_role text := lower(btrim(coalesce(p_account_role, '')));
  normalized_position text := btrim(coalesce(p_position, ''));
  intent_token uuid;
begin
  if octet_length(normalized_email) not between 3 and 320
    or position('@' in normalized_email) < 2
    or char_length(normalized_name) not between 1 and 120
    or normalized_role not in ('crew', 'captain', 'owner', 'management')
    or octet_length(normalized_position) not between 1 and 256
  then
    return null;
  end if;

  -- Preparing precedes Auth CAPTCHA verification. Bound the short-lived table
  -- even when a challenge is rejected; never delete or alter Auth accounts.
  perform pg_advisory_xact_lock(hashtextextended('bluedeck_signup_intents', 0));
  delete from private.bluedeck_signup_intents where expires_at <= statement_timestamp();
  if (select count(*) from private.bluedeck_signup_intents) >= 10000
    or (select count(*) from private.bluedeck_signup_intents
        where email = normalized_email and consumed_at is null) >= 6
  then
    return null;
  end if;

  insert into private.bluedeck_signup_intents(email, full_name, account_role, position)
  values (normalized_email, normalized_name, normalized_role, normalized_position)
  returning token into intent_token;
  return intent_token;
end;
$function$;

create or replace function private.bluedeck_finalize_signup_intent()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  supplied_token text := new.raw_user_meta_data ->> 'bluedeck_signup_intent';
  intent private.bluedeck_signup_intents%rowtype;
begin
  -- Direct Auth API signups have no trusted server intent and retain the safe
  -- default Crew account. Verified password login can finalize that default.
  if supplied_token is null then
    return new;
  end if;
  if supplied_token !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    raise exception using errcode = '23514', message = 'Invalid BlueDeck signup request.';
  end if;

  select * into intent from private.bluedeck_signup_intents
  where token = supplied_token::uuid
    and email = lower(btrim(coalesce(new.email, '')))
    and consumed_at is null
    and expires_at > statement_timestamp()
  for update;
  if not found or not public.bluedeck_provision_signup_account(
    new.id, intent.email, intent.full_name, intent.account_role, intent.position
  ) then
    raise exception using errcode = '23514', message = 'BlueDeck signup could not be completed.';
  end if;

  update private.bluedeck_signup_intents
  set consumed_user_id = new.id, consumed_at = statement_timestamp()
  where token = intent.token;
  return new;
end;
$function$;

create trigger bluedeck_zzzz_finalize_trusted_signup
after insert on auth.users
for each row execute function private.bluedeck_finalize_signup_intent();

revoke all on function public.bluedeck_prepare_signup_account(text,text,text,text)
  from public, anon, authenticated;
grant execute on function public.bluedeck_prepare_signup_account(text,text,text,text)
  to service_role;
revoke all on function private.bluedeck_finalize_signup_intent()
  from public, anon, authenticated, service_role;
comment on function public.bluedeck_prepare_signup_account(text,text,text,text) is
  'Stores a bounded, short-lived server-validated signup choice for atomic Auth account creation.';
comment on table private.bluedeck_signup_intents is
  'Private single-use signup intentions, expiring after 15 minutes; cleaned opportunistically on preparation.';

commit;
