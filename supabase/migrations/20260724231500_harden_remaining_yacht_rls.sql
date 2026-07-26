-- Least-privilege RLS for the yacht operational tables used directly by the
-- browser application.
--
-- Dependency:
--   20260724223000_harden_core_rls.sql must run first because this migration
--   reuses its immutable-owner and active-membership predicates.
--
-- Access model:
--   * service_role keeps full maintenance access;
--   * anon has no table privileges or policies;
--   * the yacht owner may manage every row belonging to their yacht;
--   * active crew may read operational/engineering data needed onboard;
--   * active crew writes are limited to the narrow workflows used by the UI;
--   * financial, captain-only and owner-presence data remains owner-only.
--
-- Safe to re-run:
--   * every policy on the managed tables is removed by catalog lookup;
--   * the shared guard function and per-table triggers are replaced;
--   * grants, policies and indexes are reset deterministically.

begin;

do $block$
begin
  if to_regprocedure('private.bluedeck_is_yacht_owner(uuid)') is null
    or to_regprocedure('private.bluedeck_is_active_yacht_member(uuid)') is null
    or to_regprocedure('private.bluedeck_has_yacht_access(uuid)') is null
  then
    raise exception using
      errcode = '55000',
      message = 'Run 20260724223000_harden_core_rls.sql before hardening operational yacht tables.';
  end if;
end;
$block$;

-- RLS checks old and new rows independently, but cannot compare them. This
-- guard makes yacht tenancy immutable for browser users and limits non-owner
-- updates to the exact fields exposed by collaborative operational screens.
create or replace function private.bluedeck_guard_operational_yacht_row()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  target_maintenance_id uuid;
begin
  -- Database maintenance and trusted server routes retain repair/migration
  -- authority. Browser requests always have auth.uid().
  if auth.uid() is null or auth.role() = 'service_role' then
    return new;
  end if;

  if new.yacht_id is null then
    raise exception using
      errcode = '23502',
      message = 'Operational records require a yacht.';
  end if;

  if tg_op = 'UPDATE' and new.yacht_id is distinct from old.yacht_id then
    raise exception using
      errcode = '42501',
      message = 'An operational record cannot be moved to another yacht.';
  end if;

  -- A completion log must reference a maintenance schedule on the same yacht.
  -- The service role may still repair legacy data because it returns above.
  if tg_table_name = 'maintenance_logs' then
    target_maintenance_id :=
      nullif(to_jsonb(new) ->> 'maintenance_id', '')::uuid;

    if target_maintenance_id is not null
      and not exists (
        select 1
        from public.maintenance_schedules as schedule
        where schedule.id = target_maintenance_id
          and schedule.yacht_id = new.yacht_id
      )
    then
      raise exception using
        errcode = '23514',
        message = 'Maintenance log and schedule must belong to the same yacht.';
    end if;
  end if;

  if tg_op = 'UPDATE'
    and not private.bluedeck_is_yacht_owner(old.yacht_id)
  then
    if tg_table_name in (
      'bluedeck_events',
      'guest_requests',
      'quick_engine_reports'
    ) then
      if (
        to_jsonb(new) - array['status']::text[]
      ) is distinct from (
        to_jsonb(old) - array['status']::text[]
      ) then
        raise exception using
          errcode = '42501',
          message = 'Crew may update only the workflow status.';
      end if;
    elsif tg_table_name = 'engineering_assets' then
      if (
        to_jsonb(new) - array['current_hours']::text[]
      ) is distinct from (
        to_jsonb(old) - array['current_hours']::text[]
      ) then
        raise exception using
          errcode = '42501',
          message = 'Crew may update only current engineering hours.';
      end if;
    elsif tg_table_name = 'maintenance_schedules' then
      if (
        to_jsonb(new) - array[
          'last_done_hours',
          'last_done_date',
          'next_due_hours',
          'next_due_date',
          'status'
        ]::text[]
      ) is distinct from (
        to_jsonb(old) - array[
          'last_done_hours',
          'last_done_date',
          'next_due_hours',
          'next_due_date',
          'status'
        ]::text[]
      ) then
        raise exception using
          errcode = '42501',
          message = 'Crew may update only maintenance completion fields.';
      end if;
    else
      raise exception using
        errcode = '42501',
        message = 'Only the yacht owner may update this operational record.';
    end if;
  end if;

  return new;
end;
$function$;

revoke all on function private.bluedeck_guard_operational_yacht_row()
  from public, anon, authenticated;
grant execute on function private.bluedeck_guard_operational_yacht_row()
  to service_role;

-- Enable and force RLS, install the tenant guard and remove every legacy
-- policy. Catalog-driven removal also catches policy-name drift between
-- environments and makes re-running this migration deterministic.
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
    execute format(
      'alter table public.%I enable row level security',
      target_table
    );
    execute format(
      'alter table public.%I force row level security',
      target_table
    );
    execute format(
      'drop trigger if exists bluedeck_guard_operational_yacht_row on public.%I',
      target_table
    );
    execute format(
      'create trigger bluedeck_guard_operational_yacht_row '
      'before insert or update on public.%I '
      'for each row execute function '
      'private.bluedeck_guard_operational_yacht_row()',
      target_table
    );

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
  end loop;
end;
$block$;

-- Grants define which operations can reach RLS. In particular, authenticated
-- users no longer inherit TRUNCATE, REFERENCES or TRIGGER privileges.
revoke all privileges on table
  public.bluedeck_events,
  public.captain_logbook,
  public.engine_hours,
  public.engine_logs,
  public.engineering_assets,
  public.fuel_logs,
  public.guest_requests,
  public.maintenance_logs,
  public.maintenance_schedules,
  public.quick_engine_reports,
  public.yacht_expenses,
  public.yacht_positions,
  public.yacht_status
from public, anon, authenticated, service_role;

grant select, insert, update, delete on table
  public.bluedeck_events,
  public.captain_logbook,
  public.engine_hours,
  public.engine_logs,
  public.engineering_assets,
  public.fuel_logs,
  public.guest_requests,
  public.maintenance_logs,
  public.maintenance_schedules,
  public.quick_engine_reports,
  public.yacht_expenses,
  public.yacht_positions,
  public.yacht_status
to authenticated;

grant all privileges on table
  public.bluedeck_events,
  public.captain_logbook,
  public.engine_hours,
  public.engine_logs,
  public.engineering_assets,
  public.fuel_logs,
  public.guest_requests,
  public.maintenance_logs,
  public.maintenance_schedules,
  public.quick_engine_reports,
  public.yacht_expenses,
  public.yacht_positions,
  public.yacht_status
to service_role;

-- The immutable auth.users yacht owner can manage every operational row on
-- their yacht. These owner policies also supply owner-only reads for financial,
-- captain-log and owner-presence records.
create policy bluedeck_events_owner_manage
on public.bluedeck_events
for all
to authenticated
using (private.bluedeck_is_yacht_owner(yacht_id))
with check (private.bluedeck_is_yacht_owner(yacht_id));

create policy bluedeck_captain_logbook_owner_manage
on public.captain_logbook
for all
to authenticated
using (private.bluedeck_is_yacht_owner(yacht_id))
with check (private.bluedeck_is_yacht_owner(yacht_id));

create policy bluedeck_engine_hours_owner_manage
on public.engine_hours
for all
to authenticated
using (private.bluedeck_is_yacht_owner(yacht_id))
with check (private.bluedeck_is_yacht_owner(yacht_id));

create policy bluedeck_engine_logs_owner_manage
on public.engine_logs
for all
to authenticated
using (private.bluedeck_is_yacht_owner(yacht_id))
with check (private.bluedeck_is_yacht_owner(yacht_id));

create policy bluedeck_engineering_assets_owner_manage
on public.engineering_assets
for all
to authenticated
using (private.bluedeck_is_yacht_owner(yacht_id))
with check (private.bluedeck_is_yacht_owner(yacht_id));

create policy bluedeck_fuel_logs_owner_manage
on public.fuel_logs
for all
to authenticated
using (private.bluedeck_is_yacht_owner(yacht_id))
with check (private.bluedeck_is_yacht_owner(yacht_id));

create policy bluedeck_guest_requests_owner_manage
on public.guest_requests
for all
to authenticated
using (private.bluedeck_is_yacht_owner(yacht_id))
with check (private.bluedeck_is_yacht_owner(yacht_id));

create policy bluedeck_maintenance_logs_owner_manage
on public.maintenance_logs
for all
to authenticated
using (private.bluedeck_is_yacht_owner(yacht_id))
with check (private.bluedeck_is_yacht_owner(yacht_id));

create policy bluedeck_maintenance_schedules_owner_manage
on public.maintenance_schedules
for all
to authenticated
using (private.bluedeck_is_yacht_owner(yacht_id))
with check (private.bluedeck_is_yacht_owner(yacht_id));

create policy bluedeck_quick_engine_reports_owner_manage
on public.quick_engine_reports
for all
to authenticated
using (private.bluedeck_is_yacht_owner(yacht_id))
with check (private.bluedeck_is_yacht_owner(yacht_id));

create policy bluedeck_yacht_expenses_owner_manage
on public.yacht_expenses
for all
to authenticated
using (private.bluedeck_is_yacht_owner(yacht_id))
with check (private.bluedeck_is_yacht_owner(yacht_id));

create policy bluedeck_yacht_positions_owner_manage
on public.yacht_positions
for all
to authenticated
using (private.bluedeck_is_yacht_owner(yacht_id))
with check (private.bluedeck_is_yacht_owner(yacht_id));

create policy bluedeck_yacht_status_owner_manage
on public.yacht_status
for all
to authenticated
using (private.bluedeck_is_yacht_owner(yacht_id))
with check (private.bluedeck_is_yacht_owner(yacht_id));

-- Active crew may see only non-sensitive BlueDeck OS modules. Owner itinerary,
-- charter, signatures, fuel analytics, payroll and expense approvals stay
-- owner-only despite sharing the same catch-all table.
create policy bluedeck_events_crew_select
on public.bluedeck_events
for select
to authenticated
using (
  private.bluedeck_is_active_yacht_member(yacht_id)
  and lower(btrim(coalesce(module, ''))) in (
    'ais',
    'weather',
    'alarm',
    'engineer work order',
    'inventory',
    'qr stock',
    'offline sync',
    'photo defect',
    'maintenance calendar',
    'service prediction',
    'voyage risk',
    'multilingual'
  )
);

create policy bluedeck_events_crew_insert
on public.bluedeck_events
for insert
to authenticated
with check (
  private.bluedeck_is_active_yacht_member(yacht_id)
  and lower(btrim(coalesce(module, ''))) in (
    'ais',
    'weather',
    'alarm',
    'engineer work order',
    'inventory',
    'qr stock',
    'offline sync',
    'photo defect',
    'maintenance calendar',
    'service prediction',
    'voyage risk',
    'multilingual'
  )
);

create policy bluedeck_events_crew_update_status
on public.bluedeck_events
for update
to authenticated
using (
  private.bluedeck_is_active_yacht_member(yacht_id)
  and lower(btrim(coalesce(module, ''))) in (
    'ais',
    'weather',
    'alarm',
    'engineer work order',
    'inventory',
    'qr stock',
    'offline sync',
    'photo defect',
    'maintenance calendar',
    'service prediction',
    'voyage risk',
    'multilingual'
  )
)
with check (
  private.bluedeck_is_active_yacht_member(yacht_id)
  and lower(btrim(coalesce(module, ''))) in (
    'ais',
    'weather',
    'alarm',
    'engineer work order',
    'inventory',
    'qr stock',
    'offline sync',
    'photo defect',
    'maintenance calendar',
    'service prediction',
    'voyage risk',
    'multilingual'
  )
);

-- Active onboard crew can read technical, guest-service, maintenance and
-- position data for their yacht. Financial rows, captain logs and yacht_status
-- are intentionally absent from this group.
create policy bluedeck_engine_hours_select_yacht
on public.engine_hours
for select
to authenticated
using (private.bluedeck_has_yacht_access(yacht_id));

create policy bluedeck_engine_logs_select_yacht
on public.engine_logs
for select
to authenticated
using (private.bluedeck_has_yacht_access(yacht_id));

create policy bluedeck_engineering_assets_select_yacht
on public.engineering_assets
for select
to authenticated
using (private.bluedeck_has_yacht_access(yacht_id));

create policy bluedeck_guest_requests_select_yacht
on public.guest_requests
for select
to authenticated
using (private.bluedeck_has_yacht_access(yacht_id));

create policy bluedeck_maintenance_logs_select_yacht
on public.maintenance_logs
for select
to authenticated
using (private.bluedeck_has_yacht_access(yacht_id));

create policy bluedeck_maintenance_schedules_select_yacht
on public.maintenance_schedules
for select
to authenticated
using (private.bluedeck_has_yacht_access(yacht_id));

create policy bluedeck_quick_engine_reports_select_yacht
on public.quick_engine_reports
for select
to authenticated
using (private.bluedeck_has_yacht_access(yacht_id));

create policy bluedeck_yacht_positions_select_yacht
on public.yacht_positions
for select
to authenticated
using (private.bluedeck_has_yacht_access(yacht_id));

-- Narrow active-crew workflows. Owner writes are already granted by each
-- table's owner_manage policy. Delete remains owner-only everywhere.
create policy bluedeck_engine_hours_crew_insert
on public.engine_hours
for insert
to authenticated
with check (private.bluedeck_is_active_yacht_member(yacht_id));

create policy bluedeck_engine_logs_crew_insert
on public.engine_logs
for insert
to authenticated
with check (private.bluedeck_is_active_yacht_member(yacht_id));

create policy bluedeck_engineering_assets_crew_update_hours
on public.engineering_assets
for update
to authenticated
using (private.bluedeck_is_active_yacht_member(yacht_id))
with check (private.bluedeck_is_active_yacht_member(yacht_id));

create policy bluedeck_guest_requests_crew_insert
on public.guest_requests
for insert
to authenticated
with check (private.bluedeck_is_active_yacht_member(yacht_id));

create policy bluedeck_guest_requests_crew_update_status
on public.guest_requests
for update
to authenticated
using (private.bluedeck_is_active_yacht_member(yacht_id))
with check (private.bluedeck_is_active_yacht_member(yacht_id));

create policy bluedeck_maintenance_logs_crew_insert
on public.maintenance_logs
for insert
to authenticated
with check (private.bluedeck_is_active_yacht_member(yacht_id));

create policy bluedeck_maintenance_schedules_crew_insert
on public.maintenance_schedules
for insert
to authenticated
with check (private.bluedeck_is_active_yacht_member(yacht_id));

create policy bluedeck_maintenance_schedules_crew_update_completion
on public.maintenance_schedules
for update
to authenticated
using (private.bluedeck_is_active_yacht_member(yacht_id))
with check (private.bluedeck_is_active_yacht_member(yacht_id));

create policy bluedeck_quick_engine_reports_crew_insert
on public.quick_engine_reports
for insert
to authenticated
with check (private.bluedeck_is_active_yacht_member(yacht_id));

create policy bluedeck_quick_engine_reports_crew_update_status
on public.quick_engine_reports
for update
to authenticated
using (private.bluedeck_is_active_yacht_member(yacht_id))
with check (private.bluedeck_is_active_yacht_member(yacht_id));

-- Keep tenant predicates efficient as the operational history grows.
create index if not exists bluedeck_events_yacht_id_idx
  on public.bluedeck_events (yacht_id);
create index if not exists captain_logbook_yacht_id_idx
  on public.captain_logbook (yacht_id);
create index if not exists engine_hours_yacht_id_idx
  on public.engine_hours (yacht_id);
create index if not exists engine_logs_yacht_id_idx
  on public.engine_logs (yacht_id);
create index if not exists engineering_assets_yacht_id_idx
  on public.engineering_assets (yacht_id);
create index if not exists fuel_logs_yacht_id_idx
  on public.fuel_logs (yacht_id);
create index if not exists guest_requests_yacht_id_idx
  on public.guest_requests (yacht_id);
create index if not exists maintenance_logs_yacht_id_idx
  on public.maintenance_logs (yacht_id);
create index if not exists maintenance_logs_maintenance_id_idx
  on public.maintenance_logs (maintenance_id);
create index if not exists maintenance_schedules_yacht_id_idx
  on public.maintenance_schedules (yacht_id);
create index if not exists quick_engine_reports_yacht_id_idx
  on public.quick_engine_reports (yacht_id);
create index if not exists yacht_expenses_yacht_id_idx
  on public.yacht_expenses (yacht_id);
create index if not exists yacht_positions_yacht_id_idx
  on public.yacht_positions (yacht_id);
create index if not exists yacht_status_yacht_id_idx
  on public.yacht_status (yacht_id);

comment on function private.bluedeck_guard_operational_yacht_row() is
  'Prevents browser users from moving operational rows across yachts and limits crew field changes.';

commit;
