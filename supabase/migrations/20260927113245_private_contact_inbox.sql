begin;

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 120 and char_length(btrim(name)) > 0),
  email text not null check (
    char_length(email) between 3 and 254 and email = lower(btrim(email))
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  ),
  topic text not null check (topic in ('account', 'recruitment', 'yacht-os', 'general')),
  message text not null check (char_length(message) between 1 and 2000 and char_length(btrim(message)) > 0),
  language text not null check (language in ('en', 'tr')),
  status text not null default 'unread' check (status in ('unread', 'read', 'archived'))
);

create index contact_messages_status_created_id_idx on public.contact_messages (status, created_at desc, id desc);
create index contact_messages_created_id_idx on public.contact_messages (created_at desc, id desc);
create index contact_messages_email_created_idx on public.contact_messages (email, created_at desc);

alter table public.contact_messages enable row level security;
revoke all on table public.contact_messages from public, anon, authenticated, service_role;
grant select, insert on table public.contact_messages to service_role;
grant update (status) on table public.contact_messages to service_role;

create function public.contact_messages_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := greatest(clock_timestamp(), old.updated_at + interval '1 microsecond');
  return new;
end;
$$;
revoke all on function public.contact_messages_set_updated_at() from public, anon, authenticated, service_role;

create trigger contact_messages_set_updated_at
before update on public.contact_messages
for each row execute function public.contact_messages_set_updated_at();

-- Only the server can submit after verifying the origin, input, and Turnstile.
-- Locks make the quotas durable and atomic across concurrent server instances.
create function public.submit_contact_message(
  p_name text, p_email text, p_topic text, p_message text, p_language text
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_email text := lower(btrim(p_email));
  submitted_at timestamptz;
  message_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('bluedeck:contact-submissions', 0));
  perform pg_advisory_xact_lock(hashtextextended('bluedeck:contact-email:' || normalized_email, 0));
  submitted_at := clock_timestamp();

  if (select count(*) from public.contact_messages
      where email = normalized_email and created_at > submitted_at - interval '1 hour') >= 3 then
    raise exception using errcode = 'P0001', message = 'contact_email_rate_limit';
  end if;
  if (select count(*) from public.contact_messages
      where created_at > submitted_at - interval '24 hours') >= 1000 then
    raise exception using errcode = 'P0001', message = 'contact_global_rate_limit';
  end if;

  insert into public.contact_messages (name, email, topic, message, language, created_at, updated_at)
  values (btrim(p_name), normalized_email, p_topic, btrim(p_message), p_language, submitted_at, submitted_at)
  returning id into message_id;
  return message_id;
end;
$$;

revoke all on function public.submit_contact_message(text, text, text, text, text) from public, anon, authenticated, service_role;
grant execute on function public.submit_contact_message(text, text, text, text, text) to service_role;

comment on table public.contact_messages is 'Private site-admin contact inbox. No client role has table access; server authorization selects the designated administrator.';

commit;
