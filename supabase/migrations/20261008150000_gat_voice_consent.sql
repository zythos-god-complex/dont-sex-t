-- Per conversation voice note consent. Both members must opt in.
-- Applied via MCP: adds gat_members.voice, exposes my_voice/peer_voice in gat_conv_json,
-- and gat_set_voice(p_token, p_conversation, p_on) which pushes a conv event to both inboxes.
alter table public.gat_members add column if not exists voice boolean not null default false;
