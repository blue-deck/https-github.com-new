-- Transactional assertions: only disposable fixtures are written, then rolled back.
begin;
do $$
declare
  fixture_id uuid;
  fixture_slug text := 'blog-smoke-' || replace(gen_random_uuid()::text, '-', '');
  document jsonb;
  live_document jsonb;
  original_published_at timestamptz;
  revision integer;
  changed integer;
begin
  if not (select relrowsecurity from pg_class where oid = 'public.blog_posts'::regclass) then
    raise exception 'blog_posts must enable RLS';
  end if;
  if has_table_privilege('anon', 'public.blog_posts', 'SELECT,INSERT,UPDATE,DELETE') or
     has_table_privilege('authenticated', 'public.blog_posts', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Client roles must not access blog drafts or mutate publications';
  end if;
  if not has_table_privilege('service_role', 'public.blog_posts', 'SELECT,INSERT,UPDATE,DELETE') then
    raise exception 'Server role needs blog CRUD permissions';
  end if;
  if has_function_privilege('anon', 'public.blog_posts_before_update()', 'EXECUTE') or
     has_function_privilege('authenticated', 'public.blog_posts_before_update()', 'EXECUTE') then
    raise exception 'Trigger function cannot be an exposed client endpoint';
  end if;
  if not exists (select 1 from storage.buckets where id = 'blog-media' and public
      and file_size_limit = 4194304 and allowed_mime_types = array['image/webp']) then
    raise exception 'Public media bucket must enforce format and size';
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'blog_media_owner_server_write_guard' and permissive = 'RESTRICTIVE') then
    raise exception 'Client writes to blog media require a restrictive guard';
  end if;

  select jsonb_set(draft, '{slug}', to_jsonb(fixture_slug)) into document
  from public.blog_posts where slug = 'first-yacht-job';
  if document is null then raise exception 'Seed article must exist'; end if;
  insert into public.blog_posts (slug, draft) values (fixture_slug, document) returning id into fixture_id;
  if (select status <> 'draft' or published is not null or version <> 1 from public.blog_posts where id = fixture_id) then
    raise exception 'New articles must begin unpublished';
  end if;
  begin
    update public.blog_posts set status = 'published' where id = fixture_id;
    raise exception 'Publication without snapshot must fail';
  exception when check_violation then null;
  end;

  update public.blog_posts set status = 'published', published = draft,
    published_at = now(), published_updated_at = now() where id = fixture_id;
  select published, published_at, version into live_document, original_published_at, revision
    from public.blog_posts where id = fixture_id;
  update public.blog_posts set draft = jsonb_set(draft, '{content,en,title}', '"Unpublished edit"')
    where id = fixture_id and version = revision;
  if (select published is distinct from live_document or published_at <> original_published_at
      or status <> 'published' or version <> revision + 1 from public.blog_posts where id = fixture_id) then
    raise exception 'Draft save must preserve live snapshot and increment version';
  end if;

  update public.blog_posts set status = 'archived' where id = fixture_id and version = revision;
  get diagnostics changed = row_count;
  if changed <> 0 then raise exception 'Stale optimistic update must affect zero rows'; end if;
  select version into revision from public.blog_posts where id = fixture_id;
  update public.blog_posts set published = draft, published_updated_at = clock_timestamp()
    where id = fixture_id and version = revision;
  if (select published->'content'->'en'->>'title' <> 'Unpublished edit' from public.blog_posts where id = fixture_id) then
    raise exception 'Explicit publication must commit edited snapshot';
  end if;
  begin
    update public.blog_posts set slug = fixture_slug || '-changed',
      draft = jsonb_set(draft, '{slug}', to_jsonb(fixture_slug || '-changed')),
      published = jsonb_set(published, '{slug}', to_jsonb(fixture_slug || '-changed')) where id = fixture_id;
    raise exception 'A previously published URL must remain stable';
  exception when check_violation then null;
  end;

  update public.blog_posts set status = 'draft' where id = fixture_id;
  if exists (select 1 from public.blog_posts where id = fixture_id and status = 'published') then
    raise exception 'Unpublished article must disappear from public reads';
  end if;
  update public.blog_posts set status = 'archived' where id = fixture_id;
  update public.blog_posts set status = 'draft' where id = fixture_id;
  if (select published is null from public.blog_posts where id = fixture_id) then
    raise exception 'Archive/restore must preserve recoverable publication content';
  end if;
  raise notice 'Blog permissions, snapshots, state transitions and optimistic locking passed';
end;
$$;
rollback;
