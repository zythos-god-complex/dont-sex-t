-- Friends: each side of a chat can add the other; when both have, the chat moves from strangers to dms.
alter table public.gat_members add column if not exists friend boolean not null default false;

create or replace function public.gat_friend(p_token text, p_conversation uuid, p_on boolean)
 returns jsonb language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare u public.gat_users := public.gat_auth(p_token);
begin
  update public.gat_members set friend = coalesce(p_on, false) where conversation_id = p_conversation and user_id = u.id;
  if not found then raise exception 'forbidden' using errcode = 'P0001'; end if;
  perform public.gat_conv_push(p_conversation);
  return public.gat_conv_json(p_conversation, u.id);
end;
$function$;

do $do$
declare d text;
begin
  select pg_get_functiondef('public.gat_conv_json(uuid,uuid)'::regprocedure) into d;
  if position('my_friend' in d) = 0 then
    d := replace(d, '''my_images'', me.images, ''peer_images'', pm.images,', '''my_images'', me.images, ''peer_images'', pm.images,
    ''my_friend'', me.friend, ''peer_friend'', pm.friend,');
    execute d;
  end if;
end;
$do$;

-- Bio for everyone, plus when they joined, on every profile.
alter table public.gat_users add column if not exists bio text;

create or replace function public.gat_set_bio(p_token text, p_bio text)
 returns jsonb language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare u public.gat_users := public.gat_auth(p_token);
begin
  update public.gat_users set bio = nullif(left(btrim(coalesce(p_bio, '')), 140), '') where id = u.id returning * into u;
  return public.gat_me_json(u);
end;
$function$;

do $do$
declare d text;
begin
  select pg_get_functiondef('public.gat_profile_json(gat_users)'::regprocedure) into d;
  if position('''bio''' in d) = 0 then
    d := replace(d, '''song'', u.song,', '''song'', u.song, ''bio'', u.bio, ''joined'', u.created_at,');
    execute d;
  end if;
end;
$do$;

revoke all on function public.gat_friend(text, uuid, boolean) from public;
revoke all on function public.gat_set_bio(text, text) from public;
grant execute on function public.gat_friend(text, uuid, boolean) to anon, authenticated;
grant execute on function public.gat_set_bio(text, text) to anon, authenticated;
