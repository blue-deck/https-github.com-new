-- Add an optional stable yacht-program classification for job listings while
-- retaining null for legacy records and drafts where no program is selected.

begin;

alter table public.job_posts
  add column yacht_program text;

alter table public.job_posts
  add constraint job_posts_yacht_program_check
  check (
    yacht_program is null
    or yacht_program in ('private', 'charter', 'private_charter')
  ) not valid;

alter table public.job_posts
  validate constraint job_posts_yacht_program_check;

comment on column public.job_posts.yacht_program is
  'Optional stable yacht-program slug for a job listing: private, charter or private_charter; null for legacy and unselected listings.';

create or replace function private.bluedeck_enforce_job_post_yacht_details()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $function$
begin
  -- Terminal transitions are allowed for legacy published listings whose yacht
  -- details predate this feature. They must retain their original snapshot,
  -- including an all-null legacy snapshot, during manual or automatic closure.
  if tg_op = 'UPDATE'
    and old.status in ('draft', 'published')
    and new.status = 'closed'
  then
    new.yacht_type := old.yacht_type;
    new.yacht_program := old.yacht_program;
    new.yacht_length := old.yacht_length;
    new.yacht_length_unit := old.yacht_length_unit;
    return new;
  end if;

  new.yacht_type := nullif(
    lower(btrim(coalesce(new.yacht_type, ''))),
    ''
  );
  new.yacht_program := nullif(
    lower(btrim(coalesce(new.yacht_program, ''))),
    ''
  );
  new.yacht_length_unit := nullif(
    lower(btrim(coalesce(new.yacht_length_unit, ''))),
    ''
  );

  if new.status = 'published'
    and (
      new.yacht_type is null
      or new.yacht_length is null
      or new.yacht_length_unit is null
    )
  then
    raise exception using
      errcode = '23514',
      message = 'Published job posts require yacht type, length and length unit.';
  end if;

  return new;
end;
$function$;

revoke all on function private.bluedeck_enforce_job_post_yacht_details()
  from public, anon, authenticated, service_role;

create or replace function public.prepare_job_post_write()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
set timezone = 'UTC'
as $function$
declare
  actor_id uuid;
  authority_revocation_close boolean := false;
  automatic_expiry_close boolean := false;
  write_time timestamptz := statement_timestamp();
begin
  new.title := btrim(coalesce(new.title, ''));
  new.position := btrim(coalesce(new.position, ''));
  new.department := btrim(coalesce(new.department, ''));
  new.employment_type := lower(btrim(coalesce(new.employment_type, '')));
  new.location := btrim(coalesce(new.location, ''));
  new.summary := btrim(coalesce(new.summary, ''));
  new.description := btrim(coalesce(new.description, ''));
  new.responsibilities := coalesce(new.responsibilities, array[]::text[]);
  new.requirements := coalesce(new.requirements, array[]::text[]);
  new.benefits := coalesce(new.benefits, array[]::text[]);
  new.salary_currency := upper(btrim(coalesce(new.salary_currency, 'EUR')));
  new.salary_period := lower(btrim(coalesce(new.salary_period, 'month')));
  new.salary_visible := new.salary_min is not null or new.salary_max is not null;
  -- These legacy columns are intentionally inert. A future recruitment/yacht
  -- association must be introduced explicitly instead of reviving this link.
  new.yacht_id := null;
  new.show_yacht_name := false;

  if tg_op = 'INSERT' then
    if new.created_by is null or new.updated_by is distinct from new.created_by then
      raise exception using
        errcode = '23514',
        message = 'A job post requires one authenticated creator.';
    end if;
    actor_id := new.created_by;
  else
    if new.id is distinct from old.id
      or new.created_by is distinct from old.created_by
      or new.created_at is distinct from old.created_at
    then
      raise exception using
        errcode = '22023',
        message = 'Job post identity fields cannot be changed.';
    end if;
    if new.updated_by is null or new.updated_by is distinct from old.created_by then
      raise exception using
        errcode = '42501',
        message = 'Only the account that created this job post may update it.';
    end if;
    actor_id := new.updated_by;

    automatic_expiry_close := (
      coalesce(current_setting('bluedeck.job_post_expiry_run', true), '') = 'on'
      and old.status = 'published'
      and new.status = 'closed'
      and old.closes_at is not null
      and old.closes_at <= write_time
    );

    if old.status = 'closed' then
      raise exception using
        errcode = '23514',
        message = 'Closed job posts are immutable.';
    end if;

    if old.status = 'published'
      and old.closes_at is not null
      and old.closes_at <= write_time
      and new.status is not distinct from old.status
    then
      raise exception using
        errcode = '23514',
        message = 'Expired job posts cannot be edited.';
    end if;
  end if;

  if not private.bluedeck_has_job_publisher_authority(actor_id) then
    authority_revocation_close := (
      tg_op = 'UPDATE'
      and old.status in ('draft', 'published')
      and new.status = 'closed'
      and new.updated_by = old.created_by
      and new.title is not distinct from old.title
      and new.position is not distinct from old.position
      and new.department is not distinct from old.department
      and new.employment_type is not distinct from old.employment_type
      and new.candidate_type is not distinct from old.candidate_type
      and new.smoker_policy is not distinct from old.smoker_policy
      and new.visible_tattoo_policy is not distinct from old.visible_tattoo_policy
      and new.required_languages is not distinct from old.required_languages
      and new.required_skills is not distinct from old.required_skills
      and new.required_characteristics is not distinct from old.required_characteristics
      and new.required_certificates is not distinct from old.required_certificates
      and new.required_visas is not distinct from old.required_visas
      and new.yacht_brand is not distinct from old.yacht_brand
      and new.yacht_flag_country_code is not distinct from old.yacht_flag_country_code
      and new.yacht_build_year is not distinct from old.yacht_build_year
      and new.yacht_type is not distinct from old.yacht_type
      and new.yacht_program is not distinct from old.yacht_program
      and new.yacht_length is not distinct from old.yacht_length
      and new.yacht_length_unit is not distinct from old.yacht_length_unit
      and new.crew_member_count is not distinct from old.crew_member_count
      and new.minimum_yacht_experience is not distinct from old.minimum_yacht_experience
      and new.location is not distinct from old.location
      and new.start_date is not distinct from old.start_date
      and new.summary is not distinct from old.summary
      and new.description is not distinct from old.description
      and new.responsibilities is not distinct from old.responsibilities
      and new.requirements is not distinct from old.requirements
      and new.benefits is not distinct from old.benefits
      and new.salary_visible is not distinct from old.salary_visible
      and new.salary_min is not distinct from old.salary_min
      and new.salary_max is not distinct from old.salary_max
      and new.salary_currency is not distinct from old.salary_currency
      and new.salary_period is not distinct from old.salary_period
      and new.closes_at is not distinct from old.closes_at
      and new.closure_reason is not distinct from old.closure_reason
    );

    if not authority_revocation_close then
      raise exception using
        errcode = '42501',
        message = 'Current account-level job publishing authority is required.';
    end if;
  end if;

  if tg_op = 'UPDATE'
    and new.status is distinct from old.status
    and not (
      (old.status = 'draft' and new.status in ('published', 'closed'))
      or (old.status = 'published' and new.status = 'closed')
    )
  then
    raise exception using
      errcode = '23514',
      message = format('Job post cannot move from %s to %s.', old.status, new.status);
  end if;

  if new.status = 'published'
    and (
      char_length(new.title) < 3
      or char_length(new.position) < 1
      or char_length(new.location) < 2
      or new.start_date is null
      or new.yacht_type is null
      or new.yacht_length is null
      or new.yacht_length_unit is null
      or not new.salary_visible
      or greatest(coalesce(new.salary_min, 0), coalesce(new.salary_max, 0)) <= 0
      or char_length(new.description) < 60
    )
  then
    raise exception using
      errcode = '23514',
      message = 'Published job posts require position, employment type, location, start date, salary, yacht type, yacht length and description.';
  end if;

  if tg_op = 'INSERT' then
    new.created_at := write_time;
    new.updated_at := write_time;
    new.version := 1;

    if new.status = 'published' then
      new.published_at := write_time;
      new.published_by := actor_id;
      new.closes_at := (
        (write_time at time zone 'UTC' + interval '1 month') at time zone 'UTC'
      );
      new.closed_at := null;
      new.closed_by := null;
      new.closure_reason := null;
    elsif new.status = 'draft' then
      new.published_at := null;
      new.published_by := null;
      new.closes_at := null;
      new.closed_at := null;
      new.closed_by := null;
      new.closure_reason := null;
    else
      raise exception using
        errcode = '23514',
        message = 'New job posts must start as draft or published.';
    end if;

    return new;
  end if;

  new.created_at := old.created_at;
  new.updated_at := write_time;
  new.version := old.version + 1;

  if new.status is not distinct from old.status then
    new.published_at := old.published_at;
    new.published_by := old.published_by;
    new.closes_at := old.closes_at;
    new.closed_at := old.closed_at;
    new.closed_by := old.closed_by;
    new.closure_reason := old.closure_reason;
  elsif new.status = 'published' then
    new.published_at := write_time;
    new.published_by := actor_id;
    new.closes_at := (
      (write_time at time zone 'UTC' + interval '1 month') at time zone 'UTC'
    );
    new.closed_at := null;
    new.closed_by := null;
    new.closure_reason := null;
  elsif new.status = 'closed' then
    new.published_at := old.published_at;
    new.published_by := old.published_by;
    new.closes_at := old.closes_at;
    new.closed_at := write_time;
    new.closed_by := actor_id;
    new.closure_reason := case
      when automatic_expiry_close then 'expired'
      else 'cancelled'
    end;
  end if;

  return new;
end;
$function$;

revoke all on function public.prepare_job_post_write()
  from public, anon, authenticated, service_role;

commit;
