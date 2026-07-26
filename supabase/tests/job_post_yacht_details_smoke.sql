-- Transactional smoke test for normalized job-post yacht specifications.
-- All actors, listings and temporary trigger changes roll back.

begin;

set local timezone = 'UTC';

create temporary table job_post_yacht_details_smoke_ids (
  record_kind text primary key,
  record_id uuid not null,
  actor_id uuid not null
) on commit drop;

do $test$
declare
  owner_id uuid := gen_random_uuid();
  yacht_id uuid := gen_random_uuid();
  partial_job_id uuid;
  valid_job_id uuid;
  job_row public.job_posts%rowtype;
  missing_insert_rejected boolean := false;
  missing_publish_rejected boolean := false;
  invalid_type_rejected boolean := false;
  invalid_unit_rejected boolean := false;
  missing_unit_rejected boolean := false;
  zero_length_rejected boolean := false;
  oversized_length_rejected boolean := false;
begin
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
    'job-yacht-details-owner-' || owner_id || '@example.invalid',
    '',
    statement_timestamp(),
    '{}'::jsonb,
    jsonb_build_object('role', 'owner', 'full_name', 'Yacht Details Owner'),
    statement_timestamp(),
    statement_timestamp()
  );

  insert into public.profiles (id, email, full_name, role)
  values (
    owner_id,
    'job-yacht-details-owner-' || owner_id || '@example.invalid',
    'Yacht Details Owner',
    'owner'
  );

  insert into public.yachts (id, name, model, flag, owner_id)
  values (
    yacht_id,
    'Job Yacht Details Smoke Yacht',
    'Test 42',
    'Malta',
    owner_id
  );

  perform public.bluedeck_ensure_marketplace_entitlement(
    owner_id,
    'owner',
    'self_service'
  );

  -- Drafts may remain intentionally incomplete. Stable slugs are normalized
  -- before constraints run, while an absent length keeps its unit absent.
  insert into public.job_posts (
    yacht_id,
    created_by,
    updated_by,
    title,
    position,
    department,
    employment_type,
    location,
    yacht_type,
    summary,
    description,
    status
  )
  values (
    yacht_id,
    owner_id,
    owner_id,
    'Partial Yacht Details Draft',
    'Deckhand',
    'Deck',
    'seasonal',
    'Palma, Spain',
    '  CATAMARAN  ',
    'An intentionally incomplete private draft for yacht-detail validation.',
    'This private draft verifies that a publisher can save yacht type before entering the paired numeric length and display unit.',
    'draft'
  )
  returning * into job_row;

  partial_job_id := job_row.id;
  if job_row.yacht_type <> 'catamaran'
    or job_row.yacht_length is not null
    or job_row.yacht_length_unit is not null
  then
    raise exception 'A partial draft was not stored in normalized nullable form.';
  end if;

  begin
    insert into public.job_posts (
      yacht_id, created_by, updated_by, title, position, department,
      employment_type, location, summary, description, status
    )
    values (
      yacht_id, owner_id, owner_id, 'Missing Yacht Details Published',
      'Deckhand', 'Deck', 'seasonal', 'Palma, Spain',
      'A complete public summary whose yacht specifications are missing.',
      'This public description is deliberately complete so only the missing yacht specifications can reject publication.',
      'published'
    );
  exception
    when check_violation then
      missing_insert_rejected := true;
  end;

  if not missing_insert_rejected then
    raise exception 'A newly published listing omitted all yacht specifications.';
  end if;

  begin
    update public.job_posts
    set status = 'published',
        updated_by = owner_id
    where id = partial_job_id;
  exception
    when check_violation then
      missing_publish_rejected := true;
  end;

  if not missing_publish_rejected then
    raise exception 'An incomplete draft crossed the publication boundary.';
  end if;

  begin
    insert into public.job_posts (
      yacht_id, created_by, updated_by, title, position, department,
      employment_type, location, yacht_type, summary, description, status
    )
    values (
      yacht_id, owner_id, owner_id, 'Invalid Yacht Type Draft',
      'Deckhand', 'Deck', 'seasonal', 'Palma, Spain', 'hovercraft',
      'An invalid private draft used to verify the yacht-type domain.',
      'This draft must fail the stable yacht-type slug constraint before it can be saved.',
      'draft'
    );
  exception
    when check_violation then
      invalid_type_rejected := true;
  end;

  if not invalid_type_rejected then
    raise exception 'An unsupported yacht-type slug was stored.';
  end if;

  begin
    insert into public.job_posts (
      yacht_id, created_by, updated_by, title, position, department,
      employment_type, location, yacht_type, yacht_length,
      yacht_length_unit, summary, description, status
    )
    values (
      yacht_id, owner_id, owner_id, 'Invalid Yacht Unit Draft',
      'Deckhand', 'Deck', 'seasonal', 'Palma, Spain', 'motor_yacht', 42,
      'yards', 'An invalid private draft used to verify the length-unit domain.',
      'This draft must fail because yacht lengths may be represented only in metres or feet.',
      'draft'
    );
  exception
    when check_violation then
      invalid_unit_rejected := true;
  end;

  if not invalid_unit_rejected then
    raise exception 'An unsupported yacht-length unit was stored.';
  end if;

  begin
    insert into public.job_posts (
      yacht_id, created_by, updated_by, title, position, department,
      employment_type, location, yacht_type, yacht_length,
      summary, description, status
    )
    values (
      yacht_id, owner_id, owner_id, 'Missing Yacht Unit Draft',
      'Deckhand', 'Deck', 'seasonal', 'Palma, Spain', 'motor_yacht', 42,
      'An invalid private draft used to verify paired length storage.',
      'This draft must fail because a numeric yacht length always requires its display unit.',
      'draft'
    );
  exception
    when check_violation then
      missing_unit_rejected := true;
  end;

  if not missing_unit_rejected then
    raise exception 'A yacht length was stored without its unit.';
  end if;

  begin
    insert into public.job_posts (
      yacht_id, created_by, updated_by, title, position, department,
      employment_type, location, yacht_type, yacht_length,
      yacht_length_unit, summary, description, status
    )
    values (
      yacht_id, owner_id, owner_id, 'Zero Yacht Length Draft',
      'Deckhand', 'Deck', 'seasonal', 'Palma, Spain', 'motor_yacht', 0,
      'm', 'An invalid private draft used to verify positive yacht lengths.',
      'This draft must fail because a yacht length cannot be zero or negative.',
      'draft'
    );
  exception
    when check_violation then
      zero_length_rejected := true;
  end;

  if not zero_length_rejected then
    raise exception 'A zero yacht length was stored.';
  end if;

  begin
    insert into public.job_posts (
      yacht_id, created_by, updated_by, title, position, department,
      employment_type, location, yacht_type, yacht_length,
      yacht_length_unit, summary, description, status
    )
    values (
      yacht_id, owner_id, owner_id, 'Oversized Yacht Length Draft',
      'Deckhand', 'Deck', 'seasonal', 'Palma, Spain', 'commercial_vessel',
      1000.01, 'ft',
      'An invalid private draft used to verify the yacht-length upper bound.',
      'This draft must fail because the numeric yacht length exceeds the supported upper bound.',
      'draft'
    );
  exception
    when check_violation then
      oversized_length_rejected := true;
  end;

  if not oversized_length_rejected then
    raise exception 'An oversized yacht length was stored.';
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
    yacht_type,
    yacht_length,
    yacht_length_unit,
    summary,
    description,
    status
  )
  values (
    yacht_id,
    owner_id,
    owner_id,
    'Normalized Yacht Details Published',
    'Chief Engineer',
    'Engineering',
    'rotation',
    'Monaco',
    '  MOTOR_YACHT  ',
    27.50,
    ' FT ',
    'A complete public role used to verify normalized yacht specifications.',
    'This complete public description verifies normalized yacht type, numeric length, unit and immutable closure snapshots.',
    'published'
  )
  returning * into job_row;

  valid_job_id := job_row.id;
  if job_row.yacht_type <> 'motor_yacht'
    or job_row.yacht_length <> 27.50
    or job_row.yacht_length_unit <> 'ft'
  then
    raise exception 'A valid published yacht specification was not normalized.';
  end if;

  update public.job_posts
  set status = 'closed',
      yacht_type = 'commercial_vessel',
      yacht_length = 999,
      yacht_length_unit = 'm',
      updated_by = owner_id
  where id = valid_job_id
  returning * into job_row;

  if job_row.status <> 'closed'
    or job_row.yacht_type <> 'motor_yacht'
    or job_row.yacht_length <> 27.50
    or job_row.yacht_length_unit <> 'ft'
  then
    raise exception 'A terminal transition changed the yacht specification snapshot.';
  end if;

  insert into job_post_yacht_details_smoke_ids (
    record_kind,
    record_id,
    actor_id
  )
  values ('yacht', yacht_id, owner_id);
end;
$test$;

-- Recreate the only production-legacy shape: a listing published before yacht
-- details existed. The enforcement trigger is disabled only for this isolated
-- fixture and restored before any lifecycle assertion.
alter table public.job_posts
  disable trigger job_posts_y_yacht_details_guard;

do $test$
declare
  owner_id uuid;
  yacht_id uuid;
  legacy_job_id uuid;
begin
  select smoke.record_id, smoke.actor_id
  into yacht_id, owner_id
  from job_post_yacht_details_smoke_ids as smoke
  where smoke.record_kind = 'yacht';

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
    'Legacy Published Yacht Details Fixture',
    'Bosun',
    'Deck',
    'temporary',
    'Antibes, France',
    'A complete legacy role published before yacht specifications existed.',
    'This legacy fixture verifies that missing historical yacht details never block safe automatic expiry and archival.',
    'published'
  )
  returning id into legacy_job_id;

  insert into job_post_yacht_details_smoke_ids (
    record_kind,
    record_id,
    actor_id
  )
  values ('legacy_job', legacy_job_id, owner_id);
end;
$test$;

alter table public.job_posts
  enable trigger job_posts_y_yacht_details_guard;

do $test$
declare
  owner_id uuid;
  legacy_job_id uuid;
  legacy_edit_rejected boolean := false;
begin
  select smoke.record_id, smoke.actor_id
  into legacy_job_id, owner_id
  from job_post_yacht_details_smoke_ids as smoke
  where smoke.record_kind = 'legacy_job';

  begin
    update public.job_posts
    set summary = 'A legacy live listing cannot be saved without yacht details.',
        updated_by = owner_id
    where id = legacy_job_id;
  exception
    when check_violation then
      legacy_edit_rejected := true;
  end;

  if not legacy_edit_rejected then
    raise exception 'A saved published legacy listing remained incomplete.';
  end if;
end;
$test$;

-- Backdate only the isolated legacy fixture. Lifecycle and yacht-detail guards
-- are restored before invoking the real expiry worker.
alter table public.job_posts
  disable trigger job_posts_prepare_write;
alter table public.job_posts
  disable trigger job_posts_log_event;
alter table public.job_posts
  disable trigger job_posts_y_yacht_details_guard;

update public.job_posts as post
set created_at = statement_timestamp() - interval '2 months 1 day',
    published_at = statement_timestamp() - interval '2 months',
    closes_at = (
      (
        (statement_timestamp() - interval '2 months') at time zone 'UTC'
        + interval '1 month'
      ) at time zone 'UTC'
    ),
    updated_at = statement_timestamp() - interval '2 months',
    version = 1
from job_post_yacht_details_smoke_ids as smoke
where smoke.record_kind = 'legacy_job'
  and smoke.record_id = post.id;

alter table public.job_posts
  enable trigger job_posts_prepare_write;
alter table public.job_posts
  enable trigger job_posts_log_event;
alter table public.job_posts
  enable trigger job_posts_y_yacht_details_guard;

do $test$
declare
  legacy_job_id uuid;
  expired_count integer;
  job_row public.job_posts%rowtype;
begin
  select smoke.record_id
  into legacy_job_id
  from job_post_yacht_details_smoke_ids as smoke
  where smoke.record_kind = 'legacy_job';

  expired_count := private.bluedeck_expire_due_job_posts();
  if expired_count < 1 then
    raise exception 'The expiry worker did not archive the legacy published listing.';
  end if;

  select *
  into job_row
  from public.job_posts
  where id = legacy_job_id;

  if job_row.status <> 'closed'
    or job_row.closure_reason <> 'expired'
    or job_row.yacht_type is not null
    or job_row.yacht_length is not null
    or job_row.yacht_length_unit is not null
  then
    raise exception 'Legacy automatic closure did not preserve its nullable yacht snapshot.';
  end if;
end;
$test$;

rollback;
