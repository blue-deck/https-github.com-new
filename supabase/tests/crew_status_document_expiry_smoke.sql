-- Transactional adversarial smoke test for the crew-profile lifecycle status
-- and automatic yacht-document expiry-alert migrations. Every fixture rolls
-- back, including the Auth identities used by later identity constraints.

begin;

set local timezone = 'UTC';

do $test$
declare
  crew_user_id uuid := gen_random_uuid();
  owner_user_id uuid := gen_random_uuid();
  crew_profile_id uuid := gen_random_uuid();
  yacht_id uuid := gen_random_uuid();
  document_id public.yacht_documents.id%type := gen_random_uuid();
  first_alert_id public.expiry_alerts.id%type;
  status_default text;
  status_not_null boolean;
  inserted_status text;
  status_index_columns text[];
  status_index_predicate text;
  status_index_valid boolean;
  status_index_unique boolean;
  document_index_columns text[];
  document_index_predicate text;
  document_index_valid boolean;
  document_index_unique boolean;
  active_index_columns text[];
  active_index_predicate text;
  active_index_valid boolean;
  active_index_unique boolean;
  trigger_update_columns text[];
  trigger_count integer;
  alert_row public.expiry_alerts%rowtype;
  null_status_rejected boolean := false;
  duplicate_alert_rejected boolean := false;
begin
  select
    pg_catalog.pg_get_expr(default_row.adbin, default_row.adrelid),
    column_row.attnotnull
  into status_default, status_not_null
  from pg_catalog.pg_attribute as column_row
  left join pg_catalog.pg_attrdef as default_row
    on default_row.adrelid = column_row.attrelid
    and default_row.adnum = column_row.attnum
  where column_row.attrelid = 'public.crew_profiles'::regclass
    and column_row.attname = 'status'
    and not column_row.attisdropped;

  if not found then
    raise exception 'crew_profiles.status is missing.';
  end if;

  if not status_not_null
    or status_default is null
    or pg_catalog.regexp_replace(status_default, '[[:space:]]+', '', 'g')
      not in ('''active''::text', '''active''')
  then
    raise exception
      'crew_profiles.status is not NOT NULL with the active default: default=%, not_null=%',
      status_default,
      status_not_null;
  end if;

  -- The migration must have normalized every legacy NULL/blank lifecycle row.
  if exists (
    select 1
    from public.crew_profiles as profile
    where profile.status is null
      or btrim(profile.status) = ''
  ) then
    raise exception 'The crew-profile status backfill left a NULL/blank row.';
  end if;

  select
    index_row.indisvalid and index_row.indisready,
    index_row.indisunique,
    pg_catalog.pg_get_expr(index_row.indpred, index_row.indrelid),
    array(
      select attribute.attname
      from unnest(index_row.indkey) with ordinality
        as key_column(attnum, ordinality)
      inner join pg_catalog.pg_attribute as attribute
        on attribute.attrelid = index_row.indrelid
        and attribute.attnum = key_column.attnum
      where key_column.attnum > 0
      order by key_column.ordinality
    )
  into
    status_index_valid,
    status_index_unique,
    status_index_predicate,
    status_index_columns
  from pg_catalog.pg_index as index_row
  where index_row.indexrelid =
    to_regclass('public.crew_profiles_active_directory_idx');

  if not found
    or not status_index_valid
    or status_index_unique
    or status_index_columns is distinct from array['public_crew_id', 'user_id']::text[]
    or status_index_predicate is null
    or pg_catalog.regexp_replace(
      lower(status_index_predicate),
      '[[:space:]()]',
      '',
      'g'
    ) <> 'status=''active''::text'
  then
    raise exception
      'The active crew-directory index is missing or malformed: columns=%, predicate=%',
      status_index_columns,
      status_index_predicate;
  end if;

  select
    index_row.indisvalid and index_row.indisready,
    index_row.indisunique,
    pg_catalog.pg_get_expr(index_row.indpred, index_row.indrelid),
    array(
      select attribute.attname
      from unnest(index_row.indkey) with ordinality
        as key_column(attnum, ordinality)
      inner join pg_catalog.pg_attribute as attribute
        on attribute.attrelid = index_row.indrelid
        and attribute.attnum = key_column.attnum
      where key_column.attnum > 0
      order by key_column.ordinality
    )
  into
    document_index_valid,
    document_index_unique,
    document_index_predicate,
    document_index_columns
  from pg_catalog.pg_index as index_row
  where index_row.indexrelid =
    to_regclass('public.expiry_alerts_document_source_unique_idx');

  if not found
    or not document_index_valid
    or not document_index_unique
    or document_index_columns is distinct from array['source_type', 'source_id']::text[]
    or document_index_predicate is null
    or pg_catalog.regexp_replace(
      lower(document_index_predicate),
      '[[:space:]()]',
      '',
      'g'
    ) <> 'source_type=''document''::textandsource_idisnotnull'
  then
    raise exception
      'The document-alert uniqueness index is missing or malformed: columns=%, predicate=%',
      document_index_columns,
      document_index_predicate;
  end if;

  select
    index_row.indisvalid and index_row.indisready,
    index_row.indisunique,
    pg_catalog.pg_get_expr(index_row.indpred, index_row.indrelid),
    array(
      select attribute.attname
      from unnest(index_row.indkey) with ordinality
        as key_column(attnum, ordinality)
      inner join pg_catalog.pg_attribute as attribute
        on attribute.attrelid = index_row.indrelid
        and attribute.attnum = key_column.attnum
      where key_column.attnum > 0
      order by key_column.ordinality
    )
  into
    active_index_valid,
    active_index_unique,
    active_index_predicate,
    active_index_columns
  from pg_catalog.pg_index as index_row
  where index_row.indexrelid =
    to_regclass('public.expiry_alerts_active_window_idx');

  if not found
    or not active_index_valid
    or active_index_unique
    or active_index_columns is distinct from array['yacht_id', 'expiry_date']::text[]
    or active_index_predicate is null
    or pg_catalog.regexp_replace(
      lower(active_index_predicate),
      '[[:space:]()]',
      '',
      'g'
    ) <> 'status<>''resolved''::text'
  then
    raise exception
      'The active expiry-window index is missing or malformed: columns=%, predicate=%',
      active_index_columns,
      active_index_predicate;
  end if;

  if to_regprocedure(
      'private.bluedeck_sync_yacht_document_expiry_alert()'
    ) is null
    or not exists (
      select 1
      from pg_catalog.pg_proc as procedure
      where procedure.oid =
        'private.bluedeck_sync_yacht_document_expiry_alert()'::regprocedure
        and procedure.prorettype = 'trigger'::regtype
        and procedure.prosecdef
        and procedure.proconfig @>
          array['search_path=pg_catalog, public']::text[]
    )
  then
    raise exception
      'The document-alert trigger function is missing or not hardened.';
  end if;

  if has_function_privilege(
      'anon',
      'private.bluedeck_sync_yacht_document_expiry_alert()',
      'execute'
    )
    or has_function_privilege(
      'authenticated',
      'private.bluedeck_sync_yacht_document_expiry_alert()',
      'execute'
    )
    or not has_function_privilege(
      'service_role',
      'private.bluedeck_sync_yacht_document_expiry_alert()',
      'execute'
    )
  then
    raise exception 'The document-alert trigger function ACLs are unsafe.';
  end if;

  select count(*)
  into trigger_count
  from pg_catalog.pg_trigger as trigger
  where trigger.tgrelid = 'public.yacht_documents'::regclass
    and trigger.tgname = 'yacht_documents_sync_expiry_alert'
    and not trigger.tgisinternal;

  if trigger_count <> 1 then
    raise exception
      'Expected exactly one yacht-document alert trigger, found %.',
      trigger_count;
  end if;

  select array(
    select attribute.attname
    from unnest(trigger.tgattr) with ordinality
      as trigger_column(attnum, ordinality)
    inner join pg_catalog.pg_attribute as attribute
      on attribute.attrelid = trigger.tgrelid
      and attribute.attnum = trigger_column.attnum
    where trigger_column.attnum > 0
    order by trigger_column.ordinality
  )
  into trigger_update_columns
  from pg_catalog.pg_trigger as trigger
  where trigger.tgrelid = 'public.yacht_documents'::regclass
    and trigger.tgname = 'yacht_documents_sync_expiry_alert'
    and not trigger.tgisinternal
    and trigger.tgenabled = 'O'
    and trigger.tgfoid =
      'private.bluedeck_sync_yacht_document_expiry_alert()'::regprocedure
    and (trigger.tgtype::integer & 1) = 1
    and (trigger.tgtype::integer & 2) = 0
    and (trigger.tgtype::integer & 4) = 4
    and (trigger.tgtype::integer & 8) = 8
    and (trigger.tgtype::integer & 16) = 16
    and (trigger.tgtype::integer & 32) = 0
    and (trigger.tgtype::integer & 64) = 0;

  if not found
    or trigger_update_columns is distinct from
      array['title', 'file_name', 'expiry_date']::text[]
  then
    raise exception
      'The yacht-document alert trigger event/column shape is malformed: %',
      trigger_update_columns;
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
  )
  values
    (
      crew_user_id,
      'authenticated',
      'authenticated',
      'crew-status-smoke-' || crew_user_id || '@example.invalid',
      '',
      statement_timestamp(),
      '{}'::jsonb,
      jsonb_build_object('role', 'crew', 'full_name', 'Status Smoke Crew'),
      statement_timestamp(),
      statement_timestamp()
    ),
    (
      owner_user_id,
      'authenticated',
      'authenticated',
      'document-alert-smoke-' || owner_user_id || '@example.invalid',
      '',
      statement_timestamp(),
      '{}'::jsonb,
      jsonb_build_object('role', 'owner', 'full_name', 'Alert Smoke Owner'),
      statement_timestamp(),
      statement_timestamp()
    );

  insert into public.profiles (id, email, full_name, role)
  values
    (
      crew_user_id,
      'crew-status-smoke-' || crew_user_id || '@example.invalid',
      'Status Smoke Crew',
      'crew'
    ),
    (
      owner_user_id,
      'document-alert-smoke-' || owner_user_id || '@example.invalid',
      'Alert Smoke Owner',
      'owner'
    );

  -- Omitting status exercises the installed default instead of restating it.
  insert into public.crew_profiles (
    id,
    user_id,
    public_crew_id,
    full_name,
    email,
    current_position
  )
  values (
    crew_profile_id,
    crew_user_id,
    'STATUS-SMOKE-' || upper(left(crew_profile_id::text, 8)),
    'Status Smoke Crew',
    'crew-status-smoke-' || crew_user_id || '@example.invalid',
    'Deckhand'
  )
  returning status into inserted_status;

  if inserted_status <> 'active' then
    raise exception
      'A status-omitting crew profile did not default to active: %',
      inserted_status;
  end if;

  begin
    update public.crew_profiles
    set status = null
    where id = crew_profile_id;
  exception
    when not_null_violation then
      null_status_rejected := true;
  end;

  if not null_status_rejected then
    raise exception 'crew_profiles.status accepted NULL after migration.';
  end if;

  insert into public.yachts (id, name, model, flag, owner_id)
  values (
    yacht_id,
    'Document Expiry Smoke Yacht',
    'Test 50',
    'Malta',
    owner_user_id
  );

  insert into public.yacht_documents (
    id,
    yacht_id,
    title,
    category,
    expiry_date,
    file_url,
    file_name,
    uploaded_by
  )
  values (
    document_id,
    yacht_id,
    '   ',
    'License',
    current_date + 10,
    yacht_id::text || '/document-expiry-smoke.pdf',
    'document-expiry-smoke.pdf',
    owner_user_id
  );

  select alert.*
  into alert_row
  from public.expiry_alerts as alert
  where alert.source_type = 'document'
    and alert.source_id = document_id;

  if not found
    or alert_row.yacht_id is distinct from yacht_id
    or alert_row.title is distinct from 'document-expiry-smoke.pdf'
    or alert_row.expiry_date is distinct from current_date + 10
    or alert_row.alert_level is distinct from 'critical'
    or alert_row.status is distinct from 'active'
  then
    raise exception
      'Document INSERT did not create the canonical critical alert: %',
      to_jsonb(alert_row);
  end if;

  first_alert_id := alert_row.id;

  begin
    insert into public.expiry_alerts (
      yacht_id,
      source_type,
      source_id,
      title,
      expiry_date,
      alert_level,
      status
    )
    values (
      yacht_id,
      'document',
      document_id,
      'Forged duplicate alert',
      current_date + 90,
      'normal',
      'active'
    );
  exception
    when unique_violation then
      duplicate_alert_rejected := true;
  end;

  if not duplicate_alert_rejected
    or (
      select count(*)
      from public.expiry_alerts as alert
      where alert.source_type = 'document'
        and alert.source_id = document_id
    ) <> 1
  then
    raise exception 'A duplicate alert was accepted for one yacht document.';
  end if;

  update public.expiry_alerts
  set status = 'resolved'
  where id = first_alert_id;

  update public.yacht_documents
  set title = '  Renewed Registry Certificate  '
  where id = document_id;

  select alert.*
  into strict alert_row
  from public.expiry_alerts as alert
  where alert.source_type = 'document'
    and alert.source_id = document_id;

  if alert_row.id is distinct from first_alert_id
    or alert_row.title is distinct from 'Renewed Registry Certificate'
    or alert_row.expiry_date is distinct from current_date + 10
    or alert_row.alert_level is distinct from 'critical'
    or alert_row.status is distinct from 'resolved'
  then
    raise exception
      'A same-expiry document update did not preserve the resolved alert: %',
      to_jsonb(alert_row);
  end if;

  update public.yacht_documents
  set expiry_date = current_date + 25
  where id = document_id;

  select alert.*
  into strict alert_row
  from public.expiry_alerts as alert
  where alert.source_type = 'document'
    and alert.source_id = document_id;

  if alert_row.id is distinct from first_alert_id
    or alert_row.expiry_date is distinct from current_date + 25
    or alert_row.alert_level is distinct from 'warning'
    or alert_row.status is distinct from 'active'
  then
    raise exception
      'An expiry-date change did not update/reactivate the canonical alert: %',
      to_jsonb(alert_row);
  end if;

  update public.expiry_alerts
  set status = 'resolved'
  where id = first_alert_id;

  update public.yacht_documents
  set title = null,
      file_name = 'renamed-document.pdf'
  where id = document_id;

  select alert.*
  into strict alert_row
  from public.expiry_alerts as alert
  where alert.source_type = 'document'
    and alert.source_id = document_id;

  if alert_row.id is distinct from first_alert_id
    or alert_row.title is distinct from 'renamed-document.pdf'
    or alert_row.status is distinct from 'resolved'
  then
    raise exception
      'A same-expiry filename fallback update lost resolved state: %',
      to_jsonb(alert_row);
  end if;

  update public.yacht_documents
  set expiry_date = null
  where id = document_id;

  if exists (
    select 1
    from public.expiry_alerts as alert
    where alert.source_type = 'document'
      and alert.source_id = document_id
  ) then
    raise exception 'A NULL document expiry retained its automatic alert.';
  end if;

  update public.yacht_documents
  set expiry_date = current_date - 1
  where id = document_id;

  select alert.*
  into strict alert_row
  from public.expiry_alerts as alert
  where alert.source_type = 'document'
    and alert.source_id = document_id;

  if alert_row.alert_level is distinct from 'expired'
    or alert_row.status is distinct from 'active'
    or alert_row.expiry_date is distinct from current_date - 1
  then
    raise exception
      'Restoring an expired date did not recreate an expired active alert: %',
      to_jsonb(alert_row);
  end if;

  update public.expiry_alerts
  set status = 'resolved'
  where id = alert_row.id;

  delete from public.yacht_documents
  where id = document_id;

  if exists (
    select 1
    from public.expiry_alerts as alert
    where alert.source_type = 'document'
      and alert.source_id = document_id
  ) then
    raise exception 'Deleting a yacht document retained its resolved alert.';
  end if;
end;
$test$;

rollback;
