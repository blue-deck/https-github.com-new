-- Enforce complete yacht specifications at the publication boundary after the
-- application rollout understands the expanded nullable schema. This separate
-- trigger intentionally runs after `job_posts_prepare_write` by trigger-name
-- order and before the listing-number guard.

begin;

create or replace function private.bluedeck_enforce_job_post_yacht_details()
returns trigger
language plpgsql
set search_path = pg_catalog, public, private
as $function$
begin
  -- Terminal transitions are allowed for legacy published listings whose yacht
  -- details predate this feature. They must retain their original snapshot,
  -- including an all-null legacy snapshot, during manual or automatic closure.
  if tg_op = 'UPDATE'
    and old.status in ('draft', 'published')
    and new.status = 'closed'
  then
    new.yacht_type := old.yacht_type;
    new.yacht_length := old.yacht_length;
    new.yacht_length_unit := old.yacht_length_unit;
    return new;
  end if;

  new.yacht_type := nullif(
    lower(btrim(coalesce(new.yacht_type, ''))),
    ''
  );
  new.yacht_length_unit := nullif(
    lower(btrim(coalesce(new.yacht_length_unit, ''))),
    ''
  );

  if new.status = 'published'
    and (
      new.yacht_type is null
      or new.yacht_length is null
      or new.yacht_length_unit is null
    )
  then
    raise exception using
      errcode = '23514',
      message = 'Published job posts require yacht type, length and length unit.';
  end if;

  return new;
end;
$function$;

revoke all on function private.bluedeck_enforce_job_post_yacht_details()
  from public, anon, authenticated, service_role;

drop trigger if exists job_posts_y_yacht_details_guard
  on public.job_posts;
create trigger job_posts_y_yacht_details_guard
before insert or update on public.job_posts
for each row execute function private.bluedeck_enforce_job_post_yacht_details();

comment on function private.bluedeck_enforce_job_post_yacht_details() is
  'Normalizes job yacht specifications, requires complete published details and preserves legacy snapshots during closure.';

commit;
