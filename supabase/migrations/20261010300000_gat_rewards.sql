-- Streak and melt nudges only for friends.
do $do$
declare d text;
begin
  select pg_get_functiondef('public.gat_nudge_send(uuid,text,text,text,text)'::regprocedure) into d;
  if position('friends only' in d) = 0 then
    d := replace(d, 'begin
  if v_url is null', 'begin
  -- friends only: streak/melt nudges skip stranger chats
  if p_tag ~ ''^(streak|melt)-'' and not coalesce((select bool_and(friend) and count(*) = 2 from public.gat_members
       where conversation_id = substring(p_tag from position(''-'' in p_tag) + 1)::uuid), false) then return; end if;
  if v_url is null');
    execute d;
  end if;
end;
$do$;

-- Daily check-in gives a streak freeze (max 2); a nightly sweep spends one to save a streak that missed a day.
alter table public.gat_users add column if not exists freezes int not null default 0;
alter table public.gat_users add column if not exists checkin_day date;
alter table public.gat_users add column if not exists badges text[] not null default '{}';
alter table public.gat_users add column if not exists stats jsonb;

create or replace function public.gat_checkin(p_token text)
 returns jsonb language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  u public.gat_users := public.gat_auth(p_token);
  d date := public.gat_ist_day();
  got boolean := u.checkin_day is null or u.checkin_day < d;
begin
  if got then
    update public.gat_users set freezes = least(2, freezes + 1), checkin_day = d where id = u.id returning * into u;
  end if;
  return jsonb_build_object('freezes', u.freezes, 'got', got);
end;
$function$;

create or replace function public.gat_freeze_sweep()
 returns void language plpgsql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
declare
  d date := public.gat_ist_day();
  c record;
  payer uuid;
begin
  for c in select id, user_a, user_b from public.gat_conversations where streak >= 2 and streak_day = d - 2 loop
    select id into payer from public.gat_users where id in (c.user_a, c.user_b) and freezes > 0 order by freezes desc limit 1;
    if payer is not null then
      update public.gat_users set freezes = freezes - 1 where id = payer;
      update public.gat_conversations set streak_day = d - 1 where id = c.id;
    end if;
  end loop;
end;
$function$;

-- Badges and lifetime stats, refreshed hourly; earned badges and best numbers never go backwards.
create or replace function public.gat_badges_refresh()
 returns void language sql security definer
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
  with m as (
    select sender_id uid, count(*) msgs, count(distinct conversation_id) chats,
           count(*) filter (where extract(hour from created_at at time zone 'Asia/Kolkata') < 4) owl
      from public.gat_messages where kind = 'text' group by sender_id
  ), s as (
    select uid, max(streak) best from (select user_a uid, streak from public.gat_conversations union all select user_b, streak from public.gat_conversations) x group by uid
  ), f as (
    select user_id uid, count(*) n from public.gat_members m1
     where m1.friend and exists (select 1 from public.gat_members m2 where m2.conversation_id = m1.conversation_id and m2.user_id = m1.peer_id and m2.friend)
     group by user_id
  ), calc as (
    select u.id,
           greatest(coalesce((u.stats->>'msgs')::int, 0), coalesce(m.msgs, 0)) msgs,
           greatest(coalesce((u.stats->>'chats')::int, 0), coalesce(m.chats, 0)) chats,
           greatest(coalesce((u.stats->>'streak')::int, 0), coalesce(s.best, 0)) streak,
           coalesce(m.owl, 0) owl, coalesce(f.n, 0) friends
      from public.gat_users u left join m on m.uid = u.id left join s on s.uid = u.id left join f on f.uid = u.id
  )
  update public.gat_users u set
    stats = jsonb_build_object('msgs', c.msgs, 'chats', c.chats, 'streak', c.streak),
    badges = (select array(select distinct b from unnest(u.badges || array_remove(array[
      case when c.msgs >= 1 then 'first' end,
      case when c.msgs >= 100 then 'chatty' end,
      case when c.chats >= 10 then 'social' end,
      case when c.owl >= 20 then 'owl' end,
      case when c.streak >= 7 then 'streak7' end,
      case when c.friends >= 1 then 'bestie' end,
      case when c.friends >= 5 then 'squad' end], null)) b order by b))
  from calc c where c.id = u.id;
$function$;

do $do$
declare d text;
begin
  select pg_get_functiondef('public.gat_profile_json(gat_users)'::regprocedure) into d;
  if position('''badges''' in d) = 0 then
    d := replace(d, '''bio'', u.bio,', '''bio'', u.bio, ''badges'', u.badges,');
    execute d;
  end if;
  select pg_get_functiondef('public.gat_me_json(gat_users)'::regprocedure) into d;
  if position('''stats''' in d) = 0 then
    d := replace(d, '''has_key'', u.recovery_hash is not null', '''has_key'', u.recovery_hash is not null, ''stats'', u.stats, ''freezes'', u.freezes');
    execute d;
  end if;
end;
$do$;

revoke all on function public.gat_checkin(text) from public;
grant execute on function public.gat_checkin(text) to anon, authenticated;
revoke all on function public.gat_freeze_sweep() from public, anon, authenticated;
revoke all on function public.gat_badges_refresh() from public, anon, authenticated;

select cron.schedule('gat-freeze-sweep', '35 18 * * *', 'select public.gat_freeze_sweep()');
select cron.schedule('gat-badges', '23 * * * *', 'select public.gat_badges_refresh()');
select public.gat_badges_refresh();
