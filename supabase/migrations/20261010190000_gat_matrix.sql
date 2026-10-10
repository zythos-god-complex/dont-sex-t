-- Matrix: an admin-only chat theme and nameplate (A to Z code rain). Peers see it, only admin can pick it.
do $do$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.proname = 'gat_theme' and p.pronamespace = 'public'::regnamespace limit 1;
  if position('''matrix''' in d) = 0 then
    d := replace(d, '''lust'', ''spooky''', '''lust'', ''spooky'', ''matrix''');
    d := replace(d, '  v_m := public.gat_require_member(p_conversation, u.id);', E'  if p_theme = ''matrix'' and not u.is_admin then\n    raise exception ''theme_invalid'' using errcode = ''P0001'';\n  end if;\n  v_m := public.gat_require_member(p_conversation, u.id);');
    execute d;
  end if;
  select pg_get_functiondef('public.gat_set_flair(text, jsonb)'::regprocedure) into d;
  if position('''matrix''' in d) = 0 then
    d := replace(d, '''aurora'',''hearts'']) then f->>''aura''', '''aurora'',''hearts'']) or (f->>''aura'' = ''matrix'' and u.is_admin) then f->>''aura''');
    execute d;
  end if;
end;
$do$;

update public.gat_users set flair = jsonb_set(flair, '{aura}', '"matrix"') where is_admin and perks and lower(username) = 'admin';
