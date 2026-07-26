-- Transactional smoke test for shuffled, immutable five-digit job references.
-- All test users, yachts, jobs and slot claims are rolled back together.

begin;

do $test$
declare
  owner_id uuid := gen_random_uuid();
  yacht_id uuid := gen_random_uuid();
  first_job_id uuid;
  second_job_id uuid;
  first_number text;
  second_number text;
  available_before bigint;
  available_after bigint;
  allocated_test_count bigint;
  distinct_test_number_count bigint;
  explicit_number_rejected boolean := false;
  changed_number_rejected boolean := false;
  loop_index integer;
begin
  if (
    select count(*)
    from private.job_listing_number_slots
  ) <> 90000 then
    raise exception 'The five-digit job-reference inventory is incomplete.';
  end if;

  if exists (
    select 1
    from public.job_posts as post
    left join private.job_listing_number_slots as slot
      on slot.allocated_job_id = post.id
     and slot.listing_number::text = post.listing_number
    where post.listing_number is null
      or post.listing_number !~ '^[1-9][0-9]{4}$'
      or slot.listing_number is null
  ) then
    raise exception 'Existing job references or slot claims are invalid.';
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
    raise exception 'Job references do not have a unique constraint.';
  end if;

  if not exists (
    select 1
    from information_schema.columns as column_record
    where column_record.table_schema = 'public'
      and column_record.table_name = 'job_posts'
      and column_record.column_name = 'listing_number'
      and column_record.is_nullable = 'NO'
  ) then
    raise exception 'Job references must be non-null.';
  end if;

  if to_regclass('public.job_posts_listing_number_seq') is not null then
    raise exception 'The legacy sequential allocator still exists.';
  end if;

  if exists (
      select 1
      from unnest(
        array['anon', 'authenticated', 'service_role']::text[]
      ) as grantee(role_name)
      cross join unnest(
        array['SELECT', 'INSERT', 'UPDATE', 'DELETE']::text[]
      ) as requested(privilege_name)
      where has_table_privilege(
        grantee.role_name,
        'private.job_listing_number_slots',
        requested.privilege_name
      )
    )
    or has_function_privilege(
      'service_role',
      'public.prepare_job_post_listing_number()',
      'EXECUTE'
    )
  then
    raise exception 'Job-reference allocation privileges are too broad.';
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
    'five-digit-number-owner-' || owner_id || '@example.invalid',
    '',
    now(),
    '{}'::jsonb,
    jsonb_build_object(
      'role', 'owner',
      'full_name', 'Five Digit Number Owner'
    ),
    now(),
    now()
  );

  insert into public.profiles (id, email, full_name, role)
  values (
    owner_id,
    'five-digit-number-owner-' || owner_id || '@example.invalid',
    'Five Digit Number Owner',
    'owner'
  );

  insert into public.yachts (id, name, model, flag, owner_id)
  values (
    yacht_id,
    'Five Digit Number Smoke Yacht',
    'Test 50',
    'Malta',
    owner_id
  );

  perform public.bluedeck_ensure_marketplace_entitlement(
    owner_id,
    'owner',
    'self_service'
  );

  select count(*)
  into available_before
  from private.job_listing_number_slots as slot
  where slot.allocated_job_id is null;

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
    'Five Digit Number Smoke Deckhand 01',
    'Deckhand',
    'Deck',
    'seasonal',
    'Palma, Spain',
    'A complete temporary role for five-digit number allocation testing.',
    'This temporary posting verifies that BlueDeck assigns a shuffled five-digit public job reference entirely within the database.',
    'draft'
  )
  returning id, listing_number
  into first_job_id, first_number;

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
    'Five Digit Number Smoke Deckhand 02',
    'Deckhand',
    'Deck',
    'temporary',
    'Antibes, France',
    'A second complete temporary role for allocation uniqueness testing.',
    'This posting verifies that independently allocated public references remain distinct.',
    'draft'
  )
  returning id, listing_number
  into second_job_id, second_number;

  for loop_index in 3..20 loop
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
      'Five Digit Number Smoke Deckhand ' || lpad(loop_index::text, 2, '0'),
      'Deckhand',
      'Deck',
      'temporary',
      'Monaco',
      'A complete temporary role for bulk public-number allocation testing.',
      'This posting is part of a transactionally isolated uniqueness and format smoke test.',
      'draft'
    );
  end loop;

  if first_number !~ '^[1-9][0-9]{4}$'
    or second_number !~ '^[1-9][0-9]{4}$'
    or first_number = second_number
  then
    raise exception 'Database-assigned public job references are invalid.';
  end if;

  select
    count(*),
    count(distinct post.listing_number)
  into allocated_test_count, distinct_test_number_count
  from public.job_posts as post
  where post.created_by = owner_id;

  if allocated_test_count <> 20
    or distinct_test_number_count <> allocated_test_count
  then
    raise exception 'Bulk job-reference allocation is not unique.';
  end if;

  select count(*)
  into available_after
  from private.job_listing_number_slots as slot
  where slot.allocated_job_id is null;

  if available_after <> available_before - 20 then
    raise exception 'Job-reference slot claims do not match inserted jobs.';
  end if;

  if not exists (
    select 1
    from private.job_listing_number_slots as slot
    where slot.allocated_job_id = first_job_id
      and slot.listing_number::text = first_number
  ) then
    raise exception 'The first job does not own its allocated slot.';
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
      '10023',
      'Explicit Five Digit Number Smoke',
      'Deckhand',
      'Deck',
      'temporary',
      'Monaco',
      'A complete temporary role that must fail before it is persisted.',
      'This attempted posting verifies that callers cannot choose a public job reference.',
      'draft'
    );
  exception
    when sqlstate '22023' then
      explicit_number_rejected := true;
  end;

  if not explicit_number_rejected then
    raise exception 'A caller supplied its own public job reference.';
  end if;

  select count(*)
  into available_after
  from private.job_listing_number_slots as slot
  where slot.allocated_job_id is null;

  if available_after <> available_before - 20 then
    raise exception 'A rejected explicit reference consumed a slot.';
  end if;

  begin
    update public.job_posts
    set listing_number = '99999',
        updated_by = owner_id
    where id = first_job_id;
  exception
    when sqlstate '22023' then
      changed_number_rejected := true;
  end;

  if not changed_number_rejected then
    raise exception 'An immutable public job reference was changed.';
  end if;

  update public.job_posts
  set summary = 'An updated summary that must preserve the five-digit reference.',
      updated_by = owner_id
  where id = first_job_id;

  if not exists (
    select 1
    from public.job_posts as post
    where post.id = first_job_id
      and post.listing_number = first_number
  ) then
    raise exception 'An ordinary job update changed its public reference.';
  end if;

  if not exists (
    select 1
    from private.job_listing_number_slots as slot
    where slot.allocated_job_id = second_job_id
      and slot.listing_number::text = second_number
  ) then
    raise exception 'The second job does not retain its allocated slot.';
  end if;
end;
$test$;

rollback;
