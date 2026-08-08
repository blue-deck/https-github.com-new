-- Enforce durable, race-safe resource ceilings below every application and
-- service-role code path. Quota checks run in BEFORE triggers, serialize on a
-- private per-resource mutex, and deliberately do not rewrite existing rows.

begin;

create schema if not exists private;

-- Repair live drift: crew_profiles already uses this trigger function, but the
-- historical function had an ambient search_path and was callable by API roles.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
begin
  new.updated_at := pg_catalog.statement_timestamp();
  return new;
end;
$function$;

revoke all on function public.touch_updated_at()
  from public, anon, authenticated, service_role;

comment on function public.touch_updated_at() is
  'Trigger-only updated_at helper with a fixed search path and no direct API-role execution.';

-- Advisory locks close the ordinary check-then-insert race. A durable mutex
-- row additionally gives every successor a row-lock visibility point after it
-- waits, without upgrading domain rows that other workflows already hold FOR
-- SHARE (notably atomic crew invitation issuance).
create table if not exists private.bluedeck_resource_quota_locks (
  quota_scope text not null,
  resource_key text not null,
  created_at timestamptz not null default pg_catalog.statement_timestamp(),
  primary key (quota_scope, resource_key),
  constraint bluedeck_resource_quota_locks_scope_check check (
    pg_catalog.octet_length(quota_scope) between 1 and 80
  ),
  constraint bluedeck_resource_quota_locks_key_check check (
    pg_catalog.octet_length(resource_key) between 1 and 160
  )
);

alter table private.bluedeck_resource_quota_locks
  enable row level security;

revoke all on table private.bluedeck_resource_quota_locks
  from public, anon, authenticated, service_role;

create or replace function private.bluedeck_lock_resource_quota(
  p_quota_scope text,
  p_resource_key text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  normalized_scope text := pg_catalog.btrim(coalesce(p_quota_scope, ''));
  normalized_key text := pg_catalog.btrim(coalesce(p_resource_key, ''));
begin
  if pg_catalog.octet_length(normalized_scope) not between 1 and 80
    or pg_catalog.octet_length(normalized_key) not between 1 and 160
  then
    raise exception using
      errcode = '22023',
      message = 'Invalid quota lock resource.';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(
      'bluedeck:resource-quota:' || normalized_scope || ':' || normalized_key,
      0
    )
  );

  insert into private.bluedeck_resource_quota_locks (
    quota_scope,
    resource_key
  ) values (
    normalized_scope,
    normalized_key
  )
  on conflict (quota_scope, resource_key) do nothing;

  perform quota_lock.quota_scope
  from private.bluedeck_resource_quota_locks as quota_lock
  where quota_lock.quota_scope = normalized_scope
    and quota_lock.resource_key = normalized_key
  for update;

  if not found then
    raise exception using
      errcode = 'XX000',
      message = 'Quota lock could not be acquired.';
  end if;
end;
$function$;

revoke all on function private.bluedeck_lock_resource_quota(text, text)
  from public, anon, authenticated, service_role;

comment on function private.bluedeck_lock_resource_quota(text, text) is
  'Serializes a quota scope/key with both a transaction advisory lock and a durable private row mutex.';

create index if not exists yachts_owner_id_quota_idx
  on public.yachts (owner_id)
  where owner_id is not null;

create index if not exists job_posts_creator_created_at_quota_idx
  on public.job_posts (created_by, created_at desc);

create index if not exists job_posts_creator_published_quota_idx
  on public.job_posts (created_by)
  where status = 'published';

create index if not exists job_applications_applicant_created_at_quota_idx
  on public.job_applications (applicant_user_id, created_at desc);

create index if not exists crew_invitations_yacht_quota_idx
  on public.crew_invitations (yacht_id);

create index if not exists crew_invitations_yacht_pending_quota_idx
  on public.crew_invitations (yacht_id)
  where status = 'pending';

create index if not exists crew_invitations_inviter_created_at_quota_idx
  on public.crew_invitations (invited_by, created_at desc)
  where invited_by is not null;

create or replace function private.bluedeck_guard_yacht_resource_quota()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  excluded_id uuid := case when tg_op = 'UPDATE' then old.id else null end;
  yacht_count bigint;
begin
  if new.owner_id is null
    or (
      tg_op = 'UPDATE'
      and new.owner_id is not distinct from old.owner_id
    )
  then
    return new;
  end if;

  perform private.bluedeck_lock_resource_quota(
    'yachts:owner',
    new.owner_id::text
  );

  if not exists (
    select 1
    from auth.users as account
    where account.id = new.owner_id
  ) then
    raise exception using
      errcode = '23503',
      message = 'Yacht owner account does not exist.';
  end if;

  select pg_catalog.count(*)
  into yacht_count
  from public.yachts as yacht
  where yacht.owner_id = new.owner_id
    and (excluded_id is null or yacht.id <> excluded_id);

  if yacht_count >= 25 then
    raise exception using
      errcode = '54000',
      message = 'An account can own at most 25 yachts.',
      hint = 'Remove an existing yacht before creating or transferring another one.';
  end if;

  return new;
end;
$function$;

create or replace function private.bluedeck_guard_job_post_resource_quota()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  excluded_id uuid := case when tg_op = 'UPDATE' then old.id else null end;
  quota_time timestamptz := pg_catalog.statement_timestamp();
  creator_changed boolean := (
    tg_op = 'INSERT'
    or new.created_by is distinct from old.created_by
  );
  enters_published boolean := (
    new.status = 'published'
    and (
      tg_op = 'INSERT'
      or old.status is distinct from 'published'
      or new.created_by is distinct from old.created_by
    )
  );
  created_at_enters_window boolean := (
    new.created_at >= quota_time - interval '24 hours'
    and (
      creator_changed
      or (
        tg_op = 'UPDATE'
        and new.created_at is distinct from old.created_at
        and old.created_at < quota_time - interval '24 hours'
      )
    )
  );
  current_count bigint;
begin
  if not creator_changed
    and not enters_published
    and not created_at_enters_window
  then
    return new;
  end if;

  if new.created_by is null then
    raise exception using
      errcode = '23514',
      message = 'A job post creator is required.';
  end if;

  perform private.bluedeck_lock_resource_quota(
    'job-posts:creator',
    new.created_by::text
  );

  if not exists (
    select 1
    from auth.users as account
    where account.id = new.created_by
  ) then
    raise exception using
      errcode = '23503',
      message = 'Job post creator account does not exist.';
  end if;

  if creator_changed then
    select pg_catalog.count(*)
    into current_count
    from public.job_posts as post
    where post.created_by = new.created_by
      and (excluded_id is null or post.id <> excluded_id);

    if current_count >= 250 then
      raise exception using
        errcode = '54000',
        message = 'An account can retain at most 250 job posts.',
        hint = 'Archive or delete an existing job record before creating another one.';
    end if;
  end if;

  if created_at_enters_window then
    select pg_catalog.count(*)
    into current_count
    from public.job_posts as post
    where post.created_by = new.created_by
      and post.created_at >= quota_time - interval '24 hours'
      and (excluded_id is null or post.id <> excluded_id);

    if current_count >= 20 then
      raise exception using
        errcode = '54000',
        message = 'An account can create at most 20 job posts in 24 hours.',
        hint = 'Wait until the rolling 24-hour window has capacity.';
    end if;
  end if;

  if enters_published then
    select pg_catalog.count(*)
    into current_count
    from public.job_posts as post
    where post.created_by = new.created_by
      and post.status = 'published'
      and (excluded_id is null or post.id <> excluded_id);

    if current_count >= 50 then
      raise exception using
        errcode = '54000',
        message = 'An account can publish at most 50 active job posts.',
        hint = 'Close an active listing before publishing another one.';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function private.bluedeck_guard_job_application_resource_quota()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  excluded_id uuid := case when tg_op = 'UPDATE' then old.id else null end;
  quota_time timestamptz := pg_catalog.statement_timestamp();
  applicant_changed boolean := (
    tg_op = 'INSERT'
    or new.applicant_user_id is distinct from old.applicant_user_id
  );
  job_changed boolean := (
    tg_op = 'INSERT'
    or new.job_post_id is distinct from old.job_post_id
  );
  created_at_enters_window boolean := (
    new.created_at >= quota_time - interval '24 hours'
    and (
      applicant_changed
      or (
        tg_op = 'UPDATE'
        and new.created_at is distinct from old.created_at
        and old.created_at < quota_time - interval '24 hours'
      )
    )
  );
  current_count bigint;
begin
  if not applicant_changed
    and not job_changed
    and not created_at_enters_window
  then
    return new;
  end if;

  if new.applicant_user_id is null or new.job_post_id is null then
    raise exception using
      errcode = '23514',
      message = 'Application applicant and job are required.';
  end if;

  if applicant_changed or created_at_enters_window then
    perform private.bluedeck_lock_resource_quota(
      'job-applications:applicant',
      new.applicant_user_id::text
    );
  end if;

  if job_changed then
    perform private.bluedeck_lock_resource_quota(
      'job-applications:job',
      new.job_post_id::text
    );
  end if;

  if not exists (
    select 1
    from auth.users as account
    where account.id = new.applicant_user_id
  ) then
    raise exception using
      errcode = '23503',
      message = 'Application account does not exist.';
  end if;

  if not exists (
    select 1
    from public.job_posts as post
    where post.id = new.job_post_id
  ) then
    raise exception using
      errcode = '23503',
      message = 'Application job post does not exist.';
  end if;

  if applicant_changed then
    select pg_catalog.count(*)
    into current_count
    from public.job_applications as application
    where application.applicant_user_id = new.applicant_user_id
      and (excluded_id is null or application.id <> excluded_id);

    if current_count >= 500 then
      raise exception using
        errcode = '54000',
        message = 'An account can retain at most 500 job applications.',
        hint = 'Withdrawn and historical application retention must be resolved before applying again.';
    end if;
  end if;

  if created_at_enters_window then
    select pg_catalog.count(*)
    into current_count
    from public.job_applications as application
    where application.applicant_user_id = new.applicant_user_id
      and application.created_at >= quota_time - interval '24 hours'
      and (excluded_id is null or application.id <> excluded_id);

    if current_count >= 20 then
      raise exception using
        errcode = '54000',
        message = 'An account can submit at most 20 job applications in 24 hours.',
        hint = 'Wait until the rolling 24-hour window has capacity.';
    end if;
  end if;

  if job_changed then
    select pg_catalog.count(*)
    into current_count
    from public.job_applications as application
    where application.job_post_id = new.job_post_id
      and (excluded_id is null or application.id <> excluded_id);

    if current_count >= 500 then
      raise exception using
        errcode = '54000',
        message = 'A job post can retain at most 500 applications.',
        hint = 'Close the listing or contact BlueDeck support before accepting more applications.';
    end if;
  end if;

  return new;
end;
$function$;

create or replace function private.bluedeck_guard_crew_invitation_resource_quota()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  excluded_id uuid := case when tg_op = 'UPDATE' then old.id else null end;
  quota_time timestamptz := pg_catalog.statement_timestamp();
  yacht_changed boolean := (
    tg_op = 'INSERT'
    or new.yacht_id is distinct from old.yacht_id
  );
  enters_pending boolean := (
    new.status = 'pending'
    and (
      tg_op = 'INSERT'
      or old.status is distinct from 'pending'
      or new.yacht_id is distinct from old.yacht_id
    )
  );
  inviter_changed boolean := (
    tg_op = 'INSERT'
    or new.invited_by is distinct from old.invited_by
  );
  created_at_enters_window boolean := (
    new.invited_by is not null
    and new.created_at >= quota_time - interval '24 hours'
    and (
      inviter_changed
      or (
        tg_op = 'UPDATE'
        and new.created_at is distinct from old.created_at
        and old.created_at < quota_time - interval '24 hours'
      )
    )
  );
  current_count bigint;
begin
  if not yacht_changed
    and not enters_pending
    and not created_at_enters_window
  then
    return new;
  end if;

  if new.yacht_id is null then
    raise exception using
      errcode = '23514',
      message = 'An invitation yacht is required.';
  end if;

  if yacht_changed or enters_pending then
    perform private.bluedeck_lock_resource_quota(
      'crew-invitations:yacht',
      new.yacht_id::text
    );
  end if;

  if created_at_enters_window then
    perform private.bluedeck_lock_resource_quota(
      'crew-invitations:inviter',
      new.invited_by::text
    );
  end if;

  if not exists (
    select 1
    from public.yachts as yacht
    where yacht.id = new.yacht_id
  ) then
    raise exception using
      errcode = '23503',
      message = 'Invitation yacht does not exist.';
  end if;

  if created_at_enters_window
    and not exists (
      select 1
      from auth.users as account
      where account.id = new.invited_by
    )
  then
    raise exception using
      errcode = '23503',
      message = 'Invitation issuer account does not exist.';
  end if;

  if yacht_changed then
    select pg_catalog.count(*)
    into current_count
    from public.crew_invitations as invitation
    where invitation.yacht_id = new.yacht_id
      and (excluded_id is null or invitation.id <> excluded_id);

    if current_count >= 200 then
      raise exception using
        errcode = '54000',
        message = 'A yacht can retain at most 200 crew invitations.',
        hint = 'Historical invitation retention must be resolved before inviting again.';
    end if;
  end if;

  if enters_pending then
    select pg_catalog.count(*)
    into current_count
    from public.crew_invitations as invitation
    where invitation.yacht_id = new.yacht_id
      and invitation.status = 'pending'
      and (excluded_id is null or invitation.id <> excluded_id);

    if current_count >= 50 then
      raise exception using
        errcode = '54000',
        message = 'A yacht can have at most 50 pending crew invitations.',
        hint = 'Revoke or resolve a pending invitation before creating another one.';
    end if;
  end if;

  if created_at_enters_window then
    select pg_catalog.count(*)
    into current_count
    from public.crew_invitations as invitation
    where invitation.invited_by = new.invited_by
      and invitation.created_at >= quota_time - interval '24 hours'
      and (excluded_id is null or invitation.id <> excluded_id);

    if current_count >= 30 then
      raise exception using
        errcode = '54000',
        message = 'An account can issue at most 30 crew invitations in 24 hours.',
        hint = 'Wait until the rolling 24-hour window has capacity.';
    end if;
  end if;

  return new;
end;
$function$;

-- Storage metadata is supplied by the Storage service. Parse it without an
-- exception-prone direct bigint cast: only canonical, non-negative integers in
-- bigint range are counted. Invalid metadata is rejected on the next write for
-- that tenant rather than silently counting as zero.
create or replace function private.bluedeck_storage_object_size_bytes(
  p_metadata jsonb
)
returns bigint
language plpgsql
immutable
set search_path = pg_catalog
as $function$
declare
  raw_size text;
  normalized_size text;
begin
  if p_metadata is null
    or pg_catalog.jsonb_typeof(p_metadata) <> 'object'
    or not (p_metadata ? 'size')
    or pg_catalog.jsonb_typeof(p_metadata -> 'size') not in ('number', 'string')
  then
    return null;
  end if;

  raw_size := p_metadata ->> 'size';
  if raw_size is null or raw_size !~ '^[0-9]+$' then
    return null;
  end if;

  normalized_size := pg_catalog.ltrim(raw_size, '0');
  if normalized_size = '' then
    return 0;
  end if;

  if pg_catalog.length(normalized_size) > 19
    or (
      pg_catalog.length(normalized_size) = 19
      and normalized_size::numeric > 9223372036854775807::numeric
    )
  then
    return null;
  end if;

  return normalized_size::bigint;
end;
$function$;

create or replace function private.bluedeck_storage_tenant_id(
  p_object_name text
)
returns uuid
language plpgsql
immutable
set search_path = pg_catalog
as $function$
declare
  tenant_segment text;
begin
  if p_object_name is null
    or p_object_name !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[^/].*$'
  then
    return null;
  end if;

  tenant_segment := pg_catalog.split_part(p_object_name, '/', 1);
  begin
    return tenant_segment::uuid;
  exception
    when invalid_text_representation then
      return null;
  end;
end;
$function$;

-- crew-portfolio supports both historical crew-profile prefixes and the
-- dashboard's auth-user prefix. Resolve both forms to one logical account and
-- return every prefix that must share that account's quota. Other buckets keep
-- their established first-segment tenant boundary.
create or replace function private.bluedeck_storage_quota_context(
  p_bucket_id text,
  p_object_name text
)
returns table (
  resolved_quota_scope text,
  resolved_tenant_key text,
  primary_tenant_prefix text,
  secondary_tenant_prefix text
)
language plpgsql
stable
set search_path = pg_catalog
as $function$
declare
  path_tenant_id uuid;
  matching_profile_id uuid;
  matching_profile_user_id uuid;
  linked_profile_id uuid;
  tenant_is_account boolean;
begin
  case p_bucket_id
    when 'crew-portfolio' then
      resolved_quota_scope := 'crew-portfolio';
    when 'crew-documents' then
      resolved_quota_scope := 'crew-documents';
    when 'task-photos' then
      resolved_quota_scope := 'task-photos';
    when 'documents' then
      resolved_quota_scope := 'yacht-documents-combined';
    when 'yacht-documents' then
      resolved_quota_scope := 'yacht-documents-combined';
    else
      return;
  end case;

  path_tenant_id := private.bluedeck_storage_tenant_id(p_object_name);
  if path_tenant_id is null then
    raise exception using
      errcode = '23514',
      message = 'Quota-controlled storage paths require a canonical UUID tenant folder.';
  end if;

  if resolved_quota_scope in ('crew-portfolio', 'crew-documents') then
    select profile.id, profile.user_id
    into matching_profile_id, matching_profile_user_id
    from public.crew_profiles as profile
    where profile.id = path_tenant_id;
  end if;

  if resolved_quota_scope = 'crew-portfolio' then
    tenant_is_account := exists (
      select 1
      from auth.users as account
      where account.id = path_tenant_id
    );

    -- A UUID that identifies somebody else's linked profile and an auth user
    -- at once would make the Storage policy namespace ambiguous. Refuse new
    -- writes instead of charging either account incorrectly.
    if matching_profile_id is not null
      and matching_profile_user_id is not null
      and tenant_is_account
      and matching_profile_user_id <> path_tenant_id
    then
      raise exception using
        errcode = '23514',
        message = 'The crew portfolio tenant folder is ambiguous.';
    end if;

    if matching_profile_id is not null
      and matching_profile_user_id is not null
    then
      resolved_tenant_key := matching_profile_user_id::text;
      primary_tenant_prefix := matching_profile_id::text;
      if matching_profile_id <> matching_profile_user_id then
        secondary_tenant_prefix := matching_profile_user_id::text;
      end if;
    elsif tenant_is_account then
      resolved_tenant_key := path_tenant_id::text;
      primary_tenant_prefix := path_tenant_id::text;

      select profile.id
      into linked_profile_id
      from public.crew_profiles as profile
      where profile.user_id = path_tenant_id;

      if linked_profile_id is not null and linked_profile_id <> path_tenant_id then
        secondary_tenant_prefix := linked_profile_id::text;
      end if;
    elsif matching_profile_id is not null then
      -- Unlinked profiles remain isolated by profile ID. This preserves access
      -- for service workflows without inventing an unrelated account tenant.
      resolved_tenant_key := matching_profile_id::text;
      primary_tenant_prefix := matching_profile_id::text;
    else
      raise exception using
        errcode = '23503',
        message = 'Storage crew account or profile tenant does not exist.';
    end if;
  elsif resolved_quota_scope = 'crew-documents' then
    if matching_profile_id is null then
      raise exception using
        errcode = '23503',
        message = 'Storage crew profile tenant does not exist.';
    end if;

    resolved_tenant_key := coalesce(
      matching_profile_user_id,
      matching_profile_id
    )::text;
    primary_tenant_prefix := matching_profile_id::text;
  else
    if not exists (
      select 1
      from public.yachts as yacht
      where yacht.id = path_tenant_id
    ) then
      raise exception using
        errcode = '23503',
        message = 'Storage yacht tenant does not exist.';
    end if;

    resolved_tenant_key := path_tenant_id::text;
    primary_tenant_prefix := path_tenant_id::text;
  end if;

  return next;
end;
$function$;

create or replace function private.bluedeck_guard_storage_resource_quota()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  excluded_id uuid;
  tenant_key text;
  primary_tenant_prefix text;
  secondary_tenant_prefix text;
  quota_scope text;
  old_tenant_key text;
  old_quota_scope text;
  old_lock_identity text;
  new_lock_identity text;
  maximum_objects bigint;
  maximum_bytes numeric;
  new_size bigint;
  object_count bigint;
  valid_size_count bigint;
  current_bytes numeric;
begin
  case new.bucket_id
    when 'crew-portfolio' then
      quota_scope := 'crew-portfolio';
      maximum_objects := 50;
      maximum_bytes := 100::numeric * 1024 * 1024;
    when 'crew-documents' then
      quota_scope := 'crew-documents';
      maximum_objects := 50;
      maximum_bytes := 250::numeric * 1024 * 1024;
    when 'task-photos' then
      quota_scope := 'task-photos';
      maximum_objects := 500;
      maximum_bytes := 1::numeric * 1024 * 1024 * 1024;
    when 'documents' then
      quota_scope := 'yacht-documents-combined';
      maximum_objects := 250;
      maximum_bytes := 2::numeric * 1024 * 1024 * 1024;
    when 'yacht-documents' then
      quota_scope := 'yacht-documents-combined';
      maximum_objects := 250;
      maximum_bytes := 2::numeric * 1024 * 1024 * 1024;
    else
      quota_scope := null;
  end case;

  -- Lock the source of a move as well as its destination. Sorting the two lock
  -- identities prevents opposite concurrent moves from deadlocking, and makes
  -- newly available source capacity visible before another upload is checked.
  if tg_op = 'UPDATE'
    and old.bucket_id in (
      'crew-portfolio',
      'crew-documents',
      'task-photos',
      'documents',
      'yacht-documents'
    )
  then
    begin
      select
        context.resolved_quota_scope,
        context.resolved_tenant_key
      into old_quota_scope, old_tenant_key
      from private.bluedeck_storage_quota_context(
        old.bucket_id,
        old.name
      ) as context;
    exception
      when check_violation or foreign_key_violation then
        -- Do not prevent a repair that moves an already orphaned or malformed
        -- legacy object out of a quota-controlled namespace.
        old_quota_scope := null;
        old_tenant_key := null;
    end;
  end if;

  if quota_scope is null then
    if old_quota_scope is not null then
      perform private.bluedeck_lock_resource_quota(
        'storage:' || old_quota_scope,
        old_tenant_key
      );
    end if;
    return new;
  end if;

  select
    context.resolved_tenant_key,
    context.primary_tenant_prefix,
    context.secondary_tenant_prefix
  into tenant_key, primary_tenant_prefix, secondary_tenant_prefix
  from private.bluedeck_storage_quota_context(
    new.bucket_id,
    new.name
  ) as context;

  new_size := private.bluedeck_storage_object_size_bytes(new.metadata);
  if new_size is null then
    raise exception using
      errcode = '23514',
      message = 'Storage object metadata requires a non-negative integer size.';
  end if;

  old_lock_identity := 'storage:' || old_quota_scope || ':' || old_tenant_key;
  new_lock_identity := 'storage:' || quota_scope || ':' || tenant_key;

  if old_quota_scope is null or old_lock_identity = new_lock_identity then
    perform private.bluedeck_lock_resource_quota(
      'storage:' || quota_scope,
      tenant_key
    );
  elsif old_lock_identity < new_lock_identity then
    perform private.bluedeck_lock_resource_quota(
      'storage:' || old_quota_scope,
      old_tenant_key
    );
    perform private.bluedeck_lock_resource_quota(
      'storage:' || quota_scope,
      tenant_key
    );
  else
    perform private.bluedeck_lock_resource_quota(
      'storage:' || quota_scope,
      tenant_key
    );
    perform private.bluedeck_lock_resource_quota(
      'storage:' || old_quota_scope,
      old_tenant_key
    );
  end if;

  if tg_op = 'UPDATE' then
    excluded_id := old.id;
  else
    -- Storage upserts run BEFORE INSERT triggers before resolving their
    -- bucket/name conflict. Resolve the existing object only after acquiring
    -- the tenant mutex, so two concurrent upserts of a newly-created path do
    -- not double-count one another at the object or byte ceiling.
    select object.id
    into excluded_id
    from storage.objects as object
    where object.bucket_id = new.bucket_id
      and object.name = new.name;
  end if;

  select
    pg_catalog.count(*),
    pg_catalog.count(candidate.size_bytes),
    coalesce(pg_catalog.sum(candidate.size_bytes::numeric), 0::numeric)
  into object_count, valid_size_count, current_bytes
  from (
    select private.bluedeck_storage_object_size_bytes(object.metadata) as size_bytes
    from storage.objects as object
    where (
        (quota_scope = 'crew-portfolio' and object.bucket_id = 'crew-portfolio')
        or (quota_scope = 'crew-documents' and object.bucket_id = 'crew-documents')
        or (quota_scope = 'task-photos' and object.bucket_id = 'task-photos')
        or (
          quota_scope = 'yacht-documents-combined'
          and object.bucket_id in ('documents', 'yacht-documents')
        )
      )
      -- Existing Storage indexes begin with bucket_id/name. Canonical UUID paths
      -- form half-open [tenant/, tenant0) ranges. crew-portfolio may have two
      -- such ranges because profile-ID and auth-user-ID paths share one quota.
      and (
        (
          object.name >= primary_tenant_prefix || '/'
          and object.name < primary_tenant_prefix || '0'
        )
        or (
          secondary_tenant_prefix is not null
          and object.name >= secondary_tenant_prefix || '/'
          and object.name < secondary_tenant_prefix || '0'
        )
      )
      and (excluded_id is null or object.id <> excluded_id)
  ) as candidate;

  if valid_size_count <> object_count then
    raise exception using
      errcode = '23514',
      message = 'Existing storage metadata is invalid for quota accounting.',
      hint = 'Repair the affected object metadata through the Storage API before writing more objects.';
  end if;

  if object_count >= maximum_objects then
    raise exception using
      errcode = '54000',
      message = pg_catalog.format(
        'The %s storage object limit has been reached.',
        quota_scope
      ),
      hint = 'Delete an existing object before uploading another one.';
  end if;

  if current_bytes + new_size::numeric > maximum_bytes then
    raise exception using
      errcode = '54000',
      message = pg_catalog.format(
        'The %s storage byte limit has been reached.',
        quota_scope
      ),
      hint = 'Delete existing files or upload a smaller replacement.';
  end if;

  return new;
end;
$function$;

drop trigger if exists yachts_zz_bluedeck_resource_quota
  on public.yachts;
create trigger yachts_zz_bluedeck_resource_quota
before insert or update of owner_id on public.yachts
for each row execute function private.bluedeck_guard_yacht_resource_quota();

drop trigger if exists job_posts_zz_bluedeck_resource_quota
  on public.job_posts;
create trigger job_posts_zz_bluedeck_resource_quota
before insert or update of created_by, created_at, status on public.job_posts
for each row execute function private.bluedeck_guard_job_post_resource_quota();

drop trigger if exists job_applications_zz_bluedeck_resource_quota
  on public.job_applications;
create trigger job_applications_zz_bluedeck_resource_quota
before insert or update of applicant_user_id, job_post_id, created_at
on public.job_applications
for each row execute function
  private.bluedeck_guard_job_application_resource_quota();

drop trigger if exists crew_invitations_zz_bluedeck_resource_quota
  on public.crew_invitations;
create trigger crew_invitations_zz_bluedeck_resource_quota
before insert or update of yacht_id, invited_by, created_at, status
on public.crew_invitations
for each row execute function
  private.bluedeck_guard_crew_invitation_resource_quota();

-- storage.objects is owned by Supabase's reserved storage role. The project
-- postgres role has TRIGGER (but not ownership/index-DDL) privilege, so replace
-- this trigger directly without altering any Supabase-owned relation object.
create or replace trigger objects_zz_bluedeck_resource_quota
before insert or update of bucket_id, name, metadata on storage.objects
for each row execute function private.bluedeck_guard_storage_resource_quota();

revoke all on function private.bluedeck_guard_yacht_resource_quota()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_guard_job_post_resource_quota()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_guard_job_application_resource_quota()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_guard_crew_invitation_resource_quota()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_storage_object_size_bytes(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_storage_tenant_id(text)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_storage_quota_context(text, text)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_guard_storage_resource_quota()
  from public, anon, authenticated, service_role;

comment on function private.bluedeck_guard_yacht_resource_quota() is
  'Enforces a serialized 25-yacht ceiling per owner, including service_role writes and ownership transfers.';
comment on function private.bluedeck_guard_job_post_resource_quota() is
  'Enforces serialized per-creator job retention, rolling creation and published-listing ceilings.';
comment on function private.bluedeck_guard_job_application_resource_quota() is
  'Enforces serialized per-applicant, rolling submission and per-job application ceilings.';
comment on function private.bluedeck_guard_crew_invitation_resource_quota() is
  'Enforces serialized per-yacht invitation retention/pending ceilings and rolling issuer limits.';
comment on function private.bluedeck_storage_quota_context(text, text) is
  'Resolves Storage paths to logical quota tenants, combining linked crew profile and auth-user portfolio prefixes.';
comment on function private.bluedeck_guard_storage_resource_quota() is
  'Enforces UUID-tenant object and byte ceilings across quota-controlled private Storage buckets, including service_role and upserts.';

commit;
