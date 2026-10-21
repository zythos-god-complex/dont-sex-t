-- Photos and voice notes are private to the chat they were sent in. Every read is checked against the account's
-- token (sent as the x-gat-token header), so nothing opens from a plain link and nothing can be listed.

-- the database's own cleanup (purge, unsend, view once) proves itself with this key instead of a token
insert into public.gat_config (key, value) values ('purge_key', encode(extensions.gen_random_bytes(24), 'hex')) on conflict (key) do nothing;
create or replace function public.gat_purge_key()
 returns text language sql stable security definer
 set search_path to 'public', 'pg_temp'
as $f$ select value from public.gat_config where key = 'purge_key' $f$;
revoke all on function public.gat_purge_key() from public, anon, authenticated;

-- 'gat-img/<user>/<file>' out of a message body like [[img:https://host/storage/v1/object/public/gat-img/<user>/<file>|w|h]]
create or replace function public.gat_media_key(b text)
 returns text language sql immutable parallel safe
 set search_path to 'pg_catalog'
as $f$ select substring(b from '^\[\[(?:img|voice):https://[^|\]/]+/storage/v1/object/public/([^|\]]+)') $f$;
create index if not exists gat_messages_media_idx on public.gat_messages (public.gat_media_key(body));
create index if not exists gat_room_messages_media_idx on public.gat_room_messages (public.gat_media_key(body));

-- may this request read this file? yes for the database's own cleanup, for the account that uploaded it,
-- and for anyone who is in a chat (or room) with a message that carries it
create or replace function public.gat_media_ok(p_bucket text, p_name text)
 returns boolean language plpgsql stable security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $f$
declare
  h json;
  v_pk text;
  v_tok text;
  v_u uuid;
  v_key text := p_bucket || '/' || p_name;
begin
  begin
    h := current_setting('request.headers', true)::json;
  exception when others then
    h := null;
  end;
  if h is null then return false; end if;

  v_pk := h ->> 'x-gat-purge';
  if v_pk is not null and v_pk <> '' and v_pk = public.gat_purge_key() then return true; end if;

  v_tok := h ->> 'x-gat-token';
  if v_tok is null or v_tok = '' then return false; end if;
  select id into v_u from public.gat_users
   where token_hash = extensions.digest(v_tok, 'sha256') and not banned and (banned_until is null or banned_until <= now());
  if v_u is null then return false; end if;

  -- your own upload, before and after it is sent
  if split_part(p_name, '/', 1) = v_u::text then return true; end if;
  if p_bucket not in ('gat-img', 'gat-voice') then return false; end if;

  return exists (
           select 1 from public.gat_messages m
             join public.gat_members mem on mem.conversation_id = m.conversation_id and mem.user_id = v_u
            where public.gat_media_key(m.body) = v_key and m.created_at > coalesce(mem.cleared_at, '-infinity'::timestamptz))
      or exists (
           select 1 from public.gat_room_messages rm
             join public.gat_rooms r on r.id = rm.room_id
            where public.gat_media_key(rm.body) = v_key and rm.kind <> 'removed'
              and (r.kind = 'public' or exists (select 1 from public.gat_room_members x where x.room_id = r.id and x.user_id = v_u and x.active)));
end;
$f$;
-- (storage evaluates the policy as the caller, so this one stays callable; without a valid token it just says no)

-- the cleanup calls carry the key
do $do$
declare
  d text;
  fn text;
  old text := 'jsonb_build_object(''apikey'', ''sb_publishable_wCY80oH-5UNwFCgyE3O2iQ_FBlU57ws'')';
  new text := 'jsonb_build_object(''apikey'', ''sb_publishable_wCY80oH-5UNwFCgyE3O2iQ_FBlU57ws'', ''x-gat-purge'', public.gat_purge_key())';
begin
  foreach fn in array array['public.gat_purge()', 'public.gat_open_once(text,uuid)', 'public.gat_unsend(text,uuid)'] loop
    d := pg_get_functiondef(fn::regprocedure);
    if position('x-gat-purge' in d) = 0 and position(old in d) > 0 then
      execute replace(d, old, new);
    end if;
  end loop;
end
$do$;

-- reading a file needs the check above (profile photos stay readable by address, but cannot be listed)
alter policy "gat img read" on storage.objects using (bucket_id = 'gat-img' and public.gat_media_ok(bucket_id, name));
alter policy "gat voice read" on storage.objects using (bucket_id = 'gat-voice' and public.gat_media_ok(bucket_id, name));
alter policy "gat pfp read" on storage.objects using (bucket_id = 'gat-pfp' and public.gat_media_ok(bucket_id, name));

-- no public links to chat photos or voice notes
update storage.buckets set public = false where id in ('gat-img', 'gat-voice');
