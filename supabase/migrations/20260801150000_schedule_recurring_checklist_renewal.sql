-- Renew recurring yacht checklists inside Postgres so the schedule remains
-- durable across application hosting changes. The per-period creator is
-- already idempotent; this worker only selects one current source per
-- recurrence signature and invokes it for the current UTC period.

begin;

create extension if not exists pg_cron;

create or replace function private.bluedeck_renew_recurring_checklists(
  p_now timestamptz default statement_timestamp()
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $function$
declare
  source_record record;
  renewal_result jsonb;
  current_day date := (p_now at time zone 'UTC')::date;
  period_key text;
  created_count integer := 0;
  skipped_count integer := 0;
  failed_count integer := 0;
begin
  for source_record in
    with candidates as (
      select
        checklist.id,
        checklist.created_at,
        lower(btrim(checklist.items ->> 'frequency')) as frequency,
        encode(
          extensions.digest(
            lower(
              concat_ws(
                '|',
                checklist.assigned_to::text,
                checklist.yacht_id::text,
                btrim(checklist.title),
                btrim(coalesce(checklist.department, '')),
                btrim(coalesce(checklist.checklist_type, '')),
                lower(btrim(checklist.items ->> 'frequency'))
              )
            ),
            'sha256'
          ),
          'hex'
        ) as recurrence_key
      from public.yacht_checklists as checklist
      where checklist.assigned_to is not null
        and checklist.yacht_id is not null
        and nullif(btrim(coalesce(checklist.title, '')), '') is not null
        and jsonb_typeof(checklist.items) = 'object'
        and lower(btrim(coalesce(checklist.items ->> 'frequency', '')))
          in ('daily', 'weekly', 'monthly')
    )
    select distinct on (candidate.recurrence_key)
      candidate.id,
      candidate.frequency
    from candidates as candidate
    order by
      candidate.recurrence_key,
      candidate.created_at desc nulls last,
      candidate.id desc
  loop
    period_key := case source_record.frequency
      when 'daily' then to_char(current_day, 'YYYY-MM-DD')
      when 'weekly' then to_char(current_day, 'IYYY-"W"IW')
      when 'monthly' then to_char(current_day, 'YYYY-MM')
    end;

    begin
      renewal_result := public.bluedeck_create_recurring_checklist(
        source_record.id,
        period_key,
        current_day
      );

      if coalesce((renewal_result ->> 'ok')::boolean, false)
        is distinct from true
      then
        failed_count := failed_count + 1;
      elsif coalesce((renewal_result ->> 'created')::boolean, false) then
        created_count := created_count + 1;
      else
        skipped_count := skipped_count + 1;
      end if;
    exception
      when others then
        failed_count := failed_count + 1;
    end;
  end loop;

  return jsonb_build_object(
    'ok', failed_count = 0,
    'created', created_count,
    'skipped', skipped_count,
    'failed', failed_count,
    'renewed_at', p_now
  );
end;
$function$;

revoke all on function private.bluedeck_renew_recurring_checklists(timestamptz)
  from public, anon, authenticated, service_role;

comment on function private.bluedeck_renew_recurring_checklists(timestamptz)
is 'Idempotently creates the current UTC period for every active recurring yacht checklist signature.';

select cron.unschedule(job.jobid)
from cron.job as job
where job.jobname = 'bluedeck-renew-recurring-checklists';

select cron.schedule(
  'bluedeck-renew-recurring-checklists',
  '5 * * * *',
  $cron$select private.bluedeck_renew_recurring_checklists();$cron$
);

commit;
