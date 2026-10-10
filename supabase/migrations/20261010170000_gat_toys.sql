-- Toy box (dice, coin, 8-ball, truth or dare) and 1:1 games (rock paper scissors, tic-tac-toe).
-- Every roll and every move is decided here, never on a phone. Toy and game bodies can only come from these functions.
create table if not exists public.gat_games (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null,
  kind text not null,
  a uuid not null,
  b uuid not null,
  state jsonb not null,
  secret jsonb not null default '{}'::jsonb,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists gat_games_conv_idx on public.gat_games (conversation_id);
alter table public.gat_games enable row level security;
revoke all on public.gat_games from anon, authenticated;

-- gat_send refuses toy and game bodies unless one of the functions below is calling it
do $do$
declare
  f regprocedure;
  d text;
  anchor text := E'if char_length(v_body) < 1 or char_length(v_body) > 2000 then\n    raise exception ''body_invalid'' using errcode = ''P0001'';\n  end if;';
begin
  for f in select p.oid::regprocedure from pg_proc p where p.proname = 'gat_send' and p.pronamespace = 'public'::regnamespace loop
    d := pg_get_functiondef(f);
    if position('gat.toy' in d) = 0 and position(anchor in d) > 0 then
      d := replace(d, anchor, anchor || E'\n  if (v_body like ''[[toy:%'' or v_body like ''[[game:%'') and coalesce(current_setting(''gat.toy'', true), '''') <> ''1'' then\n    raise exception ''body_invalid'' using errcode = ''P0001'';\n  end if;');
      execute d;
    end if;
  end loop;
end;
$do$;

create or replace function public.gat_pick(a text[])
 returns text language sql volatile
as $function$ select a[1 + floor(random() * array_length(a, 1))::int] $function$;

create or replace function public.gat_toy(p_token text, p_conversation uuid, p_id uuid, p_kind text, p_arg text default null)
 returns jsonb language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  u public.gat_users := public.gat_auth(p_token);
  peer public.gat_users;
  spicy boolean;
  q text;
  v text;
begin
  perform public.gat_require_member(p_conversation, u.id);
  select x.* into peer from public.gat_users x join public.gat_members m on m.peer_id = x.id where m.conversation_id = p_conversation and m.user_id = u.id;
  spicy := u.nsfw and public.gat_adult(u) and peer.nsfw and public.gat_adult(peer);
  if p_kind = 'dice' then
    v := '[[toy:dice|' || (1 + floor(random() * 6))::int || '|' || (1 + floor(random() * 6))::int || ']]';
  elsif p_kind = 'coin' then
    v := '[[toy:coin|' || case when random() < 0.5 then 'heads' else 'tails' end || ']]';
  elsif p_kind = '8ball' then
    q := left(btrim(regexp_replace(coalesce(p_arg, ''), '[][|[:cntrl:]]+', ' ', 'g')), 120);
    v := '[[toy:8ball|' || public.gat_pick(array['yes, obviously', 'no lmao', 'ask again later', 'absolutely not', 'it is certain', 'the vibes say yes', 'outlook not so good', 'maybe, maybe not', 'without a doubt', 'dont count on it', 'signs point to yes', 'better not tell you now', 'my sources say no', 'yes but at what cost', 'too spicy to answer', 'concentrate and ask again']) || '|' || q || ']]';
  elsif p_kind = 'truth' then
    v := '[[toy:truth|' || public.gat_pick(array[
      'whats the most embarrassing thing in your camera roll', 'who was your first crush', 'whats a lie you told this week',
      'what do you pretend to like but secretly hate', 'whats your most toxic trait', 'last person you stalked online',
      'whats the dumbest way you got hurt', 'what song do you sing when nobody is around', 'whats your biggest red flag',
      'what is something you have never told anyone here', 'whats the weirdest dream you remember', 'who do you text the most'
    ] || case when spicy then array['whats your biggest turn on', 'describe your type in 3 words', 'whats the boldest thing you did for someone you liked', 'rate me 1 to 10 honestly'] else '{}'::text[] end) || ']]';
  elsif p_kind = 'dare' then
    v := '[[toy:dare|' || public.gat_pick(array[
      'send the 5th photo in your gallery (or describe it)', 'type with your elbows for the next message', 'send a voice note singing any song',
      'change your face to the goofiest one for an hour', 'use only emojis for the next 3 messages', 'tell me a joke so bad it hurts',
      'send your most used sticker 3 times', 'speak in third person for 5 messages', 'say something nice about me in all caps',
      'confess your most recent google search', 'make up a rap about your day', 'rate your own vibe out of 10 and defend it'
    ] || case when spicy then array['send a flirty pickup line', 'describe our first date in 2 lines', 'send a kiss sticker and mean it', 'tell me what you would do if I was there rn'] else '{}'::text[] end) || ']]';
  else
    raise exception 'body_invalid' using errcode = 'P0001';
  end if;
  perform set_config('gat.toy', '1', true);
  return public.gat_send(p_token, p_conversation, p_id, v);
end;
$function$;

create or replace function public.gat_game_json(g public.gat_games)
 returns jsonb language sql stable
as $function$
  select jsonb_build_object('id', g.id, 'conversation_id', g.conversation_id, 'kind', g.kind, 'a', g.a, 'b', g.b, 'state', g.state, 'done', g.done);
$function$;

create or replace function public.gat_game_start(p_token text, p_conversation uuid, p_id uuid, p_kind text)
 returns jsonb language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  u public.gat_users := public.gat_auth(p_token);
  v_peer uuid;
  g public.gat_games;
begin
  perform public.gat_require_member(p_conversation, u.id);
  if p_kind not in ('rps', 'ttt') then raise exception 'body_invalid' using errcode = 'P0001'; end if;
  if (select count(*) from public.gat_games where a = u.id and created_at > now() - interval '1 minute') >= 6 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  select peer_id into v_peer from public.gat_members where conversation_id = p_conversation and user_id = u.id;
  insert into public.gat_games (conversation_id, kind, a, b, state)
  values (p_conversation, p_kind, u.id, v_peer,
    case p_kind
      when 'rps' then jsonb_build_object('round', 1, 'moved', '{}'::jsonb, 'score', jsonb_build_object('a', 0, 'b', 0), 'last', null, 'to', 3)
      else jsonb_build_object('board', '.........', 'turn', 'a', 'winner', null, 'line', null)
    end)
  returning * into g;
  perform set_config('gat.toy', '1', true);
  return public.gat_send(p_token, p_conversation, p_id, '[[game:' || g.id || ']]');
end;
$function$;

create or replace function public.gat_game_get(p_token text, p_game uuid)
 returns jsonb language plpgsql stable security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  u public.gat_users := public.gat_auth(p_token);
  g public.gat_games;
begin
  select * into g from public.gat_games where id = p_game and u.id in (a, b);
  if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
  return public.gat_game_json(g);
end;
$function$;

create or replace function public.gat_game_move(p_token text, p_game uuid, p_move text)
 returns jsonb language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  u public.gat_users := public.gat_auth(p_token);
  g public.gat_games;
  side text;
  st jsonb;
  ma text;
  mb text;
  w text;
  bd text;
  i int;
  mark text;
  lines int[][] := array[[1,2,3],[4,5,6],[7,8,9],[1,4,7],[2,5,8],[3,6,9],[1,5,9],[3,5,7]];
begin
  select * into g from public.gat_games where id = p_game for update;
  if not found or u.id not in (g.a, g.b) then raise exception 'not_found' using errcode = 'P0001'; end if;
  if g.done then raise exception 'forbidden' using errcode = 'P0001'; end if;
  side := case when u.id = g.a then 'a' else 'b' end;
  st := g.state;

  if g.kind = 'rps' then
    if p_move not in ('rock', 'paper', 'scissors') then raise exception 'body_invalid' using errcode = 'P0001'; end if;
    if g.secret ? side then raise exception 'forbidden' using errcode = 'P0001'; end if;
    g.secret := g.secret || jsonb_build_object(side, p_move);
    st := jsonb_set(st, '{moved}', (st->'moved') || jsonb_build_object(side, true));
    if g.secret ? 'a' and g.secret ? 'b' then
      ma := g.secret->>'a';
      mb := g.secret->>'b';
      w := case when ma = mb then 'tie'
                when (ma, mb) in (('rock','scissors'), ('paper','rock'), ('scissors','paper')) then 'a'
                else 'b' end;
      st := jsonb_set(st, '{last}', jsonb_build_object('a', ma, 'b', mb, 'w', w));
      if w <> 'tie' then st := jsonb_set(st, array['score', w], to_jsonb((st->'score'->>w)::int + 1)); end if;
      st := jsonb_set(st, '{round}', to_jsonb((st->>'round')::int + 1));
      st := jsonb_set(st, '{moved}', '{}'::jsonb);
      g.secret := '{}'::jsonb;
      if (st->'score'->>'a')::int >= (st->>'to')::int or (st->'score'->>'b')::int >= (st->>'to')::int then g.done := true; end if;
    end if;
  elsif g.kind = 'ttt' then
    i := p_move::int;
    bd := st->>'board';
    if st->>'turn' <> side or i < 0 or i > 8 or substr(bd, i + 1, 1) <> '.' then raise exception 'forbidden' using errcode = 'P0001'; end if;
    mark := case when side = 'a' then 'x' else 'o' end;
    bd := overlay(bd placing mark from i + 1 for 1);
    st := jsonb_set(st, '{board}', to_jsonb(bd));
    for k in 1..8 loop
      if substr(bd, lines[k][1], 1) = mark and substr(bd, lines[k][2], 1) = mark and substr(bd, lines[k][3], 1) = mark then
        st := jsonb_set(jsonb_set(st, '{winner}', to_jsonb(side)), '{line}', to_jsonb(array[lines[k][1] - 1, lines[k][2] - 1, lines[k][3] - 1]));
        g.done := true;
        exit;
      end if;
    end loop;
    if not g.done and position('.' in bd) = 0 then
      st := jsonb_set(st, '{winner}', to_jsonb('draw'::text));
      g.done := true;
    end if;
    if not g.done then st := jsonb_set(st, '{turn}', to_jsonb(case when side = 'a' then 'b' else 'a' end)); end if;
  end if;

  update public.gat_games set state = st, secret = g.secret, done = g.done where id = g.id returning * into g;
  begin
    perform realtime.send(public.gat_game_json(g), 'game', 'gat:c:' || (select topic::text from public.gat_conversations where id = g.conversation_id), false);
  exception when others then raise warning 'gat_game_move: %', sqlerrm;
  end;
  return public.gat_game_json(g);
end;
$function$;

revoke all on function public.gat_toy(text, uuid, uuid, text, text) from public;
revoke all on function public.gat_game_start(text, uuid, uuid, text) from public;
revoke all on function public.gat_game_get(text, uuid) from public;
revoke all on function public.gat_game_move(text, uuid, text) from public;
grant execute on function public.gat_toy(text, uuid, uuid, text, text) to anon, authenticated;
grant execute on function public.gat_game_start(text, uuid, uuid, text) to anon, authenticated;
grant execute on function public.gat_game_get(text, uuid) to anon, authenticated;
grant execute on function public.gat_game_move(text, uuid, text) to anon, authenticated;
