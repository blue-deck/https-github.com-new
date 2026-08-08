-- Bound crew career records at the database boundary. The application owns all
-- mutations for related career rows so a browser cannot bypass validation,
-- media cleanup, or per-profile quotas by calling PostgREST directly.

begin;

create schema if not exists private;

-- Keep self-service reads for the authenticated profile owner, but route every
-- mutation through the authenticated application API (which uses service_role
-- after checking the bearer session and durable Crew/Captain entitlement).
revoke insert, update, delete on table
  public.crew_documents,
  public.crew_references,
  public.crew_experiences,
  public.crew_portfolio_photos
from authenticated;

do $policies$
declare
  target_table text;
  policy_row record;
begin
  foreach target_table in array array[
    'crew_documents',
    'crew_references',
    'crew_experiences',
    'crew_portfolio_photos'
  ]
  loop
    for policy_row in
      select policyname
      from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename = target_table
        and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
    loop
      execute format(
        'drop policy if exists %I on public.%I',
        policy_row.policyname,
        target_table
      );
    end loop;
  end loop;
end;
$policies$;

-- One canonical career profile per Auth account. Unlinked legacy/invited
-- profiles remain possible until they are claimed by a verified account.
create unique index if not exists crew_profiles_user_id_uidx
  on public.crew_profiles (user_id)
  where user_id is not null;

alter table public.crew_profiles
  drop constraint if exists crew_profiles_bounded_text_check;
alter table public.crew_profiles
  add constraint crew_profiles_bounded_text_check check (
    octet_length(coalesce(full_name, '')) <= 512
    and octet_length(coalesce(email, '')) <= 320
    and octet_length(coalesce(phone, '')) <= 128
    and octet_length(coalesce(nationality, '')) <= 256
    and octet_length(coalesce(position, '')) <= 256
    and octet_length(coalesce(passport_no, '')) <= 256
    and octet_length(coalesce(passport_number, '')) <= 256
    and octet_length(coalesce(place_of_birth, '')) <= 512
    and octet_length(coalesce(emergency_contact, '')) <= 2_048
    and octet_length(coalesce(cv_url, '')) <= 4_096
    and octet_length(coalesce(notes, '')) <= 65_536
    and octet_length(coalesce(status, '')) <= 64
    and octet_length(coalesce(public_crew_id, '')) <= 64
    and octet_length(coalesce(current_position, '')) <= 256
    and octet_length(coalesce(location, '')) <= 512
    and octet_length(coalesce(bio, '')) <= 32_768
    and octet_length(coalesce(visa_country, '')) <= 256
    and octet_length(coalesce(profile_photo_url, '')) <= 4_096
    and octet_length(coalesce(gender, '')) <= 64
    and octet_length(coalesce(visible_tattoos, '')) <= 64
    and octet_length(coalesce(smoker, '')) <= 64
  ) not valid;

alter table public.crew_profiles
  drop constraint if exists crew_profiles_bounded_collections_check;
alter table public.crew_profiles
  add constraint crew_profiles_bounded_collections_check check (
    coalesce(cardinality(current_positions), 0) <= 100
    and octet_length(coalesce(array_to_string(current_positions, ''), '')) <= 32_768
    and coalesce(cardinality(seeking_positions), 0) <= 100
    and octet_length(coalesce(array_to_string(seeking_positions, ''), '')) <= 32_768
    and coalesce(cardinality(work_preferences), 0) <= 100
    and octet_length(coalesce(array_to_string(work_preferences, ''), '')) <= 32_768
    and coalesce(cardinality(personal_skills), 0) <= 100
    and octet_length(coalesce(array_to_string(personal_skills, ''), '')) <= 32_768
    and coalesce(cardinality(personal_characteristics), 0) <= 100
    and octet_length(coalesce(array_to_string(personal_characteristics, ''), '')) <= 32_768
    and (
      languages is null
      or (
        jsonb_typeof(languages) = 'array'
        and octet_length(languages::text) <= 32_768
        and jsonb_array_length(languages) <= 100
      )
    )
  ) not valid;

alter table public.crew_profiles
  drop constraint if exists crew_profiles_physical_domain_check;
alter table public.crew_profiles
  add constraint crew_profiles_physical_domain_check check (
    (date_of_birth is null or date_of_birth >= date '1900-01-01')
    and (height_cm is null or height_cm between 100 and 250)
    and (weight_kg is null or weight_kg between 30 and 300)
  ) not valid;

alter table public.crew_documents
  drop constraint if exists crew_documents_bounded_payload_check;
alter table public.crew_documents
  add constraint crew_documents_bounded_payload_check check (
    octet_length(coalesce(document_name, '')) <= 1_000
    and octet_length(coalesce(document_type, '')) <= 1_000
    and octet_length(coalesce(document_no, '')) <= 1_000
    and octet_length(coalesce(file_url, '')) <= 4_096
    and octet_length(coalesce(status, '')) <= 64
    and octet_length(coalesce(category, '')) <= 1_000
    and octet_length(coalesce(issuer, '')) <= 1_000
    and octet_length(coalesce(notes, '')) <= 10_000
  ) not valid;

alter table public.crew_references
  drop constraint if exists crew_references_bounded_payload_check;
alter table public.crew_references
  add constraint crew_references_bounded_payload_check check (
    octet_length(coalesce(name, '')) <= 1_000
    and octet_length(coalesce(role, '')) <= 1_000
    and octet_length(coalesce(vessel, '')) <= 1_000
    and octet_length(coalesce(company, '')) <= 1_000
    and octet_length(coalesce(phone, '')) <= 1_000
    and octet_length(coalesce(email, '')) <= 1_000
    and octet_length(coalesce(notes, '')) <= 10_000
  ) not valid;

alter table public.crew_experiences
  drop constraint if exists crew_experiences_bounded_payload_check;
alter table public.crew_experiences
  add constraint crew_experiences_bounded_payload_check check (
    octet_length(coalesce(yacht_name, '')) <= 1_000
    and octet_length(coalesce(position, '')) <= 1_000
    and octet_length(coalesce(description, '')) <= 10_000
    and octet_length(coalesce(photo_url, '')) <= 4_096
    and octet_length(coalesce(yacht_type, '')) <= 1_000
    and octet_length(coalesce(yacht_program, '')) <= 1_000
    and octet_length(coalesce(yacht_size, '')) <= 1_000
    and octet_length(coalesce(location, '')) <= 1_000
  ) not valid;

alter table public.crew_portfolio_photos
  drop constraint if exists crew_portfolio_photos_bounded_payload_check;
alter table public.crew_portfolio_photos
  add constraint crew_portfolio_photos_bounded_payload_check check (
    octet_length(coalesce(title, '')) <= 1_000
    and octet_length(coalesce(image_url, '')) <= 4_096
    and octet_length(coalesce(location, '')) <= 1_000
  ) not valid;

alter table public.crew_profiles
  validate constraint crew_profiles_bounded_text_check;
alter table public.crew_profiles
  validate constraint crew_profiles_bounded_collections_check;
alter table public.crew_profiles
  validate constraint crew_profiles_physical_domain_check;
alter table public.crew_documents
  validate constraint crew_documents_bounded_payload_check;
alter table public.crew_references
  validate constraint crew_references_bounded_payload_check;
alter table public.crew_experiences
  validate constraint crew_experiences_bounded_payload_check;
alter table public.crew_portfolio_photos
  validate constraint crew_portfolio_photos_bounded_payload_check;

create or replace function private.bluedeck_guard_crew_profile_birth_date()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if new.date_of_birth is not null
    and new.date_of_birth > current_date
  then
    raise exception using
      errcode = '23514',
      message = 'Date of birth cannot be in the future.';
  end if;
  return new;
end;
$function$;

drop trigger if exists crew_profile_20_birth_date_domain
  on public.crew_profiles;
create trigger crew_profile_20_birth_date_domain
before insert or update of date_of_birth on public.crew_profiles
for each row execute function private.bluedeck_guard_crew_profile_birth_date();

create or replace function private.bluedeck_guard_crew_related_quota()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  maximum_rows integer;
  current_rows bigint;
  existing_row boolean;
begin
  if new.crew_profile_id is null then
    raise exception using
      errcode = '23514',
      message = 'Crew profile id is required.';
  end if;

  maximum_rows := case tg_table_name
    when 'crew_documents' then 100
    when 'crew_references' then 100
    when 'crew_experiences' then 200
    when 'crew_portfolio_photos' then 200
    else 0
  end;

  if maximum_rows = 0 then
    raise exception using
      errcode = 'P0001',
      message = 'Unsupported crew career table.';
  end if;

  -- Postgres runs BEFORE INSERT triggers before resolving ON CONFLICT. Let a
  -- service-owned upsert of an existing row proceed; it does not increase the
  -- table cardinality and is used for gallery reordering at the quota ceiling.
  execute format(
    'select exists (select 1 from public.%I where id = $1)',
    tg_table_name
  )
  into existing_row
  using new.id;

  if existing_row then
    return new;
  end if;

  -- Serialize inserts for a profile/table pair so concurrent requests cannot
  -- race past the row quota.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'bluedeck:crew-related:' || tg_table_name || ':' || new.crew_profile_id::text,
      0
    )
  );

  -- Lock the durable parent as well. This gives concurrent inserts a real row
  -- serialization point and ensures the count below observes a predecessor
  -- transaction before evaluating the limit.
  perform 1
  from public.crew_profiles as profile
  where profile.id = new.crew_profile_id
  for update;

  if not found then
    raise exception using
      errcode = '23503',
      message = 'Crew profile does not exist.';
  end if;

  execute format(
    'select count(*) from public.%I where crew_profile_id = $1',
    tg_table_name
  )
  into current_rows
  using new.crew_profile_id;

  if current_rows >= maximum_rows then
    raise exception using
      errcode = '23514',
      message = format('%s row limit reached.', tg_table_name),
      hint = 'Delete an existing record before adding another one.';
  end if;

  return new;
end;
$function$;

do $triggers$
declare
  target_table text;
begin
  foreach target_table in array array[
    'crew_documents',
    'crew_references',
    'crew_experiences',
    'crew_portfolio_photos'
  ]
  loop
    execute format(
      'drop trigger if exists bluedeck_guard_crew_related_quota on public.%I',
      target_table
    );
    execute format(
      'create trigger bluedeck_guard_crew_related_quota '
      || 'before insert on public.%I for each row '
      || 'execute function private.bluedeck_guard_crew_related_quota()',
      target_table
    );
  end loop;
end;
$triggers$;

revoke all on function private.bluedeck_guard_crew_related_quota()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_guard_crew_profile_birth_date()
  from public, anon, authenticated, service_role;

comment on function private.bluedeck_guard_crew_related_quota() is
  'Serializes and enforces bounded per-profile career child rows for every database caller, including service_role.';

commit;
