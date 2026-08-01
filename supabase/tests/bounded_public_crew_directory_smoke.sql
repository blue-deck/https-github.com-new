begin;

do $test$
declare
  visible_user uuid := gen_random_uuid();
  hidden_user uuid := gen_random_uuid();
  visible_profile uuid := gen_random_uuid();
  hidden_profile uuid := gen_random_uuid();
  page jsonb;
  visible_crew_id text;
  hidden_crew_id text;
  crew_id_mutation_rejected boolean := false;
begin
  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  values
    (
      visible_user, 'authenticated', 'authenticated',
      'directory-visible-' || visible_user || '@example.invalid', '', now(),
      '{}'::jsonb, '{}'::jsonb, now(), now()
    ),
    (
      hidden_user, 'authenticated', 'authenticated',
      'directory-hidden-' || hidden_user || '@example.invalid', '', now(),
      '{}'::jsonb, '{}'::jsonb, now(), now()
    );

  insert into public.marketplace_entitlements (
    user_id, account_role, entitlement_source, posting_status
  )
  values
    (visible_user, 'crew', 'self_service', 'enabled'),
    (hidden_user, 'captain', 'self_service', 'enabled');

  insert into public.crew_profiles (
    id, user_id, public_crew_id, full_name, email, phone, current_position,
    personal_skills, bio, notes, status
  )
  values
    (
      visible_profile, visible_user, 'VISIBLE-' || left(visible_user::text, 8),
      'Visible Candidate', 'private-visible@example.invalid', '+44123456789',
      'Deckhand', array['Tender driving'], 'Private directory biography',
      '__BLUDECK_FIND_CREW__{"discoverable":true,"availabilityStatus":"Available","preferredLocations":[],"employmentTypes":[],"contactVisibility":"request_only"}' || E'\nPRIVATE NOTES',
      'active'
    ),
    (
      hidden_profile, hidden_user, 'HIDDEN-' || left(hidden_user::text, 8),
      'Hidden Candidate', 'private-hidden@example.invalid', '+44987654321',
      'Captain', array['Navigation'], 'Hidden biography',
      '__BLUDECK_FIND_CREW__{"discoverable":false,"availabilityStatus":"Available","preferredLocations":[],"employmentTypes":[],"contactVisibility":"request_only"}',
      'active'
    );

  select public_crew_id into visible_crew_id
  from public.crew_profiles where id = visible_profile;
  select public_crew_id into hidden_crew_id
  from public.crew_profiles where id = hidden_profile;

  if visible_crew_id = hidden_crew_id
    or visible_crew_id !~ '^BD-[A-F0-9]{32}$'
    or hidden_crew_id !~ '^BD-[A-F0-9]{32}$'
    or position(upper(replace(visible_user::text, '-', '')) in visible_crew_id) > 0
    or position(upper(replace(visible_profile::text, '-', '')) in visible_crew_id) > 0
    or position(upper(replace(hidden_user::text, '-', '')) in hidden_crew_id) > 0
    or position(upper(replace(hidden_profile::text, '-', '')) in hidden_crew_id) > 0
  then
    raise exception 'Public Crew IDs are not opaque and collision-resistant.';
  end if;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', hidden_user::text, true);
  begin
    update public.crew_profiles
    set public_crew_id = lower(visible_crew_id)
    where id = hidden_profile;
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

  if jsonb_array_length(page -> 'rows') > 48
    or not exists (
      select 1
      from jsonb_array_elements(page -> 'rows') as row_data
      where row_data ->> 'id' = visible_profile::text
    )
    or exists (
      select 1
      from jsonb_array_elements(page -> 'rows') as row_data
      where row_data ->> 'id' = hidden_profile::text
    )
    or page::text like '%PRIVATE NOTES%'
    or page::text like '%private-visible@example.invalid%'
    or page::text like '%+44123456789%'
    or page::text like '%Private directory biography%'
    or page::text like '%' || hidden_profile::text || '%'
  then
    raise exception 'Bounded public crew projection leaked or omitted a profile.';
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
