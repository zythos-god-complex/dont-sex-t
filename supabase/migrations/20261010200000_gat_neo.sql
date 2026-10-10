-- Neo: admin-only matrix character (code-filled blob, green ink, shades), worn as a flair hat.
do $do$
declare d text;
begin
  select pg_get_functiondef('public.gat_set_flair(text, jsonb)'::regprocedure) into d;
  if position('''neo''' in d) = 0 then
    d := replace(d, '''tophat'',''party'']) then f->>''hat''', '''tophat'',''party'']) or (f->>''hat'' = ''neo'' and u.is_admin) then f->>''hat''');
    execute d;
  end if;
end;
$do$;

update public.gat_users set flair = jsonb_set(flair, '{hat}', '"neo"') where is_admin and perks and lower(username) = 'admin';
