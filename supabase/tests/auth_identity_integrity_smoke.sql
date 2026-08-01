begin;

do $test$
declare
  cascade_user_id uuid := gen_random_uuid();
  restricted_owner_id uuid := gen_random_uuid();
  restricted_yacht_id uuid := gen_random_uuid();
  missing_profile_user_id uuid := gen_random_uuid();
  missing_yacht_owner_id uuid := gen_random_uuid();
  missing_yacht_id uuid := gen_random_uuid();
  rejected boolean;
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_row
    inner join pg_catalog.pg_attribute as source_column
      on source_column.attrelid = constraint_row.conrelid
      and source_column.attnum = constraint_row.conkey[1]
    inner join pg_catalog.pg_attribute as target_column
      on target_column.attrelid = constraint_row.confrelid
      and target_column.attnum = constraint_row.confkey[1]
    where constraint_row.conname = 'profiles_id_auth_users_fkey'
      and constraint_row.conrelid = 'public.profiles'::regclass
      and constraint_row.confrelid = 'auth.users'::regclass
      and constraint_row.contype = 'f'
      and cardinality(constraint_row.conkey) = 1
      and cardinality(constraint_row.confkey) = 1
      and source_column.attname = 'id'
      and target_column.attname = 'id'
      and constraint_row.confdeltype = 'c'
      and constraint_row.convalidated
  ) then
    raise exception 'profiles.id is not protected by a validated Auth CASCADE foreign key.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_constraint as constraint_row
    inner join pg_catalog.pg_attribute as source_column
      on source_column.attrelid = constraint_row.conrelid
      and source_column.attnum = constraint_row.conkey[1]
    inner join pg_catalog.pg_attribute as target_column
      on target_column.attrelid = constraint_row.confrelid
      and target_column.attnum = constraint_row.confkey[1]
    where constraint_row.conname = 'yachts_owner_id_auth_users_fkey'
      and constraint_row.conrelid = 'public.yachts'::regclass
      and constraint_row.confrelid = 'auth.users'::regclass
      and constraint_row.contype = 'f'
      and cardinality(constraint_row.conkey) = 1
      and cardinality(constraint_row.confkey) = 1
      and source_column.attname = 'owner_id'
      and target_column.attname = 'id'
      and constraint_row.confdeltype = 'r'
      and constraint_row.convalidated
  ) then
    raise exception 'yachts.owner_id is not protected by a validated Auth RESTRICT foreign key.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_class as relation
    where relation.oid = 'private.bluedeck_identity_drift_quarantine'::regclass
      and relation.relrowsecurity
      and relation.relforcerowsecurity
  ) or exists (
    select 1
    from pg_catalog.pg_policies as policy
    where policy.schemaname = 'private'
      and policy.tablename = 'bluedeck_identity_drift_quarantine'
  ) or has_table_privilege(
    'anon',
    'private.bluedeck_identity_drift_quarantine',
    'SELECT'
  ) or has_table_privilege(
    'authenticated',
    'private.bluedeck_identity_drift_quarantine',
    'SELECT'
  ) or has_table_privilege(
    'service_role',
    'private.bluedeck_identity_drift_quarantine',
    'SELECT'
  ) then
    raise exception 'Identity drift quarantine is not private and fail-closed.';
  end if;

  if exists (
    select 1
    from private.bluedeck_identity_drift_quarantine as quarantine
    where quarantine.entity_type = 'profile'
      and (
        quarantine.entity_id is distinct from quarantine.missing_auth_user_id
        or quarantine.source_row ->> 'id' is distinct from quarantine.entity_id::text
        or jsonb_typeof(
          quarantine.source_references -> 'yacht_documents_uploaded_by'
        ) is distinct from 'array'
      )
  ) or exists (
    select 1
    from private.bluedeck_identity_drift_quarantine as quarantine
    where quarantine.entity_type = 'yacht_owner'
      and (
        quarantine.source_row ->> 'id' is distinct from quarantine.entity_id::text
        or quarantine.source_row ->> 'owner_id'
          is distinct from quarantine.missing_auth_user_id::text
      )
  ) then
    raise exception 'An identity quarantine snapshot does not preserve its source identity.';
  end if;

  if exists (
    select 1
    from private.bluedeck_identity_drift_quarantine as quarantine
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(
          quarantine.source_references -> 'yacht_documents_uploaded_by'
        ) = 'array'
        then quarantine.source_references -> 'yacht_documents_uploaded_by'
        else '[]'::jsonb
      end
    ) as reference_row
    where quarantine.entity_type = 'profile'
      and (
        reference_row ->> 'document_id' is null
        or reference_row ->> 'uploaded_by'
          is distinct from quarantine.entity_id::text
      )
  ) then
    raise exception 'A quarantined yacht document lost its original uploader attribution.';
  end if;

  if exists (
    select 1
    from public.profiles as profile
    left join auth.users as account on account.id = profile.id
    where account.id is null
  ) or exists (
    select 1
    from public.yachts as yacht
    left join auth.users as account on account.id = yacht.owner_id
    where yacht.owner_id is not null
      and account.id is null
  ) then
    raise exception 'An exposed application row still references a missing Auth identity.';
  end if;

  rejected := false;
  begin
    insert into public.profiles (id, email, full_name, role)
    values (
      missing_profile_user_id,
      'missing-profile-' || missing_profile_user_id || '@example.invalid',
      'Missing Profile Identity',
      'crew'
    );
  exception
    when foreign_key_violation then
      rejected := true;
  end;
  if not rejected then
    raise exception 'A profile was created for a missing Auth identity.';
  end if;

  rejected := false;
  begin
    insert into public.yachts (id, name, model, flag, owner_id)
    values (
      missing_yacht_id,
      'Missing Owner Yacht',
      'Test',
      'Malta',
      missing_yacht_owner_id
    );
  exception
    when foreign_key_violation then
      rejected := true;
  end;
  if not rejected then
    raise exception 'A yacht was created for a missing Auth owner.';
  end if;

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
  ) values (
    cascade_user_id,
    'authenticated',
    'authenticated',
    'profile-cascade-' || cascade_user_id || '@example.invalid',
    '',
    statement_timestamp(),
    '{}'::jsonb,
    '{}'::jsonb,
    statement_timestamp(),
    statement_timestamp()
  );

  insert into public.profiles (id, email, full_name, role)
  values (
    cascade_user_id,
    'profile-cascade-' || cascade_user_id || '@example.invalid',
    'Profile Cascade User',
    'crew'
  );

  delete from auth.users where id = cascade_user_id;
  if exists (
    select 1
    from public.profiles
    where id = cascade_user_id
  ) then
    raise exception 'Auth deletion did not cascade to its base profile.';
  end if;

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
  ) values (
    restricted_owner_id,
    'authenticated',
    'authenticated',
    'yacht-restrict-' || restricted_owner_id || '@example.invalid',
    '',
    statement_timestamp(),
    '{}'::jsonb,
    '{}'::jsonb,
    statement_timestamp(),
    statement_timestamp()
  );

  insert into public.yachts (id, name, model, flag, owner_id)
  values (
    restricted_yacht_id,
    'Restricted Owner Yacht',
    'Test',
    'Malta',
    restricted_owner_id
  );

  rejected := false;
  begin
    delete from auth.users where id = restricted_owner_id;
  exception
    when foreign_key_violation then
      rejected := true;
  end;
  if not rejected
    or not exists (select 1 from auth.users where id = restricted_owner_id)
    or not exists (select 1 from public.yachts where id = restricted_yacht_id)
  then
    raise exception 'A yacht owner account was deleted without an explicit yacht lifecycle decision.';
  end if;

  delete from public.yachts where id = restricted_yacht_id;
  delete from auth.users where id = restricted_owner_id;

  if exists (
    select 1
    from pg_catalog.pg_constraint as constraint_row
    where constraint_row.conrelid = 'public.crew_members'::regclass
      and constraint_row.confrelid = 'auth.users'::regclass
      and constraint_row.contype = 'f'
  ) then
    raise exception 'A user lifecycle rule was invented for the unused crew_members prototype.';
  end if;
end;
$test$;

rollback;
