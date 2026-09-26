-- Additive metadata for Captain Workspace. Existing model, flag, ownership,
-- crew memberships and operational records remain unchanged.
begin;

alter table public.yachts
  add column yacht_type text,
  add column crew_size integer,
  add column photo_path text;

alter table public.yachts
  add constraint yachts_workspace_type_check check (
    yacht_type is null or yacht_type in (
      'motor_yacht', 'sailing_yacht', 'catamaran', 'motor_catamaran',
      'gulet', 'expedition_yacht', 'classic_yacht', 'support_vessel',
      'chase_boat', 'commercial_vessel', 'new_build'
    )
  ),
  add constraint yachts_workspace_crew_size_check check (
    crew_size is null or crew_size between 0 and 999
  ),
  add constraint yachts_workspace_photo_path_check check (
    photo_path is null or (
      owner_id is not null
      and photo_path ~ ('^' || owner_id::text || '/' || id::text || '/[a-f0-9-]{36}\.(jpg|png|webp|avif)$')
    )
  );

-- No anon/authenticated object policy is granted. Uploads, removals and
-- expiring signed URLs are issued by the authenticated owner-only API.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'yacht-photos', 'yacht-photos', false, 4194304,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[]
);

comment on column public.yachts.crew_size is
  'Declared onboard crew size for the yacht card; separate from invited BlueDeck members.';
comment on column public.yachts.photo_path is
  'Private yacht-photos object path, bound to the yacht owner and yacht ID.';

notify pgrst, 'reload schema';
commit;
