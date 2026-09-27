-- Run after the migration. All fixture messages roll back.
begin;

do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.contact_messages'::regclass) then
    raise exception 'contact_messages RLS must be enabled';
  end if;
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'contact_messages') then
    raise exception 'contact_messages must not have client policies';
  end if;
  if has_table_privilege('anon', 'public.contact_messages', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('authenticated', 'public.contact_messages', 'SELECT,INSERT,UPDATE,DELETE')
     or has_table_privilege('service_role', 'public.contact_messages', 'DELETE') then
    raise exception 'unexpected contact_messages table privileges';
  end if;
  if has_function_privilege('anon', 'public.submit_contact_message(text,text,text,text,text)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.submit_contact_message(text,text,text,text,text)', 'EXECUTE') then
    raise exception 'contact submission RPC must be service-only';
  end if;
end;
$$;

set local role service_role;

do $$
declare
  fixture_email text := 'contact-inbox-smoke-' || gen_random_uuid()::text || '@example.invalid';
  fixture_id uuid;
  previous_revision timestamptz;
  next_revision timestamptz;
  changed integer;
  missing_daily_messages integer;
begin
  fixture_id := public.submit_contact_message('Inbox smoke test', upper(fixture_email), 'general', 'Rollback-only inbox test.', 'en');
  perform public.submit_contact_message('Inbox smoke test', fixture_email, 'account', 'Rollback-only inbox test.', 'tr');
  perform public.submit_contact_message('Inbox smoke test', fixture_email, 'yacht-os', 'Rollback-only inbox test.', 'en');
  begin
    perform public.submit_contact_message('Inbox smoke test', fixture_email, 'recruitment', 'Must exceed quota.', 'en');
    raise exception 'Expected the durable per-email quota to reject the fourth message';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'contact_email_rate_limit' then raise; end if;
  end;

  select updated_at into strict previous_revision from public.contact_messages where id = fixture_id;
  update public.contact_messages set status = 'read' where id = fixture_id and updated_at = previous_revision
    returning updated_at into strict next_revision;
  if next_revision <= previous_revision then raise exception 'Revision must advance'; end if;
  update public.contact_messages set status = 'archived' where id = fixture_id and updated_at = previous_revision;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Stale revision must not update a message'; end if;

  begin
    update public.contact_messages set message = 'Must not replace sender content' where id = fixture_id;
    raise exception 'Expected immutable message fields to reject UPDATE';
  exception when insufficient_privilege then null;
  end;

  -- The submission advisory lock acquired above also isolates this fixture
  -- from real submissions until the enclosing transaction rolls back.
  select greatest(0, 1000 - count(*)::integer) into missing_daily_messages
    from public.contact_messages where created_at > clock_timestamp() - interval '24 hours';
  insert into public.contact_messages (name, email, topic, message, language)
    select 'Daily quota fixture', 'daily-' || gen_random_uuid()::text || '@example.invalid',
      'general', 'Rollback-only daily quota fixture.', 'en'
    from generate_series(1, missing_daily_messages);
  begin
    perform public.submit_contact_message('Inbox smoke test', 'daily-final-' || fixture_email, 'general', 'Must exceed daily quota.', 'en');
    raise exception 'Expected the durable daily quota to reject the extra message';
  exception when sqlstate 'P0001' then
    if sqlerrm <> 'contact_global_rate_limit' then raise; end if;
  end;
end;
$$;

rollback;
