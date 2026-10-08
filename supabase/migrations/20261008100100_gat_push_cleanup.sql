-- GoofyAhhTalk: push subscription cleanup RPCs.
--
-- STATUS: NOT YET APPLIED to afxnqxxntxfawcgxmyac.
-- These function bodies contain DELETE statements, and the Supabase MCP server only runs
-- SQL with DELETE after an interactive human confirmation, which the build agent could not give.
-- Apply it once (Supabase SQL editor, or approve the confirmation prompt). It is idempotent.
--
-- Adds:
--   gat_push_subscribe     (replaced) upsert + keep at most 10 subs per user (drop oldest)
--   gat_push_unsubscribe   deletes only if owned by caller
--   gat_push_prune         secret-gated; deletes the given endpoints (404/410 from push services)

create or replace function public.gat_push_subscribe(
  p_token text,
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_ua text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  u public.gat_users := public.gat_auth(p_token);
begin
  if coalesce(p_endpoint, '') = '' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'body_invalid' using errcode = 'P0001';
  end if;

  insert into public.gat_push_subs (endpoint, user_id, p256dh, auth, ua)
  values (p_endpoint, u.id, p_p256dh, p_auth, p_ua)
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        ua = excluded.ua,
        created_at = now();

  -- keep at most 10 per user (drop oldest)
  delete from public.gat_push_subs
   where endpoint in (
     select endpoint from public.gat_push_subs
      where user_id = u.id
      order by created_at desc, endpoint
      offset 10
   );
end;
$$;

create or replace function public.gat_push_unsubscribe(p_token text, p_endpoint text)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  u public.gat_users := public.gat_auth(p_token);
begin
  delete from public.gat_push_subs where endpoint = p_endpoint and user_id = u.id;
end;
$$;

create or replace function public.gat_push_prune(p_secret text, p_endpoints text[])
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_secret text;
begin
  select value into v_secret from public.gat_config where key = 'push_secret';
  if v_secret is null or v_secret = '' or p_secret is null or p_secret <> v_secret then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  delete from public.gat_push_subs where endpoint = any (coalesce(p_endpoints, '{}'::text[]));
end;
$$;

revoke all on function
  public.gat_push_subscribe(text, text, text, text, text),
  public.gat_push_unsubscribe(text, text),
  public.gat_push_prune(text, text[])
from public;

grant execute on function
  public.gat_push_subscribe(text, text, text, text, text),
  public.gat_push_unsubscribe(text, text),
  public.gat_push_prune(text, text[])
to anon, authenticated;

notify pgrst, 'reload schema';
