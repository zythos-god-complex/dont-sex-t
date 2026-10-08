-- nsfw flag (ok with foul language); shown as devil horns on the face
alter table public.gat_users add column if not exists nsfw boolean not null default false;
-- gat_profile_json now also returns 'nsfw' (see applied migration gat_nsfw)
-- gat_set_nsfw(p_token text, p_on boolean) returns Me

-- reactions (applied as migration gat_reactions): gat_reactions(message_id, user_id, emoji), gat_react(p_token, p_message, p_emoji);
-- gat_msg_json now includes 'reactions': { user_id: emoji }. Fan-out event 'react' to both inboxes.
