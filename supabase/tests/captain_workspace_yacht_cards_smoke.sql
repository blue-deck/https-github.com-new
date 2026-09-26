-- Run after the additive Captain Workspace migration. No existing yacht,
-- account, or storage object is changed; temporary fixtures roll back.
begin;

do $test$
begin
  if (select count(*) from information_schema.columns
      where table_schema = 'public' and table_name = 'yachts'
        and column_name in ('yacht_type', 'crew_size', 'photo_path')
        and is_nullable = 'YES') <> 3 then
    raise exception 'New yacht card fields must be nullable for legacy yachts';
  end if;
  if not exists (select 1 from storage.buckets
    where id = 'yacht-photos' and public = false and file_size_limit = 4194304
      and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[])
  then
    raise exception 'Yacht photos must use a private, bounded raster image bucket';
  end if;
  if not (select relrowsecurity from pg_class where oid = 'public.yachts'::regclass) then
    raise exception 'Yacht RLS must remain enabled';
  end if;
  if (select count(*) from pg_policies where schemaname='public' and tablename='yachts'
    and policyname in ('bluedeck_yachts_select_authorized','bluedeck_yachts_insert_owner',
      'bluedeck_yachts_update_owner','bluedeck_yachts_delete_owner')) <> 4 then
    raise exception 'Existing yacht ownership/access policies must remain intact';
  end if;
  if not exists(select 1 from pg_trigger where tgrelid='public.yachts'::regclass
    and tgname='yachts_zz_bluedeck_resource_quota') then
    raise exception 'Durable yacht quota must remain intact';
  end if;
end;
$test$;

create temporary table yacht_workspace_constraint_fixture
  (like public.yachts including constraints) on commit drop;

-- Legacy free-text flags and missing card metadata remain valid.
insert into yacht_workspace_constraint_fixture (id, created_at, owner_id, name, flag)
values ('22222222-2222-4222-8222-222222222222', now(),
  '11111111-1111-4111-8111-111111111111', 'Legacy yacht', 'British');

update yacht_workspace_constraint_fixture set yacht_type = 'motor_yacht', crew_size = 8,
  photo_path = '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.jpg';

do $test$
begin
  begin
    update yacht_workspace_constraint_fixture set crew_size = -1;
    raise exception 'Negative crew size was accepted';
  exception when check_violation then null;
  end;
  begin
    update yacht_workspace_constraint_fixture set crew_size = 1000;
    raise exception 'Oversized crew size was accepted';
  exception when check_violation then null;
  end;
  begin
    update yacht_workspace_constraint_fixture set yacht_type = 'unsupported';
    raise exception 'Unsupported yacht type was accepted';
  exception when check_violation then null;
  end;
  begin
    update yacht_workspace_constraint_fixture set photo_path =
      '44444444-4444-4444-8444-444444444444/22222222-2222-4222-8222-222222222222/33333333-3333-4333-8333-333333333333.jpg';
    raise exception 'Another owner photo path was accepted';
  exception when check_violation then null;
  end;
end;
$test$;

rollback;
