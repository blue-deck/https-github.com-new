-- Transactional scheduler contract smoke test. No rows survive the rollback.

begin;

do $test$
declare
  result jsonb;
begin
  if to_regprocedure(
    'private.bluedeck_renew_recurring_checklists(timestamp with time zone)'
  ) is null then
    raise exception 'Recurring checklist scheduler function is missing.';
  end if;

  if has_function_privilege(
    'anon',
    'private.bluedeck_renew_recurring_checklists(timestamp with time zone)',
    'EXECUTE'
  ) or has_function_privilege(
    'authenticated',
    'private.bluedeck_renew_recurring_checklists(timestamp with time zone)',
    'EXECUTE'
  ) or has_function_privilege(
    'service_role',
    'private.bluedeck_renew_recurring_checklists(timestamp with time zone)',
    'EXECUTE'
  ) then
    raise exception 'Recurring checklist scheduler function is externally executable.';
  end if;

  select private.bluedeck_renew_recurring_checklists(
    '2099-01-01 00:05:00+00'::timestamptz
  ) into result;

  if coalesce((result ->> 'ok')::boolean, false) is distinct from true then
    raise exception 'Recurring checklist scheduler reported a failure: %', result;
  end if;

  if not exists (
    select 1
    from cron.job as job
    where job.jobname = 'bluedeck-renew-recurring-checklists'
      and job.schedule = '5 * * * *'
      and job.active is true
      and job.command like '%private.bluedeck_renew_recurring_checklists()%'
  ) then
    raise exception 'Recurring checklist hourly cron job is missing.';
  end if;
end;
$test$;

rollback;
