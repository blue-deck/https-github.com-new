begin;

do $test$
declare
  automatic_user uuid := gen_random_uuid();
  hidden_preference_user uuid := gen_random_uuid();
  owner_user uuid := gen_random_uuid();
  unconfirmed_user uuid := gen_random_uuid();
  banned_user uuid := gen_random_uuid();
  deleted_user uuid := gen_random_uuid();
  inactive_profile_user uuid := gen_random_uuid();
  automatic_profile uuid := gen_random_uuid();
  hidden_preference_profile uuid := gen_random_uuid();
  owner_profile uuid := gen_random_uuid();
  unconfirmed_profile uuid := gen_random_uuid();
  banned_profile uuid := gen_random_uuid();
  deleted_profile uuid := gen_random_uuid();
  inactive_profile uuid := gen_random_uuid();
  page jsonb;
  automatic_crew_id text;
  hidden_preference_crew_id text;
  automatic_notes_projection text;
  hidden_notes_projection text;
  page_index_predicate text;
  crew_id_mutation_rejected boolean := false;
begin
  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    deleted_at, banned_until, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  )
  values
    (
      automatic_user, 'authenticated', 'authenticated',
      'directory-automatic-' || automatic_user || '@example.invalid', '', now(),
      null, null, '{}'::jsonb, '{}'::jsonb, now(), now()
    ),
    (
      hidden_preference_user, 'authenticated', 'authenticated',
      'directory-hidden-pref-' || hidden_preference_user || '@example.invalid', '', now(),
      null, null, '{}'::jsonb, '{}'::jsonb, now(), now()
    ),
    (
      owner_user, 'authenticated', 'authenticated',
      'directory-owner-' || owner_user || '@example.invalid', '', now(),
      null, null, '{}'::jsonb, '{}'::jsonb, now(), now()
    ),
    (
      unconfirmed_user, 'authenticated', 'authenticated',
      'directory-unconfirmed-' || unconfirmed_user || '@example.invalid', '', null,
      null, null, '{}'::jsonb, '{}'::jsonb, now(), now()
    ),
    (
      banned_user, 'authenticated', 'authenticated',
      'directory-banned-' || banned_user || '@example.invalid', '', now(),
      null, now() + interval '1 day', '{}'::jsonb, '{}'::jsonb, now(), now()
    ),
    (
      deleted_user, 'authenticated', 'authenticated',
      'directory-deleted-' || deleted_user || '@example.invalid', '', now(),
      now(), null, '{}'::jsonb, '{}'::jsonb, now(), now()
    ),
    (
      inactive_profile_user, 'authenticated', 'authenticated',
      'directory-inactive-profile-' || inactive_profile_user || '@example.invalid', '', now(),
      null, null, '{}'::jsonb, '{}'::jsonb, now(), now()
    );

  insert into public.marketplace_entitlements (
    user_id, account_role, entitlement_source, posting_status
  )
  values
    (automatic_user, 'crew', 'self_service', 'enabled'),
    (hidden_preference_user, 'captain', 'self_service', 'enabled'),
    (owner_user, 'owner', 'self_service', 'enabled'),
    (unconfirmed_user, 'crew', 'self_service', 'enabled'),
    (banned_user, 'captain', 'self_service', 'enabled'),
    (deleted_user, 'crew', 'self_service', 'enabled'),
    (inactive_profile_user, 'crew', 'self_service', 'enabled');

  insert into public.crew_profiles (
    id, user_id, public_crew_id, full_name, email, phone, current_position,
    personal_skills, bio, notes, status
  )
  values
    (
      automatic_profile, automatic_user,
      'AUTOMATIC-' || left(automatic_user::text, 8),
      'Automatic Candidate', 'private-automatic@example.invalid', '+44111111111',
      'Deckhand', array['Tender driving'], 'PRIVATE AUTOMATIC BIOGRAPHY',
      'PRIVATE AUTOMATIC NOTES', 'active'
    ),
    (
      hidden_preference_profile, hidden_preference_user,
      'HIDDEN-' || left(hidden_preference_user::text, 8),
      'Hidden Preference Captain', 'private-captain@example.invalid', '+44222222222',
      'Captain', array['Navigation'], 'PRIVATE CAPTAIN BIOGRAPHY',
      '__BLUDECK_FIND_CREW__{"discoverable":false,"availabilityStatus":"Available","preferredLocations":[],"employmentTypes":[],"contactVisibility":"hidden"}' || E'\nPRIVATE CAPTAIN NOTES',
      'active'
    ),
    (
      owner_profile, owner_user, 'OWNER-' || left(owner_user::text, 8),
      'Excluded Owner', null, null, 'Owner', '{}', '',
      '__BLUDECK_FIND_CREW__{"discoverable":true}', 'active'
    ),
    (
      unconfirmed_profile, unconfirmed_user,
      'UNCONFIRMED-' || left(unconfirmed_user::text, 8),
      'Excluded Unconfirmed Crew', null, null, 'Deckhand', '{}', '', '', 'active'
    ),
    (
      banned_profile, banned_user, 'BANNED-' || left(banned_user::text, 8),
      'Excluded Banned Captain', null, null, 'Captain', '{}', '', '', 'active'
    ),
    (
      deleted_profile, deleted_user, 'DELETED-' || left(deleted_user::text, 8),
      'Excluded Deleted Crew', null, null, 'Deckhand', '{}', '', '', 'active'
    ),
    (
      inactive_profile, inactive_profile_user,
      'INACTIVE-' || left(inactive_profile_user::text, 8),
      'Excluded Inactive Profile', null, null, 'Deckhand', '{}', '', '', 'inactive'
    );

  select public_crew_id into automatic_crew_id
  from public.crew_profiles where id = automatic_profile;
  select public_crew_id into hidden_preference_crew_id
  from public.crew_profiles where id = hidden_preference_profile;

  if automatic_crew_id = hidden_preference_crew_id
    or automatic_crew_id !~ '^[A-F0-9]{8}$'
    or hidden_preference_crew_id !~ '^[A-F0-9]{8}$'
    or automatic_crew_id = upper(left(replace(automatic_user::text, '-', ''), 8))
    or automatic_crew_id = upper(left(replace(automatic_profile::text, '-', ''), 8))
    or hidden_preference_crew_id = upper(left(replace(hidden_preference_user::text, '-', ''), 8))
    or hidden_preference_crew_id = upper(left(replace(hidden_preference_profile::text, '-', ''), 8))
  then
    raise exception 'Public Crew IDs are not opaque and collision-resistant.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_attribute as attribute
    where attribute.attrelid = 'public.crew_profiles'::regclass
      and attribute.attname = 'public_crew_id'
      and attribute.attnotnull
      and not attribute.attisdropped
  ) or not exists (
    select 1
    from pg_catalog.pg_trigger as trigger_row
    where trigger_row.tgrelid = 'public.crew_profiles'::regclass
      and trigger_row.tgname = 'crew_profiles_00_guard_public_crew_id'
      and trigger_row.tgenabled = 'O'
      and not trigger_row.tgisinternal
  ) then
    raise exception 'Automatic public Crew ID enforcement is not active.';
  end if;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', hidden_preference_user::text, true);
  begin
    update public.crew_profiles
    set public_crew_id = lower(automatic_crew_id)
    where id = hidden_preference_profile;
  exception
    when insufficient_privilege or unique_violation then
      crew_id_mutation_rejected := true;
  end;
  if not crew_id_mutation_rejected then
    raise exception 'A crew account mutated its stable public Crew ID.';
  end if;
  perform set_config('request.jwt.claim.role', 'service_role', true);
  perform set_config('request.jwt.claim.sub', '', true);

  select public.bluedeck_public_crew_page(null, null, 48) into page;

  select row_data ->> 'notes' into automatic_notes_projection
  from jsonb_array_elements(page -> 'rows') as row_data
  where row_data ->> 'id' = automatic_profile::text;

  select row_data ->> 'notes' into hidden_notes_projection
  from jsonb_array_elements(page -> 'rows') as row_data
  where row_data ->> 'id' = hidden_preference_profile::text;

  if jsonb_array_length(page -> 'rows') > 48
    or not exists (
      select 1
      from jsonb_array_elements(page -> 'rows') as row_data
      where row_data ->> 'id' = automatic_profile::text
    )
    or not exists (
      select 1
      from jsonb_array_elements(page -> 'rows') as row_data
      where row_data ->> 'id' = hidden_preference_profile::text
    )
    or exists (
      select 1
      from jsonb_array_elements(page -> 'rows') as row_data
      where row_data ->> 'id' in (
        owner_profile::text,
        unconfirmed_profile::text,
        banned_profile::text,
        deleted_profile::text,
        inactive_profile::text
      )
    )
    or automatic_notes_projection is distinct from ''
    or hidden_notes_projection not like '__BLUDECK_FIND_CREW__%'
    or hidden_notes_projection like '%PRIVATE CAPTAIN NOTES%'
    or page::text like '%PRIVATE AUTOMATIC NOTES%'
    or page::text like '%PRIVATE AUTOMATIC BIOGRAPHY%'
    or page::text like '%PRIVATE CAPTAIN BIOGRAPHY%'
    or page::text like '%private-automatic@example.invalid%'
    or page::text like '%private-captain@example.invalid%'
    or page::text like '%+44111111111%'
    or page::text like '%+44222222222%'
  then
    raise exception 'Automatic bounded crew projection leaked or omitted a profile.';
  end if;

  select pg_get_expr(index_row.indpred, index_row.indrelid)
  into page_index_predicate
  from pg_catalog.pg_index as index_row
  inner join pg_catalog.pg_class as index_class
    on index_class.oid = index_row.indexrelid
  inner join pg_catalog.pg_namespace as index_namespace
    on index_namespace.oid = index_class.relnamespace
  where index_namespace.nspname = 'public'
    and index_class.relname = 'crew_profiles_public_directory_page_idx';

  if page_index_predicate is null
    or page_index_predicate not like '%status%active%'
    or page_index_predicate like '%notes%'
  then
    raise exception 'Automatic public crew page index is missing or opt-in bound: %', page_index_predicate;
  end if;

  if has_function_privilege(
      'anon',
      'public.bluedeck_public_crew_page(timestamp with time zone,uuid,integer)',
      'execute'
    )
    or has_function_privilege(
      'authenticated',
      'public.bluedeck_public_crew_page(timestamp with time zone,uuid,integer)',
      'execute'
    )
    or not has_function_privilege(
      'service_role',
      'public.bluedeck_public_crew_page(timestamp with time zone,uuid,integer)',
      'execute'
    )
  then
    raise exception 'Public crew page RPC grants are unsafe.';
  end if;
end;
$test$;

rollback;
