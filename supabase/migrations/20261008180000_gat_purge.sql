-- Ephemeral server: messages, room messages, reactions and voice/photo files are removed 24h after
-- they were sent. Clients keep their own copy on device (src/lib/archive.ts).
-- Only those rows are touched. Users, conversations, rooms, members and settings stay.
-- Safety: nothing runs before gat_config.purge_after (set 12h after this migration so every client
-- gets the archiving build first).

insert into public.gat_config (key, value) values ('purge_after', (now() + interval '12 hours')::text)
on conflict (key) do nothing;

-- The Storage API (not SQL) has to remove files; allow it only for files already past 24h.
create policy "gat purge old files" on storage.objects for delete to anon, authenticated
  using (bucket_id in ('gat-voice', 'gat-img') and created_at < now() - interval '24 hours');

create or replace function public.gat_purge()
returns jsonb language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp' as $$
declare
  v_after timestamptz;
  v_cut timestamptz := now() - interval '24 hours';
  n_dm int := 0; n_room int := 0; n_react int := 0; n_files int := 0;
  r record;
begin
  select value::timestamptz into v_after from public.gat_config where key = 'purge_after';
  if v_after is null or now() < v_after then return jsonb_build_object('skipped', true); end if;

  delete from public.gat_reactions x using public.gat_messages m where x.message_id = m.id and m.created_at < v_cut;
  get diagnostics n_react = row_count;
  delete from public.gat_messages where created_at < v_cut;
  get diagnostics n_dm = row_count;
  delete from public.gat_room_messages where created_at < v_cut;
  get diagnostics n_room = row_count;

  for r in select bucket_id, name from storage.objects
           where bucket_id in ('gat-voice', 'gat-img') and created_at < v_cut limit 300 loop
    perform net.http_delete(
      url := 'https://afxnqxxntxfawcgxmyac.supabase.co/storage/v1/object/' || r.bucket_id || '/' || r.name,
      headers := jsonb_build_object('apikey', 'sb_publishable_wCY80oH-5UNwFCgyE3O2iQ_FBlU57ws'));
    n_files := n_files + 1;
  end loop;
  return jsonb_build_object('dm', n_dm, 'room', n_room, 'reactions', n_react, 'files', n_files);
end;
$$;
revoke all on function public.gat_purge() from public, anon, authenticated;

select cron.schedule('gat-purge', '17 * * * *', 'select public.gat_purge()');
