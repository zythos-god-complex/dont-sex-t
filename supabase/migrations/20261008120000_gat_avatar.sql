-- Custom goofy face per user (built at sign up). Null means "derive from username".
alter table public.gat_users add column if not exists avatar jsonb;

create or replace function public.gat_profile_json(u public.gat_users)
returns jsonb
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select case when u.id is null then null else jsonb_build_object(
    'id', u.id,
    'username', u.username,
    'gender', u.gender,
    'last_seen_at', u.last_seen_at,
    'avatar', u.avatar
  ) end;
$$;

create or replace function public.gat_set_avatar(p_token text, p_avatar jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  u public.gat_users := public.gat_auth(p_token);
begin
  if p_avatar is not null and (jsonb_typeof(p_avatar) <> 'object' or octet_length(p_avatar::text) > 600) then
    raise exception 'body_invalid' using errcode = 'P0001';
  end if;
  update public.gat_users set avatar = p_avatar where id = u.id returning * into u;
  return public.gat_me_json(u);
end;
$$;

revoke all on function public.gat_set_avatar(text, jsonb) from public;
grant execute on function public.gat_set_avatar(text, jsonb) to anon, authenticated;

notify pgrst, 'reload schema';
