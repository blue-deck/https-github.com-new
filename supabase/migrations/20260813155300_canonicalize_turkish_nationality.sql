-- Canonicalize the legacy demonym stored by the former nationality picker.
-- The current picker stores English country names, so Turkish maps to Turkey.
begin;

update public.crew_profiles
set nationality = 'Turkey'
where lower(btrim(nationality)) = 'turkish';

commit;
