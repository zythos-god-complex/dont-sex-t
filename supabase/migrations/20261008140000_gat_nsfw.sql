-- nsfw flag (ok with foul language); shown as devil horns on the face
alter table public.gat_users add column if not exists nsfw boolean not null default false;
-- gat_profile_json now also returns 'nsfw' (see applied migration gat_nsfw)
-- gat_set_nsfw(p_token text, p_on boolean) returns Me
