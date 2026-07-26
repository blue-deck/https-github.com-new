-- Fail closed on legacy public tables that are not used by the current
-- application. These tables previously retained unconditional PUBLIC policies
-- and broad authenticated grants from older prototypes.
--
-- Re-enable a table only with a dedicated, reviewed tenant policy migration.
-- Safe to re-run and safe when an older environment does not contain every
-- allowlisted table.

begin;

do $$
declare
  target_table text;
  target_relation regclass;
  target_relkind text;
  policy_row record;
begin
  foreach target_table in array array[
    'ai_insights',
    'ais_targets',
    'anchor_watch',
    'app_users',
    'captain_logs',
    'checklist_items',
    'checklists',
    'command_alerts',
    'crew_assignments',
    'crew_members',
    'crew_role_assignments',
    'crew_shift_logs',
    'crew_tasks',
    'crews',
    'engineering_service_logs',
    'finance_items',
    'global_notifications',
    'guest_profiles',
    'inventory_items',
    'marina_operations',
    'maintenance_tasks',
    'notifications',
    'operation_reports',
    'owner_preparations',
    'owner_updates',
    'role_assignments',
    'user_profiles',
    'voyage_plans',
    'voyages',
    'watchkeeping_duties',
    'watchkeeping_logs',
    'watchkeeping_rota',
    'weather_snapshots',
    'yacht_reports'
  ]
  loop
    target_relation := to_regclass(format('public.%I', target_table));
    if target_relation is null then
      continue;
    end if;

    select relation.relkind
    into target_relkind
    from pg_catalog.pg_class as relation
    where relation.oid = target_relation;

    if target_relkind is null or target_relkind not in ('r', 'p') then
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

    execute format(
      'alter table public.%I enable row level security',
      target_table
    );
    execute format(
      'alter table public.%I force row level security',
      target_table
    );
    execute format(
      'revoke all privileges on table public.%I '
      'from public, anon, authenticated',
      target_table
    );
    execute format(
      'grant all privileges on table public.%I to service_role',
      target_table
    );
  end loop;
end;
$$;

commit;
