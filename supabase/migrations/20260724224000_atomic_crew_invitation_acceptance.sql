-- Accepting an invitation changes three related records. Keep profile
-- resolution, membership activation and invitation acceptance atomic.

begin;

-- Invitations have a bounded lifetime and retain the identity of the verified
-- employer who issued them. A BEFORE trigger also keeps older application
-- versions safe during a rolling deployment by filling these fields.
alter table public.crew_invitations
  add column if not exists invited_by uuid
    references auth.users(id) on delete set null,
  add column if not exists expires_at timestamptz,
  add column if not exists revoked_at timestamptz,
  add column if not exists revoked_by uuid
    references auth.users(id) on delete set null;

update public.crew_invitations as invitation
set invited_by = yacht.owner_id
from public.yachts as yacht
where yacht.id = invitation.yacht_id
  and invitation.invited_by is null;

update public.crew_invitations
set created_at = coalesce(created_at, now()),
    expires_at = coalesce(
      expires_at,
      case
        when status = 'pending' then now() + interval '14 days'
        else coalesce(accepted_at, created_at, now()) + interval '14 days'
      end
    ),
    status = coalesce(nullif(btrim(status), ''), 'pending');

alter table public.crew_invitations
  alter column created_at set default now(),
  alter column created_at set not null,
  alter column expires_at set default (now() + interval '14 days'),
  alter column expires_at set not null,
  alter column status set default 'pending',
  alter column status set not null;

do $block$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.crew_invitations'::regclass
      and conname = 'crew_invitations_status_check'
  ) then
    alter table public.crew_invitations
      add constraint crew_invitations_status_check
      check (status in ('pending', 'accepted', 'revoked', 'expired'));
  end if;
end;
$block$;

create index if not exists crew_invitations_pending_expiry_idx
  on public.crew_invitations (expires_at)
  where status = 'pending';

create index if not exists crew_invitations_issuer_status_idx
  on public.crew_invitations (invited_by, yacht_id, status);

create or replace function public.prepare_crew_invitation_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  current_owner_id uuid;
begin
  if tg_op = 'INSERT' then
    select yacht.owner_id
    into current_owner_id
    from public.yachts as yacht
    where yacht.id = new.yacht_id;

    if current_owner_id is null then
      raise exception using
        errcode = '23503',
        message = 'Invitation yacht owner could not be resolved.';
    end if;

    new.invited_by := coalesce(new.invited_by, current_owner_id);
    if new.invited_by <> current_owner_id then
      raise exception using
        errcode = '42501',
        message = 'Only the current yacht owner may issue an invitation.';
    end if;

    -- During rolling deployments older authenticated clients may still retain
    -- direct table grants. Never trust a caller-supplied owner UUID: a browser
    -- request may insert only for its own yacht. Internal migration sessions
    -- and the service-role API have no authenticated end-user caller here.
    if auth.role() = 'authenticated'
      and auth.uid() is distinct from current_owner_id
    then
      raise exception using
        errcode = '42501',
        message = 'Only the authenticated yacht owner may issue an invitation.';
    end if;

    new.status := 'pending';
    new.created_at := coalesce(new.created_at, now());
    new.expires_at := coalesce(
      new.expires_at,
      new.created_at + interval '14 days'
    );
    new.accepted_at := null;
    new.revoked_at := null;
    new.revoked_by := null;
    return new;
  end if;

  if new.id is distinct from old.id
    or new.yacht_id is distinct from old.yacht_id
    or new.invited_by is distinct from old.invited_by
    or new.token is distinct from old.token
    or new.created_at is distinct from old.created_at
    or new.expires_at is distinct from old.expires_at
  then
    raise exception using
      errcode = '22023',
      message = 'Invitation identity and lifetime fields cannot be changed.';
  end if;

  if new.status is distinct from old.status
    and not (
      old.status = 'pending'
      and new.status in ('accepted', 'revoked', 'expired')
    )
  then
    raise exception using
      errcode = '23514',
      message = format(
        'Invitation cannot move from %s to %s.',
        old.status,
        new.status
      );
  end if;

  if new.status = 'accepted' then
    new.accepted_at := coalesce(new.accepted_at, now());
    new.revoked_at := null;
    new.revoked_by := null;
  elsif new.status = 'revoked' then
    if new.revoked_by is null then
      raise exception using
        errcode = '23502',
        message = 'Revoked invitations require an actor.';
    end if;
    new.revoked_at := coalesce(new.revoked_at, now());
    new.accepted_at := null;
  elsif new.status = 'expired' then
    new.accepted_at := null;
    new.revoked_at := null;
    new.revoked_by := null;
  else
    new.accepted_at := null;
    new.revoked_at := null;
    new.revoked_by := null;
  end if;

  return new;
end;
$function$;

drop trigger if exists crew_invitation_prepare_write
  on public.crew_invitations;
create trigger crew_invitation_prepare_write
before insert or update on public.crew_invitations
for each row execute function public.prepare_crew_invitation_write();

-- Suspending or rejecting an employer immediately invalidates every unused
-- invitation they issued. Restoring access never revives a revoked token.
create or replace function public.revoke_employer_crew_invitations()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if new.status in ('rejected', 'suspended')
    and new.status is distinct from old.status
  then
    update public.crew_invitations
    set status = 'revoked',
        revoked_at = now(),
        revoked_by = coalesce(new.reviewed_by, new.user_id)
    where yacht_id = new.yacht_id
      and invited_by = new.user_id
      and status = 'pending';
  end if;

  return new;
end;
$function$;

drop trigger if exists employer_access_revoke_crew_invitations
  on public.employer_access;
create trigger employer_access_revoke_crew_invitations
after update of status on public.employer_access
for each row execute function public.revoke_employer_crew_invitations();

create or replace function public.bluedeck_accept_crew_invitation(
  p_token text,
  p_user_id uuid,
  p_full_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  account_email text;
  invitation public.crew_invitations%rowtype;
  invited_profile public.crew_profiles%rowtype;
  resolved_profile_id uuid;
  resolved_membership_id uuid;
  invited_membership_id uuid;
  invited_membership_status text;
  normalized_name text;
  was_already_accepted boolean := false;
begin
  select nullif(lower(btrim(account.email)), '')
  into account_email
  from auth.users as account
  where account.id = p_user_id
    and account.email_confirmed_at is not null;

  if account_email is null then
    return jsonb_build_object('ok', false, 'reason', 'verified_email_required');
  end if;

  select invitation_row.*
  into invitation
  from public.crew_invitations as invitation_row
  where invitation_row.token = btrim(coalesce(p_token, ''))
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  if invitation.status = 'revoked' or invitation.revoked_at is not null then
    return jsonb_build_object('ok', false, 'reason', 'revoked');
  end if;

  if invitation.status = 'expired' then
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  if invitation.status = 'pending' and invitation.expires_at <= now() then
    update public.crew_invitations
    set status = 'expired'
    where id = invitation.id
      and status = 'pending';
    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  if coalesce(invitation.status, '') not in ('pending', 'accepted') then
    return jsonb_build_object('ok', false, 'reason', 'inactive');
  end if;

  if invitation.status = 'pending'
    and not exists (
      select 1
      from public.yachts as yacht
      join public.employer_access as access
        on access.yacht_id = yacht.id
       and access.user_id = yacht.owner_id
      where yacht.id = invitation.yacht_id
        and yacht.owner_id = invitation.invited_by
        and access.status = 'verified'
        and access.can_post_jobs = true
    )
  then
    return jsonb_build_object('ok', false, 'reason', 'issuer_inactive');
  end if;

  if invitation.crew_profile_id is not null then
    select profile.*
    into invited_profile
    from public.crew_profiles as profile
    where profile.id = invitation.crew_profile_id
    for update;
  end if;

  if invited_profile.user_id is not null
    and invited_profile.user_id <> p_user_id
  then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  if not (
    coalesce(invited_profile.user_id = p_user_id, false)
    or coalesce(
      nullif(lower(btrim(invitation.invited_email)), '') = account_email,
      false
    )
    or coalesce(
      invited_profile.user_id is null
        and nullif(lower(btrim(invited_profile.email)), '') = account_email,
      false
    )
  ) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  if invitation.status = 'accepted' then
    was_already_accepted := true;

    if invited_profile.user_id = p_user_id then
      return jsonb_build_object(
        'ok', true,
        'already_accepted', true,
        'crew_profile_id', invited_profile.id
      );
    end if;

    if invited_profile.user_id is not null then
      return jsonb_build_object('ok', false, 'reason', 'already_claimed');
    end if;
  end if;

  select profile.id
  into resolved_profile_id
  from public.crew_profiles as profile
  where profile.user_id = p_user_id
  for update;

  if resolved_profile_id is null
    and invited_profile.id is not null
    and invited_profile.user_id is null
    and nullif(lower(btrim(invited_profile.email)), '') = account_email
  then
    update public.crew_profiles
    set user_id = p_user_id,
        email = coalesce(nullif(btrim(email), ''), account_email)
    where id = invited_profile.id
      and user_id is null
    returning id into resolved_profile_id;
  end if;

  if resolved_profile_id is null then
    select profile.id
    into resolved_profile_id
    from public.crew_profiles as profile
    where profile.user_id is null
      and nullif(lower(btrim(profile.email)), '') = account_email
    for update;

    if resolved_profile_id is not null then
      update public.crew_profiles
      set user_id = p_user_id
      where id = resolved_profile_id
        and user_id is null
      returning id into resolved_profile_id;
    end if;
  end if;

  if resolved_profile_id is null then
    normalized_name := left(
      coalesce(
        nullif(btrim(p_full_name), ''),
        split_part(account_email, '@', 1),
        'BlueDeck crew'
      ),
      120
    );

    begin
      insert into public.crew_profiles (user_id, email, full_name)
      values (p_user_id, account_email, normalized_name)
      returning id into resolved_profile_id;
    exception
      when unique_violation then
        select profile.id
        into resolved_profile_id
        from public.crew_profiles as profile
        where profile.user_id = p_user_id;

        if resolved_profile_id is null then
          raise;
        end if;
    end;
  end if;

  select membership.id
  into resolved_membership_id
  from public.yacht_crew_memberships as membership
  where membership.yacht_id = invitation.yacht_id
    and membership.crew_profile_id = resolved_profile_id
  for update;

  select membership.id, membership.status
  into invited_membership_id, invited_membership_status
  from public.yacht_crew_memberships as membership
  where membership.yacht_id = invitation.yacht_id
    and (
      membership.crew_profile_id = invitation.crew_profile_id
      or (
        nullif(lower(btrim(invitation.invited_email)), '') is not null
        and nullif(lower(btrim(membership.invited_email)), '') =
          nullif(lower(btrim(invitation.invited_email)), '')
      )
    )
  order by
    case
      when membership.crew_profile_id = invitation.crew_profile_id then 0
      else 1
    end,
    membership.created_at
  limit 1
  for update;

  if resolved_membership_id is not null
    and invited_membership_id is not null
    and resolved_membership_id <> invited_membership_id
  then
    if lower(coalesce(invited_membership_status, '')) not in ('invited', 'pending') then
      return jsonb_build_object('ok', false, 'reason', 'membership_conflict');
    end if;

    delete from public.yacht_crew_memberships
    where id = invited_membership_id;
    invited_membership_id := null;
  end if;

  if resolved_membership_id is not null then
    update public.yacht_crew_memberships
    set invited_email = coalesce(
          nullif(btrim(invitation.invited_email), ''),
          account_email
        ),
        position = invitation.position,
        department = invitation.department,
        status = 'active'
    where id = resolved_membership_id;
  elsif invited_membership_id is not null then
    update public.yacht_crew_memberships
    set crew_profile_id = resolved_profile_id,
        invited_email = coalesce(
          nullif(btrim(invitation.invited_email), ''),
          account_email
        ),
        position = invitation.position,
        department = invitation.department,
        status = 'active'
    where id = invited_membership_id;
  else
    insert into public.yacht_crew_memberships (
      yacht_id,
      crew_profile_id,
      invited_email,
      position,
      department,
      status
    )
    values (
      invitation.yacht_id,
      resolved_profile_id,
      coalesce(nullif(btrim(invitation.invited_email), ''), account_email),
      invitation.position,
      invitation.department,
      'active'
    );
  end if;

  if was_already_accepted then
    update public.crew_invitations
    set crew_profile_id = resolved_profile_id
    where id = invitation.id
      and status = 'accepted';
  else
    update public.crew_invitations
    set crew_profile_id = resolved_profile_id,
        status = 'accepted',
        accepted_at = now()
    where id = invitation.id
      and status = 'pending';

    if not found then
      raise exception using
        errcode = '40001',
        message = 'Invitation state changed during acceptance.';
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'already_accepted', was_already_accepted,
    'crew_profile_id', resolved_profile_id
  );
end;
$function$;

-- On first authenticated dashboard load, safely claim one unlinked legacy
-- profile whose exact email belongs to the confirmed account and which already
-- participates in an accepted invitation or active yacht membership.
create or replace function public.bluedeck_claim_legacy_crew_profile(
  p_user_id uuid,
  p_full_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  account_email text;
  existing_profile_id uuid;
  candidate_ids uuid[];
  candidate_id uuid;
begin
  select nullif(lower(btrim(account.email)), '')
  into account_email
  from auth.users as account
  where account.id = p_user_id
    and account.email_confirmed_at is not null;

  if account_email is null then
    return jsonb_build_object('ok', false, 'reason', 'verified_email_required');
  end if;

  select profile.id
  into existing_profile_id
  from public.crew_profiles as profile
  where profile.user_id = p_user_id
  for update;

  if existing_profile_id is not null then
    return jsonb_build_object(
      'ok', true,
      'claimed', false,
      'already_linked', true,
      'crew_profile_id', existing_profile_id
    );
  end if;

  select array_agg(profile.id order by profile.created_at, profile.id)
  into candidate_ids
  from public.crew_profiles as profile
  where profile.user_id is null
    and nullif(lower(btrim(profile.email)), '') = account_email
    and (
      exists (
        select 1
        from public.yacht_crew_memberships as membership
        where membership.crew_profile_id = profile.id
          and lower(btrim(coalesce(membership.status, ''))) = 'active'
      )
      or exists (
        select 1
        from public.crew_invitations as accepted_invitation
        where accepted_invitation.crew_profile_id = profile.id
          and accepted_invitation.status = 'accepted'
          and (
            nullif(lower(btrim(accepted_invitation.invited_email)), '')
              = account_email
            or nullif(lower(btrim(profile.email)), '') = account_email
          )
      )
    );

  if candidate_ids is null or cardinality(candidate_ids) = 0 then
    return jsonb_build_object('ok', true, 'claimed', false);
  end if;

  if cardinality(candidate_ids) <> 1 then
    return jsonb_build_object('ok', false, 'reason', 'ambiguous');
  end if;

  candidate_id := candidate_ids[1];
  perform 1
  from public.crew_profiles as profile
  where profile.id = candidate_id
    and profile.user_id is null
  for update;

  update public.crew_profiles
  set user_id = p_user_id,
      full_name = coalesce(
        nullif(btrim(full_name), ''),
        left(nullif(btrim(p_full_name), ''), 120),
        split_part(account_email, '@', 1)
      )
  where id = candidate_id
    and user_id is null
  returning id into candidate_id;

  if candidate_id is null then
    raise exception using
      errcode = '40001',
      message = 'Legacy crew profile changed during claim.';
  end if;

  return jsonb_build_object(
    'ok', true,
    'claimed', true,
    'crew_profile_id', candidate_id
  );
exception
  when unique_violation then
    return jsonb_build_object('ok', false, 'reason', 'conflict');
end;
$function$;

revoke all on function public.bluedeck_accept_crew_invitation(
  text,
  uuid,
  text
) from public, anon, authenticated;
grant execute on function public.bluedeck_accept_crew_invitation(
  text,
  uuid,
  text
) to service_role;

revoke all on function public.bluedeck_claim_legacy_crew_profile(
  uuid,
  text
) from public, anon, authenticated;
grant execute on function public.bluedeck_claim_legacy_crew_profile(
  uuid,
  text
) to service_role;

revoke all on function public.prepare_crew_invitation_write()
  from public, anon, authenticated, service_role;
revoke all on function public.revoke_employer_crew_invitations()
  from public, anon, authenticated, service_role;

comment on function public.bluedeck_accept_crew_invitation(text, uuid, text)
is 'Atomically accepts one crew invitation for a server-authenticated user.';
comment on function public.bluedeck_claim_legacy_crew_profile(uuid, text)
is 'Claims one unambiguous legacy crew profile for a confirmed account email.';

commit;
