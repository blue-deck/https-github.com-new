-- The application evaluates job eligibility only through its trusted server
-- client. Do not expose this SECURITY DEFINER authority oracle directly to
-- signed-in browsers.

begin;

revoke all on function public.bluedeck_can_apply_to_job(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.bluedeck_can_apply_to_job(uuid, uuid)
  to service_role;

commit;
