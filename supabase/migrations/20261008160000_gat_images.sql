-- Per conversation image sharing consent. Both members must opt in.
alter table public.gat_members add column if not exists images boolean not null default false;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('gat-img', 'gat-img', true, 6291456, array['image/jpeg','image/png','image/webp','image/gif'])
on conflict (id) do nothing;

create policy "gat img read" on storage.objects for select using (bucket_id = 'gat-img');
create policy "gat img upload" on storage.objects for insert with check (bucket_id = 'gat-img');

create or replace function public.gat_conv_json(p_conv uuid, p_viewer uuid)
 returns jsonb
 language sql
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
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
    'blocked', case
      when exists (select 1 from public.gat_blocks b where b.active and b.blocker = p_viewer and b.blocked = p.id) then 'me'
      when exists (select 1 from public.gat_blocks b where b.active and b.blocker = p.id and b.blocked = p_viewer) then 'them'
      else null end,
    'unread', (select count(*) from public.gat_messages x where x.conversation_id = c.id and x.sender_id = me.peer_id and x.created_at > me.last_read_at),
    'last_message', (select public.gat_msg_json(x) from public.gat_messages x where x.conversation_id = c.id order by x.created_at desc, x.id desc limit 1)
  )
  from public.gat_conversations c
  join public.gat_members me on me.conversation_id = c.id and me.user_id = p_viewer
  join public.gat_members pm on pm.conversation_id = c.id and pm.user_id = me.peer_id
  join public.gat_users p on p.id = me.peer_id
  where c.id = p_conv;
$function$;

create or replace function public.gat_set_images(p_token text, p_conversation uuid, p_on boolean)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare u public.gat_users := public.gat_auth(p_token);
begin
  update public.gat_members set images = coalesce(p_on, false) where conversation_id = p_conversation and user_id = u.id;
  if not found then raise exception 'forbidden' using errcode = 'P0001'; end if;
  perform public.gat_conv_push(p_conversation);
  return public.gat_conv_json(p_conversation, u.id);
end;
$function$;

grant execute on function public.gat_set_images(text, uuid, boolean) to anon, authenticated;
