-- Audio files in DMs ride the voice bucket: allow mp3, aac and wav next to the recorder formats. Still 5MB max, no video.
update storage.buckets
   set allowed_mime_types = array(select distinct unnest(allowed_mime_types || array['audio/wav', 'audio/x-wav', 'audio/mp3']))
 where id = 'gat-voice';

do $do$
declare d text;
begin
  select pg_get_functiondef('public.gat_upload_ticket(text, text, text)'::regprocedure) into d;
  if position('''mp3''' in d) = 0 then
    d := replace(d, 'p_ext in (''webm'', ''m4a'', ''ogg'')', 'p_ext in (''webm'', ''m4a'', ''ogg'', ''mp3'', ''aac'', ''wav'')');
    execute d;
  end if;
end;
$do$;
