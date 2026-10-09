-- Admin moderation in public rooms: the admin account can remove any message.
-- The text is overwritten (not just hidden) and every client swaps in a 'removed' tombstone.
alter table public.gat_users add column if not exists is_admin boolean not null default false;
update public.gat_users set is_admin = true where lower(username) = 'admin' and not is_admin;

create or replace function public.gat_profile_json(u gat_users)
 returns jsonb
 language sql
 stable
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
  select case when u.id is null then null else jsonb_build_object(
    'id', u.id, 'username', u.username, 'gender', u.gender, 'last_seen_at', u.last_seen_at,
    'avatar', u.avatar, 'show_status', u.show_status, 'show_seen', u.show_seen, 'temp', u.is_temp, 'nsfw', u.nsfw,
    'vip', u.perks, 'flair', case when u.perks then u.flair else null end, 'admin', u.is_admin
  ) end;
$function$;

create or replace function public.gat_room_remove(p_token text, p_msg uuid)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  u public.gat_users := public.gat_auth(p_token);
  m public.gat_room_messages;
  r public.gat_rooms;
  v jsonb;
begin
  if not u.is_admin then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  select * into m from public.gat_room_messages where id = p_msg;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  select * into r from public.gat_rooms where id = m.room_id;
  if r.kind <> 'public' then raise exception 'not_found' using errcode = 'P0001'; end if;
  update public.gat_room_messages set body = 'removed', kind = 'removed' where id = p_msg returning * into m;
  v := public.gat_room_msg_json(m);
  begin
    perform realtime.send(v, 'rdel', 'gat:r:' || r.topic::text, false);
  exception when others then raise warning 'gat_room_remove: %', sqlerrm;
  end;
  return v;
end;
$function$;

revoke all on function public.gat_room_remove(text, uuid) from public;
grant execute on function public.gat_room_remove(text, uuid) to anon, authenticated;
