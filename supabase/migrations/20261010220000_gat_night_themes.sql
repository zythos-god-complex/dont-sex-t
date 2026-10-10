-- Ember's night themes: meteor shower, rain temple, sakura night, blue butterfly.
do $do$
declare d text;
begin
  select pg_get_functiondef(p.oid) into d from pg_proc p where p.proname = 'gat_theme' and p.pronamespace = 'public'::regnamespace limit 1;
  if position('''meteor''' in d) = 0 then
    d := replace(d, '''spooky'', ''matrix''', '''spooky'', ''matrix'', ''meteor'', ''temple'', ''sakuranight'', ''butterfly''');
    execute d;
  end if;
end;
$do$;
