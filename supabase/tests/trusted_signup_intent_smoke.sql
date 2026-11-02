-- The Auth INSERT and every application row roll back together on failure.
begin;

do $test$
declare
  expected_role text;
  account_id uuid;
  account_email text;
  signup_token uuid;
  existing_user_id uuid;
  scenario text;
  rejected boolean;
  metadata jsonb;
  index integer;
begin
  perform set_config('request.jwt.claims','{}',true);
  if has_function_privilege('anon', 'public.bluedeck_prepare_signup_account(text,text,text,text)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.bluedeck_prepare_signup_account(text,text,text,text)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.bluedeck_prepare_signup_account(text,text,text,text)', 'EXECUTE')
    or has_function_privilege('service_role', 'private.bluedeck_finalize_signup_intent()', 'EXECUTE')
    or has_table_privilege('anon', 'private.bluedeck_signup_intents', 'SELECT')
    or has_table_privilege('authenticated', 'private.bluedeck_signup_intents', 'SELECT')
    or has_table_privilege('service_role', 'private.bluedeck_signup_intents', 'SELECT')
  then
    raise exception 'Trusted signup intent ACLs are unsafe.';
  end if;
  if not exists (
    select 1 from pg_trigger
    where tgrelid = 'auth.users'::regclass
      and tgname = 'bluedeck_zzzz_finalize_trusted_signup'
      and tgfoid = 'private.bluedeck_finalize_signup_intent()'::regprocedure
      and tgenabled = 'O' and tgtype = 5
  ) or 'bluedeck_zzz_provision_default_email_signup' collate "C"
      >= 'bluedeck_zzzz_finalize_trusted_signup' collate "C"
  then
    raise exception 'Trusted signup must finalize after the default account trigger.';
  end if;

  foreach expected_role in array array['crew','captain','owner','management'] loop
    account_id := gen_random_uuid();
    account_email := 'trusted-signup-' || account_id || '@example.invalid';
    signup_token := public.bluedeck_prepare_signup_account(
      account_email,'Trusted Signup',expected_role,'Captain'
    );
    if signup_token is null then
      raise exception 'Valid trusted signup was not prepared for %.',expected_role;
    end if;
    insert into auth.users(
      id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at
    ) values (
      account_id,'authenticated','authenticated',account_email,'','{"provider":"email"}'::jsonb,
      jsonb_build_object(
        'full_name','Untrusted Name','role','owner','position','Owner',
        'bluedeck_signup_intent',signup_token,
        'bluedeck_legal_acceptance',jsonb_build_object(
          'accepted',true,'privacyVersion','2026-08-08','termsVersion','2026-08-08'
        )
      ),statement_timestamp(),statement_timestamp()
    );

    -- There is deliberately no post-signUp RPC here. The database transaction
    -- must already contain the intended role even if the HTTP route dies.
    if (select state from private.bluedeck_account_provisioning where user_id = account_id) is distinct from 'ready'
      or (select role from public.profiles where id = account_id) is distinct from expected_role
      or (select account_role from public.marketplace_entitlements where user_id = account_id) is distinct from expected_role
      or (select full_name from public.crew_profiles where user_id = account_id) is distinct from 'Trusted Signup'
      or (select current_position from public.crew_profiles where user_id = account_id) is distinct from 'Captain'
      or (select raw_app_meta_data ->> 'bluedeck_account_role' from auth.users where id = account_id) is distinct from expected_role
      or not exists (select 1 from private.bluedeck_signup_intents
        where token = signup_token and consumed_user_id = account_id and consumed_at is not null)
    then
      raise exception 'Trusted signup did not atomically preserve validated role %.',expected_role;
    end if;
    if public.bluedeck_account_is_ready(account_id) then
      raise exception 'Trusted signup bypassed email confirmation.';
    end if;
    update auth.users set email_confirmed_at = statement_timestamp() where id = account_id;
    if not public.bluedeck_account_is_ready(account_id) then
      raise exception 'Confirmed trusted signup is unavailable.';
    end if;
    existing_user_id := account_id;
  end loop;

  foreach scenario in array array['malformed','unknown','expired','wrong_email','reused','missing_legal'] loop
    account_id := gen_random_uuid();
    account_email := 'invalid-intent-' || account_id || '@example.invalid';
    signup_token := public.bluedeck_prepare_signup_account(
      case when scenario = 'wrong_email' then 'wrong-' || account_email else account_email end,
      'Intent Fixture','owner','Owner'
    );
    if scenario = 'expired' then
      update private.bluedeck_signup_intents
      set created_at = statement_timestamp() - interval '20 minutes',
          expires_at = statement_timestamp() - interval '5 minutes'
      where token = signup_token;
    elsif scenario = 'reused' then
      update private.bluedeck_signup_intents
      set consumed_user_id = existing_user_id, consumed_at = statement_timestamp()
      where token = signup_token;
    end if;
    metadata := jsonb_build_object(
      'full_name','Untrusted Signup','role','owner',
      'bluedeck_signup_intent',case
        when scenario = 'malformed' then 'not-a-uuid'
        when scenario = 'unknown' then gen_random_uuid()::text
        else signup_token::text end,
      'bluedeck_legal_acceptance',jsonb_build_object(
        'accepted',true,'privacyVersion','2026-08-08','termsVersion','2026-08-08'
      )
    );
    if scenario = 'missing_legal' then
      metadata := metadata - 'bluedeck_legal_acceptance';
    end if;
    rejected := false;
    begin
      insert into auth.users(id,aud,role,email,encrypted_password,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
      values(account_id,'authenticated','authenticated',account_email,'','{"provider":"email"}'::jsonb,
        metadata,statement_timestamp(),statement_timestamp());
    exception when check_violation then
      rejected := true;
    end;
    if not rejected
      or exists (select 1 from auth.users where id = account_id)
      or exists (select 1 from public.profiles where id = account_id)
      or exists (select 1 from public.crew_profiles where user_id = account_id)
      or exists (select 1 from private.bluedeck_account_provisioning where user_id = account_id)
    then
      raise exception 'Invalid intent % did not roll back the entire signup.',scenario;
    end if;
  end loop;

  account_email := 'bounded-intent-' || gen_random_uuid() || '@example.invalid';
  for index in 1..6 loop
    if public.bluedeck_prepare_signup_account(account_email,'Bounded Signup','crew','Deckhand') is null then
      raise exception 'Expected bounded signup slot % unavailable.',index;
    end if;
  end loop;
  if public.bluedeck_prepare_signup_account(account_email,'Bounded Signup','crew','Deckhand') is not null then
    raise exception 'Outstanding signup intents are not bounded per email.';
  end if;
  update private.bluedeck_signup_intents
  set created_at = statement_timestamp() - interval '20 minutes',
      expires_at = statement_timestamp() - interval '5 minutes'
  where email = account_email;
  signup_token := public.bluedeck_prepare_signup_account(account_email,'Bounded Signup','crew','Deckhand');
  if signup_token is null
    or (select count(*) from private.bluedeck_signup_intents where email = account_email) <> 1
  then
    raise exception 'Expired signup intents are not removed before preparing a new request.';
  end if;
end;
$test$;

rollback;
