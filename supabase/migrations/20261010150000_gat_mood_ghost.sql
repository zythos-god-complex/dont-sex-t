-- Mood rn (2h, flirty only for stamped adults with nsfw on) and ghost browse (hidden from people search).
alter table public.gat_users add column if not exists mood text;
alter table public.gat_users add column if not exists mood_until timestamptz;
alter table public.gat_users add column if not exists ghost boolean not null default false;

create or replace function public.gat_set_mood(p_token text, p_mood text)
 returns jsonb language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  u public.gat_users := public.gat_auth(p_token);
begin
  if p_mood is null or p_mood = '' then
    update public.gat_users set mood = null, mood_until = null where id = u.id;
    return null;
  end if;
  if p_mood <> all (array['happy','sleepy','angry','smug','shocked','wink','kiss','disgust','flirty']) then
    raise exception 'body_invalid' using errcode = 'P0001';
  end if;
  if p_mood in ('flirty', 'kiss') and not (u.nsfw and public.gat_adult(u)) then
    raise exception 'age_required' using errcode = 'P0001';
  end if;
  update public.gat_users set mood = p_mood, mood_until = now() + interval '2 hours' where id = u.id returning * into u;
  return jsonb_build_object('mood', u.mood, 'until', u.mood_until);
end;
$function$;

create or replace function public.gat_set_ghost(p_token text, p_on boolean)
 returns boolean language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  u public.gat_users := public.gat_auth(p_token);
begin
  update public.gat_users set ghost = coalesce(p_on, false) where id = u.id;
  return coalesce(p_on, false);
end;
$function$;

do $do$
declare d text;
begin
  select pg_get_functiondef('public.gat_search_users(text, text)'::regprocedure) into d;
  if position('not x.ghost' in d) = 0 then
    d := replace(d, 'where x.id <> u.id and lower(x.username)', 'where x.id <> u.id and not x.ghost and not x.banned and lower(x.username)');
    execute d;
  end if;
end;
$do$;

revoke all on function public.gat_set_mood(text, text) from public;
revoke all on function public.gat_set_ghost(text, boolean) from public;
grant execute on function public.gat_set_mood(text, text) to anon, authenticated;
grant execute on function public.gat_set_ghost(text, boolean) to anon, authenticated;
