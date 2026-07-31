begin;

set local timezone = 'UTC';

-- Keep one canonical alert row for each yacht document before enforcing the
-- relationship used by the automatic sync trigger.
with ranked_document_alerts as (
  select
    id,
    row_number() over (
      partition by source_type, source_id
      order by
        (status = 'resolved') desc,
        created_at asc nulls last,
        id
    ) as duplicate_number
  from public.expiry_alerts
  where source_type = 'document'
    and source_id is not null
)
delete from public.expiry_alerts as expiry_alert
using ranked_document_alerts as ranked
where expiry_alert.id = ranked.id
  and ranked.duplicate_number > 1;

create unique index if not exists expiry_alerts_document_source_unique_idx
  on public.expiry_alerts (source_type, source_id)
  where source_type = 'document'
    and source_id is not null;

create index if not exists expiry_alerts_active_window_idx
  on public.expiry_alerts (yacht_id, expiry_date)
  where status <> 'resolved';

create or replace function private.bluedeck_sync_yacht_document_expiry_alert()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  next_alert_level text;
begin
  if tg_op = 'DELETE' then
    delete from public.expiry_alerts
    where source_type = 'document'
      and source_id = old.id;

    return old;
  end if;

  if new.expiry_date is null then
    delete from public.expiry_alerts
    where source_type = 'document'
      and source_id = new.id;

    return new;
  end if;

  next_alert_level := case
    when new.expiry_date < current_date then 'expired'
    when new.expiry_date <= current_date + 14 then 'critical'
    when new.expiry_date <= current_date + 30 then 'warning'
    else 'normal'
  end;

  insert into public.expiry_alerts as existing_alert (
    yacht_id,
    source_type,
    source_id,
    title,
    expiry_date,
    alert_level,
    status
  )
  values (
    new.yacht_id,
    'document',
    new.id,
    coalesce(nullif(btrim(new.title), ''), new.file_name, 'Untitled document'),
    new.expiry_date,
    next_alert_level,
    'active'
  )
  on conflict (source_type, source_id)
    where source_type = 'document'
      and source_id is not null
  do update
  set
    yacht_id = excluded.yacht_id,
    title = excluded.title,
    expiry_date = excluded.expiry_date,
    alert_level = excluded.alert_level,
    status = case
      when existing_alert.expiry_date is distinct from excluded.expiry_date
        then 'active'
      else existing_alert.status
    end;

  return new;
end;
$function$;

revoke all on function
  private.bluedeck_sync_yacht_document_expiry_alert()
from public, anon, authenticated;
grant execute on function
  private.bluedeck_sync_yacht_document_expiry_alert()
to service_role;

drop trigger if exists yacht_documents_sync_expiry_alert
  on public.yacht_documents;
create trigger yacht_documents_sync_expiry_alert
after insert or update of title, file_name, expiry_date or delete
on public.yacht_documents
for each row
execute function private.bluedeck_sync_yacht_document_expiry_alert();

-- Backfill current documents so the automatic three-month window also works
-- for documents uploaded before this migration.
insert into public.expiry_alerts as existing_alert (
  yacht_id,
  source_type,
  source_id,
  title,
  expiry_date,
  alert_level,
  status
)
select
  document.yacht_id,
  'document',
  document.id,
  coalesce(
    nullif(btrim(document.title), ''),
    document.file_name,
    'Untitled document'
  ),
  document.expiry_date,
  case
    when document.expiry_date < current_date then 'expired'
    when document.expiry_date <= current_date + 14 then 'critical'
    when document.expiry_date <= current_date + 30 then 'warning'
    else 'normal'
  end,
  'active'
from public.yacht_documents as document
where document.expiry_date is not null
on conflict (source_type, source_id)
  where source_type = 'document'
    and source_id is not null
do update
set
  yacht_id = excluded.yacht_id,
  title = excluded.title,
  expiry_date = excluded.expiry_date,
  alert_level = excluded.alert_level,
  status = case
    when existing_alert.expiry_date is distinct from excluded.expiry_date
      then 'active'
    else existing_alert.status
  end;

commit;
