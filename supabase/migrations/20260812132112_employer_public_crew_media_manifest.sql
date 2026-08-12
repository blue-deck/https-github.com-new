-- Give employer application cards and profile dialogs the same current media
-- as the public Crew directory without weakening either boundary. The
-- application server calls this bounded service-only projection once per
-- page, then exposes only the existing same-origin public media proxy URLs.

begin;

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
as $function$
declare
  requested_profile_ids uuid[];
begin
  if p_profile_ids is null or cardinality(p_profile_ids) > 50 then
    raise exception using
      errcode = '22023',
      message = 'Between zero and 50 crew profile IDs are required.';
  end if;

  select coalesce(array_agg(distinct requested.profile_id), '{}'::uuid[])
  into requested_profile_ids
  from unnest(p_profile_ids) as requested(profile_id)
  where requested.profile_id is not null;

  return query
  select
    profile.id as profile_id,
    profile.user_id,
    upper(btrim(profile.public_crew_id)) as public_crew_id,
    coalesce(profile.profile_photo_url, '') as avatar_source,
    case
      when coalesce(p_include_gallery, false) then coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id', selected_photo.id,
              'image_url', selected_photo.image_url,
              'created_at', selected_photo.created_at
            )
            order by selected_photo.created_at desc, selected_photo.id desc
          )
          from (
            select photo.id, photo.image_url, photo.created_at
            from public.crew_portfolio_photos as photo
            where photo.crew_profile_id = profile.id
              and nullif(btrim(photo.image_url), '') is not null
            order by photo.created_at desc, photo.id desc
            limit 100
          ) as selected_photo
        ),
        '[]'::jsonb
      )
      else '[]'::jsonb
    end as gallery
  from public.crew_profiles as profile
  inner join public.marketplace_entitlements as entitlement
    on entitlement.user_id = profile.user_id
   and entitlement.account_role in ('crew', 'captain')
  inner join auth.users as account
    on account.id = profile.user_id
   and account.email_confirmed_at is not null
   and account.deleted_at is null
   and (
     account.banned_until is null
     or account.banned_until <= statement_timestamp()
   )
  where profile.id = any(requested_profile_ids)
    and profile.status = 'active'
    and profile.user_id is not null
    and profile.public_crew_id is not null
    and upper(btrim(profile.public_crew_id)) ~ '^[A-Z0-9_-]{1,64}$'
  order by profile.id;
end;
$function$;

revoke all on function public.bluedeck_public_crew_media_manifest(
  uuid[], boolean
) from public, anon, authenticated;
grant execute on function public.bluedeck_public_crew_media_manifest(
  uuid[], boolean
) to service_role;

comment on function public.bluedeck_public_crew_media_manifest(
  uuid[], boolean
) is
  'Service-only bounded media projection for currently eligible public Crew/Captain profiles; employer application APIs convert sources to public proxy URLs.';

commit;
