begin;

do $test$
declare
  test_user_id uuid := gen_random_uuid();
  test_profile_id uuid := gen_random_uuid();
  quota_rejected boolean := false;
  payload_rejected boolean := false;
  physical_domain_rejected boolean := false;
  future_birth_date_rejected boolean := false;
begin
  if has_table_privilege('authenticated', 'public.crew_documents', 'INSERT')
    or has_table_privilege('authenticated', 'public.crew_documents', 'UPDATE')
    or has_table_privilege('authenticated', 'public.crew_documents', 'DELETE')
    or has_table_privilege('authenticated', 'public.crew_references', 'INSERT')
    or has_table_privilege('authenticated', 'public.crew_experiences', 'INSERT')
    or has_table_privilege('authenticated', 'public.crew_portfolio_photos', 'INSERT')
  then
    raise exception 'Authenticated clients retained direct crew career mutation privileges.';
  end if;

  if not has_table_privilege('authenticated', 'public.crew_documents', 'SELECT') then
    raise exception 'Crew owners lost their bounded self-service read privilege.';
  end if;

  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) values (
    test_user_id,
    'authenticated',
    'authenticated',
    'crew-boundary-' || test_user_id || '@example.invalid',
    '',
    statement_timestamp(),
    '{}'::jsonb,
    '{}'::jsonb,
    statement_timestamp(),
    statement_timestamp()
  );

  insert into public.marketplace_entitlements (
    user_id, account_role, entitlement_source, posting_status
  ) values (test_user_id, 'crew', 'self_service', 'enabled');

  insert into public.crew_profiles (
    id, user_id, public_crew_id, full_name, email, current_position, status
  ) values (
    test_profile_id,
    test_user_id,
    'BD-BOUND-' || replace(test_profile_id::text, '-', ''),
    'Bounded Career Test',
    'crew-boundary-' || test_user_id || '@example.invalid',
    'Deckhand',
    'active'
  );

  insert into public.crew_documents (crew_profile_id, document_type)
  select test_profile_id, 'Certificate ' || series_number
  from generate_series(1, 100) as series_number;

  insert into public.crew_documents (id, crew_profile_id, document_type)
  select document.id, document.crew_profile_id, 'Reordered existing row'
  from public.crew_documents as document
  where document.crew_profile_id = test_profile_id
  order by document.id
  limit 1
  on conflict (id) do update
  set document_type = excluded.document_type;

  if not exists (
    select 1
    from public.crew_documents as document
    where document.crew_profile_id = test_profile_id
      and document.document_type = 'Reordered existing row'
  ) then
    raise exception 'Existing-row upsert failed at the quota ceiling.';
  end if;

  begin
    insert into public.crew_documents (crew_profile_id, document_type)
    values (test_profile_id, 'One too many');
  exception
    when check_violation then
      quota_rejected := true;
  end;

  if not quota_rejected then
    raise exception 'Crew document row quota was not enforced.';
  end if;

  begin
    update public.crew_profiles
    set full_name = repeat('x', 513)
    where id = test_profile_id;
  exception
    when check_violation then
      payload_rejected := true;
  end;

  if not payload_rejected then
    raise exception 'Oversized crew profile payload was accepted.';
  end if;

  begin
    update public.crew_profiles
    set height_cm = 999
    where id = test_profile_id;
  exception
    when check_violation then
      physical_domain_rejected := true;
  end;

  if not physical_domain_rejected then
    raise exception 'Implausible crew physical data was accepted.';
  end if;

  begin
    update public.crew_profiles
    set date_of_birth = current_date + 1
    where id = test_profile_id;
  exception
    when check_violation then
      future_birth_date_rejected := true;
  end;

  if not future_birth_date_rejected then
    raise exception 'Future crew date of birth was accepted.';
  end if;
end;
$test$;

rollback;
