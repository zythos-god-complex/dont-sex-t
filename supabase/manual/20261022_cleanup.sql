-- One-off cleanup. Run it by hand in the Supabase SQL editor (Project > SQL editor > paste > Run).
-- It lives outside supabase/migrations on purpose: it removes rows, so nothing runs it automatically.
-- Run the two parts separately. Each one is safe to run twice.

-- =====================================================================================
-- PART 1: the cron job log (the urgent one: it is 381 MB of a 500 MB free database)
-- almost all of it is job 1 (zq-ai-review), which logs a row every 30 seconds
-- =====================================================================================
truncate table cron.job_run_details;

-- keep it small from now on: every night at 03:11 UTC, trim anything older than a day
select cron.schedule('trim-cron-log', '11 3 * * *',
  $$delete from cron.job_run_details where coalesce(end_time, start_time) < now() - interval '1 day'$$);

-- check: log_rows should be tiny and db_size should drop by about 380 MB
select (select count(*) from cron.job_run_details) as log_rows,
       pg_size_pretty(pg_database_size(current_database())) as db_size;


-- =====================================================================================
-- PART 2: test accounts and everything of theirs
-- zzqa_* (smoke tests), zzgame_*, zzadmintest and the account named "test": 61 accounts.
-- Real people (sunny.bean90, Amaan9, sameer, sushi11 ...), the admin and the auto-named
-- temp visitors are not touched. One transaction: if anything errors, nothing is removed.
-- =====================================================================================
begin;

create temp table zz_ids on commit drop as
  select id from public.gat_users where username ~* '^zz' or lower(username) = 'test';
create temp table zz_convs on commit drop as
  select id from public.gat_conversations where user_a in (select id from zz_ids) or user_b in (select id from zz_ids);
create temp table zz_rooms on commit drop as
  select id from public.gat_rooms where created_by in (select id from zz_ids);

-- rooms they made (none had real members) and their traces in rooms
delete from public.gat_room_messages where room_id in (select id from zz_rooms) or sender_id in (select id from zz_ids);
delete from public.gat_room_members where room_id in (select id from zz_rooms) or user_id in (select id from zz_ids);
delete from public.gat_rooms where id in (select id from zz_rooms);

-- things hanging off their chats
delete from public.gat_reactions where user_id in (select id from zz_ids)
   or message_id in (select id from public.gat_messages where conversation_id in (select id from zz_convs));
delete from public.gat_games where conversation_id in (select id from zz_convs) or a in (select id from zz_ids) or b in (select id from zz_ids);

-- their own rows
delete from public.gat_ad_views where user_id in (select id from zz_ids);
delete from public.gat_coin_log where user_id in (select id from zz_ids);
delete from public.gat_owned where user_id in (select id from zz_ids);
delete from public.gat_name_history where user_id in (select id from zz_ids);
delete from public.gat_nudges where user_id in (select id from zz_ids);
delete from public.gat_upload_tickets where user_id in (select id from zz_ids);
delete from public.gat_blocks where blocker in (select id from zz_ids) or blocked in (select id from zz_ids);
delete from public.gat_reports where reporter in (select id from zz_ids) or target in (select id from zz_ids);

-- the accounts. their chats, messages, members and push subscriptions go with them (cascade)
delete from public.gat_users where id in (select id from zz_ids);

commit;

-- check: 0 test accounts left, 33 real people + 21 temp visitors + 4 forgotten + the admin remain
select count(*) filter (where username ~* '^zz' or lower(username) = 'test') as test_accounts_left,
       count(*) as accounts_total
  from public.gat_users;
