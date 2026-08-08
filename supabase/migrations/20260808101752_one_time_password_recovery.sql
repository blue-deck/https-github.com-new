-- Keep recovery credentials server-side and bind every password reset to one
-- verified Supabase recovery session plus one non-replayable transaction.
-- Only high-entropy capability hashes and a keyed email digest are retained.

begin;

create schema if not exists private;

create table if not exists private.password_recovery_transactions (
  id uuid primary key default gen_random_uuid(),
  state_digest text not null unique,
  email_digest text not null,
  status text not null default 'pending',
  user_id uuid references auth.users(id) on delete cascade,
  session_id uuid,
  ticket_digest text unique,
  recovery_token_ciphertext text,
  recovery_authenticated_at timestamptz,
  processing_nonce uuid,
  processing_started_at timestamptz,
  completed_at timestamptz,
  issued_at timestamptz not null default statement_timestamp(),
  expires_at timestamptz not null,
  constraint password_recovery_state_digest_check check (
    state_digest ~ '^[a-f0-9]{64}$'
  ),
  constraint password_recovery_email_digest_check check (
    email_digest ~ '^[a-f0-9]{64}$'
  ),
  constraint password_recovery_ticket_digest_check check (
    ticket_digest is null or ticket_digest ~ '^[a-f0-9]{64}$'
  ),
  constraint password_recovery_status_check check (
    status in (
      'issuing',
      'pending',
      'bound',
      'processing',
      'consumed',
      'indeterminate'
    )
  ),
  constraint password_recovery_lifetime_check check (
    expires_at > issued_at
    and expires_at <= issued_at + interval '2 hours'
  ),
  constraint password_recovery_state_shape_check check (
    (
      status in ('issuing', 'pending')
      and user_id is null
      and session_id is null
      and ticket_digest is null
      and recovery_token_ciphertext is null
      and recovery_authenticated_at is null
      and processing_nonce is null
      and processing_started_at is null
      and completed_at is null
    )
    or (
      status = 'bound'
      and user_id is not null
      and session_id is not null
      and ticket_digest is not null
      and recovery_token_ciphertext is not null
      and octet_length(recovery_token_ciphertext) between 100 and 6000
      and recovery_authenticated_at is not null
      and processing_nonce is null
      and processing_started_at is null
      and completed_at is null
    )
    or (
      status = 'processing'
      and user_id is not null
      and session_id is not null
      and ticket_digest is not null
      and recovery_token_ciphertext is not null
      and octet_length(recovery_token_ciphertext) between 100 and 6000
      and recovery_authenticated_at is not null
      and processing_nonce is not null
      and processing_started_at is not null
      and completed_at is null
    )
    or (
      status in ('consumed', 'indeterminate')
      and user_id is not null
      and session_id is not null
      and ticket_digest is not null
      and recovery_token_ciphertext is null
      and recovery_authenticated_at is not null
      and processing_nonce is null
      and processing_started_at is null
      and completed_at is not null
    )
  )
);

alter table private.password_recovery_transactions enable row level security;

revoke all privileges on table private.password_recovery_transactions
  from public, anon, authenticated, service_role;

create index if not exists password_recovery_transactions_expiry_idx
  on private.password_recovery_transactions (expires_at);

create unique index if not exists password_recovery_transactions_session_idx
  on private.password_recovery_transactions (session_id)
  where session_id is not null;

create unique index if not exists password_recovery_transactions_pending_email_idx
  on private.password_recovery_transactions (email_digest)
  where status = 'pending';

create unique index if not exists password_recovery_transactions_issuing_email_idx
  on private.password_recovery_transactions (email_digest)
  where status = 'issuing';

create or replace function public.bluedeck_issue_password_recovery_transaction(
  p_state_digest text,
  p_email_digest text,
  p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
begin
  if p_state_digest !~ '^[a-f0-9]{64}$'
    or p_email_digest !~ '^[a-f0-9]{64}$'
    or p_expires_at <= statement_timestamp()
    or p_expires_at > statement_timestamp() + interval '2 hours'
  then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_email_digest, 0)
  );

  -- A crashed mail call must not block the mailbox forever, while a concurrent
  -- request must never overtake and later invalidate an in-flight request.
  delete from private.password_recovery_transactions as recovery
  where recovery.email_digest = p_email_digest
    and recovery.status = 'issuing'
    and recovery.issued_at < statement_timestamp() - interval '5 minutes';

  delete from private.password_recovery_transactions as recovery
  where recovery.expires_at < statement_timestamp() - interval '24 hours'
     or recovery.completed_at < statement_timestamp() - interval '24 hours';

  insert into private.password_recovery_transactions (
    state_digest,
    email_digest,
    status,
    expires_at
  ) values (
    p_state_digest,
    p_email_digest,
    'issuing',
    p_expires_at
  );

  return true;
exception
  when unique_violation then
    return false;
end;
$function$;

create or replace function public.bluedeck_activate_password_recovery_transaction(
  p_state_digest text,
  p_email_digest text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  affected integer;
begin
  if p_state_digest !~ '^[a-f0-9]{64}$'
    or p_email_digest !~ '^[a-f0-9]{64}$'
  then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_email_digest, 0)
  );

  if exists (
    select 1
    from private.password_recovery_transactions as recovery
    where recovery.state_digest = p_state_digest
      and recovery.email_digest = p_email_digest
      and recovery.status = 'pending'
      and recovery.expires_at > statement_timestamp()
  ) then
    return true;
  end if;

  -- Do not invalidate a working link until the external mail provider has
  -- accepted the replacement and the exact issuing row is still valid.
  if not exists (
    select 1
    from private.password_recovery_transactions as recovery
    where recovery.state_digest = p_state_digest
      and recovery.email_digest = p_email_digest
      and recovery.status = 'issuing'
      and recovery.expires_at > statement_timestamp()
  ) then
    return false;
  end if;

  delete from private.password_recovery_transactions as recovery
  where recovery.email_digest = p_email_digest
    and recovery.status = 'pending';

  update private.password_recovery_transactions as recovery
  set
    status = 'indeterminate',
    recovery_token_ciphertext = null,
    completed_at = statement_timestamp()
  where recovery.email_digest = p_email_digest
    and recovery.status = 'bound';

  update private.password_recovery_transactions as recovery
  set status = 'pending'
  where recovery.state_digest = p_state_digest
    and recovery.email_digest = p_email_digest
    and recovery.status = 'issuing'
    and recovery.expires_at > statement_timestamp();

  get diagnostics affected = row_count;
  return affected = 1;
end;
$function$;

-- A mail provider can accept a recovery email even when the application loses
-- the HTTP response. Possession of the exact, high-entropy state in that email
-- is enough to finish activation without exposing the keyed email digest.
create or replace function public.bluedeck_activate_password_recovery_transaction(
  p_state_digest text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  keyed_email_digest text;
begin
  if p_state_digest !~ '^[a-f0-9]{64}$' then
    return false;
  end if;

  select recovery.email_digest
  into keyed_email_digest
  from private.password_recovery_transactions as recovery
  where recovery.state_digest = p_state_digest
    and recovery.status in ('issuing', 'pending')
    and recovery.expires_at > statement_timestamp();

  if keyed_email_digest is null then
    return false;
  end if;

  return public.bluedeck_activate_password_recovery_transaction(
    p_state_digest,
    keyed_email_digest
  );
end;
$function$;

create or replace function public.bluedeck_cancel_password_recovery_transaction(
  p_state_digest text,
  p_email_digest text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  affected integer;
begin
  if p_state_digest !~ '^[a-f0-9]{64}$'
    or p_email_digest !~ '^[a-f0-9]{64}$'
  then
    return false;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(p_email_digest, 0)
  );

  delete from private.password_recovery_transactions as recovery
  where recovery.state_digest = p_state_digest
    and recovery.email_digest = p_email_digest
    and recovery.status = 'issuing';

  get diagnostics affected = row_count;
  return affected = 1;
end;
$function$;

create or replace function public.bluedeck_password_recovery_state_is_pending(
  p_state_digest text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $function$
  select
    p_state_digest ~ '^[a-f0-9]{64}$'
    and exists (
      select 1
      from private.password_recovery_transactions as recovery
      where recovery.state_digest = p_state_digest
        and recovery.status = 'pending'
        and recovery.expires_at > statement_timestamp()
    );
$function$;

create or replace function public.bluedeck_bind_password_recovery_transaction(
  p_state_digest text,
  p_email_digest text,
  p_user_id uuid,
  p_session_id uuid,
  p_recovery_authenticated_at timestamptz,
  p_ticket_digest text,
  p_recovery_token_ciphertext text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  affected integer;
begin
  if p_state_digest !~ '^[a-f0-9]{64}$'
    or p_email_digest !~ '^[a-f0-9]{64}$'
    or p_ticket_digest !~ '^[a-f0-9]{64}$'
    or p_user_id is null
    or p_session_id is null
    or p_recovery_authenticated_at is null
    or octet_length(coalesce(p_recovery_token_ciphertext, '')) not between 100 and 6000
    or p_recovery_authenticated_at > statement_timestamp() + interval '5 minutes'
  then
    return false;
  end if;

  if not exists (
    select 1
    from auth.users as account
    where account.id = p_user_id
      and account.email_confirmed_at is not null
      and account.deleted_at is null
      and (
        account.banned_until is null
        or account.banned_until <= statement_timestamp()
      )
  ) or not exists (
    select 1
    from auth.sessions as account_session
    where account_session.id = p_session_id
      and account_session.user_id = p_user_id
      and (
        account_session.not_after is null
        or account_session.not_after > statement_timestamp()
      )
  ) then
    return false;
  end if;

  update private.password_recovery_transactions as recovery
  set
    status = 'bound',
    user_id = p_user_id,
    session_id = p_session_id,
    ticket_digest = p_ticket_digest,
    recovery_token_ciphertext = p_recovery_token_ciphertext,
    recovery_authenticated_at = p_recovery_authenticated_at
  where recovery.state_digest = p_state_digest
    and recovery.email_digest = p_email_digest
    and recovery.status = 'pending'
    and recovery.expires_at > statement_timestamp()
    and p_recovery_authenticated_at >= recovery.issued_at - interval '5 minutes';

  get diagnostics affected = row_count;
  return affected = 1;
exception
  when unique_violation then
    return false;
end;
$function$;

create or replace function public.bluedeck_password_recovery_ticket_is_bound(
  p_ticket_digest text,
  p_user_id uuid,
  p_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, private
as $function$
  select
    p_ticket_digest ~ '^[a-f0-9]{64}$'
    and p_user_id is not null
    and p_session_id is not null
    and exists (
      select 1
      from private.password_recovery_transactions as recovery
      where recovery.ticket_digest = p_ticket_digest
        and recovery.user_id = p_user_id
        and recovery.session_id = p_session_id
        and recovery.status = 'bound'
        and recovery.expires_at > statement_timestamp()
        and exists (
          select 1
          from auth.users as account
          where account.id = recovery.user_id
            and account.email_confirmed_at is not null
            and account.deleted_at is null
            and (
              account.banned_until is null
              or account.banned_until <= statement_timestamp()
            )
        )
        and exists (
          select 1
          from auth.sessions as account_session
          where account_session.id = recovery.session_id
            and account_session.user_id = recovery.user_id
            and (
              account_session.not_after is null
              or account_session.not_after > statement_timestamp()
            )
        )
    );
$function$;

create or replace function public.bluedeck_claim_password_recovery_transaction(
  p_ticket_digest text,
  p_user_id uuid,
  p_session_id uuid,
  p_processing_nonce uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  claimed jsonb;
begin
  if p_ticket_digest !~ '^[a-f0-9]{64}$'
    or p_user_id is null
    or p_session_id is null
    or p_processing_nonce is null
  then
    return null;
  end if;

  update private.password_recovery_transactions as recovery
  set
    status = 'processing',
    processing_nonce = p_processing_nonce,
    processing_started_at = statement_timestamp()
  where recovery.ticket_digest = p_ticket_digest
    and recovery.user_id = p_user_id
    and recovery.session_id = p_session_id
    and recovery.status = 'bound'
    and recovery.expires_at > statement_timestamp()
    and exists (
      select 1
      from auth.users as account
      where account.id = recovery.user_id
        and account.email_confirmed_at is not null
        and account.deleted_at is null
        and (
          account.banned_until is null
          or account.banned_until <= statement_timestamp()
        )
    )
    and exists (
      select 1
      from auth.sessions as account_session
      where account_session.id = recovery.session_id
        and account_session.user_id = recovery.user_id
        and (
          account_session.not_after is null
          or account_session.not_after > statement_timestamp()
        )
    )
  returning jsonb_build_object(
    'userId', recovery.user_id,
    'tokenCiphertext', recovery.recovery_token_ciphertext
  ) into claimed;

  return claimed;
end;
$function$;

create or replace function public.bluedeck_finish_password_recovery_transaction(
  p_processing_nonce uuid,
  p_outcome text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  affected integer;
  normalized_outcome text := lower(btrim(coalesce(p_outcome, '')));
begin
  if p_processing_nonce is null
    or normalized_outcome not in ('consumed', 'indeterminate')
  then
    return false;
  end if;

  update private.password_recovery_transactions as recovery
  set
    status = normalized_outcome,
    processing_nonce = null,
    processing_started_at = null,
    recovery_token_ciphertext = null,
    completed_at = statement_timestamp()
  where recovery.processing_nonce = p_processing_nonce
    and recovery.status = 'processing';

  get diagnostics affected = row_count;
  return affected = 1;
end;
$function$;

create or replace function private.bluedeck_purge_password_recovery_transactions()
returns void
language sql
security definer
set search_path = pg_catalog, private
as $function$
  delete from private.password_recovery_transactions as recovery
  where recovery.expires_at < statement_timestamp() - interval '24 hours'
     or recovery.completed_at < statement_timestamp() - interval '24 hours';
$function$;

revoke all on function public.bluedeck_issue_password_recovery_transaction(
  text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.bluedeck_issue_password_recovery_transaction(
  text, text, timestamptz
) to service_role;

revoke all on function public.bluedeck_activate_password_recovery_transaction(
  text, text
) from public, anon, authenticated;
grant execute on function public.bluedeck_activate_password_recovery_transaction(
  text, text
) to service_role;

revoke all on function public.bluedeck_activate_password_recovery_transaction(
  text
) from public, anon, authenticated;
grant execute on function public.bluedeck_activate_password_recovery_transaction(
  text
) to service_role;

revoke all on function public.bluedeck_cancel_password_recovery_transaction(
  text, text
) from public, anon, authenticated;
grant execute on function public.bluedeck_cancel_password_recovery_transaction(
  text, text
) to service_role;

revoke all on function public.bluedeck_password_recovery_state_is_pending(text)
  from public, anon, authenticated;
grant execute on function public.bluedeck_password_recovery_state_is_pending(text)
  to service_role;

revoke all on function public.bluedeck_bind_password_recovery_transaction(
  text, text, uuid, uuid, timestamptz, text, text
) from public, anon, authenticated;
grant execute on function public.bluedeck_bind_password_recovery_transaction(
  text, text, uuid, uuid, timestamptz, text, text
) to service_role;

revoke all on function public.bluedeck_password_recovery_ticket_is_bound(
  text, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.bluedeck_password_recovery_ticket_is_bound(
  text, uuid, uuid
) to service_role;

revoke all on function public.bluedeck_claim_password_recovery_transaction(
  text, uuid, uuid, uuid
) from public, anon, authenticated;
grant execute on function public.bluedeck_claim_password_recovery_transaction(
  text, uuid, uuid, uuid
) to service_role;

revoke all on function public.bluedeck_finish_password_recovery_transaction(
  uuid, text
) from public, anon, authenticated;
grant execute on function public.bluedeck_finish_password_recovery_transaction(
  uuid, text
) to service_role;

revoke all on function private.bluedeck_purge_password_recovery_transactions()
  from public, anon, authenticated, service_role;

do $schedule$
declare
  existing_job bigint;
begin
  if to_regnamespace('cron') is null
    or to_regclass('cron.job') is null
  then
    raise exception using
      errcode = '0A000',
      message = 'pg_cron must be enabled before password recovery cleanup is scheduled.';
  end if;

  for existing_job in
    select jobid
    from cron.job
    where jobname = 'bluedeck-purge-password-recovery-transactions'
  loop
    perform cron.unschedule(existing_job);
  end loop;

  perform cron.schedule(
    'bluedeck-purge-password-recovery-transactions',
    '17 * * * *',
    $command$select private.bluedeck_purge_password_recovery_transactions();$command$
  );
end;
$schedule$;

comment on table private.password_recovery_transactions is
  'Single-use server-side password recovery transactions; state, ticket and keyed identity values are stored only as digests.';

commit;
