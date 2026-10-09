-- Delete chat: each member has a cleared_at; anything at or before it is invisible to them.
-- "for both" sets it for both members. The hourly purge removes the rows for good within 24h.
alter table public.gat_members add column if not exists cleared_at timestamptz not null default 'epoch';

create or replace function public.gat_messages(p_token text, p_conversation uuid, p_before timestamptz default null, p_limit integer default 40)
 returns jsonb language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp' as $function$
declare
  u       public.gat_users := public.gat_auth(p_token);
  v_limit int := least(greatest(coalesce(p_limit, 40), 1), 100);
  v_m     public.gat_members;
begin
  v_m := public.gat_require_member(p_conversation, u.id);
  return coalesce((
    select jsonb_agg(s.j order by s.created_at desc, s.id desc)
    from (
      select public.gat_msg_json(x) as j, x.created_at, x.id
      from public.gat_messages x
      where x.conversation_id = p_conversation
        and x.created_at > v_m.cleared_at
        and (p_before is null or x.created_at < p_before)
      order by x.created_at desc, x.id desc
      limit v_limit
    ) s
  ), '[]'::jsonb);
end;
$function$;

create or replace function public.gat_conv_json(p_conv uuid, p_viewer uuid)
 returns jsonb language sql set search_path to 'public', 'extensions', 'pg_temp' as $function$
  select jsonb_build_object(
    'id', c.id, 'topic', c.topic, 'theme', c.theme, 'theme_by', c.theme_by, 'theme_at', c.theme_at,
    'created_at', c.created_at, 'last_message_at', c.last_message_at,
    'peer', public.gat_profile_json(p),
    'my_last_read_at', me.last_read_at,
    'peer_last_read_at', case when p.show_seen then pm.last_read_at else 'epoch'::timestamptz end,
    'muted', me.muted,
    'status', c.status, 'requester', c.requester, 'declined_at', c.declined_at,
    'my_voice', me.voice, 'peer_voice', pm.voice,
    'my_images', me.images, 'peer_images', pm.images,
    'cleared_at', me.cleared_at,
    'blocked', case
      when exists (select 1 from public.gat_blocks b where b.active and b.blocker = p_viewer and b.blocked = p.id) then 'me'
      when exists (select 1 from public.gat_blocks b where b.active and b.blocker = p.id and b.blocked = p_viewer) then 'them'
      else null end,
    'unread', (select count(*) from public.gat_messages x where x.conversation_id = c.id and x.sender_id = me.peer_id and x.created_at > greatest(me.last_read_at, me.cleared_at)),
    'last_message', (select public.gat_msg_json(x) from public.gat_messages x where x.conversation_id = c.id and x.created_at > me.cleared_at order by x.created_at desc, x.id desc limit 1)
  )
  from public.gat_conversations c
  join public.gat_members me on me.conversation_id = c.id and me.user_id = p_viewer
  join public.gat_members pm on pm.conversation_id = c.id and pm.user_id = me.peer_id
  join public.gat_users p on p.id = me.peer_id
  where c.id = p_conv;
$function$;

create or replace function public.gat_clear(p_token text, p_conversation uuid, p_both boolean)
 returns jsonb language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp' as $function$
declare
  u    public.gat_users := public.gat_auth(p_token);
  v_m  public.gat_members;
  v_at timestamptz := clock_timestamp();
  r    record;
begin
  v_m := public.gat_require_member(p_conversation, u.id);
  update public.gat_members set cleared_at = v_at
   where conversation_id = p_conversation and (user_id = u.id or (coalesce(p_both, false) and user_id = v_m.peer_id));
  for r in select x.inbox from public.gat_users x
           where x.id = u.id or (coalesce(p_both, false) and x.id = v_m.peer_id) loop
    perform realtime.send(jsonb_build_object('conversation_id', p_conversation, 'at', v_at, 'by', u.id), 'wipe', 'gat:u:' || r.inbox::text, false);
  end loop;
  perform public.gat_conv_push(p_conversation);
  return public.gat_conv_json(p_conversation, u.id);
end;
$function$;
grant execute on function public.gat_clear(text, uuid, boolean) to anon, authenticated;
