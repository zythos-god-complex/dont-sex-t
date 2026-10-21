-- An account's recovery secret can be a password instead of six words. A password is only ever stored as a bcrypt hash
-- (in recovery_hash), and is compared exactly as typed. Six word keys keep working the same as before.
create or replace function public.gat_recover(p_username text, p_words text)
 returns jsonb language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  u public.gat_users;
  v text := btrim(regexp_replace(lower(coalesce(p_words, '')), '[^a-z]+', ' ', 'g'));
  v_token text;
  v_ok boolean;
begin
  if not public.gat_join_allowed() then return jsonb_build_object('error', 'unauthorized'); end if;
  select * into u from public.gat_users where lower(username) = lower(btrim(coalesce(p_username, ''))) for update;
  if not found or u.banned or u.recovery_hash is null then return jsonb_build_object('error', 'unauthorized'); end if;
  if u.recover_lock is not null and u.recover_lock > now() then return jsonb_build_object('error', 'rate_limited'); end if;
  if length(u.recovery_hash) = 60 and substring(u.recovery_hash from 1 for 2) = decode('2432', 'hex') then
    -- a password (bcrypt hash)
    v_ok := extensions.crypt(coalesce(p_words, ''), convert_from(u.recovery_hash, 'UTF8')) = convert_from(u.recovery_hash, 'UTF8');
  else
    v_ok := extensions.digest(v, 'sha256') = u.recovery_hash;
  end if;
  if not v_ok then
    update public.gat_users set recover_fails = case when recover_fails + 1 >= 5 then 0 else recover_fails + 1 end,
      recover_lock = case when recover_fails + 1 >= 5 then now() + interval '1 hour' else recover_lock end
     where id = u.id;
    return jsonb_build_object('error', 'unauthorized');
  end if;
  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), E'+/=\\n', '-_');
  update public.gat_users set token_hash = extensions.digest(v_token, 'sha256'), recover_fails = 0, recover_lock = null where id = u.id returning * into u;
  return jsonb_build_object('token', v_token, 'me', public.gat_me_json(u));
end;
$function$;

-- making a new six word key would overwrite a password, so an account on a password can't
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.gat_make_key'::regproc);
  if position('length(u.recovery_hash) = 60' in d) = 0 then
    d := replace(d, 'if u.is_temp then raise exception', 'if u.is_temp or (u.recovery_hash is not null and length(u.recovery_hash) = 60) then raise exception');
    execute d;
  end if;
end
$do$;
