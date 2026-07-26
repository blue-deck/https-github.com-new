-- Limit job-post language requirements to the choices shown by the publisher
-- UI. The constraints are introduced without rewriting historical listings;
-- PostgreSQL still enforces them for every new or updated row.

begin;

alter table public.job_posts
  drop constraint if exists job_posts_required_languages_count_check;
alter table public.job_posts
  add constraint job_posts_required_languages_count_check
  check (cardinality(required_languages) <= 11) not valid;

alter table public.job_posts
  drop constraint if exists job_posts_required_languages_options_check;
alter table public.job_posts
  add constraint job_posts_required_languages_options_check
  check (
    required_languages <@ array[
      'English',
      'Turkish',
      'French',
      'Italian',
      'Spanish',
      'German',
      'Greek',
      'Portuguese',
      'Russian',
      'Ukrainian',
      'Arabic'
    ]::text[]
  ) not valid;

comment on column public.job_posts.required_languages is
  'Ordered selection of supported languages required for the role.';

commit;
