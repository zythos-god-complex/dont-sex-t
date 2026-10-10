-- Yap streaks (both people talk every IST day; survives the purge because it lives on the conversation),
-- melting messages (unread close to the purge), and the nudges (pushes) for both.
alter table public.gat_conversations add column if not exists streak int not null default 0;
alter table public.gat_conversations add column if not exists streak_day date;
alter table public.gat_conversations add column if not exists a_day date;
alter table public.gat_conversations add column if not exists b_day date;
alter table public.gat_conversations add column if not exists streak_pinged date;
alter table public.gat_members add column if not exists melt_pinged_at timestamptz;

create table if not exists public.gat_nudges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  title text not null,
  body text not null,
  url text not null default '/',
  tag text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.gat_nudges enable row level security;
revoke all on public.gat_nudges from anon, authenticated;

create or replace function public.gat_ist_day(t timestamptz default now())
 returns date language sql stable
as $function$ select (t at time zone 'Asia/Kolkata')::date $function$;

create or replace function public.gat_streak_bump()
 returns trigger language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  c public.gat_conversations;
  d date := public.gat_ist_day(new.created_at);
begin
  select * into c from public.gat_conversations where id = new.conversation_id for update;
  if not found then return new; end if;
  if new.sender_id = c.user_a then c.a_day := d;
  elsif new.sender_id = c.user_b then c.b_day := d;
  else return new;
  end if;
  if c.a_day = d and c.b_day = d and c.streak_day is distinct from d then
    c.streak := case when c.streak_day = d - 1 then c.streak + 1 else 1 end;
    c.streak_day := d;
  end if;
  update public.gat_conversations set a_day = c.a_day, b_day = c.b_day, streak = c.streak, streak_day = c.streak_day where id = c.id;
  return new;
end;
$function$;

create or replace trigger gat_streak_bump after insert on public.gat_messages
  for each row execute function public.gat_streak_bump();

-- what the client needs: streaks alive on my chats, and chats with unread messages about to melt
create or replace function public.gat_pulse(p_token text)
 returns jsonb language plpgsql stable security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  u public.gat_users := public.gat_auth(p_token);
  d date := public.gat_ist_day();
  late boolean := extract(hour from now() at time zone 'Asia/Kolkata') >= 20;
begin
  return jsonb_build_object(
    'streaks', (select coalesce(jsonb_object_agg(c.id, jsonb_build_object(
        'n', c.streak,
        'droop', c.streak_day = d - 1 and late,
        'me', case when c.user_a = u.id then c.a_day = d else c.b_day = d end,
        'peer', case when c.user_a = u.id then c.b_day = d else c.a_day = d end)), '{}'::jsonb)
      from public.gat_conversations c
     where (c.user_a = u.id or c.user_b = u.id) and c.streak >= 1 and c.streak_day >= d - 1),
    'melt', (select coalesce(jsonb_object_agg(q.cid, q.oldest), '{}'::jsonb) from (
        select m.conversation_id cid, min(x.created_at) oldest
          from public.gat_members m
          join public.gat_messages x on x.conversation_id = m.conversation_id and x.sender_id = m.peer_id
                                     and x.created_at > coalesce(m.last_read_at, '-infinity'::timestamptz)
         where m.user_id = u.id
         group by m.conversation_id
        having min(x.created_at) < now() - interval '19 hours') q)
  );
end;
$function$;

create or replace function public.gat_nudge_send(p_user uuid, p_title text, p_body text, p_url text, p_tag text)
 returns void language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  n uuid;
  v_url text := (select value from public.gat_config where key = 'push_url');
  v_secret text := (select value from public.gat_config where key = 'push_secret');
begin
  if v_url is null or not exists (select 1 from public.gat_push_subs where user_id = p_user) then return; end if;
  insert into public.gat_nudges (user_id, title, body, url, tag) values (p_user, p_title, p_body, p_url, p_tag) returning id into n;
  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('nudge_id', n),
    params := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-gat-secret', coalesce(v_secret, '')),
    timeout_milliseconds := 4000
  );
end;
$function$;

-- the push function claims a nudge once, same shape as gat_push_claim
create or replace function public.gat_nudge_claim(p_secret text, p_nudge uuid)
 returns jsonb language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  r public.gat_nudges;
begin
  if p_secret is null or p_secret <> coalesce((select value from public.gat_config where key = 'push_secret'), '') or p_secret = '' then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  update public.gat_nudges set sent_at = now() where id = p_nudge and sent_at is null returning * into r;
  if not found then return jsonb_build_object('send', false); end if;
  return jsonb_build_object('send', true, 'title', r.title, 'body', r.body, 'url', r.url, 'tag', r.tag,
    'subs', (select coalesce(jsonb_agg(jsonb_build_object('endpoint', endpoint, 'p256dh', p256dh, 'auth', auth)), '[]'::jsonb)
               from public.gat_push_subs where user_id = r.user_id));
end;
$function$;

-- 20:00 IST: streaks not yet kept today droop, the quiet side gets one push
create or replace function public.gat_streak_nudge()
 returns int language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  d date := public.gat_ist_day();
  c record;
  k int := 0;
begin
  for c in
    select x.*, ua.username a_name, ub.username b_name,
           coalesce(ma.muted, true) a_muted, coalesce(mb.muted, true) b_muted
      from public.gat_conversations x
      join public.gat_users ua on ua.id = x.user_a
      join public.gat_users ub on ub.id = x.user_b
      left join public.gat_members ma on ma.conversation_id = x.id and ma.user_id = x.user_a
      left join public.gat_members mb on mb.conversation_id = x.id and mb.user_id = x.user_b
     where x.streak >= 1 and x.streak_day = d - 1 and x.streak_pinged is distinct from d
  loop
    if c.a_day is distinct from d and not c.a_muted then
      perform public.gat_nudge_send(c.user_a, '🔥 ' || c.streak || ' day streak', 'your streak with ' || c.b_name || ' is drooping, say something', '/dm/' || c.b_name, 'streak-' || c.id);
      k := k + 1;
    end if;
    if c.b_day is distinct from d and not c.b_muted then
      perform public.gat_nudge_send(c.user_b, '🔥 ' || c.streak || ' day streak', 'your streak with ' || c.a_name || ' is drooping, say something', '/dm/' || c.a_name, 'streak-' || c.id);
      k := k + 1;
    end if;
    update public.gat_conversations set streak_pinged = d where id = c.id;
  end loop;
  return k;
end;
$function$;

-- hourly: unread messages about to hit the 24h purge, one push per chat
create or replace function public.gat_melt_nudge()
 returns int language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  r record;
  k int := 0;
begin
  for r in
    select m.user_id, m.conversation_id, p.username peer_name
      from public.gat_members m
      join public.gat_users p on p.id = m.peer_id
      join public.gat_messages x on x.conversation_id = m.conversation_id and x.sender_id = m.peer_id
                                 and x.created_at > coalesce(m.last_read_at, '-infinity'::timestamptz)
     where not m.muted and (m.melt_pinged_at is null or m.melt_pinged_at < now() - interval '20 hours')
     group by m.user_id, m.conversation_id, p.username
    having min(x.created_at) < now() - interval '19 hours'
  loop
    perform public.gat_nudge_send(r.user_id, r.peer_name, '⏳ their messages melt soon, peek before they vanish', '/dm/' || r.peer_name, 'melt-' || r.conversation_id);
    update public.gat_members set melt_pinged_at = now() where conversation_id = r.conversation_id and user_id = r.user_id;
    k := k + 1;
  end loop;
  return k;
end;
$function$;

select cron.schedule('gat-streak-nudge', '30 14 * * *', 'select public.gat_streak_nudge()');
select cron.schedule('gat-melt-nudge', '41 * * * *', 'select public.gat_melt_nudge()');

revoke all on function public.gat_pulse(text) from public;
revoke all on function public.gat_nudge_claim(text, uuid) from public;
revoke all on function public.gat_nudge_send(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.gat_streak_nudge() from public, anon, authenticated;
revoke all on function public.gat_melt_nudge() from public, anon, authenticated;
grant execute on function public.gat_pulse(text) to anon, authenticated;
grant execute on function public.gat_nudge_claim(text, uuid) to anon, authenticated;
