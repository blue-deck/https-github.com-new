-- The current application has no read or write path for these operational
-- prototype tables. Remove their direct browser attack surface until a real,
-- bounded server workflow is designed and reviewed for each module.

begin;

do $block$
declare
  target_table text;
  policy_row record;
begin
  foreach target_table in array array[
    'bluedeck_events',
    'captain_logbook',
    'engine_hours',
    'engine_logs',
    'engineering_assets',
    'fuel_logs',
    'guest_requests',
    'maintenance_logs',
    'maintenance_schedules',
    'quick_engine_reports',
    'yacht_expenses',
    'yacht_positions',
    'yacht_status'
  ]
  loop
    if to_regclass(format('public.%I', target_table)) is null then
      continue;
    end if;

    for policy_row in
      select policyname
      from pg_catalog.pg_policies
      where schemaname = 'public'
        and tablename = target_table
    loop
      execute format(
        'drop policy if exists %I on public.%I',
        policy_row.policyname,
        target_table
      );
    end loop;

    execute format('alter table public.%I enable row level security', target_table);
    execute format('alter table public.%I force row level security', target_table);
    execute format(
      'revoke all privileges on table public.%I from public, anon, authenticated',
      target_table
    );
    execute format(
      'grant all privileges on table public.%I to service_role',
      target_table
    );
  end loop;
end;
$block$;

commit;
