-- a temp account can become a kept one in place: same id, so chats, friends and streaks stay
create or replace function public.gat_keep(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare u public.gat_users := public.gat_auth(p_token);
begin
  if u.is_temp then
    update public.gat_users set is_temp = false where id = u.id returning * into u;
  end if;
  return jsonb_build_object('me', public.gat_me_json(u));
end;
$function$;
grant execute on function public.gat_keep(text) to anon, authenticated;
