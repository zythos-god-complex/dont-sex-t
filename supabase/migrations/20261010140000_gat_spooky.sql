-- Spooky week: allow the spooky chat theme (the client hides it outside October).
do $do$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.proname = 'gat_theme' and p.pronamespace = 'public'::regnamespace limit 1;
  if position('''spooky''' in d) = 0 then
    d := replace(d, '''bff'', ''lust''', '''bff'', ''lust'', ''spooky''');
    execute d;
  end if;
end;
$do$;
