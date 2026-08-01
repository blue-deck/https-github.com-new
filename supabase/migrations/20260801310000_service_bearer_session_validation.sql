begin;

create or replace function private.bluedeck_has_live_authenticated_session()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select
    coalesce(auth.jwt() ->> 'session_id', '') <> ''
    and case
      when jsonb_typeof(auth.jwt() -> 'amr') = 'array' then
        jsonb_array_length(auth.jwt() -> 'amr') > 0
        and exists (
          select 1
          from jsonb_array_elements(auth.jwt() -> 'amr') as authentication_method(value)
          where lower(btrim(
            case jsonb_typeof(authentication_method.value)
              when 'object' then authentication_method.value ->> 'method'
              when 'string' then authentication_method.value #>> '{}'
              else ''
            end
          )) = 'password'
        )
        and not exists (
          select 1
          from jsonb_array_elements(auth.jwt() -> 'amr') as authentication_method(value)
          where
            jsonb_typeof(authentication_method.value) not in ('object', 'string')
            or (
              jsonb_typeof(authentication_method.value) = 'object'
              and (
                jsonb_typeof(authentication_method.value -> 'method')
                  is distinct from 'string'
                or btrim(authentication_method.value ->> 'method') = ''
                or lower(btrim(authentication_method.value ->> 'method')) not in (
                  'password',
                  'totp',
                  'mfa/phone',
                  'mfa/webauthn',
                  'token_refresh'
                )
              )
            )
            or (
              jsonb_typeof(authentication_method.value) = 'string'
              and (
                btrim(authentication_method.value #>> '{}') = ''
                or lower(btrim(authentication_method.value #>> '{}')) not in (
                  'password',
                  'totp',
                  'mfa/phone',
                  'mfa/webauthn',
                  'token_refresh'
                )
              )
            )
        )
      else false
    end
    and exists (
      select 1
      from auth.sessions as account_session
      where account_session.id::text = auth.jwt() ->> 'session_id'
        and account_session.user_id = auth.uid()
        and (
          account_session.not_after is null
          or account_session.not_after > statement_timestamp()
        )
    );
$function$;

create or replace function public.bluedeck_bearer_session_is_live(
  p_user_id uuid,
  p_session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $function$
  select
    p_user_id is not null
    and p_session_id is not null
    and public.bluedeck_account_is_ready(p_user_id)
    and exists (
      select 1
      from auth.sessions as account_session
      where account_session.id = p_session_id
        and account_session.user_id = p_user_id
        and (
          account_session.not_after is null
          or account_session.not_after > statement_timestamp()
        )
    );
$function$;

revoke all on function private.bluedeck_has_live_authenticated_session()
  from public, anon, authenticated, service_role;
revoke all on function public.bluedeck_bearer_session_is_live(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.bluedeck_bearer_session_is_live(uuid, uuid)
  to service_role;

comment on function public.bluedeck_bearer_session_is_live(uuid, uuid) is
  'Service-only check that binds a verified bearer subject to a current, unexpired Auth session and a ready account.';

comment on function private.bluedeck_has_live_authenticated_session() is
  'Requires a live BlueDeck password session and rejects generic OTP, recovery, signup, invitation and other proof-only JWTs at the RLS boundary.';

commit;
