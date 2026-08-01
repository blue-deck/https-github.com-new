begin;

do $test$
declare
  account_id uuid := gen_random_uuid();
  other_account_id uuid := gen_random_uuid();
  session_id uuid := gen_random_uuid();
  other_session_id uuid := gen_random_uuid();
  processing_nonce uuid := gen_random_uuid();
  second_processing_nonce uuid := gen_random_uuid();
  state_digest text := encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex');
  second_state_digest text := encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex');
  cancelled_state_digest text := encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex');
  concurrent_state_digest text := encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex');
  email_digest text := encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex');
  ticket_digest text := encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex');
  other_ticket_digest text := encode(extensions.digest(gen_random_uuid()::text, 'sha256'), 'hex');
  token_ciphertext text := repeat('a', 128);
  recovery_time timestamptz := statement_timestamp();
  claimed jsonb;
begin
  insert into auth.users (
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  ) values
    (
      account_id,
      'authenticated',
      'authenticated',
      'recovery-smoke-' || account_id || '@example.invalid',
      '',
      statement_timestamp(),
      '{}'::jsonb,
      '{}'::jsonb,
      statement_timestamp(),
      statement_timestamp()
    ),
    (
      other_account_id,
      'authenticated',
      'authenticated',
      'recovery-other-' || other_account_id || '@example.invalid',
      '',
      statement_timestamp(),
      '{}'::jsonb,
      '{}'::jsonb,
      statement_timestamp(),
      statement_timestamp()
    );

  insert into auth.sessions (id, user_id, created_at, updated_at)
  values
    (session_id, account_id, statement_timestamp(), statement_timestamp()),
    (
      other_session_id,
      other_account_id,
      statement_timestamp(),
      statement_timestamp()
    );

  if not public.bluedeck_issue_password_recovery_transaction(
    state_digest,
    email_digest,
    statement_timestamp() + interval '1 hour'
  ) or not public.bluedeck_issue_password_recovery_transaction(
    second_state_digest,
    encode(extensions.digest('other-keyed-email', 'sha256'), 'hex'),
    statement_timestamp() + interval '1 hour'
  ) then
    raise exception 'Recovery transaction could not be issued.';
  end if;

  if public.bluedeck_password_recovery_state_is_pending(state_digest)
    or public.bluedeck_password_recovery_state_is_pending(second_state_digest)
  then
    raise exception 'Recovery state became usable before mail acceptance.';
  end if;

  if not public.bluedeck_activate_password_recovery_transaction(
    state_digest
  ) or not public.bluedeck_activate_password_recovery_transaction(
    second_state_digest,
    encode(extensions.digest('other-keyed-email', 'sha256'), 'hex')
  ) or not public.bluedeck_activate_password_recovery_transaction(
    state_digest
  ) then
    raise exception 'Recovery transaction could not be activated idempotently.';
  end if;

  if not public.bluedeck_password_recovery_state_is_pending(state_digest) then
    raise exception 'Fresh recovery state is not pending.';
  end if;

  if not public.bluedeck_issue_password_recovery_transaction(
    cancelled_state_digest,
    email_digest,
    statement_timestamp() + interval '1 hour'
  ) or public.bluedeck_issue_password_recovery_transaction(
    concurrent_state_digest,
    email_digest,
    statement_timestamp() + interval '1 hour'
  ) or not public.bluedeck_cancel_password_recovery_transaction(
    cancelled_state_digest,
    email_digest
  ) or public.bluedeck_password_recovery_state_is_pending(
    cancelled_state_digest
  ) or not public.bluedeck_password_recovery_state_is_pending(state_digest)
  then
    raise exception 'Failed mail issuance invalidated an existing recovery link.';
  end if;

  if public.bluedeck_bind_password_recovery_transaction(
    state_digest,
    email_digest,
    account_id,
    other_session_id,
    recovery_time,
    ticket_digest,
    token_ciphertext
  ) then
    raise exception 'Recovery state bound to another account session.';
  end if;

  if public.bluedeck_bind_password_recovery_transaction(
    state_digest,
    encode(extensions.digest('wrong-keyed-email', 'sha256'), 'hex'),
    account_id,
    session_id,
    recovery_time,
    ticket_digest,
    token_ciphertext
  ) then
    raise exception 'Recovery state bound to a mismatched keyed identity.';
  end if;

  if not public.bluedeck_bind_password_recovery_transaction(
    state_digest,
    email_digest,
    account_id,
    session_id,
    recovery_time,
    ticket_digest,
    token_ciphertext
  ) then
    raise exception 'Valid recovery state could not be bound.';
  end if;

  if public.bluedeck_password_recovery_state_is_pending(state_digest)
    or public.bluedeck_bind_password_recovery_transaction(
      state_digest,
      email_digest,
      account_id,
      session_id,
      recovery_time,
      other_ticket_digest,
      token_ciphertext
    )
  then
    raise exception 'Recovery state was reused after binding.';
  end if;

  if not public.bluedeck_password_recovery_ticket_is_bound(
    ticket_digest,
    account_id,
    session_id
  ) or public.bluedeck_password_recovery_ticket_is_bound(
    ticket_digest,
    account_id,
    other_session_id
  ) then
    raise exception 'Bound recovery ticket status is incorrect.';
  end if;

  claimed := public.bluedeck_claim_password_recovery_transaction(
    ticket_digest,
    account_id,
    other_session_id,
    processing_nonce
  );
  if claimed is not null then
    raise exception 'Recovery ticket was claimed from another session.';
  end if;

  claimed := public.bluedeck_claim_password_recovery_transaction(
    ticket_digest,
    account_id,
    session_id,
    processing_nonce
  );
  if claimed ->> 'userId' is distinct from account_id::text
    or claimed ->> 'tokenCiphertext' is distinct from token_ciphertext
  then
    raise exception 'Valid recovery ticket could not be claimed.';
  end if;

  if public.bluedeck_password_recovery_ticket_is_bound(
    ticket_digest,
    account_id,
    session_id
  ) then
    raise exception 'Processing recovery ticket still appears bound.';
  end if;

  claimed := public.bluedeck_claim_password_recovery_transaction(
    ticket_digest,
    account_id,
    session_id,
    second_processing_nonce
  );
  if claimed is not null then
    raise exception 'A processing recovery ticket was claimed twice.';
  end if;

  if not public.bluedeck_finish_password_recovery_transaction(
    processing_nonce,
    'indeterminate'
  ) then
    raise exception 'Indeterminate recovery transaction was not burned.';
  end if;

  claimed := public.bluedeck_claim_password_recovery_transaction(
    ticket_digest,
    account_id,
    session_id,
    second_processing_nonce
  );
  if claimed is not null then
    raise exception 'Indeterminate recovery ticket was replayed.';
  end if;

  update auth.users
  set email_confirmed_at = null
  where id = account_id;

  if public.bluedeck_bind_password_recovery_transaction(
    second_state_digest,
    encode(extensions.digest('other-keyed-email', 'sha256'), 'hex'),
    account_id,
    session_id,
    recovery_time,
    other_ticket_digest,
    token_ciphertext
  ) then
    raise exception 'Unconfirmed account bound a recovery state.';
  end if;

  if has_table_privilege(
    'service_role',
    'private.password_recovery_transactions',
    'SELECT'
  ) or has_table_privilege(
    'authenticated',
    'private.password_recovery_transactions',
    'SELECT'
  ) or has_function_privilege(
    'authenticated',
    'public.bluedeck_issue_password_recovery_transaction(text,text,timestamp with time zone)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.bluedeck_activate_password_recovery_transaction(text,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.bluedeck_activate_password_recovery_transaction(text)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.bluedeck_cancel_password_recovery_transaction(text,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.bluedeck_password_recovery_state_is_pending(text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.bluedeck_bind_password_recovery_transaction(text,text,uuid,uuid,timestamp with time zone,text,text)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.bluedeck_password_recovery_ticket_is_bound(text,uuid,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.bluedeck_claim_password_recovery_transaction(text,uuid,uuid,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.bluedeck_finish_password_recovery_transaction(uuid,text)',
    'EXECUTE'
  ) then
    raise exception 'Password recovery transaction ACLs are unsafe.';
  end if;
end;
$test$;

rollback;
