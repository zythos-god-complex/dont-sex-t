-- Remove a chat from your DM list: clears it for you and hides it until a new message comes in.
alter table public.gat_members add column if not exists hidden_at timestamptz;

create or replace function public.gat_hide_chat(p_token text, p_conversation uuid)
 returns boolean language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  u public.gat_users := public.gat_auth(p_token);
begin
  perform public.gat_require_member(p_conversation, u.id);
  update public.gat_members set hidden_at = now(), cleared_at = now(), last_read_at = now()
   where conversation_id = p_conversation and user_id = u.id;
  return true;
end;
$function$;

do $do$
declare d text;
begin
  select pg_get_functiondef('public.gat_conversations(text)'::regprocedure) into d;
  if position('hidden_at' in d) = 0 then
    d := replace(d, 'where m.user_id = u.id', 'where m.user_id = u.id and (m.hidden_at is null or coalesce(c.last_message_at, c.created_at) > m.hidden_at)');
    execute d;
  end if;
end;
$do$;

revoke all on function public.gat_hide_chat(text, uuid) from public;
grant execute on function public.gat_hide_chat(text, uuid) to anon, authenticated;
