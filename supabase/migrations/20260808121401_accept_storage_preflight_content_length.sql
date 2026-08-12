-- Supabase Storage runs a transactional permission probe before uploading
-- bytes. That provisional storage.objects row contains contentLength but not
-- the final size field. Keep final size authoritative while accepting the
-- preflight metadata shape so the quota trigger can validate normal uploads.

begin;

create or replace function private.bluedeck_storage_object_size_bytes(
  p_metadata jsonb
)
returns bigint
language plpgsql
immutable
set search_path = pg_catalog
as $function$
declare
  raw_size text;
  normalized_size text;
begin
  if p_metadata is null
    or pg_catalog.jsonb_typeof(p_metadata) <> 'object'
  then
    return null;
  end if;

  -- Completed objects always carry size, so a present-but-invalid size must
  -- fail closed instead of being hidden by a valid fallback value.
  if p_metadata ? 'size' then
    if pg_catalog.jsonb_typeof(p_metadata -> 'size') not in ('number', 'string') then
      return null;
    end if;

    raw_size := p_metadata ->> 'size';
  elsif p_metadata ? 'contentLength' then
    if pg_catalog.jsonb_typeof(p_metadata -> 'contentLength') not in ('number', 'string') then
      return null;
    end if;

    raw_size := p_metadata ->> 'contentLength';
  else
    return null;
  end if;

  if raw_size is null or raw_size !~ '^[0-9]+$' then
    return null;
  end if;

  normalized_size := pg_catalog.ltrim(raw_size, '0');
  if normalized_size = '' then
    return 0;
  end if;

  if pg_catalog.length(normalized_size) > 19
    or (
      pg_catalog.length(normalized_size) = 19
      and normalized_size::numeric > 9223372036854775807::numeric
    )
  then
    return null;
  end if;

  return normalized_size::bigint;
end;
$function$;

revoke all on function private.bluedeck_storage_object_size_bytes(jsonb)
  from public, anon, authenticated, service_role;

comment on function private.bluedeck_storage_object_size_bytes(jsonb) is
  'Returns authoritative Storage size metadata, falling back to validated contentLength only when size is absent during the Storage permission probe.';

commit;
