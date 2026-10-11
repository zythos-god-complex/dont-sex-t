-- the rate limit query reused the alias r, which is also the room record variable, so every room send failed
do $$
declare d text;
begin
  d := pg_get_functiondef('public.gat_room_send'::regproc);
  if position('gat_room_messages r where r.sender_id' in d) > 0 then
    d := replace(d, 'from public.gat_room_messages r where r.sender_id = u.id and r.created_at', 'from public.gat_room_messages rm where rm.sender_id = u.id and rm.created_at');
    execute d;
  end if;
end $$;
