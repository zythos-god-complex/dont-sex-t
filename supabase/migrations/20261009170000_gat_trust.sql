-- Trust and safety batch: age passport (self-declared birth month, set once) gating nsfw,
-- server-side spicy gate, send throttles, upload tickets with daily quotas, account recovery keys,
-- forget me, and real file removal for view-once / unsend.
alter table public.gat_users add column if not exists birth_ym date;
alter table public.gat_users add column if not exists recovery_hash bytea;
alter table public.gat_users add column if not exists recover_fails int not null default 0;
alter table public.gat_users add column if not exists recover_lock timestamptz;

create index if not exists gat_messages_sender_time on public.gat_messages (sender_id, created_at desc);
create index if not exists gat_room_messages_sender_time on public.gat_room_messages (sender_id, created_at desc);

create or replace function public.gat_adult(u gat_users) returns boolean language sql stable
set search_path to 'public', 'extensions', 'pg_temp' as $$
  select u.birth_ym is not null and u.birth_ym <= (date_trunc('month', now()) - interval '18 years')::date;
$$;

create or replace function public.gat_spicy_body(p_body text) returns boolean language sql immutable as $$
  select coalesce(p_body, '') ~ '^\[\[sticker:(lust|uup|kissme|thirsty|spicy|peach|downbad|naughty)\]\]$';
$$;

create or replace function public.gat_profile_json(u gat_users)
 returns jsonb language sql stable set search_path to 'public', 'extensions', 'pg_temp'
as $function$
  select case when u.id is null then null else jsonb_build_object(
    'id', u.id, 'username', u.username, 'gender', u.gender, 'last_seen_at', u.last_seen_at,
    'avatar', u.avatar, 'show_status', u.show_status, 'show_seen', u.show_seen, 'temp', u.is_temp,
    'nsfw', u.nsfw and public.gat_adult(u),
    'vip', u.perks, 'flair', case when u.perks then u.flair else null end, 'admin', u.is_admin
  ) end;
$function$;

create or replace function public.gat_me_json(u gat_users)
 returns jsonb language sql stable set search_path to 'public', 'extensions', 'pg_temp'
as $function$
  select public.gat_profile_json(u) || jsonb_build_object('inbox', u.inbox, 'age_set', u.birth_ym is not null,
    'adult', public.gat_adult(u), 'has_key', u.recovery_hash is not null);
$function$;

create or replace function public.gat_set_nsfw(p_token text, p_on boolean)
 returns jsonb language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare u public.gat_users := public.gat_auth(p_token);
begin
  if coalesce(p_on, false) and not public.gat_adult(u) then
    raise exception 'age_required' using errcode = 'P0001';
  end if;
  update public.gat_users set nsfw = coalesce(p_on, false) where id = u.id returning * into u;
  return public.gat_me_json(u);
end;
$function$;

-- birth month is set once and never changes
create or replace function public.gat_set_birth(p_token text, p_year int, p_month int)
 returns jsonb language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare u public.gat_users := public.gat_auth(p_token); d date;
begin
  if u.birth_ym is not null then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  if p_month is null or p_month < 1 or p_month > 12 or p_year is null or p_year < 1920 or p_year > extract(year from now())::int then
    raise exception 'body_invalid' using errcode = 'P0001';
  end if;
  d := make_date(p_year, p_month, 1);
  if d > now()::date then raise exception 'body_invalid' using errcode = 'P0001'; end if;
  update public.gat_users set birth_ym = d where id = u.id returning * into u;
  if not public.gat_adult(u) then update public.gat_users set nsfw = false where id = u.id returning * into u; end if;
  return public.gat_me_json(u);
end;
$function$;

-- spicy gate + throttle inside both gat_send overloads, spicy gate on the lust theme, room send gate + throttle
do $$
declare d text; f regprocedure; anchor text := E'raise exception ''blocked'' using errcode = ''P0001'';\n  end if;';
begin
  foreach f in array array['public.gat_send(text, uuid, uuid, text)'::regprocedure, 'public.gat_send(text, uuid, uuid, text, uuid)'::regprocedure] loop
    d := pg_get_functiondef(f);
    if position('gat_spicy_body' in d) = 0 then
      if position(anchor in d) = 0 then raise exception 'gat_send anchor missing in %', f; end if;
      d := replace(d, anchor, anchor || E'\n  if public.gat_spicy_body(v_body) and not (u.nsfw and public.gat_adult(u) and exists (select 1 from public.gat_users pu where pu.id = v_peer and pu.nsfw and public.gat_adult(pu))) then\n    raise exception ''not_allowed'' using errcode = ''P0001'';\n  end if;\n  if (select count(*) from public.gat_messages r where r.sender_id = u.id and r.created_at > now() - interval ''10 seconds'') >= 8 then\n    raise exception ''rate_limited'' using errcode = ''P0001'';\n  end if;');
      execute d;
    end if;
  end loop;

  d := pg_get_functiondef('public.gat_theme(text, uuid, text)'::regprocedure);
  if position('gat_adult' in d) = 0 then
    anchor := E'v_m := public.gat_require_member(p_conversation, u.id);';
    if position(anchor in d) = 0 then raise exception 'gat_theme anchor missing'; end if;
    d := replace(d, anchor, anchor || E'\n  if p_theme = ''lust'' and not (u.nsfw and public.gat_adult(u) and exists (select 1 from public.gat_users pu where pu.id = v_m.peer_id and pu.nsfw and public.gat_adult(pu))) then\n    raise exception ''not_allowed'' using errcode = ''P0001'';\n  end if;');
    execute d;
  end if;

  d := pg_get_functiondef('public.gat_room_send(text, uuid, text)'::regprocedure);
  if position('gat_spicy_body' in d) = 0 then
    anchor := E'raise exception ''body_invalid'' using errcode = ''P0001'';\n  end if;';
    if position(anchor in d) = 0 then raise exception 'gat_room_send anchor missing'; end if;
    d := replace(d, anchor, anchor || E'\n  if public.gat_spicy_body(v_body) then raise exception ''not_allowed'' using errcode = ''P0001''; end if;\n  if (select count(*) from public.gat_room_messages r where r.sender_id = u.id and r.created_at > now() - interval ''10 seconds'') >= 5 then\n    raise exception ''rate_limited'' using errcode = ''P0001'';\n  end if;');
    execute d;
  end if;
end $$;

-- upload tickets: every upload needs a fresh server-issued name, capped per day
create table if not exists public.gat_upload_tickets (
  bucket text not null, name text not null, user_id uuid not null, created_at timestamptz not null default now(),
  primary key (bucket, name)
);
create index if not exists gat_upload_tickets_user on public.gat_upload_tickets (user_id, created_at desc);
alter table public.gat_upload_tickets enable row level security;

create or replace function public.gat_upload_ticket(p_token text, p_bucket text, p_ext text)
 returns text language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare u public.gat_users := public.gat_auth(p_token); v_name text; v_cap int;
begin
  if p_bucket = 'gat-img' and p_ext in ('jpg', 'png', 'webp', 'gif') then v_cap := 80;
  elsif p_bucket = 'gat-voice' and p_ext in ('webm', 'm4a', 'ogg') then v_cap := 150;
  else raise exception 'body_invalid' using errcode = 'P0001';
  end if;
  if (select count(*) from public.gat_upload_tickets t where t.user_id = u.id and t.bucket = p_bucket and t.created_at > now() - interval '24 hours') >= v_cap then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  v_name := u.id::text || '/' || encode(extensions.gen_random_bytes(9), 'hex') || '.' || p_ext;
  insert into public.gat_upload_tickets (bucket, name, user_id) values (p_bucket, v_name, u.id);
  return v_name;
end;
$function$;

create or replace function public.gat_ticket_ok(p_bucket text, p_name text)
 returns boolean language sql stable security definer set search_path to 'public', 'pg_temp'
as $$ select exists (select 1 from public.gat_upload_tickets t where t.bucket = p_bucket and t.name = p_name and t.created_at > now() - interval '15 minutes'); $$;

alter policy "gat img upload" on storage.objects with check (bucket_id = 'gat-img' and public.gat_ticket_ok(bucket_id, name));
alter policy "gat voice upload" on storage.objects with check (bucket_id = 'gat-voice' and public.gat_ticket_ok(bucket_id, name));

-- files marked for removal (view-once opened, unsent) can go right away instead of waiting 24h
create table if not exists public.gat_doomed_files (bucket text not null, name text not null, created_at timestamptz not null default now(), primary key (bucket, name));
alter table public.gat_doomed_files enable row level security;
create or replace function public.gat_doomed(p_bucket text, p_name text)
 returns boolean language sql stable security definer set search_path to 'public', 'pg_temp'
as $$ select exists (select 1 from public.gat_doomed_files d where d.bucket = p_bucket and d.name = p_name); $$;
alter policy "gat purge old files" on storage.objects using (bucket_id = any (array['gat-voice', 'gat-img']) and (created_at < now() - interval '24 hours' or public.gat_doomed(bucket_id, name)));

do $$
declare d text; f regprocedure; anchor text := E'    begin\n      perform net.http_delete(';
begin
  foreach f in array array['public.gat_open_once(text, uuid)'::regprocedure, 'public.gat_unsend(text, uuid)'::regprocedure] loop
    d := pg_get_functiondef(f);
    if position('gat_doomed_files' in d) = 0 then
      if position(anchor in d) = 0 then raise exception 'storage anchor missing in %', f; end if;
      d := replace(d, anchor, E'    insert into public.gat_doomed_files (bucket, name) values (split_part(v_path, ''/'', 1), substr(v_path, position(''/'' in v_path) + 1)) on conflict do nothing;\n' || anchor);
      execute d;
    end if;
  end loop;
end $$;

-- recovery key: 6 goofy words, hashed; brute force locks the name for an hour
create or replace function public.gat_words() returns text[] language sql immutable as $$ select array['blob','goof','noodle','pickle','waffle','taco','bean','sock','duck','llama','otter','panda','mango','peach','plum','lemon','melon','kiwi','grape','olive','pretzel','bagel','donut','muffin','cookie','toast','jelly','honey','syrup','butter','cheese','nacho','burrito','dumpling','ramen','sushi','tofu','pepper','onion','garlic','potato','carrot','turnip','radish','pumpkin','squash','cactus','fern','moss','tulip','daisy','lotus','maple','acorn','pebble','boulder','canyon','meadow','puddle','comet','rocket','planet','moon','star','cloud','thunder','breeze','drizzle','snow','frost','ember','spark','glitter','sparkle','bubble','button','zipper','pocket','mitten','scarf','beanie','hoodie','slipper','sandal','boot','wizard','goblin','troll','pirate','ninja','robot','alien','zombie','ghost','vampire','mummy','dragon','unicorn','yeti','kraken','gnome','fairy','pixie','elf','jester','knight','queen','king','prince','duke','baron','lizard','gecko','turtle','frog','toad','newt','shrimp','crab','lobster','squid','clam','oyster','walrus','seal','penguin','puffin','pelican','parrot','toucan','flamingo','ostrich','emu','kiwibird','owl','crow','raven','pigeon','goose','swan','heron','moose','bison','camel','zebra','giraffe','hippo','rhino','lemur','sloth','koala','wombat','badger','ferret','weasel','beaver','hamster','gerbil','bunny','kitten','puppy','piglet','lamb','calf','foal','chick','duckling','tadpole','jellybean','gumdrop','lollipop','caramel','toffee','fudge','brownie','cupcake','pancake','crumpet','scone','biscuit','cracker','popcorn','churro','waffles','nugget','hotdog','burger','fries','salsa','guacamole','hummus','falafel','kebab','samosa','curry','noodles','risotto','lasagna','ravioli','gnocchi','pizza','calzone','banjo','kazoo','ukulele','tuba','trumpet','drum','cymbal','harp','flute','piano','violin','guitar','banjos','tambourine','whistle','yodel','giggle','chuckle','snort','hiccup','sneeze','wiggle','wobble','jiggle','bounce','zoom','vroom','honk','beep','boop','bonk','plop','splat','squish','squeak','crunch','munch','slurp','gulp','yawn','snooze','nap','dream','cozy','fluffy','fuzzy','squishy','sleepy','grumpy','sneaky','silly','wacky','zany','quirky']::text[]; $$;

create or replace function public.gat_make_key(p_token text)
 returns jsonb language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare u public.gat_users := public.gat_auth(p_token); b bytea := extensions.gen_random_bytes(6); w text[] := public.gat_words(); v text := '';
begin
  if u.is_temp then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  for i in 0..5 loop v := v || case when i > 0 then ' ' else '' end || w[get_byte(b, i) + 1]; end loop;
  update public.gat_users set recovery_hash = extensions.digest(v, 'sha256'), recover_fails = 0, recover_lock = null where id = u.id returning * into u;
  return jsonb_build_object('words', v, 'me', public.gat_me_json(u));
end;
$function$;

create or replace function public.gat_recover(p_username text, p_words text)
 returns jsonb language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare u public.gat_users; v text := btrim(regexp_replace(lower(coalesce(p_words, '')), '[^a-z]+', ' ', 'g')); v_token text;
begin
  if not public.gat_join_allowed() then return jsonb_build_object('error', 'unauthorized'); end if;
  select * into u from public.gat_users where lower(username) = lower(btrim(coalesce(p_username, ''))) for update;
  if not found or u.banned or u.recovery_hash is null then return jsonb_build_object('error', 'unauthorized'); end if;
  if u.recover_lock is not null and u.recover_lock > now() then return jsonb_build_object('error', 'rate_limited'); end if;
  if extensions.digest(v, 'sha256') <> u.recovery_hash then
    update public.gat_users set recover_fails = case when recover_fails + 1 >= 5 then 0 else recover_fails + 1 end,
      recover_lock = case when recover_fails + 1 >= 5 then now() + interval '1 hour' else recover_lock end
     where id = u.id;
    return jsonb_build_object('error', 'unauthorized');
  end if;
  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), E'+/=\n', '-_');
  update public.gat_users set token_hash = extensions.digest(v_token, 'sha256'), recover_fails = 0, recover_lock = null where id = u.id returning * into u;
  return jsonb_build_object('token', v_token, 'me', public.gat_me_json(u));
end;
$function$;

-- forget me: scrub the profile, take back everything they sent, and kill the login
create or replace function public.gat_forget_me(p_token text)
 returns boolean language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare u public.gat_users := public.gat_auth(p_token);
begin
  update public.gat_messages set body = '[[unsent]]' where sender_id = u.id and kind = 'text';
  update public.gat_room_messages set body = 'removed', kind = 'removed' where sender_id = u.id;
  update public.gat_room_members set active = false where user_id = u.id;
  update public.gat_users set username = 'gone_' || substr(replace(id::text, '-', ''), 1, 10), avatar = null, flair = '{}'::jsonb,
    perks = false, nsfw = false, birth_ym = null, recovery_hash = null, banned = true,
    token_hash = extensions.digest(encode(extensions.gen_random_bytes(32), 'hex'), 'sha256')
   where id = u.id;
  return true;
end;
$function$;

revoke all on function public.gat_set_birth(text, int, int) from public;
revoke all on function public.gat_upload_ticket(text, text, text) from public;
revoke all on function public.gat_make_key(text) from public;
revoke all on function public.gat_recover(text, text) from public;
revoke all on function public.gat_forget_me(text) from public;
grant execute on function public.gat_set_birth(text, int, int) to anon, authenticated;
grant execute on function public.gat_upload_ticket(text, text, text) to anon, authenticated;
grant execute on function public.gat_make_key(text) to anon, authenticated;
grant execute on function public.gat_recover(text, text) to anon, authenticated;
grant execute on function public.gat_forget_me(text) to anon, authenticated;
grant execute on function public.gat_ticket_ok(text, text) to anon, authenticated;
grant execute on function public.gat_doomed(text, text) to anon, authenticated;
