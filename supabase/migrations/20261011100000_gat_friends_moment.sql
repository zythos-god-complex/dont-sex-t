-- When an add makes two people mutual friends, drop a "you're friends now" line in the chat (it also pushes like any message).
create or replace function public.gat_friend(p_token text, p_conversation uuid, p_on boolean)
 returns jsonb language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  u public.gat_users := public.gat_auth(p_token);
  was boolean;
  is_now boolean;
begin
  select bool_and(friend) and count(*) = 2 into was from public.gat_members where conversation_id = p_conversation;
  update public.gat_members set friend = coalesce(p_on, false) where conversation_id = p_conversation and user_id = u.id;
  if not found then raise exception 'forbidden' using errcode = 'P0001'; end if;
  select bool_and(friend) and count(*) = 2 into is_now from public.gat_members where conversation_id = p_conversation;
  if is_now and not coalesce(was, false) then
    begin
      perform public.gat_send(p_token, p_conversation, gen_random_uuid(), '[[friends]]');
    exception when others then null;
    end;
  end if;
  perform public.gat_conv_push(p_conversation);
  return public.gat_conv_json(p_conversation, u.id);
end;
$function$;
