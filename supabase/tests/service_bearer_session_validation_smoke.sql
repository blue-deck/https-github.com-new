begin;

do $test$
declare
  active_user_id uuid := gen_random_uuid();
  other_user_id uuid := gen_random_uuid();
  unconfirmed_user_id uuid := gen_random_uuid();
  active_session_id uuid := gen_random_uuid();
  other_session_id uuid := gen_random_uuid();
  unconfirmed_session_id uuid := gen_random_uuid();
  expired_session_id uuid := gen_random_uuid();
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
      active_user_id,
      'authenticated',
      'authenticated',
      'service-session-active-' || active_user_id || '@example.invalid',
      '',
      statement_timestamp(),
      '{}'::jsonb,
      '{}'::jsonb,
      statement_timestamp(),
      statement_timestamp()
    ),
    (
      other_user_id,
      'authenticated',
      'authenticated',
      'service-session-other-' || other_user_id || '@example.invalid',
      '',
      statement_timestamp(),
      '{}'::jsonb,
      '{}'::jsonb,
      statement_timestamp(),
      statement_timestamp()
    ),
    (
      unconfirmed_user_id,
      'authenticated',
      'authenticated',
      'service-session-unconfirmed-' || unconfirmed_user_id || '@example.invalid',
      '',
      null,
      '{}'::jsonb,
      '{}'::jsonb,
      statement_timestamp(),
      statement_timestamp()
    );

  insert into auth.sessions (
    id,
    user_id,
    created_at,
    updated_at,
    not_after
  ) values
    (
      active_session_id,
      active_user_id,
      statement_timestamp(),
      statement_timestamp(),
      null
    ),
    (
      other_session_id,
      other_user_id,
      statement_timestamp(),
      statement_timestamp(),
      null
    ),
    (
      unconfirmed_session_id,
      unconfirmed_user_id,
      statement_timestamp(),
      statement_timestamp(),
      null
    ),
    (
      expired_session_id,
      active_user_id,
      statement_timestamp() - interval '2 hours',
      statement_timestamp() - interval '2 hours',
      statement_timestamp() - interval '1 hour'
    );

  if not public.bluedeck_bearer_session_is_live(
    active_user_id,
    active_session_id
  ) then
    raise exception 'A ready account with a current session was rejected.';
  end if;

  if public.bluedeck_bearer_session_is_live(
    active_user_id,
    other_session_id
  ) then
    raise exception 'A session belonging to another user was accepted.';
  end if;

  if public.bluedeck_bearer_session_is_live(
    active_user_id,
    expired_session_id
  ) then
    raise exception 'An expired session was accepted.';
  end if;

  if public.bluedeck_bearer_session_is_live(
    unconfirmed_user_id,
    unconfirmed_session_id
  ) then
    raise exception 'An account that is not ready was accepted.';
  end if;

  if public.bluedeck_bearer_session_is_live(
    active_user_id,
    gen_random_uuid()
  ) then
    raise exception 'A missing session was accepted.';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', active_user_id,
      'role', 'authenticated',
      'session_id', active_session_id,
      'amr', jsonb_build_array('password')
    )::text,
    true
  );
  if not private.bluedeck_has_live_authenticated_session() then
    raise exception 'A normal RFC-8176 AMR session was rejected.';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', active_user_id,
      'role', 'authenticated',
      'session_id', active_session_id,
      'amr', jsonb_build_array(jsonb_build_object(
        'method', 'password',
        'timestamp', extract(epoch from statement_timestamp())::bigint
      ))
    )::text,
    true
  );
  if not private.bluedeck_has_live_authenticated_session() then
    raise exception 'A normal object-form AMR session was rejected.';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', active_user_id,
      'role', 'authenticated',
      'session_id', active_session_id
    )::text,
    true
  );
  if private.bluedeck_has_live_authenticated_session() then
    raise exception 'A session without an AMR claim was accepted.';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', active_user_id,
      'role', 'authenticated',
      'session_id', active_session_id,
      'amr', '[]'::jsonb
    )::text,
    true
  );
  if private.bluedeck_has_live_authenticated_session() then
    raise exception 'A session with an empty AMR claim was accepted.';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', active_user_id,
      'role', 'authenticated',
      'session_id', active_session_id,
      'amr', jsonb_build_array('recovery')
    )::text,
    true
  );
  if private.bluedeck_has_live_authenticated_session() then
    raise exception 'A string-form recovery AMR session was accepted.';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', active_user_id,
      'role', 'authenticated',
      'session_id', active_session_id,
      'amr', jsonb_build_array(jsonb_build_object(
        'method', 'recovery',
        'timestamp', extract(epoch from statement_timestamp())::bigint
      ))
    )::text,
    true
  );
  if private.bluedeck_has_live_authenticated_session() then
    raise exception 'An object-form recovery AMR session was accepted.';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', active_user_id,
      'role', 'authenticated',
      'session_id', active_session_id,
      'amr', jsonb_build_array(jsonb_build_object(
        'method', 'otp',
        'timestamp', extract(epoch from statement_timestamp())::bigint
      ))
    )::text,
    true
  );
  if private.bluedeck_has_live_authenticated_session() then
    raise exception 'A generic OTP proof session was accepted.';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', active_user_id,
      'role', 'authenticated',
      'session_id', active_session_id,
      'amr', jsonb_build_array(jsonb_build_object(
        'method', 'email/signup',
        'timestamp', extract(epoch from statement_timestamp())::bigint
      ))
    )::text,
    true
  );
  if private.bluedeck_has_live_authenticated_session() then
    raise exception 'A signup proof session was accepted.';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', active_user_id,
      'role', 'authenticated',
      'session_id', active_session_id,
      'amr', jsonb_build_array('token_refresh')
    )::text,
    true
  );
  if private.bluedeck_has_live_authenticated_session() then
    raise exception 'A refresh-only session was accepted.';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', active_user_id,
      'role', 'authenticated',
      'session_id', active_session_id,
      'amr', jsonb_build_array('password', 'token_refresh', 'totp')
    )::text,
    true
  );
  if not private.bluedeck_has_live_authenticated_session() then
    raise exception 'A refreshed MFA password session was rejected.';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', active_user_id,
      'role', 'authenticated',
      'session_id', active_session_id,
      'amr', jsonb_build_array('password', 'unexpected_method')
    )::text,
    true
  );
  if private.bluedeck_has_live_authenticated_session() then
    raise exception 'An unsupported AMR method was accepted.';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', active_user_id,
      'role', 'authenticated',
      'session_id', active_session_id,
      'amr', 'recovery'
    )::text,
    true
  );
  if private.bluedeck_has_live_authenticated_session() then
    raise exception 'A malformed non-array AMR claim was accepted.';
  end if;

  perform set_config(
    'request.jwt.claims',
    jsonb_build_object(
      'sub', active_user_id,
      'role', 'authenticated',
      'session_id', active_session_id,
      'amr', jsonb_build_array(jsonb_build_object('method', 1))
    )::text,
    true
  );
  if private.bluedeck_has_live_authenticated_session() then
    raise exception 'A malformed AMR entry was accepted.';
  end if;

  delete from auth.sessions where id = active_session_id;
  if public.bluedeck_bearer_session_is_live(
    active_user_id,
    active_session_id
  ) then
    raise exception 'A deleted session was accepted.';
  end if;

  if has_function_privilege(
    'anon',
    'public.bluedeck_bearer_session_is_live(uuid,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'public.bluedeck_bearer_session_is_live(uuid,uuid)',
    'EXECUTE'
  ) or not has_function_privilege(
    'service_role',
    'public.bluedeck_bearer_session_is_live(uuid,uuid)',
    'EXECUTE'
  ) or has_function_privilege(
    'service_role',
    'private.bluedeck_has_live_authenticated_session()',
    'EXECUTE'
  ) then
    raise exception 'Service bearer session validation ACLs are unsafe.';
  end if;
end;
$test$;

rollback;
