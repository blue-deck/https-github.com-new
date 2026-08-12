-- Temporarily allow every active Captain, Owner / Employer and Management
-- account with an enabled marketplace entitlement to publish recruitment
-- listings without a separate administrator-reviewed employer_access row.
--
-- Job ownership remains immutable: publishers can manage only listings they
-- created. Crew accounts, unconfirmed/deleted/banned accounts and suspended
-- entitlements remain denied.

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
    );
$function$;

-- Recruitment is account-owned and deliberately independent from yacht
-- ownership or employer-access review. Entitlement suspension/deletion still
-- closes current listings through marketplace_entitlements_00_close_job_posts.
drop trigger if exists employer_access_00_close_job_posts
  on public.employer_access;
drop trigger if exists yachts_00_close_job_posts_on_owner_change
  on public.yachts;

drop function if exists private.bluedeck_close_jobs_on_employer_access_change();
drop function if exists private.bluedeck_close_jobs_on_yacht_owner_change();
drop function if exists private.bluedeck_close_jobs_without_verified_access(uuid);

revoke all on function private.bluedeck_has_job_publisher_authority(uuid)
  from public, anon, authenticated, service_role;

comment on function private.bluedeck_has_job_publisher_authority(uuid) is
  'Account-level job publishing authority for active confirmed Captain, Owner / Employer and Management accounts with an enabled marketplace entitlement; independent from employer-access review and yacht ownership.';

comment on table public.job_posts is
  'Server-managed recruitment listings owned and managed by the active Captain, Owner / Employer or Management account that created them.';

commit;
