-- Name lock (perk names and lookalikes reserved, one rename a week), timeout appeals (one per timeout).
alter table public.gat_users add column if not exists renamed_at timestamptz;
alter table public.gat_users add column if not exists appealed boolean not null default false;

create or replace function public.gat_name_key(n text)
 returns text language sql immutable
as $function$
  select regexp_replace(translate(lower(coalesce(n, '')), '013457@$!|', 'oieastasil'), '[^a-z]', '', 'g');
$function$;

create or replace function public.gat_users_name_guard()
 returns trigger language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  k text := public.gat_name_key(new.username);
begin
  if tg_op = 'UPDATE' and new.username is not distinct from old.username then return new; end if;
  if new.banned or new.username like 'gone\_%' then return new; end if;
  if k <> '' and exists (
    select 1 from public.gat_users p
     where p.perks and p.id <> new.id
       and (public.gat_name_key(p.username) = k
            or exists (select 1 from public.gat_name_history h where h.user_id = p.id and public.gat_name_key(h.username) = k))
  ) then
    raise exception 'username_taken' using errcode = 'P0001';
  end if;
  if tg_op = 'UPDATE' then
    if old.renamed_at is not null and old.renamed_at > now() - interval '7 days' and not old.is_temp then
      raise exception 'rename_cooldown' using errcode = 'P0001';
    end if;
    new.renamed_at := now();
  end if;
  return new;
end;
$function$;

create or replace trigger gat_users_name_guard
  before insert or update of username on public.gat_users
  for each row execute function public.gat_users_name_guard();

-- the timeout screen asks this (gat_auth refuses timed out tokens)
create or replace function public.gat_ban_state(p_token text)
 returns jsonb language sql stable security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
  select jsonb_build_object('until', banned_until, 'appealed', appealed) from public.gat_users
   where token_hash = extensions.digest(coalesce(p_token, ''), 'sha256') and banned_until > now() and not banned;
$function$;

create or replace function public.gat_appeal(p_token text, p_text text)
 returns boolean language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  u public.gat_users;
begin
  select * into u from public.gat_users
   where token_hash = extensions.digest(coalesce(p_token, ''), 'sha256') and banned_until > now() and not banned;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if u.appealed then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  update public.gat_users set appealed = true where id = u.id;
  insert into public.gat_reports (reporter, target, reason, snapshot)
  values (u.id, u.id, 'appeal', jsonb_build_array(jsonb_build_object(
    'w', 'appeal', 'body', left(btrim(regexp_replace(coalesce(p_text, ''), '[[:cntrl:]]+', ' ', 'g')), 300), 'at', now())));
  return true;
end;
$function$;

-- a fresh timeout gets a fresh appeal
do $do$
declare d text;
begin
  select pg_get_functiondef('public.gat_admin(text, text, jsonb)'::regprocedure) into d;
  if position('appealed = false' in d) = 0 then
    d := replace(d, 'update public.gat_users set banned_until = case', 'update public.gat_users set appealed = false, banned_until = case');
    execute d;
  end if;
end;
$do$;

revoke all on function public.gat_ban_state(text) from public;
revoke all on function public.gat_appeal(text, text) from public;
grant execute on function public.gat_ban_state(text) to anon, authenticated;
grant execute on function public.gat_appeal(text, text) to anon, authenticated;
