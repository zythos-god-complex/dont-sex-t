-- the admin owns everything except a couple of items left locked on purpose, to try the buy flow
create or replace function public.gat_owns(u public.gat_users, p_item text)
 returns boolean language sql stable
 set search_path to 'public', 'extensions', 'pg_temp'
as $function$
  select (u.is_admin and p_item not in ('theme:galaxy', 'hat:wizard'))
    or not exists (select 1 from public.gat_shop_items i where i.id = p_item)
    or (u.perks and split_part(p_item, ':', 1) in ('hat', 'card', 'aura'))
    or (lower(u.username) = 'ember' and split_part(p_item, ':', 1) in ('theme', 'graffiti'))
    or exists (select 1 from public.gat_owned o where o.user_id = u.id and o.item = p_item);
$function$;
revoke all on function public.gat_owns(public.gat_users, text) from public, anon, authenticated;
