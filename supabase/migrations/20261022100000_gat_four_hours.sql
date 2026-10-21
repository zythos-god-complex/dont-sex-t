-- messages, photos and voice notes now live 4 hours on the server (was 24). devices keep their own copy.
do $do$
declare d text;
begin
  d := pg_get_functiondef('public.gat_purge'::regproc);
  if position('24 hours' in d) > 0 then
    d := replace(d, '24 hours', '4 hours');
    d := replace(d, 'limit 300 loop', 'limit 3000 loop');
    execute d;
  end if;
  -- "melting soon" is the last hour before they go
  d := pg_get_functiondef('public.gat_pulse'::regproc);
  if position('19 hours' in d) > 0 then
    execute replace(d, '19 hours', '3 hours');
  end if;
  d := pg_get_functiondef('public.gat_melt_nudge'::regproc);
  if position('19 hours' in d) > 0 then
    execute replace(replace(d, '19 hours', '3 hours'), '20 hours', '3 hours');
  end if;
end
$do$;

-- the storage side of the same rule
alter policy "gat purge old files" on storage.objects
  using (bucket_id = any (array['gat-voice', 'gat-img']) and (created_at < now() - interval '4 hours' or public.gat_doomed(bucket_id, name)));

-- sweep every 15 minutes so "4 hours" means about 4 hours
select cron.alter_job(3, schedule := '*/15 * * * *');
