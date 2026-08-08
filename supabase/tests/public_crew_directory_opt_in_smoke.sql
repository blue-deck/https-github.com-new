-- Automatic public discovery is evaluated from current account state. It must
-- not depend on mutating profile preferences or on synchronization triggers.

begin;

do $test$
declare
  account_id uuid := gen_random_uuid();
  profile_id uuid := gen_random_uuid();
  page jsonb;
  original_notes text :=
    '__BLUDECK_FIND_CREW__{"discoverable":false,"availabilityStatus":"Available","preferredLocations":[],"employmentTypes":[],"contactVisibility":"hidden"}' || E'\nPRIVATE AUTOMATIC DIRECTORY NOTES';
begin
  if exists (
    select 1
    from pg_trigger
    where not tgisinternal
      and tgname in (
        'marketplace_entitlements_sync_crew_directory',
        'auth_users_sync_confirmed_crew_directory'
      )
  ) then
    raise exception 'Automatic public crew discovery must not rely on synchronization triggers.';
  end if;

  if to_regprocedure(
    'private.bluedeck_sync_crew_directory_profile(uuid)'
  ) is not null then
    raise exception 'Obsolete crew-directory synchronization function still exists.';
  end if;

  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    account_id,
    'authenticated',
    'authenticated',
    'automatic-directory-' || account_id || '@example.invalid',
    '',
    null,
    '{}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

  insert into public.marketplace_entitlements (
    user_id, account_role, entitlement_source, posting_status
  ) values (
    account_id, 'captain', 'self_service', 'enabled'
  );

  insert into public.crew_profiles (
    id, user_id, full_name, current_position, notes, status
  ) values (
    profile_id,
    account_id,
    'Automatic Directory Captain',
    'Captain',
    original_notes,
    'active'
  );

  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '', true);

  select public.bluedeck_public_crew_page(null, null, 48) into page;
  if exists (
    select 1
    from jsonb_array_elements(page -> 'rows') as row_data
    where row_data ->> 'id' = profile_id::text
  ) then
    raise exception 'An unconfirmed Captain appeared in the automatic directory.';
  end if;

  update auth.users
  set email_confirmed_at = statement_timestamp(),
      updated_at = statement_timestamp()
  where id = account_id;

  select public.bluedeck_public_crew_page(null, null, 48) into page;
  if not exists (
    select 1
    from jsonb_array_elements(page -> 'rows') as row_data
    where row_data ->> 'id' = profile_id::text
  ) or (
    select notes from public.crew_profiles where id = profile_id
  ) is distinct from original_notes
    or page::text like '%PRIVATE AUTOMATIC DIRECTORY NOTES%'
  then
    raise exception 'A newly confirmed Captain was not discovered automatically and privately.';
  end if;

  update auth.users
  set banned_until = statement_timestamp() + interval '1 day',
      updated_at = statement_timestamp()
  where id = account_id;

  select public.bluedeck_public_crew_page(null, null, 48) into page;
  if exists (
    select 1
    from jsonb_array_elements(page -> 'rows') as row_data
    where row_data ->> 'id' = profile_id::text
  ) then
    raise exception 'A banned Captain remained in the automatic directory.';
  end if;
end;
$test$;

rollback;
