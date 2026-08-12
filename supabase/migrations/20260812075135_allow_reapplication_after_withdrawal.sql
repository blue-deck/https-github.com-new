-- Keep withdrawn attempts as immutable audit history while allowing every
-- member of that attempt to submit a genuinely new application later. Only an
-- applicant withdrawal releases the active per-job reservation; rejected and
-- hired attempts remain exclusive.

begin;

create schema if not exists private;

-- The parent applicant is protected twice: this partial index is the direct
-- table invariant, while the member reservation below also covers every
-- primary and secondary Team/Couple member.
create unique index job_applications_job_applicant_nonwithdrawn_uidx
  on public.job_applications (job_post_id, applicant_user_id)
  where status <> 'withdrawn';

create table private.bluedeck_job_application_member_reservations (
  job_post_id uuid not null,
  member_user_id uuid not null,
  application_id uuid not null,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  constraint bluedeck_job_application_member_reservations_pkey
    primary key (job_post_id, member_user_id),
  constraint bluedeck_job_application_member_reservations_parent_fk
    foreign key (application_id, job_post_id)
    references public.job_applications (id, job_post_id)
    on delete cascade,
  constraint bluedeck_job_application_member_reservations_member_fk
    foreign key (application_id, member_user_id)
    references public.job_application_team_members (
      application_id,
      member_user_id
    )
    on delete cascade
);

create index bluedeck_job_application_member_reservations_application_idx
  on private.bluedeck_job_application_member_reservations (application_id);

alter table private.bluedeck_job_application_member_reservations
  enable row level security;

revoke all on table private.bluedeck_job_application_member_reservations
  from public, anon, authenticated, service_role;

insert into private.bluedeck_job_application_member_reservations (
  job_post_id,
  member_user_id,
  application_id,
  created_at
)
select
  member.job_post_id,
  member.member_user_id,
  member.application_id,
  member.created_at
from public.job_application_team_members as member
inner join public.job_applications as application
  on application.id = member.application_id
where application.status <> 'withdrawn'
order by member.job_post_id, member.member_user_id;

create or replace function private.bluedeck_reserve_job_application_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if exists (
    select 1
    from public.job_applications as application
    where application.id = new.application_id
      and application.job_post_id = new.job_post_id
      and application.status <> 'withdrawn'
  ) then
    insert into private.bluedeck_job_application_member_reservations (
      job_post_id,
      member_user_id,
      application_id,
      created_at
    )
    values (
      new.job_post_id,
      new.member_user_id,
      new.application_id,
      new.created_at
    );
  end if;

  return new;
end;
$function$;

drop trigger if exists job_application_team_members_02_reserve_active_member
  on public.job_application_team_members;
create trigger job_application_team_members_02_reserve_active_member
after insert on public.job_application_team_members
for each row execute function private.bluedeck_reserve_job_application_member();

create or replace function private.bluedeck_release_withdrawn_application_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if new.status = 'withdrawn'
    and new.status is distinct from old.status
  then
    delete from private.bluedeck_job_application_member_reservations
    where application_id = new.id;
  end if;

  return new;
end;
$function$;

drop trigger if exists job_applications_zz_release_withdrawn_members
  on public.job_applications;
create trigger job_applications_zz_release_withdrawn_members
after update of status on public.job_applications
for each row execute function
  private.bluedeck_release_withdrawn_application_members();

-- The reservation table now owns cross-attempt membership exclusivity. These
-- former lifetime indexes would otherwise keep a withdrawn attempt reserved.
drop index public.job_applications_job_applicant_uidx;
drop index public.job_application_team_members_job_user_uidx;

create index job_applications_employer_visible_page_idx
  on public.job_applications (job_post_id, submitted_at desc, id desc)
  where status <> 'withdrawn';

create or replace function public.bluedeck_current_job_application_membership(
  p_actor_user_id uuid,
  p_job_post_id uuid
)
returns table (application_id uuid, is_primary boolean)
language sql
stable
security definer
set search_path = ''
as $function$
  select member.application_id, member.is_primary
  from private.bluedeck_job_application_member_reservations as reservation
  inner join public.job_application_team_members as member
    on member.application_id = reservation.application_id
   and member.job_post_id = reservation.job_post_id
   and member.member_user_id = reservation.member_user_id
  where reservation.job_post_id = p_job_post_id
    and reservation.member_user_id = p_actor_user_id
  limit 1;
$function$;

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
    or pg_catalog.char_length(pg_catalog.btrim(coalesce(p_cover_note, ''))) > 2000
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

    select pg_catalog.array_agg(linked_user_id order by linked_user_id)
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

    if coalesce(pg_catalog.cardinality(teammate_ids), 0) = 0 then
      raise exception using
        errcode = '22023',
        message = 'At least one available Team/Couple member is required.';
    end if;

    member_ids := pg_catalog.array_prepend(p_applicant_user_id, teammate_ids);
  else
    member_ids := array[p_applicant_user_id];
  end if;

  if pg_catalog.cardinality(member_ids) > 8 then
    raise exception using
      errcode = '54000',
      message = 'A Team/Couple application may contain at most eight people.';
  end if;

  if p_apply_as_team and exists (
    select 1
    from pg_catalog.unnest(member_ids) as member(user_id)
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
    from private.bluedeck_job_application_member_reservations as reservation
    where reservation.job_post_id = p_job_post_id
      and reservation.member_user_id = any(member_ids)
  ) then
    raise exception using
      errcode = '23505',
      message = 'A Team/Couple member already has an application for this role.';
  end if;

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
    pg_catalog.btrim(coalesce(p_cover_note, '')),
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
        nullif(pg_catalog.btrim(crew.full_name), ''),
        nullif(pg_catalog.btrim(base.full_name), ''),
        nullif(pg_catalog.btrim(account.raw_user_meta_data ->> 'full_name'), ''),
        pg_catalog.split_part(pg_catalog.lower(pg_catalog.btrim(account.email)), '@', 1),
        'BlueDeck crew'
      ) as full_name,
      coalesce(
        nullif(pg_catalog.btrim(crew.current_position), ''),
        nullif(pg_catalog.btrim(crew.position), ''),
        nullif(pg_catalog.btrim(account.raw_user_meta_data ->> 'position'), ''),
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
      pg_catalog.left(member_record.full_name, 120),
      pg_catalog.left(member_record.current_position, 120),
      pg_catalog.left(member_record.public_crew_id, 64),
      member_record.user_id = p_applicant_user_id,
      member_candidate_snapshot,
      member_media_snapshot,
      submitted_application.submitted_at,
      submitted_application.submitted_at + interval '1 year',
      submitted_application.submitted_at
    );
  end loop;

  if (
    select pg_catalog.count(*)
    from public.job_application_team_members as member
    where member.application_id = submitted_application.id
  ) <> pg_catalog.cardinality(member_ids)
  then
    raise exception using
      errcode = '42501',
      message = 'Every application member must have an active account role.';
  end if;

  return next submitted_application;
  return;
end;
$function$;

create or replace function public.bluedeck_withdraw_job_application(
  p_application_id uuid,
  p_applicant_user_id uuid,
  p_expected_version integer
)
returns setof public.job_applications
language plpgsql
security definer
set search_path = ''
as $function$
declare
  target_job_post_id uuid;
  affected_rows integer;
begin
  if p_expected_version is null or p_expected_version <= 0 then
    raise exception using
      errcode = '22023',
      message = 'A positive expected application version is required.';
  end if;

  select application.job_post_id
  into target_job_post_id
  from public.job_applications as application
  where application.id = p_application_id
    and application.applicant_user_id = p_applicant_user_id;

  if target_job_post_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(
        'bluedeck-job-application:' || target_job_post_id::text,
        0
      )
    );
  end if;

  return query
  update public.job_applications as application
  set status = 'withdrawn',
      updated_by = p_applicant_user_id
  where application.id = p_application_id
    and application.applicant_user_id = p_applicant_user_id
    and application.version = p_expected_version
  returning application.*;

  get diagnostics affected_rows = row_count;
  if affected_rows = 0 then
    if exists (
      select 1
      from public.job_applications as application
      where application.id = p_application_id
        and application.applicant_user_id = p_applicant_user_id
    ) then
      raise exception using
        errcode = '40001',
        message = 'Job application version conflict.';
    end if;

    raise exception using
      errcode = '42501',
      message = 'The application is unavailable to this applicant.';
  end if;
end;
$function$;

create or replace function public.bluedeck_list_job_applications(
  p_actor_user_id uuid,
  p_job_post_id uuid default null
)
returns setof public.job_applications
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if p_job_post_id is not null
    and not public.bluedeck_can_manage_job(p_actor_user_id, p_job_post_id)
    and not exists (
      select 1
      from public.job_applications as application
      where application.job_post_id = p_job_post_id
        and application.applicant_user_id = p_actor_user_id
    )
  then
    raise exception using
      errcode = '42501',
      message = 'Job applications are unavailable to this account.';
  end if;

  return query
  select application.*
  from public.job_applications as application
  where (
      p_job_post_id is null
      or application.job_post_id = p_job_post_id
    )
    and (
      application.applicant_user_id = p_actor_user_id
      or (
        application.status <> 'withdrawn'
        and public.bluedeck_can_manage_job(
          p_actor_user_id,
          application.job_post_id
        )
      )
    )
  order by application.updated_at desc, application.id
  limit 250;
end;
$function$;

create or replace function public.bluedeck_job_application_counts(
  p_actor_user_id uuid
)
returns table (job_post_id uuid, application_count bigint)
language sql
stable
security definer
set search_path = ''
as $function$
  select post.id, pg_catalog.count(application.id)
  from public.job_posts as post
  left join public.job_applications as application
    on application.job_post_id = post.id
   and application.status <> 'withdrawn'
  where post.created_by = p_actor_user_id
    and public.bluedeck_can_manage_job(p_actor_user_id, post.id)
  group by post.id
  order by post.updated_at desc, post.id
  limit 250;
$function$;

create or replace function public.bluedeck_job_applications_page(
  p_actor_user_id uuid,
  p_job_post_id uuid,
  p_before_submitted_at timestamptz default null,
  p_before_id uuid default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  safe_limit integer := least(
    greatest(coalesce(p_limit, 50), 1),
    50
  );
  total_count bigint;
  page_rows jsonb;
  page_has_more boolean;
begin
  if (p_before_submitted_at is null) <> (p_before_id is null) then
    raise exception using
      errcode = '22023',
      message = 'A complete application cursor is required.';
  end if;

  if not public.bluedeck_can_manage_job(p_actor_user_id, p_job_post_id) then
    raise exception using
      errcode = '42501',
      message = 'Current publisher authority is required.';
  end if;

  select pg_catalog.count(*)
  into total_count
  from public.job_applications as application
  where application.job_post_id = p_job_post_id
    and application.status <> 'withdrawn';

  select
    coalesce(
      pg_catalog.jsonb_agg(
        pg_catalog.to_jsonb(candidate) - 'page_number'
        order by candidate.submitted_at desc, candidate.id desc
      ) filter (where candidate.page_number <= safe_limit),
      '[]'::jsonb
    ),
    pg_catalog.count(*) > safe_limit
  into page_rows, page_has_more
  from (
    select
      application.*,
      pg_catalog.row_number() over (
        order by application.submitted_at desc, application.id desc
      ) as page_number
    from public.job_applications as application
    where application.job_post_id = p_job_post_id
      and application.status <> 'withdrawn'
      and (
        p_before_submitted_at is null
        or (application.submitted_at, application.id)
          < (p_before_submitted_at, p_before_id)
      )
    order by application.submitted_at desc, application.id desc
    limit safe_limit + 1
  ) as candidate;

  return pg_catalog.jsonb_build_object(
    'total', total_count,
    'rows', page_rows,
    'has_more', page_has_more
  );
end;
$function$;

revoke all on function private.bluedeck_reserve_job_application_member()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_release_withdrawn_application_members()
  from public, anon, authenticated, service_role;

revoke all on function public.bluedeck_current_job_application_membership(
  uuid, uuid
) from public, anon, authenticated, service_role;
grant execute on function public.bluedeck_current_job_application_membership(
  uuid, uuid
) to service_role;

revoke all on function public.bluedeck_submit_job_application_v2(
  uuid, uuid, text, boolean
) from public, anon, authenticated, service_role;
grant execute on function public.bluedeck_submit_job_application_v2(
  uuid, uuid, text, boolean
) to service_role;

revoke all on function public.bluedeck_withdraw_job_application(
  uuid, uuid, integer
) from public, anon, authenticated, service_role;
grant execute on function public.bluedeck_withdraw_job_application(
  uuid, uuid, integer
) to service_role;

revoke all on function public.bluedeck_list_job_applications(uuid, uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.bluedeck_list_job_applications(uuid, uuid)
  to service_role;

revoke all on function public.bluedeck_job_application_counts(uuid)
  from public, anon, authenticated, service_role;
grant execute on function public.bluedeck_job_application_counts(uuid)
  to service_role;

revoke all on function public.bluedeck_job_applications_page(
  uuid, uuid, timestamptz, uuid, integer
) from public, anon, authenticated, service_role;
grant execute on function public.bluedeck_job_applications_page(
  uuid, uuid, timestamptz, uuid, integer
) to service_role;

comment on table private.bluedeck_job_application_member_reservations is
  'Server-only active per-job member reservations. Applicant withdrawal releases every member while immutable application history and snapshots remain retained.';

commit;
