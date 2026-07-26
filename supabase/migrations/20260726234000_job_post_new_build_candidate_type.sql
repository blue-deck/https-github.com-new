-- Add the New build yacht category and a normalized candidate arrangement for
-- individual, team and couple job listings.

begin;

alter table public.job_posts
  drop constraint if exists job_posts_yacht_type_check;
alter table public.job_posts
  add constraint job_posts_yacht_type_check
  check (
    yacht_type is null
    or yacht_type in (
      'motor_yacht',
      'sailing_yacht',
      'catamaran',
      'motor_catamaran',
      'gulet',
      'expedition_yacht',
      'classic_yacht',
      'support_vessel',
      'chase_boat',
      'commercial_vessel',
      'new_build'
    )
  ) not valid;

alter table public.job_posts
  validate constraint job_posts_yacht_type_check;

alter table public.job_posts
  add column if not exists candidate_type text not null default 'individual';

alter table public.job_posts
  drop constraint if exists job_posts_candidate_type_check;
alter table public.job_posts
  add constraint job_posts_candidate_type_check
  check (candidate_type in ('individual', 'team', 'couple')) not valid;

alter table public.job_posts
  validate constraint job_posts_candidate_type_check;

comment on column public.job_posts.candidate_type is
  'Hiring arrangement for the listing: individual, team or couple.';

commit;
