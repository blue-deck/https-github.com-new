-- Capture an optional public yacht brand on a job listing.

begin;

alter table public.job_posts
  add column if not exists yacht_brand text;

alter table public.job_posts
  drop constraint if exists job_posts_yacht_brand_check;
alter table public.job_posts
  add constraint job_posts_yacht_brand_check
  check (
    yacht_brand is null
    or char_length(btrim(yacht_brand)) between 1 and 80
  ) not valid;

alter table public.job_posts
  validate constraint job_posts_yacht_brand_check;

comment on column public.job_posts.yacht_brand is
  'Optional public yacht brand supplied for the job listing.';

commit;
