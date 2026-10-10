-- Spooky week is gone: the spooky chat theme is no longer allowed, and the seasonal hat key leaves avatars (ghost browse is separate).
do $do$
declare d text;
begin
  select pg_get_functiondef('public.gat_theme(text, uuid, text)'::regprocedure) into d;
  if position('''lust'', ''spooky'', ''matrix''' in d) > 0 then
    d := replace(d, '''lust'', ''spooky'', ''matrix''', '''lust'', ''matrix''');
    execute d;
  end if;
end;
$do$;

update public.gat_users set avatar = avatar - 'hat' where avatar ? 'hat';
