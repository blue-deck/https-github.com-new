-- Treat an untouched Team / Couple preference as a real wildcard. Existing
-- individual, team, and couple rows remain valid, while new posts default to
-- accepting either application mode.

begin;

alter table public.job_posts
  alter column candidate_type set default 'any';

alter table public.job_posts
  drop constraint if exists job_posts_candidate_type_check;

alter table public.job_posts
  add constraint job_posts_candidate_type_check
  check (candidate_type in ('any', 'individual', 'team', 'couple')) not valid;

alter table public.job_posts
  validate constraint job_posts_candidate_type_check;

comment on column public.job_posts.candidate_type is
  'Candidate application preference: any, individual, team, or couple.';

-- Keep the latest application RPC byte-for-byte apart from widening its team
-- application guard. Fetching the installed definition avoids duplicating a
-- long security-definer function and fails closed if the expected guard has
-- changed in a later migration.
do $migration$
declare
  function_sql text;
  old_guard constant text :=
    'current_job.candidate_type not in (''team'', ''couple'')';
  new_guard constant text :=
    'current_job.candidate_type not in (''any'', ''team'', ''couple'')';
begin
  select pg_catalog.pg_get_functiondef(
    'public.bluedeck_submit_job_application_v2(uuid,uuid,text,boolean)'
      ::pg_catalog.regprocedure
  )
  into function_sql;

  if pg_catalog.strpos(function_sql, new_guard) > 0 then
    null;
  elsif pg_catalog.strpos(function_sql, old_guard) > 0 then
    function_sql := pg_catalog.replace(function_sql, old_guard, new_guard);
    execute function_sql;
  else
    raise exception using
      errcode = '55000',
      message = 'Unexpected Team/Couple guard in job application RPC.';
  end if;
end;
$migration$;

commit;
