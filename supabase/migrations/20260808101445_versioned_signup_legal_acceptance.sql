-- Require and preserve a server-timestamped record of the policy versions
-- accepted whenever a public email account is created through Supabase Auth.

begin;

create schema if not exists private;

create table if not exists private.bluedeck_legal_acceptances (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  privacy_policy_version text not null,
  terms_of_use_version text not null,
  accepted_at timestamptz not null default statement_timestamp(),
  source text not null default 'account_signup',
  constraint bluedeck_legal_acceptance_versions_check check (
    privacy_policy_version = '2026-08-01'
    and terms_of_use_version = '2026-08-01'
  ),
  constraint bluedeck_legal_acceptance_source_check check (
    source = 'account_signup'
  ),
  constraint bluedeck_legal_acceptance_once_per_version unique (
    user_id,
    privacy_policy_version,
    terms_of_use_version
  )
);

revoke all on table private.bluedeck_legal_acceptances
  from public, anon, authenticated;
grant select on table private.bluedeck_legal_acceptances to service_role;

create or replace function private.bluedeck_validate_signup_legal_acceptance()
returns trigger
language plpgsql
set search_path = pg_catalog
as $function$
declare
  acceptance jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb)
    -> 'bluedeck_legal_acceptance';
  provider text := coalesce(new.raw_app_meta_data ->> 'provider', 'email');
begin
  -- Supabase Auth performs public account creation as supabase_auth_admin.
  -- Direct administrative SQL fixtures remain possible without fabricating a
  -- user acceptance, while every public email signup fails closed.
  if current_user = 'supabase_auth_admin'
    and provider = 'email'
    and (
      jsonb_typeof(acceptance) is distinct from 'object'
      or acceptance ->> 'accepted' <> 'true'
      or acceptance ->> 'privacyVersion' <> '2026-08-01'
      or acceptance ->> 'termsVersion' <> '2026-08-01'
    )
  then
    raise exception using
      errcode = '23514',
      message = 'Current BlueDeck legal acceptance is required.';
  end if;
  return new;
end;
$function$;

create or replace function private.bluedeck_capture_signup_legal_acceptance()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, private
as $function$
declare
  acceptance jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb)
    -> 'bluedeck_legal_acceptance';
begin
  if jsonb_typeof(acceptance) = 'object'
    and acceptance ->> 'accepted' = 'true'
    and acceptance ->> 'privacyVersion' = '2026-08-01'
    and acceptance ->> 'termsVersion' = '2026-08-01'
  then
    insert into private.bluedeck_legal_acceptances (
      user_id,
      privacy_policy_version,
      terms_of_use_version,
      accepted_at,
      source
    )
    values (
      new.id,
      '2026-08-01',
      '2026-08-01',
      statement_timestamp(),
      'account_signup'
    )
    on conflict (
      user_id,
      privacy_policy_version,
      terms_of_use_version
    ) do nothing;
  end if;
  return new;
end;
$function$;

drop trigger if exists bluedeck_00_validate_signup_legal_acceptance
  on auth.users;
create trigger bluedeck_00_validate_signup_legal_acceptance
before insert on auth.users
for each row execute function private.bluedeck_validate_signup_legal_acceptance();

drop trigger if exists bluedeck_zz_capture_signup_legal_acceptance
  on auth.users;
create trigger bluedeck_zz_capture_signup_legal_acceptance
after insert on auth.users
for each row execute function private.bluedeck_capture_signup_legal_acceptance();

revoke all on function private.bluedeck_validate_signup_legal_acceptance()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_capture_signup_legal_acceptance()
  from public, anon, authenticated, service_role;

comment on table private.bluedeck_legal_acceptances is
  'Immutable, server-timestamped evidence of the exact Privacy Policy and Terms of Use versions accepted during account signup.';

commit;
