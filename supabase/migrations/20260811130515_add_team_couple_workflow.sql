-- Add mutual Team/Couple relationships and immutable grouped job applications.
-- All writes remain service-mediated; browser roles receive no direct table or
-- RPC access.

begin;

-- Fail fast instead of queueing behind an unexpected production DDL blocker.
-- The touched live tables are currently small, so the metadata/index work
-- below is intentionally kept atomic with the data backfill.
set local lock_timeout = '5s';

create schema if not exists private;

create table if not exists public.crew_team_relationships (
  id uuid primary key default gen_random_uuid(),
  requester_user_id uuid not null,
  recipient_user_id uuid not null,
  status text not null default 'pending',
  created_at timestamptz not null default statement_timestamp(),
  updated_at timestamptz not null default statement_timestamp(),
  accepted_at timestamptz,
  version integer not null default 1,
  constraint crew_team_relationships_distinct_users_check
    check (requester_user_id <> recipient_user_id),
  constraint crew_team_relationships_status_check
    check (status in ('pending', 'accepted')),
  constraint crew_team_relationships_acceptance_check
    check (
      (status = 'pending' and accepted_at is null)
      or (status = 'accepted' and accepted_at is not null)
    ),
  constraint crew_team_relationships_time_check
    check (
      created_at <= updated_at
      and (accepted_at is null or created_at <= accepted_at)
    ),
  constraint crew_team_relationships_version_check
    check (version > 0)
);

create unique index if not exists crew_team_relationships_pair_uidx
  on public.crew_team_relationships (
    least(requester_user_id, recipient_user_id),
    greatest(requester_user_id, recipient_user_id)
  );

create index if not exists crew_team_relationships_requester_status_idx
  on public.crew_team_relationships (requester_user_id, status, updated_at desc);

create index if not exists crew_team_relationships_recipient_status_idx
  on public.crew_team_relationships (recipient_user_id, status, updated_at desc);

alter table public.crew_team_relationships enable row level security;

revoke all on table public.crew_team_relationships
  from public, anon, authenticated, service_role;
grant select on table public.crew_team_relationships to service_role;

create or replace function private.bluedeck_team_couple_account_ready(
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select
    p_user_id is not null
    and exists (
      select 1
      from auth.users as account
      inner join public.marketplace_entitlements as entitlement
        on entitlement.user_id = account.id
      where account.id = p_user_id
        and account.email_confirmed_at is not null
        and account.deleted_at is null
        and (
          account.banned_until is null
          or account.banned_until <= pg_catalog.statement_timestamp()
        )
        and entitlement.account_role in ('crew', 'captain')
    )
    and exists (
      select 1
      from public.crew_profiles as profile
      where profile.user_id = p_user_id
        and profile.status = 'active'
    );
$function$;

-- Every mutation of one pair takes the same transaction-scoped lock before it
-- locks relationship/profile rows. This makes invite/respond/remove ordering
-- deterministic and prevents otherwise possible row-lock inversions.
create or replace function private.bluedeck_lock_team_couple_pair(
  p_left_user_id uuid,
  p_right_user_id uuid
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $function$
begin
  if p_left_user_id is null
    or p_right_user_id is null
    or p_left_user_id = p_right_user_id
  then
    raise exception using
      errcode = '22023',
      message = 'A valid Team/Couple pair is required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'bluedeck-team-couple-pair:'
        || (case
          when p_left_user_id < p_right_user_id then p_left_user_id
          else p_right_user_id
        end)::text
        || ':'
        || (case
          when p_left_user_id < p_right_user_id then p_right_user_id
          else p_left_user_id
        end)::text,
      0
    )
  );
end;
$function$;

create or replace function private.bluedeck_team_couple_person_payload(
  p_peer_user_id uuid,
  p_relationship_id uuid,
  p_relationship_version integer,
  p_invited_at timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  peer_public_crew_id text;
  peer_full_name text;
  peer_position text;
  peer_account_role text;
  peer_is_available boolean := private.bluedeck_team_couple_account_ready(
    p_peer_user_id
  );
begin
  select
    crew.public_crew_id,
    coalesce(
      nullif(pg_catalog.btrim(crew.full_name), ''),
      nullif(pg_catalog.btrim(base.full_name), ''),
      nullif(pg_catalog.btrim(account.raw_user_meta_data ->> 'full_name'), '')
    ),
    coalesce(
      nullif(pg_catalog.btrim(crew.current_position), ''),
      nullif(pg_catalog.btrim(crew.position), ''),
      ''
    ),
    entitlement.account_role
  into
    peer_public_crew_id,
    peer_full_name,
    peer_position,
    peer_account_role
  from auth.users as account
  left join public.marketplace_entitlements as entitlement
    on entitlement.user_id = account.id
  left join public.profiles as base
    on base.id = account.id
  left join lateral (
    select candidate.*
    from public.crew_profiles as candidate
    where candidate.user_id = account.id
    order by
      case when candidate.status = 'active' then 0 else 1 end,
      candidate.created_at,
      candidate.id
    limit 1
  ) as crew on true
  where account.id = p_peer_user_id;

  return pg_catalog.jsonb_build_object(
    'relationshipId', p_relationship_id,
    'version', p_relationship_version,
    'publicCrewId', case
      when peer_public_crew_id ~ '^[A-Za-z0-9_-]{1,64}$'
        then upper(pg_catalog.left(peer_public_crew_id, 64))
      else 'UNAVAILABLE'
    end,
    'fullName', pg_catalog.left(
      coalesce(nullif(pg_catalog.btrim(peer_full_name), ''), 'Unavailable crew'),
      120
    ),
    'currentPosition', pg_catalog.left(
      coalesce(pg_catalog.btrim(peer_position), ''),
      120
    ),
    'accountRole', case
      when peer_account_role in ('crew', 'captain') then peer_account_role
      else 'crew'
    end,
    'isAvailable', peer_is_available,
    'invitedAt', p_invited_at
  );
end;
$function$;

create or replace function public.bluedeck_team_couple_dashboard(
  p_actor_user_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  own_crew_id text;
  accepted_members jsonb;
  incoming_invitations jsonb;
  outgoing_invitations jsonb;
begin
  if not private.bluedeck_team_couple_account_ready(p_actor_user_id) then
    raise exception using
      errcode = '42501',
      message = 'Active Crew or Captain access is required.';
  end if;

  select pg_catalog.left(profile.public_crew_id, 64)
  into own_crew_id
  from public.crew_profiles as profile
  where profile.user_id = p_actor_user_id
    and profile.status = 'active'
  order by profile.created_at, profile.id
  limit 1;

  select coalesce(
    pg_catalog.jsonb_agg(
      person.payload
      order by lower(person.payload ->> 'fullName'), person.relationship_id
    ),
    '[]'::jsonb
  )
  into accepted_members
  from (
    select
      relationship.id as relationship_id,
      private.bluedeck_team_couple_person_payload(
        case
          when relationship.requester_user_id = p_actor_user_id
            then relationship.recipient_user_id
          else relationship.requester_user_id
        end,
        relationship.id,
        relationship.version,
        null
      ) as payload
    from public.crew_team_relationships as relationship
    where relationship.status = 'accepted'
      and p_actor_user_id in (
        relationship.requester_user_id,
        relationship.recipient_user_id
      )
  ) as person;

  select coalesce(
    pg_catalog.jsonb_agg(
      person.payload order by person.invited_at desc, person.relationship_id
    ),
    '[]'::jsonb
  )
  into incoming_invitations
  from (
    select
      relationship.id as relationship_id,
      relationship.created_at as invited_at,
      private.bluedeck_team_couple_person_payload(
        relationship.requester_user_id,
        relationship.id,
        relationship.version,
        relationship.created_at
      ) as payload
    from public.crew_team_relationships as relationship
    where relationship.recipient_user_id = p_actor_user_id
      and relationship.status = 'pending'
  ) as person;

  select coalesce(
    pg_catalog.jsonb_agg(
      person.payload order by person.invited_at desc, person.relationship_id
    ),
    '[]'::jsonb
  )
  into outgoing_invitations
  from (
    select
      relationship.id as relationship_id,
      relationship.created_at as invited_at,
      private.bluedeck_team_couple_person_payload(
        relationship.recipient_user_id,
        relationship.id,
        relationship.version,
        relationship.created_at
      ) as payload
    from public.crew_team_relationships as relationship
    where relationship.requester_user_id = p_actor_user_id
      and relationship.status = 'pending'
  ) as person;

  return jsonb_build_object(
    'ownCrewId', coalesce(own_crew_id, ''),
    'members', accepted_members,
    'incomingInvites', incoming_invitations,
    'outgoingInvites', outgoing_invitations
  );
end;
$function$;

create or replace function public.bluedeck_invite_team_couple(
  p_actor_user_id uuid,
  p_recipient_public_crew_id text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  normalized_crew_id text := upper(btrim(coalesce(p_recipient_public_crew_id, '')));
  target_user_id uuid;
  relationship_id uuid;
begin
  if not private.bluedeck_team_couple_account_ready(p_actor_user_id) then
    raise exception using
      errcode = '42501',
      message = 'Active Crew or Captain access is required.';
  end if;

  if normalized_crew_id !~ '^[A-Z0-9_-]{1,64}$' then
    raise exception using
      errcode = '22023',
      message = 'A valid BlueDeck Crew ID is required.';
  end if;

  select profile.user_id
  into target_user_id
  from public.crew_profiles as profile
  where upper(btrim(profile.public_crew_id)) = normalized_crew_id
    and profile.status = 'active'
    and profile.user_id is not null
  order by profile.created_at, profile.id
  limit 1;

  if target_user_id is null
    or not private.bluedeck_team_couple_account_ready(target_user_id)
  then
    raise exception using
      errcode = '22023',
      message = 'The Crew ID is not available for Team/Couple invitations.';
  end if;

  if target_user_id = p_actor_user_id then
    raise exception using
      errcode = '22023',
      message = 'You cannot invite your own Crew ID.';
  end if;

  perform private.bluedeck_lock_team_couple_pair(
    p_actor_user_id,
    target_user_id
  );

  perform 1
  from public.crew_profiles as profile
  where profile.user_id = any(array[p_actor_user_id, target_user_id])
  order by profile.user_id, profile.created_at, profile.id
  for update;

  if not private.bluedeck_team_couple_account_ready(p_actor_user_id)
    or not private.bluedeck_team_couple_account_ready(target_user_id)
  then
    raise exception using
      errcode = '42501',
      message = 'Team/Couple access changed. Refresh and try again.';
  end if;

  if (
    select count(*)
    from public.crew_team_relationships as relationship
    where relationship.status = 'accepted'
      and p_actor_user_id in (
        relationship.requester_user_id,
        relationship.recipient_user_id
      )
  ) >= 7
  or (
    select count(*)
    from public.crew_team_relationships as relationship
    where relationship.status = 'accepted'
      and target_user_id in (
        relationship.requester_user_id,
        relationship.recipient_user_id
      )
  ) >= 7
  then
    raise exception using
      errcode = '54000',
      message = 'A Team/Couple may contain at most eight people.';
  end if;

  if (
    select count(*)
    from public.crew_team_relationships as relationship
    where relationship.requester_user_id = p_actor_user_id
      and relationship.status = 'pending'
  ) >= 20
  or (
    select count(*)
    from public.crew_team_relationships as relationship
    where relationship.recipient_user_id = target_user_id
      and relationship.status = 'pending'
  ) >= 20
  then
    raise exception using
      errcode = '54000',
      message = 'Too many Team/Couple invitations are pending.';
  end if;

  insert into public.crew_team_relationships (
    requester_user_id,
    recipient_user_id
  )
  values (
    p_actor_user_id,
    target_user_id
  )
  returning id into relationship_id;

  return relationship_id;
end;
$function$;

create or replace function public.bluedeck_respond_team_couple(
  p_actor_user_id uuid,
  p_relationship_id uuid,
  p_expected_version integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_relationship public.crew_team_relationships%rowtype;
  updated_rows integer;
begin
  if p_relationship_id is null
    or p_expected_version is null
    or p_expected_version <= 0
  then
    raise exception using
      errcode = '22023',
      message = 'A valid invitation response is required.';
  end if;

  -- Read the pair first without a row lock, then take the canonical pair lock
  -- and re-read FOR UPDATE. All pair mutations therefore share one order.
  select relationship.*
  into current_relationship
  from public.crew_team_relationships as relationship
  where relationship.id = p_relationship_id;

  if current_relationship.id is null
    or current_relationship.recipient_user_id <> p_actor_user_id
    or current_relationship.status <> 'pending'
    or current_relationship.version <> p_expected_version
  then
    raise exception using
      errcode = '42501',
      message = 'This Team/Couple invitation is unavailable.';
  end if;

  perform private.bluedeck_lock_team_couple_pair(
    current_relationship.requester_user_id,
    current_relationship.recipient_user_id
  );

  current_relationship := null;
  select relationship.*
  into current_relationship
  from public.crew_team_relationships as relationship
  where relationship.id = p_relationship_id
  for update;

  if current_relationship.id is null
    or current_relationship.recipient_user_id <> p_actor_user_id
    or current_relationship.status <> 'pending'
    or current_relationship.version <> p_expected_version
  then
    raise exception using
      errcode = '42501',
      message = 'This Team/Couple invitation is unavailable.';
  end if;

  perform 1
  from public.crew_profiles as profile
  where profile.user_id = any(array[
    current_relationship.requester_user_id,
    current_relationship.recipient_user_id
  ])
  order by profile.user_id, profile.created_at, profile.id
  for update;

  if not private.bluedeck_team_couple_account_ready(
    current_relationship.requester_user_id
  )
  or not private.bluedeck_team_couple_account_ready(
    current_relationship.recipient_user_id
  )
  then
    raise exception using
      errcode = '42501',
      message = 'A Team/Couple account is no longer active.';
  end if;

  if (
    select count(*)
    from public.crew_team_relationships as relationship
    where relationship.status = 'accepted'
      and current_relationship.requester_user_id in (
        relationship.requester_user_id,
        relationship.recipient_user_id
      )
  ) >= 7
  or (
    select count(*)
    from public.crew_team_relationships as relationship
    where relationship.status = 'accepted'
      and current_relationship.recipient_user_id in (
        relationship.requester_user_id,
        relationship.recipient_user_id
      )
  ) >= 7
  then
    raise exception using
      errcode = '54000',
      message = 'A Team/Couple may contain at most eight people.';
  end if;

  update public.crew_team_relationships as relationship
  set status = 'accepted',
      accepted_at = pg_catalog.statement_timestamp(),
      updated_at = pg_catalog.statement_timestamp(),
      version = relationship.version + 1
  where relationship.id = current_relationship.id
    and relationship.recipient_user_id = p_actor_user_id
    and relationship.status = 'pending'
    and relationship.version = p_expected_version;

  get diagnostics updated_rows = row_count;
  if updated_rows <> 1 then
    raise exception using
      errcode = '40001',
      message = 'This Team/Couple invitation changed. Refresh and try again.';
  end if;

  return true;
end;
$function$;

create or replace function public.bluedeck_remove_team_couple(
  p_actor_user_id uuid,
  p_relationship_id uuid,
  p_action text,
  p_expected_version integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_relationship public.crew_team_relationships%rowtype;
  normalized_action text := lower(pg_catalog.btrim(coalesce(p_action, '')));
  removed_rows integer;
begin
  if p_actor_user_id is null
    or p_relationship_id is null
    or normalized_action not in ('cancel', 'decline', 'remove')
    or p_expected_version is null
    or p_expected_version <= 0
  then
    raise exception using
      errcode = '22023',
      message = 'A valid versioned Team/Couple action is required.';
  end if;

  select relationship.*
  into current_relationship
  from public.crew_team_relationships as relationship
  where relationship.id = p_relationship_id;

  if current_relationship.id is null
    or current_relationship.version <> p_expected_version
    or not (
      (
        normalized_action = 'cancel'
        and current_relationship.status = 'pending'
        and current_relationship.requester_user_id = p_actor_user_id
      )
      or (
        normalized_action = 'decline'
        and current_relationship.status = 'pending'
        and current_relationship.recipient_user_id = p_actor_user_id
      )
      or (
        normalized_action = 'remove'
        and current_relationship.status = 'accepted'
        and p_actor_user_id in (
          current_relationship.requester_user_id,
          current_relationship.recipient_user_id
        )
      )
    )
  then
    raise exception using
      errcode = '42501',
      message = 'This Team/Couple relationship is unavailable.';
  end if;

  perform private.bluedeck_lock_team_couple_pair(
    current_relationship.requester_user_id,
    current_relationship.recipient_user_id
  );

  delete from public.crew_team_relationships as relationship
  where relationship.id = p_relationship_id
    and relationship.version = p_expected_version
    and (
      (
        normalized_action = 'cancel'
        and relationship.status = 'pending'
        and relationship.requester_user_id = p_actor_user_id
      )
      or (
        normalized_action = 'decline'
        and relationship.status = 'pending'
        and relationship.recipient_user_id = p_actor_user_id
      )
      or (
        normalized_action = 'remove'
        and relationship.status = 'accepted'
        and p_actor_user_id in (
          relationship.requester_user_id,
          relationship.recipient_user_id
        )
      )
    );

  get diagnostics removed_rows = row_count;
  if removed_rows <> 1 then
    raise exception using
      errcode = '42501',
      message = 'This Team/Couple relationship is unavailable.';
  end if;

  return true;
end;
$function$;

-- Preserve the parent application as the single lifecycle/counting unit while
-- recording every submitted team member in one immutable member set.
alter table public.job_applications
  add column if not exists application_mode text not null default 'individual';

alter table public.job_applications
  drop constraint if exists job_applications_application_mode_check;
alter table public.job_applications
  add constraint job_applications_application_mode_check check (
    application_mode in ('individual', 'team_couple')
  ) not valid;
alter table public.job_applications
  validate constraint job_applications_application_mode_check;

create unique index if not exists job_applications_id_job_post_uidx
  on public.job_applications (id, job_post_id);

create table if not exists public.job_application_team_members (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null,
  job_post_id uuid not null,
  -- Immutable historical identity: deliberately not a live auth FK, so a
  -- retained application snapshot never prevents account erasure.
  member_user_id uuid not null,
  crew_profile_id uuid
    references public.crew_profiles(id) on delete set null,
  member_role text not null,
  member_name_snapshot text not null,
  member_position_snapshot text not null default '',
  member_public_crew_id_snapshot text not null default '',
  is_primary boolean not null default false,
  candidate_snapshot jsonb not null default '{}'::jsonb,
  media_snapshot jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null,
  expires_at timestamptz not null,
  purged_at timestamptz,
  created_at timestamptz not null default statement_timestamp(),
  constraint job_application_team_members_parent_fk
    foreign key (application_id, job_post_id)
    references public.job_applications(id, job_post_id)
    on delete cascade,
  constraint job_application_team_members_role_check
    check (member_role in ('crew', 'captain')),
  constraint job_application_team_members_name_check
    check (char_length(member_name_snapshot) between 1 and 120),
  constraint job_application_team_members_position_check
    check (char_length(member_position_snapshot) <= 120),
  constraint job_application_team_members_public_id_check
    check (char_length(member_public_crew_id_snapshot) <= 64),
  constraint job_application_team_members_candidate_object_check
    check (jsonb_typeof(candidate_snapshot) = 'object'),
  constraint job_application_team_members_media_object_check
    check (jsonb_typeof(media_snapshot) = 'object'),
  constraint job_application_team_members_snapshot_size_check
    check (
      octet_length(candidate_snapshot::text) <= 1048576
      and octet_length(media_snapshot::text) <= 262144
    ),
  constraint job_application_team_members_time_check
    check (
      captured_at <= expires_at
      and captured_at <= created_at
      and (purged_at is null or captured_at <= purged_at)
    ),
  constraint job_application_team_members_purge_state_check
    check (
      purged_at is null
      or (
        candidate_snapshot = '{}'::jsonb
        and media_snapshot = '{}'::jsonb
      )
    ),
  constraint job_application_team_members_application_user_key
    unique (application_id, member_user_id)
);

create unique index if not exists job_application_team_members_job_user_uidx
  on public.job_application_team_members (job_post_id, member_user_id);

create unique index if not exists job_application_team_members_primary_uidx
  on public.job_application_team_members (application_id)
  where is_primary;

create index if not exists job_application_team_members_application_idx
  on public.job_application_team_members (application_id, is_primary desc, id);

create index if not exists job_application_team_members_member_job_idx
  on public.job_application_team_members (member_user_id, job_post_id);

-- PostgreSQL does not create an index on the referencing side of an FK.
create index if not exists job_application_team_members_crew_profile_idx
  on public.job_application_team_members (crew_profile_id)
  where crew_profile_id is not null;

create index if not exists job_application_team_members_expiry_idx
  on public.job_application_team_members (expires_at)
  where purged_at is null;

alter table public.job_application_team_members enable row level security;

revoke all on table public.job_application_team_members
  from public, anon, authenticated, service_role;
grant select on table public.job_application_team_members to service_role;

create or replace function private.bluedeck_guard_job_application_team_member_identity()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  parent_applicant_user_id uuid;
  parent_job_post_id uuid;
begin
  if tg_op = 'UPDATE' then
    if new.application_id is distinct from old.application_id
      or new.job_post_id is distinct from old.job_post_id
      or new.member_user_id is distinct from old.member_user_id
      or new.is_primary is distinct from old.is_primary
    then
      raise exception using
        errcode = '22023',
        message = 'Submitted application member identity is immutable.';
    end if;
    return new;
  end if;

  select
    application.applicant_user_id,
    application.job_post_id
  into
    parent_applicant_user_id,
    parent_job_post_id
  from public.job_applications as application
  where application.id = new.application_id
  for key share;

  if parent_applicant_user_id is null then
    raise exception using
      errcode = '23503',
      message = 'Application parent does not exist.';
  end if;

  if new.job_post_id is distinct from parent_job_post_id then
    raise exception using
      errcode = '23503',
      message = 'Application member job does not match its parent.';
  end if;

  if new.is_primary is distinct from (
    new.member_user_id = parent_applicant_user_id
  ) then
    raise exception using
      errcode = '23514',
      message = 'Only the parent applicant may be the primary application member.';
  end if;

  return new;
end;
$function$;

drop trigger if exists job_application_team_members_01_guard_identity
  on public.job_application_team_members;
create trigger job_application_team_members_01_guard_identity
before insert or update of application_id, job_post_id, member_user_id, is_primary
on public.job_application_team_members
for each row execute function
  private.bluedeck_guard_job_application_team_member_identity();

-- A grouped application consumes the same durable per-account quotas for
-- every included member. Acquire every member mutex in UUID order before any
-- count so overlapping teams cannot deadlock or oversubscribe concurrently.
create or replace function private.bluedeck_assert_team_application_member_quotas(
  p_member_user_ids uuid[]
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  quota_time timestamptz := pg_catalog.statement_timestamp();
  locked_member_user_id uuid;
  current_count bigint;
begin
  if p_member_user_ids is null
    or pg_catalog.cardinality(p_member_user_ids) not between 1 and 8
    or exists (
      select 1
      from pg_catalog.unnest(p_member_user_ids) as requested_member(user_id)
      where requested_member.user_id is null
    )
    or pg_catalog.cardinality(p_member_user_ids) <> (
      select pg_catalog.count(distinct requested_member.user_id)
      from pg_catalog.unnest(p_member_user_ids) as requested_member(user_id)
    )
  then
    raise exception using
      errcode = '22023',
      message = 'A valid unique application member set is required.';
  end if;

  for locked_member_user_id in
    select requested_member.user_id
    from pg_catalog.unnest(p_member_user_ids) as requested_member(user_id)
    order by requested_member.user_id
  loop
    perform private.bluedeck_lock_resource_quota(
      'job-applications:applicant',
      locked_member_user_id::text
    );
  end loop;

  for locked_member_user_id in
    select requested_member.user_id
    from pg_catalog.unnest(p_member_user_ids) as requested_member(user_id)
    order by requested_member.user_id
  loop
    select pg_catalog.count(*)
    into current_count
    from (
      select application.id
      from public.job_applications as application
      where application.applicant_user_id = locked_member_user_id
      union
      select member.application_id
      from public.job_application_team_members as member
      where member.member_user_id = locked_member_user_id
    ) as retained_application;

    if current_count >= 500 then
      raise exception using
        errcode = '54000',
        message = 'A Team/Couple member can retain at most 500 job applications.',
        hint = 'Withdrawn and historical application retention must be resolved before applying again.';
    end if;

    select pg_catalog.count(*)
    into current_count
    from (
      select application.id
      from public.job_applications as application
      where application.applicant_user_id = locked_member_user_id
        and application.created_at >= quota_time - interval '24 hours'
      union
      select application.id
      from public.job_application_team_members as member
      inner join public.job_applications as application
        on application.id = member.application_id
      where member.member_user_id = locked_member_user_id
        and application.created_at >= quota_time - interval '24 hours'
    ) as recent_application;

    if current_count >= 20 then
      raise exception using
        errcode = '54000',
        message = 'A Team/Couple member can submit at most 20 job applications in 24 hours.',
        hint = 'Wait until the rolling 24-hour window has capacity.';
    end if;
  end loop;
end;
$function$;

create or replace function private.bluedeck_team_member_candidate_snapshot(
  p_member_user_id uuid,
  p_crew_profile_id uuid,
  p_member_name text,
  p_member_position text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  synthetic_application public.job_applications%rowtype;
begin
  synthetic_application.applicant_user_id := p_member_user_id;
  synthetic_application.crew_profile_id := p_crew_profile_id;
  synthetic_application.applicant_name_snapshot := left(
    coalesce(nullif(btrim(p_member_name), ''), 'BlueDeck crew'),
    120
  );
  synthetic_application.applicant_position_snapshot := left(
    btrim(coalesce(p_member_position, '')),
    120
  );
  return private.bluedeck_job_application_candidate_snapshot(
    synthetic_application
  );
end;
$function$;

create or replace function private.bluedeck_team_member_media_snapshot(
  p_member_user_id uuid,
  p_crew_profile_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  synthetic_application public.job_applications%rowtype;
begin
  synthetic_application.applicant_user_id := p_member_user_id;
  synthetic_application.crew_profile_id := p_crew_profile_id;
  return private.bluedeck_job_application_media_snapshot(
    synthetic_application
  );
end;
$function$;

-- Portfolio metadata mutations lock their parent profile. Submission takes a
-- SHARE lock on the same parent before reading media, giving the snapshot a
-- stable metadata boundary (including INSERT/UPDATE/DELETE and upserts).
create or replace function private.bluedeck_lock_crew_portfolio_media_parent()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  target_profile_id uuid;
begin
  for target_profile_id in
    select distinct requested_profile.profile_id
    from pg_catalog.unnest(array[
      case when tg_op <> 'INSERT' then old.crew_profile_id else null end,
      case when tg_op <> 'DELETE' then new.crew_profile_id else null end
    ]::uuid[]) as requested_profile(profile_id)
    where requested_profile.profile_id is not null
    order by requested_profile.profile_id
  loop
    perform profile.id
    from public.crew_profiles as profile
    where profile.id = target_profile_id
    for update;

    if not found then
      raise exception using
        errcode = '23503',
        message = 'Crew profile does not exist.';
    end if;
  end loop;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$function$;

drop trigger if exists crew_portfolio_photos_zz_snapshot_media_parent_lock
  on public.crew_portfolio_photos;
create trigger crew_portfolio_photos_zz_snapshot_media_parent_lock
before insert or update or delete on public.crew_portfolio_photos
for each row execute function private.bluedeck_lock_crew_portfolio_media_parent();

-- Storage policies and application submission use this identical lock key.
-- It linearizes a client DELETE/replace against snapshot capture: whichever
-- transaction gets the path first completes, and the waiter observes it.
create or replace function private.bluedeck_lock_job_application_media_path(
  p_storage_path text
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  normalized_path text := pg_catalog.btrim(coalesce(p_storage_path, ''));
begin
  if pg_catalog.char_length(normalized_path) not between 1 and 512
    or normalized_path !~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$'
    or normalized_path like '%//%'
    or normalized_path like '%..%'
    or pg_catalog.right(normalized_path, 1) = '/'
  then
    raise exception using
      errcode = '22023',
      message = 'A valid application media path is required.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'bluedeck-job-application-media:' || normalized_path,
      0
    )
  );
end;
$function$;

create or replace function private.bluedeck_lock_job_application_media_snapshot(
  p_media_snapshot jsonb
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  storage_path text;
begin
  if p_media_snapshot is null
    or pg_catalog.jsonb_typeof(p_media_snapshot) <> 'object'
  then
    raise exception using
      errcode = '22023',
      message = 'A valid application media snapshot is required.';
  end if;

  for storage_path in
    select distinct candidate.path
    from (
      select p_media_snapshot ->> 'avatar_source' as path
      union all
      select gallery.photo ->> 'image_url'
      from pg_catalog.jsonb_array_elements(
        case
          when pg_catalog.jsonb_typeof(p_media_snapshot -> 'gallery') = 'array'
            then p_media_snapshot -> 'gallery'
          else '[]'::jsonb
        end
      ) as gallery(photo)
    ) as candidate
    where pg_catalog.char_length(pg_catalog.btrim(coalesce(candidate.path, '')))
      between 1 and 512
      and pg_catalog.btrim(candidate.path) ~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$'
      and pg_catalog.btrim(candidate.path) not like '%//%'
      and pg_catalog.btrim(candidate.path) not like '%..%'
      and pg_catalog.right(pg_catalog.btrim(candidate.path), 1) <> '/'
    order by candidate.path
  loop
    perform private.bluedeck_lock_job_application_media_path(storage_path);
  end loop;
end;
$function$;

create or replace function private.bluedeck_finalize_job_application_media_snapshot(
  p_media_snapshot jsonb
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  avatar_path text := pg_catalog.btrim(
    coalesce(p_media_snapshot ->> 'avatar_source', '')
  );
  finalized_avatar_path text := '';
  finalized_gallery jsonb;
begin
  if p_media_snapshot is null
    or pg_catalog.jsonb_typeof(p_media_snapshot) <> 'object'
  then
    raise exception using
      errcode = '22023',
      message = 'A valid application media snapshot is required.';
  end if;

  -- Reserve every referenced object first. The existence checks below then
  -- observe the winner of a concurrent authenticated storage mutation.
  perform private.bluedeck_lock_job_application_media_snapshot(
    p_media_snapshot
  );

  if avatar_path <> ''
    and exists (
      select 1
      from storage.objects as stored_object
      where stored_object.bucket_id = 'crew-portfolio'
        and stored_object.name = avatar_path
    )
  then
    finalized_avatar_path := avatar_path;
  end if;

  select coalesce(
    pg_catalog.jsonb_agg(gallery.photo order by gallery.ordinality),
    '[]'::jsonb
  )
  into finalized_gallery
  from pg_catalog.jsonb_array_elements(
    case
      when pg_catalog.jsonb_typeof(p_media_snapshot -> 'gallery') = 'array'
        then p_media_snapshot -> 'gallery'
      else '[]'::jsonb
    end
  ) with ordinality as gallery(photo, ordinality)
  where exists (
    select 1
    from storage.objects as stored_object
    where stored_object.bucket_id = 'crew-portfolio'
      and stored_object.name = pg_catalog.btrim(
        coalesce(gallery.photo ->> 'image_url', '')
      )
  );

  return (p_media_snapshot - 'avatar_source' - 'gallery')
    || pg_catalog.jsonb_build_object(
      'avatar_source', finalized_avatar_path,
      'gallery', finalized_gallery
    );
end;
$function$;

-- Replace the original primary snapshot trigger implementation so direct
-- service writes and the compatibility RPC share the same lock-then-existence
-- media boundary as grouped members.
create or replace function private.bluedeck_capture_job_application_snapshot()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  finalized_media_snapshot jsonb;
begin
  if new.crew_profile_id is not null then
    perform profile.id
    from public.crew_profiles as profile
    where profile.id = new.crew_profile_id
      and profile.user_id = new.applicant_user_id
    for share;
  end if;

  finalized_media_snapshot :=
    private.bluedeck_finalize_job_application_media_snapshot(
      private.bluedeck_job_application_media_snapshot(new)
    );

  insert into public.job_application_snapshots (
    application_id,
    candidate_snapshot,
    media_snapshot,
    captured_at,
    expires_at,
    purged_at
  )
  values (
    new.id,
    private.bluedeck_job_application_candidate_snapshot(new),
    finalized_media_snapshot,
    new.submitted_at,
    new.submitted_at + interval '1 year',
    null
  )
  on conflict (application_id) do nothing;

  return new;
end;
$function$;

create or replace function private.bluedeck_guard_job_application_mode()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if tg_op = 'UPDATE'
    and new.application_mode is distinct from old.application_mode
  then
    raise exception using
      errcode = '22023',
      message = 'The submitted application mode is immutable.';
  end if;
  return new;
end;
$function$;

drop trigger if exists job_applications_01_guard_application_mode
  on public.job_applications;
create trigger job_applications_01_guard_application_mode
before update of application_mode on public.job_applications
for each row execute function private.bluedeck_guard_job_application_mode();

-- Backfill every existing solo application with one canonical primary member.
insert into public.job_application_team_members (
  application_id,
  job_post_id,
  member_user_id,
  crew_profile_id,
  member_role,
  member_name_snapshot,
  member_position_snapshot,
  member_public_crew_id_snapshot,
  is_primary,
  candidate_snapshot,
  media_snapshot,
  captured_at,
  expires_at,
  purged_at,
  created_at
)
select
  application.id,
  application.job_post_id,
  application.applicant_user_id,
  application.crew_profile_id,
  application.applicant_role,
  application.applicant_name_snapshot,
  application.applicant_position_snapshot,
  left(coalesce(profile.public_crew_id, ''), 64),
  true,
  coalesce(snapshot.candidate_snapshot, '{}'::jsonb),
  coalesce(snapshot.media_snapshot, '{}'::jsonb),
  coalesce(snapshot.captured_at, application.submitted_at),
  coalesce(snapshot.expires_at, application.submitted_at + interval '1 year'),
  snapshot.purged_at,
  greatest(
    application.submitted_at,
    coalesce(snapshot.captured_at, application.submitted_at)
  )
from public.job_applications as application
left join public.crew_profiles as profile
  on profile.id = application.crew_profile_id
 and profile.user_id = application.applicant_user_id
left join public.job_application_snapshots as snapshot
  on snapshot.application_id = application.id
on conflict (application_id, member_user_id) do nothing;

-- Fail the rollout before any RPC is exposed if the legacy backfill did not
-- produce one canonical member set for every parent application.
do $canonical_backfill_assertion$
declare
  violation record;
begin
  with application_membership as (
    select
      application.id as application_id,
      application.application_mode,
      application.applicant_user_id,
      pg_catalog.count(member.id) as member_count,
      pg_catalog.count(member.id) filter (
        where member.is_primary
      ) as primary_count,
      pg_catalog.count(member.id) filter (
        where member.is_primary
          and member.member_user_id = application.applicant_user_id
      ) as primary_applicant_count
    from public.job_applications as application
    left join public.job_application_team_members as member
      on member.application_id = application.id
    group by
      application.id,
      application.application_mode,
      application.applicant_user_id
  )
  select membership.*
  into violation
  from application_membership as membership
  where membership.primary_count <> 1
    or membership.primary_applicant_count <> 1
    or (
      membership.application_mode = 'individual'
      and membership.member_count <> 1
    )
    or (
      membership.application_mode = 'team_couple'
      and membership.member_count not between 2 and 8
    )
  order by membership.application_id
  limit 1;

  if violation.application_id is not null then
    raise exception using
      errcode = '23514',
      message = 'Canonical application member backfill assertion failed.',
      detail = pg_catalog.format(
        'application=%s mode=%s members=%s primary=%s primary_applicant=%s',
        violation.application_id,
        violation.application_mode,
        violation.member_count,
        violation.primary_count,
        violation.primary_applicant_count
      );
  end if;
end;
$canonical_backfill_assertion$;

create or replace function public.bluedeck_submit_job_application_v2(
  p_job_post_id uuid,
  p_applicant_user_id uuid,
  p_cover_note text default '',
  p_apply_as_team boolean default false
)
returns setof public.job_applications
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_job public.job_posts%rowtype;
  submitted_application public.job_applications%rowtype;
  member_ids uuid[];
  teammate_ids uuid[];
  member_record record;
  member_candidate_snapshot jsonb;
  member_media_snapshot jsonb;
begin
  if p_job_post_id is null
    or p_applicant_user_id is null
    or p_apply_as_team is null
    or char_length(btrim(coalesce(p_cover_note, ''))) > 2000
  then
    raise exception using
      errcode = '22023',
      message = 'The job application request is invalid.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'bluedeck-job-application:' || p_job_post_id::text,
      0
    )
  );

  select post.*
  into current_job
  from public.job_posts as post
  where post.id = p_job_post_id
  for share;

  if current_job.id is null
    or not public.bluedeck_can_apply_to_job(
      p_applicant_user_id,
      p_job_post_id
    )
  then
    raise exception using
      errcode = '42501',
      message = 'This role is not accepting an application from this account.';
  end if;

  if p_apply_as_team then
    if current_job.candidate_type not in ('team', 'couple') then
      raise exception using
        errcode = '22023',
        message = 'This role accepts individual applications only.';
    end if;

    -- Select and lock the exact same accepted direct-link set in one statement.
    -- A concurrent disconnect waits until this immutable application is stored;
    -- a concurrently accepted invite is consistently outside this submission.
    select array_agg(linked_user_id order by linked_user_id)
    into teammate_ids
    from (
      select case
        when relationship.requester_user_id = p_applicant_user_id
          then relationship.recipient_user_id
        else relationship.requester_user_id
      end as linked_user_id
      from public.crew_team_relationships as relationship
      where relationship.status = 'accepted'
        and p_applicant_user_id in (
          relationship.requester_user_id,
          relationship.recipient_user_id
        )
      order by relationship.id
      for share of relationship
    ) as locked_accepted_member
    where private.bluedeck_team_couple_account_ready(
      locked_accepted_member.linked_user_id
    );

    if coalesce(cardinality(teammate_ids), 0) = 0 then
      raise exception using
        errcode = '22023',
        message = 'At least one available Team/Couple member is required.';
    end if;

    member_ids := array_prepend(p_applicant_user_id, teammate_ids);
  else
    member_ids := array[p_applicant_user_id];
  end if;

  if cardinality(member_ids) > 8 then
    raise exception using
      errcode = '54000',
      message = 'A Team/Couple application may contain at most eight people.';
  end if;

  if p_apply_as_team and exists (
    select 1
    from unnest(member_ids) as member(user_id)
    where not private.bluedeck_team_couple_account_ready(member.user_id)
      or not public.bluedeck_can_apply_to_job(
        member.user_id,
        p_job_post_id
      )
      or private.bluedeck_has_yacht_publisher_authority(
        member.user_id,
        current_job.yacht_id
      )
  ) then
    raise exception using
      errcode = '42501',
      message = 'Every Team/Couple member must be eligible for this role.';
  end if;

  perform private.bluedeck_assert_team_application_member_quotas(member_ids);

  if exists (
    select 1
    from public.job_applications as application
    where application.job_post_id = p_job_post_id
      and application.applicant_user_id = any(member_ids)
  )
  or exists (
    select 1
    from public.job_application_team_members as member
    where member.job_post_id = p_job_post_id
      and member.member_user_id = any(member_ids)
  )
  then
    raise exception using
      errcode = '23505',
      message = 'A Team/Couple member already has an application for this role.';
  end if;

  -- Stabilize every relevant media-metadata parent in one deterministic order.
  -- The primary trigger and each member finalizer then lock paths before
  -- checking storage existence and persisting the snapshot.
  perform profile.id
  from public.crew_profiles as profile
  where profile.user_id = any(member_ids)
  order by profile.id
  for share;

  insert into public.job_applications (
    job_post_id,
    applicant_user_id,
    applicant_role,
    applicant_name_snapshot,
    applicant_email_snapshot,
    applicant_position_snapshot,
    cover_note,
    status,
    updated_by,
    application_mode
  )
  values (
    p_job_post_id,
    p_applicant_user_id,
    'crew',
    'Pending snapshot',
    'pending@invalid.local',
    '',
    btrim(coalesce(p_cover_note, '')),
    'submitted',
    p_applicant_user_id,
    case when p_apply_as_team then 'team_couple' else 'individual' end
  )
  returning * into submitted_application;

  for member_record in
    select
      account.id as user_id,
      entitlement.account_role,
      crew.id as crew_profile_id,
      coalesce(
        nullif(btrim(crew.full_name), ''),
        nullif(btrim(base.full_name), ''),
        nullif(btrim(account.raw_user_meta_data ->> 'full_name'), ''),
        split_part(lower(btrim(account.email)), '@', 1),
        'BlueDeck crew'
      ) as full_name,
      coalesce(
        nullif(btrim(crew.current_position), ''),
        nullif(btrim(crew.position), ''),
        nullif(btrim(account.raw_user_meta_data ->> 'position'), ''),
        ''
      ) as current_position,
      coalesce(crew.public_crew_id, '') as public_crew_id
    from auth.users as account
    inner join public.marketplace_entitlements as entitlement
      on entitlement.user_id = account.id
     and entitlement.account_role in ('crew', 'captain')
    left join public.profiles as base
      on base.id = account.id
    left join lateral (
      select candidate.*
      from public.crew_profiles as candidate
      where candidate.user_id = account.id
      order by
        case when candidate.status = 'active' then 0 else 1 end,
        candidate.created_at,
        candidate.id
      limit 1
    ) as crew on true
    where account.id = any(member_ids)
    order by (account.id = p_applicant_user_id) desc, account.id
  loop
    member_candidate_snapshot := private.bluedeck_team_member_candidate_snapshot(
      member_record.user_id,
      member_record.crew_profile_id,
      member_record.full_name,
      member_record.current_position
    );
    member_media_snapshot :=
      private.bluedeck_finalize_job_application_media_snapshot(
        private.bluedeck_team_member_media_snapshot(
          member_record.user_id,
          member_record.crew_profile_id
        )
      );

    insert into public.job_application_team_members (
      application_id,
      job_post_id,
      member_user_id,
      crew_profile_id,
      member_role,
      member_name_snapshot,
      member_position_snapshot,
      member_public_crew_id_snapshot,
      is_primary,
      candidate_snapshot,
      media_snapshot,
      captured_at,
      expires_at,
      created_at
    )
    values (
      submitted_application.id,
      submitted_application.job_post_id,
      member_record.user_id,
      member_record.crew_profile_id,
      member_record.account_role,
      left(member_record.full_name, 120),
      left(member_record.current_position, 120),
      left(member_record.public_crew_id, 64),
      member_record.user_id = p_applicant_user_id,
      member_candidate_snapshot,
      member_media_snapshot,
      submitted_application.submitted_at,
      submitted_application.submitted_at + interval '1 year',
      submitted_application.submitted_at
    );
  end loop;

  if (
    select count(*)
    from public.job_application_team_members as member
    where member.application_id = submitted_application.id
  ) <> cardinality(member_ids)
  then
    raise exception using
      errcode = '42501',
      message = 'Every application member must have an active account role.';
  end if;

  return next submitted_application;
  return;
end;
$function$;

-- Keep the original service RPC working during the zero-downtime application
-- rollout while ensuring every new solo application receives a primary member.
create or replace function public.bluedeck_submit_job_application(
  p_job_post_id uuid,
  p_applicant_user_id uuid,
  p_cover_note text default ''
)
returns setof public.job_applications
language sql
security definer
set search_path = ''
as $function$
  select *
  from public.bluedeck_submit_job_application_v2(
    p_job_post_id,
    p_applicant_user_id,
    p_cover_note,
    false
  );
$function$;

create or replace function private.bluedeck_update_team_member_snapshot_retention()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status in ('withdrawn', 'rejected')
    and new.status is distinct from old.status
  then
    update public.job_application_team_members as member
    set expires_at = least(
      member.expires_at,
      new.status_changed_at + interval '30 days'
    )
    where member.application_id = new.id
      and member.purged_at is null;
  elsif old.status = 'rejected'
    and new.status = 'reviewing'
  then
    update public.job_application_team_members as member
    set expires_at = greatest(
      member.expires_at,
      least(
        member.captured_at + interval '1 year',
        new.status_changed_at + interval '180 days'
      )
    )
    where member.application_id = new.id
      and member.purged_at is null;
  end if;
  return new;
end;
$function$;

drop trigger if exists job_applications_zz_team_member_retention
  on public.job_applications;
create trigger job_applications_zz_team_member_retention
after update of status on public.job_applications
for each row execute function private.bluedeck_update_team_member_snapshot_retention();

create or replace function private.bluedeck_purge_expired_job_application_team_members()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  purged_count integer;
begin
  update public.job_application_team_members as member
  set candidate_snapshot = '{}'::jsonb,
      media_snapshot = '{}'::jsonb,
      purged_at = pg_catalog.statement_timestamp()
  where member.purged_at is null
    and member.expires_at <= pg_catalog.statement_timestamp();

  get diagnostics purged_count = row_count;
  return purged_count;
end;
$function$;

select cron.unschedule(jobid)
from cron.job
where jobname = 'bluedeck-purge-job-application-team-members';

select cron.schedule(
  'bluedeck-purge-job-application-team-members',
  '19 3 * * *',
  $cron$
    select private.bluedeck_purge_expired_job_application_team_members();
  $cron$
);

-- A team member's captured gallery must receive the same immutable-path
-- protection as the primary candidate snapshot.
create or replace function public.bluedeck_job_application_media_path_locked(
  p_storage_path text
)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $function$
declare
  normalized_path text := pg_catalog.btrim(coalesce(p_storage_path, ''));
  path_is_locked boolean;
begin
  if pg_catalog.char_length(normalized_path) not between 1 and 512
    or normalized_path !~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$'
    or normalized_path like '%//%'
    or normalized_path like '%..%'
    or pg_catalog.right(normalized_path, 1) = '/'
  then
    return false;
  end if;

  -- Service-role storage work bypasses RLS. Authenticated policy callers must
  -- own the path before they are allowed to reserve/check it.
  if not (
    normalized_path like (coalesce(auth.uid()::text, '') || '/%')
    or private.bluedeck_owns_crew_profile_storage_path(normalized_path)
  ) then
    return false;
  end if;

  perform private.bluedeck_lock_job_application_media_path(normalized_path);

  select exists (
    select 1
    from (
      select
        snapshot.media_snapshot,
        snapshot.expires_at,
        snapshot.purged_at
      from public.job_application_snapshots as snapshot
      union all
      select
        member.media_snapshot,
        member.expires_at,
        member.purged_at
      from public.job_application_team_members as member
    ) as captured
    where captured.purged_at is null
      and captured.expires_at > pg_catalog.statement_timestamp()
      and (
        captured.media_snapshot ->> 'avatar_source' = normalized_path
        or pg_catalog.strpos(
          coalesce(captured.media_snapshot ->> 'avatar_source', ''),
          '/crew-portfolio/' || normalized_path
        ) > 0
        or exists (
          select 1
          from pg_catalog.jsonb_array_elements(
            case
              when pg_catalog.jsonb_typeof(captured.media_snapshot -> 'gallery') = 'array'
                then captured.media_snapshot -> 'gallery'
              else '[]'::jsonb
            end
          ) as gallery(photo)
          where gallery.photo ->> 'image_url' = normalized_path
            or pg_catalog.strpos(
              coalesce(gallery.photo ->> 'image_url', ''),
              '/crew-portfolio/' || normalized_path
            ) > 0
        )
      )
  ) into path_is_locked;

  return path_is_locked;
end;
$function$;

revoke all on function private.bluedeck_team_couple_account_ready(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_lock_team_couple_pair(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_team_couple_person_payload(
  uuid, uuid, integer, timestamptz
)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_assert_team_application_member_quotas(uuid[])
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_guard_job_application_team_member_identity()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_team_member_candidate_snapshot(uuid, uuid, text, text)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_team_member_media_snapshot(uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_lock_crew_portfolio_media_parent()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_lock_job_application_media_path(text)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_lock_job_application_media_snapshot(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_finalize_job_application_media_snapshot(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_capture_job_application_snapshot()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_guard_job_application_mode()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_update_team_member_snapshot_retention()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_purge_expired_job_application_team_members()
  from public, anon, authenticated, service_role;

revoke all on function public.bluedeck_team_couple_dashboard(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.bluedeck_team_couple_dashboard(uuid)
  to service_role;

revoke all on function public.bluedeck_invite_team_couple(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.bluedeck_invite_team_couple(uuid, text)
  to service_role;

drop function if exists public.bluedeck_respond_team_couple(uuid, uuid, boolean);
revoke all on function public.bluedeck_respond_team_couple(uuid, uuid, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.bluedeck_respond_team_couple(uuid, uuid, integer)
  to service_role;

drop function if exists public.bluedeck_remove_team_couple(uuid, uuid);
revoke all on function public.bluedeck_remove_team_couple(uuid, uuid, text, integer)
  from public, anon, authenticated, service_role;
grant execute on function public.bluedeck_remove_team_couple(uuid, uuid, text, integer)
  to service_role;

revoke all on function public.bluedeck_submit_job_application_v2(uuid, uuid, text, boolean)
  from public, anon, authenticated, service_role;
grant execute on function public.bluedeck_submit_job_application_v2(uuid, uuid, text, boolean)
  to service_role;

revoke all on function public.bluedeck_submit_job_application(uuid, uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.bluedeck_submit_job_application(uuid, uuid, text)
  to service_role;

revoke all on function public.bluedeck_job_application_media_path_locked(text)
  from public, anon;
grant execute on function public.bluedeck_job_application_media_path_locked(text)
  to authenticated, service_role;

-- Add auth references immediately before commit so their referenced-table
-- locks are held only for the shortest possible part of this migration.
alter table public.crew_team_relationships
  add constraint crew_team_relationships_requester_user_fk
  foreign key (requester_user_id)
  references auth.users(id)
  on delete cascade
  not valid;
alter table public.crew_team_relationships
  add constraint crew_team_relationships_recipient_user_fk
  foreign key (recipient_user_id)
  references auth.users(id)
  on delete cascade
  not valid;
alter table public.crew_team_relationships
  validate constraint crew_team_relationships_requester_user_fk;
alter table public.crew_team_relationships
  validate constraint crew_team_relationships_recipient_user_fk;

comment on table public.crew_team_relationships is
  'Private mutual Team/Couple invitations and accepted direct professional relationships.';
comment on table public.job_application_team_members is
  'Immutable member set and per-member candidate/media snapshots for one canonical grouped job application.';
comment on column public.job_applications.application_mode is
  'Submission mode frozen at apply time: individual or team_couple.';
comment on column public.job_application_team_members.member_user_id is
  'Immutable historical user UUID; intentionally not an auth FK so retained snapshots do not block account erasure.';

commit;
