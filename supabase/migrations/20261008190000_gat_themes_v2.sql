-- Theme list: plain themes dropped, batman / love / bff / lust added.
create or replace function public.gat_theme(p_token text, p_conversation uuid, p_theme text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  u         public.gat_users := public.gat_auth(p_token);
  v_m       public.gat_members;
  v_c       public.gat_conversations;
  v_inbox   uuid;
  v_payload jsonb;
begin
  if p_theme is null or p_theme not in (
    'goofy', 'cherry', 'midnight', 'matcha', 'lagoon', 'lavender', 'terminal',
    'bubblegum', 'citrus', 'aurora', 'forest', 'y2k', 'batman', 'love', 'bff', 'lust'
  ) then
    raise exception 'theme_invalid' using errcode = 'P0001';
  end if;
  v_m := public.gat_require_member(p_conversation, u.id);

  update public.gat_conversations
     set theme = p_theme, theme_by = u.id, theme_at = now()
   where id = p_conversation
  returning * into v_c;

  insert into public.gat_messages (id, conversation_id, sender_id, kind, body)
  values (gen_random_uuid(), p_conversation, u.id, 'theme', p_theme);

  select inbox into v_inbox from public.gat_users where id = v_m.peer_id;
  v_payload := jsonb_build_object(
    'conversation_id', v_c.id, 'theme', v_c.theme, 'theme_by', v_c.theme_by, 'theme_at', v_c.theme_at);
  perform realtime.send(v_payload, 'theme', 'gat:u:' || v_inbox::text, false);
  perform realtime.send(v_payload, 'theme', 'gat:u:' || u.inbox::text, false);

  return public.gat_conv_json(p_conversation, u.id);
end;
$function$;
