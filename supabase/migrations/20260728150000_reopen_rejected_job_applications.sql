-- Employer rejections are reversible. Hired and applicant-withdrawn records
-- remain terminal, while a rejected application can only return to Reviewing.
create or replace function public.prepare_job_application_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  write_time timestamptz := statement_timestamp();
  account_email text;
  account_name text;
  resolved_role text;
  resolved_crew_profile_id uuid;
  resolved_position text;
  current_job public.job_posts%rowtype;
  actor_is_applicant boolean;
  actor_is_publisher boolean;
begin
  if tg_op = 'INSERT' then
    if new.applicant_user_id is null
      or new.updated_by is distinct from new.applicant_user_id
    then
      raise exception using
        errcode = '23514',
        message = 'A job application requires one authenticated applicant.';
    end if;

    select post.*
    into current_job
    from public.job_posts as post
    where post.id = new.job_post_id
    for share;

    if current_job.id is null
      or current_job.status <> 'published'
      or current_job.closes_at is null
      or current_job.closes_at <= write_time
      or not private.bluedeck_has_job_publisher_authority(current_job.created_by)
    then
      raise exception using
        errcode = '42501',
        message = 'This job is not currently accepting applications.';
    end if;

    if current_job.created_by = new.applicant_user_id then
      raise exception using
        errcode = '42501',
        message = 'A publisher cannot apply to their own job post.';
    end if;

    select
      lower(btrim(account.email)),
      coalesce(
        nullif(btrim(profile.full_name), ''),
        nullif(btrim(crew_profile.full_name), ''),
        nullif(btrim(account.raw_user_meta_data ->> 'full_name'), ''),
        split_part(lower(btrim(account.email)), '@', 1)
      ),
      entitlement.account_role,
      crew_profile.id,
      coalesce(
        nullif(btrim(crew_profile.current_position), ''),
        nullif(btrim(crew_profile.position), ''),
        nullif(btrim(account.raw_user_meta_data ->> 'position'), ''),
        ''
      )
    into
      account_email,
      account_name,
      resolved_role,
      resolved_crew_profile_id,
      resolved_position
    from auth.users as account
    inner join public.marketplace_entitlements as entitlement
      on entitlement.user_id = account.id
    left join public.profiles as profile
      on profile.id = account.id
    left join lateral (
      select candidate.*
      from public.crew_profiles as candidate
      where candidate.user_id = account.id
      order by candidate.created_at, candidate.id
      limit 1
    ) as crew_profile on true
    where account.id = new.applicant_user_id
      and account.email_confirmed_at is not null
      and account.deleted_at is null;

    if account_email is null or resolved_role not in ('crew', 'captain') then
      raise exception using
        errcode = '42501',
        message = 'Only confirmed crew and captain accounts may apply.';
    end if;

    new.crew_profile_id := resolved_crew_profile_id;
    new.applicant_role := resolved_role;
    new.applicant_name_snapshot := left(account_name, 120);
    new.applicant_email_snapshot := left(account_email, 320);
    new.applicant_position_snapshot := left(resolved_position, 120);
    new.cover_note := btrim(coalesce(new.cover_note, ''));
    new.status := 'submitted';
    new.submitted_at := write_time;
    new.status_changed_at := write_time;
    new.withdrawn_at := null;
    new.created_at := write_time;
    new.updated_at := write_time;
    new.updated_by := new.applicant_user_id;
    new.version := 1;
    return new;
  end if;

  if new.id is distinct from old.id
    or new.job_post_id is distinct from old.job_post_id
    or new.applicant_user_id is distinct from old.applicant_user_id
    or new.crew_profile_id is distinct from old.crew_profile_id
    or new.applicant_role is distinct from old.applicant_role
    or new.applicant_name_snapshot is distinct from old.applicant_name_snapshot
    or new.applicant_email_snapshot is distinct from old.applicant_email_snapshot
    or new.applicant_position_snapshot is distinct from old.applicant_position_snapshot
    or new.cover_note is distinct from old.cover_note
    or new.submitted_at is distinct from old.submitted_at
    or new.created_at is distinct from old.created_at
  then
    raise exception using
      errcode = '22023',
      message = 'Submitted application identity and snapshot fields are immutable.';
  end if;

  if new.updated_by is null then
    raise exception using
      errcode = '23502',
      message = 'An application update requires an authenticated actor.';
  end if;

  if new.status is not distinct from old.status then
    raise exception using
      errcode = '22023',
      message = 'An application update requires a new lifecycle status.';
  end if;

  if old.status in ('withdrawn', 'hired') then
    raise exception using
      errcode = '23514',
      message = format('Application status %s is terminal.', old.status);
  end if;

  actor_is_applicant := new.updated_by = old.applicant_user_id;
  actor_is_publisher := public.bluedeck_can_manage_job(
    new.updated_by,
    old.job_post_id
  );

  if new.status = 'withdrawn' then
    if not actor_is_applicant
      or old.status not in ('submitted', 'reviewing', 'shortlisted')
    then
      raise exception using
        errcode = '42501',
        message = 'Only the applicant may withdraw an active application.';
    end if;
  elsif new.status in ('reviewing', 'shortlisted', 'rejected', 'hired') then
    if not actor_is_publisher then
      raise exception using
        errcode = '42501',
        message = 'Current job publisher authority is required.';
    end if;
  else
    raise exception using
      errcode = '23514',
      message = format('Application cannot move from %s to %s.', old.status, new.status);
  end if;

  if not (
    (old.status = 'submitted' and new.status in (
      'reviewing', 'shortlisted', 'rejected', 'withdrawn', 'hired'
    ))
    or (old.status = 'reviewing' and new.status in (
      'shortlisted', 'rejected', 'withdrawn', 'hired'
    ))
    or (old.status = 'shortlisted' and new.status in (
      'reviewing', 'rejected', 'withdrawn', 'hired'
    ))
    or (old.status = 'rejected' and new.status = 'reviewing')
  ) then
    raise exception using
      errcode = '23514',
      message = format('Application cannot move from %s to %s.', old.status, new.status);
  end if;

  new.created_at := old.created_at;
  new.submitted_at := old.submitted_at;
  new.status_changed_at := write_time;
  new.withdrawn_at := case when new.status = 'withdrawn' then write_time else null end;
  new.updated_at := write_time;
  new.version := old.version + 1;
  return new;
end;
$function$;
