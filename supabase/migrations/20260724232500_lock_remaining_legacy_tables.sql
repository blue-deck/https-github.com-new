-- Two additional unused prototype tables were created without RLS in the live
-- project. Keep them available to trusted maintenance jobs only.

begin;

do $$
declare
  target_table text;
  target_relation regclass;
  target_relkind text;
  policy_row record;
begin
  foreach target_table in array array[
    'crew_members',
    'maintenance_tasks'
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
