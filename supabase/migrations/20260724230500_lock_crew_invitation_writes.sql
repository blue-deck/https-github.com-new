-- Close the rolling-deployment window left by legacy browser clients. All
-- invitation and membership mutations now go through authenticated server
-- routes using service_role; browsers retain only the temporary reads needed
-- by the previous production bundle until the canonical RLS migration lands.

begin;

revoke insert, update, delete
on table public.crew_invitations
from authenticated;

revoke insert, update, delete
on table public.yacht_crew_memberships
from authenticated;

commit;
