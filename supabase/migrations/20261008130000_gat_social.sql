-- privacy, renames, temp users, message requests, blocks

alter table public.gat_users add column if not exists show_status boolean not null default true;
alter table public.gat_users add column if not exists show_seen boolean not null default true;
alter table public.gat_users add column if not exists is_temp boolean not null default false;

create table if not exists public.gat_name_history (
  id bigserial primary key,
  user_id uuid not null,
  username text not null,
  changed_at timestamptz not null default now()
);
create index if not exists gat_name_history_user on public.gat_name_history (user_id, changed_at desc);
alter table public.gat_name_history enable row level security;
revoke all on table public.gat_name_history from anon, authenticated, public;
revoke all on sequence public.gat_name_history_id_seq from anon, authenticated, public;

alter table public.gat_conversations add column if not exists status text not null default 'accepted';
alter table public.gat_conversations add column if not exists requester uuid;
alter table public.gat_conversations add column if not exists request_at timestamptz;
alter table public.gat_conversations add column if not exists declined_at timestamptz;

create table if not exists public.gat_blocks (
  blocker uuid not null,
  blocked uuid not null,
  active boolean not null default true,
  at timestamptz not null default now(),
  primary key (blocker, blocked)
);
alter table public.gat_blocks enable row level security;
revoke all on table public.gat_blocks from anon, authenticated, public;

create or replace function public.gat_profile_json(u public.gat_users)
returns jsonb language sql stable set search_path = public, extensions, pg_temp as $$
  select case when u.id is null then null else jsonb_build_object(
    'id', u.id, 'username', u.username, 'gender', u.gender, 'last_seen_at', u.last_seen_at,
    'avatar', u.avatar, 'show_status', u.show_status, 'show_seen', u.show_seen, 'temp', u.is_temp
  ) end;
$$;

create or replace function public.gat_conv_json(p_conv uuid, p_viewer uuid)
returns jsonb language sql set search_path = public, extensions, pg_temp as $$
  select jsonb_build_object(
    'id', c.id, 'topic', c.topic, 'theme', c.theme, 'theme_by', c.theme_by, 'theme_at', c.theme_at,
    'created_at', c.created_at, 'last_message_at', c.last_message_at,
    'peer', public.gat_profile_json(p),
    'my_last_read_at', me.last_read_at,
    'peer_last_read_at', case when p.show_seen then pm.last_read_at else 'epoch'::timestamptz end,
    'muted', me.muted,
    'status', c.status, 'requester', c.requester, 'declined_at', c.declined_at,
    'blocked', case
      when exists (select 1 from public.gat_blocks b where b.active and b.blocker = p_viewer and b.blocked = p.id) then 'me'
      when exists (select 1 from public.gat_blocks b where b.active and b.blocker = p.id and b.blocked = p_viewer) then 'them'
      else null end,
    'unread', (select count(*) from public.gat_messages x where x.conversation_id = c.id and x.sender_id = me.peer_id and x.created_at > me.last_read_at),
    'last_message', (select public.gat_msg_json(x) from public.gat_messages x where x.conversation_id = c.id order by x.created_at desc, x.id desc limit 1)
  )
  from public.gat_conversations c
  join public.gat_members me on me.conversation_id = c.id and me.user_id = p_viewer
  join public.gat_members pm on pm.conversation_id = c.id and pm.user_id = me.peer_id
  join public.gat_users p on p.id = me.peer_id
  where c.id = p_conv;
$$;

-- push a fresh 'conv' event to both members
create or replace function public.gat_conv_push(p_conv uuid)
returns void language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare r record;
begin
  for r in select m.user_id, u.inbox from public.gat_members m join public.gat_users u on u.id = m.user_id where m.conversation_id = p_conv loop
    perform realtime.send(public.gat_conv_json(p_conv, r.user_id), 'conv', 'gat:u:' || r.inbox::text, false);
  end loop;
end;
$$;

create or replace function public.gat_send(p_token text, p_conversation uuid, p_id uuid, p_body text)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  u      public.gat_users := public.gat_auth(p_token);
  v_id   uuid := coalesce(p_id, gen_random_uuid());
  v_body text;
  v_msg  public.gat_messages;
  c      public.gat_conversations;
  v_peer uuid;
begin
  perform public.gat_require_member(p_conversation, u.id);

  select * into v_msg from public.gat_messages where id = v_id;
  if found then
    if v_msg.sender_id <> u.id or v_msg.conversation_id <> p_conversation then
      raise exception 'forbidden' using errcode = 'P0001';
    end if;
    return public.gat_msg_json(v_msg);
  end if;

  v_body := regexp_replace(coalesce(p_body, ''), '^\s+|\s+$', '', 'g');
  if char_length(v_body) < 1 or char_length(v_body) > 2000 then
    raise exception 'body_invalid' using errcode = 'P0001';
  end if;

  select peer_id into v_peer from public.gat_members where conversation_id = p_conversation and user_id = u.id;
  if exists (select 1 from public.gat_blocks b where b.active and ((b.blocker = u.id and b.blocked = v_peer) or (b.blocker = v_peer and b.blocked = u.id))) then
    raise exception 'blocked' using errcode = 'P0001';
  end if;

  select * into c from public.gat_conversations where id = p_conversation for update;
  if c.status = 'accepted' and c.requester is null and c.last_message_at is null then
    update public.gat_conversations set status = 'pending', requester = u.id, request_at = now() where id = c.id;
  elsif c.status = 'pending' then
    if c.requester = u.id then
      if exists (select 1 from public.gat_messages x where x.conversation_id = c.id and x.sender_id = u.id and x.kind = 'text' and x.created_at >= c.request_at) then
        raise exception 'request_pending' using errcode = 'P0001';
      end if;
    else
      update public.gat_conversations set status = 'accepted' where id = c.id;
    end if;
  elsif c.status = 'declined' then
    if c.requester = u.id then
      if c.declined_at > now() - interval '24 hours' then
        raise exception 'request_cooldown' using errcode = 'P0001';
      end if;
      update public.gat_conversations set status = 'pending', request_at = now(), declined_at = null where id = c.id;
    else
      update public.gat_conversations set status = 'accepted', declined_at = null where id = c.id;
    end if;
  end if;

  insert into public.gat_messages (id, conversation_id, sender_id, kind, body)
  values (v_id, p_conversation, u.id, 'text', v_body)
  on conflict (id) do nothing
  returning * into v_msg;
  if not found then
    select * into v_msg from public.gat_messages where id = v_id;
  end if;
  return public.gat_msg_json(v_msg);
end;
$$;

create or replace function public.gat_respond(p_token text, p_conversation uuid, p_accept boolean)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  u public.gat_users := public.gat_auth(p_token);
  c public.gat_conversations;
begin
  perform public.gat_require_member(p_conversation, u.id);
  select * into c from public.gat_conversations where id = p_conversation for update;
  if c.status <> 'pending' or c.requester = u.id then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if p_accept then
    update public.gat_conversations set status = 'accepted' where id = c.id;
  else
    update public.gat_conversations set status = 'declined', declined_at = now() where id = c.id;
  end if;
  perform public.gat_conv_push(c.id);
  return public.gat_conv_json(c.id, u.id);
end;
$$;

create or replace function public.gat_read(p_token text, p_conversation uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  u public.gat_users := public.gat_auth(p_token);
  v_m public.gat_members;
  v_inbox uuid;
  v_payload jsonb;
begin
  update public.gat_members set last_read_at = greatest(last_read_at, now())
   where conversation_id = p_conversation and user_id = u.id
  returning * into v_m;
  if not found then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  v_payload := jsonb_build_object('conversation_id', p_conversation, 'user_id', u.id, 'at', v_m.last_read_at);
  if u.show_seen then
    select inbox into v_inbox from public.gat_users where id = v_m.peer_id;
    perform realtime.send(v_payload, 'read', 'gat:u:' || v_inbox::text, false);
  end if;
  perform realtime.send(v_payload, 'read', 'gat:u:' || u.inbox::text, false);
  return jsonb_build_object('at', v_m.last_read_at);
end;
$$;

create or replace function public.gat_settings(p_token text, p_show_status boolean default null, p_show_seen boolean default null)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u public.gat_users := public.gat_auth(p_token);
begin
  update public.gat_users set show_status = coalesce(p_show_status, show_status), show_seen = coalesce(p_show_seen, show_seen)
   where id = u.id returning * into u;
  return public.gat_me_json(u);
end;
$$;

create or replace function public.gat_rename(p_token text, p_username text)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  u public.gat_users := public.gat_auth(p_token);
  v_name text := btrim(coalesce(p_username, ''));
begin
  if v_name !~ '^[A-Za-z0-9_.]{3,20}$' then
    raise exception 'username_invalid' using errcode = 'P0001';
  end if;
  if v_name = u.username then
    return public.gat_me_json(u);
  end if;
  if exists (select 1 from public.gat_users where lower(username) = lower(v_name) and id <> u.id) then
    raise exception 'username_taken' using errcode = 'P0001';
  end if;
  insert into public.gat_name_history (user_id, username) values (u.id, u.username);
  begin
    update public.gat_users set username = v_name where id = u.id returning * into u;
  exception when unique_violation then
    raise exception 'username_taken' using errcode = 'P0001';
  end;
  return public.gat_me_json(u);
end;
$$;

create or replace function public.gat_name_history_of(p_token text, p_user uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  perform public.gat_auth(p_token);
  return coalesce((select jsonb_agg(jsonb_build_object('username', h.username, 'changed_at', h.changed_at) order by h.changed_at desc)
    from public.gat_name_history h where h.user_id = p_user), '[]'::jsonb);
end;
$$;

create or replace function public.gat_join_temp(p_gender text)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_gender text := lower(btrim(coalesce(p_gender, '')));
  v_name text;
  v_token text;
  u public.gat_users;
  i int := 0;
begin
  if v_gender not in ('m', 'f') then
    raise exception 'gender_invalid' using errcode = 'P0001';
  end if;
  loop
    v_name := 'goof1' || lpad(floor(random() * 1000000000)::bigint::text, 9, '0');
    exit when not exists (select 1 from public.gat_users where lower(username) = v_name);
    i := i + 1;
    if i > 20 then raise exception 'server' using errcode = 'P0001'; end if;
  end loop;
  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), E'+/=\n', '-_');
  insert into public.gat_users (username, gender, token_hash, is_temp)
  values (v_name, v_gender, extensions.digest(v_token, 'sha256'), true)
  returning * into u;
  return jsonb_build_object('token', v_token, 'me', public.gat_me_json(u));
end;
$$;

create or replace function public.gat_block(p_token text, p_peer uuid, p_on boolean)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  u public.gat_users := public.gat_auth(p_token);
  r record;
begin
  if p_peer = u.id then raise exception 'self_chat' using errcode = 'P0001'; end if;
  insert into public.gat_blocks (blocker, blocked, active, at) values (u.id, p_peer, p_on, now())
  on conflict (blocker, blocked) do update set active = excluded.active, at = now();
  for r in select m.conversation_id from public.gat_members m where m.user_id = u.id and m.peer_id = p_peer loop
    perform public.gat_conv_push(r.conversation_id);
  end loop;
  return jsonb_build_object('blocked', p_on);
end;
$$;

create or replace function public.gat_block_list(p_token text)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare u public.gat_users := public.gat_auth(p_token);
begin
  return jsonb_build_object(
    'blocked', coalesce((select jsonb_agg(blocked) from public.gat_blocks where blocker = u.id and active), '[]'::jsonb),
    'blocked_by', coalesce((select jsonb_agg(blocker) from public.gat_blocks where blocked = u.id and active), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.gat_conv_push(uuid) from public, anon, authenticated;
revoke all on function public.gat_respond(text, uuid, boolean), public.gat_settings(text, boolean, boolean), public.gat_rename(text, text),
  public.gat_name_history_of(text, uuid), public.gat_join_temp(text), public.gat_block(text, uuid, boolean), public.gat_block_list(text) from public;
grant execute on function public.gat_respond(text, uuid, boolean), public.gat_settings(text, boolean, boolean), public.gat_rename(text, text),
  public.gat_name_history_of(text, uuid), public.gat_join_temp(text), public.gat_block(text, uuid, boolean), public.gat_block_list(text) to anon, authenticated;

notify pgrst, 'reload schema';
