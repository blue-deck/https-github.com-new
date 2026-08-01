-- Transactional production-schema smoke test. No rows survive the rollback.

begin;

do $test$
declare
  access_row public.employer_access%rowtype;
  account_id uuid;
  account_email text;
  expired_invitation_id uuid;
  revocable_invitation_id uuid;
  expired_token text := gen_random_uuid()::text;
  revocable_token text := gen_random_uuid()::text;
  issued_invitation jsonb;
  acceptance_result jsonb;
  stored_invitation public.crew_invitations%rowtype;
begin
  select access.*
  into access_row
  from public.employer_access as access
  where access.status = 'verified'
    and access.can_post_jobs = true
  order by access.created_at
  limit 1;

  if access_row.id is null then
    raise exception 'No verified employer access is available for smoke test.';
  end if;

  select account.id, lower(btrim(account.email))
  into account_id, account_email
  from auth.users as account
  where account.email_confirmed_at is not null
    and account.id <> access_row.user_id
    and nullif(btrim(account.email), '') is not null
  order by account.created_at
  limit 1;

  if account_id is null then
    raise exception 'No confirmed recipient account is available for smoke test.';
  end if;

  select public.bluedeck_issue_crew_invitation(
    access_row.user_id,
    access_row.yacht_id,
    null,
    account_email,
    'Deckhand',
    'Deck',
    expired_token,
    'https://www.bluedeck.app/invitations/' || expired_token
  ) into issued_invitation;
  expired_invitation_id := (issued_invitation ->> 'id')::uuid;

  -- The canonical issuer owns creation; this service-side fixture only moves
  -- its server expiry into the past to exercise the acceptance lifecycle.
  execute 'alter table public.crew_invitations disable trigger crew_invitation_prepare_write';
  update public.crew_invitations
  set expires_at = statement_timestamp() - interval '1 minute'
  where id = expired_invitation_id;
  execute 'alter table public.crew_invitations enable trigger crew_invitation_prepare_write';

  select invitation.*
  into stored_invitation
  from public.crew_invitations as invitation
  where invitation.id = expired_invitation_id;

  if stored_invitation.invited_by is distinct from access_row.user_id then
    raise exception 'Invitation issuer was not derived from current yacht owner.';
  end if;

  acceptance_result := public.bluedeck_accept_crew_invitation(
    expired_token,
    account_id,
    'Smoke Test Crew'
  );

  if acceptance_result ->> 'reason' is distinct from 'expired' then
    raise exception 'Expired invitation was not rejected.';
  end if;

  select public.bluedeck_issue_crew_invitation(
    access_row.user_id,
    access_row.yacht_id,
    null,
    account_email,
    'Deckhand',
    'Deck',
    revocable_token,
    'https://www.bluedeck.app/invitations/' || revocable_token
  ) into issued_invitation;
  revocable_invitation_id := (issued_invitation ->> 'id')::uuid;

  update public.employer_access
  set status = 'suspended',
      reviewed_by = coalesce(access_row.reviewed_by, access_row.user_id),
      review_note = 'Transactional invitation lifecycle smoke test.'
  where id = access_row.id;

  select invitation.*
  into stored_invitation
  from public.crew_invitations as invitation
  where invitation.id = revocable_invitation_id;

  if stored_invitation.status is distinct from 'revoked'
    or stored_invitation.revoked_at is null
  then
    raise exception 'Employer suspension did not revoke pending invitations.';
  end if;
end;
$test$;

rollback;
