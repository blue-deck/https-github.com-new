-- Store public candidate preferences for smoking, visible tattoos and required
-- languages. Defaults preserve the behaviour of existing listings.

begin;

alter table public.job_posts
  add column if not exists smoker_policy text not null default 'no_preference',
  add column if not exists visible_tattoo_policy text not null default 'no_preference',
  add column if not exists required_languages text[] not null default array[]::text[];

alter table public.job_posts
  drop constraint if exists job_posts_smoker_policy_check;
alter table public.job_posts
  add constraint job_posts_smoker_policy_check
  check (smoker_policy in ('no_preference', 'non_smoker', 'smoker_accepted'))
  not valid;

alter table public.job_posts
  drop constraint if exists job_posts_visible_tattoo_policy_check;
alter table public.job_posts
  add constraint job_posts_visible_tattoo_policy_check
  check (visible_tattoo_policy in ('no_preference', 'not_accepted', 'accepted'))
  not valid;

alter table public.job_posts
  drop constraint if exists job_posts_required_languages_count_check;
alter table public.job_posts
  add constraint job_posts_required_languages_count_check
  check (cardinality(required_languages) <= 20) not valid;

alter table public.job_posts
  validate constraint job_posts_smoker_policy_check;
alter table public.job_posts
  validate constraint job_posts_visible_tattoo_policy_check;
alter table public.job_posts
  validate constraint job_posts_required_languages_count_check;

comment on column public.job_posts.smoker_policy is
  'Smoking preference for applicants: no preference, non-smoker or smokers accepted.';
comment on column public.job_posts.visible_tattoo_policy is
  'Visible tattoo preference for applicants: no preference, not accepted or accepted.';
comment on column public.job_posts.required_languages is
  'Public list of languages requested for the role.';

commit;
