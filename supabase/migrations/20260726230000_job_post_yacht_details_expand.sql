-- Expand job-post yacht specifications without changing current publishing
-- behaviour. The nullable shape keeps existing live listings readable while
-- the application rollout starts writing normalized yacht details.

begin;

alter table public.job_posts
  add column if not exists yacht_type text,
  add column if not exists yacht_length numeric(6, 2),
  add column if not exists yacht_length_unit text;

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
      'commercial_vessel'
    )
  ) not valid;

alter table public.job_posts
  drop constraint if exists job_posts_yacht_length_check;
alter table public.job_posts
  add constraint job_posts_yacht_length_check
  check (
    yacht_length is null
    or (yacht_length > 0 and yacht_length <= 1000)
  ) not valid;

alter table public.job_posts
  drop constraint if exists job_posts_yacht_length_unit_check;
alter table public.job_posts
  add constraint job_posts_yacht_length_unit_check
  check (
    yacht_length_unit is null
    or yacht_length_unit in ('m', 'ft')
  ) not valid;

alter table public.job_posts
  drop constraint if exists job_posts_yacht_length_pair_check;
alter table public.job_posts
  add constraint job_posts_yacht_length_pair_check
  check (
    (yacht_length is null and yacht_length_unit is null)
    or (yacht_length is not null and yacht_length_unit is not null)
  ) not valid;

alter table public.job_posts
  validate constraint job_posts_yacht_type_check;
alter table public.job_posts
  validate constraint job_posts_yacht_length_check;
alter table public.job_posts
  validate constraint job_posts_yacht_length_unit_check;
alter table public.job_posts
  validate constraint job_posts_yacht_length_pair_check;

comment on column public.job_posts.yacht_type is
  'Stable public yacht-type slug captured with the job listing; nullable for legacy listings and drafts.';
comment on column public.job_posts.yacht_length is
  'Public yacht length captured with the job listing in yacht_length_unit; nullable for legacy listings and drafts.';
comment on column public.job_posts.yacht_length_unit is
  'Display unit for yacht_length: m or ft; nullable for legacy listings and drafts.';

commit;
