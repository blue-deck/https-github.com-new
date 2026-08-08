-- Repair the already-deployed Crew-ID invitation lookup without changing any
-- other authorization, identity, de-duplication or audit behavior. Fresh
-- databases receive the corrected definition in the preceding migration, so
-- this forward repair is deliberately idempotent.

begin;

do $repair$
declare
  target_function constant regprocedure :=
    'public.bluedeck_issue_crew_invitation(uuid,uuid,text,text,text,text,text,text)'::regprocedure;
  broken_lookup constant text :=
    E'    select profile\n    into target_profile\n';
  fixed_lookup constant text :=
    E'    select profile.*\n    into target_profile\n';
  function_definition text;
  repaired_definition text;
begin
  select pg_catalog.pg_get_functiondef(target_function::oid)
  into function_definition;

  if pg_catalog.strpos(function_definition, broken_lookup) > 0 then
    if (
      pg_catalog.octet_length(function_definition)
        - pg_catalog.octet_length(
          pg_catalog.replace(function_definition, broken_lookup, '')
        )
    ) / pg_catalog.octet_length(broken_lookup) <> 1 then
      raise exception using
        errcode = '23514',
        message = 'Crew invitation lookup repair was not uniquely applicable.';
    end if;

    repaired_definition := pg_catalog.replace(
      function_definition,
      broken_lookup,
      fixed_lookup
    );

    if repaired_definition is not distinct from function_definition
      or pg_catalog.strpos(repaired_definition, broken_lookup) > 0
    then
      raise exception using
        errcode = '23514',
        message = 'Crew invitation lookup repair was not uniquely applicable.';
    end if;

    execute repaired_definition;
  elsif pg_catalog.strpos(function_definition, fixed_lookup) = 0 then
    raise exception using
      errcode = '23514',
      message = 'Crew invitation lookup has an unexpected definition.';
  end if;

  select pg_catalog.pg_get_functiondef(target_function::oid)
  into function_definition;

  if pg_catalog.strpos(function_definition, broken_lookup) > 0
    or pg_catalog.strpos(function_definition, fixed_lookup) = 0
  then
    raise exception using
      errcode = '23514',
      message = 'Crew invitation lookup repair did not verify.';
  end if;
end;
$repair$;

revoke all on function public.bluedeck_issue_crew_invitation(
  uuid, uuid, text, text, text, text, text, text
) from public, anon, authenticated;
grant execute on function public.bluedeck_issue_crew_invitation(
  uuid, uuid, text, text, text, text, text, text
) to service_role;

comment on function public.bluedeck_issue_crew_invitation(
  uuid, uuid, text, text, text, text, text, text
) is
  'Atomic service-only invitation issuance using current publisher authority and canonical Auth identity; Crew ID lookup follows automatic active Crew/Captain directory eligibility.';

commit;
