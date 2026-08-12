-- Cover the full child-side key used by the canonical application parent FK.
begin;

set local lock_timeout = '5s';

create index if not exists job_application_team_members_parent_fk_idx
  on public.job_application_team_members (application_id, job_post_id);

commit;
