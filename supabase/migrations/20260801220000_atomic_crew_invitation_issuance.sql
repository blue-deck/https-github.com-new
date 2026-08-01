-- Resolve invitation identity and create the invitation/membership pair in one
-- authority-locked transaction. Email invitations use canonical Auth email,
-- never the client-writable crew_profiles.email field.

begin;

create schema if not exists private;

alter table public.crew_invitations
  add column if not exists identity_mode text;

create table if not exists private.crew_invitation_targets (
  invitation_id uuid primary key
    references public.crew_invitations(id) on delete cascade,
  -- Deliberately not an Auth FK: this opaque binding must survive account
  -- deletion so a later account reusing the same email cannot inherit history.
  target_user_id uuid not null,
  created_at timestamptz not null default statement_timestamp()
);

create table if not exists private.crew_invitation_placeholders (
  yacht_id uuid not null references public.yachts(id) on delete cascade,
  normalized_email text not null,
  crew_profile_id uuid not null
    references public.crew_profiles(id) on delete cascade,
  created_at timestamptz not null default statement_timestamp(),
  primary key (yacht_id, normalized_email),
  unique (crew_profile_id),
  check (
    octet_length(normalized_email) <= 254
    and normalized_email = lower(btrim(normalized_email))
  )
);

-- Preserve issuer/reviewer UUIDs as immutable audit snapshots after account
-- deletion. The original ON DELETE SET NULL foreign keys caused the existing
-- invitation immutability trigger to block Auth deletion and erased the actor
-- from the audit record. Insert authority is independently enforced below.
do $constraints$
declare
  constraint_row record;
begin
  for constraint_row in
    select constraint_definition.conname
    from pg_catalog.pg_constraint as constraint_definition
    where constraint_definition.conrelid = 'public.crew_invitations'::regclass
      and constraint_definition.confrelid = 'auth.users'::regclass
      and constraint_definition.contype = 'f'
      and exists (
        select 1
        from unnest(constraint_definition.conkey) as column_key(attnum)
        inner join pg_catalog.pg_attribute as attribute
          on attribute.attrelid = constraint_definition.conrelid
         and attribute.attnum = column_key.attnum
        where attribute.attname in ('invited_by', 'revoked_by')
      )
  loop
    execute format(
      'alter table public.crew_invitations drop constraint %I',
      constraint_row.conname
    );
  end loop;
end;
$constraints$;

update public.crew_invitations as invitation
set identity_mode = case
      when nullif(btrim(invitation.invited_email), '') is not null then 'email'
      else 'crew_id'
    end
from public.crew_profiles as profile
where profile.id = invitation.crew_profile_id
  and invitation.identity_mode is null;

update public.crew_invitations
set identity_mode = case
  when nullif(btrim(invited_email), '') is not null then 'email'
  else 'crew_id'
end
where identity_mode is null;

update public.crew_invitations
set invited_email = lower(btrim(invited_email))
where invited_email is not null
  and invited_email is distinct from lower(btrim(invited_email));

alter table public.crew_invitations
  alter column identity_mode set not null;

update public.crew_invitations
set status = 'expired'
where status = 'pending'
  and expires_at <= statement_timestamp();

insert into private.crew_invitation_targets (invitation_id, target_user_id)
select invitation.id, profile.user_id
from public.crew_invitations as invitation
inner join public.crew_profiles as profile
  on profile.id = invitation.crew_profile_id
where invitation.identity_mode = 'crew_id'
  and profile.user_id is not null
on conflict (invitation_id) do nothing;

-- Historical email records must never attach to whichever account owns an
-- address today. Tombstone terminal rows before binding live pending email
-- invitations; immutable Crew-ID rows above retain their real profile owner.
insert into private.crew_invitation_targets (invitation_id, target_user_id)
select invitation.id, gen_random_uuid()
from public.crew_invitations as invitation
where invitation.status <> 'pending'
on conflict (invitation_id) do nothing;

insert into private.crew_invitation_targets (invitation_id, target_user_id)
select invitation.id, account.id
from public.crew_invitations as invitation
inner join auth.users as account
  on lower(btrim(account.email)) = lower(btrim(invitation.invited_email))
where invitation.identity_mode = 'email'
  and invitation.status = 'pending'
  and invitation.expires_at > statement_timestamp()
  and account.email_confirmed_at is not null
  and account.deleted_at is null
  and (
    account.banned_until is null
    or account.banned_until <= statement_timestamp()
  )
on conflict (invitation_id) do nothing;

-- Only profiles already attached to a real email invitation are eligible for
-- legacy placeholder reuse. An arbitrary unlinked profile is never trusted
-- merely because its mutable email happens to match.
insert into private.crew_invitation_placeholders (
  yacht_id,
  normalized_email,
  crew_profile_id
)
select distinct on (
    invitation.yacht_id,
    lower(btrim(invitation.invited_email))
  )
  invitation.yacht_id,
  lower(btrim(invitation.invited_email)),
  invitation.crew_profile_id
from public.crew_invitations as invitation
inner join public.crew_profiles as profile
  on profile.id = invitation.crew_profile_id
 and profile.user_id is null
where invitation.identity_mode = 'email'
  and invitation.status = 'pending'
  and invitation.expires_at > statement_timestamp()
  and nullif(lower(btrim(invitation.invited_email)), '') is not null
  and octet_length(lower(btrim(invitation.invited_email))) <= 254
order by
  invitation.yacht_id,
  lower(btrim(invitation.invited_email)),
  invitation.created_at,
  invitation.id
on conflict do nothing;

alter table public.crew_invitations
  drop constraint if exists crew_invitations_identity_mode_check;
alter table public.crew_invitations
  add constraint crew_invitations_identity_mode_check check (
    identity_mode in ('crew_id', 'email')
    and (
      identity_mode <> 'email'
      or nullif(btrim(coalesce(invited_email, '')), '') is not null
    )
  );

create or replace function private.bluedeck_has_yacht_invitation_authority(
  p_actor_user_id uuid,
  p_yacht_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
  select
    private.bluedeck_has_job_publisher_authority(p_actor_user_id)
    and exists (
      select 1
      from public.yachts as yacht
      inner join public.employer_access as access
        on access.yacht_id = yacht.id
       and access.user_id = p_actor_user_id
      where yacht.id = p_yacht_id
        and yacht.owner_id = p_actor_user_id
        and access.status = 'verified'
        and access.can_post_jobs is true
    );
$function$;

create or replace function private.bluedeck_guard_crew_invitation_identity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if tg_op = 'UPDATE' then
    if new.identity_mode is distinct from old.identity_mode
      or new.invited_email is distinct from old.invited_email
      or new.public_crew_id is distinct from old.public_crew_id
    then
      raise exception using
        errcode = '22023',
        message = 'Invitation recipient identity is immutable.';
    end if;
    return new;
  end if;

  if nullif(btrim(coalesce(new.identity_mode, '')), '') is null then
    raise exception using
      errcode = '42501',
      message = 'Invitation issuance must use the canonical server workflow.';
  end if;

  new.invited_email := nullif(lower(btrim(coalesce(new.invited_email, ''))), '');
  new.identity_mode := lower(btrim(new.identity_mode));

  if new.identity_mode not in ('crew_id', 'email') then
    raise exception using
      errcode = '23514',
      message = 'Invitation identity mode is invalid.';
  end if;

  if new.identity_mode = 'email' then
    if new.invited_email is null
      or char_length(new.invited_email) > 254
      or new.invited_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    then
      raise exception using
        errcode = '23514',
        message = 'Email invitation identity is invalid.';
    end if;

  elsif new.crew_profile_id is null then
    raise exception using
      errcode = '23514',
      message = 'Crew ID invitations require a crew profile.';
  end if;

  return new;
end;
$function$;

create or replace function private.bluedeck_sync_crew_invitation_target()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  resolved_target_user_id uuid;
begin
  if new.status <> 'pending'
    or new.expires_at <= statement_timestamp()
  then
    insert into private.crew_invitation_targets (
      invitation_id,
      target_user_id
    ) values (
      new.id,
      gen_random_uuid()
    )
    on conflict (invitation_id) do nothing;
    return new;
  end if;

  if new.identity_mode = 'email' then
    select account.id
    into resolved_target_user_id
    from auth.users as account
    where lower(btrim(account.email)) = lower(btrim(new.invited_email))
      and account.email_confirmed_at is not null
      and account.deleted_at is null
      and (
        account.banned_until is null
        or account.banned_until <= statement_timestamp()
      )
    for share;
  else
    select profile.user_id
    into resolved_target_user_id
    from public.crew_profiles as profile
    where profile.id = new.crew_profile_id;
  end if;

  if resolved_target_user_id is not null then
    insert into private.crew_invitation_targets (
      invitation_id,
      target_user_id
    ) values (
      new.id,
      resolved_target_user_id
    )
    on conflict (invitation_id) do update
      set target_user_id = excluded.target_user_id;
  end if;

  return new;
end;
$function$;

create or replace function private.bluedeck_bind_email_invitation_targets()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  normalized_account_email text;
begin
  if new.email_confirmed_at is null
    or new.deleted_at is not null
    or (
      new.banned_until is not null
      and new.banned_until > statement_timestamp()
    )
  then
    return new;
  end if;

  normalized_account_email := nullif(lower(btrim(new.email)), '');
  if normalized_account_email is null then
    return new;
  end if;

  insert into private.crew_invitation_targets (
    invitation_id,
    target_user_id
  )
  select invitation.id, new.id
  from public.crew_invitations as invitation
  where invitation.identity_mode = 'email'
    and invitation.status = 'pending'
    and invitation.expires_at > statement_timestamp()
    and lower(btrim(coalesce(invitation.invited_email, ''))) =
      normalized_account_email
  -- DO NOTHING is intentional: the first canonical account binding is a
  -- permanent snapshot, so replacement accounts cannot inherit history.
  on conflict (invitation_id) do nothing;

  return new;
end;
$function$;

drop trigger if exists crew_invitation_00_identity_guard
  on public.crew_invitations;
create trigger crew_invitation_00_identity_guard
before insert or update on public.crew_invitations
for each row execute function private.bluedeck_guard_crew_invitation_identity();

drop trigger if exists crew_invitation_10_sync_private_target
  on public.crew_invitations;
create trigger crew_invitation_10_sync_private_target
after insert on public.crew_invitations
for each row execute function private.bluedeck_sync_crew_invitation_target();

drop trigger if exists auth_users_bind_email_crew_invitations
  on auth.users;
create trigger auth_users_bind_email_crew_invitations
after insert or update of email, email_confirmed_at, deleted_at, banned_until
on auth.users
for each row execute function private.bluedeck_bind_email_invitation_targets();

create or replace function private.bluedeck_is_own_invitation(
  target_invitation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
  select
    auth.uid() is not null
    and target_invitation_id is not null
    and exists (
      select 1
      from public.crew_invitations as invitation
      left join private.crew_invitation_targets as target
        on target.invitation_id = invitation.id
      left join public.crew_profiles as profile
        on profile.id = invitation.crew_profile_id
      where invitation.id = target_invitation_id
        and (
          (
            invitation.identity_mode = 'email'
            and target.target_user_id = auth.uid()
          )
          or (
            invitation.identity_mode = 'crew_id'
            and profile.user_id = auth.uid()
            and target.target_user_id = auth.uid()
          )
        )
    );
$function$;

create or replace function public.bluedeck_issue_crew_invitation(
  p_actor_user_id uuid,
  p_yacht_id uuid,
  p_crew_id text,
  p_invited_email text,
  p_position text,
  p_department text,
  p_token text,
  p_invite_link text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  normalized_crew_id text := upper(btrim(coalesce(p_crew_id, '')));
  normalized_recipient_email text := lower(btrim(coalesce(p_invited_email, '')));
  normalized_position text := btrim(coalesce(p_position, ''));
  normalized_department text := btrim(coalesce(p_department, ''));
  recipient_identity_mode text;
  target_profile public.crew_profiles%rowtype;
  target_user_id uuid;
  target_auth_email text;
  target_account_confirmed_at timestamptz;
  target_account_deleted_at timestamptz;
  target_account_banned_until timestamptz;
  matched_profile_ids uuid[];
  existing_membership public.yacht_crew_memberships%rowtype;
  invitation_id uuid;
  invitation_expires_at timestamptz :=
    statement_timestamp() + interval '14 days';
begin
  if p_actor_user_id is null
    or p_yacht_id is null
    or char_length(normalized_position) not between 1 and 80
    or char_length(normalized_department) not between 1 and 80
    or coalesce(p_token, '') !~ '^[0-9a-fA-F-]{36}$'
    or char_length(coalesce(p_invite_link, '')) not between 1 and 500
    or position(p_token in p_invite_link) = 0
  then
    raise exception using errcode = '22023', message = 'Invalid invitation request.';
  end if;

  if normalized_crew_id = '' and normalized_recipient_email = '' then
    raise exception using
      errcode = '22023', message = 'An invitation identity is required.';
  end if;

  perform 1 from auth.users where id = p_actor_user_id for share;
  perform 1 from public.marketplace_entitlements
    where user_id = p_actor_user_id for share;
  perform 1 from public.yachts where id = p_yacht_id for share;
  perform 1 from public.employer_access
    where user_id = p_actor_user_id and yacht_id = p_yacht_id for share;

  if not private.bluedeck_has_yacht_invitation_authority(
    p_actor_user_id,
    p_yacht_id
  ) then
    raise exception using
      errcode = '42501',
      message = 'Current verified yacht hiring authority is required.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_yacht_id::text || ':' || coalesce(
        nullif(normalized_crew_id, ''),
        normalized_recipient_email
      ),
      0
    )
  );

  if normalized_crew_id <> '' then
    recipient_identity_mode := 'crew_id';
    if normalized_crew_id !~ '^[A-Z0-9_-]{1,64}$' then
      raise exception using errcode = '22023', message = 'Invalid Crew ID.';
    end if;

    select profile
    into target_profile
    from public.crew_profiles as profile
    inner join public.marketplace_entitlements as entitlement
      on entitlement.user_id = profile.user_id
     and entitlement.account_role in ('crew', 'captain')
    inner join auth.users as account
      on account.id = profile.user_id
     and account.email_confirmed_at is not null
     and account.deleted_at is null
     and (
       account.banned_until is null
       or account.banned_until <= statement_timestamp()
     )
    where profile.status = 'active'
      and upper(btrim(profile.public_crew_id)) = normalized_crew_id
      and profile.notes like '__BLUDECK_FIND_CREW__%'
      and private.bluedeck_try_jsonb(
        substr(
          split_part(profile.notes, E'\n', 1),
          length('__BLUDECK_FIND_CREW__') + 1
        )
      ) ->> 'discoverable' = 'true'
      and coalesce(
        private.bluedeck_try_jsonb(
          substr(
            split_part(profile.notes, E'\n', 1),
            length('__BLUDECK_FIND_CREW__') + 1
          )
        ) ->> 'contactVisibility',
        'request_only'
      ) <> 'hidden'
    for share of profile, account;

    if target_profile.id is null then
      raise exception using errcode = 'P0002', message = 'Crew profile not found.';
    end if;

    select lower(btrim(account.email))
    into target_auth_email
    from auth.users as account
    where account.id = target_profile.user_id;

    if normalized_recipient_email <> ''
      and normalized_recipient_email <> target_auth_email
    then
      raise exception using
        errcode = '22023',
        message = 'Crew ID and canonical account email do not match.';
    end if;
    target_user_id := target_profile.user_id;
    normalized_recipient_email := '';
  else
    recipient_identity_mode := 'email';
    if char_length(normalized_recipient_email) > 254
      or normalized_recipient_email !~
        '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
    then
      raise exception using errcode = '22023', message = 'Invalid crew email.';
    end if;

    select
      account.id,
      lower(btrim(account.email)),
      account.email_confirmed_at,
      account.deleted_at,
      account.banned_until
    into
      target_user_id,
      target_auth_email,
      target_account_confirmed_at,
      target_account_deleted_at,
      target_account_banned_until
    from auth.users as account
    where lower(btrim(account.email)) = normalized_recipient_email
    for share;

    if target_user_id is not null and (
      target_account_confirmed_at is null
      or target_account_deleted_at is not null
      or (
        target_account_banned_until is not null
        and target_account_banned_until > statement_timestamp()
      )
    ) then
      raise exception using errcode = 'P0001', message = 'Crew account is inactive.';
    end if;

    -- Expire and de-duplicate by canonical email before creating or resolving a
    -- placeholder profile. Otherwise every reissue for an unregistered email
    -- could strand another profile while the old pending row blocks the new
    -- invitation's email uniqueness constraint.
    update public.crew_invitations as invitation
    set status = 'expired'
    where invitation.yacht_id = p_yacht_id
      and invitation.identity_mode = 'email'
      and lower(btrim(coalesce(invitation.invited_email, ''))) =
        normalized_recipient_email
      and invitation.status = 'pending'
      and invitation.expires_at <= statement_timestamp();

    if exists (
      select 1
      from public.crew_invitations as invitation
      where invitation.yacht_id = p_yacht_id
        and invitation.identity_mode = 'email'
        and lower(btrim(coalesce(invitation.invited_email, ''))) =
          normalized_recipient_email
        and invitation.status = 'pending'
        and invitation.expires_at > statement_timestamp()
    ) then
      raise exception using errcode = '23505', message = 'A pending invitation already exists.';
    end if;

    -- A terminal placeholder is history, not reusable identity. Reissuing to
    -- the same mailbox allocates a fresh profile, while the old invitation
    -- remains bound to its original target/tombstone.
    delete from private.crew_invitation_placeholders as placeholder
    where placeholder.yacht_id = p_yacht_id
      and placeholder.normalized_email = normalized_recipient_email;

    if target_user_id is not null then
      select array_agg(profile.id order by profile.created_at, profile.id)
      into matched_profile_ids
      from public.crew_profiles as profile
      where profile.user_id = target_user_id;

      if cardinality(coalesce(matched_profile_ids, '{}'::uuid[])) > 1 then
        raise exception using errcode = '23505', message = 'Crew account profile is ambiguous.';
      end if;

      if cardinality(coalesce(matched_profile_ids, '{}'::uuid[])) = 1 then
        select profile.* into target_profile
        from public.crew_profiles as profile
        where profile.id = matched_profile_ids[1]
        for update;
      else
        insert into public.crew_profiles (
          user_id, email, full_name, current_position, status
        )
        values (
          target_user_id,
          normalized_recipient_email,
          left(split_part(normalized_recipient_email, '@', 1), 120),
          normalized_position,
          'active'
        )
        returning * into target_profile;
      end if;
    else
      -- Unregistered placeholders deliberately do not copy the mailbox into a
      -- mutable profile field. The invitation and private target ledger own
      -- recipient identity, and a terminal reissue can therefore allocate a
      -- fresh profile without colliding with historical/poisoned email rows.
      select profile.*
      into target_profile
      from private.crew_invitation_placeholders as placeholder
      inner join public.crew_profiles as profile
        on profile.id = placeholder.crew_profile_id
       and profile.user_id is null
      where placeholder.yacht_id = p_yacht_id
        and placeholder.normalized_email = normalized_recipient_email
      for update of placeholder, profile;

      if target_profile.id is null then
        insert into public.crew_profiles (
          full_name, current_position, status
        )
        values (
          left(split_part(normalized_recipient_email, '@', 1), 120),
          normalized_position,
          'active'
        )
        returning * into target_profile;

        insert into private.crew_invitation_placeholders (
          yacht_id,
          normalized_email,
          crew_profile_id
        ) values (
          p_yacht_id,
          normalized_recipient_email,
          target_profile.id
        );
      end if;
    end if;
  end if;

  update public.crew_invitations as invitation
  set status = 'expired'
  where invitation.yacht_id = p_yacht_id
    and invitation.crew_profile_id = target_profile.id
    and invitation.status = 'pending'
    and invitation.expires_at <= statement_timestamp();

  if exists (
    select 1
    from public.crew_invitations as invitation
    where invitation.yacht_id = p_yacht_id
      and invitation.crew_profile_id = target_profile.id
      and invitation.status = 'pending'
      and invitation.expires_at > statement_timestamp()
  ) then
    raise exception using errcode = '23505', message = 'A pending invitation already exists.';
  end if;

  select membership.*
  into existing_membership
  from public.yacht_crew_memberships as membership
  where membership.yacht_id = p_yacht_id
    and (
      membership.crew_profile_id = target_profile.id
      or (
        recipient_identity_mode = 'email'
        and lower(btrim(coalesce(membership.invited_email, ''))) =
          normalized_recipient_email
        and lower(btrim(coalesce(membership.status, ''))) in (
          'pending',
          'invited'
        )
      )
    )
  order by
    case when membership.crew_profile_id = target_profile.id then 0 else 1 end,
    membership.created_at,
    membership.id
  limit 1
  for update;

  if lower(btrim(coalesce(existing_membership.status, ''))) = 'active' then
    raise exception using errcode = '23505', message = 'Crew member is already active.';
  end if;

  insert into public.crew_invitations (
    yacht_id,
    crew_profile_id,
    invited_by,
    invited_email,
    public_crew_id,
    position,
    department,
    status,
    token,
    invite_link,
    expires_at,
    identity_mode
  )
  values (
    p_yacht_id,
    target_profile.id,
    p_actor_user_id,
    case
      when recipient_identity_mode = 'email' then normalized_recipient_email
      else null
    end,
    case
      when recipient_identity_mode = 'crew_id' then target_profile.public_crew_id
      else null
    end,
    normalized_position,
    normalized_department,
    'pending',
    p_token,
    p_invite_link,
    invitation_expires_at,
    recipient_identity_mode
  )
  returning id into invitation_id;

  if existing_membership.id is not null then
    update public.yacht_crew_memberships
    set crew_profile_id = target_profile.id,
        invited_email = case
          when recipient_identity_mode = 'email' then normalized_recipient_email
          else null
        end,
        position = normalized_position,
        department = normalized_department,
        status = 'invited'
    where id = existing_membership.id;
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
      p_yacht_id,
      target_profile.id,
      case
        when recipient_identity_mode = 'email' then normalized_recipient_email
        else null
      end,
      normalized_position,
      normalized_department,
      'invited'
    );
  end if;

  return jsonb_build_object(
    'id', invitation_id,
    'crew_profile_id', target_profile.id,
    'position', normalized_position,
    'department', normalized_department,
    'expires_at', invitation_expires_at
  );
end;
$function$;

-- Keep the proven profile/membership merge core, but put a canonical Auth and
-- issuer-authority wrapper in front of every callable acceptance path.
do $block$
begin
  if to_regprocedure(
    'public.bluedeck_accept_crew_invitation_core(text,uuid,text)'
  ) is null then
    alter function public.bluedeck_accept_crew_invitation(text, uuid, text)
      rename to bluedeck_accept_crew_invitation_core;
  end if;
end;
$block$;

create or replace function public.bluedeck_accept_crew_invitation(
  p_token text,
  p_user_id uuid,
  p_full_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  invitation_identity record;
  account_email text;
  pinned_target_user_id uuid;
begin
  select lower(btrim(account.email))
  into account_email
  from auth.users as account
  where account.id = p_user_id
    and account.email_confirmed_at is not null
    and account.deleted_at is null
    and (
      account.banned_until is null
      or account.banned_until <= statement_timestamp()
    )
  for share;

  if account_email is null then
    return jsonb_build_object('ok', false, 'reason', 'verified_email_required');
  end if;

  select
    invitation.id,
    invitation.invited_by,
    invitation.yacht_id,
    invitation.identity_mode,
    target.target_user_id,
    invitation.invited_email,
    invitation.status,
    invitation.expires_at,
    profile.user_id as profile_user_id
  into invitation_identity
  from public.crew_invitations as invitation
  left join private.crew_invitation_targets as target
    on target.invitation_id = invitation.id
  left join public.crew_profiles as profile
    on profile.id = invitation.crew_profile_id
  where invitation.token = btrim(coalesce(p_token, ''));

  if invitation_identity.yacht_id is null then
    return jsonb_build_object('ok', false, 'reason', 'not_found');
  end if;

  perform 1 from auth.users
    where id = invitation_identity.invited_by for share;
  perform 1 from public.marketplace_entitlements
    where user_id = invitation_identity.invited_by for share;
  perform 1 from public.yachts
    where id = invitation_identity.yacht_id for share;
  perform 1 from public.employer_access
    where user_id = invitation_identity.invited_by
      and yacht_id = invitation_identity.yacht_id
    for share;

  select
    invitation.id,
    invitation.invited_by,
    invitation.yacht_id,
    invitation.identity_mode,
    target.target_user_id,
    invitation.invited_email,
    invitation.status,
    invitation.expires_at,
    profile.user_id as profile_user_id
  into invitation_identity
  from public.crew_invitations as invitation
  left join private.crew_invitation_targets as target
    on target.invitation_id = invitation.id
  left join public.crew_profiles as profile
    on profile.id = invitation.crew_profile_id
  where invitation.token = btrim(coalesce(p_token, ''))
  for update of invitation;

  if invitation_identity.status = 'pending'
    and invitation_identity.expires_at <= statement_timestamp()
  then
    update public.crew_invitations
    set status = 'expired'
    where id = invitation_identity.id
      and status = 'pending';

    insert into private.crew_invitation_targets (
      invitation_id,
      target_user_id
    ) values (
      invitation_identity.id,
      gen_random_uuid()
    )
    on conflict (invitation_id) do nothing;

    return jsonb_build_object('ok', false, 'reason', 'expired');
  end if;

  if invitation_identity.identity_mode = 'email' and (
    lower(btrim(coalesce(invitation_identity.invited_email, ''))) <>
      account_email
    or (
      invitation_identity.target_user_id is not null
      and invitation_identity.target_user_id <> p_user_id
    )
  ) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  if invitation_identity.identity_mode = 'crew_id' and (
    invitation_identity.profile_user_id is distinct from p_user_id
    or (
      invitation_identity.target_user_id is not null
      and invitation_identity.target_user_id <> p_user_id
    )
  ) then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  -- Pin an unbound pre-account invitation to the first verified canonical
  -- account inside this same locked transaction. The immutable conflict path
  -- prevents a later account reusing the email from accepting old history.
  if invitation_identity.target_user_id is null
    and invitation_identity.status = 'pending'
  then
    insert into private.crew_invitation_targets (
      invitation_id,
      target_user_id
    ) values (
      invitation_identity.id,
      p_user_id
    )
    on conflict (invitation_id) do nothing;
  end if;

  select target.target_user_id
  into pinned_target_user_id
  from private.crew_invitation_targets as target
  where target.invitation_id = invitation_identity.id;

  if pinned_target_user_id is distinct from p_user_id then
    return jsonb_build_object('ok', false, 'reason', 'forbidden');
  end if;

  if invitation_identity.status = 'pending'
    and not private.bluedeck_has_yacht_invitation_authority(
      invitation_identity.invited_by,
      invitation_identity.yacht_id
    )
  then
    return jsonb_build_object('ok', false, 'reason', 'issuer_inactive');
  end if;

  return public.bluedeck_accept_crew_invitation_core(
    p_token,
    p_user_id,
    p_full_name
  );
end;
$function$;

create or replace function private.bluedeck_revoke_invitations_on_entitlement_loss()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  affected_user_id uuid := case
    when tg_op = 'DELETE' then old.user_id else new.user_id
  end;
begin
  if tg_op = 'DELETE'
    or (
      new.posting_status = 'suspended'
      and new.posting_status is distinct from old.posting_status
    )
  then
    update public.crew_invitations
    set status = 'revoked',
        revoked_at = statement_timestamp(),
        revoked_by = affected_user_id
    where invited_by = affected_user_id
      and status = 'pending';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

drop trigger if exists marketplace_entitlements_revoke_crew_invitations
  on public.marketplace_entitlements;
create trigger marketplace_entitlements_revoke_crew_invitations
after update of posting_status or delete on public.marketplace_entitlements
for each row execute function private.bluedeck_revoke_invitations_on_entitlement_loss();

create or replace function private.bluedeck_revoke_invitations_on_account_loss()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if tg_op = 'DELETE'
    or new.email_confirmed_at is null
    or new.deleted_at is not null
    or (
      new.banned_until is not null
      and new.banned_until > statement_timestamp()
    )
  then
    delete from private.crew_invitation_placeholders as placeholder
    using public.crew_profiles as profile
    where profile.id = placeholder.crew_profile_id
      and (
        profile.user_id = old.id
        or exists (
          select 1
          from public.crew_invitations as invitation
          inner join private.crew_invitation_targets as target
            on target.invitation_id = invitation.id
           and target.target_user_id = old.id
          where invitation.crew_profile_id = profile.id
        )
      );

    update public.crew_invitations
    set status = 'revoked',
        revoked_at = statement_timestamp(),
        revoked_by = old.id
    where invited_by = old.id
      and status = 'pending';

    update public.crew_invitations as invitation
    set status = 'expired'
    where invitation.status = 'pending'
      and exists (
        select 1
        from private.crew_invitation_targets as target
        where target.invitation_id = invitation.id
          and target.target_user_id = old.id
      );
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

drop trigger if exists auth_users_revoke_crew_invitations
  on auth.users;
create trigger auth_users_revoke_crew_invitations
before update of email_confirmed_at, deleted_at, banned_until or delete
on auth.users
for each row execute function private.bluedeck_revoke_invitations_on_account_loss();

-- Replace the legacy email/membership claim heuristic with durable invitation
-- provenance. A mutable unlinked profile email is never authorization.
create or replace function public.bluedeck_claim_legacy_crew_profile(
  p_user_id uuid,
  p_full_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
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
    and account.email_confirmed_at is not null
    and account.deleted_at is null
    and (
      account.banned_until is null
      or account.banned_until <= statement_timestamp()
    )
  for share;

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
    and exists (
      select 1
      from public.crew_invitations as invitation
      inner join private.crew_invitation_targets as target
        on target.invitation_id = invitation.id
       and target.target_user_id = p_user_id
      where invitation.crew_profile_id = profile.id
        and invitation.identity_mode = 'email'
        and (
          invitation.status = 'accepted'
          or (
            invitation.status = 'pending'
            and invitation.expires_at > statement_timestamp()
          )
        )
        and lower(btrim(coalesce(invitation.invited_email, ''))) =
          account_email
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
    and exists (
      select 1
      from public.crew_invitations as invitation
      inner join private.crew_invitation_targets as target
        on target.invitation_id = invitation.id
       and target.target_user_id = p_user_id
      where invitation.crew_profile_id = profile.id
        and invitation.identity_mode = 'email'
        and (
          invitation.status = 'accepted'
          or (
            invitation.status = 'pending'
            and invitation.expires_at > statement_timestamp()
          )
        )
        and lower(btrim(coalesce(invitation.invited_email, ''))) =
          account_email
    )
  for update;

  if not found then
    raise exception using
      errcode = '40001',
      message = 'Legacy crew profile provenance changed during claim.';
  end if;

  update public.crew_profiles
  set user_id = p_user_id,
      email = account_email,
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

revoke all on function private.bluedeck_has_yacht_invitation_authority(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_guard_crew_invitation_identity()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_sync_crew_invitation_target()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_bind_email_invitation_targets()
  from public, anon, authenticated, service_role;
revoke all privileges on table private.crew_invitation_targets
  from public, anon, authenticated, service_role;
revoke all privileges on table private.crew_invitation_placeholders
  from public, anon, authenticated, service_role;
revoke all on function public.bluedeck_issue_crew_invitation(
  uuid, uuid, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.bluedeck_issue_crew_invitation(
  uuid, uuid, text, text, text, text, text, text
) to service_role;
revoke all on function public.bluedeck_accept_crew_invitation_core(text, uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function public.bluedeck_accept_crew_invitation(text, uuid, text)
  from public, anon, authenticated;
grant execute on function public.bluedeck_accept_crew_invitation(text, uuid, text)
  to service_role;
revoke all on function public.bluedeck_claim_legacy_crew_profile(uuid, text)
  from public, anon, authenticated;
grant execute on function public.bluedeck_claim_legacy_crew_profile(uuid, text)
  to service_role;
revoke all on function private.bluedeck_revoke_invitations_on_entitlement_loss()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_revoke_invitations_on_account_loss()
  from public, anon, authenticated, service_role;

comment on function public.bluedeck_issue_crew_invitation(
  uuid, uuid, text, text, text, text, text, text
) is
  'Atomic service-only invitation issuance using current publisher authority and canonical Auth email identity.';

comment on function public.bluedeck_accept_crew_invitation(text, uuid, text) is
  'Service-only invitation acceptance wrapper. The caller API authenticates the session and supplies the canonical Auth user id.';

commit;
