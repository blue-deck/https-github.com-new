begin;

do $test$
begin
  if private.bluedeck_crew_availability_status(null) <> 'Available'
    or private.bluedeck_crew_availability_status('private notes') <> 'Available'
    or private.bluedeck_crew_availability_status(
      '__BLUDECK_FIND_CREW__{malformed'
    ) <> 'Available'
    or private.bluedeck_crew_availability_status(
      '__BLUDECK_FIND_CREW__{"availabilityStatus":""}'
    ) <> 'Available'
    or private.bluedeck_crew_availability_status(
      '__BLUDECK_FIND_CREW__{"availabilityStatus":"Available"}'
    ) <> 'Available'
    or private.bluedeck_crew_availability_status(
      '__BLUDECK_FIND_CREW__{"availabilityStatus":"Open to offers"}'
    ) <> 'Open to offers'
    or private.bluedeck_crew_availability_status(
      '__BLUDECK_FIND_CREW__{"availabilityStatus":"Not available"}'
    ) <> 'Not available'
    or private.bluedeck_crew_availability_status(
      '__BLUDECK_FIND_CREW__{"availabilityStatus":"Currently employed"}'
    ) <> 'Not available'
  then
    raise exception 'Crew availability normalization failed.';
  end if;

  if position(
    'bluedeck_crew_availability_status(profile.notes)' in
    pg_get_functiondef(
      'public.bluedeck_public_crew_page(timestamptz,uuid,integer)'::regprocedure
    )
  ) = 0 then
    raise exception 'Public crew pagination does not enforce availability.';
  end if;

  if position(
    'bluedeck_crew_availability_status(profile.notes)' in
    pg_get_functiondef(
      'public.bluedeck_public_crew_media_manifest(uuid[],boolean)'::regprocedure
    )
  ) = 0 then
    raise exception 'Public crew media does not enforce availability.';
  end if;
end;
$test$;

rollback;
