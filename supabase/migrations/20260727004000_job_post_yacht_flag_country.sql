-- Capture an optional ISO 3166-1 alpha-2 flag country on a job listing.

begin;

alter table public.job_posts
  add column if not exists yacht_flag_country_code text;

alter table public.job_posts
  drop constraint if exists job_posts_yacht_flag_country_code_check;
alter table public.job_posts
  add constraint job_posts_yacht_flag_country_code_check
  check (
    yacht_flag_country_code is null
    or yacht_flag_country_code ~ '^[A-Z]{2}$'
  ) not valid;

alter table public.job_posts
  validate constraint job_posts_yacht_flag_country_code_check;

comment on column public.job_posts.yacht_flag_country_code is
  'Optional ISO 3166-1 alpha-2 country code for the yacht flag shown publicly.';

commit;
