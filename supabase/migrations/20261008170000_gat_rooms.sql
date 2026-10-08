-- Group chat rooms: 3 public rooms everybody can join, plus private rooms users create.
create table if not exists public.gat_rooms (
  id uuid primary key default gen_random_uuid(),
  slug text unique,
  name text not null check (char_length(name) between 1 and 40),
  kind text not null check (kind in ('public', 'private')),
  theme text not null default 'goofy',
  topic uuid not null default gen_random_uuid(),
  seed int not null default floor(random() * 1000000)::int,
  sort int not null default 100,
  created_by uuid references public.gat_users(id),
  created_at timestamptz not null default now(),
  last_message_at timestamptz
);
create table if not exists public.gat_room_members (
  room_id uuid not null references public.gat_rooms(id),
  user_id uuid not null references public.gat_users(id),
  active boolean not null default true,
  joined_at timestamptz not null default now(),
  last_read_at timestamptz not null default now(),
  primary key (room_id, user_id)
);
create index if not exists gat_room_members_user on public.gat_room_members(user_id) where active;
create table if not exists public.gat_room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.gat_rooms(id),
  sender_id uuid not null references public.gat_users(id),
  body text not null check (char_length(body) between 1 and 2000),
  kind text not null default 'text',
  created_at timestamptz not null default clock_timestamp()
);
create index if not exists gat_room_messages_room on public.gat_room_messages(room_id, created_at desc);
alter table public.gat_rooms enable row level security;
alter table public.gat_room_members enable row level security;
alter table public.gat_room_messages enable row level security;

insert into public.gat_rooms (slug, name, kind, theme, sort, seed) values
  ('yap', 'daily dose of yapping', 'public', 'citrus', 1, 4242),
  ('owls', 'night owls', 'public', 'midnight', 2, 1313),
  ('screen', '24 hour screentime', 'public', 'terminal', 3, 2424)
on conflict (slug) do nothing;

create or replace function public.gat_room_msg_json(m public.gat_room_messages)
returns jsonb language sql stable set search_path to 'public', 'extensions', 'pg_temp' as $$
  select jsonb_build_object('id', m.id, 'room_id', m.room_id, 'sender_id', m.sender_id, 'body', m.body, 'kind', m.kind, 'created_at', m.created_at,
    'sender', (select public.gat_profile_json(u) from public.gat_users u where u.id = m.sender_id));
$$;

create or replace function public.gat_room_json(p_room uuid, p_viewer uuid)
returns jsonb language sql stable set search_path to 'public', 'extensions', 'pg_temp' as $$
  select jsonb_build_object(
    'id', r.id, 'slug', r.slug, 'name', r.name, 'kind', r.kind, 'theme', r.theme, 'topic', r.topic, 'seed', r.seed, 'sort', r.sort,
    'created_by', r.created_by, 'created_at', r.created_at, 'last_message_at', r.last_message_at,
    'members', case when r.kind = 'private' then (select count(*) from public.gat_room_members x where x.room_id = r.id and x.active) else null end,
    'unread', coalesce((select count(*) from public.gat_room_messages x where x.room_id = r.id and x.sender_id <> p_viewer and x.created_at > me.last_read_at), 0),
    'last_message', (select public.gat_room_msg_json(x) from public.gat_room_messages x where x.room_id = r.id order by x.created_at desc limit 1)
  )
  from public.gat_rooms r
  left join public.gat_room_members me on me.room_id = r.id and me.user_id = p_viewer
  where r.id = p_room;
$$;

create or replace function public.gat_room_can(p_room uuid, p_user uuid)
returns boolean language sql stable set search_path to 'public', 'extensions', 'pg_temp' as $$
  select exists (select 1 from public.gat_rooms r where r.id = p_room and (r.kind = 'public'
    or exists (select 1 from public.gat_room_members m where m.room_id = r.id and m.user_id = p_user and m.active)));
$$;

create or replace function public.gat_room_notify(p_room uuid)
returns void language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp' as $$
declare r record;
begin
  for r in select m.user_id, u.inbox from public.gat_room_members m join public.gat_users u on u.id = m.user_id
           join public.gat_rooms g on g.id = m.room_id
           where m.room_id = p_room and m.active and g.kind = 'private' loop
    perform realtime.send(public.gat_room_json(p_room, r.user_id), 'room', 'gat:u:' || r.inbox::text, false);
  end loop;
exception when others then raise warning 'gat_room_notify: %', sqlerrm;
end;
$$;

create or replace function public.gat_rooms(p_token text)
returns jsonb language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp' as $$
declare u public.gat_users := public.gat_auth(p_token);
begin
  return coalesce((select jsonb_agg(public.gat_room_json(r.id, u.id) order by r.sort, r.last_message_at desc nulls last)
    from public.gat_rooms r
    where r.kind = 'public' or exists (select 1 from public.gat_room_members m where m.room_id = r.id and m.user_id = u.id and m.active)), '[]'::jsonb);
end;
$$;

create or replace function public.gat_room_get(p_token text, p_room uuid)
returns jsonb language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp' as $$
declare u public.gat_users := public.gat_auth(p_token);
begin
  if not public.gat_room_can(p_room, u.id) then raise exception 'not_found' using errcode = 'P0001'; end if;
  return public.gat_room_json(p_room, u.id);
end;
$$;

create or replace function public.gat_room_create(p_token text, p_name text, p_members uuid[])
returns jsonb language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp' as $$
declare u public.gat_users := public.gat_auth(p_token); v_id uuid; v_name text := btrim(coalesce(p_name, ''));
begin
  if char_length(v_name) < 1 or char_length(v_name) > 40 then raise exception 'body_invalid' using errcode = 'P0001'; end if;
  insert into public.gat_rooms (name, kind, created_by) values (v_name, 'private', u.id) returning id into v_id;
  insert into public.gat_room_members (room_id, user_id) values (v_id, u.id);
  insert into public.gat_room_members (room_id, user_id)
    select v_id, x.id from public.gat_users x where x.id = any (coalesce(p_members, '{}')) and x.id <> u.id limit 49
    on conflict do nothing;
  perform public.gat_room_notify(v_id);
  return public.gat_room_json(v_id, u.id);
end;
$$;

create or replace function public.gat_room_add(p_token text, p_room uuid, p_users uuid[])
returns jsonb language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp' as $$
declare u public.gat_users := public.gat_auth(p_token);
begin
  if not exists (select 1 from public.gat_room_members m join public.gat_rooms r on r.id = m.room_id
                 where m.room_id = p_room and m.user_id = u.id and m.active and r.kind = 'private') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  insert into public.gat_room_members (room_id, user_id)
    select p_room, x.id from public.gat_users x where x.id = any (coalesce(p_users, '{}'))
    on conflict (room_id, user_id) do update set active = true, joined_at = now(), last_read_at = now();
  perform public.gat_room_notify(p_room);
  return public.gat_room_json(p_room, u.id);
end;
$$;

create or replace function public.gat_room_leave(p_token text, p_room uuid)
returns void language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp' as $$
declare u public.gat_users := public.gat_auth(p_token);
begin
  update public.gat_room_members set active = false where room_id = p_room and user_id = u.id;
  perform public.gat_room_notify(p_room);
end;
$$;

create or replace function public.gat_room_people(p_token text, p_room uuid)
returns jsonb language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp' as $$
declare u public.gat_users := public.gat_auth(p_token);
begin
  if not public.gat_room_can(p_room, u.id) then raise exception 'not_found' using errcode = 'P0001'; end if;
  return coalesce((select jsonb_agg(public.gat_profile_json(x) order by m.joined_at)
    from public.gat_room_members m join public.gat_users x on x.id = m.user_id
    where m.room_id = p_room and m.active), '[]'::jsonb);
end;
$$;

create or replace function public.gat_room_history(p_token text, p_room uuid, p_before timestamptz default null, p_limit int default 50)
returns jsonb language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp' as $$
declare u public.gat_users := public.gat_auth(p_token);
begin
  if not public.gat_room_can(p_room, u.id) then raise exception 'not_found' using errcode = 'P0001'; end if;
  return coalesce((select jsonb_agg(public.gat_room_msg_json(x) order by x.created_at) from (
    select * from public.gat_room_messages m where m.room_id = p_room and (p_before is null or m.created_at < p_before)
    order by m.created_at desc limit least(greatest(coalesce(p_limit, 50), 1), 100)) x), '[]'::jsonb);
end;
$$;

create or replace function public.gat_room_read(p_token text, p_room uuid)
returns void language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp' as $$
declare u public.gat_users := public.gat_auth(p_token);
begin
  if not public.gat_room_can(p_room, u.id) then return; end if;
  insert into public.gat_room_members (room_id, user_id, last_read_at) values (p_room, u.id, now())
    on conflict (room_id, user_id) do update set last_read_at = now();
end;
$$;

create or replace function public.gat_room_send(p_token text, p_room uuid, p_body text)
returns jsonb language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp' as $$
declare u public.gat_users := public.gat_auth(p_token); m public.gat_room_messages; r public.gat_rooms; v jsonb; v_body text := btrim(coalesce(p_body, ''));
begin
  select * into r from public.gat_rooms where id = p_room;
  if not found or not public.gat_room_can(p_room, u.id) then raise exception 'not_found' using errcode = 'P0001'; end if;
  if char_length(v_body) < 1 or char_length(v_body) > 2000 or v_body like '[[voice:%' or v_body like '[[img:%' then
    raise exception 'body_invalid' using errcode = 'P0001';
  end if;
  insert into public.gat_room_messages (room_id, sender_id, body) values (p_room, u.id, v_body) returning * into m;
  update public.gat_rooms set last_message_at = m.created_at where id = p_room;
  insert into public.gat_room_members (room_id, user_id, last_read_at) values (p_room, u.id, m.created_at)
    on conflict (room_id, user_id) do update set last_read_at = excluded.last_read_at;
  v := public.gat_room_msg_json(m);
  begin
    perform realtime.send(v, 'rmsg', 'gat:r:' || r.topic::text, false);
  exception when others then raise warning 'gat_room_send: %', sqlerrm;
  end;
  if r.kind = 'private' then perform public.gat_room_notify(p_room); end if;
  return v;
end;
$$;

create or replace function public.gat_search_users(p_token text, p_q text)
returns jsonb language plpgsql security definer set search_path to 'public', 'extensions', 'pg_temp' as $$
declare u public.gat_users := public.gat_auth(p_token); q text := lower(btrim(coalesce(p_q, '')));
begin
  if q = '' then return '[]'::jsonb; end if;
  q := replace(replace(replace(q, '\', '\\'), '%', '\%'), '_', '\_');
  return coalesce((select jsonb_agg(public.gat_profile_json(x)) from (
    select * from public.gat_users x where x.id <> u.id and lower(x.username) like q || '%'
    order by (lower(x.username) = q) desc, x.last_seen_at desc nulls last limit 12) x), '[]'::jsonb);
end;
$$;

grant execute on function public.gat_rooms(text), public.gat_room_get(text, uuid), public.gat_room_create(text, text, uuid[]),
  public.gat_room_add(text, uuid, uuid[]), public.gat_room_leave(text, uuid), public.gat_room_people(text, uuid),
  public.gat_room_history(text, uuid, timestamptz, int), public.gat_room_read(text, uuid), public.gat_room_send(text, uuid, text),
  public.gat_search_users(text, text) to anon, authenticated;
