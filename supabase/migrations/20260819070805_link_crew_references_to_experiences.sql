-- Give every reference an optional, stable experience identity. The column is
-- deliberately nullable during the expand phase so the existing application
-- remains compatible and legacy rows that cannot be linked safely are not
-- assigned by guesswork.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '2min';

alter table public.crew_references
  add column if not exists crew_experience_id uuid;

-- A composite referenced key lets the child foreign key prove both identity
-- and profile ownership in one database constraint. The experience id remains
-- globally unique through its existing primary key; this additional key is for
-- tenant/owner integrity.
do $constraint$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.crew_experiences'::regclass
      and conname = 'crew_experiences_id_profile_key'
  ) then
    alter table public.crew_experiences
      add constraint crew_experiences_id_profile_key
      unique (id, crew_profile_id);
  end if;
end;
$constraint$;

-- Postgres does not create an index on the referencing columns automatically.
-- This supports experience/reference joins and keeps cascading experience
-- deletes from scanning the entire references table.
create index if not exists crew_references_experience_profile_idx
  on public.crew_references (crew_experience_id, crew_profile_id);

do $constraint$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.crew_references'::regclass
      and conname = 'crew_references_experience_profile_fkey'
  ) then
    alter table public.crew_references
      add constraint crew_references_experience_profile_fkey
      foreign key (crew_experience_id, crew_profile_id)
      references public.crew_experiences (id, crew_profile_id)
      on update no action
      on delete cascade
      not valid;
  end if;
end;
$constraint$;

-- Conservatively backfill only exact normalized names within the same crew
-- profile. This mirrors the existing yacht-name normalization (case,
-- punctuation, ampersands, and common yacht prefixes) but intentionally does
-- not use substring/fuzzy matching. A reference is updated only when exactly
-- one experience is a candidate. Identical-name and unmatched legacy records
-- stay NULL for explicit user reconciliation.
with normalized_experiences as (
  select
    experience.id as experience_id,
    experience.crew_profile_id,
    btrim(
      regexp_replace(
        regexp_replace(
          replace(
            lower(btrim(coalesce(experience.yacht_name, ''))),
            '&',
            ' and '
          ),
          '\m(m[[:space:]/.-]*y|s[[:space:]/.-]*y|motor[[:space:]]+yacht|sailing[[:space:]]+yacht|yacht)\M',
          ' ',
          'g'
        ),
        '[^[:alnum:]]+',
        ' ',
        'g'
      )
    ) as target_key
  from public.crew_experiences as experience
),
normalized_references as (
  select
    reference.id as reference_id,
    reference.crew_profile_id,
    btrim(
      regexp_replace(
        regexp_replace(
          replace(
            lower(btrim(coalesce(reference.vessel, ''))),
            '&',
            ' and '
          ),
          '\m(m[[:space:]/.-]*y|s[[:space:]/.-]*y|motor[[:space:]]+yacht|sailing[[:space:]]+yacht|yacht)\M',
          ' ',
          'g'
        ),
        '[^[:alnum:]]+',
        ' ',
        'g'
      )
    ) as target_key
  from public.crew_references as reference
  where reference.crew_experience_id is null
),
candidate_links as (
  select
    reference.reference_id,
    experience.experience_id,
    count(*) over (
      partition by reference.reference_id
    ) as candidate_count
  from normalized_references as reference
  inner join normalized_experiences as experience
    on experience.crew_profile_id = reference.crew_profile_id
   and experience.target_key = reference.target_key
  where reference.target_key <> ''
    and experience.target_key <> ''
)
update public.crew_references as reference
set crew_experience_id = candidate.experience_id
from candidate_links as candidate
where reference.id = candidate.reference_id
  and reference.crew_experience_id is null
  and candidate.candidate_count = 1;

-- NOT VALID avoided an up-front scan while the relationship was added. Once
-- the conservative backfill is complete, validation proves every non-NULL link
-- (including any concurrent write) has a same-profile parent. NULL legacy rows
-- remain valid by design in this additive migration.
alter table public.crew_references
  validate constraint crew_references_experience_profile_fkey;

comment on column public.crew_references.crew_experience_id is
  'Stable parent experience for this reference. NULL is reserved for legacy or explicitly unassigned references during reconciliation.';

comment on constraint crew_experiences_id_profile_key
  on public.crew_experiences is
  'Composite candidate key used to enforce same-profile ownership for experience references.';

comment on constraint crew_references_experience_profile_fkey
  on public.crew_references is
  'Ensures a linked reference and its Yacht or Other Work experience belong to the same crew profile; deleting that experience deletes only its references.';

comment on index public.crew_references_experience_profile_idx is
  'Supports reference lookup and ON DELETE CASCADE by linked experience and profile.';

commit;
