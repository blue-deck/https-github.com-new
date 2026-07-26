-- Capture an optional four-digit yacht build year on a job listing.

begin;

alter table public.job_posts
  add column if not exists yacht_build_year smallint;

alter table public.job_posts
  drop constraint if exists job_posts_yacht_build_year_check;
alter table public.job_posts
  add constraint job_posts_yacht_build_year_check
  check (
    yacht_build_year is null
    or yacht_build_year between 1800 and 2100
  ) not valid;

alter table public.job_posts
  validate constraint job_posts_yacht_build_year_check;

comment on column public.job_posts.yacht_build_year is
  'Optional four-digit build year shown on the public job listing.';

commit;
