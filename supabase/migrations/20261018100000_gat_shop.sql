-- Shop: goof coins (from watching ads, plus a one time launch gift) buy themes, graffiti, face parts,
-- hats, cards and nameplates. Coins, prices and ownership only live here; every check that matters
-- runs in these functions, the app just shows what they say. Additive only.

alter table public.gat_users add column if not exists coins int not null default 0;
alter table public.gat_users add column if not exists coin_gift boolean not null default false;
alter table public.gat_conversations add column if not exists graffiti boolean not null default false;

create table if not exists public.gat_shop_items (
  id text primary key,
  kind text not null,
  price int not null check (price > 0),
  active boolean not null default true
);
create table if not exists public.gat_owned (
  user_id uuid not null references public.gat_users(id),
  item text not null,
  price int not null default 0,
  at timestamptz not null default now(),
  primary key (user_id, item)
);
create table if not exists public.gat_coin_log (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.gat_users(id),
  delta int not null,
  reason text not null,
  item text,
  at timestamptz not null default now()
);
create index if not exists gat_coin_log_user on public.gat_coin_log (user_id, at desc);
-- one row per ad watched; claimed once, after the full watch time, capped per day
create table if not exists public.gat_ad_views (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.gat_users(id),
  slot text not null default 'reward',
  started_at timestamptz not null default now(),
  claimed_at timestamptz,
  coins int not null default 0
);
create index if not exists gat_ad_views_user on public.gat_ad_views (user_id, started_at desc);
alter table public.gat_shop_items enable row level security;
alter table public.gat_owned enable row level security;
alter table public.gat_coin_log enable row level security;
alter table public.gat_ad_views enable row level security;

-- the catalog (kept in step with src/features/shop/catalog.ts); anything not listed here is free
insert into public.gat_shop_items (id, kind, price) values
  ('theme:aurora', 'theme', 150), ('theme:forest', 'theme', 150), ('theme:y2k', 'theme', 200),
  ('theme:batman', 'theme', 300), ('theme:love', 'theme', 300), ('theme:bff', 'theme', 300), ('theme:lust', 'theme', 350),
  ('theme:meteor', 'theme', 400), ('theme:temple', 'theme', 400), ('theme:sakuranight', 'theme', 400), ('theme:butterfly', 'theme', 400),
  ('theme:vapor', 'theme', 250), ('theme:ocean', 'theme', 250), ('theme:galaxy', 'theme', 250),
  ('theme:sunset', 'theme', 250), ('theme:noir', 'theme', 250), ('theme:arcade', 'theme', 250),
  ('graffiti:goofy', 'graffiti', 120), ('graffiti:cherry', 'graffiti', 120), ('graffiti:midnight', 'graffiti', 120),
  ('graffiti:matcha', 'graffiti', 120), ('graffiti:lagoon', 'graffiti', 120), ('graffiti:lavender', 'graffiti', 120),
  ('graffiti:terminal', 'graffiti', 120), ('graffiti:bubblegum', 'graffiti', 120), ('graffiti:citrus', 'graffiti', 120),
  ('graffiti:aurora', 'graffiti', 120), ('graffiti:forest', 'graffiti', 120), ('graffiti:y2k', 'graffiti', 120),
  ('graffiti:batman', 'graffiti', 120), ('graffiti:love', 'graffiti', 120), ('graffiti:bff', 'graffiti', 120),
  ('graffiti:meteor', 'graffiti', 120), ('graffiti:temple', 'graffiti', 120), ('graffiti:sakuranight', 'graffiti', 120),
  ('graffiti:butterfly', 'graffiti', 120), ('graffiti:vapor', 'graffiti', 120), ('graffiti:ocean', 'graffiti', 120),
  ('graffiti:galaxy', 'graffiti', 120), ('graffiti:sunset', 'graffiti', 120), ('graffiti:noir', 'graffiti', 120),
  ('graffiti:arcade', 'graffiti', 120),
  ('hat:cap', 'hat', 120), ('hat:beanie', 'hat', 120), ('hat:bow', 'hat', 120), ('hat:party', 'hat', 150),
  ('hat:chef', 'hat', 150), ('hat:halo', 'hat', 200), ('hat:tophat', 'hat', 200), ('hat:cowboy', 'hat', 200),
  ('hat:headphones', 'hat', 200), ('hat:flowercrown', 'hat', 220), ('hat:wizard', 'hat', 250), ('hat:crown', 'hat', 350),
  ('card:ink', 'card', 100), ('card:gold', 'card', 150), ('card:rose', 'card', 150), ('card:grape', 'card', 150),
  ('card:mint', 'card', 150), ('card:sky', 'card', 150),
  ('aura:gold', 'aura', 250), ('aura:sunset', 'aura', 250), ('aura:sakura', 'aura', 250), ('aura:hearts', 'aura', 250),
  ('aura:galaxy', 'aura', 300), ('aura:aurora', 'aura', 300),
  ('color:ff4747', 'color', 60), ('color:ffe94d', 'color', 60), ('color:12c2a8', 'color', 60),
  ('color:e07bff', 'color', 60), ('color:c9a27a', 'color', 60), ('color:b8bec9', 'color', 60),
  ('shape:heart', 'shape', 100), ('shape:onion', 'shape', 100), ('shape:ghosty', 'shape', 100),
  ('eyes:hearts', 'eyes', 120), ('eyes:stars', 'eyes', 120), ('eyes:shades', 'eyes', 150),
  ('eyes:nerd', 'eyes', 100), ('eyes:dizzy', 'eyes', 100), ('eyes:dead', 'eyes', 100),
  ('mouth:fangs', 'mouth', 100), ('mouth:cat', 'mouth', 80), ('mouth:mustache', 'mouth', 100), ('mouth:braces', 'mouth', 80),
  ('top:cat', 'top', 100), ('top:bunny', 'top', 100), ('top:flower', 'top', 100), ('top:unicorn', 'top', 150)
on conflict (id) do update set kind = excluded.kind, price = excluded.price;

-- the knobs: launch gift, coins per ad, seconds an ad must run, ads per day
create or replace function public.gat_shop_cfg()
 returns jsonb language sql immutable
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
  select jsonb_build_object('gift', 15000, 'ad_coins', 25, 'ad_seconds', 15, 'ad_daily', 20);
$function$;

-- admin has everything, perk users all flair, Ember every theme and graffiti; the rest is what you bought
create or replace function public.gat_owns(u public.gat_users, p_item text)
 returns boolean language sql stable
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
  select u.is_admin
    or not exists (select 1 from public.gat_shop_items i where i.id = p_item)
    or (u.perks and split_part(p_item, ':', 1) in ('hat', 'card', 'aura'))
    or (lower(u.username) = 'ember' and split_part(p_item, ':', 1) in ('theme', 'graffiti'))
    or exists (select 1 from public.gat_owned o where o.user_id = u.id and o.item = p_item);
$function$;

create or replace function public.gat_ads_today(p_user uuid)
 returns int language sql stable
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
  select count(*)::int from public.gat_ad_views a
   where a.user_id = p_user and a.claimed_at is not null and public.gat_ist_day(a.claimed_at) = public.gat_ist_day();
$function$;

create or replace function public.gat_shop_json(u public.gat_users, p_gift int default 0)
 returns jsonb language sql stable
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
  select jsonb_build_object(
    'coins', u.coins,
    'owned', coalesce((select jsonb_agg(i.id) from public.gat_shop_items i where public.gat_owns(u, i.id)), '[]'::jsonb),
    'prices', coalesce((select jsonb_object_agg(i.id, i.price) from public.gat_shop_items i where i.active), '{}'::jsonb),
    'ads', jsonb_build_object(
      'left', greatest(0, (k.cfg->>'ad_daily')::int - public.gat_ads_today(u.id)),
      'coins', (k.cfg->>'ad_coins')::int,
      'seconds', (k.cfg->>'ad_seconds')::int),
    'gift', nullif(p_gift, 0),
    'temp', u.is_temp)
  from (select public.gat_shop_cfg() cfg) k;
$function$;

-- open the shop: hands out the launch gift once per kept account
create or replace function public.gat_shop(p_token text)
 returns jsonb language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  u public.gat_users := public.gat_auth(p_token);
  g int := 0;
begin
  if not u.is_temp and not u.coin_gift then
    g := (public.gat_shop_cfg()->>'gift')::int;
    update public.gat_users set coins = coins + g, coin_gift = true where id = u.id and not coin_gift;
    if found then
      insert into public.gat_coin_log (user_id, delta, reason) values (u.id, g, 'launch gift');
    else
      g := 0;
    end if;
    select * into u from public.gat_users where id = u.id;
  end if;
  return public.gat_shop_json(u, g);
end;
$function$;

create or replace function public.gat_buy(p_token text, p_item text)
 returns jsonb language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  u public.gat_users := public.gat_auth(p_token);
  it public.gat_shop_items;
begin
  select * into it from public.gat_shop_items where id = p_item and active;
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  if u.is_temp then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  -- the row lock makes two taps at once pay once
  select * into u from public.gat_users where id = u.id for update;
  if public.gat_owns(u, p_item) then return public.gat_shop_json(u); end if;
  if u.coins < it.price then raise exception 'not_enough' using errcode = 'P0001'; end if;
  update public.gat_users set coins = coins - it.price where id = u.id returning * into u;
  insert into public.gat_owned (user_id, item, price) values (u.id, p_item, it.price) on conflict do nothing;
  insert into public.gat_coin_log (user_id, delta, reason, item) values (u.id, -it.price, 'buy', p_item);
  return public.gat_shop_json(u);
end;
$function$;

-- an ad starts here; the coins only come from gat_ad_claim after it has run its full time
create or replace function public.gat_ad_start(p_token text, p_slot text default 'reward')
 returns jsonb language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  u public.gat_users := public.gat_auth(p_token);
  cfg jsonb := public.gat_shop_cfg();
  secs int := (cfg->>'ad_seconds')::int;
  v public.gat_ad_views;
begin
  if u.is_temp then raise exception 'not_allowed' using errcode = 'P0001'; end if;
  if public.gat_ads_today(u.id) >= (cfg->>'ad_daily')::int then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  -- one at a time: an unfinished ad from the last few minutes comes back with its clock still running
  select * into v from public.gat_ad_views
   where user_id = u.id and claimed_at is null and started_at > now() - interval '3 minutes'
   order by started_at desc limit 1;
  if found then
    return jsonb_build_object('id', v.id, 'seconds', greatest(0, ceil(secs - extract(epoch from now() - v.started_at)))::int);
  end if;
  insert into public.gat_ad_views (user_id, slot) values (u.id, left(coalesce(nullif(p_slot, ''), 'reward'), 20)) returning * into v;
  return jsonb_build_object('id', v.id, 'seconds', secs);
end;
$function$;

create or replace function public.gat_ad_claim(p_token text, p_id uuid)
 returns jsonb language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  u public.gat_users := public.gat_auth(p_token);
  cfg jsonb := public.gat_shop_cfg();
  c int := (cfg->>'ad_coins')::int;
  v public.gat_ad_views;
begin
  select * into v from public.gat_ad_views where id = p_id and user_id = u.id for update;
  if not found or v.claimed_at is not null or v.started_at < now() - interval '15 minutes' then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if v.started_at > now() - make_interval(secs => (cfg->>'ad_seconds')::int - 1) then raise exception 'too_soon' using errcode = 'P0001'; end if;
  if public.gat_ads_today(u.id) >= (cfg->>'ad_daily')::int then raise exception 'rate_limited' using errcode = 'P0001'; end if;
  update public.gat_ad_views set claimed_at = now(), coins = c where id = v.id;
  update public.gat_users set coins = coins + c where id = u.id returning * into u;
  insert into public.gat_coin_log (user_id, delta, reason) values (u.id, c, 'ad');
  return public.gat_shop_json(u);
end;
$function$;

-- graffiti on the walls of a chat: anyone who owns it for the current theme can put it up, either can take it down
create or replace function public.gat_graffiti(p_token text, p_conversation uuid, p_on boolean)
 returns jsonb language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  u public.gat_users := public.gat_auth(p_token);
  v_m public.gat_members := public.gat_require_member(p_conversation, u.id);
  v_c public.gat_conversations;
  v_inbox uuid;
  v_payload jsonb;
begin
  select * into v_c from public.gat_conversations where id = p_conversation;
  if coalesce(p_on, false) and not (exists (select 1 from public.gat_shop_items where id = 'graffiti:' || v_c.theme) and public.gat_owns(u, 'graffiti:' || v_c.theme)) then
    raise exception 'locked' using errcode = 'P0001';
  end if;
  update public.gat_conversations set graffiti = coalesce(p_on, false) where id = p_conversation returning * into v_c;
  select inbox into v_inbox from public.gat_users where id = v_m.peer_id;
  v_payload := jsonb_build_object('conversation_id', v_c.id, 'theme', v_c.theme, 'theme_by', v_c.theme_by, 'theme_at', v_c.theme_at, 'graffiti', v_c.graffiti);
  perform realtime.send(v_payload, 'theme', 'gat:u:' || v_inbox::text, false);
  perform realtime.send(v_payload, 'theme', 'gat:u:' || u.inbox::text, false);
  return public.gat_conv_json(p_conversation, u.id);
end;
$function$;

-- flair for everyone now: each piece has to be owned (what you already wear stays)
create or replace function public.gat_set_flair(p_token text, p_flair jsonb)
 returns jsonb language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  u public.gat_users := public.gat_auth(p_token);
  f jsonb := coalesce(p_flair, '{}'::jsonb);
  h text := coalesce(f->>'hat', 'none');
  c text := coalesce(f->>'card', 'none');
  a text := coalesce(f->>'aura', 'none');
begin
  if not (h = any (array['none','crown','cap','beanie','halo','bow','tophat','party','cowboy','wizard','headphones','flowercrown','chef']) or (h = 'neo' and u.is_admin)) then h := 'none'; end if;
  if not (c = any (array['none','ink','gold','rose','grape','mint','sky'])) then c := 'none'; end if;
  if not (a = any (array['none','gold','sunset','galaxy','sakura','aurora','hearts']) or (a = 'matrix' and u.is_admin)) then a := 'none'; end if;
  if (h <> 'none' and h is distinct from u.flair->>'hat' and not public.gat_owns(u, 'hat:' || h))
     or (c <> 'none' and c is distinct from u.flair->>'card' and not public.gat_owns(u, 'card:' || c))
     or (a <> 'none' and a is distinct from u.flair->>'aura' and not public.gat_owns(u, 'aura:' || a)) then
    raise exception 'locked' using errcode = 'P0001';
  end if;
  update public.gat_users set flair = jsonb_build_object(
    'hat', h,
    'bio', case when u.perks then left(btrim(regexp_replace(coalesce(f->>'bio', ''), '[[:cntrl:]]+', ' ', 'g')), 140) else coalesce(u.flair->>'bio', '') end,
    'card', c,
    'aura', a
  ) where id = u.id returning * into u;
  return public.gat_me_json(u);
end;
$function$;

-- premium face parts have to be owned; a part you already wear can stay
create or replace function public.gat_set_avatar(p_token text, p_avatar jsonb)
 returns jsonb language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  u public.gat_users := public.gat_auth(p_token);
begin
  if p_avatar is not null and (jsonb_typeof(p_avatar) <> 'object' or octet_length(p_avatar::text) > 600) then
    raise exception 'body_invalid' using errcode = 'P0001';
  end if;
  if p_avatar is not null then
    if ((p_avatar->>'color') is distinct from (u.avatar->>'color') and not public.gat_owns(u, 'color:' || lower(ltrim(coalesce(p_avatar->>'color', ''), '#'))))
       or ((p_avatar->>'blob') is distinct from (u.avatar->>'blob') and not public.gat_owns(u, 'shape:' || coalesce(p_avatar->>'blob', '')))
       or ((p_avatar->>'eyes') is distinct from (u.avatar->>'eyes') and not public.gat_owns(u, 'eyes:' || coalesce(p_avatar->>'eyes', '')))
       or ((p_avatar->>'mouth') is distinct from (u.avatar->>'mouth') and not public.gat_owns(u, 'mouth:' || coalesce(p_avatar->>'mouth', '')))
       or ((p_avatar->>'top') is distinct from (u.avatar->>'top') and not public.gat_owns(u, 'top:' || coalesce(p_avatar->>'top', ''))) then
      raise exception 'locked' using errcode = 'P0001';
    end if;
    if p_avatar ? 'photo' and jsonb_typeof(p_avatar->'photo') = 'null' then
      p_avatar := p_avatar - 'photo';
    else
      p_avatar := (p_avatar - 'photo') || case when u.avatar ? 'photo' then jsonb_build_object('photo', u.avatar->'photo') else '{}'::jsonb end;
    end if;
  end if;
  update public.gat_users set avatar = p_avatar where id = u.id returning * into u;
  return public.gat_me_json(u);
end;
$function$;

create or replace function public.gat_flairs()
 returns jsonb language sql stable security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
  select coalesce(jsonb_agg(jsonb_build_object('username', username, 'flair', flair)), '[]'::jsonb)
    from public.gat_users
   where not banned and (perks or coalesce(flair->>'hat', 'none') <> 'none' or coalesce(flair->>'card', 'none') <> 'none' or coalesce(flair->>'aura', 'none') <> 'none');
$function$;

do $do$
declare d text;
begin
  -- profiles carry flair for anyone wearing some, not only perk users
  d := pg_get_functiondef('public.gat_profile_json'::regproc);
  if position('flair->>''hat''' in d) = 0 then
    d := replace(d, '''flair'', case when u.perks then u.flair else null end',
      '''flair'', case when u.perks or coalesce(u.flair->>''hat'', ''none'') <> ''none'' or coalesce(u.flair->>''card'', ''none'') <> ''none'' or coalesce(u.flair->>''aura'', ''none'') <> ''none'' then u.flair else null end');
    execute d;
  end if;

  d := pg_get_functiondef('public.gat_me_json'::regproc);
  if position('''coins''' in d) = 0 then
    d := replace(d, '''freezes'', u.freezes);', '''freezes'', u.freezes, ''coins'', u.coins);');
    execute d;
  end if;

  d := pg_get_functiondef('public.gat_conv_json'::regproc);
  if position('''graffiti''' in d) = 0 then
    d := replace(d, '''theme_at'', c.theme_at,', '''theme_at'', c.theme_at, ''graffiti'', c.graffiti,');
    execute d;
  end if;

  -- themes: six new ones, premium ones need owning, graffiti goes up when the picker owns it
  d := pg_get_functiondef('public.gat_theme'::regproc);
  if position('gat_owns' in d) = 0 then
    d := replace(d, '''sakuranight'', ''butterfly''', '''sakuranight'', ''butterfly'', ''vapor'', ''ocean'', ''galaxy'', ''sunset'', ''noir'', ''arcade''');
    d := replace(d, '  v_m := public.gat_require_member(p_conversation, u.id);', '  v_m := public.gat_require_member(p_conversation, u.id);
  if not public.gat_owns(u, ''theme:'' || p_theme) then
    raise exception ''locked'' using errcode = ''P0001'';
  end if;');
    d := replace(d, 'set theme = p_theme, theme_by = u.id, theme_at = now()',
      'set theme = p_theme, theme_by = u.id, theme_at = now(),
         graffiti = exists (select 1 from public.gat_shop_items where id = ''graffiti:'' || p_theme) and public.gat_owns(u, ''graffiti:'' || p_theme)');
    d := replace(d, '''theme_at'', v_c.theme_at);', '''theme_at'', v_c.theme_at, ''graffiti'', v_c.graffiti);');
    execute d;
  end if;

  -- admin: hand someone coins
  d := pg_get_functiondef('public.gat_admin'::regproc);
  if position('''coins''' in d) = 0 then
    d := replace(d, '  elsif p_op = ''photos'' then', '  elsif p_op = ''coins'' then
    update public.gat_users set coins = greatest(0, coins + coalesce((p_a->>''n'')::int, 0)) where id = (p_a->>''id'')::uuid returning * into t;
    if not found then raise exception ''not_found'' using errcode = ''P0001''; end if;
    insert into public.gat_coin_log (user_id, delta, reason) values (t.id, coalesce((p_a->>''n'')::int, 0), ''admin'');
    return public.gat_admin_row(t);

  elsif p_op = ''photos'' then');
    execute d;
  end if;
end;
$do$;

-- themes people already earned the old way stay theirs
insert into public.gat_owned (user_id, item)
  select id, 'theme:meteor' from public.gat_users where coalesce((stats->>'chats')::int, 0) >= 3
  union all select id, 'theme:butterfly' from public.gat_users where coalesce((stats->>'chats')::int, 0) >= 10
  union all select id, 'theme:sakuranight' from public.gat_users where coalesce((stats->>'msgs')::int, 0) >= 100
  union all select id, 'theme:temple' from public.gat_users where coalesce((stats->>'streak')::int, 0) >= 3
on conflict do nothing;

-- no size cap of our own on voice notes and photos (the storage plan's own limit still applies)
update storage.buckets set file_size_limit = null where id in ('gat-voice', 'gat-img');

revoke all on function public.gat_shop_cfg(), public.gat_owns(public.gat_users, text), public.gat_ads_today(uuid),
  public.gat_shop_json(public.gat_users, int) from public, anon, authenticated;
revoke all on function public.gat_shop(text), public.gat_buy(text, text), public.gat_ad_start(text, text),
  public.gat_ad_claim(text, uuid), public.gat_graffiti(text, uuid, boolean) from public;
grant execute on function public.gat_shop(text), public.gat_buy(text, text), public.gat_ad_start(text, text),
  public.gat_ad_claim(text, uuid), public.gat_graffiti(text, uuid, boolean) to anon, authenticated;
