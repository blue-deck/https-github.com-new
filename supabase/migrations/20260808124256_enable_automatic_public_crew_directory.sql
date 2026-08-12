-- Make every active, email-confirmed Crew or Captain account discoverable
-- without mutating private profile notes or relying on synchronization
-- triggers. Public projection, account-state checks, pagination and service-
-- only execution remain bounded at the database boundary.

begin;

-- Legacy eligible rows may predate opaque Crew IDs. Assign a sentinel through
-- the existing immutable-ID guard; the trigger replaces it with a random
-- BD-prefixed identifier before the row is stored.
update public.crew_profiles as profile
set public_crew_id = '__BLUDECK$BACKFILL__'
from public.marketplace_entitlements as entitlement,
     auth.users as account
where profile.public_crew_id is null
  and profile.status = 'active'
  and entitlement.user_id = profile.user_id
  and entitlement.account_role in ('crew', 'captain')
  and account.id = profile.user_id
  and account.email_confirmed_at is not null
  and account.deleted_at is null
  and (
    account.banned_until is null
    or account.banned_until <= statement_timestamp()
  );

do $backfill$
begin
  if exists (
    select 1
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
      and (
        profile.public_crew_id is null
        or upper(btrim(profile.public_crew_id)) !~ '^[A-Z0-9_-]{1,64}$'
      )
  ) then
    raise exception using
      errcode = '23514',
      message = 'An eligible Crew or Captain profile has no valid public Crew ID.';
  end if;
end;
$backfill$;

drop index if exists public.crew_profiles_public_directory_page_idx;
create index crew_profiles_public_directory_page_idx
  on public.crew_profiles (
    coalesce(updated_at, created_at) desc,
    id desc
  )
  where status = 'active'
    and user_id is not null
    and public_crew_id is not null;

comment on index public.crew_profiles_public_directory_page_idx is
  'Cursor index for automatically discoverable active Crew and Captain profiles with opaque public IDs.';

create or replace function public.bluedeck_public_crew_page(
  p_before_updated_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 48
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  safe_limit integer := least(greatest(coalesce(p_limit, 48), 1), 48);
  page_rows jsonb;
  page_has_more boolean;
begin
  if (p_before_updated_at is null) <> (p_before_id is null) then
    raise exception using
      errcode = '22023',
      message = 'A complete crew directory cursor is required.';
  end if;

  with eligible as (
    select
      profile.*,
      coalesce(profile.updated_at, profile.created_at) as cursor_updated_at
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
      and profile.user_id is not null
      and profile.public_crew_id is not null
      and upper(btrim(profile.public_crew_id)) ~ '^[A-Z0-9_-]{1,64}$'
      and (
        p_before_updated_at is null
        or (
          coalesce(profile.updated_at, profile.created_at),
          profile.id
        ) < (p_before_updated_at, p_before_id)
      )
  ),
  selected as (
    select eligible.*
    from eligible
    order by eligible.cursor_updated_at desc, eligible.id desc
    limit safe_limit + 1
  ),
  projected as (
    select
      selected.id,
      selected.user_id,
      upper(btrim(selected.public_crew_id)) as public_crew_id,
      selected.status,
      left(coalesce(selected.full_name, ''), 120) as full_name,
      case when nullif(btrim(selected.email), '') is null then '' else 'provided' end as email,
      case when nullif(btrim(selected.phone), '') is null then '' else 'provided' end as phone,
      private.bluedeck_snapshot_media_path(
        selected.profile_photo_url,
        selected.id,
        selected.user_id
      ) as profile_photo_url,
      left(coalesce(selected.current_position, ''), 120) as current_position,
      private.bluedeck_snapshot_text_array(
        to_jsonb(selected.current_positions), 8, 120
      ) as current_positions,
      private.bluedeck_snapshot_text_array(
        to_jsonb(selected.seeking_positions), 30, 120
      ) as seeking_positions,
      left(coalesce(selected.location, ''), 120) as location,
      left(coalesce(selected.nationality, ''), 80) as nationality,
      left(coalesce(selected.gender, ''), 60) as gender,
      case when selected.date_of_birth is null then '' else 'provided' end as date_of_birth,
      selected.height_cm,
      selected.weight_kg,
      left(coalesce(selected.smoker, ''), 60) as smoker,
      left(coalesce(selected.visible_tattoos, ''), 120) as visible_tattoos,
      repeat('x', least(char_length(coalesce(selected.bio, '')), 200)) as bio,
      private.bluedeck_snapshot_languages(
        to_jsonb(selected.languages)
      ) as languages,
      private.bluedeck_snapshot_text_array(
        to_jsonb(selected.personal_skills), 30, 120
      ) as personal_skills,
      private.bluedeck_snapshot_text_array(
        to_jsonb(selected.personal_characteristics), 30, 120
      ) as personal_characteristics,
      private.bluedeck_snapshot_text_array(
        to_jsonb(selected.work_preferences), 30, 120
      ) as work_preferences,
      case
        when coalesce(selected.notes, '') like '__BLUDECK_FIND_CREW__%'
          then left(split_part(selected.notes, E'\n', 1), 1000)
        else ''
      end as notes,
      selected.created_at,
      selected.cursor_updated_at as updated_at,
      selected.cursor_updated_at as _cursor_updated_at,
      selected.id as _cursor_id,
      coalesce(
        (
          select jsonb_agg(experience.row_data order by experience.created_at desc)
          from (
            select
              experience_record.created_at,
              jsonb_build_object(
                'crew_profile_id', selected.id,
                'yacht_name', case
                  when nullif(btrim(experience_record.yacht_name), '') is null then ''
                  else 'provided'
                end,
                'yacht_type', case
                  when experience_record.yacht_type = '__BLUDECK_OTHER_WORK__'
                    then '__BLUDECK_OTHER_WORK__'
                  when nullif(btrim(experience_record.yacht_type), '') is null then ''
                  else 'provided'
                end,
                'yacht_program', case
                  when nullif(btrim(experience_record.yacht_program), '') is null then ''
                  else 'provided'
                end,
                'yacht_size', case
                  when nullif(btrim(experience_record.yacht_size), '') is null then ''
                  else 'provided'
                end,
                'location', case
                  when nullif(btrim(experience_record.location), '') is null then ''
                  else 'provided'
                end,
                'position', case
                  when nullif(btrim(experience_record.position), '') is null then ''
                  else 'provided'
                end,
                'start_date', case
                  when experience_record.start_date is null then '' else 'provided'
                end,
                'end_date', case
                  when experience_record.end_date is null then '' else 'provided'
                end,
                'description', repeat(
                  'x',
                  least(char_length(coalesce(experience_record.description, '')), 160)
                )
              ) as row_data
            from public.crew_experiences as experience_record
            where experience_record.crew_profile_id = selected.id
            order by experience_record.created_at desc, experience_record.id desc
            limit 3
          ) as experience
        ),
        '[]'::jsonb
      ) as _experiences,
      coalesce(
        (
          select greatest(
            extract(year from current_date)::integer
              - min(extract(year from experience_record.start_date))::integer,
            1
          )
          from public.crew_experiences as experience_record
          where experience_record.crew_profile_id = selected.id
            and experience_record.start_date is not null
            and coalesce(experience_record.yacht_type, '') <>
              '__BLUDECK_OTHER_WORK__'
        ),
        0
      ) as _experience_years
    from selected
    order by selected.cursor_updated_at desc, selected.id desc
    limit safe_limit
  )
  select
    coalesce(
      jsonb_agg(to_jsonb(projected) order by projected._cursor_updated_at desc, projected._cursor_id desc),
      '[]'::jsonb
    ),
    (select count(*) > safe_limit from selected)
  into page_rows, page_has_more
  from projected;

  return jsonb_build_object(
    'rows', page_rows,
    'has_more', coalesce(page_has_more, false)
  );
end;
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

    select profile.*
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

revoke all on function public.bluedeck_public_crew_page(
  timestamptz, uuid, integer
) from public, anon, authenticated;
grant execute on function public.bluedeck_public_crew_page(
  timestamptz, uuid, integer
) to service_role;

revoke all on function public.bluedeck_issue_crew_invitation(
  uuid, uuid, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.bluedeck_issue_crew_invitation(
  uuid, uuid, text, text, text, text, text, text
) to service_role;

comment on function public.bluedeck_public_crew_page(
  timestamptz, uuid, integer
) is
  'Service-only bounded cursor page of every active, email-confirmed Crew or Captain account, independent of optional Find Crew preferences.';

comment on function public.bluedeck_issue_crew_invitation(
  uuid, uuid, text, text, text, text, text, text
) is
  'Atomic service-only invitation issuance using current publisher authority and canonical Auth identity; Crew ID lookup follows automatic active Crew/Captain directory eligibility.';

comment on column public.crew_profiles.notes is
  'Private profile notes plus optional Find Crew availability preferences. Directory eligibility is automatic for active, email-confirmed Crew and Captain accounts.';

commit;
