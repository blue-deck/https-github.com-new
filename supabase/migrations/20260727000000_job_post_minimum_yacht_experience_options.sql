-- Store the publisher's selected minimum yacht-experience bracket. Keep the
-- legacy whole-years column during rollout so older application instances can
-- continue reading and writing without interruption.

begin;

alter table public.job_posts
  add column if not exists minimum_yacht_experience text;

update public.job_posts
set minimum_yacht_experience = case
  when minimum_yacht_experience_years = 0 then '0_6_months'
  when minimum_yacht_experience_years = 1 then '1_year'
  when minimum_yacht_experience_years = 2 then '2_years'
  when minimum_yacht_experience_years = 3 then '3_years'
  when minimum_yacht_experience_years between 4 and 5 then '3_5_years'
  when minimum_yacht_experience_years between 6 and 10 then '5_10_years'
  when minimum_yacht_experience_years between 11 and 14 then '10_plus_years'
  when minimum_yacht_experience_years between 15 and 19 then '15_plus_years'
  when minimum_yacht_experience_years >= 20 then '20_plus_years'
  else null
end
where minimum_yacht_experience is null
  and minimum_yacht_experience_years is not null;

alter table public.job_posts
  drop constraint if exists job_posts_minimum_yacht_experience_check;
alter table public.job_posts
  add constraint job_posts_minimum_yacht_experience_check
  check (
    minimum_yacht_experience is null
    or minimum_yacht_experience in (
      '0_6_months',
      '1_year',
      '2_years',
      '3_years',
      '1_3_years',
      '3_5_years',
      '5_plus_years',
      '5_10_years',
      '10_plus_years',
      '15_plus_years',
      '20_plus_years'
    )
  ) not valid;

alter table public.job_posts
  validate constraint job_posts_minimum_yacht_experience_check;

comment on column public.job_posts.minimum_yacht_experience is
  'Minimum yacht-experience bracket selected by the publisher.';

commit;
