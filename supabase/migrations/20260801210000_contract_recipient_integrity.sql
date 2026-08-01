-- Bind every sent yacht contract to one active crew membership on the same
-- yacht, make sent terms immutable, and bound user-controlled contract data.

begin;

create schema if not exists private;

lock table public.yacht_crew_memberships in share row exclusive mode;
lock table public.yacht_contracts in share row exclusive mode;

do $block$
begin
  if exists (
    select 1
    from public.yacht_contracts as contract
    where lower(btrim(coalesce(contract.status, ''))) = 'studio_draft'
      and (
        contract.crew_profile_id is not null
        or contract.membership_id is not null
        or contract.signed_name is not null
        or contract.signed_at is not null
      )
  ) then
    raise exception 'A studio draft contains recipient or signature data.';
  end if;

  if exists (
    select 1
    from public.yacht_contracts as contract
    where lower(btrim(coalesce(contract.status, ''))) <> 'studio_draft'
      and not exists (
        select 1
        from public.yacht_crew_memberships as membership
        where membership.id = contract.membership_id
          and membership.yacht_id = contract.yacht_id
          and membership.crew_profile_id = contract.crew_profile_id
          and lower(btrim(coalesce(membership.status, ''))) = 'active'
      )
  ) then
    raise exception 'A sent contract is not bound to an active same-yacht membership.';
  end if;
end;
$block$;

alter table public.yacht_crew_memberships
  drop constraint if exists yacht_memberships_contract_identity_key;
alter table public.yacht_crew_memberships
  add constraint yacht_memberships_contract_identity_key
  unique (id, yacht_id, crew_profile_id);

alter table public.yacht_contracts
  drop constraint if exists yacht_contracts_membership_identity_fkey;
alter table public.yacht_contracts
  add constraint yacht_contracts_membership_identity_fkey
  foreign key (membership_id, yacht_id, crew_profile_id)
  references public.yacht_crew_memberships (id, yacht_id, crew_profile_id)
  on update restrict
  on delete restrict;

alter table public.yacht_contracts
  drop constraint if exists yacht_contracts_payload_size_check;
alter table public.yacht_contracts
  add constraint yacht_contracts_payload_size_check check (
    octet_length(coalesce(contract_text, '')) <= 1048576
    and octet_length(coalesce(signed_name, '')) <= 512
    and octet_length(coalesce(status, '')) <= 32
  );

update public.yacht_contracts
set sent_at = null
where lower(btrim(coalesce(status, ''))) = 'studio_draft'
  and sent_at is not null;

alter table public.yacht_contracts
  drop constraint if exists yacht_contracts_state_shape_check;
alter table public.yacht_contracts
  add constraint yacht_contracts_state_shape_check check (
    lower(btrim(coalesce(status, ''))) in (
      'studio_draft',
      'sent_for_signature',
      'signed'
    )
    and (
      (
        lower(btrim(status)) = 'studio_draft'
        and crew_profile_id is null
        and membership_id is null
        and sent_at is null
        and signed_name is null
        and signed_at is null
      )
      or (
        lower(btrim(status)) = 'sent_for_signature'
        and yacht_id is not null
        and crew_profile_id is not null
        and membership_id is not null
        and nullif(btrim(coalesce(contract_text, '')), '') is not null
        and sent_at is not null
        and signed_name is null
        and signed_at is null
      )
      or (
        lower(btrim(status)) = 'signed'
        and yacht_id is not null
        and crew_profile_id is not null
        and membership_id is not null
        and nullif(btrim(coalesce(contract_text, '')), '') is not null
        and sent_at is not null
        and nullif(btrim(coalesce(signed_name, '')), '') is not null
        and signed_at is not null
      )
    )
  );

create or replace function private.bluedeck_guard_contract_integrity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  next_status text := lower(btrim(coalesce(new.status, '')));
  previous_status text := case
    when tg_op = 'UPDATE' then lower(btrim(coalesce(old.status, '')))
    else ''
  end;
  signer_user_id uuid;
begin
  if octet_length(coalesce(new.contract_text, '')) > 1048576
    or octet_length(coalesce(new.signed_name, '')) > 512
    or octet_length(coalesce(new.status, '')) > 32
  then
    raise exception using
      errcode = '23514',
      message = 'Contract content exceeds the allowed size.';
  end if;

  if next_status not in ('studio_draft', 'sent_for_signature', 'signed') then
    raise exception using
      errcode = '23514',
      message = 'Invalid contract status.';
  end if;

  new.status := next_status;

  if tg_op = 'INSERT' and next_status <> 'studio_draft' then
    raise exception using
      errcode = '42501',
      message = 'Contracts must be created as unsigned studio drafts.';
  end if;

  if tg_op = 'UPDATE' and not (
    (previous_status = 'studio_draft' and next_status in ('studio_draft', 'sent_for_signature'))
    or (previous_status = 'sent_for_signature' and next_status in ('sent_for_signature', 'signed'))
    or (previous_status = 'signed' and next_status = 'signed')
  ) then
    raise exception using
      errcode = '23514',
      message = format('Invalid contract transition from %s to %s.', previous_status, next_status);
  end if;

  if tg_op = 'UPDATE' and new.id is distinct from old.id then
    raise exception using
      errcode = '42501',
      message = 'Contract identity is immutable.';
  end if;

  if next_status = 'studio_draft' then
    new.sent_at := null;
    if new.crew_profile_id is not null
      or new.membership_id is not null
      or new.signed_name is not null
      or new.signed_at is not null
    then
      raise exception using
        errcode = '23514',
        message = 'A studio draft cannot contain recipient or signature data.';
    end if;
  elsif not exists (
    select 1
    from public.yacht_crew_memberships as membership
    where membership.id = new.membership_id
      and membership.yacht_id = new.yacht_id
      and membership.crew_profile_id = new.crew_profile_id
      and lower(btrim(coalesce(membership.status, ''))) = 'active'
  ) then
    raise exception using
      errcode = '23514',
      message = 'A sent contract requires an active same-yacht crew membership.';
  end if;

  if tg_op = 'UPDATE'
    and previous_status = 'studio_draft'
    and next_status = 'sent_for_signature'
  then
    new.sent_at := statement_timestamp();
    new.signed_name := null;
    new.signed_at := null;
  end if;

  if tg_op = 'UPDATE'
    and previous_status = 'sent_for_signature'
    and next_status = 'signed'
  then
    select profile.user_id
    into signer_user_id
    from public.crew_profiles as profile
    where profile.id = new.crew_profile_id;

    if signer_user_id is null or auth.uid() is distinct from signer_user_id then
      raise exception using
        errcode = '42501',
        message = 'Only the assigned authenticated crew member may sign this contract.';
    end if;

    new.signed_name := nullif(btrim(coalesce(new.signed_name, '')), '');
    if new.signed_name is null then
      raise exception using
        errcode = '23514',
        message = 'A typed signer name is required.';
    end if;
    new.signed_at := statement_timestamp();
  end if;

  if tg_op = 'UPDATE' and previous_status <> 'studio_draft' then
    if new.yacht_id is distinct from old.yacht_id
      or new.crew_profile_id is distinct from old.crew_profile_id
      or new.membership_id is distinct from old.membership_id
      or new.contract_text is distinct from old.contract_text
      or new.sent_at is distinct from old.sent_at
    then
      raise exception using
        errcode = '42501',
        message = 'Sent contract terms and recipient are immutable.';
    end if;
  end if;

  if tg_op = 'UPDATE' and previous_status = 'signed' and (
    new.status is distinct from old.status
    or new.signed_name is distinct from old.signed_name
    or new.signed_at is distinct from old.signed_at
  ) then
    raise exception using
      errcode = '42501',
      message = 'A signed contract record is immutable.';
  end if;

  return new;
end;
$function$;

create or replace function private.bluedeck_guard_contract_delete()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
begin
  if lower(btrim(coalesce(old.status, ''))) <> 'studio_draft' then
    raise exception using
      errcode = '42501',
      message = 'Sent and signed contract audit records cannot be deleted.';
  end if;
  return old;
end;
$function$;

drop trigger if exists bluedeck_contract_00_integrity
  on public.yacht_contracts;
create trigger bluedeck_contract_00_integrity
before insert or update on public.yacht_contracts
for each row execute function private.bluedeck_guard_contract_integrity();

drop trigger if exists bluedeck_contract_00_delete_guard
  on public.yacht_contracts;
create trigger bluedeck_contract_00_delete_guard
before delete on public.yacht_contracts
for each row execute function private.bluedeck_guard_contract_delete();

-- The current product does not use the legacy crew_contracts write model.
-- Keep historical reads available under its existing party policy, but close
-- every authenticated mutation path instead of maintaining two contract
-- authorities with different invariants.
do $block$
begin
  if to_regclass('public.crew_contracts') is not null then
    execute 'revoke insert, update, delete on table public.crew_contracts from authenticated';
    execute 'drop policy if exists bluedeck_crew_contracts_insert_manager on public.crew_contracts';
    execute 'drop policy if exists bluedeck_crew_contracts_update_authorized on public.crew_contracts';
    execute 'drop policy if exists bluedeck_crew_contracts_delete_manager on public.crew_contracts';
  end if;
end;
$block$;

revoke all on function private.bluedeck_guard_contract_integrity()
  from public, anon, authenticated, service_role;
revoke all on function private.bluedeck_guard_contract_delete()
  from public, anon, authenticated, service_role;

comment on constraint yacht_contracts_membership_identity_fkey
  on public.yacht_contracts is
  'A contract recipient and membership must belong to the same yacht.';

commit;
