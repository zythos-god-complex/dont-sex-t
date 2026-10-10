-- Profile photos wait for the admin: uploads become a pending photo, only an approval puts them on the avatar.
alter table public.gat_users add column if not exists photo_pending text;
alter table public.gat_users add column if not exists photo_pending_at timestamptz;

-- anything already live goes back through review
update public.gat_users
   set photo_pending = avatar->>'photo', photo_pending_at = now(), avatar = avatar - 'photo'
 where avatar ? 'photo';

-- avatars can never set a photo themselves: a photo key is ignored (the approved one stays), photo:null removes it
do $do$
declare d text;
begin
  select pg_get_functiondef('public.gat_set_avatar(text, jsonb)'::regprocedure) into d;
  if position('photo' in d) = 0 then
    d := replace(d, '  update public.gat_users set avatar = p_avatar where id = u.id returning * into u;', '  if p_avatar is not null then
    if p_avatar ? ''photo'' and jsonb_typeof(p_avatar->''photo'') = ''null'' then
      p_avatar := p_avatar - ''photo'';
    else
      p_avatar := (p_avatar - ''photo'') || case when u.avatar ? ''photo'' then jsonb_build_object(''photo'', u.avatar->''photo'') else ''{}''::jsonb end;
    end if;
  end if;
  update public.gat_users set avatar = p_avatar where id = u.id returning * into u;');
    execute d;
  end if;
end;
$do$;

-- the user hands in an uploaded photo (their own folder in gat-pfp), or null to withdraw it
create or replace function public.gat_photo_submit(p_token text, p_url text)
 returns text language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  u public.gat_users := public.gat_auth(p_token);
  v_name text;
begin
  if p_url is null then
    update public.gat_users set photo_pending = null, photo_pending_at = null where id = u.id;
    return null;
  end if;
  if p_url !~ ('^https://[a-z0-9]+\.supabase\.co/storage/v1/object/public/gat-pfp/' || u.id::text || '/[0-9a-f]+\.jpg$') then
    raise exception 'body_invalid' using errcode = 'P0001';
  end if;
  v_name := substring(p_url from '/gat-pfp/(.*)$');
  if not exists (select 1 from storage.objects where bucket_id = 'gat-pfp' and name = v_name) then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  update public.gat_users set photo_pending = p_url, photo_pending_at = now() where id = u.id;
  return p_url;
end;
$function$;

create or replace function public.gat_photo_status(p_token text)
 returns text language sql stable security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
  select photo_pending from public.gat_users where token_hash = extensions.digest(coalesce(p_token, ''), 'sha256') and not banned;
$function$;

-- admin review queue
do $do$
declare d text;
begin
  select pg_get_functiondef('public.gat_admin(text, text, jsonb)'::regprocedure) into d;
  if position('''photos''' in d) = 0 then
    d := replace(d, '  elsif p_op = ''notice'' then', '  elsif p_op = ''photos'' then
    return (select coalesce(jsonb_agg(jsonb_build_object(''id'', x.id, ''username'', x.username, ''url'', x.photo_pending, ''at'', x.photo_pending_at) order by x.photo_pending_at), ''[]''::jsonb)
              from public.gat_users x where x.photo_pending is not null and not x.banned);

  elsif p_op = ''photo_ok'' then
    update public.gat_users set avatar = coalesce(avatar, ''{}''::jsonb) || jsonb_build_object(''photo'', photo_pending), photo_pending = null, photo_pending_at = null
     where id = (p_a->>''id'')::uuid and photo_pending is not null returning * into t;
    if not found then raise exception ''not_found'' using errcode = ''P0001''; end if;
    return public.gat_admin_row(t);

  elsif p_op = ''photo_no'' then
    update public.gat_users set photo_pending = null, photo_pending_at = null where id = (p_a->>''id'')::uuid returning * into t;
    if not found then raise exception ''not_found'' using errcode = ''P0001''; end if;
    return public.gat_admin_row(t);

  elsif p_op = ''notice'' then');
    execute d;
  end if;
end;
$do$;

revoke all on function public.gat_photo_submit(text, text) from public;
revoke all on function public.gat_photo_status(text) from public;
grant execute on function public.gat_photo_submit(text, text) to anon, authenticated;
grant execute on function public.gat_photo_status(text) to anon, authenticated;
