-- Now playing: each user polls their own Spotify and pushes the track to their profile; others just read it.
alter table public.gat_users add column if not exists now_playing jsonb;
alter table public.gat_users add column if not exists now_playing_at timestamptz;

-- the owner pushes {t, by, img, url}; null clears it. only our own art/track links are accepted.
create or replace function public.gat_set_now_playing(p_token text, p_np jsonb)
 returns void language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare u public.gat_users := public.gat_auth(p_token);
begin
  if p_np is null then
    update public.gat_users set now_playing = null, now_playing_at = null where id = u.id;
    return;
  end if;
  if jsonb_typeof(p_np) <> 'object' or octet_length(p_np::text) > 600
     or coalesce(p_np->>'t', '') = '' or coalesce(p_np->>'by', '') = ''
     or p_np->>'img' !~ '^https://i\.scdn\.co/image/[A-Za-z0-9]+$'
     or p_np->>'url' !~ '^https://open\.spotify\.com/track/[A-Za-z0-9]+$' then
    raise exception 'body_invalid' using errcode = 'P0001';
  end if;
  update public.gat_users
     set now_playing = jsonb_build_object('t', left(p_np->>'t', 120), 'by', left(p_np->>'by', 120), 'img', p_np->>'img', 'url', p_np->>'url'),
         now_playing_at = now()
   where id = u.id;
end;
$function$;

-- fold a fresh now_playing (last 6 minutes) into every profile
do $do$
declare d text;
begin
  select pg_get_functiondef('public.gat_profile_json(gat_users)'::regprocedure) into d;
  if position('now_playing' in d) = 0 then
    d := replace(d, '''flair'', case when u.perks then u.flair else null end,',
      '''flair'', case when u.perks then u.flair else null end, ''now_playing'', case when u.now_playing_at > now() - interval ''6 minutes'' then u.now_playing end,');
    execute d;
  end if;
end;
$do$;

revoke all on function public.gat_set_now_playing(text, jsonb) from public;
grant execute on function public.gat_set_now_playing(text, jsonb) to anon, authenticated;
