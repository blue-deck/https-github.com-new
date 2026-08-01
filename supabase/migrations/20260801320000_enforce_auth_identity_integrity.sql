-- Reconcile legacy application identities with the canonical Supabase Auth
-- identity table without silently destroying historical data.
--
-- `profiles` is an account-owned projection and therefore follows Auth user
-- deletion. A yacht is a durable business record, so its owner relationship
-- deliberately RESTRICTs Auth deletion until ownership is transferred or the
-- yacht is closed through an explicit lifecycle workflow.

begin;

set local lock_timeout = '10s';
set local statement_timeout = '2min';

create schema if not exists private;

create table if not exists private.bluedeck_identity_drift_quarantine (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  missing_auth_user_id uuid not null,
  reason text not null,
  source_row jsonb not null,
  source_references jsonb not null default '{}'::jsonb,
  quarantined_at timestamptz not null default statement_timestamp(),
  constraint bluedeck_identity_drift_quarantine_entity_type_check
    check (entity_type in ('profile', 'yacht_owner')),
  constraint bluedeck_identity_drift_quarantine_reason_check
    check (reason = 'missing_auth_user'),
  constraint bluedeck_identity_drift_quarantine_profile_identity_check
    check (
      entity_type <> 'profile'
      or entity_id = missing_auth_user_id
    ),
  constraint bluedeck_identity_drift_quarantine_entity_key
    unique (entity_type, entity_id)
);

comment on table private.bluedeck_identity_drift_quarantine is
  'Immutable snapshots of legacy identity references removed from exposed tables before Auth foreign keys were validated.';
comment on column private.bluedeck_identity_drift_quarantine.source_row is
  'Complete row snapshot retained for an explicit, audited recovery decision; never exposed through the Data API.';
comment on column private.bluedeck_identity_drift_quarantine.source_references is
  'Snapshot of relationships changed by quarantine so historical attribution can be reviewed without reopening public identity drift.';

alter table private.bluedeck_identity_drift_quarantine
  enable row level security;
alter table private.bluedeck_identity_drift_quarantine
  force row level security;
revoke all privileges on table private.bluedeck_identity_drift_quarantine
  from public, anon, authenticated, service_role;

create index if not exists bluedeck_identity_drift_quarantine_missing_user_idx
  on private.bluedeck_identity_drift_quarantine (
    missing_auth_user_id,
    quarantined_at desc
  );

-- Auth writes can fan out into application tables through signup triggers.
-- Lock in that same parent-to-child order so the reconciliation snapshot and
-- the subsequent constraint validation observe one stable identity set.
lock table auth.users in share row exclusive mode;
lock table public.profiles in share row exclusive mode;
lock table public.yachts in share row exclusive mode;
lock table public.yacht_documents in share row exclusive mode;

-- Preserve every legacy profile field, including fields unknown to this
-- migration, before removing the row from the public account projection.
insert into private.bluedeck_identity_drift_quarantine (
  entity_type,
  entity_id,
  missing_auth_user_id,
  reason,
  source_row,
  source_references
)
select
  'profile',
  profile.id,
  profile.id,
  'missing_auth_user',
  to_jsonb(profile),
  jsonb_build_object(
    'yacht_documents_uploaded_by',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'document_id', document.id,
            'uploaded_by', document.uploaded_by
          )
          order by document.id
        )
        from public.yacht_documents as document
        where document.uploaded_by = profile.id
      ),
      '[]'::jsonb
    )
  )
from public.profiles as profile
where not exists (
  select 1
  from auth.users as account
  where account.id = profile.id
)
on conflict (entity_type, entity_id) do nothing;

delete from public.profiles as profile
where not exists (
  select 1
  from auth.users as account
  where account.id = profile.id
);

do $validation$
begin
  if exists (
    select 1
    from public.profiles as profile
    left join auth.users as account on account.id = profile.id
    where account.id is null
  ) then
    raise exception using
      errcode = '23503',
      message = 'Profile identity drift remained after quarantine.';
  end if;
end;
$validation$;

-- A yacht is never deleted to repair identity drift. If a legacy row points
-- at a missing Auth identity, preserve its complete row and remove only the
-- unusable owner capability. A NULL owner is fail-closed under the yacht RLS
-- model and can be repaired only by a trusted ownership-transfer workflow.
insert into private.bluedeck_identity_drift_quarantine (
  entity_type,
  entity_id,
  missing_auth_user_id,
  reason,
  source_row,
  source_references
)
select
  'yacht_owner',
  yacht.id,
  yacht.owner_id,
  'missing_auth_user',
  to_jsonb(yacht),
  '{}'::jsonb
from public.yachts as yacht
where yacht.owner_id is not null
  and not exists (
    select 1
    from auth.users as account
    where account.id = yacht.owner_id
  )
on conflict (entity_type, entity_id) do nothing;

update public.yachts as yacht
set owner_id = null
where yacht.owner_id is not null
  and not exists (
    select 1
    from auth.users as account
    where account.id = yacht.owner_id
  );

do $validation$
begin
  if exists (
    select 1
    from public.yachts as yacht
    left join auth.users as account on account.id = yacht.owner_id
    where yacht.owner_id is not null
      and account.id is null
  ) then
    raise exception using
      errcode = '23503',
      message = 'Yacht owner identity drift remained after quarantine.';
  end if;
end;
$validation$;

-- Replace any earlier FK on these exact identity columns while the tables are
-- write-locked. This handles both canonical-name collisions and a legacy FK
-- with a different name/delete action without leaving two conflicting rules.
-- An unrelated constraint using the desired canonical name fails closed
-- instead of being silently dropped.
do $constraints$
declare
  existing_constraint record;
begin
  if exists (
    select 1
    from pg_catalog.pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.profiles'::regclass
      and constraint_row.conname = 'profiles_id_auth_users_fkey'
  ) and not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_row
    inner join pg_catalog.pg_attribute as source_column
      on source_column.attrelid = constraint_row.conrelid
      and source_column.attname = 'id'
      and not source_column.attisdropped
    where constraint_row.conrelid = 'public.profiles'::regclass
      and constraint_row.conname = 'profiles_id_auth_users_fkey'
      and constraint_row.confrelid = 'auth.users'::regclass
      and constraint_row.contype = 'f'
      and cardinality(constraint_row.conkey) = 1
      and constraint_row.conkey[1] = source_column.attnum
  ) then
    raise exception using
      errcode = '42710',
      message = 'profiles_id_auth_users_fkey collides with an unrelated constraint.';
  end if;

  for existing_constraint in
    select constraint_row.conname
    from pg_catalog.pg_constraint as constraint_row
    inner join pg_catalog.pg_attribute as source_column
      on source_column.attrelid = constraint_row.conrelid
      and source_column.attname = 'id'
      and not source_column.attisdropped
    where constraint_row.conrelid = 'public.profiles'::regclass
      and constraint_row.confrelid = 'auth.users'::regclass
      and constraint_row.contype = 'f'
      and cardinality(constraint_row.conkey) = 1
      and constraint_row.conkey[1] = source_column.attnum
  loop
    execute format(
      'alter table public.profiles drop constraint %I',
      existing_constraint.conname
    );
  end loop;
end;
$constraints$;

alter table public.profiles
  add constraint profiles_id_auth_users_fkey
  foreign key (id)
  references auth.users (id)
  on delete cascade
  not valid;

alter table public.profiles
  validate constraint profiles_id_auth_users_fkey;

do $constraints$
declare
  existing_constraint record;
begin
  if exists (
    select 1
    from pg_catalog.pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.yachts'::regclass
      and constraint_row.conname = 'yachts_owner_id_auth_users_fkey'
  ) and not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_row
    inner join pg_catalog.pg_attribute as source_column
      on source_column.attrelid = constraint_row.conrelid
      and source_column.attname = 'owner_id'
      and not source_column.attisdropped
    where constraint_row.conrelid = 'public.yachts'::regclass
      and constraint_row.conname = 'yachts_owner_id_auth_users_fkey'
      and constraint_row.confrelid = 'auth.users'::regclass
      and constraint_row.contype = 'f'
      and cardinality(constraint_row.conkey) = 1
      and constraint_row.conkey[1] = source_column.attnum
  ) then
    raise exception using
      errcode = '42710',
      message = 'yachts_owner_id_auth_users_fkey collides with an unrelated constraint.';
  end if;

  for existing_constraint in
    select constraint_row.conname
    from pg_catalog.pg_constraint as constraint_row
    inner join pg_catalog.pg_attribute as source_column
      on source_column.attrelid = constraint_row.conrelid
      and source_column.attname = 'owner_id'
      and not source_column.attisdropped
    where constraint_row.conrelid = 'public.yachts'::regclass
      and constraint_row.confrelid = 'auth.users'::regclass
      and constraint_row.contype = 'f'
      and cardinality(constraint_row.conkey) = 1
      and constraint_row.conkey[1] = source_column.attnum
  loop
    execute format(
      'alter table public.yachts drop constraint %I',
      existing_constraint.conname
    );
  end loop;
end;
$constraints$;

alter table public.yachts
  add constraint yachts_owner_id_auth_users_fkey
  foreign key (owner_id)
  references auth.users (id)
  on delete restrict
  not valid;

alter table public.yachts
  validate constraint yachts_owner_id_auth_users_fkey;

-- `public.crew_members` is a locked, unused legacy prototype. Its nullable
-- `user_id` has no active application contract, and all current rows are
-- unlinked. Adding an arbitrary CASCADE/RESTRICT/SET NULL rule here would
-- invent lifecycle semantics, so it intentionally remains unchanged.

commit;
