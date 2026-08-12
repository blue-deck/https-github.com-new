-- Internal, bounded projection of media that is currently eligible for the
-- public crew directory. Employer application APIs use this to display the
-- same avatar/gallery as the public profile without exposing storage paths.
create or replace function public.bluedeck_public_crew_media_manifest(
  p_profile_ids uuid[],
  p_include_gallery boolean default false
)
returns table (
  profile_id uuid,
  user_id uuid,
  public_crew_id text,
  avatar_source text,
  gallery jsonb
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
declare
  requested_profile_ids uuid[];
begin
  if coalesce(cardinality(p_profile_ids), 0) > 50 then
    raise exception 'Too many profile ids requested'
      using errcode = '22023';
  end if;

  select coalesce(array_agg(requested.profile_id order by requested.profile_id), '{}'::uuid[])
    into requested_profile_ids
  from (
    select distinct unnest(p_profile_ids) as profile_id
  ) requested
  where requested.profile_id is not null;

  if cardinality(requested_profile_ids) = 0 then
    return;
  end if;

  return query
  select
    profile.id,
    profile.user_id,
    upper(btrim(profile.public_crew_id)),
    coalesce(profile.profile_photo_url, ''),
    case
      when coalesce(p_include_gallery, false) then coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', photo.id,
              'image_url', photo.image_url,
              'created_at', photo.created_at
            )
            order by photo.created_at desc, photo.id desc
          )
          from (
            select gallery_photo.id, gallery_photo.image_url, gallery_photo.created_at
            from public.crew_portfolio_photos gallery_photo
            where gallery_photo.crew_profile_id = profile.id
            order by gallery_photo.created_at desc, gallery_photo.id desc
            limit 100
          ) photo
        ),
        '[]'::jsonb
      )
      else '[]'::jsonb
    end
  from public.crew_profiles profile
  join public.app_users app_user
    on app_user.id = profile.user_id
   and app_user.role in ('crew', 'captain')
  join auth.users auth_user
    on auth_user.id = profile.user_id
   and auth_user.email_confirmed_at is not null
   and auth_user.deleted_at is null
   and (
     auth_user.banned_until is null
     or auth_user.banned_until <= pg_catalog.now()
   )
  where profile.id = any(requested_profile_ids)
    and profile.status = 'active'
    and nullif(btrim(profile.public_crew_id), '') is not null
    and upper(btrim(profile.public_crew_id)) ~ '^[A-Z0-9_-]{1,64}$';
end;
$$;

revoke all on function public.bluedeck_public_crew_media_manifest(uuid[], boolean)
  from public, anon, authenticated;
grant execute on function public.bluedeck_public_crew_media_manifest(uuid[], boolean)
  to service_role;

comment on function public.bluedeck_public_crew_media_manifest(uuid[], boolean) is
  'Service-role-only bounded manifest for currently public crew avatar/gallery media.';
