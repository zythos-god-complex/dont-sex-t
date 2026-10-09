-- Perks: a few hand-picked users get flair (hat on their character, bio, profile card colours, live nameplate bg).
-- perks is only ever set from SQL; gat_set_flair refuses everyone else and whitelists every field.
alter table public.gat_users add column if not exists perks boolean not null default false;
alter table public.gat_users add column if not exists flair jsonb not null default '{}'::jsonb;

update public.gat_users
   set perks = true,
       flair = jsonb_build_object('hat', 'crown', 'bio', '', 'card', 'gold', 'aura', 'gold')
 where lower(username) in ('admin', 'ember') and not perks;

create or replace function public.gat_profile_json(u gat_users)
 returns jsonb
 language sql
 stable
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
  select case when u.id is null then null else jsonb_build_object(
    'id', u.id, 'username', u.username, 'gender', u.gender, 'last_seen_at', u.last_seen_at,
    'avatar', u.avatar, 'show_status', u.show_status, 'show_seen', u.show_seen, 'temp', u.is_temp, 'nsfw', u.nsfw,
    'vip', u.perks, 'flair', case when u.perks then u.flair else null end
  ) end;
$function$;

create or replace function public.gat_set_flair(p_token text, p_flair jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  u public.gat_users := public.gat_auth(p_token);
  f jsonb := coalesce(p_flair, '{}'::jsonb);
begin
  if not u.perks then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  update public.gat_users set flair = jsonb_build_object(
    'hat',  case when f->>'hat'  = any (array['none','crown','cap','beanie','halo','bow','tophat','party']) then f->>'hat'  else 'none' end,
    'bio',  left(btrim(regexp_replace(coalesce(f->>'bio', ''), '[[:cntrl:]]+', ' ', 'g')), 140),
    'card', case when f->>'card' = any (array['ink','gold','rose','grape','mint','sky']) then f->>'card' else 'ink' end,
    'aura', case when f->>'aura' = any (array['none','gold','sunset','galaxy','sakura','aurora','hearts']) then f->>'aura' else 'none' end
  ) where id = u.id returning * into u;
  return public.gat_me_json(u);
end;
$function$;

-- Everyone's flair in one tiny list (only perk users have any), so hats show on faces we have no profile for yet (rooms, stickers).
create or replace function public.gat_flairs()
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object('username', username, 'flair', flair)), '[]'::jsonb)
    from public.gat_users where perks and not banned;
$function$;

revoke all on function public.gat_set_flair(text, jsonb) from public;
revoke all on function public.gat_flairs() from public;
grant execute on function public.gat_set_flair(text, jsonb) to anon, authenticated;
grant execute on function public.gat_flairs() to anon, authenticated;
