-- GoofyAhhTalk: initial schema.
-- Shared Supabase project: every object here is prefixed gat_.
-- Contract: SPEC.md, section "Database".

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.gat_users (
  id            uuid primary key default gen_random_uuid(),
  username      text not null check (username ~ '^[A-Za-z0-9_.]{3,20}$'),
  gender        text not null check (gender in ('m', 'f')),
  token_hash    bytea not null unique,
  inbox         uuid not null unique default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  active_at     timestamptz,
  active_conv   uuid
);
create unique index gat_users_username_lower_key on public.gat_users (lower(username));

create table public.gat_conversations (
  id               uuid primary key default gen_random_uuid(),
  user_a           uuid not null references public.gat_users on delete cascade,
  user_b           uuid not null references public.gat_users on delete cascade,
  topic            uuid not null unique default gen_random_uuid(),
  theme            text not null default 'goofy',
  theme_by         uuid references public.gat_users on delete set null,
  theme_at         timestamptz,
  created_at       timestamptz not null default now(),
  last_message_at  timestamptz,
  constraint gat_conversations_order_check check (user_a < user_b),
  constraint gat_conversations_pair_key unique (user_a, user_b)
);
create index gat_conversations_user_b_idx on public.gat_conversations (user_b);

create table public.gat_members (
  conversation_id  uuid not null references public.gat_conversations on delete cascade,
  user_id          uuid not null references public.gat_users on delete cascade,
  peer_id          uuid not null references public.gat_users on delete cascade,
  last_read_at     timestamptz not null default 'epoch',
  muted            boolean not null default false,
  primary key (conversation_id, user_id)
);
create index gat_members_user_idx on public.gat_members (user_id);
create index gat_members_peer_idx on public.gat_members (peer_id);

create table public.gat_messages (
  id               uuid primary key,
  conversation_id  uuid not null references public.gat_conversations on delete cascade,
  sender_id        uuid not null references public.gat_users on delete cascade,
  kind             text not null default 'text' check (kind in ('text', 'theme')),
  body             text not null check (char_length(body) between 1 and 2000),
  created_at       timestamptz not null default clock_timestamp(),
  pushed_at        timestamptz
);
create index gat_messages_conv_created_idx on public.gat_messages (conversation_id, created_at desc);
create index gat_messages_sender_created_idx on public.gat_messages (sender_id, created_at desc);

create table public.gat_push_subs (
  endpoint    text primary key,
  user_id     uuid not null references public.gat_users on delete cascade,
  p256dh      text not null,
  auth        text not null,
  ua          text,
  created_at  timestamptz not null default now()
);
create index gat_push_subs_user_idx on public.gat_push_subs (user_id);

-- private server config ('push_secret', 'push_url'); never readable through the API
create table public.gat_config (
  key    text primary key,
  value  text not null
);

-- ---------------------------------------------------------------------------
-- Lock tables down: RLS on, no policies, no table privileges for API roles.
-- ---------------------------------------------------------------------------

alter table public.gat_users         enable row level security;
alter table public.gat_conversations enable row level security;
alter table public.gat_members       enable row level security;
alter table public.gat_messages      enable row level security;
alter table public.gat_push_subs     enable row level security;
alter table public.gat_config        enable row level security;

revoke all on table
  public.gat_users, public.gat_conversations, public.gat_members,
  public.gat_messages, public.gat_push_subs, public.gat_config
from public, anon, authenticated;

-- Default privileges in this shared project may hand new tables to other roles too.
do $$
declare r record;
begin
  for r in
    select distinct c.relname, pg_get_userbyid(a.grantee) as role
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(c.relacl) a
    where n.nspname = 'public'
      and c.relname in ('gat_users', 'gat_conversations', 'gat_members',
                        'gat_messages', 'gat_push_subs', 'gat_config')
      and a.grantee <> 0
      and pg_get_userbyid(a.grantee) not in ('postgres', 'supabase_admin', 'service_role')
  loop
    execute format('revoke all on table public.%I from %I', r.relname, r.role);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Internal helpers (not callable through the API)
-- ---------------------------------------------------------------------------

-- Resolve a session token to its user or raise unauthorized.
create function public.gat_auth(p_token text)
returns public.gat_users
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  u public.gat_users;
begin
  if p_token is null or p_token = '' then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;
  select * into u from public.gat_users where token_hash = extensions.digest(p_token, 'sha256');
  if not found then
    raise exception 'unauthorized' using errcode = 'P0001';
  end if;
  return u;
end;
$$;

-- Membership row of p_user in p_conv or raise forbidden.
create function public.gat_require_member(p_conv uuid, p_user uuid)
returns public.gat_members
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  m public.gat_members;
begin
  select * into m from public.gat_members where conversation_id = p_conv and user_id = p_user;
  if not found then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  return m;
end;
$$;

-- Profile JSON: { id, username, gender, last_seen_at }
create function public.gat_profile_json(u public.gat_users)
returns jsonb
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select case when u.id is null then null else jsonb_build_object(
    'id', u.id,
    'username', u.username,
    'gender', u.gender,
    'last_seen_at', u.last_seen_at
  ) end;
$$;

-- Me JSON: Profile & { inbox }
create function public.gat_me_json(u public.gat_users)
returns jsonb
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select public.gat_profile_json(u) || jsonb_build_object('inbox', u.inbox);
$$;

-- Message JSON: { id, conversation_id, sender_id, kind, body, created_at }
create function public.gat_msg_json(m public.gat_messages)
returns jsonb
language sql
stable
set search_path = public, extensions, pg_temp
as $$
  select case when m.id is null then null else jsonb_build_object(
    'id', m.id,
    'conversation_id', m.conversation_id,
    'sender_id', m.sender_id,
    'kind', m.kind,
    'body', m.body,
    'created_at', m.created_at
  ) end;
$$;

-- Conversation JSON from p_viewer's perspective. Null if p_viewer is not a member.
create function public.gat_conv_json(p_conv uuid, p_viewer uuid)
returns jsonb
language sql
set search_path = public, extensions, pg_temp
as $$
  select jsonb_build_object(
    'id', c.id,
    'topic', c.topic,
    'theme', c.theme,
    'theme_by', c.theme_by,
    'theme_at', c.theme_at,
    'created_at', c.created_at,
    'last_message_at', c.last_message_at,
    'peer', public.gat_profile_json(p),
    'my_last_read_at', me.last_read_at,
    'peer_last_read_at', pm.last_read_at,
    'muted', me.muted,
    'unread', (
      select count(*)
      from public.gat_messages x
      where x.conversation_id = c.id
        and x.sender_id = me.peer_id
        and x.created_at > me.last_read_at
    ),
    'last_message', (
      select public.gat_msg_json(x)
      from public.gat_messages x
      where x.conversation_id = c.id
      order by x.created_at desc, x.id desc
      limit 1
    )
  )
  from public.gat_conversations c
  join public.gat_members me on me.conversation_id = c.id and me.user_id = p_viewer
  join public.gat_members pm on pm.conversation_id = c.id and pm.user_id = me.peer_id
  join public.gat_users p on p.id = me.peer_id
  where c.id = p_conv;
$$;

-- ---------------------------------------------------------------------------
-- Message insert trigger: bookkeeping, realtime fan-out, push hand-off.
-- ---------------------------------------------------------------------------

create function public.gat_on_message()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_sm      public.gat_members;  -- sender's membership row
  v_sender  public.gat_users;
  v_rcpt    public.gat_users;
  v_msg     jsonb;
  v_muted   boolean;
  v_url     text;
  v_secret  text;
begin
  update public.gat_conversations
     set last_message_at = greatest(coalesce(last_message_at, new.created_at), new.created_at)
   where id = new.conversation_id;

  update public.gat_members
     set last_read_at = greatest(last_read_at, new.created_at)
   where conversation_id = new.conversation_id and user_id = new.sender_id
  returning * into v_sm;
  if not found then
    return null;
  end if;

  select * into v_sender from public.gat_users where id = new.sender_id;
  select * into v_rcpt from public.gat_users where id = v_sm.peer_id;
  v_msg := public.gat_msg_json(new);

  -- 1 + 2: recipient inbox (recipient perspective), sender inbox (sender perspective)
  begin
    perform realtime.send(
      jsonb_build_object('message', v_msg, 'conversation', public.gat_conv_json(new.conversation_id, v_rcpt.id)),
      'msg', 'gat:u:' || v_rcpt.inbox::text, false);
    perform realtime.send(
      jsonb_build_object('message', v_msg, 'conversation', public.gat_conv_json(new.conversation_id, v_sender.id)),
      'msg', 'gat:u:' || v_sender.inbox::text, false);
  exception when others then
    raise warning 'gat_on_message fanout: %', sqlerrm;
  end;

  -- 3: web push hand-off (text only, recipient has subs, not muted, push_url configured)
  if new.kind = 'text' then
    begin
      select muted into v_muted
        from public.gat_members
       where conversation_id = new.conversation_id and user_id = v_rcpt.id;
      if not coalesce(v_muted, false)
         and exists (select 1 from public.gat_push_subs where user_id = v_rcpt.id) then
        select value into v_url from public.gat_config where key = 'push_url';
        select value into v_secret from public.gat_config where key = 'push_secret';
        if v_url is not null and v_url <> '' then
          perform net.http_post(
            url := v_url,
            body := jsonb_build_object('message_id', new.id),
            params := '{}'::jsonb,
            headers := jsonb_build_object('Content-Type', 'application/json', 'x-gat-secret', coalesce(v_secret, '')),
            timeout_milliseconds := 4000
          );
        end if;
      end if;
    exception when others then
      raise warning 'gat_on_message push: %', sqlerrm;
    end;
  end if;

  return null;
end;
$$;

create trigger gat_messages_after_insert
after insert on public.gat_messages
for each row execute function public.gat_on_message();

-- ---------------------------------------------------------------------------
-- Public RPCs (anon may call; token checked inside)
-- ---------------------------------------------------------------------------

create function public.gat_join(p_username text, p_gender text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_name   text := btrim(coalesce(p_username, ''));
  v_gender text := lower(btrim(coalesce(p_gender, '')));
  v_token  text;
  u        public.gat_users;
begin
  if v_name !~ '^[A-Za-z0-9_.]{3,20}$' then
    raise exception 'username_invalid' using errcode = 'P0001';
  end if;
  if v_gender not in ('m', 'f') then
    raise exception 'gender_invalid' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.gat_users where lower(username) = lower(v_name)) then
    raise exception 'username_taken' using errcode = 'P0001';
  end if;

  -- base64url, 32 random bytes, no padding
  v_token := translate(encode(extensions.gen_random_bytes(32), 'base64'), E'+/=\n', '-_');

  begin
    insert into public.gat_users (username, gender, token_hash)
    values (v_name, v_gender, extensions.digest(v_token, 'sha256'))
    returning * into u;
  exception when unique_violation then
    raise exception 'username_taken' using errcode = 'P0001';
  end;

  return jsonb_build_object('token', v_token, 'me', public.gat_me_json(u));
end;
$$;

create function public.gat_me(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  u public.gat_users := public.gat_auth(p_token);
begin
  update public.gat_users set last_seen_at = now() where id = u.id returning * into u;
  return public.gat_me_json(u);
end;
$$;

create function public.gat_profiles(p_token text, p_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  u public.gat_users := public.gat_auth(p_token);
begin
  return coalesce((
    select jsonb_agg(public.gat_profile_json(x))
    from public.gat_users x
    where x.id = any ((p_ids)[1:100])
  ), '[]'::jsonb);
end;
$$;

create function public.gat_lookup(p_token text, p_username text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  u public.gat_users := public.gat_auth(p_token);
  v public.gat_users;
begin
  select * into v from public.gat_users where lower(username) = lower(btrim(coalesce(p_username, '')));
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  return public.gat_profile_json(v);
end;
$$;

create function public.gat_open(p_token text, p_peer uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  u        public.gat_users := public.gat_auth(p_token);
  v_peer   public.gat_users;
  v_conv   uuid;
  v_a      uuid;
  v_b      uuid;
begin
  if p_peer is null then
    raise exception 'not_found' using errcode = 'P0001';
  end if;
  if p_peer = u.id then
    raise exception 'self_chat' using errcode = 'P0001';
  end if;
  select * into v_peer from public.gat_users where id = p_peer;
  if not found then
    raise exception 'not_found' using errcode = 'P0001';
  end if;

  v_a := least(u.id, v_peer.id);
  v_b := greatest(u.id, v_peer.id);

  select id into v_conv from public.gat_conversations where user_a = v_a and user_b = v_b;
  if v_conv is null then
    insert into public.gat_conversations (user_a, user_b)
    values (v_a, v_b)
    on conflict (user_a, user_b) do nothing
    returning id into v_conv;

    if v_conv is not null then
      insert into public.gat_members (conversation_id, user_id, peer_id)
      values (v_conv, u.id, v_peer.id), (v_conv, v_peer.id, u.id);
      -- let the peer subscribe to the conversation topic right away
      perform realtime.send(public.gat_conv_json(v_conv, v_peer.id), 'conv', 'gat:u:' || v_peer.inbox::text, false);
    else
      select id into v_conv from public.gat_conversations where user_a = v_a and user_b = v_b;
    end if;
  end if;

  return public.gat_conv_json(v_conv, u.id);
end;
$$;

create function public.gat_conversations(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  u public.gat_users := public.gat_auth(p_token);
begin
  return coalesce((
    select jsonb_agg(public.gat_conv_json(c.id, u.id) order by coalesce(c.last_message_at, c.created_at) desc, c.id)
    from public.gat_members m
    join public.gat_conversations c on c.id = m.conversation_id
    where m.user_id = u.id
  ), '[]'::jsonb);
end;
$$;

create function public.gat_messages(
  p_token text,
  p_conversation uuid,
  p_before timestamptz default null,
  p_limit int default 40
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  u       public.gat_users := public.gat_auth(p_token);
  v_limit int := least(greatest(coalesce(p_limit, 40), 1), 100);
begin
  perform public.gat_require_member(p_conversation, u.id);
  return coalesce((
    select jsonb_agg(s.j order by s.created_at desc, s.id desc)
    from (
      select public.gat_msg_json(x) as j, x.created_at, x.id
      from public.gat_messages x
      where x.conversation_id = p_conversation
        and (p_before is null or x.created_at < p_before)
      order by x.created_at desc, x.id desc
      limit v_limit
    ) s
  ), '[]'::jsonb);
end;
$$;

create function public.gat_send(p_token text, p_conversation uuid, p_id uuid, p_body text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  u      public.gat_users := public.gat_auth(p_token);
  v_id   uuid := coalesce(p_id, gen_random_uuid());
  v_body text;
  v_msg  public.gat_messages;
begin
  perform public.gat_require_member(p_conversation, u.id);

  -- idempotent re-send
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

  -- last_message_at, sender last_read_at and fan-out happen in gat_on_message()
  insert into public.gat_messages (id, conversation_id, sender_id, kind, body)
  values (v_id, p_conversation, u.id, 'text', v_body)
  on conflict (id) do nothing
  returning * into v_msg;

  if not found then
    select * into v_msg from public.gat_messages where id = v_id;
    if v_msg.sender_id <> u.id or v_msg.conversation_id <> p_conversation then
      raise exception 'forbidden' using errcode = 'P0001';
    end if;
  end if;

  return public.gat_msg_json(v_msg);
end;
$$;

create function public.gat_read(p_token text, p_conversation uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  u         public.gat_users := public.gat_auth(p_token);
  v_m       public.gat_members;
  v_inbox   uuid;
  v_payload jsonb;
begin
  update public.gat_members
     set last_read_at = greatest(last_read_at, now())
   where conversation_id = p_conversation and user_id = u.id
  returning * into v_m;
  if not found then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  select inbox into v_inbox from public.gat_users where id = v_m.peer_id;
  v_payload := jsonb_build_object('conversation_id', p_conversation, 'user_id', u.id, 'at', v_m.last_read_at);
  perform realtime.send(v_payload, 'read', 'gat:u:' || v_inbox::text, false);
  perform realtime.send(v_payload, 'read', 'gat:u:' || u.inbox::text, false);

  return jsonb_build_object('at', v_m.last_read_at);
end;
$$;

create function public.gat_theme(p_token text, p_conversation uuid, p_theme text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  u         public.gat_users := public.gat_auth(p_token);
  v_m       public.gat_members;
  v_c       public.gat_conversations;
  v_inbox   uuid;
  v_payload jsonb;
begin
  if p_theme is null or p_theme not in (
    'goofy', 'cherry', 'midnight', 'matcha', 'peach', 'lagoon', 'lavender', 'terminal',
    'bubblegum', 'citrus', 'aurora', 'noir', 'strawberry', 'forest', 'sunset', 'y2k'
  ) then
    raise exception 'theme_invalid' using errcode = 'P0001';
  end if;
  v_m := public.gat_require_member(p_conversation, u.id);

  update public.gat_conversations
     set theme = p_theme, theme_by = u.id, theme_at = now()
   where id = p_conversation
  returning * into v_c;

  -- system line; the trigger fans it out like any message (never pushed)
  insert into public.gat_messages (id, conversation_id, sender_id, kind, body)
  values (gen_random_uuid(), p_conversation, u.id, 'theme', p_theme);

  select inbox into v_inbox from public.gat_users where id = v_m.peer_id;
  v_payload := jsonb_build_object(
    'conversation_id', v_c.id, 'theme', v_c.theme, 'theme_by', v_c.theme_by, 'theme_at', v_c.theme_at);
  perform realtime.send(v_payload, 'theme', 'gat:u:' || v_inbox::text, false);
  perform realtime.send(v_payload, 'theme', 'gat:u:' || u.inbox::text, false);

  return public.gat_conv_json(p_conversation, u.id);
end;
$$;

create function public.gat_mute(p_token text, p_conversation uuid, p_muted boolean)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  u       public.gat_users := public.gat_auth(p_token);
  v_muted boolean;
begin
  update public.gat_members
     set muted = coalesce(p_muted, false)
   where conversation_id = p_conversation and user_id = u.id
  returning muted into v_muted;
  if not found then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  return jsonb_build_object('muted', v_muted);
end;
$$;

create function public.gat_heartbeat(p_token text, p_conv uuid default null, p_visible boolean default true)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  u public.gat_users := public.gat_auth(p_token);
begin
  if coalesce(p_visible, true) then
    update public.gat_users
       set last_seen_at = now(), active_at = now(), active_conv = p_conv
     where id = u.id;
  else
    update public.gat_users
       set last_seen_at = now(), active_at = null, active_conv = null
     where id = u.id;
  end if;
end;
$$;

create function public.gat_push_subscribe(
  p_token text,
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_ua text default null
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  u public.gat_users := public.gat_auth(p_token);
begin
  if coalesce(p_endpoint, '') = '' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'body_invalid' using errcode = 'P0001';
  end if;

  insert into public.gat_push_subs (endpoint, user_id, p256dh, auth, ua)
  values (p_endpoint, u.id, p_p256dh, p_auth, p_ua)
  on conflict (endpoint) do update
    set user_id = excluded.user_id,
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        ua = excluded.ua,
        created_at = now();

  -- the 10-per-user cap is added in 20261008100100_gat_push_cleanup.sql
end;
$$;

-- gat_push_unsubscribe: see 20261008100100_gat_push_cleanup.sql

-- ---------------------------------------------------------------------------
-- Server-only RPCs (secret-gated; called by api/push.ts with the publishable key)
-- ---------------------------------------------------------------------------

create function public.gat_push_claim(p_secret text, p_message uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_secret  text;
  v_msg     public.gat_messages;
  v_sender  public.gat_users;
  v_rm      public.gat_members;
  v_rcpt    public.gat_users;
  v_subs    jsonb;
begin
  select value into v_secret from public.gat_config where key = 'push_secret';
  if v_secret is null or v_secret = '' or p_secret is null or p_secret <> v_secret then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;

  update public.gat_messages
     set pushed_at = now()
   where id = p_message and pushed_at is null and kind = 'text'
  returning * into v_msg;
  if not found then
    return jsonb_build_object('send', false, 'reason', 'claimed');
  end if;

  select * into v_sender from public.gat_users where id = v_msg.sender_id;
  select r.* into v_rm
    from public.gat_members s
    join public.gat_members r on r.conversation_id = s.conversation_id and r.user_id = s.peer_id
   where s.conversation_id = v_msg.conversation_id and s.user_id = v_msg.sender_id;
  if not found then
    return jsonb_build_object('send', false, 'reason', 'no_recipient');
  end if;
  if v_rm.muted then
    return jsonb_build_object('send', false, 'reason', 'muted');
  end if;

  select * into v_rcpt from public.gat_users where id = v_rm.user_id;
  if v_rcpt.active_at is not null and v_rcpt.active_at > now() - interval '45 seconds' then
    return jsonb_build_object('send', false, 'reason', 'active');
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth)
                            order by s.created_at desc), '[]'::jsonb)
    into v_subs
    from public.gat_push_subs s
   where s.user_id = v_rcpt.id;
  if jsonb_array_length(v_subs) = 0 then
    return jsonb_build_object('send', false, 'reason', 'no_subs');
  end if;

  return jsonb_build_object(
    'send', true,
    'title', v_sender.username,
    'body', left(v_msg.body, 140),
    'url', '/dm/' || v_sender.username,
    'tag', v_msg.conversation_id,
    'subs', v_subs
  );
end;
$$;

-- gat_push_prune: see 20261008100100_gat_push_cleanup.sql

-- ---------------------------------------------------------------------------
-- Function privileges
-- ---------------------------------------------------------------------------

revoke all on function
  public.gat_auth(text),
  public.gat_require_member(uuid, uuid),
  public.gat_profile_json(public.gat_users),
  public.gat_me_json(public.gat_users),
  public.gat_msg_json(public.gat_messages),
  public.gat_conv_json(uuid, uuid),
  public.gat_on_message()
from public, anon, authenticated;

revoke all on function
  public.gat_join(text, text),
  public.gat_me(text),
  public.gat_profiles(text, uuid[]),
  public.gat_lookup(text, text),
  public.gat_open(text, uuid),
  public.gat_conversations(text),
  public.gat_messages(text, uuid, timestamptz, int),
  public.gat_send(text, uuid, uuid, text),
  public.gat_read(text, uuid),
  public.gat_theme(text, uuid, text),
  public.gat_mute(text, uuid, boolean),
  public.gat_heartbeat(text, uuid, boolean),
  public.gat_push_subscribe(text, text, text, text, text),
  public.gat_push_claim(text, uuid)
from public;

grant execute on function
  public.gat_join(text, text),
  public.gat_me(text),
  public.gat_profiles(text, uuid[]),
  public.gat_lookup(text, text),
  public.gat_open(text, uuid),
  public.gat_conversations(text),
  public.gat_messages(text, uuid, timestamptz, int),
  public.gat_send(text, uuid, uuid, text),
  public.gat_read(text, uuid),
  public.gat_theme(text, uuid, text),
  public.gat_mute(text, uuid, boolean),
  public.gat_heartbeat(text, uuid, boolean),
  public.gat_push_subscribe(text, text, text, text, text),
  public.gat_push_claim(text, uuid)
to anon, authenticated;

notify pgrst, 'reload schema';
