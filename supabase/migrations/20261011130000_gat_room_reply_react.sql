-- rooms get replies and reactions like 1:1 chats. additive only.
alter table public.gat_room_messages add column if not exists reply_to uuid;
alter table public.gat_room_messages add column if not exists reactions jsonb not null default '{}'::jsonb;

create or replace function public.gat_room_msg_json(m gat_room_messages)
returns jsonb
language sql
stable
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
  select jsonb_build_object('id', m.id, 'room_id', m.room_id, 'sender_id', m.sender_id, 'body', m.body, 'kind', m.kind, 'created_at', m.created_at,
    'sender', (select public.gat_profile_json(u) from public.gat_users u where u.id = m.sender_id),
    'reactions', coalesce(m.reactions, '{}'::jsonb),
    'reply', (select jsonb_build_object('id', x.id, 'sender_id', x.sender_id, 'body', x.body) from public.gat_room_messages x
              where x.id = m.reply_to and x.kind is distinct from 'removed'));
$function$;

-- same as gat_room_send plus the message it answers (kept as its own function so older clients keep working)
do $$
declare d text;
begin
  if to_regprocedure('public.gat_room_send2(text, uuid, text, uuid)') is null then
    d := pg_get_functiondef('public.gat_room_send'::regproc);
    d := replace(d, 'public.gat_room_send(p_token text, p_room uuid, p_body text)', 'public.gat_room_send2(p_token text, p_room uuid, p_body text, p_reply uuid)');
    d := replace(d, 'insert into public.gat_room_messages (room_id, sender_id, body) values (p_room, u.id, v_body) returning * into m;',
      'insert into public.gat_room_messages (room_id, sender_id, body, reply_to) values (p_room, u.id, v_body, (select x.id from public.gat_room_messages x where x.id = p_reply and x.room_id = p_room)) returning * into m;');
    execute d;
  end if;
end $$;
grant execute on function public.gat_room_send2(text, uuid, text, uuid) to anon, authenticated;

-- one reaction per person per message; the same emoji again takes it back
create or replace function public.gat_room_react(p_token text, p_msg uuid, p_emoji text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare u public.gat_users := public.gat_auth(p_token); m public.gat_room_messages; r public.gat_rooms; v_e text := btrim(coalesce(p_emoji, ''));
begin
  select * into m from public.gat_room_messages where id = p_msg;
  if not found or m.kind is not distinct from 'removed' or not public.gat_room_can(m.room_id, u.id) then raise exception 'not_found' using errcode = 'P0001'; end if;
  if char_length(v_e) < 1 or char_length(v_e) > 16 then raise exception 'body_invalid' using errcode = 'P0001'; end if;
  if coalesce(m.reactions ->> u.id::text, '') = v_e then
    update public.gat_room_messages set reactions = coalesce(reactions, '{}'::jsonb) - u.id::text where id = m.id returning * into m;
  else
    update public.gat_room_messages set reactions = coalesce(reactions, '{}'::jsonb) || jsonb_build_object(u.id::text, v_e) where id = m.id returning * into m;
  end if;
  select * into r from public.gat_rooms where id = m.room_id;
  begin
    perform realtime.send(jsonb_build_object('id', m.id, 'reactions', m.reactions), 'rreact', 'gat:r:' || r.topic::text, false);
  exception when others then raise warning 'gat_room_react: %', sqlerrm;
  end;
  return m.reactions;
end;
$function$;
grant execute on function public.gat_room_react(text, uuid, text) to anon, authenticated;
