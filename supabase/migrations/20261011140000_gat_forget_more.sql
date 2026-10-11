-- forget me also clears the profile extras added later (bio, place, songs, a waiting photo)
do $$
declare d text;
begin
  d := pg_get_functiondef('public.gat_forget_me'::regproc);
  if position('bio = null' in d) = 0 then
    d := replace(d, 'birth_ym = null,', 'birth_ym = null, bio = null, place = null, show_age = false, song = null, now_playing = null, now_playing_at = null, photo_pending = null, photo_pending_at = null,');
    execute d;
  end if;
end $$;
