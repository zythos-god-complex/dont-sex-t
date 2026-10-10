-- Profile song card: a song you pick (iTunes catalog id, title, artist, cover); others see it on your profile.
alter table public.gat_users add column if not exists song jsonb;

create or replace function public.gat_set_song(p_token text, p_song jsonb)
 returns jsonb language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare u public.gat_users := public.gat_auth(p_token);
begin
  if p_song is null then
    update public.gat_users set song = null where id = u.id returning * into u;
    return public.gat_me_json(u);
  end if;
  if jsonb_typeof(p_song) <> 'object' or octet_length(p_song::text) > 700
     or coalesce(p_song->>'id', '') !~ '^[0-9]{1,15}$'
     or coalesce(p_song->>'t', '') = '' or coalesce(p_song->>'by', '') = ''
     or coalesce(p_song->>'img', '') !~ '^https://is[0-9]-ssl\.mzstatic\.com/image/thumb/[A-Za-z0-9/._-]+/600x600bb\.(jpg|png|webp)$' then
    raise exception 'body_invalid' using errcode = 'P0001';
  end if;
  update public.gat_users
     set song = jsonb_build_object('id', p_song->>'id', 't', left(p_song->>'t', 120), 'by', left(p_song->>'by', 120), 'img', p_song->>'img')
   where id = u.id returning * into u;
  return public.gat_me_json(u);
end;
$function$;

do $do$
declare d text;
begin
  select pg_get_functiondef('public.gat_profile_json(gat_users)'::regprocedure) into d;
  if position('''song''' in d) = 0 then
    d := replace(d, '''now_playing'', case', '''song'', u.song, ''now_playing'', case');
    execute d;
  end if;
end;
$do$;

revoke all on function public.gat_set_song(text, jsonb) from public;
grant execute on function public.gat_set_song(text, jsonb) to anon, authenticated;
