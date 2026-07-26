-- Reconcile legacy duplicate crew memberships, prevent future invitation races,
-- and keep job-post audit history consistent with yacht deletion semantics.

begin;

lock table public.yacht_crew_memberships in share row exclusive mode;
lock table public.yacht_contracts in share row exclusive mode;
lock table public.crew_invitations in share row exclusive mode;

create temporary table bluedeck_membership_merge
on commit drop
as
with contract_references as (
  select contract.membership_id, count(*)::integer as reference_count
  from public.yacht_contracts as contract
  where contract.membership_id is not null
  group by contract.membership_id
),
ranked as (
  select
    membership.id,
    first_value(membership.id) over (
      partition by membership.yacht_id, membership.crew_profile_id
      order by
        case lower(coalesce(membership.status, ''))
          when 'active' then 0
          when 'invited' then 1
          when 'pending' then 1
          else 2
        end,
        coalesce(contract_references.reference_count, 0) desc,
        membership.created_at nulls last,
        membership.id
    ) as canonical_id,
    row_number() over (
      partition by membership.yacht_id, membership.crew_profile_id
      order by
        case lower(coalesce(membership.status, ''))
          when 'active' then 0
          when 'invited' then 1
          when 'pending' then 1
          else 2
        end,
        coalesce(contract_references.reference_count, 0) desc,
        membership.created_at nulls last,
        membership.id
    ) as membership_rank
  from public.yacht_crew_memberships as membership
  left join contract_references
    on contract_references.membership_id = membership.id
  where membership.yacht_id is not null
    and membership.crew_profile_id is not null
)
select
  ranked.canonical_id,
  ranked.id as duplicate_id
from ranked
where ranked.membership_rank > 1;

create temporary table bluedeck_membership_group_rows
on commit drop
as
select distinct
  merge.canonical_id,
  merge.canonical_id as membership_id,
  0 as source_rank
from bluedeck_membership_merge as merge
union all
select
  merge.canonical_id,
  merge.duplicate_id as membership_id,
  1 as source_rank
from bluedeck_membership_merge as merge;

with merged_values as (
  select
    group_row.canonical_id,
    (
      array_agg(
        nullif(btrim(membership.position), '')
        order by
          group_row.source_rank,
          membership.created_at nulls last,
          membership.id
      )
      filter (where nullif(btrim(membership.position), '') is not null)
    )[1] as position,
    (
      array_agg(
        nullif(btrim(membership.department), '')
        order by
          group_row.source_rank,
          membership.created_at nulls last,
          membership.id
      )
      filter (where nullif(btrim(membership.department), '') is not null)
    )[1] as department,
    (
      array_agg(
        nullif(btrim(membership.invited_email), '')
        order by
          group_row.source_rank,
          membership.created_at nulls last,
          membership.id
      )
      filter (where nullif(btrim(membership.invited_email), '') is not null)
    )[1] as invited_email,
    min(membership.start_date) as start_date,
    max(membership.end_date) as end_date
  from bluedeck_membership_group_rows as group_row
  join public.yacht_crew_memberships as membership
    on membership.id = group_row.membership_id
  group by group_row.canonical_id
)
update public.yacht_crew_memberships as canonical
set position = coalesce(canonical.position, merged_values.position),
    department = coalesce(canonical.department, merged_values.department),
    invited_email = coalesce(canonical.invited_email, merged_values.invited_email),
    start_date = coalesce(canonical.start_date, merged_values.start_date),
    end_date = coalesce(canonical.end_date, merged_values.end_date)
from merged_values
where canonical.id = merged_values.canonical_id;

update public.yacht_contracts as contract
set membership_id = merge.canonical_id
from bluedeck_membership_merge as merge
where contract.membership_id = merge.duplicate_id;

delete from public.yacht_crew_memberships as membership
using bluedeck_membership_merge as merge
where membership.id = merge.duplicate_id;

create unique index if not exists yacht_memberships_yacht_profile_uidx
  on public.yacht_crew_memberships (yacht_id, crew_profile_id)
  where yacht_id is not null
    and crew_profile_id is not null;

create unique index if not exists yacht_memberships_pending_email_uidx
  on public.yacht_crew_memberships (
    yacht_id,
    lower(btrim(invited_email))
  )
  where yacht_id is not null
    and status in ('pending', 'invited')
    and nullif(btrim(invited_email), '') is not null;

create unique index if not exists crew_invitations_token_uidx
  on public.crew_invitations (token);

create unique index if not exists crew_invitations_pending_profile_uidx
  on public.crew_invitations (yacht_id, crew_profile_id)
  where status = 'pending'
    and crew_profile_id is not null;

create unique index if not exists crew_invitations_pending_email_uidx
  on public.crew_invitations (
    yacht_id,
    lower(btrim(invited_email))
  )
  where status = 'pending'
    and nullif(btrim(invited_email), '') is not null;

alter table public.job_posts
  drop constraint if exists job_posts_yacht_id_fkey;

alter table public.job_posts
  add constraint job_posts_yacht_id_fkey
  foreign key (yacht_id)
  references public.yachts(id)
  on delete restrict;

commit;
