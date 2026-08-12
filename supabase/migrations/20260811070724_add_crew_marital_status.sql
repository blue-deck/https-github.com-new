-- Add an explicitly optional, bounded marital-status field to crew profiles.
-- The value is visible anywhere the crew member's professional profile is
-- intentionally shared, including immutable job-application snapshots.

begin;

alter table public.crew_profiles
  add column if not exists marital_status text;

alter table public.crew_profiles
  drop constraint if exists crew_profiles_marital_status_check;
alter table public.crew_profiles
  add constraint crew_profiles_marital_status_check check (
    marital_status is null
    or marital_status in ('Single', 'Married')
  ) not valid;
alter table public.crew_profiles
  validate constraint crew_profiles_marital_status_check;

comment on column public.crew_profiles.marital_status is
  'Optional crew-declared marital status: Single or Married. Shared in CVs, employer application snapshots and the public crew directory.';

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
          'marital_status', left(coalesce(profile.marital_status, ''), 16),
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
        'current_position', p_application.applicant_position_snapshot,
        'marital_status', ''
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

-- Existing, unexpired applications predate the field. Capture its current
-- value once at rollout so their View profile panels have the same shape as
-- applications submitted after this migration.
update public.job_application_snapshots as snapshot
set candidate_snapshot = jsonb_set(
  snapshot.candidate_snapshot,
  '{profile,marital_status}',
  to_jsonb(coalesce(profile.marital_status, '')),
  true
)
from public.job_applications as application
inner join public.crew_profiles as profile
  on profile.id = application.crew_profile_id
 and profile.user_id = application.applicant_user_id
where snapshot.application_id = application.id
  and snapshot.purged_at is null
  and jsonb_typeof(snapshot.candidate_snapshot -> 'profile') = 'object';

commit;
