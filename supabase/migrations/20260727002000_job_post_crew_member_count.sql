-- Store the total crew size supplied by a job-post publisher. The field is
-- optional so existing listings remain valid during rollout.

begin;

alter table public.job_posts
  add column if not exists crew_member_count smallint;

alter table public.job_posts
  drop constraint if exists job_posts_crew_member_count_check;
alter table public.job_posts
  add constraint job_posts_crew_member_count_check
  check (
    crew_member_count is null
    or crew_member_count between 1 and 200
  ) not valid;

alter table public.job_posts
  validate constraint job_posts_crew_member_count_check;

comment on column public.job_posts.crew_member_count is
  'Total number of crew members aboard the yacht, as supplied by the publisher.';

commit;
