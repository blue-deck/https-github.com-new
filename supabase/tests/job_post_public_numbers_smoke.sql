-- Transactional smoke test for immutable database-assigned job references.
-- Test rows are rolled back; sequence gaps remain intentionally non-reusable.

begin;

do $test$
declare
  owner_id uuid := gen_random_uuid();
  yacht_id uuid := gen_random_uuid();
  first_job_id uuid;
  second_job_id uuid;
  first_number text;
  second_number text;
  first_created_at timestamptz;
  second_created_at timestamptz;
  millionth_number text;
  explicit_number_rejected boolean := false;
  changed_number_rejected boolean := false;
begin
  millionth_number := format(
    'BDJ-2026-%s',
    lpad(
      1000000::text,
      greatest(6, length(1000000::text)),
      '0'
    )
  );

  if millionth_number <> 'BDJ-2026-1000000'
    or millionth_number !~ '^BDJ-[0-9]{4}-[1-9][0-9]{5,}$'
  then
    raise exception 'Public-number formatting truncates suffixes above six digits.';
  end if;

  if exists (
    select 1
    from public.job_posts as post
    where post.listing_number is null
      or post.listing_number !~ '^BDJ-[0-9]{4}-[1-9][0-9]{5,}$'
      or split_part(post.listing_number, '-', 2)
        <> to_char(post.created_at at time zone 'UTC', 'YYYY')
  ) then
    raise exception 'Existing job-post public-number backfill is incomplete.';
  end if;

  if not exists (
    select 1
    from information_schema.table_constraints as table_constraint
    inner join information_schema.key_column_usage as key_column
      on key_column.constraint_schema = table_constraint.constraint_schema
     and key_column.constraint_name = table_constraint.constraint_name
     and key_column.table_name = table_constraint.table_name
    where table_constraint.constraint_schema = 'public'
      and table_constraint.table_name = 'job_posts'
      and table_constraint.constraint_type = 'UNIQUE'
      and key_column.column_name = 'listing_number'
  ) then
    raise exception 'Job-post public numbers do not have a unique constraint.';
  end if;

  if not exists (
    select 1
    from information_schema.columns as column_record
    where column_record.table_schema = 'public'
      and column_record.table_name = 'job_posts'
      and column_record.column_name = 'listing_number'
      and column_record.is_nullable = 'NO'
  ) then
    raise exception 'Job-post public numbers must be non-null.';
  end if;

  if has_sequence_privilege(
      'anon',
      'public.job_posts_listing_number_seq',
      'USAGE'
    )
    or has_sequence_privilege(
      'authenticated',
      'public.job_posts_listing_number_seq',
      'USAGE'
    )
    or has_sequence_privilege(
      'service_role',
      'public.job_posts_listing_number_seq',
      'USAGE'
    )
    or has_function_privilege(
      'service_role',
      'public.prepare_job_post_listing_number()',
      'EXECUTE'
    )
  then
    raise exception 'Public-number allocation privileges are too broad.';
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
  values (
    owner_id,
    'authenticated',
    'authenticated',
    'public-number-owner-' || owner_id || '@example.invalid',
    '',
    now(),
    '{}'::jsonb,
    jsonb_build_object(
      'role', 'owner',
      'full_name', 'Public Number Owner'
    ),
    now(),
    now()
  );

  insert into public.profiles (id, email, full_name, role)
  values (
    owner_id,
    'public-number-owner-' || owner_id || '@example.invalid',
    'Public Number Owner',
    'owner'
  );

  insert into public.yachts (id, name, model, flag, owner_id)
  values (
    yacht_id,
    'Public Number Smoke Yacht',
    'Test 50',
    'Malta',
    owner_id
  );

  perform public.bluedeck_ensure_marketplace_entitlement(
    owner_id,
    'owner',
    'self_service'
  );

  insert into public.job_posts (
    yacht_id,
    created_by,
    updated_by,
    title,
    position,
    department,
    employment_type,
    location,
    summary,
    description,
    status
  )
  values (
    yacht_id,
    owner_id,
    owner_id,
    'Public Number Smoke Deckhand',
    'Deckhand',
    'Deck',
    'seasonal',
    'Palma, Spain',
    'A complete temporary role for public-number allocation testing.',
    'This temporary posting verifies that BlueDeck assigns a stable public job reference entirely within the database.',
    'draft'
  )
  returning id, listing_number, created_at
  into first_job_id, first_number, first_created_at;

  if first_number !~ '^BDJ-[0-9]{4}-[1-9][0-9]{5,}$'
    or split_part(first_number, '-', 2)
      <> to_char(first_created_at at time zone 'UTC', 'YYYY')
  then
    raise exception 'The first database-assigned public number is invalid.';
  end if;

  insert into public.job_posts (
    yacht_id,
    created_by,
    updated_by,
    title,
    position,
    department,
    employment_type,
    location,
    summary,
    description,
    status,
    created_at
  )
  values (
    yacht_id,
    owner_id,
    owner_id,
    'Second Public Number Smoke Deckhand',
    'Deckhand',
    'Deck',
    'temporary',
    'Antibes, France',
    'A second complete temporary role for allocation ordering tests.',
    'This second temporary posting verifies that concurrent-safe references remain distinct and monotonically allocated.',
    'draft',
    '2001-01-01 00:00:00+00'::timestamptz
  )
  returning id, listing_number, created_at
  into second_job_id, second_number, second_created_at;

  if second_number = first_number
    or split_part(second_number, '-', 3)::bigint
      <= split_part(first_number, '-', 3)::bigint
    or split_part(second_number, '-', 2)
      <> to_char(second_created_at at time zone 'UTC', 'YYYY')
    or split_part(second_number, '-', 2) = '2001'
  then
    raise exception 'Database-assigned public numbers are not authoritative, unique and monotonic.';
  end if;

  begin
    insert into public.job_posts (
      yacht_id,
      created_by,
      updated_by,
      listing_number,
      title,
      position,
      department,
      employment_type,
      location,
      summary,
      description,
      status
    )
    values (
      yacht_id,
      owner_id,
      owner_id,
      'BDJ-2099-999999',
      'Explicit Public Number Smoke',
      'Deckhand',
      'Deck',
      'temporary',
      'Monaco',
      'A complete temporary role that must fail before it is persisted.',
      'This attempted posting verifies that callers cannot reserve or choose a BlueDeck public job reference.',
      'draft'
    );
  exception
    when sqlstate '22023' then
      explicit_number_rejected := true;
  end;

  if not explicit_number_rejected then
    raise exception 'A caller supplied its own job-post public number.';
  end if;

  begin
    update public.job_posts
    set listing_number = 'BDJ-2099-999998',
        updated_by = owner_id
    where id = first_job_id;
  exception
    when sqlstate '22023' then
      changed_number_rejected := true;
  end;

  if not changed_number_rejected then
    raise exception 'An immutable job-post public number was changed.';
  end if;

  update public.job_posts
  set summary = 'An updated summary that must preserve the assigned public number.',
      updated_by = owner_id
  where id = first_job_id;

  if not exists (
    select 1
    from public.job_posts as post
    where post.id = first_job_id
      and post.listing_number = first_number
  ) then
    raise exception 'An ordinary job-post update changed its public number.';
  end if;
end;
$test$;

rollback;
