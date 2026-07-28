-- Persist the structured Crew Passport fields used by My Profile, CV and
-- employer-side application previews. Every change is additive so this can be
-- applied safely to projects that already received some columns manually.

alter table public.crew_profiles
  add column if not exists profile_photo_url text,
  add column if not exists gender text,
  add column if not exists date_of_birth date,
  add column if not exists height_cm integer,
  add column if not exists weight_kg integer,
  add column if not exists visible_tattoos text,
  add column if not exists smoker text,
  add column if not exists current_positions text[] default '{}',
  add column if not exists seeking_positions text[] default '{}',
  add column if not exists work_preferences text[] default '{}',
  add column if not exists personal_skills text[] default '{}',
  add column if not exists personal_characteristics text[] default '{}',
  add column if not exists languages jsonb default '[]'::jsonb;

alter table public.crew_experiences
  add column if not exists yacht_type text,
  add column if not exists yacht_program text,
  add column if not exists yacht_size text,
  add column if not exists location text;

comment on column public.crew_profiles.gender is
  'Crew-entered gender displayed in authorized profile and CV surfaces.';
comment on column public.crew_profiles.height_cm is
  'Crew-entered height in centimetres.';
comment on column public.crew_profiles.weight_kg is
  'Crew-entered weight in kilograms.';
comment on column public.crew_profiles.visible_tattoos is
  'Crew-entered visible tattoo status.';
comment on column public.crew_profiles.smoker is
  'Crew-entered smoking status.';
