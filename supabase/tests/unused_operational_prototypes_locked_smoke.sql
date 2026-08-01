begin;

do $test$
declare
  target_table text;
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
    if has_table_privilege('authenticated', format('public.%I', target_table), 'select')
      or has_table_privilege('authenticated', format('public.%I', target_table), 'insert')
      or has_table_privilege('authenticated', format('public.%I', target_table), 'update')
      or has_table_privilege('authenticated', format('public.%I', target_table), 'delete')
    then
      raise exception 'Authenticated privilege remains on %', target_table;
    end if;
    if not has_table_privilege('service_role', format('public.%I', target_table), 'select')
      or not has_table_privilege('service_role', format('public.%I', target_table), 'insert')
      or not has_table_privilege('service_role', format('public.%I', target_table), 'update')
      or not has_table_privilege('service_role', format('public.%I', target_table), 'delete')
    then
      raise exception 'Service maintenance privilege missing on %', target_table;
    end if;
  end loop;
end;
$test$;

rollback;
