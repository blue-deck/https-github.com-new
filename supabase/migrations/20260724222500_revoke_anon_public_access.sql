-- BlueDeck does not expose public-schema tables directly to unauthenticated
-- browsers. Public pages use narrow server routes backed by service_role.

begin;

revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;

alter default privileges for role postgres in schema public
  revoke all privileges on tables from anon;
alter default privileges for role postgres in schema public
  revoke all privileges on sequences from anon;

commit;
