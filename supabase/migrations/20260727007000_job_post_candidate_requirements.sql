-- Structured candidate skills, characteristics, maritime documents and visas
-- for job listings. Legacy free-text responsibility and requirement columns
-- remain intact so older listings and browser sessions stay compatible.

begin;

alter table public.job_posts
  add column if not exists required_skills text[] not null default array[]::text[],
  add column if not exists required_characteristics text[] not null default array[]::text[],
  add column if not exists required_certificates text[] not null default array[]::text[],
  add column if not exists required_visas text[] not null default array[]::text[];

alter table public.job_posts
  drop constraint if exists job_posts_required_skills_check;
alter table public.job_posts
  add constraint job_posts_required_skills_check
  check (
    cardinality(required_skills) <= 5
    and required_skills <@ array[
      'Navigation',
      'Cruise planning',
      'COLREG',
      'Crew management',
      'Guest service',
      'Tender driving',
      'Water sports',
      'Deck maintenance',
      'Line handling',
      'Mooring operations',
      'Watchkeeping',
      'Safety management',
      'Refit and repair',
      'Engine room checks',
      'Administration',
      'Budgeting',
      'Interior service',
      'Table service',
      'Laundry',
      'Galley support'
    ]::text[]
  ) not valid;

alter table public.job_posts
  drop constraint if exists job_posts_required_characteristics_check;
alter table public.job_posts
  add constraint job_posts_required_characteristics_check
  check (
    cardinality(required_characteristics) <= 5
    and required_characteristics <@ array[
      'Calm under pressure',
      'Reliable',
      'Safety-focused',
      'Discreet',
      'Guest-oriented',
      'Team player',
      'Leadership',
      'Adaptable',
      'Organized',
      'Hard-working',
      'Positive attitude',
      'Detail-oriented',
      'Stress-resistant',
      'Communicative',
      'Motivated'
    ]::text[]
  ) not valid;

alter table public.job_posts
  drop constraint if exists job_posts_required_certificates_check;
alter table public.job_posts
  add constraint job_posts_required_certificates_check
  check (
    cardinality(required_certificates) <= 17
    and required_certificates <@ array[
      'Valid Passport',
      'Seafarer''s Book',
      'STCW Basic Safety Training',
      'ENG1 Medical Certificate',
      'Security Awareness',
      'Designated Security Duties (PDSD)',
      'RYA Powerboat Level 2',
      'RYA Yachtmaster Offshore',
      'RYA Yachtmaster Ocean',
      'Certificate of Competency (CoC)',
      'GMDSS GOC',
      'AEC 1',
      'AEC 2',
      'Advanced Fire Fighting',
      'Medical First Aid',
      'Food Safety Level 2',
      'PWC Instructor'
    ]::text[]
  ) not valid;

alter table public.job_posts
  drop constraint if exists job_posts_required_visas_check;
alter table public.job_posts
  add constraint job_posts_required_visas_check
  check (
    cardinality(required_visas) <= 5
    and required_visas <@ array[
      'Schengen Visa',
      'US B1/B2 Visa',
      'US C1/D Visa',
      'UK Visa',
      'Australian Maritime Crew Visa (Subclass 988)'
    ]::text[]
  ) not valid;

alter table public.job_posts
  validate constraint job_posts_required_skills_check;
alter table public.job_posts
  validate constraint job_posts_required_characteristics_check;
alter table public.job_posts
  validate constraint job_posts_required_certificates_check;
alter table public.job_posts
  validate constraint job_posts_required_visas_check;

comment on column public.job_posts.required_skills is
  'Up to five role skills selected from the BlueDeck profile skill taxonomy.';
comment on column public.job_posts.required_characteristics is
  'Up to five candidate traits selected from the BlueDeck profile characteristic taxonomy.';
comment on column public.job_posts.required_certificates is
  'Maritime and yachting certificates or documents required for the role.';
comment on column public.job_posts.required_visas is
  'Visas candidates must already hold for the role.';

-- This trigger runs before the main job-post preparation trigger. It keeps
-- revoked-authority closure transitions immutable for the new fields and
-- supplies the hidden legacy summary from the full description now that the
-- public brief field has been removed from the publisher UI.
create or replace function private.bluedeck_prepare_job_post_selection_fields()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $function$
begin
  if tg_op = 'UPDATE'
    and old.status in ('draft', 'published')
    and new.status = 'closed'
  then
    new.required_skills := old.required_skills;
    new.required_characteristics := old.required_characteristics;
    new.required_certificates := old.required_certificates;
    new.required_visas := old.required_visas;
  else
    new.required_skills := coalesce(new.required_skills, array[]::text[]);
    new.required_characteristics := coalesce(
      new.required_characteristics,
      array[]::text[]
    );
    new.required_certificates := coalesce(
      new.required_certificates,
      array[]::text[]
    );
    new.required_visas := coalesce(new.required_visas, array[]::text[]);
  end if;

  if new.status = 'published'
    and char_length(btrim(coalesce(new.summary, ''))) < 20
  then
    new.summary := left(btrim(coalesce(new.description, '')), 320);
  end if;

  return new;
end;
$function$;

revoke all on function private.bluedeck_prepare_job_post_selection_fields()
  from public, anon, authenticated, service_role;

drop trigger if exists job_posts_a_selection_fields
  on public.job_posts;
create trigger job_posts_a_selection_fields
before insert or update on public.job_posts
for each row execute function private.bluedeck_prepare_job_post_selection_fields();

commit;
