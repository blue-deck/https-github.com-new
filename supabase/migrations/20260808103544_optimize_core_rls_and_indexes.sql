-- Evaluate stable auth claims once per statement and remove legacy duplicate
-- indexes without changing authorization semantics.

begin;

alter policy bluedeck_profiles_select_own
  on public.profiles
  using (
    private.bluedeck_is_active_account()
    and id = (select auth.uid())
  );

alter policy bluedeck_profiles_insert_own
  on public.profiles
  with check (
    private.bluedeck_is_active_account()
    and id = (select auth.uid())
  );

alter policy bluedeck_profiles_update_own
  on public.profiles
  using (
    private.bluedeck_is_active_account()
    and id = (select auth.uid())
  )
  with check (
    private.bluedeck_is_active_account()
    and id = (select auth.uid())
  );

alter policy bluedeck_yachts_insert_owner
  on public.yachts
  with check (
    private.bluedeck_is_active_account()
    and owner_id = (select auth.uid())
  );

alter policy bluedeck_yachts_update_owner
  on public.yachts
  using (private.bluedeck_is_yacht_owner(id))
  with check (
    private.bluedeck_is_active_account()
    and owner_id = (select auth.uid())
  );

alter policy "Users read own employer access"
  on public.employer_access
  using (
    private.bluedeck_is_active_account()
    and (select auth.uid()) = user_id
  );

alter policy bluedeck_crew_profiles_insert_own
  on public.crew_profiles
  with check (
    private.bluedeck_has_crew_career_access()
    and user_id = (select auth.uid())
  );

alter policy bluedeck_crew_profiles_update_own
  on public.crew_profiles
  using (
    private.bluedeck_has_crew_career_access()
    and private.bluedeck_is_own_crew_profile(id)
  )
  with check (
    private.bluedeck_has_crew_career_access()
    and user_id = (select auth.uid())
  );

drop index if exists public.crew_invitations_token_uidx;
drop index if exists public.crew_profiles_user_id_unique;

commit;
