-- Default missing Crew availability to Available while keeping an explicit
-- Not available choice out of every public directory and public-media path.
-- Availability remains embedded in the private notes envelope, so existing
-- private notes and application snapshots are not rewritten.

begin;

create or replace function private.bluedeck_crew_availability_status(
  p_notes text
)
returns text
language sql
immutable
set search_path = pg_catalog, private
as $function$
  select case normalized.raw_status
    when 'Available' then 'Available'
    when 'In 1 week' then 'In 1 week'
    when 'In 1 month' then 'In 1 month'
    when 'Open to offers' then 'Open to offers'
    when 'Not available' then 'Not available'
    when 'Available now' then 'Available'
    when 'Available soon' then 'In 1 week'
    when 'Currently employed' then 'Not available'
    else 'Available'
  end
  from (
    select case
      when left(
        coalesce(p_notes, ''),
        length('__BLUDECK_FIND_CREW__')
      ) = '__BLUDECK_FIND_CREW__'
        then btrim(coalesce(
          private.bluedeck_try_jsonb(
            substr(
              split_part(p_notes, E'\n', 1),
              length('__BLUDECK_FIND_CREW__') + 1
            )
          ) ->> 'availabilityStatus',
          ''
        ))
      else ''
    end as raw_status
  ) as normalized;
$function$;

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
      and private.bluedeck_crew_availability_status(profile.notes) <>
        'Not available'
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
        when left(
          coalesce(selected.notes, ''),
          length('__BLUDECK_FIND_CREW__')
        ) = '__BLUDECK_FIND_CREW__'
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

create or replace function public.bluedeck_public_crew_media_manifest(
  p_profile_ids uuid[],
  p_include_gallery boolean default false
)
returns table (
  profile_id uuid,
  user_id uuid,
  public_crew_id text,
  avatar_source text,
  gallery jsonb
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  requested_profile_ids uuid[];
begin
  if p_profile_ids is null or cardinality(p_profile_ids) > 50 then
    raise exception using
      errcode = '22023',
      message = 'Between zero and 50 crew profile IDs are required.';
  end if;

  select coalesce(array_agg(distinct requested.profile_id), '{}'::uuid[])
  into requested_profile_ids
  from unnest(p_profile_ids) as requested(profile_id)
  where requested.profile_id is not null;

  return query
  select
    profile.id as profile_id,
    profile.user_id,
    upper(btrim(profile.public_crew_id)) as public_crew_id,
    coalesce(profile.profile_photo_url, '') as avatar_source,
    case
      when coalesce(p_include_gallery, false) then coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', selected_photo.id,
              'image_url', selected_photo.image_url,
              'created_at', selected_photo.created_at
            )
            order by selected_photo.created_at desc, selected_photo.id desc
          )
          from (
            select photo.id, photo.image_url, photo.created_at
            from public.crew_portfolio_photos as photo
            where photo.crew_profile_id = profile.id
              and nullif(btrim(photo.image_url), '') is not null
            order by photo.created_at desc, photo.id desc
            limit 100
          ) as selected_photo
        ),
        '[]'::jsonb
      )
      else '[]'::jsonb
    end as gallery
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
  where profile.id = any(requested_profile_ids)
    and profile.status = 'active'
    and profile.user_id is not null
    and profile.public_crew_id is not null
    and upper(btrim(profile.public_crew_id)) ~ '^[A-Z0-9_-]{1,64}$'
    and private.bluedeck_crew_availability_status(profile.notes) <>
      'Not available'
  order by profile.id;
end;
$function$;

revoke all on function private.bluedeck_crew_availability_status(text)
  from public, anon, authenticated, service_role;

revoke all on function public.bluedeck_public_crew_page(
  timestamptz, uuid, integer
) from public, anon, authenticated;
grant execute on function public.bluedeck_public_crew_page(
  timestamptz, uuid, integer
) to service_role;

revoke all on function public.bluedeck_public_crew_media_manifest(
  uuid[], boolean
) from public, anon, authenticated;
grant execute on function public.bluedeck_public_crew_media_manifest(
  uuid[], boolean
) to service_role;

comment on function private.bluedeck_crew_availability_status(text) is
  'Normalizes the private Crew discovery envelope without rewriting private notes; missing, blank, malformed and unknown values default to Available.';

comment on function public.bluedeck_public_crew_page(
  timestamptz, uuid, integer
) is
  'Service-only bounded cursor page of active, email-confirmed Crew and Captain accounts excluding profiles that explicitly selected Not available.';

comment on function public.bluedeck_public_crew_media_manifest(
  uuid[], boolean
) is
  'Service-only bounded media projection for directory-visible Crew/Captain profiles; employer applications fall back to immutable snapshot media when a profile is hidden.';

comment on column public.crew_profiles.notes is
  'Private profile notes plus Find Crew preferences. Missing availability defaults to Available; an explicit Not available choice removes the profile from the public directory.';

commit;
