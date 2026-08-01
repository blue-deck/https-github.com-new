-- The database must not create public crew-directory profiles automatically.

begin;

do $test$
begin
  if exists (
    select 1
    from pg_trigger
    where not tgisinternal
      and tgname in (
        'marketplace_entitlements_sync_crew_directory',
        'auth_users_sync_confirmed_crew_directory'
      )
  ) then
    raise exception 'Automatic public crew-directory triggers must not exist.';
  end if;

  if to_regprocedure(
    'private.bluedeck_sync_crew_directory_profile(uuid)'
  ) is not null then
    raise exception 'Automatic public crew-directory function must not exist.';
  end if;
end;
$test$;

rollback;
