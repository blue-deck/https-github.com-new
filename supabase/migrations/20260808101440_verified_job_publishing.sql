-- Require a current, administrator-reviewed employer relationship before an
-- account may publish or manage recruitment listings. Self-selected signup
-- roles remain useful for onboarding, but are never publishing authority.

begin;

create schema if not exists private;

create or replace function private.bluedeck_has_job_publisher_authority(
  p_actor_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $function$
  select
    p_actor_user_id is not null
    and exists (
      select 1
      from public.marketplace_entitlements as entitlement
      inner join auth.users as account
        on account.id = entitlement.user_id
      where entitlement.user_id = p_actor_user_id
        and entitlement.account_role in ('captain', 'owner', 'management')
        and entitlement.posting_status = 'enabled'
        and account.email_confirmed_at is not null
        and account.deleted_at is null
        and (
          account.banned_until is null
          or account.banned_until <= statement_timestamp()
        )
    )
    and exists (
      select 1
      from public.employer_access as access
      inner join public.yachts as yacht
        on yacht.id = access.yacht_id
      where access.user_id = p_actor_user_id
        and access.status = 'verified'
        and access.can_post_jobs is true
        and yacht.owner_id = p_actor_user_id
    );
$function$;

create or replace function public.bluedeck_can_apply_to_job(
  p_actor_user_id uuid,
  p_job_post_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
  select
    exists (
      select 1
      from public.marketplace_entitlements as entitlement
      inner join auth.users as account
        on account.id = entitlement.user_id
      where entitlement.user_id = p_actor_user_id
        and entitlement.account_role in ('crew', 'captain')
        and account.email_confirmed_at is not null
        and account.deleted_at is null
        and (
          account.banned_until is null
          or account.banned_until <= statement_timestamp()
        )
    )
    and exists (
      select 1
      from public.job_posts as post
      where post.id = p_job_post_id
        and post.status = 'published'
        and post.closes_at is not null
        and post.closes_at > statement_timestamp()
        and post.created_by <> p_actor_user_id
        and private.bluedeck_has_job_publisher_authority(post.created_by)
    );
$function$;

-- Public job reads need one fail-closed authority check for the whole page,
-- not one network round-trip per publisher. The function remains service-role
-- only and accepts at most one public page of identifiers.
create or replace function public.bluedeck_current_public_job_post_ids(
  p_job_post_ids uuid[]
)
returns table (job_post_id uuid)
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $function$
  select post.id
  from public.job_posts as post
  where cardinality(coalesce(p_job_post_ids, '{}'::uuid[])) between 1 and 100
    and post.id = any(p_job_post_ids)
    and post.status = 'published'
    and post.published_at <= statement_timestamp()
    and post.closes_at > statement_timestamp()
    and private.bluedeck_has_job_publisher_authority(post.created_by)
  order by post.published_at desc, post.id;
$function$;

-- Keep the legacy service RPC bounded as defense in depth. The application
-- uses explicit 50-row pages, while this cap protects any older caller.
create or replace function public.bluedeck_list_job_applications(
  p_actor_user_id uuid,
  p_job_post_id uuid default null
)
returns setof public.job_applications
language plpgsql
stable
security definer
set search_path = pg_catalog, public
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
      or public.bluedeck_can_manage_job(
        p_actor_user_id,
        application.job_post_id
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
set search_path = pg_catalog, public
as $function$
  select post.id, count(application.id)
  from public.job_posts as post
  left join public.job_applications as application
    on application.job_post_id = post.id
  where post.created_by = p_actor_user_id
    and public.bluedeck_can_manage_job(p_actor_user_id, post.id)
  group by post.id
  order by post.updated_at desc, post.id
  limit 250;
$function$;

-- Cursor-paginated application reads keep authority and data selection inside
-- one database snapshot, avoiding both offset drift and authorization TOCTOU.
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
set search_path = pg_catalog, public
as $function$
declare
  safe_limit integer := least(greatest(coalesce(p_limit, 50), 1), 50);
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

  select count(*)
  into total_count
  from public.job_applications as application
  where application.job_post_id = p_job_post_id;

  select
    coalesce(
      jsonb_agg(
        to_jsonb(candidate) - 'page_number'
        order by candidate.submitted_at desc, candidate.id desc
      ) filter (where candidate.page_number <= safe_limit),
      '[]'::jsonb
    ),
    count(*) > safe_limit
  into page_rows, page_has_more
  from (
    select
      application.*,
      row_number() over (
        order by application.submitted_at desc, application.id desc
      ) as page_number
    from public.job_applications as application
    where application.job_post_id = p_job_post_id
      and (
        p_before_submitted_at is null
        or (application.submitted_at, application.id)
          < (p_before_submitted_at, p_before_id)
      )
    order by application.submitted_at desc, application.id desc
    limit safe_limit + 1
  ) as candidate;

  return jsonb_build_object(
    'total', total_count,
    'rows', page_rows,
    'has_more', page_has_more
  );
end;
$function$;

-- Close every current listing as soon as the creator loses their final
-- verified employer relationship. The existing job-post trigger permits this
-- narrow authority-revocation transition while rejecting all other writes.
create or replace function private.bluedeck_close_jobs_without_verified_access(
  p_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  if p_user_id is null
    or private.bluedeck_has_job_publisher_authority(p_user_id)
  then
    return;
  end if;

  update public.job_posts as post
  set status = 'closed',
      updated_by = post.created_by
  where post.created_by = p_user_id
    and post.status in ('draft', 'published');
end;
$function$;

create or replace function private.bluedeck_close_jobs_on_employer_access_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  perform private.bluedeck_close_jobs_without_verified_access(
    case when tg_op = 'DELETE' then old.user_id else new.user_id end
  );
  return case when tg_op = 'DELETE' then old else new end;
end;
$function$;

drop trigger if exists employer_access_00_close_job_posts
  on public.employer_access;
create trigger employer_access_00_close_job_posts
after update of status, can_post_jobs or delete
on public.employer_access
for each row execute function private.bluedeck_close_jobs_on_employer_access_change();

create or replace function private.bluedeck_close_jobs_on_yacht_owner_change()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
begin
  if tg_op = 'DELETE' then
    perform private.bluedeck_close_jobs_without_verified_access(old.owner_id);
    return old;
  end if;

  if new.owner_id is distinct from old.owner_id then
    perform private.bluedeck_close_jobs_without_verified_access(old.owner_id);
  end if;
  return new;
end;
$function$;

drop trigger if exists yachts_00_close_job_posts_on_owner_change
  on public.yachts;
create trigger yachts_00_close_job_posts_on_owner_change
after update of owner_id or delete
on public.yachts
for each row execute function private.bluedeck_close_jobs_on_yacht_owner_change();

-- Apply the new boundary to rows created under the former account-role-only
-- rule. This preserves applications and audit history while removing any
-- unverified listing from the public board immediately.
update public.job_posts as post
set status = 'closed',
    updated_by = post.created_by
where post.status in ('draft', 'published')
  and not private.bluedeck_has_job_publisher_authority(post.created_by);

revoke all on function private.bluedeck_has_job_publisher_authority(uuid)
  from public, anon, authenticated;
revoke all on function public.bluedeck_can_apply_to_job(uuid, uuid)
  from public, anon;
grant execute on function public.bluedeck_can_apply_to_job(uuid, uuid)
  to authenticated, service_role;
revoke all on function public.bluedeck_current_public_job_post_ids(uuid[])
  from public, anon, authenticated;
grant execute on function public.bluedeck_current_public_job_post_ids(uuid[])
  to service_role;
revoke all on function public.bluedeck_job_application_counts(uuid)
  from public, anon, authenticated;
grant execute on function public.bluedeck_job_application_counts(uuid)
  to service_role;
revoke all on function public.bluedeck_job_applications_page(
  uuid, uuid, timestamptz, uuid, integer
) from public, anon, authenticated;
grant execute on function public.bluedeck_job_applications_page(
  uuid, uuid, timestamptz, uuid, integer
) to service_role;
revoke all on function private.bluedeck_close_jobs_without_verified_access(uuid)
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_close_jobs_on_employer_access_change()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_close_jobs_on_yacht_owner_change()
  from public, anon, authenticated, service_role;

comment on function private.bluedeck_has_job_publisher_authority(uuid) is
  'Canonical fail-closed job publisher authority: confirmed account, enabled publisher entitlement, and a current administrator-verified employer relationship for a yacht the account still owns.';

commit;
