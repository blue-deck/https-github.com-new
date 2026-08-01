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
