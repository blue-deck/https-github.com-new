-- Keep public Crew IDs as short as legacy IDs without deriving them from
-- either the Auth UUID or crew profile UUID.

begin;

-- The table is small and Crew IDs are assigned only during profile creation.
-- Block concurrent writers while the long-form IDs are replaced so the
-- case-insensitive unique index remains the final collision guard.
lock table public.crew_profiles in share row exclusive mode;

drop trigger if exists crew_profiles_00_guard_public_crew_id
  on public.crew_profiles;

do $block$
declare
  target record;
  candidate text;
begin
  for target in
    select profile.id
    from public.crew_profiles as profile
    where upper(btrim(profile.public_crew_id)) ~ '^BD-?[A-F0-9]{32}$'
    order by profile.id
  loop
    loop
      candidate := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
      exit when not exists (
        select 1
        from public.crew_profiles as existing
        where existing.id <> target.id
          and upper(btrim(existing.public_crew_id)) = candidate
      );
    end loop;

    update public.crew_profiles
    set public_crew_id = candidate
    where id = target.id;
  end loop;
end;
$block$;

create or replace function private.bluedeck_guard_public_crew_id()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $function$
declare
  candidate text;
begin
  if tg_op = 'UPDATE' then
    if old.public_crew_id is null and new.public_crew_id is not null then
      loop
        candidate := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
        exit when not exists (
          select 1
          from public.crew_profiles as existing
          where upper(btrim(existing.public_crew_id)) = candidate
        );
      end loop;

      new.public_crew_id := candidate;
      return new;
    end if;

    if new.public_crew_id is distinct from old.public_crew_id then
      raise exception using
        errcode = '42501',
        message = 'A public Crew ID is immutable.';
    end if;

    return new;
  end if;

  loop
    candidate := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    exit when not exists (
      select 1
      from public.crew_profiles as existing
      where upper(btrim(existing.public_crew_id)) = candidate
    );
  end loop;

  new.public_crew_id := candidate;
  return new;
end;
$function$;

create trigger crew_profiles_00_guard_public_crew_id
before insert or update of public_crew_id on public.crew_profiles
for each row execute function private.bluedeck_guard_public_crew_id();

revoke all on function private.bluedeck_guard_public_crew_id()
  from public, anon, authenticated, service_role;

comment on function private.bluedeck_guard_public_crew_id() is
  'Assigns immutable, collision-checked, random eight-character public Crew IDs.';

commit;
