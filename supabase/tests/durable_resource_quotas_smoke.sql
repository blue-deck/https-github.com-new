begin;

set local statement_timeout = '120s';

do $structure$
declare
  function_signature text;
  function_oid regprocedure;
  expected_trigger text;
  storage_guard_definition text;
  storage_lookup_position integer;
  storage_last_lock_position integer;
  storage_lock_needle constant text :=
    'perform private.bluedeck_lock_resource_quota';
begin
  if to_regprocedure('public.touch_updated_at()') is null then
    raise exception 'touch_updated_at() is missing.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    where procedure.oid = 'public.touch_updated_at()'::regprocedure
      and procedure.prosecdef is false
      and procedure.proconfig @> array['search_path=pg_catalog']::text[]
  ) then
    raise exception 'touch_updated_at() is not an invoker function with a fixed pg_catalog search_path.';
  end if;

  foreach function_signature in array array[
    'public.touch_updated_at()',
    'private.bluedeck_lock_resource_quota(text,text)',
    'private.bluedeck_guard_yacht_resource_quota()',
    'private.bluedeck_guard_job_post_resource_quota()',
    'private.bluedeck_guard_job_application_resource_quota()',
    'private.bluedeck_guard_crew_invitation_resource_quota()',
    'private.bluedeck_storage_object_size_bytes(jsonb)',
    'private.bluedeck_storage_tenant_id(text)',
    'private.bluedeck_storage_quota_context(text,text)',
    'private.bluedeck_guard_storage_resource_quota()'
  ]
  loop
    function_oid := to_regprocedure(function_signature);
    if function_oid is null then
      raise exception 'Required quota function is missing: %', function_signature;
    end if;

    if pg_catalog.has_function_privilege(
      'anon',
      function_oid,
      'EXECUTE'
    ) or pg_catalog.has_function_privilege(
      'authenticated',
      function_oid,
      'EXECUTE'
    ) or pg_catalog.has_function_privilege(
      'service_role',
      function_oid,
      'EXECUTE'
    ) then
      raise exception 'Quota function is directly executable by an API role: %', function_signature;
    end if;
  end loop;

  select pg_catalog.lower(pg_catalog.pg_get_functiondef(procedure.oid))
  into storage_guard_definition
  from pg_catalog.pg_proc as procedure
  where procedure.oid =
    'private.bluedeck_guard_storage_resource_quota()'::regprocedure;

  storage_lookup_position := pg_catalog.strpos(
    storage_guard_definition,
    'select object.id'
  );
  storage_last_lock_position :=
    pg_catalog.length(storage_guard_definition)
    - pg_catalog.strpos(
      pg_catalog.reverse(storage_guard_definition),
      pg_catalog.reverse(storage_lock_needle)
    )
    - pg_catalog.length(storage_lock_needle)
    + 2;

  if storage_lookup_position = 0
    or pg_catalog.strpos(storage_guard_definition, storage_lock_needle) = 0
    or storage_lookup_position <= storage_last_lock_position
  then
    raise exception 'Storage upsert lookup does not occur after every quota mutex acquisition path.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    where procedure.oid =
      'private.bluedeck_storage_quota_context(text,text)'::regprocedure
      and procedure.prosecdef is false
      and procedure.provolatile = 's'
      and procedure.proconfig @> array['search_path=pg_catalog']::text[]
  ) then
    raise exception 'Storage quota tenant resolution is not a fixed-search-path STABLE invoker function.';
  end if;

  foreach function_signature in array array[
    'private.bluedeck_lock_resource_quota(text,text)',
    'private.bluedeck_guard_yacht_resource_quota()',
    'private.bluedeck_guard_job_post_resource_quota()',
    'private.bluedeck_guard_job_application_resource_quota()',
    'private.bluedeck_guard_crew_invitation_resource_quota()',
    'private.bluedeck_guard_storage_resource_quota()'
  ]
  loop
    if not exists (
      select 1
      from pg_catalog.pg_proc as procedure
      where procedure.oid = function_signature::regprocedure
        and procedure.prosecdef is true
        and procedure.proconfig @> array['search_path=pg_catalog']::text[]
    ) then
      raise exception 'Quota guard is not SECURITY DEFINER with a fixed search_path: %', function_signature;
    end if;
  end loop;

  if not exists (
    select 1
    from pg_catalog.pg_proc as procedure
    where procedure.oid =
      'private.bluedeck_lock_resource_quota(text,text)'::regprocedure
      and pg_catalog.pg_get_functiondef(procedure.oid) like
        '%pg_advisory_xact_lock%'
      and pg_catalog.pg_get_functiondef(procedure.oid) like '%for update%'
      and pg_catalog.pg_get_functiondef(procedure.oid) like
        '%on conflict (quota_scope, resource_key) do nothing%'
  ) then
    raise exception 'Quota mutex is missing advisory-lock, durable-row or FOR UPDATE serialization.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class as relation
    inner join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'private'
      and relation.relname = 'bluedeck_resource_quota_locks'
      and relation.relrowsecurity is true
  ) then
    raise exception 'Private quota mutex table is missing RLS.';
  end if;

  if pg_catalog.has_table_privilege(
    'anon',
    'private.bluedeck_resource_quota_locks',
    'SELECT,INSERT,UPDATE,DELETE'
  ) or pg_catalog.has_table_privilege(
    'authenticated',
    'private.bluedeck_resource_quota_locks',
    'SELECT,INSERT,UPDATE,DELETE'
  ) or pg_catalog.has_table_privilege(
    'service_role',
    'private.bluedeck_resource_quota_locks',
    'SELECT,INSERT,UPDATE,DELETE'
  ) then
    raise exception 'An API role can access the private quota mutex table.';
  end if;

  foreach expected_trigger in array array[
    'public.yachts:yachts_zz_bluedeck_resource_quota',
    'public.job_posts:job_posts_zz_bluedeck_resource_quota',
    'public.job_applications:job_applications_zz_bluedeck_resource_quota',
    'public.crew_invitations:crew_invitations_zz_bluedeck_resource_quota',
    'storage.objects:objects_zz_bluedeck_resource_quota'
  ]
  loop
    if not exists (
      select 1
      from pg_catalog.pg_trigger as trigger
      where trigger.tgrelid =
        pg_catalog.split_part(expected_trigger, ':', 1)::regclass
      and trigger.tgname = pg_catalog.split_part(expected_trigger, ':', 2)
      and trigger.tgenabled = 'O'
      and not trigger.tgisinternal
    ) then
      raise exception 'Quota trigger is missing or disabled: %', expected_trigger;
    end if;
  end loop;

  if not exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and indexname = 'yachts_owner_id_quota_idx'
  ) or not exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and indexname = 'job_posts_creator_created_at_quota_idx'
  ) or not exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and indexname = 'job_posts_creator_published_quota_idx'
  ) or not exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and indexname = 'job_applications_applicant_created_at_quota_idx'
  ) or not exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and indexname = 'crew_invitations_yacht_quota_idx'
  ) or not exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and indexname = 'crew_invitations_yacht_pending_quota_idx'
  ) or not exists (
    select 1
    from pg_catalog.pg_indexes
    where schemaname = 'public'
      and indexname = 'crew_invitations_inviter_created_at_quota_idx'
  ) then
    raise exception 'One or more supporting public quota indexes are missing.';
  end if;

  if private.bluedeck_storage_object_size_bytes('{"size":0}'::jsonb) <> 0
    or private.bluedeck_storage_object_size_bytes('{"size":"00042"}'::jsonb) <> 42
    or private.bluedeck_storage_object_size_bytes(
      '{"size":9223372036854775807}'::jsonb
    ) <> 9223372036854775807
    or private.bluedeck_storage_object_size_bytes('{"size":-1}'::jsonb) is not null
    or private.bluedeck_storage_object_size_bytes('{"size":1.5}'::jsonb) is not null
    or private.bluedeck_storage_object_size_bytes('{"size":"1e3"}'::jsonb) is not null
    or private.bluedeck_storage_object_size_bytes(
      '{"size":9223372036854775808}'::jsonb
    ) is not null
    or private.bluedeck_storage_object_size_bytes('{}'::jsonb) is not null
  then
    raise exception 'Storage metadata size parsing is not strict and overflow-safe.';
  end if;

  if private.bluedeck_storage_tenant_id(
    '00000000-0000-4000-8000-000000028001/file.jpg'
  ) is distinct from '00000000-0000-4000-8000-000000028001'::uuid
    or private.bluedeck_storage_tenant_id(
      '00000000-0000-4000-8000-000000028001/'
    ) is not null
    or private.bluedeck_storage_tenant_id(
      '00000000-0000-4000-8000-000000028001//file.jpg'
    ) is not null
    or private.bluedeck_storage_tenant_id(
      '00000000-0000-4000-8000-00000002800Z/file.jpg'
    ) is not null
  then
    raise exception 'Storage tenant path parsing is not canonical and strict.';
  end if;
end;
$structure$;

create temporary table quota_test_accounts (
  label text primary key,
  id uuid not null unique
) on commit drop;

insert into quota_test_accounts (label, id)
select label, pg_catalog.gen_random_uuid()
from unnest(array[
  'yacht_total_owner',
  'yacht_transfer_owner',
  'yacht_multi_owner',
  'fixture_owner',
  'job_total_creator',
  'job_daily_creator',
  'job_active_creator',
  'application_job_creator',
  'application_total_user',
  'application_daily_user',
  'application_job_overflow_user',
  'invitation_total_issuer',
  'invitation_pending_issuer',
  'invitation_daily_issuer',
  'storage_crew_user',
  'storage_dashboard_only_user'
]) as account(label);

create temporary table quota_test_job_applicants (
  sequence_number integer primary key,
  id uuid not null unique
) on commit drop;

insert into quota_test_job_applicants (sequence_number, id)
select value, pg_catalog.gen_random_uuid()
from pg_catalog.generate_series(1, 500) as series(value);

create temporary table quota_test_listing_numbers (
  sequence_number integer primary key,
  listing_number text not null unique
) on commit drop;

insert into quota_test_listing_numbers (sequence_number, listing_number)
select
  pg_catalog.row_number() over (order by candidate.value)::integer,
  candidate.value::text
from pg_catalog.generate_series(10000, 99999) as candidate(value)
where not exists (
  select 1
  from public.job_posts as existing_post
  where existing_post.listing_number = candidate.value::text
)
order by candidate.value
limit 900;

do $listing_capacity$
begin
  if (select pg_catalog.count(*) from quota_test_listing_numbers) <> 900 then
    raise exception 'The smoke test could not reserve 900 unused listing numbers.';
  end if;
end;
$listing_capacity$;

create temporary table quota_test_application_jobs (
  sequence_number integer primary key,
  id uuid not null unique
) on commit drop;

insert into quota_test_application_jobs (sequence_number, id)
select value, pg_catalog.gen_random_uuid()
from pg_catalog.generate_series(1, 502) as series(value);

create temporary table quota_test_storage_tenants (
  label text primary key,
  tenant_id uuid not null unique,
  tenant_kind text not null check (tenant_kind in ('crew', 'yacht'))
) on commit drop;

insert into quota_test_storage_tenants (label, tenant_id, tenant_kind)
select label, pg_catalog.gen_random_uuid(), tenant_kind
from (
  values
    ('crew_portfolio_count', 'crew'),
    ('crew_portfolio_bytes', 'crew'),
    ('crew_portfolio_multi', 'crew'),
    ('crew_documents_count', 'crew'),
    ('crew_documents_bytes', 'crew'),
    ('task_photos_count', 'yacht'),
    ('task_photos_bytes', 'yacht'),
    ('documents_count', 'yacht'),
    ('documents_bytes', 'yacht')
) as tenant(label, tenant_kind);

-- Seed exact quota boundaries without invoking user triggers. Constraints and
-- unique indexes remain active; origin mode is restored before every assertion.
set local session_replication_role = replica;

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  account.id,
  'authenticated',
  'authenticated',
  'quota-' || account.label || '-' || account.id::text || '@example.invalid',
  '',
  pg_catalog.statement_timestamp(),
  '{}'::jsonb,
  '{}'::jsonb,
  pg_catalog.statement_timestamp(),
  pg_catalog.statement_timestamp()
from quota_test_accounts as account;

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  applicant.id,
  'authenticated',
  'authenticated',
  'quota-job-applicant-' || applicant.id::text || '@example.invalid',
  '',
  pg_catalog.statement_timestamp(),
  '{}'::jsonb,
  '{}'::jsonb,
  pg_catalog.statement_timestamp(),
  pg_catalog.statement_timestamp()
from quota_test_job_applicants as applicant;

insert into public.crew_profiles (
  id,
  user_id,
  public_crew_id,
  full_name,
  status
)
select
  tenant.tenant_id,
  case
    when tenant.label = 'crew_portfolio_count' then (
      select account.id
      from quota_test_accounts as account
      where account.label = 'storage_crew_user'
    )
    else null
  end,
  'QUOTA-' || pg_catalog.upper(pg_catalog.left(tenant.tenant_id::text, 8)),
  'Quota Storage ' || tenant.label,
  'active'
from quota_test_storage_tenants as tenant
where tenant.tenant_kind = 'crew';

insert into public.yachts (id, name, model, flag, owner_id)
select
  pg_catalog.gen_random_uuid(),
  'Quota Total Yacht ' || series.value,
  'Test',
  'Malta',
  account.id
from quota_test_accounts as account
cross join pg_catalog.generate_series(1, 25) as series(value)
where account.label = 'yacht_total_owner';

insert into public.yachts (id, name, model, flag, owner_id)
select
  pg_catalog.gen_random_uuid(),
  'Quota Transfer Yacht ' || series.value,
  'Test',
  'Malta',
  account.id
from quota_test_accounts as account
cross join pg_catalog.generate_series(1, 24) as series(value)
where account.label = 'yacht_transfer_owner';

insert into public.yachts (id, name, model, flag, owner_id)
select
  tenant.tenant_id,
  'Quota Storage ' || tenant.label,
  'Test',
  'Malta',
  account.id
from quota_test_storage_tenants as tenant
cross join quota_test_accounts as account
where tenant.tenant_kind = 'yacht'
  and account.label = 'fixture_owner';

insert into public.yachts (id, name, model, flag, owner_id)
select
  pg_catalog.gen_random_uuid(),
  'Quota Invitation ' || invitation_fixture.label,
  'Test',
  'Malta',
  account.id
from (
  values ('total'), ('pending'), ('daily')
) as invitation_fixture(label)
cross join quota_test_accounts as account
where account.label = 'fixture_owner';

-- 250 historical posts exercise the retained-record ceiling.
insert into public.job_posts (
  id,
  created_by,
  updated_by,
  position,
  department,
  employment_type,
  status,
  created_at,
  updated_at,
  listing_number
)
select
  pg_catalog.gen_random_uuid(),
  account.id,
  account.id,
  'Captain',
  'Command',
  'permanent',
  'draft',
  pg_catalog.statement_timestamp() - (series.value + 30) * interval '1 day',
  pg_catalog.statement_timestamp(),
  listing.listing_number
from quota_test_accounts as account
cross join pg_catalog.generate_series(1, 250) as series(value)
inner join quota_test_listing_numbers as listing
  on listing.sequence_number = series.value
where account.label = 'job_total_creator';

-- 20 recent posts exercise the rolling creation ceiling.
insert into public.job_posts (
  id,
  created_by,
  updated_by,
  position,
  department,
  employment_type,
  status,
  created_at,
  updated_at,
  listing_number
)
select
  pg_catalog.gen_random_uuid(),
  account.id,
  account.id,
  'Captain',
  'Command',
  'permanent',
  'draft',
  pg_catalog.statement_timestamp() - interval '1 hour',
  pg_catalog.statement_timestamp(),
  listing.listing_number
from quota_test_accounts as account
cross join pg_catalog.generate_series(251, 270) as series(value)
inner join quota_test_listing_numbers as listing
  on listing.sequence_number = series.value
where account.label = 'job_daily_creator';

-- Published is the durable definition of an active marketplace listing.
insert into public.job_posts (
  id,
  created_by,
  updated_by,
  position,
  department,
  employment_type,
  status,
  published_at,
  published_by,
  closes_at,
  created_at,
  updated_at,
  listing_number
)
select
  pg_catalog.gen_random_uuid(),
  account.id,
  account.id,
  'Captain',
  'Command',
  'permanent',
  'published',
  pg_catalog.statement_timestamp() - interval '2 days',
  account.id,
  (
    (
      (pg_catalog.statement_timestamp() - interval '2 days')
      at time zone 'UTC'
    ) + interval '1 month'
  ) at time zone 'UTC',
  pg_catalog.statement_timestamp() - interval '3 days',
  pg_catalog.statement_timestamp(),
  listing.listing_number
from quota_test_accounts as account
cross join pg_catalog.generate_series(271, 320) as series(value)
inner join quota_test_listing_numbers as listing
  on listing.sequence_number = series.value
where account.label = 'job_active_creator';

insert into public.job_posts (
  id,
  created_by,
  updated_by,
  position,
  department,
  employment_type,
  status,
  created_at,
  updated_at,
  listing_number
)
select
  job.id,
  account.id,
  account.id,
  'Deckhand',
  'Deck',
  'permanent',
  'draft',
  pg_catalog.statement_timestamp() - interval '60 days',
  pg_catalog.statement_timestamp(),
  listing.listing_number
from quota_test_application_jobs as job
cross join quota_test_accounts as account
inner join quota_test_listing_numbers as listing
  on listing.sequence_number = 320 + job.sequence_number
where account.label = 'application_job_creator';

-- One applicant across 500 jobs.
insert into public.job_applications (
  job_post_id,
  applicant_user_id,
  applicant_role,
  applicant_name_snapshot,
  applicant_email_snapshot,
  status,
  submitted_at,
  status_changed_at,
  created_at,
  updated_at,
  updated_by
)
select
  job.id,
  account.id,
  'crew',
  'Quota Total Applicant',
  'quota-total-applicant@example.invalid',
  'submitted',
  pg_catalog.statement_timestamp() - interval '60 days',
  pg_catalog.statement_timestamp() - interval '60 days',
  pg_catalog.statement_timestamp() - interval '60 days',
  pg_catalog.statement_timestamp(),
  account.id
from quota_test_application_jobs as job
cross join quota_test_accounts as account
where account.label = 'application_total_user'
  and job.sequence_number <= 500;

-- 500 distinct applicants on one job.
insert into public.job_applications (
  job_post_id,
  applicant_user_id,
  applicant_role,
  applicant_name_snapshot,
  applicant_email_snapshot,
  status,
  submitted_at,
  status_changed_at,
  created_at,
  updated_at,
  updated_by
)
select
  job.id,
  applicant.id,
  'crew',
  'Quota Job Applicant ' || applicant.sequence_number,
  'quota-job-' || applicant.sequence_number || '@example.invalid',
  'submitted',
  pg_catalog.statement_timestamp() - interval '60 days',
  pg_catalog.statement_timestamp() - interval '60 days',
  pg_catalog.statement_timestamp() - interval '60 days',
  pg_catalog.statement_timestamp(),
  applicant.id
from quota_test_application_jobs as job
cross join quota_test_job_applicants as applicant
where job.sequence_number = 501;

-- 20 recent applications for one applicant.
insert into public.job_applications (
  job_post_id,
  applicant_user_id,
  applicant_role,
  applicant_name_snapshot,
  applicant_email_snapshot,
  status,
  submitted_at,
  status_changed_at,
  created_at,
  updated_at,
  updated_by
)
select
  job.id,
  account.id,
  'crew',
  'Quota Daily Applicant',
  'quota-daily-applicant@example.invalid',
  'submitted',
  pg_catalog.statement_timestamp() - interval '1 hour',
  pg_catalog.statement_timestamp() - interval '1 hour',
  pg_catalog.statement_timestamp() - interval '1 hour',
  pg_catalog.statement_timestamp(),
  account.id
from quota_test_application_jobs as job
cross join quota_test_accounts as account
where account.label = 'application_daily_user'
  and job.sequence_number <= 20;

-- Invitation yacht identifiers are resolved by their fixture name below.
insert into public.crew_invitations (
  yacht_id,
  invited_email,
  position,
  department,
  status,
  token,
  created_at,
  invited_by,
  expires_at,
  identity_mode
)
select
  yacht.id,
  'quota-total-' || series.value || '@example.invalid',
  'Deckhand',
  'Deck',
  'expired',
  'quota-total-token-' || series.value,
  pg_catalog.statement_timestamp() - interval '60 days',
  account.id,
  pg_catalog.statement_timestamp() - interval '46 days',
  'email'
from public.yachts as yacht
cross join quota_test_accounts as account
cross join pg_catalog.generate_series(1, 200) as series(value)
where yacht.name = 'Quota Invitation total'
  and account.label = 'invitation_total_issuer';

insert into public.crew_invitations (
  yacht_id,
  invited_email,
  position,
  department,
  status,
  token,
  created_at,
  invited_by,
  expires_at,
  identity_mode
)
select
  yacht.id,
  'quota-pending-' || series.value || '@example.invalid',
  'Deckhand',
  'Deck',
  'pending',
  'quota-pending-token-' || series.value,
  pg_catalog.statement_timestamp() - interval '2 days',
  account.id,
  pg_catalog.statement_timestamp() + interval '12 days',
  'email'
from public.yachts as yacht
cross join quota_test_accounts as account
cross join pg_catalog.generate_series(1, 50) as series(value)
where yacht.name = 'Quota Invitation pending'
  and account.label = 'invitation_pending_issuer';

insert into public.crew_invitations (
  yacht_id,
  invited_email,
  position,
  department,
  status,
  token,
  created_at,
  invited_by,
  expires_at,
  identity_mode
)
select
  yacht.id,
  'quota-daily-' || series.value || '@example.invalid',
  'Deckhand',
  'Deck',
  'expired',
  'quota-daily-token-' || series.value,
  pg_catalog.statement_timestamp() - interval '1 hour',
  account.id,
  pg_catalog.statement_timestamp() - interval '1 minute',
  'email'
from public.yachts as yacht
cross join quota_test_accounts as account
cross join pg_catalog.generate_series(1, 30) as series(value)
where yacht.name = 'Quota Invitation daily'
  and account.label = 'invitation_daily_issuer';

-- Storage object-count boundaries.
insert into storage.objects (bucket_id, name, owner_id, metadata)
select
  'crew-portfolio',
  tenant.tenant_id::text || '/count-' || series.value || '.jpg',
  account.id::text,
  pg_catalog.jsonb_build_object('size', 1, 'mimetype', 'image/jpeg')
from quota_test_storage_tenants as tenant
cross join quota_test_accounts as account
cross join pg_catalog.generate_series(1, 49) as series(value)
where tenant.label = 'crew_portfolio_count'
  and account.label = 'storage_crew_user';

-- Dashboard avatars use auth.uid() as their first segment. They share the same
-- logical 50-object account quota as this user's crew-profile-prefixed media.
insert into storage.objects (bucket_id, name, owner_id, metadata)
select
  'crew-portfolio',
  account.id::text || '/dashboard-boundary.jpg',
  account.id::text,
  pg_catalog.jsonb_build_object('size', 1, 'mimetype', 'image/jpeg')
from quota_test_storage_tenants as tenant
cross join quota_test_accounts as account
where tenant.label = 'crew_portfolio_count'
  and account.label = 'storage_crew_user';

insert into storage.objects (bucket_id, name, owner_id, metadata)
select
  'crew-documents',
  tenant.tenant_id::text || '/count-' || series.value || '.pdf',
  account.id::text,
  pg_catalog.jsonb_build_object('size', 1, 'mimetype', 'application/pdf')
from quota_test_storage_tenants as tenant
cross join quota_test_accounts as account
cross join pg_catalog.generate_series(1, 50) as series(value)
where tenant.label = 'crew_documents_count'
  and account.label = 'storage_crew_user';

insert into storage.objects (bucket_id, name, owner_id, metadata)
select
  'task-photos',
  tenant.tenant_id::text || '/count-' || series.value || '.jpg',
  account.id::text,
  pg_catalog.jsonb_build_object('size', 1, 'mimetype', 'image/jpeg')
from quota_test_storage_tenants as tenant
cross join quota_test_accounts as account
cross join pg_catalog.generate_series(1, 500) as series(value)
where tenant.label = 'task_photos_count'
  and account.label = 'fixture_owner';

insert into storage.objects (bucket_id, name, owner_id, metadata)
select
  case when series.value <= 125 then 'documents' else 'yacht-documents' end,
  tenant.tenant_id::text || '/count-' || series.value || '.pdf',
  account.id::text,
  pg_catalog.jsonb_build_object('size', 1, 'mimetype', 'application/pdf')
from quota_test_storage_tenants as tenant
cross join quota_test_accounts as account
cross join pg_catalog.generate_series(1, 250) as series(value)
where tenant.label = 'documents_count'
  and account.label = 'fixture_owner';

-- Storage byte boundaries.
insert into storage.objects (bucket_id, name, owner_id, metadata)
select
  'crew-portfolio',
  tenant.tenant_id::text || '/bytes.jpg',
  account.id::text,
  pg_catalog.jsonb_build_object(
    'size', 100::bigint * 1024 * 1024,
    'mimetype', 'image/jpeg'
  )
from quota_test_storage_tenants as tenant
cross join quota_test_accounts as account
where tenant.label = 'crew_portfolio_bytes'
  and account.label = 'storage_crew_user';

insert into storage.objects (bucket_id, name, owner_id, metadata)
select
  'crew-documents',
  tenant.tenant_id::text || '/bytes.pdf',
  account.id::text,
  pg_catalog.jsonb_build_object(
    'size', 250::bigint * 1024 * 1024,
    'mimetype', 'application/pdf'
  )
from quota_test_storage_tenants as tenant
cross join quota_test_accounts as account
where tenant.label = 'crew_documents_bytes'
  and account.label = 'storage_crew_user';

insert into storage.objects (bucket_id, name, owner_id, metadata)
select
  'task-photos',
  tenant.tenant_id::text || '/bytes.jpg',
  account.id::text,
  pg_catalog.jsonb_build_object(
    'size', 1::bigint * 1024 * 1024 * 1024,
    'mimetype', 'image/jpeg'
  )
from quota_test_storage_tenants as tenant
cross join quota_test_accounts as account
where tenant.label = 'task_photos_bytes'
  and account.label = 'fixture_owner';

insert into storage.objects (bucket_id, name, owner_id, metadata)
select
  bucket.bucket_id,
  tenant.tenant_id::text || '/' || bucket.bucket_id || '.pdf',
  account.id::text,
  pg_catalog.jsonb_build_object(
    'size', 1::bigint * 1024 * 1024 * 1024,
    'mimetype', 'application/pdf'
  )
from quota_test_storage_tenants as tenant
cross join quota_test_accounts as account
cross join (
  values ('documents'), ('yacht-documents')
) as bucket(bucket_id)
where tenant.label = 'documents_bytes'
  and account.label = 'fixture_owner';

set local session_replication_role = origin;

-- Isolate the public quota triggers from unrelated domain normalization during
-- exact boundary assertions. Trigger state is transaction-local because this
-- whole smoke test rolls back.
alter table public.yachts disable trigger user;
alter table public.yachts enable trigger yachts_zz_bluedeck_resource_quota;
alter table public.job_posts disable trigger user;
alter table public.job_posts enable trigger job_posts_zz_bluedeck_resource_quota;
alter table public.job_applications disable trigger user;
alter table public.job_applications enable trigger job_applications_zz_bluedeck_resource_quota;
alter table public.crew_invitations disable trigger user;
alter table public.crew_invitations enable trigger crew_invitations_zz_bluedeck_resource_quota;

do $public_boundaries$
declare
  rejected boolean;
  captured_message text;
  total_owner uuid;
  transfer_owner uuid;
  multi_owner uuid;
  transfer_yacht uuid;
  total_creator uuid;
  daily_creator uuid;
  active_creator uuid;
  application_total_user uuid;
  application_daily_user uuid;
  application_job_overflow_user uuid;
  application_job_501 uuid;
  application_job_502 uuid;
  total_inviter uuid;
  pending_inviter uuid;
  daily_inviter uuid;
  invitation_total_yacht uuid;
  invitation_pending_yacht uuid;
  invitation_daily_yacht uuid;
begin
  select id into total_owner from quota_test_accounts where label = 'yacht_total_owner';
  select id into transfer_owner from quota_test_accounts where label = 'yacht_transfer_owner';
  select id into multi_owner from quota_test_accounts where label = 'yacht_multi_owner';

  rejected := false;
  begin
    insert into public.yachts (name, model, flag, owner_id)
    values ('Quota Yacht 26', 'Test', 'Malta', total_owner);
  exception
    when program_limit_exceeded then
      get stacked diagnostics captured_message = message_text;
      rejected := captured_message = 'An account can own at most 25 yachts.';
  end;
  if not rejected then
    raise exception 'The 25-yacht owner ceiling was bypassed.';
  end if;

  select yacht.id
  into transfer_yacht
  from public.yachts as yacht
  where yacht.owner_id = total_owner
  order by yacht.id
  limit 1;

  update public.yachts
  set owner_id = owner_id
  where id = transfer_yacht;

  update public.yachts
  set owner_id = transfer_owner
  where id = transfer_yacht;

  if (select count(*) from public.yachts where owner_id = transfer_owner) <> 25 then
    raise exception 'Yacht ownership transfer did not exclude OLD from the destination count.';
  end if;

  rejected := false;
  begin
    insert into public.yachts (name, model, flag, owner_id)
    select 'Quota Multi Yacht ' || series.value, 'Test', 'Malta', multi_owner
    from generate_series(1, 26) as series(value);
  exception
    when program_limit_exceeded then
      get stacked diagnostics captured_message = message_text;
      rejected := captured_message = 'An account can own at most 25 yachts.';
  end;
  if not rejected
    or exists (select 1 from public.yachts where owner_id = multi_owner)
  then
    raise exception 'A single multi-row statement raced past the yacht quota.';
  end if;

  select id into total_creator from quota_test_accounts where label = 'job_total_creator';
  select id into daily_creator from quota_test_accounts where label = 'job_daily_creator';
  select id into active_creator from quota_test_accounts where label = 'job_active_creator';

  rejected := false;
  begin
    insert into public.job_posts (
      created_by, updated_by, position, department, employment_type,
      status, created_at, updated_at, listing_number
    ) values (
      total_creator, total_creator, 'Captain', 'Command', 'permanent',
      'draft', statement_timestamp() - interval '60 days', statement_timestamp(),
      (select listing_number from quota_test_listing_numbers where sequence_number = 823)
    );
  exception
    when program_limit_exceeded then
      get stacked diagnostics captured_message = message_text;
      rejected := captured_message = 'An account can retain at most 250 job posts.';
  end;
  if not rejected then
    raise exception 'The 250-job retained-record ceiling was bypassed.';
  end if;

  rejected := false;
  begin
    insert into public.job_posts (
      created_by, updated_by, position, department, employment_type,
      status, created_at, updated_at, listing_number
    ) values (
      daily_creator, daily_creator, 'Captain', 'Command', 'permanent',
      'draft', statement_timestamp(), statement_timestamp(),
      (select listing_number from quota_test_listing_numbers where sequence_number = 824)
    );
  exception
    when program_limit_exceeded then
      get stacked diagnostics captured_message = message_text;
      rejected := captured_message = 'An account can create at most 20 job posts in 24 hours.';
  end;
  if not rejected then
    raise exception 'The rolling 20-job creation ceiling was bypassed.';
  end if;

  rejected := false;
  begin
    insert into public.job_posts (
      created_by, updated_by, position, department, employment_type,
      status, published_at, published_by, closes_at,
      created_at, updated_at, listing_number
    ) values (
      active_creator, active_creator, 'Captain', 'Command', 'permanent',
      'published', statement_timestamp() - interval '2 days', active_creator,
      (
        (((statement_timestamp() - interval '2 days') at time zone 'UTC')
        + interval '1 month') at time zone 'UTC'
      ),
      statement_timestamp() - interval '3 days', statement_timestamp(),
      (select listing_number from quota_test_listing_numbers where sequence_number = 825)
    );
  exception
    when program_limit_exceeded then
      get stacked diagnostics captured_message = message_text;
      rejected := captured_message = 'An account can publish at most 50 active job posts.';
  end;
  if not rejected then
    raise exception 'The 50-active-job ceiling was bypassed.';
  end if;

  select id into application_total_user
  from quota_test_accounts where label = 'application_total_user';
  select id into application_daily_user
  from quota_test_accounts where label = 'application_daily_user';
  select id into application_job_overflow_user
  from quota_test_accounts where label = 'application_job_overflow_user';
  select id into application_job_501
  from quota_test_application_jobs where sequence_number = 501;
  select id into application_job_502
  from quota_test_application_jobs where sequence_number = 502;

  rejected := false;
  begin
    insert into public.job_applications (
      job_post_id, applicant_user_id, applicant_role,
      applicant_name_snapshot, applicant_email_snapshot,
      submitted_at, status_changed_at, created_at, updated_at, updated_by
    ) values (
      application_job_502, application_total_user, 'crew',
      'Quota Total Applicant', 'quota-total-applicant@example.invalid',
      statement_timestamp() - interval '60 days',
      statement_timestamp() - interval '60 days',
      statement_timestamp() - interval '60 days',
      statement_timestamp(), application_total_user
    );
  exception
    when program_limit_exceeded then
      get stacked diagnostics captured_message = message_text;
      rejected := captured_message = 'An account can retain at most 500 job applications.';
  end;
  if not rejected then
    raise exception 'The 500-application applicant ceiling was bypassed.';
  end if;

  rejected := false;
  begin
    insert into public.job_applications (
      job_post_id, applicant_user_id, applicant_role,
      applicant_name_snapshot, applicant_email_snapshot,
      submitted_at, status_changed_at, created_at, updated_at, updated_by
    ) values (
      application_job_502, application_daily_user, 'crew',
      'Quota Daily Applicant', 'quota-daily-applicant@example.invalid',
      statement_timestamp(), statement_timestamp(), statement_timestamp(),
      statement_timestamp(), application_daily_user
    );
  exception
    when program_limit_exceeded then
      get stacked diagnostics captured_message = message_text;
      rejected := captured_message = 'An account can submit at most 20 job applications in 24 hours.';
  end;
  if not rejected then
    raise exception 'The rolling 20-application ceiling was bypassed.';
  end if;

  rejected := false;
  begin
    insert into public.job_applications (
      job_post_id, applicant_user_id, applicant_role,
      applicant_name_snapshot, applicant_email_snapshot,
      submitted_at, status_changed_at, created_at, updated_at, updated_by
    ) values (
      application_job_501, application_job_overflow_user, 'crew',
      'Quota Job Overflow', 'quota-job-overflow@example.invalid',
      statement_timestamp() - interval '60 days',
      statement_timestamp() - interval '60 days',
      statement_timestamp() - interval '60 days',
      statement_timestamp(), application_job_overflow_user
    );
  exception
    when program_limit_exceeded then
      get stacked diagnostics captured_message = message_text;
      rejected := captured_message = 'A job post can retain at most 500 applications.';
  end;
  if not rejected then
    raise exception 'The 500-applications-per-job ceiling was bypassed.';
  end if;

  select id into total_inviter
  from quota_test_accounts where label = 'invitation_total_issuer';
  select id into pending_inviter
  from quota_test_accounts where label = 'invitation_pending_issuer';
  select id into daily_inviter
  from quota_test_accounts where label = 'invitation_daily_issuer';
  select id into invitation_total_yacht
  from public.yachts where name = 'Quota Invitation total';
  select id into invitation_pending_yacht
  from public.yachts where name = 'Quota Invitation pending';
  select id into invitation_daily_yacht
  from public.yachts where name = 'Quota Invitation daily';

  rejected := false;
  begin
    insert into public.crew_invitations (
      yacht_id, invited_email, position, department, status, token,
      created_at, invited_by, expires_at, identity_mode
    ) values (
      invitation_total_yacht, 'quota-total-overflow@example.invalid',
      'Deckhand', 'Deck', 'expired', 'quota-total-overflow-token',
      statement_timestamp() - interval '60 days', total_inviter,
      statement_timestamp() - interval '46 days', 'email'
    );
  exception
    when program_limit_exceeded then
      get stacked diagnostics captured_message = message_text;
      rejected := captured_message = 'A yacht can retain at most 200 crew invitations.';
  end;
  if not rejected then
    raise exception 'The 200-invitation yacht ceiling was bypassed.';
  end if;

  rejected := false;
  begin
    insert into public.crew_invitations (
      yacht_id, invited_email, position, department, status, token,
      created_at, invited_by, expires_at, identity_mode
    ) values (
      invitation_pending_yacht, 'quota-pending-overflow@example.invalid',
      'Deckhand', 'Deck', 'pending', 'quota-pending-overflow-token',
      statement_timestamp() - interval '2 days', pending_inviter,
      statement_timestamp() + interval '12 days', 'email'
    );
  exception
    when program_limit_exceeded then
      get stacked diagnostics captured_message = message_text;
      rejected := captured_message = 'A yacht can have at most 50 pending crew invitations.';
  end;
  if not rejected then
    raise exception 'The 50-pending-invitation ceiling was bypassed.';
  end if;

  rejected := false;
  begin
    insert into public.crew_invitations (
      yacht_id, invited_email, position, department, status, token,
      created_at, invited_by, expires_at, identity_mode
    ) values (
      invitation_daily_yacht, 'quota-daily-overflow@example.invalid',
      'Deckhand', 'Deck', 'expired', 'quota-daily-overflow-token',
      statement_timestamp(), daily_inviter,
      statement_timestamp(), 'email'
    );
  exception
    when program_limit_exceeded then
      get stacked diagnostics captured_message = message_text;
      rejected := captured_message = 'An account can issue at most 30 crew invitations in 24 hours.';
  end;
  if not rejected then
    raise exception 'The rolling 30-invitation issuer ceiling was bypassed.';
  end if;
end;
$public_boundaries$;

alter table public.yachts enable trigger user;
alter table public.job_posts enable trigger user;
alter table public.job_applications enable trigger user;
alter table public.crew_invitations enable trigger user;

do $storage_boundaries$
declare
  tenant uuid;
  owner_id uuid;
  dashboard_only_id uuid;
  missing_tenant uuid;
  rejected boolean;
  captured_message text;
begin
  select id into owner_id
  from quota_test_accounts where label = 'storage_crew_user';

  select id into dashboard_only_id
  from quota_test_accounts where label = 'storage_dashboard_only_user';

  -- The dashboard namespace is valid before career/profile provisioning.
  insert into storage.objects (bucket_id, name, owner_id, metadata)
  values (
    'crew-portfolio', dashboard_only_id::text || '/dashboard-smoke.jpg',
    dashboard_only_id::text,
    jsonb_build_object('size', 1, 'mimetype', 'image/jpeg')
  );

  select tenant_id into tenant
  from quota_test_storage_tenants where label = 'crew_portfolio_count';
  rejected := false;
  begin
    insert into storage.objects (bucket_id, name, owner_id, metadata)
    values (
      'crew-portfolio', owner_id::text || '/dashboard-overflow.jpg',
      owner_id::text,
      jsonb_build_object('size', 1, 'mimetype', 'image/jpeg')
    );
  exception
    when program_limit_exceeded then
      get stacked diagnostics captured_message = message_text;
      rejected := captured_message =
        'The crew-portfolio storage object limit has been reached.';
  end;
  if not rejected then
    raise exception 'The crew-portfolio 50-object ceiling was bypassed.';
  end if;

  -- An upsert replacement at the object ceiling must exclude the existing row
  -- in both its BEFORE INSERT and BEFORE UPDATE trigger paths.
  insert into storage.objects (bucket_id, name, owner_id, metadata)
  values (
    'crew-portfolio', tenant::text || '/count-1.jpg', owner_id::text,
    jsonb_build_object('size', 1, 'mimetype', 'image/jpeg')
  )
  on conflict (bucket_id, name) do update
    set metadata = excluded.metadata;

  insert into storage.objects (bucket_id, name, owner_id, metadata)
  values (
    'crew-portfolio', owner_id::text || '/dashboard-boundary.jpg',
    owner_id::text,
    jsonb_build_object('size', 1, 'mimetype', 'image/jpeg')
  )
  on conflict (bucket_id, name) do update
    set metadata = excluded.metadata;

  -- Moving a profile-prefixed object to the dashboard namespace must keep the
  -- shared account at 50 by excluding OLD from both prefix ranges.
  update storage.objects as object
  set name = object.owner_id || '/dashboard-moved.jpg'
  where object.bucket_id = 'crew-portfolio'
    and object.name = tenant::text || '/count-2.jpg';

  select tenant_id into tenant
  from quota_test_storage_tenants where label = 'crew_portfolio_bytes';
  rejected := false;
  begin
    insert into storage.objects (bucket_id, name, owner_id, metadata)
    values (
      'crew-portfolio', tenant::text || '/overflow.jpg', owner_id::text,
      jsonb_build_object('size', 1, 'mimetype', 'image/jpeg')
    );
  exception
    when program_limit_exceeded then
      get stacked diagnostics captured_message = message_text;
      rejected := captured_message =
        'The crew-portfolio storage byte limit has been reached.';
  end;
  if not rejected then
    raise exception 'The crew-portfolio 100 MiB ceiling was bypassed.';
  end if;

  select tenant_id into tenant
  from quota_test_storage_tenants where label = 'crew_portfolio_multi';
  rejected := false;
  begin
    insert into storage.objects (bucket_id, name, owner_id, metadata)
    select
      'crew-portfolio',
      tenant::text || '/multi-' || series.value || '.jpg',
      owner_id::text,
      jsonb_build_object('size', 1, 'mimetype', 'image/jpeg')
    from generate_series(1, 51) as series(value);
  exception
    when program_limit_exceeded then
      get stacked diagnostics captured_message = message_text;
      rejected := captured_message =
        'The crew-portfolio storage object limit has been reached.';
  end;
  if not rejected
    or exists (
      select 1
      from storage.objects as object
      where object.bucket_id = 'crew-portfolio'
        and object.name >= tenant::text || '/'
        and object.name < tenant::text || '0'
    )
  then
    raise exception 'A single multi-row statement raced past the Storage object quota.';
  end if;

  select tenant_id into tenant
  from quota_test_storage_tenants where label = 'crew_documents_count';
  rejected := false;
  begin
    insert into storage.objects (bucket_id, name, owner_id, metadata)
    values (
      'crew-documents', tenant::text || '/overflow.pdf', owner_id::text,
      jsonb_build_object('size', 1, 'mimetype', 'application/pdf')
    );
  exception
    when program_limit_exceeded then
      get stacked diagnostics captured_message = message_text;
      rejected := captured_message =
        'The crew-documents storage object limit has been reached.';
  end;
  if not rejected then
    raise exception 'The crew-documents 50-object ceiling was bypassed.';
  end if;

  select tenant_id into tenant
  from quota_test_storage_tenants where label = 'crew_documents_bytes';
  update storage.objects
  set metadata = jsonb_build_object(
    'size', 250::bigint * 1024 * 1024,
    'mimetype', 'application/pdf'
  )
  where bucket_id = 'crew-documents'
    and name = tenant::text || '/bytes.pdf';

  rejected := false;
  begin
    update storage.objects
    set metadata = jsonb_build_object(
      'size', 250::bigint * 1024 * 1024 + 1,
      'mimetype', 'application/pdf'
    )
    where bucket_id = 'crew-documents'
      and name = tenant::text || '/bytes.pdf';
  exception
    when program_limit_exceeded then
      get stacked diagnostics captured_message = message_text;
      rejected := captured_message =
        'The crew-documents storage byte limit has been reached.';
  end;
  if not rejected then
    raise exception 'The crew-documents 250 MiB ceiling or UPDATE OLD exclusion failed.';
  end if;

  select tenant_id into tenant
  from quota_test_storage_tenants where label = 'task_photos_count';
  rejected := false;
  begin
    insert into storage.objects (bucket_id, name, owner_id, metadata)
    values (
      'task-photos', tenant::text || '/overflow.jpg', owner_id::text,
      jsonb_build_object('size', 1, 'mimetype', 'image/jpeg')
    );
  exception
    when program_limit_exceeded then
      get stacked diagnostics captured_message = message_text;
      rejected := captured_message =
        'The task-photos storage object limit has been reached.';
  end;
  if not rejected then
    raise exception 'The task-photos 500-object ceiling was bypassed.';
  end if;

  select tenant_id into tenant
  from quota_test_storage_tenants where label = 'task_photos_bytes';
  rejected := false;
  begin
    insert into storage.objects (bucket_id, name, owner_id, metadata)
    values (
      'task-photos', tenant::text || '/overflow.jpg', owner_id::text,
      jsonb_build_object('size', 1, 'mimetype', 'image/jpeg')
    );
  exception
    when program_limit_exceeded then
      get stacked diagnostics captured_message = message_text;
      rejected := captured_message =
        'The task-photos storage byte limit has been reached.';
  end;
  if not rejected then
    raise exception 'The task-photos 1 GiB ceiling was bypassed.';
  end if;

  select tenant_id into tenant
  from quota_test_storage_tenants where label = 'documents_count';
  rejected := false;
  begin
    insert into storage.objects (bucket_id, name, owner_id, metadata)
    values (
      'documents', tenant::text || '/overflow.pdf', owner_id::text,
      jsonb_build_object('size', 1, 'mimetype', 'application/pdf')
    );
  exception
    when program_limit_exceeded then
      get stacked diagnostics captured_message = message_text;
      rejected := captured_message =
        'The yacht-documents-combined storage object limit has been reached.';
  end;
  if not rejected then
    raise exception 'The combined document-bucket 250-object ceiling was bypassed.';
  end if;

  -- Moving an existing object between the combined buckets must remain at 250,
  -- not momentarily count the OLD object as a 251st destination object.
  update storage.objects
  set bucket_id = 'yacht-documents'
  where bucket_id = 'documents'
    and name = tenant::text || '/count-1.pdf';

  select tenant_id into tenant
  from quota_test_storage_tenants where label = 'documents_bytes';
  rejected := false;
  begin
    insert into storage.objects (bucket_id, name, owner_id, metadata)
    values (
      'documents', tenant::text || '/overflow.pdf', owner_id::text,
      jsonb_build_object('size', 1, 'mimetype', 'application/pdf')
    );
  exception
    when program_limit_exceeded then
      get stacked diagnostics captured_message = message_text;
      rejected := captured_message =
        'The yacht-documents-combined storage byte limit has been reached.';
  end;
  if not rejected then
    raise exception 'The combined document-bucket 2 GiB ceiling was bypassed.';
  end if;

  rejected := false;
  begin
    insert into storage.objects (bucket_id, name, owner_id, metadata)
    values (
      'crew-portfolio', 'not-a-uuid/file.jpg', owner_id::text,
      jsonb_build_object('size', 1, 'mimetype', 'image/jpeg')
    );
  exception
    when check_violation then
      get stacked diagnostics captured_message = message_text;
      rejected := captured_message =
        'Quota-controlled storage paths require a canonical UUID tenant folder.';
  end;
  if not rejected then
    raise exception 'An invalid quota-controlled Storage tenant path was accepted.';
  end if;

  loop
    missing_tenant := pg_catalog.gen_random_uuid();
    exit when not exists (
      select 1 from auth.users as account where account.id = missing_tenant
    ) and not exists (
      select 1
      from public.crew_profiles as profile
      where profile.id = missing_tenant
    ) and not exists (
      select 1 from public.yachts as yacht where yacht.id = missing_tenant
    );
  end loop;

  rejected := false;
  begin
    insert into storage.objects (bucket_id, name, owner_id, metadata)
    values (
      'crew-portfolio', missing_tenant::text || '/missing.jpg', owner_id::text,
      jsonb_build_object('size', 1, 'mimetype', 'image/jpeg')
    );
  exception
    when foreign_key_violation then
      get stacked diagnostics captured_message = message_text;
      rejected := captured_message =
        'Storage crew account or profile tenant does not exist.';
  end;
  if not rejected then
    raise exception 'A missing crew Storage tenant was accepted.';
  end if;

  rejected := false;
  begin
    insert into storage.objects (bucket_id, name, owner_id, metadata)
    values (
      'task-photos', missing_tenant::text || '/missing.jpg', owner_id::text,
      jsonb_build_object('size', 1, 'mimetype', 'image/jpeg')
    );
  exception
    when foreign_key_violation then
      get stacked diagnostics captured_message = message_text;
      rejected := captured_message = 'Storage yacht tenant does not exist.';
  end;
  if not rejected then
    raise exception 'A missing yacht Storage tenant was accepted.';
  end if;

  select tenant_id into tenant
  from quota_test_storage_tenants where label = 'crew_portfolio_bytes';
  rejected := false;
  begin
    insert into storage.objects (bucket_id, name, owner_id, metadata)
    values (
      'crew-portfolio', tenant::text || '/invalid-size.jpg', owner_id::text,
      jsonb_build_object('size', 'NaN', 'mimetype', 'image/jpeg')
    );
  exception
    when check_violation then
      get stacked diagnostics captured_message = message_text;
      rejected := captured_message =
        'Storage object metadata requires a non-negative integer size.';
  end;
  if not rejected then
    raise exception 'Invalid Storage size metadata was accepted.';
  end if;
end;
$storage_boundaries$;

-- Prove that service_role's RLS bypass cannot bypass the database trigger.
grant select on table quota_test_storage_tenants, quota_test_accounts
  to service_role;
set local role service_role;

do $service_role_boundary$
declare
  tenant uuid;
  owner_id uuid;
  rejected boolean := false;
  captured_message text;
begin
  select tenant_id into tenant
  from quota_test_storage_tenants
  where label = 'crew_portfolio_count';
  select id into owner_id
  from quota_test_accounts
  where label = 'storage_crew_user';

  begin
    insert into storage.objects (bucket_id, name, owner_id, metadata)
    values (
      'crew-portfolio', tenant::text || '/service-role-overflow.jpg',
      owner_id::text,
      jsonb_build_object('size', 1, 'mimetype', 'image/jpeg')
    );
  exception
    when program_limit_exceeded then
      get stacked diagnostics captured_message = message_text;
      rejected := captured_message =
        'The crew-portfolio storage object limit has been reached.';
  end;

  if not rejected then
    raise exception 'service_role bypassed the Storage quota trigger.';
  end if;
end;
$service_role_boundary$;

reset role;

rollback;
