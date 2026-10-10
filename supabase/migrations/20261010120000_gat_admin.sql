-- Admin console: one is_admin-gated dispatcher (stats, people, reports, timeouts, perks, passport reset, notice),
-- user reports with a context snapshot, timeouts that kick live, and a lobby notice for everyone.
alter table public.gat_users add column if not exists banned_until timestamptz;

create table if not exists public.gat_reports (
  id bigint generated always as identity primary key,
  reporter uuid not null,
  target uuid not null,
  reason text not null,
  snapshot jsonb not null default '[]'::jsonb,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
create index if not exists gat_reports_status_idx on public.gat_reports (status, created_at desc);
create index if not exists gat_reports_target_idx on public.gat_reports (target, status);
create index if not exists gat_reports_reporter_idx on public.gat_reports (reporter, created_at);
alter table public.gat_reports enable row level security;
revoke all on public.gat_reports from anon, authenticated;

-- timeouts: banned stays "account gone" (unauthorized); banned_until is a timeout with its own error
create or replace function public.gat_auth(p_token text)
 returns gat_users
 language plpgsql
 security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  u public.gat_users;
begin
  if p_token is null or p_token = '' then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;
  select * into u from public.gat_users where token_hash = extensions.digest(p_token, 'sha256');
  if not found or u.banned then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;
  if u.banned_until is not null and u.banned_until > now() then
    raise exception 'banned' using errcode = 'P0001';
  end if;
  return u;
end;
$function$;

create or replace function public.gat_ban_info(p_token text)
 returns timestamptz
 language sql
 stable
 security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
  select banned_until from public.gat_users
   where token_hash = extensions.digest(coalesce(p_token, ''), 'sha256') and banned_until > now();
$function$;

create or replace function public.gat_notice()
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
  select case when coalesce(n.value, '') = '' then null else jsonb_build_object('text', n.value, 'at', a.value) end
    from (select 1) x
    left join public.gat_config n on n.key = 'notice'
    left join public.gat_config a on a.key = 'notice_at';
$function$;

create or replace function public.gat_report(p_token text, p_name text, p_reason text)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  u public.gat_users := public.gat_auth(p_token);
  t public.gat_users;
  r text := case when p_reason = any (array['spam','creepy','underage','nasty','other']) then p_reason else 'other' end;
  snap jsonb;
begin
  select * into t from public.gat_users where lower(username) = lower(btrim(coalesce(p_name, '')));
  if not found or t.id = u.id then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if (select count(*) from public.gat_reports where reporter = u.id and created_at > now() - interval '1 day') >= 12 then
    raise exception 'rate_limited' using errcode = 'P0001';
  end if;
  -- what they said to the reporter, plus their recent public room lines
  select coalesce(jsonb_agg(x order by x->>'at'), '[]'::jsonb) into snap from (
    (select jsonb_build_object('w', 'dm', 'body', left(m.body, 300), 'at', m.created_at) x
       from public.gat_messages m join public.gat_conversations c on c.id = m.conversation_id
      where m.sender_id = t.id and (c.user_a = u.id or c.user_b = u.id)
      order by m.created_at desc limit 12)
    union all
    (select jsonb_build_object('w', ro.name, 'body', left(rm.body, 300), 'at', rm.created_at)
       from public.gat_room_messages rm join public.gat_rooms ro on ro.id = rm.room_id
      where rm.sender_id = t.id and rm.kind <> 'removed' and ro.kind = 'public'
      order by rm.created_at desc limit 8)
  ) s;
  update public.gat_reports set reason = r, snapshot = snap, created_at = now()
   where reporter = u.id and target = t.id and status = 'open';
  if not found then
    insert into public.gat_reports (reporter, target, reason, snapshot) values (u.id, t.id, r, snap);
  end if;
  return true;
end;
$function$;

create or replace function public.gat_admin_row(g gat_users)
 returns jsonb
 language sql
 stable
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
  select jsonb_build_object(
    'id', g.id, 'username', g.username, 'gender', g.gender, 'created_at', g.created_at, 'last_seen_at', g.last_seen_at,
    'temp', g.is_temp, 'nsfw', g.nsfw, 'adult', public.gat_adult(g), 'age_set', g.birth_ym is not null,
    'vip', g.perks, 'admin', g.is_admin, 'banned', g.banned,
    'until', case when g.banned_until > now() then g.banned_until end,
    'reports', (select count(*) from public.gat_reports r where r.target = g.id and r.status = 'open'));
$function$;

create or replace function public.gat_admin(p_token text, p_op text, p_a jsonb default '{}'::jsonb)
 returns jsonb
 language plpgsql
 security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  u public.gat_users := public.gat_auth(p_token);
  t public.gat_users;
  s jsonb;
  q text;
  f text;
  h int;
begin
  if not u.is_admin then
    raise exception 'not_allowed' using errcode = 'P0001';
  end if;
  p_a := coalesce(p_a, '{}'::jsonb);

  if p_op = 'stats' then
    select jsonb_build_object(
      'users', count(*) filter (where not banned),
      'temp', count(*) filter (where is_temp and not banned),
      'new1', count(*) filter (where created_at > now() - interval '1 day' and not banned),
      'new7', count(*) filter (where created_at > now() - interval '7 days' and not banned),
      'seen1h', count(*) filter (where last_seen_at > now() - interval '1 hour'),
      'seen1', count(*) filter (where last_seen_at > now() - interval '1 day'),
      'seen7', count(*) filter (where last_seen_at > now() - interval '7 days'),
      'timeouts', count(*) filter (where banned_until > now()),
      'vip', count(*) filter (where perks and not banned),
      'adults', count(*) filter (where not banned and public.gat_adult(g)),
      'nsfw', count(*) filter (where nsfw and not banned),
      'd1', jsonb_build_array(
        count(*) filter (where not banned and created_at between now() - interval '8 days' and now() - interval '1 day' and last_seen_at > created_at + interval '20 hours'),
        count(*) filter (where not banned and created_at between now() - interval '8 days' and now() - interval '1 day')),
      'd7', jsonb_build_array(
        count(*) filter (where not banned and created_at between now() - interval '30 days' and now() - interval '7 days' and last_seen_at > created_at + interval '7 days'),
        count(*) filter (where not banned and created_at between now() - interval '30 days' and now() - interval '7 days'))
    ) into s from public.gat_users g;
    return s || jsonb_build_object(
      'chat7', (select count(*) from public.gat_users g where not g.banned and g.created_at > now() - interval '7 days'
                  and exists (select 1 from public.gat_conversations c where (c.user_a = g.id or c.user_b = g.id) and c.status = 'accepted')),
      'msgs1', (select count(*) from public.gat_messages where created_at > now() - interval '1 day'),
      'rmsgs1', (select count(*) from public.gat_room_messages where created_at > now() - interval '1 day'),
      'convs1', (select count(*) from public.gat_conversations where last_message_at > now() - interval '1 day'),
      'day2', jsonb_build_array(
        (select count(*) from public.gat_conversations where status = 'accepted' and created_at between now() - interval '15 days' and now() - interval '1 day' and last_message_at > created_at + interval '1 day'),
        (select count(*) from public.gat_conversations where status = 'accepted' and created_at between now() - interval '15 days' and now() - interval '1 day')),
      'hours', (select jsonb_agg(coalesce(qq.n, 0) order by hs.i) from generate_series(0, 23) hs(i) left join (
                  select floor(extract(epoch from now() - z.created_at) / 3600)::int hh, count(*) n from (
                    select created_at from public.gat_messages where created_at > now() - interval '1 day'
                    union all select created_at from public.gat_room_messages where created_at > now() - interval '1 day') z
                  group by 1) qq on qq.hh = 23 - hs.i),
      'signups', (select jsonb_agg(coalesce(qq.n, 0) order by ds.d) from generate_series(0, 13) ds(d) left join (
                  select (current_date - created_at::date) dd, count(*) n from public.gat_users
                   where created_at >= current_date - 13 group by 1) qq on qq.dd = 13 - ds.d),
      'storage', (select coalesce(jsonb_object_agg(bucket_id, jsonb_build_array(n, b)), '{}'::jsonb) from (
                  select bucket_id, count(*) n, coalesce(sum((metadata->>'size')::bigint), 0) b
                    from storage.objects where bucket_id like 'gat-%' group by 1) qq),
      'db', pg_database_size(current_database()),
      'reports', (select count(*) from public.gat_reports where status = 'open'),
      'rooms', (select coalesce(jsonb_agg(jsonb_build_object('name', qq.name, 'n', qq.n) order by qq.n desc), '[]'::jsonb) from (
                  select r.name, count(*) n from public.gat_room_messages m join public.gat_rooms r on r.id = m.room_id
                   where m.created_at > now() - interval '1 day' and m.kind <> 'removed' group by r.name order by 2 desc limit 5) qq),
      'notice', (select value from public.gat_config where key = 'notice')
    );

  elsif p_op = 'users' then
    q := lower(nullif(btrim(coalesce(p_a->>'q', '')), ''));
    f := coalesce(p_a->>'f', 'all');
    select coalesce(jsonb_agg(public.gat_admin_row(g.x) order by g.k desc nulls last), '[]'::jsonb) into s from (
      select x, case when f = 'new' then x.created_at else x.last_seen_at end k from public.gat_users x
       where (q is null or strpos(lower(x.username), q) > 0)
         and case f
               when 'new' then x.created_at > now() - interval '7 days' and not x.banned
               when 'vip' then x.perks
               when 'timeout' then x.banned_until > now()
               when 'reported' then exists (select 1 from public.gat_reports r where r.target = x.id and r.status = 'open')
               when 'nsfw' then x.nsfw and not x.banned
               when 'gone' then x.banned
               else not x.banned
             end
       order by k desc nulls last limit 60) g;
    return s;

  elsif p_op = 'user' then
    select * into t from public.gat_users where id = (p_a->>'id')::uuid;
    if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
    return public.gat_admin_row(t) || jsonb_build_object(
      'names', (select coalesce(jsonb_agg(x.username order by x.changed_at desc), '[]'::jsonb) from (
                  select username, changed_at from public.gat_name_history where user_id = t.id order by changed_at desc limit 8) x),
      'chats', (select count(*) from public.gat_conversations where (user_a = t.id or user_b = t.id) and status = 'accepted'),
      'blocked_by', (select count(*) from public.gat_blocks where blocked = t.id and active),
      'push', (select count(*) from public.gat_push_subs where user_id = t.id),
      'room', (select coalesce(jsonb_agg(jsonb_build_object('w', x.w, 'body', x.body, 'at', x.at) order by x.at desc), '[]'::jsonb) from (
                  select r.name w, left(m.body, 200) body, m.created_at at from public.gat_room_messages m join public.gat_rooms r on r.id = m.room_id
                   where m.sender_id = t.id and m.kind <> 'removed' and r.kind = 'public' order by m.created_at desc limit 12) x),
      'against', (select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'reason', x.reason, 'status', x.status, 'at', x.created_at, 'by', a.username) order by x.created_at desc), '[]'::jsonb) from (
                  select * from public.gat_reports where target = t.id order by created_at desc limit 10) x
                  left join public.gat_users a on a.id = x.reporter)
    );

  elsif p_op = 'reports' then
    return (select coalesce(jsonb_agg(jsonb_build_object(
              'id', r.id, 'reason', r.reason, 'status', r.status, 'at', r.created_at,
              'by', a.username, 'target', b.username, 'target_id', b.id, 'snap', r.snapshot) order by r.created_at desc), '[]'::jsonb)
      from (select * from public.gat_reports where status = coalesce(p_a->>'s', 'open') order by created_at desc limit 50) r
      left join public.gat_users a on a.id = r.reporter
      left join public.gat_users b on b.id = r.target);

  elsif p_op = 'report' then
    update public.gat_reports set status = case when p_a->>'s' = 'open' then 'open' else 'done' end where id = (p_a->>'id')::bigint;
    return to_jsonb(found);

  elsif p_op = 'ban' then
    select * into t from public.gat_users where id = (p_a->>'id')::uuid;
    if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
    if t.is_admin or t.id = u.id then raise exception 'not_allowed' using errcode = 'P0001'; end if;
    h := coalesce((p_a->>'h')::int, 0);
    update public.gat_users set banned_until = case when h = 0 then null when h < 0 then 'infinity'::timestamptz else now() + make_interval(hours => h) end
     where id = t.id returning * into t;
    if h <> 0 then
      update public.gat_reports set status = 'done' where target = t.id and status = 'open';
      begin
        perform realtime.send('{}'::jsonb, 'kick', 'gat:u:' || t.inbox::text, false);
      exception when others then raise warning 'gat_admin kick: %', sqlerrm;
      end;
    end if;
    return public.gat_admin_row(t);

  elsif p_op = 'perks' then
    update public.gat_users set perks = coalesce((p_a->>'on')::boolean, false),
           flair = case when flair = '{}'::jsonb then jsonb_build_object('hat', 'none', 'bio', '', 'card', 'ink', 'aura', 'none') else flair end
     where id = (p_a->>'id')::uuid returning * into t;
    if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
    return public.gat_admin_row(t);

  elsif p_op = 'passport' then
    update public.gat_users set birth_ym = null, nsfw = false where id = (p_a->>'id')::uuid returning * into t;
    if not found then raise exception 'not_found' using errcode = 'P0001'; end if;
    return public.gat_admin_row(t);

  elsif p_op = 'notice' then
    insert into public.gat_config (key, value) values
      ('notice', left(btrim(regexp_replace(coalesce(p_a->>'text', ''), '[[:cntrl:]]+', ' ', 'g')), 160)),
      ('notice_at', now()::text)
    on conflict (key) do update set value = excluded.value;
    return coalesce(public.gat_notice(), 'null'::jsonb);
  end if;

  raise exception 'not_found' using errcode = 'P0001';
end;
$function$;

revoke all on function public.gat_admin_row(gat_users) from public, anon, authenticated;
revoke all on function public.gat_admin(text, text, jsonb) from public;
revoke all on function public.gat_report(text, text, text) from public;
revoke all on function public.gat_notice() from public;
revoke all on function public.gat_ban_info(text) from public;
grant execute on function public.gat_admin(text, text, jsonb) to anon, authenticated;
grant execute on function public.gat_report(text, text, text) to anon, authenticated;
grant execute on function public.gat_notice() to anon, authenticated;
grant execute on function public.gat_ban_info(text) to anon, authenticated;
