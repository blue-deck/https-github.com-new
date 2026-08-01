-- Sensitive BlueDeck documents must remain private and storage access must be
-- path/ownership scoped.

begin;

do $test$
begin
  if exists (
    select 1
    from storage.buckets
    where id in (
      'crew-documents',
      'crew-portfolio',
      'task-photos',
      'documents',
      'yacht-documents'
    )
      and public
  ) then
    raise exception 'A sensitive BlueDeck storage bucket is public.';
  end if;

  if exists (
    select 1
    from storage.buckets
    where id in (
      'crew-documents',
      'crew-portfolio',
      'task-photos',
      'documents',
      'yacht-documents'
    )
      and (
        file_size_limit is null
        or file_size_limit > 26214400
        or allowed_mime_types is null
        or 'text/html' = any(allowed_mime_types)
        or 'image/svg+xml' = any(allowed_mime_types)
      )
  ) then
    raise exception 'A sensitive storage bucket lacks authoritative size/MIME constraints.';
  end if;

  if exists (
    select 1
    from storage.buckets
    where id = 'task-photos'
      and (
        file_size_limit <> 10485760
        or 'image/gif' = any(allowed_mime_types)
        or not allowed_mime_types @> array[
          'image/avif', 'image/jpeg', 'image/png', 'image/webp'
        ]::text[]
      )
  ) then
    raise exception 'Task-photo upload constraints are unsafe or incomplete.';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and cmd = 'SELECT'
      and position('crew-portfolio' in coalesce(qual, '')) > 0
      and (
        'public' = any(roles)
        or 'anon' = any(roles)
      )
  ) then
    raise exception 'Anonymous crew portfolio storage read is enabled.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Crew portfolio owner read'
      and cmd = 'SELECT'
      and 'authenticated' = any(roles)
  ) then
    raise exception 'Crew portfolio owner read policy is missing.';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and cmd = 'UPDATE'
      and (
        position('crew-portfolio' in coalesce(qual, '')) > 0
        or position('crew-portfolio' in coalesce(with_check, '')) > 0
      )
  ) then
    raise exception 'Crew portfolio objects can be overwritten in place.';
  end if;

  if not exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'Authenticated crew portfolio uploads',
        'Authenticated crew portfolio deletes'
      )
      and position(
        'bluedeck_job_application_media_path_locked'
        in coalesce(qual, '') || ' ' || coalesce(with_check, '')
      ) > 0
    having count(*) = 2
  ) then
    raise exception 'Application media paths are not protected from delete/reinsert.';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and (
        lower(btrim(coalesce(qual, ''))) in ('true', '(true)')
        or lower(btrim(coalesce(with_check, ''))) in ('true', '(true)')
      )
  ) then
    raise exception 'An unconditional storage.objects policy is installed.';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in (
        'BlueDeck authenticated storage read',
        'BlueDeck authenticated storage uploads',
        'BlueDeck authenticated storage updates',
        'BlueDeck authenticated storage delete'
      )
  ) then
    raise exception 'A legacy bucket-wide BlueDeck storage policy is installed.';
  end if;
end;
$test$;

rollback;
