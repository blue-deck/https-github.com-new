-- Freeze exactly what an employer may review at application time. Later crew
-- profile/gallery changes must never expand an old employer's access.

begin;

create schema if not exists private;

create table if not exists public.job_application_snapshots (
  application_id uuid primary key
    references public.job_applications(id) on delete cascade,
  candidate_snapshot jsonb not null default '{}'::jsonb,
  media_snapshot jsonb not null default '{}'::jsonb,
  captured_at timestamptz not null,
  expires_at timestamptz not null,
  purged_at timestamptz,
  constraint job_application_snapshots_candidate_object_check
    check (jsonb_typeof(candidate_snapshot) = 'object'),
  constraint job_application_snapshots_media_object_check
    check (jsonb_typeof(media_snapshot) = 'object'),
  constraint job_application_snapshots_size_check
    check (
      octet_length(candidate_snapshot::text) <= 1048576
      and octet_length(media_snapshot::text) <= 262144
    ),
  constraint job_application_snapshots_time_check
    check (
      captured_at <= expires_at
      and (purged_at is null or captured_at <= purged_at)
    ),
  constraint job_application_snapshots_purge_state_check
    check (
      purged_at is null
      or (
        candidate_snapshot = '{}'::jsonb
        and media_snapshot = '{}'::jsonb
      )
    )
);

create index if not exists job_application_snapshots_expiry_idx
  on public.job_application_snapshots (expires_at)
  where purged_at is null;

alter table public.job_application_snapshots enable row level security;
revoke all on table public.job_application_snapshots
  from public, anon, authenticated;
grant select on table public.job_application_snapshots to service_role;

-- Storage references captured by an unexpired application cannot be deleted
-- and recreated at the same path. This closes the remaining immutable-media
-- gap even when a client attempts DELETE + INSERT instead of UPDATE.
create or replace function public.bluedeck_job_application_media_path_locked(
  p_storage_path text
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select
    nullif(btrim(p_storage_path), '') is not null
    and (
      coalesce(auth.role(), '') = 'service_role'
      or p_storage_path like (coalesce(auth.uid()::text, '') || '/%')
      or private.bluedeck_owns_crew_profile_storage_path(p_storage_path)
    )
    and exists (
      select 1
      from public.job_application_snapshots as snapshot
      where snapshot.purged_at is null
        and snapshot.expires_at > statement_timestamp()
        and (
          snapshot.media_snapshot ->> 'avatar_source' = p_storage_path
          or position(
            '/crew-portfolio/' || p_storage_path
            in coalesce(snapshot.media_snapshot ->> 'avatar_source', '')
          ) > 0
          or exists (
            select 1
            from jsonb_array_elements(
              case
                when jsonb_typeof(snapshot.media_snapshot -> 'gallery') = 'array'
                  then snapshot.media_snapshot -> 'gallery'
                else '[]'::jsonb
              end
            ) as gallery(photo)
            where gallery.photo ->> 'image_url' = p_storage_path
              or position(
                '/crew-portfolio/' || p_storage_path
                in coalesce(gallery.photo ->> 'image_url', '')
              ) > 0
          )
        )
    );
$function$;

drop policy if exists "Authenticated crew portfolio uploads"
  on storage.objects;
create policy "Authenticated crew portfolio uploads"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'crew-portfolio'
  and not public.bluedeck_job_application_media_path_locked(name)
  and (
    (
      private.bluedeck_has_crew_career_access()
      and (
        name like ((select auth.uid())::text || '/%')
        or private.bluedeck_owns_crew_profile_storage_path(name)
      )
    )
    or name like ((select auth.uid())::text || '/dashboard-%')
  )
);

drop policy if exists "Authenticated crew portfolio deletes"
  on storage.objects;
create policy "Authenticated crew portfolio deletes"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'crew-portfolio'
  and not public.bluedeck_job_application_media_path_locked(name)
  and (
    (
      private.bluedeck_has_crew_career_access()
      and (
        name like ((select auth.uid())::text || '/%')
        or private.bluedeck_owns_crew_profile_storage_path(name)
      )
    )
    or name like ((select auth.uid())::text || '/dashboard-%')
  )
);

-- Snapshot builders consume client-writable legacy profile fields. Normalize
-- them here so malformed types or very large arrays can never make an
-- application insert or rollout backfill exceed the snapshot size boundary.
create or replace function private.bluedeck_snapshot_text_array(
  p_value jsonb,
  p_limit integer,
  p_item_length integer
)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $function$
  select coalesce(jsonb_agg(item.value order by item.ordinality), '[]'::jsonb)
  from (
    select
      to_jsonb(
        left(
          btrim(element.value #>> '{}'),
          least(greatest(coalesce(p_item_length, 120), 1), 240)
        )
      ) as value,
      element.ordinality
    from jsonb_array_elements(
      case when jsonb_typeof(p_value) = 'array' then p_value else '[]'::jsonb end
    ) with ordinality as element(value, ordinality)
    where jsonb_typeof(element.value) = 'string'
      and nullif(btrim(element.value #>> '{}'), '') is not null
    order by element.ordinality
    limit least(greatest(coalesce(p_limit, 20), 0), 50)
  ) as item;
$function$;

create or replace function private.bluedeck_snapshot_languages(p_value jsonb)
returns jsonb
language sql
immutable
set search_path = pg_catalog
as $function$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'name', left(btrim(item.value ->> 'name'), 80),
        'level', left(btrim(coalesce(item.value ->> 'level', '')), 80)
      )
      order by item.ordinality
    ),
    '[]'::jsonb
  )
  from (
    select element.value, element.ordinality
    from jsonb_array_elements(
      case when jsonb_typeof(p_value) = 'array' then p_value else '[]'::jsonb end
    ) with ordinality as element(value, ordinality)
    where jsonb_typeof(element.value) = 'object'
      and nullif(btrim(element.value ->> 'name'), '') is not null
    order by element.ordinality
    limit 20
  ) as item;
$function$;

create or replace function private.bluedeck_snapshot_media_path(
  p_value text,
  p_crew_profile_id uuid,
  p_user_id uuid
)
returns text
language sql
immutable
set search_path = pg_catalog
as $function$
  select case
    when nullif(btrim(p_value), '') is null
      or length(btrim(p_value)) > 512
      or btrim(p_value) !~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$'
      or btrim(p_value) like '%//%'
      or btrim(p_value) like '%..%'
      or right(btrim(p_value), 1) = '/'
      or split_part(btrim(p_value), '/', 1) not in (
        p_crew_profile_id::text,
        p_user_id::text
      )
    then ''
    else btrim(p_value)
  end;
$function$;

create or replace function private.bluedeck_job_application_candidate_snapshot(
  p_application public.job_applications
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select jsonb_build_object(
    'profile', coalesce(
      (
        select jsonb_build_object(
          'full_name', 'provided',
          'email', case when nullif(btrim(profile.email), '') is null then '' else 'provided' end,
          'phone', case when nullif(btrim(profile.phone), '') is null then '' else 'provided' end,
          'current_position', left(coalesce(profile.current_position, ''), 120),
          'current_positions', private.bluedeck_snapshot_text_array(
            to_jsonb(profile.current_positions), 8, 120
          ),
          'seeking_positions', private.bluedeck_snapshot_text_array(
            to_jsonb(profile.seeking_positions), 30, 120
          ),
          'location', left(coalesce(profile.location, ''), 120),
          'nationality', left(coalesce(profile.nationality, ''), 80),
          'gender', coalesce(
            left(nullif(btrim(profile.gender), ''), 60),
            left(nullif(btrim(account.raw_user_meta_data ->> 'gender'), ''), 60),
            ''
          ),
          'date_of_birth', case when profile.date_of_birth is null then '' else 'provided' end,
          'height_cm', profile.height_cm,
          'weight_kg', profile.weight_kg,
          'smoker', left(coalesce(profile.smoker, ''), 60),
          'visible_tattoos', left(coalesce(profile.visible_tattoos, ''), 120),
          'bio', left(coalesce(profile.bio, ''), 2000),
          'languages', private.bluedeck_snapshot_languages(
            to_jsonb(profile.languages)
          ),
          'personal_skills', private.bluedeck_snapshot_text_array(
            to_jsonb(profile.personal_skills), 30, 120
          ),
          'personal_characteristics', private.bluedeck_snapshot_text_array(
            to_jsonb(profile.personal_characteristics), 30, 120
          ),
          'work_preferences', private.bluedeck_snapshot_text_array(
            to_jsonb(profile.work_preferences), 30, 120
          ),
          'notes', case
            when coalesce(profile.notes, '') like '__BLUDECK_FIND_CREW__%'
              then left(split_part(profile.notes, E'\n', 1), 1000)
            else ''
          end,
          'profile_photo_url', case
            when nullif(btrim(profile.profile_photo_url), '') is null then ''
            else 'provided'
          end
        )
        from public.crew_profiles as profile
        left join auth.users as account
          on account.id = profile.user_id
        where profile.id = p_application.crew_profile_id
          and profile.user_id = p_application.applicant_user_id
      ),
      jsonb_build_object(
        'full_name', p_application.applicant_name_snapshot,
        'current_position', p_application.applicant_position_snapshot
      )
    ),
    'experiences', coalesce(
      (
        select jsonb_agg(
          to_jsonb(experience_row) - array['id', 'created_at']::text[]
          order by experience_row.created_at, experience_row.id
        )
        from (
          select
            experience.id,
            case when nullif(btrim(experience.yacht_name), '') is null then '' else 'provided' end as yacht_name,
            case
              when experience.yacht_type = '__BLUDECK_OTHER_WORK__'
                then '__BLUDECK_OTHER_WORK__'
              when nullif(btrim(experience.yacht_type), '') is null then ''
              else 'provided'
            end as yacht_type,
            case when nullif(btrim(experience.yacht_program), '') is null then '' else 'provided' end as yacht_program,
            case when nullif(btrim(experience.yacht_size), '') is null then '' else 'provided' end as yacht_size,
            case when nullif(btrim(experience.location), '') is null then '' else 'provided' end as location,
            case when nullif(btrim(experience.position), '') is null then '' else 'provided' end as position,
            case
              when experience.start_date is null then null
              else to_char(experience.start_date, 'YYYY') || '-01-01'
            end as start_date,
            case when experience.end_date is null then null else 'provided' end as end_date,
            repeat(
              'x',
              least(char_length(coalesce(experience.description, '')), 160)
            ) as description,
            experience.created_at
          from public.crew_experiences as experience
          where experience.crew_profile_id = p_application.crew_profile_id
          order by experience.created_at, experience.id
          limit 200
        ) as experience_row
      ),
      '[]'::jsonb
    ),
    'reference_count', (
      select count(*)
      from public.crew_references as reference
      where reference.crew_profile_id = p_application.crew_profile_id
    ),
    'experience_years', coalesce(
      (
        select greatest(
          extract(year from current_date)::integer
            - min(extract(year from experience.start_date))::integer,
          1
        )
        from public.crew_experiences as experience
        where experience.crew_profile_id = p_application.crew_profile_id
          and experience.start_date is not null
          and coalesce(experience.yacht_type, '') <> '__BLUDECK_OTHER_WORK__'
      ),
      0
    ),
    'document_count', (
      select count(*)
      from public.crew_documents as document
      where document.crew_profile_id = p_application.crew_profile_id
    )
  );
$function$;

create or replace function private.bluedeck_job_application_media_snapshot(
  p_application public.job_applications
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select jsonb_build_object(
    'avatar_source', coalesce(
      (
        select private.bluedeck_snapshot_media_path(
          profile.profile_photo_url,
          profile.id,
          profile.user_id
        )
        from public.crew_profiles as profile
        where profile.id = p_application.crew_profile_id
          and profile.user_id = p_application.applicant_user_id
      ),
      ''
    ),
    'gallery', coalesce(
      (
        select jsonb_agg(
          to_jsonb(photo_row) - array['id', 'created_at']::text[]
          order by photo_row.created_at desc, photo_row.id
        )
        from (
          select
            photo.id,
            private.bluedeck_snapshot_media_path(
              photo.image_url,
              p_application.crew_profile_id,
              p_application.applicant_user_id
            ) as image_url,
            photo.created_at
          from public.crew_portfolio_photos as photo
          where photo.crew_profile_id = p_application.crew_profile_id
            and private.bluedeck_snapshot_media_path(
              photo.image_url,
              p_application.crew_profile_id,
              p_application.applicant_user_id
            ) <> ''
          order by photo.created_at desc, photo.id
          limit 4
        ) as photo_row
      ),
      '[]'::jsonb
    )
  );
$function$;

create or replace function private.bluedeck_capture_job_application_snapshot()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
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
    private.bluedeck_job_application_media_snapshot(new),
    new.submitted_at,
    new.submitted_at + interval '1 year',
    null
  )
  on conflict (application_id) do nothing;

  return new;
end;
$function$;

drop trigger if exists job_applications_zz_capture_snapshot
  on public.job_applications;
create trigger job_applications_zz_capture_snapshot
after insert on public.job_applications
for each row execute function private.bluedeck_capture_job_application_snapshot();

create or replace function private.bluedeck_update_job_application_snapshot_retention()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if new.status in ('withdrawn', 'rejected')
    and new.status is distinct from old.status
  then
    update public.job_application_snapshots as snapshot
    set expires_at = least(
      snapshot.expires_at,
      new.status_changed_at + interval '30 days'
    )
    where snapshot.application_id = new.id
      and snapshot.purged_at is null;
  elsif old.status = 'rejected'
    and new.status = 'reviewing'
  then
    -- Reopening is allowed by the application state machine. Restore a useful
    -- review window without ever retaining the original snapshot for longer
    -- than one year from submission.
    update public.job_application_snapshots as snapshot
    set expires_at = greatest(
      snapshot.expires_at,
      least(
        snapshot.captured_at + interval '1 year',
        new.status_changed_at + interval '180 days'
      )
    )
    where snapshot.application_id = new.id
      and snapshot.purged_at is null;
  end if;
  return new;
end;
$function$;

drop trigger if exists job_applications_zz_snapshot_retention
  on public.job_applications;
create trigger job_applications_zz_snapshot_retention
after update of status on public.job_applications
for each row execute function private.bluedeck_update_job_application_snapshot_retention();

create or replace function private.bluedeck_guard_expired_application_reopen()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
begin
  if old.status = 'rejected'
    and new.status = 'reviewing'
    and not exists (
      select 1
      from public.job_application_snapshots as snapshot
      where snapshot.application_id = old.id
        and snapshot.purged_at is null
        and snapshot.expires_at > statement_timestamp()
    )
  then
    raise exception using
      errcode = '23514',
      message = 'An expired rejected application cannot be reopened.';
  end if;
  return new;
end;
$function$;

drop trigger if exists job_applications_00_snapshot_reopen_guard
  on public.job_applications;
create trigger job_applications_00_snapshot_reopen_guard
before update of status on public.job_applications
for each row execute function private.bluedeck_guard_expired_application_reopen();

create or replace function private.bluedeck_purge_expired_job_application_snapshots()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  purged_count integer;
begin
  update public.job_application_snapshots as snapshot
  set candidate_snapshot = '{}'::jsonb,
      media_snapshot = '{}'::jsonb,
      purged_at = statement_timestamp()
  where snapshot.purged_at is null
    and snapshot.expires_at <= statement_timestamp();

  get diagnostics purged_count = row_count;
  return purged_count;
end;
$function$;

create or replace function private.bluedeck_purge_expired_job_applications()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  purged_count integer;
begin
  -- Two years keeps a bounded recruitment/audit record while ensuring names,
  -- email snapshots and cover notes are not retained indefinitely.
  delete from public.job_application_events as event
  using public.job_applications as application
  inner join public.job_posts as post
    on post.id = application.job_post_id
  where event.application_id = application.id
    and application.submitted_at <= statement_timestamp() - interval '2 years'
    and (
      application.status in ('withdrawn', 'rejected', 'hired')
      or post.status = 'closed'
    );

  delete from public.job_applications as application
  using public.job_posts as post
  where post.id = application.job_post_id
    and application.submitted_at <= statement_timestamp() - interval '2 years'
    and (
      application.status in ('withdrawn', 'rejected', 'hired')
      or post.status = 'closed'
    );

  get diagnostics purged_count = row_count;
  return purged_count;
end;
$function$;

-- Backfill once from the current state so rollout never falls back to a live
-- profile read for applications created before this migration.
insert into public.job_application_snapshots (
  application_id,
  candidate_snapshot,
  media_snapshot,
  captured_at,
  expires_at,
  purged_at
)
select
  application.id,
  private.bluedeck_job_application_candidate_snapshot(application),
  private.bluedeck_job_application_media_snapshot(application),
  application.submitted_at,
  least(
    application.submitted_at + interval '1 year',
    case
      when application.status in ('withdrawn', 'rejected')
        then application.status_changed_at + interval '30 days'
      else application.submitted_at + interval '1 year'
    end
  ),
  null
from public.job_applications as application
on conflict (application_id) do nothing;

select cron.unschedule(jobid)
from cron.job
where jobname = 'bluedeck-purge-job-application-snapshots';

select cron.schedule(
  'bluedeck-purge-job-application-snapshots',
  '17 3 * * *',
  $cron$
    select private.bluedeck_purge_expired_job_application_snapshots();
    select private.bluedeck_purge_expired_job_applications();
  $cron$
);

revoke all on function private.bluedeck_job_application_candidate_snapshot(public.job_applications)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_snapshot_text_array(jsonb, integer, integer)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_snapshot_languages(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_snapshot_media_path(text, uuid, uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_job_application_media_snapshot(public.job_applications)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_capture_job_application_snapshot()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_update_job_application_snapshot_retention()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_guard_expired_application_reopen()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_purge_expired_job_application_snapshots()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_purge_expired_job_applications()
  from public, anon, authenticated, service_role;
revoke all on function public.bluedeck_job_application_media_path_locked(text)
  from public, anon;
grant execute on function public.bluedeck_job_application_media_path_locked(text)
  to authenticated, service_role;

comment on table public.job_application_snapshots is
  'Server-only immutable employer view captured at application submission; detailed data expires after one year and is shortened to thirty days after withdrawal or rejection. The remaining application identity and audit record is deleted after two years once terminal or closed.';

commit;
