begin;

do $test$
declare
  manager_id uuid := gen_random_uuid();
  crew_a_user uuid := gen_random_uuid();
  crew_b_user uuid := gen_random_uuid();
  manager_session_id uuid := gen_random_uuid();
  crew_a_session_id uuid := gen_random_uuid();
  crew_b_session_id uuid := gen_random_uuid();
  yacht_a uuid := gen_random_uuid();
  yacht_b uuid := gen_random_uuid();
  crew_a_profile uuid := gen_random_uuid();
  crew_b_profile uuid := gen_random_uuid();
  membership_a uuid := gen_random_uuid();
  membership_b uuid := gen_random_uuid();
  contract_id uuid;
  draft_to_delete_id uuid;
  invalid_draft_id uuid;
  original_sent_at timestamptz;
  signed_timestamp timestamptz;
  rejected boolean;
begin
  insert into auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  values
    (manager_id, 'authenticated', 'authenticated', 'contract-manager-' || manager_id || '@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (crew_a_user, 'authenticated', 'authenticated', 'contract-crew-a-' || crew_a_user || '@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()),
    (crew_b_user, 'authenticated', 'authenticated', 'contract-crew-b-' || crew_b_user || '@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());

  insert into private.bluedeck_account_provisioning (
    user_id, state, failure_code
  ) values
    (manager_id, 'ready', ''),
    (crew_a_user, 'ready', ''),
    (crew_b_user, 'ready', '');

  insert into auth.sessions (id, user_id, created_at, updated_at)
  values
    (manager_session_id, manager_id, now(), now()),
    (crew_a_session_id, crew_a_user, now(), now()),
    (crew_b_session_id, crew_b_user, now(), now());

  insert into public.yachts (id, name, model, flag, owner_id)
  values
    (yacht_a, 'Contract Yacht A', 'Test', 'Malta', manager_id),
    (yacht_b, 'Contract Yacht B', 'Test', 'Malta', manager_id);

  insert into public.crew_profiles (id, user_id, full_name, email, status)
  values
    (crew_a_profile, crew_a_user, 'Contract Crew A', 'contract-crew-a@example.invalid', 'active'),
    (crew_b_profile, crew_b_user, 'Contract Crew B', 'contract-crew-b@example.invalid', 'active');

  insert into public.yacht_crew_memberships (
    id, yacht_id, crew_profile_id, position, department, status
  )
  values
    (membership_a, yacht_a, crew_a_profile, 'Deckhand', 'Deck', 'active'),
    (membership_b, yacht_b, crew_b_profile, 'Engineer', 'Engineering', 'active');

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', manager_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', manager_id,
      'role', 'authenticated',
      'session_id', manager_session_id,
      'amr', jsonb_build_array(jsonb_build_object('method', 'password'))
    )::text,
    true
  );
  if not private.bluedeck_is_active_account()
    or not private.bluedeck_is_yacht_manager(yacht_a)
  then
    raise exception 'Contract manager fixture did not have active yacht authority.';
  end if;

  rejected := false;
  begin
    insert into public.yacht_contracts (
      yacht_id, crew_profile_id, membership_id, contract_text, status,
      sent_at, signed_name, signed_at
    ) values (
      yacht_a, crew_a_profile, membership_a, 'Forged signed contract',
      'signed', now(), 'Forged Signer', now()
    );
  exception
    when insufficient_privilege then rejected := true;
  end;
  if not rejected then
    raise exception 'A forged signed contract was accepted on INSERT.';
  end if;

  rejected := false;
  begin
    insert into public.yacht_contracts (
      yacht_id, crew_profile_id, membership_id, contract_text, status, sent_at
    ) values (
      yacht_a, crew_a_profile, membership_a, 'Forged sent contract',
      'sent_for_signature', now()
    );
  exception
    when insufficient_privilege then rejected := true;
  end;
  if not rejected then
    raise exception 'A non-draft contract was accepted on INSERT.';
  end if;

  rejected := false;
  begin
    insert into public.yacht_contracts (
      yacht_id, contract_text, status
    ) values (
      yacht_a, repeat('x', 1048577), 'studio_draft'
    );
  exception
    when check_violation then rejected := true;
  end;
  if not rejected then
    raise exception 'An oversized contract payload was accepted.';
  end if;

  insert into public.yacht_contracts (
    yacht_id, contract_text, status, sent_at
  ) values (
    yacht_a, '{"draft":true}', 'studio_draft', '2099-01-01'::timestamptz
  )
  returning id into contract_id;

  if exists (
    select 1 from public.yacht_contracts
    where id = contract_id and sent_at is not null
  ) then
    raise exception 'Studio draft retained a caller-supplied sent timestamp.';
  end if;

  insert into public.yacht_contracts (
    yacht_id, contract_text, status
  ) values (
    yacht_a, 'Invalid recipient draft', 'studio_draft'
  )
  returning id into invalid_draft_id;

  rejected := false;
  begin
    update public.yacht_contracts
    set crew_profile_id = crew_b_profile,
        membership_id = membership_a,
        status = 'sent_for_signature'
    where id = invalid_draft_id;
  exception
    when check_violation then rejected := true;
  end;
  if not rejected then
    raise exception 'An arbitrary recipient/membership pairing was accepted.';
  end if;

  rejected := false;
  begin
    update public.yacht_contracts
    set crew_profile_id = crew_b_profile,
        membership_id = membership_b,
        status = 'sent_for_signature'
    where id = invalid_draft_id;
  exception
    when check_violation or foreign_key_violation then rejected := true;
  end;
  if not rejected then
    raise exception 'A cross-yacht contract membership was accepted.';
  end if;

  update public.yacht_contracts
  set crew_profile_id = crew_a_profile,
      membership_id = membership_a,
      contract_text = 'Immutable sent terms',
      status = 'sent_for_signature',
      sent_at = '2099-01-01'::timestamptz
  where id = contract_id;

  select sent_at into original_sent_at
  from public.yacht_contracts
  where id = contract_id;
  if original_sent_at is null
    or original_sent_at = '2099-01-01'::timestamptz
  then
    raise exception 'Sent timestamp was not assigned by the database.';
  end if;

  rejected := false;
  begin
    update public.yacht_contracts
    set status = 'signed',
        signed_name = 'Manager Forgery',
        signed_at = '2099-01-01'::timestamptz
    where id = contract_id;
  exception
    when insufficient_privilege then rejected := true;
  end;
  if not rejected then
    raise exception 'Manager signed on behalf of the assigned crew member.';
  end if;

  rejected := false;
  begin
    update public.yacht_contracts
    set id = gen_random_uuid()
    where id = contract_id;
  exception
    when insufficient_privilege then rejected := true;
  end;
  if not rejected then
    raise exception 'Sent contract primary key remained mutable.';
  end if;

  rejected := false;
  begin
    update public.yacht_contracts
    set contract_text = 'Changed after sending'
    where id = contract_id;
  exception
    when insufficient_privilege then rejected := true;
  end;
  if not rejected then
    raise exception 'Sent contract terms remained mutable.';
  end if;

  rejected := false;
  begin
    delete from public.yacht_contracts where id = contract_id;
  exception
    when insufficient_privilege then rejected := true;
  end;
  if not rejected then
    raise exception 'Sent contract audit record was deleted.';
  end if;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', crew_b_user::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', crew_b_user,
      'role', 'authenticated',
      'session_id', crew_b_session_id,
      'amr', jsonb_build_array(jsonb_build_object('method', 'password'))
    )::text,
    true
  );
  if not private.bluedeck_is_active_account()
    or not private.bluedeck_is_own_crew_profile(crew_b_profile)
  then
    raise exception 'Unassigned crew fixture did not have an active password session.';
  end if;
  rejected := false;
  begin
    update public.yacht_contracts
    set status = 'signed', signed_name = 'Wrong Crew'
    where id = contract_id;
  exception
    when insufficient_privilege then rejected := true;
  end;
  if not rejected then
    raise exception 'A different crew member signed the contract.';
  end if;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', crew_a_user::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', crew_a_user,
      'role', 'authenticated',
      'session_id', crew_a_session_id,
      'amr', jsonb_build_array(jsonb_build_object('method', 'password'))
    )::text,
    true
  );
  if not private.bluedeck_is_active_account()
    or not private.bluedeck_is_own_crew_profile(crew_a_profile)
  then
    raise exception 'Assigned crew fixture did not have an active password session.';
  end if;
  update public.yacht_contracts
  set status = 'signed',
      signed_name = '  Contract Crew A  ',
      signed_at = '2099-01-01'::timestamptz
  where id = contract_id;

  select signed_at into signed_timestamp
  from public.yacht_contracts
  where id = contract_id
    and status = 'signed'
    and signed_name = 'Contract Crew A';
  if signed_timestamp is null
    or signed_timestamp = '2099-01-01'::timestamptz
    or signed_timestamp < statement_timestamp() - interval '1 second'
    or signed_timestamp > statement_timestamp() + interval '1 second'
  then
    raise exception 'Crew signature did not receive canonical name/server time.';
  end if;

  rejected := false;
  begin
    update public.yacht_contracts
    set signed_name = 'Mutated Signer'
    where id = contract_id;
  exception
    when insufficient_privilege then rejected := true;
  end;
  if not rejected then
    raise exception 'Signed contract record remained mutable.';
  end if;

  rejected := false;
  begin
    delete from public.yacht_contracts where id = contract_id;
  exception
    when insufficient_privilege then rejected := true;
  end;
  if not rejected then
    raise exception 'Signed contract audit record was deleted.';
  end if;

  perform set_config('request.jwt.claim.role', 'authenticated', true);
  perform set_config('request.jwt.claim.sub', manager_id::text, true);
  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', manager_id,
      'role', 'authenticated',
      'session_id', manager_session_id,
      'amr', jsonb_build_array(jsonb_build_object('method', 'password'))
    )::text,
    true
  );
  if not private.bluedeck_is_active_account()
    or not private.bluedeck_is_yacht_manager(yacht_a)
  then
    raise exception 'Contract manager fixture lost active yacht authority.';
  end if;
  insert into public.yacht_contracts (
    yacht_id, contract_text, status
  ) values (
    yacht_a, 'Disposable studio draft', 'studio_draft'
  ) returning id into draft_to_delete_id;
  delete from public.yacht_contracts where id = draft_to_delete_id;
  if exists (
    select 1 from public.yacht_contracts where id = draft_to_delete_id
  ) then
    raise exception 'Unsigned studio draft could not be deleted.';
  end if;

  if to_regclass('public.crew_contracts') is not null
    and (
      has_table_privilege('authenticated', 'public.crew_contracts', 'insert')
      or has_table_privilege('authenticated', 'public.crew_contracts', 'update')
      or has_table_privilege('authenticated', 'public.crew_contracts', 'delete')
    )
  then
    raise exception 'Legacy contract mutation privileges remain open.';
  end if;
end;
$test$;

rollback;
