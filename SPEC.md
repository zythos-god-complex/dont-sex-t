# GoofyAhhTalk: engineering contract

> v1 priority is shipping fast with great UI/UX. Security hardening (rate limits, allowlists, audits) is out of scope; keep the backend simple and correct.

Live 1:1 stranger chat. Tiny scale (about 10 concurrent users), so we optimise for latency and polish, not throughput.

This file is the contract every part of the codebase is built against. If you need to deviate, update this file in the same change.

## Stack

| Layer | Choice | Why |
| --- | --- | --- |
| UI | Vite + React 19 + TypeScript (strict) SPA | Whole app is interactive; no SSR value. Small, fast, instant navigation. |
| State | `zustand` | 1 KB, selector-based re-renders. |
| Routing | `wouter` | 2 KB. |
| Motion | `motion` (`motion/react`, use `LazyMotion` + `m` + `domAnimation`) | Layout animations for list enter/leave, sheets, filters. |
| Realtime | `@supabase/realtime-js` only (NOT the full supabase-js) | Presence + broadcast over one websocket. Measured: client broadcast about 30 ms, DB-originated broadcast about 125 ms. |
| Data | Supabase Postgres, accessed only through `SECURITY DEFINER` RPCs via plain `fetch` to PostgREST | No supabase-js needed. |
| Push | Web Push (VAPID). Postgres trigger -> `pg_net` -> Vercel function `api/push.ts` (`web-push` npm) | Server side, reliable even if the sender closes the tab. |
| Hosting | Vercel (static SPA + `api/*` Node functions, region `icn1` next to the DB) | |

Supabase project: `afxnqxxntxfawcgxmyac` (region ap-northeast-2). This project is shared with other apps. **Only ever create, alter or drop objects prefixed `gat_`** (plus rows in our own tables). Never touch any other table, function, policy, publication, or extension.

Public client config lives in `.env` (committed; these values are public by design):

```
VITE_SUPABASE_URL=https://afxnqxxntxfawcgxmyac.supabase.co
VITE_SUPABASE_KEY=sb_publishable_wCY80oH-5UNwFCgyE3O2iQ_FBlU57ws
VITE_VAPID_PUBLIC_KEY=BJg6GPhZEyOprJNso1yn69QiozHlQOSJaTi1nK69MPieD6PkWsht3kZTCqhvrBk5M-ChP2FmE399W8X2y4266hU
```

Server-only secrets (Vercel env, never committed): `VAPID_PRIVATE_KEY`, `GAT_PUSH_SECRET`. `api/push.ts` also reads `VITE_SUPABASE_URL`, `VITE_SUPABASE_KEY`, `VITE_VAPID_PUBLIC_KEY` from env, with the public values above as fallbacks.

## Identity (no passwords)

1. User types a username and picks gender (`m` | `f`), taps start.
2. `gat_join(username, gender)` creates the user and returns an opaque random `token` (base64url, 32 bytes). The DB stores only `sha256(token)`.
3. Client stores `token` and `username` in cookies (`gat_t`, `gat_u`; `Max-Age=34560000`, `Path=/`, `SameSite=Lax`, `Secure` on https) and mirrors them in `localStorage` (`gat.t`, `gat.u`). Read order: cookie, then localStorage; whichever exists repopulates the other.
4. On load, if a token exists, call `gat_me(token)` and skip onboarding. If it returns `unauthorized`, clear storage and show onboarding.
5. Usernames: `^[A-Za-z0-9_.]{3,20}$`, unique case-insensitively, display case preserved. Once taken, taken forever.
6. iOS home screen web apps get a separate storage jar. To carry identity into the installed app, the `<link rel="manifest">` href is set at runtime to `/api/manifest?t=<token>` once a session exists. That function returns the manifest with `start_url: "/?t=<token>"`. On boot, if `?t=` is present, the client adopts it (validate with `gat_me`), stores it, and strips it from the URL with `history.replaceState`.

Every RPC except `gat_join` takes `p_token` as its first argument and raises `unauthorized` if it does not match.

## Database (all objects prefixed `gat_`)

RLS is enabled on every table with **no policies**, and all table privileges are revoked from `anon`, `authenticated` and `public`. The only way in is the RPCs below, which are `SECURITY DEFINER`, `SET search_path = public, extensions, pg_temp`, and granted `EXECUTE` to `anon, authenticated` (revoked from `public`). Secret-gated server RPCs are documented separately.

Errors are raised as `RAISE EXCEPTION '<code>' USING ERRCODE = 'P0001'`. PostgREST then answers HTTP 400 with JSON `{ "code": "P0001", "message": "<code>" }`. The client maps `message` to UX. Codes: `unauthorized`, `username_taken`, `username_invalid`, `gender_invalid`, `not_found`, `forbidden`, `body_invalid`, `rate_limited`, `theme_invalid`, `self_chat`.

### Tables

```
gat_users
  id            uuid pk default gen_random_uuid()
  username      text not null  check (username ~ '^[A-Za-z0-9_.]{3,20}$')
  gender        text not null  check (gender in ('m','f'))
  token_hash    bytea not null unique
  inbox         uuid not null unique default gen_random_uuid()   -- secret realtime topic id
  created_at    timestamptz not null default now()
  last_seen_at  timestamptz not null default now()
  active_at     timestamptz            -- last heartbeat while the app was visible; null when hidden
  active_conv   uuid                   -- conversation open and visible at last heartbeat
  unique index on lower(username)

gat_conversations
  id               uuid pk default gen_random_uuid()
  user_a           uuid not null references gat_users on delete cascade
  user_b           uuid not null references gat_users on delete cascade
  check (user_a < user_b), unique (user_a, user_b)
  topic            uuid not null unique default gen_random_uuid()  -- secret realtime topic id
  theme            text not null default 'goofy'
  theme_by         uuid null references gat_users on delete set null
  theme_at         timestamptz
  created_at       timestamptz not null default now()
  last_message_at  timestamptz

gat_members                       -- one row per (conversation, user); 2 per conversation
  conversation_id  uuid references gat_conversations on delete cascade
  user_id          uuid references gat_users on delete cascade
  peer_id          uuid references gat_users on delete cascade
  last_read_at     timestamptz not null default 'epoch'
  muted            boolean not null default false
  primary key (conversation_id, user_id)
  index (user_id)

gat_messages
  id               uuid pk                 -- generated by the client (crypto.randomUUID) for idempotency and dedupe
  conversation_id  uuid not null references gat_conversations on delete cascade
  sender_id        uuid not null references gat_users on delete cascade
  kind             text not null default 'text' check (kind in ('text','theme'))
  body             text not null check (char_length(body) between 1 and 2000)
  created_at       timestamptz not null default clock_timestamp()
  pushed_at        timestamptz
  index (conversation_id, created_at desc)
  index (sender_id, created_at desc)

gat_push_subs
  endpoint    text pk
  user_id     uuid not null references gat_users on delete cascade
  p256dh      text not null
  auth        text not null
  ua          text
  created_at  timestamptz not null default now()
  index (user_id)

gat_config                         -- private server config, never readable through the API
  key    text pk
  value  text not null
  rows: 'push_secret' (same as Vercel GAT_PUSH_SECRET), 'push_url' (https://<prod-domain>/api/push)
```

### JSON shapes returned by RPCs

```ts
type Gender = 'm' | 'f'
type Profile = { id: string; username: string; gender: Gender; last_seen_at: string }
type Me = Profile & { inbox: string }                 // inbox = secret topic id
type Message = {
  id: string; conversation_id: string; sender_id: string
  kind: 'text' | 'theme'; body: string; created_at: string
}
type Conversation = {
  id: string; topic: string; theme: string
  theme_by: string | null; theme_at: string | null
  created_at: string; last_message_at: string | null
  peer: Profile
  my_last_read_at: string; peer_last_read_at: string
  muted: boolean
  unread: number                  // messages from peer with created_at > my_last_read_at
  last_message: Message | null
}
```

### Public RPCs (anon may call; token checked inside)

| RPC | Returns | Notes |
| --- | --- | --- |
| `gat_join(p_username text, p_gender text)` | `{ token: string, me: Me }` | Validates, inserts. `username_taken` on case-insensitive clash. |
| `gat_me(p_token text)` | `Me` | Touches `last_seen_at`. |
| `gat_profiles(p_token text, p_ids uuid[])` | `Profile[]` | Max 100 ids. Used to verify lobby presence entries. Never exposes `inbox` or token data. |
| `gat_lookup(p_token text, p_username text)` | `Profile` | Case-insensitive. `not_found` if missing. |
| `gat_open(p_token text, p_peer uuid)` | `Conversation` | Get or create. `self_chat` if peer = me. On **create** it inserts both `gat_members` rows and `realtime.send`s event `conv` (payload = the peer-perspective `Conversation`) to the peer's inbox topic so the peer can subscribe to the conversation topic immediately (typing works before the first message). |
| `gat_conversations(p_token text)` | `Conversation[]` | All of mine, newest activity first (`coalesce(last_message_at, created_at) desc`). |
| `gat_messages(p_token text, p_conversation uuid, p_before timestamptz default null, p_limit int default 40)` | `Message[]` | Newest first, `created_at < p_before` when given, limit clamped to 1..100. `forbidden` if not a member. |
| `gat_send(p_token text, p_conversation uuid, p_id uuid, p_body text)` | `Message` | Trims body; `body_invalid` if empty or > 2000 chars. Idempotent on `p_id` (re-send returns the existing row). Sets `last_message_at`, sets the sender's `last_read_at = created_at`. Fan-out happens in the insert trigger (below). |
| `gat_read(p_token text, p_conversation uuid)` | `{ at: string }` | Sets my `last_read_at = now()` (never moves backwards), `realtime.send` event `read` `{ conversation_id, user_id, at }` to the peer's and my inbox. |
| `gat_theme(p_token text, p_conversation uuid, p_theme text)` | `Conversation` | Theme id must be in the allowed list (see Themes). Updates theme columns, inserts a `kind='theme'` message whose body is the theme id (the trigger fans it out like any message, but it never triggers push), and `realtime.send`s event `theme` `{ conversation_id, theme, theme_by, theme_at }` to both inboxes. |
| `gat_mute(p_token text, p_conversation uuid, p_muted boolean)` | `{ muted: boolean }` | |
| `gat_heartbeat(p_token text, p_conv uuid default null, p_visible boolean default true)` | `void` | `last_seen_at = now()`; if visible: `active_at = now(), active_conv = p_conv`, else `active_at = null, active_conv = null`. Client calls it on visibility change, on route change, and every 20 s while visible. |
| `gat_push_subscribe(p_token text, p_endpoint text, p_p256dh text, p_auth text, p_ua text default null)` | `void` | Upsert by endpoint (an endpoint moves to the latest user that registers it). Max 10 subs per user (delete oldest). |
| `gat_push_unsubscribe(p_token text, p_endpoint text)` | `void` | Deletes only if owned by caller. |

### Message insert trigger (`gat_messages` AFTER INSERT)

1. `realtime.send(jsonb_build_object('message', <Message>, 'conversation', <Conversation from the RECIPIENT's perspective>), 'msg', 'gat:u:' || recipient.inbox, false)`
2. Same event to the sender's own inbox, with the conversation from the sender's perspective (multi-tab sync).
3. If `kind = 'text'` and the recipient has at least one row in `gat_push_subs` and is not muted in that conversation: `net.http_post(url := push_url, body := jsonb_build_object('message_id', new.id), headers := jsonb_build_object('Content-Type','application/json','x-gat-secret', push_secret), timeout_milliseconds := 4000)`. Skip silently if `push_url` is not configured. Must never make the insert fail (wrap in an exception block).

### Server-only RPCs (secret-gated; called by `api/push.ts`)

- `gat_push_claim(p_secret text, p_message uuid) returns jsonb`: raises `forbidden` unless `p_secret` equals `gat_config.push_secret`. Atomically claims the message (`update ... set pushed_at = now() where id = p_message and pushed_at is null and kind = 'text' returning ...`). Returns `{ send: false }` when already claimed, when the recipient muted the conversation, or when the recipient is actively looking at the app (`active_at > now() - interval '45 seconds'`). Otherwise `{ send: true, title: <sender username>, body: <first 140 chars>, url: '/dm/' || <sender username>, tag: <conversation id>, subs: [{ endpoint, p256dh, auth }] }`.
- `gat_push_prune(p_secret text, p_endpoints text[]) returns void`: deletes those subscriptions (used for 404/410 from push services).

## Realtime (public channels, secret topic names)

One `RealtimeClient` per tab (`${VITE_SUPABASE_URL}/realtime/v1`, `params: { apikey }`). Channels:

| Topic | Who joins | Events |
| --- | --- | --- |
| `gat:lobby` | Everyone with a session (and the onboarding screen, read-only, for the live count) | **Presence** only. Key = user id. Meta = `{ id, username, gender, since: <ISO when this tab joined>, away: boolean }`. `away` flips when `document.visibilityState` changes. Untrack on `pagehide`. |
| `gat:u:<inbox>` | Only the owner (topic id comes from `gat_me`/`gat_join`) | Sent by the DB: `msg` `{ message, conversation }`, `conv` (Conversation), `read` `{ conversation_id, user_id, at }`, `theme` `{ conversation_id, theme, theme_by, theme_at }`. |
| `gat:c:<topic>` | Both participants, for every conversation they have (subscribe on boot from `gat_conversations`, and on `conv`/`msg` events for new ones) | Client broadcast (`self: false`): `typing` `{ user_id, on: boolean }`, `msg` (`Message` with client `created_at`, instant preview before the DB echo). |

Rules:
- Presence metas are only trusted for "is online". Display data comes from `gat_profiles` (verify unknown ids in a batched call; drop ids that do not resolve). Render optimistically from the meta while verification is in flight.
- Accept a `gat:c:*` `msg` broadcast only if `sender_id` is the conversation's peer. DB `msg` events are authoritative: upsert by `message.id`, replace client timestamps with server ones.
- Typing: send `on: true` at most every 2 s while the composer has text and changed; send `on: false` on send, on clear, on blur, and after 4 s idle. Receivers expire a typing flag after 6 s without refresh.
- Gap fill: whenever a channel (re)reaches `SUBSCRIBED` after a disconnect, or the tab becomes visible after being hidden for more than 10 s, refetch `gat_conversations` and the latest page of messages for the open conversation, then merge by id.

## Client architecture

```
index.html                      preconnect to supabase, theme-color, manifest link, apple-touch-icon
vercel.json                     SPA rewrites (everything except /api/* and real files -> /index.html), headers for sw.js
api/push.ts                     POST { message_id } with header x-gat-secret -> gat_push_claim -> web-push -> gat_push_prune
api/manifest.ts                 GET ?t= -> manifest JSON with start_url "/?t=<t>" (no t -> start_url "/")
public/sw.js                    push + notificationclick (focus existing client and navigate, else openWindow). Optional shell caching.
public/icons/*                  PWA icons (192, 512, maskable, apple-touch 180), favicon.svg
src/main.tsx                    boot: read session, open realtime socket early, render
src/App.tsx                     routes + responsive shell
src/lib/env.ts                  typed import.meta.env
src/lib/api.ts                  rpc<T>(fn, args) via fetch POST /rest/v1/rpc/<fn> with apikey + Authorization: Bearer <key> headers; typed wrappers for every RPC; ApiError(code)
src/lib/session.ts              cookie + localStorage read/write/clear, ?t= adoption
src/lib/realtime.ts             RealtimeClient singleton + helpers
src/lib/store.ts                zustand store (shape below)
src/lib/engine.ts               wires realtime + api into the store: boot(), lobby presence, inbox, conversation channels, typing, heartbeat, gap fill, local cache
src/lib/push.ts                 permission + subscribe/unsubscribe + server registration, capability detection (incl. iOS not-installed)
src/lib/types.ts                the JSON shapes above
src/lib/format.ts               relative time ("now", "5m", "2h", "Tue", "12 Mar"), etc. No em or en dashes anywhere.
src/themes/                     theme registry + ambient layers
src/ui/                         design system primitives (Avatar/GoofyFace, icons, Button, Sheet, Segmented, Toast, Toggle...)
src/features/onboarding/        start screen
src/features/lobby/             live users list + gender filter
src/features/inbox/             DM list
src/features/chat/              chat view, composer, bubbles, typing, header, settings sheet (theme picker + notifications toggle)
```

### Store shape (`src/lib/store.ts`)

```ts
type State = {
  status: 'booting' | 'onboarding' | 'ready'
  me: Me | null
  token: string | null
  online: Record<string, { id: string; username: string; gender: Gender; since: string; away: boolean }> // from lobby presence, excludes me
  profiles: Record<string, Profile>             // verified profile cache
  conversations: Record<string, Conversation>   // by conversation id
  convByPeer: Record<string, string>            // peer id -> conversation id
  messages: Record<string, Message[]>           // by conversation id, ascending by created_at, deduped by id
  pending: Record<string, 'sending' | 'failed'> // message id -> state for my optimistic messages
  hasMore: Record<string, boolean>              // older pages available
  typing: Record<string, number>                // conversation id -> expiry epoch ms (peer typing)
  activeConv: string | null                     // open + visible conversation
  connection: 'connecting' | 'online' | 'offline'
  toasts: Toast[]                               // in-app message banners when a message arrives for a non-open conversation
}
```

Actions live in `engine.ts` and are exported as plain functions (`join`, `openChatWith(peerId|username)`, `sendMessage(convId, body)`, `retry(msgId)`, `loadOlder(convId)`, `setTheme(convId, theme)`, `setMuted(convId, muted)`, `markRead(convId)`, `setTyping(convId, on)`, `setActiveConv(convId|null)`, `logout()`).

Local cache: persist `me`, `conversations`, and the newest 40 messages per conversation to `localStorage` (`gat.cache.v1`) on change (throttled), hydrate synchronously on boot so the UI paints instantly, then revalidate.

### Routes

- `/` : onboarding if no session, else the lobby (live users).
- `/dm` : inbox.
- `/dm/:username` : chat with that user (resolve via `online`/`profiles`/`gat_lookup`, then `gat_open`).
- Desktop (min-width 960px): persistent left column (live users / DMs) + right pane (chat or an idle state). Same routes.
- Mobile: one screen at a time, native-feeling push/pop transitions, safe-area aware, keyboard aware (`interactive-widget=resizes-content`, `100dvh`, `visualViewport`).

### Push UX

The notifications toggle lives in the chat settings sheet.
- Toggle ON: if this device has no push subscription, request `Notification` permission, subscribe with the VAPID public key, `gat_push_subscribe`. Then `gat_mute(conv, false)`.
- Toggle OFF: `gat_mute(conv, true)` (device subscription stays for other chats).
- The toggle shows ON only when the device is subscribed AND the chat is not muted.
- Unsupported (iOS Safari not installed to the home screen): the toggle row shows a compact inline hint to add the app to the home screen. Permission denied: show that it is blocked in browser settings. These are the only explanatory strings allowed.
- Service worker shows `{ title, body, tag, data: { url } }`, `renotify: true`, icon = app icon. Click focuses an existing window and navigates it to `url`, or opens one.

### Themes

Allowed theme ids (DB function `gat_theme` must whitelist exactly these): `goofy`, `cherry`, `midnight`, `matcha`, `peach`, `lagoon`, `lavender`, `terminal`, `bubblegum`, `citrus`, `aurora`, `noir`, `strawberry`, `forest`, `sunset`, `y2k`. The visual definition of each lives in `DESIGN.md` and `src/themes/`.

## Copy rules

- No explanatory or instructional copy anywhere in the product. Labels, placeholders and states only.
- Never use the em dash or en dash characters anywhere in UI strings, titles, notifications, or meta tags.
- Lowercase, playful, short.
