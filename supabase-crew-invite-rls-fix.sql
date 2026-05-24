alter table public.crew_invitations
  add column if not exists accepted_at timestamptz;

alter table public.yacht_crew_memberships
  add column if not exists accepted_at timestamptz;

alter table public.yacht_checklists
  add column if not exists frequency text,
  add column if not exists due_date date,
  add column if not exists captain_note text,
  add column if not exists status text default 'open',
  add column if not exists completed_at timestamptz;

alter table public.crew_invitations enable row level security;
alter table public.yacht_crew_memberships enable row level security;
alter table public.yacht_checklists enable row level security;
alter table public.yacht_checklist_items enable row level security;
alter table public.yacht_contracts enable row level security;

drop policy if exists "Authenticated crew invitations" on public.crew_invitations;
create policy "Authenticated crew invitations"
on public.crew_invitations
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated yacht memberships" on public.yacht_crew_memberships;
create policy "Authenticated yacht memberships"
on public.yacht_crew_memberships
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated yacht checklists" on public.yacht_checklists;
create policy "Authenticated yacht checklists"
on public.yacht_checklists
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated yacht checklist items" on public.yacht_checklist_items;
create policy "Authenticated yacht checklist items"
on public.yacht_checklist_items
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated yacht contracts" on public.yacht_contracts;
create policy "Authenticated yacht contracts"
on public.yacht_contracts
for all
to authenticated
using (true)
with check (true);
