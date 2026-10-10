-- Push nudges lose their emojis: plain words only.
do $do$
declare d text;
begin
  select pg_get_functiondef('public.gat_streak_nudge()'::regprocedure) into d;
  if position('🔥' in d) > 0 then
    d := replace(d, '''🔥 '' || c.streak', 'c.streak');
    execute d;
  end if;
  select pg_get_functiondef('public.gat_melt_nudge()'::regprocedure) into d;
  if position('⏳' in d) > 0 then
    d := replace(d, '''⏳ their messages', '''their messages');
    execute d;
  end if;
end;
$do$;
