-- Limit yacht length to three digits before the decimal separator.

begin;

alter table public.job_posts
  drop constraint if exists job_posts_yacht_length_check;
alter table public.job_posts
  add constraint job_posts_yacht_length_check
  check (
    yacht_length is null
    or (yacht_length > 0 and yacht_length <= 999)
  ) not valid;

alter table public.job_posts
  validate constraint job_posts_yacht_length_check;

comment on column public.job_posts.yacht_length is
  'Public yacht length captured in yacht_length_unit; greater than zero and no more than 999.';

commit;
