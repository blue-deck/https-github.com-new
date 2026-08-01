-- Serve the public crew directory from one bounded, privacy-filtered database
-- snapshot instead of scanning every profile, entitlement, Auth account and
-- experience row in application memory on each request.

begin;

create schema if not exists private;

create or replace function private.bluedeck_try_jsonb(p_value text)
returns jsonb
language plpgsql
immutable
set search_path = pg_catalog
as $function$
begin
  return p_value::jsonb;
exception
  when others then
    return null;
end;
$function$;

update public.crew_profiles
set public_crew_id = upper(btrim(public_crew_id))
where public_crew_id is not null
  and public_crew_id is distinct from upper(btrim(public_crew_id));

-- Preserve the oldest canonical public ID, then give every invalid or
-- case-insensitive duplicate legacy row an opaque, collision-checked stable ID.
-- Public identifiers must not expose either the profile UUID or Auth UUID.
do $block$
declare
  target record;
  candidate text;
begin
  for target in
    with ranked as (
      select
        profile.id,
        profile.public_crew_id,
        row_number() over (
          partition by upper(btrim(profile.public_crew_id))
          order by profile.created_at nulls last, profile.id
        ) as duplicate_rank
      from public.crew_profiles as profile
      where profile.public_crew_id is not null
    )
    select ranked.id
    from ranked
    where ranked.duplicate_rank > 1
      or ranked.public_crew_id !~ '^[A-Z0-9_-]{1,64}$'
  loop
    candidate := 'BD-' || upper(replace(gen_random_uuid()::text, '-', ''));
    while exists (
      select 1
      from public.crew_profiles as existing
      where existing.id <> target.id
        and upper(btrim(existing.public_crew_id)) = candidate
    ) loop
      candidate := 'BD-' || upper(replace(gen_random_uuid()::text, '-', ''));
    end loop;

    update public.crew_profiles
    set public_crew_id = candidate
    where id = target.id;
  end loop;
end;
$block$;

drop index if exists public.crew_profiles_public_directory_id_idx;
create unique index crew_profiles_public_directory_id_uidx
  on public.crew_profiles (upper(btrim(public_crew_id)))
  where public_crew_id is not null;

create or replace function private.bluedeck_guard_public_crew_id()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if tg_op = 'UPDATE' then
    if old.public_crew_id is null and new.public_crew_id is not null then
      new.public_crew_id := 'BD-' || upper(
        replace(gen_random_uuid()::text, '-', '')
      );
      return new;
    end if;
    if new.public_crew_id is distinct from old.public_crew_id then
      raise exception using
        errcode = '42501',
        message = 'A public Crew ID is immutable.';
    end if;
    return new;
  end if;

  new.public_crew_id := 'BD-' || upper(
    replace(gen_random_uuid()::text, '-', '')
  );
  return new;
end;
$function$;

drop trigger if exists crew_profiles_00_guard_public_crew_id
  on public.crew_profiles;
create trigger crew_profiles_00_guard_public_crew_id
before insert or update of public_crew_id on public.crew_profiles
for each row execute function private.bluedeck_guard_public_crew_id();

create index if not exists crew_profiles_public_directory_page_idx
  on public.crew_profiles (
    coalesce(updated_at, created_at) desc,
    id desc
  )
  where status = 'active'
    and notes like '__BLUDECK_FIND_CREW__%';

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
      coalesce(profile.updated_at, profile.created_at) as cursor_updated_at,
      private.bluedeck_try_jsonb(
        substr(
          split_part(profile.notes, E'\n', 1),
          length('__BLUDECK_FIND_CREW__') + 1
        )
      ) as discovery
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
      and profile.notes like '__BLUDECK_FIND_CREW__%'
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
    where eligible.discovery ->> 'discoverable' = 'true'
      and coalesce(
        eligible.discovery ->> 'contactVisibility',
        'request_only'
      ) <> 'hidden'
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
      left(split_part(selected.notes, E'\n', 1), 1000) as notes,
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

revoke all on function private.bluedeck_try_jsonb(text)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_guard_public_crew_id()
  from public, anon, authenticated, service_role;
revoke all on function public.bluedeck_public_crew_page(
  timestamptz, uuid, integer
) from public, anon, authenticated;
grant execute on function public.bluedeck_public_crew_page(
  timestamptz, uuid, integer
) to service_role;

comment on function public.bluedeck_public_crew_page(
  timestamptz, uuid, integer
) is
  'Service-only cursor page of current explicit Find Crew opt-ins, projected and bounded before leaving the database.';

commit;
