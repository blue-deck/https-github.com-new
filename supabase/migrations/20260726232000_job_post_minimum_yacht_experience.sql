-- Capture the minimum yacht experience requested for a role. The field is
-- nullable so existing listings and drafts remain readable during rollout.

begin;

alter table public.job_posts
  add column if not exists minimum_yacht_experience_years smallint;

alter table public.job_posts
  drop constraint if exists job_posts_minimum_yacht_experience_years_check;
alter table public.job_posts
  add constraint job_posts_minimum_yacht_experience_years_check
  check (
    minimum_yacht_experience_years is null
    or minimum_yacht_experience_years between 0 and 60
  ) not valid;

alter table public.job_posts
  validate constraint job_posts_minimum_yacht_experience_years_check;

comment on column public.job_posts.minimum_yacht_experience_years is
  'Minimum whole years of yacht experience requested by the publisher; zero means no prior yacht experience is required.';

commit;
