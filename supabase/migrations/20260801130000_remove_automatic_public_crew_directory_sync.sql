-- Public crew discovery is explicit opt-in. Remove the short-lived automatic
-- directory synchronization triggers if they reached an environment before
-- this corrective migration.

begin;

drop trigger if exists marketplace_entitlements_sync_crew_directory
  on public.marketplace_entitlements;

drop trigger if exists auth_users_sync_confirmed_crew_directory
  on auth.users;

drop function if exists private.bluedeck_sync_crew_directory_from_entitlement();
drop function if exists private.bluedeck_sync_confirmed_crew_directory_profile();
drop function if exists private.bluedeck_sync_crew_directory_profile(uuid);

comment on column public.crew_profiles.notes is
  'Profile notes plus BlueDeck Find Crew settings. Public discovery requires an explicit discoverable opt-in.';

commit;
